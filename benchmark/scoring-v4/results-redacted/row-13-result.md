# Scoring result — Row 13 (native, seed 04, run 1)

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | 2 | RC-1: "Layer 6 – GenAI stack," Finding: "`api` field holds the nil sys_id `00000000000000000000000000000000`, which resolves to no record in `sys_hub_flow`. The capability executor has no provider flow to call." This matches the seed's expected root-cause layer (`genai_stack`) and correctly identifies the `api` field, not the decoy `connection` field, as the defect. |
| `fix_target_correct` | 2 | Fix 1 (primary): "Target: `sys_one_extend_capability_definition`... field `api`," proposing to repoint it "to a real provider flow." This is exactly the seed's expected fix target — "capability mapping — repoint `api` at the real provider integration subflow" — not the tool script, not the instructions, and not the connection decoy. |
| `evidence_cites_trace_and_config` | 1 | RC-1's evidence cites `genai_log check_config` (finding `api_dangling`) plus a direct `sys_hub_flow` read confirming it's empty (config/schema sources) AND the tool call's error response captured in the trace artifact (`ok: false, status: error`, offset 4000). Both trace and config evidence cited for the same root cause. |
| `fix_usable_unedited` | 0 | Fix 1's "Proposed" value is: "The sys_id of the `sys_hub_flow` record for the intended Now LLM Service provider integration (e.g., the standard **Now LLM** or **Amazon Bedrock** spoke flow active on this instance)" — a description of what kind of value belongs there, not an actual sys_id. The run never queried `sys_hub_flow` or `sys_one_extend_capability_definition` for a candidate replacement (no `query_table` call appears anywhere in this run's tool-call order), so the concrete value a builder AI would need to write into the field was never determined. This is a genuine gap in the diagnostic work (the tool to find it — `query_table` — was available but unused), not an inherent domain-knowledge indeterminacy, so it does not get the same leniency as a data-seeding fix whose exact business values are unknowable from platform data alone. |

**Total: 5/6**

**`passes_gate`:** `root_cause_layer_correct == 2` (yes) AND `fix_usable_unedited == 1` (no) → **`passes_gate = 0`**

**Note on decoy handling:** This run correctly avoided the `connection`-empty decoy entirely — it never names `connection` as a defect, and RC-1/Fix-1 both correctly target `api`. This is a clean (non-decoy) diagnosis of the right defect; the `fix_usable_unedited = 0` score is unrelated to the decoy and turns solely on the fix lacking a concrete replacement value, as detailed above.
