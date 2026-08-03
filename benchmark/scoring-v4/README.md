# Scoring packets — v4 benchmark pass (Task 11)

This directory holds 20 self-contained scoring packets, one per scored run of
the v4 benchmark pass (5 seeds × 2 harnesses × 2 repetitions). Each packet is
intended to be handed to an **independent scorer who sees that one file and
nothing else** — not this README, not the other 19 packets, not
`benchmark/raw-evidence-v4.md`, not `benchmark/DECISION.md`, and not any of
this project's prior benchmark passes.

## Why packets exist at all

`benchmark/raw-evidence-v4.md` is the measurement record for the whole pass —
all 20 runs, side by side, with cross-run comparisons, shape-family
observations, and identity bookkeeping notes written by the person who fired
the runs. That is exactly the wrong document to hand to a scorer: the
operator and the project's own narrative already have opinions about which
runs are "supposed to" do well, and if a scorer can see another row, or the
project's prior conclusions, the verdict is contaminated before it starts.
The packets in this directory are the isolation boundary that makes the v4
scoring pass blind.

## Naming

```
row-<NN>-<harness>-seed-<SS>-run-<R>.md
```

`NN` runs 01–20 in seed order (seed 01's four rows first, ..., seed 05's four
rows last); within a seed the order is native-run-1, custom-run-1,
native-run-2, custom-run-2. `harness` is `native` (Agent Doctor) or `custom`
(`x_snc_troubleshoot`). `SS` is the seed number (01–05). `R` is 1 or 2.

| Row | File | Seed | Harness | Run |
|---|---|---|---|---|
| 01 | `row-01-native-seed-01-run-1.md` | 01 | native | 1 |
| 02 | `row-02-custom-seed-01-run-1.md` | 01 | custom | 1 |
| 03 | `row-03-native-seed-01-run-2.md` | 01 | native | 2 |
| 04 | `row-04-custom-seed-01-run-2.md` | 01 | custom | 2 |
| 05 | `row-05-native-seed-02-run-1.md` | 02 | native | 1 |
| 06 | `row-06-custom-seed-02-run-1.md` | 02 | custom | 1 |
| 07 | `row-07-native-seed-02-run-2.md` | 02 | native | 2 |
| 08 | `row-08-custom-seed-02-run-2.md` | 02 | custom | 2 |
| 09 | `row-09-native-seed-03-run-1.md` | 03 | native | 1 |
| 10 | `row-10-custom-seed-03-run-1.md` | 03 | custom | 1 |
| 11 | `row-11-native-seed-03-run-2.md` | 03 | native | 2 |
| 12 | `row-12-custom-seed-03-run-2.md` | 03 | custom | 2 |
| 13 | `row-13-native-seed-04-run-1.md` | 04 | native | 1 |
| 14 | `row-14-custom-seed-04-run-1.md` | 04 | custom | 1 (terminated `status: failed`) |
| 15 | `row-15-native-seed-04-run-2.md` | 04 | native | 2 |
| 16 | `row-16-custom-seed-04-run-2.md` | 04 | custom | 2 |
| 17 | `row-17-native-seed-05-run-1.md` | 05 | native | 1 |
| 18 | `row-18-custom-seed-05-run-1.md` | 05 | custom | 1 (terminated `status: failed`) |
| 19 | `row-19-native-seed-05-run-2.md` | 05 | native | 2 |
| 20 | `row-20-custom-seed-05-run-2.md` | 05 | custom | 2 (terminated `status: failed`) |

## What every packet contains, and only that

1. **The scoring rubric** — §A (the four scored columns and their points),
   §A2 (`passes_gate` and its exact expression, plus why `fix_target_correct`
   still constrains the gate indirectly), and §A3 (void-run rule), copied
   verbatim from `benchmark/scorecard-template.md`. Identical text in all 20
   packets.
2. **That row's seed specification, in full** — the seed's expected
   root-cause layer, expected fix target, defect mechanism, setup/trigger
   steps, scoring notes, and blind-rule tokens, from
   `benchmark/seeds/seed-0N-*.md`. Identical across the 4 packets that share
   a seed, different across seeds.
3. **That run's full report, verbatim** — the complete native Fix Report
   text, or the complete custom `fix_report` JSON. For the three runs that
   terminated `status: "failed"` (row 14, row 18, row 20 — the harness's own
   post-generation validation gate rejected the `fix_report` after retries),
   the packet instead carries the full `fix_report_rejected.report` content
   and the verbatim validation error, since that is the only record of what
   the model produced.
4. **That run's Task 10 audit-trail measurements** — `layers_swept` (with
   layer numbers), tool-call count and ordered tool-call list, LLM-call
   count, `layers_available`, terminal state, and wall clock, transcribed
   from the Task 10 master table and per-run detail in
   `benchmark/raw-evidence-v4.md`.
5. **Judgement notes specific to that run or its seed only** — e.g. a
   disagreement between a run's own claimed `layers_swept` and what the
   audit trail actually supports, or a run-specific observation about its
   own tool calls. Restated narrowly to that one row wherever the source
   material discussed it alongside other runs.

## What was deliberately excluded, and why

- **Any other row's identity, text, measurements, or outcome.** Two rows
  from the same seed (e.g. native run 1 and native run 2) are still two
  separate packets — neither may contain the other's conversation id, run
  id, report text, or scores. Cross-run "both native runs..." / "all four
  runs..." sentences in `raw-evidence-v4.md` were split apart and restated
  once per row where the underlying fact was true of that row individually,
  and dropped entirely where they were inherently a multi-run comparison
  (e.g. "all four seed 02 runs converged on 'no failure observed'" —
  the individual report text already states that row's own conclusion, so
  no comparison sentence was needed).
- **Any other seed's specification, agent/workflow names, or blind-rule
  tokens.** Each packet's seed-spec section contains only its own seed.
- **`benchmark/DECISION.md` content, and any reference to this project's
  prior benchmark passes, prior scores, expectations, predictions, or
  narrative.** Four of the five seed spec files (seeds 02–05) carry
  "OBSERVED AT TASK 12" / "History" callouts in `benchmark/seeds/*.md` that
  state how specific runs scored in an earlier pass (one names an exact
  gate-scoring split down to "2/0/1/0"; one quotes a "2/6, fail" score and
  cites `DECISION.md` directly). Those sentences were surgically removed
  from the copies embedded in the packets, replaced with a bracketed
  editorial note explaining what was cut and why. The seed's *mechanism*
  facts and its abstract scoring rules (what layer/fix-target a diagnosis
  must name, how the decoy is scored in general) were kept intact — a
  scorer needs those to grade correctly; a prior run's actual score is
  exactly the kind of contamination this pass exists to prevent. Seed 01's
  spec required no redaction — it carries no prior-pass score language.
- **Any comparison between the two harnesses**, and **any cross-row note**
  (e.g. the CAUTION notes in `raw-evidence-v4.md` that list all four runs'
  identities together to disambiguate a fixture's own prior conversation id
  from this pass's runs — useful for the person compiling the evidence file,
  but out of scope for an isolated scorer and a direct leak of sibling rows'
  identities if copied in).
- **Any statement about what a good or bad result would look like**, beyond
  what the rubric itself states.
- For the two structurally different **custom-harness report shapes** that
  appear across this pass — the `inconclusive`-keyed shape (empty
  `root_causes`, an `inconclusive.evidence_read`/`needed_to_conclude` object)
  and the populated-`root_causes` shape (a non-empty `root_causes` array with
  a `confidence` marker) — each packet describes only the shape **that row's
  own JSON has**, factually, without naming or comparing to the shape any
  other row used. How to score either shape is left to the scorer, per the
  rubric; no packet tells them how a shape should be graded.

## How the packets were built

1. Read `benchmark/raw-evidence-v4.md`, all five `benchmark/seeds/seed-0N-*.md`
   files, and `benchmark/scorecard-template.md` in full.
2. Assembled the rubric block (item 1 above) once and reused it verbatim in
   all 20 packets.
3. Redacted the four seed spec files that carried prior-pass score language
   (seeds 02–05), producing one canonical redacted copy per seed, reused
   verbatim across that seed's 4 packets. Seed 01 required no redaction.
4. For each of the 20 runs, extracted that run's own identity, prompt/body,
   terminal state, wall clock, tool-call count, and full report text from its
   seed's block in `raw-evidence-v4.md`, and its `layers_swept` / tool-call
   order / LLM-call count / `layers_available` from the Task 10 section
   (master table plus the `agent_config` refinement table and the
   disagreement notes, applied only where they were true of that individual
   run).
5. Where `raw-evidence-v4.md` carried a judgement note phrased about
   multiple runs together, restated it narrowly for the one row it was
   written into, or dropped it if it was inherently comparative and added no
   fact about that row beyond what its own report/measurements already say.
6. Verified every packet by grep for: every other seed's agent/workflow name
   and blind-rule tokens, every other row's run/conversation identity, the
   smoke-gate run's identity (a non-scored run that must never appear
   anywhere), and the string `DECISION.md`.

## Boundary this directory does not cross

These packets are inputs to Task 12 scoring, not a scorecard themselves.
Filling in `benchmark/scorecard-agent-doctor.md` (or an equivalent v4
scorecard) from 20 independently-produced verdicts, and rolling those up
against the Task 12 gate, is separate work that happens after these packets
are scored — it is explicitly out of scope for this task.
