# Rescore Result — Seed 01, Run 2

Packet: `benchmark/scoring-v4/rescore/rescore-01-seed-01-run-2.md`

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | **2** | Expected layer is `tool_schema` (layer 3), and per the seed's Scoring note (M18) a layer-4 answer describing the same disagreement also scores full marks. Root Cause 1 states the disagreement explicitly: `gr.setValue('priority', inputs.priority)` passes the string `"critical"` to an Integer column, citing schema `type: Integer, has_choices: false`. This is the mismatch, not one side alone, so it clears the M18 bar under either layer label. The "LAYERS SWEPT" table's L1/L3/L4/L5-swept claim also matches the scorecard measurement (`4/7 (L1,L3,L4,L5)`) exactly, so there is no measurement/claim disagreement to resolve here. |
| `fix_target_correct` | **2** | Expected fix target: "map the word to its integer inside the script, or change the tool description + agent instructions to pass 1–5." Fix 1 does exactly the first option — a `priorityMap` lookup inserted before `gr.setValue`, converting the word to its integer value inside the tool script. This is the specific target named in the seed spec, not just "the right area," so full credit (not the 1-partial band, which this seed's spec does not define a case for). |
| `evidence_cites_trace_and_config` | **1** | Root Cause 1's evidence line cites both sources required by the evidence rule: the execution trace (`sn_aia_tools_execution` response_digest showing `priority_stored: null`, and request_digest showing `inputs.priority = "critical"`) AND the config/schema source (`x_snc_tsbench_ticket.priority` dictionary — `type Integer, has_choices: false` via `schema_lookup`). Both are used analytically to build the finding, not merely listed. |
| `fix_usable_unedited` | **1** | Since `fix_target_correct` = 2 (not 0), the "may not be 1 while fix_target_correct is 0" constraint does not block this. Fix 1 supplies a complete, drop-in code replacement (the `priorityMap` block plus the corrected `setValue` call) targeted at a named location (`sn_aia_tool`, field `script`), addresses the defect the seed actually carries (word-to-Integer mismatch), and requires no manual editing to apply. |

**Total: 6/6**

**`passes_gate` computation:**
```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
            = 1  iff  2 == 2  AND  1 == 1
            = 1
```

**`passes_gate = 1`**

## Notes

- Not a void run: this is Seed 01 (schema mismatch), and none of the Seed 01 void conditions apply (void conditions are defined only for Seeds 4 and 5).
- No 1-partial band was invoked for `fix_target_correct` — this seed's spec does not define a partial case (only Seed 5 does), and the run's Fix 1 named the specific target (word→integer mapping inside the script) rather than just the general area, so full 2 marks were justified without needing the band.
- The report additionally proposes Fix 2 (guard the false-success return) and Fix 3 (mandatory inputs) — neither is required by the seed's expected fix target, and neither detracts from Fix 1 satisfying `fix_target_correct`/`fix_usable_unedited` on its own.
- No discrepancy was found between the report's "LAYERS SWEPT" claims and the scorecard's measured `layers_swept` value, so the "measurement overrides report claims" rule did not need to be invoked for this run.
