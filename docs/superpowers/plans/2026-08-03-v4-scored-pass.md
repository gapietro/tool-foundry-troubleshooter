# v4 Scored Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a readable, single-variable baseline for the Phase 1b harness comparison — 20 blind scored runs across both harnesses on the same day, with audit-derived measurements — so the depth work that follows is attributable.

**Architecture:** This is an **operational** plan, not a code plan. The diff is docs-only. "Tests" here are **verification gates**: a pre-flight read that must return a stated value before any scored run is spent, and a distinctness/terminality check on every run before it is scored. The TDD shape is preserved in substance — assert the expected value first, observe the actual, and stop if they disagree — because a benchmark that proceeds past a failed precondition produces numbers nobody can interpret.

**Tech Stack:** ServiceNow gpinst01 (Zurich P10), foundry MCP tools (`servicenow_connect`, `servicenow_query`, `servicenow_request`, `servicenow_aia_execute`), `now-sdk` CLI, blind Agent-tool subagents for scoring.

**Spec:** `docs/superpowers/specs/2026-08-03-v4-scored-pass-design.md`
**Issue:** #98 · **Branch:** `chore/benchmark-v4-scored-pass`

## Global Constraints

- **No product code changes.** `docs/agent/agent-doctor-instructions.md`, `src/server/PaScriptToolAdapter.js` and everything under `src/server/` stay byte-identical. If any task finds itself editing one, stop and escalate — the drift measurement depends on it (spec §2.1).
- **Version under test: `2026.08.0301`** for both harnesses. The bump to `2026.08.0302` happens only in the results commit and changes no deployed artifact.
- **Instance:** gpinst01. `servicenow_connect` requires `authType="keychain"` **and** explicit `username="admin"`.
- **All ServiceNow access goes through foundry MCP tools.** Never `curl`, never `security`, never keychain reads in the shell (CLAUDE.md).
- **Blind rule.** No seed knowledge reaches either harness — not in instructions, tool descriptions, tool output, or the invocation prompt. Invocation text is the diagnostic target and nothing else.
- **Custom endpoint:** `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`, poll `GET /api/x_snc_troubleshoot/v1/troubleshooter/runs/{run_id}`. The `/v1/` segment is mandatory.
- **Agent Doctor sys_id:** `e1392946828940e5a708fc51b0a5e954`.
- **Status reads are stale on single-record queries** (v3 finding). Verify terminal status via `GET /runs/{id}` or a multi-record range query, never a single-record table read.
- **Every measurement is read, never copied from a prior row** — including `layers_available`, which exists precisely to distinguish *did not look* from *could not look*.
- **A digest miss is not an absence.** `PaAuditLogger` digests payloads head+tail past 4,000 chars. A hit is evidence; a miss must be reported as "not found in the preserved portion".

---

### Task 1: Prove the deployed code is the code

**Files:**
- Create: `benchmark/raw-evidence-v4.md` (header + deploy-verification section only)

**Interfaces:**
- Produces: a confirmed statement that gpinst01 runs `2026.08.0301`, and the `raw-evidence-v4.md` file that every later task appends to.

- [ ] **Step 1: Connect and assert the version**

Call `servicenow_connect` with `authType="keychain"`, `instance="gpinst01"`, `username="admin"`.

Then `servicenow_query` table `sys_app`, query `sys_id=13043037d3da4293904504ef30589334`, fields `name,version`.

Expected: `version` = `2026.08.0301`.

- [ ] **Step 2: If the version disagrees, deploy — otherwise skip to Step 3**

Only if Step 1 returned anything other than `2026.08.0301`:

```bash
git checkout main && git pull && now-sdk build && now-sdk install --alias gpinst01
```

Re-run Step 1's query. It must now read `2026.08.0301`. The v3 pass opened by finding the instance one version behind; this step exists because that happened.

- [ ] **Step 3: Byte-compare the four Script Includes that matter**

`sys_updated_on` is **not** bumped by an SDK install and is a misleading indicator. Compare content instead.

For each of `PaFixReport`, `PaArtifactStore`, `PaToolRegistry`, `PaScriptToolAdapter`: `servicenow_query` table `sys_script_include`, query `name=<name>`, fields `name,script`, and diff the returned `script` against the matching file in `src/server/`.

Expected: byte-identical for all four. Record any divergence and **stop** — a divergence means the pass would measure something other than the committed code.

- [ ] **Step 4: Byte-compare the shared instructions**

`servicenow_query` table `sn_aia_agent`, query `sys_id=e1392946828940e5a708fc51b0a5e954`, fields `name,instructions`.

Expected: byte-identical to `docs/agent/agent-doctor-instructions.md`. This is the constraint the whole drift measurement rests on (spec §2.1) — if it has drifted, native's rows cannot be compared to the standing rows and the pass design needs revisiting before any run.

- [ ] **Step 5: Write the deploy-verification section**

Create `benchmark/raw-evidence-v4.md` with a header naming instance, date, version under test, endpoints, and audit-derivation method (model it on `benchmark/raw-evidence-v3.md` lines 1–30), plus a "Deploy verification" section recording all four comparisons above with their measured results.

- [ ] **Step 6: Commit**

```bash
git add benchmark/raw-evidence-v4.md
git commit -m "bench: v4 deploy verification — gpinst01 at 2026.08.0301 (#98)"
```

---

### Task 2: Fixture validity, budget knobs, and `layers_available`

**Files:**
- Modify: `benchmark/raw-evidence-v4.md` (append preconditions section)

**Interfaces:**
- Consumes: Task 1's file.
- Produces: a void/not-void verdict per seed, the two budget values, and the measured `layers_available` used by every scored row.

- [ ] **Step 1: Assert seed 2 is in its v2 construction**

`servicenow_query` table `sn_aia_agent_tool_m2m`, query `agent=cd050d48e810411d9f113fd530694fe6^active=true`, fields `tool,tool.name,max_auto_executions`.

Expected: **exactly one** row, `tool.name` = `measure_request`. Zero rows means the v1 zero-tool construction is live and seed 2 is void.

- [ ] **Step 2: Assert seed 4's capability sys_id matches**

`servicenow_query` table `sys_one_extend_capability`, query `name=x_snc_tsbench_unmapped_capability`, fields `sys_id,name`.

Expected: `sys_id` = `92ff62af516741769c437feb88c80ef3`. A mismatch with the value hardcoded in the installed `summarise_ticket` tool script voids seed 4 (`scorecard-template.md` §A3).

Also read the definition row: `servicenow_query` table `sys_one_extend_capability_definition`, query `sys_id=904c0485699a4a73a124446a7231c563`, fields `api,api_type,connection`. Expected, per v3: `api_type=sys_hub_flow`, `api=00000000000000000000000000000000` (dangling — the seeded defect), `connection` empty (the R-22 decoy).

- [ ] **Step 3: Assert seed 5's two activation gates**

`servicenow_query` table `sn_aia_trigger_agent_usecase_m2m`, query `sys_id=ba30d8775b0c4cebb960c58830590d5d`, fields `active`. Expected: `true`.

`servicenow_query` table `sn_aia_trigger_configuration`, query `sys_id=bfb77d6c64884500a80203ee029436ee`, fields `active`. Expected: `false` — this is the seeded defect and must remain off.

Both wrong-way-round means the seed isolates nothing and is void. Fluent cannot set the first gate; if it reads `false`, PATCH it to `true` and re-read to confirm before proceeding.

- [ ] **Step 4: Assert the bench ticket and the four execution targets exist**

`servicenow_query` table `x_snc_tsbench_ticket`, query `sys_id=29fd09c42b6a4bd417a6ffbeee91bfb0`, fields `sys_id,short_description,priority`.

`servicenow_query` table `sn_aia_execution_plan`, query `sys_idIN b07dc9082baa4314f243fed2ce91bf4b,4b315ecc2b66c314f243fed2ce91bfca,c4cd01842b6a4bd417a6ffbeee91bfc3,16ddc10c2baa4314f243fed2ce91bf15`, fields `sys_id,state`.

Expected: the ticket present; all four plans present with `state=completed`. These are the same targets v3 used, reused verbatim so the diagnostic subject is identical across passes.

- [ ] **Step 5: Read both budget knobs and `layers_available` in one query**

`servicenow_query` table `sn_aia_agent_tool_m2m`, query `agent=e1392946828940e5a708fc51b0a5e954^active=true`, fields `tool,tool.name,max_auto_executions`.

Expected: 7 rows — `agent_trace`, `agent_config`, `schema_lookup`, `query_table`, `genai_log`, `log_analysis`, `read_artifact` — each `max_auto_executions=10`. This is §E3's query and fills `layers_available` **and** the per-tool budget column.

Then `servicenow_query` table `sys_properties`, query `name=sn_aia.continuous_tool_execution_limit`, fields `name,value`. Expected: `25`.

Record the measured values. Do not copy the expectations into a scorecard row.

- [ ] **Step 6: Append the preconditions section and commit**

Append a table to `benchmark/raw-evidence-v4.md` in the shape of `raw-evidence-v3.md`'s "Seed fixture preconditions" table — one row per condition, the value read, and a not-void/void verdict — plus the budget values and measured `layers_available`.

```bash
git add benchmark/raw-evidence-v4.md
git commit -m "bench: v4 fixture preconditions, budget knobs, layers_available (#98)"
```

If **any** seed reads void and cannot be repaired, stop and escalate before firing runs. `scorecard-template.md` §A3 governs recording; the 8-valid-run floor governs whether the pass still reads.

---

### Task 3: Smoke gate, both harnesses

**Files:**
- Modify: `benchmark/raw-evidence-v4.md` (append smoke-gate section)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: a pass/fail gate result per harness. Not a scored row.

- [ ] **Step 1: Fire the native smoke run**

`servicenow_aia_execute` against Agent Doctor (`e1392946828940e5a708fc51b0a5e954`) with the prompt:

```
Diagnose execution plan c9d63a932bda8b9417a6ffbeee91bfd0.
```

Nothing else in the prompt. This is the standing smoke specimen — chosen because it is invisible from the plan header (`state=Completed`, empty `state_reason`, all tasks and tool calls Success), so it tests whether a header-deep diagnosis gets caught.

- [ ] **Step 2: Assert the native gate**

Expected: terminal, with a structurally valid Fix Report. The known answer is `script_error` in `context_processing_script` **line 42**. Record the conversation id, wall clock, tool-call count, and whether line 42 was named.

The bar is **terminal with valid output**, not correct diagnosis (Task 9's ruling). A native run that misses line 42 is recorded, not a blocker — but it is a notable signal worth flagging in the writeup, since native found it at both Task 9 and Task 12.

- [ ] **Step 3: Fire the custom smoke run**

`servicenow_request` method `POST`, path `/api/x_snc_troubleshoot/v1/troubleshooter/analyze`, body:

```json
{"execution": "c9d63a932bda8b9417a6ffbeee91bfd0", "mode": "diagnose"}
```

Poll `GET /api/x_snc_troubleshoot/v1/troubleshooter/runs/{run_id}` until terminal.

- [ ] **Step 4: Assert the custom gate**

Expected: terminal (`complete` or `failed`) with a structurally valid `fix_report` or a recorded rejection reason. Task 9's custom smoke was structurally valid and substantively wrong, and that was ruled an acceptable smoke outcome — the gate is terminality, not correctness.

A run that never reaches terminal **is** a blocker: stop and escalate, because the harness cannot produce the 10 rows the pass needs.

- [ ] **Step 5: Append and commit**

```bash
git add benchmark/raw-evidence-v4.md
git commit -m "bench: v4 smoke gate, both harnesses (#98)"
```

---

### Task 4: Recover seed 05's exact request body

**Files:**
- Modify: `benchmark/raw-evidence-v4.md` (append the recovered body)

**Interfaces:**
- Produces: the verbatim seed-05 request body used by Task 9 (seed 05 block).

**Why this is its own task.** Seeds 01–04 are diagnosed by execution-plan sys_id, recorded verbatim above. Seed 05 has **no execution plan by design** — the agent never fired — so its request takes an `agent` + `timeframe` + `description` form. Inventing that text would change the diagnostic subject between passes and silently break the v3↔v4 comparison.

- [ ] **Step 1: Read the v3 seed-05 run records**

`servicenow_query` table `x_snc_troubleshoot_run`, query `conversation_refINee3a71dc2baecfd417a6ffbeee91bfe5,734a7dd02b6a0b14f243fed2ce91bf73`, fields `sys_id,number,request,conversation_ref`.

Expected: two rows, TR1000103 and TR1000104, with the stored request payload.

- [ ] **Step 2: If `request` is empty, recover from the audit trail**

`servicenow_query` table `x_snc_troubleshoot_audit`, query `run=<sys_id from step 1>^action_type=intent`, fields `tool_name,input`. The first tool call carries the diagnostic target as delivered (#77).

- [ ] **Step 3: If neither yields it, reconstruct from the seed spec**

Read `benchmark/seeds/seed-05-inactive-usecase.md`'s Trigger section and construct the body from it, naming bench ticket `29fd09c42b6a4bd417a6ffbeee91bfb0`. **Record explicitly in `raw-evidence-v4.md` that seed 05's body was reconstructed rather than recovered**, so the v3↔v4 comparison on that seed carries the caveat it deserves.

- [ ] **Step 4: Append and commit**

```bash
git add benchmark/raw-evidence-v4.md
git commit -m "bench: recover seed 05 request body for v4 (#98)"
```

---

### Task 5: Run block — seed 01 (target: execution plan `b07dc9082baa4314f243fed2ce91bf4b`)

### Task 6: Run block — seed 02 (target: execution plan `4b315ecc2b66c314f243fed2ce91bfca`)

### Task 7: Run block — seed 03 (target: execution plan `c4cd01842b6a4bd417a6ffbeee91bfc3`)

### Task 8: Run block — seed 04 (target: execution plan `16ddc10c2baa4314f243fed2ce91bf15`)

### Task 9: Run block — seed 05 (target: the body recovered in Task 4)

**The five headings above share the step list below.** Each is dispatched as its own task; substitute that seed's target from its heading. The controller composes each brief from this shared section — `scripts/task-brief` cannot split a shared body, and that is expected here rather than a defect.

**Files:**
- Modify: `benchmark/raw-evidence-v4.md` (append this seed's four runs)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: four run identities per seed — native run 1, custom run 1, native run 2, custom run 2 — each verified terminal and distinct.

- [ ] **Step 1: Native run 1**

`servicenow_aia_execute` against `e1392946828940e5a708fc51b0a5e954`, prompt exactly:

```
Diagnose execution plan <this seed's plan sys_id>.
```

For seed 05, use the recovered body's equivalent natural-language form, identical across both native runs and recorded verbatim.

Record: conversation id, wall clock, terminal state, the full Fix Report text.

- [ ] **Step 2: Custom run 1**

`servicenow_request` `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze` with `{"execution": "<this seed's plan sys_id>", "mode": "diagnose"}` (seed 05: the Task 4 body). Poll `GET /runs/{run_id}` to terminal.

Record: run sys_id, `number` (TR-…), terminal status, the full `fix_report` or rejection reason, and the transcript.

- [ ] **Step 3: Native run 2** — repeat Step 1 in a **fresh conversation**, identical prompt.

- [ ] **Step 4: Custom run 2** — repeat Step 2, fresh `POST /analyze`, identical body.

- [ ] **Step 5: Verify terminality the non-stale way**

For custom runs, confirm terminal status via `GET /runs/{run_id}` or a multi-record range query on `x_snc_troubleshoot_run` — **never** a single-record table read, which returned stale `queued` values during v3 for runs the API already reported `failed`.

Expected: all four runs terminal. A run that is not terminal is re-fired **once**; both attempts recorded (spec §5).

- [ ] **Step 6: Verify run identities are distinct**

For the two custom runs, confirm two different `x_snc_troubleshoot_run` sys_ids. For the two native runs, confirm two different `conversation_id` values.

Expected: four distinct identities. `PaRunAnchor`'s "one anchor per user per 30 min" fallback is the hazard, and interleaving makes near-in-time runs **more** likely — if two runs share an anchor, their artifacts and audit rows interleave and both rows are contaminated. Record and escalate rather than scoring them.

- [ ] **Step 7: Append this seed's block and commit**

Append a section to `benchmark/raw-evidence-v4.md`: the four runs with identities, terminal states, wall clocks, and full report text.

```bash
git add benchmark/raw-evidence-v4.md
git commit -m "bench: v4 runs — seed <NN>, native and custom (#98)"
```

---

### Task 10: Compute the measurements for all 20 rows

**Files:**
- Modify: `benchmark/raw-evidence-v4.md` (append the measurement tables)

**Interfaces:**
- Consumes: Tasks 5–9's 20 run identities.
- Produces: per-row `layers_swept`, `layers_available`, tool-call count, tool names in order, and LLM-call count — the "given data" every scorer in Tasks 11–12 receives.

**This runs before any scoring.** §N7's asymmetry — the trail can refute a layer credit but never confer one — only holds if the trail is read independently of, and before, the report.

- [ ] **Step 1: Custom runs — resolve identity and read the trail**

For each of the 10 custom runs, the run sys_id is already known (no conversation hop needed — the custom harness owns its run record).

`servicenow_query` table `x_snc_troubleshoot_audit`, query `run=<run sys_id>`, fields `tool_name,action_type,input,output`, ordered ascending by creation.

- [ ] **Step 2: Native runs — the two-step hop**

Native's `run_id` is a conversation id, and `x_snc_troubleshoot_audit.run` is a reference to `x_snc_troubleshoot_run`, not a conversation id. Querying `audit.run=<conversation_id>` matches **nothing** and would record `0/7` for every row — a silent blank read as absence.

Step 2a: `servicenow_query` table `x_snc_troubleshoot_run`, query `conversation_ref=<conversation_id>`, fields `sys_id,number,harness,status`. Expect exactly one row; **zero rows means the run was never anchored**, which is a finding about the harness — record it in notes rather than moving on.

Step 2b: `servicenow_query` table `x_snc_troubleshoot_audit`, query `run=<sys_id from 2a>`, fields `tool_name,action_type,input,output`.

- [ ] **Step 3: Derive `layers_swept` from `action_type=result` rows only**

Take the **distinct** `tool_name` values where `action_type='result'`. An `intent` row records what the agent meant to call; a tool attempted but never returned has swept nothing.

Map through this table — distinct tool names are **not** the layer count:

| Tool | Layer(s) |
|---|---|
| `agent_trace` | 1 |
| `agent_config` | 2, 3, 7 |
| `schema_lookup` | 4 |
| `query_table` | 5 |
| `genai_log` | 6 |
| `log_analysis` | none of its own — supports 1 and 6 |
| `read_artifact` | not a layer |

- [ ] **Step 4: Refine `agent_config` credit from `sections_returned`**

For every `agent_config` result row, read `sections_returned` from the `output` payload. Map `instructions`→L2, `tools`→L3, `triggers`→L7; `overview` maps to no layer.

A section that never rendered is a layer that was **not** swept, whatever the Fix Report says. Credit only the layers whose sections actually returned. Note `sections_returned` sits in the payload head, so the digest preserves it.

Record the result as `n/7 (L1,L2,…)` — the "and which" half is what distinguishes a shallow run from a lucky one.

- [ ] **Step 5: Count tool calls and record invocation order**

From the same rows: total call count and the ordered list of tool names. This is the depth measurement — v3's headline was 1.0 calls/run with four of seven tools never invoked once.

- [ ] **Step 6: Count LLM calls, per harness**

Native — two steps:
```
servicenow_query sn_aia_execution_task  query=execution_plan=<plan sys_id>^type=agent^order=100  fields=sys_id
servicenow_query sn_aia_gen_ai_m2m      query=source_id=<that sys_id>^source_table=sn_aia_execution_task
```
Count the rows. `source_id` keys to the **top-level agent task**, not the execution plan and not the per-turn `type=gen_ai` sub-tasks — querying the plan directly returns 0 and would read as a dead linkage.

Custom — count `actor:'llm'` entries in the run's transcript. No platform-telemetry fallback: `sys_gen_ai_log_metadata.conversation` reads empty on exactly the custom harness's own `PaLlmProxy.reason()` rows.

- [ ] **Step 7: Re-read `layers_available` per run**

Re-run Task 2 Step 5's query. Expected 7/7, but **record the measured value per row** — tool attachments can change between builds, and that changing is the entire signal the column exists for.

- [ ] **Step 8: Append the measurement tables and commit**

```bash
git add benchmark/raw-evidence-v4.md
git commit -m "bench: v4 audit-derived measurements, all 20 rows (#98)"
```

---

### Task 11: Blind-score the 20 v4 rows

**Files:**
- Create: `benchmark/scoring-v4/` — one file per row, `row-<NN>-<harness>-seed-<NN>-run-<N>.md`

**Interfaces:**
- Consumes: Task 10's measurements, Tasks 5–9's report texts.
- Produces: four rubric columns + `passes_gate` + notes per row.

**Why subagents.** Between DECISION.md §J–§N and the design conversation, both operator and assistant have read the seeds' expected answers, §L4's prediction that seed 03 files at layer 1, and the exact citation a passing run produces. Neither can score blind. v3 used the same method, so v3↔v4 stays comparable.

- [ ] **Step 1: Assemble one scoring packet per row**

Each packet contains **only**:
- the rubric — `scorecard-template.md` §A (four columns, 6 points), §A2 (`passes_gate`), §A3 (void runs);
- that seed's spec file;
- that run's Fix Report text and transcript;
- Task 10's computed measurements for that run.

Each packet must **not** contain: `benchmark/DECISION.md`, any other row, any other seed's spec, this plan, or the design conversation.

- [ ] **Step 2: Dispatch 20 blind scorers in parallel**

One Agent-tool subagent per row, dispatched in a single message so they run concurrently. Prompt each with its packet and this instruction:

> Score this single diagnostic run against the rubric provided. Return the four rubric column values, the computed `passes_gate`, and notes justifying each column. The measurements provided were derived from the instance audit trail before you saw the report — treat them as fact. Receiving a section does not mean the diagnosis used it: judge use from the report. Do not speculate about runs you were not shown.

- [ ] **Step 3: Assert every scorer returned a well-formed result**

Expected: 20 results, each with four column values, `passes_gate` consistent with §A2's expression (`root_cause_layer_correct == 2 AND fix_usable_unedited == 1`), and the §A constraint that `fix_usable_unedited` may not be 1 while `fix_target_correct` is 0.

Re-dispatch any scorer whose result violates the rubric's own constraints. Do **not** repair a score by hand — the operator aggregates and does not re-score.

- [ ] **Step 4: Write the packets and results, then commit**

```bash
git add benchmark/scoring-v4/
git commit -m "bench: blind scoring of the 20 v4 rows (#98)"
```

---

### Task 12: Blind re-score the 10 standing native rows (§7.1)

**Files:**
- Create: `benchmark/scoring-v4/rescore-task12-<NN>.md` per recovered row

**Interfaces:**
- Consumes: `benchmark/scorecard-agent-doctor.md`'s standing conversation ids.
- Produces: a blind-scored baseline for the drift comparison, or a per-row record of why a row could not be recovered.

**Why.** Task 12's rows were **operator-scored**; v4's are subagent-scored. Comparing them directly mixes model drift with scorer drift — the defect this pass exists to avoid, inside the measurement it was designed to buy.

- [ ] **Step 1: Test recoverability before assuming it**

For each of the 10 standing conversation ids in `scorecard-agent-doctor.md`, attempt to retrieve the run's Fix Report text and transcript from its conversation records on gpinst01. The runs date from 2026-08-02.

Expected: unknown — this is a genuine probe, not a formality. Record per row: recovered / not recovered.

- [ ] **Step 2: Score the recovered rows blind**

Dispatch one subagent per recovered row, using **exactly** Task 11 Step 2's packet shape and prompt, so the two populations are comparable. Where Task 10-equivalent measurements are not recoverable for a standing row, supply the `layers_swept` value already recorded in `scorecard-agent-doctor.md` and label it as such in the packet.

- [ ] **Step 3: Record unrecovered rows with the confound named**

Any row whose artifacts could not be recovered keeps its operator score for the drift comparison, **with the scorer confound named on that row** — never silently mixed with the clean ones.

- [ ] **Step 4: Commit**

```bash
git add benchmark/scoring-v4/
git commit -m "bench: blind re-score of Task 12 standing native rows (#98)"
```

---

### Task 13: Fill both scorecards

**Files:**
- Modify: `benchmark/scorecard-custom-harness.md` (append v4 section)
- Modify: `benchmark/scorecard-agent-doctor.md` (append v4 section + re-score column)

**Interfaces:**
- Consumes: Tasks 11–12.
- Produces: the filled rows the verdict is computed from.

- [ ] **Step 1: Append custom's v4 section**

Ten rows in the existing column shape (`scorecard-agent-doctor.md`'s row table is the reference — `seed`, `run #`, `run_id`, the four rubric columns, `total /6`, `passes_gate`, `layers_swept`, `layers_available`, `cause_of_death`, the two budget columns, `tool_calls`, `assists_consumed`, `wall_clock`, `failure_behavior`, `notes`).

Existing v2/v3 sections are **preserved**, not overwritten.

- [ ] **Step 2: Append native's v4 section**

Same shape, ten rows. **The Task 12 standing rows are preserved verbatim** — they are the drift baseline.

- [ ] **Step 3: Add the re-score column**

Add Task 12's blind re-scores as a **separate labelled column** alongside the operator's original numbers, never overwriting them. A disagreement between operator and blind scorer on an unchanged artifact is itself data about the rubric and must stay visible.

- [ ] **Step 4: Assert the gate arithmetic**

Recompute `passes_gate` for all 20 rows from §A2's expression and confirm each matches what the scorer returned. Expected: exact agreement. A mismatch is a scoring error, not a rounding difference.

- [ ] **Step 5: Commit**

```bash
git add benchmark/scorecard-custom-harness.md benchmark/scorecard-agent-doctor.md
git commit -m "bench: v4 scorecards, both harnesses, with re-score column (#98)"
```

---

### Task 14: Amend the README protocol addendum

**Files:**
- Modify: `benchmark/README.md` (the "Phase 1b comparison re-run protocol" addendum)

**Interfaces:**
- Consumes: nothing.
- Produces: a protocol document that matches what was actually run.

- [ ] **Step 1: Replace the seed-2-only asymmetry**

The addendum currently specifies native = seed 2 only (2 fresh runs), 8 standing from Task 12. Replace with all-10-native, and state the two grounds verbatim from spec §3:

1. The addendum does not deliver §M7's same-day re-measurement — eight rows dated 2026-08-02 against ten custom rows dated today closes confound 3 for one seed of five.
2. Its stated reason for declining — that re-running an unchanged seed measures model drift — **is** §I4 confound 4, unmeasured across all three passes. The README predates drift being identified as a confound; what it calls a waste is the measurement now wanted.

- [ ] **Step 2: Record what the override costs**

Note that the drift measurement needs §7.1's blind re-score to be clean, and cross-reference the scorecard's re-score column.

- [ ] **Step 3: Commit**

```bash
git add benchmark/README.md
git commit -m "docs: README protocol addendum — native re-runs all 10 rows (#98)"
```

---

### Task 15: Write DECISION.md §O

**Files:**
- Modify: `benchmark/DECISION.md` (append §O)

**Interfaces:**
- Consumes: Tasks 10–13.
- Produces: the verdict.

- [ ] **Step 1: Write §O1 — what was run**

Version, date, both harnesses, 20 rows, interleaved by seed, what was held fixed and why (spec §2), and the fact that no product code moved.

- [ ] **Step 2: Write §O2 — the gate tally per harness**

`passes_gate` totals for custom and native. State them against §9's filed predictions — custom 0–2/10, native near 8/10 — and say plainly whether each held.

- [ ] **Step 3: Write §O3 — the drift measurement**

Native v4 against the Task 12 baseline, using §7.1's re-scored numbers where recovered and naming the confound where not. **This is the first drift measurement in the project.** If native deviates materially, say so directly: it retroactively qualifies every cross-day comparison in §G–§N.

- [ ] **Step 4: Write §O4 — the depth measurement**

Tool calls per run, per harness, from Task 10. Whether §H8's acceptance test — one run reaching `schema_lookup`, `query_table` or `genai_log` on the seed that needs it — is met. It has been unmet across 25 runs; state the new total either way.

- [ ] **Step 5: Write §O5 — confound 2 is closed, and by what**

Record that §M7's instruction to resolve §I4 confound 2 was already satisfied by #93, with the `schemaText()` evidence, and that `:67` stays parked for the reason in spec §2.2. This closes an open item in the record rather than leaving it to be re-discovered.

- [ ] **Step 6: Write §O6 — what this does not establish**

At minimum: model drift is now measured but only across two points; the stop rule is unchanged, so a low custom score is a confirmed prediction rather than new information about depth; §K5's propagation to native is still pending and deliberately so; and any seed recorded void.

- [ ] **Step 7: Commit**

```bash
git add benchmark/DECISION.md
git commit -m "docs: DECISION.md §O — the v4 scored pass verdict (#98)"
```

---

### Task 16: Version bump, changelog, and PR

**Files:**
- Modify: `package.json`, `README.md` (version badge), `CHANGELOG.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: the merged PR.

- [ ] **Step 1: Bump the version**

`package.json` `version` → `2026.08.0302`. Update the `README.md` version badge to match.

Today is 2026-08-03 and `2026.08.0301` was the day's first merge, so this is the second — `DD` = `03`, `XX` = `02`.

- [ ] **Step 2: Add the changelog entry**

Record: the v4 scored pass, both harnesses, 20 rows; the gate tallies; the first drift measurement; that no product code changed; and the README protocol amendment.

- [ ] **Step 3: Verify the diff is docs-only**

```bash
git diff main --stat
```

Expected: changes confined to `benchmark/`, `docs/superpowers/`, `package.json`, `README.md`, `CHANGELOG.md`. **Any file under `src/` in this diff is a plan violation** — the drift measurement depends on the deployed code being unchanged (Global Constraints).

- [ ] **Step 4: Run the test suite**

```bash
npm test
```

Expected: green. No product code changed, so a failure means something unintended moved — investigate before opening the PR rather than after.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin chore/benchmark-v4-scored-pass
gh pr create --title "v4 scored pass: 20 rows, both harnesses, same day (#98)" --body "..."
```

The PR body should state the gate tallies, the drift result, whether §H8's acceptance test moved, and link #98.

---

## Self-review

**Spec coverage.** §1 → Task 15 (§O). §2/§2.1 → Global Constraints + Task 16 Step 3. §2.2 → Task 15 Step 5. §3 → Tasks 5–9 + Task 14. §4 → Tasks 1–3. §5 → Tasks 4–9. §6 → Task 10. §7 → Task 11. §7.1 → Task 12. §8 → Tasks 13–16. §9 → Task 15 Step 2. §10 → scope ends at Task 16; no depth task exists, by design. §11 → Task 3 (provider check), Task 2 (void handling), Global Constraints (auth).

**Placeholder scan.** No TBD/TODO. Every query names its table, its encoded query, its fields, and its expected value. The one genuinely unknown value — seed 05's request body — has a dedicated task with three ordered recovery paths and an explicit instruction to record which one was used.

**Type consistency.** `layers_swept` is `n/7 (L…)` everywhere. `passes_gate` uses §A2's expression in Tasks 11, 13. Custom run identity is the `x_snc_troubleshoot_run` sys_id and native's is the conversation id, consistently, including the two-step hop in Task 10 Step 2. Tool→layer mapping appears once (Task 10 Step 3) and is referenced, not restated with variations.
