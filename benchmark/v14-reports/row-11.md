## Fix Report — Execution Plan `ff6d1fcb2b6e4310f243fed2ce91bf26`

---

### FAILURE SUMMARY

The user asked for a count of hardware-category bench tickets. The agent ran to completion and returned **"0 bench tickets."** The zero is not a model error or a tool execution failure — it is a silent data defect compounded by a schema defect. The tool `count_by_category` queries `x_snc_tsbench_ticket` with `addQuery('category', category)`, but the column `category` does not exist on that table. ServiceNow silently ignores a filter on a non-existent column, degrading the query to a full-table scan. That scan returned zero rows because the table `x_snc_tsbench_ticket` is also genuinely empty (0 rows, confirmed by unfiltered count). The agent correctly surfaced the zero the tool returned; neither the LLM nor the agent orchestration logic is at fault. The agent description itself states: *"Benchmark seed — deliberately broken."*

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `agent_trace` on plan `ff6d1fcb2b6e4310f243fed2ce91bf26` |
| 2 | Instructions | **SWEPT** | `agent_config` — instruction body 194 chars |
| 3 | Tool definitions | **SWEPT** | `agent_config` — both tool scripts fully read |
| 4 | Data schemas | **SWEPT** | `schema_lookup` on `x_snc_tsbench_ticket` — 8 fields, no `category` column |
| 5 | Data | **SWEPT** | `query_table` — table genuinely empty; `category` field warning confirmed |
| 6 | GenAI stack | **SWEPT** | `genai_log` for_execution — 2 successful LLM calls, no errors |
| 7 | Trigger and wiring | **SWEPT** | `agent_config` triggers — no trigger rows; conversational invocation is expected, not a defect |
| — | Platform logs | **UNAVAILABLE** | `log_analysis` returned `syslog: DENIED`. Caller restriction on `syslog` cannot be lifted by this application. An instance administrator must relax `caller_access` on `syslog` or provide a log export. Layer **NOT swept**. |

---

### ROOT CAUSES

#### RC-1 — Missing `category` column on `x_snc_tsbench_ticket` *(Primary)*

| | |
|---|---|
| **Layer** | 4 — Data schemas |
| **Component** | `sn_aia_tool` `d7728c6477db44a29c2ad0fed0df7419` (`count_by_category`), script body; table `x_snc_tsbench_ticket` |
| **Finding** | The tool script calls `gr.addQuery('category', category)` but `category` is not a declared column on `x_snc_tsbench_ticket`. `schema_lookup` found 8 columns; `query_table` returned a `field_warnings` entry explicitly listing `category` as missing. ServiceNow silently degrades a filter on a non-existent column to a no-op, so the query always performs a full-table scan regardless of the input value. |
| **Evidence** | `query_table` on `x_snc_tsbench_ticket`: `field_warnings: ["category"]`, `verdict: genuinely_empty`; `schema_lookup` artifact `11686b072be2431017a6ffbeee91bfb5`: `field_count: 8`, no `category` entry; `agent_config` artifact `bc38eb832be2431017a6ffbeee91bf20` offset 4000: script body `gr.addQuery('category', category)` |
| **Confidence** | **CONFIRMED** — field warning from `query_table` and `schema_lookup` both corroborate |

---

#### RC-2 — `x_snc_tsbench_ticket` table is genuinely empty *(Primary)*

| | |
|---|---|
| **Layer** | 5 — Data |
| **Component** | Table `x_snc_tsbench_ticket` |
| **Finding** | The table has 0 rows. Confirmed by `query_table` unfiltered count (`genuinely_empty`). Even after RC-1 is fixed, a correct query would still return 0 until records are seeded. |
| **Evidence** | `query_table` response: `unfiltered_row_count: 0`, `verdict: "genuinely_empty"`, `read_status: empty`; tool call response digest in `sn_aia_tools_execution` `ad7d530f2b6e4310f243fed2ce91bf45`: `{"ok":true,"category":"hardware","count":0,"tickets":[]}` |
| **Confidence** | **CONFIRMED** |

---

#### RC-3 — Tool instructions are extremely thin (194 chars) *(Quality gap)*

| | |
|---|---|
| **Layer** | 2 — Instructions |
| **Component** | `sn_aia_agent` `3e8b1e1f2b1c45c8b437c09ecb6c185a`, `instructions` field |
| **Finding** | The agent instruction body is only 194 characters with no directives on how to interpret a zero-count result or how to distinguish "no data" from a query error. The model handled the zero correctly in this run, but there is no guardrail for edge cases. |
| **Evidence** | `agent_config` overview: `instruction_chars: 194` |
| **Confidence** | **CONFIRMED** as a quality gap; causal link to the reported failure is **UNCONFIRMED** (the model behaved correctly on this run) |

---

#### RC-4 — Tool script queries without `setLimit` *(Quality gap)*

| | |
|---|---|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` `d7728c6477db44a29c2ad0fed0df7419` (`count_by_category`), `script` field |
| **Finding** | The script iterates all matching rows into an in-memory array without `setLimit`. On a populated table this would inflate the ReAct scratchpad and increase per-turn token cost. |
| **Evidence** | `agent_config` artifact `bc38eb832be2431017a6ffbeee91bf20` offset 4000, script body; `tool_smells` entry `script_unbounded_query` severity=medium |
| **Confidence** | **CONFIRMED** as a code smell; not causal to the current failure given the empty table |

---

### FIXES

#### Fix 1 — Add `category` column to `x_snc_tsbench_ticket`

| | |
|---|---|
| **Target type** | Data / schema |
| **Target** | Table `x_snc_tsbench_ticket` — add column |
| **Current** | No `category` column exists (8 columns declared, none named `category`) |
| **Proposed** | Add a String column named `category` to `x_snc_tsbench_ticket` in Studio or Table Builder, scope `x_snc_tsbench`. Suggested max length: 100. |
| **Rationale** | The tool script filters on `category`. Without the column the filter is silently dropped; any populated table would return all rows regardless of category value. |

---

#### Fix 2 — Seed `x_snc_tsbench_ticket` with test data

| | |
|---|---|
| **Target type** | Data |
| **Target** | Table `x_snc_tsbench_ticket` |
| **Current** | 0 rows (genuinely_empty, confirmed by unfiltered count) |
| **Proposed** | Insert bench ticket records with `category = 'hardware'` (and other categories for completeness). At minimum, insert enough rows to produce a non-zero count for a hardware query. |
| **Rationale** | Even after Fix 1, a correct filter against an empty table returns 0. The agent will continue to report zero until data exists. |

---

#### Fix 3 — Expand `count_by_category` tool description

| | |
|---|---|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `d7728c6477db44a29c2ad0fed0df7419`, `description` field |
| **Current** | `"Counts bench tickets in one category. Give it the category name, for example hardware or network."` |
| **Proposed** | Expand to cover: **(a)** Purpose — counts records by exact `category` value; **(b)** Input — `category` must be a string matching the exact stored value, case-sensitive; **(c)** Output shape — `{ok: true, category, count, tickets[]}` on success, `{ok: false, error}` on bad input; **(d)** Empty result — `count: 0` means no matching records, not an error; **(e)** Negative guidance — not for reading individual ticket details (use `read_bench_ticket`). |
| **Rationale** | The model constructs tool calls and interprets results from the description. A thin description leaves format and interpretation undefined. |

---

#### Fix 4 — Add `setLimit` to `count_by_category` script

| | |
|---|---|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `d7728c6477db44a29c2ad0fed0df7419`, `script` field |
| **Current** | `while (gr.next()) { matched.push(...) }` — unbounded |
| **Proposed** | Add `gr.setLimit(500)` before `gr.query()`. If the use case is counting only, consider returning just `count` and a truncation flag rather than the full `tickets` array. |
| **Rationale** | An unbounded scan on a large table inflates the ReAct scratchpad on every subsequent turn, increasing token cost nonlinearly. |

---

#### Fix 5 — Expand agent instructions

| | |
|---|---|
| **Target type** | Instruction |
| **Target** | `sn_aia_agent` `3e8b1e1f2b1c45c8b437c09ecb6c185a`, `instructions` field |
| **Current** | 194 characters |
| **Proposed** | Add directives covering: how to interpret a zero-count result (distinguish "no matching records" from a tool error), what category values are valid, and how to handle an unrecognised category gracefully (e.g., ask the user to confirm the category name). |
| **Rationale** | Without guidance, a zero is ambiguous. A model with no instruction to caveat it will present the bare zero, which is indistinguishable from a data error to the end user. |

---

### VERIFICATION

1. **After Fix 1 (schema) only:** Run `query_table` on `x_snc_tsbench_ticket` requesting the `category` field. The `field_warnings` entry for `category` must be absent.
2. **After Fix 2 (data) only:** Run `query_table {"table":"x_snc_tsbench_ticket", "query":"category=hardware"}`. Rows should be returned; confirms data is present.
3. **After both Fix 1 and Fix 2:** Re-run the conversation *"Give me a count of hardware category bench tickets for this week's report."* The `count_by_category` tool response in `agent_trace` should show `count > 0` and a non-empty `tickets` array matching the seeded records.
4. **After all fixes:** Run `agent_trace` on the new execution and confirm the tool output digest shows the expected non-zero count with no field warnings.

---

### DATA MARKERS

The following record data was cited as evidence above and **should be redacted before this report leaves the instance**:

- **User profile** in execution message stream (`sn_aia_message` `b36d1fcb2b6e4310f243fed2ce91bf2c`): email, sys_id, and name of the initiating user.
- **Tool response digest** in `sn_aia_tools_execution` `ad7d530f2b6e4310f243fed2ce91bf45`: `{"ok":true,"category":"hardware","count":0,"tickets":[]}`.
- **Agent description** on `sn_aia_agent` `3e8b1e1f2b1c45c8b437c09ecb6c185a`: *"Benchmark seed — deliberately broken."*
References: null
