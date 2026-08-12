/**
 * PaRestHandlers — pure-logic tests (Phase 1b Task 7, LOW_LEVEL_DESIGN.md
 * §4.8 wiring, docs/superpowers/plans/2026-08-02-phase1b-harness.md Task 7).
 *
 * WHAT THIS COMPONENT IS
 * The REST-route business logic behind `/analyze`, `/runs/{run_id}`,
 * `/runs/{run_id}/message`, `/status` and `/tools`. Every method is a plain
 * function taking `{body, pathParams, userId}` and returning `{status, body}`
 * — the Fluent route script is a one-line adapter that builds `ctx` from
 * `request`/`gs.getUserID()` and writes `result.status`/`result.body` onto
 * `response`. That shape is what makes this file testable with ZERO Glide:
 * every collaborator (PaRunManager, PaToolRegistry, PaLlmProxy, the run
 * reader, the event-queue seam, the `/status` check list) is injected, and
 * the default (Glide-touching) implementations are never reached because a
 * test always supplies its own.
 *
 * WHAT THESE TESTS COVER (Task 7 brief, Step 1)
 *   - /analyze validation matrix: each missing-input case names the missing
 *     field; `mode:"collect"` runs the bundle synchronously and returns it
 *     inline; the default (diagnose) path creates a run and returns 202 +
 *     queued, having queued the async worker.
 *   - owner gate: a non-owner and a nonexistent run return the BYTE-IDENTICAL
 *     404 (same status, same body) — no existence oracle.
 *   - /runs/{id}/message: 409 naming the status on any non-complete run.
 *   - /status: aggregates injected check results; top-level `ready` is false
 *     when ANY check fails (R-19b — the status is what a consumer gates on).
 *   - /tools: passes PaToolRegistry.list() through.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')

function load(options) {
    const ctx = loadScriptInclude('rest/PaRestHandlers.js', { JSON: JSON })
    return { handlers: new ctx.PaRestHandlers(options), ctx: ctx }
}

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function fakeRunManager(overrides) {
    const calls = { createRun: [], collectBundle: [], close: [], appendTranscript: [] }
    return Object.assign(
        {
            calls: calls,
            createRun: function (params) {
                calls.createRun.push(params)
                return { run_id: 'run1', number: 'TR0001042' }
            },
            collectBundle: function (runId) {
                calls.collectBundle.push(runId)
                return { success: true, data: { layers: { 1: { name: 'Execution trace', status: 'ok', data: {} } } } }
            },
            close: function (runId, status, options) {
                calls.close.push({ runId: runId, status: status, options: options })
                return { success: true, run_id: runId, status: status }
            },
            appendTranscript: function (runId, entry) {
                calls.appendTranscript.push({ runId: runId, entry: entry })
                return { success: true, entry: entry, count: 1 }
            },
        },
        overrides
    )
}

function fakeToolRegistry(list) {
    return {
        list: function () {
            return list || [{ name: 'agent_trace', layer: 'layer 1', description: 'x', readOnly: true }]
        },
    }
}

function fakeLlm(reasonResult) {
    const calls = []
    return {
        calls: calls,
        reason: function (prompt) {
            calls.push(prompt)
            return reasonResult === undefined
                ? { success: true, action: { action: 'answer', text: 'ok' }, raw: '{"action":"answer","text":"ok"}' }
                : reasonResult
        },
    }
}

function fakeReadRun(row) {
    return function (runId) {
        if (!row) return null
        if (typeof row === 'function') return row(runId)
        return row
    }
}

// ===========================================================================
// /analyze — validation matrix
// ===========================================================================

describe('analyze — validation', () => {
    test('nothing supplied — names the missing combination', () => {
        const { handlers } = load({ runManager: fakeRunManager() })
        const res = handlers.analyze({ body: {}, pathParams: {}, userId: 'u1' })
        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/execution.*agent.*timeframe.*logs/i)
    })

    test('a rejected body creates no run, so nothing is persisted', () => {
        const runManager = fakeRunManager()
        const { handlers } = load({ runManager: runManager, eventQueue: () => true })

        const res = handlers.analyze({ body: { agent: 'Agent Doctor' }, pathParams: {}, userId: 'u1' })

        expect(res.status).toBe(400)
        expect(runManager.calls.createRun.length).toBe(0)
    })

    test('agent without timeframe — names timeframe', () => {
        const { handlers } = load({ runManager: fakeRunManager() })
        const res = handlers.analyze({ body: { agent: 'Agent Doctor' }, pathParams: {}, userId: 'u1' })
        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/timeframe/i)
    })

    test('timeframe without agent — names agent', () => {
        const { handlers } = load({ runManager: fakeRunManager() })
        const res = handlers.analyze({ body: { timeframe: 'last 24h' }, pathParams: {}, userId: 'u1' })
        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/agent/i)
    })

    test('unknown mode value is rejected by name', () => {
        const { handlers } = load({ runManager: fakeRunManager() })
        const res = handlers.analyze({ body: { logs: 'boom', mode: 'yolo' }, pathParams: {}, userId: 'u1' })
        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/mode/i)
    })

    test('execution alone is sufficient', () => {
        const runManager = fakeRunManager()
        const { handlers } = load({ runManager: runManager, eventQueue: () => true })
        const res = handlers.analyze({ body: { execution: 'plan1' }, pathParams: {}, userId: 'u1' })
        expect(res.status).toBe(202)
        expect(runManager.calls.createRun[0].executionRef).toBe('plan1')
    })

    test('logs alone is sufficient', () => {
        const { handlers } = load({ runManager: fakeRunManager(), eventQueue: () => true })
        const res = handlers.analyze({ body: { logs: 'stack trace here' }, pathParams: {}, userId: 'u1' })
        expect(res.status).toBe(202)
    })

    test('agent+timeframe together is sufficient', () => {
        const runManager = fakeRunManager()
        const { handlers } = load({ runManager: runManager, eventQueue: () => true })
        const res = handlers.analyze({
            body: { agent: 'Agent Doctor', timeframe: 'last 24h' },
            pathParams: {},
            userId: 'u1',
        })
        expect(res.status).toBe(202)
        expect(runManager.calls.createRun[0].agent).toBe('Agent Doctor')
    })
})

// ===========================================================================
// /analyze — collect vs diagnose
// ===========================================================================

describe('analyze — collect mode', () => {
    test('runs the bundle synchronously, closes the run, and returns it inline — no event queued', () => {
        const runManager = fakeRunManager()
        let eventQueueCalled = false
        const { handlers } = load({
            runManager: runManager,
            eventQueue: function () {
                eventQueueCalled = true
                return true
            },
        })

        const res = handlers.analyze({ body: { execution: 'plan1', mode: 'collect' }, pathParams: {}, userId: 'u1' })

        expect(res.status).toBe(200)
        expect(res.body.run_id).toBe('run1')
        expect(res.body.mode).toBe('collect')
        expect(res.body.data.layers['1'].name).toBe('Execution trace')
        expect(runManager.calls.collectBundle).toEqual(['run1'])
        expect(runManager.calls.close[0]).toEqual({ runId: 'run1', status: 'complete', options: {} })
        expect(eventQueueCalled).toBe(false)
    })

    test("collect mode surfaces createRun's note on the 200 — the same gap as the 202 path (#105)", () => {
        const runManager = fakeRunManager({
            createRun: function () {
                return { run_id: 'run1', number: 'TR0001042', note: 'status could not be forced to queued' }
            },
        })
        const { handlers } = load({ runManager: runManager, eventQueue: () => true })

        const res = handlers.analyze({
            body: { execution: 'plan1', mode: 'collect' },
            pathParams: {},
            userId: 'u1',
        })

        expect(res.status).toBe(200)
        expect(res.body.note).toBe('status could not be forced to queued')
    })

    test('collect mode records its request too — it never queues, so nothing downstream would (#99)', () => {
        const runManager = fakeRunManager()
        const { handlers } = load({ runManager: runManager, eventQueue: () => true })

        handlers.analyze({
            body: { execution: 'plan1', mode: 'collect' },
            pathParams: {},
            userId: 'u1',
        })

        expect(runManager.calls.createRun[0].request).toEqual({
            execution: 'plan1',
            mode: 'collect',
        })
    })
})

describe('analyze — diagnose mode (default)', () => {
    test('the validated body reaches createRun so the run records its own subject (#99)', () => {
        const runManager = fakeRunManager()
        const { handlers } = load({ runManager: runManager, eventQueue: () => true })

        handlers.analyze({
            body: { execution: 'plan1', timeframe: '1 hour' },
            pathParams: {},
            userId: 'u1',
        })

        expect(runManager.calls.createRun[0].request).toEqual({
            execution: 'plan1',
            timeframe: '1 hour',
        })
    })

    test('creates the run, queues the async worker, and returns 202 + queued', () => {
        const runManager = fakeRunManager()
        const queued = []
        const { handlers } = load({
            runManager: runManager,
            eventQueue: function (runId, requestJson) {
                queued.push({ runId: runId, requestJson: requestJson })
                return true
            },
        })

        const res = handlers.analyze({ body: { execution: 'plan1' }, pathParams: {}, userId: 'u1' })

        expect(res).toEqual({ status: 202, body: { run_id: 'run1', status: 'queued' } })
        expect(runManager.calls.collectBundle).toEqual([])
        expect(queued).toHaveLength(1)
        expect(queued[0].runId).toBe('run1')
        expect(JSON.parse(queued[0].requestJson)).toEqual({ execution: 'plan1' })
    })

    test("createRun's note reaches the 202 caller — R-19b is not honoured only to be dropped a layer up (#105)", () => {
        // createRun writes this note when the creation row exists but the write
        // that forces `queued` failed — so the row may read `running`, and
        // since #99 the inbound request was not persisted either. Answering a
        // bare `status: 'queued'` here hands the caller a claim the row
        // contradicts, which is the exact thing the note exists to prevent.
        const note =
            'The run record was created but its status could not be forced to queued — ' +
            'it may still read as running until the next successful write. The run_id is real ' +
            'and usable regardless. The inbound request was not persisted either, for the same reason.'
        const runManager = fakeRunManager({
            createRun: function () {
                return { run_id: 'run1', number: 'TR0001042', note: note }
            },
        })
        const { handlers } = load({ runManager: runManager, eventQueue: () => true })

        const res = handlers.analyze({ body: { execution: 'plan1' }, pathParams: {}, userId: 'u1' })

        expect(res.status).toBe(202)
        expect(res.body.run_id).toBe('run1')
        expect(res.body.note).toBe(note)
    })

    test('a clean creation carries NO note key — the field marks trouble, so its presence must mean something (#105)', () => {
        const runManager = fakeRunManager()
        const { handlers } = load({ runManager: runManager, eventQueue: () => true })

        const res = handlers.analyze({ body: { execution: 'plan1' }, pathParams: {}, userId: 'u1' })

        expect(Object.prototype.hasOwnProperty.call(res.body, 'note')).toBe(false)
    })

    test('run creation failure surfaces as a 500 naming the degraded reason', () => {
        const runManager = fakeRunManager({
            createRun: function () {
                return { run_id: null, number: '', degraded: 'anchor_unavailable' }
            },
        })
        const { handlers } = load({ runManager: runManager, eventQueue: () => true })

        const res = handlers.analyze({ body: { execution: 'plan1' }, pathParams: {}, userId: 'u1' })

        expect(res.status).toBe(500)
        expect(res.body.error).toMatch(/anchor_unavailable/)
    })

    test('event-queue failure surfaces as a 500 naming the run', () => {
        const runManager = fakeRunManager()
        const { handlers } = load({ runManager: runManager, eventQueue: () => false })

        const res = handlers.analyze({ body: { execution: 'plan1' }, pathParams: {}, userId: 'u1' })

        expect(res.status).toBe(500)
        expect(res.body.error).toMatch(/run1/)
    })
})

// ===========================================================================
// /runs/{run_id} — owner gate
// ===========================================================================

describe('getRun — owner gate', () => {
    test('nonexistent run returns 404', () => {
        const { handlers } = load({ readRun: fakeReadRun(null) })
        const res = handlers.getRun({ pathParams: { run_id: 'ghost' }, userId: 'u1' })
        expect(res.status).toBe(404)
    })

    test('a run owned by a different user returns the BYTE-IDENTICAL 404 as a nonexistent run', () => {
        const { handlers: nonexistentHandlers } = load({ readRun: fakeReadRun(null) })
        const nonexistent = nonexistentHandlers.getRun({ pathParams: { run_id: 'ghost' }, userId: 'u1' })

        const { handlers: foreignHandlers } = load({
            readRun: fakeReadRun({
                run_id: 'run1',
                number: 'TR0001042',
                user: 'someone-else',
                status: 'complete',
                mode: 'diagnose',
                transcript: [],
                context_summary: '',
                fix_report: '{}',
                error: '',
            }),
        })
        const foreign = foreignHandlers.getRun({ pathParams: { run_id: 'run1' }, userId: 'u1' })

        expect(foreign).toEqual(nonexistent)
        expect(foreign.status).toBe(404)
    })

    test('a run with no recorded owner is refused, not matched against an empty caller id', () => {
        const { handlers } = load({
            readRun: fakeReadRun({
                run_id: 'run1',
                number: 'TR0001042',
                user: '',
                status: 'complete',
                mode: 'diagnose',
                transcript: [],
                context_summary: '',
                fix_report: '{}',
                error: '',
            }),
        })
        const res = handlers.getRun({ pathParams: { run_id: 'run1' }, userId: '' })
        expect(res.status).toBe(404)
    })

    test('the owner reads status, transcript and fix_report when complete', () => {
        const { handlers } = load({
            readRun: fakeReadRun({
                run_id: 'run1',
                number: 'TR0001042',
                user: 'u1',
                status: 'complete',
                mode: 'diagnose',
                transcript: [{ seq: 1, actor: 'llm' }],
                context_summary: 'summary text',
                fix_report: '{"failure_summary":"x"}',
                error: '',
            }),
        })

        const res = handlers.getRun({ pathParams: { run_id: 'run1' }, userId: 'u1' })

        expect(res.status).toBe(200)
        expect(res.body.run_id).toBe('run1')
        expect(res.body.status).toBe('complete')
        expect(res.body.transcript).toEqual([{ seq: 1, actor: 'llm' }])
        expect(res.body.fix_report).toEqual({ failure_summary: 'x' })
    })

    test('a running (non-complete) run reports status without a fix_report', () => {
        const { handlers } = load({
            readRun: fakeReadRun({
                run_id: 'run1',
                number: 'TR0001042',
                user: 'u1',
                status: 'running',
                mode: 'diagnose',
                transcript: [],
                context_summary: '',
                fix_report: '',
                error: '',
            }),
        })

        const res = handlers.getRun({ pathParams: { run_id: 'run1' }, userId: 'u1' })

        expect(res.status).toBe(200)
        expect(res.body.status).toBe('running')
        expect(res.body.fix_report).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// #78 side-defect — a rejected draft must not be invisible
// ---------------------------------------------------------------------------

describe('getRun fix_report_rejected', () => {
    const DRAFT = '{"failure_summary":"trigger inactive","root_causes":[{"layer":"layer 7"}]}'

    function runRow(overrides) {
        return Object.assign(
            {
                run_id: 'run1',
                number: 'TR0001042',
                user: 'u1',
                status: 'failed',
                mode: 'diagnose',
                transcript: [],
                context_summary: '',
                fix_report: DRAFT,
                error: 'fix_report failed validation and could not be repaired: no trace citation found',
            },
            overrides
        )
    }

    function getRunFor(overrides) {
        const { handlers } = load({ readRun: fakeReadRun(runRow(overrides)) })
        return handlers.getRun({ pathParams: { run_id: 'run1' }, userId: 'u1' })
    }

    test('a failed run exposes the rejected draft and the problems', () => {
        const res = getRunFor({})

        expect(res.status).toBe(200)
        expect(res.body.fix_report_rejected.report.failure_summary).toBe('trigger inactive')
        expect(res.body.fix_report_rejected.problems.indexOf('no trace citation found')).not.toBe(-1)
    })

    test('fix_report stays null on a failed run — it means "passed validation"', () => {
        const res = getRunFor({})

        expect(res.body.fix_report).toBeNull()
    })

    test('a complete run carries no rejected draft', () => {
        const res = getRunFor({ status: 'complete', error: '' })

        expect(res.body.fix_report).not.toBeNull()
        expect(res.body.fix_report_rejected).toBeUndefined()
    })

    test('a failed run with no stored draft carries no rejected field', () => {
        const res = getRunFor({ fix_report: '', error: 'llm unavailable' })

        expect(res.body.fix_report_rejected).toBeUndefined()
    })

    test('an unparseable stored draft does not produce a half-built field', () => {
        const res = getRunFor({ fix_report: 'not json at all' })

        expect(res.body.fix_report_rejected).toBeUndefined()
    })
})

// ===========================================================================
// getRun — the persisted request (#99)
// ===========================================================================

describe('getRun request', () => {
    function runRow(overrides) {
        return Object.assign(
            {
                run_id: 'run1',
                number: 'TR0001042',
                user: 'u1',
                status: 'complete',
                mode: 'diagnose',
                transcript: [],
                context_summary: '',
                fix_report: '{}',
                error: '',
                request: '{"execution":"plan1","timeframe":"1 hour"}',
                request_truncated: false,
            },
            overrides
        )
    }

    function getRunFor(overrides) {
        const { handlers } = load({ readRun: fakeReadRun(runRow(overrides)) })
        return handlers.getRun({ pathParams: { run_id: 'run1' }, userId: 'u1' })
    }

    test('a whole request comes back parsed, so a consumer reads the run subject directly', () => {
        const res = getRunFor({})

        expect(res.status).toBe(200)
        expect(res.body.request).toEqual({ execution: 'plan1', timeframe: '1 hour' })
        expect(res.body.request_truncated).toBe(false)
    })

    test('a truncated request comes back as the RAW prefix, never as a half-parsed object', () => {
        const res = getRunFor({ request: '{"logs":"xxxxx', request_truncated: true })

        expect(res.body.request).toBe('{"logs":"xxxxx')
        expect(res.body.request_truncated).toBe(true)
    })

    test('an absent request is null, and the flag is still a boolean', () => {
        const res = getRunFor({ request: '', request_truncated: false })

        expect(res.body.request).toBeNull()
        expect(res.body.request_truncated).toBe(false)
    })

    test('an unparseable stored request is returned raw rather than dropped', () => {
        const res = getRunFor({ request: 'not json at all' })

        expect(res.body.request).toBe('not json at all')
    })

    test('a row from before this column existed does not produce undefined fields', () => {
        const { handlers } = load({
            readRun: fakeReadRun({
                run_id: 'run1',
                number: 'TR0001042',
                user: 'u1',
                status: 'complete',
                mode: 'diagnose',
                transcript: [],
                context_summary: '',
                fix_report: '{}',
                error: '',
            }),
        })

        const res = handlers.getRun({ pathParams: { run_id: 'run1' }, userId: 'u1' })

        expect(res.body.request).toBeNull()
        expect(res.body.request_truncated).toBe(false)
    })
})

// ===========================================================================
// _toBool — the platform's boolean getValue contract (#99)
// ===========================================================================

describe('_toBool', () => {
    test("ServiceNow's '0'/'1' getValue strings map to real booleans", () => {
        const { handlers } = load()

        expect(handlers._toBool('1')).toBe(true)
        expect(handlers._toBool('0')).toBe(false)
    })

    test("'true'/'false' strings and real booleans map too", () => {
        const { handlers } = load()

        expect(handlers._toBool('true')).toBe(true)
        expect(handlers._toBool('false')).toBe(false)
        expect(handlers._toBool(true)).toBe(true)
        expect(handlers._toBool(false)).toBe(false)
    })

    test('absent, empty and junk are all false, never undefined', () => {
        const { handlers } = load()

        expect(handlers._toBool(undefined)).toBe(false)
        expect(handlers._toBool(null)).toBe(false)
        expect(handlers._toBool('')).toBe(false)
        expect(handlers._toBool('yes')).toBe(false)
    })
})

// ===========================================================================
// /runs/{run_id}/message
// ===========================================================================

describe('message', () => {
    function completeRun(overrides) {
        return Object.assign(
            {
                run_id: 'run1',
                number: 'TR0001042',
                user: 'u1',
                status: 'complete',
                mode: 'diagnose',
                transcript: [],
                context_summary: 'earlier context',
                fix_report: '{"failure_summary":"x"}',
                error: '',
            },
            overrides
        )
    }

    test('a non-owner or nonexistent run gets the same 404 as getRun', () => {
        const { handlers } = load({ readRun: fakeReadRun(null) })
        const res = handlers.message({ pathParams: { run_id: 'ghost' }, body: { message: 'hi' }, userId: 'u1' })
        expect(res.status).toBe(404)
    })

    test.each(['queued', 'running', 'awaiting_confirmation', 'failed'])(
        'status %s returns 409 naming the status',
        (status) => {
            const { handlers } = load({ readRun: fakeReadRun(completeRun({ status: status })) })
            const res = handlers.message({ pathParams: { run_id: 'run1' }, body: { message: 'hi' }, userId: 'u1' })
            expect(res.status).toBe(409)
            expect(res.body.error).toContain(status)
        }
    )

    test('missing message body names the field', () => {
        const { handlers } = load({ readRun: fakeReadRun(completeRun()) })
        const res = handlers.message({ pathParams: { run_id: 'run1' }, body: {}, userId: 'u1' })
        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/message/i)
    })

    test('a complete run gets a synchronous single-turn reply via reason()', () => {
        const llm = fakeLlm({ success: true, action: { action: 'answer', text: 'The trigger never fired.' }, raw: 'x' })
        const runManager = fakeRunManager()
        const { handlers } = load({ readRun: fakeReadRun(completeRun()), llmProxy: llm, runManager: runManager })

        const res = handlers.message({
            pathParams: { run_id: 'run1' },
            body: { message: 'why did it fail?' },
            userId: 'u1',
        })

        expect(res.status).toBe(200)
        expect(res.body.reply).toBe('The trigger never fired.')
        expect(llm.calls[0]).toContain('why did it fail?')
        expect(runManager.calls.appendTranscript.length).toBeGreaterThan(0)
    })

    test('an LLM failure surfaces as a 502 with the error', () => {
        const llm = fakeLlm({ success: false, error: 'LLM invocation failed: boom', raw: null })
        const { handlers } = load({ readRun: fakeReadRun(completeRun()), llmProxy: llm })

        const res = handlers.message({ pathParams: { run_id: 'run1' }, body: { message: 'hi' }, userId: 'u1' })

        expect(res.status).toBe(502)
        expect(res.body.error).toMatch(/boom/)
    })
})

// ===========================================================================
// /status — aggregation
// ===========================================================================

describe('status', () => {
    function check(name, status, detail) {
        return { name: name, run: () => ({ status: status, detail: detail === undefined ? null : detail }) }
    }

    test('ready is true when every check is ok', () => {
        const { handlers } = load({
            checks: [check('plugins', 'ok'), check('skills', 'ok'), check('micro_invocation', 'ok')],
        })
        const res = handlers.status({})
        expect(res.status).toBe(200)
        expect(res.body.ready).toBe(true)
        expect(res.body.checks).toEqual([
            { check: 'plugins', status: 'ok', detail: null },
            { check: 'skills', status: 'ok', detail: null },
            // #74 — micro_invocation reflects the CALLER's privileges, so it
            // is flagged and excluded from `ready`. See the caller-dependent
            // describe block below.
            { check: 'micro_invocation', status: 'ok', detail: null, caller_dependent: true },
        ])
    })

    test('ready is false when ANY check fails, and every check result is still reported', () => {
        const { handlers } = load({
            checks: [check('plugins', 'ok'), check('skills', 'error', 'pa llm reason is inactive'), check('micro_invocation', 'ok')],
        })
        const res = handlers.status({})
        expect(res.body.ready).toBe(false)
        expect(res.body.checks).toHaveLength(3)
        expect(res.body.checks[1]).toEqual({ check: 'skills', status: 'error', detail: 'pa llm reason is inactive' })
    })

    test('a check that throws is reported as a failed check, not a crashed request', () => {
        const { handlers } = load({
            checks: [
                {
                    name: 'plugins',
                    run: () => {
                        throw new Error('boom')
                    },
                },
            ],
        })
        const res = handlers.status({})
        expect(res.status).toBe(200)
        expect(res.body.ready).toBe(false)
        expect(res.body.checks[0].check).toBe('plugins')
        expect(res.body.checks[0].status).toBe('error')
    })
})

// ===========================================================================
// /tools
// ===========================================================================

describe('tools', () => {
    test('passes PaToolRegistry.list() through', () => {
        const list = [
            { name: 'agent_trace', layer: 'layer 1', description: 'x', readOnly: true },
            { name: 'query_table', layer: 'layer 5', description: 'y', readOnly: true },
        ]
        const { handlers } = load({ toolRegistry: fakeToolRegistry(list) })
        const res = handlers.tools({})
        expect(res).toEqual({ status: 200, body: { tools: list } })
    })
})

// ===========================================================================
// emit() — issue #170
//
// The handlers return {status, body} and the Fluent route writes them onto
// `response`. That works for 2xx and SILENTLY LOSES the message on 4xx/5xx:
// measured live on gpinst01, `POST /analyze {"mode":"diagnose"}` surfaces as
// a bare `400 Bad Request` with no field named, while `_validateAnalyze` had
// correctly returned 'one of execution, agent+timeframe, or logs is required'.
//
// The cause is the ENVELOPE, not the handler. A ServiceNow error body is
// `{error:{message,detail},status:'failure'}`; ours is `{error:'<string>'}`,
// so a generic client reading `error.message` finds undefined and falls back
// to the HTTP reason phrase. Control run the same day: a native 400
// (`GET /api/now/table/x_nonexistent_table_xyz`) DOES surface its detail
// through the same transport, so the transport is not the culprit.
//
// `emit` is the one place that decides, so the five route scripts stay
// one-liners and this stays testable with zero Glide (Build Rule #43 also
// makes the Fluent template the wrong home for branching logic).
// ===========================================================================

function fakeResponse() {
    const calls = { status: [], contentType: [], body: [], error: [] }
    return {
        calls: calls,
        setStatus: function (s) { calls.status.push(s) },
        setContentType: function (c) { calls.contentType.push(c) },
        setBody: function (b) { calls.body.push(b) },
        setError: function (e) { calls.error.push(e) },
    }
}

// Minimal stand-in for the platform's sn_ws_err.ServiceError.
function fakeServiceErrorApi() {
    const built = []
    function ServiceError() {
        this._s = null; this._m = null; this._d = null
        built.push(this)
    }
    ServiceError.prototype.setStatus = function (s) { this._s = s }
    ServiceError.prototype.setMessage = function (m) { this._m = m }
    ServiceError.prototype.setDetail = function (d) { this._d = d }
    return { built: built, api: { ServiceError: ServiceError } }
}

describe('emit', () => {
    test('a 2xx result is written as status + JSON body, with no error envelope', () => {
        const { handlers } = load({})
        const res = fakeResponse()
        handlers.emit(res, { status: 200, body: { tools: [] } })
        expect(res.calls.status).toEqual([200])
        expect(res.calls.contentType).toEqual(['application/json'])
        expect(res.calls.body).toEqual([{ tools: [] }])
        expect(res.calls.error).toEqual([])
    })

    test('a 4xx result goes through setError so the message reaches the caller (#170)', () => {
        const se = fakeServiceErrorApi()
        const { handlers } = load({ serviceErrorApi: se.api })
        const res = fakeResponse()

        handlers.emit(res, {
            status: 400,
            body: { error: 'one of execution, agent+timeframe, or logs is required' },
        })

        expect(res.calls.error.length).toBe(1)
        expect(se.built.length).toBe(1)
        expect(se.built[0]._s).toBe(400)
        expect(se.built[0]._m).toBe('one of execution, agent+timeframe, or logs is required')
        // The bare setBody path must NOT also run — that is what produced the
        // empty body the issue reported.
        expect(res.calls.body).toEqual([])
    })

    test('a 5xx result uses the same envelope', () => {
        const se = fakeServiceErrorApi()
        const { handlers } = load({ serviceErrorApi: se.api })
        const res = fakeResponse()
        handlers.emit(res, { status: 500, body: { error: 'failed to create diagnostic run: unknown' } })
        expect(se.built[0]._s).toBe(500)
        expect(se.built[0]._m).toBe('failed to create diagnostic run: unknown')
    })

    test('falls back to status+body when the platform error API is absent', () => {
        // Never convict the caller of a platform gap: if sn_ws_err is not
        // reachable, the old behaviour is still better than throwing.
        const { handlers } = load({ serviceErrorApi: null })
        const res = fakeResponse()
        handlers.emit(res, { status: 400, body: { error: 'boom' } })
        expect(res.calls.status).toEqual([400])
        expect(res.calls.body).toEqual([{ error: 'boom' }])
        expect(res.calls.error).toEqual([])
    })

    test('an error body with no usable message still names its status', () => {
        const se = fakeServiceErrorApi()
        const { handlers } = load({ serviceErrorApi: se.api })
        const res = fakeResponse()
        handlers.emit(res, { status: 403, body: {} })
        expect(se.built[0]._s).toBe(403)
        expect(typeof se.built[0]._m).toBe('string')
        expect(se.built[0]._m.length).toBeGreaterThan(0)
    })

    test('a malformed result is emitted as a 500 rather than throwing', () => {
        const se = fakeServiceErrorApi()
        const { handlers } = load({ serviceErrorApi: se.api })
        const res = fakeResponse()
        handlers.emit(res, null)
        expect(se.built[0]._s).toBe(500)
    })
})

// ===========================================================================
// message transcript attribution — issue #74
//
// The caller's own turn was labelled `actor:'llm'`, putting words in the
// model's mouth in the one artefact this tool exists to make trustworthy.
// 'user' also had to be added to PaRunManager.ACTORS — an unknown actor
// normalises to 'system' rather than erroring, so fixing only the call site
// would have swapped one wrong label for another, silently.
// ===========================================================================

describe('message transcript attribution (#74)', () => {
    const completeRun = {
        run_id: 'run1',
        number: 'TR0001042',
        user: 'u1',
        status: 'complete',
        mode: 'diagnose',
        transcript: [],
        context_summary: 'earlier context',
        fix_report: '{"failure_summary":"x"}',
        error: '',
    }

    test("the caller's turn is actor:'user' and the reply is actor:'llm'", () => {
        const runs = fakeRunManager()
        const { handlers } = load({
            runManager: runs,
            readRun: fakeReadRun(completeRun),
            llmProxy: fakeLlm({ success: true, action: { action: 'answer', text: 'because layer 3' }, raw: 'raw' }),
        })

        const res = handlers.message({ body: { message: 'why?' }, pathParams: { run_id: 'run1' }, userId: 'u1' })

        expect(res.status).toBe(200)
        const actors = runs.calls.appendTranscript.map((c) => c.entry.actor)
        expect(actors).toEqual(['user', 'llm'])

        const userTurn = runs.calls.appendTranscript[0].entry
        expect(userTurn.args_digest).toMatch(/why\?/)
    })
})

// ===========================================================================
// /status — caller-dependent checks (issue #74, R-19b)
//
// `micro_invocation` makes a live PaLlmProxy.reason() call, which requires
// privileges a non-admin caller does not have. It therefore fails FOR THE
// CALLER on a perfectly healthy system, and it was flipping the top-level
// `ready` to false — exactly the thing R-19b forbids: a caller-dependent
// probe standing in for a system-wide health signal.
//
// The check still runs and is still reported (it is the only check that
// proves a call completes end to end); it just no longer claims to speak for
// the system.
// ===========================================================================

describe('/status caller-dependent checks (#74)', () => {
    function check(name, status) {
        return { name: name, run: () => ({ status: status, detail: null }) }
    }

    test('a failing micro_invocation is reported but does NOT set ready:false', () => {
        const { handlers } = load({
            checks: [check('plugins', 'ok'), check('micro_invocation', 'error'), check('stuck_runs', 'ok')],
        })
        const res = handlers.status()

        expect(res.body.ready).toBe(true)
        const micro = res.body.checks.filter((c) => c.check === 'micro_invocation')[0]
        expect(micro.status).toBe('error')
        expect(micro.caller_dependent).toBe(true)
    })

    test('any NON-caller-dependent failure still sets ready:false', () => {
        const { handlers } = load({
            checks: [check('plugins', 'error'), check('micro_invocation', 'ok')],
        })
        expect(handlers.status().body.ready).toBe(false)
    })

    test('an all-ok system is ready, and caller-dependent checks are still flagged', () => {
        const { handlers } = load({
            checks: [check('plugins', 'ok'), check('micro_invocation', 'ok')],
        })
        const res = handlers.status()
        expect(res.body.ready).toBe(true)
        expect(res.body.checks.filter((c) => c.check === 'micro_invocation')[0].caller_dependent).toBe(true)
    })

    test('the response explains why ready can be true alongside a failing check', () => {
        const { handlers } = load({ checks: [check('micro_invocation', 'error')] })
        const note = handlers.status().body.caller_dependent_note

        expect(typeof note).toBe('string')
        expect(note).toMatch(/privilege|caller/i)
    })

    test('the note is absent when no caller-dependent check failed', () => {
        const { handlers } = load({ checks: [check('micro_invocation', 'ok'), check('plugins', 'ok')] })
        expect(handlers.status().body.caller_dependent_note).toBeUndefined()
    })

    test('a system-wide check carries no caller_dependent flag at all', () => {
        const { handlers } = load({ checks: [check('plugins', 'ok')] })
        expect(handlers.status().body.checks[0].caller_dependent).toBeUndefined()
    })
})
