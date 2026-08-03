# Benchmark Raw Evidence v4 — 2026-08-03

Instance: `gpinst01.service-now.com` (Zurich Patch 10 Hotfix 3)
App version under test: **`2026.08.0301`** (`sys_app.version`, verified post-install)
Endpoint: `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`
Polling: `GET /api/x_snc_troubleshoot/v1/troubleshooter/runs/{run_id}`
Audit derivation: `x_snc_troubleshoot_audit` where `run=<run_id>`, all `action_type` values, ordered ascending.

This file is a MEASUREMENT record. Scoring lives in the v4 scorecard(s) (TBD by later tasks in this pass).

---

## Deploy verification (Task 1, done before any run)

The pass opened by finding the instance was **not** running the version under test:

- `sys_app.version` read **`2026.08.0226`** before the install (queried via
  `servicenow_query` on `sys_app`, `sys_id=13043037d3da4293904504ef30589334`,
  fields `name,version`).
- Per branch discipline, the deploy itself was run from `main`, not from this
  task branch: `git checkout main && git pull` (main already up to date at
  `8c909cd`, `package.json` version `2026.08.0301`) + `now-sdk build` (clean)
  + `now-sdk install --alias gpinst01`.
- Immediately after install, returned to
  `chore/benchmark-v4-scored-pass` — no commit was made on `main`.
- Post-install `sys_app.version` reads **`2026.08.0301`** (re-queried, same
  fields).

### Content byte-comparison — Script Includes

`sys_updated_on` is **not** bumped by an SDK install and is a misleading
indicator, so content was compared directly rather than trusting the
timestamp. For each of the four Script Includes the custom harness depends
on, the instance's `sys_script_include.script` was pulled via the Table API
(`GET /api/now/table/sys_script_include`, `sysparm_query=name=<name>`,
`sysparm_fields=name,script`) and diffed byte-for-byte against the matching
file in `src/server/`:

| Script Include | Instance vs. `src/server/*.js` | Result |
|---|---|---|
| `PaFixReport` | `diff` exit 0 | **Byte-identical** |
| `PaArtifactStore` | `diff` exit 0 | **Byte-identical** |
| `PaToolRegistry` | `diff` exit 0 | **Byte-identical** |
| `PaScriptToolAdapter` | `diff` exit 0 | **Byte-identical** |

All four matched exactly — no divergence, not even a trailing-newline
difference.

### Content byte-comparison — shared agent instructions

`sn_aia_agent` (`sys_id=e1392946828940e5a708fc51b0a5e954`, fields
`name,instructions`) was pulled via the Table API and diffed against
`docs/agent/agent-doctor-instructions.md`:

- **Content byte-identical** across all 120 lines.
- The only difference: the repo file ends with a trailing newline; the
  instance's `instructions` field value does not (`instance` 7297 bytes vs.
  `repo` 7298 bytes, diff flags `\ No newline at end of file` on the last
  line only). This is the expected artifact of how the field was populated
  and is **not** treated as a divergence — noted per the task brief's
  guidance that trailing-newline differences are common and not
  stop-worthy.

**Conclusion: the deployed code on gpinst01 (`2026.08.0301`) is confirmed
identical to the code committed on `main` at `8c909cd` for all four Script
Includes and the shared Agent Doctor instructions.** The rest of this v4
pass measures the committed code, not something else.

---

## Seed fixture preconditions (§A3 void conditions) — all verified, none void

All queries run via `servicenow_query` against gpinst01, admin session, connected
through the foundry MCP `servicenow_connect` broker (no shell credentials used).

| Condition | Read | Verdict |
|---|---|---|
| Seed 02 `sn_aia_agent_tool_m2m` for agent `cd050d48e810411d9f113fd530694fe6` (`active=true`) | 1 row: `tool.name=measure_request`, `max_auto_executions=10` | v2 construction is live — not void |
| Seed 04 capability `x_snc_tsbench_unmapped_capability` | `sys_id=92ff62af516741769c437feb88c80ef3` | matches the value hardcoded in the installed tool script — not void |
| Seed 04 definition `904c0485699a4a73a124446a7231c563` | `api_type=sys_hub_flow`, `api=00000000000000000000000000000000` (dangling), `connection` empty (decoy) | matches expected v3 construction — not void |
| Seed 05 `sn_aia_trigger_agent_usecase_m2m` `ba30d8775b0c4cebb960c58830590d5d` | `active=true` (already on — no PATCH required) | gate on, as required — not void |
| Seed 05 `sn_aia_trigger_configuration` `bfb77d6c64884500a80203ee029436ee` | `active=false` | the seeded defect, intact — not void |
| Seed 05 bench ticket `29fd09c42b6a4bd417a6ffbeee91bfb0` | present in `x_snc_tsbench_ticket`, short_description "New starter needs laptop provisioned before Monday", priority `3` | reusable |
| Seeds 01–04 execution targets (`b07dc9082baa4314f243fed2ce91bf4b`, `4b315ecc2b66c314f243fed2ce91bfca`, `c4cd01842b6a4bd417a6ffbeee91bfc3`, `16ddc10c2baa4314f243fed2ce91bf15`) | all four present in `sn_aia_execution_plan`, all four `state=completed` | reusable — not void |

**No PATCH was required for Step 3.** Seed 5's `sn_aia_trigger_agent_usecase_m2m`
gate already read `active=true` on first query — the fixture was already in its
correct post-install state, so the one permitted repair action was not exercised.
`sn_aia_trigger_configuration.active` was read (not touched) and confirmed `false`,
as the seeded defect requires.

**All five seeds: not void.**

### Budget knobs and `layers_available` (§E3 query)

`sn_aia_agent_tool_m2m` for agent `e1392946828940e5a708fc51b0a5e954` (`active=true`)
returned **7 rows**, each `max_auto_executions=10`:

| tool.name | max_auto_executions |
|---|---|
| `agent_trace` | 10 |
| `agent_config` | 10 |
| `schema_lookup` | 10 |
| `query_table` | 10 |
| `genai_log` | 10 |
| `log_analysis` | 10 |
| `read_artifact` | 10 |

`sys_properties` `sn_aia.continuous_tool_execution_limit` = **`25`**.

**Measured `layers_available`: 7/7** — all seven tools are registered on the
agent record read directly from the instance (not copied from a prior pass).
The gap measured by scored runs is "did not look", never "could not look with".

---

## Smoke gate (Task 3) — both harnesses, not a scored row

One run fired per harness against the standing smoke specimen (execution plan
`c9d63a932bda8b9417a6ffbeee91bfd0`), invocation text exactly per the brief and
nothing else. Bar: terminal with structurally valid output — not correct
diagnosis. Full raw transcripts (complete tool-call payloads, full Fix Report
text) are in `.superpowers/sdd/2026-08-03-v4-scored-pass/task-3-report.md` for
bulk reference only — that path is gitignored and will not survive the plan;
every judgement a later reader needs is inlined below.

### Native (Agent Doctor, `e1392946828940e5a708fc51b0a5e954`)

Prompt: `Diagnose execution plan c9d63a932bda8b9417a6ffbeee91bfd0.`

- Execution ID `0781aaec2ba2871817a6ffbeee91bfce`, conversation
  `d2816aec2ba2871817a6ffbeee91bf4e`
- **Terminal state: Completed** — **wall clock: 241s** — **11 tool calls**
  (`agent_trace` ×1, `read_artifact` ×7, `agent_config` ×2, `genai_log` ×1,
  `log_analysis` ×1)
- Fix Report is well-formed (FAILURE SUMMARY / LAYERS SWEPT / ROOT CAUSES /
  FIXES / VERIFICATION) and named `context_processing_script` line 42 as
  RC-2 with CONFIRMED confidence — matching the known answer, consistent
  with native also finding it at Task 9 and Task 12.
- **Caveat on RC-2's wording:** native's Fix Report also claims, as part of
  RC-2, that the `sn_aia_agent` record owning that script "no longer exists."
  This reads as a misinterpretation of an `agent_config` empty read against a
  script-owning sub-record, not evidence of an actual deletion. Recorded here
  as an observation about native's output/reasoning, not as a fact about the
  instance; flagged for whoever scores this fixture in the 20-row pass.

**Gate: PASS.**

### Custom (`x_snc_troubleshoot`)

Body: `{"execution": "c9d63a932bda8b9417a6ffbeee91bfd0", "mode": "diagnose"}`

- Run ID `5702a2242be2871817a6ffbeee91bfc9` (`TR1000117`), polled via
  `GET .../runs/{run_id}` (trusted per the brief over any single-record
  `servicenow_query`, which is stale on this instance)
- **Terminal state: complete** — **wall clock: ~10s** — **1 tool call**
  (`agent_trace`)
- `fix_report` has all documented keys (`failure_summary`, `layers_swept`,
  `root_causes`, `fixes`, `verification`, `data_markers`) and named
  `context_processing_script` line 42 as the sole root cause — but only
  Layer 1 was swept (all other layers `NOT_SWEPT`) and confidence is
  explicitly `UNCONFIRMED`. Right answer, shallow evidence — flagged for
  the scored pass, not treated as a gate signal.

**Gate: PASS.**

### Result

| Harness | Terminal state | Wall clock | Tool calls | Line 42 named |
|---|---|---|---|---|
| Native (Agent Doctor) | Completed | 241s | 11 | YES |
| Custom (`x_snc_troubleshoot`) | complete | ~10s | 1 | YES |

Both harnesses passed: terminal, structurally valid output. Gate is
terminality + structural validity, not correctness — both happened to name
the known answer this time, which is not guaranteed to repeat across the 20
scored runs. Pass may proceed.
