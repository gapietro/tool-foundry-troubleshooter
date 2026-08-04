# Scoring result — Row 11 (native, seed 03, run 2)

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | 2 | RC-1: "Layer 5 · Data," Finding: "The table exists and has the correct schema (`category`, `assignment_group`) but contains zero records. The tool cannot match any category because there is nothing to match against." Matches the seed's expected root-cause layer (`data`, layer 5) exactly, and explicitly rules out the schema/tool as the cause. |
| `fix_target_correct` | 2 | Fix 1: "Target type: Data," "Target: Table `x_snc_tsbench_routing`," proposing to "Insert at minimum one row per category the agent is expected to handle... Add rows for every other category in scope." Precisely the seed's expected fix target — data seeding, not the tool or the instructions. |
| `evidence_cites_trace_and_config` | 1 | RC-1's evidence cites `query_table` (`read_status: empty, unfiltered_row_count: 0, verdict: genuinely_empty`) and the tool's response as captured in the execution trace (`sn_aia_tools_execution` sys_id, `{"ok":true,"matched":false,...,"rules_in_table":0}`) — data-source evidence plus trace evidence, both cited for the same root cause. |
| `fix_usable_unedited` | 1 | Fix 1 gives a concrete row example (`category = Hardware, assignment_group = <target group name>`) and directs inserting rows for every category in scope — directly actionable, addressing the exact defect (zero rows). The placeholder group value is inherent to any data-seeding fix (the actual business-assignment value isn't discoverable from trace/schema alone), not a gap in the proposal. |

**Total: 6/6**

**`passes_gate`:** `root_cause_layer_correct == 2` (yes) AND `fix_usable_unedited == 1` (yes) → **`passes_gate = 1`**

**Note:** Clean hit, not a borderline call. Two secondary hardening fixes (Fix 2: mandatory `category` input; Fix 3: negative guidance in tool description) are additional and don't compete with or dilute the primary, correct root cause and fix target.
