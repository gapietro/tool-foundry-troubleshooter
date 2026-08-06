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

## U. Pre-registration — the evidence return (`2026.08.06xx`, #81)

**This section was written and committed before a single run fired.** Nothing below was authored
with knowledge of an outcome; the git history of this file is the proof, and the outcome is recorded
in §U7, added by a later commit that does not touch §U1–§U6.

Design: `docs/superpowers/specs/2026-08-06-fixreport-evidence-return-design.md`. Plan:
`docs/superpowers/plans/2026-08-06-fixreport-evidence-return.md`. Measurements, once they exist:
`benchmark/raw-evidence-v10-evidence-return-smoke.md`.

### U1. What is under test

`2026.08.06xx` — the **evidence return** (#81), against `2026.08.0505` (§T).

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
