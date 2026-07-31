/**
 * PaScriptToolAdapter — pure-logic tests (IMPLEMENTATION_PLAN.md Task 9, LLD §4.7).
 *
 * The adapter is the only thing standing between a tool core and the native
 * orchestrator, and the orchestrator handles a thrown exception badly. So the
 * property under test throughout is containment: whatever goes in, a String
 * comes out.
 *
 * The single most important case here is the bare-string pass-through. LLD §4.7
 * Note 4: wrapping a bare string as {value: s} yields an args object with none
 * of the keys the cores read, so PaToolAgentTrace falls through to its
 * recent-plan pick-list and SILENTLY DISCARDS the caller's request. No error
 * anywhere. The test asserts on the argument execute() actually received.
 *
 * WHAT THESE DO NOT SETTLE: that the adapter resolves real Script Includes from
 * rhino.global on the instance (DESIGN.md R-8). That is a gpinst01 check — Task 5.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')

const SYS_ID = 'c9d63a932bda8b9417a6ffbeee91bfd0'

/** A tool core that records the args it was handed. */
function fakeCore(opts) {
    const o = opts || {}
    const calls = []
    return {
        calls: calls,
        PAGED_OUTPUT: o.paged === true,
        execute: function (args) {
            calls.push(args)
            if (o.throws) throw o.throws
            return o.result === undefined ? { success: true, data: { ok: 1 } } : o.result
        },
    }
}

function fakeAnchor(run) {
    const calls = []
    return {
        calls: calls,
        getOrCreate: function (ctx) {
            calls.push(ctx)
            return run === undefined ? { run_id: 'run1', number: 'TR0001000001', keyed: true } : run
        },
    }
}

function fakeAudit(opts) {
    const o = opts || {}
    const calls = []
    function record(kind) {
        return function (params) {
            calls.push([kind, params])
            if (o.throws) throw o.throws
            return { logged: true }
        }
    }
    return {
        calls: calls,
        logIntent: record('intent'),
        logResult: record('result'),
        logError: record('error'),
    }
}

function fakeStore(result) {
    const calls = []
    return {
        calls: calls,
        applyThreshold: function (runId, res, toolName) {
            calls.push({ runId: runId, toolName: toolName })
            return result === undefined ? res : result
        },
    }
}

/** The exception shape a cross-scope denial throws — hostile to inspection. */
function hostileException() {
    const e = {}
    Object.defineProperty(e, 'message', {
        get: function () {
            throw new Error('reading .message threw again')
        },
    })
    return e
}

function load(opts) {
    const o = opts || {}
    const ctx = loadScriptInclude('PaScriptToolAdapter.js', { JSON: JSON })
    const adapter = new ctx.PaScriptToolAdapter({
        tools: o.tools,
        runAnchor: o.runAnchor || fakeAnchor(o.run),
        auditLogger: o.auditLogger || fakeAudit(),
        artifactStore: o.artifactStore || fakeStore(),
    })
    return adapter
}

/** invoke() always returns a String; every assertion needs it parsed. */
function invokeJson(adapter, tool, input, ctx) {
    const raw = adapter.invoke(tool, input, ctx)
    expect(typeof raw).toBe('string')
    return JSON.parse(raw)
}

describe('PaScriptToolAdapter — input handling', () => {
    test('a bare sys_id reaches execute() UNCHANGED, never wrapped (LLD §4.7 Note 4)', () => {
        const core = fakeCore()
        const adapter = load({ tools: { agent_trace: function () { return core } } })

        adapter.invoke('agent_trace', SYS_ID, {})

        expect(core.calls[0]).toBe(SYS_ID)
    })

    test('a bare agent name reaches execute() unchanged', () => {
        const core = fakeCore()
        const adapter = load({ tools: { agent_trace: function () { return core } } })

        adapter.invoke('agent_trace', 'Agent Doctor', {})

        expect(core.calls[0]).toBe('Agent Doctor')
    })

    test('a JSON object string is parsed to an object', () => {
        const core = fakeCore()
        const adapter = load({ tools: { agent_trace: function () { return core } } })

        adapter.invoke('agent_trace', '{"execution":"' + SYS_ID + '","detail":true}', {})

        expect(core.calls[0]).toEqual({ execution: SYS_ID, detail: true })
    })

    test('malformed JSON passes through unchanged so the core reports its own parse error', () => {
        const core = fakeCore()
        const adapter = load({ tools: { agent_trace: function () { return core } } })

        adapter.invoke('agent_trace', '{"execution": ', {})

        expect(core.calls[0]).toBe('{"execution": ')
    })

    test.each([
        ['empty string', ''],
        ['whitespace', '   '],
        ['null', null],
        ['undefined', undefined],
    ])('%s becomes an empty args object (R-9)', (_label, input) => {
        const core = fakeCore()
        const adapter = load({ tools: { agent_trace: function () { return core } } })

        adapter.invoke('agent_trace', input, {})

        expect(core.calls[0]).toEqual({})
    })

    test('an object is passed through as an object', () => {
        const core = fakeCore()
        const adapter = load({ tools: { agent_trace: function () { return core } } })

        adapter.invoke('agent_trace', { agent: 'Agent Doctor' }, {})

        expect(core.calls[0]).toEqual({ agent: 'Agent Doctor' })
    })

    test('an unknown tool errors cleanly and names the valid tools', () => {
        const adapter = load({ tools: { agent_trace: function () { return fakeCore() } } })

        const out = invokeJson(adapter, 'agent_trce', SYS_ID, {})

        expect(out.success).toBe(false)
        expect(out.phase).toBe('lookup')
        expect(out.error).toContain('agent_trace')
    })

    test('an unknown tool creates NO run anchor and writes NO audit row', () => {
        const anchor = fakeAnchor()
        const audit = fakeAudit()
        const adapter = load({
            tools: { agent_trace: function () { return fakeCore() } },
            runAnchor: anchor,
            auditLogger: audit,
        })

        adapter.invoke('nope', SYS_ID, {})

        expect(anchor.calls).toHaveLength(0)
        expect(audit.calls).toHaveLength(0)
    })

    test('the default registry carries exactly the two wrappers of this scope', () => {
        const ctx = loadScriptInclude('PaScriptToolAdapter.js', { JSON: JSON })
        const names = new ctx.PaScriptToolAdapter().toolNames()

        expect(names.sort()).toEqual(['agent_trace', 'read_artifact'])
    })

    test('a result that cannot be stringified still yields a String', () => {
        const cyclic = { success: true }
        cyclic.self = cyclic
        const adapter = load({ tools: { t: function () { return fakeCore({ result: cyclic }) } } })

        const out = invokeJson(adapter, 't', SYS_ID, {})

        expect(out.success).toBe(false)
        expect(out.phase).toBe('serialize')
    })

    test('a bare sys_id with surrounding whitespace reaches execute() unchanged (LLD §4.7 Note 4)', () => {
        const core = fakeCore()
        const adapter = load({ tools: { agent_trace: function () { return core } } })
        const inputWithWhitespace = '  ' + SYS_ID + '  '

        adapter.invoke('agent_trace', inputWithWhitespace, {})

        expect(core.calls[0]).toBe(inputWithWhitespace)
    })

    test('a core that returns undefined still yields a String', () => {
        const undefinedCore = {
            PAGED_OUTPUT: true,
            execute: function () {
                return undefined
            },
        }
        const adapter = load({ tools: { t: function () { return undefinedCore } } })

        const out = invokeJson(adapter, 't', SYS_ID, {})

        expect(typeof out).toBe('object')
        expect(out.success).toBe(false)
        expect(out.phase).toBe('serialize')
    })
})

describe('PaScriptToolAdapter — pipeline', () => {
    test('intent is logged BEFORE execute — it is the only trace of a call that hangs', () => {
        const order = []
        const audit = fakeAudit()
        const core = {
            PAGED_OUTPUT: false,
            execute: function () {
                order.push('execute')
                return { success: true }
            },
        }
        const wrapped = {
            logIntent: function (p) {
                order.push('intent')
                return audit.logIntent(p)
            },
            logResult: audit.logResult,
            logError: audit.logError,
        }
        const adapter = load({ tools: { agent_trace: function () { return core } }, auditLogger: wrapped })

        adapter.invoke('agent_trace', SYS_ID, {})

        expect(order).toEqual(['intent', 'execute'])
    })

    test('a non-paged core gets applyThreshold, with the run id and the tool name', () => {
        const store = fakeStore()
        const adapter = load({
            tools: { agent_trace: function () { return fakeCore({ paged: false }) } },
            artifactStore: store,
        })

        adapter.invoke('agent_trace', SYS_ID, {})

        expect(store.calls).toEqual([{ runId: 'run1', toolName: 'agent_trace' }])
    })

    test('a PAGED_OUTPUT core is NOT thresholded — the 4000/4000 collision', () => {
        const store = fakeStore()
        const adapter = load({
            tools: { read_artifact: function () { return fakeCore({ paged: true }) } },
            artifactStore: store,
        })

        adapter.invoke('read_artifact', SYS_ID, {})

        expect(store.calls).toHaveLength(0)
    })

    test('the thresholded result is what reaches both the caller and the audit row', () => {
        const audit = fakeAudit()
        const truncated = { success: true, truncated: true, artifact_id: 'art1' }
        const adapter = load({
            tools: { agent_trace: function () { return fakeCore({ result: { success: true, big: 'x' } }) } },
            artifactStore: fakeStore(truncated),
            auditLogger: audit,
        })

        const out = invokeJson(adapter, 'agent_trace', SYS_ID, {})
        const resultRow = audit.calls.filter((c) => c[0] === 'result')[0]

        expect(out.artifact_id).toBe('art1')
        expect(resultRow[1].output.artifact_id).toBe('art1')
    })

    test('a degraded anchor surfaces run:{degraded,note} on the result (R-10)', () => {
        const adapter = load({
            tools: { agent_trace: function () { return fakeCore() } },
            run: { run_id: null, degraded: 'glide_unavailable', note: 'No diagnostic run record could be established' },
            artifactStore: fakeStore({ success: true, data: { ok: 1 } }),
        })

        const out = invokeJson(adapter, 'agent_trace', SYS_ID, {})

        expect(out.run).toEqual({
            degraded: 'glide_unavailable',
            note: 'No diagnostic run record could be established',
        })
        expect(out.success).toBe(true)
    })

    test('a healthy anchor adds no run key — silence means durable', () => {
        const adapter = load({
            tools: { agent_trace: function () { return fakeCore() } },
            artifactStore: fakeStore({ success: true, data: { ok: 1 } }),
        })

        expect(invokeJson(adapter, 'agent_trace', SYS_ID, {}).run).toBeUndefined()
    })

    test('a degraded anchor still passes an empty run id to applyThreshold, not null', () => {
        const store = fakeStore()
        const adapter = load({
            tools: { agent_trace: function () { return fakeCore() } },
            run: { run_id: null, degraded: 'glide_unavailable', note: 'n' },
            artifactStore: store,
        })

        adapter.invoke('agent_trace', SYS_ID, {})

        expect(store.calls[0].runId).toBe('')
    })

    test('a core that throws a hostile exception yields a phased envelope, never a throw (R-1)', () => {
        const adapter = load({
            tools: { agent_trace: function () { return fakeCore({ throws: hostileException() }) } },
        })

        const out = invokeJson(adapter, 'agent_trace', SYS_ID, {})

        expect(out.success).toBe(false)
        expect(out.phase).toBe('execute')
        expect(out.error).toContain('agent_trace')
    })

    test('a throwing anchor is contained and reported at the anchor phase', () => {
        const adapter = load({
            tools: { agent_trace: function () { return fakeCore() } },
            runAnchor: {
                getOrCreate: function () {
                    throw hostileException()
                },
            },
        })

        expect(invokeJson(adapter, 'agent_trace', SYS_ID, {}).phase).toBe('anchor')
    })

    test('a throwing audit logger does not change what the caller receives', () => {
        const adapter = load({
            tools: { agent_trace: function () { return fakeCore() } },
            auditLogger: fakeAudit({ throws: hostileException() }),
            artifactStore: fakeStore({ success: true, data: { ok: 1 } }),
        })

        const out = invokeJson(adapter, 'agent_trace', SYS_ID, {})

        expect(out.success).toBe(true)
        expect(out.data).toEqual({ ok: 1 })
    })

    test('the ctx argument reaches getOrCreate untouched', () => {
        const anchor = fakeAnchor()
        const adapter = load({ tools: { agent_trace: function () { return fakeCore() } }, runAnchor: anchor })

        adapter.invoke('agent_trace', SYS_ID, { harness: 'native' })

        expect(anchor.calls[0]).toEqual({ harness: 'native' })
    })

    test('a failure still writes an audit error row naming the tool', () => {
        const audit = fakeAudit()
        const adapter = load({
            tools: { agent_trace: function () { return fakeCore({ throws: hostileException() }) } },
            auditLogger: audit,
        })

        adapter.invoke('agent_trace', SYS_ID, {})
        const errorRow = audit.calls.filter((c) => c[0] === 'error')[0]

        expect(errorRow[1].toolName).toBe('agent_trace')
        expect(errorRow[1].runId).toBe('run1')
    })
})
