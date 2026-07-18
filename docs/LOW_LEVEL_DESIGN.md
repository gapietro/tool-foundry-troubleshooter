# Foundry Troubleshooter — Low-Level Design (Phase 1a)

**Status:** Design only — no code built yet. Implementation will use the **ServiceNow SDK** (set up as the next step).
**Grounding:** Every table, field, and value in §2–§5 was verified live against **keynexus01** on 2026-07-18 unless marked ⚠ VERIFY.
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
4. Messages: query `sn_aia_message` by `execution_plan`, order by `message_sequence`; emit {seq, role, name, content_digest}
5. **Error mining:** any agent-role message whose `message` parses as JSON with `fileName`/`lineNumber` → emit as `script_errors[]` {source, line, error_name} — first-class root-cause evidence
6. Failure signature: state=terminated + a `cancelled` orchestrator task + `ongoing` leaf = "died mid-reasoning"; attach to header as `failure_signature`

**Detail mode (`step`):** full `output` / `request` / `response` for one task or tool execution, routed through PaArtifactStore. **Prompt-level detail:** via `sn_aia_gen_ai_m2m` where `source_id` = step sys_id → `sys_gen_ai_log_metadata` (⚠ admin-only ACL likely — degrade to "prompt logs unavailable, insufficient privilege").

### 4.2 PaToolAgentConfig *(core tool)*

**Args:** `{agent: name|sys_id, section?: overview|instructions|tools|triggers}`

- Resolve against `sn_aia_agent` (name, internal_name, sys_id), fallback `sn_aia_usecase`
- **overview:** agent fields (description, role digest, strategy.name, channel, agent_type) + tool count + usecase/team wiring via `sn_aia_trigger_agent_usecase_m2m` + trigger active states
- **instructions:** full `instructions` + `role` + `proficiency` + usecase `base_plan`/`context_processing_script` SOURCE (verified failure vector — include the script body via artifact store)
- **tools:** for each `sn_aia_agent_tool_m2m` (by agent): m2m {name, active, execution_mode, max_auto_executions, timeout, output_transformation_strategy} + tool {name, type, description, input_schema (verbatim JSON), script body via artifact store, target_document_table}
- **triggers:** `sn_aia_trigger_configuration` rows for linked usecases: {name, active, condition, target_table, objective_template, channel.name, trigger_strategy, run_as fields}

### 4.3 PaToolGenAiLog

**Args:** `{mode: usage|llm|for_execution|check_config, minutes_ago?: 60, errors_only?: true, execution?: sys_id}`

- **usage:** `sys_gen_ai_usage_log` window → {created, status, execution_type, assists, feature.name, skill_config_id.name, caller_scope, user}
- **llm:** `sys_gen_ai_log_metadata` window → {started_at, model_name, model_version, status, error, error_code, prompt_token_count, response_token_count, time_taken, definition.name, caller}
- **for_execution:** plan.gen_ai_usage_log row + `sn_aia_gen_ai_m2m` rows where source_id IN (plan + task sys_ids) → their log_metadata summaries
- **check_config:** `sys_one_extend_capability_definition` rows + provider mapping presence (⚠ VERIFY exact provider-mapping table — `sys_one_extend*` family — during build)

### 4.4 PaToolSchemaLookup / PaToolQueryTable / PaToolLogAnalysis

As specified in `IMPLEMENTATION_PLAN.md` Task 8 — unchanged by instance research (`sys_dictionary`/`sys_choice`/`syslog` are standard). One addition to SchemaLookup: `sys_db_object` existence check first, so "table does not exist" is a distinct finding from "no fields readable" (cross-scope signal).

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
| 2–8 | 7 tools | `sn_aia_tool` | `type`=script, descriptions written for tool-selection quality; `input_schema` per §4.7; script = adapter call |
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

---

## 8. Open Items (⚠ VERIFY during build — all flagged inline above)

1. `sn_aia_agent_tool_m2m.execution_mode` choice values (supervised flag) and `sn_aia_tool.type` full choice list
2. Use-case activation mechanism (no `active` on `sn_aia_usecase` — trigger `active` and/or `sn_aia_usecase_config_override`)
3. `sys_gen_ai_log_metadata` ACLs for non-admin callers; prompt/response payload location (`sys_gen_ai_metadata_document`)
4. Cross-scope read privileges required per §2 table from our app scope (`sys_scope_privilege` entries)
5. Native tool-script execution context: what conversation/execution identifiers are available to a script tool at runtime (anchors PaRunAnchor keying)
6. Capability→provider mapping table for `check_config` (`sys_one_extend*` family)
7. Final app scope prefix (assigned at SDK app creation)
8. Seed 4 construction that cannot degrade the shared instance's GenAI config
