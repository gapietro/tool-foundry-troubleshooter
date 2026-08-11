# Fix Report — Agent: Seed 04 Summarizer
**Execution Plan:** ea63a3b22b2e0bd817a6ffbeee91bfb0 | **Run date:** 2026-08-11 01:26:09 UTC

---

## FAILURE SUMMARY

The user asked the **Seed 04 Summarizer** agent to summarise bench ticket `c5c2a77a2b624718f243fed2ce91bf25`. The agent reached the `summarise_ticket` tool, invoked it, and received an immediate hard error: `ok: false`, `status: "error"`, `planId: null`. The model recognised the failure and reported it to the user as *"Plan invalid or not created."* The run completed in the technical sense (state = Completed, all tasks = Success) but produced **no summarisation output**.

The failure originated entirely in the GenAI capability layer: the capability definition backing `summarise_ticket` has a dangling `api` pointer — an all-zeros document ID that resolves to no record in `sys_hub_flow` — so the executor cannot dispatch to any LLM provider. Additionally, the tool binding is marked inactive (`active_tool_count: 0`), so even a repaired capability would not be reliably reachable until the binding is re-activated.

The agent description confirms this is a deliberately broken benchmark seed: *"Summarises a bench ticket through a capability that has no provider bound to it."*

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | agent_trace on plan ea63a3b22b2e0bd817a6ffbeee91bfb0 |
| 2 | Instructions | **SWEPT** | agent_config — full instruction text retrieved |
| 3 | Tool definitions | **SWEPT** | agent_config — tool schema and binding retrieved |
| 4 | Data schemas | **SWEPT** | query_table field_warnings confirmed x_snc_tsbench_ticket schema; `number` and `state` fields do not exist on the table |
| 5 | Data | **SWEPT** | query_table confirmed ticket record exists (1 row returned, read status ok) |
| 6 | GenAI stack | **SWEPT** | genai_log check_config on capability — dangling api confirmed |
| 7 | Trigger and wiring | **SWEPT** | agent_config triggers section — 0 trigger links, 0 active trigger configurations |
| — | Platform logs | **UNAVAILABLE** | `syslog` has `caller_access = Caller Restriction`; a cross-scope privilege cannot lift it. An instance administrator must relax `caller_access` on `syslog` or export the log for inspection. Script errors inside the run are still visible via agent_trace (none found). |

---

## ROOT CAUSES

### RC-1 — Dangling `api` on the capability definition *(direct cause of failure)*

| Field | Value |
|-------|-------|
| **Layer** | 6 — GenAI stack |
| **Component** | Capability definition `904c0485699a4a73a124446a7231c563` on capability `92ff62af516741769c437feb88c80ef3` (`x_snc_tsbench_unmapped_capability`) |
| **Finding** | The `api` field holds the all-zeros sentinel `00000000000000000000000000000000`, which resolves to no record in `sys_hub_flow`. `api_type` is `sys_hub_flow`. The executor cannot dispatch the LLM call; it returns `planId: null` immediately. |
| **Evidence** | genai_log check_config → definition `904c0485699a4a73a124446a7231c563`, `api = 00000000000000000000000000000000`, `api_state: "dangling"`, `sys_hub_flow` read status `empty`. Tool task in agent_trace (sys_id `9473ebb22b2e0bd817a6ffbeee91bf96`) output: `ok: false`, `status: "error"`, `planId: null`, `raw_response.capabilities: {}`. Tool call record sys_id `5873ebb22b2e0bd817a6ffbeee91bf9a`, response `ok: false`. |
| **Confidence** | **CONFIRMED** — execution trace error and capability definition independently agree. |

---

### RC-2 — Tool binding is inactive

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_agent_tool_m2m` binding `3c72dab2668c4ba5a6080a5cd5fb2b91` for `summarise_ticket` on agent `8bac1f84f3a1481487fe8dd219295914` |
| **Finding** | `active_tool_count: 0` — the binding is marked inactive. The tool was invoked on this run (the runtime honoured the binding regardless), but an inactive binding may be excluded on other invocation paths or platform versions. |
| **Evidence** | agent_config overview → `tool_count: 1`, `active_tool_count: 0`. |
| **Confidence** | **CONFIRMED** as a configuration defect. Whether it independently caused this run's failure is **UNCONFIRMED** (RC-1 was the direct cause); however the binding must be active to be safe across all paths. |

---

### RC-3 — No triggers wired *(informational)*

| Field | Value |
|-------|-------|
| **Layer** | 7 — Trigger and wiring |
| **Component** | Agent `8bac1f84f3a1481487fe8dd219295914` trigger configuration |
| **Finding** | `trigger_links: 0`, `active_trigger_links: 0`, `active_trigger_configurations: 0`. Agent is reachable interactively only. |
| **Evidence** | agent_config triggers section — `sn_aia_trigger_agent_usecase_m2m` read status `empty`. |
| **Confidence** | **CONFIRMED** as a gap; not a root cause for this (interactive) execution. |

---

## FIXES

### FIX-1 — Repoint the capability definition `api` to a real provider flow *(resolves RC-1)*

| Field | Value |
|-------|-------|
| **Target type** | Configuration (GenAI capability definition) |
| **Target record** | `sys_one_extend_capability_definition`, sys_id `904c0485699a4a73a124446a7231c563` |
| **Target field** | `api` |
| **Current value** | `00000000000000000000000000000000` (dangling — resolves to no `sys_hub_flow` record) |
| **Proposed value** | The sys_id of the intended `sys_hub_flow` record for the LLM provider integration. Identify it by navigating to **Now Assist** → **Capabilities** → locate the correct provider flow in `sys_hub_flow`, copy its sys_id, and set it here. |
| **Rationale** | `api` is mandatory for capability dispatch. A dangling value causes every invocation to return `planId: null` / `status: error`. Pointing it at a real flow restores LLM dispatch entirely. |

---

### FIX-2 — Activate the tool binding *(resolves RC-2)*

| Field | Value |
|-------|-------|
| **Target type** | Configuration (agent–tool binding) |
| **Target record** | `sn_aia_agent_tool_m2m`, sys_id `3c72dab2668c4ba5a6080a5cd5fb2b91` |
| **Target field** | `active` (active/enabled flag) |
| **Current value** | Inactive (`active_tool_count: 0`) |
| **Proposed value** | Active / checked |
| **Rationale** | An inactive binding may be excluded from certain invocation paths. Activating it ensures `summarise_ticket` is reliably reachable across all run modes. |

---

### FIX-3 — (Optional) Add trigger wiring if automated invocation is needed *(addresses RC-3)*

| Field | Value |
|-------|-------|
| **Target type** | Wiring |
| **Target record** | `sn_aia_trigger_agent_usecase_m2m` — create a new row |
| **Current value** | No trigger links |
| **Proposed value** | Bind to the appropriate use case and trigger condition if the agent should fire automatically on record events. |
| **Rationale** | Not required for interactive use; add only if automated triggering is desired. |

---

## VERIFICATION

1. After FIX-1: Navigate to **Now Assist** → **Capabilities** → open `x_snc_tsbench_unmapped_capability` → open its definition → confirm `api` resolves to a real `sys_hub_flow` record (record picker shows a name, not blank or zeros).
2. After FIX-2: Open `sn_aia_agent_tool_m2m` binding `3c72dab2668c4ba5a6080a5cd5fb2b91` and confirm `active = true`.
3. Re-run the agent interactively with the same objective.
4. In the new execution plan confirm:
   - The `summarise_ticket` tool call returns `ok: true`.
   - `planId` is populated (non-null).
   - The agent's final message contains a substantive ticket summary, not an error notice.
5. Run `genai_log check_config` on capability `92ff62af516741769c437feb88c80ef3` — confirm `api_state` changes from `dangling` to `ok`.

---

## DATA MARKERS

The following record data was quoted as evidence and should be reviewed for redaction before this report crosses the instance boundary:

- **User profile:** email `admin@example.com`, display name *System Administrator*, user sys_id present in the message stream.
- **Ticket short_description:** *"Nightly inventory reconciliation job omits the final warehouse in its output file"* — table `x_snc_tsbench_ticket`.
- All other cited values are sys_ids or configuration field values; no additional PII identified.
References: null
