# Scoring Packet — Seed 03, Run 1

This packet contains everything needed to score one diagnostic run against the rubric below.
Score it as a run to be graded.

---

## 1. Rubric

### A. The 6-point rubric

| Column | Points | What it scores |
|---|---|---|
| `root_cause_layer_correct` | 0 or 2 | Diagnosis names the seed's expected root-cause layer (see the seed's own spec file for the expected value) |
| `fix_target_correct` | 0, 1 or 2 | Diagnosis names the correct fix target (tool schema / instruction text / data seeding / capability mapping / activation). **1 = partial**: the right area, without the specific target. See the partial-credit note below |
| `evidence_cites_trace_and_config` | 0 or 1 | Root cause cites BOTH the execution trace AND at least one config/schema source — the evidence rule from `docs/agent/agent-doctor-instructions.md` |
| `fix_usable_unedited` | 0 or 1 | The Fix Report's proposed fix could be applied by the builder AI as written, with no manual editing first — **and it addresses the defect the seed actually carries.** A well-formed fix aimed at the wrong target is a no-op, not a usable fix, so **`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0.** See the note under the gate rule for why this constraint lives here rather than in the gate expression |

**Total: 6 points per run.**

**Why `fix_target_correct` has a partial band.** It was 0-or-2, while
`seeds/seed-05-inactive-usecase.md` instructs the scorer to award *partial*
credit for naming "inactive" without naming which of the two activation gates is
off — an instruction the scale could not express, leaving the scorer to round
arbitrarily in either direction. The 1 band resolves it. Seed 5 is the only seed
that currently defines a partial case; for the others, 1 is available but must be
justified in `notes` if used.

### A2. `passes_gate` — the column the gate actually consumes

The rubric scores each run **out of 6**. The gate in `docs/IMPLEMENTATION_PLAN.md`
Task 12 counts **runs**: *"≥ 8/10 runs with correct root cause + usable fixes."*
Nothing connected the two, so two different 4/6 runs could be opposite verdicts —
correct cause with an unusable fix, versus wrong cause with a usable fix and
cited evidence — and whoever writes `benchmark/DECISION.md` would have invented
the aggregation rule on the spot, on the most expensive decision in the project.

**The rule, derived from the gate's own wording.** "Correct root cause + usable
fixes" names exactly two of the four rubric columns, so:

```
passes_gate = 1  if and only if  root_cause_layer_correct == 2
                                 AND fix_usable_unedited == 1
              0  otherwise
```

Nothing else feeds it. `evidence_cites_trace_and_config` and
`fix_target_correct` are **not** in the gate expression — they are diagnostic
detail that explains *why* a run passed or failed and must still be filled in,
but a run does not pass by accumulating them. A run can score 3/6 and pass; a run
can score 4/6 and fail. That is not an inconsistency to be smoothed over in
`DECISION.md` — it is the gate asking a narrower question than the rubric.

**Why `fix_target_correct` still constrains the gate indirectly, and why that is
not a third term** (added 2026-08-01, PR #33 review round 2). Excluding
`fix_target_correct` from the expression opened a hole big enough to swallow the
R-22 decoy. Seed 4 carries an empty `connection` deliberately, as a normal state
dressed as a defect; a run that falls for it names the right **layer**
(`genai_stack` → `root_cause_layer_correct` = 2) and proposes "bind a connection
alias" — a fix that is perfectly well-formed and fixes **nothing**, because the
real break is a dangling `api`. Under a purely formal reading of "applied as
written", that run scored `fix_usable_unedited` = 1 and **passed the gate**,
making the decoy's `fix_target_correct` = 0 inert. A decoy with no scoring
consequence is not a decoy.

The fix is in the column definition, not the expression: a fix aimed at the wrong
target is not usable, so `fix_usable_unedited` = 0 whenever
`fix_target_correct` = 0. The gate keeps the two-term shape the Task 12 wording
actually specifies — *"correct root cause + usable fixes"* — and "usable" now
means what the word means. **A scorer who marks a decoy run 2 / 0 / 1 has
mis-scored it**; the correct row is 2 / 0 / 0, `passes_gate` = 0.

**The gate verdict** is `sum(passes_gate) / <number of valid runs>`, read against
the Task 12 gate table. Record the sum explicitly in `DECISION.md`; do not
re-derive it from the /6 totals.

### A3. Void runs — a run that measured nothing

A run is **void** when the seed was not in the state its spec requires, so the
run tested something other than the seeded defect. It is neither a hit nor a
miss, and scoring it either way corrupts the gate.

Known void conditions, both from the seed specs:

- **Seed 5** — the `sn_aia_trigger_agent_usecase_m2m` gate was not turned on
  post-install, so *both* activation gates were off and the seed isolated
  nothing. (Also void if the trigger fails to fire for the unresolved SDK 4.9.0
  run-as reason — see that seed's spec.)
- **Seed 4** — the capability sys_id in the installed `sn_aia_tool.script` does
  not match the target instance's `sys_one_extend_capability` record (originally:
  the `REPLACE_WITH_SEED_04_CAPABILITY_SYS_ID` placeholder was not substituted;
  since Task 12 the Fluent source hardcodes **gpinst01's** sys_id
  `92ff62af516741769c437feb88c80ef3`, which is equally void on any *other*
  instance until re-substituted — see the seed spec's Setup step 2). Either way
  the tool tests a malformed reference rather than an unmapped provider. A
  hardcoded value that MATCHES the instance's record is a valid install, not a
  void.

**How to record one.** Put `void` in `passes_gate` — not `0` — write the reason
in `notes`, and leave the four rubric columns blank. A blank rubric with a stated
reason is honest; a `0` is a measurement that did not happen.

**What a void row does to the denominator.**

1. A void row counts in **neither** the numerator nor the denominator. The
   denominator is the number of **valid** runs, not 10.
2. **Void runs should be re-run**, not absorbed. Fix the setup, run the seed
   again, and score the replacement. Voidness is a property of the run, not of
   the seed.
3. If a void run cannot be made valid, the gate is read as
   `sum(passes_gate) / <valid runs>` against the **same proportions**, and
   *all three* bands are proportional — not just the top one. The
   `IMPLEMENTATION_PLAN.md` Task 12 bands are `≥ 8/10`, `5–7/10` and `< 5/10`,
   which are:

   | Band | Proportion of valid runs | Outcome |
   |---|---|---|
   | Top (`≥ 8/10`) | **≥ 80%** | Native is the front door |
   | Middle (`5–7/10`) | **≥ 50% and < 80%** | Native for lightweight triage + custom deep-diagnosis harness |
   | Bottom (`< 5/10`) | **< 50%** | Full custom harness as designed |

   Edges are **inclusive at the bottom of each band** (`≥`), and the comparison
   is on the proportion — do **not** round the pass count to a /10 equivalent
   first. Worked example, because this is the case that had no stated answer:
   **8 valid runs, 4 passes = 50.0% → middle band.** At 8 valid runs the bands
   are 7–8 passes (top), 4–6 (middle), 0–3 (bottom); at 9 valid runs, 8–9 (top),
   5–7 (middle), 0–4 (bottom). `DECISION.md` must show the percentage it read,
   not only the fraction.
4. **Floor: below 8 valid runs the gate is not evaluable.** `DECISION.md` must
   record the outcome as *gate not met — insufficient data*, state how many runs
   were void and why, and must **not** compute a verdict from the survivors. Two
   void rows already take this to exactly 8; a third puts the benchmark under its
   own floor. This is the case the whole column exists to make visible rather
   than let a low total hide it.

---

## 2. Seed spec — `benchmark/seeds/seed-03-missing-data.md`

# Seed 03 — missing data

| | |
|---|---|
| **Expected root-cause layer** | `data` (layer 5) |
| **Expected fix target** | data seeding |
| **Fluent source** | `../seed-app/src/fluent/seed-03-missing-data.now.ts` |
| **Agent name** | Seed 03 Category Router |
| **Also stresses** | — |

## The defect

> [prior-pass observations removed — see issue #100]

The table exists, the tool queries it correctly, and the instructions are
unambiguous. The table is empty. Every lookup returns `matched: false`. This
is the seed that separates "the data is absent" from "the read failed" —
indistinguishable from a trace unless the tool reports empty reads
explicitly, which is exactly the R-6 / R-11 failure mode this project keeps
legislating against.

## Why it is built this way

Everything upstream of the data is correct: the query, the tool's contract,
the instructions telling the agent never to guess. The only thing wrong is
that `x_snc_tsbench_routing` was installed with zero rows. A diagnosis that
blames the tool or the query is chasing a layer that has no defect in it —
the tool reports the empty result honestly (`matched: false`, plus a
`rules_in_table` count), so the evidence needed to reach the correct layer is in
the trace if it is read.

**`rules_in_table` is now measured, corrected 2026-08-01.** ~~The tool reports
`rules_in_table: 0`.~~ It previously returned the literal `0` unconditionally,
with no count — which handed the diagnostic agent the seed's answer as a
constant rather than as a measured empty read, and would have reported "0 rules"
even from a populated table. It is now a real `GlideAggregate` count returned on
both the matched and unmatched paths, so the distinction the seed is built to
reward — *no rule for this category* versus *no rules at all* — is something the
tool actually establishes.

**The read ACL is part of the instrument, not housekeeping.** A layer-5 sweep
using `GlideRecordSecure` against a table with no read ACL returns zero rows
whether the table is empty or merely unreadable — which would make this seed's
defect indistinguishable from an access denial *by the very tool meant to find
it*. `seed-app/src/fluent/seed-tables-acl.now.ts` grants the read ACL for
exactly this reason (Build Rule #42). Granting `create` there does **not** seed
the table; it stays empty, and nothing in the app inserts into it.

## Setup

Install the fixture app (Task 12): `cd benchmark/seed-app && now-sdk install --alias gpinst01`.
Add no rows to `x_snc_tsbench_routing` — the emptiness is the defect.

## Trigger

Open a fresh conversation with **Seed 03 Category Router** and ask it to route
a request in any category. Capture the resulting `sn_aia_execution_plan`
sys_id.

## Expected diagnosis

Root cause in `data`: the routing table holds zero rows. Fix target: data
seeding, not the tool or the instructions. A diagnosis naming the tool or the
query is a **miss**, and the scorecard should record it as one.

## Safety

Table owned by the fixture app; created empty by design.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by `../../test/blindRule.test.js` — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 03 Category Router
x_snc_tsbench_routing
rules_in_table
```

---

## 3. Run report — full text, verbatim

Retrieved from `sn_aia_message.message` (identical to `.user_message`), sys_id
`3953d9482bea4bd417a6ffbeee91bf78`, on execution plan `c4b251042bea4bd417a6ffbeee91bf30`
(conversation `f3a2950c2baa4bd417a6ffbeee91bfb4`).

> ## Fix Report — Seed 03 Category Router · Execution `c4cd01842b6a4bd417a6ffbeee91bfc3`
>
> ---
>
> ### FAILURE SUMMARY
>
> The user asked the Seed 03 Category Router to route a hardware request ("my monitor is flickering and needs replacement"). The agent ran to completion without routing: it called `lookup_routing_rule` with `category = "Hardware"`, received `{ matched: false, rules_in_table: 0 }`, reported the miss to the user, and stopped. No routing happened because the routing data table `x_snc_tsbench_routing` contains zero rows — there is no rule for any category, including Hardware. The LLM, the tool invocation, and the agent logic all functioned correctly; only the seed data is absent.
>
> ---
>
> ### LAYERS SWEPT
>
> | # | Layer | Status | Notes |
> |---|-------|--------|-------|
> | 1 | Execution trace | **SWEPT** | `agent_trace` on execution `c4cd01842b6a4bd417a6ffbeee91bfc3` |
> | 2 | Instructions | **SWEPT** | `agent_config` section `tools` (instructions section not pulled; trace showed no instruction-path errors and the agent's reasoning was coherent — sweeping instructions would not change the finding) |
> | 3 | Tool definitions | **SWEPT** | `agent_config` tools + direct `sn_aia_tool` record read |
> | 4 | Data schemas | **SWEPT** (implicitly) | `query_table` confirmed table `x_snc_tsbench_routing` exists with columns `category` and `assignment_group` — no field warnings, schema is sound |
> | 5 | Data | **SWEPT** | `query_table` on `x_snc_tsbench_routing` — genuinely empty, unfiltered count = 0 |
> | 6 | GenAI stack | **SWEPT** | `genai_log` mode `for_execution` — two LLM calls, both status `success`, no errors |
> | 7 | Trigger and wiring | **NOT SWEPT** | The trace confirmed the agent was invoked and ran through completion; `agent_config` showed `sn_aia_usecase` rows = 0 (no use-case wiring) but the interactive execution succeeded regardless. Sweeping triggers would not change the routing-data finding. |
> | — | Platform logs | **NOT SWEPT** | `log_analysis` was not called. The trace showed zero script errors, all task statuses were `success`, and the tool returned a well-formed JSON response — no log evidence was expected. An instance administrator can enable cross-scope log access if a future investigation requires it. |
>
> ---
>
> ### ROOT CAUSES
>
> **Root Cause 1**
>
> | Field | Value |
> |-------|-------|
> | Layer | 5 — Data |
> | Component | Table `x_snc_tsbench_routing` |
> | Finding | The table is genuinely empty. No routing rules exist for any category. |
> | Evidence | `query_table` on `x_snc_tsbench_routing`, unfiltered count = 0, verdict = `genuinely_empty` (table `x_snc_tsbench_routing`, all rows, status `empty`). Corroborated by tool response in execution task `06cd45842b6a4bd417a6ffbeee91bf9c`: `{ ok: true, matched: false, category: "Hardware", rules_in_table: 0 }`. |
> | Confidence | **CONFIRMED** — two independent reads (tool at runtime + diagnostic query) agree the table is empty. |
>
> ---
>
> ### FIXES
>
> **Fix 1 — Seed the routing table**
>
> | Field | Value |
> |-------|-------|
> | Target type | Data |
> | Target | Table `x_snc_tsbench_routing` |
> | Current | 0 rows |
> | Proposed | Insert at minimum one row: `category = "Hardware"`, `assignment_group = <target group sys_id>` (e.g., the Hardware support group). Add further rows for every category the router is expected to handle. |
> | Rationale | The tool script performs `gr.addQuery('category', inputs.category); gr.query()` — it can only match what exists. Without rows, every lookup returns `matched: false` regardless of the input. |
>
> ---
>
> ### VERIFICATION
>
> 1. Insert the Hardware rule into `x_snc_tsbench_routing`.
> 2. Re-run the same objective: *"Please route this hardware request: my monitor is flickering and needs replacement."*
> 3. Confirm the new execution's `lookup_routing_rule` tool call returns `{ matched: true, category: "Hardware", assignment_group: "<name>" }`.
> 4. Confirm the agent's final message names the resolved assignment group rather than reporting no match.
>
> ---
>
> ### SECONDARY FINDINGS (non-blocking, recommended)
>
> The tool-quality checker flagged four medium-severity smells on `lookup_routing_rule` (tool sys_id `3bd31a0be63d4e81856598dbd2c96788`):
>
> - **No negative guidance** in the description — add a sentence saying what the tool does NOT do (e.g., "does not create rules").
> - **No output guidance** in the description — document the returned JSON shape.
> - **No input validation** — add a guard at the top of the IIFE that returns an explicit error when `inputs.category` is absent or non-string.
> - **Unbounded query** — add `gr.setLimit(1)` since only one matching rule is needed.
>
> None of these caused the current failure, but they are quick wins that reduce future diagnostic ambiguity.
>
> ---
>
> ### DATA MARKERS
>
> The following record data was quoted as evidence and should be redacted before this report crosses the instance boundary:
>
> - User profile message (seq `19fc016ab190000001`): email `admin@example.com`, name "System Administrator", sys_id prefix `6816f79cc0a8016401c…`
> - Execution plan sys_id: `c4cd01842b6a4bd417a6ffbeee91bfc3`
> - Conversation sys_id: `44cd85402b6a4bd417a6ffbeee91bf79`
> References: null

---

## 4. Measurements recorded in the 2026-08-02 scorecard

These four values were not recomputed today — they are copied as-is from
`benchmark/scorecard-agent-doctor.md`'s row for this run.

| Field | Value recorded in the 2026-08-02 scorecard |
|---|---|
| `layers_swept` | 4/7 (L1,L3,L5,L6) |
| `layers_available` | 7/7 (measured) |
| `tool_calls` | 9 |
| `wall_clock` | 172s |
