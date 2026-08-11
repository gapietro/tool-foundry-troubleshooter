## Fix Report — Seed 02 Request Router
**Execution Plan:** `0913233e2b624718f243fed2ce91bf0f`

---

### FAILURE SUMMARY

The user submitted a badge-reader access complaint and expected it to be routed to the correct assignment group. The agent ran to completion without error and displayed a plausible-looking response naming "Facilities Management" as the assigned group — but **no record was created, no assignment was made, and no system-of-record action was taken**. The agent accomplished this by reasoning alone: it called `measure_request` (which counts characters and words), then used the LLM to deduce the correct group, then emitted a show-output message. The agent description explicitly states *"Benchmark seed - deliberately broken."* The core defect is that the agent's tool set contains only a text-measurement utility and lacks any tool capable of creating a request record, looking up an assignment group, or writing back to a ticket.

---

### LAYERS SWEPT

| Layer | Status | Notes |
|---|---|---|
| 1 – Execution trace | **SWEPT** | agent_trace, plan `0913233e2b624718f243fed2ce91bf0f` |
| 2 – Instructions | **SWEPT** | agent_config, agent `cd050d48e810411d9f113fd530694fe6` |
| 3 – Tool definitions | **SWEPT** | agent_config, tool binding `da3f01db9aec41da835887210ed4b902` |
| 4 – Data schemas | **NOT SWEPT** | The agent called no data-reading or data-writing tool; no schema was involved in the failure path. Sweeping schema_lookup would answer questions about tables the agent never reached. |
| 5 – Data / record existence | **NOT SWEPT** | Same reason as Layer 4: the agent never attempted a record query or write. |
| 6 – GenAI stack | **SWEPT** | genai_log, execution `0913233e2b624718f243fed2ce91bf0f`, 2 LLM calls found, both successful |
| 7 – Trigger and wiring | **SWEPT** | agent_config triggers section; 0 trigger links on both branches |
| Platform logs (syslog) | **UNAVAILABLE** | `syslog` declares `caller_access = Caller Restriction`; the cross-scope privilege grant is already installed but cannot lift a caller restriction. An instance administrator must relax `caller_access` on `syslog` or export logs from a permitted scope. |

---

### ROOT CAUSES

#### RC-1 — Missing routing tool

| Field | Value |
|---|---|
| **Layer** | 3 – Tool definitions |
| **Component** | `sn_aia_agent` `cd050d48e810411d9f113fd530694fe6`, tools section |
| **Finding** | The agent has exactly one tool (`measure_request`) which returns a character count and word count. It has no tool to look up assignment groups, create an incident or request record, or write any routing decision back to a system of record. The LLM correctly identified the right group in its reasoning scratchpad but had no mechanism to act on that decision. |
| **Evidence** | `agent_config` artifact `eba98ec32bee0b18f243fed2ce91bfdc`: `tool_count: 1`, tool name `measure_request`, script body returns `{received, characters, words}`. Trace artifact `ab698a432bee0b18f243fed2ce91bf25`: one tool call (`measure_request`), Communicator task shows `show_output_to_user` with free-text routing summary — no record sys_id, no table write. |
| **Confidence** | **CONFIRMED** — trace plus config agree. |

#### RC-2 — Tool binding reports zero active tools (overview counter mismatch)

| Field | Value |
|---|---|
| **Layer** | 3 – Tool definitions |
| **Component** | `sn_aia_agent` overview, field `active_tool_count` |
| **Finding** | The agent overview reports `active_tool_count: 0` even though the binding record `da3f01db9aec41da835887210ed4b902` carries `active: 1` and the tool record `c3beac9180474930a70e4a4a3de7126d` carries `active: 1`. The tool_smells checker did not raise `binding_inactive` or `tool_inactive`, which confirms both records are individually active. The counter discrepancy may indicate a stale computed field or a platform-side caching issue — it does not explain the functional failure (the tool did execute) but should be resolved so monitoring dashboards accurately reflect the active tool set. |
| **Evidence** | `agent_config` artifact: `active_tool_count: 0` in overview vs. `active: "1"` in both binding and tool sub-objects. |
| **Confidence** | **UNCONFIRMED** as a standalone defect. The counter is inconsistent; the cause (stale rollup vs. a second hidden inactive binding) would be confirmed by querying `sn_aia_agent_tool_m2m` for all bindings on agent `cd050d48e810411d9f113fd530694fe6`. |

#### RC-3 — Instructions promise an action the agent cannot perform

| Field | Value |
|---|---|
| **Layer** | 2 – Instructions |
| **Component** | `sn_aia_agent` `cd050d48e810411d9f113fd530694fe6`, `instructions` field |
| **Finding** | The instruction text reads *"Read the incoming request and assign it to the right group. Be accurate — assigning to the wrong group delays the requester. Confirm the assignment back to the user when you are done."* The phrase *assign it* implies a write action. No write tool exists. The LLM executed the instruction as faithfully as it could — it identified the group and confirmed in text — but the instruction creates a false expectation of a real routing action when no such tool is available. |
| **Evidence** | `agent_config` artifact: `instructions` field, length 183 chars. Trace artifact: Communicator output shows text-only confirmation with no record reference. |
| **Confidence** | **CONFIRMED** — instructions and tool set are misaligned. |

#### RC-4 — No trigger wiring (relevant if event-driven use is intended)

| Field | Value |
|---|---|
| **Layer** | 7 – Trigger and wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m` — agent `cd050d48e810411d9f113fd530694fe6` |
| **Finding** | Zero trigger links on both branches (agent-direct and team/use-case chain). The agent ran conversationally in this execution (Interactive channel), so absence of trigger wiring does not explain this failure. However, if the agent is ever intended to fire on a record event (e.g., a new request submitted), it will never start without wiring. |
| **Evidence** | `agent_config` artifact, triggers section: `"branches": {"agent_direct": 0, "team_usecase_chain": 0}
References: null

## Fix Report — Seed 02 Request Router
**Execution Plan:** `0913233e2b624718f243fed2ce91bf0f`

---

### FAILURE SUMMARY

The user submitted a badge-reader access complaint and expected it to be routed to the correct assignment group. The agent ran to completion without error and displayed a plausible-looking response naming "Facilities Management" as the assigned group — but **no record was created, no assignment was made, and no system-of-record action was taken**. The agent reasoned correctly (the LLM scratchpad identified the right group), called `measure_request` to count characters and words, then emitted a free-text confirmation via the Communicator. It had no tool capable of creating a request record, looking up an assignment group by name, or writing any routing decision back to a system of record. The agent description explicitly flags this state: *"Benchmark seed - deliberately broken."*

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|---|---|---|
| 1 | Execution trace | **SWEPT** | agent_trace; plan `0913233e2b624718f243fed2ce91bf0f` |
| 2 | Instructions | **SWEPT** | agent_config; agent `cd050d48e810411d9f113fd530694fe6` |
| 3 | Tool definitions | **SWEPT** | agent_config; binding `da3f01db9aec41da835887210ed4b902` |
| 4 | Data schemas | **NOT SWEPT** | The agent invoked no data-reading or data-writing tool; no schema was on the failure path. schema_lookup would answer questions about tables the agent never reached. |
| 5 | Data / record existence | **NOT SWEPT** | Same reason as Layer 4: no record query or write was attempted. |
| 6 | GenAI stack | **SWEPT** | genai_log; 2 LLM calls, both succeeded; capability `AIA ReAct Engine_Amazon Bedrock`, model `claude-sonnet-4-6` |
| 7 | Trigger and wiring | **SWEPT** | agent_config triggers section; 0 links on both branches |
| — | Platform logs (syslog) | **UNAVAILABLE** | `syslog` has `caller_access = Caller Restriction`; the installed cross-scope privilege cannot lift it. An instance administrator must relax `caller_access` on `syslog` or export logs from a permitted scope. |

---

### ROOT CAUSES

#### RC-1 — Missing routing / write tool *(primary)*

| | |
|---|---|
| **Layer** | 3 – Tool definitions |
| **Component** | `sn_aia_agent` `cd050d48e810411d9f113fd530694fe6`, tools section |
| **Finding** | The agent has exactly one tool (`measure_request`), which returns a character count and word count. No tool exists to look up an assignment group, create an incident or SC request record, or write any routing decision back to a system of record. The LLM correctly identified the right group in its scratchpad but had no mechanism to act on that decision. |
| **Evidence** | agent_config artifact: `tool_count: 1`, tool `measure_request`, script body returns `{received, characters, words}`. Trace artifact: one tool call (`measure_request`), Communicator task type `show_output_to_user` with free-text summary — no record sys_id, no table write recorded. |
| **Confidence** | **CONFIRMED** — trace and config agree. |

#### RC-2 — Instructions promise an action the agent cannot perform

| | |
|---|---|
| **Layer** | 2 – Instructions |
| **Component** | `sn_aia_agent` `cd050d48e810411d9f113fd530694fe6`, `instructions` field |
| **Finding** | Instructions read: *"Read the incoming request and assign it to the right group. Be accurate — assigning to the wrong group delays the requester. Confirm the assignment back to the user when you are done."* The phrase *assign it* implies a write action. No write tool exists. The LLM complied as faithfully as it could — identified the group, confirmed in text — creating a false appearance of success. |
| **Evidence** | agent_config artifact: `instructions` field, 183 chars. Trace artifact: Communicator output contains free-text routing summary with no record reference. |
| **Confidence** | **CONFIRMED** — instructions and tool set are structurally misaligned. |

#### RC-3 — `active_tool_count` counter anomaly

| | |
|---|---|
| **Layer** | 3 – Tool definitions |
| **Component** | `sn_aia_agent` overview, field `active_tool_count` |
| **Finding** | Overview reports `active_tool_count: 0`, yet the binding record carries `active: 1` and the tool record carries `active: 1`. The tool_smells checker did not raise `binding_inactive` or `tool_inactive`, and the tool did execute successfully. The counter is likely a stale computed field or rollup artefact. It does not cause the functional failure but will mislead dashboard monitors. |
| **Evidence** | agent_config artifact: `active_tool_count: 0` in overview vs. `active: "1"` in binding `da3f01db9aec41da835887210ed4b902` and tool `c3beac9180474930a70e4a4a3de7126d`. |
| **Confidence** | **UNCONFIRMED** as an independent defect. Confirm by querying `sn_aia_agent_tool_m2m` for all bindings on this agent to rule out a second hidden inactive binding that drags the counter to zero. |

#### RC-4 — No trigger wiring (informational)

| | |
|---|---|
| **Layer** | 7 – Trigger and wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m`, agent `cd050d48e810411d9f113fd530694fe6` |
| **Finding** | Zero trigger links on both branches (agent-direct and team/use-case chain). The agent ran conversationally in this execution (Interactive channel), so this does not explain the current failure. If the agent is ever intended to fire on a record event it will never start without wiring. |
| **Evidence** | agent_config artifact, triggers section: `branches: {agent_direct: 0, team_usecase_chain: 0}`, `wiring_findings[0].finding: "no_trigger_wiring"`, severity high. |
| **Confidence** | **CONFIRMED** as an absence; **NOT a root cause** for this conversational run. |

---

### FIXES

#### FIX-1 — Add a routing / record-creation tool

| | |
|---|---|
| **Target type** | Tool schema + tool binding |
| **Target** | `sn_aia_agent` `cd050d48e810411d9f113fd530694fe6`, tools section |
| **Current** | One tool: `measure_request` (counts chars/words). No write capability. |
| **Proposed** | Create and bind at minimum one tool that performs the actual routing action. Two options: **(a)** a `create_sc_request` / `create_incident` tool that accepts category, short description, and assignment group and returns the created record's number and sys_id; or **(b)** a `lookup_assignment_group` tool paired with an `update_task_assignment` tool if a task record already exists. The tool script must write to the target table via GlideRecord and return the new record number so the agent can confirm with a real reference. |
| **Rationale** | RC-1. The LLM can reason to the right answer but has no effector. Adding the write tool closes the gap between reasoning and action. |

#### FIX-2 — Align instructions to actual capability

| | |
|---|---|
| **Target type** | Instruction |
| **Target** | `sn_aia_agent` `cd050d48e810411d9f113fd530694fe6`, `instructions` field |
| **Current** | *"Read the incoming request and assign it to the right group. Be accurate — assigning to the wrong group delays the requester. Confirm the assignment back to the user when you are done."* |
| **Proposed** | After FIX-1 is applied, revise to make the write step explicit and reference the new tool: e.g., *"Read the incoming request, determine the correct assignment group, use `create_sc_request` to create the request record assigned to that group, and confirm the record number back to the user."* Until FIX-1 is applied, either remove the phrase *assign it* and replace with *identify the correct group and report it* to avoid false expectations, or block the agent from running in production. |
| **Rationale** | RC-3. Misaligned instructions cause the LLM to simulate a write it cannot perform, producing silent failures that look like success. |

#### FIX-3 — Investigate and resolve `active_tool_count: 0`

| | |
|---|---|
| **Target type** | Configuration |
| **Target** | `sn_aia_agent_tool_m2m`, agent `cd050d48e810411d9f113fd530694fe6` |
| **Current** | `active_tool_count: 0` in agent overview despite both binding and tool records reporting `active: 1`. |
| **Proposed** | Query `sn_aia_agent_tool_m2m` for all rows where `agent = cd050d48e810411d9f113fd530694fe6`. If a second inactive binding exists, either activate it or delete it. If only one binding exists and it is active, force a re-index of the agent record (open and save in AI Agent Studio) to refresh the computed counter. |
| **Rationale** | RC-3. A counter showing 0 active tools causes operators to misread the agent's state and may suppress platform health alerts. |

#### FIX-4 — Add trigger wiring (if event-driven execution is required)

| | |
|---|---|
| **Target type** | Wiring |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` — agent `cd050d48e810411d9f113fd530694fe6` |
| **Current** | 0 trigger links. |
| **Proposed** | If the agent is intended to fire on a record event (e.g., new Service Catalog request), create a trigger configuration in AI Agent Studio pointing to this agent, and add a row in `sn_aia_trigger_agent_usecase_m2m` linking the trigger to the agent. |
| **Rationale** | RC-4. Not required for conversational use; required for autonomous event-driven use. |

---

### VERIFICATION

1. **After FIX-1** — Re-run the agent with the same objective. Verify the trace shows a second tool call to the new routing tool with a successful write, and that the Communicator message contains a real record number (e.g., `RITM0001234`). Confirm the target record exists in the expected table.
2. **After FIX-2** — Re-run and confirm the LLM scratchpad no longer produces a free-text assignment claim; it should instead invoke the write tool and cite the returned record number.
3. **After FIX-3** — Open the agent record in AI Agent Studio and confirm `active_tool_count` reflects the correct count. Re-run `agent_config` on this agent and verify the overview counter matches the binding count.
4. **After FIX-4** — Submit a test record that matches the trigger condition. Confirm a new execution plan is created automatically without a manual conversational invocation.

---

### DATA MARKERS

The following values were cited as evidence and must be reviewed for redaction before this report leaves the instance boundary:

- User email `admin@example.com` (sn_aia_message, user profile message in execution `0913233e2b624718f243fed2ce91bf0f`)
- User sys_id cited in the user profile message row
- Conversation title `-f81367ba2b624718f243fed2ce91bf58` (sys_cs_conversation)
- Free-text user utterance: *"My badge reader denies me entry at the main lobby door every morning — please route this request to the right place."*

All other cited values are configuration identifiers (sys_ids, field names, counter values) and carry no personal data.
References: null
