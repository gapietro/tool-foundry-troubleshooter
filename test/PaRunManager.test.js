/**
 * PaRunManager — pure-logic tests (Phase 1b Task 5, LLD §3.1/§4.6,
 * DECISION.md §D5, DESIGN.md R-20).
 *
 * WHAT THESE TESTS ARE FOR
 * The custom harness's own lifecycle: create → queued/custom, transcript
 * append + summarization threshold, legal/illegal close transitions, the
 * Evidence Bundle (NO LLM in the call path), and the §D5 stale-native sweep
 * (native-only, `running`-only so `awaiting_confirmation` never expires, and
 * the exact R-20 citation on every row it closes).
 *
 * `PaRunAnchor.getOrCreate` is ALWAYS a test double here, never the real
 * class — this suite is not re-testing PaRunAnchor's key-resolution/ownership
 * logic (PaRunAnchor.test.js already owns that). What PaRunManager does with
 * whatever the anchor hands back — forcing `status:'queued'` on a fresh
 * custom run, manufacturing a single-use identity so two `createRun` calls
 * never converge on one row — is what this file settles.
 *
 * The GlideRecord side of every other method (`appendTranscript`, `close`,
 * `sweepStaleNative`, `collectBundle`'s run-context read) runs against the
 * REAL writable-world `_glideStub`, the same "does this code run" floor
 * DESIGN.md R-8 sets for every other component in this app.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeWritableWorld } = require('./_glideStub')

const RUN_TABLE = 'x_snc_troubleshoot_run'
const AUDIT_TABLE = 'x_snc_troubleshoot_audit'

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function fakeAnchor(result) {
    const calls = []
    return {
        calls: calls,
        getOrCreate: function (ctx) {
            calls.push(ctx)
            return result
        },
    }
}

function fakeLlm(responses) {
    const calls = []
    let i = 0
    return {
        calls: calls,
        summarize: function (prompt) {
            calls.push(prompt)
            const r = responses[i]
            i += 1
            return r === undefined ? { success: true, text: 'summary' } : r
        },
    }
}

function fakeRegistry(resultsByName) {
    const calls = []
    const results = resultsByName || {}
    return {
        calls: calls,
        dispatch: function (name, args, runCtx) {
            calls.push({ name: name, args: args, runCtx: runCtx })
            const r = results[name]
            return r === undefined ? { success: true, data: {} } : r
        },
    }
}

/**
 * @param {Object} [opts]
 *   world       makeWritableWorld options ({rows, failInsert, throwOnUpdate, ...})
 *   runAnchor / llmProxy / toolRegistry   collaborator overrides (omit for
 *               "not in the object graph" — see the structural bundle test)
 *   now         PaRunManager's clock seam
 *   noGlide     leave GlideRecord undefined, as a runtime without it would
 */
function load(opts) {
    const o = opts || {}
    const world = makeWritableWorld(o.world || {})
    const globals = { JSON: JSON }
    if (!o.noGlide) globals.GlideRecord = world.GlideRecord

    const ctx = loadScriptInclude('PaRunManager.js', globals)
    const mgr = new ctx.PaRunManager({
        runAnchor: o.runAnchor,
        llmProxy: o.llmProxy,
        toolRegistry: o.toolRegistry,
        now: o.now,
        maxAgeHours: o.maxAgeHours,
    })
    return { mgr: mgr, world: world, ctx: ctx }
}

function seedRun(overrides) {
    return Object.assign(
        { sys_id: 'run1', harness: 'custom', status: 'queued', number: 'TR0001042' },
        overrides
    )
}

// ===========================================================================
// createRun
// ===========================================================================

describe('createRun', () => {
    test('returns {run_id, number} and forces status to queued, regardless of what the anchor inserted', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: 'TR0001042' })
        const { mgr, world } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] } },
        })

        const res = mgr.createRun({ agent: 'Agent Doctor', executionRef: 'plan1', mode: 'diagnose' })

        expect(res).toEqual({ run_id: 'run1', number: 'TR0001042' })
        expect(world.tables[RUN_TABLE][0].status).toBe('queued')
    })

    test('passes harness:custom to the anchor', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: '' })
        const { mgr } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.createRun({})
        expect(anchor.calls[0].harness).toBe('custom')
    })

    test('passes executionRef/agent through, and mode', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: '' })
        const { mgr } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.createRun({ executionRef: 'plan1', agent: 'agentX', mode: 'collect' })

        expect(anchor.calls[0].executionRef).toBe('plan1')
        expect(anchor.calls[0].agentId).toBe('agentX')
        expect(anchor.calls[0].mode).toBe('collect')
    })

    test('omits executionRef/agent from the anchor call when not supplied (R-9)', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: '' })
        const { mgr } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.createRun({})

        expect(anchor.calls[0].executionRef).toBeUndefined()
        expect(anchor.calls[0].agentId).toBeUndefined()
    })

    test('manufactures a FRESH conversationId every call, so two runs never converge on one anchor', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: '' })
        const { mgr } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.createRun({ executionRef: 'plan1' })
        mgr.createRun({ executionRef: 'plan1' })

        expect(anchor.calls[0].conversationId).toBeTruthy()
        expect(anchor.calls[1].conversationId).toBeTruthy()
        expect(anchor.calls[0].conversationId).not.toBe(anchor.calls[1].conversationId)
    })

    test('the `user` param is never forwarded as anchor identity — it is server-authoritative there', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: '' })
        const { mgr } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.createRun({ user: 'someone.else' })

        expect(anchor.calls[0].user).toBeUndefined()
        expect(anchor.calls[0].userId).toBeUndefined()
    })

    test('a degraded anchor is reported, not papered over', () => {
        const anchor = fakeAnchor({ run_id: null, degraded: 'insert_failed' })
        const { mgr } = load({ runAnchor: anchor })

        const res = mgr.createRun({})

        expect(res.run_id).toBeNull()
        expect(res.degraded).toBe('insert_failed')
    })

    test('no run id at all from the anchor is reported the same way', () => {
        const anchor = fakeAnchor(null)
        const { mgr } = load({ runAnchor: anchor })

        const res = mgr.createRun({})

        expect(res.run_id).toBeNull()
        expect(res.degraded).toBeTruthy()
    })
})

// ===========================================================================
// appendTranscript
// ===========================================================================

describe('appendTranscript', () => {
    test('run not found returns success:false, never throws', () => {
        const { mgr } = load({})
        expect(() => mgr.appendTranscript('nope', { actor: 'llm' })).not.toThrow()
        expect(mgr.appendTranscript('nope', { actor: 'llm' })).toEqual({
            success: false,
            error: expect.stringContaining('not found'),
        })
    })

    test('appends a normalized entry and auto-assigns seq from the current length', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ transcript: '' })] } } })

        const res = mgr.appendTranscript('run1', { actor: 'tool', tool: 'agent_trace', result_digest: 'ok' })

        expect(res.success).toBe(true)
        expect(res.entry.seq).toBe(1)
        expect(res.entry.actor).toBe('tool')
        expect(res.entry.tool).toBe('agent_trace')
        expect(res.count).toBe(1)

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored).toHaveLength(1)
        expect(stored[0].tool).toBe('agent_trace')
    })

    test('writes AFTER EVERY call — the transcript grows by exactly one entry each time', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'llm' })
        mgr.appendTranscript('run1', { actor: 'tool' })
        mgr.appendTranscript('run1', { actor: 'system' })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored).toHaveLength(3)
        expect(stored.map((e) => e.seq)).toEqual([1, 2, 3])
    })

    test('an unrecognised or absent actor falls back to system', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'hacker' })
        mgr.appendTranscript('run1', {})

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].actor).toBe('system')
        expect(stored[1].actor).toBe('system')
    })

    test('args_digest/result_digest are digested to the 200-char ceiling', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })
        const long = 'x'.repeat(500)

        mgr.appendTranscript('run1', { actor: 'tool', args_digest: long, result_digest: long })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].args_digest.length).toBeLessThan(250)
        expect(stored[0].args_digest).toContain('...[+')
        expect(stored[0].result_digest.length).toBeLessThan(250)
    })

    test('a short digest passes through unchanged (idempotent, not padded or altered)', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'tool', args_digest: 'short' })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].args_digest).toBe('short')
    })

    test('artifact_id is carried through untouched when present', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'tool', artifact_id: 'art1' })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].artifact_id).toBe('art1')
    })

    test('ts defaults to something non-empty when the caller does not supply one', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'llm' })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(typeof stored[0].ts).toBe('string')
        expect(stored[0].ts.length).toBeGreaterThan(0)
    })

    test('a caller-supplied ts is honored verbatim', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'llm', ts: '2026-08-02 12:00:00' })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].ts).toBe('2026-08-02 12:00:00')
    })

    test('a corrupted transcript field is treated as empty rather than crashing the append', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ transcript: '{not json' })] } } })

        expect(() => mgr.appendTranscript('run1', { actor: 'llm' })).not.toThrow()
        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored).toHaveLength(1)
    })
})

// ===========================================================================
// loadContext
// ===========================================================================

describe('loadContext', () => {
    test('returns the parsed transcript and the context_summary', () => {
        const transcript = JSON.stringify([{ seq: 1, actor: 'llm' }])
        const { mgr } = load({
            world: { rows: { [RUN_TABLE]: [seedRun({ transcript: transcript, context_summary: 'so far...' })] } },
        })

        const ctx = mgr.loadContext('run1')

        expect(ctx.transcript).toEqual([{ seq: 1, actor: 'llm' }])
        expect(ctx.context_summary).toBe('so far...')
    })

    test('a missing run degrades to empty rather than throwing', () => {
        const { mgr } = load({})
        expect(mgr.loadContext('nope')).toEqual({ transcript: [], context_summary: '' })
    })
})

// ===========================================================================
// maybeSummarize
// ===========================================================================

function entriesOf(n, withArtifacts) {
    const out = []
    for (let i = 1; i <= n; i++) {
        const e = { seq: i, actor: 'tool', tool: 'agent_trace', result_digest: 'r' + i }
        if (withArtifacts && i <= 3) e.artifact_id = 'artifact-' + i
        out.push(e)
    }
    return out
}

describe('maybeSummarize', () => {
    test('at or below the 10-entry threshold, nothing happens and summarize is never called', () => {
        const llm = fakeLlm([])
        const transcript = JSON.stringify(entriesOf(10))
        const { mgr } = load({
            llmProxy: llm,
            world: { rows: { [RUN_TABLE]: [seedRun({ transcript: transcript })] } },
        })

        const res = mgr.maybeSummarize('run1')

        expect(res.summarized).toBe(false)
        expect(llm.calls).toHaveLength(0)
    })

    test('11 entries: summarizes the 6 oldest, keeps the newest 5 verbatim, sets context_summary', () => {
        const llm = fakeLlm([{ success: true, text: 'compact summary' }])
        const transcript = JSON.stringify(entriesOf(11, true))
        const { mgr, world } = load({
            llmProxy: llm,
            world: { rows: { [RUN_TABLE]: [seedRun({ transcript: transcript })] } },
        })

        const res = mgr.maybeSummarize('run1')

        expect(res.summarized).toBe(true)
        expect(res.summarized_count).toBe(6)
        expect(res.kept_count).toBe(5)
        expect(llm.calls).toHaveLength(1)

        const row = world.tables[RUN_TABLE][0]
        expect(row.context_summary).toBe('compact summary')

        const remaining = JSON.parse(row.transcript)
        expect(remaining).toHaveLength(5)
        expect(remaining.map((e) => e.seq)).toEqual([7, 8, 9, 10, 11])
    })

    test('artifact ids from the summarized (oldest) entries are present in the summary input verbatim', () => {
        const llm = fakeLlm([{ success: true, text: 'summary' }])
        const transcript = JSON.stringify(entriesOf(11, true)) // artifacts on seq 1-3, all in the oldest 6
        const { mgr } = load({
            llmProxy: llm,
            world: { rows: { [RUN_TABLE]: [seedRun({ transcript: transcript })] } },
        })

        mgr.maybeSummarize('run1')

        const prompt = llm.calls[0]
        expect(prompt).toContain('artifact-1')
        expect(prompt).toContain('artifact-2')
        expect(prompt).toContain('artifact-3')
    })

    test('an existing context_summary is folded into the summarize prompt', () => {
        const llm = fakeLlm([{ success: true, text: 'new summary' }])
        const transcript = JSON.stringify(entriesOf(11))
        const { mgr } = load({
            llmProxy: llm,
            world: {
                rows: { [RUN_TABLE]: [seedRun({ transcript: transcript, context_summary: 'PRIOR_SUMMARY_MARKER' })] },
            },
        })

        mgr.maybeSummarize('run1')

        expect(llm.calls[0]).toContain('PRIOR_SUMMARY_MARKER')
    })

    test('summarize FAILURE leaves the transcript untouched and does not fail the run', () => {
        const llm = fakeLlm([{ success: false, error: 'llm down' }])
        const transcript = JSON.stringify(entriesOf(11))
        const { mgr, world } = load({
            llmProxy: llm,
            world: { rows: { [RUN_TABLE]: [seedRun({ transcript: transcript, status: 'running' })] } },
        })

        const res = mgr.maybeSummarize('run1')

        expect(res.summarized).toBe(false)
        expect(res.reason).toEqual(expect.stringContaining('llm down'))

        const row = world.tables[RUN_TABLE][0]
        expect(JSON.parse(row.transcript)).toHaveLength(11) // untouched
        expect(row.status).toBe('running') // NOT failed — summarization is an optimization
        expect(world.calls.updates).toHaveLength(0)
    })

    test('a missing run degrades cleanly rather than throwing', () => {
        const llm = fakeLlm([])
        const { mgr } = load({ llmProxy: llm })
        expect(() => mgr.maybeSummarize('nope')).not.toThrow()
        expect(mgr.maybeSummarize('nope').summarized).toBe(false)
    })
})

// ===========================================================================
// close — legal and illegal transitions
// ===========================================================================

describe('close', () => {
    const legal = [
        ['queued', 'complete'],
        ['queued', 'failed'],
        ['running', 'complete'],
        ['running', 'failed'],
    ]
    test.each(legal)('%s -> %s is legal', (from, to) => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ status: from })] } } })
        const res = mgr.close('run1', to, {})

        expect(res).toEqual({ success: true, run_id: 'run1', status: to })
        expect(world.tables[RUN_TABLE][0].status).toBe(to)
    })

    const illegal = [
        ['awaiting_confirmation', 'complete'],
        ['awaiting_confirmation', 'failed'],
        ['complete', 'complete'],
        ['complete', 'failed'],
        ['failed', 'complete'],
        ['queued', 'queued'],
        ['queued', 'running'],
        ['queued', 'awaiting_confirmation'],
        ['running', 'awaiting_confirmation'],
    ]
    test.each(illegal)('%s -> %s is illegal: returns {success:false} naming the transition, never throws', (from, to) => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ status: from })] } } })

        let res
        expect(() => {
            res = mgr.close('run1', to, {})
        }).not.toThrow()

        expect(res.success).toBe(false)
        expect(res.error).toContain(from)
        expect(res.error).toContain(to)
        // The row must not have been touched by a refused transition.
        expect(world.tables[RUN_TABLE][0].status).toBe(from)
    })

    test('stamps fix_report and error on a successful close', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] } } })

        mgr.close('run1', 'failed', { fixReport: { failure_summary: 'x' }, error: 'boom' })

        const row = world.tables[RUN_TABLE][0]
        expect(JSON.parse(row.fix_report)).toEqual({ failure_summary: 'x' })
        expect(row.error).toBe('boom')
    })

    test('run not found returns {success:false} rather than throwing', () => {
        const { mgr } = load({})
        expect(() => mgr.close('nope', 'complete', {})).not.toThrow()
        expect(mgr.close('nope', 'complete', {}).success).toBe(false)
    })

    test('a throwing update is contained without touching the exception (R-1)', () => {
        const hostile = {}
        Object.defineProperty(hostile, 'message', {
            get: function () {
                throw new Error('Illegal access to getter method getMessage')
            },
        })

        const { mgr } = load({
            world: { rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] }, throwOnUpdate: hostile },
        })

        let res
        expect(() => {
            res = mgr.close('run1', 'complete', {})
        }).not.toThrow()
        expect(res.success).toBe(false)
    })
})

// ===========================================================================
// collectBundle — the Evidence Bundle, NO LLM anywhere in the call path
// ===========================================================================

describe('collectBundle', () => {
    test('dispatches exactly once per collection tool', () => {
        const registry = fakeRegistry({})
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.collectBundle('run1')

        const names = registry.calls.map((c) => c.name).sort()
        expect(names).toEqual(['agent_config', 'agent_trace', 'genai_log', 'query_table', 'schema_lookup'])
    })

    test('organizes the result into layers 1-7, fanning agent_config across 2/3/7', () => {
        const registry = fakeRegistry({
            agent_trace: { success: true, data: { plan: 'header' } },
            agent_config: {
                success: true,
                data: { instructions: { text: 'do X' }, tools: [{ name: 't1' }], triggers: [{ name: 'tr1' }] },
            },
            schema_lookup: { success: true, data: { columns: [] } },
            query_table: { success: true, data: { rows: [] } },
            genai_log: { success: true, data: { calls: [] } },
        })
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')

        expect(res.success).toBe(true)
        const layers = res.data.layers
        expect(Object.keys(layers).map(Number).sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
        expect(layers[1].tool).toBe('agent_trace')
        expect(layers[1].data).toEqual({ plan: 'header' })
        expect(layers[2].name).toBe('Instructions')
        expect(layers[2].data).toEqual({ text: 'do X' })
        expect(layers[3].name).toBe('Tool definitions')
        expect(layers[3].data).toEqual([{ name: 't1' }])
        expect(layers[7].name).toBe('Trigger and wiring')
        expect(layers[7].data).toEqual([{ name: 'tr1' }])
        expect(layers[4].tool).toBe('schema_lookup')
        expect(layers[5].tool).toBe('query_table')
        expect(layers[6].tool).toBe('genai_log')
    })

    test('a DENIED read inside a tool result is reported as DENIED on the layer, not silently ok', () => {
        const registry = fakeRegistry({
            agent_trace: { success: true, data: { reads: { sn_aia_execution_plan: 'DENIED' } } },
        })
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')
        expect(res.data.layers[1].status).toBe('DENIED')
    })

    test('a tool that fails outright is reported, not ok', () => {
        const registry = fakeRegistry({
            genai_log: { success: false, error: 'boom' },
        })
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')
        expect(res.data.layers[6].status).toBe('error')
    })

    test('a healthy read is reported ok', () => {
        const registry = fakeRegistry({
            schema_lookup: { success: true, data: { reads: { sys_dictionary: 'ok' } } },
        })
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')
        expect(res.data.layers[4].status).toBe('ok')
    })

    test('works with NO LLM PROXY in the object graph at all — the LLM-free floor is structural', () => {
        // Deliberately no `llmProxy` option — PaRunManager must never touch
        // `this._llm()` anywhere inside collectBundle's call path.
        const registry = fakeRegistry({})
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')

        expect(res.success).toBe(true)
        expect(Object.keys(res.data.layers)).toHaveLength(7)
    })

    test('passes the run row execution_ref/agent through as dispatch args when present', () => {
        const registry = fakeRegistry({})
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun({ execution_ref: 'plan1', agent: 'agentX' })] } },
        })

        mgr.collectBundle('run1')

        const traceCall = registry.calls.filter((c) => c.name === 'agent_trace')[0]
        expect(traceCall.args.execution).toBe('plan1')
        expect(traceCall.args.agent).toBe('agentX')
        expect(traceCall.runCtx.run_id).toBe('run1')
    })

    test('a run with no execution_ref/agent still runs the bundle with empty args (R-9)', () => {
        const registry = fakeRegistry({})
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        expect(() => mgr.collectBundle('run1')).not.toThrow()
        const traceCall = registry.calls.filter((c) => c.name === 'agent_trace')[0]
        expect(traceCall.args.execution).toBeUndefined()
    })
})

// ===========================================================================
// sweepStaleNative — the §D5 close-out
// ===========================================================================

describe('sweepStaleNative', () => {
    const NOW = new Date('2026-08-02T12:00:00Z')
    function now() {
        return NOW
    }

    test('closes a native running run older than maxAgeHours with no audit rows at all', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({
                            sys_id: 'stale1',
                            harness: 'native',
                            status: 'running',
                            sys_created_on: '2026-07-31 00:00:00', // 36h old
                        }),
                    ],
                },
            },
        })

        const res = mgr.sweepStaleNative({ maxAgeHours: 24 })

        expect(res.closed).toEqual(['stale1'])
        expect(world.tables[RUN_TABLE][0].status).toBe('complete')
    })

    test('appends the EXACT R-20 citation transcript entry on every run it closes', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'stale1', harness: 'native', status: 'running', sys_created_on: '2026-07-31 00:00:00' }),
                    ],
                },
            },
        })

        mgr.sweepStaleNative({ maxAgeHours: 24 })

        const transcript = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        const systemEntry = transcript.filter((e) => e.actor === 'system')[0]
        expect(systemEntry.result_digest).toBe(
            'stale-closed by lifecycle sweep; completeness remains audit-derived (R-20)'
        )
    })

    test('does NOT close a native run that has a RECENT audit row, even if the run itself is old', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'active1', harness: 'native', status: 'running', sys_created_on: '2026-07-31 00:00:00' }),
                    ],
                    [AUDIT_TABLE]: [{ sys_id: 'aud1', run: 'active1', sys_created_on: '2026-08-02 10:00:00' }],
                },
            },
        })

        const res = mgr.sweepStaleNative({ maxAgeHours: 24 })

        expect(res.closed).toEqual([])
        expect(world.tables[RUN_TABLE][0].status).toBe('running')
    })

    test('DOES close a native run whose only audit rows are also stale', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'stale2', harness: 'native', status: 'running', sys_created_on: '2026-07-30 00:00:00' }),
                    ],
                    [AUDIT_TABLE]: [{ sys_id: 'aud1', run: 'stale2', sys_created_on: '2026-07-30 01:00:00' }],
                },
            },
        })

        const res = mgr.sweepStaleNative({ maxAgeHours: 24 })
        expect(res.closed).toEqual(['stale2'])
    })

    test('does not close a run younger than maxAgeHours', () => {
        const { mgr } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'young1', harness: 'native', status: 'running', sys_created_on: '2026-08-02 00:00:00' }),
                    ],
                },
            },
        })

        expect(mgr.sweepStaleNative({ maxAgeHours: 24 }).closed).toEqual([])
    })

    test('never closes a CUSTOM harness run, however old and idle', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'custom1', harness: 'custom', status: 'running', sys_created_on: '2026-07-01 00:00:00' }),
                    ],
                },
            },
        })

        expect(mgr.sweepStaleNative({ maxAgeHours: 24 }).closed).toEqual([])
        expect(world.tables[RUN_TABLE][0].status).toBe('running')
    })

    test('never closes an awaiting_confirmation run — it never expires and is not closeable by the sweep', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({
                            sys_id: 'wait1',
                            harness: 'native',
                            status: 'awaiting_confirmation',
                            sys_created_on: '2026-01-01 00:00:00', // very old
                        }),
                    ],
                },
            },
        })

        expect(mgr.sweepStaleNative({ maxAgeHours: 24 }).closed).toEqual([])
        expect(world.tables[RUN_TABLE][0].status).toBe('awaiting_confirmation')
    })

    test('never closes a run that is already complete or failed', () => {
        const { mgr } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'done1', harness: 'native', status: 'complete', sys_created_on: '2026-01-01 00:00:00' }),
                        seedRun({ sys_id: 'done2', harness: 'native', status: 'failed', sys_created_on: '2026-01-01 00:00:00' }),
                    ],
                },
            },
        })

        expect(mgr.sweepStaleNative({ maxAgeHours: 24 }).closed).toEqual([])
    })

    test('defaults maxAgeHours to 24 when not supplied', () => {
        const { mgr } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        // 25h old — stale under the 24h default
                        seedRun({ sys_id: 'stale3', harness: 'native', status: 'running', sys_created_on: '2026-08-01 11:00:00' }),
                    ],
                },
            },
        })

        expect(mgr.sweepStaleNative({}).closed).toEqual(['stale3'])
    })

    test('closes multiple eligible runs in one pass', () => {
        const { mgr } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'stale4', harness: 'native', status: 'running', sys_created_on: '2026-07-01 00:00:00' }),
                        seedRun({ sys_id: 'stale5', harness: 'native', status: 'running', sys_created_on: '2026-07-01 00:00:00' }),
                    ],
                },
            },
        })

        expect(mgr.sweepStaleNative({ maxAgeHours: 24 }).closed.sort()).toEqual(['stale4', 'stale5'])
    })

    test('no GlideRecord in the runtime degrades to an empty sweep instead of throwing', () => {
        const { mgr } = load({ noGlide: true, now: now })
        expect(() => mgr.sweepStaleNative({})).not.toThrow()
        expect(mgr.sweepStaleNative({})).toEqual({ closed: [] })
    })
})
