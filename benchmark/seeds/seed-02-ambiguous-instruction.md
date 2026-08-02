# Seed 02 — ambiguous instruction

| | |
|---|---|
| **Expected root-cause layer** | `instruction` (layer 2) |
| **Expected fix target** | the instruction text |
| **Fluent source** | `../seed-app/src/fluent/seed-02-ambiguous-instruction.now.ts` |
| **Agent name** | Seed 02 Request Router |
| **Also stresses** | — |

## The defect

> **REFUTED AT TASK 12 (2026-08-02) — the predicted mechanism does not execute.**
> Measured on execution `11bd8d882baa4314f243fed2ce91bfb3`: the ReAct engine
> **cancels a tool-less agent before the LLM is ever invoked** — the run lasted
> ~2s, the Gen AI task was cancelled with output digest `{}`, and the agent
> replied *"I am unable to complete the task since I have no instructions or
> actions."* The instruction's ambiguity is never reached, so this construction
> cannot test layer-2 diagnosis: the observable defect is the zero-tool binding
> (layer 3), and Agent Doctor diagnosed exactly that in both scored runs. Both
> runs were scored strictly against the expected layer-2 answer (2/6, fail, not
> void — the seed was in its specified state) with the refutation recorded; see
> `../DECISION.md` §D2. **Seed 2 v2 must bind at least one (weak or irrelevant)
> tool** so the engine enters its loop and the ambiguity can actually drive the
> failure — the Phase 1b comparison re-run needs the corrected seed on both
> harnesses.

The original construction rationale, kept for the record:

"Assign it to the right group" defines neither "right" nor any means of
determining it. The agent has no group-lookup tool, no routing table, and no
list of groups in its instructions — so it must either invent a group name or
stall. What is absent is the seed: adding a lookup tool would test a different
layer. *(The refutation above shows the "stall" branch is taken by the engine,
mechanically, before the model can exhibit either behavior.)*

## Why it is built this way

The instructions read as complete and confident — "be accurate," "confirm the
assignment" — while giving the agent no way to ground a group decision in
anything but its own invention. This is the layer-2 case: nothing is broken in
a tool or in data, because there are none to break. The failure lives entirely
in what the instructions ask for versus what they equip the agent to do.

## Setup

Install the fixture app (Task 12): `cd benchmark/seed-app && now-sdk install --alias gpinst01`.
No data setup needed.

## Trigger

Open a fresh conversation with **Seed 02 Request Router** and give it a request
to route — e.g. *"my laptop will not boot"*. Capture the resulting
`sn_aia_execution_plan` sys_id.

## Expected diagnosis

Root cause in `instruction`: the instruction requires a determination the
agent has no means to make. Fix target: the instruction text — name the
groups, or supply a lookup tool and say to use it.

## Safety

No data touched.
