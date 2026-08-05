# Directed depth gate — design

**Issue:** #109
**Date:** 2026-08-04
**Branch:** `feature/directed-depth-gate`
**Baseline:** v5 depth smoke, app version `2026.08.0401` (DECISION.md §P,
`benchmark/raw-evidence-v5-depth-smoke.md`)
**Status:** design approved, not yet implemented

---

## 1. The problem

The depth gate (#103) works exactly as designed and does not reach the acceptance test.

Measured on the v5 smoke (DECISION.md §P2, six runs, seeds 01/03/04, custom harness only):

- A hold fired on **6 of 6** runs, released in every case by a real tool call verified
  `"success":true` against its own audit row.
- Median tool calls rose 1 → 2. **Audit-derived sweep moved 1/7 → 4/7 on every run** — the first
  movement in that number in the project's history.
- **Prediction P2 was REFUTED.** `schema_lookup`, `query_table` and `genai_log` were invoked in
  **0 of 6** runs. Counting the whole history of the custom harness, those three plus
  `log_analysis` have never been invoked in **51 runs**. §H8's acceptance test is unmet.
- **All six releases were `agent_config`, exclusively** (P7).

Neither revert trigger fired: the gate is not a denial-of-service (P4 — all six runs reached
`complete`) and it did not reproduce #88's fabrication (P6 — 0 of 6 unsupported sweep claims).

## 2. The diagnosis

P7 is the mechanism of P2's failure, and it was pre-registered on #103 as a known tilt rather than
engineered around.

`PaFixReport._layerToolMap()` (`src/server/PaFixReport.js:366`) maps layers to the tools that can
read them:

| layer | tools | |
|---|---|---|
| 1 | `agent_trace`, `genai_log`, `log_analysis` | |
| 2 | `agent_config` | |
| 3 | `agent_config` | |
| 4 | `schema_lookup` | |
| 5 | `query_table`, `log_analysis` | |
| 6 | `genai_log`, `log_analysis` | |
| 7 | `agent_config` | |

`PaAgentLoop._depthGate` (`:539`) records the **union** of every open gap's tools as the release
set (`_heldTools = this._unionTools(open)`, `:581`) and releases on `_anyOf(_heldTools,
trail.tools)` (`:560`). `agent_config` appears in the gap set for layers 2, 3 and 7, so **one
`agent_config` call discharges the layer-4 and layer-5 gaps having touched neither.** It is the
cheapest possible compliance and all six runs took it.

§P3's verdict, per the falsification rules filed on #103 in advance: *holds fire, gaps close,
measured tools never reached → the mechanism is refuted as specified; the next iteration works on
**direction, not force**.*

**Force was sufficient to make the model act and insufficient to make it act on the right layer.**

## 3. The two constraints any fix must survive

**Constraint A — one forced beat, not more.** §"STICKY, DELIBERATELY" (`PaAgentLoop.js:514`) argues
that a re-derived gap set moves the goalposts — close layer 4, declare layer 5, be held again — and
rides every run to `MAX_ITERATIONS`, since even native's best sweep in the v4 pass was 6/7. P4
confirmed the sticky one-beat design is not a denial-of-service. Any fix that multiplies the beat
count re-opens a question that is currently answered.

This rules out the third candidate considered — **per-gap release**, where every recorded gap must
be closed on its own layer. A draft marking six layers `NOT_SWEPT` would need up to six dispatches,
which is the pre-filed revert trigger by construction.

**Constraint B — the harness must not name the measured tools to the model.** §H8 item 3 anticipated
a mandated fix and kept the acceptance test unchanged; the test survives mandation only because it
requires the right tool *on the seed that needs it*. `_holdBlock` (`:679`) names layers only, and
`_scrubToolNames` (`:1285`) exists solely to strip tool names out of the model's own quoted-back
reasons, with a unit test guarding it.

See §8 for the qualification this constraint already carries (issue #110).

## 4. The mechanism

**One rule, applied twice: fan-out minimality.** A tool's fan-out is the number of layers
`_layerToolMap` lets it close:

| tool | fan-out | layers |
|---|---|---|
| `agent_trace` | 1 | 1 |
| `schema_lookup` | 1 | 4 |
| `query_table` | 1 | 5 |
| `genai_log` | 2 | 1, 6 |
| `log_analysis` | 3 | 1, 5, 6 |
| `agent_config` | 3 | 2, 3, 7 |

### 4.1 Use 1 — pick a single target gap

At the first hold, `_depthGate` selects **one** gap from `open` instead of recording the union:

1. **Declared.** If any root cause's `would_confirm` names a layer that is in the gap set, that
   gap is the target. Lowest-numbered match wins if several. §P4 recorded run 3's `would_confirm`
   correctly naming layer 4 while the model still did not call the tool that closes it — so the
   model demonstrably can identify the missing layer, and binding the release to its own naming is
   the purest available form of direction.
2. **Ranked.** Otherwise the gap with the lowest min-fan-out across its tools; ties broken by
   ascending layer number. Today that orders layers 1, 4, 5 (min fan-out 1) above layer 6 (2) above
   layers 2, 3, 7 (3).

**Layer 1 ties for first in the ranked order and that is left alone deliberately.** It rarely enters
the gap set — `agent_trace` is called in nearly every run, and seed 05's absence case marks layer 1
`UNAVAILABLE`, which `unsweptGaps` excludes by design (#78). When layer 1 *is* a gap the model has
said it did not read the trace, and directing it to the trace is the right answer.

### 4.2 Use 2 — narrow the release set

`_heldTools` becomes the target gap's **minimal-fan-out tools only**, not all of its tools:

| target layer | release set | dropped |
|---|---|---|
| 1 | `agent_trace` | `genai_log`, `log_analysis` |
| 2, 3, 7 | `agent_config` | — |
| 4 | `schema_lookup` | — |
| 5 | `query_table` | `log_analysis` |
| 6 | `genai_log` | `log_analysis` |

This is §P6's second candidate remedy — *make the map's cheap multi-layer release not discharge a
gap on a layer it did not touch* — and it falls out of the same rule rather than needing one of its
own. A layer-5 gap is no longer discharged by `log_analysis`, which is shared with layers 1 and 6
and would close a data gap without touching data.

### 4.3 What does not change, and the one thing that does

**Stickiness is untouched.** The target and its narrowed release set are recorded at the **first**
hold and never re-derived, so later drafts cannot move the goalposts. Release is still a row in the
audit trail the model cannot author.

**Cost is at most two forced beats, not one — and Constraint A is satisfied by a CAP, not by
construction.** This is the correction the final whole-branch review forced (C1), and the earlier
draft of this section was wrong to claim otherwise.

The one-beat arithmetic in §3 was inherited from #103, where `_heldTools` was the union of every
open gap's tools: any tool the prompt advertised for a held layer discharged the hold, so a
compliant call always released and one beat was all the gate could cost. §4.2 breaks exactly that
premise. `PaFixReport.schemaText()` renders the **whole** layer-to-tool map into every prompt —
*"5 (Data) needs one of: `query_table`, `log_analysis`"* — while the release set is now the
`dropped` column's complement. For targets on layers 1, 5 and 6 the release set is a strict
**subset** of what the model has been told closes that layer. A model reading the harness's own
mapping can therefore make a call that is compliant on its face, fail to release, and be re-held.
Uncapped, that rides to `MAX_ITERATIONS` and finishes `partial` — which is the pre-filed revert
trigger for the smoke that follows, arrived at by a route §3 did not anticipate.

So the beat count is **bounded rather than measured**. `_depthGate` counts every hold it issues, on
every path including `no_layer_report`, and once the count reaches `MAX_HOLDS` (2) the next terminal
action is allowed through: hold #1 → the model acts → hold #2 → release. The cap release is flagged
(`capped:true`) and written to the transcript as its own note, because a run that finished only
because the gate gave up is not evidence the gate worked and the smoke has to count the two apart.
P4's not-a-denial-of-service result carries over — the cap can only make the tail shorter, never
longer.

**Where the cap sits (R1 + R2, review of the first cut).** The first implementation put the cap
check *inside* the sticky branch and *above* that branch's trail check, and both halves were wrong:

- **R1 — above the trail check.** A model that complied on the turn after hold #2 was released by
  the cap and flagged `capped:true`. That is precisely the behaviour the gate exists to produce,
  recorded as the gate giving up — and the flag's whole job is to let the smoke count real
  compliance. The trail check now runs **first**: a trail row that discharges the recorded set is a
  genuine release however many holds preceded it.
- **R2 — inside the sticky branch.** `_heldTools` is assigned on the `fix_report` route alone, so a
  run that never files a fix_report never enters the sticky branch: it takes the `no_layer_report`
  hold every iteration, increments the counter against a check it cannot reach, and rides to
  `MAX_ITERATIONS` → `partial` — the same revert trigger, by a second route. The cap now sits above
  every remaining path (sticky-with-no-match, `no_layer_report`, first hold alike), which is what
  makes the *cap*, and not just the counter, apply on every path.

The resulting order is: already released → unreadable trail → sticky trail release → **cap** →
sticky hold / `no_layer_report` / first hold. One consequence is accepted rather than fixed: with
the cap above the first-hold derivation, a run whose cap was spent by `no_layer_report` holds is
released `capped:true` even if the fix_report it finally files has no open gap. The bound is what
matters by then, and the transcript note is worded to claim only which branch released the run.

**How often the `no_layer_report` hold fires is unmeasured.** The v4 pass predates the hold
entirely, so its distribution of model behaviour says nothing about this exit; R2's bound is what
makes the question safe to leave open rather than a reason to assume the path is cold.

The honest reading of the trade: the gate now guarantees a bound on cost and no longer guarantees
that a release means compliance. Making the release set and the advertised tool list agree — either
by narrowing `schemaText()` per hold or by widening the release set back — would restore the
guarantee, but both touch `PaFixReport`, which §7 puts out of bounds for this change.

## 5. The interrogation

`_holdBlock` keeps its structure, and its constraint: **it names layers, never tools.** The gaps
list and the model's own quoted `NOT_SWEPT` reasons stay as they are, scrubbed by `_scrubToolNames`
exactly as today.

Item 2 currently asks the model to name the layer that matters. The harness has now already
answered that, so leaving the question would be theatre. It gets two variants matching the two
selection paths:

- **Declared:** `Layer 5 is the one this run needs closed — your own report names it as what would
  confirm your finding.`
- **Ranked, target fan-out 1:** `Of the layers above, layer 4 is the one no other line of
  investigation reaches.`
- **Ranked, target fan-out > 1:** `Of the layers above, layer 2 is the one this run needs closed
  next.`

The ranked variant splits on fan-out because the exclusivity claim is only **true** at fan-out 1
(I3, final whole-branch review). For a gap set confined to layers 2/3/7 the ranked target is layer 2
via `agent_config`, which also reaches 3 and 7; a layer-6 target releases on `genai_log`, which also
reaches layer 1. A harness measuring a model's evidential honesty does not get to assert a falsehood
to it. The neutral variant still directs at the layer and still names no tool, so Constraint B is
unaffected. The target carries its own fan-out out of `_selectTarget` rather than the renderer
re-deriving it from a map it does not hold.

Item 3 becomes `Call a tool that reaches layer N` — singular, the target.

**Item 1 stays unchanged, and is explicitly not claimed to work.** It asks the model to quote the
field the last tool result established, aimed at §O6's evidence-in-hand-and-unused constraint. P5
measured it missing `priority_stored: null` on 2 of 2 seed-01 runs. It stays because removing it
would confound the comparison against the v5 smoke, not because it earned its place.

The closing — *your draft is preserved, resubmit it unchanged* — stays verbatim. That is the whole
difference between this gate and #88 and it is not being touched.

## 6. State, stickiness and degradation

Two new fields alongside `_heldGaps` / `_heldTools`: the target layer, and the selection source
(`'declared'` | `'ranked'`). C1 adds a third, the hold counter. All of them are cleared by
`_resetGate()`, which is called from `initialize()` — **not** from `run()`, which resets nothing.
Earlier drafts of this section and of `_resetGate`'s own docblock said `run()`; that was never true.
The behaviour is nonetheless correct, because production constructs a fresh `PaAgentLoop` per run
(the async ScriptAction worker news one up per event), so per-run state and per-instance state are
the same thing here. Only the claim about where it happens was wrong.

R-9 posture, matching the file's existing treatment of a degraded collaborator — the gate degrades,
the run never traps:

- The `would_confirm` read goes through a `try/catch` wrapper mirroring `_safeGaps` (`:591`). A
  throw or a malformed return means "nothing declared" and selection falls to ranked.
- Selection operates on `open`, which `_openGaps` (`:608`) has already filtered to plain objects
  with array `tools`, so the ranking loop cannot dereference a malformed gap.
- If selection yields no tools — unreachable today, since `_layerToolMap` never returns an empty
  list and this code is inside the `open.length > 0` branch — it falls back to the union. This
  mirrors the I2 guard at `:559`: an empty recorded set must never become an unreleasable hold.
- The I1 early clear at `:277` needs no change. It tests the dispatched tool against `_heldTools`,
  which is now the narrowed set, so it stays correct by construction and gets tighter for free.

`_holdNote` (`:731`) grows the target and the source, because the transcript is how the smoke tells
the two paths apart afterwards:

```
HOLD: terminal action refused — layer 5 (declared) must be reached;
layers 4, 5 declared NOT_SWEPT with no tool call behind them.
```

It must stay inside `DIGEST_CHARS` (200) — the #72 / §G3a constraint that put the interrogation in
the prompt and the note in the transcript in the first place.

## 7. Files, and what must not be touched

**Changed:**

- `src/server/PaAgentLoop.js` — `_depthGate` selection, a target-selection helper, a fan-out helper,
  `_holdBlock` item 2/3, `_holdNote`, the `run()` reset.
- `src/server/PaFixReport.js` — expose `declaredLayers(report)`, a thin de-duped wrapper over the
  existing `_layersNamedBy` (`:713`) across `root_causes[].would_confirm`. No validation change.

**Must not be touched:**

- Anything native-facing. `agent-doctor-instructions.md` stays byte-identical and no
  `excerptPriority` work lands here, so §K5 sequencing and §I4 confound 3 stay closed and the v5
  comparison holds.
- `_scrubToolNames` and its guard test.
- `_layerToolMap` itself. Editing the map would change what every prior pass measured; this design
  reads it, it does not rewrite it.

## 8. Non-vacuity, and the qualification it already carries

The ranked order puts layers 4 and 5 near the top, which is where §H8's tools live. The defence is
that the rule is stated in terms of the map's structure and never mentions a tool name — *a gap
whose tools also close other gaps is discharged incidentally; a gap with a dedicated tool can only
be discharged deliberately* — and it would produce this same order under a different map.

**A §H8 pass earned under this design must be reported with that qualification attached, not as a
clean pass.**

Separately, and filed as **#110**: `PaFixReport.schemaText()` already ships
`"layer 5 — query_table against the routing table"` into every prompt via `_buildPrompt` →
`_safeSchemaText()` (`:1036`), so §H8's "the harness never names a tool" premise is already
qualified — since #93, for several passes. Its measured content supports this design rather than
undermining it: **`query_table` has been named in every prompt for several passes and invoked in 0
of 51 runs.** Naming a tool is not the mechanism that makes the model call it.

## 9. Tests

Unit, offline, against the existing suite's patterns:

1. Declared beats ranked when `would_confirm` names a layer in the gap set.
2. `would_confirm` naming a layer *not* in the gap set falls through to ranked.
3. Ranked order and the ascending tie-break.
4. Release-set narrowing: a `log_analysis` call does **not** release a layer-5 target.
5. Stickiness preserved — a later draft declaring different gaps does not move the target.
6. A malformed report, and a throwing `declaredLayers`, both degrade without throwing.
7. Empty selection falls back to the union rather than latching an unreleasable hold.
8. `_holdNote` carries the target layer and the source, and stays under 200 chars.
9. The existing guard test — the hold block contains no registered tool name — extended to cover
   both item-2 variants.

## 10. The smoke, and the predictions

Deliberately the same shape as v5's, so the two are comparable: **six runs, seeds 01 / 03 / 04, two
each, custom harness only**, fired sequentially with each polled to terminal before the next is
POSTed. No native arm.

Deploy verified by reading the installed `PaAgentLoop` body back through the MCP broker and
comparing it literally against source — **not** by `sys_script_include.sys_updated_on`, which §P1
recorded reading stale (`2026-08-02`) immediately after a successful install.

Predictions, filed on #109 before the code is written:

| | Prediction |
|---|---|
| Q1 | The hold still fires on ≥ 5 of 6 runs — narrowing does not break the mechanism |
| Q2 | **≥ 1 run reaches `schema_lookup`, `query_table` or `genai_log` on the seed that needs it — §H8's test MET** |
| Q3 | Releases are no longer exclusively `agent_config` — P7's concentration breaks |
| Q4 | `partial` stays at 0–2 of 6 — still not a denial of service |
| Q5 | Unsupported-sweep-claim rate does not rise above v5's 0 of 6 — no #88 fabrication |
| Q6 | `UNAVAILABLE` relabelling does not become the escape — ≤ 3 of 42 labels |
| Q7 | The **ranked** path carries most holds; declared fires on a minority, since `would_confirm` only appears on UNCONFIRMED causes |
| Q8 | Seed 01 still misses `priority_stored: null` on ≥ 1 of 2 runs — constraint 1 is untouched by this design, and predicting it stays broken keeps that honest |

**Revert triggers, pre-registered:** `partial` above 2 of 6, or fabrication returning (Q5 breached).
Either one and the change comes out rather than gets tuned.

## 11. Reading the result

**Q2 is what the iteration lives or dies on.** If holds fire, the narrowed set forces a dedicated
tool, and §H8 still comes back unmet, then the constraint is not the gate at all — and the next
iteration goes to §O6's evidence-in-hand-and-unused problem instead of to depth.

Q7 and Q3 together say which half of the mechanism did the work. If declared carries most holds, the
model's own `would_confirm` is a stronger signal than expected and the ranking is nearly dead code.
If releases stay concentrated on `agent_config` despite the narrowing (Q3 refuted), the gap sets
being produced are dominated by layers 2/3/7 and the target selection never had a dedicated-tool gap
to pick.

Write-up as `benchmark/DECISION.md` **§Q** plus `benchmark/raw-evidence-v6-directed-depth.md`, with
the verbatim captured hold prompt as §P did.

## 12. What this cannot establish

- **No scored pass.** §P6's recommendation against firing one on a single change stands; this design
  does not change that. Six unscored runs, three seeds, one instance, one day.
- **Nothing about correctness.** §P4 recorded four of six v5 runs producing non-empty `root_causes`
  and a fix where v4 produced none, and whether any of those findings is *right* is a scored pass's
  question. This smoke does not answer it either.
- **Nothing about seeds 02 and 05.** Seed 02 is excluded by design; seed 05 — the absence seed, where
  `UNAVAILABLE` on layer 1 is the honest answer and #78's exit must stay open — remains covered by
  unit tests only, untested live, exactly as after v5.
- **Nothing about native**, which does not move on this branch.
- **Nothing about §O6's constraint 1.** Evidence in hand and unused is a different failure from
  evidence not fetched. Q8 predicts it stays broken.
