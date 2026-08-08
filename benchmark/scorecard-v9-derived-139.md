# The v9 rows re-read under §A2.1 — derived, published beside the original

*Created 2026-08-07, issue #139. Branch `fix/139-fix-usable-unedited-clauses`.*

## What this file is, and what it is not

**It is** a re-application of `scorecard-template.md` **§A2.1** — the two clauses added by this
issue to decide the cases `fix_usable_unedited` left open — to facts the twelve blind scorers of
the v9 pass **already recorded** in `benchmark/scoring-v9/results/row-{01..12}-result.md`.

**It is not:**

- **not a new measurement.** No run was executed, no packet was re-read, no instance was touched.
- **not a re-scoring.** No row was re-judged. Only `fix_usable_unedited` is in scope, and only
  where a scorer recorded the fact the clause turns on. The other three rubric columns are
  reproduced from `scorecard-v9.md` verbatim and were not examined.
- **not a replacement for `benchmark/scorecard-v9.md`.** That file is **untouched** and remains
  the record of what the twelve blind scorers produced. It is the primary artefact; this one is
  derived from it and is meaningless without it. `git diff benchmark/scorecard-v9.md` prints
  nothing on the commit that adds this file.

## Method

Every cell below is sourced to a quotation from that row's own result file or from the seed spec,
cited inline with its file and line. §A2.1 is applied as written in `scorecard-template.md` at the
time of writing — Case 1 (an unfilled value slot) and Case 2 (a fix addressing a runtime record) —
together with the §A precondition both cases are subordinate to (`fix_usable_unedited` may not be 1
while `fix_target_correct` is 0; check it first). No row was re-judged on `root_cause_layer_correct`,
`fix_target_correct` or `evidence_cites_trace_and_config`, and no row's other three columns are
touched. Where a row's recorded reasoning does not answer the clause, the row is listed as
unresolved rather than decided — see §"Rows this re-reading could not resolve".

### The seed-04 premise, verified at source

The one changed result rests on a claim about seed 04, and it was verified in the seed spec rather
than inherited. `benchmark/seeds/seed-04-genai-unmapped.md:188-192`, "Expected diagnosis":

> Fix target: **capability mapping** — repoint `api` at the real provider integration subflow (the
> healthy value for a Now LLM Generic definition on gpinst01 is `936e514a53b3b110f028ddeeff7b128c`,
> used by 422 of the 2026 definition rows) — not the tool script and not the agent instructions.

The premise holds. A value held by 422 of the instance's 2026 `sys_one_extend_capability_definition`
rows is reachable by `query_table` over that table — it is one of the seven diagnostic tools §A2.1
Case 1 enumerates. So for a seed-04 fix that names the right record and field but leaves the
replacement `api` value unfilled, Case 1's **second** condition fails, and the column scores 0.

**The value is itself a listed blind-rule token, and that does not change the result.** Row 05's
scorer records both halves in one sentence — the run *"could not be expected to have been told it —
but nothing stopped the run from discovering it, and it did not"* (`row-05-result.md:120-122`).
Case 1 condition 2 asks whether the value is **obtainable from the instance**, not what the run was
told, so a withheld *value* is disposed of by the clause as written. A withheld *identifier* is a
different question — condition 1's specification test, which §A2.1 does not address — and that is
why row 10 is listed as unresolved below while these two are decided.

### How the two cases interact where both apply (rows 05 and 06)

Rows 05 and 06 present both shapes at once: an unfilled value slot *and* an address expressed as a
runtime record. §A2.1 Case 1 is phrased as a **necessary** condition — "Score `fix_usable_unedited`
= **1** only if BOTH hold" — while Case 2 is phrased as a sufficient-looking test of the address.
The necessary-condition phrasing governs: passing Case 2's address test does not lift Case 1's bar.
This reading is stated here because it is load-bearing for the two cells that change.

---

## The row table

`arm`, `seed`, the other three rubric columns and the original `fix_usable_unedited` are reproduced
from `scorecard-v9.md` §1. Line references are to the row's result file unless marked otherwise.

| Row | Arm / seed | §A2.1 case | Operative recorded fact (quoted) | Old | **New** | Old gate | **New gate** |
|---|---|---|---|---|---|---|---|
| 01 | native 01 | Case 2 | "The **Target** is named as the platform record `sn_aia_tool`, field `script`, rather than the Fluent source that generates it… naming the runtime record is an addressing convention, not an edit to the fix" (:178-183); "Insertion point is unambiguous — the report quotes the exact current line it replaces" (:164-165) | 1 | **1** | 1 | **1** |
| 02 | native 01 | Case 2 | "only the address is expressed in runtime rather than source terms, and the address is unambiguous (one tool, one script field)" (:133-134); target is "a runtime record (`sn_aia_tool` sys_id `8953…`, field `script`)" (:127-128) | 1 | **1** | 1 | **1** |
| 03 | native 03 | Case 1 | Fix names "**Target type 'Data'**, target `Table x_snc_tsbench_routing`… 'Insert at minimum one row with `category = Hardware` and `assignment_group = <correct group name>`'" (:84-86); on the slot: "business content that was never present anywhere on the instance — not in the table, not in the tool, not in the trace. No diagnosis, however good, could recover it" (:141-144) | 1 | **1** | 1 | **1** |
| 04 | native 03 | Case 1 | "'Insert at minimum one row with `category = Software` and `assignment_group = <the correct group name>`'" (:167-168); "The table is empty; there is no record of what group 'Software' should route to. No correct diagnosis could have supplied that value" (:181-184) | 1 | **1** | 1 | **1** |
| 05 | native 04 | Case 1 | Target fully specified — "target table, target record sys_id, target field, current value, and the exact semantics of the change" (:114-115). Value slot unfilled and **obtainable**, quoted without elision because the clause it contains is the one §A2.1 does not turn on: "The seed spec's expected diagnosis names the healthy gpinst01 value (`936e514a53b3b110f028ddeeff7b128c`, used by 422 of 2026 rows); the report does not reach it. Note that this value is **a listed blind-rule token, so the run could not be expected to have been told it** — but **nothing stopped the run from *discovering* it, and it did not**" (:118-122) | 1 | **0** | 1 | **0** |
| 06 | native 04 | Case 1 | Target fully specified — "the table, sys_id, field, current value and required semantics are all exact" (:122-123). Value slot: "Fix 1 does **not** supply a concrete replacement sys_id. It supplies a description of the required value… and a three-step discovery procedure whose step 1 is a **UI** action" (:107-111); the healthy value is "`936e514a53b3b110f028ddeeff7b128c`, used by 422 of 2026 rows on gpinst01" (:112) | 1 | **0** | 1 | **0** |
| 07 | custom 01 | §A precondition binds | "§A's explicit constraint: `fix_usable_unedited` may not be 1 while `fix_target_correct` = 0. It is 0, so this is 0"; independently "`fix_report` is `null`… there is no fix the builder AI could apply as written at all" (:104-109) | 0 | **0** | 0 | **0** |
| 08 | custom 01 | neither case arises | Column already fails its base test on the merits: "'Ensure priority_stored reflects the actual database value' specifies an outcome, not a change — no mapping table, no `getValue` read-back, no field, no code" (:172-175) | 0 | **0** | 0 | **0** |
| 09 | custom 03 | neither case arises | "The proposed fix is *'validate routing rules table contains entries for Hardware category'* — an instruction to **verify**, not a change a builder AI can apply. It names no table (`current` is literally 'unknown routing rules data source')" (:127-130) | 0 | **0** | 0 | **0** |
| 10 | custom 03 | Case 1 — **unresolved**, see below | "What it leaves open is which assignment group to point the rule at. The seed spec does not constrain that either — the table is empty by design" (:127-130) — *but the same scorer also records* "the fix names *what* to create and *for which category*, **but not the table**" (:165-168) | 1 | **unresolved (1 or 0)** | 0 | **0** |
| 11 | custom 04 | neither case arises | "'Validate api and connection fields in `sys_one_extend_capability_definition`', with `current` recorded as 'unknown (requires genai_log inspection)', is an instruction to investigate… no current value, no target value, no change specified" (:92-96) | 0 | **0** | 0 | **0** |
| 12 | custom 04 | §A precondition binds | "`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0. `fix_target_correct` = 0, so this is 0 by rule"; independently "'Validate input schema matches ticket table fields'… an instruction to investigate, not a change a builder AI could apply as written" (:125-133) | 0 | **0** | 0 | **0** |

**Two cells change: rows 05 and 06, 1 → 0.** Both flip `passes_gate`, because §A2 consumes this
column as one of its two terms and both rows carry `root_cause_layer_correct` = 2.

### Rows this re-reading could not resolve

**One: row 10.** It is listed rather than decided, and it is the one place this file departs from
the expectation written into the task brief.

§A2.1 Case 1 requires **both** conditions. Condition 2 is clearly satisfied — the assignment group
is the same unrecoverable business content as rows 03 and 04, and the scorer says so. Condition 1 —
"the target and the operation are fully specified — the table or record, the field, and what to do
to it" — is where the recorded facts point two ways in the *same* result file:

- Toward **1**: the fix "specifies the record type to create (an assignment-group routing rule), the
  category value (`Software`), the quantity (at least one), and a verification step" (:125-127).
- Toward **0**: "the fix names *what* to create and *for which category*, but not the table and not
  the assignment group the rule should point at, so the builder would have to supply at least one
  value the fix does not state" (:165-168). Rows 03 and 04 name `x_snc_tsbench_routing` explicitly;
  row 10 names no table or record at all.

The scorer resolved it to 1 on a ground §A2.1 does not contain — that `x_snc_tsbench_routing` is a
**blind-rule token deliberately withheld from the diagnostic agent**, so "scoring its absence as a
usability defect would penalise the run for the benchmark's own instrumentation" (:172-174). §A2.1
says nothing about blind-rule tokens, and deciding whether an instrumentation-withheld identifier
still counts as "the table or record… fully specified" would be forming a fresh opinion, which this
file does not do.

**What is resolved for row 10 regardless:** its `passes_gate` is **0** under either reading, because
`root_cause_layer_correct` = 0 and §A2's expression is a conjunction. Only the row's /6 total is
open: **3** under the scorers' reading, **2** under the strict condition-1 reading. Consequently the
custom **gate** figure is invariant and only the custom **rubric total** carries the open range.

*(Follow-up for whoever next revises §A2.1: Case 1 condition 1 does not say how to treat a target
identified by kind rather than by name when the name is a blind-rule token. Row 10 is the only row
in this pass that hits it.)*

---

## Totals, with their derivation

> Native `passes_gate` **6/6 → 4/6**. Native totals **36/36 → 34/36**. Custom **0/6 and 9/36,
> unchanged** — `root_cause_layer_correct` = 0 on all six custom rows and was flagged ambiguous on
> none, so custom's gate result is invariant under every resolution of this column (§T5).

**Arithmetic check, done by hand against the untouched original.**

| | native | custom |
|---|---|---|
| `sum(passes_gate)`, `scorecard-v9.md` §2 | 6 | 0 |
| Rows whose `fix_usable_unedited` flips 1 → 0 | 2 (rows 05, 06) | 0 |
| Of those, rows with `root_cause_layer_correct` = 2, so the gate flips | 2 | — |
| **Derived `sum(passes_gate)`** | 6 − 2 = **4** | **0** |
| Rubric total, `scorecard-v9.md` §2 | 36 / 36 | 9 / 36 |
| Points lost (1 per flipped cell) | 2 | 0 confirmed |
| **Derived rubric total** | 36 − 2 = **34 / 36** | **9 / 36** |

Row-by-row native totals after the re-reading: 6, 6, 6, 6, **5**, **5** = 34. Confirmed against the
per-row sums, not re-derived from the arm figure.

**The one qualification on the custom total.** Custom's `sum(passes_gate)` = **0** is fully
resolved: all six custom rows carry `root_cause_layer_correct` = 0, so the conjunction fails
regardless of this column. The custom rubric **total** is **9/36** under the scorers' reading and
would be **8/36** if row 10's open cell resolved to 0 — see "Rows this re-reading could not
resolve". The 9/36 figure above is the one carried forward, with that range stated rather than
hidden.

**Test suite:** `npx jest` → **1371 passed, 28 suites**, unchanged. This file adds no tests and no
code; the suite is reported only as evidence that nothing was disturbed.

---

## Limits

1. **This changes the instrument's *reading* of twelve existing rows. It is not a new pass.** It
   adds no rows, no seeds and no reps. §T8's limits stand in full and unamended: no rate, no Task 12
   band verdict, direction not magnitude. Twelve rows, three seeds, one instance, one day, one
   model, one app version still measures a flip, not a frequency.
2. **The derived native figure lands between §T5's two published bounds, not at either.** §T5's
   table gives "As scored" at native 36/36 · 6/6 and "Every native `fix_usable_unedited` resolved to
   0" at native 30/36 · 0/6. The derived reading gives **34/36 · 4/6** — inside that interval — and
   it moves **against** the arm this project currently recommends. That is evidence the clause was
   **not selected to produce a result**. It is **not** evidence that the clause is correct.
3. **§T3 is untouched.** Six custom rows reached layer 4 and all six concluded at layer 1;
   `root_cause_layer_correct` = 0 on all six was flagged ambiguous on none. Nothing in this file is
   evidence about diagnostic quality in either direction, for either harness. A native row losing a
   point does not make the custom arm better, and the custom arm's invariance does not make it
   worse.
4. **The under-determination this closes was real and is now closed only for these two cases.**
   §A2.1 decides an unfilled value slot and a runtime-record address. It does not make
   `fix_usable_unedited` mechanical in general — row 10 is the standing counter-example, and it is
   listed above rather than smoothed.
5. **Scoring reasoning is quoted, not re-derived.** Where a scorer's recorded reasoning was thinner
   than the clause needs, that is stated (row 10) rather than filled in. Row 01's result file, for
   instance, does not record a target sys_id the way row 02's does; the quotation used is the
   scorer's own characterisation of the address, and nothing beyond it was supplied.

---

## Pointers

- Decision record: `benchmark/DECISION.md` §Z (added by the same issue), and §T5 / §T3 / §T8 for
  what the v9 pass did and did not establish.
- Rubric text applied: `benchmark/scorecard-template.md` §A, §A2, **§A2.1**.
- Untouched original: `benchmark/scorecard-v9.md`.
- Issue: **#139**.
