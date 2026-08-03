# Scoring packet — Row 17

**Seed:** 05 (use case exists but is inactive) · **Harness:** native (Agent Doctor) · **Run:** 1

This packet is self-contained. It contains the scoring rubric, this seed's
specification, this run's full report, and this run's audit-trail
measurements — nothing else. Score this row using only the content below.

---

## 1. Scoring rubric (verbatim from `benchmark/scorecard-template.md`)

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

The rubric scores each run **out of 6**. The gate counts **runs**: *"≥ 8/10 runs
with correct root cause + usable fixes."* "Correct root cause + usable fixes"
names exactly two of the four rubric columns, so:

```
passes_gate = 1  if and only if  root_cause_layer_correct == 2
                                 AND fix_usable_unedited == 1
              0  otherwise
```

Nothing else feeds it. `evidence_cites_trace_and_config` and
`fix_target_correct` are **not** in the gate expression — they are diagnostic
detail that explains *why* a run passed or failed and must still be filled in,
but a run does not pass by accumulating them. A run can score 3/6 and pass; a run
can score 4/6 and fail.

**Why `fix_target_correct` still constrains the gate indirectly, and why that is
not a third term.** Excluding `fix_target_correct` from the expression opens a
hole: a run can name the right root-cause **layer** and propose a fix that is
perfectly well-formed and could be applied verbatim — but fixes **nothing**,
because it does not address the defect the seed actually carries (it targets a
plausible-looking but wrong specific target within the right area). Under a
purely formal reading of "applied as written," that run would score
`fix_usable_unedited` = 1 and **pass the gate**, making that run's
`fix_target_correct` = 0 inert as a scoring signal.

The fix is in the column definition, not the expression: a fix aimed at the wrong
target is not usable, so **`fix_usable_unedited` = 0 whenever
`fix_target_correct` = 0.** The gate keeps the two-term shape — *"correct root
cause + usable fixes"* — and "usable" now means what the word means. **A scorer
who marks a run 2 / 0 / 1 (`root_cause_layer_correct` / `fix_target_correct` /
`fix_usable_unedited`) has mis-scored it**; the correct row is 2 / 0 / 0,
`passes_gate` = 0.

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
  not match the target instance's `sys_one_extend_capability` record. Either way
  the tool tests a malformed reference rather than an unmapped provider. A
  hardcoded value that MATCHES the instance's record is a valid install, not a
  void.

**How to record one.** Put `void` in `passes_gate` — not `0` — write the reason
in `notes`, and leave the four rubric columns blank. A blank rubric with a stated
reason is honest; a `0` is a measurement that did not happen.

---

## 2. Seed specification (verbatim, `benchmark/seeds/seed-05-inactive-usecase.md`)

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

> **OBSERVED AT TASK 12 (2026-08-02) — the prediction held.** The m2m gate was
> PATCHed on post-install and re-read `true`
> (`sn_aia_trigger_agent_usecase_m2m` `ba30d8775b0c4cebb960c58830590d5d`);
> the trigger config stayed `active=false` as seeded. Ticket
> `29fd09c42b6a4bd417a6ffbeee91bfb0` (non-empty short_description) was inserted
> and **no execution plan was created anywhere on the instance** in the
> following minutes — the absence the seed exists to produce. The run-as
> question below **stays open**: the trigger was never activated during this
> verification, so whether it fires with empty run-as remains unmeasured.
>
> [Editorial note — scoring-isolation boundary: a sentence originally here
> described how two specific prior-pass runs scored against this seed. It has
> been omitted because it references prior-pass scores, which must not reach a
> scorer of this pass.]

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
nothing, a diagnosis naming either gate is arguably right, and this
construction's own scored rows would be void by construction.

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
in the scorecard (see the rubric's §A3 "Void runs" above); do not score
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
`fix_target_correct` (the partial band — see the rubric §A above), per "The
two gates" above.

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

## 3. This run's report

**Harness:** native (Agent Doctor, agent sys_id `e1392946828940e5a708fc51b0a5e954`)
**Prompt sent (verbatim):** `Diagnose: the agent "Seed 05 Ticket Acknowledger" should have triaged bench ticket 29fd09c42b6a4bd417a6ffbeee91bfb0 within the last 24 hours and never ran.`

Provenance note: this exact request text (unchanged across prior benchmark
passes) was recovered from a preserved artifact rather than a live database
record, since the harness does not persist inbound request text on
`x_snc_troubleshoot_run`. It is treated as reliable, corroborated by two
independent signals, but is one level removed from a byte-for-byte certified
copy of what was sent over the wire in this specific pass. This does not
affect the validity of the run itself.

**This run's own identity:** Execution ID `5aa332282b6a871817a6ffbeee91bf13`, conversation `46a3b22c2be6871817a6ffbeee91bf9a`
**Terminal state:** Completed
**Wall clock:** 168s
**Tool-call count (as reported when this run was fired):** 9 — `agent_trace` ×1, `agent_config` ×1, `read_artifact` ×3, `query_table` ×2, `genai_log` ×1, `log_analysis` ×1 (17 execution tasks total)

Full text of the Fix Report (the message the user/caller actually sees):

> ## Fix Report — Seed 05 Ticket Acknowledger
>
> ---
>
> ### FAILURE SUMMARY
>
> The agent **Seed 05 Ticket Acknowledger** was expected to triage bench
> ticket `29fd09c42b6a4bd417a6ffbeee91bfb0` ("New starter needs laptop
> provisioned before Monday", priority 3, created 2026-08-02 01:29:53) but
> produced **no execution at all**. The root cause is a single, confirmed
> defect: the trigger configuration **Seed 05 Bench Ticket Created** is set
> to **inactive** (`active = 0`). Because the trigger is off, the platform
> never fires the business rule that would create an execution plan, so no
> agent run was ever scheduled. The agent record's own description confirms
> the intent: *"Benchmark seed - the agent is fine, its trigger is not."*
>
> ---
>
> ### LAYERS SWEPT
>
> | # | Layer | Status |
> |---|-------|--------|
> | 1 | Execution trace | **SWEPT** — `sn_aia_execution_plan` returned empty (status ok/empty); genuine absence confirmed. |
> | 2 | Agent instructions | **SWEPT** — instructions present (118 chars); context_processing_script auto-populated boilerplate (2,124 chars). |
> | 3 | Tool definitions | **SWEPT** — zero tools attached (`sn_aia_agent_tool_m2m` empty, status ok/empty); no tool defects possible. |
> | 4 | Data schemas | **SWEPT** — `x_snc_tsbench_ticket` confirmed to exist; `number` and `state` columns absent on this table (field warnings noted, not relevant to this failure). |
> | 5 | Data | **SWEPT** — target record exists and is readable on `x_snc_tsbench_ticket`. |
> | 6 | GenAI stack | **SWEPT** — no execution plan existed, so no LLM calls were made; consistent with trigger never firing. |
> | 7 | Trigger and wiring | **SWEPT** — trigger found; `active = 0` confirmed. |
> | — | Platform logs | **UNAVAILABLE** — `syslog` has `caller_access = Caller Restriction`; this application cannot lift that restriction. An instance administrator must relax `caller_access` on `syslog` or export logs directly. This layer was **not** reported as clean. |
>
> ---
>
> ### ROOT CAUSES
>
> #### Root Cause 1 — Inactive trigger *(primary)*
>
> | Attribute | Value |
> |-----------|-------|
> | **Layer** | 7 — Trigger and wiring |
> | **Component** | `sn_aia_trigger_configuration` — "Seed 05 Bench Ticket Created" |
> | **Finding** | Trigger is **inactive** (`active = 0`). The platform will not evaluate its condition or fire the agent while this flag is off, regardless of how many matching records are created on `x_snc_tsbench_ticket`. |
> | **Evidence** | `sn_aia_trigger_configuration` sys_id `bfb77d6c64884500a80203ee029436ee`, field `active`, value `"0"` — read via `agent_config` (artifact `e5b3f6282b6a871817a6ffbeee91bf13`, triggers section); corroborated by `overview.active_trigger_links = 0` and `active_trigger_configurations = 0` on `sn_aia_agent` sys_id `a4b7ef5d793346ea861730c6d28b8f58`; and by `sn_aia_execution_plan` returning genuinely empty in layer 1. |
> | **Confidence** | **CONFIRMED** — layers 1 and 7 agree; agent description explicitly names the trigger as the defect. |
>
> #### Secondary Observation — No tools attached
>
> | Attribute | Value |
> |-----------|-------|
> | **Layer** | 3 — Tool definitions |
> | **Finding** | `tool_count = 0`. The instruction asks the agent to restate the short description and priority. If trigger context does not carry those values, the agent will have no way to look them up. This is **not** the cause of the current failure (the agent never ran) but may block correct execution after the trigger is activated. |
> | **Evidence** | `sn_aia_agent_tool_m2m` read status `empty`; `agent_config` overview `tool_count = 0`, `active_tool_count = 0`. |
> | **Confidence** | **CONFIRMED** as an absence; whether a tool is *required* depends on trigger context content — verify after Fix 1. |
>
> #### Secondary Observation — No run-as identity / no access roles
>
> | Attribute | Value |
> |-----------|-------|
> | **Layer** | 7 — Trigger and wiring |
> | **Finding** | `sys_agent_access_role_configuration` is empty and the trigger names no run-as identity (`identity_resolution = none`). ACL alignment cannot be verified from configuration alone. |
> | **Evidence** | `agent_config` access_alignment section: `run_as_paths.none = 1`; `required_role_count = 0`; `comparison_status = not_possible`. |
> | **Confidence** | **UNCONFIRMED** as a defect — confirmed or cleared by inspecting the initiating user's roles from a real run via `agent_trace`. |
>
> ---
>
> ### FIXES
>
> #### Fix 1 — Activate the trigger *(required)*
>
> | Attribute | Value |
> |-----------|-------|
> | **Target type** | Configuration |
> | **Target** | `sn_aia_trigger_configuration`, sys_id `bfb77d6c64884500a80203ee029436ee`, field `active` |
> | **Current** | `0` (inactive) |
> | **Proposed** | `1` (active) |
> | **Rationale** | The trigger is the sole gate between a new `x_snc_tsbench_ticket` record and an execution plan. While it is off, no run is possible regardless of any other configuration. The trigger condition (`short_descriptionISNOTEMPTY`) and objective template are already correctly set. |
>
> #### Fix 2 — Verify tool availability after Fix 1 *(advisory)*
>
> | Attribute | Value |
> |-----------|-------|
> | **Target type** | Tool schema / wiring |
> | **Target** | `sn_aia_agent` sys_id `a4b7ef5d793346ea861730c6d28b8f58` — tool bindings |
> | **Current** | Zero tools attached |
> | **Proposed** | Attach a tool capable of reading `short_description` and `priority` from `x_snc_tsbench_ticket` if those fields are not already injected by trigger context |
> | **Rationale** | The instruction requires restating the ticket's short description and priority. Without a lookup tool or context injection, the agent cannot source those values. Confirm after Fix 1 produces a real run. |
>
> ---
>
> ### VERIFICATION
>
> 1. Set `active = 1` on `sn_aia_trigger_configuration` sys_id `bfb77d6c64884500a80203ee029436ee`.
> 2. Insert or re-save a record on `x_snc_tsbench_ticket` with a non-empty `short_description` (the trigger condition is `short_descriptionISNOTEMPTY`).
> 3. Call `agent_trace` with agent name **Seed 05 Ticket Acknowledger** — expect at least one execution plan with `state = complete` or in-progress.
> 4. Confirm the task tree includes an acknowledgement response restating the short description and priority.
> 5. If the run errors citing a missing field or empty context, apply Fix 2 (attach a record-lookup tool).
> 6. If the run is denied or produces an empty result due to permissions, take the initiating user from the trace and compare their roles against any access role configuration added in AI Agent Studio.
>
> ---
>
> ### DATA MARKERS
>
> The following record values were quoted as evidence and should be
> redacted before this report leaves the instance:
>
> - `x_snc_tsbench_ticket` sys_id `29fd09c42b6a4bd417a6ffbeee91bfb0`:
>   - `short_description`: *"New starter needs laptop provisioned before Monday"*
>   - `priority`: *3*
>   - `sys_created_on`: *2026-08-02 01:29:53*

No conversation id belonging to a prior fixture run is quoted anywhere in
this report.

---

## 4. This run's Task 10 audit-trail measurements

These were derived from `x_snc_troubleshoot_audit` (and, for native, the
`sn_aia_gen_ai_m2m` LLM-call linkage) independently of and before any Fix
Report was read for correctness.

- **`layers_swept` (audit-trail-derived): 6/7 (L1, L2, L3, L5, L6, L7)**
- **Tool-call count:** 9
- **Tool-call order:** `agent_trace`, `agent_config`, `read_artifact` ×3, `query_table`, `log_analysis`, `query_table`, `genai_log`
- **LLM-call count:** 5
- **`layers_available`:** 7/7 — `agent_trace, agent_config, schema_lookup, query_table, genai_log, log_analysis, read_artifact`, all `active=true` on the agent record (re-queried directly from the instance for this measurement, not assumed)
- **Terminal state:** Completed
- **Wall clock:** 168s

This run's one `agent_config` call requested no specific section and
returned all sections (`overview, instructions, tools, triggers`), crediting
L2, L3, L7 — consistent with this run's own LAYERS SWEPT table above; no
disagreement between the report and the audit trail on this run.

**Note specific to this run.** This run's `query_table` calls include one
against a misspelled table name (`sn_tsbench_ticket`, missing the `x_snc_`
prefix), which read `sys_db_object: empty` (table does not exist), and a
second, correctly-spelled call against `x_snc_tsbench_ticket` which read
`ok`. Both are counted in the tool-call total above; the correctly-targeted
call is what earns the L5 credit.

**Anchor-record note.** This run's own `x_snc_troubleshoot_run` anchor row
(the observation-channel record used to derive the measurements above)
remained `status: running` and was never updated to a terminal state,
despite the underlying native execution reaching `Completed` as shown above.
This is a harness-observation-channel gap, not a scoring input.
