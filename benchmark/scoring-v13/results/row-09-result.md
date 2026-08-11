# Row 09 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| total | 5/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct
The seed spec's header table gives the expected root-cause layer as `data` (layer 5). The report states three root causes, so §A2.2 Case 2 applies first: the primary is the entry the report itself labels primary — "ROOT CAUSE 1 — Empty routing data table *(PRIMARY)*". It asserts a defect, so it is not skipped. That entry declares a layer explicitly in a **Layer** row: `5 — Data`. Under §A2.2 Case 1 the declared value is scored, and it matches the seed's expected layer by both name and number. Score **2**. (Root causes 2 and 3 declare layers 3 and 7 respectively; §A2.2 Case 2 forbids scanning the list, and here that is moot since the primary already carries the expected layer.)

### fix_target_correct
The seed spec's `Expected fix target` row gives the area: **data seeding**. The *Expected diagnosis* section names the specific target: "the routing table holds zero rows... Fix target: data seeding, not the tool or the instructions" — i.e. seeding rows into the routing table, and it explicitly rules out the tool and the instructions.

FIX 1 declares `Target type: Data` and `Target: Table x_snc_tsbench_routing`, with the operation "Insert at minimum one row with `category = "Network"` and `assignment_group = ...`". Under §A2.3 Case 1 the declared target is scored, and under Case 2 this names the specific target the *Expected diagnosis* section names — the routing table, seeded with rows — in the terms that section uses. That is the **2** band.

FIX 2 and FIX 3 declare `Tool schema` targets and FIX 4 declares `Wiring`; those fall in different areas (and the seed explicitly rules out the tool), so each would score 0 on its own. But §A2.3's several-fixes rule takes the **highest value any single non-hedged fix earns**, and FIX 1 is the report's first fix and marked "required" — not hedged. Score **2**.

### evidence_cites_trace_and_config
§A1 Case 1 does not apply (a root cause is stated). Case 2 selects the subject: ROOT CAUSE 1, the labelled primary.

Its **Evidence** row cites two sources: (a) `query_table` on `x_snc_tsbench_routing` → `row_count: 0`, `unfiltered_row_count: 0`, `verdict: genuinely_empty` — a config/schema-half source; and (b) "tool execution output in trace: `{"ok":true,"matched":false,"category":"Network","rules_in_table":0}` (sn_aia_tools_execution `4313e73e2b624718f243fed2ce91bfaf`)" — a trace-half source, cited explicitly as being in the trace.

Case 3 (connection): the root-cause statement names table `x_snc_tsbench_routing` and the lookup returning `matched: false`; the `query_table` citation names that same table, and the trace citation names the tool execution output of that same lookup, which the finding describes ("Every lookup will return `matched: false`"). Both citations name artifacts the root-cause statement names. Satisfied for both halves.

Case 4 (audit-trail backing): the packet's audit trail records a distinct-tool set including `agent_trace` (backs the trace half — it is the only tool that backs it, and it is present) and `query_table` (one of the six that back the config/schema half, and also present alongside `agent_config`, `schema_lookup`, `genai_log`, `log_analysis`, `read_artifact`). Both halves are backed.

Case 5 (co-location): both citations sit inside ROOT CAUSE 1's own **Evidence** row — offered as evidence for the selected root cause itself, not elsewhere in the document. Satisfied.

Score **1**.

### fix_usable_unedited
§A's constraint does not bind (`fix_target_correct` is 2). §A2.1 Case 5 selects the subject: the proposed fix that addresses the defect the seed carries — FIX 1, and it alone (FIX 2/3 target the tool script and description, FIX 4 targets trigger wiring; none addresses the empty table). Cases 1–4 are then each necessary conditions on FIX 1.

Case 1 — the fix leaves a value slot unfilled. FIX 1's proposed operation is: "Insert at minimum one row with `category = "Network"` and `assignment_group = <the correct group name for Network requests>`." The `assignment_group` value is an explicitly unfilled slot, written as an angle-bracket placeholder. Condition 1 (target and operation specified) holds — the table, the fields, and the insert operation are all given. Condition 2 fails: the missing value must be *not obtainable from the instance* by the seven diagnostic tools. An assignment group name is a value the instance holds — `sys_user_group` is a populated platform table reachable by `query_table` (the run had `query_table` available and used it), and `schema_lookup` on `x_snc_tsbench_routing` would give the column's reference target. The run did not look it up. Case 1's own worked distinction points the other way only for "an assignment group for a table that is empty by design"; here the empty table is the *routing* table, not the group table, and the group name is not the builder's to invent — the report itself frames it as "the correct group name", i.e. a determinate value the run declined to establish. Supplying a description in place of the value does not change this.

Case 4 reinforces the same conclusion from the other side: "the correct group name for Network requests" identifies the value by kind rather than by name. Case 4's own cross-reference says a value named by kind is decided by Case 1 — if the instance holds a value answering the description, it was obtainable and the score is 0.

The §A2.1 preamble is explicit that Cases 1–4 are necessary conditions, not a cascade, and that reading only as far as the first case that yields a 1 is the error to avoid. FIX 1 satisfies Case 2 (the address resolves to one table and names the fields it writes) and Case 3 does not strictly arise as a snippet test, but Case 1's failure decides the column.

Score **0**.

Gate: `passes_gate` = 1 iff `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`. Here 2 AND 0 → **0**.
