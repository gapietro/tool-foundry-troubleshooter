# Row 13 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 0 |
| fix_usable_unedited | 1 |
| total | 3/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct

The seed spec's header table prints the expected value as `tool_definition` (layer 3).

The report states four root causes (RC-1 … RC-4), so **§A2.2 Case 2 applies and is
applied first**: the column is evaluated against the report's primary, selected as
"(a) the entry the report itself labels primary or ranks first, else (b) the first
entry in the list, skipping … any entry that asserts no defect exists."

- The report labels no root cause "primary". RC-4 is labelled "(Supplementary)", which
  is not a primary designation for any other entry.
- The first entry in the ROOT CAUSES list is **RC-1 — No `category` column on the ticket
  table**. It asserts a defect (a missing column causing a fabricated category), so the
  skip clause does not remove it.
- Therefore the primary is RC-1.

**§A2.2 Case 1** then governs: RC-1 declares a layer in its attribute table —
**"Layer | 4 — Data schema"**. Where a layer is declared, "score the declared value …
score **2** on a match, **0** otherwise", and explicitly do not score the substance of
the finding text. Declared layer 4 ≠ expected layer 3 → **0**.

It is not a compound declaration (no "3 + 4" form), so the multi-conjunct clause does
not arise. Case 2's instruction — "Do **not** scan the list for an entry that happens to
carry the expected layer" — forbids reaching past RC-1 to RC-2, which does declare
"Layer | 3 — Tool definition" and describes exactly the seeded `raw_context_feed`
mechanism. RC-2's correctness is not creditable here; the column reads the primary alone.

Section 3's advance ruling (instruction bloat) never arises: this report does not name
instruction bloat as a root cause at all, and the column is decided on other grounds.

### fix_target_correct

The seed's `Expected fix target` row gives the **area**: "the **tool's return contract** —
bound and summarise what `read_ticket_context` returns (drop `raw_context_feed`, or cap
it and return named fields). **Not** the instruction, **not** the table." The *Expected
diagnosis* section names the **specific** target: "`read_ticket_context` returns 57,650
characters of unfiltered feed the task never consults. Fix target: the tool's return
contract."

The report proposes four fixes, so **§A2.3's multi-fix rule** applies: "the column takes
**the highest value any single non-hedged proposed fix earns** — skipping any entry the
report itself marks alternative, hedged, optional or follow-on hardening — with one
restriction: the 1 band is available only from the report's primary fix."

- FIX-4 is marked "(Optional)" → skipped.
- FIX-1 declares **Target type: Data (schema)** / add a column to `x_snc_tsbench_ticket`.
  That is the table, which the seed's expected-target row explicitly excludes ("**not**
  the table") → 0 under Case 2's third band.
- **FIX-2** declares **Target type: Tool schema (script)**, **Target:
  `sn_aia_tool[2465188619a2417682e91483d560c084]` — field `script`**, and proposes
  "Delete the loop and the `out.raw_context_feed` assignment entirely. Return only the
  fields the agent needs: `ok`, `error`, `short_description`, `priority` …". Under
  §A2.3 Case 1 the declared target is scored, and here the declared target and the fix
  body agree. This names the specific target the seed's *Expected diagnosis* section
  names, in that section's own terms — the return contract of `read_ticket_context`,
  with `raw_context_feed` dropped and named fields returned. That is the **2** band.
- FIX-3 (mandatory input) sits in the tool-schema area but is not the seeded target;
  it cannot lower the column.

The 2 band is available from a non-primary fix (FIX-2 is the report's second fix): the
rubric states expressly that "A later fix can lift the column to **2** by naming the
specific target". Only the 1 band is restricted to the primary fix, and 1 is not the
value in play. → **2**.

### evidence_cites_trace_and_config

**§A1 Case 1** does not apply — root causes are stated. **§A1 Case 2** applies (more than
one root cause) and selects the same subject by the same rule as above: the primary is
**RC-1**. Case 2 states this selection "does not award the point" and that the report is
not to be evaluated as a whole — "a report whose primary does not [carry both citations]
scores 0 though a secondary does."

RC-1's own Evidence row cites: `schema_lookup` on `x_snc_tsbench_ticket` (artifact
`436a2f83…`), and `query_table` field_warnings on record `e6dcdf07…`. Under **Case 4**'s
enumerated families, both are **config/schema** half citations (`schema_lookup`,
`query_table`), and both are backed — section 5's audit trail records `schema_lookup`
and `query_table (x2)`. The config/schema half is satisfied.

The **trace** half is "backed by a recorded `agent_trace` call, and by nothing else",
and under **Case 5** it must be "offered as evidence **for the root cause identified
under Case 2**". RC-1's evidence offers no `agent_trace` source at all. An `agent_trace`
call is recorded in the audit trail and appears elsewhere in the report — the LAYERS
SWEPT table's row 1, and RC-2's evidence (artifact `de1aefcf…`) — but Case 5 rules that
"A trace or config/schema source appearing elsewhere — a failure summary, a sweep table,
an appendix — does not count, **unless** that root cause's own evidence refers to it
explicitly. Proximity in the document is not a reference; a pointer is." RC-1's evidence
contains no such pointer.

The conjunction therefore fails on the trace half → **0**.

### fix_usable_unedited

**§A's constraint is checked first**: `fix_target_correct` is 2, not 0, so it does not
bind and the cases below arise.

**§A2.1 Case 5** selects the subject: "the proposed fix that addresses the defect the
seed carries". The seeded defect is `read_ticket_context`'s unbounded return, so the
subject is **FIX-2** alone. FIX-1 (add a `category` column), FIX-3 (mandatory input) and
FIX-4 (trigger wiring) address other findings and are "neither credited nor charged".

Cases 1–4 are then each necessary conditions on FIX-2:

- **Case 1 (unfilled value slot)** — target and operation are fully specified: record
  `sn_aia_tool[2465188619a2417682e91483d560c084]`, field `script`, operation "Delete the
  loop and the `out.raw_context_feed` assignment entirely", plus the replacement return
  set enumerated by field name (`ok`, `error`, `short_description`, `priority`). No value
  is left for the builder to look up. Satisfied.
- **Case 2 (runtime record rather than Fluent source)** — the address resolves to exactly
  one record (a sys_id-qualified `sn_aia_tool` row) and names the single field it changes
  (`script`). The rubric states expressly that translating a unique runtime address into
  its Fluent source is not an edit to the fix. Satisfied.
- **Case 3 (incomplete edit)** — FIX-2 hands over no code snippet, script fragment or
  literal replacement; it states its operation in prose. The rubric: "Where the fix states
  its operation in prose and supplies no snippet, this case does not arise and Cases 1–2
  govern." Does not arise.
- **Case 4 (target named by kind)** — the target is named by record sys_id and field, not
  by category. Satisfied.

One wrinkle considered and resolved: the Proposed text adds "and (after FIX-1) `category`"
to the return set. That clause is explicitly conditional on a separate fix, and the
operation the seeded defect requires — deleting the loop and the `raw_context_feed`
assignment, returning named fields — is complete and applicable without it. It leaves no
value slot unfilled and no edit uncharacterised. → **1**.

### passes_gate

`passes_gate = 1` iff `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`.
Here `root_cause_layer_correct` = 0, so the conjunction fails → **0**. The 2 on
`fix_target_correct` and the 1 on `fix_usable_unedited` are diagnostic detail and are not
gate terms; §A2 notes that a run can score 4/6 and fail, and this run scores 3/6 and fails.
This is the intended shape of a run whose primary root cause landed on another seed's
layer while a secondary entry and its fix hit the seeded target.

### ambiguity

**No column is under-determined.** The two potentially difficult calls were both settled
mechanically by clauses already in the packet rather than by judgement:

- The multi-root-cause report is resolved by §A2.2 Case 2 / §A1 Case 2's ordered primary
  rule (no entry labelled primary, no entry asserting there is no defect, so the
  first-listed RC-1 is the subject), and by §A2.2 Case 1's instruction to score the
  declared `Layer` row rather than the finding's substance.
- The multi-fix report is resolved by §A2.3's highest-value rule with its primary-only
  restriction on the 1 band, and by §A2.1 Case 5's separate subject rule — the packet
  states expressly that the two columns may select different fixes and that this is
  design, not conflict.

Section 3's advance ruling did not arise (no instruction-bloat root cause is claimed),
and section 6 records no run-specific notes. No §A3 void condition applies: the run
reached terminal state **completed** and produced a full report body.
