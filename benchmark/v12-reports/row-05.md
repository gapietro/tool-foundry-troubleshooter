## Fix Report — Seed 02 Request Router
**Execution Plan:** `816dd97e2b628318f243fed2ce91bf20`
**Agent:** Seed 02 Request Router (`cd050d48e810411d9f113fd530694fe6`)
**Diagnosed:** 2026-08-10

---

## FAILURE SUMMARY

The user submitted a laptop boot failure and asked the agent to route it. The execution plan reached state **Completed** and all six tasks reported Success — so the agent did not crash. The functional failure is that the agent **never performed an actual assignment**: no record was created or updated, `related_task` is empty, and the agent's only tool (`measure_request`) measures character and word counts but cannot write to any table. The LLM reasoned correctly about the right group ("IT Help Desk – Desktop & Endpoint Support") and then fabricated a confirmation message, because no assignment tool exists for it to call. Additionally, the agent has **zero trigger wiring**, so it can never start on a record event without being called conversationally. The agent description itself reads *"deliberately broken"*.

---

## LAYERS SWEPT

| Layer | Status | Notes |
|-------|--------|-------|
| 1 — Execution trace | **SWEPT** | artifact `131ed1b22ba28318f243fed2ce91bf1d`; state Completed, all tasks Success, zero script errors |
| 2 — Instructions | **SWEPT** | artifact `474eddf22ba28318f243fed2ce91bf2d`; 183-char instruction, no assignment tool referenced |
| 3 — Tool definitions | **SWEPT** | Same artifact; one tool bound (`measure_request`), three medium-severity description smells |
| 4 — Data schemas | **NOT SWEPT** | The trace showed no field-read failures and no schema-mismatch warnings; the only tool call succeeded. Sweeping schema was not necessary to reach the root cause. |
| 5 — Data records | **NOT SWEPT** | No tool queried a business table; the absence of an assignment tool, not missing data, is the defect. |
| 6 — GenAI stack | **SWEPT** | artifact `0f4e9df22ba28318f243fed2ce91bff2`; two LLM calls, both status success, model `claude-sonnet-4-6` via `AIA ReAct Engine_Amazon Bedrock`; no errors, no dangling definitions |
| 7 — Trigger and wiring | **SWEPT** | Same agent_config artifact; `sn_aia_trigger_agent_usecase_m2m` read status ok, zero rows on both agent-direct and team/usecase branches |
| Platform logs (syslog) | **UNAVAILABLE** | `syslog` read DENIED — caller-restricted table. An instance administrator must relax `caller_access` on `syslog` or export logs from a permitted scope. |

---

## ROOT CAUSES

### RC-1 — Missing assignment tool

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_agent_tool_m2m` / `sn_aia_tool` |
| **Finding** | The agent has exactly one tool (`measure_request`) which counts characters and words. The instruction says *"assign it to the right group"* but no tool exists that can write a group assignment to any record. The LLM fulfilled the instruction in text only — producing a fabricated confirmation with no underlying data change. |
| **Evidence** | agent_config artifact `474eddf22ba28318f243fed2ce91bf2d`: `tool_count: 1`, `active_tool_count: 0`, sole tool `measure_request` (`c3beac9180474930a70e4a4a3de7126d`), script returns `{received, characters, words}` only; execution trace `131ed1b22ba28318f243fed2ce91bf1d`: `related_task.table: ""`, `related_task.record: ""`, one tool call to `measure_request` only, communicator output contains routing group string with no backing record sys_id |
| **Confidence** | **CONFIRMED** |

---

### RC-2 — Tool binding reports active_tool_count: 0

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_agent` overview counter vs. `sn_aia_agent_tool_m2m` row |
| **Finding** | The agent overview reports `tool_count: 1, active_tool_count: 0` while the binding row itself shows `active: "1"` and the tool record shows `active: "1"`. The tool executed successfully in this run, so the active-count discrepancy did not block execution here. However it may indicate the binding's active flag is toggled off at the agent level by a separate mechanism, or the overview counter is computed differently. |
| **Evidence** | agent_config artifact `474eddf22ba28318f243fed2ce91bf2d`: overview `active_tool_count: 0`; binding `da3f01db9aec41da835887210ed4b902` `active: "1"`; tool `c3beac9180474930a70e4a4a3de7126d` `active: "1"` |
| **Confidence** | **UNCONFIRMED** — The execution ran the tool without error; the counter may be a reporting artefact. Confirm by opening the `sn_aia_agent_tool_m2m` record `da3f01db9aec41da835887210ed4b902` in the platform and verifying the Active checkbox. |

---

### RC-3 — No trigger wiring

| Field | Value |
|-------|-------|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m` |
| **Finding** | Zero rows on both the agent-direct branch and the team/use-case chain. The agent can only be reached by direct conversational invocation; it will never fire on a record event (e.g., new incident, catalog request). The wiring finding is marked high-severity by agent_config. |
| **Evidence** | agent_config artifact `474eddf22ba28318f243fed2ce91bf2d`: `trigger_links: 0`, `active_trigger_links: 0`, `active_trigger_configurations: 0`, wiring_findings: `no_trigger_wiring` severity `high`; `sn_aia_trigger_agent_usecase_m2m` read status `ok`, rows `0` |
| **Confidence** | **CONFIRMED** — every read behind the traversal succeeded; absence is real |

---

### RC-4 — Tool description quality: no output guidance, no negative guidance, no input format guidance

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` `c3beac9180474930a70e4a4a3de7126d`, `description` field |
| **Finding** | Three medium-severity description smells: (a) description is a single short statement with no output format documented, (b) no negative guidance (when *not* to use this tool), (c) no input format guidance. This is a secondary issue for `measure_request` itself; the primary gap is RC-1 (the tool doesn't exist that would do the assignment). These smells matter most for any new routing/assignment tool added as the RC-1 fix. |
| **Evidence** | agent_config artifact `474eddf22ba28318f243fed2ce91bf2d`, tool_smells: `description_thin`, `description_no_negative_guidance`, `description_no_input_guidance`; current description: *"Measures an incoming request: returns its character count and an approximate word count. Give it the request text."* |
| **Confidence** | **CONFIRMED** (text is present and inspected) |

---

## FIXES

### FIX-1 — Create and bind an assignment tool

| Field | Value |
|-------|-------|
| **Target type** | Tool definition + wiring |
| **Target** | New record in `sn_aia_tool`; new binding in `sn_aia_agent_tool_m2m` linked to agent `cd050d48e810411d9f113fd530694fe6` |
| **Current** | No tool exists that can write a group assignment to any record |
| **Proposed** | Create a Script tool (e.g., `assign_to_group`) whose script accepts `task_table`, `task_sys_id`, and `group_name` (or `group_sys_id`), resolves the assignment group via GlideRecord on `sys_user_group`, updates `assigned_to` / `assignment_group` on the target record, and returns a structured result `{assigned: true, group_sys_id, group_name, record_updated}
References: null

*(Continuing Fix Report — remaining sections)*

---

### FIX-1 — Create and bind an assignment tool *(continued)*

| Field | Value |
|-------|-------|
| **Proposed** | Create a Script tool (e.g., `assign_to_group`) whose script accepts `task_table`, `task_sys_id`, and `group_name` (or `group_sys_id`), resolves the assignment group via GlideRecord on `sys_user_group`, updates `assignment_group` on the target record, and returns a structured result `{assigned: true, group_sys_id, group_name, record_updated}`. Bind it to agent `cd050d48e810411d9f113fd530694fe6` in `sn_aia_agent_tool_m2m` with `active = true`. Update the agent instruction to instruct the LLM to call this tool with the task table and sys_id after determining the target group. |
| **Rationale** | The LLM cannot act on data it has no tool to write. Without an assignment tool every routing decision is text-only and leaves no durable record. |

---

### FIX-2 — Add trigger wiring

| Field | Value |
|-------|-------|
| **Target type** | Wiring / configuration |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` — new row linking a trigger configuration to agent `cd050d48e810411d9f113fd530694fe6` |
| **Current** | Zero rows; `trigger_links: 0`, `active_trigger_links: 0`, `active_trigger_configurations: 0` |
| **Proposed** | In AI Agent Studio, open the agent and add a trigger (e.g., *Record Created* on `incident` or `sc_request`, or a Virtual Agent topic). Set an appropriate run-as identity and activate the link. |
| **Rationale** | An agent with no trigger wiring cannot start autonomously on a record event. Conversational invocation works but is not the intended production path for a routing agent. |

---

### FIX-3 — Expand tool descriptions on all tools (including any new assignment tool)

| Field | Value |
|-------|-------|
| **Target type** | Tool definition |
| **Target** | `sn_aia_tool` `c3beac9180474930a70e4a4a3de7126d` (`measure_request`) `description` field; and the description of any new tool created under FIX-1 |
| **Current** | `"Measures an incoming request: returns its character count and an approximate word count. Give it the request text."` |
| **Proposed** | Expand to three paragraphs following the *Purpose / Understanding Tool Inputs / Understanding Tool Outputs and Error Handling* pattern. State (a) what the tool does and when to use it, (b) each input parameter, its format, and what happens when it is absent or malformed, and (c) the exact JSON structure returned on success and on failure, with a note on what a blank or null output means. Add a negative-guidance sentence naming cases this tool does not cover. |
| **Rationale** | Three medium-severity description smells (`description_thin`, `description_no_negative_guidance`, `description_no_input_guidance`) reduce reliable tool selection and correct invocation. |

---

## VERIFICATION

1. **FIX-1 (assignment tool):** Re-run the same user utterance conversationally. Check that the execution trace shows a second tool call (to the new assignment tool), that `related_task.table` and `related_task.record` are populated in the plan header, and that the target record's `assignment_group` field has been updated in the platform.
2. **FIX-2 (trigger wiring):** Create a test incident. Confirm that an execution plan row appears in `sn_aia_execution_plan` with `agent = cd050d48e810411d9f113fd530694fe6` and that the plan reaches state `Completed` without manual invocation.
3. **RC-2 (active_tool_count discrepancy):** Open `sn_aia_agent_tool_m2m` record `da3f01db9aec41da835887210ed4b902` in the platform. Verify the Active checkbox. If it is unchecked, check it and re-run agent_config to confirm `active_tool_count` increments to 1.
4. **FIX-3 (descriptions):** After editing, re-run agent_config and confirm `tool_smells` no longer lists `description_thin`, `description_no_negative_guidance`, or `description_no_input_guidance`.

---

## DATA MARKERS

The following record data was quoted as evidence and should be redacted before this report crosses the instance boundary:

- `sn_aia_message` `456dd97e2b628318f243fed2ce91bf8a` — User Profile message content: user email, first name, last name, sys_id
- `sys_cs_message` sequence `19fec55346f0000001` — inbound message text containing the user's full request utterance
- `sys_gen_ai_usage_log` `b27dd9be2bae47d817a6ffbeee91bff9` — assist counts (trial_assists: 25)
- Communicator output in `sn_aia_execution_task` `ae7dd5be2b628318f243fed2ce91bf84` — contains the routed group name and request summary shown to the end user
References: null