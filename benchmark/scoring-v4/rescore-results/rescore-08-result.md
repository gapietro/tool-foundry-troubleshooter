# Rescore Result — rescore-08 (Seed 05, Run 1)

## root_cause_layer_correct = 2

Expected root-cause layer per seed spec: `wiring` (layer 7). The report's
"LAYERS SWEPT" table marks "7 — Trigger and wiring" as SWEPT with the finding
"trigger found, wiring intact, trigger **inactive**," and RC-1's `Layer` field
is explicitly `7 — Trigger and wiring`. Exact match to the expected layer.

## fix_target_correct = 2

Expected fix target per seed spec: activation, and specifically — because
this seed defines the seed-05 partial-credit case — naming the *specific*
gate `sn_aia_trigger_configuration.active` rather than stopping at "the use
case/trigger is inactive" (which would score only 1). Fix 1 names the exact
record, table, and field: "`sn_aia_trigger_configuration` · sys_id
`bfb77d6c64884500a80203ee029436ee` · field `active`," current value `0`,
proposed value `1`. This clears the seed's own bar for full credit, not just
the generic "inactive" observation — full 2, not the partial band.

## evidence_cites_trace_and_config = 1

Cites both required source types. Execution trace: LAYERS SWEPT row 1 —
"`agent_trace` confirmed zero execution plans exist for this agent" — used as
direct evidence that nothing fired. Config/schema: RC-1's evidence field cites
`sn_aia_trigger_configuration` read via `agent_config` (artifact
`2a4755402b6e4bd417a6ffbeee91bf8b`) showing `active = "0"`. Both source types
appear and are used to build the diagnosis, satisfying the evidence rule.

## fix_usable_unedited = 1

Fix 1 is a precise, directly-appliable configuration change — exact table,
sys_id, field, current value, and proposed value (`active`: `0` → `1`) — with
no placeholders or ambiguity, and it addresses the defect the seed actually
carries (the seeded-off `sn_aia_trigger_configuration.active` gate). Since
`fix_target_correct` = 2 (not 0), the "may not be 1 while fix_target_correct
is 0" constraint does not apply. Fix 2 is clearly marked advisory/optional and
does not need to be applied for the primary fix to stand on its own.

## passes_gate = 1

`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Both hold (2 and 1 respectively), so `passes_gate = 1`.

## Total = 6/6

2 + 2 + 1 + 1 = 6.

## Notes

- No void condition applies to this scoring task: the packet gives no
  measurement or claim that the `sn_aia_trigger_agent_usecase_m2m` gate was
  left off (the seed's known void condition). The task instructions for this
  rescore did not surface voidness as a value to consider here, so the run is
  scored normally rather than marked void.
- The report correctly did not fall into the "generic inactive" partial-credit
  trap the seed spec calls out — it named the specific gate
  (`sn_aia_trigger_configuration.active`), distinguishing it from the m2m gate,
  which is the exact distinction the seed's partial-credit band exists to test.
- RC-2 / Fix 2 (run-as identity) is speculative/advisory and correctly labeled
  UNCONFIRMED — it does not detract from or dilute the primary, confirmed
  root cause and fix.
