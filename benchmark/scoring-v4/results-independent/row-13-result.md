# Row 13 — native / seed 04 (GenAI capability not mapped to a provider), run 1

## Void check

Not void. Seed 04's void condition is a mismatch between the sys_id hardcoded
in the installed `sn_aia_tool.script` and the target instance's
`sys_one_extend_capability` record. Nothing in the report or measurements
indicates that mismatch — the tool successfully reached and invoked
`x_snc_tsbench_unmapped_capability`, and the failure observed is exactly the
seeded one (capability found, its `api` pointer resolves to no
`sys_hub_flow` record). Scored as a normal (non-void) run.

## Rubric columns

| Column | Awarded | Justification |
|---|---|---|
| `root_cause_layer_correct` | **2** | Expected layer is `genai_stack` (layer 6). Root Cause 1 explicitly places the defect at "Layer 6 – GenAI stack," on `sys_one_extend_capability_definition` record `904c0485699a4a73a124446a7231c563`, with the exact mechanism specified in the seed spec: `api` holds the nil sys_id `00000000000000000000000000000000`, which resolves to no `sys_hub_flow` record. Exact match, including the specific field and mechanism — not just the layer number. |
| `fix_target_correct` | **2** | Expected fix target is "capability mapping" — repoint `api` at a real provider flow, not the tool script or agent instructions. Fix 1 ("primary fix") targets exactly that: `sys_one_extend_capability_definition` record `904c0485699a4a73a124446a7231c563`, field `api`, current value the nil sys_id, to be repointed at a real `sys_hub_flow` record. This is the correct specific target, not a generic "something's misconfigured" area-only answer. The report also does **not** fall for the `connection` decoy — `connection` is never mentioned as a cause anywhere in the report. |
| `evidence_cites_trace_and_config` | **1** | Root Cause 1's evidence line cites both source types the rubric requires: a config/schema source (`genai_log check_config` finding `api_dangling`; a direct `sys_hub_flow` read confirming the sys_id resolves to nothing) **and** the execution trace (`tool call response digest: ok: false, status: error` — trace artifact, offset 4000). Both cited together for the same root cause. |
| `fix_usable_unedited` | **0** | `fix_target_correct = 2`, so the hard constraint (may not be 1 while target=0) is not what forces this to 0 — the fix itself is not directly appliable as written. Fix 1's "Proposed" value is: "The sys_id of the sys_hub_flow record for the intended Now LLM Service provider integration (e.g., the standard Now LLM or Amazon Bedrock spoke flow active on this instance)." That is a description of what to go find, not a concrete value — the audit trail's tool-call order (`agent_trace, read_artifact ×2, genai_log, read_artifact, genai_log, read_artifact, agent_config, read_artifact`) shows no `query_table` call was ever made to actually look up a healthy `sys_hub_flow` sys_id to propose. A builder AI could not apply this fix "as written, with no manual editing first" — it would first have to research and select which flow record is correct. (Contrast with the row-17 precedent, where a fix scored 1 because it named the exact table, sys_id, field, and value to set, with no lookup required.) |

**Total: 5/6**

## `passes_gate`

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
            = 1  iff  2 == 2  AND  0 == 1
            = 0
```

**`passes_gate` = 0**

## Notes

- This run did **not** fall for the `connection` decoy — it correctly identified
  `api` (not `connection`) as the broken pointer, so the decoy-scoring rule (cap
  everything at 2/0/…/0) does not apply here; the miss on `fix_usable_unedited`
  is purely about the fix's proposed value being descriptive rather than
  concrete/appliable, not about targeting the wrong field.
- The run also reported a secondary, non-primary "Root Cause 2 / Fix 2" about an
  inactive tool binding (`active_tool_count = 0`). This is explicitly a
  secondary/hygiene finding, not the primary diagnosis, and Fix 1 is labeled
  "(primary fix)" — it does not change any of the four column scores, which are
  judged on the primary root cause and fix.
- Audit-trail `layers_swept` (5/7: L1, L2, L3, L6, L7) matches the report's own
  LAYERS SWEPT table exactly (SWEPT: 1, 2, 3, 6, 7; NOT SWEPT: 4, 5) — no
  disagreement to flag.
- Borderline call: `fix_usable_unedited` is the column most open to a different
  read. If the rubric's "usable unedited" bar is read as "the identified target
  and required change are correct and unambiguous" rather than "a concrete
  paste-able value is supplied," this could instead score 1 (making
  `passes_gate = 1`, total 6/6). This scoring treats "usable unedited" literally
  — no manual lookup/decision required before application — per the row-17
  precedent in this same results directory, which withheld nothing to be looked
  up before scoring 1.
