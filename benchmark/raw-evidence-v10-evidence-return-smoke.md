# v10 — the evidence-return smoke (`2026.08.06xx`, #81)

Run 2026-08-06 on gpinst01 (Zurich Patch 10 Hotfix 3). **Four custom-arm runs — seeds 01 and 03,
two runs each, against the same four execution plans v9 diagnosed as rows 07–10.**

> ## THIS IS NOT A SCORED PASS
>
> **n = 4. Two seeds (01, 03). Two runs each. Custom arm only.** No native control, no blind
> packets, no independent scorers, no rubric applied — therefore **no `passes_gate`, no /6 total,
> and no row here may be entered on any scorecard.** Terminal states and audit-derived tool trails
> only. The decision not to spend a scored round is §T9's and was pre-registered in `DECISION.md`
> §U6, not taken after seeing these results.
>
> Four rows on two seeds measures whether a mechanism fires. It measures nothing about rate, and
> **nothing whatsoever about diagnostic correctness** — see §5.

The prediction was written and committed **before any run fired**: `DECISION.md` §U, commit
`1657a92`, "bench(#81): pre-register the evidence-return prediction and revert trigger". The build
and install that this file measures came *after* that commit. That ordering is the point, and it is
checkable in the git history rather than asserted here.

**Result in one line: the mechanism fires, and it converted one run — the first `genai_log` call
the custom harness has ever made — while the other run spent its return without calling anything.
1 of 2 on seed 01. No regression on seed 03. No `partial`. No revert.** Read §4 before quoting
that, and §6 before treating "1 of 2" as settled: the pre-registration's own quantifier is
ambiguous, and the honest reading of that is recorded rather than resolved in the change's favour.

---

## 1. Protocol

**Shape.** Four diagnostic runs by the **custom** arm only
(`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`), request body
`{"execution": "<plan sys_id>", "mode": "diagnose"}` on all four — byte-identical to the v9 custom
arm's body, per `raw-evidence-v9-scored-pass.md` §1.

**Targets were reused, not re-triggered.** No new seeded executions were produced; no bench ticket
was inserted; the fixture app was not touched. The four target plans are v9's own, so the *only*
thing that differs between the v9 measurement and this one is the deployed harness:

| this run | seed / rep | execution plan sys_id | v9 row | v9 terminal |
|---|---|---|---|---|
| v10-1 | 01 / 1 | `4a5bb19d2b66cf54f243fed2ce91bf57` | 07 | **failed** — evidence/citation shortfall |
| v10-2 | 01 / 2 | `45bbfd112ba6cf54f243fed2ce91bfcb` | 08 | **failed** — three `unsupported citation` findings |
| v10-3 | 03 / 1 | `3afbf1192baa475817a6ffbeee91bf10` | 09 | complete |
| v10-4 | 03 / 2 | `1a1c71152ba6cf54f243fed2ce91bf31` | 10 | complete |

Re-diagnosing a plan does not modify it — v9 already diagnosed each of these twice, once per arm.
All four were re-read live before the pass and all four remain `state: completed`,
`state_reason` empty, created 2026-08-06 02:00–02:04, unchanged.

**Strictly sequential.** No two runs overlapped; each was confirmed terminal before the next was
posted. Start → terminal windows: 23:12:32–23:13:12, 23:13:42–23:14:07, 23:15:07–23:15:31,
23:15:45–23:16:08. This is mechanical, not tidiness — `PaRunAnchor`'s 30-min-per-user fallback
would otherwise glue one run's audit rows onto another's anchor (v9 §1). Custom runs anchor on
their own run record by construction, and every audit row queried below keyed to exactly one run.

**Zero retries, zero void.** All four reached a terminal state on the first post.

**Measurement source.** Tool calls, order and arguments are read from `x_snc_troubleshoot_audit`
(`action_type=intent` carries `input`, i.e. the arguments; `action_type=result` carries the
returned `output`), per §E1–E2 — never from report prose. `EVIDENCE RETURN` and `HOLD` notes are
`x_snc_troubleshoot_run.transcript` entries with `actor: 'system'`. LLM calls are `actor: 'llm'`
transcript entries.

**Access path.** foundry MCP tools throughout (`servicenow_connect` with `authType="keychain"`,
then `servicenow_request` / `servicenow_query`). No shell credential read, no `curl`, no `security`.

---

## 2. Pre-flight verification

All read live, none assumed.

| Check | Method | Result |
|---|---|---|
| Session on gpinst01 | `servicenow_connect` | active, admin, Zurich Patch 10 Hotfix 3 |
| Build | `now-sdk build` | success, SDK 4.9.2 |
| Deploy | `now-sdk install --alias gpinst01` | success; rollback context `52ed92612b228794f243fed2ce91bf0c` |
| **The change is actually live** | `sys_script_include` where `name=PaAgentLoop^scriptLIKEMAX_EVIDENCE_RETURNS` | 1 row — present |
| " | `name=PaAgentLoop^scriptLIKEEVIDENCE RETURN` | 1 row — the transcript marker is in the deployed script |
| " | `name=PaFixReport^scriptLIKEevidenceProblems` | 1 row — the classifier is deployed |
| `layers_available` (§E3) | `sn_aia_agent_tool_m2m` where `agent=e1392946828940e5a708fc51b0a5e954^active=true` | **7/7**, `max_auto_executions = 10` on every one |
| Targets intact | `sn_aia_execution_plan` × 4 | all four present, `completed`, unchanged |

> **Recorded because it will mislead the next operator.** The installed script includes carry
> `sys_updated_on` values of **2026-08-02**, hours before this install — `now-sdk install` does not
> stamp the record's update time with the install time. **`sys_updated_on` is not a deploy check.**
> The three `scriptLIKE` probes above are, and they are what was used.

`continuous_tool_execution_limit` was **not read** this pass (same gap §T1 records; the last
published measurement is `25` from §O1). It is not quoted anywhere below as a measurement of this
smoke.

---

## 3. The four runs — measurements

### 3.1 Cross-run summary

| run | seed/rep | run_id (`x_snc_troubleshoot_run`) | number | terminal | tool calls | LLM calls | HOLD | **EVIDENCE RETURN** | wall clock |
|---|---|---|---|---|---|---|---|---|---|
| v10-1 | 01/1 | `ae7e16252b228794f243fed2ce91bf24` | TR1000168 | **failed** | 4 | 8 | 1 | **1/2** | 40 s |
| v10-2 | 01/2 | `a3be12a52b228794f243fed2ce91bfae` | TR1000169 | complete | 4 | 7 | 1 | **1/2** | 25 s |
| v10-3 | 03/1 | `c81f5ee52b228794f243fed2ce91bfb0` | TR1000170 | complete | 2 | 4 | 1 | none | 24 s |
| v10-4 | 03/2 | `653f52292b228794f243fed2ce91bfb7` | TR1000171 | complete | 2 | 4 | 1 | none | 23 s |

**Zero runs terminated `partial`.** Every run received exactly one depth-gate HOLD, all four
citing "layer 4 (ranked)" in the identical wording v9 recorded six times. Neither seed-01 run
reached the evidence-return cap: both used 1 of 2.

### 3.2 Tool calls in order, with arguments (audit-derived)

Arguments are the `input` field of the `action_type=intent` row; outcomes are from the paired
`action_type=result` row's `output`.

**v10-1** (seed 01/1) — 4 calls:

| # | ts | tool | arguments |
|---|---|---|---|
| 1 | 23:12:45 | `agent_trace` | `{"execution":"4a5bb19d2b66cf54f243fed2ce91bf57"}` |
| 2 | 23:12:51 | `read_artifact` | `{"artifact_id":"758eda252b228794f243fed2ce91bf9b","offset":4000}` |
| 3 | 23:12:53 | `agent_config` | `{"agent":"914db68f3e364222a47f9e5398b6ac8d","section":"tools"}` |
| 4 | 23:12:55 | `schema_lookup` | `incident.priority` |

`EVIDENCE RETURN 1/2` at **23:13:01**. **No audit row exists after it** — the last `result` row is
23:12:56.

**v10-2** (seed 01/2) — 4 calls:

| # | ts | tool | arguments |
|---|---|---|---|
| 1 | 23:13:44 | `agent_trace` | `{"execution":"45bbfd112ba6cf54f243fed2ce91bfcb"}` |
| 2 | 23:13:51 | `read_artifact` | `{"artifact_id":"04ce52a52b228794f243fed2ce91bfca","offset":4000}` |
| 3 | 23:13:53 | `schema_lookup` | `{"table":"incident"}` |
| 4 | **23:14:02** | **`genai_log`** | `{"execution":"45bbfd112ba6cf54f243fed2ce91bfcb","mode":"for_execution"}` |

`EVIDENCE RETURN 1/2` at **23:13:59**. Call 4 lands **3 seconds after it**, and is the first tool
call of the run's second half.

**v10-3** (seed 03/1) — 2 calls: `agent_trace` `{"execution":"3afbf1192baa475817a6ffbeee91bf10"}`
at 23:15:19; `schema_lookup` `incident.assignment_group` at 23:15:25.

**v10-4** (seed 03/2) — 2 calls: `agent_trace` `{"execution":"1a1c71152ba6cf54f243fed2ce91bf31"}`
at 23:15:57; `schema_lookup` `incident.assignment_group` at 23:16:03.

Both seed-03 runs are structurally identical to each other and to their v9 counterparts (rows
09/10: two calls, `agent_trace` + `schema_lookup`, one hold, `complete`).

### 3.3 v10-2 in full — the case the change was built for

Transcript, verbatim sequence:

| seq | actor | ts | what |
|---|---|---|---|
| 1 | llm | 23:13:44 | `tool_call` `agent_trace` |
| 2 | tool | 23:13:45 | `agent_trace` → 19,580 chars, artifact, 5 pages |
| 3 | llm | 23:13:49 | **`fix_report`** |
| 4 | system | 23:13:49 | `HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 2, 3, 4, 5, 6, 7 declared NOT_SWEPT with no tool call behind them.` |
| 5 | llm | 23:13:51 | `tool_call` `read_artifact` offset 4000 |
| 6 | tool | 23:13:51 | page 2 of the trace |
| 7 | llm | 23:13:53 | `tool_call` `schema_lookup` `{"table":"incident"}` |
| 8 | tool | 23:13:53 | whole `incident` schema, 46,121 chars, 12 pages |
| 9 | llm | 23:13:59 | **`fix_report`** — rejected |
| 10 | system | 23:13:59 | **`EVIDENCE RETURN 1/2: fix_report not accepted — 1 evidence problem(s) need a tool call, not a rewrite; run continues.`** |
| 11 | llm | 23:14:02 | **`tool_call` `genai_log` `{"execution":"45bbfd112ba6cf54f243fed2ce91bfcb","mode":"for_execution"}`** |
| 12 | tool | 23:14:02 | `genai_log` → 5,176 chars; `llm_call_rows: 3`, all `status: success`, model `claude-sonnet-4-6` |
| 13 | llm | 23:14:07 | **`fix_report`** — resubmitted |
| 14 | system | 23:14:07 | **`fix_report validated`** |

The resubmitted report validated and is stored on the run. Its `layers_swept` marks layer 6
`SWEPT` with the reason *"genai_log confirmed LLM calls were successful"* — the tool it went and
called after the return. Its single root cause is `UNCONFIRMED` at layer 1 with
`would_confirm: "layer 5 — query_table against incident table to verify priority update"`.

**This is the first `genai_log` call the custom harness has made.** §T6 puts the count at
**63 runs with zero `genai_log` and zero `log_analysis`**, a streak §Q5, §R3, §S and §T all record.
The tool has been attached and active on Agent Doctor the whole time (verified again in §2 above:
7/7, `max_auto_executions = 10`). The streak ends on the run immediately after an evidence return,
three seconds after it.

### 3.4 v10-1 in full — the return that bought nothing

| seq | actor | ts | what |
|---|---|---|---|
| 1–2 | llm/tool | 23:12:45 | `agent_trace` |
| 3 | llm | 23:12:49 | `fix_report` |
| 4 | system | 23:12:49 | `HOLD` — layer 4 (ranked), identical wording |
| 5–6 | llm/tool | 23:12:51 | `read_artifact` offset 4000 |
| 7–8 | llm/tool | 23:12:53 | `agent_config` `section: tools` |
| 9–10 | llm/tool | 23:12:55 | `schema_lookup` `incident.priority` |
| 11 | llm | 23:13:01 | **`fix_report`** — rejected |
| 12 | system | 23:13:01 | **`EVIDENCE RETURN 1/2`**, 1 evidence problem |
| 13 | llm | 23:13:05 | **`fix_report`** — resubmitted, **no intervening tool call** |
| 14 | llm | 23:13:12 | `fix_report` — the repair turn's output |
| 15 | system | 23:13:12 | `fix_report failed validation and could not be repaired: fixes is required and must be an array; verification is required and must be a non-empty string` |

**What the model did with its return.** It took the block's **second** offered option rather than
its first. `_evidenceReturnBlock` presents exactly two moves — *(1) call a tool that reads the
missing source*, or *(2) state the claim at the strength your evidence supports; an `UNCONFIRMED`
cause naming `would_confirm`, or the `inconclusive` shape, is a valid report*. The seq-13
resubmission dropped `root_causes` to `[]` and switched to the `inconclusive` shape.

**And that move worked, on the problem it was aimed at.** The final rejection names **no evidence
problem at all** — it is `fixes is required` and `verification is required`, both pure shape. The
evidence problem was cleared without a tool call; the report then failed on two required fields the
model omitted while restructuring, and the tool-less repair turn (seq 14) failed to restore them
either. **That second failure is not #81's**: a missing required field is precisely the shape class
the repair turn keeps, and #64/#65 established it works for that class. It did not work here.

**Task 6's draft preservation held.** The run closed `failed`, not `partial`, and
`fix_report_rejected.report` is populated and retrievable from `GET /runs/{id}` — so the row stays
scorable, which is the property §U3's second refutation clause exists to protect.

### 3.5 The measurement that could not be made

**The evidence-problem text is not persisted for a run that later validates.** `_evidenceNote`
records only the *count* ("1 evidence problem(s)"), the full text goes into the prompt via
`_evidenceReturnBlock` and is never written to a column, and `fix_report_rejected` is only stored
when the run ends `failed`. So for **v10-2 — the load-bearing run — the exact wording of the
rejection that triggered its return cannot be read back off the instance.**

What *can* be established about it, mechanically:

- The tools invoked before the return were `agent_trace`, `read_artifact`, `schema_lookup`. Under
  `PaFixReport._citationToolMap()` those support `trace` and `schema` and nothing else — `config`
  and `data` were both unsupported at that moment, and `read_artifact` supports no source at all.
- `genai_log` is named as a supporting tool for **`config`** in `_citationToolMap()`, and for
  **layer 6** in `_layerToolMap()` (`6: ['genai_log', 'log_analysis']`).
- Every one of the six problem families routed to the evidence class names its tools explicitly:
  `unsupported citation` renders `(agent_config, genai_log)`; `unsupported sweep claim` renders
  `6 (GenAI stack) needs one of: genai_log, log_analysis`.
- The only evidence-class shortfall whose named tools **exclude** `genai_log` is one about `data` /
  layer 5 — and the validated report marks layer 5 `NOT_SWEPT` and puts `query_table` in
  `would_confirm`, i.e. the model did *not* treat layer 5 as the thing it had just been asked for.

**So `genai_log` was named by the rejection under every family consistent with the run's own
record, and by none that is inconsistent with it — but this is a reconstruction, not a reading.**
It is recorded as a reconstruction. **Filed as a defect against the harness, not against this
smoke:** an evidence return whose reason cannot be recovered after the fact makes exactly this
question unanswerable every time, and the next pass will hit it too.

---

## 4. The verdict against the pre-registered prediction

Predictions as filed in `DECISION.md` §U2, commit `1657a92`, before any run.

| | Prediction, as filed | Outcome | Measured |
|---|---|---|---|
| U-a | **Seed 01.** In **≥1 of 2** runs, an evidence-class rejection produces at least one `EVIDENCE RETURN <n>/2` note **and** the run's next tool call reads a source named in the rejection. Both halves in the same run | **HELD** | **1 of 2.** v10-2: note at 23:13:59, `genai_log` at 23:14:02, then validated. v10-1: note at 23:13:01, **no tool call after it** |
| U-b | **Seed 03.** 0 of 2 `partial`; no `complete` lost for a reason attributable to the evidence return | **HELD** | 0 `partial`. Both `complete`, as in v9. **Neither fired an evidence return**, so per U-b's own clause neither is evidence for or against the change |
| U-c | **Both seeds.** No run terminates `partial` | **HELD** | 0 of 4. `_hasEvidenceHeadroom` was never the binding constraint — both returns fired with iterations and budget to spare, and both runs finished |

**Refutation clauses (§U3), checked explicitly:**

| | Clause | Observed? |
|---|---|---|
| §U3.1 | An `EVIDENCE RETURN` appears and the model resubmits an identical or weaker report **without an intervening tool call** | **YES on v10-1. NO on v10-2.** |
| §U3.2 | A run that ended `failed` carrying a draft now ends `partial` | **NO.** 0 `partial`; v10-1 ended `failed` with its draft preserved and retrievable |

### The revert trigger did not fire, and here is exactly why — including the part that cuts against it

**`MAX_EVIDENCE_RETURNS` is left at `2`.** The pre-registered prediction U-a is quantified
**"≥1 of 2"** and it held: one seed-01 run gathered evidence it had never gathered before and
converted a rejection into a validated report. §U3.2 is clean at 0 of 4.

**But §U3.1 was observed on v10-1, and the pre-registration does not say cleanly whether one
occurrence in the pair fires the trigger.** §U3's preamble reads "Either of these, on the seed-01
pair", which is ambiguous between *on either run of the pair* and *on the pair as a whole*. Under
the per-run reading, U-a and §U3.1 are **both** satisfied — a contradiction the pre-registration
permits and should not have. **That is a defect in the pre-registration, and it is recorded here
rather than resolved silently in the change's favour.**

Three things argue against reverting, stated so a reader can weigh them and overrule:

1. **§U3.1's own stated rationale was not met.** §U3 justifies that clause as: *"it would mean the
   return relocated the tool-less repair turn rather than replacing it, and bought two extra
   iterations for the same unfixable move."* v10-1 did not make the same unfixable move. Its
   resubmission **cleared the evidence problem** — the final rejection contains no evidence problem
   at all — by taking option 2 of the two options the return block explicitly offers. The letter of
   the clause is satisfied; its reason is not.
2. **v10-2 is direct positive evidence and is not explainable any other way.** A tool with a
   63-run streak of never being called was called three seconds after the return, on the run whose
   v9 counterpart died on three `unsupported citation` findings.
3. **Nothing regressed.** 0 `partial`, both seed-03 runs unchanged, draft preservation working.

**And one thing argues for it, recorded with equal weight (§4.1).**

### 4.1 The countervailing observation

**v10-1's report is worse than the one v9 got on the same target.** v9 row 07 ended `failed` with a
`CONFIRMED` root cause filed at layer 4 — wrong (on a table that does not exist), but a scorable
diagnosis that took 1/6. v10-1 ends `failed` with **`root_causes: []`**, an `inconclusive` block,
and a report that is *additionally* invalid on shape. On the one target where the two harness
versions can be compared directly and the return did not produce a tool call, **the draft got
emptier.**

This is n=1 and it is confounded — the model is nondeterministic and v10-1 also took a different
tool path from v9 row 07 *before* the return ever fired. It is not evidence that the return caused
it. It is recorded because it is the observation that would most change the verdict if it repeated,
and because §U3.1 firing on the same run means the two are not independent worries.

**Recommendation: this decision should be ratified or overruled by a human before the PR merges.**
The mechanism works; the pre-registration's quantifier does not decide the case; and this file
should not be the thing that decides it either.

---

## 5. What this does not establish

- **Nothing about diagnostic correctness, and the runs confirm §U5 rather than soften it.** All
  four reports still conclude at **layer 1** or at nothing: v10-1 `root_causes: []`; v10-2 layer 1
  `UNCONFIRMED`; v10-3 layer 1 `UNCONFIRMED`; v10-4 layer 1 `CONFIRMED`. The seeded layers are 3
  (seed 01) and 5 (seed 03). **Four of four would score 0 on `root_cause_layer_correct`** if a
  scorer were applied, exactly as §T3 measured six of six. The evidence return moved *evidence
  gathering*. It did not move the diagnosis one layer.
- **v10-2's `genai_log` call did not help its diagnosis.** It cleared the validator and supported a
  layer-6 sweep claim. The root cause stayed at layer 1, and the report itself names layer 5 and
  `query_table` as what would confirm it — the call it still did not make. §T3's line applies
  unchanged: *"almost reached layer 5" is not "named layer 5."*
- **No rate.** Four runs, two seeds, one instance, one hour, one model, one app version. 1 of 2 is
  a flip, not a frequency.
- **Nothing about the cap.** Both returns were the first of two; `MAX_EVIDENCE_RETURNS: 2` was
  never reached and the second return is untested live. Likewise `_hasEvidenceHeadroom`'s two
  guards never bound.
- **Nothing about the depth gate**, which fires before validation and is untouched. All four holds
  read "layer 4 (ranked)", extending §T4's finding to 10 of 10 holds without testing it.
- **Nothing about seeds 02, 04 and 05.**
- **Nothing comparable to v9's scores.** Sharing the four target plans makes *terminal states* and
  *tool trails* comparable and nothing else. No packet was built and no scorer was engaged.
- **The reason for v10-2's return is reconstructed, not read** (§3.5).
- **`continuous_tool_execution_limit` was not read** (§2).

---

## 6. Changes made

**To the instance:** the app was rebuilt and reinstalled (`2026.08.06xx`, rollback context
`52ed92612b228794f243fed2ce91bf0c`), and four diagnostic runs were created —
`ae7e16252b228794f243fed2ce91bf24`, `a3be12a52b228794f243fed2ce91bfae`,
`c81f5ee52b228794f243fed2ce91bfb0`, `653f52292b228794f243fed2ce91bfb7` — with their audit rows and
artifacts. No seed agent, fixture table, tool, capability, ACL or execution plan was created,
modified or deleted. No bench ticket was inserted.

**To the repository:** this file, and `DECISION.md` §U7 recording the outcome. **Nothing under
`src/` or `test/` was modified** — `MAX_EVIDENCE_RETURNS` remains `2`, per §4.

**Version note:** the section heading carries `2026.08.06xx` because the release version is
assigned in the follow-on task. The build measured here is branch `fix/81-evidence-return-to-loop`
at commit `1657a92`, whose `package.json` still reads `2026.08.0505`. Whoever assigns the version
should replace `06xx` in this file and in `DECISION.md` §U.
