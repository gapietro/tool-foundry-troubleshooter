## Fix Report — Execution Plan `ba4dd38b2b6e4310f243fed2ce91bf62`

---

### FAILURE SUMMARY

The user submitted *"I need a second monitor for my desk on the fourth floor."* The agent **Seed 02 Request Router** is instructed to route requests to assignment groups and confirm the assignment to the user. However, the agent possesses only one tool — `measure_request` — which counts characters and words. It has no tool to query `sys_user_group`, create a task, or write an assignment field on any record. With no routing capability available, the LLM fabricated a group name ("IT Hardware / Facilities"), asserted a routing action that never occurred in the tool call log, and delivered a confident success message. No actual assignment was made. The invented group does not exist in `sys_user_group`. The execution plan shows `state = Completed` / all tasks `Success` because the platform cannot detect that the LLM's answer was hallucinated. The agent description itself reads: *"Benchmark seed - deliberately broken."*

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `agent_trace` on plan `ba4dd38b2b6e4310f243fed2ce91bf62` — 6 tasks, 1 tool call, 0 script errors |
| 2 | Instructions | **SWEPT** | `agent_config` full read — instruction text confirmed |
| 3 | Tool definitions | **SWEPT** | `agent_config` tools section — 1 binding, tool-quality checker ran 15 checks |
| 4 | Data schemas | **SWEPT** | `schema_lookup` on `sys_user_group` — table confirmed, 23 fields |
| 5 | Data | **SWEPT** | `query_table` on `sys_user_group` for the hallucinated group |
| 6 | GenAI stack | **SWEPT** | `genai_log for_execution` (2 LLM calls, both success) + `check_config` (filter unmatched — see RC-4) |
| 7 | Trigger and wiring | **SWEPT** | `agent_config` triggers section — 0 trigger links on both branches; expected for interactive invocation |

**Platform log layer (syslog) — UNAVAILABLE.** `syslog` declares `caller_access = Caller Restriction`. This application cannot lift that restriction (a cross-scope privilege IS declared and confirmed installed; it does not help because an application cannot grant itself access to a caller-restricted table). An instance administrator must either relax `caller_access` on `syslog` or provide a log export. Script errors surfaced *inside* the run are covered by `agent_trace` (zero found).

---

### ROOT CAUSES

---

#### RC-1 — Missing routing/assignment tool ✅ CONFIRMED

- **Layer:** 3 — Tool definitions
- **Component:** `sn_aia_agent` / `sn_aia_agent_tool_m2m` binding set for agent `Seed 02 Request Router`
- **Finding:** The agent has exactly one tool, `measure_request`. That tool counts characters and words. It has no GlideRecord call, no group lookup, and no assignment write. The agent's stated instruction — *"assign it to the right group"* — requires a tool that does not exist.
- **Evidence:**
  - `agent_config` overview: `tool_count: 1`, `tool_binding_rows: 1` (read status `ok`) — exactly one binding, confirmed.
  - Tool script body (`agent_config` artifact, offset 4000): script splits text on spaces and counts words — no GlideRecord, no group lookup, no write.
  - Execution trace (task tree, offset 4000): the only tool call returns `{"received":true,"characters":56,"words":12}`. The LLM's second Gen AI step then names "IT Hardware / Facilities" with **zero** corresponding tool calls.
- **Confidence:** CONFIRMED

---

#### RC-2 — Tool binding is inactive ✅ CONFIRMED

- **Layer:** 3 — Tool definitions
- **Component:** `sn_aia_agent_tool_m2m` record `da3f01db9aec41da835887210ed4b902`, field `active`
- **Finding:** `agent_config` overview reports `active_tool_count: 0` against `tool_count: 1`. The tool ran in this execution (the flag may have been toggled after the run, or the engine bypassed it), but an inactive binding will be excluded from tool selection in future runs, leaving the agent with **zero** callable tools.
- **Evidence:**
  - `agent_config` overview section: `"tool_count":1, "active_tool_count":0`.
  - Tool-quality checker listed `binding_inactive` as one of its 15 checks, confirming the flag is evaluated.
- **Confidence:** CONFIRMED

---

#### RC-3 — Hallucinated group "IT Hardware / Facilities" does not exist ✅ CONFIRMED

- **Layer:** 5 — Data
- **Component:** `sys_user_group`, `name` field
- **Finding:** The group the LLM told the user it had assigned the request to does not exist. The unfiltered row count is 0 — confirmed by `query_table`'s ACL-bypass count. This is a genuine data absence, not an ACL filter.
- **Evidence:**
  - `query_table` on `sys_user_group` with `nameLIKEIT Hardware`: `verdict: genuinely_empty`, `unfiltered_row_count: 0`, `count_status: ok`.
  - Trace communicator task metadata (offset 4000): user-facing message asserts *"Assigned Group: IT Hardware / Facilities"* — no tool call produced this value.
- **Confidence:** CONFIRMED

---

#### RC-4 — GenAI capability definition row not reachable by short name filter ⚠️ UNCONFIRMED

- **Layer:** 6 — GenAI stack
- **Component:** `sys_one_extend_capability_definition`, definition name for the ReAct engine
- **Finding:** `genai_log check_config` with `capability: "AIA ReAct Engine"` returned 0 definitions. The LLM calls **did** succeed (2 calls, both `status: success`, model `claude-sonnet-4-6`), so the capability is functional for this run. The zero result means either the filter does not match the stored definition name, or the definition is in a scoped namespace. The mandatory bindings (capability, api_type, api) could not be verified.
- **Evidence:**
  - `genai_log check_config`: `matched: 0`, `audit_status: empty`.
  - `genai_log for_execution`: `llm_call_rows: 2`, both `status: success`, `definition_name: "AIA ReAct Engine_Amazon Bedrock"`.
- **What would confirm it:** Re-run `genai_log check_config` with `capability: "AIA ReAct Engine_Amazon Bedrock"` (the full stored name) to reach the definition row and verify the three mandatory bindings.
- **Confidence:** UNCONFIRMED

---

#### RC-5 — Tool description quality: thin, no boundary/input/output guidance ✅ CONFIRMED (quality risk)

- **Layer:** 3 — Tool definitions
- **Component:** `sn_aia_tool` `c3beac9180474930a70e4a4a3de7126d`, field `description`
- **Finding:** Three medium-severity tool-quality smells: description is a single short statement (114 chars); no negative guidance (never says when NOT to use it); no input format guidance. These did not cause this run's hallucination but will increase LLM selection error once a routing tool is added.
- **Evidence:** `agent_config` `tool_smells` array (artifact offset 4000–8000): three entries, all `severity: medium`, `confidence: heuristic`.
- **Confidence:** CONFIRMED (quality risk, not primary root cause)

---

### FIXES

---

#### FIX-1 — Create and bind a group-lookup / assignment tool *(primary fix)*

| Field | Value |
|-------|-------|
| **Target type** | Tool definition + tool binding |
| **Target** | New record in `sn_aia_tool`; new binding in `sn_aia_agent_tool_m2m` for agent `cd050d48e810411d9f113fd530694fe6` |
| **Current** | No tool exists that can read `sys_user_group` or write an assignment field on any task table |
| **Proposed** | Create a Script tool (e.g., `lookup_assignment_group`) whose script queries `sys_user_group` by keyword against request category, returns the matched group `sys_id` and `name`, and optionally creates or updates a task record. Bind it to the agent with `active = true`. |
| **Rationale** | Without this tool the LLM has no grounded path to routing and will hallucinate a group name on every run. |

---

#### FIX-2 — Activate the existing `measure_request` binding

| Field | Value |
|-------|-------|
| **Target type** | Configuration |
| **Target** | `sn_aia_agent_tool_m2m` record `da3f01db9aec41da835887210ed4b902`, field `active` |
| **Current** | `active_tool_count: 0` (binding inactive) |
| **Proposed** | Set `active = true` |
| **Rationale** | An inactive binding is excluded from tool selection. Even though `measure_request` is insufficient on its own, it must remain active while the routing tool is developed and added. |

---

#### FIX-3 — Seed the required assignment group in `sys_user_group`

| Field | Value |
|-------|-------|
| **Target type** | Data |
| **Target** | `sys_user_group` table |
| **Current** | No group matching "IT Hardware" exists (`unfiltered_row_count: 0`, `verdict: genuinely_empty`) |
| **Proposed** | Create (or confirm the canonical name of) the hardware/facilities assignment group that requests of this type should route to. Ensure the name is stable and discoverable by the lookup tool in FIX-1. |
| **Rationale** | Even with a correctly built routing tool, it will return empty if the target group record does not exist. |

---

#### FIX-4 — Expand the `measure_request` tool description

| Field | Value |
|-------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `c3beac9180474930a70e4a4a3de7126d`, field `description` |
| **Current** | `"Measures an incoming request: returns its character count and an approximate word count. Give it the request text."` |
| **Proposed** | Expand to three sections: **(1) Purpose** — what the tool does; **(2) Understanding Tool Inputs** — name, type, and format of each input; **(3) Understanding Tool Outputs and Error Handling** — the shape of the returned JSON and what to do when `received` is false. Add a "Do NOT use this tool to…" boundary sentence naming routing or assignment as outside its scope. |
| **Rationale** | Reduces LLM selection error once a second (routing) tool is present; prevents the model from reaching for `measure_request` in a routing context. |

---

#### FIX-5 — Confirm GenAI capability binding (RC-4 follow-up)

| Field | Value |
|-------|-------|
| **Target type** | Configuration (verification step) |
| **Target** | `sys_one_extend_capability_definition`, definition `AIA ReAct Engine_Amazon Bedrock` |
| **Current** | Definition row not reachable via short-name filter; mandatory bindings unverified |
| **Proposed** | Run `genai_log check_config` with `capability: "AIA ReAct Engine_Amazon Bedrock"`. If the three mandatory bindings (capability, api_type, api) are populated and no `dangling` api is reported, no fix is needed. If any mandatory binding is empty or dangling, populate it per the provider's configuration guide. |
| **Rationale** | Two LLM calls succeeded in this run, so the capability is currently functional — but the definition row was not audited. A configuration drift here would silently break future runs. |

---

### VERIFICATION

1. **After FIX-1 + FIX-2 + FIX-3:** Re-submit the objective *"I need a second monitor for my desk on the fourth floor."* via the same interactive channel. In `agent_trace`, expect: (a) the new routing tool appears in `tool_calls` with `execution_status: Success`; (b) the tool's response contains a real `sys_user_group` `sys_id` and `name`; (c) the communicator message cites the group name returned by the tool, not a fabricated one.
2. **After FIX-4:** Inspect `agent_config` tools section — `description_thin`, `description_no_negative_guidance`, and `description_no_input_guidance` smells should no longer appear.
3. **After FIX-5:** `genai_log check_config` with the full definition name should return `findings: 0`.

---

### DATA MARKERS

The following record data was quoted as evidence above and should be reviewed for redaction before this report leaves the instance:

- User profile message content: user email (`admin@example.com`), user sys_id, first/last name — present in trace message stream (`sn_aia_message` row `874dd38b2b6e4310f243fed2ce91bf68`, role `user_profile`).
- Conversation title (`-3e4d138b2b6e4310f243fed2ce91bf3d`) — low sensitivity but references an internal sys_id.
- All other values cited are configuration fields (sys_ids of tool/binding/agent records), not personal or business data.
References: null
