# Row 16 — Scoring result

**Seed:** 04 (GenAI capability not mapped to a provider) · **Harness:** custom · **Run:** 2
**Run ID:** `57617ae82b6acf14f243fed2ce91bf70` (`TR1000132`) · Terminal state: complete

## Void check

Seed 4's void condition is a mismatch between the capability sys_id hardcoded in the
installed tool script and the target instance's `sys_one_extend_capability` record. The
report's own evidence cites `capability_id 92ff62af516741769c437feb88c80ef3` — the value
the seed spec records as the correctly-substituted, instance-matching sys_id for gpinst01.
No mismatch is indicated anywhere in the report or measurements. **Not void** — scored normally.

## Rubric columns

### `root_cause_layer_correct` = **0**

Expected layer is `genai_stack` (layer 6). The report's single `root_causes[0].layer` is
`"1"`, with `component: "tool_call response"` — explicitly the trace/tool-call layer, not
the GenAI stack. The report itself marks layer 6 `UNAVAILABLE` with the reason "No
genai_log or log_analysis tool was invoked to analyze the GenAI stack" — a direct admission
that the layer housing the actual defect (the capability→provider mapping in
`sys_one_extend_capability_definition.api`) was never examined. The audit-trail measurement
confirms this independently: `layers_swept` = 1/7 (L1 only), tool calls were only
`agent_trace` and `read_artifact` — no `agent_config`, `schema_lookup`, or `genai_log` call
that could have surfaced the dangling `api` pointer. The report never names `genai_stack`,
the capability definition record, or the `api`/provider-flow mismatch anywhere in its text.

### `fix_target_correct` = **0**

Expected fix target is capability mapping — repoint `api` at a valid provider flow. The
report's only fix (`fixes[0]`) has `target_type: "tool schema"`, target "summarise_ticket
tool definition for capability ...", and proposes to "Validate input schema matches
expected ticket format and handle error cases." This is not the capability mapping at all;
it is a different area (tool/schema layer) and would not touch the actual defect (the
provider-flow pointer on the capability definition). It is also not the empty-`connection`
decoy — it's a third, unrelated target. No partial credit applies: this isn't "right area,
missing specific target," it's the wrong area entirely.

### `evidence_cites_trace_and_config` = **0**

Both evidence entries in `root_causes[0].evidence` are `"source": "trace"` (the tool-call
response digest and execution status). No config/schema source is cited anywhere — no
`agent_config`, no capability-definition record, no schema lookup. The report's `would_confirm`
field even says confirming would require "layer 3 - agent_config to verify tool schema
validity," meaning the agent identified that config evidence was missing but never
retrieved it. Trace-only; rubric requires both.

### `fix_usable_unedited` = **0**

Per the rubric's mandatory constraint, this column may not be 1 when `fix_target_correct`
is 0, and it is not here regardless: the proposed fix is generic ("Validate input schema
matches expected ticket format and handle error cases") with `"current": "unknown (requires
agent_config inspection)"` — not a concrete, applicable change, and it targets the wrong
area besides.

## `passes_gate`

```
passes_gate = (root_cause_layer_correct == 2) AND (fix_usable_unedited == 1)
            = (0 == 2) AND (0 == 1)
            = 0
```

**`passes_gate = 0`**

## Total

**0 / 6**

## Notes for a later reader

- This is not the seed's documented empty-`connection` decoy (which would still earn
  `root_cause_layer_correct = 2` for landing in the right layer even while missing the
  specific target). This run's root cause is attributed to layer 1 (tool-call/trace level),
  not layer 6 at all, and layer 6 is explicitly disclosed as unswept by the report itself —
  so even the layer credit fails, before the decoy question is reached.
- Report carries an explicit `confidence: "UNCONFIRMED"` marker on its sole root-cause
  entry, and its own `would_confirm` field names the very evidence (agent_config /
  capability definition) it never collected. The run is honest about its own
  incompleteness — this is not a case of confident wrong-answer overreach — but per the
  instructions the shape does not earn credit it didn't otherwise demonstrate; scoring
  followed the actual content, not the hedge.
- Audit-trail `layers_swept` (1/7, L1 only) matches what the report itself claims
  (L1 SWEPT, L6 UNAVAILABLE, all others NOT_SWEPT) — no discrepancy between the report's
  self-description and the independent measurement in this run, unlike some other rows in
  this benchmark.
