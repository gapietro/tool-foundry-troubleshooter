# Seed 02 — ambiguous instruction

| | |
|---|---|
| **Expected root-cause layer** | `instruction` (layer 2) |
| **Expected fix target** | the instruction text |
| **Fluent source** | `../seed-app/src/fluent/seed-02-ambiguous-instruction.now.ts` |
| **Agent name** | Seed 02 Request Router |
| **Also stresses** | — |

## The defect (v2, 2026-08-02)

"Assign it to the right group" defines neither "right" nor any means of
determining it. The agent's one tool, `measure_request`, returns the character
and word count of the request — it is deliberately incapable of resolving a
group, and the instructions name none. Whatever the agent does about the group
is therefore driven by the instruction alone: it must invent a group name or
stall.

> **Prediction, not yet measured.** With one tool bound the engine enters its
> loop, the model plausibly measures the request, and the instruction then
> forces the invent-or-stall behavior. The Phase 1b comparison re-run is what
> measures this — until then the v2 mechanism carries the same epistemic
> status the v1 mechanism carried before Task 12 refuted it.

**Do not give the tool group/routing/assignment vocabulary or capability** —
the sanctioned fix for this seed is "name the groups, or supply a lookup tool
and say to use it", so a tool that even hints at lookup either moves the defect
to layer 3 or makes the fix appear already applied.
`test/seed02Construction.test.js` (main repo) guards the construction.

## Why v2: the v1 construction was refuted

v1 bound **no tools at all**, on the theory that absence was the purest form of
the defect. Measured 2026-08-02 on execution `11bd8d882baa4314f243fed2ce91bfb3`:
the ReAct engine **cancels a tool-less agent before the LLM is ever invoked** —
the run lasted ~2s, the Gen AI task was cancelled with output digest `{}`, and
the agent replied *"I am unable to complete the task since I have no
instructions or actions."* The instruction's ambiguity was never reached, so v1
could only ever test the zero-tool binding (layer 3), never the instruction
ambiguity this seed exists to isolate. v2 exists so that a run of this seed
reaches layer-2 diagnosis, on both harnesses.

## Why it is built this way

The instructions read as complete and confident — "be accurate," "confirm the
assignment" — while giving the agent no way to ground a group decision in
anything but its own invention. The one bound tool changes none of that:
nothing is broken in the tool (it works exactly as described) and nothing is
missing in data (none is involved). The failure lives entirely in what the
instructions ask for versus what they equip the agent to do.

## Setup

Install the fixture app: `cd benchmark/seed-app && now-sdk install --alias gpinst01`.
No data setup needed.

## Trigger

Open a fresh conversation with **Seed 02 Request Router** and give it a request
to route — e.g. *"my laptop will not boot"*. Capture the resulting
`sn_aia_execution_plan` sys_id.

## Expected diagnosis

Root cause in `instruction`: the instruction requires a determination the
agent has no means to make. Fix target: the instruction text — name the
groups, or supply a lookup tool and say to use it. A finding that
`measure_request` is irrelevant to routing is supporting evidence, not the
root cause — the tool does what it says; the instruction is what fails to
connect the agent to a groundable decision.

## Safety

No data touched.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by `../../test/blindRule.test.js` — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 02 Request Router
measure_request
```
