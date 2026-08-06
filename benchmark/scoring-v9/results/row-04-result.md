# Row 04 — scoring reasoning

**Packet:** `benchmark/scoring-v9/row-04-native-seed-03-run-2.md`
**Seed:** 03 (missing data) · **Arm:** native (Agent Doctor) · **Run:** 2
**Scored blind:** only the packet was read. No other file, no shell, no web.

---

## 0. Void check (§A3) — first, because it gates everything else

§A3 lists exactly two known void conditions, and both are seed-specific:
Seed 5 (both activation gates off / trigger run-as failure) and Seed 4
(capability sys_id mismatch). This is **Seed 3**. Neither condition can apply.

The general void definition is "the seed was not in the state its spec requires."
The packet's own evidence says the seed *was* in the required state:

- Spec: "Add no rows to `x_snc_tsbench_routing` — the emptiness is the defect."
- Run: the tool returned `{"ok":true,"matched":false,"category":"Software","rules_in_table":0}`,
  and an independent `query_table` read returned `unfiltered_row_count: 0`,
  `empty_verdict: genuinely_empty`.

That is the seeded defect, present and measured. Also note the spec's 2026-08-01
correction: `rules_in_table` is now a real `GlideAggregate` count, not a constant —
so the `0` here is a measurement, which is what the seed requires to be
discoverable rather than handed over.

§5's caveats (MCP returned early; the `x_snc_troubleshoot_run` anchor left at
`running`; the unverified `syslog` caller-restriction claim) are all properties of
the *harness bookkeeping and the report's prose*, not of the seed state. None of
them is a §A3 void condition, and §A3 is explicit that void means the run tested
something other than the seeded defect. It tested the seeded defect.

**void = no.**

---

## 1. `root_cause_layer_correct` — 2

Expected root-cause layer per the seed spec: **`data` (layer 5)**.

RC-1 is titled "Routing table is empty", `Layer: 5 — Data`, component
`x_snc_tsbench_routing`, finding "the table contains zero rows." The Failure
Summary states it in plain language: "the failure is a missing data problem, not
a logic or configuration problem."

Exact match to the expected layer, named explicitly and by number.

**Score: 2.**

---

## 2. `fix_target_correct` — 2

Expected fix target per the seed spec: **data seeding**.

FIX-1: "Seed routing data into `x_snc_tsbench_routing`", Target type **Data**,
proposed action "Insert at minimum one row with `category = Software` and
`assignment_group = <…>`. Seed additional rows for every category the agent is
expected to handle." Rationale: "Until at least one row exists, every category
lookup returns `matched: false` regardless of any other fix."

That is the specific target, not merely the right area, so the partial band (1) is
not in play — §A defines 1 as "the right area, without the specific target."

### Ambiguity #1 — the spec's "naming the tool or the query is a miss" clause

This needs stating rather than smoothing over, because a literal reading and a
contextual reading of the seed spec diverge on this run.

The spec's Expected diagnosis says: *"Fix target: data seeding, not the tool or the
instructions. A diagnosis naming the tool or the query is a **miss**, and the
scorecard should record it as one."*

This report **does name the tool**, twice: RC-2 (`category` input not mandatory on
the `sn_aia_agent_tool_m2m` binding) and RC-3 (tool script has no input
validation), with matching FIX-2 and FIX-3, both `Target type: Tool schema`.

Read as a literal keyword rule, that clause zeroes this column. Read in context, it
does not, and I resolve it the second way, for these reasons:

1. The surrounding paragraph fixes the sense of "naming": *"A diagnosis that
   **blames** the tool or the query is chasing a layer that has no defect in it."*
   The clause is about attribution of cause, not about mentioning a table name.
2. This report attributes cause in the opposite direction, unambiguously and in
   several places: RC-1 is first and marked CONFIRMED with two independent reads;
   the Failure Summary says "The agent behaved exactly as designed"; FIX-1's
   rationale says the other fixes are irrelevant until a row exists.
3. RC-2 and RC-3 are not offered as explanations of *this* execution. RC-3 concerns
   a null/blank/mis-cased category input; the trace shows `category: "Software"`
   was in fact passed and the query ran. They are hardening findings from a
   seven-layer sweep, which is what the input prompt asked for ("Sweep all seven
   layers"). RC-4 is even self-labelled "(informational)".
4. The rubric column scores whether the diagnosis "names the correct fix target."
   It does. Nothing in §A penalises additional secondary fixes.

A rule that made any mention of the tool a miss would also punish the sweep the
harness instructs the agent to perform, and would collide with the seed's own
observation that the tool "reports the empty result honestly" — i.e. reading the
tool is part of reaching the right answer.

I record this as a genuine rubric/spec gap: the spec's miss-clause is written as a
keyword test but justified as an attribution test, and it does not say what to do
with a correct primary diagnosis carrying secondary tool findings. Resolved toward
2 on the attribution reading.

**Score: 2.**

---

## 3. `evidence_cites_trace_and_config` — 1

Requirement: the root cause cites **both** the execution trace **and** at least one
config/schema source.

- **Execution trace:** RC-1 cites the tool-call response by record —
  `sn_aia_tools_execution ec2cf5152ba6cf54f243fed2ce91bf08` →
  `{"ok":true,"matched":false,"category":"Software","rules_in_table":0}`. The
  audit trail independently confirms `agent_trace` ran as tool call #1.
- **Config/schema source:** RC-2 quotes the `sn_aia_agent_tool_m2m` binding
  `3bacb3ef18454586b86a87f11ffaae9a` `input_schema` verbatim from `agent_config`;
  RC-3 quotes the `sn_aia_tool` `3bd31a0be63d4e81856598dbd2c96788` `script` body;
  RC-4 quotes the triggers section. Layer 4 of the sweep table records
  "`x_snc_tsbench_routing` table and columns confirmed" (audit trail:
  `schema_lookup` ran).

### Ambiguity #2 — "root cause" singular vs. four RCs

The column says "Root cause cites BOTH…". This report has four root causes. If the
requirement is read as applying to **RC-1 alone**, the second half is thinner:
RC-1's non-trace citation is a `query_table` read of the table's contents
(`read_status: empty`, `empty_verdict: genuinely_empty`, unfiltered count 0), which
is a data read rather than a config or schema record.

I resolve toward 1 because:

- Even under the strict RC-1-only reading, RC-1's verdict rests on the table object
  being confirmed to exist and be readable — the Layer 4 schema confirmation and
  the `schema_lookup` call in the audit trail. Distinguishing "empty" from
  "unreadable" (exactly the distinction the seed spec calls out as the instrument's
  purpose) is a schema/ACL-level claim, and the report makes it explicitly.
- The rubric's stated purpose is "the evidence rule from the diagnostic agent's own
  instructions" — i.e. don't diagnose from trace alone. This report manifestly did
  not: it read the agent instructions, the tool binding schema, the tool script,
  the table schema, the capability definition, and the trigger wiring, and quotes
  several of them verbatim with sys_ids.
- The document-level reading (the ROOT CAUSES section cites both) is satisfied
  without argument.

Flagged, resolved to 1.

**Score: 1.**

---

## 4. `fix_usable_unedited` — 1

Constraint check first: `fix_target_correct` = 2, so the §A / §A2 bar on awarding 1
while `fix_target_correct` = 0 does not bind. And the second half of the column —
"it addresses the defect the seed actually carries" — is satisfied: FIX-1 seeds the
empty table, which is precisely the seeded defect. This is the opposite of the R-22
decoy pattern §A2 describes; the fix is aimed at the real break, and the report even
says the other fixes are inert until it is applied.

### Ambiguity #3 — the `<the correct group name>` placeholder

FIX-1 reads: "Insert at minimum one row with `category = Software` and
`assignment_group = <the correct group name>`."

`<the correct group name>` is an unfilled slot. Strictly, a builder AI must choose a
value before executing, which is a form of editing. This project treats placeholders
seriously elsewhere — §A3's Seed 4 void condition is literally an unsubstituted
`REPLACE_WITH_…` placeholder.

I resolve toward 1:

- That Seed 4 precedent is about **install validity** (a placeholder that silently
  installs as a dangling reference and voids the measurement), not about whether a
  fix instruction is actionable. Different question.
- For a *missing data* seed, the content of the missing data is not derivable from
  any diagnostic evidence. The table is empty; there is no record of what group
  "Software" should route to. No correct diagnosis could have supplied that value,
  so requiring it would make this column unachievable for this seed by construction
  — which cannot be the rubric's intent, given the seed's expected fix target *is*
  data seeding.
- Everything the diagnosis could determine, it did determine and state concretely:
  the exact table, the exact operation (insert), the exact value of the field the
  trace revealed (`category = Software`), the minimum row count, and the scaling
  rule ("seed additional rows for every category the agent is expected to handle").
- FIX-2 and FIX-3 are independently applicable as written — FIX-2 gives the complete
  replacement JSON, FIX-3 gives the complete code snippet — and the report supplies
  a four-step VERIFICATION procedure tied to re-running the same objective.

Flagged, resolved to 1.

**Score: 1.**

---

## 5. Total and gate

```
root_cause_layer_correct       2
fix_target_correct             2
evidence_cites_trace_and_config 1
fix_usable_unedited            1
                              ---
total                          6 / 6
```

§A2 expression, applied verbatim:

```
passes_gate = 1  iff  root_cause_layer_correct == 2 AND fix_usable_unedited == 1
```

2 == 2 ✓ and 1 == 1 ✓ → **passes_gate = 1 (yes)**.

`evidence_cites_trace_and_config` and `fix_target_correct` are recorded but,
per §A2, are not terms in the expression.

---

## 6. Things I deliberately did **not** let influence the score

- **Presentation quality.** The report is well-structured with tables and sys_ids.
  Judged on evidence: the evidence happens to be there, but the formatting earned
  nothing.
- **Layer-sweep completeness.** 7/7 layers swept (audit-trail-derived) is not a
  rubric column.
- **Effort proxies.** 16 tool calls, 8 LLM calls, 3 m 37 s wall clock — not scored.
- **§5's unverified `syslog` claim.** The packet flags that the caller-restriction
  claim is the run's own prose, unverified by the operator. It appears in the
  "Platform logs — UNAVAILABLE" row, which is *not* one of the seven layers and not
  load-bearing for any RC or FIX. It does not touch RC-1's evidence. If it were
  false, it would be a minor accuracy defect in a non-scored row of a summary table.
  No column penalises it.
- **The stalled `x_snc_troubleshoot_run` anchor** (§5) — harness bookkeeping, not a
  property of the diagnosis or the seed state.
- **RC-4 and the trigger finding.** Correctly self-labelled informational; the seed
  spec's "Also stresses" field is empty, so nothing here was under test.

## 7. Ambiguities, consolidated (as required)

Three, all flagged above, none silently resolved:

1. **Seed spec's "a diagnosis naming the tool or the query is a miss"** — literal
   keyword reading would force `fix_target_correct` = 0; the surrounding text's
   "blames the tool" framing would not. Resolved on the attribution reading
   (→ 2), because the spec's own justification paragraph is written in terms of
   blame, and the harness prompt mandated a seven-layer sweep that necessarily
   inspects the tool. **This is the one that could flip the row's `fix_target_correct`
   under a different scorer — but note it would *not* flip `passes_gate`, since
   §A2 excludes that column; it would drop the total to 4/6 and, via the §A
   constraint, would additionally force `fix_usable_unedited` to 0, which *would*
   flip the gate. So this ambiguity is gate-material and should be resolved in the
   spec text.**
2. **"Root cause cites BOTH"** with four root causes present — per-RC vs.
   document-level reading. Resolved document-level (→ 1); RC-1 alone is defensible
   too but thinner.
3. **`<the correct group name>` placeholder in FIX-1** vs. "applied as written, with
   no manual editing." Resolved to 1, on the ground that the missing datum is
   business content no diagnosis could recover, and requiring it would make the
   column unachievable for this seed by construction.

**ambiguous = yes.**
