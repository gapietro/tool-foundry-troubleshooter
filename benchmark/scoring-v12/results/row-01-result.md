# Row 01 — scorer verdict

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

### root_cause_layer_correct

The seed spec's expected layer is `tool_schema` (layer 3), with the M18 scoring note
explicitly extending full marks to a run that answers from the layer-4 side ("the column
is Integer-typed and the tool sends a word"), provided the answer names the **disagreement**
rather than one half of it.

RC-1 is labelled "Layer 3 (tool script) + 4 (schema)" and states the mismatch directly:
the tool calls `gr.setValue('priority', inputs.priority)` with the string `"critical"`
while the column is Integer-typed with no choices, so GlideRecord discards the value and
the read-back is null. Both sides and the disagreement between them are named, which is
exactly what the note requires. The measured installed state (`has_choices: false`) is
reported correctly and, per the note, must not be penalised. The three additional root
causes (RC-2 non-mandatory inputs, RC-3 instruction bloat, RC-4 ReAct parser retry) are
secondary findings presented as such and do not displace RC-1 as the diagnosis of the
observed failure. **2.**

### fix_target_correct

Expected target: the tool's **word-typed contract** — map the word to its integer inside
the script, or change the tool description plus agent instructions to pass 1–5. Explicitly
**not** "constrain the input schema to 1–5", which the Fluent input schema cannot express.

FIX-1 targets `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac]`, field `script`, and proposes
a word-to-integer map (`{critical:1, high:2, moderate:3, low:4, planning:5}`) plus a
validation guard before the write. That is the first of the two sanctioned fixes, verbatim
in kind. FIX-2 does touch `input_schema`, but only to flip `mandatory` flags for RC-2 — it
does not claim to fix the type mismatch and is not an attempt at the disallowed
"constrain the schema to 1–5" answer, so it neither substitutes for nor dilutes FIX-1.
No partial-credit reading is needed. **2.**

### evidence_cites_trace_and_config

RC-1 carries four labelled evidence lines:
- **trace** — `sn_aia_tools_execution` row `f6805d722b6e4318f243fed2ce91bf3f` with response
  `{"ok":true,"priority_requested":"critical","priority_stored":null}` — this is precisely
  the "priority_stored disagreeing with priority_requested" evidence the seed spec names.
- **schema** — `schema_lookup` on `x_snc_tsbench_ticket.priority`: `type: "Integer"`,
  `has_choices: false`, `declared_on: x_snc_tsbench_ticket` — the dictionary/schema source.
- **config** — the tool script body read out of the `agent_config` artifact.
- **data** — `query_table` showing `priority: ""` after the run.

Both required classes are present (execution trace AND at least one config/schema source,
here two independent ones), and section 4's audit trail independently confirms
`agent_trace`, `schema_lookup`, `query_table`, `agent_config` and `genai_log` were all
actually called, so the citations are not narrative. **1.**

### fix_usable_unedited

The §A gate constraint does not bind: `fix_target_correct` = 2, not 0, so §A2.1's two cases
are live.

- **Case 1 (unfilled value slot)** does not apply — the fix supplies its own values; the
  full word→integer map is written out literally.
- **Case 2 (fix addresses a runtime record rather than Fluent source)** does apply and is
  the governing case. The address is `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac]`, field
  `script` — a single sys_id resolving to exactly one record, with the one field it changes
  named. No scorer has to work out which record or which field is meant, and per Case 2
  translating that runtime address back to its Fluent source is not an edit to the fix.
  That determines **1**.

The fix also addresses the defect the seed actually carries: mapping the word to an integer
before `setValue` is the seed's own stated remedy, and the VERIFICATION section states the
expected post-fix observation (`priority_stored` returning a non-null integer, `1` for
critical), which pins the intended behaviour unambiguously. **1** — with the caveat recorded
under ambiguity below.

### passes_gate

`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here 2 and 1, so **passes_gate = 1**. Neither §A3 void condition applies: those are
specific to seeds 4 and 5, section 5 states this run reached a terminal state and was not
void, and section 4 records terminal state `completed` with no harness HOLDs.

### ambiguity

`ambiguous: yes`, driven by **one** column.

**fix_usable_unedited — under-determined.** Two readings a careful scorer could defend:

1. **1 (the value I recorded).** §A2.1 Case 2 is written to decide exactly this shape of fix
   — a runtime record address — and both of its tests pass (one record, field named). The
   operation is described ("add a word-to-integer map at the top of the IIFE and validate
   before writing"), the map values are supplied, and the verification step states the
   expected stored integer, so a builder AI has everything it needs.
2. **0.** Read strictly as "applied as written, with no manual editing", the proposed
   snippet computes `pInt` and guards on it but never shows the write that consumes it —
   the `gr.setValue('priority', inputs.priority)` line quoted under **Current** is not
   given a replacement. Pasted literally, the script would compute an unused variable and
   still write the string, leaving the defect intact; producing the corrected `setValue`
   line is an inference the builder must supply.

The rubric does not resolve this: Case 1 covers a missing *value*, not a missing *line*, and
Case 2's tests are about record/field addressability rather than snippet completeness. I
resolved it to 1 because Case 2 is the case the packet says governs runtime-record fixes and
its two conditions are both met, but the alternate reading is genuine and, because this is
one of the two gate terms, it would flip `passes_gate` to 0.

The other three columns were determinate: the layer answer is explicit and the M18 note
pre-decides the layer-3/layer-4 straddle; FIX-1 matches the spec's named fix target with no
band judgement required; and both evidence classes are separately labelled in RC-1 and
corroborated by the audit trail in section 4.
