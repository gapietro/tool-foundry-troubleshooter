# Row 17 — Scoring result

**Seed:** 05 (use case exists but is inactive) · **Harness:** native (Agent Doctor) · **Run:** 1
**Execution ID:** `5aa332282b6a871817a6ffbeee91bf13` · Terminal state (native): Completed · Wall clock: 168s

## Void check

Seed 5's void conditions are (a) the `sn_aia_trigger_agent_usecase_m2m` gate not turned on
post-install (both gates off, seed isolates nothing), or (b) the trigger failing to fire for
the unresolved SDK 4.9.0 run-as reason. The seed spec's own "OBSERVED AT TASK 12" note
confirms the m2m gate (`ba30d8775b0c4cebb960c58830590d5d`) was PATCHed and re-read `true`,
while `sn_aia_trigger_configuration.active` stayed `false` as seeded — a single isolated
defect, matching the state this run's report describes. The run-as question is flagged as
"still open" only for a *separate, not-yet-attempted* verification (activating the trigger
to see whether it then fires) — it is not evidence that this diagnostic run's seed state was
corrupted, and the setup precondition that actually gates voiding (the m2m PATCH) was met.
**Not void** — scored normally.

## Rubric columns

### `root_cause_layer_correct` = **2**

Expected layer is `wiring` (layer 7). The report's primary and only confirmed root cause
(Root Cause 1) is explicitly attributed to "Layer 7 — Trigger and wiring," component
`sn_aia_trigger_configuration` — "Seed 05 Bench Ticket Created." This matches the seed spec's
expected root-cause layer exactly, and is corroborated by the audit-trail measurement, which
confirms L7 was genuinely swept (`layers_swept` includes L7) and that this run's single
`agent_config` call — crediting L2, L3, L7 — is "consistent with this run's own LAYERS SWEPT
table above; no disagreement between the report and the audit trail on this run."

### `fix_target_correct` = **2**

Expected fix target is activation — specifically `sn_aia_trigger_configuration.active`
flipped to `true`, per the seed spec's explicit partial-credit rule: naming only "the
use case/trigger is inactive" without the specific gate scores 1 of 2. This report clears
the full-credit bar: Fix 1's target is stated as "`sn_aia_trigger_configuration`, sys_id
`bfb77d6c64884500a80203ee029436ee`, field `active`," current value `0`, proposed value `1`.
This names the exact field on the exact record — the specific gate the seed requires, not
the generic "inactive" observation the partial band is reserved for. Full credit.

### `evidence_cites_trace_and_config` = **1**

Root Cause 1's evidence row cites both required source types: a config source
("`sn_aia_trigger_configuration` ... field `active`, value `"0"` — read via `agent_config`
(artifact ..., triggers section)", corroborated by `sn_aia_agent` overview fields) and an
execution-trace source ("corroborated by ... `sn_aia_execution_plan` returning genuinely
empty in layer 1"). The audit trail confirms `agent_trace` was called (tool-call #1) and L1
was genuinely swept, so the trace citation is not fabricated. Both trace and config are
present in the root-cause evidence — full credit.

### `fix_usable_unedited` = **1**

Not blocked by the mandatory constraint since `fix_target_correct` = 2. Fix 1 is a concrete,
directly applicable instruction: "Set `active = 1` on `sn_aia_trigger_configuration` sys_id
`bfb77d6c64884500a80203ee029436ee`." It names the exact table, record, field, and target
value — a builder AI (or an admin) could apply this verbatim with no interpretation or
editing required, and it addresses the actual seeded defect. Full credit.

## `passes_gate`

```
passes_gate = (root_cause_layer_correct == 2) AND (fix_usable_unedited == 1)
            = (2 == 2) AND (1 == 1)
            = 1
```

**`passes_gate = 1`**

## Total

**6 / 6**

## Notes for a later reader

- **Report over-claims one non-deciding layer.** The report's LAYERS SWEPT table marks
  Layer 4 (Data schemas) as "SWEPT," but the audit-trail measurement's `layers_swept` is
  6/7 and explicitly lists `L1, L2, L3, L5, L6, L7` — L4 is absent. No `schema_lookup` tool
  call appears anywhere in the measured tool-call order; the report's L4 claim appears to
  conflate a `query_table` existence check (which legitimately earns L5) with an actual
  schema inspection. Per the scoring instructions, the measurement is treated as fact over
  the report's claim, so L4 was **not** actually swept, contra the report's table. This
  does not affect any of the four rubric columns above: the root cause (L7) and its evidence
  are independently confirmed clean by the measurement note ("no disagreement... on this
  run" for L2/L3/L7), and L4 plays no role in the root cause or fix. Flagging only so a
  later reader doesn't mistake this run's LAYERS SWEPT table as a fully reliable self-report.
- The report also surfaces a misspelled-table `query_table` call (`sn_tsbench_ticket`) that
  correctly returned empty before the correctly-spelled call succeeded — both are counted in
  the audit trail's tool-call total of 9; this is a minor efficiency wrinkle, not a
  correctness issue, and does not affect scoring.
- The report's two secondary observations (no tools attached; no run-as/access roles) are
  explicitly marked as not the cause of this failure and are advisory only — they do not
  compete with or dilute the primary, correctly-targeted root cause and fix.
