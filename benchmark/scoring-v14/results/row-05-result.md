# Row 05 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 0 |
| fix_usable_unedited | 1 |
| total | 5/6 |
| passes_gate | 1 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct

The seed spec's header table prints `Expected root-cause layer` = `wiring` (layer 7).

The report states two root causes (RC-1 and RC-2), so §A2.2 Case 2 applies first and
selects the subject: the primary is the entry the report ranks first — RC-1 ("Trigger is
inactive"). RC-2 is explicitly marked "(secondary, informational)". Neither entry asserts
that no defect exists, so no skipping is required.

RC-1 declares a layer in a **Layer** row: `7 — Trigger and wiring`. §A2.2 Case 1 governs:
where a layer is declared, score the declared value against the seed's expected layer. `7`
matches the expected layer 7 (`wiring`), by both the number and the name the seed prints.
The clause forbids scoring the substance of the finding text, so nothing further is
weighed. **2.**

(RC-2 also declares layer 7, but it is not consulted — Case 2 reads the primary alone.)

### fix_target_correct

The seed's `Expected fix target` header row gives the **area**: activation. Its *Expected
diagnosis* section names the **specific** target: "flip `sn_aia_trigger_configuration.active`
to `true` on that trigger" — the "Seed 05 Bench Ticket Created" trigger — and the seed's
"The two gates" section states that stopping at the generic "the use case is inactive"
without naming which gate scores partial.

The report proposes two fixes. §A2.3's multi-fix rule takes the highest value any single
non-hedged proposed fix earns; the primary is Fix 1.

Fix 1 declares its target (§A2.3 Case 1 — score the declared value): `Target type:
Configuration`; `Target: sn_aia_trigger_configuration, sys_id bfb77d6c64884500a80203ee029436ee
— field active`; `Current: false (0)`; `Proposed: true (1)`. The declared target names the
exact table, the exact record (the trigger the seed names, by sys_id), and the exact field
the seed's *Expected diagnosis* section names, and the operation is precisely the flip to
`true`. That is the specific target "in whatever terms that section uses", so Case 2's **2**
band is reached rather than the **1** band — this is not a report that stopped at "the use
case/trigger is inactive"; it names `sn_aia_trigger_configuration.active` and distinguishes
it from nothing else being wrong. The seed rules no reading out for this column, so the 0
band's exclusion clause does not arise.

Fix 2 (run-as identity) targets a different concern; under §A2.3 additional fixes are
neither credited nor charged, and the column takes Fix 1's value. **2.**

### evidence_cites_trace_and_config

§A1 Case 1 does not apply — a root cause is stated. §A1 Case 2 applies (two root causes) and
selects RC-1 as the subject; the column is then decided by Cases 3–5 against RC-1 alone.

RC-1's **Evidence** row offers exactly two things, both of the same type:
`agent_config` artifact `87046f032b62431017a6ffbeee91bf74`, triggers section
(`"active":"0"`, `"trigger_sys_id":"bfb77d6c64884500a80203ee029436ee"`), and the
`agent_config` overview counts (`active_trigger_links=0`,
`active_trigger_configurations=0`). Both are **config/schema** citations. They pass Case 3
(RC-1's own statement names `sn_aia_trigger_configuration` and that trigger record, which is
what the citation names) and Case 4 (`agent_config` is one of the six config/schema
families, and the audit trail in section 5 records an `agent_config` call). The
config/schema half is satisfied.

The **trace** half is not. Case 4 restricts that half to a recorded `agent_trace` call, and
section 5 does record one — but Case 5 requires the citation to be *offered as evidence for
RC-1*, and RC-1's Evidence row contains no trace source. The trace-side material in this
report sits elsewhere: the LAYERS SWEPT table's L1 row (`sn_aia_execution_plan` read status
`empty`) and the FAILURE SUMMARY's statement that no execution plan was produced. Case 5
names exactly these locations — "a failure summary, a sweep table, an appendix" — as not
counting **unless** the root cause's own evidence refers to them explicitly. RC-1's Evidence
row contains no such pointer; its Finding text asserts the mechanism ("never creates an
execution plan") but that is a claim, not a citation of a trace source, and "proximity in
the document is not a reference; a pointer is."

With one half unsatisfied, the conjunction fails. **0.**

### fix_usable_unedited

§A's constraint is checked first: `fix_target_correct` = 2, so it does not bind.

§A2.1 Case 5 selects the subject — the proposed fix addressing the seeded defect. That is
Fix 1. Fix 2 addresses RC-2, an unrelated run-as concern, and is neither credited nor
charged.

Section 3's advance ruling for this seed governs directly: a report that names the specific
gate (`sn_aia_trigger_configuration.active = false`) and proposes activating it scores
**1**, notwithstanding the seed spec's finding that activation alone does not restore the
acknowledgement on this instance. This report does exactly that, so the seed spec's
`fix_usable_unedited` exposure note is settled by the ruling and is not re-derived here.

The remaining §A2.1 cases are each checked as necessary conditions on Fix 1, not as a
cascade:

- **Case 1** — target and operation fully specified (table `sn_aia_trigger_configuration`,
  record sys_id `bfb77d6c64884500a80203ee029436ee`, field `active`, set `false (0)` →
  `true (1)`). No value slot is left unfilled; the value is supplied literally.
- **Case 2** — the address resolves to exactly one record (a sys_id), and the fix names
  every field it changes (`active`, and only that).
- **Case 3** — the fix states its operation in prose and supplies no code snippet or literal
  replacement text, so this case does not arise.
- **Case 4** — the target is named by name/sys_id, not by kind.

All conditions that arise are satisfied. **1.**

### passes_gate

The §A2 expression is `passes_gate = 1 iff root_cause_layer_correct == 2 AND
fix_usable_unedited == 1`. Here 2 and 1 → **1**. `evidence_cites_trace_and_config` = 0 and
`fix_target_correct` = 2 are not in the expression and do not move it; this is the stated
case of a run scoring 5/6 with one non-gate column at 0 and still passing.

No void condition applies: §A3's seed-5 seed-state condition requires the
`sn_aia_trigger_agent_usecase_m2m` gate to have been off, and the seed spec records it ON
and persisting; the run reached terminal state `completed` with a full report body, so the
run-state condition does not apply either.

### ambiguity

`no`. Every column was determined by the packet's own material. The two columns that
required the most work were both settled by explicit clauses rather than by judgement:
`root_cause_layer_correct` by §A2.2 Case 2 (primary selection) plus Case 1 (score the
declared **Layer** row), and `evidence_cites_trace_and_config` by §A1 Case 5, which names
the failure summary and the sweep table as locations that do not count absent an explicit
pointer from the root cause's own evidence. `fix_usable_unedited`'s one genuinely open
question for this seed — whether activation alone counts as usable given the execution-layer
break — is answered in advance by section 3's ruling. Effortful, but not under-determined.
