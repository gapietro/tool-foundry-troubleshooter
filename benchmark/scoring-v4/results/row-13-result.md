# Row 13 — native, seed 04, run 1 — Scoring Result

**Seed:** 04 (GenAI capability not mapped to a provider) · **Harness:** native (Agent Doctor)
**Expected root-cause layer:** `genai_stack` (layer 6)
**Expected fix target:** capability mapping — repoint `sys_one_extend_capability_definition.api` at a real `sys_hub_flow` record

---

## Column scores

### `root_cause_layer_correct` = **2**

Root Cause 1 in the report names Layer 6 / GenAI stack explicitly and locates it correctly: `sys_one_extend_capability_definition` record `904c0485699a4a73a124446a7231c563`, field `api` holding the nil sys_id `00000000000000000000000000000000`, "which resolves to no record in `sys_hub_flow`." This is an exact match to the seed's expected root cause (the dangling `api` pointer, not the `connection` decoy — the report never mentions `connection` at all, so the decoy-scoring carve-out in the seed spec does not apply here). Full marks.

### `fix_target_correct` = **2**

Fix 1 ("Repoint the capability definition's `api` field to a real provider flow") targets exactly the seed's expected fix target: same table (`sys_one_extend_capability_definition`), same record, same field (`api`), correctly described as needing to point at a real, active `sys_hub_flow` provider integration. This is the specific target named in the seed spec ("Fix target: capability mapping ... not the tool script and not the agent instructions") — the run explicitly rules out the tool/instructions layer via its Root Cause 1/Fix 1 framing. No partial-credit reasoning needed; this is a full hit on the correct table/record/field.

### `evidence_cites_trace_and_config` = **1**

Root Cause 1's evidence line cites both required source types in one place: `genai_log check_config` — finding `api_dangling` (config/schema source, the capability definition audit) **and** the live tool-call response digest `ok: false, status: error, raw_response.status: "error" (trace artifact, offset 4000)` (execution trace). Both a trace citation and a config/schema citation are present for the root cause, satisfying the evidence rule.

### `fix_usable_unedited` = **0**

Fix 1's "Proposed" value is not a concrete, applicable value — it reads: *"The sys_id of the `sys_hub_flow` record for the intended Now LLM Service provider integration (e.g., the standard **Now LLM** or **Amazon Bedrock** spoke flow active on this instance)."* This names two different, non-interchangeable candidate providers as an illustrative "e.g." rather than resolving to one unambiguous target. A builder AI applying this "as written, with no manual editing first" would have to make an independent judgment call (or run an unspecified disambiguating query) to decide which of the two named integrations is correct before the field could actually be set — picking the wrong one (Bedrock instead of Now LLM, or vice versa) would not fix the seeded defect. That is exactly the kind of resolution step the column is designed to exclude. (Note: the seed's actual healthy value, `936e514a53b3b110f028ddeeff7b128c` / "Now LLM Generic", is a blind-rule-guarded token the run could not have been expected to name literally — the 0 here is not because the exact sys_id is missing, but because the fix leaves a live either/or ambiguity in the field it names instead of a single resolvable target.)

Because `fix_target_correct = 2` (not 0), the rubric's floor constraint ("`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0") is not in play here — this 0 is earned independently on usability grounds, not forced by the constraint.

---

## Total: **5 / 6**

(`root_cause_layer_correct` 2 + `fix_target_correct` 2 + `evidence_cites_trace_and_config` 1 + `fix_usable_unedited` 0)

## `passes_gate` computation

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
            = 1  iff  2 == 2 (true)  AND  0 == 1 (false)
            = 0
```

**`passes_gate` = 0**

---

## Notes for a later reader

- No decoy hit: the report never cites the empty `connection` field as a cause, so the seed spec's decoy-scoring instructions (which would force `fix_target_correct`/`fix_usable_unedited` to 0 regardless) do not apply — the 0 on `fix_usable_unedited` here is earned on its own, separate grounds (ambiguous, non-concrete proposed value).
- Audit-trail `layers_swept` (5/7: L1, L2, L3, L6, L7) matches the report's own LAYERS SWEPT table exactly (SWEPT on L1/L2/L3/L6/L7, NOT SWEPT on L4/L5, platform logs unavailable). No sweep-claim disagreement to flag; the report's self-reported sweep coverage is measurement-confirmed.
- The report's secondary "Root Cause 2 / Fix 2" (inactive tool binding, layer 3) is additional noise not required by the seed and not scored against — it doesn't conflict with or undermine the correct primary root cause and fix, so it was not treated as a miss or a decoy.
- This is a borderline call on `fix_usable_unedited`: the run got the correct record/field and a technically-correct remediation direction, but stopped short of a single resolvable value, offering two named alternatives without a decision rule. A scorer weighing "usable" more loosely (e.g., treating "query for the active provider flow and use its sys_id" as an executable procedure regardless of the two named examples) could reasonably land on 1 instead, which would flip `passes_gate` to 1. This write-up scores it 0 because the specific wording names two different real integrations as coequal candidates rather than describing an unambiguous lookup, which is not "applied as written" without a resolving judgment call.
