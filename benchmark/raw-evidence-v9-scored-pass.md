# v9 — the scored pass (`2026.08.0505`, #119)

Run 2026-08-06 on gpinst01 (Zurich Patch 10 Hotfix 3), app version `2026.08.0504`. **Twelve
scored rows — 6 native + 6 custom, seeds 01 / 03 / 04, two reps each, both arms the same day.**
The pass §Q7 asked for and §R9 re-asked for.

Predictions T1–T9 were filed on issue #119 **before any run fired**; T10 and T11 were filed in
that issue's first comment, after the smoke gate and **still before any scored run**. Their
scored outcomes are in `DECISION.md` §T2, not here — this file is the measurement record.

Companion artifacts, all produced before this file and none rewritten by it:

| Artifact | What it holds |
|---|---|
| `benchmark/scoring-v9/trigger-report.md` | how the six seeded failing executions were produced |
| `benchmark/scoring-v9/run-evidence.md` | all 12 rows verbatim, including every Fix Report in full and every transcript HOLD |
| `benchmark/scoring-v9/packet-build-report.md` | packet construction, the blind-rule gate, and §7's complete deviation record |
| `benchmark/scoring-v9/results/row-01-result.md` … `row-12-result.md` | each blind scorer's full reasoning |
| `benchmark/scoring-v9/row-01…row-12` | the twelve blind packets exactly as scored |
| `benchmark/scorecard-v9.md` | the scorecard proper, §A2 gate expression applied |

> **Note on layout.** This pass follows v4's shape so the two can be read side by side: the twelve
> blind packets sit at `benchmark/scoring-v9/` root, the twelve scorers' verdicts under
> `benchmark/scoring-v9/results/` as `row-NN-result.md` — the same names v4 uses — and the three
> process artifacts (trigger, run evidence, packet build) beside the packets, matching how
> `scoring-v4/` carries its own process subdirectories. The packets themselves are byte-identical
> to what each scorer saw; nothing in this directory was edited after scoring.

**Result in one line: native 36/36 and 6/6 on the gate; custom 9/36 and 0/6. Twelve rows, three
seeds, one instance, one day — a direction, not a rate.** The qualifications that bound it are in
§7 and in `DECISION.md` §T5, and they are not decoration: the native gate result turns entirely on
one rubric column that four of six scorers flagged as under-determined.

---

## 1. Protocol

**Shape.** Six pre-seeded failing AI Agent executions (seeds 01, 03, 04 × 2 reps). Each was then
diagnosed twice — once by the **native** arm (Agent Doctor, `servicenow_aia_execute`) and once by
the **custom** arm (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`) — giving 12 rows
against 6 targets. Every diagnostic run was a fresh conversation with a fixed prompt; the native
input text was byte-identical across its six rows apart from the plan sys_id, and the custom
request body was `{"execution": "<plan sys_id>", "mode": "diagnose"}` on all six.

**Same-day, both arms.** This is what closes the §H7-4 cross-day drift confound the way §O's
protocol requires. Pass window: 2026-08-06 02:08:14 (row 01 start) → 03:08:12 (row 12 terminal),
one hour, one deployed version.

**Strictly sequential.** No two runs overlapped. This matters mechanically, not just tidily:
`PaRunAnchor`'s 30-min-per-user fallback would otherwise glue one run's audit rows onto another
run's anchor. Evidence that the precaution held — every native run received its own
`x_snc_troubleshoot_run` anchor with a distinct `conversation_ref` (TR1000156–161), even though
consecutive native runs started well inside 30 minutes of each other. Custom runs anchor on their
own run record by construction (TR1000162–167).

**Zero retries.** No run failed to reach a terminal state. Two custom runs reached the terminal
state `failed`; that is a terminal state, and both are scored from `fix_report_rejected.report`
exactly as §O's v4 pass scored its rejected rows.

**Scoring.** Twelve blind packets, one independent scorer per packet, per §O5's topology finding
(independent agents on redacted packets — the only topology §O3's comparison is meaningful
against). Each scorer saw its one packet and nothing else. The rubric is
`scorecard-template.md` §A / §A2 / §A3, reproduced byte-identically in all 12 packets.

**Roles were separated.** The trigger operator performed no diagnosis; the execution operator
performed no scoring, grading or comparison to seed expected answers; the packet builder resolved
no rubric judgment; the scorers read one packet each; this file was compiled from their outputs
without re-scoring any row.

---

## 2. Pre-flight verification

All read live before the pass, none assumed.

| Check | Method | Result |
|---|---|---|
| Session on gpinst01 | `servicenow_status` | active, admin, ZP10 HF3 |
| Seed agents installed | `servicenow_aia_list` nameFilter=`Seed` | all five present |
| Fixture app | — | `x_snc_tsbench` v0.0.1 installed and active |
| **Seed 04 void condition** | `sys_one_extend_capability` name=`x_snc_tsbench_unmapped_capability` vs the installed `sn_aia_tool.script` | capability sys_id `92ff62af516741769c437feb88c80ef3` present in both — **matches. Seed 04 is NOT void.** Placeholder not reintroduced; nothing modified |
| Seed 03 setup | `servicenow_query x_snc_tsbench_routing` | 0 rows — **the emptiness is the defect**, correct state, left untouched |
| Seed 01 setup | fresh ticket per rep, `priority` empty at insert | confirmed per rep |
| Bench ticket shape | `servicenow_schema x_snc_tsbench_ticket` | `short_description` string, `priority` **integer** |
| `layers_available` (§E3) | `sn_aia_agent_tool_m2m` where `agent=e1392946828940e5a708fc51b0a5e954^active=true` | **7/7 (L1–L7)**, all seven tools attached and active, `max_auto_executions = 10` on every one. Re-read after row 12: identical, same m2m sys_ids. **No tool attachment changed during the pass** |
| Blind-rule gate | `npx jest test/scorerPacketBlindRule.test.js` | PASS 11/11 (what green does and does not mean: §6.1) |
| Smoke gate | custom run TR1000155, expected `script_error` at `context_processing_script` line 42 | passed; it also surfaced #81 live, which is why T10/T11 are pre-registered rather than discovered |

**Fresh bench tickets per rep** (seeds 01 and 04), so rep 1's agent writes cannot contaminate
rep 2. Seed 03 needs no ticket — its Setup explicitly says to add no rows.

### 2.1 One §D requirement this pass did not meet

Template §D requires `continuous_tool_execution_limit` to be **read at run time, not assumed**,
for every scored run. **This pass did not read it.** The last published measurement is `25` on
gpinst01 (§O1, v4 pass, 2026-08-03). It is recorded in the scorecard as *not read this pass —
carried forward unverified*, and it is not quoted anywhere as a measurement of this pass.
`assists_consumed` was likewise not captured. Recorded as a gap rather than filled from memory.

### 2.2 The six seeded target executions

| seed | rep | execution plan sys_id | trigger | plan state |
|---|---|---|---|---|
| 01 | 1 | `4a5bb19d2b66cf54f243fed2ce91bf57` | ticket `464bb9152baa475817a6ffbeee91bfa9`, urgent description | completed |
| 01 | 2 | `45bbfd112ba6cf54f243fed2ce91bfcb` | ticket `a64b795d2b66cf54f243fed2ce91bf11`, urgent description | completed |
| 03 | 1 | `3afbf1192baa475817a6ffbeee91bf10` | route a *Hardware* category request | completed |
| 03 | 2 | `1a1c71152ba6cf54f243fed2ce91bf31` | route a *Software* category request | completed |
| 04 | 1 | `4e3c35552ba6cf54f243fed2ce91bf47` | summarise ticket `5b4b3d152baa475817a6ffbeee91bf2b` | completed |
| 04 | 2 | `b85c79992baa475817a6ffbeee91bf2c` | summarise ticket `fb4b7d5d2b66cf54f243fed2ce91bfda` | completed |

**All six report `state: completed` with an empty `state_reason`.** Including seed 04, whose spec
predicts an `OneExtendUtil.execute` failure. The failures live inside the traces, not on the plan
header — the same "invisible from the plan header" property the README's smoke gate is built
around. `completed` here must not be read as "the run did not fail".

---

## 3. The twelve rows — measurements

All tool-call counts and layer sweeps are **audit-derived** per §E1–E2 (`x_snc_troubleshoot_audit`,
`action_type=result`), never inferred from a report's prose. `layers_swept` below is the
**mechanical** §E2 map — see §3.3 for why that qualifier matters.

### 3.1 Cross-row summary

| row | arm | seed/rep | run_id | terminal | tool calls | LLM calls | distinct tools (first use order) | layers_swept (mech.) | wall clock |
|---|---|---|---|---|---|---|---|---|---|
| 01 | native | 01/1 | `961d7d9d2baa475817a6ffbeee91bf2a` | completed | 18 | 9 | agent_trace, read_artifact, query_table, agent_config, genai_log, log_analysis, schema_lookup | 7/7 (L1–L7) | 5m25s |
| 02 | native | 01/2 | `853ffd1d2bea475817a6ffbeee91bf0b` | completed | 17 | 8 | agent_trace, read_artifact, agent_config, genai_log, query_table, log_analysis, schema_lookup | 7/7 (L1–L7) | 4m17s |
| 03 | native | 03/1 | `74010e192b2e475817a6ffbeee91bfda` | completed | 13 | 6 | agent_trace, read_artifact, agent_config, genai_log, log_analysis, schema_lookup, query_table | 7/7 (L1–L7) | 2m47s |
| 04 | native | 03/2 | `a6c2061d2b2acf54f243fed2ce91bf34` | completed | 16 | 8 | agent_trace, read_artifact, log_analysis, genai_log, agent_config, query_table, schema_lookup | 7/7 (L1–L7) | 3m37s |
| 05 | native | 04/1 | `e064ce952b6acf54f243fed2ce91bf28` | completed | 14 | 9 | agent_trace, read_artifact, genai_log, agent_config, log_analysis, query_table, schema_lookup | 7/7 (L1–L7) | 5m38s |
| 06 | native | 04/2 | `aa06c65d2bae475817a6ffbeee91bf71` | completed | 17 | 9 | agent_trace, read_artifact, genai_log, agent_config, query_table, schema_lookup, log_analysis | 7/7 (L1–L7) | 4m21s |
| 07 | custom | 01/1 | `c5e7421d2baacf54f243fed2ce91bfc0` | **failed** | 3 | 6 | agent_trace, agent_config, schema_lookup | 5/7 (L1,L2,L3,L4,L7) | 24s |
| 08 | custom | 01/2 | `1d988e1d2bee475817a6ffbeee91bf4f` | **failed** | 3 | 6 | agent_trace, read_artifact, schema_lookup | 2/7 (L1,L4) | 22s |
| 09 | custom | 03/1 | `522986d12beacf54f243fed2ce91bfa7` | complete | 2 | 4 | agent_trace, schema_lookup | 2/7 (L1,L4) | 19s |
| 10 | custom | 03/2 | `4cb98e952b22875817a6ffbeee91bfa1` | complete | 2 | 4 | agent_trace, schema_lookup | 2/7 (L1,L4) | 20s |
| 11 | custom | 04/1 | `a53a02592beacf54f243fed2ce91bf65` | complete | 3 | 5 | agent_trace, read_artifact, schema_lookup | 2/7 (L1,L4) | 19s |
| 12 | custom | 04/2 | `deba8a1d2b22875817a6ffbeee91bfbb` | complete | 3 | 5 | agent_trace, read_artifact, schema_lookup | 2/7 (L1,L4) | 26s |

`layers_available` = **7/7** on every row.

**Native's audit trail lost nothing.** Its tool-call count matched the plan's `type=tool` task
count exactly on all six rows (18/18, 17/17, 13/13, 16/16, 14/14, 17/17).

### 3.2 The custom arm's holds and what answered them

Every custom run received **exactly one** harness `HOLD`, and every one of the six cited
**"layer 4 (ranked)"**. The `declared` path fired zero times.

| row | HOLD text (verbatim) | at seq | the tool call that followed | what it returned |
|---|---|---|---|---|
| 07 | `HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 2, 3, 4, 5, 6, 7 declared NOT_SWEPT with no tool call behind them.` | 4 | `schema_lookup` args `sn_tsbench_bench_ticket` | `table_exists: false`, finding `table_does_not_exist` |
| 08 | same wording, layers 2, 3, 4, 5, 6, 7 | 4 | `schema_lookup` args `incident.priority` | schema for an OOB table |
| 09 | same wording, layers 2, 4, 5, 7 | 4 | `schema_lookup` args `incident.assignment_group` | schema for an OOB table |
| 10 | same wording, layers 2, 4, 5, 7 | 4 | `schema_lookup` args `incident.assignment_group` | schema for an OOB table |
| 11 | same wording, layers 2, 3, 4, 5, 7 | 6 | `schema_lookup` args `incident` | whole `incident` schema, 46,121 chars, 12 artifact pages |
| 12 | same wording, layers 2, 3, 4, 5, 7 | 6 | `schema_lookup` args `sn_aia_tools_execution` | schema for the AIA platform table the trace came from |

**Not one of the six pointed at the table the seeded defect lives in.** Five targeted a platform
or OOB table; the sixth targeted `sn_tsbench_bench_ticket`, which does not exist on the instance
(the fixture table is `x_snc_tsbench_ticket`).

**Row 07 is the load-bearing case, and it establishes what the gate actually counts.** Its
`schema_lookup` retrieved nothing — the tool correctly answered `table_does_not_exist` — and the
gate released anyway. Two independent confirmations:

1. **Empirical.** Row 07 recorded exactly one HOLD. Its next terminal action was not held a second
   time; it reached the citation validator and failed there.
2. **Mechanical.** `PaAgentLoop._depthGate` releases on
   `this._anyOf(this._heldTools, trail.tools)`, and `trail.tools` is the set of tool **names** read
   out of `x_snc_troubleshoot_audit`. Nothing in the release path inspects what the tool returned.
   (`action_type=result` does mean the call returned, so the test is stronger than "intent" — but
   the content is never examined.)

**So the gate counts a layer-4 tool being *called*, not layer 4 being *reached*.** That is a
property of the mechanism as designed, stated here because the pass measured it firing that way
six times out of six.

### 3.3 What `layers_swept` here does and does not say

Every figure in §3.1 is the **mechanical** §E2 map of the distinct tool set. §E2's qualifier —
`agent_config` earns L2/L3/L7 only for the layers the diagnosis actually used — was deliberately
left unresolved by the operator and handed to the scorers, and **no scorer resolved it**: all
twelve treated sweep breadth as a non-rubric column and declined to score it.

So native's `7/7` and row 07's `5/7` are **unadjudicated**. This is not a hypothetical caveat:
§O5 records this exact qualifier correcting two native rows from 5/7 to 4/7 in the v4 pass, on a
`section: "tools"` call that never rendered the instructions section. Row 07's single
`agent_config` call in this pass passed `section: "tools"` only — the same shape. Read every
`layers_swept` in this file as a mechanical maximum.

### 3.4 Terminal states and the two rejections

| row | terminal | why |
|---|---|---|
| 07 | `failed` | `root_causes[0].evidence[0] has an invalid or missing source (must be one of: trace, config, schema, data)`; and `root_causes[0] (sn_tsbench_bench_ticket table): evidence rule violation — evidence cites only the trace; at least one config, schema, or data citation is required.` |
| 08 | `failed` | three × `unsupported citation — cites "config"/"data" but this run never invoked a tool that reads it … Tools invoked this run: agent_trace, schema_lookup, read_artifact.` |
| 09–12 | `complete` | `fix_report validated` recorded on the transcript |
| 01–06 | `completed` (execution plan) | native; see §6.3 on why the anchor's `status` must not be read instead |

Both rejections name an evidence/citation shortfall, and both survived the harness's repair
attempts. Rows 07 and 08 are scored from `fix_report_rejected.report`.

---

## 4. The scores

Rubric: `scorecard-template.md` §A. Gate: §A2's expression, `passes_gate = 1 iff
root_cause_layer_correct == 2 AND fix_usable_unedited == 1`. Every scorer computed the gate from
that expression rather than from the /6 total, and every scorer's arithmetic was reproduced when
compiling this file.

| row | arm | seed | `rcl` | `ftc` | `ev` | `fix` | total /6 | **passes_gate** | void | ambiguous |
|---|---|---|---|---|---|---|---|---|---|---|
| 01 | native | 01 | 2 | 2 | 1 | 1 | **6** | 1 | no | no |
| 02 | native | 01 | 2 | 2 | 1 | 1 | **6** | 1 | no | no |
| 03 | native | 03 | 2 | 2 | 1 | 1 | **6** | 1 | no | yes |
| 04 | native | 03 | 2 | 2 | 1 | 1 | **6** | 1 | no | yes |
| 05 | native | 04 | 2 | 2 | 1 | 1 | **6** | 1 | no | yes |
| 06 | native | 04 | 2 | 2 | 1 | 1 | **6** | 1 | no | yes |
| 07 | custom | 01 | 0 | 0 | 1 | 0 | **1** | 0 | no | yes |
| 08 | custom | 01 | 0 | 1 | 1 | 0 | **2** | 0 | no | yes |
| 09 | custom | 03 | 0 | 1 | 0 | 0 | **1** | 0 | no | yes |
| 10 | custom | 03 | 0 | 2 | 0 | 1 | **3** | 0 | no | yes |
| 11 | custom | 04 | 0 | 1 | 0 | 0 | **1** | 0 | no | yes |
| 12 | custom | 04 | 0 | 0 | 1 | 0 | **1** | 0 | no | no |

*(Row 12's scorer recorded `ambiguous = no`: its one close reading — whether a formally correct
citation supporting a wrong root cause still earns `evidence_cites_trace_and_config` — was
resolved from the rubric's own text rather than flagged as a gap. See §4.1.)*

**Native: 36/36, gate 6/6 (100%). Custom: 9/36, gate 0/6 (0%). Twelve valid runs, zero void.**

### 4.1 Per-row scorer verdicts and the ambiguity each flagged

**Row 01 — native, seed 01 — 6/6, gate 1, `ambiguous = no`.** RC-1 is headed "Integer field
rejects string priority value", layer cell "4 — Data schema + 3 — Tool definition", and names the
disagreement on both sides — the seed's own M18 scoring note awards full marks for exactly that.
Fix 1 supplies the word→integer map inside the tool script, the seed's own stated fix. Evidence
cites the trace (`priority_stored: null`) and the schema (`type: "Integer"`, `has_choices: false`),
both backed by real audit rows. **Recorded judgment call, resolved in the run's favour:** Fix 1
addresses the runtime `sn_aia_tool` record rather than the Fluent source; the scorer notes that a
stricter reading "would flip `passes_gate` to no" and declines it, because the seed's own phrasing
is source-agnostic and the code needs no editing. Flagged, not smoothed — but not counted as a
rubric gap.

**Row 02 — native, seed 01 — 6/6, gate 1, `ambiguous = no`.** Same shape. Fix 1 gives the current
line verbatim, the replacement code, the insertion point, and a five-word map matching what the
tool description advertises; ES5, guards the unmapped case, preserves the IIFE return convention.
**The same runtime-record-vs-Fluent-source judgment call is recorded and resolved in the run's
favour**, this scorer explicitly reasoning that the rubric's own worked example of an unusable fix
is a substantively wrong-target fix, not a wrongly-addressed correct one — hence `ambiguous = no`
with the reasoning on the record.

**Row 03 — native, seed 03 — 6/6, gate 1, `ambiguous = yes` (two).** RC-1 PRIMARY, layer "5 —
Data", `x_snc_tsbench_routing`, "the table exists and is structurally correct, but contains zero
rows", and it passes the discrimination test the seed is built around: `verdict:
genuinely_empty`, not an ACL-denied read. Ambiguities: **(1)** does the spec's "a diagnosis naming
the tool or the query is a miss" condemn *secondary* layer-3 causes explicitly marked non-causal?
Resolved no; the other reading takes the row to 1/6 and flips the gate. **(2)** does a
`<correct group name>` placeholder in a data-seeding fix break "applied as written"? Resolved no;
the other reading takes `fix` to 0 and **flips the gate**. The scorer escalated (2) as a rubric
defect needing one line of clarification.

**Row 04 — native, seed 03 — 6/6, gate 1, `ambiguous = yes` (three).** **(1)** the same "naming
the tool is a miss" question, literal vs attribution reading — resolved on attribution; the scorer
records that the other reading drops `ftc` to 0 and, via §A's cross-column constraint, forces
`fix` to 0, "which *would* flip the gate", and calls it "gate-material … should be resolved in the
spec text". **(2)** "root cause cites BOTH" read per-RC or document-level, with four root causes
present — resolved document-level. **(3)** the `<the correct group name>` placeholder — resolved
to 1, "the missing datum is business content no diagnosis could recover".

**Row 05 — native, seed 04 — 6/6, gate 1, `ambiguous = yes` (one).** RC-1 PRIMARY "Dangling
capability `api` binding", layer 6, `api = 00000000000000000000000000000000` against
`api_type = sys_hub_flow` resolving to no row. **Decoy not taken** — the word `connection` appears
nowhere in its root-cause or fix sections. Evidence cites `genai_log check_config` and
`agent_trace`, both corroborated by audit rows. Ambiguity: `fix_usable_unedited` where the target
is exactly right but the replacement *value* is under-specified — a case §A2 and the seed note
address only in the wrong-target direction. Resolved 1; the scorer states plainly that "this
single undetermined column is the difference between a pass and a fail on this row".

**Row 06 — native, seed 04 — 6/6, gate 1, `ambiguous = yes` (one).** Same defect, same decoy
avoided. Ambiguity: Fix 1 names the target record, field, current value and required semantics
exactly, but supplies the replacement sys_id as a *description* plus a three-step discovery
procedure whose step 1 is a UI action. Resolved 1 — the rubric's stated rationale for the column
is wrong-target no-ops, not value specificity, and the `REPLACE_WITH_..._SYS_ID` placeholder
pattern is the project's own documented norm. The scorer records that the strict reading gives
`fix=0, total=5, passes_gate=no`, "so the gap is outcome-changing for this row".

**Row 07 — custom, seed 01 — 1/6, gate 0, `ambiguous = yes` (one).** Declares layer 4, but its
finding is that `sn_tsbench_bench_ticket` does not exist — a table appearing nowhere in the seed
and not on the instance — and it never mentions integer typing, the word-valued write, or any
disagreement. The M18 note's lenient boundary requires at least one correct side; this reaches
none. `rcl = 0`. The proposed fix repoints a "ticket field" at `incident`, which the scorer calls
"wrong area, wrong target, and actively harmful". `fix = 0` twice over — §A's cross-column
constraint, and `fix_report` is `null`. Ambiguity: `evidence_cites_trace_and_config`, where the
disqualifying defect is a JSON enum spelling (`"schema_lookup"` for `"schema"`) rather than a
diagnostic omission; resolved 1, no gate impact either way.

**Row 08 — custom, seed 01 — 2/6, gate 0, `ambiguous = yes` (one).** Four root causes, the first
at layer 1 ("`priority_stored` field is null despite successful execution"), the other three at
layers 6, 5 and 7 whose "findings" are that the run did not inspect those layers. Rejected on
three unsupported citations. Ambiguity: the `fix_target_correct` 0-vs-1 band for a run that is "in
the right area but proposes a specifically wrong change inside it" — a case the 1 band's single
clause does not distinguish from under-specification. Resolved 1; no gate impact.

**Row 09 — custom, seed 03 — 1/6, gate 0, `ambiguous = yes` (one).** Root cause at layer 1;
`UNCONFIRMED`, with `would_confirm` reading "layer 5 — query_table against routing rules table".
The seed's layer is 5. `query_table` was attached and active and was simply never called.
Ambiguity: `fix_target_correct` at the 0-vs-1 boundary for an internally inconsistent fix entry
(structured `target` names a tool-layer object, `proposed`/`rationale` name the data). Resolved 1;
blast radius none. The scorer flags for the aggregator, without penalising it, that the HOLD "was
answered with a `schema_lookup` on `incident.assignment_group` — a layer-4 call unrelated to the
routing defect [that] served to satisfy the ranked-layer requirement rather than to advance the
diagnosis."

**Row 10 — custom, seed 03 — 3/6, gate 0, `ambiguous = yes` (one).** Highest custom total.
`fix_target_correct = 2` — `target_type: "data"` matches the expected data-seeding target exactly
— but the root cause is still filed at layer 1 and both evidence entries are `source: "trace"`, so
`ev = 0`. Ambiguity: `fix_usable_unedited`'s unstated specificity threshold; resolved 1 on the
ground that the missing values are unconstrained by the seed and the table name is a blind-rule
token withheld from the agent. No gate impact. The scorer's closing note: "The run was one
`query_table` call from a correct diagnosis. It did not make that call, and 'almost reached layer
5' is not 'named layer 5'."

**Row 11 — custom, seed 04 — 1/6, gate 0, `ambiguous = yes` (one).** Root cause at layer 1,
`UNCONFIRMED`, `would_confirm` "layer 6 — genai_log to inspect capability configuration"; the seed
is layer 6 and `genai_log` was never called. `ftc = 1` partial — right area (the capability
definition record), wrong category label (`"tool schema"`), no value, decoy `connection` carried
alongside `api` at equal weight. `fix = 0`: `current` reads "unknown (requires genai_log
inspection)", which is an instruction to investigate, not a change. Ambiguity: the `ftc` 0-vs-1
band on a seed that defines no partial case; resolved up to 1, no gate impact.

**Row 12 — custom, seed 04 — 1/6, gate 0, `ambiguous = no`.** Root cause at layer 1, layer 6
declared `NOT_SWEPT` in the run's own report. `ftc = 0` — "tool schema" is a different enumerated
category from "capability mapping", not an under-specified version of it. `ev = 1` on the plain
reading: both a `trace` and a `schema` citation are present and the schema one is backed by a real
`schema_lookup`. The scorer considered scoring it 0 because the cited schema fact is irrelevant to
the seeded defect, and rejected that reading from the rubric's own text — `fix_usable_unedited`
carries an explicit correctness clause and this column deliberately does not. Recorded as a stated
resolution rather than a rubric gap.

### 4.2 The ambiguity tally, both ways

**Nine of twelve rows flagged `ambiguous = yes`** — against a pre-registered prediction of at most
two. On the narrower reading the prediction's own words invite — rows whose **`passes_gate`** was
under-determined — the count is **four** (rows 03, 04, 05, 06), because every custom row's gate is
decided by `root_cause_layer_correct = 0`, which no custom scorer flagged. Both readings are below
the predicted ≥10-of-12 unambiguous.

And the narrower count is itself generous. Rows 01 and 02 each record a judgment call on
`fix_usable_unedited` that their own scorers say would flip the gate, and resolve it as
*not a rubric gap*. Counting those, **all six native rows carry a recorded alternative reading of
`fix_usable_unedited` that yields 0** — see §5.

---

## 5. Sensitivity — what the totals and the gate survive

`fix_usable_unedited` is under-determined in two distinct ways across the native arm, and both
were recorded by the scorers themselves rather than discovered afterwards:

- **(a) Addressing.** Does a fix that names the runtime record (`sn_aia_tool`, field `script`)
  rather than the Fluent source count as applicable without editing? Rows 01, 02.
- **(b) Unrecoverable values.** Does a fix that names the target and operation exactly, but leaves
  a value no diagnosis could recover (`<correct group name>`, a provider-integration sys_id), count
  as applicable without editing? Rows 03, 04, 05, 06.

**Resolve all six against the run:**

| | totals | gate |
|---|---|---|
| As scored | native 36/36, custom 9/36 | native 6/6, custom 0/6 |
| Every native `fix_usable_unedited` resolved to 0 | native **30/36**, custom 9/36 | native **0/6**, custom 0/6 |

**The direction of the totals is robust; the gate is not.** 30 vs 9 still separates the arms by a
wide margin, and 30/36 is the *mild* end of the adverse band — row 03's first ambiguity alone
would take that row to 1/6. But §A2's gate consumes `fix_usable_unedited` as one of its two terms,
so a uniform adverse resolution of a single under-determined column takes the native gate from
100% to 0%.

**What is not sensitive:** custom's `root_cause_layer_correct = 0` on all six rows. No custom
scorer flagged that column as ambiguous; row 10's scorer explicitly listed it under "Not
ambiguous, for the record", and row 07's scorer considered a literal reading that would award 2
for the bare string `"4"` and rejected it from the seed spec's own text. Custom's 0/6 gate stands
under every resolution recorded in the twelve score files.

**§O5 recorded this defect and it was never closed.** That entry found the *same* column scored
inconsistently on the *same* `assignment_group` placeholder text across two v4 native rows, and
filed it "for whoever next revises §A". Nobody did. Rows 03, 04, 05 and 06 are that finding
recurring, in a pass whose result depends on it.

---

## 6. What this pass found in its own machinery

### 6.1 The blind-rule gate was green and blind to the real hole

`npx jest test/scorerPacketBlindRule.test.js` passed 11/11 **while two one-hop paths to the answer
key existed in packet framing**:

- `## 1. Scoring rubric (verbatim from `benchmark/scorecard-template.md`)` — and that template
  contains three `DECISION.md` references, including a literal "§O5 of `DECISION.md`".
- `## 2. Seed specification (verbatim, `benchmark/seeds/seed-0N-….md`)` — and `benchmark/seeds/` is
  the parent directory of `seeds/history/`, which holds prior runs' outcomes and grades.

Both were **written by the packet builder**, not inherited from source material, and both are
*shorter* paths to the answer key than the two-hop `IMPLEMENTATION_PLAN.md → DECISION.md` route the
builder flagged in its first-round concerns.

**The test was working exactly as written.** Its `answer-key-pointer` pattern matches a literal
`DECISION.md` and nothing else, so neither framing line could fire it. The gate scans the five seed
specs — one of the rule's three channels — and says the declared patterns did not fire on any spec.
It does not say the packets are blind, and the packet builder's report says so in those words.

Both paths were removed before scoring, along with every other repository path in every packet
(§6.2). **Recommendation carried to `DECISION.md` §T7: widen the `answer-key-pointer` pattern from
a literal `DECISION.md` to any repository path**, and run it over packets, not only specs. The
uniform rule is the one the builder adopted by hand and it is auditable by a single regex; the
test should enforce what the builder already did.

### 6.2 The shipped packets deviate from `scorecard-template.md` and from the seed specs

By **mechanical path redaction only**, in three sets. A future reader diffing a packet against
either source will find these and nothing else; anything not on this list is a defect, not a
deviation. Source files on disk were never written — `benchmark/seeds/`,
`benchmark/scorecard-template.md`, `src/` and `test/` show 0 changes.

**Set A — the rubric (§1 of every packet), four substitutions:**

| # | Removed | Replacement |
|---|---|---|
| A1 | ``the evidence rule from `docs/agent/agent-doctor-instructions.md` `` | `the evidence rule from the diagnostic agent's own instructions` |
| A2 | ``It was 0-or-2, while `seeds/seed-05-inactive-usecase.md` instructs the scorer to award *partial*`` | `It was 0-or-2, while seed 5's specification instructs the scorer to award *partial*` |
| A3 | ``The gate in `docs/IMPLEMENTATION_PLAN.md` Task 12 counts **runs**:`` | `The gate counts **runs**:` |
| A4 | ``The `IMPLEMENTATION_PLAN.md` Task 12 bands are`` | `The Task 12 bands are` |

A3 drops the "Task 12" label from that clause only; it survives twice later in the same section.

**Set B — the builder's own framing text**, the two one-hop paths of §6.1:

| Removed | Replacement |
|---|---|
| ``## 1. Scoring rubric (verbatim from `benchmark/scorecard-template.md`)`` | `## 1. Scoring rubric` |
| ``## 2. Seed specification (verbatim, `benchmark/seeds/seed-0N-….md`)`` | `## 2. Seed specification (in full; repository paths redacted — see the note in section 1)` |

**Set C — the seed specifications (§2 of every packet).** Common to all three specs:
`` `cd benchmark/seed-app && now-sdk install --alias gpinst01` `` →
``run `now-sdk install --alias gpinst01` from the fixture app directory``; and
`` `../../test/blindRule.test.js` `` → `the blind-rule guard test`.

*Seed 01, four more:* `` `../seed-app/src/fluent/seed-01-schema-mismatch.now.ts` `` (×2) → `this
seed's Fluent definition file`; `` `seed-app/dist/` `` → `the fixture app's build output`;
``(verified in `dist/`)`` → `(verified in the build output)`;
`` `seed-app/src/fluent/seed-tables-acl.now.ts` grants record ACLs `` → `the fixture app's ACL
definition file grants record ACLs`.

*Seed 03, two more:* `` `../seed-app/src/fluent/seed-03-missing-data.now.ts` `` → `this seed's
Fluent definition file`; `` `seed-app/src/fluent/seed-tables-acl.now.ts` grants the read ACL `` →
`The fixture app's ACL definition file grants the read ACL`.

*Seed 04, seven more:* `` `../seed-app/src/fluent/seed-04-genai-unmapped.now.ts` `` → `this seed's
Fluent definition file`; ``hardcoded in `seed-app/src/fluent/seed-04-genai-unmapped.now.ts` `` →
`hardcoded in this seed's Fluent definition file`; `See **DESIGN.md R-22**.` → `See **the design
contract, ruling R-22**.`; `LLD §8 item 8 and DESIGN.md R-22.` → `LLD §8 item 8 and the design
contract's ruling R-22.`; ``(see `.claude/context/sdk-examples/now-assist-skill.now.ts`)`` → `(see
the Now Assist skill golden example)`; ``See `../scorecard-template.md` §A2:`` → `See the scoring
rubric §A2:`; `` `allowWebServiceAccess` in `seed-app/src/fluent/seed-tables-acl.now.ts` `` →
`` `allowWebServiceAccess` in the fixture app's ACL definition file ``.

**Deliberately left in place**, because they are labels rather than navigable paths: `LLD §7/§8`,
`Task 12`, Build Rules `#33`/`#42`, rulings `R-4`, `R-6`, `R-11`, `R-18`, `R-19`, `R-22`, `M18`,
`PR #33`; the ServiceNow REST endpoint in seed 04's Setup step 2; and `x_snc_tsbench_ticket` inside
rows 05/06's own verbatim reports (a seed-01 blind-rule token appearing legitimately in a seed-04
agent's report — removing it would mean editing a verbatim report, a worse defect than the one it
would fix).

**Verified lossless.** Reversing only the declared substitutions restores each source seed spec
**byte-for-byte** (round-trip proof, seeds 01/03/04), and structural conservation was checked
independently — line, heading, table-row, bullet and fence counts all identical to source. A lossy
edit could not round-trip. The rubric block is byte-identical across all twelve packets (one
distinct value, 7,664 chars). A repo-path regex sweep over the whole of all twelve packets returns
0 hits. Every packet carries a disclosure note telling the scorer a redaction happened.

**Every packet also inherits seed-04-specific text**, because §A2 explains the
`fix_target_correct` constraint using seed 4's decoy by name and §A3's void rule names seed 4's
capability sys_id. That follows directly from "verbatim and identical in all 12" and from
`benchmark/README.md`'s own model of the rubric channel. Noted, not acted on; it cannot affect a
seed-01 or seed-03 verdict.

### 6.3 The native arm never writes a terminal status onto its run anchor

All six native anchors (TR1000156–161) were left at `status: running` after their agent executions
reached `completed`. **A scorer or tool reading `status` off a native anchor would misread it.**
The custom arm's `x_snc_troubleshoot_run.status` is authoritative; the native arm's is not.
Terminal state for every native row in this pass was read from `sn_aia_execution_plan.state`
instead, and the packets say so. Recorded, not fixed.

---

## 7. What this evidence does not establish

- **No rate.** Twelve rows, three seeds, one instance, one day, one model, one deployed version.
  Two reps per seed per arm measures a flip, not a frequency.
- **The precise totals are not stable.** §5: one under-determined rubric column moves native
  between 36/36 and 30/36 on totals, and between 6/6 and 0/6 on the gate. Quote the direction;
  do not quote 36 vs 9 as though it were a measurement of the same order as the tool counts.
- **Nothing about seeds 02 and 05.** Out of scope, unchanged since §Q6.
- **Nothing about whether layer 6 is reachable.** No custom run called `genai_log`. §R4 established
  the gate cannot target layer 6 within `MAX_HOLDS: 2`; this pass confirms the consequence and does
  not test the premise.
- **No like-for-like comparison to any prior pass.** §R5 records how easily the declared/ranked
  split inverts by construction, and this pass ran a different seed set from §O's. Nothing here
  licenses "the custom harness got better/worse than v4".
- **`layers_swept` is unadjudicated** (§3.3) and `continuous_tool_execution_limit` was not read
  (§2.1).
- **The blind-rule residual is not mechanically proven.** The checks in §6.1–§6.2 are string
  checks. They cannot prove that a sentence the packet builder wrote in a per-row note is free of
  implied judgement; that risk was mitigated by construction (notes written only from provenance
  facts) but not proven.
