# Scoring packet — Row 10

**Seed:** 06 · **Harness arm:** custom (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`) · **Run:** 1

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

A run is **void** when it measured nothing about the seeded defect. That happens
two ways: the seed was not in the state its spec requires, so the run tested
something other than the seeded defect; or the run ended without producing a
report, so there is nothing for the rubric to read. Either way it is neither a
hit nor a miss, and scoring it either way corrupts the gate.

Known void conditions. The first two are **seed-state** conditions and come from
the seed specs. The third is a **run-state** condition: it belongs to no seed,
and it binds every seed and every harness alike.

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
- **Any seed, any harness — the PLATFORM terminated the execution and no report
  text was produced.** The execution closed `state: terminated` with
  `state_reason: execution_failed`, and the run emitted no report body of any
  kind, so there is nothing for the rubric to read. An intact fixture does
  **not** make that a valid `0`: a `0` is a report that failed the rubric, and
  here there is no report to fail it.

  **The boundary is deliberately narrow — the platform failed the execution, as
  against the run failing.** The two adjacent cases are both **scored**, and
  neither is this condition:

  - **A report body that was produced and then REJECTED is a report.** Score it
    against the rubric like any other; a `0` on it is a real measurement.
    Whether a validator accepted the body is not the test — whether the model
    produced one is.
  - **A run that exhausted a declared budget is a run that failed.** A death at
    a tool ceiling, a context limit, a supervision stall or a wander is scored,
    with `cause_of_death` recording how it died. That column exists precisely
    because a `0` earned by running out of budget and a `0` earned by reasoning
    badly are opposite verdicts, and voiding either deletes the signal the
    column was added to carry.

  **What this condition does not decide:** a provider outage (`genai_down`) with
  no report body sits on the boundary — the provider is neither the harness nor
  the platform executing it — and nothing here rules on it. A pass that meets it
  must rule under clause (b) below, before firing any replacement.

  A terminated execution is a real measurement about **operating** that harness
  and belongs in the operator record. It is not a measurement of diagnostic
  quality, which is what these columns grade.

  Two properties make this condition safe to apply, and both are requirements on
  the operator, not remarks:

  **(a) It is symmetric.** It applies on identical terms whichever harness the
  terminated run belongs to. A condition invoked for one harness's terminated
  run and not another's is not this condition.

  **(b) A void condition is committed before the replacement run is fired — and
  this clause binds AUTHORING a condition, not applying one already written
  here.** Applying the bullet above to a run that terminates on the last row of a
  pass, when the tallies are unavoidably visible, is not a choice made with the
  effect in view: the choice was made in this section, before the pass began.
  That is the whole reason a void condition belongs here rather than in one
  pass's own record. What the clause forbids is meeting a terminal state this
  section does **not** name and ruling on it once its effect on the comparison
  can be estimated — voiding removes a row that could only have taken a zero
  against an absent report, and it spends one of the arm's re-runs, and which
  effect dominates is not knowable in advance. Author the new condition, commit
  it, then fire the replacement.

**How to record one.** Put `void` in `passes_gate` — not `0` — write the reason
in `notes`, and leave the four rubric columns blank. A blank rubric with a stated
reason is honest; a `0` is a measurement that did not happen.

**What a void row does to the denominator.**

1. A void row counts in **neither** the numerator nor the denominator. The
   denominator is the number of **valid** runs, not 10.
2. **Void runs should be re-run**, not absorbed. Fix the setup, run the seed
   again, and score the replacement. Voidness is a property of the run, not of
   the seed — a run-state void has no setup to fix, and is simply re-fired.

   **Re-runs are capped per arm, and the pass declares the cap before it
   starts.** Reaching the cap is a **cost stop, not a verdict**: stop re-running
   that arm, close the pass with what is valid, and read rule 4 against the
   valid count. Without a declared cap a flaky harness can be re-fired
   indefinitely, so nothing is ever unrecoverable and the floor below can never
   bite — which is the test rule 4 needs: **a void the cap leaves unreplaced is
   what "cannot be made valid" means.**
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

   **Read the floor on one arm at a time — but only where the pass is sized for
   it.** The row count this file declares is **10 rows, total**. A pass that runs
   two harnesses must state its own size before it starts, and the per-arm
   reading assumes each arm carries a full 10 valid rows; where it does, each arm
   carries its own floor against its own valid rows, and one arm falling below it
   suppresses **that arm's** gate figure and not the other's. **Where a pass
   instead splits the 10 rows across two arms the floor's premise does not
   hold** — 5 rows in an arm is under 8 before anything is scored — and that pass
   must settle its own evaluability rule in its pre-registration, before any row
   exists. Settling it afterwards is not a criterion; it is a degree of freedom,
   exercised by someone who can already see which reading flatters which arm.

   **The floor counts what could not be made valid**, not what was encountered.
   Rule 2 requires a void to be re-run rather than absorbed, so a void whose
   replacement is valid costs the denominator nothing, and rule 2's cap is what
   makes "cannot be made valid" a decidable state. An arm sized at 10 may
   therefore finish with up to two unrecoverable voids and still be evaluable,
   however many voids it met along the way. A pass that voids many rows and
   recovers them all is a costly pass, not an under-powered one.

---

## 2. Seed specification (in full; repository paths redacted — see the note in section 1)

# Seed 06 — the queried column does not exist

| | |
|---|---|
| **Expected root-cause layer** | `data_schema` (layer 4) |
| **Expected fix target** | the **table schema** — add the `category` column to `x_snc_tsbench_ticket`, or repoint the tool at a column the dictionary declares. **Not** "seed the table" — see Decoys |
| **Fluent source** | the fixture app's Fluent file for this seed |
| **Agent name** | Seed 06 Hardware Reporter |
| **Also stresses** | the layer-4 coverage gap — no other seed targets `schema_lookup` |

## The defect

> **Fixture state, verified live 2026-08-11.** Seed execution
> `ee0a07832b624310f243fed2ce91bfeb`: `count_by_category` returned
> `{"ok":true,"category":"hardware","count":0,"tickets":[]}` with tool status
> **`success`**, and the agent reported zero hardware tickets. The table held
> 15+ rows at the time, several of them plainly hardware ("Laptop screen
> cracked after drop", "Badge printer in the security office jams", two
> displays). Observed, not predicted.

`count_by_category` filters `x_snc_tsbench_ticket` on a `category` column.
**That column does not exist.** The table declares exactly two non-system
columns — `short_description` and `priority` (read from `sys_dictionary`,
2026-08-11). `GlideRecord.addQuery` does not throw on an unknown field; the
condition simply matches nothing.

So the tool succeeds, the run completes, and the answer is fluent and wrong.
Nothing in the trace is red. The cause is visible only by reading the table's
**dictionary**, which is what layer 4 is and what `schema_lookup` exists to do.

## Why it is built this way

**This slot was originally K26 taxonomy T1 (ACL-trigger misalignment) and that
construction was refuted by measurement.** Two builds, both installed and run:

| attempt | construction | execution | result |
|---|---|---|---|
| 1 | `securityAcl: 'Specific role'` only | `f47403872ba2031017a6ffbeee91bf33` | `completed`, `state_reason` empty |
| 2 | `dataAccess.roleList` added, emitting `sys_agent_access_role_configuration` `1bdce07b54ff4181bb893435d31d3eb6`, `action=limit_to_roles` | `4f05430b2bea0310f243fed2ce91bfd8` | `completed` again |

**Root cause of the non-reproduction:** K26 Lab 1 is *trigger-scoped*. Its
mechanism is that a **trigger** invokes the agent under the **initiating
user's** context and that user's roles fail the check. The benchmark captures
seed executions by direct REST invocation **as admin**, and admin passes —
`access_verification` is its own execution-task type and returned
`isAccessAllowed: true` in 371ms. Reproducing T1 needs an active trigger *and* a
second, non-privileged identity, and LLD §7 lists trigger `run_as` as
unresolved; a trigger that would not fire on empty `run_as` is a **second**
wiring defect layered on the seeded one — the condition seed 05's spec names as
disqualifying. **T1 is deferred, not abandoned.**

**Provenance, stated plainly because it is weaker than seeds 07 and 08's.**
Those two are out-of-sample because their taxonomy entries were chosen
2026-08-01, before the §AG/§AH clauses existed. This seed was chosen *after*
those clauses, so that argument is not available to it. What it has instead is
an external, pre-existing selection criterion: **layer 4 is covered by no seed
in the set.** The build contract R-21 recorded the coverage gap on 2026-08-01 and
`the scoring template` §E2 maps layer 4 to `schema_lookup`, a tool with no seed
pointing at it. The slot was picked from the coverage table, not by reading the
clauses — but a reader is entitled to discount it relative to 07 and 08, and
the pass pre-registration says so on its face.

**How this differs from seed 01, which is also about a column.** Seed 01's
column *exists* and the defect is that the tool passes a word into an Integer —
a **type-contract** defect in the tool, layer 3. Here the tool's typing is fine
and the column is **absent** — a **schema** defect, layer 4. Both present as
"the value is not what you expected"; only a dictionary read separates them.
The two seeds together are what make that distinction measurable.

## Decoys

**The table is not empty — and that is the decoy, free of construction cost.**
`x_snc_tsbench_ticket` holds 15+ rows, so "the table has no data" (layer 5,
which is *seed 03's* actual defect) is the tempting wrong diagnosis, refutable
by a single unfiltered query.

- A diagnosis filing the primary root cause at **layer 5** scores **0** on
  `root_cause_layer_correct`.
- A fix target of **"seed the table"** scores **0** on `fix_target_correct`:
  seeding would not help, because the filter would still match nothing.

## Setup

Install the fixture app: run `now-sdk install --alias gpinst01` from the fixture app's directory.
No post-install step. No row insertion is required — the table is already
populated, and its population is load-bearing for the decoy above.

## Trigger

Open a fresh conversation with **Seed 06 Hardware Reporter** and ask how many
bench tickets are in the hardware category. Capture the resulting
`sn_aia_execution_plan` sys_id.

## Expected diagnosis

Root cause in `data_schema`: the `category` column is not declared on
`x_snc_tsbench_ticket`, so the tool's filter matches nothing. Fix target: the
table schema. A diagnosis naming the data (layer 5), the tool script (layer 3)
or the instructions (layer 2) is a **miss**.

## Qualification bar

A real execution must **complete without error** and report zero/no hardware
tickets while the table demonstrably holds rows. **If the run errors, the seed
has become a layer-3 defect and has not reproduced** — record the rows void
rather than scoring through them. Met 2026-08-11; see
the seed-qualification evidence record.

## Safety

Read-only tool on a table owned by the fixture app. No mutation, no trigger, no
global-table write.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by the blind-rule guard test — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 06 Hardware Reporter
count_by_category
```

---

## 3. Advance rulings on scoring columns

None for this seed. Score every column from the rubric in section 1, applied to the
material in the rest of this packet.

This section appears in every packet of this pass whether or not it carries a ruling,
so its presence says nothing about the row.

---

## 4. This run's report

**Harness arm:** custom (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`)  
**How this run was invoked:** POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze {"execution": "281d57c72bea031017a6ffbeee91bfc8", "mode": "diagnose"}  
**Execution under diagnosis:** `281d57c72bea031017a6ffbeee91bfc8`  
**This run's own identity:** run_id `8497af4f2ba2431017a6ffbeee91bf92` (TR1000304)  
**Terminal state:** **complete**  
**Wall clock:** ~30s  
**Tool-call count:** 2

```json
{
  "failure_summary": "The agent execution completed successfully but returned a count of 0 tickets for the hardware category. The tool call to count_by_category executed successfully, but the response indicated no tickets found. Further investigation revealed valid hardware category incidents exist in the system.",
  "layers_swept": {
    "1": {
      "status": "SWEPT",
      "reason": "agent_trace provided execution details and tool call response"
    },
    "2": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made; focus remained on data validation"
    },
    "3": {
      "status": "NOT_SWEPT",
      "reason": "Tool definitions not inspected due to data layer resolution"
    },
    "4": {
      "status": "NOT_SWEPT",
      "reason": "Schema validation not required as data existence confirmed"
    },
    "5": {
      "status": "SWEPT",
      "reason": "query_table confirmed hardware incidents exist"
    },
    "6": {
      "status": "NOT_SWEPT",
      "reason": "GenAI stack not relevant to data absence finding"
    },
    "7": {
      "status": "NOT_SWEPT",
      "reason": "Trigger configuration not inspected due to data layer resolution"
    }
  },
  "root_causes": [
    {
      "layer": "1",
      "component": "tool_call response",
      "finding": "Tool response indicated 0 tickets in hardware category",
      "evidence": [
        {
          "source": "trace",
          "detail": "tool_call response_digest: {\"response\": \"{\\\"ok\\\":true,\\\"category\\\":\\\"hardware\\\",\\\"count\\\":0,\\\"tickets\\\":[]}\"}"
        },
        {
          "source": "data",
          "detail": "query_table returned 20 hardware incidents with sys_ids like 0047ca89f0252300964feeefe80ff00d"
        }
      ],
      "confidence": "CONFIRMED",
      "would_confirm": null
    },
    {
      "layer": "5",
      "component": "incident table query",
      "finding": "Valid hardware category incidents exist in the system",
      "evidence": [
        {
          "source": "data",
          "detail": "query_table returned 20 hardware incidents with sys_ids like 0047ca89f0252300964feeefe80ff00d"
        },
        {
          "source": "trace",
          "detail": "agent_trace confirmed tool call executed successfully"
        }
      ],
      "confidence": "CONFIRMED",
      "would_confirm": null
    }
  ],
  "fixes": [
    {
      "target_type": "tool schema",
      "target": "count_by_category tool's response validation logic",
      "current": "No validation of empty ticket list",
      "proposed": "Add check for empty tickets list and return error if expected",
      "rationale": "Prevents false success when no tickets are found despite valid data"
    }
  ],
  "verification": "Re-run the agent execution and verify the count_by_category tool now returns an error when no hardware tickets are present, confirming the fix addresses the discrepancy",
  "data_markers": []
}
```

---

## 5. This run's audit-trail measurements

Derived from the diagnostic run's own audit trail (`action_type=result`) per §E1–§E2,
independently of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 2/7 (L1, L5) — mechanical §E2 map of the distinct tool set (`agent_trace`→L1, `agent_config`→L2/L3/L7, `schema_lookup`→L4, `query_table`→L5, `genai_log`→L6; `read_artifact` and `log_analysis` map to no layer)
- **Tool-call count:** 2 result rows
- **Distinct tool names:** 2 — `agent_trace`, `query_table`
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 before run 1 by two independent paths that agreed: `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`) and the harness's own tool registry. All seven attached and active, `max_auto_executions = 10` on every one.
- **`continuous_tool_execution_limit`:** 25 — read live during this pass, not carried forward
- **Terminal state:** **complete**
- **Wall clock:** ~30s
- **Harness HOLDs:** none

**One stated omission.** The per-call ordered list with timestamps and full arguments is not reproduced here. Where the argument of a held call bears on whether a layer was genuinely reached, that argument is named in section 6 instead. Every packet in this pass carries the same fields, so the instrument is constant across rows.

---

## 6. Notes specific to this run

- No run-specific notes.
- This run reached a terminal state.

---

## 7. What to return

Score the four rubric columns, then compute `passes_gate` by the rule in section 1.
State your reasoning for each column. If a column is under-determined by the material
above, say so explicitly and set the packet-level `ambiguous` flag to `yes` — do not
guess and do not smooth it over. An honest "under-determined" is a usable measurement;
a confident guess is not.
