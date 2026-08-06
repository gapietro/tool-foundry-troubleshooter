# Row 07 — seed 01, custom arm, run 1 — scoring reasoning

**Input:** `benchmark/scoring-v9/row-07-custom-seed-01-run-1.md` (read in full; nothing else read,
per the blind-scoring constraint).

**Run identity:** run_id `c5e7421d2baacf54f243fed2ce91bfc0`, execution under diagnosis
`4a5bb19d2b66cf54f243fed2ce91bf57`, terminal state `failed`, `fix_report` = `null`
(rejected body scored from §3).

---

## What the seed expects (packet §2)

- **Expected root-cause layer:** `tool_schema` (layer 3). A layer-4 answer *also* scores full
  marks **only if** it states the disagreement — "the column is Integer-typed and the tool sends
  a word". The scoring note is explicit: "A run naming only one side *without* the disagreement
  … scores 0. The finding is the mismatch, not either half."
- **Expected fix target:** the tool's **word-typed contract** — map the word to its integer
  inside the script before `setValue`, or change the tool description + agent instructions to
  pass 1–5.
- **Expected evidence:** the trace showing `priority_stored` disagreeing with
  `priority_requested`, plus the `x_snc_tsbench_ticket.priority` dictionary entry showing
  `internal_type=integer`.

## What the run actually said (packet §3)

- `failure_summary`: the tool call "failed to store the priority value due to a **missing table
  reference in the system schema**".
- `root_causes[0]`: layer **4**, component **`sn_tsbench_bench_ticket` table**, finding **"Table
  does not exist in the system schema"**, confidence CONFIRMED.
- `fixes[0]`: target `set_ticket_priority` tool's input schema; proposed **"Update ticket field to
  reference valid table (e.g., incident)"**.
- Audit trail (§4) corroborates: 3 tool calls, the third being
  `schema_lookup` on `sn_tsbench_bench_ticket` — a table name that is not the seed's table
  (`x_snc_tsbench_ticket`). The lookup returned absence, and the run treated that absence as the
  root cause.

---

## Column-by-column

### `root_cause_layer_correct` — **0**

The run declares layer 4, which the seed's M18 scoring note *can* accept — but only when the
layer-4 answer "describes the same finding from the other side and identifies the same fix",
i.e. Integer-typed column vs. word-valued write. This run describes neither half of the
mismatch. Its finding is that a **table does not exist**, which is (a) about a table name that
appears nowhere in the seed, and (b) factually false — the seed's table is installed and was
written to. It never mentions integer typing, the word-typed priority, or any disagreement
between the tool contract and the column type.

The note's "only one side without the disagreement scores 0" clause is the *lenient* boundary;
this run does not even reach one correct side. **0.**

A purely literal reading of the §A column text ("Diagnosis names the seed's expected root-cause
layer") could award 2 for the bare string `"4"`. I reject that reading: the seed spec, which §A
defers to for the expected value, conditions the layer-4 acceptance on the finding, and the
rubric's own framing elsewhere (§A2's decoy discussion) treats naming a layer with the wrong
mechanism as a mis-score. This is not recorded as an ambiguity — the seed spec resolves it.

### `fix_target_correct` — **0**

Expected: map word → integer in the tool script, or change the tool description + agent
instructions to pass 1–5. Proposed: repoint a "ticket field" at a different table, suggesting
`incident`. Wrong area, wrong target, and actively harmful (it would move the write off the
fixture-owned table for reasons §2 records as deliberate). No partial band applies — this is not
"the right area without the specific target". **0.**

Note also that the run's fix is labelled `target_type: "tool schema"` — which coincidentally
matches the expected *layer* name — but the rubric scores the fix **target**, and the target it
names is a table reference, not the word-typed contract. Label coincidence earns nothing.

### `evidence_cites_trace_and_config` — **1** *(ambiguous; see below)*

`root_causes[0].evidence` carries two entries: `source: "schema_lookup"` (a schema citation) and
`source: "trace"` (the tool result showing `priority_stored` null). On the face of the rubric
text — "Root cause cites BOTH the execution trace AND at least one config/schema source" — both
are present, and the audit trail confirms the `schema_lookup` call was really made, so the
citation is real rather than fabricated wholesale (it is merely aimed at the wrong table).

**This is a genuine rubric gap and I am flagging it rather than smoothing it.** The harness
validator rejected exactly this block, and its verbatim text reads: *"evidence rule violation —
evidence cites only the trace; at least one config, schema, or data citation is required"* — it
discarded the schema entry because the source string `"schema_lookup"` is not in the allowed enum
(`trace`, `config`, `schema`, `data`). Since §A ties this column to "the evidence rule from the
diagnostic agent's own instructions", and the validator is the mechanical implementation of that
rule, a defensible alternative reading scores this **0**.

**How I resolved it and why:** 1. The disqualifying defect is a JSON enum spelling
(`schema_lookup` for `schema`), not a diagnostic omission; the scorer's brief is to judge
diagnostic content on its merits, and the substance — a trace citation plus a schema-lookup
citation — is present. The rubric's own wording asks what the root cause *cites*, not whether the
citation is well-formed for the validator. Recording this as 1 also isolates the formatting
failure into the column that already captures it (`fix_usable_unedited`, and the `failed`
terminal state) rather than double-counting it.

**Consequence of the ambiguity: none for the gate.** §A2 excludes this column from the gate
expression, so under either reading `passes_gate` is unchanged; only the /6 total moves (1 vs 0).

### `fix_usable_unedited` — **0**

Two independent reasons, either sufficient:

1. §A's explicit constraint: `fix_usable_unedited` may not be 1 while `fix_target_correct` = 0.
   It is 0, so this is 0. The §A2 decoy discussion drives the same conclusion — a well-formed fix
   aimed at the wrong target is a no-op, not a usable fix.
2. Materially, `fix_report` is `null`. The harness rejected the report after its repair attempts,
   so there is no fix the builder AI could apply as written at all.

---

## Total

0 + 0 + 1 + 0 = **1 / 6**.

## `passes_gate` — computed from §A2's expression verbatim

```
passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1
```

`root_cause_layer_correct` = 0 → the conjunction is false regardless of the second term
(which is also 0). **`passes_gate` = 0 → "no".**

## §A3 void check — does not apply

§A3 voids a run when "the seed was not in the state its spec requires, so the run tested
something other than the seeded defect". The two named void conditions are seed-5 and seed-4
specific and do not apply here. For this row the seed was in the state its spec requires: the
execution ran, and the very trace the run read reports `priority_stored` as null — the seed's
measured signature per §2. The run failed for its own reasons (a mis-targeted `schema_lookup`,
a self-declared NOT_SWEPT block that drew a harness HOLD at seq 4, and a report that failed
validation), which are properties of the diagnostic run, not of the fixture state. §5 confirms
the run reached a terminal state and was not retried under the execution brief.

Scoring a run 0 for failing at diagnosis is exactly what the rubric is for; voiding it would
hide a real miss. **void = no.**

## Ambiguity flag

**Yes — one column.** `evidence_cites_trace_and_config`, as detailed above: the rubric does not
state whether a validator-rejected evidence block still counts as a citation when the only defect
is a non-enum `source` string. Resolved as **1** (substance over enum well-formedness), with the
alternative (0, deferring to the validator's implementation of the same rule) recorded. No gate
impact either way; /6 total would be 0 under the alternative reading.
