# Scoring packet — Row 05

**Seed:** 04 · **Harness arm:** native (Agent Doctor, `servicenow_aia_execute`) · **Run:** 1

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
Diagnose the failing AI Agent execution with plan sys_id 4e3c35552ba6cf54f243fed2ce91bf47. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes.
```

**This run's own identity:** run_id (`sn_aia_execution_plan` sys_id) `e064ce952b6acf54f243fed2ce91bf28`, `conversation_ref` `986442d12b6acf54f243fed2ce91bfd7`  
**Execution under diagnosis:** `sn_aia_execution_plan` `4e3c35552ba6cf54f243fed2ce91bf47`  
**Terminal state:** `sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty  
**Wall clock:** 5 m 38 s (338 s) — 2026-08-06 02:40:04 → 02:45:42  
**Tool-call count:** 14

`sn_aia_message` sys_id `fea50a112baacf54f243fed2ce91bf32`, `role` = `agent`, created 2026-08-06 02:45:40.

## Fix Report — Agent: Seed 04 Summarizer
**Execution Plan:** `4e3c35552ba6cf54f243fed2ce91bf47`

---

### FAILURE SUMMARY

The user asked agent **Seed 04 Summarizer** to summarise bench ticket `5b4b3d152baa475817a6ffbeee91bf2b`. The agent correctly selected the `summarise_ticket` tool and passed the sys_id. The tool executed without a script error, but internally calls `sn_one_extend.OneExtendUtil.execute()` against capability `92ff62af516741769c437feb88c80ef3` (`x_snc_tsbench_unmapped_capability`). That capability's definition row points `api` at the nil GUID `00000000000000000000000000000000`, which resolves to no record in `sys_hub_flow`. The executor cannot dispatch the LLM call, returns `status:"error"` with an empty `requestPayload`, and the agent surfaces the misleading message *"The agent/action was invoked successfully"* — masking the failure. The agent description itself states it is *"deliberately broken"*, confirming this is a seeded defect.

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `agent_trace` on plan `4e3c35552ba6cf54f243fed2ce91bf47` |
| 2 | Instructions | **SWEPT** | `agent_config` instructions section |
| 3 | Tool definitions | **SWEPT** | `agent_config` tools section + script body |
| 4 | Data schemas | **SWEPT** | `schema_lookup` on `x_snc_tsbench_ticket` |
| 5 | Data | **SWEPT** | `query_table` on `x_snc_tsbench_ticket` — target record confirmed present |
| 6 | GenAI stack | **SWEPT** | `genai_log check_config` on capability `92ff62af516741769c437feb88c80ef3` |
| 7 | Trigger and wiring | **SWEPT** | `agent_config` triggers section |
| — | Platform logs | **UNAVAILABLE** | `syslog` read was DENIED (caller restriction). An instance administrator must relax `caller_access` on `syslog` or provide a log export to sweep this layer. |

---

### ROOT CAUSES

#### Root Cause 1 — Dangling capability `api` binding *(PRIMARY — blocks every execution)*

- **Layer:** 6 – GenAI stack
- **Component:** `sys_one_extend_capability_definition` · sys_id `904c0485699a4a73a124446a7231c563` · name `x_snc_tsbench_unmapped_capability (Now LLM Service - unmapped)`
- **Finding:** The mandatory field `api` holds the nil GUID `00000000000000000000000000000000`, which matches no row in `sys_hub_flow` (the table named by `api_type`). The executor cannot resolve a provider flow and returns `status:"error"` with an empty `requestPayload`.
- **Evidence:**
  - `genai_log check_config` → `definitions[0]`: `api_type = sys_hub_flow`, `api = 00000000000000000000000000000000`, `api_state = dangling`; `sys_hub_flow` table read status = empty (0 rows); `findings[0].finding = api_dangling`, severity = **high**
  - `agent_trace` → `tool_calls[0].response_digest`: `ok:false`, `status:"error"`, `requestPayload:{}`
- **Confidence:** **CONFIRMED** — trace shows the tool call returning error; `genai_log` independently confirms the nil `api` binding on the exact `capability_id` the tool script invokes.

---

#### Root Cause 2 — `active_tool_count: 0` discrepancy

- **Layer:** 3 – Tool definitions
- **Component:** `sn_aia_agent` sys_id `8bac1f84f3a1481487fe8dd219295914`
- **Finding:** `agent_config` overview reports `tool_count: 1` but `active_tool_count: 0`, even though both the tool (`sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac`, `active:"1"`) and its binding (`sn_aia_agent_tool_m2m` `3c72dab2668c4ba5a6080a5cd5fb2b91`, `active:"1"`) report active. The run did invoke the tool, so this may be a reporting artefact rather than a second execution block.
- **Evidence:** `agent_config` overview fields `tool_count = 1`, `active_tool_count = 0`; `agent_config` tools section `binding.active = "1"`, `tool.active = "1"`
- **Confidence:** **UNCONFIRMED** — the field driving the discrepancy is not surfaced by `agent_config`. Inspect `sn_aia_agent_tool_m2m` record `3c72dab2668c4ba5a6080a5cd5fb2b91` and `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac` directly to confirm.

---

#### Root Cause 3 — `ticket` input not declared mandatory

- **Layer:** 3 – Tool definitions
- **Component:** `sn_aia_tool` sys_id `37d6957bb5cd4bda96fc9a93de494eac` · input `ticket` · field `mandatory`
- **Finding:** `mandatory: false` means the model could call the tool without supplying a sys_id. The script passes `inputs.ticket` directly to the capability payload; an absent sys_id produces an empty payload and the same error path as the capability misconfiguration.
- **Evidence:** `agent_config` `tools[0].binding.inputs` and `tools[0].tool.input_schema`: `[{"name":"ticket","mandatory":false}]`
- **Confidence:** **CONFIRMED** as a configuration defect; its contribution to *this* specific failure is secondary because the model did supply the sys_id correctly in this run.

---

#### Root Cause 4 — No trigger wiring

- **Layer:** 7 – Trigger and wiring
- **Component:** `sn_aia_trigger_agent_usecase_m2m`
- **Finding:** Zero trigger links on both agent-direct and team/usecase-chain branches. The agent can only be started via direct API or conversational invoke; it will never fire autonomously on a record event.
- **Evidence:** `agent_config` triggers section: `links = []`, `wiring_findings[0].finding = no_trigger_wiring`, severity = **high**; agent-direct rows = 0, team/usecase rows = 0; all read statuses ok (genuine absence).
- **Confidence:** **CONFIRMED** as a configuration gap. This run was Interactive/conversational, so the absence did not block this execution. If record-event firing is intended, it is a separate defect.

---

### FIXES

#### Fix 1 — Repoint the capability `api` to a real provider flow *(addresses RC1 — required to unblock)*

| Field | Value |
|-------|-------|
| **Target type** | Configuration |
| **Target** | `sys_one_extend_capability_definition` sys_id `904c0485699a4a73a124446a7231c563` · field `api` |
| **Current** | `00000000000000000000000000000000` |
| **Proposed** | The `sys_id` of the Now Assist / LLM provider subflow in `sys_hub_flow` that should service `x_snc_tsbench_unmapped_capability`. Locate the correct subflow in Flow Designer under the NowAssist or provider scope, then set `api` to its sys_id. |
| **Rationale** | The executor resolves the provider from this field. A nil GUID resolves to nothing, so the capability call always returns `status:"error"` regardless of the payload. Setting a real subflow sys_id is the only change needed to unblock invocation. |

---

#### Fix 2 — Mark the `ticket` input mandatory *(addresses RC3 — defensive hardening)*

| Field | Value |
|-------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac` · field `input_schema` → `ticket.mandatory`; AND `sn_aia_agent_tool_m2m` `3c72dab2668c4ba5a6080a5cd5fb2b91` · field `inputs` → `ticket.mandatory` |
| **Current** | `false` |
| **Proposed** | `true` |
| **Rationale** | Without `mandatory:true` the model may call the tool without a sys_id, producing an empty payload and the same error path as the capability misconfiguration. Marking it mandatory causes the platform to validate before invocation. |

---

#### Fix 3 — Add boundary guidance to the tool description *(addresses tool quality smells — defensive)*

| Field | Value |
|-------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac` · field `description` |
| **Current** | *"Summarises a bench ticket by invoking the x_snc_tsbench_unmapped_capability GenAI capability. Give it a ticket sys_id. Returns the generated summary."* |
| **Proposed** | Extend to include: (a) what a valid ticket sys_id looks like (a 32-character hex string from `x_snc_tsbench_ticket`), (b) that the input must be a sys_id — not a display number or URL, and (c) what this tool does NOT do (e.g. does not accept `incident` or `problem` sys_ids). |
| **Rationale** | `agent_config` flagged `description_no_negative_guidance` and `description_no_input_guidance`. Without input-format guidance the model may pass a display value instead of a sys_id. |

---

#### Fix 4 — Add trigger wiring if record-event firing is required *(addresses RC4 — only if autonomous firing is intended)*

| Field | Value |
|-------|-------|
| **Target type** | Wiring |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` — create a new row |
| **Current** | No rows |
| **Proposed** | Create a trigger link associating the agent (or a use case) with the appropriate trigger configuration and table event. If the agent is intended only for conversational use, this fix is not required. |
| **Rationale** | Without trigger wiring the agent never fires on a record event. This run succeeded via conversational invoke, so this is not a blocker for the current usage pattern. |

---

### VERIFICATION

After applying **Fix 1**:

1. In AI Agent Studio, open **Seed 04 Summarizer** and invoke it conversationally:
   > *"Please summarise the bench ticket with sys_id 5b4b3d152baa475817a6ffbeee91bf2b."*
2. In the new execution plan, confirm:
   - The `summarise_ticket` tool call shows `ok:true` (not `ok:false`).
   - The agent's final message contains a human-readable summary, not a fallback error.
3. Run `genai_log check_config` on capability `92ff62af516741769c437feb88c80ef3` and confirm `api_state` changes from `dangling` to `resolved`.

After applying **Fix 2**:

4. Attempt to invoke the agent without a sys_id; the platform should reject the tool call at invocation with a mandatory-input-missing error rather than reaching the capability.

---

### DATA MARKERS
*(Flag for redaction before this report leaves the instance)*

- `x_snc_tsbench_ticket` record: short_description contains operational ticket content — review before sharing externally.
- `sn_aia_message` user profile content: includes user email and user sys_id — redact before sharing.

All other values quoted above are configuration identifiers (sys_ids, field names, capability names) and carry no personal data.
References: null

---

## 4. This run's audit-trail measurements

Derived from `x_snc_troubleshoot_audit` (`action_type=result`) per §E1–§E2, independently
of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 7/7 (L1, L2, L3, L4, L5, L6, L7) — mechanical §E2 map of the distinct tool set
- **Tool-call count:** 14 result rows
- **Ordered tool-call list:**
  1. `agent_trace` (02:40:15)
  2. `read_artifact` (02:40:25)
  3. `read_artifact` (02:40:38)
  4. `read_artifact` (02:40:38)
  5. `read_artifact` (02:41:06)
  6. `genai_log` (02:41:06)
  7. `agent_config` (02:41:06)
  8. `read_artifact` (02:41:39)
  9. `log_analysis` (02:41:39)
  10. `query_table` (02:41:39)
  11. `read_artifact` (02:42:07)
  12. `read_artifact` (02:42:36)
  13. `query_table` (02:42:36)
  14. `schema_lookup` (02:42:37)
- **Distinct tool names:** 7 — `agent_trace`, `read_artifact`, `genai_log`, `agent_config`, `log_analysis`, `query_table`, `schema_lookup`
- **LLM-call count:** 9 (`type=gen_ai`; also `tool` 14, `agent` 1, `access_verification` 1, `communicator` 1)
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 on `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`): `agent_trace`, `agent_config`, `schema_lookup`, `query_table`, `genai_log`, `log_analysis`, `read_artifact` — all seven attached and active, `max_auto_executions = 10` on every one. Read before this run and re-read after the run set; no tool attachment changed.
- **Terminal state:** `sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty
- **Wall clock:** 5 m 38 s (338 s) — 2026-08-06 02:40:04 → 02:45:42

---

## 5. Notes specific to this run

- The MCP invocation returned before the run finished; the terminal state recorded above was read by polling this run's own `sn_aia_execution_plan` record.
- This run's `x_snc_troubleshoot_run` anchor record was left at `status: running` even after the agent execution reached `completed`. The terminal state above is read from the execution plan, not from the anchor.
- The report's claim that the `syslog` read was DENIED under a caller restriction is the run's own prose. It was not independently verified by the operator; it is reproduced as written.
