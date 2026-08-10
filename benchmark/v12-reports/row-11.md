# Fix Report — Agent "Seed 03 Category Router"
**Execution Plan:** `704ca97e2be68318f243fed2ce91bf61`

---

## FAILURE SUMMARY

Agent **Seed 03 Category Router** ran to completion without a script error, but delivered a negative result: *"no matching assignment group was found"* for the Software category. The agent's tool `lookup_routing_rule` executed successfully, queried table `x_snc_tsbench_routing` for a row where `category = 'Software'`, and reported `rules_in_table = 0`. The table is **genuinely empty** — no routing rules have ever been seeded. The agent behaved correctly given its instructions; the data it needed does not exist. The agent's own description acknowledges this: *"Benchmark seed - deliberately broken."*

Secondary observations: the agent overview counter `active_tool_count = 0` despite both binding and tool showing `active = 1` and the tool executing successfully; no trigger wiring is present (expected for interactive/conversational invocation); and the GenAI `check_config` filter for "AIA ReAct Engine" returned empty — functionally not blocking, as both LLM calls completed with status `success`.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `agent_trace` on plan `704ca97e2be68318f243fed2ce91bf61` |
| 2 | Instructions | **SWEPT** | `agent_config` instructions section |
| 3 | Tool definitions | **SWEPT** | `agent_config` tools section — script, schema, smell checks |
| 4 | Data schemas | **SWEPT** | `schema_lookup` on `x_snc_tsbench_routing` — table exists, 8 columns |
| 5 | Data | **SWEPT** | `query_table` on `x_snc_tsbench_routing` — `genuinely_empty` verdict |
| 6 | GenAI stack | **SWEPT** | `genai_log` `for_execution` (2 LLM calls, both success) + `check_config` (see RC-3) |
| 7 | Trigger / wiring | **SWEPT** | `agent_config` triggers section — no trigger links on either branch (expected for interactive invocation) |
| — | Platform logs | **UNAVAILABLE** | `syslog` restricts cross-scope callers (`caller_access = Caller Restriction`). The application's CrossScopePrivilege grant does not lift this. **Required action:** an instance administrator must relax `caller_access` on `syslog` or export logs from a permitted scope. |

---

## ROOT CAUSES

### RC-1 (PRIMARY) — Empty routing data table

| Field | Value |
|-------|-------|
| **Layer** | 5 — Data |
| **Component** | Table `x_snc_tsbench_routing`, all rows |
| **Finding** | The routing table is genuinely empty. The tool script queries this table by category; with zero rows it can never match any request. The execution plan state shows `Completed` — masking the defect from a quick status check. |
| **Evidence** | • `sn_aia_tools_execution` sys_id `a05ca1be2be68318f243fed2ce91bfb1`: response `{"ok":true,"matched":false,"category":"Software","rules_in_table":0}` |
| | • `query_table` on `x_snc_tsbench_routing`: `unfiltered_row_count=0`, `verdict=genuinely_empty` |
| | • Tool script (sn_aia_tool `3bd31a0be63d4e81856598dbd2c96788`) uses `GlideAggregate` COUNT before querying; returned 0 |
| **Confidence** | **CONFIRMED** |

---

### RC-2 (SECONDARY) — Input `category` not marked mandatory; no input validation

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` `3bd31a0be63d4e81856598dbd2c96788`, field `input_schema` — mandatory flag on input `category` |
| **Finding** | `category` is declared `mandatory=false`. If the LLM omits the argument, the GlideRecord query runs with an empty string and returns no match — indistinguishable from a genuine miss. The script also performs no input validation or normalisation. |
| **Evidence** | • `agent_config` tools section, binding `3bacb3ef18454586b86a87f11ffaae9a`: `"mandatory":false` |
| | • Tool smell `script_no_input_validation` (severity medium, confidence heuristic) flagged in `agent_config` artifact |
| **Confidence** | **CONFIRMED** (mandatory flag); **UNCONFIRMED** (whether a missing-input call has occurred — current run passed category correctly) |

---

### RC-3 (OBSERVATION) — GenAI capability definition not found by name filter

| Field | Value |
|-------|-------|
| **Layer** | 6 — GenAI stack |
| **Component** | `sys_one_extend_capability_definition`, name containing "AIA ReAct Engine" |
| **Finding** | `check_config` returned empty for the "AIA ReAct Engine" filter (matched=0). Two LLM calls did succeed against definition `AIA ReAct Engine_Amazon Bedrock`, so the capability is functionally wired. The mismatch may indicate the definition lives in a scope not readable by this application. |
| **Evidence** | • `genai_log check_config`: filter matched 0 definitions, `read_status=empty` |
| | • `genai_log for_execution`: 2 LLM calls, both `status=success`, `definition_name="AIA ReAct Engine_Amazon Bedrock"` |
| **Confidence** | **UNCONFIRMED** — a direct `query_table` on `sys_one_extend_capability_definition` filtered by `nameLIKEAIA ReAct Engine%` would confirm or clear it. Not blocking current runs. |

---

## FIXES

### FIX-1 — Seed the routing table *(addresses RC-1)*

| Field | Value |
|-------|-------|
| **Target type** | Data |
| **Target** | `x_snc_tsbench_routing` (label: Bench Routing Rule) |
| **Current** | 0 rows — table is empty |
| **Proposed** | Insert at minimum one row: `category = "Software"`, `assignment_group = <correct group name, e.g. "Software Support">`. Add one row per category the agent is expected to route. |
| **Rationale** | The tool can only return a match when a row exists. No code change is needed — the script, schema, and agent instructions are all correct. Only data is missing. |

---

### FIX-2 — Mark `category` input mandatory *(addresses RC-2, part 1)*

| Field | Value |
|-------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `3bd31a0be63d4e81856598dbd2c96788`, field `input_schema` |
| **Current** | `[{"name":"category","description":"The category to look up in the routing table.","mandatory":false}]` |
| **Proposed** | `[{"name":"category","description":"The category to look up in the routing table. Must be a plain string, e.g. \"Software\". Required — do not call this tool without a category value.","mandatory":true}]` |
| **Rationale** | Marking `mandatory=true` causes the ReAct engine to block execution and re-prompt the LLM if `category` is absent, rather than silently passing an empty string that returns a spurious no-match. Expanding the description also addresses tool smell `description_no_input_guidance`. |

---

### FIX-3 — Add defensive input validation to the tool script *(addresses RC-2, part 2)*

| Field | Value |
|-------|-------|
| **Target type** | Tool schema (script body) |
| **Target** | `sn_aia_tool` `3bd31a0be63d4e81856598dbd2c96788`, field `script` |
| **Current** | Script reads `inputs.category` without validating it |
| **Proposed** | Add a guard at the top of the IIFE: `var cat = (inputs.category \|\| '').toString().trim(); if (!cat) { return JSON.stringify({ok:false, error:'category is required'}); }` — then use `cat` in place of `inputs.category` throughout. |
| **Rationale** | Prevents a blank-string query returning `matched=false` that is indistinguishable from a legitimate miss. Satisfies tool smell `script_no_input_validation`. |

---

## VERIFICATION

**After applying FIX-1:**
1. Open a new interactive session and send: *"Please route a request in the Software category to the correct assignment group."*
2. Expect `agent_trace` on the new execution plan to show tool call response:
   `{"ok":true,"matched":true,"category":"Software","assignment_group":"<seeded group>","rules_in_table":1}`
3. Expect the agent's final message to name the assignment group rather than reporting no match.

**After applying FIX-2 and FIX-3:**
1. Send a request that omits the category (e.g., *"Route this request."*).
2. Expect the agent to ask for clarification rather than calling the tool with an empty input.

**For RC-3 (GenAI capability hygiene):**
Run `query_table` on `sys_one_extend_capability_definition` with `query=nameLIKEAIA ReAct Engine` and confirm `api`, `api_type`, and `capability` fields are non-empty on the matching row.

---

## DATA MARKERS

*The following record data was cited as evidence and should be redacted before this report crosses the instance boundary:*

- **User profile** (`sn_aia_message` `814ca97e2be68318f243fed2ce91bfa5`): user email, user sys_id, user name
- **Tool execution response** (`sn_aia_tools_execution` `a05ca1be2be68318f243fed2ce91bfb1`): category value "Software"
- **Conversation sys_id** `633ce57e2be68318f243fed2ce91bf63` and associated message sequence numbers
References: null