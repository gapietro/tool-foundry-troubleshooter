# Row 07 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 1 |
| total | 6/6 |
| passes_gate | 1 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct

The seed spec's header table prints `Expected root-cause layer` = `wiring` (layer 7).

The report states two root causes (RC-1, RC-2), so §A2.2 Case 2 applies first and
selects the primary: RC-1 is ranked first and RC-2 is explicitly marked
"(advisory)". Neither entry asserts that no defect exists, so no skip applies and
the primary is RC-1.

RC-1 declares a layer explicitly — the **Layer** row reads `7 — Trigger and
wiring`. §A2.2 Case 1 instructs the scorer to score the declared value and compare
it to the seed's expected layer. Declared 7 (wiring) == expected layer 7
(`wiring`) → **2**. The substance of the finding text is not scored per Case 1,
though here it happens to agree (an inactive trigger configuration). The
`layers_swept` table is not consulted for this column, per Case 2's closing note.

### fix_target_correct

The seed's header row gives the area — `Expected fix target` = **activation** —
and the *Expected diagnosis* section gives the specific target: "flip
`sn_aia_trigger_configuration.active` to `true` on that trigger" for the "Seed 05
Bench Ticket Created" trigger. §A2.3 Case 2 requires reading both.

The report proposes two fixes. FIX-2 is marked "(advisory, apply after FIX-1)", so
under §A2.3's several-fixes rule it is skipped as hedged/follow-on; FIX-1 is the
primary and non-hedged.

FIX-1 declares its target (§A2.3 Case 1), and the declared value is scored:
`Target: sn_aia_trigger_configuration · sys_id bfb77d6c64884500a80203ee029436ee ·
field active`, `Current: 0 (false)`, `Proposed: 1 (true)`. That names the exact
record, table and field the seed's *Expected diagnosis* section names, in the same
terms — the specific activation gate, not merely "the use case is inactive". The
seed's "The two gates" section reserves the partial band for a diagnosis that stops
at the generic observation; this one does not. Case 2's **2** band therefore
applies.

(The "Target type: Configuration" row is not one of §A's five areas, but Case 2's
bands are decided by the target that is named, and the named target is the seed's
specific one; the compound-target clause does not arise since only one target is
named.)

### evidence_cites_trace_and_config

Subject selection: §A1 Case 1 does not apply (root causes are stated); Case 2
selects RC-1 as the primary, on the same basis as above.

RC-1's own **Evidence** row carries both halves and carries them together, so §A1
Case 5's co-location requirement is met — nothing has to be imported from the
LAYERS SWEPT table or the failure summary:

- config/schema half — "`agent_config` artifact `34056bc72b62431017a6ffbeee91bfc4`,
  triggers section: `trigger.active = "0"`, `trigger.condition =
  "short_descriptionISNOTEMPTY"`, `trigger.target_table = "x_snc_tsbench_ticket"`".
- trace half — "Corroborated by `agent_trace` returning `sn_aia_execution_plan`
  read status `empty` and zero candidates."

§A1 Case 3 (connection): RC-1's own statement names `sn_aia_trigger_configuration`
· field `active` — exactly what the `agent_config` citation reports — and its
Finding names the absent execution plan ("no execution plan is created"), which is
exactly the artifact the `agent_trace` citation reports on. Both citations name
artifacts the root-cause statement names.

§A1 Case 4 (trail backing): section 5 records 7 result rows over 6 distinct tool
names including **`agent_trace`** (the sole backer of the trace half) and
**`agent_config`** (one of the six config/schema-family tools). Both halves are
backed. No validator rejection is recorded in this packet.

Both halves satisfied → **1**.

### fix_usable_unedited

§A's constraint is checked first: `fix_target_correct` = 2, so it does not bind.

§A2.1 Case 5 selects the fix addressing the seeded defect: FIX-1 (activate the
trigger). FIX-2 addresses a different, self-declared unconfirmed finding and is
neither credited nor charged.

Section 3's advance ruling is directly on point and binding: a report that names the
specific gate (`sn_aia_trigger_configuration.active = false`) and proposes
activating it scores **1**, notwithstanding the seed spec's finding that activation
alone does not restore the acknowledgement on this instance. FIX-1 does exactly
that, so the execution-layer second defect is excluded from this column and must not
be re-derived here.

The remaining Case tests are each satisfied:
- Case 1 (value slot): target, field and operation are fully specified, and the
  value is given literally — `Current 0` → `Proposed 1`. Nothing is left for the
  builder to look up.
- Case 2 (runtime record address): the address is a single record — table
  `sn_aia_trigger_configuration`, sys_id `bfb77d6c64884500a80203ee029436ee` — and
  the one field changed (`active`) is named. Exactly one record, every changed
  field named.
- Case 3 (incomplete edit): the fix states its operation in prose plus a literal
  current→proposed value pair and supplies no code snippet, so this case does not
  arise; the "How to apply" UI steps are complete and consistent with the stated
  change.
- Case 4 (target by kind): the target is named by table, sys_id and field, not by
  category.

Score **1**.

### passes_gate

`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here 2 and 1 → **1**. `fix_target_correct` and `evidence_cites_trace_and_config`
are not gate terms. No void condition applies: the packet records the m2m gate as
on (seed spec status 2026-08-09, and the report's layer-7 sweep confirms the m2m
wiring), the terminal state is `completed`, and a full report body was produced.

### ambiguity

`ambiguous` = **no**. Every column was determined by the material in the packet:
the primary root cause is unambiguously RC-1 (first-ranked, with RC-2 self-marked
advisory), RC-1 declares its layer explicitly, FIX-1 declares a specific target
with literal current and proposed values, RC-1's Evidence row carries both halves
in one place, and section 5's tool list backs both citation families. Section 3's
advance ruling removes the one genuine open question this seed carries (whether
activation alone restores the acknowledgement), so that question was not re-derived
and is not a ground for flagging.
