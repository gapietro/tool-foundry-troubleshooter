# Scoring packet — Row 19

**Seed:** 05 (use case exists but is inactive) · **Harness:** native (Agent Doctor) · **Run:** 2

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

**Harness:** native (Agent Doctor, agent sys_id `e1392946828940e5a708fc51b0a5e954`, fresh conversation)
**Prompt sent (verbatim):** `Diagnose: the agent "Seed 05 Ticket Acknowledger" should have triaged bench ticket 29fd09c42b6a4bd417a6ffbeee91bfb0 within the last 24 hours and never ran.`

Provenance note: this exact request text (unchanged across prior benchmark
passes) was recovered from a preserved artifact rather than a live database
record, since the harness does not persist inbound request text on
`x_snc_troubleshoot_run`. It is treated as reliable, corroborated by two
independent signals, but is one level removed from a byte-for-byte certified
copy of what was sent over the wire in this specific pass. This does not
affect the validity of the run itself.

**This run's own identity:** Execution ID `4e74b66c2baacf14f243fed2ce91bf31`, conversation `79743aec2b6acf14f243fed2ce91bfe3`
**Terminal state:** Completed
**Wall clock:** 111s
**Tool-call count (as reported when this run was fired):** 7 — `agent_trace` ×1, `agent_config` ×1, `read_artifact` ×3, `query_table` ×1, `genai_log` ×1 (14 execution tasks total). This run did not call `log_analysis`.

Full text of the Fix Report (the message the user/caller actually sees):

> ## Fix Report — Seed 05 Ticket Acknowledger
>
> ---
>
> ### FAILURE SUMMARY
>
> The agent **Seed 05 Ticket Acknowledger** was expected to triage bench
> ticket `29fd09c42b6a4bd417a6ffbeee91bfb0` ("New starter needs laptop
> provisioned before Monday", Priority 3, created 2026-08-02 01:29:53 UTC)
> but produced zero execution plans. The agent is wired to a single trigger
> — **Seed 05 Bench Ticket Created** — via use case **Seed 05 Ticket
> Acknowledgement**. That trigger record is **inactive (`active = 0`)**. An
> inactive trigger fires no business rule, so the platform never submitted
> the ticket to the agent. No execution ever started.
>
> ---
>
> ### LAYERS SWEPT
>
> | # | Layer | Status |
> |---|-------|--------|
> | 1 | Execution trace | **SWEPT** — zero execution plans found; absence confirmed as genuine (read status `empty`, not `DENIED`) |
> | 2 | Instructions | **SWEPT** — instructions present and coherent (118 chars); context_processing_script is boilerplate auto-populated by platform |
> | 3 | Tool definitions | **SWEPT** — zero tools attached; no tool smells possible; not a blocker because the agent's task requires no tool calls |
> | 4 | Data schemas | **SWEPT** — `x_snc_tsbench_ticket` confirmed to exist; `state` field absent on this custom table (minor schema note only) |
> | 5 | Data | **SWEPT** — target ticket confirmed present and readable |
> | 6 | GenAI stack | **NOT SWEPT (full)** — the agent never reached the model layer, so a full capability audit adds no diagnostic value. A 100-row sample of capability definitions was reviewed; no errors found. A full sweep is unnecessary until the trigger is fixed and the agent actually runs. |
> | 7 | Trigger and wiring | **SWEPT** — trigger found, link found, root cause confirmed here |
>
> > **Platform log layer (log_analysis):** NOT SWEPT. The `syslog` table restricts cross-scope callers and this tool cannot lift that restriction. Because the agent never triggered, no scoped execution sys_id exists to pass. An instance administrator with the `admin` role can query `syslog` directly if deeper platform-level evidence is needed after the fix is applied.
>
> ---
>
> ### ROOT CAUSES
>
> #### RC-1 — Trigger is inactive
>
> | Field | Value |
> |-------|-------|
> | **Layer** | 7 — Trigger and wiring |
> | **Component** | `sn_aia_trigger_configuration` › Seed 05 Bench Ticket Created |
> | **Finding** | The trigger record has `active = 0`; the platform will never fire it regardless of matching records |
> | **Evidence** | `sn_aia_trigger_configuration` sys_id `bfb77d6c64884500a80203ee029436ee`, field `active`, value `"0"` (agent_config artifact, triggers section) |
> | **Confidence** | **CONFIRMED** — the trigger link exists, the use case is wired, the ticket exists and satisfies the condition `short_descriptionISNOTEMPTY`; the only defect is the inactive flag |
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
> | **Target** | `sn_aia_trigger_configuration` › sys_id `bfb77d6c64884500a80203ee029436ee` |
> | **Current** | `active = false` |
> | **Proposed** | `active = true` |
> | **Rationale** | An inactive trigger emits no business rule event. Activating it causes the platform to fire on every `x_snc_tsbench_ticket` insert where `short_description IS NOT EMPTY`, which is the condition already authored on the record. |
>
> > **No other fixes are required.** Instructions, use case wiring, team membership, and the ticket record are all correct. The agent has no tools but does not need any for a pure acknowledgement task.
>
> ---
>
> ### VERIFICATION
>
> 1. Navigate to **AI Agent Studio → Triggers**, open **Seed 05 Bench Ticket Created**, and confirm `Active` is now checked.
> 2. Insert a new record into `x_snc_tsbench_ticket` with a non-empty `short_description` and any priority value.
> 3. Run `agent_trace` with agent name **Seed 05 Ticket Acknowledger** — expect at least one execution plan with `state = complete` or `state = in_progress`.
> 4. Confirm the plan's objective contains the ticket's short description and priority restated by the agent.
> 5. *(Optional)* To back-triage ticket `29fd09c42b6a4bd417a6ffbeee91bfb0`, manually invoke the agent via the **startAiAgentConversation** API, passing the ticket sys_id in `contextMemory`.
>
> ---
>
> ### DATA MARKERS
>
> The following record data was quoted as evidence and should be redacted
> before this report crosses the instance boundary:
>
> - `x_snc_tsbench_ticket` sys_id `29fd09c42b6a4bd417a6ffbeee91bfb0` — `short_description`: *"New starter needs laptop provisioned before Monday"*, `priority`: `3`, `sys_created_on`: `2026-08-02 01:29:53`

No conversation id belonging to a prior fixture run is quoted anywhere in
this report.

---

## 4. This run's Task 10 audit-trail measurements

These were derived from `x_snc_troubleshoot_audit` (and, for native, the
`sn_aia_gen_ai_m2m` LLM-call linkage) independently of and before any Fix
Report was read for correctness.

- **`layers_swept` (audit-trail-derived): 6/7 (L1, L2, L3, L5, L6, L7)**
- **Tool-call count:** 7
- **Tool-call order:** `agent_trace`, `agent_config`, `read_artifact` ×3, `query_table`, `genai_log`
- **LLM-call count:** 4
- **`layers_available`:** 7/7 — `agent_trace, agent_config, schema_lookup, query_table, genai_log, log_analysis, read_artifact`, all `active=true` on the agent record (re-queried directly from the instance for this measurement, not assumed)
- **Terminal state:** Completed
- **Wall clock:** 111s

This run's one `agent_config` call requested no specific section and
returned all sections (`overview, instructions, tools, triggers`), crediting
L2, L3, L7 — consistent with this run's own LAYERS SWEPT table above; no
disagreement between the report and the audit trail on this run.

**Anchor-record note.** This run's own `x_snc_troubleshoot_run` anchor row
(the observation-channel record used to derive the measurements above)
remained `status: running` and was never updated to a terminal state,
despite the underlying native execution reaching `Completed` as shown above.
This is a harness-observation-channel gap, not a scoring input.
