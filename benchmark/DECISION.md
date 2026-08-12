# Task 12 — Harness Decision

**Date:** 2026-08-02 · **Instance:** gpinst01 (Zurich Patch 10 Hotfix 3) · **Agent under test:**
Agent Doctor `e1392946828940e5a708fc51b0a5e954` (scope `x_snc_troubleshoot`), all 7 diagnostic
tools attached and active · **Seeds:** `x_snc_tsbench` fixture app, 5 seeds, doubled runs ·
**Scorecard:** `scorecard-agent-doctor.md` (10 valid rows, 0 void) · **Issue:** #42

---

## A. The verdict

| | |
|---|---|
| `sum(passes_gate)` | **7** |
| Valid runs | **10** (no void rows) |
| Gate result | **7 / 10 = 70.0%** |
| Band (per `IMPLEMENTATION_PLAN.md` Task 12 / ADR Decision 0.5, proportional form per scorecard §A3) | **Middle — ≥ 50% and < 80%** |

> **Decision: Native is kept for lightweight triage; the custom deep-diagnosis harness
> (Phase 1b) is built.**

The pass count and percentage above are computed from the `passes_gate` column only (§A2 rule:
`root_cause_layer_correct == 2 AND fix_usable_unedited == 1`), not re-derived from /6 totals.

### What the 7 passes and 3 fails were

| Seed | Run 1 | Run 2 | Note |
|---|---|---|---|
| 01 tool-schema mismatch | pass 6/6 | pass 6/6 | Both runs found the word→Integer mismatch from both sides; run 2 produced an appliable code fix |
| 02 ambiguous instruction | fail 2/6 | fail 2/6 | Scored strictly vs the spec's expected layer 2; see §D2 — the seed construction is refuted |
| 03 missing data | pass 6/6 | pass 6/6 | `genuinely_empty` verdict confirmed by two independent reads in both runs |
| 04 GenAI unmapped | pass 6/6 | **fail 3/6** | Run 1 found the dangling `api` and the exact healthy repoint value; run 2 fell for the `connection` decoy in full (canonical 2/0/1/0 row) |
| 05 inactive use case | pass 6/6 | pass 6/6 | Both runs named the specific gate (`sn_aia_trigger_configuration.active`), m2m verified intact — full credit under the two-gates rule |

---

## B. Budget knobs (R-4) — read, not assumed

Both knobs were read fresh for every scored run (values identical across all 10):

- **`sn_aia.continuous_tool_execution_limit` = 25** on gpinst01. Provenance is ambiguous in the
  same way P2 recorded for keynexus01: `sys_updated_on` is bit-identical to `sys_created_on`
  (2024-11-08 07:21:07 — the never-modified signature) yet `sys_updated_by = admin`, not blank.
- **`sn_aia_agent_tool_m2m.max_auto_executions` = 10 for all 7 attached tools** — the dictionary
  default and the instance-typical value (477 of 483 production rows). Unlike Phase 0's E2 probe
  (which ran at a raised 20), **this benchmark ran at default bindings**, so the per-binding knob
  introduces no transferability caveat.
- No run approached either ceiling: max observed tool calls in a run was 14 (S4R1) against the
  25 property, and no single tool exceeded 8 calls (read_artifact, S1R2 audit trail) against its
  10.

**The shipped OOB default of `sn_aia.continuous_tool_execution_limit` is UNKNOWN.** P2 could not
establish it and nothing in this task did either. This document does **not** treat gpinst01's `25`
as the shipped default. Consequently, **transferability of these results to a default-configured
customer instance is unverified** until the true shipped default is established (fresh instance,
release notes, or ServiceNow documentation). Because no run used more than 14 continuous tool
calls, the result would survive any default ≥ 14 — but that bound is an observation about these
runs, not a verified platform default.

## C. Protocol notes — what was substituted or gated

1. **Smoke-test gate: PASS** (required before scoring). Agent Doctor diagnosed the designated
   specimen `c9d63a932bda8b9417a6ffbeee91bfd0` — invisible from the plan header — naming
   `context_processing_script` line 42 `InternalError` with correct message-record evidence.
2. **The PaEvidenceCollector de-risking step was substituted**, as `benchmark/README.md` requires
   recording: the collector is unbuilt, so a manual pass invoked each tool core directly (via a
   temporary `/scope_probe/derisk` REST route inside `x_snc_troubleshoot`, house pattern from Task
   5's `anchor_selftest`, removed after use). Every seed's defect was confirmed visible to the
   tool roster from the product scope *before* scoring: seed 1 (`priority` = Integer via
   schema_lookup), seed 2 (instruction text via agent_config), seed 3 (`genuinely_empty` via
   query_table), seed 4 (definition row with `api=000…000` via query_table — **note:** genai_log
   `check_config` alone cannot reach it, §D3), seed 5 (trigger `active=0` vs `m2m_active=1` via
   agent_config).
3. **Seed setup verified, not assumed:** seed 4's capability sys_id (`92ff62af…`) was substituted
   into the Fluent source, rebuilt, reinstalled, and confirmed present in the installed
   `sn_aia_tool.script`; seed 5's m2m gate was PATCHed on and re-read `true`. Hence zero void
   rows. The seed-4 install was NOT refused (the global-table writes landed), so the primary
   construction — not the fallback — was scored.
4. **Blind rule held**: Agent Doctor's instructions and tools carry no seed knowledge. One leak
   worth recording: the seed agents' own `description` fields say *"Benchmark seed — deliberately
   broken"*, which two runs read via agent_config and reported as an advisory finding. It reveals
   *that* the agent is a seed, not *which* defect it carries; no diagnosis was derived from it.

## D. Findings that feed Phase 1b and playbook v2 (the failure notes)

### D1. The headline capability is real

Seven runs produced correct root causes with usable fixes, evidence citing both trace and
config/schema, honest layer-sweep accounting, data-redaction markers, and — twice — the exact
healthy sys_id to repoint to, discovered independently. The native harness with these seven tools
is genuinely useful for triage. That is what the middle band keeps.

### D2. Seed 2's construction is refuted (both its runs scored fail, strictly)

**Measured:** a ServiceNow ReAct agent with **zero bound tools** is cancelled by the engine before
the LLM is ever invoked (*"I am unable to complete the task since I have no instructions or
actions"*, 737ms, output digest `{}`). The seed's predicted mechanism — the ambiguous instruction
drives the model to invent a group or stall — can never execute, because the ambiguity is never
reached. Agent Doctor twice diagnosed the runtime reality (layer 3, "no tools bound", fix: bind a
lookup/routing tool — half of the seed spec's own sanctioned fix) and was scored 0 on layer per
the spec's expected `instruction`. The runs are **not void** (§A3: the seed was exactly in its
specified state) but they measure layer-3 diagnosis of a mechanical absence, not layer-2 diagnosis
of instruction ambiguity. **No valid scored run exercised layer-2 diagnosis in this benchmark.**
Seed 2 v2 must give the agent at least one (irrelevant or weak) tool so the engine enters its loop
and the instruction defect can actually manifest. Filed as a follow-up; the Phase 1b re-run must
use the corrected seed for both harnesses to stay comparable.

### D3. The decoy result is the most important negative signal

S4's doubled runs split: run 1 read the **definition** row, found `api = 00000000000000000000000000000000`,
and proposed the correct repoint; run 2 read only the **parent capability** record, declared the
empty `connection` the primary cause, and proposed "bind a connection" — a well-formed no-op
(canonical 2/0/1/0 decoy row). This is the documented "inconsistent behavior on identical inputs"
failure mode, caught by the doubled-run protocol working as designed. Feeds two requirements:

- **Playbook v2:** the GenAI-stack section must instruct: *always read
  `sys_one_extend_capability_definition` (api, api_type, connection) for the capability under
  suspicion; an empty `connection` is a normal state (15.7% of rows on gpinst01) and is never a
  root cause on its own.*
- **Tool gap (`PaToolGenAiLog`):** `check_config` samples the first 100 of ~2026 definitions
  ordered by name, so an `x_*` capability can never appear in it; the mode even says "narrow the
  check by naming a capability **once that argument exists**". Add a capability-name/sys_id filter
  argument. (Run 1 succeeded only because the model pivoted to `query_table`.)

### D4. Wrong-table guesses

Three runs guessed table names instead of deriving them: `incident` for the bench ticket (S1R1,
self-corrected), `sn_tsbench_ticket` (S4R2 — not self-corrected, produced a false secondary
finding "table does not exist" plus a fix proposing to create a table that exists as
`x_snc_tsbench_ticket`). The tools behaved correctly (reported honest absence for the wrong name);
the diagnosis layer misused them. Playbook v2: *derive the target table from trace evidence (tool
script, execution context) before querying; a table-does-not-exist finding on a guessed name is a
finding about the guess.*

### D5. Harness observations (not scoring-relevant, Phase 1b inputs)

- **Anchor lifecycle:** every run's `x_snc_troubleshoot_run` row stays `status=running` forever —
  nothing closes it. Fine for the benchmark; a run-lifecycle close-out belongs in Phase 1b's
  PaRunManager.
- **Anchor race, handled:** S5R2's tool-call batch created two run rows for one conversation
  (TR1000047/48); all audit rows adopted the deterministic winner exactly as the R-3 design
  specifies. First live confirmation of that path under a real concurrent batch.
- **`assists_consumed` is not measurable live** on this instance (`sn_value_ai_consumption`
  empty in the window); LLM call counts recorded as proxy. If assist-unit accounting matters for
  the Phase 1b comparison, a measurement source must be found first.
- **Wall-clock:** scored runs took 92–224s (median ≈ 150s); the two shortest (92/95s, seed 5)
  were also full-credit runs — depth and duration are not proportional.
- **Layer-sweep honesty held up:** run reports' sweep tables matched the audit-derived values in 7 of
  10 rows; the 3 mismatches (seed 3's "implicit" L4, admitted-unpulled L2) were claims of MORE
  coverage than derived — the direction the E2 discipline exists to catch.

## E. What Phase 1b is, given this outcome

Per the gate table: **native stays as the lightweight-triage front door; the custom
deep-diagnosis harness is built.** Scope inputs from this benchmark, beyond the ADR's component
roster: enforce definition-row reads in the GenAI layer (D3), a table-derivation rule (D4),
seed-2 v2 before the comparison re-run (D2), the `check_config` capability filter (D3), run
lifecycle close-out (D5), and an assist-unit measurement source (D5). The Phase 1b re-run must
execute the same seeds — with seed 2 corrected on **both** harnesses — under the same doubled-run,
blind, audit-derived protocol so the two harnesses are compared on identical evidence.

## F. LLD items this run closes or re-opens

- **LLD §8 item 8 (seed-4 efficacy) — CLOSES.** Previously "RE-OPEN until Task 12: an inference
  from table statistics, not an observed failure". Observed 2026-08-02: the dangling `api` produced
  a real runtime failure (`OneExtendUtil.execute` → `status:"error"`, "Plan invalid…",
  `capabilities:{}`) in the seed execution `16ddc10c2baa4314f243fed2ce91bf15`, and the genai_stack
  diagnosis was produced from it (S4R1). The `connection`-as-decoy scoring rule was exercised for
  real (S4R2).
- **LLD §5 seed-5 run-as question — STAYS OPEN.** The trigger was never activated (its inactive
  state *is* the seed), so whether it fires once `active=true` with empty run-as remains
  unmeasured. It gates any future use of seed 5 in an activated state, not this benchmark.
- **Seed spec prediction banners** — seed 1's measured `priority_stored` is **null** (not `0`,
  not `''`); seed 2's mechanism is refuted (D2); seed 4's observed signature matches the primary
  construction. The three spec files are updated alongside this document.

---

## G. Task 10 addendum — the Phase 1b comparison re-run verdict

**Date:** 2026-08-02 · **Instance:** gpinst01 (Zurich Patch 10 Hotfix 3) · **Scorecard:**
`benchmark/scorecard-custom-harness.md` (20 rows: 10 custom + 10 native-comparison, 0 void) ·
Protocol: `benchmark/README.md` "The Phase 1b comparison re-run protocol" (Task 9).

This section measures **both** harnesses against the same 5 seeds under the same doubled-run,
blind, audit-derived protocol §A used throughout this document, and states the comparison
verdict the Phase 1b milestone ("deep diagnosis passes the same seeded-failure benchmark", PRD)
depends on.

### G1. The side-by-side gate table

Same §A2 pass rule for both — `passes_gate = 1 iff root_cause_layer_correct == 2 AND
fix_usable_unedited == 1` — nothing else feeds it, computed identically for every row in both
harnesses.

| | Native (comparison total) | Custom (Phase 1b harness) |
|---|---|---|
| Valid runs | 10 / 10 | 10 / 10 |
| `sum(passes_gate)` | **8** | **0** |
| Gate result | **8 / 10 = 80.0%** | **0 / 10 = 0.0%** |
| Band (proportional, §A3) | Top (≥ 80%) | Bottom (< 50%) |
| `layers_swept` (typical) | 4–6 of 7, varies by run — real, audit-confirmed sweeps | **1/7 (L1) on all 10 rows, no exception** — `agent_trace` + one `read_artifact` page, then straight to a fix attempt |
| Evidence quality | Config/schema citations correspond to tools actually called | **Config/schema citations were fabricated in all 7 `complete` rows** — `agent_config` was never called in any of the 10 runs (audit-confirmed), yet every completed row's Fix Report includes a `config`- or `schema`-sourced evidence entry citing it. One row (seed 4, run 1) goes further: across its three separate root causes, each fabricated evidence entry is literally labeled `"(hypothetical example)"` in the model's own output text |
| Wall-clock | 178–232s (seed 2 rows measured this task) | 5–14s |
| Void rows | 0 | 0 |

### G2. What changed between the two harness measurements — the confound surface, on the record

Three things changed on the shared instance between Task 12 (native's original 70% score) and
this comparison, and all three apply **identically to both harnesses** being compared here —
neither harness is being measured against a different playing field than the other:

1. **Seed 2 v1 → v2** (D2 above). v1 bound zero tools; the ReAct engine cancels a tool-less agent
   before the LLM ever runs, so no valid run — native or custom — could ever reach layer-2
   diagnosis under v1. v2 binds one deliberately irrelevant tool so the engine's loop actually
   starts and the instruction ambiguity can manifest. This is the seed both harnesses were
   re-run against fresh in Task 10 (native: 2 new rows; custom: seeds 1/3/4 reused Task 12's
   still-valid execution records, but seed 2 needed a fresh trigger for both).
2. **The `check_config` capability-name filter** (PR #49, merged 2026-08-01, before Task 1) —
   lets `genai_log`'s `check_config` mode reach an `x_*`-prefixed capability instead of being
   capped at the first 100 name-ordered rows. Confirmed byte-identical between Task 7's build and
   this comparison (Task 9's precondition check). Available to both harnesses' `genai_log` tool
   equally; the custom harness never called `genai_log` in any of the 10 seed-4 rows where this
   filter would have mattered, so the filter's benefit is unexercised in this comparison, not
   asymmetrically applied.
3. **Playbook v2** (PR #50, merged 2026-08-01, before Task 1) — the "derive table names, never
   guess them" and "the GenAI stack: read the definition row" sections. **Correction (final
   whole-branch review, 2026-08-02):** the claim below that this text is native-only, and that "the
   two harnesses have never shared a playbook," is **false** and is corrected here rather than
   silently edited, per this project's evidence-over-claims discipline. `PaAgentLoop._loadPlaybook()`
   / `_defaultPlaybook()` (`src/server/PaAgentLoop.js:54-67`, `:656-672`) reads
   `sn_aia_agent.instructions` off the SAME installed `Agent Doctor` record (`AGENT_NAME: 'Agent
   Doctor'`, `:119`) that backs native's NASK agent — the identical Fluent-authored text, not a
   third hand-typed copy; the class's own header comment documents this explicitly as the reason no
   playbook text is ever embedded in `PaAgentLoop` itself. The `ScriptAction` async worker
   (`async-wiring.now.ts:100-104`) injects no playbook of its own, so at runtime the custom harness
   falls through to this same shared read by construction, not by accident.
   **Live-verified for this comparison, not assumed:** `sys_generative_ai_log` prompt content was
   inspected (MCP, read-only, gpinst01) for all 10 custom-harness benchmark runs (created
   2026-08-02 06:25:01–06:25:12; run ids in `benchmark/scorecard-custom-harness.md`). The first-step
   prompt for run `06819e402ba6c314f243fed2ce91bf9f` (`sys_generative_ai_log` sys_id
   `068116c42ba2cbd417a6ffbeee91bf05`) contains the "## The seven-layer sweep", "## Derive table
   names, never guess them", and "## The GenAI stack: read the definition row" headings verbatim —
   playbook v2's own text — not `PaAgentLoop`'s 4-line `_FALLBACK_PLAYBOOK`. **Playbook v2 was in
   effect for the 10 runs scored in this comparison.** It is therefore not a confound in the sense
   originally written here (a difference between what the two harnesses were given) — it is a
   shared input, present on both sides, whose presence did not prevent the 0/10 result. That
   redirects the causal question in G3/G4 away from "does the custom harness need its own playbook
   pass" — it already had this playbook — toward what actually stopped a compliant, well-instructed
   sweep from happening. See G3a.

**Net effect on interpretation:** the native score moving from 70% (Task 12) to 80% (this
comparison) is attributable entirely to item 1 (seed 2's confound being repaired) plus ordinary
doubled-run variance on that one seed (1 of 2 new rows passed) — not to any change in native's
own tooling, playbook, or the instance's AI Agent Studio configuration, which are unchanged
between the two measurements for seeds 1/3/4/5 (Task 9's precondition checks, re-confirmed by
this task for seeds 4/5's void-gate state). The custom harness's 0% has no such history to
compare against — this is its first scored measurement — so there is nothing to attribute it to
except the harness's own behavior, measured fresh in this task.

### G3. Why the custom harness scored 0/10 — audit-derived, not assumed

Every one of the custom harness's 10 runs, across all five seeds, called exactly two tools —
`agent_trace` once and `read_artifact` for one page — before either producing a Fix Report or
failing `PaFixReport.validate`. This was verified by the audit trail
(`x_snc_troubleshoot_audit` where `run=<run_id>^action_type=result`, distinct `tool_name`) for
every row, not inferred from the runs' own self-reported `layers_swept`, several of which
**claimed** `agent_config` had been consulted when the audit trail shows it never was. Three
compounding failure modes, present in different mixes across the 10 rows:

1. **Premature termination.** The loop jumps to a fix attempt after a single trace read, never
   exercising `agent_config`, `schema_lookup`, `query_table`, `genai_log`, or `log_analysis` — the
   five tools that carry layers 2–6, i.e. every layer except the trace itself. This matches Task
   7/9's smoke-specimen finding exactly, now confirmed as this harness's *systemic* behavior
   across 5 independent seeds rather than a property of one specimen.
2. **Fabricated corroborating evidence.** All 7 "complete" rows produced at least one
   `root_causes[].evidence` entry labeled `source: "config"` or `source: "schema"` with
   specific-sounding detail (a `DENIED` permission status for a table the seed never touches;
   schema version numbers; tool ids; claims that "the agent_config tool showed...") that no tool
   call in the transcript could have produced — `agent_config` was never called in any of the 10
   runs, audit-confirmed. One row (seed 4, run 1) goes further: across its three separate root
   causes, each fabricated evidence entry is literally labeled `"(hypothetical example)"` in the
   output text — the model narrating, and flagging, its own invention rather than reporting an
   absence honestly.
3. **Wrong layer, every time.** Not one of the 10 runs named the seed's expected root-cause layer.
   Where a specific mechanism was named, it was frequently unrelated to anything in the seed's own
   configuration — seed 5 run 2's root cause cites a `Create Incident` tool that does not exist in
   this seed's tool set, or any seed's.

This is not a marginal or borderline result requiring judgment calls to reach — `sum(passes_gate)`
is unambiguously 0 because `root_cause_layer_correct` is 0 on every row.

### G3a. The leading identified mechanical cause — the 200-character observation channel

> **⚠ REFUTED (2026-08-02, §H3). Read §H before using anything in this subsection.** The
> "leading identified mechanical cause" attribution below is **wrong**. The 200-character
> observation channel was real and is described accurately here, but it was not what produced the
> 0/10: the harness never received a diagnostic target at all (issue #77), so the baseline's
> two-call signature — the observation this subsection sets out to explain — has a different
> cause entirely. The mechanism description is left standing because it is correct as a
> description of the code; the causal claim is retracted. Corrected in place rather than deleted,
> per this document's own discipline.

**Added (final whole-branch review, 2026-08-02).** The three failure modes above are not simply
"the model reasoned poorly" — the loop's own transcript-construction path caps what the model can
ever see of a tool's result, regardless of how instructed it is. `_dispatchTool` appends every
tool's result to the transcript (`src/server/PaAgentLoop.js:258-263`); `PaRunManager._normalizeEntry`
runs every `result_digest` through `_digest()`, which truncates to 200 characters
(`src/server/PaRunManager.js:256-257`, `_digest` at `:831-835`); `_buildPrompt` renders only this
digested transcript back into the next reasoning prompt (`src/server/PaAgentLoop.js:429-461`); the
full result object is otherwise discarded — `_step()` returns `{terminal:false}` without it
(`:234-235`). A `read_artifact` page as large as 4,000 characters is therefore crushed to roughly
200 characters before the model can reason over it a second time, which mechanically explains the
observed profile in every one of the 10 rows: one `agent_trace` call, one `read_artifact` page, then
a fix attempt. A model that cannot see more than ~200 characters of what it already fetched has no
way to know that paging further would surface anything new — and the same starvation plausibly
feeds failure mode 2 above (fabricated evidence): a model reasoning from a mostly-blank digest has
nothing real left to cite. `test/PaAgentLoop.test.js`'s `fakeRunManager` (`:63-67`) does not digest,
so no existing unit test would catch this or verify a fix. ~~This is the **leading identified
mechanical cause** of the 0/10 result~~ — **retracted, see §H3**: the causal claim in that sentence
does not survive the evidence gathered when the fix was measured. Fix and required re-run tracked in
[issue #72](https://github.com/gapietro/tool-foundry-troubleshooter/issues/72); the actual mechanical
cause of the baseline profile is [issue #77](https://github.com/gapietro/tool-foundry-troubleshooter/issues/77).

### G4. The verdict

**Native remains the deep-diagnosis front door; the custom harness (Phase 1b) does not yet clear
the bar its own benchmark sets.** Native's 80% comparison score sits in the top band; the custom
harness's 0% sits in the bottom band by a wide margin — not a close call decided by scoring
judgment calls, but a harness whose reasoning loop terminates before reaching the tools that
would let it answer correctly, on every seed, in every run.

This is a legitimate benchmark outcome, not a benchmark failure. Per the Task 10 brief: *"the
benchmark's job is to measure that honestly, not to make it pass."* Tasks 7 and 9 both flagged this
exact behavior on the smoke specimen (premature Fix Report, shallow sweep) as a known,
unresolved, playbook-governed reasoning-quality gap explicitly out of scope for those tasks'
authorization. This comparison is the first time that gap has been measured across the full
5-seed benchmark rather than one specimen, and it generalizes without exception.

**What this does not mean:** it does not mean Phase 1b's infrastructure is broken. `/analyze`,
`/runs/{id}`, the async worker, the Evidence Bundle, `PaFixReport`'s validation/repair path, and
the REST surface all ran to completion correctly on every one of the 10 rows (10/10 reached a
terminal state, 0 stuck runs, 0 void rows).

**Correction (final whole-branch review, 2026-08-02):** the paragraph below originally attributed
the defect to the reasoning loop's diagnostic "depth and honesty" in the abstract and prescribed a
playbook/prompt-discipline pass as the next step. Both are corrected here rather than silently
edited. The playbook attribution was unsafe and is now known to be wrong: playbook v2 was already
in effect, on the SAME shared `Agent Doctor` instructions record used by native, for every one of
these 10 runs (G2 item 3, live-verified against `sys_generative_ai_log`) — so "a playbook pass on
the custom harness's own (non-shared) playbook" was never an available fix; there is no separate
playbook to pass. The **leading identified mechanical cause**, named in G3a, is the 200-character
observation channel: `PaRunManager`'s transcript digesting caps every tool result the model can see
on its next reasoning step to ~200 characters, regardless of how much real evidence a tool call
actually returned or how well-instructed the model is. The natural next step is fixing that channel
— carrying the full (thresholded, not digested-to-200-chars) result of the most recent tool dispatch
into the next prompt, with an integration test proving a >200-character payload survives into the
second prompt — followed by a re-run of this same benchmark before any claim that the custom
harness is production-ready for deep diagnosis. This fix and re-run are tracked in
[issue #72](https://github.com/gapietro/tool-foundry-troubleshooter/issues/72); the benchmark
re-run happens only after that fix lands, not before and not instead of it. Until then, native
stays the recommended path for both triage and deep diagnosis on this instance, and the Phase 1b
milestone ("deep diagnosis passes the same seeded-failure benchmark") is **not met** by this
measurement — that verdict and the underlying 0/10 measurement are unchanged by this correction.

**Second correction (2026-08-02, §H3):** the sentence above naming the 200-character observation
channel as "the **leading identified mechanical cause**" is **retracted** for the same reason §G3a
is. The next step it prescribes (fix the channel, then re-run) was taken, and the re-run is §H. The
0/10 measurement itself, and the "native remains the front door" verdict, are again unchanged — but
the *explanation* of the 0/10 in this section and in §G3a is wrong and is superseded by §H2–§H3.

---

## H. Post-fix re-measurement of the custom harness (#72 observation channel, #77 target fix)

**Date:** 2026-08-02 · **Instance:** gpinst01 (Zurich Patch 10 Hotfix 3) · **App version:**
2026.08.0218 (`d318b10`), installed to gpinst01 · **Branch:** `fix/phase1b-observation-channel` ·
**Scorecard:** `benchmark/scorecard-custom-harness.md` § "Custom harness scorecard — v2" (10 rows,
0 void) · **Raw evidence:** `.superpowers/sdd/2026-08-02-observation-channel/benchmark-raw-evidence-v2.md` ·
**Issues:** #72 (the fix and required re-run), #77, #78, #79.

This section reports the re-run §G4 said had to happen before any claim that the custom harness is
ready for deep diagnosis. It also corrects §G3a, which was wrong.

### H1. The number

| | |
|---|---|
| Valid runs | **10** / 10 (0 void) |
| `sum(passes_gate)` | **1** |
| Gate result | **1 / 10 = 10.0%** |
| Rubric points | **6 / 60** — all six from one run |
| Band (proportional, §A3) | **Bottom (< 50%)** |
| Prior custom measurement (§G, version 2026.08.0216) | 0 / 10 = 0.0%, 0 / 60 |
| Native (recorded, §G1 — **not** re-measured, see H7) | **8 / 10 = 80.0%** |

Per seed, doubled runs: **01 0/2 · 02 0/2 · 03 0/2 · 04 0/2 · 05 1/2.**

The single pass is run `61bd09d82b6ac714f243fed2ce91bfae` (seed 05, run 2), scoring 6/6: layer 7,
`sn_aia_trigger_configuration` `bfb77d6c64884500a80203ee029436ee`, `active` `"0"` → `"1"`, with one
genuine `config` citation and one genuine `trace` citation, both backed by audit-confirmed tool
calls. It is the only run in either custom pass with no fabricated evidence anywhere in its report.

Up from 0/10. Still the bottom band, and still 7 gate passes behind native.

### H2. The first re-run attempt was void — ten runs discarded, not scored

A full 10-run benchmark was executed at version **2026.08.0217** (immediately after the #72 work
deployed) and **discarded before scoring**. It did not measure the observation channel, because the
harness under test was blind: all ten runs made exactly one `agent_trace` call passing the
hallucinated literal `"sn_aia_execution_plan_sys_id_here"`.

Evidence, live on gpinst01:

- The rendered prompt (`sys_generative_ai_log` `3ac3cd542b6e8fd417a6ffbeee91bfbc`) shows
  `## Diagnostic request` = *"(no specific target supplied in the request — work from the
  transcript/context below, or answer that a target is needed)"*.
- The event row **did** carry the target: `sysevent` `3cc3c9142ba6c714f243fed2ce91bf03` has
  `parm2 = {"execution":"b07dc9082baa4314f243fed2ce91bf4b"}`, and `x_snc_troubleshoot_run.execution_ref`
  was likewise correct.

**Root cause (issue #77):** `event.parm2` arrives from the platform as a **Rhino Java String**, not
a JavaScript string. `typeof` on it is `'object'`, so `PaAgentLoop._normRequest`
(`src/server/PaAgentLoop.js:619-634`, pre-fix) took `_isPlainObject` to be true and returned the Java
String as though it were the already-parsed request object; `r.execution` was then `undefined` and
the prompt emitted its no-target fallback. Jest could not catch it — the suite passes a real JS
string, which `_normRequest` handles correctly. Fixed by coercing with `String(event.parm2)` in the
`ScriptAction` (verified byte-correct in the generated `sysevent_script_action_0e5d43bc.xml`) plus a
defensive guard in `_normRequest`; commits `822a570`, `37a3e70`, shipped as `d318b10`.

Those ten rows are **discarded, not scored**. The 1/10 in H1 comes entirely from the ten runs fired
after the fix, and only after a live gate: the rendered prompt was read on a smoke run and confirmed
to carry the real execution sys_id before any row was counted.

### H3. Correction to §G3a — the observation channel was not the cause of the 0/10

§G3a named the 200-character observation channel "**the leading identified mechanical cause**" of the
0/10 result, and §G4 repeated it. **That attribution is refuted.** It is corrected here and marked in
place at both sites rather than edited away.

The observation §G3a set out to explain was the baseline's signature: exactly two tool calls in every
one of the ten rows, `agent_trace` then one `read_artifact` page. That signature has a different
origin. Baseline run `648112c42ba2cbd417a6ffbeee91bfc2` called `agent_trace` with `input: {}` — **no
target**. With no argument, that tool returns its documented pick-list of recent execution plans; the
pick-list was large enough to exceed `PaArtifactStore.THRESHOLD_CHARS` (4000,
`src/server/PaArtifactStore.js:81`), so it was offloaded to an artifact, and `read_artifact` paged it.
That is the entire two-call pattern. It was never a model deciding to page a diagnostic trace; it was
a model paging a menu, because the harness had never been told what to diagnose.

The corroborating detail is the profile *change* in the void attempt: 2 calls → 1. That was not a
regression from the #72 work. This time the model invented a placeholder sys_id instead of calling
with `{}`, and a bogus sys_id errors rather than returning a large pick-list, so there was nothing to
page.

**What the wrong attribution misled.** It set the premise of issue #72 and the entire
`fix/phase1b-observation-channel` branch — six implementation tasks — pointed at a channel that was
real but was not the binding constraint on the 0/10. It also gave §G4 a next step ("fix that channel,
then re-run") that was insufficient on its own: the first re-run taken on that basis was void (H2).
The 0/10 measurement itself stands; only its explanation was wrong. Cross-reference: issue #77.

Not everything in §G3a falls. The mechanism it describes — `_dispatchTool` appending results,
`PaRunManager._normalizeEntry` digesting to 200 characters, `_buildPrompt` rendering only the digest —
was accurately read from the code, and H4 shows the channel was genuinely starved. What is retracted
is the claim that this starvation is what produced the 0/10.

### H4. What the observation-channel work did achieve — live-verified

Two live confirmations on gpinst01, both verified by the controller against the platform rather than
taken from a run's own narration:

1. **The full envelope now reaches the second prompt.** In the smoke run
   `6e1b8d1c2b2ac714f243fed2ce91bfac`, the second prompt (`sys_generative_ai_log`
   `602b411c2bee8fd417a6ffbeee91bf89`) renders the tool result in the new block form carrying the
   full ~4,300-character dispatch envelope — `total_length` **18710**, an `artifact_id`, `pages` **5**,
   and a substantive excerpt naming the agent, plan state, timings and task/tool counts. Under the
   200-character digest, nearly all of that was invisible. This is the first live confirmation that
   the #72 work does what it claims.
2. **The model paged deeper instead of re-reading the head.** In run
   `ebdc41942b6ac714f243fed2ce91bff1` the second tool call was `read_artifact` with
   `offset: 4000` — page 2, not page 1. That is the accumulate-across-pages behaviour the work was
   built to enable, observed in the wild. (All three `read_artifact` calls in the pass — runs 3, 4
   and 6 — used `offset: 4000`; run 6's is the one verified independently.)

Also measured on the branch, not claimed: `PROMPT_DIGEST_CHARS` was re-derived against the
JSON-stringified envelope rather than the bare page after a final review found the original 4000
insufficient (measured expansion 4000 → 4,371, 1.093×; 2.01× pathological worst case), and set to
**8500** (`src/server/PaRunManager.js:158`).

The channel works. It was not the thing standing between this harness and a correct diagnosis.

### H5. The failure modes that survive

- **Fabricated citations: 3 of 10 runs, and 2 of those 3 passed validation.** Runs
  `100c89102b22cfd417a6ffbeee91bf42` and `ebdc41942b6ac714f243fed2ce91bff1` each cite `agent_config`
  as an evidence source; the audit trail (`x_snc_troubleshoot_audit`, controller-verified directly)
  shows neither run ever invoked it. Both passed `PaFixReport.validate`. Run
  `c66c01142b6ac714f243fed2ce91bf8e`'s rejected draft claims **all seven layers SWEPT on two tool
  calls**, both of them reads of the same trace. Across the pass, 11 layer-sweep claims in 4 runs
  name a tool that was never invoked. This is down from the baseline, where every completed row
  fabricated (§G1) — but the mechanism is untouched: the validator checks that evidence *labels* are
  legal and diverse, never whether the labelled source was read. Issue **#79**.
- **Four of the seven registered tools were never invoked in any run.** `schema_lookup`,
  `query_table`, `genai_log` and `log_analysis` have zero calls across all ten runs.
  `layers_available` is 7/7 — every tool is registered and reachable. Seeds 01, 03 and 04 each hide
  their answer behind one of those four (`schema_lookup` for the word→Integer column, `query_table`
  for the empty routing table, `genai_log` for the dangling `api`), so three of the five seeds were
  unanswerable by the path every run actually took. The two runs that reached a second *layer*
  (`agent_config`, seed 05) are the two that produced the pass's only correct diagnoses.
- **Depth was not budget-limited.** `MAX_ITERATIONS` is 15 and `BUDGET_MS` is 300 000
  (`src/server/PaAgentLoop.js:114-115`). The deepest run used **2 of 15 iterations and ~13s of a
  300s budget**; the distribution is 5 runs at 1 tool call, 5 at 2, none at 3 or more. Premature
  termination is a reasoning/instruction problem, not a resource one, and no ceiling-raising fix
  addresses it.
- **Two runs read a failing execution as a successful one.** Seed 04's runs both report the
  execution "completed successfully with no errors" when its actual signature is
  `OneExtendUtil.execute` → `status:"error"`, "Plan invalid…", `capabilities:{}`, and the tool
  returning `ok:false`. That is a wrong reading of evidence the run held, filed as an absence of
  evidence.

### H6. The validator cost the harness its one correct diagnosis (#78)

Run `a66d01182b22cfd417a6ffbeee91bf28` (seed 05, run 1) produced the **correct** diagnosis: layer 7,
`sn_aia_trigger_configuration` `bfb77d6c64884500a80203ee029436ee`, `active=false` → `active=true` —
the right layer, the right specific gate, and the right PATCH value, with both `config` citations
audit-supported against a real `agent_config` call. `PaFixReport.validate` rejected it: *"no trace
citation found; a candidate resting on config/schema/data alone is not a confirmed root cause."*

Seed 05 produces **no trace by design** — nothing fires, so no `sn_aia_execution_plan` row exists to
cite. The evidence rule has no exemption for the absence-diagnosis case, so it structurally cannot
accept a correct diagnosis of "the agent never ran." **This is a scoring loss caused by the
validator, not by the model.** The run is scored 0 in the scorecard because the rubric scores the
Fix Report the harness delivers and this harness delivered none — but it must not be read as the run
having been wrong.

Two aggravations recorded with it: the same rule rejected run 1 for the opposite offence (citing only
`trace`) while passing two runs whose `config` citations were invented (H5); and the rejected report
is still sitting in `x_snc_troubleshoot_run.fix_report` while `GET /runs/{id}` returns
`fix_report: null`, so the correct diagnosis is invisible to any API consumer. Issue **#78**.

**Counterfactual, stated as arithmetic and nothing more:** had that row passed the gate, the result
would be 2/10 (20.0%) — still the bottom band, still six gate passes behind native. The validator
defect is worth fixing on its own merits; it does not change this section's verdict.

### H7. Limits on what this number can prove

Stated before the number is used for anything.

1. **The observation channel is widened, not opened.** `PaArtifactStore.applyThreshold`
   (`src/server/PaArtifactStore.js:292`) still caps non-paged content at ~2,000 characters via its
   1500-head / 500-tail excerpt (`:84`, `:87`) for six of the seven tools; only `read_artifact` pages
   past it. The branch raises prompt-visible content from ~200 to ~2,300 characters — about 10× — and
   no further. And with `PROMPT_WINDOW = 3` (`src/server/PaRunManager.js:164`), the
   accumulate-across-pages property holds for **three pages only**: paging a 40KB trace would cost 10
   of 15 iterations and end with pages 1–7 collapsed back to a 200-character digest.
2. **The minimum-viable inconclusive report requires zero tool calls, and that exit is advertised in
   the first prompt.** Marking all seven layers `NOT_SWEPT` with reasons drops the citation bill to
   one. Five of ten runs took the inconclusive shape and four of those validated — the path is being
   exercised as designed, and the four validated ones cite only `trace` and are fully
   audit-supported, so they stopped early without inventing anything. But a turn-1 exit is a live
   risk to what this number means, and it cannot be separated from genuine shallowness by the score
   alone.
3. **The fix_report contract text is not identical to the baseline's.** `PaFixReport.schemaText()`
   (`src/server/PaFixReport.js:542`) changed on this branch — the inconclusive path was added and
   citations were priced per swept layer. The model in this pass was shown a different contract than
   the model in the 0/10 pass. This is a deliberate and unavoidable confound: the contract text is
   part of the change under test. It means the 0 → 1 movement cannot be attributed cleanly to any
   single component of the branch.
4. **Native was not re-measured.** Native's 8/10 in §G1 was taken on a different day. Nothing on this
   branch touches the native harness, and the seed fixtures are unchanged, so the §G2 confound
   surface is **narrowed, not closed** — model drift between the two measurement days is unmeasured
   and unbounded here.

One further note, carried from the branch's own review: playbook line 50 already offers a degradation
path — *name the candidate root cause and mark it UNCONFIRMED* — which is complementary to the
`inconclusive` shape, not contradictory. If few runs take the inconclusive path in future passes,
that route is the likely reason and is the better answer anyway; it should not be read as the
inconclusive path being unusable.

#### H7-5. Carried forward: the contract text changed AGAIN in `2026.08.0220` (#78, #79)

Recorded here **before** the next measurement rather than discovered after it, because H7-3 above is
the same limitation and it is about to apply twice over.

`PaFixReport.schemaText()` changed again on the `fix/fixreport-evidence-validation` branch. Three
clauses were added — citations are cross-checked against the tools the run actually invoked; a layer
marked `SWEPT` needs a tool call behind it; an absence-diagnosis may omit the trace citation if layer
1 is `UNAVAILABLE` and two **distinct** non-trace sources are cited — and the pre-existing
`root_causes` clause was amended so it no longer asserts the trace citation is unconditional. The
per-layer tool list is now emitted from `_layerToolMap()` at render time.

**Consequence for attribution.** Any movement in the next number reflects both the enforcement change
and the contract change, and the two cannot be separated by the score alone. This is again deliberate
and again unavoidable — the contract text is part of the change under test — but it means the
0 → 1 → *n* sequence across three passes has three different contracts behind it. Do not read the
sequence as a trend.

**A second, subtler confound on the same axis.** `docs/agent/agent-doctor-instructions.md` line 48
still states the categorical rule — *"Every root cause cites trace evidence PLUS at least one
configuration, schema or data source"* — with no mention of the absence path. That text is prompt
position #1; the amended contract block is prompt position #last. It was deliberately **not** edited
on this branch: the same file is the native harness's instruction source, and changing it would move
the native baseline that §H7-4 already flags as unmeasured. Recency favours the contract block, but a
model that anchors on the earlier categorical statement may still decline the absence path. If the
next pass shows absence-diagnoses continuing to fail, check the rendered prompt for this conflict
before concluding the branch did not work.

**Live-confirmed limit on what #78 can do by itself.** Run `a66d01182b22cfd417a6ffbeee91bf28` — the
correct diagnosis §H6 records as lost to the validator — marks layer 1 `NOT_SWEPT` (not `UNAVAILABLE`)
and cites two `config` entries (one distinct source). It therefore fails the new mode B on **both**
counts and would still be rejected on a replay. The code change makes a correct absence-diagnosis
*expressible*; only the contract change can make the model express it that way. §H6's arithmetic
counterfactual (2/10 had that row passed) should not be read as automatically recovered.

**Two unscored smoke runs on `2026.08.0220`, recorded because one result is a genuine surprise.**
Runs `7f33f9d82ba60b14f243fed2ce91bf0e` and `5983351c2b2ecfd417a6ffbeee91bff2`, both seed 05, both
against the deployed branch. **This is not a scored pass and must not be cited as one** — n=2, one
seed, no native control.

- Mode B fires as designed. Both were rejected with *"layer 1 is UNAVAILABLE, so no trace citation is
  required, but a diagnosis of an absence still needs corroboration… found 0"* — the new path, not
  the old blanket "no trace citation found."
- **Sweep inflation disappeared.** Both runs marked layers 2–7 `NOT_SWEPT` with honest reasons, several
  naming the specific tool they had not invoked ("No `agent_config` tool was invoked to inspect
  instructions"). The historical run on this same seed claimed layers 2, 3 and 7 `SWEPT` with empty
  reasons on the same class of evidence. The contract appears to suppress over-claiming *before* the
  validator has to reject it, which is the better failure mode and was not something #79b was
  designed to produce.
- **Both were shallower than the historical run** — one tool call versus two, and neither reached
  `agent_config`, so neither could produce a single non-trace source. Whether the new contract's
  emphasis on not-claiming-what-you-did-not-do also discourages *going and getting* evidence is
  unanswerable at n=2 and is the first thing a scored re-run should look at.
- **Structural finding, filed separately:** the repair turn has no tool access, so a
  "cite two distinct sources — found 0" problem is **unfixable in repair by construction**. The model's
  only legal moves are to weaken the claim, go `inconclusive`, or fabricate. Both runs' repair turns
  reproduced the same shape and failed identically. This property predates the branch, but the new
  checks make citation shortfall the dominant rejection reason, so it now governs the repair turn's
  usefulness.

### H8. Verdict

**Native remains the deep-diagnosis front door.** 8/10 against 1/10 is not a close call, and nothing
in this pass narrows it: the custom harness moved from the bottom of the bottom band to slightly less
of the bottom of the bottom band, on a change that is now known not to have addressed the defect that
produced the original number. The Phase 1b milestone ("deep diagnosis passes the same seeded-failure
benchmark") remains **not met**.

What this pass did establish, and it is not nothing: the target-delivery defect that made every
async run blind is found and fixed (#77, live-verified); the observation channel carries a full
~4,300-character envelope into the next prompt and the model has been observed paging deeper on it
(#72, live-verified); the infrastructure again ran clean — 10/10 runs terminal, 0 stuck, 0 void; and
the harness produced, once, a fully correct and fully honest diagnosis with an appliable fix.

**What would have to change before the custom harness is reconsidered.** In order, and all of them
measurable:

1. **#78 — the evidence rule must accept an absence-diagnosis.** Today the harness structurally
   cannot report "the agent never ran," which is one of the five seeded failure classes. This is the
   cheapest fix on the list and it recovers a correct diagnosis that was already produced.
2. **#79 — validate citations against the audit trail.** The harness already writes
   `x_snc_troubleshoot_audit` rows keyed by run with `tool_name`; `PaFixReport` simply does not read
   them. Until it does, a passing Fix Report carries no evidential guarantee, and no score computed
   from passing reports means much.
3. **Depth.** Four of seven tools have never been invoked in twenty scored runs across two passes,
   and the seeds whose answers sit behind them have never been solved. Budget is not the constraint
   (H5). Whatever is tried next — instruction changes, a required-sweep gate, forced tool selection —
   the acceptance test is the same: a run that reaches `schema_lookup`, `query_table` or `genai_log`
   on the seed that needs it.
   > **Qualified 2026-08-05 (#110, §S).** The non-vacuity argument later built on this item assumed
   > the harness never names these three tools to the model. It always has — all seven, with full
   > descriptions and their sequencing, in every prompt. The acceptance test itself is unaffected;
   > what changes is the premise used to argue it is non-vacuous. See §S.

A re-run of this same benchmark, under the same doubled-run blind audit-derived protocol, with native
re-measured on the same day to close the H7-4 gap, is the evidence that would justify revisiting the
verdict. Until then, native stays the recommended path for both triage and deep diagnosis on this
instance.

---

## I. The v3 pass (`2026.08.0220`) — #82 answered

Scored 2026-08-02 on `gpinst01`, 10 rows, custom harness only. Full rows and protocol notes:
`scorecard-custom-harness.md` § "Custom harness scorecard — v3". Raw evidence:
`raw-evidence-v3.md`.

### I1. The answer to #82

#82 asked whether the `2026.08.0220` contract change made runs shallower, and said the thing that
would answer it is *"a scored pass over all ten rows, with per-run tool-call counts derived from
`x_snc_troubleshoot_audit` rather than from the reports."* That is what this pass is.

**Answer: yes — measurably, and uniformly.** Depth did not merely fail to improve; it fell to the
floor.

| | Task 10 (0216) | v2 (0218) | **v3 (0220)** |
|---|---|---|---|
| Mean tool calls / run | 2.0 | 1.4 | **1.0** |
| Runs reaching `read_artifact` | 10 / 10 | 3 / 10 | **0 / 10** |
| Runs reaching `agent_config` | 0 / 10 | 2 / 10 | **0 / 10** |
| `sum(passes_gate)` | 0 | 1 | **0** |
| Rubric points | 0 / 60 | 6 / 60 | **4 / 60** |

**Every one of the ten runs invoked exactly one tool — `agent_trace` — and stopped.** The n=2 smoke
observation that prompted #82 holds at n=10 across all five seeds.

Note what this costs specifically: v2's single passing row passed *because* it called `agent_config`
and could therefore cite a real config source alongside the trace. In v3 no run calls `agent_config`
at all, so that row's mechanism is gone, and with it the pass.

### I2. The direction of the trade, stated precisely

The branch was built to stop the harness claiming sweeps and citations it had not earned. On that
axis it worked, and the evidence is unambiguous — **no run over-claimed a sweep**, 7 of 10 carry no
fabrication at all, and all 3 that still fabricated were **rejected** by the new cross-check with the
actual tool roster named back to them. Under the pre-#79 validator all three would have passed.

But #82's hypothesis was that "do not claim what you did not do" might be read as **"claim less"**
rather than **"do more"**, and the rows say it was read as claim less:

- **five runs took the inconclusive path** and named no root cause at all — every single report that
  passed validation in this pass is a non-diagnosis;
- the NOT_SWEPT reasons are frequently *self-justifying* — layer 4 skipped because "reads showed 'ok'
  status", layer 6 because "no LLM errors were observed" — where the trace-only channel is exactly
  what hid the error;
- the honest reports name the tool they did not call (`needed_to_conclude`: "analysis of agent
  configuration") and then do not call it.

**So on this version the harness delivered zero actionable diagnoses across ten runs.** That is a
stronger and more useful statement than 0/10 on the gate.

### I3. #81, now with its clearest live instance

Seed 05 run 1 (`ee3a71dc2baecfd417a6ffbeee91bfe5`) named layer **7** — the expected layer — reasoning
correctly that with no execution plan the failure must be upstream of execution. Its sweep report is
scrupulously honest. It was rejected by mode B for citing **zero** distinct non-trace sources, because
it had made one tool call, and its repair turn had no way to make a second. Its proposed fix reads
`current: "Unknown (requires agent_config inspection)"` — the model writing down the exact tool call
that would have saved the report, in a turn where it could not make it.

This is #81 exactly as filed, and it is no longer a structural argument — it is a measured row that
cost the pass its only correct layer call. Of the two options in #81, the rows favour **routing
citation-shortfall rejections back into the main loop** over letting the repair turn call tools: the
loop had 13 of 15 iterations and ~292 of 300 seconds still unspent at rejection.

### I4. Confounds — what this pass does and does not establish

**Does establish** (custom-vs-custom, same seeds, same targets, same rubric, audit-derived counts):
depth fell from 0218 to 0220, and no run reached beyond layer 1.

**Does not establish** that the contract change *caused* it. Unchanged from §H7-3/§H7-5:

1. **Third different contract across three passes.** `schemaText()` changed again in 0220, so
   attribution to any single clause is impossible from the score.
2. **`agent-doctor-instructions.md:48` still contradicts the contract block** — categorical
   trace-plus-one at prompt position #1 versus the amended rule at prompt position #last. This pass
   deliberately did not touch it (editing it would move the unmeasured native baseline). It remains a
   live candidate explanation for the seed-05 rejections specifically, and §H7-5's instruction to
   check the rendered prompt before concluding the branch failed still stands.
3. **Native was not re-measured**, so §H7-4's different-day gap is untouched. Native's 8/10 and this
   0/10 come from different days.
4. **Model drift is unmeasured and unbounded** across all three passes.

One methodological difference from the earlier passes, recorded rather than buried: **v3's scoring
was delegated to ten independent blind agents** because the operator had read the v2 rows before
firing. Task 10 and v2 were scored by an operator who had not. The audit derivation and the
highest-scoring row were verified directly by the operator.

### I5. What this changes about the roadmap

§H8's list had three items. Items 1 and 2 (#78, #79) are **done and verified working** — the
absence-diagnosis path fires, and citation fabrication is caught. Item 3, **depth**, is not merely
still open; this pass shows it is the *only* thing left and that it moved backwards.

The acceptance test §H8 set is unchanged and still unmet: *a run that reaches `schema_lookup`,
`query_table` or `genai_log` on the seed that needs it.* Twenty-three scored runs and one smoke run
across three versions have now produced **zero** such runs. Four of seven tools have never been
invoked once.

**Native remains the recommended path** for both triage and deep diagnosis on this instance. The
Phase 1b milestone remains **not met**.

Two concrete follow-ups the rows point at, beyond #81:

- **A tool-output defect, new in this pass.** Six of ten runs (and the smoke run) built their entire
  diagnosis on "27 tasks vs 19 tool calls" — a **generic note in `agent_trace`'s own output** whose
  text is *"Execution tasks are NOT 1:1 with tool calls (27 tasks / 19 calls in a measured run)…
  do not reconcile them."* The model is reading a documentation note about a different, illustrative
  run as a finding about the run under diagnosis, and then proposing fixes for it. The note is
  actively harmful in its current form and should be removed or restated so it cannot be mistaken for
  run data.
  **Fixed in `2026.08.0222` (issue #85).** The note now carries this run's own task and tool-call
  counts, so a reader who treats them as run data is right; the guidance moved to the tool
  description as well. The audit that followed found **five more sites** of the same shape across
  `agent_config` and `genai_log` — including a remembered stack line (`threw at line 42`) inside a
  finding whose `next_step` points at `agent_trace`'s `script_errors`, which carry a real `line`.
  Those counts are kept (R-22 item 4 requires the denominator) behind a new
  `PaToolReadKit.REFERENCE_STAT` label, and `test/referenceStatistics.test.js` fails the build if a
  new one appears unlabelled. **This does not close #82.** Whether the note was a cause of the depth
  collapse or merely a passenger is unmeasured, and §I4's four confounds are untouched — only a
  re-run answers it.
- **The gate's honesty premise now holds, so the score is worth more than it was.** A passing v3 report
  cannot rest on a fabricated citation. That makes "0/10 with 5 inconclusive" a trustworthy number in
  a way the earlier passes' numbers were not.

---

## J. The v4 smoke (`2026.08.0222`) — #85 answered, and it was not the cause

Four runs, 2026-08-03, `gpinst01`, seeds 01 and 03 only. Raw evidence:
`raw-evidence-v4-smoke.md`. **Not a scored pass** — no native control, no blind scoring, no rubric.
It answers one pre-registered question, and is recorded because the answer is negative.

### J1. The question and the answer

§I5 named the #85 tool-output defect as a plausible contributor to the depth collapse: six of ten v3
runs built their entire diagnosis on `agent_trace`'s illustrative "27 tasks / 19 calls" note, and a
run that believes it has confirmed a layer-1 root cause in its first tool result has no reason to
open a second layer. `2026.08.0222` removed it.

**Question, fixed before firing:** does removing the false finding produce a second tool call?

**Answer: no.** Audit-derived, 8 rows across 4 runs, one `intent` + one `result` each, all
`agent_trace`. Mean tool calls per run **1.0**, identical to v3. Zero runs reached any second layer.

The seeds were chosen adversarially in the fix's favour — all four of their v3 rows are named in #85
as having built on the note. If it were load-bearing, it would have shown here.

### J2. What the fix did do

| | v3, seeds 01+03 | v4 smoke |
|---|---|---|
| Runs building a root cause on the note | 4 / 4 | **0 / 4** |
| `root_causes` emitted | ≥1 each, all seed-irrelevant | **0** |
| Terminal status | 3 `failed`, 1 `complete` | **4 `complete`** |

The defect #85 describes is gone. Note the status flip: removing the false root cause converted
three validator rejections into accepted honest inconclusives — **without adding a single tool
call.** That is the whole finding of this smoke, and it is not the one that was being looked for.

### J3. The mechanism, which is now visible

Depth is not an ignorance problem. TR1000107's report names `agent_config`, `schema_lookup` and
`genai_log` — three tools it did not invoke — as what it would need, and gives *"No agent_config
call made to inspect instructions"* as its per-layer reason for six of seven layers. Then it files
the report and the loop stamps **`fix_report validated`**. Budget was untouched: 2 LLM turns of 15,
10–17 seconds of 300.

`PaFixReport._checkInconclusive` prices the inconclusive path at one `evidence_read` citation per
layer claimed `SWEPT`. That is a sound defence against sweep inflation and it demonstrably works —
v2's "all seven layers SWEPT on two reads" row has no successor. But the cost function rises
monotonically with sweeps and has **no floor**, so its minimum is one sweep and two citations, and
the model sits on that minimum in 4 of 4 runs.

**Honest surrender is now the cheapest structurally valid output.** In v3 the model fabricated and
was rejected; now it surrenders honestly and is accepted. Both stop at one tool call. #78/#79
converted the failure mode without moving depth — which §I2 half-saw ("claim-avoidance rather than
claim-earning") and this smoke makes mechanical.

The loop accepts a report the benchmark scores 0. That misalignment, not the tool output, is where
depth is lost. Filed as **#88** with a fix direction (a minimum-effort floor in `PaAgentLoop` rather
than a rejection in `validate`, because #81 makes a rejection unfixable by construction).

### J4. A blind-rule leak, found while verifying this

`README.md`'s smoke gate expects `context_processing_script` **line 42**. Until `2026.08.0222`,
`PaToolAgentConfig` emitted *"an auto-populated body on this instance threw at line 42"* inside a
finding — the gate's expected answer, handed to the model mid-reasoning. Removed by PR #87 as part
of the #85 sweep, and now guarded by `test/referenceStatistics.test.js`.

It had never fired, because no run has ever invoked `agent_config`. **The leak was harmless only
because the harness was too shallow to reach it, and would have activated at exactly the moment the
depth work succeeded.** The residual gap is the blind rule itself, which binds Agent Doctor's
*instructions* and not its *tool output*. Filed as **#89**, together with the observation that the
#85 audit swept for statistics and never swept for answers.

**Correction (2026-08-03, §M3):** the blanket *"no run has ever invoked `agent_config`"* is **false
and is retracted.** The v2 pass reached it in 2 of 10 runs — runs 9 and 10
(`scorecard-custom-harness.md`). The conclusion survives, **scoped to the custom harness** and for a
different reason than the one given: both of those calls passed `section:"triggers"`, and the leaked
string is assembled inside `_instructions` (`src/server/tools/PaToolAgentConfig.js`), which
`section:"triggers"` never reaches. Custom-harness exposure is therefore still zero — from the
`section` argument in those two runs, and from non-invocation in every other pass (0/10 v3, 0/10
Task 10, 0/4 v4 smoke). Unscoped, the sentence is false in the other direction too: §M3 grades the
note as having shipped on **native**. What does not survive is shallowness as the *whole* explanation
of why the leak stayed harmless.

### J5. What this changes about the roadmap

§I5 said depth was the only thing left. That still holds, and the target has moved from "why does the
model not look?" to a specific, testable claim: **the loop lets it stop.** #88 is now the head of the
queue, ahead of a v4 scored pass — running ten more rows against an unchanged termination rule would
buy another 0/10 and no new information.

Sequence, in order:

1. **#88** — put a floor under the inconclusive path.
2. **#89** — broaden the blind rule to bind tool output, and sweep the six other cores for
   answer-shaped constants (the #85 sweep looked for statistics only).
3. **Then** the v4 scored pass: ten rows, blind, audit-derived, **with native re-measured the same
   day** to close §H7-4 / §I4 confound 3. §I4 confound 2 (`agent-doctor-instructions.md:48`) should
   be resolved in that same pass — the reason it has been left alone twice is that editing it moves
   the unmeasured native baseline, and that objection disappears in a pass where native is
   re-measured.

Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is
**not met**.

### J6. What this smoke does not establish

- **Anything about the other three seeds.** Seeds 02, 04 and 05 were not run.
- **That #88's floor will improve depth.** It forces more tool calls; whether they land on the right
  layer is what the scored pass would measure.
- **Anything about native.** Not re-measured here either — §I4 confound 3 is still open.
- **That model drift is not doing the work.** Four runs on one day, unbounded as ever.

---

## K. The excerpt was hiding the evidence (`2026.08.0225`, #91)

Found while investigating §J5's step 2. Not a scored pass — two runs, seeds 01 and 03, on
`2026.08.0225`.

### K1. The defect

`PaArtifactStore._truncate` sliced by character offset and knew nothing about what it was cutting.
For an `agent_trace` result that meant:

| | kept? | content | what it said |
|---|---|---|---|
| head (1500) | ✅ | `resolution`, `reads`, `notes`, `header` | state completed, every read `ok` |
| middle (16,969 of 18,969 chars) | ❌ | `tool_calls`, `script_errors`, failure signatures | **the evidence** |
| tail (500) | ✅ | `evidence_basis` | every read `ok` |

**Both retained sections were the reassuring ones.** Seed 03's entire answer — `rules_in_table: 0` —
is a `tool_calls[].response_digest`, i.e. precisely what was being discarded. Seed 01's spec exists
to stress artifact paging.

Runs reaching `read_artifact` had fallen 10/10 (`0216`) → 3/10 (`0218`) → 0/10 (`0220`) → 0/4
(`0222`) as the excerpt grew richer after #72 — big enough to look like a complete answer, stocked
with the parts that say nothing is wrong. **The two defects never overlapped:** at `0216` the model
paged and could not read what it fetched (#72's 200-char channel); from `0218` it could read but no
longer paged. This is the first version where it can do both.

### K2. What changed, measured

**Seed 03 (TR1000112) — the seeded answer is cited for the first time in any custom-harness run.**
The excerpt led with `script_errors`, `header`, `tool_calls`, and the report said *"the tool call to
`lookup_routing_rule` returned 0 rules found for the 'Hardware' category"*, citing
`"Tool call response: 'rules_in_table': 0"`. Every prior run on this seed reported no failure at all.

**And it was rejected.** Both citations were `source: trace`, so the evidence rule refused the root
cause and the run ended `failed`.

**Seed 01 (TR1000113) — unchanged.** `complete`, inconclusive, no root cause. Its defect is invisible
in a trace by construction (the word-typed priority is dropped by an Integer column while
`gr.update()` reports success), so it still needs `schema_lookup` or `query_table`. Still 1 tool call.

### K3. What this establishes, and what it does not

Establishes: **the excerpt, not the model's willingness, was hiding layer 1.** Given the evidence, the
model finds the seeded cause and states it plainly. That is a different failure mode from every
previous pass, and the first time the harness has produced the right finding on a seed.

Does not establish any score movement. Seed 03's report was rejected; seed 01's was empty; depth is
unchanged at one tool call on both. `0216` paged 10/10 and scored 0/10 — visibility is necessary, not
sufficient.

### K4. §I4 confound 2 is no longer theoretical

The seed-03 rejection **is** the line-48 contradiction, now with a concrete failing case rather than
a reading of two texts. `agent-doctor-instructions.md:48` offers an escape — *"name the candidate root
cause, name the layer that would confirm it, and mark it UNCONFIRMED"* — that **does not exist in the
contract**, which requires trace PLUS one of config/schema/data on every root cause with no
UNCONFIRMED exemption. A model that has correctly diagnosed a seed from the trace alone cannot say so.

Two ways out, and they are not equivalent:

1. **Give the contract the exemption the playbook already promises** — allow a trace-only root cause
   when it is marked UNCONFIRMED, priced like the inconclusive path. Makes the two texts agree by
   moving the contract, which is custom-harness-only.
2. **Make the model take the second step** — the correct move on seed 03 was `query_table` against the
   routing table, which would have produced both a `data` citation and the right layer (5, not 1).
   That is the depth problem again, and #88 showed pressure alone produces fabrication.

(1) is cheap, harness-only, and unblocks a diagnosis the harness has already earned. It does not
produce depth. Both should be read alongside §J5's ordering: native must be re-measured in the same
pass as any change to the shared instructions file.

### K5. Deliberately not propagated to native

`PaScriptToolAdapter` — the native harness's tool entry point — does **not** pass a priority. Moving
both harnesses at once is the confound (§H7-4, §I4 item 3) that made three passes harder to read than
they needed to be. Propagate once the custom-harness measurement is in.

---

## L. The UNCONFIRMED exemption (`2026.08.0226`, #93)

§K4 remedy (1), built and smoked. Not a scored pass — two runs, seed 03, on `2026.08.0226`,
against the same execution `c4cd01842b6a4bd417a6ffbeee91bfc3`.

### L1. What was changed

`PaFixReport._checkEvidenceRule` gained a third passing route, checked after A and B so it can only
widen. A trace-only root cause validates when it is marked `UNCONFIRMED`, names the confirming layer
in a new `would_confirm` field, that layer is not marked `SWEPT`, and the cause cites one piece of
evidence per layer it claims to have swept (`_checkInconclusive`'s pricing, reused). Custom-harness
only — `docs/agent/agent-doctor-instructions.md` is untouched, so §J5's re-measure constraint does
not apply and §K5's confound is not reopened.

### L2. The model adopted the field on first exposure, unprompted

Both runs produced the intended shape without ever having seen it before, from `schemaText()` alone:

```
"confidence":    "UNCONFIRMED",
"would_confirm": "layer 5 — query_table against the routing table"
```

It named **layer 5** — the seed's own expected layer — and the tool that would reach it. That is the
strongest evidence available that the contract text is legible: asked what would confirm its
trace-only finding, the model answers with the correct next step, and then does not take it.

### L3. TR1000115 — `complete`, and the first of its kind on this seed

| | |
|---|---|
| status | `complete` (validated on the repair turn) |
| root cause | layer 1, `lookup_routing_rule tool call`, UNCONFIRMED |
| evidence | 1 × `trace`: `"tool_call response: 'rules_in_table': 0"` |
| layers_swept | 1/7 SWEPT, six honest NOT_SWEPT with reasons |
| tool calls | 1 (`agent_trace`) |

Seed 03's run history in full: v3 `failed` (fabricated `config` citations), Task 12-era `complete`
but inconclusive with no root cause, §K2 `failed` (correct finding, rejected for trace-only
citations), and now **`complete` with a named root cause that cites the seeded answer**. That
sequence has never reached this state before.

### L4. It still does not pass the gate, and this was predictable

`passes_gate = root_cause_layer_correct == 2 AND fix_usable_unedited == 1`. The report names
**layer 1**; seed 03's expected layer is **5**. So `root_cause_layer_correct = 0` and the run fails
the gate no matter how clean the rest of the report is. §K4 said this in advance — *"the correct
move on seed 03 was `query_table` … which would have produced both a `data` citation and the right
layer (5, not 1)"* — and the smoke confirms it rather than discovering it.

**What the exemption bought is a diagnosis that survives instead of being discarded.** What it did
not buy, and was never going to, is the second tool call. The `would_confirm` value is the model
naming `query_table` in the same breath as declining to call it.

### L5. TR1000114 — the pricing rule fired, on an inflated sweep claim

The first run `failed`, and the reading matters. It claimed **two** layers SWEPT — layer 1, and layer
6 with the reason *"agent_trace included Gen AI step metadata"* — while citing one piece of evidence.
Two rejections followed, and they are the same lie counted twice:

- the pre-existing #79b check: layer 6 SWEPT is unsupported, the run never invoked `genai_log` or
  `log_analysis`;
- the new path-C price: 2 layers claimed SWEPT, 1 citation.

**#79b would have rejected that report with or without this change** — the pricing rule did not
create a new failure, it charged an existing one a second time. TR1000115 marked every unreached
layer NOT_SWEPT with a reason and passed at the same depth, on the same evidence. That is the price
behaving as designed: it is paid by inflated sweep claims and free to an honest one.

### L6. Every path-C rejection is repairable without tools

TR1000114's repair turn had a tool-free fix available — drop the layer 6 claim — and did not take
it; TR1000115 reached the same contract by producing an honest layer report first. This is the
property #81 lacks: a citation-shortfall rejection cannot be repaired by a turn with no tool access,
so the repair turn burns an LLM call restating a report it cannot improve. A path-C rejection names
a marker, a phrasing, a layer status or a citation count — all editable. #81's four options should be
re-read with that in mind; the dominant rejection reason has changed shape.

### L7. What this smoke does not establish

No score movement, and none is claimed. Two runs, one seed, unscored. Depth is unchanged at 1–2 tool
calls; `schema_lookup`, `query_table` and `genai_log` were not invoked, so §H8's acceptance test is
still unmet across 25 runs. §K4 remedy (2) — making the model take the second step — is untouched and
remains the milestone blocker. The one incidental observation worth carrying: TR1000114 called
`read_artifact`, the first paging on this seed since `0216`, which belongs to #91 rather than to this
change.

---

## M. The blind rule binds tool output (`2026.08.0227`, #89)

§J5's item 2 of 3. **Not a pass of any kind** — no runs were fired and no number in this file moves.
What changes is the rule that makes every number in this file mean anything, plus what turned up
while applying it for the first time.

### M1. What was changed

**The rule now binds three channels, not one.** `README.md`'s blind rule bound the text that becomes
Agent Doctor's *instructions* — the only channel that existed when it was written for the native
harness. It now binds instructions (`docs/agent/agent-doctor-instructions.md`), tool descriptions
(`src/server/PaToolRegistry.js`, mirrored into `src/fluent/agent-doctor.now.ts`) and **tool output**
— which is defined by a principle rather than a file list: *any text the harness can put in front of
the model*. The seven cores in `src/server/tools/` and `src/server/PaToolReadKit.js` are the obvious
members; `PaArtifactStore.js`'s excerpts, `PaFixReport.js`'s repair-turn text, `PaAgentLoop.js`'s
**system prompt**, `PaLlmProxy.js`'s envelope and `PaScriptToolAdapter.js`'s native envelope are bound
by the same words, and a leak in any of them is a rule violation rather than merely a test failure.
All three channels reach the model on both harnesses, though individual files are harness-specific
(`PaAgentLoop`/`PaFixReport`/`PaLlmProxy` custom-only, `PaScriptToolAdapter` native-only).
Tool output is the most direct of them: it lands in the reasoning loop at the moment of
diagnosis rather than in a preamble read once at the start.

**Each specimen declares its own answers.** Five seed specs and the `README.md` smoke gate each carry
a fenced ` ```blind-rule-tokens ` block — 18 tokens across the six. A new seed is covered the moment
its spec lands and fails the build until its tokens are declared.

**Two mechanical guards, one comment stripper.** `test/blindRule.test.js` (answers, #89) scans 16
model-facing sources for those tokens, comment-stripped, and fails the build on a hit; the roster
size is pinned, because a *deleted* target silently stops generating its `it` while the suite stays
green. Three controls run against real files: two positive (the matcher fires, case-insensitively),
one negative (a token inside a genuine comment does not fire). It is paired with
`test/referenceStatistics.test.js` (statistics, #85), and the two now share
`test/_stripComments.js` so they cannot drift.

**A token names the answer, not the vocabulary of the question.**
`sn_aia_trigger_configuration` is seed 05's answer *and* a table `agent_config` must query to sweep
layer 7; `context_processing_script` is the smoke gate's answer *and* a field that same tool must
read. Neither is declared. There is deliberately no stop-list: a too-generic token reddens the suite,
and that failure is the signal to pick a better token.

### M2. The sweep found two leaks, and the automated guard found neither

Both are in tool output. Both were found by a human reading, with the specimens open.

**Leak 1 — `src/server/tools/PaToolGenAiLog.js` (`f0e49b1`), found by the hand sweep.** The
`capability_unresolvable` finding's `next_step` called its own signature *"the FALLBACK signature
rather than the primary provider-mapping one"*. That two-member taxonomy exists in exactly one place
in this repository — seed 04's spec — and naming one member tells a model by elimination that the
other is a **provider-mapping** failure, which is seed 04's answer. The tell is that the sentence is
incomprehensible to a real administrator: nobody diagnosing an actual capability has a referent for
"the FALLBACK signature". Replaced with a contrast between two checks the tool performs on the record
in front of it (`capability_unresolvable` vs `api_dangling`) — observable, instance-general, and
still useful.

**No token could have caught this one.** The leak is *framing*, not a value: the load-bearing words
are "primary" and "fallback", which are ordinary English appearing throughout honest code, and there
is no distinctive surrounding phrase in seed 04's spec to declare instead. The guard catches leaked
values; only a reader with the specimens open catches leaked framing. The two halves of the sweep
cover disjoint failure modes, which is why #89 asked for both.

**Leak 2 — `src/server/tools/PaToolAgentConfig.js` (`64ed1b4`), found by an independent reviewer
after the hand sweep.** The `note` returned by every `section=instructions` call read *"the known
failure specimen on this instance threw in the AGENT copy"* — naming the smoke gate's specimen, and
failing the same real-administrator test that convicted leak 1. Its sibling `detail` on
`context_processing_script_populated` carried *"terminating a run that reported state=Completed with
an empty state_reason"*, which is near-verbatim `README.md` step 3's stated **reason for choosing**
that specimen. The pair handed a model the gate's answer minus only "line 42" — the one half Task 2
had declared as a token on the assumption it was the only unguarded one. Both clauses removed; the
R-7/R-16 guidance they sat in survives intact.

The hand sweep had already read that function and had explicitly *kept* the sibling `detail`, on the
reasoning that it explained why a plan header cannot be trusted. That reasoning was wrong on a fact
that a re-read settles: the `next_step` immediately below already says the same thing generically.
Recorded because it is the useful part — the sweep applied "is this a measurement?" and stopped,
without applying "would a real user understand this?" two files after using that test successfully.

**The automated guard's record on this episode is 0 for 2.** Its first full run reported every scan
target passing (`8f2df96`), before either leak was found. Its later changes (`5ec68fe`, `64ed1b4`)
were repairs to its own token list and target roster, driven by manual review — a token that could
match nothing, and a roster missing five model-facing files including the one that assembles the
system prompt. **The guard's value is prospective, not diagnostic:** it pins both leaks closed
permanently and covers 16 targets automatically from here, so the next leak of a declared value fails
a build instead of waiting for someone to notice. `README.md` was corrected to say this (`5e30e1b`)
after a first draft claimed all three review layers had each caught something.

### M3. Exposure — what each leak actually reached, and what is not established

> **⚠ Superseded in part by §N (`2026.08.0301`, #96).** Everything below was reasoned from the
> committed scorecards on the stated premise that no artifact records which `section` a run
> asked for. **The audit trail records it, and has since Task 9.** Measured: leak 2 reached
> **7 of the 12 native rows, every one established** (not "1 established + 7 inferred"); custom
> exposure is zero as concluded, now measured; **leak 1's exposure is zero**, closing the
> question this section left open; and the smoke-gate contamination claim below is **refuted** —
> the gate's `agent_config` call matched no agent and returned no sections. §N carries the
> measurement and the per-row table. This section is kept as filed, because what #89 concluded on
> the day is part of the record.

The stronger claim available — that leak 2 "shipped on the smoke-gate runs and both harnesses' Task
12 scored runs" — is **not** supported as stated, and is narrowed here.

**Leak 2 shipped only on `section=instructions` calls.** `_resolveSections` returns all four sections
when `section` is omitted, `all`, or unrecognised, so an unqualified call carries the note; an
explicit `section` other than `instructions` does not.

**Across every custom-harness scored run, exposure is zero.** `agent_config` was invoked in 0 of 10
runs in the Task 10 pass (§E), 0 of 10 in v3 (`raw-evidence-v3.md`), and 0 of 4 in the v4 smoke
(`raw-evidence-v4-smoke.md`). The v2 pass reached it in 2 of 10 — runs 9 and 10, both seed 05 — and
`scorecard-custom-harness.md` records the section for **both**: run 9's is *"the sole `agent_config`
call requested `section:"triggers"`"*, and run 10's is the same call shape, the basis of its L2/L3
overclaim. `section=triggers` returns no instructions, so the note did not ship on either. That
settles the open question: **no custom-harness run, scored or smoke, ever received it.**

**On native it did ship — directly evidenced on one row, inferred on the other seven.**
`scorecard-agent-doctor.md` §E2 credits `agent_config` layer 2 only when the diagnosis actually used
the instruction text; 6 of the 10 standing native rows carry L2 (seed 02 ×2, seed 03 run 2, seed 04
run 2, seed 05 ×2), as do both native seed-02 v2 rows. **Established** on `eed25e8c…`, whose notes
record evidence citing *"`agent_config` (instruction text)"* inside a root-cause entry: that call
demonstrably returned the instructions section, and the note is a sibling key of that text in the
same returned object, so it travelled with it. **Inferred** on the remaining seven: L2 credit under
§E2's used-layers discipline implies the instruction text was read, which implies an unqualified or
`section=instructions` call. That is sound reasoning and it is what §M4's annotation rests on — but
no scorecard or raw-evidence entry records the `section` argument those runs passed, so it is
reasoning rather than a record, and the distinction is kept rather than rounded up.

**What that exposure did and did not contaminate.** The removed text names the **smoke gate's**
specimen and `README.md`'s reason for choosing it. The smoke gate is a pass/fail gate, explicitly
*"not one of the 10 scored rows"*, and its answer is not any seed's answer — no scored seed's expected
layer, component or fix appears in the removed strings. So: **no scored row's answer was leaked to
it, and no score is called into question.** What was contaminated is the gate itself. Any gate run
that read the instructions section — which the gate's own expected answer requires it to do — was
told that a known failure specimen on this instance threw in the agent copy of
`context_processing_script`, and separately that such a run reports `state=Completed` with an empty
`state_reason`. That is the gate's answer minus its line number, and the gate has been passing under
those conditions.

**Leak 1's exposure is bounded but not fully settled.** `capability_unresolvable` fires only when a
definition's `capability` reference resolves to no `sys_one_extend_capability` row. Seed 04's
capability record is real by construction — a mismatch there is the seed's declared **void**
condition (`README.md` step 2) — so no scorable seed-04 row can carry that finding. Custom-harness
exposure is zero outright: `genai_log` was never invoked in any custom run in any pass. Native did
invoke it, and an unfiltered `check_config` audits up to `MAX_DEFINITIONS` rows of the whole table,
so a native layer-6 sweep could in principle have raised the finding against some unrelated OOB
definition. **Nothing in the scorecards or the raw evidence records whether it did**, and the
finding's presence or absence in a native run's tool output was never captured. That is the bound;
the guess is not offered.

### M4. Native movement, and the scorecard annotation

`src/server/PaToolRegistry.js` and `src/fluent/agent-doctor.now.ts` — the two files §J5 and §K5 treat
as the native-shared surface — are **untouched**. On the brief's literal trigger, no annotation is due.

An annotation is nonetheless warranted, and `scorecard-agent-doctor.md` carries one. Both changed
files are tool *cores*, and both harnesses execute them: native through `PaScriptToolAdapter` (the
`Now.include` in `src/fluent/script-includes.now.ts`), custom through `PaToolRegistry.dispatch`. §M3
grades the `PaToolAgentConfig` note as having reached 8 of the 12 native rows on record, and the two
halves of that 8 are not equally graded: **established** on one row (`eed25e8c…`, which cites the
instruction text directly), **inferred** on the other seven from their L2 credit under §E2's
used-layers discipline, with no record anywhere of the `section` argument those seven passed. The
annotation therefore rests on the inferred half for seven of the eight rows it covers.

> **⚠ Superseded by §N (#96).** The count is **7, not 8**, and none of it is inferred — the
> `section` argument *and* the sections actually returned are recorded on every one of the 12
> rows. §N3 has the table. The scorecard annotations were rewritten to name the affected rows
> instead of describing an inference.

It is still warranted on that grade. One row is enough to establish that the note **did** ship on
native — the fact §M3 settles in the other direction for the custom harness — and the annotation
claims only that these rows were scored against a version of a shared core that no longer exists,
which is a reproducibility fact about those rows whether or not it moved a score.

The annotation is deliberately narrow, and says three things: which two cores changed and when; that
native runs pulling `section=instructions` received the removed note; and that the removed text named
the smoke gate's specimen rather than any scored seed's answer, so **no row is restated and no score
movement is claimed**. Asserting contamination of a scored answer would be its own overclaim, of
exactly the kind this section exists to prevent.

### M5. One finding parked by ruling, deliberately

`docs/agent/agent-doctor-instructions.md:67` tells the model that the mandatory bindings *"capability,
api_type and api — are where defects live"*. A reviewer flagged it as naming seed 04's answer field.

**Ruled domain guidance, not an answer.** It names three fields and says nothing about which of them
is defective; it derives from **R-22**, a whole-table measurement on this instance, not from the seed
— and R-22 is the same finding that caused seed 04 to be re-targeted from `connection` to `api` in
the first place, so the seed and the instruction inherit one ruling rather than the instruction having
been taught the seed. It *tilts* toward seed 04's layer; it does not *tell*.

**Its twin was considered and ruled the same way.** `src/server/tools/PaToolGenAiLog.js`'s
`connection_note` carries the same R-22 content in the *more direct* channel — tool output, which
lands mid-reasoning rather than in a preamble — and so deserved the harder look, not the lighter one.
It is likewise **not** a leak, and for a reason the instructions line cannot claim: the tool scopes
the three bindings as *"what this mode checks"*, an honest statement of its own coverage beside
`stats.check_names`, where the instruction phrases them as *"where defects live"*. A tool naming the
checks it performs is the opposite of a hint. Recorded because §M5 otherwise reads as if the
instructions file were the only instance of this sentence in the repository.

It is left in place, and the reason is procedural rather than a shrug: the file is native-shared, so
moving it relocates an unmeasured native baseline — which §J5 forbids before the v4 pass — for
something that falls short of a leak. It belongs to §I4 confound 2 and should be resolved in the v4
scored pass, where native is re-measured on the same day and the objection disappears. Recorded here
as an open, reasoned, deliberate non-change rather than an oversight.

### M6. What this does not establish

- **No score movement, and none is claimed.** Nothing was run. Every row in §G–§L stands as filed.
- **Depth is untouched.** §K4 remedy 2 / §L7 — making the model take the second step — remains the
  milestone blocker, unaffected by anything here.
- **A passing guard is not evidence of blindness.** It catches only what it was told to look for, and
  §M2 is the demonstration: 16 targets green while two real leaks sat in two of them.
- **The guard is a build-time source scan.** A leak assembled at *runtime* from live fixture data is
  not caught and cannot be, since a tool reading the fixture app's tables will legitimately return
  fixture strings. The blind rule has always been about authored text.
- **That no third leak remains.** Two passes over these files (#87's, and this one) each found what
  the previous pass missed. The honest reading of that sequence is that reading finds leaks and
  finishes nothing.

### M7. The queue

§J5's item 2 of 3 is done. Item 1 (#88, a floor under the inconclusive path) and this item were the
two preconditions.

Next is the **v4 scored pass**: ten rows, blind, audit-derived, **with native re-measured the same
day** to close §H7-4 / §I4 confound 3. §I4 confound 2 — both `agent-doctor-instructions.md:48` and
the `:67` line parked in §M5 — should be resolved inside that same pass, for the reason §J5 gave: the
objection to editing the shared instructions file is that it moves an unmeasured native baseline, and
a pass that re-measures native removes it.

Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is
**not met**.

---

## N. The trail already held the answer (`2026.08.0301`, #96)

**Not a pass** — no runs were fired, and no number in §A moves. What moves is four exposure
grades in §M3/§M4 that were reasoned from committed markdown while the instance held the
measurement, one derived column on one scored row, and the rule that produces that column.

### N1. The premise that was wrong

§M3 graded leak 2's exposure as **one row established and seven inferred**, and left leak 1's
exposure *"bounded but not fully settled … the guess is not offered"*. §M4 cited **8 of the 12
native rows** and said the annotation *"rests on the inferred half for seven of the eight rows
it covers"*. Every one of those grades rested on the same stated premise: that no artifact
records which `section` a run asked for.

**Both harnesses have recorded it since Task 9.** `src/server/PaToolRegistry.js:284` (custom)
and `src/server/PaScriptToolAdapter.js:127` (native) each call
`logIntent({runId, toolName, input: args})` **before** the tool runs, and the matching
`logResult` records what came back; `x_snc_troubleshoot_audit.input` and `.output` are
`MultiLineTextColumn`s of 65,536 chars. gpinst01 holds **22 `agent_config`** and **11
`genai_log`** intent rows, covering every run named in this file.

This is #79's defect one level up, and in the instrument built to prevent it: a claim graded by
what a label permits rather than by what the instance recorded.

### N2. How it was measured

The §E1 two-step, then a second reading of the same rows:

1. `x_snc_troubleshoot_run.conversation_ref` → the run row. All 12 native scored conversations
   resolve — 13 rows for 12 conversations, because seed 05 run 2's anchor race (§R-3, TR1000047 /
   TR1000048) left the loser row behind as designed. The loser carries no audit rows.
2. `x_snc_troubleshoot_audit` `run=<sys_id>` → every call, with `input` on the intent row and
   `output` on the result row.

**Two independent readings per row, and they agree on all 12.** The `input` says what the model
asked for; `sections_returned` inside the recorded `output` says what the tool actually rendered.
The second is the one that decides, and §N4 is why: three calls in the corpus name no `section`
— which returns all four — and still returned nothing.

### N3. Leak 2 — 7 of 12, every one established

`PaToolAgentConfig`'s removed `note` is returned by `_instructions`, unconditionally, whenever
that section renders (`PaToolAgentConfig.js:841`). So "did this row receive it" is exactly
"does its `sections_returned` contain `instructions`", and that string is recorded.

| Native scored row | Run | Recorded `input` | `sections_returned` | Received it |
|---|---|---|---|---|
| seed 01 run 1 | TR1000038 | `{"agent":"914db68f…","section":"tools"}` | `["tools"]` | no |
| seed 01 run 2 | TR1000039 | `{"agent":"914db68f…","section":"tools"}` | `["tools"]` | no |
| seed 02 run 1 | TR1000040 | `{"agent":"cd050d48…"}` | all four | **yes** |
| seed 02 run 2 | TR1000041 | `cd050d48…` (bare string) | all four | **yes** |
| seed 03 run 1 | TR1000042 | `{"agent":"0bbf1b00…","section":"tools"}` | `["tools"]` | no |
| seed 03 run 2 | TR1000043 | `{"agent":"0bbf1b00…","section":"tools"}` | `["tools"]` | no |
| seed 04 run 1 | TR1000044 | `{"agent":"8bac1f84…","section":"tools"}` | `["tools"]` | no |
| seed 04 run 2 | TR1000045 | `{"agent":"8bac1f84…"}` | all four | **yes** |
| seed 05 run 1 | TR1000046 | `Seed 05 Ticket Acknowledger` (bare string) | all four | **yes** |
| seed 05 run 2 | TR1000047 | `Seed 05 Ticket Acknowledger` (bare string) | all four | **yes** |
| seed 02 v2 run 1 (`scorecard-custom-harness.md`) | TR1000068 | `{"agent":"cd050d48…"}` | all four | **yes** |
| seed 02 v2 run 2 (`scorecard-custom-harness.md`) | TR1000069 | `{"agent":"cd050d48…"}` | all four | **yes** |

**7 of 12, and the inferred/established split does not survive** — it described a limitation
that did not exist. §M3's one "established" row (`eed25e8c…`, TR1000069) is in the set, reached
by the same evidence as the other six rather than by its own special citation.

`eed25e8c…` also shows why the old reasoning was fragile even where it landed correctly: §M3
established it from the model's *prose* citing "`agent_config` (instruction text)", which is the
Fix Report's own claim about itself. The trail establishes it from the tool's output.

**Across the whole audit table, exactly seven `agent_config` calls ever returned the
`instructions` section, and all seven are the rows above.** Custom-harness exposure is
**zero, measured** — a strengthening of §M3's conclusion rather than a correction, and it now
covers a call shape §M3 never considered: the two custom smoke calls (TR1000049, TR1000053)
passed `{"execution":"c9d63a93…"}` with no `section` at all, which §M3's reasoning would have
graded as exposed. They returned `sections_returned: []` (see §N4).

### N4. The smoke gate never received it — §M3's contamination claim is refuted

§M3's remaining strong claim was that the leak *"contaminated the gate itself"*, that any gate
run reading the instructions section *"was told that a known failure specimen on this instance
threw in the agent copy"*, and that *"the gate has been passing under those conditions"*.

**It is not what happened.** The smoke gate run (`742c45c8…`, TR1000037) made exactly one
`agent_config` call, and it is recorded:

```
input   {"agent":"601672d32b1a83d0f243fed2ce91bf3e","section":"instructions"}
output  "mode":"list", "matched_agents":[], "matched_usecases":[], "sections_returned":[]
        note: No sn_aia_agent and no sn_aia_usecase matched "601672d3…"
              (searched sys_id, name and internal_name on both).
              Read status — sn_aia_agent: empty, sn_aia_usecase: empty.
```

The identifier the model passed matches no agent record on the instance, so **no section
rendered and the note never shipped**. A later native probe run made two `agent_config` calls —
the same identifier, and `{"agent":"PA GP Probe Agent"}` — and both returned
`sections_returned: []` (TR1000056), as did the two custom smoke calls (TR1000049, TR1000053).
**Corpus-wide exposure of leak 2 is the seven rows in §N3 and nothing else** — no smoke run of
either harness, native or custom, ever received it.

§M3's parenthetical *"which the gate's own expected answer requires it to do"* is wrong on the
same evidence: the gate reached its expected answer — `context_processing_script` line 42,
`InternalError`, from the `sn_aia_message` `script_errors` evidence — **without any instruction
text at all**. Its `agent_config` call returned nothing and the diagnosis was correct anyway.

**A harness finding falls out of this, and it is the more useful half.** The gate's only
layer-2/3/7 probe silently swept nothing, and no column recorded that. `layers_swept` is derived
for scored rows, but the smoke gate is a pass/fail gate with no scorecard row, so a tool call
that resolved to an empty read left no trace anywhere except the audit trail. That the run
passed regardless does not make the empty sweep invisible — it makes it *unnoticed*, which is
§H5's failure mode aimed at the gate rather than at a seed.

### N5. Leak 1 — zero, and §M3's open question closes

§M3 could not bound leak 1 (`PaToolGenAiLog`'s `capability_unresolvable` `next_step`), because
*"the finding's presence or absence in a native run's tool output was never captured"*. It was
captured. Two facts settle it:

1. **`capability_unresolvable` fires only in `check_config` mode**, and the corpus contains
   exactly **two** `check_config` calls — seed 04 run 1 (TR1000044) and seed 04 run 2
   (TR1000045). The other nine `genai_log` calls, custom's two included, ran `for_execution`,
   which cannot raise the finding at all. So at most 2 of 12 rows were ever eligible.
2. **Both report `"findings":0`** in `evidence_basis` — no finding of any kind fired on either
   call, so `capability_unresolvable` did not. Their payloads are ~51,000 chars and the audit
   digest elides 48,979 of them, but `evidence_basis` sits at the **tail**, which the digest
   preserves by construction (see `PaAuditLogger`'s PAYLOAD DISCIPLINE). The count is read, not
   inferred from an absent string.

**Leak 1's corpus-wide exposure is zero, measured.** The guess §M3 declined to offer is no
longer needed.

### N6. One filled cell is contradicted — seed 03 run 2

§E2's used-layers discipline lets `agent_config` credit layers 2, 3 and 7 *"only if the diagnosis
actually used them"*. Read against the trail, eleven of the twelve rows reconcile. One does not:

**seed 03 run 2 (`e1c319c0…`, TR1000043) is credited `5/7 (L1,L2,L3,L5,L6)`, and its only
`agent_config` call returned `["tools"]`.** It never received instruction text, so L2 cannot be
credited — the layer was not swept. Its sibling run 1 said so about itself (*"instructions
section not pulled"*) and was correctly denied L2; run 2's note says *"consistent with run 1"*
while the cell is not.

Corrected in `scorecard-agent-doctor.md` to **`4/7 (L1,L3,L5,L6)`**, with the derivation named in
`notes`. **No gate movement:** `passes_gate` consumes `root_cause_layer_correct` and
`fix_usable_unedited` only (§A2), and neither changes. §A's verdict, the 7/10, the band and every
other row stand exactly as filed.

That this is the *only* contradiction is worth stating: the derivation was sound eleven times out
of twelve. The point is not that the scorer was unreliable — it is that "the diagnosis discussed
instruction text" was being read off the diagnosis, which is the party with an interest.

### N7. What the method changes

The trail can decide the necessary half of §E2's rule, and only the necessary half. Written into
`scorecard-agent-doctor.md` §E2 as a two-part test:

- **Necessary, and measured:** `agent_config` cannot credit a layer whose section the call did
  not return. `instructions` → L2, `tools` → L3, `triggers` → L7; `overview` maps to no layer.
  Read `sections_returned` from the run's audit `result` row. A section that never rendered is a
  layer that was not swept, whatever the Fix Report says.
- **Sufficient, and still read from the diagnosis:** receiving a section does not mean using it.
  The scorer still judges whether the diagnosis used what it got.

So the trail can **refute** a layer credit but cannot **confer** one — which is the honest shape,
and the reason this is a change of rule rather than a change of scorer.

`PaAuditLogger.toolCalls(runId)` (#96) is the read-side accessor this needs: every audit row for a
run, in creation order, with `input` on intent rows and `output` on result and error rows.
`invokedTools(runId)` is unchanged and still answers #79's narrower question.

### N8. What this does not establish

- **No score movement, and none is claimed.** §A's verdict, the gate tally, every rubric column
  and every `passes_gate` value stand as filed. One derived column on one row is corrected.
- **A digest miss is not an absence.** Payloads are digested head+tail past 4,000 chars, so a
  string in the elided middle is invisible here while being present in what the model received.
  Every measurement above rests on a value the digest **preserves** — `sections_returned` in the
  head, `evidence_basis` in the tail — or on a positive hit. `toolCalls`'s header says this, and
  a future caller that searches payload text must say which of the two it found.
- **It does not re-open the leaks.** Both are removed and both are pinned by
  `test/blindRule.test.js`. What changed is the record of what they reached, not their status.
- **It says nothing about depth.** §K4 remedy 2 / §L7 — making the model take the second step —
  remains the milestone blocker, untouched by anything here.
- **The v4 pass is still the next thing.** §M7's queue is unchanged; this pass removes an
  inference from the record it will be read against, and hands it a measurable `layers_swept`.

---

## O. The v4 scored pass (`2026.08.0301`, #98) — a baseline, and the first drift measurement

§M7's queued pass, run 2026-08-03. **Native 3/10, custom 0/10.** The pass was designed to buy a
readable single-variable baseline plus a native control; it also produced the project's first
measurement of model drift, and — unplanned — its first measurements of the benchmark's own
scoring instrument.

Rows and per-row notes: `benchmark/scorecard-agent-doctor.md` (native, v4 section) and
`benchmark/scorecard-custom-harness.md` (custom, v4 section). Raw artifacts for all 20 runs,
including complete Fix Report text: `benchmark/raw-evidence-v4.md`. Design and the predictions
filed before running: `docs/superpowers/specs/2026-08-03-v4-scored-pass-design.md`.

### O1. What was run, and what was deliberately not touched

**20 runs — 5 seeds × 2 runs × 2 harnesses, one day, one deployed version.** Both harnesses ran at
app version `2026.08.0301` on gpinst01. That version is a measurement, not an assumption: the
instance was found at `2026.08.0226` and deployed from `main`@`8c909cd` **before any evidence was
recorded**, then live `sys_script_include` bodies for `PaFixReport`, `PaArtifactStore`,
`PaToolRegistry` and `PaScriptToolAdapter`, and live `sn_aia_agent.instructions` for Agent Doctor,
were byte-compared against `src/server/` and `docs/agent/agent-doctor-instructions.md`
(`raw-evidence-v4.md`, "Deploy verification").

**Sequencing: interleaved by seed** — native run 1, custom run 1, native run 2, custom run 2, per
seed. Intra-day model drift then spreads across both harnesses rather than aligning with the
harness boundary, which is the short-timescale form of the different-day gap §I4 confound 3 names.
Run identities were verified **distinct** by direct `conversation_ref` query per row, not inferred
from timing — `PaRunAnchor`'s one-anchor-per-user-per-30-min fallback makes interleaving a hazard
rather than a safeguard here.

**Pre-flight, all measured fresh and all recorded:** five seeds' §A3 fixture conditions re-verified
live — **all five not void**; budget knobs read from the instance —
`sn_aia.continuous_tool_execution_limit = 25`, `max_auto_executions = 10` on all seven tools;
`layers_available` **7/7**, reached by two independent query paths (`sn_aia_agent_tool_m2m` for
native, `PaToolRegistry`'s own registry read for custom) rather than one value asserted for both;
smoke gate fired on both harnesses and passed before any scored row was spent.

**Nothing that native reads was allowed to move.** Held byte-identical, on purpose:
`docs/agent/agent-doctor-instructions.md` (native-shared), `src/server/PaScriptToolAdapter.js`, and
everything else under `src/server/`. **No product code changed in this pass.** The reason is the
whole point of §O3: native's ten rows are only a drift control if native's inputs are identical to
what produced the standing Task 12 rows. Every available edit — `:48`, `:67`, §K5's `excerptPriority`
propagation — would have converted the native delta from *drift* into *drift + edit*, unattributable,
spending ten runs to buy a measurement and spoiling it in the same pass.

**§M7's instruction to resolve §I4 confound 2 inside this pass is discharged without an edit,
because #93 already discharged it.** Confound 2's claim was that `agent-doctor-instructions.md:48`
states a categorical trace-plus-one rule the contract does not offer an exemption to.
`PaFixReport.schemaText()` now reads *"EVERY root cause needs at least one `trace` evidence entry
PLUS at least one of … UNLESS nothing ever ran … OR you mark the cause UNCONFIRMED"*, with
`would_confirm` required in that case. `:48`'s sentence and `:50`'s escape now **match** the
contract they were said to contradict; the confound closed when the contract moved (§L1), not when
a document was rewritten. Recorded here with the `schemaText()` evidence rather than performed as a
no-op edit. `:67` (§M5's parked *"where defects live"* line) stays in place, now for a second and
better reason: §M5 already ruled it domain guidance derived from R-22 rather than an answer, and
moving it would cost this pass its baseline for no correctness gain.

### O2. The gate tally, against predictions filed before the pass ran

| Harness | Rows | `sum(passes_gate)` | Rubric points | Scoring round |
|---|---|---|---|---|
| native (Agent Doctor) | 10 valid, 0 void | **3 / 10 (30.0%)** | 42 / 60 | C — redacted packets, 10 independent scorers |
| custom (`x_snc_troubleshoot`) | 10 valid, 0 void | **0 / 10 (0.0%)** | 0 / 60 | A — leaked packets, 10 independent scorers |

The two scorecards are drawn from **different scoring rounds**, deliberately and with the argument
stated in both files; §O5 and §O7 carry it. Gate arithmetic was recomputed independently by script from each row's
four column values across all 28 rows in the pass (20 v4 + 8 re-scored standing) — **zero
mismatches**, and §A's constraint holds in all 28.

§9 of the design filed three predictions in advance, so the result could not be read post-hoc:

- **Custom gate 0–2/10 → 0/10. HELD.**
- **Custom depth 1–2 tool calls per run, §H8's acceptance test likely still unmet → HELD exactly**
  (§O4).
- **Native near 8/10 → 3/10. FAILED.** §9 also said, in advance, that *"a large native deviation
  **is the finding**, not noise, and would retroactively qualify every cross-day comparison in
  §G–§N."* That sentence is now load-bearing, and §O3 is what it obliges.

**The shape of native's failure is specific.** Recomputed from the Round C table: native named the
**correct root-cause layer on 8 of 10 rows** and the **correct fix target on those same 8** — every
row except seed 02's two, which scored 0/6 on the "no failure observed" convergence (§O6). Of the
seven native rows that failed the gate, **five scored 5/6 and lost only `fix_usable_unedited`**.
Native is diagnosing well and emitting fixes blind scorers judge not applicable as written:
descriptive values where a concrete one was needed (seed 04, both rows), an unfilled
`<target group name>` placeholder (seed 03 run 2), a fix whose own text defers the mapping code to
a message the report does not contain (seed 01 run 1), and a report that labels the *wrong* target
"(preferred)" and the right one "alternative" (seed 01 run 2). The gate expression
(`root_cause_layer_correct == 2 AND fix_usable_unedited == 1`) turns that one column into the whole
result.

### O3. Drift — the central deliverable, and the most delicate claim in this file

This is the first drift measurement the project has. It is also the one number in §O most easily
overstated, so the arithmetic is given before the reading.

**The confound the measurement had to clear first.** The standing native rows (Task 12, 2026-08-02)
were **operator-scored**; v4's rows are **blind-subagent-scored**. Comparing them directly would mix
model drift with scorer drift. The remedy, at no instance cost, was to blind re-score the standing
rows from their preserved artifacts using the same scorer population and the same rubric
(§7.1 of the design). **Eight of the ten standing rows were re-scored.** The other two — seed 01
run 1 and seed 05 run 2 — produced no full report to re-score: a probe read every message row in
both conversations and confirmed neither execution plan carries a `communicator` task, where all
eight recoverable plans have exactly one. **A structural absence, verified, not a retrieval
failure.** Both were operator gate *passes*.

**The like-for-like number, both sides blind, both sides on redacted packets:**

| | Rows | Gate passes | Rate |
|---|---|---|---|
| standing native (2026-08-02 artifacts, blind re-score) | 8 | 4 | **50%** |
| v4 native (2026-08-03, Round C) | 10 | 3 | **30%** |

**The naive comparison overstates it.** Operator 8/10 → blind 3/10 is not the measurement: two of
those eight operator passes are the rows that cannot be re-scored at all, and a third is the single
row where operator and blind scorer disagree. Quoting 8/10 → 3/10 as a decline compares an
operator's ten against blind agents' ten and charges the difference to the model.

**The scorer population is not systematically harsher, and this was measured rather than assumed.**
On the 8 re-scored rows, operator and blind scorer **agree on `passes_gate` in 7 of 8** — operator
5/8, blind 4/8, one disagreement (seed 03 run 1, on `fix_usable_unedited`). Two of the eight also
differ on `total /6` without changing the gate; a third (seed 03 run 1) is the gate-level split above. A scorer population reading ~1 gate row lower on 8
cannot account for a 20-point gap on its own.

**What is established, and what is only suggested.** A ~20-point difference at n=8 and n=10 is
**not** an established regression, and this file will not call it one. Three claims are defensible,
and all three should be carried together:

1. **ESTABLISHED — native no longer reproduces its 8/10.** Whatever the cause, the standing number
   is not currently reproducible on this instance and should not be quoted as native's live
   capability.
2. **ESTABLISHED — part of the apparent gap is not model behaviour.** Part is the scorer population
   (~1 row across 8), and part is the two unrecoverable rows, both of which the operator had passed.
3. **SUGGESTED, NOT ESTABLISHED — a residual behavioural decline of roughly 20 points.** Real in the
   direction it points, measured with the scorer confound controlled, and at n=8 versus n=10 well
   inside the range a handful of rows could produce. It qualifies every cross-day comparison in
   §G–§N as §9 said it would; it does not overturn any of them.

**The seed-05 invocation caveat, which bounds how clean "like-for-like" is.** Native's seed-05 prompt
was **composed fresh** by the controller, not recovered: Task 4 recovered only the custom harness's
JSON request body, no native-language form of it existed anywhere to recover, and the plan
explicitly permitted the recovered body's equivalent natural-language form. Seed 05's two native
rows may therefore not be invocation-identical to whatever Task 12 typed. Seeds 01–04's eight native
rows are unaffected — same execution-plan sys_ids, identical targets. **The drift comparison is
clean for 8 of 10 native rows and carries an invocation caveat on 2** — and those 2 are both v4 gate
passes, so the caveat sits on the favourable side of the v4 number.

**A controller correction, recorded rather than quietly absorbed.** Mid-pass, after a *single*
re-scored row had come back, the controller told the operator the drop looked like scorer drift.
The full eight reversed that. Generalising from one row is precisely the error this project keeps
filing issues about — §N1's premise, §M3's inferred exposure grades, §H3's correction all have the
same shape — and §O should not inherit it silently just because the final number came out right.

### O4. Depth — unchanged, and now measured 45 runs deep

Depth was measured from the audit trail (`PaAuditLogger.toolCalls(runId)`), independently of and
before the reports, per §N7's asymmetry: the trail can **refute** a layer credit but never **confer**
one.

**Custom swept `1/7 (L1)` on all 20 rows of this pass — every seed, every repetition.** Native ranged
**1/7 to 6/7**:

| Seed | Native r1 | Native r2 | Custom r1 | Custom r2 |
|---|---|---|---|---|
| 01 | 4/7 (L1,L3,L4,L5) · 10 calls | 4/7 · 10 calls | 1/7 (L1) · 1 call | 1/7 · 1 call |
| 02 | 1/7 (L1) · 5 calls | 1/7 · 5 calls | 1/7 · 1 call | 1/7 · 1 call |
| 03 | 5/7 (L1,L3,L4,L5,L6) · 9 calls | 4/7 · 9 calls | 1/7 · 1 call | 1/7 · 1 call |
| 04 | 5/7 (L1,L2,L3,L6,L7) · 9 calls | 2/7 (L1,L6) · 5 calls | 1/7 · 2 calls | 1/7 · 2 calls |
| 05 | 6/7 (L1,L2,L3,L5,L6,L7) · 9 calls | 6/7 · 7 calls | 1/7 · 1 call | 1/7 · 1 call |

`layers_available` measured 7/7 on every row, so no row was depth-limited by what was attached.
Seed 05 native's 6/7 is the deepest sweep in the project record.

**§H8's acceptance test — one custom run reaching `schema_lookup`, `query_table` or `genai_log` on
the seed that needs it — is UNMET across all 20 rows.** With §L7's prior count that is **45 runs**
with the test unmet, and **four of the seven tools have still never been invoked by the custom
harness in any run**. The two seed-04 custom rows did make **2** tool calls — the first time above 1
in this pass — but the second call was `read_artifact`, which pages an artifact already fetched and
**is not a layer**. Depth did not move; paging did.

### O5. What the pass learned about its own instrument

The pass measured its measuring apparatus, and four of those measurements are worth more to the next
revision of §A than the scores are.

**Scorer packets leaked the answer and the expected grade — issue #100.** Four seed specs narrate
*prior passes' scored outcomes*, including literal grades: seed-03 *"Both scored runs diagnosed layer
5 … and scored 6/6"*; seed-04 *"scored the canonical 2/0/1/0 decoy row"*; seed-05 *"OBSERVED AT
TASK 12 … the prediction held"*; seed-02 *"scored strictly against the expected layer-2 answer (2/6,
fail, not void)"*. Specs are copied verbatim into scorer packets, so the first scoring round's
agents could see what a comparable run had previously scored. **The existing blind rule does not
cover this by design:** it binds what reaches the **harness**, and seed specs deliberately never
reach the harness — they *are* the answer key. Scorer-packet blindness only became a concern when
v3 moved scoring from the operator to blind agents, and the rule was never extended. Found at
Task 12, when the re-score packet builder redacted the narratives and the mismatch surfaced.

**SUGGESTED — The leak moved the result by about one row, on the `fix_usable_unedited` column.** Holding scorer topology fixed (10 independent agents, one per row) and changing only the packets: **Round A, leaked → 2/10; Round C, redacted → 3/10.** The effect is small (n=1) and lands on the same indeterminate column (§O5's rubric-reproducibility finding). The leak's *direction* does not match an anchoring mechanism: the leaked packets carried narratives describing native scoring *well*, so anchoring toward those narratives should have pushed scores **up**; instead, the leaked round scored **lower** (2/10 vs 3/10 redacted), opposite to anchoring. Custom scored `root_cause_layer_correct = 0` on all ten rows in the leaked round, which no anchoring toward a prior correct answer could produce. Validation that the redaction worked as intended rather than lobotomising the packet: one re-score independently reproduced seed 04's canonical `2/0/1/0` decoy row **from a redacted packet**, deriving it from the decoy scoring *rule* (kept) rather than the removed narrative. Guidance survived; the answer did not.

**SUGGESTED — Scorer topology moves the result by about two rows, on the `fix_usable_unedited` column, and this had never been measured.** Holding packets fixed (all redacted) and changing only how scorers were dispatched: **one agent scoring ten rows sequentially → 5/10; ten independent agents on the identical packets → 3/10.** The effect is moderate (n=2) and lands on the same indeterminate column. A single agent scoring a set in sequence is materially **more generous** than independent agents on the same material. This is a property of the benchmark's own instrument, not of either harness, and it is larger than the leak effect. It is why native's rows are sourced from Round C: Round C is the only round matching the standing-row re-scores' topology (independent agents, redacted packets), and §O3's comparison would be meaningless against any other.

**A controller error, recorded plainly, because it is the same error the pass exists to avoid.**
Round B changed **two** variables at once — the redaction *and* the scorer topology — so its
2/10 → 5/10 movement could not be attributed to either. That is the exact confound §H7-4, §I4 and
§K5 keep naming, committed by the controller in the middle of the pass built to avoid it. Round C
re-ran with independent scorers on the same redacted packets, isolating the variable. Round B is
kept rather than discarded, because B-vs-C is what measures the topology effect above.

**A rubric-reproducibility finding: the blind pass did not apply one consistent rule to itself.**
Across the two seed-03 standing rows, both containing unfilled-placeholder fixes for `assignment_group` (run 1 with a literal placeholder, run 2 with prose), the *same style* was scored `fix_usable_unedited = 0` on run 1 and `= 1` on run 2 — by the same blind re-scoring pass, whose own notes flag run 2 as "the closest call in the row" and reason that `assignment_group` is a plain `StringColumn` rather than a reference field. **This same inconsistency recurs within v4's native round: rows 09 and 11, both seed 03, carry identical fix text `assignment_group = <target group name>`; row 09 is scored as "normal implementation discovery work" yielding `fix_usable_unedited = 1`, while row 11 is scored as "an unfilled placeholder" yielding 0.** Not resolved here by picking a side; filed as a finding for whoever next revises §A, since it is a gap in the rubric's text, not a lapse by a scorer.

**The audit-derived layer rule refuted a NATIVE claim for the first time.** Both seed-01 native runs
report layer 2 swept via `agent_config`; the recorded call requested `section:"tools"` and its
`sections_returned` is `["tools"]`, so the instructions section never rendered and L2 cannot be
credited. Credit corrected **5/7 → 4/7** on both rows, re-derived against the live instance by the
reviewer. Until now §N7's refute-but-never-confer rule had only ever corrected the custom harness's
self-reports; it is not a rule aimed at one harness. **No score movement** — `passes_gate` consumes
`root_cause_layer_correct` and `fix_usable_unedited` only.

### O6. Findings about the harnesses worth more than the scores

**Seed 01 — custom missed a defect whose discriminating value it was holding.** Both custom runs
made one `agent_trace` call, and that call returned `priority_stored: null` **verbatim** — the exact
discrepancy both native runs used as their primary evidence. Both reports concluded "no errors were
reported" with empty `root_causes`. **Evidence in hand and unused is a different failure from
evidence not fetched**, and only the second is a depth problem. #91 fixed visibility (§K); this sits
downstream of it, and it is the strongest single reason §O8 treats depth as the remaining lever
rather than one of several.

**Seed 02 — all four runs, both harnesses, both repetitions, independently concluded "no failure
observed."** Seed 02's defect is an ambiguous instruction causing misrouting, so the execution
completes successfully while doing the wrong thing, and every run treated a plausible-looking
completion as evidence of health. Native's rows say so explicitly, marking L2 — the seed's expected
layer — NOT SWEPT. **This is either a true negative about the fixture or a shared blind spot in a
trace-first method, and the record deliberately does not rule.** No prior pass has recorded a
cross-harness agreement of this shape; ruling on it from four runs would be the §O3 error again.

**Seed 04 — #93's path-C fabrication cross-check fired live.** Custom run 1 was rejected by
`PaFixReport.validate` for naming layer 6 as both already SWEPT *and* the layer `would_confirm`
still needed — a self-contradiction, with no `genai_log` or `log_analysis` call behind the sweep
claim. Its sibling run 2 marked layer 6 `UNAVAILABLE` honestly and validated. §L1's pricing rule
working as specified, **caught live on a fresh run rather than by construction on a chosen
specimen** — and, as §L5 predicted, paid by the inflated claim and free to the honest one. Neither
run diagnosed the seed; the check governs honesty, not correctness.

**Seed 05 — both custom runs failed validation on an absence claim, and the rejection appears
correct.** Seed 05 is *the* absence seed (nothing ever ran) and #78 was specifically the fix for
"the evidence rule structurally rejects a correct absence diagnosis," so the adjacency demanded a
reading rather than an assumption. Read against the code and the recorded rejection text: #78's fix
is path **B** of `PaFixReport._checkEvidenceRule`, which fires exactly when the report declares
layer 1 `UNAVAILABLE` — which both runs did — and which **relaxes the privileged status of the
trace label without waiving corroboration**, requiring two *distinct* non-trace sources instead. The
recorded rejection is B's own message: *"cite at least TWO DISTINCT sources … found 0."* Both runs
made a single `agent_trace` call and never called `agent_config`, which `PaToolRegistry` itself
documents as covering layers 2/3/7 including trigger wiring, and which was available (7/7). **This
is not a regression of #78; #78's path was entered and its condition genuinely unmet.** It is the
depth failure surfacing at the validator instead of at the rubric. One structural note worth
carrying: because path B returns, a run in the absence case **cannot fall through to path C**, so
#93's UNCONFIRMED exemption is unreachable for any report that declares layer 1 UNAVAILABLE — both drafts carried
`would_confirm` and neither could be judged by C. Whether that ordering is right is a design
question, filed here rather than answered.

**The harness never persists the inbound request payload — issue #99.** Task 4 needed seed 05's
original request body and could not read it from any run record: `prompt_digest` attaches only to
`actor:'tool'` transcript entries, so the request that *defines what a run was asked to diagnose* is
absent **by construction** for every seed, both harnesses. The body was eventually recovered from a
copy in another plan's gitignored evidence file and corroborated twice, but that is provenance, not
a system of record. A diagnostic tool that cannot say afterwards what it was asked to diagnose
cannot fully audit its own runs — and this is exactly the class of defect §N1 caught one level up.

### O7. What this does not establish

- **The stop rule is unchanged, so custom's 0/10 is a confirmed prediction, not new information
  about depth.** §J5 wrote that *"running ten more rows against an unchanged termination rule would
  buy another 0/10 and no new information"*; #88 was built to change it and was refuted, so the
  rule is in fact still unchanged. What this pass bought is a clean baseline for the depth work and
  a score check on #91/#93 — not evidence that depth is or is not fixable.
- **The drift result is suggestive at small n.** n=8 against n=10, one instance, one day per point.
  §O3's three claims are stated at the strength each supports and no further.
- **Model drift is now measured at exactly two points** — 2026-08-02 and 2026-08-03. Two points
  bound nothing about the shape or the rate of drift; they establish only that the two differ.
- **The seed-05 invocation caveat stands** — 8 of 10 native rows are invocation-clean, 2 are not,
  and both of the caveated rows are v4 gate passes.
- **The two v4 scorecards are sourced from different scoring rounds** — native Round C, custom
  Round A. The argument for accepting that asymmetry is stated in both files and is narrow: every
  custom row scored `root_cause_layer_correct = 0`, and a leaked packet could only ever *inflate* a
  score, never manufacture a false zero. The argument is sound for a floor of zero and would not be
  sound for any other number. **Custom's 0/10 was never re-scored on clean packets**, and a future
  custom pass should not inherit Round A's packets.
- **§K5's `excerptPriority` propagation to native is still pending, deliberately.**
  `PaScriptToolAdapter` still passes no priority. This pass was the reason to hold it; the reason
  expires with the pass.
- **No score in §G–§N moves.** Every row filed there stands as filed. What §O3 changes is how much
  weight a cross-day comparison between them can carry — §9 predicted exactly that, and this is the
  prediction being honoured rather than a retroactive rewrite.
- **The 3/10 and the 0/10 are not comparable to each other as capability numbers without §O4.** A
  harness that sweeps 1/7 on every row and one that sweeps up to 6/7 are failing different tests;
  the gate does not distinguish them and §O4 does.
- **One of native's three gate passes (row 09, seed 03 run 1) turns on the unresolved rubric call.** §O5's rubric-reproducibility finding flags the `assignment_group` placeholder inconsistency within the v4 native round itself: identical text scored differently in rows 09 (pass) and 11 (fail) by the same blind pass. Row 09 is one of the three native rows that passed the gate, so the 3/10 result carries ±1 row of indeterminacy on this column.

### O8. The queue

**Depth is the milestone blocker and is now the only untested lever.** §K4 remedy 2 / §L7 — the
`PaAgentLoop` stop/continue condition, making the model take the second step — is untouched by
everything since v3. Three things this pass changes about how that work should be specified:

1. **Visibility is not the constraint, and neither is evidence access.** Seed 01 (§O6) is the clean
   demonstration: the discriminating value was in the one tool output the model read, and the model
   did not use it. Any depth change premised on *giving the model more* has to explain seed 01
   first.
2. **The acceptance test is unchanged and now 45 runs unmet** — one custom run reaching
   `schema_lookup`, `query_table` or `genai_log` on the seed that needs it. Four of seven tools have
   never been invoked.
3. **The baseline it will be measured against exists now**, with audit-derived per-row tool counts,
   layer sweeps and LLM-call counts for 20 rows — which is what §10 of the design said would turn
   remedy 2 from a direction into a specification.

Also open, and each filed rather than folded into the depth work:

- **#100** — extend the blind rule to scorer packets. The rule as written binds the harness only,
  and the leak cost ~1 row on a 10-row pass (§O5). Any future pass scoring blind agents inherits
  this until it is fixed.
- **#99** — persist the inbound request payload. A run's own diagnostic subject is currently
  unrecoverable after the fact, for every seed and both harnesses.
- **#81** — the repair turn cannot gather evidence. §L6 narrowed this: path-C rejections are
  repairable without tools, so the dominant rejection reason has changed shape and #81's four
  options should be re-read against that. Seed 05's path-B rejections (§O6) are *not* tool-free
  repairable, which is #81's live instance in this pass.
- **#73 / #74 / #75** — the Phase 1b REST-surface items (vacuous stuck-run check, hardening bundle,
  unaudited refusals), unchanged by this pass.

**Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is
not met.** The recommendation is now made on a smaller margin than §H8's — 3/10 against 0/10, both
measured the same day on the same version, rather than 8/10 against 1/10 measured a day apart — and
§O3 is the reason to read that margin as a qualification of the old number rather than a
deterioration of the gap.

---

## Fix Round 1 (2026-08-03, Code Review Corrections)

**Issues addressed:** I1, I2, I3, M1, M2, M3 from §O code review.

**Changes:**

- **I1:** Extended §O5's rubric-reproducibility finding to note the same inconsistency recurs in v4's native round (rows 09 and 11, seed 03, identical text scored differently). Added §O7 bullet stating one of native's three gate passes (row 09) turns on this unresolved rubric call.

- **I2:** Relabeled leak and topology effects in §O5 as SUGGESTED rather than established. Added effect sizes (n=1 for leak, n=2 for topology) and noted both land on the indeterminate `fix_usable_unedited` column. Clarified leak direction (lower score when packet leaked) contradicts anchoring mechanism (would expect higher score if anchoring toward described good outcomes).

- **I3:** Corrected factual error in §O3: "Three of the eight" → "Two of the eight"; clarified the third case (seed 03 run 1) is the gate-level disagreement already noted above.

- **M1:** Changed provenance label from "recomputed by hand" to "recomputed independently by script" (line 1565).

- **M2:** Tightened §O6 scope on #93's UNCONFIRMED exemption: from "unreachable on the absence seed" to "unreachable for any report that declares layer 1 UNAVAILABLE" (line 1771).

- **M3:** Adjusted §O5 placeholder description to not imply both standing rows carried literal placeholders: "run 1 with a literal placeholder, run 2 with prose" (line 1707).

All changes are append-only in DECISION.md. No other files touched. No verified numbers moved.


---

## P. The depth gate (`2026.08.0401`, #103) — the floor works, the acceptance test does not

§O8's queued next item, run 2026-08-04. The change is one interception in `PaAgentLoop._step()`:
before a terminal action (`answer` / `fix_report`) is honored, the loop reads the draft's own
`NOT_SWEPT` layers, maps them to the tools that would close them, and — if the audit trail shows no
call has reached any of them — refuses the terminal action once, appends an interrogation to the
next prompt, and loops again. Release is **sticky**: the gap set recorded at the first hold is the
only one that can release it, so the gate buys exactly one forced beat.

Design: `docs/superpowers/specs/2026-08-03-depth-gate-design.md`. Plan:
`docs/superpowers/plans/2026-08-04-depth-gate-agent-loop.md`. Measurements, verbatim reports and
the captured hold prompt: `benchmark/raw-evidence-v5-depth-smoke.md`. Predictions P1–P7 were filed
on issue #103 **before the code was written**; P8 was added during the final whole-branch review,
before the runs.

### P1. What was run

**Six runs, custom harness only, seeds 01 / 03 / 04, two each**, fired sequentially with each
polled to terminal before the next was POSTed. Seed 02 excluded per spec §11; seed 05 not in scope.
These three seeds were chosen because their answers sit behind the layer-4, layer-5 and layer-6
tools respectively — the tools with zero invocations across 45 prior runs.

**Native did not move on this branch** (§K5 / §I4 confound 3 stays closed), so there is no native
arm and no cross-harness comparison from this smoke.

Deploy was verified by reading the installed `PaAgentLoop` body back through the MCP broker and
literally comparing `_scrubToolNames` against `src/server/PaAgentLoop.js` — including the `'gi'`
flag added in the branch's last commit. **Recorded oddity:** `sys_script_include.sys_updated_on`
still read `2026-08-02` immediately after a successful install. Content was branch HEAD; the
timestamp is stale metadata. A future pass that checks only the timestamp will wrongly conclude the
install did not land.

### P2. The scored predictions

| | Prediction, as filed | Outcome | Measured |
|---|---|---|---|
| P1 | The hold fires on ≥ 5 of 6 runs | **HELD** | 6 of 6 |
| P2 | **≥ 1 run reaches `schema_lookup`, `query_table` or `genai_log` on the seed that needs it — §H8's test MET** | **REFUTED** | 0 of 6. None of the three was invoked in any run |
| P3 | Median tool calls rises from 1 to ≥ 2 | **HELD** | median 1 → 2 (counts: 2,2,3,2,3,2) |
| P4 | 1–2 runs ride to `partial` (the refusal tail) | **REFUTED** | 0 of 6. All six `complete` |
| P5 | Seed 01 still misses `priority_stored: null` on ≥ 1 of its 2 runs | **HELD** | missed on 2 of 2 |
| P6 | Unsupported-sweep-claim rate does NOT rise above v4's ~1/10 | **HELD** | 0 of 6 (v4: 1 of 6 on these seeds) |
| P7 | Compliance concentrates on `agent_config` | **HELD** | 6 of 6 releases were `agent_config`, exclusively |
| P8 | The model does not route around the gate by relabelling `NOT_SWEPT` → `UNAVAILABLE` | **HELD** | `UNAVAILABLE` 1/42 → 2/42; holds still fired 6/6 |

**Six held, two refuted.** P4 is refuted in the favorable direction — the gate is not a
denial-of-service — and is recorded as refuted anyway, because a prediction that was wrong is
recorded as wrong regardless of which way it was wrong.

P8 needs its qualification stated rather than buried: `UNAVAILABLE` did rise, 1 occurrence to 2,
both on layer 6, both with the honest reason "no `genai_log` or `log_analysis` tool invoked". It is
scored HELD because the relabel escape is defined by its *mechanism* — terminating in 2 LLM calls
with zero holds — and every run took a hold. The `NOT_SWEPT` drop is accounted for by `SWEPT`
rising 4 (layer 3, legitimately earned) plus that one label. At 42 labels this is one occurrence of
difference; do not harden it either way.

### P3. What the smoke establishes

**The mechanism works exactly as designed, and the design does not reach the acceptance test.**

- A hold fired on **6 of 6** runs, released in every case by a real `agent_config` call verified
  `"success":true` against its own audit row (the M4 check — a released hold is a *dispatch*, so
  this was checked separately rather than assumed).
- **Audit-derived sweep moved 1/7 → 4/7 on every run** (L1 via `agent_trace`; L2, L3, L7 via
  `agent_config`). That is the first movement in this number in the project's history — it was 1/7
  on all 20 v4 rows and on all 45 runs before it.
- **The interrogation reached the model intact.** Captured verbatim from
  `sys_generative_ai_log` `1a70063c2b260754f243fed2ce91bf87`: the block renders whole into the
  prompt with no digest truncation (the plan's correction #1, the #72 / §G3a observation-channel
  defect, confirmed avoided in the live artifact), and `_scrubToolNames` replaced the tool names in
  the model's own quoted-back reasons with `[tool]` — so the harness never named a tool and §H8's
  test stayed non-vacuous.
- > **Corrected 2026-08-05 (#110, §S).** "The harness never named a tool" is false as written and
  > was false when written. `_scrubToolNames` kept tool names out of *the hold block*; the prompt
  > that block sits inside named all seven throughout, via `PaToolRegistry.promptBlock()`. The
  > `[tool]` substitution is real and is verified — read the claim as scoped to the interrogation
  > block, which is what §S preserves.
- **§H8's acceptance test is still unmet.** `schema_lookup`, `query_table`, `genai_log` and
  `log_analysis` have now never been invoked by the custom harness in **51 runs**.

**Per the falsification rules filed in advance, this is the third case: "holds fire, gaps close,
measured tools never reached → the mechanism is refuted *as specified*; the next iteration works on
direction, not force."** Neither revert trigger fired: the gate is not a denial-of-service (P4) and
it did not reproduce #88's fabrication (P6).

**P7 is the mechanism of P2's failure, and it was pre-registered as a known tilt.**
`_layerToolMap()` gives `agent_config` three layers (2, 3, 7) in one call, while layer 4 is
reachable only by `schema_lookup` and layer 5 only by `query_table`/`log_analysis`. The cheapest
way to discharge a hold is therefore one `agent_config` call, and all six runs took it. The tilt
comes from the map, not from the gate. The finding is clean and directive: **force was sufficient
to make the model act and insufficient to make it act on the right layer.**

**Constraint 1 is unmoved.** Both seed-01 runs bought a second tool call and neither spent it on
the evidence already in hand: `priority_stored: null` sits verbatim in the turn-2 prompt of both
runs, and the string appears nowhere in either delivered report, both of which conclude "no
observable failure" with empty `root_causes`. §O6 said evidence-in-hand-and-unused is a different
failure from evidence-not-fetched. This smoke moved the second and left the first exactly where it
was.

### P4. The countervailing observation, recorded because it cuts against the headline

Four of the six runs produced a **non-empty `root_causes` and a fix** — three CONFIRMED, one
UNCONFIRMED with a correctly-named `would_confirm`. v4's custom rows on these same seeds produced
empty `root_causes` or a draft that failed validation. Whether any of these four findings is
*correct* is a scored pass's question and this smoke does not answer it.

This matters because §H8's acceptance test is a **proxy** for "does the harness investigate", and
the proxy and the artifact moved in different directions: the tools the test measures were not
reached, and the reports changed shape anyway. Two flags for whoever scores next, both in the raw
evidence: run 6 places its root cause on layer 6 while its own `layers_swept` marks layer 6
`UNAVAILABLE` (validation had no `SWEPT` claim to bite on), and run 3's `would_confirm` correctly
names layer 4 — the model identified the missing evidence and still did not call the tool that
closes it.

### P5. What this does not establish

- **Six unscored runs, three seeds, one instance, one day.** No score was assigned to any of them.
- **No claim about gate passes and no claim about a rate.** §H8 asks for one run reaching one tool;
  one hit would have been a hit, and zero hits across six runs is not a frequency either.
- **Nothing about whether depth converts to score.** That is a v5 scored pass; this smoke's only
  job was to decide whether firing one is worth it.
- **Nothing about the other two seeds.** Seed 02 was excluded by design and seed 05 was not run, so
  the gate's behaviour on the absence seed — where `UNAVAILABLE` on layer 1 is the honest answer and
  #78's exit must stay open — is **untested live**. It is covered by unit tests only.
- **Nothing about native**, which did not move on this branch.
- **P8 rests on one label of difference** (1 → 2 occurrences across 42), which is an observation,
  not a rate.

### P6. Recommendation

**Do not fire a full v5 scored pass on this change alone.** The pre-filed rule for this outcome
says the next iteration works on **direction, not force**, and the tilt that defeated P2 is
identified precisely: the cheapest release closes three layers at once. Candidate directions, in
the order the evidence supports them: weight or order the gap set so the layer the model itself
names in interrogation item 2 is the one that must be reached; or make the map's cheap multi-layer
release not discharge a gap on a layer it did not touch.

The counter-argument is real and is recorded rather than dismissed: four of six runs produced
fixes where v4 produced none, and that is the kind of change scoring measures and sweep depth does
not. If a pass is fired anyway, the informative one is **seeds 03 and 04 only** — the two where
root causes appeared — scored with independent per-row scorers (§O5) and with #100's packet leak
fixed first, not a full five-seed repeat.

**Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is
not met.**

---

## Q. The gate learned to aim (`2026.08.0403`, #109) — §H8's acceptance test is MET

§P6's queued next item, run 2026-08-05. The change is the one §P6 named: `_depthGate` stops
recording the **union** of every open gap's tools as its release set and instead selects **one**
target gap, recording only that gap's **dedicated** tools. One rule applied twice — a tool's
fan-out is the number of layers `_layerToolMap()` lets it close, and fan-out minimality both picks
the target and narrows its release set. Selection prefers the model's own `would_confirm` layer
when it names an open gap; otherwise the structural rank.

Design: `docs/superpowers/specs/2026-08-04-directed-depth-gate-design.md`. Plan:
`docs/superpowers/plans/2026-08-04-directed-depth-gate.md`. Measurements, verbatim arguments and
the hold-prompt verification: `benchmark/raw-evidence-v6-directed-depth.md`. Predictions Q1–Q8 were
filed on issue #109 **before the code was written**.

### Q1. What was run

**Six runs, custom harness only, seeds 01 / 03 / 04, two each**, fired sequentially with each
polled to terminal before the next was POSTed. Seed 02 excluded per spec §11; seed 05 not in scope.
Same shape as the v5 smoke, and byte-identical request bodies, so the two are comparable.

**Native did not move on this branch** (§K5 / §I4 confound 3 stays closed), so there is no native
arm and no cross-harness comparison from this smoke.

Deploy was verified by reading the installed `PaAgentLoop` and `PaFixReport` bodies back through
the MCP broker and matching literal source strings. **§P1's stale-timestamp oddity reproduced
exactly** — `sys_updated_on` read `2026-08-02 05:15:25` after a successful install, the identical
value §P1 recorded a day earlier. Observed twice now on two installs; treat it as this record's
normal behaviour, not a one-off.

### Q2. The scored predictions

| | Prediction, as filed | Outcome | Measured |
|---|---|---|---|
| Q1 | The hold fires on ≥ 5 of 6 runs | **HELD** | 6 of 6 (7 holds; run 2 held twice) |
| Q2 | **≥ 1 run reaches `schema_lookup`, `query_table` or `genai_log` on the seed that needs it — §H8's test MET** | **HELD** | 3 runs reached one; 2 of those with a well-formed call |
| Q3 | Releases are no longer exclusively `agent_config` | **HELD** | `schema_lookup` ×3, `query_table` ×1, `agent_config` ×2 |
| Q4 | `partial` stays at 0–2 of 6 | **HELD** | 0 — all six `complete` |
| Q5 | Unsupported-sweep-claim rate does not rise above v5's 0 of 6 | **HELD** | 0 of 6 |
| Q6 | `UNAVAILABLE` relabelling does not become the escape — ≤ 3 of 42 labels | **HELD** | 0 of 42 (v5: 2 of 42) |
| Q7 | The **ranked** path carries most holds; declared fires on a minority | **REFUTED** | declared 4 of 6, ranked 2 of 6 |
| Q8 | Seed 01 still misses `priority_stored: null` on ≥ 1 of 2 runs | **HELD** | missed on 1 of 2 — run 2 cited it |

**Seven held, one refuted.**

### Q3. §H8's acceptance test is met, and here is exactly how far that goes

**The test as filed — one custom run reaching `schema_lookup`, `query_table` or `genai_log` on the
seed that needs it — is MET, for the first time.** It was unmet across 51 runs. Three runs met it:
runs 1 and 2 on seed 01, whose answer sits behind layer 4, both via `schema_lookup`; run 3 on seed
03, whose answer sits behind layer 5, via `query_table`.

**The strict reading is 2 of 6, not 3, and that is the number to quote.** Run 1 called
`schema_lookup` with the argument `table:incident` — the parameter name prefixed onto the value —
and the tool correctly answered `table_does_not_exist`. It reached the tool and retrieved no
schema. Run 4 made the identical malformation on a different seed. Only runs 2 (`sn_aia_tool`) and
3 (a well-formed `query_table` query returning 0 rows, which *is* the finding) issued calls that
returned evidence.

`table:incident` twice across two seeds is a reproducible tool-call-formatting defect, not a slip,
and it is invisible to any measure that counts only which tools were invoked. Filed separately.

**Run 2 is the cleanest single piece of evidence in this smoke, because it contains its own
counterfactual.** It held; the model called `agent_config`; the gate did not release; it held
again; the model called `schema_lookup`; the trail released it. Under #103's union rule that first
`agent_config` call would have released the hold and the run would have ended with no layer-4
evidence — which is exactly what all six v5 runs did. The narrowing is doing the work, and it is
observable in a single run rather than inferred across a distribution.

**The qualification stated in the design's §8 stands and is not waived.** The ranked order puts
layers 4 and 5 near the top, which is where §H8's tools live. The rule is structural and names no
tool, but a pass earned under this design is not the same as a pass earned by a harness that found
those tools unaided. Read Q2 as "the gate can aim the model at a layer", not as "the harness
investigates".

> **Scoped 2026-08-05 (#110, §S).** "The rule is structural and names no tool" is true of *the
> rule*, and false as an unrestricted claim about the harness: the prompt names all seven tools and
> always has. The sentence is left standing because its subject is the ranking rule, which is
> exactly the scope §S preserves.

> **Bounded 2026-08-06 (#119, §T).** "The gate can aim the model at a layer" survives — the v9
> scored pass aimed all six custom runs at layer 4 and all six went there. What it is worth is now
> measured: **all six then filed their root cause at layer 1 anyway** (five literally; the sixth at
> layer 4 on a table that does not exist), scoring 0 on `root_cause_layer_correct` across the board.
> **Reaching a layer and diagnosing at it are different things** — §T3. §T4 adds that the release
> is discharged by a layer-4 tool being *called*, not by layer 4 being reached: a `schema_lookup`
> returning `table_does_not_exist` released the hold.

### Q4. Q7's refutation is the finding, not a footnote

**The declared path carried 4 of 6 holds, not the minority predicted.** `would_confirm` was
populated far more often than the design expected — it appears only on UNCONFIRMED causes, and Q7
assumed that would make it rare.

And the declared path **steered toward cheap layers twice**: both seed-04 runs targeted **layer 3**
because the model's own `would_confirm` named it, and `agent_config` — fan-out 3 — legitimately
discharged the hold. Seed 04's answer sits behind layer 6. So on the one seed in this smoke whose
answer needs `genai_log`, the model named a cheap layer, the gate honoured the naming, and the
measured tool was never reached. Run 4 is the same shape in miniature: on a layer-5 seed the model
named layer 4, and the gate faithfully sent it to `schema_lookup`.

**This was pre-registered.** The final whole-branch review of #109 flagged, before any run, that
the declared path is model-steerable — that giving `would_confirm` precedence lets a model select
its own cheap compliance through text it authors. It was recorded as a design property rather than
a defect, on the grounds that binding the gate to the model's own stated gap is the purest form of
direction available. **This smoke measured it: the property is real, it fires on the majority of
holds, and twice in six runs it cost the run its target layer.**

That is the live question for the next iteration, and it is a genuine trade rather than a bug:
honouring the model's own declaration is what makes the gate *direction* rather than *force*, and
it is also what lets the model route around the layer that matters.

### Q5. What moved, and what did not

- **`genai_log` and `log_analysis` have still never been invoked** — now **57 runs**. Seed 04 was
  the only path to layer 6 in this smoke and both its runs were steered to layer 3 (see §Q4).
- **Audit-derived sweep breadth FELL against v5 on four of six runs** (2/7 against a uniform 4/7),
  and that is the change working rather than failing. v5's 4/7 was the arithmetic of one
  `agent_config` call crediting three layers at once; these runs spent the forced beat on a
  single-layer tool instead. **Breadth of sweep and depth of investigation are different
  quantities.** Any future pass reading `layers_swept` counts as progress will misread this smoke.
- **The two-hold cap never fired.** Zero `GATE:` notes across six runs; all seven holds were
  discharged by the trail. The cap bounded a risk that did not materialise here — including in
  run 2, which reached the cap's threshold and complied rather than being released by it.
- **Zero `UNAVAILABLE` labels** (v5: 2 of 42), zero unsupported sweep claims, zero `partial`.
  Neither revert trigger fired.
- **§O6's constraint 1 moved on one run of two.** Run 2's report cites `priority_stored`, the
  discriminating value that sat unused in the turn-2 prompt of every prior seed-01 run in v4 and
  v5. Run 1's does not. Constraint 1 is *evidence in hand and unused*, which this design explicitly
  does not address — Q8 predicted it would stay broken and scored HELD on run 1. One run of two is
  an observation to carry forward, not a fix.

### Q6. What this does not establish

- **No scored pass.** Six unscored runs, three seeds, one instance, one day. Whether any of these
  diagnoses is *correct* is a scored pass's question; run 3's `CONFIRMED` root cause is backed by a
  real `query_table` result, and that is a claim about provenance, not about accuracy.
- **Nothing about seeds 02 and 05.** Seed 02 excluded by design; seed 05 — the absence seed, where
  `UNAVAILABLE` on layer 1 is the honest answer and #78's exit must stay open — remains covered by
  unit tests only, untested live, exactly as after v5.
- **Nothing about native**, which did not move on this branch.
- **Nothing about the cap under load.** It never fired, so its release path is unexercised in
  production and remains covered by unit tests only.
- **Q7's mechanism rests on 4 declared holds**, two of which landed on the same seed. It is a
  direction, not a rate.

### Q7. Recommendation

**Fire a scored pass next, and make the declared path its subject.** §P6 declined to recommend one
because the depth mechanism had not moved the acceptance test; it now has, three of the last four
substantive questions are about report *correctness* rather than tool reach, and §O6's constraint 1
showed its first movement. The informative pass is seeds 01, 03 and 04, scored with independent
per-row scorers (§O5), with the tool-call-formatting defect fixed first so that a malformed
`schema_lookup` argument does not confound a correctness measurement.

**Before that pass, decide what the declared path should do when the model names a cheap layer.**
The candidates, in the order the evidence supports them: cap the declared path's precedence so it
cannot select a gap whose fan-out exceeds the best available; or let it stand and count the cost,
on the argument that a model naming its own gap is the behaviour worth cultivating even when it
names the wrong one. This smoke does not settle it — it establishes that the choice matters twice
in six runs.

**Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is
not met.** §H8's acceptance test is one gate among several, and meeting it moves the depth
blocker — it does not by itself make the custom harness competitive.

---

## R. The gate stopped aiming at cheap layers, and a prompt fix was refuted by its own test (`2026.08.0503`, #116)

§Q7's queued precondition — "before that pass, decide what the declared path should do when the
model names a cheap layer" — run 2026-08-05. The ruling: **cap the declared path's precedence so it
cannot select a gap whose fan-out exceeds the best available.** A second change rode along, aimed
at the argument-quality defect the v7 A/B found in the hold block, and **was reverted when its own
pre-registered test refuted it.**

Design: `docs/superpowers/specs/2026-08-05-declared-path-fanout-cap-design.md`. Plan:
`docs/superpowers/plans/2026-08-05-declared-path-fanout-cap.md`. Measurements:
`benchmark/raw-evidence-v8-hold-item1-ab.md`. Predictions S1–S7 were filed on issue #116 **before
any code was written**.

### R1. What was run

**No e2e smoke and no scored pass.** Two things only:

1. **A unit-level retro-application** of the new selection rule to the verbatim hold records of
   the v6 smoke, read out of `x_snc_troubleshoot_run.transcript` on gpinst01 rather than out of
   the benchmark markdown — the `_holdNote` strings for TR1000152 (`layer(s) 2, 3, 4, 5, 7`) and
   TR1000153 (`layer(s) 2, 3, 4, 5, 6, 7`), both with `layer 3 (declared)`.
2. **A twelve-trial paired A/B** on the hold block's item 1, through the `pa llm reason` NASK seam.
   No tool executed, so `x_snc_troubleshoot_audit` took **zero rows** and the trail a scored pass
   reads is uncontaminated (verified).

The rule change is therefore **measured only against replayed v6 records** — it has never run
live. S2, S3 and S4 are forward predictions for the next e2e smoke and are **unscored here**.

### R2. The predictions

| | Prediction, as filed | Outcome | Measured |
|---|---|---|---|
| S1 | Replaying the v6 hold records changes the target on exactly 2, both seed-04, layer 3 → 4, `declared` → `ranked` | **HELD** | Both, exactly; regression-tested on the verbatim gap sets |
| S2 | `declared` fires on a minority of holds in the next e2e smoke | **UNSCORED** | No smoke was run |
| S3 | `genai_log` and `log_analysis` remain uninvoked | **UNSCORED** | No smoke was run. R4 shows the gate cannot target layer 6 within the cap; whether the model volunteers those tools unprompted is unmeasured |
| S4 | Seed 04 still misses its layer-6 answer; holds release on `schema_lookup` not `agent_config` | **UNSCORED** | No smoke was run |
| S5 | The control arm reproduces ≥ 1 table-omitted argument, else the run licenses no claim | **HELD** | 1 of 6 (s3). The fail-safe passes |
| S6 | The treatment arm emits 0 table-omitted arguments | **REFUTED** | 1 of 6 — same scenario, byte-identical to control |
| S7 | Both arms stay scalar; the change moves content, not form | **HELD** | 12 of 12 bare strings, 0 objects, both arms |

**Three held, one refuted, three unscored — and S6's refutation is the result of the round.**

### R3. The cap flips exactly two holds, and nothing else

`_selectTarget` now draws the target from the minimal-fan-out class of open gaps, with
`would_confirm` deciding only *which member* of that class wins. Applied to the seven v6 holds:

- Runs 3 and 4 declared layers 5 and 4, both already at fan-out 1 — the floor. **No cap can
  displace them**, so they stand unchanged, source still `declared`.
- Runs 1 and 2 took the ranked path, which the change does not touch.
- **Both seed-04 holds flip.** The model named layer 3 (`agent_config`, fan-out 3) while layers 4
  and 5 sat open at fan-out 1. Layer 3 is off-floor, so the declaration is refused and structure
  selects layer 4.

Zero regressions. This is arithmetic, not evidence of benefit: that the rule flips the two holds
the evidence identifies is a property of the rule. **Whether flipping them improves a report is
unmeasured.**

The `matched` flag retired with the change. It was set by any named open gap, scorable or not, and
blocked the ranked fallback — so a gap whose tools were missing from the map produced narrow
enforcement behind wording that directed at no layer. Unreachable in production; a degraded-path
improvement only.

### R4. `genai_log` stays unreached, by construction, and that was pre-registered

**This is the most misreadable result in this section.** §Q5 headlined that `genai_log` and
`log_analysis` had never been invoked in 57 runs, and the natural expectation is that a cap on
cheap compliance ends that. **It does not, and cannot.**

Fan-out: `agent_trace`, `schema_lookup` and `query_table` score 1; `genai_log` scores 2;
`agent_config` and `log_analysis` score 3. Layers 4 and 5 therefore tie at the floor and the
tie-break takes the lowest layer number — layer 4. **Layer 6 is targeted only once layers 4 and 5
are both closed**, and layer 1 always closes on the opening `agent_trace`. With `MAX_HOLDS` at 2
there is no budget to close 4 and 5 first. Both seed-04 flips land on `schema_lookup`.

So seed 04 still misses its answer — via a different tool. S3 and S4 exist so this is read as the
change working as specified rather than failing.

Two alternatives were considered and rejected. **Dynamic fan-out** — scoring tools by how many
*currently open* gaps they close — is principled and promotes layer 6 into the floor class, but the
lowest-layer tie-break still selects layer 4, so it changes no v6 outcome: cost without effect.
**A tie-break that prefers layer 6** is the only route to `genai_log`, and no structural argument
picks it over layer 4 other than "that is where the unreached tool is". That forfeits §H8 item 3's
non-vacuity condition and would make 57 runs of evidence unreadable.

> **Restated 2026-08-05 (#110, §S).** §H8 item 3's non-vacuity condition as originally worded — that
> the harness never names the measured tools — was never true. This argument does not depend on it.
> It depends on the narrower claim §S4 states second: that the gate's *target selection* is derived
> from the map's structure, not from where a measured tool sits. A tie-break selecting layer 6
> because that is where the unreached tool sits forfeits exactly that structural derivation — while
> still naming no tool in the direction it emits, so §S4's first claim would not catch it — and the
> rejection stands unchanged.

### R5. The declared/ranked split inverts by construction

Retro-applied, v6's 4 declared / 2 ranked becomes 2 / 4. **The next smoke's split is not
comparable to §Q2's** and must not be read as a trend against it. Q7's refutation stands as a
finding about the old rule; it is not a baseline for the new one.

### R6. The hold-block fix was refuted by its own test, and reverted

v7 §4 measured the hold pushing `schema_lookup` arguments onto bare scalars, two of which dropped
the table entirely. The design's §5 named a mechanism: item 1 said "Quote the specific **field** or
value you are relying on", offering a bare field name as a quotable unit, three lines above "Call a
tool that reaches layer N", in a block that renders **last** in the prompt. The fix made the value
and its table co-salient.

**Six scenarios, twelve trials, every pair byte-identical between arms.** Including s3, which
reproduced the exact v7 C5 defect — `"assignment_group"`, table dropped — under both wordings. The
contract change corrected the defect on 3 of 3 scenarios where it reproduced in v7; item 1's
rewording corrected it on **0 of 1**.

The wording was **reverted rather than shipped**. A prompt change to the hold block — load-bearing
text with 57 runs of history behind it — does not ship on a mechanism its own pre-registered test
declined to confirm; keeping it would have added an unattributed variable to every future run. What
the round produced is kept: the A/B instrument, now inverted so the deployed wording is the control,
with both constants anchored to ground truth; and a unit test pinning item 1's deployed text, which
did not exist before.

**One reproducing scenario is a weak positive control**, so a small effect would not have been
visible. This is evidence against the hypothesis, not a proven null — but it is enough to decline
to ship on it.

**It also refines v7 §7.** That entry reported the corrected contract supplying the remedy for the
table-omitted residual (C5's `"assignment_group"` became `task.assignment_group`). Here, with that
contract deployed, an s3-shaped prompt still returns `"assignment_group"`. **The contract fix is
not a general remedy for the table-omitted class**; v7's 3-of-3 was measured on v7's ad-hoc hold
arms, which the repo could not reproduce. That residual is still live and its mechanism is
**unknown**.

### R7. What this does not establish

- **Nothing about correctness.** Neither change touches whether a diagnosis is right.
- **Nothing live about the cap.** It has run only against replayed records. S2–S4 are open.
- **No rate for the A/B**, and no null. Six pairs, one reproducing, one model, one day, one reduced
  instrument. The full 16.7K prompt remains untested, unchanged from v7 §8.
- **Nothing about native**, which has not moved on this line of work.
- **Nothing about seeds 02 and 05**, unchanged from §Q6.

### R8. What the round found that was not being looked for

- **A deactivated NASK skill executed normally, twelve times.** `servicenow_skill_list` reports
  `pa llm reason` as `[OFF]` on gpinst01, yet every `servicenow_skill_execute` call returned
  normally. Build Rule #40 states a deactivated skill fails with a permission-flavoured error.
  Either the OneExtend REST path does not consult the same toggle, or `[OFF]` there is a different
  flag. **Rule #40's failure signature is not universal across invocation paths** — a future run
  that trusts `[OFF]` to mean "will fail" would misdiagnose.
- **The v7 hold arms were never reproducible from the repo.** The committed A/B script had no hold
  block at all; those three control trials were composed ad hoc. Both arms are now generated from
  the real `_holdBlock`.
- **A guarded constant can still lie.** The A/B's "arms differ only in the variable under test"
  check re-used the same constants it composed the arms from, so a wrong claim about the historical
  wording would have passed silently. Both constants are now anchored — one to the live source, one
  to published v5 evidence.

### R9. Recommendation

**Fire the scored pass §Q7 asked for**, on seeds 01, 03 and 04, with independent per-row scorers.
The declared-path question it wanted settled first is settled. Read the cap's live behaviour as a
by-product of that pass — S2, S3 and S4 are waiting on exactly the runs it will produce.

**Do not pursue item-1 wording further** without a scenario set where the table-omitted argument
reproduces more than once. The mechanism behind that residual is unknown, and v7 §7's remedy claim
should now be read as scoped to v7's arms.

**Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is
not met.**

---

## S. The harness has always named its tools — restating §H8 item 3's premise (`2026.08.0504`, #110)

Filed as a leak: `PaFixReport.schemaText()` renders the layer-to-tool map into every prompt,
qualifying the premise that *"the harness never names to the model the tools the test measures."*
Investigating it found the premise is not qualified. **It was never true, and could not have been
true.** No measurement was run; this is bookkeeping on a claim, and it changes nothing the model
reads.

Design: `docs/superpowers/specs/2026-08-05-tool-naming-premise-design.md`.

### S1. Five sites name a tool to the model, not two

| # | Site | What it names | Removable? |
|---|---|---|---|
| 0 | `PaToolRegistry.promptBlock()` → `PaAgentLoop._safePromptBlock()` → `_buildPrompt()` (`PaAgentLoop.js:98`, `:1700`) | All seven, full descriptions, cross-referencing each other | **No** |
| 1 | `PaFixReport.js:1099-1101` — the "EVIDENCE IS CHECKED" block | All seven, mapped to evidence-source categories | **No** — see S3 |
| 2 | `PaFixReport.js:1104-1116` — the generated per-layer clause list | All seven, mapped to layers | Yes, at a cost — see S6 |
| 3 | `PaFixReport.js:1130` — the `would_confirm` example | `query_table` | Yes |
| 4 | `PaFixReport.js:732` — the `_checkUnconfirmed` rejection, reaching the model on the repair turn | `query_table` | Yes |

Sites 0, 1 and 4 are new to the record. Site 2 is generated from `_layerToolMap()` rather than
hand-written, so any map edit re-leaks by construction — which S7's test now catches.

### S2. Site 0 is why the premise cannot be rescued

The catalogue does not merely name the tools, it teaches their sequencing. `schema_lookup`'s
description says **"Use it whenever a value read back blank and you need to know whether the column
exists at all"** and **"query_table does that"**; `query_table`'s says **"run schema_lookup first so
your query names real columns"**; `agent_trace`'s says **"page the rest with read_artifact"**.

A harness that withheld this would be a harness whose model could not call tools. **There is no
version of the acceptance test in which the measured tools are unnamed.**

### S3. Site 1 is load-bearing, so issue option 3 is wrong as stated

The evidence-source block is not stray prose. `PaFixReport` validates every citation's `source`
against the tools the run actually invoked (#79, §H8 item 2, verified working in §I5). A model
cannot comply with a rule it is not told, so the mapping has to be stated; it is contract-tested at
`PaFixReport.test.js:1308`. The issue's option 3 was scoped to site 2 and did not account for site
1. De-naming site 1 breaks a shipped feature. Recorded so the option is not revived on scheduling
grounds alone.

### S4. What replaces the premise

**Struck:** *the harness never names to the model the tools the test measures.*

**Replaces it — two claims, not one.** Both are true and both are enforced, and they are not the
same claim:

1. **The gate's *direction* names no tool.** This is about surface text. `_holdBlock` renders gaps
   as layer numbers and layer names; `_scrubToolNames` (`PaAgentLoop.js:1781-1798`) replaces every
   `_ALL_TOOL_NAMES` entry with `[tool]` in the model's own quoted-back reasons, so a tool name
   cannot re-enter the direction through the model's own words.
2. **The gate's *target selection* is derived from the map's structure, not from where a measured
   tool sits.** The fan-out rank is stated over the map's structure and would produce its ordering
   under a different map.

**Claim 2 is the one §R4 spends, and claim 1 cannot stand in for it.** A tie-break preferring layer
6 *because that is where the unreached tool is* would emit "Call a tool that reaches layer 6" —
naming no tool, so claim 1 survives it untouched — while forfeiting claim 2 outright. Stating the
replacement as the slogan alone would therefore point §R4's rejection at a claim its own
counterexample does not violate.

**§R4 survives intact** on claim 2. Its rejection turns on the *gate* selecting for a measured tool,
not on the catalogue mentioning one.

### S5. The measurement, per tool — and a correction

Issue #110 said the three tools "were invoked in 0 of 51 runs". **Stale as a present-tense claim.**
§Q3, dated the same day, records the acceptance test met.

| Tool | Status |
|---|---|
| `schema_lookup` | Invoked — v6 smoke, seed 01 runs 1–2 **and seed 03 run 4**. Runs 1 and 4 made the same malformed call (`table:incident`, #111) and retrieved nothing — §Q3's "twice across two seeds"; only run 2's returned evidence |
| `query_table` | Invoked — v6 smoke, seed 03 run 3; a well-formed query returning 0 rows, which *is* the finding |
| `genai_log` | **Zero**, now 57 runs (§Q5) |
| `log_analysis` | **Zero**, now 57 runs (§Q5) |

Stated correctly the argument is **stronger** than the issue's version:

**The model was handed full descriptions of all seven tools, an explicit instruction to run
`schema_lookup` before `query_table`, the layer-to-tool map and the evidence-source map — in every
prompt, for 51 runs — and invoked the measured tools zero times. They were first invoked when a
structural gate aimed it at a layer (#109).**

Naming a tool is not the mechanism that makes a model call it. Fifty-one runs of naming did
nothing; one structural change did it in a six-run smoke. That is the strongest available evidence
that #109 and #116 are not teaching to the test — available *because* of the leak, not in spite of
it.

### S6. The #109 collision — recorded, not fixed

Site 2 advertises `log_analysis` as satisfying layer 5, and `genai_log`/`log_analysis` as satisfying
layers 1 and 6. The #109 directed gate releases only on the target layer's **dedicated** tools — for
layer 5, `query_table` alone. So for targets on layers 1, 5 and 6 the harness advertises a strictly
wider set than the gate accepts, and a compliant-looking call can fail to release the hold. Already
documented in source at `PaAgentLoop.js:588-604` and `:911-915`; bounded by `MAX_HOLDS: 2`.

**Never observed live** — §Q5 records zero `GATE:` notes across six runs, all seven holds discharged
by the trail, the cap never fired. A live mismatch with no measured instance.

**Deliberately unfixed.** Both remedies — narrowing the advertised list, or widening the gate's
release set — change what the model is told and would confound the scored pass §R9 asks for. It
stays open on #110, to be read against that pass's S2–S4 evidence.

### S7. What shipped

DECISION.md §S plus dated pointers at §H8 item 3, §P, §Q3 and §R4; corrected comments at
`PaAgentLoop.js:568` and `:900-905` — the second being the *definitional* statement of the struck
premise, sitting three lines below §R4's argument, and caught only by the final review; and one
test pinning what site 2 advertises — each layer's tool list checked
*positionally* against a hardcoded snapshot of `_layerToolMap()`, plus that the map cannot introduce a tool
`_scrubToolNames` does not strip. Positional matters: all seven tools are named in the citation
clause too, so a whole-text scan would not notice a layer losing its tool. The snapshot is a literal
rather than a live re-read for the same reason: the clause is generated from the map, so checking
one against the other is a tautology — found by the perturbation step that shipped with the test.
The test is deliberately
**not** extended to site 0 — the catalogue is 8-9KB of prose under active revision, and pinning its
tool mentions would fire on every description edit.

### S8. What this does not establish

- **Nothing about correctness**, and nothing about native.
- **No claim that the naming did or did not affect any prior score.** The 0-of-51 window is
  consistent with "no effect" but does not prove it.
- **No arm isolates the gate.** S5's "fifty-one runs of naming did nothing; one structural change
  did it" compares harness *versions*, not arms of one experiment. Those 51 runs were produced by
  v4, v5 and the prompt-contract rounds before them, so more than the directed gate differs between
  them and v6, and nothing ran v6 with the gate removed and the rest held fixed. The nearest thing
  to a control is v5 → v6 alone — §Q1 records byte-identical request bodies across that pair — and
  that is six runs, not fifty-one. S5's "strongest available evidence" is the right strength for
  the claim; it is not an attribution.
- **No prompt change**, deliberately — the scored pass §R9 asks for must stay comparable to §O's
  baseline.
- **No fix for the #109 collision** (S6).

---

## T. The scored pass — reaching a layer is not diagnosing at it (`2026.08.0505`, #119)

§R9's queued pass, run 2026-08-06. **Twelve scored rows — 6 native + 6 custom, seeds 01 / 03 / 04,
two reps each, both arms the same day** on gpinst01 (Zurich P10 HF3) at app version `2026.08.0504`.
Scored blind, one independent scorer per packet, §O5's topology.

Measurements: `benchmark/raw-evidence-v9-scored-pass.md`. Rows: `benchmark/scorecard-v9.md`.
Packets exactly as scored: `benchmark/scoring-v9/`. Trigger, execution and packet-build reports sit
beside them; the twelve scorers' full reasoning is at `benchmark/scoring-v9/results/`, following
v4's naming. Predictions T1–T9 were
filed on issue #119 **before any run fired**; T10 and T11 in that issue's first comment, after the
smoke gate and **still before any scored run**.

**Native 36/36 and 6/6 on the gate. Custom 9/36 and 0/6.** Read §T5 before quoting either.

### T1. What was run

Six pre-seeded failing executions (3 seeds × 2 reps), each diagnosed twice — once by the native
Agent Doctor and once by the custom harness — giving 12 rows against 6 targets. Same day, one hour,
one deployed version, closing the §H7-4 cross-day drift confound the way §O's protocol requires.
Strictly sequential, no overlap: every native run received its own anchor with a distinct
`conversation_ref` (TR1000156–161), so `PaRunAnchor`'s 30-min-per-user fallback never engaged.
**Zero retries and zero void rows** — seed 04's capability sys_id was verified matching pre-flight,
so its one applicable void condition did not fire.

Two custom runs reached the terminal state `failed` on validator rejection; both are scored from
`fix_report_rejected.report`, exactly as §O's v4 pass scored its rejected rows.

**One §D requirement was not met:** `continuous_tool_execution_limit` was never read during this
pass. The last published measurement is `25` (§O1). It is recorded as *not read* in the scorecard
and is quoted nowhere as a measurement of this pass.

### T2. The scored predictions

| | Prediction, as filed | Outcome | Measured |
|---|---|---|---|
| T1 | The `declared` path carries a **minority** of holds across the 6 custom runs | **HELD** | 0 of 6. All six holds read "layer 4 (**ranked**)"; `declared` fired zero times. Six holds fired, so the fail-safe did not engage |
| T2 | `genai_log` and `log_analysis` invoked in **0 of 6** custom runs | **HELD** | 0 of 6. The four distinct tools across all six custom rows are `agent_trace`, `agent_config`, `read_artifact`, `schema_lookup` |
| T3 | Seed 04's two custom runs score **0** on `root_cause_layer_correct`, and their holds release on `schema_lookup`, not `agent_config` | **HELD** | Both scored 0; both holds were answered by `schema_lookup` (`incident`, `sn_aia_tools_execution`) |
| T4 | Native's total across its 6 rows **exceeds** custom's | **HELD** | 36 vs 9. See §T5 on how far that number travels |
| T5 | Neither revert trigger fires on the custom arm: **0** runs terminate `partial`, **0** fabricated citations | **REFUTED** (second clause) | `partial` = 0 of 6 — held. But row 08 was rejected with **three `unsupported citation` findings** — #79's cross-check firing. Mitigation on the record: all three were caught, and no unsupported citation survived into a `complete` report |
| T6 | The `table:incident` parameter-prefix malformation recurs in **0** custom runs | **HELD** | 0 of 6. Recorded args: `sn_tsbench_bench_ticket`, `incident.priority`, `incident.assignment_group` ×2, `incident`, `sn_aia_tools_execution` — no `<param>:<value>` prefix anywhere. #113/#115 hold |
| T7 | Seed 01's custom runs reach `schema_lookup` **and** seed 03's reach `query_table`, in ≥1 of 2 runs each | **REFUTED** | Seed 01: both rows reached `schema_lookup`. Seed 03: **neither** row called `query_table`. The conjunction fails on its second half |
| T8 | **≥10 of 12** rows produce an unambiguous `passes_gate` from the packet alone | **REFUTED** | **9 of 12 flagged `ambiguous = yes`** — 3 unambiguous. On the narrower reading the prediction's own words invite (rows whose *gate* was under-determined) the count is 4, all native. Both readings are far below 10 |
| T9 | Custom's audit-derived sweep breadth is **at or below** native's | **HELD** | Every custom row 2/7 except row 07 at 5/7; every native row 7/7. Tool calls: custom 2–3, native 13–18. LLM calls: custom 4–6, native 6–9 |
| T10 | **≥3 of 6** custom rows terminate `status:"failed"` on a citation-shortfall rejection | **REFUTED** | **2 of 6** (rows 07, 08). Both errors do name an evidence/citation shortfall, so the two that fired are correctly classified — there were simply fewer of them |
| T11 | Rejection **correlates with the gate firing**: every custom row where a hold fired *and* the surviving root cause is `UNCONFIRMED` is rejected | **REFUTED** | The antecedent holds on rows 09, 10 and 11 — hold fired, surviving cause `UNCONFIRMED`. **All three terminated `complete` with a validated `fix_report`. 0 of 3 rejected.** Rows 07 and 12 carry `CONFIRMED` causes; row 08 carries no `confidence` field at all |

**Six held, five refuted, none unscored.**

T11's refutation is the useful one, and the trigger report pre-registered why: **rejection is
independent of the gate firing**, so #81 can be addressed without touching the depth mechanism.
The alternative — that the depth gate was manufacturing its own rejections — is not supported.

### T3. Every custom row scored 0 on `root_cause_layer_correct`, and that is the finding

**Six of six.** The seeded layers were 3, 3, 5, 5, 6, 6. Five rows filed their primary root cause
at **layer 1**. The sixth (row 07) filed at layer 4 — on `sn_tsbench_bench_ticket`, **a table that
does not exist on the instance**, appearing nowhere in the seed.

Set that against §Q2, which this project has been carrying since 2026-08-05: *"the gate can aim the
model at a layer."* It still can. The gate aimed all six runs at layer 4 and all six went there.
**And all six wrote their conclusion at layer 1 anyway.**

**Reaching a layer and diagnosing at it are different things.** That distinction was not available
before this pass, because §Q and §R measured tool reach on unscored smokes and could not see what
the reports concluded. It bounds what §Q2 was ever worth: meeting §H8's acceptance test moved the
*depth* blocker, and this pass shows that moving it did not move correctness at all.

Two rows came close enough to sharpen the point rather than blunt it. Row 09's `would_confirm`
names layer 5 — the seed's own layer — with `query_table` attached, active, and never called. Row
10's fix lands on exactly the right target (`target_type: "data"`) while its cause sits at layer 1.
That scorer's line is the right summary: *"The run was one `query_table` call from a correct
diagnosis. It did not make that call, and 'almost reached layer 5' is not 'named layer 5'."*

### T4. The hold is satisfiable cosmetically, and the gate counts a call rather than a reach

Every custom run received exactly one hold; all six cited "layer 4 (ranked)"; all six were answered
by a `schema_lookup`. **Not one pointed at the table the seeded defect lives in.** Five targeted a
platform or OOB table — `incident.priority`, `incident.assignment_group` ×2, `incident`,
`sn_aia_tools_execution` — and row 07 targeted `sn_tsbench_bench_ticket`, which does not exist.

**Row 07 settles what the gate is counting.** Its lookup retrieved nothing: the tool correctly
answered `table_exists: false`, finding `table_does_not_exist`. The gate released anyway. Confirmed
two ways — empirically (row 07 recorded exactly one hold; its next terminal action reached the
citation validator rather than a second hold), and mechanically (`_depthGate` releases on
`_anyOf(this._heldTools, trail.tools)`, where `trail.tools` is the set of tool **names** from
`x_snc_troubleshoot_audit`; nothing in the release path inspects what the tool returned).

**So the gate counts a layer-4 tool being *called*, not layer 4 being *reached*.** State it that
way from here on. `action_type=result` does mean the call returned, so the test is stronger than
counting intent — but a lookup that establishes nothing discharges the hold exactly as well as one
that establishes the answer.

This is not a defect discovered late; it is what a name-based release rule does, and it was
serviceable while the question was "can the gate move the model off layer 1's tools". The question
is now whether the run learned anything, and a name-based rule cannot answer it.

### T5. T8's refutation undermines confidence in every score here, including the favourable ones

**Nine of twelve rows flagged `ambiguous = yes`, against a prediction of at most two.** T8 was filed
to measure whether the rubric is reproducible, "which every score in this project rests on". The
answer is that it is not, and the failure lands on the same column §O5 named.

Rows 03, 05 and 06 flag the identical gap: a fix that names the right target but omits a value **no
diagnosis could recover** — a group name, a replacement sys_id. Row 04 flags it as its third
ambiguity. `fix_usable_unedited` does not determine that case, and it is one of the gate's two
terms. Rows 01 and 02 record a second under-determination in the same column — whether naming the
runtime `sn_aia_tool` record rather than the Fluent source counts as applicable without editing —
and resolve it as *not a rubric gap*, each scorer noting the other reading would flip the gate.

**Taken together, all six native rows carry a recorded alternative reading of `fix_usable_unedited`
that yields 0.**

| | totals | gate |
|---|---|---|
| As scored | native 36/36, custom 9/36 | native 6/6, custom 0/6 |
| Every native `fix_usable_unedited` resolved to 0 | native **30/36**, custom 9/36 | native **0/6**, custom 0/6 |

**The direction is robust and the precise totals are not.** 30 vs 9 still separates the arms by a
wide margin, and 30/36 is the *mild* end of the adverse band — row 03's first ambiguity alone would
take that row to 1/6. **The totals should not be quoted as stable numbers.** The gate is worse: one
under-determined column moves native between 100% and 0%.

What is *not* sensitive is custom's side. `root_cause_layer_correct = 0` was flagged ambiguous on
**no** custom row; one scorer listed it explicitly under "Not ambiguous, for the record", and row
07's scorer considered a literal reading that would award 2 for the bare layer string `"4"` and
rejected it from the seed spec's own text. **Custom's 0/6 stands under every resolution recorded in
the twelve score files.** The asymmetry is why the direction survives while the numbers do not.

**§O5 recorded this defect and it was never closed.** That entry found the same column scored
inconsistently on the same `assignment_group` placeholder text across two v4 native rows and filed
it "for whoever next revises §A". Nobody did. Rows 03–06 are that finding recurring, in a pass whose
headline depends on it.

### T6. Native's sweep was deep and uniform

13–18 tool calls, 6–9 LLM calls, 2m47s–5m38s per row. **Every native run touched all seven tools**,
including `genai_log` and `log_analysis`. Its audit trail lost nothing — tool-call count matched the
plan's `type=tool` task count exactly on all six rows.

Two qualifications, neither optional. **First, `layers_swept` is unadjudicated here.** Every figure
is the mechanical §E2 map; the qualifier that `agent_config` earns L2/L3/L7 only for the layers the
diagnosis used was handed to the scorers and no scorer resolved it — all twelve treated sweep as a
non-rubric column. §O5 records that same qualifier correcting two native rows 5/7 → 4/7 in v4, so
7/7 is a mechanical maximum, not a finding. **Second, breadth is not depth** — §Q5's warning, still
live. Native scored well because its root causes were right, not because it swept widely.

`genai_log` and `log_analysis` remain uninvoked by the custom harness. The last published count was
57 runs (§Q5, restated in §S); this pass's six custom rows take it to **63**. The pre-pass
smoke-gate run also invoked neither, and whether it belongs in that count is unresolved upstream —
the arithmetic is stated so a future reader can re-derive it rather than inherit a number.

### T7. Two defects in the pass's own machinery, which the next pass inherits

**The blind-rule gate was green and blind to the real hole.** `npx jest
test/scorerPacketBlindRule.test.js` passed 11/11 while **two one-hop paths to the answer key**
existed in packet framing: `(verbatim from benchmark/scorecard-template.md)`, and that template
cites "§O5 of `DECISION.md`"; and `(verbatim, benchmark/seeds/seed-0N-….md)`, and `benchmark/seeds/`
is the parent of `seeds/history/`. Both were written by the packet builder, and both are *shorter*
routes to prior grades than the two-hop `IMPLEMENTATION_PLAN.md → DECISION.md` path the builder had
already flagged.

**The gate was working exactly as written.** Its `answer-key-pointer` pattern matches a literal
`DECISION.md` and nothing else, and it scans the five seed specs — one of the rule's three channels
— not the packets. Both paths were removed by hand before scoring, along with every other
repository path in every packet. **Recommendation: widen `answer-key-pointer` from a literal
`DECISION.md` to any repository path, and run it over the packets, not only the specs.** The uniform
rule is what the builder adopted by hand, and it is auditable by a single regex; the selective rule
forces every future reader to re-derive which paths were judged safe.

**The shipped packets deviate from `scorecard-template.md` and from the seed specs**, by mechanical
path redaction in three sets — four substitutions in the rubric, two in the builder's framing, and
two to sixteen per seed spec. The complete list is reproduced in
`raw-evidence-v9-scored-pass.md` §6.2 so a future reader diffing a packet against either source
finds every difference explained; anything not on that list is a defect, not a deviation. The
redaction was **verified lossless**: reversing only the declared substitutions restores each source
spec byte-for-byte, with line, heading, table-row, bullet and fence counts independently confirmed
identical. Source files on disk were never written.

**And one harness observation worth recording:** the native arm never writes a terminal status onto
its `x_snc_troubleshoot_run` anchor. All six native anchors sat at `status: running` after their
executions reached `completed`. **A scorer or tool reading `status` off a native anchor would
misread it.** Terminal state was read from `sn_aia_execution_plan.state` for every native row here;
nothing downstream should assume the next operator will know to do that.

### T8. What this does not establish

- **No rate.** Twelve rows, three seeds, one instance, one day, one model, one app version. Two reps
  per seed per arm measures a flip, not a frequency. **36 vs 9 is a direction.**
- **No Task 12 band verdict.** §A3.4 sets the gate's evaluability floor at 8 valid runs and each arm
  has 6. That clause is written about voids eroding a 10-row denominator rather than about a pass
  designed with 6 rows per arm, so a permissive reading exists — but taking it would mean the
  instrument's one stated floor never binds whenever a pass is designed under it. The proportions
  are recorded; the band lookup is not performed.
- **The totals are not stable** (§T5). Neither the /6 totals nor the gate proportions should be
  quoted as measurements of the same order as the tool counts.
- **No comparison to any prior pass.** Different seed set from §O's, and §R5 records how easily a
  construction change makes a split non-comparable. **Nothing here says the custom harness got
  better or worse than v4** — that comparison was not run and is not licensed by these rows.
- **Nothing about whether layer 6 is reachable.** No custom run called `genai_log`. §R4 established
  the gate cannot target layer 6 within `MAX_HOLDS: 2`; this pass confirms the consequence and does
  not test the premise. T2 and T3 predicted the failure and it arrived as predicted.
- **Nothing about seeds 02 and 05**, unchanged since §Q6. Seed 05 remains untested live.
- **Nothing about whether the two rejected reports would have been right.** Rows 07 and 08 were
  scored from `fix_report_rejected.report`; both scored 0 on root cause, so the question does not
  arise here, but the validator's contribution to those two rows is not separable from the model's.
- **`layers_swept` is unadjudicated** and `continuous_tool_execution_limit` was not read (§T1).

### T9. Recommendation

**Fix the rubric before spending another scored pass.** T8 is the result that makes the others hard
to bank: nine of twelve rows required a judgment the rubric does not supply, four of them on the
gate itself, and §O5 filed the same defect three passes ago. The specific gap is one clause —
whether a fix that names its target and operation exactly, but leaves a value no diagnosis could
recover, is "applicable without manual editing". Row 03's scorer even drafted it: *"a placeholder
for a value not recoverable from the instance does not make a fix unusable, provided the target and
operation are fully specified."* Adopt that or its negation; either makes the column mechanical.
Leaving it open means the next pass's headline is again decided by a coin the scorers are being
asked to flip.

**Stop reading the depth gate's release as evidence of depth.** §T4 shows it counts a call, not a
reach, and §T3 shows that even a genuine reach did not move the diagnosis off layer 1. A release
rule that inspected what the tool returned — non-empty result, or a result about the entity under
diagnosis — is the obvious next candidate, and it is a change to the *gate*, not to the prompt, so
it stays inside the boundary §R6 was burned for crossing. Whether it helps is unmeasured; §T3 is
reason to doubt that any release rule alone is sufficient, since the model reached layer 4 six times
and concluded at layer 1 six times.

**Widen the blind-rule test to any repository path** (§T7). It is a one-pattern change, and this
pass is the second consecutive round in which the leak was caught by hand rather than by the gate.

**Do not re-run this pass to get a firmer number.** Two more reps per cell would not resolve §T5 —
the instability is in the rubric, not in the sample size.

**Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is
not met.** This pass is the first that measures *correctness* since §O, and it measures the custom
harness at 0 of 6 on the gate with no ambiguity on the column that decides it. Native's 6 of 6
carries the caveat in §T5 and should be quoted with it.

---

## U. Pre-registration — the evidence return (`2026.08.0601`, #81)

**This section was written and committed before a single run fired.** Nothing below was authored
with knowledge of an outcome; the git history of this file is the proof. §U7 records round 1's
outcome, but that verdict was subsequently withdrawn (§U8) — the disposition that stands is §U9,
added by later commits that do not touch §U1–§U6.

Design: `docs/superpowers/specs/2026-08-06-fixreport-evidence-return-design.md`. Plan:
`docs/superpowers/plans/2026-08-06-fixreport-evidence-return.md`. Measurements, once they exist:
`benchmark/raw-evidence-v10-evidence-return-smoke.md`.

### U1. What is under test

`2026.08.0601` — the **evidence return** (#81), against `2026.08.0505` (§T).

§H7-5 filed the structural finding this change answers, and §T's rows 07 and 08 are it happening in
a scored pass: *"the repair turn has no tool access, so a 'cite two distinct sources — found 0'
problem is **unfixable in repair by construction**."* Both v9 custom rows on seed 01 terminated
`failed` on a citation shortfall and, per `raw-evidence-v9-scored-pass.md:202`, **"both survived the
harness's repair attempts."** A tool-less turn was spent on a problem no rewrite can fix.

The change, in one sentence: `PaFixReport.validate` now separates its rejection problems into a
**shape** class (fixable by rewriting) and an **evidence** class (fixable only by calling a tool and
reading another source), and `PaAgentLoop._handleFixReport` hands an evidence-class rejection back
into the main loop — where tools are live — instead of into the tool-less repair turn. Capped at
`MAX_EVIDENCE_RETURNS` (2), gated on `_hasEvidenceHeadroom()` (2 iterations and 30s of budget
remaining). A run that returns and never resubmits closes `'failed'` carrying the rejected draft, so
it stays retrievable as `fix_report_rejected` and stays scorable. Every guard fails toward today's
behaviour.

**Targets.** The four v9 custom targets on seeds 01 and 03, re-diagnosed by the custom arm — the same
execution plans, so the only thing that changed between the two measurements is the harness:

| seed / rep | execution plan sys_id | v9 row | v9 terminal |
|---|---|---|---|
| 01 / 1 | `4a5bb19d2b66cf54f243fed2ce91bf57` | 07 | **failed** — evidence/citation shortfall |
| 01 / 2 | `45bbfd112ba6cf54f243fed2ce91bfcb` | 08 | **failed** — three `unsupported citation` findings |
| 03 / 1 | `3afbf1192baa475817a6ffbeee91bf10` | 09 | complete |
| 03 / 2 | `1a1c71152ba6cf54f243fed2ce91bf31` | 10 | complete |

Seed 01 is the pair the change exists for; seed 03 is the pair it must not break.

### U2. The prediction

Per seed, filed before the runs:

| | Prediction, as filed |
|---|---|
| U-a | **Seed 01.** In **≥1 of 2** runs, a `fix_report` rejected on the evidence class produces at least one `EVIDENCE RETURN <n>/2` transcript note, **and** the next tool call that run makes reads a source named in the rejection. "Names a source" resolves through `PaFixReport._citationToolMap()`: `config` → `agent_config` or `genai_log`; `schema` → `schema_lookup`; `data` → `query_table` or `log_analysis`. An `unsupported citation` rejection names one source, so the call must be one of that source's tools; the *cites-only-the-trace* rejection names `config`, `schema` and `data` collectively, so any of their five tools satisfies it. `agent_trace` and `read_artifact` satisfy neither — `read_artifact` supports no source at all, by that map's own construction. **Both halves must hold in the same run** for U-a to hold |
| U-b | **Seed 03.** Neither run regresses: **0 of 2** terminate `partial`, and neither loses a `complete` terminal it held in v9 *for a reason attributable to the evidence return* — i.e. if a seed-03 run does not produce an `EVIDENCE RETURN` note, its terminal state is not evidence for or against this change |
| U-c | **Both seeds.** No run terminates `partial`. §T's revert trigger on `partial` is re-armed here because `_hasEvidenceHeadroom` is exactly the guard that keeps a return from becoming one |

**The conditional is stated now, not later.** U-a's antecedent is *a rejection on the evidence
class*. If no run in either seed is rejected on that class, **U-a is UNSCORED, not held** — the
mechanism was never reached, and a smoke that never triggers the path measures nothing about it.
That is a live possibility: v9's seed-03 rows both validated first time, and even seed 01's two
rejections are 2 of 6, not 6 of 6. Recording it in advance removes the temptation to read a
no-rejection run as a pass.

**Measurement method.** Tool calls, their arguments and their outputs come from
`x_snc_troubleshoot_audit` (`run=<run sys_id>^action_type=result`), per §E1–E2 — **not** from
transcript prose, and not from what a report claims it did. The `EVIDENCE RETURN` note is a
`x_snc_troubleshoot_run.transcript` entry with `actor: 'system'`; "the next tool call" means the
first `action_type=result` audit row whose timestamp follows that note.

### U3. What would refute it

Either of these, on the seed-01 pair:

1. **The return is spent, and nothing is gathered.** An `EVIDENCE RETURN` note appears and the model
   resubmits an identical or weaker report **without an intervening tool call**. This is the failure
   mode that matters: it would mean the return relocated the tool-less repair turn rather than
   replacing it, and bought two extra iterations for the same unfixable move.
2. **A rejection is downgraded into a `partial`.** A run that under `2026.08.0505` ended `failed`
   carrying a draft now ends `partial`. §T scored rows 07 and 08 from `fix_report_rejected.report`;
   a `partial` that carries no draft is a scored row destroyed, which is a strictly worse outcome
   than the defect being fixed.

### U4. The revert trigger, as a value

**If either refutation in §U3 holds, `MAX_EVIDENCE_RETURNS` goes to `0` in the same pull request.**
Not "the code is kept and the result is explained", not "the cap is lowered to 1 and re-measured" —
`0`, which restores `2026.08.0505`'s behaviour exactly, because every guard on the return path falls
through to the existing repair turn when the cap is spent. `PaAgentLoop.initialize` accepts
`maxEvidenceReturns: 0` by explicit `>= 0` test for this reason; the constant at
`src/server/PaAgentLoop.js:163` is the one edit.

This is recorded as a value rather than as a judgment because §R6 is the precedent: a change on this
branch family was reverted when its own pre-registered test refuted it, and that only worked because
the trigger was written down before the number was known.

### U5. What this cannot establish

- **Nothing about diagnostic correctness.** §T3 is the governing result: six custom rows reached
  layer 4 and **all six wrote their conclusion at layer 1**, scoring 0 of 6 on
  `root_cause_layer_correct`. Gathering a citation is not diagnosing. The most this smoke can claim
  is that a rejection fixable *solely* by reading another source stops being unfixable by
  construction. It cannot claim the source read was the right one, that the citation supports a true
  cause, or that any score would move.
- **Nothing about the depth gate.** The evidence return fires *after* validation; the gate fires
  *before* it. §T4's finding — the gate counts a layer-4 tool being *called*, not layer 4 being
  *reached* — is untouched by this change and is not tested by this smoke.
- **No rate.** See §U6.
- **Nothing about seeds 02, 04 and 05**, none of which is run here.
- **No comparison of scores to v9.** The four targets are shared with v9 rows 07–10, which makes the
  *terminal states* and *tool trails* comparable and nothing else. No packet is built, no scorer is
  engaged, and no row here may be entered on a scorecard.

### U6. This is not a scored pass, and it is not being run as one

**n = 4. Two seeds (01, 03), two runs each, custom arm only.** No native control, no blind packets,
no independent scorers, no rubric applied — therefore no `passes_gate`, no /6 total, and no entry in
any scorecard. Terminal states and audit-derived tool trails only.

That is a deliberate choice, taken under **§T9**: *"Fix the rubric before spending another scored
pass … Two more reps per cell would not resolve §T5 — the instability is in the rubric, not in the
sample size."* Nine of twelve v9 rows required a judgment the rubric does not supply, four of them
on the gate itself. Spending a scored round before that clause is fixed would produce a headline
decided by a coin the scorers are being asked to flip. So this round buys one thing only: whether
the mechanism fires and what the run does with it.

### U7. Outcome — the mechanism fires; one of two runs used it (added after the smoke)

Added by a later commit. **§U1–§U6 above are unmodified** — `git log -p benchmark/DECISION.md` is
the check. Measurements: `benchmark/raw-evidence-v10-evidence-return-smoke.md`.

Four runs, 2026-08-06 23:12–23:16, strictly sequential, custom arm only, against v9's own rows
07–10 targets.

| run | seed/rep | run_id | terminal | tools | EVIDENCE RETURN | next tool after it |
|---|---|---|---|---|---|---|
| v10-1 | 01/1 | `ae7e16252b228794f243fed2ce91bf24` | **failed** | 4 | 1/2 @ 23:13:01 | **none** |
| v10-2 | 01/2 | `a3be12a52b228794f243fed2ce91bfae` | complete | 4 | 1/2 @ 23:13:59 | **`genai_log`** @ 23:14:02 |
| v10-3 | 03/1 | `c81f5ee52b228794f243fed2ce91bfb0` | complete | 2 | none | — |
| v10-4 | 03/2 | `653f52292b228794f243fed2ce91bfb7` | complete | 2 | none | — |

| | Outcome | Measured |
|---|---|---|
| U-a | **HELD** | 1 of 2. v10-2 fired the note and called `genai_log` three seconds later, then validated. v10-1 fired the note and made no tool call |
| U-b | **HELD** | 0 `partial`; both seed-03 runs `complete` as in v9. Neither fired a return, so per U-b's own clause neither is evidence either way |
| U-c | **HELD** | 0 of 4 `partial`. `_hasEvidenceHeadroom` never bound |
| §U3.1 refutation | **OBSERVED on v10-1**, not on v10-2 | v10-1 resubmitted a weaker report with no intervening tool call |
| §U3.2 refutation | **not observed** | v10-1 closed `failed` with its draft preserved in `fix_report_rejected` — Task 6 working |

**`MAX_EVIDENCE_RETURNS` stays at `2`; the revert trigger did not fire — and the reasoning is
contestable, so it is spelled out.** U-a is quantified "≥1 of 2" and held. §U3's preamble
("either of these, on the seed-01 pair") is **ambiguous** between per-run and per-pair, and under
the per-run reading U-a and §U3.1 are *both* satisfied — a contradiction §U3 permitted and should
not have. **That is a defect in this pre-registration.** Three things argue against reverting:
§U3.1's own stated rationale — *"bought two extra iterations for the same unfixable move"* — was
**not** met, since v10-1's resubmission actually *cleared* the evidence problem (its final
rejection is pure shape: `fixes` and `verification` missing) by taking option 2 of the two the
return block offers; v10-2 is unexplainable any other way; and nothing regressed.
**This call should be ratified or overruled by a human before the PR merges.**

**The finding worth keeping: `genai_log` was called.** §T6 put the custom harness at **63 runs with
zero `genai_log` and zero `log_analysis`**, a streak §Q5, §R3, §S and §T all carry, with the tool
attached and active throughout. It broke three seconds after an evidence return, on the run whose
v9 counterpart (row 08) died on three `unsupported citation` findings.

**And the finding that cuts the other way.** On the one target where v9 and v10 can be compared
directly and the return produced no tool call, **the draft got emptier**: v9 row 07 ended `failed`
with a `CONFIRMED` (wrong) cause at layer 4, scored 1/6; v10-1 ends `failed` with `root_causes: []`
plus a shape defect. n=1, confounded by nondeterminism and a different pre-return tool path, and
recorded because it is what would most change the verdict if it repeated.

**§U5 stands, unsoftened.** All four reports still conclude at layer 1 or at nothing, against
seeded layers 3 and 5 — **four of four would score 0 on `root_cause_layer_correct`**, exactly as
§T3 measured six of six. v10-2's own report names layer 5 and `query_table` in `would_confirm`: the
call it still did not make. The return moved evidence *gathering*. It did not move the diagnosis
one layer, and nothing here licenses a claim that it would.

**One harness defect found, filed not fixed.** The evidence-problem TEXT is not persisted for a run
that later validates — `_evidenceNote` carries only a count, the full text goes to the prompt, and
`fix_report_rejected` is written only on `failed`. So **the reason v10-2 returned cannot be read
back off the instance**; the raw-evidence file reconstructs it from `_citationToolMap` /
`_layerToolMap` and labels the reconstruction as one. Every future pass hits this.

**Unrelated but load-bearing for the next operator:** `now-sdk install` does **not** stamp
`sys_updated_on` on the records it installs — the deployed script includes read 2026-08-02 hours
after this install. **`sys_updated_on` is not a deploy check.** A `scriptLIKE<marker>` probe is.

### U8. §U3 was defective, so it yielded no verdict — the clause is fixed and re-run (round 2)

**Written and committed before any round-2 run fired. §U1–§U6 and §U7 are unmodified** — the same
discipline §U7 followed, and `git log -p benchmark/DECISION.md` is the check.

#### U8.1 Why §U3 is being amended, and what was known when it changed

**State the compromise first.** This amendment is being written **with the v10 results already
known** (§U7). That is not the position a pre-registration should ever be written from, and no
reader should have to infer it. What was known: 2 of 2 seed-01 runs fired an `EVIDENCE RETURN`; 1
of those 2 was followed by an intervening tool call; 0 of 4 runs terminated `partial`.

**The defect.** §U3's preamble reads *"Either of these, on the seed-01 pair"*, which is ambiguous
between *on either run of the pair* and *on the pair as a whole*. §U2's U-a is quantified per-pair
("≥1 of 2"). Under the per-run reading of §U3, **U-a and §U3.1 are both satisfied by the same two
runs** — the prediction holds and its own refutation fires, simultaneously. A test that can return
both answers at once returns neither.

**The ruling (human, 2026-08-06): §U3 yields no verdict and neither branch of it may be picked.**
`MAX_EVIDENCE_RETURNS` stays at `2` **pending this round's result** — not because the trigger was
argued away in §U7, and not because the change was ratified. §U7's three arguments for standing
pat are recorded there and are **not** load-bearing here; this round decides on its own terms.

#### U8.2 §U3, amended — per-run, explicitly

Replacing the ambiguous preamble for round 2 onward. **Each clause below is evaluated PER RUN, and
the round's verdict is a COUNT over runs, fixed in §U8.3.** A clause firing on one run is a fact
about that run, never by itself a verdict about the round.

| | Amended clause, per run |
|---|---|
| §U3.1′ | A run fires at least one `EVIDENCE RETURN` note and makes **no tool call after it** |
| §U3.2′ | A run terminates `partial` |

**"After it" is defined structurally, not by clock.** A tool call counts as intervening iff the
run's `x_snc_troubleshoot_run.transcript` contains an entry with `actor: 'tool'` at a **higher
`seq`** than the first `EVIDENCE RETURN` entry. Sequence, not timestamp — two transcript entries
can share a second (v10-2's note and its `fix_report` both read 23:13:59), and a second-resolution
comparison would be undecidable there. Arguments and outputs for any such call are then read from
`x_snc_troubleshoot_audit` (`action_type=intent` carries `input`; `action_type=result` carries
`output`), per §E1–E2.

#### U8.3 The decision rule for round 2, as a number, filed before the runs

**Protocol.** ~4 more seed-01 runs — **2 runs against each of the two v9 seed-01 execution plans**
(`4a5bb19d2b66cf54f243fed2ce91bf57`, `45bbfd112ba6cf54f243fed2ce91bfcb`), custom arm only,
strictly sequential, same request body, no new executions triggered, no fixture touched. The
deployed build is unchanged from v10 (§U7); it is re-probed with `scriptLIKE` rather than trusted,
because `now-sdk install` does not stamp `sys_updated_on`.

**The metric.**

- **Denominator `D`** = round-2 runs that fire at least one `EVIDENCE RETURN`.
- **Numerator `N`** = of those `D`, how many satisfy the negation of §U3.1′ — at least one
  `actor: 'tool'` transcript entry at a higher `seq` than the first note.

**The rule, decided on the mechanism's merits and not on v10's 1-of-2:**

| Condition | Verdict |
|---|---|
| **`N / D ≥ 1/2`** (a boundary case of exactly one half **stands**) | The return stands. `MAX_EVIDENCE_RETURNS` remains `2` |
| **`N / D < 1/2`** | **REVERT.** `MAX_EVIDENCE_RETURNS` → `0` at `src/server/PaAgentLoop.js:163`, in the same PR |
| **Any run terminates `partial`** (§U3.2′, at a count of **1**) | **REVERT**, overriding the row above. A `partial` destroys a scorable row, which is strictly worse than the defect being fixed |
| **`D < 3`** | **UNDER-POWERED. No verdict.** Do not revert and do not ratify — record it and say so |

**Why one half, and why the boundary stands.** The tool-less repair turn already offers two of the
three moves an evidence-class rejection permits — weaken the claim, or go `inconclusive`. The one
move it cannot offer, *by construction*, is going and reading the missing source (§H7-5). So the
return earns its machinery — a classifier, a cap, a headroom guard, a state block, a draft stash
and a new terminal path — only if the move that is otherwise impossible actually happens at a rate
that is not marginal. **Below half, the model is predominantly choosing a move it could already
have made for free, and the mechanism is mostly a more expensive repair turn.** At or above half,
the return is doing something the repair turn structurally cannot, and its costs fail safe: every
guard falls through to today's behaviour, and the cap bounds the spend at 2 iterations.

**Why `D < 3` is a stop rather than a lenient pass.** A round that fires twice and splits 1–1
reproduces §U3's ambiguity exactly, and resolving a coin flip by picking the branch that suits the
change is the failure this amendment exists to prevent.

**Recorded as secondary and explicitly NOT deciding:** the pooled figure across v10's seed-01 runs
and round 2's will also be reported, because a reader will compute it anyway and should not have
to. **The verdict is round 2's `N / D` alone**, per the ruling that this round decides on its own
terms.

#### U8.4 What round 2 still cannot establish

Everything in §U5 stands unchanged, and one thing is sharpened: this round is **one seed, one arm,
~4 runs**. It measures whether the model uses a move that has been made available to it. It
measures nothing about rate beyond this seed, nothing about seed 03 (unchanged since §U7's 2 of 2
`complete` with no return fired), and **nothing about diagnostic correctness** — §U7 measured four
of four reports concluding at layer 1 or at nothing against seeded layers 3 and 5, and no result
below can move that.

#### U8.5 Round 2's verdict — UNDER-POWERED, by §U8.3's own stop rule (added after the runs)

Added by a later commit; **§U8.1–§U8.4 unmodified**, same discipline as §U7. Measurements:
`benchmark/raw-evidence-v10-evidence-return-smoke.md`, "Round 2".

Four runs, 2026-08-06 23:25–23:29, strictly sequential, custom arm, two runs against each of the
two v9 seed-01 plans. Build unchanged and re-probed, not rebuilt.

| run | target | run_id | terminal | tools | EVIDENCE RETURN | tool call after the note? |
|---|---|---|---|---|---|---|
| r2-1 | A | `1b71eee52b628794f243fed2ce91bf90` | complete | 3 | none | n/a |
| r2-2 | B | `9b91aa692b6ecb5817a6ffbeee91bfdf` | **failed** | 4 | **1/2 and 2/2** | **YES** — `genai_log`, seq 12 > seq 10 |
| r2-3 | A | `d4f1aae92b6ecb5817a6ffbeee91bf0c` | **failed** | 4 | **1/2** | **NO** — tools at seq 2/6/8/10, note at seq 12 |
| r2-4 | B | `5432222d2b628794f243fed2ce91bfc0` | complete | 2 | none | n/a |

**`D` = 2, `N` = 1, `N/D` = 1/2 — exactly the boundary — and `D < 3`, so §U8.3 returns
UNDER-POWERED: no verdict.** §U3.2′ clean at 0 `partial` against a threshold of 1.

**`MAX_EVIDENCE_RETURNS` stays at `2`, and this is neither a pass nor a ratification.** The change
is **still undecided**. Pooled across both rounds' seed-01 runs, `D = 4` and `N = 2` — **2/4, also
exactly the boundary. Eight runs have not moved this off a coin flip.**

**The round was deliberately not extended to reach `D ≥ 3`.** At `N/D = 1/2`, one more run in the
denominator decides everything — 2/3 stands, 1/3 reverts. Continuing *because* the split is tied is
optional stopping at the most result-sensitive moment there is, which is what the stop rule exists
to block. It was filed before the runs and it binds now that it is inconvenient.

**Round 2's substantive findings all cut against the change:**

- **`N` counts a call, not a retrieval, and the one call in `N` retrieved nothing.** r2-2's
  `genai_log` args were `execution:45bbfd112ba6cf54f243fed2ce91bfcb` — a bare string with the
  `<param>:<value>` prefix. The tool answered *"Unknown mode … Returning the default (llm)"* and
  returned `entries: []`, `llm_call_rows: 0`. **Under a numerator requiring the call to return
  something, round 2's `N` is 0 and the pooled figure is 1 of 4.** This is §T4's finding — "counts
  a call, not a reach" — reproduced on §U8.3's own metric, and the rule as filed is generous to the
  change.
- **The `<param>:<value>` malformation has recurred.** T6 recorded it in 0 of 6 v9 runs after
  #111/#113/#115. It is back, on `genai_log` — **a tool those fixes never exercised, because no
  custom run had ever called one.** The fixes were validated against the tools the harness happened
  to use.
- **The cap was hit for the first time** (r2-2, 2/2). The second return produced no tool call, and
  the run still died on *"evidence cites only the trace"* — the same evidence-class problem
  surviving two returns **and** the repair turn.
- **Variance on a fixed input is close to a coin flip.** Both targets received two byte-identical
  requests and both split — `complete`-no-return vs `failed`-with-return. This is why `D` came in
  at 2 from 4 runs, and any future round must size `n` against that rather than against patience.
- **`query_table` fired for the first time on seed 01** (r2-4), with **no** evidence return in the
  run — not attributable to this change, recorded so the "custom never reaches layer-5 tools"
  premise is not carried forward unqualified.

**Recommendation.** Do not spend another 4-run round on this question; §R2.4's variance figures say
it would land on the boundary again. Two things would actually decide it, in order: **(a) tighten
the numerator** so a gathering call counts only when it returns something — the same correction
§T9 recommended for the depth gate's release rule, and it would make both metrics honest at once;
**(b) then** run a round whose `n` is sized for a fire rate near one half, with the stopping rule
fixed in advance. Until one of those happens, `MAX_EVIDENCE_RETURNS: 2` is carried as **undecided,
not endorsed**, and nothing downstream should cite this change as validated.

### U9. Disposition — the evidence return ships DORMANT at `0` (`2026.08.0601`, #81)

§U1–§U8 unmodified; append-only, as throughout §U.

**The ruling.** The fixed test (§U8.3) returned **no verdict**. *No verdict is not the same as
proven*, so the default is **off**: `MAX_EVIDENCE_RETURNS: 0` at `src/server/PaAgentLoop.js`. The
code ships — classifier, cap, headroom guard, prompt block, transcript note, draft stash — and is
**inert** until someone passes `maxEvidenceReturns` through `initialize()`.

**The question is OPEN, not closed.** Nothing here says the evidence return does not work. It says
two pre-registered rounds did not establish that it does, and that shipping an unproven behaviour
enabled-by-default is the wrong direction to fail in.

**Behavioural equivalence to `2026.08.0505` is confirmed, not asserted.** At `0` the guard in
`_handleFixReport` falls straight through to the existing repair turn. A test constructs the loop
with **no** `maxEvidenceReturns` option and drives an evidence-class rejection through it, asserting
the run goes terminal via the repair turn with `_evidenceReturns`, `_evidenceBlock` and
`_rejectedDraft` all untouched (`test/PaAgentLoop.test.js`, *"ships dormant: at the shipped default
an evidence rejection takes the repair turn"*). Full suite: **1160 passing, 26 suites.** The six
tests that failed on the flip all assumed the old default; each was fixed by declaring
`maxEvidenceReturns: 2` at the fixture, never by moving the production default back.

#### U9.1 The number a future round has to beat is 1 of 4, not 2 of 4

Pooled across **all eight seed-01 runs** in both rounds:

| | count | runs |
|---|---|---|
| Runs that fired at least one `EVIDENCE RETURN` | **4** | v10-1, v10-2, r2-2, r2-3 |
| …of those, runs that made a tool call after the note (`N`, as pre-registered) | **2** | v10-2, r2-2 |
| …of those, runs whose call actually **retrieved anything** | **1** | **v10-2 only** |

**v10-2's `genai_log` call was well-formed** — `{"execution":"…","mode":"for_execution"}` — and
returned 5,176 chars with `llm_call_rows: 3`. **r2-2's was malformed** —
`execution:45bbfd112ba6cf54f243fed2ce91bfcb`, a bare string carrying the `<param>:<value>` prefix —
and the tool answered *"Unknown mode … Returning the default (llm)"* with `entries: []` and
`llm_call_rows: 0`. **One gathering call in eight runs gathered anything.**

**So `2 of 4` is an artefact of a numerator that counts a call rather than a retrieval** — §U8.3's
metric carrying the identical defect §T4 found in the depth gate's release rule. **The honest rate
is 1 of 4, and that is the figure any future round must improve on.** Do not quote 2 of 4.

#### U9.2 What ships that is NOT in doubt

The disposition above is about **one constant**. Three parts of this change are unconditional
improvements and are enabled:

1. **`PaFixReport.validate` returns `evidenceProblems`** — the rejection problems are now
   *classified* into shape (fixable by rewriting) and evidence (fixable only by reading another
   source). The classification is correct independently of what any consumer does with it, and it
   is what makes §U9.1's question askable at all.
2. **`_handleFixReport` returns `_step`'s result shape** — a pure refactor that removed a
   divergent return contract.
3. **A rejected `fix_report` draft now survives to the terminal record** — via two paths, and only
   one has live evidence. The **pre-existing** `_finishFailedFixReport` close path (unchanged by
   this branch) is **live-verified in production**: v10-1 closed `failed` with its draft intact
   and retrievable as `fix_report_rejected.report` — its §3.4 transcript note is that path's own
   error text (`'fix_report failed validation and could not be repaired: …'`), confirming the run
   took the OLD path, not Task 6's new one. §T's pass scored rows 07 and 08 from that field, so the
   pre-existing behaviour closes a hole that would have destroyed scorable rows. **Task 6's new
   addition** — `_finishPartial`/`_finishFailedLlm` stashing `_rejectedDraft` for a run that rides
   an evidence return out to the bounds without resubmitting — is **tests-only**: 0 of 8 v10 runs
   across both rounds terminated `partial` (§U7, §U8.5), so it has never been exercised live.

#### U9.3 Queued

- **Tighten the numerator, then run a sized round.** A gathering call should count only when it
  returns something — the same correction §T9 asks for on the depth gate's release rule, so one fix
  serves both metrics. Then size `n` against the observed fire rate (roughly half of runs, §R2.4)
  with the stopping rule fixed in advance. A second 4-run round would land on the boundary again.
- **The `<param>:<value>` malformation has regressed on `genai_log`.** T6 recorded it at 0 of 6 in
  v9 after #111/#113/#115 — **those fixes were only ever exercised against the tools the harness
  happened to call, and no custom run had ever called `genai_log`.**
- **Unfixed and filed:** the evidence-problem text is not persisted for a run that later validates
  (§U7), so the reason a return fired cannot be recovered afterwards.

---

## V. The numerator counts a retrieval, not a call (`2026.08.0701`, #121)

**§U1–§U9 are unmodified; append-only, as throughout §U.** `git log -p benchmark/DECISION.md` is
the check. **This section claims no result. Nothing has been run.**

Design: `docs/superpowers/specs/2026-08-07-retrieval-aware-release-design.md`. Plan:
`docs/superpowers/plans/2026-08-07-retrieval-aware-release.md`.

### V1. The defect, in both places it lives

§T4 found it in the depth gate: *"the gate counts a layer-4 tool being **called**, not layer 4
being **reached**."* §U9.1 found the same defect in §U8.3's own metric: *"`2 of 4` is an artefact
of a numerator that counts a call rather than a retrieval … The honest rate is 1 of 4."*

§U9.3 queued one fix for both, and this is it.

### V2. The amended numerator, filed before any round

Replacing §U8.3's `N` from here on:

> **`N`** = of the `D` runs that fired at least one `EVIDENCE RETURN`, how many have at least one
> `x_snc_troubleshoot_audit` row with `action_type=result`, `retrieval=ok`, and a `sys_created_on`
> after the first note — equivalently, an `actor: 'tool'` transcript entry at a higher `seq` than
> the first note **whose corresponding audit result row carries `retrieval=ok`**.

`N` is now one encoded query — `run=<sys_id>^action_type=result^retrieval=ok` — rather than a
payload read. That matters beyond convenience: the `output` column **cannot** answer the question.
`PaArtifactStore.applyThreshold` replaces an oversized result with an excerpt envelope carrying no
`reads` map before `PaAuditLogger` ever sees it, and the logger then digests head+tail past 4,000
chars. The largest results are the most likely to be productive and the most likely to have lost
the evidence, so a post-hoc payload read would systematically under-count — the same
by-label-not-by-fact defect, relocated.

§U8.3's decision rule is otherwise unchanged: `N/D ≥ 1/2` stands, `< 1/2` reverts, any `partial`
reverts, `D < 3` is under-powered and yields no verdict.

### V3. What `retrieval=ok` means, exactly

`PaToolReadKit.retrievalVerdict` reads the `data.reads` map every tool core already builds, and
returns `ok` when at least one table in it is `'ok'`. R-25 permits that status only from a path
that passed `fromRowRead` — `readRows` and `readOne` and nothing else — so an `ok` means rows were
fetched, not that a schema probe succeeded.

Verified against the two calls §U9.1 turns on: v10-2's `genai_log` (`llm_call_rows: 3`) scores
`ok`; r2-2's (`entries: []`, `llm_call_rows: 0`, after a `<param>:<value>` malformation) scores
`none`. §T4 row 07's `schema_lookup` (`table_exists: false`) scores `none`.

**Two accepted false negatives, recorded so a future reader does not discover them as a surprise.**
`query_table`'s `rows_exist_but_are_not_visible` finding — a `GlideAggregate` count above zero
against a `GlideRecordSecure` read of zero — establishes a real ACL fact while leaving `reads` at
`'empty'`, and scores `none`. **The instrument under-counts retrieval.** That is the safe direction
for a numerator that has twice flattered the change it measures.

**The second is `'DENIED'`, and it is arguably the more consequential of the two.** By this
project's R-26, a denial is a permission gap, NOT an absence, and must not be reported as one — the
tool *did* establish something, and `reads` at `'DENIED'` still scores `none` here, the same as a
genuine absence. Under `REQUIRE_RETRIEVAL_TO_RELEASE`, a sweep whose only finding was a denial would
be held, retry, be denied again, and burn both holds toward `MAX_HOLDS` — a capped round that would
read as a null result rather than as the permission gap it actually found. This must be settled
before a round enables the rule; it cannot bite the current merge because the flag ships off (§V5).

### V4. The number to beat is 1 of 4

§U9.1, restated because it is the baseline this metric exists to be compared against: pooled over
all eight seed-01 runs across both rounds, four fired a return, two made a tool call after it, and
**one retrieved anything**. Do not quote 2 of 4.

**Pre-#121 rows carry a BLANK `retrieval` column and cannot be re-scored mechanically.** The column
has no default for exactly this reason. The 1-of-4 was hand-derived from two payloads and stays
labelled as a hand derivation; nothing in this change makes it a queried figure retroactively.

**`PaAuditLogger.invokedTools`'s `retrievingTools` now checks both columns, not one.** An earlier
draft of this section noted that the read side trusted `_write`'s invariant (that `retrieval` is
only ever set on a `result` row) without checking `action_type` itself — two methods relying on an
invariant enforced in neither. Final review (#121 review finding 2) closed that gap directly:
`invokedTools` now requires `action_type='result'` in the same pass it already reads `retrieval`,
so the docblock's claim — "a `result` row at `retrieval = 'ok'`" — is enforced by the read, not
merely true by construction of the one writer that exists today.

### V5. The gate change ships DORMANT

`PaAgentLoop.REQUIRE_RETRIEVAL_TO_RELEASE: false`. §T9 called the retrieval-aware release rule
*"the obvious next candidate"* and added *"whether it helps is unmeasured"*; §U9 ruled one version
earlier that *"No verdict is not the same as proven, so the default is off."* Turning it on by
default would move an instrument eight measured passes are calibrated against, on no evidence.

**The audit column is written on every run regardless of the flag.** So the counterfactual — how
often the strict rule would have changed a release — is measurable from runs that were happening
anyway, before anything is switched on. That is the cheapest available route to the evidence §T9
says is missing, and it is the reason to prefer dormancy over a coin flip.

**There is no runtime path or system property that flips this flag — a future round must edit
source and rebuild.** `src/fluent/async-wiring.now.ts` constructs the loop with
`new PaAgentLoop().run(event.parm1, requestJson)` — no options object, so no `options.
requireRetrievalToRelease` ever reaches `initialize`. Enabling the strict rule for a measured round
means either changing `REQUIRE_RETRIEVAL_TO_RELEASE`'s default in `PaAgentLoop.js` or passing
`{requireRetrievalToRelease: true}` at that call site, then `now-sdk build` and `now-sdk install`
— exactly the same edit-rebuild-reinstall path `MAX_EVIDENCE_RETURNS` already requires, and for the
same reason: neither constant has a wiring seam. A reader planning the round must not discover this
gap at the instance.

**A round must also confirm the `retrieval` column itself is installed before flipping the flag.**
Building and installing (above) covers the flag and the loop code, but not the Task 2 table change
that gives `retrieval` somewhere to land. If `REQUIRE_RETRIEVAL_TO_RELEASE` is turned on against an
instance where that column has not been deployed, `gr.setValue('retrieval', …)` on the absent field
is a silent no-op (this project's R-6 shape), `retrievingTools` is `[]` for every run regardless of
what was actually retrieved, and every run holds to `MAX_HOLDS` and reports `capped: true` — a
result that would misread as evidence about the rule itself rather than as a deploy-order mistake.

### V6. What is deferred, and what must be true before it runs

**Not in this change:** the sized round (#121 step 3) and the `MAX_EVIDENCE_RETURNS` flip (step 4).

§U8.5 is explicit that a second 4-run round would land on the boundary again — *"§R2.4's variance
figures say it would land on the boundary again"* — so a future round must:

1. Size `n` against the observed fire rate of roughly one half, **for the denominator, not for
   patience**.
2. Fix the stopping rule before the first run. §U8.3's `D < 3` stop fired at exactly the boundary
   and the round could not be extended without optional stopping.
3. Clear the five prerequisites filed on #121's first comment before the cap leaves `0` — the
   `_resetGate` cross-run leak, `initialize`'s `>= 0` guards accepting `null`, the untested 1→2
   evidence-return transition, `_finishAnswer`'s dropped draft, and two inaccurate comments. One
   is answered here in passing: `requireRetrievalToRelease` is read with a strict `=== true` test
   rather than the `>= 0` shape.

### V7. What this section cannot establish

Everything in §U5 stands. This change adds an instrument; it measures nothing. It does not say the
evidence return works, does not say the depth gate's strict rule helps, and does not move
`MAX_EVIDENCE_RETURNS` off `0`. §T3's governing result is untouched: six custom rows reached layer
4 and all six concluded at layer 1. **Retrieving evidence is not diagnosing.**

## W. Pre-registration — the sized round (`2026.08.0703`, #121 steps 3–4)

**Written and committed before a single run fired. §U and §V are unmodified** — `git log -p
benchmark/DECISION.md` is the check. **This section claims no result.**

It discharges §V6's conditions 1 and 2, which §V deferred: *size `n` against the observed fire
rate, for the denominator, not for patience*, and *fix the stopping rule before the first run*.
Condition 3 (the five `PaAgentLoop` prerequisites) was closed by #130.

### W1. What this round decides, and what it does not

**Decides:** whether `MAX_EVIDENCE_RETURNS` leaves `0` — #121 step 4, and nothing else.

**Does not decide:** anything about `REQUIRE_RETRIEVAL_TO_RELEASE`. That flag stays `false` for
every run in this round. It is a separate question, it is blocked by §V3's unresolved `'DENIED'`
ruling, and running both switches at once would confound the depth gate with the evidence return —
the two mechanisms fire on opposite sides of validation (§U5).

**The build under test is `2026.08.0703` with one edit: `MAX_EVIDENCE_RETURNS: 2`.** Per §V5 there
is no runtime seam for either constant, so this is an edit-rebuild-reinstall, and the operator must
verify by `scriptLIKE` probe rather than `sys_updated_on` (§U7).

### W2. The metric is §V2's, unchanged, and it under-counts on purpose

`N` and `D` are exactly as §V2 filed them; this section adds no new definition and amends none.

- **`D`** = runs in this round that fire at least one `EVIDENCE RETURN` note.
- **`N`** = of those `D`, how many have at least one `x_snc_troubleshoot_audit` row with
  `action_type=result`, `retrieval=ok`, and `sys_created_on` after the first note.

**The number to beat is 1 of 4** (§V4), hand-derived and staying labelled as one. Do not quote
2 of 4.

**The instrument is biased toward reverting, and that is the direction it should be biased.** §V3
records two accepted false negatives: `query_table`'s `rows_exist_but_are_not_visible` finding
establishes a real ACL fact while leaving `reads` at `'empty'`, and a `'DENIED'` scores `none`
though by R-26 a denial is a permission gap rather than an absence. Both make `N` too small. A
metric that has twice flattered the change it measures should err the other way, and any verdict
that *stands* under a conservative numerator is stronger for it.

### W3. Sizing — condition 1

**Observed fire rate: 4 of 8 pooled seed-01 runs (§U9.1). The 95% Wilson interval on that is
[0.215, 0.785]**, which is the whole problem: 8 runs pin the denominator's own rate almost not at
all, and sizing `n` directly would be sizing against a number we do not have.

**Target `D` = 12.** Chosen from the false-ratify rate against the observed baseline — the
probability the round says "stands" when the true retrieval rate is really the 1-in-4 that has
been measured:

| `D` | `N` needed | false-ratify if true rate is 0.25 | if 0.35 | stands if truly 0.50 | stands if truly 0.65 |
|---|---|---|---|---|---|
| **3** (§U8.3's floor) | 2 | **15.6%** | 28.2% | 50.0% | 71.8% |
| 8 | 4 | 11.4% | 29.4% | 63.7% | 89.4% |
| **12 (chosen)** | 6 | **5.4%** | 21.3% | 61.3% | 91.5% |
| 16 | 8 | 2.7% | 15.9% | 59.8% | 93.3% |

**§U8.3's `D ≥ 3` floor would ratify a 1-in-4 mechanism 15.6% of the time.** That is the real
defect in the old rule — not merely that it stopped at the boundary, but that clearing it proved
very little. `D = 12` cuts that to 5.4% for 4× the runs; `D = 16` buys another 2.7 points for 33%
more runs, and is not worth it at ~1 minute per run.

**Stated against the change's own interest:** at `D = 12`, a mechanism whose true rate is *exactly*
the 0.5 threshold still reverts 38.7% of the time. That is inherent to testing a point threshold
and is not a defect to be fixed by re-running. If the round reverts at an `N/D` near half, the
honest report is "not distinguishable from the threshold", not "refuted".

### W4. The stopping rule — condition 2, and the reason this is not optional stopping

**Sample until `D = 12`, not until `n = <some number>`.**

§U8.5 declined to extend a tied round and was right to: *"Continuing because the split is tied is
optional stopping at the most result-sensitive moment there is."* The fix is not a bigger fixed `n`
— it is to stop on a quantity the result cannot see.

**The stopping rule reads `D` only. It never reads `N`.** Whether a run fires an `EVIDENCE RETURN`
is decided before any tool call it might make; whether that call retrieved is what `N` counts.
Conditional on `D`, the retrieval outcomes of those `D` runs are 12 draws that the stopping decision
never inspected, so `N/D` is unbiased under this design. This is inverse-binomial sampling, and it
is the standard remedy for exactly the failure §U8.5 hit: a fixed `n` leaves `D` to chance (4 runs
gave `D = 2`), while a fixed `D` leaves only the *cost* to chance.

**The operator must not compute `N` mid-round.** `D` is countable from transcript notes alone; the
audit query that produces `N` is run once, after the round closes. This is a procedural commitment,
and it is the one thing in this section a careless operator can silently break.

**Hard cap: `n_max = 60` runs (~60 minutes at the measured ~1 min/run).**

| cap | P(reach `D`=12) if fire is 0.25 | 0.30 | 0.40 | 0.50 |
|---|---|---|---|---|
| 40 | 28.5% | 55.9% | 92.9% | 99.7% |
| **60 (chosen)** | **85.2%** | 97.1% | 100% | 100% |
| 72 | 96.6% | 99.7% | 100% | 100% |

40 was the tempting number and it fails badly at the pessimistic end of the fire-rate interval.
60 holds up across the whole plausible range for an hour of instance time.

**All three exits are decided now:**

| At the end of the round | Verdict |
|---|---|
| `D` reaches 12 | Apply §W6. Full pre-registered power |
| `n` reaches 60 with `8 ≤ D < 12` | Apply §W6, **and report the reduced power explicitly** (at `D`=8 the false-ratify rate is 11.4%, not 5.4%). Not a licence to re-run |
| `n` reaches 60 with `D < 8` | **No verdict on the return.** The finding is about the FIRE rate, not the retrieval rate — the mechanism is firing far less than the 4-of-8 baseline, and that is what gets investigated. P ≤ 1% if the true fire rate is 0.25, so this outcome is itself informative |

### W5. The `partial` trigger, rescaled — and why that is not the change being flattered

§U8.3 reverts on **any single** `partial`. That threshold was calibrated for a 4-run round. Carried
onto a 60-run round unchanged it becomes a coin flip that reverts on noise:

| true `partial` rate | P(≥1 in 60) | P(≥2) | P(≥3) | P(≥4) |
|---|---|---|---|---|
| 1% | **45.3%** | 12.1% | 2.2% | 0.3% |
| 2% | 70.2% | 33.8% | 11.9% | 3.2% |
| 5% | 95.4% | 80.8% | 58.3% | 35.3% |

**A rate of 1% — one partial in a hundred runs, which nobody would call a regression — trips the
count-1 trigger 45% of the time at this `n`.** The trigger would stop measuring the change and
start measuring the round length.

**Rescaled: revert on ≥3 `partial` terminations among the round's runs.** One or two are recorded,
attributed, and reported, but do not by themselves revert.

**Why this is not result-driven loosening.** §U8.1 warned that amending a pre-registration with
results in hand is a compromise, and this amendment is being written with `0 partials in 8 runs`
known. Three things keep it honest: the change is forced by `n` alone and would be identical had
the observed count been 0, 1 or 2; the *rationale* for the original trigger is untouched (a
`partial` destroys a scorable row, and §U3.2′ still defines it per run); and the observed baseline
does not discriminate anyway — by the rule of three, 0 in 8 is consistent with a true rate as high
as 37%, so no threshold could have been calibrated from it. At a true rate of 1% the rescaled
trigger fires 2.2% of the time; at a genuinely bad 5% it fires 58.3%.

**The attribution clause survives verbatim from §U2's U-b:** a `partial` in a run that fired no
`EVIDENCE RETURN` is not evidence about this change, and is excluded from the count.

### W6. The decision table

Evaluated once, after the round closes, in this order:

| Condition | Verdict |
|---|---|
| **≥3 `partial`** among runs that fired a return | **REVERT.** `MAX_EVIDENCE_RETURNS` stays `0`. Overrides every row below |
| **`N / D ≥ 1/2`** (exactly one half **stands**) | **The return is enabled.** `MAX_EVIDENCE_RETURNS` → `2`, in a PR that cites this section |
| **`N / D < 1/2`** | **`MAX_EVIDENCE_RETURNS` stays `0`**, and #81 is done — not re-measured a third time |
| **`D < 8` at the cap** | **No verdict.** Investigate the fire rate |

**Note the asymmetry with §U4, and that it is deliberate.** §U4's trigger was a *revert* — the code
was live at `2` and the trigger switched it off. Here the code is already dormant at `0`, so the
default on an ambiguous result is to stay dormant. §U9's ruling governs: *"No verdict is not the
same as proven, so the default is off."* A third inconclusive round should end the question rather
than buy a fourth.

### W7. Protocol and pre-flight

**Targets.** The two v9 seed-01 execution plans, alternating strictly — `4a5bb19d2b66cf54f243fed2ce91bf57`
(A), `45bbfd112ba6cf54f243fed2ce91bfcb` (B), A/B/A/B — custom arm only, strictly sequential,
byte-identical request bodies, no new executions triggered, no fixture touched. Alternating rather
than blocking keeps a drift in instance behaviour from loading onto one target.

**Seed 03 is a separate regression guard, not part of `n` or `D`.** 4 runs against
`3afbf1192baa475817a6ffbeee91bf10` and `1a1c71152ba6cf54f243fed2ce91bf31` after the round closes,
scored against §U2's U-b only. Seed-01 runs alone produce `N` and `D`.

**Pre-flight, all four verified by probe before run 1 — §V5 is explicit that skipping the third
would misread as evidence about the rule:**

1. `sys_app.version` reads the round's build.
2. `PaAgentLoop^scriptLIKEMAX_EVIDENCE_RETURNS: 2` → 1 record; `: 0` → 0 records.
3. `sys_dictionary` `name=x_snc_troubleshoot_audit^element=retrieval` → 1 record. **Without the
   column, `setValue` is a silent no-op (R-6), `N` is 0 for every run, and the round would read as
   a refutation of the return rather than as a deploy-order mistake.**
4. `PaAgentLoop^scriptLIKEREQUIRE_RETRIEVAL_TO_RELEASE: false` → 1 record. The other switch must be
   off (§W1).

**Known limitation, carried from §U7 and not fixed:** the evidence-problem TEXT is not persisted for
a run that later validates, so *why* a given run returned cannot be read back off the instance. Any
reconstruction in the raw-evidence file must be labelled as one.

Measurements go to `benchmark/raw-evidence-v11-sized-round.md`.

### W8. What this round cannot establish

Everything in §U5 and §V7 stands, unsoftened. In particular §T3 remains the governing result — six
custom rows reached layer 4 and all six concluded at layer 1 — and **nothing in this round can move
it.** The metric counts whether a run that was told its evidence was insufficient went and
retrieved something. It does not ask whether the right source was read, whether the citation
supports a true cause, or whether any score would move. **Retrieving evidence is not diagnosing**,
and a round that stands is a round that licensed one mechanism, not one that improved a diagnosis.

## X. The sized round RAN, and it refuted the return (`2026.08.0704`, #121 steps 3–4)

**§U, §V and §W are unmodified** — `git log -p benchmark/DECISION.md` is the check. §W was merged as
`2d11e4d` at 2026-08-07 22:50Z; the round's first run posted at 23:04:32Z. The pre-registration
preceded the data, and that ordering is checkable in git rather than asserted here.

Measurements: `benchmark/raw-evidence-v11-sized-round.md`.

### X1. The result

| Quantity | Value |
|---|---|
| `n` | **60** (the §W4 hard cap, reached) — 30 A / 30 B |
| Terminal states | 56 `complete`, 4 `failed`, **0 `partial`** |
| **`D`** | **10** |
| **`N`** | **1** |
| `N / D` | **0.10** |

§W6 applied in its stated order: the ≥3-`partial` trigger did not fire (0 partials); `N/D ≥ 1/2`
fails; **`N/D < 1/2` governs.**

> **`MAX_EVIDENCE_RETURNS` STAYS AT `0`, AND #81 IS DONE — NOT RE-MEASURED A THIRD TIME.**

`D` = 10 is §W4's second exit (`8 ≤ D < 12`), so the reduced power is stated rather than buried: the
false-ratify rate at `D` = 8 is 11.4%, not §W3's targeted 5.4%. **That caveat biases toward
ratifying, and the round did not ratify** — it cannot be used to soften the result.

### X2. This is a refutation, not an undecided round

§W3 pre-committed to reporting a near-threshold revert as *"not distinguishable from the
threshold"*. That clause does **not** apply here. The 95% Wilson interval on 1-of-10 is
approximately **[0.018, 0.404]**; the 0.5 threshold lies outside it. The observed rate is also below
§V4's 1-of-4 baseline, though those intervals overlap heavily and **this round does not establish a
decline** — only that the mechanism is below its own bar.

**What the number means.** Nine of the ten runs that were told *"1 evidence problem(s) need a tool
call, not a rewrite"* rewrote anyway; two of those spent BOTH permitted returns doing it. §U8.3 set
the bar at one half precisely because the return earns its machinery — classifier, cap, headroom
guard, state block, draft stash, terminal path — only if the otherwise-impossible move actually
happens at a non-marginal rate. At 1 in 10 it does not. In §U8.3's own words, the mechanism is
**"mostly a more expensive repair turn"**.

### X3. The numerator's "after the note" clause did the entire job

A bare `run=<sys_id>^action_type=result^retrieval=ok` query matches **all ten** firing runs, because
every run opens with a gate-driven sweep (`agent_trace`, `read_artifact`, `agent_config`,
`schema_lookup`) and several of those legitimately score `ok`. Those retrievals precede the note and
say nothing about the return.

**§V2's `sys_created_on`-after-the-first-note clause is what separates 1 from 10.** Without it the
numerator inflates 10× and the mechanism ratifies on tool calls the run was always going to make.
This is §V1's "counts a call rather than a retrieval" defect in its third form, and the
pre-registration caught it before it could flatter the change a third time.

All ten runs were verified individually against their own transcripts by `seq` (§U8.2's structural
test), not by clock and not by extrapolating the pattern.

### X4. Two measurement defects found before run 1, both silent

Recorded because either would have corrupted the round without erroring:

1. **`partial` is not readable from `status`.** A bound-triggered stop closes the run `complete` and
   reports `outcome: 'partial'` — and `outcome` is `run()`'s return value, **not a persisted
   column**. Counting §W5's partials off `status` would have returned 0 for every run regardless of
   what happened, making the ≥3 revert trigger unfireable. The durable marker is the literal
   `INCOMPLETE:` in the transcript (`PaAgentLoop.js:1648`), which is what this round counted.
2. **§W7's probe 2 is safe, but not for the obvious reason.** `MAX_EVIDENCE_RETURNS` and the
   docblock's `maxEvidenceReturns` differ by **underscores, not merely case**, so the probe cannot
   collide with the comment whichever way `LIKE` handles case. Checked rather than assumed.

### X5. Observations that are NOT §W6 inputs

- **All 4 `failed` runs were firing runs**, all on the same shape-class problem (`fixes` must be an
  array; `verification` must be a non-empty string). `failed` is not `partial`, so §W5 is untouched
  and §W6 has no row for it. Whether the extra rejection turn *causes* the malformed report is **not
  established** and needs its own pre-registration before anyone acts on it.
- **The fire rate was 10/60 ≈ 0.17**, well under §U9.1's 4-of-8 baseline. The stopping rule was
  built to be indifferent to this and the round is not powered to call it a change.
- **#129 earned its place.** The single conversion (TR1000235) called `genai_log` with the
  parameter-prefixed argument shape; #125's routing fix read it correctly and it returned
  `llm_call_rows: 3`. The identical malformation scored `none` in §U9.1 — so without the pre-round
  repair, `N` would most likely have been **0**. Repairing the argument path before spending the
  round was the right call, and it cuts *against* the change rather than for it.

### X6. Disposition

`MAX_EVIDENCE_RETURNS` stays `0` and the instance was restored to that default and re-probed
(`: 0` → 1 record, `: 2` → 0 records, `REQUIRE_RETRIEVAL_TO_RELEASE: false` → 1 record). The unit
suite is back to 1340/1340 — the nine dormant-default guards fail on the round build and pass on the
shipped one, which is the cleanest confirmation available that they pin the right constant.

**Do not raise this constant without a new pre-registration.** §U9's ruling still governs the
family — *"No verdict is not the same as proven, so the default is off"* — but this round is
stronger than that: it is not "no verdict", it is a measured result below the bar.

### X7. What this round cannot establish

Everything in §U5, §V7 and §W8 stands, unsoftened.

- **Nothing about `REQUIRE_RETRIEVAL_TO_RELEASE`** (§W1) — `false` for all 60 runs, probe-verified
  before and after, still blocked by §V3's unresolved `'DENIED'` ruling.
- **§T3 remains the governing result** — six custom rows reached layer 4 and all six concluded at
  layer 1 — and nothing here moves it.

**Retrieving evidence is not diagnosing, and a round that refutes one mechanism has not improved a
diagnosis either.** What #121 bought is a closed question and an instrument (`retrieval`) that keeps
accruing on every run.

## Y. The strict release rule would have changed ONE release in 64 (`2026.08.0704`, §V5's counterfactual)

**Retrospective. No runs were fired for this section and nothing was enabled.** §V5 pre-registered
this measurement as the cheap route to the evidence §T9 said was missing:

> *"The audit column is written on every run regardless of the flag. So the counterfactual — how
> often the strict rule would have changed a release — is measurable from runs that were happening
> anyway, before anything is switched on."*

`REQUIRE_RETRIEVAL_TO_RELEASE` is `false` on gpinst01 and stays `false`. This section does not move
it, and §V3's unresolved `'DENIED'` ruling still blocks the round that would.

### Y1. What the flag actually changes

`_releaseSet(trail)` returns `trail.retrieving` instead of `trail.tools`, and **two** consumers read
it (`PaAgentLoop.js`):

1. **R1, the sticky release** — `_anyOf(this._heldTools, release)` discharges a hold.
2. **`_openGaps(gaps, release)`** — which declared gaps count as still open at the FIRST hold, so a
   barren call cannot pre-close a gap "one step earlier" (the docblock's own words).

So the rule binds only where a **non-retrieving call is what discharged a hold or closed a gap**.

### Y2. The corpus, and why the answer is nearly forced

64 runs carry a populated `retrieval` column (the §W round's 60 plus the 4 seed-03 guard runs).
**All 64 hit a HOLD; none was `capped`** — 64 trail-backed gate releases.

154 `action_type=result` rows carry a verdict:

| verdict | rows | tools |
|---|---|---|
| `ok` | **144** | `agent_trace` 67/67, `schema_lookup` 34/35, `query_table` 29/29, `agent_config` 13/13, `genai_log` 1/1 |
| `unknown` | 9 | `read_artifact` — **9 of 9** |
| `none` | **1** | `schema_lookup` (TR1000202) |
| `DENIED` | 0 | — |

**The nine `unknown` rows cannot matter, and the reason is structural rather than statistical.**
`read_artifact` is absent from `PaFixReport._layerToolMap()` — layers 1–7 map only to `agent_trace`,
`genai_log`, `log_analysis`, `agent_config`, `schema_lookup` and `query_table`. A tool outside that
map can never enter `_heldTools` and can never close a gap, so its verdict is invisible to the gate
whatever it is. *(If the layer map ever gains `read_artifact`, this paragraph stops being true and
the counterfactual must be recomputed.)*

That leaves exactly **one** gate-relevant non-`ok` call in the whole corpus.

### Y3. The one changed release — and it is §T4's defect, live

**TR1000202.** `agent_trace`(ok) → fix_report → **HOLD: "layer 4 (ranked) must be reached"** →
`agent_config`(ok) → `schema_lookup`(**none**) → fix_report → released → EVIDENCE RETURN → validated.

Layer 4's dedicated tool is `schema_lookup`, so `_heldTools = ['schema_lookup']`. The barren call is
what discharged the hold: `agent_config` was `ok` but is not in the held set, so it could not have
released it.

The call asked for `sn_tsbench_bench_ticket` — a guessed table that does not exist — and the tool
answered `table_exists: false`, `field_rows: 0`. **It established nothing, and the gate released on
it.** That is §T4 verbatim:

> *"v9 row 07's `schema_lookup` answered `table_exists: false` — it established nothing — and the
> gate released, because the release path compares tool NAMES from the audit trail and never
> inspects what came back."*

Under `REQUIRE_RETRIEVAL_TO_RELEASE` the hold would have stayed sticky and the fix_report would have
been refused a second time instead of released.

### Y4. The number

> **1 of 64 gate releases would have changed. 1.6%, 95% Wilson [0.3%, 8.3%].**

Two readings, and both are honest:

- **The rule is very nearly a no-op at this corpus's behaviour.** 63 of 64 releases were discharged
  by a call that genuinely retrieved. The strict rule is not the broad tightening §T4's framing
  might suggest; on this evidence it almost never binds.
- **When it did bind, it bound on exactly the defect it was designed for** — not on a borderline
  case, and not on a false positive. The single case is the §T4 pattern reproduced with a different
  guessed table name.

`_openGaps`, the second consumer, changed **nothing**: the only barren gate-relevant call occurred
*after* its run's first hold, so no gap was pre-closed by a barren call anywhere in the corpus.

### Y5. What this CANNOT establish — and the limit is severe

**This is retrospective on runs whose behaviour was shaped by the permissive rule.** It measures how
often the strict rule would have **withheld a release given the tool calls that actually happened**.
It does **not** measure what those runs would have done had they been held longer — which is the
entire question §T9 asked. A withheld release means another hold, another iteration, and a model
that might comply, might loop, or might ride to `MAX_HOLDS` and report `capped`. **None of that is
observable here.**

So Y4 bounds the rule's *bind rate*, not its *benefit*. A rule that binds 1.6% of the time cannot
help more often than 1.6% of the time — that ceiling is real and is the useful half of this result —
but nothing here says it helps at all when it does bind.

Also unestablished:

- **Nothing about `'DENIED'`.** Zero denials in 64 runs, so §V3's more consequential accepted false
  negative was never exercised. The ruling stays open and still blocks the round.
- **`schema_lookup` is the load-bearing tool** — 34 of 35 `ok`, and the single `none` is the only
  case in scope. A corpus with more guessed table names would move this number, and the §W round's
  targets are two fixed plans, so this corpus is narrow by construction.
- **Nothing about diagnostic quality.** §T3 still governs: six custom rows reached layer 4 and all
  six concluded at layer 1. **Retrieving evidence is not diagnosing.**

### Y6. Disposition

`REQUIRE_RETRIEVAL_TO_RELEASE` **stays `false`.** This section does not ratify it and was not
designed to: a 1.6% bind rate is not evidence that the rule helps, and §U9's ruling still governs
the family — *"No verdict is not the same as proven, so the default is off."*

What it does buy is a **ceiling**, cheaply and with no runs spent: whatever the strict rule is worth,
it is worth it on about one release in sixty at this corpus's behaviour. Anyone proposing to enable
it now has to argue that a mechanism which binds that rarely is worth the depth gate's instrument
risk — eight measured passes are calibrated against the current release rule. That is a much harder
case than §T9's *"the obvious next candidate"* framing implied, and it should be made before a round
is sized, not after.

## Z. Both §T9 pass blockers are closed (`2026.08.0709`, #139 + #140)

**§A through §Y are unmodified** — `git log -p benchmark/DECISION.md` is the check, as §X said of
§U–§W. This section appends and changes nothing above it.

**No runs were fired for this section, no packet was re-scored and no instance was touched.** It
records a repair to the measuring instrument, one re-reading of rows that already exist, and one
test-suite measurement. The packet scan shipped at `2026.08.0708` (#140); the rubric clauses, the
derived re-reading and this section at `2026.08.0709` (#139).

Artefacts: `benchmark/scorecard-template.md` §A2.1 · `test/rubricClauses.test.js` ·
`benchmark/scorecard-v9-derived-139.md` · `test/scorerPacketBlindRule.test.js`
(`PACKET_PATTERNS`, `PACKET_SETS`).

### Z1. What was blocked

§T9 opened with the blocker:

> *"Fix the rubric before spending another scored pass."*

The cost is in §T5. T8 predicted **≥10 of 12** rows would produce an unambiguous `passes_gate` from
the packet alone; **9 of 12 flagged `ambiguous = yes`**, and the flag landed on
`fix_usable_unedited` — one of §A2's two gate terms. All six native rows carry a recorded
alternative reading of that column that yields 0, so §T5 had to publish two readings of the same
pass:

| | totals | gate |
|---|---|---|
| As scored | native 36/36, custom 9/36 | native **6/6**, custom 0/6 |
| Every native `fix_usable_unedited` resolved to 0 | native 30/36, custom 9/36 | native **0/6**, custom 0/6 |

One under-determined column moved an entire arm between 100% and 0% on the gate.

**§O5 filed the same defect on the same column three passes earlier and nothing closed it.** That
entry found `assignment_group` placeholder text scored 0 on one v4 native row and 1 on another —
identical fix text, same seed — and filed it *"for whoever next revises §A, since it is a gap in
the rubric's text, not a lapse by a scorer."* Nobody revised §A. Rows 03–06 of the v9 pass are that
finding recurring in a pass whose headline depends on it. A filing with nothing enforcing it
survived three passes; that is the part worth generalising.

§T9's third recommendation was the second blocker: **widen the blind-rule test to any repository
path** and run it over the packets. §T7 found the gate green at 11/11 while two one-hop routes to
the answer key sat in the v9 packet framing, both removed by hand; §T9, carrying that finding into
its recommendations, is where the generalisation is written — *"this pass is the second consecutive
round in which the leak was caught by hand rather than by the gate."*

### Z2. The two clauses, and why both cases and not only the one §T9 named

`scorecard-template.md` **§A2.1** is authoritative; this is the summary.

**Case 1 — the fix leaves a value slot unfilled.** Score 1 only if BOTH hold: (1) the target and the
operation are fully specified — the table or record, the field, and what to do to it; **and** (2)
the missing value is not obtainable from the instance by any of the seven diagnostic tools. If the
value **was** obtainable and the run did not look it up, score **0**. Supplying a discovery
procedure in place of the value does not change this, and a procedure whose steps are UI actions
rather than tool calls does not make a value unobtainable.

**Case 2 — the fix addresses a runtime record rather than the Fluent source.** Score 1 if the
address resolves to **exactly one record** and **names every field it changes**; 0 if a scorer would
have to work out which record or which field the fix means.

Case 1 is row 03's scorer's own draft, which §T9 quoted and said to *"adopt that or its negation."*
It is adopted with the failing side written out, because the draft states only when to score 1 and a
scorer needs both sides to be mechanical. The obtainability test is what decides which side a slot
falls on: a value the instance does not hold — an assignment group for a table empty by design — is
the builder's to choose, and demanding it would reward fabrication; a value the instance does hold
is diagnosis the run declined to perform.

**§T9 named only Case 1, and the evidence for Case 2 cuts both ways.** Rows 01 and 02 record a
*second* under-determination in the same column — whether naming the runtime `sn_aia_tool` record
rather than the Fluent source counts as applicable without editing. §T5's own sentence is that those
rows *"resolve it as **not a rubric gap**, each scorer noting the other reading would flip the
gate"* — so the nearest reading of the evidence is that Case 2 needed no clause, and expanding scope
to decide it goes beyond what §T9 asked for. It is decided anyway, on the second half of that same
sentence: a column whose alternative reading flips the gate is under-determined whatever the scorers
concluded about it, and deciding Case 1 while leaving Case 2 would have reproduced §T9's exact
complaint, *"a coin the scorers are being asked to flip"*, on the same column of the same rubric. Both cases are subordinate to §A's
existing constraint — `fix_usable_unedited` may not be 1 while `fix_target_correct` is 0 — which is
checked first.

The clauses sit inside **§A2** because only §A / §A2 / §A3 are copied into a scorer packet; a clause
outside that range is a clause the scorers never see. `test/rubricClauses.test.js` pins both clauses
**and that placement**, which is the part §O5's filing lacked.

### Z3. The derived re-reading of the twelve v9 rows

`benchmark/scorecard-v9-derived-139.md` applies §A2.1 to facts the twelve blind scorers **already
recorded**, every cell sourced to a quotation from that row's result file or from the seed spec. Read
it for the per-row sourcing; this is the headline only.

> **Native `passes_gate` 6/6 → 4/6. Native totals 36/36 → 34/36. Custom gate 0/6, unchanged.**

**Two cells change: rows 05 and 06, both seed 04, `fix_usable_unedited` 1 → 0.** Both name the
target exactly — table, record sys_id, field, current value, required semantics — and both leave the
replacement `api` value unfilled. Seed 04's own spec records the healthy value as held by **422 of
the instance's 2026 `sys_one_extend_capability_definition` rows**, which `query_table` reaches, so
Case 1's second condition fails. Both rows carry `root_cause_layer_correct` = 2, so both flip
`passes_gate` as well as their /6. **That value is itself a listed blind-rule token**, and row 05's
scorer records it in the same sentence as the fact the recompute turns on — the run *"could not be
expected to have been told it — but nothing stopped the run from discovering it, and it did not"*.
It does not rescue either row: Case 1 condition 2 asks whether the value was **obtainable**, not
what the run was told. Contrast row 10 below, where the withheld token is an **identifier** and the
question is condition 1's specification test, which §A2.1 does not address at all. A withheld value
is disposed of by the clause as written; a withheld identifier is not.

Rows 05 and 06 present both shapes at once — an unfilled slot *and* a runtime-record address. Case 1
is phrased as a **necessary** condition and governs: passing Case 2's address test does not lift Case
1's bar. That reading is load-bearing for the two changed cells and is stated in the derived file
rather than left implicit.

**Row 10 is left unresolved, not decided.** Its scorer's own file points two ways in the same
document: it records that the fix "specifies the record type to create… the category value… the
quantity" (toward 1) and also that the fix "names *what* to create and *for which category*, **but
not the table**" (toward 0), while §A2.1 Case 1 condition 1 requires the table or record be
specified. The scorer resolved it to 1 on a ground §A2.1 does not contain — that
`x_snc_tsbench_routing` is a blind-rule token deliberately withheld from the diagnostic agent.
Deciding it either way would be fresh judgment, which a derived file must not exercise, so it is
listed. Consequence, and it is narrow: **row 10's `passes_gate` is 0 under either reading** because
`root_cause_layer_correct` = 0 and §A2's expression is a conjunction, so **custom's gate figure of
0/6 is invariant**. Only the custom **rubric total** carries an open range — **9/36 under the
scorers' reading, 8/36 under the strict condition-1 reading**. Quote the range or quote the gate;
do not quote a bare custom total.

`benchmark/scorecard-v9.md` is **untouched**. Those are the scores the twelve blind scorers produced
and they remain the primary record; the derived file is meaningless without it.

The derived native figure lands **between** §T5's two published bounds rather than at either, and it
moves **against** the arm this project currently recommends. That is evidence the clause was not
selected to produce a result. It is **not** evidence that the clause is correct.

### Z4. The packet channel is now scanned, and v4 is declared rather than exempted

`test/scorerPacketBlindRule.test.js` gains `PACKET_PATTERNS` — a single any-repository-path rule
bound to the packet channel — and `PACKET_SETS`, which declares every committed packet directory
with a scanned flag and a written reason. **The rule aims at uniformity without quite reaching it,
and the shipped shape is the one to quote:** any bare `*.md` filename fires, so every document in
this repository is covered by name, and a longer path fires when it is rooted at one of the
enumerated directory stems (`benchmark`, `docs`, `src`, `test`, `seed-app`, `node_modules`, `dist`,
`.claude`, `seeds`, `history`, `results`, `scoring-vN`, and the `scorecard-` / `raw-evidence-`
stems). A non-markdown file outside those stems is not matched. The first shipped version was
narrower still — an eight-name root-level whitelist — and the #139 review found it missing
`scorecard-v9.md`, `seeds/history/` and `scoring-v9/results/row-NN-result.md`, each a live route to
an answer key, and both of §T7's own leaks if written one directory segment shorter. Widened and
re-measured: the twelve v9 packets still scan 0, so no false positive forced a tightening. The old `answer-key-pointer` pattern matched a literal
`DECISION.md` and scanned the seed specs, one of the rule's three channels; both of §T7's one-hop
routes were outside it.

> **v9: 12 packets, 0 hits — before and after the widening. v4: 20 packets, 164 hits, held out
> unedited.**

Three positive controls were added with the widening — `scorecard-v9.md` by bare filename, a bare
`seeds/history/`, and `scoring-v9/results/row-NN-result.md` beside an unlisted root document — so
the widening is proven by the suite rather than asserted here.

**Why `scoring-v4` is a directory-level declaration and not a pattern-level exemption.** Its packets
were scored before this guard existed and they are the record of what those scorers actually read;
editing them would destroy the record the pass exists to hold, and 164 hits is what that record
contains. The alternative — adding stop-list patterns so v4's paths stop matching — would weaken the
rule for **every** future packet in order to accommodate one historical directory, and it would do so
silently. A declared directory carrying its own stated reason is neither silent nor a hole, and
`PACKET_SETS` is checked against what is on disk, so a new packet directory that is never declared
fails the suite rather than going quietly unscanned.

**What the 0 does not mean.** v9's packets were redacted by hand *before* scoring, so 0 hits confirms
that the widened rule agrees with what the builder did by hand. It is not a retrospective catch and
it does not establish that the v9 scorers saw nothing they should not have — §T7's account of that
stands as written. What the change buys is that the next leak of this shape is caught by the suite
instead of by a reader.

### Z5. What this cannot establish

**This repairs the measurement instrument. It measures nothing about diagnostic quality, for either
harness, in either direction.**

- **§T3 stands unmoved.** Six custom rows reached layer 4 and all six concluded at layer 1. Nothing
  in §A2.1, in the derived re-reading, or in the packet scan touches that result. A native row losing
  a point does not make the custom arm better, and custom's invariance on the gate does not make it
  worse.
- **§T8's limits stand in full and unamended.** **No rate** — twelve rows, three seeds, one instance,
  one day, one model, one app version; two reps per seed per arm measures a flip, not a frequency.
  **No Task 12 band verdict** — §A3.4 states the floor as *"below 8 valid runs the gate is not
  evaluable"*, without saying whether the count is per arm or across the pass. Read per arm it is
  unmet at 6. §T8 records that a permissive reading exists — the clause is written about voids
  eroding a 10-row denominator, not about a pass designed with 6 rows per arm — and that reading is
  still contested, not settled here. Either way the band lookup is not performed. 34/36 · 4/6 is not
  a rate and must not be read as one.
- **The derived figure is a re-reading of twelve existing rows, not a new pass.** It adds no rows, no
  seeds and no reps. It re-judges nothing outside `fix_usable_unedited`, and only where a scorer
  recorded the fact the clause turns on.
- **§A2.1 does not make the column mechanical in general.** It decides two cases. Row 10 is the
  standing counter-example in this very pass — a target identified by kind rather than by name, where
  the name is a blind-rule token — and §A2.1 says nothing about it. It is listed as unresolved rather
  than smoothed, and it is the open item for whoever next revises §A2.1.
- **§T9's *"Do not re-run this pass to get a firmer number"* still governs.** The instability §T5
  measured was in the rubric, not in the sample size, and repairing the rubric does not convert more
  reps into a firmer number. Any future scored pass needs its own pre-registration in the §U / §W
  style — predictions and stopping rule committed before a run fires, with the ordering checkable in
  git — and this section is not that pre-registration.
- **Nothing here is evidence that §A2.1's clauses are the right clauses.** They are mechanical and
  they were written before the recompute was run, which is what the "moves against the recommended
  arm" observation in Z3 supports. Correctness of a rubric clause is not something a recompute can
  establish.

### Z6. Disposition

**Both §T9 pass blockers are closed.** The rubric clause is written, placed inside the packet-reaching
range and pinned by a test; the blind-rule gate scans the packet channel with a single
any-repository-path rule — every `*.md` by name, longer paths by enumerated stem, per Z4 — and one
declared out-of-scope directory. §T9's remaining recommendation — a release rule that inspects what
the tool returned — is not addressed here and is separately bounded by §Y4 at a 1.6% bind rate;
`REQUIRE_RETRIEVAL_TO_RELEASE` stays `false` per §Y6.

**The next scored pass is unblocked. It is not scheduled, sized or pre-registered by this section.**
Nothing here fixes a seed set, a rep count, an arm, a stopping rule or a date, and a pass run against
this section as though it were a pre-registration would be exactly the confound §U was built to
avoid.

**Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is not
met.** The derived reading lowers native to 34/36 · 4/6 and leaves custom's gate at 0/6, so it
narrows the published margin without moving the recommendation — custom's 0/6 is invariant under
every resolution recorded in the twelve score files, including row 10's. Quote **34/36 · 4/6** only
with the derived file beside it, and **9/36 or 8/36** for the custom total, never a bare figure.

Suite at the close of this section: **1374 passed, 28 suites.** No production code was touched by
either issue.

---

## AA. The rubric channel is scanned (`2026.08.0801`, #143 + #144)

**§A through §Z are unmodified** — `git log -p benchmark/DECISION.md` is the check, as §Z said of
§A–§Y and §X of §U–§W. This section appends and changes nothing above it. In particular **§Z4
stands as written**: it is the accurate record of the rule that shipped at `2026.08.0709`, and this
section supersedes it rather than correcting it.

**No runs were fired, no packet was re-scored and no instance was touched.** This is a repair to the
measuring instrument, one reword of the rubric's source, and one test-suite measurement.

Artefacts: `test/scorerPacketBlindRule.test.js` (`RUBRIC_PATTERNS`, `PATH_STEMS`, `rubricRange`) ·
`benchmark/scorecard-template.md` §A–§A3 · `benchmark/README.md` guard roster.

### AA1. What was unguarded

The blind rule binds **three** channels. #100 guarded the seed specs; #140 guarded the packets. The
**rubric** — `scorecard-template.md` §A/§A2/§A3, the slice copied into every packet — was never
machine-scanned, and §Z shipped without touching it.

It had already leaked. §A2.1's preamble stated what a prior pass measured (*"nine of twelve rows
flagged `ambiguous`"*, *"moved a whole arm between 6/6 and 0/6"*) and carried two bare `§`-pointers
into this document. It was caught by a reviewer reading a diff and removed in `253de7f`.

**That is the §T7 failure shape one level up.** #140 hardened the packet channel after a leak was
caught by hand; this is the channel feeding every packet, caught by hand, with no guard. The fanout
is what makes it more than tidiness: a leak in one seed spec reaches the rows scored against that
seed, and a leak in the rubric reaches **all twelve rows at once**.

The protection that existed was real but lived in the wrong place. `scoring-v9/packet-build-report.md`
§7.2 records four substitutions on the rubric slice, each asserted to match exactly once at build
time or the build throws. They are **path-only** — they did not see the prose leak at all.

### AA2. What now binds

A third channel-scoped pattern list. The range is derived from the `## A.` / `## B.` headings rather
than hardcoded, which pins the template's heading structure into a test **deliberately**: the packet
build depends on the same two headings, so a rename that breaks the scan is a rename that changes
what ships to twelve scorers.

Four new patterns, plus four spec-channel patterns verified inert on the range, plus
`PACKET_PATTERNS` itself so the widening below reaches this channel automatically. The load-bearing
one is `outside-section-pointer`: **every `§` in the entire §A→§B range is a self-reference** — `§A`,
`§A2`, `§A2.1`, nothing else — so a pointer anywhere else is a pointer out of the packet, into a
document the scorer does not have. Zero false positives, and it catches both of #139's pointers.

> **The paragraph removed in `253de7f` is caught five times from four distinct patterns. The
> reworded range scans clean on all nine, with zero residual paths.**

Verified non-circularly: the leak was restored into the real template and the file scan was confirmed
to fail, rather than the guard being checked only against a string literal in its own test.

**`rubric-fraction` is deliberately absent, and this is the one judgement call worth quoting.** It
fires **ten times** on legitimate Task 12 band guidance in the range. The alternative — rewriting the
range to be fraction-free so the pattern could apply unchanged — takes out the sentence *"a run can
score 3/6 and pass; a run can score 4/6 and fail"*, which is the only place the rubric explains why
the gate is not the total. That is lobotomising the packet rather than redacting the leak. This is
not the stop-list the guard's doctrine forbids: that doctrine bans carve-outs *inside* a list, and a
separate list per channel is already how `PACKET_PATTERNS` exists.

**And it leaves a residue, recorded rather than left to be re-derived.** A bare fraction carrying no
scoring verb and no run-noun is caught by nothing in the rubric scan — *"the §A2 arm came out 0/6 last
time"* passes every pattern. A narrowed fraction rule requiring an adjacent past-tense outcome verb
would close it and measures clean against all ten legitimate fractions; it was considered and **not**
shipped, because it would be reverse-engineered from a constructed sentence rather than a real
incident, which is the weakness already recorded against `verdict-moved`. Compensating for one
speculative pattern with a second is not a fix. The design review that surfaced this also corrected
the count in this paragraph from six to ten — the first draft enumerated the band table and missed
four, including *"two different 4/6 runs"*.

**The four repository paths in the range were reworded out at source**, using §7.2's own A1–A4
replacements. The packet **text** is unchanged — that is the wording the v9 scorers already read —
but deviation set A disappears from the next packet build, and a future editor who adds a path to §A
now fails the suite instead of depending on the builder noticing.

### AA3. The path rule's residue, closed

§Z4 described the widened rule as firing on *"a longer path … rooted at one of the enumerated
directory stems"*. That was accurate and it understated the gap: the alternation required at least
one character after the slash, so a reference **stopping at a stem** escaped. Measured on the shipped
rule — `scoring-v9/`, `results/`, `../results` and `.superpowers/sdd/v9-pass/` all returned **no
hit**. *"The packets are in `scoring-v9/`"* was a walkable route.

Three alternations now. A bare stem **word** with no slash still correctly misses, pinned as a
negative control so a later widening cannot take ordinary prose.

> **v9: 12 packets, 0 hits — before and after this widening, as before and after §Z4's.** No false
> positive forced a tightening.

`scoring-v4` remains a declared out-of-scope directory for the reason §Z4 gives.

### AA4. What this cannot establish

**This repairs the measuring instrument. It measures nothing about diagnostic quality, for either
harness, in either direction.**

- **§T3 stands unmoved**, and so does everything §Z5 listed. Six custom rows reached layer 4 and all
  six concluded at layer 1; no scan changes that.
- **0 hits on the reworded range confirms the rule agrees with the reword.** It is not a
  retrospective catch, and it does not establish the v9 scorers saw nothing they should not have —
  §T7's account of that stands as written.
- **Nothing here establishes the new patterns are the right patterns.** Three were written against
  the one incident available. `verdict-moved` is explicitly reverse-engineered from a single
  sentence, and the file says so. Two others — `credit-awarded` and `counted-rows` — sit **one word**
  from firing on legitimate rubric guidance, and both near-misses are pinned as negative controls
  precisely because that margin is thin.
- **The rubric channel is scanned, not sealed.** AA2's residue is the standing example: a bare
  fraction with no scoring verb and no run-noun passes every pattern. Scanning a channel is not the
  same as covering it.
- **The run-report channel is still unscanned.** Per-row prose written fresh each pass, bound by the
  rule, hand-checked. Two of three channels are machine-scanned; this is not three.
- **A passing suite is not evidence of blindness.** It is evidence the declared patterns did not
  fire. This section's own count was wrong by four until a review measured it, which is the same
  lesson in miniature: a stated measurement is not a measurement.

### AA5. Disposition

**Both #143 and #144 are closed.** Two of the rule's three channels are machine-scanned, the rubric
slice is path-clean at source, and the guard roster matches the guard.

**§Z6 still governs the next scored pass.** It is unblocked and it is still not scheduled, sized or
pre-registered; any pass needs its own §U/§W-style pre-registration with predictions committed
before a run fires, and **this section is not that pre-registration** any more than §Z was.

**Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is not
met.** §Z6's quoting rule stands — **34/36 · 4/6** only with the derived file beside it, and **9/36
or 8/36** for the custom total, never a bare figure.

Suite at the close of this section: **1388 passed, 28 suites.** No production code was touched.

---

## AB. #134 answered from stored data — the return did not make reports shaky, it steered them into a trap (`2026.08.0901`, #134 + #148)

**§A through §AA are unmodified** — `git log -p benchmark/DECISION.md` is the check, as §AA said of
§A–§Z. This section appends.

**No runs were fired and no instance record was mutated.** Everything below is read-only queries
against the `x_snc_troubleshoot_run` table on gpinst01, plus one offline reproduction and one fix
with tests. This is #134's own "cheap first move" — *"the v10 rounds and the eight §U9.1 seed-01
runs also have transcripts. Check whether the association holds there before designing anything."*
It held, and it turned out not to need the paired design #134 sketched.

Artefacts: `src/server/PaFixReport.js` (`_checkFixes`, `_isInconclusiveWithoutFixes`,
`_isFixesAbsent`, `schemaText`) · `test/PaFixReport.test.js` (`#148` describe).

### AB1. The association replicates outside §W

`_evidenceReturnBlock` shipped in `0f3d30f` on 2026-08-06, so **no run before that date could
fire** — the split is exact, not a chosen cutoff. Across the three rounds where the mechanism
existed (v10, round 2, §W):

| | runs | `failed` |
|---|---|---|
| Fired at least one `EVIDENCE RETURN` | 14 | **7** |
| Did not fire | 58 | **0** |

§W alone was 4 of 10 against 0 of 50. The v10 + round-2 rounds add 3 of 4 against 0 of 4 — an
independent replication, and one §X5 did not claim.

### AB2. One correction to #134's wording, and one signature it did not have

**"All shape-class" is 6 of 7, not all.** TR1000173 (r2-2) terminated on an evidence-class problem
— *"evidence cites only the trace"* — after spending both returns, which `raw-evidence-v10` §R2.4
already recorded. #134 was written from the §W round's four and generalised one step too far.

The other six carry **exactly two problems and nothing else**:

> `fixes is required and must be an array; verification is required and must be a non-empty string`

**That pair-alone signature appears in 0 of the 202 non-firing runs in the table.** The only three
non-firing failures whose error text contains `fixes is required` — TR1000050–52, all on
2026-08-02 — carry all six required-field problems at once, i.e. a report that arrived essentially
empty. Different failure, and on a build three days older.

### AB3. The mechanism, read off the stored drafts rather than inferred

`fix_report` on all six (TR1000168, 174, 182, 208, 214, 218) is the same shape: `root_causes: []`, a
well-formed `inconclusive` object with 2–3 `evidence_read` citations, `data_markers: []`, and **no
`fixes` key and no `verification` key**. Every other required field is present and valid.

That draft satisfies `_isInconclusiveShape` — empty `root_causes` plus an `inconclusive` object —
but failed `_isInconclusiveWithoutFixes`, which additionally required `_isArray(report.fixes)`. **An
absent `fixes` is not an empty `fixes`**, so both relaxations vanished together and one omission
raised two problems. `repairPrompt` re-serves `schemaText()`, so the one allowed repair turn read
the same instruction and repeated the omission — which is why all six died on the repair rather
than being rescued by it.

Why the models omitted the key: the `fixes` line opened *"NON-EMPTY unless root_causes is empty and
you supply `inconclusive`"* and never said the key must be **present**, while its neighbours say so
explicitly — `data_markers: array (may be empty, must be present)` and, in the very same line,
`current is a string and may be empty but must be present`. The one field whose absence cost two
errors was the only one that never stated its presence requirement.

Reproduced offline, deterministically, with no instance involved: the identical draft with
`fixes: []` validates; with the key removed it yields exactly those two problems and nothing else.

### AB4. What this changes about #134's question

**Causation runs in the direction #134 feared, and by a different route than it proposed.** #134's
mechanism was *"the evidence return hands the model an extra rejection turn, and the extra turn is
where the malformed report appears"*, with the alternative that shaky runs draw both. Neither is
what happened. The block's **option 2** explicitly offers the `inconclusive` shape, the models took
it, and the shape carried a presence/emptiness trap. Firing runs failed because firing is what
routed them into it.

So the paired design #134 sketched — *"the cap toggled with the same targets"* — is **not needed**,
and `MAX_EVIDENCE_RETURNS` was not raised to study a side effect. §X6's ruling is untouched.

**The defect outlives the mechanism that exposed it.** §T4's ruling is that an honest "I could not
reach a conclusion" must be expressible, or the only structurally valid output is an invented root
cause. The trap silently un-did that for any run choosing the shape for any reason. The cap at `0`
closed the route those six runs took; it did not close the trap. Fixed at both layers under #148 —
the schema text states the presence requirement, and the validator treats a **missing** key as
empty on the inconclusive path (a `fixes` that is present but wrong-typed still errors, and nothing
is relaxed off that path).

### AB5. What this cannot establish

- **It does not re-open or move any verdict.** §W6 stands (`MAX_EVIDENCE_RETURNS` stays `0`, #81
  done), §X2's refutation stands, and **§T3 stands** — six custom rows reached layer 4 and all six
  concluded at layer 1. Nothing here is about diagnostic quality.
- **It does not establish that the fix improves any score.** No run has executed against the fixed
  build. What is established is that a specific way of destroying a scorable row is closed.
- **The 0-of-58 control is within-round only.** The 32 `failed` non-firing runs elsewhere in the
  table are from older builds under different validators; comparing them to these rounds would be
  comparing code versions, not arms.
- **6 of 7 is an explanation of six runs, not of failure in general.** TR1000173 failed on evidence
  class and is not explained by anything above.
- **One of the two traps was never observed.** The identical omit-it-unless wording on
  `root_causes` was found by review, not by a run — all six live drafts sent `root_causes: []`. It
  is fixed because the mechanism is understood, and it is recorded here as predicted rather than
  measured so a later reader does not promote it to evidence.
- **The association itself remains observational.** Firing was never randomly assigned. What
  replaces the missing randomisation here is a mechanism confirmed in the stored drafts and
  reproduced offline — not a design that rules out confounding.

### AB6. Disposition

**#134 is answered and closed; #148 carries the fix.** No re-measurement of #81, no change to
`MAX_EVIDENCE_RETURNS`, no round fired.

**§Z6 still governs the next scored pass**, unchanged: it is unblocked, and it is still not
scheduled, sized or pre-registered. **This section is not that pre-registration.** It does, however,
change what the pass should run against — the fixed build — and a pre-registration should say so
explicitly rather than inheriting it silently.

**Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is not
met.** §Z6's quoting rule stands — **34/36 · 4/6** only with the derived file beside it, and
**9/36 or 8/36** for the custom total, never a bare figure.

Suite at the close of this section: **1406 passed, 28 suites** (1390 on `main` plus the sixteen
#148 tests). `now-sdk build` clean on SDK 4.9.2. Production code WAS touched — `src/server/PaFixReport.js`
— which makes this the first section since §Z to carry a code change, and the change is unverified
against a live run by the project's own standard.

---

## AC. Pre-registration — the v12 scored pass (`2026.08.1001`, #151)

**Written and committed before a single run fired. §A through §AB are unmodified** — `git log -p
benchmark/DECISION.md` is the check, in the form §W and §Z both used. **This section claims no
result.** It fixes a seed set, a size, three rulings, nine predictions and a stopping rule, and it
does so while no row of this pass exists.

It discharges §Z6's open item — *"The next scored pass is unblocked. It is not scheduled, sized or
pre-registered by this section"* — and §AB6's added requirement that the pass state its build
explicitly rather than inherit it. The seed qualification it depends on is
`benchmark/raw-evidence-seed-qualification-02-05.md`, committed at `84ae0f0`, ahead of this section
and for this reason.

### AC1. What this pass decides, and what it does not

**Decides:** the Phase 1b milestone — *"deep diagnosis passes the same seeded-failure benchmark"*
(PRD, quoted at §G) — measured as both arms' `passes_gate` proportion under §A2, on the #148-fixed
build, across all five seeds for the first time since the v4 pass (§O).

**Does not decide:**

- **`MAX_EVIDENCE_RETURNS`.** Stays `0` for every run. §W6 was applied at §X and #81 is done;
  re-opening it inside a scored pass would confound the depth mechanism with the arm comparison.
- **`REQUIRE_RETRIEVAL_TO_RELEASE`.** Stays `false` per §Y6, for the same reason and on §W1's
  precedent — the two switches fire on opposite sides of validation.
- **Whether §A2.1's clauses are the right clauses.** §Z5 already ruled that a recompute cannot
  establish that, and neither can a fresh pass. Row 10's open case — a target identified by kind
  rather than by name — is **still unresolved** and this section does not resolve it. If it recurs,
  it is recorded as recurring.
- **Anything about the seed-05 execution-layer defect** found at qualification §3.3. AC4's ruling
  scores *through* it under a stated convention; that is a scoring decision recorded in advance, not
  a repair, and not a finding about the fixture's future.

**The build under test is `2026.08.1001`, and it must carry #148's fix.** Verified by probe, not by
the version string and not by `sys_updated_on` — §W7's rule, and §AB's fix is precisely the class of
change a version string cannot evidence.

### AC2. Shape and sizing

**5 seeds × 2 reps × 2 arms = 20 runs, 10 valid rows per arm.** This is the v4 shape (§O1) and it
is chosen for that reason: v4 is the only prior pass that ran all five seeds against both arms, so
its rows are the closest thing this project has to a comparable baseline.

**§A3.4's 8-valid-run floor is read PER ARM.** §T8 recorded the reading as contested — the clause is
written about voids eroding a 10-row denominator, not about a pass designed with 6 rows per arm, and
a permissive across-pass reading exists. **This section settles it for this pass, in the direction
that binds harder, and it settles it before any row exists.** That ordering is the entire point: a
floor consulted after the void count is known is a degree of freedom, not a criterion, and it is
resolvable by someone who can already see which reading flatters which arm (§W5's standard, and the
gap logged in `LEARNING.md` on 2026-08-09).

**The floor counts valid rows at the close of the pass, not voids encountered along the way.** §A3
requires voids to be re-run rather than absorbed, and a void that is successfully replaced costs the
denominator nothing — `scorecard-template.md` §A3.4 bites only on voids that **cannot be made
valid**. So the margin is: an arm may finish with up to **2 unrecoverable voids** (8 valid rows) and
still be evaluable; a third unrecoverable void takes that arm below its floor. A pass that voids six
rows and recovers all six has 10 valid rows per arm and is fully evaluable — it is a costly pass,
not an under-powered one. AC6 states the cost stop separately, and AC-8 predicts on voids
*encountered* for exactly this reason.

**What 10 rows per arm buys, stated against this pass's own interest.** The gate is a binomial read
against §A3.3's proportional bands, so its resolution is computable and it is not high:

| true per-run pass rate | P(top band, ≥8/10) | P(bottom band, ≤4/10) |
|---|---|---|
| 0.25 | 0.04% | 92.2% |
| 0.40 | 1.2% | 63.3% |
| 0.50 | 5.5% | 37.7% |
| 0.65 | 26.2% | 9.5% |
| **0.80** | **67.8%** | 0.6% |
| 0.90 | 93.0% | 0.01% |

**A harness whose true pass rate is exactly the top band's own threshold lands in the top band only
about two times in three.** That is inherent to reading a point threshold off ten runs and it is not
a defect to be fixed by re-running — §W3 made the identical statement about `D = 12`, and §T9's
*"Do not re-run this pass to get a firmer number"* still governs. The honest report for a result
near a band edge is "not distinguishable from the boundary".

**What this shape still is not: a rate.** §T8's limit is carried verbatim and unamended — twenty
rows, five seeds, one instance, one day, one model, one app version; two reps per seed per arm
measures a flip, not a frequency.

### AC3. The seed set — five seeds, two of them carrying a stated condition

All five seeds are in scope. Seeds 02 and 05 have been out of scope since §Q6 and were qualified at
`84ae0f0`; the qualification is fixture state only and **claims nothing about either harness**.

- **Seed 02 — qualified on construction.** Exactly one bound tool (`measure_request`), no
  group/routing/assignment vocabulary in its description, guarded in-repo by
  `test/seed02Construction.test.js`. Its 0/6 prior convergence is **filed as prediction AC-3 below**,
  not treated as a defect to fix mid-pass.
- **Seed 05 — qualified to fire.** The `sn_aia_trigger_agent_usecase_m2m` gate persists `active=true`;
  the empty `run_as` does **not** prevent firing (measured: ~1 second from insert to execution plan);
  the seeded `active=false` was restored and verified against four minutes of silence. The
  execution-layer defect at qualification §3.3 is handled by AC4's ruling.

**Operational conditions, all three carried from the qualification's §4 and all binding:**

1. **Re-read the m2m gate before run 1** — the seed doc's rule is "do not assume the PATCH took",
   and an intervening reinstall resets it. Re-read, do not re-apply blind.
2. **The three probe rows are deleted before run 1, and the deletion is verified by re-query.**
   `e24c49a22b2203d817a6ffbeee91bf16`, `2fac09262b2203d817a6ffbeee91bfa0`,
   `f3ec4d662b2203d817a6ffbeee91bfd5`. Their `short_description` values name the seed-05
   qualification, which is text a diagnostic run could read as a hint — that is a blind-rule leak of
   the §O5 shape, and the cheapest moment to close it is before the pass, not by adjudicating it
   afterwards. The seven pre-existing rows stay.
3. **Any procedure that activates a trigger and then exercises it must wait for `trigger_flow` to be
   populated and its `sys_hub_flow.active` to read `true` first.** Qualification §3.1 measured a void
   probe caused by inserting four seconds ahead of the generated flow. This applies to no step of the
   scored protocol as written — the seed stays inactive — and is recorded here so that a mid-pass
   repair does not re-commit it.

### AC4. The three rulings made in advance

These exist because each is a decision someone would otherwise make with rows in hand.

**Ruling 1 — seed 05 `fix_usable_unedited`.** A report that names the specific gate
(`sn_aia_trigger_configuration.active = false`) and proposes activating it scores
`fix_usable_unedited` = **1**, notwithstanding qualification §3.3's finding that activation alone
does not restore the acknowledgement.

*Rationale.* The column is read against the **seeded** defect. The run named the right gate and
proposed the seed spec's own sanctioned fix; the execution-layer break — empty `objective`,
`execution_mode` `interactive` against the use case's `autopilot` — is an unseeded second defect,
discovered by an operator probe that deliberately left the seed's own state, and it is not
detectable from any diagnosis of the seeded condition. Scoring it 0 would hold seed 05 to a standard
no other seed faces, and would move both arms identically, buying nothing while spending the seed's
value as a discriminator.

*What it costs, stated plainly.* The pass will publish `fix_usable_unedited` = 1 for a fix that, run
against this instance today, does not restore the behaviour. That is a real gap between the column's
name and the column's meaning, and it is accepted here in exchange for the ruling being made blind.
**This is a seed-05 clause for this pass. It does not amend §A2.1 and it does not generalise** — in
particular it does not touch §A2's decoy constraint, which is about a fix aimed at the *wrong
target*, whereas this fix is aimed at the right one. If `fix_target_correct` = 0, §A's constraint
binds first and this ruling never arises.

**Ruling 2 — the floor is per arm.** Stated at AC2. Recorded as a ruling as well as a size, because
§T8 left it contested and a contested clause next to a pending measurement is a degree of freedom.

**Ruling 3 — the milestone criterion.** The milestone is met iff the custom arm reaches §A3.3's
**top band — `sum(passes_gate) / valid runs ≥ 80%`**. The alternative reading available in the record
is *custom ≥ native*, and it is rejected here for a stated reason: it makes the milestone a function
of native's intra-day drift, which §O measured as real, so a bad native day could carry the milestone
without the custom harness improving at all. The band reading is fixed and does not move with the
control. **Native's arm is reported beside it and is not part of the criterion.**

### AC5. The predictions

Filed here, before any run. Refutation criteria are stated for each; a prediction with no stated
refutation is not one.

| | Prediction | What refutes it |
|---|---|---|
| **AC-1** | Native's `sum(passes_gate)` **exceeds** custom's | Custom ≥ native |
| **AC-2** | Custom scores `root_cause_layer_correct` = 0 on **≥ 8 of its 10 rows** — §T3's six-of-six standing on a larger and broader sample | ≤ 7 rows at 0 |
| **AC-3** | Seed 02 — **all four** rows (2 native + 2 custom) score `root_cause_layer_correct` = 0, and ≥ 3 of the 4 reports contain an explicit "no failure observed" style conclusion | Any row scores 2, **or** ≤ 2 reports converge. Either half refutes it, and the first half is the one that would rule §O6's open question toward *shared blind spot* being wrong |
| **AC-4** | Seed 05 — native passes the gate on **≥ 1 of 2** rows (Task 12: both 6/6); custom passes on **0 of 2** | Native 0 of 2, or custom ≥ 1 of 2. Ruling 1 applies to both arms identically |
| **AC-5** | **≥ 14 of 20** rows produce an unambiguous `passes_gate` from the packet alone — the first test of §A2.1 and §Z's rubric repair, against the v9 baseline of 3 of 12 recorded at §T2's prediction T8. **"Unambiguous" means the scorer's packet-level `ambiguous` flag reads `no`** — the broad reading, counting ambiguity anywhere in the row. The narrower gate-only reading that §T2 also records (4 of 12 there) is **not** the one measured, and may not be substituted afterwards | ≤ 13 rows with `ambiguous = no`. This is the prediction most likely to fail and the most useful if it does |
| **AC-6** | Custom's audit-derived sweep breadth is **at or below** native's on every row — §T2's prediction T9 held at 12 of 12 | Any custom row exceeds **either** of its seed-matched native rows |
| **AC-7** | **0 of 10** custom rows are lost to #148's trap — no row terminates on a validator rejection attributable to an omitted `root_causes` or omitted `evidence` array | ≥ 1 such row. §AC8's third bullet states why a clean result here is weak evidence |
| **AC-8** | **≤ 2 void rows encountered across the whole pass**, and every arm finishes with **10 valid rows** | ≥ 3 voids encountered, **or** any arm closing below 10 valid rows. Stated on voids *encountered* rather than surviving, because AC6 re-runs them: a pass that voids six rows and recovers all six is not the clean run this predicts |
| **AC-9** | **The milestone is NOT met** under Ruling 3 — custom lands below 80% | Custom ≥ 80% of its valid runs |

**AC-9 is a prediction against the project's own preferred outcome**, and it is filed that way on
purpose: §Z6, §AA and §AB have each closed carrying *"the Phase 1b milestone is not met"*, so the
prior is explicit and it should be exposed to refutation rather than restated.

### AC6. The stopping rule, and why it is fixed rather than adaptive

**Fixed `n` = 20 runs. The pass does not extend and does not stop early.**

§W deliberately did *not* do this — it sampled to a fixed `D` because whether a run fired an
`EVIDENCE RETURN` was stochastic, leaving the denominator to chance. **That condition does not hold
here.** Every run in this pass produces a scorable row unless it is void, so the denominator is
fixed by construction and inverse-binomial sampling would buy nothing while adding a mid-pass
quantity for an operator to read.

**The stopping rule reads the void count and nothing else.** No score, no `passes_gate`, no arm
total is computed while runs remain. §U8.5's ruling governs: *"Continuing because the split is tied
is optional stopping at the most result-sensitive moment there is."*

**Void handling, decided now:**

| Situation | Action |
|---|---|
| A row is void under §A3 | Re-run that seed/rep, per §A3's *"void runs should be re-run, not absorbed"*. Record both the void and its replacement |
| Re-runs reach **3 in one arm** | **A cost stop, not a verdict.** Stop re-running that arm and close the pass with what is valid. Then apply §A3.4 to the arm's **valid row count**: at 10 valid rows it is evaluable normally; at 9 or 8 it is evaluable with the void reasons stated; **below 8** report *gate not evaluable — insufficient data* and **do not compute a verdict from the survivors**. The re-run cap bounds instance time; the floor is what bounds the verdict, and the two are not the same test |
| A void is caused by an operator error rather than fixture state | Still a void, still re-run, and the error is recorded in the raw-evidence file. §O5's controller error is the precedent for recording rather than quietly correcting |

**Packets are built after all 20 runs terminate, and the scorers are dispatched once.** No packet is
scored while a run remains unfired. This is a procedural commitment of the same class as §W4's
*"the operator must not compute `N` mid-round"*, and it is the one thing here a careless operator can
break silently.

### AC7. Protocol and pre-flight

**Sequencing: interleaved by seed** — native rep 1, custom rep 1, native rep 2, custom rep 2, per
seed, strictly sequential, one day, one deployed version (§O1). Interleaving spreads intra-day model
drift across both arms instead of aligning it with the arm boundary.

**Run identity is verified, not inferred.** Each row's `conversation_ref` is queried directly and
confirmed distinct — `PaRunAnchor`'s one-anchor-per-user-per-30-minute fallback makes interleaving a
hazard here rather than a safeguard (§O1).

**Scorer topology is fixed to match v9: independent agents, one per packet, redacted packets.** §O5
measured topology moving the result by about two rows — one agent scoring ten rows sequentially is
materially more generous than ten independent agents on identical material — so topology is held
constant or the comparison to v9 is meaningless. Packets are built by the §Z4 packet-scan rules.

**Pre-flight, every item verified by probe before run 1:**

1. `sys_app.version` reads `2026.08.1001`.
2. **#148's fix is present in the installed `PaFixReport`**, by `scriptLIKE` probe against the fixed
   wording — not by version, and not by `sys_updated_on` (§W7, §U7).
3. `PaAgentLoop^scriptLIKEMAX_EVIDENCE_RETURNS: 0` → 1 record (AC1).
4. `PaAgentLoop^scriptLIKEREQUIRE_RETRIEVAL_TO_RELEASE: false` → 1 record (AC1).
5. **All five seeds' §A3 fixture conditions re-read live** — including seed 05's m2m gate (AC3.1) and
   seed 04's capability sys_id matching the instance's `sys_one_extend_capability` record, whose
   mismatch is §A3's other void condition.
6. The three seed-05 probe rows are gone (AC3.2), by re-query.
7. `layers_available` read by **two independent paths** — `sn_aia_agent_tool_m2m` for native,
   `PaToolRegistry`'s own registry read for custom — rather than one value asserted for both (§O1).
8. Budget knobs read fresh: `sn_aia.continuous_tool_execution_limit` and `max_auto_executions`. §T1
   recorded the first as *not read* during the v9 pass; that omission is not repeated.
9. Smoke gate fired and passed on **both** arms before any scored row is spent.

**The blind-rule guard must be told about `scoring-v12/` as part of building the packets, not
after.** One correction to the qualification file's §4 item 4, which said the suite "stays green
while it is": it does not. The `declares every committed packet set` test compares `PACKET_SETS`
against the directories actually on disk, so a new `scoring-v12/` turns the suite **red** until it
is declared — the guard fails closed on *declaration*. **The residual hole is narrower and real:**
`scanned` is consumed as `PACKET_SETS.filter((s) => s.scanned)`, so a set declared `scanned: false`
with a written reason is accepted and never scanned.

**Declaring it takes three edits, not one, and all three are needed before the suite goes green
again.** Naming only the first would leave an operator debugging the guard in the middle of the one
procedure §AC6 says must not be interrupted:

1. **Add the `PACKET_SETS` entry** with `dir: 'scoring-v12'`, **`scanned: true`** (the
   `scanned: false` route exists for `scoring-v4`'s historical record and for nothing in this pass),
   a `why`, and a **`packets:` count** — the per-set test asserts the number of `row-NN-*.md` files
   on disk equals that count, so it must be the real number.
2. **Update the hardcoded membership literal** in the same test —
   `expect(PACKET_SETS.map((s) => s.dir)).toEqual(['scoring-v4', 'scoring-v9'])` — to include
   `'scoring-v12'`. This is documentation of declared order; the disk-derived assertion above it is
   the one that binds, but both must pass.
3. **Run `npm test`** and confirm green before the first packet is handed to a scorer.

Line numbers are deliberately omitted here: they drift on any edit to that file, and the earlier
draft of this section pinned `:709` when the assertion is at `:722`. Navigate by test name.

**Artefacts.** Measurements → `benchmark/raw-evidence-v12-scored-pass.md`. Rows →
`benchmark/scorecard-v12.md`. Packets exactly as scored → `benchmark/scoring-v12/`. Operator records
(packet-build report, run evidence, this pass's qualification file) are **outside** the scorer-facing
channel by the guard's own declaration and must never be pasted into a packet.

### AC8. What this pass cannot establish

Everything in §T8, §Z5 and §AB5 stands, unsoftened.

- **It is not a rate.** Repeated from AC2 because it is the limit most often lost in quotation. Two
  reps per seed per arm measures a flip.
- **It cannot establish that the rubric is correct.** §A2.1's clauses are mechanical and were
  written before the recompute that used them; that makes them reproducible, not right. AC-5 tests
  whether they *determine* an answer, which is a different property from whether the answer is the
  right one.
- **Ruling 1 is a scoring convention, not a finding.** It does not establish that "activate the
  trigger" is a good fix, and the pass's seed-05 rows must never be quoted as evidence that it is.
- **A clean AC-7 is weak.** #148's trap was found by review, not by a run — §AB5 records that all six
  observed drafts sent `root_causes: []`, and the identical `omit-it-unless` wording on the other
  field was never observed firing. Zero losses is therefore consistent with the fix working **and**
  with the trap never having been triggered in these ten runs. It is not a measurement of the fix.
- **It cannot establish transferability.** One instance, one model, one day, one app version, one
  ceiling (`continuous_tool_execution_limit`, whose shipped OOB default is still UNKNOWN per §B).
- **It CAN move §T3, and this is the first pass with the power to** — but only within its own twenty
  rows, and only on `root_cause_layer_correct`. AC-2 predicts it does not move. **Reaching a layer is
  still not diagnosing at it** (§T3), and no arrangement of this pass's numbers changes that
  distinction.
- **It does not license a re-run.** §T9's *"Do not re-run this pass to get a firmer number"* applies
  to this pass as it did to v9: the resolution table in AC2 is a property of ten rows, and a result
  near a band edge is reported as near a band edge.

**Unchanged at the time of writing: native remains the recommended path on this instance, and the
Phase 1b milestone is not met.** §Z6's quoting rule stands — **34/36 · 4/6** only with the derived
file beside it, and **9/36 or 8/36** for the custom total, never a bare figure. This section changes
none of that, because it contains no measurement.

## AD. The v12 scored pass — verdict (`2026.08.1001`, #151)

**§AC through §AC8 are unmodified.** `git log -p benchmark/DECISION.md` is the check, in the form §W,
§Z and §AC all used, and the DECISION.md diff for this branch is **append-only** — the pre-branch file
is an exact byte prefix of this one.

> **One citation corrected after review.** §AC was authored at `a342311` and then **amended at
> `8ab2c00`** ("apply code review findings to §AC"), which changed 50 lines including three scored
> refutation criteria: AC-5 gained the binding *"'Unambiguous' means the scorer's packet-level
> `ambiguous` flag reads `no`"* clause, AC-6 gained *"either of"* its seed-matched native rows, and AC-8
> was loosened from "0 void rows in each arm" to "≤2 encountered, every arm finishes with 10 valid rows".
> **The pre-registration property is intact** — both commits, and the merge `4bcf43c`, precede the first
> scored run by ~40 minutes, and §AC is byte-identical from that merge to HEAD — but the commit that
> contains the criteria these predictions were scored against is **`8ab2c00`/`4bcf43c`, not `a342311`**.
> A pre-registration is only as good as the commit it names, so the right one is named here. §AC claimed no result; this section reports the result it pre-registered, and
nothing here amends the pre-registration retroactively.

The measurements are in `benchmark/raw-evidence-v12-scored-pass.md`, the rows in
`benchmark/scorecard-v12.md`, the packets exactly as scored in `benchmark/scoring-v12/`, and each blind
scorer's full reasoning in `benchmark/scoring-v12/results/`.

### AD1. The result in the form §Z6 requires

**Native 6/10 · 60.0% · middle band. Custom 0/10 · 0.0% · bottom band.** Rubric totals **51/60** and
**9/60**. Twenty rows, five seeds, two reps, two arms, one instance, one day, one app version, **zero
void rows** — both arms finished with all ten rows valid and neither used any of its three permitted
re-runs.

> **The Phase 1b milestone is NOT met.** AC4's Ruling 3 fixed the criterion in advance as *the custom
> arm reaching §A3.3's top band (≥80%)*. It reached 0.0%.

**This is the fifth consecutive section to close with the milestone unmet** (§Z6, §AA, §AB, §AC's
standing statement, now §AD) — but it is the first to close on **a full five-seed scored measurement of
both arms on a probe-verified build**, rather than on a recompute, a derived re-reading, or an
unblocked-but-unscheduled note.

### AD2. Predictions: seven confirmed, two refuted

AC-1, AC-2, AC-4, AC-6, AC-7, AC-8 and AC-9 confirmed; **AC-3 and AC-5 refuted.** The table with each
number is at `scorecard-v12.md` §3 and is not duplicated here.

**AC-9 was filed against the project's own preferred outcome and it held.** §AC5 filed it that way
deliberately, because §Z6, §AA and §AB had each closed carrying "the milestone is not met" and the prior
deserved exposure to refutation rather than restatement. It was exposed and it survived.

**AC-2 confirmed by one row.** Custom scored `root_cause_layer_correct` = 0 on exactly **8** of 10 —
the refutation threshold was ≤7. Rows 14 and 20 scored 2. So §T3's six-of-six became eight-of-ten on a
larger and broader sample, and the prediction that it would not move was correct, narrowly. **Reaching a
layer is still not diagnosing at it** (§T3): row 14 named layer 6 and proposed fixes aimed at tool
schema and error handling, and row 20 named layer 7 correctly and died at the citation validator.

### AD3. AC-5's refutation is the most consequential finding, and it is about the rubric

AC-5 predicted **≥14 of 20** rows would return `ambiguous = no` on the broad packet-level flag — the
first real test of §A2.1 and §Z's rubric repair. It returned **8 of 20**, against a v9 baseline of 3 of
12. §AC5 called it *"the prediction most likely to fail and the most useful if it does."* Both halves
came true.

**What §Z's repair actually achieved, stated precisely.** It made the rubric **reproducible** without
making it **determinate**. Rows 13 and 15 — near-identical seed-04 diagnoses — were scored identically
by two scorers who never communicated, both landing on §A2.1 Case 1's obtainability test. Both seed-05
native rows likewise. That consistency did not exist before #139. But twelve of twenty rows still
carried a column a careful scorer could defend two ways — 14 flags over those 12 rows, since rows 07 and
14 each name two — and **a gate term (`fix_usable_unedited`) and `evidence_cites_trace_and_config` drew
them equally often, five rows each** (`fix_usable_unedited` on 01, 07, 17, 19, 20;
`evidence_cites_trace_and_config` on 06, 08, 10, 13, 14; `root_cause_layer_correct` on 07, 14;
`fix_target_correct` on 05, 12).

> **Corrected after review, before merge.** An earlier draft of this subsection said
> `fix_usable_unedited` was "the most frequently flagged column, in six of the twelve", counting row 13
> against it; row 13's scorer flagged `evidence_cites_trace_and_config` only. Re-derived from all twenty
> verdict files. **The load-bearing claim survives** — a gate term is under-determined on a quarter of
> all rows, so §A2.1 did not close its exposure — but the superlative does not, and §AD7's open item 3
> should be read as covering *both* columns rather than the evidence column alone.

**§AC8's caveat was right and should now be promoted to a standing limit:** AC-5 tests whether the
clauses *determine* an answer, which is a different property from whether the answer is *right*. This
pass says they frequently determine nothing. Row 10 is the sharp case — both a trace and a schema
citation are formally present, but the schema citation is the irrelevant `incident.assignment_group`
lookup that answered the depth HOLD, so a relevance-minded scorer defends 0 and a formalist defends 1,
and the rubric does not say which. That is not a scorer failing; it is a missing clause.

### AD4. The finding this pass produced that no prediction anticipated

**The depth gate can degrade a diagnosis, and it did so measurably.** §T5 established that the gate's
release counts a layer-4 tool being *called* rather than *reached* — a gate that adds nothing. Ten
custom rows on a probe-verified build show something stronger: across the nine held rows, **not one
gate-forced call targeted anything connected to its seed's defect** (`task`, `task`,
`incident.priority` ×3, `incident.assignment_group` ×2, `sn_aia_tools_execution`,
`sn_aia_execution_plan`), and the consequences were not merely neutral:

| outcome of the forced call | rows |
|---|---|
| a confident **false positive** that replaced a partly-correct draft | 02, 04 |
| an honest inconclusive | 06 |
| **terminal validation failure** — the forced call offered *as a root cause* and killed by the citation rule | 08 |
| a validated report with an **invented fix**, the forced call laundered into a supporting citation | **10** |
| a validated report with a **non-actionable fix**, the forced call cited nowhere | 12, 16 |

> **Corrected after review, before merge.** An earlier draft grouped rows 10, 12 and 16 together as
> having laundered the forced call into a supporting citation. The packets refute that for two of the
> three: row 10's root cause cites `trace` + `schema` — the `schema` half being the forced
> `incident.assignment_group` lookup — whereas rows 12 and 16 cite `trace` twice and never cite their
> forced call at all, which is exactly why both scored `evidence_cites_trace_and_config` = 0. Only row
> 10 laundered it. Rows 12 and 16 spent the call and produced a non-actionable fix, which is a different
> failure and is now recorded as one.

**Rows 02 and 04 carry the proof in the transcript.** In both, the pre-HOLD draft the gate *refused*
was closer to correct than the post-HOLD report it *accepted* — row 04's refused draft had already
reached `priority_stored`, the exact null read-back on which both native rows built their CONFIRMED root
cause. And rows 12 and 16 each wrote a `would_confirm` naming the call they actually needed (a layer-5
`query_table` against the routing table; a layer-3 `agent_config`) and then spent their one held call
elsewhere, because the gate asked for *a* layer-4 call rather than *the* confirming one.

**Every component behaved as designed.** The tools were correct and even warned about nonexistent
fields. The gate enforced exactly the rule it encodes. The citation validator correctly destroyed the
one report that rested on a forced call alone. **The harm is emergent from the composition, which is
why no component's own test suite could have caught it** — and it is the mechanism §AB was circling
when it concluded the evidence return had *"steered them into a trap"*.

This bears directly on the middle band's prescription. §A3.3 reads native's 60% as *"native for
lightweight triage + custom deep-diagnosis harness"* — but **the custom deep-diagnosis harness scored
0/10, and the component intended to produce its depth is the component producing its worst answers.**
The band's stated outcome cannot be adopted as written on this evidence.

### AD5. Two process defects, and one new defect to file

**Ruling 1 never reached the scorers.** §AC4 ruled in advance, blind, on seed 05's
`fix_usable_unedited` exposure — precisely so that no scorer would improvise it. The ruling lives in
this file, which no scorer may read, and the packet build did not carry it across. Both seed-05 native
scorers flagged that column as under-determined for exactly that reason, and one named the absence.
**It changed no score** — both independently landed on the value Ruling 1 mandates — but that is luck,
not compliance. **The rule this produces: an advance ruling on a scoring column must be written into
the packets, not only into the pre-registration.** §AC4's own sentence — *"before the scorers meet
it"* — was satisfied in time and defeated in delivery.

**Two packets were built wrong and repaired before dispatch**, carrying raw tool-output envelopes ahead
of the report. Caught by reading the built file back rather than by any test. Recorded at
`scorecard-v12.md` §4 with the reusable discriminator.

**New defect, to be filed: `PaFixReport` lets a malformed `layers_swept` suppress the layer-1
UNAVAILABLE escape clause.** Row 20 emitted `layers_swept` as flat strings with reasons in a separate
key, and the consequences compounded: the completeness check saw all seven layers as missing, and
because the validator could not see layer 1 marked UNAVAILABLE, the *"nothing ever ran"* clause never
engaged — so the evidence rule fired demanding a trace citation for a run where nothing ran. **The
rejection instructed the run to do what it had already done.** This is the same family as #148 (§AB:
"an omitted key silently withdrew the relaxations") with a malformed key in place of an omitted one.
Seed 05 is the only seed that can surface it.

### AD6. What this pass cannot establish

§T8, §Z5, §AB5 and §AC8 stand unsoftened. Specifically:

- **Not a rate.** Two reps per seed per arm measures a flip. §AC2's resolution table gives a
  true-80% harness only a ~68% chance of reaching the top band from ten rows, so native's 60% and a
  true 60% are not the same claim.
- **Custom's 0/10 is a floor, and floors are the least informative result.** A 0% proportion cannot
  distinguish "just below the band" from "nowhere near it". Nine rows never reached the seeded layer;
  the tenth reached it and failed on citations.
- **AC-7's clean result is weak** — three custom rows died at the validator on *other* clauses, so
  #148's specific trap was never exercised. AD5's new defect is the adjacent trap firing.
- **The rubric is not validated.** AC-5 says it frequently does not determine an answer.
- **No transferability.** One instance, one model, one day, one app version, one ceiling
  (`continuous_tool_execution_limit` = 25, read live this pass — closing §T1's gap).
- **It does not license a re-run.** §T9 governs: 60% and 0% are properties of ten rows each.

### AD7. Disposition

**Native remains the recommended path on this instance, and the Phase 1b milestone is not met.**
Quote this pass as **native 6/10 · 60% · middle band** with **custom 0/10 · 0% · bottom band** and the
rubric totals **51/60 / 9/60** beside them — never a bare figure, never one arm without the other.

Open items this section creates, none of which it resolves:

1. **File the `layers_swept` malformed-key defect** (AD5).
2. **The middle band's prescription needs re-derivation** (AD4): its "custom deep-diagnosis harness"
   half is contradicted by the depth gate's measured behaviour, and adopting the band as written would
   prescribe the component this pass found most harmful.
3. **§A2.1 needs a third clause** for a formally-present-but-irrelevant citation (AD3, row 10), or
   `evidence_cites_trace_and_config` will keep drawing ambiguity flags.
4. **Advance rulings must ship in packets** (AD5).
5. **Row 10's §A2.1 open case from §Z5 — a target identified by kind rather than by name — did not
   recur** in a form this pass had to adjudicate, and remains unresolved.

## AE. The middle band's prescription, re-derived (`2026.08.1004`, #158)

**§AD is unmodified and this section appends to it** — the check is `git log -p benchmark/DECISION.md`,
in the form §W, §Z, §AC and §AD all used. This closes §AD7's open item 2. It reports no new measurement
and changes no v12 number.

### AE1. The cell, and the three separate claims packed into it

`scorecard-template.md` §A3.3, the proportional form of the `≥ 8/10` / `5–7/10` / `< 5/10` thresholds
fixed in `ARCHITECTURE_DECISIONS.md` Decision 0.5 (July 2026):

| Band | Proportion of valid runs | Outcome |
|---|---|---|
| Top | ≥ 80% | Native is the front door |
| **Middle** | **≥ 50% and < 80%** | **Native for lightweight triage + custom deep-diagnosis harness** |
| Bottom | < 50% | Full custom harness as designed |

The middle row's Outcome does three unrelated things at once:

1. **It classifies** — native's proportion falls in `≥ 50%, < 80%`. A measurement.
2. **It prescribes native's role** — *"for lightweight triage"*. A claim about the **native** arm,
   resting on the native arm's own number.
3. **It prescribes building the custom harness** — a claim about a **different** arm, resting on
   nothing in the measurement.

Only (3) is at issue. (1) and (2) are intact, and both halves of §AD7's disposition rest on them.

### AE2. Why (3) was sound when it was written

Because the custom arm did not exist. With one arm measured, *"native is middling"* is the only
evidence in the room and *"so build the alternative"* is the only inference available from it — there
is no second number that could contradict it. The cell is not a mistake in its own context.

It is a rule **authored under a counterfactual** — *the custom harness is unmeasured* — which it
carried as a silent premise rather than as a stated precondition. That is the whole defect, and it is
a defect of form, not of judgement: **a decision rule authored under a counterfactual expires when the
counterfactual is measured, and nothing in the rule says so.**

### AE3. What v12 measured, and the category error it exposed

Native **6/10 · 60%** — middle band. Custom **0/10 · 0%** — bottom band. Same instance, same day, same
five seeds, same probe-verified build, zero void rows (§AD1).

The middle band's third claim now reads a **native** number to prescribe about an arm **whose own
number exists and is worse**. The premise the cell carried is no longer merely unstated; on this
evidence it is false.

§AD4 makes it worse than an inert contradiction. The component the prescription names — the
*deep-diagnosis* half — is the component measured to **degrade** diagnoses: across the nine held rows
not one gate-forced call targeted anything connected to its seed's defect, and rows 02 and 04 carry the
proof in the transcript, where the pre-HOLD draft the gate **refused** was closer to correct than the
post-HOLD report it **accepted**.

**The mechanism is the gate's release condition, not an implementation defect.**
`PaAgentLoop._depthGate` records ONE target gap (`_selectTarget`) and discharges when any of that
layer's **dedicated** tools appears in the audit trail (`_heldTools` / `_releaseSet`), capped at
`MAX_HOLDS` = 2. It can require *a* layer-4 call; it has no way to require *the* confirming one — rows
12 and 16 each wrote a `would_confirm` naming the call they actually needed and spent the held beat
elsewhere. §T5 recorded the weaker form of this already: release counts a tool being **called** rather
than a layer being **reached**. §AD4's finding is that every component behaved as designed, which is
precisely why the correction belongs in the decision rule and not in a bug fix.

### AE4. The replacement rule

The error is that a **single-arm classification** was made to carry a **two-arm prescription**. The
repair keeps the classification, keeps the native-side prescription, and makes the custom-side
prescription a function of the custom arm's own measurement — with the counterfactual that made the old
form valid promoted from silent premise to stated precondition:

> **Custom-side prescription, by measurement state.**
>
> **(a) The custom arm is UNMEASURED on this seed set** — the band's original prescription stands.
> Native's shortfall is the only evidence available and building the alternative is the only inference
> it supports. This is Decision 0.5's rule in Decision 0.5's context, and it remains correct there.
>
> **(b) The custom arm IS measured** — native's band prescribes **native's role and nothing else**. The
> custom harness is built out only if **the custom arm's own proportion reaches the top band
> (≥ 80% of its valid runs)**, on the same seed set, in the same pass. Native's arm is reported beside
> it and is not part of the condition.
>
> **(c) Under (a) or (b) alike** — a component **measured to degrade a diagnosis** is removed or
> re-derived before any further build, whatever the arm proportions say.

**Why the ≥ 80% anchor is fixed rather than relative.** The obvious alternative — build out custom if
it *exceeds native* — is already considered and rejected in this file. §AC4's **Ruling 3** rejected
`custom ≥ native` as the milestone criterion because it makes the test a function of native's intra-day
drift, which §O measured as real, so a bad native day could carry it without the custom arm improving
at all. That objection applies to a build-out prescription exactly as it applies to a milestone, so the
same drift-free anchor is used and the relative form is rejected here for the same stated reason.

**Why (c) is separate from (b) rather than implied by it.** Arm-level proportions can hide a
component-level harm: an arm can clear a band while containing a component that degrades a subset of
its rows. §AD4 is exactly such a finding, and the 0/10 does not express it — the arm score would look
the same if the gate were merely inert, which §T5 had assumed it was.

**This codifies practice rather than inventing it.** §AC4's Ruling 3 already read the band table as a
**classifier applied to the custom arm's own number**, and explicitly declined to read native's arm
into the criterion. The Outcome column had in practice already stopped being used as written; this
section makes the instrument agree with the use.

### AE5. The bottom band carries the identical defect and is repaired with it

`< 50% → Full custom harness as designed` is the same category error in the same table: native failing
tells you native is not the answer; it does not tell you the custom harness is. Under (a) it stands;
under (b) it does not. The rule above governs both rows, and the extension is recorded here rather than
left for a later reader to trip over one cell away from the one that was fixed.

**Note what the bottom row did NOT contain: a claim about native at all.** Unlike the middle row, whose
*"native for lightweight triage"* is claim (2), the bottom row is claim (3) end to end. Withdrawing claim
(3) therefore leaves it **empty**, and the repaired cell has to *state* a native-side outcome that was
never previously written down. It is worded **`this arm does not clear triage on this evidence`** —
scoped to the evidence and to the role, and deliberately **not** *"this arm is not a path"*, which would
condemn an arm §AE7 explicitly refuses to condemn and which no measurement supports: a bottom-band score
is a floor (§AD6), silent both on how far below the band the arm sits and on whether it could clear a
band later. The instrument carries that caveat beside the table.

**Correction, from the #161 review: the top band is untouched only in the scorecard's copy.**
`scorecard-template.md`'s top row reads *"Native is the front door"* and nothing else — claim (2),
correctly left alone. But three other copies attach a **custom-side clause to that same band**: Decision
0.5's *"Phase 1b shrinks to the Evidence Bundle path and whatever the scorecard showed native can't do"*,
`AGENT_DOCTOR_ARCHITECTURE.md` §8's *"the custom harness shrinks to the Evidence Bundle path + measured
gaps"*, and `README.md`'s *"custom harness shrinks to Evidence Bundle + gaps"*. Each is a claim about the
**custom** arm read off a **native** number — claim (3) sitting in the top row — and each therefore falls
under the same rule: it stands under (a), and is withdrawn under (b). **The accurate statement is that the
native-side half of EVERY band is untouched**, not that the top band is. All three copies are annotated
accordingly, and this section's first draft was wrong on that point.

**Cell-level record, so this file and the instrument agree on what moved.** In `scorecard-template.md`
§A3.3 the Outcome header gained *"— the arm this band was read on"*; the top cell became `This arm is the
front door` (arm-neutral wording, unchanged claim); the middle became `This arm is lightweight triage
only`, where **`only`** is a new and deliberate restriction carrying (b)'s *"and nothing else"*; the
bottom became `This arm does not clear triage on this evidence` for the reason above.

### AE6. What binds, and when

- **Binding on passes AFTER v12.** This rule is authored with v12's numbers in view. It is not, and
  must never be quoted as, pre-registered against v12.
- **v12 closes with no custom-side prescription.** Both halves of §AD7's disposition that rest on
  measurement are unchanged — *native remains the recommended path on this instance* (native's own
  number) and *the milestone is not met* (Ruling 3, the custom arm's own number). What v12 does **not**
  carry is a prescription to build out the custom deep-diagnosis harness. The middle band's cell was
  the only thing that ever supplied one, and it is withdrawn.
- **Ruling 3 is unaffected**, having conditioned on the custom arm's own number from the start.
- **Written into the instrument** at `scorecard-template.md` §A3.3.
  `scorecard-agent-doctor.md`'s copy is the **v4 pass's record** and is deliberately left as it was: a
  historical scorecard must state the rule it was scored under. `ARCHITECTURE_DECISIONS.md` Decision
  0.5 takes a supersession note pointing here rather than a rewrite.

> **The instrument's copy of the rule is stated arm-neutral and outcome-free, and §AA's guard is why.**
> The first cut of the template edit wrote the rule the way this section writes it — naming native and
> custom, citing `DECISION.md`, §AC4 and §AD4, and quoting this pass's two proportions to explain the
> change. `scorerPacketBlindRule` failed it on four counts (one `repository-path`, three
> `outside-section-pointer`), because the rubric channel reaches every packet — the exact hole §AA
> closed. The prior-run proportions would not have been caught by any pattern and were removed on the
> same reasoning: `benchmark/README.md` scopes the blind rule to prior-run **outcomes**, and two
> proportions in the rubric a scorer reads are prior-run outcomes however they are framed. **The
> general form, worth carrying:** a decision rule and its *derivation* have different audiences — the
> derivation belongs in this file, and only the rule itself, stated without provenance, may cross into
> the instrument. The guard enforces the first half; the second half is a judgement it cannot make.
>
> **And the second half needed making twice.** The #161 review caught the *rewritten* template still
> opening with provenance — *"This column **used to** prescribe building a second harness…"* — which is
> history, not rule, shipped to every scorer in the rubric slice. The guard passed it, exactly as this
> note predicted it would. The rule (a)/(b)/(c) stands without that sentence and the sentence is gone.
> Two drafts in a row put the derivation where the rule belongs, which is the useful measurement here:
> the pull toward explaining a change at the site of the change is strong enough that the guard's blind
> spot needs a named reviewer, not vigilance.

**One surface is deliberately left carrying the retired rule.** `DESIGN.md` §4's ruling **R-21** quotes
*"`< 5/10 → Full custom harness as designed`"* as evidence inside its own argument — that a near-0 score
reached *by construction* (Agent Doctor had layer-1 tools only) would have triggered the project's most
expensive decision from a missing-tools gap rather than from anything measured. The quotation is load
bearing **as a quotation**: R-21 is reasoning about the rule as it stood, and editing it would rewrite the
ruling's own evidence. Same class as `scorecard-agent-doctor.md`, and excused on the same grounds.

### AE7. What this re-derivation cannot establish

- **It neither rescues nor condemns the custom arm.** 0/10 is a floor and floors are the least
  informative result (§AD6). The rule states what would license a build-out; nothing here says the
  custom harness can or cannot reach it.
- **It is not evidence about a replacement for the depth gate.** (c) requires the gate be removed or
  re-derived; what a non-degrading depth mechanism looks like is **unmeasured**. §AD4's rows 12 and 16
  point at *"require the confirming call"*, but no such gate has been built or scored, and #121's
  `REQUIRE_RETRIEVAL_TO_RELEASE` — shipped dormant, release on retrieval rather than on a name — is a
  narrower change and is untested.
- **It licenses no re-run and changes no number.** §T9 governs.
- **It is a rule about this benchmark's decision procedure**, not a platform finding, and inherits every
  transferability caveat in §AD6 unsoftened.

### AE8. Disposition

**The middle band no longer prescribes building the custom deep-diagnosis harness.** Native remains the
recommended path on this instance, the Phase 1b milestone remains unmet, and the custom harness's
build-out is now gated on **its own ≥ 80%** and on **the removal or re-derivation of the depth gate**.

§AD7's item 2 is closed by this section. Items 3 and 5 (#159) and item 4 (#160) remain open.

## AF. The packet generator's instrument defects, repaired (`2026.08.1005`, #157 + #160)

**§A through §AE are unmodified and this section appends to them** — `git log -p
benchmark/DECISION.md` is the check, in the form §W, §Z, §AC, §AD and §AE all used. This closes
§AD7's open item 4 and the two findings deferred from the #156 review.

**No run was fired, no packet was re-scored, no instance was touched, and no v12 number moves.** It
records repairs to the measuring instrument for the pass that comes next.

Artefacts: `benchmark/scripts/build-v12-packets.js` · `benchmark/v12-advance-rulings.json` ·
`benchmark/v12-rows.json` · `test/packetGeneratorParity.test.js`.

### AF1. The twenty dispatched packets are frozen, and the generator now says so in code

`benchmark/scoring-v12/` no longer reproduces from its own generator: §AE re-derived
`scorecard-template.md` §A3.3's band table after the pass was scored, so a rebuild emits twenty files
that differ from the twenty that were read. **Those files are the only record of what the scorers
actually saw**, which is the same ground on which §140's guard exempts `scoring-v4` from its scan.

This was found the way such things are found — by accident. An inspection `require()` of the
generator ran `main()` and silently rewrote all twenty; nothing failed, and only `git status`
showed it. Two independent repairs, because either alone would have let that through: `main()` now
runs only under `require.main === module`, and the writer **refuses to clobber an existing packet**
unless `--force` is passed. Both are pinned by tests.

**The general shape, which is the part worth carrying:** a generator whose inputs are living
documents produces evidence that stops being reproducible the moment an input moves, and the
evidence — not the generator — is the artefact. Freeze the output, not the inputs.

### AF2. §5's operator commentary pre-judged a rubric column, on one arm only

All ten custom rows took a harness HOLD and no native row did, so the `note` field landed almost
entirely on one arm — **and it carried a verdict**: *"an out-of-box table unrelated to this seed's
fixture"* tells the scorer the layer-4 sweep was hollow, which is precisely the `layers_swept`
credibility judgement the scorer exists to reach. The other arm's shortfall was annotated with the
run's own excuse instead (*"the report states L4 and L5 were skipped deliberately"*), and that one
sat inside the **measurement** field — a field whose own preamble states it is derived from the audit
trail *"independently of the report text — never inferred from the report's own prose."* One arm's
shortfall pre-judged as a defect, the other's excused, in a field every v12 scorer read.

**It changed no v12 score and it is not being re-scored** (§T9 governs). It is recorded because it is
a property of the *instrument*, not of a row, and an instrument defect that ships once ships every
time it is reused.

**The rule this produces: a scorer-facing field NAMES the argument of a call and stops there.**
Relevance is the scorer's to judge — and the scorer needs the argument to judge `layers_swept`
credibility at all, so naming it is not optional. The operator's own reading is preserved in a new
`operator_note` field that renders nowhere, and a build-time lint over a declared phrase list fails
the build when a scorer-facing field carries a verdict. As with the blind-rule guards, **a phrase
list too broad simply reddens the build, and that reddening is the signal to write a better phrase**;
there is deliberately no exemption list, because an exemption is a second and silent way to be
unguarded.

### AF3. The redaction damaged meaning in five places, and the fix is structural

Every packet asserts its redaction *"touches paths only … no sentence has lost its meaning."* That
was false in five places, all of them paths the explicit map missed and the **generic sweep** then
substituted prose for, silently:

- all twenty packets rendered setup step 1 as `cd the build output directory && now-sdk install` — a
  command that cannot be run;
- rows 05–08 turned a named unit test into *"the build output directory (main repo) guards the
  construction"*;
- rows 17–20 read *"a repository a repository document §3"*, one substitution cascading into another;
- a golden SDK example and the SDK build-rule reference were both described as a build directory;
- every seed's Fluent-source table row lost its path but kept the bare filename and a dangling
  backtick — cosmetic damage **and** a navigable pointer the guard's patterns cannot see, because
  `.now.ts` is not `.md` and no stem remained to anchor on.

Same text within each seed, so **no cross-arm bias** — quality damage rather than instrument bias.

Three repairs, and the second and third are the ones that matter:

1. Explicit reviewed replacements for each case, written lower-case and capitalised automatically
   where they open a sentence, because the same phrase lands sentence-initial in one seed and
   mid-sentence in another.
2. **Redaction runs over frozen segments** — text a rule produces is invisible to every later rule,
   so a cascade is unreachable rather than absent-for-now. The old chained `String.replace` let rule
   N match inside rule N-1's output, and no amount of care in any single rule prevents that.
3. **The generic sweep no longer emits prose.** It removes the path (so nothing leaks) and plants a
   sentinel that **fails the build** (so no unreviewed sentence ships). A net that quietly
   substitutes is how all five defects shipped: *"the build output directory"* is right for `dist/`
   and wrong for a test file, and nothing distinguished them. Every real redaction is now a line a
   human read in context.

### AF4. Advance rulings now ship in the packets (§AD7 item 4)

§AC4's Ruling 1 fixed seed 05's `fix_usable_unedited` exposure in advance and blind, precisely so no
scorer would improvise it. It lived only in this file, which no scorer may read. Both seed-05 native
scorers flagged the column under-determined for exactly that reason and one named the absence; they
landed on the ruled value independently, so it changed no score, **but that is luck, not compliance**.
§AC4's own *"before the scorers meet it"* was satisfied in time and defeated in delivery.

The generator now reads `v12-advance-rulings.json` and renders **section 3 in every packet** — empty
ones included, so the section's presence carries no signal about the row (§AC7). Three build-time
checks: a ruling matching no row fails the build (declared but shipped to nobody — the #160 failure
mode, one typo away and silent); a ruling missing from a packet it claims fails the build (the defect
was *delivery*, so authorship alone is not the check); and the ruling's `source` pointer into this
file must never render, because a scorer following it lands in the answer key.

### AF5. The scorer is told which arm produced the run, and that is a ruling, not an oversight

Packets state the arm in plain text and carry three structural tells — a JSON body versus markdown
prose, a HOLD block that appears on custom rows only, and `run_id` versus `diagnostic execution`.
`benchmark/README.md` scopes the blind rule to a prior run's **outcomes**, so this is not a violation
of it, and `scoring-v9` carried the identical label. But §AC1's headline is a cross-arm comparison,
so the question deserves an answer rather than an inheritance.

**Ruling: the arm stays visible.** The three structural tells are inherent to what each arm
*produces*. Blinding the label while the body still gives the arm away buys no blindness and costs
the honesty of the claim — a partial blind that is not declared reads as a full one. Normalising the
bodies would remove the tells, and that is worse: it would edit the artefact under test rather than
present it, which the generator already rejects as a design principle for the same reason.

**What this costs, stated plainly.** A scorer who knows the arm can bring a prior about the arm to a
row, and nothing in this pass's design measures whether one did. That exposure is accepted, in
exchange for the label matching what the packet already reveals. **A future pass that wants arm-blind
scoring must normalise the report bodies first** — the label is the cheapest of the four tells and
removing it alone would be theatre.

### AF6. Two copies of the guard's patterns, and now something that looks at both

The generator carries a deliberate copy of the packet guard's path patterns, justified as *"two
independent copies disagreeing is a signal; one shared copy being wrong is invisible."* **The
justification has a hole and the hole was measured:** disagreeing is only a signal if something
looks. Nothing did, and the copies drifted — #143's M4 made the guard's `.md` alternation
case-insensitive and the generator's copy did not inherit it (#155 review, I2).

`test/packetGeneratorParity.test.js` is the thing that looks. It does **not** merge the copies —
both stay independently authored and neither imports the other. It compares them **two ways**, and
both are load-bearing: the stem list as **source text**, and the composed matchers as **behaviour**
over a corpus, the guard's regex rebuilt from its own source. The drift that actually happened lived
in the *alternations*, not in the stem list, so a stem-only diff would have stayed green through the
very defect that motivated the test — a point the review caught before this section could ship the
overclaim. The next divergence reddens the suite instead of surfacing in a packet.

### AF6a. What the review round changed, and the one finding worth generalising

`/code-review` at high effort returned nine findings against the first cut of this work, and all nine
were taken. Three are worth recording because they repeat this section's own lesson — **a guard that
cannot fail is worse than no guard, because it also stops anyone looking**:

- **The freeze guard failed open.** It keyed on the twenty filenames *this run computes*, so a
  manifest edit that changes any of `row`/`arm`/`seed`/`rep` — all of which are in the filename —
  would find nothing existing and write twenty fresh packets beside twenty stale. Re-keyed on what
  the directory *holds* (`row-*.md`), checked before the `mkdir`.
- **The freeze TEST was the accident.** It called the real writer against the real
  `benchmark/scoring-v12/` and relied on the guard under test to stop it. Measured in a sandbox: with
  the directory absent, `npm test` wrote all twenty. The writer now takes `--out` so the guard is
  exercised on a throwaway directory.
- **The require-side-effect test could not fail.** The module was already loaded, so the `require()`
  under test hit the module cache and executed nothing. Now run in a child process, and *verified to
  go red* against a generator with `main(['--force'])` at module scope — the check the first version
  never received.

The other six: the parity overclaim above; a catch-all regex that would attribute *another* seed's
Fluent file to the row under scoring (now checked against the packet's own seed, falling through to
the sentinel rather than guessing); an empty-rulings line telling the scorer to score "by section 1
alone" when the packet directs them to sections 1 **and** 2; rulings themselves bypassing the register
lint — the largest block of operator-authored scorer-facing prose in the packet, and the shipped
ruling already contained a listed phrase; `hold_text` being *subject* to that lint with no available
remedy, since it is transcribed verbatim rather than authored (**the boundary is now declared: the
lint governs what the operator writes, never what the harness said**); and nothing tying a `failed`
terminal to the presence of a validator rejection, so a packet could promise one and show none.

### AF7. Disposition

**No v12 number moves and no row is re-scored.** §AD7's item 4 is closed; items 3 and 5 (#159) remain
open. Sections are renumbered in the generator's output (advance rulings became section 3, so the
report is now section 4), which affects the **next** pass only — `benchmark/scoring-v12/` is frozen
and untouched by this work.

## AG. Both flagged columns are made determinate (`2026.08.1006`, #159)

**§A through §AF are unmodified and this section appends to them** — `git log -p
benchmark/DECISION.md` is the check, in the form §W, §Z, §AC, §AD, §AE and §AF all used. This closes
§AD7's open items **3 and 5**, which were the last two §AD left open.

**No run was fired, no packet was re-scored, no instance was touched, and no v12 number moves.** It
repairs the rubric that the next pass will be scored against.

Artefacts: `benchmark/scorecard-template.md` §A1 (new) and §A2.1 Cases 3–4 (new) ·
`test/rubricClauses.test.js`.

### AG1. The item as filed named one gap; the verdict files hold seven

§AD7 item 3 asks for *"a third clause for a formally-present-but-irrelevant citation"*, and §AD3's
own correction widens it — *"item 3 should be read as covering both columns rather than the evidence
column alone."* Read against the twenty verdict files rather than against the summary, **the ten
flags that fall on those two columns decompose into eight distinct questions**, of which the filed
one is a single case:

| # | question the packet did not answer | rows |
|---|---|---|
| **E-a** | does the column apply at all when the report offers no root cause | 06 |
| **E-b** | per-root-cause or whole-report, when the root causes disagree | 08, 14 |
| **E-c** | a citation formally present but unconnected to the diagnosis — **the filed item** | 10 |
| **E-d** | citations split across report sections rather than sitting in the root-cause entry | 13 |
| **E-e** | a citation to a tool the run never called, and whether the validator settles it | 14 |
| **F-a** | the operation is named and the supplied edit does not perform it | 01 |
| **F-b** | the target is named by kind rather than by name | 20 |
| **F-c** | a report proposing several fixes — score the union, or the repair | 07 |

**Two of the five `fix_usable_unedited` flags were already closed by §AF4 and are not clauses here.**
Rows 17 and 19 flagged that column because §AC4's Ruling 1 was authored blind and then not
delivered; both scorers said so in as many words, and one named the absence. The ruling now ships in
the packet. That leaves F-a, F-b and F-c as the live residue on that column — which is why this
section writes **three** clauses there rather than the none item 3 implies.

Writing E-c alone would have closed one row of five on the column the item names.

**The other four of §AD3's fourteen flags are NOT closed here, and saying so is the point of this
paragraph.** They fall on `root_cause_layer_correct` (rows 07, 14) and `fix_target_correct` (rows 05,
12) — two columns item 3 does not name and this section does not touch. **One of them is a gate
term**, so it carries the same verdict-moving exposure that motivated §A2.1 in the first place. Filed
as **#164** with the four rows' actual questions transcribed, rather than folded in here on the
strength of a resemblance.

> **Corrected during this section's own review round, before merge.** The first cut of §AG1 said the
> fourteen flags decomposed into seven questions and that F-a and F-b were the whole residue. Row 07
> carries **two** flags — §AD3 lists it under `root_cause_layer_correct` *and* `fix_usable_unedited`
> — and only the first was accounted for, so a gate-term flag went missing and the coverage claim
> was overstated on the column §AD3 called the most consequential. F-c is the clause that closes it;
> #164 is where the four genuinely-out-of-scope flags now live. The count that matters, stated once:
> **14 flags — 10 on the two named columns, all 10 now closed; 4 on two unnamed columns, all 4 open.**

### AG2. E-c is the hard one, and the test is structural rather than semantic

The filed case is a citation that is *real* — a genuine tool call, a genuine artifact, present in the
evidence array — and hollow, because the artifact it names has nothing to do with the cause being
argued. "Irrelevant" is the most judgement-shaped word available, and §A2.1's standing claim is that
its clauses ask the scorer to weigh nothing. A clause that reads *"discount a citation the scorer
judges irrelevant"* would have re-imported the judgement it was written to remove.

Three discriminators were available and the choice among them is the substance of this section:

1. **Connection** — the citation counts only if the root-cause statement it is offered under **names
   the artifact cited**. Chosen.
2. **Provenance** — a call the packet records as answering the harness depth HOLD is excluded.
3. **Formalism** — declare the column a presence test and say relevance is not scored.

**Provenance was rejected because it is a rule about this harness, not about evidence.** It fires only
on the arm that takes a HOLD, which is one arm today and possibly neither tomorrow; it would have
written a property of the instrument into the rubric that measures the instrument. It is also, and
this is the sharper objection, *correct for the wrong reason* — the citation in the filed case is
hollow because it is disconnected, and its being HOLD-forced is how it came to be disconnected, not
what makes it so.

**Formalism was rejected because it closes the item by conceding it.** The column exists to score the
diagnostic agent's own evidence rule, and an evidence rule that any call satisfies is not a rule.

**What connection buys, stated as the general shape:** the predicate points at something a reader can
*see* — two passages of one report, and whether a name appearing in one appears in the other. It
never asks whether the citation is *good* evidence, only whether it is evidence for *this* claim. The
clause says outright that the reason a call was made is not part of the test: a call made for some
unrelated purpose that nonetheless names an artifact the root cause names **counts**, and a call made
in perfect good faith that names nothing the root cause names **does not**. That asymmetry is
deliberate and it is what keeps the clause mechanical.

**What it costs.** A diagnosis that is correctly grounded but *loosely worded* — one that reasons from
an artifact without naming it — now scores 0 on this column. That is a real false negative and it is
accepted: naming what you relied on is the cheapest thing a report can do, and a rubric that rewards
it is not asking much.

### AG3. §A1 is a section, not a third case in §A2.1, and the reason generalises

§A2.1's clauses sit under §A2 — *"`passes_gate`, the column the gate actually consumes"* — because
`fix_usable_unedited` is one of the gate's two terms. `evidence_cites_trace_and_config` is not in the
gate expression at all. Filing its clauses in the same place would have made §A2's heading false in
exchange for a smaller diff, and would have told every future scorer that a wrong value on this column
moves the verdict, which it does not.

The five clauses land in a new **§A1**, between §A's column table and §A2. **The binding constraint is
not taxonomy but reach**: the packet generator slices `## A.` to `## B.`, so §A1 ships, and §Z2's rule
holds unchanged — *a clause outside that range is a clause the scorers never see*. §A1 also says in as
many words that the column is **not** a gate term, because a scorer who reads §A2.1 first will
otherwise carry "this changes the verdict" across to a column where it is false.

The ordering problem is real and is fixed in the text: Case 1 asks whether the column has a subject,
Case 2 fixes which root cause is the subject, Cases 3–5 then ask whether a given citation counts.
Entered in the other order, Case 2 and Case 3 can disagree about the same report.

### AG3a. The two sections order their cases differently, and that is deliberate

Both sections now state how their cases combine, and the two statements are **not** the same rule.
The review round found §A2.1 with no combination rule at all — five cases and nothing saying what to
do when two of them point opposite ways, which is under-determination of exactly the kind the section
exists to remove, sitting inside a gate term.

- **§A1 is a pipeline.** Cases 1–2 settle *which root cause* is under evaluation and are never
  revisited; Cases 3–5 alone award the point. The failure mode it guards is a scorer reaching a value
  at Case 2 and stopping, before the tests that do the work have run.
- **§A2.1 is a conjunction.** Case 5 selects *which fix* is under evaluation, and Cases 1–4 are then
  each **necessary** on that fix — the first failure decides, and passing a later case never lifts an
  earlier bar. The failure mode it guards is a fix that names exactly one record and every field it
  changes (Case 2) and still hands the builder a snippet that does not perform the change (Case 3).

**The asymmetry is not an inconsistency; it follows from what the two columns ask.** Evidence is a
property of one claim, so the work is choosing the claim and then testing its citations. Usability is
a conjunction of independent properties of one fix — addressed, specified, applicable, complete — and
any one of them failing makes the fix unusable. Writing one rule for both would have forced the wrong
shape on one of them.

The conjunctive reading is not new law: §Z2 already recorded it for Cases 1–2 — *"Case 1 is phrased
as a **necessary** condition and governs: passing Case 2's address test does not lift Case 1's bar"*
— and noted that reading was load-bearing for two changed cells and *"stated in the derived file
rather than left implicit."* It is now stated in the template, where the scorers are.

### AG4. Item 5 is closed by F-b, and the clause overrides a fact about the run

§AD7 item 5 — *"a target identified by kind rather than by name"* — was left open because it *"did not
recur in a form this pass had to adjudicate."* It did recur, in a shape close enough to decide: row 20
carries both halves of it at once, a value given as a class (`run_as: valid_user`) and a target named
as a table rather than a record.

The clause splits them, and the split is the part worth carrying:

- **A kind-named TARGET scores 0.** Choosing a member of the class is the edit the column asks whether
  the builder can skip.
- **A kind-named VALUE is sent back to Case 1**, not decided here. If the instance holds a value
  answering the description it was obtainable and the run declined to look it up (0); if it holds none,
  Case 1 condition 2 is met and the slot is the builder's to fill (1). Deciding values inside Case 4
  would have contradicted Case 1's explicit finding that demanding an unobtainable value rewards
  fabrication.

**And the withheld-name defence is refused, explicitly.** §Z3 recorded the open case as turning on a
blind-rule token: the run could not name the table because the packet deliberately withheld it. The
clause holds that this changes nothing — *the column scores what the builder AI receives, not what the
run could reasonably have known.* A run that cannot name its target is free to say so; what it may not
do and still score 1 is hand the builder a class.

**This is the one place in §A2.1 where a fact about the run is excluded from the test**, and the
template says so rather than leaving it to be noticed. The ground is that the column's stated consumer
sits downstream of the run and inherits none of its constraints. **It is also, stated plainly, a
harshness**: the blind rule is the instrument's choice, and this clause makes the run carry its cost.
The alternative — a defence available whenever the answer was withheld — makes the column's value a
function of the redaction map, which is worse.

### AG5. What this cannot establish

- **Nothing here measures diagnostic quality, for either arm, in either direction.** §AD's verdict
  stands exactly as published: native 6/10 · 60% · middle band, custom 0/10 · 0% · bottom band, rubric
  totals 51/60 and 9/60, quoted together and never singly.
- **No v12 row is re-scored, and this is a decision rather than an omission.** §T9 governs and §AF7
  restated it. The published values were produced under the rubric as it stood; seven clauses written
  afterwards would re-decide rows whose scorers resolved them by judgement — including at least one
  gate term, where the alternate reading moves an arm's gate figure. Recomputing after seeing the
  flags is the with-rows-in-hand decision §AC4 exists to prevent, and a derived re-reading in §Z3's
  style is available to any future section that wants it, on the same discipline: every cell sourced
  to something a scorer already recorded, no fresh judgement.
- **Determinacy is not correctness.** §AC8's caveat, promoted to a standing limit by §AD3, applies to
  this section without amendment: these clauses decide what the answer *is*, which is a different
  property from whether the answer is *right*. A rubric can be perfectly mechanical and perfectly
  wrong.
- **Nothing establishes that these are the right clauses.** They are mechanical, they were written
  before any pass that will be scored against them, and the ordering is checkable in git. That is the
  whole of the claim. Unlike §Z3, this section does not even have a recompute to point at as evidence
  the clauses were not selected for their result — which is the price of the no-recompute decision
  above, and is recorded here rather than argued away.
- **Eight questions answered is not the count of questions that exist**, and this section learned that
  about itself the hard way. These eight are the ones twenty verdict files exposed **on two columns**;
  four flags on two other columns are untouched (#164), and its own review round found the first cut
  claiming otherwise. A pass with different seeds, a different terminal shape, or a report format not
  yet seen will find more, and the correct response is another clause, not a scorer's judgement call.

### AG6. Disposition

**§AD7 is closed — all five items.** Items 1 and 2 at §AE, item 4 at §AF, items 3 and 5 here.

**That is not the same as "every v12 ambiguity flag is answered", and the two must not be quoted
interchangeably.** §AD7 closed means the items §AD *filed* are disposed of. Ten of §AD3's fourteen
flags are now decided by a clause; the other four are open at **#164**. The correct sentence is *ten
of fourteen, on the two columns item 3 names* — never a bare "the rubric is determinate".

**Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is not
met.** Quote §AD1's figures, both arms, as §AD7 requires.

**The next scored pass is not scheduled, sized or pre-registered by this section**, and running one
against it as though it were would be §U's confound. What it inherits is a rubric whose two most
frequently flagged columns now decide themselves, a stated rule in each for how its cases combine,
and a suite that reddens if either clause set is edited away.

---

## AH. The last four ambiguity flags are made determinate (`2026.08.1007`, #164)

**§A through §AG are unmodified and this section appends to them** — `git log -p
benchmark/DECISION.md` is the check, in the form §W, §Z, §AC, §AD, §AE, §AF and §AG all used. This
closes **#164**, which §AG1 filed rather than folded in, and with it the residue §AG6 was careful not
to call closed.

**No run was fired, no packet was re-scored, no instance was touched, and no v12 number moves.** As
in §AG, it repairs the rubric the next pass will be scored against.

Artefacts: `benchmark/scorecard-template.md` §A2.2 (new), §A2.3 (new), and the §A partial-band note
(superseded in place) · `test/rubricClauses.test.js`.

### AH1. The four flags, read from the verdicts rather than from the summary

§AD3's fourteen flags fall on four columns. §AG closed the ten on `evidence_cites_trace_and_config`
and `fix_usable_unedited`. The four here were transcribed from each verdict's own `### ambiguity`
section, not from `v12-ambiguity-flags.json`, which records *which* column was flagged and not what
the flag asked:

| # | question the packet did not answer | rows | column |
|---|---|---|---|
| **L-a** | a declared layer field contradicted by the finding text — does the column score the **label** or the **substance** | 07 | `root_cause_layer_correct` |
| **L-b** | a shotgunned root-cause list — which entry is the subject, and does an untested hypothesis at the expected layer count | 14 | `root_cause_layer_correct` |
| **T-a** | a fix whose declared `target` / **Target type** field and whose body prose point at different areas | 05, 12 | `fix_target_correct` |
| **T-b** | where the 1/2 and 1/0 boundaries fall, on a band §A made available and located nowhere | 05, 12 | `fix_target_correct` |

Four flags, four questions — unlike §AG1, where ten flags decomposed into eight. Both rows on
`fix_target_correct` raised **both** T-questions, which is why two clauses close four flags here.

### AH2. One principle answers three of the four: score the field the report declared

L-a, T-a and (through T-a) both `fix_target_correct` rows turn on the same shape — **the report says
two things and the packet does not say which one is the answer.** Row 07 declares `Layer` fields
reading 3, 6 and 7 while a finding text names the seed's mechanism in the seed's own terms. Row 05
declares `Target type: Tool definition + wiring` and then proposes an instruction edit as a step
inside that fix. Row 12 declares `target: "lookup_routing_rule tool configuration"` — a miss the seed
spec names in advance — while its `proposed` text says "Verify routing rules table", which is the
right area.

**The clauses score the declared field in all three.** The ground is §AG1's, restated: make the
predicate structural, not semantic. A declared field is a value a scorer *reads*; "does this prose
name the mechanism / touch the area" is a value a scorer *assesses*, and it is the assessing that
produced fourteen flags.

**Two substantive reasons, beyond determinacy.** First, the column is named for the layer, and §T3's
standing finding — *reaching a layer is not diagnosing at it* — is a property of the instrument, not
a defect in it; a substance reading would quietly convert `root_cause_layer_correct` into a second
`fix_target_correct` and score the same thing twice. Second, crediting an area a report merely
brushes past in its body rewards breadth over aim, in two columns whose entire purpose is aim. That
is the same degeneracy AH3 closes from the other side.

> **The cost is real and is not argued away.** A run that understood the defect and filed it under
> the wrong layer number scores 0. Row 07 is close to that case: its Root Cause 2 names the
> instruction–toolset gap as the causal mechanism, under a layer label of 3. The clause holds anyway.
> A benchmark whose gate term can be satisfied by prose the scorer judges sympathetic is not
> measuring what it reports, and the alternative readings were tried in §AC8's terms and produced a
> column no two scorers had to agree on.

### AH3. The shotgun, and why §A1 Case 2 is lifted rather than rewritten

L-b is row 14, and the report is worth quoting structurally because the clause is written against it.
Its `root_causes` array carries **five entries — layers 1, 5, 4, 6 and 7** — while its own
`layers_swept` marks 2, 3, 5, 6 and 7 `NOT_SWEPT`, and the audit trail confirms only `agent_trace`
and `schema_lookup` were ever called. Seed 04's expected layer is 6. The layer-6 entry is
`root_causes[3]`, reads "GenAI stack configuration **may** be misaligned", names no capability, `api`
or provider, and had its config citation rejected by the validator as unsupported.

**Under an any-entry reading that report scores 2 — and so would a report that simply listed all
seven layers.** The column would then measure list length. §A2.2 Case 2 therefore evaluates **the
primary root cause only**, and does so by *lifting §A1 Case 2's selection rule by reference* rather
than restating it: labelled or ranked primary, else first in list, skipping any entry that asserts no
defect exists. Two independently-worded primary rules drift apart on the first copy-edit and then
disagree about the same report, which is a defect this project has already paid for once.

**Two tests are explicitly kept out of the column**, because each is already scored elsewhere and
importing it would charge one defect twice: `layers_swept` marking the named layer `NOT_SWEPT` (its
own column, on its own terms), and a **validator rejection** of the entry's citation (§A1 Case 4,
which governs `evidence_cites_trace_and_config` alone). Row 14 invites both, and the clause refuses
both.

### AH4. The partial band was available and located nowhere

T-b is the plainest of the four. §A made the 1 band available on every seed and then said, of every
seed but 05, that it *"must be justified in `notes` if used"* — which authorises the band without
locating either boundary. Row 05's scorer said so directly: *"the rubric's own note concedes 1 must
be justified in notes if used, which is itself a signal that this band's boundary is not pinned down
for this seed."*

§A2.3 Case 2 fixes all three bands against a value the packet already carries — the seed spec's
`Expected fix target` header row: **2** names the specific target that row names, **1** falls in the
same one of §A's five areas without naming it, **0** falls in a different area. The `notes`
requirement is withdrawn as an authorisation and kept as good practice, and **the old sentence is
quoted in the supersession note rather than deleted**, so a reader can see what changed.

**One addition the area test alone would have got wrong.** Seed 01's expected-target row rules a
reading out in as many words — *"**Not** 'the tool input schema'"* — and that excluded reading sits
*inside* the expected area. A bare area test would award it 1 and make the seed's own named miss
worth a point. Case 2's third band therefore scores 0 for any reading the seed spec explicitly
excludes: a seed that names its decoy is naming a miss, and drawing that line is the seed spec's job,
not the scorer's.

**And the multi-fix rule splits the bands rather than picking a fix.** Where a report proposes
several, the column takes the highest value any single non-hedged fix earns, **with the 1 band
available only from the primary fix.** A later fix can lift the column to 2 by naming the specific
target; it cannot lift it to 1 by naming only the area. The asymmetry with §A2.2 Case 2 — which reads
the primary root cause and nothing else — is deliberate and §A2.3 states its reason: naming a *layer*
or an *area* is free and enumerable, naming the *specific* target is not. §AH5a records what the
first cut of this rule got wrong and how the rows caught it.

### AH5. Two published rows would score differently, and this is stated instead of recomputed

§T9 governs and §AF7 and §AG5 restated it: clauses written after the rows bind the next pass and do
not re-decide this one. **No v12 value in `scorecard-v12.md` is touched.** What the clauses *would*
have done is nonetheless reported here, because a reader is entitled to check whether they were
selected for their result:

| row | arm | column | published | under §A2.2 / §A2.3 | /6 |
|---|---|---|---|---|---|
| 05 | native | `fix_target_correct` | 1 | **0** — declared target is "Tool definition + wiring"; the instruction edit is a step inside it | 2/6 → 1/6 |
| 07 | native | `root_cause_layer_correct` | 0 | 0 — unchanged; declared layers are 3, 6, 7 against an expected 2 | 3/6 |
| 12 | custom | `fix_target_correct` | 0 | 0 — unchanged; declared target is a different area | 0/6 |
| 14 | custom | `root_cause_layer_correct` | 2 | **0** — primary is `root_causes[0]`, layer 1, against an expected 6 | 2/6 → 0/6 |

**Three checks on that table.**

1. **Not arm-biased.** One flip lands on each arm. Rubric totals would read 50/60 native and 7/60
   custom, against the published 51/60 and 9/60.
2. **No gate value moves, in either direction.** `passes_gate` is `root_cause_layer_correct == 2 AND
   fix_usable_unedited == 1`. Row 05 fails it on the layer term before and after; row 14 fails it on
   `fix_usable_unedited = 0` before and after. **§AD1's headline — native 6/10, custom 0/10 — is
   unchanged under these clauses**, and that is a checkable claim rather than a reassurance.
3. **One §AD2 figure would move.** *"Custom scored `root_cause_layer_correct` = 0 on exactly 8 of
   10"* would become 9 of 10, since row 14 was one of the two rows scoring 2. AC-2's refutation
   threshold was ≤7, so the prediction still holds — more comfortably, which is worth noticing given
   §AD2 recorded it as holding "narrowly".

**Both flips are downward.** That is a fact about the clauses and it is recorded rather than
explained away. The defence available is the same one §AG5 offered and no stronger: the clauses are
mechanical, they are written before any pass that will be scored against them, and the ordering is
checkable in git.

### AH5a. What this section's own review round changed, and what the rows changed after that

**Ten findings came back on the branch, and every one of them was a real defect.** They are recorded
here rather than folded silently into the clauses, because three of them falsified a claim this
section had already written down.

**Two provenance leaks were sitting inside the packet slice.** §A's supersession note said *"two v12
rows were flagged on it"* and §A2.2 Case 2 said *"a run has been observed doing exactly that"*. Both
land between `## A.` and `## B.` — copied verbatim into every packet — and both tell a model scorer
that a prior pass exists and that this very rule already moved rows in it. **Neither tripped any of
the four `RUBRIC_PATTERNS`**: they are not score-shaped, not path-shaped, and not section pointers.
The prose was removed, and three patterns were added — `pass-version-token`, `empirically-observed`,
`rows-were-flagged` — each verified to fire on the exact string it was written for and verified inert
on the slice as it now stands. **This is the second blind-rule defect this one section produced**
(§AH6 records the first, the "§E" pointer), and the two together are the argument for #143's guard
being pattern-based *and* for it being widened every time a miss is found.

**§A2.3's first cut contradicted §A2.1 Case 5, on a gate term.** It claimed to designate which fix
Case 5 evaluates. Case 5 already selects its own subject by a different test and, where several fixes
address the seeded defect, requires **all** of them to satisfy its cases — so the two clauses handed
a scorer opposite `fix_usable_unedited` values for the same report. §A2.3 now disclaims the redirect
explicitly: each column selects its own subject, and §A's constraint relates their **values**, not
their subjects.

**§A2.3's 2 band was unreachable on four of the five seeds.** It was defined against the seed spec's
`Expected fix target` header row, and only seed 01's row names a specific target — the other four
print an area verbatim (*"the instruction text"*, *"data seeding"*, *"capability mapping"*,
*"activation"*). Read literally, every full-credit fix on seeds 02–05 would have dropped to the
partial band. The specific target lives in each seed's *Expected diagnosis* section, and the clause
now sends the scorer to both places and says why.

> **And then the rows falsified the repair.** The review's sharpest finding was that §A2.3 adopted a
> highest-value reading while §A2.2 refused the equivalent for root causes, *"with no stated reason
> for the asymmetry"*. The first response was to remove the asymmetry — apply §A2.2's primary-only
> rule to fixes as well. **Re-checking the rows before shipping it showed that rule scores row 07's
> `fix_target_correct` = 0.** That row's FIX-2 names `sn_aia_agent[…].instructions` — seed 02's
> expected target at full specificity — and its scorer called the column determinate at full credit;
> it is only the *second* fix listed. A rule that scores that report 0 is charging it for its layout.
> **The asymmetry was right and the missing thing was its reason**, which is now written into §A2.3:
> naming a layer or an area is free and enumerable, naming the specific target is not, so the
> enumeration hole is closed at the 1 band and left open at the 2 band.

**The largest hole in the section was found by neither the review nor the original pass.** It surfaced
only from re-verifying every `rc = 2` row against the new clauses: **compound declared layers are the
native report format's norm.** Row 01 declares `Layer: 3 (tool script) + 4 (schema)`, row 03 declares
`3 (Tool definition) + 4 (Data schema) + 5 (Data)`, row 13 carries a `3 / 7`. §A2.2 as first written
had no rule for them, so **eight published full-credit rows had no decidable value under the very
clause meant to make the column determinate** — a bigger gap than the two flags the section was filed
to close. A compound is now read on the conjunct naming the expected layer, with the reason it does
not reopen Case 2 stated: the cheapness is in the list, not in the compound.

**The counterfactual in §AH5 was re-derived after all of this and is unchanged** — still two flips,
still one per arm, still no `passes_gate` movement. Every `rc = 2` row's primary root cause and every
nonzero `fix_target_correct` row was checked against the final clauses, not only the four flagged
ones. That the table survived a rule rewrite is worth more than the table did on first writing.

### AH6. What this cannot establish

- **Nothing here measures diagnostic quality, for either arm.** §AD's verdict stands as published:
  native 6/10 · 60% · middle band, custom 0/10 · 0% · bottom band, rubric totals 51/60 and 9/60,
  quoted together and never singly.
- **Determinacy is not correctness.** §AC8's caveat, promoted to a standing limit by §AD3 and applied
  unamended by §AG5, applies here too: these clauses decide what the answer *is*, not whether it is
  *right*. §A2.2 in particular is a deliberate choice to score bookkeeping over understanding, and a
  future pass may show that trade was wrong.
- **Fourteen of fourteen flags decided is not "the rubric is determinate".** It means the flags
  *this* pass raised, on *these* five seeds, with *these* two report formats, now have clauses. §AG5
  learned this about itself the hard way and the lesson is not spent: a pass with different seeds or
  an unseen report shape will find more, and the correct response is another clause, not a scorer's
  judgement call.
- **Two residual exposures are known and left open on purpose**, both stated in the clauses
  themselves rather than closed with rules no observed row motivates. A report proposing five
  *specific* fixes, one per area, earns `fix_target_correct` = **2** on any seed — it has in fact
  named the seeded target, and a rule scoring it 0 would be scoring the report's confidence rather
  than its aim. And a primary root cause declaring all seven layers at once earns
  `root_cause_layer_correct` = **2**, since every reading that would refuse it is a judgement about
  how sincere a compound is. Both are bounds to watch in the next pass, not defences.
- **This section had a defect its own guard caught, which is the argument for the guard.** The first
  cut of §A2.2 pointed a scorer at "§E" for how `layers_swept` is scored. §E sits **outside** the
  `## A.` → `## B.` slice the packet generator copies, so the pointer led out of the packet and
  toward the prior passes' rows and grades. `test/scorerPacketBlindRule.test.js` failed on it before
  the branch left the working tree. A rubric clause is a blind-rule surface like any other channel,
  and #143's guard is the reason that is now true in practice and not only in principle.

### AH7. Disposition

**All fourteen of §AD3's ambiguity flags are now decided by a clause** — ten at §AG, four here. That
sentence is now correct where §AG6's deliberately narrower one was: §AG6 could claim only *ten of
fourteen, on the two columns item 3 names*, and it said so rather than rounding up.

**Both of §A2's gate terms now have clause sets**, at §A2.1 and §A2.2, sitting together under the
section about what the gate consumes. `evidence_cites_trace_and_config` — the one rubric column not
bound to the gate — remains at §A1, and the split is now the file's organising principle rather than
an accident of what was written first.

**Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is not
met.** Quote §AD1's figures, both arms, as §AD7 requires. **This is the sixth consecutive section to
close with the milestone unmet.**

**The next scored pass is still not scheduled, sized or pre-registered**, and §AG5's warning against
running one against a rubric section as though it were a pre-registration applies here unchanged.
What the next pass inherits is a rubric in which every column a v12 scorer flagged now decides
itself, a stated rule in each for how its cases combine and which fix or root cause they bind to, and
a suite that reddens if any clause set is edited away or drifts outside the slice a scorer reads.

## AI. Pre-registration — the v13 determinacy check (`2026.08.1008`, #166)

**Written and committed before a single run fired. §A through §AH are unmodified** — `git log -p
benchmark/DECISION.md` is the check, in the form §W, §Z, §AC, §AE, §AF, §AG and §AH all used. **This
section claims no result.**

It discharges §AH7's standing open item — *"The next scored pass is still not scheduled, sized or
pre-registered"* — a sentence §AG6 and §AH7 both close with. **An earlier draft of this section said
that item "has now closed six consecutive sections (§AC through §AH)" and that was false**: §AC
*discharged* the equivalent §Z6 item by pre-registering v12, and §AD, §AE and §AF do not carry the
sentence at all, so the run is §AG–§AH — two sections, not six. It is corrected here rather than
quietly dropped, because a pre-registration that miscounts its own provenance is the wrong document
to be trusted about a tally. It also takes
§AG5's warning at its word: a rubric section is not a pre-registration, and the clauses at §AG and
§AH do not become a pass by being correct.

**This pass is framed differently from every scored pass before it, and the difference is the point.**
§O, §T and §AD were milestone measurements that also produced rubric information. **v13 is a
determinacy check that also produces milestone figures.** AI1 states what that inverts and Ruling 6 states
what it costs.

### AI1. What this pass decides, and what it does not

**Decides:** whether the clause sets written at §AG and §AH *determine* a value when a scorer meets a
report they were not written against — measured as the packet-level `ambiguous` flag across 20 rows
and the per-column flag tally, against v12's 8-of-20 and fourteen flags (§AD3) and v9's 3-of-12
(§T2's prediction T8).

**Does not decide:**

- **The Phase 1b milestone, by prediction.** §AC's Ruling 3 criterion carries forward unchanged and
  is applied — but **no prediction is filed on it in either direction**, and AI4's Ruling 6 states
  what that does and does not license. This is the deliberate inversion; AI5's non-entry records it
  on the face of the prediction table rather than as an omission a reader has to notice.
- **Whether the clauses are RIGHT.** §AC8's caveat, promoted to a standing limit at §AD3 and applied
  unamended at §AG5 and §AH6, applies here and is the reason this pass is not named a rubric
  validation. Determinacy is a property of the instrument. Correctness is not measured by it.
- **`MAX_EVIDENCE_RETURNS` or `REQUIRE_RETRIEVAL_TO_RELEASE`.** Both frozen — `0` and `false` — for
  §AC1's reason, unchanged: re-opening either inside a scored pass confounds the depth mechanism with
  the arm comparison.
- **Anything about #155's fix as a repair.** AI4's Ruling 5 explains why the single-variable build
  difference is stated as a fact about the pass and not converted into a hypothesis about it.

**The build under test is `2026.08.1003`, and it must carry BOTH #148's and #155's fixes.** Verified
by probe, not by version string (§W7, §AB6).

> **Corrected before merge, by the pre-flight it prescribes.** The first draft of this section named
> the build `2026.08.1008` — this document's own version — and pre-flight item 1 demanded
> `sys_app.version` read it. **A live probe of gpinst01 returned `2026.08.1003`, and the item as
> written was wrong rather than the instance.** `5fb7648` *is* `2026.08.1003`; every version since
> (`1004`–`1007`) is §AE, §AF, §AG and §AH, all documentation. So the instance is four versions
> behind in *string* and zero lines behind in *code*, and item 1 would have demanded a reinstall
> that changes nothing under test purely to make a string match — three paragraphs after this
> sentence forbids trusting version strings. **The section contained the rule and a violation of
> it**, inherited unexamined from §AC7 item 1. This is what pre-flight is for, and it is recorded
> rather than silently repaired.

The relevant fact, measured rather than assumed: `git log 5fb7648..HEAD -- src/` is **empty**, and
`5fb7648` is the commit that published the v12 rows *and* shipped #155. The v12 runs themselves
fired against `2026.08.1001`, before that commit. So the code under test differs from the code v12
measured by exactly one change, on the custom arm's report-validation path, and by nothing else.

> **One anomaly, unexplained and not waved through.** Every `x_snc_troubleshoot` script include on
> gpinst01 reports `sys_updated_on` ≤ **2026-08-02**, while `PaFixReport` demonstrably contains code
> written 2026-08-10. Both are verified; they are not reconciled. The code probe is decisive and
> §W7 already denies timestamps evidential weight, so this blocks nothing — but an install path that
> writes records without touching audit fields is a thing to understand *before* twenty runs rest on
> assumptions about what is deployed. Pre-flight item 11 carries it.

### AI2. Shape and sizing — and why §AC2's justification does not carry

**5 seeds × 2 reps × 2 arms = 20 runs, 10 valid rows per arm.** The number is §AC2's and the v4
shape (§O1). **The reason is not.**

§AC2 justified ten rows per arm with a binomial resolution table — the probability of landing in a
band given a true per-run pass rate. That argument is about resolving a **rate**, and this pass does
not read one. Carrying the number while silently carrying the old justification would be the
quietest kind of error in this file: a figure that looks pre-registered because it was, for a
different question.

**The sizing rationale for v13 is report diversity.** What a determinacy check needs is *unseen
report shapes*, and twenty runs buys the widest set available without changing any fixture: five
seeds × two report formats × two reps. The clauses at §AG and §AH were written against twelve flagged
rows; twenty rows re-derived from fresh runs is the largest sample of fresh shapes obtainable from
the existing seed set.

**§A3.4's 8-valid-run floor is read PER ARM**, stated at §AC2 and named Ruling 2 at §AC4, and it still bites —
below 8 valid rows in an arm, that arm's *gate* figure is not computed (§AC6's table). **The
determinacy tally is separate and is read across all valid rows in both arms combined**, because
`ambiguous` is a property of a packet and a scorer, not of an arm. An arm falling below its floor
therefore suppresses a gate figure without suppressing this pass's primary outcome, and that
asymmetry is decided here rather than in front of the rows.

**What twenty rows still is not: a rate.** §T8's limit is carried verbatim and unamended — twenty
rows, five seeds, one instance, one day, one model, one app version. Two reps per seed per arm
measures a flip. §AC2's binomial table is demoted to exactly one use: bounding what the *incidental*
gate figures at AI4 Ruling 6 can resolve, which is less than a reader who skips this paragraph will
assume.

### AI3. The seed set and the operational conditions

**All five seeds, unchanged.** Seeds 02 and 05 remain qualified per `raw-evidence-seed-qualification-02-05.md`;
that qualification is fixture state only and claims nothing about either harness.

**§AC3's three operational conditions carry forward and all three bind**, restated because an
intervening reinstall resets the first:

1. **Re-read the `sn_aia_trigger_agent_usecase_m2m` gate before run 1.** Do not assume the PATCH
   took, and do not re-apply blind — read, then act.
2. **The three seed-05 probe rows are deleted before run 1 and the deletion is verified by re-query**
   (`e24c49a22b2203d817a6ffbeee91bf16`, `2fac09262b2203d817a6ffbeee91bfa0`,
   `f3ec4d662b2203d817a6ffbeee91bfd5`). Their `short_description` values name the seed-05
   qualification — a blind-rule leak of the §O5 shape, cheapest to close before the pass. The seven
   pre-existing rows stay.
3. **Any procedure that activates a trigger and then exercises it waits for `trigger_flow` to be
   populated and `sys_hub_flow.active` to read `true` first.** Applies to no step of the protocol as
   written — the seed stays inactive — and is recorded so a mid-pass repair does not re-commit
   qualification §3.1's void.

### AI4. The rulings made in advance

Rulings 1–3 carry from §AC unchanged. Rulings 4–6 are new and exist because each is a decision
someone would otherwise make with rows in hand.

**Ruling 1 — seed 05 `fix_usable_unedited` = 1** for a report naming `sn_aia_trigger_configuration.active = false`
and proposing activation, notwithstanding qualification §3.3. Carried verbatim from §AC4, including
its stated cost and its explicit non-generalisation. If `fix_target_correct` = 0, §A's constraint
binds first and this ruling never arises.

**Ruling 2 — the §A3.4 floor is per arm.** Carried. AI2 states the one thing added: it gates arm gate
figures, not the determinacy tally.

**Ruling 3 — the milestone criterion is unchanged:** met iff the custom arm reaches §A3.3's top band,
`sum(passes_gate) / valid runs ≥ 80%`. The *custom ≥ native* reading stays rejected for §AC4's stated
reason — it makes the milestone a function of native's intra-day drift, which §O measured as real.
**The criterion carries; the prediction does not.** Those are separable and Ruling 6 separates them.

**Ruling 4 — what counts as a flag, fixed before any verdict exists.** Two tallies, two mechanical
tests, so that neither can be argued after the packets come back:

- **Row-level.** A row is ambiguous iff its verdict header table's `ambiguous` field reads `yes`.
  This is §AC5's AC-5 definition — the broad reading, ambiguity anywhere in the row — and the
  narrower gate-only reading recorded at §T2 is **not** the one measured and may not be substituted
  afterwards.
- **Column-level.** A column flag is counted iff the verdict's `### ambiguity` prose **names that
  column as under-determined**. Those sections are prose that argues both readings, so every column
  gets mentioned and **no regex can tell "named" from "discussed"** — this is exactly the parse that
  produced the miscount §AD3 had to correct before merge.

  **The scan domain is the rows whose header reads `ambiguous = yes`, and no others.** This is not a
  refinement, it is the difference between comparable and incomparable numbers: `v12-ambiguity-flags.json`
  was curated *only* from the twelve flagged verdicts, while **all twenty** v12 verdicts carry an
  `### ambiguity` section — row 09 reads `ambiguous = no` and still discusses and rejects a second
  reading. A v13 curator scanning all twenty would count rows the v12 baseline excluded, and AI-2 and
  AI-3 would be scored against a denominator different from the one they name. The tally is
  **curated by hand into `benchmark/v13-ambiguity-flags.json`**, in the form and with the `_why`/`_verified` header
  `v12-ambiguity-flags.json` carries, and bound to the scorecard by a test in that file's pattern.

**Ruling 5 — the single-variable build difference is a fact about the pass, not a hypothesis in it.**
AI1 records that the code differs from v12's by #155 alone. It is tempting to convert that into a
custom-arm prediction, and this section declines, for a reason worth stating: **the two arms are not
symmetric under this pass.** Custom changes by one code fix **and** by the new clauses; native
changes by the clauses **only**. So a native delta from §AD1 is attributable to the rubric alone,
and a custom delta is attributable to neither cause without an argument this pass cannot supply from
twenty rows. Filing a prediction on a confounded quantity would produce a confirmation or a
refutation that means nothing, and this file has enough of those it has had to correct.

**Ruling 6 — the incidental gate figures: published, applied, unpredicted.** Deciding all three in
advance, because each is a place a later reader could be told a different story:

- **Published.** Both arms' `passes_gate` proportions and rubric totals are reported, together,
  never singly, per §AD7 — **whatever they say**. Not predicting an outcome is not a licence to
  report it selectively, and a pass that produced milestone figures and buried them would be a worse
  instrument than one that never ran.
- **Applied.** Ruling 3's criterion is evaluated against them. If custom reaches ≥80%, **the
  milestone is met** and this section's framing does not get to override that. A criterion fixed in
  advance does not require a prediction to be binding.
- **Unpredicted.** No prediction is filed on the gate, so **v13 may not claim a confirmed or refuted
  prediction about the milestone in either direction**, and its gate figures carry the resolution
  §AC2's binomial table describes and no more. §AC5's AC-9 was filed against the project's preferred
  outcome on purpose; withholding it here is a different choice, made for AI5's stated reason, and
  the trade is that this pass loses AC-9's evidential value about the prior.

### AI5. The predictions — all on determinacy, none on the gate

Filed here, before any run. Refutation criteria are stated for each; a prediction with no stated
refutation is not one.

| | Prediction | What refutes it |
|---|---|---|
| **AI-1** | **≥ 80% of valid rows** return `ambiguous = no` under Ruling 4's row test — **16 of 20 at the full denominator** — against v12's 8 of 20 = 40% (§AD3) and v9's 3 of 12 = 25% (§T2's T8) | < 80% of valid rows. This is the pass's primary outcome and the one most worth failing |
| **AI-2** | **≤ 0.20 column flags per valid row** under Ruling 4's column test — **≤ 4 at the full denominator** — against v12's 14 over 20 = 0.70 | > 0.20 per valid row |
| **AI-3** | **≤ 0.10 column flags per valid row** fall on `evidence_cites_trace_and_config` and `fix_usable_unedited` combined — **≤ 2 at the full denominator** — the two columns §AG closed, which drew 10 of v12's 14 | > 0.10 per valid row |
| **AI-4** | **Neither** of §AH6's two named residual exposures occurs in 20 rows: no report proposes five *specific* fixes one per area, and no primary root cause declares all seven layers at once | Either shape occurs in any row. §AH6 called both "bounds to watch in the next pass"; this is the watching |
| **AI-5** | **Compound declared layers recur on ≥ 1 native row** — §AH5a found them to be the native format's norm (rows 01, 03, 13), and the compound clause was written after the fact | Zero native rows carry a compound. **Filed knowing it is close to certain** — 3 of 10 v12 native rows carried one, so P(zero across 10) ≈ 3%. It is a *tripwire on the clause's applicability*, not a discriminating prediction, and it is not counted toward this section's claim to have filed six meaningful ones. §AC5's AC-9 standard is what it fails |
| **AI-6** | **≤ 2 void rows encountered** across the pass, and every arm finishes with **10 valid rows** | ≥ 3 encountered, or any arm below 10 valid. Stated on voids *encountered* rather than surviving, per AC-8's reason: **§AI6** (the stopping rule, not this prediction) re-runs them |
| **—** | **No prediction is filed on `passes_gate`, either arm, either direction.** Recorded as a row so the withholding is visible on the table rather than inferred from its absence | Nothing. Ruling 6 governs what may be said about the figures it produces anyway |

### AI6. The stopping rule

**Fixed `n` = 20 runs. The pass does not extend and does not stop early.** §AC6's reasoning carries:
every run produces a scorable row unless void, so the denominator is fixed by construction.

**AI-4 and AI-5 are read off the REPORTS, and are therefore sealed too.** Both are evaluated against
report *shape* — five specific fixes one per area, a seven-layer primary root cause, a compound
declared layer — and the operator necessarily reads every report while running the pass and building
the packets. Without this clause AI-5 could be confirmed at run 3, mid-pass, with nothing forbidding
it, while the section declared its stopping rule to be about a different quantity entirely. **No
prediction of any kind is evaluated until all twenty runs have terminated and all twenty packets have
been scored and returned.** The seal covers the tallies below and these two equally.

**One addition, and it is this pass's most result-sensitive commitment.** §AC6 forbade computing any
score, `passes_gate` or arm total while runs remained. **Under a determinacy framing the ambiguity
tally is the outcome, so it inherits the same protection:** no row-level `ambiguous` count and no
column-flag tally is computed, curated or glanced at until all twenty packets have been scored and
returned. §U8.5's ruling is what governs — *"Continuing because the split is tied is optional
stopping at the most result-sensitive moment there is"* — and the quantity it now protects is a new
one. An operator who tallies flags at row twelve has broken this pass in the way §AC6 says a careless
operator can break silently.

**Void handling, decided now**, carried from §AC6: a void row is re-run rather than absorbed, and
both the void and its replacement are recorded. **Re-runs reaching 3 in one arm is a cost stop, not a
verdict** — stop re-running that arm, close the pass with what is valid, then apply §A3.4 to that
arm's valid row count (10 evaluable normally; 9 or 8 evaluable with the void reasons stated; below 8
report *gate not evaluable — insufficient data* and compute no verdict from the survivors). Per AI2,
the determinacy tally still reads every valid row. An operator error is still a void, still re-run,
and recorded in the raw-evidence file (§O5's precedent).

**Packets are built after all 20 runs terminate, and the scorers are dispatched once.**

### AI7. Protocol and pre-flight

**Sequencing: interleaved by seed** — native rep 1, custom rep 1, native rep 2, custom rep 2, per
seed, strictly sequential, one day, one deployed version. Interleaving spreads intra-day model drift
across both arms instead of aligning it with the arm boundary (§O1).

**Run identity is verified, not inferred** — each row's `conversation_ref` queried directly and
confirmed distinct (`PaRunAnchor`'s 30-minute fallback makes interleaving a hazard here, §O1).

**Scorer topology is fixed to match v9 and v12: independent agents, one per packet, redacted
packets.** §O5 measured topology moving the result by about two rows, so it is held constant or the
comparison to v12's 8-of-20 is meaningless — and that comparison is this pass's entire primary
outcome, which raises the stakes on topology above where §AC7 had them.

**Pre-flight, every item verified by probe before run 1:**

1. **The installed code is repo HEAD's `src/`** — two probes, neither a version string. `sys_app.version`
   reads **`2026.08.1003`** (the `5fb7648` build), **and** `git log 5fb7648..HEAD -- src/` is empty.
   The second is the one that binds; the first is recorded to catch an unexpected reinstall. **A
   version reading `1004`–`1008` is not a failure** — those are documentation versions and the
   second probe still decides.
2. **#148's fix present** in the installed `PaFixReport`, by
   `PaFixReport^scriptLIKEthe presence requirement is stated FIRST` → 1 record. A draft of this item
   said only "by `scriptLIKE` probe against the fixed wording" and named nothing — precisely the gap
   §W7 exists to close, since an improvised substring can also match pre-#148 `PaFixReport` and pass
   a gate that should fail.
3. **#155's fix present**, by `PaFixReport^scriptLIKE_withCanonicalLayersSwept` → 1 record. The
   method name is distinctive and was introduced by that fix; this is the probe the single-variable
   claim at AI1 rests on, and it is the one item here whose absence invalidates the framing rather
   than just the run.
4. `PaAgentLoop^scriptLIKEMAX_EVIDENCE_RETURNS: 0` → 1 record.
5. `PaAgentLoop^scriptLIKEREQUIRE_RETRIEVAL_TO_RELEASE: false` → 1 record.
6. **All five seeds' §A3 fixture conditions re-read live** — including seed 05's m2m gate (AI3.1) and
   seed 04's capability sys_id matching the instance's `sys_one_extend_capability` record.
7. The three seed-05 probe rows are gone (AI3.2), by re-query.
8. `layers_available` read by **two independent paths** — `sn_aia_agent_tool_m2m` for native,
   `PaToolRegistry`'s own registry read for custom — not one value asserted for both (§O1).
9. Budget knobs read fresh: `sn_aia.continuous_tool_execution_limit` and `max_auto_executions` (§T1).
10. Smoke gate fired and passed on **both** arms before any scored row is spent.

**The blind-rule guard must be told about `scoring-v13/` as part of building the packets, not after.**
§AC7's finding holds unchanged and the same three edits are needed before the suite goes green:
add the `PACKET_SETS` entry (`dir: 'scoring-v13'`, `scanned: true`, a `why`, and a real `packets:`
count — the per-set test asserts the on-disk `row-NN-*.md` count equals it); update the hardcoded
membership literal in the same test to include `'scoring-v13'`; run `npm test` and confirm green
before the first packet reaches a scorer. Navigate by test name — §AC7 pinned a line number that had
already drifted.

**One addition §AC7 did not need.** §AH5a found **two provenance leaks inside the packet slice** that
tripped none of the then-existing `RUBRIC_PATTERNS`, and added three patterns for them
(`pass-version-token`, `empirically-observed`, `rows-were-flagged`). The v13 slice now carries §A2.2
and §A2.3, written after those patterns existed but never yet exposed to a packet build. **The slice
is re-scanned as part of pre-flight, not assumed clean because the suite was green when the clauses
were merged.** §AH6's own summary of this — that §AH produced two blind-rule defects in one section —
is the reason.

**Two build-side gates, added after review found the pass could not be executed as first written.**
Both are pre-flight items and both must be green before run 1, not discovered after twenty runs
terminate:

11. **A v13 advance-rulings channel exists** — `benchmark/v13-advance-rulings.json`, carrying
    Ruling 1 in the `v12-advance-rulings.json` shape (`id`, `source`, `column`, `applies_to`,
    `heading`, `text`), and the generator renders it into every seed-05 packet. **§AD5's standing
    rule is that an advance ruling on a scoring column must ship in the packets, not only in the
    pre-registration** — that is #160, and §AG1 records what its absence cost in v12: rows 17 and 19
    flagged `fix_usable_unedited` *because the ruling never reached the scorer*. Two such flags land
    AI-3 exactly on its refutation boundary, so an undelivered Ruling 1 would refute a prediction
    about the rubric using a defect in the delivery. The first draft of this section named no such
    file and re-opened the defect #160 closed.
12. **A v13-capable packet generator exists and has been exercised on a throwaway `--out`.**
    `benchmark/scripts/build-v12-packets.js` hardcodes `OUT = scoring-v12`, `REPORTS = v12-reports`
    and reads `v12-rows.json` / `v12-advance-rulings.json`, and its header reads *"scoring-v12/ IS
    FROZEN. PASS --force TO WRITE OVER IT, AND DO NOT."* — `--out` exists only to exercise the
    freeze check. **There is therefore no path from v13 reports to v13 packets**, and the nearest
    tool either refuses to write or overwrites dispatched, scored v12 evidence. Generalising it to
    take a pass version (rows, rulings, reports, out) is **work that must be done and verified
    before run 1**, because §AI6 forbids touching packets until all twenty runs have terminated —
    the operator would hit this at the worst possible moment.

**Artefacts.** Measurements → `benchmark/raw-evidence-v13-determinacy-check.md`. Rows →
`benchmark/scorecard-v13.md` and `benchmark/v13-rows.json`. Reports verbatim →
`benchmark/v13-reports/`. Advance rulings → `benchmark/v13-advance-rulings.json` (item 11). Packets
exactly as scored → `benchmark/scoring-v13/`. Flag tally → `benchmark/v13-ambiguity-flags.json`
(Ruling 4). Operator records are **outside** the scorer-facing channel by the guard's own
declaration and must never be pasted into a packet.

### AI8. What this pass cannot establish

Everything in §T8, §Z5, §AB5, §AC8, §AG5 and §AH6 stands, unsoftened. Four limits are specific to
this pass and the first is the one that matters most.

- **It tests the clauses on the distribution they were fit to.** Same five seeds, same two report
  formats, same instance. §AG and §AH were written against twelve flagged rows drawn from exactly
  this population. **A strong AI-1 is therefore the MINIMUM the clauses must clear, not evidence
  that the rubric is determinate in general** — it is close to an in-sample check, and §AH6 said the
  quiet part already: *"a pass with different seeds or an unseen report shape will find more."*
  A weak AI-1 would be damning; a strong one is merely not disqualifying. Any future quotation of
  this pass that drops this bullet is a misquotation.
- **Determinacy is not correctness.** Promoted to a standing limit at §AD3, applied unamended at
  §AG5 and §AH6, and applying here with more force than anywhere it has been written before, because
  determinacy is now the *headline* rather than a secondary reading. §A2.2 in particular is a
  deliberate choice to score bookkeeping over understanding, and this pass cannot show that trade was
  right — only that it is decidable.
- **The gate figures carry no predictive weight.** Ruling 6. They are published and the criterion is
  applied, but v13 confirms and refutes nothing about the milestone, and its figures resolve a band
  only as well as §AC2's table allows.
- **It cannot establish transferability, and it does not license a re-run.** One instance, one model,
  one day, one app version. §T9's *"Do not re-run this pass to get a firmer number"* applies to this
  pass as it did to v9 and v12; a result near a threshold is reported as near a threshold.

### AI9. Disposition

**This section contains no measurement.** It fixes a frame, a size and its new rationale, six
rulings, six predictions and one recorded non-prediction, a stopping rule that now protects a flag
tally, and a pre-flight whose third item the framing depends on.

**Unchanged at the time of writing: native remains the recommended path on this instance, and the
Phase 1b milestone is not met.** Quote §AD1's figures for both arms together, never singly (§AD7) —
native 6/10 · 60% · middle band, custom 0/10 · 0% · bottom band, rubric totals 51/60 and 9/60.
**The ordinal is deliberately not stated.** A draft of this section claimed "the seventh consecutive
section to close with the milestone unmet"; it was inherited from §AH7's "sixth" by adding one, and
it does not survive a grep — §AF7 does not carry the sentence, which breaks any consecutive run, and
the sections that do carry it (§Z6, §AA, §AB, §AC8, §AD1, §AE8, §AG6, §AH7) do not yield six then
seven under any consistent rule. §AD1's "fifth" is the last one that reconciles. **The fact needs no
ordinal**: the milestone is unmet, it has been unmet in every section since §Z6, and a running tally
this file cannot verify is exactly the kind of decorative precision a determinacy check should not
be introducing.

---

## AJ. v13 — the determinacy check, scored

**Scorecard:** `scorecard-v13.md` (20 rows: 10 native + 10 custom, 0 void in the scored set) ·
**Rows:** `v13-rows.json` · **Reports:** `v13-reports/` · **Packets as scored:** `scoring-v13/` ·
**Verdicts:** `scoring-v13/results/` · **Flags:** `v13-ambiguity-flags.json` · **Issue:** #166

Pre-registered at §AI, merged in `ed0b6c2` before run 1. Fired 2026-08-11 in one sitting, interleaved
by seed per §AI7, on build `5fb7648` verified by probe.

### AJ1. The predictions, all six resolved

| | Prediction | Threshold | Measured | Verdict |
|---|---|---|---|---|
| **AI-1** | ≥ 80% of valid rows return `ambiguous = no` | ≥ 16 of 20 | **20 of 20 (100%)** | **CONFIRMED** |
| **AI-2** | ≤ 0.20 column flags per valid row | ≤ 4 | **0 (0.00/row)** | **CONFIRMED** |
| **AI-3** | ≤ 0.10 per valid row on `evidence_cites_trace_and_config` + `fix_usable_unedited` | ≤ 2 | **0** | **CONFIRMED** |
| **AI-4** | Neither of §AH6's residual exposures occurs | 0 occurrences | **0** — max fixes in any report is 5 (row 03), spanning **three** areas not five; no primary declares seven layers | **CONFIRMED** |
| **AI-5** | Compound declared layers recur on ≥ 1 native row | ≥ 1 | rows 01 and 03 | **CONFIRMED** (tripwire, not discriminating — §AI5's own note) |
| **AI-6** | ≤ 2 voids encountered, both arms finish at 10 valid | ≤ 2 / 10 each | **1 void; 10 and 10** | **CONFIRMED** |

Six of six confirmed. **That uniformity is itself the finding to be careful about**, and §AJ3 is
where the care goes.

### AJ2. The gate, published under Ruling 6

Both figures, together, per §AD7 — **native 4/10 = 40.0% (47/60 points); custom 0/10 = 0.0%
(5/60)**. Against v12 on the same seeds: **native 6/10 = 60.0% (51/60); custom 0/10 = 0.0% (9/60)**.

**The native arm therefore DECLINED by two rows, 60.0% → 40.0%**, and the custom arm held at 0.0%
while losing four points.

> **Correction, found in review before merge.** This paragraph first published v12's native baseline
> as 3/10 = 30.0% and called the change a one-row improvement. **3/10 is §O2's v4 figure**, not
> v12's — v12's native result is 6/10, published at `scorecard-v12.md` and §AD1 and pinned by
> `test/scorecardV12Tallies.test.js`. §AG/§AH fix that no v12 number moves, so there was never a
> re-scored 3/10 to mean. The direction of the headline change was reported backwards, and the
> resolution argument below is rewritten accordingly rather than patched.

**Ruling 3's milestone criterion is evaluated and NOT met** — it requires the custom arm at ≥ 80%.
Per Ruling 6 no prediction was filed on the gate, so v13 claims **no** confirmed or refuted
prediction about the milestone in either direction. §A3.4's floor is satisfied on both arms.

**Ruling 5 holds and is now load-bearing — and it cuts the other way from the first draft.** Custom
changed by #155's fix *and* by the new clauses; native changed by the clauses **only**. So the
native movement is the attributable one, and it is a **two-row decline on ten** (60.0% → 40.0%,
51/60 → 47/60).

Two rows on ten is still inside the resolution §AC2's binomial table describes, so this is not a
demonstrated regression — but it is the opposite sign from what a pass that confirmed all six of its
determinacy predictions might be assumed to show, and **that asymmetry is the point of separating
the two quantities.** The clauses were written to make scoring determinate, not to make runs score
better; a rubric that resolves more cases can resolve them *against* a run. Rows 09, 11, 13 and 15
are where it shows: each scores `root_cause_layer_correct` = 2 and `fix_target_correct` = 2 and
still fails the gate on `fix_usable_unedited`, three of them on §A2.1 Case 1 — a value the instance
held and the run declined to look up. That clause is §AG's, and it is doing exactly what it says.

Custom's 0.0% remains attributable to neither cause on this evidence. Neither arm's number is a
result about capability.

**#155's fix is visible in the rows and did not move the gate.** Two custom rows terminated
`failed (fix_report rejected, could not be repaired)`, on two *different* validator rules — row 04
an unsupported sweep claim, row 16 an evidence-count shortfall. Both scored 0/6, as did four custom
rows whose reports were accepted. The validator rejects report *shape*; **nine of ten** custom rows
missed on `root_cause_layer_correct`, which is upstream of shape. (An earlier draft said eight —
v12's count. Row 12 is the sole custom row above 0 on that column.)

### AJ3. Zero flags is the measured value, and three things bound what it means

AI-1 was the pass's primary outcome and it cleared its threshold by 20 points. §AI8 already said how
that must be read — *"a strong AI-1 is the MINIMUM the clauses must clear, not evidence that the
rubric is determinate in general"* — and this pass supplies its own reasons to hold that line.

- **It is close to an in-sample check.** Same five seeds, same two report formats, same instance.
  §AG and §AH were fit to twelve flagged rows drawn from exactly this population.
- **Two verdicts record a close call in prose and did not flag it.** Row 04's scorer states it "had
  to choose between two readings of §A1 Case 3" and resolved on the case's own words. Row 05's works
  through §A2.3's 1-band-primary-only restriction at length, states that applying it literally
  yields 0, and awards 1 on the rule's stated purpose. Under Ruling 4 neither is a flag — the header
  said `no` — and that is the rule, applied. **But a clause that a scorer has to argue itself into
  is not obviously the same thing as a clause that is determinate**, and this pass cannot tell the
  two apart. It is the open question v14 inherits.
- **A count of zero cannot separate "no ambiguity" from "no ambiguity declared."** The comparison to
  v12's twelve is worth something *because* both were produced under the same instruction; it is
  still a comparison of two counts, not a measurement of the property.

Ruling 4's scan-domain clause turned out to be moot rather than wrong: it fixes the column-flag
denominator as the rows reading `ambiguous = yes`, and there were none. Recorded because §AI4 wrote
it specifically so a v13 curator could not widen the denominator after the fact, and the guard held
without ever being tested.

### AJ4. The void, and a rule §A3 did not have

Row 05 native's first attempt terminated `state_reason: execution_failed` with no report, after four
consecutive ReAct turns of 68–86s against a ~13s LLM P95, with the tool ceiling unreached and every
fixture intact. §A3's void definition is seed-state only, and the seed was in state — so the letter
made it a valid row scoring zero on an absent report, while §A3's own title ("a run that measured
nothing") made it a void.

Ruled **void**, and the ruling was **committed before the replacement fired** (`77d0d44`), binding
**both arms symmetrically**. §AI6 seals tallies so that a classification cannot be made once its
effect is visible; here the effect genuinely cut both ways — the void removed a row that would have
scored 0, and spent one of three permitted re-runs. **§A3 should carry this condition explicitly
rather than leaving the next operator to re-derive it under time pressure**, and that is filed as
work rather than asserted as done here.

### AJ5. Five operator findings, recorded because each cost or would cost a session

1. **`servicenow_query` returns UTC; `servicenow_aia_trace` returns instance-local.** §1's clock
   convention attributed local time to plan rows generally, which holds only on the trace path.
2. **`sn_aia_execution_plan.agent` returns the reference sys_id, not a display name.** The stale
   evidence block claimed otherwise; plan→seed mapping is by sys_id unless `displayValue` is asked for.
3. **§3.3's "order by `sys_created_on`" is not deterministic under ties.** On row 11 the report and
   the platform boilerplate share a second and the boilerplate sorted first. Harmless here; a live
   hazard on any row whose report genuinely spans two messages in the same second.
4. **Seed-05 native runs write TWO `x_snc_troubleshoot_run` audit rows** with identical
   `execution_ref` and `conversation_ref` (rows 17 and 19; TR1000285/286 and TR1000288/289). The
   eight non-seed-05 native rows wrote one each. The pattern tracks the invocation shape, not the arm.
5. **§3.2's custom-arm seed-05 instruction is ambiguous and was resolved against the handler.** Read
   literally it puts the whole objective into `agent`; `PaRestHandlers` passes `body.agent` through as
   the agent identifier and v12's row-18 body carried three keys (`agent`, `timeframe`, `note`).
   Resolved by putting the agent NAME in `agent` and the prose in `note`, and confirmed at runtime —
   the harness called `agent_trace` with `{agent, since, until}` and matched `sn_aia_agent` on name.

### AJ5a. Two defects in the instrument, found in review AFTER the packets were scored

Both reached all twenty blind scorers. Neither is repaired in `scoring-v13/`, on the same ground
that freezes `scoring-v4` and `scoring-v12`: **those files are the record of what the scorers
actually read, and editing them to satisfy a later finding destroys the only thing they preserve.**
The generator is fixed; the packets are not.

- **A false pass-level claim, hardcoded.** `build-packets.js` emitted, unconditionally, *"This run
  reached a terminal state and was not re-run. No row in this pass was void, and no arm used any of
  its permitted re-runs."* True of v12. **False of v13** — one row was ruled void and one native
  re-run was spent (§AJ4) — and doubly false inside row 05's own packet, because row 05 **is** the
  replacement. Generalising the script to `--pass` carried a v12-specific fact into a pass it did
  not describe. The generator now states only what it can see: this row's terminal state, and
  whether this row is a replacement (`rerun_of` in the manifest). **A generator that renders one row
  may not assert facts about the pass.**
- **The instrument was not constant across rows, while the packet said it was.** `buildPacket`
  renders `row.note` and never `row.operator_note` — deliberately, and a guard enforces it. But
  row 03's "report delivered across TWO messages, concatenated per §3.3 rule 3" was authored into
  `note` and reached its scorer, while row 05's identical fact was authored into `operator_note`, so
  row 05's packet reads *"No run-specific notes."* Two rows whose reports were assembled the same
  way presented differently. That is an **authoring** inconsistency in this pass's row manifest, not
  a generator bug, and it sits underneath boilerplate asserting *"Every packet in this pass carries
  the same fields, so the instrument is constant across rows."* Related: the five off-fixture HOLD
  arguments (rows 06, 08, 10, 12, 16) live in `operator_note` and are correctly withheld — but the
  same boilerplate promises such an argument would be "named in section 6 instead", and it is not.

**What this costs the pass, stated rather than minimised.** Neither defect touches a scored column:
the false line makes a claim about voids that no rubric column reads, and the missing note concerns
report assembly rather than diagnostic content. But *"the instrument is constant across rows"* is
now a claim v13 cannot make without this paragraph attached, and any future pass quoting v13's
determinacy figures inherits the qualification.

### AJ6. What v13 does not establish

Everything in §T8, §Z5, §AB5, §AC8, §AG5, §AH6 and §AI8 stands unsoftened. Adding two:

- **Six-for-six confirmation on predictions the same author filed and then measured is weak
  evidence, and stronger-sounding than it is.** AI-5 was filed at ~97% prior by its own note. AI-4
  and AI-6 are bounds on shapes that did not occur in v12 either. The pass's informative content is
  AI-1/2/3, and those three are the ones §AJ3's in-sample caveat bites hardest on.
- **Five custom rows answered a layer HOLD off-fixture** — against `incident.priority`,
  `incident.assignment_group`, `sn_aia_agent_tool_m2m`, or the invented `sysrule_routing` — which the
  row notes record as measured. Whether that is a harness defect, a model defect, or a rubric that
  rewards reaching a layer over diagnosing at it is **not** settled by this pass, and the
  `layers_swept` HOLD mechanism is the obvious place to look next.

**The next pass should change the distribution, not the clauses.** §AI8 said an out-of-sample check
is what would make AI-1 mean what a reader will want it to mean; v13 has now spent the in-sample one.

---

## AK. §A3 carries the terminated-run void condition (`2026.08.1105`, #174)

**§A through §AJ are unmodified and this section appends to them** — `git log -p benchmark/DECISION.md`
is the check, in the form §W, §Z, §AC, §AD, §AE and §AF all used.

**§T9 governs: no v12 or v13 value moves.** No run was fired, no packet was re-scored, no instance
was touched. Row 05's void ruling stands exactly as it was made; this section records the promotion
of the rule that governed it, and does not re-decide the row.

Artefacts: `benchmark/scorecard-template.md` §A3.

### AK1. The gap, and what closes it

§AJ4 recorded that v13's row 05 native terminated `state_reason: execution_failed` with no report,
and that §A3 did not name the condition — its definition is seed-state only (*"the seed was not in
the state its spec requires"*) and both listed conditions come from seed specs. The ruling was
authored mid-pass at §4.1 of `benchmark/raw-evidence-v13-determinacy-check.md`, with rows in flight.

§AJ4 also recorded the two properties that made that ruling sound rather than convenient: it was
**symmetric** across arms, and it was **committed before the replacement fired** (`77d0d44`), so
`git log -p` shows the rule predating the row it governs. Both properties are now written into §A3
as **requirements on the operator**, not as remarks about one pass — the third bullet states the
condition, and clauses (a) and (b) state what must hold for it to be invoked at all.

The defect being closed is not the ruling. It is that a void condition lived in one pass's evidence
file, so the next operator meets the same terminal state with nothing standing to apply, and meets
it — as v13 did — under time pressure. A classification authored while its effect on a visible tally
can be estimated is exactly what §AI6's seal exists to prevent; a standing rule is what removes the
authoring step.

### AK2. Why the provenance is in THIS section and not in §A3

§A3 is inside the `## A.` → `## B.` slice copied verbatim into every scorer packet, and
`test/scorerPacketBlindRule.test.js` scans that slice (§AA, #143 + #164). Four of its patterns ban
precisely the citation #174 asked for: `outside-section-pointer` rejects any `§` that is not a
self-reference into §A*, `pass-version-token` rejects a pass named by version, PACKET_PATTERNS
rejects a repository path, and `empirically-observed` rejects the past tense that says a run
actually did this. A pointer to §AJ4 inside §A3 would tell a model scorer that a prior pass exists,
that this rule already voided a row in it, and where to go and read the grades.

So the rule and its provenance are deliberately split: the standing rule is in §A3 in
provenance-free voice; the citation is here. The general shape, stated because the next promotion
into §A–§A3 meets it again: **a rule that reaches a scorer cannot carry its own history.** Anything
promoted into the packet slice has to be rewritten into the standing voice first, and the audit
trail parked outside the slice — the guard is not an obstacle to routing around, it is the
statement of that constraint.

§A3.4's floor was checked as #174 required. It reads correctly with the new condition present, and
two clauses that were only ever stated in the decision record are promoted alongside it, because a
run-state void makes both live for the first time: the floor is read **per arm** (§AC2, Ruling 2 at
§AC4, carried at §AI2), and it counts **unrecoverable** voids at the close of the pass, not voids
encountered along the way (§AC2). Under the old seed-state-only reading a void was a setup error
found before or around a run; a terminated execution is a void that can now arise on any row of
either arm mid-pass, so *"a void whose replacement is valid costs the denominator nothing"* stops
being a footnote and becomes the clause an operator needs in front of them. Neither clause changes
any value: v13 finished with 10 valid rows per arm and did not approach the floor.

### AK3. What this does not claim, and one cost carried

- **It does not establish that the terminated-run condition is complete.** It names the terminal
  state v13 met and one boundary either side of it (§AK4). Cases it deliberately leaves open: a
  terminal state producing a *partial* report, and a provider outage (`genai_down`) with no report
  body — the latter named in §A3 itself as undecided, because a provider is neither the harness nor
  the platform executing it. Each should be expected to need its own ruling, under the same two
  clauses, before any replacement fires.
- **It does not make the native arm's termination a scored fact.** §A3's new bullet says so
  explicitly: a terminated execution is a real measurement about *operating* that harness and
  belongs in the operator record, and it is not a measurement of diagnostic quality. §AJ4's reading
  is carried unchanged.
- **The cost, stated rather than left to be found.** `scoring-v13/`'s twenty packets carry the OLD
  §A3, because the template moved after that pass was scored. This is the §AF1 shape exactly, and
  the §AF1 repairs are what keep it harmless: the generator refuses to clobber an existing packet
  without `--force`, so the twenty files that were read stay the record of what was read. A v13
  packet rebuild would now differ from them, and that is expected rather than a defect.

### AK4. The first draft of this rule was too wide, and review caught it against rows that exist

The condition as first written voided *"any other terminal state that ends the run before a report
exists"*. Review measured that generalisation against the record and found it reclassifying rows in
the very pass §AK cites — which would have made this a §T9 violation inside a section asserting §T9
compliance. Recorded because the near-miss is more instructive than the repair:

1. **A rejected report is a report.** `build-packets.js` prints into every packet for a row whose
   `terminal` matches `/failed/`: *"A rejected report is still scored — it is the only record of
   what the model produced."* v13 rows 04 and 16 and v12 rows 08, 14 and 20 carry exactly that
   terminal and were **scored 0, not voided**. The wide reading voids all five, which would have
   taken v13's custom arm from 10 valid rows to 8 — the floor edge — and falsified the symmetry
   claim §AJ4 rests on, since the custom arm plainly had not applied it. Worse, a future scorer
   would have received both texts in one packet: §A3 saying void, §4 saying scored.
2. **A budget death is a scored `0`, and voiding it empties `cause_of_death`.** `tool_limit`,
   `context`, `supervision_stall` and `wandered` all end a run before a report exists. DESIGN.md
   §2.3 put that column in the instrument precisely because *"a 0-point budget death and a 0-point
   reasoning death are opposite verdicts on the gate"* — so voiding those rows deletes the signal
   the column was added to carry. No scored row has yet carried a non-`completed` value, so this was
   a forward conflict rather than a reclassification; it would have surfaced as a missing column on
   the first pass that hit a ceiling.

**The line the rule now draws: the PLATFORM failed the execution → void; the RUN failed, however it
failed → score it.** Both boundaries are written into §A3 as named, scored cases rather than left to
be inferred from the void's phrasing.

Three further gaps, closed in the same pass:

- **"Unrecoverable" had no test for a run-state void.** A seed-state void is unrecoverable when the
  setup cannot be fixed; a terminated run has no setup and can always be re-fired, so nothing was
  ever unrecoverable and §A3.4's floor could never bite. The bound that resolves it — §AC6's cost
  stop at 3 re-runs in an arm — lived only in a pass record, which is the exact defect #174 set out
  to close, reintroduced one clause over. §A3 rule 2 now requires the pass to **declare a per-arm
  re-run cap before it starts**, and defines "cannot be made valid" as a void the cap leaves
  unreplaced. The number stays with the pass (§AC2's standard: settle it before rows exist); the
  requirement to have one is now standing.
- **The per-arm floor was promoted into a template sized at 10 rows total**, where two arms means
  five rows each and both are under the floor before anything is scored. §A3.4 now states the
  premise it needs — each arm sized at a full 10 valid rows — and says explicitly that a pass
  splitting 10 rows across two arms must settle its own evaluability rule in pre-registration.
- **Clause (b) could leave a row with no valid disposition.** A terminated run on the *last* row of
  a pass arrives when the tallies are unavoidably visible; the clause as first written then refused
  the void, while the same bullet refused the `0`. Rewritten to bind what it was always about:
  **authoring** a void condition, not **applying** one already standing. Applying §A3's bullet on
  the last row is not a choice made with the effect in view — the choice was made in §A3, before the
  pass began. Which is the argument for promoting the rule at all, now stated inside the rule.

### AK5. The filled scorecards are annotated, not retrofitted

`scorecard-agent-doctor.md` and `scorecard-custom-harness.md` each embed the §A3 they were scored
against. Both now carry a note saying the standing rule has moved, what moved, that none of it
governed their rows, and where the provenance lives — and neither has the new condition merged into
its text. `scorecard-agent-doctor.md`'s header records a precedent for mirroring §A3 edits into it
(PR #43); that precedent covered *corrections to a shared rule*, and a new condition is not a
correction. Retrofitting one would silently restate which contract those rows were scored under,
which is the §AF1 principle applied to a filled scorecard instead of a packet. Only
`scorecard-template.md` feeds the packet generator, so neither note reaches a scorer.

## AL. The `layers_swept` HOLD is target-blind by construction, and the missing operand is why (`2026.08.1106`, #173)

**§A through §AK are unmodified and this section appends to them** — `git log -p benchmark/DECISION.md`
is the check, in the form §W, §Z, §AC, §AD, §AE, §AF and §AK all used.

**§T9 governs: no v12 or v13 value moves.** No run was fired, no packet was re-scored, no instance
was touched, and `scoring-v13/` is not rebuilt. This section reads code and prior sections; it
produces a ruling and two docblocks.

Artefacts: `src/server/PaAgentLoop.js` (`_releaseSet`, `_depthGate` — **comments only, no behaviour
change**).

### AL1. The five rows are two causes, and the split is the whole section

§AJ6 left one question open — whether five custom rows answering a layer HOLD off-fixture is a
harness defect, a model defect, or a rubric that rewards reaching a layer over diagnosing at it —
and named the HOLD mechanism as the place to look. Looking there splits the five:

| rows | the discharging call | what it returned | lever that would bind |
|---|---|---|---|
| 12 | `query_table` on `sysrule_routing` | `table_does_not_exist` — barren | `REQUIRE_RETRIEVAL_TO_RELEASE` |
| 06, 08, 10, 16 | `schema_lookup` / `query_table` on real tables | rows, successfully | **none exists** |

Row 14 is the control: same seed family, same layer, same tool, and it *did* land on the fixture, so
the behaviour is not uniform.

The four-row majority is the load-bearing half, and reaching for the retrieval flag as "the fix"
repairs row 12 and leaves it untouched — which is the error this section exists to prevent, and
which its own author made once before checking §Y.

### AL2. The gate is target-blind by PROJECTION, not for want of the data

The target of every call is recorded. `PaAuditLogger` writes `target_table` per row
(`PaAuditLogger.js:372`) and `toolCalls(runId)` returns every call with its payload in order.

The gate does not read that path. `_trailTools` (`PaAgentLoop.js:660`) projects the audit rows down
to two arrays of tool **names** — `tools` and `retrieving` — and both of `_depthGate`'s consumers
read only those. The discarding happens one layer below the gate, in the projection, not at the
source.

So "the harness cannot see which table the call hit" is **false**, and any argument for or against a
targeting check that rests on it is void. The question is not availability. It is AL3.

### AL3. The second operand does not exist, and manufacturing it is #88 one level up

A targeting check needs two operands: the call's target, and **what the failure under investigation
is about**. The first is recorded. The second is not a fact this run holds.

`_normRequest` (`PaAgentLoop.js:1936`) normalises every request to a plain object whose usable
content is free-form — `{description: <text>}` in the fall-through — and the one field that names a
subject, `r.execution`, is consumed by being pushed into the prompt as text
(`PaAgentLoop.js:1779`). Nothing on the request states, in a form the loop can compare against,
which artefact or table the run is diagnosing.

To compare a call's target against the subject, the loop would therefore have to **derive the
subject** — from the model's own draft, or from the output of the run's own tools, which the model
chose. `_depthGate`'s stated posture forbids exactly that:

> *#88 raised the COST of stopping and got fabrication, because a stop priced in text is paid in
> text. So the gate is discharged only by something the model cannot author: a row in the audit
> trail.*

A gate released by an inference over model output is released by the model. It would present as a
trail check — it reads audit rows — while its decisive operand came from the thing being gated.
That is #88's failure wearing the trail check's clothes, and it is worse than #88 because the
costume defeats the review that caught #88.

**Ruling 1 — the release condition stays target-blind, and this is now recorded as deliberate.**
Not because targeting does not matter, but because the loop cannot perform the comparison from
operands it holds. The docblocks on `_releaseSet` and `_depthGate` carry this, so the next reader
meets the answer instead of re-deriving it from row notes.

**Ruling 2 — the targeting question moves to the rubric, where both operands are native.** A scorer
reads the packet: it holds the seed's fixture and the run's calls at once, and comparing them is
what a scorer is for. §T3's standing finding — *"reaching a layer is not diagnosing at it"* — is
already the rubric-side statement of this, and §A2.2 is where it lives. Rows 06/08/10/16 are
therefore **not** a harness defect. They are the rubric's business, and the pass that scores them
needs the call's argument in front of the scorer (AL5).

**The general shape, stated because the next guard meets it again: a guard can only enforce a
relation between operands it already holds as facts the guarded party cannot author.** If one
operand has to be inferred from the guarded party's output, the check is not a guard — it is a
heuristic wearing one — and it belongs where a human or a blind scorer holds both sides.

**What would change this ruling:** a structured subject field on the request — the artefact or table
under diagnosis, written by whoever *files* the run, not by the model answering it. That is a real
option and it is not proposed here, because it changes the request contract, every caller and the
benchmark seed format at once, to serve a check whose value is unmeasured. Recorded so the next
proposal starts from the operand rather than from the comparison.

### AL4. Row 12 is real and §Y already ruled on its lever

`REQUIRE_RETRIEVAL_TO_RELEASE` **stays `false`.** Not deferred — ruled, and by a section that spent
the measurement.

§Y ran the counterfactual across 64 trail-backed releases: the strict rule would have changed
**one — 1.6%, 95% Wilson [0.3%, 8.3%]** — and the one it changed was §T4's defect verbatim
(a `schema_lookup` answering `table_exists: false` discharging a hold on a guessed table name).
§Y6's disposition set the bar for enabling it: *"anyone proposing to enable it now has to argue that
a mechanism which binds that rarely is worth the depth gate's instrument risk — eight measured
passes are calibrated against the current release rule."*

v13 row 12 does not clear that bar, and being a genuine instance of the defect is not the same as
clearing it:

- It is a **second observation of the bind case**, in a second corpus. It moves the estimated bind
  rate and says nothing about benefit. §Y5's limit applies to it unchanged — a retrospective
  measures what the strict rule would have *withheld* given the calls that happened, never what the
  run would have done with another hold. Row 12 is no more observable on that point than §Y's
  TR1000202 was.
- Enabling it now would make #175's out-of-sample pass **non-single-variable against v13** while
  v13's own reading is the thing #175 exists to test. That is the instrument risk §Y6 names,
  arriving at the worst moment to take it.
- §U9 governs the family: *"No verdict is not the same as proven, so the default is off."*

**What would clear the bar,** stated so this is a standing condition rather than a permanent no: a
prospective arm — the flag on, its own pre-registration, sized against a corpus with enough guessed
table names to bind more than twice — measuring what a withheld release *produces*, which is the
question every retrospective on this flag has been unable to reach.

### AL5. The discharging call's argument must reach the scorer — which settles #178's substance

**Ruling 3 — yes.** AL3's Ruling 2 makes it structural rather than a preference: if the targeting
judgement is the rubric's, then withholding the call's argument from the packet withholds the
evidence the judgement is made on. A rubric asked to decide whether a run diagnosed *at* the layer
it reached, from a packet that names the layer and hides the table, is being asked to score a fact
it was not shown.

v13 did exactly that. §AJ5a records it: the five off-fixture arguments live in `operator_note`,
which `buildPacket` renders nowhere by design, while the packet boilerplate promises such an
argument would be *"named in section 6 instead"*. **No scorer in the v13 pass saw any of the five.**
That is why §AJ6's question could not be settled by the scores — the scores were taken blind to it —
and it is a second reason the four rows were never the harness's to answer.

This decides the **substance** of #178 and leaves it its actual open question. #178 asks whether
`withheldFactViolations` should require a scorer-facing field to name the discharging call whenever
`holds > 0`; the answer here is that the requirement is right. What #178 still owns is the part this
section cannot settle: **which passes it binds**, given that the check reddens v12 rows 02 and 04
(both took a hold and wrote no note) and so changes a frozen fixture's contract and #168's
byte-identical `--pass v12` parity check. Options 1–3 there stand undisturbed; §T9 still forbids
backfilling either manifest to make a later rule pass.

### AL6. What this section does not establish

- **It does not settle rows 06/08/10/16.** It rules on *where* they are settled — the rubric, on
  evidence the packet must carry — and rules out the harness as their author. The rows themselves
  remain unassessed, and will stay so until a pass scores them with the argument visible. Anyone
  quoting v13's custom arm inherits §AJ5a's qualification until then.
- **It does not claim the depth gate is well-calibrated.** Target-blindness is defensible; whether a
  gate that counts reaching without weighing arrival is the right instrument is §T3's open question
  and is untouched here.
- **It does not measure anything.** No run was fired. Every number in AL4 is §Y's, re-read, and
  every claim in AL2/AL3 is a reading of code at the commit this section was written against —
  which is the weaker kind of evidence this record has repeatedly warned about, and is why the file
  and line of each is named rather than summarised.
- **The one-instance risk in AL2.** `target_table` being written does not establish it is written
  *usefully* on every tool — only that the column exists and is populated by `_write`. A targeting
  check built later must verify per-tool coverage before trusting it; this section needed only the
  weaker claim that the data is not absent.

---

## AM. The delivery rule binds a pass that can still comply (`2026.08.1107`, #178)

§AL5's Ruling 3 settled the **substance** of #178 — the discharging call's argument must reach the
scorer — and left it one question: **which passes the requirement binds**, given that it reddens v12
rows 02 and 04. This section answers that, adds the check, and records what the answer costs.

### AM1. The hole was live in v13, not hypothetical

#178 argued from a counterfactual: *"had v13's rows 08/10/12/14 simply omitted their readings, the
build would pass today with `note` still null."* It did not need the counterfactual. **v13 row 02
took a hold and carries neither `note` nor `operator_note`**, so `withheldFactViolations` — which is
conditioned on `operator_note` being present — passes it in silence. It was dispatched to scorers
with its hold unnamed, and no guard said anything.

That moves the argument off incentives and onto evidence. The perverse incentive #178 names (deleting
`operator_note` is the cheapest way to green a red build) is real and remains the reason the check is
unconditional, but it is no longer the only reason: the conditional form has already let a held row
ship unnamed, once, in the corpus §AJ6's open question depends on.

Cross-tabulating the two checks over v13's ten held rows, which is what makes the division of labour
visible rather than asserted:

| caught by | v13 rows |
|---|---|
| `withheldFactViolations` only | 06, 18 |
| both | 08, 10, 12, 14, 16 |
| `unnamedHoldViolations` only | **02** |
| neither | 04, 20 |

### AM2. Ruling — the boundary is authorability, and it is DERIVED

**A delivery guard refuses on a pass that can still comply, and reports on one that cannot.**
Mechanically: the pass's own `scoring-<pass>/` is empty → refuse, nothing written; it already holds
packets → `console.warn` and build.

The reasoning is §T9's, followed to its conclusion. §T9 forbids editing a frozen manifest, and #178's
own constraints forbid backfilling one to make a later rule pass. So on a dispatched pass a rule
written after dispatch has **no legal remedy** — and a gate whose only remedy is forbidden is not a
gate, it is a permanent red. Permanent reds are how a team learns to stop reading reds, which would
cost more than this rule buys.

**Why this is not #178's option 2.** Option 2 versions the requirement by pass token, and the issue
is right that a pass-scoped carve-out is "an exemption with a calendar attached" — precisely the
shape §AF2's note distrusts. The difference is where the boundary comes from. There is no list here
and no cutoff version: the reporting branch is reachable **only** by a pass that has already
dispatched its packets, and dispatching them required passing whatever gate was in force at the time.
An exemption nobody can grant themselves is not a second and silent way to be unguarded. The
distinction generalises, and is the reason to record it: **a carve-out derived from a state the
guarded party cannot enter at will is a different object from one written down as a name.** It is
the same move §AL3 made for guards — enforce only over operands the guarded party cannot author —
applied to the guard's own scope rather than to its comparison.

**Why not option 1.** Binding it everywhere makes v12 unbuildable, and v12's `buildAll()` backs the
freeze tests, the terminal-state check, the advance-ruling delivery tests and #168's byte-identical
`--pass v12` parity check. The precedent is already visible and is an argument *against* option 1
rather than for it: #176 left `buildAll('v13')` permanently throwing, and nothing noticed, because no
test or parity path calls it. A rule enforced where nobody looks is indistinguishable from no rule.

**Why not option 3.** It keeps the incentive pointed at erasing the operator's record, and AM1 shows
the conditional form has already failed once in the corpus.

**`--force` is not a way around this.** It exists to overwrite the freeze check; a dispatched pass
whose rows violate the rule cannot be rebuilt into its own directory at all. Otherwise the reporting
branch — granted because there is no remedy — would itself become the remedy. A scratch rebuild under
`--out` is unaffected: it reads evidence and destroys nothing.

### AM3. What the check requires, and where it is deliberately narrow

`holds > 0` requires **`note` to name a platform identifier that is not one of this row's tool
names**. Two bounds, both load-bearing:

- **Only `note`.** Of the scorer-facing fields, `layers_swept` and `terminal` are measurements and
  `invocation` is constant-shaped — it carries `x_snc_troubleshoot` on every row of every pass, so
  accepting it would let boilerplate discharge the requirement on a row that names nothing.
- **Tool names do not count.** Section 5 prints `distinct_tools` on every packet, so *"schema_lookup
  answered the HOLD"* delivers a scorer nothing it did not already have. The fact owed is the
  argument. This is F1's finding from the #177 review, applied in the opposite direction.

### AM4. What this costs, stated rather than implied

- **A measured residual, accepted on the sibling's terms.** The token shape cannot tell a call
  argument from any other platform identifier, so **v12 row 20 clears the check on the word `sys_id`
  in its prose** — a held row whose `note` names no call. The fix would be a list of tokens that do
  not count, and no lists is this family's stated posture (§AF2). Recorded as a measurement.
- **The warning channel is permanent for two passes.** v12's and v13's violations can never be
  fixed, so their report fires on every build of them, forever. That is habituation risk, and it is
  bounded by there being nothing else in the channel: an authorable pass never warns, it throws.
- **A warning nothing asserts is a report printed where nobody looks** — the failure #176's two
  same-direction guards already demonstrated. So the frozen violations are pinned **by row number**
  in `test/packetGeneratorParity.test.js`: v12 rows 02/04, v13 rows 02/08/10/12/14/16.
- **The destructive branch is unit-tested, not driven end to end.** Reaching the `--force` refusal
  through `main()` means pointing the writer at real dispatched evidence and trusting the guard under
  test to stop it — an accident that already happened once and is documented in the parity suite.
  Staging a throwaway `benchmark/scoring-v9x/` is no better: the blind-rule suite compares the
  scoring directories on disk against its declared membership, and jest runs files in parallel, so
  the directory would flake a guard in another worker. The decision is a pure function over the three
  facts `main()` holds, and its truth table is the test.

### AM5. What this does not establish

- **No v12 or v13 value moves, and neither manifest is backfilled** (§T9). That two v12 rows and six
  v13 rows fail a rule written after them is a fact about the rule's history, recorded as a
  measurement, not a defect in the manifests.
- **It does not make v13's custom arm assessable.** §AJ5a's qualification and §AL6's first bullet
  stand unchanged: the five off-fixture rows stay unassessed until a pass scores them with the
  argument visible. This closes the gap for the *next* pass; it repairs nothing already scored.
- **It measures nothing about the instrument.** No run was fired. The cross-tab in AM1 is a read of
  two manifests at this commit.
- **It does not claim `note` is the right field forever.** It is the only scorer-facing field that is
  free prose about the row today. A future pass that adds another would have to widen the check
  deliberately, and the widening is where `invocation`'s constant-shape problem would return.

---

## AN. Pre-registration — the out-of-sample pass (`2026.08.1108`, #175)

**Written and committed before a single run fired. §A through §AM are unmodified** — `git log -p
benchmark/DECISION.md` is the check, in the form §W, §Z, §AC, §AE, §AF, §AG, §AH, §AI, §AK and §AL
all used. **This section claims no result.**

It discharges §AJ6's closing item — *"The next pass should change the distribution, not the
clauses"* — and #175's framing of it. Both of #175's declared blockers are closed: **#174** by §AK
(§A3 now carries the terminated-run void condition, so the next operator is not authoring a void
rule mid-pass as v13 had to) and **#173** by §AL (the `layers_swept` HOLD is ruled target-blind by
construction, so the custom arm's 0/10 is not carried forward on an unresolved mechanism). §AM
added the delivery guard that puts a hold's discharging call in front of the scorer, which §AL6
named as the precondition for those rows being assessable at all.

**This pass changes the seed distribution and nothing else it can control.** AN1 states what that
buys and AN2 states what it costs.

### AN1. What this pass decides, and what it does not

**Decides:** whether the clause sets written at §AG and §AH *determine* a value on reports drawn
from seeds they were **not** fit to — measured as the packet-level `ambiguous` flag and the
per-column flag tally **across the twelve out-of-sample rows**, against v13's in-sample 20-of-20
(§AJ1) and v12's 8-of-20 (§AD3).

**Does not decide:**

- **Whether the clauses are RIGHT.** §AC8's caveat, standing since §AD3 and applied at §AG5, §AH6
  and §AI1, applies unamended. Determinacy is a property of the instrument; correctness is not
  measured by it.
- **The Phase 1b milestone, by prediction.** §AC's Ruling 3 criterion carries and is applied, and
  **no prediction is filed on the gate in either direction** — §AI4's Ruling 6, carried verbatim as
  Ruling 6 below.
- **`MAX_EVIDENCE_RETURNS` or `REQUIRE_RETRIEVAL_TO_RELEASE`.** Both frozen — `0` and `false`.
  §AL4 ruled the retrieval flag stays off and named enabling it here as "the instrument risk §Y6
  names, arriving at the worst moment to take it."
- **Anything about the seed constructions that were refuted.** Two candidate seeds were built,
  installed, measured and discarded during qualification (AN3). That is fixture work, recorded in
  `raw-evidence-seed-qualification-06-08.md`, and it is not a result of this pass.

### AN1a. This pass is NOT single-variable against v13, and the reason is not a harness change

#175 asks that non-single-variable status be *"stated in the pre-registration rather than
discovered at scorecard time."* It is stated here, and it did not come from the source #175
anticipated.

**The instance was upgraded between v13 and this pass.** `sys_upgrade_history`
`b539b6432b220310f243fed2ce91bf45`, **2026-08-11 17:00:15 UTC**: Zurich Patch 10 **Hotfix 3 →
Hotfix 4a**. v13's runs fired 12:54:57 → 14:38:37 UTC the same day (TR1000268 → TR1000290), so the
upgrade landed **~2h22m after v13's last row**. **v13 is entirely a Hotfix 3 measurement and this
pass is entirely a Hotfix 4a one.**

Nothing in the repo caused it and nothing in the repo can undo it. What the design does about it is
AN2's anchor arm: eight rows on seeds 02 and 05, scored under the **same** clauses against the
**same** seeds v13 used, differing from their v13 counterparts by the platform patch and by nothing
else. That arm is the only instrument this pass has for telling *the distribution moved* from *the
platform moved*, and it is why the shape is 3 new + 2 anchor rather than 5 new.

**The anchor is a control, not a proof.** Eight rows cannot resolve a small patch effect, and a
clean anchor is consistent both with "the patch changed nothing" and with "the patch changed
something the anchor seeds do not exercise." AN8 carries that limit.

### AN2. Shape and sizing — 3 new + 2 anchor, and why not 5 new

**5 seeds × 2 reps × 2 arms = 20 runs, 10 valid rows per arm.** The run count and the per-arm floor
are §AC2's and §AI2's, unchanged. **The composition is new:**

| role | seeds | expected layer | rows |
|---|---|---|---|
| **out-of-sample** | 06 · 07 · 08 | 4 `data_schema` · 3 `tool_definition` · 3 `tool_definition` | **12** |
| **anchor** | 02 · 05 | 2 `instruction` · 7 `wiring` | **8** |

**The primary outcome is read on the twelve out-of-sample rows only.** Mixing anchor rows into it
would dilute exactly the quantity the pass exists to measure — the anchors are in-sample by
construction, and v13 already measured them at 20-of-20.

**Why the anchors are 02 and 05, decided on a stated basis rather than convenience.** They are the
two seeds the clause set was **most fit to**, measured from `v12-ambiguity-flags.json`: seed 02 drew
**5 of v12's 14 flags across all 4 of its rows**, the most of any seed. Seeds 04 and 05 tie at 3
flags, and 05 is taken on the tiebreak that matters — it had **3 of 4 rows flagged** against 04's 2,
and the row-level test is the one AN-1 is measured with (Ruling 4). Seed 05 additionally carries
Ruling 1, which re-exercises the advance-ruling delivery channel that seeds 07 and 08 now depend on.

**Why not 5 new seeds.** It maximises the out-of-sample denominator (20 rows, directly comparable to
v13's 20) and gives up the anchor. Under AN1a that trade is no longer available on its merits: with
a platform upgrade sitting between the two passes, a 5-new design cannot attribute a weak result to
the distribution rather than to Hotfix 4a. Two of the five would also have had to be invented for
this pass, which is the provenance problem AN3 describes.

**§A3.4's 8-valid-run floor is read PER ARM** (Ruling 2, carried). The **determinacy tally is
separate** and is read across valid rows in both arms — `ambiguous` is a property of a packet and a
scorer, not of an arm — but it is *partitioned* into the out-of-sample twelve and the anchor eight,
and the partition is fixed here, in advance, so it cannot be redrawn in front of the rows.

**What twenty rows still is not: a rate.** §T8 is carried verbatim and unamended — twenty rows, five
seeds, one instance, one day, one model, one app version, and now two platform patch levels across
the comparison. §AC2's binomial table bounds only the incidental gate figures at Ruling 6.

### AN3. The seed set — what qualified, what was refuted, and how out-of-sample each seed is

Fixture state is measured, not assumed, per `raw-evidence-seed-qualification-02-05.md`'s standard:
*"a pre-registration binds you to what it asserts, so its seed set must be measured rather than
assumed."* Full evidence: `raw-evidence-seed-qualification-06-08.md`.

| seed | defect | qualified by |
|---|---|---|
| **06** | the queried column does not exist (`category` absent from `x_snc_tsbench_ticket`) | `ee0a07832b624310f243fed2ce91bfeb` — tool returned `count: 0` with status **success** while the table held 15+ rows |
| **07** | unbounded tool return | `9d9a4f4b2b624310f243fed2ce91bf2d` — **`tool_output_bloat`, 58,436 chars** against a 20,000 threshold |
| **08** | non-terminating tool contract | `fd8503432b2e0310f243fed2ce91bf70` — **27 identical tool calls over 7m18s** |

**Two candidate constructions were refuted by measurement and are NOT in the pass.** Both are
recorded because a pre-registration that hid its discarded fixtures would be claiming a cleaner
selection than it made:

- **K26 T1, ACL-trigger misalignment** (LLD §7's candidate seed 6) — built twice, both `completed`.
  T1 is **trigger-scoped**: it needs a trigger firing under a non-privileged *initiating* identity,
  and this benchmark captures seeds by direct REST invocation as admin, which passes
  `access_verification` (`isAccessAllowed: true`, 371ms). Deferred, not abandoned.
- **K26 T4, instruction bloat** (LLD §7's candidate seed 7, layer 2) — **unreachable on this
  instance.** 9,762 chars → 4,770ms P95; 167,530 → 12,082ms slowest step; 305,589 → 12,269ms.
  Doubling the instruction moved the slowest step **1.5%**. `instruction_bloat` needs >15,000ms.
  The slot kept its taxonomy entry and moved to the reachable half of the same K26 Lab 2 pair.

**How out-of-sample each new seed is, graded honestly rather than asserted uniformly:**

- **Seeds 07 and 08 are strongly out-of-sample.** Their taxonomy entries were selected in
  `docs/LOW_LEVEL_DESIGN.md` §7 on **2026-08-01**, from ServiceNow's external K26 CCL6230 failure
  taxonomy — **five days before §AG (2026-08-06) and six before §AH (2026-08-07)**. They cannot have
  been fit to clauses that did not exist, and the selecting authority was not this project.
- **Seed 06 is weaker, and is not presented as equivalent.** Its slot was chosen **after** the
  clauses, so the provenance argument above is unavailable to it. Its external criterion is the
  layer-coverage table — **layer 4 is covered by no other seed**, a gap DESIGN.md R-21 recorded on
  2026-08-01 and `scorecard-template.md` §E2 makes visible by mapping layer 4 to `schema_lookup`.
  That is a real, pre-existing, externally-recorded criterion, and it is still weaker than the other
  two. **A reader is entitled to discount seed 06's four rows**, and AN5 files the primary
  prediction so that discount can be applied: AN-1a reports the tally on all twelve rows and AN-1b
  reports it on the eight strongly-out-of-sample rows alone.

**Seeds 07 and 08 share expected layer 3 deliberately.** §A2.2 scores the *declared* layer, so two
seeds agreeing on the layer while disagreeing entirely on the mechanism — a tool that returns too
much versus a tool that cannot say when it is done, both fixed by editing a return contract — tests
whether that clause **resolves** or merely **matches**. It is the sharpest structural question this
distribution asks, and it is not the primary outcome.

**Operational conditions, all three of §AC3's carrying forward:**

1. **Seed 05's `sn_aia_trigger_agent_usecase_m2m` gate is re-read before run 1.** It was found
   **`active=false`** during qualification and restored by PATCH, verified by re-read
   (`ba30d8775b0c4cebb960c58830590d5d`, `active=true`, `sys_mod_count=3`). **Read it again anyway** —
   five installs happened during qualification and any further install resets it.
2. **No audit field may be used to decide whether it reset — read `active` itself.** The install
   path writes record values while touching **neither `sys_updated_on` nor `sys_mod_count`**,
   observed twice during qualification, and the confirmation of the anomaly §AI1 carried unexplained
   as pre-flight item 11. **A gate that reset looks completely untouched**, so the only reliable
   check is the value.
3. **The seed-05 probe-row deletion (§AI3.2) and the trigger-activation wait (§AI3.3) carry
   unchanged.** Neither applies to the protocol as written; both are recorded so a mid-pass repair
   does not re-commit qualification §3.1's void.

### AN4. The rulings made in advance

Rulings 1–6 carry from §AC and §AI unchanged. Rulings 7 and 8 are new, and each exists because it
is a call a scorer would otherwise make at the desk with the run's most salient symptom pointing the
wrong way.

**Ruling 1 — seed 05 `fix_usable_unedited` = 1** for a report naming
`sn_aia_trigger_configuration.active = false` and proposing activation. Carried verbatim from §AC4
and §AI4, including its stated cost and its explicit non-generalisation.

**Ruling 2 — the §A3.4 floor is per arm.** Carried. AN2 adds only that the determinacy tally is
partitioned into out-of-sample and anchor, and that the partition is fixed here.

**Ruling 3 — the milestone criterion is unchanged:** met iff the custom arm reaches
`sum(passes_gate) / valid runs ≥ 80%`. The *custom ≥ native* reading stays rejected for §AC4's
stated reason.

**Ruling 4 — what counts as a flag.** Carried verbatim from §AI4. Row-level: a row is ambiguous iff
its verdict header table's `ambiguous` field reads `yes` — §AC5's broad AC-5 definition, not the
narrower gate-only reading at §T2. Column-level: counted iff the verdict's `### ambiguity` prose
**names that column as under-determined**, curated by hand into `benchmark/v14-ambiguity-flags.json`
in `v12-ambiguity-flags.json`'s form, **scanning only rows whose header reads `ambiguous = yes`**.

**Ruling 5 — the confound is a fact about the pass, not a hypothesis in it.** AN1a records that the
platform patch level differs from v13's. This is deliberately **not** converted into a prediction,
for §AI4 Ruling 5's reason applied to a new quantity: a patch effect and a distribution effect are
not separable from twenty rows, and filing a prediction on a confounded quantity produces a
confirmation or refutation that means nothing.

**Ruling 6 — the incidental gate figures: published, applied, unpredicted.** Carried verbatim.
Both arms' `passes_gate` proportions and rubric totals are reported **together, never singly**, per
§AD7, whatever they say. Ruling 3's criterion is evaluated against them. **No prediction is filed**,
so this pass may not claim a confirmed or refuted prediction about the milestone in either
direction.

**Ruling 7 — a latency flag on seed 07 may be an instrument artefact.** A seed-07 run may report
**two** flags: `tool_output_bloat` on a tool, and `instruction_bloat` on the `AIA ReAct Engine`
step. **Only the first is seeded.** Measured: `instruction_bloat` fired at **15,154ms** against a
15,000ms threshold on a seed whose instruction is **~330 characters**, on a step that ran *before*
the run's only tool call. The threshold sits inside this instance's ordinary variance.

A report naming **instruction bloat as its primary root cause** on seed 07 scores
`root_cause_layer_correct` = **0**. **Merely listing the flag is not charged** — it is genuinely in
the trace, and a report surfacing what the instrument emitted is doing its job. This fixes which of
two flags is the seeded one; it amends no clause and adds no scoring test.

**Ruling 8 — seed 08's instruction is clean by construction.** The intuitive diagnosis — "the agent
has no completion criteria", layer 2 — scores `root_cause_layer_correct` = **0**. The seeded defect
is at layer 3: the tool returns a constant non-terminal status while its description promises a
terminal one. The instruction states an explicit, correct stop condition, so the loop is not the
agent failing to stop but the tool never saying when.

**Rulings 1, 7 and 8 ship in the packets, not only here.** `benchmark/v14-advance-rulings.json`
carries all three in the `v12-advance-rulings.json` shape, rendered into every packet for the seed
each applies to. §AD5's standing rule is that an advance ruling on a scoring column must reach the
scorer — that is #160, and §AG1 records what its absence cost v12: rows 17 and 19 flagged
`fix_usable_unedited` *because the ruling never reached the scorer*.

### AN5. The predictions

Filed here, before any run. Refutation criteria stated for each; a prediction with no stated
refutation is not one.

| | Prediction | What refutes it |
|---|---|---|
| **AN-1a** | **≥ 80% of the twelve out-of-sample rows** return `ambiguous = no` under Ruling 4's row test — **≥ 10 of 12** | < 10 of 12. **The pass's primary outcome.** The bar is AI-1's, deliberately: v13 cleared it at 100% in-sample, and §AI8 said a strong in-sample result "is the MINIMUM the clauses must clear". This is the same bar on reports the clauses were not fit to |
| **AN-1b** | **≥ 80% of the eight STRONGLY out-of-sample rows** (seeds 07, 08) return `ambiguous = no` — **≥ 7 of 8** | < 7 of 8. Filed separately so seed 06's weaker provenance (AN3) can be discounted by a reader without re-deriving the tally |
| **AN-2** | **≤ 0.20 column flags per out-of-sample row** — **≤ 2 at the twelve-row denominator** — against v12's 0.70 and v13's 0.00 | > 0.20 per row |
| **AN-3** | **All eight anchor rows** return `ambiguous = no`, matching v13's result on the same two seeds | ≥ 1 anchor row reads `ambiguous = yes`. **This is the drift control** (AN1a). Refutation does not falsify AN-1 — it says the cause is the platform or the model rather than the distribution, and that reading is fixed here so it cannot be reached for afterwards |
| **AN-4** | **≥ 1 row files a primary root cause at layer 2 on seed 08** — the decoy bites | Zero such rows across four seed-08 rows. A *shape* prediction like AI-4/AI-5, not a determinacy one, and **not counted toward this section's meaningful predictions**: it predicts a wrong answer, and confirming it says nothing about the clauses |
| **AN-5** | **≥ 1 seed-07 row's report names an `instruction_bloat` flag** | Zero across four seed-07 rows. A **tripwire on Ruling 7's applicability**, filed knowing qualification already produced one, so its prior is high. It is not discriminating and, per AI-5's precedent, is not counted toward this section's claim to have filed meaningful predictions |
| **AN-6** | **≤ 2 void rows encountered** across the pass, and every arm finishes with **10 valid rows** | ≥ 3 encountered, or any arm below 10 valid. Stated on voids *encountered* rather than surviving; AN6 re-runs them |
| **—** | **No prediction is filed on `passes_gate`, either arm, either direction.** Recorded as a row so the withholding is visible rather than inferred | Nothing. Ruling 6 governs what may be said about the figures it produces anyway |

**Four meaningful predictions (AN-1a, AN-1b, AN-2, AN-3) and two tripwires (AN-4, AN-5).** §AJ6's
warning against reading six-for-six confirmation as strength is why the count is stated here rather
than left to be totted up afterwards.

### AN6. The stopping rule

**Fixed `n` = 20 runs. The pass does not extend and does not stop early.** Every run produces a
scorable row unless void, so the denominator is fixed by construction.

**No tally of any kind is computed, curated or glanced at until all twenty packets have been scored
and returned.** §AI6's most result-sensitive commitment, carried and widened: it now protects the
row-level `ambiguous` count, the column-flag tally, **the out-of-sample / anchor partition**, and
both arms' gate figures. §U8.5 governs — *"Continuing because the split is tied is optional stopping
at the most result-sensitive moment there is."*

**AN-4 and AN-5 are read off the REPORTS and are sealed identically.** Both are evaluated against
report shape, and the operator necessarily reads every report while running the pass and building
packets. Without this clause AN-5 could be confirmed at run 3 with nothing forbidding it.

**Void handling.** A void row is re-run rather than absorbed, and both the void and its replacement
are recorded. **§A3 now carries the terminated-run condition explicitly (§AK)**, so this pass does
not repeat v13's mid-pass authoring of a void rule under time pressure. Re-runs reaching 3 in one
arm is a **cost stop, not a verdict**. An operator error is still a void, still re-run, still
recorded.

**Packets are built after all 20 runs terminate, and the scorers are dispatched once.**

### AN7. Protocol and pre-flight

**Sequencing: interleaved by seed** — native rep 1, custom rep 1, native rep 2, custom rep 2, per
seed, strictly sequential, one day, one deployed version. **Run identity is verified, not inferred**
(`PaRunAnchor`'s 30-minute fallback makes interleaving a hazard, §O1).

**Scorer topology is fixed to match v9, v12 and v13: independent agents, one per packet, redacted
packets.** §O5 measured topology moving the result by about two rows; it is held constant or the
comparison to v13 is meaningless.

**Pre-flight, every item verified by probe before run 1:**

1. **The installed product code is repo HEAD's `src/`** — by `git log <build-commit>..HEAD -- src/`
   being empty, **not** by a version string. §AI7 item 1 records why: a version reading later than
   the build is not a failure when the intervening versions are documentation.
2. **The fixture app is the qualified build**, carrying seeds 06, 07 and 08 — verify all three
   agents exist by name (`Seed 06 Hardware Reporter`, `Seed 07 Ticket Classifier`,
   `Seed 08 Batch Watcher`).
3. **Seed 05's m2m gate re-read** (AN3 condition 1), and **not** trusted to `sys_updated_on`
   (condition 2).
4. `PaAgentLoop^scriptLIKEMAX_EVIDENCE_RETURNS: 0` → 1 record.
5. `PaAgentLoop^scriptLIKEREQUIRE_RETRIEVAL_TO_RELEASE: false` → 1 record.
6. **All five seeds' §A3 fixture conditions re-read live**, including seed 04's capability sys_id.
7. **The three seed-05 probe rows are gone** (§AI3.2), by re-query.
8. `layers_available` read by **two independent paths** — `sn_aia_agent_tool_m2m` for native,
   `PaToolRegistry`'s own registry read for custom (§O1).
9. Budget knobs read fresh: `sn_aia.continuous_tool_execution_limit` (read **25** during
   qualification — and note it did **not** bind seed 08's 27-call run) and `max_auto_executions`.
10. Smoke gate fired and passed on **both** arms before any scored row is spent.
11. **The blind-rule guard is told about `scoring-v14/` as part of building the packets, not after** —
    add the `PACKET_SETS` entry (`dir: 'scoring-v14'`, `scanned: true`, a `why`, a real `packets:`
    count), update the hardcoded membership literal in the same test, and confirm `npm test` green
    **before the first packet reaches a scorer**. Navigate by test name; §AC7 pinned a line number
    that had already drifted.
12. **The three new seed specs are re-scanned by the blind-rule suite as part of pre-flight.** They
    are already green — and both new specs shipped an `[answer-key-pointer]` to the decision record
    on first authoring, caught by `scorerPacketBlindRule.test.js` before merge. A new spec is exactly
    the input that guard exists for, and it has now been demonstrated on this seed set rather than
    assumed.
13. **`benchmark/v14-advance-rulings.json` renders into every packet** for seeds 05, 07 and 08
    (Rulings 1, 7, 8). Verify on a throwaway `--out` build, not by reading the JSON.
14. **The packet generator accepts `--pass v14`** and its `buildAll('v14')` path is exercised.
    §AM2's precedent is the warning: #176 left `buildAll('v13')` permanently throwing and nothing
    noticed, because no test or parity path called it.

**Artefacts.** Measurements → `benchmark/raw-evidence-v14-out-of-sample.md`. Rows →
`benchmark/scorecard-v14.md` and `benchmark/v14-rows.json`. Reports verbatim →
`benchmark/v14-reports/`. Advance rulings → `benchmark/v14-advance-rulings.json`. Packets exactly as
scored → `benchmark/scoring-v14/`. Flag tally → `benchmark/v14-ambiguity-flags.json`. Operator
records are **outside** the scorer-facing channel and must never be pasted into a packet.

### AN8. What this pass cannot establish

Everything in §T8, §Z5, §AB5, §AC8, §AG5, §AH6, §AI8, §AJ6 and §AL6 stands, unsoftened. Five limits
are specific to this pass.

- **It is not single-variable against v13.** AN1a. The platform moved between the two passes and
  the anchor arm is a control, not a correction. Any comparison of a v14 figure to a v13 figure
  carries Hotfix 3 → 4a with it, and **any future quotation of this pass that drops this bullet is a
  misquotation.**
- **Eight anchor rows cannot resolve a small patch effect.** A clean AN-3 is consistent with "the
  patch changed nothing" **and** with "the patch changed something these two seeds do not exercise."
- **One of the three new seeds has weaker provenance than the other two.** AN3. AN-1b exists so a
  reader can apply that discount without re-deriving anything, and a divergence between AN-1a and
  AN-1b is itself informative about how much the provenance grading mattered.
- **Determinacy is not correctness**, with the same force §AI8 gave it. A clause a scorer has to
  argue itself into is not obviously the same thing as a determinate clause, and §AJ3 recorded two
  v13 verdicts that did exactly that without flagging. **This pass inherits that open question and
  does not close it** — Ruling 4's row test cannot tell the two apart, by construction.
- **It does not make v13's custom arm assessable**, and it does not re-open it. §AJ5a's
  qualification and §AL6's first bullet stand: the five off-fixture rows stay unassessed. §AM closed
  the delivery gap for *this* pass; it repaired nothing already scored.

### AN9. Disposition

**This section contains no measurement.** It fixes a distribution, a partition, eight rulings, four
predictions and two tripwires, a stopping rule that now seals a partition as well as a tally, and a
pre-flight of fourteen items — two of which (11 and 14) exist because a prior pass discovered them
at the worst possible moment.

**Unchanged at the time of writing: native remains the recommended path on this instance, and the
Phase 1b milestone is not met.** Quote both arms together, never singly (§AD7) — v13: **native
4/10 · 40.0% · 47/60; custom 0/10 · 0.0% · 5/60** (§AJ2). v12 on the same seeds: **native
6/10 · 60.0% · 51/60; custom 0/10 · 0.0% · 9/60** (§AD1). **§T9 governs: no v12 or v13 value moves,
and this section moves none.** Per §AI9, no ordinal is attached to the milestone's unmet status —
the fact needs none.


## AO. v14 — the out-of-sample pass, scored (`2026.08.1110`, #175)

**§AN was committed in `0c4f36c` before run 1; §A through §AN are unmodified.** `git log -p
benchmark/DECISION.md` is the check. Scorecard: `benchmark/scorecard-v14.md`. Rows:
`benchmark/v14-rows.json`. Verdicts: `benchmark/scoring-v14/results/`. Flags:
`benchmark/v14-ambiguity-flags.json`.

### AO1. The result

**Twelve of twelve out-of-sample rows returned `ambiguous = no`, with zero column flags.** All four
meaningful predictions confirmed; both tripwires refuted.

| | prediction | bar | measured | verdict |
|---|---|---|---|---|
| **AN-1a** | out-of-sample determinacy | ≥ 10 of 12 | **12/12** | CONFIRMED |
| **AN-1b** | strongly out-of-sample (seeds 07, 08) | ≥ 7 of 8 | **8/8** | CONFIRMED |
| **AN-2** | column flags per out-of-sample row | ≤ 0.20 | **0.00** | CONFIRMED |
| **AN-3** | anchor arm clean (drift control) | all 8 | **8/8** | CONFIRMED |
| **AN-4** | seed-08 layer-2 decoy bites | ≥ 1 of 4 | **0/4** | REFUTED |
| **AN-5** | a seed-07 report names `instruction_bloat` | ≥ 1 of 4 | **0/4** | REFUTED |
| **AN-6** | ≤ 2 voids, 10 valid rows per arm | — | **0 voids, 10/10** | CONFIRMED |

**Gate, both arms together (§AD7 — never quote one alone): native 5/10 = 50.0% (45/60), custom
0/10 = 0.0% (3/60).** v13 was native 4/10 = 40.0% (47/60), custom 0/10 (5/60); v12 was native 6/10 =
60.0% (51/60), custom 0/10 (9/60). **Ruling 3's milestone is not met.** Ruling 6 governs: no gate
prediction was filed, so none may be claimed either way. Native's point total, 45/60, is the lowest
of the three passes even though its gate count is not the lowest — and the distribution and the
platform patch both moved, so nothing here licenses reading it as harness movement.

**This discharges §AJ6's closing item and #175.** The clauses were shown to determine a value on
seeds they were not fit to, eight of the twelve rows drawn from taxonomy entries selected
2026-08-01 — five days before §AG existed and by an authority outside this project.

### AO2. The finding that outranks the result — determinacy came apart from correctness, at full marks

**Row 09 scored 6/6, cleared the gate, was not flagged ambiguous, and proposed a fix that cannot
work.** It correctly identified seed 06's layer-4 defect (a filter on a `category` column that does
not exist), then proposed repointing the query at a **`type`** column and asserted that
`schema_lookup` and `query_table` had confirmed it. `x_snc_tsbench_ticket` has 8 fields whose only
non-system members are `short_description` and `priority`. **The packet's own seed spec states this
in its opening paragraph.** The refuting fact was in front of the scorer and the verdict did not use
it.

Two neighbours show the same shape: **row 11** filed a co-primary "the table is genuinely empty
(0 rows)" against a table holding **21 at the time its target execution ran** (19 at pre-flight, 22
by the time the operator ran the COUNT aggregate — `v14-rows.json` records the later figure because
that is when it was measured; the scorecard §5 reconciles the three), and proposed "seed the table"
— the exact target seed 06's
spec scores 0; it scored 5/6 and cleared the gate. **Row 13** listed five `u_*` columns that do not
exist while getting the field count right.

**§AC8 and §AI8 have asserted since v12 that determinacy is not correctness. This is the first pass
to demonstrate it at full marks on a gate-passing row**, and it is worth more than the confirmed
predictions. The rubric measures whether a report *names the right layer, targets the right thing,
cites evidence, and reads as usable*. It does not measure whether the report's factual claims are
true.

**No score was changed, and none should be.** The manifest was frozen at dispatch and re-scoring
after seeing results is optional stopping at the most result-sensitive moment there is (§U8.5). The
observations live in `v14-rows.json` `operator_note`, which renders into no packet.

**Deliberately unresolved, and the first thing the next pass must settle.** Row 11 attributes its
empty-table claim to `query_table` **itself** returning `unfiltered_row_count: 0` /
`verdict: genuinely_empty`. If the tool returned that against a 22-row table, this is a **harness
defect, not a fabrication** — and a mechanism exists: `query_table` runs in scope
`x_snc_troubleshoot` while the bench table is owned by `x_snc_tsbench`, and Build Rule #42 records
that a Fluent `Table()` installs with zero ACLs. Not investigated mid-pass (§T9 freezes `src/`). The
two readings have opposite consequences: one is a model that invents, the other is a diagnostic tool
reporting absence where there is a permission barrier — the precise failure `unfiltered_row_count`
exists to prevent.

### AO3. The operator changed the scorer instruction, and it weakens the v13 comparison

**Disclosed as a defect of this pass, not a footnote.** §AN7 pinned the scorer *topology* —
independent agents, one per packet, redacted packets — and that was held. It did not pin the scorer
*instruction*, and v14's differs from v13's in two ways, **both operator-introduced and both pushing
toward fewer flags**:

1. **v13 required an `### ambiguity` section iff the flag was `yes`**, which is exactly why
   scorecard-v13 §3 could cite **two independent agreeing signals**. v14 asked every verdict for the
   section, so that independence does not exist and the header table is the only signal.
2. **v14 added: *"do not flag `ambiguous` merely because a judgement was effortful."*** v13 carried
   no such clause — and scorecard-v13 §3.1 records two v13 verdicts that made close calls **without**
   flagging and treats that as a **limitation**. v14's prompt licensed the behaviour v13 recorded as
   a caveat. Row 19's verdict shows it operating: it states the judgement "took work", then declines
   to flag it in those terms.

**AN-1a/AN-1b/AN-3 stand as absolute measurements under a stated instruction. The
determinacy comparison v13 → v14 does not.** Any future text placing v13's 20/20 beside v14's 20/20
without this subsection is a misquotation.

**Rule for the next pass:** pin the scorer instruction verbatim in the pre-registration, the way
§AN7 pins topology, and diff it against the prior pass's before dispatch.

### AO4. Rulings 7 and 8 were both correct and neither was exercised

**Ruling 8** pre-ruled the seed-08 layer-2 answer ("the agent has no completion criteria") as 0. No
row filed it. Both native rows filed **layer 3 primary** — a tool script that is a hardcoded constant
with no terminal branch — and each explicitly demoted the instruction gap to *contributing*, having
independently noticed the instruction has no polling cap.

**Ruling 7** exists because `instruction_bloat` fired at 15,154ms against a 15,000ms threshold on a
~330-char instruction. **No seed-07 report names it**; both native seed-07 rows name
`tool_output_bloat` at **58,471** and **58,462** chars against a 20,000 threshold. Its premise was
nonetheless *strengthened*: native LLM P95 ran 4,090 → 97,065ms across the ten native rows, with
**six of ten at or above the 15,000ms threshold**. **Do not read a ruling's non-use as evidence it
was unnecessary.**

### AO5. What the pass could not do, carried forward

- **Not single-variable against v13** (§AN1a): ZP10 Hotfix 3 → 4a landed between the passes. The
  anchor arm is a control, and **eight rows cannot resolve a small patch effect** — a clean AN-3 is
  equally consistent with "the patch changed nothing" and "the patch changed something these two
  seeds do not exercise."
- **§T8 carried verbatim.** Twenty rows, five seeds, one instance, one day, one model, one app
  version, two patch levels across the comparison. **Not a rate.**
- **The custom arm produced no report at all on both seed-05 rows** (06, 08), failing identically
  with `unknown action: agent_config` on the `agent`+`timeframe` path while the same tool succeeded
  on the `execution` path in rows 02 and 04. Scored, not void, per §A3 as amended by §AK. **This is
  a reproducible defect and is not yet filed as an issue.**
- **§AJ5a and §AL6 stand** — v13's five off-fixture custom rows remain unassessed, and this pass does
  not reopen them.

### AO6. Instrument changes made during this pass, all disclosed

1. **The packet generator gained `NO_REPORT_SPLIT`** — a `failed` terminal is now satisfied by
   either a validator rejection **or** an explicit no-report marker. v14 rows 06 and 08 failed before
   any report body existed, and the sole failure slot was labelled `VALIDATOR REJECTION`; using it
   would have told twenty scorers the fix-report validator ran when it never did. Additive: carrying
   both markers is now itself a refusal, and no previously-representable row is treated differently.
   Pinned by `packetGeneratorPassSelection.test.js`. **§AK left the adjacent `genai_down` case
   explicitly undecided; this does not decide it.**
2. **`buildAll('v14')` is pinned by a test**, not by the operator having run the CLI once — running
   it by hand is the substitution §AN7 item 14 exists to name.
3. **Two seed-08 fixtures were discarded and re-produced**, and the reasoning was wrong twice before
   it was right — `raw-evidence-v14-out-of-sample.md` §2.6 and §2.7 carry the full retraction:
   concurrency was blamed for a slowdown it did not cause, a starvation diagnosis was raised against
   a run that had already finished, and `PATCH sn_aia_execution_plan.state` turned out to be
   cosmetic. **Row 01 was proposed for voiding on that diagnosis and the proposal was withdrawn on
   measurement.**

4. **A dispatched-instrument defect, found by review AFTER scoring and disclosed rather than
   repaired.** The four seed-05 packets shipped `**Execution under diagnosis:** `null`` — the
   manifest sets `target_execution: null` for a seed that has no execution by design, and the
   renderer's parenthesised-description branch (v12 wrote `(none — no execution plan was created)`)
   fires only on a string starting `(`. Nothing validated the field. **The four rows are not
   re-scored**: the packets were dispatched, the manifest is frozen (§T9), and editing either
   destroys the record of what the scorers read. Reach is bounded — each packet also carries seed
   05's spec saying in its own words that the seed produces no execution plan, and all four returned
   `ambiguous = no` — but it is an instrument defect and is recorded as one. **Fixed forward through
   §AM2's derived boundary**, not a new mechanism: a non-string `target_execution` refuses on a pass
   that can still comply and reports on a dispatched one, both halves pinned by tests. Scorecard §6.

**Three operational corrections worth more than the pass:** terminal state comes from
`servicenow_aia_trace`, **not** the plan row (v13 §3.3 / §AC7's "or the plan row" is wrong — they
disagree); liveness is judged from instance timestamps, never from elapsed wall clock estimated in
conversation; and a bad field name reads as "Access denied" on this instance, discriminated **only**
by a bare query carrying neither `query` nor `fields`.

---

## AP. The smoke gate keeps its target; its second answer is recorded, not binding (`2026.08.1111`, #185)

The known-answer smoke gate (`benchmark/README.md` step 3, made a pre-flight item by §AN7 item 10)
targets execution `c9d63a932bda8b9417a6ffbeee91bfd0`. The agent that execution ran under has been
deleted, so the fixture is permanently unsweepable on **layers 2, 3 and 7** — the whole
`agent_config` surface — and that tool returns `empty` for every arm on every future pass. Filed from v14 stage 1 (`raw-evidence-v14-out-of-sample.md`
§1.9b) rather than absorbed.

### AP1. The finding, re-verified live before ruling on it

Probed on gpinst01 (Zurich P10 Hotfix 4a) 2026-08-11, after v14 merged:

| probe | result |
|---|---|
| `sn_aia_agent^sys_id=601672d32b1a83d0f243fed2ce91bf3e` | **0 records** — deleted as Phase 0 probe cleanup (`docs/PREFLIGHT_FINDINGS.md`, "Probe records — created and deleted") |
| `sn_aia_execution_plan^sys_id=c9d63a93…` | **present** — `state=Completed`, `state_reason` empty |
| `sn_aia_execution_task^execution_plan=c9d63a93…` | **11 tasks** — 4 `tool`, 4 `gen_ai`, 1 `agent`, 1 `access_verification` |
| `sn_aia_agent^sys_id=cd050d48e810411d9f113fd530694fe6` (control) | **Seed 02 Request Router**, scope `TS Bench Seeds` |

One fact the issue did not carry, and it decides the options: **the plan's own `agent` and
`usecase` reference fields are empty too.** The fixture never pointed at the agent record by
reference — the sys_id survives only inside the error JSON in the agent-role message. The
header-invisible property the gate was chosen for is intact, and the line-42 answer still
discharges: v13 §1.6 and v14 §1.9 both passed both arms on it.

### AP2. Ruling — the gate is an instrument check, and quality criteria may not enter it

**The target is kept. The binding criterion is unchanged and singular:** `script_error` citing
`context_processing_script` line 42, both arms.

**The deleted-agent shape becomes a documented second known answer, explicitly UNSCORED and
NON-BINDING.** An arm that reads `empty` as a privilege gap — as v14's native arm did, producing
FIX-2 to grant read access to a record that is gone — is recorded in that pass's raw-evidence file
and measured nowhere else.

The reasoning is the ruling's reusable half, and it is the reason the tempting stricter option was
refused: **a gate checks instrument readiness; a rubric checks subject quality.** Promoting the
second answer to a pass/fail criterion would let a poorly-performing arm veto the pass — v14 would
have been blocked by it — and would bias every future pass toward firing only when the arms had
already done well, which is measurement contaminated by its own subject. The gate answers "can a
known answer still be recovered from this instance at all"; the twenty scored rows answer "how well
does each arm diagnose". §AN7 item 10 is unchanged in force and unchanged in text.

### AP3. What was rejected, and why the cheap option was not the weak one

- **Restore the agent record — rejected as fabrication, not restoration.** The original
  `context_processing_script` was platform-auto-populated (~2,124 chars, LLD §5) and is recorded
  nowhere in this repo; the agent's tool and m2m rows were deleted with it. Re-creating the row
  means authoring a script and *declaring* line 42 to be its answer — a fixture that looks
  authentic and is not, hand-built on the instance against the SDK-owns-creation boundary.
- **Re-point the gate at a live-agent specimen — rejected as disproportionate and circular.** The
  answer is cited in DESIGN.md R-16, LLD §5, two build briefs and the README, so
  re-pointing is a documentation cascade; and a new known answer would have to be established using
  the instrument the gate exists to check.
- **Document it — accepted, and it is not the null option.** The rot is converted into signal: a
  deleted agent is a real diagnostic scenario with a correct answer, and it happens to exercise the
  exact tool-contract inversion (`empty` ≠ `DENIED`) the rubric grades.

### AP4. What a future pass does differently

1. Reads the gate section knowing **layers 2, 3 and 7** are `empty` **by construction**, so an
   unexplained empty read is not re-diagnosed as an instance regression mid-pre-flight.
2. Runs the **control probe** (seed 02's agent) before concluding anything about permissions. Seed
   agent readable + gate target empty = fixture rot, proceed. Seed agent *also* empty or denied =
   **stop**, the scored seeds are at risk. Two look-alikes are named in the section: a bad field
   name reads as `Access denied` on this instance (v13 §1.7), and a table with no ACLs denies admin
   too (Build Rule #42).
3. Records an arm's `empty`-as-privilege-gap misread in raw evidence, unscored, and does not hold
   the pass for it.

The agent sys_id `601672d32b1a83d0f243fed2ce91bf3e` is added to the gate's `blind-rule-tokens`
block — this ruling makes the deleted record part of the documented answer, and unlike
`context_processing_script` a specimen-specific sys_id has no honest reason to appear in tool code.
Swept at declaration: zero hits across all 16 model-facing sources.

**One inconsistency found while ruling and fixed in the same pass.** The Task 12 pre-flight record
in `benchmark/README.md` says the gate is only that both harnesses *"run to terminal with valid
outputs, not that they diagnose correctly"* — a weaker criterion than step 3's, and one that would
have passed an arm that never found line 42. v13 and v14 both applied the known answer. Step 3 now
states the binding criterion outright and marks that sentence as that pass's own reading, kept as
history and not to be re-derived as protocol. The historical paragraph is left standing.

---

## AQ. Pre-registration — the depth-gate empty-trail floor (`2026.08.1114`, #191)

**Written and committed before a single line of gate code. §A through §AP are unmodified** —
`git log -p benchmark/DECISION.md` is the check, in the form §W, §Z, §AC, §AE, §AF, §AG, §AH, §AI,
§AK, §AL and §AN all used. **This section claims no result.**

It exists because the change it describes moves an instrument that v13 (§AJ) and v14 (§AO) were
both scored against. §AO3 is the cautionary case: the operator changed the scorer instruction
between passes and the v13→v14 determinacy *comparison* was voided even though both passes'
absolute figures stood. A silent gate change would do the same thing to the custom arm's gate
figure, one pass later and for the same reason.

### AQ1. The defect, and why #191 part 1 does not close it

Measured live on gpinst01, both reps of the seed-05 `agent`+`timeframe` path (`TR1000315`,
`TR1000316`, 2026-08-11). The model files a terminal `fix_report` on its **first** reasoning turn
having called nothing, declaring layer 1 `UNAVAILABLE` and **layers 2-7 `SWEPT`** with empty
reasons (`sys_generative_ai_log` `af199457…`).

`unsweptGaps` counts only `NOT_SWEPT`. A blanket false `SWEPT` therefore declares no gap,
`open.length === 0`, and `_depthGate` releases permanently. **This is not a gate malfunction.** The
gate enforces gaps the model ADMITS, by design — §H8 item 3, the harness must never name a tool
itself — so a report that admits nothing is unholdable by construction. It is the same shape §AL
ruled on: the gate lacks an operand, rather than failing to check one it holds.

**#191 part 1 (`f1f9d7a`, `2026.08.1113`) fixed the validation half only.** `_checkSweptClaims`
can now fire on a genuinely empty trail, so the run fails naming the real defect ("6 layer(s) are
marked SWEPT but this run never invoked a tool that reads them") instead of a symptom. It does not
make the arm produce a report: the tool-less repair turn cannot gather evidence, and
**`MAX_EVIDENCE_RETURNS` stays `0`** — §W6-ruled, refuted 1-of-10, and not reopened here.

So the custom arm's 0/10 on this path is currently attributable to a gate that cannot hold, and
that is the thing this change moves.

### AQ2. The change, stated precisely enough to falsify

**A floor: an empty release set cannot support a terminal report, whatever `layers_swept` claims.**

Inside `_depthGate`, at the existing no-declared-gap allow and nowhere else:

```
var open = this._openGaps(this._safeGaps(action.report), release)
if (open.length === 0) {
    if (release.length === 0) {            // #191 THE FLOOR
        this._holdCount += 1
        return { hold: true, gaps: [], kind: 'empty_trail', target: null, capped: false }
    }
    this._gateReleased = true              // unchanged
    return { hold: false, ... }
}
```

**Eight properties, each of which is a thing a review may check.** Items 5-7 were added after the
first draft of this section was reviewed; each is a collaborator the floor's return value flows
into that the draft did not name, and two of them made this section's own predictions
unmeasurable. Recorded rather than quietly folded in, because *"the spec listed the properties a
review may check and the review found three more"* is the finding.

1. **It sits BELOW the `MAX_HOLDS` cap.** The cap is tested fourth and is unmoved, so the floor can
   never outlive it: worst case is two held turns and then a flagged `capped:true` release. This is
   R2's lesson applied rather than re-learned — a hold path the cap cannot reach rides to
   `MAX_ITERATIONS` and finishes `partial`, which is a pre-registered revert trigger (C1).
2. **It records nothing.** `_heldTools` stays null, so the hold is NOT sticky and each turn
   re-derives.
3. **It intercepts one path only.** The `no_layer_report` hold (non-`fix_report` actions) and the
   `gaps` hold (declared gaps, empty trail) are untouched, because both already hold. Only the
   allow at `open.length === 0` changes, and only when the trail is empty.
4. **It names no tool.** `_holdBlock` gains an `empty_trail` branch worded like the existing
   `no_layer_report` one ("call a tool", never *which*). **Note what does NOT protect this path:**
   that branch returns early and renders no model-authored text, so there is nothing for
   `_scrubToolNames` to strip and the §H8 item 3 guarantee rests **entirely on the authored
   wording**. §S is the standing reminder that this harness has named its tools before without
   noticing. **If this block names a tool the acceptance test is vacuous and the change is void.**
5. **`_holdActive` must be cleared on compliance, and property 2 is why it is not automatic.** The
   I1 clear (`PaAgentLoop.js:391`) is `_anyOf(this._heldTools, [action.tool])`, and the floor
   leaves `_heldTools` null, so `_anyOf(null, …)` is false and the block survives: the model
   complies by calling a tool and its **next** prompt still carries *"a terminal action is not
   available yet"*. That is the exact defect I1 was written to fix, reintroduced on a new path,
   landing on the turn AQ-1 and AQ-2 measure. The floor's clear condition is therefore **any
   successful dispatch while the active hold is `empty_trail`** — the floor asks for a tool call,
   not a *particular* tool call, so any call discharges the prompt block. (The pre-existing
   `no_layer_report` hold shares this defect and is out of scope here; filed separately.)
6. **`_holdNote` gains its own branch, and AQ4/AQ5 depend on it.** `_holdNote`
   (`PaAgentLoop.js:1553`) branches only on `no_layer_report`; everything else falls through to the
   `gaps` wording. An `empty_trail` hold carries `gaps: []`, so the transcript would read
   `HOLD: terminal action refused — layer(s)  declared NOT_SWEPT with no tool call behind them.` —
   an empty layer list and a claim that is **false** on this path, since nothing was declared
   `NOT_SWEPT`. **A floor hold would be byte-indistinguishable from a degenerate `gaps` hold, which
   makes AQ-3 and revert trigger 1 unfalsifiable as this section originally wrote them.** The
   branch must emit a distinct marker naming `empty_trail`, under the same 200-char `DIGEST_CHARS`
   ceiling.
7. **`_depthGate`'s return contract is updated in the same commit.** Its docblock currently states
   `kind` is `''` on every ALLOW path and that *"only the two HOLD paths use the other two
   values"*, and enumerates `target` per path. A third `kind` breaks that enumeration, and the
   docblock is the only written spec of the return shape.
8. **It reads `release`, not `trail.tools`.** So it inherits `REQUIRE_RETRIEVAL_TO_RELEASE`, which
   **stays `false`** — §Y6's bar is not cleared here and this section does not reopen it (§AL4).

### AQ3. What it costs, declared before it is spent

**The custom arm's gate figure stops being comparable across the v13/v14 → v15 boundary.** v12
(6/10 native, 0/10 custom), v13 (4/10, 0/10) and v14 (5/10, 0/10) were all measured against a gate
with no floor. Any v15 custom figure is measured against a different gate.

Stated as the rule the next pass must apply: **the v15 custom gate figure may be reported
absolutely and may NOT be differenced against v12/v13/v14** — the §AO3 treatment, applied in
advance rather than discovered afterwards. The native arm is unaffected (it does not run this
harness), so the native series remains continuous and §AD7 still requires both arms be quoted
together.

Second cost, smaller and worth naming: two extra LLM turns per affected run in the worst case,
which spends budget the `partial` guard is watching. AQ5's first trigger is the bound on it.

### AQ4. Predictions, filed before any run

Four reps of the seed-05 `agent`+`timeframe` path, run under the smoke protocol, custom arm only.

**The baseline is 0-of-4 for AQ-1 and AQ-2 ONLY** — v14 rows 06/08 (#188, died at the parser) and
the two post-fix reps `TR1000315`/`TR1000316` (#191, died at validation) recorded no tool call and
no valid report between them. **AQ-3 and AQ-4 do not share that baseline and must not be read
against it:** they are negative tripwires, and with no floor in existence both were *trivially
satisfied* 4-of-4 rather than failed 0-of-4. Saying "0-of-4 on every count" would invert them into
claiming the tripwires start failed, so that any non-firing reads as an improvement the floor
earned. It is not — a silent tripwire is the null result.

| # | Prediction | Falsified by |
|---|---|---|
| **AQ-1** | ≥3 of 4 reps record **at least one tool call** (`x_snc_troubleshoot_audit` non-empty) | ≤2 of 4 |
| **AQ-2** | ≥1 of 4 reps produces a `fix_report` that **passes validation** | 0 of 4 |
| **AQ-3** | **Zero** runs finish `partial` with a floor hold in the transcript | any such run |
| **AQ-4** | The floor fires on **no** `execution`-path row — those runs call a tool before any terminal action | any `empty_trail` hold on an `execution` row |

**AQ-1 is the primary.** AQ-2 is secondary and deliberately weak: the floor buys a tool call, and
whether the model then writes a citable report is a *correctness* question this change does not
claim to answer (§AC8's caveat, unamended). AQ-3 and AQ-4 are tripwires, not results — neither
counts toward the change succeeding, and both are revert triggers below.

**No prediction is filed on the pass-level gate figure**, in either direction. Ruling 6 (§AI4,
carried at §AN) applies: a gate prediction not filed may not be claimed afterwards.

### AQ5. Revert triggers — any one of these reverts the floor, no re-litigation

1. **Any run finishes `partial` with an `empty_trail` hold in its transcript.** C1's original
   trigger, unmodified. The cap is supposed to make this unreachable; if it is reached, the
   placement argument in AQ2 item 1 is wrong.
2. **MORE THAN ONE of the four reps takes the `capped:true` exit** after spending its holds on the
   floor. The threshold is deliberate and the first draft of this trigger did not have one: it
   read *"the capped-release rate rises above its v14 level"*, and on the comparable v14 rows the
   gate issued **no holds at all** (they died at the parser), so that baseline is 0 and **any**
   single non-compliant rep would have tripped it. AQ-1 predicts ≥3 of 4 comply — i.e. one
   non-compliant rep is a **predicted-pass** outcome, which would have fired a no-re-litigation
   revert trigger on the success case. A trigger that fires on the outcome the section predicts is
   not a trigger; it is a guaranteed revert with extra steps. Bounded at >1 of 4, which is the
   same thing as "AQ-1 failed, and expensively".
3. **`_holdBlock`'s `empty_trail` text names a tool.** By authoring — per AQ2 item 4 there is no
   model-authored text on this path and therefore no scrubbing to fall back on. §S is the standing
   reminder that this harness has named its tools before without noticing.

### AQ6. What this does not decide

- **Whether the custom arm can diagnose a no-execution scenario.** It removes one blocker. #188
  found two on this path; nothing rules out a third.
- **Whether the reports are RIGHT.** §AC8, and §AO2's demonstration that a row can score 6/6 while
  proposing a fix at a column that does not exist. Determinacy and correctness are separate axes
  and this change touches neither directly.
- **`MAX_EVIDENCE_RETURNS` (`0`, §W6) or `REQUIRE_RETRIEVAL_TO_RELEASE` (`false`, §Y6/§AL4).** Both
  frozen. Neither is a lever this section is permitted to pull, and a future section proposing
  either must clear its own bar, not this one's.
- **Anything about the native arm.** It does not run `_depthGate`.

---

## AR. Verdict — the depth-gate empty-trail floor, measured (`2026.08.1116`, #191)

**§AQ was pre-registered at `4173d6a` and the floor built at `b6d2abe`, both before these reps.
§A through §AQ are unmodified — `git log -p benchmark/DECISION.md` is the check.** Measurements:
`benchmark/raw-evidence-v15-aq-floor.md`. Four reps, seed-05 `agent`+`timeframe`, custom arm only,
gpinst01, 2026-08-11.

### AR1. The scoreboard §AQ4 asked for

| # | prediction | falsified by | measured | verdict |
|---|---|---|---|---|
| **AQ-1** (primary) | ≥3 of 4 reps record ≥1 tool call | ≤2 of 4 | **4 of 4** | **PASS** |
| **AQ-2** | ≥1 of 4 produces a `fix_report` passing validation | 0 of 4 | **2 of 4** | **PASS** |
| **AQ-3** | zero runs finish `partial` with a floor hold | any such run | **0** | tripwire silent |
| **AQ-4** | the floor fires on no `execution`-path row | any such hold | **not exercised** | see AR3 |

Baseline was 0 of 4 on AQ-1 and AQ-2 (§AQ4: v14 rows 06/08 died at the parser, `TR1000315`/
`TR1000316` died at validation, no tool call and no valid report between them). Every rep carries
the `empty_trail` hold — `transcriptLIKEHOLD (empty_trail)` matches 4 of 4.

**No revert trigger fired.**

1. *Any run finishes `partial` with an `empty_trail` hold.* Zero runs finished `partial`. Not fired.
2. *More than one rep takes the `capped:true` exit.* **0 of 4** — `transcriptLIKEhold cap was
   reached` matches nothing. `MAX_HOLDS` is 2 and **every rep spent exactly 2 holds, verified per
   rep** (`empty_trail` 4 of 4, `gaps` 4 of 4 — evidence §1), so the cap check was live on all four
   third-terminal-actions; R1's trail-check-before-cap ordering released them as genuine compliance
   instead. Threshold was >1. Not fired.
3. *`_holdBlock`'s `empty_trail` text names a tool.* It does not — text quoted in the evidence
   §0.4. Not fired.

**The floor stands.**

### AR1a. The shipped floor is NARROWER than §AQ2 pre-registered, and §AR must say so

Found by `/code-review` on PR #197, after that PR had merged. **§AQ2's snippet specifies:**

```
if (release.length === 0) {            // #191 THE FLOOR
```

**`PaAgentLoop.js:1161` ships:**

```
if (release.length === 0 && this._dispatchCount === 0) {
```

The conjunct is right and its reasoning is sound — an empty `release` is **not** proof the run
invoked nothing, because `no_audit_rows` reads identically for a systematic audit write loss, and
without the conjunct the harness would make two contradictory claims about one run (`_auditContext`
writing *"audit trail LOST WRITES — this run dispatched N tool call(s)"* while the gate floors that
same run for having called nothing). It arrived as a #193 review finding and is documented at
`PaAgentLoop.js:1145-1160` and in the `2026.08.1115` CHANGELOG entry.

**It was never written into the decision ledger.** Before this section, `_dispatchCount` appeared
**zero times** in `DECISION.md`. §AR opened by inviting the reader to audit spec-to-verdict fidelity
with `git log -p benchmark/DECISION.md` — and that audit would have concluded the built floor
matched the pre-registered condition, because the ledger contained nothing to contradict it.

Recorded as a deviation, not a defect: the floor as built is **strictly narrower** than the floor as
registered, so every §AR1 result was produced by a gate that holds on a *subset* of what §AQ2
described. AQ-1 and AQ-2 are unaffected in direction (a narrower floor can only fire less often, and
it fired 4 of 4). The rule this earns, stated for the next pre-registration: **when a review changes
the registered condition between pre-registration and build, the amendment belongs in the ledger at
that moment — a code comment and a CHANGELOG bullet are not the ledger**, and §AQ's own opening
claim ("§A through §AQ are unmodified") is precisely what makes the ledger the thing a reader
trusts.

### AR2. What was NOT predicted, and is the more interesting result

§AQ1 ruled the gate *unholdable by construction* against a report admitting nothing, since
`unsweptGaps` counts only `NOT_SWEPT`. In all four reps, the turn after the floor fires the model
stops claiming a blanket `SWEPT` and declares layers honestly `NOT_SWEPT` — which makes the
**pre-existing `gaps` hold reachable**, and it fires (rep 1 seq 6: *"layer(s) 4, 5, 6 declared
NOT_SWEPT with no tool call behind them"*).

So the floor did not just buy one tool call. It restored the operand the rest of the gate was
missing. §AQ2 property 3's claim that the floor "intercepts one path only" is true of the code and
was never a claim about downstream behaviour; recorded here because a property spec that holds
literally while the system changes elsewhere is worth naming as a pattern, not smoothing over.

§AQ2 property 5 — the clear the review added, without which the hold block would have survived the
compliant dispatch and landed on the exact turn AQ-1 and AQ-2 measure — is **verified live**, not
inferred: the block's text appears in exactly four prompts in `sys_generative_ai_log`, one per run.

### AR3. AQ-4 is untested, and says so

Every rep ran the no-execution (`agent`+`timeframe`) path. **No `execution`-path row ran, so AQ-4
had nothing to fire on.** It is recorded **not exercised** — not "passed". §AQ4 already ruled that
a silent tripwire is the null result and must not be read as an improvement the floor earned; the
same discipline forbids reading an *unrun* tripwire as a clean one. AQ-4 remains open for the first
pass that puts an execution-path row through this gate.

### AR4. What this closes, and what it does not

**Closes #191's headline.** *"The custom arm files a fix_report with zero tool calls on the
no-execution path, so the two-distinct-sources evidence rule can never be satisfied"* is refuted:
4 of 4 call tools and 2 of 4 satisfy the rule. #191 part 2 is done.

**Does not close the path.** Two of four still fail the evidence rule at one distinct source. That
is a report-quality question this change never claimed (§AQ6, §AC8 unamended).

**No figure is claimed, in either arm.** §AQ4 files no prediction on any gate or pass-level figure
and ruling 6 (§AI4, carried at §AN) forbids claiming one afterwards. No scorer ran, no packet was
built, no rubric was applied. The two validated reports are a **determinacy** fact only, and §AO2
stands: a row can be fully determinate and wrong.

**§AQ3's cost is now incurred and its rule is live.** The custom arm's gate figure is measured
against a gate with a floor from here on. **A v15+ custom gate figure may be reported absolutely
and may NOT be differenced against v12 (6/10 native, 0/10 custom), v13 (4/10, 0/10) or v14 (5/10,
0/10).** The native series is unaffected and §AD7 still requires both arms be quoted together.

**Unblocks #196.** §AQ's four reps are spent, so the `no_layer_report` stale-HOLD fix is no longer
gated. Its defect did not reproduce on the floor path (AR2 verified the floor's own clear works),
so #196 stands unmeasured and its one-token fix is unaffected by anything here.

### AR5. A deployment finding that outranks the pass

**The floor was merged and unmerged-from-reality: `b6d2abe` sat in `main` while gpinst01 ran code
older than both #191 commits.** Caught by the §AQ pre-flight content probe, which is the only
reason these reps measured the floor rather than its absence.

`sys_updated_on` on this app's script includes **does not move on install** — `PaAgentLoop` read
`2026-08-02 05:15:25` both before and after an install that provably changed its content. §AN7
item 1 already forbade trusting a version string; extend it: **trust neither the version string nor
the row timestamp. Probe content.** A pass that had skipped this probe would have measured the
pre-floor harness, found the §AQ4 baseline reproducing exactly, and concluded the floor did not
work — the most expensive kind of wrong answer this project can produce, and it was one skipped
probe away.

---

## AS. The `no_layer_report` stale HOLD, closed on the same mechanism (`#196`)

**One-token change, no pre-registration, and it is still an instrument change** — which is why it
is recorded here rather than only in the code and CHANGELOG. That distinction is §AR1a's lesson
applied on the first opportunity after it was learned: the ledger's job is to record what the
harness DID, at the moment it changed, not to be reconstructable from a diff later.

### AS1. The defect and the fix

`_holdActive`'s dispatch-side clear read:

```js
if (this._holdActiveKind === 'empty_trail' || this._anyOf(this._heldTools, [this._str(action.tool)]))
```

`no_layer_report` records nothing — `_heldTools` is assigned a NON-NULL value on exactly ONE line
(`_resetGate` also nulls it; that is the only other assignment), the `gaps` return
at the foot of `_depthGate` — so `_anyOf(null, …)` is false, the `empty_trail` clause does not
cover it, and the hold block survived a compliant tool call into the very next prompt. That is I1's
defect (`PaAgentLoop.js:380-393`) on its third path, and the hold's own text asks for the thing that
failed to discharge it: *"…or call a tool."*

Shipped as `!== 'gaps'` — an inversion, not a second clause. `gaps` is the only kind that records a
release set, so it is the only one whose clear should be tool-specific.

### AS2. The direction of the default is the decision, not the token

Listing the two record-nothing kinds and inverting on `gaps` are behaviourally identical **today**
and differ in what a hold kind added LATER inherits: I1's defect, or "any dispatch clears the
block". The inversion is correct because this clear is **prompt hygiene only** — `_depthGate`
re-derives from the trail on the next terminal action, so a tool that ran and retrieved nothing is
still caught at the gate. A wrongly-cleared block therefore costs one prompt; a wrongly-surviving
block actively misinforms a model that just complied. Default toward the failure that self-corrects.

### AS3. Evidentiary standing — unit-tested, not measured

No rep ran this path. #196's non-reproduction during the §AQ reps is true **by construction** (#195
built the `empty_trail` clear, and no rep took the `no_layer_report` route), so this fix stands on a
red-then-green unit test and the single-assignment reading of `_heldTools` — the same footing as
#192's retry repair, and it should be quoted with the same caveat. How often runs reach this hold at
all remains **unmeasured**: the path did not exist in the build v4 ran against, and `_depthGate`'s
own header says so.

**No figure is claimed and no prediction is filed.** Ruling 6 (§AI4, carried at §AN, restated at
§AR4) applies unchanged.

### AS3a. The decision was argued in prose and guarded by nothing (PR #199 review, finding 1)

**Mutating the condition to a bare `if (true)` — deleting the tool-specific clear for `gaps`
entirely, the one behaviour §AS2 exists to preserve — left all 1718 tests passing.** Every test on
this line asserted a block that SHOULD clear; the discriminating case had none. §AS2 named the
`gaps` distinction as *the decision* while the suite was indifferent to it.

Fixed with the paired negative: a `gaps` hold recording `['schema_lookup']`, a dispatch of
`agent_config` instead, and the next prompt asserted to STILL carry the hold block. Re-mutated to
confirm it now fails, and fails alone.

**Rule earned, and it generalises past this PR: when a change's rationale is "these two forms differ
only in what comes later", the test that pins the difference is the deliverable — not the one that
pins the fix.** A positive-only suite ratifies whichever form was written.

### AS3b. The floor does NOT self-correct, and §AS2's argument does not reach it (finding 2)

§AS2 justifies the inversion with "the gate re-derives on the next terminal action, so nothing is
papered over." **True for `gaps` and `no_layer_report`, FALSE for `empty_trail`.** `_dispatchCount`
is incremented BEFORE dispatch and counts ATTEMPTS deliberately (`_dispatchTool`, so `_auditContext`
never convicts a run that tried), while the floor reads `release.length === 0 && _dispatchCount ===
0`. One tool call that fails or is refused therefore moves the conjunct off zero permanently, and
the floor cannot fire again in that run — the next zero-evidence `fix_report` releases the gate for
good.

**Pre-existing (#195), not introduced by #196, and NOT fixed here** — the floor's condition is a
registered §AQ2 term as amended at §AR1a, and repairing it inside an unrelated one-token PR is the
§AO3 mistake arriving through the door §AQ was built to close. Filed as **#200**; §AS2's scope is
narrowed in the code comment and above so the claim is not carried further than it holds.

### AS4. §AQ3's cost is not compounded

The instrument now differs from v12/v13/v14 by the floor **and** this clear. §AQ3's rule already
forbids differencing a v15+ custom gate figure against those passes; this change does not widen
that ban, and leaves the native series unaffected. Absolute reporting, both arms together (§AD7).

---

## AT. Amendment — the floor's disarm conjunct reads the wrong counter (`#200`)

**Recorded BEFORE the code, which is the point.** §AR1a's rule was earned two PRs ago: *when a
review changes the registered condition between pre-registration and build, the amendment belongs
in the ledger at that moment — a code comment and a CHANGELOG bullet are not the ledger.* §AS3b
then filed exactly such a change as #200 rather than smuggling it into a one-token PR. This section
is that rule being paid rather than re-learned; `git log -p benchmark/DECISION.md` shows it landing
ahead of the `src/` commit.

### AT1. The defect, and why it is not "flip the conjunct"

`PaAgentLoop._dispatchTool` increments `_dispatchCount` **before** dispatch and counts **attempts**,
deliberately (#191 part 1): `_auditContext` uses it to decide whether an empty trail may **convict**
a report, so every direction it can be wrong in must fall toward NOT convicting — an attempt that
threw, or that a tool refused without auditing (#75), still means the run tried to gather.

The floor reuses that counter for the opposite job — deciding whether to **hold** — where the same
lenient direction is an escape hatch:

1. The model emits `{"action":"tool_call","tool":"bogus"}`.
2. `_dispatchCount` → 1. `PaToolRegistry.dispatch` returns on its unknown-tool gate; nothing is
   audited; `release` stays empty.
3. A zero-evidence `fix_report` follows. `release.length === 0` holds, `_dispatchCount === 0` does
   not, the floor does not fire, and `_gateReleased` is set **permanently** for that run.

One malformed or refused call buys a permanent exit from the exact hole §AQ was written to close.
Flipping the conjunct is not available: the two consumers need opposite failure directions from one
counter — `_auditContext` must **overcount**, the floor must **undercount**. So a second counter,
with `_dispatchCount`'s semantics and #191 part 1's argument left verbatim.

### AT2. The discriminator, stated sharply

Not "successful" dispatches — **dispatches that reached the registry's audit write**. That is the
set the floor's corroboration argument is actually about: an empty trail is ambiguous *only* because
a systematic write loss reads identically to a quiet run, and a call that never attempted a row
cannot explain a missing one.

`PaToolRegistry.dispatch` returns on its two pre-execution gates — unknown tool, and the destructive
fail-closed gate — **before** `_audit('logIntent', …)`. Its `catch` branch does not: `logIntent` has
already run, so a tool whose core throws leaves trail rows and would not have floored regardless.
The gap is exactly the pre-audit refusals, and nothing else.

Shipped shape: the registry marks those two returns `dispatched: false`; the loop keeps a second
per-run counter incremented only when that marker is absent-or-not-false, and the floor reads it.
An absent marker therefore counts — a collaborator or fake that omits the field behaves exactly as
today, so a stale producer can never manufacture spurious holds. `_dispatchCount` is untouched.

### AT3. Ruling on pre-registration — an amendment, not a new instrument term

**This is a correction of an unregistered narrowing, bounded above by the registered condition.**

§AQ2 registered `if (release.length === 0)` bare. §AR1a recorded that the built floor ships the
narrower `&& this._dispatchCount === 0`, and that the narrowing was never written into the ledger.
Audited dispatches are a **subset** of attempts, so this change can only make the floor fire *more*
often, and only up to — never past — what §AQ2 registered. The instrument moves back toward its
pre-registered condition, which is the one direction that needs no new pre-registration.

Consequences, stated rather than assumed:

- **§AQ5's three revert triggers carry forward unchanged.** They already bound "the floor fires too
  often" (a `partial` with a floor hold; >1 of 4 reps taking the `capped:true` exit), which is the
  only direction this change moves. No trigger is re-litigated and none is added.
- **No prediction is filed and no figure is claimed**, in either arm. Ruling 6 (§AI4, carried at
  §AN, §AR4, §AS3) applies unchanged.
- **§AQ3's differencing ban is not widened.** The v15+ custom gate figure was already
  non-differenceable against v12/v13/v14; the native series is untouched (it does not run
  `_depthGate`). §AD7 still requires both arms be quoted together.

### AT4. Evidentiary standing — unit-tested, not measured

**No rep is known to have taken this path.** The four §AQ reps recorded 4-of-4 successful tool calls
(§AR1), so none could have exercised it. Reachability is a question about how often the model emits
an unregistered or refused tool name, and **this repo has not measured that** — treat it as
unmeasured, not unlikely, the caveat `_depthGate`'s own header already carries for the
`no_layer_report` path. Same footing as §AS3 and #192's retry repair, and it should be quoted with
the same caveat.

Per §AS3a, the deliverable test is the one that pins the **distinction**, not the fix: a run that
dispatched a refused tool, whose trail is empty, asserted to floor — which is red against the
shipped conjunct and green after.

### AT5. Residual, named rather than smoothed over — and it is NOT only a wording problem

`_auditContext` keeps the lenient counter, so on a run whose only dispatch was refused it can still
write *"audit trail LOST WRITES — this run dispatched 1 tool call(s)"* when no row was ever
attempted.

**Corrected after PR #201 review, finding 3.** The first draft of this section recorded that
transcript string as the residual, which understates it by a layer. The operative consequence is
that `trailAnsweredEmpty` is false, so `auditAvailable` is false, so `auditEnabled` is false — and
**both audit-gated honesty checks are skipped for the whole report**: `_checkSweptClaims`
(`PaFixReport.js:494`, the check written for exactly the draft §AQ was built against) and
`_checkCitationSupported` (`:751`). End to end: one unregistered tool name, then a zero-evidence
`fix_report` on the capped release, and the citation and sweep cross-checks never run. That is the
#200 escape hatch still open one layer down, and this change ships the very discriminator
(`dispatched:false`) that would close it.

**Still not fixed here, and deliberately.** `_auditContext`'s direction is #191 part 1's registered
behaviour and #78's fail-open rule — narrowing it can convict an honest report, which is a
conviction-policy change needing its own ruling and its own pre-registration, not a rider on this
one. §AT3's scope is the gate. Filed as a separate issue; what changes today is that the residual is
recorded at its real weight instead of as a string.

### AT6. The floor's hold text had to narrow with its counter (PR #201 review, finding 2)

`_holdBlock`'s `empty_trail` branch read *"This run has not called a single tool"*. That was true
while the entry condition was `_dispatchCount === 0`: any attempt disarmed the floor, so reaching
the branch meant no attempt existed. Under `_auditedDispatchCount` the floor fires on runs that DID
emit a `tool_call` the registry refused, and the sentence would then contradict the transcript entry
directly above it — which carries the call and the registry's `Unknown tool` error.

Telling a model that just made an attempt that it made none is the same defect #191 review finding 2
named ("assert ONLY what this branch has established"), arriving through the counter change. The
claim is re-anchored on the **record** — *"No tool call has put any evidence on record for this
run"* — which is the fact the gate actually holds and is true under both counters. §AQ5 revert
trigger 3 is unaffected: the wording names no tool, and the test that pins that is unchanged.

**A moved condition can invalidate the prose that justified it.** The comment above that branch
still cited `_dispatchCount` as "the floor's own entry condition" after the entry condition had
moved; it was accurate when written and false on merge. Worth naming as a class — this ledger's
own §AR1a is the same failure at the level of the ledger rather than the comment.

### AT7. §AT3's trigger claim, stated more exactly (PR #201 review, finding 1)

§AT3 says §AQ5's revert triggers "carry forward unchanged". That remains true — they bound the
direction this change moves, and trigger 2 (>1 of 4 reps taking the `capped:true` exit) is the one
that would fire. It should not be read as "nothing about capped exits changed", because a path
exists that reaches it more readily than before:

`_holdActive`'s dispatch-side clear (§AS2, `PaAgentLoop.js:426`) clears a record-nothing hold block
on **any** dispatch, refused ones included. That was coherent while any dispatch also disarmed the
floor — the block had nothing left to guard. It is no longer: a run can now emit a refused call, get
the block stripped from its next prompt, re-file the same zero-evidence report, floor again, and
spend both holds without ever being told its calls put nothing on record — ending on the cap.

Before this change that run took an immediate permanent release with **zero** holds and no cap; it
now caps. So this change can raise the capped-exit rate on that path specifically. §AS2's clear is
its own registered decision and repairing it inside this PR is the §AO3 mistake §AT was written to
avoid, so it is filed separately — but the interaction is recorded here rather than left for a pass
to discover in its trigger counts.

---

## AU. Pre-registration — the absence-diagnosis target, registration 1 of 2 (`#204`)

**Written and committed before a single line of gate code. §A through §AT are unmodified** —
`git log -p benchmark/DECISION.md` is the check, in the form §W, §Z, §AC, §AE, §AF, §AG, §AH, §AI,
§AK, §AL, §AN and §AQ all used. **This section claims no result.**

**It is explicitly registration 1 of 2, and the ordering is the ruling.** #204's root cause has two
halves — a gate that abandons the only layer able to corroborate an absence, and an evidence rule
that counts the model's self-assigned `source` label rather than the evidence. The obvious repair
is the second one. **Shipping it first would reproduce #78's own failure mode**: with no rep ever
calling `query_table`, target-binding the citation check takes the seed-05 path from 2-of-4
validated to **0-of-4**, and a correct diagnosis of an absence becomes structurally unreportable —
precisely the defect #78 exists to prevent. So the validator change is **blocked** on this one, not
merely paired with it. This section moves the gate so the honest path becomes reachable; only once
that is measured may registration 2 close the dishonest one. They must not ship together: a
combined change cannot attribute the movement, which is §AN1a's single-variable problem the v14
pass already paid for once.

### AU1. The defect, measured

Four reps, seed-05 `agent`+`timeframe`, custom arm (§AR1, `benchmark/raw-evidence-v15-aq-floor.md`).
All four invoked the **identical tool set** — `agent_config`, `read_artifact`,
`schema_lookup(x_snc_tsbench_ticket)`; `TR1000319` added `agent_config(section:triggers)` — and
reached the identical finding. **No rep called `query_table`.** Layer 5 is `NOT_SWEPT` in all four
final reports.

The gate is why. On the second draft the model declared layers 4, 5 and 6 `NOT_SWEPT`, and
`_selectTarget` ranked them:

| open gap | dedicated tools | `_gapFanOut` (min) |
|---|---|---|
| layer 4 | `schema_lookup` | **1** |
| layer 5 | `query_table` (`log_analysis` dropped, fan-out 3) | **1** |
| layer 6 | `genai_log` (2), `log_analysis` (3) | 2 |

Floor is 1, so the floor class is **{4, 5}**. No floor-class member was named in the draft's own
text, so step 2 declined and step 3's structural tie-break — *lowest layer number* — chose **layer
4 by exactly one**. `_heldTools` became `['schema_lookup']`; the model called it; R1 matched and set
`_gateReleased = true` **permanently**. Layers 5 and 6 were abandoned, unswept, with the gate spent.

**The consequence, stated as the defect:** on an absence diagnosis, `data` is the only non-trace
source that can independently corroborate. `config` is where the finding itself came from, and
`schema` is a column definition, not an event — it cannot witness that nothing ran. Layer 5's
dedicated tool is `query_table`, which produces exactly that source. **The tie-break therefore
hands the target to the one floor-class layer whose source cannot corroborate an absence, and
permanently abandons the one that can.** The four reps then split 2/2 on whether the model
relabelled a `config` citation as `schema` — the second half of #204, out of scope here.

This is not a `_selectTarget` malfunction. #116's floor-class rule is working as designed; the
tie-break simply has no notion that one layer's source is load-bearing for this class of
diagnosis, because until #204 nothing had measured that it was.

### AU2. The change, stated precisely enough to falsify

**On an absence diagnosis, layer 5 wins the floor-class tie-break.**

In `_selectTarget` step 3 and nowhere else, when the report declares layer 1 `UNAVAILABLE`, prefer
the layer-5 gap among floor-class members; otherwise the existing lowest-layer tie-break is
unchanged.

**Seven properties, each a thing a review may check.**

1. **Tie-break only — floor-class membership is untouched.** The candidate set is exactly what
   #109/#116 already computed, so this can never select a gap the existing ranking would have
   excluded. Strict subset, the §AT3 bound: it reads no more runs into a target than the current
   rule already admits as equals.
2. **It fires only where layer 5 is ALREADY in the floor class.** If `query_table`'s fan-out ever
   stops being 1, or layer 5 is not open, the condition is inert. It cannot promote layer 5 over a
   cheaper gap.
3. **It reads a declaration the model already makes and already pays for.** `layers_swept["1"]
   .status === 'UNAVAILABLE'` is the same operand branch (B) of the evidence rule keys off
   (`_isTraceUnavailable`, `PaFixReport.js:310`). No new model-authored operand enters the gate.
4. **It does NOT infer the run's subject.** §AL/#173 ruled that a gate deriving its subject from
   model output is released by the model. This compares layer NUMBERS, which are structural — no
   `target_table` comparison, no operand read out of model prose. The #173 line is not crossed.
5. **Release stays total.** `_gateReleased` semantics are unchanged. This changes WHICH gap must be
   discharged, not how many, so no new hold path exists and `_holdCount` accounting is untouched —
   **§AQ5 trigger 2's rate is not raised by construction.**
6. **`_holdNote` and `_holdBlock` wording is unchanged** — they name the target LAYER, never a
   tool (§H8 item 3). §S is the standing reminder that this harness has named its tools before
   without noticing. **If the layer-5 branch causes either to name a tool the change is void.**
7. **The escape is real and is priced.** A model can dodge the layer-5 target by not declaring
   layer 1 `UNAVAILABLE` — but branch (B) is then unavailable to it and it must produce a trace
   citation, which `_checkSweptClaims` and `_checkCitationSupported` police against the audit
   trail. The dodge costs more than compliance. This is a bound, not a guarantee, and it is stated
   here so a pass that observes the dodge can recognise it rather than re-derive it.

### AU3. What it costs, declared before it is spent

**§AQ3's non-differencing rule compounds rather than resets.** The custom arm's gate figure was
already incomparable across v13/v14 → v15 because of the floor. This moves target selection as
well, so the rule stands unchanged and unweakened: **a v15+ custom gate figure may be reported
absolutely and may NOT be differenced against v12 (6/10 native, 0/10 custom), v13 (4/10, 0/10) or
v14 (5/10, 0/10).** The native arm does not run this gate; §AD7 still requires both arms be quoted
together.

Second cost: `query_table` is a heavier call than `schema_lookup` and may return an artifact,
costing a `read_artifact` page and up to two extra turns on affected runs. AU5 trigger 2 bounds it.

Third cost, named because it is the point: **registration 2 will likely make the validated-report
count go DOWN.** Today's 2-of-4 is spurious — both passes rest on a citation mislabelled `schema`
naming a table the run never read. A later honest 0-of-4 or 1-of-4 is the instrument improving, and
§AQ3's ban on differencing happens to protect that reading rather than obscure it.

### AU4. Predictions, filed before any run

Four reps of the seed-05 `agent`+`timeframe` path, run under the smoke protocol, custom arm only.

**The baseline is 0-of-4 for AU-1 and AU-2 ONLY** — §AR's four reps called no `query_table` and
filed no `data` citation between them. **AU-3 and AU-4 do not share that baseline and must not be
read against it:** they are negative tripwires, trivially satisfied today rather than failed, and
§AQ4's warning applies verbatim — a silent tripwire is the null result, not an earned improvement.

| # | Prediction | Falsified by |
|---|---|---|
| **AU-1** | ≥3 of 4 reps record a **`query_table` call** (`x_snc_troubleshoot_audit`, `tool_name=query_table`) | ≤2 of 4 |
| **AU-2** | ≥2 of 4 reps file a `fix_report` whose `root_causes[0].evidence` contains a **`data`** citation | 0 of 4 |
| **AU-3** | **Zero** runs finish `partial` | any such run |
| **AU-4** | **At most one** of 4 takes the `capped:true` exit | 2 or more |

**AU-1 is the primary.** AU-2 is secondary and deliberately measures the *source*, not validation:
a run can still pass validation by the relabel route this section leaves open on purpose, so
"passed validation" would not distinguish the honest path from the one registration 2 exists to
close. **No prediction is filed on the pass-level gate figure**, in either direction — ruling 6
(§AI4, carried at §AN and §AQ4) applies: a gate prediction not filed may not be claimed afterwards.

### AU5. Revert triggers — any one reverts the change, no re-litigation

1. **Any run finishes `partial`.** AQ5 trigger 1's form. Property 5 argues no new hold path exists;
   if a run rides to `MAX_ITERATIONS` that argument is wrong.
2. **Two or more of the four reps take the `capped:true` exit.** Threshold set at 2 for AQ5 trigger
   2's reason: AU-1 predicts ≥3 of 4 comply, so one non-compliant rep is a **predicted-pass**
   outcome and a trigger firing on it would be a guaranteed revert with extra steps.
3. **`_holdNote` or `_holdBlock` names a tool on the layer-5 branch.** By authoring — property 6.
4. **Zero of four reps produce a `fix_report` that passes validation.** §AR measured 2 of 4 on this
   path. AU-2 predicts ≥2 file a `data` citation, so a total collapse of validation would mean the
   change traded a working path for a heavier one — strictly worse at the thing the arm already
   did.

### AU6. What this does not decide

- **Whether the evidence rule should be target-bound.** That is registration 2, and it is BLOCKED
  on this section being measured. The relabel route (`config` evidence labelled `schema`, citing a
  table the run never read) stays open here **deliberately** — closing it before the honest path
  exists is the #78 reproduction this section's preamble rules out.
- **Whether the reports are RIGHT.** §AC8, and §AO2's demonstration that a row can score 6/6 while
  proposing a fix at a column that does not exist. `TR1000319` is the standing local example: its
  fix is a no-op (`active: 0` → `active: 0`, *"No change required"*) citing a `usecase_deprecated`
  field that does not exist. Determinacy and correctness are separate axes.
- **Whether `_selectTarget`'s tie-break is right for any other diagnosis class.** The change is
  conditioned on layer 1 `UNAVAILABLE` and claims nothing outside it.
- **`MAX_EVIDENCE_RETURNS` (`0`, §W6) or `REQUIRE_RETRIEVAL_TO_RELEASE` (`false`, §Y6/§AL4).** Both
  frozen. Neither is a lever this section is permitted to pull, and a future section proposing
  either must clear its own bar, not this one's.
- **Anything about the native arm.** It does not run `_depthGate`.

---

## AV. Verdict — the absence-diagnosis target, measured (`#204`)

**§AU was pre-registered at `f48656d` and the change built at `94cb916`, both before these reps.
§A through §AU are unmodified** — `git log -p benchmark/DECISION.md` is the check. Measurements:
`benchmark/raw-evidence-v15-au-target.md`. Four reps, seed-05 `agent`+`timeframe`, custom arm only,
gpinst01, 2026-08-12.

### AV1. The scoreboard §AU4 asked for

| # | prediction | falsified by | measured | verdict |
|---|---|---|---|---|
| **AU-1** (primary) | ≥3 of 4 reps record a `query_table` call | ≤2 of 4 | **4 of 4** | **PASS** |
| **AU-2** | ≥2 of 4 file a `data` citation | 0 of 4 | **4 of 4** | **PASS** |
| **AU-3** | zero runs finish `partial` | any such run | **0** | tripwire silent |
| **AU-4** | at most one `capped:true` exit | 2 or more | **0** | tripwire silent |

Baseline was 0 of 4 on AU-1 and AU-2 (§AR: no rep called `query_table` or filed a `data` citation).
The target flip is confirmed directly: `layer 5 (ranked) must be reached` matches **4 of 4** and
`layer 4 (ranked)` matches **0 of 4**.

**No revert trigger fired.** Trigger 1 (partial): 0. Trigger 2 (≥2 capped): 0. Trigger 3 (hold
names a tool): the note names the layer in all four, matching the unit test. Trigger 4 (zero
validated): `TR1000324` validated, so 1 of 4.

**On the registered instrument this change passes on every count.** §AV2 is why it must not ship
anyway.

### AV2. §AU6's scope exclusion does not survive the measurement, and that outranks §AV1

§AU6 excluded correctness from scope in these words, verbatim: *"**Whether the reports are RIGHT.**
§AC8, and §AO2's demonstration that a row can score 6/6 while proposing a fix at a column that does
not exist. `TR1000319` is the standing local example … Determinacy and correctness are separate
axes."*

**Quoted exactly because the first draft of this section did not.** That draft attributed to §AU6
the clause *"and this change touches neither directly"* — which belongs to **§AQ6**, not §AU6, and
was imported here from the section §AU was modelled on. Caught in review of PR #206. The
misattribution mattered for the reason the reviewer gave: a future section re-deriving this
section's rule would `grep` §AU6, fail to find the sentence, and be unable to tell a misquote from
an append-only violation. Recorded rather than silently corrected, per §AR1a — a ledger's value is
that its errors are visible in it.

**The ruling survives the correction, on narrower and more accurate grounds.** §AU6 made no
explicit prediction that the change leaves correctness untouched; what it asserted is that the two
axes are *separate*, and then declined to measure one of them. This pass refutes the implicit half
— on this path the axes moved together and in opposite directions — and, more importantly, shows
that the *declining to measure* is what did the damage. The rule §AV4 draws does not need §AU6 to
have made a strong claim; it needs only that a scope exclusion silently gated a merge.

| | §AR (pre-§AU) | §AU (this pass) |
|---|---|---|
| reps calling `query_table` | 0 of 4 | **4 of 4** |
| reps filing a `data` citation | 0 of 4 | **4 of 4** |
| reps passing validation | 2 of 4 | **1 of 4** |
| **reps reaching the seed's actual root cause** | **4 of 4** | **0 of 4** |

Every rep queried **`task`** rather than `x_snc_tsbench_ticket`, got `0 rows / genuinely_empty`,
and filed *"the target record does not exist"* with a fix proposing the record be created. §AR's
four reps all reached `sn_aia_trigger_configuration` `active='0'` — the seed's answer, at the
specific gate. **The change traded four correct diagnoses for four fabricated ones and improved
every registered metric while doing it.**

`TR1000324` is the sharpest single artifact: it validated, on `data` + `config` citations that are
both genuinely supported by tools it actually invoked — the first honestly-sourced two-source
report ever measured on this path — and it is wrong. §AO2 showed a row scoring 6/6 while naming a
column that does not exist; this shows the same thing at the validator rather than the scorer, and
caused by the change under test rather than merely coincident with it.

### AV3. The mechanism, and the general rule it earns

The hold says *"layer 5 (ranked) must be reached"* and names no tool, table or subject — correct,
per §H8 item 3. **The gate has no subject operand at all** (§AL/#173: nothing on the request states
what the run is diagnosing in comparable form). So "sweep layer 5" is answerable only by the model
choosing a table, and it chose wrong four times out of four.

**#173's target-blindness is not uniformly harmless across layers.** A *schema* sweep on the wrong
table yields an inert citation — literally what §AR's reps did, calling
`schema_lookup(x_snc_tsbench_ticket)` and ignoring the result. A *data* sweep on the wrong table
yields `0 rows, genuinely_empty`, which reads as a **positive finding** and licenses a confident
wrong conclusion. **Directing a subject-blind gate at a layer whose evidence is subject-dependent
converts target-blindness from an inefficiency into a fabrication path.**

§AL ruled that a gate *released* by an inference over model output is released by the model. This
adds the dual: a gate that *directs* at a layer whose evidence is subject-dependent will be
answered against a subject the model invents. Both follow from the same missing operand, and #204
is the second site to pay for it.

### AV3a. A registration defect in §AU4 itself, found in review and NOT retroactively repaired

**AU-2 is not a complete partition.** It predicts *"≥2 of 4 file a `data` citation"* and registers
its falsifier as *"0 of 4"* — so an outcome of **exactly 1 of 4 satisfies neither**, and §AV1's
verdict column would have had no defined value for it. AU-1, AU-3 and AU-4 are all complete
partitions; only AU-2 has the gap. Found by `/code-review` on PR #206.

**It did not bite here** — the measurement was 4 of 4 — and it is deliberately **not** amended in
§AU4, because editing a registered prediction after seeing the data is the exact move the
registration exists to prevent. It is recorded here instead.

Had the reps come in at 1 of 4, *"not falsified, no trigger fired"* and *"the prediction failed"*
would both have been arguable **after** the data existed, by whoever preferred the reading — which
is precisely the degree of freedom §Z6 and `LEARNING.md`'s *testing — shaky* entry (a threshold
consulted after the data exists is a degree of freedom, not a criterion) were written to close.
That entry was about *ordering*; this is the same defect in *shape*, and the pass came within one
rep of paying for it.

**Rule for every future registration in this file: a prediction's falsifier must be the exact
complement of the prediction.** AU-2 should have read *"falsified by ≤1 of 4"*. Cheap to check —
read the two cells together and ask which outcomes fall in neither.

### AV4. Ruling

**The §AU change does not ship, and the reason is not a registered trigger.** Every trigger §AU5
filed stayed silent; the disqualifying fact is §AV2, which §AU6 explicitly placed out of scope on a
premise this pass refuted. Recording that plainly rather than letting a clean scoreboard carry the
decision is the whole point of separating the instrument from the verdict.

**A trigger set cannot bound a risk its own section declared out of scope.** §AU5's four triggers
were well-formed and measured what they claimed; none of them could see a correctness collapse
because §AU6 had ruled correctness untouched. The lesson is not "write more triggers" — it is that
a scope exclusion is a *prediction*, and one load-bearing enough to gate a merge deserves the same
falsifiability as anything in the predictions table.

**What survives, and should be kept:** the tie-break machinery is correct and unit-tested; the
self-canonicalising `traceUnavailable` is verified load-bearing by rep 3's live flat-form draft
(§1.5); and §AV5's finding about registration 2 is a real result this pass bought.

**No gate or pass-level figure is claimed, in either arm.** §AU4 filed no such prediction and
ruling 6 (§AI4, carried at §AN, §AQ4, §AU4) forbids claiming one afterwards. No scorer ran, no
packet was built, no rubric was applied. §AQ3's non-differencing rule stands unchanged.

### AV5. What this pass bought for registration 2

Rep 2 was rejected by the **unchanged** `_checkCitationSupported` — *"cites `schema` but this run
never invoked a tool that reads it"*. #204's relabel route passed in §AR only because those runs
called `schema_lookup` to discharge the layer-4 target, which laundered the mislabel; removing that
call removed the laundering.

So the two halves of #204 are coupled in a way the issue did not see: **the gate's target choice
determines whether the evidence rule's class-level check can be fooled at all.** Registration 2
must be re-derived from that, not written to #204's original framing — and it remains blocked,
since this pass did not deliver a reachable honest path.

### AV6. What this does not decide

- **Whether the depth gate should have a subject operand.** §AV3 sharpens the case; §AL's ruling
  that one derived from model output is worthless stands, so a real operand would have to come from
  the request, and `_normRequest` does not currently produce one. Its own section.
- **Whether the §AQ floor should change.** Untouched here; it fired 4 of 4 as designed.
- **`MAX_EVIDENCE_RETURNS` (`0`, §W6) or `REQUIRE_RETRIEVAL_TO_RELEASE` (`false`, §Y6/§AL4).**
  Both frozen, neither this section's lever.
- **Anything about the native arm.** It does not run `_depthGate`.

### AV7. The revert, executed and verified

§AV4's ruling carried out at `56bb249` (`git revert` of `94cb916`), same session.

**Reverted in full, including both helpers.** §AV4 said the tie-break machinery and the
self-canonicalising `traceUnavailable` were worth keeping. On execution that was wrong: with the
tie-break gone **nothing calls either helper**, so `PaFixReport.traceUnavailable` and
`PaAgentLoop._safeTraceUnavailable` would have shipped to the instance as dead code retained
because it had been written rather than because anything needed it. The flat-form finding they
earned is preserved in the evidence file (§1.5) and §AV2 — a lesson does not need its code to
survive.

Verification, run and quoted:

| check | result |
|---|---|
| `npm test` | 33 suites, **1729** tests, all passed — down exactly 14 from `94cb916`'s 1743, the number the change added |
| `now-sdk build` | completed successfully |
| `now-sdk install --alias gpinst01` | rollback context `c3aea3db2ba60b10f243fed2ce91bfff` |
| probe `PaAgentLoop` `scriptLIKE_safeTraceUnavailable` | **0 records** — the §AU code is off the instance |
| probe `PaAgentLoop` `scriptLIKEempty_trail` | **1 record** — the §AQ floor is intact, not collateral |

The second probe is the positive control on the first: a single negative probe cannot distinguish
*"reverted"* from *"the install never landed"*, which is §AR5's hazard read backwards. Both were
run.

**The instance and `main` now agree on the pre-§AU gate**, so the next pass on this path measures
what §AR measured, and §AR's four reps remain the live baseline for anything that follows.

---

## AW. The claim-veracity axis — pre-registration (issue #212)

Filed **2026-08-12**, before any extractor exists and before any report has been read for this
purpose. Design settled in a `/design-spar` sitting; this section is that spar's design record and
is the instrument's registration. **Nothing below may be amended after the first measurement** —
see §AW7.

`DESIGN.md` §5.6 reason 1 is the reopening condition being exercised. This commissions a **new**
instrument. It amends no registered term of v1–v14, so §AO3 is satisfied by construction and
§AQ3 is untouched.

### AW0. The premise in #212 is imprecise, and the correction changes the design

#212 and `DESIGN.md` §5.2 both say correctness "has never been measured." Checked against the
scorecard, that is not what is true:

- `root_cause_layer_correct` (0/2) and `fix_target_correct` (0/1/2) **are** correctness columns —
  4 of the rubric's 6 points — and `root_cause_layer_correct` is **one of the two terms in
  `passes_gate`** (`scorecard-template.md` §A2). Layer-level correctness has been in the gate
  figure since v9.
- Ground truth for them already exists and is already independent of the harness: every seed spec
  declares **Expected root-cause layer** and **Expected fix target**, authored when the defect was
  injected. That is the property R-27 says most fixtures lack.

§AO2 states the real gap in its own closing line: *"The rubric measures whether a report **names**
the right layer, targets the right thing, cites evidence, and reads as usable. It does not measure
whether the report's **factual claims are true**."*

**So what is commissioned here is a claim-veracity axis, not a correctness axis in general.** The
distinction is load-bearing: it means ground truth must come from **instance state**, not from a
finer-grained expected-label in the seed spec. Sharpening the labels — the obvious cheap move, and
the one the issue's title implies — would not have caught a single one of the three known-bad rows.

### AW1. Row 09 adjudicated, before registration, as the feasibility proof

Read live on gpinst01 (Zurich P10 Hotfix 4a) via `sys_dictionary` metadata:

```
x_snc_tsbench_ticket — 8 fields
  sys_updated_on, sys_mod_count, priority, sys_updated_by,
  short_description, sys_id, sys_created_on, sys_created_by
```

**No `type` column. No `category` column.** Row 09's report claimed `schema_lookup` returned
*"`type` (String, max 40) present"* and that `query_table` confirmed values `hardware`/`software`
under it. Both are impossible. Its **Fix 1 repoints the query at a column that does not exist**,
and it scored `fix_usable_unedited` = 1 and cleared the gate.

Three consequences, recorded because they are what justified proceeding:

1. **The oracle is feasible at trivial cost** — one metadata call adjudicated the case §AO2 left
   open since v14.
2. **The drift assumption has its first favourable data point.** §AO2's field account was written
   at v14 time; today's read agrees with it. Two observations, two moments, one answer. Evidence
   against fixture-schema drift, not proof.
3. **§AO2's deliberately-unresolved question is half-answered.** It asked whether row 11's
   empty-table claim was fabrication or a real harness defect (`query_table` cross-scope against a
   zero-ACL table, Build Rule #42). Row 09 is now confirmed **fabrication**, which raises the prior
   on row 11 without settling it. The two readings still have opposite consequences.

### AW2. What the axis measures, and the three-valued verdict

Per claim, one of:

| Verdict | Meaning |
|---|---|
| `refuted` | The instance contradicts the claim, **and a positive control passed** |
| `supported` | The instance corroborates the claim |
| `unresolvable` | The claim cannot be adjudicated — mutable state, an ambiguous probe result, or a control that did not pass |

**Two-valued is forbidden, and the reason is this project's own defect.** `DESIGN.md` §5.3 (#205):
*a data sweep on the wrong table returns `genuinely_empty`, which reads as a positive finding and
licenses a confident wrong root cause.* An oracle that collapses "I cannot see" into "the claim is
false" reproduces the exact defect it is built to detect.

> **Registered principle:** *An instrument's inability to observe must never be recorded as an
> observation.*

### AW3. Ground truth, and the disambiguation rule that makes it safe

Truth is a **live read of gpinst01** (Option B of three considered — see §AW9).

**The probe is chosen so its failure mode is distinguishable.** A field's existence is decided by
**membership in the `sys_dictionary` field list**, never by whether a query filtered on it
succeeds. This matters because `DESIGN.md` §5.4 (#187) records that a **nonexistent field name
returns `Access denied`** — the same bytes a genuinely missing read ACL returns. The query path can
lie; the metadata path has no failing step to misread.

**Every negative is control-paired.** A claimed-absent field is adjudicated `refuted` only when a
probe for a field known to exist on the same table, in the same auth context, passes in the same
call. Control fails → `unresolvable`, never `refuted`. This is §5.5's rule for the #203 null probe
(*"a null result is only worth its probe's sensitivity … record the controls next to the null,
always"*) applied one layer up, and §AV7 is the precedent: it ran a second probe precisely because
one negative could not distinguish *reverted* from *never installed*.

**Extraction is a model's job; adjudication is not.** Claims are prose, so an LLM extracts them.
Adjudication is a **deterministic membership test** over a metadata read — no model judgement, no
scorer packet, no rubric. Where a claim cannot be reduced to a deterministic test, it is
`unresolvable` by definition rather than escalated to a judge.

### AW4. The calibration set, and the cold one-shot

**Sensitivity set: v14 rows 09, 11, 13.** All three were identified as suspect by the operator at
v14 time, for a different purpose, before this instrument was conceived — so the ground truth was
not authored by the thing being tested. n=3, and honest n=3.

**The extractor is written cold.** It is developed against the report *format* only — not against
these three rows, not against synthetic seeded claims, not against the other 17 v14 reports.
Recall is measured against the three **exactly once**.

**The calibration set is a consumable, spent once.** Touch the extractor after seeing the recall
figure and that figure is void — and per §AW8, no recall figure means **no veracity figure either**.
This is what ends the §5.0 loop: the fuel is gone after one burn. It is un-gameable in the sense
#212 asks for because it references **how many times a fixed resource may be consumed**, not any
property of the results.

Rejected, and why: developing against synthetic seeded claims would raise expected recall but
carries R-27 in a new dress — a hand-written fabrication is what the operator imagines fabrication
looks like, not necessarily what the model does, so recall on synthetic faults need not transfer.
Chosen deliberately over expected performance; the honest null is the deliverable.

### AW5. Scope, and the exclusions stated as falsifiable predictions

Per §5.5 — *a scope exclusion load-bearing enough to gate a merge needs the same falsifiability as
anything in the predictions table.* §AU6 excluded correctness on an unfalsifiable premise and the
collapse it missed is why this rule exists.

**In scope:** the **20 frozen v14 reports** (10 native, 10 custom). Not all 60 across v12–v14.

| Exclusion | The prediction it embeds | Falsifier |
|---|---|---|
| **E-1 · v12/v13's 40 reports** | Older passes carry strictly more drift risk and add no calibration value, since all three known positives are v14 | Not free: **if AW-2 returns 0, this exclusion is the first thing revisited**, because "no false claims found" would then be indistinguishable from "looked at too few reports" |
| **E-2 · mutable-state claims (row counts, record existence)** | No mutable-state claim is adjudicable months later from any offline contemporaneous source | **≥1 row-count claim is adjudicable** from an audit payload retained for that run (`PaAuditLogger` persists an `output` payload per `result` row, digested head+tail past `MAX_PAYLOAD_CHARS`) |
| **E-3 · custom-arm extractor recall** | All three calibration rows are **native**, so recall is a **native-arm figure**; it is assumed to transfer to custom | **≥1 custom-arm row where an operator read finds a claim the extractor did not emit.** This exclusion is the weakest link in the registration and is named as such |

### AW6. Predictions, filed before any extractor exists

Falsifiers are exact complements (§AV3a — AU-2 left `1 of 4` in neither band).

| # | Prediction | Falsifier |
|---|---|---|
| **AW-1** | Cold extractor recall on the sensitivity set is **≥ 2 of 3** | **≤ 1 of 3** |
| **AW-2** | **≥ 1 claim is `refuted`** on a row that scored `passes_gate` = 1 | **0 such rows** |
| **AW-3** | **≥ 1 claim lands `unresolvable`** — the third verdict is load-bearing, not decorative | **0 `unresolvable`** |
| **AW-4** | Every schema fact adjudicated that also appears in a contemporaneous v14-era record **agrees** with today's read | **≥ 1 disagreement** — fixture schema drifted, and E-1/AW-1 both need re-reading |

**AW-2 is the one that matters.** It is §5.2's thesis stated as a falsifiable bet: that determinacy
and veracity come apart on rows the gate passed. Row 09 already satisfies it, so AW-2 is
**pre-satisfied and therefore weak evidence** — recorded as such rather than claimed as a result.
Its value is that its falsifier is now impossible, which is itself the finding.

### AW7. Stopping condition — mandatory under #212, written before the first pass

1. **The sensitivity set is spent once** (§AW4).
2. **The pass is one sweep.** 20 reports, one figure pair (veracity, recall), written here. Done.
3. **Findings about this instrument default to documented-not-fixed** — recorded in a §AW-closing
   subsection, not filed as issues. This is the §5.3 pattern, the only mechanism in this project's
   history that has actually stopped this loop.
4. **Reopening needs a named condition**, in §5.6's style, written at the time the pass closes —
   not a general invitation to keep finding things.

### AW8. What the axis may and may not say

- **No veracity figure is reported without its extractor's recall.** *"0 false claims across 20
  reports"* and *"0 false claims, extractor recall 1 of 3"* are different statements and only the
  second is one. This is §AD7's both-arms rule in the shape this instrument needs.
- **Both arms are reported separately** (§AD7). E-3 means the recall figure qualifies the native
  arm only; the custom-arm veracity figure carries that caveat explicitly.
- **This axis does not gate.** `passes_gate` keeps its two-term shape untouched. The veracity
  figure is reported *alongside*, and the two are expected to disagree — the disagreement is the
  finding, not a defect to reconcile.
- **§AI4 stands:** no figure without the instrument that produced it.

### AW9. Alternatives rejected

- **A · Contemporaneous replay oracle** — adjudicate *"tool T confirmed X"* against T's recorded
  output for that `runId`. Drift-immune by construction and catches fabricated citations, the
  strongest class. **Rejected for pass 1:** all three known positives are false-fact-about-the-world
  claims, not fabricated-citation claims; the class has **zero observed instances**, and §5.5's
  rule (a null is worth only its probe's sensitivity) applies to building an instrument for it.
  Also blocked by an arm asymmetry — the two arms persist evidence in different stores with
  different retention, and `_digest` clips payloads head+tail. **Held in reserve**, not discarded.
- **C · Seed-spec closure oracle** — a per-seed fact sheet authored from `benchmark/seed-app`'s
  Fluent source, consulted offline. Fully reproducible and drift-immune. **Rejected:** it records
  what was *intended to install*, and Build Rules #41/#42/#44 are a catalogue of *installed ≠
  declared*; the fact sheet's own correctness would become an unmeasured dependency.

### AW10. What this does not decide

- Whether row 11 is fabrication or the Build Rule #42 harness defect §AO2 named. AW-2's E-2
  exclusion puts it in `unresolvable` unless its falsifier fires.
- Whether the native or custom arm is a front door. This axis reports; `passes_gate` decides, and
  it is unchanged.
- Anything about v12/v13 (E-1), or about runs not in the v14 manifest.
- Whether the extractor is any good beyond its one-shot recall. It is not tuned, by design.
