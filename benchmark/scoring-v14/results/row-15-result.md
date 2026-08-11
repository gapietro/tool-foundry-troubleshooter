# Row 15 — scorer verdict

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

The seed spec's header table prints the expected value as `tool_definition` (layer 3).

The report states four root causes (RC-1 … RC-4), so **§A2.2 Case 2 applies first** and
selects the subject. The rule is (a) the entry the report labels primary or ranks first,
else (b) the first entry in the list, skipping any entry asserting no defect exists. The
report labels no entry "primary"; RC-1 is ranked first and asserts a defect ("Non-mandatory
tool input allows silent failure", Confidence: CONFIRMED). **The subject is RC-1.** Case 2
expressly forbids scanning the list for an entry carrying the expected layer, so RC-4 (the
entry that actually describes the seeded output-bloat mechanism) is not consulted here.

**§A2.2 Case 1** then governs: RC-1 declares a layer in a **Layer** row — `Layer: 3 – Tool
definitions`. Where a layer is declared, score the declared value against the seed's
expected layer. Declared 3 = expected 3, so the column is **2**. Case 1 also states
explicitly that the substance of the finding text is not scored: "a root cause filed under
the expected layer whose prose is thin, hedged or wrong about the mechanism scores 2." RC-1
describes a mandatory-flag defect rather than the seeded unbounded return, and under this
clause that does not move the column. The stated cost of the clause is being paid in the
opposite direction here, but the clause is unambiguous.

Two seed-level traps checked and neither fires against the primary:

- The seed's **priority decoy** ("a diagnosis seizing on the empty priority … scores 0 on
  `root_cause_layer_correct`") lands on RC-2 (Layer 5 – Data), which is not the primary and
  which Case 2 forbids reaching into.
- The **§3 advance ruling** charges a report that names *instruction bloat* as its primary
  root cause. The primary here is RC-1, a tool-definition finding; no entry in the report
  names instruction bloat at all, so the ruling never arises.

### fix_target_correct

The seed spec's `Expected fix target` row gives the **area** — the tool's return contract —
and the *Expected diagnosis* section gives the **specific** target: bound/summarise what
`read_ticket_context` returns, dropping `raw_context_feed` or capping it and returning
named fields; explicitly **not** the instruction and **not** the table.

The report proposes four fixes, so §A2.3's multi-fix rule applies: the column takes **the
highest value any single non-hedged proposed fix earns**, with the 1 band restricted to the
primary fix. None of the four is marked alternative, hedged, optional or follow-on
hardening, so all four are eligible for the 2 band.

**FIX-4** declares `Target type: Tool schema (script)` and `Target: sn_aia_tool[2465…c084],
field script — remove the raw_context_feed generation block`. Per §A2.3 Case 1 the declared
target is what is scored, and it is scored on the artifact its operation writes to: the
tool's script, i.e. the tool's return contract. Its `Proposed` text is the seed's specific
target in the seed's own terms — remove the `lines` array, the `for` loop and the
`out.raw_context_feed = lines.join(NL);` statement, and "Return only the named fields the
agent needs: `ok`, `error`, `short_description`, `priority`". That is "drop
`raw_context_feed` … and return named fields" verbatim in substance, so FIX-4 earns the
**2** band under §A2.3 Case 2.

FIX-2 (data seeding on the ticket) and FIX-3 (adding a `category` column to the table) sit
in areas the seed excludes, and FIX-1 is in the tool-schema area without naming the seeded
target; none of them lowers the column, because the rule takes the highest value earned.
Column = **2**.

### evidence_cites_trace_and_config

The column asks whether **the root cause** cites both the execution trace and at least one
config/schema source. §A1's ordering: Case 1 (a root cause exists — four do), then Case 2
(more than one root cause → evaluate against the primary). By the same selection rule used
above, **the subject is RC-1**. §A1 Case 2 is emphatic that the column is not evaluated
against the report as a whole and that a report whose primary does not comply scores 0
though a secondary does.

RC-1's own **Evidence** line reads: "agent_config artifact `365c278f…`, tools section,
binding `b1b830fa…`, inputs array: `{"name":"ticket","mandatory":false}`. Corroborated by
tool script lines 3–6 (id guard)."

- **Config/schema half — satisfied.** The citation is `agent_config`, which §A1 Case 4
  enumerates as backing the config half, and the audit trail in section 5 records an
  `agent_config` call. Case 3 is met as well: RC-1's root-cause statement names the binding
  `sn_aia_agent_tool_m2m[b1b830fa…]`, the tool record and `input_schema[ticket].mandatory`,
  and the citation names those same artifacts. The corroborating "tool script lines 3–6" is
  likewise config material.
- **Trace half — not satisfied.** RC-1's evidence cites no execution trace: no `agent_trace`
  call, no trace artifact, nothing of that family. The run plainly *made* an `agent_trace`
  call (section 5 records one, and RC-2 and RC-4 cite trace artifact `c22ceb0f…`), but §A1
  **Case 5** rules that out: both halves must be offered as evidence for the root cause
  selected under Case 2, and a trace source appearing elsewhere — a failure summary, a sweep
  table, another entry — does not count "unless that root cause's own evidence refers to it
  explicitly. Proximity in the document is not a reference; a pointer is." RC-1's evidence
  contains no such pointer.

The conjunction therefore fails on the trace half, and no other source cited under RC-1 is
of that half's type. Column = **0**.

### fix_usable_unedited

**§A's constraint checked first:** `fix_target_correct` is 2, not 0, so the constraint does
not bind and the cases arise normally.

**§A2.1 Case 5 selects the subject.** The column is evaluated against the proposed fix that
addresses the defect the seed carries, and that one alone. The seeded defect is the
unbounded tool return; **FIX-4** is the only proposed fix addressing it. FIX-1, FIX-2 and
FIX-3 are aimed at other findings and are, in Case 5's words, "neither credited nor
charged" — so FIX-2's `Proposed` value ("Set an appropriate integer priority value") and
FIX-3's schema addition do not pull the column down.

Cases 1–4 are then each necessary conditions on FIX-4, and all four are satisfied:

- **Case 1 (unfilled value slot).** Target and operation are fully specified: the record
  (`sn_aia_tool[2465188619a2417682e91483d560c084]`), the field (`script`), and the operation
  (delete the `lines` array, the `for` loop and the `out.raw_context_feed = lines.join(NL);`
  statement; return `ok`, `error`, `short_description`, `priority`). There is no value slot
  left for the builder to fill and therefore nothing the run declined to look up.
- **Case 2 (runtime record address).** The fix addresses a runtime record rather than the
  Fluent source, so this case applies: the address must resolve to exactly one record and
  name every field it changes. It resolves to one `sn_aia_tool` sys_id and names one field,
  `script`. Case 2 states that translating a unique runtime address into its Fluent source is
  not an edit to the fix, so the SDK-owns-creation convention does not cost the point.
- **Case 3 (incomplete edit).** FIX-4 hands over no code snippet or literal replacement; it
  states its operation in prose, naming the exact identifiers to remove and the exact field
  list to return. Case 3's closing sentence covers this directly: "Where the fix states its
  operation in prose and supplies no snippet, this case does not arise and Cases 1–2
  govern." The parenthetical "(and `category` once FIX-3 is applied)" is a conditional
  addition to an already-complete field list, not a slot the builder must fill to apply
  FIX-4.
- **Case 4 (target named by kind).** The target is named by sys_id, by field, and by the
  specific block within it — not by category. Case 4 does not fire.

Column = **1**.

### passes_gate

`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here 2 and 1 respectively, so **`passes_gate` = 1**. `evidence_cites_trace_and_config` = 0
and `fix_target_correct` = 2 are not gate terms and do not enter the expression. The /6
total is 5; §A2 notes that totals and gate verdicts are deliberately not in lockstep.

### ambiguity

**`ambiguous` = no.** Every column was determined by material inside the packet without
guessing:

- `root_cause_layer_correct` — the report declares a **Layer** row on every root cause and
  ranks RC-1 first, so §A2.2 Case 2 (subject selection) and Case 1 (score the declared
  value) both resolve mechanically against the seed header's `tool_definition` (layer 3).
- `fix_target_correct` — FIX-4 carries an explicit `Target type` and `Target`, and its
  `Proposed` text names the specific target the seed's *Expected diagnosis* section names,
  so §A2.3's highest-value rule resolves to 2 without weighing anything.
- `evidence_cites_trace_and_config` — RC-1's Evidence line is quoted in full in the packet
  and contains no trace citation; §A1 Case 5 settles that citations elsewhere in the report
  do not travel. Section 5's audit trail was consulted only for Case 4 and confirms the
  config half's backing.
- `fix_usable_unedited` — FIX-4's target, field, deleted elements and resulting return
  contract are all printed in the packet, and §A2.1 Cases 1–5 each land on a stated fact.

The judgement was effortful in two places — the primary-selection rule sends the layer
column to an entry that is not the seeded mechanism, and the evidence column fails on a
trace call the run demonstrably made — but in both places the rubric states the answer
explicitly rather than leaving it open, so neither is an ambiguity flag.
