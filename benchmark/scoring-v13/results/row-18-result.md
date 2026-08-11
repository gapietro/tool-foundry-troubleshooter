# Row 18 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 1 |
| evidence_cites_trace_and_config | 0 |
| fix_usable_unedited | 0 |
| total | 1/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct
The seed spec's header table gives `Expected root-cause layer` = `wiring` (layer 7). The report states exactly one root cause, so §A2.2 Case 2 does not arise and the single entry is the subject. That entry declares a layer explicitly: `"layer": "1"`. Under §A2.2 Case 1, where the report declares a layer, **score the declared value** and do not score the substance of the finding text. `1` ≠ `7`, and the declared value is not a compound naming layer 7 as a conjunct. The `layers_swept` table marking layer 7 SWEPT is expressly not consulted here (§A2.2 Case 2's "two things this case deliberately does not do"). Score **0**.

### fix_target_correct
The report proposes exactly one fix, and it declares its target: `"target_type": "configuration"`, `"target": "agent trigger configuration"`. Under §A2.3 Case 1 the declared value is what is scored. The seed's `Expected fix target` row is **activation**; the seed's *Expected diagnosis* section names the specific target as flipping `sn_aia_trigger_configuration.active` to `true` on the "Seed 05 Bench Ticket Created" trigger.

Applying §A2.3 Case 2's bands: the declared target "agent trigger configuration" is the trigger configuration — the artifact the activation gate lives on — so it falls in the same area (activation) as the expected row, but it does **not** name the specific target: it never names the `active` field, never states the gate is off, and never distinguishes the trigger-configuration gate from the m2m gate. The seed's "The two gates" section is explicit that a diagnosis stopping at the generic observation without identifying which gate "scores **partial**, not full, on fix target." Nothing in the seed spec excludes this reading (the 0 band's exclusion clause does not apply — no reading is ruled out in as many words here). Score **1** (partial).

### evidence_cites_trace_and_config
§A1 is applied in order. Case 1: a root cause is stated ("No execution plans exist for the agent in the specified timeframe"), so the column has a subject — note this is an assertion about an absence of executions, but it is offered as a cause, not as "there is no defect", so it is not skipped. Case 2: only one entry, so the primary is that entry.

Cases 3–5 then decide the point. Both citations are co-located under the root cause's own `evidence` array, so Case 5 is satisfied.

Case 3 — connection. The root-cause statement names the *execution plan* / *the agent's execution plans in the timeframe*. The trace citation ("agent_trace returned no execution plans for 'Seed 05 Ticket Acknowledger' between …") names exactly that artifact and that agent, so the trace half passes Case 3. The config citation reads "agent_config shows no active triggers for the agent" — it names *triggers*, an artifact the root-cause statement ("No execution plans exist for the agent in the specified timeframe", component "execution plan") never mentions. Case 3 requires the root-cause statement it is offered under to name the artifact cited — the same table, record, field, script, artifact or configuration object. "Execution plan" is not "trigger", and the shared mention of "the agent" is the subject of the sentence, not the cited artifact. No other config/schema-type citation is offered under this root cause, so the config half is unsatisfied and, per Case 3, the column scores **0**.

Case 4 would not have rescued it: the trail does record `agent_trace` (backing the trace half) and `agent_config` ×2 plus `schema_lookup` (a config-family family call), so the failure here is Case 3's connection test, not Case 4's backing test. Score **0**.

### fix_usable_unedited
§A's constraint is checked first: `fix_target_correct` is 1, not 0, so the constraint does not bind and the cases arise.

The §3 advance ruling is checked next. It applies only to "a report that names the specific gate (`sn_aia_trigger_configuration.active = false`) and proposes activating it." This report does neither — it never names the field, never states the gate is off, and its proposed operation is "Verify trigger wiring in agent_config", which is a verification step, not an activation. The ruling therefore does not arise.

§A2.1 Case 5: only one proposed fix, so it is the subject.

Case 1 fails. The fix must fully specify the target and the operation — the table or record, the field, and what to do to it. Here the operation is "Verify trigger wiring in agent_config": no table, no record sys_id, no field, and no change. `current` is empty. "Verify" is not an operation the builder AI can apply; it is a discovery procedure handed over in place of the finding, which §A2.1 Case 1 explicitly says does not change the score. The value that was missing — which trigger record, which field, which value — was obtainable from the instance via `agent_config` (the run in fact called it twice) and via `schema_lookup` on `sn_aia_trigger_configuration`, so condition 2 fails as well.

Case 4 fails independently. The target is named by kind, not by name: "agent trigger configuration" describes a *class* of records — it names neither the "Seed 05 Bench Ticket Created" trigger nor any sys_id — and choosing a member of that class is exactly the edit this case asks whether the builder can skip. Case 2's address test is likewise unmet: the address does not resolve to exactly one record, and no field to be changed is named.

Since the cases are necessary conditions rather than a cascade, the first failure decides. Score **0**.

`passes_gate` = 0 by the §A2 expression: `root_cause_layer_correct` is 0 (not 2) and `fix_usable_unedited` is 0.
