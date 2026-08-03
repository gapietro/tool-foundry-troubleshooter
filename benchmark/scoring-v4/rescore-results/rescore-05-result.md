# Rescore Result — rescore-05 (Seed 03, Run 2)

Packet: `benchmark/scoring-v4/rescore/rescore-05-seed-03-run-2.md`

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | **2** | Seed 03's expected root-cause layer is `data` (layer 5). Root Cause 1 is filed explicitly at "Layer 5 — Data," component `x_snc_tsbench_routing`, finding "the table contains zero rows." This is exactly the seed's expected diagnosis, not an adjacent layer. |
| `fix_target_correct` | **2** | Seed 03's expected fix target is "data seeding, not the tool or the instructions." Fix 1 ("Seed the routing table") targets type `Data`, target `x_snc_tsbench_routing, all rows`, and proposes inserting rows per category — the specific target named in the seed spec, not merely "the right area." Full marks; the seed-05-only partial band was not needed. |
| `evidence_cites_trace_and_config` | **1** | The evidence rule (`docs/agent/agent-doctor-instructions.md`) requires trace evidence PLUS at least one configuration, schema, **or data** source — not config specifically. Root Cause 1's evidence cites (a) the tool's execution-trace response in task `06cd45842b6a4bd417a6ffbeee91bf9c` (`rules_in_table: 0, matched: false`) — trace — and (b) the `query_table` result on `x_snc_tsbench_routing` (`row_count: 0`, verdict `genuinely_empty`, unfiltered COUNT also 0) — a data source, with ACL-filtering explicitly ruled out. Both are present, satisfying the rule as written. |
| `fix_usable_unedited` | **1** | Not blocked by the `fix_target_correct == 0` constraint, since that column is 2. Fix 1 names the exact table, gives a concrete row for the failing case (`category = "Hardware"`), and instructs the general seeding action ("repeat for every category the router is expected to handle") needed to unblock the diagnosed failure — a builder AI can execute this directly (insert rows into a two-column string table) without needing to first rewrite or reinterpret the fix. This is a borderline call — see Notes. |

**Total: 6/6**

**`passes_gate` computation:**
```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
            = 1  iff  2 == 2  AND  1 == 1
            = 1
```

**`passes_gate = 1`**

## Notes

- **Not void.** Seed 03 has no documented void condition (§A3 defines void conditions only for seeds 4 and 5). The setup was correct per the seed spec: table exists, ACL grants read (Build Rule #42), zero rows by design.
- **Borderline on `fix_usable_unedited`.** Fix 1's proposed value for `assignment_group` is not a concrete literal — it says "set to the sys_id of the appropriate assignment group (e.g., the Hardware support group)" and "repeat for every category the router is expected to handle" without enumerating the category set. However, `assignment_group` is a plain `StringColumn` in the seed's Fluent source (not a reference field), so no real sys_id lookup is actually required — any string value works, and the report's "sys_id" phrasing is imprecise but not blocking. Because there is no ground-truth category/group list anywhere in the evidence available to any diagnostician (the fixture intentionally leaves this open — any consistent seed data satisfies the fix), requiring literal enumerated values would make `fix_usable_unedited` unsatisfiable for this seed in principle. The fix is concrete enough on the specific failing case (table, column names, one full example row) that a builder AI can act on it directly. Scored 1, but flagged as the closest call in this row.
- **Measurement vs. report disagreement, noted per the scoring instructions but not score-affecting.** The recorded scorecard measurement gives `layers_swept = 4/7 (L1, L3, L5, L6)`, but the report's own "LAYERS SWEPT" table claims six layers SWEPT (L1–L6), including L2 (Instructions, "via agent_config") and L4 (Data schemas, "implicitly via query_table") — both of which the measurement does not credit as actually swept. Per the packet's instruction, the measurement governs. This does not change any column score: Root Cause 1's layer (L5) and its cited evidence (trace + `query_table`, i.e. L1 and L5) both fall within the *actually* measured-swept set, so the overclaimed L2/L4 sweeps are not load-bearing for the diagnosis or its evidence citation.
- Fix 2 (advisory — mark `category` mandatory) is a secondary, well-formed, directly-applicable schema edit; it doesn't affect scoring since Fix 1 alone already satisfies `fix_target_correct`/`fix_usable_unedited`.
