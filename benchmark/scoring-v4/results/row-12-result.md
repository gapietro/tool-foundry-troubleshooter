# Row 12 — custom / seed 03 / run 2 — Scoring result

**Seed:** 03 (missing data) · **Expected root-cause layer:** `data` (layer 5) · **Expected fix target:** data seeding

## Column scores

### `root_cause_layer_correct` = **0** (of 0/2)

The report's sole `root_causes` entry explicitly names `"layer": "1"` with
`"component": "tool_call for 'lookup_routing_rule'"` — not layer 5 (data). The
report's own `layers_swept` block marks layer 5 `NOT_SWEPT` ("Data existence
was not verified via query_table"), and the audit-trail measurement
independently confirms `layers_swept: 1/7 (L1)` with tool-call order limited
to a single `agent_trace` call — no `query_table` call was ever made. The
`would_confirm` field even says reaching layer 4/5 was left as unconfirmed
future work ("would_confirm: layer 4 ... or layer 5 ... to check for existing
rules"), i.e. the run itself acknowledges it never got there. This is a clean
miss, not a rounding call — the rubric offers no partial band for this column.

### `fix_target_correct` = **0** (of 0/1/2)

The fix entry sets `"target_type": "tool schema"` and
`"target": "lookup_routing_rule tool configuration"`. The seed's spec is
explicit: *"A diagnosis naming the tool or the query is a miss"* and the
expected fix target is data seeding, "not the tool or the instructions." This
run names the tool as both the target_type and the target string. The
`proposed` text ("Ensure routing rules for 'Hardware' category exist in the
target table") gestures at adding data, but the fix is filed against the tool,
not the table/data-seeding action — the seed treats naming the tool as
disqualifying regardless of what the prose beneath it says. Scored 0, not the
1-partial band (partial credit is reserved per the rubric for genuinely
ambiguous "right area, no specific target" cases, and this run affirmatively
mis-names the target as the tool rather than leaving the target unspecified).

### `evidence_cites_trace_and_config` = **0** (of 0/1)

Both evidence entries under `root_causes[0].evidence` have `"source": "trace"`
("tool_call response: 'rules_in_table': 0" and "execution status:
'completed' with no errors"). No config/schema source (e.g. `agent_config`,
`schema_lookup`) is cited anywhere in the root cause. This is corroborated by
the audit trail: tool-call count is 1, tool-call order is `agent_trace` only —
no `schema_lookup` or `agent_config` call was ever made, so there was no
config/schema evidence available to cite even if the report had wanted to.

### `fix_usable_unedited` = **0** (of 0/1)

Per the rubric's explicit constraint, `fix_usable_unedited` may not be 1 while
`fix_target_correct` is 0 — that alone forces 0 here. Independently, the
proposed fix ("Ensure routing rules for 'Hardware' category exist in the
target table") is also not a directly-applicable instruction (no table name,
no rows/values, no seeding action specified) and is filed under a "tool
schema" target rather than a data-seeding one, so it would not be actionable
by a builder AI as written even setting the constraint aside.

## `passes_gate`

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
```

root_cause_layer_correct = 0, fix_usable_unedited = 0 → **passes_gate = 0**

## Total

0 + 0 + 0 + 0 = **0/6**

## Notes for a later reader

- This run is *not* void — the seed spec's void conditions are seed-4 and
  seed-5 specific; seed 3's own trigger fired normally and the tool honestly
  reported `rules_in_table: 0`, matching the seed's expected-diagnosis
  narrative that the evidence needed is present in the trace if read. The
  run simply never read far enough (it stopped after one `agent_trace` call)
  to reach the layer where that evidence lives.
- Borderline point worth flagging: the report's prose ("missing rules for the
  'Hardware' category", "Ensure routing rules ... exist") is directionally
  closer to the correct answer than its structured fields (`layer: "1"`,
  `target_type: "tool schema"`) suggest. Per the task instructions, scoring
  must follow what the report's own structured claims and the measured
  `layers_swept` say, not a generous reading of loose prose — so the
  structured mis-labeling controls the score here.
- `confidence: "UNCONFIRMED"` on the single root-cause entry was noted but
  does not change any column score; the rubric has no separate treatment for
  self-flagged low confidence, and an unconfirmed claim that is also the
  wrong layer/target is still a miss, not a void or partial-credit case.
