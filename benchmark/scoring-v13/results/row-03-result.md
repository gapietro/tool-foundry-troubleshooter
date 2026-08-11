# Row 03 — scorer verdict

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

§A2.2 says to apply Case 2 first, since the report states four root causes (RC-1 through RC-4). The primary is selected as (a) the entry the report labels primary or ranks first, else (b) the first entry in the list, skipping any entry asserting no defect exists. RC-1 is first in the list and asserts a defect, so RC-1 is the subject. No scanning of RC-2/3/4 is permitted.

RC-1 declares a layer explicitly: **`Layer` | 3 — Tool definitions / 4 — Data schema**. Under §A2.2 Case 1, a declared layer is scored as declared, without judging the finding text. This is a compound declaration naming more than one layer, and the rule says a compound is read on the conjunct that names the expected layer, scoring **2** if one does. The seed spec's header row prints the expected layer as `tool_schema` (layer 3). RC-1's first conjunct is "3 — Tool definitions", which matches. The other conjunct (4 — Data schema) is neither credited nor charged — and the seed's own §"Scoring note — layers 3 and 4 (M18)" independently confirms that a layer-4 answer framed as the disagreement also scores full marks. The declared compound therefore scores **2**.

(For completeness, though Case 1 forbids scoring the substance: RC-1's finding does state the disagreement — a word passed to an Integer-typed column — rather than one side alone, so the seed's M18 caveat about naming only one half without the mismatch does not bite.)

### fix_target_correct

§A2.3 Case 1: where a fix declares its target, score the declared value. The column takes the highest value any single non-hedged proposed fix earns, with the 1 band available only from the primary fix; the 2 band may come from any non-hedged fix.

FIX-1 is the primary fix and declares **Target type: Tool schema — script**, **Target: `sn_aia_tool` … field `script`**, with the operation being a word-to-integer map applied before `setValue`. The seed spec's *Expected diagnosis* names the specific target as "the tool's word-typed contract — map the word to its integer value inside the script before `setValue`, or change the tool description and the agent instructions to pass 1–5." FIX-1 is literally the first of those two named alternatives, written into the tool script. Under §A2.3 Case 2 that is the **2** band: it names the specific target in the terms the *Expected diagnosis* section uses, not merely the area.

The exclusion clause does not bite. The seed spec's expected-target row explicitly rules out "the tool input schema" ("**Not** 'the tool input schema'"). FIX-3 does target `input_schema` and would score 0 on its own — but FIX-3 is not the primary, and the column takes the *highest* value any single non-hedged fix earns, so FIX-3 neither lowers nor caps the value earned by FIX-1. FIX-4 (wiring) and FIX-5 (instruction latency) likewise sit in other areas and are neither credited nor charged against FIX-1's 2.

### evidence_cites_trace_and_config

§A1 in order. Case 1 does not arise — the report states root causes. Case 2 selects the primary, RC-1, by the same rule used above; the column is evaluated against RC-1 alone.

Cases 3–5 then decide whether each half is satisfied, evaluated on RC-1's own **Evidence** row:

- **Trace half.** RC-1's evidence cites "Tool response in trace: `{"ok":true,"priority_requested":"critical","priority_stored":null}` — `sn_aia_tools_execution` sys_id `098563be2b2e0bd817a6ffbeee91bfd1`". Case 3: RC-1's root-cause statement names the tool script's `setValue` call and the resulting silent discard with the immediate re-read returning `null` — the same artifact and the same value the cited trace record carries, so the citation is connected to the cause it supports. Case 4: the trace half is backed only by a recorded `agent_trace` call; the audit trail's distinct tool names include `agent_trace`, so it is backed. Case 5: the citation sits inside RC-1's own Evidence row, not in the failure summary or the sweep table, so co-location holds.
- **Config/schema half.** RC-1 cites "Schema: `x_snc_tsbench_ticket.priority` type=`Integer`, `has_choices: false` — `sys_dictionary`" and the tool script body from `sn_aia_tool.script`. Case 3: RC-1's finding names both the `priority` column's Integer typing and the tool script — the same artifacts cited. Case 4: the config/schema half is backed by any of the six non-trace families; the audit trail records `schema_lookup`, `agent_config` (x3), `query_table`, `genai_log`, `read_artifact` (x10) and `log_analysis`, so both the schema citation and the tool-script citation are backed. Case 5: again, both sit in RC-1's own Evidence row.

Both halves are satisfied for the primary root cause. Score **1**. (Note the packet's caution that this column is not a gate term; it does not move `passes_gate` either way here.)

### fix_usable_unedited

§A's constraint is checked first: `fix_target_correct` is 2, not 0, so the constraint does not bind and the cases arise.

§A2.1 Case 5 selects the subject: the proposed fix that addresses the defect the seed carries. The seeded defect is the word-typed contract writing a non-integer into an Integer column. **FIX-1** addresses it. FIX-2 is a hardening of the silent-success return contract rather than a repair of the type mismatch itself, and FIX-3/4/5 address other findings — those are neither credited nor charged. If FIX-2 were also read as addressing the seeded defect it would have to satisfy Cases 1–4 too; it does, on the same analysis as below (it names one record and one field, supplies complete replacement statements, fills every value, and names its target by sys_id), so the column's value does not turn on that reading.

Cases 1–4 are then each necessary conditions on FIX-1:

- **Case 1 (unfilled value slot).** The target and operation are fully specified — `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac`, field `script`, replace the raw pass-through with a mapped integer. No value slot is left open: the map is written out in full with all five word→integer pairs (`critical: 1` … `planning: 5`), so nothing remains for the builder to look up. Condition 1 and condition 2 both hold vacuously on the value front because no value is missing.
- **Case 2 (runtime record rather than Fluent source).** The fix addresses a runtime record (`sn_aia_tool`) rather than the Fluent source, so this case applies. The address resolves to exactly one record — a single sys_id — and names exactly the field it changes (`script`). Case 2 explicitly states that translating a unique runtime address into its Fluent source is not an edit to the fix, so this scores 1.
- **Case 3 (incomplete edit).** The fix hands over a code snippet, so this case applies and is the sharpest test here. The snippet is not a fragment that merely computes a corrected value and leaves it unwritten: it declares the map, normalises the input word, resolves `priorityInt`, returns an error on an unrecognised word, and — crucially — ends with `gr.setValue('priority', priorityInt);`, the write itself. The **Current** row quotes the line being replaced (`gr.setValue('priority', inputs.priority);`) and the **Proposed** row returns the amended text including the replacement for that line, so the "quoted as current but never returned as amended" failure does not occur. Applying the given text exactly as written produces the change the fix describes.
- **Case 4 (target named by kind).** The target is named by sys_id and field name, not by category, so this case does not bite.

Every case that arises is satisfied, and the fix addresses the defect the seed actually carries — not the excluded "constrain the input schema to 1–5" reading, which lives in FIX-3 and is not the subject here. Score **1**.

`passes_gate` = 1 by §A2's expression: `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`.
