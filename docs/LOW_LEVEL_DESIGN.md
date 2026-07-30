# Foundry Troubleshooter — Low-Level Design (Phase 1a)

**Status:** Design only — no code built yet. Implementation will use the **ServiceNow SDK** (set up as the next step).
**Grounding:** Every table, field, and value in §2–§5 was verified live against **keynexus01** on 2026-07-18 unless marked ⚠ VERIFY.
**External validation:** §2.5 cross-checks the data model and method against ServiceNow's own Knowledge 2026 troubleshooting lab **CCL6230-K26 "Inside the Black Box: Troubleshooting and Debugging AI Agents at Scale"** ([lab guidebook](https://servicenow-events-or-lab-guidebo.gitbook.io/knowledge-2026/knowledge-2026/ccl6230-k26)) — incorporated 2026-07-29.
**Companions:** PRD v2.0 · `ARCHITECTURE_DECISIONS.md` (Decision 0.5: tools-first, benchmark-gated) · `IMPLEMENTATION_PLAN.md` (Phase 1a tasks)

---

## 1. Verified Target Environment

| Item | Value |
|------|-------|
| Instance | `keynexus01.service-now.com` |
| Version | **Zurich Patch 10 Hotfix 3** (glide-zurich-07-01-2025__patch10-hotfix3-07-01-2026) |
| Now Assist | ON (Now Assist Core) |
| AI Agents | ON (`sn_aia` scope, 59 tables, `sn_aia_agent` accessible) |
| Auth | `admin` via macOS Keychain (Foundry MCP `servicenow_connect`) |
| Existing inventory | 19 OOB AI Agents, 17 agentic workflows (all inactive), real execution history |
| Reference failures on instance | `sn_aia_execution_plan` rows with `state_reason` ∈ {`execution_failed`, `security_violation`, `no_activity`} — e.g. execution `78f347b72f198310f824ac1bcfa4e3bd` (SIGNAL IT Incident Triage, terminated) |

**Baseline vs. ServiceNow's own troubleshooting-lab prerequisites (K26 CCL6230, §2.5):** the lab requires Zurich Patch 8+, Now Assist AI Agents (Dec 2025 Zurich release), AI Search enabled, a Pro Plus/Enterprise license, the `sn_aia_admin` role for agentic administrators, and the **Now Assist Panel** enabled (which itself needs ≥1 Now Assist product plugin — ITSM/HRSD/CSM/SecOps — active) for testing agents in Studio. keynexus01 at Zurich Patch 10 exceeds the platform floor; panel + product-plugin state ⚠ VERIFY at build (§8.10). `sn_aia_admin` is also the role floor to keep in mind when diagnosing customer-side permission failures.

**Proof the diagnostic approach works (observed):** in failed execution `78f347b7…`, the root cause is sitting in `sn_aia_message` — an agent-role message containing a script error JSON: `{"fileName":"sn_aia_usecase.ec9f54a1….context_processing_script","lineNumber":61,…}`, followed by the user-facing "Sorry, there was a problem." A trace tool that parses this pattern diagnoses the failure immediately.

---

## 2. Verified AIA Data Model (the mapping owned by the trace/config tools)

### 2.1 Execution side (read by PaToolAgentTrace)

```
sn_aia_execution_plan ──┬─< sn_aia_execution_task   (parent ⇒ task tree, order ⇒ sequence)
  │                     ├─< sn_aia_tools_execution   (tool ⇒ sn_aia_agent_tool_m2m ⇒ sn_aia_tool)
  │                     └─< sn_aia_message           (message_sequence ⇒ stream order)
  ├── usecase  → sn_aia_usecase
  ├── agent    → sn_aia_agent        (often EMPTY on observed rows — resolve via usecase too)
  ├── conversation → sys_cs_conversation
  └── gen_ai_usage_log → sys_gen_ai_usage_log
```

**`sn_aia_execution_plan`** (37 fields; the run header):
- Diagnosis-critical: `state` (observed: `completed`, `terminated`), `state_reason` (observed: `no_activity`, `execution_failed`, `security_violation`), `status` (observed: `error`, empty), `objective`, `context`, `metadata`, `structured_output_request` / `structured_output`
- Wiring: `usecase`, `agent`, `team`, `worker`, `conversation`, `related_task_table` + `related_task_record`, `run_type` (observed: Testing), `execution_mode` (observed: Interactive), `execution_channel`
- Perf: `execution_time_ms/sec`, `system_execution_time_*`, `llm_p95_latency`, `tool_p95_latency`, `llm_token_avg`, `gen_ai_usage_log`

**`sn_aia_execution_task`** (the step tree):
- `execution_plan`, `parent` (self-ref — build the tree), `order` (observed: 50 = agent, 100 = orchestrator), `type` (verified choice values in data: `agent`, `tool`, `gen_ai`, `communicator`, `access_verification`), `status` (verified: `success`, `cancelled`, `ongoing`), `output` (string), `metadata`, `description`, `og_task_id`, `task_dependencies`, timings
- Observed failure signature: terminated run = agent task `success` → Orchestrator `cancelled` → child "AIA ReAct Engine" stuck `ongoing`

**`sn_aia_tools_execution`** (per tool call):
- `execution_plan_id`, `tool` → **`sn_aia_agent_tool_m2m`** (NOT directly to `sn_aia_tool` — dot-walk `tool.tool.name` for the tool, `tool.agent.name` for the agent), `request` (json), `response` (json), `error_message`, `execution_status`, `execution_mode`, `run_as_user`, `execution_time_ms`

**`sn_aia_message`** (the conversation stream):
- `execution_plan`, `message_sequence` (sortable counter), `role` (observed: `user_profile`, `user`, `agent`), `name` (speaker label — observed: "Manager", "Orchestrator", user's name), `message`, `user_message`, `error_type`, `type`
- **Error-mining heuristic (verified):** agent-role `message` values that parse as JSON with `fileName`/`sourceName`/`lineNumber` are server-script stack errors — extract as root-cause evidence

### 2.2 Configuration side (read by PaToolAgentConfig)

**`sn_aia_agent`** (extends `sys_metadata`): `name`, `internal_name`, `description`*, `role`, `instructions`, `proficiency`, `inputs`/`outputs` (translated_text), `strategy` → `sn_aia_strategy`, `channel` (`nap` | `nap_and_va`), `agent_type` (`internal` | `external`), `advanced_mode`, `context_processing_script`, `applicability_script`, `condition`, `compiled_handbook`

**`sn_aia_tool`** (extends `sys_metadata`): `name`*, `description`* (the LLM's tool-selection signal), `type` (observed in data: `script`; schema also supports flow/action/other — ⚠ VERIFY full choice list), `script`, `input_schema` (json) — **verified live format:**
```json
[{"name": "execution_asset", "description": "Execution Asset", "mandatory": false}]
```
`active`, `target_document_table`/`target_document`, `record_type`

**`sn_aia_agent_tool_m2m`** (the attachment — where runtime behavior lives): `agent`*, `tool`*, `name`*, `active`, **`execution_mode`** (⚠ VERIFY choices — expected supervised vs. auto; this is the confirmation-gate flag), `max_auto_executions`, `timeout`, `inputs` (json), `output_transformation_strategy`, `display_output`, `pre_message`/`post_message`, `post_processing_script`, `tool_attributes`

**`sn_aia_usecase`**: `name`*, `internal_name`, `description`*, `team` → `sn_aia_team`, `strategy`, `base_plan`, `execution_mode` ("tools override"), `context_processing_script` (⚠ observed live as an actual failure source), `applicability_script`, `condition`
— No `active` field. ⚠ VERIFY: activation is surfaced elsewhere (likely `sn_aia_trigger_configuration.active` and/or `sn_aia_usecase_config_override`); the MCP lists all 17 as "[Inactive]".

**`sn_aia_trigger_configuration`** (extends `sys_metadata`): `usecase`, `active`, `condition`*, `target_table`*, `objective_template`*, `channel`* → `sys_cs_channel`, `trigger_strategy`, `run_as`/`run_as_user`/`run_as_script`, `business_rule` → `sys_script`, `trigger_flow` → `sys_hub_flow`, schedule fields (`run_period`, `run_time`, …)

**`sn_aia_strategy`** (verified records): **ReAct `f0bff21f9f13c6108f431597d90a1c74`** (type `agent` — used by ~all OOB agents; use for Agent Doctor), Hierarchical ReAct `18a2de41ff632210309fffffffffff90`; orchestrator strategies: Base/Batch/ReActive/Unified/Swarm Planner.

Teams: `sn_aia_team` + `sn_aia_team_member`; agent↔usecase wiring: `sn_aia_trigger_agent_usecase_m2m`.

### 2.3 GenAI stack side (read by PaToolGenAiLog)

**`sys_gen_ai_usage_log`** (global scope; assist consumption): `assists`, `trial_assists`, `status`, `execution_type`, `strategy`*, `feature` → `sys_gen_ai_feature_mapping`, `skill_config_id` → `sn_nowassist_skill_config`, `user`, `caller_scope`/`source_scope`, `document_table`/`document`

**`sys_gen_ai_log_metadata`** (global; per-LLM-call detail — prompts/tokens/errors): `model_name`, `model_version`, `prompt_token_count`, `response_token_count`, `time_taken`, `started_at`/`completed_at`, `status`, `error`, `error_code`, `caller`, `definition`* → `sys_one_extend_capability_definition`, `skill_config_id`, `gen_ai_log_id` → `sys_generative_ai_log`, `conversation`, `output_metadata`, `metadata_documents` → `sys_gen_ai_metadata_document` (⚠ VERIFY: full prompt/response payload location — likely in metadata documents; table may be ACL-restricted to admin)

**Linkage from an execution to its LLM calls (two paths, both verified as tables):**
1. `sn_aia_execution_plan.gen_ai_usage_log` → usage row (aggregate assists)
2. `sn_aia_gen_ai_m2m` (`source_table` + `source_id` → `gen_ai_log_metadata`) — join key: source_id IN (plan sys_id, its task sys_ids)
3. `sn_aia_step_log_metadata` (`step_log` → `sys_cs_aia_step_log`, `log_metadata` document ref) — conversational step ↔ LLM log

### 2.4 Adjacent tables noted for Phase 2+ (not in Phase 1a scope)

`sn_aia_execution_metric`, `sn_aia_agent_execution_eval` (native LLM-as-judge evals), `sn_aia_execution_feedback`, `sn_aia_conversational_debugger_mapping`, `sn_aia_memory*`, `sn_aia_external_agent_*` (A2A).

### 2.5 Cross-check: ServiceNow's official troubleshooting methodology (K26 CCL6230)

ServiceNow's Knowledge 2026 lab **CCL6230-K26** ships a "Complete Troubleshooting Guidebook for AI Agents Execution Debugging" — a manual runbook that prescribes **exactly the investigation spine our tools automate**: start at `sn_aia_execution_plan`, walk `sn_aia_execution_task` chronologically to the first failed step, inspect `sn_aia_tools_execution` request/response payloads, follow `sys_gen_ai_log_metadata` → `sys_generative_ai_log` for LLM call detail, correlate `sn_aia_message` / `sys_cs_conversation` / `sys_cs_message` for conversation context, and finish with a *scoped* `sys_log` query. This is independent, official confirmation that the §2.1–§2.3 mapping is the right diagnostic surface — Agent Doctor is that runbook, automated.

**Details adopted from the guidebook that we did not already have:**

1. **`sys_cs_message`** (individual conversation messages — requestor / fulfiller / system) under `sys_cs_conversation` traces dialogue progression and shows where a caller disconnected or got an unexpected response. Added to the trace tool's message step (§4.1). `sys_cs_conversation` also confirms the **channel type (NAP vs. VA)** — a wiring-layer fact.
2. **`sys_generative_ai_log`** — reached via `sys_gen_ai_log_metadata.gen_ai_log_id` — holds the full prompt/response content. This sharpens open item 3: the payload path is metadata → `gen_ai_log_id` (verify ACLs, not location).
3. **Syslog scoping rule:** never open `sys_log` unfiltered (the lab warns it can slow or time out an instance). The sanctioned pattern (`syslog.filter`) is: Created **between** the execution window's timestamps · Level = Error/Warning · Source **contains** the scope or Script Include name · Message **contains** the execution plan sys_id or error keyword. Adopted as PaToolLogAnalysis's *mandatory* query shape (§4.4).
4. **Quick decision guide** (symptom → first table), which maps 1:1 onto our roster:

| Symptom (per the guidebook) | First table | Our tool |
|---|---|---|
| Agent never triggered | `sn_aia_execution_plan` (absence of a plan) | `agent_trace` (`agent`+`since` finds nothing → check triggers via `agent_config`) |
| Conversation stopped mid-execution | `sn_aia_execution_task` | `agent_trace` (task tree + failure signature) |
| Tool call failed / returned empty | `sn_aia_tools_execution` | `agent_trace` (tool-call step) |
| LLM response incorrect/missing | `sys_gen_ai_log_metadata` | `genai_log` |
| Unexpected user message | `sn_aia_message` / `sys_cs_*` | `agent_trace` (message stream) |
| Platform/script/ACL error | `sys_log` (scoped) | `log_analysis` |

**Official failure taxonomy** (the lab's "Error Symptoms and Common Causes"), mapped to our seven layers and the benchmark seeds (§7):

| # | Symptom | Common causes (per lab) | Our layer | Seed coverage |
|---|---------|------------------------|-----------|---------------|
| T1 | Cold start — agent failed to start | Missing platform config/dependencies; **ACL-trigger misalignment** (run-as role fails User/Data Access check); invalid or expired credentials | trigger/wiring | Seed 5 (inactive wiring) + candidate seed 6 (§7) |
| T2 | Inconsistent responses | Weak/ungrounded prompts; missing output format spec; ambiguous tool definitions | instructions, tool definitions | Seed 2; also why every seed gets 2 runs |
| T3 | Tool errors | Misconfigured tools (script runtime errors, malformed results); unclear guidance on tool selection/timing | tool definitions | Seed 1 |
| T4 | High latency | **Instruction bloat** (oversized prompts reprocessed every ReAct turn); **tool output bloat** (oversized outputs inflating the scratchpad); inefficient post-processing | instructions, tool definitions | candidate seed 7 (§7) |
| T5 | Hallucinated responses | Stale/irrelevant/empty retrieval results; unclear or contradictory instructions leaving gaps | data, instructions | Seed 3 (empty lookup table) |
| T6 | Infinite loops | No task-completion criteria; agent can't detect completion; conflicting agent-vs-workflow directives; **recursive triggers firing on the agent's own actions** | instructions, trigger/wiring | candidate seed 8 (§7) |

**ACL-trigger misalignment (the lab's Lab 1 — a named silent-failure pattern):** a trigger invokes the workflow under the *initiating user's* context; if that user's role fails the agent's or workflow's **User Access** (who can discover/execute) or **Data Access** (which roles execute runtime operations) configuration, the execution terminates with a **Security Violation** — with no surface-level config error anywhere. We have already observed the matching `state_reason=security_violation` on keynexus01 (§1). Both access lists must independently accommodate the invoking user's role. Detection is specified in §4.1 (signature) and §4.2 (role comparison).

**Latency triage heuristic (the lab's Lab 2):** in the decision logs, high-latency flags on **`Gen AI - AIA ReAct Engine` steps ⇒ instruction bloat** (prompt reprocessed every loop iteration — the lab's worked example: an ~11,000-word instruction with inline decision trees, 40+ hardcoded error-code mappings, and example conversations); high-latency flags on **`Tool` steps ⇒ tool output bloat** (raw retrieval chunks accumulating in the scratchpad, compounding every subsequent turn). Remediations the lab teaches — offload decision logic to Now Assist Skills, consolidate sequential searches into one parallel-executing Skill, return synthesized not raw output — become Fix Report `proposed` content for T4 diagnoses. Detection via our per-task timings + token counts is specified in §4.1.

**Tool-quality bar (the lab's Lab 3):** three sequential failure points per tool call — selection (description read), invocation (input construction), interpretation (output read) — with risk multiplying per additional tool. The lab's production framework: every tool description needs three sections — **Purpose** (when and when *not* to use), **Understanding Tool Inputs** (formats accepted, how unexpected formats are handled), **Understanding Tool Outputs & Error Handling** (what success/empty/error responses look like and what the agent should do). Smart-tool principles: validate/normalize inputs at platform level (never trust the LLM to pass the right format), return structured JSON with named fields (never raw GlideRecord dumps, never an empty `{}` on failure — always a structured error with `suggested_action`), cap result counts, and consolidate tools agents always call sequentially. This cuts both ways for us: (a) our seven Agent Doctor tool descriptions are written to this framework (§5), and (b) the anti-patterns become a checklist the config tool scores customer tools against (§4.2).

---

## 3. Scoped App & Custom Tables

**Scope:** placeholder `x_snc_pa` in prior docs — ⚠ the real scope prefix is assigned by the vendor prefix available at SDK app creation (e.g. `x_<vendor>_troubleshooter`). All names below use `x_pa_*` shorthand; finalize at SDK setup.

**Cross-scope access (design-critical):** our scoped app reads `sn_aia_*` (scope `sn_aia`) and `sys_gen_ai_*` (global). Scoped-app table access is governed by cross-scope privileges (`sys_scope_privilege`) and per-table "Accessible from" settings. Mitigations, in order: (1) declare read privileges for the specific tables at install; (2) every tool treats an empty/denied read as an explicit finding ("cannot read X — permission/scope gap"), never a silent empty; (3) `/status`-equivalent check verifies readability of all §2 tables at install. ⚠ VERIFY per-table during build.

### 3.1 `x_pa_run` (diagnostic run)

| Column | Type | Notes |
|--------|------|-------|
| number | auto-number | display value, prefix `TR` |
| user | reference → sys_user | requester |
| harness | choice: `native` \| `custom` | which harness drove this run |
| agent | reference → sn_aia_agent | agent under diagnosis (nullable) |
| execution_ref | string (sys_id) | sn_aia_execution_plan under diagnosis |
| mode | choice: `diagnose` \| `collect` | collect = Evidence Bundle |
| status | choice: `queued` \| `running` \| `awaiting_confirmation` \| `complete` \| `failed` | native runs go straight to `running` |
| transcript | string (JSON, large) | array of {seq, actor, tool, args_digest, result_digest, artifact_id?, ts} |
| context_summary | string | summarized older transcript |
| fix_report | string (JSON, large) | validated Fix Report |
| error | string | terminal error if failed |

Artifacts = **attachments on this record** (`GlideSysAttachment`), named `artifact-<seq>-<tool>.json`.

### 3.2 `x_pa_audit`

| Column | Type |
|--------|------|
| run | reference → x_pa_run |
| user | reference → sys_user |
| action_type | choice: `intent` \| `result` \| `error` |
| tool_name | string |
| input / output | string (JSON) |
| target_table / target_record | string |
| confirmed_by_user | boolean |

---

## 4. Component Specifications

All tool cores are Script Includes with one contract:
`execute(args: Object) → {success: true, data: Object} | {success: false, error: String}` — pure objects in/out, no strings, no harness knowledge. All reads `GlideRecordSecure`.

### 4.1 PaToolAgentTrace *(core tool — owns §2.1 mapping with 4.2)*

**Args:** `{execution?: sys_id, agent?: name|sys_id, since?: minutes, step?: task_sys_id, detail?: bool}`

**Resolution:** `execution` given → load plan directly. `agent`+`since` → resolve name against BOTH `sn_aia_agent.name` and `sn_aia_usecase.name` (observed: plan.agent is often empty; usecase is the reliable anchor), then query plans `usecase=X^ORagent=X`, `sys_created_on` desc, return pick-list if >1.

**Summary algorithm:**
1. Plan header: state, state_reason, status, objective, run_type, execution_mode, timings, token/latency metrics, conversation, usecase/agent names
2. Task tree: query `sn_aia_execution_task` by `execution_plan`, order by `order`; nest via `parent`; emit {order, type, status, description, time_ms, output_digest(200 chars)}
3. Tool calls: query `sn_aia_tools_execution` by `execution_plan_id`; emit {tool.tool.name, tool.agent.name, execution_status, error_message, time_ms, request_digest, response_digest}
4. Messages: query `sn_aia_message` by `execution_plan`, order by `message_sequence`; emit {seq, role, name, content_digest}. If `plan.conversation` is set, also emit conversation context per the K26 guidebook (§2.5): `sys_cs_conversation` channel type (NAP vs. VA) + `sys_cs_message` digests (requestor/fulfiller/system) to show dialogue progression and where the user disconnected or got an unexpected reply
5. **Error mining:** any agent-role message whose `message` parses as JSON with `fileName`/`lineNumber` → emit as `script_errors[]` {source, line, error_name} — first-class root-cause evidence
6. Failure signatures (attach to header as `failure_signature`):
   - state=terminated + a `cancelled` orchestrator task + `ongoing` leaf = "died mid-reasoning"
   - `state_reason=security_violation` = **ACL-trigger misalignment** (K26 Lab 1, §2.5): the trigger's run-as user failed the agent/workflow User Access or Data Access check. Emit the next-step pointer: pull `agent_config` triggers (run_as fields) + access roles and compare — the config looks correct at surface level; only the trace reveals it
   - `access_verification`-type task in non-success status = same family — cite it as the trace evidence
7. **Latency flags** (K26 Lab 2 heuristic, §2.5): using per-task timings + plan metrics (`llm_p95_latency`, `tool_p95_latency`, `llm_token_avg`), emit `latency_flags[]`: slow `gen_ai` tasks with high prompt token counts → `instruction_bloat` (instructions reprocessed every ReAct turn); slow `tool` tasks or oversized `response` payloads → `tool_output_bloat` (scratchpad inflation compounding each turn)

**Detail mode (`step`):** full `output` / `request` / `response` for one task or tool execution, routed through PaArtifactStore. **Prompt-level detail:** via `sn_aia_gen_ai_m2m` where `source_id` = step sys_id → `sys_gen_ai_log_metadata` (⚠ admin-only ACL likely — degrade to "prompt logs unavailable, insufficient privilege").

### 4.2 PaToolAgentConfig *(core tool)*

**Args:** `{agent: name|sys_id, section?: overview|instructions|tools|triggers}`

- Resolve against `sn_aia_agent` (name, internal_name, sys_id), fallback `sn_aia_usecase`
- **overview:** agent fields (description, role digest, strategy.name, channel, agent_type) + tool count + usecase/team wiring via `sn_aia_trigger_agent_usecase_m2m` + trigger active states
- **instructions:** full `instructions` + `role` + `proficiency` + usecase `base_plan`/`context_processing_script` SOURCE (verified failure vector — include the script body via artifact store)
- **tools:** for each `sn_aia_agent_tool_m2m` (by agent): m2m {name, active, execution_mode, max_auto_executions, timeout, output_transformation_strategy} + tool {name, type, description, input_schema (verbatim JSON), script body via artifact store, target_document_table}
  - **`tool_smells[]` (K26 Lab 3 anti-pattern checklist, §2.5)** — score each attached tool and emit findings: description missing any of the three sections (Purpose / input formats / output+error contract) or a single sentence; no negative guidance (when *not* to use); script accepts one input format with no validation/normalization or fallback; returns raw record dumps (dozens of fields) or unbounded result sets (no `setLimit`); failure path returns an empty object/string instead of a structured error with a suggested action; overlapping tools the agent must call sequentially (consolidation candidates — each extra tool multiplies selection/invocation/interpretation risk)
- **triggers:** `sn_aia_trigger_configuration` rows for linked usecases: {name, active, condition, target_table, objective_template, channel.name, trigger_strategy, run_as fields}
  - **Access alignment check (K26 Lab 1, §2.5):** emit the agent's and workflow's **User Access** and **Data Access** role sets (⚠ VERIFY storage — Studio's "Define User Access"/"Define Data Access" panels; expected on `sn_aia_agent`/`sn_aia_usecase` or a related role m2m) alongside the trigger's `run_as`/`run_as_user` roles, and flag any role the run-as user lacks — the automated form of the lab's manual security-violation diagnosis. Both lists must independently cover the invoking user's role.

### 4.3 PaToolGenAiLog

**Args:** `{mode: usage|llm|for_execution|check_config, minutes_ago?: 60, errors_only?: true, execution?: sys_id}`

- **usage:** `sys_gen_ai_usage_log` window → {created, status, execution_type, assists, feature.name, skill_config_id.name, caller_scope, user}
- **llm:** `sys_gen_ai_log_metadata` window → {started_at, model_name, model_version, status, error, error_code, prompt_token_count, response_token_count, time_taken, definition.name, caller}
- **for_execution:** plan.gen_ai_usage_log row + `sn_aia_gen_ai_m2m` rows where source_id IN (plan + task sys_ids) → their log_metadata summaries
- **check_config:** `sys_one_extend_capability_definition` rows + provider mapping presence (⚠ VERIFY exact provider-mapping table — `sys_one_extend*` family — during build)

### 4.4 PaToolSchemaLookup / PaToolQueryTable / PaToolLogAnalysis

As specified in `IMPLEMENTATION_PLAN.md` Task 8 — unchanged by instance research (`sys_dictionary`/`sys_choice`/`syslog` are standard). One addition to SchemaLookup: `sys_db_object` existence check first, so "table does not exist" is a distinct finding from "no fields readable" (cross-scope signal).

**PaToolLogAnalysis query shape is mandatory-scoped** (K26 guidebook rule, §2.5 — an unfiltered `sys_log` read can slow or time out an instance): every query MUST carry a bounded time window (default: the execution plan's start/end ± 2 min when called with an execution context; else `minutes_ago`), level ≤ Warning by default, and at least one of source-contains (scope / Script Include name) or message-contains (execution plan sys_id, error keyword). The tool refuses an unscoped query with a structured error suggesting the missing condition — mirroring the platform's own `syslog.filter` discipline.

### 4.5 PaArtifactStore

- `store(runId, toolName, content)`: `content.length > 4000` → `GlideSysAttachment().write(runGR, "artifact-<seq>-<tool>.json", "application/json", content)`, return `{artifact_id: attachment_sys_id, excerpt: head 1500 + "\n…[elided N chars]…\n" + tail 500, total_length}`; else pass through
- `read(artifactId, offset=0, length≤4000)`: `GlideSysAttachment().getContent()` sliced — exposed to the LLM as tool `read_artifact`
- ⚠ VERIFY: scoped-app attachment write API surface (`GlideSysAttachment` is scope-safe; confirm in SDK runtime)

### 4.6 PaRunAnchor + PaAuditLogger

- `PaRunAnchor.getOrCreate({harness, executionRef?, conversationId?})`: for native harness, key = the AIA conversation/execution driving the chat (available to script tools via ⚠ VERIFY — expected in tool script context or passed as tool input; fallback: one anchor per user per 30 min); creates `x_pa_run` with `harness=native`, `status=running`
- `PaAuditLogger.logIntent/logResult/logError(params)` → `x_pa_audit` insert; called by the adapter around every tool execution

### 4.7 PaScriptToolAdapter (native harness bridge)

```
invoke(toolClassName, inputString, ctx):
  args   = tolerantParse(inputString)   // JSON object | bare string → {value: s} | "" → {}
  run    = PaRunAnchor.getOrCreate({harness:"native", ...ctx})
  audit  = PaAuditLogger.logIntent(...)
  result = new <toolClassName>().execute(args)          // object contract
  result = PaArtifactStore.applyThreshold(run, result)  // big payloads → attachment + excerpt
  PaAuditLogger.logResult/logError(...)
  return JSON.stringify(result)          // ALWAYS a string, never throws
```

Seven thin `sn_aia_tool` (type `script`) bodies each call `invoke()` with their tool class. Input schemas use the **verified** format `[{"name","description","mandatory"}]` — one schema entry per logical arg, all strings, parsed by the adapter.

---

## 5. Agent Doctor — Native Agent Record Set (created via Foundry automation, NOT SDK)

| # | Record | Table | Key values |
|---|--------|-------|-----------|
| 1 | Agent Doctor | `sn_aia_agent` | `name`="Agent Doctor", `agent_type`=internal, `channel`=`nap_and_va`, **`strategy`=`f0bff21f9f13c6108f431597d90a1c74` (ReAct — verified default)**, `role`/`instructions` from `agent-doctor-instructions.md` (playbook: seven-layer sweep, evidence rule, Fix Report markdown template, read_artifact usage) |
| 2–8 | 7 tools | `sn_aia_tool` | `type`=script, descriptions written to the **K26 three-section framework** (§2.5): Purpose (incl. when NOT to use) · Understanding Tool Inputs (formats + how off-format input is handled) · Understanding Tool Outputs & Error Handling (success/empty/error shapes + what to do next); `input_schema` per §4.7; script = adapter call. The adapter already satisfies the smart-tool bar: tolerant input parsing, structured JSON out, never an empty `{}` on failure |
| 9–15 | 7 attachments | `sn_aia_agent_tool_m2m` | `active`=true, `execution_mode`=unsupervised/auto (⚠ VERIFY choice values — all tools read-only), `output_transformation_strategy`=None (raw JSON back to the reasoning loop), `display_output`=false |
| 16 | Team | `sn_aia_team` (+`sn_aia_team_member`) | "Troubleshooter" team wrapping Agent Doctor |
| 17 | Use case | `sn_aia_usecase` | "Diagnose AI Agent failure", `team`=16, orchestrator strategy default; **no custom `context_processing_script`** (verified failure vector — keep ours empty) |
| 18 | Trigger | `sn_aia_trigger_configuration` | `active`=true, channel=Now Assist panel, condition/objective_template minimal |
| 19 | Wiring | `sn_aia_trigger_agent_usecase_m2m` | trigger↔usecase↔agent |

Tool roster (names as the LLM sees them): `agent_trace`, `agent_config`, `genai_log`, `schema_lookup`, `query_table`, `log_analysis`, `read_artifact` — exactly 7, at the platform's 5–7 guidance ceiling; nothing else gets added.

---

## 6. Build Approach with the ServiceNow SDK

*(SDK setup is the next work item — this section defines what gets built with it; nothing here is built yet.)*

| Artifact | Built via | Rationale |
|----------|-----------|-----------|
| Scoped app, `x_pa_run`, `x_pa_audit` tables | **SDK** (Fluent table definitions) | Versioned DDL in git, repeatable install |
| Script Includes (§4: 6 tool cores + ArtifactStore + RunAnchor + AuditLogger + ScriptToolAdapter) | **SDK** (source-controlled server scripts) | The whole point — code in repo, deployed by CLI |
| Jest tests (adapter parse/stringify, truncation/paging, error-mining regex) | repo-local | pure-logic tests run without instance |
| Agent Doctor record set (§5, tables in `sn_aia` scope) | **Foundry automation** (existing use-case/record APIs) | `sn_aia_*` records are another scope's data, not our app's metadata — record-creation automation, idempotent, with delete/rollback |
| Benchmark seed agents (§7) | **Foundry automation** | same, plus deliberate breakage steps |

Repo layout impact: `src/instance/**` (SDK-managed app source) + `src/agent-doctor/**` (record-set definitions consumed by Foundry automation) + `benchmark/**`. Deploy target: keynexus01 via the SDK CLI using the existing admin credential.

Order of operations after SDK setup: install scoped app → run `/status`-equivalent readability check (§3 cross-scope) → create Agent Doctor records → smoke test → build seeds → benchmark.

---

## 7. Benchmark Implementation on keynexus01

Smoke test (before any seeds): point Agent Doctor at **existing** failed execution `78f347b72f198310f824ac1bcfa4e3bd` — expected diagnosis: script failure in the SIGNAL use case's `context_processing_script` (line 61), evidenced by the agent-role error message + terminated/`execution_failed` plan state. We know the right answer; the smoke test checks the tools surface it.

Seed construction (each = one broken agent + one captured failing execution sys_id):

| Seed | Construction on instance |
|------|--------------------------|
| 1 — tool schema mismatch | Script tool with `input_schema` declaring `priority` free-string; script writes to `incident.priority` (integer choice 1–5); agent instructed to set priority from words. Trigger via chat; verbose multi-step instructions to force a LARGE trace (artifact-paging stressor) |
| 2 — ambiguous instruction | Instructions say "assign to the right group", no lookup guidance, no group tool |
| 3 — missing data | Instructions reference lookup table `x_pa_bench_routing` (created empty) |
| 4 — GenAI stack | ⚠ VERIFY safest construction: prefer a bogus `skill_config_id`/capability reference over breaking instance-wide provider config (shared instance — do NOT unmap real capabilities) |
| 5 — inactive wiring | Use case + trigger created with `sn_aia_trigger_configuration.active`=false |

Scoring per `IMPLEMENTATION_PLAN.md` Task 11–12: 2 runs/seed, blind, 6-point rubric, gate thresholds from ADR Decision 0.5.

**Candidate seeds 6–8 (from the K26 failure taxonomy, §2.5 — stretch set, not gate-scored; build after the 5-seed gate or swap in if a core seed proves unbuildable):**

| Seed | Taxonomy | Construction on instance |
|------|----------|--------------------------|
| 6 — ACL-trigger misalignment | T1 cold start | Trigger `active`=true but agent/workflow User Access + Data Access restricted to a role the run-as user lacks (e.g. `itil` user vs. admin-only access) → expect `state_reason=security_violation`, no surface config error. Reproduces K26 Lab 1 exactly; we already have a matching real failure on keynexus01 (§1) |
| 7 — instruction bloat latency | T4 high latency | Agent with deliberately oversized instructions (inline decision trees, hardcoded error-code maps, example conversations) + a search tool returning raw unfiltered chunks → expect `latency_flags[]` diagnosis: instruction_bloat + tool_output_bloat, fix = offload logic to a Skill / synthesize tool output |
| 8 — infinite loop | T6 loops | Agent with no completion criteria and directives conflicting with its workflow, or a trigger whose condition matches records the agent itself updates (recursive firing) → expect wiring/instruction diagnosis; guarded by `sn_aia.continuous_tool_execution_limit` and the 5-runs-per-15-min recursion limit so the shared instance is safe |

---

## 8. Open Items (⚠ VERIFY during build — all flagged inline above)

1. `sn_aia_agent_tool_m2m.execution_mode` choice values (supervised flag) and `sn_aia_tool.type` full choice list — **CLOSED (Phase 0):** `execution_mode` has exactly 2 active choices, stored values `autopilot` (label "Autonomous") and `copilot` (label "Supervised"); `sn_aia_tool.type` has 14 active choices, the script one being stored value `script` (label "Script"). Both `execution_mode` values are in live production use on script-type attachments (361 `autopilot` / 23 `copilot` of 384). Unsupervised script-tool execution is available.
2. Use-case activation mechanism (no `active` on `sn_aia_usecase` — trigger `active` and/or `sn_aia_usecase_config_override`) — **not in Phase 0 scope**
3. `sys_gen_ai_log_metadata` ACLs for non-admin callers; prompt/response payload location (`sys_gen_ai_metadata_document`) — **CLOSED (Phase 0):** payload is **not** in either named table; it lives in `sys_generative_ai_log.prompt` / `.response`. Read roles — `sys_gen_ai_log_metadata`: `sn_aia.viewer`, `sn_aia.admin`, `sn_nowassist_admin.nsa_admin`, `maint`, `admin`; `sys_gen_ai_metadata_document`: `platform_ml_read`, `maint`; `sys_generative_ai_log`: `sn_na_analytics.ai_engmt_viewer`, `maint`, `admin`. A customer's `sn_aia.admin`-only caller can read metadata but **not** prompt/response text. (Role name on-instance is `sn_aia.admin`, dot-separated — see §1.)
4. Cross-scope read privileges required per §2 table from our app scope (`sys_scope_privilege` entries) — **CARRIED FORWARD:** static half closed (none of the 11 §2 tables present is `access=none` — not a valid value on this version — and none carries a restrictive `caller_access`; **47** standing `sys_scope_privilege` Read grants exist among **79** privilege rows total (the rest being 17 Write, 14 Create, 1 Delete), covering 8 distinct Read targets, all from first-party scopes, no custom `x_*` precedent). Runtime half **untested**: the P4b background-script proxy could not be executed — no background-script executor exists in the Foundry MCP toolset — and the probe tool landed in `Global` scope, so its successful reads do not simulate a restricted `x_pa_*` scope. Separately: `syslog` (the real name of §2's `sys_log`) carries `caller_access = Caller Restriction`, a live constraint on `PaToolLogAnalysis` to resolve at build time.
5. Native tool-script execution context: what conversation/execution identifiers are available to a script tool at runtime (anchors PaRunAnchor keying) — **CLOSED (Phase 0):** a script tool receives an undocumented global `_agentic_context_`, a **JSON string** (must be `JSON.parse`d) carrying `agent_id`, `conversation_id`, `usecase_id`, `execution_plan_id`. `PaRunAnchor` keys on `_agentic_context_.conversation_id`; stable across all 19 calls of a conversation and matches `sn_aia_execution_plan.conversation`. The bare names `conversation_id`/`execution_plan_id`/`agent_id` are `undefined`; `gs.getSessionID()` returns the literal `"SYSTEM"`. Provisional in two respects: obtained via the API path, not the Now Assist panel (no product plugin active), and `_agentic_context_` is undocumented.
6. Capability→provider mapping table for `check_config` (`sys_one_extend*` family) — **CLOSED (Phase 0):** `sys_one_extend_capability_definition` (17 fields). Read `capability`, `name`, `api_type`, `api`, `connection` (the bound provider credential alias — Bedrock / Vertex / Azure OpenAI / Now LLM). Confirmed live, not merely structural, by sampling 10 rows.
7. Final app scope prefix (assigned at SDK app creation) — **not in Phase 0 scope**
8. Seed 4 construction that cannot degrade the shared instance's GenAI config — **not in Phase 0 scope**
9. Storage location of AI Agent Studio's "Define User Access" / "Define Data Access" role sets (needed for §4.2 access alignment check — expected on `sn_aia_agent`/`sn_aia_usecase` fields or a related role m2m) — **CLOSED (Phase 0):** `sys_agent_access_role_configuration` (Global scope), keyed polymorphically by `agent` (document_id) + `agent_table` (table_name). Not a field on `sn_aia_agent`/`sn_aia_usecase` and not an `sn_aia_`-prefixed m2m. Per-role breakout in `sys_agent_access_role_mapping`; parallel permission-set path via `sys_agent_access_permission_set_configuration`. 159 config rows for `sn_aia_agent`/`sn_aia_usecase`. No structural field distinguishes "User Access" from "Data Access" — the distinction is conventional, carried in free-text `description`.
10. Now Assist Panel enabled on keynexus01 (Now Assist Admin → Experiences → Now Assist panel) — per K26 dependencies it requires ≥1 Now Assist product plugin active and is a prerequisite for testing agents in AI Agent Studio; needed before the §7 smoke test — **CARRIED FORWARD:** `panel_available: false`. No Now Assist **product** plugin (ITSM/HRSD/CSM/SecOps) exists or is active on keynexus01 — only `Now Assist Core`, `now-assist-self-service` and the Skill Step Plugin. No `sys_properties` entry independently disables the panel; the plugin gap alone fails the precondition. This is an instance-provisioning task, not a design change, and it blocks the §7 smoke test and the K26 lab prerequisites. Must be closed before the benchmark.
