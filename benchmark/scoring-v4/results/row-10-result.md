# Score — Row 10 (custom, seed 03, run 1)

## root_cause_layer_correct = 0

The seed's expected root-cause layer is `data` (layer 5) — the routing table
`x_snc_tsbench_routing` was installed with zero rows. This run's `fix_report`
explicitly assigns its (single, `UNCONFIRMED`) root cause to `"layer": "1"`,
with `component: "lookup_routing_rule tool call"`. It never advances a layer-5
data-emptiness diagnosis; its own `would_confirm` field points at "layer 4 —
schema_lookup to verify routing rule schema requirements," i.e. the run's next
proposed step is toward the schema layer, not a conclusion about the data
layer. The audit-trail measurement confirms only L1 was ever swept (1/7,
`agent_trace` only), so the run had no basis to reach layer 5 even if it had
tried. Naming layer 1 when the expected layer is 5 is a miss.

## fix_target_correct = 0

Expected fix target: data seeding (insert rows into
`x_snc_tsbench_routing`). This run's `fixes[0]` has `target_type: "tool
schema"`, `target: "lookup_routing_rule tool configuration"`, proposing to
"Add routing rules for 'Hardware' category" — framed explicitly as a change
to the *tool's* configuration, not as seeding the data table. The seed spec
is direct on this point: "A diagnosis naming the tool or the query is a
miss" — and this report's root cause (`component: "lookup_routing_rule tool
call"`) and fix (`target_type: "tool schema"`) both name the tool. This is
not the partial band (right area, wrong specifics) — it names the wrong area
(tool/schema) entirely, never identifying the table or "seed the table with
rows" as the fix.

## evidence_cites_trace_and_config = 0

The rubric requires the root cause to cite BOTH the execution trace AND at
least one config/schema source. `root_causes[0].evidence` has exactly two
entries, both `"source": "trace"` (the tool response and the execution
status). No config or schema source is cited anywhere in the report — and
per the audit trail, `agent_config`/`schema_lookup` were never called (only
`agent_trace`, 1 tool call total), so there was no config source available
to cite even if the run had tried.

## fix_usable_unedited = 0

Per the rubric's explicit constraint, `fix_usable_unedited` may not be 1
while `fix_target_correct` is 0. Independently, the proposed fix ("Add
routing rules for 'Hardware' category") targets the wrong artifact (tool
configuration rather than table data) and would not resolve the seeded
defect if applied as written — it is a well-formed but inert fix against
this seed.

## Total: 0/6

## passes_gate = 0

`passes_gate = (root_cause_layer_correct == 2) AND (fix_usable_unedited ==
1)`. Neither condition holds (0 and 0 respectively), so `passes_gate = 0`.

## Notes for a later reader

- This is not a void run: the seed setup measurement in the packet
  (`rules_in_table: 0`, `matched: false`) confirms the seed was correctly in
  its defective state, and the run did exercise it (tool call returned the
  expected empty-table signal). The run simply stopped after one tool call
  (`agent_trace`, 1/7 layers swept) and reasoned no further, misattributing
  the empty result to the tool/config layer instead of continuing to layer 5
  (query_table / data existence) — the report's own `layers_swept` for L2–L7
  give reasons like "not performed" / "not analyzed," i.e. the run
  self-reports stopping early rather than confirming data-layer emptiness.
- The report structure is well-formed (populated `root_causes`, `confidence:
  UNCONFIRMED`, non-empty `fixes`, non-empty `verification`, no
  `inconclusive` key) — this is not a rejected-draft or inconclusive-shape
  case; it is a normal single-tool-call run that reached the wrong
  conclusion and scores accordingly under the rubric.
