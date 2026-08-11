# Row 01 — scorer verdict

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

The seed spec's header table prints the expected layer as `tool_schema` (layer 3).

The report states three root causes, so §A2.2 Case 2 applies first: evaluate against the primary. RC-1 is explicitly labelled *(PRIMARY — CONFIRMED)* and is ranked first; it does not assert that no defect exists. RC-1 is therefore the subject, and RC-2/RC-3 are neither credited nor charged.

RC-1 declares a layer: **`Layers: 4 (schema) + 3 (tool script)`**. §A2.2 Case 1 governs — score the declared value, and a declared layer naming more than one layer is read on the conjunct that names the expected layer. Conjunct "3 (tool script)" names the expected layer 3 directly, so this scores **2**. (Conjunct "4" would independently qualify as well under the seed's own §"Scoring note — layers 3 and 4 (M18)", which awards full marks to a layer-4 answer stating the disagreement — RC-1's finding does state both sides: string word written by the script *and* Integer column type. But the compound rule already settles it on the layer-3 conjunct.)

Per Case 1 I do not score the substance of the finding text, and per Case 2 I do not consult the `LAYERS SWEPT` table as a modifier.

### fix_target_correct

Seed spec, two places per §A2.3 Case 2:
- `Expected fix target` header row: the tool's **word-typed contract** — map the word to its integer inside the script, or change the tool description + agent instructions to pass 1–5. Explicitly **not** "the tool input schema".
- *Expected diagnosis* section, specific target: "map the word to its integer value inside the script before `setValue`, or change the tool description and the agent instructions to pass 1–5."

FIX 1 declares **Target:** `sn_aia_tool[8953...].script`, and its body inserts a `MAP = { critical: 1, ... }` translation applied before `gr.setValue`. Under §A2.3 Case 1 the declared target is scored, and here the declared target (the tool script) and the body agree. This is exactly the first disjunct the *Expected diagnosis* section names — mapping the word to its integer inside the script before `setValue` — so FIX 1 earns the **2** band on its own.

FIX 2 additionally targets the tool description (the second named disjunct), which reinforces rather than changes the value. The exclusion in the header row — "Not the tool input schema" — needs checking, since FIX 2's heading says "Update tool description **and input schema**". But FIX 2's declared target is the tool description plus the binding's `priority` *input description*, and its `Proposed input description` is descriptive text, not a type constraint; it does not propose "constrain the input schema to 1–5", which is the reading the seed rules out. Even if FIX 2 were read as touching the excluded target and scoring 0, §A2.3's several-fixes rule takes the highest value any single non-hedged fix earns, and FIX 1 earns 2.

FIX 3 (the ReAct `TypeError`) is a different area, but it is neither the primary nor does it lower the column under the highest-value rule.

Score: **2**.

### evidence_cites_trace_and_config

§A1 Case 1 does not apply — root causes are stated. Case 2 selects RC-1, the labelled primary.

RC-1's own **Evidence** block, evaluated on its four bullets:

- *Config/schema half*: `schema_lookup x_snc_tsbench_ticket.priority` → `type: "Integer"`, `has_choices: false`. Case 3 — RC-1's finding statement names `x_snc_tsbench_ticket.priority` and its Integer typing, the same artifact the citation names, so it is connected. Case 4 — `schema_lookup` is enumerated in the config/schema family and the audit trail records a `schema_lookup` call among the six distinct tool names. Satisfied. (The tool-script-body citation via `agent_config` artifact `4d4106cb...` is a second, independently backed config citation — `agent_config` and `read_artifact` are both in the trail and both in the config family.)
- *Trace half*: `sn_aia_tools_execution[ad7363322ba24718f243fed2ce91bfe1]` → `{ok:true, priority_requested:"critical", priority_stored:null}` and `sn_aia_execution_task[997363322ba24718f243fed2ce91bf6c]` output → `priority_stored: null`. These are execution-trace records of the failing plan. Case 3 — RC-1's finding names the script's `setValue` write and states `check.getValue('priority')` returns `null`, which is precisely what the cited tool-execution result records; the citation is connected to the cause. Case 4 — the trace half is backed by a recorded `agent_trace` call and by nothing else; the audit trail lists `agent_trace` among the distinct tool names, so it is backed.

Case 5 — both halves are co-located inside RC-1's own Evidence list, not borrowed from the failure summary or the sweep table.

All five cases pass; score **1**. This also matches the evidence the seed says a correct diagnosis should cite: the trace showing `priority_stored` disagreeing with `priority_requested`, plus the dictionary entry showing integer typing.

### fix_usable_unedited

§A's constraint checked first: `fix_target_correct` is 2, not 0, so the constraint does not bind.

§A2.1 Case 5 selects the subject: the proposed fix addressing the seeded defect. That is **FIX 1** (FIX 2 is a companion description change; under the case's wording, if more than one proposed fix addresses the seeded defect all must satisfy Cases 1–4, so I check FIX 2 as well. FIX 3 addresses a different finding and is neither credited nor charged).

Cases 1–4 as necessary conditions on FIX 1:

- **Case 1 (unfilled value slot):** none. The target record, the field (`script`), the operation (replace full script body) and the complete replacement text are all given. The mapping values (critical→1 … planning→5) are supplied literally; nothing is left for the builder to look up.
- **Case 2 (runtime record address):** the target resolves to exactly one record — `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac]` — and names the single field it changes (`.script`). A unique runtime address translating to Fluent source is explicitly not an edit.
- **Case 3 (incomplete edit):** the fix supplies the entire replacement script body verbatim, and it performs the change it describes: it maps the word, guards unrecognised input, gets the record, writes `intVal`, updates, reads back, and returns the result. It is a self-invoking IIFE `(function (inputs) {...})(inputs);` and so is runnable as a script-tool body. Applying the text exactly as given produces the described change. (The returned `ok` becomes `stored == intVal`, i.e. the masking defect is also closed — a strengthening, not a gap.)
- **Case 4 (target by kind):** the target is named by sys_id and field, not by category.

FIX 2 likewise names one record and its fields, and supplies the literal replacement strings for both the tool description and the input description — nothing characterised-but-unwritten.

The fix also addresses the defect the seed actually carries (word-to-integer mapping inside the script, the seed's own first named remedy). Score **1**.

`passes_gate` = 1, since `root_cause_layer_correct` == 2 and `fix_usable_unedited` == 1.
