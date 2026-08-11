# Row 11 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 0 |
| fix_usable_unedited | 0 |
| total | 4/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct
The seed spec's header table prints `Expected root-cause layer` = `data` (layer 5). The report states four root causes, so §A2.2 Case 2 applies first: evaluate against the primary — the entry the report ranks first, skipping any entry asserting no defect exists. RC-1 is ranked first and asserts a defect (empty routing table), so it is the subject. RC-1 declares a layer explicitly in a **Layer** row: `5 — Data`. Under §A2.2 Case 1, the declared value is scored directly against the expected layer. `5 — Data` matches `data` (layer 5) by both name and number. Score **2**. (RC-2/RC-3 declaring layer 3 and RC-4 layer 7 are secondaries and are neither credited nor charged.)

### fix_target_correct
Expected fix target area (header row): data seeding. The seed's *Expected diagnosis* section names the specific target: "the routing table holds zero rows. Fix target: data seeding, not the tool or the instructions" — i.e. seeding rows into the routing table. It also explicitly rules out the tool and the query as misses.

The report proposes four fixes. Per §A2.3, the column takes the highest value any single non-hedged proposed fix earns (with the 1 band restricted to the primary). Fix 1 is the primary and declares **Target type: Data**, **Target: Table `x_snc_tsbench_routing`**, with the operation "Insert at minimum one row with `category = Facilities` and `assignment_group = …`". Under §A2.3 Case 1 the declared target is scored: it falls in the data-seeding area and names the specific target the seed's *Expected diagnosis* names — the routing table, seeded with rows. That reaches the **2** band. Fixes 2–4 target tool schema and wiring (areas the seed marks as misses) but cannot lower the value already earned; the column takes the highest. Score **2**.

### evidence_cites_trace_and_config
§A1 applies in order. Case 1: a root cause is stated, so the column has a subject. Case 2: four root causes are stated, so the subject is the primary — RC-1 — and the column is evaluated against RC-1's own evidence alone; secondary entries' evidence does not count, and Case 5 forbids importing citations from the failure summary, the LAYERS SWEPT table, or the appendix unless RC-1's evidence refers to them explicitly (it does not).

RC-1's **Evidence** cell contains exactly two items:
1. `query_table` result — table `x_snc_tsbench_routing`, `verdict: genuinely_empty`, `unfiltered_row_count: 0`, read status `ok`.
2. "Tool call response in `sn_aia_tools_execution` sys_id `bf636bb22b2e0bd817a6ffbeee91bf3b`: `{"ok":true,"matched":false,"category":"Facilities","rules_in_table":0}`".

**Config/schema half:** item 1 cites `query_table`, which §A1 Case 4 enumerates as backing the config/schema half. The audit trail records a `query_table` call among the seven distinct tool names. Case 3 is satisfied — RC-1's statement names table `x_snc_tsbench_routing`, the same artifact the citation names. This half is satisfied.

**Trace half:** §A1 Case 4 is explicit and enumerated — "the **trace** half is backed by a recorded `agent_trace` call, **and by nothing else**." The question is whether RC-1 offers a trace citation at all. Item 2 cites a record in `sn_aia_tools_execution` by sys_id with its response payload. That is a citation of a runtime execution record, but it is not offered as an `agent_trace` result; the report's own LAYERS SWEPT table attributes `agent_trace` to layer 1 and attributes the RC-1 findings to `query_table` (layer 5). Even reading item 2 generously as a trace-half citation, Case 4 requires it be backed by a recorded call of the trace family. The audit trail does record an `agent_trace` call, so that backing exists.

The deciding test is therefore Case 3 applied to the trace half: a citation counts only if the root-cause statement it is offered under **names the artifact cited**. RC-1's Finding names the table `x_snc_tsbench_routing`, the schema, the row count, the `GlideAggregate COUNT` and `rules_in_table: 0`. It names no execution, no plan, no message stream, no `sn_aia_tools_execution` record — the trace artifact appears only inside the Evidence cell itself and nowhere in the statement it is offered under. Case 3's test is a comparison between the root-cause statement and the citation, and the statement never mentions the cited artifact. The trace half therefore does not count, and no other cited source of that half's type appears under RC-1. (The `agent_trace` citation in the LAYERS SWEPT row for layer 1 is elsewhere in the document; Case 5 rules that proximity is not a reference, and RC-1's evidence contains no pointer to it.)

With the trace half unsatisfied, the conjunction fails. Score **0**.

### fix_usable_unedited
§A's constraint does not bind — `fix_target_correct` is 2, not 0. §A2.1 Case 5 selects the subject: the proposed fix that addresses the defect the seed carries. That is Fix 1 (seed the routing table); Fixes 2–4 address other findings and are neither credited nor charged. Only one proposed fix addresses the seeded defect, so Fix 1 alone is evaluated, against Cases 1–4 as necessary conditions — passing one does not lift another's bar.

**Case 4 (target by kind):** Fix 1's target is `Table x_snc_tsbench_routing`, a named table, not a class. This case is satisfied.

**Case 2 (address):** the operation is an insert into one named table with two named fields (`category`, `assignment_group`). The record set is a new row rather than an existing record, and the fields it writes are named. This case is satisfied.

**Case 3 (incomplete edit):** Fix 1 states its operation in prose and supplies no code snippet, so by the case's own final sentence this case does not arise and Cases 1–2 govern.

**Case 1 (unfilled value slot):** this is where Fix 1 fails. The **Proposed** text is: "Insert at minimum one row with `category = Facilities` and `assignment_group = <the group that handles Facilities requests>`." The `assignment_group` value is left as an unfilled placeholder slot, written in angle brackets and described by kind rather than given. Case 1 requires BOTH that the target and operation be fully specified AND that the missing value be **not obtainable from the instance** by any of the seven diagnostic tools. An assignment group is a value the instance holds — `sys_user_group` is populated on any instance and is readable via `query_table`, one of the seven enumerated tools. The run made no such lookup: the audit trail's distinct tool set shows `query_table` used once, and the report attributes that call to `x_snc_tsbench_routing` (`unfiltered_row_count: 0`), not to any group table. So the value was obtainable and the run simply did not look it up — Case 1 condition 2 fails and the case scores **0**. The case's own gloss confirms the direction: "A value the instance does hold is diagnosis the run declined to perform."

Case 4's cross-reference reinforces this rather than rescuing it: "*A value named by kind is decided by Case 1, not here*" — `<the group that handles Facilities requests>` is precisely a value named by kind, routed to Case 1, where condition 2 fails.

The remainder of the Proposed text ("Add rows for every other category the agent is expected to handle") is a further unfilled slot of the same shape — neither the categories nor their groups are given — but Case 1 has already decided the column on the `assignment_group` slot alone.

The first case that fails decides the column, and reading only as far as the first case that yields a 1 is the error §A2.1 warns against. Score **0**.

**Gate:** `passes_gate = 1` iff `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`. Here 2 AND 0 → **0**. This is the 4/6-fails case §A2 explicitly anticipates.
