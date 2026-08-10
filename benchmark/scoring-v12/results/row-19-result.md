# Row 19 — scorer verdict

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

First, the void check (§A3): seed 5 is void if the
`sn_aia_trigger_agent_usecase_m2m` gate was not on post-install. The seed spec's
status note (2026-08-09) records that gate — sys_id
`ba30d8775b0c4cebb960c58830590d5d` — still reading `active=true`, and §5 states
this run reached a terminal state and that no row in this pass was void. The
report's own sweep is also consistent with a single-gate seed: it found one
trigger link and reported the *trigger configuration* as `active = "0"`. Not
void, so the four columns are scored.

Second, the §A2/§A ordering constraint: `fix_usable_unedited` may not be 1 while
`fix_target_correct` is 0. `fix_target_correct` is 2 here, so the constraint does
not bind and §A2.1's cases are live.

### root_cause_layer_correct
The seed spec's expected root-cause layer is `wiring` (layer 7). RC-1 in the
report is titled "Trigger configuration inactive *(CONFIRMED)*" and its Layer
attribute reads "7 — Trigger and wiring", with the component named as
`sn_aia_trigger_configuration`. That is the seed's expected layer, named
explicitly and carried as the confirmed primary root cause (RC-2 and RC-3 are
labelled UNCONFIRMED/secondary and do not displace it). **2.**

### fix_target_correct
The seed spec's expected fix target is **activation**, and "The two gates"
section plus "Expected diagnosis" are explicit that stopping at the generic
"the use case/trigger is inactive" scores the partial band 1, while naming
`sn_aia_trigger_configuration.active` specifically scores full credit.

FIX-1 names exactly that: target type Configuration, target
`sn_aia_trigger_configuration` · sys_id `bfb77d6c64884500a80203ee029436ee` ·
field `active`, current `0`, proposed `1`. RC-1's Finding and Evidence rows also
identify the field on that specific table rather than describing the use case as
inactive in the abstract, and the report never conflates the trigger-configuration
gate with the m2m gate. This is the full band, not the partial one. **2.**

### evidence_cites_trace_and_config
Both source kinds are present in the root cause itself, not only in the
narrative:

- **Execution trace:** the FAILURE SUMMARY states no execution plan was ever
  created, "confirmed by `agent_trace`, which found zero rows in
  `sn_aia_execution_plan` for this agent", and RC-1's Confidence row repeats "no
  execution plan exists in `sn_aia_execution_plan`". For a seed whose signal is
  the *absence* of an execution, a cited zero-row `agent_trace` result is the
  trace evidence available; the run performed the call (§4 lists `agent_trace`
  among the distinct tools) rather than asserting the absence unsupported.
- **Config/schema:** RC-1's Evidence row cites the `agent_config` artifact
  `1778bdba2b2e8318f243fed2ce91bf15`, triggers section, quoting
  `trigger.sys_id = bfb77d6c64884500a80203ee029436ee` and `trigger.active = "0"`,
  corroborated by `overview.active_trigger_links = 0` and
  `overview.active_trigger_configurations = 0`. Layer 4 additionally records a
  `schema_lookup` on `x_snc_tsbench_ticket`.

Trace AND at least one config source, both attached to the root cause. **1.**

### fix_usable_unedited
FIX-1 is applicable as written. It resolves to **exactly one record** (table
`sn_aia_trigger_configuration`, sys_id `bfb77d6c64884500a80203ee029436ee`) and
**names every field it changes** (`active`, `0` → `1`), which is precisely
§A2.1 Case 2's condition for scoring 1; per that clause, translating the unique
runtime address into its Fluent source is not an edit. §A2.1 Case 1 does not
arise for FIX-1 — no value slot is left for the builder to fill, the proposed
value is stated literally. And it addresses the defect the seed actually
carries: `sn_aia_trigger_configuration.active` is `false`, and the spec's
"Expected diagnosis" sanctions "flip `sn_aia_trigger_configuration.active` to
`true` on that trigger" as the fix.

Two things I weighed and did not let reduce the score:

1. **FIX-2 leaves a value slot open** ("Set `run_as_field` to the field … that
   holds the submitting user (e.g. `caller_id` or `opened_by`) … Confirm the
   exact field name from the `x_snc_tsbench_ticket` schema before applying") —
   and per the seed spec that table declares only `short_description` and
   `priority`, so neither example field exists. FIX-2 is, on the packet's own
   evidence, an unusable fix for a non-defect (the spec's #151 note establishes
   the empty run-as does **not** bite here). But FIX-2 is explicitly secondary,
   addressing an UNCONFIRMED root cause, and FIX-1 is stated as "the single
   change required to unblock the agent". The column scores whether the proposed
   fix for the seeded defect is applicable, and FIX-1 is.
2. **The execution-layer second defect.** The seed spec's #151 note records that
   flipping `active` to `true` makes the trigger fire but does **not** produce
   the acknowledgement (plan created with `status=error`, 0 tasks, 0 tool calls,
   `execution_mode=interactive`, empty `objective`). The spec says in terms that
   "the exposure is `fix_usable_unedited` only", that "§A2.1's clauses do not
   cover this case", and that any pass including seed 05 "must rule on it in its
   pre-registration, before the scorers meet it." **That ruling is not in this
   packet.** Scoring only what the packet contains, I apply §A's literal
   definition — the fix is applicable unedited and addresses the defect the seed
   actually carries — and score **1**, while flagging the column as
   under-determined below.

### passes_gate
`passes_gate = 1` iff `root_cause_layer_correct == 2` AND
`fix_usable_unedited == 1`. Here: 2 and 1 → both terms satisfied →
**`passes_gate` = 1**. `fix_target_correct` and
`evidence_cites_trace_and_config` are recorded but do not feed the expression.

### ambiguity
**Yes — one column: `fix_usable_unedited`.**

Two defensible readings, and the packet contains the material that creates the
conflict without the material that resolves it:

- **1** — §A defines the column as "could be applied by the builder AI as
  written … and it addresses the defect the seed actually carries." The seed's
  carried defect is `sn_aia_trigger_configuration.active = false`; FIX-1 targets
  exactly that field on exactly one named record with a literal proposed value,
  satisfying §A2.1 Case 2 in full. The execution-layer termination is a *second,
  separate* defect that the seed does not carry and that the spec says "does not
  disqualify the seed".
- **0** — the seed spec's live measurement is that this fix, applied unedited,
  "does not restore the acknowledgement", i.e. the observable failure the
  diagnostic agent was asked to explain persists after the fix. A scorer reading
  "usable" outcome-first — the reading §A2 itself adopts when it insists a
  well-formed fix that "fixes **nothing**" scores 0 — lands on 0.

The spec explicitly anticipates this fork, states that §A2.1 does not resolve it,
and defers it to a pre-registration ruling that a blind scorer cannot see. That
is under-determination by construction, not a rounding preference, and because
this column is one of §A2's two gate terms it flips `passes_gate` between 1 and
0. I have scored the reading that follows §A's literal wording and flagged the
packet.

The other three columns were determinate. `root_cause_layer_correct`: the report
prints "Layer | 7 — Trigger and wiring" against the spec's `wiring` (layer 7) —
no interpretation needed. `fix_target_correct`: the spec states the exact
discriminator between 1 and 2 (naming `sn_aia_trigger_configuration.active`
versus generic inactivity), and the report names the specific table, sys_id and
field, so it falls on the full-credit side of a stated line.
`evidence_cites_trace_and_config`: both an `agent_trace` result and an
`agent_config` artifact are cited inside RC-1 with identifiers, so the
conjunction is satisfied on the face of the text — the only wobble I considered,
whether a zero-row trace counts as citing the trace, is settled by the seed spec
stating that for this seed the diagnostic target *is* the absence of an
execution, which makes the zero-row read the trace evidence rather than a
substitute for it.
