# Row 04 — scorer verdict

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

The seed spec names `tool_schema` (layer 3) as the expected root-cause layer, and its
M18 scoring note widens that by exactly one alternative: a run answering "layer 4 —
the column is Integer-typed and the tool sends a word" also scores full marks,
provided it states the *disagreement* between the tool contract and the column type.
Naming one side alone scores 0.

The report names **layer 5** (`"layer": "5"`, component "task record
c46a19ba2b228318f243fed2ce91bfca", finding "The ticket record required by the agent
does not exist"). That is neither layer 3 nor layer 4, and it does not describe the
word-vs-integer mismatch at all — it asserts the target record is absent. The report
explicitly declares layers 3 and 4 `NOT_SWEPT`, and the audit trail confirms that
mechanically: only `agent_trace` and `query_table` were called (2 tool calls, 2/7
layers), so no `agent_config` (tool description/script) and no `schema_lookup`
(column type) evidence was ever gathered. Nothing in the report gets near the seeded
defect. **0.**

### fix_target_correct

Expected fix target: the tool's **word-typed contract** — map the word to its integer
inside the script before `setValue`, or change the tool description plus the agent
instructions to pass 1–5.

The report's single fix is `target_type: "data"`, `target: "task record
c46a19ba2b228318f243fed2ce91bfca"`, `proposed: "Create the ticket record with valid
data"`. That is data seeding, not the tool's contract — a different area entirely, not
"the right area without the specific target". The rubric's 1 band is reserved for
right-area/wrong-specificity and (for seed 5) the named activation case; neither
applies. No justification exists for partial credit here. **0.**

### evidence_cites_trace_and_config

The rubric requires the root cause to cite BOTH the execution trace AND at least one
config/schema source. The report's `root_causes[0].evidence` array has exactly two
entries: `source: "data"` (query_table returned 0 rows, verdict `genuinely_empty`) and
`source: "trace"` (agent_trace showed the tool call attempting the update).

Trace is present. Config/schema is not — `data` is a runtime-record source, not a
config or schema source, and the audit trail independently confirms no `agent_config`
and no `schema_lookup` call was made in the run, so no such citation was available to
make. **0.**

### fix_usable_unedited

§A's constraint binds first and is decisive: `fix_usable_unedited` may not be 1 while
`fix_target_correct` is 0. `fix_target_correct` is 0 here, so this column is 0 and
neither §A2.1 Case 1 (unfilled value slot) nor Case 2 (runtime-record address) arises.

For the record, the fix would also fail on its own merits: it addresses a record the
seed's Setup step 2 requires to exist and to be the very record under test, and it
does nothing about the word-to-integer mismatch the seed carries — a well-formed
no-op, which is exactly what §A2's decoy discussion says must not be scored as
usable. **0.**

### passes_gate

`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here: 0 and 0 → **0**.

Not void: §A3's known void conditions are specific to seeds 4 and 5, this is seed 01,
and §5 states this run reached a terminal state and no row in this pass was void. The
report's *claim* that the ticket record does not exist is a claim of the run under
scoring, not an established setup failure — the packet header lists
`c46a19ba2b228318f243fed2ce91bfca` as the triggering record of a completed execution,
and the report's own mislabelling of it as a "task record" (the fixture table is
`x_snc_tsbench_ticket`) makes the 0-row `query_table` result more plausibly a
bad-lookup artifact than evidence of an unseeded fixture. Scoring, not voiding.

### ambiguity

`no` — all four columns were determined by the packet.

- `root_cause_layer_correct`: the report states a single root cause at layer 5 and
  never mentions the tool contract / column-type disagreement; both of the seed's two
  accepted answers (layer 3, or layer 4 *with* the mismatch) are plainly absent.
- `fix_target_correct`: one fix, explicitly `target_type: "data"` / "create the
  record" — no reading places it in the word-typed-contract area, so neither 2 nor the
  1 band is reachable.
- `evidence_cites_trace_and_config`: the evidence array is enumerated with explicit
  `source` labels — `data` and `trace`, no config/schema — and the audit trail
  corroborates that no config or schema tool was called.
- `fix_usable_unedited`: fixed at 0 by §A's stated constraint once
  `fix_target_correct` is 0; no weighing required.

The only judgement call in the row was void-versus-score (above), and §A3 plus §5
resolve it explicitly rather than leaving it open, so it does not make any of the four
columns under-determined.
