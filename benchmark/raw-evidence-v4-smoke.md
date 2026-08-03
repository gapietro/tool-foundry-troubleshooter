# Benchmark Raw Evidence — v4 SMOKE (targeted, 4 runs)

Instance: `gpinst01.service-now.com` (Zurich Patch 10 Hotfix 3)
App version under test: **`2026.08.0222`** (`sys_app.version`, verified post-install)
Endpoint: `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`
Polling: `GET /api/x_snc_troubleshoot/v1/troubleshooter/runs/{run_id}` **and** a range query — see the
read-consistency note at the foot of this file, which **corrects** the one in `raw-evidence-v3.md`.
Audit derivation: `x_snc_troubleshoot_audit` where `run IN (...)`, all `action_type` values.

Run 2026-08-03 by the operator.

> **THIS IS NOT A SCORED PASS AND MUST NOT BE READ AS ONE.** Four runs, two seeds, no native
> control, no blind scoring, no rubric applied. It answers exactly one pre-registered question and
> is filed because the answer is negative and a negative result that goes unrecorded gets
> re-discovered at the cost of a full pass. The ten-row protocol in `README.md` is unchanged and
> still owes its rows.

---

## The pre-registered question

`2026.08.0222` fixed #85: `agent_trace` had emitted an *illustrative* measurement in every payload
("27 tasks / 19 calls in a measured run") and **six of ten v3 runs plus the smoke run** had read it
as a finding about the run under diagnosis, elevated it to a CONFIRMED layer-1 root cause, and
stopped. That is a plausible mechanism for the depth collapse measured in §I: a run that believes it
has confirmed the root cause in its first tool result has no reason to open a second layer.

**Question, fixed before firing:** does removing that false finding produce a second tool call?

Seeds 01 and 03 were chosen because all four of their v3 rows are named in #85 as having built their
diagnosis on the note (`75797d14`, `9699fdd8`, `20e9755c`, `8d0a7590`). If the note was load-bearing,
these are the rows where it would show.

---

## Deploy verification (before any run)

- `now-sdk build` clean, `now-sdk install --alias gpinst01` from `main` at `41931a1`.
- Post-install `sys_app.version` reads **`2026.08.0222`**.
- Content markers confirmed live, since `sys_updated_on` on `sys_script_include` is **not** bumped by
  an SDK install and is a misleading indicator (v3's finding, re-applied):
  - `PaToolAgentTrace` matches `scriptLIKEThis run recorded` → the #85 live-count note.
  - `PaToolReadKit` matches `scriptLIKEREFERENCE STATISTIC` → the new `REFERENCE_STAT` label.
- `GET /tools` returns **7/7** tools, and `agent_trace`'s description carries the sentence added by
  PR #87 ("Execution tasks and tool calls are counted separately and are NOT expected to match"),
  confirming the deployed prompt is the `0222` one and not a cached earlier build.

## Targets

Reused verbatim from the v3 pass so the diagnostic targets are identical:

| Seed | Execution plan | Read back |
|---|---|---|
| 01 | `b07dc9082baa4314f243fed2ce91bf4b` | `state=completed`, 8 tasks, 1 tool call |
| 03 | `c4cd01842b6a4bd417a6ffbeee91bfc3` | `state=completed`, 6 tasks, 1 tool call |

Both confirmed present and `state=completed` before firing.

---

## The four runs

Fired one at a time, sequentially, no parallelism.

| # | seed | run | run_id | number | terminal | wall clock |
|---|---|---|---|---|---|---|
| 1 | 01 | 1 | `9a9b4ed02bee0b14f243fed2ce91bfa1` | TR1000105 | `complete` | 11s |
| 2 | 01 | 2 | `10cbcad42b26031817a6ffbeee91bfaf` | TR1000106 | `complete` | 10s |
| 3 | 03 | 1 | `2adb8e142bee0b14f243fed2ce91bf66` | TR1000107 | `complete` | 14s |
| 4 | 03 | 2 | `53eb0e582b26031817a6ffbeee91bfc0` | TR1000108 | `complete` | 17s |

4/4 terminal, 0 stuck, 0 void.

## Tool reach — the headline measurement

`x_snc_troubleshoot_audit`, all 8 rows across all 4 runs, read in a single query:

**Every run invoked exactly one tool: `agent_trace`.** Each run produced exactly two audit rows, one
`intent` and one `result`, both `agent_trace`.

| | v3 (`0220`), seeds 01+03 rows only | **v4 smoke (`0222`)** |
|---|---|---|
| Mean tool calls / run | 1.0 | **1.0** |
| Runs reaching `agent_config` | 0 / 4 | **0 / 4** |
| Runs reaching `schema_lookup` / `query_table` / `genai_log` | 0 / 4 | **0 / 4** |
| Runs reaching `read_artifact` | 0 / 4 | **0 / 4** |

**Answer to the pre-registered question: no.** Depth is unchanged. The #85 note was a passenger, not
the cause. §H8's acceptance test — a run reaching `schema_lookup`, `query_table` or `genai_log` on
the seed that needs it — remains unmet, now across 23 scored runs and 5 smoke runs.

## What DID change

The defect #85 describes is gone, and cleanly:

| | v3, seeds 01+03 | v4 smoke |
|---|---|---|
| Runs building a root cause on the note | **4 / 4** | **0 / 4** |
| `root_causes` emitted | ≥1 each, all seed-irrelevant | **0** |
| Terminal status | 3 `failed`, 1 `complete` | **4 `complete`** |

The note now renders with live counts — `"This run recorded 8 execution task(s) and 1 tool call(s)"`
for seed 01, `6` and `1` for seed 03, matching `task_stats.total` and `tool_call_stats.total` in the
same payload — and no run treated the difference as a finding.

Note the status flip: three of the four v3 rows were `failed` (validator rejection on fabricated
citations). All four v4 runs are `complete`. **Removing the false root cause converted rejections
into accepted honest inconclusives** — without adding a single tool call.

---

## The mechanism this smoke exposed (→ #88)

The model is **not** failing to identify its next step. Verbatim from the reports:

- TR1000106 `needed_to_conclude`: *"Further inspection of agent configuration (layer 2) and GenAI
  stack (layer 6) would be required to rule out configuration issues"*
- TR1000107 `needed_to_conclude`: *"Further inspection of agent configuration, data schemas, and
  GenAI stack via agent_config, schema_lookup, and genai_log tools"* — three tools named, none
  invoked
- TR1000107 `layers_swept`, layers 2–7, each reason of the form *"No agent_config call made to
  inspect instructions"* / *"No schema_lookup call made to validate data schemas"*

It names the tools it did not call, in the report, as the reason the layer is unswept. Then seq 4 of
every run reads **`fix_report validated`** and the run completes.

Budget was never the constraint: **2 LLM turns of 15, 10–17 seconds of a 300,000 ms budget.**

`PaFixReport._checkInconclusive` charges the inconclusive path one `evidence_read` citation per layer
marked `SWEPT` (`_countSweptLayers`). Its own docstring states the intent: *"Claim seven sweeps, cite
seven things; honestly mark most layers NOT_SWEPT / UNAVAILABLE with a reason and the citation bill
drops with it."* That defeats sweep inflation — and it does, measurably. But the cost function is
**monotonically increasing in sweeps with no floor**, so its minimum sits at one sweep and two
citations, and the model sits on that minimum in 4 of 4 runs.

**The loop accepts a report the benchmark scores 0.** Full reading and fix direction: #88.

---

## Side-finding: a blind-rule leak (→ #89)

`README.md` step 3 names the smoke gate's expected answer as `context_processing_script` **line 42**,
confirmed live in `sn_aia_message` for plan `c9d63a932bda8b9417a6ffbeee91bfd0`
(`"lineNumber":42`).

Until `2026.08.0222`, `PaToolAgentConfig`'s `context_processing_script_populated` finding emitted the
string *"an auto-populated body on this instance threw at line 42"* — **the smoke gate's expected
answer, in a finding, mid-reasoning.** It was removed by PR #87 as part of the #85 sweep, before this
smoke ran, and `test/referenceStatistics.test.js` now fails the build on the pattern.

It had never fired, because no run has ever invoked `agent_config` — and that is the uncomfortable
part: **the leak was harmless only because the harness was too shallow to reach it.** It would have
activated at exactly the moment the depth work succeeded. The residual gap is the rule itself, which
binds Agent Doctor's *instructions* and not its *tool output*. See #89.

---

## A read-consistency note — this CORRECTS `raw-evidence-v3.md`

v3 recorded: *"Single-record `servicenow_query` reads of `x_snc_troubleshoot_run.status` returned
stale values... Verify terminal status via `GET /runs/{id}` or a range query, not a single-record
table read."*

**That advice is not safe.** On this pass the failure ran the other way: `GET /runs/{id}` returned
`"status": "queued"` for TR1000108 for over four minutes after the run had finished, while a range
query on `x_snc_troubleshoot_run` read `complete` with `sys_updated_on 00:39:23` — 17 seconds after
creation. A second `GET` moments later returned the full completed record.

Both paths go stale; the direction varies. **Poll both, and treat the first terminal reading from
either as authoritative** — or read `x_snc_troubleshoot_audit`, which was consistent throughout and
is the derivation the protocol actually depends on.
