# Row 18 — custom / seed-05 / run-1 — Scoring Result

## Void check

Not void. The seed's own spec box records that at Task 12 the m2m gate
(`sn_aia_trigger_agent_usecase_m2m`) was PATCHed on and re-read `true`, while
`sn_aia_trigger_configuration.active` stayed `false` as seeded, and a ticket
insert produced no execution plan anywhere on the instance — the intended
single-cause state. This run therefore tested the seeded defect and is scored
normally, not recorded as `void`.

## Treatment of the rejected-draft status

Per instructions, "rejected" is not treated as an automatic zero. The draft
in `fix_report_rejected.report` is the only surviving record of this run's
diagnostic attempt (`fix_report` itself is `null`), and it is scored on its
own merits under the rubric below. Independently of the rejection, the draft
fails on substance: it never advances a layer-7/activation diagnosis, and its
own evidence is single-sourced — the same defect (missing second
config/schema citation) that the harness's validator rejected it for is also
what costs it points on `evidence_cites_trace_and_config` here. The rejection
and the rubric score agree for the same underlying reason, but the rubric
score was derived from the rubric's own criteria, not inferred from the
validator's verdict.

## Column scores

### `root_cause_layer_correct` = 0

Expected layer: `wiring` (layer 7). The report's single `root_causes[0]`
entry has `"layer": "1"`, `"component": "sn_aia_execution_plan"`, finding
"No execution plan exists for the provided sys_id" — this restates the
observed absence (layer 1), not the wiring cause behind it. Layer 7 is
explicitly left `NOT_SWEPT` in the report's own `layers_swept` block
("Trigger and wiring configuration must be validated to confirm failure
cause"), and the root-cause entry only points at layer 7 indirectly via
`"would_confirm": "7"` — a flag that further work *could* confirm it, not a
diagnosis that it *did*. The report never names `wiring`/layer 7 as the
determined root cause. Fails the column outright.

### `fix_target_correct` = 0

Expected fix target: activation, specifically flipping
`sn_aia_trigger_configuration.active` to `true`. The report's only fix entry
is `target: "agent trigger configuration"`, `current: "unknown"`,
`proposed: "validate trigger conditions and record associations"`. This
does not clear even the rubric's partial (1) band, which requires the
diagnosis to at least assert "the use case/trigger is inactive" without
naming the specific gate. This report asserts nothing about inactivity — it
recommends *validating* the trigger configuration as a next investigative
step, i.e. it does not commit to a diagnosis of what is wrong with the
trigger at all. `current: "unknown"` is the report admitting it does not
know the state of the thing it's proposing to fix. Scored 0, not partial.

### `evidence_cites_trace_and_config` = 0

The rubric requires the root cause to cite BOTH the execution trace AND at
least one config/schema source. The report's `root_causes[0].evidence` array
contains exactly one entry, sourced `"trace"` (the `agent_trace` absence
finding). No config or schema source is cited anywhere in the root-cause
evidence. This is precisely the deficiency the harness's own validator
rejected the draft for ("Cite at least TWO DISTINCT sources from
config/schema/data — found 0"). Confirmed independently against the rubric
text: 0.

### `fix_usable_unedited` = 0

Per the rubric, this column may not be 1 while `fix_target_correct` is 0 —
and it is 0 here regardless: the proposed fix ("validate trigger conditions
and record associations") is a request to go investigate, not a concrete
change (e.g. "set `sn_aia_trigger_configuration.active = true` on the Seed
05 Bench Ticket Created trigger") a builder AI could apply as written. It is
neither specific enough to apply unedited nor aimed at the seed's actual
defect.

## Totals

| Column | Score |
|---|---|
| `root_cause_layer_correct` | 0 / 2 |
| `fix_target_correct` | 0 / 2 |
| `evidence_cites_trace_and_config` | 0 / 1 |
| `fix_usable_unedited` | 0 / 1 |
| **Total** | **0 / 6** |

`passes_gate` = `root_cause_layer_correct == 2 AND fix_usable_unedited == 1`
→ `0 == 2` is false → **`passes_gate = 0`**.

## Partial credit note

No partial credit was awarded. The seed-05 partial band on `fix_target_correct`
requires the diagnosis to at least identify the use case/trigger as inactive
without naming the specific gate; this report's fix section stops at
recommending validation of trigger configuration, without asserting an
inactive-trigger finding, so it does not meet even the partial bar.
