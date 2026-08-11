# Row 16 — scorer verdict

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
The seed spec's header table prints `Expected root-cause layer` = `genai_stack` (layer 6).

Per §A2.2, apply Case 2 first: the report states exactly one root cause (`root_causes` has a single entry), so Case 2 does not arise and no primary selection is needed. That entry explicitly declares `"layer":"1"`. Under Case 1, where the report declares a layer, **score the declared value** and compare it against the expected layer — the substance of the finding text is explicitly not scored. Declared layer 1 ≠ expected layer 6. It is not a compound declaration (no conjunct names layer 6 / `genai_stack`).

Note the run's own `layers_swept` marks layer 6 `NOT_SWEPT`, and the finding prose ("Plan invalid or not created", capability_id cited) is filed under layer 1 — Case 1 states that prose describing another layer's mechanism does not lift the declared value. Score **0**.

### fix_target_correct
The seed's `Expected fix target` row is **capability mapping**; the *Expected diagnosis* section names the specific target: repoint the definition's `api` (currently `00000000000000000000000000000000`) at the real provider integration subflow — explicitly "not the tool script and not the agent instructions."

Per §A2.3 Case 1, where a fix declares its target, **score the declared value**. The single proposed fix declares `"target_type":"tool schema"` and `"target":"summarise_ticket tool definition"`. That is the **tool schema** area, not capability mapping — and the seed spec's expected-diagnosis section explicitly excludes the tool script as the target.

The `proposed` prose does mention "ensure capability mapping matches active provider", but Case 1 is unambiguous that prose elsewhere in the fix touching a different area does not move the column: "an instruction edit described as a step *inside* a fix declared against the tool definition is not a fix targeting the instruction." The declared target is a single (non-compound) `target_type` of "tool schema". Under Case 2's bands, a target in a different area from the expected one scores **0**.

### evidence_cites_trace_and_config
The report states one root cause, so §A1 Case 1 (no root cause) and Case 2 (multiple) do not bind — the subject is the single `root_causes[0]` entry.

Cases 3–5 award the point. That entry's `evidence` array contains exactly one item: `{"source":"trace","detail":"agent_trace showed tool response with status 'error' and capability_id '92ff62af516741769c437feb88c80ef3'"}`. The trace half is satisfied — it is an `agent_trace` citation (Case 4: `agent_trace` is recorded in the audit trail's distinct tool names), it is co-located in the root cause's own `evidence` (Case 5), and the root-cause statement names the `summarise_ticket` tool call the trace citation is about (Case 3).

The **config/schema half is simply absent**. The root cause's evidence list carries no `agent_config`, `schema_lookup`, `query_table`, `genai_log`, `log_analysis` or `read_artifact` citation. The audit trail does record `read_artifact` and `schema_lookup` calls, so config-family calls were made — but Case 5 requires the citation to be offered as evidence *for this root cause*, and material appearing elsewhere (the `layers_swept` table's mention of `schema_lookup` confirming a `priority` field on `incident`) does not count unless the root cause's own evidence refers to it explicitly, which it does not. Case 3 would independently defeat it anyway: the root-cause statement never names the `incident` table or a `priority` field. The report's own `failure_summary` concedes "with no corroborating evidence from non-trace sources," and the harness validator flagged the same one-evidence-item shortfall.

The conjunction fails. Score **0**.

### fix_usable_unedited
§A's constraint is checked first and it binds: `fix_usable_unedited` may not be 1 while `fix_target_correct` is 0. Since `fix_target_correct` = 0 above, the column is **0** and no §A2.1 case arises.

This is the correct outcome on the merits as well. The fix's `current` field reads "unknown (not inspected)", and the `proposed` text — "Validate plan creation logic and ensure capability mapping matches active provider" — is a described activity rather than an edit: no record, no field, no value. Even setting §A's constraint aside it would fail §A2.1 Case 1 (the `api` value was obtainable from the instance via `query_table` on the capability definition and the run never looked), Case 3 (no snippet or literal replacement that performs any change), and Case 4 (the target is given by kind — "capability mapping", "active provider" — with no named record or mapping).

### passes_gate
`passes_gate = 1` iff `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`. Both terms fail, so **0**.
