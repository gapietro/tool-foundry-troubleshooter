# Row 20 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 0 |
| fix_usable_unedited | 0 |
| total | 4/6 |
| passes_gate | 0 |
| ambiguous | yes |

## Reasoning

First, the void check (§A3). Seed 5's void condition is the
`sn_aia_trigger_agent_usecase_m2m` gate being off. §2 records it PATCHed on and
re-read `true` (`ba30d8775b0c4cebb960c58830590d5d`), still `active=true` as of
2026-08-09; §5 states no row in this pass was void. The second void clause (the
unresolved SDK 4.9.0 run-as non-firing reason) is closed by §2's 2026-08-09
measurement. Not void — the four columns are scored.

Second, the §A/§A2 constraint check: `fix_usable_unedited` may not be 1 while
`fix_target_correct` is 0. Here `fix_target_correct` is 2, so the constraint does
not bind and §A2.1's two cases are live.

The report was rejected by the harness validator, but §3 states explicitly that a
rejected report is still scored, so the verbatim body is the object of scoring.

### root_cause_layer_correct
The seed spec's expected root-cause layer is `wiring` (layer 7). The report's
single `root_causes[0]` entry carries `"layer":"7"` with
`"component":"sn_aia_trigger_configuration"`, and its `layers_swept_reason` for 7
reads "Analyzed trigger configuration via agent_config"; the validator text in the
same section confirms layer 7 is "Trigger and wiring". The named layer therefore
matches the expected layer exactly. The finding sentence is muddied by an
additional "or valid run-as identity" disjunct, but the column scores the *layer*
named, and layer 7 / wiring is named unambiguously. **2.**

### fix_target_correct
Expected fix target is activation, and the seed spec sets an explicit bar: naming
only "the use case/trigger is inactive" without naming
`sn_aia_trigger_configuration.active` scores 1 of 2; naming the specific gate
scores full. The report clears that bar — evidence: "Trigger configuration record
shows active: '0'"; fix: `target: "sn_aia_trigger_configuration"`,
`current: "active: '0', run_as: empty"`, `proposed: "active: '1', run_as:
valid_user"`. It names the specific gate that is off, on the correct table, and
proposes flipping it. The spurious `run_as` addition is surplus rather than a
substitution of target, and the rubric's 1 band is defined by *absence* of the
specific target, not by extra material. **2.**

### evidence_cites_trace_and_config
The root cause carries exactly two evidence entries, both `"source":"config"`:
the trigger configuration record (artifact_id `270a39762b6a87d817a6ffbeee91bf48`)
and the `agent_config` output's `trigger_active: '0'`. Config is present; there is
no trace citation. The packet's own validator states this verbatim — "evidence rule
violation — no trace citation found" — which settles the reading. The report did
mark `"1":"UNAVAILABLE"` in `layers_swept` with a reason, invoking the instructions'
no-execution-exists exception, but the validator ruled the exception unsatisfied
(it also read `layers_swept` as missing all seven layers). Under the column's plain
wording (trace AND ≥1 config) and under the packet's own validator ruling, this is
**0.**

### fix_usable_unedited
The proposed fix is `sn_aia_trigger_configuration`: `active: '0'` → `'1'`,
`run_as: empty` → `valid_user`. Three independent routes take this to 0:

1. **§A2.1 Case 1 — unfilled value slot.** `valid_user` is a placeholder, not a
   value. Applied literally by the builder AI it writes the string "valid_user"
   into `run_as`; applied sensibly it requires the builder to first choose and
   look up a user. The clause's escape (value not obtainable from the instance)
   does not clearly apply — user records are reachable with `query_table` and the
   run never looked.
2. **§A2.1 Case 2 — runtime-record address.** The fix's `target` is a table name
   with no sys_id. Multiple trigger configurations exist on this instance (the
   fixture carries several seeds), and the only identifier in the report is an
   `artifact_id`, which is a pointer to a stored read rather than the record's
   sys_id. A scorer would have to work out which record — Case 2 scores that 0.
3. **The defect it addresses.** §2 records that flipping this `active` to `true`
   makes the trigger fire but produces no acknowledgement (plan created with
   `status=error`, 0 tasks / 0 tool calls / 0 messages), so a bare "activate the
   trigger" fix does not restore the seeded behaviour. §2 flags this as an
   exposure on this exact column and says §A2.1's clauses do not cover it.

Routes 1 and 2 are sufficient on their own; route 3 only pushes the same way.
**0.**

### passes_gate
`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here: 2 AND 0 → **0.** Note this is a 4/6 run that fails the gate, which §A2
states explicitly is expected behaviour, not an inconsistency.

### ambiguity
**yes** — one column, `fix_usable_unedited`, was under-determined.

- Reading A (**0**, the one recorded): the fix cannot be applied as written
  because `run_as: valid_user` is an unfilled placeholder the run did not resolve
  (§A2.1 Case 1), and the target names a table rather than a unique record
  (§A2.1 Case 2).
- Reading B (**1**): the load-bearing operation — `sn_aia_trigger_configuration.active`
  '0' → '1' — is fully specified and names the field it changes; the record is
  inferable from the diagnosis context (the Seed 05 trigger, with an artifact_id
  cited); and the run-as value is arguably a builder's choice the instance does
  not hold, which Case 1 says must not be penalised.

The packet itself acknowledges this column's exposure on this seed and states that
"§A2.1's clauses do not cover this case" and that any pass including seed 05 must
rule on it in pre-registration — no such ruling is present in this packet. That
missing ruling is recorded here as ambiguity rather than resolved by reading
anything outside the packet.

The other three columns were determinate: the report names layer 7 explicitly
(root cause layer); it names `sn_aia_trigger_configuration` with `active: '0'` →
`'1'`, which is precisely the specificity the seed spec's partial-band rule
distinguishes on (fix target); and both evidence entries carry `"source":"config"`
with the packet's own validator confirming no trace citation (evidence).
