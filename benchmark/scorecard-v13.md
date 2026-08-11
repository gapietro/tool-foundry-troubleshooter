# Scorecard — v13, the determinacy check (build `5fb7648`, #166)

**Pre-registration:** `DECISION.md` §AI, merged in `ed0b6c2` before any run of this pass fired.
**Raw evidence:** `raw-evidence-v13-determinacy-check.md`. **Rows:** `v13-rows.json`.
**Reports verbatim:** `v13-reports/`. **Packets exactly as scored:** `scoring-v13/`.
**Verdicts:** `scoring-v13/results/`. **Flag tally:** `v13-ambiguity-flags.json`.

**Build under test:** commit `5fb7648`, verified by probe rather than by version string (§AB6/§W7).
`git log 5fb7648..HEAD -- src/` is empty, so the build differs from the v12-measured build by
**exactly one change** — #155's 100-line fix on the custom arm's report-validation path.

> **Read §AI8 before quoting any figure below.** This pass tests the rubric clauses on the
> distribution they were fit to: the same five seeds, the same two report formats, the same
> instance. §AG and §AH were written against twelve flagged v12 rows drawn from exactly this
> population. A strong determinacy result is therefore **the minimum the clauses must clear, not
> evidence that the rubric is determinate in general.**

---

## 1. The twenty rows

| row | arm | seed/rep | RCL | FTC | EV | FUU | total | gate | ambiguous |
|---|---|---|---|---|---|---|---|---|---|
| 01 | native | 01/1 | 2 | 2 | 1 | 1 | **6/6** | **1** | no |
| 02 | custom | 01/1 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 03 | native | 01/2 | 2 | 2 | 1 | 1 | **6/6** | **1** | no |
| 04 | custom | 01/2 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 05 | native | 02/1 | 0 | 1 | 1 | 0 | 2/6 | 0 | no |
| 06 | custom | 02/1 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 07 | native | 02/2 | 0 | 2 | 1 | 0 | 3/6 | 0 | no |
| 08 | custom | 02/2 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 09 | native | 03/1 | 2 | 2 | 1 | 0 | 5/6 | 0 | no |
| 10 | custom | 03/1 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 11 | native | 03/2 | 2 | 2 | 0 | 0 | 4/6 | 0 | no |
| 12 | custom | 03/2 | 2 | 0 | 1 | 0 | 3/6 | 0 | no |
| 13 | native | 04/1 | 2 | 2 | 1 | 0 | 5/6 | 0 | no |
| 14 | custom | 04/1 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 15 | native | 04/2 | 2 | 2 | 1 | 0 | 5/6 | 0 | no |
| 16 | custom | 04/2 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 17 | native | 05/1 | 2 | 2 | 0 | 1 | 5/6 | **1** | no |
| 18 | custom | 05/1 | 0 | 1 | 0 | 0 | 1/6 | 0 | no |
| 19 | native | 05/2 | 2 | 2 | 1 | 1 | **6/6** | **1** | no |
| 20 | custom | 05/2 | 0 | 1 | 0 | 0 | 1/6 | 0 | no |

RCL = `root_cause_layer_correct`, FTC = `fix_target_correct`, EV =
`evidence_cites_trace_and_config`, FUU = `fix_usable_unedited`.

**Valid rows: 10 per arm, 0 void in the scored set.** One void occurred and was replaced before
scoring — see §4.

---

## 2. The gate, both arms together

§AD7 requires these two figures to be quoted together and never singly.

| arm | valid rows | passes_gate | points |
|---|---|---|---|
| native (Agent Doctor) | 10, 0 void | **4 / 10 — 40.0%** | 47 / 60 |
| custom (`x_snc_troubleshoot`) | 10, 0 void | **0 / 10 — 0.0%** | 5 / 60 |

Against v12 on the same seeds: native 3/10 (30.0%), custom 0/10 (0.0%).

**The milestone criterion (Ruling 3) is not met.** It is met iff the custom arm reaches §A3.3's top
band (≥ 80%). The custom arm scored 0.0%, as it did in v12.

**§A3.4's floor is satisfied for both arms** — 10 valid rows each, so both are evaluable normally.

### 2.1 The single-variable reading, stated with its limit

§AH7's setup was that v13's custom arm is a single-variable re-measurement: the only source change
since the v12 rows is #155's fix on the custom arm's report-validation path. That change is visible
in the row data — two custom rows (04, 16) terminated `failed (fix_report rejected, could not be
repaired)`, on **two different validator rules**: row 04 for an unsupported sweep claim (a layer
marked SWEPT with no tool behind it), row 16 for an evidence-count shortfall (an UNCONFIRMED
trace-only root cause citing fewer evidence items than layers claimed swept).

**It did not move the gate.** Custom was 0/10 before the change and is 0/10 after. What the
validator rejects is the *shape* of a report; the gate asks whether the run reached the expected
layer and produced an applicable fix, and on this evidence the custom arm's misses are upstream of
report shape — eight of ten custom rows scored `root_cause_layer_correct` = 0.

---

## 3. The determinacy outcome — Ruling 4, the primary result

**Zero of twenty rows were flagged ambiguous.** v12 flagged twelve of twenty, carrying fourteen
flags across those twelve rows.

Two independent signals agree, and they were collected independently by construction: every verdict
table reads `ambiguous | no`, and **not one verdict emitted an `### ambiguity` section** — the
scorer instruction required that section if and only if the flag was `yes`. A mechanical scan of
`scoring-v13/results/` finds zero files matching `/^### ambiguity/`.

### 3.1 What this does and does not license

It clears the bar §AG and §AH were written to clear. It does not show the rubric is determinate,
and three things in this pass's own evidence bound the claim:

- **§AI8's in-sample caveat governs.** Same seeds, same report shapes, same instance, and the
  clauses were fit to twelve flagged rows from this exact population.
- **Two verdicts record a close call in prose without flagging it.** Row 04's scorer states it "had
  to choose between two readings of §A1 Case 3" and resolved it on the case's own words. Row 05's
  works through §A2.3's 1-band-primary-only restriction at length, states that applying it literally
  yields 0, and awards 1 on the rule's stated purpose. Both are exactly the kind of under-
  determination the flag exists to catch, and in both the scorer reasoned to a resolution instead.
  Whether that is the clauses working or the flag threshold sitting too high is **not settled by
  this pass**, and §AJ carries it as the open question.
- **A flag count of zero cannot distinguish "no ambiguity" from "no ambiguity a scorer chose to
  declare."** v12's twelve flags were produced under the same instruction, which is the reason the
  comparison is worth anything at all — but it is a comparison of two counts, not a measurement of
  the underlying property.

---

## 4. The void, and the rule that governs it

Row 05 (native, seed 02 rep 1) was run twice. The first attempt — plan
`21f5868b2b6e0b18f243fed2ce91bf29`, TR1000272 — ran 495s, made 18 tool calls across all seven tool
types, then took four consecutive ReAct turns of 68.2s / 70.8s / 72.9s / 85.6s against a ~13s LLM
P95 on rows 01–03, and closed `state: terminated`, `state_reason: execution_failed` with **no Fix
Report**. The tool ceiling was not reached (18 of 25) and no fixture was disturbed.

§A3 does not name this condition: its definition is seed-state ("the seed was not in the state its
spec requires"), and seed 02's fixture was intact and `completed`. It was ruled **void** under
§4.1 of the raw-evidence file, on two conditions that are the point of the ruling:

1. **It is symmetric** — a custom-arm run terminating the same way is void on identical terms.
2. **It was committed before the replacement fired** (`77d0d44`), so `git log -p` shows the rule
   predating the row it governs. §AI6 seals tallies precisely so a classification cannot be made
   once its effect is visible, and the effect genuinely cut both ways: the void removed a row that
   would have scored zero on an absent report, and spent one of three permitted native re-runs.

**Re-runs used: 1 of 3, native arm. 0 of 3, custom arm.** The replacement scored 2/6, gate 0.

---

## 5. What this scorecard does not establish

Everything in §T8, §Z5, §AB5, §AC8, §AG5, §AH6 and §AI8 stands unsoftened. Specific to this pass:

- **It is not a rate.** Ten runs per arm on five seeds is not a population, and §T8's not-a-rate
  limit is carried verbatim.
- **The 40.0% / 0.0% split is not a like-for-like capability comparison.** The arms differ in
  invocation, in tool budget consumption, and — as rows 06, 08, 10, 12 and 16 record in their
  operator notes — in whether the call that answered the harness HOLD touched the seed's own fixture
  at all. Five custom rows answered a layer HOLD against an out-of-box or invented table
  (`incident.priority`, `incident.assignment_group`, `sn_aia_agent_tool_m2m`, `sysrule_routing`).
  That is recorded as measured; what it means about the arm is not settled here.
- **`evidence_cites_trace_and_config` moved against native on two rows (11, 17)** where earlier
  comparable rows scored 1. Both turned on §A1 Case 3/Case 5 — whether the root-cause statement
  *names* the artifact its citation names. This column is not a gate term and did not change any
  row's gate value, but it is the column where the clauses bit hardest this pass.
- **The custom arm's two validator rejections are not scored differently from its other rows.**
  Both scored 0/6, as did four custom rows that produced accepted reports. The rejection is visible
  in `terminal`, not in the columns.
