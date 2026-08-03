/**
 * PaAgentLoop — loop-skeleton tests (Phase 1b Task 6, ADR Layer 3,
 * docs/superpowers/plans/2026-08-02-phase1b-harness.md).
 *
 * WHAT THESE TESTS ARE FOR
 * The bare iteration driver: bounds-first looping, the three terminal action
 * shapes (tool_call is non-terminal — it loops; answer and fix_report are
 * terminal), the ONE-repair fix_report policy, and the two "never a silent
 * stop" failure floors (LLM failure, bound exhaustion). Every collaborator
 * (PaLlmProxy, PaToolRegistry, PaRunManager, PaFixReport) is a hand-rolled
 * fake here — this suite is not re-testing any of their own internals, only
 * what PaAgentLoop does with what they hand back. Zero Glide anywhere.
 */

const fs = require('fs')
const path = require('path')
const { loadScriptInclude } = require('./_loadScriptInclude')

const SRC_PATH = path.join(__dirname, '..', 'src', 'server', 'PaAgentLoop.js')

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function fakeLlm(responses) {
    const calls = []
    let i = 0
    return {
        calls: calls,
        reason: function (prompt) {
            calls.push(prompt)
            const r = responses[i]
            i += 1
            return r === undefined ? { success: false, error: 'no more stubbed responses' } : r
        },
    }
}

function fakeTools(dispatchResults) {
    const calls = []
    let i = 0
    return {
        calls: calls,
        promptBlock: function () {
            return 'TOOLBLOCK'
        },
        // The real PaToolRegistry.list() — the effort floor (#88) needs the
        // registered names to tell "a tool this run never called" from an
        // arbitrary noun in the report's prose.
        list: function () {
            return [
                { name: 'agent_trace' },
                { name: 'agent_config' },
                { name: 'schema_lookup' },
                { name: 'query_table' },
                { name: 'genai_log' },
                { name: 'log_analysis' },
                { name: 'read_artifact' },
            ]
        },
        dispatch: function (name, args, runCtx) {
            calls.push({ name: name, args: args, runCtx: runCtx })
            if (typeof dispatchResults === 'function') return dispatchResults(name, args, runCtx, calls.length)
            const r = dispatchResults[i]
            i += 1
            return r === undefined ? { success: true, data: {} } : r
        },
    }
}

function fakeRunManager() {
    const transcript = []
    const closeCalls = []
    return {
        transcript: transcript,
        closeCalls: closeCalls,
        appendTranscript: function (runId, entry) {
            const normalized = Object.assign({}, entry)
            transcript.push(normalized)
            return { success: true, entry: normalized, count: transcript.length }
        },
        loadContext: function () {
            return { transcript: transcript.slice(), context_summary: '' }
        },
        close: function (runId, status, options) {
            closeCalls.push({ runId: runId, status: status, options: options })
            return { success: true, run_id: runId, status: status }
        },
    }
}

function fakeFixReport(validateResults) {
    const calls = []
    const contextCalls = []
    const renderCalls = { markdown: [], json: [] }
    let i = 0
    return {
        calls: calls,
        contextCalls: contextCalls,
        renderCalls: renderCalls,
        validate: function (report, context) {
            calls.push(report)
            contextCalls.push(context)
            const r = validateResults[i]
            i += 1
            return r === undefined ? { valid: false, problems: ['no more stubbed validations'] } : r
        },
        repairPrompt: function (report, problems) {
            return 'REPAIR PROMPT: ' + JSON.stringify(problems) + ' DRAFT: ' + JSON.stringify(report)
        },
        // Real PaFixReport.renderMarkdown/renderJson both take the SAME
        // normalized object and describe the same report (see that file's
        // header) — these fakes mirror that: deterministic, distinguishable
        // output per rendering, and every call recorded so tests can assert
        // the loop actually calls them rather than re-stringifying itself.
        renderMarkdown: function (normalized) {
            renderCalls.markdown.push(normalized)
            return 'MARKDOWN(' + JSON.stringify(normalized) + ')'
        },
        renderJson: function (normalized) {
            renderCalls.json.push(normalized)
            return 'JSON(' + JSON.stringify(normalized) + ')'
        },
        // Fix round (issue #64/#65): PaAgentLoop's own fix_report contract
        // block reads this — single-sourced from PaFixReport, never a second
        // hand-copied schema string. See test file header.
        schemaText: function () {
            return 'STUB_SCHEMA_TEXT'
        },
        // #88: the fix-less-inconclusive predicate lives in PaFixReport (it
        // owns the report contract) and the loop asks rather than
        // re-deriving it. Mirrors the real method.
        isFixlessInconclusive: function (report) {
            const r = report || {}
            return (
                Array.isArray(r.root_causes) &&
                r.root_causes.length === 0 &&
                Array.isArray(r.fixes) &&
                r.fixes.length === 0 &&
                !!r.inconclusive &&
                typeof r.inconclusive === 'object'
            )
        },
    }
}

function fakeClock(sequence) {
    let i = 0
    return function () {
        const v = sequence[i]
        i += 1
        return v === undefined ? sequence[sequence.length - 1] : v
    }
}

function fakeAuditLogger(result) {
    const calls = []
    return {
        calls: calls,
        invokedTools: function (runId) {
            calls.push(runId)
            if (result instanceof Error) throw result
            return result
        },
    }
}

function load(opts) {
    const o = opts || {}
    const ctx = loadScriptInclude('PaAgentLoop.js', { JSON: JSON })
    return new ctx.PaAgentLoop(o)
}

// ===========================================================================
// happy path: reason -> tool_call -> dispatch -> observe, twice, then answer
// ===========================================================================

describe('happy path', () => {
    test('reason -> tool_call -> dispatch -> observe (x2), then answer -> run closed complete', () => {
        const llm = fakeLlm([
            { success: true, action: { action: 'tool_call', tool: 'agent_trace', args: { execution: 'e1' } }, raw: 'r1', retried: false },
            { success: true, action: { action: 'tool_call', tool: 'schema_lookup', args: { table: 't1' } }, raw: 'r2', retried: false },
            { success: true, action: { action: 'answer', text: 'All good' }, raw: 'r3', retried: false },
        ])
        const tools = fakeTools([
            { success: true, data: { plan: 'x' } },
            { success: true, data: { columns: [] } },
        ])
        const runs = fakeRunManager()
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, playbook: 'PLAYBOOK', now: () => 0 })

        const res = loop.run('run1', { execution: 'e1' })

        expect(res.success).toBe(true)
        expect(res.outcome).toBe('answer')
        expect(llm.calls).toHaveLength(3)
        expect(tools.calls).toHaveLength(2)
        expect(runs.closeCalls).toHaveLength(1)
        expect(runs.closeCalls[0].runId).toBe('run1')
        expect(runs.closeCalls[0].status).toBe('complete')

        // Sequence, not just counts: llm+tool paired per tool_call
        // iteration, then a final llm entry for the terminal answer (no
        // paired tool entry — answer never dispatches) followed by the
        // system entry _finishAnswer appends before closing the run.
        const actors = runs.transcript.map((e) => e.actor)
        expect(actors).toEqual(['llm', 'tool', 'llm', 'tool', 'llm', 'system'])
    })

    test('the initial prompt carries the playbook, the tool promptBlock, and the request', () => {
        const llm = fakeLlm([{ success: true, action: { action: 'answer', text: 'done' }, raw: 'r1' }])
        const tools = fakeTools([])
        const runs = fakeRunManager()
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, playbook: 'MY PLAYBOOK TEXT', now: () => 0 })

        loop.run('run1', { execution: 'plan123' })

        expect(llm.calls[0]).toContain('MY PLAYBOOK TEXT')
        expect(llm.calls[0]).toContain('TOOLBLOCK')
        expect(llm.calls[0]).toContain('plan123')
    })
})

// ===========================================================================
// fix_report JSON contract block (fix round, issue #64/#65)
//
// Live-caught on gpinst01, Task 7 Step 4: 3/3 diagnose runs against the
// smoke specimen produced a FIRST fix_report attempt using the playbook's
// own markdown headings ("FAILURE SUMMARY") as JSON keys, because nothing
// in the prompt ever stated the actual required snake_case field names. The
// playbook itself is off limits (it is shared with the native harness's
// benchmark comparison) — this block is the custom-harness-only fix,
// single-sourced from PaFixReport.schemaText() rather than a second
// hand-written schema string.
// ===========================================================================

describe('fix_report JSON contract block', () => {
    test('the initial prompt states the fix_report schema, sourced from PaFixReport.schemaText()', () => {
        const llm = fakeLlm([{ success: true, action: { action: 'answer', text: 'done' }, raw: 'r1' }])
        const tools = fakeTools([])
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([])
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, fixReport: fixReport, playbook: 'P', now: () => 0 })

        loop.run('run1', { execution: 'e1' })

        expect(llm.calls[0]).toContain('STUB_SCHEMA_TEXT')
    })

    test('the initial prompt states the response-envelope requirement for fix_report submissions', () => {
        const llm = fakeLlm([{ success: true, action: { action: 'answer', text: 'done' }, raw: 'r1' }])
        const tools = fakeTools([])
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([])
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, fixReport: fixReport, playbook: 'P', now: () => 0 })

        loop.run('run1', { execution: 'e1' })

        expect(llm.calls[0]).toContain('{"action":"fix_report","report":')
    })

    test('every reasoning iteration carries the contract block, not just the first', () => {
        const llm = fakeLlm([
            { success: true, action: { action: 'tool_call', tool: 'agent_trace', args: {} }, raw: 'r1' },
            { success: true, action: { action: 'answer', text: 'done' }, raw: 'r2' },
        ])
        const tools = fakeTools([{ success: true, data: {} }])
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([])
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, fixReport: fixReport, playbook: 'P', now: () => 0 })

        loop.run('run1', { execution: 'e1' })

        expect(llm.calls).toHaveLength(2)
        llm.calls.forEach((prompt) => {
            expect(prompt).toContain('STUB_SCHEMA_TEXT')
        })
    })

    test('degrades gracefully (R-1) when no PaFixReport is available — never crashes the loop', () => {
        // Deliberately NO fixReport injected, and this suite's sandbox never
        // defines a global PaFixReport — the same "collaborator unavailable"
        // shape every other Phase 1b component degrades from rather than
        // throwing.
        const llm = fakeLlm([{ success: true, action: { action: 'answer', text: 'done' }, raw: 'r1' }])
        const tools = fakeTools([])
        const runs = fakeRunManager()
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, playbook: 'P', now: () => 0 })

        let res
        expect(() => {
            res = loop.run('run1', { execution: 'e1' })
        }).not.toThrow()

        expect(res.success).toBe(true)
        expect(res.outcome).toBe('answer')
    })
})

// ===========================================================================
// fix_report path
// ===========================================================================

describe('fix_report path', () => {
    test('valid report -> validated, rendered, stored, closed complete', () => {
        const normalized = { failure_summary: 'x', root_causes: [] }
        const llm = fakeLlm([{ success: true, action: { action: 'fix_report', report: { failure_summary: 'x' } }, raw: 'rf' }])
        const fixReport = fakeFixReport([{ valid: true, normalized: normalized }])
        const runs = fakeRunManager()
        const loop = load({
            llmProxy: llm,
            toolRegistry: fakeTools([]),
            runManager: runs,
            fixReport: fixReport,
            playbook: 'P',
            now: () => 0,
        })

        const res = loop.run('run1', {})

        expect(res.success).toBe(true)
        expect(res.outcome).toBe('fix_report')
        expect(res.report).toEqual(normalized)

        // RENDERED: both renderJson and renderMarkdown are called on the
        // normalized report, and their output — not a second ad-hoc
        // stringify of the raw object — is what actually gets stored and
        // surfaced.
        expect(fixReport.renderCalls.json).toEqual([normalized])
        expect(fixReport.renderCalls.markdown).toEqual([normalized])

        expect(runs.closeCalls[0].status).toBe('complete')
        expect(runs.closeCalls[0].options.fixReport).toBe('JSON(' + JSON.stringify(normalized) + ')')
        expect(res.renderedMarkdown).toBe('MARKDOWN(' + JSON.stringify(normalized) + ')')
    })

    test('invalid report -> ONE repair via repairPrompt through the proxy -> valid -> complete (and rendered)', () => {
        const normalized = { failure_summary: 'good' }
        const llm = fakeLlm([
            { success: true, action: { action: 'fix_report', report: { failure_summary: 'bad' } }, raw: 'draft1' },
            { success: true, action: { action: 'fix_report', report: { failure_summary: 'good' } }, raw: 'draft2' },
        ])
        const fixReport = fakeFixReport([
            { valid: false, problems: ['missing root_causes'] },
            { valid: true, normalized: normalized },
        ])
        const runs = fakeRunManager()
        const loop = load({
            llmProxy: llm,
            toolRegistry: fakeTools([]),
            runManager: runs,
            fixReport: fixReport,
            playbook: 'P',
            now: () => 0,
        })

        const res = loop.run('run1', {})

        expect(res.success).toBe(true)
        expect(res.outcome).toBe('fix_report')
        expect(res.report).toEqual(normalized)
        expect(llm.calls).toHaveLength(2)
        // the repair prompt (built from PaFixReport.repairPrompt) is what
        // goes through the proxy on the second call
        expect(llm.calls[1]).toContain('missing root_causes')

        // the repair path's terminal success renders too — it goes through
        // the SAME _completeFixReport as the first-try-valid path
        expect(fixReport.renderCalls.json).toEqual([normalized])
        expect(fixReport.renderCalls.markdown).toEqual([normalized])
        expect(runs.closeCalls[0].status).toBe('complete')
        expect(runs.closeCalls[0].options.fixReport).toBe('JSON(' + JSON.stringify(normalized) + ')')
        expect(res.renderedMarkdown).toBe('MARKDOWN(' + JSON.stringify(normalized) + ')')
    })

    test('invalid twice -> closed failed with the problems and the raw draft preserved', () => {
        const llm = fakeLlm([
            { success: true, action: { action: 'fix_report', report: { failure_summary: 'bad1' } }, raw: 'draft1' },
            { success: true, action: { action: 'fix_report', report: { failure_summary: 'bad2' } }, raw: 'draft2' },
        ])
        const fixReport = fakeFixReport([
            { valid: false, problems: ['missing root_causes'] },
            { valid: false, problems: ['still missing root_causes'] },
        ])
        const runs = fakeRunManager()
        const loop = load({
            llmProxy: llm,
            toolRegistry: fakeTools([]),
            runManager: runs,
            fixReport: fixReport,
            playbook: 'P',
            now: () => 0,
        })

        const res = loop.run('run1', {})

        expect(res.success).toBe(false)
        expect(res.outcome).toBe('failed')
        expect(res.problems).toEqual(['still missing root_causes'])
        expect(res.draft).toEqual({ failure_summary: 'bad2' })

        expect(runs.closeCalls[0].status).toBe('failed')
        expect(runs.closeCalls[0].options.fixReport).toEqual({ failure_summary: 'bad2' })
        expect(runs.closeCalls[0].options.error).toContain('still missing root_causes')
    })
})

// ===========================================================================
// iteration bound
// ===========================================================================

describe('iteration bound', () => {
    test('reason stub always calls tools -> exactly 15 iterations, closed complete with outcome:partial and incomplete flag', () => {
        const responses = []
        for (let i = 0; i < 20; i++) {
            responses.push({ success: true, action: { action: 'tool_call', tool: 'agent_trace', args: {} }, raw: 'r' + i })
        }
        const llm = fakeLlm(responses)
        const tools = fakeTools(() => ({ success: true, data: {} }))
        const runs = fakeRunManager()
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, playbook: 'P', now: () => 0 })

        const res = loop.run('run1', {})

        expect(res.outcome).toBe('partial')
        expect(llm.calls).toHaveLength(15)
        expect(tools.calls).toHaveLength(15)
        expect(runs.closeCalls[0].status).toBe('complete')

        const systemEntries = runs.transcript.filter((e) => e.actor === 'system')
        const flagged = systemEntries.filter((e) => String(e.result_digest).indexOf('INCOMPLETE') !== -1)
        expect(flagged.length).toBeGreaterThan(0)
    })
})

// ===========================================================================
// clock bound
// ===========================================================================

describe('clock bound', () => {
    test('injected clock passes budget after 3 iterations -> partial', () => {
        const llm = fakeLlm([
            { success: true, action: { action: 'tool_call', tool: 'agent_trace', args: {} }, raw: 'r1' },
            { success: true, action: { action: 'tool_call', tool: 'agent_trace', args: {} }, raw: 'r2' },
            { success: true, action: { action: 'tool_call', tool: 'agent_trace', args: {} }, raw: 'r3' },
        ])
        const tools = fakeTools(() => ({ success: true, data: {} }))
        const runs = fakeRunManager()
        // call#1: run() start clock. calls #2-4: bound check before iterations
        // 1-3 (still under budget). call#5: bound check before iteration 4
        // (over budget) -> partial, with exactly 3 completed iterations.
        const clock = fakeClock([0, 0, 0, 0, 400000])
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, playbook: 'P', now: clock })

        const res = loop.run('run1', {})

        expect(res.outcome).toBe('partial')
        expect(llm.calls).toHaveLength(3)
        expect(tools.calls).toHaveLength(3)
        expect(runs.closeCalls[0].status).toBe('complete')

        const systemEntries = runs.transcript.filter((e) => e.actor === 'system')
        const flagged = systemEntries.filter((e) => String(e.result_digest).indexOf('INCOMPLETE') !== -1)
        expect(flagged.length).toBeGreaterThan(0)
    })
})

// ===========================================================================
// LLM failure mid-run
// ===========================================================================

describe('LLM failure mid-run', () => {
    test('reason {success:false} -> run closed failed, error advises mode:"collect" and /status', () => {
        const llm = fakeLlm([
            { success: true, action: { action: 'tool_call', tool: 'agent_trace', args: {} }, raw: 'r1' },
            { success: false, error: 'NASK unavailable' },
        ])
        const tools = fakeTools(() => ({ success: true, data: {} }))
        const runs = fakeRunManager()
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, playbook: 'P', now: () => 0 })

        const res = loop.run('run1', {})

        expect(res.success).toBe(false)
        expect(res.outcome).toBe('failed')
        expect(res.error).toEqual(expect.stringContaining('mode: "collect"'))
        expect(res.error).toEqual(expect.stringContaining('/status'))
        expect(res.error).toEqual(expect.stringContaining('NASK unavailable'))

        expect(runs.closeCalls[0].status).toBe('failed')
        expect(runs.closeCalls[0].options.error).toEqual(expect.stringContaining('NASK unavailable'))
    })

    test('an invoke-layer failure with no raw at all still fails cleanly, never throws', () => {
        const llm = fakeLlm([{ success: false, error: 'LLM invocation failed: seam down', raw: null }])
        const tools = fakeTools([])
        const runs = fakeRunManager()
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, playbook: 'P', now: () => 0 })

        let res
        expect(() => {
            res = loop.run('run1', {})
        }).not.toThrow()
        expect(res.success).toBe(false)
        expect(res.outcome).toBe('failed')
    })
})

// ===========================================================================
// unknown tool requested
// ===========================================================================

describe('unknown tool requested', () => {
    test('dispatch error is fed back as the observation on the NEXT reasoning prompt, not a crash', () => {
        const llm = fakeLlm([
            { success: true, action: { action: 'tool_call', tool: 'nonexistent_tool', args: {} }, raw: 'r1' },
            { success: true, action: { action: 'answer', text: 'gave up' }, raw: 'r2' },
        ])
        const tools = fakeTools([
            { success: false, error: 'Unknown tool "nonexistent_tool". Available tools: agent_trace, schema_lookup.' },
        ])
        const runs = fakeRunManager()
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, playbook: 'P', now: () => 0 })

        let res
        expect(() => {
            res = loop.run('run1', {})
        }).not.toThrow()

        expect(res.outcome).toBe('answer')
        expect(llm.calls).toHaveLength(2)
        // The SECOND reasoning prompt (built from the transcript so far) must
        // carry the dispatch error text forward so the model can re-plan.
        expect(llm.calls[1]).toContain('Unknown tool')
    })
})

// ===========================================================================
// Defensive / R-9
// ===========================================================================

describe('defensive inputs', () => {
    test('a missing run id fails cleanly without touching any collaborator', () => {
        const llm = fakeLlm([])
        const tools = fakeTools([])
        const runs = fakeRunManager()
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, playbook: 'P', now: () => 0 })

        const res = loop.run('', {})

        expect(res.success).toBe(false)
        expect(res.outcome).toBe('failed')
        expect(llm.calls).toHaveLength(0)
    })
})

// ===========================================================================
// awaiting_confirmation (Phase 3) — left as a comment, not code
// ===========================================================================

describe('awaiting_confirmation branch', () => {
    test('is documented as a comment citing ADR Decision 0.5, and never appears in executable code', () => {
        const src = fs.readFileSync(SRC_PATH, 'utf8')
        expect(src).toMatch(/awaiting_confirmation/)
        expect(src).toMatch(/Decision 0\.5/)

        const code = src.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
        expect(code).not.toMatch(/awaiting_confirmation/)
    })
})

// ===========================================================================
// _renderTranscript — the observation channel rendering (issue #72)
// ===========================================================================

describe('_renderTranscript prompt_digest rendering', () => {
    test('an entry carrying prompt_digest renders it as a block, not an inline result=', () => {
        const rendered = load()._renderTranscript([
            { seq: 1, actor: 'tool', tool: 'read_artifact', args_digest: '{"id":"a1"}', result_digest: 'SHORT', prompt_digest: 'FULL PAYLOAD' },
        ])

        expect(rendered).toBe('#1 [tool:read_artifact] args={"id":"a1"}\nresult:\nFULL PAYLOAD')
        expect(rendered).not.toContain('SHORT')
    })

    test('an entry without prompt_digest renders exactly as before — inline result=', () => {
        const rendered = load()._renderTranscript([
            { seq: 1, actor: 'tool', tool: 'agent_trace', result_digest: 'SHORT' },
        ])

        expect(rendered).toBe('#1 [tool:agent_trace] result=SHORT')
    })

    test('mixed entries render each in its own form', () => {
        const rendered = load()._renderTranscript([
            { seq: 1, actor: 'llm', result_digest: 'thinking' },
            { seq: 2, actor: 'tool', tool: 'read_artifact', result_digest: 'SHORT', prompt_digest: 'BIG' },
        ])

        expect(rendered).toBe('#1 [llm] result=thinking\n#2 [tool:read_artifact]\nresult:\nBIG')
    })

    test('an empty transcript still reports the first-step message', () => {
        expect(load()._renderTranscript([])).toContain('first reasoning step')
    })
})

// ===========================================================================
// Rhino Java String request (issue #77)
//
// On the platform, `event.parm2` arrives as a Rhino java.lang.String, not a
// JS string: `typeof` on it is 'object', so the pre-#77 `_normRequest` — its
// plain-object check run FIRST — mistook it for an already-parsed request
// object and handed it back as-is, leaving every field read off it
// (`request.execution` etc.) `undefined`. `_renderRequest` then rendered the
// "(no specific target supplied ...)" fallback, and the model invented a
// placeholder sys_id and fabricated a diagnosis from nothing.
//
// `FakeJavaString` below simulates exactly that shape: `typeof` on an
// instance reports 'object' (so it satisfies `_isPlainObject`, same as the
// real Rhino value), `.toString()` (therefore `String(...)`) yields the
// original JSON/text payload, AND it exposes a `getClass()` method — the
// LiveConnect hallmark `_looksLikeJavaObject` keys off, since that is what a
// real wrapped `java.lang.String` carries and an ordinary `{...}` literal or
// `JSON.parse` result never does. A test that instead passed a real JS
// string would reproduce NOTHING: `_normRequest`'s existing
// `typeof request === 'string'` handling already covered that case
// correctly, which is exactly why the Jest suite never caught this in
// production (see the issue).
//
// The property under test is NOT "`_normRequest` returns something" — it is
// that the diagnostic target survives all the way into the rendered prompt
// handed to the LLM, since that is the artifact that was actually broken in
// production (`sys_generative_ai_log.prompt`).
// ===========================================================================

function FakeJavaString(text) {
    this._text = text
}
FakeJavaString.prototype.toString = function () {
    return this._text
}
// The LiveConnect hallmark a real wrapped java.lang.String carries and a
// plain JS object never does — see `_looksLikeJavaObject`.
FakeJavaString.prototype.getClass = function () {
    return 'java.lang.String'
}

describe('issue #77: Rhino Java String request (typeof "object", not a plain object)', () => {
    test('_normRequest parses a Java-String-shaped request into a real object, not the wrapper itself', () => {
        const loop = load()
        const request = new FakeJavaString('{"execution":"b07dc9082baa4314f243fed2ce91bf4b"}')

        const normalized = loop._normRequest(request)

        expect(normalized).toEqual({ execution: 'b07dc9082baa4314f243fed2ce91bf4b' })
    })

    test('the diagnostic target survives all the way into the rendered prompt handed to the LLM', () => {
        const llm = fakeLlm([{ success: true, action: { action: 'answer', text: 'done' }, raw: 'r1' }])
        const tools = fakeTools([])
        const runs = fakeRunManager()
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, playbook: 'PLAYBOOK', now: () => 0 })
        const request = new FakeJavaString('{"execution":"b07dc9082baa4314f243fed2ce91bf4b"}')

        loop.run('run1', request)

        expect(llm.calls).toHaveLength(1)
        expect(llm.calls[0]).toContain('execution: b07dc9082baa4314f243fed2ce91bf4b')
        expect(llm.calls[0]).not.toContain('no specific target supplied')
    })

    test('a Java-String-shaped free-form (non-JSON) description also survives into the prompt', () => {
        const llm = fakeLlm([{ success: true, action: { action: 'answer', text: 'done' }, raw: 'r1' }])
        const tools = fakeTools([])
        const runs = fakeRunManager()
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, playbook: 'PLAYBOOK', now: () => 0 })
        const request = new FakeJavaString('the widget will not load')

        loop.run('run1', request)

        expect(llm.calls[0]).toContain('description: the widget will not load')
        expect(llm.calls[0]).not.toContain('no specific target supplied')
    })
})

// ===========================================================================
// Issue #77 fix round — two defects the review found in the first pass
//
// 1. `_looksLikeJavaObject` read `.getClass` unguarded. ServiceNow's
//    sandboxed LiveConnect can THROW on member access against a restricted
//    Java object rather than returning `undefined` — precisely the shape
//    this guard exists to survive. An unguarded read would crash the whole
//    diagnostic run in exactly the case #77 was filed for.
// 2. The coercion path in the first pass ran for ANY non-plain-object,
//    non-string value, not just foreign-object-shaped ones — silently
//    changing behaviour for genuine arrays/numbers/booleans/functions
//    (previously `{}`, now a bogus `{description: ...}`, including a
//    function's own SOURCE TEXT for the function case). Both are now
//    pinned back to `{}`.
// ===========================================================================

describe('issue #77 fix round: getClass access itself throws', () => {
    test('_normRequest degrades to a plain object instead of propagating the throw', () => {
        // A double whose `getClass` accessor throws — simulating a
        // restricted LiveConnect member read, not merely an absent one.
        const hostile = {
            get getClass() {
                throw new Error('restricted LiveConnect member access')
            },
            toString: function () {
                return 'hostile toString output'
            },
        }
        const loop = load()

        expect(() => loop._normRequest(hostile)).not.toThrow()
        expect(loop._normRequest(hostile)).toEqual({ description: 'hostile toString output' })
    })

    test('the same double reaching run() still produces a normal (non-crashing) close, not a thrown error', () => {
        const hostile = {
            get getClass() {
                throw new Error('restricted LiveConnect member access')
            },
            toString: function () {
                return '{"execution":"e-hostile"}'
            },
        }
        const llm = fakeLlm([{ success: true, action: { action: 'answer', text: 'done' }, raw: 'r1' }])
        const tools = fakeTools([])
        const runs = fakeRunManager()
        const loop = load({ llmProxy: llm, toolRegistry: tools, runManager: runs, playbook: 'PLAYBOOK', now: () => 0 })

        expect(() => loop.run('run1', hostile)).not.toThrow()
        expect(llm.calls[0]).toContain('execution: e-hostile')
    })
})

describe('issue #77 fix round: non-string, non-plain-object inputs stay {} (never coerced to a description)', () => {
    test('a real array normalizes to {}, not a coerced description', () => {
        expect(load()._normRequest([1, 2, 3])).toEqual({})
    })

    test('a real number normalizes to {}, not a coerced description', () => {
        expect(load()._normRequest(42)).toEqual({})
    })

    test('a real boolean normalizes to {}, not a coerced description', () => {
        expect(load()._normRequest(true)).toEqual({})
    })

    test('a real function normalizes to {} — its source text must never reach a prompt', () => {
        const fn = function shouldNeverAppearInAPrompt() {
            return 'source text leak check'
        }

        expect(load()._normRequest(fn)).toEqual({})
    })
})

// ===========================================================================
// #79 — the audit context handed to PaFixReport.validate
// ===========================================================================

describe('audit context plumbing', () => {
    test('passes the invoked tools from the audit trail into validate', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: { ok: 1 } }])
        const audit = fakeAuditLogger({ available: true, tools: ['agent_trace', 'agent_config'] })

        const loop = load({ runManager: runs, fixReport: fixReport, auditLogger: audit })
        loop._handleFixReport('run1', { failure_summary: 'x' })

        expect(fixReport.contextCalls[0].auditAvailable).toBe(true)
        expect(fixReport.contextCalls[0].invokedTools).toEqual(['agent_trace', 'agent_config'])
        expect(audit.calls).toEqual(['run1'])
    })

    test('queries the trail ONCE and reuses the same context across the repair turn', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([
            { valid: false, problems: ['unsupported citation — cites "config"'] },
            { valid: true, normalized: { ok: 2 } },
        ])
        const audit = fakeAuditLogger({ available: true, tools: ['agent_trace'] })
        const llm = fakeLlm([
            {
                success: true,
                action: { action: 'fix_report', report: { failure_summary: 'repaired' } },
                raw: 'r1',
                retried: false,
            },
        ])

        const loop = load({ runManager: runs, fixReport: fixReport, auditLogger: audit, llmProxy: llm })
        loop._handleFixReport('run1', { failure_summary: 'x' })

        expect(audit.calls.length).toBe(1)
        expect(fixReport.contextCalls.length).toBe(2)
        // The SAME object, not merely an equal one — proves it was not re-queried.
        expect(fixReport.contextCalls[1]).toBe(fixReport.contextCalls[0])
    })

    test('a degraded trail disables the checks AND is recorded in the transcript', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: { ok: 1 } }])
        const audit = fakeAuditLogger({ available: false, degraded: 'no_audit_rows', tools: [] })

        const loop = load({ runManager: runs, fixReport: fixReport, auditLogger: audit })
        loop._handleFixReport('run1', { failure_summary: 'x' })

        expect(fixReport.contextCalls[0].auditAvailable).toBe(false)

        const notes = runs.transcript.filter(
            (e) => String(e.result_digest).indexOf('audit trail unavailable') !== -1
        )
        expect(notes.length).toBe(1)
        expect(notes[0].result_digest.indexOf('no_audit_rows')).not.toBe(-1)
    })

    test('an audit logger that throws degrades the CHECK, never the diagnosis', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: { ok: 1 } }])
        const audit = fakeAuditLogger(new Error('boom'))

        const loop = load({ runManager: runs, fixReport: fixReport, auditLogger: audit })

        expect(() => loop._handleFixReport('run1', { failure_summary: 'x' })).not.toThrow()
        expect(fixReport.contextCalls[0].auditAvailable).toBe(false)
        expect(fixReport.contextCalls[0].invokedTools).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// The effort floor on the inconclusive path (issue #88).
//
// WHAT THIS EXISTS TO STOP, measured rather than imagined.
//
// The v4 smoke (benchmark/raw-evidence-v4-smoke.md, DECISION.md §J) fired four
// runs on 2026.08.0222. All four invoked exactly ONE tool, agent_trace, and
// stopped — with 2 LLM turns used of 15 and 10-17 seconds of a 300,000ms
// budget. They were not confused about the next step. TR1000107's report named
// agent_config, schema_lookup and genai_log as what it needed, and gave "No
// agent_config call made to inspect instructions" as its reason for six of
// seven layers. Then it filed the report and the loop stamped it valid.
//
// PaFixReport._checkInconclusive prices the inconclusive path at one
// evidence_read citation per layer claimed SWEPT. That defeats sweep
// INFLATION and demonstrably works. But the cost rises monotonically with
// sweeps and has NO FLOOR, so its minimum sits at one sweep and two citations
// — and the model sits on that minimum. Honest surrender became the cheapest
// structurally valid output.
//
// The floor is a LOOP CONTINUATION, not a validation rejection, and that is
// load-bearing: #81 established that the repair turn cannot gather evidence,
// so rejecting the report would convert surrender into FAILURE rather than
// into depth. Here the run simply keeps going and ends in a real report.
//
// Fires at most ONCE per run, mirroring the existing one-repair-turn policy.
// ---------------------------------------------------------------------------
describe('effort floor on the inconclusive path (#88)', () => {
    /** A fix-less inconclusive report — the exact shape all four v4 runs filed. */
    function inconclusive(needed, layers) {
        return {
            failure_summary: 'The execution completed with no errors.',
            layers_swept: layers || {
                1: { status: 'SWEPT', reason: 'agent_trace provided execution details' },
                2: { status: 'NOT_SWEPT', reason: 'no configuration issues observed' },
            },
            root_causes: [],
            fixes: [],
            verification: '',
            data_markers: [],
            inconclusive: {
                evidence_read: [{ source: 'trace', detail: 'agent_trace output' }],
                needed_to_conclude: needed,
            },
        }
    }

    function fixReportAction(report) {
        return { success: true, raw: 'raw', action: { action: 'fix_report', report: report } }
    }

    const toolCallAction = {
        success: true,
        raw: 'raw',
        action: { action: 'tool_call', tool: 'agent_config', args: { agent: 'Seed 03 Category Router' } },
    }

    function systemNotes(runs) {
        return runs.transcript.filter((e) => e.actor === 'system').map((e) => e.result_digest)
    }

    // -- fires ---------------------------------------------------------------

    it('keeps looping when the report names a registered tool the run never called', () => {
        const runs = fakeRunManager()
        const tools = fakeTools([{ success: true, data: { ok: true } }])
        const fixReport = fakeFixReport([{ valid: true, normalized: { ok: true } }])
        const llm = fakeLlm([
            // turn 1: surrender, naming three tools it never called (TR1000107)
            fixReportAction(
                inconclusive('Further inspection of agent configuration, data schemas, and GenAI stack via agent_config, schema_lookup, and genai_log tools')
            ),
            // turn 2: after the push-back, it goes and gets one
            toolCallAction,
            // turn 3: files a real report
            fixReportAction(inconclusive('nothing further')),
        ])
        const audit = fakeAuditLogger({ available: true, tools: ['agent_trace'] })

        const out = load({
            llmProxy: llm,
            toolRegistry: tools,
            runManager: runs,
            fixReport: fixReport,
            auditLogger: audit,
            playbook: 'P',
            now: () => 0,
        }).run('run1', {})

        expect(out.outcome).toBe('fix_report')
        // The whole point: a second tool call happened that would not have.
        expect(tools.calls.map((c) => c.name)).toEqual(['agent_config'])
        // The first report was never validated — it was not rejected, it was
        // deferred. Only the second one reached the validator.
        expect(fixReport.calls).toHaveLength(1)
    })

    it('names the specific uninvoked tools in the transcript, not a generic scolding', () => {
        const runs = fakeRunManager()
        const llm = fakeLlm([
            fixReportAction(inconclusive('would need agent_config and genai_log')),
            toolCallAction,
            fixReportAction(inconclusive('done')),
        ])

        load({
            llmProxy: llm,
            toolRegistry: fakeTools([{ success: true, data: {} }]),
            runManager: runs,
            fixReport: fakeFixReport([{ valid: true, normalized: {} }]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            playbook: 'P',
            now: () => 0,
        }).run('run1', {})

        const note = systemNotes(runs).join(' ')
        expect(note).toContain('agent_config')
        expect(note).toContain('genai_log')
        // A tool it did NOT name must not be invented into the nudge.
        expect(note).not.toContain('query_table')
        // and the nudge has to reach the model, not just the audit log
        expect(llm.calls[1]).toContain('agent_config')
    })

    it('counts a tool named only in a NOT_SWEPT reason', () => {
        const runs = fakeRunManager()
        const llm = fakeLlm([
            // needed_to_conclude names nothing; the layer reasons do — this is
            // TR1000107's actual shape for layers 2-7.
            fixReportAction(
                inconclusive('further investigation', {
                    1: { status: 'SWEPT', reason: 'agent_trace provided execution details' },
                    4: { status: 'NOT_SWEPT', reason: 'No schema_lookup call made to validate data schemas' },
                })
            ),
            toolCallAction,
            fixReportAction(inconclusive('done')),
        ])

        const tools = fakeTools([{ success: true, data: {} }])
        load({
            llmProxy: llm,
            toolRegistry: tools,
            runManager: runs,
            fixReport: fakeFixReport([{ valid: true, normalized: {} }]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            playbook: 'P',
            now: () => 0,
        }).run('run1', {})

        expect(tools.calls).toHaveLength(1)
        expect(systemNotes(runs).join(' ')).toContain('schema_lookup')
    })

    // -- does not fire -------------------------------------------------------

    it('accepts a report that names no tool at all — vagueness is not convicted', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: {} }])
        const llm = fakeLlm([fixReportAction(inconclusive('No failure state detected in execution trace'))])

        const out = load({
            llmProxy: llm,
            toolRegistry: fakeTools([]),
            runManager: runs,
            fixReport: fixReport,
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            playbook: 'P',
            now: () => 0,
        }).run('run1', {})

        expect(out.outcome).toBe('fix_report')
        expect(fixReport.calls).toHaveLength(1)
    })

    it('accepts when every tool the report names was actually invoked', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: {} }])
        const llm = fakeLlm([fixReportAction(inconclusive('agent_config showed nothing conclusive'))])

        const out = load({
            llmProxy: llm,
            toolRegistry: fakeTools([]),
            runManager: runs,
            fixReport: fixReport,
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace', 'agent_config'] }),
            playbook: 'P',
            now: () => 0,
        }).run('run1', {})

        expect(out.outcome).toBe('fix_report')
        expect(fixReport.calls).toHaveLength(1)
    })

    it('leaves a report that names a root cause alone — this is not the inconclusive path', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: {} }])
        const withCause = inconclusive('would also want agent_config')
        withCause.root_causes = [{ layer: 1, statement: 'the script threw' }]
        const llm = fakeLlm([fixReportAction(withCause)])

        const out = load({
            llmProxy: llm,
            toolRegistry: fakeTools([]),
            runManager: runs,
            fixReport: fixReport,
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            playbook: 'P',
            now: () => 0,
        }).run('run1', {})

        expect(out.outcome).toBe('fix_report')
        expect(fixReport.calls).toHaveLength(1)
    })

    it('leaves a report that proposes fixes alone', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: {} }])
        const withFixes = inconclusive('would also want agent_config')
        withFixes.fixes = [{ target: 'x', change: 'y' }]
        const llm = fakeLlm([fixReportAction(withFixes)])

        const out = load({
            llmProxy: llm,
            toolRegistry: fakeTools([]),
            runManager: runs,
            fixReport: fixReport,
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            playbook: 'P',
            now: () => 0,
        }).run('run1', {})

        expect(out.outcome).toBe('fix_report')
        expect(fixReport.calls).toHaveLength(1)
    })

    it('does not fire when the audit trail is unavailable — cannot tell is not did not call', () => {
        // Same reasoning as _auditContext's degrade: an unreadable audit trail
        // says nothing about which tools ran, and pushing back on a guess
        // would burn a turn for nothing.
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: {} }])
        const llm = fakeLlm([fixReportAction(inconclusive('would need agent_config'))])

        const out = load({
            llmProxy: llm,
            toolRegistry: fakeTools([]),
            runManager: runs,
            fixReport: fixReport,
            auditLogger: fakeAuditLogger({ available: false, degraded: 'no_audit_rows', tools: [] }),
            playbook: 'P',
            now: () => 0,
        }).run('run1', {})

        expect(out.outcome).toBe('fix_report')
        expect(fixReport.calls).toHaveLength(1)
    })

    // -- bounded -------------------------------------------------------------

    it('fires at most once — a second surrender is accepted', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: {} }])
        const llm = fakeLlm([
            fixReportAction(inconclusive('would need agent_config')),
            // pushed back, and surrenders again naming the same tool
            fixReportAction(inconclusive('still would need agent_config')),
        ])

        const out = load({
            llmProxy: llm,
            toolRegistry: fakeTools([]),
            runManager: runs,
            fixReport: fixReport,
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            playbook: 'P',
            now: () => 0,
        }).run('run1', {})

        expect(out.outcome).toBe('fix_report')
        expect(llm.calls).toHaveLength(2)
        expect(fixReport.calls).toHaveLength(1)
    })

    it('does not fire without headroom to spend — a report beats a partial', () => {
        // Pushing back with one iteration left converts a usable honest report
        // into `partial` with no report at all, which is strictly worse than
        // the surrender the floor exists to discourage.
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: {} }])
        const llm = fakeLlm([fixReportAction(inconclusive('would need agent_config'))])

        const out = load({
            llmProxy: llm,
            toolRegistry: fakeTools([]),
            runManager: runs,
            fixReport: fixReport,
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            playbook: 'P',
            now: () => 0,
            maxIterations: 1,
        }).run('run1', {})

        expect(out.outcome).toBe('fix_report')
        expect(fixReport.calls).toHaveLength(1)
    })

    it('does not fire when the time budget is nearly spent', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: {} }])
        const llm = fakeLlm([fixReportAction(inconclusive('would need agent_config'))])
        // start at 0, and by the time the report lands 95% of the budget is gone
        const clock = fakeClock([0, 9500, 9500, 9500, 9500])

        const out = load({
            llmProxy: llm,
            toolRegistry: fakeTools([]),
            runManager: runs,
            fixReport: fixReport,
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            playbook: 'P',
            now: clock,
            budgetMs: 10000,
        }).run('run1', {})

        expect(out.outcome).toBe('fix_report')
        expect(fixReport.calls).toHaveLength(1)
    })

    it('degrades to accepting when the injected fixReport has no predicate (R-9)', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: {} }])
        delete fixReport.isFixlessInconclusive
        const llm = fakeLlm([fixReportAction(inconclusive('would need agent_config'))])

        const out = load({
            llmProxy: llm,
            toolRegistry: fakeTools([]),
            runManager: runs,
            fixReport: fixReport,
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            playbook: 'P',
            now: () => 0,
        }).run('run1', {})

        expect(out.outcome).toBe('fix_report')
    })
})

// ---------------------------------------------------------------------------
// The effort floor must SAY what it decided (#88, found in live verification).
//
// The first deployed build declined to fire on a real gpinst01 run (TR1000109)
// and left nothing behind explaining why. The report's own text was truncated
// in the stored transcript, so the decision was unrecoverable after the fact
// and the guard that declined could not be identified from the record.
//
// That is the same shape as every defect this project has spent itself on: a
// silent decline is indistinguishable from a decision never taken. The floor
// now records its reasoning on the surrender path — fired or not — for the
// same reason `evidence_basis`, `field_warnings` and the INCOMPLETE bound
// marker exist.
//
// It stays quiet on reports that are not surrenders; a note on every ordinary
// report would be noise, and noise is what makes a real signal unreadable.
// ---------------------------------------------------------------------------
describe('effort floor states its decision (#88)', () => {
    function inconclusive(needed) {
        return {
            failure_summary: 's',
            layers_swept: { 1: { status: 'SWEPT', reason: 'agent_trace provided execution details' } },
            root_causes: [],
            fixes: [],
            verification: '',
            data_markers: [],
            inconclusive: { evidence_read: [{ source: 'trace', detail: 'd' }], needed_to_conclude: needed },
        }
    }

    function fixReportAction(report) {
        return { success: true, raw: 'raw', action: { action: 'fix_report', report: report } }
    }

    function floorNotes(runs) {
        return runs.transcript
            .filter((e) => e.actor === 'system')
            .map((e) => e.result_digest)
            .filter((d) => d.indexOf('EFFORT FLOOR') !== -1)
    }

    function runWith(opts) {
        const runs = fakeRunManager()
        const audit = fakeAuditLogger(
            opts.audit || { available: true, tools: ['agent_trace'] }
        )
        load({
            llmProxy: fakeLlm(opts.responses),
            toolRegistry: fakeTools([{ success: true, data: {} }]),
            runManager: runs,
            fixReport: fakeFixReport([{ valid: true, normalized: {} }, { valid: true, normalized: {} }]),
            auditLogger: audit,
            playbook: 'P',
            now: opts.now || (() => 0),
            maxIterations: opts.maxIterations,
        }).run('run1', {})
        return { runs: runs, audit: audit }
    }

    it('records why it stood down when the report names no uninvoked tool', () => {
        const { runs } = runWith({ responses: [fixReportAction(inconclusive('nothing specific'))] })
        const notes = floorNotes(runs)

        expect(notes).toHaveLength(1)
        expect(notes[0]).toMatch(/names no registered tool/i)
    })

    it('records why it stood down when it has already fired once', () => {
        const { runs } = runWith({
            responses: [
                fixReportAction(inconclusive('need agent_config')),
                fixReportAction(inconclusive('still need agent_config')),
            ],
        })
        const notes = floorNotes(runs)

        // one FIRED note, then one STOOD DOWN note naming the cap
        expect(notes).toHaveLength(2)
        expect(notes[1]).toMatch(/already fired/i)
    })

    it('records why it stood down when the audit trail is unreadable', () => {
        const { runs } = runWith({
            responses: [fixReportAction(inconclusive('need agent_config'))],
            audit: { available: false, degraded: 'no_audit_rows', tools: [] },
        })
        expect(floorNotes(runs)[0]).toMatch(/audit trail/i)
    })

    it('records why it stood down when there is no headroom', () => {
        const { runs } = runWith({
            responses: [fixReportAction(inconclusive('need agent_config'))],
            maxIterations: 1,
        })
        expect(floorNotes(runs)[0]).toMatch(/iteration/i)
    })

    it('says nothing at all on a report that is not a surrender', () => {
        const withCause = inconclusive('need agent_config')
        withCause.root_causes = [{ layer: 1, statement: 'the script threw' }]
        const { runs } = runWith({ responses: [fixReportAction(withCause)] })

        expect(floorNotes(runs)).toHaveLength(0)
    })

    it('resolves the audit trail once per fix-report, not once per consumer', () => {
        // _auditContext's own docstring: a repair turn makes no tool calls, so
        // a second query returns the same set at twice the cost. The floor
        // must not quietly reintroduce the double read it was warned about.
        const { audit } = runWith({ responses: [fixReportAction(inconclusive('need agent_config'))] })
        expect(audit.calls).toHaveLength(1)
    })
})
