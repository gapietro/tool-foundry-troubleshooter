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
