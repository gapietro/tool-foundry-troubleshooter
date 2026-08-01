# Seed 04 — GenAI capability not mapped to a provider

| | |
|---|---|
| **Expected root-cause layer** | `genai_stack` (layer 6) |
| **Expected fix target** | capability mapping |
| **Fluent source** | `../seed-app/src/fluent/seed-04-genai-unmapped.now.ts` |
| **Agent name** | Seed 04 Summarizer |
| **Also stresses** | — |

## The defect

The capability definition `x_snc_tsbench_unmapped_capability` exists, but its
`connection` — the bound provider credential alias — is empty. R-18
established that `connection` is exactly that binding, so an empty one is
precisely "capability not mapped to a provider": the capability record is
real and reachable, but there is no provider behind it to actually run the
call.

## Shared-instance safety

The seed creates its **own** capability definition rather than unmapping a
real one. LLD §7 warns explicitly against unmapping real capabilities on the
shared instance — gpinst01 hosts other tenants, and breaking an existing
capability would be an uncontained blast radius. This closes **LLD §8 item
8**, qualified as *build-proven, not yet runtime-proven*: Task 11 confirms
the Fluent definition compiles and produces the expected records at build
time; it does not confirm the capability behaves as unmapped once installed
on a live instance.

## Install risk and the fallback

`sys_one_extend_capability_definition` is a **global** table, and this is a
scoped app. A scoped app writing into a global table via the generic
`Record()` fallback may be refused at install even though it builds cleanly
— this was true for Task 11's build (see below) but install is a Task 12
concern this task does not reach.

If Task 12's install refuses the capability record, fall back to a tool
referencing a capability name that exists **nowhere at all** (no
`sys_one_extend_capability_definition` row for it under any name). Note that
this changes the seed's failure signature: the original construction
produces *capability exists, not mapped to a provider*; the fallback
produces *reference not found* instead — the platform can't find the
capability record at all, rather than finding it and failing to invoke a
provider. If the fallback is used, the seed's expected diagnosis changes
accordingly, and the scorecard must be scored against the **fallback's**
signature, not the one described above.

## Setup

1. Install the fixture app (Task 12): `cd benchmark/seed-app && now-sdk install --alias gpinst01`
2. Insert one bench ticket with `short_description` set. Record its sys_id.

## Trigger

Open a fresh conversation with **Seed 04 Summarizer** and ask it to summarise
the bench ticket by sys_id. Capture the resulting `sn_aia_execution_plan`
sys_id.

## Expected diagnosis

Root cause in `genai_stack`: the capability `x_snc_tsbench_unmapped_capability`
exists but has no provider connection bound to it. Fix target: capability
mapping (bind a connection/credential alias to the capability), not the tool
script or the agent instructions.

Evidence a correct diagnosis should cite: the tool's execution failure or
error result from `sn_one_extend.OneExtendUtil.execute`, plus the capability
definition showing `connection` empty.

**If the fallback from "Install risk and the fallback" above was used**,
score against that signature instead: root cause still lands in
`genai_stack`, but the evidence is a *reference not found* error rather than
an invocation failure against an unmapped provider, and a diagnosis should
be scored on whether it correctly identifies a missing/unregistered
capability rather than an unmapped one.

## Safety

Creates only its own capability definition and agent/tool records, owned by
the fixture app. No existing capability, connection, or provider mapping on
the instance is touched or unmapped.
