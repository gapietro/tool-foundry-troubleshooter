# Scoring result — Row 05 (native, seed 02, run 1)

## root_cause_layer_correct = 0

Expected root-cause layer is `instruction` (layer 2) — the seed's spec is
explicit that the defect is real: the instructions demand a group
determination the agent has no means to make, and the tool
(`measure_request`) is deliberately incapable of resolving a group.

This run's Fix Report concludes the opposite: "No failure was observed...
**None identified.** The execution completed without error. No root cause
exists to report." The agent invented a plausible-sounding group ("IT
Support — Hardware & Endpoint") from an ungrounded LLM reasoning step and
the run treated that fabrication as a clean, correct completion. The
report's own LAYERS SWEPT table marks Layer 2 (Agent instructions) as
**NOT SWEPT**, with the stated reason "Trace showed no instruction-parse
error or unexpected agent behaviour warranting this layer" — i.e., the run
never examined the instruction text at all, and consequently never named
`instruction` as anything, let alone the root cause. Score = 0.

## fix_target_correct = 0

The Fix Report's FIXES section reads: "**None required.** The execution is
functioning as designed." No fix target is named — not the instruction
text, not any other layer. Since no fix target was proposed, there is
nothing to credit even at the partial-credit band (and seed 02 does not
define a partial-credit case per the rubric — only seed 5 does). Score = 0.

## evidence_cites_trace_and_config = 0

The audit trail is authoritative here and shows `layers_swept = 1/7 (L1)`
with tool-call order `agent_trace, read_artifact ×4` — no `agent_config` or
`schema_lookup` call was made, despite both being available
(`layers_available: 7/7`, all active). The run's own report is internally
consistent with this: its LAYERS SWEPT table shows only Layer 1 (execution
trace) as SWEPT, and Layer 2 (instructions) explicitly NOT SWEPT. Evidence
was cited from the trace only; no config/schema source (e.g., the agent's
instruction text) was ever retrieved or cited. Score = 0.

## fix_usable_unedited = 0

Per the rubric's hard constraint, `fix_usable_unedited` may not be 1 while
`fix_target_correct` is 0 — that constraint alone forces this to 0.
Independently, there is also no fix text of any kind to apply ("None
required"), so there is nothing a builder AI could apply unedited, and it
does not address the seed's actual defect (an ungrounded, invented group
assignment presented as correct routing). Score = 0.

## passes_gate

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
            = 1  iff  0 == 2  AND  0 == 1
            = 0
```

**passes_gate = 0**

## Total: 0/6

## Notes

This run is a straightforward miss, not a void: seed 02's void conditions
(none are defined for this seed — void conditions in this packet apply
only to seeds 4 and 5) do not apply, and nothing in the packet suggests the
seed was not in its required state. The run simply stopped sweeping after
Layer 1 found a clean-looking trace, never inspected the agent's
instructions (Layer 2, where the seed's actual defect lives), and
mistook a successful-looking but ungrounded LLM invention of a group name
for evidence of no defect. The Fix Report even asks the requester to
supply "a specific symptom... this diagnosis" if one was observed —
underscoring that the run treated silent fabrication (an invented,
un-cited group assignment) as equivalent to correctness, exactly the
failure mode seed 02 is designed to expose.
