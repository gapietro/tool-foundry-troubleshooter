# Row 01 result — native, seed 01 (tool schema mismatch), run 1

## root_cause_layer_correct = 2

The seed's expected root-cause layer is `tool_schema` (layer 3), with an
explicit note (M18) that a layer-4 answer scores full marks too, **provided
it states the disagreement between the two sides** (not just one side in
isolation).

RC-1 states: "Layer: 3 — Tool definition / 4 — Data schema" and its finding
is exactly the required disagreement: "The script calls
`gr.setValue('priority', inputs.priority)` where `inputs.priority` is the
string `"critical"`. The `priority` column on `x_snc_tsbench_ticket` is
declared as type Integer with no choice list. GlideRecord silently ignores a
non-numeric string on an Integer column..." This names both sides of the
mismatch (word-typed input vs. Integer column) and the mechanism, matching
the seed's "Expected diagnosis" almost verbatim. Full marks.

## fix_target_correct = 2

Seed's expected fix target: "map the word to its integer value inside the
script before `setValue`, or change the tool description and the agent
instructions to pass 1–5." FIX-1 ("Map the priority word to the correct
integer before writing") targets exactly this: `sn_aia_tool` field `script`,
proposed change is "Add a word-to-integer map before the `setValue` call, and
reject unknown values." This is precisely the first of the seed's two
acceptable fix targets (word→integer mapping inside the script), not a
plausible-but-wrong neighboring target (e.g. it does not mistakenly propose
"fix the input schema type," which the seed explicitly rules out as
inexpressible). Full marks.

## evidence_cites_trace_and_config = 1

RC-1's evidence line cites three things: the tool script body (config: `
sn_aia_tool.sys_id=...`, field `script`), the schema (config:
`x_snc_tsbench_ticket.priority`, `type=Integer`, `has_choices=false` via
`schema_lookup`), and the tool call's own result record
(`sn_aia_tools_execution.sys_id=...`, `priority_requested="critical"`,
`priority_stored=null`) — this last item is execution-trace evidence (the
observed runtime disagreement the seed's own "Evidence a correct diagnosis
should cite" section calls for). Both an execution-trace source and a
config/schema source are cited for the same root cause. Award 1.

(Note: the run's separate claim in its own LAYERS SWEPT table that layer 2 /
agent instructions was swept is contradicted by the audit-trail measurement
— `agent_config`'s `sections_returned` was `["tools"]` only, not
`instructions`. This is a real accuracy problem with the report's
self-description, but it does not touch RC-1's evidence citations, which
rest on `agent_trace`/tool-execution output plus `schema_lookup`/tool-script
config — both actually swept per the audit trail. It is recorded here as
context for a later reader, not used to dock this column.)

## fix_usable_unedited = 0

`fix_target_correct` is 2, so the "may not be 1 while fix_target_correct is
0" constraint does not force this to 0 — but the fix fails on its own
merits. FIX-1, the fix that actually addresses the seed's defect, does not
contain an applicable fix: its "Proposed" field reads "Add a word-to-integer
map before the `setValue` call, and reject unknown values (script body
**omitted here — see the run's stored message for the full snippet**)." The
packet is explicit that Section 3 is "Full text of the Fix Report (the
message the user/caller actually sees)" — and that text does not contain the
mapping code, only a pointer to an artifact that isn't part of what the
builder AI would receive. There is nothing here a builder AI could apply
verbatim; it would first have to locate and retrieve the "stored message,"
which is manual intervention. FIX-2 (mark inputs mandatory) is fully
specified and could be applied as written, but it does not address the
seed's actual defect (word vs. Integer mismatch) — it is a latent,
unrelated finding. No fix in this report is simultaneously targeted-correct
and copy-paste-usable. Award 0.

## passes_gate = 0

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
```
root_cause_layer_correct = 2, but fix_usable_unedited = 0, so passes_gate = 0.

## Total: 5/6

| Column | Score |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| **Total** | **5/6** |
| **passes_gate** | **0** |

## Notes for a later reader

- This is a case where the diagnosis is essentially correct and the *named*
  fix target is correct, but the run fails the gate purely on
  applicability: the report defers the actual code change to an artifact
  outside what the user/caller sees, so nothing here can be applied
  unedited. This is distinct from a wrong-target failure (2/0/0 pattern
  called out in the rubric) — here it's 2/2/1/0, i.e. a target-correct fix
  that is nonetheless not usable-as-written.
- The run's own LAYERS SWEPT table overstates layer 2 coverage relative to
  the audit-trail measurement (claims agent instructions were returned;
  `sections_returned` was `["tools"]` only). This was weighed and found not
  to affect any of the four columns above, since none of RC-1's evidence
  depends on the instructions section, but a later reader auditing overall
  report trustworthiness should be aware of it.
- RC-2 (non-mandatory inputs) and RC-3 (latency) are secondary findings not
  relevant to the seed's defect; they were not used to inform any column
  score.
