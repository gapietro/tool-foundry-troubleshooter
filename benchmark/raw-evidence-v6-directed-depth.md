# Benchmark Raw Evidence v6 — the directed-depth smoke — 2026-08-05

Instance: `gpinst01.service-now.com` (Zurich Patch 10 Hotfix 3)
App version under test: **`2026.08.0403`**
Branch: `feature/directed-depth-gate` at `87f81c9`
Issue: **#109** — the gate records the UNION of gap tools, so one `agent_config` call discharges
layers it never touched
Endpoint: `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`
Polling: `GET /api/x_snc_troubleshoot/v1/troubleshooter/runs/{run_id}`
Audit derivation: `x_snc_troubleshoot_audit` where `run=<run_id>`, `action_type='intent'`, ordered
ascending.

This file is a MEASUREMENT record. These six runs are **unscored by design** — §P6's
recommendation against firing a scored pass on a single change stands. Prediction scoring for
Q1–Q8 is in `DECISION.md` §Q.

**Harness: custom only.** Nothing native-facing moved on this branch (§K5 / §I4 confound 3 stays
closed), so there is no native arm and no cross-harness comparison from this smoke.

---

## Deploy verification — done before any run

| Step | Result |
|---|---|
| `npx jest` | PASS — 1107 tests, 26 suites, 0 failures |
| `now-sdk build` | success (SDK 4.9.2) |
| `now-sdk install --alias gpinst01` | success — rollback context `ef45b8c12b268f1817a6ffbeee91bf2a` |

**Installed-code check, by CONTENT.** `sys_script_include` `PaAgentLoop`
(`63cde457a0a34165ab4dc227797dfd16`) read back through the foundry MCP broker. Present in the
deployed source: `MAX_HOLDS`, `_selectTarget`, `_dedicatedTools`, `_cappedNote`, `dScore`,
`CLOSED BY #109`, the literal line `var best = this._gapFanOut(gap, fanOut)`, and the full `GATE:`
note text. `PaFixReport` (`02e215b1cf424baeb7f13a3fd5145ae3`) carries `toolFanOut` and
`declaredLayers`.

> **§P1's recorded oddity REPRODUCED.** `sys_script_include.sys_updated_on` for `PaAgentLoop` read
> `2026-08-02 05:15:25` immediately after a successful install on 2026-08-05 — the identical stale
> value §P1 recorded on 2026-08-04. The record's **content** is branch HEAD, verified literally
> above. A pass checking only the timestamp would wrongly conclude the install did not land. This
> is now observed twice, on two different installs, so treat it as the instance's normal behaviour
> for this record rather than a one-off.

## Seed fixture preconditions — verified, none void

| Seed | Execution plan sys_id | `state` | Answer sits behind |
|---|---|---|---|
| 01 | `b07dc9082baa4314f243fed2ce91bf4b` | `completed` | the layer-4 tool (`schema_lookup`) |
| 03 | `c4cd01842b6a4bd417a6ffbeee91bfc3` | `completed` | a layer-5 tool (`query_table`) |
| 04 | `16ddc10c2baa4314f243fed2ce91bf15` | `completed` | a layer-6 tool (`genai_log`) |

Read back from `sn_aia_execution_plan` on 2026-08-05, all three `state=completed` — the same three
targets used in v4 and v5, reusable and not void. **Seed 02 is deliberately excluded** (spec §11);
seed 05 is not in this smoke.

## The six request bodies — recorded BEFORE firing

Byte-identical to v5's for the same three seeds, so the request is not a variable between the two
smokes.

| Run | Seed | Verbatim body |
|---|---|---|
| 1 | 01 | `{"execution": "b07dc9082baa4314f243fed2ce91bf4b", "mode": "diagnose"}` |
| 2 | 01 | `{"execution": "b07dc9082baa4314f243fed2ce91bf4b", "mode": "diagnose"}` |
| 3 | 03 | `{"execution": "c4cd01842b6a4bd417a6ffbeee91bfc3", "mode": "diagnose"}` |
| 4 | 03 | `{"execution": "c4cd01842b6a4bd417a6ffbeee91bfc3", "mode": "diagnose"}` |
| 5 | 04 | `{"execution": "16ddc10c2baa4314f243fed2ce91bf15", "mode": "diagnose"}` |
| 6 | 04 | `{"execution": "16ddc10c2baa4314f243fed2ce91bf15", "mode": "diagnose"}` |

**#99 is live.** `GET /runs/{run_id}` returned the persisted `request` object on every run
(`request_truncated: false`), so unlike v5 this smoke's subjects are recoverable from the instance
itself rather than only from this file.

---

## Run results

All six fired sequentially, each polled to terminal before the next was POSTed — no two runs
overlapped, so LLM contention is not a confound.

### Master table

| Run | Seed | `run_id` | Number | Status | Tool-call order | Tools | Holds | Target | Path |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 01 | `4d5670492b260b54f243fed2ce91bfcc` | TR1000148 | **complete** | `agent_trace`, `schema_lookup` | 2 | 1 | layer 4 | ranked |
| 2 | 01 | `a8b670cd2b6a8f1817a6ffbeee91bfd8` | TR1000149 | **complete** | `agent_trace`, `agent_config`, `schema_lookup` | 3 | **2** | layer 4 | ranked |
| 3 | 03 | `b9d6b0012baa8f1817a6ffbeee91bf4d` | TR1000150 | **complete** | `agent_trace`, `read_artifact`, `query_table` | 3 | 1 | layer 5 | declared |
| 4 | 03 | `41f6f40d2b260b54f243fed2ce91bf28` | TR1000151 | **complete** | `agent_trace`, `schema_lookup` | 2 | 1 | layer 4 | declared |
| 5 | 04 | `8117704d2b260b54f243fed2ce91bfb3` | TR1000152 | **complete** | `agent_trace`, `read_artifact`, `agent_config` | 3 | 1 | layer 3 | declared |
| 6 | 04 | `283770812baa8f1817a6ffbeee91bf0f` | TR1000153 | **complete** | `agent_trace`, `agent_config` | 2 | 1 | layer 3 | declared |

**Terminal states: 6 `complete`, 0 `partial`, 0 `failed`.** 15 tool calls total, median 2.5.
**7 holds across 6 runs** — run 2 held twice; every other run once. Hold count derived from
`sys_generative_ai_log` rows whose `prompt` contains the hold header, 02:20:50 → 02:24:29.

### The tools that were reached, and with what arguments

Argument text is the audit row's `input` field, verbatim.

| Run | Measured tool | Argument | Retrieved evidence? |
|---|---|---|---|
| 1 | `schema_lookup` | `table:incident` | **NO** — malformed table name; tool answered `table_does_not_exist` |
| 2 | `schema_lookup` | `sn_aia_tool` | **YES** — a real table, real lookup |
| 3 | `query_table` | `{"table":"sn_aia_agent_tool_m2m","query":"binding_id_source=tool^binding_name=lookup_routing_rule","fields":"binding_id,tool_name,agent_name,script","limit":10}` | **YES** — well-formed, returned 0 rows, which IS the finding |
| 4 | `schema_lookup` | `table:incident` | **NO** — same malformed name as run 1 |

**This distinction is load-bearing and is not smoothed over.** §H8's test asks for a run that
*reaches* the tool on the seed that needs it. Four runs reached a measured tool; **two of them
(runs 2 and 3) issued a well-formed call that actually returned evidence.** The test is met on
either reading, but the strict reading is 2 of 6, not 4 of 6.

`table:incident` appearing twice, in runs on two different seeds, is a repeated malformation rather
than a slip — the model is prefixing the argument with the parameter name. Worth its own issue; it
is a tool-call-formatting defect, not a depth defect, and it is invisible to any measure that only
counts which tools were invoked.

### Audit-derived layer sweep (§N7: the trail can refute a credit, never confer one)

`_layerToolMap()`: L1 `agent_trace`/`genai_log`/`log_analysis`; L2, L3, L7 `agent_config`;
L4 `schema_lookup`; L5 `query_table`/`log_analysis`; L6 `genai_log`/`log_analysis`.
`read_artifact` maps to no layer.

| Run | Audit-derived sweep | v5 baseline | v4 baseline |
|---|---|---|---|
| 1 | 2/7 (L1, L4) | 4/7 | 1/7 |
| 2 | **5/7** (L1, L2, L3, L4, L7) | 4/7 | 1/7 |
| 3 | 2/7 (L1, L5) | 4/7 | 1/7 |
| 4 | 2/7 (L1, L4) | 4/7 | 1/7 |
| 5 | 4/7 (L1, L2, L3, L7) | 4/7 | 1/7 |
| 6 | 4/7 (L1, L2, L3, L7) | 4/7 | 1/7 |

**Sweep BREADTH fell against v5 on four of six runs, and that is the change working, not failing.**
v5's uniform 4/7 was the arithmetic of one `agent_config` call crediting three layers at once. This
smoke's runs 1, 3 and 4 spent their forced beat on a single-layer tool instead, scoring 2/7 while
reaching evidence v5 never touched. **Breadth of sweep and depth of investigation are different
quantities, and #109 trades the first for the second deliberately.** Any future pass reading
`layers_swept` counts as a progress metric will misread this smoke.

**Distinct tools across all six runs: `agent_trace`, `agent_config`, `read_artifact`,
`schema_lookup`, `query_table`.**

**`genai_log` and `log_analysis` were still not invoked in any run.** Both seed-04 runs — the seed
whose answer sits behind the layer-6 tool — targeted layer 3 by the declared path and released on
`agent_config`. Counting from the 51-run history in §P, the custom harness is now at **57 runs**
with `genai_log` and `log_analysis` never invoked.

### Holds and releases

**Zero capped releases.** No run's transcript carries a `GATE:` note, so all seven holds were
discharged by the trail, not by `MAX_HOLDS`. The two-hold cap was insurance and never spent.

**Run 2 is the C1 mechanism, observed live and survived.** It held, the model called
`agent_config` — which `PaFixReport.schemaText()` advertises for layers 2/3/7 but which is not the
layer-4 target's dedicated tool — the gate did **not** release, it held a second time, and the
model then called `schema_lookup` and was released on the trail. This is exactly the
advertise/accept mismatch #110 describes and the scenario the cap exists to bound; here the model
recovered without the cap being reached.

Under #103's union rule that same `agent_config` call would have released the hold and run 2 would
have ended with no layer-4 evidence — which is precisely what all six v5 runs did.

### The interrogation reached the model intact

Verified against the live prompt in `sys_generative_ai_log`, not inferred from source. Hold-prompt
rows, in order: `cd663c4d2b6a8f1817a6ffbeee91bfe8`, `f7b638cd2b6a8f1817a6ffbeee91bfc7`,
`c0c678cd2b6a8f1817a6ffbeee91bfb6`, `99e6f4012baa8f1817a6ffbeee91bfdf`,
`5507bc0d2b260b54f243fed2ce91bf3f`, `6027784d2b260b54f243fed2ce91bf09`,
`ee3734812baa8f1817a6ffbeee91bfac`.

On run 2's second hold (`c0c678cd2b6a8f1817a6ffbeee91bfb6`), the prompt **contains** both
`Call a tool that reaches layer 4` and `no other line of investigation reaches`, and **does not
contain** `most change your conclusion`. So the directed item 2/3 rendered whole, and the #103
generic wording is absent — the `if/else` added in Task 3 behaving correctly in production, and the
exact condition the negative assertions added in that task's fix round were written to guard.

> **Method note.** This verification was done with targeted `LIKE` matches against the `prompt`
> column rather than by capturing the full prompt text, which runs to tens of KB. The row sys_ids
> above are recorded so any future pass can pull them verbatim.

### Reports

Run 3's report (`TR1000150`) is the clearest artifact of the change, quoted in full in the run
record: layer 5 marked `SWEPT` with reason *"query_table confirmed absence of matching records in
sn_aia_agent_tool_m2m"*, a `CONFIRMED` root cause, and two citations — one `trace`, one `data`,
where the `data` citation is the layer-5 tool this seed needs. **Whether that diagnosis is correct
is a scored pass's question and this smoke does not answer it.**

No run produced an unsupported sweep claim, and no run produced an empty `root_causes`.

**§O6's constraint 1 moved, on one run of two.** Run 2's report cites `priority_stored` — the
discriminating value that sat unused in the turn-2 prompt of both seed-01 runs in v4 and both in
v5. Run 1's does not. Constraint 1 is *evidence in hand and unused*, which this design explicitly
does not address (Q8 predicted it would stay broken), so one run of two using it is an observation
to carry forward, not a claim that it is fixed.
