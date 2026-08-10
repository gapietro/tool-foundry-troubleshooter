# Row 13 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| total | 5/6 |
| passes_gate | 0 |
| ambiguous | yes |

## Reasoning

### root_cause_layer_correct

The seed spec's expected root-cause layer is `genai_stack` (layer 6): the capability
`x_snc_tsbench_unmapped_capability` exists but its definition's `api` is
`00000000000000000000000000000000` with `api_type=sys_hub_flow`, resolving to no flow record.

The report's RC-1, explicitly labelled *(primary)*, is "Capability api points to a
non-existent flow", **Layer: 6 — GenAI stack**, component
`sys_one_extend_capability_definition`, finding `api = 00000000000000000000000000000000`,
`api_type = sys_hub_flow`, no matching `sys_hub_flow` row. That is the seeded defect named
at the seeded layer, in the seeded terms.

The run did not fall for the R-22 decoy — the empty `connection` is never mentioned as a
root cause. It also added RC-2 (inactive tool/binding) and RC-3 (no error handling) as
secondary/contributing causes, but the primary is unambiguously the seed's. Score **2**.

Void check: §A3's seed-4 void condition is a capability sys_id in the installed
`sn_aia_tool.script` that does not match the instance's capability record. The run's
VERIFICATION step 3 targets capability `92ff62af516741769c437feb88c80ef3` — the exact
gpinst01 sys_id the seed spec says is hardcoded in the Fluent source — and the tool
reached the capability and failed on the dangling `api` rather than on "capability not
found". Section 5 also states no row in this pass was void. Not void.

### fix_target_correct

Expected fix target: **capability mapping** — repoint `api` at the real provider
integration subflow, "not the tool script and not the agent instructions."

FIX-1 is "Repoint capability `api` to a real flow", target
`sys_one_extend_capability_definition` · `904c0485699a4a73a124446a7231c563` · field `api`,
current `00000000000000000000000000000000`, proposed the sys_id of the real provider-integration
flow. That is the capability mapping, named at record-and-field specificity — not the right
area in general but the exact target. Score **2**.

The report also proposes FIX-2 (activate tool + binding) and FIX-3 (add try/catch to the
tool script). These are extra targets, not substitutes: FIX-1 is tied to the primary root
cause and is correct. The rubric scores whether the correct fix target is named, and it is.
(Noting for the record that FIX-2's premise sits oddly with the report's own narrative —
the tool demonstrably executed and returned `ok: false`, which an inactive tool with
`active_tool_count = 0` would not have done — but that concerns the added fix, not the
seeded one.)

### evidence_cites_trace_and_config

Sources present in the diagnosis:

- **Config/schema:** RC-1's Evidence cites `genai_log check_config` →
  `findings[0].finding = api_dangling`, `field = api`,
  `value = 00000000000000000000000000000000`, plus a `sys_hub_flow` read returning `empty`.
  That is the capability definition row showing the unresolvable `api` — exactly the
  config-side evidence the seed spec asks for. Unambiguously satisfied.
- **Execution trace:** the FAILURE SUMMARY reports that the LLM chose `summarise_ticket`,
  "which executed and returned `ok: false, status: error, result: null`" — the tool's
  execution failure result, which is the trace-side evidence the seed spec names. The
  layers-swept table attributes L1 to `agent_trace` + `read_artifact`, and the audit trail
  (§4) confirms `agent_trace` and four `read_artifact` calls were made, so the trace was
  genuinely read rather than asserted. VERIFICATION step 2 also reasons in trace fields
  (`task_tree[tool].status`, `tool_calls[0].response_digest`).

Both sides are present in the diagnosis, so I score **1** — but see the ambiguity section:
RC-1's own **Evidence** field contains config sources only, and a scorer reading the
column strictly as "the root-cause entry cites both" can defensibly reach 0.

### fix_usable_unedited

§A's constraint is checked first: `fix_target_correct` is 2, not 0, so the constraint does
not bind and §A2.1 is reachable.

FIX-1's **Proposed** value is "`sys_id` of the `sys_hub_flow` record implementing the
summarisation provider integration" — a described value, not a value. This is squarely
**§A2.1 Case 1 — the fix leaves a value slot unfilled**, which requires both conditions:

1. *Target and operation fully specified* — **yes.** Table, record sys_id
   (`904c0485699a4a73a124446a7231c563`), field (`api`), and the operation (repoint from the
   all-zeros sentinel) are all stated.
2. *The missing value is not obtainable from the instance by any of the seven diagnostic
   tools* — **no, it was obtainable.** The seed spec states the healthy value for a Now LLM
   Generic definition on gpinst01 is `936e514a53b3b110f028ddeeff7b128c` and that **422 of
   the 2026 definition rows** already carry it. A value held by a fifth of the rows of the
   very table the run had just read via `genai_log check_config` is reachable by
   `query_table` / `genai_log` — the instance holds it. Per Case 1's stated distinction,
   this is "diagnosis the run declined to perform", not "the builder's to choose", and the
   fix supplies not even a discovery procedure in its place.

Condition 2 fails, so Case 1 scores **0**. Case 2 does not arise as the deciding factor
(FIX-1 does address a runtime record and does resolve to exactly one record and one field,
which is why the fix falls to Case 1 rather than to address ambiguity).

The builder AI, this column's stated consumer, cannot apply FIX-1 as written — it must
first go find a flow sys_id the run had the tools to find and did not. Score **0**.

### passes_gate

`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here: 2 AND 0 → **0**. The run identifies the seeded defect at the seeded layer and names
the right fix target, and still fails the gate because the fix is not applicable as
written. Per §A2 that is the gate asking a narrower question, not an inconsistency.

### ambiguity

**yes** — one column was under-determined.

- **`evidence_cites_trace_and_config`** — two defensible readings.
  - **1:** the rubric scores the diagnosis's evidence base. The report cites the tool's
    execution failure result (`ok: false, status: error, result: null`, trace-derived, with
    `agent_trace` + `read_artifact` in the audit trail) *and* the capability definition row
    showing the dangling `api` — precisely the pair the seed spec names as "evidence a
    correct diagnosis should cite".
  - **0:** the rubric says "**Root cause** cites BOTH". RC-1's **Evidence** field cites
    `genai_log check_config` and a `sys_hub_flow` read — both config. The trace-derived
    result appears in the FAILURE SUMMARY, a different section, and is not offered as
    evidence *for RC-1*. On that reading the root-cause entry is config-only and scores 0.

  The packet does not say whether the citation must be co-located in the root-cause entry
  or may be drawn from the report as a whole, and I could not resolve it without material
  outside the packet. I scored 1 on the reading that best matches the seed spec's own
  expected-evidence sentence, and flag it.

The other three were determinate: `root_cause_layer_correct` by RC-1's explicit "Layer: 6
— GenAI stack" matching the spec verbatim, with no decoy contamination;
`fix_target_correct` by FIX-1 naming the definition record and the `api` field, which is
the spec's fix target exactly; `fix_usable_unedited` by §A2.1 Case 1's second condition
plus the spec's own statement that the healthy `api` value is on 422 rows of the instance —
obtainable, not looked up, so 0 with no weighing required.

Non-scoring note for the pass write-up: this row is not a decoy hit (the empty `connection`
is absent from the diagnosis), and the audit trail shows `layers_swept` 6/7 with no
`schema_lookup` call, so the report's "L4 ✅ SWEPT — confirmed via `schema_lookup`" claim
is unsupported by §4's mechanical record. RC-2's inactive-tool finding also contradicts the
report's own account of the tool executing. Neither affects the four scored columns.
