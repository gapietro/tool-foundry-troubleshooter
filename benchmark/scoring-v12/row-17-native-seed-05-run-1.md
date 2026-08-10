# Scoring packet — Row 17

**Seed:** 05 · **Harness arm:** native (Agent Doctor, `servicenow_aia_execute`) · **Run:** 1

This packet is self-contained. It contains the scoring rubric, this seed's
specification, this run's full report, and this run's audit-trail
measurements — nothing else. Score this row using only the content below.

---

## 1. Scoring rubric

Section 1 is reproduced from this project's scoring template; section 2 is reproduced from
this seed's specification. **One deliberate change, applied to both:** repository file paths
have been replaced with plain-language descriptions of what they point at, because they are
navigable pointers to material a blind scorer must not read. The redaction is **mechanical and
touches paths only** — no rule, band, threshold, points value, measurement, setup step or
scoring note has been altered, added or removed, and no sentence has lost its meaning. This
rubric section is byte-identical in every packet.

## A. The 6-point rubric

| Column | Points | What it scores |
|---|---|---|
| `root_cause_layer_correct` | 0 or 2 | Diagnosis names the seed's expected root-cause layer (see the seed's own spec file for the expected value) |
| `fix_target_correct` | 0, 1 or 2 | Diagnosis names the correct fix target (tool schema / instruction text / data seeding / capability mapping / activation). **1 = partial**: the right area, without the specific target. See the partial-credit note below |
| `evidence_cites_trace_and_config` | 0 or 1 | Root cause cites BOTH the execution trace AND at least one config/schema source — the evidence rule from the diagnostic agent's own instructions |
| `fix_usable_unedited` | 0 or 1 | The Fix Report's proposed fix could be applied by the builder AI as written, with no manual editing first — **and it addresses the defect the seed actually carries.** A well-formed fix aimed at the wrong target is a no-op, not a usable fix, so **`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0.** See the note under the gate rule for why this constraint lives here rather than in the gate expression, and **§A2.1** for the two cases this definition does not otherwise determine — an unfilled value slot, and a fix that addresses a runtime record |

**Total: 6 points per run.**

**Why `fix_target_correct` has a partial band.** It was 0-or-2, while seed 5's
specification instructs the scorer to award *partial* credit for naming "inactive"
without naming which of the two activation gates is off — an instruction the scale
could not express, leaving the scorer to round arbitrarily in either direction. The
1 band resolves it. Seed 5 is the only seed that currently defines a partial case;
for the others, 1 is available but must be justified in `notes` if used.

## A2. `passes_gate` — the column the gate actually consumes

The rubric scores each run **out of 6**. The gate counts **runs**:
*"≥ 8/10 runs with correct root cause + usable fixes."*
Nothing connected the two, so two different 4/6 runs could be opposite verdicts —
correct cause with an unusable fix, versus wrong cause with a usable fix and
cited evidence — and whoever writes the decision record would have invented
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
the scored-pass write-up — it is the gate asking a narrower question than the rubric.

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
the Task 12 gate table. Record the sum explicitly in the decision record; do not
re-derive it from the /6 totals.

### A2.1 Two cases the column definition does not otherwise determine

*Added 2026-08-07, issue #139, after this column was found under-determined on
the majority of the rows it was applied to. The rationale is in the project's
decision record.* Because `fix_usable_unedited` is one of §A2's two gate terms,
an under-determined reading of it is not a rounding error — it changes the
verdict. Both cases below are decided by the seed spec plus the fix text.
**Neither asks the scorer to weigh anything.**

**Case 1 — the fix leaves a value slot unfilled.** Score `fix_usable_unedited`
= **1** only if BOTH hold:

1. the target and the operation are fully specified — the table or record, the
   field, and what to do to it; **and**
2. the missing value is **not obtainable from the instance** by any of the seven
   diagnostic tools (`agent_trace`, `agent_config`, `schema_lookup`,
   `query_table`, `genai_log`, `log_analysis`, `read_artifact`).

If the value **was** obtainable and the run simply **did not look it up**, score
**0**. Supplying a discovery procedure in place of the value does not change
this, and a procedure whose steps are UI actions rather than tool calls does not
make a value unobtainable.

*The distinction, stated so it is not re-derived: a value the instance does not
hold — an assignment group for a table that is empty by design — is the
builder's to choose, and demanding it would reward fabrication. A value the
instance does hold is diagnosis the run declined to perform.*

**Case 2 — the fix addresses a runtime record rather than the Fluent source.**
Score **1** if the address resolves to **exactly one record** and
**names every field it changes**. Score **0** if a scorer would have to work out
which record or which field the fix means. The builder AI is this column's stated
consumer, and SDK-owns-creation is a convention of this project rather than a
property of the diagnosis, so translating a unique runtime address into its
Fluent source is not an edit to the fix.

Both cases are subordinate to the constraint already stated in §A —
`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0. **Check that
first**; if it binds, neither case above arises.

## A3. Void runs — a run that measured nothing

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
   Task 12 bands are `≥ 8/10`, `5–7/10` and `< 5/10`,
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
   5–7 (middle), 0–4 (bottom). The decision record must show the percentage it read,
   not only the fraction.
4. **Floor: below 8 valid runs the gate is not evaluable.** The decision record must
   record the outcome as *gate not met — insufficient data*, state how many runs
   were void and why, and must **not** compute a verdict from the survivors. Two
   void rows already take this to exactly 8; a third puts the benchmark under its
   own floor. This is the case the whole column exists to make visible rather
   than let a low total hide it.

---

## 2. Seed specification (in full; repository paths redacted — see the note in section 1)

# Seed 05 — use case exists but is inactive

| | |
|---|---|
| **Expected root-cause layer** | `wiring` (layer 7) |
| **Expected fix target** | activation |
| **Fluent source** | the fixture app's Fluent source for seed-05-inactive-usecase.now.ts` |
| **Agent name** | Seed 05 Ticket Acknowledger |
| **Workflow** | Seed 05 Ticket Acknowledgement |
| **Also stresses** | — |

## The defect

> **Fixture state, verified 2026-08-02.** The m2m gate was
> PATCHed on post-install and re-read `true`
> (`sn_aia_trigger_agent_usecase_m2m` `ba30d8775b0c4cebb960c58830590d5d`);
> the trigger config stayed `active=false` as seeded. Ticket
> `29fd09c42b6a4bd417a6ffbeee91bfb0` (non-empty short_description) was inserted
> and **no execution plan was created anywhere on the instance** in the
> following minutes — the absence the seed exists to produce. The run-as
> question below **stays open**: the trigger was never activated, so whether it
> fires with empty run-as remains unmeasured.

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

**Measured in the build output directory, 2026-08-01.** ~~Before scoring any run of this seed,
confirm on the instance that `sn_aia_trigger_agent_usecase_m2m.active` is
`true`.~~ That check was guaranteed to fail. Fluent exposes exactly **one**
`active` property on `triggerConfig` and it feeds
`sn_aia_trigger_configuration`; the m2m gate has **no Fluent property at all**,
and the build plugin emits `sn_aia_trigger_agent_usecase_m2m.active=false`,
mirroring the trigger config. A plain install therefore lands **both gates
off** — verified in the emitted XML — and with both off the seed isolates
nothing, a diagnosis naming either gate is arguably right, and any rows
scored against it are void by construction.

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

> **Status 2026-08-09 (#151): the gate is currently ON and has stayed on.** The
> 2026-08-02 PATCH persisted — `sn_aia_trigger_agent_usecase_m2m`
> `ba30d8775b0c4cebb960c58830590d5d` still reads `active=true`. The step is not
> outstanding. **Re-read it anyway** before any pass, per the rule directly above:
> a reinstall of the fixture app resets it, and this seed's rows are void without it.

**If this step is skipped, the seed is void.** Record both of its runs as `void`
in the scorecard (see the scoring template's void-run section); do not score
them as hits or misses.

### ~~Also open, for Task 12~~ — ANSWERED 2026-08-09 (#151)

SDK 4.9.0 guidance (the build output directory, "4.9.0 guide hardening")
states that trigger run-as configuration is now **required for all trigger
types**. This workflow sets no `runAs`, and the build output directory confirms the emitted trigger
configuration carries `run_as`, `run_as_script` and `run_as_user` all empty —
**re-confirmed live on gpinst01, all three still empty**.

**The trigger fires anyway.** Measured 2026-08-09, evidence in
a repository a repository document §3: activating the trigger
generates a backing `sys_hub_flow` that carries **`run_as: user`** of its own
(`active=true`, `status=published`), and a ticket inserted after that flow exists
produces an `sn_aia_execution_plan` in **~1 second**. There is **no second wiring
defect at the firing layer**, and the 4.9.0 run-as guidance does not bite here.

**Two things that measurement DID surface, both live:**

1. **Activation is asynchronous — there is a race.** The backing flow is
   generated 4–5s *after* the activating PATCH returns. A ticket inserted inside
   that window produces nothing, which looks exactly like a non-firing trigger
   and is not one. **Wait for `trigger_flow` to be populated and its
   `sys_hub_flow.active` to read `true`** before inserting any triggering row.
2. **The execution terminates immediately — a second defect at the *execution*
   layer.** The plan is created with `status=error`, **0 tasks, 0 tool calls, 0
   messages**, `execution_mode=interactive` despite the use case being
   `autopilot`, and an empty `objective` despite the trigger config carrying an
   `objective_template`. So flipping `active` to `true` — this seed's own
   sanctioned fix — makes the trigger fire but **does not produce the
   acknowledgement**.

   This does **not** disqualify the seed: the expected diagnosis (root cause
   `wiring`, the trigger's `active=false`, fix target activation, naming the
   specific gate) is unaffected and fully scorable. The exposure is
   **`fix_usable_unedited`** only — a report proposing "activate the trigger"
   proposes a fix that, applied unedited, does not restore the acknowledgement.
   §A2.1's clauses do not cover this case. **Any pass including seed 05 must rule
   on it in its pre-registration, before the scorers meet it.**

## Setup

1. Install the fixture app (Task 12): `cd the build output directory && now-sdk install --alias gpinst01`
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
`fix_target_correct` (the partial band — see the scoring template's rubric section),
per "The two gates" above.

## Safety

Touches only the fixture app's own agent, workflow, team, and trigger
configuration, and inserts one row into `x_snc_tsbench_ticket`, owned by the
fixture app. Nothing shared is modified.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by the blind-rule guard test — see that file's header for
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

## 3. This run's report

**Harness arm:** native (Agent Doctor, `servicenow_aia_execute`)  
**How this run was invoked:** servicenow_aia_execute on agent "Agent Doctor" — objective names the agent under diagnosis and the triggering record sys_id, and asks why the expected acknowledgement never happened. No plan sys_id was available because no execution plan was ever created.  
**Execution under diagnosis:** (none — no execution plan was created)  
**Triggering record:** `01b435322bea8318f243fed2ce91bfbd`  
**This run's own identity:** diagnostic execution `40a53db62bea8318f243fed2ce91bf35` (TR1000260 + TR1000261)  
**Terminal state:** **completed**  
**Wall clock:** 5m34s  
**Tool-call count:** 8

## Fix Report — Seed 05 Ticket Acknowledger

---

### FAILURE SUMMARY

The agent **Seed 05 Ticket Acknowledger** was expected to fire when bench ticket `01b435322bea8318f243fed2ce91bfbd` was created on 2026-08-10 at 17:22:26 UTC. No execution plan was ever created (`sn_aia_execution_plan` read status: `empty`). The ticket exists and its `short_description` is populated, so the trigger condition (`short_descriptionISNOTEMPTY`) would have been satisfied — but the trigger **Seed 05 Bench Ticket Created** is set to **inactive** (`active = 0`). An inactive trigger is never evaluated by the platform's business rule dispatcher; no signal was sent to the agent runtime, and no plan was created. A secondary gap — zero tools attached to the agent — means that even a correctly triggered run could not perform the acknowledgement action.

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `sn_aia_execution_plan` read status `empty`; no plan was ever created |
| 2 | Instructions | **SWEPT** | Instructions present (118 chars); context_processing_script populated with platform boilerplate |
| 3 | Tool definitions | **SWEPT** | Zero tools attached; `sn_aia_agent_tool_m2m` read status `empty` |
| 4 | Data schemas | **SWEPT** | Table `x_snc_tsbench_ticket` exists with 8 fields; no `state` column (field warning, not a blocker) |
| 5 | Data | **SWEPT** | Ticket `01b435322bea8318f243fed2ce91bfbd` exists; `short_description` populated; trigger condition would have matched |
| 6 | GenAI stack | **SWEPT** | No LLM calls associated with this agent; `check_config` confirmed the capability infrastructure is readable; no capability defects found |
| 7 | Trigger and wiring | **SWEPT** | Trigger inactive (`active=0`); m2m link exists but `active_trigger_configurations = 0`; no run-as identity |

**Platform log layer (syslog):** **NOT SWEPT** — `log_analysis` reports the syslog table restricts cross-scope callers and this application cannot lift that restriction. An instance administrator must query `syslog` directly for the window around 2026-08-10 17:22 UTC, scoped to source `x_snc_tsbench` or the trigger's backing business rule, to confirm whether a dispatch attempt was logged and silently dropped.

---

### ROOT CAUSES

#### RC-1 — Trigger inactive *(PRIMARY — CONFIRMED)*

| | |
|---|---|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_configuration` · sys_id `bfb77d6c64884500a80203ee029436ee` · field `active` |
| **Finding** | The trigger *Seed 05 Bench Ticket Created* has `active = 0`. The platform never evaluates an inactive trigger; no business rule dispatch is issued and no execution plan is created. The trigger condition (`short_descriptionISNOTEMPTY`) and the target table (`x_snc_tsbench_ticket`) are both correctly configured — only the `active` flag is wrong. |
| **Evidence** | `agent_config` artifact `33a5f1f62bea8318f243fed2ce91bf79`, triggers section: `"active":"0"`, `"active_trigger_links":0`, `"active_trigger_configurations":0`; corroborated by `sn_aia_execution_plan` read status `empty` (agent_trace) |
| **Confidence** | **CONFIRMED** — two independent layers agree (trace shows no plan; trigger shows inactive) |

#### RC-2 — Zero tools attached *(CONFIRMED)*

| | |
|---|---|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_agent_tool_m2m` for agent `a4b7ef5d793346ea861730c6d28b8f58` |
| **Finding** | No tools are bound to the agent (`tool_count = 0`, `active_tool_count = 0`, `sn_aia_agent_tool_m2m` read status `empty`). The instructions direct the agent to restate the ticket's short description and priority. Both are data reads; without a tool that reads `x_snc_tsbench_ticket`, the agent's ReAct loop has no mechanism to retrieve those values and will either hallucinate or abort. |
| **Evidence** | `agent_config` artifact `33a5f1f62bea8318f243fed2ce91bf79`, overview: `"tool_count":0`, `"active_tool_count":0`; tools section: `"tools":[]`, `"bindings_found":0` |
| **Confidence** | **CONFIRMED** |

#### RC-3 — No run-as identity on trigger *(CONFIRMED as gap; impact UNCONFIRMED)*

| | |
|---|---|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_configuration` `bfb77d6c64884500a80203ee029436ee` · fields `run_as_field`, `run_as`, `run_as_script` |
| **Finding** | All three run-as fields are empty. The platform will resolve the executor from the session or default to the system user. `sys_agent_access_role_configuration` is also empty (no roles configured), so whether the effective executor satisfies the access gates cannot be checked from configuration. |
| **Evidence** | `agent_config` artifact `33a5f1f62bea8318f243fed2ce91bf79`, access_alignment section: `"identity_resolution":"none"`, `"run_as_user":""`, `"run_as_script_present":false`; `sys_agent_access_role_configuration` read status `empty` |
| **Confidence** | Gap **CONFIRMED**; whether this causes a failure independently of RC-1 is **UNCONFIRMED** — requires a live run captured via `agent_trace` to obtain the initiating user and compare roles |

---

### FIXES

#### FIX-1 — Activate the trigger

| | |
|---|---|
| **Target type** | Configuration |
| **Target** | `sn_aia_trigger_configuration` · sys_id `bfb77d6c64884500a80203ee029436ee` · field `active` |
| **Current** | `0` |
| **Proposed** | `1` |
| **Rationale** | Directly addresses RC-1. Activating the trigger causes the platform to install the backing business rule on `x_snc_tsbench_ticket`; subsequent inserts satisfying `short_descriptionISNOTEMPTY` will dispatch an execution plan. |

#### FIX-2 — Attach a ticket-reading tool

| | |
|---|---|
| **Target type** | Tool schema / wiring |
| **Target** | `sn_aia_agent_tool_m2m` — create a new binding linking agent `a4b7ef5d793346ea861730c6d28b8f58` to a tool that reads `x_snc_tsbench_ticket` fields `short_description` and `priority` by `sys_id` |
| **Current** | No tool bindings exist |
| **Proposed** | Bind at least one active tool whose input schema accepts a ticket `sys_id` and whose script returns `short_description` and `priority`. The trigger's objective template passes the triggering record context, which supplies the `sys_id`. |
| **Rationale** | Addresses RC-2. Without this, the agent cannot retrieve ticket data and will fail or hallucinate even after FIX-1 is applied. |

#### FIX-3 — Configure a run-as identity

| | |
|---|---|
| **Target type** | Configuration |
| **Target** | `sn_aia_trigger_configuration` `bfb77d6c64884500a80203ee029436ee` · field `run_as_field` or `run_as` |
| **Current** | All empty |
| **Proposed** | Set `run_as_field` to a user-reference field on `x_snc_tsbench_ticket` (e.g. the creator/opened_by field), **or** set a static service-account user in `run_as`, ensuring that account holds the roles required once access roles are defined in `sys_agent_access_role_configuration` |
| **Rationale** | Partially addresses RC-3. Without a resolved identity the effective executor is unknown; if that identity lacks data-access roles, tool calls will return empty results even after FIX-1 and FIX-2 are applied. |

---

### VERIFICATION

1. **After FIX-1:** Create a new `x_snc_tsbench_ticket` record with a non-empty `short_description`. Run `agent_trace` with agent name *Seed 05 Ticket Acknowledger*. Expect at least one `sn_aia_execution_plan` row to appear with `state` progressing past `queued`.
2. **After FIX-2:** Repeat the above. Inspect the execution task tree in `agent_trace` — expect a tool call with status `success` and a response containing `short_description` and `priority` values matching the created record.
3. **After FIX-3:** Capture the `initiating_user` from the execution plan. Confirm that user's roles satisfy both User Access and Data Access gates in AI Agent Studio's *Define User Access / Define Data Access* panels.
4. **End-to-end:** The agent's final message must restate the ticket's short description and priority without hallucinating values — compare the agent output against the source record.

---

### DATA MARKERS

The following record data was quoted as evidence and **must be redacted before this report crosses the instance boundary**:

- Ticket `short_description` value — read from `x_snc_tsbench_ticket` sys_id `01b435322bea8318f243fed2ce91bfbd`
- Ticket `sys_created_on` timestamp — same record

The following are **configuration values** (not record data) and may be retained:
- Trigger name: *Seed 05 Bench Ticket Created*
- Agent description: *"Acknowledges a newly created bench ticket. Benchmark seed - the agent is fine, its trigger is not."*
References: null

---

## 4. This run's audit-trail measurements

Derived from the diagnostic run's own audit trail (`action_type=result`) per §E1–§E2,
independently of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 7/7 (L1, L2, L3, L4, L5, L6, L7) — mechanical §E2 map of the distinct tool set (`agent_trace`→L1, `agent_config`→L2/L3/L7, `schema_lookup`→L4, `query_table`→L5, `genai_log`→L6; `read_artifact` and `log_analysis` map to no layer)
- **Tool-call count:** 8 result rows
- **Distinct tool names:** 6 — `agent_trace`, `read_artifact (x3)`, `agent_config`, `genai_log`, `query_table`, `schema_lookup`
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 before run 1 by two independent paths that agreed: `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`) and the harness's own tool registry. All seven attached and active, `max_auto_executions = 10` on every one.
- **`continuous_tool_execution_limit`:** 25 — read live during this pass, not carried forward
- **Terminal state:** **completed**
- **Wall clock:** 5m34s
- **Harness HOLDs:** none

**One stated omission.** The per-call ordered list with timestamps and full arguments is not reproduced here. Where the argument of a held call bears on whether a layer was genuinely reached, that argument is named in section 5 instead. Every packet in this pass carries the same fields, so the instrument is constant across rows.

---

## 5. Notes specific to this run

- This seed produced NO execution plan — the diagnostic target is the absence of one. The run was given the agent name and the triggering record's sys_id rather than a plan sys_id.
- This run reached a terminal state and was not re-run. No row in this pass was void, and no arm used any of its permitted re-runs.

---

## 6. What to return

Score the four rubric columns, then compute `passes_gate` by the rule in section 1.
State your reasoning for each column. If a column is under-determined by the material
above, say so explicitly and set the packet-level `ambiguous` flag to `yes` — do not
guess and do not smooth it over. An honest "under-determined" is a usable measurement;
a confident guess is not.
