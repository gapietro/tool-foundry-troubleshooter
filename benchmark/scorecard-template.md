# Scorecard template

One row per scored run, **10 rows** — 2 runs per seed × 5 seeds (`benchmark/seeds/seed-01` through
`seed-05`). The smoke-test run (see `benchmark/README.md`) is not one of the 10; it is a pass/fail
gate run before scoring starts, not a scored row.

Copy this file to `benchmark/scorecard-agent-doctor.md` (Task 12) and fill it in per run. Every
column below exists for a stated reason — read the reason before skipping a column, not after.

## A. The 6-point rubric

| Column | Points | What it scores |
|---|---|---|
| `root_cause_layer_correct` | 0 or 2 | Diagnosis names the seed's expected root-cause layer (see the seed's own spec file for the expected value) |
| `fix_target_correct` | 0 or 2 | Diagnosis names the correct fix target (tool schema / instruction text / data seeding / capability mapping / activation) |
| `evidence_cites_trace_and_config` | 0 or 1 | Root cause cites BOTH the execution trace AND at least one config/schema source — the evidence rule from `docs/agent/agent-doctor-instructions.md` |
| `fix_usable_unedited` | 0 or 1 | The Fix Report's proposed fix could be applied by the builder AI as written, with no manual editing first |

**Total: 6 points per run.**

## B. Four further columns — required, not optional

Each of these exists because a specific measured failure would otherwise be invisible. Keep the
"why" sentence attached to the column in any copy of this template — a scorer who does not see the
reason will skip the column.

| Column | Why it is here |
|---|---|
| `layers_swept` — n/7 and which | R-3 amendment. The same probe ran **19** tool calls on keynexus01 and **5** on gpinst01, both finishing `state=Completed` with empty `state_reason` and neither capped. Without this column a lucky shallow run scores identically to a thorough one. |
| `layers_available` — n/7 and which | §3.1 of the design. Separates *did not look* from *could not look — no tool exists*. `swept 1/7, available 1/7` is an agent doing everything it can; `swept 1/7, available 7/7` is one that stopped early. Identical scores, opposite verdicts. |
| `cause_of_death` — `completed \| tool_limit \| context \| supervision_stall \| security \| wandered \| genai_down` | DESIGN.md §2.3. A 0-point budget death and a 0-point reasoning death are opposite verdicts on the gate. |
| `continuous_tool_execution_limit` and `max_auto_executions` per attached tool | R-4 / #30. **Read at run time, not assumed.** E2's 19-call result was reachable only because that probe's `max_auto_executions` was 20 against an instance-typical 10 — 477 of 483 production rows sit at the dictionary default. |

## C. Operational columns

| Column | What it captures |
|---|---|
| `tool_calls` | Total tool calls made this run |
| `assists_consumed` | Now Assist assist-unit consumption for the run |
| `wall_clock` | Elapsed time, conversation start to last tool call |
| `failure_behavior` | `graceful_partial` (states what it could not confirm) vs. `wandering_stuck` (keeps acting without progress) — free text if neither fits |
| `notes` | Free text — anything the fixed columns above don't capture |

## D. How to read the budget knobs

The template ships these two values **blank**. A pre-filled value is an assumption wearing a
measurement's clothes — read them fresh for every scored run, because both are per-run/per-binding
state, not fixed constants.

1. **`continuous_tool_execution_limit`** — `servicenow_query` on `sys_properties`,
   `name=sn_aia.continuous_tool_execution_limit`, field `value`.
2. **`max_auto_executions`** (one row per attached tool) — `servicenow_query` on
   `sn_aia_agent_tool_m2m`, filtered to the agent under test, field `max_auto_executions`.

If either value differs from the instance-typical value or from the shipped/dictionary default,
`benchmark/DECISION.md` must say so explicitly and say what the difference is. Because the shipped
OOB default of `continuous_tool_execution_limit` is itself unknown (R-4), `benchmark/DECISION.md`
must also state that it is unknown and that transferability to a default-configured customer
instance is therefore **unverified** until that default is established.

## E. `layers_swept` is derived, not eyeballed

Per R-20, `layers_swept` is not a scorer's impression of the transcript. It is the distinct set of
`tool_name` values over `x_snc_troubleshoot_audit` rows where `run = <run_id>` and
`action_type = 'result'`. Run that query for every scored row before filling in the column; do not
infer sweep coverage from reading the agent's prose.

---

## The scorecard

Blank template — one filled row per run. `run_id` is the run-identity key from
`benchmark/README.md` (`_agentic_context_.conversation_id`), not a time window.

| seed | run # | run_id (conversation_id) | root_cause_layer_correct | fix_target_correct | evidence_cites_trace_and_config | fix_usable_unedited | total /6 | layers_swept (n/7, which) | layers_available (n/7, which) | cause_of_death | continuous_tool_execution_limit | max_auto_executions (per tool) | tool_calls | assists_consumed | wall_clock | failure_behavior | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | 1 | | | | | | | | | | | | | | | | |
| 01 | 2 | | | | | | | | | | | | | | | | |
| 02 | 1 | | | | | | | | | | | | | | | | |
| 02 | 2 | | | | | | | | | | | | | | | | |
| 03 | 1 | | | | | | | | | | | | | | | | |
| 03 | 2 | | | | | | | | | | | | | | | | |
| 04 | 1 | | | | | | | | | | | | | | | | |
| 04 | 2 | | | | | | | | | | | | | | | | |
| 05 | 1 | | | | | | | | | | | | | | | | |
| 05 | 2 | | | | | | | | | | | | | | | | |
