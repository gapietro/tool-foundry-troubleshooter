# Fix Report — Seed 07 Ticket Classifier
**Execution Plan:** 7fad9f4f2b6e4310f243fed2ce91bf20

---

## FAILURE SUMMARY

The user asked **Seed 07 Ticket Classifier** to classify bench ticket `36dc13472bea031017a6ffbeee91bf75`. The plan state shows **Completed** and the agent returned "HARDWARE" — so the surface behaviour appears successful. However, four confirmed defects are embedded in this run, any one of which can cause incorrect or incomplete operation under slightly different conditions: (a) the tool's `ticket` input is declared non-mandatory, allowing a silent failure if the LLM omits the argument; (b) the ticket's `priority` field is blank, depriving the LLM of a classification signal; (c) the table has no `category` column, so the agent cannot persist its classification — it can only narrate it; and (d) the tool unconditionally emits 260 lines of synthetic noise (58,462 chars) in every response, ballooning LLM context on every turn. The agent description explicitly reads *"Benchmark seed - deliberately broken"*, confirming these are planted defects.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | agent_trace, artifact `c22ceb0f2b26431017a6ffbeee91bf53` |
| 2 | Instructions | **SWEPT** | agent_config, artifact `365c278f2b26431017a6ffbeee91bff9` |
| 3 | Tool definitions | **SWEPT** | agent_config tools section; full script body read |
| 4 | Data schemas | **SWEPT** | schema_lookup, artifact `d8dc27832b66431017a6ffbeee91bf6f`; field_warning on `category` |
| 5 | Data | **SWEPT** | query_table on `x_snc_tsbench_ticket` and `sn_aia_agent_tool_m2m` |
| 6 | GenAI stack | **SWEPT (partial)** | genai_log `for_execution` — 2 LLM calls, both success. `check_config` filter "AIA ReAct Engine" matched 0 definitions (name mismatch; actual definition name is "AIA ReAct Engine_Amazon Bedrock" — no blocking defect confirmed) |
| 7 | Trigger & wiring | **SWEPT** | agent_config triggers section; 0 trigger links — expected for interactive/conversational invocation |
| — | Platform logs (syslog) | **UNAVAILABLE** | `syslog.caller_access = Caller Restriction`; this application cannot lift it. **Required action:** an instance administrator must relax `caller_access` on `syslog` or export the log window 2026-08-11 19:37:35 – 19:41:53 for offline inspection. Do not treat this layer as clean. |

---

## ROOT CAUSES

### RC-1 — Non-mandatory tool input allows silent failure
- **Layer:** 3 – Tool definitions
- **Component:** `sn_aia_agent_tool_m2m[b1b830fa038a444f9a7a890d6fd19948]` → `sn_aia_tool[2465188619a2417682e91483d560c084]`, `input_schema[ticket].mandatory`
- **Finding:** The `ticket` input is declared `mandatory: false`. If the LLM omits the sys_id, the script's early-return path executes, returning `{ok: false, error: "ticket sys_id missing or not found"}` without raising a hard tool error. The agent receives a soft failure it may silently misinterpret.
- **Evidence:** agent_config artifact `365c278f2b26431017a6ffbeee91bff9`, tools section, binding `b1b830fa038a444f9a7a890d6fd19948`, inputs array: `{"name":"ticket","mandatory":false}`. Corroborated by tool script lines 3–6 (id guard).
- **Confidence:** ✅ CONFIRMED

---

### RC-2 — Ticket record has no priority value
- **Layer:** 5 – Data
- **Component:** `x_snc_tsbench_ticket[36dc13472bea031017a6ffbeee91bf75]`.`priority`
- **Finding:** The `priority` field is blank (empty string). The tool returns `priority: ""` to the LLM, removing a classification signal. For ambiguous tickets the agent must rely on `short_description` alone.
- **Evidence:** query_table on `x_snc_tsbench_ticket`, row `36dc13472bea031017a6ffbeee91bf75`: `priority=""`. Corroborated by tool execution response in trace artifact `c22ceb0f2b26431017a6ffbeee91bf53` (offset 4000): `"priority":""`.
- **Confidence:** ✅ CONFIRMED

---

### RC-3 — Table has no `category` column; classification cannot be persisted
- **Layer:** 4 – Data schemas
- **Component:** `x_snc_tsbench_ticket` — missing column `category`
- **Finding:** schema_lookup reports 8 fields; `category` is absent. query_table issued `field_warning: {"missing_fields":["category"]}`. The agent instructions say "assign one category" but there is no column to write the result to — the agent can only narrate it. Any downstream consumer expecting a written category field will read blank.
- **Evidence:** schema_lookup artifact `d8dc27832b66431017a6ffbeee91bf6f`, `field_count=8`, no `category` element. query_table `field_warning` on `x_snc_tsbench_ticket`, `missing_fields:["category"]`.
- **Confidence:** ✅ CONFIRMED

---

### RC-4 — Tool emits 260-line synthetic noise feed in every response (output bloat)
- **Layer:** 3 – Tool definitions
- **Component:** `sn_aia_tool[2465188619a2417682e91483d560c084]`.`script` — `raw_context_feed` generation block
- **Finding:** The script unconditionally builds 260 lines of synthetic "operational_feed" events carrying the literal string `no-classification-relevant-content-in-this-record` and returns them as `raw_context_feed`. This produced a 58,462-char response (threshold: 20,000 chars), flagged as `tool_output_bloat` by agent_trace. The entire payload is re-read by the LLM on every subsequent turn, compounding latency and token cost. On this run `llm_p95_latency=2754 ms`, `llm_token_avg=120`.
- **Evidence:** Trace artifact `c22ceb0f2b26431017a6ffbeee91bf53` (offset 16000), `latency_flags[tool_output_bloat]`: `observed_resp=58462 chars`, `threshold=20000 chars`, remediation note present. Tool script body in agent_config artifact `365c278f2b26431017a6ffbeee91bff9` (offset 4000), `raw_context_feed` loop `for (var i = 0; i < 260; i++)`.
- **Confidence:** ✅ CONFIRMED

---

## FIXES

### FIX-1 — Mark `ticket` input as mandatory
- **Target type:** Tool schema
- **Target:** `sn_aia_agent_tool_m2m[b1b830fa038a444f9a7a890d6fd19948]` (binding) and `sn_aia_tool[2465188619a2417682e91483d560c084]` (tool definition), field `input_schema`
- **Current:** `{"name":"ticket","description":"The sys_id of the bench ticket to read.","mandatory":false}`
- **Proposed:** `{"name":"ticket","description":"The sys_id of the bench ticket to read. Must be a 32-character alphanumeric sys_id.","mandatory":true}`
- **Rationale:** Marking the input mandatory forces the platform to validate its presence before execution and causes the LLM to treat omission as a hard error rather than proceeding with a soft-failure response.

### FIX-2 — Seed priority value on the ticket record
- **Target type:** Data
- **Target:** `x_snc_tsbench_ticket[36dc13472bea031017a6ffbeee91bf75]`, field `priority`
- **Current:** `""` (blank)
- **Proposed:** Set an appropriate integer priority value (e.g., `2` for High, `3` for Moderate) reflecting the ticket's operational urgency
- **Rationale:** A blank priority removes a classification signal. Populating it gives the LLM a consistent basis for category selection, especially for tickets whose short_description alone is ambiguous.

### FIX-3 — Add `category` column to bench ticket table
- **Target type:** Data (schema)
- **Target:** Table `x_snc_tsbench_ticket` — add new column `category`
- **Current:** Column does not exist (`field_count=8`, no `category` element)
- **Proposed:** Add `category` as a String field (type `string`, max_length 40) with a choice list matching the agent's six categories: ACCESS, HARDWARE, APPLICATION, NETWORK, MESSAGING, GENERAL
- **Rationale:** Without this column the agent cannot write its classification back. Adding it and updating the tool script to call `gr.setValue('category', category_value); gr.update();` allows the result to be persisted and consumed by downstream processes.

### FIX-4 — Remove synthetic noise feed from tool script
- **Target type:** Tool schema (script)
- **Target:** `sn_aia_tool[2465188619a2417682e91483d560c084]`, field `script` — remove the `raw_context_feed` generation block
- **Current:** Script builds 260-line loop and returns `raw_context_feed` (58,462 chars in total response)
- **Proposed:** Remove the `lines` array, `for` loop, and `out.raw_context_feed = lines.join(NL);` statement. Return only the named fields the agent needs: `ok`, `error`, `short_description`, `priority` (and `category` once FIX-3 is applied)
- **Rationale:** The bloat flag confirms this payload exceeds the 20,000-char threshold and accumulates in the scratchpad on every turn. Removing it bounds response size, reduces LLM token consumption, and eliminates latency compounding.

---

## VERIFICATION

1. **FIX-1:** Re-run the agent without passing a ticket sys_id. Expect the platform to reject the invocation with a mandatory-input validation error rather than returning `{ok:false}`.
2. **FIX-2:** Run `query_table` on `x_snc_tsbench_ticket[36dc13472bea031017a6ffbeee91bf75]` and confirm `priority` is non-blank. Re-run the agent; confirm the tool response includes a numeric priority value.
3. **FIX-3:** Run `schema_lookup` on `x_snc_tsbench_ticket` and confirm `category` appears in the field list. Re-run the agent; confirm the tool writes back the category and `query_table` reads a non-blank `category` on the ticket record after the run.
4. **FIX-4:** Re-run the agent and call `agent_trace`. Confirm `tool_output_bloat` is absent from `latency_flags` and the tool response payload is under 20,000 chars.

---

## DATA MARKERS

The following record data was quoted above as evidence and should be reviewed for redaction before this report crosses the instance boundary:

- `x_snc_tsbench_ticket[36dc13472bea031017a6ffbeee91bf75]`.`short_description`: *"Loading dock scanner misreads pallet barcodes whenever the overhead door is open"*
- User profile in execution: email `admin@example.com`, name "System Administrator", sys_id `6816f79cc0a8016401c5a33be04be441` — this is an internal admin account and should be stripped from any externally shared version of this report.
References: null
