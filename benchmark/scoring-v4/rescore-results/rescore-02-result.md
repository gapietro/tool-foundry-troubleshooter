# Rescore Result — Seed 02, Run 1

Packet: `benchmark/scoring-v4/rescore/rescore-02-seed-02-run-1.md`

## Scored columns

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | **0** | Expected layer per seed spec is `instruction` (layer 2): the agent has one bound tool (`measure_request`) and the failure is that the instructions demand a group decision the agent has no means to ground. The report's actual root cause (Root Cause 1) is Layer 3 — "No tools bound to the agent" / empty `sn_aia_agent_tool_m2m` — a different failure mode entirely (agent cancels before the model is ever invoked). Root Cause 2 does cite Layer 2, but only to note the `description` field says "deliberately broken" (metadata confirming intentionality), not to diagnose instruction ambiguity or the tool's insufficiency for grounding a routing decision — it never engages with what the seed spec identifies as the actual defect. The named root cause does not match the expected layer. |
| `fix_target_correct` | **0** | Expected fix target is the instruction text (name the groups, or add a lookup tool *and* say to use it). Fix 1 proposes binding a tool that writes `assignment_group` directly (not a lookup/grounding tool, and no instruction change at all — "say to use it" is half the sanctioned fix and is entirely absent here). Fix 2 proposes a trigger-config check. Both fixes are aimed at the wiring/tool layer the report (incorrectly) diagnosed, not at the instruction text. No partial credit: the seed spec's partial-credit band is defined only for Seed 5 ("inactive" without naming which gate); Seed 02 defines no analogous partial case, and this fix is not "the right area without the specific target" — it's a different layer altogether. |
| `evidence_cites_trace_and_config` | **1** | Root Cause 1's evidence cites both an execution-trace source (`sn_aia_tools_execution` row count, the execution task output, `agent_trace` on the cited execution sys_id) and a config/schema source (`agent_config` read of `sn_aia_agent_tool_m2m`, i.e. the tool-binding table). Both categories are present regardless of the diagnosis being wrong — this column scores citation practice, not correctness. |
| `fix_usable_unedited` | **0** | Forced by the rubric's explicit constraint: `fix_usable_unedited` may not be 1 while `fix_target_correct` is 0. Fix 1/Fix 2 are well-formed and could technically be applied as written, but they do not address the seed's actual defect (ambiguous instruction), so per the rubric's own reasoning (the Seed 4 decoy discussion) a well-formed fix aimed at the wrong target is not usable. |

## passes_gate

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
```

`root_cause_layer_correct` = 0 (not 2) → **`passes_gate = 0`**.

## Total

**1 / 6** (0 + 0 + 1 + 0)

## Notes

- Not scored as void. The two documented void conditions (Seed 4's capability sys_id mismatch, Seed 5's inactive trigger gate) are the only ones the packet establishes, and Seed 02's own spec states no analogous install-state contingency (Setup: "No data setup needed"). The report's claim of zero bound tools contradicts the seed spec's description of the fixture (one tool, `measure_request`, deliberately incapable of resolving a group) — but the task provides no measurement confirming actual tool-binding state at run time, only the four scorecard fields (`layers_swept`, `layers_available`, `tool_calls`, `wall_clock`), none of which speak to tool count. Absent an authoritative measurement contradicting the report and absent this seed appearing in the void list, the discrepancy is treated as the run misdiagnosing the fixture, not as a void setup failure.
- This run is structurally analogous to the Seed 4 R-22 decoy the rubric's A2 section walks through: a confident, well-evidenced, well-formed diagnosis and fix that targets the wrong layer entirely. The `fix_target_correct = 0` → `fix_usable_unedited = 0` constraint is exactly what prevents this run from passing the gate on a technicality.
