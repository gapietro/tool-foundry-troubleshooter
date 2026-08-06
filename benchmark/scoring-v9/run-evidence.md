# v9 scored pass — execution-phase run evidence

**Operator:** benchmark operator (execution only — no scoring, no grading, no comparison to seed expected answers).
**Instance:** gpinst01 (Zurich Patch 10 Hotfix 3), user `admin`.
**Date:** 2026-08-06 (all timestamps instance-local, which equals UTC on this instance).
**Rows:** 12 (6 NATIVE + 6 CUSTOM) against 6 pre-seeded failing executions.
**Execution discipline:** strictly one run at a time; no two runs ever overlapped (PaRunAnchor
30-min-per-user fallback would otherwise glue audit rows onto a shared anchor).

## Seeded target executions

| seed | rep | execution plan sys_id |
|---|---|---|
| 01 | 1 | `4a5bb19d2b66cf54f243fed2ce91bf57` |
| 01 | 2 | `45bbfd112ba6cf54f243fed2ce91bfcb` |
| 03 | 1 | `3afbf1192baa475817a6ffbeee91bf10` |
| 03 | 2 | `1a1c71152ba6cf54f243fed2ce91bf31` |
| 04 | 1 | `4e3c35552ba6cf54f243fed2ce91bf47` |
| 04 | 2 | `b85c79992baa475817a6ffbeee91bf2c` |

All six report `state: completed` with empty `state_reason` — by design; the failures are invisible
from the plan header.

## `layers_available` — measured once per §E3, re-checked per row

Query: `sn_aia_agent_tool_m2m` where `agent=e1392946828940e5a708fc51b0a5e954^active=true`,
fields `tool, tool.name, max_auto_executions`. Measured **2026-08-06 02:07** (before row 01) —
**7 tools attached and active, `max_auto_executions=10` on every one**:

| tool.name | m2m sys_id | max_auto_executions |
|---|---|---|
| agent_trace | 0154a35691fd416a8364bcab414fd5a9 | 10 |
| agent_config | c2c28b3942b6479692cd2e9e69a9de26 | 10 |
| schema_lookup | 5807dcaeb6ea48179f034181dc13a16f | 10 |
| query_table | 97720609c89c47d1ad21efd3a867f1f2 | 10 |
| genai_log | b6d9ddff9c9945dcaaac27ff25aa9c4f (tool) / 9a9d4d2631ab4bc480ed3bd2c872f24f | 10 |
| log_analysis | 34149445e94b46668374caa8061b6a78 | 10 |
| read_artifact | 9fb95833fdb24cfcaaad91cf0d756330 | 10 |

Mapped through §E2: `agent_trace`→L1, `agent_config`→L2/L3/L7, `schema_lookup`→L4,
`query_table`→L5, `genai_log`→L6, `log_analysis`→no layer of its own, `read_artifact`→not a layer.
**`layers_available` = 7/7 (L1–L7).** No tool attachment changed during the pass (re-verified after
the final row — see the closing note).

## Note on `layers_swept` in this file

Per §E1–E2 the sweep is READ from `x_snc_troubleshoot_audit` (`action_type=result`), never inferred
from a report's own prose. This file records, per row: the ordered `tool_name` list, the total
result-row count, the distinct tool set, and the **mechanical** §E2 map of that set to layer
numbers. §E2's qualifier — that `agent_config` earns L2/L3/L7 only for the layers the diagnosis
actually used — is a *scoring* judgment and is deliberately **left to the scorer**; the mechanical
maximum is recorded here with that caveat flagged, not resolved.

---

# row-01-native-seed-01-run-1

## 1. Identity

| field | value |
|---|---|
| arm | NATIVE (`servicenow_aia_execute`, agent `e1392946828940e5a708fc51b0a5e954`) |
| seed / rep | 01 / 1 |
| target plan | `4a5bb19d2b66cf54f243fed2ce91bf57` |
| **run_id** (new `sn_aia_execution_plan` sys_id) | **`961d7d9d2baa475817a6ffbeee91bf2a`** |
| AIA session id | `021d3d9d2baa475817a6ffbeee91bfe2` |
| conversation_ref (on the anchor) | `0e1d3d9d2baa475817a6ffbeee91bfef` |

Input text (verbatim):

```
Diagnose the failing AI Agent execution with plan sys_id 4a5bb19d2b66cf54f243fed2ce91bf57. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes.
```

## 2. Terminal state

`sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty.
The MCP call returned `State: in_progress` at 0s (as expected — exceeded the 120 s window and moved
to background); terminal state confirmed by polling the plan record.

## 3. Wall-clock duration

`sys_created_on` 2026-08-06 02:08:14 → `sys_updated_on` (terminal) 2026-08-06 02:13:39 =
**5 m 25 s (325 s)**.

## 4. Audit-derived tool calls

**Anchor-location method:** queried `x_snc_troubleshoot_run` for `sys_created_on>=2026-08-06 02:07:00`
(created-time window around the run) and confirmed the single hit by its `execution_ref`, which
equals this row's run_id. Anchor sys_id **`7c2db1dd2baa475817a6ffbeee91bfc4`** (`number` TR1000156,
`harness` = `native`, `conversation_ref` `0e1d3d9d2baa475817a6ffbeee91bfef`, `status` left at
`running` — the native arm never writes a terminal status onto the anchor).

Query: `x_snc_troubleshoot_audit` where `run=7c2db1dd2baa475817a6ffbeee91bfc4^action_type=result`,
ordered by `sys_created_on` asc.

**Total result rows: 18.** (Matches the plan's `type=tool` task count of 18 exactly.)

Ordered `tool_name` list:

1. `agent_trace` (02:08:25)
2. `read_artifact` (02:08:37)
3. `read_artifact` (02:08:37)
4. `read_artifact` (02:08:37)
5. `read_artifact` (02:08:37)
6. `read_artifact` (02:09:04)
7. `query_table` (02:09:04)
8. `agent_config` (02:09:05)
9. `genai_log` (02:09:05)
10. `read_artifact` (02:09:34)
11. `read_artifact` (02:09:34)
12. `log_analysis` (02:09:34)
13. `agent_config` (02:09:34)
14. `read_artifact` (02:10:10)
15. `read_artifact` (02:10:10)
16. `agent_config` (02:10:11)
17. `query_table` (02:10:38)
18. `schema_lookup` (02:10:38)

Distinct tool names (7): `agent_trace`, `read_artifact`, `query_table`, `agent_config`,
`genai_log`, `log_analysis`, `schema_lookup`.

§E2 mechanical map — `agent_trace`→L1, `agent_config`→L2,L3,L7, `schema_lookup`→L4,
`query_table`→L5, `genai_log`→L6, `log_analysis`→none, `read_artifact`→none:
**layers_swept (mechanical) = 7/7 (L1,L2,L3,L4,L5,L6,L7)**; `layers_available` = 7/7.
Scorer's §E2 qualifier on the three `agent_config` layers is unresolved here by design.

## 5. LLM calls

`sn_aia_execution_task` grouped by `type` on the plan: `gen_ai` = **9**
(also: `tool` 18, `agent` 1, `access_verification` 1, `communicator` 1).

## 6. Full report, verbatim

Source: `sn_aia_message` sys_id `8c4e3d952bea475817a6ffbeee91bfa1`, `role` = `agent`,
`name` = `Agent Doctor`, created 2026-08-06 02:13:16 — the last agent row carrying the Fix Report.
(A later agent row, `d55ef5d52bea475817a6ffbeee91bf0c` at 02:13:37, is the AIA closing *summary* of
the report, not the report; it is reproduced after the report for completeness.)

<!-- BEGIN VERBATIM row-01 -->

# Fix Report — Seed 01 Ticket Prioritizer

**Execution plan:** `4a5bb19d2b66cf54f243fed2ce91bf57`  
**Agent:** Seed 01 Ticket Prioritizer  
**Run date:** 2026-08-06 02:00:34 → 02:01:54 (78 s)

---

## FAILURE SUMMARY

The user asked the agent to set the priority of a bench ticket to match the urgency of a total payment-gateway outage. The agent correctly reasoned through steps 1–3 (priority = "critical"), called `set_ticket_priority` with the ticket sys_id and `priority="critical"`, and received `ok:true`. However, **the priority was never actually stored**: `priority_stored` came back `null`. The root cause is a **type mismatch**: the `priority` column on `x_snc_tsbench_ticket` is declared as **Integer**, and GlideRecord silently discards a non-numeric string on an Integer field — `update()` returns success, the readback yields null, and the agent had no mechanism to detect the silent failure. The agent displayed a confident audit report to the user while the ticket's priority remained unchanged.

A secondary problem: the first ReAct turn timed out with `Error: Invalid next entry for scratchpad` before recovering (~30 s delay), caused by instruction bloat. A trigger-wiring gap means the agent cannot be invoked automatically.

---

## LAYERS SWEPT

| Layer | Status | Notes |
|---|---|---|
| 1 — Execution trace | **SWEPT** | `agent_trace` on plan `4a5bb19d2b66cf54f243fed2ce91bf57` |
| 2 — Instructions | **SWEPT** | `agent_config` section `instructions` |
| 3 — Tool definitions | **SWEPT** | `agent_config` section `tools`; full script body read |
| 4 — Data schemas | **SWEPT** | `schema_lookup` on `x_snc_tsbench_ticket.priority` |
| 5 — Data | **SWEPT** | `query_table` on `x_snc_tsbench_ticket` and `incident` |
| 6 — GenAI stack | **SWEPT** | `genai_log` mode `for_execution`; 3 LLM calls, 0 errors, capability wired correctly |
| 7 — Trigger and wiring | **SWEPT** | `agent_config` section `triggers`; finding raised |
| Platform logs | **UNAVAILABLE** | `syslog` is caller-restricted. An instance administrator must relax `caller_access` on `syslog` or export logs from a permitted scope. This layer was **not** reported as clean. |

---

## ROOT CAUSES

### RC-1 — Integer field rejects string priority value — **CONFIRMED**

| Attribute | Detail |
|---|---|
| **Layer** | 4 — Data schema + 3 — Tool definition |
| **Component** | `x_snc_tsbench_ticket.priority`; tool script on `sn_aia_tool` |
| **Finding** | The `priority` column is typed **Integer** (`type: "Integer"`, `has_choices: false`). The tool script calls `gr.setValue('priority', inputs.priority)` where `inputs.priority` is the string `"critical"`. GlideRecord silently discards the non-numeric string; `update()` still returns success. The post-update readback returns `null`, surfacing as `priority_stored: null` in the tool response. |
| **Evidence** | • `schema_lookup x_snc_tsbench_ticket.priority` → `type: "Integer"`, `has_choices: false` (layer 4) <br>• `query_table x_snc_tsbench_ticket` → row exists, `priority: ""` (blank after write) (layer 5) <br>• Tool response: `{"ok":true, "priority_requested":"critical", "priority_stored":null}` from tool-call record (layer 1) <br>• Tool script body: `gr.setValue('priority', inputs.priority)` — no word-to-integer mapping (layer 3) |
| **Confidence** | **CONFIRMED** — corroborated across layers 1, 3, 4, and 5 |

---

### RC-2 — Both tool inputs declared non-mandatory — **CONFIRMED**

| Attribute | Detail |
|---|---|
| **Layer** | 3 — Tool definition |
| **Component** | `sn_aia_agent_tool_m2m` binding (tool `set_ticket_priority`), field `inputs` |
| **Finding** | Both `ticket` and `priority` are declared `"mandatory": false`. If the model omits either input, the script silently dereferences `undefined` and returns a misleading error rather than a platform-level refusal. |
| **Evidence** | `agent_config` tools section binding inputs: `[{"name":"ticket","mandatory":false},{"name":"priority","mandatory":false}]` |
| **Confidence** | **CONFIRMED** |

---

### RC-3 — No trigger wiring — **CONFIRMED**

| Attribute | Detail |
|---|---|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m` for this agent |
| **Finding** | Zero trigger links on both the agent-direct branch and the team/use-case chain. All reads returned `empty` (not `DENIED`), confirming real absence. The agent cannot be invoked by any automated trigger. |
| **Evidence** | `agent_config` triggers section: `branches: {agent_direct:0, team_usecase_chain:0}`, wiring finding `no_trigger_wiring` severity `high` |
| **Confidence** | **CONFIRMED** |

---

### RC-4 — ReAct parser error / instruction bloat — **CONFIRMED** (recovered)

| Attribute | Detail |
|---|---|
| **Layer** | 1 — Execution trace + 6 — GenAI stack |
| **Component** | Gen AI task (order 100), AIA ReAct Engine |
| **Finding** | First ReAct turn emitted `"Error: Invalid next entry for scratchpad"` and took 30,873 ms (threshold 15,000 ms). Run recovered on turn 2 (4,079 ms). Cause: verbose multi-step instructions are reprocessed on every turn, inflating token volume and raising malformed-output probability. |
| **Evidence** | Task output_digest: `"Error: Invalid next entry for scratchpad"` (layer 1) <br>• Latency flags: `instruction_bloat` on two Gen AI tasks (30,873 ms and 20,598 ms) <br>• Plan header: `llm_p95_latency: 29,846 ms` <br>• GenAI log: 3 LLM calls, 0 provider errors (layer 6 — eliminates provider fault) |
| **Confidence** | **CONFIRMED** |

---

## FIXES

### Fix 1 — Map priority words to integers in the tool script *(addresses RC-1)*

| | |
|---|---|
| **Target type** | Tool script |
| **Target** | `sn_aia_tool` (set_ticket_priority), field `script` |
| **Current** | `gr.setValue('priority', inputs.priority);` — passes the raw string to an Integer field |
| **Proposed** | Add a word-to-integer mapping before `setValue`: |

javascript
var PRIORITY_MAP = { critical:1, high:2, moderate:3, low:4, planning:5 };
var priorityInt = PRIORITY_MAP[(inputs.priority || '').toLowerCase()];
if (priorityInt === undefined) {
    return JSON.stringify({
        ok: false,
        error: 'unrecognised priority word: ' + inputs.priority +
               '. Must be one of: critical, high, moderate, low, planning.'
    });
}
gr.setValue('priority', priorityInt);


Also update the readback return to confirm both forms:
javascript
return JSON.stringify({
    ok: true, ticket: inputs.ticket,
    priority_requested: inputs.priority,
    priority_stored_int: check.getValue('priority'),
    priority_stored_word: inputs.priority
});


| **Rationale** | The Integer column stores 1–5. The model correctly passes the word. The script must bridge the gap without changing the column type, which is used by platform UI and business rules. |

---

### Fix 1-alt — Change `priority` column type to String with choices *(alternative)*

| | |
|---|---|
| **Target type** | Data schema |
| **Target** | `sys_dictionary` row for `x_snc_tsbench_ticket.priority`, field `internal_type` |
| **Current** | `Integer` |
| **Proposed** | Change to `String`/`choice` and add the five word values, or add a separate `priority_label` String column |
| **Rationale** | Eliminates the type mismatch entirely. Choose Fix 1 (script mapping) if other scripts depend on the Integer column. |

---

### Fix 2 — Mark both inputs as mandatory *(addresses RC-2)*

| | |
|---|---|
| **Target type** | Tool input schema |
| **Target** | `sn_aia_agent_tool_m2m` binding (set_ticket_priority), field `inputs` |
| **Current** | `[{"name":"ticket","mandatory":false},{"name":"priority","mandatory":false}]` |
| **Proposed** | `[{"name":"ticket","mandatory":true},{"name":"priority","mandatory":true}]` |
| **Rationale** | Platform refuses the call before the script runs when a mandatory input is absent, surfacing a clear error to the LLM rather than a silent null dereference. |

---

### Fix 3 — Wire a trigger to the agent *(addresses RC-3)*

| | |
|---|---|
| **Target type** | Wiring |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` — create a row linking this agent to an appropriate trigger |
| **Current** | 0 trigger links |
| **Proposed** | Create at least one trigger link in the AI Agent designer (Virtual Agent topic, record-producer, or workflow — builder must choose based on intended deployment channel). |
| **Rationale** | Without a trigger the agent is unreachable except through direct interactive invocation. |

---

### Fix 4 — Reduce instruction length *(addresses RC-4)*

| | |
|---|---|
| **Target type** | Instruction |
| **Target** | `sn_aia_agent` (Seed 01 Ticket Prioritizer), field `instructions` |
| **Current** | Six verbose steps with full working required; reprocessed on every ReAct turn |
| **Proposed** | Condense to essential decision logic (steps 1–4 inline; steps 5–6 as concise output directives). Move reference/lookup data to KB articles retrieved on demand. Target < 800 tokens. |
| **Rationale** | The trace shows LLM p95 latency of 29,846 ms and two instruction-bloat flags. Shorter instructions reduce both cost and the probability of the `Invalid next entry for scratchpad` parser error. |

---

## VERIFICATION

**Verify Fix 1 (priority write)**
1. Replay the same objective interactively.
2. Confirm `priority_stored_int` in the tool response equals `1` (for "critical").
3. Query `x_snc_tsbench_ticket` directly and confirm `priority = 1`.

**Verify Fix 2 (mandatory inputs)**
1. Submit a call omitting `priority`.
2. Confirm the platform returns a binding-level error before the script executes.

**Verify Fix 3 (trigger wiring)**
1. Run `agent_config` section `triggers` after wiring.
2. Confirm `branches.agent_direct ≥ 1` or `team_usecase_chain ≥ 1`.

**Verify Fix 4 (instruction bloat)**
1. Re-run an equivalent execution and confirm `llm_p95_latency < 15,000 ms`.
2. Confirm no `instruction_bloat` latency flags in the trace.

---

## DATA MARKERS

The following record data was quoted as evidence and should be redacted before this report leaves the instance:

- Ticket sys_id: `464bb9152baa475817a6ffbeee91bfa9` (appears in tool request/response and message stream)
- User email: `admin@example.com` (appears in user profile message)
- User sys_id: `6816f79cc0a8016401c5a33be04be441` (appears in conversation sender field)
- Conversation sys_id: `d55b319d2b66cf54f243fed2ce91bf89`
References: null

<!-- END VERBATIM row-01 -->

### Trailing AIA closing summary (not the report; recorded for completeness)

Source: `sn_aia_message` sys_id `d55ef5d52bea475817a6ffbeee91bf0c`, `role` = `agent`, 02:13:37.

<!-- BEGIN VERBATIM row-01-summary -->
Agent Doctor completed a full seven-layer diagnostic sweep of execution plan 4a5bb19d2b66cf54f243fed2ce91bf57 (Seed 01 Ticket Prioritizer). 

Layers swept: 1 (agent_trace), 2 (agent_config instructions), 3 (agent_config tools + full script), 4 (schema_lookup on x_snc_tsbench_ticket.priority), 5 (query_table on x_snc_tsbench_ticket and incident), 6 (genai_log for_execution), 7 (agent_config triggers). Platform logs (syslog) were UNAVAILABLE due to caller restriction — reported as a gap, not as clean.

Four confirmed root causes were identified and reported:
- RC-1 (PRIMARY): The tool script passes the string 'critical' to an Integer column (x_snc_tsbench_ticket.priority). GlideRecord silently discards it; update() returns success but priority_stored comes back null. The priority was never written. Confirmed across layers 1, 3, 4, and 5.
- RC-2: Both tool inputs (ticket, priority) are declared non-mandatory, allowing silent null dereferences if either is omitted.
- RC-3: No trigger wiring exists on either branch; the agent cannot be invoked automatically.
- RC-4: Instruction bloat caused a ReAct parser error (30,873 ms, threshold 15,000 ms) on the first LLM turn; the run recovered but added ~30 s of latency.

Four fixes were proposed: (1) add a word-to-integer mapping in the tool script, (2) mark both inputs mandatory, (3) wire at least one trigger, (4) condense instructions to under 800 tokens. Verification steps and data markers for redaction were also provided. The Fix Report was shown to the user.
<!-- END VERBATIM row-01-summary -->

## 7. Anomalies

- The MCP `servicenow_aia_execute` call returned after 0 s with `State: in_progress` — expected per
  the brief; the run was then polled to terminal.
- The native arm leaves `x_snc_troubleshoot_run.status` at `running` even after the agent execution
  reaches `completed`. Recorded, not fixed.
- The report's own "Platform logs UNAVAILABLE — `syslog` caller-restricted" claim is the agent's
  prose, not a measurement by this operator. Recorded verbatim; not verified, not judged.

---

# row-02-native-seed-01-run-2

## 1. Identity

| field | value |
|---|---|
| arm | NATIVE (`servicenow_aia_execute`, agent `e1392946828940e5a708fc51b0a5e954`) |
| seed / rep | 01 / 2 |
| target plan | `45bbfd112ba6cf54f243fed2ce91bfcb` |
| **run_id** (new `sn_aia_execution_plan` sys_id) | **`853ffd1d2bea475817a6ffbeee91bf0b`** |
| AIA session id | `743ff9192bea475817a6ffbeee91bf97` |
| conversation_ref (on the anchor) | `743fbd1d2bea475817a6ffbeee91bf74` |

Input text (verbatim):

```
Diagnose the failing AI Agent execution with plan sys_id 45bbfd112ba6cf54f243fed2ce91bfcb. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes.
```

## 2. Terminal state

`sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty.

## 3. Wall-clock duration

2026-08-06 02:17:26 → 02:21:43 = **4 m 17 s (257 s)**.

## 4. Audit-derived tool calls

**Anchor-location method:** direct query on `x_snc_troubleshoot_run` with
`execution_ref=853ffd1d2bea475817a6ffbeee91bf0b` (no time window needed — `execution_ref` holds the
native run_id). Anchor sys_id **`a33f355d2bea475817a6ffbeee91bf12`** (`number` TR1000157,
`harness` = `native`, `conversation_ref` `743fbd1d2bea475817a6ffbeee91bf74`, `status` `running`).
**A distinct anchor from row 01** — the 30-min-per-user fallback did not engage; the anchor keyed on
the conversation id, as intended.

Query: `x_snc_troubleshoot_audit` where `run=a33f355d2bea475817a6ffbeee91bf12^action_type=result`.

**Total result rows: 17.** (Matches the plan's `type=tool` task count of 17.)

Ordered `tool_name` list:

1. `agent_trace` (02:17:37)
2. `read_artifact` (02:17:45)
3. `read_artifact` (02:17:57)
4. `read_artifact` (02:17:57)
5. `read_artifact` (02:18:21)
6. `agent_config` (02:18:21)
7. `genai_log` (02:18:21)
8. `query_table` (02:18:43)
9. `read_artifact` (02:18:43)
10. `read_artifact` (02:18:43)
11. `read_artifact` (02:19:17)
12. `log_analysis` (02:19:18)
13. `query_table` (02:19:18)
14. `schema_lookup` (02:19:18)
15. `read_artifact` (02:20:00)
16. `read_artifact` (02:20:00)
17. `genai_log` (02:20:01)

Distinct tool names (7): `agent_trace`, `read_artifact`, `agent_config`, `genai_log`,
`query_table`, `log_analysis`, `schema_lookup`.

**layers_swept (mechanical §E2) = 7/7 (L1,L2,L3,L4,L5,L6,L7)**; `layers_available` = 7/7.

## 5. LLM calls

`gen_ai` = **8** (also: `tool` 17, `agent` 1, `access_verification` 1, `communicator` 1).

## 6. Full report, verbatim

Source: `sn_aia_message` sys_id `172082152b2e475817a6ffbeee91bf2b`, `role` = `agent`,
`name` = `Agent Doctor`, created 2026-08-06 02:21:41. (The sibling row at the same second,
`1f2082152b2e475817a6ffbeee91bfba`, contains only the platform stub
`"The agent/action was invoked successfully."` — not a report.)

<!-- BEGIN VERBATIM row-02 -->

# Fix Report — Execution Plan `45bbfd112ba6cf54f243fed2ce91bfcb`

---

## FAILURE SUMMARY

The user asked agent **Seed 01 Ticket Prioritizer** to set the priority on bench ticket `a64b795d2b66cf54f243fed2ce91bf11` to match a P1 urgency description ("checkout service failing for every customer, no workaround"). The agent ran to completion, called `set_ticket_priority` with `priority = "critical"`, and reported success — but the priority on the ticket record was never written. The tool returned `priority_stored: null`, and the ticket's `priority` field is still blank after the run. The silent failure is caused by a **type mismatch**: the `priority` column is declared as **Integer** on the table, but the tool script passes a plain string word ("critical") to `gr.setValue()`. ServiceNow's GlideRecord silently discards a non-numeric string written to an Integer column and leaves the field unchanged. A secondary issue is that both tool inputs (`ticket`, `priority`) are declared non-mandatory, so neither the platform nor the LLM is warned when they are absent or malformed. The agent's own description flags it as "deliberately broken," confirming the defect is intentional for benchmark purposes.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | Plan state Completed; 3 LLM calls, 1 tool call; `priority_stored: null` confirmed |
| 2 | Instructions | **SWEPT** | Instructions well-formed; no script errors in agent instructions |
| 3 | Tool definitions | **SWEPT** | Script body and input schema fully read; type-mismatch and non-mandatory inputs confirmed |
| 4 | Data schemas | **SWEPT** | `x_snc_tsbench_ticket.priority` confirmed Integer |
| 5 | Data | **SWEPT** | Ticket record exists; priority field blank post-run |
| 6 | GenAI stack | **SWEPT** | 3 LLM calls all succeeded (claude-sonnet-4-6 via Amazon Bedrock); no capability findings |
| 7 | Trigger and wiring | **SWEPT** | No trigger links — consistent with conversational invocation; not a defect for this run |
| — | Platform logs | **UNAVAILABLE** | `syslog` is caller-restricted; a cross-scope privilege is installed but cannot lift a caller restriction. An instance administrator must relax `caller_access` on `syslog` or export log evidence independently. |

---

## ROOT CAUSES

### RC-1 — Type mismatch: string written to Integer priority field

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 (Tool definition) + 4 (Data schema) |
| **Component** | `sn_aia_tool` record `set_ticket_priority` · script body; `x_snc_tsbench_ticket.priority` column |
| **Finding** | The tool calls `gr.setValue('priority', inputs.priority)` where `inputs.priority` is a word such as `"critical"`. The column is declared **type: Integer**. GlideRecord silently coerces a non-numeric string to null and performs no write. The read-back `check.getValue('priority')` therefore returns null, which the tool faithfully reports as `priority_stored: null`. |
| **Evidence** | • `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac` — script body (agent_config artifact, page 3): `gr.setValue('priority', inputs.priority); … priority_stored: check.getValue('priority')` → returns `null` · • `schema_lookup` on `x_snc_tsbench_ticket`: field `priority`, type = **Integer** · • Execution task `b2dbf5912ba6cf54f243fed2ce91bf2a` output: `{"ok":true,"priority_requested":"critical","priority_stored":null}` · • Message stream sys_id `32dbf5912ba6cf54f243fed2ce91bfc1`: same null confirmed |
| **Confidence** | **CONFIRMED** — two independent layers agree |

---

### RC-2 — Both tool inputs declared non-mandatory

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 (Tool definition) |
| **Component** | `sn_aia_agent_tool_m2m` binding sys_id `1fa91a286055441bb4afce79fe876207`, `inputs` field |
| **Finding** | Both `ticket` and `priority` are `mandatory: false`. A missing or malformed argument causes a silent null rather than a validation error visible to the LLM or operator. |
| **Evidence** | agent_config artifact page 2 — binding inputs: `[{"name":"ticket",…"mandatory":false},{"name":"priority",…"mandatory":false}]` |
| **Confidence** | **CONFIRMED** |

---

### RC-3 — First LLM call produced a ReAct parser TypeError (recovered)

| Attribute | Value |
|-----------|-------|
| **Layer** | 1 (Execution trace) |
| **Component** | Gen AI task sys_id `99bb31512ba6cf54f243fed2ce91bf16` |
| **Finding** | The first LLM call triggered `TypeError: Cannot read property "Name" from undefined` in the ReAct output parser. The engine retried and recovered. This is a latent fragility, not the cause of the silent write failure, but it extended wall-clock time by ~26 seconds. |
| **Evidence** | Execution task output_digest: `"I have encountered a fatal error (TypeError: Cannot read property \"Name\\" from undefined) with the ReAct output parser and would like to retry the same execution."` |
| **Confidence** | **CONFIRMED** as an error; root cause of the TypeError itself is **UNCONFIRMED** — platform logs (unavailable) would be needed to confirm whether this originates in the capability definition or the engine version. |

---

## FIXES

### Fix 1 — Map priority words to integers in the tool script *(addresses RC-1)*

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool definition — script |
| **Target** | `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac`, field `script` |
| **Current** | `gr.setValue('priority', inputs.priority);` — passes raw word string |
| **Proposed** | Add a mapping at the top of the IIFE before the write: `var MAP = {critical:1, high:2, moderate:3, low:4, planning:5}; var numericPriority = MAP[String(inputs.priority).toLowerCase()]; if (numericPriority === undefined) { return JSON.stringify({ok:false, error:'unknown priority word: ' + inputs.priority}); } gr.setValue('priority', numericPriority);` |
| **Rationale** | The column is Integer; the mapping converts the accepted vocabulary to the stored values. An unknown word now returns an explicit error rather than a silent null. |

---

### Fix 2 — Mark both inputs mandatory *(addresses RC-2)*

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool definition — input schema |
| **Target** | `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac`, field `input_schema`; also `sn_aia_agent_tool_m2m` sys_id `1fa91a286055441bb4afce79fe876207`, field `inputs` |
| **Current** | Both inputs have `"mandatory": false` |
| **Proposed** | Set `"mandatory": true` for both `ticket` and `priority` |
| **Rationale** | Mandatory inputs force the platform to surface a validation error before the script runs if either argument is absent, rather than silently passing null. |

---

### Fix 3 — Add output guidance to the tool description *(defensive; addresses tool smell)*

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool definition — description |
| **Target** | `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac`, field `description` |
| **Current** | `"Sets the priority on a bench ticket. Give it the ticket sys_id and the priority as a word - critical, high, moderate, low or planning. Returns the ticket number and the priority that was stored."` |
| **Proposed** | Append: `"If priority_stored is null in the response, the write did not succeed and the priority was not changed."` |
| **Rationale** | The LLM currently reads `ok:true` and ignores `priority_stored:null`. Explicit output guidance makes the failure case interpretable without the builder changing the ReAct instructions. |

---

## VERIFICATION

1. Apply Fix 1 (integer mapping) and Fix 2 (mandatory inputs) to the tool record.
2. Re-run the agent with the same objective: _"Ticket `a64b795d2b66cf54f243fed2ce91bf11`: checkout service failing… set priority."_
3. Expect the tool response to return `priority_stored: 1` (or the integer matching "critical").
4. Query `x_snc_tsbench_ticket` sys_id `a64b795d2b66cf54f243fed2ce91bf11`, field `priority` — it must be non-blank and match the mapped integer.
5. Confirm the execution plan completes with no `priority_stored: null` in the message stream.

---

## DATA MARKERS

The following record data was quoted as evidence above and should be redacted before this report crosses the instance boundary:

- Ticket sys_id: `a64b795d2b66cf54f243fed2ce91bf11`
- User sys_id from message stream: `6816f79cc0a8016401c5a33be04be441`
- User email quoted in run context: `admin@example.com`
References: null

<!-- END VERBATIM row-02 -->

## 7. Anomalies

- None beyond the standing native-arm behaviours already noted in row 01 (background completion,
  anchor `status` left at `running`).

---

# row-03-native-seed-03-run-1

## 1. Identity

| field | value |
|---|---|
| arm | NATIVE (`servicenow_aia_execute`, agent `e1392946828940e5a708fc51b0a5e954`) |
| seed / rep | 03 / 1 |
| target plan | `3afbf1192baa475817a6ffbeee91bf10` |
| **run_id** (new `sn_aia_execution_plan` sys_id) | **`74010e192b2e475817a6ffbeee91bfda`** |
| AIA session id | `e0010e192b2e475817a6ffbeee91bf56` |
| conversation_ref (on the anchor) | `2c0186152b2e475817a6ffbeee91bf97` |

Input text (verbatim):

```
Diagnose the failing AI Agent execution with plan sys_id 3afbf1192baa475817a6ffbeee91bf10. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes.
```

## 2. Terminal state

`sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty.

## 3. Wall-clock duration

2026-08-06 02:25:20 → 02:28:07 = **2 m 47 s (167 s)**.

## 4. Audit-derived tool calls

**Anchor-location method:** direct query on `x_snc_troubleshoot_run` with
`execution_ref=74010e192b2e475817a6ffbeee91bfda`. Anchor sys_id
**`df0182592b2e475817a6ffbeee91bf72`** (`number` TR1000158, `harness` = `native`,
`conversation_ref` `2c0186152b2e475817a6ffbeee91bf97`, `status` `running`). Distinct anchor again —
no gluing to rows 01/02.

Query: `x_snc_troubleshoot_audit` where `run=df0182592b2e475817a6ffbeee91bf72^action_type=result`.

**Total result rows: 13.** (Matches the plan's `type=tool` task count of 13.)

Ordered `tool_name` list:

1. `agent_trace` (02:25:31)
2. `read_artifact` (02:25:41)
3. `read_artifact` (02:25:41)
4. `read_artifact` (02:25:41)
5. `read_artifact` (02:25:41)
6. `agent_config` (02:26:04)
7. `genai_log` (02:26:04)
8. `read_artifact` (02:26:23)
9. `read_artifact` (02:26:23)
10. `read_artifact` (02:26:23)
11. `log_analysis` (02:26:51)
12. `schema_lookup` (02:26:51)
13. `query_table` (02:26:51)

Distinct tool names (7): `agent_trace`, `read_artifact`, `agent_config`, `genai_log`,
`log_analysis`, `schema_lookup`, `query_table`.

**layers_swept (mechanical §E2) = 7/7 (L1,L2,L3,L4,L5,L6,L7)**; `layers_available` = 7/7.

## 5. LLM calls

`gen_ai` = **6** (also: `tool` 13, `agent` 1, `access_verification` 1, `communicator` 1).

## 6. Full report, verbatim

Source: `sn_aia_message` sys_id `c5a18e5d2b2e475817a6ffbeee91bf52`, `role` = `agent`,
`name` = `Agent Doctor`, created 2026-08-06 02:28:05. (Sibling row `c5a18e5d2b2e475817a6ffbeee91bf7e`
at the same second holds only the stub `"The agent/action was invoked successfully."`)

<!-- BEGIN VERBATIM row-03 -->

## Fix Report — Execution Plan `3afbf1192baa475817a6ffbeee91bf10`

---

### FAILURE SUMMARY

The user asked agent **Seed 03 Category Router** to route a Hardware-category request to the correct assignment group. The agent ran to completion without error: it called the `lookup_routing_rule` tool, which queried table `x_snc_tsbench_routing` and returned `{matched: false, rules_in_table: 0}`. The LLM correctly interpreted the empty result and told the user no assignment group was found. The execution plan state is **Completed** — there is no crash or timeout — but the agent produced no routing answer because the routing table contains zero rows. The defect is missing seed data, not a code or configuration error.

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | Plan completed; 1 tool call; `rules_in_table:0, matched:false` |
| 2 | Agent instructions | **SWEPT** | Instructions structurally present; 329 chars; no script errors |
| 3 | Tool definitions | **SWEPT** | 1 tool (`lookup_routing_rule`), binding active, script correct |
| 4 | Data schemas | **SWEPT** | `x_snc_tsbench_routing` exists; columns `category` and `assignment_group` confirmed |
| 5 | Data | **SWEPT** | Table is **genuinely empty** — 0 rows confirmed without ACL filtering |
| 6 | GenAI stack | **SWEPT** | 2 LLM calls to `claude-sonnet-4-6` via `AIA ReAct Engine_Amazon Bedrock`; both succeeded; no errors |
| 7 | Trigger and wiring | **SWEPT** | No trigger wiring rows exist; agent ran interactively/conversationally, so this is expected and not a defect |
| — | Platform logs (syslog) | **UNAVAILABLE** | `syslog` table has `caller_access` restriction; DENIED for this scope. An instance administrator must either relax `caller_access` on `syslog` or export the log entries from a permitted scope. Platform-level script errors around (not inside) the run were therefore not swept. |

---

### ROOT CAUSES

**Root Cause 1 — Missing routing data (PRIMARY)**

| Attribute | Value |
|-----------|-------|
| **Layer** | 5 — Data |
| **Component** | Table `x_snc_tsbench_routing` |
| **Finding** | The table exists and is structurally correct, but contains **zero rows**. The tool script counted all rows (`rules_in_table: 0`) and queried by category (`matched: false`). There are no routing rules for any category, including Hardware. |
| **Evidence** | `query_table` → `x_snc_tsbench_routing`, read_status `empty`, `unfiltered_row_count: 0`, `verdict: genuinely_empty` (confirmed without ACL filtering). Tool call response: `{ok:true, matched:false, category:"Hardware", rules_in_table:0}` — `sn_aia_tools_execution` sys_id `b80c39192baa475817a6ffbeee91bf6a`. |
| **Confidence** | **CONFIRMED** — two independent reads (tool script at runtime + `query_table` diagnostic) agree. |

---

**Root Cause 2 — `category` input not marked mandatory (CONTRIBUTING)**

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` sys_id `3bd31a0be63d4e81856598dbd2c96788`, input schema field `category` |
| **Finding** | The `category` input is declared with `mandatory: false`. The tool's entire query pivot is this field; if the LLM omits it, the query returns all rows (or, on an empty table, zero rows) with no diagnostic signal about a missing input. |
| **Evidence** | `agent_config` tools section → binding sys_id `3bacb3ef18454586b86a87f11ffaae9a`, `inputs: [{"name":"category","mandatory":false}]`. Tool script has no null/missing-input guard before `gr.addQuery('category', inputs.category)`. |
| **Confidence** | **CONFIRMED** (configuration) — impact on this specific run is **UNCONFIRMED** because the LLM did pass `category:"Hardware"` correctly in this execution; the risk is latent. |

---

**Root Cause 3 — Tool description lacks negative guidance and input format statement (MINOR)**

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` sys_id `3bd31a0be63d4e81856598dbd2c96788`, `description` field |
| **Finding** | The description does not state what inputs the tool expects or what the caller should do when the tool returns `matched:false`. The LLM correctly handled the empty result in this run because the instructions are well-written, but the tool itself provides no contract boundary. |
| **Evidence** | `agent_config` tools section → `description`: *"Looks up the assignment group for a category in the bench routing table. Give it a category name. Returns the matching assignment group, or reports explicitly that no rule matched."* Tool smells logged: `description_no_negative_guidance`, `description_no_input_guidance`. |
| **Confidence** | **CONFIRMED** (text scan) — behavioural impact in this run was nil; risk is latent. |

---

### FIXES

**Fix 1 — Seed the routing table (addresses Root Cause 1)**

| Attribute | Value |
|-----------|-------|
| **Target type** | Data |
| **Target** | Table `x_snc_tsbench_routing` |
| **Current** | 0 rows |
| **Proposed** | Insert at minimum one row with `category = Hardware` and `assignment_group = <correct group name>`. Seed all categories the agent is expected to handle. |
| **Rationale** | The tool script and schema are correct. The only reason `matched:false` was returned is the absence of data. Inserting the routing rules directly resolves the failure. |

---

**Fix 2 — Mark `category` input mandatory (addresses Root Cause 2)**

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` sys_id `3bd31a0be63d4e81856598dbd2c96788`, input schema → `category` → `mandatory` |
| **Current** | `mandatory: false` |
| **Proposed** | `mandatory: true` |
| **Rationale** | The tool cannot return a meaningful result without this field. Marking it mandatory causes the platform to reject a call that omits it before the script runs, producing a clear failure signal rather than a silent empty-match. |

---

**Fix 3 — Add input validation to the tool script (addresses Root Cause 2)**

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema / script |
| **Target** | `sn_aia_tool` sys_id `3bd31a0be63d4e81856598dbd2c96788`, `script` field |
| **Current** | Script reads `inputs.category` directly with no null/empty guard |
| **Proposed** | Add a guard at the top of the IIFE: `if (!inputs.category) { return JSON.stringify({ok:false, error:'category input is required'}); }` |
| **Rationale** | Defensive validation ensures a missing or empty input produces an actionable error message rather than silently querying with a blank category value. |

---

**Fix 4 — Strengthen tool description (addresses Root Cause 3)**

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` sys_id `3bd31a0be63d4e81856598dbd2c96788`, `description` field |
| **Current** | *"Looks up the assignment group for a category in the bench routing table. Give it a category name. Returns the matching assignment group, or reports explicitly that no rule matched."* |
| **Proposed** | Append: *"Input: category (string, required) — the exact category name. Do not call this tool without a known category. When matched:false is returned, report the absence to the user and do not guess an assignment group."* |
| **Rationale** | Explicit negative guidance prevents the model from calling the tool speculatively or fabricating a fallback answer when no match is found. |

---

### VERIFICATION

1. After inserting routing rows (Fix 1): Re-run the same objective — *"Please route a request in the Hardware category to the correct assignment group."* — against agent `Seed 03 Category Router`.
2. Confirm the new execution plan shows a tool call response where `matched:true` and `assignment_group` is populated.
3. Confirm the agent's final message contains the assignment group name rather than a "no match" notice.
4. To verify Fix 2 and Fix 3: Invoke the tool with an empty `category` and confirm the call is rejected at the platform level (mandatory) or returns `{ok:false, error:"category input is required"}` (script guard).

---

### DATA MARKERS

The following record data was cited as evidence and should be reviewed for redaction before this report leaves the instance:

- User profile message: `user Email: admin@example.com`, `user Sys ID: 6816f79cc0a8016401c5a33be04be441` — sourced from `sn_aia_message` (User Profile role), execution plan `3afbf1192baa475817a6ffbeee91bf10`.
- Tool call request/response payload: `{category:"Hardware"}` / `{ok:true, matched:false, category:"Hardware", rules_in_table:0}` — sourced from `sn_aia_tools_execution` sys_id `b80c39192baa475817a6ffbeee91bf6a`. These values are configuration-level and low-sensitivity, but are flagged per protocol.

---

> **Note on platform logs:** The `syslog` table was DENIED for this diagnostic scope due to a `caller_access` restriction. The platform log layer was **not swept**. Script errors raised *outside* the execution boundary (e.g., platform-level ACL evaluation or trigger resolution errors) were not observable. To sweep this layer, an instance administrator must relax `caller_access` on `syslog` or provide a log export from a permitted scope.
References: null

<!-- END VERBATIM row-03 -->

## 7. Anomalies

- None beyond the standing native-arm behaviours noted in row 01.

---

# row-04-native-seed-03-run-2

## 1. Identity

| field | value |
|---|---|
| arm | NATIVE (`servicenow_aia_execute`, agent `e1392946828940e5a708fc51b0a5e954`) |
| seed / rep | 03 / 2 |
| target plan | `1a1c71152ba6cf54f243fed2ce91bf31` |
| **run_id** (new `sn_aia_execution_plan` sys_id) | **`a6c2061d2b2acf54f243fed2ce91bf34`** |
| AIA session id | `96c2c21d2b2acf54f243fed2ce91bfec` |
| conversation_ref (on the anchor) | `a2c282912be6cf54f243fed2ce91bf52` |

Input text (verbatim):

```
Diagnose the failing AI Agent execution with plan sys_id 1a1c71152ba6cf54f243fed2ce91bf31. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes.
```

## 2. Terminal state

`sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty.

## 3. Wall-clock duration

2026-08-06 02:33:06 → 02:36:43 = **3 m 37 s (217 s)**.

## 4. Audit-derived tool calls

**Anchor-location method:** direct query on `x_snc_troubleshoot_run` with
`execution_ref=a6c2061d2b2acf54f243fed2ce91bf34`. Anchor sys_id
**`a9d28a1d2b2acf54f243fed2ce91bfcf`** (`number` TR1000159, `harness` = `native`,
`conversation_ref` `a2c282912be6cf54f243fed2ce91bf52`, `status` `running`).

Query: `x_snc_troubleshoot_audit` where `run=a9d28a1d2b2acf54f243fed2ce91bfcf^action_type=result`.

**Total result rows: 16.** (Matches the plan's `type=tool` task count of 16.)

Ordered `tool_name` list:

1. `agent_trace` (02:33:18)
2. `read_artifact` (02:33:28)
3. `read_artifact` (02:33:39)
4. `read_artifact` (02:33:39)
5. `log_analysis` (02:34:04)
6. `genai_log` (02:34:05)
7. `agent_config` (02:34:05)
8. `read_artifact` (02:34:29)
9. `read_artifact` (02:34:29)
10. `read_artifact` (02:34:55)
11. `read_artifact` (02:34:55)
12. `genai_log` (02:34:55)
13. `read_artifact` (02:35:26)
14. `genai_log` (02:35:26)
15. `query_table` (02:35:26)
16. `schema_lookup` (02:35:26)

Distinct tool names (7): `agent_trace`, `read_artifact`, `log_analysis`, `genai_log`,
`agent_config`, `query_table`, `schema_lookup`.

**layers_swept (mechanical §E2) = 7/7 (L1,L2,L3,L4,L5,L6,L7)**; `layers_available` = 7/7.

## 5. LLM calls

`gen_ai` = **8** (also: `tool` 16, `agent` 1, `access_verification` 1, `communicator` 1).

## 6. Full report, verbatim

Source: `sn_aia_message` sys_id `83934e912b6acf54f243fed2ce91bf73`, `role` = `agent`,
`name` = `Agent Doctor`, created 2026-08-06 02:36:41. (Sibling row `5b934e912b6acf54f243fed2ce91bf7a`
holds only the stub `"The agent/action was invoked successfully."`)

<!-- BEGIN VERBATIM row-04 -->

## Fix Report — Agent: Seed 03 Category Router
**Execution Plan:** `1a1c71152ba6cf54f243fed2ce91bf31`

---

### FAILURE SUMMARY

The user asked the agent to route a Software-category request to the correct assignment group. The agent ran to completion without error: it invoked the `lookup_routing_rule` tool, which queried the `x_snc_tsbench_routing` table and returned `{matched: false, rules_in_table: 0}`. Because the routing table contains zero rows, the agent had no data to resolve the assignment group and correctly reported that no matching rule was found. The agent behaved exactly as designed — the failure is a missing data problem, not a logic or configuration problem.

---

### LAYERS SWEPT

| Layer | Status | Notes |
|-------|--------|-------|
| 1 — Execution trace | **SWEPT** | Full task tree and tool call read. |
| 2 — Instructions | **SWEPT** | Instruction text read from `sn_aia_agent`. |
| 3 — Tool definitions | **SWEPT** | Tool script and input schema read. |
| 4 — Data schemas | **SWEPT** | `x_snc_tsbench_routing` table and columns confirmed. |
| 5 — Data | **SWEPT** | Table queried; confirmed genuinely empty. |
| 6 — GenAI stack | **SWEPT** | Capability definition audited by sys_id; all bindings resolved. |
| 7 — Trigger and wiring | **SWEPT** | No trigger wiring present; agent invoked interactively (expected). |
| Platform logs | **UNAVAILABLE** | `syslog` table is caller-restricted. An instance administrator must either relax `caller_access` on `syslog` or export logs directly. No script errors were observed in the execution message stream (the nearest available substitute). |

---

### ROOT CAUSES

#### RC-1 — Routing table is empty

| Field | Value |
|-------|-------|
| **Layer** | 5 — Data |
| **Component** | Table `x_snc_tsbench_routing` |
| **Finding** | The table contains zero rows. The tool's own COUNT aggregate confirmed `rules_in_table: 0` at runtime, and `query_table` confirmed `unfiltered_row_count: 0` (verdict: `genuinely_empty`). |
| **Evidence** | `query_table` → `x_snc_tsbench_routing`, read_status `empty`, empty_verdict `genuinely_empty`, unfiltered count 0. Tool call response (sn_aia_tools_execution `ec2cf5152ba6cf54f243fed2ce91bf08`): `{"ok":true,"matched":false,"category":"Software","rules_in_table":0}`. |
| **Confidence** | **CONFIRMED** — two independent reads (GlideAggregate inside tool script + GlideRecordSecure from query_table) both return zero. |

#### RC-2 — `category` input is not marked mandatory on the tool binding

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_agent_tool_m2m` binding `3bacb3ef18454586b86a87f11ffaae9a`, field `inputs` |
| **Finding** | The `category` input has `mandatory: false`. If the model omits the input, the script runs with `inputs.category` undefined and silently returns no match rather than an error. |
| **Evidence** | `agent_config` tools section, binding `3bacb3ef18454586b86a87f11ffaae9a`: `input_schema: [{"name":"category","description":"The category to look up in the routing table.","mandatory":false}]`. |
| **Confidence** | **CONFIRMED** — value is directly read from the binding record. |

#### RC-3 — Tool script has no input validation or normalisation

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` `3bd31a0be63d4e81856598dbd2c96788`, field `script` |
| **Finding** | The script uses `inputs.category` directly in a GlideRecord query without checking for null, blank, or unexpected format. A missing or wrongly-cased category value produces a silent no-match rather than a detectable error. |
| **Evidence** | `agent_config` tool script body: `gr.addQuery('category', inputs.category); gr.query(); if (!gr.next()) { return JSON.stringify({...matched:false...}) }`. Tool quality checker flagged `script_no_input_validation` (severity: medium, confidence: heuristic). |
| **Confidence** | **CONFIRMED** (code read directly). |

#### RC-4 — No trigger wiring (informational)

| Field | Value |
|-------|-------|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m` |
| **Finding** | Zero trigger links on both the agent-direct and team/usecase branches. |
| **Evidence** | `agent_config` triggers section: `wiring_findings[0].finding: "no_trigger_wiring"`, `trigger_link_rows: 0`. |
| **Confidence** | **CONFIRMED** — all reads behind the traversal succeeded. This is expected for an interactively-invoked agent. Not a blocking defect for the current execution mode, but means the agent cannot self-start on a record event. |

---

### FIXES

#### FIX-1 — Seed routing data into `x_snc_tsbench_routing`

| Field | Value |
|-------|-------|
| **Target type** | Data |
| **Target** | Table `x_snc_tsbench_routing` |
| **Current** | 0 rows |
| **Proposed** | Insert at minimum one row with `category = Software` and `assignment_group = <the correct group name>`. Seed additional rows for every category the agent is expected to handle. |
| **Rationale** | This is the direct cause of RC-1. Until at least one row exists, every category lookup returns `matched: false` regardless of any other fix. |

#### FIX-2 — Mark the `category` input mandatory

| Field | Value |
|-------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_agent_tool_m2m` binding `3bacb3ef18454586b86a87f11ffaae9a`, field `inputs` |
| **Current** | `[{"name":"category","description":"The category to look up in the routing table.","mandatory":false}]` |
| **Proposed** | `[{"name":"category","description":"The category name to look up in the routing table. Must be a plain string (e.g. \"Software\"). Required.","mandatory":true}]` |
| **Rationale** | Addresses RC-2. A mandatory flag causes the platform to refuse a tool call that omits the input, surfacing the failure clearly rather than silently returning no match. |

#### FIX-3 — Add defensive input validation to the tool script

| Field | Value |
|-------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `3bd31a0be63d4e81856598dbd2c96788`, field `script` |
| **Current** | `inputs.category` used directly with no null/blank check. |
| **Proposed** | At the top of the IIFE, add: `var cat = (inputs.category || '').toString().trim(); if (!cat) { return JSON.stringify({ok: false, error: 'category input is required'}); }` Then use `cat` in place of `inputs.category` throughout. |
| **Rationale** | Addresses RC-3. Prevents a silent no-match when the model passes a null, blank, or stringified-JSON value. |

---

### VERIFICATION

1. After inserting at least one routing row (FIX-1), re-run the agent with the same objective: *"Please route a request in the Software category to the correct assignment group."*
2. Confirm the `lookup_routing_rule` tool call response shows `matched: true` and a non-empty `assignment_group`.
3. Confirm the agent's final message to the user names the correct assignment group.
4. To verify FIX-2 and FIX-3, attempt a call that omits the category input (or passes a blank). The tool should return `{ok: false, error: 'category input is required'}` rather than a silent no-match.

---

### DATA MARKERS

The following record data was quoted above as evidence and should be reviewed before this report crosses the instance boundary:

- Tool call response payload from `sn_aia_tools_execution` `ec2cf5152ba6cf54f243fed2ce91bf08`: `{"ok":true,"matched":false,"category":"Software","rules_in_table":0}`
- User message content: *"Please route a request in the Software category to the correct assignment group."*
- Agent final message content (category name and rules_in_table count)

All of the above are configuration/routing metadata. No personal or sensitive user data was observed in the execution record.
References: null

<!-- END VERBATIM row-04 -->

## 7. Anomalies

- None beyond the standing native-arm behaviours noted in row 01.

---

# row-05-native-seed-04-run-1

## 1. Identity

| field | value |
|---|---|
| arm | NATIVE (`servicenow_aia_execute`, agent `e1392946828940e5a708fc51b0a5e954`) |
| seed / rep | 04 / 1 |
| target plan | `4e3c35552ba6cf54f243fed2ce91bf47` |
| **run_id** (new `sn_aia_execution_plan` sys_id) | **`e064ce952b6acf54f243fed2ce91bf28`** |
| AIA session id | `9864c6952b6acf54f243fed2ce91bfd5` |
| conversation_ref (on the anchor) | `986442d12b6acf54f243fed2ce91bfd7` |

Input text (verbatim):

```
Diagnose the failing AI Agent execution with plan sys_id 4e3c35552ba6cf54f243fed2ce91bf47. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes.
```

## 2. Terminal state

`sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty.

## 3. Wall-clock duration

2026-08-06 02:40:04 → 02:45:42 = **5 m 38 s (338 s)**.

## 4. Audit-derived tool calls

**Anchor-location method:** direct query on `x_snc_troubleshoot_run` with
`execution_ref=e064ce952b6acf54f243fed2ce91bf28`. Anchor sys_id
**`d76446d52b6acf54f243fed2ce91bf13`** (`number` TR1000160, `harness` = `native`,
`conversation_ref` `986442d12b6acf54f243fed2ce91bfd7`, `status` `running`).

Query: `x_snc_troubleshoot_audit` where `run=d76446d52b6acf54f243fed2ce91bf13^action_type=result`.

**Total result rows: 14.** (Matches the plan's `type=tool` task count of 14.)

Ordered `tool_name` list:

1. `agent_trace` (02:40:15)
2. `read_artifact` (02:40:25)
3. `read_artifact` (02:40:38)
4. `read_artifact` (02:40:38)
5. `read_artifact` (02:41:06)
6. `genai_log` (02:41:06)
7. `agent_config` (02:41:06)
8. `read_artifact` (02:41:39)
9. `log_analysis` (02:41:39)
10. `query_table` (02:41:39)
11. `read_artifact` (02:42:07)
12. `read_artifact` (02:42:36)
13. `query_table` (02:42:36)
14. `schema_lookup` (02:42:37)

Distinct tool names (7): `agent_trace`, `read_artifact`, `genai_log`, `agent_config`,
`log_analysis`, `query_table`, `schema_lookup`.

**layers_swept (mechanical §E2) = 7/7 (L1,L2,L3,L4,L5,L6,L7)**; `layers_available` = 7/7.

## 5. LLM calls

`gen_ai` = **9** (also: `tool` 14, `agent` 1, `access_verification` 1, `communicator` 1).

## 6. Full report, verbatim

Source: `sn_aia_message` sys_id `fea50a112baacf54f243fed2ce91bf32`, `role` = `agent`,
`name` = `Agent Doctor`, created 2026-08-06 02:45:40.

<!-- BEGIN VERBATIM row-05 -->

## Fix Report — Agent: Seed 04 Summarizer
**Execution Plan:** `4e3c35552ba6cf54f243fed2ce91bf47`

---

### FAILURE SUMMARY

The user asked agent **Seed 04 Summarizer** to summarise bench ticket `5b4b3d152baa475817a6ffbeee91bf2b`. The agent correctly selected the `summarise_ticket` tool and passed the sys_id. The tool executed without a script error, but internally calls `sn_one_extend.OneExtendUtil.execute()` against capability `92ff62af516741769c437feb88c80ef3` (`x_snc_tsbench_unmapped_capability`). That capability's definition row points `api` at the nil GUID `00000000000000000000000000000000`, which resolves to no record in `sys_hub_flow`. The executor cannot dispatch the LLM call, returns `status:"error"` with an empty `requestPayload`, and the agent surfaces the misleading message *"The agent/action was invoked successfully"* — masking the failure. The agent description itself states it is *"deliberately broken"*, confirming this is a seeded defect.

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `agent_trace` on plan `4e3c35552ba6cf54f243fed2ce91bf47` |
| 2 | Instructions | **SWEPT** | `agent_config` instructions section |
| 3 | Tool definitions | **SWEPT** | `agent_config` tools section + script body |
| 4 | Data schemas | **SWEPT** | `schema_lookup` on `x_snc_tsbench_ticket` |
| 5 | Data | **SWEPT** | `query_table` on `x_snc_tsbench_ticket` — target record confirmed present |
| 6 | GenAI stack | **SWEPT** | `genai_log check_config` on capability `92ff62af516741769c437feb88c80ef3` |
| 7 | Trigger and wiring | **SWEPT** | `agent_config` triggers section |
| — | Platform logs | **UNAVAILABLE** | `syslog` read was DENIED (caller restriction). An instance administrator must relax `caller_access` on `syslog` or provide a log export to sweep this layer. |

---

### ROOT CAUSES

#### Root Cause 1 — Dangling capability `api` binding *(PRIMARY — blocks every execution)*

- **Layer:** 6 – GenAI stack
- **Component:** `sys_one_extend_capability_definition` · sys_id `904c0485699a4a73a124446a7231c563` · name `x_snc_tsbench_unmapped_capability (Now LLM Service - unmapped)`
- **Finding:** The mandatory field `api` holds the nil GUID `00000000000000000000000000000000`, which matches no row in `sys_hub_flow` (the table named by `api_type`). The executor cannot resolve a provider flow and returns `status:"error"` with an empty `requestPayload`.
- **Evidence:**
  - `genai_log check_config` → `definitions[0]`: `api_type = sys_hub_flow`, `api = 00000000000000000000000000000000`, `api_state = dangling`; `sys_hub_flow` table read status = empty (0 rows); `findings[0].finding = api_dangling`, severity = **high**
  - `agent_trace` → `tool_calls[0].response_digest`: `ok:false`, `status:"error"`, `requestPayload:{}`
- **Confidence:** **CONFIRMED** — trace shows the tool call returning error; `genai_log` independently confirms the nil `api` binding on the exact `capability_id` the tool script invokes.

---

#### Root Cause 2 — `active_tool_count: 0` discrepancy

- **Layer:** 3 – Tool definitions
- **Component:** `sn_aia_agent` sys_id `8bac1f84f3a1481487fe8dd219295914`
- **Finding:** `agent_config` overview reports `tool_count: 1` but `active_tool_count: 0`, even though both the tool (`sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac`, `active:"1"`) and its binding (`sn_aia_agent_tool_m2m` `3c72dab2668c4ba5a6080a5cd5fb2b91`, `active:"1"`) report active. The run did invoke the tool, so this may be a reporting artefact rather than a second execution block.
- **Evidence:** `agent_config` overview fields `tool_count = 1`, `active_tool_count = 0`; `agent_config` tools section `binding.active = "1"`, `tool.active = "1"`
- **Confidence:** **UNCONFIRMED** — the field driving the discrepancy is not surfaced by `agent_config`. Inspect `sn_aia_agent_tool_m2m` record `3c72dab2668c4ba5a6080a5cd5fb2b91` and `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac` directly to confirm.

---

#### Root Cause 3 — `ticket` input not declared mandatory

- **Layer:** 3 – Tool definitions
- **Component:** `sn_aia_tool` sys_id `37d6957bb5cd4bda96fc9a93de494eac` · input `ticket` · field `mandatory`
- **Finding:** `mandatory: false` means the model could call the tool without supplying a sys_id. The script passes `inputs.ticket` directly to the capability payload; an absent sys_id produces an empty payload and the same error path as the capability misconfiguration.
- **Evidence:** `agent_config` `tools[0].binding.inputs` and `tools[0].tool.input_schema`: `[{"name":"ticket","mandatory":false}]`
- **Confidence:** **CONFIRMED** as a configuration defect; its contribution to *this* specific failure is secondary because the model did supply the sys_id correctly in this run.

---

#### Root Cause 4 — No trigger wiring

- **Layer:** 7 – Trigger and wiring
- **Component:** `sn_aia_trigger_agent_usecase_m2m`
- **Finding:** Zero trigger links on both agent-direct and team/usecase-chain branches. The agent can only be started via direct API or conversational invoke; it will never fire autonomously on a record event.
- **Evidence:** `agent_config` triggers section: `links = []`, `wiring_findings[0].finding = no_trigger_wiring`, severity = **high**; agent-direct rows = 0, team/usecase rows = 0; all read statuses ok (genuine absence).
- **Confidence:** **CONFIRMED** as a configuration gap. This run was Interactive/conversational, so the absence did not block this execution. If record-event firing is intended, it is a separate defect.

---

### FIXES

#### Fix 1 — Repoint the capability `api` to a real provider flow *(addresses RC1 — required to unblock)*

| Field | Value |
|-------|-------|
| **Target type** | Configuration |
| **Target** | `sys_one_extend_capability_definition` sys_id `904c0485699a4a73a124446a7231c563` · field `api` |
| **Current** | `00000000000000000000000000000000` |
| **Proposed** | The `sys_id` of the Now Assist / LLM provider subflow in `sys_hub_flow` that should service `x_snc_tsbench_unmapped_capability`. Locate the correct subflow in Flow Designer under the NowAssist or provider scope, then set `api` to its sys_id. |
| **Rationale** | The executor resolves the provider from this field. A nil GUID resolves to nothing, so the capability call always returns `status:"error"` regardless of the payload. Setting a real subflow sys_id is the only change needed to unblock invocation. |

---

#### Fix 2 — Mark the `ticket` input mandatory *(addresses RC3 — defensive hardening)*

| Field | Value |
|-------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac` · field `input_schema` → `ticket.mandatory`; AND `sn_aia_agent_tool_m2m` `3c72dab2668c4ba5a6080a5cd5fb2b91` · field `inputs` → `ticket.mandatory` |
| **Current** | `false` |
| **Proposed** | `true` |
| **Rationale** | Without `mandatory:true` the model may call the tool without a sys_id, producing an empty payload and the same error path as the capability misconfiguration. Marking it mandatory causes the platform to validate before invocation. |

---

#### Fix 3 — Add boundary guidance to the tool description *(addresses tool quality smells — defensive)*

| Field | Value |
|-------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac` · field `description` |
| **Current** | *"Summarises a bench ticket by invoking the x_snc_tsbench_unmapped_capability GenAI capability. Give it a ticket sys_id. Returns the generated summary."* |
| **Proposed** | Extend to include: (a) what a valid ticket sys_id looks like (a 32-character hex string from `x_snc_tsbench_ticket`), (b) that the input must be a sys_id — not a display number or URL, and (c) what this tool does NOT do (e.g. does not accept `incident` or `problem` sys_ids). |
| **Rationale** | `agent_config` flagged `description_no_negative_guidance` and `description_no_input_guidance`. Without input-format guidance the model may pass a display value instead of a sys_id. |

---

#### Fix 4 — Add trigger wiring if record-event firing is required *(addresses RC4 — only if autonomous firing is intended)*

| Field | Value |
|-------|-------|
| **Target type** | Wiring |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` — create a new row |
| **Current** | No rows |
| **Proposed** | Create a trigger link associating the agent (or a use case) with the appropriate trigger configuration and table event. If the agent is intended only for conversational use, this fix is not required. |
| **Rationale** | Without trigger wiring the agent never fires on a record event. This run succeeded via conversational invoke, so this is not a blocker for the current usage pattern. |

---

### VERIFICATION

After applying **Fix 1**:

1. In AI Agent Studio, open **Seed 04 Summarizer** and invoke it conversationally:
   > *"Please summarise the bench ticket with sys_id 5b4b3d152baa475817a6ffbeee91bf2b."*
2. In the new execution plan, confirm:
   - The `summarise_ticket` tool call shows `ok:true` (not `ok:false`).
   - The agent's final message contains a human-readable summary, not a fallback error.
3. Run `genai_log check_config` on capability `92ff62af516741769c437feb88c80ef3` and confirm `api_state` changes from `dangling` to `resolved`.

After applying **Fix 2**:

4. Attempt to invoke the agent without a sys_id; the platform should reject the tool call at invocation with a mandatory-input-missing error rather than reaching the capability.

---

### DATA MARKERS
*(Flag for redaction before this report leaves the instance)*

- `x_snc_tsbench_ticket` record: short_description contains operational ticket content — review before sharing externally.
- `sn_aia_message` user profile content: includes user email and user sys_id — redact before sharing.

All other values quoted above are configuration identifiers (sys_ids, field names, capability names) and carry no personal data.
References: null

<!-- END VERBATIM row-05 -->

## 7. Anomalies

- None beyond the standing native-arm behaviours noted in row 01.

---

# row-06-native-seed-04-run-2

## 1. Identity

| field | value |
|---|---|
| arm | NATIVE (`servicenow_aia_execute`, agent `e1392946828940e5a708fc51b0a5e954`) |
| seed / rep | 04 / 2 |
| target plan | `b85c79992baa475817a6ffbeee91bf2c` |
| **run_id** (new `sn_aia_execution_plan` sys_id) | **`aa06c65d2bae475817a6ffbeee91bf71`** |
| AIA session id | `d606865d2bae475817a6ffbeee91bfb9` |
| conversation_ref (on the anchor) | `de06429d2b2e475817a6ffbeee91bff3` |

Input text (verbatim):

```
Diagnose the failing AI Agent execution with plan sys_id b85c79992baa475817a6ffbeee91bf2c. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes.
```

## 2. Terminal state

`sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty.

## 3. Wall-clock duration

2026-08-06 02:47:18 → 02:51:39 = **4 m 21 s (261 s)**.

## 4. Audit-derived tool calls

**Anchor-location method:** direct query on `x_snc_troubleshoot_run` with
`execution_ref=aa06c65d2bae475817a6ffbeee91bf71`. Anchor sys_id
**`c9160e5d2bae475817a6ffbeee91bfec`** (`number` TR1000161, `harness` = `native`,
`conversation_ref` `de06429d2b2e475817a6ffbeee91bff3`, `status` `running`).

Query: `x_snc_troubleshoot_audit` where `run=c9160e5d2bae475817a6ffbeee91bfec^action_type=result`.

**Total result rows: 17.** (Matches the plan's `type=tool` task count of 17.)

Ordered `tool_name` list:

1. `agent_trace` (02:47:28)
2. `read_artifact` (02:47:36)
3. `read_artifact` (02:47:46)
4. `genai_log` (02:48:14)
5. `read_artifact` (02:48:14)
6. `agent_config` (02:48:14)
7. `query_table` (02:48:14)
8. `read_artifact` (02:48:41)
9. `schema_lookup` (02:48:41)
10. `genai_log` (02:48:41)
11. `log_analysis` (02:48:41)
12. `read_artifact` (02:49:05)
13. `read_artifact` (02:49:05)
14. `schema_lookup` (02:49:05)
15. `read_artifact` (02:49:31)
16. `read_artifact` (02:49:31)
17. `query_table` (02:49:31)

Distinct tool names (7): `agent_trace`, `read_artifact`, `genai_log`, `agent_config`,
`query_table`, `schema_lookup`, `log_analysis`.

**layers_swept (mechanical §E2) = 7/7 (L1,L2,L3,L4,L5,L6,L7)**; `layers_available` = 7/7.

## 5. LLM calls

`gen_ai` = **9** (also: `tool` 17, `agent` 1, `access_verification` 1, `communicator` 1).

## 6. Full report, verbatim

Source: `sn_aia_message` sys_id `f10742552bee475817a6ffbeee91bf92`, `role` = `agent`,
`name` = `Agent Doctor`, created 2026-08-06 02:51:37.

<!-- BEGIN VERBATIM row-06 -->

# Fix Report — Execution Plan b85c79992baa475817a6ffbeee91bf2c

---

## FAILURE SUMMARY

The user asked agent **Seed 04 Summarizer** to summarise bench ticket `fb4b7d5d2b66cf54f243fed2ce91bfda` (*"Shared network printer on floor three rejects all print jobs with a driver error"*). The agent correctly called the `summarise_ticket` tool, which invoked capability **x_snc_tsbench_unmapped_capability** (`92ff62af516741769c437feb88c80ef3`) via `sn_one_extend.OneExtendUtil`. The capability's sole definition row carries `api = 00000000000000000000000000000000` — a nil UUID that resolves to no record in `sys_hub_flow`. The executor therefore returned `status: "error"`, `planId: null`, and the message **"Plan invalid or not created."** The tool returned `ok: false`, the ReAct engine recognised the failure, and surfaced it to the user as *"Ticket Summarisation Failed."* The execution plan state is **Completed** (not Failed) because the agent handled the error gracefully, but the user's objective was not met.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `agent_trace`, execution `b85c79992baa475817a6ffbeee91bf2c` |
| 2 | Instructions | **SWEPT** | `agent_config` artifact `10460add2bae475817a6ffbeee91bffe` |
| 3 | Tool definitions | **SWEPT** | `agent_config` artifact `10460add2bae475817a6ffbeee91bffe` |
| 4 | Data schemas | **SWEPT** | `schema_lookup` on `x_snc_tsbench_ticket` |
| 5 | Data | **SWEPT** | `query_table` on `x_snc_tsbench_ticket`, record `fb4b7d5d2b66cf54f243fed2ce91bfda` — record **exists** |
| 6 | GenAI stack | **SWEPT** | `genai_log check_config` capability `92ff62af516741769c437feb88c80ef3`; `genai_log for_execution` |
| 7 | Trigger and wiring | **SWEPT** | `agent_config` triggers section |

**Platform log layer (syslog): UNAVAILABLE.** `syslog` declares `caller_access = Caller Restriction`; the tool received `DENIED`. An instance administrator must relax `caller_access` on `syslog`, or export logs for the window `2026-08-06 02:02:52 – 02:07:12`. This layer was **NOT** swept and is **NOT** reported as clean. Zero script errors were found via `agent_trace` (the nearest available substitute).

---

## ROOT CAUSES

### Root Cause 1 — PRIMARY (Layer 6: GenAI Stack)

| Field | Value |
|-------|-------|
| **layer** | 6 — GenAI stack |
| **component** | `sys_one_extend_capability_definition` · sys_id `904c0485699a4a73a124446a7231c563` · name `x_snc_tsbench_unmapped_capability (Now LLM Service - unmapped)` |
| **finding** | The `api` field holds the nil UUID `00000000000000000000000000000000`, which resolves to no row in `sys_hub_flow`. `api` is a mandatory binding for `api_type = sys_hub_flow`. With no valid flow to dispatch through, every invocation of this capability fails at the executor with **"Plan invalid or not created."** |
| **evidence** | `genai_log check_config` → definition `904c0485699a4a73a124446a7231c563`, `api = 00000000000000000000000000000000`, `api_state: dangling`, `finding: api_dangling, severity: high`; `agent_trace` tool call `0f5cbd992baa475817a6ffbeee91bf42` → `ok: false`, `status: error`, `planId: null` |
| **confidence** | **CONFIRMED** — capability definition row read directly; dangling `api` verified against `sys_hub_flow` (empty) |

---

### Root Cause 2 — SECONDARY (Layers 3 & 4: Tool Definition Quality)

| Field | Value |
|-------|-------|
| **layer** | 3 — Tool definitions / 4 — Data schemas |
| **component** | `sn_aia_tool` · sys_id `37d6957bb5cd4bda96fc9a93de494eac` · fields: `description`, `input_schema` |
| **finding** | The tool description says *"Give it a ticket sys_id"* but names no source table, no format constraints, and no exclusion boundary. The `ticket` input is marked `mandatory: false` even though it is functionally required. Two tool-quality smells raised: `description_no_negative_guidance` and `description_no_input_guidance`. These did not cause this run's failure but will cause silent misuse once Root Cause 1 is fixed. |
| **evidence** | `agent_config` artifact `10460add2bae475817a6ffbeee91bffe` → `tool_smells[0]: description_no_negative_guidance`, `tool_smells[1]: description_no_input_guidance`; `input_schema: mandatory: false` for `"ticket"` |
| **confidence** | **CONFIRMED** for schema observations; **UNCONFIRMED** whether either smell caused a misbehaviour in this specific run (the model used the tool correctly) |

---

### Root Cause 3 — INFORMATIONAL (Layer 7: Trigger Wiring)

| Field | Value |
|-------|-------|
| **layer** | 7 — Trigger and wiring |
| **component** | `sn_aia_trigger_agent_usecase_m2m` (agent Seed 04 Summarizer) |
| **finding** | Zero trigger links on both branches (agent-direct: 0, team/usecase chain: 0). The agent ran in Interactive/conversational mode for this execution, so no trigger is required. This finding matters only if the agent is expected to fire on a record event. |
| **evidence** | `agent_config` artifact `10460add2bae475817a6ffbeee91bffe` → `triggers.branches: agent_direct=0, team_usecase_chain=0`; `wiring_findings[0].finding: no_trigger_wiring` |
| **confidence** | **UNCONFIRMED** as a defect — conversational invocation succeeded. Confirm by checking whether a record-event trigger is intended. |

---

## FIXES

### Fix 1 — Addresses Root Cause 1 ✅ *Apply this first*

| Field | Value |
|-------|-------|
| **target type** | Configuration — GenAI capability definition |
| **target** | `sys_one_extend_capability_definition` · sys_id `904c0485699a4a73a124446a7231c563` · field: `api` |
| **current** | `00000000000000000000000000000000` |
| **proposed** | The `sys_id` of the `sys_hub_flow` record that implements the intended LLM provider integration for this capability (e.g., the active Now Assist "Summarization" or equivalent flow on this instance) |
| **rationale** | `api` is a mandatory binding for `api_type = sys_hub_flow`. The nil UUID resolves to nothing; the executor cannot build a plan. Pointing `api` at a real, active `sys_hub_flow` record gives the executor a valid dispatch target and resolves the "Plan invalid or not created" error. |

**Steps to find the correct flow:**
1. Open **Now Assist / AI Skill Studio** and locate the provider integration intended to back this capability.
2. Copy its `sys_hub_flow` sys_id.
3. On `sys_one_extend_capability_definition` sys_id `904c0485699a4a73a124446a7231c563`, set the `api` field to that sys_id.

---

### Fix 2 — Addresses Root Cause 2

| Field | Value |
|-------|-------|
| **target type** | Tool schema |
| **target** | `sn_aia_tool` · sys_id `37d6957bb5cd4bda96fc9a93de494eac` · fields: `description`, `input_schema` |
| **current description** | *"Summarises a bench ticket by invoking the x_snc_tsbench_unmapped_capability GenAI capability. Give it a ticket sys_id. Returns the generated summary."* |
| **proposed description** | *"Summarises a bench ticket by invoking the x_snc_tsbench_unmapped_capability GenAI capability. Provide the sys_id of a record from table x_snc_tsbench_ticket. Returns the generated summary text. Do not use this tool for ticket types other than x_snc_tsbench_ticket, and do not call it without a valid sys_id."* |
| **current input `ticket`** | `mandatory: false` |
| **proposed input `ticket`** | `mandatory: true` |
| **rationale** | Marking `ticket` mandatory prevents silent null invocations. Naming the source table and the exclusion boundary gives the model enough information to select and invoke the tool correctly without guessing format or scope. |

---

## VERIFICATION

After applying Fix 1:

1. Open a new conversation with **Seed 04 Summarizer** and send:
   > *"Please summarise the bench ticket with sys_id `fb4b7d5d2b66cf54f243fed2ce91bfda`"*
2. Retrieve the new execution plan sys_id.
3. Run `agent_trace` on the new plan. **Expect:**
   - Tool call `summarise_ticket`: `execution_status = Success`
   - Tool response: `ok: true`, `result` non-null
   - No *"Plan invalid or not created"* in the message stream
   - Agent final message contains the summary text
4. Run `genai_log for_execution` on the new plan. Expect two LLM calls, both `status: success`.
5. If the tool still returns `ok: false`, run `genai_log check_config` on capability `92ff62af516741769c437feb88c80ef3` again and verify `api_state` is no longer `dangling`.

---

## DATA MARKERS

The following record data was cited as diagnostic evidence and **must be reviewed for redaction** before this report leaves the instance:

- `x_snc_tsbench_ticket` sys_id `fb4b7d5d2b66cf54f243fed2ce91bfda`
  - `short_description`: *"Shared network printer on floor three rejects all print jobs with a driver error"*
- `sn_aia_message` sys_id `cb5cbd992baa475817a6ffbeee91bfa7` — raw capability error response including `capability_id`
- `sys_cs_message` content containing the user's original request and the agent's *"Ticket Summarisation Failed"* reply
- User profile: System Administrator / `admin@example.com` (present in the execution message stream as the invoking user)

---

> **Sweep completeness note:** Six of seven layers were swept with direct tool evidence. The platform log layer (syslog) is **UNAVAILABLE** — an instance administrator must grant cross-scope read access to `syslog` or export logs for the window `2026-08-06 02:02:52 – 02:07:12` to close that gap.
References: null

<!-- END VERBATIM row-06 -->

## 7. Anomalies

- None beyond the standing native-arm behaviours noted in row 01.

---

# row-07-custom-seed-01-run-1

## 1. Identity

| field | value |
|---|---|
| arm | CUSTOM (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`) |
| seed / rep | 01 / 1 |
| target plan | `4a5bb19d2b66cf54f243fed2ce91bf57` |
| **run_id** (`x_snc_troubleshoot_run` sys_id) | **`c5e7421d2baacf54f243fed2ce91bfc0`** |
| number | TR1000162 |
| conversation_ref | `custom-1-1785984923738-283582913` |
| harness | `custom` |

Request body (verbatim): `{"execution": "4a5bb19d2b66cf54f243fed2ce91bf57", "mode": "diagnose"}`
POST response: `{"run_id": "c5e7421d2baacf54f243fed2ce91bfc0", "status": "queued"}`

## 2. Terminal state

`status` = **`failed`**.

Full `error` text, verbatim:

```
fix_report failed validation and could not be repaired: root_causes[0].evidence[0] has an invalid or missing source (must be one of: trace, config, schema, data); root_causes[0] (sn_tsbench_bench_ticket table): evidence rule violation — evidence cites only the trace; at least one config, schema, or data citation is required. If the trace alone genuinely settles it and you cannot reach a second layer, set confidence to UNCONFIRMED and name the layer that would confirm it in `would_confirm` — an unconfirmed candidate that names its missing evidence is a valid report.
```

`fix_report` is `null`; the rejected report is preserved under `fix_report_rejected.report` and is
reproduced in full in §6 below (a rejected report is still scored).

## 3. Wall-clock duration

`sys_created_on` 2026-08-06 02:55:23 → `sys_updated_on` 02:55:47 = **24 s**.

## 4. Audit-derived tool calls

Custom rows key directly on the run sys_id (`x_snc_troubleshoot_audit.run` = the
`x_snc_troubleshoot_run` sys_id) — no anchor hunt needed.

Query: `x_snc_troubleshoot_audit` where `run=c5e7421d2baacf54f243fed2ce91bfc0^action_type=result`.

**Total result rows: 3.**

Ordered `tool_name` list:

1. `agent_trace` (02:55:28) — args `{"execution":"4a5bb19d2b66cf54f243fed2ce91bf57"}`
2. `agent_config` (02:55:33) — args `{"agent":"914db68f3e364222a47f9e5398b6ac8d","section":"tools"}`
3. `schema_lookup` (02:55:35) — args `sn_tsbench_bench_ticket` (table does not exist; tool returned
   `table_exists: false`, finding `table_does_not_exist`)

Distinct tool names (3): `agent_trace`, `agent_config`, `schema_lookup`.

§E2 mechanical map: `agent_trace`→L1, `agent_config`→L2,L3,L7, `schema_lookup`→L4 →
**layers_swept (mechanical) = 5/7 (L1,L2,L3,L4,L7)**; `layers_available` = 7/7.
**Scorer note (§E2 qualifier, left unresolved here):** the single `agent_config` call passed
`section: "tools"` only — the args are recorded above so the scorer can decide whether L2 and L7
were actually used. The run's own `layers_swept` block self-declares 2, 5, 6, 7 as NOT_SWEPT.

## 5. LLM calls

`actor: 'llm'` transcript entries = **6** (seq 1, 3, 5, 7, 9, 10). Two of them (seq 3, 9) were
terminal `fix_report` actions; seq 3 was refused by the harness HOLD, seq 10 failed validation.

Harness HOLD recorded at seq 4 (actor `system`), verbatim:

```
HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 2, 3, 4, 5, 6, 7 declared NOT_SWEPT with no tool call behind them.
```

## 6. Full report, verbatim (`fix_report_rejected.report`)

`fix_report` was `null`. The rejected report, verbatim as returned by
`GET /runs/c5e7421d2baacf54f243fed2ce91bfc0`:

<!-- BEGIN VERBATIM row-07 -->
```json
{
  "failure_summary": "The AI Agent execution for ticket 464bb9152baa475817a6ffbeee91bfa9 completed successfully, but the tool call to set the ticket priority failed to store the priority value due to a missing table reference in the system schema.",
  "layers_swept": {
    "1": {
      "status": "SWEPT",
      "reason": "agent_trace provided execution details"
    },
    "2": {
      "status": "NOT_SWEPT",
      "reason": "No instruction analysis required as tool call succeeded"
    },
    "3": {
      "status": "SWEPT",
      "reason": "agent_config validated tool definitions"
    },
    "4": {
      "status": "SWEPT",
      "reason": "schema_lookup confirmed table absence"
    },
    "5": {
      "status": "NOT_SWEPT",
      "reason": "No data query needed as failure was schema-related"
    },
    "6": {
      "status": "NOT_SWEPT",
      "reason": "GenAI stack not involved in failure"
    },
    "7": {
      "status": "NOT_SWEPT",
      "reason": "Trigger configuration not required for this failure type"
    }
  },
  "root_causes": [
    {
      "layer": "4",
      "component": "sn_tsbench_bench_ticket table",
      "finding": "Table does not exist in the system schema",
      "evidence": [
        {
          "source": "schema_lookup",
          "detail": "schema_lookup confirmed absence of sn_tsbench_bench_ticket table"
        },
        {
          "source": "trace",
          "detail": "tool call response showed priority_stored as null due to missing table reference"
        }
      ],
      "confidence": "CONFIRMED"
    }
  ],
  "fixes": [
    {
      "target_type": "tool schema",
      "target": "set_ticket_priority tool's input schema",
      "current": "ticket field references non-existent sn_tsbench_bench_ticket table",
      "proposed": "Update ticket field to reference valid table (e.g., incident)",
      "rationale": "The tool attempted to update a non-existent table, causing failure to store priority"
    }
  ],
  "verification": "Re-run the agent execution and verify the ticket priority is successfully stored in the correct table",
  "data_markers": []
}
```

`fix_report_rejected.problems`, verbatim:

```
fix_report failed validation and could not be repaired: root_causes[0].evidence[0] has an invalid or missing source (must be one of: trace, config, schema, data); root_causes[0] (sn_tsbench_bench_ticket table): evidence rule violation — evidence cites only the trace; at least one config, schema, or data citation is required. If the trace alone genuinely settles it and you cannot reach a second layer, set confidence to UNCONFIRMED and name the layer that would confirm it in `would_confirm` — an unconfirmed candidate that names its missing evidence is a valid report.
```
<!-- END VERBATIM row-07 -->

## 7. Anomalies

- The run reached a terminal state (`failed`) in 24 s after 3 tool calls. Recorded as measured; not
  retried (the brief allows up to two retries only for runs that cannot reach terminal — this one
  did).
- The model's third tool call passed the table name `sn_tsbench_bench_ticket`, which does not exist
  on the instance (the real table is `x_snc_tsbench_ticket`). The tool correctly reported
  `table_does_not_exist`, and the model then built its root cause on that non-existent table.
  Recorded, not judged.

---

# row-08-custom-seed-01-run-2

## 1. Identity

| field | value |
|---|---|
| arm | CUSTOM (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`) |
| seed / rep | 01 / 2 |
| target plan | `45bbfd112ba6cf54f243fed2ce91bfcb` |
| **run_id** (`x_snc_troubleshoot_run` sys_id) | **`1d988e1d2bee475817a6ffbeee91bf4f`** |
| number | TR1000163 |
| conversation_ref | `custom-1-1785985105208-824952581` |

Request body (verbatim): `{"execution": "45bbfd112ba6cf54f243fed2ce91bfcb", "mode": "diagnose"}`
POST response: `{"run_id": "1d988e1d2bee475817a6ffbeee91bf4f", "status": "queued"}`

## 2. Terminal state

`status` = **`failed`**.

Full `error` text, verbatim:

```
fix_report failed validation and could not be repaired: root_causes[1].evidence[1]: unsupported citation — cites "config" but this run never invoked a tool that reads it (agent_config, genai_log). Either call one of those tools and cite what it actually returned, or drop the claim. Tools invoked this run: agent_trace, schema_lookup, read_artifact.; root_causes[2].evidence[1]: unsupported citation — cites "data" but this run never invoked a tool that reads it (query_table, log_analysis). Either call one of those tools and cite what it actually returned, or drop the claim. Tools invoked this run: agent_trace, schema_lookup, read_artifact.; root_causes[3].evidence[1]: unsupported citation — cites "config" but this run never invoked a tool that reads it (agent_config, genai_log). Either call one of those tools and cite what it actually returned, or drop the claim. Tools invoked this run: agent_trace, schema_lookup, read_artifact.
```

`fix_report` is `null`; `fix_report_rejected.report` is reproduced in full in §6.

## 3. Wall-clock duration

2026-08-06 02:58:25 → 02:58:47 = **22 s**.

## 4. Audit-derived tool calls

Query: `x_snc_troubleshoot_audit` where `run=1d988e1d2bee475817a6ffbeee91bf4f^action_type=result`.

**Total result rows: 3.**

Ordered `tool_name` list:

1. `agent_trace` (02:58:28) — args `{"execution":"45bbfd112ba6cf54f243fed2ce91bfcb"}`
2. `read_artifact` (02:58:34) — args `{"artifact_id":"9698825d2bee475817a6ffbeee91bfd4","offset":4000}`
3. `schema_lookup` (02:58:37) — args `incident.priority`

Distinct tool names (3): `agent_trace`, `read_artifact`, `schema_lookup`.

§E2 mechanical map: `agent_trace`→L1, `schema_lookup`→L4, `read_artifact`→**not a layer** →
**layers_swept (mechanical) = 2/7 (L1,L4)**; `layers_available` = 7/7.
The run's own `layers_swept` block agrees on the swept set (1 and 4 SWEPT; 2, 3, 5, 7 NOT_SWEPT;
6 declared UNAVAILABLE).

## 5. LLM calls

`actor: 'llm'` transcript entries = **6** (seq 1, 3, 5, 7, 9, 10).

Harness HOLD recorded at seq 4 (actor `system`), verbatim:

```
HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 2, 3, 4, 5, 6, 7 declared NOT_SWEPT with no tool call behind them.
```

## 6. Full report, verbatim (`fix_report_rejected.report`)

<!-- BEGIN VERBATIM row-08 -->
```json
{
  "failure_summary": "The agent execution for ticket a64b795d2b66cf54f243fed2ce91bf11 completed successfully with a 'critical' priority request, but the priority_stored field in the tool response was null, indicating the priority update may not have persisted. The execution trace shows the set_ticket_priority tool executed successfully, but no confirmation of the stored priority was recorded.",
  "layers_swept": {
    "1": {
      "status": "SWEPT",
      "reason": "agent_trace provided execution details including tool call outcomes"
    },
    "2": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect instructions"
    },
    "3": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect tool definitions"
    },
    "4": {
      "status": "SWEPT",
      "reason": "schema_lookup confirmed incident.priority exists and is valid"
    },
    "5": {
      "status": "NOT_SWEPT",
      "reason": "No query_table call made to verify ticket record state"
    },
    "6": {
      "status": "UNAVAILABLE",
      "reason": "No genai_log or log_analysis call made to inspect GenAI stack details"
    },
    "7": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect trigger wiring"
    }
  },
  "root_causes": [
    {
      "layer": "1",
      "component": "set_ticket_priority tool response",
      "finding": "priority_stored field is null despite successful execution",
      "evidence": [
        {
          "source": "trace",
          "detail": "tool response_digest shows 'priority_stored': null"
        },
        {
          "source": "schema",
          "detail": "incident.priority exists as an integer field with valid choices"
        }
      ]
    },
    {
      "layer": "6",
      "component": "GenAI stack configuration",
      "finding": "No evidence of GenAI stack inspection",
      "evidence": [
        {
          "source": "trace",
          "detail": "agent_trace shows no GenAI tool calls"
        },
        {
          "source": "config",
          "detail": "No agent_config call for GenAI stack parameters"
        }
      ]
    },
    {
      "layer": "5",
      "component": "ticket record state",
      "finding": "No verification of ticket data",
      "evidence": [
        {
          "source": "trace",
          "detail": "agent_trace shows no query_table calls"
        },
        {
          "source": "data",
          "detail": "No log_analysis output for ticket data"
        }
      ]
    },
    {
      "layer": "7",
      "component": "trigger wiring",
      "finding": "No inspection of trigger configuration",
      "evidence": [
        {
          "source": "trace",
          "detail": "agent_trace shows no agent_config calls for triggers"
        },
        {
          "source": "config",
          "detail": "No agent_config output for trigger parameters"
        }
      ]
    }
  ],
  "fixes": [
    {
      "target_type": "tool schema",
      "target": "set_ticket_priority tool's response validation logic",
      "current": "null value allowed for priority_stored",
      "proposed": "ensure priority_stored reflects the actual database value",
      "rationale": "The tool's response should confirm the stored priority matches the requested value to avoid ambiguity"
    },
    {
      "target_type": "configuration",
      "target": "agent_config calls for trigger wiring",
      "current": "",
      "proposed": "add agent_config call to inspect trigger parameters",
      "rationale": "Verify trigger configuration matches expected wiring"
    },
    {
      "target_type": "data",
      "target": "ticket record validation",
      "current": "",
      "proposed": "add query_table call to verify ticket state",
      "rationale": "Confirm ticket priority field matches expected value post-update"
    }
  ],
  "verification": "Re-run the agent execution with added query_table and agent_config calls, then verify priority_stored matches ticket record and trigger parameters are correctly configured",
  "data_markers": []
}
```
<!-- END VERBATIM row-08 -->

## 7. Anomalies

- Terminal in 22 s after 3 tool calls; no retry needed (terminal state reached).
- The model's `schema_lookup` targeted `incident.priority` rather than the bench table
  `x_snc_tsbench_ticket.priority`. Recorded, not judged.

---

# row-09-custom-seed-03-run-1

## 1. Identity

| field | value |
|---|---|
| arm | CUSTOM (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`) |
| seed / rep | 03 / 1 |
| target plan | `3afbf1192baa475817a6ffbeee91bf10` |
| **run_id** (`x_snc_troubleshoot_run` sys_id) | **`522986d12beacf54f243fed2ce91bfa7`** |
| number | TR1000164 |
| conversation_ref | `custom-1-1785985256397-989778566` |

Request body (verbatim): `{"execution": "3afbf1192baa475817a6ffbeee91bf10", "mode": "diagnose"}`
POST response: `{"run_id": "522986d12beacf54f243fed2ce91bfa7", "status": "queued"}`

## 2. Terminal state

`status` = **`complete`**. `error` is empty. `fix_report` is present (not rejected) — validated by
the harness at seq 8 (`fix_report validated`).

## 3. Wall-clock duration

2026-08-06 03:00:56 → 03:01:15 = **19 s**.

## 4. Audit-derived tool calls

Query: `x_snc_troubleshoot_audit` where `run=522986d12beacf54f243fed2ce91bfa7^action_type=result`.

**Total result rows: 2.**

Ordered `tool_name` list:

1. `agent_trace` (03:01:05) — args `{"execution":"3afbf1192baa475817a6ffbeee91bf10"}`
2. `schema_lookup` (03:01:11) — args `incident.assignment_group`

Distinct tool names (2): `agent_trace`, `schema_lookup`.

§E2 mechanical map: `agent_trace`→L1, `schema_lookup`→L4 →
**layers_swept (mechanical) = 2/7 (L1,L4)**; `layers_available` = 7/7.
The run's own `layers_swept` block agrees (1 and 4 SWEPT; 2, 3, 5, 6, 7 NOT_SWEPT).

## 5. LLM calls

`actor: 'llm'` transcript entries = **4** (seq 1, 3, 5, 7).

Harness HOLD recorded at seq 4 (actor `system`), verbatim:

```
HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 2, 4, 5, 7 declared NOT_SWEPT with no tool call behind them.
```

## 6. Full report, verbatim (`fix_report`)

<!-- BEGIN VERBATIM row-09 -->
```json
{
  "failure_summary": "The agent execution for routing a Hardware request failed because the lookup_routing_rule tool found 0 rules in the table, indicating no matching routing rules were available for the 'Hardware' category.",
  "layers_swept": {
    "1": {
      "status": "SWEPT",
      "reason": "agent_trace provided execution details including tool call results"
    },
    "2": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect instructions"
    },
    "3": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect tool definitions"
    },
    "4": {
      "status": "SWEPT",
      "reason": "schema_lookup confirmed 'assignment_group' exists on incident table"
    },
    "5": {
      "status": "NOT_SWEPT",
      "reason": "No query_table call made to verify routing rules data"
    },
    "6": {
      "status": "NOT_SWEPT",
      "reason": "No genai_log call made to inspect LLM interactions"
    },
    "7": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect trigger wiring"
    }
  },
  "root_causes": [
    {
      "layer": "1",
      "component": "lookup_routing_rule tool call",
      "finding": "0 rules found in routing table for 'Hardware' category",
      "evidence": [
        {
          "source": "trace",
          "detail": "tool_call response: 'rules_in_table':0"
        },
        {
          "source": "trace",
          "detail": "execution_plan state: completed with objective unfulfilled"
        }
      ],
      "confidence": "UNCONFIRMED",
      "would_confirm": "layer 5 — query_table against routing rules table to verify data existence"
    }
  ],
  "fixes": [
    {
      "target_type": "configuration",
      "target": "lookup_routing_rule tool binding",
      "current": "unknown routing rules data source",
      "proposed": "validate routing rules table contains entries for 'Hardware' category",
      "rationale": "The tool found 0 rules, indicating missing or misconfigured routing data"
    }
  ],
  "verification": "Re-run the agent and verify the tool call returns >0 rules_in_table for 'Hardware' category",
  "data_markers": []
}
```
<!-- END VERBATIM row-09 -->

## 7. Anomalies

- First custom row of the pass to reach `complete` with a validated `fix_report`.
- The `schema_lookup` targeted `incident.assignment_group` rather than the bench routing table
  `x_snc_tsbench_routing`. Recorded, not judged.

---

# row-10-custom-seed-03-run-2

## 1. Identity

| field | value |
|---|---|
| arm | CUSTOM (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`) |
| seed / rep | 03 / 2 |
| target plan | `1a1c71152ba6cf54f243fed2ce91bf31` |
| **run_id** (`x_snc_troubleshoot_run` sys_id) | **`4cb98e952b22875817a6ffbeee91bfa1`** |
| number | TR1000165 |
| conversation_ref | `custom-1-1785985394546-423375456` |

Request body (verbatim): `{"execution": "1a1c71152ba6cf54f243fed2ce91bf31", "mode": "diagnose"}`
POST response: `{"run_id": "4cb98e952b22875817a6ffbeee91bfa1", "status": "queued"}`

## 2. Terminal state

`status` = **`complete`**. `error` empty. `fix_report` present; harness recorded
`fix_report validated` at seq 8.

## 3. Wall-clock duration

2026-08-06 03:03:14 → 03:03:34 = **20 s**.

## 4. Audit-derived tool calls

Query: `x_snc_troubleshoot_audit` where `run=4cb98e952b22875817a6ffbeee91bfa1^action_type=result`.

**Total result rows: 2.**

Ordered `tool_name` list:

1. `agent_trace` (03:03:23) — args `{"execution":"1a1c71152ba6cf54f243fed2ce91bf31"}`
2. `schema_lookup` (03:03:30) — args `incident.assignment_group`

Distinct tool names (2): `agent_trace`, `schema_lookup`.

§E2 mechanical map: `agent_trace`→L1, `schema_lookup`→L4 →
**layers_swept (mechanical) = 2/7 (L1,L4)**; `layers_available` = 7/7.
The run's own `layers_swept` block agrees.

## 5. LLM calls

`actor: 'llm'` transcript entries = **4** (seq 1, 3, 5, 7).

Harness HOLD at seq 4, verbatim:

```
HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 2, 4, 5, 7 declared NOT_SWEPT with no tool call behind them.
```

## 6. Full report, verbatim (`fix_report`)

<!-- BEGIN VERBATIM row-10 -->
```json
{
  "failure_summary": "The agent execution for routing a Software category request failed because the lookup_routing_rule tool found 0 rules in the table, indicating no matching assignment group rules exist for the 'Software' category.",
  "layers_swept": {
    "1": {
      "status": "SWEPT",
      "reason": "agent_trace provided execution details including tool call response showing 0 rules"
    },
    "2": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect instructions"
    },
    "3": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect tool definitions"
    },
    "4": {
      "status": "SWEPT",
      "reason": "schema_lookup confirmed 'assignment_group' exists on incident table"
    },
    "5": {
      "status": "NOT_SWEPT",
      "reason": "No query_table call made to verify rules exist"
    },
    "6": {
      "status": "NOT_SWEPT",
      "reason": "No genai_log call made to inspect LLM context"
    },
    "7": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect trigger wiring"
    }
  },
  "root_causes": [
    {
      "layer": "1",
      "component": "lookup_routing_rule tool call",
      "finding": "No matching assignment group rules found for 'Software' category",
      "evidence": [
        {
          "source": "trace",
          "detail": "tool_call response: 'rules_in_table': 0"
        },
        {
          "source": "trace",
          "detail": "execution_plan state: completed with objective unfulfilled"
        }
      ],
      "confidence": "UNCONFIRMED",
      "would_confirm": "layer 5 — query_table against routing rules table to verify rule existence"
    }
  ],
  "fixes": [
    {
      "target_type": "data",
      "target": "assignment group rules for Software category",
      "current": "0 rules found",
      "proposed": "Create at least one valid assignment group rule for Software category",
      "rationale": "The tool's response indicates no rules exist, preventing proper routing"
    }
  ],
  "verification": "Re-run the agent execution and verify the lookup_routing_rule tool returns a non-zero 'rules_in_table' value",
  "data_markers": []
}
```
<!-- END VERBATIM row-10 -->

## 7. Anomalies

- Same shape as row 09 (seed 03 rep 1): one `agent_trace`, one HOLD, one `schema_lookup` against
  `incident.assignment_group`, then a validated report. Recorded, not judged.

---

# row-11-custom-seed-04-run-1

## 1. Identity

| field | value |
|---|---|
| arm | CUSTOM (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`) |
| seed / rep | 04 / 1 |
| target plan | `4e3c35552ba6cf54f243fed2ce91bf47` |
| **run_id** (`x_snc_troubleshoot_run` sys_id) | **`a53a02592beacf54f243fed2ce91bf65`** |
| number | TR1000166 |
| conversation_ref | `custom-1-1785985531199-331930993` |

Request body (verbatim): `{"execution": "4e3c35552ba6cf54f243fed2ce91bf47", "mode": "diagnose"}`
POST response: `{"run_id": "a53a02592beacf54f243fed2ce91bf65", "status": "queued"}`

## 2. Terminal state

`status` = **`complete`**. `error` empty. `fix_report` present; harness recorded
`fix_report validated` at seq 10.

## 3. Wall-clock duration

2026-08-06 03:05:31 → 03:05:50 = **19 s**.

## 4. Audit-derived tool calls

Query: `x_snc_troubleshoot_audit` where `run=a53a02592beacf54f243fed2ce91bf65^action_type=result`.

**Total result rows: 3.**

Ordered `tool_name` list:

1. `agent_trace` (03:05:35) — args `{"execution":"4e3c35552ba6cf54f243fed2ce91bf47"}`
2. `read_artifact` (03:05:37) — args `{"artifact_id":"ae3a82592beacf54f243fed2ce91bf1c","offset":4000}`
3. `schema_lookup` (03:05:45) — args `incident`

Distinct tool names (3): `agent_trace`, `read_artifact`, `schema_lookup`.

§E2 mechanical map: `agent_trace`→L1, `schema_lookup`→L4, `read_artifact`→**not a layer** →
**layers_swept (mechanical) = 2/7 (L1,L4)**; `layers_available` = 7/7.
The run's own `layers_swept` block agrees.

## 5. LLM calls

`actor: 'llm'` transcript entries = **5** (seq 1, 3, 5, 7, 9).

Harness HOLD at seq 6, verbatim:

```
HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 2, 3, 4, 5, 7 declared NOT_SWEPT with no tool call behind them.
```

## 6. Full report, verbatim (`fix_report`)

<!-- BEGIN VERBATIM row-11 -->
```json
{
  "failure_summary": "The AI Agent execution failed to summarize the bench ticket due to an error in the tool call response, indicating a problem with the tool's capability or configuration. The tool returned an error status with no valid output, and the GenAI stack analysis is required to confirm the root cause.",
  "layers_swept": {
    "1": {
      "status": "SWEPT",
      "reason": "agent_trace provided execution details and tool call errors"
    },
    "2": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect instructions"
    },
    "3": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect tool definitions"
    },
    "4": {
      "status": "SWEPT",
      "reason": "schema_lookup confirmed incident table exists"
    },
    "5": {
      "status": "NOT_SWEPT",
      "reason": "No query_table call made to verify ticket record existence"
    },
    "6": {
      "status": "NOT_SWEPT",
      "reason": "No genai_log call made to inspect capability details"
    },
    "7": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect trigger wiring"
    }
  },
  "root_causes": [
    {
      "layer": "1",
      "component": "tool_call response",
      "finding": "Tool returned error status with no valid output",
      "evidence": [
        {
          "source": "trace",
          "detail": "tool_call response_digest shows 'status': 'error' and 'result': null"
        },
        {
          "source": "trace",
          "detail": "execution_status is 'Success' but response contains error"
        }
      ],
      "confidence": "UNCONFIRMED",
      "would_confirm": "layer 6 — genai_log to inspect capability configuration"
    }
  ],
  "fixes": [
    {
      "target_type": "tool schema",
      "target": "capability definition for 'summarise_ticket'",
      "current": "unknown (requires genai_log inspection)",
      "proposed": "validate api and connection fields in sys_one_extend_capability_definition",
      "rationale": "Ensure the tool's capability is properly configured to handle the ticket input"
    }
  ],
  "verification": "Re-run the agent execution and verify the tool call returns a valid response instead of an error status",
  "data_markers": []
}
```
<!-- END VERBATIM row-11 -->

## 7. Anomalies

- The `schema_lookup` targeted the whole `incident` table (46,121 chars, artifacted into 12 pages)
  rather than the bench table named in the trace. Recorded, not judged.

---

# row-12-custom-seed-04-run-2

## 1. Identity

| field | value |
|---|---|
| arm | CUSTOM (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`) |
| seed / rep | 04 / 2 |
| target plan | `b85c79992baa475817a6ffbeee91bf2c` |
| **run_id** (`x_snc_troubleshoot_run` sys_id) | **`deba8a1d2b22875817a6ffbeee91bfbb`** |
| number | TR1000167 |
| conversation_ref | `custom-1-1785985666523-626154544` |

Request body (verbatim): `{"execution": "b85c79992baa475817a6ffbeee91bf2c", "mode": "diagnose"}`
POST response: `{"run_id": "deba8a1d2b22875817a6ffbeee91bfbb", "status": "queued"}`

## 2. Terminal state

`status` = **`complete`**. `error` empty. `fix_report` present; harness recorded
`fix_report validated` at seq 10.

## 3. Wall-clock duration

2026-08-06 03:07:46 → 03:08:12 = **26 s**.

## 4. Audit-derived tool calls

Query: `x_snc_troubleshoot_audit` where `run=deba8a1d2b22875817a6ffbeee91bfbb^action_type=result`.

**Total result rows: 3.**

Ordered `tool_name` list:

1. `agent_trace` (03:07:57) — args `{"execution":"b85c79992baa475817a6ffbeee91bf2c"}`
2. `read_artifact` (03:07:59) — args `{"artifact_id":"11ca021d2beacf54f243fed2ce91bf62","offset":0}`
3. `schema_lookup` (03:08:07) — args `sn_aia_tools_execution`

Distinct tool names (3): `agent_trace`, `read_artifact`, `schema_lookup`.

§E2 mechanical map: `agent_trace`→L1, `schema_lookup`→L4, `read_artifact`→**not a layer** →
**layers_swept (mechanical) = 2/7 (L1,L4)**; `layers_available` = 7/7.
The run's own `layers_swept` block agrees.

## 5. LLM calls

`actor: 'llm'` transcript entries = **5** (seq 1, 3, 5, 7, 9).

Harness HOLD at seq 6, verbatim:

```
HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 2, 3, 4, 5, 7 declared NOT_SWEPT with no tool call behind them.
```

## 6. Full report, verbatim (`fix_report`)

<!-- BEGIN VERBATIM row-12 -->
```json
{
  "failure_summary": "The agent execution for summarizing ticket fb4b7d5d2b66cf54f243fed2ce91bfda failed due to an error in the tool response, indicating a potential issue with the tool's input schema or execution context. The tool call returned a status of 'error' with no valid response, but the execution trace shows the tool was invoked successfully.",
  "layers_swept": {
    "1": {
      "status": "SWEPT",
      "reason": "agent_trace provided execution details including tool call status and error message"
    },
    "2": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect instructions"
    },
    "3": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect tool definitions"
    },
    "4": {
      "status": "SWEPT",
      "reason": "schema_lookup confirmed sn_aia_tools_execution table exists and contains error_message field"
    },
    "5": {
      "status": "NOT_SWEPT",
      "reason": "No query_table call made to verify ticket record existence"
    },
    "6": {
      "status": "NOT_SWEPT",
      "reason": "No genai_log call made to inspect capability mappings"
    },
    "7": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect trigger wiring"
    }
  },
  "root_causes": [
    {
      "layer": "1",
      "component": "sn_aia_tools_execution tool call",
      "finding": "Tool response returned error status with no valid result",
      "evidence": [
        {
          "source": "trace",
          "detail": "tool_call status: 'error', response_digest shows status: 'error' and capability_id: '92ff62af516741769c437feb88c80ef3'"
        },
        {
          "source": "schema",
          "detail": "schema_lookup confirmed error_message field exists on sn_aia_tools_execution"
        }
      ],
      "confidence": "CONFIRMED",
      "would_confirm": null
    }
  ],
  "fixes": [
    {
      "target_type": "tool schema",
      "target": "summarise_ticket tool input schema",
      "current": "Unknown (not inspected via agent_config)",
      "proposed": "Validate input schema matches ticket table fields",
      "rationale": "The tool error suggests mismatched input parameters. Inspecting the tool's input schema via agent_config would identify required fields like ticket sys_id format."
    }
  ],
  "verification": "Re-run the agent execution and verify the tool response no longer shows 'error' status. Check the tool call's response_digest for valid capability response.",
  "data_markers": []
}
```
<!-- END VERBATIM row-12 -->

## 7. Anomalies

- The `schema_lookup` targeted `sn_aia_tools_execution` (the AIA platform table the trace came from)
  rather than any bench table. Recorded, not judged.

---

# Closing notes

## `layers_available` re-check (post-pass)

Re-ran the §E3 query after row 12 (2026-08-06 ~03:10): `sn_aia_agent_tool_m2m` where
`agent=e1392946828940e5a708fc51b0a5e954^active=true` still returns the same **7 tools**
(`log_analysis`, `schema_lookup`, `query_table`, `genai_log`, `agent_config`, `agent_trace`,
`read_artifact`), all `max_auto_executions = 10`, same m2m sys_ids as the pre-pass read.
**No tool attachment changed during the pass; `layers_available` = 7/7 for all 12 rows.**

## Execution discipline

All 12 runs were executed strictly sequentially. Each run reached a terminal state before the next
was started, and the two arms were never overlapped. Evidence that the anti-gluing precaution held:
every native run received its own `x_snc_troubleshoot_run` anchor with a distinct `conversation_ref`
(TR1000156, 157, 158, 159, 160, 161) — the PaRunAnchor 30-min-per-user fallback never engaged, even
though consecutive native runs started well inside 30 minutes of each other. Custom runs anchor on
their own run record by construction (TR1000162–167).

Pass window: 2026-08-06 02:08:14 (row 01 start) → 03:08:12 (row 12 terminal).

## Retries

**Zero retries.** No run failed to reach a terminal state, so the two-retry allowance was never
used. Two custom runs reached the terminal state `failed` — that is a terminal state, not a
non-terminal run, and both are recorded with their full `error` text and their
`fix_report_rejected.report` body.

## Cross-row summary table (measurements only — no scoring)

| row | arm | seed | rep | run_id | terminal_state | tool_calls | distinct tools (ordered first-use) | layers_swept (mech.) | llm_calls | duration |
|---|---|---|---|---|---|---|---|---|---|---|
| 01 | native | 01 | 1 | `961d7d9d2baa475817a6ffbeee91bf2a` | completed | 18 | agent_trace, read_artifact, query_table, agent_config, genai_log, log_analysis, schema_lookup | 7/7 (L1–L7) | 9 | 5m25s |
| 02 | native | 01 | 2 | `853ffd1d2bea475817a6ffbeee91bf0b` | completed | 17 | agent_trace, read_artifact, agent_config, genai_log, query_table, log_analysis, schema_lookup | 7/7 (L1–L7) | 8 | 4m17s |
| 03 | native | 03 | 1 | `74010e192b2e475817a6ffbeee91bfda` | completed | 13 | agent_trace, read_artifact, agent_config, genai_log, log_analysis, schema_lookup, query_table | 7/7 (L1–L7) | 6 | 2m47s |
| 04 | native | 03 | 2 | `a6c2061d2b2acf54f243fed2ce91bf34` | completed | 16 | agent_trace, read_artifact, log_analysis, genai_log, agent_config, query_table, schema_lookup | 7/7 (L1–L7) | 8 | 3m37s |
| 05 | native | 04 | 1 | `e064ce952b6acf54f243fed2ce91bf28` | completed | 14 | agent_trace, read_artifact, genai_log, agent_config, log_analysis, query_table, schema_lookup | 7/7 (L1–L7) | 9 | 5m38s |
| 06 | native | 04 | 2 | `aa06c65d2bae475817a6ffbeee91bf71` | completed | 17 | agent_trace, read_artifact, genai_log, agent_config, query_table, schema_lookup, log_analysis | 7/7 (L1–L7) | 9 | 4m21s |
| 07 | custom | 01 | 1 | `c5e7421d2baacf54f243fed2ce91bfc0` | failed | 3 | agent_trace, agent_config, schema_lookup | 5/7 (L1,L2,L3,L4,L7) | 6 | 24s |
| 08 | custom | 01 | 2 | `1d988e1d2bee475817a6ffbeee91bf4f` | failed | 3 | agent_trace, read_artifact, schema_lookup | 2/7 (L1,L4) | 6 | 22s |
| 09 | custom | 03 | 1 | `522986d12beacf54f243fed2ce91bfa7` | complete | 2 | agent_trace, schema_lookup | 2/7 (L1,L4) | 4 | 19s |
| 10 | custom | 03 | 2 | `4cb98e952b22875817a6ffbeee91bfa1` | complete | 2 | agent_trace, schema_lookup | 2/7 (L1,L4) | 4 | 20s |
| 11 | custom | 04 | 1 | `a53a02592beacf54f243fed2ce91bf65` | complete | 3 | agent_trace, read_artifact, schema_lookup | 2/7 (L1,L4) | 5 | 19s |
| 12 | custom | 04 | 2 | `deba8a1d2b22875817a6ffbeee91bfbb` | complete | 3 | agent_trace, read_artifact, schema_lookup | 2/7 (L1,L4) | 5 | 26s |

`layers_available` = **7/7** on every row (read per §E3, verified pre- and post-pass).
`layers_swept` values above are the **mechanical** §E2 map of the distinct tool set; the §E2
qualifier on `agent_config`'s three layers (row 07 only) is deliberately left to the scorer.

## Operator-level observations (measurement facts, not judgments)

1. **Native's tool count matched the plan's `type=tool` task count exactly on all six rows**
   (18/18, 17/17, 13/13, 16/16, 14/14, 17/17), so the audit trail lost nothing on the native arm.
2. **The custom arm's `x_snc_troubleshoot_run.status` is authoritative; the native arm's is not.**
   Every native anchor was left at `status: running` even after its agent execution reached
   `completed`. A scorer reading `status` off a native anchor would misread it.
3. **Every custom run received exactly one harness HOLD**, all six citing "layer 4 (ranked) must be
   reached". In every case the model's next tool call was a `schema_lookup`, and in five of six that
   lookup targeted a platform/OOB table (`incident`, `incident.priority`,
   `incident.assignment_group`, `sn_aia_tools_execution`) rather than the bench table under
   diagnosis; the sixth (row 07) targeted `sn_tsbench_bench_ticket`, which does not exist.
   Recorded as measured behaviour — no interpretation offered.

---

