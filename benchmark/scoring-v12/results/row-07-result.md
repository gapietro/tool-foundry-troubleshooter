# Row 07 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| total | 3/6 |
| passes_gate | 0 |
| ambiguous | yes |

## Reasoning

### root_cause_layer_correct

The seed spec (§2) states the expected root-cause layer is `instruction` (layer 2), and it
goes further: *"A finding that `measure_request` is irrelevant to routing is supporting
evidence, not the root cause — the tool does what it says; the instruction is what fails to
connect the agent to a groundable decision."*

The report names three root causes and labels each with an explicit **Layer** field:

- Root Cause 1 — **Layer 3, Tool definitions** ("No Routing Tool Is Bound")
- Root Cause 2 — **Layer 6, GenAI stack** ("LLM Hallucinated a Routing Outcome")
- Root Cause 3 — **Layer 7, Trigger and wiring** ("No Trigger Wiring")

Layer 2 appears in the LAYERS SWEPT table as `✅ SWEPT` but produces **no root cause at
all**. The report's primary root cause is precisely the finding the seed spec designates as
supporting evidence rather than the cause, and its second root cause attributes the
confabulation to the GenAI stack rather than to the instruction. The expected layer is
therefore not named as a root-cause layer → **0**.

Recorded as under-determined (see §ambiguity): Root Cause 2's *Finding* prose does state the
causal mechanism in layer-2 terms — *"The instructions say 'assign it to the right group …
confirm the assignment back to the user' but provide no tool to actually do so, creating an
instruction–toolset gap that the model filled with confabulation."* A scorer reading the
column as "did the diagnosis identify the instruction as the cause, whatever it labelled the
layer" could defensibly award 2. I score the explicit layer labels, which the report itself
supplies as structured fields, and none of them is 2.

### fix_target_correct

Expected fix target: the instruction text — *"name the groups, or supply a lookup tool and say
to use it."*

**Fix 2** is exactly on target and specific: **Target type** `Instruction`, **Target**
`sn_aia_agent[cd050d48e810411d9f113fd530694fe6].instructions`, with the current 183-char
instruction quoted and a proposed extension that *"(a) name[s] the routing tool explicitly and
describe[s] when to call it"* plus a negative constraint and an output-shape description.
Paired with Fix 1 (create and bind a routing tool), this is the second sanctioned form of the
fix — *supply a lookup tool and say to use it*.

This is not the partial band: the report names the specific record and the specific field, not
just "the instruction area". → **2**.

### evidence_cites_trace_and_config

Both source classes are cited, and Root Cause 1 alone satisfies the rule:

- **Trace:** `sn_aia_tools_execution[2b50e1722be28318f243fed2ce91bf50]` response
  `{received:true, characters:109, words:21}` (RC1); the task tree showing no tool call between
  the second Gen AI step and the Communicator step, and the two `sn_aia_gen_ai_m2m` LLM calls
  on task `7150ed322be28318f243fed2ce91bf3c` (RC2).
- **Config/schema:** `sn_aia_agent[...].tool_count = 1`, `active_tool_count = 0`, the binding
  record `da3f01db9aec41da835887210ed4b902`, the tool script body, and the `agent_config`
  triggers section counts (RC1, RC3).

The audit trail (§4) independently confirms `agent_trace`, `agent_config` and `genai_log` were
all actually called, so the citations are not narrated. → **1**.

### fix_usable_unedited

The §A2 constraint does not bind here — `fix_target_correct` is 2, not 0 — so §A2.1 applies.

The fix that addresses the seed's defect is Fix 2 (instruction text), and as written it is
**dependent on Fix 1 and both carry unfilled slots**:

- Fix 1 asks the builder to *"Create a new `sn_aia_tool` record (Script or REST type) that
  accepts the request text and returns an assignment group name (e.g., by querying
  `sys_user_group` on keywords or by calling a catalog/ITSM API)."* The routing logic, the
  keyword-to-group mapping, and the choice between the two "e.g." alternatives are all left to
  the builder. No script is supplied.
- Fix 2 (a) tells the builder to name "the routing tool" — a tool that does not yet exist and
  whose name is only suggested parenthetically in Fix 1 — and (c) is an instruction to the
  builder to write text, not text. Only (b) is supplied verbatim.

This is **§A2.1 Case 1**, and it resolves to 0. The missing values — the actual assignment
groups this agent should route to — **were obtainable from the instance** by `query_table` on
`sys_user_group`, and the report itself proves it knew that: VERIFICATION step 5 says *"Cross-check
the group name against `sys_user_group` to confirm it exists."* The audit trail (§4) records only
five distinct tools — `agent_trace`, `read_artifact` (×10), `agent_config`, `genai_log`,
`log_analysis` — with **no `query_table` and no `schema_lookup`** called. The run therefore did
not perform the lookup that the sanctioned "name the groups" path requires, and supplying a
discovery sketch ("by querying `sys_user_group` on keywords") in place of the values does not
change the score. → **0**.

Case 2 does not apply (the fixes address agent/tool records addressed by sys_id, but the
unfilled-value question decides the column before record-addressing does).

### passes_gate

`passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1`.
Here: `root_cause_layer_correct = 0` and `fix_usable_unedited = 0` → both terms fail →
**`passes_gate = 0`**.

Not void: seed 02 is not among §A3's known void conditions (seeds 4 and 5 only), the run
reached terminal state `completed`, and §5 states no row in this pass was void.

### ambiguity

**Yes — two of the four columns were under-determined.**

1. **`root_cause_layer_correct`.** Reading A (mine, 0): the report supplies an explicit
   **Layer** field on every root cause, and those fields read 3, 6 and 7; layer 2 is swept but
   yields no root cause, and the report elevates to Root Cause 1 exactly the finding the seed
   spec designates as supporting evidence. Reading B (2): Root Cause 2's finding text names the
   instruction–toolset gap as the causal mechanism in the seed's own terms, so the diagnosis
   arguably *did* name the instruction as root cause and merely filed it under the wrong layer
   number. The packet does not say whether the column scores the label or the substance, and
   because it is a gate term the choice is not cosmetic.

2. **`fix_usable_unedited`.** Reading A (mine, 0): §A2.1 Case 1 — the instruction fix's
   substantive content depends on a routing tool that Fix 1 only sketches, and the group values
   were instance-obtainable via `query_table`, which the run never called. Reading B (1): under
   a formal "could the builder AI act on this" reading, Fix 2 names the exact record and field,
   quotes the current value, and supplies one constraint verbatim; a builder AI could plausibly
   execute Fix 1 + Fix 2 without asking a question. §A2 explicitly disfavours the purely formal
   reading, which is why I took A, but the fix here is a *design brief* rather than the
   wrong-target no-op §A2 was written to catch, so Case 1's applicability is a judgement the
   packet does not fully settle.

The two determinate columns: `fix_target_correct` — Fix 2 names the instructions field of a
specific agent record with specific proposed content, which is unambiguously the seed's
expected target at full specificity. `evidence_cites_trace_and_config` — trace and config
citations both appear inside a single root cause, and the §4 audit trail confirms both tool
families were genuinely called.
