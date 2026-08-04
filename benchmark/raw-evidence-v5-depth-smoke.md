# Benchmark Raw Evidence v5 — the depth-gate smoke — 2026-08-04

Instance: `gpinst01.service-now.com` (Zurich Patch 10 Hotfix 3)
App version under test: **`2026.08.0302`** + the depth gate (`sys_app.version` read post-install;
the version bump to `2026.08.0401` lands in Task 10, after this smoke, so the deployed string
still reads `2026.08.0302` — the code is branch `feature/depth-gate-agent-loop` at `0ce2d13`)
Branch: `feature/depth-gate-agent-loop`
Issue: **#103** — Depth: `PaAgentLoop` has no floor
Endpoint: `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`
Polling: `GET /api/x_snc_troubleshoot/v1/troubleshooter/runs/{run_id}`
Audit derivation: `x_snc_troubleshoot_audit` where `run=<run_id>`, all `action_type` values,
ordered ascending.

This file is a MEASUREMENT record. It is **not scored** — these six runs are unscored by design
(issue #103, "What this cannot establish"). Prediction scoring is appended in Task 9.

**Harness: custom only.** Native does not move on this branch (§K5 / §I4 confound 3 stays closed),
so there is no native arm in this smoke and no cross-harness comparison is available from it.

---

## Deploy verification (Task 7, done before any run)

| Step | Result |
|---|---|
| `npm test` | PASS — 1003 tests, 25 suites, 0 failures |
| `now-sdk build` | success (SDK 4.9.2) |
| `now-sdk install --alias gpinst01` | success — rollback context `862ff5b02bae8b1817a6ffbeee91bf18` |

**Installed-code check.** `sys_script_include` `PaAgentLoop`
(`63cde457a0a34165ab4dc227797dfd16`, scope `13043037d3da4293904504ef30589334`) read back through
the foundry MCP broker. The deployed source carries the gate:

| Identifier | Occurrences in deployed source |
|---|---|
| `_depthGate` | 8 |
| `_holdBlock` | 6 |
| `_trailTools` | 4 |
| `_scrubToolNames` | 4 |
| `unsweptGaps` | 3 |

The deployed `_scrubToolNames` body was compared literally against
`src/server/PaAgentLoop.js:1285` and matches, **including the `'gi'` case-insensitive flag added in
`0ce2d13`** — so the install carried branch HEAD, not an earlier build.

> **Recorded oddity, not a blocker.** `sys_script_include.sys_updated_on` for `PaAgentLoop` read
> `2026-08-02 05:15:25` immediately after a successful install on 2026-08-04. The record's
> **content** is branch HEAD (verified above, literally), so the timestamp is stale metadata rather
> than a stale install. Content, not `sys_updated_on`, is the deploy check — noted here because a
> future pass reading only the timestamp would wrongly conclude the install did not land.

---

## Seed fixture preconditions — verified, none void

| Seed | Execution plan sys_id | `state` | Answer sits behind |
|---|---|---|---|
| 01 | `b07dc9082baa4314f243fed2ce91bf4b` | `completed` | the layer-4 tool |
| 03 | `c4cd01842b6a4bd417a6ffbeee91bfc3` | `completed` | a layer-5 tool |
| 04 | `16ddc10c2baa4314f243fed2ce91bf15` | `completed` | a layer-6 tool |

All three read back from `sn_aia_execution_plan` on 2026-08-04, all `state=completed` — the same
three targets used in v4 (`benchmark/raw-evidence-v4.md:84`), reusable and not void.

**Seed 02 is deliberately excluded** (spec §11). Seed 05 is not in this smoke.

---

## The six request bodies — recorded BEFORE firing

**#99 is why this section exists.** The harness never persists the inbound request payload, so
after the fact a run's diagnostic subject is unrecoverable from the instance. This file is the
system of record for what these six runs were asked.

| Run | Seed | Verbatim body |
|---|---|---|
| 1 | 01 | `{"execution": "b07dc9082baa4314f243fed2ce91bf4b", "mode": "diagnose"}` |
| 2 | 01 | `{"execution": "b07dc9082baa4314f243fed2ce91bf4b", "mode": "diagnose"}` |
| 3 | 03 | `{"execution": "c4cd01842b6a4bd417a6ffbeee91bfc3", "mode": "diagnose"}` |
| 4 | 03 | `{"execution": "c4cd01842b6a4bd417a6ffbeee91bfc3", "mode": "diagnose"}` |
| 5 | 04 | `{"execution": "16ddc10c2baa4314f243fed2ce91bf15", "mode": "diagnose"}` |
| 6 | 04 | `{"execution": "16ddc10c2baa4314f243fed2ce91bf15", "mode": "diagnose"}` |

Bodies are byte-identical to v4's for the same three seeds
(`raw-evidence-v4.md:463`, `:1238`, `:1683`) — the request is not a variable in this smoke.

---

## Run results

All six runs fired sequentially, one at a time, each polled to terminal before the next was
POSTed — no two runs overlapped, so LLM contention is not a confound in these numbers.

### Master table

| Run | Seed | `run_id` | Number | Status | Wall clock | Tool calls | Tool-call order | LLM calls | Holds |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 01 | `b8df7d742bae8b1817a6ffbeee91bfb0` | TR1000138 | **complete** | 13:03:11 → 13:03:29 (18s) | 2 | `agent_trace`, `agent_config` | 4 | 1 |
| 2 | 01 | `95ff39b42bae8b1817a6ffbeee91bf75` | TR1000139 | **complete** | 13:03:46 → 13:04:08 (22s) | 2 | `agent_trace`, `agent_config` | 4 | 1 |
| 3 | 03 | `bf004e782b260754f243fed2ce91bf53` | TR1000140 | **complete** | 13:04:12 → 13:04:31 (19s) | 3 | `agent_trace`, `read_artifact`, `agent_config` | 6 | 1 |
| 4 | 03 | `643046b82b260754f243fed2ce91bf77` | TR1000141 | **complete** | 13:04:48 → 13:05:05 (17s) | 2 | `agent_trace`, `agent_config` | 4 | 1 |
| 5 | 04 | `c740c6382bae8b1817a6ffbeee91bff7` | TR1000142 | **complete** | 13:05:15 → 13:05:37 (22s) | 3 | `agent_trace`, `read_artifact`, `agent_config` | 5 | 1 |
| 6 | 04 | `42604af82b260754f243fed2ce91bfbe` | TR1000143 | **complete** | 13:05:43 → 13:06:11 (28s) | 2 | `agent_trace`, `agent_config` | 5 | 1 |

**Terminal states: 6 `complete`, 0 `partial`, 0 `failed`.**

Tool-call order is derived from `x_snc_troubleshoot_audit` (`action_type='intent'` rows ordered by
`sys_created_on`), not from any report. 28 audit rows total across the six runs — 14 tool calls,
each with an `intent` and a `result` row.

### Audit-derived layer sweep (§N7: the trail can refute a credit, never confer one)

`_layerToolMap()` (`src/server/PaFixReport.js:366`): L1 `agent_trace`/`genai_log`/`log_analysis`;
L2, L3, L7 `agent_config`; L4 `schema_lookup`; L5 `query_table`/`log_analysis`;
L6 `genai_log`/`log_analysis`. `read_artifact` maps to no layer.

| Run | Audit-derived sweep | v4 baseline, same seed |
|---|---|---|
| 1 | **4/7** (L1, L2, L3, L7) | 1/7 (L1) |
| 2 | **4/7** (L1, L2, L3, L7) | 1/7 (L1) |
| 3 | **4/7** (L1, L2, L3, L7) | 1/7 (L1) |
| 4 | **4/7** (L1, L2, L3, L7) | 1/7 (L1) |
| 5 | **4/7** (L1, L2, L3, L7) | 1/7 (L1) |
| 6 | **4/7** (L1, L2, L3, L7) | 1/7 (L1) |

**Every run moved from 1/7 to 4/7.** Median tool calls 1 → 2; median LLM calls 3 → 4.5.

**Distinct tools invoked across all six runs: `agent_trace`, `agent_config`, `read_artifact`.**
`schema_lookup`, `query_table`, `genai_log` and `log_analysis` were **not invoked in any of the six
runs** — the same four tools that had never been invoked in any custom run across 45 runs before
this smoke. That count is now **51 runs**.

### Holds (Step 4)

**A hold fired on 6 of 6 runs.** Every hold was the first and only one in its run, and every one
was released by a tool call in the same run.

| Run | Hold at seq | Layers named in the hold | Released by | Release call `success` |
|---|---|---|---|---|
| 1 | 4 | 2, 3, 4, 5, 6, 7 | `agent_config` | `true` |
| 2 | 4 | 2, 3, 4, 5, 6, 7 | `agent_config` | `true` |
| 3 | 6 | 2, 3, 4, 5, 6, 7 | `agent_config` | `true` |
| 4 | 4 | 2, 4, 5, 6, 7 | `agent_config` | `true` |
| 5 | 6 | 2, 3, 4, 5, 6, 7 | `agent_config` | `true` |
| 6 | 4 | 2, 3, 4, 5, 7 | `agent_config` | `true` |

**M4 check — a released hold is not by itself proof the releasing call succeeded.** All six release
calls were verified independently against their `x_snc_troubleshoot_audit` `action_type='result'`
rows: every one carries `"success":true` with a non-trivial payload
(`total_length` 5,269–6,458 chars, each stored as a pageable artifact). **No hold in this smoke was
released by a null or failed call.**

Every run terminated with a `fix_report validated` system entry after its hold — the sticky release
worked exactly as designed: one forced beat, then the draft became submittable again.

### Layer-label distribution (Step 5 — P8's measurement)

Per-run labels from the delivered report's `layers_swept`:

| Run | SWEPT | NOT_SWEPT | UNAVAILABLE | Detail |
|---|---|---|---|---|
| 1 | 2 | 5 | 0 | 1:S 2:N 3:S 4:N 5:N 6:N 7:N |
| 2 | 1 | 6 | 0 | 1:S 2:N 3:N 4:N 5:N 6:N 7:N |
| 3 | 2 | 4 | 1 | 1:S 2:N 3:S 4:N 5:N **6:U** 7:N |
| 4 | 2 | 5 | 0 | 1:S 2:N 3:S 4:N 5:N 6:N 7:N |
| 5 | 2 | 5 | 0 | 1:S 2:N 3:S 4:N 5:N 6:N 7:N |
| 6 | 2 | 4 | 1 | 1:S 2:N 3:S 4:N 5:N **6:U** 7:N |

| | v4 baseline (same 3 seeds, custom, 6 rows) | v5 (this smoke, 6 rows) |
|---|---|---|
| SWEPT | 7 / 42 (16.7%) | **11 / 42 (26.2%)** |
| NOT_SWEPT | 34 / 42 (81.0%) | **29 / 42 (69.0%)** |
| UNAVAILABLE | 1 / 42 (2.4%) | **2 / 42 (4.8%)** |

`UNAVAILABLE` went from 1 to 2 occurrences. Both v5 instances are **layer 6**, and both give the
honest reason — run 3: "No genai_log or log_analysis tool invoked to inspect GenAI stack"; run 6:
"No genai_log or log_analysis tool invoked to analyze GenAI stack". The 5-label drop in `NOT_SWEPT`
is accounted for by the 4-label rise in `SWEPT` (layer 3, legitimately earned by the `agent_config`
call the hold forced) plus that one extra `UNAVAILABLE`. Scored in Task 9.

### Unsupported sweep claims (the #88 regression check)

Every `SWEPT` claim in all six delivered reports is backed by a tool call in that run's own trail:
layer 1 by `agent_trace`, layer 3 by `agent_config`. **0 of 6 runs made an unsupported sweep
claim.** The v4 baseline on these same three seeds carried 1 — seed 04 custom run 1
(`raw-evidence-v4.md:1681` block) claimed `"6": {"status": "SWEPT", "reason": "GenAI stack analysis
confirmed the tool call was attempted but returned an error"}` with no `genai_log` or
`log_analysis` call in its trail, in a draft that then failed validation.

### The rendered hold prompt (Step 6 / M5) — captured verbatim

`sys_generative_ai_log` `1a70063c2b260754f243fed2ce91bf87` (2026-08-04 13:06:00) is the LLM call
that generated run 6's post-hold turn. Its `prompt` ends with the interrogation, reproduced here
byte-for-byte from that record:

```
## HOLD — a terminal action is not available yet

Your draft marks these layers NOT_SWEPT, each with a reason you wrote:
  layer 2 (Instructions) — "No configuration issues identified in the trace; [tool] not called"
  layer 3 (Tool definitions) — "Tool definition analysis not performed as error originated from tool response, not schema"
  layer 4 (Data schemas) — "No schema mismatch evidence found in trace; [tool] not called"
  layer 5 (Data) — "Data existence not verified as error appeared in tool response, not data reads"
  layer 7 (Trigger and wiring) — "Trigger wiring not analyzed as failure occurred during tool execution, not initialization"
The trail shows no tool call has reached any of them.

Before concluding:
  1. What did the last tool result actually establish? Quote the specific field
     or value you are relying on.
  2. What did it NOT settle? Of the layers above, name the one whose answer would
     most change your conclusion.
  3. Call a tool that reaches that layer.

Your draft is preserved. Once the trail shows you did, a terminal action is available again and you may resubmit it unchanged.
```

Three things this capture establishes that source review could not:

1. **The block arrives whole.** It is rendered from loop state by `_buildPrompt()`, not carried as a
   transcript entry, so it is not subject to `PaRunManager`'s 200-char `result_digest` digest. The
   prompt contains the full text with no `more chars]` marker anywhere in it — the plan's
   correction #1 (the #72 / §G3a observation-channel defect reappearing) is confirmed avoided in
   the live artifact, not just in unit tests.
2. **`_scrubToolNames` fired on real model output.** The model's own reasons for layers 2 and 4
   named a registered tool; both reach the prompt as `"[tool] not called"`. The harness did not
   name a tool back to the model, so §H8's acceptance test stayed non-vacuous.
3. **The transcript's own record of the hold is the short note**, `#4 [system] result=HOLD:
   terminal action refused — layer(s) 2, 3, 4, 5, 7 declared NOT_SWEPT with no tool call behind
   them.` — under 200 chars, exactly as designed, visible in the same prompt's transcript section.

### Seed 01 constraint-1 readout (Step 7 — P5)

**Does the delivered report use `priority_stored: null`? Run 1: NO. Run 2: NO.**

The string `priority_stored` does not appear anywhere in either report — not in `failure_summary`,
`root_causes`, `data_markers` or `inconclusive`. Both returned `root_causes: []` and `fixes: []`.

- Run 1 `failure_summary`: "The AI Agent execution for the Seed 01 Ticket Prioritizer completed
  successfully, with the tool call to set ticket priority returning a successful response. **No
  observable failure in the execution trace.**"
- Run 2 `failure_summary`: "…returning a successful response. **No errors were observed in the
  execution trace.**"
- Run 1 `inconclusive.needed_to_conclude`: "No additional evidence required - execution succeeded
  as observed"

The discriminating value was in hand both times: the `agent_trace` result carries
`\"priority_requested\":\"critical\",\"priority_stored\":null` verbatim in the `response_digest` of
the seeded tool call, and that payload is in the transcript's `prompt_digest` for turn 2 of both
runs. **The gate bought a second tool call on both runs and neither spent it on reading what it
already had.** This is §O6 / constraint 1, unmoved.

### Root causes on seeds 03 and 04 (context, unscored)

Not a filed prediction, recorded because it is the clearest non-depth change from v4. Four of the
six runs produced a non-empty `root_causes` **and** a fix, where v4's custom rows on these seeds
produced empty `root_causes` or a rejected draft:

| Run | Layer | Finding | Confidence |
|---|---|---|---|
| 3 | 3 | No valid routing rules exist for the 'Hardware' category | UNCONFIRMED, `would_confirm: layer 4` |
| 4 | 1 | No routing rules matched the 'Hardware' category | CONFIRMED |
| 5 | 1 | Tool call returned error status with invalid response | CONFIRMED |
| 6 | 6 | The GenAI capability returned an error response | CONFIRMED |

**Two flags for whoever scores next.** (a) Run 6 places its root cause on **layer 6** while its own
`layers_swept` marks layer 6 `UNAVAILABLE` — a report-internal inconsistency that validation did
not catch; it is not an unsupported `SWEPT` claim, so the §79b check had nothing to bite on.
(b) Run 3's `would_confirm` names layer 4, the layer `schema_lookup` would have swept — the model
identified the missing evidence correctly and still did not call the tool that closes it. These
are unscored observations; whether any of these four findings is *correct* is a scored pass's
question, not this smoke's.
