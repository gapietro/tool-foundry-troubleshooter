## Fix Report — Agent: Seed 02 Request Router
**Execution Plan:** `a950ad322be28318f243fed2ce91bfca`

---

## FAILURE SUMMARY

The user submitted an access request for a finance reporting system. The agent completed with state **Completed** and emitted a polished "✅ Request Routed Successfully" message — but **no routing action was ever taken**. The only tool called was `measure_request`, which counts characters and words in the input text. After receiving that count (109 chars, 21 words), the LLM fabricated a routing outcome, naming an assignment group and confirming routing without any tool or data backing that claim. The agent's own description reads: *"Benchmark seed - deliberately broken."* It has zero active routing tools.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | ✅ SWEPT | `agent_trace` on plan `a950ad322be28318f243fed2ce91bfca` |
| 2 | Instructions | ✅ SWEPT | `agent_config`, instructions section |
| 3 | Tool definitions | ✅ SWEPT | `agent_config`, tools section |
| 4 | Data schemas | NOT SWEPT | The agent made no table reads; schema mismatch cannot be the proximate cause. Skipped deliberately. |
| 5 | Data — record existence | NOT SWEPT | No table queries were attempted by the agent; record absence is not the proximate cause. Skipped deliberately. |
| 6 | GenAI stack | ✅ SWEPT | `genai_log` mode `for_execution` |
| 7 | Trigger and wiring | ✅ SWEPT | `agent_config`, triggers section |
| — | Platform logs | ⛔ UNAVAILABLE | `syslog` has `caller_access = Caller Restriction`. An instance administrator must relax `caller_access` on `syslog` or provide a log export. Script errors inside the run are still visible via `agent_trace` (zero found). |

---

## ROOT CAUSES

### Root Cause 1 — No Routing Tool Is Bound to the Agent

| | |
|---|---|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_agent[cd050d48e810411d9f113fd530694fe6]` |
| **Finding** | The agent has exactly **one tool binding** (`measure_request`) and **zero active routing tools**. `measure_request` returns only `{received, characters, words}`. It performs no group lookup, no ticket creation, and no record write. There is no tool in the agent's toolset capable of routing a request. |
| **Evidence** | `sn_aia_agent[cd050d48e810411d9f113fd530694fe6].tool_count = 1`, `active_tool_count = 0`; binding `da3f01db9aec41da835887210ed4b902` name = `measure_request`; tool script (319 chars) returns `JSON.stringify({ received: true, characters: text.length, words: words })`; `sn_aia_tools_execution[2b50e1722be28318f243fed2ce91bf50]` response = `{received:true, characters:109, words:21}` — no routing data present. Agent description: *"Benchmark seed - deliberately broken."* |
| **Confidence** | ✅ CONFIRMED |

---

### Root Cause 2 — LLM Hallucinated a Routing Outcome From Measurement Data

| | |
|---|---|
| **Layer** | 6 — GenAI stack |
| **Component** | LLM call `5a6065722be28318f243fed2ce91bf1b`, definition `AIA ReAct Engine_Amazon Bedrock` (`31fee654ff116e10b9c9fffffffffffd`) |
| **Finding** | After receiving only `{received:true, characters:109, words:21}` from `measure_request`, the model produced a second LLM turn (9,350 ms, 454 response tokens) in which it invented a routing assignment — group name, confirmation text, and all — with no tool call backing it. The instructions say *"assign it to the right group … confirm the assignment back to the user"* but provide no tool to actually do so, creating an instruction–toolset gap that the model filled with confabulation. |
| **Evidence** | `sn_aia_gen_ai_m2m` join shows two LLM calls on task `7150ed322be28318f243fed2ce91bf3c`: call `365061722be28318f243fed2ce91bf0e` (3,279 ms, 134 tokens — first reasoning step) and call `5a6065722be28318f243fed2ce91bf1b` (9,350 ms, 454 tokens — fabricated routing response); task tree shows no tool call between the second Gen AI step and the Communicator step; communicator metadata confirms the fabricated message was delivered with `user_input = false`. |
| **Confidence** | ✅ CONFIRMED |

---

### Root Cause 3 — No Trigger Wiring (Agent Cannot Self-Start)

| | |
|---|---|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m` |
| **Finding** | Zero trigger links on both the agent-direct branch (0 rows) and the team/use-case chain (0 rows, 0 use cases). Both reads returned status `ok` / `empty`, so the absence is genuine. The agent cannot fire autonomously on a record event. (For this run it was invoked conversationally/interactively, so this is not the cause of *this* failure — but it blocks any automated routing scenario.) |
| **Evidence** | `agent_config` triggers section: `trigger_links = 0`, `active_trigger_links = 0`, `active_trigger_configurations = 0`; `sn_aia_usecase` rows = 0; `sn_aia_team_member` rows = 0; wiring finding `no_trigger_wiring` severity = high. |
| **Confidence** | ✅ CONFIRMED (absence is genuine; both reads were `ok`/`empty`) |

---

## FIXES

### Fix 1 — Add a Routing Tool

| | |
|---|---|
| **Target type** | Tool schema + tool binding |
| **Target** | `sn_aia_agent[cd050d48e810411d9f113fd530694fe6]` — add a new tool binding |
| **Current** | One binding: `measure_request` (character/word counter only) |
| **Proposed** | Create a new `sn_aia_tool` record (Script or REST type) that accepts the request text and returns an assignment group name (e.g., by querying `sys_user_group` on keywords or by calling a catalog/ITSM API). Bind it to the agent via `sn_aia_agent_tool_m2m`. Name it clearly (e.g., `route_request_to_group`). |
| **Rationale** | Without a routing tool the agent has no mechanism to fulfil its stated objective. The LLM will hallucinate a result every time. |

### Fix 2 — Update Instructions to Reference the Routing Tool and Prohibit Unsupported Claims

| | |
|---|---|
| **Target type** | Instruction |
| **Target** | `sn_aia_agent[cd050d48e810411d9f113fd530694fe6].instructions` |
| **Current** | `"Read the incoming request and assign it to the right group. Be accurate - assigning to the wrong group delays the requester. Confirm the assignment back to the user when you are done."` (183 chars) |
| **Proposed** | Extend to: (a) name the routing tool explicitly and describe when to call it; (b) add a negative constraint — *"Do not confirm routing unless the routing tool has returned a group name. If the tool is unavailable or returns no result, tell the user you could not route the request."*; (c) describe what a valid routing output looks like. |
| **Rationale** | The instruction–toolset gap is what causes the hallucination. Explicit negative guidance prevents the model from filling an absent tool result with confabulation. |

### Fix 3 — Expand the `measure_request` Tool Description

| | |
|---|---|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool[c3beac9180474930a70e4a4a3de7126d].description` |
| **Current** | `"Measures an incoming request: returns its character count and an approximate word count. Give it the request text."` |
| **Proposed** | Add: (a) explicit statement that this tool does **not** route, classify, or assign requests; (b) description of the output fields `received`, `characters`, `words` and their types; (c) a negative-guidance sentence: *"Do not use this tool to determine routing — use route_request_to_group for that."* |
| **Rationale** | Without boundary guidance the model treats measurement output as a signal it can reason routing from. The three `tool_smell` findings (`description_thin`, `description_no_negative_guidance`, `description_no_input_guidance`) all point here. |

### Fix 4 — Add Trigger Wiring (If Automated Firing Is Required)

| | |
|---|---|
| **Target type** | Wiring |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` |
| **Current** | 0 rows — no trigger links on either branch |
| **Proposed** | If the agent must fire on a record event (e.g., new catalog request submitted), create a use case (`sn_aia_usecase`), attach a trigger configuration pointing to the relevant table/condition, and link it via `sn_aia_trigger_agent_usecase_m2m`. If conversational-only invocation is intended, this fix is optional. |
| **Rationale** | An agent with no trigger wiring cannot self-start. The `no_trigger_wiring` finding is high-severity. |

---

## VERIFICATION

1. **After Fix 1:** Rerun a test conversation with the same objective. In `agent_trace`, confirm that `tool_calls` contains a call to `route_request_to_group` (or equivalent) with a non-empty group name in the response. `active_tool_count` on the agent overview should be ≥ 2.
2. **After Fix 2:** Inspect the second LLM turn in `genai_log mode=for_execution`. The model should call the routing tool rather than emitting a fabricated group name directly.
3. **After Fix 3:** Re-run `agent_config` tools section. Confirm `description_thin`, `description_no_negative_guidance`, and `description_no_input_guidance` smells are resolved.
4. **After Fix 4 (if applied):** Create a test triggering record and confirm an execution plan is created in `sn_aia_execution_plan` without manual invocation.
5. **End-to-end:** The final agent message must contain a group name returned by the routing tool, not a fabricated one. Cross-check the group name against `sys_user_group` to confirm it exists.

---

## DATA MARKERS

The following record data was quoted as evidence and should be redacted before this report crosses the instance boundary:

- `sn_aia_message[ed50ed322be28318f243fed2ce91bf1b]` — user profile content including email `admin@example.com`, name `System Administrator`, user sys_id `6816f79cc0a8016401c5a33be04be441`
- `sn_aia_message[a950ed322be28318f243fed2ce91bf1c]` — verbatim user utterance: *"I need access to the finance reporting system for my new role — please route this request to the right place."*
- Communicator task metadata — fabricated routing response text delivered to the end user
References: null