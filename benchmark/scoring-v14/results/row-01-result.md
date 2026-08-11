# Row 01 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 1 |
| total | 4/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct

The seed spec's header table prints `Expected root-cause layer` = `instruction` (layer 2).

The report states four root causes (RC-1 … RC-4), so **§A2.2 Case 2 applies first** and
selects the subject: "the entry the report itself labels primary or ranks first, else the
first entry in the list, skipping … any entry that asserts no defect exists." The report
labels no entry primary. RC-1 ("No routing/assignment tool attached", CONFIRMED) is first
and does assert a defect, so it is not skipped. **The primary is RC-1.**

Case 2 also states, in as many words: "Do **not** scan the list for an entry that happens to
carry the expected layer." RC-2 ("Instructions mandate an assignment action no tool can
fulfill", `Layer: 2 — Instructions`) does carry the expected layer, but it is a secondary
entry and reaching into it is exactly the scan-the-list reading Case 2 forbids.

RC-1 declares a layer explicitly — `**Layer:** 3 — Tool definitions` — so **§A2.2 Case 1**
applies: "Where the report declares a layer … score the declared value," and "Do **not**
score the substance of the finding text." The declared value is a single layer (3), not a
compound naming several, so the compound clause does not reach it. 3 ≠ 2 → **0**.

I note, and deliberately do not act on, that RC-1's finding prose is substantively about the
instruction demanding an action the agent cannot perform, and that the FAILURE SUMMARY says
"its instructions demanded an assignment action it had no tool to perform." Case 1 forecloses
a substance reading ("a root cause filed under layer 3 whose prose describes the seed's
layer-2 mechanism scores **0**"), and the FAILURE SUMMARY is not a root-cause entry.

### fix_target_correct

Per **§A2.3 Case 2**, the two inputs are read from two places in the seed spec: the
`Expected fix target` header row gives the **area** — "the instruction text" — and the
*Expected diagnosis* section names the **specific** target — "the instruction text — name the
groups, or supply a lookup tool and say to use it." The seed spec rules no reading out in
as many words, so the 0-by-exclusion branch does not arise.

The report proposes three fixes, so the column takes "the highest value any single
non-hedged proposed fix earns," skipping hedged/optional/follow-on entries. FIX-3 is
explicitly conditional ("if event-driven routing is required") and is skipped. FIX-1 and
FIX-2 are unhedged.

- **FIX-1** declares `Target type: Tool definition + tool binding`. Per Case 1 the declared
  value governs, and per the compound clause a declared target is read on the conjunct
  naming the expected area — neither conjunct does. FIX-1 scores **0**.
- **FIX-2** declares `Target type: Instruction`, `Target: sn_aia_agent[cd050d48e810411d9f113fd530694fe6], field instructions`. That is the expected area, and it
  names the specific target the *Expected diagnosis* section names ("the instruction text"),
  in that section's own terms. Its `Proposed` body performs the second of the two sanctioned
  operations — directing the agent to use a lookup/routing tool ("Then use `route_request` to
  assign it to the correct group") and guarding the confirmation. That is "supply a lookup
  tool and say to use it," on the instruction side. FIX-2 earns **2**.

The restriction that the 1 band is available only from the primary fix does not bite, because
the value taken here is 2, and the rule expressly allows a later fix to lift the column to 2
by naming the specific target ("Scoring it 0 because it ordered its fixes differently would
charge a report for its layout, not its aim").

Column value = highest single non-hedged fix = **2**.

### evidence_cites_trace_and_config

**§A1 in order.** Case 1 does not arise — the report states root causes. Case 2 arises (four
root causes) and selects the **primary, RC-1**, by the same rule used above; the column is
evaluated against RC-1 alone, and "a report whose primary complies scores 1 though a
secondary does not."

RC-1's own Evidence block carries both halves:

- **Trace half:** "Trace `tool_call_stats`: `total = 1`, sole call is `measure_request` …
  (artifact `fe6edb072bae4310f243fed2ce91bf46`, tool_calls)" and the task_tree citation of
  the order-300 Gen AI task.
- **Config half:** "`sn_aia_agent_tool_m2m` read status `ok`, `tool_binding_rows = 1` …
  (artifact `4b9e9f872bae4310f243fed2ce91bf6b`, evidence_basis)" and the agent description
  from the same agent_config artifact.

**Case 3** (connection): RC-1's statement names `sn_aia_agent` record
`cd050d48e810411d9f113fd530694fe6`, "tool binding set", the single binding
`da3f01db9aec41da835887210ed4b902` and the tool `measure_request`. The config citation names
the tool-binding M2M and its row count; the trace citation names `measure_request` and the
tool-call stats. Both cite artifacts the root-cause statement itself names. Connected.

**Case 4** (a call in the trail backs it): section 5 records distinct tool names
`agent_trace`, `read_artifact (x10)`, `agent_config`, `genai_log (x2)`, `log_analysis`. The
trace half is backed by the recorded **`agent_trace`** call; the config/schema half is backed
by the recorded **`agent_config`** call, which is in the enumerated list of the other six.
Both satisfied. No validator rejection is carried in this packet.

**Case 5** (co-location): both halves sit inside RC-1's own `Evidence:` list, offered as
evidence for RC-1 — not in the failure summary or the layers-swept table. Satisfied.

Both halves present, connected, backed and co-located under the primary → **1**.

### fix_usable_unedited

**§A's constraint is checked first:** `fix_usable_unedited` may not be 1 while
`fix_target_correct` is 0. Here `fix_target_correct` = 2, so the constraint does not bind and
the cases arise.

**§A2.1 Case 5** selects the subject: "the proposed fix that addresses the defect the seed
carries." The seeded defect is an instruction that requires a determination the agent has no
means to make, and the sanctioned repair is on the instruction text. **FIX-2** is that fix.
FIX-1 is declared against the tool definition/binding — an area the seed's expected-target
row does not name — and Case 5's own note ties the subject to aim ("a fix aimed anywhere else
scores this column 0 regardless"), so FIX-1 is a fix aimed at another finding: "neither
credited nor charged." FIX-3 is aimed at trigger wiring and is likewise out of scope. So one
fix is under evaluation, and Cases 1–4 are each necessary conditions on it.

- **Case 1 — unfilled value slot:** the target (`sn_aia_agent[cd050d48e810411d9f113fd530694fe6]`), the field (`instructions`) and the
  operation (replace the quoted `Current` text with the quoted `Proposed` text) are all fully
  specified, and the replacement text is written out in full. No slot is left for the builder
  to fill and no discovery procedure is substituted for a value. Satisfied.
- **Case 2 — runtime record rather than Fluent source:** the address is a single
  `sn_aia_agent` record given by sys_id plus the one field it changes. It "resolves to
  exactly one record" and "names every field it changes," and translating that unique runtime
  address into its Fluent source is expressly not an edit. Satisfied.
- **Case 3 — incomplete edit:** the fix supplies a literal replacement rather than a
  characterisation. Both `Current` and `Proposed` are given verbatim, so applying the
  `Proposed` string exactly as given produces the change the fix describes. Nothing is
  described-but-not-written. Satisfied. (The fix names a tool, `route_request`, that FIX-1
  would create; that is a dependency on a companion fix, not a line the builder must invent —
  the instruction-field edit applies as written either way, and Case 5 forbids charging this
  fix for the other one.)
- **Case 4 — target named by kind:** it is named by record sys_id and field name, not by
  category. Satisfied.

All cases that arise are satisfied → **1**.

### passes_gate

`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here `root_cause_layer_correct` = 0, so the conjunction fails → **0**, despite a /6 total of
4. §A2 anticipates exactly this ("A run can score 3/6 and pass; a run can score 4/6 and
fail"), so the divergence is the gate asking the narrower question, not an inconsistency.

No void condition applies: the terminal state is **completed**, a full report body was
produced, and neither the seed-4 nor seed-5 seed-state condition is in play for seed 02.

### ambiguity

**Not ambiguous.** Every column was determined by the packet's own material:

- `root_cause_layer_correct` — the report ranks RC-1 first and declares `Layer: 3` on it;
  §A2.2 Cases 2 then 1 fix both the subject and the scoring of a declared layer without any
  weighing. The layer-2 entry sitting at RC-2 is a secondary, and the rule for that is
  explicit rather than left to judgement.
- `fix_target_correct` — FIX-2 declares its target type and names the record and field;
  §A2.3 Case 2's 1/2 boundary and the several-fixes rule both resolve on the printed text of
  the seed spec's header row and its *Expected diagnosis* section.
- `evidence_cites_trace_and_config` — both halves appear inside the primary's own evidence
  block, and section 5's distinct-tool list mechanically backs both families.
- `fix_usable_unedited` — the fix hands over a complete literal replacement against a single
  named record and field.

The FIX-1 / FIX-2 subject selection under §A2.1 Case 5 was the one judgement that took real
work, but the packet determines it: Case 5's own note routes the subject by aim, and the seed
spec's expected-target row and *Expected diagnosis* section name the instruction text. That
is effortful, not under-determined, so per section 7 the flag stays `no`.
