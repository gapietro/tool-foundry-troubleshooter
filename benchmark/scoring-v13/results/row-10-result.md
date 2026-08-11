# Row 10 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 0 |
| evidence_cites_trace_and_config | 0 |
| fix_usable_unedited | 0 |
| total | 0/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct
The seed spec's header table prints the expected root-cause layer as `data` (layer 5). The report states exactly one root cause, so §A2.2 Case 2 does not arise and no primary selection is needed. That single entry declares a layer explicitly — `"layer": "1"` — so §A2.2 Case 1 governs: **score the declared value** and compare it to the expected layer. Declared `1` ≠ expected `5`, so the column scores **0**.

Case 1 is explicit that the finding text is not scored: even though the finding quotes `rules_in_table: 0` (the seed's own measured empty-read marker) and the `would_confirm` field says "layer 5 — query_table against routing rules table to verify rule existence", none of that lifts the score. A root cause filed under layer 1 whose prose brushes the layer-5 mechanism scores 0 by the rule's own worked wording. The declared layer is not compound — it names layer 1 alone — so the compound-conjunct clause does not apply either. The `layers_swept` table marking layer 5 `NOT_SWEPT` is explicitly not consulted here.

### fix_target_correct
The seed's expected fix target area is **data seeding**, and the *Expected diagnosis* section names the specific target: "the routing table holds zero rows. Fix target: data seeding, not the tool or the instructions."

The report proposes exactly one fix. It declares its target: `"target_type": "tool schema"`, `"target": "lookup_routing_rule input schema"`. Under §A2.3 Case 1, the declared target is what is scored, and the declared value is not compound. "Tool schema" is one of §A's five areas, but it is a **different** area from "data seeding" — so under Case 2 the value is **0** (different area), not 1.

The 0 is reinforced independently by the Case 2 exclusion clause: the seed spec rules the reading out in as many words — "A diagnosis naming the tool or the query is a **miss**, and the scorecard should record it as one" — so a tool-directed fix scores 0 even were it argued into the neighbourhood of the expected area. Nothing in the report proposes a second, non-hedged fix that could lift the column.

### evidence_cites_trace_and_config
The column requires the root cause to cite BOTH the execution trace AND at least one config/schema source. §A1 Case 1 does not apply (a root cause is stated); Case 2 does not apply (exactly one root cause), so the subject is the single entry under `root_causes`.

That entry's `evidence` array carries two items, and **both have `"source": "trace"`** — the tool-call response and the execution-plan state. There is no config/schema citation offered under this root cause at all, so the conjunction fails on the config half before Cases 3–5 need to distinguish anything.

The `schema_lookup` call is recorded in the audit trail (so a config/schema citation *could* have been backed under Case 4), and the `layers_swept` L4 entry mentions "schema_lookup confirmed assignment_group exists on incident table". But §A1 Case 5 is explicit: a config/schema source appearing elsewhere — a failure summary, a sweep table, an appendix — does not count unless the root cause's own evidence refers to it explicitly. The root cause's evidence list does not refer to the sweep table or to `schema_lookup`, and proximity in the document is not a reference. Case 3 would also bar it independently: the root-cause statement is about `lookup_routing_rule` returning 0 rules and names neither the `incident` table nor `assignment_group`, the artifacts the schema_lookup citation would name. Score **0**.

### fix_usable_unedited
§A's constraint binds first and is dispositive: **`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0.** `fix_target_correct` is 0, so this column is **0** and none of §A2.1's five cases arises.

This is exactly the shape §A2 describes for the decoy case: the fix is formally well-formed — it gives a `current` and a `proposed` JSON payload — but it is aimed at the tool input schema when the seed's defect is an empty table, so applying it fixes nothing. The rubric's own instruction is that such a run is scored 2/0/0 in the analogous decoy example; here it is 0/0/0. Its `rationale` ("Add parameter to include inactive rules if missing from current schema") is additionally conditional on a premise the run never verified, but the §A constraint already decides the column.

`passes_gate` = 0, since it requires `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`, and both fail.
