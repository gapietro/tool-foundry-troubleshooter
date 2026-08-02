# Scorecard — Custom Harness (Task 10, Phase 1b comparison re-run)

Filled 2026-08-02, `gpinst01`, per `benchmark/README.md` "The Phase 1b comparison re-run
protocol". Copied from `scorecard-template.md`; the template's column definitions and rules
are preserved below as the scoring contract this file was filled against.

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

**Critical finding that drove how every custom row below is scored:** for **all 10 custom-harness
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
| 03 | 2 | `06819e402ba6c314f243fed2ce91bf9f` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature) | 2 | 3 | ~6s | Root cause layer 1, "script stack error". `layers_swept` self-report claims L2/L3 `SWEPT` via agent_config — **audit trail refutes this**: agent_config never called. Expected layer 5; not named. |
| 04 | 1 | `1a81d2c42ba2cbd417a6ffbeee91bf3e` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature) | 2 | 4 | ~10s | Three root causes (layers 1, 3, 4), each evidence entry literally labeled `"(hypothetical example)"` in the model's own text — an admitted fabrication, not a hedge. Expected layer 6 (`genai_stack`); never named. Never read the definition row's dangling `api`. |
| 04 | 2 | `6e819e402ba6c314f243fed2ce91bfa5` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature) | 2 | 3 | ~8s | Root cause layer 1, "script stack error". Same hallucinated-sweep pattern (claims agent_config used; audit says no). Never touched the decoy or the real defect — didn't reach layer 6 at all. |
| 05 | 1 | `8b8112802ba6c314f243fed2ce91bf08` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature) | 2 | 3 | ~5s | Root cause layer 1, "script stack error" — near-identical boilerplate text to seed 04 run 2, suggesting a generic fallback answer when there is no real execution trace to anchor to (seed 5 has none by design). Expected layer 7 (wiring/activation); never named, never reached `agent_config`, never saw the trigger. |
| 05 | 2 | `2b8112802ba6c314f243fed2ce91bff3` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed (premature) | 2 | 3 | ~6s | Root cause layer 3, "Create Incident tool input schema, missing `short_description`" — **`Create Incident` is not a tool that exists anywhere in this seed's (or any seed's) configuration**; wholesale hallucination, unrelated to the actual agent/workflow. Expected layer 7; not named. |

**Gate tally — custom harness**

| | |
|---|---|
| Valid runs (not void) | **10** / 10 |
| `sum(passes_gate)` | **0** |
| Gate result | **0 / 10 (0.0%)** |
| Void runs and why | **None** — all five seeds' setup conditions confirmed valid (seed 4 capability match, seed 5 m2m gate fixed and re-read `true`) before scoring |

---

## Native harness — comparison rows (10 rows: 2 new + 8 standing)

### New rows — seed 02 v2 (fired and scored fresh, this task)

`run_id` is `_agentic_context_.conversation_id` (`x_snc_troubleshoot_run.conversation_ref`).
LLM-call count via the corrected `sn_aia_gen_ai_m2m` linkage (Task 9): query the run's top-level
`sn_aia_execution_task` (`type=agent`, `order=100`), then count `sn_aia_gen_ai_m2m` rows keyed to
that task's sys_id.

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
| 03 | 2 | `e1c319c02b6e4314f243fed2ce91bf68` | 2 | 2 | 1 | 1 | 6 | **1** | 5/7 (L1,L2,L3,L5,L6) | Consistent with run 1 |
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
