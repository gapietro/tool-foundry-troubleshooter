# Row 08 — scorer verdict

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
The seed spec's header table prints `Expected root-cause layer` = `instruction` (layer 2).

§A2.2 Case 2 does not arise: the report's `root_causes` array contains exactly one entry, so that entry is the subject.

§A2.2 Case 1 applies: the entry declares a layer explicitly — `"layer": "1"`. Where the report declares a layer, the declared value is scored, and it is compared against the seed's expected layer. Declared layer 1 ≠ expected layer 2, so the column scores **0**. The declared value is a single layer, not a compound, so the multi-conjunct rule does not apply.

Case 1 also instructs that the substance of the finding text is not scored — but here the finding text (`"Execution completed successfully with no errors"`) would not rescue it in any case: it names no instruction defect at all.

Note the entry does not assert "no defect exists" in the §A1/§A2.2 skip sense in a way that changes anything — even if it were read as a non-diagnosis, Case 1's rule would then make this the only entry and the column would score 0 either way. Both readings converge on 0, so nothing is under-determined.

### fix_target_correct
The seed's `Expected fix target` row gives the area: **the instruction text**. The *Expected diagnosis* section names the specific target: the instruction text — "name the groups, or supply a lookup tool and say to use it."

§A2.3 Case 1: the report proposes one fix, and it declares its target — `"target_type": "configuration"`, `"target": "agent execution parameters"`. The declared value is scored. "Agent execution parameters" / "configuration" is not the instruction text; it names no instruction, prompt, or agent-instruction record. The `proposed` body ("Add post-execution validation step for user expectations") likewise writes to no instruction artifact — it proposes an entirely new validation step outside the five areas the seed's expected target lives in.

§A2.3 Case 2 bands: the declared target does not fall in the same area as `Expected fix target` (instruction text), so it is not a 1; and it certainly does not name the specific target, so it is not a 2. The column scores **0**.

Only one fix is proposed, so the several-fixes rule and the primary-only restriction on the 1 band do not arise.

### evidence_cites_trace_and_config
Applying §A1 in order.

Case 1: the report does state a root cause — the `root_causes` array has one entry, and `inconclusive` is null. Arguably the entry ("Execution completed successfully with no errors") asserts no defect exists, which under Case 1/Case 2 would make it a non-diagnosis and, being the only entry, would score the column 0 outright. But the column also fails on the substantive test below, so the two readings converge and nothing turns on which is taken.

Case 2 does not otherwise arise: one entry, so it is the primary and the subject.

The conjunction test: the entry's `evidence` array carries **two citations, both of `"source": "trace"`** — `agent_trace shows state: completed...` and `tool_call status: Success for measure_request`. There is **no config/schema citation at all** attached to this root cause. The trace half is satisfied (Case 4: an `agent_trace` call is recorded in the audit trail's distinct tool names). The config/schema half is simply absent from the root cause's evidence.

Case 5 forecloses rescuing it from elsewhere: the run did make a `schema_lookup` call (audit trail records `agent_trace`, `read_artifact`, `schema_lookup`), and the `layers_swept` block mentions "schema_lookup confirmed incident.priority exists" — but that appears in the sweep table, not as evidence offered for the root cause, and the root cause's own evidence does not refer to it explicitly. Proximity is not a reference. It would also fail Case 3 independently: the root-cause statement names `execution_plan d96323b22b2e0bd817a6ffbeee91bf04` and the `measure_request` tool call, and never mentions `incident.priority` or any table/field the schema_lookup touched.

The conjunction is not met. Score **0**.

### fix_usable_unedited
§A's constraint is checked first and it binds: `fix_usable_unedited` may not be 1 while `fix_target_correct` is 0. `fix_target_correct` = 0, so the column is **0** and no case in §A2.1 arises.

For completeness, the fix would fail independently: §A2.1 Case 4 (target identified by kind — "agent execution parameters" and "configuration" name a class, not a record), and Case 1 (`"current": ""` with a `proposed` text that describes an operation — "Add post-execution validation step" — without naming a table, record or field to change). But §A's constraint has already decided it.
