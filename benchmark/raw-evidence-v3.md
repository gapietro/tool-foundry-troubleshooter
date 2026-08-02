# Benchmark Raw Evidence v3 — 2026-08-02

Instance: `gpinst01.service-now.com` (Zurich Patch 10 Hotfix 3)
App version under test: **`2026.08.0220`** (`sys_app.version`, verified post-install)
Endpoint: `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`
Polling: `GET /api/x_snc_troubleshoot/v1/troubleshooter/runs/{run_id}`
Audit derivation: `x_snc_troubleshoot_audit` where `run=<run_id>`, all `action_type` values, ordered ascending.

Ten runs: seeds 01–05, two runs each, executed **one at a time, sequentially, no parallelism**.

This file is a MEASUREMENT record. Scoring lives in `scorecard-custom-harness.md`.

---

## Deploy verification (done before any run)

The pass opened by finding the instance was **not** running the version under test:

- `sys_app.version` read **`2026.08.0219`** before the install.
- `now-sdk build` (clean) + `now-sdk install --alias gpinst01` from `main` at
  `d316706`, `package.json` version `2026.08.0220`.
- Post-install `sys_app.version` reads **`2026.08.0220`**.
- Content markers confirmed live in the deployed code, since `sys_updated_on` on
  `sys_script_include` is **not** bumped by an SDK install and is a misleading indicator:
  - `PaFixReport` contains `Per layer:` → the `_layerToolMap()` disclosure from commit `d66a642`.
  - `PaAuditLogger` contains `invokedTools` → the #79 audit-trail reader.

## Seed fixture preconditions (§A3 void conditions) — all verified, none void

| Condition | Read | Verdict |
|---|---|---|
| Seed 04 capability `x_snc_tsbench_unmapped_capability` | `92ff62af516741769c437feb88c80ef3` present | not void |
| Seed 04 definition `904c0485699a4a73a124446a7231c563` | `api_type=sys_hub_flow`, `api=00000000000000000000000000000000` (dangling), `connection` empty (decoy) | matches primary construction |
| Seed 05 `sn_aia_trigger_agent_usecase_m2m` `ba30d8775b0c4cebb960c58830590d5d` | `active=true` | gate on, as required |
| Seed 05 `sn_aia_trigger_configuration` `bfb77d6c64884500a80203ee029436ee` | `active=false` | the seeded defect, intact |
| Seed 05 bench ticket `29fd09c42b6a4bd417a6ffbeee91bfb0` | present in `x_snc_tsbench_ticket` | reusable |
| Seeds 01–04 execution targets | all four `state=completed` | reusable |

`layers_available`: **7/7** — `GET /tools` returns all seven tools registered
(`agent_trace`, `agent_config`, `schema_lookup`, `query_table`, `genai_log`, `log_analysis`,
`read_artifact`). The gap measured below is entirely "did not look", never "could not look".

## Post-install sanity run (NOT a scored row)

`1b49b19c2b2a0b14f243fed2ce91bf91` / TR1000094, against the standing smoke specimen
`c9d63a932bda8b9417a6ffbeee91bfd0`. Confirmed before spending scored runs:

- the diagnostic target is delivered into the first tool call (`{"execution":"c9d63a93…"}`) — #77 holds;
- the observation channel carries the full ~4,300-char envelope in `prompt_digest`, not a
  200-char digest — #72 holds;
- `fix_report_rejected` is exposed over the API — the #78 side-defect fix is live;
- `layers_swept` marked layers 2–7 `NOT_SWEPT` with reasons naming the uninvoked tool.

Terminal: `failed` (evidence rule — cites only the trace). One tool call.

---

## The ten scored runs

Request bodies reused verbatim from the prior pass so the diagnostic targets are identical:
seed 01 `b07dc9082baa4314f243fed2ce91bf4b`, seed 02 `4b315ecc2b66c314f243fed2ce91bfca`,
seed 03 `c4cd01842b6a4bd417a6ffbeee91bfc3`, seed 04 `16ddc10c2baa4314f243fed2ce91bf15`;
seed 05 in `agent`+`timeframe`+`description` form naming bench ticket
`29fd09c42b6a4bd417a6ffbeee91bfb0` (no execution plan exists for seed 05 by design).

| # | seed | run | run_id | number | terminal status |
|---|---|---|---|---|---|
| 1 | 01 | 1 | `75797d142baecfd417a6ffbeee91bf71` | TR1000095 | `failed` |
| 2 | 01 | 2 | `9699fdd82baecfd417a6ffbeee91bfff` | TR1000096 | `complete` |
| 3 | 02 | 1 | `9eb9b91c2baecfd417a6ffbeee91bf54` | TR1000097 | `complete` |
| 4 | 02 | 2 | `09d9f15c2baecfd417a6ffbeee91bf07` | TR1000098 | `complete` |
| 5 | 03 | 1 | `20e9755c2baecfd417a6ffbeee91bfe8` | TR1000099 | `failed` |
| 6 | 03 | 2 | `8d0a75902b6a0b14f243fed2ce91bf0f` | TR1000100 | `failed` |
| 7 | 04 | 1 | `5b1a7d902b6a0b14f243fed2ce91bffd` | TR1000101 | `complete` |
| 8 | 04 | 2 | `b22af99c2baecfd417a6ffbeee91bf28` | TR1000102 | `complete` |
| 9 | 05 | 1 | `ee3a71dc2baecfd417a6ffbeee91bfe5` | TR1000103 | `failed` |
| 10 | 05 | 2 | `734a7dd02b6a0b14f243fed2ce91bf73` | TR1000104 | `failed` |

10/10 terminal, 0 stuck, 0 void.

## Tool reach — the headline measurement

`x_snc_troubleshoot_audit`, all 20 rows across all 10 runs, read in a single query:

**Every run invoked exactly one tool: `agent_trace`.** Each run produced exactly two audit rows,
one `intent` and one `result`, both `agent_trace`. Across the whole pass:

| Tool | Runs that invoked it |
|---|---|
| `agent_trace` | 10 / 10 |
| `read_artifact` | **0** / 10 |
| `agent_config` | **0** / 10 |
| `schema_lookup` | **0** / 10 |
| `query_table` | **0** / 10 |
| `genai_log` | **0** / 10 |
| `log_analysis` | **0** / 10 |

Audit-derived `layers_swept` is therefore **1/7 (L1)** for all ten rows, and any citation of a
`config`, `schema` or `data` source in any row is unbacked by definition.

## A read-consistency note for whoever re-runs this

Single-record `servicenow_query` reads of `x_snc_troubleshoot_run.status` returned **stale**
values during this pass (a run that the REST API already reported `failed` still read `queued`).
Multi-record range queries and `GET /runs/{id}` both returned fresh values. Verify terminal status
via `GET /runs/{id}` or a range query, not a single-record table read.
