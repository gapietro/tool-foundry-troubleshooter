## Fix Report — Seed 03 Category Router
**Execution Plan:** `656323b22b2e0bd817a6ffbeee91bfb7`
**Run date:** 2026-08-11 01:26:05 UTC

---

## FAILURE SUMMARY

The user asked the agent to route a Facilities request to the correct assignment group. The agent ran to completion without errors, called the `lookup_routing_rule` tool once, and correctly reported that no assignment group could be found. The objective was not met because the routing table (`x_snc_tsbench_routing`) contains zero rows — there are no routing rules to match against. The tool script, the LLM reasoning, and the agent instructions all behaved correctly; the failure is a missing-data defect. The agent description itself notes *"Benchmark seed – deliberately broken"*, confirming this is an intentionally unseeded state.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | ✅ SWEPT | `agent_trace` on plan `656323b22b2e0bd817a6ffbeee91bfb7` |
| 2 | Instructions | ✅ SWEPT | `agent_config` — instructions section |
| 3 | Tool definitions | ✅ SWEPT | `agent_config` — tools section; full script body read |
| 4 | Data schemas | ✅ SWEPT | `schema_lookup` on `x_snc_tsbench_routing` |
| 5 | Data | ✅ SWEPT | `query_table` on `x_snc_tsbench_routing` |
| 6 | GenAI stack | ✅ SWEPT | `genai_log` mode `for_execution` |
| 7 | Trigger and wiring | ✅ SWEPT | `agent_config` — triggers section; `log_analysis` attempted — UNAVAILABLE |

**Layer 7 / Platform logs — UNAVAILABLE.** `syslog` has a `caller_access` restriction that cannot be lifted by this application. An instance administrator must either relax `caller_access` on `syslog` or export the log entries from a permitted scope. The layer is reported as not swept; it is **not** reported as clean. Script errors raised *inside* the run are visible through `agent_trace` (which mines the message stream), and none were found on this execution.

---

## ROOT CAUSES

### RC-1 — Routing table is empty (CONFIRMED)

| Field | Value |
|-------|-------|
| **Layer** | 5 — Data |
| **Component** | Table `x_snc_tsbench_routing` |
| **Finding** | The table exists and its schema is correct, but it contains zero rows. The tool script counted rows via `GlideAggregate COUNT` and returned `rules_in_table: 0`. The agent cannot route any category until at least one rule is seeded. |
| **Evidence** | `query_table` result — table `x_snc_tsbench_routing`, `verdict: genuinely_empty`, `unfiltered_row_count: 0`, read status `ok`. Tool call response in `sn_aia_tools_execution` sys_id `bf636bb22b2e0bd817a6ffbeee91bf3b`: `{"ok":true,"matched":false,"category":"Facilities","rules_in_table":0}` |
| **Confidence** | **CONFIRMED** — empty result verified against an unfiltered COUNT |

---

### RC-2 — `category` input on the tool binding is not marked mandatory (CONFIRMED, low impact on this run)

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_agent_tool_m2m` binding `3bacb3ef18454586b86a87f11ffaae9a`, field `inputs[0].mandatory` |
| **Finding** | The `category` input is declared with `mandatory: false`. The model passed the correct value on this run, so it did not cause the current failure. However, with `mandatory: false` the model may silently omit the input on a future call with a different phrasing, causing an empty-string lookup that will match nothing even after the table is seeded. |
| **Evidence** | `agent_config` tools section — `input_schema: [{"name":"category","description":"The category to look up in the routing table.","mandatory":false}]` on binding `3bacb3ef18454586b86a87f11ffaae9a` |
| **Confidence** | **CONFIRMED** — field value read directly |

---

### RC-3 — Tool script performs no input validation or normalisation (CONFIRMED, latent)

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` `3bd31a0be63d4e81856598dbd2c96788`, field `script` |
| **Finding** | The script passes `inputs.category` directly to `addQuery` without trimming whitespace, normalising case, or handling a null/undefined value. A category submitted as `"facilities"` (lowercase) or `" Facilities "` (with spaces) would return `matched: false` even with a seeded row for `"Facilities"`. |
| **Evidence** | Tool script body read from `agent_config` artifact — no `toLowerCase`, `trim`, or null-guard before `gr.addQuery('category', inputs.category)`. Tool smell `script_no_input_validation` flagged at severity `medium`. |
| **Confidence** | **CONFIRMED** by script text |

---

### RC-4 — No trigger wiring (informational, not a failure cause for this run)

| Field | Value |
|-------|-------|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m` — agent `0bbf1b00cce848838cc675986233120b` |
| **Finding** | Zero trigger links on both the agent-direct and team/usecase-chain branches. This execution was invoked interactively (mode: Interactive, channel: Default), so the absence of trigger wiring did **not** cause this run to fail. If the agent is ever intended to fire on a record event, trigger wiring is missing. |
| **Evidence** | `agent_config` triggers section — `branches: {agent_direct: 0, team_usecase_chain: 0}`, `traversal_integrity.complete: true`, read statuses all `ok`/`empty`. Wiring finding `no_trigger_wiring` severity `high`. |
| **Confidence** | **CONFIRMED** for the absence; impact classified as **informational** for this run |

---

## FIXES

### Fix 1 — Seed the routing table *(addresses RC-1)*

| Field | Value |
|-------|-------|
| **Target type** | Data |
| **Target** | Table `x_snc_tsbench_routing` |
| **Current** | 0 rows |
| **Proposed** | Insert at minimum one row with `category = Facilities` and `assignment_group = <the group that handles Facilities requests>`. Add rows for every other category the agent is expected to handle. |
| **Rationale** | The tool script can only return a match when a row exists. An empty table is an unconditional failure for every category regardless of any other configuration change. |

---

### Fix 2 — Mark `category` input mandatory *(addresses RC-2)*

| Field | Value |
|-------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_agent_tool_m2m` binding `3bacb3ef18454586b86a87f11ffaae9a`, `inputs[0].mandatory` |
| **Current** | `false` |
| **Proposed** | `true` |
| **Rationale** | A mandatory flag causes the platform to reject the tool call before execution if the model omits the value, producing a recoverable error rather than a silent empty-result match. |

---

### Fix 3 — Add input normalisation to the tool script *(addresses RC-3)*

| Field | Value |
|-------|-------|
| **Target type** | Tool schema / script |
| **Target** | `sn_aia_tool` `3bd31a0be63d4e81856598dbd2c96788`, field `script` |
| **Current** | `gr.addQuery('category', inputs.category)` with no guard |
| **Proposed** | Add at the top of the IIFE: `var cat = (inputs.category || '').toString().trim();` then use `cat` in both the aggregate COUNT query filter and the `addQuery` call. Optionally normalise case if the table values are stored in a consistent case. |
| **Rationale** | Prevents a case or whitespace difference between the model's output and the stored value from producing a false no-match after the table is seeded. |

---

### Fix 4 — Configure trigger wiring if record-event firing is required *(addresses RC-4)*

| Field | Value |
|-------|-------|
| **Target type** | Wiring |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` — create a row linking this agent (or a use case containing it) to the appropriate trigger configuration |
| **Current** | 0 trigger links |
| **Proposed** | If the agent should fire on a record event (e.g., a new Facilities request), create a trigger configuration and link it. If the agent is only invoked conversationally or via API, no action is needed. |
| **Rationale** | An agent with no trigger wiring never starts autonomously. For the current interactive invocation model this is acceptable; for automation it is not. |

---

## VERIFICATION

1. **After Fix 1:** Re-run the same prompt — *"Please route a request in the Facilities category to the correct assignment group."* — in the AI Agent Studio test panel. The `lookup_routing_rule` tool call should return `matched: true` with the correct `assignment_group` value. Inspect the new execution plan in `agent_trace` and confirm the Communicator task output contains the group name rather than a no-match message.
2. **After Fix 2:** Open the tool binding and confirm `mandatory: true` is saved. Attempt a test invocation that omits the category; the platform should reject the call before the script runs.
3. **After Fix 3:** Repeat the routing test with category values in different cases (e.g., `facilities`, `FACILITIES`) and confirm all return `matched: true` against the seeded row.
4. **After Fix 4 (if applicable):** Create a test record of the triggering type and confirm an execution plan is created automatically in `sn_aia_execution_plan` with `run_type` reflecting the trigger.

---

## DATA MARKERS

The following record data was cited as evidence and should be reviewed for redaction before this report crosses the instance boundary:

- User profile from message stream: email `admin@example.com`, name `System Administrator`, sys_id — present in `sn_aia_message` sys_id `256363b22b2e0bd817a6ffbeee91bf07`
- Tool call request/response payload in `sn_aia_tools_execution` sys_id `bf636bb22b2e0bd817a6ffbeee91bf3b` (contains category value `Facilities` and the zero-row count)

---

> **Note on platform log layer:** The `syslog` table is caller-restricted and could not be read by this diagnostic application. No platform-level script errors were found within the execution message stream (agent_trace `script_errors_found: 0`), but errors that occur *outside* the run boundary (e.g., ACL denials at trigger time) remain unverified. An instance administrator can export the relevant log window to complete the sweep.
References: null
