# Design: the v4 scored pass

**Issue:** #98
**Date:** 2026-08-03
**Version at run time:** `2026.08.0301` (both harnesses)
**Status:** approved, pre-implementation

---

## 1. Why this pass exists

Five substantive changes have landed since the last scored pass — v3, `2026.08.0220`, 0/10:

| # | Change | Measured by |
|---|---|---|
| #85 | illustrative statistic removed from `agent_trace` output | v4 smoke, 4 runs — passenger |
| #91 | `excerptPriority` replaces blind head/tail truncation | 2-run smoke — first seeded answer ever cited |
| #93 | UNCONFIRMED / `would_confirm` exemption (path C) | 2-run smoke — first `complete` on seed 03 |
| #89 | blind rule extended to bind tool output and tool descriptions | no runs |
| #96 | `layers_swept` derived from the audit trail | no runs; corrected one scored cell |

Two of them produced firsts in the project's history. Both firsts rest on two-run smokes against a
single seed. Nothing since v3 carries a scored number.

**What the pass buys.** A readable baseline plus a native control, *and* a score check on #91/#93.
Both, with the first as the honest justification: §L4 predicts seed 03 files its cause at layer 1,
so `root_cause_layer_correct = 0` for that seed regardless of how clean the rest of the report is.
A green gate is not a realistic outcome, and selling the pass on score would make a success look
like a failure. The pass earns its cost by making the depth work that follows a **single readable
variable**.

**The objection this design answers.** §J5 wrote that *"running ten more rows against an unchanged
termination rule would buy another 0/10 and no new information"*, and put #88 ahead of the pass for
that reason. #88 was built and refuted, so the termination rule is in fact still unchanged. What
changed instead is the evidence channel (#91) and the contract (#93) — neither of which existed
when §J5 was written. The pass is no longer "unchanged everything"; it is "unchanged stop rule,
changed everything the stop rule acts on".

---

## 2. What moves, and what does not

**No product code changes in this pass.** This is the design, not an omission.

| Held byte-identical | Reason |
|---|---|
| `docs/agent/agent-doctor-instructions.md` | native-shared; any edit converts the native delta from drift into drift+edit |
| `src/server/PaScriptToolAdapter.js` | §K5's sequencing — propagate `excerptPriority` *after* the custom measurement is in, not during it |
| everything under `src/server/` | the pass measures deployed `2026.08.0301`, not a variant of it |

Repo changes are confined to `benchmark/` documents, `CHANGELOG.md`, and the version bump.

**Version note.** Both harnesses run at deployed `2026.08.0301`. The bump to `2026.08.0302` happens
when the *results* PR merges and changes no deployed artifact. Stated explicitly so a later reader
does not read the bump as code moving mid-pass.

### 2.1 Why nothing native-facing moves

Section 3 commits to re-running all ten native rows. That is only a **drift measurement** if
native's inputs are byte-identical to what produced the standing rows in
`benchmark/scorecard-agent-doctor.md`. Every candidate edit — `agent-doctor-instructions.md:48`,
`:67`, §K5's propagation — changes native's inputs, and each one converts the native delta from
*drift* into *drift + change*, unattributable. Editing any of them would spend ten runs to buy a
measurement and spoil it in the same pass.

### 2.2 §I4 confound 2 is already closed — by #93, not by an edit

§M7 carries an instruction to resolve §I4 confound 2 (`agent-doctor-instructions.md:48`) inside
this pass. That instruction was inherited from §J5, written at v3, **before #93 existed**.

Confound 2's claim was that `:48` states a categorical trace-plus-one rule while the contract has
no UNCONFIRMED exemption, so a model that correctly diagnoses a seed from the trace alone cannot
say so. `PaFixReport.schemaText()` now reads:

> `root_causes: array of {layer, component, finding, evidence, confidence?, would_confirm?}` …
> EVERY root cause needs at least one "trace" evidence entry PLUS at least one of … **UNLESS**
> nothing ever ran … **OR you mark the cause UNCONFIRMED, in which case see the unconfirmed rule
> below**; … `would_confirm`, REQUIRED when confidence is UNCONFIRMED and your evidence is
> trace-only, is a string naming the layer that would confirm the cause

`:48`'s categorical sentence and `:50`'s escape — *"name the candidate root cause, name the layer
that would confirm it, and mark it UNCONFIRMED"* — read together now **match** the contract they
were said to contradict. The confound closed when the contract moved. No edit is required, and
this pass records that with the `schemaText()` evidence rather than performing a no-op edit.

`:67` (§M5's parked *"where defects live"* line) stays in place. §M5 already ruled it domain
guidance rather than an answer, deriving from R-22 — a whole-table measurement on this instance —
rather than from seed 04. §M5 parked it only because moving it relocates an unmeasured native
baseline. This pass supplies a better reason to leave it: the baseline is now being measured, and
editing the line would cost that measurement for no correctness gain on something already ruled
not-a-leak.

---

## 3. Coverage: all ten native rows

`benchmark/README.md`'s Phase 1b protocol addendum currently specifies:

- custom — full 10 rows;
- native — **seed 2 only, 2 fresh runs**, with seeds 1/3/4/5's eight rows standing from Task 12
  (2026-08-02).

Its stated reason for not re-running the unchanged seeds is that doing so *"measures model
response drift on identical inputs, not the harness."*

**This design overrides that, and amending the README is part of the work.** Two grounds:

1. **The addendum does not deliver what §M7 asks for.** §M7 requires native *"re-measured the same
   day"* to close §I4 confound 3. Eight of native's ten rows dated 2026-08-02 against ten custom
   rows dated today closes confound 3 for one seed out of five.
2. **Its reason for declining is the measurement now wanted.** Model drift is §I4 confound 4 —
   *"unmeasured and unbounded across all three passes."* The README was written before drift was
   identified as a confound. What it calls a waste is the first drift measurement this project
   would have.

The delta between native's v4 rows and the standing Task 12 rows **is** that measurement. Standing
rows are therefore preserved verbatim (§6), not overwritten. §7.1 records the one thing that delta
needs before it is clean — the standing rows were operator-scored, and comparing them against
subagent-scored v4 rows would mix model drift with scorer drift.

---

## 4. Pre-flight, before any scored run

1. **Prove the deployed code is the code.** Byte-compare live `sn_aia_agent.instructions` for Agent
   Doctor against `docs/agent/agent-doctor-instructions.md`, and live `sys_script_include` bodies
   for `PaFixReport`, `PaArtifactStore`, `PaToolRegistry` and `PaScriptToolAdapter` against
   `src/server/`. Task 9 established this check; it is what makes "v4 measured `2026.08.0301`" a
   fact rather than an assumption.
2. **Fixture validity**, per `benchmark/README.md` protocol step 2:
   - seed 2 in its **v2** construction — exactly one active tool (`measure_request`) bound to Seed
     02 Request Router;
   - seed 4's installed `summarise_ticket` capability sys_id **matching** the instance record —
     `92ff62af516741769c437feb88c80ef3` on gpinst01;
   - seed 5's `sn_aia_trigger_agent_usecase_m2m.active = true` **with**
     `sn_aia_trigger_configuration.active = false` (the latter is the seeded defect);
   - bench ticket rows present for seeds 1, 4 and 5, sys_ids recorded.

   A mismatch **voids** that seed per `scorecard-template.md` §A3. The 8-valid-run floor applies.
3. **Budget knobs read fresh** — `sn_aia.continuous_tool_execution_limit` and
   `max_auto_executions` on all seven attached tools. Recorded per pass, so "budget was never the
   constraint" remains a measurement rather than an inherited belief.
4. **Smoke gate, both harnesses**, against execution `c9d63a932bda8b9417a6ffbeee91bfd0`. Pass/fail,
   unscored, not one of the 20 rows. Task 9's bar stands: **terminal with structurally valid
   output**, not correct diagnosis — custom's Task 9 smoke was structurally valid and
   substantively wrong, and that was ruled an acceptable smoke outcome.

---

## 5. The runs

**20 runs** — 5 seeds × 2 runs × 2 harnesses.

**Sequencing: interleaved by seed.** For each seed in turn: native run 1, custom run 1, native run
2, custom run 2. Intra-day model drift then spreads across both harnesses rather than aligning with
the harness boundary — the short-timescale version of the different-day gap §3 exists to close.
Fixture state for a seed is also touched once per block rather than revisited.

**Execution paths.** Native via `servicenow_aia_execute`, a fresh conversation per run (the
documented MCP execution path; DESIGN.md R-2/R-3 validate it against the panel path for this
concern). Custom via `POST /analyze {"execution": "...", "mode": "diagnose"}` then polling
`GET /runs/{id}` to terminal, at `/api/x_snc_troubleshoot/v1/troubleshooter`.

**Run identity**, recorded per row and **verified distinct before scoring**: native
`_agentic_context_.conversation_id`; custom the `x_snc_troubleshoot_run` sys_id. `PaRunAnchor`'s
"one anchor per user per 30 min" fallback is the hazard here, and interleaving makes near-in-time
runs more likely, not less — so distinctness is checked rather than assumed.

**Harness failure.** A run that fails *as a harness* — no terminal output — is re-fired once, with
both attempts recorded. A harness that cannot reach terminal is data, not a do-over.

---

## 6. Measurement, computed before scoring

Computed from the instance and handed to scorers as **given data**, not left to be inferred from
the Fix Report's prose:

| Measure | Source |
|---|---|
| `layers_swept` | audit-derived per §N7 — `PaAuditLogger.toolCalls(runId)`; `agent_config`'s `sections_returned` maps `instructions`→L2, `tools`→L3, `triggers`→L7, `overview`→no layer |
| `layers_available` | the §E3 query (expected 7/7) |
| tool-call count, tool names in invocation order | `x_snc_troubleshoot_audit` intent rows, creation order |
| LLM-call count | native: `sn_aia_gen_ai_m2m` rows keyed to the run's `type=agent, order=100` execution task. custom: `actor:'llm'` transcript entries |

§N7's asymmetry is load-bearing and preserved: the trail can **refute** a layer credit but never
**confer** one. Receiving a section is necessary, not sufficient; whether the diagnosis *used* what
it received is still the scorer's judgement. That asymmetry only holds if the trail is read
independently of, and before, the report.

**A digest miss is not an absence** (§N8). Payloads are digested past 4,000 chars, so a string in
the elided middle is invisible to a text search while present in what the model received. Every
measure above rests on a value the digest preserves or on a positive hit; any future measure that
searches payload text must state which of the two it found.

---

## 7. Scoring

**20 blind subagents, one per row** — plus up to 10 more for §7.1's re-scores, for a maximum of 30.
Matching v3's method, so v3↔v4 remains comparable — and now
necessary rather than merely careful: between DECISION.md §J–§N and the design conversation, the
operator has read the seeds' expected answers, §L4's prediction that seed 03 files at layer 1, and
the specific citation (`rules_in_table: 0`) a passing run produces. Neither operator nor assistant
can score v4 blind.

Each scorer receives, and only receives:

- the rubric — `scorecard-template.md` §A (4 columns, 6 points), §A2 (`passes_gate`), §A3 (void
  runs);
- that seed's spec file;
- that run's Fix Report and transcript;
- §6's computed measurements for that run.

Each scorer does **not** receive: `benchmark/DECISION.md`, any other row, any other seed's spec, or
the design conversation.

Scorers return the four rubric columns, `passes_gate`, and notes. The operator aggregates and does
not re-score. Native and custom rows go through the identical rubric and the identical scorer
population — a comparison pass cannot afford two scorers wearing one name.

### 7.1 The scorer confound in the drift measurement

§3 claims the delta between native's v4 rows and the standing Task 12 rows is a drift measurement.
As stated, it is not a clean one: **Task 12's rows were operator-scored** (§I4 records that v3 moved
to blind agents precisely because the operator had by then read the v2 rows), while v4's rows are
subagent-scored. The delta would conflate model drift with scorer drift, and it is the same class of
defect this pass exists to avoid.

**Remedy, at no instance cost: blind re-score the ten standing native rows** from their preserved
artifacts, using the same subagent population and the same rubric, and compare v4-native against
*that* re-scored baseline rather than against the operator's numbers. Ten additional scorers, no
additional runs. `scorecard-agent-doctor.md` carries each row's `conversation_id`, and §E1's
two-step query (conversation → `x_snc_troubleshoot_run.conversation_ref` → audit) reaches the trail.

**Recoverability is checked at pre-flight, not assumed.** The Task 12 runs date from 2026-08-02;
whether each run's full Fix Report text is still retrievable from its conversation records is a
question for the instance, not for this document. If a row's artifacts cannot be recovered, that
row's drift comparison is reported against the operator score **with the scorer confound named on
that row**, rather than silently mixed with the clean ones.

The operator's original numbers are never overwritten — the re-scores are recorded as a separate,
labelled column, so a disagreement between operator and blind scorer on an unchanged artifact is
itself visible data about the rubric.

---

## 8. Recording

| Artifact | Change |
|---|---|
| `benchmark/raw-evidence-v4.md` | new — raw artifacts for all 20 runs |
| `benchmark/scorecard-custom-harness.md` | v4 section **appended**; v2/v3 sections preserved |
| `benchmark/scorecard-agent-doctor.md` | v4 section **appended**; Task 12 standing rows preserved verbatim — they are the drift baseline. §7.1's blind re-scores added as a separate labelled column, never overwriting the operator's numbers |
| `benchmark/README.md` | protocol addendum amended to all-10-native, superseding the seed-2-only asymmetry, with §3's reasoning |
| `benchmark/DECISION.md` | new **§O** — verdict, gate tally per harness, drift measurement, depth measurement, and an explicit "what this does not establish" |
| `package.json`, `README.md` badge, `CHANGELOG.md` | version `2026.08.0302` |

---

## 9. Predictions, filed before running

Filed in advance so the result cannot be read post-hoc:

- **Custom gate: 0–2/10.** §L4 predicts seed 03 files its cause at layer 1, so
  `root_cause_layer_correct = 0` there however clean the report.
- **Custom depth: 1–2 tool calls per run**, and §H8's acceptance test — one run reaching
  `schema_lookup`, `query_table` or `genai_log` on the seed that needs it — likely still unmet.
- **Native: near 8/10**, if drift is small. **A large native deviation is the finding**, not noise,
  and would retroactively qualify every cross-day comparison in DECISION.md §G–§N.

A 0/10 that matches these is a confirmed prediction, not a disappointment.

---

## 10. Scope boundary

**This work ends at the measurement.** Depth — §K4 remedy 2 / §L7, the `PaAgentLoop` stop/continue
condition — is separate work, designed against the baseline this produces.

Two reasons. The pass's entire value is being a clean single-variable baseline, and folding the
depth change into the same plan invites firing it before the baseline is scored, recreating the
confound one more time. And §K4 remedy 2 is currently a direction rather than a specification: 20
fresh rows with audit-derived tool-call counts are precisely the input that would turn it into one.

---

## 11. Mechanics and risk

Issue #98 → branch `chore/benchmark-v4-scored-pass` → PR to `main`, per CLAUDE.md. Docs-only diff;
no product code.

| Risk | Handling |
|---|---|
| Now LLM provider unavailable on gpinst01 | it has dropped before; pre-flight smoke catches it before any scored run is spent |
| Wall clock | native ran 204s at smoke; 20 runs plus scoring is realistically 2–4 hours |
| A seed voids at pre-flight | recorded per `scorecard-template.md` §A3; the 8-valid-run floor governs whether the pass still reads |
| `servicenow_connect` on gpinst01 | keychain auth requires explicit `username="admin"` |
