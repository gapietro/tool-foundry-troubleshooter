# Declared-path fan-out cap, and the hold block's pull on arguments — design

**Issue:** #116 (predictions S1–S7 filed there before implementation)
**Date:** 2026-08-05
**Branch:** `fix/declared-path-fanout-cap`
**Baseline:** v6 directed-depth smoke, app version `2026.08.0403` (DECISION.md §Q,
`benchmark/raw-evidence-v6-directed-depth.md`); v7 contract A/B, `2026.08.0501`
(`benchmark/raw-evidence-v7-contract-ab.md`)
**Deployed main:** `2026.08.0502`
**Status:** design approved, not yet implemented

---

## 1. The two problems, which are one change

Both are edits to how the depth gate directs the model, and both were measured on the same
mechanism. They land together, which is deliberate: #111 became unattributable inside the v6
smoke *because* it arrived alongside another change without disjoint observables. §8 states how
these two stay attributable.

**Problem 1 — the declared path is model-steerable (§Q4).** `_selectTarget` prefers the model's
own `would_confirm` layer whenever it names an open gap. That path carried 4 of 6 holds — not the
minority Q7 predicted — and twice it steered the run to a cheap layer. It was pre-registered as a
design property, not a defect, on the grounds that binding the gate to the model's own stated gap
is the purest form of direction available. The v6 smoke measured the cost: two of six runs lost
their target layer to it.

**Problem 2 — the hold block degrades argument quality (v7 §4).** Paired trials on the real model
seam: without a hold, 3 of 3 control trials produced well-formed JSON — including one that guessed
`incident`/`priority`, v6's exact guess, and still got it right. With a hold, 3 of 3 degraded to
bare scalars. #109's own mechanism, the thing that finally moved §H8's acceptance test, is not
neutral with respect to argument quality.

## 2. What the trail says, as distinct from what the markdown says

Queried from `x_snc_troubleshoot_run.transcript` on gpinst01 — the verbatim `_holdNote` strings,
not the benchmark tables:

| Run | Seed | Open gaps at hold | Declared target | Fan-out of declared | Floor available |
|---|---|---|---|---|---|
| TR1000152 | 04 | 2, 3, 4, 5, 7 | layer 3 | 3 | **1** (layers 4, 5) |
| TR1000153 | 04 | 2, 3, 4, 5, 6, 7 | layer 3 | 3 | **1** (layers 4, 5) |

Runs 3 and 4 declared layers 5 and 4, both already at fan-out 1 — the floor — so no cap can
displace them. Runs 1 and 2 took the ranked path, which this change does not touch.

**The cap therefore flips exactly the two seed-04 holds and regresses nothing else in v6.**

### 2.1 The flips land on layer 4, not layer 6

Fan-out, derived from `_layerToolMap()`: `agent_trace` 1, `schema_lookup` 1, `query_table` 1,
`genai_log` 2, `agent_config` 3, `log_analysis` 3. Gap fan-out is the minimum over the gap's
tools, so layers 4 and 5 tie at the floor and the tie breaks on the lowest layer number → layer 4
→ `schema_lookup`.

Layer 6 scores 2 and is targeted only when layers 4 *and* 5 are both closed. Layer 1 always closes
on the opening `agent_trace`; layers 4 and 5 are open precisely because `schema_lookup` and
`query_table` are the tools runs historically never reach. With `MAX_HOLDS = 2` there is no
budget to close 4 and 5 and then reach 6.

**So this change will not end `genai_log`'s 57-run absence, and seed 04 will still miss its
answer — via `schema_lookup` instead of `agent_config`.** That is pre-registered as S3/S4 rather
than discovered afterwards. Two alternatives were considered and rejected in §4.

### 2.2 The hold does not degrade arguments uniformly

In the same two seed-04 runs the post-hold `agent_config` calls were well-formed objects
(`{"agent":"…","section":"tools"}`). Across live v6 under a hold: `agent_config` well-formed ×3,
`query_table` ×1, `schema_lookup` degraded on 2 of 3.

`schema_lookup` is the one tool whose contract explicitly permits a bare scalar ("pass the table
name by itself"), so the minimal legal argument *is* a scalar there. This matches v7's R3
refutation directly: the corrected contract fixed the scalar's **content**, not its **form**.
Chasing the JSON-object form would be chasing a non-defect.

## 3. Change A — the target always comes from the fan-out floor

> **The target is always drawn from the minimal-fan-out class of open gaps; the model's
> declaration decides which member of that class, and nothing else.**

```
floor  = min fan-out over open gaps (skipping unscorable)
if floor === -1 → return null                                   // unchanged: union fallback
class  = open gaps whose fan-out === floor
chosen = lowest-layer member of class that `would_confirm` names   → source 'declared'
       ‖ lowest-layer member of class                              → source 'ranked'
```

Direction survives: the model still picks, among equals. Force survives: it cannot pick a cheap
layer. Honouring the model's own declaration is what makes the gate direction rather than force,
and the cap keeps that while removing self-selected cheap compliance.

**Untouched:** `_gapFanOut`, `_dedicatedTools`, `_unionTools`, `MAX_HOLDS`, the sticky/cap
ordering (R1/R2), the `isFinite` layer guard (I2), the `fanOut` field carried on the target (I3),
and every `_holdBlock` wording branch. `_depthGate`'s contract is unchanged: `_selectTarget` still
returns `{layer, source, tools, fanOut}` or `null`.

### 3.1 Two consequences stated rather than buried

**`matched` disappears.** Today a declared gap that is open but *unscorable* sets `matched`,
blocks the ranked path, and forces the undirected union hold — narrow enforcement behind wording
that directs at no layer, the worst combination available. Under the floor rule an unscorable gap
is not in the class, so the ranked path runs. Strictly better, and unreachable in production
(every tool in `_layerToolMap` is scorable, and `_openGaps` already drops malformed gaps), so it
is a degraded-path change only: unit-tested, not measured.

**`source: 'declared'` will fire less often.** Retro-applied to v6: runs 1, 2, 5, 6 → `ranked`;
runs 3, 4 → `declared`. That inverts Q7's measured 4/2 to 2/4. The next smoke's declared/ranked
split is therefore **not comparable to §Q2's** and must not be read as a trend against it.

### 3.2 Why the target's `fanOut` still governs `_holdBlock`'s wording

`target.fanOut === floor` always, now. The "no other line of investigation reaches" claim is still
gated on `fanOut === 1` and still only asserted when true; a gap set confined to layers 2/3/7 has
floor 3 and gets the neutral variant, exactly as today. The cap does nothing when every open gap
is cheap, which is correct — there is no better layer to insist on.

## 4. What Change A deliberately does not do

Two alternatives were considered and rejected:

- **Dynamic fan-out** — scoring tools by how many *currently open* gaps they close rather than by
  the static map. Principled (a tool that only also-closes an already-swept layer cannot discharge
  anything incidentally) and it promotes layer 6 into the floor class. But the lowest-layer
  tie-break still selects layer 4, so it changes no v6 outcome. Cost without measurable effect.
- **Changing the tie-break** so layer 6 can win. The only option that could reach `genai_log` —
  and the only one that looks like teaching to the test, since no structural argument prefers
  layer 6 over layer 4 other than "that is where the unreached tool is". §H8 item 3's non-vacuity
  condition is that the harness does not steer the model toward the measured tools; a tie-break
  reverse-engineered to surface one would forfeit it and make 57 runs of evidence unreadable.

## 5. Change B — `_holdBlock` item 1 stops quoting a field on its own

> **OUTCOME: REVERTED, NOT SHIPPED.** The A/B specified in §6 refuted this section's hypothesis —
> six scenarios, twelve trials, every pair byte-identical between arms, including the one that
> reproduced the defect (S6 REFUTED). The rewording was reverted; §3's Change A shipped alone.
> See `benchmark/raw-evidence-v8-hold-item1-ab.md` and DECISION.md §R6. The design below is left
> as written, as the record of what was hypothesised and tested.

```diff
-  1. What did the last tool result actually establish? Quote the specific field
-     or value you are relying on.
+  1. What did the last tool result actually establish? Quote the specific value you
+     are relying on, and the table and field it came from.
```

`field or value` makes a bare field name a legitimate quotable unit, three lines above "Call a
tool that reaches layer N", and the hold block renders **last in the prompt** — after
`_responseContract()`, by the deliberate #109 M3 reordering. C4 and C5 returned `"priority"` and
`"assignment_group"`: bare field names, table omitted. The edit removes the standalone-field
reading and makes table and field co-salient.

It names no tool, so the existing non-vacuity guard test passes unchanged. Item 1 keeps its §O6
job — buying one generation whose work is reading rather than summarising — which is the mechanism
behind run 2's first movement on constraint 1.

**Not attempted:** re-asserting the response envelope inside the hold to push arguments back to
object form. v7's R3 was refuted on exactly that point; both arms stayed scalar and bare scalars
are legal for this tool. The defect is which scalar, not that it is one.

## 6. The A/B, before merge

A prompt change is exactly the kind of change this project has learned to distrust without
measurement, so Change B is measured on its own before it ever rides in a smoke alongside
Change A.

**Instrument.** `benchmark/scripts/build-ab-prompts.js` gains a hold mode. Both arms compose the
**real** `_holdBlock` output via `loadScriptInclude('PaAgentLoop.js')` rather than a hand-written
approximation, and the script exits non-zero unless the arms differ only in item 1's sentence —
the same invariant the contract A/B already enforces. This also makes the v7 hold arms
reproducible from the repo for the first time; they were composed ad hoc and the committed script
has no hold block at all.

**Arms.** Control = current item 1. Treatment = the reworded item 1. Both carry the **deployed**
#113/#114 contract, isolating the hold text.

**Scenarios.** Six paired distinct scenarios (C4/C5/C6 plus three new), 12 trials, driven through
the `pa llm reason` NASK skill — the same seam `PaLlmProxy._invokeNask` uses. Paired scenarios,
not repeats: the model is deterministic at production temperature (v7 §2), so repeats of one
prompt carry the information of one.

**No tool executes**, so no `x_snc_troubleshoot_audit` rows are written and the evidence trail the
scored pass reads stays uncontaminated.

**Classification.** Each returned `args` is one of: dotted-correct / bare-table / **table-omitted**
/ parameter-prefixed.

**Ceiling, stated up front.** Six pairs, one model, one day, one reduced instrument. This is a
demonstration, not a rate — the same limit as v7 §6, and it does not license "verified".

The A/B does not require the app deployed; the prompt is composed locally and sent to the skill.
Deploy to gpinst01 happens after merge.

## 7. Predictions, filed on the issue before any code

| | Prediction |
|---|---|
| S1 | Replaying the seven v6 hold records changes the target on exactly 2, both seed-04, both layer 3 → layer 4, source `declared` → `ranked` |
| S2 | `declared` fires on a minority of holds in the next e2e smoke, inverting Q7 |
| S3 | `genai_log` and `log_analysis` remain uninvoked — filed so their continued absence is not read as this change failing |
| S4 | Seed 04 still misses its layer-6 answer; its holds release on `schema_lookup` rather than `agent_config` |
| S5 | The control arm reproduces ≥ 1 table-omitted argument. **If it does not, the instrument is too reduced and the run licenses no claim about the treatment** |
| S6 | The treatment arm emits 0 table-omitted arguments across the 6 scenarios |
| S7 | Both arms stay scalar — R3's refutation replicates; the change moves content, not form |

S1 is a derivation rather than a forecast, and is filed anyway so the retro-application is on
record before the code that performs it exists.

## 8. How the two changes stay attributable

They touch disjoint observables:

- **Change A** is read from which layer is targeted — `_holdNote`'s `layer N (source)` string in
  `x_snc_troubleshoot_run.transcript`, and which tool discharges the hold.
- **Change B** is read from argument well-formedness — the verbatim `args` on
  `x_snc_troubleshoot_audit` rows with `action_type=intent`.

Neither measurement can be moved by the other change. Change B additionally carries its own paired
A/B, run before merge. Query the audit trail for the argument question, not the benchmark
markdown: the markdown records arguments only for the *measured* tools, which is the distinction
that root-caused #111.

## 9. Files

| File | Change |
|---|---|
| `src/server/PaAgentLoop.js` | `_selectTarget` rewritten to the floor rule; `_holdBlock` item 1 reworded; headers updated |
| `test/…PaAgentLoop…` | new selection tests (§10), item-1 wording test, existing no-tool-names guard unchanged |
| `benchmark/scripts/build-ab-prompts.js` | hold mode; arms from the real `_holdBlock`; differ-only invariant extended |
| `benchmark/raw-evidence-v8-hold-item1-ab.md` | new — every trial verbatim, S5–S7 scored |
| `benchmark/DECISION.md` | new §R |
| `package.json`, `README.md`, `CHANGELOG.md` | version `2026.08.0503` |

**Must not be touched:** `_layerToolMap()` and `toolFanOut()` (changing the map changes the
ranking and would desynchronise 57 runs of evidence), `MAX_HOLDS`, the R1/R2 ordering in
`_depthGate`, the `schema_lookup` contract sentence (#113/#114, held constant across both A/B
arms), and the seeds.

## 10. Tests

Unit, on `_selectTarget`:

1. Floor computed across all open gaps; target drawn from the floor class.
2. Declared naming a floor-class gap wins, `source: 'declared'`.
3. Declared naming an above-floor gap is ignored; ranked fires, `source: 'ranked'`.
4. Declared naming an *unscorable* open gap no longer blocks ranked (§3.1).
5. Ties inside the floor class break on the lowest layer number, independent of `open`'s order.
6. Nothing scorable → `null` → `_depthGate` takes the union fallback (unchanged).
7. Non-number and `NaN` `layer` still rejected at source (I2, unchanged).
8. **Regression on verbatim v6 data:** gap sets `{2,3,4,5,7}` and `{2,3,4,5,6,7}` with
   `declared: [3]` both select layer 4, `source: 'ranked'`, tools `['schema_lookup']`.

On `_holdBlock`:

9. Item 1 contains no standalone field-quoting phrasing; the new wording is present.
10. The existing guard — the block names no measured tool — passes unchanged.

## 11. What this cannot establish

- **Nothing about correctness.** Neither change touches whether a diagnosis is right. That is the
  scored pass's question, and it is downstream of this work.
- **No rate for Change B.** Six paired scenarios on a reduced instrument. Whether the full 16.7K
  prompt behaves the same is untested, and remains untestable until an execution surface exists
  (v7 §1, §8).
- **Nothing about layers 6 and 7 being reachable.** This change makes them no more reachable; S3
  says so in advance.
- **Nothing about native**, which has not moved on this line of work.
- **Nothing about seeds 02 and 05**, unchanged from §Q6.
- **S1 is arithmetic, not evidence of benefit.** That the rule flips the two holds the evidence
  identifies is a property of the rule; whether flipping them improves a report is unmeasured.
