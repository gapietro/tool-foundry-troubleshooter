# Raw evidence — the §AQ depth-gate empty-trail floor, four reps

**Date:** 2026-08-11 (instance timestamps are UTC, 2026-08-12 01:41–01:47)
**Instance:** gpinst01 — Zurich Patch 10 Hotfix 4a
**Arm:** custom only. The native arm does not run `_depthGate` (§AQ6) and was not fired.
**Seed:** 05, `agent`+`timeframe` path (the no-execution path)
**Pre-registration:** `DECISION.md` §AQ, committed `4173d6a` before any gate code
**Code under test:** `b6d2abe` (PR #195), the floor built to §AQ
**Issue:** #191 part 2

This file records measurements. The verdict against §AQ4/§AQ5 is §AR in `DECISION.md`.

---

## 0. Pre-flight

### 0.1 The floor was merged but NOT deployed — found by probe, not assumed

The first pre-flight probe failed. `sys_script_include` `PaAgentLoop` on gpinst01 contained
neither `empty_trail` (the floor, `b6d2abe`) nor `_dispatchCount` (part 1's corroboration,
`f1f9d7a`). The instance was running code older than **both** #191 commits.

**`sys_updated_on` is worthless as a deploy probe on this app, and actively misleading.** Every
one of the 18 scoped script includes read `2026-08-02` or earlier, and `PaAgentLoop` read
`2026-08-02 05:15:25` — *before* and *after* an install that demonstrably changed its content:

| probe | before install | after install |
|---|---|---|
| `scriptLIKEempty_trail` | 0 records | **1 record** |
| `scriptLIKE_dispatchCount` | 0 records | **1 record** |
| `sys_updated_on` | `2026-08-02 05:15:25` | `2026-08-02 05:15:25` — **unchanged** |

This is §AN7 item 1's rule (*"by `git log <build-commit>..HEAD -- src/` being empty, **not** by a
version string"*) earning itself again, and it generalises: on this app the row timestamp does not
move on install either. **Content probes are the only reliable instrument.**

Two markers that do NOT discriminate, recorded because they were tried first and both matched
against pre-part-1 code: `_checkSweptClaims` (#79b, predates part 1) and `no_audit_rows`
(`PaAuditLogger`, predates part 1). Part 1 *modified* how they interact; it did not introduce
either string. `_dispatchCount` is the marker that separates part 1 from its predecessor.

**Remediation:** `npm test` (33 suites, 1717 tests, green) → `now-sdk build` → `now-sdk install
--alias gpinst01` (rollback context `ad103cdf2b6e831017a6ffbeee91bf9f`) → both content probes
re-run and now match.

### 0.2 The frozen knobs, re-read live after install

| §AQ item | probe | result |
|---|---|---|
| `MAX_EVIDENCE_RETURNS: 0` (§W6) | `PaAgentLoop^scriptLIKEMAX_EVIDENCE_RETURNS: 0` | 1 record ✅ |
| `REQUIRE_RETRIEVAL_TO_RELEASE: false` (§Y6/§AL4) | `PaAgentLoop^scriptLIKEREQUIRE_RETRIEVAL_TO_RELEASE: false` | 1 record ✅ |

Neither was touched. §AQ6 forbids this section from moving either.

### 0.3 Seed 05 fixture, re-read live (not trusted to `sys_updated_on`)

| condition | record | value |
|---|---|---|
| m2m gate ON (mandatory, or the seed is void) | `sn_aia_trigger_agent_usecase_m2m` `ba30d8775b0c4cebb960c58830590d5d` | `active: true` ✅ |
| trigger config OFF (the seeded defect) | `sn_aia_trigger_configuration` `bfb77d6c64884500a80203ee029436ee` | `active: false` ✅ |
| agent present | `sn_aia_agent` `a4b7ef5d793346ea861730c6d28b8f58` | `Seed 05 Ticket Acknowledger` ✅ |

**One fixture artefact left deliberately in place.** `sn_aia_execution_plan`
`7facc9262b2203d817a6ffbeee91bf18` (`status=error`, created 2026-08-09) is the plan generated
during seed-05 qualification when the trigger was temporarily activated (seed spec, "The execution
terminates immediately"). It was present for `TR1000315`/`TR1000316` — the reps that form §AQ4's
0-of-4 baseline — so removing it would have changed fixture state between the baseline and this
pass. Recorded rather than cleaned.

### 0.4 Revert trigger 3 discharged by authoring, before the reps

`_holdBlock`'s `empty_trail` branch (`PaAgentLoop.js:1550-1569`) renders, verbatim:

> This run has not called a single tool, so there is no evidence on record for any claim a report
> could make.
>
> A layer that was never read is not a layer that was swept. Either go and look at one, or mark
> honestly what you have not looked at and say why.

And `_holdNote`'s branch (`:1668`), which is what reaches the transcript:

> `HOLD (empty_trail): terminal action refused — no tool call on record for this run; a report needs something behind it.`

**No tool is named in either.** Per §AQ2 property 4 this branch returns early and renders no
model-authored text, so `_scrubToolNames` has nothing to strip and the §H8 item 3 guarantee rests
entirely on this wording. Checked by reading, which is the only available check.

### 0.5 The request, replicated verbatim from the baseline

Recovered from `TR1000315.request` (the run #191 was filed on) and re-sent byte-identical on all
four reps, so nothing about the prompt varies between baseline and pass:

```json
{"agent":"The agent `Seed 05 Ticket Acknowledger` did not respond to bench ticket `25e32b4b2b228310f243fed2ce91bf22`, which was created with a non-empty short description. No execution plan exists for it.","timeframe":"last 24 hours","mode":"diagnose"}
```

---

## 1. The four reps

Run sequentially, one at a time, custom arm only (§AN7's audit-attribution hazard, §O1).

| rep | run | sys_id | terminal | audit rows | tool calls | `empty_trail` hold | capped exit | verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | `TR1000317` | `4490bc532bae831017a6ffbeee91bfc1` | `failed` | 6 | 3 | **yes** | no | evidence rule |
| 2 | `TR1000318` | `a5e0b8d32bae831017a6ffbeee91bf5a` | `complete` | 6 | 3 | **yes** | no | **`fix_report validated`** |
| 3 | `TR1000319` | `18217c532b6ec310f243fed2ce91bfd0` | `failed` | 8 | 4 | **yes** | no | evidence rule |
| 4 | `TR1000320` | `bc71f8d32b6ec310f243fed2ce91bf39` | `complete` | 6 | 3 | **yes** | no | **`fix_report validated`** |

Audit rows run at exactly 2× the tool-call count on every rep (`PaAuditLogger` writes a pair per
dispatch). AQ-1 measures non-emptiness, which is unaffected either way; the ratio is recorded
because a reader counting rows as calls would overstate breadth by double.

**`empty_trail` column** — server-side probe, `transcriptLIKEHOLD (empty_trail)` over the four run
numbers: **4 of 4 matched.**
**`capped exit` column** — `transcriptLIKEhold cap was reached` (the `_cappedNote()` string, which
`:431` appends as a system transcript row whenever `gate.capped === true`): **0 of 4 matched.**

### 1.1 The mechanism, from rep 1's transcript

Reps 1–4 all take the same shape. Rep 1 (`TR1000317`) verbatim by sequence:

| seq | actor | event |
|---|---|---|
| 1 | llm | `fix_report` — **on turn 1, zero tool calls** (the #191 defect, reproduced) |
| 2 | system | **`HOLD (empty_trail)`** — the floor fires |
| 3 | llm | `tool_call` `agent_config` — **the model complies** |
| 4 | tool | `agent_config` returns (11,674 chars → artifact) |
| 5 | llm | `fix_report` |
| 6 | system | `HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 4, 5, 6 declared NOT_SWEPT with no tool call behind them.` |
| 7–8 | llm/tool | `read_artifact` (offset 4000) |
| 9–10 | llm/tool | `schema_lookup` `x_snc_tsbench_ticket` |
| 11 | llm | `fix_report` |
| 12 | llm | `fix_report` (repair turn) |
| 13 | system | `fix_report failed validation and could not be repaired: root_causes[0] (sn_aia_trigger_configuration): evidence rule violation — … Cite at least TWO DISTINCT sources … found 1.` |

**The second-order effect is larger than the floor itself, and was not predicted.** §AQ1 ruled the
gate *unholdable by construction* against a report that admits nothing: `unsweptGaps` counts only
`NOT_SWEPT`, so a blanket false `SWEPT` declares no gap and the gate releases. In every rep, the
turn after the floor fires the model stops claiming a blanket sweep and declares layers honestly
`NOT_SWEPT` — which makes the **pre-existing `gaps` hold reachable** (seq 6). The floor did not
merely buy one tool call; it restored the operand the rest of the gate was missing. §AQ2 property 3
claimed the floor "intercepts one path only" and that remains true of the *code*; the behavioural
consequence downstream was not anticipated by §AQ and is recorded here as a finding, not a claim.

### 1.2 §AQ2 property 5 — verified live, not inferred

Property 5 is the one the review added because the floor records nothing (`_heldTools` stays
null), so the I1 clear (`_anyOf(null, …)`) is false and the hold block would otherwise survive a
compliant tool call — landing on exactly the turn AQ-1 and AQ-2 measure.

Probed directly against `sys_generative_ai_log`, `promptLIKEThis run has not called a single tool`
over the pass window:

| prompt sys_id | created | run |
|---|---|---|
| `67a0b0df2b2ec310f243fed2ce91bf02` | 01:42:12 | TR1000317 |
| `88f078132b6ec310f243fed2ce91bf23` | 01:43:20 | TR1000318 |
| `605170d32b6ec310f243fed2ce91bf57` | 01:45:00 | TR1000319 |
| `d9a130572b6ec310f243fed2ce91bf3a` | 01:46:25 | TR1000320 |

**Exactly four — one per run.** The block appears in the prompt immediately after the floor fires
and in no later prompt, so it does not survive the compliant dispatch. The `_holdActiveKind ===
'empty_trail'` clear (`:401`) works.

Corollary worth carrying to **#196**: the stale-HOLD defect that issue describes does **not**
reproduce on the floor path, because #195 built the clear for it. #196's `no_layer_report` path is
untouched by this pass and its defect stands unmeasured.

### 1.3 Why no rep took the capped exit

`MAX_HOLDS` is 2 and every rep spent exactly 2 holds (`empty_trail` + `gaps`), so the cap check at
`:1094` was live on the third terminal action in all four runs. None was recorded `capped:true`.

The reason is R1 (`:1074-1083`): the trail check runs **before** the cap, so a model that complies
on the turn after hold #2 releases genuinely rather than by exhaustion. That ordering was put in
deliberately, with a comment saying it once ran the other way and *"told the benchmark the gate had
given up on the one run where it worked."* All four reps are that case. R1 is the reason revert
trigger 2 reads 0 of 4 rather than 4 of 4.

### 1.4 The two validated reports

`TR1000318` and `TR1000320` produced near-identical reports. `TR1000318` verbatim on the parts that
matter:

```json
"root_causes": [{
  "layer": "7",
  "component": "sn_aia_trigger_configuration",
  "finding": "Trigger inactive",
  "evidence": [
    {"source": "config", "detail": "Trigger 'Seed 05 Bench Ticket Created' has active='0' (sys_id: bfb77d6c64884500a80203ee029436ee)"},
    {"source": "schema", "detail": "Trigger configuration requires active='1' for execution (table: sn_aia_trigger_configuration)"}
  ],
  "confidence": "CONFIRMED"
}],
"fixes": [{"target_type": "configuration", "target": "sn_aia_trigger_configuration",
           "current": "active='0'", "proposed": "active='1'", …}]
```

Both name `sn_aia_trigger_configuration.active` — the **specific** gate, which is what seed 05's
expected diagnosis requires (naming only "the use case is inactive" scores partial, per the seed's
"The two gates").

**This is not a scored result and must not be quoted as one.** §AQ4 files no prediction on any
gate or pass-level figure, and ruling 6 (§AI4, carried at §AN) forbids claiming one afterwards. No
scorer was run, no packet was built, no rubric was applied. What is recorded here is that two runs
passed the harness's own `fix_report` validator — a determinacy fact — and what those reports say.
§AO2 is the standing warning that a report can be fully determinate and still wrong.

**Both validated reports still declare layers 5 and 6 `NOT_SWEPT`** and released anyway, because
the `gaps` hold's recorded set was discharged by `read_artifact`/`schema_lookup` under R1. That is
the target-blind release §AL already ruled on (#173) reproducing, not a new defect.

### 1.5 The two failed reps

Both failed on the same rule — the two-distinct-sources evidence requirement — with one distinct
source found:

- `TR1000317`: `root_causes[0] (sn_aia_trigger_configuration)` … found 1
- `TR1000319`: `root_causes[0] (sn_aia_trigger_agent_usecase_m2m)` … found 1

`TR1000319` names the m2m gate, which is the gate that is **ON**. Recorded as observed; correctness
is out of scope here (§AQ6) and this pass scores nothing.

---

## 2. Operator notes — hazards met, for the next pass

1. **`servicenow_query` served stale rows; `servicenow_request` did not.** Rep 3 read `status:
   queued` repeatedly through `servicenow_query` while `servicenow_request` on the same sys_id
   returned `status: failed` with a populated `error`. Every terminal-state read in this file was
   taken through `servicenow_request`. A pass that polls with `servicenow_query` can conclude a run
   is stuck when it finished minutes earlier.
2. **`status` stays `queued` for the whole run.** There is no `running` transition on the custom
   path — that is issue #73, and it means "still `queued`" carries no information about liveness.
   Use `x_snc_troubleshoot_audit` row growth or `sys_updated_on` instead.
3. **Event-queue latency is bursty.** Rep 4's `x_snc_troubleshoot.run.start` event sat at
   `state=ready` (never claimed) while unrelated `flow.fire` events processed normally, then was
   claimed and ran to completion. Not a harness defect; do not re-fire an analyze call on a run
   whose event is merely `ready`, or the pass gains a duplicate row.
