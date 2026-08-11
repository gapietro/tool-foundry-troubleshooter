# Row 17 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 0 |
| fix_usable_unedited | 1 |
| total | 5/6 |
| passes_gate | 1 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct
The seed spec's header table gives the expected root-cause layer as `wiring` (layer 7). The report states three root causes, so §A2.2 Case 2 applies first: evaluate against the primary — the entry the report ranks first, skipping any entry asserting no defect exists. RC-1 ("Trigger is inactive") is first and asserts a real defect, so it is the subject. RC-1 declares a layer explicitly in its **Layer** row: "7 — Trigger & wiring". Under §A2.2 Case 1, the declared value is scored against the seed's expected layer. Declared 7 = expected layer 7 → **2**. RC-2 and RC-3 also declare layer 7, but they are neither credited nor charged; the primary alone decides.

### fix_target_correct
§A2.3 Case 1: where a fix declares its target, score the declared value. FIX-1 declares **Target type** "Configuration" and **Target** `sn_aia_trigger_configuration` · sys_id `bfb77d6c64884500a80203ee029436ee` · field `active`, with Current `0` → Proposed `1`.

§A2.3 Case 2 requires reading two places in the seed spec. The header row gives the area: **activation**. The *Expected diagnosis* section names the specific target: "flip `sn_aia_trigger_configuration.active` to `true` on that trigger", and "The two gates" section states that a diagnosis that stops at the generic "the use case is inactive" without naming which gate scores partial. FIX-1 names the specific gate — the table `sn_aia_trigger_configuration`, the field `active`, and the specific trigger record — and proposes flipping it to active. That is the specific target the *Expected diagnosis* section names, in the terms that section uses. The declared "Target type: Configuration" is a label for the operation kind, but the declared **Target** row resolves to the activation gate itself, and the seed's expected-target row excludes no reading here. Full band → **2**.

FIX-2 and FIX-3 target other areas (run-as identity, access role configuration); under §A2.3's multiple-fix rule the column takes the highest value any single non-hedged fix earns, so they neither add nor subtract, and FIX-1 is itself the primary fix so the 2 is reachable from it directly.

### evidence_cites_trace_and_config
Subject is fixed by §A1 Cases 1–2 as RC-1 (report states more than one root cause; RC-1 is ranked first and asserts a defect). RC-1's **Evidence** row reads: "`agent_config` artifact `c655960b2b6e0fd817a6ffbeee91bfe9`, triggers section: `"active":"0"` on the trigger record; `overview` section: `active_trigger_links = 0`, `active_trigger_configurations = 0`".

- **Config/schema half:** satisfied. The citation names `agent_config`, which §A1 Case 4 enumerates as backing the config half, and the audit trail records an `agent_config` call. §A1 Case 3 is met — the cited artifact's triggers section names the trigger record and its `active` field, the same artifact RC-1's finding names.
- **Trace half:** not satisfied. RC-1's evidence cites no execution trace source at all. The only trace-adjacent statement inside RC-1 is the Confidence row's "absence of any execution plan corroborates" — that names no `agent_trace` citation and offers no pointer to one. The `sn_aia_execution_plan` = empty observation lives in the LAYERS SWEPT table (row 1), which is elsewhere in the report; §A1 Case 5 requires both halves to be offered as evidence for the selected root cause, and states that proximity in the document is not a reference — a pointer is. RC-1's evidence block contains no pointer to the sweep table. The audit trail does record an `agent_trace` call, so Case 4 would have been satisfied had a trace citation been offered under RC-1; the failure is Case 5 (co-location), not Case 4.

Conjunction fails on the trace half → **0**.

### fix_usable_unedited
§A's constraint is checked first: `fix_target_correct` = 2, so the constraint does not bind.

The advance ruling in section 3 governs directly and must be applied rather than re-derived: a report that names the specific gate (`sn_aia_trigger_configuration.active = false`) and proposes activating it scores `fix_usable_unedited` = **1**, notwithstanding that activation alone does not restore the acknowledgement on this instance. FIX-1 does exactly that — names the gate, the specific record sys_id, the field, and states Current `0` → Proposed `1`.

Checking §A2.1's cases against FIX-1 (which is also the fix §A2.1 Case 5 selects, being the one addressing the seeded defect; FIX-2 and FIX-3 address other findings and are neither credited nor charged):
- **Case 1** — no value slot is unfilled: the record, the field, and the literal target value (`1`) are all supplied.
- **Case 2** — the address resolves to exactly one runtime record (`sn_aia_trigger_configuration` sys_id `bfb77d6c64884500a80203ee029436ee`) and names the single field it changes (`active`).
- **Case 3** — the fix states its operation as a current→proposed field value rather than handing over a code snippet, so this case does not arise; Cases 1–2 govern.
- **Case 4** — the target is named by identity (table + sys_id + field), not by kind.

All cases that arise are satisfied → **1**.

`passes_gate` = 1 by §A2's expression: `root_cause_layer_correct` == 2 AND `fix_usable_unedited` == 1.
