# Scoring Packet — Seed 05, Run 1

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

## 2. Seed spec — `benchmark/seeds/seed-05-inactive-usecase.md`

# Seed 05 — use case exists but is inactive

| | |
|---|---|
| **Expected root-cause layer** | `wiring` (layer 7) |
| **Expected fix target** | activation |
| **Fluent source** | `../seed-app/src/fluent/seed-05-inactive-usecase.now.ts` |
| **Agent name** | Seed 05 Ticket Acknowledger |
| **Workflow** | Seed 05 Ticket Acknowledgement |
| **Also stresses** | — |

## The defect

> [prior-pass observations removed — see issue #100]

`sn_aia_trigger_configuration.active` is `false`. Everything else is correct
and published: the agent's instructions are fine, the workflow is published,
the trigger targets the right table (`x_snc_tsbench_ticket`) on the right
event (`record_create`), and the use case (`sn_aia_usecase`) backing it
exists — because this is an `AiAgenticWorkflow`, not a bare `AiAgent` (see
below). Nothing fires, and the reason is a single deactivated gate, not a
missing or malformed configuration.

**Trigger condition corrected 2026-08-01.** ~~The trigger condition is
`active=true`.~~ `x_snc_tsbench_ticket` declares only `short_description` and
`priority` and extends nothing, so there is no `active` column and that
condition could never have matched — even with both gates on. A diagnosis
naming the bogus condition would have been *correct* and scored a miss. The
condition is now `short_descriptionISNOTEMPTY`, which matches exactly the rows
the setup step inserts.

## Why this is a workflow and not a bare agent

Build Rule #31: `triggerConfig` on a bare `AiAgent` is accepted without a
build error but yields a `sn_aia_trigger_configuration` whose `usecase` is
**null** — `AiAgent` has no usecase field, only `AiAgenticWorkflow` creates
the `sn_aia_usecase` record the trigger binds to. A bare-agent version of
this seed would fail to fire for a *different* reason than the one under
test (no backing flow/BR at all, from a null usecase), with no diagnostic
signal distinguishing it from the intended defect. Using `AiAgenticWorkflow`
means the only thing wrong is the one gate this seed sets out to test.

## The two gates

LLD §8 item 2 (R-18) established that use-case activation has **two
independent gates**: `sn_aia_trigger_configuration.active` and
`sn_aia_trigger_agent_usecase_m2m.active`. A use case reads as "inactive"
to an observer when *either* gate is off — they are not the same switch and
do not imply each other. This seed turns the trigger-configuration gate
**off** and leaves the m2m gate **on**. A correct diagnosis therefore has to
name the *specific* gate that is off (`sn_aia_trigger_configuration.active`)
rather than stop at the generic observation that "the use case is inactive."
A diagnosis that only says the use case is inactive, without identifying
which gate, scores **partial**, not full, on fix target.

## The m2m gate must be turned on by hand — it is a step, not a check

**Measured in `dist/`, 2026-08-01.** ~~Before scoring any run of this seed,
confirm on the instance that `sn_aia_trigger_agent_usecase_m2m.active` is
`true`.~~ That check was guaranteed to fail. Fluent exposes exactly **one**
`active` property on `triggerConfig` and it feeds
`sn_aia_trigger_configuration`; the m2m gate has **no Fluent property at all**,
and the build plugin emits `sn_aia_trigger_agent_usecase_m2m.active=false`,
mirroring the trigger config. A plain install therefore lands **both gates
off** — verified in the emitted XML — and with both off the seed isolates
nothing, a diagnosis naming either gate is arguably right, and this seed's 2
scored rows are void by construction.

So the m2m gate is not something to confirm; it is something to **set**, as a
mandatory post-install step:

```
PATCH /api/now/table/sn_aia_trigger_agent_usecase_m2m/<sys_id>
{"active": "true"}
```

Find `<sys_id>` by querying `sn_aia_trigger_agent_usecase_m2m` for the row whose
`trigger_configuration` is the *"Seed 05 Bench Ticket Created"* trigger. Then
**re-read the record and confirm `active` returns `true`.** Do not assume the
PATCH took.

Leave `sn_aia_trigger_configuration.active` at `false` — that is the seeded
defect and the whole point of the seed.

**If this step is skipped, the seed is void.** Record both of its runs as `void`
in the scorecard (see `../scorecard-template.md` § "Void runs"); do not score
them as hits or misses.

### Also open, for Task 12 — do not guess a value for it

SDK 4.9.0 guidance (`.claude/context/sdk-reference.md`, "4.9.0 guide hardening")
states that trigger run-as configuration is now **required for all trigger
types**. This workflow sets no `runAs`, and `dist/` confirms the emitted trigger
configuration carries `run_as`, `run_as_script` and `run_as_user` all empty. The
trigger may therefore still not fire even after the m2m gate is on. If it does
not, that is a **second** wiring defect layered on the seeded one and the seed is
no longer isolating a single cause — resolve it before scoring rather than
scoring through it.

## Setup

1. Install the fixture app (Task 12): `cd benchmark/seed-app && now-sdk install --alias gpinst01`
2. **Turn the m2m gate on** and verify it reads `true` — see the section above.
   This is mandatory; skipping it voids the seed.

## Trigger

Insert a row into `x_snc_tsbench_ticket` with a non-empty `short_description`
(the trigger condition is `short_descriptionISNOTEMPTY`) and any `priority`, and
confirm that nothing fires — no execution plan is created,
no acknowledgement appears. Because the thing under test is the *absence* of
an execution, there is typically no `sn_aia_execution_plan` sys_id to hand
the diagnostic agent for this seed. Instead, give the diagnostic agent the
**agent name** (`Seed 05 Ticket Acknowledger`) and/or the **workflow name**
(`Seed 05 Ticket Acknowledgement`), plus the sys_id of the ticket row that
was inserted and should have triggered it, and ask it to determine why the
expected acknowledgement never happened.

## Expected diagnosis

Root cause in `wiring`: the trigger configuration for the "Seed 05 Bench
Ticket Created" trigger has `active=false`, while the trigger-to-usecase m2m
gate is on. Fix target: activation — flip
`sn_aia_trigger_configuration.active` to `true` on that trigger. A diagnosis
that identifies only "the use case/trigger is inactive" without naming
`sn_aia_trigger_configuration.active` specifically scores **1 of 2** on
`fix_target_correct` (the partial band — see `../scorecard-template.md` § A),
per "The two gates" above.

## Safety

Touches only the fixture app's own agent, workflow, team, and trigger
configuration, and inserts one row into `x_snc_tsbench_ticket`, owned by the
fixture app. Nothing shared is modified.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by `../../test/blindRule.test.js` — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 05 Ticket Acknowledger
Seed 05 Ticket Acknowledgement
Seed 05 Bench Ticket Created
```

Note on seed 05: `sn_aia_trigger_configuration` is its answer *and* a table
`agent_config` must query to sweep layer 7. It is deliberately **not**
declared, per the authoring rule. The seed-specific trigger and agent names
carry the same information without firing on honest code.

---

## 3. Run report — full text, verbatim

Retrieved from `sn_aia_message.message` (identical to `.user_message`), sys_id
`b19799c02b6e4bd417a6ffbeee91bf9b`, on execution plan `eb37dd002b6e4bd417a6ffbeee91bf64`
(conversation `1b37994c2b2e4bd417a6ffbeee91bf5a`).

> ## Fix Report — Seed 05 Ticket Acknowledger
>
> ---
>
> ### FAILURE SUMMARY
>
> Bench ticket `29fd09c42b6a4bd417a6ffbeee91bfb0` was created on table `x_snc_tsbench_ticket`, but no execution plan was ever produced for it and no acknowledgement was sent. The agent "Seed 05 Ticket Acknowledger" is properly configured (instructions present, use case wired, trigger link exists), but the underlying trigger configuration **"Seed 05 Bench Ticket Created"** is **inactive** (`active = 0`). An inactive trigger never fires, so the platform never created an execution plan regardless of whether the bench ticket matched the trigger condition. No execution plan exists because the trigger was switched off before — or never switched on after — the ticket was created.
>
> ---
>
> ### LAYERS SWEPT
>
> | Layer | Status | Notes |
> |-------|--------|-------|
> | 1 — Execution trace | SWEPT | `agent_trace` confirmed zero execution plans exist for this agent. |
> | 2 — Instructions | SWEPT | `agent_config` section `instructions` — instructions present (118 chars), context_processing_script present (2124 chars, boilerplate). |
> | 3 — Tool definitions | SWEPT | `agent_config` section `tools` — zero tools bound; not relevant to this failure. |
> | 4 — Data schemas | NOT SWEPT | The trace confirmed no execution ever started; a schema defect cannot explain a trigger that never fired. |
> | 5 — Data | NOT SWEPT | Same rationale — no execution reached the point of reading records. |
> | 6 — GenAI stack | NOT SWEPT | The model was never called; sweeping the GenAI stack would not add to the diagnosis. |
> | 7 — Trigger and wiring | SWEPT | `agent_config` section `triggers` — trigger found, wiring intact, trigger **inactive**. |
> | Platform logs | UNAVAILABLE | `log_analysis` is blocked by cross-scope syslog restrictions on this instance. An instance administrator must grant the `sn_log.reader` role (or equivalent) to make this layer available. |
>
> ---
>
> ### ROOT CAUSES
>
> #### RC-1 — Trigger inactive
>
> | Field | Value |
> |-------|-------|
> | **Layer** | 7 — Trigger and wiring |
> | **Component** | `sn_aia_trigger_configuration` record "Seed 05 Bench Ticket Created" |
> | **Finding** | The trigger that should fire when a bench ticket is created has `active = 0`. The platform will never evaluate its condition or launch an execution plan while it is inactive. |
> | **Evidence** | `sn_aia_trigger_configuration` · sys_id `bfb77d6c64884500a80203ee029436ee` · field `active` · value `"0"` (read via `agent_config`, artifact `2a4755402b6e4bd417a6ffbeee91bf8b`, offset 4000–8000). |
> | **Confidence** | **CONFIRMED** — the trigger record was read directly; the `active` field value is unambiguous. |
>
> #### RC-2 (secondary, advisory) — No run-as identity on trigger
>
> | Field | Value |
> |-------|-------|
> | **Layer** | 7 — Trigger and wiring |
> | **Component** | `sn_aia_trigger_configuration` · sys_id `bfb77d6c64884500a80203ee029436ee` · fields `run_as_field`, `run_as`, `run_as_script` |
> | **Finding** | The trigger names no run-as identity (`run_as_field = null`, `run_as = ""`, `run_as_script_present = false`). Once the trigger is activated, the execution will run under an identity resolved at runtime. If that identity lacks the required access roles the execution will fail at ACL. |
> | **Evidence** | `agent_config` artifact · `access_alignment.run_as` array · `identity_resolution: "none"`. |
> | **Confidence** | **UNCONFIRMED as a blocker** — this is a risk, not a confirmed failure. It can only be confirmed by inspecting a real failing run after RC-1 is fixed. |
>
> ---
>
> ### FIXES
>
> #### Fix 1 — Activate the trigger
>
> | Field | Value |
> |-------|-------|
> | **Target type** | Configuration |
> | **Target** | `sn_aia_trigger_configuration` · sys_id `bfb77d6c64884500a80203ee029436ee` · field `active` |
> | **Current value** | `0` (false / inactive) |
> | **Proposed value** | `1` (true / active) |
> | **Rationale** | An inactive trigger never evaluates its condition and never creates an execution plan. Setting `active = 1` allows the platform to evaluate the condition `short_descriptionISNOTEMPTY` on `x_snc_tsbench_ticket` inserts and launch the use case "Seed 05 Ticket Acknowledgement" as intended. |
>
> #### Fix 2 (advisory) — Set a run-as identity
>
> | Field | Value |
> |-------|-------|
> | **Target type** | Configuration |
> | **Target** | `sn_aia_trigger_configuration` · sys_id `bfb77d6c64884500a80203ee029436ee` · field `run_as_field` or `run_as` |
> | **Current value** | Both empty |
> | **Proposed value** | Either point `run_as_field` to a user-reference field on `x_snc_tsbench_ticket`, or set `run_as` to a service account that holds the required AI Agent access roles. |
> | **Rationale** | Without a declared run-as identity the execution inherits an implicit runtime identity. If that identity lacks access roles the execution will fail silently. Declaring the identity explicitly makes ACL failures visible and reproducible. |
>
> ---
>
> ### VERIFICATION
>
> 1. Open `sn_aia_trigger_configuration` record `bfb77d6c64884500a80203ee029436ee` and confirm `active` is now `1`.
> 2. Create a new bench ticket on `x_snc_tsbench_ticket` with a non-empty `short_description`.
> 3. Wait up to 30 seconds, then query `sn_aia_execution_plan` with filter `objective CONTAINS Acknowledge` and confirm a new record appears in state `Completed`.
> 4. Inspect the execution plan's task tree via `agent_trace` and confirm the agent produced an acknowledgement message restating the short description and priority.
> 5. If the execution plan appears but fails, run `agent_trace` on the new plan sys_id and check for ACL or script errors — this would surface RC-2.
>
> ---
>
> ### DATA MARKERS
>
> The following record identifiers were cited as diagnostic evidence and should be reviewed before this report crosses the instance boundary:
>
> - Bench ticket sys_id: `29fd09c42b6a4bd417a6ffbeee91bfb0` — `x_snc_tsbench_ticket`
> - Agent sys_id: `a4b7ef5d793346ea861730c6d28b8f58` — `sn_aia_agent`
> - Use case sys_id: `af15173b98ce46c3a5f35a9f7160e888` — `sn_aia_usecase`
> - Trigger sys_id: `bfb77d6c64884500a80203ee029436ee` — `sn_aia_trigger_configuration`
> - Team sys_id: `71ccfffde1364e008c716a1b0530ab16` — team record
>
> ---
>
> > **Note:** The platform log layer (layer 6) was **not swept** — it is unavailable on this instance due to cross-scope syslog restrictions. An instance administrator action is required to make it available. The diagnosis is complete without it because the trigger's inactive state is a fully confirmed root cause from configuration alone.
> References: null

---

## 4. Measurements recorded in the 2026-08-02 scorecard

These four values were not recomputed today — they are copied as-is from
`benchmark/scorecard-agent-doctor.md`'s row for this run.

| Field | Value recorded in the 2026-08-02 scorecard |
|---|---|
| `layers_swept` | 4/7 (L1,L2,L3,L7) |
| `layers_available` | 7/7 (measured) |
| `tool_calls` | 5 |
| `wall_clock` | 92s |
