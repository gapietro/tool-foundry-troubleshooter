# Scoring result — Row 09 (native, seed 03, run 1)

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | 2 | RC-1: "Layer 5 — Data," Finding: "The routing table is genuinely empty. Zero rows exist with or without ACL filtering... `lookup_routing_rule` can never match any request." Matches the seed's expected root-cause layer (`data`, layer 5) exactly. |
| `fix_target_correct` | 2 | Fix 1: "Target type: Data," "Target: Table `x_snc_tsbench_routing`," proposing to "Insert at minimum one row per routable category... Add rows for all categories the agent is expected to handle." This is data seeding, precisely the seed's expected fix target — not the tool or the instructions. |
| `evidence_cites_trace_and_config` | 1 | RC-1's evidence cites `query_table` (`read_status: empty, unfiltered_row_count: 0, verdict: genuinely_empty`) and the tool call response captured in the trace (`matched: false, rules_in_table: 0`) — a data-grounding source plus the trace's own record of the tool's output, satisfying the two-source requirement. |
| `fix_usable_unedited` | 1 | Fix 1 gives a concrete row shape (`category = Hardware, assignment_group = <target group name>`) and instructs inserting one row per routable category — directly actionable data-seeding guidance addressing the exact defect (zero rows in the table). The placeholder group name is an inherent property of a data-seeding fix (the actual business assignment isn't discoverable from the trace/schema alone), not a gap in the proposal's structure. |

**Total: 6/6**

**`passes_gate`:** `root_cause_layer_correct == 2` (yes) AND `fix_usable_unedited == 1` (yes) → **`passes_gate = 1`**

**Note:** Clean hit, not a borderline call. The run also flags a secondary hardening finding (RC-2 / Fix 2, marking the `category` input mandatory) — this is additional, not competing, and does not affect the primary root cause or fix target, both of which correctly land on the data layer.
