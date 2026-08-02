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
so no existing unit test would catch this or verify a fix. This is the **leading identified
mechanical cause** of the 0/10 result — named as the primary lead, not asserted as the sole
contributor. Fix and required re-run tracked in
[issue #72](https://github.com/gapietro/tool-foundry-troubleshooter/issues/72).

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
