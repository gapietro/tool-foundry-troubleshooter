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

The capability definition `x_snc_tsbench_unmapped_capability` exists and is
reachable, but its `api` — the **mandatory** pointer at the `sys_hub_flow`
provider integration subflow that actually executes the call — is
`00000000000000000000000000000000`, which resolves to no flow record at all.
`api_type` still says `sys_hub_flow`, so the platform is told to run a Flow and
handed a Flow that does not exist. That is a broken capability→provider mapping:
the capability record is real, and there is no provider behind it.

**~~The `connection` premise~~ — REFUTED and replaced, 2026-08-01.** ~~Its
`connection` — the bound provider credential alias — is empty. R-18 established
that `connection` is exactly that binding, so an empty one is precisely
"capability not mapped to a provider".~~ ~~One missing binding, not three —
corrected 2026-08-01. The seed now matches the well-formed shape exactly, with a
real `sys_one_extend_capability` parent record, so **`connection` is the only
gap** — which is the seed's entire purpose.~~

R-18's reading of `connection` came from a **ten-row sample**. Measured against
the whole table on gpinst01, read-only:

| Measurement | Value |
|---|---|
| `sys_one_extend_capability_definition` rows | **2026** (not 10, not 12) |
| …with `connection` **empty** | **318 of 2026 (15.7%)**, shipped OOB Now Assist definitions among them |
| `sys_dictionary` — `connection` | `reference` → `sys_alias`, **`mandatory=false`** |
| `sys_dictionary` — `capability`, `api_type`, `api` | all **`mandatory=true`** |

An empty `connection` is therefore a normal, common, supported state. After the
previous fix wave this seed's record had become a structural clone of working OOB
definitions differing only in an *optional* field — it would most likely not have
failed at all, and a benchmark specimen that measures nothing is worse than no
specimen. The seed is re-targeted at a binding the platform actually requires, so
that the failure is guaranteed rather than hoped for. See **DESIGN.md R-22**.

**Why `api`, with the counts that justify it** — same table, same denominator of
2026:

- **1 of 2026 (0.05%)** rows has `api` empty — the single `api_type=Decision` row.
- `api_type=sys_hub_flow` accounts for **1840 of 2026** rows across **55 distinct
  `api` values**. **54 of those 55** resolve to a live `sys_hub_flow`; exactly one
  does not, and it belongs to a single OOB row (*"Default OneExtend Profanity
  Filter"*). A dangling `api` is therefore **1 row in 2026 (0.05%)** — about
  **300× rarer** than an empty `connection`, and genuinely anomalous rather than
  routine.
- `api` is `internal_type=document_id`, so it carries **no referential
  integrity**: an arbitrary sys_id installs verbatim and resolves to nothing.

The rejected alternative was a dangling `capability` reference. It is equally
mandatory, but it is a true `reference` column that the platform may validate or
repair, and breaking it would change the failure signature to *capability not
found* while leaving the tool no sys_id to invoke — which is the **fallback**
construction below, not this one.

**`connection` stays empty and is no longer the defect.** It is left empty
because there is no alias to bind and because 318 OOB rows do the same. **A
diagnosis that names the empty `connection` as the root cause is naming a normal
state and must not be scored as a hit** — see "Expected diagnosis".

**The invocation envelope was also wrong — corrected 2026-08-01.** This
correction stands and is unaffected by the re-targeting above. ~~The tool
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
capability would be an uncontained blast radius. All the seed does to the
instance is add one capability + one definition of its own, both owned by the
fixture app.

**Why a dangling `api` rather than a deleted one.** `api` is `mandatory=true`,
so an empty value is not a shape the platform is expected to accept — and only
1 of 2026 rows on the instance has one. A *populated but unresolvable* `api`
passes every mandatory check, installs verbatim (no referential integrity on a
`document_id` column), and fails at the point of use, which is exactly where a
diagnostic agent has to catch it. The all-zeros value is chosen so a maintainer
reading the record sees at a glance that it is deliberate; a plausible random
GUID would read as a real mapping that had drifted.

**LLD §8 item 8 is re-opened by this change** — it was closed on the refuted
`connection` premise. See LLD §8 item 8 and DESIGN.md R-22.

## Install risk and the fallback

`sys_one_extend_capability_definition` is a **global** table, and this is a
scoped app. A scoped app writing into a global table via the generic
`Record()` fallback may be refused at install even though it builds cleanly
— this was true for Task 11's build (see below) but install is a Task 12
concern this task does not reach.

If Task 12's install refuses either record, fall back to a tool invoking a
`capabilityId` that exists **nowhere at all** — no `sys_one_extend_capability`
row for it, and therefore no definition either. That construction needs no
global-table write of any kind: the only thing installed is the agent's own
tool script, inside `x_snc_tsbench`.

Note that it changes the seed's failure signature. The primary construction
produces *capability exists, its provider flow does not*; the fallback produces
*capability not found* — the platform cannot reach the capability record at all,
rather than reaching it and finding nothing behind it. If the fallback is used,
the seed's expected diagnosis changes accordingly and the scorecard must be
scored against the **fallback's** signature, not the one described above.

Do **not** improvise a third construction by emptying `connection`. That was
this seed's original defect and it was refuted — see "The defect".

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
exists but its definition points at a provider flow that does not exist —
`api_type=sys_hub_flow` with `api=00000000000000000000000000000000`, which
matches no `sys_hub_flow` record. Fix target: **capability mapping** — repoint
`api` at the real provider integration subflow (the healthy value for a Now LLM
Generic definition on gpinst01 is `936e514a53b3b110f028ddeeff7b128c`, used by
422 of the 2026 definition rows) — not the tool script and not the agent
instructions.

Evidence a correct diagnosis should cite: the tool's execution failure or error
result from `sn_one_extend.OneExtendUtil.execute`, **plus** the capability
definition row showing the unresolvable `api`.

**Scoring note — the empty `connection` is a decoy, and it is on the record on
purpose.** The definition also has `connection` empty. That is the *normal*
state for 318 of the instance's 2026 definition rows and the column is
`mandatory=false`, so it is not a defect. A diagnosis whose root cause is "the
capability has no connection bound" has named a normal state:

- Root cause `genai_stack` is still **correct** (the layer is right) — award
  `root_cause_layer_correct`.
- `fix_target_correct` scores **0** if the proposed fix is "bind a
  connection/credential alias" and nothing else. It is not the seeded defect and
  applying it would not make the capability work.
- `fix_usable_unedited` scores **0** as well, and this is the bullet that makes
  the decoy bite. "Bind a connection alias" is well-formed and a builder could
  apply it verbatim — but it fixes nothing, and a fix aimed at the wrong target
  is a no-op, not a usable fix. See `../scorecard-template.md` §A2: the column
  may not be 1 while `fix_target_correct` is 0. **The correct row for a decoy
  hit is 2 / 0 / … / 0, `passes_gate` = 0.** Scoring it 2 / 0 / … / 1 lets the
  run pass the gate and makes the decoy inert, which was a live defect in the
  scorecard until PR #33's round-2 review.
- Record the decoy hit in `notes` either way. It is a useful signal about the
  diagnostic agent, not just a scoring event.

**If the fallback from "Install risk and the fallback" above was used**, score
against that signature instead: root cause still lands in `genai_stack`, but the
evidence is a *capability not found* error rather than an invocation failure
against a missing provider flow, and a diagnosis should be scored on whether it
correctly identifies a missing/unregistered capability rather than a mis-mapped
one.

## Safety

Creates only its own capability definition and agent/tool records, owned by
the fixture app. No existing capability, connection, or provider mapping on
the instance is touched, unmapped or repointed. The dangling `api` value points
at a sys_id that exists nowhere, so it cannot collide with a real flow.
