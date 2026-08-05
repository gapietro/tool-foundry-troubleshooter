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

function fakeFixReport(validateResults, gaps, declared) {
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
        // Depth gate (#103). Gap DERIVATION is PaFixReport's own concern and
        // is tested in test/PaFixReport.test.js; these loop tests inject the
        // resulting list directly so they exercise gate logic only.
        unsweptGaps: function () {
            return gaps === undefined ? [] : gaps
        },
        // Directed depth gate (#109). The loop ranks gaps by fan-out and
        // gives the model's own `would_confirm` layer precedence; both come
        // from PaFixReport so the layer map stays single-sourced. These
        // mirror the REAL values of `PaFixReport.toolFanOut()` — a fake that
        // invented its own numbers would test the ranking against a map the
        // product does not have.
        toolFanOut: function () {
            return {
                agent_trace: 1,
                genai_log: 2,
                log_analysis: 3,
                agent_config: 3,
                schema_lookup: 1,
                query_table: 1,
            }
        },
        declaredLayers: function () {
            return declared === undefined ? [] : declared
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

    test('a genuinely degraded trail disables the checks AND records "unavailable" in the transcript', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: { ok: 1 } }])
        const audit = fakeAuditLogger({ available: false, degraded: 'glide_unavailable', tools: [] })

        const loop = load({ runManager: runs, fixReport: fixReport, auditLogger: audit })
        loop._handleFixReport('run1', { failure_summary: 'x' })

        expect(fixReport.contextCalls[0].auditAvailable).toBe(false)

        const notes = runs.transcript.filter(
            (e) => String(e.result_digest).indexOf('audit trail unavailable') !== -1
        )
        expect(notes.length).toBe(1)
        expect(notes[0].result_digest.indexOf('glide_unavailable')).not.toBe(-1)
    })

    // M1 (final whole-branch review): `no_audit_rows` means the trail WAS
    // readable — it answered "zero tools invoked" — so the old wording
    // ("audit trail unavailable") misrepresented a successful query as a
    // failed one. Only the citation/sweep cross-checks were skipped, and
    // only because there is nothing yet to cite.
    test('M1: no_audit_rows records the trail as READABLE with zero invoked tools, not "unavailable"', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: { ok: 1 } }])
        const audit = fakeAuditLogger({ available: false, degraded: 'no_audit_rows', tools: [] })

        const loop = load({ runManager: runs, fixReport: fixReport, auditLogger: audit })
        loop._handleFixReport('run1', { failure_summary: 'x' })

        expect(fixReport.contextCalls[0].auditAvailable).toBe(false)

        const notes = runs.transcript.filter((e) => String(e.result_digest).indexOf('no_audit_rows') !== -1)
        expect(notes.length).toBe(1)
        expect(notes[0].result_digest).toContain('readable')
        expect(notes[0].result_digest).toContain('zero tools')
        expect(notes[0].result_digest).not.toContain('unavailable')
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

// ===========================================================================
// depth gate (#103) — _trailTools
// ===========================================================================

describe('depth gate (#103) — _trailTools', () => {
    test('an available trail is readable and carries its tools', () => {
        const loop = load({ auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }) })
        expect(loop._trailTools('RUN1')).toEqual({ readable: true, tools: ['agent_trace'], degraded: '' })
    })

    test('no_audit_rows is READABLE with zero tools — the trail answered', () => {
        const loop = load({ auditLogger: fakeAuditLogger({ available: false, degraded: 'no_audit_rows', tools: [] }) })
        expect(loop._trailTools('RUN1')).toEqual({ readable: true, tools: [], degraded: 'no_audit_rows' })
    })

    test.each(['glide_unavailable', 'query_failed', 'no_run_id'])(
        'a genuine degradation (%s) is NOT readable',
        (reason) => {
            const loop = load({ auditLogger: fakeAuditLogger({ available: false, degraded: reason, tools: [] }) })
            expect(loop._trailTools('RUN1')).toEqual({ readable: false, tools: [], degraded: reason })
        }
    )

    test('a throwing audit logger degrades rather than propagating (R-1)', () => {
        const loop = load({ auditLogger: fakeAuditLogger(new Error('boom')) })
        expect(loop._trailTools('RUN1')).toEqual({ readable: false, tools: [], degraded: 'query_failed' })
    })

    test('a null result degrades', () => {
        const loop = load({ auditLogger: fakeAuditLogger(null) })
        expect(loop._trailTools('RUN1')).toEqual({ readable: false, tools: [], degraded: 'query_failed' })
    })

    // -----------------------------------------------------------------------
    // T2 — two cheap contract-boundary cases
    // -----------------------------------------------------------------------

    test('T2: available:false with degraded absent entirely degrades to not-readable', () => {
        const loop = load({ auditLogger: fakeAuditLogger({ available: false }) })
        expect(loop._trailTools('RUN1')).toEqual({ readable: false, tools: [], degraded: 'query_failed' })
    })

    test('T2: a non-array tools on an available:true result degrades tools to [] (the _isArray guard)', () => {
        const loop = load({ auditLogger: fakeAuditLogger({ available: true, tools: 'not-an-array' }) })
        expect(loop._trailTools('RUN1')).toEqual({ readable: true, tools: [], degraded: '' })
    })
})

describe('depth gate (#103) — _depthGate', () => {
    const GAP2 = { layer: 2, name: 'Instructions', reason: 'r2', tools: ['agent_config'] }
    const GAP4 = { layer: 4, name: 'Data schemas', reason: 'r4', tools: ['schema_lookup'] }
    const GAP5 = { layer: 5, name: 'Data', reason: 'r5', tools: ['query_table', 'log_analysis'] }
    const FIX = { action: 'fix_report', report: { layers_swept: {} } }

    function gateLoop(tools, degraded, gaps) {
        const result =
            degraded === undefined
                ? { available: true, tools: tools }
                : { available: false, degraded: degraded, tools: [] }
        return load({
            auditLogger: fakeAuditLogger(result),
            fixReport: fakeFixReport([], gaps === undefined ? [GAP2, GAP4] : gaps),
        })
    }

    test('holds when the draft declares a gap the trail shows was never closed', () => {
        const gate = gateLoop(['agent_trace'])._depthGate('RUN1', FIX)
        expect(gate.hold).toBe(true)
        expect(gate.kind).toBe('gaps')
        expect(gate.gaps.map((g) => g.layer)).toEqual([2, 4])
    })

    test('allows when every declared gap has already been closed', () => {
        const loop = gateLoop(['agent_trace', 'agent_config', 'schema_lookup'])
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('holds on the SUBSET still open when only some gaps are closed', () => {
        const gate = gateLoop(['agent_trace', 'agent_config'])._depthGate('RUN1', FIX)
        expect(gate.hold).toBe(true)
        expect(gate.gaps.map((g) => g.layer)).toEqual([4])
    })

    test('allows when the draft declares no gap at all', () => {
        expect(gateLoop(['agent_trace'], undefined, [])._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('HOLDS on no_audit_rows — zero tool calls is the strongest gap', () => {
        expect(gateLoop([], 'no_audit_rows')._depthGate('RUN1', FIX).hold).toBe(true)
    })

    test.each(['glide_unavailable', 'query_failed', 'no_run_id'])('allows on a degraded trail (%s)', (reason) => {
        expect(gateLoop([], reason)._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('an answer action is held while the gate is unreleased', () => {
        const gate = gateLoop(['agent_trace'])._depthGate('RUN1', { action: 'answer', text: 'done' })
        expect(gate.hold).toBe(true)
        expect(gate.kind).toBe('no_layer_report')
    })

    test('a throwing unsweptGaps degrades to allow rather than trapping the run (R-9)', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: {
                unsweptGaps: function () {
                    throw new Error('boom')
                },
            },
        })
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('STICKY: the recorded gap set releases the gate, and later gaps do not re-hold', () => {
        let invoked = ['agent_trace']
        let gaps = [GAP2, GAP4]
        const loop = load({
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: invoked.slice() }
                },
            },
            fixReport: {
                unsweptGaps: function () {
                    return gaps
                },
                toolFanOut: function () {
                    return {
                        agent_trace: 1,
                        genai_log: 2,
                        log_analysis: 3,
                        agent_config: 3,
                        schema_lookup: 1,
                        query_table: 1,
                    }
                },
                declaredLayers: function () {
                    return []
                },
            },
        })

        // First evaluation records layers {2,4}. Under #109 the TARGET is
        // layer 4 — `schema_lookup` closes nothing else, while `agent_config`
        // also closes layers 3 and 7 — so the recorded set is
        // {schema_lookup}, not the union.
        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        // Closing layer 2 no longer releases: that is the #103 tilt (§P7,
        // six of six releases) which #109 exists to remove.
        invoked = ['agent_trace', 'agent_config']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        // The target's own tool releases it.
        invoked = ['agent_trace', 'agent_config', 'schema_lookup']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)

        // A later draft naming a brand-new gap must NOT re-hold: the gate
        // buys ONE forced beat, it does not chase a full sweep.
        gaps = [GAP5]
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('STICKY: re-emitting a terminal action without acting holds against the SAME set', () => {
        let gaps = [GAP2, GAP4]
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: {
                unsweptGaps: function () {
                    return gaps
                },
            },
        })
        const first = loop._depthGate('RUN1', FIX)
        // A second, narrower draft must still be judged on the original set.
        gaps = [GAP5]
        const second = loop._depthGate('RUN1', FIX)
        expect(second.hold).toBe(true)
        expect(second.gaps.map((g) => g.layer)).toEqual(first.gaps.map((g) => g.layer))
    })

    // -----------------------------------------------------------------------
    // Fix round 1 finding: a malformed gap element (not a plain object, or a
    // non-array `tools`) must degrade `_openGaps`/`_unionTools`, never throw
    // inside `_depthGate` (R-9). Contract-guarded upstream by Task 1's
    // `unsweptGaps()` shape, but the loop must not trust that blindly.
    // -----------------------------------------------------------------------

    test('a null entry in the gaps array is skipped, not treated as an open gap', () => {
        const loop = gateLoop(['agent_trace'], undefined, [null, GAP4])

        let gate
        expect(() => {
            gate = loop._depthGate('RUN1', FIX)
        }).not.toThrow()

        expect(gate.hold).toBe(true)
        expect(gate.kind).toBe('gaps')
        expect(gate.gaps).toEqual([GAP4])
    })

    test('a gap element with a missing or non-array tools field is skipped, not treated as an open gap', () => {
        const missingTools = { layer: 3, name: 'Tool definitions', reason: 'r3' }
        const nonArrayTools = { layer: 6, name: 'GenAI stack', reason: 'r6', tools: 'not-an-array' }
        const loop = gateLoop(['agent_trace'], undefined, [missingTools, nonArrayTools, GAP4])

        let gate
        expect(() => {
            gate = loop._depthGate('RUN1', FIX)
        }).not.toThrow()

        expect(gate.hold).toBe(true)
        expect(gate.kind).toBe('gaps')
        expect(gate.gaps).toEqual([GAP4])
    })

    test('a malformed element contributes no tools to the recorded (sticky) union', () => {
        // Only GAP4's tool ('schema_lookup') should be able to release the
        // gate — a malformed entry must not leak any tool into `_heldTools`.
        let invoked = ['agent_trace']
        const loop = load({
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: invoked.slice() }
                },
            },
            fixReport: fakeFixReport([], [null, { layer: 3, tools: 'nope' }, GAP4]),
        })

        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        // Invoking a tool that is NOT schema_lookup must not release the
        // gate, even though it is what a malformed entry (had it been
        // honored) might have named.
        invoked = ['agent_trace', 'agent_config']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        // Only the well-formed gap's tool actually releases it.
        invoked = ['agent_trace', 'agent_config', 'schema_lookup']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })
})

// ===========================================================================
// directed depth gate (#109) — target selection
//
// #103 recorded the UNION of every open gap's tools as the release set, so
// one `agent_config` call (layers 2, 3 and 7) discharged the layer-4 and
// layer-5 gaps having touched neither — DECISION.md §P2/§P7, measured 6 of 6.
// The gate now picks ONE target gap and records only its DEDICATED tools.
// Cost is unchanged: still exactly one forced beat.
// ===========================================================================

describe('directed depth gate (#109) — target selection', () => {
    const GAP2 = { layer: 2, name: 'Instructions', reason: 'r2', tools: ['agent_config'] }
    const GAP4 = { layer: 4, name: 'Data schemas', reason: 'r4', tools: ['schema_lookup'] }
    const GAP5 = { layer: 5, name: 'Data', reason: 'r5', tools: ['query_table', 'log_analysis'] }
    const GAP6 = { layer: 6, name: 'GenAI stack', reason: 'r6', tools: ['genai_log', 'log_analysis'] }
    const FIX = { action: 'fix_report', report: { layers_swept: {} } }

    function gateLoop(invoked, gaps, declared) {
        return load({
            auditLogger: fakeAuditLogger({ available: true, tools: invoked }),
            fixReport: fakeFixReport([], gaps, declared),
        })
    }

    test('RANKED: the gap with the most dedicated tool wins over a shared-tool gap', () => {
        const gate = gateLoop(['agent_trace'], [GAP2, GAP4])._depthGate('RUN1', FIX)
        expect(gate.hold).toBe(true)
        expect(gate.target.layer).toBe(4)
        expect(gate.target.source).toBe('ranked')
        expect(gate.target.tools).toEqual(['schema_lookup'])
    })

    test('RANKED: ties break on the lowest layer number', () => {
        // Layers 4 and 5 both have a fan-out-1 tool. `open` is passed
        // UNSORTED (layer 5 before layer 4) so this only passes if the
        // tie-break is an explicit layer comparison — a bare
        // strictly-less-than-on-score loop would pick whichever of the two
        // came first in `open`, which here is the WRONG one.
        const gate = gateLoop(['agent_trace'], [GAP5, GAP4])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(4)
    })

    test('RANKED: a fan-out-2 gap outranks a fan-out-3 gap', () => {
        const gate = gateLoop(['agent_trace'], [GAP2, GAP6])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(6)
        expect(gate.target.tools).toEqual(['genai_log'])
    })

    test('NARROWED: a shared tool is dropped from the target gap release set', () => {
        // layer 5 is reachable by query_table (fan-out 1) and log_analysis
        // (fan-out 3, shared with layers 1 and 6). Only the dedicated one is
        // recorded — a log_analysis call must not close a data gap without
        // touching data.
        const gate = gateLoop(['agent_trace'], [GAP5])._depthGate('RUN1', FIX)
        expect(gate.target.tools).toEqual(['query_table'])
    })

    test('NARROWED: the shared tool does NOT release the hold', () => {
        let invoked = ['agent_trace']
        const loop = load({
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: invoked.slice() }
                },
            },
            fixReport: fakeFixReport([], [GAP5]),
        })

        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        invoked = ['agent_trace', 'log_analysis']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        invoked = ['agent_trace', 'log_analysis', 'query_table']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('THE #103 TILT IS CLOSED: agent_config no longer discharges a layer-4 gap', () => {
        let invoked = ['agent_trace']
        const loop = load({
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: invoked.slice() }
                },
            },
            fixReport: fakeFixReport([], [GAP2, GAP4]),
        })

        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        // §P2's measured behaviour: all six v5 runs released on exactly this.
        invoked = ['agent_trace', 'agent_config']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        invoked = ['agent_trace', 'agent_config', 'schema_lookup']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('CAPPED (#116): would_confirm naming an above-floor layer no longer wins', () => {
        // The v6 defect in miniature. Layer 2's only tool (agent_config) has
        // fan-out 3; layer 4's schema_lookup has fan-out 1. The model named
        // layer 2, and under #109 that selected layer 2 outright — letting the
        // model choose its own cheap compliance through text it authors. The
        // floor rule makes the named layer a candidate only when it is AT the
        // floor, so structure decides here.
        const gate = gateLoop(['agent_trace'], [GAP2, GAP4], [2])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(4)
        expect(gate.target.source).toBe('ranked')
        expect(gate.target.tools).toEqual(['schema_lookup'])
    })

    test('CAPPED (#116): an unscorable named gap no longer blocks the ranked path', () => {
        // `matched` used to be set by ANY named open gap, scorable or not, so a
        // gap whose tools are absent from the fan-out map forced the undirected
        // union hold — narrow enforcement behind wording that directs at no
        // layer. An unscorable gap is not in the floor class, so ranked runs.
        const GAP_UNKNOWN = { layer: 3, name: 'Tool definitions', reason: 'r3', tools: ['no_such_tool'] }
        const gate = gateLoop(['agent_trace'], [GAP_UNKNOWN, GAP4], [3])._depthGate('RUN1', FIX)
        expect(gate.target).not.toBe(null)
        expect(gate.target.layer).toBe(4)
        expect(gate.target.source).toBe('ranked')
    })

    test('CAPPED (#116): a named layer AT the floor still wins, and is still sourced declared', () => {
        // Direction survives the cap: layers 4 and 5 both sit at fan-out 1, so
        // the model's naming of layer 5 decides between equals even though the
        // ranked tie-break alone would take layer 4.
        const gate = gateLoop(['agent_trace'], [GAP4, GAP5], [5])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(5)
        expect(gate.target.source).toBe('declared')
        expect(gate.target.tools).toEqual(['query_table'])
    })

    test('CAPPED (#116): when every open gap is cheap, the cap does nothing', () => {
        // Floor 3, and the model named a floor member. There is no better layer
        // to insist on, so declared stands.
        const GAP3 = { layer: 3, name: 'Tool definitions', reason: 'r3', tools: ['agent_config'] }
        const gate = gateLoop(['agent_trace'], [GAP2, GAP3], [3])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(3)
        expect(gate.target.source).toBe('declared')
        expect(gate.target.fanOut).toBe(3)
    })

    test('#116 REGRESSION on verbatim v6 data: both seed-04 holds flip to layer 4', () => {
        // The gap sets and the declared layer are read from the verbatim
        // _holdNote strings in x_snc_troubleshoot_run on gpinst01:
        //   TR1000152 "layer 3 (declared) must be reached; layer(s) 2, 3, 4, 5, 7 ..."
        //   TR1000153 "layer 3 (declared) must be reached; layer(s) 2, 3, 4, 5, 6, 7 ..."
        // Both released on agent_config under #109. Seed 04's answer sits
        // behind layer 6 and this does NOT reach it (S3/S4) — layers 4 and 5
        // tie at the floor and the tie breaks low. What changes is that the
        // model can no longer nominate layer 3's agent_config.
        const GAP3 = { layer: 3, name: 'Tool definitions', reason: 'r3', tools: ['agent_config'] }
        const GAP7 = { layer: 7, name: 'Trigger and wiring', reason: 'r7', tools: ['agent_config'] }

        const tr152 = gateLoop(['agent_trace', 'read_artifact'], [GAP2, GAP3, GAP4, GAP5, GAP7], [3])._depthGate('RUN1', FIX)
        expect(tr152.target.layer).toBe(4)
        expect(tr152.target.source).toBe('ranked')
        expect(tr152.target.tools).toEqual(['schema_lookup'])

        const tr153 = gateLoop(['agent_trace'], [GAP2, GAP3, GAP4, GAP5, GAP6, GAP7], [3])._depthGate('RUN1', FIX)
        expect(tr153.target.layer).toBe(4)
        expect(tr153.target.source).toBe('ranked')
        expect(tr153.target.tools).toEqual(['schema_lookup'])
    })

    test('DECLARED: among several named open gaps, the lowest-fan-out one wins — not the lowest layer number', () => {
        // Was 'the lowest-numbered declared layer that is open wins', asserting
        // layer 2. That encoded the OLD rule this change removes: layer 2's only
        // tool (agent_config) has fan-out 3, layer 5's query_table has fan-out 1
        // — the same cheap incidental compliance the fan-out rank exists to
        // block, now applied to the declared subset too.
        const gate = gateLoop(['agent_trace'], [GAP2, GAP4, GAP5], [5, 2])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(5)
        expect(gate.target.source).toBe('declared')
        expect(gate.target.tools).toEqual(['query_table'])
    })

    test('DECLARED: fan-out beats a lower layer number when both are named and open', () => {
        // Ranking alone (and the OLD declared rule) would land on layer 2 —
        // lowest layer, or first-scanned. The gap-2 tool (agent_config) has
        // fan-out 3; the gap-4 tool (schema_lookup) has fan-out 1. The declared
        // subset must apply the SAME rank as the ranked path: lowest fan-out
        // wins.
        const gate = gateLoop(['agent_trace'], [GAP2, GAP4], [2, 4])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(4)
        expect(gate.target.source).toBe('declared')
        expect(gate.target.tools).toEqual(['schema_lookup'])
    })

    test('DECLARED: a fan-out tie within the named subset breaks on the lowest layer number', () => {
        // Layers 4 and 5 both carry a fan-out-1 tool (schema_lookup,
        // query_table). With both named, the tie-break is the same as the
        // ranked path's: lowest layer number.
        const gate = gateLoop(['agent_trace'], [GAP4, GAP5], [4, 5])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(4)
        expect(gate.target.source).toBe('declared')
        expect(gate.target.tools).toEqual(['schema_lookup'])
    })

    test('DECLARED: a named layer that is NOT an open gap falls through to ranked', () => {
        const gate = gateLoop(['agent_trace'], [GAP2, GAP4], [7])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(4)
        expect(gate.target.source).toBe('ranked')
    })

    test('STICKY: the target is recorded at the FIRST hold and a later draft cannot move it', () => {
        let gaps = [GAP2, GAP4]
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: {
                unsweptGaps: function () {
                    return gaps
                },
                toolFanOut: function () {
                    return { agent_config: 3, schema_lookup: 1, query_table: 1, log_analysis: 3 }
                },
                declaredLayers: function () {
                    return []
                },
            },
        })

        const first = loop._depthGate('RUN1', FIX)
        expect(first.target.layer).toBe(4)

        gaps = [GAP5]
        const second = loop._depthGate('RUN1', FIX)
        expect(second.hold).toBe(true)
        expect(second.target.layer).toBe(4)
    })

    test('FALLBACK: an unscorable gap set falls back to the union rather than latching', () => {
        // A PaFixReport with no toolFanOut at all (an older or broken
        // collaborator): no gap can be scored, so the gate must behave as
        // #103 did rather than record an empty, unreleasable set.
        let invoked = ['agent_trace']
        const loop = load({
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: invoked.slice() }
                },
            },
            fixReport: {
                unsweptGaps: function () {
                    return [GAP2, GAP4]
                },
            },
        })

        const gate = loop._depthGate('RUN1', FIX)
        expect(gate.hold).toBe(true)
        expect(gate.target).toBe(null)

        invoked = ['agent_trace', 'agent_config']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('R-9: a throwing declaredLayers degrades to the ranked path, it does not trap the run', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: {
                unsweptGaps: function () {
                    return [GAP2, GAP4]
                },
                toolFanOut: function () {
                    return { agent_config: 3, schema_lookup: 1 }
                },
                declaredLayers: function () {
                    throw new Error('boom')
                },
            },
        })

        let gate
        expect(() => {
            gate = loop._depthGate('RUN1', FIX)
        }).not.toThrow()
        expect(gate.target.layer).toBe(4)
        expect(gate.target.source).toBe('ranked')
    })

    test('R-9: a throwing toolFanOut degrades to the union fallback', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: {
                unsweptGaps: function () {
                    return [GAP2, GAP4]
                },
                toolFanOut: function () {
                    throw new Error('boom')
                },
            },
        })

        let gate
        expect(() => {
            gate = loop._depthGate('RUN1', FIX)
        }).not.toThrow()
        expect(gate.hold).toBe(true)
        expect(gate.target).toBe(null)
    })

    // I5 (final whole-branch review): this was named "a fresh run() resets
    // the recorded target", which described something it never asserted —
    // it calls `_resetGate()` directly, and `run()` does not reset anything
    // (`initialize()` is `_resetGate`'s only caller). Renamed to what it
    // actually covers; the behaviour is unchanged and correct, because
    // production constructs a fresh loop per run.
    test('_resetGate clears the recorded target', () => {
        const loop = gateLoop(['agent_trace'], [GAP2, GAP4])
        loop._depthGate('RUN1', FIX)
        expect(loop._heldTarget).not.toBe(null)

        loop._resetGate()
        expect(loop._heldTarget).toBe(null)
    })

    // -----------------------------------------------------------------
    // I2 — selection and rendering must agree on what a usable target is
    // -----------------------------------------------------------------

    test('I2: a non-numeric layer is rejected at selection, not silently half-honored', () => {
        // `_holdBlock`/`_holdNote` both require a NUMBER and fall back to the
        // undirected wording otherwise. Before the fix, `_selectTarget`
        // accepted this and `_heldTools` narrowed to the one dedicated tool
        // anyway — narrow enforcement behind a vague instruction. Now the
        // whole target is refused and the union fallback applies.
        let invoked = ['agent_trace']
        const loop = load({
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: invoked.slice() }
                },
            },
            fixReport: fakeFixReport([], [{ layer: '5', name: 'Data', reason: 'r', tools: ['query_table', 'log_analysis'] }]),
        })

        const gate = loop._depthGate('RUN1', FIX)
        expect(gate.hold).toBe(true)
        expect(gate.target).toBe(null)
        // Union fallback: BOTH of the gap's tools release, matching the
        // undirected wording the model is actually shown.
        invoked = ['agent_trace', 'log_analysis']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('I2: a NaN layer is rejected too — typeof says "number" and every comparison against it is false', () => {
        const gate = gateLoop(['agent_trace'], [
            { layer: Number('nope'), name: 'Data', reason: 'r', tools: ['query_table'] },
        ])._depthGate('RUN1', FIX)
        expect(gate.hold).toBe(true)
        expect(gate.target).toBe(null)
    })

    // -----------------------------------------------------------------
    // I3 — the target carries its own fan-out to the renderer
    // -----------------------------------------------------------------

    test('I3: the target carries its fan-out — 1 for a dedicated-tool layer', () => {
        const gate = gateLoop(['agent_trace'], [GAP2, GAP4])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(4)
        expect(gate.target.fanOut).toBe(1)
    })

    test('I3: the target carries its fan-out — 3 when the gap set is confined to layers 2/3/7', () => {
        // `agent_config` is the only tool for layers 2, 3 and 7, and it
        // reaches all three. The ranked target is layer 2 and NOTHING about
        // it is exclusive — the renderer needs to know that.
        const GAP3 = { layer: 3, name: 'Tools', reason: 'r3', tools: ['agent_config'] }
        const GAP7 = { layer: 7, name: 'Platform', reason: 'r7', tools: ['agent_config'] }
        const gate = gateLoop(['agent_trace'], [GAP2, GAP3, GAP7])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(2)
        expect(gate.target.fanOut).toBe(3)
    })

    test('I3: the target carries its fan-out — 2 for a layer-6 target reached by genai_log', () => {
        const gate = gateLoop(['agent_trace'], [GAP2, GAP6])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(6)
        expect(gate.target.fanOut).toBe(2)
    })
})

// ===========================================================================
// capped depth gate (C1) — at most two holds, then release
//
// #109 narrowed the release set to the target layer's DEDICATED tools, but
// `PaFixReport.schemaText()` still advertises the WHOLE layer-to-tool map in
// every prompt — for layers 1, 5 and 6 the dedicated set is a strict subset
// of what the model is told closes that layer. So a compliant-looking call
// (`log_analysis` for a layer-5 target) can fail to release, and an uncapped
// gate would re-hold until MAX_ITERATIONS and finish `partial` — a
// pre-registered revert trigger for the benchmark. The gate therefore issues
// at most MAX_HOLDS (2) holds and lets the third terminal attempt through.
// ===========================================================================

describe('capped depth gate (C1) — at most two holds', () => {
    const GAP4 = { layer: 4, name: 'Data schemas', reason: 'r4', tools: ['schema_lookup'] }
    const GAP5 = { layer: 5, name: 'Data', reason: 'r5', tools: ['query_table', 'log_analysis'] }
    const FIX = { action: 'fix_report', report: { layers_swept: {} } }
    const ANSWER = { action: 'answer', text: 'done' }

    function movingTrail(initial, gaps, declared) {
        const state = { invoked: initial.slice() }
        state.loop = load({
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: state.invoked.slice() }
                },
            },
            fixReport: fakeFixReport([], gaps, declared),
        })
        return state
    }

    test('two holds, then the third terminal attempt is ALLOWED even though the trail never moved', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: fakeFixReport([], [GAP4]),
        })

        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)
        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        const third = loop._depthGate('RUN1', FIX)
        expect(third.hold).toBe(false)
        expect(loop._gateReleased).toBe(true)
    })

    test('the model doing something IRRELEVANT between holds does not release it — the cap does', () => {
        // The realistic shape of the failure C1 bounds: the model reads the
        // advertised map, calls a tool that reaches the layer but is NOT
        // dedicated to it, and is re-held. Layer 5 advertises query_table
        // AND log_analysis; only query_table releases.
        const state = movingTrail(['agent_trace'], [GAP5])

        expect(state.loop._depthGate('RUN1', FIX).hold).toBe(true)
        state.invoked = ['agent_trace', 'log_analysis']
        expect(state.loop._depthGate('RUN1', FIX).hold).toBe(true)

        const third = state.loop._depthGate('RUN1', FIX)
        expect(third.hold).toBe(false)
        expect(third.capped).toBe(true)
    })

    test('the cap release carries the distinguishing flag', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: fakeFixReport([], [GAP4]),
        })
        loop._depthGate('RUN1', FIX)
        loop._depthGate('RUN1', FIX)
        expect(loop._depthGate('RUN1', FIX).capped).toBe(true)
    })

    test('a genuine trail-backed release does NOT carry the flag', () => {
        const state = movingTrail(['agent_trace'], [GAP4])
        expect(state.loop._depthGate('RUN1', FIX).hold).toBe(true)

        state.invoked = ['agent_trace', 'schema_lookup']
        const released = state.loop._depthGate('RUN1', FIX)
        expect(released.hold).toBe(false)
        expect(released.capped).toBe(false)
    })

    test('a genuine release on the SECOND attempt still works and does not consume the cap path', () => {
        const state = movingTrail(['agent_trace'], [GAP4])
        expect(state.loop._depthGate('RUN1', FIX).hold).toBe(true)
        expect(state.loop._holdCount).toBe(1)

        state.invoked = ['agent_trace', 'schema_lookup']
        const released = state.loop._depthGate('RUN1', FIX)
        expect(released.hold).toBe(false)
        expect(released.capped).toBe(false)
        // Only ONE hold was ever issued — the cap branch was not the exit.
        expect(state.loop._holdCount).toBe(1)
    })

    test('every ALLOW path that is not the cap reports capped:false', () => {
        // Already released, an unreadable trail, and no open gap at all.
        const readable = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace', 'schema_lookup'] }),
            fixReport: fakeFixReport([], [GAP4]),
        })
        expect(readable._depthGate('RUN1', FIX).capped).toBe(false)
        // Second call takes the `_gateReleased` short-circuit.
        expect(readable._depthGate('RUN1', FIX).capped).toBe(false)

        const degraded = load({
            auditLogger: fakeAuditLogger({ available: false, degraded: 'glide_unavailable', tools: [] }),
            fixReport: fakeFixReport([], [GAP4]),
        })
        expect(degraded._depthGate('RUN1', FIX).capped).toBe(false)
    })

    test('every HOLD reports capped:false', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: fakeFixReport([], [GAP4]),
        })
        expect(loop._depthGate('RUN1', FIX).capped).toBe(false)
        expect(loop._depthGate('RUN1', FIX).capped).toBe(false)
    })

    test('ONE counter, all holds — the no_layer_report path counts too', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: fakeFixReport([], [GAP4]),
        })
        const first = loop._depthGate('RUN1', ANSWER)
        expect(first.hold).toBe(true)
        expect(first.kind).toBe('no_layer_report')
        expect(loop._holdCount).toBe(1)

        // A fix_report next: still the FIRST recorded hold for the gap set,
        // but the second hold overall, so the cap is already spent.
        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)
        expect(loop._holdCount).toBe(2)
        expect(loop._depthGate('RUN1', FIX).capped).toBe(true)
    })

    test('the counter resets between runs', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: fakeFixReport([], [GAP4]),
        })
        loop._depthGate('RUN1', FIX)
        loop._depthGate('RUN1', FIX)
        expect(loop._holdCount).toBe(2)

        loop._resetGate()
        expect(loop._holdCount).toBe(0)
        // And the gate holds again from scratch rather than staying capped.
        expect(loop._depthGate('RUN2', FIX).hold).toBe(true)
    })

    test('the cap note is short, distinguishable from a HOLD note, and names no tool', () => {
        const note = load()._cappedNote()
        expect(note.length).toBeLessThan(200)
        expect(note).not.toMatch(/^HOLD:/)
        expect(note).toMatch(/cap/i)
        expect(note).toMatch(/not by the trail|not compliance/i)
        expect(note).not.toContain('schema_lookup')
        expect(note).not.toContain('query_table')
        expect(note).not.toContain('genai_log')
    })

    // -----------------------------------------------------------------------
    // R1 — the trail check must run BEFORE the cap, or the one behaviour the
    // gate exists to produce is recorded as the gate giving up.
    // -----------------------------------------------------------------------

    test('R1: a model that complies AFTER hold #2 gets a GENUINE release, not a capped one', () => {
        const state = movingTrail(['agent_trace'], [GAP4])

        expect(state.loop._depthGate('RUN1', FIX).hold).toBe(true)
        expect(state.loop._depthGate('RUN1', FIX).hold).toBe(true)
        expect(state.loop._holdCount).toBe(2)

        // The cap is spent, but the model has now done exactly what the hold
        // asked. What releases this is the trail row, not the cap — and the
        // benchmark counts capped releases against the gate, so classifying
        // this one as capped would undercount the compliance it measures.
        state.invoked = ['agent_trace', 'schema_lookup']
        const released = state.loop._depthGate('RUN1', FIX)
        expect(released.hold).toBe(false)
        expect(released.capped).toBe(false)
    })

    test('R1: compliance after hold #2 is still a genuine release when the cap is over-spent', () => {
        // Same shape, one hold further along: the counter is past MAX_HOLDS
        // (the no_layer_report path can push it there), and the trail check
        // still wins.
        const state = movingTrail(['agent_trace'], [GAP4])
        state.loop._depthGate('RUN1', FIX)
        state.loop._depthGate('RUN1', FIX)
        state.loop._holdCount = 7

        state.invoked = ['agent_trace', 'schema_lookup']
        const released = state.loop._depthGate('RUN1', FIX)
        expect(released.hold).toBe(false)
        expect(released.capped).toBe(false)
    })

    // -----------------------------------------------------------------------
    // R2 — the cap has to bound the no_layer_report path too. `_heldTools` is
    // only ever assigned on the fix_report route, so a run that never files a
    // layer report never enters the sticky branch — and before this fix the
    // cap lived INSIDE that branch, leaving the path unbounded.
    // -----------------------------------------------------------------------

    test('R2: the no_layer_report path is bounded — two holds, then a capped release', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: fakeFixReport([], [GAP4]),
        })

        expect(loop._depthGate('RUN1', ANSWER).kind).toBe('no_layer_report')
        expect(loop._depthGate('RUN1', ANSWER).kind).toBe('no_layer_report')
        expect(loop._holdCount).toBe(2)

        const third = loop._depthGate('RUN1', ANSWER)
        expect(third.hold).toBe(false)
        expect(third.capped).toBe(true)
        expect(loop._gateReleased).toBe(true)
    })

    test('R2: the cap bounds a FIRST hold too — no recorded release set is needed', () => {
        // Two no_layer_report holds spend the cap; the first fix_report then
        // arrives with an open gap it would otherwise be held on.
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: fakeFixReport([], [GAP4]),
        })
        loop._depthGate('RUN1', ANSWER)
        loop._depthGate('RUN1', ANSWER)

        const third = loop._depthGate('RUN1', FIX)
        expect(third.hold).toBe(false)
        expect(third.capped).toBe(true)
        // Nothing was recorded — the cap, not the sticky branch, was the exit.
        expect(loop._heldTools).toBe(null)
    })

    test('the cap note claims only the mechanism, and stays countable', () => {
        const note = load()._cappedNote()
        expect(note.length).toBeLessThan(200)
        expect(note.indexOf('GATE:')).toBe(0)
        // It must NOT assert the target layer went unreached: R1 shows a
        // capped-looking release can follow real compliance, and the
        // no_layer_report route has no target layer at all.
        expect(note).not.toMatch(/never reached|was not reached|target layer/i)
        // Still tells a capped release from an earned one, and still says
        // plainly that it is not compliance.
        expect(note).toMatch(/cap/i)
        expect(note).toMatch(/not compliance/i)
    })
})

// ===========================================================================
// depth gate (#103) — _holdBlock
// ===========================================================================

describe('depth gate (#103) — _holdBlock', () => {
    const GAPS = [
        { layer: 2, name: 'Instructions', reason: 'the trace showed no routing problem', tools: ['agent_config'] },
        { layer: 4, name: 'Data schemas', reason: 'no schema read was needed', tools: ['schema_lookup'] },
    ]

    test('announces the hold and quotes the model back to itself', () => {
        const block = load()._holdBlock(GAPS, 'gaps')
        expect(block).toContain('HOLD')
        expect(block).toContain('layer 2 (Instructions)')
        expect(block).toContain('the trace showed no routing problem')
        expect(block).toContain('layer 4 (Data schemas)')
    })

    test('states the draft is preserved and resubmittable — it defers, it does not penalise', () => {
        const block = load()._holdBlock(GAPS, 'gaps')
        expect(block).toContain('preserved')
        expect(block).toMatch(/resubmit/i)
    })

    test('asks what the last result established and what it left open', () => {
        const block = load()._holdBlock(GAPS, 'gaps')
        expect(block).toMatch(/quote/i)
        expect(block).toMatch(/did it not settle|not settle/i)
    })

    test('GUARD: never names a tool the acceptance test measures', () => {
        const block = load()._holdBlock(GAPS, 'gaps')
        expect(block).not.toContain('schema_lookup')
        expect(block).not.toContain('query_table')
        expect(block).not.toContain('genai_log')
    })

    // T4 (final whole-branch review): the original version of this test only
    // ever carried `query_table` in a gap's `tools[]` — the `genai_log` leg
    // of the sibling GUARD test above was vacuous because no fixture ever
    // contained it. Exercise all three measured tools here.
    test('GUARD: never names a tool even when a gap carries one — all three measured tools', () => {
        const block = load()._holdBlock(
            [
                { layer: 4, name: 'Data schemas', reason: 'r', tools: ['schema_lookup'] },
                { layer: 5, name: 'Data', reason: 'r', tools: ['query_table'] },
                { layer: 6, name: 'GenAI stack', reason: 'r', tools: ['genai_log'] },
            ],
            'gaps'
        )
        expect(block).not.toContain('schema_lookup')
        expect(block).not.toContain('query_table')
        expect(block).not.toContain('genai_log')
    })

    // -----------------------------------------------------------------------
    // I3 (final whole-branch review): `unsweptGaps` copies the model's own
    // `reason` text verbatim, and this method quotes it back in the next
    // prompt. An ordinary model-written reason like "no schema_lookup call
    // was needed" would otherwise re-inject a measured tool name three lines
    // above "Call a tool that reaches that layer" — the exact channel the
    // GUARD tests above exist to close, just via a different field.
    // -----------------------------------------------------------------------

    test('I3: scrubs a measured tool name embedded in the reason text before quoting it back', () => {
        const block = load()._holdBlock(
            [
                { layer: 4, name: 'Data schemas', reason: 'no schema_lookup call was needed', tools: ['schema_lookup'] },
                { layer: 5, name: 'Data', reason: 'query_table already covered this', tools: ['query_table'] },
                { layer: 6, name: 'GenAI stack', reason: 'genai_log showed nothing new', tools: ['genai_log'] },
            ],
            'gaps'
        )
        expect(block).not.toContain('schema_lookup')
        expect(block).not.toContain('query_table')
        expect(block).not.toContain('genai_log')
        expect(block).toContain('[tool]')
    })

    test('I3: scrubs all seven registered tool names uniformly, not just the three the acceptance test measures', () => {
        const block = load()._holdBlock(
            [
                {
                    layer: 2,
                    name: 'Instructions',
                    reason:
                        'agent_trace, agent_config, schema_lookup, query_table, genai_log, log_analysis and ' +
                        'read_artifact were all considered before writing this reason',
                    tools: ['agent_config'],
                },
            ],
            'gaps'
        )
        ;['agent_trace', 'agent_config', 'schema_lookup', 'query_table', 'genai_log', 'log_analysis', 'read_artifact'].forEach(
            (name) => {
                expect(block).not.toContain(name)
            }
        )
    })

    test('I3: scrubs tool names case-insensitively — sentence-initial capitalization', () => {
        const block = load()._holdBlock(
            [
                { layer: 2, name: 'Instructions', reason: 'Schema_lookup was not helpful here', tools: ['schema_lookup'] },
                { layer: 3, name: 'Agent', reason: 'Query_table provided the answer', tools: ['query_table'] },
                { layer: 5, name: 'Data', reason: 'Genai_log showed the trace', tools: ['genai_log'] },
                { layer: 6, name: 'GenAI stack', reason: 'Agent_trace led here', tools: ['agent_trace'] },
            ],
            'gaps'
        )
        ;['Schema_lookup', 'Query_table', 'Genai_log', 'Agent_trace'].forEach((name) => {
            expect(block).not.toContain(name)
        })
        expect(block).toContain('[tool]')
    })

    test('I3: scrubs tool names case-insensitively — all uppercase', () => {
        const block = load()._holdBlock(
            [
                { layer: 2, name: 'Instructions', reason: 'SCHEMA_LOOKUP did not apply', tools: ['schema_lookup'] },
                { layer: 3, name: 'Agent', reason: 'QUERY_TABLE returned results', tools: ['query_table'] },
                { layer: 4, name: 'Data schemas', reason: 'LOG_ANALYSIS completed', tools: ['log_analysis'] },
                { layer: 5, name: 'Data', reason: 'READ_ARTIFACT verified content', tools: ['read_artifact'] },
                { layer: 6, name: 'GenAI stack', reason: 'AGENT_CONFIG set the base', tools: ['agent_config'] },
            ],
            'gaps'
        )
        ;['SCHEMA_LOOKUP', 'QUERY_TABLE', 'LOG_ANALYSIS', 'READ_ARTIFACT', 'AGENT_CONFIG'].forEach((name) => {
            expect(block).not.toContain(name)
        })
        expect(block).toContain('[tool]')
    })

    test('the no_layer_report variant asks for a layer report', () => {
        const block = load()._holdBlock([], 'no_layer_report')
        expect(block).toContain('HOLD')
        expect(block).toMatch(/layer report|layers_swept/i)
    })

    test('degrades gracefully (R-9): a null element in gaps is skipped, not dereferenced', () => {
        const block = load()._holdBlock(
            [
                { layer: 2, name: 'Instructions', reason: 'r2', tools: ['agent_config'] },
                null,
                { layer: 4, name: 'Data schemas', reason: 'r4', tools: ['schema_lookup'] },
            ],
            'gaps'
        )

        expect(() => {
            // The mere act of building the block must not throw.
        }).not.toThrow()

        // Well-formed entries still appear.
        expect(block).toContain('layer 2 (Instructions)')
        expect(block).toContain('layer 4 (Data schemas)')
    })

    test('degrades gracefully (R-9): a non-object entry in gaps is skipped', () => {
        const block = load()._holdBlock(
            [
                { layer: 2, name: 'Instructions', reason: 'r2', tools: ['agent_config'] },
                'not an object',
                42,
                { layer: 4, name: 'Data schemas', reason: 'r4', tools: ['schema_lookup'] },
            ],
            'gaps'
        )

        expect(() => {
            // The mere act of building the block must not throw.
        }).not.toThrow()

        // Well-formed entries still appear.
        expect(block).toContain('layer 2 (Instructions)')
        expect(block).toContain('layer 4 (Data schemas)')
    })

    test('#116: item 1 does not offer a bare field as a quotable unit', () => {
        // v7 §4 measured the hold pushing schema_lookup arguments onto bare
        // scalars, and C4/C5 returned "priority" and "assignment_group" — bare
        // FIELD names with the table dropped, which no lexical guard can catch
        // because both are valid table names. Item 1 named `field` as a
        // standalone quotable unit three lines above "Call a tool that reaches
        // layer N", in a block that renders LAST in the prompt. This makes the
        // table and the field co-salient instead.
        const block = load()._holdBlock(GAPS, 'gaps')
        expect(block).toContain('Quote the specific value you')
        expect(block).toContain('the table and field it came from')
        expect(block).not.toMatch(/Quote the specific field/i)
    })
})

// ===========================================================================
// depth gate (#103) — _holdNote (M2, final whole-branch review)
//
// `_openGaps`/`_unionTools`/`_holdBlock` all guard against a non-plain-object
// gap element. `_holdNote` did not, even though it is the one consumer whose
// omission would take the run down: `list[i].layer` on a null/undefined
// entry throws.
// ===========================================================================

describe('depth gate (#103) — _holdNote', () => {
    test('M2: a malformed element in gate.gaps is skipped, not dereferenced', () => {
        let note
        expect(() => {
            note = load()._holdNote({
                kind: 'gaps',
                gaps: [
                    { layer: 2, name: 'Instructions', reason: 'r', tools: ['agent_config'] },
                    null,
                    'not an object',
                    { layer: 4, name: 'Data schemas', reason: 'r', tools: ['schema_lookup'] },
                ],
            })
        }).not.toThrow()

        expect(note).toContain('2')
        expect(note).toContain('4')
    })
})

// ===========================================================================
// depth gate (#103) — hold block position in the prompt (M3, final
// whole-branch review)
//
// `_fixReportContract()` is the largest, most specific block in the prompt.
// With the hold BEFORE both contracts, the last thing the model read after
// being told a terminal action was unavailable was a detailed spec for
// producing one. The hold now goes LAST — after both contracts — so the
// final instruction the model reads is to go call a tool.
// ===========================================================================

describe('depth gate (#103) — hold block position in _buildPrompt (M3)', () => {
    test('the hold block appears AFTER both the response contract and the fix_report contract', () => {
        const loop = load({ fixReport: fakeFixReport([]) })
        loop._holdActive = 'HOLD BLOCK MARKER TEXT'

        const prompt = loop._buildPrompt('PLAYBOOK', 'TOOLBLOCK', { transcript: [] }, {})

        const holdIdx = prompt.indexOf('HOLD BLOCK MARKER TEXT')
        const responseIdx = prompt.indexOf('## Response format')
        const fixReportIdx = prompt.indexOf('## fix_report JSON contract')

        expect(holdIdx).toBeGreaterThan(-1)
        expect(responseIdx).toBeGreaterThan(-1)
        expect(fixReportIdx).toBeGreaterThan(-1)
        expect(holdIdx).toBeGreaterThan(responseIdx)
        expect(holdIdx).toBeGreaterThan(fixReportIdx)
    })

    test('with no active hold, the prompt carries neither the marker nor an empty trailing block', () => {
        const loop = load({ fixReport: fakeFixReport([]) })
        const prompt = loop._buildPrompt('PLAYBOOK', 'TOOLBLOCK', { transcript: [] }, {})
        expect(prompt).not.toContain('HOLD BLOCK MARKER TEXT')
    })
})

// ===========================================================================
// depth gate (#103) — wired into the loop
// ===========================================================================

describe('depth gate (#103) — wired into the loop', () => {
    const GAP4 = {
        layer: 4,
        name: 'Data schemas',
        reason: 'no schema read was needed',
        tools: ['schema_lookup'],
    }
    const DRAFT = { action: 'fix_report', report: { layers_swept: {} } }
    const fixWith = (validateResults, gaps) => fakeFixReport(validateResults, gaps)

    test('a held fix_report loops instead of terminating, and the NEXT prompt carries the interrogation IN FULL', () => {
        const llm = fakeLlm([
            { success: true, action: DRAFT, raw: 'r1' },
            { success: true, action: { action: 'tool_call', tool: 'agent_config', args: {} }, raw: 'r2' },
        ])
        const loop = load({
            llmProxy: llm,
            runManager: fakeRunManager(),
            toolRegistry: fakeTools([]),
            fixReport: fixWith([], [GAP4]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            maxIterations: 2,
        })
        loop.run('RUN1')

        expect(llm.calls.length).toBeGreaterThanOrEqual(2)
        const second = llm.calls[1]
        expect(second).toContain('HOLD')
        expect(second).toContain('layer 4 (Data schemas)')
        expect(second).toContain('no schema read was needed')
        // #109: the loop now wires `gate.target` through to `_holdBlock`,
        // so a single-gap hold (GAP4, no declared layer) renders the
        // RANKED directed wording rather than #103's generic item 2.
        expect(second).toMatch(/no other line of investigation reaches/i)
        expect(second).toContain('Call a tool that reaches layer 4')
        // NEGATIVE (test-hygiene finding on #109 review): confirm the
        // generic #103 wording this directed rendering REPLACES is truly
        // absent, not merely that the directed wording is also present.
        expect(second).not.toContain('most change your conclusion')
        // The #72 regression guard: the block must arrive WHOLE, not as a
        // 200-char digest stub.
        expect(second).not.toContain('more chars]')
    })

    test('the transcript keeps a SHORT audit note, under the 200-char digest ceiling', () => {
        const runs = fakeRunManager()
        const loop = load({
            runManager: runs,
            toolRegistry: fakeTools([]),
            llmProxy: fakeLlm([
                { success: true, action: DRAFT, raw: 'r1' },
                { success: true, action: { action: 'tool_call', tool: 'agent_config', args: {} }, raw: 'r2' },
            ]),
            fixReport: fixWith([], [GAP4]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            maxIterations: 2,
        })
        loop.run('RUN1')

        const notes = runs.transcript.filter((e) => e.actor === 'system' && /^HOLD:/.test(e.result_digest || ''))
        expect(notes).toHaveLength(1)
        expect(notes[0].result_digest.length).toBeLessThan(200)
    })

    test('an UNHELD fix_report terminates exactly as before', () => {
        const loop = load({
            fixReport: fixWith([{ valid: true, normalized: { ok: true } }], []),
            llmProxy: fakeLlm([{ success: true, action: DRAFT, raw: 'r1' }]),
            runManager: fakeRunManager(),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
        })
        expect(loop.run('RUN1').outcome).toBe('fix_report')
    })

    test('a degraded trail does not gate — the run terminates as before', () => {
        const loop = load({
            fixReport: fixWith([{ valid: true, normalized: { ok: true } }], [GAP4]),
            llmProxy: fakeLlm([{ success: true, action: DRAFT, raw: 'r1' }]),
            runManager: fakeRunManager(),
            auditLogger: fakeAuditLogger({ available: false, degraded: 'glide_unavailable', tools: [] }),
        })
        expect(loop.run('RUN1').outcome).toBe('fix_report')
    })

    test('a run that refuses to act rides the bounds to partial (P4, the refusal tail)', () => {
        // C1 (final whole-branch review): this test used to run three DRAFT
        // iterations. The gate now caps at MAX_HOLDS (2), so a third terminal
        // attempt is RELEASED rather than held and the run finishes — see the
        // dedicated cap tests below. The P4 refusal tail still exists where
        // the bounds bite BEFORE the cap does, which is what this now covers:
        // two attempts, two holds, no iteration left to spend the release on.
        const loop = load({
            llmProxy: fakeLlm([
                { success: true, action: DRAFT, raw: 'r1' },
                { success: true, action: DRAFT, raw: 'r2' },
            ]),
            runManager: fakeRunManager(),
            fixReport: fixWith([], [GAP4]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            maxIterations: 2,
        })
        expect(loop.run('RUN1').outcome).toBe('partial')
    })

    test('C1: the cap releases the third terminal attempt, and the transcript says it was the cap', () => {
        const runs = fakeRunManager()
        const loop = load({
            runManager: runs,
            llmProxy: fakeLlm([
                { success: true, action: DRAFT, raw: 'r1' },
                { success: true, action: DRAFT, raw: 'r2' },
                { success: true, action: DRAFT, raw: 'r3' },
            ]),
            fixReport: fixWith([{ valid: true, normalized: { ok: true } }], [GAP4]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            maxIterations: 5,
        })

        // The model never calls schema_lookup. Uncapped this rides to
        // MAX_ITERATIONS and finishes `partial` — the revert trigger.
        expect(loop.run('RUN1').outcome).toBe('fix_report')

        const holds = runs.transcript.filter((e) => /^HOLD:/.test(e.result_digest || ''))
        expect(holds).toHaveLength(2)

        const capped = runs.transcript.filter(
            (e) => e.actor === 'system' && /cap/i.test(e.result_digest || '') && !/^HOLD:/.test(e.result_digest || '')
        )
        expect(capped).toHaveLength(1)
        expect(capped[0].result_digest.length).toBeLessThan(200)
    })

    test('C1: a run the model actually complies with writes NO cap note', () => {
        const runs = fakeRunManager()
        let invoked = ['agent_trace']
        const loop = load({
            runManager: runs,
            toolRegistry: fakeTools([]),
            llmProxy: fakeLlm([
                { success: true, action: DRAFT, raw: 'r1' },
                { success: true, action: { action: 'tool_call', tool: 'schema_lookup', args: {} }, raw: 'r2' },
                { success: true, action: DRAFT, raw: 'r3' },
            ]),
            fixReport: fixWith([{ valid: true, normalized: { ok: true } }], [GAP4]),
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: invoked.slice() }
                },
            },
            maxIterations: 5,
        })
        // The trail catches up once the tool has been dispatched.
        const tools = loop._tools()
        const originalDispatch = tools.dispatch
        tools.dispatch = function (name, args, ctx) {
            invoked.push(name)
            return originalDispatch.call(tools, name, args, ctx)
        }

        expect(loop.run('RUN1').outcome).toBe('fix_report')
        const capped = runs.transcript.filter((e) => /cap/i.test(e.result_digest || ''))
        expect(capped).toHaveLength(0)
    })

    test('R2: a run that never files a fix_report is bounded by the cap, not by MAX_ITERATIONS', () => {
        // `_heldTools` is assigned on the fix_report route ALONE, so a run
        // that only ever answers never enters the sticky branch. With the cap
        // living inside that branch this run held on every iteration and rode
        // to MAX_ITERATIONS -> `partial`. The cap now dominates the
        // no_layer_report path too: two holds, then the answer is honoured.
        const runs = fakeRunManager()
        const ANSWER = { action: 'answer', text: 'done' }
        const loop = load({
            runManager: runs,
            llmProxy: fakeLlm([
                { success: true, action: ANSWER, raw: 'r1' },
                { success: true, action: ANSWER, raw: 'r2' },
                { success: true, action: ANSWER, raw: 'r3' },
                { success: true, action: ANSWER, raw: 'r4' },
                { success: true, action: ANSWER, raw: 'r5' },
            ]),
            fixReport: fixWith([], [GAP4]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            maxIterations: 5,
        })

        expect(loop.run('RUN1').outcome).toBe('answer')

        const holds = runs.transcript.filter((e) => /^HOLD:/.test(e.result_digest || ''))
        expect(holds).toHaveLength(2)

        const gate = runs.transcript.filter((e) => e.actor === 'system' && /^GATE:/.test(e.result_digest || ''))
        expect(gate).toHaveLength(1)
        expect(gate[0].result_digest.length).toBeLessThan(200)
    })

    test('R1: a run that complies AFTER the second hold writes NO cap note', () => {
        // The gate's whole purpose, arriving one beat later than the cap: the
        // model is held twice, then calls the tool the hold asked for. The
        // release is the trail's, so the transcript must carry no GATE: note
        // for the benchmark to count against the gate.
        const runs = fakeRunManager()
        let invoked = ['agent_trace']
        const loop = load({
            runManager: runs,
            toolRegistry: fakeTools([]),
            llmProxy: fakeLlm([
                { success: true, action: DRAFT, raw: 'r1' },
                { success: true, action: { action: 'tool_call', tool: 'agent_config', args: {} }, raw: 'r2' },
                { success: true, action: DRAFT, raw: 'r3' },
                { success: true, action: { action: 'tool_call', tool: 'schema_lookup', args: {} }, raw: 'r4' },
                { success: true, action: DRAFT, raw: 'r5' },
            ]),
            fixReport: fixWith([{ valid: true, normalized: { ok: true } }], [GAP4]),
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: invoked.slice() }
                },
            },
            maxIterations: 8,
        })
        const tools = loop._tools()
        const originalDispatch = tools.dispatch
        tools.dispatch = function (name, args, ctx) {
            invoked.push(name)
            return originalDispatch.call(tools, name, args, ctx)
        }

        expect(loop.run('RUN1').outcome).toBe('fix_report')

        // Two holds were issued — the cap was fully spent before the model
        // acted — and the release was still the trail's.
        const holds = runs.transcript.filter((e) => /^HOLD:/.test(e.result_digest || ''))
        expect(holds).toHaveLength(2)
        expect(loop._holdCount).toBe(2)
        const gate = runs.transcript.filter((e) => /^GATE:/.test(e.result_digest || ''))
        expect(gate).toHaveLength(0)
    })

    test('bounds are still checked FIRST — a hold cannot outlive MAX_ITERATIONS', () => {
        const runs = fakeRunManager()
        const loop = load({
            runManager: runs,
            llmProxy: fakeLlm([{ success: true, action: DRAFT, raw: 'r1' }]),
            fixReport: fixWith([], [GAP4]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            maxIterations: 1,
        })
        loop.run('RUN1')
        const flags = runs.transcript.filter((e) => /INCOMPLETE/.test(e.result_digest || ''))
        expect(flags).toHaveLength(1)
    })

    test('the gate never fires on a tool_call — only on terminal actions', () => {
        const tools = fakeTools([{ success: true, data: {} }])
        const loop = load({
            toolRegistry: tools,
            runManager: fakeRunManager(),
            llmProxy: fakeLlm([
                { success: true, action: { action: 'tool_call', tool: 'agent_trace', args: {} }, raw: 'r1' },
                { success: true, action: { action: 'answer', text: 'x' }, raw: 'r2' },
            ]),
            fixReport: fixWith([], [GAP4]),
            auditLogger: fakeAuditLogger({ available: true, tools: [] }),
            maxIterations: 2,
        })
        loop.run('RUN1')
        // One dispatch, from the tool_call turn. The gate held the `answer`
        // and the bound then ended the run — it never gated the tool_call.
        expect(tools.calls).toHaveLength(1)
    })

    // -----------------------------------------------------------------------
    // I1 (final whole-branch review): the model complies with a hold by
    // calling the named tool. The very next prompt must no longer carry the
    // stale hold text — the harness must not keep telling a model that just
    // did what was asked that a terminal action is still unavailable.
    // -----------------------------------------------------------------------

    test('I1: hold -> compliant tool call -> next prompt drops the hold block -> terminal action then passes', () => {
        let invoked = ['agent_trace']
        const tools = fakeTools((name) => {
            invoked.push(name)
            return { success: true, data: {} }
        })
        const llm = fakeLlm([
            { success: true, action: DRAFT, raw: 'r1' },
            { success: true, action: { action: 'tool_call', tool: 'schema_lookup', args: {} }, raw: 'r2' },
            { success: true, action: DRAFT, raw: 'r3' },
        ])
        const loop = load({
            toolRegistry: tools,
            runManager: fakeRunManager(),
            llmProxy: llm,
            fixReport: fixWith([{ valid: true, normalized: { ok: true } }], [GAP4]),
            auditLogger: { invokedTools: () => ({ available: true, tools: invoked.slice() }) },
            maxIterations: 3,
        })

        const res = loop.run('RUN1')

        expect(llm.calls.length).toBe(3)
        // iter2's prompt (built right after iter1's hold) carries the
        // interrogation block itself — NOT merely the short transcript note
        // (which also contains the substring "HOLD", hence the specific
        // heading check rather than a bare 'HOLD' substring match).
        expect(llm.calls[1]).toContain('## HOLD — a terminal action is not available yet')
        // iter3's prompt (built right after iter2's COMPLIANT tool_call)
        // must NOT still carry the stale hold block.
        expect(llm.calls[2]).not.toContain('## HOLD — a terminal action is not available yet')
        // And the terminal action submitted in iter3 now passes, since the
        // trail shows schema_lookup invoked.
        expect(res.outcome).toBe('fix_report')
    })

    // -----------------------------------------------------------------------
    // I2 (final whole-branch review): `[]` is truthy in JS. If the recorded
    // release set were ever empty, the old code's `if (this._heldTools)`
    // would latch onto it and hold every terminal action for the rest of the
    // run, with no possible exit.
    // -----------------------------------------------------------------------

    test('I2: an empty recorded release set does not deadlock the run', () => {
        let call = 0
        const emptyToolsGap = { layer: 4, name: 'Data schemas', reason: 'r', tools: [] }
        const loop = load({
            llmProxy: fakeLlm([
                { success: true, action: DRAFT, raw: 'r1' },
                {
                    success: true,
                    action: { action: 'fix_report', report: { failure_summary: 'ok', layers_swept: {} } },
                    raw: 'r2',
                },
            ]),
            runManager: fakeRunManager(),
            toolRegistry: fakeTools([]),
            fixReport: {
                unsweptGaps: function () {
                    call += 1
                    // First hold declares a gap whose `tools` is an empty
                    // array — `_layerToolMap()` never produces this in
                    // production (guarded by the sibling PaFixReport test),
                    // but `_depthGate` must not trust that blindly. The
                    // second call (a later draft) declares no gap at all.
                    return call === 1 ? [emptyToolsGap] : []
                },
                validate: function () {
                    return { valid: true, normalized: { ok: true } }
                },
                renderMarkdown: function () {
                    return 'md'
                },
                renderJson: function () {
                    return 'json'
                },
            },
            auditLogger: fakeAuditLogger({ available: true, tools: [] }),
            maxIterations: 3,
        })

        const res = loop.run('RUN1')

        // Without the I2 fix, `_heldTools` records `[]` on the first hold
        // and `if (this._heldTools)` — truthy on `[]` in JS — latches the
        // sticky branch permanently: `_anyOf([], trail.tools)` can never be
        // true, so EVERY later terminal action would hold regardless of
        // what the model submits, with no possible exit. With the fix, an
        // empty recorded set falls through instead of latching, and gaps
        // are re-derived fresh from the CURRENT draft — the second draft
        // declares no gap at all, so it passes.
        expect(res.outcome).toBe('fix_report')
    })
})

// ===========================================================================
// directed depth gate (#109) — the directed interrogation
//
// Item 2 used to ask the model which layer mattered most. The harness now
// answers that itself, so leaving the question would be theatre. It still
// names a LAYER and never a tool — see the #103 GUARD tests, which must keep
// passing unchanged.
// ===========================================================================

describe('directed depth gate (#109) — _holdBlock', () => {
    const GAPS = [
        { layer: 2, name: 'Instructions', reason: 'the trace showed no routing problem', tools: ['agent_config'] },
        { layer: 4, name: 'Data schemas', reason: 'no schema read was needed', tools: ['schema_lookup'] },
    ]

    test('RANKED: states which layer must be closed, and why that one', () => {
        // I3 (final whole-branch review): the strong claim is emitted only
        // at fan-out 1, so the target now carries its fan-out. Layer 4 is
        // reachable by `schema_lookup` alone, so this is the true case.
        const block = load()._holdBlock(GAPS, 'gaps', {
            layer: 4,
            source: 'ranked',
            tools: ['schema_lookup'],
            fanOut: 1,
        })
        expect(block).toContain('layer 4')
        expect(block).toMatch(/no other line of investigation reaches/i)
        expect(block).toMatch(/Call a tool that reaches layer 4/i)
        // NEGATIVE (test-hygiene finding on #109 review): a dropped `else`
        // would emit the directed lines ALONGSIDE the #103 generic ones and
        // still pass every assertion above. The generic item-2 wording must
        // be ABSENT, not merely "the directed wording is also present".
        expect(block).not.toMatch(/most change your conclusion/i)
    })

    test('I3: a fan-out-3 target gets the NEUTRAL variant — the exclusivity claim would be false', () => {
        // For a gap set confined to layers 2/3/7 the ranked target is layer 2
        // via `agent_config`, which also reaches 3 and 7. "No other line of
        // investigation reaches it" is simply untrue, and the harness must
        // not assert a falsehood to a model whose evidential honesty is the
        // thing being measured.
        const block = load()._holdBlock(GAPS, 'gaps', {
            layer: 2,
            source: 'ranked',
            tools: ['agent_config'],
            fanOut: 3,
        })
        expect(block).toContain('layer 2')
        expect(block).toMatch(/this run needs closed next/i)
        expect(block).toMatch(/Call a tool that reaches layer 2/i)
        // The load-bearing NEGATIVE: the false claim must be ABSENT.
        expect(block).not.toMatch(/no other line of investigation reaches/i)
        // And it is still directed, not the #103 generic fallback.
        expect(block).not.toMatch(/most change your conclusion/i)
    })

    test('I3: a fan-out-2 target gets the neutral variant too', () => {
        // Layer 6 releases on `genai_log`, which also reaches layer 1.
        const block = load()._holdBlock(GAPS, 'gaps', {
            layer: 6,
            source: 'ranked',
            tools: ['genai_log'],
            fanOut: 2,
        })
        expect(block).toMatch(/this run needs closed next/i)
        expect(block).not.toMatch(/no other line of investigation reaches/i)
    })

    test('I3: a target with no fan-out recorded gets the neutral variant, not the strong claim', () => {
        // Defensive: the claim is only made on positive evidence of fan-out 1.
        const block = load()._holdBlock(GAPS, 'gaps', { layer: 4, source: 'ranked', tools: ['schema_lookup'] })
        expect(block).toContain('layer 4')
        expect(block).toMatch(/this run needs closed next/i)
        expect(block).not.toMatch(/no other line of investigation reaches/i)
    })

    test('I3: the neutral variant still names NO tool', () => {
        const block = load()._holdBlock(
            [{ layer: 2, name: 'Instructions', reason: 'r', tools: ['agent_config'] }],
            'gaps',
            { layer: 2, source: 'ranked', tools: ['agent_config'], fanOut: 3 }
        )
        expect(block).not.toContain('agent_config')
        expect(block).not.toContain('schema_lookup')
        expect(block).not.toContain('query_table')
        expect(block).not.toContain('genai_log')
        expect(block).not.toContain('log_analysis')
    })

    test('DECLARED: quotes the model back to itself instead', () => {
        const block = load()._holdBlock(GAPS, 'gaps', { layer: 2, source: 'declared', tools: ['agent_config'] })
        expect(block).toContain('layer 2')
        expect(block).toMatch(/your own report names it/i)
        expect(block).toMatch(/Call a tool that reaches layer 2/i)
        // NEGATIVE — same reasoning as the RANKED case above.
        expect(block).not.toMatch(/most change your conclusion/i)
    })

    test('both gaps still appear — the target directs, it does not hide the rest', () => {
        const block = load()._holdBlock(GAPS, 'gaps', { layer: 4, source: 'ranked', tools: ['schema_lookup'] })
        expect(block).toContain('layer 2 (Instructions)')
        expect(block).toContain('layer 4 (Data schemas)')
    })

    test('item 1 is unchanged — it still asks for a quoted field', () => {
        const block = load()._holdBlock(GAPS, 'gaps', { layer: 4, source: 'ranked', tools: ['schema_lookup'] })
        expect(block).toMatch(/quote/i)
    })

    test('the draft-is-preserved closing survives verbatim', () => {
        const block = load()._holdBlock(GAPS, 'gaps', { layer: 4, source: 'ranked', tools: ['schema_lookup'] })
        expect(block).toContain('preserved')
        expect(block).toMatch(/resubmit/i)
    })

    test.each([undefined, null, {}, { layer: 'four' }, 42])(
        'R-9: a missing or malformed target (%p) keeps the #103 generic wording rather than throwing',
        (target) => {
            let block
            expect(() => {
                block = load()._holdBlock(GAPS, 'gaps', target)
            }).not.toThrow()
            expect(block).toContain('HOLD')
            expect(block).toMatch(/did it not settle|not settle/i)
            // NEGATIVE — the fallback path must render ONLY the generic
            // wording. A dropped `else` would leak the directed lines in
            // here too even with no usable target; none of them may appear.
            expect(block).not.toMatch(/no other line of investigation reaches/i)
            expect(block).not.toMatch(/your own report names it/i)
            expect(block).not.toContain('Call a tool that reaches layer')
        }
    )

    test('GUARD: the directed variants still never name a measured tool', () => {
        const ranked = load()._holdBlock(
            [{ layer: 4, name: 'Data schemas', reason: 'r', tools: ['schema_lookup'] }],
            'gaps',
            { layer: 4, source: 'ranked', tools: ['schema_lookup'] }
        )
        const declared = load()._holdBlock(
            [{ layer: 5, name: 'Data', reason: 'r', tools: ['query_table'] }],
            'gaps',
            { layer: 5, source: 'declared', tools: ['query_table'] }
        )
        ;[ranked, declared].forEach((block) => {
            expect(block).not.toContain('schema_lookup')
            expect(block).not.toContain('query_table')
            expect(block).not.toContain('genai_log')
        })
    })
})

describe('directed depth gate (#109) — _holdNote', () => {
    const GAPS = [
        { layer: 2, name: 'Instructions', reason: 'r', tools: ['agent_config'] },
        { layer: 4, name: 'Data schemas', reason: 'r', tools: ['schema_lookup'] },
    ]

    test('records the target layer and the selection source', () => {
        const note = load()._holdNote({
            kind: 'gaps',
            gaps: GAPS,
            target: { layer: 4, source: 'ranked', tools: ['schema_lookup'] },
        })
        expect(note).toContain('layer 4')
        expect(note).toContain('ranked')
    })

    test('records the declared source distinctly — the smoke tells the two paths apart by this', () => {
        const note = load()._holdNote({
            kind: 'gaps',
            gaps: GAPS,
            target: { layer: 2, source: 'declared', tools: ['agent_config'] },
        })
        expect(note).toContain('declared')
    })

    test('stays inside DIGEST_CHARS (200) — the #72 / §G3a constraint', () => {
        const note = load()._holdNote({
            kind: 'gaps',
            gaps: [
                { layer: 1, name: 'Execution', reason: 'r', tools: ['agent_trace'] },
                { layer: 2, name: 'Instructions', reason: 'r', tools: ['agent_config'] },
                { layer: 3, name: 'Tools', reason: 'r', tools: ['agent_config'] },
                { layer: 4, name: 'Data schemas', reason: 'r', tools: ['schema_lookup'] },
                { layer: 5, name: 'Data', reason: 'r', tools: ['query_table'] },
                { layer: 6, name: 'GenAI stack', reason: 'r', tools: ['genai_log'] },
                { layer: 7, name: 'Platform', reason: 'r', tools: ['agent_config'] },
            ],
            target: { layer: 4, source: 'declared', tools: ['schema_lookup'] },
        })
        expect(note.length).toBeLessThanOrEqual(200)
    })

    test('R-9: a missing target is omitted rather than dereferenced', () => {
        let note
        expect(() => {
            note = load()._holdNote({ kind: 'gaps', gaps: GAPS })
        }).not.toThrow()
        expect(note).toContain('HOLD')
    })
})
