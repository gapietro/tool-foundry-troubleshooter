# Row 20 — scorer verdict

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

The seed spec's header table prints `Expected root-cause layer` = `wiring` (layer 7).

§A2.2 Case 2 is applied first: the report's `root_causes` array holds exactly one entry, so Case 2 does not arise. The single entry does not assert that no defect exists (it asserts an absence of execution plans as a cause), so it is the subject.

§A2.2 Case 1 then governs: the entry declares a layer explicitly — `"layer": "1"`. Where the report declares a layer, the declared value is scored, and it is compared against the expected layer. `1` ≠ `7`, so the column scores **0**.

Case 1 is emphatic that the substance of the finding text is not scored — but here even the substance does not rescue it: the finding is "No execution plans exist for the agent in the specified timeframe", which restates the observed absence rather than naming the wiring layer or the trigger configuration. The `layers_swept` object marks layer 7 SWEPT, but §A2.2 Case 2's closing note states plainly that `layers_swept` is not consulted for this column — it is a column of its own and not a modifier on this one. Likewise the declared layer is a single value, not a compound (`"1"` names only layer 1), so the compound-conjunct clause does not apply.

Score: **0**.

### fix_target_correct

§A2.3 Case 1 is applied first: the single proposed fix declares its target — `"target_type": "configuration"`, `"target": "agent trigger configuration"`. The declared value is what is scored.

§A2.3 Case 2 then fixes the bands. The seed spec's header row gives the expected **area** as `activation`; the *Expected diagnosis* section names the **specific** target as flipping `sn_aia_trigger_configuration.active` to `true` on the "Seed 05 Bench Ticket Created" trigger, and the "The two gates" section states explicitly that a diagnosis identifying only that the use case/trigger is inactive, without naming `sn_aia_trigger_configuration.active`, scores **1 of 2**.

The declared target "agent trigger configuration" plus the proposed operation "Verify trigger exists and is active" lands in the activation area — it is about the trigger being active, not about tool schema, instruction text, data seeding or capability mapping. But it does not name `sn_aia_trigger_configuration.active`, does not name the specific trigger record, and does not distinguish the two gates the seed exists to separate. That is precisely the partial case the seed spec pre-defines.

The seed spec's expected-target row excludes no reading here, so the 0 band on exclusion grounds does not apply. The report proposes only one fix, and it is not marked hedged or alternative, so it is the primary — the 1 band is available from it.

Score: **1**.

### evidence_cites_trace_and_config

Cases are applied in order.

Case 1: the report does state a root cause (it is not `inconclusive`; `"inconclusive": null` and one entry is present), so the column has a subject.

Case 2: exactly one root cause, so the primary is that entry. It does not assert "no defect exists" — it asserts an absence as the cause — so it is not skipped.

Case 3 is where this fails. The root-cause statement is: component "execution plan absence", finding "No execution plans exist for the agent in the specified timeframe". The two evidence entries are:

- trace half — `agent_trace` returned no execution plans for the agent in the window. This citation names the same artifact the root-cause statement names (execution plans for that agent in that timeframe). This half is connected, and Case 4 backs it: the audit trail records an `agent_trace` call among the four distinct tool names.
- config half — "agent_config shows no active triggers for 'Seed 05 Ticket Acknowledger'". This names **triggers**. The root-cause statement names only execution plans and their absence; it never mentions triggers, trigger configuration, `sn_aia_trigger_configuration`, or any configuration object. Case 3 requires that the root-cause statement the citation is offered under **names the artifact cited** — the same table, record, field, script, artifact or configuration object. It does not. The trigger appears only in the *fix*, not in the root-cause statement, and Case 5 forbids reaching outside the root cause's own evidence for a source unless that evidence refers to it explicitly.

No other cited config/schema source exists in this root cause's evidence list, so the "unless some other cited source of that half's type does" escape in Case 3 is unavailable. The config half is therefore unsatisfied and the conjunction fails.

For completeness, Case 4 would not have rescued it either way in the other direction: `agent_config`, `read_artifact` and `schema_lookup` are all recorded in the trail, so the config family was called — but Case 4 only backs a citation that has already passed Case 3, and this one has not.

Score: **0**.

### fix_usable_unedited

§A's constraint is checked first, and it does not bind: `fix_target_correct` is 1, not 0, so the column is not forced to 0 by that route.

The section 3 advance ruling is checked next. It applies to "a report that names the specific gate (`sn_aia_trigger_configuration.active = false`) and proposes activating it". This report does neither — it names no gate, names no field, and does not propose activation; it proposes verification. The ruling's precondition is unmet, so it does not reach this row and nothing in it shields the fix.

§A2.1 then governs. Case 5 selects the subject: one fix is proposed, so it is the subject by default. Cases 1–4 are each necessary conditions.

Case 4 fails outright. The target is identified by kind, not by name: "agent trigger configuration" is a *class* of records. The seed's instance carries a specific trigger configuration record (the "Seed 05 Bench Ticket Created" trigger), and the fix leaves choosing it to the builder. Case 4 states plainly that a description resolving to a class of records meets neither Case 1's first condition nor Case 2's address test, and that "choosing a member of that class is the edit the column asks whether the builder can skip." Case 4's closing note also forecloses the defence that the run was blind to the name: the column scores what the builder AI receives, not what the run could reasonably have known.

Case 1 fails independently. The operation is not fully specified — "Verify trigger exists and is active" is a *check*, not an edit; it names no field to write and no value to write. `"current": ""` is empty. And the missing information was obtainable from the instance: the audit trail records an `agent_config` call, and the seed's own material shows the trigger configuration and its `active` value are readable by the diagnostic toolset. Under Case 1 that is "diagnosis the run declined to perform" and scores 0.

Case 2 fails as well: the address does not resolve to exactly one record, and no field it changes is named. Case 3 does not arise, since no snippet is supplied and the operation is stated in prose.

The first failing case decides the column, and three of the four fail.

Score: **0**.

`passes_gate` = 1 iff `root_cause_layer_correct` == 2 AND `fix_usable_unedited` == 1. Here 0 and 0, so `passes_gate` = **0**.
