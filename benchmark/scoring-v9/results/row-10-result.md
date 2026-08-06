# Row 10 — scoring reasoning

**Packet:** `benchmark/scoring-v9/row-10-custom-seed-03-run-2.md`
**Seed:** 03 (missing data) · **Arm:** custom · **Run:** 2
**Scored from the packet only.** No other file, directory, command or network source was consulted.

---

## 0. Void check (§A3) — first, because it gates everything else

§A3 lists exactly two known void conditions, both seed-specific: **Seed 5** (both
activation gates off / trigger fails to fire) and **Seed 4** (capability sys_id in the
installed `sn_aia_tool.script` not matching the target instance's
`sys_one_extend_capability` record). This row is **Seed 03**, so neither named condition
can apply.

The general definition — "the seed was not in the state its spec requires" — also does not
apply. The seed spec carries a dated fixture verification (2026-08-02, execution
`c4cd01842b6a4bd417a6ffbeee91bfc3`) showing `lookup_routing_rule` returning
`{ok: true, matched: false, category: "Hardware", rules_in_table: 0}` with `rules_in_table`
as a measured `GlideAggregate` count. The required state is *table empty*, and the run's
own trace evidence (`'rules_in_table': 0`) is consistent with that state. The run reached a
terminal `complete` status with an empty `error` and a `fix_report` the harness validated at
seq 8.

**void = no.** All four rubric columns are therefore scored.

Note on the harness HOLD at seq 4: a HOLD is an in-run refusal of a premature terminal
action, and the run continued past it to a validated `fix_report`. §A3's void rule is about
*seed state*, not about in-run harness interventions, and the packet gives no rule making a
HOLD void or otherwise disqualifying. I did not treat it as one.

---

## 1. `root_cause_layer_correct` — **0**

Expected root-cause layer per the seed spec: **`data` (layer 5)**.

What the report names:

- `root_causes[0].layer` = `"1"`
- `root_causes[0].component` = `"lookup_routing_rule tool call"`
- `layers_swept["5"].status` = `"NOT_SWEPT"`, reason `"No query_table call made to verify rules exist"`
- `root_causes[0].confidence` = `"UNCONFIRMED"`, `would_confirm` = `"layer 5 — query_table against routing rules table to verify rule existence"`

The declared layer is 1, not 5. The seed spec is explicit about this being a miss:
*"A diagnosis naming the tool or the query is a **miss**, and the scorecard should record it
as one."* The report's `component` names the tool call precisely — `lookup_routing_rule tool
call` — and locates the root cause at layer 1.

**Considered and rejected:** crediting the layer on substance rather than on the declared
field. The `failure_summary` and the `finding` both describe an absence of rules, which is
the data condition in plain language. But the rubric column asks whether the diagnosis
*names the expected root-cause layer*, and the report has an explicit `layer` field that
answers that question directly with `"1"`. The report also self-reports layer 5 as
NOT_SWEPT and defers the data-layer confirmation to future work — it does not claim the data
layer, it says it did not reach it. Reading `"1"` as `"5"` would be substituting my own
judgment for the run's stated diagnosis. Scored **0**.

## 2. `fix_target_correct` — **2**

Expected fix target per the seed spec: **data seeding** ("Fix target: data seeding, not the
tool or the instructions").

The report's single fix:

```
target_type: "data"
target:      "assignment group rules for Software category"
current:     "0 rules found"
proposed:    "Create at least one valid assignment group rule for Software category"
```

This is data seeding, named as such (`target_type: "data"`), pointed at the routing rules
the empty table is supposed to hold, and proposing insertion of rows. It does not blame the
tool, the query or the instructions. The rubric's enumerated targets are *tool schema /
instruction text / data seeding / capability mapping / activation*; this is unambiguously the
data-seeding one.

**Considered and rejected: 1 (partial).** The partial band is for "the right area, without
the specific target". The fix does not name the table (`x_snc_tsbench_routing`) — but that
string is on the seed's blind-rule token list, i.e. it is deliberately withheld from the
diagnostic agent, so its absence cannot be the missing specificity the partial band is
about. The fix identifies *what data is missing* (routing rules mapping a category to an
assignment group) and *what to do about it* (create at least one). That is the specific
target, not merely the right area. Scored **2**, so no partial-credit justification is
required.

**Note on the rcl=0 / ftc=2 split.** This run names the wrong layer while naming the right
fix target. The rubric permits that combination — the only cross-column constraint it states
runs from `fix_target_correct` to `fix_usable_unedited`, not from `root_cause_layer_correct`
to anything. §A2 explicitly anticipates and endorses non-monotonic rows ("A run can score
3/6 and pass; a run can score 4/6 and fail... it is the gate asking a narrower question than
the rubric"). I did not smooth the split.

## 3. `evidence_cites_trace_and_config` — **0**

The rule: root cause cites **both** the execution trace **and** at least one config/schema
source.

`root_causes[0].evidence` contains exactly two entries, and both are `"source": "trace"`:

1. `trace` — `"tool_call response: 'rules_in_table': 0"`
2. `trace` — `"execution_plan state: completed with objective unfulfilled"`

No config or schema source appears in the root cause's evidence. The run *did* make a
`schema_lookup` call (audit trail, 03:03:30, `incident.assignment_group`) and reports layer 4
as SWEPT on that basis — but the rubric scores what the **root cause cites**, not what the
run touched. The schema result is never carried into the evidence array. Trace-only citation
fails the "BOTH" requirement. Scored **0**.

## 4. `fix_usable_unedited` — **1**

Two tests in the column definition:

**(a) Does it address the defect the seed actually carries?** Yes. The seed's defect is
`x_snc_tsbench_routing` installed with zero rows; the fix is to insert routing rules. The
§A2 constraint (`fix_usable_unedited` may not be 1 while `fix_target_correct` = 0) is not
triggered here — `fix_target_correct` = 2 — and this is not the R-22 decoy shape §A2 was
written to close, because the proposed action would in fact repair the seeded defect rather
than being a well-formed no-op.

**(b) Could the builder AI apply it as written, with no manual editing first?** Judged yes,
but this is the row's genuinely close call — see §6 below. The fix specifies the record type
to create (an assignment-group routing rule), the category value (`Software`), the quantity
(at least one), and a verification step (`re-run and verify lookup_routing_rule returns a
non-zero rules_in_table`). What it leaves open is which assignment group to point the rule
at. The seed spec does not constrain that either — the table is empty by design and nothing
in the app inserts into it, so *any* valid rule satisfies the defect. A gap the seed itself
leaves open is not a gap that forces a human to edit the fix before handing it over.

Scored **1**.

## 5. Total and gate

| Column | Score |
|---|---|
| `root_cause_layer_correct` | 0 |
| `fix_target_correct` | 2 |
| `evidence_cites_trace_and_config` | 0 |
| `fix_usable_unedited` | 1 |
| **Total** | **3 / 6** |

§A2's expression, applied literally and without improvisation:

```
passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1
            = 1 iff (0 == 2) AND (1 == 1)
            = 1 iff false AND true
            = 0
```

**`passes_gate` = 0 (no).** The first term fails. `fix_target_correct` = 2 and
`evidence_cites_trace_and_config` = 0 are diagnostic detail and do not enter the expression,
per §A2.

---

## 6. Ambiguity flagged — `fix_usable_unedited`

**The gap.** The rubric defines `fix_usable_unedited` as "could be applied by the builder AI
as written, with no manual editing first", but sets no specificity threshold. It does not say
whether a fix must supply concrete field values to clear the bar, or whether naming the record
to create and the discriminating value is enough. This row sits directly on that line: the fix
names *what* to create and *for which category*, but not the table and not the assignment
group the rule should point at, so the builder would have to supply at least one value the
fix does not state.

**How I resolved it, and why.** I scored **1**. Two reasons. First, the unstated values are
unconstrained by the seed itself — the table is empty by design, so no particular assignment
group is "the right answer" that the fix failed to identify; there is nothing for a human to
correct. Second, the table name is a blind-rule token deliberately withheld from the
diagnostic agent, so scoring its absence as a usability defect would penalise the run for the
benchmark's own instrumentation.

**Blast radius: none.** The gate expression fails on `root_cause_layer_correct` = 0
regardless of how this column resolves, so `passes_gate` = 0 under either reading. The
ambiguity moves the /6 total between 2 and 3 and nothing else.

**Not ambiguous, for the record:** `root_cause_layer_correct` (the report declares
`layer: "1"` and the seed spec explicitly calls naming the tool a miss),
`fix_target_correct` (`target_type: "data"` matches the expected "data seeding" exactly),
`evidence_cites_trace_and_config` (both evidence entries are literally `source: "trace"`),
and the void determination (§A3's conditions are seed-4/seed-5 specific and the fixture state
is verified in the spec).

---

## 7. What I did not let influence the score

- **Presentation.** The report is well-structured, honest about its own coverage
  (5 of 7 layers self-declared NOT_SWEPT), and correctly flags its root cause as
  `UNCONFIRMED` with the right next step. That candour is creditable behaviour and
  earns nothing here — the rubric scores whether the layer named is correct, and it is not.
- **Thinness.** 2 tool calls, 2/7 layers swept, 20 s wall clock. The rubric has no
  coverage or effort column; sweep breadth is not scored.
- **The near-miss.** `would_confirm` points at exactly the right layer (5) and the fix lands
  on exactly the right target. The run was one `query_table` call from a correct diagnosis.
  It did not make that call, and "almost reached layer 5" is not "named layer 5".
