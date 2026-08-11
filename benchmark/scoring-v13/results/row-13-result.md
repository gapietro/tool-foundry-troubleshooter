# Row 13 — scorer verdict

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

The seed spec's header table gives `Expected root-cause layer` = `genai_stack` (layer 6).

The report states three root causes, so §A2.2 Case 2 applies first: the column is evaluated against the primary — the entry ranked first, skipping any entry asserting no defect exists. RC-1 is ranked first and asserts a defect, so RC-1 is the subject.

RC-1 declares a layer explicitly in its attribute table: **Layer** = `6 — GenAI stack`. Under §A2.2 Case 1, a declared layer is scored as declared, compared against the seed's expected value. `6 — GenAI stack` matches `genai_stack` (layer 6) exactly. Score **2**.

(The secondary entries RC-2 and RC-3 declare layer 3; under Case 2 they are neither consulted nor charged.)

### fix_target_correct

The seed's `Expected fix target` header row gives the area: **capability mapping**. Per §A2.3 Case 2, the specific target comes from the *Expected diagnosis* section: "repoint `api` at the real provider integration subflow" on the capability definition — i.e. the `api` field on `sys_one_extend_capability_definition` for `x_snc_tsbench_unmapped_capability`.

The report proposes three fixes. Under §A2.3's multi-fix rule, the column takes the highest value any single non-hedged fix earns (the 1 band restricted to the primary; the 2 band available from any). FIX-1 is the primary and is not hedged.

FIX-1 declares **Target type** = "Configuration — GenAI capability definition" and **Target** = `sys_one_extend_capability_definition`, record `904c0485699a4a73a124446a7231c563`, field `api`. Per Case 1, the declared target is what is scored. That is the capability-mapping area, and it names the *specific* target the Expected diagnosis section names — the definition record's `api` field, to be repointed at a real `sys_hub_flow` provider integration record. Score **2**.

The seed's decoy exclusion does not bite: the report nowhere proposes binding a connection/credential alias, and never names the empty `connection` as the cause. FIX-2 and FIX-3 are tool-schema fixes in a different area; under the multi-fix rule they are neither credited nor charged once FIX-1 has already earned the top band.

### evidence_cites_trace_and_config

§A1 Case 2 first: three root causes are stated, so the subject is the primary, RC-1 (first-ranked, asserts a defect).

RC-1's own **Evidence** row offers both halves:
- config/schema half — `genai_log check_config`, definition `904c0485699a4a73a124446a7231c563`, field `api` = `00000000000000000000000000000000`; plus a `sys_hub_flow` read;
- trace half — "Corroborated by tool call response: `ok:false`, `status:error`, `planId:null` (`sn_aia_tools_execution` row `bf13ab3e2b624718f243fed2ce91bfad`)", which is the execution's tool-call result from the trace.

Case 3 (connection): both citations name artifacts RC-1's own finding statement names — the `api` field on the capability definition record `904c0485699a4a73a124446a7231c563` with `api_type=sys_hub_flow`, and the executor returning `status: error`. Same records, same fields. Connected on both halves.

Case 4 (audit-trail backing): the trail records 7 distinct tool names including `agent_trace` (backing the trace half) and `genai_log`, `query_table`, `schema_lookup`, `agent_config`, `read_artifact`, `log_analysis` (any of which backs the config half; `genai_log` is the one actually cited). Both families are recorded. Satisfied.

Case 5 (co-location): both halves appear inside RC-1's own **Evidence** row, not merely elsewhere in the document. Satisfied.

Score **1**.

### fix_usable_unedited

§A's constraint does not bind — `fix_target_correct` is 2, not 0. §A2.1 Case 5 then selects the subject: the fix addressing the defect the seed carries, which is FIX-1 alone (FIX-2 and FIX-3 address other findings and are neither credited nor charged).

Cases 1–4 are each necessary conditions on FIX-1.

**Case 1 fails.** FIX-1's target and operation are fully specified (condition 1 met: the table, the record sys_id, the field `api`, and the operation "repoint"). But the **value** is left as a slot: `Proposed` reads "The sys_id of the intended `sys_hub_flow` provider integration record (e.g., the Now LLM Service spoke flow for the target model)" and then supplies a **discovery procedure** — "Identify the correct flow in Now Assist → Capabilities → … → API picker."

Condition 2 asks whether the missing value was obtainable from the instance by any of the seven diagnostic tools. It plainly was: the seed spec records that the healthy value for a Now LLM Generic definition on gpinst01 is a specific `sys_hub_flow` sys_id used by 422 of the 2026 definition rows — a value sitting in `sys_one_extend_capability_definition` and `sys_hub_flow`, reachable by `query_table` or `genai_log`. The run made 14 calls including `query_table` and `genai_log` and simply did not look it up. Case 1 states this outcome directly: "If the value **was** obtainable and the run simply **did not look it up**, score **0**. Supplying a discovery procedure in place of the value does not change this, and a procedure whose steps are UI actions rather than tool calls does not make a value unobtainable." FIX-1's procedure is exactly a UI-action procedure.

Case 4 points the same way on the value's phrasing — "the intended `sys_hub_flow` provider integration record" and "the Now LLM Service spoke flow" identify a *class* of records rather than a named one — but Case 4's own note routes a value named by kind back to Case 1, and Case 1 has already decided it.

The builder AI receiving FIX-1 as written cannot apply it: it would have to first determine which flow sys_id to write. Score **0**.

Note per §A2.1's combination paragraph: FIX-1 passes Case 2's address test (exactly one record, one named field) and Case 3 does not arise in a way that rescues it — passing a later case does not lift Case 1's bar, and reading only as far as the first case that yields a 1 is the error that paragraph exists to prevent.

**Gate.** `passes_gate = 1` iff `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`. Here 2 AND 0 → **0**. This is the §A2 case stated explicitly: a run can score 5/6 and fail, because the gate asks a narrower question than the rubric.
