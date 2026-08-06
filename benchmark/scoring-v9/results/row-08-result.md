# Row 08 — seed 01, custom arm, run 2 — scoring reasoning

**Input:** `benchmark/scoring-v9/row-08-custom-seed-01-run-2.md` (read in full; nothing else consulted).

---

## 0. Void check (§A3) — first, because it gates everything else

§A3 defines void as "the seed was not in the state its spec requires, so the run tested
something other than the seeded defect," and enumerates two known void conditions, both
belonging to **seed 5** and **seed 4**. This is seed 1. Nothing in the packet suggests the
fixture was mis-seeded: §2's fixture note says the seed is installed, executed, and its
mechanism confirmed by measurement (`priority_stored = null`), and this run's trace shows
`set_ticket_priority` returning exactly the `priority_stored: null` the spec predicts.

The run's terminal state is `failed`, but that is a **harness validator rejection of the
report**, not a seed-state problem. §3 says explicitly "A rejected report is still scored —
this is the only record of what the model produced," and §5 repeats it. The instrument
measured the seeded defect; the model simply diagnosed it badly. That is a miss, not a void.

**void = no.**

---

## 1. `root_cause_layer_correct`

**Expected (§2):** layer 3 `tool_schema`. §2's "Scoring note — layers 3 and 4 (M18)" widens
this in one specific way and narrows it in another:

- full marks for `tool_schema` (layer 3);
- full marks also for "layer 4 — the column is Integer-typed **and the tool sends a word**";
- **0 for naming only one side *without* the disagreement** — "the finding is the mismatch,
  not either half."

**What the run named.** `root_causes[0].layer` = **"1"**, component "set_ticket_priority tool
response", finding "priority_stored field is null despite successful execution". The three
remaining root causes are layers 6, 5 and 7, and none of them is a finding at all — each is a
statement that the run did not look at that layer ("No evidence of GenAI stack inspection",
"No verification of ticket data", "No inspection of trigger configuration"). Layers 3 and 4 are
declared NOT_SWEPT / SWEPT-but-clean respectively; the run's own `layers_swept` block records
layer 3 as **NOT_SWEPT** ("No agent_config call made to inspect tool definitions"), and the
audit trail in §4 confirms it mechanically — 2/7 layers swept, and the only schema call was
`incident.priority`.

So the run names **layer 1**, which is neither of the two accepted answers.

Could the layer-4 escape hatch rescue it? No, on two counts:

1. The run's layer-4 sweep concluded the schema was **fine** — "schema_lookup confirmed
   incident.priority exists and is valid", and the evidence line reads "incident.priority
   exists as an integer field with valid choices". That is the opposite of identifying an
   integer-typed column as one half of a mismatch; it is clearing the schema.
2. Even reading generously — "integer field" appears in the text, adjacent to a null
   `priority_stored` — the finding never states the disagreement. Nowhere does the report say
   the tool sends a *word* to an integer column, or that `'critical'` is not an integer, or
   that the requested and stored values disagree in kind. Its causal story is "the update may
   not have persisted" and "no confirmation of the stored priority was recorded" — a symptom
   restatement and a *logging* complaint. §2's scoring note disposes of exactly this case:
   one side without the disagreement scores 0.

A third, independent problem: the schema it inspected is `incident.priority`, not
`x_snc_tsbench_ticket.priority`. §2 records that this seed deliberately writes to the fixture
app's own table precisely so the diagnosis lands on the tool contract rather than on a scope
boundary. `incident.priority` genuinely *does* have choices; the seeded column measures
`has_choices: false`. So the one schema fact the report cites is true of a table that is not in
this execution — it is not weak evidence for the right conclusion, it is evidence about the
wrong object that happens to look reassuring.

**`root_cause_layer_correct` = 0.**

---

## 2. `fix_target_correct`

**Expected (§2):** the tool's **word-typed contract** — either map the word to its integer
inside the script before `setValue`, or change the tool description + agent instructions to
pass 1–5. §2 explicitly forbids scoring against "constrain the input schema to 1–5", since
Fluent script-tool inputs have no `type` property.

**What the run proposed.** Three fixes:

| # | target_type | target | proposed |
|---|---|---|---|
| 1 | tool schema | `set_ticket_priority` tool's **response validation logic** | "ensure priority_stored reflects the actual database value" |
| 2 | configuration | agent_config calls for trigger wiring | add an `agent_config` call |
| 3 | data | ticket record validation | add a `query_table` call |

Fixes 2 and 3 are not fixes to the seeded system at all — they are instructions to the
*diagnostic agent* to call more tools. They target the troubleshooter's own sweep coverage, not
the builder's artifact. They contribute nothing here.

Fix 1 is the only candidate. It gets three things right and one thing wrong:

- right tool (`set_ticket_priority`) — the tool that actually carries the defect;
- right artifact family (`target_type: "tool schema"`, which is the area bucket the rubric's
  column definition enumerates and the bucket this seed's target sits in);
- right observation feeding it (`priority_stored` is null);
- **wrong change**: it proposes making the tool's *response* honest about what was stored. It
  says nothing about mapping `'critical'` → an integer, nothing about the tool description's
  word contract, nothing about the agent instructions. Applied verbatim, the ticket's
  `priority` column would remain empty on every run; the only difference would be that the
  tool now reports the failure instead of hiding it.

**This is the row's one genuinely underdetermined column, and I am flagging it rather than
smoothing it.** The rubric defines the 1 band as "the right area, without the specific
target," and adds that seed 5 is the only seed with a defined partial case; for others, 1 "is
available but must be justified in `notes` if used." Two defensible readings:

- **1** — the literal reading. The run is in the right area (the `set_ticket_priority` tool,
  labelled "tool schema"), and it does not name the specific target (the word-typed contract).
  Right area, specific target absent. That is the band's stated condition, met.
- **0** — the purposive reading. The partial band was created for seed 5, where the model was
  *under*-specific ("inactive" without saying which of two gates). This run is not
  under-specific; it is specifically wrong — it names a target ("response validation logic")
  and that target is not the defect. Under-specification and mis-specification are different
  failures, and only the first is what the band was minted for.

I resolve to **1**, for two reasons. First, the band's written condition is the thing I am
instructed to score against, and it is satisfied on its face; the purposive argument requires
me to import an intent the rubric states only as history, not as a restriction. Second, the
rubric already has a mechanism for punishing "well-formed fix aimed at the wrong target" — §A2
puts it in `fix_usable_unedited`, not in `fix_target_correct`, and building the same penalty
into both columns would double-count it. Awarding 1 here and 0 on `fix_usable_unedited`
reproduces exactly the structure §A2 prescribes for the seed-4 decoy, one notch up.

The 1 changes nothing downstream: it is not in the gate expression, and (see §4 below)
`fix_usable_unedited` is 0 on its own merits, not because the ftc=0 constraint forced it.

**`fix_target_correct` = 1** (justified above, as the rubric requires).

---

## 3. `evidence_cites_trace_and_config`

**Column text:** "Root cause cites BOTH the execution trace AND at least one config/schema
source."

`root_causes[0]` carries exactly two evidence entries:

- `source: "trace"` — "tool response_digest shows 'priority_stored': null";
- `source: "schema"` — "incident.priority exists as an integer field with valid choices".

Both are real. §4's audit trail confirms `agent_trace` and `schema_lookup` were both invoked,
and the harness validator — which rejected three other citations for being unbacked — did
**not** flag either of these. The three rejected citations are in `root_causes[1]`, `[2]` and
`[3]`, all `source: "config"` or `source: "data"` with no corresponding tool call. The primary
root cause's citation discipline is intact.

Caveat, recorded but not scored down: the schema cited is the wrong table
(`incident.priority`, not `x_snc_tsbench_ticket.priority`). This column as written asks whether
the root cause *cites* both kinds of source, not whether the cited config is the right one —
the relevance failure is already priced into `root_cause_layer_correct` = 0. Scoring it a
second time here would be inventing a requirement the column does not state.

**`evidence_cites_trace_and_config` = 1.**

---

## 4. `fix_usable_unedited`

**Column text:** "could be applied by the builder AI as written, with no manual editing first —
**and it addresses the defect the seed actually carries.**"

Both halves fail, independently:

1. **It does not address the seeded defect.** Fix 1 changes what the tool *reports*, not what
   it *writes*. The seed's defect is that a word is passed to an Integer column and silently
   discarded; after fix 1 the word is still passed and still discarded. Fixes 2 and 3 do not
   touch the seeded artifact at all. This is precisely §A2's "perfectly well-formed and fixes
   nothing" case.
2. **It is not applicable as written even as prose.** "Ensure priority_stored reflects the
   actual database value" specifies an outcome, not a change — no mapping table, no
   `getValue` read-back, no field, no code. A builder AI would have to design the fix from
   scratch. And at the mechanical level `fix_report` is `null`: the harness validator rejected
   the report and there is no fix artifact to apply. Either of these alone is decisive.

Note that this 0 is reached on the column's own terms; the §A2 constraint ("may not be 1 while
`fix_target_correct` = 0") is not doing the work, which is what lets me award ftc = 1 above
without opening the hole §A2 was written to close.

**`fix_usable_unedited` = 0.**

---

## 5. Total and gate

```
root_cause_layer_correct       0
fix_target_correct             1
evidence_cites_trace_and_config 1
fix_usable_unedited            0
                              ---
total                          2 / 6
```

§A2's expression, applied literally:

```
passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1
```

`0 == 2` is false, so the conjunction is false regardless of the second term (which is also
false). **`passes_gate` = 0 → "no".**

Not `void` — see §0. This row counts in the denominator as a valid run and contributes 0 to the
numerator.

---

## 6. Ambiguity flag

**ambiguous = yes**, on one column only: `fix_target_correct`. The rubric's 1 band is defined
in a single clause ("the right area, without the specific target") and its worked case belongs
to a different seed. This run is in the right area but proposes a specifically wrong change
inside it — a case the clause does not distinguish from under-specification. I resolved to
**1** on the literal reading, and because §A2 assigns the wrong-target penalty to
`fix_usable_unedited` rather than here. A scorer resolving to 0 would be defensible; the
resolution has no effect on `total`'s bearing on the gate (rcl = 0 already fails it) but does
move `total` between 1/6 and 2/6.

Every other column was determined by the rubric text without judgement calls: the layer answer
is settled by §2's M18 scoring note, the evidence column by an explicit two-source test the
report visibly meets, and the fix column by the "addresses the defect the seed actually
carries" clause plus a `null` `fix_report`.
