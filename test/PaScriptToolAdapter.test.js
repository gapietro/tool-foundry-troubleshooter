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
        readKit: o.readKit,
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

    test('the default registry carries all seven wrappers', () => {
        const ctx = loadScriptInclude('PaScriptToolAdapter.js', { JSON: JSON })
        const names = new ctx.PaScriptToolAdapter().toolNames()

        // Six diagnostic cores plus the paging primitive. Seven sits at the
        // top of the platform's 5-7 guidance; anything further goes through
        // query_table rather than becoming an eighth tool.
        expect(names.sort()).toEqual([
            'agent_config',
            'agent_trace',
            'genai_log',
            'log_analysis',
            'query_table',
            'read_artifact',
            'schema_lookup',
        ])
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

// ---------------------------------------------------------------------------
// retrieval (#121) — same verdict, same ordering, native harness
// ---------------------------------------------------------------------------

describe('retrieval verdict (#121)', () => {
    function fakeKit(verdict) {
        const seen = []
        return {
            seen: seen,
            retrievalVerdict: function (result) {
                seen.push(result)
                if (verdict instanceof Error) throw verdict
                return verdict || 'unknown'
            },
        }
    }

    function auditSpy() {
        const calls = []
        return {
            calls: calls,
            logIntent: function (p) {
                calls.push(['logIntent', p])
            },
            logResult: function (p) {
                calls.push(['logResult', p])
            },
            logError: function (p) {
                calls.push(['logError', p])
            },
        }
    }

    function resultCall(audit) {
        return audit.calls.filter((c) => c[0] === 'logResult')[0][1]
    }

    /**
     * A store stub that replaces anything over `limit` chars with a
     * `reads`-free envelope, as the real PaArtifactStore.applyThreshold does
     * once a result crosses the threshold. Mirrors
     * test/PaToolRegistry.test.js's `thresholdingStore` (Task 4's "THE
     * ORDERING CLAIM" test) — kept local rather than shared, same as the
     * components under test.
     */
    function thresholdingStore(limit) {
        return {
            applyThreshold: function (runId, result, toolName) {
                if (JSON.stringify(result).length <= limit) return result
                return {
                    success: true,
                    truncated: true,
                    tool: toolName,
                    total_length: JSON.stringify(result).length,
                    artifact_id: 'art1',
                    excerpt: '{"success":true,…',
                    note: 'truncated',
                }
            },
        }
    }

    test('the verdict reaches logResult', () => {
        const audit = auditSpy()
        const adapter = load({
            tools: { agent_trace: () => ({ execute: () => ({ success: true, data: { reads: { x: 'ok' } } }) }) },
            auditLogger: audit,
            readKit: fakeKit('ok'),
        })

        adapter.invoke('agent_trace', '{}', { execution: 'e1' })

        expect(resultCall(audit).retrieval).toBe('ok')
    })

    test('THE ORDERING CLAIM (thresholding): a productive result too big to survive thresholding still logs ok', () => {
        // Discriminating version of the ordering claim, thresholding half.
        // applyThreshold here actually REPLACES an oversized result with a
        // reads-free excerpt envelope (unlike the default fakeStore(), which
        // is an identity passthrough and can't tell early verdict-taking from
        // late). If the verdict line moved to after applyThreshold, kit.seen[0]
        // would be the excerpt envelope, not `big`, and this would fail.
        const audit = auditSpy()
        const kit = fakeKit('ok')
        const big = { success: true, data: { reads: { sys_generative_ai_log: 'ok' }, blob: 'x'.repeat(5000) } }
        const adapter = load({
            tools: { genai_log: () => ({ execute: () => big }) },
            auditLogger: audit,
            artifactStore: thresholdingStore(4000),
            readKit: kit,
        })

        adapter.invoke('genai_log', '{}', { execution: 'e1' })

        const logged = resultCall(audit)
        // The verdict was taken on the core's own result...
        expect(kit.seen[0]).toBe(big)
        expect(logged.retrieval).toBe('ok')
        // ...and what was LOGGED is the excerpt envelope, which has no reads.
        expect(logged.output.truncated).toBe(true)
        expect(logged.output.data).toBeUndefined()
    })

    test('THE ORDERING CLAIM (_attachRunState): the verdict is taken before run-state metadata is attached on a degraded run', () => {
        // Discriminating version of the ordering claim, _attachRunState half.
        // The default fakeAnchor() run has no `degraded` field, so
        // _attachRunState is a no-op and returns the SAME reference either
        // way — that's exactly why the old combined test couldn't tell early
        // from late. Here the run IS degraded, so _attachRunState clones the
        // result and adds a `run` key onto a NEW object. If the verdict line
        // moved to after _attachRunState, kit.seen[0] would be that new
        // object, not `core`, and this would fail.
        const audit = auditSpy()
        const kit = fakeKit('ok')
        const core = { success: true, data: { reads: { sys_generative_ai_log: 'ok' } } }
        const degradedRun = { run_id: 'run1', degraded: true, note: 'anchor fallback' }
        const adapter = load({
            tools: { genai_log: () => ({ execute: () => core }) },
            auditLogger: audit,
            run: degradedRun,
            readKit: kit,
        })

        adapter.invoke('genai_log', '{}', { execution: 'e1' })

        const logged = resultCall(audit)
        expect(kit.seen[0]).toBe(core)
        expect(logged.retrieval).toBe('ok')
        // ...and what was LOGGED is the post-_attachRunState clone, carrying
        // run metadata the core result never had.
        expect(logged.output).not.toBe(core)
        expect(logged.output.run).toEqual({ degraded: true, note: 'anchor fallback' })
    })

    test('a throwing read kit degrades to unknown and the tool still answers', () => {
        const audit = auditSpy()
        const adapter = load({
            tools: { agent_trace: () => ({ execute: () => ({ success: true, data: { reads: { x: 'ok' } } }) }) },
            auditLogger: audit,
            readKit: fakeKit(new Error('boom')),
        })

        const out = adapter.invoke('agent_trace', '{}', { execution: 'e1' })

        expect(JSON.parse(out).success).toBe(true)
        expect(resultCall(audit).retrieval).toBe('unknown')
    })

    test('an unknown tool short-circuits before any verdict is taken', () => {
        const kit = fakeKit('ok')
        const adapter = load({ tools: {}, readKit: kit })

        adapter.invoke('not_a_tool', '{}', { execution: 'e1' })

        expect(kit.seen).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// retrieval verdict (#121 review finding 1) — THE END-TO-END LINK
//
// Every test above this point injects a `fakeKit` that returns a canned
// verdict and ignores its input — those tests prove invoke() PLUMBS a verdict
// through to logResult, nothing about whether a REAL PaToolReadKit reading a
// REAL tool-core-shaped result produces the verdict this file assumes.
// test/PaToolReadKit.test.js proves the predicate in isolation, but nothing
// before this fed a core-shaped result through a real kit via a real
// invoke() call. A shape mismatch between what the cores actually emit and
// what the predicate reads would slip through both suites unnoticed. These
// two tests are that missing link, built the same way
// test/PaToolReadKit.test.js builds its kit, and using genuinely core-shaped
// results already used elsewhere on this branch (DECISION.md §T4 row 07 /
// §U9.1 v10-2).
// ---------------------------------------------------------------------------

describe('retrieval verdict (#121 review finding 1) — real PaToolReadKit through a real invoke', () => {
    function realKit() {
        return new (loadScriptInclude('PaToolReadKit.js', { JSON: JSON })).PaToolReadKit()
    }

    test("'none': a real kit reading a real schema_lookup-shaped barren result", () => {
        const audit = fakeAudit()
        const adapter = load({
            tools: {
                schema_lookup: () => ({
                    execute: () => ({
                        success: true,
                        data: {
                            table_exists: false,
                            finding: 'table_does_not_exist',
                            reads: { sys_db_object: 'empty' },
                        },
                    }),
                }),
            },
            auditLogger: audit,
            readKit: realKit(),
        })

        const out = invokeJson(adapter, 'schema_lookup', '{}', { execution: 'e1' })

        expect(out.success).toBe(true)
        const resultRow = audit.calls.filter((c) => c[0] === 'result')[0][1]
        expect(resultRow.retrieval).toBe('none')
    })

    test("'ok': a real kit reading a real genai_log-shaped result that fetched rows", () => {
        const audit = fakeAudit()
        const adapter = load({
            tools: {
                genai_log: () => ({
                    execute: () => ({
                        success: true,
                        data: {
                            llm_call_rows: 3,
                            reads: { sys_generative_ai_log: 'ok' },
                        },
                    }),
                }),
            },
            auditLogger: audit,
            readKit: realKit(),
        })

        const out = invokeJson(adapter, 'genai_log', '{}', { execution: 'e1' })

        expect(out.success).toBe(true)
        const resultRow = audit.calls.filter((c) => c[0] === 'result')[0][1]
        expect(resultRow.retrieval).toBe('ok')
    })
})
