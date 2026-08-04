# Row 20 result — custom, seed 05, run 2

## Treatment of "rejected draft" status

The run terminated `status: failed` with `fix_report: null`; the only record
of the model's diagnostic work is `fix_report_rejected.report`, a draft that
failed the harness's own evidence-rule validation ("cite at least TWO
DISTINCT sources from config/schema/data — found 0"). Per instructions, this
is not automatically scored 0 for being rejected — it is scored on its
merits under the rubric like any other report. As it happens, the content of
the draft independently earns 0 on every column (see below); the rejection
and the rubric score agree, but the rubric score is derived from the
report's actual content and the audit-trail measurement, not from the
rejection itself.

## Column scoring

### `root_cause_layer_correct` = 0

Expected root-cause layer per the seed spec: `wiring` (layer 7) —
specifically `sn_aia_trigger_configuration.active = false`. The rejected
report's only `root_causes[]` entry states `"layer": "1"`, `"component":
"sn_aia_execution_plan"`, finding "No execution plan exists for the provided
sys_id." That is a restatement of the observed absence (the symptom the
seed is built to produce), not a diagnosis of why it's absent. The report
itself marks this finding `"confidence": "UNCONFIRMED"` with
`"would_confirm": "7"` — i.e., the report's own author flags that layer 7 is
what would need to be checked to actually confirm a cause, and then never
checks it. The audit-trail measurement confirms this: `layers_swept` = 1/7
(L1 only), tool-call count 1 (`agent_trace` only) — no `agent_config`,
`schema_lookup`, or any other call that could have surfaced
`sn_aia_trigger_configuration.active`. No layer-7 finding exists anywhere in
this run to award credit against.

### `fix_target_correct` = 0

Expected fix target: activation, specifically flipping
`sn_aia_trigger_configuration.active` to `true`. The partial-credit band (1)
requires at minimum naming that the use case/trigger is inactive. This
report does not even reach that generic claim: `fixes[0].current` is
`"unknown"`, and `fixes[0].proposed` reads "Verify trigger conditions and
ensure the bench ticket meets applicability criteria" — that is a
request to go check *condition/applicability matching* (a different failure
mode from the seed, and one the seed spec explicitly warns is a trap: the
trigger condition was historically bogus but was corrected pre-seed and is
not the defect here), hedged in the rationale between "trigger activation
logic **or** record matching." It never asserts activation is off, never
names `sn_aia_trigger_configuration`, and never proposes flipping any flag.
This falls short of even the generic "inactive" partial-credit floor
described in the seed spec, so no partial credit applies.

### `evidence_cites_trace_and_config` = 0

The rubric requires the root cause to cite both the execution trace AND at
least one config/schema source. `root_causes[0].evidence` contains exactly
one entry: `{"source": "trace", "detail": "agent_trace reported ..."}`. No
config or schema source is cited anywhere in the root cause. This matches
the harness's own verbatim rejection reason: "Cite at least TWO DISTINCT
sources from config/schema/data — found 0."

### `fix_usable_unedited` = 0

Per the rubric's explicit constraint, this cannot be 1 while
`fix_target_correct` is 0 — which is already dispositive here. Independently,
the proposed fix is not an applicable edit in the first place: "Verify
trigger conditions and ensure the bench ticket meets applicability criteria"
is an instruction to go investigate, not a concrete field/value change a
builder AI could apply as written (contrast with the seed's expected fix:
flip a named field on a named record to `true`).

## Total

`root_cause_layer_correct` (0) + `fix_target_correct` (0) +
`evidence_cites_trace_and_config` (0) + `fix_usable_unedited` (0) = **0/6**

## `passes_gate`

```
passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1
            = 1 iff (0 == 2) AND (0 == 1)
            = 0
```

**`passes_gate = 0`**

## Partial credit note

No partial credit was awarded on `fix_target_correct`. The seed's partial
band requires the diagnosis to at least state the trigger/use case is
inactive without naming the specific gate. This report's fix proposal talks
about verifying trigger *conditions* and *applicability criteria* — language
that points at condition-matching, a decoy the seed spec specifically
flags as a historical (now-fixed) red herring — rather than asserting
inactivity/activation at all. It does not clear even the generic floor, so
0 rather than 1 was awarded.
