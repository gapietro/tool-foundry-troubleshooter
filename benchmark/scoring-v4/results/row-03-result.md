# Scoring result — Row 03 (native, seed 01, run 2)

**Execution:** `b07dc9082baa4314f243fed2ce91bf4b` · Fix Report reproduced in the packet §3 · audit-trail measurements in packet §4.

## root_cause_layer_correct = 2

The seed's Scoring note (M18) explicitly states that an answer naming "layer 4 —
the column is Integer-typed and the tool sends a word" scores full marks
provided it states the *mismatch* (both sides), not just one side in isolation.

This run's Root Cause 1 does exactly that: `Layer | 4 — Data schema + 3 — Tool
definition`, and the Finding names both halves together — "The `priority`
column is type **Integer** with no choice list. The tool script calls
`gr.setValue('priority', inputs.priority)` where `inputs.priority` is the
string `"critical"`. GlideRecord cannot coerce that string to an integer and
silently stores `null`." It also correctly reports the installed state as
"no choice list," matching the seed's 2026-08-02 correction (`has_choices:
false`) rather than the stale "Integer choice 1–5" framing. This satisfies
the M18 carve-out cleanly. Full marks.

## fix_target_correct = 1 (partial — justified)

The seed's expected fix target is narrow and specific: "the tool's
**word-typed contract** — map the word to its integer inside the script, …
or change the tool description + agent instructions to pass 1–5." The seed
is explicit that this is a fix on the *tool* side, and its own history note
("Column type corrected 2026-08-01. … It was originally declared with
`ChoiceColumn` … The mechanism above was false as shipped. The column is now
`IntegerColumn`… which makes the mismatch real") shows the Integer column is
the deliberately-restored ground truth the seed is built to test against.

This run's **Fix B** ("Map words to integers in the tool script") matches the
expected fix target almost verbatim — specific target (`sn_aia_tool` sys_id,
`script` field), specific proposed code (lookup map, integers 1–5,
`gr.setValue('priority', val)`). Named on its own, this would be full marks.

But the report labels a *different* fix, **Fix A, "(preferred)"**: change the
`priority` column's `type` from Integer to Choice/String and add word-keyed
choice entries. That is precisely the pre-correction `ChoiceColumn` shape the
seed spec says it deliberately walked back to make the defect real — i.e.
the report's top-ranked recommendation targets the wrong layer relative to
the seed's own designated fix target, and the VERIFICATION section instructs
"Apply Fix A **or** Fix B (not both)" with no criterion for choosing. The
correct target is present and fully specified, but it is subordinated to an
incorrect "preferred" option rather than being the run's single, clear
answer. That is why this is scored 1 (right area named correctly in Fix B,
but the report does not unambiguously commit to it) rather than 2.

## evidence_cites_trace_and_config = 1

Root Cause 1's evidence table cites: `schema_lookup` on
`x_snc_tsbench_ticket.priority` (config/schema source: `type=Integer`,
`has_choices=false`), the tool script text pulled via `agent_config`
(config source), the `sn_aia_tools_execution` trace row
`869d4d482baa4314f243fed2ce91bf89` showing
`{ok:true, priority_requested:"critical", priority_stored:null}` (trace
source), and a `query_table` read confirming the blank column (data). Both
a trace source and a config/schema source are cited on the same root cause,
satisfying the evidence rule. Full marks.

(Note, not scored here: the audit trail flags that this run's own LAYERS
SWEPT table over-claims Layer 2 — its `agent_config` call returned only
`sections_returned:["tools"]`, not `instructions`, so the audit-trail-derived
`layers_swept` is 4/7, not the 5 the report's table claims. This is a hit
against the report's self-reported sweep claims, but it does not touch the
Root Cause 1 evidence citations actually used above, which are independently
verifiable against real tool calls in the measured order.)

## fix_usable_unedited = 0

Per the rubric's explicit constraint, this cannot be 1 while
`fix_target_correct` is 0 — but here `fix_target_correct` is 1, so the
constraint doesn't force the value; it is assessed independently.

The report does not hand the builder AI one unambiguous, mechanically
applicable fix. It offers three (A/B/C) with an explicit branch point
("Apply Fix A or Fix B (not both)") and labels the wrong-target one (A,
reverting the column to Choice/String) as "(preferred)." A builder AI
executing the report's own stated preference would apply Fix A — undoing the
seed's deliberate Integer-column correction and missing the tool's
word-typed contract the seed actually wants fixed. Applying the report "as
written," starting from its own top recommendation, does not reliably
address the defect the seed carries. This is a wrong-target risk from
"preferred" ranking, not a formatting nitpick, so it fails the "addresses
the defect the seed actually carries" half of the definition.

## passes_gate = 0

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
```
`root_cause_layer_correct` = 2, but `fix_usable_unedited` = 0 → **passes_gate = 0**.

## Total: 4/6

| Column | Score |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 1 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| **Total** | **4/6** |
| **passes_gate** | **0** |

## Note for a later reader

The borderline call in this row is `fix_target_correct` = 1 rather than a
clean 0 or 2: the report contains the seed's exact expected fix (Fix B, map
word→integer in the tool script) stated with full specificity, but ranks it
below an incorrect fix (Fix A, revert the column to Choice/String — the
pre-correction shape the seed spec says it deliberately moved away from) and
offers no criterion for choosing between them. That same ambiguity, plus
Fix A being the stated "preferred" option, is what drives
`fix_usable_unedited` to 0 despite the correct fix technically being present
in the report.
