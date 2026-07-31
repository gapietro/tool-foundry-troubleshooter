# ServiceNow AI Data Model Reference

> Master reference for all AI Agent, Now Assist, GenAI Controller, Group Action Framework, and MCP Client related tables, fields, relationships, and API endpoints. Validated against ServiceNow Zurich instances.

---

## Overview

ServiceNow's AI infrastructure spans multiple table families:

- **sn_aia_*** -- AI Agent framework (agents, tools, teams, use cases, executions, properties, analytics)
- **sys_one_extend_*** -- Capability/skill registration and definition
- **sn_nowassist_*** -- Now Assist skill configuration
- **sys_generative_ai_*** / **sys_gen_ai_*** -- GenAI Controller: LLM prompt/model config, prompt config selection, call logging, provider routing. (There is **no** `sys_genai_*` or `sn_gai_*` table family -- see [GenAI Controller Tables](#genai-controller-tables))
- **sn_gaf_*** -- Group Action Framework (clustering, mapping, reducing)
- **sn_mcp_*** -- MCP Client (server registry, sessions, execution logs)

Understanding these tables and their relationships is essential for programmatically creating, querying, and debugging AI artifacts on ServiceNow.

---

## Table of Contents

1. [Core AI Agent Tables](#core-ai-agent-tables)
2. [Execution Tables](#execution-tables)
3. [Now Assist Skill Tables](#now-assist-skill-tables)
4. [GenAI Controller Tables](#genai-controller-tables)
5. [Group Action Framework (GAF) Tables](#group-action-framework-gaf-tables)
6. [MCP Client Tables](#mcp-client-tables)
7. [Agent Properties Table](#agent-properties-table)
8. [Analytics and Reporting Tables](#analytics-and-reporting-tables)
9. [Relationship Diagram](#relationship-diagram)
10. [Domain Separation](#domain-separation)
11. [Table Name Variants by Version](#table-name-variants-by-version)
12. [Data Retention Policies](#data-retention-policies)
13. [Common API Patterns](#common-api-patterns)
14. [Useful System Properties](#useful-system-properties)

---

## Core AI Agent Tables

### 1. sn_aia_agent -- AI Agent Definitions

Stores AI Agent definitions including reasoning strategy, execution mode, and system instructions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Agent display name |
| description | String | Yes | Agent purpose description |
| instructions | String | Yes | System prompt / instructions provided to the LLM for this agent |
| active | Boolean | Yes | Whether agent is enabled |
| strategy | Reference | Yes | Reference to `sn_aia_strategy` -- the reasoning strategy this agent uses |
| execution_mode | Choice | No | `copilot` (interactive, user-supervised) or `autopilot` (fully automated) |
| type | Choice | No | `chat` (conversational), `voice` (telephony), `external` (API-driven) |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_agent`

**Notes:**
- The `strategy` field is a reference to `sn_aia_strategy`, not a plain string. When creating via API, pass the sys_id of the desired strategy record.
- `execution_mode` defaults to `copilot` if not specified. Autopilot agents execute without user confirmation prompts.
- `type` determines the interaction channel. Most custom agents use `chat`.

---

### 2. sn_aia_tool -- Tool Definitions

Stores AI Agent tool configurations including scripts, schemas, and execution behavior.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier (can be pre-generated for deterministic deployment) |
| name | String | Yes | Human-readable tool name |
| internal_name | String | Yes | Unique internal identifier (used in code references) |
| description | String | Yes | What this tool does (shown to the agent during reasoning) |
| active | Boolean | Yes | Whether tool is enabled |
| script | Script | Conditional | Tool implementation (IIFE format); required for `script` tool_type |
| input_schema | JSON String | Yes | Input parameters definition |
| output_schema | JSON String | Yes | Output structure definition |
| tool_type | Choice | Yes | Determines execution mechanism (see values below) |
| execution_mode | Choice | No | `copilot` (UI: Supervised — requires user approval) or `autopilot` (UI: Autonomous — auto-executes) |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_tool`

**tool_type Values:**

| Value | Description |
|-------|-------------|
| `script` | Custom server-side JavaScript (IIFE) |
| `catalog_item` | Executes a Service Catalog item |
| `flow_action` | Triggers a Flow Designer action |
| `subflow` | Triggers a Flow Designer subflow |
| `record_operation` | CRUD operations on ServiceNow records |
| `search_retrieval` | Searches AI Search or other retrieval sources |
| `web_search` | Performs external web search |
| `knowledge_graph` | Queries ServiceNow Knowledge Graph |
| `now_assist_skill` | Invokes a Now Assist skill as a tool |
| `conversational_topic` | Routes to a Virtual Agent conversational topic |
| `desktop_action` | Triggers a UI action on the agent workspace |
| `file_upload` | Handles file upload operations |
| `mcp_server_tool` | Invokes a tool from a registered MCP server |

**Input Schema Format:**
```json
[{"name": "field_name", "type": "string", "mandatory": true, "description": "What this parameter is for"}]
```

**Supported schema types:** `string`, `number`, `boolean`, `array`, `object`

---

### 3. sn_aia_agent_tool_m2m -- Agent-to-Tool Mapping

Many-to-many relationship linking agents to their available tools.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| agent | Reference | Yes | Reference to `sn_aia_agent` |
| tool | Reference | Yes | Reference to `sn_aia_tool` |
| name | String | Yes | Display name of the mapping — mirrors the tool name in practice, so both `tool.name` and `tool.tool.name` dot-walks from `sn_aia_tools_execution` resolve to the tool name (verified gpinst01, Zurich P10) |
| active | Boolean | Yes | Whether this mapping is active |
| max_auto_executions | Integer | No | Maximum number of times this tool can auto-execute without user confirmation in a single conversation turn |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_agent_tool_m2m`

**Notes:**
- `max_auto_executions` applies only when the tool's `execution_mode` is `autopilot` (UI: Autonomous). A value of 0 or empty means unlimited.
- Deactivating a mapping (`active=false`) removes the tool from the agent's available tool list without deleting the tool definition itself.

---

### 4. sn_aia_usecase -- Agentic Workflows

Defines agentic workflows (use cases). A use case maps to a **team** of agent peers plus a reasoning **strategy** -- there is no single "orchestrator agent" field.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Use case display name |
| description | String | Yes | What this workflow accomplishes |
| active | Boolean | Yes | Whether use case is enabled |
| team | Reference | Yes | Reference to `sn_aia_team` -- the team of agents that fulfills this use case |
| strategy | Reference | — | Reference to `sn_aia_strategy` -- the reasoning strategy applied (defaults to ReAct) |

> **Verified (Zurich Patch 8):** There is **no `sn_aia_usecase.orchestrator_agent` field** (0/313 agents on the verified instance reference a parent/orchestrator field). The use case points at a `team`; the team's agents are **flat peers** in `sn_aia_team_member` (no order/rank field). Hierarchy, where it exists, is expressed via `sn_aia_agent_child` (a separate parent→child agent relationship), not on the use case.

**API Endpoint:** `GET/POST /api/now/table/sn_aia_usecase`

**Canonical topology:** `sn_aia_usecase → sn_aia_team → sn_aia_team_member` (agent peers) `→ sn_aia_agent → agent-tool m2m → sn_aia_tool` (+ `sn_aia_agent_child` for explicit hierarchy).

**Notes:**
- The team -- not a designated orchestrator agent -- is the unit of coordination; the platform-run ReAct loop dispatches across the team's members.
- Use cases serve as the top-level entry point for trigger configurations.
- A single team can back multiple use cases.

---

### 5. sn_aia_strategy -- Reasoning Strategies

Defines the reasoning strategies available for AI Agents.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Strategy name |
| description | String | No | What this strategy does and when to use it |

**API Endpoint:** `GET /api/now/table/sn_aia_strategy`

**Known Strategy Records:**

| Name | Description | Best For |
|------|-------------|----------|
| ReAct | Reason-Act loop; reasons about what to do, acts, observes result, repeats | Most use cases; reliable tool calling |
| ReActivePlanner | Plans all steps upfront, then executes sequentially | Multi-step deterministic workflows |
| CoPilot | Interactive user assistance with confirmation prompts | User-facing chat agents (~86% of OOTB agents) |
| AutoPilot | Fully automated execution without user intervention | Background processing (~7% of OOTB agents) |

**Notes:**
- Strategy records are typically seeded by the platform. Avoid creating custom strategies unless you have deep understanding of the agent runtime.
- Agents reference strategies via the `strategy` field on `sn_aia_agent`.

---

### 6. sn_aia_team -- Agent Teams

Groups of agents that can collaborate on tasks.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Team name |
| description | String | No | Team purpose and scope |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_team`

---

### 7. sn_aia_team_member -- Team Membership

Maps agents to teams for collaborative workflows.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| team | Reference | Yes | Reference to `sn_aia_team` |
| agent | Reference | Yes | Reference to `sn_aia_agent` |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_team_member`

**Notes:**
- An agent can belong to multiple teams.
- Team membership determines which agents the orchestrator can delegate to in multi-agent workflows.

---

### 8. sn_aia_trigger_configuration -- Trigger Configurations

Defines how agentic workflows (use cases) are triggered. **Field names below are
schema-verified against the live `sn_aia_trigger_configuration` table (Zurich Patch 8).**

| Field | Type | Description |
|-------|------|-------------|
| sys_id | GUID | Unique identifier |
| usecase | Ref → `sn_aia_usecase` | Use case this trigger belongs to |
| trigger_flow_definition_type | String | `record_create`, `record_create_or_update`, `ui_action`, `scheduled`, … |
| target_table | Table name | Target table for record triggers |
| condition | Conditions | Encoded query |
| trigger_flow | Ref → `sys_hub_flow` | Platform-generated flow — populated **asynchronously** post-insert by the "Create Flow Trigger Action" BR (may take seconds; not set synchronously on install) |
| business_rule | Ref → `sys_script` | Nullable; observed unpopulated for **all** current trigger types (appears platform-reserved/unused) |
| channel | Ref → `sys_cs_channel` | Deployment channel |
| objective_template | Email script | Agent objective template |
| active | Boolean | Whether the trigger is active |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_trigger_configuration`

**trigger_flow_definition_type Values:**

| Value | Description |
|-------|-------------|
| `record_create` | Triggered when a record is inserted on `target_table` matching `condition` |
| `record_create_or_update` | Triggered on insert **or** update on `target_table` matching `condition` |
| `ui_action` | Triggered by a UI action |
| `scheduled` | Triggered on a schedule |

**Async flow generation (verified):** `trigger_flow` is **not** written synchronously. Four
Business Rules on `sn_aia_trigger_configuration` (all in **Global** scope) drive the lifecycle:
**Create Flow Trigger Action** (async_always / insert → `AIATriggerScopedUtil.createFlowTriggerAction()`),
**Update Flow Trigger Action** (async_always / update), **Delete Flow Trigger Action** (before / delete),
and **Process AIA trigger** (after). There is **no** meta-flow. If `trigger_flow` is still null
immediately after an SDK install, the async BR has not run yet — see the troubleshooting guide entry.

---

### 9. sn_aia_agent_config -- Agent Proficiency Configuration

Controls which agents are active per proficiency level or context.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| agent | Reference | Yes | Reference to `sn_aia_agent` |
| active | Boolean | Yes | Whether this agent configuration is active |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_agent_config`

**Notes:**
- Used to enable/disable agents at a system level independent of the agent's own `active` flag.
- Useful for A/B testing and staged rollouts.

---

## Execution Tables

### 10. sn_aia_execution_plan -- Execution Plans

Tracks plan-level executions. This is the top-level execution record; tasks, tool executions, and messages all reference it (fields verified gpinst01, Zurich P10).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| conversation | Reference | No | Reference to `sys_cs_conversation` — links the plan to the chat session (there is no `conversation_id` string column) |
| state | Choice | Auto | `queued`, `ready`, `in_progress`, `wrap_up`, `completed`, `terminated`, `abandoned`, `deleted` — there is **no** `failed` state; failures surface as `terminated` plus a `state_reason` |
| state_reason | Choice | Auto | Why the plan left the happy path (see values below) |
| status | Choice | Auto | Coarse outcome: `success`, `error` |
| run_type | Choice | Yes | How the execution was initiated (see values below) |
| agent | Reference | No | Reference to `sn_aia_agent` — set on single-agent runs |
| usecase | Reference | No | Reference to `sn_aia_usecase` — set on agentic workflow runs |
| team | Reference | No | Reference to `sn_aia_team` |
| related_task_record | Document ID | No | The task record that triggered or is associated with this execution |
| related_task_table | Table Name | No | Table of the related task record (e.g., `incident`, `sc_task`) |
| objective | String | No | The objective handed to the planner |
| context | String | No | Additional execution context (serialized JSON) |

**API Endpoint:** `GET /api/now/table/sn_aia_execution_plan`

**run_type Values (verified gpinst01, Zurich P10 — stored values are lowercase):**

| Value | Description |
|-------|-------------|
| `api` | Triggered via REST API |
| `chat` | Triggered by user chat interaction |
| `evaluation` | Triggered by an evaluation/test harness |
| `testing` | Triggered during testing/QA |
| `trigger` | Triggered by a `sn_aia_trigger_configuration` |
| `a2a` | Triggered by an agent-to-agent (A2A) call |

**state_reason Values (verified gpinst01, Zurich P10):**

| Value | Meaning |
|-------|---------|
| `security_violation` | Terminated because the invoking (run-as) user failed the agent's or workflow's access checks — the trace signature of ACL–trigger misalignment (trigger fires as a user whose role is not in the agent/workflow User Access or Data Access roles) |
| `planning_failed` | The planner could not produce an execution plan |
| `execution_failed` | A step failed during execution |
| `no_activity` | Execution ended for inactivity |
| `fallback_redirected` | Redirected to fallback handling |
| `live_agent_requested` | User asked for a live agent |
| `user_exited` | User left the conversation |

**Latency/token observability fields (verified gpinst01, Zurich P10):** the plan record also carries `execution_time_ms`/`execution_time_sec`, `system_execution_time_ms`/`system_execution_time_sec`, `llm_p95_latency`, `tool_p95_latency`, and `llm_token_avg` — the starting point for slow-agent diagnosis. See [Agent Performance Debugging](./agent-performance-debugging.md).

**Relationships:**
- **Parent of** `sn_aia_execution_task` -- Each plan contains one or more step tasks, linked via the task's `execution_plan` field.
- **Parent of** `sn_aia_tools_execution` -- Tool call records reference the plan via `execution_plan_id` (note the `_id` suffix — the column name differs from the one on the task table).
- **Parent of** `sn_aia_message` -- Messages reference the plan via their `execution_plan` field.
- **Linked to** `sys_cs_conversation` -- via the plan's `conversation` reference (conversational runs only).
- **Linked to** `sn_aia_agent` -- The plan's `agent` reference identifies the agent on single-agent runs; workflow runs set `usecase`/`team` instead, and per-step agent identity lives on `type=agent` execution tasks (see section 11).

**API Query Patterns:**
```bash
# Get all execution plans for a specific agent (plan-level agent reference; single-agent runs)
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_execution_plan?sysparm_query=agent=AGENT_SYS_ID&sysparm_fields=sys_id,state,state_reason,run_type,sys_created_on"

# Get execution plan with its tasks and tool calls in one view
# Step 1: Get the plan for a chat session (conversation = sys_cs_conversation sys_id)
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_execution_plan?sysparm_query=conversation=CONVERSATION_SYS_ID"
# Step 2: Get tasks for that plan (order is the step sequence)
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_execution_task?sysparm_query=execution_plan=PLAN_SYS_ID&sysparm_orderby=order"
# Step 3: Get tool executions for that plan (field is execution_plan_id here; no step_number column — order by sys_created_on)
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_tools_execution?sysparm_query=execution_plan_id=PLAN_SYS_ID&sysparm_orderby=sys_created_on"
```

**Pre-Zurich Migration Notes:**
- In Vancouver/Washington, execution tracking used `sn_aia_agent_execution` (singular, flat structure). Zurich replaced this with the plan/task hierarchy.
- The old `sn_aia_agent_execution` table stored agent, status, and tool calls in a single record. Zurich separates these into `sn_aia_execution_plan` (run-level), `sn_aia_execution_task` (per-step: planner, agent, tool, LLM, and user-response steps — see section 11), and `sn_aia_tools_execution` (per-tool-call).
- If migrating queries from pre-Zurich, replace `sn_aia_agent_execution` references with a join across `sn_aia_execution_plan` and `sn_aia_execution_task`.
- The plan `sys_id` is the correlation hub in Zurich: tasks (`execution_plan`), tool executions (`execution_plan_id`), and messages (`execution_plan`) all reference it. The plan links to the chat session via its `conversation` reference — there is no `conversation_id` string column anywhere in this hierarchy.

---

### 11. sn_aia_execution_task -- Execution Tasks

Individual step records within an execution plan — one per planner, agent, tool, or LLM step (fields verified gpinst01, Zurich P10). There is **no `agent` reference field on this table**: agent identity is carried by `type=agent` rows in `description`/`metadata`, and by the plan-level `agent`/`usecase` references.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| execution_plan | Reference | Yes | Reference to `sn_aia_execution_plan` |
| type | Choice | Auto | Step kind: `agent`, `tool`, `gen_ai`, `communicator`, `manager`, `access_verification` |
| status | Choice | Auto | `queued`, `ready`, `ongoing`, `success`, `error`, `cancelled` — there are no `pending`/`running`/`completed`/`failed` values |
| description | String | No | Human-readable step name — the agent name on `type=agent` rows, the tool name on `type=tool` rows, `AIA ReAct Engine` on `type=gen_ai` rows |
| parent | Reference | No | Self-reference to the parent task — builds the step hierarchy |
| order | Integer | Auto | Step sequence within the plan |
| metadata | JSON String | No | Step details — on `type=agent` rows an `agentDetails` object (name, role, sys_id, strategy); on `type=tool` rows the tool id/name/inputs |
| output | String | No | Step output |
| execution_time_ms | Integer | Auto | Step duration in milliseconds |
| start_time / end_time | Date/Time | Auto | Step execution window |
| task_dependencies | List | No | Other execution tasks this step depends on |

**API Endpoint:** `GET /api/now/table/sn_aia_execution_task`

**Relationships:**
- **Child of** `sn_aia_execution_plan` -- Every task belongs to exactly one plan.
- **Agent identity** -- recorded on `type=agent` rows (`description` = agent name; `metadata.agentDetails` = name/role/sys_id/strategy), not via a reference field. The queryable reference to `sn_aia_agent` lives on the plan (`sn_aia_execution_plan.agent`, single-agent runs).
- **Linked to** `sn_aia_gen_ai_m2m` -- Maps execution tasks to Gen AI log metadata for LLM call traceability.

**API Query Patterns:**
```bash
# Which agents ran in a plan (agent steps carry the name in description/metadata)
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_execution_task?sysparm_query=execution_plan=PLAN_SYS_ID^type=agent&sysparm_fields=description,status,order,metadata"

# Error steps across all plans in the last 24 hours (the choice value is error — "failed" does not exist)
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_execution_task?sysparm_query=status=error^sys_created_on>=javascript:gs.daysAgoStart(1)&sysparm_fields=type,description,status,execution_plan,sys_created_on"

# Find runs where an agent participated as a WORKFLOW member (plan.agent is empty on
# workflow runs) — match the agent name on type=agent task rows, or query plans by usecase
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_execution_task?sysparm_query=type=agent^description=AGENT_NAME&sysparm_fields=execution_plan,status,order,sys_created_on"
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_execution_plan?sysparm_query=usecase=USECASE_SYS_ID&sysparm_fields=sys_id,state,state_reason,sys_created_on"
```

**Notes:**
- A single execution plan contains multiple execution tasks — planner (`manager`), per-agent (`agent`), per-tool (`tool`), LLM (`gen_ai`), and user-response (`communicator`) steps, sequenced by `order` and nested via `parent`.
- To filter executions by agent **across** plans, query `sn_aia_execution_plan.agent` (single-agent runs). On workflow runs `plan.agent` is empty — match `type=agent` task rows by `description` (agent name) or query plans by `usecase` instead (see the recipes above); task rows identify the agent only through the `description`/`metadata` strings.
- This table did not exist prior to Zurich. In Vancouver/Washington, agent identity was tracked on the single `sn_aia_agent_execution` record. The Zurich task model enables multi-agent orchestration where different agents handle different steps within a single plan.

---

### 12. sn_aia_tools_execution -- Tool Execution Records

Tracks individual tool calls within an execution plan, including inputs, outputs, timing, and errors (fields verified gpinst01, Zurich P10).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| execution_plan_id | Reference | Yes | Reference to `sn_aia_execution_plan` (note the `_id` suffix — the column is not named `execution_plan`) |
| tool | Reference | Auto | Reference to `sn_aia_agent_tool_m2m` (the agent–tool mapping). There is no `tool_name` string column — get the name via dot-walk: `tool.name` or `tool.tool.name` |
| request | JSON | Auto | Tool input |
| response | JSON | Auto | Tool output |
| execution_status | Choice | Auto | `success`, `error`, `cancelled`, `timeout`, `processing` |
| is_error | Boolean | Auto | True when the call errored |
| error_message | String | No | Error details if execution failed |
| execution_time_ms | Integer | Auto | Call duration in milliseconds |
| execution_time_sec | Integer | Auto | Call duration in seconds |
| execution_mode | Choice | Auto | `sync`, `async` |
| run_as_user | Reference | No | The `sys_user` the tool executed as — the field to check when debugging ACL/trigger-identity failures such as `state_reason=security_violation` (see the failed-execution triage in the [Troubleshooting Guide](./troubleshooting-guide.md)) |
| status | String | Auto | Plain string, empty on live records — use `execution_status` instead |
| mode | String | Auto | Plain string, empty on live records — use `execution_mode` instead |

**API Endpoint:** `GET /api/now/table/sn_aia_tools_execution`

**DATA RETENTION:** Records in this table expire after **~13 months** -- enforced by an active `sys_auto_flush` Table Cleaner (age 34,187,400 s ≈ 395 days on `sys_created_on`, verified Zurich P10); no installed retention-property row was found on the verified instance (code-level recognition of such a name is unverified). Plan accordingly for any long-term analytics or auditing needs. Export data before expiration if required.

**Notes:**
- This table provides the most detailed view of what an agent actually did during execution.
- There is **no `step_number` column** — reconstruct the call order with `sys_created_on` (the corresponding `sn_aia_execution_task` rows carry an `order` field if you need explicit sequencing).
- Query by `execution_plan_id` to get all tool calls for a given run.

---

### 13. sn_aia_message -- Conversation Messages

Stores individual messages in AI agent conversations, including both user and agent messages (fields verified gpinst01, Zurich P10).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| execution_plan | Reference | Yes | Reference to `sn_aia_execution_plan` — the run linkage (there is no `conversation_id` string column) |
| role | Choice | Yes | Message author role: `user`, `agent`, `history`, `user_profile` — **not** the LLM-style `user`/`assistant`/`system`/`tool` set |
| type | Choice | No | `conversational`, `error`, `warning` |
| name | String | No | Author name — carries the emitting agent's name on `role=agent` messages (e.g., `Orchestrator`) |
| message | String | No | Agent-side message content (platform field label is "System message" — there is no `system` role) |
| user_message | String | No | User message content |
| message_sequence | Counter | Auto | Sequencing counter — order messages by this field |
| error_type | Choice | No | Failure classification on error messages (see values below) |
| persona | String | No | Persona associated with the message |
| document_name / document_table | Document ID / Table Name | No | Source record the message relates to |

**API Endpoint:** `GET /api/now/table/sn_aia_message`

**Notes:**
- Messages are ordered by `message_sequence` to reconstruct conversation flow — there is no `order` column.
- Query by `execution_plan` to pull all messages for one run; on `role=agent` rows, `name` tells you which agent spoke.
- Useful for debugging agent behavior by reviewing the full conversation history.

**error_type Values (verified gpinst01, Zurich P10):** error messages (`type=error` — filter by `type`, not by a `system` role, which does not exist) carry an `error_type` choice that classifies the failure a message reports — a fast triage signal before opening the full trace:

| Value | Meaning |
|-------|---------|
| `tool_failure` | A tool call failed |
| `execution_error` | The execution itself errored |
| `llm_error` | The generative AI call failed |
| `permission_denied` | Access check blocked the operation |
| `solver_error` | The solver/planner component errored |
| `retry_limit` | Retry limit exhausted (see `sn_aia.react_failure_retry_max_limit`) |
| `refiner_failure` | Response refinement failed |
| `system_error` | Platform-level error |

---

### 13a. sys_gen_ai_log_metadata -- Gen AI Call Metadata

One record per generative AI call made during an execution (global scope; verified gpinst01, Zurich P10). Linked to execution tasks via `sn_aia_gen_ai_m2m` (see section 11) and to the full prompt/response content via `gen_ai_log_id`.

| Field | Type | Description |
|-------|------|-------------|
| sys_id | GUID | Unique identifier |
| gen_ai_log_id | Reference | Reference to `sys_generative_ai_log` — the full prompt and response content |
| conversation | Reference | Reference to `sys_cs_conversation` |
| skill_config_id | Reference | Reference to `sn_nowassist_skill_config` when the call served a NASK skill |
| prompt_config_id | Reference | Reference to `sys_generative_ai_prompt_config` |
| definition | Reference | Reference to `sys_one_extend_capability_definition` (mandatory) |
| model_name / model_version | String | Which model served the call |
| prompt_token_count | Integer | Prompt size for this call — direct measure of instruction + scratchpad load |
| response_token_count | Integer | Response size |
| time_taken | Integer | Duration of the call |
| started_at / completed_at | Date/Time | Call window |
| status / error / error_code | String | Call outcome and failure detail |

**API Endpoint:** `GET /api/now/table/sys_gen_ai_log_metadata`

**Notes:**
- This is the per-call layer of the execution trace: plan → task → (this table) → `sys_generative_ai_log`. Use it to find failed or malformed LLM calls that make an agent stall, and to read exact per-call token counts when diagnosing latency ([Agent Performance Debugging](./agent-performance-debugging.md)).
- `sys_generative_ai_log.prompt` shows the fully rendered prompt — the authoritative check for template-interpolation defects (see Build Rule #39 in `sdk-reference.md`).

---

## Now Assist Skill Tables

### 14. sys_one_extend_capability -- Capability Registration

Registers a skill as a Now Assist capability. This is the root record that other skill tables reference.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Pre-generate | Capability identifier (pre-generate for deterministic deployment) |
| name | String | Yes | Skill display name |
| description | String | Yes | Skill description (shown in Now Assist admin) |
| type | String | Yes | Usually `"skill"` |
| active | Boolean | Yes | Whether capability is active |

**API Endpoint:** `GET/POST /api/now/table/sys_one_extend_capability`

---

### 15. sn_nowassist_skill_config -- Skill Configuration

Skill metadata and configuration settings linking to a registered capability.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Pre-generate | Config identifier |
| name | String | Yes | Skill name |
| description | String | Yes | Skill description |
| active | Boolean | Yes | Whether skill is active |
| skill_type | String | Yes | Skill classification, e.g., `"agentic"`, `"generative"`, `"search"` |
| capability | Reference | Yes | Reference to `sys_one_extend_capability` |

**API Endpoint:** `GET/POST /api/now/table/sn_nowassist_skill_config`

---

### 16. sys_generative_ai_config -- LLM Prompt/Model Settings

Configures the LLM prompt template and model association for a skill or AI feature.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Pre-generate | Config identifier |
| name | String | Yes | Configuration name |
| active | Boolean | Yes | Whether config is active |
| prompt | String | Yes | System prompt template for the LLM |
| model | Reference | No | Reference to the LLM model record (sys_id); if empty, uses system default |

**API Endpoint:** `GET/POST /api/now/table/sys_generative_ai_config`

**Notes:**
- The `prompt` field supports template variables using `${variable}` syntax.
- When `model` is not specified, the platform default LLM is used.
- Multiple configs can exist per skill for different contexts or versions.

---

### 17. sys_one_extend_capability_definition -- Capability Definitions

Defines the API interface for a capability. **CRITICAL** for skill discoverability.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Pre-generate | Definition identifier |
| capability | Reference | Yes | Reference to `sys_one_extend_capability` |
| api | document_id | **CRITICAL** | Polymorphic ref to the backing API record (majority backed by `sys_hub_flow`) — must be set or skill is not discoverable |
| api_type | String | **CRITICAL** | API type -- must be set or skill is not discoverable |

**API Endpoint:** `GET/POST /api/now/table/sys_one_extend_capability_definition`

**CRITICAL:** Both the `api` and `api_type` fields **MUST** be set. If either is empty or missing, the skill will not appear in Now Assist panels and will not be invocable. This is the most common cause of "skill not found" issues.

> **No own `active` field (verified Zurich P8).** `sys_one_extend_capability_definition` has **no
> own `active` column** — the earlier "active Boolean" row was fabricated. A definition's
> active/inactive state is read by dot-walking through the `api` `document_id` to the backing flow:
> `api.active` → `sys_hub_flow.active` (inherited from `sys_hub_flow_base`). ⚠️ **REST-only:** the
> `api.active` dot-walk resolves through the **Table REST API**; GlideScript `getValue('api.active')`
> returns **null** (verified on 100/100 sampled records). Use this as a provider health-check
> preflight — see `skills/now-assist-skill-builder/SKILL.md` → Testing Checklist.

---

### 18. sys_one_extend_definition_config -- Definition Configuration

Configuration for a capability definition. Controls whether this definition is the active/default one.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| definition | Reference | Yes | Reference to `sys_one_extend_capability_definition` |
| default | Boolean | **CRITICAL** | **Must be `true`** -- otherwise the skill configuration will not load |
| active | Boolean | Yes | Whether this config is active |

**API Endpoint:** `GET/POST /api/now/table/sys_one_extend_definition_config`

**CRITICAL:** The `default` field **MUST** be set to `true`. If `false` or unset, the platform will not load the associated skill configuration, and the skill will appear registered but non-functional. This is the second most common cause of skill deployment failures.

---

### 19. sys_one_extend_definition_attribute -- Input/Output Attributes

Defines the input and output parameters of a skill capability.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| definition | Reference | Yes | Reference to `sys_one_extend_capability_definition` |
| name | String | Yes | Attribute name (parameter name) |
| type | String | Yes | Data type: `"string"`, `"reference"`, `"boolean"`, `"integer"`, `"json"` |
| value | String | Yes | Attribute value or default value |

**API Endpoint:** `GET/POST /api/now/table/sys_one_extend_definition_attribute`

**Notes:**
- Attributes define the contract between the skill caller and the skill implementation.
- Input attributes specify what data the skill expects; output attributes specify what it returns.
- The `type` field determines validation and serialization behavior.

---

## GenAI Controller Tables

> **Naming reality check (verified via `sys_db_object` on gpinst01, Zurich P10 HF3, 2026-07-29).**
> Four table names historically associated with the GenAI Controller -- `sys_genai_skill`,
> `sn_gai_skill`, `sys_genai_prompt_template`, `sys_genai_skill_version` -- do **not** exist on
> Zurich. There is no `sys_genai_*` or `sn_gai_*` table family at all. The GenAI Controller's
> real footprint is the global-scope `sys_generative_ai_*` / `sys_gen_ai_*` / `sys_one_extend_*`
> family: skill/capability definitions live in the Now Assist chain (sections 14-19), and the
> sections below cover the prompt-config and call-log side of that same chain.

### 20. GenAI Controller Table Map -- Real Tables vs. Legacy Names

| If you were looking for... | Use instead (verified on Zurich) |
|----------------------------|----------------------------------|
| `sys_genai_skill` / `sn_gai_skill` (skill definitions) | `sys_one_extend_capability` (section 14) + `sn_nowassist_skill_config` (section 15) |
| `sys_genai_prompt_template` (prompt templates) | `sys_generative_ai_prompt_config` (section 21), which selects a `sys_generative_ai_config` whose `prompt` field holds the template (section 16) |
| `sys_genai_skill_version` (skill versioning) | No dedicated version table -- behavior versioning happens through the capability definition chain (section 17) |

Other verified GenAI Controller tables (all global scope): `sys_gen_ai_provider`,
`sys_gen_ai_provider_routing`, `sys_gen_ai_feature_group`, `sys_gen_ai_feature_mapping`,
`sys_gen_ai_filter` / `sys_gen_ai_filter_group`, `sys_gen_ai_usage_log`,
`sys_gen_ai_log_metadata` (section 13a), `sys_gen_ai_log_detail`.

---

### 21. sys_generative_ai_prompt_config -- Prompt Config Selection

Selects which `sys_generative_ai_config` (prompt + model settings) serves a capability
definition. Global scope, extends `sys_metadata`. Fields verified on Zurich P10:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| ai_config | Reference | Yes | Reference to `sys_generative_ai_config` -- the prompt/model settings this record selects (mandatory) |
| definition | Reference | No | Reference to `sys_one_extend_capability_definition` |
| is_default | Boolean | No | Whether this is the default config for the definition |
| order | Integer | No | Selection order when multiple configs match |
| filter_type | Choice | No | How `filter_properties` is interpreted |
| filter_properties | Name-values | No | Property filter controlling when this config applies |

**API Endpoint:** `GET /api/now/table/sys_generative_ai_prompt_config`

---

### 22. sys_generative_ai_log -- LLM Call Log (Rendered Prompt + Response)

One record per LLM call, holding the fully rendered prompt. This is the content layer behind
`sys_gen_ai_log_metadata` (section 13a), which links here via `gen_ai_log_id`. Global scope.
Key fields (verified on Zurich P10; the table has 40+ columns):

| Field | Type | Description |
|-------|------|-------------|
| definition | Reference | Reference to `sys_one_extend_capability_definition` (mandatory) |
| prompt | String | Fully rendered prompt -- the authoritative check for template-interpolation defects (Build Rule #39 in `sdk-reference.md`) |
| untranslated_prompt | String | Prompt before localization |
| model_name / model_version | String | Which model served the call |
| status | String | Call outcome |
| error / error_code | String | Failure detail |
| prompt_token_count / response_token_count | Integer | Token usage for the call |
| time_taken | Integer | Call duration |
| started_at / completed_at | Date/Time | Call window |
| prompt_config_id | Reference | Reference to `sys_generative_ai_prompt_config` (section 21) |
| skill_config_id | Reference | Reference to `sn_nowassist_skill_config` when the call served a NASK skill |
| gen_ai_usage_log | Reference | Reference to `sys_gen_ai_usage_log` |
| conversation | Reference | Reference to `sys_cs_conversation` |
| metadata_table / metadata_document | Table name / Document ID | Polymorphic link to the record the call was about |
| feedback / edited_response | String | User feedback signals |

**API Endpoint:** `GET /api/now/table/sys_generative_ai_log`

---

## Group Action Framework (GAF) Tables

The Group Action Framework clusters related records and applies AI-driven actions to groups. Used for incident clustering, similar case detection, and bulk action recommendations.

### 23. sn_gaf_record_group -- Record Groups

Clusters of related records identified by the GAF clustering algorithm.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Auto | Group display name |
| table | String | Yes | Source table for grouped records (e.g., `incident`) |
| state | Choice | Auto | Group state (e.g., `active`, `closed`) |
| record_count | Integer | Auto | Number of records in this group |

**API Endpoint:** `GET /api/now/table/sn_gaf_record_group`

---

### 24. sn_gaf_record_group_detail -- Group Detail Records

Individual records belonging to each group.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| record_group | Reference | Yes | Reference to `sn_gaf_record_group` |
| record_id | String | Yes | sys_id of the grouped record |
| table | String | Yes | Table name of the grouped record |
| similarity_score | Decimal | Auto | How similar this record is to the group representative |

**API Endpoint:** `GET /api/now/table/sn_gaf_record_group_detail`

---

### 25. sn_gaf_action_strategy_result -- Strategy Results

Results from representative record selection within a group. Identifies the most representative record.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| record_group | Reference | Yes | Reference to `sn_gaf_record_group` |
| representative_record | String | No | sys_id of the selected representative record |
| strategy | String | Yes | Strategy used for selection |
| result | String | No | Strategy execution result details |

**API Endpoint:** `GET /api/now/table/sn_gaf_action_strategy_result`

---

### 26. sn_gaf_action_mapper_result -- Mapper Results

Maps new incoming records to existing clusters based on similarity.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| record_group | Reference | Yes | Reference to the matched `sn_gaf_record_group` |
| source_record | String | Yes | sys_id of the new record being mapped |
| source_table | String | Yes | Table name of the new record |
| confidence | Decimal | Auto | Mapping confidence score (0.0 to 1.0) |

**API Endpoint:** `GET /api/now/table/sn_gaf_action_mapper_result`

---

### 27. sn_gaf_action_reducer_result -- Reducer Results

AI-generated insights and summaries for entire clusters of records.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| record_group | Reference | Yes | Reference to `sn_gaf_record_group` |
| insight | String | Auto | AI-generated insight or summary for the group |
| action_recommendation | String | No | Recommended action for the group |

**API Endpoint:** `GET /api/now/table/sn_gaf_action_reducer_result`

---

## MCP Client Tables

ServiceNow's built-in MCP (Model Context Protocol) client tables for managing external tool server integrations.

### 28. sn_mcp_execution_logs -- MCP Execution Logs

Tracks request/response logs for MCP server interactions. Scope `sn_mcp_client`. Fields verified on Zurich P10 (gpinst01, 2026-07-29):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| method | String | Auto | MCP method called (e.g., `tools/call`, `tools/list`) |
| request | JSON | Auto | Full request payload. For `tools/call`, the tool identity lives **inside this payload** -- there is no `tool_name` column |
| response | JSON | Auto | Full response payload |
| mcp_server | Reference | Yes | Reference to `sn_mcp_server` (mandatory) |
| session | Reference | Yes | Reference to `sn_mcp_client_server_session_mapping` (mandatory) |
| execution_status | Choice | Auto | `success`, `error` (verified `sys_choice` -- no `failure`/`timeout` values, and no plain `status` column) |
| execution_id | String | Auto | Correlates the log rows belonging to one execution |
| sequence | Auto-number | Auto | Monotonic ordering of log rows |
| error_message | String | Auto | Failure detail when `execution_status = error` |
| flow_context | Reference | No | Reference to `sys_flow_context` when the call originated from a flow |

**API Endpoint:** `GET /api/now/table/sn_mcp_execution_logs`

**Notes:**
- There is **no `duration` column**. Compute latency from `sys_created_on` deltas across `sequence`-ordered rows, or use the AI Agent trace layer.
- To find which tool was called, filter on `method=tools/call` and parse the `request` JSON.

---

### 29. sn_mcp_client_server_session_mapping -- Session Mappings

Maps client sessions to MCP servers, tracking connection state and negotiated capabilities. Scope `sn_mcp_client`. Fields verified on Zurich P10 (there are **no** `server`, `session_id`, `capability`, or `state` columns):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| mcp_server | Reference | Yes | Reference to `sn_mcp_server` (mandatory) |
| mcp_session_id | String | Auto | MCP protocol session identifier |
| status | Choice | Auto | `connected`, `disconnected`, `error` (verified `sys_choice`) |
| server_name | String | Auto | Server name reported at handshake |
| server_version | String | Auto | Server version reported at handshake |
| protocol_version | String | Auto | Negotiated MCP protocol version |
| capabilities_support | JSON | Auto | Capabilities advertised by the server at handshake |
| user | Reference | No | Reference to `sys_user` -- sessions are per-user by default (`sn_mcp_client.mcp_session_id.unique_per_user = true`) |
| error_message | String | Auto | Connection failure detail |

**API Endpoint:** `GET /api/now/table/sn_mcp_client_server_session_mapping`

---

### 30. sn_mcp_server -- MCP Server Registry

Registry of configured MCP servers that ServiceNow can connect to as a client. Scope `sn_mcp_client`, extends `sys_metadata` (it is a config record). Verified on Zurich P10 -- the table has only **two** business columns:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Server name |
| connection_alias | Reference | Yes | Reference to `sys_alias` (Connection & Credential alias). The endpoint URL and authentication live on the aliased connection/credential records -- **not** on this table (there are no `url`, `active`, `description`, or `auth_type` columns) |

**API Endpoint:** `GET/POST /api/now/table/sn_mcp_server`

**Notes:**
- MCP servers registered here can be consumed by AI Agents via tools with `tool_type = mcp_server_tool`.
- The platform manages session lifecycle automatically; use `sn_mcp_client_server_session_mapping` to monitor active connections.

---

## Agent Properties Table

### 31. sn_aia_property -- Agent Behavior Properties

System properties that affect AI Agent behavior at the platform level.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Property name (dot-notation key) |
| value | String | Yes | Property value |
| description | String | No | What this property controls |
| type | String | No | Value type (string, integer, boolean) |

**API Endpoint:** `GET /api/now/table/sn_aia_property`

**Notes:**
- These properties override system defaults for AI Agent behavior.
- Changes take effect immediately without server restart.
- See the [Useful System Properties](#useful-system-properties) section for common property names.

---

## Analytics and Reporting Tables

### 32. sn_aia_report_metric -- Report Metrics

Stores computed metrics for AI Agent reporting dashboards.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| metric_name | String | Yes | Name of the metric |
| metric_value | String | Yes | Computed metric value |
| agent | Reference | No | Reference to `sn_aia_agent` (if agent-specific) |
| period | String | No | Reporting period |
| computed_on | DateTime | Auto | When this metric was last computed |

**API Endpoint:** `GET /api/now/table/sn_aia_report_metric`

---

### 33. sn_aia_gen_ai_m2m -- Execution-to-GenAI Log Mapping

Many-to-many mapping between execution tasks and Gen AI log metadata for traceability.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| execution_task | Reference | Yes | Reference to `sn_aia_execution_task` |
| gen_ai_log | Reference | Yes | Reference to Gen AI log metadata record |

**API Endpoint:** `GET /api/now/table/sn_aia_gen_ai_m2m`

**Notes:**
- Provides the link between agent execution records and the underlying LLM call logs.
- Essential for debugging prompt/response issues and token usage analysis.
- Gen AI logs have their own retention policy (see [Data Retention Policies](#data-retention-policies)).

---

### 34. sys_agent_access_role_configuration -- Agent Access Roles

Configures which roles have access to specific AI Agents (fields verified gpinst01, Zurich P10; global scope, extends `sys_metadata`).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Configuration name |
| agent | Document ID | Yes | The agent record — a document_id, not a typed reference; pair with `agent_table` |
| agent_table | Table Name | Yes | Table of the agent record (e.g., `sn_aia_agent`) |
| action | Choice | Yes | `limit_to_roles` (only active choice value) |
| role_list | List | No | Glide list of `sys_user_role` references — the roles granted access. There is no singular `role` reference or `access_type` column (see Build Rule #21 / issues #188, #194 on phantom-GUID defects around this field) |
| allow_all_session_roles | Boolean | No | Grant access to all roles in the user's session |
| description | String | No | Free-text description |

**API Endpoint:** `GET /api/now/table/sys_agent_access_role_configuration`

**Notes:**
- Controls user access to agents in Now Assist panels and chat interfaces.
- Without a role configuration, agents may not be visible to non-admin users.
- When auditing access, query `role_list` (e.g., `role_listLIKE<role_sys_id>`) — filtering on a `role` column matches nothing because that column does not exist.

---

## Relationship Diagram

```
                           ┌──────────────────────┐
                           │   sn_aia_strategy     │
                           └──────────┬───────────┘
                                      │ (strategy)
                                      ▼
┌──────────────┐          ┌──────────────────────┐          ┌──────────────────┐
│ sn_aia_team  │          │    sn_aia_agent       │          │   sn_aia_tool    │
└──────┬───────┘          └──┬──────┬──────┬─────┘          └────────┬─────────┘
       │                     │      │      │                         │
       ▼                     │      │      │                         │
┌──────────────────┐         │      │      │     ┌───────────────────────────────┐
│sn_aia_team_member│◄────────┘      │      └────►│  sn_aia_agent_tool_m2m        │◄──┘
└──────────────────┘                │            └───────────────────────────────┘
                                    │
              ┌─────────────────────┼──────────────────────────┐
              │                     │                          │
              ▼                     ▼                          ▼
┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐
│ sn_aia_agent_config  │  │ sn_aia_usecase   │  │ sys_agent_access_role_config  │
└─────────────────────┘  └────────┬─────────┘  └──────────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────────┐
                    │sn_aia_trigger_configuration   │
                    └──────────────────────────────┘

                    === Execution Flow ===

┌──────────────────────────┐
│  sn_aia_execution_plan   │ (top-level; chat session via `conversation` ref)
└──┬──────────┬────────────┘
   │          │
   ▼          ▼
┌────────────────────┐  ┌─────────────────────────┐  ┌────────────────────┐
│sn_aia_execution_task│  │ sn_aia_tools_execution  │  │  sn_aia_message    │
└────────┬───────────┘  └─────────────────────────┘  └────────────────────┘
  (execution_plan)         (execution_plan_id)         (execution_plan)
         │
         ▼
┌─────────────────────┐
│ sn_aia_gen_ai_m2m   │──► Gen AI Log Metadata
└─────────────────────┘

                    === Now Assist Skill Chain ===

┌────────────────────────────┐
│ sys_one_extend_capability  │  (root)
└──┬─────────┬───────────────┘
   │         │
   ▼         ▼
┌──────────────────────────┐  ┌──────────────────────────────────────┐
│sn_nowassist_skill_config │  │sys_one_extend_capability_definition  │
└──────────────────────────┘  └──┬──────────────┬───────────────────┘
                                 │              │
┌────────────────────────┐       ▼              ▼
│sys_generative_ai_config│  ┌─────────────────────────────────┐  ┌────────────────────────────────────┐
└────────────────────────┘  │sys_one_extend_definition_config │  │sys_one_extend_definition_attribute │
                            └─────────────────────────────────┘  └────────────────────────────────────┘

                    === GenAI Controller (config + logging) ===

┌─────────────────────────────────┐ (ai_config)  ┌──────────────────────────┐
│ sys_generative_ai_prompt_config │─────────────►│ sys_generative_ai_config │
└──┬──────────────────────────────┘              └──────────────────────────┘
   │ (definition)
   ▼
┌──────────────────────────────────────┐
│ sys_one_extend_capability_definition │
└──────────────────────────────────────┘
   ▲ (definition)
┌──┴─────────────────────┐ (gen_ai_log_id)   ┌─────────────────────────┐
│ sys_gen_ai_log_metadata│◄──────────────────│  sys_generative_ai_log  │
└────────────────────────┘   (via metadata)  │  (also refs definition, │
                                             │  prompt_config_id,      │
                                             │  skill_config_id)       │
                                             └─────────────────────────┘

                    === Group Action Framework ===

┌───────────────────────┐
│ sn_gaf_record_group   │
└──┬────┬────┬────┬─────┘
   │    │    │    │
   ▼    │    │    ▼
┌────────────────────────────┐  ┌───────────────────────────────────┐
│sn_gaf_record_group_detail  │  │sn_gaf_action_strategy_result     │
└────────────────────────────┘  └───────────────────────────────────┘
        │    │
        ▼    ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│sn_gaf_action_mapper_result   │  │sn_gaf_action_reducer_result  │
└──────────────────────────────┘  └──────────────────────────────┘

                    === MCP Client ===

┌──────────────────┐ (connection_alias)  ┌───────────┐
│  sn_mcp_server   │────────────────────►│ sys_alias │ (URL + auth live on the aliased
└──────────────────┘                     └───────────┘  connection/credential records)
         ▲ (mcp_server)
┌────────┴───────────────────────────────────┐
│ sn_mcp_client_server_session_mapping       │
└────────────────────────────────────────────┘
         ▲ (session; rows also carry their own mcp_server ref)
┌────────┴───────────────────────┐ (flow_context)  ┌──────────────────┐
│    sn_mcp_execution_logs       │────────────────►│ sys_flow_context │
└────────────────────────────────┘                 └──────────────────┘
```

---

## Domain Separation

All AI Agent tables support **Basic** domain separation.

**Support Type:** Basic

**Key behavior:**
- Every table listed in this reference includes a `sys_domain` field.
- Records are scoped to the domain of the user who created them.
- Queries automatically filter by the caller's domain unless `sysparm_domain=global` is specified.
- Global domain records (domain = `global`) are visible to all domains.
- When creating records via API, the `sys_domain` field is set automatically based on the session domain. To create records in a specific domain, set the domain context before the API call.

**Practical implications for multi-domain instances:**
- Agents created in Domain A are not visible to users in Domain B.
- Tools can be shared across domains by creating them in the global domain.
- Execution records inherit the domain of the agent that ran.
- Skill registrations (`sys_one_extend_capability`) are typically global-scoped.

---

## Table Name Variants by Version

ServiceNow has renamed several AI-related tables across releases. When writing code that must work across versions, probe for table existence before querying.

| Zurich Table Name | Previous Names (Vancouver/Washington) | Notes |
|-------------------|---------------------------------------|-------|
| `sn_aia_execution_plan` | `sn_aia_agent_execution` | Zurich renamed to plan-centric model |
| `sn_aia_execution_task` | (new in Zurich) | Did not exist in earlier versions |
| `sn_aia_tools_execution` | `sn_aia_tool_execution` | Note: plural "tools" in Zurich |
| `sn_aia_message` | (new in Zurich) | Message history was embedded in execution records previously |
| `sn_aia_usecase` | (new in Zurich) | Agentic workflows/orchestration is a Zurich feature |
| `sn_aia_team` | (new in Zurich) | Multi-agent teams are a Zurich feature |
| `sn_aia_trigger_configuration` | (new in Zurich) | Trigger-based workflows are a Zurich feature |
| `sn_mcp_server` | (new in Zurich) | MCP Client support is a Zurich feature |

**Recommended probe pattern:**
```javascript
// Try Zurich table name first, fall back to legacy
function getTableName(zurichName, legacyName) {
    try {
        var gr = new GlideRecord(zurichName);
        gr.setLimit(1);
        gr.query();
        return zurichName;
    } catch (e) {
        return legacyName;
    }
}

var executionTable = getTableName('sn_aia_execution_plan', 'sn_aia_agent_execution');
var toolExecTable = getTableName('sn_aia_tools_execution', 'sn_aia_tool_execution');
```

---

## Data Retention Policies

Different AI tables have different data retention windows. Plan data exports and archival strategies accordingly.

| Table | Retention Period | Notes |
|-------|-----------------|-------|
| `sn_aia_tools_execution` | **~13 months** | Enforced by an active `sys_auto_flush` Table Cleaner (age 34,187,400 s ≈ 395 days on `sys_created_on`, verified Zurich P10) -- no installed `sn_aia.execution.retention_days` row was found on the verified instance (code-level recognition unverified). Export before expiration for long-term analysis. |
| `sn_aia_report_metric` | **13 months** | `sys_auto_flush` cleaner with condition `start_date` older than 13 months (verified Zurich P10). |
| Gen AI Logs (LLM call logs) | **6 months** | Includes prompt/response pairs, token counts, latency. Linked via `sn_aia_gen_ai_m2m`. |
| `sn_aia_execution_plan` | No auto-expiration | Retained indefinitely, but consider archival for performance. |
| `sn_aia_execution_task` | No auto-expiration | Retained indefinitely. |
| `sn_aia_message` | No auto-expiration | Retained indefinitely, but can grow large on active instances. |
| `sn_mcp_execution_logs` | Table cleaner | An active `sys_auto_flush` cleaner record exists for this table (verified Zurich P10). There is **no** `sn_mcp.log.retention_days` property -- check the `sys_auto_flush` record on your instance for the configured age. |

**Recommendations:**
- Set up scheduled exports for `sn_aia_tools_execution` if you need data older than 13 months.
- Monitor table growth on `sn_aia_message` for high-volume instances.
- Use `sn_aia_gen_ai_m2m` to join execution tasks to Gen AI logs before the 6-month window closes.
- Consider creating a mid-table (e.g., custom reporting table) for long-term KPI tracking.

---

## Common API Patterns

### REST API Base URL
```
https://{instance}.service-now.com/api/now/table/{table_name}
```

### Authentication
```bash
# Basic Auth
curl -u "username:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_agent"

# Bearer Token (OAuth)
curl -H "Authorization: Bearer ${TOKEN}" \
  "https://instance.service-now.com/api/now/table/sn_aia_agent"
```

### Create Record (POST)
```bash
curl -X POST -u "admin:password" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name":"My Agent","active":"true","instructions":"You are a helpful agent."}' \
  "https://instance.service-now.com/api/now/table/sn_aia_agent"
```

### Query with Filters (GET)
```bash
# Get all active agents with specific fields
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_agent?sysparm_query=active=true&sysparm_fields=name,sys_id,execution_mode&sysparm_limit=10"
```

### Query Execution History
```bash
# Get tool executions for a chat session (conversation = sys_cs_conversation sys_id)
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_tools_execution?sysparm_query=execution_plan_id.conversation=CONVERSATION_SYS_ID&sysparm_fields=tool.name,request,response,execution_status,execution_time_ms&sysparm_orderby=sys_created_on"
```

### Query Agent Tools
```bash
# Get all tools mapped to a specific agent
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_agent_tool_m2m?sysparm_query=agent=AGENT_SYS_ID&active=true&sysparm_fields=tool.name,tool.internal_name,tool.tool_type"
```

### Create a Complete Skill (Multi-Step)
```bash
# Step 1: Create capability
CAPABILITY_ID=$(uuidgen)
curl -X POST -u "admin:password" \
  -H "Content-Type: application/json" \
  -d "{\"sys_id\":\"${CAPABILITY_ID}\",\"name\":\"My Skill\",\"type\":\"skill\",\"active\":\"true\"}" \
  "https://instance.service-now.com/api/now/table/sys_one_extend_capability"

# Step 2: Create capability definition (CRITICAL: set api and api_type)
DEFINITION_ID=$(uuidgen)
curl -X POST -u "admin:password" \
  -H "Content-Type: application/json" \
  -d "{\"sys_id\":\"${DEFINITION_ID}\",\"capability\":\"${CAPABILITY_ID}\",\"api\":\"my_api\",\"api_type\":\"my_type\",\"active\":\"true\"}" \
  "https://instance.service-now.com/api/now/table/sys_one_extend_capability_definition"

# Step 3: Create definition config (CRITICAL: default=true)
curl -X POST -u "admin:password" \
  -H "Content-Type: application/json" \
  -d "{\"definition\":\"${DEFINITION_ID}\",\"default\":\"true\",\"active\":\"true\"}" \
  "https://instance.service-now.com/api/now/table/sys_one_extend_definition_config"
```

### Batch Operations with sysparm_exclude_reference_link
```bash
# Faster queries by excluding reference link metadata
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_agent?sysparm_exclude_reference_link=true&sysparm_limit=100"
```

---

## Useful System Properties

### AI Agent Core Properties

The `sn_aia.*` property namespace is real and large (81 `sys_properties` records on gpinst01, Zurich P10 HF3, 2026-07-29), but several names that circulate in docs and LLM lore have no installed rows (see the callout after the table). Live-verified properties:

| Property | Observed Value | Description |
|----------|----------------|-------------|
| `sn_aia.continuous_tool_execution_limit` | `25` | Max consecutive executions of the **same** tool before the loop stops. **Developer-editable**, not a hard platform cap. (There is no `sn_aia.max_iterations` property.) |
| `sn_aia.react_failure_retry_max_limit` | `3` | Max retries after a failure in ReAct execution (pairs with `error_type=retry_limit`, section 13) |
| `sn_aia.quick_mode_failure_retry_max_limit` | `3` | Max retries after a failure in Quick Mode execution |
| `sn_aia.supported_tools` | `action,flow,subflow,script,capability,rag,knowledge_graph,crud` | Tool types routed through the Glide Java execution layer |
| `sn_aia.agent_parallel_tool_execution.enabled` | `true` | Enables parallel tool execution |
| `sn_aia.maximum_agent_tools` | `20` | Max tools that can be associated with a single AI agent |
| `sn_aia.agent_orchestration_threshold` | `30` | Minimum number of agents required to enable dynamic orchestration |
| `sn_aia.continuous_communicator_output_limit` | `5` | Max consecutive user-facing output messages the orchestrator or agent can trigger |
| `sn_aia.episodic_memory_limit` | `5` | Max episodic memories injected into the prompt when an agent is invoked (allowed values <= 5) |
| `sn_aia.max_scheduled_trigger_query` | `10` | Max target records queried per scheduled trigger run |
| `sn_aia.deep_research_limits` | JSON object | Global limits for deep-research retrieval, planning, and reflection (subquery/reflection/chunk-size/search-result limits) |

**No `sys_properties` rows were found for these names** on the verified instance (probed by exact name on gpinst01, Zurich P10 HF3, 2026-07-29 -- zero rows): `sn_aia.log.level`, `sn_aia.max_tokens`, `sn_aia.timeout`, `sn_aia.tool.timeout`, `sn_aia.tool.max_output_size`, `sn_aia.agent.max_context_tokens`, `sn_aia.agent.default_strategy`, `sn_aia.execution.retention_days`. Whether platform code recognizes any of these names (via `gs.getProperty` with a code-level default -- see the `glide.servlet.uri` note below for a property that behaves exactly this way) is **unverified**, as is how (or whether) the implied behaviors are configured. Do not cite these names or their previously documented defaults as fact. Two replacements ARE verified: the reasoning strategy is configured per agent (`sn_aia_agent.strategy`), and tool-execution retention is a `sys_auto_flush` Table Cleaner (see [Data Retention Policies](#data-retention-policies)).

### Now Assist Properties

The real Now Assist property namespaces on Zurich are `sn_nowassist_va.*`, `sn_nowassist_admin.*`, `sn_nowassist_gs.*`, and `sn_nowassist_sgc.*` (55 live records on gpinst01, 2026-07-29). No installed `now_assist.*` rows and no `sn_nowassist.skill.timeout` row exist -- previously documented names `now_assist.enabled`, `now_assist.panel.enabled`, `now_assist.skill.debug`, and `sn_nowassist.skill.timeout` have zero `sys_properties` records on the verified instance; whether platform code recognizes them is **unverified**, so do not cite them or their previously documented defaults as fact. Live-verified examples:

| Property | Observed Value | Description |
|----------|----------------|-------------|
| `sn_nowassist_va.automatic_session_interval` | `300` | Refreshes the VA session ID after this interval (seconds) |
| `sn_nowassist_va.max_aia_conversational_tool_iteration` | `10` | Max consecutive executions of one tool in the AIA - Conversational strategy |
| `sn_nowassist_va.aia_conversational.max_user_turns` | `9` | Prior user turns (excluding the current query) added to the Conversational ReAct prompt |
| `sn_nowassist_va.transcript_message_read_limit_conversation_history` | `50` | `sys_cs_message` rows read to build `sys_gen_ai_message_history` |
| `sn_nowassist_va.nass_streaming_enabled` | `true` | Enables response streaming in Now Assist |
| `sn_nowassist_va.websearch_fallback_enabled` | `no_response_from_aisearch,no_response_from_llm` | Conditions under which the VA falls back to web search |

Note: `glide.servlet.uri` (instance base URL) is a real platform property but typically has **no** `sys_properties` record -- `gs.getProperty("glide.servlet.uri")` returns the derived instance URI even when unset (verified absent on gpinst01).

### GenAI Controller Properties

**No `sys_genai.*` properties exist** (verified against `sys_properties` on gpinst01, Zurich P10 HF3, 2026-07-29 -- zero rows). Model selection, prompt limits, and provider behavior are configured through records, not properties: `sys_generative_ai_config` (prompt/model settings, section 16), `sys_gen_ai_provider` / `sys_gen_ai_provider_routing` (provider selection), and `sys_gen_ai_model_availability`. Gen AI log retention is likewise not controlled by a `sys_genai.log.retention_days` property.

### MCP Client Properties

Live-verified on Zurich P10 (gpinst01, 2026-07-29). The real properties use the `sn_mcp_client.*` / `sn_mcp_server.*` prefixes -- there are **no** `sn_mcp.enabled`, `sn_mcp.log.retention_days`, `sn_mcp.session.timeout`, or `sn_mcp.max_concurrent_sessions` properties:

| Property | Observed Value | Description |
|----------|----------------|-------------|
| `sn_mcp_client.mcp_session_id.unique_per_user` | `true` | MCP sessions are tracked per user |
| `sn_mcp_client.cursor.max_iterations` | `10` | Max pagination iterations when a server returns cursored results |
| `sn_mcp_client.wait_for_server_connection_close` | `true` | Client waits for the server connection to close cleanly |
| `sn_mcp_server.mcp_supported_sku_platforms` | `prime` | SKU platforms on which MCP server support is enabled |
| `sn_mcp_server.sys_restricted_mcp_category_access` | `true` | Restricts access to MCP server categories |
| `sn_mcp_server.preprocess_allowed_skill_ids` | (sys_id list) | Skills allowed to preprocess MCP traffic |

### Performance and Debugging Properties

Live-verified (gpinst01, Zurich P10 HF3, 2026-07-29):

| Property | Observed Value | Description |
|----------|----------------|-------------|
| `sn_aia.enable_perf_logs` | `false` | Enables AI Agent performance logging |
| `sn_aia.enable_conversational_debugger` | `false` | Enables Conversational Debugging in AIA Studio -- shows the Analysis button in the Testing Playground |
| `sn_aia.glide_react_enabled` | `false` | Toggles the Glide implementation of the AIA-ReAct topic |

**No `sys_properties` rows were found for these names** on the verified instance (probed by exact name, zero rows): `sn_aia.debug.trace_enabled`, `sn_aia.debug.log_tool_io`, `sn_aia.cache.strategy_ttl`, `sn_aia.metrics.enabled`. Whether platform code recognizes them is **unverified**; live executions have been observed writing to the `sn_aia_execution_*` tables (sections 10-13) without any opt-in, but "tracing cannot be disabled" is **not established** by these probes. `sn_aia_report_metric` retention is enforced by a 13-month `sys_auto_flush` condition (verified; no retention-property row installed -- code-level recognition unverified, see [Data Retention Policies](#data-retention-policies)).

---

*This reference is validated against ServiceNow Zurich instances. Table names and field availability may vary across versions. See the [Table Name Variants by Version](#table-name-variants-by-version) section for cross-version compatibility guidance.*
