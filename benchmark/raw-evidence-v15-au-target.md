# Raw evidence — the §AU absence-diagnosis target, four reps

**Date:** 2026-08-12 (instance timestamps UTC, 15:23–15:27)
**Instance:** gpinst01 — Zurich Patch 10 Hotfix 4a
**Arm:** custom only. The native arm does not run `_depthGate` (§AU6) and was not fired.
**Seed:** 05, `agent`+`timeframe` path (the no-execution path) — payload byte-identical to §AR's
**Pre-registration:** `DECISION.md` §AU, committed `f48656d` before any gate code
**Code under test:** `94cb916`
**Issue:** #204

This file records measurements. The verdict against §AU4/§AU5 is §AV in `DECISION.md`.

---

## 0. Pre-flight

`now-sdk install --alias gpinst01` (rollback context `fb2c27df2bae831017a6ffbeee91bf6e`), then two
content probes — the only reliable instrument on this app (§AR5):

| probe | result |
|---|---|
| `sys_script_include` `name=PaAgentLoop^scriptLIKE_safeTraceUnavailable` | **1 record** |
| `sys_script_include` `name=PaFixReport^scriptLIKEtraceUnavailable: function` | **1 record** |
| `PaAgentLoop.sys_updated_on` | `2026-08-02 05:15:25` — **unchanged by the install** |

§AR5 reproduces exactly: the row timestamp does not move on install. Anyone reading
`sys_updated_on` here would conclude the code was three weeks stale.

Local verification before deploy: `npm test` → 33 suites, 1743 tests, all passed;
`now-sdk build` → completed successfully.

---

## 1. The four reps

Run sequentially, one at a time (§AN7's audit-attribution hazard, §O1).

| rep | run | sys_id | terminal | tools invoked | `data` cite | validated |
|---|---|---|---|---|---|---|
| 1 | `TR1000321` | `b3acabdf2b660b10f243fed2ce91bf0b` | `failed` | `agent_config`, `query_table` | **yes** | no — evidence rule |
| 2 | `TR1000322` | `c8ecab132ba60b10f243fed2ce91bfa1` | `failed` | `agent_config`, `query_table` | **yes** | no — unsupported citation |
| 3 | `TR1000323` | `341d6b172bee831017a6ffbeee91bf9a` | `failed` | `agent_config`, `query_table` | **yes** | no — evidence rule + missing reasons |
| 4 | `TR1000324` | `f04da7572bee831017a6ffbeee91bf82` | `complete` | `agent_config`, `query_table` | **yes** | **yes** |

**Every rep invoked exactly `agent_config` + `query_table`.** None called `schema_lookup` or
`read_artifact` — §AR's four reps all called all three.

**Target-flip probes**, over the four run numbers:

| probe | matched |
|---|---|
| `transcriptLIKElayer 5 (ranked) must be reached` | **4 of 4** |
| `transcriptLIKElayer 4 (ranked) must be reached` | **0 of 4** |
| `transcriptLIKEHOLD (empty_trail)` | 4 of 4 |
| `transcriptLIKEterminal action refused` (the `gaps` hold) | 4 of 4 |
| `transcriptLIKEhold cap was reached` | **0 of 4** |
| `status=partial` | **0 of 4** |

The hold note names the LAYER and no tool (§AU5 trigger 3), live in all four, matching the unit
test on `_holdNote`/`_holdBlock`.

## 1.1 The mechanism (rep 1, `TR1000321`)

| seq | actor | event |
|---|---|---|
| 1 | llm | `fix_report` — turn 1, zero tool calls |
| 2 | system | `HOLD (empty_trail)` — the §AQ floor fires |
| 3–4 | llm/tool | `agent_config` (11,674 chars → artifact) |
| 5 | llm | `fix_report` |
| 6 | system | `HOLD: … layer 5 (ranked) must be reached …` — **the §AU target** |
| 7–8 | llm/tool | **`query_table {"table":"task","query":"sys_id=25e32b4b…"}`** |
| 9+ | llm | `fix_report` → validation failure |

## 1.2 THE RESULT THAT MATTERS: every rep queried the WRONG table

All four reps issued the identical call — `query_table` on **`task`**, not
`x_snc_tsbench_ticket`, which is the table the seed's bench ticket lives on. All four got 0 rows
with verdict `genuinely_empty`, and all four turned that into a root cause:

> *"The target record does not exist in the system"* — `root_causes[0].finding`, reps 1, 3, 4
> (rep 2: *"The target record is genuinely absent from the instance"*)

with fixes proposing the record be **created**.

**Compare §AR, the same seed on the pre-§AU gate:** all four reps there reached
`sn_aia_trigger_configuration` `active='0'` — the seed's actual answer, naming the specific gate.

| | §AR (pre-§AU) | §AU (this pass) |
|---|---|---|
| reps calling `query_table` | 0 of 4 | **4 of 4** |
| reps filing a `data` citation | 0 of 4 | **4 of 4** |
| reps passing validation | 2 of 4 | **1 of 4** |
| reps reaching the seed's actual root cause | **4 of 4** | **0 of 4** |

**Determinacy up, correctness collapsed.** This is §AO2's separation demonstrated a second time
and, unlike §AO2, the change under test is what moved it.

## 1.3 Why the wrong table, mechanically

`_layerToolMap` says layer 5 is closed by `query_table`. The hold says *"layer 5 (ranked) must be
reached"* and — correctly, per §H8 item 3 — names no tool, no table, and no subject. **The gate has
no subject operand at all** (§AL/#173: `_normRequest` yields free-form text; nothing on the request
states what the run is diagnosing in comparable form). So "sweep layer 5" is answerable only by the
model choosing a table, and it chose `task` — a plausible reading of "bench ticket" — four times
out of four.

**The general finding, which outranks the scoreboard:** #173's target-blindness is not uniformly
harmless across layers. A *schema* sweep on the wrong table yields a useless-but-inert citation —
which is exactly what §AR's reps did, calling `schema_lookup(x_snc_tsbench_ticket)` and ignoring
the result. A *data* sweep on the wrong table yields `0 rows, genuinely_empty`, which reads as a
**positive finding** and licenses a confident, wrong root cause. Directing the gate at the data
layer therefore converts target-blindness from an inefficiency into a fabrication path.

## 1.4 A second-order effect that cut the other way

Rep 2 was rejected by `_checkCitationSupported`:

> `root_causes[0].evidence[1]: unsupported citation — cites "schema" but this run never invoked a
> tool that reads it (schema_lookup). … Tools invoked this run: query_table, agent_config.`

This is the #204 relabel route being **caught by the unchanged checker**. It passed in §AR only
because those runs called `schema_lookup` to discharge the layer-4 target, which laundered the
mislabel. Removing that call removed the laundering. Registration 2's scope should be re-derived
in light of this rather than assumed from #204's original framing.

Rep 4 — the one that validated — cites `data` + `config`, **both genuinely supported** by tools it
actually invoked. It is the first honestly-sourced two-source report measured on this path. It is
also wrong.

## 1.5 The flat-form draft, live

Rep 3 emitted `layers_swept` in the flat `{"1":"UNAVAILABLE", …}` form (#151 / §AD5) — and the
§AU tie-break still fired (`layer 5 (ranked)` matched, `query_table` called). The
self-canonicalising `traceUnavailable` was therefore load-bearing in practice, not just in
principle: read through the private predicate directly, rep 3's tie-break would have gone silently
inert and reverted to layer 4 with no error anywhere.

---

## 2. Operator notes

1. **`sys_mod_count` is the liveness instrument, not `status`.** `status` stays `queued` for the
   whole run (#73) and `sys_updated_on` on the run row does move — but the audit rows and
   `sys_mod_count` are what show progress. Reps ran 25–45 s once claimed.
2. **Event-queue latency reproduced (§AR note 3).** Reps 2 and 3 sat at `sys_mod_count: 1` for
   ~40 s before being claimed. Not re-fired; both completed normally.
3. **Every terminal read taken through `servicenow_request`** (§AR note 1 / memory).
4. `x_snc_troubleshoot_audit`'s tool column is **`tool_name`**, and `action_type` is
   `intent`/`result` — two rows per dispatch. `target_table` was blank on all rows, confirming
   #183's premise live.
