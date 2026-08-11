# Row 09 — scorer verdict

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

Expected value from the seed spec header table: `data_schema` (layer 4).

§A2.2 says apply Case 2 first. The report states two root causes (RC-1 and
RC-2), so Case 2 selects the primary: RC-1 is first in the ROOT CAUSES list and
RC-2 is explicitly marked "(secondary / cosmetic)". Neither entry asserts that no
defect exists, so no skipping applies. Subject = RC-1.

RC-1 declares a layer in a **Layer** row: `3 — Tool definitions / 4 — Data
schema`. That is a declared layer naming more than one layer. §A2.2 Case 1's
compound clause governs: such a declaration "is read on **the conjunct that names
the expected layer**, if one does, and scores **2**; ... The other conjuncts are
neither credited nor charged." Conjunct `4 — Data schema` names the expected
layer, so the column scores **2**, and the layer-3 conjunct is not charged.

Two things I deliberately did not do, per the rubric's own instructions. I did
not score the substance of the finding text (Case 1: "Do **not** score the
substance of the finding text"), though in fact the prose does describe the
seeded mechanism — `addQuery('category', …)` against a table with no `category`
column, matching nothing silently. And I did not read the seed's "A diagnosis
naming ... the tool script (layer 3) ... is a **miss**" line as an override: that
sentence describes a diagnosis naming layer 3 (or 5, or 2) *as the layer*, not a
compound that also names the expected layer, and the rubric's compound clause is
stated unconditionally and even records the compound as a known, unclosed
exposure. The seed spec sets the expected value; §A2.2 sets how a declaration is
read against it.

### fix_target_correct

§A2.3 Case 1: where a fix declares its target, score the declared value. The
report proposes two fixes:

- **Fix 1** — `Target type: Tool script`; `Target: sn_aia_tool · d7728c64… ·
  field script`; operation: replace `gr.addQuery('category', category);` with
  `gr.addQuery('type', category);`
- **Fix 2** — `Target type: Tool schema`; the tool's `description` field
  (documentation only).

Neither is marked alternative, hedged or optional, so both are in scope; Fix 1 is
the primary (first, and the actual repair).

§A2.3 Case 2 requires reading **two** places in the seed spec. The `Expected fix
target` header row reads: *"the **table schema** — add the `category` column to
`x_snc_tsbench_ticket`, **or repoint the tool at a column the dictionary
declares**. **Not** 'seed the table' — see Decoys."* The *Expected diagnosis*
section reads: *"Fix target: the table schema."*

This seed is one where the header row itself prints specific targets rather than
only an area, and it names **two** admissible remedies. Fix 1 is precisely the
second of them: it repoints the tool's filter from the non-existent `category`
onto `type`, a column the run confirmed the dictionary declares (`schema_lookup`
→ "`type` (String, max 40) present"; `query_table` → values `hardware`,
`software`). It names the record, the field and the literal replacement, so it
names a specific target the seed spec's expected-target row names, in that row's
own terms → **2**.

The 0 band does not reach it on either branch. The "explicitly excludes" branch
covers only "seed the table", which is not what Fix 1 does; and the "different
area" branch is contradicted by the expected-target row, which itself admits the
tool-repointing remedy as expected. The decoy the seed names (a fix target of
"seed the table", scoring 0) is not the fix proposed here.

Fix 2, a documentation edit to the tool description, would sit lower, but §A2.3
takes the highest value any single non-hedged fix earns, so Fix 1 governs.

### evidence_cites_trace_and_config

§A1 in order.

Case 1: the report does state a root cause, so the column has a subject.

Case 2: two root causes; primary is RC-1 (first-ranked, and RC-2 is labelled
secondary). Neither asserts "no defect exists". Subject = RC-1, evaluated alone;
RC-2's lack of citations is not charged.

Case 3 (connection): RC-1's root-cause statement names `sn_aia_tool` record
`d7728c6477db44a29c2ad0fed0df7419` field `script`, the call
`addQuery('category', category)`, the column `category` and the table
`x_snc_tsbench_ticket`. Its **Evidence — trace** row cites tool call
`d61d5fc72bea031017a6ffbeee91bff3` returning `{ok:true, category:'hardware',
count:0, tickets:[]}` — the execution of that same tool, and the zero result the
finding asserts. Its **Evidence — schema** row cites `schema_lookup` on
`x_snc_tsbench_ticket` showing `category` absent and `type` present — the same
table and column the root-cause statement names. Both halves name artifacts the
root-cause statement names.

Case 4 (backing in the audit trail): the trace half requires a recorded
`agent_trace` call — the trail's distinct tool names include `agent_trace`. The
config/schema half is backed by any of the other six — the trail records
`schema_lookup` and `query_table`, both of which RC-1 cites by name. Both halves
backed. No validator rejection is present in this packet.

Case 5 (co-location): all four evidence rows sit inside RC-1's own evidence
table, offered as evidence for RC-1 itself — not in the failure summary, the
sweep table or an appendix.

All tests pass → **1**.

### fix_usable_unedited

§A's constraint is checked first: `fix_target_correct` is 2, not 0, so it does
not bind.

§A2.1 Case 5 selects the subject: the proposed fix that addresses the seeded
defect. That is **Fix 1** (repointing the query column). Fix 2 is a description
/ documentation improvement aimed at future drift, not at the seeded defect, so
it is neither credited nor charged.

Cases 1–4 are then each necessary conditions on Fix 1:

- **Case 1 (unfilled value slot):** target and operation are fully specified —
  record `sn_aia_tool · d7728c6477db44a29c2ad0fed0df7419`, field `script`, and
  the exact substitution. No slot is left for the builder to fill; the needed
  value (`type`) was actually looked up on the instance, not deferred. Satisfied.
- **Case 2 (runtime record address):** the address resolves to exactly one record
  (a sys_id) and names the single field it changes (`script`). Translating that
  unique runtime address to its Fluent source is explicitly not an edit.
  Satisfied.
- **Case 3 (incomplete edit):** the fix hands over a literal replacement —
  Current `gr.addQuery('category', category);` → Proposed
  `gr.addQuery('type', category);`. Applying that text exactly as given performs
  the change the fix describes; nothing is characterised rather than written.
  Satisfied.
- **Case 4 (target by kind):** the target is named by record sys_id and field
  name, not by category. Satisfied.

It also addresses the defect the seed actually carries: the seed's expected fix
target admits repointing the tool at a dictionary-declared column, and `type` is
confirmed declared and carrying the value `hardware`. So the fix is not a
well-formed no-op. → **1**.

(The proposed line keeps the parameter name `category` while changing the queried
field to `type`; that is a naming cosmetic, not an edit the builder must make for
the change to work.)

### passes_gate

```
passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1
```

`root_cause_layer_correct` = 2 and `fix_usable_unedited` = 1, so
`passes_gate` = **1**. `fix_target_correct` and
`evidence_cites_trace_and_config` are not gate terms and did not enter the
computation. No §A3 void condition applies: the run reached a terminal state of
`completed` and produced a full report body, the seed is not seed 4 or seed 5,
and the seed met its qualification bar (execution completed without error and
reported zero hardware tickets while the table demonstrably held rows).

### ambiguity

`ambiguous` = **no**. Every column was determined by the packet's material.

The one column that took real work was `fix_target_correct`, because this seed's
`Expected fix target` header row prints specific remedies rather than only an
area (the rubric warns that four of five seeds print only an area, so this row's
extra content is the unusual case rather than a gap). But it is determinate, not
under-determined: the row names, in as many words, "repoint the tool at a column
the dictionary declares" as an expected fix target, and Fix 1 does exactly that
with the record, field and replacement text supplied. Similarly,
`root_cause_layer_correct` is fixed by §A2.2 Case 1's explicit compound clause
rather than left open by it. Effortful, but decided by rules and text already in
the packet.
