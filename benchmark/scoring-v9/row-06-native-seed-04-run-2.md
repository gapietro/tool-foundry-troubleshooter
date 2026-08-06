# Scoring packet — Row 06

**Seed:** 04 · **Harness arm:** native (Agent Doctor, `servicenow_aia_execute`) · **Run:** 2

This packet is self-contained. It contains the scoring rubric, this seed's
specification, this run's full report, and this run's audit-trail
measurements — nothing else. Score this row using only the content below.

---

## 1. Scoring rubric

Section 1 is reproduced from this project's scorecard template; section 2 is reproduced from
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
| `fix_usable_unedited` | 0 or 1 | The Fix Report's proposed fix could be applied by the builder AI as written, with no manual editing first — **and it addresses the defect the seed actually carries.** A well-formed fix aimed at the wrong target is a no-op, not a usable fix, so **`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0.** See the note under the gate rule for why this constraint lives here rather than in the gate expression |

**Total: 6 points per run.**

**Why `fix_target_correct` has a partial band.** It was 0-or-2, while
seed 5's specification instructs the scorer to award *partial*
credit for naming "inactive" without naming which of the two activation gates is
off — an instruction the scale could not express, leaving the scorer to round
arbitrarily in either direction. The 1 band resolves it. Seed 5 is the only seed
that currently defines a partial case; for the others, 1 is available but must be
justified in `notes` if used.

## A2. `passes_gate` — the column the gate actually consumes

The rubric scores each run **out of 6**. The gate counts **runs**: *"≥ 8/10 runs with correct root cause + usable fixes."*
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

# Seed 04 — GenAI capability not mapped to a provider

| | |
|---|---|
| **Expected root-cause layer** | `genai_stack` (layer 6) |
| **Expected fix target** | capability mapping |
| **Fluent source** | this seed's Fluent definition file |
| **Agent name** | Seed 04 Summarizer |
| **Also stresses** | — |

## The defect

> **Fixture state, verified 2026-08-02.** The primary construction installed
> without refusal (no fallback needed), the placeholder was substituted with
> capability sys_id `92ff62af516741769c437feb88c80ef3` and verified in the
> installed script, and the seed execution
> `16ddc10c2baa4314f243fed2ce91bf15` produced the predicted signature:
> `OneExtendUtil.execute` returned `status: "error"`, message "Plan invalid…",
> `capabilities: {}`, and the tool returned `ok: false`.

The capability definition `x_snc_tsbench_unmapped_capability` exists and is
reachable, but its `api` — the **mandatory** pointer at the `sys_hub_flow`
provider integration subflow that actually executes the call — is
`00000000000000000000000000000000`, which resolves to no flow record at all.
`api_type` still says `sys_hub_flow`, so the platform is told to run a Flow and
handed a Flow that does not exist. That is a broken capability→provider mapping:
the capability record is real, and there is no provider behind it.

**~~The `connection` premise~~ — REFUTED and replaced, 2026-08-01.** ~~Its
`connection` — the bound provider credential alias — is empty. R-18 established
that `connection` is exactly that binding, so an empty one is precisely
"capability not mapped to a provider".~~ ~~One missing binding, not three —
corrected 2026-08-01. The seed now matches the well-formed shape exactly, with a
real `sys_one_extend_capability` parent record, so **`connection` is the only
gap** — which is the seed's entire purpose.~~

R-18's reading of `connection` came from a **ten-row sample**. Measured against
the whole table on gpinst01, read-only:

| Measurement | Value |
|---|---|
| `sys_one_extend_capability_definition` rows | **2026** (not 10, not 12) |
| …with `connection` **empty** | **318 of 2026 (15.7%)**, shipped OOB Now Assist definitions among them |
| `sys_dictionary` — `connection` | `reference` → `sys_alias`, **`mandatory=false`** |
| `sys_dictionary` — `capability`, `api_type`, `api` | all **`mandatory=true`** |

An empty `connection` is therefore a normal, common, supported state. After the
previous fix wave this seed's record had become a structural clone of working OOB
definitions differing only in an *optional* field — it would most likely not have
failed at all, and a benchmark specimen that measures nothing is worse than no
specimen. The seed is re-targeted at a binding the platform actually requires, so
that the failure is guaranteed rather than hoped for. See **the design contract, ruling R-22**.

**Why `api`, with the counts that justify it** — same table, same denominator of
2026:

- **1 of 2026 (0.05%)** rows has `api` empty — the single `api_type=Decision` row.
- `api_type=sys_hub_flow` accounts for **1840 of 2026** rows across **55 distinct
  `api` values**. **54 of those 55** resolve to a live `sys_hub_flow`; exactly one
  does not, and it belongs to a single OOB row (*"Default OneExtend Profanity
  Filter"*). A dangling `api` is therefore **1 row in 2026 (0.05%)** — about
  **300× rarer** than an empty `connection`, and genuinely anomalous rather than
  routine.
- `api` is `internal_type=document_id`, so it carries **no referential
  integrity**: an arbitrary sys_id installs verbatim and resolves to nothing.

The rejected alternative was a dangling `capability` reference. It is equally
mandatory, but it is a true `reference` column that the platform may validate or
repair, and breaking it would change the failure signature to *capability not
found* while leaving the tool no sys_id to invoke — which is the **fallback**
construction below, not this one.

**`connection` stays empty and is no longer the defect.** It is left empty
because there is no alias to bind and because 318 OOB rows do the same. **A
diagnosis that names the empty `connection` as the root cause is naming a normal
state and must not be scored as a hit** — see "Expected diagnosis".

**The invocation envelope was also wrong — corrected 2026-08-01.** This
correction stands and is unaffected by the re-targeting above. ~~The tool
calls `sn_one_extend.OneExtendUtil.execute` with the capability name.~~ It
previously called `execute({capability: '<name>', ticket: ...})`. The real
envelope is an array under `executionRequests`, keyed by capability **sys_id**
(see the Now Assist skill golden example). The old form could
not reach the capability record at all, so it could never have failed on the
empty `connection`: it would have died as a malformed-request **script error —
layer 3, not layer 6** — and an agent correctly reporting the malformed envelope
would have been scored a **miss** on a seed whose expected answer is
`genai_stack`.

## Shared-instance safety

The seed creates its **own** capability definition rather than unmapping a
real one. LLD §7 warns explicitly against unmapping real capabilities on the
shared instance — gpinst01 hosts other tenants, and breaking an existing
capability would be an uncontained blast radius. All the seed does to the
instance is add one capability + one definition of its own, both owned by the
fixture app.

**Why a dangling `api` rather than a deleted one.** `api` is `mandatory=true`,
so an empty value is not a shape the platform is expected to accept — and only
1 of 2026 rows on the instance has one. A *populated but unresolvable* `api`
passes every mandatory check, installs verbatim (no referential integrity on a
`document_id` column), and fails at the point of use, which is exactly where a
diagnostic agent has to catch it. The all-zeros value is chosen so a maintainer
reading the record sees at a glance that it is deliberate; a plausible random
GUID would read as a real mapping that had drifted.

**LLD §8 item 8 is re-opened by this change** — it was closed on the refuted
`connection` premise. See LLD §8 item 8 and the design contract's ruling R-22.

## Install risk and the fallback

`sys_one_extend_capability_definition` is a **global** table, and this is a
scoped app. A scoped app writing into a global table via the generic
`Record()` fallback may be refused at install even though it builds cleanly
— this was true for Task 11's build (see below) but install is a Task 12
concern this task does not reach.

If Task 12's install refuses either record, fall back to a tool invoking a
`capabilityId` that exists **nowhere at all** — no `sys_one_extend_capability`
row for it, and therefore no definition either. That construction needs no
global-table write of any kind: the only thing installed is the agent's own
tool script, inside `x_snc_tsbench`.

Note that it changes the seed's failure signature. The primary construction
produces *capability exists, its provider flow does not*; the fallback produces
*capability not found* — the platform cannot reach the capability record at all,
rather than reaching it and finding nothing behind it. If the fallback is used,
the seed's expected diagnosis changes accordingly and the scorecard must be
scored against the **fallback's** signature, not the one described above.

Do **not** improvise a third construction by emptying `connection`. That was
this seed's original defect and it was refuted — see "The defect".

## Setup

1. Install the fixture app (Task 12): run `now-sdk install --alias gpinst01` from the fixture app directory

2. **Verify the capability sys_id in the tool script matches the installed
   capability — mandatory.** *(State updated 2026-08-02: the Fluent source no
   longer ships the placeholder.)* At Task 12 the placeholder
   `REPLACE_WITH_SEED_04_CAPABILITY_SYS_ID` (the Build Rule #33 house pattern —
   the sys_id exists only after install, and an unreplaced placeholder fails
   loudly rather than pointing silently at the wrong record) was substituted
   with **gpinst01's** installed capability sys_id
   `92ff62af516741769c437feb88c80ef3`, and that value is now hardcoded in
   this seed's Fluent definition file. What to do depends on
   the target instance:

   - **Reinstalling on gpinst01:** no substitution needed. Do NOT reintroduce
     the placeholder. Verify only (below).
   - **Installing on any other instance:** the hardcoded value is
     instance-specific and will match nothing. Read the installed capability's
     sys_id and replace the hardcoded value, then rebuild + reinstall (or patch
     `sn_aia_tool.script` for `summarise_ticket` directly on the instance):

     ```
     GET /api/now/table/sys_one_extend_capability
         ?sysparm_query=name=x_snc_tsbench_unmapped_capability
         &sysparm_fields=sys_id,name
     ```

   - **Verify in either case:** the sys_id in the *installed*
     `sn_aia_tool.script` equals the sys_id the GET above returns on the target
     instance.

   **If the installed script's sys_id does not match the instance's capability
   record, the seed is void** — the tool cannot reach any capability, and the
   run tests a malformed reference rather than an unmapped provider. (A
   correctly-matching hardcoded value is a VALID install, not a skipped step —
   do not record such a run as void.)

3. Insert one bench ticket with `short_description` set. Record its sys_id.
   (Possible only because of the record ACLs and `allowWebServiceAccess` in
   the fixture app's ACL definition file — Build Rule #42.)

## Trigger

Open a fresh conversation with **Seed 04 Summarizer** and ask it to summarise
the bench ticket by sys_id. Capture the resulting `sn_aia_execution_plan`
sys_id.

## Expected diagnosis

Root cause in `genai_stack`: the capability `x_snc_tsbench_unmapped_capability`
exists but its definition points at a provider flow that does not exist —
`api_type=sys_hub_flow` with `api=00000000000000000000000000000000`, which
matches no `sys_hub_flow` record. Fix target: **capability mapping** — repoint
`api` at the real provider integration subflow (the healthy value for a Now LLM
Generic definition on gpinst01 is `936e514a53b3b110f028ddeeff7b128c`, used by
422 of the 2026 definition rows) — not the tool script and not the agent
instructions.

Evidence a correct diagnosis should cite: the tool's execution failure or error
result from `sn_one_extend.OneExtendUtil.execute`, **plus** the capability
definition row showing the unresolvable `api`.

**Scoring note — the empty `connection` is a decoy, and it is on the record on
purpose.** The definition also has `connection` empty. That is the *normal*
state for 318 of the instance's 2026 definition rows and the column is
`mandatory=false`, so it is not a defect. A diagnosis whose root cause is "the
capability has no connection bound" has named a normal state:

- Root cause `genai_stack` is still **correct** (the layer is right) — award
  `root_cause_layer_correct`.
- `fix_target_correct` scores **0** if the proposed fix is "bind a
  connection/credential alias" and nothing else. It is not the seeded defect and
  applying it would not make the capability work.
- `fix_usable_unedited` scores **0** as well, and this is the bullet that makes
  the decoy bite. "Bind a connection alias" is well-formed and a builder could
  apply it verbatim — but it fixes nothing, and a fix aimed at the wrong target
  is a no-op, not a usable fix. See the scoring rubric §A2: the column
  may not be 1 while `fix_target_correct` is 0. **The correct row for a decoy
  hit is 2 / 0 / … / 0, `passes_gate` = 0.** Scoring it 2 / 0 / … / 1 lets the
  run pass the gate and makes the decoy inert, which was a live defect in the
  scorecard until PR #33's round-2 review.
- Record the decoy hit in `notes` either way. It is a useful signal about the
  diagnostic agent, not just a scoring event.

**If the fallback from "Install risk and the fallback" above was used**, score
against that signature instead: root cause still lands in `genai_stack`, but the
evidence is a *capability not found* error rather than an invocation failure
against a missing provider flow, and a diagnosis should be scored on whether it
correctly identifies a missing/unregistered capability rather than a mis-mapped
one.

## Safety

Creates only its own capability definition and agent/tool records, owned by
the fixture app. No existing capability, connection, or provider mapping on
the instance is touched, unmapped or repointed. The dangling `api` value points
at a sys_id that exists nowhere, so it cannot collide with a real flow.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by the blind-rule guard test — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 04 Summarizer
x_snc_tsbench_unmapped_capability
936e514a53b3b110f028ddeeff7b128c
```

---

## 3. This run's report

**Harness arm:** native (Agent Doctor, `servicenow_aia_execute`)  
**Input text sent (verbatim):**  

```
Diagnose the failing AI Agent execution with plan sys_id b85c79992baa475817a6ffbeee91bf2c. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes.
```

**This run's own identity:** run_id (`sn_aia_execution_plan` sys_id) `aa06c65d2bae475817a6ffbeee91bf71`, `conversation_ref` `de06429d2b2e475817a6ffbeee91bff3`  
**Execution under diagnosis:** `sn_aia_execution_plan` `b85c79992baa475817a6ffbeee91bf2c`  
**Terminal state:** `sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty  
**Wall clock:** 4 m 21 s (261 s) — 2026-08-06 02:47:18 → 02:51:39  
**Tool-call count:** 17

`sn_aia_message` sys_id `f10742552bee475817a6ffbeee91bf92`, `role` = `agent`, created 2026-08-06 02:51:37.

# Fix Report — Execution Plan b85c79992baa475817a6ffbeee91bf2c

---

## FAILURE SUMMARY

The user asked agent **Seed 04 Summarizer** to summarise bench ticket `fb4b7d5d2b66cf54f243fed2ce91bfda` (*"Shared network printer on floor three rejects all print jobs with a driver error"*). The agent correctly called the `summarise_ticket` tool, which invoked capability **x_snc_tsbench_unmapped_capability** (`92ff62af516741769c437feb88c80ef3`) via `sn_one_extend.OneExtendUtil`. The capability's sole definition row carries `api = 00000000000000000000000000000000` — a nil UUID that resolves to no record in `sys_hub_flow`. The executor therefore returned `status: "error"`, `planId: null`, and the message **"Plan invalid or not created."** The tool returned `ok: false`, the ReAct engine recognised the failure, and surfaced it to the user as *"Ticket Summarisation Failed."* The execution plan state is **Completed** (not Failed) because the agent handled the error gracefully, but the user's objective was not met.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `agent_trace`, execution `b85c79992baa475817a6ffbeee91bf2c` |
| 2 | Instructions | **SWEPT** | `agent_config` artifact `10460add2bae475817a6ffbeee91bffe` |
| 3 | Tool definitions | **SWEPT** | `agent_config` artifact `10460add2bae475817a6ffbeee91bffe` |
| 4 | Data schemas | **SWEPT** | `schema_lookup` on `x_snc_tsbench_ticket` |
| 5 | Data | **SWEPT** | `query_table` on `x_snc_tsbench_ticket`, record `fb4b7d5d2b66cf54f243fed2ce91bfda` — record **exists** |
| 6 | GenAI stack | **SWEPT** | `genai_log check_config` capability `92ff62af516741769c437feb88c80ef3`; `genai_log for_execution` |
| 7 | Trigger and wiring | **SWEPT** | `agent_config` triggers section |

**Platform log layer (syslog): UNAVAILABLE.** `syslog` declares `caller_access = Caller Restriction`; the tool received `DENIED`. An instance administrator must relax `caller_access` on `syslog`, or export logs for the window `2026-08-06 02:02:52 – 02:07:12`. This layer was **NOT** swept and is **NOT** reported as clean. Zero script errors were found via `agent_trace` (the nearest available substitute).

---

## ROOT CAUSES

### Root Cause 1 — PRIMARY (Layer 6: GenAI Stack)

| Field | Value |
|-------|-------|
| **layer** | 6 — GenAI stack |
| **component** | `sys_one_extend_capability_definition` · sys_id `904c0485699a4a73a124446a7231c563` · name `x_snc_tsbench_unmapped_capability (Now LLM Service - unmapped)` |
| **finding** | The `api` field holds the nil UUID `00000000000000000000000000000000`, which resolves to no row in `sys_hub_flow`. `api` is a mandatory binding for `api_type = sys_hub_flow`. With no valid flow to dispatch through, every invocation of this capability fails at the executor with **"Plan invalid or not created."** |
| **evidence** | `genai_log check_config` → definition `904c0485699a4a73a124446a7231c563`, `api = 00000000000000000000000000000000`, `api_state: dangling`, `finding: api_dangling, severity: high`; `agent_trace` tool call `0f5cbd992baa475817a6ffbeee91bf42` → `ok: false`, `status: error`, `planId: null` |
| **confidence** | **CONFIRMED** — capability definition row read directly; dangling `api` verified against `sys_hub_flow` (empty) |

---

### Root Cause 2 — SECONDARY (Layers 3 & 4: Tool Definition Quality)

| Field | Value |
|-------|-------|
| **layer** | 3 — Tool definitions / 4 — Data schemas |
| **component** | `sn_aia_tool` · sys_id `37d6957bb5cd4bda96fc9a93de494eac` · fields: `description`, `input_schema` |
| **finding** | The tool description says *"Give it a ticket sys_id"* but names no source table, no format constraints, and no exclusion boundary. The `ticket` input is marked `mandatory: false` even though it is functionally required. Two tool-quality smells raised: `description_no_negative_guidance` and `description_no_input_guidance`. These did not cause this run's failure but will cause silent misuse once Root Cause 1 is fixed. |
| **evidence** | `agent_config` artifact `10460add2bae475817a6ffbeee91bffe` → `tool_smells[0]: description_no_negative_guidance`, `tool_smells[1]: description_no_input_guidance`; `input_schema: mandatory: false` for `"ticket"` |
| **confidence** | **CONFIRMED** for schema observations; **UNCONFIRMED** whether either smell caused a misbehaviour in this specific run (the model used the tool correctly) |

---

### Root Cause 3 — INFORMATIONAL (Layer 7: Trigger Wiring)

| Field | Value |
|-------|-------|
| **layer** | 7 — Trigger and wiring |
| **component** | `sn_aia_trigger_agent_usecase_m2m` (agent Seed 04 Summarizer) |
| **finding** | Zero trigger links on both branches (agent-direct: 0, team/usecase chain: 0). The agent ran in Interactive/conversational mode for this execution, so no trigger is required. This finding matters only if the agent is expected to fire on a record event. |
| **evidence** | `agent_config` artifact `10460add2bae475817a6ffbeee91bffe` → `triggers.branches: agent_direct=0, team_usecase_chain=0`; `wiring_findings[0].finding: no_trigger_wiring` |
| **confidence** | **UNCONFIRMED** as a defect — conversational invocation succeeded. Confirm by checking whether a record-event trigger is intended. |

---

## FIXES

### Fix 1 — Addresses Root Cause 1 ✅ *Apply this first*

| Field | Value |
|-------|-------|
| **target type** | Configuration — GenAI capability definition |
| **target** | `sys_one_extend_capability_definition` · sys_id `904c0485699a4a73a124446a7231c563` · field: `api` |
| **current** | `00000000000000000000000000000000` |
| **proposed** | The `sys_id` of the `sys_hub_flow` record that implements the intended LLM provider integration for this capability (e.g., the active Now Assist "Summarization" or equivalent flow on this instance) |
| **rationale** | `api` is a mandatory binding for `api_type = sys_hub_flow`. The nil UUID resolves to nothing; the executor cannot build a plan. Pointing `api` at a real, active `sys_hub_flow` record gives the executor a valid dispatch target and resolves the "Plan invalid or not created" error. |

**Steps to find the correct flow:**
1. Open **Now Assist / AI Skill Studio** and locate the provider integration intended to back this capability.
2. Copy its `sys_hub_flow` sys_id.
3. On `sys_one_extend_capability_definition` sys_id `904c0485699a4a73a124446a7231c563`, set the `api` field to that sys_id.

---

### Fix 2 — Addresses Root Cause 2

| Field | Value |
|-------|-------|
| **target type** | Tool schema |
| **target** | `sn_aia_tool` · sys_id `37d6957bb5cd4bda96fc9a93de494eac` · fields: `description`, `input_schema` |
| **current description** | *"Summarises a bench ticket by invoking the x_snc_tsbench_unmapped_capability GenAI capability. Give it a ticket sys_id. Returns the generated summary."* |
| **proposed description** | *"Summarises a bench ticket by invoking the x_snc_tsbench_unmapped_capability GenAI capability. Provide the sys_id of a record from table x_snc_tsbench_ticket. Returns the generated summary text. Do not use this tool for ticket types other than x_snc_tsbench_ticket, and do not call it without a valid sys_id."* |
| **current input `ticket`** | `mandatory: false` |
| **proposed input `ticket`** | `mandatory: true` |
| **rationale** | Marking `ticket` mandatory prevents silent null invocations. Naming the source table and the exclusion boundary gives the model enough information to select and invoke the tool correctly without guessing format or scope. |

---

## VERIFICATION

After applying Fix 1:

1. Open a new conversation with **Seed 04 Summarizer** and send:
   > *"Please summarise the bench ticket with sys_id `fb4b7d5d2b66cf54f243fed2ce91bfda`"*
2. Retrieve the new execution plan sys_id.
3. Run `agent_trace` on the new plan. **Expect:**
   - Tool call `summarise_ticket`: `execution_status = Success`
   - Tool response: `ok: true`, `result` non-null
   - No *"Plan invalid or not created"* in the message stream
   - Agent final message contains the summary text
4. Run `genai_log for_execution` on the new plan. Expect two LLM calls, both `status: success`.
5. If the tool still returns `ok: false`, run `genai_log check_config` on capability `92ff62af516741769c437feb88c80ef3` again and verify `api_state` is no longer `dangling`.

---

## DATA MARKERS

The following record data was cited as diagnostic evidence and **must be reviewed for redaction** before this report leaves the instance:

- `x_snc_tsbench_ticket` sys_id `fb4b7d5d2b66cf54f243fed2ce91bfda`
  - `short_description`: *"Shared network printer on floor three rejects all print jobs with a driver error"*
- `sn_aia_message` sys_id `cb5cbd992baa475817a6ffbeee91bfa7` — raw capability error response including `capability_id`
- `sys_cs_message` content containing the user's original request and the agent's *"Ticket Summarisation Failed"* reply
- User profile: System Administrator / `admin@example.com` (present in the execution message stream as the invoking user)

---

> **Sweep completeness note:** Six of seven layers were swept with direct tool evidence. The platform log layer (syslog) is **UNAVAILABLE** — an instance administrator must grant cross-scope read access to `syslog` or export logs for the window `2026-08-06 02:02:52 – 02:07:12` to close that gap.
References: null

---

## 4. This run's audit-trail measurements

Derived from `x_snc_troubleshoot_audit` (`action_type=result`) per §E1–§E2, independently
of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 7/7 (L1, L2, L3, L4, L5, L6, L7) — mechanical §E2 map of the distinct tool set
- **Tool-call count:** 17 result rows
- **Ordered tool-call list:**
  1. `agent_trace` (02:47:28)
  2. `read_artifact` (02:47:36)
  3. `read_artifact` (02:47:46)
  4. `genai_log` (02:48:14)
  5. `read_artifact` (02:48:14)
  6. `agent_config` (02:48:14)
  7. `query_table` (02:48:14)
  8. `read_artifact` (02:48:41)
  9. `schema_lookup` (02:48:41)
  10. `genai_log` (02:48:41)
  11. `log_analysis` (02:48:41)
  12. `read_artifact` (02:49:05)
  13. `read_artifact` (02:49:05)
  14. `schema_lookup` (02:49:05)
  15. `read_artifact` (02:49:31)
  16. `read_artifact` (02:49:31)
  17. `query_table` (02:49:31)
- **Distinct tool names:** 7 — `agent_trace`, `read_artifact`, `genai_log`, `agent_config`, `query_table`, `schema_lookup`, `log_analysis`
- **LLM-call count:** 9 (`type=gen_ai`; also `tool` 17, `agent` 1, `access_verification` 1, `communicator` 1)
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 on `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`): `agent_trace`, `agent_config`, `schema_lookup`, `query_table`, `genai_log`, `log_analysis`, `read_artifact` — all seven attached and active, `max_auto_executions = 10` on every one. Read before this run and re-read after the run set; no tool attachment changed.
- **Terminal state:** `sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty
- **Wall clock:** 4 m 21 s (261 s) — 2026-08-06 02:47:18 → 02:51:39

---

## 5. Notes specific to this run

- The MCP invocation returned before the run finished; the terminal state recorded above was read by polling this run's own `sn_aia_execution_plan` record.
- This run's `x_snc_troubleshoot_run` anchor record was left at `status: running` even after the agent execution reached `completed`. The terminal state above is read from the execution plan, not from the anchor.
- The report's claim that `syslog` declares `caller_access = Caller Restriction` and returned DENIED is the run's own prose. It was not independently verified by the operator; it is reproduced as written.
