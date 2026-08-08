# v11 — the sized round (`2026.08.0703` + the cap edit, #121 steps 3–4)

Run 2026-08-07 on gpinst01 (Zurich Patch 10 Hotfix 3). **Custom arm only, seed-01 targets,
A/B/A/B, strictly sequential.**

> ## THIS IS NOT A SCORED PASS
>
> No native control, no blind packets, no independent scorers, no rubric applied — therefore **no
> `passes_gate`, no /6 total, and no row here may be entered on any scorecard.** Terminal states,
> transcript-derived fire counts and audit-derived retrieval verdicts only.
>
> The round is governed by `DECISION.md` §W, which was **written and merged before a single run
> fired** (PR #132, `2d11e4d`, 2026-08-07 22:50Z). The first run of this round posted at
> 2026-08-07 23:04:32Z. That ordering is checkable in git history rather than asserted here.

---

## 1. Protocol

**Shape.** Diagnostic runs by the **custom** arm only
(`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`), request body
`{"execution": "<plan sys_id>", "mode": "diagnose"}` — byte-identical to the v9 and v10 custom-arm
bodies.

**Targets** (§W7), alternating strictly A/B/A/B so a drift in instance behaviour cannot load onto
one target:

| arm | execution plan sys_id | v9 row | v9 terminal |
|---|---|---|---|
| **A** | `4a5bb19d2b66cf54f243fed2ce91bf57` | 07 | failed — evidence/citation shortfall |
| **B** | `45bbfd112ba6cf54f243fed2ce91bfcb` | 08 | failed — three `unsupported citation` findings |

**Targets were reused, not re-triggered.** No new seeded executions, no bench ticket inserted, no
fixture touched. All four v9 plans re-read live before run 1 and all four remain `state: completed`,
`state_reason` empty, created 2026-08-06 02:00–02:03, unchanged.

**Strictly sequential.** Each run confirmed terminal before the next was posted. This is mechanical,
not tidiness — `PaRunAnchor`'s 30-min-per-user fallback would otherwise glue one run's audit rows
onto another's anchor (v9 §1).

**Measurement source.** `EVIDENCE RETURN` and `INCOMPLETE:` are `x_snc_troubleshoot_run.transcript`
entries; retrieval verdicts are `x_snc_troubleshoot_audit` rows. Never report prose.

**Access path.** foundry MCP tools throughout (`servicenow_connect` with `authType="keychain"`, then
`servicenow_request` / `servicenow_query`). No shell credential read, no `curl`, no `security`.

### 1.1 Two measurement corrections made before run 1, recorded because both would have failed silently

**(a) `partial` is not readable from `status`.** `PaAgentLoop`'s bound-triggered stop closes the run
**`complete`** and reports `outcome: 'partial'` — and `outcome` is `run()`'s *return value*, not a
persisted column on `x_snc_troubleshoot_run`. Reading §W5's partial count off `status` would have
returned **0 for every run in the round regardless of what happened**, and the ≥3 revert trigger
could never have fired. The durable marker is the literal word `INCOMPLETE:` written into the
transcript (`PaAgentLoop.js:1648`), which is what this round counts.

**(b) §W7's probe 2 is unambiguous, but not for the reason it looks.** `MAX_EVIDENCE_RETURNS: 2` and
the docblock's `maxEvidenceReturns: 2` differ by **underscores, not merely case**, so the probe
cannot collide with the comment whether or not the instance's `LIKE` is case-sensitive. Checked
rather than assumed, because a case-insensitive `LIKE` against a camelCase comment is exactly the
shape of defect that would make probe 2 report success on an unflipped build.

Both are measurement-instrument facts, not results, and neither touches `N` or `D`.

---

## 2. Pre-flight verification

All read live before run 1, none assumed. §W7 requires four; the target and dictionary checks are
carried from v10's protocol.

| § | Check | Method | Result |
|---|---|---|---|
| W7-1 | Build under test | `sys_app.version` | `2026.08.0703` — see note below |
| W7-2 | The cap is raised | `sys_script_include` `name=PaAgentLoop^scriptLIKEMAX_EVIDENCE_RETURNS: 2` | **1 record** |
| W7-2 | " (negative) | `…^scriptLIKEMAX_EVIDENCE_RETURNS: 0` | **0 records** |
| W7-3 | The `retrieval` column exists | `sys_dictionary` `name=x_snc_troubleshoot_audit^element=retrieval` | 1 record, `internal_type=choice`, `default_value` **empty** |
| W7-4 | The other switch is off | `…^scriptLIKEREQUIRE_RETRIEVAL_TO_RELEASE: false` | **1 record** |
| W7-4 | " (negative) | `…^scriptLIKEREQUIRE_RETRIEVAL_TO_RELEASE: true` | **0 records** |
| — | Targets intact | `sn_aia_execution_plan` × 4 | all `completed`, `state_reason` empty, unchanged |

> **`sys_app.version` is NOT the discriminator this round, and reads `2026.08.0703` on purpose.**
> §W1 defines the build under test as *"`2026.08.0703` with one edit: `MAX_EVIDENCE_RETURNS: 2`"*.
> The version field was deliberately not bumped, because bumping it would have been a second edit
> and would have made §W1's one-edit claim false. **Probe W7-2 is what proves the edit landed** —
> and it is the pair of probes, positive and negative, not either alone.
>
> Carried from v10 and still true: `now-sdk install` does **not** stamp `sys_updated_on` on the
> installed script includes. `sys_updated_on` is not a deploy check on this project. The
> `scriptLIKE` probes are.

**Deploy.** `now-sdk build` (SDK 4.9.2) then `now-sdk install --alias gpinst01`, both successful.
Rollback context: `47b5233d2b264f94f243fed2ce91bfb5`.

### 2.1 Nine unit tests fail on the round build, deliberately

`npm test` on the round branch: **9 failed, 1331 passed**. All nine are `#81` dormant-default
guards — one asserting that at the shipped default an evidence rejection takes the repair turn, and
eight asserting the constant is `0` (six of those are type-rejection tests checking that a bad
`maxEvidenceReturns` option *leaves the default at* `0`, so the rejection logic itself is untouched).

**They were not weakened to make the branch green.** They exist to stop the cap drifting off `0`
silently, which is precisely what this build does on purpose; the guard firing is the guard working.
If §W6 ratifies the cap, updating them belongs to that PR. If §W6 reverts, the branch is discarded.

---

## 3. The runs

**Stopping rule (§W4), restated because it constrains what was allowed to be measured during the
round:** sample until `D` = 12, hard cap `n` = 60. The rule reads `D` only — whether a run fired an
`EVIDENCE RETURN` — and never `N`. **`N` was not computed mid-round**, and the per-run measurement
taken during the round was deliberately restricted to two transcript `LIKE` probes
(`EVIDENCE RETURN`, `INCOMPLETE:`) which cannot expose a retrieval verdict.

### 3.1 The round closed at the cap

| Quantity | Value |
|---|---|
| `n` (runs posted, all terminal) | **60** — the §W4 hard cap, reached |
| Arm balance | **30 A / 30 B**, strict alternation, verified by `sysparm_group_by=execution_ref` |
| Terminal states | 56 `complete`, 4 `failed`, **0 `partial`** |
| **`D`** (runs firing ≥1 `EVIDENCE RETURN`) | **10** |
| **`N`** (of those, ≥1 post-note `retrieval=ok`) | **1** |
| `N / D` | **0.10** |

`D` = 10 lands in §W4's second exit — `n` reached 60 with `8 ≤ D < 12`. §W6 is applied, **and the
reduced power is reported explicitly**: at `D` = 8 the false-ratify rate is 11.4%, not the 5.4% §W3
targeted at `D` = 12. That caveat biases toward *ratifying*, and the round did not ratify.

Run window 23:04:32Z–23:50:14Z. Runs `TR1000176`–`TR1000235`.

### 3.2 The ten firing runs, and what each did after the note

Every row below was read from the run's own `transcript`: the `seq` of the FIRST `EVIDENCE RETURN`,
then whether any `actor:'tool'` entry carries a HIGHER `seq` (§U8.2's structural test — sequence,
not clock). **All ten were verified individually. None was inferred from the pattern.**

| run | arm | terminal | first note | tool call after it? | `retrieval=ok` after it? |
|---|---|---|---|---|---|
| TR1000182 | A | failed | seq 12 | **no** — 2 rewrites, then shape-class failure | — |
| TR1000201 | B | complete | seq 10 (+2/2 at 12) | **no** — spent BOTH returns on rewrites | — |
| TR1000202 | A | complete | seq 10 | **no** — 1 rewrite, validated | — |
| TR1000208 | A | failed | seq 12 | **no** — 2 rewrites, then shape-class failure | — |
| TR1000210 | A | complete | seq 12 | **no** — 1 rewrite, validated | — |
| TR1000214 | A | failed | seq 12 | **no** — 2 rewrites, then shape-class failure | — |
| TR1000218 | A | failed | seq 12 | **no** — 2 rewrites, then shape-class failure | — |
| TR1000231 | B | complete | seq 10 | **no** — 1 rewrite, validated | — |
| TR1000233 | B | complete | seq 10 (+2/2 at 12) | **no** — spent BOTH returns on rewrites | — |
| **TR1000235** | **B** | **complete** | **seq 10** | **YES — `genai_log` at seq 12** | **YES** |

**`N` = 1.** Nine of the ten runs were told, in terms, *"fix_report not accepted — 1 evidence
problem(s) need a tool call, not a rewrite"* — and rewrote anyway. Two of them (TR1000201,
TR1000233) burned both permitted returns doing it.

### 3.3 Why the naive numerator would have said 10 of 10, and did not

A bare `run=<sys_id>^action_type=result^retrieval=ok` query matches **all ten** firing runs. Every
run opens with a gate-driven sweep — `agent_trace`, `read_artifact`, sometimes `agent_config`,
`schema_lookup` — and several of those score `retrieval=ok` on their own merits.

Those retrievals happen **before** the note and are therefore not evidence about the return. §V2's
"`sys_created_on` after the first note" clause is what separates 1 from 10, and it is the whole
reason §V1 exists. **Dropping that clause would have inflated the numerator by 10×** and ratified
the mechanism on the strength of tool calls the run was always going to make.

This is §V1's defect — *"counts a call rather than a retrieval"* — in its third and most seductive
form, and the pre-registration caught it.

### 3.4 The one conversion, and the #129 repair that made it legible

TR1000235's post-note call was `genai_log`, invoked as `execution:45bbfd112ba6cf54f243fed2ce91bfcb`
— the **parameter-prefixed argument shape**. #125's routing fix read it correctly, recording the
note *"The argument arrived as … the parameter name prefixed onto its own value. It was read as the
`execution` parameter."* The call returned `llm_call_rows: 3` with all five `reads` at `ok`, so it
scored `retrieval=ok`.

**In §U9.1 the identical malformation returned `entries: []` and would have scored `none`.** Had
#129 not landed before this round, the round's single conversion would very likely have been
recorded as a non-conversion, and `N` would have been **0**. That is the concrete return on §V6
condition 3 and on the decision to repair the argument path *before* spending the round — and it
cuts against the change, since the repair is what let the one success be counted at all.

### 3.5 Every `failed` run was a firing run

4 of 60 runs terminated `failed`; all four (TR1000182, 208, 214, 218) are in the `D` = 10 set, and
all four failed on the **same shape-class** problem: *"fixes is required and must be an array;
verification is required and must be a non-empty string."*

**Recorded as an observation, not as a §W6 input.** `failed` is not `partial` — no bound tripped,
no `INCOMPLETE:` marker — so §W5's revert trigger is untouched, and §W6 has no row for it. But the
association is not nothing: the runs that got an evidence rejection are also the runs that went on
to emit a malformed report. Whether the extra rejection turn *causes* the shape-class failure is
**not established here** and would need its own pre-registration.

### 3.6 Seed-03 regression guard (not part of `n` or `D`)

4 runs after the round closed — `TR1000236`–`TR1000239`, 2 against each seed-03 plan.

| Check (§U2 U-b) | Result |
|---|---|
| Terminal states | 4 / 4 `complete` |
| `partial` terminations | **0** |
| `EVIDENCE RETURN` fired | 0 |

**No regression.** The guard is clean, and it stays a guard: it contributes nothing to `N` or `D`.

---

## 4. Verdict — §W6 applied once, after the round closed

Evaluated in §W6's stated order:

| Condition | Test | Outcome |
|---|---|---|
| ≥3 `partial` among firing runs → REVERT, overrides all | 0 partials in 60 runs | **does not fire** |
| `N/D ≥ 1/2` → the return is enabled | 1/10 = 0.10 | **no** |
| **`N/D < 1/2` → `MAX_EVIDENCE_RETURNS` stays `0`, and #81 is done** | 0.10 < 0.5 | **✅ THIS ROW** |
| `D < 8` → no verdict, investigate the fire rate | `D` = 10 | not reached |

> ### `MAX_EVIDENCE_RETURNS` STAYS AT `0`. #81 IS DONE — NOT RE-MEASURED A THIRD TIME.

**This is a refutation, not an undecided round.** §W3 warned that a revert at an `N/D` near one half
should be reported as *"not distinguishable from the threshold"* rather than as a refutation. That
caveat does **not** apply: the 95% Wilson interval on 1-of-10 is approximately **[0.018, 0.404]**,
and the 0.5 threshold lies outside it. The observed rate is also below §V4's 1-of-4 baseline (0.25),
though those two intervals overlap heavily and this round does not establish a decline.

**What was refuted, precisely.** §U8.3 set the bar at one half because the evidence return earns its
machinery — a classifier, a cap, a headroom guard, a state block, a draft stash, a terminal path —
only if the move that is *otherwise impossible* (go and read the missing source) actually happens at
a non-marginal rate. At 1 in 10, the model overwhelmingly chose a move it could already have made
for free. **The mechanism is, in the round's own pre-registered terms, mostly a more expensive
repair turn.**

**Instance restored.** The round build was reverted and redeployed: `MAX_EVIDENCE_RETURNS: 0` → 1
record, `: 2` → 0 records, `REQUIRE_RETRIEVAL_TO_RELEASE: false` → 1 record, all probe-verified
after the reinstall. Rollback context `c3b3fff92bee839817a6ffbeee91bfc9`. Unit suite back to
**1340 / 1340 passing** — the nine dormant-default guards go green exactly when the cap returns to
`0`, which is the cleanest available confirmation that they were pinned to the right constant.

### 4.1 What this round does NOT decide

- **Nothing about `REQUIRE_RETRIEVAL_TO_RELEASE`** (§W1). It was `false` for all 60 runs,
  probe-verified before and after. It remains blocked by §V3's unresolved `'DENIED'` ruling.
- **Nothing about the fire rate as a target.** `D`/`n` = 10/60 ≈ 0.17 is well below §U9.1's 4-of-8
  baseline, but the stopping rule was designed to be indifferent to it and the round is not powered
  to call it a change.
- **Nothing about diagnostic quality.** See §5.

---

## 5. What this round cannot establish

Everything in §U5, §V7 and §W8 stands, unsoftened. §T3 remains the governing result — six custom
rows reached layer 4 and all six concluded at layer 1 — and nothing here moves it. The metric counts
whether a run that was told its evidence was insufficient went and retrieved something. It does not
ask whether the right source was read, whether the citation supports a true cause, or whether any
score would move. **Retrieving evidence is not diagnosing.**

**Known limitation, carried from §U7 and §W7 and not fixed:** the evidence-problem TEXT is not
persisted for a run that later validates, so *why* a given run returned cannot be read back off the
instance. Any reconstruction below is labelled as one.
