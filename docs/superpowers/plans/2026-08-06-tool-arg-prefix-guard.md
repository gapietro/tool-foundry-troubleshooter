# Tool argument `<param>:<value>` prefix guard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a `<param>:<value>`-prefixed argument from silently retrieving nothing, on every one of the seven diagnostic tools rather than only the one the harness happened to call.

**Architecture:** A pure string helper `PaToolReadKit.splitParamPrefix(s, paramNames)` recognises a leading parameter name and returns `{param, value, raw}`. Each tool's bare-string branch calls it, and on a match synthesizes a one-key object `{<param>: value}` that re-enters the tool's **existing** object branch — so every alias table, coercion and mode inference the tool already owns applies for free. The repair is never silent: each tool pushes a note naming the raw string as sent. Two tools that do not use `PaToolReadKit` get a private copy of the helper; `schema_lookup`'s live-verified guard is not touched.

**Tech Stack:** ES5 / Rhino-safe JavaScript (ServiceNow scoped Script Includes), Jest 29 for unit tests, `now-sdk` 4.9.2 for build + install.

**Spec:** `docs/superpowers/specs/2026-08-06-tool-arg-prefix-guard-design.md`
**Issue:** #122
**Branch:** `fix/122-tool-arg-prefix-guard` (already created, spec already committed)

## Global Constraints

- **ES5 only.** Server code runs on Rhino. No `let`/`const`, no arrow functions, no `Set`/`Map`, no `Array.prototype.includes`, no template literals in `src/server/**`. Use `var`, `function`, and index loops. (Test files under `test/` are Node and may use modern syntax — follow each file's existing style.)
- **R-1: never read a caught exception object.** `catch (e)` bodies must not touch `e` — reading `.message` on a `ScopeAccessNotGrantedException` throws again and 500s the request. Existing `catch` blocks carry an `// R-1:` comment; preserve it.
- **Build Rule #43.** Text added to `src/fluent/agent-doctor.now.ts` sits inside a Fluent backtick template. It must contain **no backtick, no `\n`, no `${`**. A backtick fails the build with diagnostics pointing at unrelated lines; an escape sequence installs cleanly and fails only at invocation.
- **Description parity is enforced.** `test/PaToolRegistry.test.js:462` asserts every tool description in `src/server/PaToolRegistry.js` equals the one in `src/fluent/agent-doctor.now.ts` byte-for-byte. Any description edit must land in both files.
- **`schema_lookup` is untouched.** Do not modify `src/server/tools/PaToolSchemaLookup.js` or `schema_lookup`'s description in either file.
- **Issue #41 stays open.** Do not migrate `PaToolAgentTrace` or `PaToolReadArtifact` onto `PaToolReadKit`.
- **Read the target test file's helper before writing tests in it.** Each tool suite defines its own loader near the top — `PaToolLogAnalysis.test.js:34` is `run(args, tables, options)` returning `{result, queries}`, and the others differ in name, arity and return shape. The test code in this plan is written against that shape; adapt the destructuring to whatever the file already uses, and **do not** add or modify a helper.
- **Baseline suite:** 1160 passing, 26 suites. The suite must be green at every commit.
- **Never commit to `main`.** All work on `fix/122-tool-arg-prefix-guard`; merge via PR.
- **Version on merge:** `package.json` and the `README.md` badge go to `2026.08.0602`.

---

### Task 1: `PaToolReadKit.splitParamPrefix`

The pure helper, with no tool wired to it yet. Nothing else in the plan can be written without it.

**Files:**
- Modify: `src/server/PaToolReadKit.js` (insert after `isSysId`, ~line 510)
- Test: `test/PaToolReadKit.test.js`

**Interfaces:**
- Consumes: `this.trim(s)`, `this.lower(v)` — existing `PaToolReadKit` methods.
- Produces: `splitParamPrefix(s, paramNames)` → `{param, value, raw}` or `null`. `param` is the **canonical** spelling as it appears in `paramNames` (not the caller's casing). `value` is trimmed and always non-empty. `raw` is the trimmed original string. Every later task calls this or a verbatim private copy of it.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaToolReadKit.test.js`. The file already has `kitWith(...)` at the top; add a describe block at the end of the file:

```javascript
// ---------------------------------------------------------------------------
// splitParamPrefix — the parameter name prefixed onto its own value (#111, #122)
// ---------------------------------------------------------------------------
describe('splitParamPrefix (#122)', () => {
    const kit = () => kitWith(makeGlideRecordSecure([]))
    const GENAI = ['mode', 'execution', 'execution_plan', 'plan', 'capability']

    it('splits the measured genai_log malformation on a colon', () => {
        const r = kit().splitParamPrefix('execution:45bbfd112ba6cf54f243fed2ce91bfcb', GENAI)

        expect(r).toEqual({
            param: 'execution',
            value: '45bbfd112ba6cf54f243fed2ce91bfcb',
            raw: 'execution:45bbfd112ba6cf54f243fed2ce91bfcb',
        })
    })

    it('splits on an equals sign as well as a colon', () => {
        expect(kit().splitParamPrefix('mode=llm', GENAI)).toEqual({
            param: 'mode',
            value: 'llm',
            raw: 'mode=llm',
        })
    })

    it('tolerates whitespace around the separator', () => {
        const r = kit().splitParamPrefix('  execution : 45bb  ', GENAI)

        expect(r.param).toBe('execution')
        expect(r.value).toBe('45bb')
    })

    it('matches the parameter name case-insensitively', () => {
        expect(kit().splitParamPrefix('EXECUTION:45bb', GENAI).param).toBe('execution')
    })

    it('returns the CANONICAL spelling, so a camelCase parameter survives', () => {
        // The object branches read raw.encodedQuery and raw.artifactId
        // verbatim. Returning the caller's lower-cased spelling would
        // synthesize {encodedquery: ...}, which nothing reads — the repair
        // would silently drop the value.
        const names = ['table', 'query', 'encoded_query', 'encodedQuery']

        expect(kit().splitParamPrefix('encodedquery:active=true', names).param).toBe('encodedQuery')
    })

    it('requires the whole segment to be a parameter name', () => {
        expect(kit().splitParamPrefix('executions:45bb', GENAI)).toBeNull()
        expect(kit().splitParamPrefix('my execution:45bb', GENAI)).toBeNull()
    })

    it('does not match a separator inside a value — the anchoring guard', () => {
        // An encoded query is the realistic hazard: it carries both `=` and
        // `:`, and neither is a parameter prefix.
        const names = ['table', 'query', 'limit']
        const encoded = 'sys_created_on>=javascript:gs.beginningOfToday()'

        expect(kit().splitParamPrefix(encoded, names)).toBeNull()
    })

    it('returns null rather than an empty repair when the value is missing', () => {
        expect(kit().splitParamPrefix('execution:', GENAI)).toBeNull()
        expect(kit().splitParamPrefix('execution:   ', GENAI)).toBeNull()
    })

    it('returns null for a leading separator, an empty string and no names', () => {
        expect(kit().splitParamPrefix(':45bb', GENAI)).toBeNull()
        expect(kit().splitParamPrefix('', GENAI)).toBeNull()
        expect(kit().splitParamPrefix('execution:45bb', [])).toBeNull()
        expect(kit().splitParamPrefix('execution:45bb', null)).toBeNull()
    })

    it('leaves an ordinary bare argument alone', () => {
        expect(kit().splitParamPrefix('llm', GENAI)).toBeNull()
        expect(kit().splitParamPrefix('45bbfd112ba6cf54f243fed2ce91bfcb', GENAI)).toBeNull()
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaToolReadKit.test.js -t splitParamPrefix`
Expected: FAIL — `TypeError: kit(...).splitParamPrefix is not a function`

- [ ] **Step 3: Write the implementation**

In `src/server/PaToolReadKit.js`, insert immediately after the `isSysId` function (which ends `},` at ~line 510) and before `trim: function (s) {`:

```javascript
    /**
     * The parameter name prefixed onto its own value — `execution:<sys_id>`.
     *
     * MEASURED, NOT ANTICIPATED (issues #111, #122). A model that is told
     * "pass a JSON object with mode, and optionally execution" has no way to
     * tell that `execution` is a parameter name rather than part of the value
     * it should send, and two independent tools have now received the prefixed
     * form live. #122's case is the sharp one: `execution:<sys_id>` fails
     * isSysId BECAUSE of the prefix, so genai_log read it as a mode, found no
     * such mode, fell back to the default, and returned nothing — a call that
     * every measure counted as having been made.
     *
     * The match is ANCHORED at the head of the string and the segment before
     * the first separator must equal a parameter name IN FULL. That is what
     * keeps a `:` or `=` inside a legitimate value safe — an encoded query
     * such as `sys_created_on>=javascript:gs.beginningOfToday()` has
     * `sys_created_on>` in front of its first separator, which is nobody's
     * parameter name.
     *
     * @param {String} s          a bare, non-JSON argument string
     * @param {Array}  paramNames the tool's accepted parameter names, aliases
     *                            included — take them from the keys the tool's
     *                            own object branch reads, so a parameter the
     *                            tool does not accept cannot appear here
     * @returns {Object|null} {param, value, raw}, or null when nothing matched.
     *          `param` is the CANONICAL spelling as it appears in paramNames,
     *          never the caller's casing: `encodedQuery` and `artifactId` are
     *          read verbatim off the raw object, so a lower-cased repair would
     *          synthesize a key nothing reads and drop the value silently.
     */
    splitParamPrefix: function (s, paramNames) {
        var text = this.trim(s)
        if (!text) return null

        var names = paramNames || []
        if (!names.length) return null

        var cut = text.search(/[:=]/)
        if (cut < 1) return null

        var head = this.lower(this.trim(text.substring(0, cut)))
        var value = this.trim(text.substring(cut + 1))
        if (!value) return null

        for (var i = 0; i < names.length; i++) {
            if (this.lower(names[i]) === head) {
                return { param: names[i], value: value, raw: text }
            }
        }

        return null
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaToolReadKit.test.js`
Expected: PASS — the new describe block plus every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/server/PaToolReadKit.js test/PaToolReadKit.test.js
git commit -m "feat(#122): splitParamPrefix — recognise a parameter name prefixed onto its value

Anchored at the head, whole-segment match, canonical spelling returned so
a camelCase parameter (encodedQuery, artifactId) is not lower-cased into a
key nothing reads.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `genai_log` adopts the guard

The measured case (#122). Do this before the other tools — it is the one with a live reproduction, and it establishes the wiring pattern the next two tasks repeat.

**Files:**
- Modify: `src/server/tools/PaToolGenAiLog.js` (add `PARAM_NAMES`; `_normalizeArgs` at :257-306; `execute` note at ~:264)
- Test: `test/PaToolGenAiLog.test.js`

**Interfaces:**
- Consumes: `PaToolReadKit.splitParamPrefix(s, paramNames)` from Task 1.
- Produces: the wiring pattern (a `PARAM_NAMES` constant, a `_prefix_stripped` field carried out of `_normalizeArgs`, and a loud note in `execute`) that Tasks 3 and 4 repeat per tool.

- [ ] **Step 1: Write the failing tests**

Open `test/PaToolGenAiLog.test.js` and read its existing helper (a `run(args, tables)`-style function near the top, same shape as `test/PaToolLogAnalysis.test.js:34`). Append this describe block at the end of the file, using that file's own helper name and table-fixture conventions:

```javascript
// ---------------------------------------------------------------------------
// The parameter name prefixed onto its own value (#122)
//
// Measured live: smoke run r2-2 (x_snc_troubleshoot_run
// 9b91aa692b6ecb5817a6ffbeee91bfdf, gpinst01, 2026-08-06 23:26:43) called this
// tool with the bare string below. It fails isSysId BECAUSE of the prefix, so
// it was read as a mode; _resolveMode found no such mode and no execution,
// fell back to llm, and the call returned entries: [] with llm_call_rows: 0.
// ---------------------------------------------------------------------------
describe('argument prefix guard (#122)', () => {
    const PLAN_ID = '45bbfd112ba6cf54f243fed2ce91bfcb'

    it('reads execution:<sys_id> as the execution, not as a mode', () => {
        const { result } = run(`execution:${PLAN_ID}`, world())

        expect(result.success).toBe(true)
        expect(result.data.mode).toBe('for_execution')
        expect(result.data.requested.execution).toBe(PLAN_ID)
    })

    it('routes a prefixed value to the NAMED slot, not to the bare-string default', () => {
        // Fall-through would strip to "foo" and hand it to the bare-string
        // branch, which reads a non-sys_id as a MODE. The named slot is the
        // whole point: the model said capability, so it means capability.
        const { result } = run('capability:foo', world())

        expect(result.data.requested.capability).toBe('foo')
        expect(result.data.requested.mode).toBeNull()
    })

    it('says so LOUDLY rather than repairing in silence', () => {
        // Repairing silently makes the call work and erases the only evidence
        // that the model is malforming arguments — which is exactly how this
        // survived a whole smoke: every measure counted which tools were
        // INVOKED, and this one was.
        const { result } = run(`execution:${PLAN_ID}`, world())
        const note = result.data.notes.join(' ')

        expect(note).toContain(`execution:${PLAN_ID}`)
        expect(note).toContain('audit trail')
    })

    it('leaves a bare mode name and a bare sys_id alone', () => {
        expect(run('usage', world()).result.data.mode).toBe('usage')
        expect(run(PLAN_ID, world()).result.data.mode).toBe('for_execution')
    })
})
```

If `test/PaToolGenAiLog.test.js`'s helper returns the tool result directly rather than `{result}`, adapt the destructuring to match — do not change the existing helper.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaToolGenAiLog.test.js -t "argument prefix guard"`
Expected: FAIL — the first test reports `data.mode` is `'llm'` (the fallback) rather than `'for_execution'`.

- [ ] **Step 3: Write the implementation**

**3a.** In `src/server/tools/PaToolGenAiLog.js`, immediately above `_normalizeArgs` (the `// Arguments (R-9)` banner is at ~:253), add the parameter list:

```javascript
    /**
     * Every key the object branch below reads, aliases included. Derived from
     * that branch rather than from the docs, so a parameter this tool does not
     * accept cannot appear here. Consumed by splitParamPrefix (#122).
     */
    PARAM_NAMES: [
        'mode',
        'execution',
        'execution_plan',
        'plan',
        'minutes_ago',
        'minutes',
        'since',
        'errors_only',
        'include_payload',
        'capability',
        'capability_name',
    ],
```

**3b.** Replace the body of `_normalizeArgs` (currently `PaToolGenAiLog.js:257-306`) with:

```javascript
    _normalizeArgs: function (args) {
        var k = this._k()
        var raw = args
        var prefixStripped = ''

        if (raw === null || raw === undefined) return {}

        if (typeof raw === 'string') {
            var s = k.trim(raw)
            if (!s) return {}

            var parsed = k.tryParse(s)
            if (k.isPlainObject(parsed)) {
                raw = parsed
            } else if (s.charAt(0) === '{' || s.charAt(0) === '[') {
                return { _parse_error: true }
            } else {
                // #122: the parameter name prefixed onto its own value. The
                // repair synthesizes a one-key object and lets it fall through
                // the object branch below, so every alias and coercion there
                // applies without being restated.
                var split = k.splitParamPrefix(s, this.PARAM_NAMES)
                if (split) {
                    raw = {}
                    raw[split.param] = split.value
                    prefixStripped = split.raw
                } else if (k.isSysId(s)) {
                    // A bare sys_id can only sensibly mean an execution plan.
                    return { execution: s, mode: 'for_execution' }
                } else {
                    return { mode: k.lower(s) }
                }
            }
        }

        if (!k.isPlainObject(raw)) return {}

        var out = {}
        var mode = k.lower(k.str(raw.mode))
        var execution = k.str(raw.execution || raw.execution_plan || raw.plan)

        if (mode) out.mode = mode
        if (execution) out.execution = execution

        var minutes = k.num(raw.minutes_ago || raw.minutes || raw.since)
        if (minutes > 0) out.minutes_ago = minutes

        var errorsOnly = k.bool(raw.errors_only)
        if (errorsOnly !== null) out.errors_only = errorsOnly

        if (k.bool(raw.include_payload) === true) out.include_payload = true

        // check_config narrowing (issue #46) — a definition or capability
        // sys_id, or a name substring. Other modes ignore it. No `definition`
        // alias: a stray definition key is a plausible LLM emission with a
        // different intent, and silently turning it into a filter would
        // narrow an audit the caller meant to be whole-table.
        var capability = k.str(raw.capability || raw.capability_name)
        if (capability) out.capability = capability

        if (prefixStripped) out._prefix_stripped = prefixStripped

        return out
    },
```

**3c.** In `execute`, immediately after the existing `if (a._parse_error) { ... }` block (at ~`PaToolGenAiLog.js:264-273`) and before `phase = 'resolve_mode'`, add:

```javascript
            if (a._prefix_stripped) {
                // LOUDLY (issues #111, #122). Repairing this silently would
                // make the call work and erase the only evidence that the
                // model is malforming arguments — which is how it went
                // unnoticed for a whole smoke: every measure counted which
                // tools were invoked, and this one was.
                data.notes.push(
                    'The argument arrived as "' +
                        a._prefix_stripped +
                        '" — the parameter name prefixed onto its own value. It was read as ' +
                        'the value alone. Send the value on its own, or a JSON object, and note ' +
                        'that this call is recorded in the audit trail as it was sent, not as it ' +
                        'was repaired.'
                )
            }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaToolGenAiLog.test.js`
Expected: PASS — the new block plus every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/server/tools/PaToolGenAiLog.js test/PaToolGenAiLog.test.js
git commit -m "fix(#122): genai_log reads a prefixed argument as its named parameter

The measured case: execution:<sys_id> failed isSysId because of the prefix,
was read as a mode, and returned entries: [] on a call every measure counted
as made. Repaired loudly, never silently.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `log_analysis`, `query_table` and `agent_config` adopt the guard

The three remaining `PaToolReadKit` consumers. Same pattern as Task 2, repeated per tool with that tool's own parameter list and bare-string fallback.

**Files:**
- Modify: `src/server/tools/PaToolLogAnalysis.js` (`_normalizeArgs` at :195-243, `execute`)
- Modify: `src/server/tools/PaToolQueryTable.js` (`_normalizeArgs` at :197-231, `execute`)
- Modify: `src/server/tools/PaToolAgentConfig.js` (`_normalizeArgs` at :366-400, `execute`)
- Test: `test/PaToolLogAnalysis.test.js`, `test/PaToolQueryTable.test.js`, `test/PaToolAgentConfig.test.js`

**Interfaces:**
- Consumes: `PaToolReadKit.splitParamPrefix(s, paramNames)` from Task 1; the wiring pattern from Task 2.
- Produces: nothing new. `PARAM_NAMES` on each of the three tools, same meaning as Task 2's.

- [ ] **Step 1: Write the failing tests**

`log_analysis` — append to `test/PaToolLogAnalysis.test.js` (its helper is `run(args, tables, options)` returning `{result, queries}`, at :34):

```javascript
describe('argument prefix guard (#122)', () => {
    const PREFIXED = `execution:${PLAN}`

    it('reads execution:<sys_id> as the execution, not as a message substring', () => {
        const { result } = run(PREFIXED, world({ sn_aia_execution_plan: [] }))

        expect(result.data.requested.execution).toBe(PLAN)
        expect(result.data.requested.message).toBeFalsy()
    })

    it('routes source:<name> to the source slot, not to message', () => {
        const { result } = run('source:MyScriptInclude', world())

        expect(result.data.requested.source).toBe('MyScriptInclude')
        expect(result.data.requested.message).toBeFalsy()
    })

    it('says so loudly', () => {
        const { result } = run(PREFIXED, world())

        expect(result.data.notes.join(' ')).toContain(PREFIXED)
    })

    it('leaves an unprefixed message alone', () => {
        const { result } = run('disk full', world())

        expect(result.data.requested.message).toBe('disk full')
    })
})
```

If `data.requested` is not the field this tool exposes, read the tool's `execute` and assert on whichever field it records the normalized arguments under; do not add one.

`query_table` — append to `test/PaToolQueryTable.test.js`, using that file's existing helper:

```javascript
describe('argument prefix guard (#122)', () => {
    it('reads table:incident as the table name', () => {
        const { result } = run('table:incident', world({ incident: [] }))

        expect(result.data.requested.table).toBe('incident')
    })

    it('does not mistake an encoded query for a prefix', () => {
        // Both `=` and `:` appear inside this value and neither is a prefix.
        const encoded = 'sys_created_on>=javascript:gs.beginningOfToday()'
        const { result } = run({ table: 'incident', query: encoded }, world({ incident: [] }))

        expect(result.data.requested.query).toBe(encoded)
    })

    it('says so loudly', () => {
        const { result } = run('table:incident', world({ incident: [] }))

        expect(result.data.notes.join(' ')).toContain('table:incident')
    })
})
```

`agent_config` — append to `test/PaToolAgentConfig.test.js`, using that file's existing helper:

```javascript
describe('argument prefix guard (#122)', () => {
    it('reads agent:<name> as the agent name', () => {
        const { result } = run('agent:Foundry Troubleshooter', world())

        expect(result.data.requested.agent).toBe('Foundry Troubleshooter')
    })

    it('routes section:<name> to the section slot, not to agent', () => {
        const { result } = run('section:instructions', world())

        expect(result.data.requested.section).toBe('instructions')
        expect(result.data.requested.agent).toBeFalsy()
    })

    it('says so loudly', () => {
        const { result } = run('agent:Foundry Troubleshooter', world())

        expect(result.data.notes.join(' ')).toContain('agent:Foundry Troubleshooter')
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaToolLogAnalysis.test.js test/PaToolQueryTable.test.js test/PaToolAgentConfig.test.js -t "argument prefix guard"`
Expected: FAIL on all three — the prefixed string is currently read as a message / table name / agent name **with the prefix still attached**.

- [ ] **Step 3: Write the implementations**

Each of the three follows Task 2 exactly: add `PARAM_NAMES`, insert the `splitParamPrefix` branch as the **first** arm of the existing bare-string `else`, carry `prefixStripped` into `out._prefix_stripped`, and push the note in `execute` after the `_parse_error` block.

**3a. `PaToolLogAnalysis.js`** — above `_normalizeArgs`:

```javascript
    /** Every key the object branch reads, aliases included (#122). */
    PARAM_NAMES: [
        'execution',
        'execution_plan',
        'plan',
        'source',
        'message',
        'contains',
        'keyword',
        'level',
        'minutes_ago',
        'minutes',
        'since',
        'limit',
    ],
```

and replace its bare-string `else` arm (currently `PaToolLogAnalysis.js:214-218`, the `isSysId` / `message` pair) with:

```javascript
            } else {
                var split = k.splitParamPrefix(s, this.PARAM_NAMES)
                if (split) {
                    raw = {}
                    raw[split.param] = split.value
                    prefixStripped = split.raw
                } else if (k.isSysId(s)) {
                    // A bare sys_id is an execution — the one argument that
                    // scopes the query completely on its own.
                    return { execution: s }
                } else {
                    return { message: s }
                }
            }
```

Declare `var prefixStripped = ''` beside `var raw = args` at the top of the function, and add `if (prefixStripped) out._prefix_stripped = prefixStripped` immediately before its closing `return out`.

**3b. `PaToolQueryTable.js`** — above `_normalizeArgs`:

```javascript
    /** Every key the object branch reads, aliases included (#122). */
    PARAM_NAMES: ['table', 'table_name', 'query', 'encoded_query', 'encodedQuery', 'fields', 'limit'],
```

and replace its bare-string `else` arm (currently `PaToolQueryTable.js:211-213`, `return { table: s }`) with:

```javascript
            } else {
                var split = k.splitParamPrefix(s, this.PARAM_NAMES)
                if (split) {
                    raw = {}
                    raw[split.param] = split.value
                    prefixStripped = split.raw
                } else {
                    return { table: s }
                }
            }
```

Same two edits: `var prefixStripped = ''` at the top, `if (prefixStripped) out._prefix_stripped = prefixStripped` before `return out`.

**3c. `PaToolAgentConfig.js`** — above `_normalizeArgs`:

```javascript
    /** Every key the object branch reads, aliases included (#122). */
    PARAM_NAMES: ['agent', 'agent_name', 'name', 'section'],
```

and replace its bare-string `else` arm (currently `PaToolAgentConfig.js:383-388`, `return { agent: s }`) with:

```javascript
            } else {
                var split = k.splitParamPrefix(s, this.PARAM_NAMES)
                if (split) {
                    raw = {}
                    raw[split.param] = split.value
                    prefixStripped = split.raw
                } else {
                    // A bare sys_id and a bare name both resolve through the
                    // same path here — unlike the trace tool, where a sys_id
                    // means a different record type entirely.
                    return { agent: s }
                }
            }
```

Same two edits.

**3d.** In each of the three `execute` methods, immediately after the existing `if (a._parse_error) { ... }` block, add the note — verbatim the block from Task 2 step 3c:

```javascript
            if (a._prefix_stripped) {
                // LOUDLY (issues #111, #122). Repairing this silently would
                // make the call work and erase the only evidence that the
                // model is malforming arguments — which is how it went
                // unnoticed for a whole smoke: every measure counted which
                // tools were invoked, and this one was.
                data.notes.push(
                    'The argument arrived as "' +
                        a._prefix_stripped +
                        '" — the parameter name prefixed onto its own value. It was read as ' +
                        'the value alone. Send the value on its own, or a JSON object, and note ' +
                        'that this call is recorded in the audit trail as it was sent, not as it ' +
                        'was repaired.'
                )
            }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaToolLogAnalysis.test.js test/PaToolQueryTable.test.js test/PaToolAgentConfig.test.js`
Expected: PASS — new blocks plus every pre-existing test in all three files.

- [ ] **Step 5: Commit**

```bash
git add src/server/tools/PaToolLogAnalysis.js src/server/tools/PaToolQueryTable.js src/server/tools/PaToolAgentConfig.js test/PaToolLogAnalysis.test.js test/PaToolQueryTable.test.js test/PaToolAgentConfig.test.js
git commit -m "fix(#122): log_analysis, query_table and agent_config adopt the prefix guard

log_analysis has still never been called by a custom run — the absence of
evidence there is the absence of any call, not a clean bill.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `agent_trace` and `read_artifact` get a private copy

Neither uses `PaToolReadKit` — both carry private `_trim` / `_tryParse` / `_isSysId` helpers. **Migrating them is issue #41 and is out of scope**; they get a verbatim private copy of the helper instead.

`read_artifact` is the odd one: it has no `data` envelope at all — `execute` returns whatever `PaArtifactStore.read` returns. Its note attaches to that returned object.

**Files:**
- Modify: `src/server/tools/PaToolAgentTrace.js` (`_normalizeArgs` at :455-495, `execute`)
- Modify: `src/server/tools/PaToolReadArtifact.js` (`execute` at :35-42, `_normalizeArgs` at :50-73)
- Test: `test/PaToolAgentTrace.test.js`, `test/PaToolReadArtifact.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime — a private `_splitParamPrefix` with the identical signature and semantics.
- Produces: nothing later tasks use.

- [ ] **Step 1: Write the failing tests**

`agent_trace` — append to `test/PaToolAgentTrace.test.js`, using that file's existing helper:

```javascript
describe('argument prefix guard (#122)', () => {
    const PLAN_ID = '45bbfd112ba6cf54f243fed2ce91bfcb'

    it('reads execution:<sys_id> as the execution', () => {
        const { result } = run(`execution:${PLAN_ID}`, world())

        expect(result.data.requested.execution).toBe(PLAN_ID)
    })

    it('routes execution:<non-sys_id> to execution, where fall-through would say agent', () => {
        // The bare-string branch reads a non-sys_id as an AGENT NAME. Only the
        // named slot gets this right.
        const { result } = run('execution:MyRun', world())

        expect(result.data.requested.execution).toBe('MyRun')
        expect(result.data.requested.agent).toBeFalsy()
    })

    it('says so loudly', () => {
        const { result } = run(`execution:${PLAN_ID}`, world())

        expect(result.data.notes.join(' ')).toContain(`execution:${PLAN_ID}`)
    })

    it('leaves a bare agent name and a bare sys_id alone', () => {
        expect(run('Foundry Troubleshooter', world()).result.data.requested.agent).toBe(
            'Foundry Troubleshooter'
        )
        expect(run(PLAN_ID, world()).result.data.requested.execution).toBe(PLAN_ID)
    })
})
```

`read_artifact` — append to `test/PaToolReadArtifact.test.js`, using that file's existing store-stub helper:

```javascript
describe('argument prefix guard (#122)', () => {
    const ART = 'a3be12a52b228794f243fed2ce91bfae'

    it('reads artifact_id:<sys_id> as the artifact id', () => {
        const calls = []
        const store = {
            read: function (id, offset, length) {
                calls.push([id, offset, length])
                return { success: true, content: 'page', total_length: 4 }
            },
        }

        loadTool({ store: store }).execute(`artifact_id:${ART}`)

        expect(calls[0][0]).toBe(ART)
    })

    it('says so loudly on the returned object, which is the only channel it has', () => {
        const store = {
            read: function () {
                return { success: true, content: 'page', total_length: 4 }
            },
        }

        const result = loadTool({ store: store }).execute(`artifact_id:${ART}`)

        expect(result.notes.join(' ')).toContain(`artifact_id:${ART}`)
    })

    it('leaves a bare artifact sys_id alone and adds no note', () => {
        const calls = []
        const store = {
            read: function (id) {
                calls.push(id)
                return { success: true, content: 'page', total_length: 4 }
            },
        }

        const result = loadTool({ store: store }).execute(ART)

        expect(calls[0]).toBe(ART)
        expect(result.notes).toBeUndefined()
    })
})
```

`loadTool` is whatever `test/PaToolReadArtifact.test.js` already uses to construct the tool with an injected store (`new ctx.PaToolReadArtifact({store: ...})`); reuse it rather than adding one.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaToolAgentTrace.test.js test/PaToolReadArtifact.test.js -t "argument prefix guard"`
Expected: FAIL — `agent_trace` reports the prefixed string as an `agent`; `read_artifact` passes `artifact_id:a3be…` through to the store as the id.

- [ ] **Step 3: Write the implementations**

**3a. `PaToolAgentTrace.js`** — add the parameter list and a private copy of the helper beside its other private helpers (`_isSysId` is at :508):

```javascript
    /** Every key the object branch reads, aliases included (#122). */
    PARAM_NAMES: ['execution', 'agent', 'step', 'since', 'detail'],

    /**
     * A verbatim copy of PaToolReadKit.splitParamPrefix (#122). This tool does
     * not use the kit — migrating it is issue #41, deliberately not done here.
     * Keep the two in step: anchored at the head, the segment before the first
     * separator must equal a parameter name in full, and the CANONICAL spelling
     * is returned so a camelCase parameter is not lower-cased into a key
     * nothing reads.
     */
    _splitParamPrefix: function (s, paramNames) {
        var text = this._trim(s)
        if (!text) return null

        var names = paramNames || []
        if (!names.length) return null

        var cut = text.search(/[:=]/)
        if (cut < 1) return null

        var head = String(this._trim(text.substring(0, cut))).toLowerCase()
        var value = this._trim(text.substring(cut + 1))
        if (!value) return null

        for (var i = 0; i < names.length; i++) {
            if (String(names[i]).toLowerCase() === head) {
                return { param: names[i], value: value, raw: text }
            }
        }

        return null
    },
```

Replace its bare-string `else` arm (currently `PaToolAgentTrace.js:470-474`) with:

```javascript
            } else {
                var split = this._splitParamPrefix(s, this.PARAM_NAMES)
                if (split) {
                    raw = {}
                    raw[split.param] = split.value
                    prefixStripped = split.raw
                } else if (this._isSysId(s)) {
                    return { execution: s }
                } else {
                    return { agent: s }
                }
            }
```

Declare `var prefixStripped = ''` beside `var raw = args`, and add `if (prefixStripped) out._prefix_stripped = prefixStripped` immediately before the function's `return out`. Then add the same note block from Task 2 step 3c to `execute`, after its `_parse_error` block.

**3b. `PaToolReadArtifact.js`** — add the parameter list and its own private copy of the helper, beside the existing `_trim` (:88). The body is the same as 3a's; it is repeated here in full rather than cross-referenced, because this file is edited on its own:

```javascript
    /** Every key the object branch reads, aliases included (#122). */
    PARAM_NAMES: ['artifact_id', 'artifactId', 'artifact', 'id', 'offset', 'length'],

    /**
     * A verbatim copy of PaToolReadKit.splitParamPrefix (#122). This tool does
     * not use the kit — migrating it is issue #41, deliberately not done here.
     * Keep the two in step: anchored at the head, the segment before the first
     * separator must equal a parameter name in full, and the CANONICAL spelling
     * is returned so artifactId is not lower-cased into a key nothing reads.
     */
    _splitParamPrefix: function (s, paramNames) {
        var text = this._trim(s)
        if (!text) return null

        var names = paramNames || []
        if (!names.length) return null

        var cut = text.search(/[:=]/)
        if (cut < 1) return null

        var head = String(this._trim(text.substring(0, cut))).toLowerCase()
        var value = this._trim(text.substring(cut + 1))
        if (!value) return null

        for (var i = 0; i < names.length; i++) {
            if (String(names[i]).toLowerCase() === head) {
                return { param: names[i], value: value, raw: text }
            }
        }

        return null
    },
```

Replace the bare-string `else` arm (currently `PaToolReadArtifact.js:61-63`) with:

```javascript
            } else {
                var split = this._splitParamPrefix(s, this.PARAM_NAMES)
                if (split) {
                    raw = {}
                    raw[split.param] = split.value
                    prefixStripped = split.raw
                } else {
                    return { artifact_id: s }
                }
            }
```

Declare `var prefixStripped = ''` beside `var raw = args`, and change the function's final `return { ... }` to carry the field:

```javascript
        var out = {
            artifact_id: this._str(raw.artifact_id || raw.artifactId || raw.artifact || raw.id),
            offset: this._num(raw.offset),
            length: this._num(raw.length),
        }
        if (prefixStripped) out._prefix_stripped = prefixStripped
        return out
```

`execute` has no `data` envelope, so the note attaches to the store's returned object — replace `PaToolReadArtifact.js:35-42` with:

```javascript
    execute: function (args) {
        var a = this._normalizeArgs(args)
        var store = this._store || new PaArtifactStore()

        // Delegated deliberately even when the id is empty: the store owns the
        // "requires an artifact_id" message, and two copies of it drift.
        var result = store.read(a.artifact_id, a.offset, a.length)

        if (a._prefix_stripped && result !== null && typeof result === 'object') {
            // LOUDLY (issues #111, #122), on the returned object — this tool
            // has no data envelope to carry notes in.
            result.notes = (result.notes || []).concat([
                'The argument arrived as "' +
                    a._prefix_stripped +
                    '" — the parameter name prefixed onto its own value. It was read as ' +
                    'the value alone. Send the artifact sys_id on its own, or a JSON object, ' +
                    'and note that this call is recorded in the audit trail as it was sent, ' +
                    'not as it was repaired.',
            ])
        }

        return result
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaToolAgentTrace.test.js test/PaToolReadArtifact.test.js`
Expected: PASS — new blocks plus every pre-existing test in both files.

- [ ] **Step 5: Commit**

```bash
git add src/server/tools/PaToolAgentTrace.js src/server/tools/PaToolReadArtifact.js test/PaToolAgentTrace.test.js test/PaToolReadArtifact.test.js
git commit -m "fix(#122): agent_trace and read_artifact get a private prefix guard

Neither uses PaToolReadKit; migrating them is #41 and stays out of scope.
read_artifact has no data envelope, so its note rides the returned object.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: the six tool descriptions

The prompt-side half. #111's root cause was `schema_lookup`'s own contract reading as though `table` were literal text; the other six descriptions were never examined for the same defect. `genai_log`'s says *"pass a JSON object with mode, and optionally execution …"* and never says the parameter name is not part of the value — `execution:<sys_id>` is a coherent reading of it.

**Files:**
- Modify: `src/server/PaToolRegistry.js` (descriptions at :143, :153, :173, :183, :193, :203)
- Modify: `src/fluent/agent-doctor.now.ts` (the same six, inside backtick templates)
- Test: `test/PaToolRegistry.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by code. The parity test at `PaToolRegistry.test.js:462` already enforces that both files agree.

- [ ] **Step 1: Write the failing test**

Append to `test/PaToolRegistry.test.js`, inside the same top-level `describe` that holds the parity test:

```javascript
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
```

Note `schema_lookup`'s existing sentence reads *"The words table and field are parameter names, never part of a value"* — the assertion above matches it as written, so all seven pass once the six are edited.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/PaToolRegistry.test.js -t "parameter name is not part of a value"`
Expected: FAIL — six of seven descriptions lack the phrase.

- [ ] **Step 3: Edit the descriptions**

In **both** `src/server/PaToolRegistry.js` and `src/fluent/agent-doctor.now.ts`, insert one sentence into each of the six descriptions, immediately **before** the literal text `UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING:` (an unambiguous anchor present in all seven). Keep the single leading space that separates sentences. Do **not** touch `schema_lookup`.

| tool | sentence to insert |
|---|---|
| `agent_trace` | `The words execution, agent, since and step are parameter names, never part of a value: send the sys_id alone, not execution:<sys_id>.` |
| `agent_config` | `The words agent and section are parameter names, never part of a value: send the agent name alone, not agent:<name>.` |
| `query_table` | `The words table, query, fields and limit are parameter names, never part of a value: send incident, not table:incident.` |
| `genai_log` | `The words mode, execution and capability are parameter names, never part of a value: send the sys_id alone, not execution:<sys_id>.` |
| `log_analysis` | `The words execution, source, message, level, minutes_ago and limit are parameter names, never part of a value: send the sys_id alone, not execution:<sys_id>.` |
| `read_artifact` | `The words artifact_id, offset and length are parameter names, never part of a value: send the sys_id alone, not artifact_id:<sys_id>.` |

**Build Rule #43 check before saving `agent-doctor.now.ts`:** every sentence above contains only letters, digits, spaces, commas, colons, periods, underscores and angle brackets. No backtick, no `\n`, no `${`. A backtick anywhere in a Fluent template closes it and produces a cluster of syntax errors pointing at unrelated lines.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaToolRegistry.test.js`
Expected: PASS — including the pre-existing parity test at :462, which fails loudly if the two files drifted.

- [ ] **Step 5: Commit**

```bash
git add src/server/PaToolRegistry.js src/fluent/agent-doctor.now.ts test/PaToolRegistry.test.js
git commit -m "fix(#122): every tool contract says a parameter name is not part of a value

#111 fixed this wording on schema_lookup alone. The other six were never
examined for the same defect, and genai_log received the prefixed form the
first time the harness ever called it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Verify, version, ship

**Files:**
- Modify: `package.json` (version), `README.md` (version badge), `CHANGELOG.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a PR.

- [ ] **Step 1: Run the full suite**

Run: `npx jest`
Expected: PASS, **26 suites**, at least **1160** tests — the `2026.08.0601` baseline plus the ~30 added here. Any pre-existing test that now fails is a regression in this branch, not a stale expectation to update: the guard only fires on a string whose head equals a parameter name, so a previously-passing argument shape should be untouched. Investigate before changing any existing assertion.

- [ ] **Step 2: Build**

Run: `now-sdk build`
Expected: success. A `TS2796` / `TS304` / `TS20` cluster or a `RestApiPlugin failed to transform` error means a backtick reached a Fluent template in Task 5 — grep `src/fluent/agent-doctor.now.ts` for a backtick inside the six edited descriptions before reading any of the reported line numbers (Build Rule #43).

- [ ] **Step 3: Install to the instance**

Run: `now-sdk install --alias gpinst01`
Expected: success. This proves it deploys; per the agreed done-bar there is **no live probe and no benchmark round** — #121's sized evidence-return round is the first live exercise of this fix.

- [ ] **Step 4: Bump the version**

Set `"version": "2026.08.0602"` in `package.json`, update the version badge in `README.md` to match, and add a `CHANGELOG.md` entry following the file's existing format, summarising: the guard reaches all seven tools; `schema_lookup` untouched; six descriptions corrected; #41 still open; no runtime evidence yet, by design.

- [ ] **Step 5: Commit and open the PR**

```bash
git add package.json README.md CHANGELOG.md
git commit -m "chore: version 2026.08.0602 — the arg-prefix guard reaches every tool

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin fix/122-tool-arg-prefix-guard
gh pr create --fill --assignee @me
```

The PR body must state plainly that this ships **no runtime evidence** — the done-bar was unit tests plus a clean build and install, and #121's round is where live evidence arrives. Reference `Closes #122`.
