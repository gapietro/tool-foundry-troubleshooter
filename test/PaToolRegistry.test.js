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
        // #75 — the two pre-logIntent refusal gates audit through this.
        logRefusal: record('refusal'),
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
        readKit: o.readKit,
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

    // -----------------------------------------------------------------------
    // _retrievalVerdict body parity (#121 review finding 3)
    // -----------------------------------------------------------------------
    //
    // The roster-name check above is the ONLY thing that was ever cited as
    // evidence the registry and the adapter stay parallel, but
    // `_retrievalVerdict` is hand-duplicated verbatim in both files — a
    // DELIBERATE decision (the two components are structurally parallel and
    // neither imports the other; do NOT "fix" this by deleting one copy or
    // having one call the other) — and nothing was keeping the two bodies in
    // sync. This extracts each helper's body as text and compares it
    // directly, so a drift between them is caught here instead of being
    // discovered later as a behavioural difference between the two harnesses.
    it('PaToolRegistry._retrievalVerdict and PaScriptToolAdapter._retrievalVerdict stay byte-for-byte identical', () => {
        const registrySrc = fs.readFileSync(REGISTRY_PATH, 'utf8')
        const adapterSrc = fs.readFileSync(ADAPTER_PATH, 'utf8')

        // Method body: from the `_retrievalVerdict: function (result) {`
        // header down to the matching `    },` that closes it at the same
        // 4-space (prototype-member) indentation.
        const bodyRe = /_retrievalVerdict: function \(result\) \{[\s\S]*?\n {4}\},/

        const registryMatch = registrySrc.match(bodyRe)
        const adapterMatch = adapterSrc.match(bodyRe)

        expect(registryMatch).not.toBeNull()
        expect(adapterMatch).not.toBeNull()

        // If this fails, the fix is to bring the DRIFTED copy back in line
        // with its sibling — the duplication itself is intentional and is
        // not the thing to remove.
        expect(registryMatch[0]).toBe(adapterMatch[0])
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

    it('creates no EVIDENCE row for a tool that was never dispatched (a refusal row is written, #75)', () => {
        const audit = fakeAudit()
        const registry = load({
            cores: { agent_trace: fakeEntry() },
            auditLogger: audit,
        })

        registry.dispatch('nope', {}, { run_id: 'run1' })

        // #75 — a refusal IS now recorded (the attempt is what a security
        // review wants), but it is not an EVIDENCE row: no intent/result/error
        // call is made, so nothing downstream can read the refused tool as
        // having run. That is the invariant this assertion protects.
        expect(audit.calls.filter((c) => c[0] !== 'refusal')).toHaveLength(0)
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
        // #75 — a refusal IS now recorded (the attempt is what a security
        // review wants), but it is not an EVIDENCE row: no intent/result/error
        // call is made, so nothing downstream can read the refused tool as
        // having run. That is the invariant this assertion protects.
        expect(audit.calls.filter((c) => c[0] !== 'refusal')).toHaveLength(0)
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
        // #75 — a refusal IS now recorded (the attempt is what a security
        // review wants), but it is not an EVIDENCE row: no intent/result/error
        // call is made, so nothing downstream can read the refused tool as
        // having run. That is the invariant this assertion protects.
        expect(audit.calls.filter((c) => c[0] !== 'refusal')).toHaveLength(0)
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
// dispatch — the `dispatched:false` marker (#200 / DECISION.md §AT)
//
// The two gates above return BEFORE `logIntent`, so they leave no audit row
// and never could have. A caller reasoning about an EMPTY audit trail needs
// to tell that from "the writes were lost" — PaAgentLoop's §AQ depth-gate
// floor is that caller, and the marker is how it is told.
//
// The boundary is drawn at the audit write, NOT at success: the catch branch
// runs after `logIntent`, so a core that throws DID leave a row and must not
// be marked. The two tests that assert absence are the load-bearing ones.
// ---------------------------------------------------------------------------

describe('PaToolRegistry — dispatched marker (#200)', () => {
    it('marks the unknown-tool refusal, which returns before any evidence row', () => {
        const audit = fakeAudit()
        const registry = load({ cores: { agent_trace: fakeEntry() }, auditLogger: audit })

        const out = registry.dispatch('nope', {}, { run_id: 'run1' })

        expect(out.dispatched).toBe(false)
        // #75 — a refusal IS now recorded (the attempt is what a security
        // review wants), but it is not an EVIDENCE row: no intent/result/error
        // call is made, so nothing downstream can read the refused tool as
        // having run. That is the invariant this assertion protects.
        expect(audit.calls.filter((c) => c[0] !== 'refusal')).toHaveLength(0)
    })

    it('marks the destructive refusal, which also returns before any evidence row', () => {
        const audit = fakeAudit()
        const registry = load({
            cores: { delete_record: fakeEntry({ destructive: true, readOnly: false }) },
            auditLogger: audit,
        })

        const out = registry.dispatch('delete_record', {}, { run_id: 'run1' })

        expect(out.dispatched).toBe(false)
        // #75 — a refusal IS now recorded (the attempt is what a security
        // review wants), but it is not an EVIDENCE row: no intent/result/error
        // call is made, so nothing downstream can read the refused tool as
        // having run. That is the invariant this assertion protects.
        expect(audit.calls.filter((c) => c[0] !== 'refusal')).toHaveLength(0)
    })

    it('does NOT mark a dispatch that ran — the tool core owns that result shape', () => {
        const registry = load({ cores: { agent_trace: fakeEntry() } })

        const out = registry.dispatch('agent_trace', {}, { run_id: 'run1' })

        expect(out.success).toBe(true)
        expect(out.dispatched).not.toBe(false)
    })

    it('does NOT mark a core that THREW — logIntent already wrote, so a row could have been lost', () => {
        const audit = fakeAudit()
        const registry = load({
            cores: { agent_trace: fakeEntry({ factory: () => fakeCore({ throws: new Error('boom') }) }) },
            auditLogger: audit,
        })

        const out = registry.dispatch('agent_trace', {}, { run_id: 'run1' })

        expect(out.success).toBe(false)
        expect(out.dispatched).not.toBe(false)
        expect(audit.calls.map((c) => c[0])).toEqual(['intent', 'error'])
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

    it('names the RIGHT parameters for each tool, not just the shared boilerplate (#122 review finding 1)', () => {
        // The boilerplate check above would pass unchanged if the six new
        // sentences were swapped between tools or copy-pasted from
        // schema_lookup's own wording. This asserts each tool's own sentence
        // names its own parameters — the words must match what that tool's
        // UNDERSTANDING TOOL INPUTS clause already advertises to the model,
        // no more and no less (agent_trace's undocumented `detail` is
        // deliberately excluded — it's a not_implemented stub, never
        // advertised in the INPUTS clause).
        const EXPECTED = {
            agent_trace: 'The words execution, agent, since and step are parameter names, never part of a value: send the sys_id alone, not execution:<sys_id>.',
            agent_config: 'The words agent and section are parameter names, never part of a value: send the agent name alone, not agent:<name>.',
            schema_lookup: 'The words table and field are parameter names, never part of a value: send incident, not table:incident.',
            query_table: 'The words table, query, fields and limit are parameter names, never part of a value: send incident, not table:incident.',
            genai_log: 'The words mode, execution, minutes_ago, errors_only, include_payload and capability are parameter names, never part of a value: send the sys_id alone, not execution:<sys_id>.',
            log_analysis: 'The words execution, source, message, level, minutes_ago and limit are parameter names, never part of a value: send the sys_id alone, not execution:<sys_id>.',
            read_artifact: 'The words artifact_id, offset and length are parameter names, never part of a value: send the sys_id alone, not artifact_id:<sys_id>.',
        }

        const registry = load({})
        const entries = registry.list()

        expect(entries).toHaveLength(7)
        expect(Object.keys(EXPECTED).sort()).toEqual(entries.map((e) => e.name).sort())
        entries.forEach((e) => {
            expect(e.description).toContain(EXPECTED[e.name])
        })
    })

    it('repeats that sentence VERBATIM on the per-input description (#122 review finding 3)', () => {
        // src/fluent/agent-doctor.now.ts carries a SECOND description per tool,
        // on inputs[0], and AIA surfaces both strings to the model.
        // PaToolRegistry.js has no input schema, so the parity test above
        // cannot see these — six of the seven were left saying nothing about
        // parameter prefixes while their own tool-level sentence said the
        // opposite, and nothing in the suite covered them.
        //
        // The expectation is derived FROM the tool-level sentence rather than
        // restated, so the two strings cannot drift into saying different
        // things and no third copy of the wording exists to maintain.
        const fluentSrc = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        const re =
            /name: '(\w+)',\s*\n\s*type: 'script',[\s\S]*?inputs: \[\s*\n\s*\{\s*\n\s*name: '\w+',\s*\n\s*description: `([\s\S]*?)`,\s*\n\s*mandatory/g
        const inputDescriptions = {}
        let m
        while ((m = re.exec(fluentSrc)) !== null) {
            inputDescriptions[m[1]] = m[2]
        }
        expect(Object.keys(inputDescriptions)).toHaveLength(7)

        const entries = load({}).list()
        expect(entries).toHaveLength(7)

        entries.forEach((e) => {
            const sentence = e.description.match(
                /The words [^.]+ are parameter names, never part of a value:[^.]+\./
            )
            // Also pins the punctuation: schema_lookup's input description used
            // a dash where every tool-level sentence uses a colon.
            expect(sentence).not.toBeNull()
            expect(inputDescriptions[e.name]).toBeDefined()
            expect(inputDescriptions[e.name]).toContain(sentence[0])
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

// ---------------------------------------------------------------------------
// retrieval (#121) — the verdict is taken BEFORE applyThreshold
// ---------------------------------------------------------------------------

describe('retrieval verdict (#121)', () => {
    /** A read kit stub that records what it was asked to judge. */
    function fakeKit(verdictByShape) {
        const seen = []
        return {
            seen: seen,
            retrievalVerdict: function (result) {
                seen.push(result)
                if (verdictByShape instanceof Error) throw verdictByShape
                return verdictByShape || 'unknown'
            },
        }
    }

    /** A store stub that replaces anything over `limit` chars, as the real one does. */
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

    test('the verdict reaches logResult', () => {
        const audit = auditSpy()
        const kit = fakeKit('ok')
        const registry = load({
            cores: {
                agent_trace: fakeEntry({
                    factory: () => ({ execute: () => ({ success: true, data: { reads: { x: 'ok' } } }) }),
                }),
            },
            auditLogger: audit,
            readKit: kit,
        })

        registry.dispatch('agent_trace', {}, { run_id: 'run1' })

        expect(resultCall(audit).retrieval).toBe('ok')
    })

    test('THE ORDERING CLAIM: a productive result too big to survive thresholding still logs ok', () => {
        // This is the test the whole design turns on. applyThreshold replaces
        // the object with an excerpt envelope carrying no `reads` map, so a
        // verdict taken after it would be 'unknown' for exactly the results
        // most likely to be productive. See design §3.1.
        const audit = auditSpy()
        const kit = fakeKit('ok')
        const big = { success: true, data: { reads: { sys_generative_ai_log: 'ok' }, blob: 'x'.repeat(5000) } }
        const registry = load({
            cores: { genai_log: fakeEntry({ factory: () => ({ execute: () => big }) }) },
            auditLogger: audit,
            artifactStore: thresholdingStore(4000),
            readKit: kit,
        })

        registry.dispatch('genai_log', {}, { run_id: 'run1' })

        const logged = resultCall(audit)
        // The verdict was taken on the core's own result...
        expect(kit.seen[0]).toBe(big)
        expect(logged.retrieval).toBe('ok')
        // ...and what was LOGGED is the excerpt envelope, which has no reads.
        expect(logged.output.truncated).toBe(true)
        expect(logged.output.data).toBeUndefined()
    })

    test('a barren result logs none', () => {
        const audit = auditSpy()
        const registry = load({
            cores: {
                schema_lookup: fakeEntry({
                    factory: () => ({
                        execute: () => ({ success: true, data: { table_exists: false, reads: { sys_db_object: 'empty' } } }),
                    }),
                }),
            },
            auditLogger: audit,
            readKit: fakeKit('none'),
        })

        registry.dispatch('schema_lookup', {}, { run_id: 'run1' })

        expect(resultCall(audit).retrieval).toBe('none')
    })

    test('a throwing read kit degrades to unknown and does NOT fail the tool call', () => {
        // R-1 / totality: a verdict that cannot be taken is never a reason to
        // fail the call that produced it.
        const audit = auditSpy()
        const registry = load({
            cores: {
                agent_trace: fakeEntry({
                    factory: () => ({ execute: () => ({ success: true, data: { reads: { x: 'ok' } } }) }),
                }),
            },
            auditLogger: audit,
            readKit: fakeKit(new Error('boom')),
        })

        const res = registry.dispatch('agent_trace', {}, { run_id: 'run1' })

        expect(res.success).toBe(true)
        expect(resultCall(audit).retrieval).toBe('unknown')
    })

    test('a PAGED_OUTPUT core skips thresholding and still gets a verdict', () => {
        const audit = auditSpy()
        const registry = load({
            cores: {
                read_artifact: fakeEntry({
                    factory: () => ({
                        PAGED_OUTPUT: true,
                        execute: () => ({ success: true, data: { content: 'abc' } }),
                    }),
                }),
            },
            auditLogger: audit,
            readKit: fakeKit('unknown'),
        })

        registry.dispatch('read_artifact', {}, { run_id: 'run1' })

        expect(resultCall(audit).retrieval).toBe('unknown')
    })

    test('a dispatch that throws logs an error row and no verdict', () => {
        const audit = auditSpy()
        const registry = load({
            cores: {
                agent_trace: fakeEntry({
                    factory: () => ({
                        execute: () => {
                            throw new Error('inner')
                        },
                    }),
                }),
            },
            auditLogger: audit,
            readKit: fakeKit('ok'),
        })

        registry.dispatch('agent_trace', {}, { run_id: 'run1' })

        expect(audit.calls.filter((c) => c[0] === 'logResult')).toHaveLength(0)
        expect(audit.calls.filter((c) => c[0] === 'logError')).toHaveLength(1)
    })
})

// ---------------------------------------------------------------------------
// retrieval verdict (#121 review finding 1) — THE END-TO-END LINK
//
// Every test above this point injects a `fakeKit` that returns a canned
// verdict and ignores its input — those tests prove dispatch() PLUMBS a
// verdict through to logResult, nothing about whether a REAL PaToolReadKit
// reading a REAL tool-core-shaped result produces the verdict this file
// assumes. test/PaToolReadKit.test.js proves the predicate in isolation, but
// nothing before this fed a core-shaped result through a real kit via a real
// dispatch() call. A shape mismatch between what the cores actually emit and
// what the predicate reads would slip through both suites unnoticed. These
// two tests are that missing link, built the same way
// test/PaToolReadKit.test.js builds its kit, and using genuinely core-shaped
// results already used elsewhere on this branch (DECISION.md §T4 row 07 /
// §U9.1 v10-2).
// ---------------------------------------------------------------------------

describe('retrieval verdict (#121 review finding 1) — real PaToolReadKit through a real dispatch', () => {
    function realKit() {
        return new (loadScriptInclude('PaToolReadKit.js', { JSON: JSON })).PaToolReadKit()
    }

    test("'none': a real kit reading a real schema_lookup-shaped barren result", () => {
        const audit = fakeAudit()
        const registry = load({
            cores: {
                schema_lookup: fakeEntry({
                    factory: () => ({
                        execute: () => ({
                            success: true,
                            data: {
                                table_exists: false,
                                finding: 'table_does_not_exist',
                                reads: { sys_db_object: 'empty' },
                            },
                        }),
                    }),
                }),
            },
            auditLogger: audit,
            readKit: realKit(),
        })

        const out = registry.dispatch('schema_lookup', {}, { run_id: 'run1' })

        expect(out.success).toBe(true)
        const resultRow = audit.calls.filter((c) => c[0] === 'result')[0][1]
        expect(resultRow.retrieval).toBe('none')
    })

    test("'ok': a real kit reading a real genai_log-shaped result that fetched rows", () => {
        const audit = fakeAudit()
        const registry = load({
            cores: {
                genai_log: fakeEntry({
                    factory: () => ({
                        execute: () => ({
                            success: true,
                            data: {
                                llm_call_rows: 3,
                                reads: { sys_generative_ai_log: 'ok' },
                            },
                        }),
                    }),
                }),
            },
            auditLogger: audit,
            readKit: realKit(),
        })

        const out = registry.dispatch('genai_log', {}, { run_id: 'run1' })

        expect(out.success).toBe(true)
        const resultRow = audit.calls.filter((c) => c[0] === 'result')[0][1]
        expect(resultRow.retrieval).toBe('ok')
    })
})

// ===========================================================================
// refusal auditing — issue #75
//
// dispatch() refuses on two gates and BOTH return before `logIntent`, so an
// attempt to invoke an unknown or destructive tool left zero trace. The
// destructive gate's stated rationale is that Phase 3's confirmation flow can
// stand on an honest record of every tool the model ATTEMPTED — an unaudited
// refusal is the single attempt a security review would most want to see.
//
// The refusal row is deliberately NOT evidence (PaAuditLogger.logRefusal
// explains the split), so `dispatched:false` and the §AQ depth-gate floor
// keep exactly the meaning they had before.
// ===========================================================================

describe('refusal auditing (#75)', () => {
    const RUN = 'run00000000000000000000000000000'

    test('an unknown tool is recorded as a refusal, naming the attempted tool', () => {
        const audit = fakeAudit()
        const registry = load({ auditLogger: audit })

        const res = registry.dispatch('not_a_tool', {}, { run_id: RUN })

        expect(res.success).toBe(false)
        const refusals = audit.calls.filter((c) => c[0] === 'refusal')
        expect(refusals).toHaveLength(1)
        expect(refusals[0][1].toolName).toBe('not_a_tool')
        expect(refusals[0][1].runId).toBe(RUN)
        expect(refusals[0][1].error).toMatch(/Unknown tool/)
        // and nothing pretended the tool ran
        expect(audit.calls.filter((c) => c[0] === 'intent')).toHaveLength(0)
    })

    test('a destructive/unmarked tool is recorded as a refusal', () => {
        const audit = fakeAudit()
        const registry = load({
            auditLogger: audit,
            cores: {
                risky: { layer: 'layer 9', readOnly: false, factory: () => ({ execute: () => ({ success: true }) }) },
            },
        })

        const res = registry.dispatch('risky', {}, { run_id: RUN })

        expect(res.success).toBe(false)
        const refusals = audit.calls.filter((c) => c[0] === 'refusal')
        expect(refusals).toHaveLength(1)
        expect(refusals[0][1].toolName).toBe('risky')
        expect(refusals[0][1].error).toMatch(/non-destructive/)
        expect(audit.calls.filter((c) => c[0] === 'intent')).toHaveLength(0)
    })

    test('the refusal marker survives — dispatched:false is still returned (§AT contract)', () => {
        const audit = fakeAudit()
        const registry = load({ auditLogger: audit })
        expect(registry.dispatch('not_a_tool', {}, { run_id: RUN }).dispatched).toBe(false)
    })

    test('an audit logger that throws never breaks the refusal (R-1)', () => {
        const registry = load({ auditLogger: fakeAudit({ throws: new Error('glide down') }) })
        expect(() => registry.dispatch('not_a_tool', {}, { run_id: RUN })).not.toThrow()
        expect(registry.dispatch('not_a_tool', {}, { run_id: RUN }).success).toBe(false)
    })

    test('a successful dispatch still audits intent, not a refusal', () => {
        const audit = fakeAudit()
        const registry = load({
            auditLogger: audit,
            cores: {
                fine: {
                    layer: 'layer 1',
                    readOnly: true,
                    destructive: false,
                    factory: () => ({ execute: () => ({ success: true, data: {} }) }),
                },
            },
        })

        registry.dispatch('fine', {}, { run_id: RUN })

        expect(audit.calls.filter((c) => c[0] === 'refusal')).toHaveLength(0)
        expect(audit.calls.filter((c) => c[0] === 'intent')).toHaveLength(1)
    })
})
