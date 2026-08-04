# Row 09 — native, seed 03 (missing data), run 1

## Scores

| Column | Value | Justification |
|---|---|---|
| `root_cause_layer_correct` | **2** | Seed spec requires root cause at the `data` layer (layer 5). Root Cause 1 in the report names "Layer 5 — Data", component `x_snc_tsbench_routing`, finding "the routing table is genuinely empty," confidence CONFIRMED. This matches the expected layer exactly. |
| `fix_target_correct` | **2** | Seed spec requires fix target "data seeding." Fix 1 — "Seed the routing table" — Target type: Data, Target: `x_snc_tsbench_routing`, proposing row inserts ("Insert at minimum one row per routable category ... Add rows for all categories the agent is expected to handle"). This is an exact match to the expected target, not merely the right area. (Fix 2 is a secondary hardening fix on the tool schema's `category` input, correctly labeled secondary and does not compete with or dilute the primary, correctly-targeted Fix 1.) |
| `evidence_cites_trace_and_config` | **0** | Root Cause 1's own "Evidence" field cites only `query_table` (`unfiltered_row_count: 0`, `verdict: genuinely_empty`) and the "tool call response" (`matched: false, rules_in_table: 0`, sourced from the execution trace) — i.e., trace + data. It never cites `schema_lookup` or `agent_config` output as support for the layer-5 conclusion. The report's LAYERS SWEPT table does show `schema_lookup` (L4) was run, but that is evidence *received*, not evidence *used*: it is never referenced inside the Root Cause 1 justification. The only place `agent_config` output is actually cited in the report is inside the unrelated secondary Root Cause 2 (tool `mandatory` flag), not the data root cause being scored. Per the task instruction that receiving evidence is not the same as using it, this column scores 0. |
| `fix_usable_unedited` | **1** | Fix 1 is correctly targeted (`fix_target_correct` = 2, so the constraint tying this column to 0 does not apply) and is concrete enough for a builder AI to execute directly: it names the exact table, the exact action (insert rows), and the pattern to follow (one row per routable category, e.g. `category = Hardware`, `assignment_group = <target group name>`). The `<target group name>` placeholder requires the builder to resolve real assignment-group values, which is normal implementation discovery work (the seed itself defines no fixed category→group mapping to quote), not a defect requiring the Fix Report itself to be edited before use. |

## passes_gate

```
passes_gate = (root_cause_layer_correct == 2) AND (fix_usable_unedited == 1)
            = (2 == 2) AND (1 == 1)
            = TRUE
            = 1
```

## Total

**5/6**

## Notes

Not a void run — the void conditions in the rubric are specific to seed 5 (activation gate) and seed 4 (capability sys_id mismatch); this is seed 3, scored normally.

The audit trail (`layers_swept` 5/7: L1, L3, L4, L5, L6) does not contradict any claim in the run's own LAYERS SWEPT table — both agree L2 (Instructions) and L7 (Trigger/wiring) were not swept, and the run's own report is consistent with the tool-call order and count given in the measurements. The only scoring-relevant gap is that although L4 (schema) was technically swept, its output was never cited as supporting evidence for the (correct) data-layer root cause — this is what drives `evidence_cites_trace_and_config` to 0 despite an otherwise strong, correctly-targeted diagnosis and fix.
