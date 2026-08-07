/**
 * PaToolRegistry — pure-logic tests (Phase 1b Task 3, ARCHITECTURE_DECISIONS.md
 * "Layer 5", src/server/PaScriptToolAdapter.js as the native counterpart).
 *
 * WHAT THIS COMPONENT IS
 * The custom harness's own dispatch layer over the seven unchanged Phase 1a
 * tool cores. Its native-harness sibling is PaScriptToolAdapter — same seven
 * cores, same {success, data|error} contract from every core, but a different
 * calling convention: the adapter is invoked BY NAME from a one-line Fluent IIFE
 * and must always return a String; the registry is called BY THE CUSTOM
 * REASONING LOOP and returns the object directly. Same audit + threshold
 * plumbing, same destructive gate, different shell.
 *
 * ROSTER-EQUALITY, NOT SHARED CODE
 * DESIGN.md R-20 makes sweep completeness DERIVED from the distinct tool_name
 * set over the audit rows for a run. If the registry's roster drifts from the
 * adapter's, a run through the custom harness would write different tool_name
 * values than a run through the native agent, and R-20's derived-completeness
 * metric would score the drift rather than the diagnosis. The two files are
 * independent by design (neither imports the other — ES5 Script Includes have
 * no import), so this equality can only be enforced by a test, copying the
 * technique test/agentDoctorInstructions.test.js uses for the Fluent/adapter
 * pair: read both sources as text and compare the registered keys.
 */

const fs = require('fs')
const path = require('path')
const { loadScriptInclude } = require('./_loadScriptInclude')

const REGISTRY_PATH = path.join(__dirname, '..', 'src', 'server', 'PaToolRegistry.js')
const ADAPTER_PATH = path.join(__dirname, '..', 'src', 'server', 'PaScriptToolAdapter.js')

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

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

/** One entry of the registry's own {cores} override shape. */
function fakeEntry(overrides) {
    const o = overrides || {}
    return Object.assign(
        {
            layer: 'test layer',
            description: 'a fake tool for tests',
            readOnly: true,
            destructive: false,
            factory: function () {
                return fakeCore()
            },
        },
        o
    )
}

function load(opts) {
    const o = opts || {}
    const ctx = loadScriptInclude('PaToolRegistry.js', { JSON: JSON })
    return new ctx.PaToolRegistry({
        cores: o.cores,
        auditLogger: o.auditLogger || fakeAudit(),
        artifactStore: o.artifactStore || fakeStore(),
    })
}

// ---------------------------------------------------------------------------
// Roster equality — the property R-20 depends on
// ---------------------------------------------------------------------------

describe('PaToolRegistry — roster equals the adapter roster', () => {
    it('registers exactly the same seven tool names as PaScriptToolAdapter, under the same keys', () => {
        const registrySrc = fs.readFileSync(REGISTRY_PATH, 'utf8')
        const adapterSrc = fs.readFileSync(ADAPTER_PATH, 'utf8')

        // Adapter shape: `            agent_trace: function () {` at 12-space indent.
        const registered = (adapterSrc.match(/^\s{12}(\w+): function \(\) \{/gm) || []).map((m) =>
            m.trim().replace(/: function \(\) \{/, '')
        )

        // Registry shape: `            agent_trace: {` at 12-space indent — same
        // nesting depth (prototype -> _registry body -> return object literal).
        const roster = (registrySrc.match(/^\s{12}(\w+): \{/gm) || []).map((m) => m.trim().replace(/: \{/, ''))

        expect(roster.sort()).toEqual(registered.sort())
        expect(roster).toHaveLength(7)
    })

    it('the live default roster (list()) matches too, exercised end to end', () => {
        const registry = load({ cores: undefined })
        const names = registry.toolNames().sort()

        expect(names).toEqual([
            'agent_config',
            'agent_trace',
            'genai_log',
            'log_analysis',
            'query_table',
            'read_artifact',
            'schema_lookup',
        ])
    })
})

// ---------------------------------------------------------------------------
// list() shape
// ---------------------------------------------------------------------------

describe('PaToolRegistry — list()', () => {
    it('returns {name, layer, description, readOnly:true} for every real tool', () => {
        const registry = load({})
        const entries = registry.list()

        expect(entries).toHaveLength(7)
        entries.forEach((e) => {
            expect(typeof e.name).toBe('string')
            expect(e.name.length).toBeGreaterThan(0)
            expect(typeof e.layer).toBe('string')
            expect(e.layer.length).toBeGreaterThan(0)
            expect(typeof e.description).toBe('string')
            expect(e.description.length).toBeGreaterThan(0)
            expect(e.readOnly).toBe(true)
        })
    })

    it('every Phase 1 tool is readOnly — none is destructive', () => {
        // list() derives readOnly from metadata; dispatching each real name
        // must never hit the destructive gate (it would if any real entry
        // were mis-registered destructive:true).
        const registry = load({})
        registry.list().forEach((e) => expect(e.readOnly).toBe(true))

        registry.toolNames().forEach((name) => {
            const out = registry.dispatch(name, {}, { run_id: 'run1' })
            expect(out.error).not.toEqual(expect.stringContaining('confirmation flow is Phase 3'))
        })
    })
})

// ---------------------------------------------------------------------------
// dispatch — happy path + audit
// ---------------------------------------------------------------------------

describe('PaToolRegistry — dispatch, happy path', () => {
    it('resolves the core, returns its result, and writes intent + result audit rows', () => {
        const audit = fakeAudit()
        const core = fakeCore({ result: { success: true, data: { hello: 'world' } } })
        const registry = load({
            cores: { agent_trace: fakeEntry({ factory: () => core }) },
            auditLogger: audit,
        })

        const out = registry.dispatch('agent_trace', { execution: 'abc' }, { run_id: 'run1' })

        expect(out).toEqual({ success: true, data: { hello: 'world' } })
        expect(core.calls[0]).toEqual({ execution: 'abc' })

        const kinds = audit.calls.map((c) => c[0])
        expect(kinds).toContain('intent')
        expect(kinds).toContain('result')

        const intentRow = audit.calls.filter((c) => c[0] === 'intent')[0][1]
        expect(intentRow.toolName).toBe('agent_trace')
        expect(intentRow.runId).toBe('run1')
        expect(intentRow.input).toEqual({ execution: 'abc' })

        const resultRow = audit.calls.filter((c) => c[0] === 'result')[0][1]
        expect(resultRow.toolName).toBe('agent_trace')
        expect(resultRow.runId).toBe('run1')
    })

    it('intent is logged BEFORE execute — the only trace of a call that hangs', () => {
        const order = []
        const audit = fakeAudit()
        const wrapped = {
            logIntent: function (p) {
                order.push('intent')
                return audit.logIntent(p)
            },
            logResult: audit.logResult,
            logError: audit.logError,
        }
        const core = {
            PAGED_OUTPUT: false,
            execute: function () {
                order.push('execute')
                return { success: true }
            },
        }
        const registry = load({
            cores: { agent_trace: fakeEntry({ factory: () => core }) },
            auditLogger: wrapped,
        })

        registry.dispatch('agent_trace', {}, { run_id: 'run1' })

        expect(order).toEqual(['intent', 'execute'])
    })

    it('a missing runCtx / run_id dispatches with an empty run id rather than throwing', () => {
        const audit = fakeAudit()
        const core = fakeCore()
        const registry = load({
            cores: { agent_trace: fakeEntry({ factory: () => core }) },
            auditLogger: audit,
        })

        expect(() => registry.dispatch('agent_trace', {}, undefined)).not.toThrow()
        const intentRow = audit.calls.filter((c) => c[0] === 'intent')[0][1]
        expect(intentRow.runId).toBe('')
    })

    it('a core that throws is contained: dispatch returns {success:false} and writes an error audit row (R-1)', () => {
        const audit = fakeAudit()
        const core = fakeCore({ throws: hostileException() })
        const registry = load({
            cores: { agent_trace: fakeEntry({ factory: () => core }) },
            auditLogger: audit,
        })

        const out = registry.dispatch('agent_trace', {}, { run_id: 'run1' })

        expect(out.success).toBe(false)
        expect(typeof out.error).toBe('string')

        const errorRow = audit.calls.filter((c) => c[0] === 'error')[0][1]
        expect(errorRow.toolName).toBe('agent_trace')
        expect(errorRow.runId).toBe('run1')
    })
})

// ---------------------------------------------------------------------------
// dispatch — unknown tool
// ---------------------------------------------------------------------------

describe('PaToolRegistry — dispatch, unknown tool', () => {
    it('refuses cleanly and lists the valid names', () => {
        const registry = load({
            cores: {
                agent_trace: fakeEntry(),
                schema_lookup: fakeEntry(),
            },
        })

        const out = registry.dispatch('agent_trce', {}, { run_id: 'run1' })

        expect(out.success).toBe(false)
        expect(out.error).toContain('agent_trce')
        expect(out.error).toContain('agent_trace')
        expect(out.error).toContain('schema_lookup')
    })

    it('creates no audit row for a tool that was never dispatched', () => {
        const audit = fakeAudit()
        const registry = load({
            cores: { agent_trace: fakeEntry() },
            auditLogger: audit,
        })

        registry.dispatch('nope', {}, { run_id: 'run1' })

        expect(audit.calls).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// dispatch — destructive gate
// ---------------------------------------------------------------------------

describe('PaToolRegistry — destructive gate', () => {
    it('refuses to dispatch a tool registered destructive, citing the Phase 3 confirmation flow', () => {
        const audit = fakeAudit()
        const dangerousCore = fakeCore()
        const registry = load({
            cores: {
                delete_record: fakeEntry({ destructive: true, readOnly: false, factory: () => dangerousCore }),
            },
            auditLogger: audit,
        })

        const out = registry.dispatch('delete_record', {}, { run_id: 'run1' })

        expect(out.success).toBe(false)
        expect(out.error).toContain('confirmation flow is Phase 3')
        // Refused before anything runs: no execution, no audit row either.
        expect(dangerousCore.calls).toEqual([])
        expect(audit.calls).toHaveLength(0)
    })

    it('fails CLOSED: a registration that OMITS destructive entirely is refused, not dispatched', () => {
        // The gate must not fail open for a future author who simply forgets
        // to write `destructive: false` on a new registration. Build the
        // entry by hand (not via fakeEntry(), which defaults the field) so
        // the property is genuinely absent, matching a real omission.
        const audit = fakeAudit()
        const unmarkedCore = fakeCore()
        const registry = load({
            cores: {
                mystery_tool: {
                    layer: 'unspecified',
                    description: 'a tool that forgot to declare destructive',
                    readOnly: true,
                    factory: () => unmarkedCore,
                },
            },
            auditLogger: audit,
        })

        const out = registry.dispatch('mystery_tool', {}, { run_id: 'run1' })

        expect(out.success).toBe(false)
        expect(out.error).toContain('confirmation flow is Phase 3')
        expect(unmarkedCore.calls).toEqual([])
        expect(audit.calls).toHaveLength(0)
    })

    it('fails CLOSED: destructive:undefined explicitly is refused the same as omission', () => {
        const registry = load({
            cores: { mystery_tool: fakeEntry({ destructive: undefined }) },
        })

        const out = registry.dispatch('mystery_tool', {}, { run_id: 'run1' })

        expect(out.success).toBe(false)
        expect(out.error).toContain('confirmation flow is Phase 3')
    })
})

// ---------------------------------------------------------------------------
// dispatch — artifact threshold
// ---------------------------------------------------------------------------

describe('PaToolRegistry — artifact threshold', () => {
    it('applies PaArtifactStore.applyThreshold with the run id and tool name', () => {
        const store = fakeStore()
        const core = fakeCore({ paged: false })
        const registry = load({
            cores: { agent_trace: fakeEntry({ factory: () => core }) },
            artifactStore: store,
        })

        registry.dispatch('agent_trace', {}, { run_id: 'run1' })

        expect(store.calls).toEqual([{ runId: 'run1', toolName: 'agent_trace' }])
    })

    it('the thresholded result is what dispatch returns', () => {
        const truncated = { success: true, truncated: true, artifact_id: 'art1' }
        const store = fakeStore(truncated)
        const core = fakeCore({ result: { success: true, big: 'x' } })
        const registry = load({
            cores: { agent_trace: fakeEntry({ factory: () => core }) },
            artifactStore: store,
        })

        const out = registry.dispatch('agent_trace', {}, { run_id: 'run1' })

        expect(out).toEqual(truncated)
    })

    it('a PAGED_OUTPUT core (read_artifact) is NOT thresholded — the 4000/4000 collision', () => {
        const store = fakeStore()
        const core = fakeCore({ paged: true })
        const registry = load({
            cores: { read_artifact: fakeEntry({ factory: () => core }) },
            artifactStore: store,
        })

        registry.dispatch('read_artifact', {}, { run_id: 'run1' })

        expect(store.calls).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// promptBlock — single-source description generation
// ---------------------------------------------------------------------------

describe('PaToolRegistry — promptBlock()', () => {
    it('is generated FROM list() metadata, not a hand-written second copy', () => {
        const registry = load({
            cores: {
                agent_trace: fakeEntry({ layer: 'layer 1', description: 'UNIQUE_MARKER_TRACE_DESC' }),
                schema_lookup: fakeEntry({ layer: 'layer 4', description: 'UNIQUE_MARKER_SCHEMA_DESC' }),
            },
        })

        const block = registry.promptBlock()

        // If a description changes in list()'s metadata, promptBlock must
        // reflect it automatically — proof there is no separate copy.
        expect(block).toContain('UNIQUE_MARKER_TRACE_DESC')
        expect(block).toContain('UNIQUE_MARKER_SCHEMA_DESC')
        expect(block).toContain('agent_trace')
        expect(block).toContain('schema_lookup')
    })

    it('names every real tool and carries the description from the same source as the native agent', () => {
        const registry = load({})
        const block = registry.promptBlock()
        const entries = registry.list()

        expect(entries).toHaveLength(7)
        entries.forEach((e) => {
            expect(block).toContain(e.name)
            expect(block).toContain(e.description)
        })
    })

    it('carries the same descriptions the native Fluent agent ships (single authored source)', () => {
        // src/fluent/agent-doctor.now.ts is the native harness's tool roster.
        // Both harnesses must present the SAME tool semantics to whatever is
        // reasoning about them — a divergent description here is a divergent
        // (and untested) tool contract for the custom harness's LLM loop.
        const fluentSrc = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        const re = /name: '(\w+)',\s*\n\s*type: 'script',\s*\n\s*description: `([\s\S]*?)`,\s*\n\s*executionMode/g
        const nativeDescriptions = {}
        let m
        while ((m = re.exec(fluentSrc)) !== null) {
            nativeDescriptions[m[1]] = m[2]
        }
        expect(Object.keys(nativeDescriptions)).toHaveLength(7)

        const registry = load({})
        const entries = registry.list()

        entries.forEach((e) => {
            expect(nativeDescriptions[e.name]).toBeDefined()
            expect(e.description).toBe(nativeDescriptions[e.name])
        })
    })

    it('tells every tool that a parameter name is not part of a value (#122)', () => {
        // #111 fixed this wording on schema_lookup only, and #122 found the
        // malformation on genai_log the first time the harness ever called it.
        // The fix was never scoped to the tools nobody had exercised.
        const registry = load({})
        const entries = registry.list()

        expect(entries).toHaveLength(7)
        entries.forEach((e) => {
            expect(e.description).toContain('are parameter names, never part of a value')
        })
    })
})

// ---------------------------------------------------------------------------
// Section-aware excerpting is declared by the tool, not guessed by the store
// (issue #91).
// ---------------------------------------------------------------------------
describe('excerptPriority (#91)', () => {
    it('agent_trace declares one, and puts evidence ahead of bulk', () => {
        const reg = load()._registry()
        const p = reg.agent_trace.excerptPriority

        expect(Array.isArray(p)).toBe(true)
        // The sections the blind slice was throwing away must outrank the
        // ones it was keeping. task_tree is the bulk and goes last.
        expect(p.indexOf('tool_calls')).toBeLessThan(p.indexOf('task_tree'))
        expect(p.indexOf('script_errors')).toBeLessThan(p.indexOf('task_tree'))
        expect(p.indexOf('header')).toBeLessThan(p.indexOf('conversation'))
        expect(p[p.length - 1]).toBe('task_tree')
    })

    it('every named section is a real key of the agent_trace payload', () => {
        // A typo here degrades silently: _orderedKeys skips names the payload
        // does not have, so a misspelt section simply never gets prioritised
        // and the excerpt quietly reverts toward natural key order.
        const fs = require('fs')
        const path = require('path')
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'server', 'tools', 'PaToolAgentTrace.js'),
            'utf8'
        )
        load()
            ._registry()
            .agent_trace.excerptPriority.forEach((section) => {
                expect(src).toMatch(new RegExp('data\\.' + section + '\\s*=|' + section + ':'))
            })
    })
})
