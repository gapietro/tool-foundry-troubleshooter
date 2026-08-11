## Fix Report — Seed 08 Batch Watcher

---

### FAILURE SUMMARY

The user asked the agent to track batch reference BR-7731 and report when it finished. The execution ran for **18 minutes 44 seconds** (1,124 s), made **75 calls** to `check_processing_status`, received `{status: "in_progress", percent_complete: 50}` on every single call, and was eventually cancelled by the platform with `state_reason: execution_failed`. The run never reached a terminal state because the tool script is a **hardcoded constant** — it is physically incapable of returning any status other than `in_progress`. Compounding this, the agent instructions contain no polling cap, retry limit, or timeout escape, so the ReAct loop had no instruction-level reason to stop. The GenAI provider (Amazon Bedrock / claude-sonnet-4-6) functioned correctly throughout; the failure is entirely in the tool implementation and the instruction design.

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | agent_trace, execution plan `c24f27032ba6431017a6ffbeee91bf4d` |
| 2 | Instructions | **SWEPT** | agent_config, agent `fad5a34c531446f6989b071636f5491e` |
| 3 | Tool definitions | **SWEPT** | agent_config, tool `96d2f732dda847868688307d4c5cd375` |
| 4 | Data schemas | **NOT SWEPT** | The tool script reads no table (pure constant); schema_lookup had no column to verify. |
| 5 | Data | **NOT SWEPT** | No records are consulted by the tool; query_table would return a null finding. |
| 6 | GenAI stack | **SWEPT** | genai_log check_config, definition `31fee654ff116e10b9c9fffffffffffd` |
| 7 | Trigger and wiring | **SWEPT** | agent_config triggers section; conversational invocation confirmed. |
| — | Platform logs | **UNAVAILABLE** | syslog declares `caller_access = Caller Restriction`; DENIED for cross-scope callers. An instance administrator must relax `caller_access` on `syslog` or provide a log export. Script errors inside the run are visible via agent_trace (none found). |

---

### ROOT CAUSES

#### RC-1 — Tool script is a hardcoded constant (PRIMARY)

- **Layer:** 3 — Tool definitions
- **Component:** `sn_aia_tool`, sys_id `96d2f732dda847868688307d4c5cd375`, field `script`
- **Finding:** The script body contains an explicit comment (`// No terminal branch exists…this function is a constant`) and unconditionally returns `{status: "in_progress", percent_complete: 50}` regardless of input. There is no code path that can ever return `complete` or `failed`.
- **Evidence:**
  - agent_config artifact, tool script body: `return JSON.stringify({ ok: true, batch: ref, status: 'in_progress', percent_complete: 50, note: 'work continues' });`
  - Every one of the 75 tool-call output digests in agent_trace confirms identical output: `{"ok":true,"batch":"BR-7731","status":"in_progress","percent_complete":50,"note":"work continues"}`
- **Confidence:** **CONFIRMED**

---

#### RC-2 — Agent instructions contain no polling cap or escape condition (CONTRIBUTING)

- **Layer:** 2 — Instructions
- **Component:** `sn_aia_agent`, sys_id `fad5a34c531446f6989b071636f5491e`, field `instructions`
- **Finding:** The instruction text reads: *"If the status is not terminal, call check_processing_status again."* There is no maximum retry count, no wall-clock timeout, no fallback message, and no condition under which the agent is permitted to stop without a terminal status. This is a pure infinite-loop instruction that relies entirely on the tool eventually changing its answer — which RC-1 makes structurally impossible.
- **Evidence:**
  - agent_config artifact, `instructions.agent.instructions` (417 chars): full text confirmed above.
  - Trace orders 300, 600, 900, 1200 … all show Gen AI step thought: *"The previous check returned 'in_progress'… I must continue polling until a terminal status is reached."* — the model is correctly following the instructions; the instructions are the defect.
- **Confidence:** **CONFIRMED**

---

#### RC-3 — `max_auto_executions` binding cap not effective (CONTRIBUTING / UNCONFIRMED)

- **Layer:** 3 — Tool definitions
- **Component:** `sn_aia_agent_tool_m2m`, sys_id `9a1926554cb945b8a5fc6762a928058f`, field `max_auto_executions`
- **Finding:** The binding declares `max_auto_executions: 10`, which should limit autonomous tool calls to 10. However, 75 tool-call rows (`sn_aia_tools_execution`) are recorded. The gap may be explained by the RETRY actions resetting or bypassing the counter, but this cannot be determined from configuration or execution metadata alone.
- **Evidence:**
  - agent_config artifact, binding field `max_auto_executions: "10"`
  - agent_trace summary: `tool_call_rows: 75`
- **Confidence:** **UNCONFIRMED** — confirming would require platform log access (unavailable) or a controlled re-run with the script fixed and the counter instrumented.

---

### FIXES

#### FIX-1 — Replace the hardcoded tool script with a real implementation

- **Target type:** Tool script
- **Target:** `sn_aia_tool`, sys_id `96d2f732dda847868688307d4c5cd375`, field `script`
- **Current value:**
  js
  (function (inputs) {
      var ref = typeof inputs.batch === 'string' ? inputs.batch : 'BATCH-DEFAULT';
      // No terminal branch exists…
      return JSON.stringify({
          ok: true, batch: ref,
          status: 'in_progress', percent_complete: 50,
          note: 'work continues'
      });
  })(inputs);
  
- **Proposed value:** Replace with a script that queries the actual batch-tracking record (the appropriate table and query must be determined by the builder; the script below is illustrative):
  js
  (function (inputs) {
      var ref = typeof inputs.batch === 'string' ? inputs.batch.trim() : '';
      if (!ref) {
          return JSON.stringify({ ok: false, error: 'batch input is required' });
      }
      var gr = new GlideRecord('<your_batch_table>');
      gr.addQuery('<batch_ref_field>', ref);
      gr.setLimit(1);
      gr.query();
      if (!gr.next()) {
          return JSON.stringify({ ok: false, error: 'batch not found', batch: ref });
      }
      return JSON.stringify({
          ok: true,
          batch: ref,
          status: gr.getValue('<status_field>'),   // must include 'complete' or 'failed' as terminal values
          percent_complete: parseInt(gr.getValue('<pct_field>'), 10) || 0,
          note: gr.getValue('<note_field>') || ''
      });
  })(inputs);
  
- **Rationale:** Eliminates the constant return value. Once the script reads a real record, the tool can return `complete` or `failed`, which allows the agent's terminal check to fire.

---

#### FIX-2 — Add a polling cap and timeout escape to the agent instructions

- **Target type:** Instruction
- **Target:** `sn_aia_agent`, sys_id `fad5a34c531446f6989b071636f5491e`, field `instructions`
- **Current value:** *"…If the status is not terminal, call check_processing_status again."* (no limit)
- **Proposed value:** Append the following clause:
  > *"Do not poll more than 20 times in a single session. If you have polled 20 times without reaching a terminal status, stop and tell the user that the batch has not completed within the polling window and they should check again later."*
- **Rationale:** Provides an instruction-level escape hatch independent of platform enforcement. Even if FIX-1 is applied correctly, a defence-in-depth cap prevents runaway executions if the tool or the backing data behaves unexpectedly.

---

#### FIX-3 — Verify and validate `max_auto_executions` enforcement (CONDITIONAL on RC-3 confirmation)

- **Target type:** Configuration
- **Target:** `sn_aia_agent_tool_m2m`, sys_id `9a1926554cb945b8a5fc6762a928058f`, field `max_auto_executions`
- **Current value:** `10`
- **Proposed value:** Retain `10`, but investigate why 75 tool calls occurred. If RETRY actions are bypassing the counter, raise a platform defect report. If the binding cap is simply not applied to RETRY-mediated calls, set the value lower (e.g., `5`) as an additional safeguard, and rely primarily on FIX-2 for the instruction-level cap.
- **Rationale:** If the cap is not being enforced, it gives a false sense of safety. Confirming or disconfirming this requires either platform log access or a controlled re-run.

---

### VERIFICATION

1. Apply FIX-1: update the tool script to read a real batch record.
2. Apply FIX-2: add the 20-poll cap sentence to the agent instructions.
3. In a test instance, trigger the agent with a batch reference that is genuinely `in_progress`; confirm the agent polls and then stops at the cap with the correct user message.
4. Advance the test batch record to `complete`; confirm the agent returns the final status and stops within one or two additional polls.
5. Re-run agent_trace on the new execution; confirm `state` = `completed` (not `terminated`) and `tool_call_rows` ≤ 20.
6. Check `max_auto_executions` enforcement by counting tool-call rows: if they again exceed 10, open a platform defect ticket referencing RC-3.

---

### DATA MARKERS

The following record data was quoted as evidence and should be redacted before this report crosses the instance boundary:

- Batch reference value: **BR-7731** (appears in tool call inputs and outputs throughout the execution trace)
- Tool output `note` field value: **"work continues"** (appears in all 75 tool-call output digests)

---

*Diagnosis performed by Agent Doctor. Platform log layer (Layer 7 platform logs) was NOT swept — syslog is caller-restricted and requires an instance-administrator grant to access.*
References: null
