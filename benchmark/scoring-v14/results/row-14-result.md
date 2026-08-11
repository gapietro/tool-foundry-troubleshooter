# Row 14 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 1 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| total | 2/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct

The seed spec's header table prints `Expected root-cause layer` = `tool_definition` (layer 3).

The report states exactly one root cause, so §A2.2 Case 2 does not arise and no primary
selection is needed. That single entry carries an explicit declared layer field:
`"layer": "1"`. §A2.2 Case 1 governs: *"Where the report declares a layer — a `layer` field
… **score the declared value.** Compare it against the seed spec's expected layer and score
**2** on a match, **0** otherwise. Do **not** score the substance of the finding text."*

Declared layer 1 ≠ expected layer 3 → **0**. It is not a compound declaration (a single
`"1"`), so the multi-conjunct clause does not apply.

For completeness, the substance would not have rescued it and is not being scored: the
finding — *"Priority field was not populated in the ticket record despite being retrieved"* —
is precisely the seed's engineered decoy (*"The ticket's `priority` is empty on every
pre-existing bench ticket … A diagnosis seizing on the empty priority … scores **0** on
`root_cause_layer_correct`"*). The §3 advance ruling on the spurious `instruction_bloat`
flag never arises here: the report does not name instruction bloat at all, and the column is
decided against the report on other grounds, exactly as that ruling's *Scope* paragraph
anticipates.

### fix_target_correct

The report proposes one fix, which declares its target explicitly:
`"target_type": "tool schema"`, `"target": "read_ticket_context tool's input schema"`.
§A2.3 Case 1: *"Where a proposed fix declares its target — a `target_type` / `target` field
… score the declared value."*

§A2.3 Case 2 requires reading two places in the seed spec:

- The `Expected fix target` header row gives the **area**: *"the **tool's return contract** —
  bound and summarise what `read_ticket_context` returns (drop `raw_context_feed`, or cap it
  and return named fields). **Not** the instruction, **not** the table."* Of §A's five areas
  (tool schema / instruction text / data seeding / capability mapping / activation) that is
  the **tool schema** area.
- The *Expected diagnosis* section names the **specific** target: *"Fix target: the tool's
  return contract."*

The declared target sits in the tool-schema area — it is literally `target_type: "tool
schema"`, and it names the seeded tool `read_ticket_context` — so the 1/0 boundary is not
crossed downward. But it does not name the specific target: the fix is to **add** a
`priority` field so more is returned, the exact opposite of bounding/summarising the return
and dropping `raw_context_feed`. It therefore does not reach the 2 band.

The 0-by-exclusion clause does not fire. That clause is *"a target the seed spec's
expected-target row **explicitly excludes**"*, and this seed's row excludes only the
instruction and the table. The rubric's illustration of the clause happens to use the phrase
"Not the tool input schema", but that is the rubric's generic example of the clause's shape,
not this seed's text — seed 07 rules out no schema reading in as many words.

The `target` field ("input schema") and the `current`/`proposed` fields ("output schema")
disagree with each other, but the disagreement does not move the band: both are the tool's
schema area, and neither is the return contract as the *Expected diagnosis* section states
it. The value is **1** on either reading, so this is a determinate 1, not an ambiguity.

Only one fix is proposed, so the several-fixes clause (highest value from any non-hedged
fix, 1 band available only from the primary) is satisfied trivially — this is the primary.

### evidence_cites_trace_and_config

Applying §A1's cases in order:

- **Case 1** — a root cause is stated (not `inconclusive`, not "no defect"), so the column
  has a subject.
- **Case 2** — exactly one root-cause entry, so the primary is that entry; no selection
  needed.
- **Case 3** — the root-cause statement is `component: "tool_call response"`, `finding:
  "Priority field was not populated in the ticket record despite being retrieved"`. The
  trace citation (*"Tool call response included short_description but not priority"*) names
  the tool call response and the `priority` field — both named in the root-cause statement.
  The config/schema citation (*"schema_lookup confirmed priority exists on incident table"*)
  names the `priority` field, which the root-cause statement also names. Case 3 accepts a
  match on *"the same table, record, **field**, script, artifact or configuration object"*,
  so both citations are connected to the cause they are offered under. Note Case 3's own
  gloss: the test is not whether the citation is *good* evidence, only whether it is evidence
  for this claim.
- **Case 4** — the halves are enumerated, not judged. The trace half requires a recorded
  `agent_trace` call; section 5 records *"Distinct tool names: 3 — `agent_trace`,
  `read_artifact`, `schema_lookup`"*, so it is backed. The config/schema half is backed by any
  of the other six; `schema_lookup` is one of them and is recorded. Both backed. No validator
  rejection is carried in this packet.
- **Case 5** — both citations sit inside the same root cause's own `evidence` array, so they
  are co-located on the Case 2 subject; neither is imported from a failure summary, sweep
  table or appendix.

Both halves satisfied → **1**. (Per §A1's closing note, this column is not a gate term; it
records that the run did look at both a trace and a schema source, even though what it
concluded from them was wrong.)

### fix_usable_unedited

**0**, on the column's own second clause and independently on §A2.1 Case 2.

§A's constraint (`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0) does
**not** bind here, since `fix_target_correct` is 1. So the cases are reached.

The column definition itself requires that the fix *"addresses the defect the seed actually
carries"*, because *"a well-formed fix aimed at the wrong target is a no-op, not a usable
fix."* The seeded defect is `read_ticket_context` returning 57,650 characters of
`raw_context_feed` (58,436-char whole response against a 20,000-char threshold). The proposed
fix — *"Include priority field in output schema to ensure it's returned"* — adds a field to a
return that is already nearly 3× the bloat threshold. Applying it would not reduce the
oversized return by one character; it is aimed at the seed's documented decoy (the empty
`priority`, which is seed 01's defect). §A2.1 Case 5 selects *"the proposed fix that addresses
the defect the seed carries"*; no proposed fix does, and the column is 0.

The same value follows independently from §A2.1 Case 2. The fix states its operation in prose
and supplies no snippet, so Case 3 does not arise and Cases 1–2 govern. Case 2 requires the
address to resolve to **exactly one record** and to **name every field it changes**, scoring 0
*"if a scorer would have to work out which record or which field the fix means."* Here
`target` says *"read_ticket_context tool's **input** schema"* while `current` and `proposed`
both say *"**output** schema"* — the fix does not settle which of the two schemas the builder
is to edit. Under §A2.1's combination rule (*"the first case that fails decides the column,
and passing a later case does not lift an earlier one's bar"*), that alone is 0.

### passes_gate

`passes_gate = 1` iff `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`.
Here `root_cause_layer_correct` = 0 and `fix_usable_unedited` = 0, so both terms fail and
`passes_gate` = **0**. `fix_target_correct` = 1 and `evidence_cites_trace_and_config` = 1 are
diagnostic detail and are not in the expression — this is the /6-vs-gate divergence §A2 says
not to smooth over: 2/6 with a fail is coherent.

No void condition applies. The run reached terminal state **complete** with a full report
body (§A3's run-state void requires a platform-terminated execution that produced no report),
section 6 records no run-specific notes, and section 5 records no harness HOLDs and a
completed run. So this is a real scored 0-gate measurement, not a void.

### ambiguity

**No.** Every column was determined by the packet's own material:

- `root_cause_layer_correct` — a single root cause carrying an explicit `"layer": "1"` field,
  read against the seed header's expected layer 3 by §A2.2 Case 1's declared-value rule. No
  primary selection, no compound, no unlabelled-prose fallback.
- `fix_target_correct` — a single fix with an explicit `target_type`/`target`, read against
  both the seed's `Expected fix target` area row and its *Expected diagnosis* specific
  target. The internal input/output-schema inconsistency in the fix text is real, but it
  yields the same band (1) under either reading, so it does not leave the column
  under-determined.
- `evidence_cites_trace_and_config` — one root cause, two citations inside its own evidence
  array, and section 5's distinct-tool list mechanically settles Case 4 for both halves.
- `fix_usable_unedited` — settled twice over, by the column's own "addresses the seeded
  defect" clause and by §A2.1 Case 2's address test.

The judgement that took the most care was `fix_target_correct` (whether the seed's "Not the
instruction, not the table" exclusions reach a tool-input-schema fix — they do not, so the
band is 1 rather than 0). Per section 7 that is effort, not under-determination, and is not
flagged.
