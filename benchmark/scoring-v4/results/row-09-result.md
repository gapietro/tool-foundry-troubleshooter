# Row 09 — Scoring Result

**Seed:** 03 (missing data) · **Harness:** native (Agent Doctor) · **Run:** 1

## Rubric columns

### `root_cause_layer_correct` = **2**

The seed spec requires the expected root-cause layer `data` (layer 5). The
report's primary finding, Root Cause 1, states:

> **Layer** | 5 — Data
> **Finding** | The routing table is genuinely empty. Zero rows exist with or
> without ACL filtering. No category-to-assignment-group mapping is present,
> so `lookup_routing_rule` can never match any request.

This names the exact expected layer and mechanism (table genuinely empty, not
a read failure or ACL block — the specific distinction this seed is built to
test). Full credit.

### `fix_target_correct` = **2**

Seed spec expects fix target: data seeding. Fix 1 in the report:

> **Target type** | Data
> **Target** | Table `x_snc_tsbench_routing` (Bench Routing Rule)
> **Proposed** | Insert at minimum one row per routable category...

This names the specific target (the exact empty table, with an insert
proposal), not merely "the right area" — full credit, not the partial band.
(Fix 2, marking the `category` input mandatory, is explicitly labeled
"secondary / hardening" and correctly attributed to a different, non-seed
defect layer — it does not dilute the primary fix-target credit.)

### `evidence_cites_trace_and_config` = **1**

Root Cause 1's own Evidence field cites `query_table`
(`read_status: empty, unfiltered_row_count: 0, verdict: genuinely_empty`) and
the tool-call trace response (`matched: false, rules_in_table: 0` from
`agent_trace`) — this alone is trace + data, not trace + config/schema.
However, the report's LAYERS SWEPT table (immediately preceding ROOT CAUSES,
part of the same diagnostic write-up) explicitly ran and cites `schema_lookup`
on `x_snc_tsbench_routing` (Layer 4) and `agent_config` tools section
(Layer 3, also directly cited under Root Cause 2's evidence,
`input_schema: [{"name":"category","mandatory":false}]`) as part of ruling
out schema/tool-definition causes before settling on Layer 5. Root Cause 1's
"Component" field also carries the table's display label ("Bench Routing
Rule"), which is schema-sourced. Taken as the report's overall diagnostic
citation (trace + config/schema both present and load-bearing to the
conclusion that layers 3/4 are clean and only layer 5 is defective), this
clears the bar. **Borderline** — a stricter reading confined only to Root
Cause 1's own Evidence bullet would score this 0; noted for a later reader.

### `fix_usable_unedited` = **0**

Fix 1's proposed insert is a template, not a concrete, directly-appliable
change: "Insert at minimum one row per routable category (e.g.,
`category = Hardware`, `assignment_group = <target group name>`). Add rows
for all categories the agent is expected to handle." `<target group name>`
is an explicit unfilled placeholder, and "categories the agent is expected to
handle" is left for the reader to enumerate — neither is resolvable from any
evidence already gathered in the run (no candidate assignment-group values or
category list were surfaced anywhere in the trace/config/schema evidence
cited). A builder AI cannot apply this fix as written without first deciding
or looking up real values; it requires manual completion before it is
executable. Per the rubric's stated constraint this could not have been 1
while `fix_target_correct` were 0, but here `fix_target_correct` is 2 — the 0
comes independently from the placeholder, not from a wrong target.

## `passes_gate`

```
passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1
```

`root_cause_layer_correct` = 2, but `fix_usable_unedited` = 0 →
**`passes_gate` = 0**.

## Total

2 + 2 + 1 + 0 = **5/6**

## Notes for a later reader

- No void condition applies — the seed spec's void conditions concern seeds 4
  and 5 only; this is seed 3, and the report's own account of the table state
  (genuinely empty, zero rows) matches the seed's setup instructions exactly.
- The report's LAYERS SWEPT claims (L1, L3, L4, L5, L6 swept; L2, L7, platform
  logs not swept) match the packet's independent audit-trail measurement
  (`layers_swept: 5/7 — L1, L3, L4, L5, L6`) exactly — no disagreement to
  adjudicate for this run.
- The `evidence_cites_trace_and_config` = 1 call is the one soft spot in this
  score: it credits the report's overall diagnostic write-up (Layers Swept +
  both Root Cause boxes together) rather than requiring the trace+config
  citation to live entirely inside Root Cause 1's own Evidence field. If a
  future reconciliation of this rubric's application across rows adopts the
  stricter per-root-cause reading, this column would move to 0 and the total
  to 4/6 — `passes_gate` is unaffected either way since it does not consume
  this column.
- Fix 2 (mandatory `category` input) is well-formed and directly appliable
  (`"mandatory": false` → `true` on a named tool/field) but is secondary
  hardening unconnected to the seed's actual defect; it cannot rescue
  `fix_usable_unedited` for Fix 1's placeholder problem, and the rubric scores
  whether the report's fix for the (correct) root cause is usable, not
  whether any fix in the report is usable.
