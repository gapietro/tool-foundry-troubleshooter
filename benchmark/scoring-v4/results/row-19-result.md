# Scoring result — Row 19 (native, seed 05, run 2)

**Seed:** 05 (use case exists but is inactive) · **Harness:** native (Agent Doctor) · **Run:** 2

## Void check (seed 05 §A3)

Seed 05 is void only if the `sn_aia_trigger_agent_usecase_m2m` gate was not
turned on post-install (both gates off, seed isolates nothing). The seed
spec's "OBSERVED AT TASK 12" note confirms the m2m gate was PATCHed on and
re-read `true` prior to this pass, with `sn_aia_trigger_configuration.active`
left `false` as seeded — a single-cause setup. Nothing in this run's report
or measurements contradicts that (the report's RC-1 treats the m2m/use-case
wiring as intact and isolates the single inactive-trigger defect). **Not
void** — scored normally.

## Rubric columns

### `root_cause_layer_correct` = **2**

Expected layer: `wiring` (layer 7). The report's RC-1 explicitly states
`**Layer** | 7 — Trigger and wiring` and identifies the cause as
`sn_aia_trigger_configuration` › Seed 05 Bench Ticket Created having
`active = 0`. This is an exact match to the seed's expected root-cause
layer. Audit-trail measurement independently confirms L7 was actually swept
(`layers_swept: ... L7`), corroborating that the report's claim to have
reached this layer is real, not fabricated.

### `fix_target_correct` = **2**

Expected fix target: activation, specifically naming
`sn_aia_trigger_configuration.active` (per "The two gates" section — naming
only "the use case/trigger is inactive" generically would cap at 1/2
partial credit). This report's Fix 1 names the specific table, sys_id, and
field: `Target: sn_aia_trigger_configuration › sys_id
bfb77d6c64884500a80203ee029436ee`, `Current: active = false`, `Proposed:
active = true`. This is the specific gate, not the generic "inactive" claim
— full credit, not the partial band.

### `evidence_cites_trace_and_config` = **1**

The rubric requires the root cause to cite both the execution trace and a
config/schema source. RC-1's Evidence field cites the config source directly
(`sn_aia_trigger_configuration ... field active, value "0" (agent_config
artifact, triggers section)`). The execution-trace side is established in
the FAILURE SUMMARY immediately preceding RC-1 ("produced zero execution
plans") and in the LAYERS SWEPT table ("Execution trace — SWEPT — zero
execution plans found; absence confirmed as genuine"), which RC-1's
Confidence line draws on ("the only defect is the inactive flag" — implying
everything else, including the absence of any execution, was checked).
Audit-trail measurement independently confirms both L1 (execution trace) and
L7 (config/wiring) were actually swept via `agent_trace` and `agent_config`
tool calls, so the citation is grounded in real tool use, not asserted.

### `fix_usable_unedited` = **1**

Since `fix_target_correct` = 2 (not 0), the cross-column constraint does not
block a 1 here. Fix 1 is a direct, concrete PATCH-shape instruction: flip
`active` from `false` to `true` on the named `sn_aia_trigger_configuration`
sys_id. No placeholder values, no ambiguity about which record, no
manual editing needed before a builder AI could apply it. It also correctly
addresses the actual seeded defect (the trigger-configuration gate, not the
m2m gate, which the seed spec says must stay untouched/already-on).

## Total: **6/6**

## `passes_gate` = **1**

`root_cause_layer_correct == 2` (yes) AND `fix_usable_unedited == 1` (yes)
→ gate passes.

## Notes for a later reader

- This run correctly distinguished the two independent activation gates
  described in the seed spec ("The two gates" section) — it targeted the
  trigger-configuration gate specifically rather than stopping at a generic
  "inactive" diagnosis, which is why `fix_target_correct` earned full credit
  (2) rather than the seed's partial band (1).
- The report's LAYERS SWEPT table claims L4 (Data schemas) was "SWEPT," but
  the audit-trail measurement only credits L1, L2, L3, L5, L6, L7 (6/7,
  excluding L4) as actually swept. This is a report/measurement disagreement
  on a layer not relevant to any of the four scored columns here (L4 is not
  the root-cause layer and not cited as evidence for RC-1), so per the
  packet's instruction to trust the measurement over the report where they
  conflict, it does not change any column score — noted here only for
  completeness/audit-trail transparency.
- The "Anchor-record note" (this run's `x_snc_troubleshoot_run` row stayed
  `status: running` despite the underlying execution completing) is flagged
  in the packet itself as a harness-observation-channel gap, not a scoring
  input, and was treated as such.
