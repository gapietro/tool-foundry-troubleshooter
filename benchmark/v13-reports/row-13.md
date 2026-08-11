## Fix Report — Execution Plan `a513a33e2b624718f243fed2ce91bf4e`

---

### FAILURE SUMMARY

The user invoked agent **Seed 04 Summarizer** and asked it to summarise bench ticket `64c2abbe2bea0bd817a6ffbeee91bf2f`. The agent correctly selected the `summarise_ticket` tool, which in turn called `sn_one_extend.OneExtendUtil.execute` against capability `92ff62af516741769c437feb88c80ef3` (`x_snc_tsbench_unmapped_capability`). That call returned `ok: false`, `status: error`, `planId: null` — the capability could not dispatch to any provider because its definition's **api** field points to the nil GUID (`00000000000000000000000000000000`), which resolves to no row in `sys_hub_flow`. The agent surface-reported "Ticket Summarisation Failed" to the user. No data was returned. The agent description itself states the break is deliberate: *"Benchmark seed - deliberately broken."*

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | ✅ SWEPT | Tool call returned `ok:false`; no script errors in message stream |
| 2 | Agent instructions | ✅ SWEPT | Instructions are coherent; instruct use of `summarise_ticket` |
| 3 | Tool definitions | ✅ SWEPT | Tool binding active, script hardcodes capability sys_id |
| 4 | Data schemas | ✅ SWEPT | `x_snc_tsbench_ticket` exists with 8 fields |
| 5 | Data (records) | ✅ SWEPT | Target ticket record exists and is readable |
| 6 | GenAI stack | ✅ SWEPT | Capability definition has dangling `api` — **confirmed root cause** |
| 7 | Trigger & wiring | ✅ SWEPT | No trigger wiring; agent invoked conversationally (expected) |
| — | Platform logs | ⚠️ UNAVAILABLE | `syslog` is caller-restricted; an instance administrator must relax `caller_access` on `syslog` or export logs from a permitted scope to sweep this layer |

---

### ROOT CAUSES

#### RC-1 — Dangling `api` on the GenAI capability definition

| Attribute | Value |
|-----------|-------|
| **Layer** | 6 — GenAI stack |
| **Component** | `sys_one_extend_capability_definition` — record `904c0485699a4a73a124446a7231c563` |
| **Finding** | The `api` field holds the nil GUID `00000000000000000000000000000000`. The `api_type` is `sys_hub_flow`. No row with that sys_id exists in `sys_hub_flow`. The executor finds no flow to dispatch to and returns `status: error`. |
| **Evidence** | `genai_log` check_config, definition `904c0485699a4a73a124446a7231c563`, field `api` = `00000000000000000000000000000000`; `sys_hub_flow` read status `empty` (table was readable — the target genuinely does not exist). Corroborated by tool call response: `ok:false`, `status:error`, `planId:null` (`sn_aia_tools_execution` row `bf13ab3e2b624718f243fed2ce91bfad`). |
| **Confidence** | **CONFIRMED** — two independent layers agree |

#### RC-2 — `ticket` input declared non-mandatory in tool schema

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac`, input schema, field `ticket` |
| **Finding** | `mandatory: false`. The ticket sys_id is the only meaningful input; marking it optional allows the model to omit it without error, producing a silent bad call. |
| **Evidence** | `agent_config` tools section, binding `3c72dab2668c4ba5a6080a5cd5fb2b91`, `inputs` array, `mandatory: false`. |
| **Confidence** | **CONFIRMED** |

#### RC-3 — Tool description lacks input-format and output guidance

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac`, `description` field |
| **Finding** | Description does not state what format `ticket` must be (sys_id vs number), nor what the output structure looks like. The model must invent both. |
| **Evidence** | `agent_config` tool smell: `description_no_input_guidance` and `description_no_negative_guidance` (medium severity, heuristic). Current description: *"Summarises a bench ticket by invoking the x_snc_tsbench_unmapped_capability GenAI capability. Give it a ticket sys_id. Returns the generated summary."* |
| **Confidence** | **CONFIRMED** (heuristic — verify by reading the description) |

---

### FIXES

#### FIX-1 — Repoint the capability definition's `api` to a real `sys_hub_flow` record

| Attribute | Value |
|-----------|-------|
| **Target type** | Configuration — GenAI capability definition |
| **Target** | `sys_one_extend_capability_definition`, record `904c0485699a4a73a124446a7231c563`, field `api` |
| **Current** | `00000000000000000000000000000000` (nil GUID — resolves to no flow) |
| **Proposed** | The sys_id of the intended `sys_hub_flow` provider integration record (e.g., the Now LLM Service spoke flow for the target model). Identify the correct flow in **Now Assist** → **Capabilities** → **x_snc_tsbench_unmapped_capability** → **Edit definition** → **API** picker. |
| **Rationale** | The capability executor reads `api` to locate the flow it dispatches through. A nil GUID means no flow is ever found; the call fails before any model is contacted. Binding the correct flow record unblocks the entire call chain. |

#### FIX-2 — Mark `ticket` input as mandatory in the tool schema

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac`, input definition for `ticket`, field `mandatory` |
| **Current** | `false` |
| **Proposed** | `true` |
| **Rationale** | The tool cannot function without a ticket sys_id. Making the field mandatory causes the orchestrator to enforce its presence at selection time rather than allowing a silent omission that would fail at runtime. |

#### FIX-3 — Improve tool description with input-format and output guidance

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac`, field `description` |
| **Current** | `Summarises a bench ticket by invoking the x_snc_tsbench_unmapped_capability GenAI capability. Give it a ticket sys_id. Returns the generated summary.` |
| **Proposed** | `Summarises a single bench ticket (x_snc_tsbench_ticket). Requires the ticket's sys_id (32-character hex string) as input — do not pass a ticket number or any other identifier. Returns the generated summary text on success. Do not use this tool for non-bench-ticket records or for any task other than summarisation.` |
| **Rationale** | Explicitly states the expected input format, what the tool does not cover, and what the output looks like. Reduces model hallucination of input values and improper tool selection. |

---

### VERIFICATION

1. After applying FIX-1, open **Now Assist** → **Capabilities** → **x_snc_tsbench_unmapped_capability** and confirm the definition's **API** field resolves to a non-null `sys_hub_flow` record.
2. Re-run the agent against any `x_snc_tsbench_ticket` sys_id using the same conversational invocation path.
3. In the new execution plan (via agent_trace), confirm: tool call response `ok: true`, `result` contains summary text, and the GenAI task completes with status `Success`.
4. Run `genai_log check_config` on capability `92ff62af516741769c437feb88c80ef3` and confirm zero findings are returned.

---

### DATA MARKERS

The following record data was quoted above as evidence. Redact before this report crosses the instance boundary:

- `sys_one_extend_capability_definition.api = 00000000000000000000000000000000` (nil GUID — not sensitive, but confirms misconfiguration)
- `x_snc_tsbench_ticket.short_description = "Meeting room display flickers with a magenta cast during video calls on the third floor"` (ticket content — redact if instance data is confidential)
- `sn_aia_message` user profile block: email `admin@example.com`, name `System Administrator`, sys_id `6816f79cc0a8016401c5a33be04be441`

---

> **Note on platform logs (Layer 7 gap):** The `syslog` table is caller-restricted and could not be read. No platform-level script errors were observed through `agent_trace`'s message-stream mining (0 script errors found), but errors occurring *outside* the execution boundary — such as a flow launch failure in the Now LLM Service — would not appear there. An instance administrator should export or review syslog entries for the window `2026-08-11 01:22:43` – `2026-08-11 01:27:04` to rule out any platform-side error corroborating RC-1.
References: null
