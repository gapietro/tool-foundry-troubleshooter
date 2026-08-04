# Scoring result — Row 17 (native, seed 05, run 1)

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | 2 | RC-1 (primary): "Layer 7 — Trigger and wiring," Finding: "Trigger is inactive (`active = 0`). The platform will not evaluate its condition or fire the agent while this flag is off..." Matches the seed's expected root-cause layer (`wiring`, layer 7) exactly. |
| `fix_target_correct` | 2 | Fix 1: "Target: `sn_aia_trigger_configuration`, sys_id `bfb77d6c64884500a80203ee029436ee`, field `active`." This names the *specific* gate (`sn_aia_trigger_configuration.active`), not merely "the use case is inactive" in generic terms — per "The two gates" section, this earns full marks rather than the 1-point partial band. |
| `evidence_cites_trace_and_config` | 1 | RC-1's evidence cites `agent_config`'s triggers section (`bfb77d6c64884500a80203ee029436ee`, `active = "0"`) and `overview.active_trigger_links = 0` (config sources), corroborated by `sn_aia_execution_plan` returning genuinely empty in the execution trace (layer 1). Both trace and config evidence cited for the same root cause. |
| `fix_usable_unedited` | 1 | Fix 1 is fully concrete and immediately actionable: "Target: `sn_aia_trigger_configuration` sys_id `bfb77d6c64884500a80203ee029436ee`, field `active`. Current: `0`. Proposed: `1`." A builder AI could apply this record update exactly as written, and it directly addresses the seed's defect. |

**Total: 6/6**

**`passes_gate`:** `root_cause_layer_correct == 2` (yes) AND `fix_usable_unedited == 1` (yes) → **`passes_gate = 1`**

**Note:** Clean hit, not a borderline call. This report's diagnosis lands precisely on the seed's exact expected answer, including naming the specific gate rather than stopping at a generic "inactive" observation — the case the partial-credit band exists for, but this run does not need it. Two secondary/advisory observations (missing tools, unclear run-as identity) are appropriately flagged as not the cause of the current failure and don't compete with the primary, correct finding.
