# Seed 05 — use case exists but is inactive

| | |
|---|---|
| **Expected root-cause layer** | `wiring` (layer 7) |
| **Expected fix target** | activation |
| **Fluent source** | `../seed-app/src/fluent/seed-05-inactive-usecase.now.ts` |
| **Agent name** | Seed 05 Ticket Acknowledger |
| **Workflow** | Seed 05 Ticket Acknowledgement |
| **Also stresses** | — |

## The defect

> **PREDICTED, NOT OBSERVED.** No seed has been installed or executed. What
> follows is derived from the Fluent source and the records emitted into
> `seed-app/dist/` — build-time evidence, not runtime evidence. **Confirm at
> Task 12** before scoring, and correct this section if the run disagrees. This
> seed in particular already had two predictions refuted by reading `dist/` (see
> "The two gates" and the trigger condition note below).

`sn_aia_trigger_configuration.active` is `false`. Everything else is correct
and published: the agent's instructions are fine, the workflow is published,
the trigger targets the right table (`x_snc_tsbench_ticket`) on the right
event (`record_create`), and the use case (`sn_aia_usecase`) backing it
exists — because this is an `AiAgenticWorkflow`, not a bare `AiAgent` (see
below). Nothing fires, and the reason is a single deactivated gate, not a
missing or malformed configuration.

**Trigger condition corrected 2026-08-01.** ~~The trigger condition is
`active=true`.~~ `x_snc_tsbench_ticket` declares only `short_description` and
`priority` and extends nothing, so there is no `active` column and that
condition could never have matched — even with both gates on. A diagnosis
naming the bogus condition would have been *correct* and scored a miss. The
condition is now `short_descriptionISNOTEMPTY`, which matches exactly the rows
the setup step inserts.

## Why this is a workflow and not a bare agent

Build Rule #31: `triggerConfig` on a bare `AiAgent` is accepted without a
build error but yields a `sn_aia_trigger_configuration` whose `usecase` is
**null** — `AiAgent` has no usecase field, only `AiAgenticWorkflow` creates
the `sn_aia_usecase` record the trigger binds to. A bare-agent version of
this seed would fail to fire for a *different* reason than the one under
test (no backing flow/BR at all, from a null usecase), with no diagnostic
signal distinguishing it from the intended defect. Using `AiAgenticWorkflow`
means the only thing wrong is the one gate this seed sets out to test.

## The two gates

LLD §8 item 2 (R-18) established that use-case activation has **two
independent gates**: `sn_aia_trigger_configuration.active` and
`sn_aia_trigger_agent_usecase_m2m.active`. A use case reads as "inactive"
to an observer when *either* gate is off — they are not the same switch and
do not imply each other. This seed turns the trigger-configuration gate
**off** and leaves the m2m gate **on**. A correct diagnosis therefore has to
name the *specific* gate that is off (`sn_aia_trigger_configuration.active`)
rather than stop at the generic observation that "the use case is inactive."
A diagnosis that only says the use case is inactive, without identifying
which gate, scores **partial**, not full, on fix target.

## The m2m gate must be turned on by hand — it is a step, not a check

**Measured in `dist/`, 2026-08-01.** ~~Before scoring any run of this seed,
confirm on the instance that `sn_aia_trigger_agent_usecase_m2m.active` is
`true`.~~ That check was guaranteed to fail. Fluent exposes exactly **one**
`active` property on `triggerConfig` and it feeds
`sn_aia_trigger_configuration`; the m2m gate has **no Fluent property at all**,
and the build plugin emits `sn_aia_trigger_agent_usecase_m2m.active=false`,
mirroring the trigger config. A plain install therefore lands **both gates
off** — verified in the emitted XML — and with both off the seed isolates
nothing, a diagnosis naming either gate is arguably right, and this seed's 2
scored rows are void by construction.

So the m2m gate is not something to confirm; it is something to **set**, as a
mandatory post-install step:

```
PATCH /api/now/table/sn_aia_trigger_agent_usecase_m2m/<sys_id>
{"active": "true"}
```

Find `<sys_id>` by querying `sn_aia_trigger_agent_usecase_m2m` for the row whose
`trigger_configuration` is the *"Seed 05 Bench Ticket Created"* trigger. Then
**re-read the record and confirm `active` returns `true`.** Do not assume the
PATCH took.

Leave `sn_aia_trigger_configuration.active` at `false` — that is the seeded
defect and the whole point of the seed.

**If this step is skipped, the seed is void.** Record both of its runs as `void`
in the scorecard (see `../scorecard-template.md` § "Void runs"); do not score
them as hits or misses.

### Also open, for Task 12 — do not guess a value for it

SDK 4.9.0 guidance (`.claude/context/sdk-reference.md`, "4.9.0 guide hardening")
states that trigger run-as configuration is now **required for all trigger
types**. This workflow sets no `runAs`, and `dist/` confirms the emitted trigger
configuration carries `run_as`, `run_as_script` and `run_as_user` all empty. The
trigger may therefore still not fire even after the m2m gate is on. If it does
not, that is a **second** wiring defect layered on the seeded one and the seed is
no longer isolating a single cause — resolve it before scoring rather than
scoring through it.

## Setup

1. Install the fixture app (Task 12): `cd benchmark/seed-app && now-sdk install --alias gpinst01`
2. **Turn the m2m gate on** and verify it reads `true` — see the section above.
   This is mandatory; skipping it voids the seed.

## Trigger

Insert a row into `x_snc_tsbench_ticket` with a non-empty `short_description`
(the trigger condition is `short_descriptionISNOTEMPTY`) and any `priority`, and
confirm that nothing fires — no execution plan is created,
no acknowledgement appears. Because the thing under test is the *absence* of
an execution, there is typically no `sn_aia_execution_plan` sys_id to hand
the diagnostic agent for this seed. Instead, give the diagnostic agent the
**agent name** (`Seed 05 Ticket Acknowledger`) and/or the **workflow name**
(`Seed 05 Ticket Acknowledgement`), plus the sys_id of the ticket row that
was inserted and should have triggered it, and ask it to determine why the
expected acknowledgement never happened.

## Expected diagnosis

Root cause in `wiring`: the trigger configuration for the "Seed 05 Bench
Ticket Created" trigger has `active=false`, while the trigger-to-usecase m2m
gate is on. Fix target: activation — flip
`sn_aia_trigger_configuration.active` to `true` on that trigger. A diagnosis
that identifies only "the use case/trigger is inactive" without naming
`sn_aia_trigger_configuration.active` specifically scores **1 of 2** on
`fix_target_correct` (the partial band — see `../scorecard-template.md` § A),
per "The two gates" above.

## Safety

Touches only the fixture app's own agent, workflow, team, and trigger
configuration, and inserts one row into `x_snc_tsbench_ticket`, owned by the
fixture app. Nothing shared is modified.
