# Scoring packet — Row 13

**Seed:** 04 · **Harness arm:** native (Agent Doctor, `servicenow_aia_execute`) · **Run:** 1

This packet is self-contained. It contains the scoring rubric, this seed's
specification, any ruling made on a scoring column before this pass ran, this
run's full report, and this run's audit-trail measurements — nothing else.
Score this row using only the content below.

---

## 1. Scoring rubric

Section 1 is reproduced from this project's scoring template; section 2 is reproduced from
this seed's specification. **One deliberate change, applied to both:** repository file paths
have been replaced with plain-language descriptions of what they point at, because they are
navigable pointers to material a blind scorer must not read. The redaction is **mechanical and
touches paths only** — no rule, band, threshold, points value, measurement, setup step or
scoring note has been altered, added or removed, and no sentence has lost its meaning. This
rubric section is byte-identical in every packet.

## A. The 6-point rubric

| Column | Points | What it scores |
|---|---|---|
| `root_cause_layer_correct` | 0 or 2 | Diagnosis names the seed's expected root-cause layer (see the seed's own spec file for the expected value). See **§A2.2** for the two cases this definition does not otherwise determine — a declared layer contradicted by the finding text, and a report stating several root causes |
| `fix_target_correct` | 0, 1 or 2 | Diagnosis names the correct fix target (tool schema / instruction text / data seeding / capability mapping / activation). **1 = partial**: the right area, without the specific target. See **§A2.3** for the two cases this definition does not otherwise determine — a declared target contradicted by the fix body, and where the 1/2/0 boundaries fall |
| `evidence_cites_trace_and_config` | 0 or 1 | Root cause cites BOTH the execution trace AND at least one config/schema source — the evidence rule from the diagnostic agent's own instructions. See **§A1** for the five cases this definition does not otherwise determine — a report with no root cause, a report with several, a citation unconnected to the cause it supports, a citation no tool call backs, and citations split across the report |
| `fix_usable_unedited` | 0 or 1 | The Fix Report's proposed fix could be applied by the builder AI as written, with no manual editing first — **and it addresses the defect the seed actually carries.** A well-formed fix aimed at the wrong target is a no-op, not a usable fix, so **`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0.** See the note under the gate rule for why this constraint lives here rather than in the gate expression, and **§A2.1** for the five cases this definition does not otherwise determine — an unfilled value slot, a fix that addresses a runtime record, an incomplete edit, a target named by kind rather than by name, and a report proposing several fixes |

**Total: 6 points per run.**

**Why `fix_target_correct` has a partial band.** It was 0-or-2, while seed 5's
specification instructs the scorer to award *partial* credit for naming "inactive"
without naming which of the two activation gates is off — an instruction the scale
could not express, leaving the scorer to round arbitrarily in either direction. The
1 band resolves it.

> **Superseded 2026-08-10, issue #164.** This note used to continue: *"Seed 5 is
> the only seed that currently defines a partial case; for the others, 1 is
> available but must be justified in `notes` if used."* That sentence made the
> band available without locating either boundary. **§A2.3 Case 2 now fixes both
> boundaries for every seed**, and a `notes` justification is no longer what makes
> the band available. The seed-5 case above is now one instance of that general
> rule rather than the only defined one.

## A1. `evidence_cites_trace_and_config` — five cases the column definition does not otherwise determine

*Added 2026-08-10, issue #159. The rationale is in the project's decision
record.* The column reads *"Root cause cites BOTH the execution trace AND at
least one config/schema source."* Five shapes of report leave that sentence
without an answer. Each case below is decided by the report text plus the audit
trail already in this packet. **None asks the scorer to weigh anything.**

**Apply them in order.** Case 1 asks whether the column has a subject at all;
Case 2 fixes which root cause is the subject; Cases 3–5 then ask, of that one
root cause, whether a given citation counts. **Cases 1 and 2 settle the subject
and nothing revisits it. Only Cases 3–5 award the point** — a scorer who reaches
a value at Case 1 or Case 2 and stops has skipped the tests that do the work.

**Case 1 — the report states no root cause.** If the report offers nothing as a
cause — an `inconclusive` terminal, an empty root-cause list, a summary
asserting there is no defect — score **0**. The column is written about a root
cause; with none stated there is nothing for the predicate to be true of, and an
evidence list attached to a non-diagnosis is not a citation for a diagnosis.
Score 0 rather than leaving the cell empty: the column contributes to the /6 and
a blank is not a value.

**Case 2 — the report states more than one root cause.** Evaluate the column
**against one root cause: the report's primary.** The primary is, in this order,
(a) the entry the report itself labels primary or ranks first, else (b) the first
entry in the list — **skipping, in either branch, any entry that asserts no
defect exists.** Such an entry is a non-diagnosis wherever it sits in the list,
and Case 1's reasoning applies to it individually: there is nothing for the
predicate to be true of. If *every* entry is one, the report has stated no root
cause and Case 1 governs — score **0**.

This case selects the subject; **it does not award the point.** Whether the
selected entry "carries" both citations is decided by Cases 3–5, not by their
appearance in the text. Do **not** evaluate the report as a whole, and do **not**
require every entry to comply: a report whose primary complies scores 1 though a
secondary does not, and a report whose primary does not scores 0 though a
secondary does.

*The distinction, stated so it is not re-derived: no column in this rubric scores
extra or hedged root causes, and a report that enumerates alternates alongside its
diagnosis is not thereby less grounded. What the column asks is whether **the
diagnosis** is evidenced, and the diagnosis is the primary.*

**Case 3 — the cited source is not connected to the cause it supports.** A
citation counts toward the conjunction only if the root-cause statement it is
offered under **names the artifact cited** — the same table, record, field,
script, artifact or configuration object. A citation naming something the
root-cause statement never mentions does not count, and the column scores **0**
unless some other cited source of that half's type does. This test applies to
both halves, trace and config/schema alike.

*Why the reason a call was made is deliberately not part of the test: a scorer is
never asked to establish why a tool was invoked, only what the report's own words
tie together. A call made for some unrelated purpose that nonetheless names an
artifact the root cause names **counts**; a call made in perfect good faith that
names nothing the root cause names **does not**. The test is a comparison between
two passages of the report the scorer already has open. It does not ask whether
the citation is good evidence — only whether it is evidence for **this** claim.*

**Case 4 — no call in the audit trail backs the citation.** A citation counts
only if this packet's audit trail records a call of the corresponding tool
family, and the two families are **enumerated rather than judged**:

- the **trace** half is backed by a recorded `agent_trace` call, and by nothing else;
- the **config/schema** half is backed by a recorded call to any of the other six —
  `agent_config`, `schema_lookup`, `query_table`, `genai_log`, `log_analysis`,
  `read_artifact`.

Where the trail records no call of the relevant family, that half is not
satisfied and the column scores **0** — unless some other cited source of that
half's type is backed, exactly as in Case 3. Where the packet carries a validator
rejection naming a citation unsupported, treat it as a pointer to the trail,
**not** as the decision: the trail decides, the validator does not. A report may
not cite its way to this column with a call it never made.

*The families are listed, and deliberately coarse, so that no scorer has to ask
which tool a given citation "really" came from. That question has no mechanical
answer — one config claim can be reached by four of the six — and the column does
not need one: it asks whether the run looked at configuration at all, not which
door it used.*

**Case 5 — the two citations are not co-located.** Both halves must be offered
as evidence **for the root cause identified under Case 2**. A trace or
config/schema source appearing elsewhere — a failure summary, a sweep table, an
appendix — does not count, **unless** that root cause's own evidence refers to
it explicitly. Proximity in the document is not a reference; a pointer is.

**This column is not a gate term** (see §A2), so a wrong value here moves the /6
and never `passes_gate`. Score it with the same care regardless: it is the column
that explains *why* a run landed where it did, and a pass that cannot say that
has measured a number and learned nothing.

## A2. `passes_gate` — the column the gate actually consumes

The rubric scores each run **out of 6**. The gate counts **runs**:
*"≥ 8/10 runs with correct root cause + usable fixes."*
Nothing connected the two, so two different 4/6 runs could be opposite verdicts —
correct cause with an unusable fix, versus wrong cause with a usable fix and
cited evidence — and whoever writes the decision record would have invented
the aggregation rule on the spot, on the most expensive decision in the project.

**The rule, derived from the gate's own wording.** "Correct root cause + usable
fixes" names exactly two of the four rubric columns, so:

```
passes_gate = 1  if and only if  root_cause_layer_correct == 2
                                 AND fix_usable_unedited == 1
              0  otherwise
```

Nothing else feeds it. `evidence_cites_trace_and_config` and
`fix_target_correct` are **not** in the gate expression — they are diagnostic
detail that explains *why* a run passed or failed and must still be filled in,
but a run does not pass by accumulating them. A run can score 3/6 and pass; a run
can score 4/6 and fail. That is not an inconsistency to be smoothed over in
the scored-pass write-up — it is the gate asking a narrower question than the rubric.

**Why `fix_target_correct` still constrains the gate indirectly, and why that is
not a third term** (added 2026-08-01, PR #33 review round 2). Excluding
`fix_target_correct` from the expression opened a hole big enough to swallow the
R-22 decoy. Seed 4 carries an empty `connection` deliberately, as a normal state
dressed as a defect; a run that falls for it names the right **layer**
(`genai_stack` → `root_cause_layer_correct` = 2) and proposes "bind a connection
alias" — a fix that is perfectly well-formed and fixes **nothing**, because the
real break is a dangling `api`. Under a purely formal reading of "applied as
written", that run scored `fix_usable_unedited` = 1 and **passed the gate**,
making the decoy's `fix_target_correct` = 0 inert. A decoy with no scoring
consequence is not a decoy.

The fix is in the column definition, not the expression: a fix aimed at the wrong
target is not usable, so `fix_usable_unedited` = 0 whenever
`fix_target_correct` = 0. The gate keeps the two-term shape the Task 12 wording
actually specifies — *"correct root cause + usable fixes"* — and "usable" now
means what the word means. **A scorer who marks a decoy run 2 / 0 / 1 has
mis-scored it**; the correct row is 2 / 0 / 0, `passes_gate` = 0.

**The gate verdict** is `sum(passes_gate) / <number of valid runs>`, read against
the Task 12 gate table. Record the sum explicitly in the decision record; do not
re-derive it from the /6 totals.

### A2.1 Five cases the column definition does not otherwise determine

*Cases 1–2 added 2026-08-07, issue #139, after this column was found
under-determined on the majority of the rows it was applied to; Cases 3–5 added
2026-08-10, issue #159, for the same reason. The rationale is in the project's
decision record.* Because `fix_usable_unedited` is one of §A2's two gate terms,
an under-determined reading of it is not a rounding error — it changes the
verdict. Every case below is decided by the seed spec plus the fix text.
**None asks the scorer to weigh anything.**

**How they combine, and this is not the same as §A1's ordering.** §A's constraint
is checked first; then Case 5 selects *which* proposed fix is under evaluation;
then **Cases 1–4 are each necessary conditions on that fix, not a cascade.**
Score 1 only if every case that arises is satisfied — the first case that fails
decides the column, and passing a later case does not lift an earlier one's bar.
A fix can name exactly one record and every field it changes (Case 2) and still
score 0 because it leaves an obtainable value unfilled (Case 1) or because the
snippet it supplies does not perform the change (Case 3). **Reading only as far
as the first case that yields a 1 is the specific error this paragraph exists to
prevent.**

**Case 1 — the fix leaves a value slot unfilled.** Score `fix_usable_unedited`
= **1** only if BOTH hold:

1. the target and the operation are fully specified — the table or record, the
   field, and what to do to it; **and**
2. the missing value is **not obtainable from the instance** by any of the seven
   diagnostic tools (`agent_trace`, `agent_config`, `schema_lookup`,
   `query_table`, `genai_log`, `log_analysis`, `read_artifact`).

If the value **was** obtainable and the run simply **did not look it up**, score
**0**. Supplying a discovery procedure in place of the value does not change
this, and a procedure whose steps are UI actions rather than tool calls does not
make a value unobtainable.

*The distinction, stated so it is not re-derived: a value the instance does not
hold — an assignment group for a table that is empty by design — is the
builder's to choose, and demanding it would reward fabrication. A value the
instance does hold is diagnosis the run declined to perform.*

**Case 2 — the fix addresses a runtime record rather than the Fluent source.**
Score **1** if the address resolves to **exactly one record** and
**names every field it changes**. Score **0** if a scorer would have to work out
which record or which field the fix means. The builder AI is this column's stated
consumer, and SDK-owns-creation is a convention of this project rather than a
property of the diagnosis, so translating a unique runtime address into its
Fluent source is not an edit to the fix.

**Case 3 — the fix names the operation but the edit is incomplete.** Where the
fix hands over a code snippet, a script fragment or a literal replacement, score
**1** only if applying that text exactly as given produces the change the fix
describes. Score **0** if the builder must supply a line, a statement or a
substitution the fix *describes* but does not *write* — a snippet that computes a
corrected value and never writes it, a "replace this call" whose replacement is
characterised rather than given, an edit whose surrounding context is quoted as
current but never returned as amended. Where the fix states its operation in prose
and supplies no snippet, this case does not arise and Cases 1–2 govern.

*The distinction, stated so it is not re-derived: Case 1 is about a missing
**value**, this one is about a missing **edit**. A fix can name its target
perfectly, pass Case 2's address test, and still not be applicable, because the
text it hands the builder does not perform the change when run. "As written" is
the column's own phrase, and it governs the snippet and not only the address.*

**Case 4 — the target is identified by kind rather than by name.** Where the fix
names what to change only by category — "the routing table", "the appropriate
group", "the relevant capability record" — score **0**. Case 1's first condition
and Case 2's address test are not met by a description resolving to a *class* of
records; choosing a member of that class is the edit the column asks whether the
builder can skip.

*A value named by kind is decided by Case 1, not here.* If the instance holds a
value answering the description, it was obtainable and the run declined to look it
up — Case 1 condition 2 fails and the score is 0. If it holds none, condition 2 is
met and the slot is the builder's to fill.

*And the name being one the run was never given is not a defence.* Where this
packet's blind rule withheld an identifier, the run's inability to name it changes
nothing here: the column scores what the builder AI receives, not what the run
could reasonably have known. A run that cannot name its target is free to say so —
what it may not do and still score 1 is hand the builder a class and leave the
choice there. **This is the one place in §A2.1 where a fact about the run is
explicitly excluded from the test**, and it is excluded because the column's
stated consumer is downstream of the run and inherits none of its constraints.

**Case 5 — the report proposes several fixes.** Evaluate the column against
**the proposed fix that addresses the defect the seed carries**, and against that
one alone. Additional fixes aimed at other findings — hedged suggestions,
follow-on hardening, a redesign offered alongside the repair — are neither
credited nor charged. If more than one proposed fix addresses the seeded defect,
all of them must satisfy Cases 1–4; if none does, §A's constraint has already
bound and the column is 0.

*The distinction, stated so it is not re-derived: the two readings this closes
are "score the union" and "score the weakest part". Under the union a report can
sketch a design it never specifies and be rescued by a precise fix sitting beside
it; under the weakest-part reading a report is punished for thinking out loud.
Neither is what the column asks. It asks whether the builder AI can apply **the
repair** unedited, and the repair is the fix aimed at the seeded defect —
which §A's constraint has already identified, since a fix aimed anywhere else
scores this column 0 regardless.*

All five cases are subordinate to the constraint already stated in §A —
`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0. **Check that
first**; if it binds, no case above arises.

### A2.2 `root_cause_layer_correct` — two cases the column definition does not otherwise determine

*Added 2026-08-10, issue #164. The rationale is in the project's decision
record.* The column reads *"Diagnosis names the seed's expected root-cause
layer."* **This is §A2's other gate term**, so an under-determined reading of it
moves the verdict exactly as §A2.1's does — which is why these clauses sit here,
beside §A2.1, rather than in a section of their own. The expected value is
printed in the seed spec's own header table (`Expected root-cause layer`, as a
name and a number). Two shapes of report leave the sentence without an answer.
**Neither case below asks the scorer to weigh anything.**

**Apply Case 2 first**, since it selects *which* root cause Case 1 is then read
against. Where the report states exactly one root cause, Case 2 does not arise.

**Case 1 — the report's declared layer and its finding text disagree.** Where the
report declares a layer — a `layer` field, a **Layer** row, an explicit "layer N"
in the entry — **score the declared value.** Compare it against the seed spec's
expected layer and score **2** on a match, **0** otherwise. Do **not** score the
substance of the finding text: a root cause filed under layer 3 whose prose
describes the seed's layer-2 mechanism scores **0**, and a root cause filed under
the expected layer whose prose is thin, hedged or wrong about the mechanism
scores **2**.

**A declared layer naming more than one layer** — `Layer: 3 (Tool definition) + 4
(Data schema) + 5 (Data)`, `Layer: 3 / 7` — is read on **the conjunct that names
the expected layer**, if one does, and scores **2**; a compound naming no
expected conjunct scores **0**. The other conjuncts are neither credited nor
charged. This is the ordinary shape of a multi-layer causal claim — a type
mismatch genuinely spanning the tool contract, the column type and the stored
data — and a report making it is committing to every layer it names, which is
falsifiable in a way that listing separate hedged entries is not. That is why
this differs from Case 2, which refuses enumeration **across entries**: the
cheapness is in the list, not in the compound.

*The residual exposure, recorded rather than closed: a primary entry declaring
all seven layers at once would earn 2 on any seed. No rule here reaches it,
because every reading that would is a judgement about how sincere a compound is.
It is a bound to watch, not a defence.*

*The distinction, stated so it is not re-derived: the column is named for the
layer and asks only whether the diagnosis reached it. "Reaching a layer is not
diagnosing at it" is a standing finding of this project, not a defect in the
column — the quality of what was found there is what `fix_target_correct`,
`evidence_cites_trace_and_config` and `fix_usable_unedited` are for. A substance
reading would make this column a second `fix_target_correct` and would require
the scorer to judge whether prose "names the mechanism", which is the
under-determination these clauses exist to remove. **The cost is stated rather
than argued away:** a run that understood the defect and mis-numbered it scores 0
here.*

Where **the entry selected under Case 2** declares no layer, score **2** if its
root-cause statement names the expected layer by the **name or the number the
seed spec prints** — `genai_stack`, or "layer 6" — and **0** otherwise. This
holds whether or not *other* entries declare layers: a report whose primary is
unlabelled prose and whose secondaries carry `Layer:` rows is read on the primary
alone, and reaching into a secondary for a label is the scan-the-list reading
Case 2 forbids. The packet carries no layer-to-artifact map, so a scorer is never
asked to work out which layer an unlabelled artifact belongs to; that inference
has no mechanical answer here and the column does not need one.

**Case 2 — the report states more than one root cause.** Evaluate the column
**against one root cause: the report's primary**, selected by the same rule §A1
Case 2 uses — (a) the entry the report itself labels primary or ranks first, else
(b) the first entry in the list, **skipping, in either branch, any entry that
asserts no defect exists.** If every entry is one, the report has stated no root
cause and the column scores **0**.

Do **not** scan the list for an entry that happens to carry the expected layer. A
report enumerating five or seven layers as candidate hypotheses would otherwise
score 2 on every seed automatically, which would make the column measure list
length rather than diagnosis.

*Two things this case deliberately does not do.* It does not require the primary
entry to be swept, confirmed or unhedged — a `layers_swept` table marking the
layer `NOT_SWEPT` is not consulted here, because the column asks what the
diagnosis **named**, and `layers_swept` is a column of its own, scored on its own
terms and not a modifier on this one. And a
**validator rejection** of an entry's citation does not bear on this column at
all: rejected evidence is decided by §A1 Case 4, which governs
`evidence_cites_trace_and_config` alone. Importing either test would score the
same defect twice.

### A2.3 `fix_target_correct` — two cases the column definition does not otherwise determine

*Added 2026-08-10, issue #164. The rationale is in the project's decision
record.* This column is **not** in §A2's gate expression, but it binds the gate
through §A's constraint — `fix_usable_unedited` may not be 1 while this column is
0 — and that constraint governs the column at **§A2.1**, which is why these
clauses sit under §A2 rather than beside §A1's. Every case below is decided by
the seed spec plus the fix text. **Neither asks the scorer to weigh anything.**

**Case 1 — the fix's declared target and its body disagree.** Where a proposed
fix declares its target — a `target_type` / `target` field, a **Target type**
row — **score the declared value.** Prose elsewhere in the fix that touches a
different area does not move the column: an instruction edit described as a step
*inside* a fix declared against the tool definition is not a fix targeting the
instruction, and a fix declared against a tool's configuration whose `proposed`
text mentions verifying a table is not a fix targeting the data.

*The distinction, stated so it is not re-derived: the declared field is the
report's own answer to "what is wrong". Crediting an area a fix merely brushes
past in its body rewards breadth over aim, in a column whose whole purpose is
aim — the same degeneracy Case 2 of §A2.2 closes on the other side of the
report. Where a fix declares no target, read the target from the artifact its
operation writes to; where its operation names no artifact, the column scores
**0**.*

**A declared target naming more than one area** — `Target type: Tool definition +
wiring` — is read on **the conjunct that names the seed's expected area**, if one
does, and scores whatever band Case 2 then gives it. The other conjuncts are
neither credited nor charged. A compound naming no expected-area conjunct scores
**0**, exactly as a single wrong target does.

**Case 2 — where the 1/2 and 1/0 boundaries fall.** Two things in the seed spec
decide this, and **they are two different places in the document**: the
`Expected fix target` header row gives the **area**, and the seed's *Expected
diagnosis* section names the **specific** target — the record, field, table or
mapping. Read both. Four of the five seeds print only an area in the header row,
so a scorer who consults the row alone will find the 2 band unreachable and
mis-award every full-credit fix as partial.

- **2** — the target names the specific target the seed's *Expected diagnosis*
  section names, in whatever terms that section uses.
- **1** — the target falls in the **same one of §A's five areas** as the
  `Expected fix target` row (tool schema / instruction text / data seeding /
  capability mapping / activation) but does not name the specific target.
- **0** — the target falls in a different area; **or** it is a target the seed
  spec's expected-target row explicitly excludes. Where a seed rules a reading
  out in as many words — "**Not** the tool input schema" — that reading scores 0
  though it sits in the expected area. A seed that names its decoy is naming a
  miss, and the exclusion is the seed spec's to make, not the scorer's.

The 1 band is available on **every** seed and needs no `notes` justification to
be used; recording *why* in `notes` remains good practice and is no longer what
authorises it.

**Where the report proposes several fixes**, the column takes **the highest value
any single non-hedged proposed fix earns** — skipping any entry the report itself
marks alternative, hedged, optional or follow-on hardening — with **one
restriction: the 1 band is available only from the report's primary fix** (the
one it labels primary or ranks first, on the same skip rule). A later fix can
lift the column to **2** by naming the specific target; it cannot lift it to
**1** by naming only the area.

*Why this is NOT §A2.2 Case 2's primary-only rule, since the asymmetry is
deliberate and the reason is the whole of its justification.* Naming a layer is
free: it is a label on a list entry, and enumerating all seven guarantees a hit
at no cost, which is why the other column reads the primary alone. Naming an
**area** is equally free — five areas exist and a report can list all five — so
the 1 band gets the same treatment. Naming the **specific** target is not free:
it requires having identified the record, field, table or mapping the seed's
*Expected diagnosis* names, and a report that does that in its second fix has
done the thing this column measures. Scoring it 0 because it ordered its fixes
differently would charge a report for its layout, not its aim. **The enumeration
hole is therefore closed at the band where enumeration is cheap, and left open at
the band where it is not.**

Where several fixes tie at the top value, the column takes that value; no
tie-break is needed, because this column scores a **value** and does not
designate a fix for any other column to use.

> **This column selects its own subject, and does not redirect §A2.1 Case 5.**
> That case picks its subject by a different test — the fix that addresses the
> seeded defect — and may land on a different fix, or on several. The two columns
> are joined by §A's constraint, which relates their **values** (a
> `fix_target_correct` of 0 forces `fix_usable_unedited` to 0) and not their
> subjects. Where the two select different fixes, that is the design rather than a
> conflict, and neither case overrides the other.

*The residual exposure, recorded rather than closed: a report proposing five
distinct fixes that each name a **specific** target, one per area, earns 2 on any
seed. The restriction above does not reach that case, and no rule here does —
because such a report has, in fact, named the seeded target, and a rule that
scored it 0 would be scoring the report's confidence rather than its aim. What
protects the pass is that the other three columns are unmoved by it: the shotgun
still has to survive §A2.2 Case 2 on its root causes and §A2.1 on the fix. It is
a bound, not a defence, and it is the case to watch in the next pass.*

## A3. Void runs — a run that measured nothing

A run is **void** when the seed was not in the state its spec requires, so the
run tested something other than the seeded defect. It is neither a hit nor a
miss, and scoring it either way corrupts the gate.

Known void conditions, both from the seed specs:

- **Seed 5** — the `sn_aia_trigger_agent_usecase_m2m` gate was not turned on
  post-install, so *both* activation gates were off and the seed isolated
  nothing. (Also void if the trigger fails to fire for the unresolved SDK 4.9.0
  run-as reason — see that seed's spec.)
- **Seed 4** — the capability sys_id in the installed `sn_aia_tool.script` does
  not match the target instance's `sys_one_extend_capability` record (originally:
  the `REPLACE_WITH_SEED_04_CAPABILITY_SYS_ID` placeholder was not substituted;
  since Task 12 the Fluent source hardcodes **gpinst01's** sys_id
  `92ff62af516741769c437feb88c80ef3`, which is equally void on any *other*
  instance until re-substituted — see the seed spec's Setup step 2). Either way
  the tool tests a malformed reference rather than an unmapped provider. A
  hardcoded value that MATCHES the instance's record is a valid install, not a
  void.

**How to record one.** Put `void` in `passes_gate` — not `0` — write the reason
in `notes`, and leave the four rubric columns blank. A blank rubric with a stated
reason is honest; a `0` is a measurement that did not happen.

**What a void row does to the denominator.**

1. A void row counts in **neither** the numerator nor the denominator. The
   denominator is the number of **valid** runs, not 10.
2. **Void runs should be re-run**, not absorbed. Fix the setup, run the seed
   again, and score the replacement. Voidness is a property of the run, not of
   the seed.
3. If a void run cannot be made valid, the gate is read as
   `sum(passes_gate) / <valid runs>` against the **same proportions**, and
   *all three* bands are proportional — not just the top one. The
   Task 12 bands are `≥ 8/10`, `5–7/10` and `< 5/10`,
   which are:

   | Band | Proportion of valid runs | Outcome — the arm this band was read on |
   |---|---|---|
   | Top (`≥ 8/10`) | **≥ 80%** | This arm is the front door |
   | Middle (`5–7/10`) | **≥ 50% and < 80%** | This arm is lightweight triage only |
   | Bottom (`< 5/10`) | **< 50%** | This arm does not clear triage on this evidence |

   **A band classifies ONE arm and prescribes about that arm only.** A band says
   nothing about any other arm — including whether an alternative should be built.
   Where two harnesses are compared, each is banded on its own proportion and:

   > **(a) The other arm is UNMEASURED on this seed set** — this arm's shortfall is
   > the only evidence available, and building the alternative is the only
   > inference it supports. Prescribe it.
   >
   > **(b) The other arm IS measured** — this band prescribes **this arm's role and
   > nothing else**. An alternative harness is built out only when **its own**
   > proportion reaches the **top band** on the same seed set in the same pass. A
   > relative *"beats the other arm"* test is **not** used: it makes the decision a
   > function of the control's intra-day drift, so a bad control day could license a
   > build-out with no improvement in the arm being decided.
   >
   > **(c) Under (a) or (b) alike** — a component **measured to degrade a
   > diagnosis** is removed or re-derived before any further build, whatever the arm
   > proportions say. Arm-level proportions can hide component-level harm: an arm can
   > clear a band while containing a component that damages a subset of its rows.

   **The bottom band is a floor, and floors are the least informative result.** It
   does not establish how far below the band the arm sits, and it does not establish
   that the arm cannot reach a higher band later. Read it as *this arm did not clear
   triage in this pass*, never as *this arm is finished*.

   **Scorers: this note is for whoever reads the completed scorecard.** It asks
   nothing of you — score the rubric columns and leave the banding alone.

   Edges are **inclusive at the bottom of each band** (`≥`), and the comparison
   is on the proportion — do **not** round the pass count to a /10 equivalent
   first. Worked example, because this is the case that had no stated answer:
   **8 valid runs, 4 passes = 50.0% → middle band.** At 8 valid runs the bands
   are 7–8 passes (top), 4–6 (middle), 0–3 (bottom); at 9 valid runs, 8–9 (top),
   5–7 (middle), 0–4 (bottom). The decision record must show the percentage it read,
   not only the fraction.
4. **Floor: below 8 valid runs the gate is not evaluable.** The decision record must
   record the outcome as *gate not met — insufficient data*, state how many runs
   were void and why, and must **not** compute a verdict from the survivors. Two
   void rows already take this to exactly 8; a third puts the benchmark under its
   own floor. This is the case the whole column exists to make visible rather
   than let a low total hide it.

---

## 2. Seed specification (in full; repository paths redacted — see the note in section 1)

# Seed 04 — GenAI capability not mapped to a provider

| | |
|---|---|
| **Expected root-cause layer** | `genai_stack` (layer 6) |
| **Expected fix target** | capability mapping |
| **Fluent source** | the fixture app's Fluent file for this seed |
| **Agent name** | Seed 04 Summarizer |
| **Also stresses** | — |

## The defect

> **Fixture state, verified 2026-08-02.** The primary construction installed
> without refusal (no fallback needed), the placeholder was substituted with
> capability sys_id `92ff62af516741769c437feb88c80ef3` and verified in the
> installed script, and the seed execution
> `16ddc10c2baa4314f243fed2ce91bf15` produced the predicted signature:
> `OneExtendUtil.execute` returned `status: "error"`, message "Plan invalid…",
> `capabilities: {}`, and the tool returned `ok: false`.

The capability definition `x_snc_tsbench_unmapped_capability` exists and is
reachable, but its `api` — the **mandatory** pointer at the `sys_hub_flow`
provider integration subflow that actually executes the call — is
`00000000000000000000000000000000`, which resolves to no flow record at all.
`api_type` still says `sys_hub_flow`, so the platform is told to run a Flow and
handed a Flow that does not exist. That is a broken capability→provider mapping:
the capability record is real, and there is no provider behind it.

**~~The `connection` premise~~ — REFUTED and replaced, 2026-08-01.** ~~Its
`connection` — the bound provider credential alias — is empty. R-18 established
that `connection` is exactly that binding, so an empty one is precisely
"capability not mapped to a provider".~~ ~~One missing binding, not three —
corrected 2026-08-01. The seed now matches the well-formed shape exactly, with a
real `sys_one_extend_capability` parent record, so **`connection` is the only
gap** — which is the seed's entire purpose.~~

R-18's reading of `connection` came from a **ten-row sample**. Measured against
the whole table on gpinst01, read-only:

| Measurement | Value |
|---|---|
| `sys_one_extend_capability_definition` rows | **2026** (not 10, not 12) |
| …with `connection` **empty** | **318 of 2026 (15.7%)**, shipped OOB Now Assist definitions among them |
| `sys_dictionary` — `connection` | `reference` → `sys_alias`, **`mandatory=false`** |
| `sys_dictionary` — `capability`, `api_type`, `api` | all **`mandatory=true`** |

An empty `connection` is therefore a normal, common, supported state. After the
previous fix wave this seed's record had become a structural clone of working OOB
definitions differing only in an *optional* field — it would most likely not have
failed at all, and a benchmark specimen that measures nothing is worse than no
specimen. The seed is re-targeted at a binding the platform actually requires, so
that the failure is guaranteed rather than hoped for. See **the build contract, ruling R-22**.

**Why `api`, with the counts that justify it** — same table, same denominator of
2026:

- **1 of 2026 (0.05%)** rows has `api` empty — the single `api_type=Decision` row.
- `api_type=sys_hub_flow` accounts for **1840 of 2026** rows across **55 distinct
  `api` values**. **54 of those 55** resolve to a live `sys_hub_flow`; exactly one
  does not, and it belongs to a single OOB row (*"Default OneExtend Profanity
  Filter"*). A dangling `api` is therefore **1 row in 2026 (0.05%)** — about
  **300× rarer** than an empty `connection`, and genuinely anomalous rather than
  routine.
- `api` is `internal_type=document_id`, so it carries **no referential
  integrity**: an arbitrary sys_id installs verbatim and resolves to nothing.

The rejected alternative was a dangling `capability` reference. It is equally
mandatory, but it is a true `reference` column that the platform may validate or
repair, and breaking it would change the failure signature to *capability not
found* while leaving the tool no sys_id to invoke — which is the **fallback**
construction below, not this one.

**`connection` stays empty and is no longer the defect.** It is left empty
because there is no alias to bind and because 318 OOB rows do the same. **A
diagnosis that names the empty `connection` as the root cause is naming a normal
state and must not be scored as a hit** — see "Expected diagnosis".

**The invocation envelope was also wrong — corrected 2026-08-01.** This
correction stands and is unaffected by the re-targeting above. ~~The tool
calls `sn_one_extend.OneExtendUtil.execute` with the capability name.~~ It
previously called `execute({capability: '<name>', ticket: ...})`. The real
envelope is an array under `executionRequests`, keyed by capability **sys_id**
(see the Now Assist skill golden example). The old form could
not reach the capability record at all, so it could never have failed on the
empty `connection`: it would have died as a malformed-request **script error —
layer 3, not layer 6** — and an agent correctly reporting the malformed envelope
would have been scored a **miss** on a seed whose expected answer is
`genai_stack`.

## Shared-instance safety

The seed creates its **own** capability definition rather than unmapping a
real one. LLD §7 warns explicitly against unmapping real capabilities on the
shared instance — gpinst01 hosts other tenants, and breaking an existing
capability would be an uncontained blast radius. All the seed does to the
instance is add one capability + one definition of its own, both owned by the
fixture app.

**Why a dangling `api` rather than a deleted one.** `api` is `mandatory=true`,
so an empty value is not a shape the platform is expected to accept — and only
1 of 2026 rows on the instance has one. A *populated but unresolvable* `api`
passes every mandatory check, installs verbatim (no referential integrity on a
`document_id` column), and fails at the point of use, which is exactly where a
diagnostic agent has to catch it. The all-zeros value is chosen so a maintainer
reading the record sees at a glance that it is deliberate; a plausible random
GUID would read as a real mapping that had drifted.

**LLD §8 item 8 is re-opened by this change** — it was closed on the refuted
`connection` premise. See LLD §8 item 8 and the build contract R-22.

## Install risk and the fallback

`sys_one_extend_capability_definition` is a **global** table, and this is a
scoped app. A scoped app writing into a global table via the generic
`Record()` fallback may be refused at install even though it builds cleanly
— this was true for Task 11's build (see below) but install is a Task 12
concern this task does not reach.

If Task 12's install refuses either record, fall back to a tool invoking a
`capabilityId` that exists **nowhere at all** — no `sys_one_extend_capability`
row for it, and therefore no definition either. That construction needs no
global-table write of any kind: the only thing installed is the agent's own
tool script, inside `x_snc_tsbench`.

Note that it changes the seed's failure signature. The primary construction
produces *capability exists, its provider flow does not*; the fallback produces
*capability not found* — the platform cannot reach the capability record at all,
rather than reaching it and finding nothing behind it. If the fallback is used,
the seed's expected diagnosis changes accordingly and the scorecard must be
scored against the **fallback's** signature, not the one described above.

Do **not** improvise a third construction by emptying `connection`. That was
this seed's original defect and it was refuted — see "The defect".

## Setup

1. Install the fixture app (Task 12): run `now-sdk install --alias gpinst01` from the fixture app's directory

2. **Verify the capability sys_id in the tool script matches the installed
   capability — mandatory.** *(State updated 2026-08-02: the Fluent source no
   longer ships the placeholder.)* At Task 12 the placeholder
   `REPLACE_WITH_SEED_04_CAPABILITY_SYS_ID` (the Build Rule #33 house pattern —
   the sys_id exists only after install, and an unreplaced placeholder fails
   loudly rather than pointing silently at the wrong record) was substituted
   with **gpinst01's** installed capability sys_id
   `92ff62af516741769c437feb88c80ef3`, and that value is now hardcoded in
   the fixture app's Fluent file for this seed. What to do depends on
   the target instance:

   - **Reinstalling on gpinst01:** no substitution needed. Do NOT reintroduce
     the placeholder. Verify only (below).
   - **Installing on any other instance:** the hardcoded value is
     instance-specific and will match nothing. Read the installed capability's
     sys_id and replace the hardcoded value, then rebuild + reinstall (or patch
     `sn_aia_tool.script` for `summarise_ticket` directly on the instance):

     ```
     GET /api/now/table/sys_one_extend_capability
         ?sysparm_query=name=x_snc_tsbench_unmapped_capability
         &sysparm_fields=sys_id,name
     ```

   - **Verify in either case:** the sys_id in the *installed*
     `sn_aia_tool.script` equals the sys_id the GET above returns on the target
     instance.

   **If the installed script's sys_id does not match the instance's capability
   record, the seed is void** — the tool cannot reach any capability, and the
   run tests a malformed reference rather than an unmapped provider. (A
   correctly-matching hardcoded value is a VALID install, not a skipped step —
   do not record such a run as void.)

3. Insert one bench ticket with `short_description` set. Record its sys_id.
   (Possible only because of the record ACLs and `allowWebServiceAccess` in
   the fixture app's shared ACL Fluent file — Build Rule #42.)

## Trigger

Open a fresh conversation with **Seed 04 Summarizer** and ask it to summarise
the bench ticket by sys_id. Capture the resulting `sn_aia_execution_plan`
sys_id.

## Expected diagnosis

Root cause in `genai_stack`: the capability `x_snc_tsbench_unmapped_capability`
exists but its definition points at a provider flow that does not exist —
`api_type=sys_hub_flow` with `api=00000000000000000000000000000000`, which
matches no `sys_hub_flow` record. Fix target: **capability mapping** — repoint
`api` at the real provider integration subflow (the healthy value for a Now LLM
Generic definition on gpinst01 is `936e514a53b3b110f028ddeeff7b128c`, used by
422 of the 2026 definition rows) — not the tool script and not the agent
instructions.

Evidence a correct diagnosis should cite: the tool's execution failure or error
result from `sn_one_extend.OneExtendUtil.execute`, **plus** the capability
definition row showing the unresolvable `api`.

**Scoring note — the empty `connection` is a decoy, and it is on the record on
purpose.** The definition also has `connection` empty. That is the *normal*
state for 318 of the instance's 2026 definition rows and the column is
`mandatory=false`, so it is not a defect. A diagnosis whose root cause is "the
capability has no connection bound" has named a normal state:

- Root cause `genai_stack` is still **correct** (the layer is right) — award
  `root_cause_layer_correct`.
- `fix_target_correct` scores **0** if the proposed fix is "bind a
  connection/credential alias" and nothing else. It is not the seeded defect and
  applying it would not make the capability work.
- `fix_usable_unedited` scores **0** as well, and this is the bullet that makes
  the decoy bite. "Bind a connection alias" is well-formed and a builder could
  apply it verbatim — but it fixes nothing, and a fix aimed at the wrong target
  is a no-op, not a usable fix. See the scoring template §A2: the column
  may not be 1 while `fix_target_correct` is 0. **The correct row for a decoy
  hit is 2 / 0 / … / 0, `passes_gate` = 0.** Scoring it 2 / 0 / … / 1 lets the
  run pass the gate and makes the decoy inert, which was a live defect in the
  scorecard until PR #33's round-2 review.
- Record the decoy hit in `notes` either way. It is a useful signal about the
  diagnostic agent, not just a scoring event.

**If the fallback from "Install risk and the fallback" above was used**, score
against that signature instead: root cause still lands in `genai_stack`, but the
evidence is a *capability not found* error rather than an invocation failure
against a missing provider flow, and a diagnosis should be scored on whether it
correctly identifies a missing/unregistered capability rather than a mis-mapped
one.

## Safety

Creates only its own capability definition and agent/tool records, owned by
the fixture app. No existing capability, connection, or provider mapping on
the instance is touched, unmapped or repointed. The dangling `api` value points
at a sys_id that exists nowhere, so it cannot collide with a real flow.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by the blind-rule guard test — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 04 Summarizer
x_snc_tsbench_unmapped_capability
936e514a53b3b110f028ddeeff7b128c
```

---

## 3. Advance rulings on scoring columns

None for this seed. Score every column from the rubric in section 1, applied to the
material in the rest of this packet.

This section appears in every packet of this pass whether or not it carries a ruling,
so its presence says nothing about the row.

---

## 4. This run's report

**Harness arm:** native (Agent Doctor, `servicenow_aia_execute`)  
**How this run was invoked:** servicenow_aia_execute on agent "Agent Doctor" — objective: "Diagnose the failing AI Agent execution with plan sys_id a513a33e2b624718f243fed2ce91bf4e. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes." waitForCompletion=false; session bd715e072ba24b18f243fed2ce91bf61 -> plan 8271de072ba24b18f243fed2ce91bf62  
**Execution under diagnosis:** `a513a33e2b624718f243fed2ce91bf4e`  
**Triggering record:** `64c2abbe2bea0bd817a6ffbeee91bf2f`  
**This run's own identity:** diagnostic execution `e48156472ba24b18f243fed2ce91bfaf` (TR1000281)  
**Terminal state:** **completed**  
**Wall clock:** 3m22s  
**Tool-call count:** 14

## Fix Report — Execution Plan `a513a33e2b624718f243fed2ce91bf4e`

---

### FAILURE SUMMARY

The user invoked agent **Seed 04 Summarizer** and asked it to summarise bench ticket `64c2abbe2bea0bd817a6ffbeee91bf2f`. The agent correctly selected the `summarise_ticket` tool, which in turn called `sn_one_extend.OneExtendUtil.execute` against capability `92ff62af516741769c437feb88c80ef3` (`x_snc_tsbench_unmapped_capability`). That call returned `ok: false`, `status: error`, `planId: null` — the capability could not dispatch to any provider because its definition's **api** field points to the nil GUID (`00000000000000000000000000000000`), which resolves to no row in `sys_hub_flow`. The agent surface-reported "Ticket Summarisation Failed" to the user. No data was returned. The agent description itself states the break is deliberate: *"Benchmark seed - deliberately broken."*

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | ✅ SWEPT | Tool call returned `ok:false`; no script errors in message stream |
| 2 | Agent instructions | ✅ SWEPT | Instructions are coherent; instruct use of `summarise_ticket` |
| 3 | Tool definitions | ✅ SWEPT | Tool binding active, script hardcodes capability sys_id |
| 4 | Data schemas | ✅ SWEPT | `x_snc_tsbench_ticket` exists with 8 fields |
| 5 | Data (records) | ✅ SWEPT | Target ticket record exists and is readable |
| 6 | GenAI stack | ✅ SWEPT | Capability definition has dangling `api` — **confirmed root cause** |
| 7 | Trigger & wiring | ✅ SWEPT | No trigger wiring; agent invoked conversationally (expected) |
| — | Platform logs | ⚠️ UNAVAILABLE | `syslog` is caller-restricted; an instance administrator must relax `caller_access` on `syslog` or export logs from a permitted scope to sweep this layer |

---

### ROOT CAUSES

#### RC-1 — Dangling `api` on the GenAI capability definition

| Attribute | Value |
|-----------|-------|
| **Layer** | 6 — GenAI stack |
| **Component** | `sys_one_extend_capability_definition` — record `904c0485699a4a73a124446a7231c563` |
| **Finding** | The `api` field holds the nil GUID `00000000000000000000000000000000`. The `api_type` is `sys_hub_flow`. No row with that sys_id exists in `sys_hub_flow`. The executor finds no flow to dispatch to and returns `status: error`. |
| **Evidence** | `genai_log` check_config, definition `904c0485699a4a73a124446a7231c563`, field `api` = `00000000000000000000000000000000`; `sys_hub_flow` read status `empty` (table was readable — the target genuinely does not exist). Corroborated by tool call response: `ok:false`, `status:error`, `planId:null` (`sn_aia_tools_execution` row `bf13ab3e2b624718f243fed2ce91bfad`). |
| **Confidence** | **CONFIRMED** — two independent layers agree |

#### RC-2 — `ticket` input declared non-mandatory in tool schema

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac`, input schema, field `ticket` |
| **Finding** | `mandatory: false`. The ticket sys_id is the only meaningful input; marking it optional allows the model to omit it without error, producing a silent bad call. |
| **Evidence** | `agent_config` tools section, binding `3c72dab2668c4ba5a6080a5cd5fb2b91`, `inputs` array, `mandatory: false`. |
| **Confidence** | **CONFIRMED** |

#### RC-3 — Tool description lacks input-format and output guidance

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac`, `description` field |
| **Finding** | Description does not state what format `ticket` must be (sys_id vs number), nor what the output structure looks like. The model must invent both. |
| **Evidence** | `agent_config` tool smell: `description_no_input_guidance` and `description_no_negative_guidance` (medium severity, heuristic). Current description: *"Summarises a bench ticket by invoking the x_snc_tsbench_unmapped_capability GenAI capability. Give it a ticket sys_id. Returns the generated summary."* |
| **Confidence** | **CONFIRMED** (heuristic — verify by reading the description) |

---

### FIXES

#### FIX-1 — Repoint the capability definition's `api` to a real `sys_hub_flow` record

| Attribute | Value |
|-----------|-------|
| **Target type** | Configuration — GenAI capability definition |
| **Target** | `sys_one_extend_capability_definition`, record `904c0485699a4a73a124446a7231c563`, field `api` |
| **Current** | `00000000000000000000000000000000` (nil GUID — resolves to no flow) |
| **Proposed** | The sys_id of the intended `sys_hub_flow` provider integration record (e.g., the Now LLM Service spoke flow for the target model). Identify the correct flow in **Now Assist** → **Capabilities** → **x_snc_tsbench_unmapped_capability** → **Edit definition** → **API** picker. |
| **Rationale** | The capability executor reads `api` to locate the flow it dispatches through. A nil GUID means no flow is ever found; the call fails before any model is contacted. Binding the correct flow record unblocks the entire call chain. |

#### FIX-2 — Mark `ticket` input as mandatory in the tool schema

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac`, input definition for `ticket`, field `mandatory` |
| **Current** | `false` |
| **Proposed** | `true` |
| **Rationale** | The tool cannot function without a ticket sys_id. Making the field mandatory causes the orchestrator to enforce its presence at selection time rather than allowing a silent omission that would fail at runtime. |

#### FIX-3 — Improve tool description with input-format and output guidance

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `37d6957bb5cd4bda96fc9a93de494eac`, field `description` |
| **Current** | `Summarises a bench ticket by invoking the x_snc_tsbench_unmapped_capability GenAI capability. Give it a ticket sys_id. Returns the generated summary.` |
| **Proposed** | `Summarises a single bench ticket (x_snc_tsbench_ticket). Requires the ticket's sys_id (32-character hex string) as input — do not pass a ticket number or any other identifier. Returns the generated summary text on success. Do not use this tool for non-bench-ticket records or for any task other than summarisation.` |
| **Rationale** | Explicitly states the expected input format, what the tool does not cover, and what the output looks like. Reduces model hallucination of input values and improper tool selection. |

---

### VERIFICATION

1. After applying FIX-1, open **Now Assist** → **Capabilities** → **x_snc_tsbench_unmapped_capability** and confirm the definition's **API** field resolves to a non-null `sys_hub_flow` record.
2. Re-run the agent against any `x_snc_tsbench_ticket` sys_id using the same conversational invocation path.
3. In the new execution plan (via agent_trace), confirm: tool call response `ok: true`, `result` contains summary text, and the GenAI task completes with status `Success`.
4. Run `genai_log check_config` on capability `92ff62af516741769c437feb88c80ef3` and confirm zero findings are returned.

---

### DATA MARKERS

The following record data was quoted above as evidence. Redact before this report crosses the instance boundary:

- `sys_one_extend_capability_definition.api = 00000000000000000000000000000000` (nil GUID — not sensitive, but confirms misconfiguration)
- `x_snc_tsbench_ticket.short_description = "Meeting room display flickers with a magenta cast during video calls on the third floor"` (ticket content — redact if instance data is confidential)
- `sn_aia_message` user profile block: email `admin@example.com`, name `System Administrator`, sys_id `6816f79cc0a8016401c5a33be04be441`

---

> **Note on platform logs (Layer 7 gap):** The `syslog` table is caller-restricted and could not be read. No platform-level script errors were observed through `agent_trace`'s message-stream mining (0 script errors found), but errors occurring *outside* the execution boundary — such as a flow launch failure in the Now LLM Service — would not appear there. An instance administrator should export or review syslog entries for the window `2026-08-11 01:22:43` – `2026-08-11 01:27:04` to rule out any platform-side error corroborating RC-1.
References: null

---

## 5. This run's audit-trail measurements

Derived from the diagnostic run's own audit trail (`action_type=result`) per §E1–§E2,
independently of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 7/7 (L1, L2, L3, L4, L5, L6, L7) — mechanical §E2 map of the distinct tool set (`agent_trace`→L1, `agent_config`→L2/L3/L7, `schema_lookup`→L4, `query_table`→L5, `genai_log`→L6; `read_artifact` and `log_analysis` map to no layer)
- **Tool-call count:** 14 result rows
- **Distinct tool names:** 7 — `agent_trace`, `read_artifact (x8)`, `agent_config`, `genai_log`, `schema_lookup`, `query_table`, `log_analysis`
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 before run 1 by two independent paths that agreed: `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`) and the harness's own tool registry. All seven attached and active, `max_auto_executions = 10` on every one.
- **`continuous_tool_execution_limit`:** 25 — read live during this pass, not carried forward
- **Terminal state:** **completed**
- **Wall clock:** 3m22s
- **Harness HOLDs:** none

**One stated omission.** The per-call ordered list with timestamps and full arguments is not reproduced here. Where the argument of a held call bears on whether a layer was genuinely reached, that argument is named in section 6 instead. Every packet in this pass carries the same fields, so the instrument is constant across rows.

---

## 6. Notes specific to this run

- Trace reported LLM P95 latency of 50,991ms on this row — the highest of any row this pass — with no effect on terminal state.
- This run reached a terminal state and was not re-run. No row in this pass was void, and no arm used any of its permitted re-runs.

---

## 7. What to return

Score the four rubric columns, then compute `passes_gate` by the rule in section 1.
State your reasoning for each column. If a column is under-determined by the material
above, say so explicitly and set the packet-level `ambiguous` flag to `yes` — do not
guess and do not smooth it over. An honest "under-determined" is a usable measurement;
a confident guess is not.
