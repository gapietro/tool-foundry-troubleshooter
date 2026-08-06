# Row 03 — scoring reasoning

**Seed:** 03 (missing data) · **Arm:** native (Agent Doctor) · **Run:** 1
**Source packet:** `benchmark/scoring-v9/row-03-native-seed-03-run-1.md` (read in isolation; no
other file consulted, per the blind-scoring constraint)

**Score:** rcl=2 · ftc=2 · ev=1 · fix=1 · **total 6/6** · passes_gate=**yes** · void=**no** ·
ambiguous=**yes** (two flags, both resolved in the run's favour; reasoning below)

---

## Seed expectations (from packet §2)

- Expected root-cause layer: `data` (layer 5)
- Expected fix target: **data seeding**
- Explicit miss condition: *"A diagnosis naming the tool or the query is a miss, and the
  scorecard should record it as one."*
- Fixture state verified: `lookup_routing_rule` returns
  `{ok:true, matched:false, category:"Hardware", rules_in_table:0}`, where `rules_in_table` is a
  measured `GlideAggregate` count, not a constant.

---

## A3 void check — first, because it gates everything else

§A3 lists exactly two known void conditions, both seed-specific: **seed 5** (both activation
gates off / trigger fails to fire) and **seed 4** (capability sys_id mismatch). This is seed 3;
neither condition is defined for it. The packet's own fixture note confirms the seed was in the
state its spec requires — the routing table was empty and the tool reported a *measured* zero
count, which is precisely the seeded defect. The run itself completed
(`sn_aia_execution_plan.state = completed`, `state_reason` empty), swept 7/7 layers per the
audit trail, and produced a report.

Two irregularities in §5 were considered and rejected as void triggers:

1. The `x_snc_troubleshoot_run` anchor was left at `status: running`. This is a bookkeeping
   defect in the *harness's own* record, not evidence that the seed was mis-staged. §A3 defines
   voidness as *"the seed was not in the state its spec requires"* — the anchor record is not
   part of the seed.
2. The report's `syslog` caller-restriction claim is unverified prose (§5, third bullet). It
   concerns a layer *outside* the seed's defect (platform logs), the report discloses the gap
   honestly rather than papering over it, and the audit trail independently records `log_analysis`
   as executed. Not a void condition, and not a scored column.

**Void = no.** Score all four columns.

## `root_cause_layer_correct` — 2

The report's Root Cause 1 is labelled **PRIMARY**, layer **"5 — Data"**, component
`x_snc_tsbench_routing`, finding "the table exists and is structurally correct, but contains
**zero rows**." The Failure Summary states it unambiguously: *"the agent produced no routing
answer because the routing table contains zero rows. The defect is missing seed data, not a code
or configuration error."* This is exactly the seed's expected layer, named as the primary cause
and not hedged.

Notably, the report also passes the discrimination test the seed is built around — *"the data is
absent" vs "the read failed."* Layer 5 in the sweep table reads "Table is **genuinely empty** —
0 rows confirmed without ACL filtering", and Root Cause 1's evidence cites
`read_status: empty`, `unfiltered_row_count: 0`, `verdict: genuinely_empty`. It did not confuse
an empty table with an ACL-denied read (the R-6/R-11 failure mode named in the spec), and it
cross-checked the runtime tool result against an independent diagnostic read.

**Ambiguity flag 1 — do Root Causes 2 and 3 trigger the spec's miss condition?** The report
lists two additional root causes at layer 3 (tool definitions): `category` not marked mandatory,
and a thin tool description. The seed spec says a diagnosis "naming the tool or the query is a
**miss**." Read literally and in isolation, that sentence could be stretched to condemn any
mention of the tool at all.

I resolved this **in the run's favour**, for three reasons. (a) Context: the sentence directly
follows *"Root cause in `data`… Fix target: data seeding, not the tool or the instructions"* — it
is describing a diagnosis that *lands on* the tool instead of the data, i.e. the wrong-layer
verdict, not any reference to the tool whatsoever. (b) The report's own framing forecloses the
misreading: RC2 is tagged CONTRIBUTING with *"impact on this specific run is UNCONFIRMED…
the risk is latent"*, RC3 is tagged MINOR with *"behavioural impact in this run was nil"*, and
the summary explicitly denies a code/configuration cause. (c) The spec's "Why it is built this
way" section says a diagnosis that *blames* the tool or query "is chasing a layer that has no
defect in it" — this report does not blame them; it flags latent hygiene while attributing the
failure to data. If the intent were to penalise any layer-3 observation, the rubric would be
punishing a correct primary diagnosis for being thorough, which neither §A nor the spec
supports.

## `fix_target_correct` — 2

Fix 1: **Target type "Data"**, target `Table x_snc_tsbench_routing`, current "0 rows", proposed
"Insert at minimum one row with `category = Hardware` and `assignment_group = <correct group
name>`. Seed all categories the agent is expected to handle." Rationale: *"The tool script and
schema are correct. The only reason `matched:false` was returned is the absence of data."*

That is the expected fix target — **data seeding** — named specifically (the exact table, the
exact key field, the row shape), not merely "the right area." The 1 band ("right area, without
the specific target") does not apply and is not needed; §A's note confirms seed 5 is the only
seed with a defined partial case, and nothing here required me to invent one.

Fixes 2–4 target the tool schema, but they are explicitly bound to the CONTRIBUTING/MINOR causes
("addresses Root Cause 2/3"), not offered as the remedy for the failure. The rubric scores
whether the diagnosis *names the correct fix target*; it does. Presence of correctly-scoped
secondary hardening does not reduce the column.

## `evidence_cites_trace_and_config` — 1

The rubric requires the root cause to cite **both** the execution trace **and** at least one
config/schema source.

- **Trace:** Root Cause 1 cites the tool call response
  `{ok:true, matched:false, category:"Hardware", rules_in_table:0}` at
  `sn_aia_tools_execution` sys_id `b80c39192baa475817a6ffbeee91bf6a`, within execution plan
  `3afbf1192baa475817a6ffbeee91bf10`. Layer 1 of the sweep cites the plan state and tool-call
  count. The audit trail independently confirms `agent_trace` ran first.
- **Config/schema:** Layer 4 cites the schema — *"`x_snc_tsbench_routing` exists; columns
  `category` and `assignment_group` confirmed"* (audit trail confirms a `schema_lookup` call).
  Root Causes 2 and 3 cite the `agent_config` tools section directly: binding sys_id
  `3bacb3ef18454586b86a87f11ffaae9a`, `inputs: [{"name":"category","mandatory":false}]`,
  `sn_aia_tool` sys_id `3bd31a0be63d4e81856598dbd2c96788`, and the verbatim `description` text.

Both classes are cited with record-level identifiers, not gestured at. One narrow reading was
considered: if "root cause" means *Root Cause 1 alone*, its two evidence items are the runtime
trace and a `query_table` read — and a data read is arguably neither config nor schema. I did
not adopt that reading, because (i) the layers-swept table attached to the same diagnosis carries
the schema confirmation for the very table RC1 blames, and (ii) the column's wording ("Root cause
cites…") plainly refers to the report's root-cause analysis, which as a whole cites the agent
config and the tool schema extensively. Awarding 0 on that technicality would penalise a report
that in fact grounded itself in both evidence classes. **1.**

## `fix_usable_unedited` — 1

Gating constraint first: the rubric forbids 1 while `fix_target_correct` = 0. `ftc` = 2 here, so
the constraint is satisfied and the decoy-hole logic of §A2 (a well-formed fix aimed at the wrong
target being a no-op) does not bite — Fix 1 addresses the defect the seed actually carries, which
is the second half of the column's definition.

**Ambiguity flag 2 — the `<correct group name>` placeholder.** Fix 1 as written contains an
unfilled slot: `assignment_group = <correct group name>`. Strictly, a builder AI cannot paste
that literal string into a record; it must supply a value first. Under a maximally literal
reading of "as written, with no manual editing first," that is an edit, and the column would
score 0 — which would also drag `passes_gate` to 0 under §A2's two-term expression. This is the
single highest-leverage judgement call in the row, so I am recording it explicitly rather than
resolving it silently.

I resolved it as **1**, for these reasons:

1. **The gap is inherent to the seed, not a defect in the fix.** The defect *is* that no routing
   data exists. Which assignment group is correct for Hardware is business content that was never
   present anywhere on the instance — not in the table, not in the tool, not in the trace. No
   diagnosis, however good, could recover it. Scoring the placeholder as unusable would make this
   column unachievable-by-construction for seed 3, i.e. every possible correct answer would score
   0. A rubric column no correct answer can satisfy is not measuring the run.
2. **What the builder needs is fully specified.** Table, operation (insert), key column and its
   exact value (`category = Hardware`), the second column to populate, and the scope guidance
   ("seed all categories the agent is expected to handle"). There is no target ambiguity and no
   step the builder has to reconstruct — only a data value to choose, which is the builder's
   province.
3. **The verification section closes the loop.** It states the concrete post-fix check: re-run
   the same objective, confirm `matched:true` with `assignment_group` populated, confirm the
   agent's message carries the group name. That is an applyable-and-checkable fix, not a
   suggestion.

Had the placeholder been a *structural* unknown — e.g. "point the tool at the right table" — I
would have scored 0. It is a data-value slot in a data-seeding fix, which is a different thing.

## `passes_gate` — computed, not improvised

§A2's expression, verbatim:

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
```

`root_cause_layer_correct` = 2 ✓ · `fix_usable_unedited` = 1 ✓ → **passes_gate = 1 (yes)**.

`evidence_cites_trace_and_config` and `fix_target_correct` are not terms in the expression; both
happen to be at maximum here, so no divergence between the /6 total and the gate verdict arises
in this row.

## Total

2 + 2 + 1 + 1 = **6 / 6**.

## Ambiguity summary (rubric reproducibility)

The rubric determined every column, but two calls required interpretation rather than mechanical
application, and a different scorer could reasonably land elsewhere on the second:

| # | Ambiguity | Resolved | Impact if resolved the other way |
|---|---|---|---|
| 1 | Does the seed spec's "a diagnosis naming the tool or the query is a miss" cover *secondary* layer-3 causes explicitly marked non-causal for this run? | No — miss condition targets the wrong-layer verdict, not any mention of the tool | rcl 2→0, ftc 2→0, fix 1→0, total 6→1, gate yes→no |
| 2 | Does a `<correct group name>` placeholder in a data-seeding fix break "applied as written, with no manual editing first"? | No — the value is unrecoverable business data, and everything structural is specified | fix 1→0, total 6→5, gate **yes→no** |

Ambiguity 2 is the one worth escalating to whoever owns the rubric: the `fix_usable_unedited`
definition does not say how to treat a parameter slot that the diagnosis could not possibly fill,
and for a *data-seeding* seed that slot is unavoidable. A one-line clarification — e.g. "a
placeholder for a value not recoverable from the instance does not make a fix unusable, provided
the target and operation are fully specified" — would make this column mechanical for seed 3
instead of a judgement call that flips the gate.
