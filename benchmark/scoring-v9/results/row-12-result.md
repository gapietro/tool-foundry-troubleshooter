# Row 12 — seed 04, custom arm, run 2 — blind scoring

**Scored from:** `benchmark/scoring-v9/row-12-custom-seed-04-run-2.md` only. No other file
read, no directory listing, no shell, no web. The packet's path-redaction note was treated as
expected and not as a defect in the run.

---

## Step 0 — void check (§A3), done first

§A3 lists exactly two known void conditions, one of which is for seed 4: the capability sys_id
in the installed `sn_aia_tool.script` does not match the target instance's
`sys_one_extend_capability` record.

Evidence in the packet:

- The seed spec's fixture-state block (verified 2026-08-02) records that the placeholder was
  substituted with `92ff62af516741769c437feb88c80ef3` and **verified in the installed script**,
  and that the seed execution produced the predicted signature (`OneExtendUtil.execute` →
  `status: "error"`, "Plan invalid…", `capabilities: {}`, tool `ok: false`).
- This run's own trace evidence quotes `capability_id: '92ff62af516741769c437feb88c80ef3'`
  from the tool response digest — i.e. the installed script carried the gpinst01 value, matching
  the record the spec says exists on gpinst01.
- §A3 states explicitly: "A hardcoded value that MATCHES the instance's record is a valid
  install, not a void."

The execution under diagnosis (`b85c799…bf2c`) is not the same execution as the one named in the
fixture-state block (`16ddc10c…bf15`). That is expected — this is run 2 of the seed, so a fresh
execution was captured per the Trigger step. Nothing in the packet suggests a different fixture
state.

The transcript carries a harness HOLD at seq 6 ("terminal action refused — layer 4 (ranked) must
be reached; layer(s) 2, 3, 4, 5, 7 declared NOT_SWEPT with no tool call behind them"). This is a
mid-run refusal of a premature terminal action, not a rejection of the delivered report: the run
then made a `schema_lookup` call, reached terminal state `complete` with `error` empty, and the
`fix_report` was **validated by the harness at seq 10**. §A3 defines voidness solely as "the seed
was not in the state its spec requires" — a HOLD is a property of the agent's behaviour, not of
the fixture. It is not a void condition and the packet gives no rule that converts it into one.

**void = no.** The four rubric columns are therefore scored, not left blank.

---

## Step 1 — what the seed expects

From the seed spec (§2):

- Expected root-cause layer: **`genai_stack` (layer 6)**.
- Expected fix target: **capability mapping** — repoint `api` at the real provider integration
  subflow. Explicitly *not* the tool script and *not* the agent instructions.
- Expected evidence: the tool's execution failure from `sn_one_extend.OneExtendUtil.execute`
  **plus** the capability definition row showing the unresolvable `api`.
- Decoy: empty `connection` is a normal state (318 of 2026 rows, `mandatory=false`).

## Step 2 — what the run actually said

The `fix_report` names:

- `root_causes[0].layer` = **"1"**, component `sn_aia_tools_execution tool call`, finding "Tool
  response returned error status with no valid result".
- `layers_swept`: layer 6 explicitly `NOT_SWEPT` — "No genai_log call made to inspect capability
  mappings". The audit trail confirms it: 3 tool calls (`agent_trace`, `read_artifact`,
  `schema_lookup`), audit-derived swept set 2/7 (L1, L4), no `genai_log` call, despite
  `layers_available` = 7/7 with all tools attached and active.
- `fixes[0].target_type` = **"tool schema"**, target "summarise_ticket tool input schema",
  `current` = "Unknown (not inspected via agent_config)", `proposed` = "Validate input schema
  matches ticket table fields".

## Step 3 — column by column

### `root_cause_layer_correct` = **0**

The run names layer 1. The seed's expected layer is 6 (`genai_stack`). Not the same layer, and
not a paraphrase of it — the run affirmatively declares layer 6 unswept. This is not even the
decoy case (which would still have landed in `genai_stack` and earned 2); the run never reached
the GenAI stack at all. **0.**

### `fix_target_correct` = **0**

The rubric's enumerated targets are tool schema / instruction text / data seeding / capability
mapping / activation. The run picks **tool schema**; the seed's target is **capability mapping**.
Wrong target, and not the same area — the seed spec explicitly rules out the tool script as the
fix target ("not the tool script and not the agent instructions").

The 1 (partial) band was considered and rejected. Partial is defined as "the right area, without
the specific target"; seed 5 is the only seed that currently defines a partial case, and for
others 1 must be justified. There is nothing here to justify: "tool schema" is a different
enumerated category from "capability mapping", not an under-specified version of it. **0.**

### `evidence_cites_trace_and_config` = **1**

The column reads: "Root cause cites BOTH the execution trace AND at least one config/schema
source". The run's single root cause carries a two-element `evidence` array:

- `{"source": "trace", ...}` — tool_call status and response_digest from the execution trace.
- `{"source": "schema", ...}` — `schema_lookup` confirming `error_message` exists on
  `sn_aia_tools_execution`.

Both halves are literally present, and the schema citation is backed by a real tool call in the
audit trail (`schema_lookup` at 03:08:07), so this is not a fabricated citation.

I considered scoring 0 on the ground that the cited schema fact is irrelevant to the seeded
defect and supports a wrong root cause. I rejected that reading for three reasons, all internal
to the packet:

1. The column's own text imposes a *form* requirement (cite both kinds of source), not a
   correctness requirement. It is glossed as "the evidence rule from the diagnostic agent's own
   instructions" — a citation-hygiene rule.
2. The rubric knows how to write a correctness qualifier when it wants one, and does so exactly
   once: `fix_usable_unedited` carries the explicit "and it addresses the defect the seed
   actually carries" clause plus the cross-column constraint. The absence of any such clause on
   `evidence_cites_trace_and_config` is deliberate contrast, not an omission to be filled in.
3. §A2 states that this column is not in the gate expression and exists as diagnostic detail
   explaining why a run passed or failed. A purely formal reading is consistent with that role.

Scored **1** on the plain reading. Flagging the reading here because it is the only column on
this row where a competent scorer could plausibly diverge; I do not consider the rubric
under-determined, since the contrast with `fix_usable_unedited` settles it in the packet's own
text. Recorded as `ambiguous=no` with the resolution stated rather than as a rubric gap.

### `fix_usable_unedited` = **0**

Two independent reasons, either sufficient:

1. **The hard constraint.** The rubric (§A, and again in the seed's scoring note) states
   `fix_usable_unedited` may not be 1 while `fix_target_correct` is 0. `fix_target_correct` = 0,
   so this is 0 by rule.
2. **Independently, on the merits.** The proposed fix is "Validate input schema matches ticket
   table fields", with `current` = "Unknown (not inspected via agent_config)". That is an
   instruction to investigate, not a change a builder AI could apply as written — there is no
   stated current value, no target value, and no artifact to edit. It would be 0 even without
   the constraint.

**0.**

### Total

0 + 0 + 1 + 0 = **1 / 6**.

### `passes_gate`

Computed from §A2 verbatim:

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
```

`root_cause_layer_correct` = 0 → the conjunction is false regardless of the second term.
**`passes_gate` = 0 (no).**

---

## Summary row

| Column | Value |
|---|---|
| `root_cause_layer_correct` | 0 |
| `fix_target_correct` | 0 |
| `evidence_cites_trace_and_config` | 1 |
| `fix_usable_unedited` | 0 |
| **total** | **1 / 6** |
| `passes_gate` | 0 (no) |
| void | no |
| ambiguous | no |

**Notes.** Not a decoy hit — the run never reached the GenAI stack and never mentioned
`connection`; it stopped at layer 1 and blamed the tool's input schema, with layer 6 declared
`NOT_SWEPT` for want of a `genai_log` call despite that tool being attached and active. One
harness HOLD at seq 6 for a premature terminal action; the delivered report was nonetheless
validated at seq 10, so the run is scored, not voided. Evidence column awarded on the rubric's
formal citation test — see the reasoning above for why the irrelevance of the cited schema fact
does not reduce it.
