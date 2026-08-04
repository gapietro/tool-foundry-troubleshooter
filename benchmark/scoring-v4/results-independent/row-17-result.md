# Row 17 — native / seed 05 / run 1 — Scoring Result

**Seed:** 05 (use case exists but is inactive) · **Harness:** native (Agent Doctor) · **Run:** 1

## Void check

Not void. The seed-05 void condition requires the `sn_aia_trigger_agent_usecase_m2m`
gate to have been left off post-install (both activation gates off, isolating
nothing). Nothing in this packet's measurements or report flags that condition —
the report identifies a single, specific gate (`sn_aia_trigger_configuration.active
= 0`) as the entire defect and expects activation of that one gate alone to fix
it, with no second wiring defect surfaced. That is consistent with the m2m gate
having been correctly turned on per the seed's mandatory setup step. Scored as a
normal (non-void) run.

## Rubric columns

| Column | Awarded | Justification |
|---|---|---|
| `root_cause_layer_correct` | **2** | Expected layer is `wiring` (layer 7). Report's Root Cause 1 explicitly names "Layer 7 — Trigger and wiring" and identifies `sn_aia_trigger_configuration` as inactive (`active = 0`) as the sole confirmed cause. Exact match to the seed's expected layer. |
| `fix_target_correct` | **2** | Expected fix target is activation of the *specific* gate `sn_aia_trigger_configuration.active`, per the seed spec's partial-credit note ("A diagnosis that identifies only 'the use case/trigger is inactive' without naming `sn_aia_trigger_configuration.active` specifically scores 1 of 2"). This run's Fix 1 names the exact table (`sn_aia_trigger_configuration`), sys_id (`bfb77d6c64884500a80203ee029436ee`), field (`active`), current value (`0`), and proposed value (`1`) — it identifies the specific gate, not just a generic "inactive" observation. Full credit, not the partial band. |
| `evidence_cites_trace_and_config` | **1** | Root Cause 1's evidence line cites both a config source (`sn_aia_trigger_configuration` field `active`, value `"0"`, read via `agent_config`) AND the execution trace (corroborated by `sn_aia_execution_plan` returning genuinely empty in "layer 1" / the trace layer, plus `overview.active_trigger_links = 0` from the same config read). Both source types are cited for the root cause as the evidence rule requires. |
| `fix_usable_unedited` | **1** | Since `fix_target_correct = 2` (not 0), the constraint against awarding this column is not triggered. Fix 1 gives a concrete, directly PATCH-able instruction: exact table, sys_id, field, and the value to set (`active: 1` on `sn_aia_trigger_configuration` sys_id `bfb77d6c64884500a80203ee029436ee`) — no placeholders or manual lookups needed, and it addresses the actual seeded defect. |

**Total: 6/6**

## `passes_gate`

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
            = 1  iff  2 == 2  AND  1 == 1
            = 1
```

**`passes_gate` = 1**

## Notes

- Audit-trail measurement flags a disagreement between the report's LAYERS SWEPT
  table (claims all 7 layers, including L4 "Data schemas," were swept) and the
  audit-trail-derived `layers_swept` (6/7 — L4 not credited). Per the measurement
  primacy instruction, the audit trail's 6/7 is treated as fact over the report's
  claim of 7/7. This discrepancy does not affect any of the four scored columns:
  the root cause and its evidence citation both concern Layer 7 (trigger/wiring),
  which the audit trail does credit as swept, and L4 is not part of the report's
  root-cause chain — it is listed as an unrelated field-warning aside ("`number`
  and `state` columns absent... not relevant to this failure").
- No borderline call on `fix_target_correct`: the run named the specific column
  (`sn_aia_trigger_configuration.active`) rather than stopping at a generic
  "inactive" observation, so full credit (2) applies cleanly rather than the
  seed's partial (1) band.
