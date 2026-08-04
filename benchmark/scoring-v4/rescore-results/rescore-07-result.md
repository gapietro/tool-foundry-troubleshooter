# Rescore Result — rescore-07 (Seed 04, Run 2)

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | **2** | Seed's expected root-cause layer is `genai_stack` (layer 6). The run's PRIMARY root cause, RC-1, is filed at "Layer 6 — GenAI stack" against `sys_one_extend_capability` · `x_snc_tsbench_unmapped_capability`. Per the seed spec's scoring note, the layer is correct even though the *specific* finding within that layer is the decoy ("Root cause `genai_stack` is still correct (the layer is right) — award `root_cause_layer_correct`"). |
| `fix_target_correct` | **0** | The seed's expected fix target is **capability mapping** — repointing the dangling `api` (`00000000000000000000000000000000`) at a real `sys_hub_flow` provider. The run's RC-1/FIX-1 instead targets the empty `connection` field, proposing to "bind a provider connection to the capability." The seed spec explicitly names this the planted decoy: "`fix_target_correct` scores 0 if the proposed fix is 'bind a connection/credential alias' and nothing else. It is not the seeded defect." The run's report never mentions the `api` field or the dangling `sys_hub_flow` pointer at all — it names only `connection`. |
| `evidence_cites_trace_and_config` | **1** | RC-1's evidence cites both the execution trace (tool response digest `{"ok":false,...}`, `sn_aia_tools_execution` sys_id `a8ed490c2baa4314f243fed2ce91bf73`) and config/schema (the `sys_one_extend_capability` record, sys_id `92ff62af516741769c437feb88c80ef3`, field `connection = ""`). Both source types are present for the root cause, satisfying the evidence rule regardless of the diagnosis being aimed at the decoy. |
| `fix_usable_unedited` | **0** | Per the rubric constraint, this may not be 1 while `fix_target_correct` is 0. Additionally the seed spec states this exact case directly: FIX-1 ("bind a connection alias") is well-formed and could be applied verbatim by a builder AI, but "it fixes nothing, and a fix aimed at the wrong target is a no-op, not a usable fix... The correct row for a decoy hit is 2 / 0 / … / 0." |

**Computed `passes_gate`:** `root_cause_layer_correct == 2` is TRUE, but `fix_usable_unedited == 1` is FALSE → **`passes_gate = 0`**.

**Total: 3/6**

## Notes

- This run is a textbook decoy hit: it correctly lands in the `genai_stack` layer but fixates on the empty `connection` field (RC-1/FIX-1) — precisely the planted decoy the seed spec warns about — rather than the actual seeded defect (dangling `api` pointing at a nonexistent `sys_hub_flow`, `00000000000000000000000000000000`). The report never surfaces the `api` field or a missing/unresolvable Flow anywhere in its LAYERS SWEPT, ROOT CAUSES, or FIXES sections.
- The run also surfaced two secondary/contributing findings (RC-2: missing `sn_tsbench_ticket` table; RC-3: `active_tool_count: 0`, marked UNCONFIRMED) — neither is the seeded defect and neither changes the scoring above, since the rubric scores the diagnosis against the seed's expected root cause and fix target.
- Run is not void: the setup verification in the seed spec requires the tool script's capability sys_id to match the installed capability record on the target instance; the report's evidence uses sys_id `92ff62af516741769c437feb88c80ef3`, which matches the seed spec's stated hardcoded gpinst01 value. The capability was reachable and its (wrong) field was inspected, consistent with the primary construction's failure signature (capability exists, provider mapping broken) rather than the fallback's "capability not found" signature.
- No borderline calls — all four columns are dictated directly and explicitly by the seed spec's own decoy-scoring section (2 / 0 / 1 / 0).
