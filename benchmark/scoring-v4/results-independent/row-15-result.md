# Scoring result — Row 15 (native, seed 04, run 2)

## root_cause_layer_correct = 2

The seed's expected root-cause layer is `genai_stack` (layer 6). The report's
RC-1 states `Layer: 6 — GenAI stack` and identifies the exact seeded defect:
the capability definition's `api` field holds the nil value
`00000000000000000000000000000000`, resolving to no `sys_hub_flow` record
("capability exists, its provider flow does not" — the primary construction's
signature per the seed spec). This is not the decoy (empty `connection`) —
the report never mentions `connection` at all. Full match to the expected
diagnosis.

## fix_target_correct = 2

Expected fix target: "capability mapping — repoint `api` at the real provider
integration subflow." The report's Fix 1 is "Repoint the capability
definition's `api` field," targeting the exact same table
(`sys_one_extend_capability_definition`), the exact same sys_id
(`904c0485699a4a73a124446a7231c563`), and the exact same field (`api`). This
is not "the right area" partial credit — it is the specific correct target,
so full credit.

## evidence_cites_trace_and_config = 1

The rubric requires citing BOTH the execution trace AND a config/schema
source. RC-1's Evidence line cites `genai_log check_config` against the
capability definition (config source: `api = ...`, `api_state = dangling`,
`sys_hub_flow` read returned empty) **and** `sn_aia_tools_execution`
`a8ed490c2baa4314f243fed2ce91bf73` (`response.ok = false`,
`response.status = error`, `response.result = null` — trace evidence from
the execution plan, consistent with the LAYERS SWEPT table's claim that
`agent_trace` was used to read the plan/task tree/tool call/message stream).
Both source types are present in the cited evidence, not just received.

## fix_usable_unedited = 0

Fix 1's "Proposed" value is not a concrete value: "The sys_id of the intended
Now LLM Service flow record in `sys_hub_flow` (the provider integration this
capability should dispatch through)." This tells a builder AI *what kind* of
value belongs in the field but not *what to write* — applying this "as
written" is impossible without a further investigation/lookup step (e.g.
querying other definitions to find a working `sys_hub_flow` reference, which
the report never does — its `genai_log` call only read the broken
definition, per the tool-call order in the measurements: `agent_trace,
read_artifact ×3, genai_log`). The seed spec's expected diagnosis supplies a
concrete healthy value (`936e514a53b3b110f028ddeeff7b128c`) precisely because
a usable fix needs one; this run's Fix Report stops one step short and hands
back a placeholder description instead of an actionable value. Per the
rubric, a fix that cannot be applied as written without manual editing scores
0 here regardless of `fix_target_correct` (the constraint only forces 0 in
the other direction — target wrong ⇒ usable must be 0 — it does not forbid
0 here for a different reason).

Note: this is a distinct failure mode from the seed's `connection` decoy
(which this run did not fall for at all) — it is a genuine gap between
"identified the right field to fix" and "supplied a fix that is actually
appliable unedited."

## Totals

| Column | Score |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| **Total** | **5/6** |

`passes_gate = (root_cause_layer_correct == 2) AND (fix_usable_unedited == 1)`
→ `(2 == 2) AND (0 == 1)` → **False** → `passes_gate = 0`

## Notes

Borderline call is on `fix_usable_unedited`. The run's diagnosis and fix
*targeting* are both fully correct (2/2 on the first two columns, matching
the seed's expected diagnosis field-for-field), and the evidence citation is
solid (trace + config both present). But the proposed fix value is a
description of what belongs in the field, not an actual sys_id to write —
the builder AI receiving this report would still have to go find the correct
`sys_hub_flow` reference itself before the fix could be applied, which is
exactly the "manual editing first" the rubric excludes from a 1. This run did
not fall for the `connection` decoy (never mentions it), so the decoy-scoring
rule (§ "Scoring note" in the seed spec, correct row 2/0/…/0) does not apply
here — this is a plain fix-incompleteness case, not a decoy hit.
