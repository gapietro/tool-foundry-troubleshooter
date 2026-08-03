# Result — row-02-custom-seed-01-run-1

**Seed:** 01 (tool schema mismatch) · **Harness:** custom (`x_snc_troubleshoot`) · **Run:** 1

## Scoring

| Column | Awarded | Justification |
|---|---|---|
| `root_cause_layer_correct` | **0** / 2 | Expected layer is `tool_schema` (layer 3), or an equivalent layer-4 "column is Integer-typed and tool sends a word" answer (per the seed's M18 note). This run's `root_causes` array is `[]` — no root cause, and therefore no layer, is named at all. The report's `failure_summary` states the execution "completed successfully... no errors were reported," which is the opposite of naming the seeded defect. The report's own `layers_swept` block claims layer 3 was inspected ("Tool definitions validated via tool call success in the trace") and marks it `NOT_SWEPT` with a reasoning string that doesn't actually engage the schema — and the audit-trail measurement (§4 of the packet) independently shows only layer 1 was actually swept (`layers_swept: 1/7 (L1)`, tool-call order `agent_trace` only), contradicting even the report's partial self-described sweep of layers 2–7 as deliberate "NOT_SWEPT" conclusions rather than "never looked." Per the packet's instruction to treat measurements as fact over the report's self-description, and since no root cause was named in either case, this scores 0. |
| `fix_target_correct` | **0** / 2 | `fixes` array is `[]`. No fix target — word-typed contract, script mapping, tool description, or otherwise — is proposed anywhere in the report. |
| `evidence_cites_trace_and_config` | **0** / 1 | The evidence rule requires a root cause that cites both the execution trace AND a config/schema source. There is no root cause to attach evidence to (`root_causes: []`). Notably, per packet §5, the raw `agent_trace` output this run actually read contained the discrepancy verbatim (`priority_requested":"critical", priority_stored:null`) — the model had the trace evidence in hand and did not use it to reach a conclusion, let alone pair it with a config/schema citation (`agent_config`/`schema_lookup` were never called — 1 tool call total, `agent_trace` only). |
| `fix_usable_unedited` | **0** / 1 | `fixes` is empty — there is no fix to apply, edited or otherwise. Also independently forced to 0 by the rubric's constraint, since `fix_target_correct` = 0. |

## `passes_gate`

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
```

`root_cause_layer_correct` = 0 and `fix_usable_unedited` = 0 → **`passes_gate` = 0**.

## Total

**0 / 6**

## Notes for a later reader

- This run is not void: the seed was correctly triggered (execution `b07dc9082baa4314f243fed2ce91bf4b` matches the seed spec's setup), and the seed's precondition state (Integer column, no choice list, `priority_stored: null`) is confirmed present and measurable in the trace this run actually read. The run measured the right thing and still produced no diagnosis — a genuine miss, not a void.
- The report is a structurally distinct "inconclusive" shape (empty `root_causes`/`fixes`, non-empty `inconclusive.evidence_read`/`needed_to_conclude`) rather than a confidently-wrong diagnosis. Per the task instructions, an unusual shape is not automatically a failure — but here it is scored as one because the *content* fails on every column: zero layers meaningfully swept (per the audit-trail measurement, not the report's self-reported layer table), no root cause, no fix, and — per packet §5 — the single piece of evidence the run collected already contained the answer and was not acted on. The `inconclusive` framing does not earn any credit under this rubric; it is simply a report with nothing to score in `root_causes`/`fixes`.
- Only 1 of 7 available layers was swept (measured), against 7/7 tool availability, with 1 tool call total (`agent_trace`) and no follow-up calls to `agent_config` or `schema_lookup` despite both being available and directly relevant to a layer-3/4 defect.
