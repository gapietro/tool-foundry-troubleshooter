# Row 05 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 1 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| total | 2/6 |
| passes_gate | 0 |
| ambiguous | yes |

## Reasoning

### root_cause_layer_correct

The seed spec names the expected root-cause layer as `instruction` (layer 2), and is
explicit about the near-miss: "A finding that `measure_request` is irrelevant to routing
is supporting evidence, **not** the root cause — the tool does what it says; the
instruction is what fails to connect the agent to a groundable decision."

The report names four root causes and labels each with a layer:

- RC-1 "Missing assignment tool" — **Layer 3 — Tool definitions**
- RC-2 "Tool binding reports active_tool_count: 0" — **Layer 3**
- RC-3 "No trigger wiring" — **Layer 7**
- RC-4 "Tool description quality" — **Layer 3**

No root cause is placed in layer 2. Layer 2 appears only in the LAYERS SWEPT table
("183-char instruction, no assignment tool referenced") — a sweep note, not a named root
cause, and the observation it records is still the tool-absence framing rather than the
instruction's ungroundable demand. The primary root cause RC-1 is precisely the layer-3
reading the seed spec pre-emptively rules out. Nothing in the report asserts that the
instruction requires a determination the agent has no means to make; the report in fact
credits the LLM with having "reasoned correctly about the right group," which concedes
the determination was invented rather than grounded but never diagnoses that as the
defect.

Determinate: the report self-labels its layers, and none of them is 2. **0.**

### fix_target_correct

Expected fix target: the instruction text — "name the groups, or supply a lookup tool and
say to use it."

The report proposes three fixes:

- **FIX-1** — target type "Tool definition + wiring": create a new `sn_aia_tool`
  (`assign_to_group`) that writes `assignment_group`, bind it in
  `sn_aia_agent_tool_m2m`, **and** "Update the agent instruction to instruct the LLM to
  call this tool with the task table and sys_id after determining the target group."
- **FIX-2** — trigger wiring (`sn_aia_trigger_agent_usecase_m2m`).
- **FIX-3** — expand tool descriptions.

The dominant named target is a new tool plus its binding. The instruction text does
appear as a co-target inside FIX-1, which is the correct coarse area from the rubric's
list (tool schema / **instruction text** / data seeding / capability mapping /
activation) — but the specific change proposed to it is "call this tool after determining
the target group," which neither names the groups nor supplies any means of determining
one. The group determination the seed exists to isolate is left exactly as ungrounded as
before; `assign_to_group` resolves a group name the LLM still has to invent. So the
report reaches the right area without the specific target, which is the rubric's stated
definition of the 1 band.

I award **1** and flag it: see the ambiguity section — a 0 is defensible on the reading
that an instruction edit whose content is unrelated to the defect does not count as
naming the instruction text as a fix target at all.

### evidence_cites_trace_and_config

RC-1's Evidence field cites both source kinds explicitly:

- config: `agent_config` artifact `474eddf22ba28318f243fed2ce91bf2d` (`tool_count: 1`,
  `active_tool_count: 0`, the sole tool's sys_id and script return shape)
- trace: execution trace artifact `131ed1b22ba28318f243fed2ce91bf1d`
  (`related_task.table: ""`, `related_task.record: ""`, the single `measure_request`
  call, communicator output)

RC-2 and RC-4 cite config only; RC-3 cites config only. But the rubric asks whether the
root cause cites both, and the report's primary root cause does. The audit trail
corroborates that both underlying reads happened (`agent_trace` and `agent_config` are
both in the distinct-tool set, §4). Determinate. **1.**

### fix_usable_unedited

The §A rule was checked first: `fix_usable_unedited` may not be 1 while
`fix_target_correct` is 0. I scored `fix_target_correct` = 1, so that constraint does not
bind and the case analysis is reachable — but it does not rescue the column, because the
second half of the column's own definition fails: the fix must "address the defect the
seed actually carries."

It does not. The seed's defect is that "assign it to the right group" defines neither
"right" nor any means of determining it. FIX-1 adds a tool that *writes* an assignment
once a group has been chosen, and an instruction line telling the LLM to call it "after
determining the target group" — leaving the determination step exactly where the seed put
it, as invention. Applied verbatim, FIX-1 changes the failure from "invents a group and
narrates it" to "invents a group and writes it to a record," which is worse rather than
fixed. FIX-2 (trigger wiring) targets a property of the fixture that is not a defect at
all — the seed's trigger is conversational by design — and FIX-3 is cosmetic. So this is
a well-formed fix aimed at the wrong target, which §A2 states plainly is "a no-op, not a
usable fix."

Independently, FIX-1 would also not be applicable as written even on its own terms: it
asks the builder to author a Script tool script, choose between `group_name` and
`group_sys_id`, and pick a target table — but the "wrong target" reading is sufficient
and I do not rely on the workmanship reading.

Neither §A2.1 case applied. Case 1 (unfilled value slot) is not the operative reason for
the 0 — the fix's defect is its target, not a missing lookup value. Case 2 (runtime
record) is not reached for the same reason; FIX-1 does address runtime records
(`sn_aia_tool` / `sn_aia_agent_tool_m2m`) and names them uniquely enough, but a uniquely
addressed record is irrelevant when the record is the wrong thing to change. **0.**

### passes_gate

```
passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1
```

root_cause_layer_correct = 0 and fix_usable_unedited = 0. Both terms fail, so
`passes_gate` = **0**. No §A3 void condition applies: the void list covers only seeds 4
and 5, this is seed 02, §4 records a terminal state of completed with no harness HOLDs,
and §5 states no row in this pass was void.

### ambiguity

**`ambiguous: yes` — one column was under-determined: `fix_target_correct`.**

Two defensible readings, both grounded in the packet:

- **1 (what I scored):** FIX-1 explicitly lists an instruction edit among the changes it
  proposes. "Instruction text" is one of the five coarse areas the rubric names, so the
  report reached the right area; it did not reach the specific target (name the groups /
  supply grounded determination), which is exactly the rubric's 1 band — "the right area,
  without the specific target."
- **0:** the instruction edit is subordinate machinery inside a fix whose declared
  "Target type" is "Tool definition + wiring," and its content ("call this tool after
  determining the target group") is unrelated to the defect. On this reading the report
  never targets the instruction *as the thing that is wrong*, and mentioning the
  instruction as a place to add a tool-invocation line is not naming a fix target. That
  reading also better honors the seed spec's warning that giving the tool layer
  routing/assignment capability "moves the defect to layer 3."

The rubric's own note concedes 1 "must be justified in `notes` if used" for non-seed-5
seeds, which is itself a signal that this band's boundary is not pinned down for this
seed. The choice does not affect `passes_gate` here (the gate already fails on
`root_cause_layer_correct`), but it does move the /6 total between 1 and 2, so it is
recorded rather than smoothed.

The other three columns were determinate:

- `root_cause_layer_correct` — the report self-labels every root cause's layer; none is 2,
  and the seed spec pre-emptively names the layer-3 tool framing as supporting evidence
  rather than root cause.
- `evidence_cites_trace_and_config` — RC-1's Evidence field names an execution-trace
  artifact and an agent_config artifact by sys_id, in one field.
- `fix_usable_unedited` — the column definition requires the fix to address the seed's
  actual defect, and the seed spec states the defect (ungroundable group determination)
  in terms the proposed fix leaves untouched.
