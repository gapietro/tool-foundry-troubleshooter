## Fix Report — Execution Plan `3f247f0b2b6a431017a6ffbeee91bf55`

---

### FAILURE SUMMARY

Agent **Seed 08 Batch Watcher** was asked to monitor batch reference `BR-2298` and report when it completed. The execution plan terminated with state **Terminated / execution_failed** after **1,116 seconds (~18.6 minutes)**. The agent made **75 calls** to `check_processing_status` across 200 execution tasks. Every single call returned the identical response: `status=in_progress`, `percent_complete=50`, `note="work continues"`. The tool script is a **hardcoded stub with no terminal branch** — it is mathematically impossible for it to ever return `"complete"` or `"failed"`. The agent correctly followed its instructions (poll until terminal status, then report), but the tool it was given could never deliver a terminal status. The platform's execution-time ceiling eventually cancelled the run. No script errors were raised; the agent behaved correctly given its broken inputs.

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution Trace | **SWEPT** | `agent_trace` — artifact `f58b77cf2b6e431017a6ffbeee91bff5` |
| 2 | Agent Instructions | **SWEPT** | `agent_config` — artifact `43ab3f032bae431017a6ffbeee91bfe1` |
| 3 | Tool Definitions | **SWEPT** | `agent_config` tools section, same artifact |
| 4 | Data Schemas | **NOT SWEPT** | The tool script never touches the database; no field read blank and no table name was in doubt. Sweeping schema would answer the wrong question. |
| 5 | Data / Record Existence | **NOT SWEPT** | The tool is a pure constant — no GlideRecord call exists to produce a wrong result. Irrelevant until FIX-1 introduces a real query. |
| 6 | GenAI Stack | **SWEPT** | `genai_log for_execution` — artifact `07ab7f032bae431017a6ffbeee91bf66` |
| 7 | Trigger and Wiring | **SWEPT** | `agent_config` triggers section |
| — | Platform Logs | **UNAVAILABLE** | `syslog` has `caller_access = Caller Restriction`. An instance administrator must relax `caller_access` on `syslog` or export logs from a permitted scope. **Not reported as clean.** |

---

### ROOT CAUSES

#### RC-1 — CONFIRMED *(Primary)*
| Field | Detail |
|-------|--------|
| **Layer** | 3 — Tool definition / script |
| **Component** | `sn_aia_tool` · field: `script` |
| **Finding** | The tool script is a hardcoded constant. It always returns `status="in_progress"`, `percent_complete=50`, regardless of the batch reference or call count. There is no terminal branch, no record lookup, no counter, and no clock. The comment inside the script explicitly states: *"No terminal branch exists. There is no clock, no counter and no record consulted — this function is a constant. Whatever the agent does, and however many times it asks, the answer is the same one."* |
| **Evidence** | `agent_config` artifact (page 2), `tools[0].tool.script.body` — stub body confirmed. All 75 `sn_aia_tools_execution` output digests in the trace show the identical payload `{"ok":true,"batch":"BR-2298","status":"in_progress","percent_complete":50,"note":"work continues"}` — trace artifact pages 0–12. |
| **Confidence** | **CONFIRMED** — tool script body and all 75 runtime outputs agree. |

#### RC-2 — CONFIRMED *(Contributing)*
| Field | Detail |
|-------|--------|
| **Layer** | 2 — Agent Instructions |
| **Component** | `sn_aia_agent` · field: `instructions` |
| **Finding** | The instruction text contains no upper-bound guard on polling iterations. It reads: *"If the status is not terminal, call check_processing_status again."* No "stop after N attempts" or "give up after T minutes" safeguard exists. Even with a fixed tool, an unbounded loop will eventually hit the platform execution ceiling rather than exit gracefully. |
| **Evidence** | `agent_config` artifact page 1, instructions section, full 417-char instruction body. |
| **Confidence** | **CONFIRMED** |

#### RC-3 — CONFIRMED *(Contributing)*
| Field | Detail |
|-------|--------|
| **Layer** | 3 — Tool definition (binding) |
| **Component** | `sn_aia_agent_tool_m2m` · field: `max_auto_executions` |
| **Finding** | The tool binding sets `max_auto_executions=10`. In practice 75 tool calls were recorded, meaning the cap is insufficient for a polling agent. 10 autonomous executions is inadequate for any batch job requiring more than ~10 polling intervals. |
| **Evidence** | `agent_config` artifact page 2, `tools[0].binding.max_auto_executions="10"`; trace artifact `evidence_basis.tool_call_rows=75`. |
| **Confidence** | **CONFIRMED** |

#### RC-4 — CONFIRMED *(Architectural gap)*
| Field | Detail |
|-------|--------|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_agent` — use-case and trigger wiring |
| **Finding** | No use case is attached to the agent (`sn_aia_usecase: empty`). No trigger links exist (`trigger_links=0`). The agent runs only in Interactive / ad-hoc mode. Without a use-case wrapper there is no applicability gate, no contextual trigger, and no approved re-entry point if the batch legitimately takes hours. |
| **Evidence** | `agent_config` artifact page 1, overview: `usecases=[]`, `teams=[]`, `trigger_links=0`; execution plan header: `usecase.sys_id=""`, `team.sys_id=""`. |
| **Confidence** | **CONFIRMED** |

---

### FIXES

#### FIX-1 — Addresses RC-1 *(Primary fix)*
| Field | Value |
|-------|-------|
| **Target type** | Tool script |
| **Target** | `sn_aia_tool` · field: `script` |
| **Current** | Hardcoded stub — always returns `in_progress/50%` regardless of input |
| **Proposed** | Replace with a real implementation that reads the actual batch job record and returns its current status. The script **must** be capable of returning `"complete"` or `"failed"`. Example structure (substitute the correct table and field names from your data model): |

javascript
var gr = new GlideRecord('<batch_table>');
gr.addQuery('reference', ref);
gr.setLimit(1);
gr.query();
if (!gr.next()) {
  return JSON.stringify({ ok: false, batch: ref,
    status: 'not_found', note: 'No record for ' + ref });
}
var s = gr.getValue('<status_field>');
return JSON.stringify({ ok: true, batch: ref, status: s,
  percent_complete: parseInt(gr.getValue('<pct_field>') || 0),
  note: gr.getValue('<note_field>') || '' });


**Rationale:** RC-1 is the direct cause of infinite polling. Replacing the stub with a real lookup is the only fix that unblocks the agent's exit path.

---

#### FIX-2 — Addresses RC-2 *(Defensive fix)*
| Field | Value |
|-------|-------|
| **Target type** | Instruction |
| **Target** | `sn_aia_agent` · field: `instructions` |
| **Current** | `"…If the status is not terminal, call check_processing_status again. Report only the final status once you have it."` *(no poll cap)* |
| **Proposed** | Append: *"If you have polled more than 25 times without a terminal status, stop polling, inform the user that the batch has not completed within the allowed check window, and provide the last known status and percent_complete."* |

**Rationale:** Even with a fixed tool, an unbounded loop will exhaust the platform execution window. An explicit ceiling gives the agent a graceful exit and a user-visible explanation rather than silent termination.

---

#### FIX-3 — Addresses RC-3
| Field | Value |
|-------|-------|
| **Target type** | Configuration |
| **Target** | `sn_aia_agent_tool_m2m` · field: `max_auto_executions` |
| **Current** | `10` |
| **Proposed** | Raise to at least `30`, or to a value consistent with the expected maximum polling cycles for the longest-running batch. Coordinate with FIX-2 so the instruction guard and binding cap are aligned (instruction cap ≤ binding cap). |

**Rationale:** A cap of 10 is too low for a polling agent. If the batch legitimately takes 20 checks to complete, the agent stalls waiting for user approval mid-run.

---

#### FIX-4 — Addresses RC-4 *(Architectural recommendation)*
| Field | Value |
|-------|-------|
| **Target type** | Wiring |
| **Target** | `sn_aia_agent` — attach a use case and trigger configuration |
| **Current** | No use case, no trigger links, Interactive-only execution |
| **Proposed** | Create an `sn_aia_usecase` record linked to this agent with an `applicability_script` that matches "batch reference" requests. Wire a trigger (`sn_aia_trigger_agent_usecase_m2m`) so the agent can be invoked automatically from the appropriate channel. Add a `context_processing_script` that pre-populates the batch reference from the triggering record. |

**Rationale:** Without a use case the agent has no guardrails on when it fires and cannot be invoked automatically when a batch job starts.

---

### VERIFICATION

After **FIX-1** is applied:
1. Create a test batch job record with a known reference (e.g. `BR-TEST-01`) that transitions `in_progress` → `complete` within a controllable time window.
2. Start a new Interactive execution of **Seed 08 Batch Watcher** with objective: *"Keep an eye on batch reference BR-TEST-01 and report when it has completed."*
3. Expect the execution plan to reach state **Completed** (not **Terminated**).
4. Confirm the final agent message contains the terminal status (`complete` or `failed`) and the batch reference.
5. Confirm `sn_aia_execution_plan.state_reason` is **not** `execution_failed`.

After **FIX-2**: Verify that if a batch never reaches a terminal state, the agent emits a user-facing timeout message and exits cleanly before the platform ceiling is reached.

After **FIX-3**: Confirm no mid-run approval prompts appear for a batch requiring more than 10 polls to complete.

---

### DATA MARKERS

The following record data was quoted above as evidence and should be **redacted before this report crosses the instance boundary**:

- Batch reference value `BR-2298` (execution objective and all tool call outputs)
- User sender sys_id from conversation message (user profile field)
- Conversation sys_id from execution plan header
- GenAI usage log sys_id from execution plan header
- All artifact sys_ids listed in the Layers Swept table
References: null
