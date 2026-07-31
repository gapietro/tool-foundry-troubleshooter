# Task 9 — PaScriptToolAdapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the native-harness bridge that lets an AI Agent script tool call `PaToolAgentTrace` and page its output back through `PaArtifactStore`, at the two-wrapper scope (`agent_trace` + `read_artifact`).

**Architecture:** One `PaScriptToolAdapter` Script Include wraps every tool call in a fixed pipeline — tolerant input parse → run anchor → audit intent → tool execute → artifact threshold → audit result → `JSON.stringify`. Tools are resolved by name against an explicit factory map rather than by dynamic class name. A new thin core, `PaToolReadArtifact`, exposes `PaArtifactStore.read` as a tool and declares `PAGED_OUTPUT: true` so the adapter does not re-truncate its own pages.

**Tech Stack:** ServiceNow SDK (Fluent DSL) 4.9.2 · ES5 / Rhino-safe Script Includes in `src/server/` · Jest in `test/` · deploy target gpinst01.

**Spec:** `docs/superpowers/specs/2026-07-31-task-9-script-tool-adapter-design.md`
**Issue:** #22 · **Branch:** `feature/task-9-script-tool-adapter`

## Global Constraints

- **Every `.now.ts` file starts with** `import '@servicenow/sdk/global'`.
- **Script Includes for tool cores and the adapter are `accessibleFrom: 'public'`** — a script tool executes in `rhino.global`, not in `x_snc_troubleshoot`. `package_private` builds and installs cleanly, then fails at runtime (DESIGN.md R-5).
- **Script Include bodies are ES5 / Rhino-safe.** No `let`, `const`, arrow functions, `Set`, `Map`, `Object.assign`, `Array.prototype.find`, or template literals in `src/server/*.js`.
- **Jest tests live in `test/`, never under `src/`.** `now-sdk build` lints the whole source tree; a test's `require('vm')` fails the entire build and deploys nothing (DESIGN.md R-14).
- **Never read a caught exception object** — no `e.message`, no `String(e)`, no logging it. Reading `.message` off a `ScopeAccessNotGrantedException` throws again, escapes the handler and 500s the request (DESIGN.md R-1). Track a `phase` variable instead.
- **Fluent property values must be a SINGLE literal.** `'foo' + 'bar'` fails the parse with `TS303` (Build Rule #29).
- **No backtick and no `\n` escape inside a Fluent `` script`…` `` template.** A `\n` emits a real newline and leaves the string constant unterminated — builds and installs clean, fails at invocation with a line number that matches nothing. A backtick anywhere in the template, *including inside a `//` comment*, closes it (Build Rule #43).
- **Never commit to `main`.** All work on `feature/task-9-script-tool-adapter`, merged by PR.
- **Verify with `npm test` before every commit.**

---

## File Structure

| File | Responsibility |
|---|---|
| `src/server/tools/PaToolReadArtifact.js` | **New.** Tool core: normalise an artifact request, delegate to `PaArtifactStore.read`. Declares `PAGED_OUTPUT: true`. |
| `src/server/PaScriptToolAdapter.js` | **New.** The bridge. Tool registry, tolerant parse, the six-stage pipeline, total error containment. |
| `test/PaToolReadArtifact.test.js` | **New.** Argument normalisation and delegation. |
| `test/PaScriptToolAdapter.test.js` | **New.** Parse matrix, registry, pipeline ordering, `PAGED_OUTPUT` branch, degradation surfacing, error containment. |
| `src/fluent/script-includes.now.ts` | **Modify.** Two more `ScriptInclude` declarations. |
| `src/fluent/scope-readability.now.ts` | **Modify.** Add `POST /scope_probe/adapter`. |
| `package.json`, `README.md` | **Modify.** Version bump at merge. |

---

## Task 1: PaToolReadArtifact — the paged tool core

**Files:**
- Create: `src/server/tools/PaToolReadArtifact.js`
- Test: `test/PaToolReadArtifact.test.js`

**Interfaces:**
- Consumes: `PaArtifactStore.read(artifactId, offset, length)` from `src/server/PaArtifactStore.js:187` — returns `{success:true, data:{artifact_id, file_name, total_length, offset, length, next_offset, eof, page_size, content}}` or `{success:false, error}`. It already returns a structured error for an empty id, so this core does **not** duplicate that message.
- Produces: global `PaToolReadArtifact` with `PAGED_OUTPUT === true` and `execute(args)` accepting an Object, a JSON string, a bare sys_id, or nothing. Constructor takes `{store}` for injection.

- [ ] **Step 1: Write the failing test**

Create `test/PaToolReadArtifact.test.js`:

```js
/**
 * PaToolReadArtifact — pure-logic tests (IMPLEMENTATION_PLAN.md Task 9).
 *
 * This core exists for one structural reason: PaArtifactStore.MAX_PAGE_CHARS
 * (4000) equals THRESHOLD_CHARS (4000), so a full page plus its envelope always
 * exceeds the threshold. Routed through applyThreshold it would store each page
 * as a NEW artifact and hand back an excerpt of it — paging that pages. The
 * PAGED_OUTPUT flag is what stops that, so the first test asserts the flag
 * itself: it is load-bearing, not decoration.
 *
 * WHAT THESE DO NOT SETTLE: that reading a real attachment from
 * x_snc_troubleshoot works (DESIGN.md R-8). That is a gpinst01 check — Task 5.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')

const ARTIFACT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

/** Records what read() was called with and returns a canned page. */
function fakeStore(result) {
    const calls = []
    return {
        calls: calls,
        read: function (artifactId, offset, length) {
            calls.push({ artifactId: artifactId, offset: offset, length: length })
            return result === undefined
                ? { success: true, data: { artifact_id: artifactId, content: 'page', eof: true } }
                : result
        },
    }
}

function load(store) {
    const ctx = loadScriptInclude('tools/PaToolReadArtifact.js', { JSON: JSON })
    return new ctx.PaToolReadArtifact({ store: store })
}

describe('PaToolReadArtifact', () => {
    test('declares PAGED_OUTPUT so the adapter skips applyThreshold', () => {
        expect(load(fakeStore()).PAGED_OUTPUT).toBe(true)
    })

    test('a bare sys_id is read as the artifact id', () => {
        const store = fakeStore()
        load(store).execute(ARTIFACT)
        expect(store.calls[0].artifactId).toBe(ARTIFACT)
    })

    test('a JSON string carries offset and length through', () => {
        const store = fakeStore()
        load(store).execute('{"artifact_id":"' + ARTIFACT + '","offset":4000,"length":2000}')
        expect(store.calls[0]).toEqual({ artifactId: ARTIFACT, offset: 4000, length: 2000 })
    })

    test('an object is accepted directly, with camelCase and snake_case ids', () => {
        const store = fakeStore()
        load(store).execute({ artifactId: ARTIFACT, offset: 8000 })
        expect(store.calls[0].artifactId).toBe(ARTIFACT)
        expect(store.calls[0].offset).toBe(8000)
    })

    test('absent input delegates an empty id and returns the store error, never throws (R-9)', () => {
        const store = fakeStore({ success: false, error: 'read_artifact requires an artifact_id' })
        const out = load(store).execute()
        expect(out.success).toBe(false)
        expect(store.calls[0].artifactId).toBe('')
    })

    test('the store result is returned unchanged', () => {
        const page = { success: true, data: { content: 'abc', eof: false, next_offset: 4000 } }
        expect(load(fakeStore(page)).execute(ARTIFACT)).toEqual(page)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/PaToolReadArtifact.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'PaToolReadArtifact')`, because the source file does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/server/tools/PaToolReadArtifact.js`:

```js
/**
 * PaToolReadArtifact — the `read_artifact` tool core (LLD §4.5, Task 9).
 *
 * WHY THIS IS A SEPARATE CORE RATHER THAN THE ADAPTER CALLING THE STORE
 * PaArtifactStore.MAX_PAGE_CHARS is 4000 and THRESHOLD_CHARS is also 4000, so a
 * full page plus its envelope always exceeds the threshold. If paging went
 * through the adapter's ordinary path, applyThreshold would store every page as
 * a new attachment and return an excerpt of it — the agent would never reach the
 * content. `PAGED_OUTPUT` is how the adapter knows to skip that stage, and it
 * lives here rather than in the Fluent wrapper literal because a wrapper literal
 * is a string no unit test can reach.
 *
 * Read-only. Every access-control question is the store's: read() refuses any
 * attachment that is not on x_snc_troubleshoot_run.
 */
var PaToolReadArtifact = Class.create()

PaToolReadArtifact.prototype = {
    /** The adapter reads this to skip applyThreshold. See the header. */
    PAGED_OUTPUT: true,

    /**
     * @param {Object} [options] {store} — injection point for tests.
     */
    initialize: function (options) {
        var o = options || {}
        this._store = o.store || null
    },

    /**
     * @param {Object|String} [args] {artifact_id, offset, length}, a JSON string
     *        of the same, a bare artifact sys_id, or nothing (R-9).
     * @returns {Object} whatever PaArtifactStore.read returns.
     */
    execute: function (args) {
        var a = this._normalizeArgs(args)
        var store = this._store || new PaArtifactStore()

        // Delegated deliberately even when the id is empty: the store owns the
        // "requires an artifact_id" message, and two copies of it drift.
        return store.read(a.artifact_id, a.offset, a.length)
    },

    /**
     * Tolerant, in the same shape as PaToolAgentTrace._normalizeArgs. An
     * unrecognisable bare string is treated as an artifact id rather than
     * rejected here — the store answers with a specific "no readable attachment
     * with sys_id X", which tells the caller more than a generic parse error.
     */
    _normalizeArgs: function (args) {
        var raw = args
        if (raw === null || raw === undefined) return { artifact_id: '' }

        if (typeof raw === 'string') {
            var s = this._trim(raw)
            if (!s) return { artifact_id: '' }

            var parsed = this._tryParse(s)
            if (parsed && typeof parsed === 'object' && !this._isArray(parsed)) {
                raw = parsed
            } else {
                return { artifact_id: s }
            }
        }

        if (typeof raw !== 'object' || this._isArray(raw)) return { artifact_id: '' }

        return {
            artifact_id: this._str(raw.artifact_id || raw.artifactId || raw.artifact || raw.id),
            offset: this._num(raw.offset),
            length: this._num(raw.length),
        }
    },

    _tryParse: function (s) {
        try {
            return JSON.parse(s)
        } catch (e) {
            // R-1: `e` untouched. A non-JSON string is an artifact id.
            return null
        }
    },

    _isArray: function (v) {
        return Object.prototype.toString.call(v) === '[object Array]'
    },

    _trim: function (s) {
        return String(s === null || s === undefined ? '' : s).replace(/^\s+|\s+$/g, '')
    },

    _str: function (v) {
        return v === null || v === undefined ? '' : this._trim(v)
    },

    /** undefined rather than 0, so the store applies its own defaults. */
    _num: function (v) {
        if (v === null || v === undefined || v === '') return undefined
        var n = Number(v)
        return isNaN(n) ? undefined : n
    },

    type: 'PaToolReadArtifact',
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest test/PaToolReadArtifact.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/tools/PaToolReadArtifact.js test/PaToolReadArtifact.test.js
git commit -m "feat: add PaToolReadArtifact, the paged read_artifact tool core

PAGED_OUTPUT: true is load-bearing, not decoration. MAX_PAGE_CHARS (4000)
equals THRESHOLD_CHARS (4000), so a full page plus its envelope always
exceeds the threshold — without the flag the adapter would store every page
as a new artifact and return an excerpt of it.

Refs #22"
```

---

## Task 2: PaScriptToolAdapter — input handling and registry

**Files:**
- Create: `src/server/PaScriptToolAdapter.js`
- Test: `test/PaScriptToolAdapter.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime; the registry names `PaToolReadArtifact` but tests inject fakes.
- Produces: global `PaScriptToolAdapter`. Constructor takes `{tools, runAnchor, auditLogger, artifactStore}` — all optional injection points. `invoke(toolName, rawInput, ctx)` returns a **String on every path**. `tolerantParse(rawInput)` returns an Object or a String.

This task builds the shell: registry lookup, `tolerantParse`, stringification, and the never-throw guarantee. Task 3 fills in the pipeline stages.

- [ ] **Step 1: Write the failing test**

Create `test/PaScriptToolAdapter.test.js`:

```js
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
            return result === undefined ? { success: true, truncated: true, artifact_id: 'art1' } : result
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
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/PaScriptToolAdapter.test.js`
Expected: FAIL — `PaScriptToolAdapter is not a constructor`.

- [ ] **Step 3: Write the implementation**

Create `src/server/PaScriptToolAdapter.js`:

```js
/**
 * PaScriptToolAdapter — the native harness bridge (LLD §4.7, Task 9).
 *
 * An AI Agent script tool is a one-line IIFE that calls invoke(). Everything
 * between the orchestrator and a tool core happens here: tolerant input
 * parsing, run anchoring, audit, artifact thresholding, and — above all —
 * containment. invoke() returns a String on EVERY path, including every failure
 * path. A thrown exception reaching the planner is a documented native pain
 * point, and an exception is the worst shape of all to hand it.
 *
 * TOOLS ARE RESOLVED BY NAME AGAINST A FACTORY MAP, NOT BY CLASS NAME.
 * LLD §4.7 writes the signature as invoke(toolClassName, ...). This deviates
 * deliberately: the first argument originates in a tool-script literal and
 * beyond that in whatever the platform hands the wrapper, so resolving an
 * arbitrary class by string is a code-execution surface. A factory map is a
 * closed set, errors cleanly on a typo, and its key is the same string written
 * to x_snc_troubleshoot_audit.tool_name — so the registry and the audit trail
 * cannot drift apart.
 *
 * accessibleFrom 'public': a script tool runs in rhino.global, not in
 * x_snc_troubleshoot (DESIGN.md R-5).
 */
var PaScriptToolAdapter = Class.create()

PaScriptToolAdapter.prototype = {
    /**
     * @param {Object} [options] {tools, runAnchor, auditLogger, artifactStore}
     *        — injection points for tests and for the probe route.
     */
    initialize: function (options) {
        var o = options || {}
        this._tools = o.tools || null
        this._runAnchor = o.runAnchor || null
        this._auditLogger = o.auditLogger || null
        this._artifactStore = o.artifactStore || null
    },

    // =======================================================================
    // Registry
    // =======================================================================

    /**
     * Name -> factory. Two entries at this scope; the remaining five wrappers
     * land with their cores in Tasks 7 and 8.
     */
    _registry: function () {
        if (this._tools) return this._tools
        return {
            agent_trace: function () {
                return new PaToolAgentTrace()
            },
            read_artifact: function () {
                return new PaToolReadArtifact()
            },
        }
    },

    /** @returns {Array} the registered tool names — used in the unknown-tool error. */
    toolNames: function () {
        var reg = this._registry()
        var names = []
        for (var k in reg) {
            if (Object.prototype.hasOwnProperty.call(reg, k)) names.push(k)
        }
        return names
    },

    // =======================================================================
    // invoke
    // =======================================================================

    /**
     * @param {String} toolName a key of the registry
     * @param {Object|String} [rawInput] the wrapper's single `request` input
     * @param {Object|String} [ctx] passed to PaRunAnchor.getOrCreate
     * @returns {String} ALWAYS a string, never a throw
     */
    invoke: function (toolName, rawInput, ctx) {
        var phase = 'lookup'
        var name = ''
        var runId = ''

        try {
            name = this._normName(toolName)
            var factory = this._registry()[name]
            if (typeof factory !== 'function') {
                // Short-circuit BEFORE any side effect: no anchor for a call
                // that never happened, no audit row for a tool that does not
                // exist.
                return this._errorString(
                    'Unknown tool ' + this._quote(name) + '. Available tools: ' + this.toolNames().join(', ') + '.',
                    'lookup'
                )
            }

            phase = 'parse'
            var args = this.tolerantParse(rawInput)

            phase = 'anchor'
            var run = this._anchor().getOrCreate(ctx)
            runId = run && run.run_id ? String(run.run_id) : ''

            phase = 'intent'
            this._audit('logIntent', { runId: runId, toolName: name, input: args })

            phase = 'execute'
            var core = factory()
            var result = core.execute(args)

            phase = 'threshold'
            if (!core.PAGED_OUTPUT) {
                result = this._store().applyThreshold(runId, result, name)
            }

            phase = 'result'
            result = this._attachRunState(result, run)
            this._audit('logResult', { runId: runId, toolName: name, output: result })

            phase = 'serialize'
            return this._stringify(result)
        } catch (e) {
            // R-1: `e` is NEVER inspected. `phase` is what localises the failure.
            this._audit('logError', {
                runId: runId,
                toolName: name,
                error: 'Adapter failed at phase ' + phase + '.',
            })
            return this._errorString(
                'The diagnostic tool ' +
                    this._quote(name) +
                    ' failed at stage ' +
                    this._quote(phase) +
                    '. The underlying exception is deliberately not inspected, because reading one from a ' +
                    'cross-scope denial throws again. Treat this tool as unavailable for this call rather than ' +
                    'as returning no data.',
                phase
            )
        }
    },

    // =======================================================================
    // Input
    // =======================================================================

    /**
     * LLD §4.7: JSON object -> object, "" -> {}, BARE STRING -> UNCHANGED.
     *
     * The last clause is the one that gets "helpfully" broken. Pre-wrapping a
     * bare string as {value: s} produces an args object with none of the keys
     * the cores read: PaToolAgentTrace maps a bare 32-char hex string to
     * {execution: ...} and any other bare string to {agent: ...}, so a wrapper
     * makes it fall through to the recent-plan pick-list and silently discard
     * the caller's actual request. Nothing errors.
     *
     * A bare string is returned ORIGINAL AND UNTOUCHED (LLD §4.7 Note 4). Trimming
     * is for the purpose of deciding what an input means; once the decision is made
     * (this is a string, not JSON), it passes through as received. The tool core
     * owns all normalisation. It never rejects: a '{'-leading string that fails to
     * parse goes through untouched so the core emits its own _parse_error. One place
     * decides what an input means, and it is not this one.
     */
    tolerantParse: function (rawInput) {
        if (rawInput === null || rawInput === undefined) return {}

        if (typeof rawInput === 'object') return rawInput

        if (typeof rawInput !== 'string') return {}

        var original = String(rawInput)
        var s = original.replace(/^\s+|\s+$/g, '')
        if (!s) return {}

        var parsed = null
        try {
            parsed = JSON.parse(s)
        } catch (e) {
            // R-1: `e` untouched.
            parsed = null
        }

        if (parsed && typeof parsed === 'object' && Object.prototype.toString.call(parsed) !== '[object Array]') {
            return parsed
        }

        return original
    },

    // =======================================================================
    // Collaborators — lazily resolved so tests can inject
    // =======================================================================

    _anchor: function () {
        return this._runAnchor || new PaRunAnchor()
    },

    _store: function () {
        return this._artifactStore || new PaArtifactStore()
    },

    /**
     * Audit is best-effort by construction. It sits in the hot path, and an
     * audit failure must never become a tool failure — the caller came for a
     * diagnosis, not for a durable trail.
     */
    _audit: function (method, params) {
        try {
            var logger = this._auditLogger || new PaAuditLogger()
            if (logger && typeof logger[method] === 'function') logger[method](params)
        } catch (e) {
            // R-1: `e` untouched, and deliberately swallowed.
        }
    },

    // =======================================================================
    // Output
    // =======================================================================

    /**
     * R-10 applied one layer out. PaRunAnchor can degrade to run_id: null, and
     * PaArtifactStore and PaAuditLogger both tolerate that quietly — but the
     * AGENT is never told. A diagnosis whose evidence trail was not durable is
     * still a valid diagnosis; the difference has to be stated rather than
     * inferred. Non-destructive: the core's own result is never mutated.
     */
    _attachRunState: function (result, run) {
        if (!run || !run.degraded) return result
        if (!result || typeof result !== 'object') return result
        if (Object.prototype.toString.call(result) === '[object Array]') return result

        var out = {}
        for (var k in result) {
            if (Object.prototype.hasOwnProperty.call(result, k)) out[k] = result[k]
        }
        out.run = { degraded: run.degraded, note: run.note }
        return out
    },

    _stringify: function (value) {
        if (typeof value === 'string') return value
        return JSON.stringify(value)
    },

    _errorString: function (message, phase) {
        return JSON.stringify({ success: false, error: message, phase: phase })
    },

    _normName: function (v) {
        return String(v === null || v === undefined ? '' : v).replace(/^\s+|\s+$/g, '')
    },

    _quote: function (v) {
        return '"' + String(v) + '"'
    },

    type: 'PaScriptToolAdapter',
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest test/PaScriptToolAdapter.test.js`
Expected: PASS, 13 tests (the `test.each` block counts as 4).

Note the cyclic-result case passes because `JSON.stringify` throws inside the `try`, `phase` is already `'serialize'`, and the catch returns the phased error envelope.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS — the 194 existing tests plus the new ones.

- [ ] **Step 6: Commit**

```bash
git add src/server/PaScriptToolAdapter.js test/PaScriptToolAdapter.test.js
git commit -m "feat: add PaScriptToolAdapter shell — registry, parse, containment

Tools resolve by NAME against a factory map rather than by dynamically
resolved class name: the first argument originates in a tool-script literal,
so resolving an arbitrary class by string is a code-execution surface. The
registry key is also the audit tool_name, so the two cannot drift.

tolerantParse passes a bare string through UNCHANGED (LLD §4.7 Note 4).
Wrapping it as {value: s} makes PaToolAgentTrace fall through to its
recent-plan pick-list and silently discard the caller's request.

Refs #22"
```

---

## Task 3: PaScriptToolAdapter — pipeline behaviour

**Files:**
- Modify: `test/PaScriptToolAdapter.test.js` — append a second `describe` block
- Modify: `src/server/PaScriptToolAdapter.js` — only if a test exposes a defect

**Interfaces:**
- Consumes: `PaRunAnchor.getOrCreate(context)` → `{run_id, number, created, keyed, key_source, conversation_id, execution_ref, harness}` or the degraded shape `{run_id: null, degraded, note, ...}` (`src/server/PaRunAnchor.js:188`); `PaAuditLogger.logIntent/logResult/logError(params)` where params are `{runId, toolName, input|output|error}` (`src/server/PaAuditLogger.js:98`); `PaArtifactStore.applyThreshold(runId, result, toolName)` (`src/server/PaArtifactStore.js:292`).
- Produces: nothing new — this task proves the pipeline written in Task 2 behaves.

The implementation already exists. These tests are the gate on it; write them, and fix the source only where they fail.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaScriptToolAdapter.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests**

Run: `npx jest test/PaScriptToolAdapter.test.js`
Expected: PASS. If any fail, the defect is in `src/server/PaScriptToolAdapter.js` — fix it there, not in the test.

Two failures to expect and how to read them:
- **`run id is '' not null`** — `runId` must be assigned `''` when `run.run_id` is falsy. `PaArtifactStore._getRun` treats an empty string as "no anchor" and degrades cleanly; `null` would be stringified into a query.
- **`error row runId is 'run1'`** — the catch must read the `runId` captured in the outer scope, not re-derive it. If it reports `''` after a successful anchor, `runId` was declared inside the `try` block.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add test/PaScriptToolAdapter.test.js src/server/PaScriptToolAdapter.js
git commit -m "test: gate the adapter pipeline — ordering, paging, degradation

Covers the three behaviours that fail silently in production if wrong:
intent logged before execute (the only trace of a call that hangs),
PAGED_OUTPUT skipping applyThreshold (the 4000/4000 collision), and a
degraded run anchor surfacing to the agent rather than being swallowed.

Refs #22"
```

---

## Task 4: Fluent declarations and the probe route

**Files:**
- Modify: `src/fluent/script-includes.now.ts` — append two `ScriptInclude` declarations
- Modify: `src/fluent/scope-readability.now.ts` — append one route to the `routes` array

**Interfaces:**
- Consumes: `PaScriptToolAdapter.invoke(toolName, rawInput, ctx)` from Task 2.
- Produces: two deployable Script Includes and `POST /api/x_snc_troubleshoot/scope_probe/adapter`, which accepts `{tool, request}` and returns the adapter's raw string under `output`.

- [ ] **Step 1: Add the two Script Include declarations**

Append to `src/fluent/script-includes.now.ts`, before the closing of the file. Descriptions are **single backtick literals** — no `+` concatenation (Build Rule #29).

```ts
/**
 * PaToolReadArtifact — LLD §4.5, the `read_artifact` tool core.
 *
 * A tool core, unlike PaArtifactStore above: it is reachable from an agent.
 * It carries PAGED_OUTPUT so the adapter skips applyThreshold — MAX_PAGE_CHARS
 * and THRESHOLD_CHARS are both 4000, so a full page plus its envelope always
 * exceeds the threshold and would otherwise be stored as a new artifact.
 *
 * accessibleFrom 'public' for the standing reason (DESIGN.md R-5).
 */
export const paToolReadArtifact = ScriptInclude({
    $id: Now.ID['pa-tool-read-artifact'],
    name: 'PaToolReadArtifact',
    // Build Rule #29: ONE literal, no `+` concatenation.
    description: `Agent Doctor tool core: reads back a stored diagnostic artifact one 4KB page at a time. execute(args) accepts an artifact sys_id, a JSON object {artifact_id, offset, length}, or nothing, and delegates to PaArtifactStore.read - which refuses any attachment that is not on the diagnostic run table. Declares PAGED_OUTPUT so the script-tool adapter does not re-truncate its own pages.`,
    active: true,
    accessibleFrom: 'public',
    script: Now.include('../server/tools/PaToolReadArtifact.js'),
})

/**
 * PaScriptToolAdapter — LLD §4.7, the native harness bridge.
 *
 * Every AI Agent script tool is a one-line IIFE calling invoke(). This is the
 * one Script Include that must never throw: an exception reaching the native
 * orchestrator is a documented pain point, so invoke() returns a String on
 * every path.
 *
 * accessibleFrom 'public' is not optional here — this is the FIRST thing called
 * from rhino.global, so package_private would fail every tool call at runtime
 * while building and installing perfectly (DESIGN.md R-5).
 */
export const paScriptToolAdapter = ScriptInclude({
    $id: Now.ID['pa-script-tool-adapter'],
    name: 'PaScriptToolAdapter',
    // Build Rule #29: ONE literal, no `+` concatenation.
    description: `Agent Doctor infrastructure: the bridge between an AI Agent script tool and a diagnostic tool core. invoke(toolName, request, context) resolves the tool by name against a closed registry, parses the request tolerantly - a bare string is passed through unchanged - anchors the diagnostic run, audit-logs intent and result around the call, applies the artifact threshold to oversized output, and returns a JSON string. It never throws into the orchestrator; failures come back as a structured error naming the stage that failed.`,
    active: true,
    accessibleFrom: 'public',
    script: Now.include('../server/PaScriptToolAdapter.js'),
})
```

- [ ] **Step 2: Add the probe route**

Append to the `routes` array in `src/fluent/scope-readability.now.ts`, after the `anchor_selftest` route.

⚠ Build Rule #43 governs everything inside the `` script`…` `` template: **no backtick anywhere, including in a comment**, and **no `\n` escape** — a `\n` emits a real newline and leaves the string constant unterminated, which builds and installs clean and fails only at invocation, at a line number matching nothing.

```ts
        // -------------------------------------------------------------------
        // TEMPORARY — deleted at Task 10 together with the other three probes.
        //
        // The vertical-slice brief says the probe routes come out when the Task 9
        // adapter lands. Deferred by one task deliberately: deleting them here
        // leaves the adapter verifiable only through an AiAgent that does not
        // exist yet, so its first exercise would be inside Task 10, where an
        // adapter defect and an agent-definition defect are indistinguishable.
        //
        // Read-only in effect: the adapter writes a run record, an audit row and
        // possibly an artifact, all inside this app. The tools it reaches only
        // read.
        // -------------------------------------------------------------------
        {
            $id: Now.ID['scope-probe-adapter'],
            version: 1,
            name: 'Script Tool Adapter Probe',
            path: '/adapter',
            method: 'POST',
            active: true,
            authentication: true,
            authorization: true,
            shortDescription: 'TEMPORARY verification harness for PaScriptToolAdapter - remove at Task 10',
            script: script`(function process(request, response) {
    var out;

    try {
        var body = {};
        try {
            if (request.body && request.body.data) {
                body = request.body.data;
            }
        } catch (bodyErr) {
            body = {};
        }

        var tool = body.tool;
        if (tool === undefined || tool === null || tool === '') {
            tool = 'agent_trace';
        }

        // Passed to invoke() exactly as received. The whole point of this route
        // is to exercise the tolerant-parse path the wrapper will feed it, so it
        // must not normalise anything on the way in.
        var payload = body.request;

        // No identity in the context. PaRunAnchor reads the ambient
        // _agentic_context_ itself and lets it win, which is what the real
        // wrapper relies on; supplying a conversation id here would exercise a
        // path the wrapper never takes.
        var adapterOut = new PaScriptToolAdapter().invoke(String(tool), payload, {});

        // invoke() returns a STRING by contract. Handing it back raw is the
        // point: if it is ever not a string, this route is where that shows.
        out = {
            success: true,
            tool: String(tool),
            output_type: typeof adapterOut,
            output: adapterOut
        };
    } catch (e) {
        // Never touch the exception object - a cross-scope denial throws again
        // when read and escapes the handler (DESIGN.md R-1).
        out = {
            success: false,
            error: 'Adapter probe route failed outside invoke(). That should be impossible - invoke() contains its own failures - so suspect the Script Include did not resolve from this scope. Exception detail deliberately not read, see DESIGN.md R-1.'
        };
    }

    response.setStatus(200);
    response.setContentType('application/json');
    response.getStreamWriter().writeString(JSON.stringify(out));
})(request, response);`,
        },
```

- [ ] **Step 3: Build**

Run: `now-sdk build`
Expected: SUCCESS.

If it fails, check in this order — these are the three that bite:
1. `TS303: Failed to parse property` on a `description` → a `+` crept into the literal (Rule #29).
2. `TS2796` / `TS304` / `RestApiPlugin failed to transform` with line numbers scattered across the file → a **backtick inside the `script` template**, including in a comment. Grep the template for a backtick before reading any of the errors; they point everywhere except at the cause (Rule #43).
3. `TS213: Unsupported variable initializer` → a `script:` value that is not a single literal.

- [ ] **Step 4: Verify the generated keys**

Run: `grep -n "pa-tool-read-artifact\|pa-script-tool-adapter\|scope-probe-adapter" src/fluent/generated/keys.ts`
Expected: three entries present.

- [ ] **Step 5: Commit**

```bash
git add src/fluent/script-includes.now.ts src/fluent/scope-readability.now.ts src/fluent/generated/keys.ts
git commit -m "feat: declare adapter and read_artifact Script Includes, add probe route

Both accessibleFrom 'public' — a script tool runs in rhino.global, and the
adapter is the FIRST thing called from there, so package_private would fail
every tool call at runtime while building and installing perfectly (R-5).

POST /scope_probe/adapter makes the adapter drivable before an AiAgent
exists. It and the three existing probe routes are deleted together at
Task 10.

Refs #22"
```

---

## Task 5: Deploy and verify on gpinst01

**Files:**
- Modify: `package.json` — version → `2026.07.3110`
- Modify: `README.md` — version badge → `2026.07.3110`

**Interfaces:**
- Consumes: everything above.
- Produces: live evidence that the 4000/4000 paging collision is closed, and a merged PR.

This is the task the whole plan exists for. A stub result is not evidence about platform behaviour in either direction (DESIGN.md R-8) — nothing before this point proves the adapter resolves from `rhino.global` or that an artifact round-trips.

- [ ] **Step 1: Install**

Run: `now-sdk install --alias gpinst01`
Expected: SUCCESS.

- [ ] **Step 2: Drive `agent_trace` at the known-answer specimen**

Use the foundry MCP tools — `servicenow_connect` then `servicenow_request` — never `curl`. Credentials are brokered server-side and must not enter a shell command.

`POST /api/x_snc_troubleshoot/scope_probe/adapter` with body:

```json
{ "tool": "agent_trace", "request": "c9d63a932bda8b9417a6ffbeee91bfd0" }
```

Expected: `output_type` is `"string"`. Parse `output` and expect `truncated: true`, a 32-char `artifact_id`, a numeric `pages`, and a `total_length` around 35,000.

**Record the `artifact_id` and the `total_length`.** Step 3 needs both.

If `truncated` is absent, the trace came back under 4,000 chars — check `evidence_basis` in the output before concluding anything. A tool returning a plausible summary from empty data is this project's standing failure mode, and the specimen's defect is invisible from the plan header (`state=Completed`, empty `state_reason`, all 11 tasks and 5 tool calls `Success`).

- [ ] **Step 3: Page it back through `read_artifact`**

Repeat with:

```json
{ "tool": "read_artifact", "request": "{\"artifact_id\":\"<from step 2>\",\"offset\":0}" }
```

Then follow `next_offset` until `eof` is `true`.

Expected on every page: `success: true`, `content.length` of 4000 except the last, and — the point of the exercise — **no `truncated` field and no `artifact_id` naming a *new* attachment**. A second artifact id appearing here means `PAGED_OUTPUT` is not being honoured and the adapter is paging its own pages.

- [ ] **Step 4: Assert the round trip**

Concatenate the pages and compare against step 2's `total_length`.
Expected: the reassembled length equals `total_length` exactly.

This is the measurement that closes the 4000/4000 hazard. Record the numbers in the PR body — "it worked" is not evidence.

- [ ] **Step 5: Verify the audit trail**

Query `x_snc_troubleshoot_audit` via `servicenow_query`, ordered by `sys_created_on` descending.

Expected: rows for both calls; `tool_name` values `agent_trace` and `read_artifact`; `intent` written before `result` for each; every row carrying a `run` reference. Then query `x_snc_troubleshoot_run` and confirm the calls resolved to **separate** runs — the probe route supplies no conversation id and there is no `_agentic_context_` on a REST call, so each call is an isolated unkeyed run. That is R-2 behaving correctly, not a defect; the wrapper is where a shared conversation key comes from.

- [ ] **Step 6: Bump the version**

Edit `package.json` `"version"` to `2026.07.3110` and the `README.md` badge to match.

- [ ] **Step 7: Full suite and final commit**

```bash
npm test
git add package.json README.md
git commit -m "chore: bump version to 2026.07.3110

Refs #22"
git push -u origin feature/task-9-script-tool-adapter
```

- [ ] **Step 8: Open the PR**

Body must carry the measured numbers from steps 2–5 — the artifact id, `total_length`, page count, reassembled length, and the audit row ids. Close with `Closes #22`.

---

## Self-Review

**Spec coverage.** §1 scope → Tasks 1–5 build exactly `agent_trace` + `read_artifact`. §2 components → Tasks 1, 2, 4 create every listed file. §3 registry → Task 2 Step 3 `_registry`/`toolNames`, tested. §4.1 `tolerantParse` → Task 2 test matrix, all seven rows. §4.2 `PAGED_OUTPUT` → Task 1 (flag) + Task 3 (branch, both directions). §4.3 degradation → Task 3, degraded and healthy cases. §5 error handling → Task 3, four containment tests incl. the hostile exception. §6 testing → Tasks 1–3 pure logic, Task 5 live. §6 route lifecycle → Task 4 Step 2 comment records the one-task deferral. §7 wrapper literals → carried in the spec for Task 10, not built here, as §1 states. §8 done-when → Task 5. §9 out of scope → nothing in this plan touches it.

**Type consistency.** `PAGED_OUTPUT` spelled identically in Tasks 1, 2, 3, 4. `invoke(toolName, rawInput, ctx)` consistent across Tasks 2, 3, 4. `tolerantParse` named the same in spec §4.1 and Task 2. Audit params `{runId, toolName, input|output|error}` match `PaAuditLogger._normParams` at `src/server/PaAuditLogger.js:202`, which accepts `runId`/`run`/`run_id` and `toolName`/`tool`/`tool_name`. `applyThreshold(runId, result, toolName)` matches `src/server/PaArtifactStore.js:292`. `read(artifactId, offset, length)` matches `src/server/PaArtifactStore.js:187`.

**Deliberate gap.** The two wrapper IIFE literals are specified in spec §7 but built in Task 10, because a script tool cannot deploy without the `AiAgent` that owns it and Build Rule #29 forbids referencing them as a shared constant. Stated, not silently dropped.
