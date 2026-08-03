# Rescore Result — rescore-06 (Seed 04, Run 1)

Packet: `benchmark/scoring-v4/rescore/rescore-06-seed-04-run-1.md`

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | **2** | Seed's expected root-cause layer is `genai_stack` (layer 6). RC-1 states "Layer 6 — GenAI stack," component `sys_one_extend_capability_definition` row `904c0485699a4a73a124446a7231c563`, finding that `api` is the null GUID `00000000000000000000000000000000`. This is an exact match to the expected layer. |
| `fix_target_correct` | **2** | Seed's expected fix target is "capability mapping" — repoint `api` at the real provider subflow, with the healthy value on gpinst01 given as `936e514a53b3b110f028ddeeff7b128c`. Fix 1's `api` field names exactly this: Target type "Configuration — GenAI capability definition," Current `00000000000000000000000000000000`, Proposed the sys_id of a real Flow Designer subflow, explicitly citing `936e514a53b3b110f028ddeeff7b128c` as the value used by working definitions on the instance — the same value the seed spec names as correct. This is the specific target, not just the right area, so it does not fall into the 1-partial band. See the note below on the decoy contamination this run also exhibits, which was weighed and did not change this score. |
| `evidence_cites_trace_and_config` | **1** | RC-1's Evidence field cites the config/schema source directly: `sys_one_extend_capability_definition` row, field `api` = null GUID, field `connection` = empty (queried directly). Its Supporting evidence field cites the trace: the tool call response in `sn_aia_tools_execution` sys_id `a8ed490c2baa4314f243fed2ce91bf73`, `"ok":false,"capabilities":{},"status":"error"`. Both a trace source and a config source are named and used analytically to build the finding, satisfying the evidence rule. |
| `fix_usable_unedited` | **1** | Not blocked by the `fix_target_correct == 0` constraint (target is correct). Fix 1 gives a concrete, non-placeholder sys_id for `api` (`936e514a53b3b110f028ddeeff7b128c`) that a builder AI can apply verbatim to `sys_one_extend_capability_definition` row `904c0485699a4a73a124446a7231c563`, and this value matches the seed spec's own stated healthy value — applying it repairs the actual seeded defect. The Verification section gives concrete, checkable steps. The fix also proposes setting `connection` to a specific sys_id; this is unnecessary (connection empty is a normal, `mandatory=false` state per the seed spec) but not harmful or blocking — it does not prevent the `api` repoint from resolving the capability, so the fix as a whole remains mechanically applicable and does fix the seeded defect. |

**Total: 6/6**

**`passes_gate` computation:**
```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
            = 1  iff  2 == 2  AND  1 == 1
            = 1
```

**`passes_gate = 1`**

## Notes

- **Not void.** The report's capability sys_id (`92ff62af516741769c437feb88c80ef3` for `x_snc_tsbench_unmapped_capability`) matches gpinst01's hardcoded, installed value per the seed spec's Setup step 2 — a matching hardcoded value is a valid install, not a void condition. This run tests the seed's intended defect (dangling `api`), not a malformed reference.
- **Decoy handling — the borderline call.** This run did not cleanly isolate the real defect from the decoy. Both the FAILURE SUMMARY ("has no bound API and no LLM connection") and RC-1's finding cite `api` and empty `connection` together as jointly causal, and the fix's closing note asserts "The null API and empty connection are wrong in either case" — an incorrect claim, since the seed spec establishes empty `connection` as a normal state shared by 318 of 2026 definition rows (`mandatory=false`) and explicitly not the seed's defect. This is decoy contamination in the narrative. However, the rubric's decoy penalty is keyed to a fix that is "bind a connection/credential alias — and nothing else." This run's fix is not that: it specifically and correctly repoints `api` to the exact value the seed spec calls healthy, and that repoint alone resolves the seeded failure. Because the run found the real defect despite also misdescribing the decoy as contributory, and because the erroneous connection edit doesn't block or undo the correct fix, `fix_target_correct` and `fix_usable_unedited` were scored on the correct-target basis (2 and 1) rather than zeroed under the decoy rule — the decoy rule as written targets connection-only diagnoses, which this is not. Flagging this explicitly since it is the packet's central scoring risk for this seed.
- Measured `layers_swept` (5/7: L1, L3, L4, L5, L6) matches the report's own LAYERS SWEPT table exactly (SWEPT: 1, 3, 4, 5, 6; NOT SWEPT: 2, 7) — no discrepancy invoking the "measurement overrides report claims" rule.
- The blind-rule token `936e514a53b3b110f028ddeeff7b128c` appears in the run report as evidence the run independently queried from the instance (cited as the subflow used by other working definitions), not as a leaked hint — it is being scored as legitimate evidence, consistent with how it was obtained (a live query), not as a red flag against the run.
