## Fix Report — Seed 05 Ticket Acknowledger

---

### FAILURE SUMMARY

The agent `Seed 05 Ticket Acknowledger` produced no execution plan when bench ticket `25e32b4b2b228310f243fed2ce91bf22` was created (short_description: *Sprinkler inspection tag in the server room expired and needs recertification before audit*, created 2026-08-11 20:06:44). The ticket satisfied the trigger condition (`short_descriptionISNOTEMPTY`), but the trigger `Seed 05 Bench Ticket Created` is **inactive** (`active = 0`). An inactive trigger is never evaluated by the platform; it does not fire, no business rule is raised, and no execution plan is ever queued. Every downstream layer — instructions, tools, GenAI stack — was never reached because the entry point is disabled.

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `sn_aia_execution_plan` read status `empty` — no plan was ever created. Confirmed absence, not a permission gap. |
| 2 | Instructions | **SWEPT** | Agent instruction body present (118 chars). Use case `Seed 05 Ticket Acknowledgement` has a base_plan. No anomaly found. |
| 3 | Tool definitions | **SWEPT** | Zero tools attached (`sn_aia_agent_tool_m2m` read status `empty`). Consistent with a simple acknowledgement agent; not a defect. |
| 4 | Data schemas | **SWEPT** | Table `x_snc_tsbench_ticket` exists. Fields `state` and `active` do not exist on this table (field_warnings returned by `query_table`). Not related to the failure. |
| 5 | Data | **SWEPT** | Ticket `25e32b4b2b228310f243fed2ce91bf22` exists with a non-empty `short_description`. The triggering record is valid. |
| 6 | GenAI stack | **SWEPT** | `genai_log check_config` with filter `Seed 05` matched zero capability definitions. Since the trigger never fired and no LLM call was ever made, this absence is expected and is not an independent defect. |
| 7 | Trigger and wiring | **SWEPT** | Trigger `Seed 05 Bench Ticket Created` is wired correctly to use case `Seed 05 Ticket Acknowledgement` via `sn_aia_trigger_agent_usecase_m2m`, but `active = 0`. **This is the root cause.** |
| — | Platform logs (syslog) | **UNAVAILABLE** | `syslog` table enforces `caller_access = Caller Restriction`. The diagnostic application cannot lift this. An instance administrator must relax `caller_access` on `syslog` or export the logs directly. Not required to confirm this diagnosis, as the root cause is configuration-level. |

---

### ROOT CAUSES

#### RC-1 — Trigger is inactive

| Field | Value |
|-------|-------|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_configuration` · `bfb77d6c64884500a80203ee029436ee` · field `active` |
| **Finding** | The trigger `Seed 05 Bench Ticket Created` has `active = 0`. The platform never evaluates an inactive trigger, so no execution plan is created regardless of whether the condition matches. |
| **Evidence** | `agent_config` artifact `34056bc72b62431017a6ffbeee91bfc4`, triggers section: `trigger.active = "0"`, `trigger.condition = "short_descriptionISNOTEMPTY"`, `trigger.target_table = "x_snc_tsbench_ticket"`. Corroborated by `agent_trace` returning `sn_aia_execution_plan` read status `empty` and zero candidates. |
| **Confidence** | **CONFIRMED** — two independent layers (trace absence + configuration active flag) agree. |

#### RC-2 — No run-as identity on the trigger (advisory)

| Field | Value |
|-------|-------|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_configuration` · `bfb77d6c64884500a80203ee029436ee` · fields `run_as_field`, `run_as_user`, `run_as_script` |
| **Finding** | The trigger names no run-as identity at all (`identity_resolution = none`). Once the trigger is activated (RC-1 fixed), the run-as identity will be resolved per-execution from the triggering record context. If the resolved identity lacks the required roles, the agent will trigger but fail at runtime. |
| **Evidence** | `agent_config` artifact, triggers → access_alignment: `run_as_field = null`, `run_as_user = ""`, `run_as_script_present = false`, `comparison_status = not_possible`. Also: `sys_agent_access_role_configuration` read status `empty` — no access roles are configured for this agent. |
| **Confidence** | **UNCONFIRMED** — the risk is structural (no static identity, no role rows). Whether it causes a runtime failure depends on the resolved identity of the first real execution. Confirm by running the agent after RC-1 is fixed and inspecting the resulting execution plan for access errors. |

---

### FIXES

#### FIX-1 — Activate the trigger

| Field | Value |
|-------|-------|
| **Target type** | Configuration |
| **Target** | `sn_aia_trigger_configuration` · sys_id `bfb77d6c64884500a80203ee029436ee` · field `active` |
| **Current** | `0` (false) |
| **Proposed** | `1` (true) |
| **Rationale** | An inactive trigger is never evaluated. Setting `active = 1` re-enables platform evaluation of the condition `short_descriptionISNOTEMPTY` on table `x_snc_tsbench_ticket`, allowing the trigger to fire on new records and queue an execution plan for the agent. |

**How to apply:** In ServiceNow, navigate to *AI Agent Studio → Triggers*, open **Seed 05 Bench Ticket Created**, and toggle **Active** to `true`. Save the record.

#### FIX-2 — Configure a run-as identity (advisory, apply after FIX-1)

| Field | Value |
|-------|-------|
| **Target type** | Configuration |
| **Target** | `sn_aia_trigger_configuration` · sys_id `bfb77d6c64884500a80203ee029436ee` · field `run_as_field` or `run_as_user` |
| **Current** | Both empty; no `sys_agent_access_role_configuration` rows exist for this agent |
| **Proposed** | Either (a) set `run_as_field` to the field on `x_snc_tsbench_ticket` that holds the assignee/caller identity, or (b) set a static `run_as_user` with the required Now Assist roles, or (c) define access roles in *AI Agent Studio → Define Data Access* |
| **Rationale** | Without a run-as identity the platform will resolve the executor contextually per run. If that identity lacks privileges the agent will trigger but produce an access-gated execution. Explicit wiring avoids unpredictable per-record identity variance. |

---

### VERIFICATION

1. **Apply FIX-1.** Confirm `sn_aia_trigger_configuration.bfb77d6c64884500a80203ee029436ee.active = true`.
2. **Create a new bench ticket** on `x_snc_tsbench_ticket` with a non-empty `short_description`.
3. **Query `sn_aia_execution_plan`** filtered to agent `a4b7ef5d793346ea861730c6d28b8f58` and `sys_created_on` after the ticket creation timestamp. Expect at least one row with `state` progressing to `complete` or `in_progress`.
4. If the plan appears but errors out, re-run `agent_trace` on the new plan sys_id to check for access or script errors (RC-2 scenario).
5. If no plan appears within 30 seconds, check platform logs (syslog, requires admin access) for errors from scope `x_snc_tsbench` around the ticket creation time.

---

### DATA MARKERS

The following record data was cited as evidence and should be redacted before this report crosses the instance boundary:

- `x_snc_tsbench_ticket.25e32b4b2b228310f243fed2ce91bf22.short_description` — *Sprinkler inspection tag in the server room expired and needs recertification before audit*
- `x_snc_tsbench_ticket.25e32b4b2b228310f243fed2ce91bf22.sys_created_on` — *2026-08-11 20:06:44*
References: null
