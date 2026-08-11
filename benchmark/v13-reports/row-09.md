# Fix Report — Seed 03 Category Router
**Execution Plan:** 8513233e2b624718f243fed2ce91bf6e  
**Agent:** Seed 03 Category Router (`0bbf1b00cce848838cc675986233120b`)  
**Diagnosed by:** Agent Doctor

---

## FAILURE SUMMARY

The user asked the agent to route a request in the "Network" category to an assignment group. The agent ran to completion without error — the LLM was called twice, the `lookup_routing_rule` tool was invoked once and returned successfully — but the response to the user was *"no matching assignment group was found."* The root cause is that the routing data table (`x_snc_tsbench_routing`) contains **zero rows**. There are no routing rules of any kind on this instance; any category the agent looks up will always return `matched: false`. The agent's instructions, tool wiring, and LLM calls are all functioning correctly. The agent description itself states it is *"deliberately broken"*, confirming this is an intentionally unseeded data state used for benchmark testing.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | ✅ SWEPT | Full artifact read across 5 pages |
| 2 | Instructions | ✅ SWEPT | via agent_config |
| 3 | Tool definitions | ✅ SWEPT | via agent_config; tool script body fully read |
| 4 | Data schemas | ✅ SWEPT | via schema_lookup on x_snc_tsbench_routing |
| 5 | Data (record existence) | ✅ SWEPT | via query_table; verdict: genuinely_empty |
| 6 | GenAI stack | ✅ SWEPT | via genai_log for_execution; two successful calls |
| 7 | Trigger and wiring | ✅ SWEPT | via agent_config triggers section |
| — | Platform logs (syslog) | ❌ UNAVAILABLE | syslog table has caller_access = Caller Restriction. An instance administrator must relax caller_access on syslog or export the log entries from a permitted scope. This layer was NOT swept; it must not be reported as clean. |

---

## ROOT CAUSES

### ROOT CAUSE 1 — Empty routing data table *(PRIMARY)*

| Field | Value |
|-------|-------|
| **Layer** | 5 — Data |
| **Component** | Table `x_snc_tsbench_routing` (label: *Bench Routing Rule*) |
| **Finding** | The table exists and is readable, but contains **zero rows**. The unfiltered COUNT is also 0, ruling out ACL filtering. Every lookup will return `matched: false` regardless of the category supplied. |
| **Evidence** | `query_table` on `x_snc_tsbench_routing` → `row_count: 0`, `unfiltered_row_count: 0`, `verdict: genuinely_empty` (read_status: ok). Corroborated by tool execution output in trace: `{"ok":true,"matched":false,"category":"Network","rules_in_table":0}` (sn_aia_tools_execution `4313e73e2b624718f243fed2ce91bfaf`). |
| **Confidence** | **CONFIRMED** — two independent sources (live query + execution trace) agree on zero rows with status ok. |

---

### ROOT CAUSE 2 — active_tool_count discrepancy *(SECONDARY / ADVISORY)*

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_agent` overview counter `active_tool_count`; binding `3bacb3ef18454586b86a87f11ffaae9a` |
| **Finding** | The agent overview reports `active_tool_count: 0`, yet the binding record itself carries `active: "1"` and the tool record carries `active: "1"`. The tool was successfully called at runtime, so this is likely a stale computed field or display anomaly rather than an operational defect. |
| **Evidence** | agent_config overview: `active_tool_count: 0`; agent_config tools section binding: `active: "1"`; trace task `c713e73e2b624718f243fed2ce91bfa9` status: Success. |
| **Confidence** | **UNCONFIRMED** as a real defect. The tool ran successfully, so the counter did not block execution. Confirming evidence: inspect the `sn_aia_agent_tool_m2m` record `3bacb3ef18454586b86a87f11ffaae9a` directly in the platform and verify the `active` field value; also check whether the agent overview UI refreshes after a record save. |

---

### ROOT CAUSE 3 — No trigger wiring *(ADVISORY — may be expected)*

| Field | Value |
|-------|-------|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m` |
| **Finding** | Zero trigger links on both the agent-direct and team/use-case branches. The agent has no automatic trigger and cannot start on its own from a record event. |
| **Evidence** | agent_config triggers section: `agent_direct: 0`, `team_usecase_chain: 0`; `sn_aia_trigger_agent_usecase_m2m` read status: empty. |
| **Confidence** | **CONFIRMED** absence of wiring. Whether this is a defect depends on intent: this run was invoked interactively/conversationally, so the absence of an event trigger does not explain the failure. If the agent is also expected to fire automatically on record events, a trigger link is missing. |

---

## FIXES

### FIX 1 — Seed routing rules into x_snc_tsbench_routing *(resolves Root Cause 1 — required)*

| Field | Value |
|-------|-------|
| **Target type** | Data |
| **Target** | Table `x_snc_tsbench_routing` |
| **Current** | 0 rows |
| **Proposed** | Insert at minimum one row with `category = "Network"` and `assignment_group = <the correct group name for Network requests>`. Seed all categories the agent is expected to handle. |
| **Rationale** | The tool script performs a GlideRecord query on this table. With no rows, `matched` is always `false` and the agent can never produce a valid routing result. Seeding the data is the only fix that addresses the root cause. |

---

### FIX 2 — Add input validation and a setLimit to the tool script *(reduces risk, not blocking)*

| Field | Value |
|-------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` record `3bd31a0be63d4e81856598dbd2c96788`, field `script` |
| **Current** | Script queries without `setLimit`; does not validate or normalise `inputs.category` before querying. |
| **Proposed** | Add `gr.setLimit(1);` before `gr.query()`. Add a guard at the top: `var cat = (inputs.category || '').toString().trim(); if (!cat) { return JSON.stringify({ok:false, error:'category input missing'}); }` Use `cat` instead of `inputs.category` in the query. |
| **Rationale** | An unbounded query inflates the scratchpad. An unvalidated input means a blank or malformed category passes silently, making no-match indistinguishable from an empty table. |

---

### FIX 3 — Improve tool description with input format and boundary guidance *(reduces selection risk)*

| Field | Value |
|-------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` record `3bd31a0be63d4e81856598dbd2c96788`, field `description` |
| **Current** | *"Looks up the assignment group for a category in the bench routing table. Give it a category name. Returns the matching assignment group, or reports explicitly that no rule matched."* |
| **Proposed** | Append: *"Input: category (string, required) — the exact category name as it appears in the routing table (e.g. 'Network'). Do not use this tool to resolve categories not present in the routing table; report that no rule exists rather than guessing."* |
| **Rationale** | The tool checker flagged missing input-format and negative-guidance sentences. Without them the model may guess at category format or invoke the tool when it should not. |

---

### FIX 4 — Add trigger wiring if event-driven routing is required *(resolves Root Cause 3 — conditional)*

| Field | Value |
|-------|-------|
| **Target type** | Wiring |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` — new row linking this agent to the appropriate trigger configuration |
| **Current** | 0 trigger links |
| **Proposed** | In AI Agent Studio, configure a trigger (e.g. record-created on the relevant task table) and link it to this agent. Set the run-as identity explicitly if the triggering record owner may lack the roles required to read `x_snc_tsbench_routing`. |
| **Rationale** | Without trigger wiring the agent never fires automatically. Only required if the agent is expected to route requests without a human starting a conversation. |

---

## VERIFICATION

1. **After FIX 1:** Open a new conversation and send *"Please route a request in the Network category to the correct assignment group."* The tool call should return `matched: true` and `assignment_group: <seeded value>`. Verify in the execution trace that the task `output_digest` for the Tool node contains `"matched":true`.
2. **Re-run agent_trace** on the new execution plan and confirm `rules_in_table` > 0 and `matched: true` in the tool response digest.
3. **Re-run query_table** on `x_snc_tsbench_routing` and confirm `row_count` > 0.
4. **For FIX 2:** After modifying the script, invoke the tool with a blank category input and confirm it returns `{ok:false, error:'category input missing'}` rather than querying the table.
5. **For the active_tool_count anomaly:** Open the agent record in the platform and confirm `active_tool_count` refreshes to 1 after a no-op save. If it remains 0, open a defect against the computed field.

---

## DATA MARKERS

The following record data was read during diagnosis and should be redacted before this report leaves the instance:

- User profile message: `user Email: admin@example.com`, `user Sys ID: 6816f79cc0a8016401c5a33be04be441` (from execution message stream, sn_aia_message)
- Conversation sys_id: `8513effa2b624718f243fed2ce91bff0`
- GenAI usage log sys_id: `0223eb322b2e0bd817a6ffbeee91bfda`

---

> **Note on platform logs:** The syslog layer was NOT swept. The syslog table enforces a caller-access restriction that this diagnostic application cannot lift. An instance administrator must either relax `caller_access` on syslog or provide an exported log window covering 2026-08-11 01:22–01:27 UTC for complete coverage. All script errors surfaced *inside* the execution are visible through the execution trace (0 script errors found); the gap is platform-level errors *around* the run.
References: null
