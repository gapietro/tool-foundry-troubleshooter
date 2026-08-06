# Declared-path fan-out cap + hold item 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **OUTCOME: Task 2 was REVERTED, not shipped.** The A/B in Task 4 refuted its hypothesis — six
> scenarios, twelve trials, every pair byte-identical between arms, including the one that
> reproduced the defect (S6 REFUTED). Task 4b (added during execution, not in this plan) reverted
> the wording and inverted the A/B instrument to match. **Do not re-apply Task 2.** Task 1 shipped
> as written. See `benchmark/raw-evidence-v8-hold-item1-ab.md` and DECISION.md §R6.

**Goal:** Stop the depth gate's declared path from selecting a cheap layer, and stop its hold block from offering a bare field name as a quotable unit.

**Architecture:** Two edits inside `src/server/PaAgentLoop.js`. `_selectTarget` is rewritten so the target is always drawn from the minimal-fan-out ("floor") class of open gaps, with the model's `would_confirm` declaration deciding only which member of that class wins. `_holdBlock`'s item 1 is reworded so table and field are co-salient. The hold-text edit is measured on its own by a paired A/B on the reduced instrument before the PR is opened.

**Tech Stack:** ES5 Script Includes run under Rhino on ServiceNow (no `let`/`const`/arrow functions/`Set`/`Map` in `src/`), Jest for unit tests via a `vm`-based loader (`test/_loadScriptInclude.js`), Node for the benchmark scripts, the foundry MCP tools for anything touching the instance.

**Spec:** `docs/superpowers/specs/2026-08-05-declared-path-fanout-cap-design.md`
**Issue:** #116 (predictions S1–S7 already filed)
**Branch:** `fix/declared-path-fanout-cap` (already created, spec already committed as `4d5e317`)

## Global Constraints

- **Never commit to `main`.** All work on `fix/declared-path-fanout-cap`; merge via PR.
- **`src/` is ES5/Rhino.** `var` only, no arrow functions, no `Set`/`Map`, no template literals in Script Include bodies. Test files are Node and may use modern syntax.
- **Do not touch** `PaFixReport._layerToolMap()` or `toolFanOut()` — changing the map changes the ranking and desynchronises 57 runs of evidence.
- **Do not touch** `MAX_HOLDS`, the R1/R2 ordering inside `_depthGate`, `_gapFanOut`, `_dedicatedTools`, `_unionTools`, or the `schema_lookup` contract sentence (#113/#114).
- **The hold block must never name a measured tool.** There is an existing guard test; it must keep passing.
- `_selectTarget`'s return contract is unchanged: `{layer, source, tools, fanOut}` or `null`.
- Run the full suite with `npx jest` (npm script: `npm test`). `now-sdk build` must pass before the PR.
- Version on merge: `2026.08.0503` (today is 2026-08-05; `main` is at `2026.08.0502`). If merge slips past midnight local, use `2026.08.0601`.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/server/PaAgentLoop.js` | The agent loop and the depth gate | `_selectTarget` rewritten; `_namesLayer` added; `_holdBlock` item 1 reworded; headers updated |
| `test/PaAgentLoop.test.js` | Loop + gate unit tests | 2 obsolete tests rewritten, ~5 added |
| `benchmark/scripts/build-ab-prompts.js` | Composes A/B prompt arms | gains a hold mode driven by the real `_holdBlock` |
| `benchmark/raw-evidence-v8-hold-item1-ab.md` | The A/B's verbatim record | created |
| `benchmark/DECISION.md` | The running decision record | new §R |
| `package.json`, `README.md`, `CHANGELOG.md` | Version | bumped |

---

### Task 1: `_selectTarget` draws the target from the fan-out floor

**Files:**
- Modify: `src/server/PaAgentLoop.js:916-1006` (`_selectTarget`), plus a new `_namesLayer` helper after it
- Test: `test/PaAgentLoop.test.js` — `describe('directed depth gate (#109) — target selection')` at line 1107

**Interfaces:**
- Consumes: `this._safeFanOut()` → `{toolName: Number}`; `this._safeDeclaredLayers(report)` → `Array<Number>`; `this._gapFanOut(gap, fanOut)` → `Number` (`-1` = unscorable); `this._dedicatedTools(gap, fanOut)` → `Array<String>`; `this._isArray(v)` → `Boolean`
- Produces: `_selectTarget(open, action)` → `{layer:Number, source:'declared'|'ranked', tools:Array<String>, fanOut:Number}` or `null`. `_depthGate` reads `.tools` into `_heldTools` and passes the whole object to `_holdBlock`/`_holdNote`; `null` still means "fall back to `_unionTools`".
- Produces: `_namesLayer(declared, layer)` → `Boolean`

- [ ] **Step 1: Rewrite the two tests that encode the removed rule**

Both currently assert that `would_confirm` wins outright. That is exactly the behaviour being
removed. In `test/PaAgentLoop.test.js`, replace the test at line 1195 (`'DECLARED: would_confirm
beats the ranking when it names an open gap'`) and the test at line 1237 (`'DECLARED: still
strictly outranks ranked — only the named subset is a candidate'`) with:

```javascript
    test('CAPPED (#116): would_confirm naming an above-floor layer no longer wins', () => {
        // The v6 defect in miniature. Layer 2's only tool (agent_config) has
        // fan-out 3; layer 4's schema_lookup has fan-out 1. The model named
        // layer 2, and under #109 that selected layer 2 outright — letting the
        // model choose its own cheap compliance through text it authors. The
        // floor rule makes the named layer a candidate only when it is AT the
        // floor, so structure decides here.
        const gate = gateLoop(['agent_trace'], [GAP2, GAP4], [2])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(4)
        expect(gate.target.source).toBe('ranked')
        expect(gate.target.tools).toEqual(['schema_lookup'])
    })

    test('CAPPED (#116): an unscorable named gap no longer blocks the ranked path', () => {
        // `matched` used to be set by ANY named open gap, scorable or not, so a
        // gap whose tools are absent from the fan-out map forced the undirected
        // union hold — narrow enforcement behind wording that directs at no
        // layer. An unscorable gap is not in the floor class, so ranked runs.
        const GAP_UNKNOWN = { layer: 3, name: 'Tool definitions', reason: 'r3', tools: ['no_such_tool'] }
        const gate = gateLoop(['agent_trace'], [GAP_UNKNOWN, GAP4], [3])._depthGate('RUN1', FIX)
        expect(gate.target).not.toBe(null)
        expect(gate.target.layer).toBe(4)
        expect(gate.target.source).toBe('ranked')
    })
```

- [ ] **Step 2: Add the floor-class and v6 regression tests**

Append these inside the same `describe`, after the test added in Step 1:

```javascript
    test('CAPPED (#116): a named layer AT the floor still wins, and is still sourced declared', () => {
        // Direction survives the cap: layers 4 and 5 both sit at fan-out 1, so
        // the model's naming of layer 5 decides between equals even though the
        // ranked tie-break alone would take layer 4.
        const gate = gateLoop(['agent_trace'], [GAP4, GAP5], [5])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(5)
        expect(gate.target.source).toBe('declared')
        expect(gate.target.tools).toEqual(['query_table'])
    })

    test('CAPPED (#116): when every open gap is cheap, the cap does nothing', () => {
        // Floor 3, and the model named a floor member. There is no better layer
        // to insist on, so declared stands.
        const GAP3 = { layer: 3, name: 'Tool definitions', reason: 'r3', tools: ['agent_config'] }
        const gate = gateLoop(['agent_trace'], [GAP2, GAP3], [3])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(3)
        expect(gate.target.source).toBe('declared')
        expect(gate.target.fanOut).toBe(3)
    })

    test('#116 REGRESSION on verbatim v6 data: both seed-04 holds flip to layer 4', () => {
        // The gap sets and the declared layer are read from the verbatim
        // _holdNote strings in x_snc_troubleshoot_run on gpinst01:
        //   TR1000152 "layer 3 (declared) must be reached; layer(s) 2, 3, 4, 5, 7 ..."
        //   TR1000153 "layer 3 (declared) must be reached; layer(s) 2, 3, 4, 5, 6, 7 ..."
        // Both released on agent_config under #109. Seed 04's answer sits
        // behind layer 6 and this does NOT reach it (S3/S4) — layers 4 and 5
        // tie at the floor and the tie breaks low. What changes is that the
        // model can no longer nominate layer 3's agent_config.
        const GAP3 = { layer: 3, name: 'Tool definitions', reason: 'r3', tools: ['agent_config'] }
        const GAP7 = { layer: 7, name: 'Trigger and wiring', reason: 'r7', tools: ['agent_config'] }

        const tr152 = gateLoop(['agent_trace', 'read_artifact'], [GAP2, GAP3, GAP4, GAP5, GAP7], [3])._depthGate('RUN1', FIX)
        expect(tr152.target.layer).toBe(4)
        expect(tr152.target.source).toBe('ranked')
        expect(tr152.target.tools).toEqual(['schema_lookup'])

        const tr153 = gateLoop(['agent_trace'], [GAP2, GAP3, GAP4, GAP5, GAP6, GAP7], [3])._depthGate('RUN1', FIX)
        expect(tr153.target.layer).toBe(4)
        expect(tr153.target.source).toBe('ranked')
        expect(tr153.target.tools).toEqual(['schema_lookup'])
    })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest test/PaAgentLoop.test.js -t 'CAPPED' && npx jest test/PaAgentLoop.test.js -t 'REGRESSION on verbatim v6'`

Expected: FAIL. The two `CAPPED` tests rewritten in Step 1 fail with `Expected: 4, Received: 2`
(and `'ranked'` vs `'declared'`); the unscorable test fails with `expect(received).not.toBe(null)`;
the v6 regression fails with `Expected: 4, Received: 3`. The two tests added in Step 2 that assert
`declared` still wins should already PASS — they describe behaviour the floor rule preserves.

- [ ] **Step 4: Replace the body of `_selectTarget`**

In `src/server/PaAgentLoop.js`, replace the body of `_selectTarget` (everything between the
`_selectTarget: function (open, action) {` line at 916 and its closing `},` at 1006) with:

```javascript
    _selectTarget: function (open, action) {
        var fanOut = this._safeFanOut()
        var report = this._isPlainObject(action) ? action.report : null
        var declared = this._safeDeclaredLayers(report)
        var i

        // 1. THE FLOOR — the best fan-out any open gap offers. Unscorable gaps
        //    (-1: an unknown tool, or a degraded map) contribute nothing, the
        //    same treatment both #109 ranking loops gave them.
        var floor = -1
        for (i = 0; i < open.length; i++) {
            var score = this._gapFanOut(open[i], fanOut)
            if (score === -1) continue
            if (floor === -1 || score < floor) floor = score
        }
        if (floor === -1) return null

        // 2. DECLARED GETS FIRST REFUSAL, BUT ONLY WITHIN THE FLOOR CLASS
        //    (#116). Under #109 a named open gap won outright, and DECISION.md
        //    §Q4 measured what that buys: on both seed-04 runs the model named
        //    layer 3, whose agent_config has fan-out 3, while layers 4 and 5
        //    sat open at fan-out 1 — the model selecting its own cheap
        //    compliance through text it authors. Restricting candidacy to the
        //    floor keeps the model's declaration deciding between EQUALS,
        //    which is what makes this gate direction rather than force, and
        //    removes its power to nominate a cheaper layer than the run has
        //    available.
        var chosen = null
        var source = 'ranked'
        for (i = 0; i < open.length; i++) {
            if (this._gapFanOut(open[i], fanOut) !== floor) continue
            if (!this._namesLayer(declared, open[i].layer)) continue
            if (chosen === null || open[i].layer < chosen.layer) {
                chosen = open[i]
                source = 'declared'
            }
        }

        // 3. STRUCTURE DECIDES WHEN THE DECLARATION DECLINES. Every member of
        //    the floor class scores identically by construction, so the only
        //    live comparison is the tie-break: lowest layer number, by an
        //    explicit comparison rather than by trusting `open`'s order.
        //
        //    #116 also RETIRES #109's `matched` flag. It was set by any named
        //    open gap, scorable or not, and blocked this fallback — so a gap
        //    whose tools are missing from the map produced the undirected
        //    union hold. An unscorable gap simply is not in the floor class
        //    now, so this path runs and the hold stays directed. Unreachable
        //    in production (every tool in `_layerToolMap` is scorable and
        //    `_openGaps` drops malformed gaps); it is a degraded-path
        //    improvement, not a measured one.
        if (chosen === null) {
            for (i = 0; i < open.length; i++) {
                if (this._gapFanOut(open[i], fanOut) !== floor) continue
                if (chosen === null || open[i].layer < chosen.layer) chosen = open[i]
            }
        }

        if (chosen === null) return null

        // I2 (#109, unchanged): selection and rendering must agree on what a
        // usable target is. `_holdBlock`/`_holdNote` require a numeric layer
        // and fall back to the UNDIRECTED wording otherwise, so a
        // contract-violating layer is rejected HERE — otherwise the gate
        // enforces narrowly behind wording that directs at nothing. `NaN` is
        // `typeof 'number'` and every `<` comparison against it is false, so
        // it survives the loops above; `isFinite` is what excludes it.
        if (typeof chosen.layer !== 'number' || !isFinite(chosen.layer)) return null

        var tools = this._dedicatedTools(chosen, fanOut)
        if (tools.length === 0) return null

        // I3 (#109, unchanged): the fan-out travels WITH the target so
        // `_holdBlock` can choose its item-2 wording without re-deriving it.
        // `floor` IS the chosen gap's own score — the chosen gap is a floor
        // member by construction.
        return { layer: chosen.layer, source: source, tools: tools, fanOut: floor }
    },

    /**
     * Whether `would_confirm` named this layer. `_safeDeclaredLayers` already
     * guarantees an array, but this applies the same per-call guard as every
     * other list walker in this file rather than trusting a collaborator.
     */
    _namesLayer: function (declared, layer) {
        var list = this._isArray(declared) ? declared : []
        for (var i = 0; i < list.length; i++) {
            if (list[i] === layer) return true
        }
        return false
    },
```

- [ ] **Step 5: Update `_selectTarget`'s doc header**

The header above `_selectTarget` (lines 856–915) still documents `PRECEDENCE` as "the model's OWN
`would_confirm` layer wins when it names an open gap". Replace that paragraph — keep `WHY ONE`,
`THE RANK NEVER MENTIONS A TOOL NAME`, `COST IS AT MOST TWO FORCED BEATS` and the `@param`/
`@returns` block as they are — with:

```
     * PRECEDENCE, CAPPED AT THE FLOOR (#116). The target is always drawn from
     * the minimal-fan-out class of open gaps; the model's own `would_confirm`
     * decides WHICH MEMBER of that class, and nothing else. Ties inside the
     * class break on the lowest layer number.
     *
     * #109 let a named open gap win outright, and DECISION.md §Q4 measured the
     * cost: `would_confirm` carried 4 of 6 holds, and twice it steered the run
     * to a cheap layer — both seed-04 runs named layer 3 (agent_config,
     * fan-out 3) while layers 4 and 5 sat open at fan-out 1, and agent_config
     * legitimately discharged the hold. That was pre-registered as a design
     * property rather than a defect, on the grounds that binding the gate to
     * the model's own stated gap is the purest direction available. The cap
     * keeps that — the model still chooses among EQUALS — while removing its
     * power to nominate a layer cheaper than the run has available.
     *
     * WHAT THE CAP DOES NOT DO, stated so its absence is not read as failure:
     * it does not make layer 6 reachable. Layers 1, 4 and 5 score 1 and layer
     * 6 scores 2, so layer 6 is targeted only once 4 and 5 are both closed —
     * and layer 1 always closes on the opening `agent_trace`. With MAX_HOLDS
     * at 2 there is no budget for that. `genai_log` and `log_analysis` stay
     * unreached; issue #116 files this as S3/S4. The alternative — a tie-break
     * that prefers layer 6 — was rejected because no structural argument picks
     * it over layer 4 other than "that is where the unreached tool is", which
     * forfeits §H8 item 3's non-vacuity condition.
```

- [ ] **Step 6: Run the whole suite**

Run: `npx jest test/PaAgentLoop.test.js`
Expected: PASS, all tests. Pay attention to `STICKY`, `FALLBACK`, both `R-9` tests and the
`capped depth gate (C1)` describe — none should have moved.

- [ ] **Step 7: Run the full test suite**

Run: `npx jest`
Expected: PASS. `PaFixReport.test.js` in particular must be untouched — the layer map did not change.

- [ ] **Step 8: Commit**

```bash
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "fix: the declared path could select a layer cheaper than the run had available (#116)

_selectTarget now draws the target from the minimal-fan-out class of open
gaps; would_confirm decides which member of that class and nothing else.
DECISION.md Q4 measured the old rule steering two of six runs to a cheap
layer through text the model authors.

Retires the \`matched\` flag: an unscorable named gap no longer blocks the
ranked fallback into the undirected union hold.

Regression-tested against the verbatim v6 hold records for TR1000152 and
TR1000153. Does NOT make layer 6 reachable - filed as S3/S4 on #116.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `_holdBlock` item 1 stops offering a bare field

> **OUTCOME: Task 2 was REVERTED, not shipped.** The A/B in Task 4 refuted its hypothesis — six
> scenarios, twelve trials, every pair byte-identical between arms, including the one that
> reproduced the defect (S6 REFUTED). Task 4b (added during execution, not in this plan) reverted
> the wording and inverted the A/B instrument to match. **Do not re-apply Task 2.** Task 1 shipped
> as written. See `benchmark/raw-evidence-v8-hold-item1-ab.md` and DECISION.md §R6.

**Files:**
- Modify: `src/server/PaAgentLoop.js:1110-1111` (item 1 inside `_holdBlock`), plus its doc header
- Test: `test/PaAgentLoop.test.js` — `describe('depth gate (#103) — _holdBlock')` at line 1691

**Interfaces:**
- Consumes: nothing new.
- Produces: `_holdBlock(gaps, kind, target)` still returns a `String`; only item 1's two lines change. The A/B script in Task 3 depends on the exact new wording — if you reword it differently from what is written here, Task 3's `NEW_ITEM1` constant must match character for character.

- [ ] **Step 1: Write the failing test**

Append inside `describe('depth gate (#103) — _holdBlock')`:

```javascript
    test('#116: item 1 does not offer a bare field as a quotable unit', () => {
        // v7 §4 measured the hold pushing schema_lookup arguments onto bare
        // scalars, and C4/C5 returned "priority" and "assignment_group" — bare
        // FIELD names with the table dropped, which no lexical guard can catch
        // because both are valid table names. Item 1 named `field` as a
        // standalone quotable unit three lines above "Call a tool that reaches
        // layer N", in a block that renders LAST in the prompt. This makes the
        // table and the field co-salient instead.
        const block = load()._holdBlock(GAPS, 'gaps')
        expect(block).toContain('Quote the specific value you')
        expect(block).toContain('the table and field it came from')
        expect(block).not.toMatch(/Quote the specific field/i)
    })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest test/PaAgentLoop.test.js -t 'item 1 does not offer a bare field'`
Expected: FAIL — `expect(received).toContain('Quote the specific value you')`.

- [ ] **Step 3: Reword item 1**

In `src/server/PaAgentLoop.js`, replace lines 1110–1111:

```javascript
        lines.push('  1. What did the last tool result actually establish? Quote the specific value you')
        lines.push('     are relying on, and the table and field it came from.')
```

- [ ] **Step 4: Document why, in `_holdBlock`'s header**

`_holdBlock`'s header has an `ITEM 1 IS THE MISSING BEAT` paragraph (around line 1062). Append
directly after it:

```
     * ITEM 1 NAMES A VALUE, NOT A FIELD (#116). It used to say "quote the
     * specific FIELD or value", which offered a bare field name as a
     * legitimate quotable unit three lines above "Call a tool that reaches
     * layer N" — in a block that renders LAST in the prompt, after
     * `_responseContract()`, by the M3 ordering below. v7 §4 measured the
     * consequence on the real model seam: without a hold, 3 of 3 trials
     * produced well-formed JSON; with a hold, 3 of 3 degraded to bare scalars,
     * two of them dropping the table entirely (`"priority"`,
     * `"assignment_group"` — both lexically valid table names, so
     * `_normalizeArgs` cannot tell them from a real one). Naming the value and
     * its table together removes the standalone-field reading. This does NOT
     * try to push arguments back to object form: v7's R3 was refuted on
     * exactly that point, both arms stayed scalar, and a bare scalar is legal
     * for the tool in question. The defect is WHICH scalar, not that it is one.
```

- [ ] **Step 5: Run the hold-block tests**

Run: `npx jest test/PaAgentLoop.test.js -t '_holdBlock'`
Expected: PASS, including the existing guard that the block names no measured tool.

- [ ] **Step 6: Run the full suite and the build**

Run: `npx jest && npm run build`
Expected: all tests PASS; `now-sdk build` succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "fix: the hold block offered a bare field name as a quotable unit (#116)

v7 section 4: without a hold, 3 of 3 trials produced well-formed JSON; with
a hold, 3 of 3 degraded, two dropping the table entirely. Item 1 named
'field' as a standalone quotable unit in the block that renders last in the
prompt. Item 1 now names the value and the table and field it came from.

Not an attempt to restore the object form - v7's R3 refuted that; bare
scalars are legal here and the defect is which scalar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: the A/B instrument grows a hold mode

**Files:**
- Modify: `benchmark/scripts/build-ab-prompts.js`

**Interfaces:**
- Consumes: `loadScriptInclude('PaAgentLoop.js', {JSON: JSON})` from `test/_loadScriptInclude`, then `new ctx.PaAgentLoop({})._holdBlock(gaps, 'gaps', target)`. The reworded item 1 from Task 2 must already be in the source.
- Produces: with `--hold`, writes `<out-dir>/<scenarioId>.<arm>.prompt.txt` for each of 6 scenarios × 2 arms = 12 files, and prints one line per file. Exits non-zero unless every pair differs only in item 1's two lines.

- [ ] **Step 1: Add the item-1 constants and the scenario table**

Add near the existing `NEW_CONTRACT`/`OLD_CONTRACT` constants. `NEW_ITEM1` must match Task 2's
wording character for character — the differ-only guard in Step 4 is what catches a mismatch.

```javascript
// The hold-block variable under test (#116). NEW_ITEM1 is what `_holdBlock`
// emits after Task 2; OLD_ITEM1 is what it emitted through v6 and v7, and is
// substituted back in to build the control arm. Composing the control by
// substitution rather than by hand is what makes the arms provably identical
// everywhere else.
const NEW_ITEM1 =
    '  1. What did the last tool result actually establish? Quote the specific value you\n' +
    '     are relying on, and the table and field it came from.'

const OLD_ITEM1 =
    '  1. What did the last tool result actually establish? Quote the specific field\n' +
    '     or value you are relying on.'

// The gap set and target handed to `_holdBlock`. Layer 4 at fan-out 1 is the
// shape that directs a run at schema_lookup, which is the tool whose contract
// permits a bare scalar and therefore the one where the degradation shows.
const HOLD_GAPS = [
    { layer: 4, name: 'Data schemas', reason: 'no schema read was needed', tools: ['schema_lookup'] },
]
const HOLD_TARGET = { layer: 4, source: 'ranked', tools: ['schema_lookup'], fanOut: 1 }

// Six paired scenarios. The model is deterministic at production temperature
// (v7 §2), so N is the number of SCENARIOS — repeats of one prompt carry the
// information of one. `tableInEvidence: false` means the trace names the field
// but never its table, which is the C4/C5 shape where the table was dropped.
const SCENARIOS = [
    { id: 's1', table: 'sn_aia_tool', field: 'u_routing_key', tableInEvidence: true },   // = v7 C6
    { id: 's2', table: 'incident', field: 'priority', tableInEvidence: false },          // = v7 C4
    { id: 's3', table: 'task', field: 'assignment_group', tableInEvidence: false },      // = v7 C5
    { id: 's4', table: 'cmdb_ci_server', field: 'u_owner_group', tableInEvidence: true },
    { id: 's5', table: 'sc_req_item', field: 'u_fulfilment_stage', tableInEvidence: true },
    { id: 's6', table: 'change_request', field: 'u_risk_band', tableInEvidence: false },
]
```

- [ ] **Step 2: Make `TRACE_RESULT` and `buildPrompt` scenario-driven**

Replace the module-level `const TRACE_RESULT = [...]` with a function, and give `buildPrompt` a
scenario plus an optional hold block. Keep every other line of the existing prompt composition
exactly as it is — it is the instrument v7 measured on.

```javascript
function traceResult(scenario) {
    const where = scenario.tableInEvidence ? ' off table ' + scenario.table : ''
    return [
        'status: completed. 1 tool call, no error raised.',
        '',
        'tool_calls:',
        '  #1 lookup_routing_rule (' + scenario.table + ') status=success',
        '     the script read field ' + scenario.field + where + ', got back an empty',
        '     string, branched on it and returned no rows.',
    ].join('\n')
}

function buildPrompt(contract, scenario, holdBlock) {
    const tool = schemaLookupDescription(contract)
    const lines = [
        'You are Agent Doctor. You diagnose failing ServiceNow AI Agent executions.',
        '',
        'A field that read back blank is a layer-4 question: confirm the column exists before',
        'concluding anything about the blank.',
        '',
        '## Available tools',
        '',
        'schema_lookup (' + tool.layer + '): ' + tool.description,
        '',
        '## Diagnostic request',
        '',
        'execution: ' + EXECUTION,
        '',
        '## Transcript so far',
        '',
        '#1 [tool:agent_trace] args={"execution":"' + EXECUTION + '"}',
        'result:',
        traceResult(scenario),
        '',
        '## Response format',
        '',
        'Respond with exactly one JSON object and nothing else - no prose, no markdown fence. It must be one of:',
        '',
        '  {"action":"tool_call","tool":"<tool name>","args":{...}}',
        '  {"action":"answer","text":"<final answer, once no further tool call is needed>"}',
        '  {"action":"fix_report","report":{...}}',
    ]
    if (holdBlock) {
        lines.push('')
        lines.push(holdBlock)
    }
    return lines.join('\n')
}
```

Note the `tableInEvidence: false` scenarios still name the table in the `tool_calls` header line —
that mirrors v7's C4/C5, where the table appeared as the tool's own scope but never as the table
the field was read from.

- [ ] **Step 3: Compose the hold arms from the real `_holdBlock`**

Add below `buildPrompt`:

```javascript
// The treatment arm's hold is the DEPLOYED text, read out of PaAgentLoop
// rather than retyped — the v7 hold arms were composed ad hoc and are not
// reproducible from the repo, which is what this closes.
function holdArms() {
    const ctx = loadScriptInclude('PaAgentLoop.js', { JSON: JSON })
    const treatment = new ctx.PaAgentLoop({})._holdBlock(HOLD_GAPS, 'gaps', HOLD_TARGET)
    if (treatment.indexOf(NEW_ITEM1) === -1) {
        throw new Error('_holdBlock does not carry NEW_ITEM1 — Task 2 not applied, or the wording drifted')
    }
    return { treatment: treatment, control: treatment.split(NEW_ITEM1).join(OLD_ITEM1) }
}
```

- [ ] **Step 4: Branch the CLI on `--hold`**

Replace the trailing driver block (from `const outDir = process.argv[2]` to the end) with:

```javascript
const outDir = process.argv[2]
const holdMode = process.argv.indexOf('--hold') !== -1

function write(name, text) {
    fs.writeFileSync(path.join(outDir, name + '.prompt.txt'), text)
    console.log(name, text.length, 'chars')
}

if (!holdMode) {
    // #111's contract A/B, unchanged.
    const arms = { control: OLD_CONTRACT, treatment: NEW_CONTRACT }
    const written = {}
    for (const [arm, contract] of Object.entries(arms)) {
        written[arm] = buildPrompt(contract, SCENARIOS[0], null)
        write(arm, written[arm])
    }
    const same = written.control.split(OLD_CONTRACT).join('@@') === written.treatment.split(NEW_CONTRACT).join('@@')
    console.log('arms differ ONLY in the contract sentence:', same)
    if (!same) process.exit(1)
} else {
    // #116's hold-item-1 A/B. BOTH arms carry the DEPLOYED contract, so the
    // only free variable is item 1.
    const hold = holdArms()
    let allSame = true
    for (const scenario of SCENARIOS) {
        const control = buildPrompt(NEW_CONTRACT, scenario, hold.control)
        const treatment = buildPrompt(NEW_CONTRACT, scenario, hold.treatment)
        write(scenario.id + '.control', control)
        write(scenario.id + '.treatment', treatment)
        const same = control.split(OLD_ITEM1).join('@@') === treatment.split(NEW_ITEM1).join('@@')
        console.log(scenario.id, 'differs ONLY in item 1:', same)
        if (!same) allSame = false
    }
    if (!allSame) process.exit(1)
}
```

- [ ] **Step 5: Run it and verify the invariant holds**

```bash
mkdir -p /tmp/ab116 && node benchmark/scripts/build-ab-prompts.js /tmp/ab116 --hold
```

Expected: 12 files written; `differs ONLY in item 1: true` on all six lines; exit code 0. Then
confirm by eye that the difference is the one intended:

```bash
diff /tmp/ab116/s1.control.prompt.txt /tmp/ab116/s1.treatment.prompt.txt
```

Expected: exactly the two item-1 lines, nothing else.

- [ ] **Step 6: Verify the legacy mode still works**

Run: `node benchmark/scripts/build-ab-prompts.js /tmp/ab116`
Expected: `arms differ ONLY in the contract sentence: true`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add benchmark/scripts/build-ab-prompts.js
git commit -m "bench: A/B instrument gains a hold mode driven by the real _holdBlock (#116)

Six paired scenarios, both arms carrying the deployed #113/#114 contract so
item 1 is the only free variable. The treatment arm's hold block is read out
of PaAgentLoop via loadScriptInclude rather than retyped - the v7 hold arms
were composed ad hoc and are not reproducible from the repo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: run the A/B and write the evidence

**Files:**
- Create: `benchmark/raw-evidence-v8-hold-item1-ab.md`

**Interfaces:**
- Consumes: the 12 prompt files from Task 3.
- Produces: an evidence file scoring S5, S6 and S7 from issue #116.

- [ ] **Step 1: Connect to the instance**

Use the foundry MCP tools, never the shell — `servicenow_connect` with
`instance: "gpinst01.service-now.com"`, `authType: "keychain"`, `username: "admin"`.

- [ ] **Step 2: Run all 12 trials**

For each of the 12 files, invoke the `pa llm reason` NASK skill — capability
`0bf0bc13a7414399a1482d21de01231d`, the same seam `PaLlmProxy._invokeNask` uses — passing the file
contents as the `prompt` input. Load the tool with
`ToolSearch("select:mcp__foundry__servicenow_skill_execute")` and read its schema before the first
call.

Record for each trial, verbatim and untouched: the scenario id, the arm, the full `args` value the
model returned, and the latency. **No tool executes**, so no `x_snc_troubleshoot_audit` rows are
written and the trail the scored pass reads stays clean. Confirm that afterwards:

```
servicenow_query table=x_snc_troubleshoot_audit query=sys_created_on>=javascript:gs.hoursAgoStart(1)
```

Expected: no new rows attributable to this run.

- [ ] **Step 3: Classify every trial**

Each returned `args` is exactly one of:

| Class | Meaning |
|---|---|
| `dotted-correct` | `table.field`, both real names |
| `object` | a JSON object with `table`/`field` |
| `bare-table` | a lone table name, field omitted — legal, the contract permits it |
| **`table-omitted`** | a lone field name, no table — the C4/C5 defect |
| `parameter-prefixed` | carries the literal word `table` or `field` — the #111/#114 defect |

- [ ] **Step 4: Write the evidence file**

Create `benchmark/raw-evidence-v8-hold-item1-ab.md`, following the structure of
`benchmark/raw-evidence-v7-contract-ab.md`: what the instrument is and is not; every trial in one
table with arguments verbatim; the finding; the predictions scored; what it establishes and what
it does not.

It must state, in these terms:

- **The S5 fail-safe.** If the control arm produced no `table-omitted` argument, **the instrument
  is too reduced to test anything and the run licenses no claim about the treatment.** Say so
  plainly and do not score S6 as a pass in that case.
- **Six paired scenarios is a demonstration, not a rate.** One model, one day, one reduced
  instrument. Rule-of-three on six observations is still a worthless bound. Do not write
  "verified".
- **The full-size prompt is untested**, unchanged from v7 §8.

- [ ] **Step 5: Commit**

```bash
git add benchmark/raw-evidence-v8-hold-item1-ab.md
git commit -m "bench: v8 hold-item-1 A/B, six paired scenarios (#116)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: DECISION.md §R, version bump, PR

**Files:**
- Modify: `benchmark/DECISION.md` (append §R after §Q, which ends at line 2153)
- Modify: `package.json` (`version`), `README.md:3` (badge), `CHANGELOG.md` (new entry at the top of the entry list)

**Interfaces:**
- Consumes: the Task 4 evidence file and the Task 1 regression test's result.
- Produces: nothing code depends on.

- [ ] **Step 1: Write DECISION.md §R**

Append after §Q, matching §Q's structure (`### R1. What was run`, `### R2. The scored predictions`,
… `### R7. Recommendation`). It must carry:

- **R1** — what was run: unit-level retro-application of the floor rule to the verbatim v6 hold
  records, plus the 12-trial paired A/B. **No e2e smoke, no scored pass.**
- **R2** — S1–S7 scored in a table, in the §Q2 format, with the measured value beside each.
- **R3** — the retro-application: the cap flips exactly the two seed-04 holds, both to layer 4,
  and regresses nothing else in v6.
- **R4** — **`genai_log` and `log_analysis` remain unreached, by construction, and this was
  pre-registered.** Anyone reading their continued absence as this change failing has misread it.
  Give the structural reason (floor 1 at layers 1/4/5, layer 6 at 2, `MAX_HOLDS` 2).
- **R5** — the declared/ranked split inverts by construction and is **not comparable to §Q2's**.
- **R6** — what this does not establish: nothing about correctness, no rate for the hold-text
  change, nothing about the full-size prompt, nothing about native, nothing about seeds 02 and 05.
- **R7** — recommendation: the scored pass §Q7 asks for, on seeds 01/03/04 with independent
  per-row scorers, now that the declared-path question is settled.

- [ ] **Step 2: Bump the version in three places**

```bash
node -e "const f='package.json',j=require('./'+f);j.version='2026.08.0503';require('fs').writeFileSync(f,JSON.stringify(j,null,2)+'\n')"
```

Then edit `README.md:3` to `![Version](https://img.shields.io/badge/version-2026.08.0503-blue)`,
and add a `CHANGELOG.md` entry at the top of the entry list — matching the existing entry format —
covering both changes, the A/B result, and the S3/S4 non-effect on layer 6.

- [ ] **Step 3: Verify the bump is consistent**

Run: `grep -rn "2026\.08\.0503" package.json README.md CHANGELOG.md`
Expected: one hit in each of the three files.

- [ ] **Step 4: Full verification before the PR**

Run: `npx jest && npm run build`
Expected: all tests PASS; `now-sdk build` succeeds. Do not open the PR on a failing build.

- [ ] **Step 5: Commit and push**

```bash
git add benchmark/DECISION.md package.json README.md CHANGELOG.md
git commit -m "bench: DECISION.md section R + version 2026.08.0503 (#116)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin fix/declared-path-fanout-cap
```

- [ ] **Step 6: Open the PR**

```bash
gh pr create --title "fix: cap the declared path at the fan-out floor, and stop item 1 pulling arguments off the table" --body "$(cat <<'EOF'
Closes #116.

Two edits to how the depth gate directs the model, landed together because they are the same
change and because #111 became unattributable by arriving alongside another change without
disjoint observables.

**Change A — `_selectTarget`.** The target is always drawn from the minimal-fan-out class of open
gaps; `would_confirm` decides which member of that class and nothing else. Retro-applied to the
verbatim v6 hold records this flips exactly the two seed-04 holds (layer 3 → layer 4) and
regresses nothing. Also retires the `matched` flag, so an unscorable named gap no longer forces
the undirected union hold.

**Change B — `_holdBlock` item 1.** Stops offering a bare field name as a quotable unit. Measured
on its own by a paired A/B before this PR: see `benchmark/raw-evidence-v8-hold-item1-ab.md`.

**What this does NOT do, pre-registered as S3/S4:** it does not make layer 6 reachable, so
`genai_log` and `log_analysis` stay unreached. Layers 1/4/5 sit at fan-out 1 and layer 6 at 2, and
`MAX_HOLDS = 2` does not fund closing 4 and 5 first. A tie-break that preferred layer 6 was
rejected — no structural argument picks it over layer 4 other than "that is where the unreached
tool is", which forfeits §H8 item 3's non-vacuity condition.

Predictions S1–S7 were filed on #116 before any code was written; scored in DECISION.md §R.

Design: `docs/superpowers/specs/2026-08-05-declared-path-fanout-cap-design.md`
Plan: `docs/superpowers/plans/2026-08-05-declared-path-fanout-cap.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: Deploy after merge**

Once merged, from `main`: `now-sdk build && now-sdk install --alias gpinst01`. Then verify the
deploy the way §Q1 did — read the installed `PaAgentLoop` body back through the MCP broker and
match a literal source string from the new `_selectTarget` (e.g. `THE FLOOR`). Expect
`sys_updated_on` to read a stale timestamp; §P1/§Q1 recorded that twice and it is this record's
normal behaviour, not a failed install.

---

## Self-Review

**Spec coverage.** §3 Change A → Task 1. §3.1 both consequences → Task 1 Steps 1, 4, 5. §3.2
`fanOut` wording → Task 1 Step 4 (`fanOut: floor`) plus the untouched `_holdBlock` branches. §4
rejected alternatives → recorded in Task 1 Step 5's header text. §5 Change B → Task 2. §6 A/B →
Tasks 3 and 4. §7 predictions → scored in Task 5 Step 1. §8 attribution → Task 4 Step 2's audit
check and Task 5's §R. §9 files → all five appear in a task. §10 tests 1–8 → Task 1 Steps 1–2
(floor, declared-at-floor, declared-above-floor, unscorable, ties, v6 regression) with 6 and 7
(union fallback, `NaN`) covered by the existing `FALLBACK` / `R-9` / I2 tests that Task 1 Step 6
re-runs. §10 tests 9–10 → Task 2 Step 1 and Step 5. §11 limits → Task 4 Step 4 and Task 5 §R6.

**Placeholder scan.** No TBD/TODO. Every code step carries the literal code. The one
judgement-dependent artifact is the Task 4 evidence file, whose required content is enumerated
rather than left to taste.

**Type consistency.** `_selectTarget` returns `{layer, source, tools, fanOut}` in Task 1 and is
consumed as such by `_holdBlock(gaps, kind, target)` in Task 2 and by `HOLD_TARGET` in Task 3.
`_namesLayer(declared, layer)` is defined once and called once. `NEW_ITEM1` in Task 3 is the exact
string written in Task 2 Step 3, and Task 3's `holdArms()` throws if they ever drift.
