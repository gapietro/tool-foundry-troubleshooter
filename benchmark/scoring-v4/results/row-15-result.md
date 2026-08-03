# Row 15 — native / seed 04 / run 2 — Scoring result

**Seed:** 04 (GenAI capability not mapped to a provider) · **Expected root-cause layer:** `genai_stack` (layer 6) · **Expected fix target:** capability mapping (repoint `api` at the real provider flow)

## Void check

Not void. The seed's void condition for seed 4 is that the capability sys_id
baked into the installed `sn_aia_tool.script` does not match the target
instance's `sys_one_extend_capability` record. The report's own Verification
section references capability `92ff62af516741769c437feb88c80ef3`, which is
exactly the sys_id the seed spec's Setup section records as the correctly
substituted, installed value for gpinst01. The root-cause row's definition
sys_id (`904c0485699a4a73a124446a7231c563`) is the separate
`sys_one_extend_capability_definition` child record, not a second capability
reference, so there is no mismatch to flag. This run tested the seeded
defect, not a malformed reference.

## Column scores

### `root_cause_layer_correct` = **2** (of 0/2)

RC-1 is filed at "Layer 6 — GenAI stack," component
`sys_one_extend_capability_definition` · `904c0485699a4a73a124446a7231c563` ·
field `api`, finding that `api` holds the nil value
`00000000000000000000000000000000` which resolves to no `sys_hub_flow`
record. This is exactly the seed's expected diagnosis (capability exists,
`api_type=sys_hub_flow`, `api` dangling). Layer and mechanism both match.

### `fix_target_correct` = **2** (of 0/1/2)

Fix 1 targets `sys_one_extend_capability_definition` ·
`904c0485699a4a73a124446a7231c563` · field `api`, proposing to repoint it at
"the sys_id of the intended Now LLM Service flow record in `sys_hub_flow`."
This is the capability-mapping target the seed specifies — not the tool
script, not the agent instructions, and critically not the `connection`
decoy (the report never mentions `connection` at all, so the decoy was not
triggered). Full credit, not partial: the specific field (`api`) and record
are named, not just "the capability area" in the abstract.

### `evidence_cites_trace_and_config` = **1** (of 0/1)

RC-1's evidence line cites both required source types in one entry:
config/schema — `genai_log check_config` on definition
`904c0485699a4a73a124446a7231c563` showing `api = 00000...0`, `api_state =
dangling`, and an empty `sys_hub_flow` read; and trace — `sn_aia_tools_execution`
`a8ed490c2baa4314f243fed2ce91bf73` showing `response.ok = false`,
`response.status = error`, `response.result = null`. The audit-trail
measurement (tool-call order `agent_trace, read_artifact ×3, genai_log`,
`layers_swept` 2/7 = L1 + L6) independently corroborates that both an
execution-trace tool and a config-inspection tool were actually called, so
this citation is backed by real tool use, not narrated after the fact.

### `fix_usable_unedited` = **0** (of 0/1)

`fix_target_correct` = 2, so the rubric's "may not be 1 while
fix_target_correct is 0" constraint does not force this to 0 — it has to be
judged on its own. It fails anyway. Fix 1's "Proposed" value is not a
concrete replacement — it is a description: *"The sys_id of the intended Now
LLM Service flow record in `sys_hub_flow` (the provider integration this
capability should dispatch through)."* A builder AI handed this text cannot
execute an update from it as written; it would first have to independently
determine which `sys_hub_flow` row is the correct Now LLM Generic provider
integration (the seed spec confirms this is discoverable on-instance — 422
of 2026 definition rows share the healthy value — but this run never issued
a `query_table` call to find it; its own audit trail shows only
`agent_trace`, `read_artifact` ×3, `genai_log`). Naming the right field on
the right record without supplying the value to put there is "right area,
placeholder value," which the fix-usability column treats as requiring
manual completion before it is appliable — not usable unedited.

## `passes_gate`

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
```

root_cause_layer_correct = 2, fix_usable_unedited = 0 → **passes_gate = 0**

## Total

2 + 2 + 1 + 0 = **5/6**

## Notes for a later reader

- This is a genuine near-miss, not a decoy hit: the `connection` decoy
  described in the seed spec (root cause "no connection bound") never
  appears anywhere in this report, so the decoy-specific 2/0/…/0 scoring
  pattern in the seed spec does not apply here — the 0 on
  `fix_usable_unedited` is earned independently, on completeness grounds,
  with `fix_target_correct` still at 2.
- The report's own LAYERS SWEPT table (L1 SWEPT, L6 SWEPT, all others NOT
  SWEPT/UNAVAILABLE) matches the audit-trail-derived `layers_swept: 2/7 (L1,
  L6)` exactly — no self-report-vs-measurement disagreement to adjudicate on
  this row.
- The seed's expected fix cites a specific healthy `api` value
  (`936e514a53b3b110f028ddeeff7b128c`) that is deliberately a guarded
  blind-rule token — the run was never supposed to have that literal value
  handed to it, and not reproducing it is not itself a fault. The fault
  scored here is narrower: the run stopped at "this pointer is wrong" and
  never took the additional on-instance query step needed to find what the
  pointer should become, leaving Fix 1 a correctly-targeted but
  not-yet-actionable instruction.
- Anchor-record gap noted in the packet (the `x_snc_troubleshoot_run` row
  stuck at `status: running` despite the underlying execution reaching
  `Completed`) is a harness-observation artifact per the packet's own
  framing and was not treated as a scoring input.
