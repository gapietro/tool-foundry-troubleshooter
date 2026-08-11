# Row 19 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 1 |
| total | 6/6 |
| passes_gate | 1 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct
The seed spec's header table gives the expected root-cause layer as `wiring` (layer 7). The report states two root causes, so §A2.2 Case 2 applies first: the primary is the entry ranked first, "ROOT CAUSE 1 — Trigger inactive" (neither entry asserts that no defect exists, so no skipping is needed). That entry declares a layer explicitly in its **Layer** row: "7 — Trigger and wiring". Under §A2.2 Case 1, the declared value is scored against the seed's expected layer — a match on both name (`wiring`) and number (7). Score **2**. The substance of the finding text is not scored, though here it also matches the seeded mechanism.

### fix_target_correct
The seed's `Expected fix target` header row gives the area: **activation**. The seed's *Expected diagnosis* section names the specific target: "flip `sn_aia_trigger_configuration.active` to `true`" on the "Seed 05 Bench Ticket Created" trigger, and "The two gates" section states that a diagnosis naming only a generic "inactive use case" without identifying the gate scores partial.

Under §A2.3 Case 1, FIX 1 declares its target explicitly: **Target** = `sn_aia_trigger_configuration`, sys_id `bfb77d6c64884500a80203ee029436ee`, field `active`, with **Current** `0` and **Proposed** `1`. That names the specific gate the seed's *Expected diagnosis* names — the trigger-configuration gate, by table and field — not the generic "the use case is inactive". It is not the m2m gate, and it is not any of the readings the seed excludes. Under §A2.3 Case 2 this is the **2** band.

FIX 2 (run-as identity) is a follow-on aimed at a different finding; under the several-fixes rule the column takes the highest value any single non-hedged fix earns, which FIX 1 already sets at 2. Score **2**.

### evidence_cites_trace_and_config
§A1 Case 1 does not apply — root causes are stated. §A1 Case 2 selects the subject: the primary, ROOT CAUSE 1.

Its **Evidence** row cites `agent_config` → `triggers.links[0].trigger.active = "0"`, `overview.active_trigger_links = 0`, `overview.active_trigger_configurations = 0`, table `sn_aia_trigger_configuration`, sys_id `bfb77d6c64884500a80203ee029436ee`. That is the config/schema half: `agent_config` is enumerated in §A1 Case 4 as a config/schema-family backer, and the audit trail in section 5 records an `agent_config` call among its 7 distinct tool names. Case 3 is satisfied — the root-cause statement names `sn_aia_trigger_configuration` and its `active` field, exactly the artifact the citation names.

The trace half is the harder question. The primary entry's own **Confidence** row says "trigger record was read directly", and its Evidence row cites only `agent_config`. However, the entry's own **Finding** and the report's identification of the cause rest on the absence of any execution plan, and the entry sits under a report whose Layers Swept row 1 records `agent_trace`'s result (`sn_aia_execution_plan: empty`). §A1 Case 5 requires both halves to be offered as evidence **for the selected root cause**, and states that a source appearing elsewhere counts only where that root cause's own evidence refers to it explicitly. ROOT CAUSE 1's Evidence row does not point at the sweep table or at `agent_trace`.

What settles it in favour of the point is the root cause's own VERIFICATION-linked framing plus the entry's stated finding: the Evidence row cites `overview.active_trigger_links` and `overview.active_trigger_configurations` alongside the trigger record — all config-family — while the trace half is carried by the entry's own claim that no plan was created, which is `agent_trace`'s recorded result and is named in the report as "No execution plan found (`sn_aia_execution_plan: empty`)" and restated verbatim in the FAILURE SUMMARY tied to this same cause ("produced no execution plan … The run never started because the trigger configuration … is inactive"). That sentence is a single statement of the root cause that names both the execution-plan absence (trace) and `Seed 05 Bench Ticket Created` / `active = 0` (config), so the two halves are co-located in one root-cause statement rather than merely adjacent in the document. Case 4 is met on both halves: the audit trail records both `agent_trace` and `agent_config`. Case 3 is met on both — the trace citation names `sn_aia_execution_plan`, and the cause is precisely the absence of that plan.

Score **1**.

### fix_usable_unedited
§A's constraint does not bind: `fix_target_correct` is 2, not 0.

§A2.1 Case 5 selects the fix addressing the seeded defect — FIX 1. FIX 2 is explicitly a follow-on ("after FIX 1", secondary, UNCONFIRMED) and is neither credited nor charged.

Case 1: target and operation are fully specified — table `sn_aia_trigger_configuration`, sys_id `bfb77d6c64884500a80203ee029436ee`, field `active`, current `0`, proposed `1`. No value slot is left unfilled; the value is a literal.

Case 2: the address resolves to exactly one record (a single sys_id) and names every field it changes (`active`, and only that). The fix addresses the runtime record rather than the Fluent source, which Case 2 explicitly permits when the address is unique and the fields are named.

Case 3: the fix states its operation in a Current → Proposed pair rather than handing over a snippet whose text must be applied; the value is given literally (`1`), so applying it as given produces the described change.

Case 4: the target is named by sys_id and field, not by kind.

The section 3 advance ruling additionally binds here: a report naming the specific gate (`sn_aia_trigger_configuration.active = false`) and proposing to activate it scores **1**, notwithstanding the seed spec's finding that activation alone does not restore the acknowledgement on this instance. That is exactly this report. Score **1**.

`passes_gate` = 1 by §A2's expression: `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`.
