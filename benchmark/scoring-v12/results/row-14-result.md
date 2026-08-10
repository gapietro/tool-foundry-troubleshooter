# Row 14 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 0 |
| evidence_cites_trace_and_config | 0 |
| fix_usable_unedited | 0 |
| total | 2/6 |
| passes_gate | 0 |
| ambiguous | yes |

## Reasoning

Void check first (§A3): the seed spec records the fixture as verified 2026-08-02 with
the capability sys_id substituted and confirmed in the installed script, and §5 states
"No row in this pass was void." No void condition is presented as applying, so the row
is scored normally.

Constraint check next, as §A2 directs: `fix_target_correct` = 0 here (see below), so
`fix_usable_unedited` may not be 1 and neither §A2.1 case arises.

### root_cause_layer_correct
The seed's expected layer is `genai_stack` (layer 6). The report's `root_causes` array
contains five entries — layers 1, 5, 4, 6 and 7 — and one of them is `"layer": "6"`,
component "LLM interaction", finding "GenAI stack configuration may be misaligned". The
column as written scores whether the diagnosis *names the expected layer*, and the seed's
own decoy note confirms the column is layer-only and does not depend on the mechanism
being right ("Root cause `genai_stack` is still **correct** (the layer is right)" even
when the named cause is a normal state). Applied literally, layer 6 is named as a root
cause, so this scores 2. Recorded as 2 — but see the ambiguity section: the report itself
marks layer 6 `NOT_SWEPT`, so a scorer could defensibly read the entry as an enumerated
hypothesis rather than a named root cause and score 0.

### fix_target_correct
Expected fix target: **capability mapping** — repoint the definition's `api` at a real
provider integration subflow. The report proposes three fixes: (1) `tool schema` —
"validate input schema matches ticket table requirements" on `summarise_ticket`, with
`current: "unknown (not inspected)"`; (2) `configuration` — "add explicit error handling
for invalid tool responses"; (3) `data` — "add pre-execution query_table check for ticket
existence". None of the three touches the capability definition, its `api`, its `api_type`,
the provider flow, or any capability→provider binding. This is not the right area with the
specific target missing (the 1 band) — it is a different area entirely (tool schema, error
handling, input validation), so 0. Determinate.

### evidence_cites_trace_and_config
The column requires a root cause citing BOTH the execution trace AND at least one
config/schema source, and names the diagnostic agent's own evidence rule as the standard.
The run invoked exactly two tools (`agent_trace`, `schema_lookup`), per §4. Taking the
root causes one at a time: entries 0, 3 (layer 6) and 4 pair a `trace` citation with a
`config` citation that the harness validator rejected verbatim as "unsupported citation —
cites 'config' but this run never invoked a tool that reads it (agent_config, genai_log)";
entry 1 pairs trace with a similarly unsupported `data` citation; entry 2 (layer 4) is the
only one resting on a genuinely obtained source (`schema_lookup` on `incident.priority`)
and it carries **no trace citation at all**, which the validator also flagged as an
"evidence rule violation". So no single root cause pairs a trace citation with a
config/schema citation that corresponds to a tool this run actually ran. Awarding the
point would require crediting fabricated citations, or stitching the trace half and the
schema half together across two different root causes. Scored 0; the stitched/formal
reading is the competing one (see ambiguity).

### fix_usable_unedited
Bound by §A's constraint before any other consideration: `fix_target_correct` = 0, so this
column may not be 1. Independently the fixes are also unapplicable as written — fix 1
declares its own `current` state "unknown (not inspected)" and proposes to "validate" a
schema without stating any change, and fixes 2 and 3 name no table, record or field to
change. Neither §A2.1 case is reached, since the §A constraint binds first. 0. Determinate.

### passes_gate
`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here: 2 AND 0 → **0**. Note the gate verdict is robust to the root-cause ambiguity below:
under the competing reading (root_cause = 0) the gate is still 0, because
`fix_usable_unedited` = 0 either way.

### ambiguity
`ambiguous: yes`. Two columns were under-determined by the packet.

**`root_cause_layer_correct` — 2 vs 0.**
- *Reading for 2:* the rubric asks only whether the diagnosis names the expected layer,
  and `"layer": "6"` appears explicitly in `root_causes`. The seed's decoy note establishes
  that this column tolerates a wrong mechanism at the right layer, so hedged or empty
  content at layer 6 does not disqualify it.
- *Reading for 0:* the report's `layers_swept` self-reports layer 6 as `NOT_SWEPT` ("No
  genai_log call made to inspect LLM interactions"), and §4's audit trail confirms only
  L1 and L4 were swept. The layer-6 entry is hedged ("may be misaligned"), names no
  capability, `api` or provider flow, and its config citation was rejected as fabricated.
  The report's own single statement of the failure — `failure_summary` — attributes it to
  a tool-call error, not the GenAI stack. On that reading the layer-6 line is one item in
  a five-of-seven-layer enumeration of untested hypotheses, not a named root cause, and
  the packet contains no rule on how to treat shotgunned root-cause lists or which entry
  is primary.

**`evidence_cites_trace_and_config` — 0 vs 1.**
- *Reading for 0 (taken):* "Root cause cites BOTH" reads per-root-cause, and a citation to
  a tool the run never invoked is not a citation to a config source — the validator says so
  explicitly for four of the five entries, and flags the fifth for having no trace citation.
- *Reading for 1:* on a purely formal reading of the report text, root cause 0 and root
  cause 3 each literally carry a `trace` source and a `config` source; and across the
  report as a whole both a real trace citation (`agent_trace`) and a real schema citation
  (`schema_lookup`) are present. The rubric does not state whether the citation must be
  *supported* by a tool actually invoked, nor whether both halves must sit on the same
  root cause — the packet leaves the validator's authority over this column unstated.

`fix_target_correct` and `fix_usable_unedited` were determinate: the former because no
proposed fix touches the capability→provider mapping in any form, the latter because §A's
stated constraint fixes it at 0 once the former is 0.
