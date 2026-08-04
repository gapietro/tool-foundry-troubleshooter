# Rescore Result — rescore-04 (Seed 03, Run 1)

Packet: `benchmark/scoring-v4/rescore/rescore-04-seed-03-run-1.md`

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | **2** | Seed's expected root-cause layer is `data` (layer 5). Root Cause 1 states "Layer 5 — Data," component `x_snc_tsbench_routing`, finding "The table is genuinely empty. No routing rules exist for any category." This is an exact match to the expected layer, not an adjacent or contributing finding. |
| `fix_target_correct` | **2** | Seed's expected fix target is "data seeding," explicitly contrasted with the tool or the instructions. Fix 1's Target type is "Data," Target is "Table `x_snc_tsbench_routing`," and Proposed is "Insert at minimum one row... Add further rows for every category the router is expected to handle." This names the specific target (seeding the routing table), not just the general area, so full credit rather than the 1-partial band (which this seed's spec does not define a case for — only Seed 5 does). |
| `evidence_cites_trace_and_config` | **1** | Per `docs/agent/agent-doctor-instructions.md`'s evidence rule: "Every root cause cites trace evidence PLUS at least one configuration, schema or data source." Root Cause 1's Evidence field cites both: trace evidence via "tool response in execution task `06cd45842b6a4bd417a6ffbeee91bf9c`: `{ ok: true, matched: false, category: "Hardware", rules_in_table: 0 }`" (a tool-call event within the execution trace), and a data source via "`query_table` on `x_snc_tsbench_routing`, unfiltered count = 0, verdict = `genuinely_empty`" (the layer-5 diagnostic query, independent of the trace). Two independent sources are named and used analytically, satisfying the rule as documented (the rubric column's shorthand "config/schema source" is the doc's fuller "configuration, schema or data source," and a data-source citation is explicitly one of the three qualifying kinds). |
| `fix_usable_unedited` | **0** | Not blocked by the `fix_target_correct == 0` constraint (target is correct here), but independently fails on usability. Fix 1's Proposed value is a placeholder, not a concrete value: "`assignment_group = <target group sys_id>` (e.g., the Hardware support group)." A builder AI applying this "as written" cannot insert `<target group sys_id>` literally — it would first have to look up or be told the real sys_id of an actual assignment group on the target instance, which is manual work not supplied by the report. The instruction to "Add further rows for every category the router is expected to handle" is similarly unenumerated — no category list or values are given. This is the same failure shape as an unresolved `REPLACE_WITH_..._SYS_ID`-style placeholder: well-formed as a description of what to do, not mechanically applicable without editing first. |

**Total: 5/6**

**`passes_gate` computation:**
```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
            = 1  iff  2 == 2  AND  0 == 1
            = 0
```

**`passes_gate = 0`**

## Notes

- Not a void run: this is Seed 03 (missing data), and neither of the two documented void conditions (Seed 4, Seed 5) applies to Seed 03.
- Borderline call, flagged explicitly: `fix_usable_unedited` is the only column not scored at ceiling despite a fully correct root cause and fix target. The diagnosis itself is clean and well-evidenced; the run loses the point purely because the fix's data value is a placeholder (`<target group sys_id>`) rather than a concrete insertable value, so a builder AI cannot apply it mechanically without first resolving what real group to use. This is distinct from — and should not be conflated with — the `fix_target_correct == 0` constraint case; here the constraint does not apply at all (target is correct), and the 0 comes from the column's own "as written, with no manual editing first" standard.
- The report's "LAYERS SWEPT" claims (4/7: L1, L2(implicit)/L3/L4(implicit)/L5/L6 marked SWEPT, L7 and platform logs NOT SWEPT) are broadly consistent with the scorecard's measured `layers_swept` value of 4/7 (L1, L3, L5, L6) — no material discrepancy requiring the "measurement overrides report claims" rule to be invoked for the layer-correctness or evidence scoring above.
- Secondary findings (tool-quality smells on `lookup_routing_rule`) are explicitly non-blocking and do not factor into any column.
