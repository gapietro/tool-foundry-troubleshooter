# Row 19 — Scoring Result

**Seed:** 05 (use case exists but is inactive) · **Harness:** native (Agent Doctor) · **Run:** 2

## Columns

| Column | Awarded | Justification |
|---|---|---|
| `root_cause_layer_correct` | **2** | Seed expects layer 7 (`wiring`). The report's RC-1 explicitly states "Layer: 7 — Trigger and wiring" and identifies the component as `sn_aia_trigger_configuration › Seed 05 Bench Ticket Created`, matching the seed's expected root-cause layer exactly. |
| `fix_target_correct` | **2** | Seed expects the fix target to name the *specific* gate `sn_aia_trigger_configuration.active`, not just "the use case/trigger is inactive" generically (partial credit is reserved for the generic form). Fix 1's table gives `Target: sn_aia_trigger_configuration › sys_id bfb77d6c64884500a80203ee029436ee`, `Current: active = false`, `Proposed: active = true` — this names the exact gate and exact record the seed spec calls for. Full credit, not the partial band. |
| `evidence_cites_trace_and_config` | **1** | The report cites the execution trace (FAILURE SUMMARY: "produced zero execution plans"; LAYERS SWEPT row 1: "Execution trace — SWEPT — zero execution plans found; absence confirmed as genuine") AND a config source (RC-1 Evidence: `sn_aia_trigger_configuration` sys_id `bfb77d6c64884500a80203ee029436ee`, field `active`, value `"0"`, sourced from the `agent_config` artifact). Both are present, satisfying the evidence rule. Corroborated by the audit-trail measurement showing L1 (trace) among the 6/7 layers swept and no disagreement between report and trail on this run. |
| `fix_usable_unedited` | **1** | The proposed fix is a directly actionable PATCH: flip `active` from `false` to `true` on the named `sn_aia_trigger_configuration` sys_id. It requires no manual editing to apply, and it addresses the actual seeded defect (the trigger-configuration gate being off), so the constraint that `fix_usable_unedited` may not be 1 while `fix_target_correct` is 0 is satisfied vacuously (`fix_target_correct` = 2 here). |

## Total: 6/6

## passes_gate

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
            = 1  iff  2 == 2  AND  1 == 1
            = 1
```

**passes_gate = 1**

## Notes

- No void condition applies to this packet as presented: the packet does not flag the m2m-gate-off / both-gates-off void condition described in the seed spec's §A3-adjacent "must be turned on by hand" section, and the scoring instructions for this row did not direct a void check the way they directed the partial-credit check. Scored as a normal (non-void) run.
- This run correctly avoided the trap the seed spec warns about: it did not stop at the generic "the use case/trigger is inactive" observation, which would have only earned 1 on `fix_target_correct` — it isolated the specific gate (`sn_aia_trigger_configuration.active`) and the specific record, earning full credit.
- The report's own "LAYERS SWEPT" table claims L1–L5 and L7 swept (6/7, L6 explicitly marked "NOT SWEPT (full)" with a stated rationale), which matches the audit-trail-derived measurement of 6/7 (L1, L2, L3, L5, L6, L7) — note the audit trail actually credits L6 as swept (partial/sampled review counted) where the report's own table marks it "NOT SWEPT (full)"; this minor labeling difference does not affect any of the four scored columns since the diagnosis and fix are both independently correct and well-evidenced regardless of the L6 sweep-completeness question.
