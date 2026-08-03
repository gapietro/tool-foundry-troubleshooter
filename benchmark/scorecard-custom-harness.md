# Scorecard — Custom Harness (Task 10, Phase 1b comparison re-run)

> **This file now carries TWO custom-harness measurements.** The Task 10 pass (10 rows,
> version 2026.08.0216, 0/10) is preserved below exactly as filed. A second pass
> (10 rows, version 2026.08.0218, after the #72 observation-channel work and the #77
> target fix) is appended in § "Custom harness scorecard — v2". Neither supersedes the
> other; the difference between them is itself evidence, and is read in `DECISION.md` §H.
> The native rows in this file were **not** re-measured for the v2 pass.

Filled 2026-08-02, `gpinst01`, per `benchmark/README.md` "The Phase 1b comparison re-run
protocol". Copied from `scorecard-template.md`; the template's core scoring contract — §A rubric,
§A2 gate rule, §A3 void handling, §E audit-derivation discipline — is preserved below verbatim.
**§B is summarized, not reproduced, and this file's `cause_of_death` values depart from its closed
vocabulary** (`completed | tool_limit | context | supervision_stall | security | wandered |
genai_down`, all native-terminal-state concepts): the custom harness has no equivalent taxonomy of
its own, so its rows below use free text describing the actual terminal condition
(`PaFixReport.validate` rejection vs. a self-terminated "premature" completion) rather than forcing
a fit to a vocabulary built for the native ReAct engine's failure modes. Native's rows in this file
use the template's `cause_of_death` values unchanged.

**Scope of this file, per the protocol's asymmetry (deliberate, not an oversight):**

- **Custom harness: full 10 rows** (§ "Custom harness scorecard" below) — never scored before
  Task 10, every seed measured fresh.
- **Native harness: 10 rows for the comparison total** (§ "Native harness — comparison rows"
  below) — **2 new** seed-02 rows (v2 construction, fired fresh this task) **+ 8 standing** rows
  for seeds 01/03/04/05, carried over verbatim from `scorecard-agent-doctor.md` (Task 12) with
  their provenance marked, per the protocol's explicit ruling that re-running an unchanged seed
  measures model drift, not the harness.

**Preconditions re-verified live before any row was scored (Task 10, this file):**

- **Seed 4** — capability `x_snc_tsbench_unmapped_capability` (`92ff62af516741769c437feb88c80ef3`)
  confirmed present; its definition (`904c0485699a4a73a124446a7231c563`) confirmed
  `api_type=sys_hub_flow`, `api=00000000000000000000000000000000` (dangling), `connection` empty
  (decoy) — matches the primary construction exactly. **Not void.**
- **Seed 5** — `sn_aia_trigger_agent_usecase_m2m` (`ba30d8775b0c4cebb960c58830590d5d`) read
  **`active=false`** — Task 9's fixture-app reinstall reset it, exactly the risk that task's own
  concerns section flagged. **Fixed**: `PATCH .../ba30d8775b0c4cebb960c58830590d5d
  {"active":"true"}`, re-read and confirmed `true`. `sn_aia_trigger_configuration`
  (`bfb77d6c64884500a80203ee029436ee`) confirmed still `active=false` (the seeded defect, left
  alone). **Not void, after this fix.**
- **Seed 2 v2** — `sn_aia_agent_tool_m2m` for Seed 02 Request Router still shows exactly one
  active binding (`measure_request`, `max_auto_executions=10`), matching Task 9's finding. No
  execution of the v2 construction existed yet (Task 9 only ran the smoke gate, not seed 2
  itself), so a fresh seed execution was fired via `servicenow_aia_execute` against **Seed 02
  Request Router** (`cd050d48e810411d9f113fd530694fe6`) with input *"my laptop will not boot"* —
  execution `4b315ecc2b66c314f243fed2ce91bfca`. Confirmed via `sn_aia_execution_task`: the ReAct
  engine entered its loop (2 `gen_ai` sub-tasks, 1 `measure_request` tool call), refuting nothing
  about the v2 mechanism and giving both harnesses a real target to diagnose. This one execution
  feeds **both** the 2 new native rows and the 2 new custom rows below — same underlying evidence,
  same as the smoke gate's precedent of diagnosing one specimen from both harnesses.
- **Seeds 1/3/4 execution targets** — the Task 12 seed executions (`b07dc9082baa4314f243fed2ce91bf4b`,
  `c4cd01842b6a4bd417a6ffbeee91bfc3`, `16ddc10c2baa4314f243fed2ce91bf15`) were confirmed still
  present and `state=completed` on the instance, and reused as the custom harness's diagnostic
  targets (nothing about a stale historical execution record changes by re-diagnosing it — the
  smoke gate already established this pattern in Task 9). Seed 5's bench ticket
  (`29fd09c42b6a4bd417a6ffbeee91bfb0`) likewise confirmed still present and reused, handed to the
  custom harness via `agent`+`timeframe`+`description` fields (no execution plan exists for seed 5
  by design — nothing fires).

---

## A. The 6-point rubric

| Column | Points | What it scores |
|---|---|---|
| `root_cause_layer_correct` | 0 or 2 | Diagnosis names the seed's expected root-cause layer (see the seed's own spec file for the expected value) |
| `fix_target_correct` | 0, 1 or 2 | Diagnosis names the correct fix target (tool schema / instruction text / data seeding / capability mapping / activation). **1 = partial**: the right area, without the specific target |
| `evidence_cites_trace_and_config` | 0 or 1 | Root cause cites BOTH the execution trace AND at least one config/schema source that was **actually read** (a citation naming a source the audit trail shows was never called is a fabrication, not evidence — see the custom-harness findings below) |
| `fix_usable_unedited` | 0 or 1 | The Fix Report's proposed fix could be applied by the builder AI as written, with no manual editing first — **and it addresses the defect the seed actually carries.** `fix_usable_unedited` may not be 1 while `fix_target_correct` is 0 |

**Total: 6 points per run.**

## A2. `passes_gate`

```
passes_gate = 1  if and only if  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
              0  otherwise
```

Same rule as `scorecard-template.md`/`scorecard-agent-doctor.md`, unchanged for this comparison.

## A3. Void runs

Same void conditions as the template (seed 4 capability mismatch, seed 5 m2m gate off) — both
re-verified/fixed above before any row was scored. **No void rows in this file.**

## E. `layers_swept` — derived from the audit trail, not the run's own self-report

**Critical finding that drove how every custom row below is scored** (statement scoped to the
**Task 10 pass**; the v2 pass reached `agent_config` in 2 of 10 runs and is tabulated separately in
§ "Sweep self-report vs. audit — v2"): for **all 10 custom-harness
rows**, the run's own `fix_report.layers_swept` JSON frequently *claims* layers 2 and/or 3 were
`SWEPT` ("the agent_config tool was used to inspect the agent's instructions..."), but the
audit-derived tool roster (`x_snc_troubleshoot_audit` where `run=<run_id>^action_type=result`,
distinct `tool_name`) shows **`agent_config` was never called in a single one of the 10 runs** —
every run called only `agent_trace` then one page of `read_artifact`, then attempted (or failed
to produce) a `fix_report`. This is not a borderline judgment call; the tool list is empty of
`agent_config`/`schema_lookup`/`query_table`/`genai_log`/`log_analysis` for every row. Per R-20 the
audit trail wins over the model's own narration, so `layers_swept` for every custom row below is
**`1/7 (L1)`**, and any `evidence_cites_trace_and_config`/`fix_target_correct` citation of a
"config" or "schema" source in a custom row's report is scored as **fabricated, not satisfied** —
consistent with Task 7/9's own prior finding of the same "narrating a sweep it did not perform"
pattern on the smoke specimen, now confirmed as the harness's *systemic* behavior across all 5
seeds, not one specimen.

`layers_available` for the custom harness is read from `GET /tools`
(`PaToolRegistry.list()`) — **7/7**, all seven tools registered
(`agent_trace`, `agent_config`, `schema_lookup`, `query_table`, `genai_log`, `log_analysis`,
`read_artifact`). The gap above is entirely "did not look", never "could not look".

**Budget knobs — custom harness has no `sn_aia` equivalent.** The custom harness is not bound
by `sn_aia.continuous_tool_execution_limit` or `sn_aia_agent_tool_m2m.max_auto_executions` — its
own loop is governed by `PaAgentLoop.MAX_ITERATIONS = 15` and `BUDGET_MS = 300000` (read from
`src/server/PaAgentLoop.js`, not a live property). **No row approached either bound**: every run
used 2 tool calls and 3–4 LLM turns, completing in 5–14 seconds — the shallow sweep is a
reasoning-behavior choice, not a resource cutoff.

---

## Custom harness scorecard (10 rows — all fresh, Task 10)

`run_id` is the `x_snc_troubleshoot_run` sys_id directly (no conversation-id hop — the custom
harness owns its own run record). LLM-call count is `actor:'llm'` transcript entries.

| seed | run # | run_id | root_cause_layer_correct | fix_target_correct | evidence_cites_trace_and_config | fix_usable_unedited | total /6 | **passes_gate** | layers_swept (n/7, which) | layers_available (n/7) | cause_of_death | tool_calls | LLM calls | wall_clock | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | 1 | `648112c42ba2cbd417a6ffbeee91bfc2` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | n/a — status=`failed` (fix_report validation: root_causes[1] evidence rule violation, "no trace citation found") | 2 | 4 | ~10s | Never produced a valid report. Two draft attempts both rejected by `PaFixReport.validate`. Expected layer: `tool_schema`/3 (or 4, M18). No mention of the word→Integer mismatch anywhere. |
| 01 | 2 | `b88152c42ba2cbd417a6ffbeee91bff4` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | n/a — status=`failed` (evidence rule: "cites only the trace") | 2 | 4 | ~13s | Same pattern as run 1, independently. Consistent failure across the doubled run. |
| 02 | 1 | `8d8192c42ba2cbd417a6ffbeee91bf06` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature — 1 tool + 1 read_artifact page, then fix_report) | 2 | 3 | ~6s | Root cause: layer **1**, "permission DENIED reading `incident`" — **fabricated**: this seed never touches `incident`, and the evidence's own "config" entry admits *"was not explicitly checked due to heuristic attribution limitations"*. Expected layer 2 (instruction); not named. Fix: "update access roles" — wrong target entirely. |
| 02 | 2 | `dd81d2c42ba2cbd417a6ffbeee91bf37` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature) | 2 | 4 | ~9s | Three root causes (layers 1, 4, 3), none layer 2. Evidence cites fabricated ids not present anywhere on the instance (`TOOL-1234`, `SCHEMA-5678`, `TOOL-9012`) — invented placeholders dressed as real sys_ids/schema versions. |
| 03 | 1 | `31815e402ba6c314f243fed2ce91bfc4` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | n/a — status=`failed` (evidence rule + missing `fixes[0].proposed`) | 2 | 4 | ~14s | No valid report. Expected layer 5 (`genuinely_empty`) never reached — routing table never queried (`query_table` not called). |
| 03 | 2 | `06819e402ba6c314f243fed2ce91bf9f` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature) | 2 | 3 | ~6s | Root cause layer 1, "script stack error", with a `config`-sourced evidence entry ("Agent instructions or tool script contained invalid logic") — **fabricated**: audit confirms `agent_config` was never called. `layers_swept` self-report also claims L2/L3 `SWEPT` via agent_config — same refutation. Expected layer 5; not named. |
| 04 | 1 | `1a81d2c42ba2cbd417a6ffbeee91bf3e` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature) | 2 | 4 | ~10s | Three root causes (layers 1, 3, 4), each evidence entry literally labeled `"(hypothetical example)"` in the model's own text — an admitted fabrication, not a hedge. Expected layer 6 (`genai_stack`); never named. Never read the definition row's dangling `api`. |
| 04 | 2 | `6e819e402ba6c314f243fed2ce91bfa5` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature) | 2 | 3 | ~8s | Root cause layer 1, "script stack error", with a `config`-sourced evidence entry ("The agent_config tool showed the instructions and tool definitions are present.") — **fabricated**: audit confirms `agent_config` was never called. `layers_swept` self-report claims L2/L3 `SWEPT` on the same false basis. Never touched the decoy or the real defect — didn't reach layer 6 at all. |
| 05 | 1 | `8b8112802ba6c314f243fed2ce91bf08` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature) | 2 | 3 | ~5s | Root cause layer 1, "script stack error", with a `config`-sourced evidence entry ("The agent_config tool showed the instructions and tool definitions are present.") — **fabricated**: audit confirms `agent_config` was never called; text is near-identical boilerplate to seed 04 run 2, suggesting a generic fallback answer when there is no real execution trace to anchor to (seed 5 has none by design). Expected layer 7 (wiring/activation); never named, never saw the trigger. |
| 05 | 2 | `2b8112802ba6c314f243fed2ce91bff3` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature) | 2 | 3 | ~6s | Root cause layer 3, "Create Incident tool input schema, missing `short_description`", with a `config`-sourced evidence entry ("Agent_config revealed the tool schema requires 'short_description'...") — **fabricated**: audit confirms `agent_config` was never called, and **`Create Incident` is not a tool that exists anywhere in this seed's (or any seed's) configuration** — wholesale hallucination, unrelated to the actual agent/workflow. Expected layer 7; not named. |

**Gate tally — custom harness**

| | |
|---|---|
| Valid runs (not void) | **10** / 10 |
| `sum(passes_gate)` | **0** |
| Gate result | **0 / 10 (0.0%)** |
| Void runs and why | **None** — all five seeds' setup conditions confirmed valid (seed 4 capability match, seed 5 m2m gate fixed and re-read `true`) before scoring |

---

## Custom harness scorecard — v2 (10 rows, version 2026.08.0218, 2026-08-02)

**Second measurement of the same harness**, taken after two changes landed on
`fix/phase1b-observation-channel`: the #72 observation-channel work (Tasks 1–6, commits
`1448e58..e8e8496`) and the #77 fix for the lost diagnostic target (commits `822a570`, `37a3e70`,
released as `d318b10`). Installed to `gpinst01` as version **2026.08.0218**. The Task 10 rows above
are **unchanged and still stand** as the 0/10 baseline. Raw per-run evidence:
`.superpowers/sdd/2026-08-02-observation-channel/benchmark-raw-evidence-v2.md`.

### Protocol notes for the v2 pass

1. **Same rubric, same gate, same discipline.** Scored against §A, §A2, §A3 and §E above, unchanged.
   The Task 10 custom rows were **not consulted while scoring** — they cover a different set of
   `run_id`s. Where the two passes agree it is by arriving at the same evidence.
2. **The same five diagnostic targets as Task 10, reused verbatim.** Request bodies:
   seed 01 and 02 in `{"execution": …}` form against `b07dc9082baa4314f243fed2ce91bf4b` (seed 01),
   `4b315ecc2b66c314f243fed2ce91bfca` (seed 02, the v2 seed construction's execution fired in Task
   10), `c4cd01842b6a4bd417a6ffbeee91bfc3` (seed 03), `16ddc10c2baa4314f243fed2ce91bf15` (seed 04);
   seed 05 in `agent` + `timeframe` + `description` form naming bench ticket
   `29fd09c42b6a4bd417a6ffbeee91bfb0` (no execution plan exists for seed 05 by design). Doubled
   runs, executed **one at a time, sequentially, no parallelism**.
3. **Seed-fixture verification.** §A3's two void conditions are seed 4's capability mismatch and
   seed 5's m2m gate. Both were live-verified/repaired in the Task 10 preconditions recorded at the
   top of this file, and were **carried forward, not re-read, for this pass** — with one live
   re-confirmation inside the pass itself: the `agent_config` output captured in runs 9 and 10 reads
   `sn_aia_trigger_configuration` `bfb77d6c64884500a80203ee029436ee` as `active="0"`, the seeded
   defect, exactly as specified. Nothing in this pass disturbed either condition. **10 valid rows,
   0 void.**
4. **Native was NOT re-measured.** The native comparison rows below are untouched; native's
   **8 / 10** stands as recorded, and is the figure the v2 custom result is compared against. The
   two harness numbers therefore come from measurements taken on different days against the same
   seed fixtures.
5. **One known non-instance confound, on the record:** `PaFixReport.schemaText()`
   (`src/server/PaFixReport.js:542`) changed on this branch — the inconclusive path was added and
   the citation-per-swept-layer pricing was introduced — so the fix_report contract text the model
   is shown is **not identical** to the Task 10 baseline's. This was unavoidable (the contract text
   is part of the change under test) and is read in `DECISION.md` §H7.
6. **`cause_of_death`** uses the same free-text departure from §B's closed vocabulary as the Task 10
   custom rows, for the same reason.

### v2 rows (10)

`run_id` is the `x_snc_troubleshoot_run` sys_id. `layers_swept` is **audit-derived per §E**, not the
run's self-report; where the two disagree the self-report figure is given in `notes`. `wall_clock` is
the transcript-internal span (seq1 → terminal); queue latency before the LLM turn is recorded
separately below.

| seed | run # | run_id | root_cause_layer_correct | fix_target_correct | evidence_cites_trace_and_config | fix_usable_unedited | total /6 | **passes_gate** | layers_swept (n/7, which) | layers_available (n/7) | cause_of_death | tool_calls | LLM calls | wall_clock | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | 1 | `3b8b859c2bee8fd417a6ffbeee91bfe9` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | n/a — status=`failed` (`PaFixReport.validate`: evidence rule, "cites only the trace; at least one config, schema, or data citation is required") | 1 | 3 | ~13s | No report delivered — API `fix_report` is null. Discarded last attempt named layer **1** ("task count 27 ≠ tool call count 19") — a trace-arithmetic artefact, not a defect. Expected layer 3 (or 4, per seed-01 M18). The word→Integer priority mismatch is not mentioned anywhere; `priority_stored: null` in the trace was never read. Proposed fix is "add a clarification note that task_stats and tool_call_stats measure different metrics" — documentation, targeting nothing in the seed. Self-report `layers_swept` 1/7, consistent with audit. |
| 01 | 2 | `100c89102b22cfd417a6ffbeee91bf42` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature — 1 tool call, then fix_report) | 1 | 2 | ~5s | Same wrong layer 1 / same task-vs-tool-count artefact as run 1, independently. Fix target `context_processing_script` — "add validation to ensure task count matches tool call count" — is not a seed artefact. **FABRICATED EVIDENCE:** `root_causes[0].evidence[1]` cites `source:"config"`, detail *"agent_config showing task-to-tool mapping logic"*, and `layers_swept` 2/3/7 all claim SWEPT "via agent_config" — the audit trail for this run_id contains **one** record, `agent_trace`. `agent_config` was never invoked. Self-report claims 4/7 swept; **3 of those 4 are false claims**. Validation passed anyway — the validator checks source *labels*, not whether the source was read. |
| 02 | 1 | `7c3c4d502b22cfd417a6ffbeee91bf47` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed — **inconclusive path** (validated) | 2 | 3 | ~5s | **Inconclusive: names no root cause**, `root_causes: []`, `fixes: []` — cannot score root-cause, fix-target or fix-usability by construction, and no root cause exists to carry a trace+config citation. Expected layer 2 (instruction: "assign it to the right group" names no group and no means of determining one); the instruction text was never fetched (`agent_config` not called). `inconclusive.evidence_read` = 3× `source:"trace"`, **all audit-supported** by the `agent_trace`+`read_artifact` pair. `needed_to_conclude` blames "layer 7 unavailable due to cross-scope restrictions" — a limitation it never tested; all 7 tools are registered and reachable. Self-report claims 2/7 (L1,L6); L6 ("Gen AI step metadata") rests on trace content, not a `genai_log` call — overclaim, though no uninvoked tool is named. |
| 02 | 2 | `c66c01142b6ac714f243fed2ce91bf8e` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | n/a — status=`failed` (`PaFixReport.validate`: `inconclusive.evidence_read[4..6]` invalid `source:"tool"`; `fixes[0]` missing `proposed`) | 2 | 4 | ~8s | No report delivered. Attempted the inconclusive path and failed validation. **FALSE SWEEP CLAIM — the worst in the pass:** self-report marks **all 7 layers SWEPT** on **two tool calls**, both of which are reads of the same execution trace (`agent_trace`, then one `read_artifact` page). Layers 2–7 are claimed swept via "configuration/schema/data/tool-definition/GenAI-stack/trigger validation" with no config, schema, data, or GenAI tool ever invoked. **6 of 7 `inconclusive.evidence_read` entries** cite `config`/`schema`/`data`/`tool` sources that no tool call backs. Internally inconsistent as well: `fixes[0]` has empty `current` **and** empty `proposed` with rationale "No changes required as execution completed successfully" — a fix entry proposing nothing. Expected layer 2; never named. |
| 03 | 1 | `3fac45142b22cfd417a6ffbeee91bfcd` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed — **inconclusive path** (validated) | 1 | 2 | ~3s | **Inconclusive: names no root cause.** Expected layer 5 — `x_snc_tsbench_routing` holds zero rows and the tool reports it honestly (`matched:false`, `rules_in_table:0`, a real GlideAggregate count). That signal was sitting in the trace it read and was not acted on; `query_table` was never called. `inconclusive.evidence_read` = 2× `source:"trace"`, **both audit-supported**. `needed_to_conclude` asks for "further analysis of agent configuration or trigger wiring" — the run could have done exactly that with the registered tools and stopped instead. Self-report 1/7, consistent with audit. |
| 03 | 2 | `ebdc41942b6ac714f243fed2ce91bff1` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature) | 2 | 3 | ~6s | Root cause claimed at layer **1** ("lookup_routing_rule tool call — no routing rules found for 'Hardware'"). Expected layer **5**. The finding brushes past the empty table but attributes it to the tool and fixes the tool: `target_type:"tool schema"`, `target:"lookup_routing_rule tool definition"`, proposed "add post-processing to handle zero matches gracefully". Seed 03's spec is explicit — *"A diagnosis naming the tool or the query is a **miss**"* — the tool is correct, the table is empty, and the fix is data seeding. Not a near-miss: the proposed fix would suppress the only honest signal the seed emits. **FABRICATED EVIDENCE:** `evidence[1]` `source:"config"`, *"agent_config confirmed tool schema expects category input"*, plus `layers_swept` 2/3 SWEPT "via agent_config" — audit shows `agent_trace` and `read_artifact` only; `agent_config` never invoked. Self-report claims 4/7; 2 are false claims and L6 is an overclaim on trace metadata. Also internally inconsistent: layer 5 is `NOT_SWEPT` with reason *"Data existence confirmed via read status in trace"* — an affirmative confirmation attached to a not-swept layer, on the one layer that held the answer. |
| 04 | 1 | `e21d4dd42b6ac714f243fed2ce91bf2d` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed — **inconclusive path** (validated) | 1 | 2 | ~4s | **Inconclusive: names no root cause.** Reports the execution "completed successfully with no errors … normal tool and LLM latencies". The seed execution's actual signature is `OneExtendUtil.execute` returning `status:"error"`, "Plan invalid…", `capabilities:{}`, and the tool returning `ok:false` — a failure summarised as a success. Expected layer 6 (capability definition's `api` = all-zeros, resolving to no `sys_hub_flow`); `genai_log` never called, the definition row never read. `inconclusive.evidence_read` = 3× `source:"trace"`, **all audit-supported**, and `layers_swept["2"]` honestly states "agent_config not required" rather than claiming a sweep. Self-report 1/7, consistent with audit. |
| 04 | 2 | `b44d4d182b6ac714f243fed2ce91bf99` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed — **inconclusive path** (validated) | 1 | 2 | ~4s | **Inconclusive: names no root cause.** Same "completed successfully with no errors" reading of a failing execution as run 7. Expected layer 6; never approached. `inconclusive.evidence_read` = 2× `source:"trace"`, **both audit-supported**; no uninvoked tool named anywhere. **Internally inconsistent:** top-level `verification` is an **empty string**, on a report the validator passed — run 7, same seed, same execution, same inconclusive shape, carries verification text. Self-report 1/7, consistent with audit. |
| 05 | 1 | `a66d01182b22cfd417a6ffbeee91bf28` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L7) | 7/7 | n/a — status=`failed` (`PaFixReport.validate`: evidence rule, "no trace citation found; a candidate resting on config/schema/data alone is not a confirmed root cause") | 2 | 4 | ~13s | **No report delivered — API `fix_report` is null, `status=failed`.** Scored 0 on that basis: the rubric scores the diagnosis and the Fix Report the harness emits, and this harness emitted neither. **This is the most consequential row in the pass, and it must not be read as the run being wrong.** The discarded last attempt names layer **7**, component `sn_aia_trigger_configuration`, finding "Trigger configuration inactive", with a fix of `sn_aia_trigger_configuration.sys_id=bfb77d6c64884500a80203ee029436ee`, `current:"active=false"` → `proposed:"active=true"` — the seed's expected layer **and** its specific gate, the full-credit answer per seed-05's "two gates" rule. Both `config` evidence items are audit-supported against the real `agent_config` output. It was rejected for a **structural** reason: every evidence item was `config`-sourced and the validator requires ≥1 `trace` citation — and no trace exists for this seed *by design* (nothing fired). The evidence rule that catches run 1's trace-only report also destroys the pass's only other correct diagnosis, from the opposite side. See issue #78. Independent of that: `layers_swept` 2/3/7 are all `SWEPT` with an **empty-string `reason`** — an internal inconsistency unique to this run — and layers 2/3 are unbacked: the only `agent_config` call requested `section:"triggers"`, which returns no instructions or tool definitions. |
| 05 | 2 | `61bd09d82b6ac714f243fed2ce91bfae` | **2** | **2** | **1** | **1** | **6** | **1** | 2/7 (L1,L7) | 7/7 | completed | 2 | 3 | ~6s | **The only passing row in the pass.** Root cause layer **7**, `sn_aia_trigger_configuration`, "Trigger inactive" — the expected layer. Fix names the **specific gate**: `target = sn_aia_trigger_configuration.sys_id=bfb77d6c64884500a80203ee029436ee`, `current:"0"` → `proposed:"1"` — full fix-target credit per seed-05's rule that a generic "the use case is inactive" scores only 1. Evidence cites **both** a `config` source (the real `agent_config` output, `active:"0"`, `condition:"short_descriptionISNOTEMPTY"`) **and** a `trace` source (`agent_trace`'s genuine-absence result — no `sn_aia_execution_plan` row), and the audit trail confirms **both tools were actually invoked** — no fabrication anywhere in this report. Fix is applicable unedited (a single PATCH of a named record's named field to a named value) and addresses the seeded defect. Two caveats recorded, neither costing a rubric point: (a) the **m2m gate was never checked**, so the diagnosis is right without having ruled out the second gate — seed-05's partial band is about naming the specific gate, which it does; (b) `layers_swept` 2/3 claim SWEPT "via agent_config" on a `section:"triggers"` call that returned neither instructions nor tool definitions — an overclaim, distinct in kind from runs 2/6 (the named tool *was* invoked here), hence audit-derived 2/7 rather than the self-reported 3/7. |

**Gate tally — custom harness, v2**

| | |
|---|---|
| Valid runs (not void) | **10** / 10 |
| `sum(passes_gate)` | **1** |
| Gate result | **1 / 10 (10.0%)** |
| Rubric points | **6 / 60** (all 6 from seed 05 run 2) |
| Band (proportional, §A3) | **Bottom (< 50%)** |
| Void runs and why | **None** — §A3's seed-4 capability and seed-5 m2m gate conditions both hold; seed 5's trigger reads `active="0"` in live `agent_config` output, as specified |
| Per-seed pass/fail | 01 **0/2** · 02 **0/2** · 03 **0/2** · 04 **0/2** · 05 **1/2** |
| Prior custom-harness measurement (Task 10, version 2026.08.0216) | **0 / 10 (0.0%)**, 0/60 rubric points — preserved above |

### Tool reach — v2

`agent_trace` ran first in all 10 runs. Everything beyond it:

| Tool | Runs | Count |
|---|---|---|
| `read_artifact` | 3, 4, 6 | 3 |
| `agent_config` | 9, 10 | 2 |
| `schema_lookup` | — | **0** |
| `query_table` | — | **0** |
| `genai_log` | — | **0** |
| `log_analysis` | — | **0** |

Tool-call distribution: **5 runs made 1 call, 5 runs made 2, 0 runs made 3 or more** (mean 1.5).
`layers_available` is 7/7 — all seven tools registered and reachable, per `GET /tools`. **Four of the
seven were never invoked in any of the ten runs**, and `read_artifact` is a second page of the same
trace, not a second layer, so eight of ten runs are single-source. Seeds 01, 03 and 04 each hide
their answer behind one of the four never-called tools (`schema_lookup` for the Integer column,
`query_table` for the empty routing table, `genai_log` for the dangling `api`). The two runs that
reached a second *layer* (`agent_config`, runs 9–10) are the two that produced the pass's only
correct diagnoses — a one-to-one correlation across the pass.

**Not budget-limited.** `PaAgentLoop.MAX_ITERATIONS` is 15 (`src/server/PaAgentLoop.js:114`) and
`BUDGET_MS` is 300 000 (`:115`); the deepest run used **2 of 15 iterations** and ~13s of a 300s
budget. Transcript-internal spans were 3–13s (median ~5.5s). Terminal status was observed 210–660s
after POST — that latency is queueing before the LLM turn, not reasoning.

**Target acquisition:** 8 of 10 first calls carried the real target (Task 10's rows carried none —
see `DECISION.md` §H2). Runs 9 and 10 did not: with no `execution` field in the seed-05 request,
both passed the **bench ticket sys_id**, lifted from the description prose, to `agent_trace` as if
it were an execution-plan sys_id, then used the agent name on call 2. Both recovered, because
`agent_trace` reported the miss as a genuine absence rather than an error.

### Sweep self-report vs. audit — v2 (§E applied to this pass)

| Run | Self-reported | Audit-derived | False claims |
|---|---|---|---|
| 1 | 1/7 (L1) | 1/7 (L1) | 0 |
| 2 | 4/7 (L1,2,3,7) | 1/7 (L1) | **3** (L2,L3,L7 — all "via agent_config", never called) |
| 3 | 2/7 (L1,6) | 1/7 (L1) | 0 named-tool fabrications; L6 is an overclaim on trace metadata |
| 4 | **7/7** | 1/7 (L1) | **6** (L2–L7, on two trace reads) |
| 5 | 1/7 (L1) | 1/7 (L1) | 0 |
| 6 | 4/7 (L1,2,3,6) | 1/7 (L1) | **2** (L2,L3 — "via agent_config", never called); L6 overclaim |
| 7 | 1/7 (L1) | 1/7 (L1) | 0 |
| 8 | 1/7 (L1) | 1/7 (L1) | 0 |
| 9 | 3/7 (L2,3,7) | 1/7 (L7) | L2,L3 unbacked — the sole `agent_config` call requested `section:"triggers"` |
| 10 | 3/7 (L2,3,7) | 2/7 (L1,L7) | L2,L3 overclaimed on the same `section:"triggers"` call; named tool *was* invoked |

**11 layer-sweep claims across 4 runs name a tool that was never invoked**, and 4 more (runs 9–10,
layers 2–3) name a tool invoked for a different section than the claim requires. Six of ten runs
report a sweep no wider than the audit supports — up from zero such runs in the Task 10 pass.

### fix_report validation outcomes — v2

| | |
|---|---|
| Produced and validated | **7** — runs 2, 3, 5, 6, 7, 8, 10 |
| Failed validation (`fix_report` null, `status=failed`) | **3** — runs 1, 4, 9 |
| Took the inconclusive shape | **5** — runs 3, 5, 7, 8 (validated) and run 4 (failed validation) |

Failure reasons: the **evidence-diversity rule fired in opposite directions on two runs** — run 1
rejected for citing *only* `trace`, run 9 rejected for citing *only* `config` on a seed that
produces no trace by design (issue #78) — and run 4 failed on an illegal `source:"tool"` enum value
plus an empty `fixes[0].proposed`.

**Validator coverage gap, measured.** The rule checks that evidence *labels* are diverse and legal;
it never checks whether the labelled source was read. Runs 2 and 6 passed validation on a
`config`-labelled item attributing a finding to `agent_config`, a tool neither run invoked
(controller-verified directly against `x_snc_troubleshoot_audit`); run 9, whose `config` citations
were genuine reads, was rejected. Across this pass, **passing validation is uncorrelated with
citing evidence that was actually gathered** (issue #79).

**API/table disagreement, recorded because it affects what any consumer sees.** For all three failed
runs, `/runs/{run_id}` surfaces `fix_report: null` while a raw Table API read of
`x_snc_troubleshoot_run.fix_report` returns the rejected last attempt in full. The scores above
follow the API — that is what the harness delivers — but run 9's correct seed-05 diagnosis is
sitting in the table, discarded and retrievable.

---

## Native harness — comparison rows (10 rows: 2 new + 8 standing)

> **Not re-measured for the v2 custom pass** (2026-08-02, version 2026.08.0218). Nothing on the
> `fix/phase1b-observation-channel` branch touches the native harness, so these rows were left as
> filed for Task 10. The consequence for interpretation is recorded in `DECISION.md` §H7: the v2
> custom number and the native number below were taken on different days.

### New rows — seed 02 v2 (fired and scored fresh, this task)

`run_id` is `_agentic_context_.conversation_id` (`x_snc_troubleshoot_run.conversation_ref`).
LLM-call count via the corrected `sn_aia_gen_ai_m2m` linkage (Task 9): query the run's top-level
`sn_aia_execution_task` (`type=agent`, `order=100`), then count `sn_aia_gen_ai_m2m` rows keyed to
that task's sys_id.

> **These two rows were scored before the #89 blind-rule fix (`2026.08.0227`).** Two tool cores the
> native harness executes through `PaScriptToolAdapter` changed after both rows were filed:
> `src/server/tools/PaToolAgentConfig.js` (a note on the `instructions` section naming the smoke
> gate's specimen, and a `detail` restating `benchmark/README.md`'s reason for choosing it) and
> `src/server/tools/PaToolGenAiLog.js` (a `capability_unresolvable` `next_step` carrying seed 04's
> construction taxonomy). Both rows credit layer 2, and run 2 (`eed25e8c…`) cites *"`agent_config`
> (instruction text)"* in a root-cause entry directly — so its call returned the instructions section
> and the removed note travelled with it as a sibling key.
>
> **Both rows are now measured rather than reasoned** (#96): each called `agent_config` as
> `{"agent":"cd050d48…"}` with no `section`, and each recorded
> `sections_returned: ["overview","instructions","tools","triggers"]` (TR1000068, TR1000069). Run 2's
> prose citation is corroborated by its own tool output rather than standing alone as the evidence.
> The `PaToolGenAiLog` text reached neither row: run 1's single `genai_log` call ran
> `for_execution`, a mode that cannot raise `capability_unresolvable`, and run 2 never called
> `genai_log` at all. `DECISION.md` §N3–§N5.
>
> **No row is restated and no score movement is claimed.** The removed text named the **smoke gate's**
> specimen and the reason it was chosen, not any seed's answer: no scored seed's expected layer,
> component or fix appeared in it, and the smoke gate is a pass/fail gate rather than one of the
> scored rows. The reason to record this is reproducibility — these rows were measured against a
> version of a shared core that no longer exists. Full exposure analysis is in `DECISION.md` §M3; the
> annotation decision is in §M4, and the same note is on `scorecard-agent-doctor.md`'s standing rows.

| seed | run # | run_id (conversation_id) | root_cause_layer_correct | fix_target_correct | evidence_cites_trace_and_config | fix_usable_unedited | total /6 | **passes_gate** | layers_swept (n/7, which) | layers_available (n/7) | cause_of_death | continuous_tool_execution_limit | max_auto_executions | tool_calls | LLM calls | wall_clock | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02 | 1 | `1191de002ba6c314f243fed2ce91bf4d` | 2 | 2 | 1 | 0 | 5 | **0** | 5/7 (L1,L2,L3,L6,L7) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 11 | 8 | 232s | RC-3 names layer 2 CONFIRMED ("instructions name no tool and no output action") — matches the seed's expected diagnosis. RC-1 (primary) is layer 3 ("missing routing tool") — a real, correctly-evidenced co-finding, not a miss, per the same multi-root-cause precedent Task 12 used for seed 4. Fix 3 (instructions) uses a literal placeholder `[routing tool name]` — not appliable unedited → `fix_usable_unedited=0`. Also flags a real `active_tool_count=0` vs `binding.active="1"` discrepancy (UNCONFIRMED, advisory). |
| 02 | 2 | `eed25e8c2ba2cbd417a6ffbeee91bf48` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L2,L3,L7) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 9 | 6 | 178s | RC-2 names layer 2 CONFIRMED, evidence cites both the trace (Communicator task, empty `related_task`) and `agent_config` (instruction text) directly within the same root-cause entry. FIX-2 proposes concrete instruction text referencing a **named** tool (`route_request`) consistent with FIX-1's own proposed tool name — no placeholder gap, appliable as written → full credit. **This is the first run in the whole benchmark corpus (native or custom) that both names layer 2 AND produces a usable fix for it** — the v2 seed construction doing its job. |

**Doubled-run finding:** the two seed-02 v2 runs split exactly the way Task 12's seed-4 doubled runs
split — same diagnosis substance (both name layer 2/instructions as a confirmed root cause), but
one leaves an unfilled placeholder in its proposed fix text and the other doesn't. This is the
documented "inconsistent behavior on identical inputs" failure mode the doubled-run protocol exists
to catch, now observed on native's *fix-usability* axis rather than its root-cause axis.

### Standing rows — seeds 01/03/04/05 (carried over verbatim from `scorecard-agent-doctor.md`, Task 12; NOT re-run)

Per the protocol: these seeds' fixture Fluent source is byte-identical between Task 12 and now —
re-running them would measure model response drift on identical inputs, not the harness. Reproduced
here for the comparison total; **provenance: Task 12, `scorecard-agent-doctor.md`, not re-verified
by this task beyond the seed 4/5 gate checks recorded above.**

| seed | run # | run_id (conversation_id) | root_cause_layer_correct | fix_target_correct | evidence_cites_trace_and_config | fix_usable_unedited | total /6 | **passes_gate** | layers_swept | notes (abbreviated — see `scorecard-agent-doctor.md` for full) |
|---|---|---|---|---|---|---|---|---|---|---|
| 01 | 1 | `715e41c42b6a4bd417a6ffbeee91bf29` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L3,L4,L5) | Word→Integer mismatch found from both sides (M18 full credit) |
| 01 | 2 | `2fdf8d0c2baa4314f243fed2ce91bfa3` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L3,L4,L5) | Full structured fix incl. word→int map code, guard, test |
| 03 | 1 | `f3a2950c2baa4bd417a6ffbeee91bfb4` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L3,L5,L6) | `genuinely_empty` verdict confirmed by two independent reads |
| 03 | 2 | `e1c319c02b6e4314f243fed2ce91bf68` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L3,L5,L6) | Consistent with run 1. `layers_swept` corrected 5/7 → 4/7 (#96) — its `agent_config` call returned `["tools"]`, so L2 was not swept; see the source scorecard's row |
| 04 | 1 | `228411882b6e4314f243fed2ce91bf24` | 2 | 2 | 1 | 1 | 6 | **1** | 5/7 (L1,L3,L4,L5,L6) | Found dangling `api`, proposed the exact healthy repoint value |
| 04 | 2 | `ecc5dd482bea4bd417a6ffbeee91bf2d` | 2 | 0 | 1 | 0 | 3 | **0** | 6/7 (L1,L2,L3,L5,L6,L7) | Canonical decoy row (2/0/1/0) — named empty `connection` as primary cause |
| 05 | 1 | `1b37994c2b2e4bd417a6ffbeee91bf5a` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L2,L3,L7) | Named the specific gate, m2m verified intact |
| 05 | 2 | `d818dd4c2bae4314f243fed2ce91bf7c` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L2,L3,L7) | Consistent with run 1; anchor race observed and handled correctly |

**Gate tally — native harness (comparison total: 2 new + 8 standing)**

| | |
|---|---|
| Valid runs (not void) | **10** / 10 (8 standing, re-confirmed non-void via this task's seed 4/5 gate checks; 2 new, confirmed non-void) |
| `sum(passes_gate)` | **8** (7 standing + 1 new) |
| Gate result | **8 / 10 (80.0%)** — top band (≥ 80%) of the `IMPLEMENTATION_PLAN.md` Task 12 gate table |
| Void runs and why | **None** |

**Note on the native score moving from Task 12's 70% to this comparison's 80%:** the only
substantive change between the two measurements is seed 2's construction (v1 → v2, `DECISION.md`
§D2) — v1 was refuted (a zero-tool agent is cancelled before the LLM runs, so no run ever reached
layer-2 diagnosis; both Task 12 seed-2 rows scored 0 by construction). v2 lets the engine reach the
instruction defect, and native found it (1 of 2 runs, full credit). This is not native "getting
better" — it is the seed-2 confound being repaired, exactly as the protocol intended, and it is the
reason seed 2 is the one seed re-run for native at all. See `DECISION.md` §G for the full accounting
of what changed and why it is on the record rather than absorbed silently into the new percentage.

---

## Custom harness scorecard — v3 (10 rows, version 2026.08.0220, 2026-08-02)

**Third measurement of the same harness**, taken after the #78 / #79 evidence-validation branch
(PR #83) and the CHANGELOG entry (PR #84) landed on `main`. Installed to `gpinst01` as version
**2026.08.0220**. The Task 10 rows (0216) and the v2 rows (0218) above are **unchanged and still
stand**. Raw per-run evidence: `benchmark/raw-evidence-v3.md`.

This pass exists to answer **issue #82** — *did the 2026.08.0220 contract change make runs
shallower?* — which two unscored smoke runs raised at n=2 and could not settle.

### Protocol notes for the v3 pass

1. **Same rubric, same gate, same discipline.** Scored against §A, §A2, §A3 and §E above, unchanged.
2. **The deployed version was wrong when the pass opened, and was corrected first.** `sys_app.version`
   read `2026.08.0219`; the pass began with a clean `now-sdk build` + `now-sdk install` from `main`
   and re-verified `2026.08.0220` plus two content markers in the deployed code. Details and the
   reason `sys_updated_on` cannot be used for this check are in `raw-evidence-v3.md`.
3. **The same five diagnostic targets as v2, reused verbatim** — identical request bodies. Doubled
   runs, executed **one at a time, sequentially, no parallelism**.
4. **Seed-fixture preconditions re-verified live** before any row was scored (all six checks in
   `raw-evidence-v3.md`). **10 valid rows, 0 void.**
5. **Native was NOT re-measured.** Native's **8 / 10** stands as recorded. The §H7-4 different-day
   confound is therefore still open, deliberately: #82 asks a custom-vs-custom depth question, whose
   control is the 0218 custom rows, not native.
6. **`docs/agent/agent-doctor-instructions.md:48` was deliberately left unedited**, per §H7-5 — the
   categorical trace-plus-one rule still sits at prompt position #1 while the amended contract sits
   at prompt position #last. This pass measures the system as `2026.08.0220` actually shipped.
7. **Scoring was blind, and delegated to keep it that way.** The operator of this pass had read the
   v2 rows in full before the runs were fired, so scoring was dispatched to ten independent agents,
   each given the §A rubric, one run id, one seed spec, and the audit-derived tool roster — and
   explicitly barred from reading any scorecard, `DECISION.md`, `README.md` or `CHANGELOG.md`. The
   operator independently verified the audit derivation and re-read the highest-scoring row's report
   directly against its score.
8. **`cause_of_death`** uses the same free-text departure from §B's closed vocabulary as the earlier
   custom rows, for the same reason.

### v3 rows (10)

`layers_swept` is **audit-derived per §E**. `tool_calls` is the count of distinct tool invocations in
`x_snc_troubleshoot_audit`. `LLM calls` is `actor:'llm'` transcript entries. `wall_clock` is the
transcript-internal span (first entry → terminal).

| seed | run # | run_id | root_cause_layer_correct | fix_target_correct | evidence_cites_trace_and_config | fix_usable_unedited | total /6 | **passes_gate** | layers_swept | layers_available | cause_of_death | tool_calls | LLM calls | wall_clock | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | 1 | `75797d142baecfd417a6ffbeee91bf71` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | `failed` — rejected, unrepairable (two unsupported `config` citations) | 1 | 3 | 8s | Claimed layer **1**, "27 tasks vs 19 tool calls" — an artefact of the trace tool's own counters, not a defect. **FABRICATED EVIDENCE:** two entries cite `agent_config` output; audit shows `agent_trace` only. Caught by the new #79 check, which named the tool roster back to the model. Never saw `priority_stored: null`. Fix proposed: add a documentation note. |
| 01 | 2 | `9699fdd82baecfd417a6ffbeee91bfff` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | `complete` — **inconclusive path** (validated) | 1 | 2 | 4s | **Names no root cause.** Honest: only L1 claimed SWEPT, no fabrication. Its own NOT_SWEPT reasons are self-defeating — L4 skipped because "reads showed 'ok' status", L3 because there was no "explicit tool failure evidence" — which is exactly the silent-success shape this seed is built from. `needed_to_conclude` names `agent_config`; it never called it. |
| 02 | 1 | `9eb9b91c2baecfd417a6ffbeee91bf54` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | `complete` — **inconclusive path** (validated) | 1 | 2 | 4s | **Names no root cause.** Rules out layer 2 on trace evidence alone ("No configuration issues observed in the trace") — not evidence about instruction text. One `agent_config` call would have surfaced "assign it to the right group" against a lone `measure_request` tool. No fabrication. |
| 02 | 2 | `09d9f15c2baecfd417a6ffbeee91bf07` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | `complete` — **inconclusive path** (validated) | 1 | 2 | 4s | **Names no root cause.** `needed_to_conclude` reads "No further investigation required as execution completed successfully with no errors" — the harness treated absence of a hard error as absence of a defect, the precise blind spot seed 02 targets. No fabrication. |
| 03 | 1 | `20e9755c2baecfd417a6ffbeee91bfe8` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | `failed` — rejected, unrepairable | 1 | 3 | 8s | Claimed layer **1**, same task/tool-count artefact, elevated to `CONFIRMED` and duplicated as two identical root causes. **FABRICATED EVIDENCE:** both cite `config`; audit shows `agent_trace` only. The seed's answer (`matched:false`, `rules_in_table:0`) was in the trace it read; layer 5 dismissed as "Data existence not questioned in trace". |
| 03 | 2 | `8d0a75902b6a0b14f243fed2ce91bf0f` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | `failed` — rejected, unrepairable | 1 | 3 | 8s | Same wrong layer 1 / same artefact, independently. **FABRICATED EVIDENCE:** one `config` citation, audit-refuted. Never mentions the routing table, the empty read, or data at all. |
| 04 | 1 | `5b1a7d902b6a0b14f243fed2ce91bffd` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | `complete` — **inconclusive path** (validated) | 1 | 2 | 4s | **Names no root cause**, and reads a failing execution as a success: "completed successfully with no errors… normal LLM latency", where the real signature is `OneExtendUtil.execute` → `status:"error"`, "Plan invalid", tool `ok:false`. Every NOT_SWEPT reason is circular — the incorrect premise that execution succeeded justifies not looking. No fabrication. |
| 04 | 2 | `b22af99c2baecfd417a6ffbeee91bf28` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | `complete` — **inconclusive path** (validated) | 1 | 2 | 4s | **Names no root cause.** Same false-negative read as run 7, independently. L6 NOT_SWEPT reason — "no LLM errors were observed" — is self-justifying: the single channel it used is the one that hid the error. No fabrication. |
| 05 | 1 | `ee3a71dc2baecfd417a6ffbeee91bfe5` | **2** | **1** | 0 | 0 | **3** | **0** | 1/7 (L1 UNAVAILABLE) | 7/7 | `failed` — rejected by **mode B** ("cite at least TWO DISTINCT sources — found 0") | 1 | 3 | 7s | **The most consequential row in the pass.** Names layer **7**, the expected layer, reasoning correctly that with no execution plan the failure is upstream of execution. `layers_swept` is scrupulously honest — L1 `UNAVAILABLE`, L2–7 `NOT_SWEPT` each naming the tool it did not invoke. It was rejected because it had **zero** non-trace sources to cite, having made one tool call. Fix names the right area but the wrong gate, and `current` reads *"Unknown (requires agent_config inspection)"* — a request to investigate, not an appliable change. Operator-verified against the stored report. **This is issue #81 in its purest form: correct reasoning, rejected for corroboration it had no remaining way to gather.** |
| 05 | 2 | `734a7dd02b6a0b14f243fed2ce91bf73` | 0 | **1** | 0 | 0 | **1** | **0** | 1/7 (L1 UNAVAILABLE) | 7/7 | `failed` — rejected by **mode B** (same) | 1 | 3 | 8s | Reported the **absence itself** as the root cause ("layer 1 / Execution trace / No execution plan exists") rather than diagnosing why nothing fired, so it never reached layer 7 — the divergence from run 9 on identical input is the documented inconsistent-behaviour failure mode. Fix points at "Agent trigger configuration" (partial credit) with `current` again "Unknown". Honest sweep report, no fabrication. |

**Gate tally — custom harness, v3**

| | |
|---|---|
| Valid runs (not void) | **10** / 10 |
| `sum(passes_gate)` | **0** |
| Gate result | **0 / 10 (0.0%)** |
| Rubric points | **4 / 60** (3 from seed 05 run 1, 1 from seed 05 run 2) |
| Band (proportional, §A3) | **Bottom (< 50%)** |
| Void runs and why | **None** |
| Per-seed pass/fail | 01 **0/2** · 02 **0/2** · 03 **0/2** · 04 **0/2** · 05 **0/2** |
| Prior measurements | v2 (0218) **1 / 10**, 6/60 · Task 10 (0216) **0 / 10**, 0/60 |

### Tool reach — v3, and the three-pass comparison

**Every run in this pass invoked exactly one tool, `agent_trace`, and stopped.** Not one run paged
an artifact; not one reached a configuration, schema, data or GenAI tool.

| | Task 10 (0216) | v2 (0218) | **v3 (0220)** |
|---|---|---|---|
| Mean tool calls / run | 2.0 | 1.4 | **1.0** |
| Runs reaching `read_artifact` | 10 / 10 | 3 / 10 | **0 / 10** |
| Runs reaching `agent_config` | 0 / 10 | 2 / 10 | **0 / 10** |
| Runs reaching any of `schema_lookup` / `query_table` / `genai_log` / `log_analysis` | 0 / 10 | 0 / 10 | **0 / 10** |
| Mean LLM calls / run | ~3.4 | ~2.6 | **2.5** |
| Mean wall clock | ~8.7s | ~6.7s | **5.9s** |
| `sum(passes_gate)` | 0 | 1 | **0** |
| Rubric points | 0 / 60 | 6 / 60 | **4 / 60** |

Budget was never the constraint: `PaAgentLoop.MAX_ITERATIONS = 15` and `BUDGET_MS = 300000`, against
a measured maximum of 3 LLM turns and 8 seconds. **No row came within an order of magnitude of
either bound.**

### Honesty — where the branch demonstrably worked

Set against the depth result, the evidence-validation branch did exactly what it was built to do:

- **Sweep inflation is gone.** In v2, runs claimed up to **all seven layers SWEPT on two reads of the
  same trace**. In v3, **not one run over-claimed a sweep**: every row's `layers_swept` marks L2–L7
  `NOT_SWEPT` (or L1 `UNAVAILABLE`) with reasons that frequently name the specific tool not invoked
  — *"No agent_config tool was invoked to inspect instructions"*.
- **Fabricated citations are caught rather than passed.** Three of ten runs still invented `config`
  citations (rows 1, 5, 6). **All three were rejected**, each with a message naming the actual tool
  roster back to the model. Under the pre-#79 validator all three would have passed on their source
  *labels* — which is precisely the defect #79 was filed for.
- **7 of 10 rows carry zero fabrications**, against a v2 pass where fabrication was pervasive.

The branch converted over-claiming into honesty. It did not convert it into evidence-gathering.

### What the validated reports actually contain

**All five `complete` runs took the inconclusive path.** Every report that passed validation in this
pass names **no root cause, no fix target, and no appliable change**. The two runs that named the
correct layer (seed 05) were both rejected. So on this version, across ten runs:

> **the harness delivered zero actionable diagnoses to a consumer.**

That is a stronger statement than 0/10 on the gate, and it is the finding to carry forward.
