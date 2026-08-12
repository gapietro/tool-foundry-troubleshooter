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

    // =======================================================================
    // #188 — the collapsed-envelope failure class
    //
    // Measured live on gpinst01 (v14 rows 06 and 08, runs TR1000300 /
    // TR1000302, `sys_generative_ai_log` 09c46b8f… and a5c4ab8f…): the model
    // emitted a TOOL NAME in the action slot —
    //
    //     {"action": "agent_config", "args": {"agent": "Seed 05 …"}}
    //
    // — which `_parseResponse` correctly rejects, since the action vocabulary
    // is tool_call | answer | fix_report. The parser is not the defect.
    //
    // The defect is that the ONE allowed retry cannot recover this class: the
    // re-prompt answered every parse failure with FORMATTING advice ("JSON
    // only … no prose, no markdown fence"), and that response was already
    // flawless JSON with no prose and no fence. The model was told to fix the
    // one thing it had not got wrong, so it changed nothing — the retry
    // response was BYTE-IDENTICAL to the first on both runs, and the custom
    // arm could not diagnose a no-execution scenario at all.
    //
    // The re-prompt must therefore answer the failure it actually got.
    // =======================================================================

    test('#188 unknown action naming a tool: the re-prompt teaches the envelope, not formatting', () => {
        const collapsed = '{"action":"agent_config","args":{"agent":"Seed 05 Ticket Acknowledger"}}'
        const stub = stubInvoke([
            { success: true, text: collapsed },
            { success: true, text: '{"action":"tool_call","tool":"agent_config","args":{"agent":"Seed 05 Ticket Acknowledger"}}' },
        ])
        const proxy = load({ invoke: stub.fn })

        const result = proxy.reason('diagnose this')

        expect(stub.calls.length).toBe(2)
        const retryPrompt = stub.calls[1].prompt

        // It must name the offending value and say what it actually is.
        expect(retryPrompt).toEqual(expect.stringContaining('agent_config'))

        // It must restate the legal vocabulary — the thing the model got
        // wrong — rather than only repeating the JSON-shape advice.
        expect(retryPrompt).toEqual(expect.stringContaining('tool_call'))
        expect(retryPrompt).toEqual(expect.stringContaining('answer'))
        expect(retryPrompt).toEqual(expect.stringContaining('fix_report'))

        // And it must show the rewrap concretely, since "matching the required
        // schema exactly" is precisely what the model already believed it did.
        expect(retryPrompt).toEqual(
            expect.stringContaining('"action":"tool_call","tool":"agent_config"')
        )

        // The recovery this whole test exists for.
        expect(result.success).toBe(true)
        expect(result.retried).toBe(true)
        expect(result.action.action).toBe('tool_call')
        expect(result.action.tool).toBe('agent_config')
    })

    test('#188 the "JSON only" invariant and the original prompt survive the new branch', () => {
        const stub = stubInvoke([
            { success: true, text: '{"action":"agent_config","args":{}}' },
            { success: true, text: '{"action":"answer","text":"ok"}' },
        ])
        const proxy = load({ invoke: stub.fn })

        proxy.reason('diagnose this')

        const retryPrompt = stub.calls[1].prompt
        // Task 2 brief, Step 4 — the literal phrase is contractual on EVERY
        // re-prompt, not only the generic one.
        expect(retryPrompt).toEqual(expect.stringContaining('JSON only'))
        expect(retryPrompt).toEqual(expect.stringContaining('diagnose this'))
    })

    test('#188 a non-vocabulary parse failure still gets the generic formatting advice', () => {
        const stub = stubInvoke([
            { success: true, text: 'not json at all' },
            { success: true, text: '{"action":"answer","text":"ok"}' },
        ])
        const proxy = load({ invoke: stub.fn })

        proxy.reason('diagnose this')

        const retryPrompt = stub.calls[1].prompt
        expect(retryPrompt).toEqual(expect.stringContaining('no markdown fence'))
        // No envelope lecture where the failure was not about the envelope.
        expect(retryPrompt).not.toEqual(expect.stringContaining('is a TOOL'))
    })

    // =======================================================================
    // #192 review — the same defect in its remaining slots.
    //
    // The first fix covered `unknown action:` only. Four neighbours were left
    // getting formatting advice for non-formatting failures, and the new
    // branch itself had three ways to emit useless or self-contradictory
    // guidance. Each case below is one of them.
    // =======================================================================

    /** Drives one re-prompt and returns it, without asserting on recovery. */
    function retryPromptFor(firstText) {
        const stub = stubInvoke([
            { success: true, text: firstText },
            { success: true, text: '{"action":"answer","text":"ok"}' },
        ])
        load({ invoke: stub.fn }).reason('diagnose this')
        return stub.calls[1].prompt
    }

    test('#192 the nearest neighbour — right action word, missing tool key — names the key', () => {
        // The collapse one slot over. This used to get "no markdown fence".
        const prompt = retryPromptFor('{"action":"tool_call","args":{"agent":"Seed 05"}}')

        expect(prompt).toEqual(expect.stringContaining('"tool" key'))
        expect(prompt).toEqual(expect.stringContaining('"action":"tool_call","tool":"<tool name>"'))
        expect(prompt).not.toEqual(expect.stringContaining('no markdown fence'))
    })

    test('#192 the other two structural failures name their missing key too', () => {
        expect(retryPromptFor('{"action":"answer"}')).toEqual(
            expect.stringContaining('"text" key')
        )
        expect(retryPromptFor('{"action":"fix_report","report":"not an object"}')).toEqual(
            expect.stringContaining('"report" object')
        )
    })

    test('#192 the not-an-object reason maps to object advice — though the brace-slice hides it', () => {
        // Reachability note, found writing this test: `_parseResponse` slices
        // from the first `{` to the last `}`, so `[{"action":"answer",…}]`
        // yields the INNER object and parses clean — no retry at all. A slice
        // bounded by braces can only parse to an object or throw, so
        // 'parsed value is not a JSON object' is unreachable through reason().
        // The mapping is kept as defensive cover for that contract changing,
        // and is asserted directly rather than through a fake end-to-end path.
        const proxy = load({})
        const prompt = proxy._buildRetryPrompt('p', 'parsed value is not a JSON object')

        expect(prompt).toEqual(expect.stringContaining('single JSON OBJECT'))
        expect(prompt).not.toEqual(expect.stringContaining('no markdown fence'))
    })

    test('#192 an array wrapping one object still parses via the brace-slice, no retry', () => {
        const stub = stubInvoke([{ success: true, text: '[{"action":"answer","text":"x"}]' }])
        const result = load({ invoke: stub.fn }).reason('diagnose this')

        expect(stub.calls.length).toBe(1)
        expect(result.success).toBe(true)
        expect(result.action).toEqual({ action: 'answer', text: 'x' })
    })

    test('#192 a legal action mangled by whitespace gets whitespace advice, not a contradiction', () => {
        const prompt = retryPromptFor('{"action":"tool_call ","tool":"agent_config"}')

        expect(prompt).toEqual(expect.stringContaining('stray space'))
        // The contradiction the review caught: telling the model that
        // "tool_call" is not one of tool_call/answer/fix_report.
        expect(prompt).not.toEqual(expect.stringContaining('is not one of the three legal values'))
    })

    test('#192 a quote in the action value cannot make the exemplar itself invalid JSON', () => {
        const prompt = retryPromptFor('{"action":"call \\"agent_config\\"","args":{}}')

        // Pull the exemplar back out and prove it parses.
        const exemplar = /(\{"action":"tool_call","tool":.*?,"args":\{\.\.\.\}\})/.exec(prompt)
        expect(exemplar).not.toBeNull()
        const probe = exemplar[1].replace('{...}', '{}')
        expect(() => JSON.parse(probe)).not.toThrow()
        expect(JSON.parse(probe).tool).toBe('call "agent_config"')
    })

    test('#192 a non-string action falls back to generic rather than lecturing about [object Object]', () => {
        const prompt = retryPromptFor('{"action":{"name":"agent_config"},"args":{}}')

        expect(prompt).not.toEqual(expect.stringContaining('[object Object]" is a TOOL'))
        expect(prompt).toEqual(expect.stringContaining('no markdown fence'))
    })

    test('#192 a newline inside the action value still reaches the envelope branch', () => {
        const prompt = retryPromptFor('{"action":"agent_config\\n(the tool)","args":{}}')

        // Previously `.` could not cross the newline, so this silently fell
        // through to formatting advice.
        expect(prompt).toEqual(expect.stringContaining('is a TOOL you want to call'))
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
