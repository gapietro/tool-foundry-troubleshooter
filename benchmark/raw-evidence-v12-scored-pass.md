# v12 — the scored pass (`2026.08.1001`, #151)

Run 2026-08-10 on gpinst01 (Zurich Patch 10 Hotfix 3), app version **`2026.08.1001`**.
Pre-registered in `DECISION.md` §AC at commit `a342311`, **before any run fired**. This file is
the measurement record; the scored outcomes of predictions AC-1…AC-9 belong in `DECISION.md` §AD,
not here.

**Shape:** 5 seeds × 2 reps × 2 arms = 20 runs, 10 valid rows per arm (§AC2).

---

## 1. Pre-flight (§AC7) — all nine items, verified by probe before run 1

| # | Item | Method | Result |
|---|---|---|---|
| 1 | `sys_app.version` = `2026.08.1001` | `servicenow_query sys_app^scope=x_snc_troubleshoot` | **INITIALLY FAILED — read `2026.08.0901`.** See §1.1. Remediated by build + install; re-read **`2026.08.1001`** |
| 2 | #148's fix present in installed `PaFixReport` | `scriptLIKE` on the fixed wording, not the version | **PASS** — `_isRootCausesAbsent` present; wording `rather than omitting it` present |
| 3 | `MAX_EVIDENCE_RETURNS: 0` | `PaAgentLoop^scriptLIKEMAX_EVIDENCE_RETURNS: 0` | **PASS** — 1 record |
| 4 | `REQUIRE_RETRIEVAL_TO_RELEASE: false` | `PaAgentLoop^scriptLIKEREQUIRE_RETRIEVAL_TO_RELEASE: false` | **PASS** — 1 record |
| 5 | All five seeds' §A3 fixture conditions, live | see §1.2 | **PASS** — all five in seeded state |
| 6 | Three seed-05 probe rows deleted | DELETE ×3, then re-query | **INITIALLY FAILED — all three present.** Deleted; re-query returns exactly the **7** pre-existing rows |
| 7 | `layers_available` by two independent paths | `sn_aia_agent_tool_m2m` (native) + `GET /troubleshooter/tools` (PaToolRegistry) | **PASS** — **7/7** on both, and the two agree |
| 8 | Budget knobs read fresh | `sys_properties` + m2m column | **PASS** — `sn_aia.continuous_tool_execution_limit` = **25**; `max_auto_executions` = **10** on all 7 |
| 9 | Smoke gate on **both** arms | execution `c9d63a932bda8b9417a6ffbeee91bfd0` | **PASS** on both — see §1.3 |

### 1.1 Item 1 — the pre-registered build had never been installed

`sys_app.version` read **`2026.08.0901`**: the #148 merge (`7ad202b`). The pre-registered build
`2026.08.1001` additionally carries **#137's lone-surrogate clip guard** (`e40c0d2`), which touched
six server files — `PaArtifactStore`, `PaAuditLogger`, `PaRunManager`, `PaToolReadKit`,
`PaToolAgentConfig`, `PaToolAgentTrace`. `git diff e40c0d2..HEAD -- src/` is **empty**, so HEAD's
`src/` is exactly #137's; the two version bumps since were docs-only.

**This vindicates a clause that reads as redundant.** §AC insisted #148's fix be *"verified by probe,
not by the version string"* — and the #148 probe **passes on the stale build** (item 2 above was green
*before* the reinstall). Probing for #148 alone would have waved the pass through on a build one
substantive fix behind. The version check caught drift the probe could not see. It is material rather
than pedantic: `PaAuditLogger` is the measurement source for the §E1–E2 audit-derived sweep breadth
that **AC-6** predicts on.

**Remediation, recorded as a deviation from "no change during the pass" rather than smoothed over:**
`npm test` (1432 passed, 29 suites) → `now-sdk build` (clean, SDK 4.9.2) → `now-sdk install --alias
gpinst01`. Rollback context `670e8dbe2b2a47d817a6ffbeee91bf61`. Post-install re-probe: version
`2026.08.1001`; `PaToolReadKit` contains `clipTailUtf16` (#137's distinctive addition); items 2, 3
and 4 all still read 1 record each; the seed-05 m2m gate **survived the reinstall** (`active=true`).

The install happened **before run 1** and before any packet existed, which is the only window §AC
leaves open for it.

### 1.2 Item 5 — the five seeds, read live

| seed | condition checked | value |
|---|---|---|
| 01 | fresh bench tickets present, `priority` empty at insert | 4 candidate rows, `priority` empty |
| 02 | exactly one bound tool, no routing vocabulary in the tool description | **1** tool, `measure_request`; `test/seed02Construction.test.js` green |
| 03 | `x_snc_tsbench_routing` empty — the emptiness IS the defect | **0 rows**, left untouched |
| 04 | capability sys_id in installed `sn_aia_tool.script` matches instance record | `92ff62af516741769c437feb88c80ef3` present in **both** — matches, **NOT void** |
| 05 | m2m gate on, trigger config off | m2m `ba30d8775b0c4cebb960c58830590d5d` = **`true`**; trigger `bfb77d6c64884500a80203ee029436ee` = **Inactive** (`active=false`, the seeded defect), condition `short_descriptionISNOTEMPTY` |

Seed 05's use case is `af15173b98ce46c3a5f35a9f7160e888`; its agent `a4b7ef5d793346ea861730c6d28b8f58`.

**Note on reading `sn_aia_trigger_configuration`:** the table is not queryable through
`servicenow_query` or the Table API on this instance (`Access denied: Insufficient rights`, with and
without a `fields` filter). Read instead through `servicenow_aia_trigger_get`, which resolves it via
the use case. Recorded because the denial is a tooling boundary, not a fixture problem, and the
next operator will otherwise mistake it for one.

### 1.3 Item 9 — the smoke gate, both arms

Target `c9d63a932bda8b9417a6ffbeee91bfd0`. Expected: `script_error` citing
`context_processing_script` **line 42** (README's smoke gate — chosen because it is invisible from
the plan header).

| arm | run | terminal | verdict |
|---|---|---|---|
| native | execution `06de0d762b2e4318f243fed2ce91bf3d`, conversation `38de49762b2e4318f243fed2ce91bfb9` | completed, **197s**, 12 tool calls, 21 tasks | **PASS** — RC-1 = "context_processing_script InternalError at **line 42**", `failure_signature = script_error`, confidence high |
| custom | run `a3bf8d3e2b2e4318f243fed2ce91bf3b` (`TR1000241`) | complete, 8 transcript entries | **PASS** — root cause names `sn_aia_agent.601672d32b1a83d0f243fed2ce91bf3e.context_processing_script`, "InternalError at **line 42**" |

**One measurement worth carrying forward from the smoke gate**, because it is the §AB shape firing
again on the fixed build: the custom run drafted a `fix_report` at seq 3, was held
(`HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 2, 3, 4, 5, 6, 7
declared NOT_SWEPT with no tool call behind them`), answered the hold with `schema_lookup` on
**`sn_aia_agent_tool_m2m`** — a *platform* table, not the table the defect lives in — and was then
validated. Its final report marks layer 4 `SWEPT` with the reason *"schema_lookup confirmed
sn_aia_agent_tool_m2m table exists"*. That is §T5/§AB's gate-counts-a-call-not-a-reach behaviour,
unchanged by #137 and #148. It is **not** a scored row and carries no rubric weight.

**A tooling note that cost time and will cost the next operator time:** `servicenow_aia_logs` served
`State: In progress` for this execution for **minutes after it completed**. `servicenow_aia_trace`
reported `State: Completed` with a duration. Read terminal state from `aia_trace` (or the plan row),
never from `aia_logs`.

---

## 2. The ten seeded target executions

*(populated as the pass runs — one row per seed/rep, both arms diagnose the same seeded execution)*

| seed | rep | execution plan sys_id | trigger | plan state |
|---|---|---|---|---|
| 01 | 1 | `a860d5322b6e4318f243fed2ce91bf93` | fresh ticket `3b4051322b6e4318f243fed2ce91bf73` ("Core banking API returns 503 for every teller terminal nationwide, no workaround"), `priority` empty at insert | completed, 67s, 1 tool call (`set_ticket_priority` **OK**, 286ms) — and `priority` still **empty** afterwards: the seeded defect, invisible from both the plan header and the tool's own status |

**Fresh bench ticket per rep** for seeds 01 and 04, so rep 1's agent writes cannot contaminate rep 2
(v9 §2's rule). Seed 03 needs no ticket — its Setup says to add none.

> **Note on `waitForCompletion`.** `servicenow_aia_execute` with `waitForCompletion=false` returns a
> Session ID but **no** execution-plan sys_id, so the plan must be recovered by querying
> `sn_aia_execution_plan` on a recent-creation window. With `waitForCompletion=true` the call blocks
> 120s and then backgrounds anyway (native runs exceed that). Recorded because it shapes the protocol:
> every native row here is fired async and its plan resolved by query.

---

## 3. The twenty rows — measurements

*(populated as the pass runs)*

### 3.0 A read-staleness trap that nearly cost a false void — read this before running any row

**The operator declared row 01 void, and was wrong.** The row had completed **4m24s** after it was
fired; `servicenow_query` kept returning `state: in_progress` for it for **more than thirty minutes
after** the run finished. The void was written into this file, with reasoning, before the error was
caught. It is corrected in §3.1 and the mistake is left on the record rather than deleted, because
the failure mode is reusable and the next operator will meet it.

**What is stale and what is not:**

| read | behaviour observed |
|---|---|
| `servicenow_query` on `sn_aia_execution_plan.state` | **stale for 30+ min** — returned `in_progress` for a plan that had reached `completed` |
| `servicenow_query` on `sn_aia_message` (row count) | **stale** — returned 3 rows for a plan that had 4+, missing the Fix Report itself |
| `servicenow_aia_logs` | **stale by minutes** (already noted at §1.3) |
| `servicenow_aia_trace` | **stale** — task/message timestamps clustered minutes behind actual progress |
| **`sys_updated_on` on the record** | **fresh and authoritative** — read `2026-08-10 14:49:48`, the true completion moment |
| **`sn_aia_tools_execution` row count** | **fresh** — 15 rows, matching the completed run |

**The rule this pass adopts, and any later pass should keep: never conclude a run has stalled from a
`state` read. Terminal state is established by `sys_updated_on` advancing and by a terminal message
existing, cross-checked against the tool-call row count.** A `state` value alone cannot distinguish
"still running" from "finished half an hour ago".

**Why this is not a footnote.** §A3 voids are load-bearing: §AC6 caps re-runs at 3 per arm and a
fourth void closes an arm below §A3.4's floor at *gate not evaluable*. A stale read that manufactures
phantom voids can therefore terminate a pre-registered pass without a single real failure — and
§T9 forbids re-running the pass to recover. **A false void is more expensive than a slow poll.**

**Two consequences for this pass's record, both recorded rather than smoothed:**

1. **An extra non-scored native run was fired** against the smoke-gate target
   (`5e58d9fe2b2e47d817a6ffbeee91bf79`, fired 15:18:34) as a health probe, on the false belief that
   native was degraded. It is **not** a scored row and its result is not used. §O5's precedent —
   record the operator error, do not quietly correct it.
2. **An extra non-scored custom run** was fired for the same reason (`ce8855322b228318f243fed2ce91bfed`,
   `TR1000244`) and **completed normally**, which is what first exposed the staleness: a "degraded
   instance" that still served a custom diagnosis end-to-end was not degraded.

**Native was never degraded.** Row 01 completed in 4m24s; the smoke gate completed in 197s 10 minutes
earlier. Both are within the v9 range (2m47s–5m38s).

**But genuine hangs DO occur, and the fresh signal separates them from stale reads.** The health-probe
run fired at 15:18:34 still read `sys_updated_on = 2026-08-10 15:18:35` — its creation moment,
**unadvanced after 20+ minutes** — with 5 tool calls and no terminal message. Compare row 01, whose
`sys_updated_on` moved to 14:49:48 on completion. So on this instance, on this day, a native run
either finishes inside ~4½ minutes or hangs indefinitely; there is no observed middle.

**The void threshold this pass adopts, stated before it is applied to any scored row:**

> A native row is declared **void under §A3** when **`sys_updated_on` has not advanced for 12
> consecutive minutes AND no terminal Fix Report message exists.** 12 minutes is ~2× the slowest
> native run on record (v9's 5m38s) and ~2.7× this pass's own row 01.

Fixing the number in advance matters for the same reason §AC2 fixed the 8-valid-row floor in advance:
a patience threshold chosen *after* seeing which arm is hanging is a degree of freedom, not a
criterion. **The threshold is symmetric across arms** — it is a property of the instance, not of
either harness — and it is applied identically to native and custom rows.

### 3.1 Row 01 — native, seed 01 rep 1 — **VALID**

| field | value |
|---|---|
| arm / seed / rep | native / 01 / 1 |
| target execution | `a860d5322b6e4318f243fed2ce91bf93` |
| diagnostic execution | `24c05d362baa47d817a6ffbeee91bfcd` |
| conversation | `17b059362baa47d817a6ffbeee91bfb8` (distinct — verified, §AC7) |
| terminal | **completed**, fired 14:45:24 → `sys_updated_on` 14:49:48 = **4m24s** |
| tool calls (audit-derived, §E1) | **15** — `sn_aia_tools_execution` where `execution_plan_id=<plan>` |
| distinct tools | **7** — `agent_trace`, `read_artifact`(×9), `agent_config`, `genai_log`, `log_analysis`, `schema_lookup`, `query_table` |
| `layers_swept` (mechanical §E2) | **7/7** |
| `layers_available` | 7/7 |
| Fix Report | spans **two** `sn_aia_message` rows — `7791913e2baa47d817a6ffbeee91bfa6` (14:49:10) + `20c1917e2baa47d817a6ffbeee91bf3e` (14:49:46, *"Continuing the Fix Report from FIX-1 above"*) |

**Diagnosis, in brief (full text goes in the packet, not here):** RC-1 names the seed's defect exactly
— `x_snc_tsbench_ticket.priority` is **Integer**, the tool script writes the string `"critical"` via
`gr.setValue`, GlideRecord discards it silently, `gr.update()` throws nothing, and the read-back
returns `priority_stored: null` while the tool still reports `ok: true`. Cited across four sources
(trace tool-call response, `schema_lookup` type, `query_table` post-run blank, and the tool script
body). Plus RC-2 (both inputs `mandatory: false`), RC-3 (instruction bloat, 954 chars, two ReAct
steps over the 15,000 ms flag), RC-4 (a recovered `Invalid next entry for scratchpad` parser error).
All seven layers marked SWEPT; platform logs **UNAVAILABLE** (`syslog` caller-restricted — the
known Rule-#42-adjacent gap, correctly reported as a gap rather than as a clean log layer).

> **Report-shape note for packet building:** a native Fix Report can be split across **multiple
> `sn_aia_message` rows**. The packet must carry the concatenation, in `message_sequence` order. Taking
> only the newest agent message yields the tail (`FIX-2` onward) and silently drops the failure
> summary, every root cause and FIX-1.

<!-- superseded void record, retained deliberately — see §3.0 -->
<details>
<summary>The retracted void record for row 01, as originally written (kept for audit)</summary>

**Status: void under §A3 — the run produced no terminal Fix Report.** Recorded here rather than
re-run silently, because §AC6 caps re-runs at 3 per arm and the void budget is not the operator's to
spend without stating what was spent.

| field | value |
|---|---|
| arm / seed / rep | native / 01 / 1 |
| target execution | `a860d5322b6e4318f243fed2ce91bf93` (valid, completed, seeded defect intact) |
| diagnostic execution | `24c05d362baa47d817a6ffbeee91bfcd` |
| conversation | `17b059362baa47d817a6ffbeee91bfb8` |
| fired | 14:45:24 |
| last observable progress | **14:47:25** — last agent message, last execution task |
| state at abandonment | `in_progress`, ~16 min elapsed, **22 tasks `success` + 2 `ongoing`**, unchanged across ~8 min of polling |
| tool calls completed | **15** — `agent_trace`, `read_artifact` ×9, `agent_config`, `genai_log`, `log_analysis`, `schema_lookup`, `query_table` |
| distinct tools | **7/7** — a full mechanical sweep of all seven layers |
| terminal Fix Report | **none.** `sn_aia_message` for this plan holds 3 rows (`user_profile`, `user`, one `agent`); no report message was ever written |

**What this row is NOT evidence of.** It swept all seven layers and hung on the ReAct engine step
*after* `query_table` returned — so it is a **terminal-generation** stall, not a tool failure, not a
budget-ceiling stop (15 calls against a `continuous_tool_execution_limit` of 25), and not a depth
failure. Scoring it either way would corrupt the gate; §A3's rule is `void` in `passes_gate` with the
four rubric columns left blank.

**Why the pass paused here instead of re-running.** The native smoke gate completed **197s** at
14:37–14:40, ten minutes before this row was fired, so the instance demonstrably served a full native
diagnosis on this build. A 16-minute non-terminating run immediately afterwards is beyond the
intra-day drift §O measured and §AC7's interleaving is designed to spread. The open question is
whether native runs terminate *reliably* right now: if they do not, the pass burns its 3-void cap in
the first few rows and closes as *gate not evaluable* (§AC6) — spending pre-registered rows to measure
provider weather rather than harness quality, with §T9's *"do not re-run this pass to get a firmer
number"* forbidding a clean retry later.

**One inconclusive observation, recorded because it will be re-checked and must not be
over-read:** `sys_gen_ai_usage_log` holds no row later than **14:44:54** (the seed-01 agent run),
despite this row making several LLM calls between 14:45 and 14:47. That is consistent with the table
lagging, with native LLM calls not landing in it under this filter, or with a provider-side problem —
**it distinguishes none of the three**, and §D5 already records this table behaving oddly. It is not
evidence of provider failure.

*(End of retracted record. The `sys_gen_ai_usage_log` gap noted above remains unexplained but is now
known not to indicate a stall: the run it supposedly evidenced had already completed.)*

</details>
