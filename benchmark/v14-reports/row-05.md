## Fix Report — *Seed 05 Ticket Acknowledger* did not run

---

### FAILURE SUMMARY

The agent `Seed 05 Ticket Acknowledger` produced no execution plan when bench ticket `25e32b4b2b228310f243fed2ce91bf22` was created. The ticket exists, its `short_description` is non-empty, and the trigger condition `short_descriptionISNOTEMPTY` would have been satisfied — but the trigger that links this agent to the `x_snc_tsbench_ticket` table is **inactive**. A disabled trigger is never evaluated by the platform event bus, so no execution plan is created and no LLM call is made. The absence of any execution plan is itself the primary symptom; everything else in the stack is correctly configured.

---

### LAYERS SWEPT

| Layer | Status | Notes |
|---|---|---|
| 1 — Execution trace | SWEPT | `sn_aia_execution_plan` read status: `empty`. Absence confirmed; no plan was ever created. |
| 2 — Agent instructions | SWEPT | Instructions present (118 chars). No defect found. |
| 3 — Tool definitions | SWEPT | Zero tools bound (`sn_aia_agent_tool_m2m` read status: `empty`). Consistent with an acknowledgement-only agent; not a defect. |
| 4 — Data schemas | SWEPT (via query_table) | `x_snc_tsbench_ticket` confirmed to exist. `schema_lookup` was not called independently; `query_table` field warnings surfaced that `state` and `opened_by` are absent from this table, but neither is referenced by the trigger condition or agent instructions. No schema defect blocking the run. |
| 5 — Data | SWEPT | Ticket `25e32b4b2b228310f243fed2ce91bf22` exists, `short_description` = *"Sprinkler inspection tag in the server room expired and needs recertification before audit"* (non-empty). Trigger condition would have been satisfied. |
| 6 — GenAI stack | SWEPT | `genai_log check_config` with filter "Seed 05 Ticket Acknowledger" returned no matching capability definition row — expected, because the agent uses the platform-level ReAct engine capability ("AIA ReAct Engine_Amazon Bedrock"), not an agent-named capability. That engine is confirmed healthy: 50 successful LLM calls in the last 24 hours. No LLM call exists for this agent because it never ran. |
| 7 — Trigger and wiring | SWEPT | **Defect found.** See Root Causes below. |

---

### ROOT CAUSES

#### RC-1 — Trigger is inactive

| Field | Value |
|---|---|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_configuration` |
| **Record** | *Seed 05 Bench Ticket Created* — sys_id `bfb77d6c64884500a80203ee029436ee` |
| **Finding** | `active` = `"0"`. The trigger is disabled. The platform never evaluates the condition and never creates an execution plan. |
| **Evidence** | `agent_config` artifact `87046f032b62431017a6ffbeee91bf74`, triggers section: `"active":"0"`, `"trigger_sys_id":"bfb77d6c64884500a80203ee029436ee"`, confirmed by overview counts `active_trigger_links=0`, `active_trigger_configurations=0`. |
| **Confidence** | **CONFIRMED** — direct field read, cross-confirmed by zero active counts in overview. |

#### RC-2 (secondary, informational) — No run-as identity on trigger

| Field | Value |
|---|---|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_configuration` — `run_as_field`, `run_as`, `run_as_user` |
| **Finding** | All three identity fields are blank; `identity_resolution = "none"`. The agent will execute under whatever session identity the platform assigns at runtime. ACL alignment cannot be verified from configuration alone. |
| **Evidence** | `agent_config` artifact, access_alignment block: `"run_as_paths":{"static_user":0,"per_record_field":0,"script":0,"none":1}`. |
| **Confidence** | CONFIRMED as a gap in static verifiability. Whether it causes a runtime access failure is **UNCONFIRMED** — confirming it requires a real failing execution and comparing that session's roles against the agent's access role set. Currently moot because RC-1 prevents any execution from starting. |

---

### FIXES

#### Fix 1 — Activate the trigger *(resolves RC-1)*

| Field | Value |
|---|---|
| **Target type** | Configuration |
| **Target** | `sn_aia_trigger_configuration`, sys_id `bfb77d6c64884500a80203ee029436ee` — field `active` |
| **Current** | `false` (0) |
| **Proposed** | `true` (1) |
| **Rationale** | An inactive trigger is never evaluated. Setting `active = true` re-registers the trigger with the platform event bus. The condition `short_descriptionISNOTEMPTY` on table `x_snc_tsbench_ticket` will then fire on insert when `short_description` is non-empty, matching the scenario in this mission. |

#### Fix 2 — Confirm run-as identity after Fix 1 *(addresses RC-2)*

| Field | Value |
|---|---|
| **Target type** | Configuration |
| **Target** | `sn_aia_trigger_configuration`, sys_id `bfb77d6c64884500a80203ee029436ee` — fields `run_as_field` or `run_as_user` |
| **Current** | All blank |
| **Proposed** | Set `run_as_field` to the field on `x_snc_tsbench_ticket` that holds the submitting user (e.g. `sys_created_by`), or set `run_as_user` to a named service account with the required roles. |
| **Rationale** | Without an explicit identity, the effective run-as user is platform-assigned and may lack the roles required to read the ticket or invoke the agent. This cannot be confirmed until a real execution exists. Apply after Fix 1 and use the first failing run (if any) to identify the gap. |

---

### VERIFICATION

1. Navigate to **AI Agent Studio → Triggers** and open *Seed 05 Bench Ticket Created* (`bfb77d6c64884500a80203ee029436ee`). Confirm `Active` is checked and save.
2. Create a new `x_snc_tsbench_ticket` record with a non-empty `short_description`.
3. After ~30 seconds, query `sn_aia_execution_plan` for the new ticket's sys_id as context. Expect at least one plan record with `state = complete` or `in_progress`.
4. Re-run `agent_trace` with agent name *Seed 05 Ticket Acknowledger*. Expect a plan header showing the run started and a message stream containing an acknowledgement restating the short description and priority.
5. If the plan is created but errors, run `genai_log` in `for_execution` mode with the new plan sys_id to confirm the LLM was called and returned a response.

---

### DATA MARKERS

The following record data was quoted as evidence and should be redacted before this report leaves the instance:

- `short_description` of ticket `25e32b4b2b228310f243fed2ce91bf22`: *"Sprinkler inspection tag in the server room expired and needs recertification before audit"*
- Ticket `sys_created_on`: `2026-08-11 20:06:44`
References: null
