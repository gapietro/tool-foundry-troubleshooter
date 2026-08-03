# Result — row-05-native-seed-02-run-1

**Seed:** 02 (ambiguous instruction) · **Harness:** native (Agent Doctor) · **Run:** 1

## Scoring

| Column | Awarded | Justification |
|---|---|---|
| `root_cause_layer_correct` | **0** / 2 | Expected layer is `instruction` (layer 2) — the instruction requires a group determination the agent has no means to make. This run's ROOT CAUSES section states: "**None identified.** The execution completed without error. No root cause exists to report." No layer is named as root cause, let alone the correct one. The FAILURE SUMMARY explicitly frames the run as a success story: the agent "made a second LLM reasoning step that correctly identified the issue as a hardware/endpoint problem, and delivered a formatted routing response assigning the request to IT Support — Hardware & Endpoint." This is precisely the "invent a group name" failure mode the seed spec predicts ("Whatever the agent does about the group is therefore driven by the instruction alone: it must invent a group name or stall") — the run observed the invented, ungrounded routing decision and characterized it as a correctly functioning, defect-free execution rather than recognizing it as the seeded symptom. |
| `fix_target_correct` | **0** / 2 | FIXES section: "**None required.** The execution is functioning as designed." No fix target — instruction text, group naming, or lookup-tool addition — is proposed anywhere in the report. |
| `evidence_cites_trace_and_config` | **0** / 1 | The evidence rule requires a root cause that cites both the execution trace AND a config/schema source. There is no root cause stated at all (`ROOT CAUSES: None identified`), so there is nothing to attach dual evidence to. The audit trail confirms only L1 (execution trace) was swept and no `agent_config` call was made (tool-call order: `agent_trace`, `read_artifact` ×4 — no `agent_config` or `schema_lookup` call), so even if a root cause had been asserted, no config-layer evidence was gathered to support it. |
| `fix_usable_unedited` | **0** / 1 | No fix is proposed ("None required"), so there is nothing a builder AI could apply. Independently forced to 0 by the rubric's constraint since `fix_target_correct` = 0. |

## `passes_gate`

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
```

`root_cause_layer_correct` = 0 and `fix_usable_unedited` = 0 → **`passes_gate` = 0**.

## Total

**0 / 6**

## Notes for a later reader

- This run is not void. Seed 02 has no listed void condition (only seeds 4 and 5 do), and there is no indication in the packet that the fixture was in the wrong state — the agent ran, called `measure_request`, and produced a routing answer, i.e. the seed's mechanism (one tool incapable of resolving a group, instructions naming none) was exercised as designed.
- This run's own LAYERS SWEPT table and the audit-trail measurement agree: only L1 was swept (1/7), against 7/7 layers available and 5 tool calls total (`agent_trace` ×1, `read_artifact` ×4). The packet's §4 explicitly notes no disagreement between the report's self-described sweep and the measured one, so no refutation was needed here (contrast this with rows where the report over-claims sweep coverage).
- The report is a structurally distinct "clean bill of health" shape — it explicitly concludes no defect exists and invites the requester to supply a different execution plan if they observed a symptom. Per the task instructions, an unusual shape is not automatically a failure. Here it is scored as a failure on the merits: the seed's predicted failure mode (an invented, ungrounded group assignment) is visible in the report's own FAILURE SUMMARY — the agent assigned "IT Support — Hardware & Endpoint" via LLM reasoning alone, with no group-lookup tool or named groups in evidence — and the run mischaracterized this as correct, intended behavior rather than recognizing the instruction-layer defect. The miss is a genuine diagnostic failure to connect an observed symptom (invented routing) to its cause, not an artifact of an unusual report shape.
- No blind-rule tokens appear to have leaked into the report's reasoning in a way that would substitute for genuine diagnosis (the report reasons from the trace's content, not from the seed name), but this is moot since no diagnosis was reached either way.
