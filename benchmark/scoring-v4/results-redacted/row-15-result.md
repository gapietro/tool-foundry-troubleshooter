# Scoring result — Row 15 (native, seed 04, run 2)

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | 2 | RC-1: "Layer 6 — GenAI stack," Finding: "The `api` field holds the nil value `00000000000000000000000000000000`, which resolves to no record in `sys_hub_flow`... the nil value installs without error and surfaces only at invocation time." Matches the seed's expected root-cause layer (`genai_stack`) and correctly targets `api`, not the decoy `connection` field (never mentioned). |
| `fix_target_correct` | 2 | Fix 1: "Target: `sys_one_extend_capability_definition`... field `api`," Rationale: "Correcting this pointer is the only required change; the rest of the wiring (`capability`, `api_type = sys_hub_flow`) is already intact." This is exactly the seed's expected fix target — capability mapping via the `api` field, not the tool script, agent instructions, or the connection decoy. |
| `evidence_cites_trace_and_config` | 1 | RC-1's evidence cites `genai_log check_config` (`api_state = dangling`) plus a `sys_hub_flow` read confirming emptiness (config sources) AND the `sn_aia_tools_execution` tool-call response (`response.ok = false`, captured in the trace). Both trace and config evidence cited for the same root cause. |
| `fix_usable_unedited` | 0 | Fix 1's "Proposed" value is: "The sys_id of the intended Now LLM Service flow record in `sys_hub_flow` (the provider integration this capability should dispatch through)" — a description, not an actual sys_id. This run's tool-call order (`agent_trace`, `read_artifact` ×3, `genai_log`) never includes `query_table` or `agent_config`, so no attempt was made to look up a candidate `sys_hub_flow` record to supply as the concrete replacement value. As with the other run on this seed, the fix cannot be applied as written without the builder AI first performing the lookup the diagnostic run itself skipped. |

**Total: 5/6**

**`passes_gate`:** `root_cause_layer_correct == 2` (yes) AND `fix_usable_unedited == 1` (no) → **`passes_gate = 0`**

**Note on decoy handling:** This run also avoided the `connection`-empty decoy entirely — RC-1/Fix-1 both correctly and exclusively target `api`. The `fix_usable_unedited = 0` score is unrelated to the decoy; it turns solely on the fix never resolving to a concrete replacement sys_id, mirroring row-13's same-seed run-1 gap.
