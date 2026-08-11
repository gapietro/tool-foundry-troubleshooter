# Row 20 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 0 |
| evidence_cites_trace_and_config | 0 |
| fix_usable_unedited | 0 |
| total | 0/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct

The seed spec's header table prints `Expected root-cause layer` = `tool_definition` (layer 3).

§A2.2 says to apply Case 2 first. The report's `root_causes` array holds exactly
one entry, so Case 2 does not arise — that single entry is the subject.

Case 1 governs: the entry declares a layer explicitly (`"layer": "1"`). The rule
is unambiguous — *"Where the report declares a layer … score the declared value.
Compare it against the seed spec's expected layer and score 2 on a match, 0
otherwise."* Declared 1 ≠ expected 3, and it is not a compound naming the
expected layer among its conjuncts. **Score 0.**

Case 1 also forbids reading the finding text for substance, so it makes no
difference either way that the finding ("Agent task was cancelled without
completing its objective") describes neither the layer-3 mechanism nor the
layer-2 decoy — the declared value is the score. Note also that the run did not
even fall for the seed's named decoy (the instruction / layer 2); it landed on
layer 1, execution, which is a different miss and equally 0.

Section 3's advance ruling is consistent with this and did not need to be
invoked, since the run never asserted the layer-2 reading the ruling settles.

### fix_target_correct

The seed's `Expected fix target` row names the area as the **tool's output
contract** — "make `check_processing_status` capable of returning a terminal
status, or bound the poll inside the script" — i.e. §A's *tool schema* area. The
*Expected diagnosis* section names the specific target: `check_processing_status`
returning a constant non-terminal status and therefore unable to report
completion.

The report proposes one fix. Per §A2.3 Case 1, it declares its target
(`"target_type": "data"`, `"target": "batch reference BR-2298 records in relevant
table"`), so the declared value is scored. `data` is the *data seeding* area, not
the tool-schema area — a different one of §A's five areas, which is the **0**
band. It is not a compound target with a conjunct in the expected area, and no
prose in the fix body could lift it in any case, since Case 1 scores the declared
value.

The seed spec additionally rules out the instruction reading; that exclusion is
not what decides this row — the fix does not name the instruction either. The
`verification` line does mention `check_processing_status`, but it is a
verification step, not the fix's target, and Case 1 explicitly refuses to credit
an area a fix merely brushes past.

Case 2's boundaries confirm: not the specific target (no 2), not the expected
area (no 1). **Score 0.**

### evidence_cites_trace_and_config

§A1 in order. Case 1: a root cause is stated, so the column has a subject.
Case 2: exactly one entry, so it is the primary — the layer-1 "Agent task was
cancelled without completing its objective" finding.

The trace half is satisfied: both `evidence` entries carry `"source": "trace"`,
they name the artifact the root-cause statement names (the cancelled agent task /
its status and execution time — Case 3 met), and the audit trail records an
`agent_trace` call, the only tool family that backs this half (Case 4 met).

The config/schema half is **not** satisfied. The primary root cause's `evidence`
list contains no config/schema citation at all — both entries are trace. The
audit trail does record a `schema_lookup` and a `read_artifact` call, so a
config/schema citation *could* have been backed under Case 4, but Case 4 only
tests a citation that exists. The `schema_lookup` result appears only in the
`layers_swept` table (layer 4: "schema_lookup confirmed sn_aia_tools_execution
table exists"), which is exactly the situation Case 5 addresses: a config/schema
source appearing elsewhere in the document — here a sweep table — does not count
unless the root cause's own evidence refers to it explicitly. It does not; the
root cause's evidence array names only trace items, and proximity in the document
is not a reference. `read_artifact` is not cited anywhere in the report body.

The conjunction therefore fails on the config/schema half. **Score 0.**

### fix_usable_unedited

§A2.1's opening instruction is to check §A's constraint first: *"`fix_usable_unedited`
may not be 1 while `fix_target_correct` is 0."* `fix_target_correct` is 0 above, so
the constraint binds and the column is **0**; no case in §A2.1 arises.

Recorded for completeness only, since the constraint has already decided it: the
fix would fail independently. §A2.1 Case 4 — the target is "batch reference
BR-2298 records in **relevant table**", a table identified by kind rather than by
name, which is the described *class* Case 4 scores 0. And Case 1 — "Verify
existence of batch records and ensure agent has read access" is a discovery
procedure with no value, no field and no operation on a named record; the seed's
own spec states the tool "consults no record and writes nothing", so this fix is
a no-op against the seeded defect regardless.

### passes_gate

`passes_gate = 1` iff `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`.
Here root_cause_layer_correct = 0 and fix_usable_unedited = 0, so both terms fail.
**`passes_gate` = 0.**

No void condition applies. The run reached terminal state `complete` with a full
report body (§A3's run-state void condition requires `terminated` /
`execution_failed` with no report body — not met; note the `execution_failed`
string in this report refers to the *execution under diagnosis*, seed 08's own
run, not to this diagnostic run). The seed-state void conditions in §A3 name only
seeds 4 and 5. The seed's qualification bar was met per section 2 (27 calls,
2026-08-11), and section 6 records no run-specific notes and no harness HOLDs.

### ambiguity

`ambiguous` = **no**. Every column was determined by the packet's own material,
and none required weighing:

- `root_cause_layer_correct` — a single root cause carrying an explicit `layer`
  field, scored by §A2.2 Case 1 against the seed header's expected layer. Purely
  mechanical.
- `fix_target_correct` — a single fix carrying an explicit `target_type` field,
  scored by §A2.3 Case 1 against the seed's expected area and specific target.
- `evidence_cites_trace_and_config` — one root cause, an explicit `evidence`
  array, and an audit trail listing the distinct tool names; §A1 Cases 3–5 decide
  the config/schema half on the report's own text.
- `fix_usable_unedited` — decided by §A's constraint before any case arises.

The audit trail's one stated omission (the per-call ordered list with arguments)
does not bear on any column here: Case 4 only needs the tool *families* called,
which the packet lists, and the config half fails for want of a citation rather
than for want of a backing call.
