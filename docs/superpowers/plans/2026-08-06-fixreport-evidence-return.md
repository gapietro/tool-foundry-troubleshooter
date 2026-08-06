# Fix Report Evidence Return Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `PaFixReport.validate` rejects a Fix Report because its *evidence* is insufficient, return control to the main agent loop — where tools are still available — instead of burning the one tool-less repair turn on a problem it cannot fix.

**Architecture:** `PaFixReport.validate` gains a second, parallel `evidenceProblems` array populated at the push site (never by string-matching). `PaAgentLoop._handleFixReport` returns `_step`'s result shape, so an evidence-shortfall rejection can answer `{terminal:false}` and let `run()` loop again. Shape rejections keep today's one-shot repair turn untouched. A capped counter, an iteration/time headroom check, and a preserved rejected draft bound the change.

**Tech Stack:** ES5 / Rhino-safe ServiceNow Script Includes (`Class.create()` prototypes, no `Set`/`Map`/`const`/arrow functions/`Array.prototype.find`), Jest for unit tests, `now-sdk build` + `now-sdk install --alias gpinst01` for deployment.

**Spec:** `docs/superpowers/specs/2026-08-06-fixreport-evidence-return-design.md`
**Issue:** [#81](https://github.com/gapietro/tool-foundry-troubleshooter/issues/81)
**Branch:** `fix/81-evidence-return-to-loop` (already created, spec already committed as `aebb50f`)

## Global Constraints

- **ES5 / Rhino only** in `src/server/**`. No `const`, `let`, arrow functions, `Set`, `Map`, `Array.prototype.find`, `Object.assign`, template literals, or default parameters. Use `var`, plain objects, and index loops. Existing code in these two files is the style reference — match it.
- **R-1: never touch the exception object in a `catch`.** A catch names its own reason and falls back; it does not read what was thrown.
- **R-9: every input may be absent.** A `null`/`undefined`/non-object argument is a normal outcome to handle, never a crash.
- **`PaRunManager.DIGEST_CHARS` is 200.** Any `result_digest` longer than that is silently truncated. Every transcript note this plan adds must fit well inside 200 characters.
- **`problems` array must not change** in content or order. `evidenceProblems` is a *subset of the same strings*, added alongside. Existing `PaFixReport.test.js` expectations on `problems` must keep passing untouched.
- **Do not modify** `repairPrompt`, `schemaText`, `docs/agent/agent-doctor-instructions.md`, `src/fluent/agent-doctor.now.ts`, or `_depthGate`'s own fields (`_gateReleased`, `_heldGaps`, `_heldTools`, `_heldTarget`, `_holdActive`, `_holdCount`). The smoke must have one variable in it.
- **Never commit to `main`.** All work stays on `fix/81-evidence-return-to-loop`; integration is via PR.
- **Run `npx jest` from the repo root.** Full suite must pass at the end of every task.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/server/PaFixReport.js` | Authors validation problems; now also classifies each as evidence-gathering-fixable or shape-fixable | Modify — Tasks 1, 2 |
| `src/server/PaAgentLoop.js` | Owns the loop, the bounds, and the terminal-action decision; now routes evidence rejections back into the loop | Modify — Tasks 3, 4, 5, 6 |
| `test/PaFixReport.test.js` | Unit tests for classification | Modify — Tasks 1, 2 |
| `test/PaAgentLoop.test.js` | Unit tests for routing, caps, headroom, prompt block, draft preservation | Modify — Tasks 3, 4, 5, 6 |
| `benchmark/DECISION.md` | Pre-registered prediction and revert trigger, written before the smoke | Modify — Task 7 |
| `package.json`, `README.md`, `CHANGELOG.md` | Version bump on merge | Modify — Task 8 |

Task order is dependency order: `PaFixReport` produces `evidenceProblems` before `PaAgentLoop` consumes it.

---

### Task 1: `PaFixReport.validate` returns `evidenceProblems`

Introduce the second array and wire the *evidence-rule* checks into it. `_checkSweptClaims` and `_checkCitationSupported` follow in Task 2 — this task establishes the plumbing with the check that produced v9 row 07.

**Files:**
- Modify: `src/server/PaFixReport.js` — `validate` (~line 117), `_checkRootCauses`, `_checkEvidenceRule`, `_checkEvidenceEntries`, `_checkUnconfirmed`
- Test: `test/PaFixReport.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `PaFixReport.validate(report, context)` returns, on failure, `{valid: false, problems: [String], evidenceProblems: [String]}`. `evidenceProblems` is always an array (possibly empty) on every failure return, including the `!_isPlainObject(report)` guard. On success the shape is unchanged: `{valid: true, normalized: Object}`.

**The mechanism.** The existing checks all take a `problems` array and push strings into it. Rather than change every signature, add a *collector* object that both arrays hang off, and give the evidence-class push sites a helper that writes to both.

- [ ] **Step 1: Write the failing tests**

Add to `test/PaFixReport.test.js`:

```js
describe('evidenceProblems classification — evidence rule (#81)', () => {
    function baseReport(overrides) {
        const report = {
            failure_summary: 'the agent returned nothing',
            layers_swept: {
                1: { status: 'SWEPT' },
                2: { status: 'NOT_SWEPT', reason: 'not needed' },
                3: { status: 'NOT_SWEPT', reason: 'not needed' },
                4: { status: 'NOT_SWEPT', reason: 'not needed' },
                5: { status: 'NOT_SWEPT', reason: 'not needed' },
                6: { status: 'NOT_SWEPT', reason: 'not needed' },
                7: { status: 'NOT_SWEPT', reason: 'not needed' },
            },
            root_causes: [
                {
                    layer: '1',
                    component: 'x_snc_tsbench_ticket',
                    finding: 'the tool returned no rows',
                    evidence: [{ source: 'trace', detail: 'rows_returned: 0' }],
                },
            ],
            fixes: [
                {
                    target_type: 'data',
                    target: 'x_snc_tsbench_ticket',
                    current: '0 rows',
                    proposed: 'seed the table',
                    rationale: 'the query has nothing to match',
                },
            ],
            verification: 're-run the agent and confirm rows come back',
            data_markers: [],
        }
        return Object.assign(report, overrides || {})
    }

    it('classifies a trace-only evidence rule violation as an evidence problem', () => {
        const fr = load()
        const res = fr.validate(baseReport())

        expect(res.valid).toBe(false)
        expect(res.evidenceProblems.length).toBe(1)
        expect(res.evidenceProblems[0]).toContain('evidence cites only the trace')
        // subset invariant
        expect(res.problems).toEqual(expect.arrayContaining(res.evidenceProblems))
    })

    it('classifies a missing-trace evidence rule violation as an evidence problem', () => {
        const fr = load()
        const res = fr.validate(
            baseReport({
                root_causes: [
                    {
                        layer: '4',
                        component: 'incident.assignment_group',
                        finding: 'the field is missing',
                        evidence: [{ source: 'schema', detail: 'no such column' }],
                    },
                ],
            })
        )

        expect(res.valid).toBe(false)
        expect(res.evidenceProblems.length).toBe(1)
        expect(res.evidenceProblems[0]).toContain('no trace citation found')
    })

    it('classifies the absence-path shortfall as an evidence problem', () => {
        const fr = load()
        const report = baseReport({
            layers_swept: {
                1: { status: 'UNAVAILABLE', reason: 'nothing ever ran' },
                2: { status: 'NOT_SWEPT', reason: 'not needed' },
                3: { status: 'NOT_SWEPT', reason: 'not needed' },
                4: { status: 'NOT_SWEPT', reason: 'not needed' },
                5: { status: 'NOT_SWEPT', reason: 'not needed' },
                6: { status: 'NOT_SWEPT', reason: 'not needed' },
                7: { status: 'NOT_SWEPT', reason: 'not needed' },
            },
            root_causes: [
                {
                    layer: '7',
                    component: 'sn_aia_trigger_configuration',
                    finding: 'the trigger is inactive',
                    evidence: [{ source: 'config', detail: 'active=false' }],
                },
            ],
        })
        const res = fr.validate(report)

        expect(res.valid).toBe(false)
        expect(res.evidenceProblems.length).toBe(1)
        expect(res.evidenceProblems[0]).toContain('TWO DISTINCT sources')
    })

    it('classifies would_confirm shape problems as SHAPE, not evidence', () => {
        const fr = load()
        const res = fr.validate(
            baseReport({
                root_causes: [
                    {
                        layer: '1',
                        component: 'x_snc_tsbench_ticket',
                        finding: 'the tool returned no rows',
                        evidence: [{ source: 'trace', detail: 'rows_returned: 0' }],
                        confidence: 'UNCONFIRMED',
                    },
                ],
            })
        )

        expect(res.valid).toBe(false)
        expect(res.problems.length).toBe(1)
        expect(res.problems[0]).toContain('would_confirm')
        expect(res.evidenceProblems).toEqual([])
    })

    it('classifies the UNCONFIRMED evidence-per-swept-layer shortfall as an evidence problem', () => {
        const fr = load()
        const res = fr.validate(
            baseReport({
                layers_swept: {
                    1: { status: 'SWEPT' },
                    2: { status: 'SWEPT' },
                    3: { status: 'SWEPT' },
                    4: { status: 'NOT_SWEPT', reason: 'not needed' },
                    5: { status: 'NOT_SWEPT', reason: 'not needed' },
                    6: { status: 'NOT_SWEPT', reason: 'not needed' },
                    7: { status: 'NOT_SWEPT', reason: 'not needed' },
                },
                root_causes: [
                    {
                        layer: '1',
                        component: 'x_snc_tsbench_ticket',
                        finding: 'the tool returned no rows',
                        evidence: [{ source: 'trace', detail: 'rows_returned: 0' }],
                        confidence: 'UNCONFIRMED',
                        would_confirm: 'layer 5',
                    },
                ],
            })
        )

        expect(res.valid).toBe(false)
        expect(res.evidenceProblems.length).toBe(1)
        expect(res.evidenceProblems[0]).toContain('at least one piece of evidence per layer')
    })

    it('returns an empty evidenceProblems array for a non-object report (R-9)', () => {
        const fr = load()
        const res = fr.validate(null)

        expect(res.valid).toBe(false)
        expect(res.problems).toEqual(['fix report must be a JSON object'])
        expect(res.evidenceProblems).toEqual([])
    })

    it('returns no evidenceProblems key requirement on a valid report', () => {
        const fr = load()
        const res = fr.validate(
            baseReport({
                root_causes: [
                    {
                        layer: '1',
                        component: 'x_snc_tsbench_ticket',
                        finding: 'the tool returned no rows',
                        evidence: [
                            { source: 'trace', detail: 'rows_returned: 0' },
                            { source: 'data', detail: 'x_snc_tsbench_ticket has 0 rows' },
                        ],
                    },
                ],
            })
        )

        expect(res.valid).toBe(true)
        expect(res.normalized).toBeDefined()
    })
})
```

`load()` is the existing helper in `test/PaFixReport.test.js` — check its exact name at the top of that file and use whatever it already is rather than adding a second one.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest test/PaFixReport.test.js -t 'evidenceProblems classification'
```

Expected: FAIL — `res.evidenceProblems` is `undefined`, so `.length` throws / `toEqual([])` fails.

- [ ] **Step 3: Add the collector and thread it through `validate`**

In `src/server/PaFixReport.js`, replace the body of `validate` (currently ~lines 117-140):

```js
    validate: function (report, context) {
        if (!this._isPlainObject(report)) {
            return { valid: false, problems: ['fix report must be a JSON object'], evidenceProblems: [] }
        }

        var ctx = this._buildCheckContext(report, context)

        // #81: `problems` stays EXACTLY what it has always been — same
        // strings, same order, same consumers (`repairPrompt`, the
        // transcript, the audit trail). `evidenceProblems` is a SUBSET of
        // those same string instances, marking the ones a tool-less repair
        // turn cannot fix without either weakening the diagnosis or
        // fabricating a citation. The classification is authored at the push
        // site — never by matching the message text afterwards, which would
        // silently reclassify every problem the day someone rewords one.
        var problems = []
        problems.evidence = []

        this._checkFailureSummary(report, problems)
        this._checkLayersSwept(report, problems)
        this._checkSweptClaims(report, problems, ctx)
        this._checkRootCauses(report, problems, ctx)
        this._checkFixes(report, problems)
        this._checkVerification(report, problems)
        this._checkDataMarkers(report, problems)

        if (problems.length > 0) {
            return { valid: false, problems: problems, evidenceProblems: problems.evidence }
        }

        var normalized = this._clone(report)
        this._normalizeRootCauseLayers(normalized)
        return { valid: true, normalized: normalized };
    },
```

Note `problems.evidence` is an expando on the array. That is deliberate: every existing check keeps its `(…, problems, …)` signature unchanged, so no call site moves. Add the helper immediately below `validate`:

```js
    /**
     * #81: push a problem AND mark it evidence-gathering-fixable.
     *
     * The one test that decides which helper a push site uses: can this
     * problem be satisfied without either weakening the diagnosis or
     * fabricating a citation? If NO, it is an evidence problem — only a run
     * that can still call a tool can fix it, and `PaAgentLoop` routes those
     * back into the loop rather than into the tool-less repair turn (see
     * that class's `_handleFixReport`).
     *
     * `problems.evidence` is an expando array on `problems` so that every
     * check keeps its existing `(report, problems, ctx)` signature. R-9: a
     * `problems` array arriving without the expando (a caller that built one
     * by hand) degrades to a plain push rather than throwing.
     */
    _pushEvidenceProblem: function (problems, message) {
        problems.push(message)
        if (this._isArray(problems.evidence)) problems.evidence.push(message)
    },
```

- [ ] **Step 4: Convert the evidence-rule push sites**

In `_checkEvidenceRule`, change the three `problems.push(` calls that emit evidence-rule violations to `this._pushEvidenceProblem(problems, ` — the absence-path message (`'… TWO DISTINCT sources …'`), the no-trace message (`'… no trace citation found …'`), and the final only-trace fall-through (`'… evidence cites only the trace …'`). Close each with `)` as before.

In `_checkUnconfirmed`, convert **only** the fourth message — the one beginning `'an UNCONFIRMED trace-only root cause cites '` and containing `'cite at least one piece of evidence per layer you claim to have swept'`. Leave the first three (`would_confirm` missing, `would_confirm` not a layer number, `would_confirm` names a SWEPT layer) as plain `problems.push` — adding or correcting a `would_confirm` string is a legal edit that neither weakens the diagnosis nor invents evidence, which is exactly what the tool-less repair turn is good at.

Leave `_checkEvidenceEntries`'s two messages (unknown `source`, missing `detail`) as plain `problems.push` — both are shape.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx jest test/PaFixReport.test.js
```

Expected: PASS, including every pre-existing test in the file (the `problems` array is unchanged).

- [ ] **Step 6: Run the full suite**

```bash
npx jest
```

Expected: PASS. `PaAgentLoop.test.js` still passes because it ignores the new key.

- [ ] **Step 7: Commit**

```bash
git add src/server/PaFixReport.js test/PaFixReport.test.js
git commit -m "feat(#81): validate() returns evidenceProblems for evidence-rule violations

Classified at the push site, never by matching message text. \`problems\` is
unchanged in content and order; \`evidenceProblems\` is a subset of the same
strings. \`would_confirm\` shape problems stay shape — adding the field is a
legal edit that neither weakens the diagnosis nor invents evidence.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Classify the two audit-backed checks

`_checkCitationSupported` produced v9 row 08's rejection and `_checkSweptClaims` is its sibling. Both are satisfiable only by calling a tool (or by downgrading a claim, which stays available either way).

**Files:**
- Modify: `src/server/PaFixReport.js` — `_checkCitationSupported` (~line 564), `_checkSweptClaims`
- Test: `test/PaFixReport.test.js`

**Interfaces:**
- Consumes: `_pushEvidenceProblem(problems, message)` from Task 1.
- Produces: no new signatures. `evidenceProblems` now also carries unsupported-citation and unsupported-sweep-claim messages.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('evidenceProblems classification — evidence rule (#81)')` block in `test/PaFixReport.test.js`, or open a sibling `describe`:

```js
describe('evidenceProblems classification — audit-backed checks (#81)', () => {
    const CTX = { auditAvailable: true, invokedTools: ['agent_trace'] }

    it('classifies an unsupported citation as an evidence problem', () => {
        const fr = load()
        const res = fr.validate(
            {
                failure_summary: 'the agent returned nothing',
                layers_swept: {
                    1: { status: 'SWEPT' },
                    2: { status: 'NOT_SWEPT', reason: 'not needed' },
                    3: { status: 'NOT_SWEPT', reason: 'not needed' },
                    4: { status: 'NOT_SWEPT', reason: 'not needed' },
                    5: { status: 'NOT_SWEPT', reason: 'not needed' },
                    6: { status: 'NOT_SWEPT', reason: 'not needed' },
                    7: { status: 'NOT_SWEPT', reason: 'not needed' },
                },
                root_causes: [
                    {
                        layer: '5',
                        component: 'x_snc_tsbench_ticket',
                        finding: 'the table is empty',
                        evidence: [
                            { source: 'trace', detail: 'rows_returned: 0' },
                            { source: 'data', detail: 'x_snc_tsbench_ticket has 0 rows' },
                        ],
                    },
                ],
                fixes: [
                    {
                        target_type: 'data',
                        target: 'x_snc_tsbench_ticket',
                        current: '0 rows',
                        proposed: 'seed the table',
                        rationale: 'the query has nothing to match',
                    },
                ],
                verification: 're-run the agent and confirm rows come back',
                data_markers: [],
            },
            CTX
        )

        expect(res.valid).toBe(false)
        const unsupported = res.evidenceProblems.filter(function (p) {
            return p.indexOf('unsupported citation') !== -1
        })
        expect(unsupported.length).toBe(1)
        expect(res.problems).toEqual(expect.arrayContaining(res.evidenceProblems))
    })

    it('classifies an unsupported sweep claim as an evidence problem', () => {
        const fr = load()
        const res = fr.validate(
            {
                failure_summary: 'the agent returned nothing',
                layers_swept: {
                    1: { status: 'SWEPT' },
                    2: { status: 'NOT_SWEPT', reason: 'not needed' },
                    3: { status: 'NOT_SWEPT', reason: 'not needed' },
                    4: { status: 'SWEPT' },
                    5: { status: 'NOT_SWEPT', reason: 'not needed' },
                    6: { status: 'NOT_SWEPT', reason: 'not needed' },
                    7: { status: 'NOT_SWEPT', reason: 'not needed' },
                },
                root_causes: [
                    {
                        layer: '1',
                        component: 'x_snc_tsbench_ticket',
                        finding: 'the tool returned no rows',
                        evidence: [{ source: 'trace', detail: 'rows_returned: 0' }],
                    },
                ],
                fixes: [
                    {
                        target_type: 'data',
                        target: 'x_snc_tsbench_ticket',
                        current: '0 rows',
                        proposed: 'seed the table',
                        rationale: 'the query has nothing to match',
                    },
                ],
                verification: 're-run the agent and confirm rows come back',
                data_markers: [],
            },
            CTX
        )

        expect(res.valid).toBe(false)
        const sweep = res.evidenceProblems.filter(function (p) {
            return p.indexOf('unsupported sweep claim') !== -1
        })
        expect(sweep.length).toBe(1)
    })

    it('leaves plain shape problems out of evidenceProblems', () => {
        const fr = load()
        const res = fr.validate({ layers_swept: {}, root_causes: [], fixes: [], data_markers: [] }, CTX)

        expect(res.valid).toBe(false)
        expect(res.problems.length).toBeGreaterThan(0)
        expect(res.evidenceProblems).toEqual([])
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest test/PaFixReport.test.js -t 'audit-backed checks'
```

Expected: FAIL — `unsupported.length` and `sweep.length` are `0`, because those messages are still plain pushes.

- [ ] **Step 3: Convert the two push sites**

In `_checkCitationSupported`, change its single `problems.push(` to `this._pushEvidenceProblem(problems, ` (closing `)` unchanged). Add above it:

```js
        // #81: evidence class. This message already names the tools that
        // would support the citation, and v9 row 08 received exactly that
        // text and still failed — because the repair turn that read it had
        // no way to call any of them. Routing it back to the loop is what
        // makes the instruction actionable.
```

In `_checkSweptClaims`, change its single `problems.push(` the same way, with:

```js
        // #81: evidence class. "Call a tool that reads that layer" is a
        // legal fix and only the loop can offer it. Downgrading the claim to
        // NOT_SWEPT stays available on the resubmission either way.
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest test/PaFixReport.test.js
```

Expected: PASS, all pre-existing tests included.

- [ ] **Step 5: Run the full suite**

```bash
npx jest
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/PaFixReport.js test/PaFixReport.test.js
git commit -m "feat(#81): classify unsupported citations and sweep claims as evidence problems

v9 row 08 was rejected by _checkCitationSupported, whose message already names
the tools that would support the citation. The repair turn that read it could
not call them. Both audit-backed checks now mark their problems evidence-class.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `_handleFixReport` returns `_step`'s result shape

A pure refactor with no behaviour change, isolated so the routing change in Task 5 lands on a stable signature.

**Files:**
- Modify: `src/server/PaAgentLoop.js` — `_step` (~line 337), `_handleFixReport` (~line 386)
- Test: `test/PaAgentLoop.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `_handleFixReport(runId, report)` returns `{terminal: true, outcome: Object}` — the same object it used to return, now wrapped. Task 5 adds the `{terminal: false}` branch.

- [ ] **Step 1: Write the failing test**

Add to `test/PaAgentLoop.test.js`:

```js
describe('_handleFixReport returns a step result (#81)', () => {
    it('wraps a completed fix_report in {terminal:true, outcome}', () => {
        const loop = load({
            llmProxy: fakeLlm([]),
            toolRegistry: fakeTools([]),
            runManager: fakeRunManager(),
            fixReport: fakeFixReport([{ valid: true, normalized: { failure_summary: 'ok' } }]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            now: fakeClock([0]),
        })

        const res = loop._handleFixReport('RUN1', { failure_summary: 'ok' })

        expect(res.terminal).toBe(true)
        expect(res.outcome.outcome).toBe('fix_report')
    })

    it('wraps a failed fix_report in {terminal:true, outcome}', () => {
        const loop = load({
            llmProxy: fakeLlm([{ success: false, error: 'llm down' }]),
            toolRegistry: fakeTools([]),
            runManager: fakeRunManager(),
            fixReport: fakeFixReport([{ valid: false, problems: ['failure_summary is required and must be a non-empty string'], evidenceProblems: [] }]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            now: fakeClock([0]),
        })

        const res = loop._handleFixReport('RUN1', {})

        expect(res.terminal).toBe(true)
        expect(res.outcome.outcome).toBe('failed')
    })
})
```

Check `fakeAuditLogger`'s real return shape at the top of `test/PaAgentLoop.test.js` and match it — it must be whatever `PaAuditLogger.invokedTools` actually returns (`{available, tools}` or similar), not an invention.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest test/PaAgentLoop.test.js -t 'returns a step result'
```

Expected: FAIL — `res.terminal` is `undefined`; `_handleFixReport` currently returns the bare outcome.

- [ ] **Step 3: Wrap every return in `_handleFixReport`**

In `src/server/PaAgentLoop.js`, change all four returns inside `_handleFixReport`:

```js
        var validated = this._reports().validate(report, context)
        if (validated.valid) {
            return { terminal: true, outcome: this._completeFixReport(runId, validated.normalized) }
        }
        …
        if (!repaired || repaired.success !== true) {
            return { terminal: true, outcome: this._finishFailedFixReport(runId, validated.problems, report) }
        }
        …
        if (repairedAction.action !== 'fix_report') {
            return { terminal: true, outcome: this._finishFailedFixReport(runId, validated.problems, report) }
        }

        var validated2 = this._reports().validate(repairedAction.report, context)
        if (validated2.valid) {
            return { terminal: true, outcome: this._completeFixReport(runId, validated2.normalized) }
        }

        return { terminal: true, outcome: this._finishFailedFixReport(runId, validated2.problems, repairedAction.report) }
```

And update the docblock's return line to:

```js
     * @returns {Object} `_step`'s result shape — {terminal:true, outcome} for
     *          every path today; #81 adds a {terminal:false} branch that
     *          hands an evidence-shortfall rejection back to the loop.
```

- [ ] **Step 4: Update the caller**

At `_step` (~line 337):

```js
        if (action.action === 'fix_report') {
            // #81: `_handleFixReport` may answer {terminal:false} — an
            // evidence-shortfall rejection returns to the loop rather than
            // spending the tool-less repair turn on a problem only a tool
            // call can fix. Every other path is still terminal.
            return this._handleFixReport(runId, action.report)
        }
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx jest test/PaAgentLoop.test.js
```

Expected: PASS — every pre-existing loop test included. If a pre-existing test calls `_handleFixReport` directly and asserts on the bare outcome, update it to read `.outcome`; that is the only expected churn.

- [ ] **Step 6: Run the full suite and commit**

```bash
npx jest
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "refactor(#81): _handleFixReport returns _step's result shape

Pure refactor, no behaviour change. Isolated so the evidence-return branch
lands on a stable signature.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Evidence-return state, caps, and headroom

The bounds, before the branch that uses them.

**Files:**
- Modify: `src/server/PaAgentLoop.js` — constants block (~line 142), `initialize` (~line 180), `run` (~line 221), `_resetGate` (~line 537)
- Test: `test/PaAgentLoop.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `this.MAX_EVIDENCE_RETURNS` — Number, default `2`, overridable via `initialize({maxEvidenceReturns: n})`
  - `this.EVIDENCE_HEADROOM_MS` — Number, default `30000`, overridable via `initialize({evidenceHeadroomMs: n})`
  - `this._evidenceReturns` — Number, reset to `0` by `_resetGate()`
  - `this._evidenceBlock` — String or `null`, reset to `null` by `_resetGate()`
  - `this._rejectedDraft` — `{report: Object, problems: [String]}` or `null`, reset to `null` by `_resetGate()`
  - `this._iteration` — Number, current iteration, maintained by `run()`
  - `this._startMs` — Number, run start, set by `run()`
  - `_hasEvidenceHeadroom()` — returns Boolean

- [ ] **Step 1: Write the failing tests**

```js
describe('evidence-return bounds (#81)', () => {
    function bare(opts) {
        const o = Object.assign(
            {
                llmProxy: fakeLlm([]),
                toolRegistry: fakeTools([]),
                runManager: fakeRunManager(),
                fixReport: fakeFixReport([]),
                auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
                now: fakeClock([0]),
            },
            opts || {}
        )
        return load(o)
    }

    it('defaults MAX_EVIDENCE_RETURNS to 2 and EVIDENCE_HEADROOM_MS to 30000', () => {
        const loop = bare()
        expect(loop.MAX_EVIDENCE_RETURNS).toBe(2)
        expect(loop.EVIDENCE_HEADROOM_MS).toBe(30000)
    })

    it('accepts overrides through initialize', () => {
        const loop = bare({ maxEvidenceReturns: 1, evidenceHeadroomMs: 5 })
        expect(loop.MAX_EVIDENCE_RETURNS).toBe(1)
        expect(loop.EVIDENCE_HEADROOM_MS).toBe(5)
    })

    it('_resetGate clears all three evidence fields', () => {
        const loop = bare()
        loop._evidenceReturns = 2
        loop._evidenceBlock = 'BLOCK'
        loop._rejectedDraft = { report: {}, problems: [] }

        loop._resetGate()

        expect(loop._evidenceReturns).toBe(0)
        expect(loop._evidenceBlock).toBe(null)
        expect(loop._rejectedDraft).toBe(null)
    })

    it('_hasEvidenceHeadroom is true with two iterations and time to spare', () => {
        const loop = bare({ now: fakeClock([1000]) })
        loop.MAX_ITERATIONS = 15
        loop.BUDGET_MS = 300000
        loop._iteration = 5
        loop._startMs = 0

        expect(loop._hasEvidenceHeadroom()).toBe(true)
    })

    it('_hasEvidenceHeadroom is false with fewer than two iterations left', () => {
        const loop = bare({ now: fakeClock([1000]) })
        loop.MAX_ITERATIONS = 15
        loop.BUDGET_MS = 300000
        loop._iteration = 14
        loop._startMs = 0

        expect(loop._hasEvidenceHeadroom()).toBe(false)
    })

    it('_hasEvidenceHeadroom is false inside the time margin', () => {
        const loop = bare({ now: fakeClock([280000]) })
        loop.MAX_ITERATIONS = 15
        loop.BUDGET_MS = 300000
        loop.EVIDENCE_HEADROOM_MS = 30000
        loop._iteration = 2
        loop._startMs = 0

        expect(loop._hasEvidenceHeadroom()).toBe(false)
    })

    it('run() maintains _iteration and _startMs', () => {
        const loop = bare({
            llmProxy: fakeLlm([{ success: true, raw: 'r', action: { action: 'answer', text: 'done' } }]),
            now: fakeClock([500, 500, 500]),
        })

        loop.run('RUN1', {})

        expect(loop._iteration).toBe(1)
        expect(loop._startMs).toBe(500)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest test/PaAgentLoop.test.js -t 'evidence-return bounds'
```

Expected: FAIL — `MAX_EVIDENCE_RETURNS` is `undefined`, `_hasEvidenceHeadroom` is not a function.

- [ ] **Step 3: Add the constants**

Below `MAX_HOLDS` (~line 154) in `src/server/PaAgentLoop.js`:

```js
    /** #81 — how many times a run may be handed BACK to the loop because its
     *  fix_report's EVIDENCE (not its shape) was insufficient. Separate from
     *  `MAX_HOLDS` on purpose: a shared pool would give a run that spent both
     *  beats on depth holds zero evidence returns, which is precisely v9 rows
     *  07 and 08 — the two runs this exists for. Worst case is 2 holds + 2
     *  returns = 4 forced beats against MAX_ITERATIONS of 15; the deepest
     *  custom run in the v9 pass used 6 iterations in total. */
    MAX_EVIDENCE_RETURNS: 2,

    /** #81 — the time margin `_hasEvidenceHeadroom` requires before handing a
     *  run back. Returning to the loop with a second left trips `run()`'s
     *  budget guard on the very next iteration and downgrades a rejection
     *  (which carries a draft) into a `partial` (which, before this change,
     *  did not) — so the margin is what keeps the change from costing the
     *  benchmark a scored row. */
    EVIDENCE_HEADROOM_MS: 30000,
```

- [ ] **Step 4: Wire `initialize` and `_resetGate`**

In `initialize`, beside the existing overrides:

```js
        if (o.maxIterations > 0) this.MAX_ITERATIONS = o.maxIterations
        if (o.budgetMs > 0) this.BUDGET_MS = o.budgetMs
        if (o.maxEvidenceReturns >= 0) this.MAX_EVIDENCE_RETURNS = o.maxEvidenceReturns
        if (o.evidenceHeadroomMs >= 0) this.EVIDENCE_HEADROOM_MS = o.evidenceHeadroomMs
```

`>= 0` rather than `> 0` on both: a test (and the revert trigger in `benchmark/DECISION.md`) must be able to set `maxEvidenceReturns: 0` to disable the path entirely.

Extend `initialize`'s docblock options list to `{llmProxy, toolRegistry, runManager, fixReport, auditLogger, now, playbook, maxIterations, budgetMs, maxEvidenceReturns, evidenceHeadroomMs}`.

In `_resetGate`, below `this._holdCount = 0`:

```js
        // #81 — evidence-return state. Deliberately NOT part of the depth
        // gate's own fields above: that gate holds on sweep breadth BEFORE
        // validation, this one on evidence quality AFTER it, and entangling
        // the two would put `_holdActive`'s release logic (`_heldTools`, and
        // the clear at gate release) in charge of a block it knows nothing
        // about. Reset here because this is the one place a run's per-run
        // state has a single definition a test can assert.
        this._evidenceReturns = 0
        this._evidenceBlock = null
        this._rejectedDraft = null
```

Also initialize `this._iteration = 0` and `this._startMs = 0` in `_resetGate` so `_hasEvidenceHeadroom()` is safe to call on a fresh instance.

- [ ] **Step 5: Maintain `_iteration` / `_startMs` in `run()`**

In `run`, replace the local `startMs` / `iteration` bookkeeping:

```js
        this._startMs = this._now()
        this._iteration = 0

        while (true) {
            this._iteration += 1

            // BOUNDS FIRST — see the file header's BOUNDS ARE A FLOOR note.
            // Neither check ever fires mid-reasoning; both fire only before
            // the next iteration would otherwise begin.
            if (this._iteration > this.MAX_ITERATIONS) {
                return this._finishPartial(rid, 'reached the maximum of ' + this.MAX_ITERATIONS + ' reasoning iterations')
            }
            if (this._now() - this._startMs >= this.BUDGET_MS) {
                return this._finishPartial(rid, 'exceeded the ' + this.BUDGET_MS + 'ms diagnosis time budget')
            }

            var stepResult = this._step(rid, playbook, promptBlock, req)
            if (stepResult.terminal) return stepResult.outcome
            // else: a non-terminal tool_call was dispatched and observed, or
            // #81 handed an evidence-shortfall rejection back — loop again
            // with the enlarged transcript.
        }
```

Delete the now-unused `var startMs` and `var iteration` declarations above the loop.

- [ ] **Step 6: Add `_hasEvidenceHeadroom`**

Next to `_resetGate`:

```js
    /**
     * #81 — is there room to hand this run back to the loop and still let it
     * finish properly?
     *
     * TWO iterations, not one: the model needs one to call a tool and one to
     * resubmit. Handing back with a single iteration left guarantees the
     * bounds check fires first and the run finishes `partial`.
     *
     * And a TIME margin, because the same thing happens on the clock: a
     * return granted with a second left is a `partial` in disguise. Both
     * checks fail toward NOT returning — the fall-through is the existing
     * repair turn, which is exactly today's behaviour, so a wrong answer here
     * costs nothing that was not already being lost.
     */
    _hasEvidenceHeadroom: function () {
        if (this.MAX_ITERATIONS - this._iteration < 2) return false
        return this.BUDGET_MS - (this._now() - this._startMs) >= this.EVIDENCE_HEADROOM_MS
    },
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
npx jest test/PaAgentLoop.test.js
```

Expected: PASS. If a pre-existing bounds test asserted on the local `iteration` variable it will need no change — the assertions are on `run()`'s return value.

- [ ] **Step 8: Run the full suite and commit**

```bash
npx jest
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "feat(#81): evidence-return state, caps, and headroom check

MAX_EVIDENCE_RETURNS (2, separate from MAX_HOLDS) and EVIDENCE_HEADROOM_MS
(30s). Headroom requires two iterations and the time margin, both failing
toward NOT returning — the fall-through is today's repair turn.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Route evidence rejections back into the loop

The change itself.

**Files:**
- Modify: `src/server/PaAgentLoop.js` — `_handleFixReport`, plus two new renderers and the prompt slot in `_buildPrompt` (~line 1405)
- Test: `test/PaAgentLoop.test.js`

**Interfaces:**
- Consumes: `validated.evidenceProblems` (Task 1/2), `MAX_EVIDENCE_RETURNS`, `_evidenceReturns`, `_evidenceBlock`, `_rejectedDraft`, `_hasEvidenceHeadroom()` (Task 4), `_handleFixReport`'s step-result shape (Task 3).
- Produces:
  - `_evidenceReturnBlock(validated)` — returns String, the prompt block
  - `_evidenceNote(validated)` — returns String under 200 chars, the transcript digest

- [ ] **Step 1: Write the failing tests**

```js
describe('evidence return routing (#81)', () => {
    const EVIDENCE_PROBLEM =
        'root_causes[0] (x_snc_tsbench_ticket): evidence rule violation — evidence cites only the trace; ' +
        'at least one config, schema, or data citation is required.'
    const SHAPE_PROBLEM = 'failure_summary is required and must be a non-empty string'

    function loopWith(validations, opts) {
        const o = Object.assign(
            {
                llmProxy: fakeLlm([]),
                toolRegistry: fakeTools([]),
                runManager: fakeRunManager(),
                fixReport: fakeFixReport(validations),
                auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
                now: fakeClock([0, 0, 0, 0, 0, 0]),
            },
            opts || {}
        )
        const loop = load(o)
        loop._iteration = 3
        loop._startMs = 0
        loop._fakes = o
        return loop
    }

    it('returns {terminal:false} on an evidence-only rejection', () => {
        const loop = loopWith([{ valid: false, problems: [EVIDENCE_PROBLEM], evidenceProblems: [EVIDENCE_PROBLEM] }])

        const res = loop._handleFixReport('RUN1', { failure_summary: 'x' })

        expect(res.terminal).toBe(false)
        expect(loop._evidenceReturns).toBe(1)
        expect(loop._fakes.llmProxy.calls.length).toBe(0)
    })

    it('sets an evidence block carrying the problems verbatim', () => {
        const loop = loopWith([{ valid: false, problems: [EVIDENCE_PROBLEM], evidenceProblems: [EVIDENCE_PROBLEM] }])

        loop._handleFixReport('RUN1', { failure_summary: 'x' })

        expect(loop._evidenceBlock).toContain('EVIDENCE SHORTFALL')
        expect(loop._evidenceBlock).toContain(EVIDENCE_PROBLEM)
    })

    it('writes a transcript note inside DIGEST_CHARS', () => {
        const loop = loopWith([{ valid: false, problems: [EVIDENCE_PROBLEM], evidenceProblems: [EVIDENCE_PROBLEM] }])

        loop._handleFixReport('RUN1', { failure_summary: 'x' })

        const notes = loop._fakes.runManager.transcript.filter(function (e) {
            return e.actor === 'system'
        })
        expect(notes.length).toBe(1)
        expect(notes[0].result_digest).toContain('EVIDENCE RETURN 1/2')
        expect(notes[0].result_digest.length).toBeLessThan(200)
    })

    it('stashes the rejected draft', () => {
        const draft = { failure_summary: 'x' }
        const loop = loopWith([{ valid: false, problems: [EVIDENCE_PROBLEM], evidenceProblems: [EVIDENCE_PROBLEM] }])

        loop._handleFixReport('RUN1', draft)

        expect(loop._rejectedDraft.report).toBe(draft)
        expect(loop._rejectedDraft.problems).toEqual([EVIDENCE_PROBLEM])
    })

    it('routes back to the loop when evidence and shape problems are mixed', () => {
        const loop = loopWith([
            { valid: false, problems: [SHAPE_PROBLEM, EVIDENCE_PROBLEM], evidenceProblems: [EVIDENCE_PROBLEM] },
        ])

        const res = loop._handleFixReport('RUN1', { failure_summary: '' })

        expect(res.terminal).toBe(false)
        expect(loop._evidenceBlock).toContain(SHAPE_PROBLEM)
    })

    it('uses the repair turn for a shape-only rejection', () => {
        const loop = loopWith(
            [
                { valid: false, problems: [SHAPE_PROBLEM], evidenceProblems: [] },
                { valid: true, normalized: { failure_summary: 'fixed' } },
            ],
            {
                llmProxy: fakeLlm([
                    { success: true, raw: 'r', action: { action: 'fix_report', report: { failure_summary: 'fixed' } } },
                ]),
            }
        )

        const res = loop._handleFixReport('RUN1', {})

        expect(res.terminal).toBe(true)
        expect(res.outcome.outcome).toBe('fix_report')
        expect(loop._evidenceReturns).toBe(0)
        expect(loop._fakes.llmProxy.calls.length).toBe(1)
    })

    it('falls through to the repair turn once the cap is spent', () => {
        const loop = loopWith(
            [
                { valid: false, problems: [EVIDENCE_PROBLEM], evidenceProblems: [EVIDENCE_PROBLEM] },
                { valid: false, problems: [EVIDENCE_PROBLEM], evidenceProblems: [EVIDENCE_PROBLEM] },
            ],
            {
                llmProxy: fakeLlm([{ success: false, error: 'llm down' }]),
            }
        )
        loop._evidenceReturns = 2

        const res = loop._handleFixReport('RUN1', { failure_summary: 'x' })

        expect(res.terminal).toBe(true)
        expect(res.outcome.outcome).toBe('failed')
        expect(loop._fakes.llmProxy.calls.length).toBe(1)
    })

    it('falls through to the repair turn without headroom', () => {
        const loop = loopWith([{ valid: false, problems: [EVIDENCE_PROBLEM], evidenceProblems: [EVIDENCE_PROBLEM] }], {
            llmProxy: fakeLlm([{ success: false, error: 'llm down' }]),
        })
        loop._iteration = loop.MAX_ITERATIONS - 1

        const res = loop._handleFixReport('RUN1', { failure_summary: 'x' })

        expect(res.terminal).toBe(true)
        expect(res.outcome.outcome).toBe('failed')
        expect(loop._evidenceReturns).toBe(0)
    })

    it('clears a stale evidence block on the next submission', () => {
        const loop = loopWith([{ valid: true, normalized: { failure_summary: 'ok' } }])
        loop._evidenceBlock = 'STALE BLOCK'

        loop._handleFixReport('RUN1', { failure_summary: 'ok' })

        expect(loop._evidenceBlock).toBe(null)
    })

    it('renders the evidence block into the next prompt', () => {
        const loop = loopWith([])
        loop._evidenceBlock = '## EVIDENCE SHORTFALL — your fix_report was not accepted'

        const prompt = loop._buildPrompt('PLAYBOOK', 'TOOLBLOCK', { transcript: [], context_summary: '' }, {})

        expect(prompt).toContain('## EVIDENCE SHORTFALL')
    })

    it('tolerates a validate() result with no evidenceProblems key (R-9)', () => {
        const loop = loopWith([{ valid: false, problems: [EVIDENCE_PROBLEM] }], {
            llmProxy: fakeLlm([{ success: false, error: 'llm down' }]),
        })

        const res = loop._handleFixReport('RUN1', { failure_summary: 'x' })

        expect(res.terminal).toBe(true)
        expect(loop._evidenceReturns).toBe(0)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest test/PaAgentLoop.test.js -t 'evidence return routing'
```

Expected: FAIL — `res.terminal` is `true` on the first test; `_evidenceBlock` stays `null`.

- [ ] **Step 3: Add the branch to `_handleFixReport`**

```js
    _handleFixReport: function (runId, report) {
        // #81: the block is re-derived per submission, never carried. The
        // depth gate freezes its gap set because re-deriving lets the
        // goalposts move; that does not apply here — these problems are a
        // function of THIS draft against the audit trail, so a model that
        // actually gathered the missing source genuinely clears them. The
        // CAP, not stickiness, is what bounds run length.
        this._evidenceBlock = null

        var context = this._auditContext(runId)

        var validated = this._reports().validate(report, context)
        if (validated.valid) {
            return { terminal: true, outcome: this._completeFixReport(runId, validated.normalized) }
        }

        // ---------------------------------------------------------------
        // #81 — THE EVIDENCE RETURN.
        //
        // A tool-less repair turn cannot fix a report rejected for
        // INSUFFICIENT EVIDENCE. Its only legal moves are to weaken the root
        // cause, switch to `inconclusive`, or fabricate a citation. v9 rows
        // 07 and 08 both died here, and both had already been told which
        // tool would support the citation — `_checkCitationSupported` names
        // it — by a turn that could not call it.
        //
        // So an evidence-class rejection goes BACK TO THE LOOP, where tools
        // are live and the trail records what actually gets called. Shape
        // problems keep the repair turn, which #64/#65 established works for
        // them.
        //
        // EVERY GUARD FAILS TOWARD TODAY'S BEHAVIOUR: no evidence problems,
        // cap spent, or no headroom all fall through to the repair turn with
        // the same arguments it receives now.
        // ---------------------------------------------------------------
        var evidence = this._isArray(validated.evidenceProblems) ? validated.evidenceProblems : []
        if (evidence.length > 0 && this._evidenceReturns < this.MAX_EVIDENCE_RETURNS && this._hasEvidenceHeadroom()) {
            this._evidenceReturns += 1
            this._evidenceBlock = this._evidenceReturnBlock(validated)
            // The draft must survive a `partial` — see `_finishPartial`.
            this._rejectedDraft = { report: report, problems: this._isArray(validated.problems) ? validated.problems : [] }
            this._runs().appendTranscript(runId, {
                actor: 'system',
                result_digest: this._evidenceNote(evidence.length),
            })
            return { terminal: false }
        }

        var repairPrompt = this._reports().repairPrompt(report, validated.problems)
        …
```

Leave the rest of the function exactly as Task 3 left it.

- [ ] **Step 4: Add the two renderers**

Next to `_holdBlock` / `_holdNote`:

```js
    /**
     * #81 — what the model reads on the next iteration.
     *
     * The problems are quoted VERBATIM because the actionable part is
     * already in them: `_checkCitationSupported` names the supporting tools
     * and the tools this run actually invoked, and `_checkSweptClaims` names
     * the layer. ALL problems are rendered, not just the evidence-class
     * ones — the model resubmits a whole report, so it needs the whole
     * rejection.
     *
     * This is the GATE'S OWN refusal text, authored by the validator. It is
     * not an edit to the playbook or to the fix_report contract — see
     * DECISION.md §R6 for why that boundary is worth keeping visible.
     */
    _evidenceReturnBlock: function (validated) {
        var probs = this._isPlainObject(validated) && this._isArray(validated.problems) ? validated.problems : []
        var lines = ['## EVIDENCE SHORTFALL — your fix_report was not accepted', '']

        lines.push('Your report was not accepted. Its evidence does not support what it claims:')
        lines.push('')
        for (var i = 0; i < probs.length; i++) {
            lines.push('  - ' + this._str(probs[i]))
        }
        lines.push('')
        lines.push(
            'The run is NOT over. Tools are still available, and the audit trail records what you ' +
                'actually call — a citation is supported only by a tool this run really invoked.'
        )
        lines.push('')
        lines.push('Before you resubmit:')
        lines.push('  1. Call a tool that reads the missing source, and cite what it actually returned.')
        lines.push('  2. Or state the claim at the strength your evidence supports — an UNCONFIRMED')
        lines.push('     cause that names the layer which would confirm it in `would_confirm` is a')
        lines.push('     valid report, and so is the `inconclusive` shape.')
        lines.push('')
        lines.push('Then submit the fix_report again.')

        return lines.join('\n')
    },

    /**
     * #81 — the transcript digest. Kept well inside PaRunManager's
     * DIGEST_CHARS (200) for the same reason `_holdNote` and `_cappedNote`
     * are: a longer note is silently truncated, which is the defect class
     * this design exists to avoid (#72 / DECISION.md §G3a). The full text
     * goes into the PROMPT via `_evidenceReturnBlock`, not here.
     */
    _evidenceNote: function (count) {
        return (
            'EVIDENCE RETURN ' + this._evidenceReturns + '/' + this.MAX_EVIDENCE_RETURNS + ': fix_report not ' +
            'accepted — ' + count + ' evidence problem(s) need a tool call, not a rewrite; run continues.'
        )
    },
```

- [ ] **Step 5: Render the block in `_buildPrompt`**

At `_buildPrompt`'s tail (~line 1405), after the `_holdActive` slot:

```js
        if (this._nonEmptyString(this._holdActive)) {
            lines.push('')
            lines.push(this._holdActive)
        }

        // #81 — its own slot, after the hold, for M3's reason: the last
        // thing the model reads should be what to go do, not a spec for
        // producing the terminal action it was just refused. The two are
        // never both set in practice (`_depthGate` clears `_holdActive` on
        // release, which is the only way `_handleFixReport` is reached), but
        // rendering both is correct if they ever are.
        if (this._nonEmptyString(this._evidenceBlock)) {
            lines.push('')
            lines.push(this._evidenceBlock)
        }

        return lines.join('\n')
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npx jest test/PaAgentLoop.test.js
```

Expected: PASS.

- [ ] **Step 7: Run the full suite and commit**

```bash
npx jest
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "feat(#81): evidence-shortfall rejections return to the loop

An evidence-class rejection now answers {terminal:false} and hands the run
back with a prompt block quoting the problems verbatim. Shape rejections keep
the one-shot repair turn. Cap, headroom and a missing evidenceProblems key all
fall through to today's behaviour.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Preserve the rejected draft through `partial`

Without this, the change costs the benchmark the rows it exists to fix.

**Files:**
- Modify: `src/server/PaAgentLoop.js` — `_finishPartial` (~line 1275)
- Test: `test/PaAgentLoop.test.js`

**Interfaces:**
- Consumes: `this._rejectedDraft` (Task 4/5).
- Produces: `_finishPartial(runId, reasonText)` returns `{success, outcome:'partial', reason, run_id}` plus `draft` and `problems` **only when** `_rejectedDraft` is set.

- [ ] **Step 1: Write the failing tests**

```js
describe('partial preserves a rejected draft (#81)', () => {
    it('attaches the stashed draft and problems', () => {
        const loop = load({
            llmProxy: fakeLlm([]),
            toolRegistry: fakeTools([]),
            runManager: fakeRunManager(),
            fixReport: fakeFixReport([]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            now: fakeClock([0]),
        })
        loop._rejectedDraft = { report: { failure_summary: 'x' }, problems: ['evidence rule violation'] }

        const res = loop._finishPartial('RUN1', 'reached the maximum of 15 reasoning iterations')

        expect(res.outcome).toBe('partial')
        expect(res.draft).toEqual({ failure_summary: 'x' })
        expect(res.problems).toEqual(['evidence rule violation'])
    })

    it('omits draft and problems when no draft was stashed', () => {
        const loop = load({
            llmProxy: fakeLlm([]),
            toolRegistry: fakeTools([]),
            runManager: fakeRunManager(),
            fixReport: fakeFixReport([]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            now: fakeClock([0]),
        })

        const res = loop._finishPartial('RUN1', 'exceeded the 300000ms diagnosis time budget')

        expect(res.outcome).toBe('partial')
        expect(res.draft).toBeUndefined()
        expect(res.problems).toBeUndefined()
    })

    it('writes a separate short note naming the stashed draft, inside DIGEST_CHARS', () => {
        const rm = fakeRunManager()
        const loop = load({
            llmProxy: fakeLlm([]),
            toolRegistry: fakeTools([]),
            runManager: rm,
            fixReport: fakeFixReport([]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            now: fakeClock([0]),
        })
        loop._rejectedDraft = { report: { failure_summary: 'x' }, problems: ['evidence rule violation'] }

        loop._finishPartial('RUN1', 'reached the maximum of 15 reasoning iterations')

        // Two notes: the draft marker FIRST, then the existing flag verbatim.
        expect(rm.transcript.length).toBe(2)
        const marker = rm.transcript[0].result_digest
        expect(marker).toContain('rejected fix_report draft')
        expect(marker.length).toBeLessThan(200)
        expect(rm.transcript[1].result_digest).toContain('INCOMPLETE:')
    })

    it('writes only the INCOMPLETE flag when no draft was stashed', () => {
        const rm = fakeRunManager()
        const loop = load({
            llmProxy: fakeLlm([]),
            toolRegistry: fakeTools([]),
            runManager: rm,
            fixReport: fakeFixReport([]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            now: fakeClock([0]),
        })

        loop._finishPartial('RUN1', 'exceeded the 300000ms diagnosis time budget')

        expect(rm.transcript.length).toBe(1)
        expect(rm.transcript[0].result_digest).toContain('INCOMPLETE:')
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest test/PaAgentLoop.test.js -t 'partial preserves a rejected draft'
```

Expected: FAIL — `res.draft` is `undefined` in the first test.

- [ ] **Step 3: Implement**

```js
    _finishPartial: function (runId, reasonText) {
        // #81: a run handed back for evidence that then rides the bounds
        // out lands HERE rather than in `_finishFailedFixReport`, and the
        // rejected draft is the only artifact of the diagnosis it produced.
        // benchmark/raw-evidence-v9-scored-pass.md §3.4 scores rows 07 and
        // 08 FROM `fix_report_rejected.report`; dropping the draft on this
        // path would blind the next pass on exactly the rows the evidence
        // return exists to improve. Runs with no evidence return are
        // byte-identical to before.
        var stashed = this._isPlainObject(this._rejectedDraft) ? this._rejectedDraft : null

        // The marker is its OWN note, not a clause appended to the flag
        // below. The flag is already 218 characters — past PaRunManager's
        // DIGEST_CHARS (200) and truncated today — so an appended clause
        // would be cut off entirely and never reach the transcript, while
        // still reading as present in the source. Same reason `_holdNote`
        // and `_cappedNote` are short standalone notes rather than
        // additions to something longer.
        if (stashed) {
            this._runs().appendTranscript(runId, {
                actor: 'system',
                result_digest: 'PARTIAL: a rejected fix_report draft from this run is attached to the outcome.',
            })
        }

        var flag =
            'INCOMPLETE: ' +
            reasonText +
            ' — the loop stopped before the model produced an answer or fix_report; the transcript ' +
            'above is the best partial diagnosis available, not a confirmed conclusion.'

        this._runs().appendTranscript(runId, { actor: 'system', result_digest: flag })
        var closeRes = this._runs().close(runId, 'complete', {})

        var out = {
            success: !!(closeRes && closeRes.success === true),
            outcome: 'partial',
            reason: reasonText,
            run_id: runId,
        }
        if (stashed) {
            out.draft = stashed.report
            out.problems = this._isArray(stashed.problems) ? stashed.problems : []
        }
        return out
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest test/PaAgentLoop.test.js
```

Expected: PASS. The existing `INCOMPLETE:` flag is left byte-identical — it is already 218 characters and already truncated, and shortening it is out of scope. The draft marker is a separate note precisely so it survives.

- [ ] **Step 5: Run the full suite and commit**

```bash
npx jest
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "feat(#81): a partial carries the rejected fix_report draft

An evidence return that rides the bounds out lands in _finishPartial, which
attached no draft. v9 §3.4 scores rows 07/08 from fix_report_rejected.report,
so dropping it here would blind the next pass on the rows this change targets.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Pre-register the prediction, then build, deploy, and smoke

The prediction is written **before** the smoke runs. That ordering is the point.

**Files:**
- Modify: `benchmark/DECISION.md` — append a new lettered section after §T
- Create: `benchmark/raw-evidence-v10-evidence-return-smoke.md`

**Interfaces:**
- Consumes: the deployed app on gpinst01.
- Produces: a recorded smoke, explicitly not a scored pass.

- [ ] **Step 1: Write the pre-registration**

Append to `benchmark/DECISION.md`, following §T's heading style and lettering (next letter after `T`). Read §H7-5's smoke block and §R2's prediction table first and match their form. The section must state, before any run happens:

- **What is under test:** `2026.08.06xx`, the evidence return (#81), against `2026.08.0505`.
- **The prediction, per seed 01 and 03:** a fix_report rejected on evidence class produces at least one `EVIDENCE RETURN` transcript note, and the run's next tool call reads a source named in the rejection.
- **What would refute it:** the model resubmits an identical or weaker report without an intervening tool call; or runs that previously ended `failed` (with a draft) now end `partial`.
- **The revert trigger, stated as a value:** if the refutation holds, `MAX_EVIDENCE_RETURNS` goes to `0` rather than the code being kept and explained.
- **What this cannot establish:** §T3 records six custom rows reaching layer 4 and concluding at layer 1. Gathering a citation is not diagnosing correctly. The claim is only that a rejection fixable solely by reading another source stops being unfixable by construction.
- **Not a scored pass:** n, seed and arm stated explicitly, no native control, per the §T9 decision not to spend a scored round before the rubric clause is fixed.

- [ ] **Step 2: Commit the pre-registration on its own**

```bash
git add benchmark/DECISION.md
git commit -m "bench(#81): pre-register the evidence-return prediction and revert trigger

Written before the smoke runs. States the prediction per seed, what refutes
it, the revert trigger as a value (MAX_EVIDENCE_RETURNS -> 0), and what a
gathered citation cannot establish about diagnostic correctness.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: Build**

```bash
now-sdk build
```

Expected: success. Fix any type error before proceeding — `now-sdk build` must pass before `now-sdk install` (Build Rule #6).

- [ ] **Step 4: Deploy**

```bash
now-sdk install --alias gpinst01
```

Expected: success.

- [ ] **Step 5: Run the smoke**

Use `benchmark/scripts` and the existing seed runner the v9 pass used — read `benchmark/README.md` and `benchmark/raw-evidence-v9-scored-pass.md` §2 for the exact invocation rather than inventing one. Run the custom arm only, seeds 01 and 03, two runs each.

For each run record: run id, seed, tool calls in order with their arguments, whether an `EVIDENCE RETURN` note appears, what the next tool call after it was, the terminal outcome, and the final `problems` if rejected. Query the audit trail (`x_snc_troubleshoot_audit`) for tool args and outputs rather than reasoning over the transcript text.

Use the foundry MCP tools for every instance read — `servicenow_connect` then `servicenow_query` / `servicenow_aia_*`. Never `curl` with keychain-sourced auth.

- [ ] **Step 6: Write the evidence file**

Create `benchmark/raw-evidence-v10-evidence-return-smoke.md` following the structure of `benchmark/raw-evidence-v9-scored-pass.md`: what was run, the per-run table, what the prediction said, what happened, and an explicit "this is a smoke, not a scored pass — n=4, two seeds, no native control" statement.

State the verdict against the pre-registered prediction plainly, including if it is refuted. If it is refuted, set `MAX_EVIDENCE_RETURNS` to `0` in the same PR per the trigger, and say so in the file.

- [ ] **Step 7: Commit**

```bash
git add benchmark/raw-evidence-v10-evidence-return-smoke.md benchmark/DECISION.md
git commit -m "bench(#81): unscored smoke of the evidence return on seeds 01 and 03

n=4, two seeds, custom arm only, no native control. Not a scored pass.
Verdict recorded against the pre-registered prediction.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Version, changelog, and PR

**Files:**
- Modify: `package.json`, `README.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a PR against `main`.

- [ ] **Step 1: Bump the version**

Format is `YYYY.MM.DDXX`. Today is 2026-08-06, so the first merge of the day is `2026.08.0601`. Check `git log --oneline main` for any merge already landed today and increment the counter instead if so.

Update the `"version"` field in `package.json` and the version badge in `README.md`.

- [ ] **Step 2: Add the changelog entry**

Append to `CHANGELOG.md` following the existing entry format. Cover: evidence-class rejections return to the loop; shape rejections keep the repair turn; `MAX_EVIDENCE_RETURNS` (2) and `EVIDENCE_HEADROOM_MS` (30 s); `partial` now carries a rejected draft; the smoke's verdict.

- [ ] **Step 3: Run the full suite one more time**

```bash
npx jest
```

Expected: PASS, zero failures. Do not open the PR on a red suite.

- [ ] **Step 4: Commit and push**

```bash
git add package.json README.md CHANGELOG.md
git commit -m "chore: bump version for #81 evidence return

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin fix/81-evidence-return-to-loop
```

- [ ] **Step 5: Open the PR**

```bash
gh pr create --title "fix(#81): evidence-shortfall rejections return to the loop" --body "$(cat <<'EOF'
Closes #81.

## What

`PaFixReport.validate` now returns `evidenceProblems` alongside `problems` — a subset of the same strings, classified at the push site. `PaAgentLoop._handleFixReport` routes an evidence-class rejection back into the main loop (`{terminal:false}`) instead of into the tool-less repair turn, which cannot fix it. Shape rejections keep the repair turn.

## Why

v9 rows 07 and 08 both terminated `failed` on citation shortfall and, per `raw-evidence-v9-scored-pass.md:202`, "both survived the harness's repair attempts." Issue option 3 — have the validator name the tool — is already implemented; row 08 received that text and still failed, because the turn that read it could not call anything.

## Bounds

- `MAX_EVIDENCE_RETURNS` 2, separate from `MAX_HOLDS` (a shared pool would give rows 07/08 zero returns)
- `EVIDENCE_HEADROOM_MS` 30 s, plus two iterations of headroom
- Every guard fails toward today's behaviour: no evidence problems, cap spent, or no headroom all fall through to the existing repair turn
- `_finishPartial` now carries the rejected draft — v9 §3.4 scores rows 07/08 from `fix_report_rejected.report`

## Measurement

Pre-registered prediction and revert trigger in `benchmark/DECISION.md`, written before the smoke. Unscored smoke in `benchmark/raw-evidence-v10-evidence-return-smoke.md` — n=4, two seeds, no native control. No scored pass, per §T9's call to fix the rubric clause first.

Does not claim improved diagnostic correctness. §T3 records six custom rows reaching layer 4 and concluding at layer 1.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage.** §3 control flow → Tasks 3, 5. §3 separate `_evidenceBlock` → Tasks 4, 5. §4 classification table → Tasks 1, 2 (every row has a test). §5 state and bounds table → Task 4 (all six members). §5 headroom → Task 4. §5 not-sticky → Task 5 Step 3's comment and the block clear. §6 prompt block and transcript note → Task 5 Steps 4, 5. §7 regression guard → Task 6. §8 testing → the test steps of Tasks 1–6; every bullet in §8 maps to a named test. §9 measurement → Task 7. §10 out of scope → Global Constraints' do-not-modify list.

**Placeholder scan.** No TBDs. Three steps deliberately point at existing files rather than inlining content: Task 1 Step 1's `load()` helper name, Task 3 Step 1's `fakeAuditLogger` return shape, and Task 7 Step 5's seed-runner invocation. In each case inventing a value would be worse than reading the one that exists — the instruction names the exact file and section to read.

**Type consistency.** `evidenceProblems` is the key name in Tasks 1, 2, 5 and the spec. `_pushEvidenceProblem(problems, message)` is defined in Task 1 and used in Task 2. `_hasEvidenceHeadroom()` is defined in Task 4 and called in Task 5. `_evidenceReturnBlock(validated)` takes the whole `validated` object (it renders `validated.problems`, not just the evidence subset) and `_evidenceNote(count)` takes a Number — both defined and called consistently in Task 5. `_rejectedDraft` is `{report, problems}` in Tasks 4, 5 and 6.
