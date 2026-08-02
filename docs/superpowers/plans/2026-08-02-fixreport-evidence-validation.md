# Fix Report Evidence Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `PaFixReport.validate` check whether a cited evidence source was actually read, and stop it rejecting a correct diagnosis of an absence.

**Architecture:** `PaAuditLogger` gains the codebase's only reader of `x_snc_troubleshoot_audit`, returning the deduplicated set of tools a run actually invoked. `PaAgentLoop` resolves that once per fix-report handling and passes it into `PaFixReport.validate(report, context)` as an optional second argument, so the validator stays a pure function of its inputs. Inside `validate`, three rule changes: an absence-diagnosis path that widens the evidence rule (#78), and two cross-checks that falsify citations and sweep claims against the audit trail (#79).

**Tech Stack:** ES5 / Rhino-safe JavaScript in ServiceNow Script Includes (`src/server/*.js`, pulled into Fluent via `Now.include`), Jest 29 for unit tests, `now-sdk` 4.9.2 for build and install.

**Spec:** `docs/superpowers/specs/2026-08-02-fixreport-evidence-validation-design.md`
**Issues:** #78, #79
**Branch:** `fix/fixreport-evidence-validation` (already created)

## Global Constraints

- **ES5 / Rhino only** in `src/server/*.js` — no `let`/`const`/arrow functions/`Set`/`Map`/template literals/`Array.prototype.includes`. Match the surrounding code exactly.
- **R-1: never inspect the exception object in a `catch`** — reading `.message` off a `ScopeAccessNotGrantedException` throws again and escapes the handler. Catch blocks return a named degradation.
- **R-9: every input may be absent, and arrives as a string when it is not.**
- **R-10: degrade explicitly with a named reason.**
- **Build Rule #42:** plain `GlideRecord`, not `GlideRecordSecure`, against `x_snc_troubleshoot_audit` — a Fluent `Table()` installs with zero ACLs and the secure variant would deny this app read access to its own audit table.
- **Never commit to `main`.** All work on `fix/fixreport-evidence-validation`; merge via PR.
- **Version numbering:** on merge, bump `package.json` and the `README.md` badge to `2026.08.0220` (format `YYYY.MM.DDXX`).
- **`validate(report)` with one argument must keep working** — the second parameter is optional throughout.
- **Nothing that passes validation today may newly fail** except where it makes an audit-falsified claim. `test/PaFixReport.test.js` passing **entirely untouched** is the check on this — the new checks are inert without a context argument that no existing test passes. (`test/PaAgentLoop.test.js` is the one exception: the degradation transcript note is new intended behaviour. See Task 6 Step 1b for the sanctioned fix, which is to inject the new fake, never to weaken the note.)
- **Problem-text anchors:** `unsupported citation` (#79a) and `unsupported sweep claim` (#79b), mirroring the existing `evidence rule` convention. Tests assert these literals.

---

### Task 1: `PaAuditLogger.invokedTools` — the read side of the trail

Nothing in the codebase reads `x_snc_troubleshoot_audit` today; it is write-only from code, though `src/fluent/acls.now.ts:98` already permits read. This method is the only reader.

**Files:**
- Modify: `src/server/PaAuditLogger.js` (add after `logError`, around `:108`)
- Test: `test/PaAuditLogger.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `invokedTools(runId)` → `{available: true, tools: [String]}` | `{available: false, degraded: String, tools: []}`. Task 6 calls it. `tools` is always an array, even on the degraded branch, so callers never need a null check.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaAuditLogger.test.js`. The file's existing `load()` helper and `RUN` constant are already defined at the top — reuse them, do not redefine.

```javascript
// =========================================================================
// invokedTools — the read side (#79)
// =========================================================================

/** Audit rows as the writable-world stub stores them. */
function auditRow(run, tool, actionType) {
    return { sys_id: 'a' + tool + actionType, run: run, tool_name: tool, action_type: actionType }
}

describe('invokedTools', () => {
    test('returns the deduplicated tool names for the run', () => {
        const { logger } = load({
            world: {
                rows: {
                    [AUDIT_TABLE]: [
                        auditRow(RUN, 'agent_trace', 'intent'),
                        auditRow(RUN, 'agent_trace', 'result'),
                        auditRow(RUN, 'agent_config', 'intent'),
                    ],
                },
            },
        })

        const res = logger.invokedTools(RUN)

        expect(res.available).toBe(true)
        expect(res.tools.sort()).toEqual(['agent_config', 'agent_trace'])
    })

    test('counts intent, result and error rows alike — a tool that failed was still invoked', () => {
        const { logger } = load({
            world: { rows: { [AUDIT_TABLE]: [auditRow(RUN, 'query_table', 'error')] } },
        })

        expect(logger.invokedTools(RUN).tools).toEqual(['query_table'])
    })

    test('ignores rows belonging to another run', () => {
        const { logger } = load({
            world: {
                rows: {
                    [AUDIT_TABLE]: [
                        auditRow(RUN, 'agent_trace', 'intent'),
                        auditRow('otherrun0000000000000000000000', 'schema_lookup', 'intent'),
                    ],
                },
            },
        })

        expect(logger.invokedTools(RUN).tools).toEqual(['agent_trace'])
    })

    test('zero rows is UNAVAILABLE, not an empty success — a run that reached a fix report called something', () => {
        const { logger } = load({ world: { rows: { [AUDIT_TABLE]: [] } } })

        const res = logger.invokedTools(RUN)

        expect(res.available).toBe(false)
        expect(res.degraded).toBe('no_audit_rows')
        expect(res.tools).toEqual([])
    })

    test('absent runId degrades rather than returning every row in the table', () => {
        const { logger } = load({
            world: { rows: { [AUDIT_TABLE]: [auditRow(RUN, 'agent_trace', 'intent')] } },
        })

        const res = logger.invokedTools(undefined)

        expect(res.available).toBe(false)
        expect(res.degraded).toBe('no_run_id')
    })

    test('a throwing query degrades without touching the exception object (R-1)', () => {
        const { logger } = load({ world: { throwOnQuery: hostileException() } })

        const res = logger.invokedTools(RUN)

        expect(res.available).toBe(false)
        expect(res.degraded).toBe('query_failed')
        expect(res.tools).toEqual([])
    })

    test('no GlideRecord at all degrades rather than throwing', () => {
        const { logger } = load({ noGlide: true })

        expect(logger.invokedTools(RUN).degraded).toBe('glide_unavailable')
    })

    test('blank tool_name values are skipped, not recorded as empty names', () => {
        const { logger } = load({
            world: {
                rows: {
                    [AUDIT_TABLE]: [
                        { sys_id: 'a1', run: RUN, tool_name: '', action_type: 'intent' },
                        auditRow(RUN, 'agent_trace', 'intent'),
                    ],
                },
            },
        })

        expect(logger.invokedTools(RUN).tools).toEqual(['agent_trace'])
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaAuditLogger.test.js -t invokedTools`
Expected: FAIL — `logger.invokedTools is not a function`.

- [ ] **Step 3: Implement `invokedTools`**

In `src/server/PaAuditLogger.js`, insert directly after `logError` (`:108`), before the `// Internals` banner:

```javascript
    // =======================================================================
    // The read side
    // =======================================================================

    /**
     * The ONLY reader of this table in the codebase. #79: a Fix Report
     * citation names a source; this answers which tools the run actually
     * invoked, so PaFixReport can tell a real citation from an invented one.
     *
     * EVERY action_type counts — intent, result and error alike. The intent
     * row is written BEFORE the tool runs (see the header), so a tool that
     * hung or threw still means the model looked. This answers exactly one
     * question — was this tool ever invoked in this run — which is the
     * question fabrication fails. Whether what the tool returned supports the
     * claim is the model's problem, not this method's.
     *
     * A TAGGED result, not a bare array: "no tools were called" and "the
     * trail is unreadable" must not be the same value. A run that reached a
     * fix report necessarily called at least one tool, so zero rows means the
     * trail failed — and a failed trail must not convict an honest report.
     * Every degraded branch still carries `tools: []` so callers never need a
     * null check.
     *
     * Build Rule #42: plain GlideRecord — the table has no ACLs, so
     * GlideRecordSecure would deny this app read access to its own trail.
     *
     * @param {*} runId sys_id of the run row; may be absent or non-string (R-9)
     * @returns {Object} {available:true, tools:[String]}
     *                 | {available:false, degraded:String, tools:[]}
     */
    invokedTools: function (runId) {
        try {
            var id = this._trim(this._norm(runId), this.MAX_RECORD_ID_CHARS)
            // Without a run filter the query would return the whole table —
            // every other run's tools, read as this run's evidence.
            if (!id) return this._noTools('no_run_id')
            if (typeof GlideRecord === 'undefined') return this._noTools('glide_unavailable')

            var gr = new GlideRecord(this.AUDIT_TABLE)
            gr.addQuery('run', id)
            gr.query()

            var tools = []
            while (gr.next()) {
                var name = this._normToolName(gr.getValue('tool_name'))
                if (name && this._indexOfTool(tools, name) === -1) tools.push(name)
            }

            if (tools.length === 0) return this._noTools('no_audit_rows')
            return { available: true, tools: tools }
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            return this._noTools('query_failed')
        }
    },

    _noTools: function (reason) {
        return { available: false, degraded: reason, tools: [] }
    },

    /**
     * Normalized the way PaToolRegistry._normName normalizes — the registry
     * and this trail already share one tool vocabulary by construction
     * (PaToolRegistry.js:25), and #79 is the first thing that would break if
     * they ever drift, which is a feature.
     */
    _normToolName: function (value) {
        return String(value === null || value === undefined ? '' : value).replace(/^\s+|\s+$/g, '')
    },

    /** ES5: no Array.prototype.indexOf assumptions on Rhino. */
    _indexOfTool: function (list, value) {
        for (var i = 0; i < list.length; i++) {
            if (list[i] === value) return i
        }
        return -1
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaAuditLogger.test.js`
Expected: PASS — the new `invokedTools` block and every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/server/PaAuditLogger.js test/PaAuditLogger.test.js
git commit -m "feat: add PaAuditLogger.invokedTools, the read side of the audit trail (#79)

The only reader of x_snc_troubleshoot_audit in the codebase. Returns a
tagged result rather than a bare array so that 'no tools were called' and
'the trail is unreadable' stay distinguishable — a run that reached a fix
report necessarily called something, so zero rows means the trail failed,
and a failed trail must not convict an honest report.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `PaFixReport` check context + the #78 absence-diagnosis path

The evidence rule currently sees only one `evidence` array. #78 needs it to know what `layers_swept` says, and Tasks 3–4 need it to know what the run invoked. Both arrive via one internal context object resolved once per `validate` call, so this task establishes the plumbing the next two ride on.

**Files:**
- Modify: `src/server/PaFixReport.js` — `validate` (`:112`), `_checkEvidenceEntries` (`:252`), `_checkEvidenceRule` (`:284`), `_checkRootCauses` (`:196`), `_checkRootCause` (`:213`), `_checkInconclusive` (`:367`)
- Test: `test/PaFixReport.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 yet (the context is a plain object; Task 6 wires the real source).
- Produces:
  - `validate(report, context)` where `context` is optional and shaped `{invokedTools: [String], auditAvailable: Boolean}`.
  - `_buildCheckContext(report, context)` → `{traceUnavailable: Boolean, auditEnabled: Boolean, invokedTools: [String]}` — the internal object every check receives as its last argument. Tasks 3 and 4 add fields to no part of it; they only read `auditEnabled` and `invokedTools`.
  - `_checkEvidenceEntries` returns a tally `{hasTrace, hasOther, distinctOther}`. `distinctOther` is new.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaFixReport.test.js`. Reuse the file's existing `load()`, `sweptLayers()` and `validReport()` helpers.

```javascript
// =========================================================================
// #78 — the absence-diagnosis path
// =========================================================================

/**
 * A report diagnosing a defect where the agent NEVER RAN: layer 1 is
 * UNAVAILABLE because no sn_aia_execution_plan row exists to read. This is
 * seed 05's shape.
 */
function absenceReport(evidence) {
    const layers = sweptLayers()
    layers[1] = { status: 'UNAVAILABLE', reason: 'no sn_aia_execution_plan row exists — the agent never ran' }
    return validReport({
        layers_swept: layers,
        root_causes: [
            {
                layer: 'layer 7',
                component: 'sn_aia_trigger_configuration bfb77d6c64884500a80203ee029436ee',
                finding: 'active=false, so the trigger never fires and no execution is ever created.',
                evidence: evidence,
            },
        ],
    })
}

describe('#78 absence-diagnosis', () => {
    test('layer 1 UNAVAILABLE + two DISTINCT non-trace sources → valid', () => {
        const reports = load()
        const report = absenceReport([
            { source: 'config', detail: 'sn_aia_trigger_configuration.active = false, sys_id bfb77d6c...' },
            { source: 'schema', detail: 'sn_aia_trigger_configuration.active is a boolean, default true' },
        ])

        expect(reports.validate(report).valid).toBe(true)
    })

    test('layer 1 UNAVAILABLE + two citations of the SAME source → invalid; the relaxation is not a giveaway', () => {
        const reports = load()
        const report = absenceReport([
            { source: 'config', detail: 'sn_aia_trigger_configuration.active = false' },
            { source: 'config', detail: 'sn_aia_usecase.execution_mode = copilot' },
        ])

        const result = reports.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('evidence rule') !== -1)).toBe(true)
    })

    test('layer 1 SWEPT + config only → still invalid; mode B is not triggered', () => {
        const reports = load()
        const report = validReport({
            root_causes: [
                {
                    layer: 'layer 7',
                    component: 'sn_aia_trigger_configuration',
                    finding: 'active=false',
                    evidence: [
                        { source: 'config', detail: 'active = false' },
                        { source: 'schema', detail: 'active is boolean' },
                    ],
                },
            ],
        })

        const result = reports.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('evidence rule') !== -1)).toBe(true)
    })

    test('MONOTONICITY: trace + config still passes via mode A even when layer 1 is UNAVAILABLE', () => {
        const reports = load()
        const report = absenceReport([
            { source: 'trace', detail: 'sn_aia_execution_plan: no rows in 24h' },
            { source: 'config', detail: 'sn_aia_trigger_configuration.active = false' },
        ])

        expect(reports.validate(report).valid).toBe(true)
    })

    test('the no-trace problem tells the model how to report an absence', () => {
        const reports = load()
        const report = validReport({
            root_causes: [
                {
                    layer: 'layer 7',
                    component: 'sn_aia_trigger_configuration',
                    finding: 'active=false',
                    evidence: [{ source: 'config', detail: 'active = false' }],
                },
            ],
        })

        const result = reports.validate(report)

        expect(result.problems.some((p) => p.indexOf('UNAVAILABLE') !== -1)).toBe(true)
    })

    test('validate(report) with ONE argument is unchanged', () => {
        const reports = load()

        expect(reports.validate(validReport()).valid).toBe(true)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaFixReport.test.js -t "#78"`
Expected: FAIL — the first test reports an `evidence rule` violation because mode B does not exist yet.

- [ ] **Step 3: Implement the context and the widened rule**

3a. Replace `validate` (`src/server/PaFixReport.js:112-132`):

```javascript
    /**
     * @param {*} report candidate Fix Report — may be anything, including
     *        null/undefined (R-9).
     * @param {Object} [context] {invokedTools:[String], auditAvailable:Boolean}
     *        — what the RUN actually did, resolved by the caller and passed
     *        in so this stays a pure function of its inputs (issue #79's own
     *        design note). Absent or malformed disables the audit-backed
     *        checks; see `_buildCheckContext`.
     * @returns {Object} {valid:true, normalized} | {valid:false, problems:[String]}
     *          `normalized` is a deep copy of `report` with every key —
     *          required and unknown alike — carried through untouched.
     */
    validate: function (report, context) {
        if (!this._isPlainObject(report)) {
            return { valid: false, problems: ['fix report must be a JSON object'] }
        }

        var ctx = this._buildCheckContext(report, context)

        var problems = []
        this._checkFailureSummary(report, problems)
        this._checkLayersSwept(report, problems)
        this._checkSweptClaims(report, problems, ctx)
        this._checkRootCauses(report, problems, ctx)
        this._checkFixes(report, problems)
        this._checkVerification(report, problems)
        this._checkDataMarkers(report, problems)

        if (problems.length > 0) {
            return { valid: false, problems: problems }
        }

        var normalized = this._clone(report)
        this._normalizeRootCauseLayers(normalized)
        return { valid: true, normalized: normalized }
    },

    /**
     * Everything the checks need that is not in the report itself, resolved
     * ONCE per validate() call.
     *
     * `auditEnabled` demands an EXPLICIT `true` plus an array of tools. A
     * missing, malformed or degraded context fails toward NOT checking,
     * because a broken audit trail convicting an honest report is a strictly
     * worse outcome than an unverified citation — that is #78's defect, and
     * reintroducing it through the back door would be worse than leaving #79
     * unfixed.
     */
    _buildCheckContext: function (report, context) {
        var c = this._isPlainObject(context) ? context : {}
        var raw = this._isArray(c.invokedTools) ? c.invokedTools : []
        var names = []
        for (var i = 0; i < raw.length; i++) {
            var name = this._normToolName(raw[i])
            if (name && this._indexOf(names, name) === -1) names.push(name)
        }

        return {
            traceUnavailable: this._isTraceUnavailable(report),
            auditEnabled: c.auditAvailable === true && this._isArray(c.invokedTools),
            invokedTools: names,
        }
    },

    /**
     * #78's trigger. The report has declared on the record — with a `reason`
     * that `_checkLayersSwept` already makes mandatory for any non-SWEPT
     * layer — that no execution trace exists to cite. Seed 05 is exactly this
     * case: nothing fired, so there is no sn_aia_execution_plan row, and the
     * old rule made a correct diagnosis structurally unreportable.
     */
    _isTraceUnavailable: function (report) {
        var ls = this._isPlainObject(report.layers_swept) ? report.layers_swept : {}
        var entry = ls[1]
        return this._isPlainObject(entry) && entry.status === 'UNAVAILABLE'
    },

    /** Matches PaToolRegistry._normName / PaAuditLogger._normToolName. */
    _normToolName: function (value) {
        return String(value === null || value === undefined ? '' : value).replace(/^\s+|\s+$/g, '')
    },
```

3b. Thread `ctx` through the root-cause path. Replace `_checkRootCauses` (`:196`) and `_checkRootCause` (`:213`) signatures and their internal calls:

```javascript
    _checkRootCauses: function (report, problems, ctx) {
        var rcs = report.root_causes
        if (!this._isArray(rcs)) {
            problems.push('root_causes is required and must be an array')
            return
        }
        if (rcs.length === 0) {
            // T4 — the earned-inconclusive path. See `_checkInconclusive`.
            this._checkInconclusive(report, problems, ctx)
            return
        }

        for (var i = 0; i < rcs.length; i++) {
            this._checkRootCause(rcs[i], i, problems, ctx)
        }
    },

    _checkRootCause: function (rc, index, problems, ctx) {
        var label = 'root_causes[' + index + ']'
        if (!this._isPlainObject(rc)) {
            problems.push(label + ' must be an object')
            return
        }

        if (!this._hasLayerValue(rc.layer)) problems.push(label + ' is missing layer')
        if (!this._nonEmptyString(rc.component)) problems.push(label + ' is missing component')
        if (!this._nonEmptyString(rc.finding)) problems.push(label + ' is missing finding')

        // Prefer the component name in problem text once it exists — it is a
        // more useful pointer back into the report than a bare array index.
        var causeName = this._nonEmptyString(rc.component) ? rc.component : label

        if (!this._isArray(rc.evidence) || rc.evidence.length === 0) {
            problems.push(label + ' (' + causeName + ') is missing evidence')
            return
        }

        this._checkEvidenceRule(rc.evidence, label, causeName, problems, ctx)
    },
```

3c. Add `distinctOther` to the tally. In `_checkEvidenceEntries` (`:252`), change the signature to accept `ctx`, replace the tally initialization and the source branch, and return the count:

```javascript
    _checkEvidenceEntries: function (evidence, label, problems, ctx) {
        var sources = this._evidenceSources()
        var tally = { hasTrace: false, hasOther: false, distinctOther: 0 }
        var otherSources = []

        for (var i = 0; i < evidence.length; i++) {
            var entry = evidence[i]
            var entryLabel = label + '[' + i + ']'

            if (!this._isPlainObject(entry) || this._indexOf(sources, entry.source) === -1) {
                problems.push(
                    entryLabel + ' has an invalid or missing source (must be one of: ' + sources.join(', ') + ')'
                )
                continue
            }
            if (!this._nonEmptyString(entry.detail)) {
                problems.push(entryLabel + ' is missing a detail citation (table, sys_id, field, or value)')
            }

            if (entry.source === 'trace') {
                tally.hasTrace = true
            } else {
                tally.hasOther = true
                // DISTINCT, not a count of entries: #78 relaxes the trace
                // requirement in exchange for two INDEPENDENT sources, and two
                // config citations are one source cited twice.
                if (this._indexOf(otherSources, entry.source) === -1) otherSources.push(entry.source)
            }
        }

        tally.distinctOther = otherSources.length
        return tally
    },
```

3d. Replace `_checkEvidenceRule` (`:284`) entirely:

```javascript
    /**
     * The evidence rule, enforced structurally. Two ways to satisfy it:
     *
     *   (A) at least one 'trace' citation PLUS at least one config/schema/
     *       data citation — the original rule, untouched;
     *   (B) layer 1 UNAVAILABLE plus at least TWO DISTINCT non-trace sources
     *       — the absence-diagnosis path (#78).
     *
     * B is an ADDITIONAL route, never a replacement: A returns first, so
     * nothing that passes today can newly fail here. The rule's real content
     * is "one layer is a candidate, not a conclusion" — two independent
     * sources. B preserves that and relaxes only the PRIVILEGED STATUS of the
     * trace label, and only where the report has already declared no trace
     * exists. Seed 05 is why: the agent never ran, so there is no
     * sn_aia_execution_plan row, and a correct diagnosis of that absence was
     * structurally unreportable (issue #78 — the harness's one correct
     * diagnosis in the 2026-08-02 re-run was rejected by this method).
     *
     * A 'trace' citation under B is not rejected; it simply does not count
     * toward the two distinct sources.
     *
     * Every problem raised here contains the literal phrase "evidence rule"
     * (Task 4 brief, Step 1) and names the cause, so a repair prompt — or a
     * human — can find it without re-deriving which entry failed.
     */
    _checkEvidenceRule: function (evidence, label, causeName, problems, ctx) {
        var tally = this._checkEvidenceEntries(evidence, label + '.evidence', problems, ctx)

        // (A) — the original rule. Checked first so B can only ever widen.
        if (tally.hasTrace && tally.hasOther) return

        // (B) — the absence-diagnosis path.
        if (ctx.traceUnavailable) {
            if (tally.distinctOther >= 2) return
            problems.push(
                label + ' (' + causeName + '): evidence rule violation — layer 1 is UNAVAILABLE, so no ' +
                    'trace citation is required, but a diagnosis of an absence still needs corroboration. ' +
                    'Cite at least TWO DISTINCT sources from ' + this._nonTraceEvidenceSources().join('/') +
                    ' — found ' + tally.distinctOther + '. Two citations of the same source are one source.'
            )
            return
        }

        if (!tally.hasTrace) {
            problems.push(
                label + ' (' + causeName + '): evidence rule violation — no trace citation found; ' +
                    'a candidate resting on config/schema/data alone is not a confirmed root cause. If no ' +
                    'execution trace EXISTS for this target — nothing ever ran — mark layer 1 UNAVAILABLE ' +
                    'with a reason and cite two DISTINCT config/schema/data sources instead.'
            )
            return
        }

        problems.push(
            label + ' (' + causeName + '): evidence rule violation — evidence cites only the trace; ' +
                'at least one config, schema, or data citation is required'
        )
    },
```

3e. `_checkInconclusive` (`:367`) takes and forwards `ctx`. Change its signature to `_checkInconclusive: function (report, problems, ctx)` and its one internal call to `this._checkEvidenceEntries(ev, 'inconclusive.evidence_read', problems, ctx)`. Nothing else in that method changes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaFixReport.test.js`
Expected: PASS — the new `#78` block **and every pre-existing test in the file unchanged**. If a pre-existing test fails, that is a design violation (the rule is specified as a widening), not a test to update — stop and report it.

- [ ] **Step 5: Commit**

```bash
git add src/server/PaFixReport.js test/PaFixReport.test.js
git commit -m "fix: accept a correct absence-diagnosis in the evidence rule (#78)

Seed 05 is a defect where the agent never ran, so no sn_aia_execution_plan
row exists and no trace can be cited. The evidence rule had no exemption,
so a correct diagnosis of an absence was structurally unreportable — and
the 2026-08-02 re-run's one correct, honestly-cited diagnosis was rejected
by it (benchmark/DECISION.md H6).

Adds a SECOND way to satisfy the rule — layer 1 UNAVAILABLE plus two
DISTINCT non-trace sources — checked only after the original rule has
already returned, so nothing that passes today can newly fail. The 'two
independent sources' property is preserved; only the privileged status of
the trace label is relaxed, and only where the report has declared, with a
mandatory reason, that no trace exists.

Also introduces the internal check context that #79's cross-checks ride on.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: #79a — cross-check citations against the audit trail

**Files:**
- Modify: `src/server/PaFixReport.js` — `_checkEvidenceEntries` (from Task 2), plus three new methods
- Test: `test/PaFixReport.test.js`

**Interfaces:**
- Consumes: `ctx.auditEnabled` and `ctx.invokedTools` from Task 2's `_buildCheckContext`.
- Produces: `_citationToolMap()` → object keyed by evidence source, values arrays of tool names. `_anyInvoked(candidates, ctx)` → Boolean, reused by Task 4.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaFixReport.test.js`:

```javascript
// =========================================================================
// #79a — citations cross-checked against what the run actually invoked
// =========================================================================

/** The context PaAgentLoop passes in. */
function auditCtx(tools) {
    return { auditAvailable: true, invokedTools: tools }
}

/** Every tool invoked — the shape that lets validReport() pass unchanged. */
function allToolsCtx() {
    return auditCtx([
        'agent_trace',
        'agent_config',
        'schema_lookup',
        'query_table',
        'genai_log',
        'log_analysis',
        'read_artifact',
    ])
}

describe('#79a citation cross-check', () => {
    test('a citation naming a source no invoked tool reads → invalid, and names the source', () => {
        const reports = load()
        // The exact live shape: run 100c8910... cited agent_config having
        // only ever invoked agent_trace.
        const report = validReport({
            root_causes: [
                {
                    layer: 'layer 7',
                    component: 'sn_aia_trigger_configuration',
                    finding: 'active=false',
                    evidence: [
                        { source: 'trace', detail: 'sn_aia_execution_plan: no rows' },
                        { source: 'config', detail: 'sn_aia_trigger_configuration.active = false' },
                    ],
                },
            ],
        })

        const result = reports.validate(report, auditCtx(['agent_trace']))

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('unsupported citation') !== -1)).toBe(true)
        expect(result.problems.some((p) => p.indexOf('config') !== -1)).toBe(true)
    })

    test('a citation supported through an ALTERNATE tool passes — the map is permissive', () => {
        const reports = load()
        const layers = sweptLayers()
        // Only the layers genai_log and agent_trace can answer.
        layers[2] = { status: 'NOT_SWEPT', reason: 'not reached' }
        layers[3] = { status: 'NOT_SWEPT', reason: 'not reached' }
        layers[4] = { status: 'NOT_SWEPT', reason: 'not reached' }
        layers[5] = { status: 'NOT_SWEPT', reason: 'not reached' }
        layers[7] = { status: 'NOT_SWEPT', reason: 'not reached' }
        const report = validReport({
            layers_swept: layers,
            root_causes: [
                {
                    layer: 'layer 6',
                    component: 'sys_generative_ai_capability api field',
                    finding: 'api points at a definition that does not exist.',
                    evidence: [
                        { source: 'trace', detail: 'OneExtendUtil.execute status:error' },
                        { source: 'config', detail: 'capability.api = 7c9f... which resolves to nothing' },
                    ],
                },
            ],
        })

        // genai_log alone supports BOTH trace and config.
        const result = reports.validate(report, auditCtx(['genai_log']))

        expect(result.valid).toBe(true)
    })

    test('inconclusive.evidence_read is cross-checked identically', () => {
        const reports = load()
        const layers = sweptLayers()
        Object.keys(layers).forEach((k) => {
            layers[k] = { status: 'NOT_SWEPT', reason: 'no tool reached this layer' }
        })
        const report = validReport({
            layers_swept: layers,
            root_causes: [],
            fixes: [],
            verification: undefined,
            inconclusive: {
                evidence_read: [{ source: 'schema', detail: 'sys_dictionary for x_snc_troubleshoot_run' }],
                needed_to_conclude: 'A schema read of the target table.',
            },
        })

        const result = reports.validate(report, auditCtx(['agent_trace']))

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('unsupported citation') !== -1)).toBe(true)
    })

    test('auditAvailable:false skips the cross-check entirely — a degraded trail convicts nobody', () => {
        const reports = load()
        const report = validReport()

        const result = reports.validate(report, { auditAvailable: false, invokedTools: [] })

        expect(result.valid).toBe(true)
    })

    test('a malformed context skips the cross-check rather than failing closed', () => {
        const reports = load()

        expect(reports.validate(validReport(), { auditAvailable: 'yes' }).valid).toBe(true)
        expect(reports.validate(validReport(), null).valid).toBe(true)
    })

    test('a fully supported report passes with the audit check active', () => {
        const reports = load()

        expect(reports.validate(validReport(), allToolsCtx()).valid).toBe(true)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaFixReport.test.js -t "#79a"`
Expected: FAIL — the first test returns `valid: true` because no cross-check exists.

- [ ] **Step 3: Implement the cross-check**

3a. In `_checkEvidenceEntries`, add the call immediately after the `detail` check, inside the loop:

```javascript
            if (!this._nonEmptyString(entry.detail)) {
                problems.push(entryLabel + ' is missing a detail citation (table, sys_id, field, or value)')
            }

            // #79a — the citation is checked against what the run ACTUALLY
            // invoked, not against the label the model chose for it.
            this._checkCitationSupported(entry.source, entryLabel, problems, ctx)
```

3b. Add these three methods directly after `_checkEvidenceEntries`:

```javascript
    /**
     * #79a. Validation used to be uncorrelated with evidential honesty: a
     * report that invented a citation passed, and one citing only what it
     * genuinely read could fail. Live proof (2026-08-02 re-run, audit-
     * verified): runs 100c8910... and ebdc4194... both cited `agent_config`
     * as evidence and both PASSED, having never invoked that tool.
     *
     * A citation passes if ANY tool that can produce that kind of evidence
     * appears in the run's audit trail. The map is deliberately PERMISSIVE —
     * the goal is to stop fabrication, not to add new pedantry, which is the
     * exact failure mode #78 exists to fix. `genai_log` supports `config`
     * because seed 03's answer (a dangling `api`) is found through it and is
     * legitimately configuration evidence; a strict 1:1 map would reject that
     * honest citation.
     *
     * Skipped entirely when the audit trail is unavailable — see
     * `_buildCheckContext`.
     */
    _checkCitationSupported: function (source, entryLabel, problems, ctx) {
        if (!ctx.auditEnabled) return

        var supporting = this._citationToolMap()[source]
        // An unknown source already raised its own problem above.
        if (!supporting) return
        if (this._anyInvoked(supporting, ctx)) return

        problems.push(
            entryLabel + ': unsupported citation — cites "' + source + '" but this run never invoked a ' +
                'tool that reads it (' + supporting.join(', ') + '). Either call one of those tools and ' +
                'cite what it actually returned, or drop the claim. Tools invoked this run: ' +
                this._invokedList(ctx) + '.'
        )
    },

    /**
     * #79a source -> tool map. Deliberately separate from `_layerToolMap`:
     * layers are finer-grained than the four evidence sources (2, 3 and 7 all
     * correspond to `config` but each is answered by a different section of
     * agent_config's output). `read_artifact` supports every source because it
     * pages an artifact produced by an earlier tool in the same run — and that
     * earlier call is itself audited.
     */
    _citationToolMap: function () {
        return {
            trace: ['agent_trace', 'genai_log', 'log_analysis', 'read_artifact'],
            config: ['agent_config', 'genai_log', 'read_artifact'],
            schema: ['schema_lookup', 'read_artifact'],
            data: ['query_table', 'log_analysis', 'read_artifact'],
        }
    },

    _anyInvoked: function (candidates, ctx) {
        for (var i = 0; i < candidates.length; i++) {
            if (this._indexOf(ctx.invokedTools, candidates[i]) !== -1) return true
        }
        return false
    },

    _invokedList: function (ctx) {
        return ctx.invokedTools.length > 0 ? ctx.invokedTools.join(', ') : 'none'
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaFixReport.test.js`
Expected: PASS — new `#79a` block plus everything before it.

- [ ] **Step 5: Commit**

```bash
git add src/server/PaFixReport.js test/PaFixReport.test.js
git commit -m "fix: cross-check evidence citations against the run's audit trail (#79)

Validation checked that evidence LABELS were legal and diverse, never
whether the labelled source was read — so it was uncorrelated with
evidential honesty. Audit-verified from the 2026-08-02 re-run: runs
100c8910... and ebdc4194... both cited agent_config and both PASSED, having
never invoked it, while a run citing only what it genuinely read FAILED.

The source->tool map is permissive on purpose: genai_log supports config
because seed 03's dangling api is found there, and rejecting that honest
citation would be #78's defect in a new costume. Applies to
inconclusive.evidence_read too — the most directly falsifiable claim in the
schema, since it literally asserts 'I read this'.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: #79b — cross-check `layers_swept` SWEPT claims

**Files:**
- Modify: `src/server/PaFixReport.js` — add `_checkSweptClaims` and `_layerToolMap`, **and add the call site in `validate`**
- Test: `test/PaFixReport.test.js`

**Interfaces:**
- Consumes: `_anyInvoked(candidates, ctx)` and `_invokedList(ctx)` from Task 3; `_layerDefs()` (existing, `:71`).
- Produces: `_checkSweptClaims(report, problems, ctx)`, called from `validate`.

> **Plan correction (made after Task 2's review).** Task 2's Step 3a code block listed
> `this._checkSweptClaims(report, problems, ctx)` inside `validate`, but that method does not exist
> until this task — including it in Task 2 would have thrown `TypeError` on every `validate` call and
> failed the entire suite. Task 2 correctly omitted it. **This task therefore owns the call site.**
> Add it to `validate` between `_checkLayersSwept` and `_checkRootCauses`:
>
> ```javascript
>         this._checkLayersSwept(report, problems)
>         this._checkSweptClaims(report, problems, ctx)
>         this._checkRootCauses(report, problems, ctx)
> ```
>
> Without this line the new methods are dead code and this task's tests will fail.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaFixReport.test.js`:

```javascript
// =========================================================================
// #79b — SWEPT claims cross-checked against what the run actually invoked
// =========================================================================

describe('#79b sweep-claim cross-check', () => {
    test('layers marked SWEPT with no supporting tool → invalid', () => {
        const reports = load()

        // The re-run's worst draft: all seven layers SWEPT on two tool calls,
        // both reads of the same trace.
        const result = reports.validate(validReport(), auditCtx(['agent_trace', 'read_artifact']))

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('unsupported sweep claim') !== -1)).toBe(true)
    })

    test('ONE collapsed problem, not one per layer', () => {
        const reports = load()

        const result = reports.validate(validReport(), auditCtx(['agent_trace']))
        const sweepProblems = result.problems.filter((p) => p.indexOf('unsupported sweep claim') !== -1)

        expect(sweepProblems.length).toBe(1)
    })

    test('the collapsed problem names every offending layer', () => {
        const reports = load()

        const result = reports.validate(validReport(), auditCtx(['agent_trace']))
        const problem = result.problems.filter((p) => p.indexOf('unsupported sweep claim') !== -1)[0]

        // agent_trace answers layer 1 only; 2-7 are all unsupported.
        expect(problem.indexOf('2 (Instructions)')).not.toBe(-1)
        expect(problem.indexOf('4 (Data schemas)')).not.toBe(-1)
        expect(problem.indexOf('7 (Trigger and wiring)')).not.toBe(-1)
        expect(problem.indexOf('1 (Execution trace)')).toBe(-1)
    })

    test('NOT_SWEPT and UNAVAILABLE are never cross-checked', () => {
        const reports = load()
        const layers = sweptLayers()
        layers[2] = { status: 'NOT_SWEPT', reason: 'budget exhausted before instructions' }
        layers[4] = { status: 'UNAVAILABLE', reason: 'schema read denied cross-scope' }
        layers[5] = { status: 'NOT_SWEPT', reason: 'no data question arose' }
        layers[6] = { status: 'NOT_SWEPT', reason: 'not reached' }
        const report = validReport({ layers_swept: layers })

        // agent_trace covers 1; agent_config covers 3 and 7. 2/4/5/6 are not SWEPT.
        const result = reports.validate(report, auditCtx(['agent_trace', 'agent_config']))

        expect(result.valid).toBe(true)
    })

    test('auditAvailable:false skips the sweep cross-check too', () => {
        const reports = load()

        const result = reports.validate(validReport(), { auditAvailable: false, invokedTools: [] })

        expect(result.valid).toBe(true)
    })

    test('read_artifact supports every layer — it pages an earlier audited tool call', () => {
        const reports = load()

        const result = reports.validate(validReport(), auditCtx(['read_artifact']))
        const sweepProblems = result.problems.filter((p) => p.indexOf('unsupported sweep claim') !== -1)

        expect(sweepProblems.length).toBe(0)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaFixReport.test.js -t "#79b"`
Expected: FAIL — `_checkSweptClaims` does not exist, so `validate` throws `TypeError: this._checkSweptClaims is not a function`.

- [ ] **Step 3: Implement the sweep-claim check**

Add these two methods to `src/server/PaFixReport.js` immediately after `_checkLayersSwept` (`:194`):

```javascript
    /**
     * #79b. A layer marked SWEPT is a claim to have LOOKED at it; the audit
     * trail says whether a tool that CAN look was ever invoked. In the
     * 2026-08-02 re-run, 11 layer-sweep claims across 4 runs named a tool
     * that was never invoked, and one rejected draft claimed all seven layers
     * SWEPT on two tool calls — both reads of the same trace.
     *
     * Only SWEPT is checked. NOT_SWEPT and UNAVAILABLE are claims of NOT
     * having looked, already priced by the `reason` `_checkLayersSwept`
     * makes mandatory for them.
     *
     * ALL offenders collapse into ONE problem. Per-layer problems would put
     * five near-identical entries into a repair prompt that also carries the
     * citation problems, and burying the signal is how a repair turn gets
     * wasted.
     *
     * This is complementary to `_checkInconclusive`'s citation-per-sweep
     * pricing, not a replacement for it: `_countSweptLayers` prices honest
     * sweeps, this falsifies dishonest ones. A report can no longer dodge the
     * price by inflating its sweep claims.
     */
    _checkSweptClaims: function (report, problems, ctx) {
        if (!ctx.auditEnabled) return

        var ls = this._isPlainObject(report.layers_swept) ? report.layers_swept : {}
        var defs = this._layerDefs()
        var map = this._layerToolMap()
        var unsupported = []

        for (var i = 0; i < defs.length; i++) {
            var def = defs[i]
            var entry = ls[def.number]
            if (!this._isPlainObject(entry) || entry.status !== 'SWEPT') continue

            var supporting = map[def.number] || []
            if (this._anyInvoked(supporting, ctx)) continue

            unsupported.push(def.number + ' (' + def.name + ') needs one of: ' + supporting.join(', '))
        }

        if (unsupported.length === 0) return

        problems.push(
            'layers_swept: unsupported sweep claim — ' + unsupported.length + ' layer(s) are marked SWEPT ' +
                'but this run never invoked a tool that reads them. ' + unsupported.join('. ') + '. Tools ' +
                'invoked this run: ' + this._invokedList(ctx) + '. Mark a layer you did not actually sweep ' +
                'NOT_SWEPT or UNAVAILABLE with a reason instead of claiming it.'
        )
    },

    /**
     * #79b layer -> tool map. Extends PaRunManager._collectionTools (the same
     * seven-layer mapping the Evidence Bundle uses) with the two tools it does
     * not cover. Layer 1 is kept aligned with the `trace` entry of
     * `_citationToolMap`; the rest are layer-specific, because layers are
     * finer-grained than the four evidence sources.
     */
    _layerToolMap: function () {
        return {
            1: ['agent_trace', 'genai_log', 'log_analysis', 'read_artifact'],
            2: ['agent_config', 'read_artifact'],
            3: ['agent_config', 'read_artifact'],
            4: ['schema_lookup', 'read_artifact'],
            5: ['query_table', 'read_artifact'],
            6: ['genai_log', 'log_analysis', 'read_artifact'],
            7: ['agent_config', 'read_artifact'],
        }
    },
```

- [ ] **Step 4: Run the full suite**

Run: `npx jest`
Expected: PASS, all files. The `PaFixReport` additions are inert without a context argument, so no other test file should move.

- [ ] **Step 5: Commit**

```bash
git add src/server/PaFixReport.js test/PaFixReport.test.js
git commit -m "fix: cross-check layers_swept SWEPT claims against the audit trail (#79)

A layer marked SWEPT is a claim to have looked at it. In the 2026-08-02
re-run, 11 sweep claims across 4 runs named a tool that was never invoked,
and one draft claimed all seven layers SWEPT on two tool calls.

All offenders collapse into ONE problem — per-layer entries would bury the
citation problems sharing the same repair prompt. Complementary to the
existing citation-per-sweep pricing rather than a replacement: that prices
honest sweeps, this falsifies dishonest ones, so inflating sweep claims no
longer dodges the price.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Tell the model the rules — `schemaText()`

`schemaText()` is the only description of the rules the model ever sees. Judging a report against rules it was never told is #78's defect in a new costume.

**Files:**
- Modify: `src/server/PaFixReport.js` — `schemaText()` (`:523`-`:600`)
- Test: `test/PaFixReport.test.js`

**Interfaces:**
- Consumes: `_nonTraceEvidenceSources()` (existing).
- Produces: no new methods. `schemaText()` keeps returning a single `String`.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaFixReport.test.js`:

```javascript
// =========================================================================
// The contract the model is actually shown
// =========================================================================

describe('schemaText contract additions', () => {
    test('tells the model citations are checked against tools actually called', () => {
        const text = load().schemaText()

        expect(text.indexOf('actually called') !== -1 || text.indexOf('actually invoked') !== -1).toBe(true)
    })

    test('tells the model a SWEPT layer needs a tool call behind it', () => {
        const text = load().schemaText()

        expect(text.indexOf('SWEPT')).not.toBe(-1)
        expect(text.toLowerCase().indexOf('tool call')).not.toBe(-1)
    })

    test('tells the model how to report an absence', () => {
        const text = load().schemaText()

        expect(text.indexOf('UNAVAILABLE')).not.toBe(-1)
        expect(text.indexOf('two distinct')).not.toBe(-1)
    })

    test('is still a single non-empty string', () => {
        const text = load().schemaText()

        expect(typeof text).toBe('string')
        expect(text.length > 0).toBe(true)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaFixReport.test.js -t "schemaText contract"`
Expected: FAIL on the first three; the fourth passes already.

- [ ] **Step 3: Add the three contract clauses**

In `schemaText()`, find the `root_causes:` line (`:557`) that ends with the evidence-rule description and the `layers_swept` line. Add the following as additional entries in the same list the method builds, matching its existing `lines.push(...)` / array-entry style exactly (read the surrounding code and follow it — do not restructure the method):

```javascript
            'EVIDENCE IS CHECKED AGAINST WHAT YOU ACTUALLY CALLED. Every citation source is verified ' +
                'against the tools this run actually invoked. Citing a source you did not read with a tool ' +
                'in THIS run is rejected — trace comes from agent_trace/genai_log/log_analysis, config from ' +
                'agent_config/genai_log, schema from schema_lookup, data from query_table/log_analysis, and ' +
                'read_artifact counts for whatever it paged. Do not label evidence you did not gather.',

            'A LAYER MARKED SWEPT NEEDS A TOOL CALL BEHIND IT. layers_swept entries marked SWEPT are ' +
                'verified the same way: claiming a layer you never ran a tool against is rejected. Marking a ' +
                'layer NOT_SWEPT or UNAVAILABLE with an honest reason is always acceptable and costs you ' +
                'nothing — an inflated sweep claim costs you the whole report.',

            'IF NOTHING EVER RAN, SAY SO — you do not need a trace citation. When there is no execution ' +
                'to trace (the agent never fired, so no execution plan exists), mark layer 1 UNAVAILABLE ' +
                'with the reason and cite two distinct sources from ' +
                this._nonTraceEvidenceSources().join('/') + ' instead. Two citations of the same source ' +
                'are one source. This is a fully acceptable root cause — do NOT invent a trace citation to ' +
                'satisfy the evidence rule.',
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaFixReport.test.js`
Expected: PASS, whole file.

- [ ] **Step 5: Commit**

```bash
git add src/server/PaFixReport.js test/PaFixReport.test.js
git commit -m "feat: tell the model the evidence rules it is judged by (#78, #79)

schemaText is the only description of the rules the model ever sees.
Judging a report against rules it was never told is #78's defect in a new
costume, so the citation cross-check, the SWEPT cross-check and the
absence-diagnosis route are all now stated in the contract.

NOTE this is a benchmark confound. DECISION.md H7-3 already records that
the contract text changed between the 0/10 and 1/10 passes, blocking clean
attribution; it changes again here, and the next measurement must say so up
front.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `PaAgentLoop` — resolve the trail once and record any degradation

**Files:**
- Modify: `src/server/PaAgentLoop.js` — `initialize` (`:140`), `_handleFixReport` (`:291`), plus two new methods near the collaborator accessors (`:746`)
- Test: `test/PaAgentLoop.test.js`

**Interfaces:**
- Consumes: `PaAuditLogger.invokedTools(runId)` from Task 1; `PaFixReport.validate(report, context)` from Task 2.
- Produces: `_auditContext(runId)` → `{auditAvailable: Boolean, invokedTools: [String]}` — the exact shape `_buildCheckContext` expects. New constructor option `auditLogger`.

- [ ] **Step 0: Extend the existing `fakeFixReport` to record the context**

`fakeFixReport` (`test/PaAgentLoop.test.js:78`) currently records only the report: `validate: function (report) { calls.push(report) ... }`. The new tests need the second argument. Change that one method — do not add a second fake:

```javascript
        validate: function (report, context) {
            calls.push(report)
            contextCalls.push(context)
            const r = validateResults[i]
            i += 1
            return r === undefined ? { valid: false, problems: ['no more stubbed validations'] } : r
        },
```

and add `const contextCalls = []` next to `const calls = []` (`:79`), plus `contextCalls: contextCalls,` to the returned object next to `calls: calls,`. Every existing assertion against `.calls` keeps working unchanged.

Add a fake for the new collaborator next to the others:

```javascript
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
```

- [ ] **Step 1: Write the failing tests**

Append to `test/PaAgentLoop.test.js`, using the file's existing `load()`, `fakeRunManager()`, `fakeFixReport()` and `fakeLlm()` helpers:

```javascript
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

    test('a degraded trail disables the checks AND is recorded in the transcript', () => {
        const runs = fakeRunManager()
        const fixReport = fakeFixReport([{ valid: true, normalized: { ok: 1 } }])
        const audit = fakeAuditLogger({ available: false, degraded: 'no_audit_rows', tools: [] })

        const loop = load({ runManager: runs, fixReport: fixReport, auditLogger: audit })
        loop._handleFixReport('run1', { failure_summary: 'x' })

        expect(fixReport.contextCalls[0].auditAvailable).toBe(false)

        const notes = runs.transcript.filter(
            (e) => String(e.result_digest).indexOf('audit trail unavailable') !== -1
        )
        expect(notes.length).toBe(1)
        expect(notes[0].result_digest.indexOf('no_audit_rows')).not.toBe(-1)
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
```

- [ ] **Step 1b: HAZARD — existing transcript assertions**

`load()` builds the loop with `loadScriptInclude('PaAgentLoop.js', { JSON: JSON })`, so `PaAuditLogger` is **not defined** in that context. Any existing test that reaches `_handleFixReport` without injecting `auditLogger` will hit `new PaAuditLogger()` → `ReferenceError` → the `catch` in `_auditContext` → **one extra transcript entry**.

This is correct behaviour (the trail genuinely was unavailable), but it will break existing tests that assert transcript length or exact contents. **The fix is to inject `auditLogger: fakeAuditLogger({available: true, tools: []})` into those tests' `load()` calls** — matching how they already inject `llmProxy`, `toolRegistry` and `runManager`, none of which are defined in that context either. Do **not** weaken or remove the transcript note to make an old assertion pass; the note is the point of the design (spec: "a skipped check must be visible").

Run `npx jest test/PaAgentLoop.test.js` after Step 3 and fix any such breakage this way.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaAgentLoop.test.js -t "audit context"`
Expected: FAIL — `validate` is called with one argument, so `context` is `undefined`.

- [ ] **Step 3: Implement the plumbing**

3a. In `initialize` (`:140`), add the collaborator alongside the existing four:

```javascript
        this._auditLogger = o.auditLogger || null
```

3b. Add the accessor next to `_reports()` (`:746`):

```javascript
    _audits: function () {
        return this._auditLogger || new PaAuditLogger()
    },
```

3c. Replace the first two lines of `_handleFixReport` (`:291`) and the second `validate` call (`:316`):

```javascript
    _handleFixReport: function (runId, report) {
        var context = this._auditContext(runId)

        var validated = this._reports().validate(report, context)
        if (validated.valid) {
            return this._completeFixReport(runId, validated.normalized)
        }
        // ... unchanged through the repair turn ...
        var validated2 = this._reports().validate(repairedAction.report, context)
```

3d. Add `_auditContext` directly after `_handleFixReport`:

```javascript
    /**
     * Resolve the run's audit trail ONCE per fix-report handling and reuse the
     * SAME object across the repair turn — a repair turn makes no tool calls,
     * so a second query would return the same set at twice the cost.
     *
     * A degraded trail is RECORDED, not swallowed. #79's whole point is that a
     * passing Fix Report should carry an evidential guarantee; a cross-check
     * that silently skipped would leave that guarantee unfalsifiable, which is
     * the same defect one layer down. The transcript note is what lets a later
     * audit tell "citations verified" from "citations unverified".
     *
     * Total by construction: a broken audit logger degrades the CHECK, never
     * the diagnosis. Same reasoning as PaAuditLogger's own write path — a
     * diagnosis that fails because its audit query threw is strictly worse
     * than a diagnosis with an unverified citation.
     */
    _auditContext: function (runId) {
        var res = null
        try {
            res = this._audits().invokedTools(runId)
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            res = null
        }

        var available = !!(res && res.available === true)
        if (!available) {
            this._runs().appendTranscript(runId, {
                actor: 'system',
                result_digest:
                    'audit trail unavailable (' +
                    this._str(res && res.degraded ? res.degraded : 'query_failed') +
                    ') — citation and sweep cross-checks SKIPPED for this report',
            })
        }

        return {
            auditAvailable: available,
            invokedTools: res && this._isArray(res.tools) ? res.tools : [],
        }
    },
```

- [ ] **Step 4: Run the full suite**

Run: `npx jest`
Expected: PASS, all files.

- [ ] **Step 5: Commit**

```bash
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "feat: hand the run's audit trail to PaFixReport.validate (#79)

Resolves the trail once per fix-report handling and reuses the same context
across the repair turn — a repair turn makes no tool calls, so re-querying
returns the same set at twice the cost.

A degraded trail disables the cross-checks and is RECORDED in the
transcript. A check that silently skipped would leave a passing report's
evidential guarantee unfalsifiable, which is #79's own defect one layer
down. Total by construction: a broken audit logger degrades the check,
never the diagnosis.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `GET /runs/{id}` — surface the rejected draft

`_finishFailedFixReport` (`PaAgentLoop.js:361`) already stores the draft in `fix_report` and the problems inside the same row's `error` text. `PaRestHandlers.js:279` gates on status, so the correct diagnosis #78 threw away was invisible to every API consumer.

**Deviation from the spec, recorded here:** the spec's `{report, problems}` shows `problems` as an array. `_joinProblems` (`PaAgentLoop.js:816`) joins with `'; '`, and Task 4's collapsed sweep-claim message contains `'. '` and `', '` internally — splitting prose back into an array would be lossy and fragile. `problems` is therefore the persisted error text **verbatim, as a String**. Reconstructing structure that was never stored would be inventing it.

**Files:**
- Modify: `src/server/rest/PaRestHandlers.js` — `getRun` (`:262`-`:283`)
- Test: `test/PaRestHandlers.test.js`

**Interfaces:**
- Consumes: `_parseJsonSafe` (`:785`), `_nonEmptyString` (`:814`), `_str` (`:822`) — all existing.
- Produces: `getRun` response body gains an optional `fix_report_rejected: {report: Object, problems: String}`.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaRestHandlers.test.js`, using the file's existing `load({readRun: fakeReadRun({...})})` pattern. Note `user: 'u1'` on every row — `_ownedByCaller` refuses a run whose owner does not match `userId`.

```javascript
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
```

**Before writing these:** confirm `fakeReadRun` is the helper name this file actually uses for the `readRun` option (the existing `getRun` tests around `test/PaRestHandlers.test.js:285` and `:305` show the exact pattern). If it is named differently, use that name — do not add a second harness.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaRestHandlers.test.js -t fix_report_rejected`
Expected: FAIL — `res.body.fix_report_rejected` is `undefined` on the first test.

- [ ] **Step 3: Implement the sibling field**

In `getRun`, after the `body` object literal (`:279`) and before `return { status: 200, body: body }`:

```javascript
        // #78 side-defect. The rejected draft IS stored — _finishFailedFixReport
        // writes it — and the validation problems are in the same row's `error`
        // text. The status gate above returned null for both, so the one
        // CORRECT diagnosis the harness produced in the 2026-08-02 benchmark
        // re-run was invisible to every API consumer and had to be read out of
        // the table by hand (benchmark/DECISION.md H6).
        //
        // A SIBLING field, not a loosening of `fix_report`: that field keeps
        // meaning "a report that PASSED validation", so no consumer can mistake
        // a rejected draft for a diagnosis. `problems` is the persisted error
        // text verbatim — it was stored as prose, and splitting it back into an
        // array would invent structure that was never recorded.
        if (run.status !== 'complete' && this._nonEmptyString(run.fix_report)) {
            var rejected = this._parseJsonSafe(run.fix_report)
            if (rejected) {
                body.fix_report_rejected = {
                    report: rejected,
                    problems: this._str(run.error),
                }
            }
        }
```

- [ ] **Step 4: Run the full suite**

Run: `npx jest`
Expected: PASS, all files.

- [ ] **Step 5: Commit**

```bash
git add src/server/rest/PaRestHandlers.js test/PaRestHandlers.test.js
git commit -m "feat: expose a rejected Fix Report draft on GET /runs/{id} (#78)

The draft and its problems were already persisted; the status gate returned
null for both, so the one correct diagnosis the harness produced in the
2026-08-02 re-run was invisible to every API consumer and had to be read out
of the table by hand.

A sibling field rather than a loosening — fix_report keeps meaning 'a report
that passed validation', so no consumer can mistake a rejected draft for a
diagnosis. problems is the persisted error text verbatim: it was stored as
prose, and splitting it into an array would invent structure that was never
recorded. No table change.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Build, deploy, verify live on gpinst01, open the PR

**Files:**
- Modify: `package.json` (version), `README.md` (version badge)
- Modify: `benchmark/DECISION.md` (record the contract-text confound)

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: a deployed app on gpinst01 and a PR against `main`.

- [ ] **Step 1: Run the full suite one more time**

Run: `npx jest`
Expected: PASS, every file. Do not proceed on a red suite.

- [ ] **Step 2: Build**

Run: `now-sdk build`
Expected: success. If it fails, the most likely cause is a Rhino/ES5 violation in the new code — check for `const`, `let`, arrow functions, or a stray backtick inside a template (Build Rule #43).

- [ ] **Step 3: Bump the version**

Set `"version": "2026.08.0220"` in `package.json` and update the version badge in `README.md` to match.

- [ ] **Step 4: Install to gpinst01**

Run: `now-sdk install --alias gpinst01`
Expected: success.

- [ ] **Step 5: Verify the absence-diagnosis path live**

Use the foundry MCP tools — `servicenow_connect` then `servicenow_request` — never `curl` with shell-sourced credentials (CLAUDE.md, "ServiceNow access").

Run seed 05 through the custom harness and confirm the run reaches `complete` with a stored `fix_report` rather than failing validation on a missing trace citation. Record the run sys_id.

Expected: a validated report naming layer 7 and the trigger gate, with `layers_swept["1"].status === "UNAVAILABLE"`.

If the model still produces two citations of the same source, that is a **model** outcome, not a code failure — the merge gate is that the path is now reachable, which Step 6 proves deterministically. Record what happened either way.

- [ ] **Step 6: Verify the fabrication check live and deterministically**

Rather than waiting for a live run to fabricate, invoke the deployed validator directly against real audit rows. Via `servicenow_code` (background script, scoped to `x_snc_troubleshoot`):

```javascript
var runId = '<the run sys_id from Step 5>';
var audit = new PaAuditLogger().invokedTools(runId);
var report = {
    failure_summary: 'fabricated citation check',
    layers_swept: {
        1: { status: 'SWEPT' }, 2: { status: 'SWEPT' }, 3: { status: 'SWEPT' },
        4: { status: 'SWEPT' }, 5: { status: 'SWEPT' }, 6: { status: 'SWEPT' },
        7: { status: 'SWEPT' }
    },
    root_causes: [{
        layer: 'layer 7',
        component: 'sn_aia_trigger_configuration',
        finding: 'active=false',
        evidence: [
            { source: 'trace', detail: 'sn_aia_execution_plan: no rows' },
            { source: 'schema', detail: 'INVENTED — no schema_lookup call was made' }
        ]
    }],
    fixes: [{
        target_type: 'wiring', target: 'trigger', current: 'false',
        proposed: 'true', rationale: 'so it fires'
    }],
    verification: 'Re-run and confirm an execution plan row appears.',
    data_markers: []
};
var res = new PaFixReport().validate(report, {
    auditAvailable: audit.available,
    invokedTools: audit.tools
});
gs.info('AUDIT: ' + JSON.stringify(audit));
gs.info('VALID: ' + res.valid);
gs.info('PROBLEMS: ' + JSON.stringify(res.problems));
```

Expected: `AUDIT` shows the real tools the run invoked; `VALID: false`; `PROBLEMS` contains both `unsupported citation` (for the invented `schema` entry) and `unsupported sweep claim`.

This proves the deployed code rejects a fabricated citation against real audit rows, without depending on model behaviour.

- [ ] **Step 7: Record the contract-text confound in `benchmark/DECISION.md`**

Add a short note to §H7 stating that the `schemaText()` contract changed again on this branch (#78/#79), so the H7-3 attribution limit applies to the next measurement too, and that the next re-run must be paired with a same-day native re-measurement per H7-4. State it as a limit on the *next* number, not a claim about this branch.

- [ ] **Step 8: Commit and open the PR**

```bash
git add package.json README.md benchmark/DECISION.md
git commit -m "chore: version 2026.08.0220 — record the contract-text confound (#78, #79)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin fix/fixreport-evidence-validation
gh pr create --title "fix: audit-verified Fix Report evidence validation (#78, #79)" --body "$(cat <<'EOF'
Closes #78. Closes #79.

## What

`PaFixReport.validate` checked that evidence LABELS were legal and diverse, never whether the labelled source was read — so it was uncorrelated with evidential honesty. And it required a `trace` citation unconditionally, which made a correct diagnosis of an absence structurally unreportable.

Audit-verified from the 2026-08-02 benchmark re-run:

| Run | Tools actually invoked | Cites | Was |
|---|---|---|---|
| `100c8910…` | `agent_trace` only | `agent_config` | PASSED |
| `ebdc4194…` | `agent_trace`, `read_artifact` | `agent_config` | PASSED |
| `a66d0118…` | genuine config reads | `config` only | FAILED |

The rule rejected a correct, honestly-cited diagnosis and accepted two fabricated ones.

## Changes

- **`PaAuditLogger.invokedTools`** — the codebase's only reader of `x_snc_troubleshoot_audit`. Tagged result so a broken trail stays distinguishable from an idle run.
- **#78** — layer 1 `UNAVAILABLE` plus two DISTINCT non-trace sources becomes a second way to satisfy the evidence rule, checked only after the original rule has already returned. Specified as a widening: nothing that passes today can newly fail.
- **#79a** — every citation is cross-checked against the tools the run actually invoked. The source→tool map is permissive on purpose; adding new pedantry would be #78's defect in a new costume.
- **#79b** — `SWEPT` claims cross-checked the same way, collapsed into one problem.
- **`schemaText`** — the model is told all three rules. Judging it against unseen rules is the defect being fixed.
- **`GET /runs/{id}`** — gains `fix_report_rejected`, since the correct diagnosis #78 threw away was invisible to every API consumer.

Fails **open**: a degraded audit trail skips the cross-checks and records the degradation in the transcript, so a skipped check stays visible.

## Verification

- Full Jest suite green, including every pre-existing test unchanged — the monotonicity proof.
- Live on gpinst01 (`2026.08.0220`): seed 05 exercised, and the deployed validator rejects a fabricated citation against real audit rows.

## Not in scope

Diagnostic depth (§H8 item 3) and the 10-run benchmark re-run, which per §H7-4 needs a same-day native baseline to mean anything. `benchmark/DECISION.md` §H7 records that the contract text changed again here.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| `PaAuditLogger.invokedTools`, tagged result, R-1/R-9/R-10 | 1 |
| Context passed in, `validate` stays pure | 2 |
| #78 mode A / mode B widening | 2 |
| `distinctOther` (two citations of one source ≠ two sources) | 2 |
| #79a citation cross-check + permissive source map | 3 |
| `evidence_read` checked identically | 3 |
| #79b `SWEPT` cross-check, one collapsed problem, layer map | 4 |
| Fail open on `auditAvailable !== true` | 2 (context), 3 + 4 (guards), 6 (transcript note) |
| Problem-text anchors | 3, 4 |
| `schemaText` contract additions | 5 |
| Contract-text confound recorded | 5 (commit), 8 (DECISION.md) |
| Query once, reuse across repair turn | 6 |
| `GET /runs` `fix_report_rejected` | 7 |
| Backward compat (one-argument `validate`) | 2 |
| Regression suite as monotonicity proof | 2, 4, 6, 7, 8 |
| Live gpinst01 verification | 8 |

No gaps.

**Placeholder scan:** Clean. The first draft of Tasks 6 and 7 used invented harness names; both were rewritten against the real helpers after reading `test/PaAgentLoop.test.js:57-130` and `test/PaRestHandlers.test.js:32-70`, `:285-325`. Every code step now contains real, complete, runnable code.

That rewrite also surfaced a hazard the first draft would have walked into: `load()` in `test/PaAgentLoop.test.js` supplies only `JSON` as a global, so `new PaAuditLogger()` raises a `ReferenceError` that the new `catch` converts into an extra transcript entry — breaking existing transcript assertions. Task 6 Step 1b names the failure, explains why it is correct behaviour, and prescribes injecting the fake rather than weakening the note.

**Type consistency:** `invokedTools` returns `{available, tools, degraded?}` in Task 1 and is consumed with exactly those keys in Task 6. `_auditContext` returns `{auditAvailable, invokedTools}` in Task 6, which is exactly what `_buildCheckContext` reads in Task 2. `_anyInvoked(candidates, ctx)` and `_invokedList(ctx)` are defined in Task 3 and reused in Task 4. `ctx` carries `{traceUnavailable, auditEnabled, invokedTools}` throughout.
