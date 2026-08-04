# Depth Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a floor under `PaAgentLoop`'s terminal action, so the custom harness cannot conclude a diagnosis on turn 2 while its own report declares layers it never looked at.

**Architecture:** One interception in `_step()` before `answer`/`fix_report` are honored. It holds while the model's own draft marks a layer `NOT_SWEPT` whose tools the audit trail shows were never invoked, and releases stickily once the trail shows the model closed a gap it named itself. The held turn's interrogation is rendered into the prompt by `_buildPrompt()` — not carried in the transcript — for the reason in Global Constraints. No change to `PaFixReport.schemaText()`, so the turn-1 prompt stays byte-identical to v4's.

**Tech Stack:** ES5 / Rhino-safe server-side JavaScript (`src/server/*.js`, `Class.create()` prototypes), Jest 29.7.0 unit tests with hand-rolled fakes and zero Glide, `now-sdk` 4.9.2 build+install to gpinst01, foundry MCP tools for the runtime smoke.

**Spec:** `docs/superpowers/specs/2026-08-03-depth-gate-design.md`
**Issue:** #103 — predictions P1–P7 are filed there and must not be edited after runs begin.

## Global Constraints

- **Never name a measured tool in prompt-facing text.** The strings `schema_lookup`, `query_table` and `genai_log` must never appear in the hold message or any prompt block this plan adds. §H8's acceptance test survives a mandated fix only because it requires the right tool *on the seed that needs it*; a gate that names them is teaching to the test. Enforced by a unit test (Task 4).
- **`PaFixReport.schemaText()` must not change.** The turn-1 prompt must stay byte-identical to v4's, so the smoke has exactly one variable behind it (§H7-3, §H7-5).
- **Do not touch** `docs/agent/agent-doctor-instructions.md`, `src/fluent/agent-doctor.now.ts`, or `src/server/PaScriptToolAdapter.js`. Those move the native harness and reopen §K5 / §I4 confound 3. §K5's pending `excerptPriority` propagation stays off this branch.
- **R-1:** never inspect the exception object in a `catch`.
- **R-9:** every input may be absent — degrade explicitly, never throw.
- **R-19b:** a status must never contradict the notes beside it.
- **ES5 only.** No `let`/`const`/arrow functions/`Set`/`Map` in `src/server/*.js` — Rhino. Test files are Node and may use modern syntax (the existing suites do).
- **Depth is measured from the audit trail, never from a report's self-claim** (§N7): the trail can refute a layer credit but never confer one.
- **Version on merge:** `2026.08.0401` (current `main` is `2026.08.0302`; today is a new day, so the daily counter resets to `01`).

### Correction to the spec, carried into this plan

The spec's §5 says the interrogation is delivered as a `system` transcript entry. **That would not reach the model.** `PaRunManager.appendTranscript` truncates `result_digest` to `DIGEST_CHARS` (200) via `_digest()` (`PaRunManager.js:297`, `:884`), and derives the 8500-char `prompt_digest` **only for `actor === 'tool'` entries** (`:305`). A `system` entry carrying the ~600-character interrogation would reach the next prompt as a 200-character stub ending in `...[+N more chars]` — which is precisely the #72 / §G3a observation-channel defect, the leading identified mechanical cause of the original 0/10, reappearing in a new place.

**Resolution used by this plan:** the transcript keeps a short (<200 char) `system` note for the audit record, and the full interrogation is rendered into the prompt by `_buildPrompt()` from loop state, exactly as `_responseContract()` and `_fixReportContract()` already are. This touches no `PaRunManager` behavior and does not compete with `PROMPT_WINDOW`'s three prompt-digest slots. Recorded on issue #103 rather than absorbed silently. **No prediction changes.**

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/server/PaFixReport.js` | report shape + validation | **Add** one public method `unsweptGaps(report)` — the mirror of `_checkSweptClaims` (#79b). Nothing else. |
| `src/server/PaAgentLoop.js` | the ReAct driver | **Add** `_trailTools`, `_depthGate`, `_holdBlock`, `_openGaps`, `_unionTools`, `_anyOf`; gate wiring in `_step()`; a hold block in `_buildPrompt()`; three instance fields. |
| `test/PaFixReport.test.js` | `PaFixReport` unit tests | **Add** a `describe('unsweptGaps')` block. |
| `test/PaAgentLoop.test.js` | `PaAgentLoop` unit tests | **Add** a `describe('depth gate (#103)')` block. |
| `benchmark/raw-evidence-v5-depth-smoke.md` | smoke evidence | **Create.** |
| `benchmark/DECISION.md` | the record | **Append** §P. |

---

### Task 1: `PaFixReport.unsweptGaps(report)`

The model's self-declared gaps, with the tools that close them. Pure function — no Glide, no trail, no validation side effects.

**Files:**
- Modify: `src/server/PaFixReport.js` (add a public method next to `validate`)
- Test: `test/PaFixReport.test.js`

**Interfaces:**
- Consumes: existing private `_layerDefs()`, `_layerToolMap()`, `_isPlainObject()`, `_nonEmptyString()`.
- Produces: `unsweptGaps(report) -> [{layer:Number, name:String, reason:String, tools:[String]}]`, ordered by layer number ascending. Returns `[]` for any malformed input.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaFixReport.test.js`:

```javascript
describe('unsweptGaps (#103)', () => {
    function reportWith(layersSwept) {
        return { layers_swept: layersSwept }
    }

    test('a NOT_SWEPT layer becomes a gap carrying its reason and tools', () => {
        const fr = load()
        const gaps = fr.unsweptGaps(
            reportWith({
                1: { status: 'SWEPT' },
                4: { status: 'NOT_SWEPT', reason: 'no schema read was needed' },
            })
        )
        expect(gaps).toEqual([
            { layer: 4, name: 'Data schemas', reason: 'no schema read was needed', tools: ['schema_lookup'] },
        ])
    })

    test('SWEPT and UNAVAILABLE are never gaps', () => {
        const fr = load()
        const gaps = fr.unsweptGaps(
            reportWith({
                1: { status: 'UNAVAILABLE', reason: 'nothing ever ran' },
                2: { status: 'SWEPT' },
                3: { status: 'SWEPT', reason: 'read the tool definitions' },
            })
        )
        expect(gaps).toEqual([])
    })

    test('gaps come back ordered by layer number', () => {
        const fr = load()
        const gaps = fr.unsweptGaps(
            reportWith({
                5: { status: 'NOT_SWEPT', reason: 'r5' },
                2: { status: 'NOT_SWEPT', reason: 'r2' },
            })
        )
        expect(gaps.map((g) => g.layer)).toEqual([2, 5])
    })

    test('every gap carries at least one tool', () => {
        const fr = load()
        const gaps = fr.unsweptGaps(
            reportWith({
                1: { status: 'NOT_SWEPT', reason: 'r' },
                2: { status: 'NOT_SWEPT', reason: 'r' },
                3: { status: 'NOT_SWEPT', reason: 'r' },
                4: { status: 'NOT_SWEPT', reason: 'r' },
                5: { status: 'NOT_SWEPT', reason: 'r' },
                6: { status: 'NOT_SWEPT', reason: 'r' },
                7: { status: 'NOT_SWEPT', reason: 'r' },
            })
        )
        expect(gaps).toHaveLength(7)
        gaps.forEach((g) => expect(g.tools.length).toBeGreaterThan(0))
    })

    test('a layer number outside 1-7 is ignored', () => {
        const fr = load()
        const gaps = fr.unsweptGaps(reportWith({ 8: { status: 'NOT_SWEPT', reason: 'r' } }))
        expect(gaps).toEqual([])
    })

    test('a missing reason degrades to an empty string rather than throwing', () => {
        const fr = load()
        const gaps = fr.unsweptGaps(reportWith({ 4: { status: 'NOT_SWEPT' } }))
        expect(gaps).toEqual([{ layer: 4, name: 'Data schemas', reason: '', tools: ['schema_lookup'] }])
    })

    test.each([undefined, null, 'a string', 42, [], {}, { layers_swept: null }, { layers_swept: 'x' }])(
        'malformed input %p returns an empty array',
        (input) => {
            const fr = load()
            expect(fr.unsweptGaps(input)).toEqual([])
        }
    )
})
```

> `load()` is the existing helper at the top of `test/PaFixReport.test.js` that returns a fresh `PaFixReport` instance. If its name differs in that file, use whatever that file already uses — do not add a second loader.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaFixReport.test.js -t "unsweptGaps"`
Expected: FAIL — `fr.unsweptGaps is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/server/PaFixReport.js`, immediately after the `validate` method's closing `},`:

```javascript
    /**
     * The MIRROR of `_checkSweptClaims` (#79b), exposed for PaAgentLoop's
     * depth gate (issue #103).
     *
     * #79b uses `_layerToolMap()` to REFUTE a `SWEPT` claim the trail does
     * not support. This reads the same map the other way round: a layer the
     * model marked `NOT_SWEPT` is the model declaring, in its own words, a
     * gap in its own investigation — and the map says which tools close it.
     * The gate enforces that declaration against the audit trail, which is
     * what keeps the harness from ever naming a tool itself (see that
     * class's `_holdBlock`, and DECISION.md §H8 item 3 on why naming one
     * would make the acceptance test vacuous).
     *
     * `UNAVAILABLE` is deliberately NOT a gap. It is the honest report of a
     * layer that cannot be read at all — seed 05's "nothing ever ran" — and
     * #78 exists to keep that diagnosis expressible.
     *
     * PURE: no Glide, no audit query, no validation side effects. The gate
     * supplies the trail; this method only reads the draft.
     *
     * @param {*} report a fix_report draft; any shape (R-9)
     * @returns {Array} [{layer:Number, name:String, reason:String,
     *          tools:[String]}] ordered by layer number; `[]` for anything
     *          malformed.
     */
    unsweptGaps: function (report) {
        var rep = this._isPlainObject(report) ? report : {}
        var ls = this._isPlainObject(rep.layers_swept) ? rep.layers_swept : {}
        var defs = this._layerDefs()
        var map = this._layerToolMap()
        var gaps = []

        for (var i = 0; i < defs.length; i++) {
            var def = defs[i]
            var entry = ls[def.number]
            if (!this._isPlainObject(entry) || entry.status !== 'NOT_SWEPT') continue

            var tools = map[def.number] || []
            if (tools.length === 0) continue

            gaps.push({
                layer: def.number,
                name: def.name,
                reason: this._nonEmptyString(entry.reason) ? entry.reason : '',
                tools: tools,
            })
        }

        return gaps
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaFixReport.test.js`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/server/PaFixReport.js test/PaFixReport.test.js
git commit -m "feat: PaFixReport.unsweptGaps — the model's self-declared gaps (#103)"
```

---

### Task 2: `PaAgentLoop._trailTools` — `no_audit_rows` is an answer, not a degradation

**Files:**
- Modify: `src/server/PaAgentLoop.js`
- Test: `test/PaAgentLoop.test.js`

**Interfaces:**
- Consumes: existing `this._audits()` (returns the injected `auditLogger` or a real `PaAuditLogger`), `this._isArray`, `this._str`.
- Produces: `_trailTools(runId) -> {readable:Boolean, tools:[String], degraded:String}`.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaAgentLoop.test.js`. The file already has a `fakeAuditLogger(result)` helper and a `load(opts)` helper — use them, do not add new ones.

```javascript
describe('depth gate (#103) — _trailTools', () => {
    test('an available trail is readable and carries its tools', () => {
        const loop = load({ auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }) })
        expect(loop._trailTools('RUN1')).toEqual({ readable: true, tools: ['agent_trace'], degraded: '' })
    })

    test('no_audit_rows is READABLE with zero tools — the trail answered', () => {
        const loop = load({ auditLogger: fakeAuditLogger({ available: false, degraded: 'no_audit_rows', tools: [] }) })
        expect(loop._trailTools('RUN1')).toEqual({ readable: true, tools: [], degraded: 'no_audit_rows' })
    })

    test.each(['glide_unavailable', 'query_failed', 'no_run_id'])(
        'a genuine degradation (%s) is NOT readable',
        (reason) => {
            const loop = load({ auditLogger: fakeAuditLogger({ available: false, degraded: reason, tools: [] }) })
            expect(loop._trailTools('RUN1')).toEqual({ readable: false, tools: [], degraded: reason })
        }
    )

    test('a throwing audit logger degrades rather than propagating (R-1)', () => {
        const loop = load({ auditLogger: fakeAuditLogger(new Error('boom')) })
        expect(loop._trailTools('RUN1')).toEqual({ readable: false, tools: [], degraded: 'query_failed' })
    })

    test('a null result degrades', () => {
        const loop = load({ auditLogger: fakeAuditLogger(null) })
        expect(loop._trailTools('RUN1')).toEqual({ readable: false, tools: [], degraded: 'query_failed' })
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaAgentLoop.test.js -t "_trailTools"`
Expected: FAIL — `loop._trailTools is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/server/PaAgentLoop.js`, add after `_auditContext`:

```javascript
    /**
     * The depth gate's read of the audit trail (issue #103).
     *
     * WHY THIS IS NOT `_auditContext`
     * `PaAuditLogger.invokedTools()` collapses FOUR situations into
     * `available:false`, and one of them is not a degradation at all:
     * `no_audit_rows` means the query ran fine and the answer is "this run
     * has invoked nothing." For #79b's citation cross-check that distinction
     * does not matter — an unverifiable citation and an unsupported one are
     * both "do not convict." For the gate it is the whole ballgame: a run
     * that has invoked nothing is the STRONGEST possible gap, and treating
     * it as a degradation would fail open and let the zero-tool-call
     * inconclusive exit — advertised in the first prompt, per DECISION.md
     * §H7-2, and taken by five of ten runs in the §H5 pass — bypass the gate
     * entirely.
     *
     * Genuine degradations still fail OPEN, per PaAuditLogger's own header
     * ("fails toward NOT checking, never toward a false convict"). A Glide
     * hiccup must never trap a run in a hold it cannot escape.
     *
     * @param {String} runId
     * @returns {Object} {readable:Boolean, tools:[String], degraded:String}
     */
    _trailTools: function (runId) {
        var res = null
        try {
            res = this._audits().invokedTools(runId)
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            return { readable: false, tools: [], degraded: 'query_failed' }
        }

        if (res && res.available === true) {
            return {
                readable: true,
                tools: this._isArray(res.tools) ? res.tools : [],
                degraded: '',
            }
        }

        var reason = this._str(res && res.degraded ? res.degraded : 'query_failed')
        if (reason === 'no_audit_rows') {
            return { readable: true, tools: [], degraded: reason }
        }
        return { readable: false, tools: [], degraded: reason }
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaAgentLoop.test.js`
Expected: PASS, including every pre-existing test.

- [ ] **Step 5: Commit**

```bash
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "feat: _trailTools — no_audit_rows is an answer, not a degradation (#103)"
```

---

### Task 3: The gate decision — `_depthGate`

Pure decision logic over the draft and the trail. No transcript writes, no prompt rendering — those are Tasks 4 and 5.

**Files:**
- Modify: `src/server/PaAgentLoop.js`
- Test: `test/PaAgentLoop.test.js`

**Interfaces:**
- Consumes: `_trailTools` (Task 2), `PaFixReport.unsweptGaps` (Task 1) via `this._reports()`.
- Produces:
  - `_depthGate(runId, action) -> {hold:Boolean, gaps:Array, kind:String}` where `kind` is `'gaps'` or `'no_layer_report'`.
  - Instance fields initialised in `initialize`: `this._gateReleased = false`, `this._heldGaps = null`, `this._heldTools = null`.
  - Helpers `_safeGaps(report) -> Array`, `_openGaps(gaps, invoked) -> Array`, `_unionTools(gaps) -> [String]`, `_anyOf(candidates, invoked) -> Boolean`.

> **Test-boundary note.** Gap *derivation* is Task 1's job and is tested there against real `layers_swept` shapes. These tests inject the gap list directly, so they exercise the gate's decision logic only. That separation is also a hard requirement: `_reports()` falls back to `new PaFixReport()`, which is **not defined** in `PaAgentLoop`'s vm sandbox, so any loop test reaching `unsweptGaps` without an injected fake would throw a `ReferenceError`.

- [ ] **Step 1: Extend the `fakeFixReport` helper**

`fakeFixReport` at the top of `test/PaAgentLoop.test.js` has no `unsweptGaps`. Change its signature to `fakeFixReport(validateResults, gaps)` and add, beside `schemaText`:

```javascript
        // Depth gate (#103). Gap DERIVATION is PaFixReport's own concern and
        // is tested in test/PaFixReport.test.js; these loop tests inject the
        // resulting list directly so they exercise gate logic only.
        unsweptGaps: function () {
            return gaps === undefined ? [] : gaps
        },
```

Every existing `fakeFixReport(...)` call site keeps working — the new parameter is optional and defaults to no gaps, which means the gate allows.

- [ ] **Step 2: Write the failing tests**

Append to `test/PaAgentLoop.test.js`:

```javascript
describe('depth gate (#103) — _depthGate', () => {
    const GAP2 = { layer: 2, name: 'Instructions', reason: 'r2', tools: ['agent_config'] }
    const GAP4 = { layer: 4, name: 'Data schemas', reason: 'r4', tools: ['schema_lookup'] }
    const GAP5 = { layer: 5, name: 'Data', reason: 'r5', tools: ['query_table', 'log_analysis'] }
    const FIX = { action: 'fix_report', report: { layers_swept: {} } }

    function gateLoop(tools, degraded, gaps) {
        const result =
            degraded === undefined
                ? { available: true, tools: tools }
                : { available: false, degraded: degraded, tools: [] }
        return load({
            auditLogger: fakeAuditLogger(result),
            fixReport: fakeFixReport([], gaps === undefined ? [GAP2, GAP4] : gaps),
        })
    }

    test('holds when the draft declares a gap the trail shows was never closed', () => {
        const gate = gateLoop(['agent_trace'])._depthGate('RUN1', FIX)
        expect(gate.hold).toBe(true)
        expect(gate.kind).toBe('gaps')
        expect(gate.gaps.map((g) => g.layer)).toEqual([2, 4])
    })

    test('allows when every declared gap has already been closed', () => {
        const loop = gateLoop(['agent_trace', 'agent_config', 'schema_lookup'])
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('holds on the SUBSET still open when only some gaps are closed', () => {
        const gate = gateLoop(['agent_trace', 'agent_config'])._depthGate('RUN1', FIX)
        expect(gate.hold).toBe(true)
        expect(gate.gaps.map((g) => g.layer)).toEqual([4])
    })

    test('allows when the draft declares no gap at all', () => {
        expect(gateLoop(['agent_trace'], undefined, [])._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('HOLDS on no_audit_rows — zero tool calls is the strongest gap', () => {
        expect(gateLoop([], 'no_audit_rows')._depthGate('RUN1', FIX).hold).toBe(true)
    })

    test.each(['glide_unavailable', 'query_failed', 'no_run_id'])('allows on a degraded trail (%s)', (reason) => {
        expect(gateLoop([], reason)._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('an answer action is held while the gate is unreleased', () => {
        const gate = gateLoop(['agent_trace'])._depthGate('RUN1', { action: 'answer', text: 'done' })
        expect(gate.hold).toBe(true)
        expect(gate.kind).toBe('no_layer_report')
    })

    test('a throwing unsweptGaps degrades to allow rather than trapping the run (R-9)', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: {
                unsweptGaps: function () {
                    throw new Error('boom')
                },
            },
        })
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('STICKY: the recorded gap set releases the gate, and later gaps do not re-hold', () => {
        let invoked = ['agent_trace']
        let gaps = [GAP2, GAP4]
        const loop = load({
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: invoked.slice() }
                },
            },
            fixReport: {
                unsweptGaps: function () {
                    return gaps
                },
            },
        })

        // First evaluation records layers {2,4} -> tools {agent_config, schema_lookup}.
        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        // The model closes layer 2 only. That is in the recorded set.
        invoked = ['agent_trace', 'agent_config']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)

        // A later draft naming a brand-new gap must NOT re-hold: the gate
        // buys ONE forced beat, it does not chase a full sweep.
        gaps = [GAP5]
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('STICKY: re-emitting a terminal action without acting holds against the SAME set', () => {
        let gaps = [GAP2, GAP4]
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: {
                unsweptGaps: function () {
                    return gaps
                },
            },
        })
        const first = loop._depthGate('RUN1', FIX)
        // A second, narrower draft must still be judged on the original set.
        gaps = [GAP5]
        const second = loop._depthGate('RUN1', FIX)
        expect(second.hold).toBe(true)
        expect(second.gaps.map((g) => g.layer)).toEqual(first.gaps.map((g) => g.layer))
    })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest test/PaAgentLoop.test.js -t "_depthGate"`
Expected: FAIL — `loop._depthGate is not a function`.

- [ ] **Step 4: Add the instance fields**

In `src/server/PaAgentLoop.js`, inside `initialize`, after the existing `this._playbook = ...` line:

```javascript
        // Depth gate state (issue #103). A run is one synchronous
        // invocation, so instance fields are sufficient — no column, no
        // schema change. `_heldTools` is the union of tools that close the
        // gaps recorded at the FIRST hold; it is the only thing that can
        // release the gate afterwards.
        this._gateReleased = false
        this._heldGaps = null
        this._heldTools = null
```

- [ ] **Step 5: Write the gate**

Add after `_trailTools`:

```javascript
    /**
     * THE DEPTH GATE (issue #103) — the floor `run()`'s bounds are not.
     *
     * DECISION.md §O4: the custom harness swept 1/7 on all 20 rows of the v4
     * pass, and §H8's acceptance test is unmet across 45 runs. The v4 master
     * table's reframing number is not "1 tool call" but "2 LLM calls" — turn
     * 1 fetches, turn 2 concludes — so the single decision point after
     * evidence exists is taken inside the same generation that first reads
     * it. The model is not cutting an investigation short; it never begins
     * one. Nothing in this loop ever said the diagnosis was unfinished.
     *
     * WHAT RELEASES IT, AND WHY THAT AND NOTHING ELSE
     * #88 raised the COST of stopping and got fabrication, because a stop
     * priced in text is paid in text. So the gate is discharged only by
     * something the model cannot author: a row in the audit trail. And it is
     * enforced HERE, in the loop, where "not yet" can still mean "loop
     * again" — not in `PaFixReport.validate`, which fires after the run is
     * over and which #81 records the repair turn cannot act on.
     *
     * The target is the model's OWN: a layer it marked `NOT_SWEPT` is it
     * declaring a gap in its own words, and `_layerToolMap()` says which
     * tools close it. The harness never names a tool (see `_holdBlock`).
     *
     * STICKY, DELIBERATELY
     * The gap set is recorded at the FIRST hold and never re-derived. Without
     * that the goalposts move — close layer 4, declare layer 5, be held again
     * — and every run rides to `MAX_ITERATIONS`, since even native's best
     * sweep in the v4 pass was 6/7. The gate buys exactly ONE forced beat,
     * which is the size of the acceptance test. A run that then declines to
     * act rides the bounds to `outcome:'partial'`, and that tail is counted
     * rather than special-cased (issue #103, prediction P4).
     *
     * KNOWN TILT, ACCEPTED: `_layerToolMap()` gives `agent_config` three
     * layers (2, 3, 7) against one apiece for layers 4 and 5, so the cheapest
     * compliance is a single `agent_config` call — a built-in tilt AWAY from
     * the tools the acceptance test measures. Pre-registered as P7 on #103
     * rather than engineered around: if it happens the trail says so plainly,
     * and "the gate mandates depth but does not direct it" is a clean
     * finding that directs the next iteration.
     *
     * @param {String} runId
     * @param {Object} action the terminal action the model just emitted
     * @returns {Object} {hold:Boolean, gaps:Array, kind:'gaps'|'no_layer_report'}
     */
    _depthGate: function (runId, action) {
        if (this._gateReleased) return { hold: false, gaps: [], kind: '' }

        var trail = this._trailTools(runId)
        if (!trail.readable) return { hold: false, gaps: [], kind: '' }

        // Once a hold has been issued, the recorded set is the ONLY thing
        // that can release the gate — later drafts never move it.
        if (this._heldTools) {
            if (this._anyOf(this._heldTools, trail.tools)) {
                this._gateReleased = true
                return { hold: false, gaps: [], kind: '' }
            }
            return { hold: true, gaps: this._heldGaps, kind: 'gaps' }
        }

        if (!this._isPlainObject(action) || action.action !== 'fix_report') {
            // `answer` carries no `layers_swept`, so it declares no gap and
            // there is nothing to enforce against. Hold and ask for a layer
            // report; no run took this exit in the v4 pass.
            return { hold: true, gaps: [], kind: 'no_layer_report' }
        }

        var open = this._openGaps(this._safeGaps(action.report), trail.tools)
        if (open.length === 0) {
            this._gateReleased = true
            return { hold: false, gaps: [], kind: '' }
        }

        this._heldGaps = open
        this._heldTools = this._unionTools(open)
        return { hold: true, gaps: open, kind: 'gaps' }
    },

    /**
     * Gap derivation, guarded. Same reasoning as `_safeSchemaText`: a broken
     * or absent PaFixReport must degrade the GATE, never trap the run. An
     * empty list means "no declared gap", which allows — failing open, in
     * line with `_trailTools`' treatment of a degraded trail.
     */
    _safeGaps: function (report) {
        try {
            var gaps = this._reports().unsweptGaps(report)
            return this._isArray(gaps) ? gaps : []
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            return []
        }
    },

    /** Gaps whose tools the trail shows were NEVER invoked. */
    _openGaps: function (gaps, invoked) {
        var list = this._isArray(gaps) ? gaps : []
        var open = []
        for (var i = 0; i < list.length; i++) {
            if (!this._anyOf(list[i].tools, invoked)) open.push(list[i])
        }
        return open
    },

    /** Every tool that would close any of these gaps, de-duplicated. */
    _unionTools: function (gaps) {
        var out = []
        for (var i = 0; i < gaps.length; i++) {
            var tools = gaps[i].tools
            for (var j = 0; j < tools.length; j++) {
                var found = false
                for (var k = 0; k < out.length; k++) {
                    if (out[k] === tools[j]) found = true
                }
                if (!found) out.push(tools[j])
            }
        }
        return out
    },

    _anyOf: function (candidates, invoked) {
        var c = this._isArray(candidates) ? candidates : []
        var inv = this._isArray(invoked) ? invoked : []
        for (var i = 0; i < c.length; i++) {
            for (var j = 0; j < inv.length; j++) {
                if (c[i] === inv[j]) return true
            }
        }
        return false
    },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest test/PaAgentLoop.test.js`
Expected: PASS, including every pre-existing test.

- [ ] **Step 7: Commit**

```bash
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "feat: _depthGate — hold a terminal action on the model's own unswept gap (#103)"
```

---

### Task 4: The interrogation block — `_holdBlock`

The prompt-facing text. This is the payload that separates the gate from #88.

**Files:**
- Modify: `src/server/PaAgentLoop.js`
- Test: `test/PaAgentLoop.test.js`

**Interfaces:**
- Consumes: nothing beyond `this._str`.
- Produces: `_holdBlock(gaps, kind) -> String`.

- [ ] **Step 1: Write the failing tests**

```javascript
describe('depth gate (#103) — _holdBlock', () => {
    const GAPS = [
        { layer: 2, name: 'Instructions', reason: 'the trace showed no routing problem', tools: ['agent_config'] },
        { layer: 4, name: 'Data schemas', reason: 'no schema read was needed', tools: ['schema_lookup'] },
    ]

    test('announces the hold and quotes the model back to itself', () => {
        const block = load()._holdBlock(GAPS, 'gaps')
        expect(block).toContain('HOLD')
        expect(block).toContain('layer 2 (Instructions)')
        expect(block).toContain('the trace showed no routing problem')
        expect(block).toContain('layer 4 (Data schemas)')
    })

    test('states the draft is preserved and resubmittable — it defers, it does not penalise', () => {
        const block = load()._holdBlock(GAPS, 'gaps')
        expect(block).toContain('preserved')
        expect(block).toMatch(/resubmit/i)
    })

    test('asks what the last result established and what it left open', () => {
        const block = load()._holdBlock(GAPS, 'gaps')
        expect(block).toMatch(/quote/i)
        expect(block).toMatch(/did it not settle|not settle/i)
    })

    test('GUARD: never names a tool the acceptance test measures', () => {
        const block = load()._holdBlock(GAPS, 'gaps')
        expect(block).not.toContain('schema_lookup')
        expect(block).not.toContain('query_table')
        expect(block).not.toContain('genai_log')
    })

    test('GUARD: never names a tool even when a gap carries one', () => {
        const block = load()._holdBlock([{ layer: 5, name: 'Data', reason: 'r', tools: ['query_table'] }], 'gaps')
        expect(block).not.toContain('query_table')
    })

    test('the no_layer_report variant asks for a layer report', () => {
        const block = load()._holdBlock([], 'no_layer_report')
        expect(block).toContain('HOLD')
        expect(block).toMatch(/layer report|layers_swept/i)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaAgentLoop.test.js -t "_holdBlock"`
Expected: FAIL — `loop._holdBlock is not a function`.

- [ ] **Step 3: Write the implementation**

Add after `_anyOf`:

```javascript
    /**
     * The held turn's prompt block (issue #103) — the payload, and the whole
     * difference between this gate and #88.
     *
     * IT NAMES LAYERS, NEVER TOOLS. The layer names and reasons here are the
     * model's OWN `NOT_SWEPT` entries read back to it, and the tool roster is
     * already in every prompt via `PaToolRegistry.promptBlock()`. DECISION.md
     * §H8 item 3 anticipated a mandated fix and kept the acceptance test
     * unchanged — the test survives mandation only because it requires the
     * right tool ON THE SEED THAT NEEDS IT. A gate that named the measured
     * tools would be teaching to the test and would make 45 runs of evidence
     * unreadable. There is a unit test guarding this.
     *
     * ITEM 1 IS THE MISSING BEAT. §O6: on seed 01 the single `agent_trace`
     * call returned `priority_stored: null` verbatim — the exact discrepancy
     * both native runs used as primary evidence — and both custom reports
     * concluded "no errors were reported" with empty `root_causes`. The model
     * read a raw payload in the same generation in which it had to emit a
     * finished artifact, so it SUMMARISED instead of INTERROGATING. Demanding
     * a quoted field buys one generation whose job is reading.
     *
     * IT DEFERS, IT DOES NOT PENALISE. #88 raised the cost of stopping and
     * the model paid in the only currency it controls. Here the draft is
     * preserved and resubmittable unchanged; there is no way to satisfy the
     * hold by writing better. Stopping is not expensive — it is unavailable.
     */
    _holdBlock: function (gaps, kind) {
        var lines = ['## HOLD — a terminal action is not available yet', '']

        if (kind === 'no_layer_report') {
            lines.push(
                'Your last step tried to end this run without a layer report, so there is nothing ' +
                    'on record about which of the seven diagnostic layers you actually looked at.'
            )
            lines.push('')
            lines.push('Submit a fix_report whose layers_swept accounts for all seven layers, or call a tool.')
            return lines.join('\n')
        }

        lines.push('Your draft marks these layers NOT_SWEPT, each with a reason you wrote:')
        var list = this._isArray(gaps) ? gaps : []
        for (var i = 0; i < list.length; i++) {
            var g = list[i]
            lines.push('  layer ' + g.layer + ' (' + g.name + ') — "' + this._str(g.reason) + '"')
        }
        lines.push('The trail shows no tool call has reached any of them.')
        lines.push('')
        lines.push('Before concluding:')
        lines.push('  1. What did the last tool result actually establish? Quote the specific field')
        lines.push('     or value you are relying on.')
        lines.push('  2. What did it NOT settle? Of the layers above, name the one whose answer would')
        lines.push('     most change your conclusion.')
        lines.push('  3. Call a tool that reaches that layer.')
        lines.push('')
        lines.push(
            'Your draft is preserved. Once the trail shows you did, a terminal action is available ' +
                'again and you may resubmit it unchanged.'
        )
        return lines.join('\n')
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaAgentLoop.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "feat: _holdBlock — the interrogation, naming layers and never tools (#103)"
```

---

### Task 5: Wire the gate into `_step()` and `_buildPrompt()`

**Files:**
- Modify: `src/server/PaAgentLoop.js` (`_step()` at the `answer`/`fix_report` branches; `_buildPrompt()`)
- Test: `test/PaAgentLoop.test.js`

**Interfaces:**
- Consumes: `_depthGate` (Task 3), `_holdBlock` (Task 4).
- Produces: the observable end-to-end behavior — a held run loops instead of terminating, and the next prompt carries the interrogation verbatim.

- [ ] **Step 1: Write the failing tests**

```javascript
describe('depth gate (#103) — wired into the loop', () => {
    const GAP4 = {
        layer: 4,
        name: 'Data schemas',
        reason: 'no schema read was needed',
        tools: ['schema_lookup'],
    }
    const DRAFT = { action: 'fix_report', report: { layers_swept: {} } }
    const fixWith = (validateResults, gaps) => fakeFixReport(validateResults, gaps)

    test('a held fix_report loops instead of terminating, and the NEXT prompt carries the interrogation IN FULL', () => {
        const llm = fakeLlm([
            { success: true, action: DRAFT, raw: 'r1' },
            { success: true, action: { action: 'tool_call', tool: 'agent_config', args: {} }, raw: 'r2' },
        ])
        const loop = load({
            llmProxy: llm,
            fixReport: fixWith([], [GAP4]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            maxIterations: 2,
        })
        loop.run('RUN1')

        expect(llm.calls.length).toBeGreaterThanOrEqual(2)
        const second = llm.calls[1]
        expect(second).toContain('HOLD')
        expect(second).toContain('layer 4 (Data schemas)')
        expect(second).toContain('no schema read was needed')
        expect(second).toContain('most change your conclusion')
        // The #72 regression guard: the block must arrive WHOLE, not as a
        // 200-char digest stub.
        expect(second).not.toContain('more chars]')
    })

    test('the transcript keeps a SHORT audit note, under the 200-char digest ceiling', () => {
        const runs = fakeRunManager()
        const loop = load({
            runManager: runs,
            llmProxy: fakeLlm([
                { success: true, action: DRAFT, raw: 'r1' },
                { success: true, action: { action: 'tool_call', tool: 'agent_config', args: {} }, raw: 'r2' },
            ]),
            fixReport: fixWith([], [GAP4]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            maxIterations: 2,
        })
        loop.run('RUN1')

        const notes = runs.transcript.filter((e) => e.actor === 'system' && /^HOLD:/.test(e.result_digest || ''))
        expect(notes).toHaveLength(1)
        expect(notes[0].result_digest.length).toBeLessThan(200)
    })

    test('an UNHELD fix_report terminates exactly as before', () => {
        const loop = load({
            fixReport: fixWith([{ valid: true, normalized: { ok: true } }], []),
            llmProxy: fakeLlm([{ success: true, action: DRAFT, raw: 'r1' }]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
        })
        expect(loop.run('RUN1').outcome).toBe('fix_report')
    })

    test('a degraded trail does not gate — the run terminates as before', () => {
        const loop = load({
            fixReport: fixWith([{ valid: true, normalized: { ok: true } }], [GAP4]),
            llmProxy: fakeLlm([{ success: true, action: DRAFT, raw: 'r1' }]),
            auditLogger: fakeAuditLogger({ available: false, degraded: 'glide_unavailable', tools: [] }),
        })
        expect(loop.run('RUN1').outcome).toBe('fix_report')
    })

    test('a run that refuses to act rides the bounds to partial (P4, the refusal tail)', () => {
        const loop = load({
            llmProxy: fakeLlm([
                { success: true, action: DRAFT, raw: 'r1' },
                { success: true, action: DRAFT, raw: 'r2' },
                { success: true, action: DRAFT, raw: 'r3' },
            ]),
            fixReport: fixWith([], [GAP4]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            maxIterations: 3,
        })
        expect(loop.run('RUN1').outcome).toBe('partial')
    })

    test('bounds are still checked FIRST — a hold cannot outlive MAX_ITERATIONS', () => {
        const runs = fakeRunManager()
        const loop = load({
            runManager: runs,
            llmProxy: fakeLlm([{ success: true, action: DRAFT, raw: 'r1' }]),
            fixReport: fixWith([], [GAP4]),
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            maxIterations: 1,
        })
        loop.run('RUN1')
        const flags = runs.transcript.filter((e) => /INCOMPLETE/.test(e.result_digest || ''))
        expect(flags).toHaveLength(1)
    })

    test('the gate never fires on a tool_call — only on terminal actions', () => {
        const tools = fakeTools([{ success: true, data: {} }])
        const loop = load({
            toolRegistry: tools,
            llmProxy: fakeLlm([
                { success: true, action: { action: 'tool_call', tool: 'agent_trace', args: {} }, raw: 'r1' },
                { success: true, action: { action: 'answer', text: 'x' }, raw: 'r2' },
            ]),
            fixReport: fixWith([], [GAP4]),
            auditLogger: fakeAuditLogger({ available: true, tools: [] }),
            maxIterations: 2,
        })
        loop.run('RUN1')
        // One dispatch, from the tool_call turn. The gate held the `answer`
        // and the bound then ended the run — it never gated the tool_call.
        expect(tools.calls).toHaveLength(1)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaAgentLoop.test.js -t "wired into the loop"`
Expected: FAIL — the held run terminates on turn 1, so `llm.calls` has length 1 and the second-prompt assertions never find `HOLD`.

- [ ] **Step 3: Wire the gate into `_step()`**

In `src/server/PaAgentLoop.js`, replace the two terminal branches in `_step()` (currently at `:240-246`) with:

```javascript
        if (action.action === 'answer' || action.action === 'fix_report') {
            // THE DEPTH GATE (issue #103). Checked before either terminal
            // action is honored — see `_depthGate` for why it lives here and
            // not in `PaFixReport.validate`.
            var gate = this._depthGate(runId, action)
            if (gate.hold) {
                this._holdActive = this._holdBlock(gate.gaps, gate.kind)
                this._runs().appendTranscript(runId, {
                    actor: 'system',
                    result_digest: this._holdNote(gate),
                })
                return { terminal: false }
            }
            this._holdActive = null
        }

        if (action.action === 'answer') {
            return { terminal: true, outcome: this._finishAnswer(runId, action.text) }
        }

        if (action.action === 'fix_report') {
            return { terminal: true, outcome: this._handleFixReport(runId, action.report) }
        }
```

Add `this._holdActive = null` to `initialize` alongside the other gate fields, and add the note builder beside `_holdBlock`:

```javascript
    /**
     * The transcript's record of a hold — SHORT by necessity.
     *
     * `PaRunManager.appendTranscript` digests `result_digest` at
     * DIGEST_CHARS (200) and derives the 8500-char `prompt_digest` for
     * `actor:'tool'` entries ONLY. A `system` entry carrying the full
     * interrogation would therefore reach the next prompt as a 200-character
     * stub — which is the #72 / §G3a observation-channel defect, the leading
     * identified mechanical cause of the original 0/10, in a new place. So
     * the interrogation goes into the PROMPT via `_buildPrompt`, and the
     * transcript keeps this short auditable note instead.
     */
    _holdNote: function (gate) {
        if (gate.kind === 'no_layer_report') {
            return 'HOLD: terminal action refused — no layer report on record; gate unreleased.'
        }
        var nums = []
        var list = this._isArray(gate.gaps) ? gate.gaps : []
        for (var i = 0; i < list.length; i++) nums.push(list[i].layer)
        return 'HOLD: terminal action refused — layer(s) ' + nums.join(', ') + ' declared NOT_SWEPT with no tool call behind them.'
    },
```

- [ ] **Step 4: Render the hold block into the prompt**

In `_buildPrompt`, insert immediately before the `lines.push(this._responseContract())` block:

```javascript
        if (this._nonEmptyString(this._holdActive)) {
            lines.push('')
            lines.push(this._holdActive)
        }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS across the whole suite. Every pre-existing `PaAgentLoop` test must still pass — the gate is inert whenever the trail is degraded or the draft declares no open gap, and the existing suite injects no `auditLogger`, so `_audits()` falls through to a real `PaAuditLogger` whose `invokedTools` returns `glide_unavailable` under Jest. If any pre-existing test now fails, the gate is firing where it should not — fix the gate, not the test.

- [ ] **Step 6: Commit**

```bash
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "feat: wire the depth gate into _step and _buildPrompt (#103)"
```

---

### Task 6: Update the file header

`PaAgentLoop.js`'s header says bounds are the only floor. They are no longer.

**Files:**
- Modify: `src/server/PaAgentLoop.js` (header comment, lines 15–52)

**Interfaces:**
- Consumes: nothing. Produces: nothing. Documentation only.

- [ ] **Step 1: Amend THE LOOP SHAPE**

In the header's `THE LOOP SHAPE` block, change the two terminal lines to record the gate:

```
 *         action:answer     -> DEPTH GATE (#103); if held, append a hold
 *                               note and loop again — otherwise close
 *                               complete, outcome:'answer'
 *         action:fix_report -> DEPTH GATE (#103); if held, append a hold
 *                               note and loop again — otherwise validate;
 *                               invalid -> ONE repair through the proxy; ...
```

- [ ] **Step 2: Add the new section after BOUNDS ARE A FLOOR**

```
 * THE DEPTH GATE IS THE FLOOR THE BOUNDS ARE NOT (issue #103)
 * BOUNDS ARE A FLOOR above is about not stopping SILENTLY. It says nothing
 * about stopping too SOON, and MAX_ITERATIONS is a ceiling. DECISION.md §O4
 * measured the consequence: the custom harness swept 1/7 on all 20 rows of
 * the v4 pass while native ranged 1/7 to 6/7 on the same seeds the same day,
 * and §H8's acceptance test is unmet across 45 runs. The v4 master table's
 * reframing number is "2 LLM calls", not "1 tool call" — turn 1 fetches,
 * turn 2 concludes — so the only decision point after evidence exists is
 * taken in the same generation that first reads it. The model does not cut
 * an investigation short; it never begins one.
 *
 * `_depthGate` holds a terminal action while the model's OWN draft marks a
 * layer NOT_SWEPT that the audit trail shows no tool call ever reached, and
 * releases stickily once the trail shows it closed one it named itself. The
 * gate is discharged ONLY by a trail row, never by text — that is what
 * separates it from #88, where raising the price of stopping produced
 * fabrication because a stop priced in text is paid in text. See
 * `_depthGate` and `_holdBlock` for the full rationale, and issue #103 for
 * the predictions this was built against.
```

- [ ] **Step 3: Verify nothing else changed**

Run: `npm test`
Expected: PASS. Then `git diff --stat` — the only file touched is `src/server/PaAgentLoop.js`, comment lines only.

- [ ] **Step 4: Commit**

```bash
git add src/server/PaAgentLoop.js
git commit -m "docs: record the depth gate in PaAgentLoop's header (#103)"
```

---

### Task 7: Build and install to gpinst01

**Files:** none modified.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: a deployed app on gpinst01 that the smoke can fire against.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS, zero failures. Do not proceed on a red suite.

- [ ] **Step 2: Build**

Run: `now-sdk build`
Expected: success. A build failure blocks everything downstream — fix before continuing.

- [ ] **Step 3: Install**

Run: `now-sdk install --alias gpinst01`
Expected: success.

- [ ] **Step 4: Confirm the deployed code carries the gate**

Via the foundry MCP tools (`servicenow_connect` with `authType="keychain"`, then `servicenow_code`), read the installed `PaAgentLoop` Script Include and confirm the literal string `_depthGate` is present. **Do not use the shell for anything that talks to the instance** (CLAUDE.md).

Expected: found. If absent, the install did not carry the change and the smoke would measure v4 code.

---

### Task 8: The smoke — six runs

Seeds 01, 03 and 04, two runs each. These three hide their answers behind the tools with zero invocations across 45 runs (§H5). Seed 02 is deliberately excluded (§11 of the spec).

**Files:**
- Create: `benchmark/raw-evidence-v5-depth-smoke.md`

**Interfaces:**
- Consumes: Task 7's deployed app.
- Produces: six run ids with audit-derived measurements.

Execution plan sys_ids, from `benchmark/raw-evidence-v4.md:84`:

| Seed | Execution plan sys_id | Answer sits behind |
|---|---|---|
| 01 | `b07dc9082baa4314f243fed2ce91bf4b` | the layer-4 tool |
| 03 | `c4cd01842b6a4bd417a6ffbeee91bfc3` | a layer-5 tool |
| 04 | `16ddc10c2baa4314f243fed2ce91bf15` | a layer-6 tool |

- [ ] **Step 1: Record the request bodies BEFORE firing**

Create `benchmark/raw-evidence-v5-depth-smoke.md` with a header naming the app version, the date, the branch, the issue, and the six verbatim request bodies. #99 means the harness cannot recover them afterwards, so this file is the system of record.

Each body is:

```json
{"execution": "<the seed's plan sys_id>", "mode": "diagnose"}
```

- [ ] **Step 2: Fire the six runs**

For each seed, twice: `servicenow_request` method `POST`, path `/api/x_snc_troubleshoot/v1/troubleshooter/analyze`, with that seed's body. The `/v1/` segment is mandatory. Poll `GET /api/x_snc_troubleshoot/v1/troubleshooter/runs/{run_id}` until terminal.

Record per run: run id, terminal state (`complete` / `failed` / `partial`), and wall clock.

A run that never reaches terminal is a blocker — stop and escalate.

- [ ] **Step 3: Measure depth from the audit trail, not the reports**

For each run, query `x_snc_troubleshoot_audit` filtered to that run (`servicenow_query`), ordered by `sys_created_on`. Record: tool-call count, tool-call order, distinct tool names, audit-derived layer sweep via `_layerToolMap()`, and LLM-call count (`actor:'llm'` entries in the run's `x_snc_troubleshoot_run.transcript`, pulled untruncated via the Table API).

**§N7's asymmetry is binding: the trail can refute a layer credit but never confer one.** Do not read a layer credit off a report.

- [ ] **Step 4: Count the holds**

For each run, count `actor:'system'` transcript entries whose `result_digest` starts with `HOLD:`. Record the count and, for each, the layers named.

- [ ] **Step 5: The seed-01 constraint-1 readout**

For both seed-01 runs, read the delivered report (or the rejected draft) and record a plain yes/no: **does it use `priority_stored: null`?** This is prediction P5 and it is the only readout in the smoke that is about reading rather than depth.

- [ ] **Step 6: Commit the evidence**

```bash
git add benchmark/raw-evidence-v5-depth-smoke.md
git commit -m "bench: v5 depth smoke — six runs, audit-derived (#103)"
```

---

### Task 9: Score the predictions and write the record

**Files:**
- Modify: `benchmark/raw-evidence-v5-depth-smoke.md` (append the verdict table)
- Modify: `benchmark/DECISION.md` (append §P)

**Interfaces:**
- Consumes: Task 8's measurements.
- Produces: a P1–P7 verdict table and a DECISION.md section.

- [ ] **Step 1: Score each prediction HELD / REFUTED / INDETERMINATE**

Against issue #103's filed table, unedited. P2 is the headline: did any run reach the layer-4, layer-5 or layer-6 tool on the seed that needs it? That is §H8's acceptance test, and this is the first opportunity in 45 runs to answer it.

**A prediction that was wrong is recorded as wrong.** This project treats a post-hoc reading of a result as a defect and a quietly-adjusted expectation as a worse one.

- [ ] **Step 2: Apply the falsification rules from the spec**

- All six `partial` → the gate is a denial-of-service. Revert, and say so.
- Fabrication up (P6 refuted) → #88 in a new costume. Revert, and say so.
- Holds fire, gaps close, measured tools never reached → the mechanism is refuted **as specified**; the next iteration works on direction, not force.

- [ ] **Step 3: Append DECISION.md §P**

Append-only, matching §L/§M/§N's shape: what was changed, what was measured, what it establishes, and a **"What this does not establish"** subsection. That subsection must carry, at minimum: six unscored runs on three seeds, one instance, one day; no claim about gate passes and none about a rate; and that whether depth converts to score is a v5 scored pass this smoke only decides whether to fire.

- [ ] **Step 4: Comment the result on issue #103**

Post the P1–P7 verdict table and the recommendation on whether a v5 scored pass is warranted.

- [ ] **Step 5: Commit**

```bash
git add benchmark/DECISION.md benchmark/raw-evidence-v5-depth-smoke.md
git commit -m "bench: score P1-P7 against the depth smoke, DECISION.md section P (#103)"
```

---

### Task 10: Version bump and PR

**Files:**
- Modify: `package.json`, `README.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: Tasks 1–9.
- Produces: a PR ready to merge.

- [ ] **Step 1: Bump the version**

`package.json` `"version"`: `2026.08.0302` → `2026.08.0401`.
`README.md:3` badge: `version-2026.08.0302-blue` → `version-2026.08.0401-blue`.

- [ ] **Step 2: Add the CHANGELOG entry**

A `## 2026.08.0401` section covering: the depth gate, the `no_audit_rows` distinction, the interrogation-in-prompt correction, and the smoke result as scored in Task 9.

- [ ] **Step 3: Final verification**

Run: `npm test` — PASS.
Run: `now-sdk build` — success.

- [ ] **Step 4: Commit and open the PR**

```bash
git add package.json README.md CHANGELOG.md
git commit -m "chore: version 2026.08.0401 + changelog for the depth gate (#103)"
git push -u origin feature/depth-gate-agent-loop
gh pr create --title "Depth gate: a floor under PaAgentLoop's terminal action (#103)" --body-file <path to a written-out body>
```

The PR body must state the P1–P7 outcome honestly, including any refuted prediction, and must link issue #103.

---

## Self-Review

**Spec coverage.** §4 mechanism → Tasks 2, 3, 5. §4's `no_audit_rows` table → Task 2. §4 sticky release → Task 3. §4 `UNAVAILABLE` never a gap → Task 1. §4 `answer` → Task 3. §5 interrogation → Task 4 (delivery corrected, see Global Constraints). §6 files and the do-not-touch list → Global Constraints, enforced by Task 6 Step 3's `git diff --stat`. §7 tests 1–10 + 2b → Tasks 1–5, with test 10 in Task 4. §8 smoke and predictions → Tasks 8–9. §9 reading the result → Task 9 Step 1. §10 known tilt → documented in `_depthGate`'s comment; measured as P7 in Task 9. §11 limits → Task 9 Step 3.

**One spec deviation, deliberate and recorded.** Spec §4 says `answer` is "held once." This plan holds `answer` while the gate is unreleased. Held-once creates a text-priced escape — emit `answer`, absorb the hold, emit `answer` again, terminate — which contradicts the design's core principle that the only exit is a row in the trail. `answer` was taken by 0 of 20 custom rows in v4, so this is a closed door either way, and the bounds still catch a refusing run (that is the P4 tail). Flag to the user and note on #103.

**Placeholder scan.** No TBD/TODO. Every code step carries real code. The one `<path to a written-out body>` in Task 10 is an instruction to write the PR body, not a placeholder in shipped content.

**Type consistency.** `unsweptGaps` returns `{layer, name, reason, tools}` in Task 1 and is consumed with exactly those keys in Tasks 3, 4 and 5. `_trailTools` returns `{readable, tools, degraded}` in Task 2 and is read as such in Task 3. `_depthGate` returns `{hold, gaps, kind}` in Task 3 and is consumed as such in Task 5, including `_holdNote(gate)` reading `gate.kind` and `gate.gaps`. `_holdBlock(gaps, kind)` takes the same two values in Tasks 4 and 5. `_safeGaps` wraps `unsweptGaps` and is the only caller of it inside the loop.

**Two hazards found in review and fixed inline.**

1. `_depthGate` originally called `this._reports().unsweptGaps()` unguarded. `_reports()` falls back to `new PaFixReport()`, which is **not defined** in `PaAgentLoop`'s vm sandbox (`test/_loadScriptInclude.js` loads one file per context), so every loop test without an injected fake would have thrown `ReferenceError`. Fixed with `_safeGaps`, which degrades to "no gaps → allow" — the same shape as the existing `_safeSchemaText`, and consistent with `_trailTools` failing open on a degraded trail. Covered by a test in Task 3.
2. The existing `fakeFixReport` helper has no `unsweptGaps`. Task 3 Step 1 extends it with an optional second parameter, so every existing call site keeps working and defaults to no gaps (gate allows).

**A note for whoever executes Task 5.** The pre-existing `PaAgentLoop` suite injects no `auditLogger` for most tests, so `_audits()` builds a real `PaAuditLogger` — also undefined in the sandbox, which `_trailTools`' `try/catch` turns into `{readable:false}`, so the gate is inert and those tests keep passing unchanged. If a pre-existing test does start failing, the gate is firing where it should not: **fix the gate, not the test.**
