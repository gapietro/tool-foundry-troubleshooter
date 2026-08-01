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

**Baseline vs. ServiceNow's own troubleshooting-lab prerequisites (K26 CCL6230, §2.5):** the lab requires Zurich Patch 8+, Now Assist AI Agents (Dec 2025 Zurich release), AI Search enabled, a Pro Plus/Enterprise license, the `sn_aia.admin` role for agentic administrators, and the **Now Assist Panel** enabled (which itself needs ≥1 Now Assist product plugin — ITSM/HRSD/CSM/SecOps — active) for testing agents in Studio. keynexus01 at Zurich Patch 10 exceeds the platform floor; panel + product-plugin state ⚠ VERIFY at build (§8.10). `sn_aia.admin` is also the role floor to keep in mind when diagnosing customer-side permission failures. (Phase 0 verified the role name is dot-separated `sn_aia.admin`, not `sn_aia_admin` as this document previously stated — see DESIGN.md R-6.)

**Proof the diagnostic approach works (observed):** in failed execution `78f347b7…`, the root cause is sitting in `sn_aia_message` — an agent-role message containing a script error JSON: `{"fileName":"sn_aia_usecase.ec9f54a1….context_processing_script","lineNumber":61,…}`, followed by the user-facing "Sorry, there was a problem." A trace tool that parses this pattern diagnoses the failure immediately.

---

## 2. Verified AIA Data Model (the mapping owned by the trace/config tools)

### 2.1 Execution side (read by PaToolAgentTrace)

```
sn_aia_execution_plan ──┬─< sn_aia_execution_task   (parent ⇒ task tree, order ⇒ sequence)
  │                     ├─< sn_aia_tools_execution   (tool ⇒ sn_aia_agent_tool_m2m ⇒ sn_aia_tool)
  │                     └─< sn_aia_message           (sys_created_on ⇒ stream order;
  │                                                    message_sequence is EMPTY on many
  │                                                    rows — see R-15 item 6)
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
- `execution_plan_id`, `tool` → **`sn_aia_agent_tool_m2m`** (NOT directly to `sn_aia_tool`) — ⚠ **but `tool` is EMPTY on every real row, so the `tool.tool.name` / `tool.agent.name` dot-walk this bullet used to prescribe returns nothing; resolve the binding as described in the note below**, then read the m2m's display values for the tool and agent names. Also: `request` (json), `response` (json), `error_message`, `execution_status`, `execution_mode`, `run_as_user`, `execution_time_ms`
- ⚠ **Corrected 2026-07-30 (DESIGN.md R-15) against real rows on gpinst01:** the join field is **`execution_plan_id`** and there is **no `execution_plan` field** — confirmed by exclusion, closing the E3 check R-1 left open. And **`tool` is EMPTY on every real row**: the binding sys_id is carried inside the `request` JSON as **`toolM2mId`**. A reader that trusts `tool` reports a null tool name for every call, which reads as "no tools were called" rather than "wrong field". Read `tool` first, then fall back to `request.toolM2mId`.

**Reference fields carry the literal string `"undefined"`** (DESIGN.md R-15 item 4) — observed in `sn_aia_execution_plan.agent` on every `security_violation` plan, and in `related_task_table`. It is truthy, so a plain emptiness check treats it as a real sys_id. Normalise `''`/`null`/`'undefined'`/`'null'` to empty before using any reference.

**`sys_cs_*` field names** (DESIGN.md R-15 items 5–6; these were only ever named by the K26 guidebook, never verified until now): `sys_cs_conversation` has **no `channel` field** — the NAP-vs-VA signal is spread across `conversation_type`, `device_type` and `provenance` — and no `name` (it is `title`). On `sys_cs_message` the text is **`payload`** (not `text`), the type is **`message_type`** (not `type`), and the sort key is **`sequence`**. Also: `sn_aia_message.message_sequence` is **empty** on tool-result rows — see the `sn_aia_message` entry below; it cannot lead the sort.

**`sn_aia_message`** (the conversation stream):
- `execution_plan`, `message_sequence` (counter — ⚠ **EMPTY on tool-result rows, and NOT usable as the primary sort key**: empty sorts first, which puts tool results ahead of the user's opening message. Order by `sys_created_on`, then `message_sequence`, then `sys_id`. DESIGN.md R-15 item 6), `role` (observed: `user_profile`, `user`, `agent`), `name` (speaker label — observed: "Manager", "Orchestrator", user's name), `message`, `user_message`, `error_type`, `type`
- **Error-mining heuristic (verified):** agent-role `message` values that parse as JSON with `fileName`/`sourceName`/`lineNumber` are server-script stack errors — extract as root-cause evidence

### 2.2 Configuration side (read by PaToolAgentConfig)

**`sn_aia_agent`** (extends `sys_metadata`): `name`, `internal_name`, `description`*, `role`, `instructions`, `proficiency`, `inputs`/`outputs` (translated_text), `strategy` → `sn_aia_strategy`, `channel` (`nap` | `nap_and_va`), `agent_type` (`internal` | `external`), `advanced_mode`, `context_processing_script`, `applicability_script`, `condition`, `compiled_handbook`

**`sn_aia_tool`** (extends `sys_metadata`): `name`*, `description`* (the LLM's tool-selection signal), `type` (⚠ **CLOSED** — §8 item 1: 14 active choices; the script one is stored value `script`, label "Script"), `script`, `input_schema` (json) — **verified live format:**
```json
[{"name": "execution_asset", "description": "Execution Asset", "mandatory": false}]
```
`active`, `target_document_table`/`target_document`, `record_type`

**`sn_aia_agent_tool_m2m`** (the attachment — where runtime behavior lives): `agent`*, `tool`*, `name`*, `active`, **`execution_mode`** (⚠ **CLOSED** — §8 item 1: exactly 2 active choices, stored `autopilot` = label "Autonomous" and `copilot` = label "Supervised". This is the confirmation-gate flag; unsupervised script-tool execution is available), `max_auto_executions`, `timeout`, `inputs` (json), `output_transformation_strategy`, `display_output`, `pre_message`/`post_message`, `post_processing_script`, `tool_attributes`

**`sn_aia_usecase`**: `name`*, `internal_name`, `description`*, `team` → `sn_aia_team`, `strategy`, `base_plan`, `execution_mode` ("tools override"), `context_processing_script` (⚠ observed live as an actual failure source), `applicability_script`, `condition`
— No `active` field. ⚠ **ANSWERED 2026-07-30 (R-18)**: activation is carried on the trigger side — `sn_aia_trigger_configuration.active` **and** `sn_aia_trigger_agent_usecase_m2m.active` (live rows on gpinst01 show both `true` and `false`). A use case is "inactive" when its trigger wiring is inactive, which is why the MCP lists them that way.

**`sn_aia_trigger_configuration`** (extends `sys_metadata`): `usecase`, `active`, `condition`*, `target_table`*, `objective_template`*, `channel`* → `sys_cs_channel`, `trigger_strategy`, `run_as`/`run_as_user`/`run_as_script`, `business_rule` → `sys_script`, `trigger_flow` → `sys_hub_flow`, schedule fields (`run_period`, `run_time`, …)

**`sn_aia_strategy`** (verified records): **ReAct `f0bff21f9f13c6108f431597d90a1c74`** (type `agent` — used by ~all OOB agents; use for Agent Doctor), Hierarchical ReAct `18a2de41ff632210309fffffffffff90`; orchestrator strategies: Base/Batch/ReActive/Unified/Swarm Planner.

Teams: `sn_aia_team` + `sn_aia_team_member`.

**`sys_agent_access_role_configuration`** + **`sys_agent_access_role_mapping`** (both **Global** scope, not `sn_aia_`) — the storage behind AI Agent Studio's "Define User Access" / "Define Data Access" panels, and an input to §4.2's access-alignment check. Added 2026-07-30 (R-18b): §8 item 9 closed this and §4.2 was updated, but §2.2 never listed the tables, so the data model omitted a source its own consumer reads. `sys_agent_access_role_configuration` is keyed **polymorphically** by `agent` (document_id) + `agent_table` (table_name) — same shape as the trigger m2m below — with the per-role breakout in `sys_agent_access_role_mapping` and a parallel path via `sys_agent_access_permission_set_configuration`. ⚠ **No structural field distinguishes User Access from Data Access**; the split is conventional, carried in free-text `description` (see §4.2 for what the tool may therefore claim).

**`sn_aia_trigger_agent_usecase_m2m`** — ⚠ **the name is misleading; corrected 2026-07-30 against live rows (R-18).** It is **not** an agent↔usecase m2m and has **no `agent` and no `usecase` column**. Its real shape is a trigger-to-resource link, **polymorphic** in the same style as `sys_agent_access_role_configuration`: `trigger_configuration` → `sn_aia_trigger_configuration`, plus `related_resource_table` (table_name) + `related_resource_record` (document_id), plus `active`, `objective_template`, `sys_overrides`, `sys_domain`. On gpinst01 `related_resource_table` holds **either** `sn_aia_usecase` **or** `sn_aia_agent`. Code that looks for `agent`/`usecase` columns gets blanks, not an error (R-6) — filter on `related_resource_table` and read `related_resource_record`.

### 2.3 GenAI stack side (read by PaToolGenAiLog)

**`sys_gen_ai_usage_log`** (global scope; assist consumption): `assists`, `trial_assists`, `status`, `execution_type`, `strategy`*, `feature` → `sys_gen_ai_feature_mapping`, `skill_config_id` → `sn_nowassist_skill_config`, `user`, `caller_scope`/`source_scope`, `document_table`/`document`

**`sys_gen_ai_log_metadata`** (global; per-LLM-call detail — prompts/tokens/errors): `model_name`, `model_version`, `prompt_token_count`, `response_token_count`, `time_taken`, `started_at`/`completed_at`, `status`, `error`, `error_code`, `caller`, `definition`* → `sys_one_extend_capability_definition`, `skill_config_id`, `gen_ai_log_id` → `sys_generative_ai_log`, `conversation`, `output_metadata`, `metadata_documents` → `sys_gen_ai_metadata_document` (⚠ **CLOSED — the guess was wrong.** Per §8 item 3 and **R-10**, the prompt/response payload is **not** in the metadata documents: it lives in **`sys_generative_ai_log.prompt` / `.response`**, reached via `gen_ai_log_id`. `sys_gen_ai_log_metadata` carries **no** `prompt` or `response` column — verified against `sys_dictionary` 2026-07-30.)

**`sys_generative_ai_log`** (global; the payload table) — verified 2026-07-30: it duplicates almost the whole metadata field set (`model_name`, `model_version`, `prompt_token_count`, `response_token_count`, `time_taken`, `started_at`/`completed_at`, `status`, `error`, `error_code`, `caller`, `definition`, `skill_config_id`, `conversation`, `output_metadata`, `metadata_documents`) **and adds `prompt` + `response`**. So the two-table hop is needed only for the payload — and only that hop is role-gated (R-10: read is `sn_na_analytics.ai_engmt_viewer` / `maint` / `admin`; a customer's `sn_aia.admin` cannot read it).

**Linkage from an execution to its LLM calls (two paths, both verified as tables):**
1. `sn_aia_execution_plan.gen_ai_usage_log` → usage row (aggregate assists)
2. `sn_aia_gen_ai_m2m` (`source_table` + `source_id` → `gen_ai_log_metadata`) — join key: source_id IN (plan sys_id, its task sys_ids)
3. `sn_aia_step_log_metadata` (`step_log` → `sys_cs_aia_step_log`, `log_metadata` document ref) — conversational step ↔ LLM log

### 2.4 Adjacent tables noted for Phase 2+ (not in Phase 1a scope)

`sn_aia_execution_metric`, `sn_aia_agent_execution_eval` (native LLM-as-judge evals), `sn_aia_execution_feedback`, `sn_aia_conversational_debugger_mapping`, `sn_aia_memory*`, `sn_aia_external_agent_*` (A2A).

### 2.5 Cross-check: ServiceNow's official troubleshooting methodology (K26 CCL6230)

ServiceNow's Knowledge 2026 lab **CCL6230-K26** ships a "Complete Troubleshooting Guidebook for AI Agents Execution Debugging" — a manual runbook that prescribes **exactly the investigation spine our tools automate**: start at `sn_aia_execution_plan`, walk `sn_aia_execution_task` chronologically to the first failed step, inspect `sn_aia_tools_execution` request/response payloads, follow `sys_gen_ai_log_metadata` → `sys_generative_ai_log` for LLM call detail, correlate `sn_aia_message` / `sys_cs_conversation` / `sys_cs_message` for conversation context, and finish with a *scoped* `syslog` query. This is independent, official confirmation that the §2.1–§2.3 mapping is the right diagnostic surface — Agent Doctor is that runbook, automated.

**Details adopted from the guidebook that we did not already have:**

1. **`sys_cs_message`** (individual conversation messages — requestor / fulfiller / system) under `sys_cs_conversation` traces dialogue progression and shows where a caller disconnected or got an unexpected response. Added to the trace tool's message step (§4.1). `sys_cs_conversation` also confirms the **channel type (NAP vs. VA)** — a wiring-layer fact.
2. **`sys_generative_ai_log`** — reached via `sys_gen_ai_log_metadata.gen_ai_log_id` — holds the full prompt/response content. This sharpens open item 3: the payload path is metadata → `gen_ai_log_id` (verify ACLs, not location).
3. **Syslog scoping rule:** never open `syslog` unfiltered (the lab warns it can slow or time out an instance). The sanctioned pattern (`syslog.filter`) is: Created **between** the execution window's timestamps · Level = Error/Warning · Source **contains** the scope or Script Include name · Message **contains** the execution plan sys_id or error keyword. Adopted as PaToolLogAnalysis's *mandatory* query shape (§4.4).
4. **Quick decision guide** (symptom → first table), which maps 1:1 onto our roster:

| Symptom (per the guidebook) | First table | Our tool |
|---|---|---|
| Agent never triggered | `sn_aia_execution_plan` (absence of a plan) | `agent_trace` (`agent`+`since` finds nothing → check triggers via `agent_config`) |
| Conversation stopped mid-execution | `sn_aia_execution_task` | `agent_trace` (task tree + failure signature) |
| Tool call failed / returned empty | `sn_aia_tools_execution` | `agent_trace` (tool-call step) |
| LLM response incorrect/missing | `sys_gen_ai_log_metadata` | `genai_log` |
| Unexpected user message | `sn_aia_message` / `sys_cs_*` | `agent_trace` (message stream) |
| Platform/script/ACL error | `syslog` (scoped) | `log_analysis` |

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

**Scope: FINALIZED 2026-07-30 — `x_snc_troubleshoot`** (scopeId `13043037d3da4293904504ef30589334`), assigned at SDK app creation (commit cc871d2). This supersedes the `x_snc_pa` / `x_pa_*` placeholders used throughout the earlier design docs; see DESIGN.md **R-13**.

Table names below are the real, buildable ones. **The placeholder names were not merely provisional — they were unbuildable:** a ServiceNow scoped table name must begin with its application's exact scope value. Verified on gpinst01 (2026-07-30): of 40 `x_snc_*` tables sampled from `sys_db_object`, **40 of 40** are named `<sys_scope.scope>_<name>`, with no exceptions. So `x_pa_run` cannot be created from `x_snc_troubleshoot` at all — it is not a shorthand that expands, it is a name the platform rejects.

Other design docs (`PRD_ServiceNow_Platform_Assistant.md`, `ARCHITECTURE_DECISIONS.md`, `AGENT_DOCTOR_ARCHITECTURE.md`) still carry `x_snc_pa_*` / `x_pa_*` in prose. Those are historical design text; **this section is the authority for table names.** Read any `x_pa_*` elsewhere as a pointer here.

**Cross-scope access (design-critical):** our scoped app reads `sn_aia_*` (scope `sn_aia`) and `sys_gen_ai_*` (global). Scoped-app table access is governed by cross-scope privileges (`sys_scope_privilege`) and per-table "Accessible from" settings. Mitigations, in order: (1) declare read privileges for the specific tables at install; (2) every tool treats an empty/denied read as an explicit finding ("cannot read X — permission/scope gap"), never a silent empty; (3) `/status`-equivalent check verifies readability of all §2 tables at install. ⚠ VERIFY per-table during build.

### 3.1 `x_snc_troubleshoot_run` (diagnostic run)

| Column | Type | Notes |
|--------|------|-------|
| number | auto-number | display value, prefix `TR` |
| user | reference → sys_user | requester |
| harness | choice: `native` \| `custom` | which harness drove this run |
| agent | reference → sn_aia_agent | agent under diagnosis (nullable) |
| execution_ref | string (sys_id) | sn_aia_execution_plan under diagnosis |
| conversation_ref | string (sys_id) | ⚠ **ADDED at Task 5 (issue #20), not in the original §3.1.** The anchor key. §4.6 keys `PaRunAnchor` on `_agentic_context_.conversation_id` and this list had nowhere to store it, so `getOrCreate` could only ever **create, never get** — every tool call in one conversation would have opened its own run. `execution_ref` cannot double as the key: it holds the plan *under diagnosis*, the record being looked at, not the conversation doing the looking |
| mode | choice: `diagnose` \| `collect` | collect = Evidence Bundle |
| status | choice: `queued` \| `running` \| `awaiting_confirmation` \| `complete` \| `failed` | ⚠ **Corrected at Task 10 (issue #24, DESIGN.md R-20).** This row read "native runs go straight to `running`", which states the start of a lifecycle and implies a continuation that does not exist. Native runs go to `running` and **stay there** — there is no terminal state on the native path, because the harness emits no end-of-conversation signal and every way of *declaring* completion was rejected on measured grounds. Completeness is **derived from `x_snc_troubleshoot_audit`** (distinct `tool_name` over `action_type=result`), which is also what DESIGN.md R-3's amendment makes binding for every scored benchmark row. The other four choice values belong to the **Phase 2 custom harness** and are unreachable in Phase 1a — as are `transcript`, `context_summary`, `fix_report` and `error` |
| transcript | string (JSON, large) | array of {seq, actor, tool, args_digest, result_digest, artifact_id?, ts} |
| context_summary | string | summarized older transcript |
| fix_report | string (JSON, large) | validated Fix Report |
| error | string | terminal error if failed |

Artifacts = **attachments on this record** (`GlideSysAttachment`), named `artifact-<seq>-<tool>.json`.

### 3.2 `x_snc_troubleshoot_audit`

| Column | Type |
|--------|------|
| run | reference → x_snc_troubleshoot_run |
| user | reference → sys_user |
| action_type | choice: `intent` \| `result` \| `error` |
| tool_name | string |
| input / output | string (JSON) |
| target_table / target_record | string |
| confirmed_by_user | boolean |

---

## 4. Component Specifications

All tool cores are Script Includes with one contract:
`execute(args: Object | String) → {success: true, data: Object} | {success: false, error: String}` — structured objects **out**, no harness knowledge. All reads `GlideRecordSecure`.

⚠ **Every core normalises reference values before using them (R-15 item 4).** Real rows carry the literal string `"undefined"` in reference fields, which is truthy — treat `''`, `null`, `"undefined"` and `"null"` alike as empty, and emit the raw value alongside the normalised one. Stated here rather than per-tool because it applies to every core that reads a reference.

⚠ **The input side accepts a raw String as well as an Object, and this is load-bearing (R-18b).** This line previously read `execute(args: Object)` … "pure objects in/out, no strings", which directly forbids what §4.7 Note 4 requires. Each core does its own tolerant normalisation — `PaToolAgentTrace` accepts an Object, a JSON string (the native script-tool runtime shape — complex inputs arrive serialised), a bare 32-char hex sys_id, a bare name, or nothing at all (**R-9**). **The adapter must pass bare strings through unchanged**; pre-wrapping them as `{value: …}` produces an args object the core cannot interpret, and it silently falls back to its no-argument behaviour instead of erroring. Output remains strictly structured.

### 4.1 PaToolAgentTrace *(core tool — owns §2.1 mapping with 4.2)*

**Args:** `{execution?: sys_id, agent?: name|sys_id, since?: minutes, step?: task_sys_id, detail?: bool}`

**Resolution:** `execution` given → load plan directly. `agent` given (⚠ `since` is **optional**, not required — R-9: no argument is mandatory) → resolve the name against BOTH `sn_aia_agent` and `sn_aia_usecase` on `name`, `internal_name` and `sys_id` (observed: plan.agent is often empty, or the literal string `"undefined"` — the usecase is the reliable anchor), then query plans `usecase IN (…)^ORagent IN (…)` ordered `sys_created_on` desc **at the database** (⚠ ordering applied after `setLimit` sorts an arbitrary page and mislabels it as the most recent — R-17), return the pick-list if >1 **and trace the newest**, so one call yields usable evidence. **No arguments at all** → return the recent-plan pick-list with an explanatory note; that is a valid answer, not an error (R-9).

**Summary algorithm:**
1. Plan header: state, state_reason, status, objective, run_type, execution_mode, timings, token/latency metrics, conversation, usecase/agent names. ⚠ **Normalise every reference field before use — `usecase`, `agent`, `team`, `conversation`, `related_task_table`/`related_task_record`** (R-15 item 4): treat `''`, `null` and the literal strings `"undefined"` / `"null"` alike as empty. Real rows carry the literal `"undefined"`, which is truthy, so an unnormalised read renders a sys_id pointing at nothing **and** suppresses the "agent is empty, use the usecase as the anchor" guidance exactly when it is needed. Emit the raw value alongside the normalised one so the reader can see which case they are in
2. Task tree: query `sn_aia_execution_task` by `execution_plan`, order by `order`; nest via `parent`; emit {order, type, status, description, time_ms, output_digest(200 chars)}
3. Tool calls: query `sn_aia_tools_execution` by `execution_plan_id`; resolve the binding from `tool`, ⚠ **falling back to `request.toolM2mId` when `tool` is empty — which it is on every real row** (R-15 item 3, so the `tool.tool.name` / `tool.agent.name` dot-walk this step originally specified resolves to nothing and every call renders unnamed) → `sn_aia_agent_tool_m2m`, whose display values give the tool and agent names; emit {tool_name, agent_name, binding_id_source, execution_status, error_message, time_ms, request_digest, response_digest}
4. Messages: query `sn_aia_message` by `execution_plan`, order by **`sys_created_on`, then `message_sequence`, then `sys_id`** (⚠ corrected 2026-07-30, DESIGN.md R-15 item 6 — `message_sequence` alone put tool results ahead of the user's opening message, which was created 26s earlier); emit {seq, created, role, name, content_digest}. If `plan.conversation` is set, also emit conversation context per the K26 guidebook (§2.5): `sys_cs_conversation` channel signals — ⚠ **there is no `channel` field** (R-15 item 5); the NAP-vs-VA signal is spread across `conversation_type`, `device_type` and `provenance`, so emit all three rather than presenting one as the channel — plus `sys_cs_message` digests (⚠ the text is `payload`, the type is `message_type`, ordered by `sequence`) to show dialogue progression and where the user disconnected or got an unexpected reply
5. **Error mining:** any agent-role message whose `message` parses as JSON with `fileName`/`lineNumber` → emit as `script_errors[]` {source, line, error_name} — first-class root-cause evidence
6. Failure signatures (attach to header as `failure_signature`):
   - state=terminated + a `cancelled` orchestrator task + `ongoing` leaf = "died mid-reasoning"
   - `state_reason=security_violation` = **ACL-trigger misalignment** (K26 Lab 1, §2.5): the trigger's run-as user failed the agent/workflow User Access or Data Access check. Emit the next-step pointer: pull `agent_config` triggers (run_as fields) + access roles and compare — the config looks correct at surface level; only the trace reveals it
   - `access_verification`-type task in non-success status = same family — cite it as the trace evidence
7. **Latency flags** (K26 Lab 2 heuristic, §2.5): using per-task timings + plan metrics (`llm_p95_latency`, `tool_p95_latency`, `llm_token_avg`), emit `latency_flags[]`: slow `gen_ai` tasks → `instruction_bloat` (⚠ there is **no per-task token count** on `sn_aia_execution_task` — only plan-level `llm_token_avg` exists, so tokens corroborate the call rather than trigger it — R-17) (instructions reprocessed every ReAct turn); slow `tool` tasks or oversized `response` payloads → `tool_output_bloat` (scratchpad inflation compounding each turn)

**Detail mode (`step`):** *(NOT YET BUILT — deferred to `IMPLEMENTATION_PLAN.md` Task 4 with PaArtifactStore; the shipped tool accepts `step` and returns an explicit `not_implemented` finding rather than ignoring it.)* Full `output` / `request` / `response` for one task or tool execution, routed through PaArtifactStore. **Prompt-level detail:** via `sn_aia_gen_ai_m2m` where `source_id` = step sys_id → `sys_gen_ai_log_metadata` (⚠ admin-only ACL likely — degrade to "prompt logs unavailable, insufficient privilege").

### 4.2 PaToolAgentConfig *(core tool)*

**Args:** `{agent: name|sys_id, section?: overview|instructions|tools|triggers}`

- Resolve against `sn_aia_agent` (name, internal_name, sys_id), fallback `sn_aia_usecase`
- **overview:** agent fields (description, role digest, strategy.name, channel, agent_type) + tool count + usecase/team wiring + trigger active states.

  ⚠ **Traversal direction, verified live on gpinst01 2026-07-30 (R-18a — the first version of this correction had it backwards).** This tool starts from an **agent**, so the `sn_aia_trigger_agent_usecase_m2m` lookup must be keyed on `related_resource_record`, **not** on `trigger_configuration` — you do not have a trigger sys_id at this point, and starting there also skips the agent-direct rows entirely. There are two branches and **both** must be walked, because the m2m is polymorphic (§2.2):

  1. **Agent-direct:** `related_resource_record` = *agentSysId* `^related_resource_table=sn_aia_agent`
  2. **Via the team/usecase chain:** `sn_aia_team_member` (`agent` → `sn_aia_agent`, `team` → `sn_aia_team`) → `sn_aia_usecase` where `team` = that team → then `related_resource_record` IN *(those usecase sys_ids)* `^related_resource_table=sn_aia_usecase`

  Each matching row yields `trigger_configuration` → `sn_aia_trigger_configuration` for the trigger state. Report **both** the m2m's own `active` and `sn_aia_trigger_configuration.active` — either being false unwires the agent. Branch 2 is where most rows live (5 of 6 sampled), so an implementation that walks only branch 1 reports a wired agent as unwired — a blank, not an error (R-6).
- **instructions:** full `instructions` + `role` + `proficiency` + `base_plan` + **`context_processing_script` and `applicability_script` SOURCE from BOTH `sn_aia_agent` AND `sn_aia_usecase`** (⚠ corrected — this step previously named only the usecase copy. The field exists on both, the platform **auto-populates both** whether you want it or not (**R-7**), and the live gpinst01 specimen found by the trace tool threw in the **agent's** copy, not the usecase's (**R-16**). Reading only one side misses half the failure surface. `applicability_script` matters too: auto-populated bodies end in `return false;`, which suppresses the agent silently). Include the script bodies via artifact store
- **tools:** for each `sn_aia_agent_tool_m2m` (by agent): m2m {name, active, execution_mode (`autopilot` = Autonomous / `copilot` = Supervised — §8 item 1), max_auto_executions, timeout, output_transformation_strategy} + tool {name, type, description, input_schema (verbatim JSON), script body via artifact store, target_document_table}
  - **`tool_smells[]` (K26 Lab 3 anti-pattern checklist, §2.5)** — score each attached tool and emit findings: description missing any of the three sections (Purpose / input formats / output+error contract) or a single sentence; no negative guidance (when *not* to use); script accepts one input format with no validation/normalization or fallback; returns raw record dumps (dozens of fields) or unbounded result sets (no `setLimit`); failure path returns an empty object/string instead of a structured error with a suggested action; overlapping tools the agent must call sequentially (consolidation candidates — each extra tool multiplies selection/invocation/interpretation risk)
- **triggers:** `sn_aia_trigger_configuration` rows for linked usecases: {name, active, condition, target_table, objective_template, channel.name, trigger_strategy, run_as fields}
  - **Access alignment check (K26 Lab 1, §2.5):** emit the agent's and workflow's access role sets (⚠ **storage CLOSED, and the guess was wrong** — §8 item 9: **not** a field on `sn_aia_agent`/`sn_aia_usecase` and **not** an `sn_aia_`-prefixed m2m. It is **`sys_agent_access_role_configuration`** (Global scope), keyed **polymorphically** by `agent` (document_id) + `agent_table` (table_name), with the per-role breakout in **`sys_agent_access_role_mapping`** and a parallel path via `sys_agent_access_permission_set_configuration`. ⚠ **And the two lists cannot be separated structurally**: no field distinguishes "User Access" from "Data Access" — the distinction is conventional, carried in free-text `description`. So this check must emit the role sets **with their descriptions** and say the split is heuristic, rather than claiming two clean lists) alongside the trigger's `run_as`/`run_as_user` roles, and flag any role the run-as user lacks — the automated form of the lab's manual security-violation diagnosis.

  ⚠ **What the tool may and may not claim (R-18a).** The *platform* genuinely enforces two independent gates, and the invoking user's role must satisfy **both** — that is the K26 Lab 1 semantic and it remains true. What the tool **cannot** do is say which gate a given role row belongs to, because no structural field records it. So: emit the combined role set with each row's free-text `description`, flag roles the run-as user lacks, and state that attributing a missing role to User Access versus Data Access is **heuristic and must be confirmed in Studio's panels**. The tool must not present two verified lists, and must not report "both lists check out" — it is not in a position to know that.

### 4.3 PaToolGenAiLog

**Args:** `{mode: usage|llm|for_execution|check_config, minutes_ago?: 60, errors_only?: true, execution?: sys_id}`

- **usage:** `sys_gen_ai_usage_log` window → {created, status, execution_type, assists, feature.name, skill_config_id.name, caller_scope, user}
- **llm:** `sys_gen_ai_log_metadata` window → {started_at, model_name, model_version, status, error, error_code, prompt_token_count, response_token_count, time_taken, definition.name, caller}
- **⚠ Prompt/response payload — binding, added 2026-07-30 (this step was missing from §4.3 entirely; see R-10 and §2.3):** the payload is **not** on `sys_gen_ai_log_metadata`. Read `sys_generative_ai_log.prompt` / `.response` via `gen_ai_log_id`. That table's read ACLs grant only `sn_na_analytics.ai_engmt_viewer`, `maint` and `admin` — **a customer administrator holding `sn_aia.admin` / `sn_aia.viewer` cannot read it.** The tool MUST therefore **degrade explicitly**, returning a stated *"payload not readable under caller's roles; metadata only"* result rather than an empty or ambiguous one, and `HANDOFF.md` must carry the required grant as a customer-side prerequisite rather than a bug. This is a real capability limit on 1 of the 7 Phase 1a tools and must be specified, not discovered at demo time.
- **for_execution:** plan.gen_ai_usage_log row + `sn_aia_gen_ai_m2m` rows where source_id IN (plan + task sys_ids) → their log_metadata summaries
- **check_config:** `sys_one_extend_capability_definition` rows (⚠ **CLOSED** — §8 item 6, and all five fields re-verified against `sys_dictionary` 2026-07-30: read `capability`, `name`, `api_type`, `api`, and **`connection`** — the bound provider credential alias, i.e. Bedrock / Vertex / Azure OpenAI / Now LLM. `connection` empty or unresolvable **is** the "capability not mapped to a provider" finding, which is benchmark seed 4)

### 4.4 PaToolSchemaLookup / PaToolQueryTable / PaToolLogAnalysis

As specified in `IMPLEMENTATION_PLAN.md` Task 8. ⚠ **The "unchanged by instance research" claim that stood here was false for `syslog` and is withdrawn (R-18).** `sys_dictionary`, `sys_choice`, `sys_db_object` all read fine from `x_snc_troubleshoot` — but **`syslog` is DENIED from our scope**, measured, not predicted: the `/scope_probe/reads` endpoint returns 14 readable / 1 denied, and the one denial is `syslog` (re-confirmed 2026-07-30). ⚠ **R-12 is now RESOLVED — negatively (R-19, 2026-07-31).** The grant was declared as Fluent `CrossScopePrivilege` and **installs correctly** (`source_scope=x_snc_troubleshoot`, `target_name=syslog`, `target_scope=global`, `operation=read`, `status=allowed`, verified in `sys_scope_privilege`) — **and `syslog` stays `DENIED`.** The blocker is `sys_db_object.caller_access = Caller Restriction`, which a *self-declared* privilege does not satisfy; the app cannot grant itself access to a caller-restricted table. `PaToolLogAnalysis` therefore needs an **instance-admin action or a different evidence path** — a customer-side prerequisite, not a code defect. **Recommended shape:** ship the tool and have it **degrade explicitly**, exactly as R-10 mandates for `PaToolGenAiLog`, so a diagnosis states "platform logs unavailable from this scope" rather than silently dropping the log layer. The declaration is kept in `src/fluent/cross-scope-privileges.now.ts` because it is the half we own: if an admin lifts the restriction, the privilege must already exist. `PaToolSchemaLookup` and `PaToolQueryTable` are unaffected. One addition to SchemaLookup: `sys_db_object` existence check first, so "table does not exist" is a distinct finding from "no fields readable" (cross-scope signal).

**PaToolLogAnalysis query shape is mandatory-scoped** (K26 guidebook rule, §2.5 — an unfiltered `syslog` read can slow or time out an instance): every query MUST carry a bounded time window (default: the execution plan's start/end ± 2 min when called with an execution context; else `minutes_ago`), level ≤ Warning by default, and at least one of source-contains (scope / Script Include name) or message-contains (execution plan sys_id, error keyword). The tool refuses an unscoped query with a structured error suggesting the missing condition — mirroring the platform's own `syslog.filter` discipline.

### 4.5 PaArtifactStore

- `store(runId, toolName, content)`: `content.length > 4000` → `GlideSysAttachment().write(runGR, "artifact-<seq>-<tool>.json", "application/json", content)`, return `{artifact_id: attachment_sys_id, excerpt: head 1500 + "\n…[elided N chars]…\n" + tail 500, total_length}`; else pass through
- `read(artifactId, offset=0, length≤4000)`: `GlideSysAttachment().getContent()` sliced — exposed to the LLM as tool `read_artifact`
- ✅ **VERIFY CLOSED — positively (issue #16, 2026-07-31).** The scoped-app attachment surface works as designed, measured on gpinst01 (SDK 4.9.2, Zurich P10) rather than assumed: from scope `x_snc_troubleshoot`, `GlideSysAttachment().write()` stored a 35,000-char payload on an `x_snc_troubleshoot_run` row (`size_bytes=35000`, `content_type=application/json`, `file_name=artifact-1-selftest.json`), and `.getContent()` — fed a `GlideRecordSecure('sys_attachment')` record, which it accepted without complaint — paged it back in nine reads (8×4000 + 1×3000) that reassembled **byte-identical** to the original. Re-runnable via the temporary `POST /api/x_snc_troubleshoot/scope_probe/artifact_selftest` route, which cleans up after itself.
- **Two deviations from the shape specified above**, both deliberate and both in `src/server/PaArtifactStore.js`:
  1. `read()` **refuses any attachment whose `table_name` is not `x_snc_troubleshoot_run`.** `read_artifact` is LLM-callable and takes a caller-supplied sys_id; without the check it is a generic "read any attachment on the instance" primitive, and a trace payload is a plausible prompt-injection carrier. Verified live against a real foreign attachment (`ar_sys_email`), refused. GlideRecordSecure's ACLs remain the first lock; this is the second, which does not depend on the instance's `sys_attachment` ACLs being tight.
  2. `store()` **never falls back to returning the full payload.** If the attachment cannot be written (no run anchor, denied write, API absent) the caller gets the excerpt plus a named `degraded` reason and a note that paging is unavailable — the R-10 explicit-degradation pattern. Returning the 35KB instead would defeat the component's only job at precisely the moment the system is already degraded.

### 4.6 PaRunAnchor + PaAuditLogger

- `PaRunAnchor.getOrCreate({harness, executionRef?, conversationId?})`: for native harness, key = **`_agentic_context_.conversation_id`** (⚠ **CLOSED by R-2**: a script tool receives an undocumented global `_agentic_context_` — a **JSON string**, so `JSON.parse` it — carrying `agent_id`, `conversation_id`, `usecase_id`, `execution_plan_id`. `conversation_id` was stable across all 19 calls of a conversation and matches `sn_aia_execution_plan.conversation`; `execution_plan_id` is available as a finer second key. Note `gs.getSessionID()` returns the literal `"SYSTEM"`, so anything keyed on session ID collides across conversations). ⚠ **The "one anchor per user per 30 min" fallback that stood here is DELETED, not merely discouraged** — R-2 removed time-window keying from the design entirely so it cannot be reached by accident; it interleaves two benchmark runs onto one run record and lets run 2 read run 1's artifacts, breaking the blind-run independence the doubled-run protocol exists to measure (DESIGN.md §2.4). R-2's closure is API-path-provisional: re-confirm `_agentic_context_` on the Now Assist panel path before the benchmark. Creates `x_snc_troubleshoot_run` with `harness=native`, `status=running`
- `PaAuditLogger.logIntent/logResult/logError(params)` → `x_snc_troubleshoot_audit` insert; called by the adapter around every tool execution

✅ **BUILT AND VERIFIED on gpinst01 (issue #20 / PR #21, 2026-07-31).** Four points where the shipped
component is more specific than the text above, all of them decisions rather than details:

1. **The key needed a column.** See the `conversation_ref` row in §3.1 — added at this task, because
   without it the "get" half of `getOrCreate` had nothing to query on.
2. **No key at all is a third case, and it isolates.** R-2 deleted time-window keying entirely, so a
   call with neither a conversation id nor an execution ref has nothing to resolve on. It gets a
   **fresh run used for that call alone**, flagged `keyed: false` with a stated reason. Two unkeyed
   calls never share a record. This is the structural enforcement of R-2 rather than a comment
   asking future implementers to remember it — verified live, two distinct run ids.
3. **Concurrency converges after the insert, not before it.** R-3 measured up to 4 tool calls in one
   timestamp batch, all racing. No atomic upsert exists here, so `getOrCreate` inserts, then
   re-resolves the key and adopts the deterministic winner (oldest `sys_created_on`, `sys_id` as
   tie-break — ties are the *normal* case, a batch lands inside one second). Losers' rows are left
   in place; deleting a record another thread may be mid-write on would be the worse bug.
4. **`PaAuditLogger` is total.** It sits in the hot path of every tool call, so every method returns
   a result object for any input including none, and never propagates a throw — a diagnosis that
   died because its own audit logging threw is strictly worse than one with a gap in its trail. A
   missing run anchor does not suppress the row; it lands orphaned and flagged.

5. **Identity is server-authoritative; only configuration is caller-supplied** (security review on
   PR #21, two Medium findings). The `{harness, conversationId, executionRef}` signature above
   reads as though all three were equally caller-supplied. They are not. **The ambient
   `_agentic_context_` wins over caller-supplied `conversationId` / `executionRef` / `agentId`
   whenever it is present** — this section already says the native key *is*
   `_agentic_context_.conversation_id`, and honouring a caller override would let a native tool
   call name any conversation and receive that conversation's run record, artifacts and audit
   trail: the R-2 merge through the front door, on partly LLM-derived input. Caller-supplied
   identity applies only where there is no ambient context to contradict it — the custom harness
   ("custom: explicit run_id"), tests, and the self-test route. `harness` and `mode` remain
   caller-first because they are configuration, not identity. On that remaining path a resolved
   run owned by a **different** user is not adopted; the check fails open on "cannot tell" and
   closed only on "can tell, and it is not you". Likewise `x_snc_troubleshoot_run.user` and
   `x_snc_troubleshoot_audit.user` / `confirmed_by_user` are never caller-settable — `user` is
   `gs.getUserID()`, and `confirmed_by_user` stays false until Phase 2's confirmation gate sets it
   from the workflow that actually collects the confirmation. ⚠ **Provenance is per field, not per
   context** (round-2 finding): "the caller supplied this key" must be decided from the specific
   identity field being used as the key, never from "an ambient context exists". `_agentic_context_`
   parsing to `{}`, to junk, or to a `conversation_id` of the literal `"undefined"` all yield a
   present-but-empty context, in which the key still comes from the caller — deriving the check
   from presence alone leaves cross-user fixation open on exactly those inputs.

⚠ **Observed, unresolved:** audit rows written within one second do **not** sort reliably by
`sys_created_on` — across two self-test runs the same three rows came back in two different orders.
`sys_created_on` is second-granular and all three writes land inside it. If Task 9 or the benchmark
needs the trail in call order, it needs an explicit sequence field; the timestamp will not supply
one.

### 4.7 PaScriptToolAdapter (native harness bridge)

```
invoke(toolClassName, inputString, ctx):
  args   = tolerantParse(inputString)   // JSON object → object | "" → {}
                                        // bare string → PASS THROUGH UNCHANGED (Note 4)
  run    = PaRunAnchor.getOrCreate({harness:"native", ...ctx})
  audit  = PaAuditLogger.logIntent(...)
  result = new <toolClassName>().execute(args)          // Object OR String — see §4 contract
  result = PaArtifactStore.applyThreshold(run, result)  // big payloads → attachment + excerpt
  PaAuditLogger.logResult/logError(...)
  return JSON.stringify(result)          // ALWAYS a string, never throws
```

Seven thin `sn_aia_tool` (type `script`) bodies each call `invoke()` with their tool class. Input schemas use the **verified** format `[{"name","description","mandatory"}]` — one schema entry per logical arg, all strings, parsed by the adapter.

**⚠ Corrections to this contract — R-5 mandated these "before any of the 7 tool cores is written" and they were never applied to this section (R-18).**

1. **There is no `outputs` object.** The signature is `(function(inputs) { … return result; })(inputs);` — referencing `outputs` throws `ReferenceError: "outputs" is not defined` and terminates the run.
2. **The tool script must be a self-invoking IIFE**, and the trailing `(inputs)` is required. Omitting it is a **runtime** error that builds and installs cleanly (SDK Build Rule #19).
3. **Execution scope is `rhino.global`**, not the application scope — which is why the tool-core Script Includes are declared `accessibleFrom: 'public'`. `gs.getSessionID()` returns the literal `"SYSTEM"`.
4. **Bare-string inputs: do NOT wrap them as `{value: s}`.** This section originally specified that, and it silently breaks the tool cores, which do their own tolerant parsing: `PaToolAgentTrace` maps a bare 32-char hex string to `{execution: …}` and any other bare string to `{agent: …}`. Wrapping it as `{value: …}` yields an args object with neither key, so the tool falls back to the recent-plan pick-list and the caller's actual request is silently discarded. **Pass the raw string through to `execute()`** and let the core normalise it.
5. **`input_schema` is an ARRAY**, never a JSON-Schema object — a JSON-Schema object causes a **silent, never-terminating stall** (`In progress` forever, no error). The single most expensive defect found in Phase 0; the adapter template must enforce the array shape rather than leaving it to whoever writes the next tool.
6. **Declared inputs may simply not arrive** (**R-9**) — the probe agent never passed a declared input in any run while its own reasoning text claimed it had. Every tool core must behave correctly with all inputs absent.

---

## 5. Agent Doctor — Native Agent Record Set (built as **Fluent DSL via the SDK**)

> ⚠ **This heading previously read "(created via Foundry automation, NOT SDK)" — reversed by DESIGN.md R-13 and corrected here (R-18c).** Agent Doctor is a Fluent `AiAgent` in `src/fluent/agent-doctor.now.ts`, deployed by `now-sdk build` + `now-sdk install`. Creating it via MCP/Foundry record automation is **forbidden** by CLAUDE.md's boundary — *"SDK owns creation. Agents, tools, tables, flows — defined as Fluent DSL in `src/fluent/`"* — and R-13 records that executing the old instruction would have built the product's central artifact on the wrong side of the line the project sets for itself.
>
> **`IMPLEMENTATION_PLAN.md` Task 10 is the authority for HOW it is built** (mandatory `securityAcl`; inline `tools[]` entries must NOT carry `$id`, Rule #32; every tool needs a non-empty `description` or the record is silently skipped at install, Rule #34; script tools are self-invoking IIFEs, Rule #19). The table below specifies WHAT the records contain.

| # | Record | Table | Key values |
|---|--------|-------|-----------|
| 1 | Agent Doctor | `sn_aia_agent` | `name`="Agent Doctor", `agent_type`=internal, `channel`=`nap_and_va`, **`strategy`=`f0bff21f9f13c6108f431597d90a1c74` (ReAct — verified default)**, `role`/`instructions` from `agent-doctor-instructions.md` (playbook: seven-layer sweep, evidence rule, Fix Report markdown template, read_artifact usage) |
| 2–8 | 7 tools | `sn_aia_tool` | `type`=script, descriptions written to the **K26 three-section framework** (§2.5): Purpose (incl. when NOT to use) · Understanding Tool Inputs (formats + how off-format input is handled) · Understanding Tool Outputs & Error Handling (success/empty/error shapes + what to do next); `input_schema` per §4.7; script = adapter call. The adapter already satisfies the smart-tool bar: tolerant input parsing, structured JSON out, never an empty `{}` on failure |
| 9–15 | 7 attachments | `sn_aia_agent_tool_m2m` | `active`=true, **`execution_mode`=`autopilot`** (⚠ **CLOSED** — §8 item 1: the only two valid stored values are `autopilot` (label "Autonomous") and `copilot` (label "Supervised"). This cell previously read `unsupervised/auto`, **neither of which is in the choice list**; writing it would have produced attachments with an invalid value. All 7 tools are read-only, so `autopilot` is correct and is in live production use on 361 of 384 script-type attachments). Also set `max_auto_executions` deliberately rather than accepting the dictionary default of 10 — DESIGN.md §2.2 / R-4, and record both budget knobs in the benchmark scorecard. ⚠ **Reversed at Task 10 (issue #24) — `src/fluent/agent-doctor.now.ts` deliberately does NOT set `max_auto_executions`.** The tool bindings take the dictionary default instead, on the reasoning that a default-configured customer instance has the default, not a pinned value. R-4's binding requirement is that Task 11 **read and record** both budget knobs at run time — it does not require this agent to pin one, and pinning it would make Task 11's scorecard measure a configuration real customers do not have, exactly R-4's complaint about the Phase 0 probe running at 20 against an instance-typical 10. This decision currently exists only in an untracked execution ledger. `output_transformation_strategy`=None (raw JSON back to the reasoning loop), `display_output`=false |
| 16 | Team | `sn_aia_team` (+`sn_aia_team_member`) | "Troubleshooter" team wrapping Agent Doctor |
| 17 | Use case | `sn_aia_usecase` | "Diagnose AI Agent failure", `team`=16, orchestrator strategy default. ⚠ **`context_processing_script` must be EXPLICITLY CLEARED after creation and the clearing verified — omitting the field does NOT leave it empty** (**R-7**, whose mandated restatement of this cell had never been applied). The platform auto-populates it with a default template, and auto-populates `applicability_script` too with a body ending in `return false;` — which would suppress the agent silently. This matters because it is precisely the field class the instance's known failures live in: both the keynexus01 specimen and the gpinst01 one found by `PaToolAgentTrace` (**R-16**) are `context_processing_script` throwing. "Keep ours empty" is a post-creation action, not an omission. ⚠ **UNFULFILLED at Task 10 (issue #24, DESIGN.md R-7 amendment) — deliberately, not by oversight.** This row describes `sn_aia_usecase`, but this branch built no usecase record at all (see the row 16–19 note below); the `context_processing_script` this branch actually measured populated was on **`sn_aia_agent`**, a record no row in this table describes. The clear-and-verify mandate above was not carried out — it was deliberately left uncleared so the one test that had to work could attribute a failure correctly, rather than to any inability to clear it. R-7 itself is now **half-refuted**: `applicability_script` came back empty (refuting the dangerous "ends in `return false;`" half), while `context_processing_script` came back auto-populated at 2,124 characters (confirming the "omission ≠ empty" half). Whether to clear it is **OPEN** |
| 18 | Trigger | `sn_aia_trigger_configuration` | `active`=true, channel=Now Assist panel, condition/objective_template minimal. ⚠ **Conflicts with `IMPLEMENTATION_PLAN.md` Task 10, which specifies NO `triggerConfig` — Agent Doctor is invoked conversationally, and Build Rule #31 says `triggerConfig` on a bare `AiAgent` yields a trigger whose `usecase` is null, so it never fires.** Task 10 is the authority for the Phase 1a build: rows 18–19 are **deferred**, not part of the first install. If a trigger is wanted later it belongs on an `AiAgenticWorkflow`, and note that SDK 4.9.0 deploys triggers **inactive** for manual activation. ⚠ **Extended at Task 10 (issue #24): rows 16–17 are unbuilt too, alongside 18–19, but for a different reason.** A bare Fluent `AiAgent` creates no `sn_aia_team` (row 16) and no `sn_aia_usecase` (row 17) — there is no config surface for either on `AiAgent` — so Team and Use case are as absent from the installed instance as Trigger and Wiring are. The difference is *why*: rows 18–19 are **deferred** by an explicit conflict ruling (Build Rule #31) that could be revisited by moving to an `AiAgenticWorkflow`; rows 16–17 are simply **not created** by the artifact type this branch builds, and revisiting them means adding a different Fluent construct, not lifting a deferral |
| 19 | Wiring | `sn_aia_trigger_agent_usecase_m2m` | ⚠ **Not a trigger↔usecase↔agent row — the table has no `agent` and no `usecase` column** (§2.2, R-18). Write `trigger_configuration` = row 18, plus the **polymorphic** pair `related_resource_table` = `sn_aia_usecase` (or `sn_aia_agent`) and `related_resource_record` = that record's sys_id, plus `active`=true. One row per resource being wired; the m2m's own `active` gates the wiring independently of `sn_aia_trigger_configuration.active` |

Tool roster (names as the LLM sees them): `agent_trace`, `agent_config`, `genai_log`, `schema_lookup`, `query_table`, `log_analysis`, `read_artifact` — exactly 7, at the platform's 5–7 guidance ceiling; nothing else gets added.

---

## 6. Build Approach with the ServiceNow SDK

*(⚠ **Status corrected 2026-07-31 (R-18c) — "nothing here is built yet" is false.** The scoped app `x_snc_troubleshoot` is built and installed on gpinst01, and `PaToolAgentTrace` (§4.1, summary mode) ships with its Fluent `ScriptInclude`, Jest tests in `test/`, and a temporary `/scope_probe/trace` verification route.)*

| Artifact | Built via | Rationale |
|----------|-----------|-----------|
| Scoped app, `x_snc_troubleshoot_run`, `x_snc_troubleshoot_audit` tables | **SDK** (Fluent table definitions) | Versioned DDL in git, repeatable install |
| Script Includes (§4: 6 tool cores + ArtifactStore + RunAnchor + AuditLogger + ScriptToolAdapter) | **SDK** (source-controlled server scripts) | The whole point — code in repo, deployed by CLI |
| Jest tests (adapter parse/stringify, truncation/paging, error-mining regex) | repo-local | pure-logic tests run without instance |
| Agent Doctor record set (§5) | **SDK** — Fluent `AiAgent` in `src/fluent/agent-doctor.now.ts` | ⚠ **Corrected (R-13, R-18c): this row previously said "Foundry automation", which CLAUDE.md forbids** — SDK owns creation of agents, tools, tables and flows. See `IMPLEMENTATION_PLAN.md` Task 10 |
| Benchmark seed agents (§7) | ⚠ **UNDECIDED** | `IMPLEMENTATION_PLAN.md` Task 11 records this as an explicit open question — Fluent gives reproducibility for the Phase 1b re-run but would ship five broken agents inside the product app; MCP keeps them out but is not reliably reproducible. Likely a **separate scoped app**. This row previously asserted "Foundry automation" as settled; it is not |

Repo layout (⚠ **corrected — the `src/instance/**` / `src/agent-doctor/**` tree described here never existed**; R-13 established the real structure and R-14 moved the tests out of `src/`):

- `src/fluent/*.now.ts` — every platform artifact: tables, Script Includes, the `AiAgent`, REST APIs
- `src/server/**/*.js` — Script Include bodies (ES5/Rhino), referenced via `Now.include()`
- `test/**/*.test.js` — Jest, **outside `src/`**: `now-sdk build` lints the whole source tree and a test's `require('vm')` fails the build (R-14)
- `benchmark/**` — seeds and scorecards

**Deploy target: `gpinst01`** (`now-sdk install --alias gpinst01`). ⚠ This line previously said keynexus01, which has **no `now-sdk auth` entry** and is not currently reachable; add one with `now-sdk auth --add keynexus01` before targeting it.

Order of operations after SDK setup: install scoped app → run `/status`-equivalent readability check (§3 cross-scope) → create Agent Doctor records → smoke test → build seeds → benchmark.

---

## 7. Benchmark Implementation

⚠ **Instance corrected 2026-07-31 (R-18c).** This section was headed "on keynexus01". That instance has **no `now-sdk auth` entry**, is not currently reachable, and its Now Assist plugin state is **unverified** — the P1 result was produced by the same `v_plugin` instrument that R-11 retracted, so it is suspect and must be re-checked with `sys_scope` before anything is claimed about it. The built app is installed on **gpinst01**, which R-11 confirmed has the product plugins active.

**Smoke test (before any seeds) — two known-answer specimens, one reachable today:**

- **gpinst01 (reachable):** execution `c9d63a932bda8b9417a6ffbeee91bfd0`. Expected diagnosis: `script_error` signature citing `sn_aia_agent.601672d3….context_processing_script` **line 42**, `InternalError`. Found by `PaToolAgentTrace` (**R-16**) and *invisible from the plan header* — `state=Completed`, empty `state_reason`, all 11 tasks and all 5 tool calls `Success`. It therefore tests something stronger than "did the tool read the rows": it tests whether a diagnosis that stops at the header is caught.
- **keynexus01 (blocked on auth):** execution `78f347b72f198310f824ac1bcfa4e3bd` — script failure in the SIGNAL use case's `context_processing_script` (line 61), evidenced by the agent-role error message plus terminated/`execution_failed`. Also the only source for the silent non-terminating stall and the `ReferenceError` specimens.

We know the right answer in both cases; the smoke test checks that the tools surface it.

Seed construction (each = one broken agent + one captured failing execution sys_id):

| Seed | Construction on instance |
|------|--------------------------|
| 1 — tool schema mismatch | Script tool with `input_schema` declaring `priority` free-string; script writes to `incident.priority` (integer choice 1–5); agent instructed to set priority from words. Trigger via chat; verbose multi-step instructions to force a LARGE trace (artifact-paging stressor) |
| 2 — ambiguous instruction | Instructions say "assign to the right group", no lookup guidance, no group tool |
| 3 — missing data | Instructions reference lookup table `x_snc_tsbench_routing` (created empty) — corrected 2026-07-31: a scoped table name must begin with its own app's scope value (R-13), and the seeds live in `x_snc_tsbench` (R-21). See `benchmark/DECISION-seed-location.md` for the prior (unbuildable) name this replaces |
| 4 — GenAI stack | ⚠ VERIFY safest construction: prefer a bogus `skill_config_id`/capability reference over breaking instance-wide provider config (shared instance — do NOT unmap real capabilities) |
| 5 — inactive wiring | Use case + trigger created with `sn_aia_trigger_configuration.active`=false. ⚠ Note there are **two** independent activation gates (§2.2, R-18): `sn_aia_trigger_configuration.active` **and** `sn_aia_trigger_agent_usecase_m2m.active`. Set one false and leave the other true, so the seed tests whether the diagnosis names the right gate rather than just "something is inactive" |

Scoring per `IMPLEMENTATION_PLAN.md` Task 11–12: 2 runs/seed, blind, 6-point rubric, gate thresholds from ADR Decision 0.5.

**Candidate seeds 6–8 (from the K26 failure taxonomy, §2.5 — stretch set, not gate-scored; build after the 5-seed gate or swap in if a core seed proves unbuildable):**

| Seed | Taxonomy | Construction on instance |
|------|----------|--------------------------|
| 6 — ACL-trigger misalignment | T1 cold start | Trigger `active`=true but agent/workflow User Access + Data Access restricted to a role the run-as user lacks (e.g. `itil` user vs. admin-only access) → expect `state_reason=security_violation`, no surface config error. Reproduces K26 Lab 1 exactly; matching real failures exist on **both** instances — keynexus01 (§1) and gpinst01, where `PaToolAgentTrace` returned the `acl_trigger_misalignment` signature against live `state_reason=security_violation` plans (e.g. `0117b4142b600fd017a6ffbeee91bf32`) |
| 7 — instruction bloat latency | T4 high latency | Agent with deliberately oversized instructions (inline decision trees, hardcoded error-code maps, example conversations) + a search tool returning raw unfiltered chunks → expect `latency_flags[]` diagnosis: instruction_bloat + tool_output_bloat, fix = offload logic to a Skill / synthesize tool output |
| 8 — infinite loop | T6 loops | Agent with no completion criteria and directives conflicting with its workflow, or a trigger whose condition matches records the agent itself updates (recursive firing) → expect wiring/instruction diagnosis; guarded by `sn_aia.continuous_tool_execution_limit` and the 5-runs-per-15-min recursion limit so the shared instance is safe |

---

## 8. Open Items (⚠ VERIFY during build — all flagged inline above)

1. `sn_aia_agent_tool_m2m.execution_mode` choice values (supervised flag) and `sn_aia_tool.type` full choice list — **CLOSED (Phase 0):** `execution_mode` has exactly 2 active choices, stored values `autopilot` (label "Autonomous") and `copilot` (label "Supervised"); `sn_aia_tool.type` has 14 active choices, the script one being stored value `script` (label "Script"). Both `execution_mode` values are in live production use on script-type attachments (361 `autopilot` / 23 `copilot` of 384). Unsupervised script-tool execution is available.
2. Use-case activation mechanism (no `active` on `sn_aia_usecase`) — ~~**not in Phase 0 scope**~~ **ANSWERED 2026-07-30 (R-18), outside Phase 0:** activation is carried on the trigger side, and there are **two independent gates** — `sn_aia_trigger_configuration.active` **and** `sn_aia_trigger_agent_usecase_m2m.active`. Verified against live gpinst01 rows showing both `true` and `false`; a use case reads as "inactive" when either gate is off, which is why the MCP listed all 17 that way. `sn_aia_usecase_config_override` was the guess and is not needed. Benchmark seed 5 should set one gate false and leave the other true, so the diagnosis has to name the right one (§7).
3. `sys_gen_ai_log_metadata` ACLs for non-admin callers; prompt/response payload location (`sys_gen_ai_metadata_document`) — **CLOSED (Phase 0):** payload is **not** in either named table; it lives in `sys_generative_ai_log.prompt` / `.response`. Read roles — `sys_gen_ai_log_metadata`: `sn_aia.viewer`, `sn_aia.admin`, `sn_nowassist_admin.nsa_admin`, `maint`, `admin`; `sys_gen_ai_metadata_document`: `platform_ml_read`, `maint`; `sys_generative_ai_log`: `sn_na_analytics.ai_engmt_viewer`, `maint`, `admin`. A customer's `sn_aia.admin`-only caller can read metadata but **not** prompt/response text. (Role name on-instance is `sn_aia.admin`, dot-separated — see §1.)
4. Cross-scope read privileges required per §2 table from our app scope (`sys_scope_privilege` entries) — **CLOSED 2026-07-31 (was CARRIED FORWARD).** Static half closed (none of the 11 §2 tables present is `access=none` — not a valid value on this version — and none carries a restrictive `caller_access`; **47** standing `sys_scope_privilege` Read grants exist among **79** privilege rows total (the rest being 17 Write, 14 Create, 1 Delete), covering 8 distinct Read targets, all from first-party scopes, no custom `x_*` precedent). ~~Runtime half **untested**: the P4b background-script proxy could not be executed — no background-script executor exists in the Foundry MCP toolset — and the probe tool landed in `Global` scope, so its successful reads do not simulate a restricted `x_pa_*` scope.~~ **Runtime half CLOSED 2026-07-30 (R-1 discharge).** The check was built as a Scripted REST API *inside* `x_snc_troubleshoot` (`src/fluent/scope-readability.now.ts`, `GET /api/x_snc_troubleshoot/scope_probe/reads`) — the runtime measurement P4b could not obtain, taken from a genuinely restricted scope rather than Global. Result, re-confirmed 2026-07-31: **14 of 15 tables readable with no privilege grant at all; exactly 1 denied.** Every table the other five tool cores read is cleared, and `IMPLEMENTATION_PLAN.md` Task 1 now carries the check. Separately: `syslog` carries `caller_access = Caller Restriction`, a live constraint on `PaToolLogAnalysis`. ⚠ **RESOLVED 2026-07-31 (R-19), negatively:** a `sys_scope_privilege` Read grant installs correctly and does **not** lift the denial — an application cannot grant itself access to a caller-restricted table. Needs an instance-admin action or a different evidence path; the tool should degrade explicitly (§4.4). (Phase 0 also established that the table this document previously called `sys_log` does not exist; all references were corrected to `syslog` on 2026-07-30 — see DESIGN.md R-6.)
5. Native tool-script execution context: what conversation/execution identifiers are available to a script tool at runtime (anchors PaRunAnchor keying) — **CLOSED (Phase 0):** a script tool receives an undocumented global `_agentic_context_`, a **JSON string** (must be `JSON.parse`d) carrying `agent_id`, `conversation_id`, `usecase_id`, `execution_plan_id`. `PaRunAnchor` keys on `_agentic_context_.conversation_id`; stable across all 19 calls of a conversation and matches `sn_aia_execution_plan.conversation`. The bare names `conversation_id`/`execution_plan_id`/`agent_id` are `undefined`; `gs.getSessionID()` returns the literal `"SYSTEM"`. Provisional in two respects: obtained via the API path, not the Now Assist panel (no product plugin active), and `_agentic_context_` is undocumented.
6. Capability→provider mapping table for `check_config` (`sys_one_extend*` family) — **CLOSED (Phase 0):** `sys_one_extend_capability_definition` (17 fields). Read `capability`, `name`, `api_type`, `api`, `connection` (the bound provider credential alias — Bedrock / Vertex / Azure OpenAI / Now LLM). Confirmed live, not merely structural, by sampling 10 rows.
7. Final app scope prefix (assigned at SDK app creation) — ~~**not in Phase 0 scope**~~ **CLOSED 2026-07-30 (R-13):** `x_snc_troubleshoot`, scopeId `13043037d3da4293904504ef30589334`. §3 is the authority for table names, and the `x_pa_*` placeholders were not shorthand awaiting expansion — they were names the platform rejects, since a scoped table name must begin with its application's exact scope value (40 of 40 sampled `x_snc_*` tables, no exceptions).
8. Seed 4 construction that cannot degrade the shared instance's GenAI config — ~~**STILL OPEN** (not in Phase 0 scope), but narrowed by R-18~~ **CLOSED 2026-07-31 (R-21), build-proven:** narrowed by R-18 and now built to that narrowing — `sys_one_extend_capability_definition.connection` is the bound provider credential alias, so an **empty `connection` is precisely the "capability not mapped to a provider" finding** seed 4 needs to produce. The seed constructs a **new** capability definition owned by the fixture app with `connection` left empty, rather than unmapping a real one — which is what respects the shared-instance constraint this item exists to protect. Qualify honestly: **build-proven, not yet runtime-proven** — the runtime half (triggering the failure and capturing the execution) arrives with Task 12; the install-refusal fallback is recorded in `benchmark/seeds/seed-04-genai-unmapped.md`.
9. Storage location of AI Agent Studio's "Define User Access" / "Define Data Access" role sets (needed for §4.2 access alignment check — expected on `sn_aia_agent`/`sn_aia_usecase` fields or a related role m2m) — **CLOSED (Phase 0):** `sys_agent_access_role_configuration` (Global scope), keyed polymorphically by `agent` (document_id) + `agent_table` (table_name). Not a field on `sn_aia_agent`/`sn_aia_usecase` and not an `sn_aia_`-prefixed m2m. Per-role breakout in `sys_agent_access_role_mapping`; parallel permission-set path via `sys_agent_access_permission_set_configuration`. 159 config rows for `sn_aia_agent`/`sn_aia_usecase`. No structural field distinguishes "User Access" from "Data Access" — the distinction is conventional, carried in free-text `description`.
10. Now Assist Panel enabled on keynexus01 (Now Assist Admin → Experiences → Now Assist panel) — per K26 dependencies it requires ≥1 Now Assist product plugin active and is a prerequisite for testing agents in AI Agent Studio; needed before the §7 smoke test — **RETRACTED and re-dispositioned 2026-07-30.** The Phase 0 disposition was **CARRIED FORWARD** on the strength of `panel_available: false` — "no Now Assist product plugin exists or is active." **That finding is wrong and is retracted** (DESIGN.md **R-11**). It came from a `v_plugin` query whose results are truncated by plugin visibility restrictions for this caller; a partial result was read as absence. `sys_scope` is the correct instrument. Re-verified on **gpinst01** 2026-07-30 via `sys_scope`: the product plugins **are installed and active** — `sn_itsm_aia` (IT Service Management AI agent collection, v9.1.1), `sn_csm_gen_ai` (Now Assist for CSM, v13.0.3), `sn_fsm_gen_ai` (Now Assist for FSM, v10.0.1), `sn_ex_gen_ai` (Now Assist for Employee Experience, v4.3.2), `sn_km_gen_ai` (Now Assist in Knowledge Management, v30.10.3), `sn_nowassist_va`, `sn_na_center`, `sn_nowassist_admin`, and ~50 more Now Assist scopes (60-row query limit reached, so likely more). **There is no provisioning gap on gpinst01 and nothing here blocks the §7 smoke test or the K26 lab prerequisites.** **keynexus01 is NOT re-verified** — its P1 result used the same `v_plugin` instrument and is **suspect by the same reasoning**; that instance is not currently connected. **Open action: re-verify keynexus01's plugin state with `sys_scope` before relying on it.** The API-path provisionality on items 5 and the E1/E2 results is unaffected by this retraction and still stands on its own terms.
