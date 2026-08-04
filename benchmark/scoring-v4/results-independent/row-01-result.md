# Scoring result — row-01 (native, seed-01, run-1)

## root_cause_layer_correct = 2

RC-1 states the layer as "3 — Tool definition / 4 — Data schema" and the
FAILURE SUMMARY / Finding text names the actual disagreement: the tool script
passes the string word `"critical"` while `x_snc_tsbench_ticket.priority` is
Integer-typed, and GlideRecord silently discards the non-numeric write. Per
the seed's M18 scoring note, a run that identifies the *mismatch* — not just
one side of it — scores full marks whether it labels it layer 3, layer 4, or
both. This run names both sides and the disagreement between them, so it
clears the bar cleanly.

## fix_target_correct = 2

Expected fix target (seed spec): "map the word to its integer value inside
the script before `setValue`, or change the tool description and the agent
instructions to pass 1–5." FIX-1's Proposed text is: "Add a word-to-integer
map before the `setValue` call, and reject unknown values" — this is the
first of the seed's two acceptable fix targets, stated precisely (script-side
word→integer mapping, before the write). No partial-credit reduction
applies; this is a direct hit, not "the right area without the specific
target."

## evidence_cites_trace_and_config = 1

RC-1's Evidence line cites three things: (1) the tool script body (`sn_aia_tool`
field `script`) — a config source; (2) the schema lookup result
`x_snc_tsbench_ticket.priority`, `type=Integer`, `has_choices=false` — a
schema source; and (3) the tool call's own execution result,
`priority_requested="critical"`, `priority_stored=null`
(`sn_aia_tools_execution.sys_id=...`) — trace/execution evidence, the
observed runtime disagreement the diagnosis turns on. Both a trace source and
a config/schema source are cited for the same root cause, satisfying the
rule from `docs/agent/agent-doctor-instructions.md`.

## fix_usable_unedited = 0

`fix_target_correct` is 2 (not 0), so the constraint linking the two columns
does not block a 1 here — but the Fix Report's own text does. FIX-1's
"Proposed" field is a natural-language description only: "Add a
word-to-integer map before the `setValue` call, and reject unknown values
(script body omitted here — see the run's stored message for the full
snippet)." As given — and Section 3 is captioned "Full text of the Fix
Report (the message the user/caller actually sees)" — the report contains no
concrete script/diff for the mapping: no dictionary of word→integer values,
no validation logic, no updated IIFE. A builder AI acting on this text would
have to author the mapping and validation from scratch (choose the five
word→integer pairs, decide the unknown-value rejection behavior, splice it
into the existing script) rather than apply a supplied change verbatim. That
is authorship, not application-as-written, so the column scores 0 on the
text actually in front of us.

**Borderline note:** the parenthetical explicitly gesturing at additional
detail existing elsewhere ("see the run's stored message for the full
snippet") reads like it could be packet-compiler shorthand for "we elided a
long code block here" rather than a gap in what the user actually saw.
Scored strictly against the packet's own framing ("Full text of the Fix
Report... nothing else... score using only the content below"): what's
present is a description, not a patch, so `fix_usable_unedited` = 0. (FIX-2,
by contrast, *does* give a complete literal JSON replacement inline — showing
the run was capable of full-fidelity proposals when it chose to give one,
which sharpens the contrast rather than softening it.)

## Total: 5/6

## passes_gate

```
passes_gate = (root_cause_layer_correct == 2) AND (fix_usable_unedited == 1)
            = (2 == 2) AND (0 == 1)
            = TRUE AND FALSE
            = 0
```

**passes_gate = 0**
