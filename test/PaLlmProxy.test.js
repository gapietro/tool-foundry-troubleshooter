/**
 * PaLlmProxy — pure-logic tests (Phase 1b Task 2,
 * docs/superpowers/plans/2026-08-02-phase1b-harness.md; LLD §3, §4.8).
 *
 * WHAT THESE TESTS ARE FOR
 * The strict-JSON parse contract (`_parseResponse`), and the retry contract
 * built on top of it (`reason`). The `invoke` seam is always a test double
 * here — `sn_one_extend` is never loaded into the vm sandbox, which is itself
 * the point: nothing above `_invokeNask` may depend on NASK, and these tests
 * exercise everything except `_invokeNask` through the injected seam.
 *
 * WHAT THESE DO NOT SETTLE
 * That `_invokeNask`'s call shape actually works against a real instance —
 * that was Task 1's live probe (LLD §4.8 addendum), not something a unit test
 * can re-verify. Per DESIGN.md R-8, a stub result here is not evidence about
 * platform behaviour in either direction.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')

function load(opts) {
    const o = opts || {}
    const ctx = loadScriptInclude('PaLlmProxy.js', { JSON: JSON })
    return new ctx.PaLlmProxy(o)
}

/** Records every (skillName, prompt) call and returns queued responses in order. */
function stubInvoke(responses) {
    const calls = []
    let i = 0
    return {
        calls: calls,
        fn: function (skillName, prompt) {
            calls.push({ skillName: skillName, prompt: prompt })
            const r = responses[i]
            i += 1
            return r
        },
    }
}

// ===========================================================================
// _parseResponse — the documented matrix, one case each (Task 2 brief, Step 1)
// ===========================================================================

describe('PaLlmProxy._parseResponse — parse contract matrix', () => {
    const cases = [
        ['valid tool_call', '{"action":"tool_call","tool":"agent_trace","args":{"execution":"abc"}}', true],
        ['valid answer', '{"action":"answer","text":"done"}', true],
        ['valid fix_report', '{"action":"fix_report","report":{"failure_summary":"x"}}', true],
        ['fenced JSON', '```json\n{"action":"answer","text":"ok"}\n```', true],
        ['leading prose then JSON', 'Sure, here it is: {"action":"answer","text":"ok"}', true],
        ['malformed JSON', '{"action":"tool_call",', false],
        ['empty response', '', false],
        ['valid JSON, unknown action', '{"action":"delete_everything"}', false],
        ['valid JSON, no action key', '{"tool":"agent_trace"}', false],
    ]

    test.each(cases)('%s', (name, raw, expectedOk) => {
        const proxy = load()
        const result = proxy._parseResponse(raw)

        expect(result.ok).toBe(expectedOk)
        if (expectedOk) {
            expect(typeof result.action).toBe('object')
            expect(result.action.action).toBeDefined()
        } else {
            // "the reason string on every failure names what was wrong" —
            // Task 2 brief, Step 1.
            expect(typeof result.reason).toBe('string')
            expect(result.reason.length).toBeGreaterThan(0)
        }
    })

    test('a tool_call with no tool name is ok:false, reason names it', () => {
        const proxy = load()
        const result = proxy._parseResponse('{"action":"tool_call","args":{}}')

        expect(result.ok).toBe(false)
        expect(typeof result.reason).toBe('string')
        expect(result.reason.length).toBeGreaterThan(0)
    })

    test('a tool_call with an empty-string tool name is ok:false', () => {
        const proxy = load()
        const result = proxy._parseResponse('{"action":"tool_call","tool":""}')

        expect(result.ok).toBe(false)
    })

    test('a fix_report with no report object is ok:false', () => {
        const proxy = load()
        const result = proxy._parseResponse('{"action":"fix_report"}')

        expect(result.ok).toBe(false)
    })

    test('an answer with no text field is ok:false', () => {
        const proxy = load()
        const result = proxy._parseResponse('{"action":"answer"}')

        expect(result.ok).toBe(false)
    })

    test('a bare JSON array is ok:false, not mistaken for an object', () => {
        const proxy = load()
        const result = proxy._parseResponse('[1,2,3]')

        expect(result.ok).toBe(false)
    })

    test('null and undefined raw are both ok:false without throwing', () => {
        const proxy = load()

        expect(() => proxy._parseResponse(null)).not.toThrow()
        expect(() => proxy._parseResponse(undefined)).not.toThrow()
        expect(proxy._parseResponse(null).ok).toBe(false)
        expect(proxy._parseResponse(undefined).ok).toBe(false)
    })
})

// ===========================================================================
// reason() — retry contract (Task 2 brief, Step 4)
// ===========================================================================

describe('PaLlmProxy.reason — retry contract', () => {
    test('valid on the first try: success, retried:false, exactly one invoke call', () => {
        const stub = stubInvoke([{ success: true, text: '{"action":"answer","text":"done"}' }])
        const proxy = load({ invoke: stub.fn })

        const result = proxy.reason('diagnose this')

        expect(result).toEqual({
            success: true,
            action: { action: 'answer', text: 'done' },
            raw: '{"action":"answer","text":"done"}',
            retried: false,
        })
        expect(stub.calls.length).toBe(1)
        expect(stub.calls[0].skillName).toBe('reason')
    })

    test('first malformed, second valid: exactly ONE re-prompt naming the parse reason and "JSON only"', () => {
        const stub = stubInvoke([
            { success: true, text: 'not json at all' },
            { success: true, text: '{"action":"answer","text":"ok now"}' },
        ])
        const proxy = load({ invoke: stub.fn })
        const expectedReason = proxy._parseResponse('not json at all').reason

        const result = proxy.reason('diagnose this')

        expect(result.success).toBe(true)
        expect(result.retried).toBe(true)
        expect(result.action).toEqual({ action: 'answer', text: 'ok now' })
        expect(result.raw).toBe('{"action":"answer","text":"ok now"}')

        expect(stub.calls.length).toBe(2)
        const retryPrompt = stub.calls[1].prompt
        expect(retryPrompt).toEqual(expect.stringContaining('JSON only'))
        expect(retryPrompt).toEqual(expect.stringContaining(expectedReason))
        // The original prompt is preserved, not discarded, on retry.
        expect(retryPrompt).toEqual(expect.stringContaining('diagnose this'))
    })

    test('malformed twice: failure, carries the raw text, no third call', () => {
        const stub = stubInvoke([
            { success: true, text: 'nope' },
            { success: true, text: 'still nope' },
        ])
        const proxy = load({ invoke: stub.fn })

        const result = proxy.reason('diagnose this')

        expect(result.success).toBe(false)
        expect(typeof result.error).toBe('string')
        expect(result.error.length).toBeGreaterThan(0)
        expect(result.raw).toBe('still nope')
        expect(stub.calls.length).toBe(2)
    })

    test('invoke-level failure on the first call: no retry, error names the LLM layer not the parse layer', () => {
        const stub = stubInvoke([{ success: false, error: 'provider unavailable' }])
        const proxy = load({ invoke: stub.fn })

        const result = proxy.reason('diagnose this')

        expect(result.success).toBe(false)
        expect(result.raw).toBeNull()
        expect(stub.calls.length).toBe(1)
        // Distinguishes "the LLM call itself failed" from "the model's
        // response couldn't be parsed" — /status and the Evidence Bundle
        // advice depend on telling these apart (Task 2 brief, Step 4).
        expect(result.error.toLowerCase()).toEqual(expect.stringContaining('invocation'))
        expect(result.error).toEqual(expect.stringContaining('provider unavailable'))
    })

    test('invoke-level failure on the retry call: no further retry, raw carries the first response', () => {
        const stub = stubInvoke([
            { success: true, text: 'not json' },
            { success: false, error: 'timeout' },
        ])
        const proxy = load({ invoke: stub.fn })

        const result = proxy.reason('diagnose this')

        expect(result.success).toBe(false)
        expect(result.raw).toBe('not json')
        expect(stub.calls.length).toBe(2)
        expect(result.error).toEqual(expect.stringContaining('timeout'))
    })

    test('absent or empty prompt is rejected without ever calling invoke (R-9)', () => {
        const stub = stubInvoke([])
        const proxy = load({ invoke: stub.fn })

        const empty = proxy.reason('')
        const whitespace = proxy.reason('   ')
        const missing = proxy.reason(undefined)

        expect(empty.success).toBe(false)
        expect(whitespace.success).toBe(false)
        expect(missing.success).toBe(false)
        expect(stub.calls.length).toBe(0)
    })
})

// ===========================================================================
// summarize() — plain text, no JSON contract, no retry
// ===========================================================================

describe('PaLlmProxy.summarize', () => {
    test('success passes model text through untouched, no parsing applied', () => {
        const proxy = load({
            invoke: function (skillName, prompt) {
                expect(skillName).toBe('summarize')
                expect(prompt).toBe('summarize this run')
                return { success: true, text: 'plain prose, definitely not { json' }
            },
        })

        const result = proxy.summarize('summarize this run')

        expect(result).toEqual({ success: true, text: 'plain prose, definitely not { json' })
    })

    test('invoke failure surfaces the LLM-layer error, no retry', () => {
        const stub = stubInvoke([{ success: false, error: 'timeout' }])
        const proxy = load({ invoke: stub.fn })

        const result = proxy.summarize('summarize this run')

        expect(result.success).toBe(false)
        expect(result.error).toEqual(expect.stringContaining('timeout'))
        expect(stub.calls.length).toBe(1)
    })

    test('absent prompt is rejected without calling invoke (R-9)', () => {
        const stub = stubInvoke([])
        const proxy = load({ invoke: stub.fn })

        const result = proxy.summarize(undefined)

        expect(result.success).toBe(false)
        expect(stub.calls.length).toBe(0)
    })
})

// ===========================================================================
// Seam isolation — the ONLY method allowed to know NASK exists is _invokeNask
// ===========================================================================

describe('PaLlmProxy — seam isolation', () => {
    test('with no injected invoke, the default seam falls back to _invokeNask and degrades safely when sn_one_extend is absent', () => {
        const proxy = load()

        expect(() => proxy.reason('hello')).not.toThrow()
        const result = proxy.reason('hello')

        expect(result.success).toBe(false)
        expect(result.raw).toBeNull()
    })

    test('_invokeNask maps the "reason" and "summarize" seam names to distinct NASK skill configs', () => {
        const proxy = load()

        expect(proxy._NASK_SKILLS.reason.capabilityId).not.toBe(proxy._NASK_SKILLS.summarize.capabilityId)
        expect(proxy._NASK_SKILLS.reason.skillConfigId).not.toBe(proxy._NASK_SKILLS.summarize.skillConfigId)
    })

    test('_invokeNask on an unknown skill name fails cleanly without throwing', () => {
        const proxy = load()

        expect(() => proxy._invokeNask('bogus', 'hi')).not.toThrow()
        const result = proxy._invokeNask('bogus', 'hi')
        expect(result.success).toBe(false)
    })
})
