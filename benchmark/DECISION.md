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
