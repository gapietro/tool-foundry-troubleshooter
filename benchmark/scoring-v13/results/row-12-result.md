# Row 12 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 0 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| total | 3/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct
The seed spec's header table prints `Expected root-cause layer` = `data` (layer 5). The report states exactly one root cause, so §A2.2 Case 2 does not arise and no primary selection is needed. That single entry declares a layer explicitly: `"layer": "5"`. §A2.2 Case 1 governs — where the report declares a layer, **score the declared value** against the seed spec's expected layer, and do **not** score the substance of the finding text. The declared value 5 matches the expected layer 5, so the column scores **2**.

This is the case Case 1 was written for: the finding text ("Table does not exist" for a table named `sysrule_routing`) is substantively wrong about the mechanism — the real table exists and is empty, and the report has invented a table name — but Case 1 states in as many words that "a root cause filed under the expected layer whose prose is thin, hedged or wrong about the mechanism scores 2." The §A2.2 note that "reaching a layer is not diagnosing at it" is a standing finding, and the quality of what was found there is charged to the other three columns, not here. Note also that §A2.2 Case 2's closing paragraph forbids importing the `layers_swept` test into this column — the audit trail's 2/7 sweep and the harness HOLD do not bear on it.

### fix_target_correct
Two places in the seed spec decide this, per §A2.3 Case 2: the header row gives the area — **data seeding** — and the *Expected diagnosis* section names the specific target — "the routing table holds zero rows. Fix target: data seeding, not the tool or the instructions."

The report proposes exactly one fix, and it declares its target: `"target_type": "configuration"`, `"target": "lookup_routing_rule tool's input schema"`. §A2.3 Case 1 requires scoring the **declared** target. The declared target is the tool's input schema — that is the tool-schema area, not data seeding. It falls in a different one of §A's five areas, which is the 0 band.

It is worse than merely different-area: the seed spec explicitly rules this reading out. Under *Expected diagnosis*, "A diagnosis naming the tool or the query is a **miss**, and the scorecard should record it as one," and *Why it is built this way* repeats that blaming the tool or the query is "chasing a layer that has no defect in it." §A2.3 Case 2's 0 band covers exactly this: "it is a target the seed spec's expected-target row explicitly excludes... A seed that names its decoy is naming a miss, and the exclusion is the seed spec's to make, not the scorer's."

The `rationale` field ("Replace non-existent 'sysrule_routing' table with a valid table name in the tool's input schema") does not rescue it — it too aims at the tool's schema, not at seeding rows. Nothing in the fix proposes inserting data. Column scores **0**.

### evidence_cites_trace_and_config
Applying §A1's cases in order. Case 1: the report does state a root cause, so it does not govern. Case 2: exactly one root cause is stated, so no primary selection is needed — the single entry is the subject. Cases 3–5 do the awarding.

The root-cause statement is `component: "sysrule_routing table"`, `finding: "Table does not exist"`. Its `evidence` array carries two entries, both attached directly to that root cause (Case 5 satisfied — the citations are co-located in the entry's own `evidence` list, not scattered in the failure summary or a sweep table).

Case 3 — connection: the trace citation reads "Tool call response indicated 0 rules in table 'sysrule_routing'"; the second reads "query_table confirmed table_does_not_exist status for 'sysrule_routing'". Both name `sysrule_routing`, the exact artifact the root-cause statement names. The test is a comparison between two passages of the report, and it does not ask whether the citation is *good* evidence — only whether it is evidence for this claim. Both pass, even though the artifact named is one the seed shows does not correspond to the real table.

Case 4 — backing in the audit trail. The families are enumerated, not judged. The trace half must be backed by a recorded `agent_trace` call; the audit trail records distinct tool names `agent_trace` and `query_table`, so the trace half is backed. The config/schema half is backed by any of the other six, which includes `query_table` — recorded. The second citation is labelled `"source": "data"` rather than "config", but Case 4 decides this half by the recorded tool family, not by the label the report chose, and `query_table` is enumerated in the config/schema family. Both halves are backed.

All applicable cases are satisfied, so the column scores **1**. Note this column is not a gate term, so it moves only the /6.

### fix_usable_unedited
§A2.1 directs the scorer to check §A's constraint **first**: `fix_usable_unedited` may not be 1 while `fix_target_correct` is 0. `fix_target_correct` is 0 here, so the constraint binds and no case under §A2.1 arises. The column scores **0**.

This is precisely the pattern §A2 describes as a mis-score to avoid: the fix is superficially well-formed (it has a `current` and a `proposed` string) but aimed at a target the seed rules out, so it fixes nothing — "A well-formed fix aimed at the wrong target is a no-op, not a usable fix." Marking this row 2 / 0 / 1 would be the mis-scoring §A2 explicitly names; the correct shape is 2 / 0 / 0.

For the record, the fix would fail on its own terms too: `proposed: "category=Facilities AND table=valid_routing_table"` names its target by kind rather than by name (§A2.1 Case 4 — "valid_routing_table" is a placeholder class, not a record), and it leaves a value slot unfilled that the instance holds and the run declined to look up (§A2.1 Case 1). But the §A constraint has already decided the column.

`passes_gate` = `root_cause_layer_correct == 2 AND fix_usable_unedited == 1` → `2 == 2` is true, `0 == 1` is false → **0**.
