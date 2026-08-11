## Fix Report — Execution Plan `b52d5f0b2bea031017a6ffbeee91bfec`

---

### FAILURE SUMMARY

The user asked agent **Seed 07 Ticket Classifier** to classify bench ticket `e6dcdf072bea031017a6ffbeee91bfe4` and report its category. The execution plan reached state **Completed** and the agent replied that the ticket was classified as category **MESSAGING**. That answer is fabricated: the bench-ticket table (`x_snc_tsbench_ticket`) has **no `category` column**, so the tool `read_ticket_context` could never return one. The LLM inferred a category solely from the short description text. In addition, the tool unconditionally appends 260 lines of synthetic operational noise to every response, producing a ~58 K-character payload that bloats the LLM scratchpad. The agent description explicitly labels this a *deliberately broken* benchmark seed; the three confirmed defects below are the intentional breaks.

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `agent_trace` on plan `b52d5f0b2bea031017a6ffbeee91bfec` |
| 2 | Agent instructions | **SWEPT** | `agent_config` — full instruction text read |
| 3 | Tool definitions | **SWEPT** | `agent_config` — tool script and input schema read |
| 4 | Data schemas | **SWEPT** | `schema_lookup` on `x_snc_tsbench_ticket` — 8 columns confirmed |
| 5 | Data | **SWEPT** | `query_table` on `x_snc_tsbench_ticket` — record exists, `category` and `state` absent |
| 6 | GenAI stack | **SWEPT** | `genai_log` for_execution + check_config on definition `31fee654ff116e10b9c9fffffffffffd` — no findings |
| 7 | Trigger and wiring | **SWEPT** | `agent_config` triggers section — no trigger wiring present |
| — | Platform logs | **UNAVAILABLE** | `syslog` is caller-restricted; an instance administrator must relax `caller_access` on `syslog` or export logs from a permitted scope. **Not reported as clean.** |

---

### ROOT CAUSES

#### RC-1 — No `category` column on the ticket table

| Attribute | Value |
|-----------|-------|
| **Layer** | 4 — Data schema |
| **Component** | Table `x_snc_tsbench_ticket` |
| **Finding** | The table has 8 columns: `sys_id`, `short_description`, `priority`, `u_caller`, `u_description`, `u_impact`, `u_resolution`, `u_ticket_number`. There is no `category` column. The tool script never reads or returns one. The LLM therefore invents a category value from the ticket's natural-language short description. |
| **Evidence** | `schema_lookup` on `x_snc_tsbench_ticket` (artifact `436a2f832b26431017a6ffbeee91bfa9`) — field count 8, `category` absent. Confirmed by `query_table` field_warnings: `["category", "state"]` listed as missing fields on record `e6dcdf072bea031017a6ffbeee91bfe4`, read status ok. |
| **Confidence** | **CONFIRMED** |

---

#### RC-2 — Tool script injects 260 lines of synthetic noise into every response

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 — Tool definition |
| **Component** | `sn_aia_tool[2465188619a2417682e91483d560c084]` — `read_ticket_context` script |
| **Finding** | The script unconditionally builds a 260-iteration loop appending lines of the form `ctx.event seq=N source=operational_feed … detail=no-classification-relevant-content-in-this-record-it-is-here-to-be-unfiltered-raw-feed-material` and assigns the result to `out.raw_context_feed`. This single field inflates the tool response to **58,471 characters** (threshold: 20,000 chars). The payload is re-read on every subsequent LLM turn, compounding token cost and crowding out genuine classification signals. |
| **Evidence** | Tool script body in `agent_config` artifact `793aa3432b26431017a6ffbeee91bf0e` (offset 4000), field `tool.script.body`. Latency flag `tool_output_bloat` in `agent_trace` artifact `de1aefcf2be2431017a6ffbeee91bf31` (offset 16000): response 58,471 chars, threshold 20,000 chars, `sn_aia_tools_execution[af2d174b2bea031017a6ffbeee91bf45]`. |
| **Confidence** | **CONFIRMED** |

---

#### RC-3 — `ticket` input declared non-mandatory, enabling a silent failure path

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 — Tool definition |
| **Component** | `sn_aia_agent_tool_m2m[b1b830fa038a444f9a7a890d6fd19948]` input schema; `sn_aia_tool[2465188619a2417682e91483d560c084]` script |
| **Finding** | The input schema declares `ticket` with `mandatory: false`. The script guards against an empty `id` and returns `{ok: false, error: 'ticket sys_id missing or not found'}` — a silent JSON error string rather than a hard failure. If the LLM omits the sys_id, it receives this error payload as tool output and may continue reasoning as though the call succeeded, producing a classification response with no real ticket data. |
| **Evidence** | `agent_config` artifact `793aa3432b26431017a6ffbeee91bf0e` offset 4000: `"inputs": "[{\"name\":\"ticket\",\"mandatory\":false}]"`. Script early-return: `if (!id) { return JSON.stringify(out); }` in same source. |
| **Confidence** | **CONFIRMED** |

---

#### RC-4 (Supplementary) — No trigger wiring

| Attribute | Value |
|-----------|-------|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m` |
| **Finding** | Zero trigger links on both branches (agent-direct and team/usecase chain). The agent cannot fire autonomously on record events. This execution was invoked conversationally (channel: Interactive), so this defect did not cause the failure of this specific run — but automated triggering is unavailable. |
| **Evidence** | `agent_config` triggers section: `wiring_findings[0].finding = "no_trigger_wiring"`, agent-direct 0 rows, team/usecase chain 0 rows. All underlying reads succeeded (not DENIED), so the absence is genuine. |
| **Confidence** | **CONFIRMED** (does not affect this conversational run) |

---

### FIXES

#### FIX-1 — Add a `category` column to `x_snc_tsbench_ticket`

| Attribute | Value |
|-----------|-------|
| **Target type** | Data (schema) |
| **Target** | Table `x_snc_tsbench_ticket` — add column |
| **Current** | No `category` column exists; 8 columns present |
| **Proposed** | Add a String (or Integer choice) field named `category`. Populate the field with the correct category value on each bench ticket record. |
| **Rationale** | Without this column the tool can never return a real category; the LLM is forced to hallucinate one from free text. |

---

#### FIX-2 — Remove the synthetic noise loop from `read_ticket_context`

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema (script) |
| **Target** | `sn_aia_tool[2465188619a2417682e91483d560c084]` — field `script` |
| **Current** | A 260-iteration loop appends synthetic `ctx.event` lines to `out.raw_context_feed`, producing ~58 K chars per call |
| **Proposed** | Delete the loop and the `out.raw_context_feed` assignment entirely. Return only the fields the agent needs: `ok`, `error`, `short_description`, `priority`, and (after FIX-1) `category`. |
| **Rationale** | Eliminates the `tool_output_bloat` latency flag, reduces LLM token consumption, and removes noise that crowds out genuine classification signals. |

---

#### FIX-3 — Mark `ticket` input as mandatory

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_agent_tool_m2m[b1b830fa038a444f9a7a890d6fd19948]` — field `inputs`; and `sn_aia_tool[2465188619a2417682e91483d560c084]` — field `input_schema` |
| **Current** | `"mandatory": false` on the `ticket` input in both the binding and the tool record |
| **Proposed** | Set `"mandatory": true` on the `ticket` input in both locations |
| **Rationale** | Forces the LLM to always supply the sys_id before calling the tool. Prevents the silent-error path where the tool returns `{ok: false}` and the agent continues without real data. |

---

#### FIX-4 (Optional) — Add trigger wiring for automated invocation

| Attribute | Value |
|-----------|-------|
| **Target type** | Wiring |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` — create trigger link for agent `56c9f86373974407ac1a276a91cdfa79` |
| **Current** | 0 trigger links on both branches |
| **Proposed** | Create an appropriate trigger link (table/record event) if the agent is intended to fire automatically on ticket creation or update |
| **Rationale** | Without trigger wiring the agent can only be invoked conversationally. If automated classification is required, a trigger must be configured. |

---

### VERIFICATION

After applying FIX-1, FIX-2, and FIX-3:

1. **Re-run the agent** conversationally with the same ticket sys_id `e6dcdf072bea031017a6ffbeee91bfe4`.
2. **Inspect the new execution plan** with `agent_trace`: confirm `tool_output_bloat` flag is absent and tool response length is under 20,000 chars.
3. **Confirm the agent's response** names the value stored in the `category` field of the ticket record — not an LLM inference.
4. **Verify mandatory enforcement**: attempt a call without supplying a ticket sys_id and confirm the plan errors before invoking the tool rather than returning a silent `{ok: false}` response.

---

### DATA MARKERS

The following record data was quoted above as evidence and must be reviewed for redaction before this report crosses the instance boundary:

- `x_snc_tsbench_ticket[e6dcdf072bea031017a6ffbeee91bfe4]` — field `short_description`: *"Conference bridge drops the first ninety seconds of every scheduled call in the east wing"*
- `sn_aia_message[af2d574b2bea031017a6ffbeee91bf0c]` — agent message content digest (ticket data echoed into the conversation)
- User profile entry: email `admin@example.com`, name *System Administrator* (appears in execution message stream)
References: null
