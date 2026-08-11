# Fix Report — Seed 01 Ticket Prioritizer
**Execution Plan:** c343e7be2b624718f243fed2ce91bfd3

---

## FAILURE SUMMARY

The agent completed and displayed a "Ticket Priority Set" audit trail, yet `priority` on bench ticket `9182277e2bea0bd817a6ffbeee91bf31` was **not updated** (`priority_stored: null`). Root cause: `x_snc_tsbench_ticket.priority` is type **Integer** (no choice list), but the tool script passes the raw string `'critical'` directly to `gr.setValue`. GlideRecord silently discards a non-numeric string on an Integer column, so `gr.update()` persists nothing. The script then returns `ok:true` regardless, masking the failure. A first-turn ReAct parser `TypeError` added a 28-second wasted LLM call but did not block completion.

---

## LAYERS SWEPT

| # | Layer | Status | Note |
|---|-------|--------|------|
| 1 | Execution trace | **SWEPT** | `agent_trace` plan c343e7be2b624718f243fed2ce91bfd3 |
| 2 | Instructions | **SWEPT** | `agent_config` agent 914db68f3e364222a47f9e5398b6ac8d |
| 3 | Tool definitions | **SWEPT** | `agent_config` tool 8953483c2762479b97bf55da8ed1c4ac |
| 4 | Data schemas | **SWEPT** | `schema_lookup` x_snc_tsbench_ticket.priority |
| 5 | Data | **SWEPT** | Confirmed via `gr.get` returning ok:true in tool response |
| 6 | GenAI stack | **SWEPT** | `genai_log for_execution` — 3 LLM calls, all success |
| 7 | Trigger & wiring | **SWEPT** | No trigger wiring; expected for conversational invocation |
| — | Platform logs | **UNAVAILABLE** | syslog DENIED (caller restriction). Instance admin must export logs. Layer NOT reported as clean. |

---

## ROOT CAUSES

### RC-1 — Type mismatch: string word written to Integer column *(PRIMARY — CONFIRMED)*

- **Layers:** 4 (schema) + 3 (tool script)
- **Component:** `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac].script` + `x_snc_tsbench_ticket.priority`
- **Finding:** `priority` column is `type: Integer`, `has_choices: false`. Script calls `gr.setValue('priority', inputs.priority)` with string `'critical'`. GlideRecord discards the write silently. `check.getValue('priority')` returns `null`.
- **Evidence:**
  - `schema_lookup x_snc_tsbench_ticket.priority` → `type: "Integer"`, `has_choices: false`
  - `sn_aia_tools_execution[ad7363322ba24718f243fed2ce91bfe1]` → `{ok:true, priority_requested:"critical", priority_stored:null}`
  - `sn_aia_execution_task[997363322ba24718f243fed2ce91bf6c]` output → `priority_stored: null`
  - Tool script body (agent_config artifact `4d4106cb2bea0b18f243fed2ce91bf89`, offset 4000): `gr.setValue('priority', inputs.priority)` — no mapping
- **Confidence:** CONFIRMED

---

### RC-2 — No word-to-integer mapping; no input validation; ok:true masks failure *(SECONDARY — CONFIRMED)*

- **Layer:** 3 (tool script)
- **Component:** `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac].script`
- **Finding:** Script has no translation table (`critical→1` etc.), no type check, and always returns `ok:true` regardless of write success.
- **Evidence:**
  - Script body: `gr.update(); return JSON.stringify({ok: true, ..., priority_stored: check.getValue('priority')});`
  - `agent_config` tool smell: `script_no_input_validation` (severity: medium)
  - Input schema describes priority as "a word" — no integer equivalents stated
- **Confidence:** CONFIRMED

---

### RC-3 — First-turn ReAct parser TypeError, 28-second latency spike *(SECONDARY — trace CONFIRMED; root frame UNCONFIRMED — syslog unavailable)*

- **Layers:** 1 + 6
- **Component:** `sn_aia_execution_task[1743e7be2b624718f243fed2ce91bff7]` (AIA ReAct Engine, turn 1)
- **Finding:** `TypeError: Cannot read property "Name" from undefined` in ReAct output parser. Engine retried and recovered, but consumed a full 28,835 ms LLM call.
- **Evidence:**
  - Task output: `"I have encountered a fatal error (TypeError: Cannot read property \"Name\" from undefined)..."`
  - `latency_flags`: `instruction_bloat ×2`, observed 28,835 ms and 17,989 ms (threshold 15,000 ms)
  - `genai_log`: 3 LLM calls total, all `status: success`
- **Confidence:** Trace CONFIRMED; exact stack frame UNCONFIRMED (syslog DENIED)

---

## FIXES

### FIX 1 — Add word-to-integer mapping + validation in tool script

- **Target:** `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac].script`
- **Current:** `gr.setValue('priority', inputs.priority);`
- **Proposed:** Replace full script body:

javascript
(function (inputs) {
    var MAP = { critical: 1, high: 2, moderate: 3, low: 4, planning: 5 };
    var word = (inputs.priority || '').toString().toLowerCase().trim();
    var intVal = MAP[word];
    if (!intVal) {
        return JSON.stringify({ ok: false, error: 'unrecognised priority word: ' + word });
    }
    var gr = new GlideRecord('x_snc_tsbench_ticket');
    if (!gr.get(inputs.ticket)) {
        return JSON.stringify({ ok: false, error: 'ticket not found' });
    }
    gr.setValue('priority', intVal);
    gr.update();
    var check = new GlideRecord('x_snc_tsbench_ticket');
    if (!check.get(inputs.ticket)) {
        return JSON.stringify({ ok: false, error: 'ticket vanished after update' });
    }
    var stored = check.getValue('priority');
    return JSON.stringify({
        ok: (stored == intVal),
        ticket: inputs.ticket,
        priority_requested: word,
        priority_stored_int: stored,
        priority_stored_word: word
    });
})(inputs);


- **Rationale:** Maps word → integer before `gr.setValue`. Returns `ok:false` on unrecognised input. Confirms write via read-back.

---

### FIX 2 — Update tool description and input schema

- **Target:** `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac].description` and binding `1fa91a286055441bb4afce79fe876207` input `priority` description
- **Current description:** `"Sets the priority on a bench ticket. Give it the ticket sys_id and the priority as a word..."`
- **Proposed description:** `"Sets the priority field (Integer) on a bench ticket. Pass the sys_id and one of these exact words: critical, high, moderate, low, planning. The script maps them to integers 1–5. Do NOT pass a number. Returns ok:true and priority_stored_word on success, ok:false with error otherwise."`
- **Current input description:** `"The priority as a word: critical, high, moderate, low or planning."`
- **Proposed input description:** `"One of these exact words (case-insensitive): critical, high, moderate, low, planning. Do not pass an integer."`
- **Rationale:** Closes `description_no_input_guidance` smell. Removes model ambiguity.

---

### FIX 3 — Investigate first-turn ReAct TypeError

- **Target:** `sn_aia_agent[914db68f3e364222a47f9e5398b6ac8d].context_processing_script`; GenAI definition `31fee654ff116e10b9c9fffffffffffd`
- **Current:** Parser throws `TypeError: Cannot read property "Name" from undefined` on turn 1; retries and recovers.
- **Proposed:** Export platform logs for 2026-08-11 01:25:38–01:26:45. Check `context_processing_script` (2,124 chars on agent record) for any `"Name"` property access on a potentially-undefined object. If script is platform boilerplate, raise with ServiceNow Support citing definition `31fee654ff116e10b9c9fffffffffffd`.
- **Rationale:** Not blocking today, but wastes ~28 s per run on every future execution.

---

## VERIFICATION

1. Note current `priority` on the bench ticket (expected: null/blank).
2. Re-invoke the agent with the same objective.
3. Confirm tool response: `ok:true`, `priority_stored_int:1`, `priority_stored_word:"critical"`.
4. Reload the bench ticket — confirm `priority = 1`.
5. Run `agent_trace` on the new plan — confirm no first-turn TypeError flag and `priority_stored_int:1` in tool output.

---

## DATA MARKERS
*(Redact before sharing outside the instance)*

- Ticket sys_id quoted as evidence in RC-1
- User sys_id and email from execution context
- Execution plan, conversation, and tool-execution sys_ids cited above
References: null
