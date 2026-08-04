# Row 03 — native, seed 01 (schema mismatch), run 2

## root_cause_layer_correct = 2

The run's FAILURE SUMMARY and Root Cause 1 state the mismatch itself, not
either side alone: "`x_snc_tsbench_ticket.priority` is declared as an
**Integer** field with no choice list, but the tool script passes the plain
string `"critical"` to `gr.setValue()`." Root Cause 1's `Layer` field is
literally `"4 — Data schema + 3 — Tool definition"`, citing both.

Per the seed's Scoring note (M18), this defect straddles layers 3 and 4 by
construction, and a run naming the layer-4 framing ("column is Integer-typed
and the tool sends a word") scores full marks equally to naming layer 3 —
*provided* the disagreement between the two, not just one side, is described.
This run clearly describes the disagreement (word forwarded, integer column,
value discarded). Full marks.

## fix_target_correct = 2

Seed's expected fix target: "the tool's word-typed contract — map the word to
its integer inside the script, or change the tool description + agent
instructions to pass 1–5."

The run's **Fix B** ("Map words to integers in the tool script") is a verbatim
match: "Add a lookup map at the top of the script mapping
`critical/high/moderate/low/planning` to integers 1-5, returning an error for
unknown values, then `gr.setValue('priority', val)`" — this is precisely the
seed's first accepted mechanism, with exact sys_id and script location named.
The correct target is unambiguously named in the report.

(The report *also* offers **Fix A**, labeled "preferred" — changing the
column's dictionary type to Choice/String — which is not one of the seed's
two enumerated accepted fix targets, and works against the platform's Integer
priority convention the seed treats as fixed. This does not disqualify the
column from full marks: the rubric's test is whether the diagnosis *names*
the correct target, and it does, in full technical detail. The consequence of
Fix A's presence is scored below, under `fix_usable_unedited`.)

## evidence_cites_trace_and_config = 1

Root Cause 1's evidence rows cite the execution trace directly (`sn_aia_tools_execution`
row `869d4d482baa4314f243fed2ce91bf89`: `{ok: true, priority_requested: "critical",
priority_stored: null}`) **and** a config/schema source (`schema_lookup` on
`x_snc_tsbench_ticket.priority`: `type = Integer`, `has_choices = false`, plus
`agent_config` for the tool script body). Both legs of the evidence rule are
present and specific, and both are corroborated by the Task 10 audit trail
(L1/trace, L3/agent_config-tools, L4/schema_lookup, L5/query_table were all
actually called — matching the audit's `layers_swept: 4/7 (L1,L3,L4,L5)`
exactly). The report's separate over-claim that Layer 2 (agent instructions)
was "SWEPT" is refuted by the audit trail (`agent_config` call only returned
`sections_returned:["tools"]`), but that over-claim is not part of the Root
Cause's own evidence citations, so it does not reduce this column.

## fix_usable_unedited = 0

The report does not converge on a single directly-applicable fix. Its own
VERIFICATION section instructs: "1. Apply Fix A or Fix B (not both)" — and
Fix A is explicitly labeled "(preferred)". Fix A targets the ticket table's
dictionary column (change `priority` from Integer to Choice/String), which is
**not** the seed's expected fix target — the seed defines the fix as living on
the tool's word-typed contract, treating the Integer column as the correct,
fixed side of the mismatch (consistent with `task.priority`'s Integer
convention on the platform). A builder AI acting on this report as written,
with no further human arbitration, would reasonably follow the report's own
stated preference and apply Fix A first — which does not address the defect
via the target the seed actually carries, even though Fix B (the correct
target) is also present and itself well-specified.

This is exactly the scenario the rubric's own guardrail describes: "a fix
aimed at the wrong target is a no-op, not a usable fix." Here the report
hedges between a correct target (demoted to "alternative") and an incorrect
one (promoted to "preferred"), so "applied as written, no manual editing
first" does not reliably land on the seed's defect. Scored 0.

## Borderline-call note

This is the closest call in the row: `fix_target_correct` = 2 despite
`fix_usable_unedited` = 0 is a legitimate combination under the rubric (the
constraint only forbids the reverse — `fix_usable_unedited` = 1 while
`fix_target_correct` = 0). The diagnosis genuinely does name the correct fix
target (Fix B, verbatim match to the seed's mechanism), which is why that
column scores full marks; the reason the *fix* is not usable-unedited is that
the report's own preference ordering points at a different, non-canonical
target first, requiring a judgment call the report itself does not resolve
correctly.

## Total: 5/6

## passes_gate

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
```
root_cause_layer_correct = 2, but fix_usable_unedited = 0 → **passes_gate = 0**.
