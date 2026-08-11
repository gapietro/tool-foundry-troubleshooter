# Row 19 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| total | 5/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct

Seed 08's header table prints `Expected root-cause layer` = `tool_definition` (layer 3).

The report states four root causes, so **§A2.2 Case 2 applies first**: evaluate the column
against the primary, which the report itself labels — RC-1 is marked *(Primary)* and is
first in the list, and it asserts a defect (it does not assert that no defect exists), so
it is the subject. RC-2, RC-3 and RC-4 are not scanned.

**§A2.2 Case 1** then governs: RC-1 declares a layer in an explicit **Layer** row —
`3 — Tool definition / script`. The declared value is scored, and it matches the seed's
expected layer 3 → **2**. Per Case 1 I did not score the substance of the finding text;
as it happens the prose also describes the seeded mechanism (constant script, no terminal
branch, no clock, no counter, no record consulted), and the advance ruling in section 3
(the layer-2 "no completion criteria" reading scores 0) is not triggered, because the
primary entry is filed at layer 3 rather than layer 2. RC-2's layer-2 entry is a
secondary and is neither credited nor charged.

### fix_target_correct

Seed 08's `Expected fix target` row: **the tool's output contract** — make
`check_processing_status` capable of returning a terminal status, or bound the poll inside
the script; explicitly **not** the instruction. The *Expected diagnosis* section repeats
the specific target: "Fix target: the tool's output contract."

**§A2.3 Case 1**: FIX-1 declares its target — **Target type** `Tool script`, **Target**
`sn_aia_tool` · field: `script`. The declared value is scored, so FIX-2's instruction edit
and FIX-4's wiring edit do not move this column (and FIX-2's target, the instruction, is
the reading the seed's Decoys section rules out).

**§A2.3 Case 2**: FIX-1 does not merely land in the right area (tool schema / the tool's
own definition); its `Proposed` text names the specific target the *Expected diagnosis*
section names — the script's output contract, stated as "The script **must** be capable of
returning `\"complete\"` or `\"failed\"`", i.e. making `check_processing_status` able to
report a terminal status. That is the seed's specific target in the seed's own terms →
**2**. FIX-1 is also the report's primary fix, so the multi-fix restriction (1 band only
from the primary) does not bite.

### evidence_cites_trace_and_config

**§A1 Case 1** does not arise — a root cause is stated. **§A1 Case 2** selects the subject:
RC-1, the entry labelled *(Primary)* and ranked first, asserting a defect. The column is
read on RC-1's own Evidence row alone.

RC-1's Evidence row offers both halves:
- **config/schema half** — `agent_config` artifact (page 2), `tools[0].tool.script.body`;
- **trace half** — "All 75 `sn_aia_tools_execution` output digests in the trace … trace
  artifact pages 0–12".

**Case 3 (connection)**: RC-1's root-cause statement names `sn_aia_tool` · field `script`
and its constant return payload. The config citation names that same script body; the
trace citation names the runtime outputs of that same tool, with the identical payload
quoted in the finding. Both citations name artifacts the root-cause statement names.

**Case 4 (backed by the trail)**: section 5's distinct tool set records `agent_trace`
(backs the trace half, and is the only tool that can) and `agent_config`, `genai_log`,
`log_analysis`, `read_artifact` (any of the latter set backs the config/schema half —
`agent_config` is exactly what RC-1 cites). Both halves are backed.

**Case 5 (co-location)**: both citations sit inside RC-1's own Evidence row; nothing had
to be reached for elsewhere in the document.

All tests pass → **1**.

### fix_usable_unedited

§A's constraint does not bind — `fix_target_correct` is 2, not 0 — so the §A2.1 cases run.

**§A2.1 Case 5** selects the subject: the proposed fix addressing the seeded defect is
**FIX-1** (the constant tool script that cannot report completion). FIX-2 (instruction poll
cap), FIX-3 (`max_auto_executions`) and FIX-4 (use case / trigger wiring) address other
findings and are neither credited nor charged.

Cases 1–4 are each necessary conditions on FIX-1; the first that fails decides.

**Case 3 decides it, and it fails.** FIX-1 hands over a code snippet as its replacement
text, so Case 3 is in scope and the test is whether "applying that text exactly as given
produces the change the fix describes". It does not. The snippet is a template carrying
four unwritten substitutions — `new GlideRecord('<batch_table>')`,
`gr.getValue('<status_field>')`, `<pct_field>`, `<note_field>` — under the fix's own
instruction to "substitute the correct table and field names from your data model".
Applied verbatim it queries a table literally named `<batch_table>` and reads fields
literally named `<status_field>`, which is not "a real implementation that reads the actual
batch job record and returns its current status". This is precisely Case 3's stated 0
shape: a replacement that is **characterised rather than given**, a substitution the fix
*describes* but does not *write*. (Two further defects point the same way and are not
needed for the score: the snippet uses bare top-level `return` rather than the
self-invoking form a tool script requires, and `ref` is never bound.)

I considered whether the `<batch_table>` gap is instead a **Case 1** missing-*value*
question, where an unobtainable value would be the builder's to fill. It does not rescue
the column: Case 3's own distinction note states that Case 1 is about a missing value while
Case 3 is about a missing **edit**, and that a fix can name its target perfectly and still
score 0 "because the text it hands the builder does not perform the change when run".
Case 3 is a necessary condition in its own right, and "passing a later case does not lift
an earlier one's bar" — nor does passing a different one. Score **0**.

### passes_gate

`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here root_cause_layer_correct = 2 but fix_usable_unedited = 0, so **`passes_gate` = 0**.
`fix_target_correct` (2) and `evidence_cites_trace_and_config` (1) are not gate terms and
do not enter the expression. This is the §A2 case stated in the rubric: a 5/6 run that does
not pass — the gate asks a narrower question than the rubric.

No void condition applies: the diagnostic run reached terminal state **completed** and
produced a full report body (§A3's run-state condition requires a platform-terminated
execution with no report text; the "Terminated / execution_failed" state in the report
belongs to the *seed* execution under diagnosis, not to this diagnostic run). The seed's
qualification bar (≥ 10 calls to one tool) is met by the 75 recorded
`check_processing_status` calls.

### ambiguity

**Not ambiguous.** Every column was determined by the packet's own material:

- `root_cause_layer_correct` — §A2.2 Case 2 fixed the subject (RC-1, self-labelled Primary)
  and Case 1 scored its explicitly declared **Layer** row against the seed header's
  expected layer.
- `fix_target_correct` — FIX-1 declares a target (§A2.3 Case 1) and the seed's *Expected
  diagnosis* section prints the specific target that FIX-1's `Proposed` text names
  (§A2.3 Case 2, 2 band).
- `evidence_cites_trace_and_config` — RC-1's Evidence row carries both halves, both name
  artifacts the root-cause statement names, and section 5's tool list backs both families.
- `fix_usable_unedited` — the judgement between §A2.1 Case 1 and Case 3 took work, but the
  packet resolves it: Case 3 is written for exactly this shape (a supplied snippet whose
  replacement is characterised rather than given) and is a necessary condition on its own,
  so the value is determined rather than guessed. Effortful is not the same as
  under-determined, and I have not flagged it as such.
