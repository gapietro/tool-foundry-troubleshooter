# Seed 02 — ambiguous instruction

| | |
|---|---|
| **Expected root-cause layer** | `instruction` (layer 2) |
| **Expected fix target** | the instruction text |
| **Fluent source** | `../seed-app/src/fluent/seed-02-ambiguous-instruction.now.ts` |
| **Agent name** | Seed 02 Request Router |
| **Also stresses** | — |

## The defect

> **PREDICTED, NOT OBSERVED.** No seed has been installed or executed. What
> follows is derived from the Fluent source and the records emitted into
> `seed-app/dist/` — build-time evidence, not runtime evidence. **Confirm at
> Task 12** before scoring, and correct this section if the run disagrees.

"Assign it to the right group" defines neither "right" nor any means of
determining it. The agent has no group-lookup tool, no routing table, and no
list of groups in its instructions — so it must either invent a group name or
stall. What is absent is the seed: adding a lookup tool would test a different
layer.

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
