# Row 03 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 0 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| total | 1/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct

The seed spec's header table prints `Expected root-cause layer` = `instruction` (layer 2).

The report states five root causes (RC-1 … RC-5), so **§A2.2 Case 2** applies first and is
applied before Case 1. Case 2 selects "the entry the report itself labels primary or ranks
first, else the first entry in the list, skipping any entry that asserts no defect exists."
The report labels no root cause "primary"; RC-1 is first in the ROOT CAUSES list and it
asserts a defect (a missing routing/assignment tool), so **RC-1 is the subject**. Case 2
expressly forbids scanning the list for an entry that happens to carry the expected layer —
so RC-3 (layer 5), RC-4 (layer 6) and the LAYERS SWEPT table's layer-2 row are not consulted,
and neither is the fact that the FAILURE SUMMARY narrates the instruction/capability mismatch.

**§A2.2 Case 1** then governs: RC-1 declares `**Layer:** 3 — Tool definitions`. Where the
report declares a layer, "score the declared value" and do not score the substance of the
finding text. The declared value is a single layer, not a compound, so the compound clause
does not arise. Declared 3 ≠ expected 2 → **0**.

Note for the record (it changes nothing): Case 1 explicitly states that a root cause whose
prose describes the seed's mechanism but is filed under the wrong layer still scores 0, and
the cost is "stated rather than argued away." RC-1's finding text does gesture at the seed's
mechanism ("The agent's stated instruction — *'assign it to the right group'* — requires a
tool that does not exist"), but it files that under layer 3 and frames the defect as the
missing tool rather than the instruction. Both the declared-value rule and the seed's own
*Expected diagnosis* ("A finding that `measure_request` is irrelevant to routing is
supporting evidence, not the root cause") point the same way.

### fix_target_correct

Seed spec: `Expected fix target` = **the instruction text** (area); the *Expected diagnosis*
section names the specific target — "the instruction text — name the groups, or supply a
lookup tool **and say to use it**."

Per **§A2.3 Case 2**, the column takes the highest value any single non-hedged proposed fix
earns, with the 1 band available only from the primary fix. Reading every proposed fix's
declared target (**Case 1**: score the declared `Target type` / `Target`):

- **FIX-1** *(labelled primary)* — `Target type: Tool definition + tool binding`; target is a
  new `sn_aia_tool` record plus an `sn_aia_agent_tool_m2m` binding. This is a compound, and
  Case 1's compound clause reads it on the conjunct naming the expected area — neither
  conjunct is the instruction text, so **0**. It is worth being explicit that FIX-1 is *not*
  the sanctioned fix's second limb: the seed sanctions "supply a lookup tool **and say to use
  it**", i.e. an instruction edit is constitutive of that limb, and FIX-1 declares no
  instruction change and proposes none in its body. Under Case 1, prose elsewhere in a fix
  that brushes a different area would not move the column anyway — and here there is no such
  prose to weigh.
- **FIX-2** — `Target type: Configuration`, the `active` flag on a binding record. Activation
  area, not instruction text → 0.
- **FIX-3** — `Target type: Data`, seeding `sys_user_group`. Data-seeding area → 0.
- **FIX-4** — `Target type: Tool schema`, the tool's `description` field. Tool-schema area → 0.
- **FIX-5** — `Target type: Configuration (verification step)`, a GenAI capability definition
  → 0.

No proposed fix declares or writes to the instruction text (`sn_aia_agent.instructions` or
equivalent), and none names the specific target the *Expected diagnosis* names. Every fix
falls in a different one of §A's five areas than the expected one, so neither the 2 band nor
the 1 band is reachable. **0**.

### evidence_cites_trace_and_config

**§A1 Case 1** does not apply — the report states root causes. **Case 2** applies (five root
causes) and selects the same subject as §A2.2 Case 2: **RC-1**, the first-listed entry that
asserts a defect. The column is evaluated against RC-1 alone; RC-2…RC-5's evidence is neither
credited nor charged. Note that this subject selection is independent of RC-1 being scored 0
above — §A1 Case 2 selects the primary, not the correct one.

**Case 3 (connection).** RC-1's root-cause statement names: the agent `Seed 02 Request
Router`, the tool `measure_request`, the `sn_aia_agent_tool_m2m` binding set, and the tool
script's contents. Its three cited sources each name an artifact RC-1 names:
- `agent_config` overview `tool_count: 1` / `tool_binding_rows: 1` — the binding set RC-1's
  Component names. **Config/schema half, connected.**
- Tool script body via `agent_config` artifact — the `measure_request` script RC-1's Finding
  describes. **Config/schema half, connected.**
- Execution trace (task tree): "the only tool call returns
  `{"received":true,"characters":56,"words":12}`" and the second Gen AI step naming a group
  with zero corresponding tool calls — this is the `measure_request` call and the agent's own
  execution, both named in RC-1. **Trace half, connected.**

**Case 4 (a call backs it).** The audit trail in section 5 records 17 result rows across 7
distinct tools including **`agent_trace`** (backs the trace half — and by the enumeration it
is the only tool that can) and **`agent_config`** (one of the six that back the config/schema
half). Both halves are backed; the families are enumerated, not judged, so no question arises
about which door the config claim came through. The packet carries no validator rejection.

**Case 5 (co-location).** Both halves sit inside RC-1's own `**Evidence:**` block — not in
the FAILURE SUMMARY, the LAYERS SWEPT table or an appendix. No cross-reference is needed.

Trace ∧ config both satisfied for the primary root cause → **1**.

### fix_usable_unedited

**§A's constraint binds before any §A2.1 case**: "`fix_usable_unedited` may not be 1 while
`fix_target_correct` is 0." `fix_target_correct` is 0, so the column is **0** and no case in
§A2.1 arises. This is the §A2 rationale operating exactly as written — a well-formed fix
aimed at the wrong target is a no-op, not a usable fix. FIX-1 through FIX-5 are individually
well-specified (FIX-2 in particular names one record, one field and one value), but none
repairs the defect the seed carries, so §A2.1 Case 5 would in any event find no proposed fix
addressing the seeded defect, which it says leaves the column 0.

### passes_gate

`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here root_cause_layer_correct = 0 and fix_usable_unedited = 0, so **`passes_gate` = 0**.

No §A3 void condition applies: the terminal state is `completed`, a full report body was
produced, and the seed-state void conditions listed belong to seeds 4 and 5. So this is a
scored `0`, not a void.

Note the §A2 warning applies in reverse here — the run scores 1/6 and fails, which is
consistent: the one point it earned (`evidence_cites_trace_and_config`) is not a gate term.

### ambiguity

**`ambiguous` = no.** Every column was determined by the packet's material without guessing:

- `root_cause_layer_correct` — the report declares an explicit `**Layer:**` row on its
  first-listed root cause, and the seed spec prints the expected layer as both a name and a
  number. §A2.2 Cases 2 then 1 apply mechanically.
- `fix_target_correct` — every proposed fix carries an explicit `Target type` row, and the
  seed spec gives both the area (header row) and the specific target (*Expected diagnosis*).
- `evidence_cites_trace_and_config` — the primary root cause's evidence block is explicit, and
  section 5's audit trail enumerates the tool families needed for §A1 Case 4.
- `fix_usable_unedited` — settled by §A's constraint before any judgement was required.

The judgement that took the most care was resisting the pull of the FAILURE SUMMARY, the
LAYERS SWEPT table's layer-2 row and RC-1's own instruction-quoting prose toward a layer-2
reading. That was effortful but not under-determined: §A2.2 Case 2 forbids scanning the list
and Case 1 forbids scoring the finding text against the declared label, so the packet
determines the value. Per section 7's instruction, effort alone is not grounds to flag.
