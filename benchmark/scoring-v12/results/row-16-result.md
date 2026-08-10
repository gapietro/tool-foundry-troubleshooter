# Row 16 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 0 |
| evidence_cites_trace_and_config | 0 |
| fix_usable_unedited | 0 |
| total | 0/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct
The seed spec states the expected root-cause layer is `genai_stack` (layer 6): the capability
`x_snc_tsbench_unmapped_capability` exists but its definition's `api` points at
`00000000000000000000000000000000`, which resolves to no `sys_hub_flow`.

The report's single `root_causes` entry declares `"layer": "1"`, component
`"tool_call for summarise_ticket"`, with the finding that the tool call "returned error status
with capability ID 92ff62af516741769c437feb88c80ef3 but no actionable error details" and
`"confidence": "UNCONFIRMED"`. Its own `would_confirm` points at layer 3, not layer 6, and
`layers_swept` records layer 6 as `NOT_SWEPT` ("No genai_log call made to inspect capability
mappings"). The report never names the GenAI/capability-mapping layer as the root cause; it
names the tool-call layer. Not the expected layer → **0**.

This is not the decoy case either — the run did not name the empty `connection`; it did not
reach the capability definition at all. So the spec's "layer is still right" concession for a
decoy hit does not apply.

Void check: §A3's seed-4 void condition is a mismatch between the capability sys_id in the
installed `sn_aia_tool.script` and the instance's `sys_one_extend_capability` record. The report
observes capability ID `92ff62af516741769c437feb88c80ef3` in the trace — exactly the value the
seed spec says is hardcoded for gpinst01 — and the spec is explicit that a correctly-matching
hardcoded value is a valid install, not a void. §5 also states no row in this pass was void.
Scored as valid.

### fix_target_correct
Expected fix target: **capability mapping** — repoint the definition's `api` at the real
provider integration subflow, explicitly "not the tool script and not the agent instructions".

The report's one fix has `target_type: "tool schema"`, `target:
"sn_aia_agent_tool_m2m.sys_id=3c72dab2668c4ba5a6080a5cd5fb2b91"`, `current: "unknown"`, and
`proposed: "Validate input schema requires valid ticket sys_id field"`. That is the tool-schema
target the spec rules out, aimed at the agent-tool M2M record rather than the capability
definition. It is not the right area, so the partial 1 band does not apply — "tool schema" and
"capability mapping" are two of the five distinct enumerated targets, not a coarse-vs-specific
pair. → **0**.

### evidence_cites_trace_and_config
The root cause's `evidence` array has exactly two entries and both carry `"source": "trace"`
(tool_call status/response_digest, and the execution_status conflict). No config or schema source
appears in the root cause's evidence. The run did make a `schema_lookup` call, but §4 records it
against `sn_aia_tools_execution` — a platform table unrelated to the fixture (§5) — and in any
case the rubric scores what the **root cause cites**, and it cites trace only. Both-sources
requirement unmet → **0**.

### fix_usable_unedited
§A's constraint binds first and decides this column: `fix_usable_unedited` may not be 1 while
`fix_target_correct` is 0. `fix_target_correct` = 0 here, so this is **0**, and §A2.1's two cases
(unfilled value slot, runtime-record address) never arise.

For the record, the fix would also fail on its own terms: `current: "unknown"` and a `proposed`
of "Validate input schema requires valid ticket sys_id field" is an instruction to investigate,
not a change a builder could apply — it names no field value and no operation on the record. But
the constraint alone settles it.

### passes_gate
`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here root_cause_layer_correct = 0 and fix_usable_unedited = 0, so both terms fail →
**passes_gate = 0**.

### ambiguity
`ambiguous: no`. Each column was determined by the packet:

- **root_cause_layer_correct** — the report states its layer as a literal field (`"layer": "1"`)
  and the spec states the expected layer as a literal (`genai_stack`, layer 6). No
  interpretation needed; there is no second defensible reading in which the report named layer 6.
- **fix_target_correct** — the report states `target_type: "tool schema"` verbatim, and the spec
  states the expected target verbatim as capability mapping while explicitly excluding the tool
  script. Different enumerated targets, so no partial-credit judgement was required.
- **evidence_cites_trace_and_config** — both evidence entries are self-labelled `source: trace`;
  a config/schema citation is absent rather than debatable.
- **fix_usable_unedited** — forced to 0 by §A's stated constraint given `fix_target_correct` = 0,
  so no weighing occurred.

Void status was likewise determinate: the trace's capability sys_id matches the spec's hardcoded
gpinst01 value, which the spec defines as a valid install.
