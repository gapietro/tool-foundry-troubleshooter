# Fix Report — Execution Plan `1c65237e2b2e0bd817a6ffbeee91bfff`

---

## FAILURE SUMMARY

The user asked agent **Seed 01 Ticket Prioritizer** to set the priority of a bench ticket to `critical`. The agent ran to completion, called the `set_ticket_priority` tool successfully (HTTP 200, `ok: true`), and presented a full audit trail to the user — yet the ticket's priority field was never actually written. The tool script calls `gr.setValue('priority', inputs.priority)` with the string `"critical"`, but the `priority` column on `x_snc_tsbench_ticket` is declared as type **Integer** with no choice map. GlideRecord silently rejects a non-numeric string written to an Integer field; `gr.update()` executes without error, and the read-back immediately returns `null`. The tool then returns `{ok: true, priority_stored: null}` — a structurally successful response that masks a failed write. The agent accepted that response as confirmation and told the user the priority had been set. A secondary issue is that no trigger wiring exists on the agent, meaning it can only be launched by direct/interactive invocation and will never fire automatically.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `agent_trace` — full task tree and tool call response read |
| 2 | Instructions | **SWEPT** | `agent_config section=instructions` — full instruction text read |
| 3 | Tool definitions | **SWEPT** | `agent_config section=tools` — tool script body and input schema read |
| 4 | Data schemas | **SWEPT** | `schema_lookup x_snc_tsbench_ticket` — all 8 columns, types confirmed |
| 5 | Data | **SWEPT** | `query_table` — ticket record exists, `priority` field read back blank |
| 6 | GenAI stack | **SWEPT** | `genai_log mode=for_execution` — 3 LLM calls, all succeeded, capability wired |
| 7 | Trigger and wiring | **SWEPT** | `agent_config section=triggers` — no trigger links on either branch |
| — | Platform logs | **UNAVAILABLE** | `syslog` table is caller-restricted; read returned `DENIED`. An instance administrator must relax `caller_access` on `syslog` or export the log externally. Script errors inside the run are covered by `agent_trace` (0 script errors found there). |

---

## ROOT CAUSES

### RC-1 — Type mismatch: string written to Integer field

| | |
|---|---|
| **Layer** | 3 — Tool definitions / 4 — Data schema |
| **Component** | `sn_aia_tool` record `set_ticket_priority` (sys_id `8953483c2762479b97bf55da8ed1c4ac`), field `script` |
| **Finding** | The script passes `inputs.priority` (a word such as `"critical"`) directly to `gr.setValue('priority', ...)`. The `priority` column on `x_snc_tsbench_ticket` is type **Integer** (`sys_dictionary`, declared on `x_snc_tsbench_ticket`). GlideRecord silently discards a non-numeric value; `gr.update()` succeeds, and the immediate re-read returns `null`. |
| **Evidence** | • Tool script body: `gr.setValue('priority', inputs.priority); gr.update();` — `sn_aia_tool.script`, sys_id `8953483c2762479b97bf55da8ed1c4ac` <br>• Schema: `x_snc_tsbench_ticket.priority` type=`Integer`, `has_choices: false` — `sys_dictionary` <br>• Tool response in trace: `{"ok":true,"priority_requested":"critical","priority_stored":null}` — `sn_aia_tools_execution` sys_id `098563be2b2e0bd817a6ffbeee91bfd1` <br>• Live data: `query_table` on `x_snc_tsbench_ticket` sys_id `5cc267be2bea0bd817a6ffbeee91bf8b` → `priority: ""` (blank after the run) |
| **Confidence** | **CONFIRMED** — tool script, schema type, tool response, and live record all corroborate |

---

### RC-2 — Tool returns `ok: true` on a failed write (silent failure)

| | |
|---|---|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool.script`, sys_id `8953483c2762479b97bf55da8ed1c4ac` |
| **Finding** | The script checks `priority_stored` in its return JSON but never compares it to `priority_requested`. It returns `ok: true` even when `priority_stored` is `null`. The agent reads `ok: true` and concludes the operation succeeded. |
| **Evidence** | Tool script return statement: `return JSON.stringify({ ok: true, ticket: inputs.ticket, priority_requested: inputs.priority, priority_stored: check.getValue('priority') });` — no guard on null stored value. Tool response: `priority_stored: null` while `ok: true` — `sn_aia_tools_execution` sys_id `098563be2b2e0bd817a6ffbeee91bfd1` |
| **Confidence** | **CONFIRMED** |

---

### RC-3 — No trigger wiring (agent cannot auto-start)

| | |
|---|---|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m` — agent `914db68f3e364222a47f9e5398b6ac8d` |
| **Finding** | Zero rows on both the agent-direct branch and the team/use-case chain. Every read behind the traversal succeeded, so the absence is real. The agent can only be invoked interactively; it will never fire on a record event or schedule. |
| **Evidence** | `agent_config section=triggers`: `branches: {agent_direct: 0, team_usecase_chain: 0}`, wiring finding `no_trigger_wiring` severity=high — `sn_aia_trigger_agent_usecase_m2m` |
| **Confidence** | **CONFIRMED** |

---

### RC-4 — Instruction bloat causing high LLM latency (performance)

| | |
|---|---|
| **Layer** | 1 — Execution trace |
| **Component** | `sn_aia_execution_task` sys_ids `a465637e2b2e0bd817a6ffbeee91bf53` (21 565 ms) and `8185a3be2b2e0bd817a6ffbeee91bf15` (26 287 ms) |
| **Finding** | Both ReAct engine steps exceeded the 15 000 ms latency threshold. Plan `llm_p95_latency = 22 037 ms`. Instructions are reprocessed on every ReAct turn, so their size multiplies with each step. |
| **Evidence** | `latency_flags` in `sn_aia_execution_plan` `1c65237e2b2e0bd817a6ffbeee91bfff`: flag=`instruction_bloat`, observed_ms 26 287 and 21 565, threshold_ms 15 000 |
| **Confidence** | **CONFIRMED** (flag is `corroborated: false` — a second run under load would add a second data point, but the threshold breach on two steps is sufficient to act) |

---

## FIXES

### FIX-1 — Map priority words to integers before writing (addresses RC-1)

| | |
|---|---|
| **Target type** | Tool schema — script |
| **Target** | `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac`, field `script` |
| **Current** | `gr.setValue('priority', inputs.priority);` — passes raw string directly |
| **Proposed** | Add a word-to-integer map at the top of the IIFE and resolve before writing:<br>js
var priorityMap = { critical: 1, high: 2, moderate: 3, low: 4, planning: 5 };
var word = (inputs.priority || '').toString().toLowerCase().trim();
var priorityInt = priorityMap[word];
if (priorityInt === undefined) {
    return JSON.stringify({ ok: false, error: 'unrecognised priority: ' + word });
}
gr.setValue('priority', priorityInt);
 |
| **Rationale** | The `priority` column is type Integer. GlideRecord silently drops non-numeric values. The map converts the LLM's word to the stored integer and rejects unrecognised input rather than silently succeeding. |

---

### FIX-2 — Return `ok: false` when the stored value does not match the requested value (addresses RC-2)

| | |
|---|---|
| **Target type** | Tool schema — script |
| **Target** | `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac`, field `script` |
| **Current** | `return JSON.stringify({ ok: true, ..., priority_stored: check.getValue('priority') });` — always returns `ok: true` |
| **Proposed** | After re-reading, compare stored to requested and fail if they differ:<br>js
var stored = check.getValue('priority');
if (String(stored) !== String(priorityInt)) {
    return JSON.stringify({ ok: false, error: 'write did not persist', priority_requested: word, priority_stored: stored });
}
return JSON.stringify({ ok: true, ticket: inputs.ticket, priority_requested: word, priority_stored: stored });
 |
| **Rationale** | The agent treats `ok: true` as success. Without this guard, a silent write failure reaches the agent as a success signal and is reported to the user as completed work. |

---

### FIX-3 — Mark both inputs as mandatory and add output guidance to the tool description (addresses tool smell `description_no_input_guidance` / `script_no_input_validation`)

| | |
|---|---|
| **Target type** | Tool schema — input schema and description |
| **Target** | `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac`, fields `input_schema` and `description` |
| **Current** | Both inputs have `mandatory: false`; description has no output contract |
| **Proposed** | Set `mandatory: true` on both `ticket` and `priority`. Append to description: `"Returns {ok, ticket, priority_requested, priority_stored}. ok is false when the ticket is not found, the priority word is unrecognised, or the write did not persist. Do not call this tool for tables other than x_snc_tsbench_ticket."` |
| **Rationale** | A mandatory flag prevents a call with a missing argument. The output contract tells the agent how to read the response correctly. The negative guidance reduces selection risk. |

---

### FIX-4 — Add trigger wiring so the agent can auto-start (addresses RC-3)

| | |
|---|---|
| **Target type** | Wiring |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` — create a row linking agent `914db68f3e364222a47f9e5398b6ac8d` to the appropriate trigger and use case |
| **Current** | 0 rows on both agent-direct and team/use-case branches |
| **Proposed** | In the agent designer, attach a trigger (e.g., a record-created/updated trigger on `x_snc_tsbench_ticket`, or the relevant use case) to this agent. Confirm the use-case `sn_aia_usecase` row exists and is active before linking. |
| **Rationale** | Without trigger wiring the agent is permanently interactive-only and will never fire automatically on ticket events. |

---

### FIX-5 — Reduce instruction size to cut ReAct latency (addresses RC-4)

| | |
|---|---|
| **Target type** | Instruction |
| **Target** | `sn_aia_agent` sys_id `914db68f3e364222a47f9e5398b6ac8d`, field `instructions` |
| **Current** | Multi-step, verbose instructions with inline reasoning templates (~2 000+ chars, reprocessed every ReAct turn) |
| **Proposed** | Condense step descriptions to single imperative sentences. Move reference data (priority rubrics, examples) to a KB article retrieved on demand. Target under 800 tokens of instruction text. |
| **Rationale** | Instructions are injected into every LLM call. The two ReAct steps ran at 21 s and 26 s against a 15 s threshold. Smaller instructions reduce per-turn token count and latency proportionally. |

---

## VERIFICATION

1. **Apply FIX-1 and FIX-2** to the tool script. Open `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac` and save the updated script.
2. **Re-run the same objective** interactively against ticket `5cc267be2bea0bd817a6ffbeee91bf8b`.
3. **Expected tool response**: `{ok: true, priority_requested: "critical", priority_stored: "1"}
References: null

Agent Doctor completed a full seven-layer diagnostic sweep of execution plan 1c65237e2b2e0bd817a6ffbeee91bfff for agent 'Seed 01 Ticket Prioritizer'. The Fix Report was delivered to the user.

Layers swept: 1 (agent_trace), 2 (agent_config/instructions), 3 (agent_config/tools), 4 (schema_lookup), 5 (query_table), 6 (genai_log), 7 (agent_config/triggers). Platform logs (syslog) UNAVAILABLE — caller_access restriction requires instance-admin action.

Four confirmed root causes:
- RC-1 (CONFIRMED): Tool script passes string 'critical' to gr.setValue() on an Integer column — GlideRecord silently drops the value; priority_stored returns null.
- RC-2 (CONFIRMED): Tool returns ok:true even when priority_stored is null, masking the failed write.
- RC-3 (CONFIRMED): Zero trigger wiring rows on both branches — agent is interactive-only.
- RC-4 (CONFIRMED): Instruction bloat — two ReAct steps exceeded the 15,000 ms threshold.

Five fixes proposed: word-to-integer map in tool script, ok:false guard on write verification, mandatory input flags and output contract in description, trigger wiring creation, and instruction size reduction.
