# Row 18 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 0 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| total | 1/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct

The seed spec's header states the expected root-cause layer is `wiring` (layer 7), and its
"Expected diagnosis" section fixes it precisely: the trigger configuration for the
"Seed 05 Bench Ticket Created" trigger has `active=false` while the trigger-to-usecase m2m
gate is on.

The report's single `root_causes[]` entry declares `"layer": "1"`, component
`sn_aia_execution_plan`, finding "No execution plan exists for the agent". Layer 7 is
explicitly marked `NOT_SWEPT` in `layers_swept` with the reason "Trigger wiring requires a
valid agent record" — so the run did not merely mis-label a wiring finding, it never reached
the wiring layer and named layer 1 instead.

Worse, the layer-1 "root cause" restates the *symptom* the run was asked to explain (the
seed's Trigger section says the diagnostic target is the absence of an execution plan). The
named layer is not the expected layer. **0.**

### fix_target_correct

Expected fix target: **activation** — flip `sn_aia_trigger_configuration.active` to `true`
on the "Seed 05 Bench Ticket Created" trigger. The seed defines a partial band: naming only
"the use case/trigger is inactive" without naming the specific gate scores 1 of 2.

The report's only fix is `target_type: "configuration"`, `target: "sn_aia_agent"`,
`proposed: "Create valid agent record for Seed 05 Ticket Acknowledger"`. That is record
creation in the agent-definition layer, not activation. Nothing in the report names
`sn_aia_trigger_configuration`, `sn_aia_trigger_agent_usecase_m2m`, `active`, or activation
in any form — the `verification` string mentions "validate trigger configurations in
`sn_aia_usecase` table", but that is a verification step against the wrong table, not a
proposed fix, and it does not name an activation flag.

The proposal is also counterfactual against the seed spec, which states everything except
the one gate is correct and published — the agent exists, so there is no missing agent record
to create. Neither the specific target nor the right area is named, so the partial band does
not apply. **0.**

### evidence_cites_trace_and_config

This column is a formal citation check: the root cause must cite BOTH the execution trace
AND at least one config/schema source. The report's `root_causes[0].evidence[]` carries
exactly two entries:

- `{"source": "trace", "detail": "agent_trace found no execution plan"}`
- `{"source": "config", "detail": "agent_config returned empty sn_aia_agent reads"}`

Both a trace source and a config source are present and each carries a detail, and the audit
trail in §4 corroborates that both tools were actually called (`agent_trace`,
`agent_config` ×2, `schema_lookup`). The rubric asks whether both source classes are cited,
not whether the cited readings are correct — and they are cited. Note for the record that
the config citation appears factually wrong (the seed spec establishes the agent exists), but
the column as written does not score evidence accuracy. **1.**

### fix_usable_unedited

§A's constraint binds first and decides this column: `fix_usable_unedited` may not be 1 while
`fix_target_correct` is 0. `fix_target_correct` is 0 here, so this is **0** and neither
§A2.1 Case 1 (unfilled value slot) nor Case 2 (runtime record address) arises.

The substantive reading agrees with the constraint: "Create valid agent record for Seed 05
Ticket Acknowledger" is aimed at a defect the seed does not carry, so applying it unedited
would not restore the acknowledgement — a well-formed no-op, exactly the §A2 pattern that
the constraint exists to score 0. The seed's own open question about whether "activate the
trigger" is itself fully usable never comes into play, because this run did not propose
activation.

### passes_gate

`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here: `root_cause_layer_correct == 0` (fails the first term) and `fix_usable_unedited == 0`
(fails the second). Both terms fail, so **`passes_gate` = 0**.

Not void: §A3's seed-05 void conditions are the m2m gate being off and the unresolved
SDK 4.9.0 run-as non-firing reason. §2 records the m2m gate
(`ba30d8775b0c4cebb960c58830590d5d`) as `active=true` and still on as of 2026-08-09, and the
run-as question is marked ANSWERED with the trigger confirmed to fire once activated. §5
states this run reached a terminal state and no row in the pass was void.

### ambiguity

**No** — all four columns were determined by the packet.

- `root_cause_layer_correct`: the report states a single explicit `layer` value ("1") against
  an explicitly specified expected layer (`wiring`/7), and it marks layer 7 `NOT_SWEPT`.
  There is no second defensible reading.
- `fix_target_correct`: the sole fix targets `sn_aia_agent` record creation. Activation is
  named nowhere in the fixes, so neither the 2 band nor the seed's 1 (partial) band can be
  reached — the partial band requires at least "the trigger/use case is inactive", which the
  report never says.
- `evidence_cites_trace_and_config`: the evidence array literally carries one `trace` and one
  `config` source. The only alternative reading would require the column to also test whether
  the cited evidence is *true*, which its definition does not ask.
- `fix_usable_unedited`: fully determined by §A's constraint, which the packet instructs be
  checked first; no weighing was required.
