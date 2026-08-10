# Row 17 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 1 |
| total | 6/6 |
| passes_gate | 1 |
| ambiguous | yes |

## Reasoning

### root_cause_layer_correct

The seed spec states the expected root-cause layer is `wiring` (layer 7). The report's
RC-1, marked *PRIMARY — CONFIRMED*, is labelled "Layer | 7 — Trigger and wiring" and
identifies `sn_aia_trigger_configuration` field `active` as the defect. That is the
expected layer named explicitly, as the primary root cause, not buried among
alternatives. Earns **2**.

The two secondary root causes (RC-2 zero tools, layer 3; RC-3 empty run-as, layer 7) do
not displace RC-1 — it is ranked PRIMARY and CONFIRMED, and RC-3 is explicitly marked
"impact UNCONFIRMED".

### fix_target_correct

Expected fix target: **activation** — flip `sn_aia_trigger_configuration.active` to
`true`. The seed spec is explicit that stopping at the generic "the use case/trigger is
inactive" without naming the specific gate scores the partial band (1 of 2).

FIX-1 names the specific gate: target `sn_aia_trigger_configuration` · sys_id
`bfb77d6c64884500a80203ee029436ee` · field `active`, current `0`, proposed `1`. It does
not stop at "inactive" and does not confuse the two gates — the report separately
observes the m2m link exists. (The report's `active_trigger_configurations = 0` note is a
count of active trigger configurations, i.e. a restatement of RC-1, not a claim that the
m2m `active` gate is off, so it does not muddy which gate was named.) The partial band
therefore does not apply. Earns **2**.

Note it also proposes two additional fixes (FIX-2 tool binding, FIX-3 run-as). The rubric
does not penalise extra fixes, and FIX-1 stands as its own numbered fix directly against
the seeded defect, so the extras neither raise nor lower this column.

### evidence_cites_trace_and_config

RC-1's Evidence row cites two sources: the config side — `agent_config` artifact
`33a5f1f62bea8318f243fed2ce91bf79`, triggers section, quoting `"active":"0"` — and the
trace side — `sn_aia_execution_plan` read status `empty`, explicitly attributed to
`agent_trace`. Both required source classes are present in the root cause itself, not
only elsewhere in the report. The trace evidence here is an *absence* (no plan), which is
the only trace signal this seed can produce by construction, and it is cited as trace
output rather than asserted from prose. Earns **1**.

### fix_usable_unedited

The §A gate constraint is checked first: `fix_target_correct` is 2, not 0, so the
constraint does not bind and §A2.1 is reachable.

FIX-1 is fully specified and needs no editing: one table, one sys_id, one field, the
current value and the exact proposed value. §A2.1 Case 1 does not arise — no value slot
is left unfilled. §A2.1 **Case 2 applies** (the fix addresses a runtime record rather
than the Fluent source): the address resolves to exactly one record
(`sn_aia_trigger_configuration` sys_id `bfb77d6c64884500a80203ee029436ee`) and the fix
names every field it changes (`active`, `0` → `1`). Case 2 scores **1** on that reading,
and it directly addresses the defect the seed actually carries. Scored **1**.

See the ambiguity section — the seed spec itself flags an unresolved exposure on exactly
this column, which is why the packet-level flag is `yes` even though I score it 1.

### passes_gate

`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Both gate terms are met (2 and 1), so **passes_gate = 1**. `fix_target_correct` and
`evidence_cites_trace_and_config` do not feed the expression.

Void check, run first: §A3's seed-05 void condition is that the
`sn_aia_trigger_agent_usecase_m2m` gate was not turned on post-install (or the trigger
failed to fire for the unresolved run-as reason). The seed spec records the m2m gate as
PATCHed and re-read `true` (`ba30d8775b0c4cebb960c58830590d5d`, still on as of
2026-08-09), the report independently observes the m2m link exists while the trigger
config is inactive, and §5 states no row in this pass was void. The seed was in the state
its spec requires, so this row is scored, not voided.

### ambiguity

**`fix_usable_unedited` is under-determined.** Two defensible readings, both grounded in
this packet:

- **1** — the column's own definition asks whether the fix "could be applied by the
  builder AI as written, with no manual editing first — and it addresses the defect the
  seed actually carries." The seed's actual defect is
  `sn_aia_trigger_configuration.active = false`; FIX-1 addresses precisely that, with a
  unique record address and a named field, satisfying §A2.1 Case 2 on its face.
- **0** — the seed spec's own §"ANSWERED 2026-08-09 (#151)" item 2 records that flipping
  `active` to `true` makes the trigger fire but produces an execution plan with
  `status=error`, 0 tasks, 0 tool calls, empty objective — so "a report proposing
  'activate the trigger' proposes a fix that, applied unedited, **does not restore the
  acknowledgement**." A scorer reading "usable" as outcome-restoring, in the same spirit
  as §A2's R-22 decoy reasoning (a well-formed fix that fixes nothing is a no-op), lands
  on 0 — which would flip `passes_gate` to 0.

The packet does not resolve this. The seed spec states plainly that "§A2.1's clauses do
not cover this case" and that "any pass including seed 05 must rule on it in its
pre-registration, before the scorers meet it" — and that ruling is **not present in this
packet**. I scored 1 because the column definition as written in §A is satisfied and
§A2.1 Case 2 is met, and because the outcome-restoring reading requires importing a
standard the packet declines to state; but this is a reading, not a determination, and it
is exactly the reading the seed spec predicted would be exposed. Because
`fix_usable_unedited` is a gate term, this under-determination changes the row's verdict,
not just its total.

The other three columns were determinate: the report names layer 7 / `wiring` as PRIMARY
verbatim; FIX-1 names `sn_aia_trigger_configuration.active` specifically, which is the
exact string the seed spec requires to clear the partial band; and RC-1's Evidence row
cites `agent_config` and `agent_trace` side by side.

Secondary, non-scoring observation recorded for completeness: RC-3 (empty run-as) is a
finding the seed spec's #151 measurement refutes as a firing-layer defect ("the trigger
fires anyway"; "there is no second wiring defect at the firing layer"). The report hedges
it correctly as "impact UNCONFIRMED" rather than asserting it, and no rubric column
scores extra or wrong root causes, so it does not affect any value above.
