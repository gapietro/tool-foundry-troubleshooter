# Row 09 — seed 03, custom arm, run 1 — blind score

**Input:** `benchmark/scoring-v9/row-09-custom-seed-03-run-1.md` (read in full; nothing else read,
no searches, no shell, no web — per the blind-scoring constraint).

## Verdict

```
row-09 | rcl=0 | ftc=1 | ev=0 | fix=0 | total=1 | passes_gate=no | void=no | ambiguous=yes
```

---

## 0. Void check (§A3) — does not apply

§A3 lists exactly two known void conditions, both seed-specific: seed 5 (the
`sn_aia_trigger_agent_usecase_m2m` gate not turned on / trigger fails to fire) and seed 4
(capability sys_id mismatch). This is seed 03, whose required fixture state is simply
"`x_snc_tsbench_routing` installed with zero rows", and the packet's fixture-state note
confirms the seed was in that state (`rules_in_table: 0` as a measured GlideAggregate count,
plus §5 confirming the harness observed `rules_in_table: 0` in the trace). The seed measured
what it was built to measure.

The run also carries a harness `HOLD` at seq 4 and terminated `complete` with
`fix_report ... validated` at seq 8. A HOLD-then-validated run is not a rejected report and is
not a void condition — §A3's void rule is about seed state, not about harness interventions.
The report was ultimately accepted by the validator, so it is scored on its merits.

**void = no.** All four rubric columns are filled in.

---

## 1. `root_cause_layer_correct` — **0**

Expected (seed spec): root-cause layer `data` (layer 5).

What the report says:

- `root_causes[0].layer` = `"1"`
- `root_causes[0].component` = `"lookup_routing_rule tool call"`
- `layers_swept["5"]` = `NOT_SWEPT` — "No query_table call made to verify routing rules data"
- `root_causes[0].confidence` = `"UNCONFIRMED"`, with
  `would_confirm` = "layer 5 — query_table against routing rules table to verify data existence"

The run explicitly declares its root cause at **layer 1**, attributes it to the **tool call**,
and explicitly records layer 5 as *not swept*. Layer 5 appears only as a hypothetical next step
(`would_confirm`), i.e. as a layer the run knows it did not reach — the opposite of naming it as
the root cause.

The seed spec is unusually explicit about this exact confusion: *"Root cause in `data`: the
routing table holds zero rows. Fix target: data seeding, not the tool or the instructions. A
diagnosis naming the tool or the query is a **miss**, and the scorecard should record it as one."*
This report names the tool (`component: "lookup_routing_rule tool call"`, layer 1).

Counter-consideration, considered and rejected: the `finding` text — "0 rules found in routing
table for 'Hardware' category" — and the `failure_summary` do surface the *observation* that the
table is empty. One could argue the diagnosis "knows" the answer substantively even though it
files it under the wrong layer. I reject this because (a) the column scores whether the
diagnosis **names the expected layer**, and the layer field says `1`; (b) the report does not
merely mis-label — it actively assigns the defect to the tool call as the faulty component and
records layer 5 as unswept and unconfirmed; (c) the seed spec pre-empts precisely this reading
by declaring a tool-naming diagnosis a miss. Reporting the trace value `rules_in_table: 0` is
transcription of what the tool honestly returned (the spec notes the tool reports the empty read
deliberately), not a layer-5 attribution.

**Score: 0.** This is not the ambiguous column.

## 2. `fix_target_correct` — **1** (partial; justified per the rubric's requirement)

Expected fix target: **data seeding**.

The single fix entry:

| field | value |
|---|---|
| `target_type` | `configuration` |
| `target` | `lookup_routing_rule tool binding` |
| `current` | `unknown routing rules data source` |
| `proposed` | `validate routing rules table contains entries for 'Hardware' category` |
| `rationale` | `The tool found 0 rules, indicating missing or misconfigured routing data` |

This straddles the 0/1 boundary:

- Pulling toward **0**: the structured `target` field names the **tool binding** — a tool-layer
  target, exactly the "naming the tool" miss the seed spec calls out. `target_type` is
  `configuration`, not data. `current` is "unknown routing rules data source", i.e. the run does
  not even establish which data source is involved.
- Pulling toward **1**: the `proposed` action and the `rationale` both point at the *contents of
  the routing rules table* — "contains entries for 'Hardware' category", "missing ... routing
  data". That is the data area, and it is the area the seed's expected fix lives in. What is
  missing is the **specific target**: it never says to seed/insert rows into the routing table,
  never names the table, and hedges the diagnosis with "or misconfigured".

The rubric's partial band is defined as exactly this shape — *"1 = partial: the right area,
without the specific target"* — so I award 1. The right area (routing-rules **data**) is named
in the fix's substance; the specific target (seed rows into the routing table) is not, and the
formal `target` field points at the tool instead.

**Justification recorded here as the rubric requires** (the 1 band is only pre-defined for seed
5; for other seeds it is available but must be justified in notes).

**Score: 1.** See §5 for the ambiguity flag on this column.

## 3. `evidence_cites_trace_and_config` — **0**

The column requires the **root cause** to cite BOTH the execution trace AND at least one
config/schema source.

`root_causes[0].evidence` contains exactly two entries, and both are `"source": "trace"`:

1. `trace` — "tool_call response: 'rules_in_table':0"
2. `trace` — "execution_plan state: completed with objective unfulfilled"

No config or schema source appears in the root cause's evidence array. The run *did* make a
`schema_lookup` call (audit trail entry 2; `layers_swept["4"] = SWEPT`, "schema_lookup confirmed
'assignment_group' exists on incident table"), but that finding is recorded in the
`layers_swept` block, not cited as evidence for the root cause — and on its face it is about
`incident.assignment_group`, unrelated to the routing-table defect. The column scores what the
root cause cites, and the root cause cites trace only.

**Score: 0.**

## 4. `fix_usable_unedited` — **0**

Two independent reasons, either sufficient:

1. **It is not applicable as written.** The proposed fix is *"validate routing rules table
   contains entries for 'Hardware' category"* — an instruction to **verify**, not a change a
   builder AI can apply. It names no table (`current` is literally "unknown routing rules data
   source"), no rows, no artifact, no Fluent definition. A builder receiving this has to first
   go find out what the data source is, then decide what to insert. That is manual editing
   before application, which the column excludes.
2. **It does not squarely address the seeded defect.** The rationale hedges — "missing **or
   misconfigured** routing data" — and the whole fix is filed under a tool-binding target while
   the actual defect is zero rows in `x_snc_tsbench_routing`. The run itself marks its root
   cause `UNCONFIRMED` and its layer 5 `NOT_SWEPT`.

The rubric's cross-column constraint (`fix_usable_unedited` may not be 1 while
`fix_target_correct` is 0) does not bind here, since I scored `fix_target_correct` = 1; the 0 is
reached on the column's own terms. Note the reverse implication is not asserted by the rubric —
a partial (1) fix target does not entitle the fix column to 1.

**Score: 0.**

## 5. Total, gate, and the ambiguity flag

**Total = 0 + 1 + 0 + 0 = 1 / 6.**

`passes_gate`, computed from the exact §A2 expression and nothing else:

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
            = 1  iff  0 == 2 AND 0 == 1
            = 0
```

**`passes_gate` = 0 (no).** `fix_target_correct` and `evidence_cites_trace_and_config` are
recorded but, per §A2, are not terms in the expression.

### Ambiguity flag — `ambiguous = yes`

**Which column:** `fix_target_correct`, at the 0-vs-1 boundary.

**Why the rubric does not determine it.** The rubric defines the 1 band as "the right area,
without the specific target", and says explicitly that seed 5 is the only seed with a
pre-defined partial case; for all others, 1 "must be justified in `notes` if used". It gives no
test for what counts as "the right area" when a fix entry is **internally inconsistent** — as
this one is: its structured `target` names a tool-layer object while its `proposed` action and
`rationale` name the data. The rubric does not say whether the `target` field or the fix's
substance governs. Seed 03's own spec adds pressure in the 0 direction ("a diagnosis naming the
tool ... is a miss") but that sentence is written about the **diagnosis/root cause**, not about
the fix-target column, so it does not settle the question either.

**How I resolved it and why:** I awarded **1**. The partial band exists precisely to stop the
scorer rounding arbitrarily when a run gets the area but not the target, and that is a fair
description of this fix — it does direct attention at the routing table's contents, which is the
data area, while failing to name the seeding action or the table. Scoring it 0 would treat a fix
that gestures at the data identically to one that talks only about the tool schema, which the 1
band was added to avoid.

**Blast radius: none on the gate.** Under either resolution (`ftc` = 0 or 1),
`fix_usable_unedited` = 0 and `root_cause_layer_correct` = 0, so `passes_gate` = 0 and the
verdict is unchanged. Only the /6 total moves (1 vs 0). Recording it here so the aggregator can
re-resolve it uniformly across rows if it chooses.

### Not treated as ambiguity

- The harness `HOLD` at seq 4 is not scored. It is a process observation. The rubric has no
  column for it, and the run terminated `complete` with a validated `fix_report`, so the report
  is scored as delivered. Worth flagging to the aggregator only as context: the HOLD demanded
  layer 4 be reached, the run answered it with a `schema_lookup` on `incident.assignment_group`
  — a layer-4 call that is unrelated to the routing defect and served to satisfy the ranked-layer
  requirement rather than to advance the diagnosis. That behaviour is not penalised by any of the
  four columns, which is a rubric observation, not a rubric gap.
- The audit trail (§4) and §5 confirm the report's self-declared `layers_swept` block is honest
  (2/7 swept, L1 + L4). No discrepancy between claimed and measured sweep, so no integrity
  question arises. Layer 5 — the seed's own layer — was available (`layers_available` 7/7,
  `query_table` attached and active) and was simply never called.
