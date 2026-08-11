## Fix Report — Seed 02 Request Router
**Execution Plan:** d96323b22b2e0bd817a6ffbeee91bf04 
**Agent:** Seed 02 Request Router (`cd050d48e810411d9f113fd530694fe6`) 
**Run Date:** 2026-08-11 01:26:04 UTC

---

## FAILURE SUMMARY

The user submitted: *"I need a parking permit for the north garage starting next month — please route this request to the right place."* The agent completed without error (plan state: **Completed**, all 6 tasks: **Success**), yet it never routed the request to a real assignment group. After calling `measure_request` to count the words in the input, the LLM had no routing tool available. It fell back on general enterprise knowledge, fabricated a plausible-sounding response ("Routed to the Facilities Management group"), and presented it to the user as if routing had occurred. No service-catalog item was created, no assignment group was written, and no downstream work was triggered. The plan's green status is a **false positive** caused entirely by the absence of a routing tool.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | Full artifact paged (16,238 chars, 5 pages) |
| 2 | Agent instructions | **SWEPT** | Via `agent_config` |
| 3 | Tool definitions | **SWEPT** | Via `agent_config` |
| 4 | Data schemas | **NOT SWEPT** | No tool in this agent reads a table; the failure occurs before any data query. Schema inspection would address a question the trace has already cleared. |
| 5 | Data (record existence) | **NOT SWEPT** | Same reason as layer 4. No record lookup was attempted during the run. |
| 6 | GenAI stack | **SWEPT** | `genai_log for_execution` confirmed 2 successful LLM calls; `check_config` run for capability |
| 7 | Trigger & wiring | **SWEPT** | Via `agent_config` triggers section |
| — | Platform logs (syslog) | **UNAVAILABLE** | `syslog` enforces `caller_access = Caller Restriction`. An instance administrator must relax `caller_access` on `syslog` or export logs from a permitted scope. The layer was **not** swept and must not be treated as clean. |

---

## ROOT CAUSES

### RC-1 — Missing routing tool *(primary cause)*

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_agent` `cd050d48e810411d9f113fd530694fe6` — tool binding set |
| **Finding** | The agent has exactly one tool: `measure_request`, which counts characters and words. There is no tool to look up assignment groups, create catalog requests, or write to any routing table. When the LLM exhausted its tool options after the measurement step, it answered from general knowledge and fabricated the routing decision. |
| **Evidence** | • `agent_config` overview: `tool_count: 1`, `active_tool_count: 0` — table `sn_aia_agent_tool_m2m` read status `ok`, 1 binding row only.<br>• Trace Gen AI task `sys_id: 2f63e7b22b2e0bd817a6ffbeee91bfe0` (order 300) output digest: *"Based on general enterprise knowledge, this type of request is typically handled by the Facilities Management group…"* — explicit admission of hallucination.<br>• Agent `description` field (`sn_aia_agent`): *"Benchmark seed — deliberately broken."* |
| **Confidence** | **CONFIRMED** — trace evidence + configuration evidence both present |

---

### RC-2 — Instruction text names no routing mechanism

| Field | Value |
|-------|-------|
| **Layer** | 2 — Instructions |
| **Component** | `sn_aia_agent` `cd050d48e810411d9f113fd530694fe6`, field `instructions` |
| **Finding** | The instruction text (183 chars) tells the agent to "assign to the right group" but names no tool, no table, and no lookup mechanism. With no routing tool and no procedural guidance, the LLM has no grounded path to a real assignment group. |
| **Evidence** | `agent_config` instructions section: *"Read the incoming request and assign it to the right group. Be accurate - assigning to the wrong group delays the requester. Confirm the assignment back to the user when you are done."* (`sn_aia_agent`, `instructions`, length 183) |
| **Confidence** | **CONFIRMED** |

---

### RC-3 — No trigger wiring (blocks autonomous execution)

| Field | Value |
|-------|-------|
| **Layer** | 7 — Trigger & wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m`, `sn_aia_usecase` |
| **Finding** | Zero trigger links on both branches (agent-direct and team/use-case chain). All reads behind the traversal succeeded (status `ok`/`empty`), so the absence is real. The agent cannot fire autonomously on a record event. This is not the cause of this specific interactive run's hallucination, but it means the agent will never self-start on a catalog request or incident. |
| **Evidence** | `agent_config` triggers `wiring_findings[0].finding: "no_trigger_wiring"`, severity `high`; `sn_aia_trigger_agent_usecase_m2m` read status `empty`; `sn_aia_usecase` read status `empty` |
| **Confidence** | **CONFIRMED** (for autonomous triggering) |

---

### RC-4 — active_tool_count counter discrepancy (latent risk)

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_agent_tool_m2m` binding `da3f01db9aec41da835887210ed4b902` |
| **Finding** | `agent_config` overview reports `active_tool_count: 0`, yet the binding record carries `active: "1"` and the tool record also carries `active: "1"`. The tool did execute successfully in this run (tool call `af63e7b22b2e0bd817a6ffbeee91bf87`, status Success), so the zero counter did not block this execution. The source field driving the overview counter is unresolved. |
| **Evidence** | `agent_config` overview `active_tool_count: 0`; binding `active: "1"`; trace tool execution status `Success` |
| **Confidence** | **UNCONFIRMED** — the counter source field would confirm whether this is a display bug or a latent deactivation risk |

---

## FIXES

### FIX-1 — Add a routing-lookup tool

| Field | Value |
|-------|-------|
| **Target type** | Tool schema + data |
| **Target** | New `sn_aia_tool` record, then a new `sn_aia_agent_tool_m2m` binding on agent `cd050d48e810411d9f113fd530694fe6` |
| **Current** | No routing tool exists. Only `measure_request` (character counter) is bound. |
| **Proposed** | Create a tool (e.g., `lookup_assignment_group`) whose script queries `sys_user_group` (or the appropriate catalog/routing table) for a group matching the request category. Bind it to the agent. The tool description **must** state: (a) purpose, (b) when to use it, (c) when **not** to use it, (d) input format, (e) output format and error shape. |
| **Rationale** | Without a routing tool the LLM has no grounded path to an assignment group and hallucinates one. A verified group sys_id from a live lookup closes the hallucination gap and produces an auditable routing decision. |

---

### FIX-2 — Expand the instruction text

| Field | Value |
|-------|-------|
| **Target type** | Instruction |
| **Target** | `sn_aia_agent` `cd050d48e810411d9f113fd530694fe6`, field `instructions` |
| **Current** | `"Read the incoming request and assign it to the right group. Be accurate - assigning to the wrong group delays the requester. Confirm the assignment back to the user when you are done."` (183 chars) |
| **Proposed** | Expand to explicit steps: (1) call `measure_request` to characterise the request; (2) call `lookup_assignment_group` with the identified category to retrieve the correct group; (3) confirm the group name back to the user. **Explicitly prohibit** answering from general knowledge — if the lookup returns no result, the correct action is to inform the user that no matching group was found. |
| **Rationale** | The current text invites the LLM to infer the group from training data. Explicit tool-use steps and a fallback prohibition eliminate the hallucination path entirely. |

---

### FIX-3 — Wire a trigger (if autonomous routing is required)

| Field | Value |
|-------|-------|
| **Target type** | Wiring |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` — new row linking this agent (or a use case wrapping it) to the appropriate trigger configuration |
| **Current** | 0 trigger links; 0 active trigger configurations |
| **Proposed** | If the agent is intended to fire on a service-catalog request submission or incident creation, create the corresponding trigger configuration and link it. If the agent is intentionally interactive-only, accept this finding and document it. |
| **Rationale** | Without trigger wiring the agent never fires automatically on a record event. |

---

### FIX-4 — Resolve the active_tool_count discrepancy

| Field | Value |
|-------|-------|
| **Target type** | Configuration (investigation) |
| **Target** | `sn_aia_agent_tool_m2m` binding `da3f01db9aec41da835887210ed4b902`, field `active` |
| **Current** | Binding `active: "1"` — yet overview counter shows `active_tool_count: 0` |
| **Proposed** | Open the binding record in AI Agent Studio and confirm the `active` field value and which field drives the overview counter. If a different field is used, set it to active. |
| **Rationale** | A latent deactivation on the binding could suppress tool calls in a future execution without surfacing an error. |

---

## VERIFICATION

1. After adding the routing tool and updating instructions, submit the same objective: *"I need a parking permit for the north garage starting next month — please route this request to the right place."*
2. Confirm a new execution plan reaches **Completed** with a tool call to `lookup_assignment_group` (not just `measure_request`) visible in `sn_aia_tools_execution`.
3. Confirm the agent message stream contains a real group sys_id or group name sourced from `sys_user_group`, not a hallucinated string.
4. If trigger wiring was added, create a test catalog request and verify an execution plan is auto-generated with the correct trigger context.
5. After FIX-4 investigation, confirm `active_tool_count` in the `agent_config` overview equals 1 (or the expected count) for the new binding set.

---

## DATA MARKERS

The following items were quoted as evidence and should be reviewed for redaction before this report leaves the instance:

- User email from message stream: `admin@example.com` (sn_aia_message, user profile row)
- User sys_id: `6816f79cc0a8016401c5a33be04be441` (sn_aia_message, user profile row)
- Full user utterance quoted verbatim in multiple trace fields

---
*Platform log layer (syslog) was NOT swept — UNAVAILABLE due to caller restriction. Script errors surfaced inside the execution are visible through agent_trace (0 script errors found in message stream). Platform-level errors around the run remain unseen until an administrator grants syslog access or exports the logs.*
References: null
