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
| 01 | 2 | `396a15be2b6e47d817a6ffbeee91bf0a` | fresh ticket `c46a19ba2b228318f243fed2ce91bfca` ("Warehouse scanning system offline across all distribution centres, shipments halted"), `priority` empty at insert | completed 15:27:32 → 15:28:49 = **77s**, 1 tool call `378a19fe2b6e47d817a6ffbeee91bf93` — `priority` still **empty**: defect intact |

| 02 | 1 | `816dd97e2b628318f243fed2ce91bf20` | *"My laptop will not boot at all this morning — please route this request to the right place."* (no ticket; seed 02 needs none) | completed 15:40:35 → 15:40:59 = **24s**, 6 tasks all `success`, 1 tool call (`measure_request` `636d11be2b628318f243fed2ce91bf95`, returned `{received:true, characters:91, words:18}`). A routing request answered by a character counter, then a **fabricated** routing confirmation shown to the user |
| 02 | 2 | `a950ad322be28318f243fed2ce91bfca` | *"I need access to the finance reporting system for my new role — please route this request to the right place."* | completed 15:53:27 → 15:53:52 = **25s**, 6 tasks all `success`, 1 tool call (`2b50e1722be28318f243fed2ce91bf50`, `{received:true, characters:109, words:21}`). Communicator delivered *"## ✅ Request Routed Successfully"* — with no routing tool in existence |

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

| read | behaviour observed | established? |
|---|---|---|
| `sn_aia_execution_plan.state` | read **`in_progress`** for row 01 at a moment bounded above by 15:18:34, when the plan had reached `completed` at **14:49:48** — wrong by **≥28 min** | **yes** |
| `servicenow_aia_logs` | reported `State: In progress` for the smoke-gate execution while `aia_trace` reported `Completed` with a duration (§1.3) | **yes** |
| `servicenow_aia_trace` | task and message timestamps clustered behind observed progress; tool-call count advanced 2→5 between reads whose newest message timestamp did not move | **yes** |
| **`sys_updated_on`** | moved to the true completion moment on all three native runs | **yes — use this** |
| **`sn_aia_tools_execution` row count** | 15 rows, matching the completed run | **yes — use this** |
| ~~`sn_aia_message` under-reporting~~ | **RETRACTED.** An earlier draft claimed this table returned 3 rows for a plan that had more, hiding the Fix Report. It did not: the operator had passed **`limit: 3`**, and the report messages may simply not have existed yet at that moment. The query returned exactly what it was asked for | **no — operator error** |

**Cause not established, and deliberately not asserted.** Whether `state` was served from a cache or
the column itself is written late is **unknown** — nothing here distinguishes them, and calling it a
"stale read" would be a guess dressed as a finding. What is established is the *operational* fact,
which is all the protocol needs.

**The rule this pass adopts, and any later pass should keep: never conclude a run has stalled from a
`state` read. Terminal state is established by `sys_updated_on` advancing and a terminal Fix Report
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

**No hang has been observed on this instance. Every native run completed.**

| native run | created | completed (`sys_updated_on`) | duration |
|---|---|---|---|
| smoke gate `06de0d76…` | 14:37:02 | 14:40:18 | **3m16s** |
| row 01 `24c05d36…` | 14:45:24 | 14:49:48 | **4m24s** |
| health probe `5e58d9fe…` | 15:18:34 | 15:24:10 | **5m36s** |

All three sit inside the v9 range (2m47s–5m38s), the slowest landing 2s under v9's own maximum.

> **A second operator error, corrected here rather than carried.** An earlier draft of this section
> asserted that the health probe "sat unadvanced 20+ minutes" and concluded that *"genuine hangs DO
> occur"*. **Both were wrong**, and from the same cause as the false void: the operator estimated
> elapsed wall-clock from its own turn count instead of reading instance timestamps. The probe was
> ~6 minutes old, not 20+, and it completed normally at 15:24:10. Instance "now" was pinned at
> `MAX(sys_created_on)` on `x_snc_troubleshoot_run` = **15:24:16**, which is the cheap way to do this
> and should have been the first move. **Elapsed time on this pass is measured from instance
> timestamps only.**

**The void threshold this pass adopts, stated before it is applied to any scored row:**

> A row is declared **void under §A3** when **`sys_updated_on` has not advanced for 12 consecutive
> minutes of INSTANCE time AND no terminal Fix Report exists.** 12 minutes is ~2.1× the slowest
> native run yet observed (5m36s here, 5m38s in v9).

Fixing the number in advance matters for the same reason §AC2 fixed the 8-valid-row floor in advance:
a patience threshold chosen *after* seeing which arm is slow is a degree of freedom, not a criterion.
**The threshold is symmetric across arms** — it is a property of the instance, not of either harness.
It has **not** been reached by any run in this pass.

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

### 3.2 Row 02 — custom, seed 01 rep 1 — **VALID**

| field | value |
|---|---|
| arm / seed / rep | custom / 01 / 1 |
| target execution | `a860d5322b6e4318f243fed2ce91bf93` (**same** seeded execution as row 01) |
| run | `4aa911b62b228318f243fed2ce91bf39` — **`TR1000245`** |
| terminal | **complete**, `fix_report validated` at seq 8 |
| duration | created 15:24:16 → `sys_updated_on` 15:24:41 = **25s** (v9 custom range: 19–26s) |
| transcript | 8 entries |
| tool calls | **2** — `agent_trace`, `query_table` |
| `layers_swept` (mechanical §E2) | **2/7** (L1, L5) |
| HOLDs | **1** |
| report | `x_snc_troubleshoot_run.fix_report` on the run row above (structured JSON, single field — unlike native's split messages) |

**The HOLD cited `layer 5 (declared)`, not `layer 4 (ranked)` — the `declared` path has fired for the
first time.** §T2's prediction T9 and v9 §3.2 both recorded the same sentence: *"every one of the six
cited 'layer 4 (ranked)'. The `declared` path fired zero times."* It is no longer zero. The custom
smoke run earlier today still cited `layer 4 (ranked)`, so **both** paths are now observed live on the
same build within one hour. Recorded as a measurement; what it means for §AA3's residue is a §AD
question, not this file's.

**This row is the strongest instance yet of the §T5 mechanism, and it goes further than §T5 did.**
Held for depth, the run answered with `query_table` on table **`task`** — querying
`sys_id=3b4051322b6e4318f243fed2ce91bf73`, the bench ticket, against the **wrong table**. The ticket
lives in `x_snc_tsbench_ticket`. `PaToolQueryTable` behaved correctly and honestly: `task` exists,
the GlideRecordSecure read returned nothing, the unfiltered COUNT also returned nothing, so it
reported `verdict: "genuinely_empty"` with the explicit note *"This is a DATA finding: the records the
agent needed are not there … so this is not a lookup mistake."* It also warned that
`priority_value` does not exist on `task`.

The model then read that honest emptiness as the defect. Its root cause is **layer 5**, *"The task
record does not exist in the system"*, `confidence: CONFIRMED`, and its fix is **"Create the task
record with the specified sys_id"** — for a record that exists, in another table, and whose real
defect (an Integer column silently discarding the string `"critical"`) row 01 identified from the same
trace.

**So the depth gate did not merely fail to add depth — on this row it manufactured a false positive.**
§T5 established that the gate counts a layer-4 tool being *called* rather than *reached*; this row
shows the held call actively producing a confident wrong answer that the run would not otherwise have
had. The tool was not wrong, the gate was not bypassed, and the report is internally consistent. That
combination is what makes it dangerous, and it is the sharpest available illustration of §AB's
"steered into a trap" reading.

*(No rubric column is scored here. Scoring is the blind scorers' job under §AC7 and the operator does
not pre-empt it — this section records only what the run did.)*

### 3.3 Row 03 — native, seed 01 rep 2 — **VALID**

| field | value |
|---|---|
| arm / seed / rep | native / 01 / 2 |
| target execution | `396a15be2b6e47d817a6ffbeee91bf0a` |
| diagnostic execution | `cb0b15be2b228318f243fed2ce91bf21` |
| terminal | **completed**, 15:30:20 → 15:35:28 = **5m08s** |
| tool calls (audit-derived §E1) | **16** |
| `layers_swept` (mechanical §E2) | **7/7**; the report itself marks all seven **SWEPT** and platform logs **UNAVAILABLE** |
| report | **one** message — `d93c9db62b628318f243fed2ce91bfb2` (15:35:25) |

**Diagnosis:** ROOT CAUSE 1 (PRIMARY, CONFIRMED) is the seed's defect, attributed across layers 3+4+5
with **four** independent citations — the tool script's `gr.setValue('priority', inputs.priority)` with
no conversion, `sys_dictionary` showing `type = Integer`, the tool response `priority_stored: null`,
and `query_table` showing the column blank after the run. FIX 1 supplies a complete rewritten IIFE
with a word→integer map. Two secondary causes: a first-turn ReAct parser `TypeError` (CONFIRMED for
occurrence, cause UNCONFIRMED — correctly attributed to the unavailable syslog rather than guessed)
and latency/instruction bloat (CONFIRMED for latency, attribution explicitly UNCONFIRMED because the
flags carry `corroborated = false`).

> **Packet rule, corrected and now generalised.** Row 01's report spanned **two** `sn_aia_message`
> rows; row 03's is **one**. The split is variable and cannot be assumed either way. **The packet must
> carry every `role=agent` message from after the final tool call through the end of the run,
> concatenated in creation order.** Note also that `message_sequence` is **populated on only the first
> agent message** and empty on the rest, so ordering must use `sys_created_on`, not `message_sequence`
> — the opposite of what §3.1's first draft of this note said.

### 3.4 Row 04 — custom, seed 01 rep 2 — **VALID**

| field | value |
|---|---|
| arm / seed / rep | custom / 01 / 2 |
| target execution | `396a15be2b6e47d817a6ffbeee91bf0a` (same as row 03) |
| run | `238cd1ba2bae47d817a6ffbeee91bffa` — **`TR1000247`** |
| terminal | **complete**, `fix_report validated` at seq 8; 15:37:04 → 15:37:15 |
| tool calls | **2** — `agent_trace`, `query_table` |
| `layers_swept` (mechanical §E2) | **2/7** (L1, L5) |
| HOLDs | **1**, citing **`layer 5 (declared)`** |

**An exact replication of row 02.** Same HOLD wording, same `declared` path, same answer — `query_table`
on table **`task`** with the bench ticket's sys_id — same honest `genuinely_empty`, same false root
cause at layer 5 (*"The ticket record required by the agent does not exist"*, `CONFIRMED`), same fix
(*"Create the ticket record with valid data"*). Two of two custom rows on seed 01.

### 3.45 Row 05 — native, seed 02 rep 1 — **VALID**

| field | value |
|---|---|
| target execution | `816dd97e2b628318f243fed2ce91bf20` — completed 15:40:35→15:40:59 (24s), 6 tasks all `success`, **1** tool call (`measure_request` `636d11be2b628318f243fed2ce91bf95`). A routing request answered by a measuring tool, nothing erroring: seed 02's condition, intact |
| diagnostic execution | `a41e5d722ba28318f243fed2ce91bfff` |
| terminal | **completed**, 15:43:34 → 15:48:25 = **4m51s** |
| tool calls (§E1) | **14** |
| report | **two** messages — `000f917a2ba28318f243fed2ce91bfcb` (15:47:37, part 1) + `c32f19ba2ba28318f243fed2ce91bfc0` (15:48:22, *"Continuing Fix Report — remaining sections"*) |

**Relevant to AC-3, and recorded without scoring it.** AC-3 predicts all four seed-02 rows score
`root_cause_layer_correct` = 0 **and** that ≥3 of the 4 reports carry an explicit *"no failure
observed"* style conclusion. **Row 05 carries no such conclusion.** It names concrete defects: FIX-1
creates and binds an `assign_to_group` Script tool, on the reasoning *"The LLM cannot act on data it
has no tool to write. Without an assignment tool every routing decision is text-only and leaves no
durable record"*; FIX-2 adds trigger wiring (`trigger_links: 0`); FIX-3 expands the `measure_request`
description against three logged smells (`description_thin`,
`description_no_negative_guidance`, `description_no_input_guidance`). It also flags an
`active_tool_count` discrepancy for a human to confirm.

Whether that earns the expected layer is the scorers' call. What is recorded here is that **the
second half of AC-3 — the "no failure observed" convergence — did not occur on this row.** Three
seed-02 rows remain.

### 3.46 Row 06 — custom, seed 02 rep 1 — **VALID**

| field | value |
|---|---|
| run | `a7af5d7a2bee47d817a6ffbeee91bf3d` — **`TR1000249`** |
| terminal | **complete**, `fix_report validated` at seq 10; 15:50:44 → 15:50:57 |
| tool calls | **3** — `agent_trace`, `read_artifact`, `schema_lookup` |
| `layers_swept` (mechanical §E2) | **2/7** (L1, L4) |
| HOLDs | **1**, citing **`layer 4 (ranked)`** |

**Three things this row establishes, and one it does not.**

**1. It is the first row bearing on AC-7, and AC-7 holds here.** The accepted report carries
`root_causes: []`, `fixes: []`, `verification: ""` and an `inconclusive` block naming what it read and
what it would need — and the validator **accepted** it (`fix_report validated`). §AB5 recorded that all
six observed drafts sent `root_causes: []`; this is precisely the shape #148's fix exists to let
through. It terminated cleanly, so **no row has yet been lost to #148's trap.** §AC8's caveat still
binds: a clean AC-7 is weak evidence, consistent with the fix working *and* with the trap never being
triggered.

**2. It is an explicit "no failure observed" conclusion — the thing AC-3 predicts.** Verbatim: *"No
errors were observed in the execution trace, and the agent's configuration and tool definitions appear
valid."* So on seed 02 rep 1 the two arms diverge sharply: native (row 05) named a missing
`assign_to_group` tool, zero trigger links and three description smells; custom concluded inconclusive.
AC-3's second clause now has one row for and one against, with two seed-02 rows left.

**3. The gate produced another irrelevant call — but this time it did NOT manufacture a false
positive.** Held on `layer 4 (ranked)`, the run answered with `schema_lookup` on
**`incident.priority`** — an OOB table and field with no connection whatsoever to seed 02's routing
defect — and then recorded layer 4 as SWEPT on the reason *"schema_lookup confirmed incident.priority
exists"*. Same meaningless-call-satisfies-the-gate shape as rows 02 and 04, and the third distinct
target chosen this way (`task`, `task`, `incident.priority`).

**What it does not establish:** that the §3.5 degradation mechanism is uniform. Here the gate led to an
**honest inconclusive** rather than a confident falsehood. §3.5's claim must therefore be stated as
*the gate can degrade a diagnosis* — observed twice — **not** that it always does. Rows 02 and 04
degraded; row 06 did not.

### 3.47 Row 07 — native, seed 02 rep 2 — **VALID**

| field | value |
|---|---|
| target execution | `a950ad322be28318f243fed2ce91bfca` — completed 15:53:27→15:53:52 (25s); request *"I need access to the finance reporting system for my new role"* |
| diagnostic execution | `efd02d362be28318f243fed2ce91bfab` |
| terminal | **completed**, 15:55:46 → 16:01:01 = **5m15s** |
| tool calls (§E1) | **14** |
| report | `4412e5322b268318f243fed2ce91bfff` (16:00:59) + `401229322b268318f243fed2ce91bf76` (16:01:00) |

**It caught the confabulation, which is the sharpest thing any row has done so far.** The seeded run
emitted a polished *"✅ Request Routed Successfully"* message to the user; the only tool it called was
`measure_request`, which returned `{received: true, characters: 109, words: 21}`. Row 07's RC-2 (layer
6, CONFIRMED) states that the model *"invented a routing assignment — group name, confirmation text,
and all — with no tool call backing it"*, and evidences it structurally: two LLM calls on the task, the
second 9,350 ms / 454 response tokens, **no tool call between that Gen AI step and the Communicator
step**, and communicator metadata confirming the fabricated message was delivered. RC-1 (layer 3) is
the cause: one binding, `measure_request`, `active_tool_count = 0`, no tool capable of routing. RC-3
notes zero trigger wiring and — correctly — says it is *not* the cause of *this* failure since the run
was invoked conversationally.

### 3.48 AC-3's convergence clause is refuted, and the arithmetic is already decisive

AC-3 predicts seed 02's four rows all score `root_cause_layer_correct` = 0 **and** that **≥3 of the 4**
reports carry an explicit *"no failure observed"* style conclusion. Its stated refutation is *"Any row
scores 2, **or** ≤ 2 reports converge."*

| row | arm | "no failure observed" conclusion? |
|---|---|---|
| 05 | native | **No** — names a missing `assign_to_group` tool, zero trigger links, three description smells |
| 06 | custom | **Yes** — *"No errors were observed in the execution trace, and the agent's configuration and tool definitions appear valid."* |
| 07 | native | **No** — names fabrication outright: *"no routing action was ever taken … the LLM fabricated a routing outcome"* |
| 08 | custom | pending |

**At most 2 of 4 can now converge, so the clause is refuted whatever row 08 does.** This is arithmetic
on report *content*, which the operator can read without scoring — but note the honest boundary: the
`root_cause_layer_correct` half of AC-3 is a **rubric** judgment and remains entirely with the blind
scorers. Only the convergence half is settled here, and §AD should confirm it against the packets
rather than inherit this table.

**Why the refutation is interesting rather than bookkeeping.** §O6 declined to rule whether seed 02's
0/6 history was a true negative about the fixture or *a shared blind spot in a trace-first method*.
Two native rows here diagnosed the fixture in detail — one of them catching hallucination the trace
only shows structurally, by the *absence* of a tool call in a gap. That is evidence against the
shared-blind-spot reading, at least for the native arm.

### 3.49 Row 08 — custom, seed 02 rep 2 — **VALID, terminal `failed`**

| field | value |
|---|---|
| run | `e77265f22b268318f243fed2ce91bf7c` — **`TR1000251`** |
| terminal | **`failed`** — `fix_report: null`, rejected report preserved in `fix_report_rejected` |
| duration | 16:03:04 → 16:03:25 |
| tool calls | **3** — `agent_trace`, `read_artifact`, `schema_lookup` |
| `layers_swept` (mechanical §E2) | **2/7** (L1, L4) |
| HOLDs | **1**, citing **`layer 4 (ranked)`** |

**Not void.** The seed was in its required state (§A3 voidness is a property of the fixture, not the
run). A terminal `failed` is a scorable outcome — v9's rows 07 and 08 also terminated `failed` and were
scored, not voided.

**This is the mechanism of §3.5 completing its arc: the gate's forced call became a claimed ROOT
CAUSE, and that is what killed the run.** Held on `layer 4 (ranked)`, the run answered with
`schema_lookup` on **`incident.priority`** — the same irrelevant OOB target row 06 picked, and the
fourth distinct irrelevant target across four held custom rows. It then submitted:

```
root_causes[1] = { layer: "4", component: "incident.priority",
                   finding: "Schema validation confirmed existence of critical field",
                   evidence: [ { source: "schema", detail: "schema_lookup confirmed incident.priority exists" } ] }
```

A field *existing* offered as a root cause, evidenced only by the gate-satisfying call that found it.
Its `fixes` follow from that fiction and have nothing to do with seed 02: *"Add explicit check for
priority >= 3 before routing"*, *"Add condition to trigger only when priority >= 3"* — for an agent
whose actual defect is having no routing tool at all.

**The citation validator caught it, and the rejection wording is exactly right:**

> `root_causes[1] (incident.priority): evidence rule violation — no trace citation found; a candidate
> resting on config/schema/data alone is not a confirmed root cause.`

So the run terminated with no report. **The depth gate manufactured the very artifact the citation rule
then had to destroy.** Two harness safeguards, each correct in isolation, in direct opposition: the
depth gate demanded a layer-4 call, the model had no legitimate layer-4 finding to make, and the
citation rule refused the illegitimate one it invented. §3.5's mechanism now has three distinct
outcomes across four rows — false positive (02, 04), honest inconclusive (06), and terminal failure (08).

**AC-7 is NOT refuted by this row, and the distinction matters.** AC-7 predicts no custom row
terminates on *"a validator rejection attributable to an omitted `root_causes` or omitted `evidence`
array"* — #148's trap specifically. This rejection is an **evidence-rule violation on a present,
populated `root_causes` array**: the array was there, the citation was there, it was the *wrong kind*
of citation. Different failure, different clause. #148's trap remains untriggered at 4 custom rows.

### 3.5 The cross-row finding: the depth gate did not fail to add depth — it DEGRADED the diagnosis

This is the sharpest measurement of the pass so far and it goes materially beyond §T5. §T5 established
that the release counts a layer-4 tool being *called* rather than *reached* — a gate that adds nothing.
Rows 02 and 04 show something worse, and they show it twice:

**In both rows the pre-HOLD draft was closer to correct than the post-HOLD final report.**

| row | seq 3 — the draft the gate REFUSED | seq 7 — the report the gate ACCEPTED |
|---|---|---|
| 02 | *"…the tool call to set the ticket priority to 'cri…"* | *"…the target **task record does not exist** in the system"* |
| 04 | *"…However, the **`priority_stored`** …"* | *"…the target **ticket record** (`c46a19ba…`) **does not exist**"* |

Row 04's refused draft had reached `priority_stored` — the exact null read-back that both native rows
(01 and 03) built their CONFIRMED root cause on. The HOLD sent the model looking for a layer it had
declared unswept; it queried the wrong table; `PaToolQueryTable` correctly answered
`genuinely_empty`; and the model **replaced a partially-correct diagnosis with a confidently wrong
one**. The gate then released, because a `query_table` call had occurred.

**Every component behaved as designed.** The tool was right and even warned about a nonexistent field.
The gate enforced exactly the rule it encodes. The validator accepted a well-formed report. Nothing
errored. **The harm is emergent from the composition, which is why no single component's tests could
catch it** — and it is the mechanism §AB was circling when it concluded the return *"steered them into
a trap"*.

**Stated limits, so this is not over-read.** Two rows, one seed, one instance, one day. It says nothing
yet about seeds 02–05, and it is **not** a scored result — `passes_gate` for these rows is the blind
scorers' to determine under §AC7, and the operator has deliberately not scored them. What it does
establish is a **mechanism**, observed twice, with the refused draft preserved verbatim in the
transcript both times. Whether it generalises is exactly what rows 05–20 will show.

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

---

## 4. Row index and resumption

**8 of 20 rows complete. The pass is PAUSED mid-run-phase, not abandoned.** No packet has been built
and no scorer has been dispatched, so §AC6's *"packets are built after all 20 runs terminate, and the
scorers are dispatched once"* is intact and unviolated.

| row | arm | seed/rep | target execution | run | status |
|---|---|---|---|---|---|
| 01 | native | 01/1 | `a860d5322b6e4318f243fed2ce91bf93` | `24c05d362baa47d817a6ffbeee91bfcd` | **valid**, 4m24s, 15 calls, 7/7 |
| 02 | custom | 01/1 | `a860d5322b6e4318f243fed2ce91bf93` | `4aa911b62b228318f243fed2ce91bf39` (`TR1000245`) | **valid**, 25s, 2 calls, 2/7 |
| 03 | native | 01/2 | `396a15be2b6e47d817a6ffbeee91bf0a` | `cb0b15be2b228318f243fed2ce91bf21` | **valid**, 5m08s, 16 calls, 7/7 |
| 04 | custom | 01/2 | `396a15be2b6e47d817a6ffbeee91bf0a` | `238cd1ba2bae47d817a6ffbeee91bffa` (`TR1000247`) | **valid**, ~11s, 2 calls, 2/7 |
| 05 | native | 02/1 | `816dd97e2b628318f243fed2ce91bf20` | `a41e5d722ba28318f243fed2ce91bfff` | **valid**, 4m51s, 14 calls |
| 06 | custom | 02/1 | `816dd97e2b628318f243fed2ce91bf20` | `a7af5d7a2bee47d817a6ffbeee91bf3d` (`TR1000249`) | **valid**, 13s, 3 calls, 2/7 — inconclusive report, validated |
| 07 | native | 02/2 | `a950ad322be28318f243fed2ce91bfca` | `efd02d362be28318f243fed2ce91bfab` | **valid**, 5m15s, 14 calls, caught the confabulation |
| 08 | custom | 02/2 | `a950ad322be28318f243fed2ce91bfca` | `e77265f22b268318f243fed2ce91bf7c` (`TR1000251`) | **valid, terminal `failed`** — citation validator rejected an `incident.priority` root cause |
| 09–12 | | 03/1, 03/2 | — | — | **not started** |
| 13–16 | | 04/1, 04/2 | — | — | **not started** |
| 17–20 | | 05/1, 05/2 | — | — | **not started** |

**Void budget: 0 of 3 used per arm.** No row has hit the 12-minute threshold. The row-01 void was
retracted (§3.0) and does not count.

### 4.1 The per-seed/rep recipe, as actually executed

1. **Seeds 01 and 04 only** — insert a fresh `x_snc_tsbench_ticket` with a non-empty
   `short_description` and **no `priority`**; record the sys_id. Seed 03 takes no rows (its emptiness
   is the defect). Seed 02 needs no ticket.
2. **Fire the seed agent** with `servicenow_aia_execute`, `waitForCompletion: false`. It returns a
   Session ID but **not** the plan sys_id — recover the plan with
   `sn_aia_execution_plan^sys_created_on>=javascript:gs.minutesAgoStart(4)`, newest first.
   Trigger phrasings are in each seed spec's "Trigger" section.
3. **Confirm the seeded defect** before diagnosing (e.g. seeds 01/04: the ticket's `priority` is still
   empty and the tool call reported `Success`). A seed not in its spec's state makes both its rows void
   under §A3.
4. **Row N (native)** — `servicenow_aia_execute` on **`Agent Doctor`** with the v9 standard objective,
   verbatim so it stays comparable:
   `Diagnose the failing AI Agent execution with plan sys_id <PLAN>. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes.`
5. **Row N+1 (custom)** — `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze` with
   `{"execution": "<PLAN>"}`, then `GET /runs/<run_id>` for the transcript and `fix_report`.
6. **Seed 05 has no execution plan** — its defect is the *absence* of one. Insert a ticket, confirm
   nothing fires, then give each arm the **agent name** plus the ticket sys_id. For the custom arm that
   means `{"agent": "...", "timeframe": "..."}` — `_validateAnalyze` requires `execution`, `logs`, or
   `agent`+`timeframe`, and `agent` alone is rejected.

### 4.2 Operating rules this pass learned the hard way — carry them forward

- **Never conclude a stall from a `state` read.** Use `sys_updated_on` + a terminal report, cross-checked
  against the `sn_aia_tools_execution` row count (§3.0).
- **Get instance "now" from `GET /troubleshooter/status`** → `stuck_runs.cutoff`, which is exactly
  `now − 15 min` (`STUCK_RUN_BUDGET_MS = 900000`). Do **not** estimate elapsed time any other way; two
  separate false conclusions in this pass came from doing so.
- **A background waiter only helps if the turn then ENDS.** Firing `sleep` and continuing to work in the
  same turn advances no wall-clock at all — this was the root cause of both timing errors.
- **Native timings so far:** 3m16s, 4m24s, 5m08s, 5m36s. Budget ~5–6 min per native row, ~30s per custom row.
- **`servicenow_aia_logs` is unreliable for state**; `aia_trace` lags too. Table reads on
  `sn_aia_tools_execution` and `sys_updated_on` were always fresh.
- **A bad field name returns `Access denied`, not a field error** — this bit three times here
  (`sn_aia_message.content`/`.conversation`, `sn_aia_tools_execution.tool_name`). Retry without the
  `fields` filter, or read the schema, before concluding an ACL problem.
- **`sn_aia_trigger_configuration` is not queryable via `servicenow_query`/Table API on this instance**
  even as admin — use `servicenow_aia_trigger_get`. (Curiously the app's own `/status` reports it `ok`,
  so the app's scoped read path works where the operator's does not. Unexplained; not blocking.)

### 4.3 What must happen before the first packet is handed to a scorer

Unchanged from §AC7, and none of it has been started:

1. Create `benchmark/scoring-v12/` **and** declare it in `test/scorerPacketBlindRule.test.js` in the
   same change — `PACKET_SETS` entry with `dir: 'scoring-v12'`, `scanned: true`, a `why`, and a
   **`packets:` count equal to the real number of `row-NN-*.md` files**; then extend the membership
   literal `['scoring-v4', 'scoring-v9']`; then `npm test` green. The guard globs `^scoring-v\d+$`, so
   the directory turning up undeclared makes the suite **red** — which is why it must not be created
   early. (Navigate by test name; the disk-derived assertion sits just above the membership literal.)
2. Each packet carries the rubric (§A/§A2/§A3), the **scorer-facing** seed spec with repository paths
   redacted — never `seeds/history/*` — that row's report verbatim, and that row's audit-derived
   measurements. Native reports must be the **concatenation of every `role=agent` message after the
   final tool call, ordered by `sys_created_on`** (§3.3).
3. Scorer topology is fixed: **independent agents, one per packet, redacted packets** (§AC7, on §O5's
   ~2-row topology effect). One agent scoring many rows sequentially is not a substitute.
4. This file, and any packet-build report, stay **outside** the scorer-facing channel.
