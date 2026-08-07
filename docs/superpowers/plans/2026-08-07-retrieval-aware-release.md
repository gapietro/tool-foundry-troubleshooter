# Retrieval-Aware Release Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "a gathering call" mean "a call that retrieved something" in both places this project currently counts a call by name — the depth gate's release rule and the evidence-return numerator (issue #121).

**Architecture:** `PaToolReadKit` already computes, on every tool, a `data.reads` map in which `'ok'` may only be asserted by a path that actually fetched rows (R-25). A new pure method turns that map into a three-valued verdict. The verdict is taken at the two dispatch sites on the tool core's **pre-threshold** result — because `applyThreshold` replaces oversized results with an excerpt envelope carrying no `reads` map, and `PaAuditLogger` then digests what survives — and stored on a new `retrieval` column of `x_snc_troubleshoot_audit`. `PaAgentLoop` reads it back through `invokedTools` and releases on it, behind a constant that ships `false`.

**Tech Stack:** ES5 / Rhino Script Includes under `src/server/`, ServiceNow SDK 4.9.2 Fluent DSL under `src/fluent/`, Jest 29.7 under `test/` via the `vm`-based `_loadScriptInclude` harness.

## Global Constraints

- **ES5 only, Rhino runtime.** No `Set`, `Map`, `Array.prototype.includes`, `Object.assign`, arrow functions, `let`/`const`, or template literals in anything under `src/`. Test files under `test/` are Node and may use modern syntax.
- **R-1 — never touch the exception object in a `catch`.** Reading `.message` off a `ScopeAccessNotGrantedException` throws again and escapes the handler. Every `catch` records a status and inspects nothing.
- **R-6 — a wrong field name returns a blank, not an error.** Guard on the writing side; never write an unvalidated value to a `ChoiceColumn`.
- **R-9 — every input may be absent, and arrives as a string when it is not.**
- **R-10 — degrade explicitly with a named reason.**
- **Totality.** `PaAuditLogger`, `PaToolRegistry` and `PaScriptToolAdapter` sit in the hot path of every tool call and must be incapable of taking a tool down. A verdict that cannot be computed is `'unknown'`, never a throw.
- **Build Rule #8** — `ChoiceColumn` choices are `{ value_key: 'Label' }`, never `[{value,label}]`.
- **Build Rule #9** — a `Table()` export name must equal the table name exactly.
- **`now-sdk build` must pass before any `now-sdk install`.** No install is in scope for this plan.
- **Baseline: 1,198 tests passing, 26 suites** (`npx jest`, measured on this branch 2026-08-07). The suite must be green at every commit.
- **Never commit to `main`.** All work is on `fix/121-retrieval-aware-release`, merged by PR.
- **Design authority:** `docs/superpowers/specs/2026-08-07-retrieval-aware-release-design.md`. Where this plan and the spec disagree, the spec wins and the plan is wrong.

---

## File Structure

| File | Responsibility after this change |
|---|---|
| `src/server/PaToolReadKit.js` | Adds `retrievalVerdict(result)` — the single definition of "this call retrieved something". Pure, no Glide. The kit already owns `reads`, so it owns the meaning of `'ok'`. |
| `src/fluent/tables.now.ts` | Adds the `retrieval` ChoiceColumn to `x_snc_troubleshoot_audit`. No default, so pre-#121 rows stay blank. |
| `src/server/PaAuditLogger.js` | Write side: accepts and whitelists a `retrieval` param, writes it on result rows only. Read side: `invokedTools` additionally returns `retrievingTools`. |
| `src/server/PaToolRegistry.js` | Takes the verdict on the pre-threshold result and passes it to `logResult`. Custom-harness path. |
| `src/server/PaScriptToolAdapter.js` | The same, at the native-harness path. |
| `src/server/PaAgentLoop.js` | `REQUIRE_RETRIEVAL_TO_RELEASE` (default `false`), `_trailTools.retrieving`, `_releaseSet(trail)`, and both `_depthGate` consumers of the trail. |
| `benchmark/DECISION.md` | New append-only §V pre-registering the amended numerator. |

Seven tasks. Tasks 1–3 have no consumers and can be reviewed on their own merits; Tasks 4–5 are the two dispatch sites; Task 6 is the gate; Task 7 is documentation and the version bump.

---

### Task 1: The predicate — `PaToolReadKit.retrievalVerdict`

**Files:**
- Modify: `src/server/PaToolReadKit.js` (add a public method plus two private helpers)
- Test: `test/PaToolReadKit.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `PaToolReadKit.prototype.retrievalVerdict(result) -> 'ok' | 'none' | 'unknown'`. Pure — no Glide, no side effects, no mutation of `result`. Tasks 4 and 5 call it; Task 2 stores its output.

**Context the implementer needs.** `PaToolReadKit.noteRead` maintains `data.reads = { <table>: 'ok' | 'empty' | 'unknown' | 'DENIED' }`. Its header defines `'ok'` as *"the read succeeded and rows were present"*, and R-25 (documented above `noteRead`) restricts assertion of a success status to `readRows` and `readOne` — the only two callers that pass `fromRowRead`. That restriction is what makes `'ok'` trustworthy here; do not weaken it, and do not add a second way to assert it.

All six real tool cores return `{ success: true, data: {…} }` with `data` built by `newData()`. `PaToolReadArtifact` does not use the kit and has no `reads` map — it scores `'unknown'`, which is harmless because it appears in no layer of `PaFixReport._layerToolMap()` and can therefore never be a tool the gate is waiting on.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaToolReadKit.test.js`:

```js
// ===========================================================================
// retrievalVerdict (#121) — did this call RETRIEVE anything, or merely run?
//
// DECISION.md §T4 found the depth gate releasing on a `schema_lookup` that
// answered `table_exists: false`, and §U9.1 found the evidence-return
// numerator counting a `genai_log` call that returned `entries: []`. Both
// counted a call by NAME. This is the predicate that makes them count a
// retrieval instead, and it reads the `reads` map the kit already computes:
// R-25 lets only a path that actually fetched rows write 'ok' there.
// ===========================================================================

describe('retrievalVerdict (#121)', () => {
    // No Glide is needed — the method is pure. A bare kit is enough.
    function kit() {
        const ctx = loadScriptInclude('PaToolReadKit.js', { JSON: JSON })
        return new ctx.PaToolReadKit()
    }

    test("'ok' when at least one table in `reads` came back with rows", () => {
        expect(kit().retrievalVerdict({ success: true, data: { reads: { sys_user: 'ok' } } })).toBe('ok')
    })

    test("'ok' when one table among several read ok", () => {
        const result = {
            success: true,
            data: { reads: { sys_db_object: 'empty', sys_dictionary: 'ok', syslog: 'DENIED' } },
        }
        expect(kit().retrievalVerdict(result)).toBe('ok')
    })

    test("'none' when every read came back empty, unknown or denied", () => {
        const result = {
            success: true,
            data: { reads: { sys_db_object: 'empty', syslog: 'DENIED', sys_dictionary: 'unknown' } },
        }
        expect(kit().retrievalVerdict(result)).toBe('none')
    })

    test("'none' for an empty reads map — the tool ran and read nothing at all", () => {
        expect(kit().retrievalVerdict({ success: true, data: { reads: {} } })).toBe('none')
    })

    test("'none' for a failure envelope — an error is a definite statement that nothing came back", () => {
        expect(kit().retrievalVerdict({ success: false, error: 'denied' })).toBe('none')
    })

    test.each([undefined, null, '', 'a string', 42, []])(
        "'unknown' for a non-object result (%p) — cannot tell, which is not the same as none",
        (input) => {
            expect(kit().retrievalVerdict(input)).toBe('unknown')
        }
    )

    test("'unknown' when success is true but there is no data object", () => {
        expect(kit().retrievalVerdict({ success: true })).toBe('unknown')
    })

    test("'unknown' when data carries no reads map — a core that does not use this kit", () => {
        // PaToolReadArtifact's shape. It appears in no layer of
        // _layerToolMap(), so this verdict is never load-bearing for the gate.
        expect(kit().retrievalVerdict({ success: true, data: { content: 'abc', eof: true } })).toBe('unknown')
    })

    test("'unknown' when success is absent — the envelope is not one this predicate can read", () => {
        expect(kit().retrievalVerdict({ data: { reads: { sys_user: 'ok' } } })).toBe('unknown')
    })

    test("'unknown' when reads is an array rather than a map", () => {
        expect(kit().retrievalVerdict({ success: true, data: { reads: ['ok'] } })).toBe('unknown')
    })

    test('an inherited ok on the prototype chain does not count — own properties only', () => {
        const reads = Object.create({ sys_user: 'ok' })
        expect(kit().retrievalVerdict({ success: true, data: { reads: reads } })).toBe('none')
    })

    test('the result object is not mutated', () => {
        const result = { success: true, data: { reads: { sys_user: 'ok' } } }
        const before = JSON.stringify(result)
        kit().retrievalVerdict(result)
        expect(JSON.stringify(result)).toBe(before)
    })

    // -----------------------------------------------------------------------
    // The three regression anchors from DECISION.md, verbatim in shape.
    // -----------------------------------------------------------------------

    test("§T4 row 07: schema_lookup answering table_exists:false is 'none'", () => {
        const result = {
            success: true,
            data: {
                table_exists: false,
                finding: 'table_does_not_exist',
                reads: { sys_db_object: 'empty' },
            },
        }
        expect(kit().retrievalVerdict(result)).toBe('none')
    })

    test("§U9.1 r2-2: genai_log answering entries:[] with llm_call_rows:0 is 'none'", () => {
        const result = {
            success: true,
            data: {
                entries: [],
                llm_call_rows: 0,
                reads: { sys_generative_ai_log: 'empty' },
            },
        }
        expect(kit().retrievalVerdict(result)).toBe('none')
    })

    test("§U9.1 v10-2: genai_log returning llm_call_rows:3 is 'ok'", () => {
        const result = {
            success: true,
            data: {
                llm_call_rows: 3,
                reads: { sys_generative_ai_log: 'ok' },
            },
        }
        expect(kit().retrievalVerdict(result)).toBe('ok')
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaToolReadKit.test.js -t retrievalVerdict`
Expected: FAIL — `kit().retrievalVerdict is not a function` on every case.

- [ ] **Step 3: Implement the predicate**

In `src/server/PaToolReadKit.js`, add to the prototype immediately after `_readRank` (keeping the `noteRead` / `_readRank` pair together, since this method is the third reader of the same vocabulary):

```js
    /**
     * Did this call RETRIEVE anything, or did it merely run? (#121)
     *
     * WHY THIS BELONGS HERE. `noteRead` above already computes the answer and
     * this project already throws it away twice. DECISION.md §T4: the depth
     * gate "counts a layer-4 tool being *called*, not layer 4 being
     * *reached*" — v9 row 07's `schema_lookup` answered `table_exists: false`,
     * retrieved nothing, and released the gate. §U9.1: the evidence-return
     * numerator counted r2-2's `genai_log` call, which returned `entries: []`
     * and `llm_call_rows: 0`. Both counted a tool NAME. This turns the
     * `reads` map into the verdict both of them needed.
     *
     * `'ok'` in `reads` is the right signal and not merely a convenient one:
     * R-25 (see `noteRead`) permits a success status ONLY from a path that
     * passed `fromRowRead`, which is `readRows` and `readOne` and nothing
     * else. A schema probe cannot assert it; a field-presence check cannot
     * assert it. So an `'ok'` here means rows were fetched.
     *
     * THREE VALUES, NOT A BOOLEAN, and the third is the point. A row that was
     * never classified must stay distinguishable from a row classified as
     * barren — collapsing `unknown` into `false` is the R-6 failure shape (a
     * blank read as a fact) aimed at the very instrument this exists to make
     * honest. `x_snc_troubleshoot_audit.retrieval` therefore has no default,
     * and every pre-#121 row reads blank rather than `none`.
     *
     * `success === false` is `'none'` rather than `'unknown'`: an error
     * envelope is a definite statement that nothing came back.
     *
     * KNOWN FALSE NEGATIVE, ACCEPTED. `PaToolQueryTable`'s
     * `rows_exist_but_are_not_visible` finding — a GlideAggregate count above
     * zero against a GlideRecordSecure read of zero — establishes a real ACL
     * fact with `reads` at `'empty'`, and scores `'none'` here. This predicate
     * UNDER-counts retrieval. That is the safe direction for a release gate (a
     * false negative costs one hold, bounded by `MAX_HOLDS`) and the safe
     * direction for a numerator that has twice flattered the change it
     * measures.
     *
     * PURE: no Glide, no audit query, no mutation of `result`.
     *
     * @param {*} result a tool core's result, PRE-THRESHOLD. Passing the
     *        post-`applyThreshold` envelope is a defect at the call site, not
     *        here: that envelope carries no `reads` map and would score
     *        `'unknown'` for every large — i.e. every likely productive —
     *        result. See the design doc §3.1.
     * @returns {String} 'ok' | 'none' | 'unknown'
     */
    retrievalVerdict: function (result) {
        if (!this._isPlainObject(result)) return 'unknown'
        if (result.success === false) return 'none'
        if (result.success !== true) return 'unknown'
        if (!this._isPlainObject(result.data)) return 'unknown'

        var reads = result.data.reads
        if (!this._isPlainObject(reads)) return 'unknown'

        for (var table in reads) {
            // Own properties only: an inherited 'ok' is not this call's read.
            if (!Object.prototype.hasOwnProperty.call(reads, table)) continue
            if (reads[table] === 'ok') return 'ok'
        }
        return 'none'
    },

    /** ES5/Rhino: arrays are objects, and `reads` must be a map. */
    _isPlainObject: function (value) {
        return !!value && typeof value === 'object' && !this._isArray(value)
    },

    /** ES5: no `Array.isArray` assumptions on Rhino. */
    _isArray: function (value) {
        return Object.prototype.toString.call(value) === '[object Array]'
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaToolReadKit.test.js`
Expected: PASS, all cases including the pre-existing ones.

- [ ] **Step 5: Run the full suite**

Run: `npx jest`
Expected: 26 suites passing, 1,198 + 17 new tests.

- [ ] **Step 6: Commit**

```bash
git add src/server/PaToolReadKit.js test/PaToolReadKit.test.js
git commit -m "feat(#121): retrievalVerdict — the predicate the reads map already computes

DECISION.md §T4 and §U9.1 both count a tool being CALLED where they mean
a tool having ESTABLISHED something. PaToolReadKit.noteRead already
computes the answer: R-25 lets only a path that actually fetched rows
write 'ok' into the reads map. This reads it back as a three-valued
verdict.

Three values, not a boolean: an unclassified row must stay
distinguishable from a barren one, so pre-#121 audit rows can read blank
rather than 'none'.

Regression anchors from §T4 row 07 and §U9.1 r2-2/v10-2 are tests.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The audit column, and the write path that fills it

**Files:**
- Modify: `src/fluent/tables.now.ts` (the `x_snc_troubleshoot_audit` schema block, after `target_record`, before `confirmed_by_user`)
- Modify: `src/server/PaAuditLogger.js` (`_normParams`, `_write`, plus one new constant and one new helper)
- Test: `test/PaAuditLogger.test.js`

**Interfaces:**
- Consumes: Task 1's verdict strings `'ok' | 'none' | 'unknown'` (as values only — this task does not call the kit).
- Produces: `logResult({runId, toolName, output, retrieval})` writes `retrieval` to the audit row when it is one of the three values and the row is a `result` row. Tasks 4 and 5 supply the param; Task 3 reads the column back.

**Context the implementer needs.** `_write(actionType, params, payloadKeys)` is the single write path for all three entry points. `_normParams(raw)` is where caller params are normalised, and it deliberately refuses `user` and `confirmed_by_user` (two Medium security findings on PR #21) — do not follow that refusal pattern here; `retrieval` is derived by our own code from the tool result, not asserted by the LLM-derived payload, so accepting it is correct. It still gets whitelisted, because a `ChoiceColumn` accepts an unlisted value silently and a junk value in an audit column is exactly the R-6 blank-masquerading-as-a-state failure.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaAuditLogger.test.js`, at the end of the "three entry points" area (before the `invokedTools` section at ~line 438):

```js
// ---------------------------------------------------------------------------
// retrieval (#121) — the write side
//
// The column exists so that "did this call retrieve anything" is a QUERY
// (run=X^action_type=result^retrieval=ok) rather than a payload read. It
// cannot be a payload read: applyThreshold replaces oversized results with an
// excerpt envelope before logResult ever sees them, and _digest then eats
// head+tail past 4,000 chars. See the design doc §3.1.
// ---------------------------------------------------------------------------

describe('retrieval (#121)', () => {
    test('logResult writes the verdict onto the result row', () => {
        const { logger, world } = load()
        logger.logResult({
            runId: RUN,
            toolName: 'genai_log',
            output: { success: true },
            retrieval: 'ok',
        })

        expect(rows(world)[0].retrieval).toBe('ok')
    })

    test.each(['ok', 'none', 'unknown'])('accepts the verdict %s', (verdict) => {
        const { logger, world } = load()
        logger.logResult({ runId: RUN, toolName: 'genai_log', output: {}, retrieval: verdict })
        expect(rows(world)[0].retrieval).toBe(verdict)
    })

    test('an unlisted value writes BLANK, not the raw string', () => {
        // A ChoiceColumn accepts an unlisted value silently, so the guard has
        // to live on this side. R-6: a junk value in an audit column is worse
        // than an absent one, because a reader cannot tell it is junk.
        const { logger, world } = load()
        logger.logResult({ runId: RUN, toolName: 'genai_log', output: {}, retrieval: 'OK' })
        expect(rows(world)[0].retrieval).toBeUndefined()
    })

    test.each([undefined, null, '', 0, {}, ['ok']])(
        'a non-verdict param (%p) writes blank rather than throwing',
        (value) => {
            const { logger, world } = load()
            const res = logger.logResult({
                runId: RUN,
                toolName: 'genai_log',
                output: {},
                retrieval: value,
            })
            expect(res.logged).toBe(true)
            expect(rows(world)[0].retrieval).toBeUndefined()
        }
    )

    test('omitting the param entirely leaves the column blank — pre-#121 callers still work', () => {
        const { logger, world } = load()
        logger.logResult({ runId: RUN, toolName: 'genai_log', output: { success: true } })
        expect(rows(world)[0].retrieval).toBeUndefined()
    })

    test('an intent row never carries a verdict — there is no result to classify', () => {
        const { logger, world } = load()
        logger.logIntent({ runId: RUN, toolName: 'genai_log', input: {}, retrieval: 'ok' })
        expect(rows(world)[0].retrieval).toBeUndefined()
    })

    test('an error row never carries a verdict — its failure is already in output', () => {
        // Adding a redundant 'none' here would invite a reader to count error
        // rows into a denominator built from result rows.
        const { logger, world } = load()
        logger.logError({ runId: RUN, toolName: 'genai_log', error: 'boom', retrieval: 'none' })
        expect(rows(world)[0].retrieval).toBeUndefined()
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaAuditLogger.test.js -t "retrieval (#121)"`
Expected: FAIL — `row.retrieval` is `undefined` on the cases that expect a value.

- [ ] **Step 3: Add the Fluent column**

In `src/fluent/tables.now.ts`, inside the `x_snc_troubleshoot_audit` `schema` block, between `target_record` and `confirmed_by_user`:

```ts
        // #121 — did this call RETRIEVE anything, or did it merely run?
        //
        // Computed by PaToolReadKit.retrievalVerdict on the tool core's
        // PRE-THRESHOLD result, at PaToolRegistry.dispatch and
        // PaScriptToolAdapter.invoke. It cannot be re-derived from `output`
        // after the fact: applyThreshold replaces an oversized result with an
        // excerpt envelope carrying no `reads` map, and PaAuditLogger then
        // digests head+tail past 4,000 chars — so the LARGEST, most likely
        // productive results are precisely the ones whose evidence is gone.
        //
        // NO DEFAULT, deliberately. Blank means "row written before #121", and
        // the eight seed-01 runs already on the instance (DECISION.md §U9.1)
        // must not read back as a mechanical `none`. That 1-of-4 was derived
        // by hand and stays labelled as one.
        //
        // Written on `result` rows only. Build Rule #8: `{ value_key: 'Label' }`.
        retrieval: ChoiceColumn({
            label: 'Retrieval',
            choices: {
                ok: 'Retrieved rows',
                none: 'Retrieved nothing',
                unknown: 'Not determinable',
            },
        }),
```

- [ ] **Step 4: Implement the write path**

In `src/server/PaAuditLogger.js`, add the constant beside `MAX_RECORD_ID_CHARS`:

```js
    /** The only values `retrieval` may take (#121). See `_retrievalValue`. */
    RETRIEVAL_VALUES: ['ok', 'none', 'unknown'],
```

Add to the object returned by `_normParams`, after `targetRecord`:

```js
            // #121. Unlike `user` and `confirmed_by_user` above, this IS
            // caller-settable: it is derived by our own dispatch code from the
            // tool core's result, not asserted by the LLM-derived payload. It
            // is whitelisted all the same — see `_retrievalValue`.
            retrieval: this._retrievalValue(raw.retrieval),
```

Add the helper beside `_trim`:

```js
    /**
     * One of RETRIEVAL_VALUES, or blank (#121).
     *
     * A ChoiceColumn accepts an unlisted value silently, so an unrecognised
     * verdict would sit in the audit trail looking like a fact. R-6 in its
     * purest form: blank is honest, junk is not.
     */
    _retrievalValue: function (value) {
        // NOT via `_norm`: it does `String(value)`, and `String(['ok'])` is
        // the string 'ok' — a single-element array would pass the whitelist.
        if (typeof value !== 'string') return ''
        for (var i = 0; i < this.RETRIEVAL_VALUES.length; i++) {
            if (this.RETRIEVAL_VALUES[i] === value) return value
        }
        return ''
    },
```

In `_write`, immediately after the `input` / `output` assignment:

```js
            // #121: RESULT rows only. An intent row has no result to classify,
            // and an error row already carries its failure in `output` — a
            // redundant `none` there would invite a reader to count error rows
            // into a denominator built from result rows.
            if (actionType === 'result' && p.retrieval) gr.setValue('retrieval', p.retrieval)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest test/PaAuditLogger.test.js`
Expected: PASS.

- [ ] **Step 6: Verify the Fluent change builds**

Run: `now-sdk build`
Expected: build succeeds. If it fails, the ChoiceColumn shape is the first thing to check (Build Rule #8) — choices are `{ value_key: 'Label' }`, and `ChoiceColumn` is already imported at the top of `tables.now.ts`.

- [ ] **Step 7: Run the full suite**

Run: `npx jest`
Expected: 26 suites passing.

- [ ] **Step 8: Commit**

```bash
git add src/fluent/tables.now.ts src/fluent/generated/keys.ts src/server/PaAuditLogger.js test/PaAuditLogger.test.js
git commit -m "feat(#121): audit rows record whether the call retrieved anything

The verdict cannot be re-derived from the output column: applyThreshold
replaces an oversized result with an excerpt envelope BEFORE logResult
runs, and the digest then eats head+tail past 4,000 chars — so the
largest and most likely productive results lose the evidence. It is
stored instead.

No default on the column: blank means a pre-#121 row, so §U9.1's eight
runs never read back as a mechanical 'none'.

Whitelisted on the write side because a ChoiceColumn takes an unlisted
value silently, and junk in an audit column is worse than blank (R-6).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The read path — `invokedTools` returns `retrievingTools`

**Files:**
- Modify: `src/server/PaAuditLogger.js` (`invokedTools`, `_noCalls`'s sibling `_noTools`)
- Test: `test/PaAuditLogger.test.js`

**Interfaces:**
- Consumes: the `retrieval` column from Task 2.
- Produces: `invokedTools(runId)` now returns `{available: true, tools: [String], retrievingTools: [String]}` on success and `{available: false, degraded: String, tools: [], retrievingTools: []}` on every degradation. `tools` is unchanged in meaning and content. Task 6 consumes `retrievingTools`.

**Context the implementer needs.** `invokedTools` is on the fix-report path and is called once per `_handleFixReport` and once per `_depthGate` invocation, so this must stay a **single query** — read the extra column inside the existing `while (gr.next())` loop rather than adding a second pass. `_auditContext` in `PaAgentLoop` also consumes this method and must keep reading `tools`; that is Task 6's concern, and this task must not change `tools`.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('invokedTools', …)` block in `test/PaAuditLogger.test.js`. Note the local `auditRow` helper takes `(run, tool, actionType)` and returns a plain row object — build rows with a `retrieval` key directly where one is needed:

```js
    // -----------------------------------------------------------------------
    // retrievingTools (#121) — the subset that actually fetched rows
    // -----------------------------------------------------------------------

    /** An audit row carrying a #121 retrieval verdict. */
    function retrievalRow(run, tool, verdict) {
        return {
            sys_id: 'a' + tool + verdict,
            run: run,
            tool_name: tool,
            action_type: 'result',
            retrieval: verdict,
        }
    }

    test('retrievingTools carries only the tools whose call retrieved rows', () => {
        const { logger } = load({
            world: {
                rows: {
                    [AUDIT_TABLE]: [
                        retrievalRow(RUN, 'genai_log', 'ok'),
                        retrievalRow(RUN, 'schema_lookup', 'none'),
                        retrievalRow(RUN, 'agent_config', 'unknown'),
                    ],
                },
            },
        })

        const res = logger.invokedTools(RUN)

        expect(res.tools.sort()).toEqual(['agent_config', 'genai_log', 'schema_lookup'])
        expect(res.retrievingTools).toEqual(['genai_log'])
    })

    test('a tool that called twice — once barren, once productive — retrieves', () => {
        // The question is "did this run establish anything through that tool",
        // not "was every call through it productive".
        const { logger } = load({
            world: {
                rows: {
                    [AUDIT_TABLE]: [
                        { sys_id: 'a1', run: RUN, tool_name: 'genai_log', action_type: 'result', retrieval: 'none' },
                        { sys_id: 'a2', run: RUN, tool_name: 'genai_log', action_type: 'result', retrieval: 'ok' },
                    ],
                },
            },
        })

        expect(logger.invokedTools(RUN).retrievingTools).toEqual(['genai_log'])
    })

    test('a productive tool appears in retrievingTools ONCE, however many ok rows it has', () => {
        const { logger } = load({
            world: {
                rows: {
                    [AUDIT_TABLE]: [
                        { sys_id: 'a1', run: RUN, tool_name: 'genai_log', action_type: 'result', retrieval: 'ok' },
                        { sys_id: 'a2', run: RUN, tool_name: 'genai_log', action_type: 'result', retrieval: 'ok' },
                    ],
                },
            },
        })

        expect(logger.invokedTools(RUN).retrievingTools).toEqual(['genai_log'])
    })

    test('a BLANK retrieval column never counts as ok — pre-#121 rows are not retroactive evidence', () => {
        // DECISION.md §U9.1's 1-of-4 was hand-derived from two payloads. Rows
        // written before this column existed must not read back as a verdict
        // in either direction.
        const { logger } = load({
            world: { rows: { [AUDIT_TABLE]: [auditRow(RUN, 'genai_log', 'result')] } },
        })

        const res = logger.invokedTools(RUN)

        expect(res.tools).toEqual(['genai_log'])
        expect(res.retrievingTools).toEqual([])
    })

    test('retrievingTools is [] on every degraded path', () => {
        expect(logger_forEmpty().retrievingTools).toEqual([])

        function logger_forEmpty() {
            const { logger } = load({ world: { rows: { [AUDIT_TABLE]: [] } } })
            return logger.invokedTools(RUN)
        }
    })

    test.each(['no_run_id', 'query_failed', 'glide_unavailable'])(
        'retrievingTools is [] when the query degrades (%s)',
        (reason) => {
            const opts =
                reason === 'glide_unavailable'
                    ? { noGlide: true }
                    : reason === 'query_failed'
                      ? { world: { throwOnQuery: hostileException() } }
                      : { world: { rows: { [AUDIT_TABLE]: [auditRow(RUN, 'agent_trace', 'intent')] } } }
            const { logger } = load(opts)

            const res = logger.invokedTools(reason === 'no_run_id' ? undefined : RUN)

            expect(res.degraded).toBe(reason)
            expect(res.retrievingTools).toEqual([])
        }
    )

    test('an ok verdict on a row with a blank tool_name is skipped, not credited to an empty name', () => {
        const { logger } = load({
            world: {
                rows: {
                    [AUDIT_TABLE]: [
                        { sys_id: 'a1', run: RUN, tool_name: '', action_type: 'result', retrieval: 'ok' },
                        retrievalRow(RUN, 'genai_log', 'ok'),
                    ],
                },
            },
        })

        expect(logger.invokedTools(RUN).retrievingTools).toEqual(['genai_log'])
    })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaAuditLogger.test.js -t retrievingTools`
Expected: FAIL — `res.retrievingTools` is `undefined`.

- [ ] **Step 3: Implement the read path**

In `src/server/PaAuditLogger.js`, replace the body of `invokedTools`'s loop and returns:

```js
            var tools = []
            var retrieving = []
            while (gr.next()) {
                var name = this._normToolName(gr.getValue('tool_name'))
                if (!name) continue
                if (this._indexOfTool(tools, name) === -1) tools.push(name)

                // #121: the SAME pass, deliberately. This method is on the
                // fix-report path and runs again per depth-gate check; a
                // second query for one column would double its cost for
                // nothing.
                if (
                    this._norm(gr.getValue('retrieval')) === 'ok' &&
                    this._indexOfTool(retrieving, name) === -1
                ) {
                    retrieving.push(name)
                }
            }

            if (tools.length === 0) return this._noTools('no_audit_rows')
            return { available: true, tools: tools, retrievingTools: retrieving }
```

and `_noTools`:

```js
    _noTools: function (reason) {
        return { available: false, degraded: reason, tools: [], retrievingTools: [] }
    },
```

Extend the method's docblock to record what `retrievingTools` means and what it does **not**:

```js
     * `retrievingTools` (#121) is the subset of `tools` with at least one
     * `result` row at `retrieval = 'ok'` — the tools that actually fetched
     * rows, as opposed to the tools that merely ran. A BLANK column is never
     * `ok`: rows written before #121 carry no verdict and must not read back
     * as one in either direction.
     *
     * `tools` is unchanged and stays the answer to "was this tool ever
     * invoked in this run", which is the question fabrication fails (#79). A
     * citation to a tool that ran and returned nothing is a WEAK citation, not
     * a fabricated one, and `_auditContext` must keep convicting on the right
     * charge.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaAuditLogger.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npx jest`
Expected: 26 suites passing. `PaAgentLoop.test.js`'s `fakeAuditLogger` returns a hand-built object and does not go through this code, so nothing there should break yet.

- [ ] **Step 6: Commit**

```bash
git add src/server/PaAuditLogger.js test/PaAuditLogger.test.js
git commit -m "feat(#121): invokedTools reports which tools actually retrieved rows

retrievingTools is the subset with at least one result row at
retrieval='ok', read in the SAME pass — this method is on the fix-report
path and runs again per depth-gate check.

A blank column is never ok. Rows written before #121 carry no verdict
and must not read back as one in either direction.

tools is unchanged: it stays the answer to 'was this tool ever invoked',
which is the question fabrication fails (#79). A citation to a tool that
ran and returned nothing is weak, not fabricated.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Take the verdict at the custom-harness dispatch site

**Files:**
- Modify: `src/server/PaToolRegistry.js` (`initialize`, `dispatch`, plus one new private helper)
- Test: `test/PaToolRegistry.test.js`

**Interfaces:**
- Consumes: `PaToolReadKit.retrievalVerdict` (Task 1); `logResult({…, retrieval})` (Task 2).
- Produces: nothing new for later tasks — this task makes the column non-empty in production for the custom harness.

**Context the implementer needs — this is the task the design turns on.** In `dispatch`, the order today is: `core.execute(args)` → `applyThreshold` → `logResult`. `applyThreshold` returns a *different object* past `THRESHOLD_CHARS` — `{success, truncated:true, tool, total_length, artifact_id, page_size, pages, excerpt, note}` — with no `data.reads`. The verdict must therefore be taken **between `core.execute` and `applyThreshold`**, on `result` before it is reassigned. Taking it anywhere later scores every large result `'unknown'`, and large results are the ones most likely to be productive.

`PaToolReadKit` is a separate Script Include and is not in the `vm` context the tests build for `PaToolRegistry`, so `new PaToolReadKit()` throws `ReferenceError` under test. It is therefore injectable, following the existing `_auditLogger` / `_artifactStore` pattern, and the call is wrapped so the failure degrades to `'unknown'` rather than taking down the tool call.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaToolRegistry.test.js`. The file's existing `load(opts)` helper passes `cores`, `auditLogger` and `artifactStore`; add `readKit` to the object it constructs (Step 3 covers the production side, but the helper change belongs with the tests).

> **CORRECTION (found during execution).** The `cores` fixtures below are written as bare factory
> functions — `agent_trace: () => ({ execute: … })`. That is **wrong**: `dispatch` resolves
> `reg[toolName]` and checks `typeof entry.factory !== 'function'`, so a bare function returns
> "Unknown tool" and short-circuits *before* the audit logger is ever called — the tests would pass
> for the wrong reason and the failing-first step would show the wrong failure. Wrap every `cores`
> entry in the file's own `fakeEntry({ factory: … })` helper, which is the only registry-entry shape
> that file uses and whose defaults include the `destructive: false` the dispatch gate requires.

```js
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
            cores: { agent_trace: () => ({ execute: () => ({ success: true, data: { reads: { x: 'ok' } } }) }) },
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
            cores: { genai_log: () => ({ execute: () => big }) },
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
                schema_lookup: () => ({
                    execute: () => ({ success: true, data: { table_exists: false, reads: { sys_db_object: 'empty' } } }),
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
            cores: { agent_trace: () => ({ execute: () => ({ success: true, data: { reads: { x: 'ok' } } }) }) },
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
                read_artifact: () => ({
                    PAGED_OUTPUT: true,
                    execute: () => ({ success: true, data: { content: 'abc' } }),
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
                agent_trace: () => ({
                    execute: () => {
                        throw new Error('inner')
                    },
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
```

Update the file's `load` helper to pass the kit through:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaToolRegistry.test.js -t "retrieval verdict"`
Expected: FAIL — `resultCall(audit).retrieval` is `undefined`.

- [ ] **Step 3: Implement**

In `src/server/PaToolRegistry.js`, `initialize`:

```js
        this._readKit = o.readKit || null
```

In `dispatch`, inside the `try`, between `core.execute` and the threshold block:

```js
            var core = entry.factory()
            var result = core.execute(args)

            // #121: THE VERDICT IS TAKEN HERE, and the position is the whole
            // point. `applyThreshold` below replaces an oversized result with
            // an excerpt envelope that carries no `data.reads` at all, and
            // PaAuditLogger then digests head+tail past 4,000 chars — so a
            // verdict read off the logged payload would score 'unknown' for
            // exactly the large results most likely to have retrieved
            // something. DECISION.md §T4 / §U9.1 are what this exists to make
            // countable; see the design doc §3.1.
            var retrieval = this._retrievalVerdict(result)
```

and thread it into the log call:

```js
            this._audit('logResult', {
                runId: runId,
                toolName: toolName,
                output: result,
                retrieval: retrieval,
            })
```

Add the helper beside `_store`:

```js
    /**
     * The #121 retrieval verdict, taken on a tool core's PRE-THRESHOLD result.
     *
     * Guarded for the same reason `_audit` is: this component is in the hot
     * path of every tool call, and a diagnosis that fails because its own
     * instrumentation threw is strictly worse than a diagnosis with a gap in
     * the instrument. 'unknown' is a legitimate answer (R-10); an exception
     * escaping into the loop is not.
     */
    _retrievalVerdict: function (result) {
        try {
            var kit = this._readKit || new PaToolReadKit()
            return kit.retrievalVerdict(result)
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            return 'unknown'
        }
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaToolRegistry.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite and the build**

Run: `npx jest && now-sdk build`
Expected: 26 suites passing; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/server/PaToolRegistry.js test/PaToolRegistry.test.js
git commit -m "feat(#121): the custom harness records a retrieval verdict per call

Taken between core.execute and applyThreshold, and the position is the
design: applyThreshold replaces an oversized result with an excerpt
envelope carrying no reads map, so a verdict taken later would be
'unknown' for exactly the large results most likely to be productive.
The test asserts that ordering directly.

The kit call is guarded like _audit is — this is the hot path of every
tool call, and 'unknown' is a legitimate answer where a throw is not.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Take the verdict at the native-harness dispatch site

**Files:**
- Modify: `src/server/PaScriptToolAdapter.js` (`initialize`, `invoke`, plus the same private helper)
- Test: `test/PaScriptToolAdapter.test.js`

**Interfaces:**
- Consumes: `PaToolReadKit.retrievalVerdict` (Task 1); `logResult({…, retrieval})` (Task 2).
- Produces: nothing new — this makes the column non-empty for the native harness too, so a comparison pass reads both arms from the same instrument.

**Context the implementer needs.** `invoke`'s order is `core.execute` → `applyThreshold` → `_attachRunState` → `logResult`. The verdict goes immediately after `core.execute`, before **both** of the later steps: `_attachRunState` adds run metadata onto the result and is another reason the logged object is not the core's own. The adapter tracks a `phase` string so a failure can be localised without reading the exception (R-1) — the verdict does not need its own phase, because it cannot throw past its own guard.

Why both call sites and not just the custom one: `DECISION.md` §T6 compares the arms tool-for-tool, and an instrument fitted to one arm produces exactly the confound §I4 item 3 warns about.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaScriptToolAdapter.test.js`, following that file's existing `load`/stub conventions (read the top of the file first — it builds an adapter with `tools`, `runAnchor`, `auditLogger` and `artifactStore` injected):

```js
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

    test('the verdict is taken on the core result, before thresholding AND before _attachRunState', () => {
        const audit = auditSpy()
        const kit = fakeKit('ok')
        const core = { success: true, data: { reads: { sys_generative_ai_log: 'ok' } } }
        const adapter = load({
            tools: { genai_log: () => ({ execute: () => core }) },
            auditLogger: audit,
            readKit: kit,
        })

        adapter.invoke('genai_log', '{}', { execution: 'e1' })

        expect(kit.seen[0]).toBe(core)
        expect(resultCall(audit).retrieval).toBe('ok')
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
```

If `auditSpy` and `resultCall` do not already exist in that file, define them at the top of this `describe` exactly as in Task 4's test block.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaScriptToolAdapter.test.js -t "retrieval verdict"`
Expected: FAIL — `retrieval` is `undefined`.

- [ ] **Step 3: Implement**

In `src/server/PaScriptToolAdapter.js`, `initialize`:

```js
        this._readKit = o.readKit || null
```

In `invoke`, immediately after the `execute` phase:

```js
            phase = 'execute'
            var core = factory()
            var result = core.execute(args)

            // #121: taken HERE, before `applyThreshold` replaces an oversized
            // result with an excerpt envelope carrying no `data.reads`, and
            // before `_attachRunState` adds run metadata on top. Both call
            // sites classify — an instrument fitted to one harness and not the
            // other is the confound §I4 item 3 warns about, in a comparison
            // §T6 reads tool-for-tool.
            var retrieval = this._retrievalVerdict(result)
```

and in the `result` phase:

```js
            this._audit('logResult', {
                runId: runId,
                toolName: name,
                output: result,
                retrieval: retrieval,
            })
```

Add the same helper beside `_store` (repeated verbatim rather than shared: the two components deliberately do not depend on each other — see the ROSTER EQUALITY note in `PaToolRegistry`, which keeps them structurally parallel and independently testable):

```js
    /**
     * The #121 retrieval verdict, taken on a tool core's PRE-THRESHOLD result.
     * Guarded for the same reason `_audit` is: this adapter is the native
     * harness's entry point for every tool call, and 'unknown' is a legitimate
     * answer (R-10) where a throw is not.
     */
    _retrievalVerdict: function (result) {
        try {
            var kit = this._readKit || new PaToolReadKit()
            return kit.retrievalVerdict(result)
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            return 'unknown'
        }
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaScriptToolAdapter.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite and the build**

Run: `npx jest && now-sdk build`
Expected: 26 suites passing; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/server/PaScriptToolAdapter.js test/PaScriptToolAdapter.test.js
git commit -m "feat(#121): the native harness records a retrieval verdict too

Same predicate, same pre-threshold position, second call site. §T6
compares the two arms tool-for-tool, and an instrument fitted to one arm
is the confound §I4 item 3 warns about.

The helper is repeated rather than shared: the registry and the adapter
deliberately do not depend on each other (see ROSTER EQUALITY), which is
what keeps them independently testable.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The gate releases on retrieval — shipped dormant

**Files:**
- Modify: `src/server/PaAgentLoop.js` (constant, `initialize`, `_trailTools`, new `_releaseSet`, `_depthGate`)
- Test: `test/PaAgentLoop.test.js`

**Interfaces:**
- Consumes: `invokedTools(runId).retrievingTools` (Task 3).
- Produces: `PaAgentLoop.REQUIRE_RETRIEVAL_TO_RELEASE` (default `false`), settable via `initialize({requireRetrievalToRelease: true})`. `_trailTools(runId)` now returns `{readable, tools, retrieving, degraded}`.

**Context the implementer needs.**

`_depthGate` reads the trail in **two** places and both must use the same set:

1. The sticky release check — `if (sticky && this._anyOf(this._heldTools, trail.tools))`.
2. The first-hold derivation — `this._openGaps(this._safeGaps(action.report), trail.tools)`.

Using the strict set in (1) but not (2) would let a barren call pre-close a declared gap before any hold could be issued — the identical defect, one step earlier.

**Why it ships dormant.** §T9 calls this rule *"the obvious next candidate"* and immediately adds *"whether it helps is unmeasured"*. §U9 ruled one version ago that *"No verdict is not the same as proven, so the default is off."* Turning it on by default would change, on no evidence, an instrument that eight passes of measurement are calibrated against. The audit column from Tasks 2/4/5 is written regardless of the flag, so the counterfactual gets measured for free on runs that were happening anyway.

**Two things this task deliberately does not touch**, both recorded in the design §4.3 — do not "fix" either:

- `_step`'s optimistic `this._holdActive = null` after a dispatch still clears by tool name. It affects prompt wording only; the real trail-backed check still runs at the next terminal action, and the comment already there says so.
- `_auditContext` keeps consuming `tools`, not `retrievingTools`. #79's citation cross-check asks whether a tool was ever invoked, which is the question *fabrication* fails. A citation to a tool that ran and returned nothing is weak, not fabricated.

**Existing tests that will break, and how to fix them.** The `describe('depth gate (#103) — _trailTools', …)` block asserts the whole return object with `toEqual`. Seven assertions gain `retrieving: []` (or the appropriate value):

- `'an available trail is readable and carries its tools'`
- `'no_audit_rows is READABLE with zero tools — the trail answered'`
- `test.each(['glide_unavailable', 'query_failed', 'no_run_id'])` — three cases
- `'a throwing audit logger degrades rather than propagating (R-1)'`
- `'T2: available:false with degraded absent entirely degrades to not-readable'`
- `'T2: a non-array tools on an available:true result degrades tools to [] (the _isArray guard)'`

Fix them at the assertion. Do **not** relax `toEqual` to `toMatchObject` — the exactness is the point of those tests.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaAgentLoop.test.js`. Note the file's `fakeAuditLogger(result)` helper returns whatever object it was given from `invokedTools`, so a `retrievingTools` key is supplied directly:

```js
// ===========================================================================
// depth gate (#121) — release on RETRIEVAL, not on a tool name
//
// DECISION.md §T4: "the gate counts a layer-4 tool being *called*, not layer 4
// being *reached*" — v9 row 07's schema_lookup answered `table_exists: false`,
// retrieved nothing, and released the gate. §T9 asked for a release rule that
// inspected what the tool returned.
//
// It SHIPS DORMANT, per §U9's precedent: "No verdict is not the same as
// proven, so the default is off." The audit column records the verdict on
// every run regardless, so the counterfactual is measurable for free before
// anything is turned on.
// ===========================================================================

describe('depth gate (#121) — retrieval-aware release', () => {
    const GAP4 = { layer: 4, name: 'Data schemas', reason: 'r4', tools: ['schema_lookup'] }
    const REPORT = { failure_summary: 'x', layers_swept: [1] }

    // fakeFixReport's signature is POSITIONAL: (validateResults, gaps,
    // declared). `gaps` is what its unsweptGaps() returns — the loop tests
    // inject the derived list directly, because derivation is PaFixReport's
    // concern and is tested in test/PaFixReport.test.js.
    function gateLoop(trail, opts) {
        const o = opts || {}
        return load({
            runManager: fakeRunManager(),
            auditLogger: fakeAuditLogger(trail),
            fixReport: fakeFixReport([], o.gaps || []),
            requireRetrievalToRelease: o.requireRetrievalToRelease,
        })
    }

    // -----------------------------------------------------------------------
    // Ships dormant — the §U9 pattern
    // -----------------------------------------------------------------------

    test('SHIPS DORMANT: at the shipped default a barren call still releases the gate', () => {
        // Constructed with NO option at all. This is the assertion that makes
        // the change safe to merge without a measured round: today's
        // behaviour, unchanged.
        const loop = gateLoop(
            { available: true, tools: ['schema_lookup'], retrievingTools: [] },
            { gaps: [GAP4] }
        )
        loop._heldTools = ['schema_lookup']
        loop._heldGaps = [GAP4]

        const gate = loop._depthGate('run1', { action: 'fix_report', report: REPORT })

        expect(loop.REQUIRE_RETRIEVAL_TO_RELEASE).toBe(false)
        expect(gate.hold).toBe(false)
        expect(gate.capped).toBe(false)
    })

    // -----------------------------------------------------------------------
    // Flag on
    // -----------------------------------------------------------------------

    test('flag on: a call that retrieved NOTHING does not discharge the hold', () => {
        // §T4 row 07, mechanically: schema_lookup was called, and answered
        // table_exists:false.
        const loop = gateLoop(
            { available: true, tools: ['schema_lookup'], retrievingTools: [] },
            { gaps: [GAP4], requireRetrievalToRelease: true }
        )
        loop._heldTools = ['schema_lookup']
        loop._heldGaps = [GAP4]

        const gate = loop._depthGate('run1', { action: 'fix_report', report: REPORT })

        expect(gate.hold).toBe(true)
        expect(gate.kind).toBe('gaps')
    })

    test('flag on: a call that DID retrieve discharges the hold', () => {
        const loop = gateLoop(
            { available: true, tools: ['schema_lookup'], retrievingTools: ['schema_lookup'] },
            { gaps: [GAP4], requireRetrievalToRelease: true }
        )
        loop._heldTools = ['schema_lookup']
        loop._heldGaps = [GAP4]

        const gate = loop._depthGate('run1', { action: 'fix_report', report: REPORT })

        expect(gate.hold).toBe(false)
        expect(gate.capped).toBe(false)
    })

    test('flag on: a barren call does not PRE-CLOSE a declared gap either', () => {
        // Both trail consumers use the same set. Using the strict set only in
        // the release check would let a barren call close a gap before any
        // hold could be issued — the same defect, one step earlier.
        const loop = gateLoop(
            { available: true, tools: ['schema_lookup'], retrievingTools: [] },
            { gaps: [GAP4], requireRetrievalToRelease: true }
        )

        const gate = loop._depthGate('run1', { action: 'fix_report', report: REPORT })

        expect(gate.hold).toBe(true)
        expect(gate.gaps).toEqual([GAP4])
    })

    test('flag on: MAX_HOLDS still bounds the run and still reports capped', () => {
        const loop = gateLoop(
            { available: true, tools: ['schema_lookup'], retrievingTools: [] },
            { gaps: [GAP4], requireRetrievalToRelease: true }
        )
        loop._heldTools = ['schema_lookup']
        loop._heldGaps = [GAP4]
        loop._holdCount = loop.MAX_HOLDS

        const gate = loop._depthGate('run1', { action: 'fix_report', report: REPORT })

        expect(gate.hold).toBe(false)
        expect(gate.capped).toBe(true)
    })

    test('flag on: an unreadable trail still fails OPEN', () => {
        // A Glide hiccup must never trap a run in a hold it cannot escape.
        const loop = gateLoop(
            { available: false, degraded: 'query_failed', tools: [], retrievingTools: [] },
            { gaps: [GAP4], requireRetrievalToRelease: true }
        )
        loop._heldTools = ['schema_lookup']

        expect(loop._depthGate('run1', { action: 'fix_report', report: REPORT }).hold).toBe(false)
    })

    // -----------------------------------------------------------------------
    // The option guard — deliberately NOT the `>= 0` shape
    // -----------------------------------------------------------------------

    test.each([null, undefined, 0, '', 'true', 1])(
        'requireRetrievalToRelease: %p leaves the default at false',
        (value) => {
            // maxEvidenceReturns uses `>= 0`, which accepts null (null >= 0 is
            // true) — filed on #121's own comment thread. This is `=== true`.
            const loop = load({ requireRetrievalToRelease: value })
            expect(loop.REQUIRE_RETRIEVAL_TO_RELEASE).toBe(false)
        }
    )

    test('requireRetrievalToRelease: true turns it on', () => {
        expect(load({ requireRetrievalToRelease: true }).REQUIRE_RETRIEVAL_TO_RELEASE).toBe(true)
    })

    // -----------------------------------------------------------------------
    // _releaseSet
    // -----------------------------------------------------------------------

    test('_releaseSet returns tools by default and retrieving when the flag is on', () => {
        const trail = { readable: true, tools: ['a', 'b'], retrieving: ['a'], degraded: '' }

        expect(load({})._releaseSet(trail)).toEqual(['a', 'b'])
        expect(load({ requireRetrievalToRelease: true })._releaseSet(trail)).toEqual(['a'])
    })
})
```

And append to the existing `describe('depth gate (#103) — _trailTools', …)` block:

```js
    test('an available trail carries its retrieving subset (#121)', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({
                available: true,
                tools: ['agent_trace', 'genai_log'],
                retrievingTools: ['genai_log'],
            }),
        })
        expect(loop._trailTools('RUN1')).toEqual({
            readable: true,
            tools: ['agent_trace', 'genai_log'],
            retrieving: ['genai_log'],
            degraded: '',
        })
    })

    test('a non-array retrievingTools degrades to [] (#121, the _isArray guard)', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'], retrievingTools: 'nope' }),
        })
        expect(loop._trailTools('RUN1').retrieving).toEqual([])
    })

    test('an absent retrievingTools degrades to [] — a pre-#121 logger still works (#121)', () => {
        const loop = load({ auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }) })
        expect(loop._trailTools('RUN1').retrieving).toEqual([])
    })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaAgentLoop.test.js`
Expected: FAIL — the new `#121` block fails on `_releaseSet` not being a function and on the flag being `undefined`, and the seven listed `_trailTools` `toEqual` assertions fail because the returned object gained a `retrieving` key.

- [ ] **Step 3: Fix the seven existing `_trailTools` assertions**

Add `retrieving: []` to each of the seven `toEqual` objects listed in the Context section above. The `'an available trail is readable and carries its tools'` case also gets `retrieving: []` — that fixture supplies no `retrievingTools`, so `[]` is correct.

- [ ] **Step 4: Implement**

In `src/server/PaAgentLoop.js`, add the constant beside `MAX_EVIDENCE_RETURNS`:

```js
    /**
     * #121 — SHIPPED DORMANT. When true, the depth gate releases only on a
     * tool that RETRIEVED something, not on one that merely ran.
     *
     * DECISION.md §T4 measured the defect: v9 row 07's `schema_lookup`
     * answered `table_exists: false` — it established nothing — and the gate
     * released, because the release path compares tool NAMES from the audit
     * trail and never inspects what came back. §T9 asked for exactly this
     * rule and said in the same breath that "whether it helps is unmeasured".
     *
     * So it ships off, on §U9's precedent one version earlier: "No verdict is
     * not the same as proven, so the default is off." Turning it on by
     * default would move, on no evidence, an instrument eight measured passes
     * are calibrated against.
     *
     * The dormancy is not inert. `x_snc_troubleshoot_audit.retrieval` is
     * written on EVERY run regardless of this flag, so how often the strict
     * rule would have changed a release is measurable from runs that were
     * happening anyway — before anything is switched on.
     */
    REQUIRE_RETRIEVAL_TO_RELEASE: false,
```

In `initialize`, beside the other option reads:

```js
        // `=== true`, deliberately NOT the `>= 0` shape used above: `null >= 0`
        // is true in JS, so that form silently accepts a null (filed on #121).
        if (o.requireRetrievalToRelease === true) this.REQUIRE_RETRIEVAL_TO_RELEASE = true
```

Rewrite `_trailTools`'s three returns to carry `retrieving`:

```js
        if (res && res.available === true) {
            return {
                readable: true,
                tools: this._isArray(res.tools) ? res.tools : [],
                // #121. Absent on a pre-#121 logger, which degrades to [] —
                // the same guard `tools` has, for the same reason.
                retrieving: this._isArray(res.retrievingTools) ? res.retrievingTools : [],
                degraded: '',
            }
        }

        var reason = this._str(res && res.degraded ? res.degraded : 'query_failed')
        if (reason === 'no_audit_rows') {
            return { readable: true, tools: [], retrieving: [], degraded: reason }
        }
        return { readable: false, tools: [], retrieving: [], degraded: reason }
```

and the `catch`:

```js
            return { readable: false, tools: [], retrieving: [], degraded: 'query_failed' }
```

Add `_releaseSet` immediately above `_depthGate`:

```js
    /**
     * The trail set a hold may be discharged against (#121).
     *
     * Under the shipped default this is every tool the run INVOKED — the
     * §T4 rule, which releases on a `schema_lookup` that answered
     * `table_exists: false`. Under `REQUIRE_RETRIEVAL_TO_RELEASE` it is the
     * subset that actually fetched rows, per
     * `PaToolReadKit.retrievalVerdict` and the `retrieval` audit column.
     *
     * Both of `_depthGate`'s trail consumers call this. Using the strict set
     * for the release check while deriving open gaps from the loose one would
     * let a barren call pre-close a declared gap before any hold could be
     * issued — the identical defect, one step earlier.
     */
    _releaseSet: function (trail) {
        return this.REQUIRE_RETRIEVAL_TO_RELEASE === true ? trail.retrieving : trail.tools
    },
```

In `_depthGate`, after the unreadable-trail short-circuit:

```js
        var release = this._releaseSet(trail)
```

then replace both consumers:

```js
        if (sticky && this._anyOf(this._heldTools, release)) {
```

```js
        var open = this._openGaps(this._safeGaps(action.report), release)
```

Finally, extend `_depthGate`'s docblock with a short paragraph recording the change:

```js
     * RELEASE ON RETRIEVAL, NOT ON A NAME (#121, shipped dormant). The set a
     * hold is discharged against comes from `_releaseSet` rather than
     * `trail.tools` directly. See that method and
     * `REQUIRE_RETRIEVAL_TO_RELEASE`; at the shipped default the behaviour
     * described above is unchanged in every particular.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest test/PaAgentLoop.test.js`
Expected: PASS.

- [ ] **Step 6: Run the full suite and the build**

Run: `npx jest && now-sdk build`
Expected: 26 suites passing; build succeeds. If any test outside `PaAgentLoop.test.js` fails, fix it **at the fixture** by declaring `requireRetrievalToRelease: true` — never by moving the production default.

- [ ] **Step 7: Commit**

```bash
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "feat(#121): the depth gate can release on retrieval — shipped dormant

§T4: the gate 'counts a layer-4 tool being *called*, not layer 4 being
*reached*'. REQUIRE_RETRIEVAL_TO_RELEASE makes the release set the tools
that actually fetched rows instead of the tools that ran.

It ships false, on §U9's precedent: no verdict is not the same as
proven. The audit column is written regardless, so the counterfactual is
measurable for free before anything is switched on.

Both of _depthGate's trail consumers use the same set — the release
check AND _openGaps. Strict in one and loose in the other would let a
barren call pre-close a gap before any hold could be issued.

The option guard is === true, not the >= 0 shape that accepts null.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Pre-register the amended numerator, and bump the version

**Files:**
- Modify: `benchmark/DECISION.md` (append a new `## V.` section at the end — §U1–§U9 are **not** touched)
- Modify: `package.json`, `README.md`, `CHANGELOG.md`
- Test: none — documentation and metadata.

**Interfaces:**
- Consumes: everything above.
- Produces: the written rule a future sized round is measured against.

**Context the implementer needs.** `DECISION.md` is append-only by convention, and each section states that the earlier ones are unmodified with `git log -p benchmark/DECISION.md` named as the check. Follow that discipline exactly. This section claims **no result** — nothing has been run.

The version format is `YYYY.MM.DDXX` (CLAUDE.md). Current is `2026.08.0602`; the next merge on 2026-08-07 is `2026.08.0701`.

- [ ] **Step 1: Append §V to `benchmark/DECISION.md`**

```markdown
---

## V. The numerator counts a retrieval, not a call (`2026.08.0701`, #121)

**§U1–§U9 are unmodified; append-only, as throughout §U.** `git log -p benchmark/DECISION.md` is
the check. **This section claims no result. Nothing has been run.**

Design: `docs/superpowers/specs/2026-08-07-retrieval-aware-release-design.md`. Plan:
`docs/superpowers/plans/2026-08-07-retrieval-aware-release.md`.

### V1. The defect, in both places it lives

§T4 found it in the depth gate: *"the gate counts a layer-4 tool being **called**, not layer 4
being **reached**."* §U9.1 found the same defect in §U8.3's own metric: *"`2 of 4` is an artefact
of a numerator that counts a call rather than a retrieval … The honest rate is 1 of 4."*

§U9.3 queued one fix for both, and this is it.

### V2. The amended numerator, filed before any round

Replacing §U8.3's `N` from here on:

> **`N`** = of the `D` runs that fired at least one `EVIDENCE RETURN`, how many have at least one
> `x_snc_troubleshoot_audit` row with `action_type=result`, `retrieval=ok`, and a `sys_created_on`
> after the first note — equivalently, an `actor: 'tool'` transcript entry at a higher `seq` than
> the first note **whose corresponding audit result row carries `retrieval=ok`**.

`N` is now one encoded query — `run=<sys_id>^action_type=result^retrieval=ok` — rather than a
payload read. That matters beyond convenience: the `output` column **cannot** answer the question.
`PaArtifactStore.applyThreshold` replaces an oversized result with an excerpt envelope carrying no
`reads` map before `PaAuditLogger` ever sees it, and the logger then digests head+tail past 4,000
chars. The largest results are the most likely to be productive and the most likely to have lost
the evidence, so a post-hoc payload read would systematically under-count — the same
by-label-not-by-fact defect, relocated.

§U8.3's decision rule is otherwise unchanged: `N/D ≥ 1/2` stands, `< 1/2` reverts, any `partial`
reverts, `D < 3` is under-powered and yields no verdict.

### V3. What `retrieval=ok` means, exactly

`PaToolReadKit.retrievalVerdict` reads the `data.reads` map every tool core already builds, and
returns `ok` when at least one table in it is `'ok'`. R-25 permits that status only from a path
that passed `fromRowRead` — `readRows` and `readOne` and nothing else — so an `ok` means rows were
fetched, not that a schema probe succeeded.

Verified against the two calls §U9.1 turns on: v10-2's `genai_log` (`llm_call_rows: 3`) scores
`ok`; r2-2's (`entries: []`, `llm_call_rows: 0`, after a `<param>:<value>` malformation) scores
`none`. §T4 row 07's `schema_lookup` (`table_exists: false`) scores `none`.

**One accepted false negative, recorded so a future reader does not discover it as a surprise.**
`query_table`'s `rows_exist_but_are_not_visible` finding — a `GlideAggregate` count above zero
against a `GlideRecordSecure` read of zero — establishes a real ACL fact while leaving `reads` at
`'empty'`, and scores `none`. **The instrument under-counts retrieval.** That is the safe direction
for a numerator that has twice flattered the change it measures.

### V4. The number to beat is 1 of 4

§U9.1, restated because it is the baseline this metric exists to be compared against: pooled over
all eight seed-01 runs across both rounds, four fired a return, two made a tool call after it, and
**one retrieved anything**. Do not quote 2 of 4.

**Pre-#121 rows carry a BLANK `retrieval` column and cannot be re-scored mechanically.** The column
has no default for exactly this reason. The 1-of-4 was hand-derived from two payloads and stays
labelled as a hand derivation; nothing in this change makes it a queried figure retroactively.

### V5. The gate change ships DORMANT

`PaAgentLoop.REQUIRE_RETRIEVAL_TO_RELEASE: false`. §T9 called the retrieval-aware release rule
*"the obvious next candidate"* and added *"whether it helps is unmeasured"*; §U9 ruled one version
earlier that *"No verdict is not the same as proven, so the default is off."* Turning it on by
default would move an instrument eight measured passes are calibrated against, on no evidence.

**The audit column is written on every run regardless of the flag.** So the counterfactual — how
often the strict rule would have changed a release — is measurable from runs that were happening
anyway, before anything is switched on. That is the cheapest available route to the evidence §T9
says is missing, and it is the reason to prefer dormancy over a coin flip.

### V6. What is deferred, and what must be true before it runs

**Not in this change:** the sized round (#121 step 3) and the `MAX_EVIDENCE_RETURNS` flip (step 4).

§U8.5 is explicit that a second 4-run round would land on the boundary again — *"§R2.4's variance
figures say it would land on the boundary again"* — so a future round must:

1. Size `n` against the observed fire rate of roughly one half, **for the denominator, not for
   patience**.
2. Fix the stopping rule before the first run. §U8.3's `D < 3` stop fired at exactly the boundary
   and the round could not be extended without optional stopping.
3. Clear the five prerequisites filed on #121's first comment before the cap leaves `0` — the
   `_resetGate` cross-run leak, `initialize`'s `>= 0` guards accepting `null`, the untested 1→2
   evidence-return transition, `_finishAnswer`'s dropped draft, and two inaccurate comments. One
   is answered here in passing: `requireRetrievalToRelease` is read with a strict `=== true` test
   rather than the `>= 0` shape.

### V7. What this section cannot establish

Everything in §U5 stands. This change adds an instrument; it measures nothing. It does not say the
evidence return works, does not say the depth gate's strict rule helps, and does not move
`MAX_EVIDENCE_RETURNS` off `0`. §T3's governing result is untouched: six custom rows reached layer
4 and all six concluded at layer 1. **Retrieving evidence is not diagnosing.**
```

- [ ] **Step 2: Verify §U was not modified**

Run: `git diff main -- benchmark/DECISION.md | grep -c '^-'`
Expected: `0`. Any deleted line means an earlier section was edited — the append-only discipline is broken and must be fixed before committing.

- [ ] **Step 3: Bump the version in three files**

`package.json`:

```json
  "version": "2026.08.0701",
```

`README.md` line 3:

```markdown
![Version](https://img.shields.io/badge/version-2026.08.0701-blue)
```

`CHANGELOG.md` — insert directly below the `---` that follows the header notes, above `## 2026.08.0602`:

```markdown
## 2026.08.0701 — 2026-08-07

### Added — an instrument, not a behaviour change

- **A tool call is now recorded as having RETRIEVED something, or not.**
  `PaToolReadKit.retrievalVerdict` reads the `data.reads` map every tool core already builds and
  returns `ok` / `none` / `unknown`. R-25 permits an `'ok'` read status only from a path that
  actually fetched rows, so the verdict means rows came back — not that a probe succeeded. Three
  values rather than a boolean, so an unclassified row stays distinguishable from a barren one.

- **`x_snc_troubleshoot_audit.retrieval`** carries the verdict, written by both dispatch sites
  (`PaToolRegistry.dispatch` for the custom harness, `PaScriptToolAdapter.invoke` for the native
  one). **No default:** blank means a row written before this version, so `DECISION.md` §U9.1's
  eight runs never read back as a mechanical `none`.

  The verdict is taken on the tool core's **pre-threshold** result, and the position is the design.
  `PaArtifactStore.applyThreshold` replaces an oversized result with an excerpt envelope carrying
  no `reads` map, and `PaAuditLogger` then digests head+tail past 4,000 chars — so a verdict read
  back off `output` would score `unknown` for exactly the large results most likely to be
  productive.

- **`PaAuditLogger.invokedTools` returns `retrievingTools`**, the subset with at least one result
  row at `retrieval=ok`, read in the same single query. `tools` is unchanged: it remains the answer
  to "was this tool ever invoked", which is the question fabrication fails (#79), and
  `_auditContext`'s citation cross-check still uses it. A citation to a tool that ran and returned
  nothing is a weak citation, not a fabricated one.

### Changed — behind a flag that ships OFF

- **`PaAgentLoop.REQUIRE_RETRIEVAL_TO_RELEASE` (default `false`).** When enabled, the depth gate
  discharges a hold only against a tool that retrieved something. `DECISION.md` §T4 measured why:
  v9 row 07's `schema_lookup` answered `table_exists: false`, established nothing, and released the
  gate, because the release path compares tool names from the audit trail and never inspects the
  result.

  **It ships dormant on §U9's precedent** — *"No verdict is not the same as proven, so the default
  is off"* — because §T9 asked for this rule and said in the same breath that whether it helps is
  unmeasured. At the shipped default, gate behaviour is unchanged in every particular, and a test
  asserts exactly that. The audit column is written regardless of the flag, so the counterfactual
  is measurable for free from runs that were happening anyway.

  Both of `_depthGate`'s trail consumers use the same set — the sticky release check and
  `_openGaps`. Strict in one and loose in the other would let a barren call pre-close a declared
  gap before any hold could be issued.

### Documented

- **`DECISION.md` §V** pre-registers the amended evidence-return numerator: a gathering call counts
  toward `N` only when its audit result row carries `retrieval=ok`. §U1–§U9 unmodified. The number
  a future round must beat is **1 of 4**, not 2 of 4. The sized round and the
  `MAX_EVIDENCE_RETURNS` flip are explicitly deferred, with the three conditions that must hold
  first.

### Not changed, deliberately

- `MAX_EVIDENCE_RETURNS` stays at `0`. This version adds no evidence about the evidence return.
- `_step`'s optimistic hold-clear after a dispatch still matches by tool name. It affects prompt
  wording only; the real trail-backed check still runs at the next terminal action.
- The five prerequisites on #121's first comment are untouched. They block the cap flip, not this.
```

- [ ] **Step 4: Verify the full suite and the build one last time**

Run: `npx jest && now-sdk build`
Expected: 26 suites passing; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add benchmark/DECISION.md package.json README.md CHANGELOG.md
git commit -m "docs(#121): §V pre-registers a numerator that counts retrievals

A gathering call counts toward N only when its audit result row carries
retrieval=ok. N becomes one encoded query, which matters beyond
convenience: the output column cannot answer the question, because
applyThreshold and the audit digest eat the evidence on exactly the
large results most likely to be productive.

The number to beat is 1 of 4 (§U9.1), not 2 of 4. Pre-#121 rows are
blank and cannot be re-scored mechanically.

Claims no result — nothing has been run. §U1–§U9 unmodified.

Version 2026.08.0701.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Push and open the PR**

```bash
git push -u origin fix/121-retrieval-aware-release
gh pr create --title "fix(#121): count a gathering call only when it retrieved something" --body "$(cat <<'BODY'
Closes the instrument half of #121 — steps 1 and 2. The sized round (step 3) and the
`MAX_EVIDENCE_RETURNS` flip (step 4) are deferred, per `DECISION.md` §V6.

## What this is

`DECISION.md` §T4 found the depth gate releasing on a `schema_lookup` that answered
`table_exists: false`. §U9.1 found the evidence-return numerator counting a `genai_log` call that
returned `entries: []`. Both count a tool being **called** where they mean a tool having
**established something**. §T9 and §U9.3 each asked for the same correction; one predicate serves
both.

## The predicate was already in the codebase

`PaToolReadKit.noteRead` maintains `data.reads` on every tool, and R-25 permits an `'ok'` status
only from a path that actually fetched rows. `retrievalVerdict` reads it back as `ok` / `none` /
`unknown`. Three values, not a boolean, so an unclassified row stays distinguishable from a barren
one — which is why the new audit column has no default and pre-#121 rows read blank.

## The verdict is taken pre-threshold, and that is the design

`applyThreshold` replaces an oversized result with an excerpt envelope carrying no `reads` map,
*before* `logResult` runs, and the audit digest then eats head+tail past 4,000 chars. A verdict
read back off `output` would score `unknown` for exactly the large results most likely to be
productive. `test/PaToolRegistry.test.js` asserts that ordering directly.

## The gate change ships OFF

`REQUIRE_RETRIEVAL_TO_RELEASE: false`, on §U9's precedent — no verdict is not the same as proven.
At the shipped default, gate behaviour is unchanged in every particular and a test asserts it. The
audit column is written regardless of the flag, so how often the strict rule *would* have changed a
release becomes measurable for free, from runs that were happening anyway.

## Verification

- `npx jest` — 26 suites green
- `now-sdk build` — passes
- `git diff main -- benchmark/DECISION.md | grep -c '^-'` — 0, confirming §U1–§U9 unmodified

**Not deployed.** The table change needs a `now-sdk install`, which is outside this PR's scope.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

---

## Self-Review

**Spec coverage.** §1 predicate → Task 1. §2 verdict contract and the two accepted limits → Task 1 (code + docblock) and Task 7 (§V3). §3.1 pre-threshold ordering → Tasks 4 and 5, with the ordering asserted as a test in Task 4. §3.2 column → Task 2. §3.3 write path → Tasks 2, 4, 5. §3.4 read path → Task 3. §4.1 flag → Task 6. §4.2 both consumers → Task 6. §4.3 the two decided residues → Task 6's Context block, marked "do not fix". §5 metric → Task 7. §6 testing → distributed across every task. §7 file list → the File Structure table. No gaps.

**Type consistency.** `retrievalVerdict(result) -> String` is defined in Task 1 and called under that exact name in Tasks 4 and 5. `retrievingTools` is the audit-logger field name throughout (Tasks 3, 6); `retrieving` is the `_trailTools` field name throughout (Task 6) — the two differ deliberately, matching the existing `tools`/`tools` vs `invokedTools` naming split, and Task 6's implementation maps one to the other in exactly one place. `_releaseSet(trail)` is defined and consumed only within Task 6. `RETRIEVAL_VALUES` and `_retrievalValue` are Task 2 only. `_retrievalVerdict` is the private wrapper in Tasks 4 and 5; `retrievalVerdict` is the public kit method — the leading underscore distinguishes them, matching the kit's own stated naming rule.

**Placeholder scan.** No TBDs, no "add error handling", no "similar to Task N". Every code step carries the actual code. The one instruction that defers to reading a file — Task 5's note that `auditSpy`/`resultCall` may already exist in `PaScriptToolAdapter.test.js` — supplies the fallback verbatim by reference to Task 4's block, which is fully written out.

**Known breakage, planned for.** Task 6 Step 3 fixes the seven `_trailTools` `toEqual` assertions that gain a `retrieving` key. They are listed by test name so the implementer does not have to find them.
