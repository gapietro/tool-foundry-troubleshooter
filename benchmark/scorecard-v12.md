# Scorecard — v12, the scored pass (`2026.08.1001`, #151)

Pre-registered at `DECISION.md` §AC, commit `a342311`, **before any run fired**. Twenty rows, five
seeds, two reps, two arms, one instance, one day, one app version. Measurements in
`raw-evidence-v12-scored-pass.md`; packets exactly as scored in `scoring-v12/`; each blind scorer's
full reasoning in `scoring-v12/results/`.

**Scoring topology, held constant to match v9 (§AC7):** twenty independent agents, one per packet,
each instructed to read only its own packet and forbidden from reading any other file. Prompts were
byte-identical across the twenty except the packet path and row number, because the prompt is part of
the instrument. The rubric section is byte-identical in all twenty packets, asserted by the builder.

---

## 1. The twenty rows

`rc` = `root_cause_layer_correct` (0/2) · `ft` = `fix_target_correct` (0/1/2) ·
`ev` = `evidence_cites_trace_and_config` (0/1) · `fu` = `fix_usable_unedited` (0/1)

| row | arm | seed/rep | rc | ft | ev | fu | total | `passes_gate` | `ambiguous` |
|---|---|---|---|---|---|---|---|---|---|
| 01 | native | 01/1 | 2 | 2 | 1 | 1 | **6/6** | **1** | yes |
| 02 | custom | 01/1 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 03 | native | 01/2 | 2 | 2 | 1 | 1 | **6/6** | **1** | no |
| 04 | custom | 01/2 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 05 | native | 02/1 | 0 | 1 | 1 | 0 | 2/6 | 0 | yes |
| 06 | custom | 02/1 | 0 | 0 | 0 | 0 | 0/6 | 0 | yes |
| 07 | native | 02/2 | 0 | 2 | 1 | 0 | 3/6 | 0 | yes |
| 08 | custom | 02/2 | 0 | 0 | 1 | 0 | 1/6 | 0 | yes |
| 09 | native | 03/1 | 2 | 2 | 1 | 1 | **6/6** | **1** | no |
| 10 | custom | 03/1 | 0 | 0 | 1 | 0 | 1/6 | 0 | yes |
| 11 | native | 03/2 | 2 | 2 | 1 | 1 | **6/6** | **1** | no |
| 12 | custom | 03/2 | 0 | 0 | 0 | 0 | 0/6 | 0 | yes |
| 13 | native | 04/1 | 2 | 2 | 1 | 0 | 5/6 | 0 | yes |
| 14 | custom | 04/1 | 2 | 0 | 0 | 0 | 2/6 | 0 | yes |
| 15 | native | 04/2 | 2 | 2 | 1 | 0 | 5/6 | 0 | no |
| 16 | custom | 04/2 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 17 | native | 05/1 | 2 | 2 | 1 | 1 | **6/6** | **1** | yes |
| 18 | custom | 05/1 | 0 | 0 | 1 | 0 | 1/6 | 0 | no |
| 19 | native | 05/2 | 2 | 2 | 1 | 1 | **6/6** | **1** | yes |
| 20 | custom | 05/2 | 2 | 2 | 0 | 0 | 4/6 | 0 | yes |

**Zero void rows.** Every arm finished with **10 valid rows**; neither arm used any of its three
permitted re-runs, and §A3.4's 8-valid-row floor was never approached.

---

## 2. The gate

Per §A2, `passes_gate = 1` iff `root_cause_layer_correct == 2` **AND** `fix_usable_unedited == 1`.
Nothing else feeds it. Read against §A3.3's proportional bands.

| arm | valid runs | `sum(passes_gate)` | proportion | band |
|---|---|---|---|---|
| **native** | 10 | **6** | **60.0%** | **middle** (≥50%, <80%) |
| **custom** | 10 | **0** | **0.0%** | **bottom** (<50%) |

Rubric totals, recorded separately and **not** used to derive the gate: native **51/60**, custom
**9/60**.

### 2.1 The milestone

**AC4's Ruling 3 governs: the Phase 1b milestone is met iff the custom arm reaches §A3.3's top band,
`≥ 80%`.** Custom reached **0.0%**.

> **The Phase 1b milestone is NOT met.**

The alternative *custom ≥ native* reading was rejected in advance at §AC4 and does not apply; on this
pass it would also have failed. Native's arm is reported beside the criterion and is not part of it.

**Native's own band moved.** v9 put native at 6/6 (100%, top band); v12 puts it at 6/10 (60%, middle
band) across a broader seed set. The middle band's stated outcome is *"native for lightweight triage +
custom deep-diagnosis harness"* — a reading this pass's own evidence complicates, because the custom
deep-diagnosis half scored 0/10. §AD takes that up.

### 2.2 Where native lost its four rows — the pattern is one clause, not four failures

| row | seed | rc | ft | why the gate failed |
|---|---|---|---|---|
| 05 | 02 | 0 | 1 | wrong layer — named the missing tool, not the instruction defect |
| 07 | 02 | 0 | 2 | wrong layer, **right target** — elevated to root cause what the spec designates as supporting evidence |
| 13 | 04 | **2** | **2** | right layer, right target — **`fu` = 0** under §A2.1 Case 1: FIX-1 left the replacement flow sys_id unfilled and the instance holds it |
| 15 | 04 | **2** | **2** | identical to row 13, independently scored |

**Rows 13 and 15 are the load-bearing pair.** Both resisted the R-22 decoy, both named
`sys_one_extend_capability_definition.api` exactly, both scored 5/6 — and both failed on §A2.1 Case
1's "was the value obtainable" test, decided the same way by two independent scorers who never saw
each other's work. That is the clause behaving as #139 intended: mechanical, reproducible, and
consequential.

---

## 3. Predictions AC-1 … AC-9

Seven confirmed, two refuted.

| | prediction | outcome | the number |
|---|---|---|---|
| **AC-1** | native's `sum(passes_gate)` exceeds custom's | **CONFIRMED** | 6 > 0 |
| **AC-2** | custom scores `rc` = 0 on ≥ 8 of 10 rows | **CONFIRMED** | exactly **8** of 10 (rows 14 and 20 scored 2) — one row from refutation |
| **AC-3** | seed 02: all four rows `rc` = 0 **and** ≥3 of 4 reports carry a "no failure observed" conclusion | **REFUTED** | first half held (0,0,0,0); second half failed — only **1** of 4 (row 06) converged |
| **AC-4** | seed 05: native passes ≥1 of 2, custom passes 0 of 2 | **CONFIRMED** | native **2** of 2, custom **0** of 2 |
| **AC-5** | ≥ 14 of 20 rows return `ambiguous = no` | **REFUTED** | **8** of 20 |
| **AC-6** | custom's audit-derived sweep breadth is at or below native's on every row | **CONFIRMED** | closest margin seed 05: custom 5/7 vs native 7/7 |
| **AC-7** | 0 of 10 custom rows lost to #148's trap | **CONFIRMED** | three custom rows died at the validator (08, 14, 20) — none on an *omitted* `root_causes`/`evidence` array |
| **AC-8** | ≤2 voids encountered, both arms finish with 10 valid rows | **CONFIRMED** | **0** voids |
| **AC-9** | the milestone is NOT met | **CONFIRMED** | custom 0.0%, far below 80% |

**AC-9 was filed against the project's own preferred outcome and it held.**

### 3.1 AC-5 is the most useful refutation, and by the margin it predicted

AC-5 asked whether §A2.1's clauses **determine** an answer, using the broad packet-level flag and
committing in advance not to substitute the narrower gate-only reading. It predicted ≥14 of 20 and got
**8** — worse than the v9 baseline it was measured against, not better.

**§Z's rubric repair did not make the rubric self-determining.** It made it *reproducible*: the two
seed-04 rows landed identically, and both seed-05 native rows landed identically, on clauses that
previously had no stated answer. That is progress on consistency and none on completeness. §AC8 warned
that AC-5 *"tests whether they determine an answer, which is a different property from whether the
answer is the right one"* — this result says they often do not determine one at all.

Which column drew the flag, across the twelve flagged rows — **14 flags over 12 rows**, because rows 07
and 14 each name two:

| column | rows | n |
|---|---|---|
| `fix_usable_unedited` | 01, 07, 17, 19, 20 | **5** |
| `evidence_cites_trace_and_config` | 06, 08, 10, 13, 14 | **5** |
| `root_cause_layer_correct` | 07, 14 | 2 |
| `fix_target_correct` | 05, 12 | 2 |

**A gate term (`fix_usable_unedited`) and `evidence_cites_trace_and_config` were flagged equally often,
five rows each.** So the exposure §A2.1 was written to close is still open on a gate term in a quarter
of all rows — but it is not uniquely the worst column, and the evidence column is flagged just as much.

> **Corrected after review.** An earlier draft of this section claimed
> `fix_usable_unedited` was "the most frequently under-determined column … in six of the twelve", by
> counting row 13 against it. Row 13's scorer flagged `evidence_cites_trace_and_config` only
> (`scoring-v12/results/row-13-result.md`). The corrected count is the 5–5 tie above, re-derived from
> all twenty verdict files. The claim that survives is the one that matters — a **gate term** is
> under-determined on five of twenty rows — and the superlative does not.

---

## 4. Two process defects found by the scorers, recorded rather than smoothed

**1. AC4's Ruling 1 never reached the scorers.** §AC4 ruled in advance, blind, that a seed-05 report
naming the specific gate and proposing activation scores `fix_usable_unedited` = 1 notwithstanding the
unseeded execution-layer defect. The ruling lives in `DECISION.md` §AC — **which no scorer can see.**
The packets carried the seed spec's statement that a pass "must rule on it in its pre-registration"
without carrying the ruling itself. Both seed-05 native scorers (rows 17, 19) flagged the column as
under-determined for exactly that reason, and row 19's scorer named the absence explicitly.

**It changed no score.** Both independently landed on `fu` = 1, the value Ruling 1 mandates, so rows
17 and 19 stand as scored. But that is luck rather than compliance: a ruling made in advance to
prevent improvisation was not delivered to the people who would otherwise improvise. **The fix is a
packet-build step, not a rubric change** — any future pass with an advance ruling on a scoring column
must put that ruling in the packet.

**2. Two seed-05 packets were built wrong and repaired before dispatch.** Rows 17 and 19 initially
carried ~4.5KB of raw diagnostic tool-output envelopes ahead of the report, because the operator's
message list for them included `sn_aia_message` records with `type = "conversation"` — intermediate
tool outputs, not report prose. Caught by reading the built file back: it opened
`{"success":true,"data":{"reads":...}` instead of a Fix Report. Had it shipped, those two scorers would
have judged materially different material from the other eighteen. Recorded because the discriminator
is reusable: **`type = "conversation"` marks intermediate messages; report and stub both carry an empty
`type`, so the combination is needed to select a report.**

---

## 5. What this scorecard does not establish

Everything at §T8, §Z5, §AB5 and §AC8 stands. In particular:

- **It is not a rate.** Two reps per seed per arm measures a flip, not a frequency. Native's 60% is
  6 of 10 rows on one instance on one day, and §AC2's resolution table gives a true-80% harness only a
  ~68% chance of landing in the top band from ten rows.
- **Custom's 0/10 is a floor result, and floors are the least informative kind.** Nine of its ten rows
  never reached the seeded layer; the tenth (row 20) reached it and died at the citation validator. A
  0% proportion cannot distinguish "slightly below the band" from "nowhere near it".
- **AC-7's clean result is weak**, per §AC8: three custom rows died at the validator on other clauses,
  so #148's specific trap was never exercised. Row 20 shows an adjacent trap firing on a *malformed*
  `layers_swept` key — the same family as #148's omitted key, and grounds for a new issue.
- **It cannot establish that the rubric is right.** AC-5 says it frequently does not even determine an
  answer.
- **It does not license a re-run.** §T9 applies to this pass as to v9: 60% and 0% are properties of ten
  rows each and are reported as such.

**Quoting rule for this pass, in the shape §Z6 established:** native **6/10 · 60% · middle band** and
custom **0/10 · 0% · bottom band**, with the rubric totals **51/60** and **9/60** beside them, never a
bare figure and never one arm without the other.
