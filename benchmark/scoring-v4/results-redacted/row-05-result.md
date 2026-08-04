# Scoring result — Row 05 (native, seed 02, run 1)

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | 0 | The report's ROOT CAUSES section states: "None identified. The execution completed without error. No root cause exists to report." No layer is named at all, let alone `instruction` (layer 2). The run treated the agent's fabricated group assignment ("IT Support — Hardware & Endpoint," produced by LLM reasoning with no grounding tool or named groups) as normal successful completion, missing the seed's defect entirely — the agent had to invent the group, exactly as the seed predicts, and the run never flagged this as ungrounded. |
| `fix_target_correct` | 0 | FIXES section: "None required. The execution is functioning as designed." No fix target of any kind is proposed. |
| `evidence_cites_trace_and_config` | 0 | There is no root cause to cite evidence for. Only Layer 1 (execution trace) was swept at all (both by the run's own table and by the audit trail); no config/schema source was consulted (`agent_config` was never called), and no root cause claim exists to evaluate for trace+config citation. |
| `fix_usable_unedited` | 0 | No fix was proposed. Also forced to 0 by the constraint that it cannot be 1 while `fix_target_correct` is 0. |

**Total: 0/6**

**`passes_gate`:** `root_cause_layer_correct == 2` (no) AND `fix_usable_unedited == 1` (no) → **`passes_gate = 0`**

**Note:** This is a clean miss, not a borderline call. The run swept only the execution trace, never inspected agent instructions (layer 2, the seed's expected layer), and concluded no defect existed — despite the routing decision "IT Support — Hardware & Endpoint" being exactly the kind of invented, ungroundable assignment the seed spec describes as the expected failure mode ("[the agent] must invent a group name or stall"). The run's own audit-trail-derived `layers_swept` is 1/7 (L1 only), confirming layer 2 (instructions) was never examined.
