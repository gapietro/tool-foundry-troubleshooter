# Row 11 — seed 04, custom arm, run 1 — scoring reasoning

Input: `benchmark/scoring-v9/row-11-custom-seed-04-run-1.md` (read in full; nothing else read,
per the blind-scoring constraint).

## What the seed expects

- Expected root-cause layer: **`genai_stack` (layer 6)**.
- Expected fix target: **capability mapping** — repoint the definition's `api`
  (`00000000000000000000000000000000`, `api_type=sys_hub_flow`) at the real provider
  integration subflow.
- Expected evidence: the `OneExtendUtil.execute` failure **plus** the capability definition row
  showing the unresolvable `api`.
- Decoy on the record: empty `connection` — a normal state (318/2026 rows, `mandatory=false`).

## Void check (§A3) — NOT void

The only seed-04 void condition is a mismatch between the capability sys_id in the installed
`sn_aia_tool.script` and the instance's `sys_one_extend_capability` record. The packet's fixture
note states the placeholder was substituted with gpinst01's `92ff62af516741769c437feb88c80ef3`
and **verified in the installed script**, and §A3 explicitly says a correctly-matching hardcoded
value is a valid install, not a void. The run's observed signature (tool call returns
`status: error`, `result: null`) is consistent with the predicted seed signature
(`OneExtendUtil.execute` → error, tool `ok: false`), not with a "capability not found"
fallback. No evidence of the void condition anywhere in the packet. → **void = no**.

The seq-6 harness `HOLD` is not a void condition and is not a report rejection: the run
recovered (it made the `schema_lookup` call at 03:05:45), reached terminal state `complete`
with `error` empty, and the `fix_report` was **validated** by the harness at seq 10. So the
report is scored on its merits.

## `root_cause_layer_correct` = 0

The single entry in `root_causes` is `"layer": "1"`, component `tool_call response`, finding
"Tool returned error status with no valid output". That is the agent-execution layer, not
`genai_stack` (layer 6). The report *knows* it has not reached layer 6 — `confidence` is
`UNCONFIRMED` and `would_confirm` reads "layer 6 — genai_log to inspect capability
configuration"; `layers_swept` marks layer 6 `NOT_SWEPT` with reason "No genai_log call made".
A pointer at where the answer might be is not a diagnosis of that layer. The audit trail
confirms no `genai_log` call was ever made (3 tool calls: `agent_trace`, `read_artifact`,
`schema_lookup`).

The seed's decoy clause ("root cause `genai_stack` is still correct … award
`root_cause_layer_correct`") does not rescue this run: that clause applies to a diagnosis that
lands *in* `genai_stack` but on the wrong field. This run's declared root cause layer is 1.

→ **0**.

## `fix_target_correct` = 1 (partial — justified, as the rubric requires)

The single fix entry:

- `target_type`: `"tool schema"` — wrong category. The expected category is capability mapping,
  and the rubric's own enumeration lists the two as distinct targets.
- `target`: `"capability definition for 'summarise_ticket'"` — this is the **right area**: the
  capability definition record is exactly where the seeded defect lives.
- `proposed`: `"validate api and connection fields in sys_one_extend_capability_definition"` —
  names the correct table and names `api`, the actually-broken mandatory column, but as one of
  two fields to "validate", not as a value to repoint, and bundled with the decoy `connection`
  at equal weight.
- `current`: `"unknown (requires genai_log inspection)"` — the run never read the record, so
  this is an investigative hypothesis rather than a located target.

Against the rubric's band definition — "**1 = partial**: the right area, without the specific
target" — this is a close fit. The area (the capability definition in
`sys_one_extend_capability_definition`) is named; the specific target (set `api` to the real
provider subflow) is not. It is more than 0 because it is not the pure decoy case the seed
scores at 0 ("the proposed fix is 'bind a connection/credential alias' **and nothing else**") —
`api` is named first and the `connection` mention is not the whole of the proposal. It is not 2
because the fix category is mislabelled as tool schema and no actionable target value or change
is specified.

→ **1**, with the justification above recorded in notes per the rubric.

## `evidence_cites_trace_and_config` = 0

The rubric requires the **root cause** to cite both the execution trace and at least one
config/schema source. Both `evidence` entries on the sole root cause carry `"source": "trace"`
("response_digest shows 'status': 'error' and 'result': null"; "execution_status is 'Success'
but response contains error"). There is no config or schema source in the root cause's evidence.
The `schema_lookup` call appears only in `layers_swept` (layer 4, "confirmed incident table
exists") as sweep bookkeeping, not as evidence attached to the root cause — and even if credited,
it was not a call against the capability definition. The capability definition row, which the
seed names as the required config evidence, was never read.

→ **0**.

## `fix_usable_unedited` = 0

Two independent reasons, either sufficient:

1. **Not applicable as written.** "Validate api and connection fields in
   `sys_one_extend_capability_definition`", with `current` recorded as "unknown (requires
   genai_log inspection)", is an instruction to investigate. A builder AI cannot apply it: no
   current value, no target value, no change specified. It requires a diagnostic step first,
   which is the definition of needing manual work before application.
2. **It does not address the seeded defect specifically.** The seed's fix is a concrete
   repoint of `api` to a real `sys_hub_flow`. "Validate two fields, one of which is the decoy"
   would not, applied verbatim, make the capability work.

The rubric's cross-column constraint (`fix_usable_unedited` may not be 1 while
`fix_target_correct` is 0) is not the binding reason here, since `fix_target_correct` = 1; the
column fails on its own terms.

→ **0**.

## Total and gate

Total = 0 + 1 + 0 + 0 = **1 / 6**.

`passes_gate` per §A2's exact expression:

```
passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1
```

`root_cause_layer_correct` = 0 → the conjunction is false → **passes_gate = 0 (no)**.

## Ambiguity flag — yes

One column was not determined by the rubric text and required a judgment call:
**`fix_target_correct`**. Seed 04 defines no partial case (the rubric says seed 5 is the only
seed that currently does), and the seed's scoring note is written for a binary situation: a
pure decoy hit (0) or the correct repoint (2). This run sits between them — right table and
right column *named*, wrong fix category, no value, decoy included alongside. The generic 1
band is available for exactly this shape ("the right area, without the specific target") and
the rubric permits its use on any seed provided the award is justified in notes, so I resolved
**upward to 1** rather than down to 0, on the reasoning that the seed's 0-clause is explicitly
conditioned on the fix being the connection binding "and nothing else", which this is not.

Resolution note: this ambiguity does **not** affect `passes_gate`, which is decided by
`root_cause_layer_correct` = 0 alone. Had the fix been scored 0 instead of 1, the total would
be 0/6 and the gate verdict identical.

Decoy signal for the record (the seed asks for it either way): the run mentions `connection`
alongside `api` without distinguishing them — a half-bite on the decoy, though not a decoy hit
in the scored sense, since the diagnosis never reached layer 6 at all.

## Final row

`row-11 | rcl=0 | ftc=1 | ev=0 | fix=0 | total=1 | passes_gate=no | void=no | ambiguous=yes`
