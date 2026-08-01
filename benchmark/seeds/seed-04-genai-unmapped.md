# Seed 04 — GenAI capability not mapped to a provider

| | |
|---|---|
| **Expected root-cause layer** | `genai_stack` (layer 6) |
| **Expected fix target** | capability mapping |
| **Fluent source** | `../seed-app/src/fluent/seed-04-genai-unmapped.now.ts` |
| **Agent name** | Seed 04 Summarizer |
| **Also stresses** | — |

## The defect

> **PREDICTED, NOT OBSERVED.** No seed has been installed or executed. What
> follows is derived from the Fluent source and the records emitted into
> `seed-app/dist/` — build-time evidence, not runtime evidence. **Confirm at
> Task 12** before scoring, and correct this section if the run disagrees.

The capability definition `x_snc_tsbench_unmapped_capability` exists, but its
`connection` — the bound provider credential alias — is empty. R-18
established that `connection` is exactly that binding, so an empty one is
precisely "capability not mapped to a provider": the capability record is
real and reachable, but there is no provider behind it to actually run the
call.

**One missing binding, not three — corrected 2026-08-01.** ~~The capability
definition carries `api_type: 'generic'`.~~ As originally built the record had
`api_type=generic`, **no `api` value at all**, and `capability` holding a name
string where the column is a reference to `sys_one_extend_capability` — three
missing bindings, so an installed run could have failed on any of them and a
diagnosis blaming the wrong one would have been scored unfairly. The well-formed
shape was read off gpinst01 read-only: all 12 `sys_one_extend_capability_definition`
rows use `api_type=sys_hub_flow` with `api` pointing at the provider integration
subflow. The seed now matches that shape exactly, with a real
`sys_one_extend_capability` parent record, so **`connection` is the only gap** —
which is the seed's entire purpose. (The instance carries a live example of this
same state: *"Generic metadata summarizer (Now LLM Service - Now LLM Generic)"*
has `api` set and `connection` empty.)

**The invocation envelope was also wrong — corrected 2026-08-01.** ~~The tool
calls `sn_one_extend.OneExtendUtil.execute` with the capability name.~~ It
previously called `execute({capability: '<name>', ticket: ...})`. The real
envelope is an array under `executionRequests`, keyed by capability **sys_id**
(see `.claude/context/sdk-examples/now-assist-skill.now.ts`). The old form could
not reach the capability record at all, so it could never have failed on the
empty `connection`: it would have died as a malformed-request **script error —
layer 3, not layer 6** — and an agent correctly reporting the malformed envelope
would have been scored a **miss** on a seed whose expected answer is
`genai_stack`.

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

2. **Substitute the capability sys_id into the tool script — mandatory.** The
   tool ships with the placeholder `REPLACE_WITH_SEED_04_CAPABILITY_SYS_ID`
   (the house pattern from Build Rule #33: the sys_id exists only after install,
   and an unreplaced placeholder fails loudly rather than pointing silently at
   the wrong record). Read the installed capability's sys_id:

   ```
   GET /api/now/table/sys_one_extend_capability
       ?sysparm_query=name=x_snc_tsbench_unmapped_capability
       &sysparm_fields=sys_id,name
   ```

   then replace the placeholder with that sys_id in
   `seed-app/src/fluent/seed-04-genai-unmapped.now.ts` and rebuild + reinstall,
   or patch `sn_aia_tool.script` for `summarise_ticket` directly on the instance.
   Confirm the placeholder string no longer appears in the installed script.

   **If this is skipped the seed is void** — the tool cannot reach any
   capability, and the run tests a malformed reference rather than an unmapped
   provider.

3. Insert one bench ticket with `short_description` set. Record its sys_id.
   (Possible only because of the record ACLs and `allowWebServiceAccess` in
   `seed-app/src/fluent/seed-tables-acl.now.ts` — Build Rule #42.)

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
