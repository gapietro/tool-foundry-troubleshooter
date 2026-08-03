# Scoring packet — Row 13

**Seed:** 04 (GenAI capability not mapped to a provider) · **Harness:** native (Agent Doctor) · **Run:** 1

This packet is self-contained. It contains the scoring rubric, this seed's
specification, this run's full report, and this run's audit-trail
measurements — nothing else. Score this row using only the content below.

---

## 1. Scoring rubric (verbatim from `benchmark/scorecard-template.md`)

### A. The 6-point rubric

| Column | Points | What it scores |
|---|---|---|
| `root_cause_layer_correct` | 0 or 2 | Diagnosis names the seed's expected root-cause layer (see the seed's own spec file for the expected value) |
| `fix_target_correct` | 0, 1 or 2 | Diagnosis names the correct fix target (tool schema / instruction text / data seeding / capability mapping / activation). **1 = partial**: the right area, without the specific target. See the partial-credit note below |
| `evidence_cites_trace_and_config` | 0 or 1 | Root cause cites BOTH the execution trace AND at least one config/schema source — the evidence rule from `docs/agent/agent-doctor-instructions.md` |
| `fix_usable_unedited` | 0 or 1 | The Fix Report's proposed fix could be applied by the builder AI as written, with no manual editing first — **and it addresses the defect the seed actually carries.** A well-formed fix aimed at the wrong target is a no-op, not a usable fix, so **`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0.** See the note under the gate rule for why this constraint lives here rather than in the gate expression |

**Total: 6 points per run.**

**Why `fix_target_correct` has a partial band.** It was 0-or-2, while
`seeds/seed-05-inactive-usecase.md` instructs the scorer to award *partial*
credit for naming "inactive" without naming which of the two activation gates is
off — an instruction the scale could not express, leaving the scorer to round
arbitrarily in either direction. The 1 band resolves it. Seed 5 is the only seed
that currently defines a partial case; for the others, 1 is available but must be
justified in `notes` if used.

### A2. `passes_gate` — the column the gate actually consumes

The rubric scores each run **out of 6**. The gate counts **runs**: *"≥ 8/10 runs
with correct root cause + usable fixes."* "Correct root cause + usable fixes"
names exactly two of the four rubric columns, so:

```
passes_gate = 1  if and only if  root_cause_layer_correct == 2
                                 AND fix_usable_unedited == 1
              0  otherwise
```

Nothing else feeds it. `evidence_cites_trace_and_config` and
`fix_target_correct` are **not** in the gate expression — they are diagnostic
detail that explains *why* a run passed or failed and must still be filled in,
but a run does not pass by accumulating them. A run can score 3/6 and pass; a run
can score 4/6 and fail.

**Why `fix_target_correct` still constrains the gate indirectly, and why that is
not a third term.** Excluding `fix_target_correct` from the expression opens a
hole: a run can name the right root-cause **layer** and propose a fix that is
perfectly well-formed and could be applied verbatim — but fixes **nothing**,
because it does not address the defect the seed actually carries (it targets a
plausible-looking but wrong specific target within the right area). Under a
purely formal reading of "applied as written," that run would score
`fix_usable_unedited` = 1 and **pass the gate**, making that run's
`fix_target_correct` = 0 inert as a scoring signal.

The fix is in the column definition, not the expression: a fix aimed at the wrong
target is not usable, so **`fix_usable_unedited` = 0 whenever
`fix_target_correct` = 0.** The gate keeps the two-term shape — *"correct root
cause + usable fixes"* — and "usable" now means what the word means. **A scorer
who marks a run 2 / 0 / 1 (`root_cause_layer_correct` / `fix_target_correct` /
`fix_usable_unedited`) has mis-scored it**; the correct row is 2 / 0 / 0,
`passes_gate` = 0.

### A3. Void runs — a run that measured nothing

A run is **void** when the seed was not in the state its spec requires, so the
run tested something other than the seeded defect. It is neither a hit nor a
miss, and scoring it either way corrupts the gate.

Known void conditions, both from the seed specs:

- **Seed 5** — the `sn_aia_trigger_agent_usecase_m2m` gate was not turned on
  post-install, so *both* activation gates were off and the seed isolated
  nothing. (Also void if the trigger fails to fire for the unresolved SDK 4.9.0
  run-as reason — see that seed's spec.)
- **Seed 4** — the capability sys_id in the installed `sn_aia_tool.script` does
  not match the target instance's `sys_one_extend_capability` record. Either way
  the tool tests a malformed reference rather than an unmapped provider. A
  hardcoded value that MATCHES the instance's record is a valid install, not a
  void.

**How to record one.** Put `void` in `passes_gate` — not `0` — write the reason
in `notes`, and leave the four rubric columns blank. A blank rubric with a stated
reason is honest; a `0` is a measurement that did not happen.

---

## 2. Seed specification (verbatim, `benchmark/seeds/seed-04-genai-unmapped.md`)

# Seed 04 — GenAI capability not mapped to a provider

| | |
|---|---|
| **Expected root-cause layer** | `genai_stack` (layer 6) |
| **Expected fix target** | capability mapping |
| **Fluent source** | `../seed-app/src/fluent/seed-04-genai-unmapped.now.ts` |
| **Agent name** | Seed 04 Summarizer |
| **Also stresses** | — |

## The defect

> [prior-pass observations removed — see issue #100]

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

2. **Verify the capability sys_id in the tool script matches the installed
   capability — mandatory.** *(State updated 2026-08-02: the Fluent source no
   longer ships the placeholder.)* At Task 12 the placeholder
   `REPLACE_WITH_SEED_04_CAPABILITY_SYS_ID` (the Build Rule #33 house pattern —
   the sys_id exists only after install, and an unreplaced placeholder fails
   loudly rather than pointing silently at the wrong record) was substituted
   with **gpinst01's** installed capability sys_id
   `92ff62af516741769c437feb88c80ef3`, and that value is now hardcoded in
   `seed-app/src/fluent/seed-04-genai-unmapped.now.ts`. What to do depends on
   the target instance:

   - **Reinstalling on gpinst01:** no substitution needed. Do NOT reintroduce
     the placeholder. Verify only (below).
   - **Installing on any other instance:** the hardcoded value is
     instance-specific and will match nothing. Read the installed capability's
     sys_id and replace the hardcoded value, then rebuild + reinstall (or patch
     `sn_aia_tool.script` for `summarise_ticket` directly on the instance):

     ```
     GET /api/now/table/sys_one_extend_capability
         ?sysparm_query=name=x_snc_tsbench_unmapped_capability
         &sysparm_fields=sys_id,name
     ```

   - **Verify in either case:** the sys_id in the *installed*
     `sn_aia_tool.script` equals the sys_id the GET above returns on the target
     instance.

   **If the installed script's sys_id does not match the instance's capability
   record, the seed is void** — the tool cannot reach any capability, and the
   run tests a malformed reference rather than an unmapped provider. (A
   correctly-matching hardcoded value is a VALID install, not a skipped step —
   do not record such a run as void.)

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
  is a no-op, not a usable fix. See the rubric's §A2 above: the column may not
  be 1 while `fix_target_correct` is 0. **The correct row for a decoy hit is
  2 / 0 / … / 0, `passes_gate` = 0.** Scoring it 2 / 0 / … / 1 lets the run pass
  the gate and makes the decoy inert.
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

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by `../../test/blindRule.test.js` — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 04 Summarizer
x_snc_tsbench_unmapped_capability
936e514a53b3b110f028ddeeff7b128c
```

---

## 3. This run's report

**Harness:** native (Agent Doctor, agent sys_id `e1392946828940e5a708fc51b0a5e954`)
**Prompt sent (verbatim):** `Diagnose execution plan 16ddc10c2baa4314f243fed2ce91bf15.`
**This run's own identity:** Execution ID `3180f2242b6acf14f243fed2ce91bfe8`, conversation `ed80b6682b2acf14f243fed2ce91bff0`
**Terminal state:** Completed
**Wall clock:** 144s
**Tool-call count (as reported when this run was fired):** 9 — `agent_trace` ×1, `read_artifact` ×5, `genai_log` ×2, `agent_config` ×1 (19 execution tasks total)

Full text of the Fix Report (the message the user/caller actually sees):

> ## Fix Report — Execution Plan `16ddc10c2baa4314f243fed2ce91bf15`
>
> ---
>
> ### FAILURE SUMMARY
>
> The user asked agent **Seed 04 Summarizer** to summarise bench ticket
> `063b49842b2a4bd417a6ffbeee91bf54`. The LLM reasoned correctly and
> dispatched the `summarise_ticket` tool. The tool executed and invoked
> capability `x_snc_tsbench_unmapped_capability`, but that capability's
> definition has its `api` field set to the nil sys_id
> (`00000000000000000000000000000000`), which resolves to no record in
> `sys_hub_flow`. The capability executor found no provider flow to call,
> returned `ok: false / status: error`, and the agent surfaced that error
> as its final output. The agent description explicitly states this agent
> is *"deliberately broken"* as a benchmark seed. The execution plan state
> is **Completed** (not errored), but the functional outcome — a ticket
> summary — was never produced.
>
> ---
>
> ### LAYERS SWEPT
>
> | Layer | Status | Notes |
> |-------|--------|-------|
> | 1 – Execution trace | **SWEPT** | Full artifact read; tool call error confirmed |
> | 2 – Instructions | **SWEPT** | Via agent_config; instructions are correct and coherent |
> | 3 – Tool definitions | **SWEPT** | Via agent_config; tool binding exists, active_tool_count = 0 |
> | 4 – Data schemas | **NOT SWEPT** | No blank field reads in the trace; schema mismatch ruled out by evidence already in hand |
> | 5 – Data (record existence) | **NOT SWEPT** | Failure is in capability wiring, not in whether the ticket record exists; the LLM received the objective and the tool was dispatched — the data path was never reached |
> | 6 – GenAI stack | **SWEPT** | `genai_log check_config` on capability `92ff62af516741769c437feb88c80ef3`; `for_execution` confirmed one successful LLM call |
> | 7 – Trigger and wiring | **SWEPT** | Via agent_config; trigger_links = 0, active_trigger_configurations = 0 — run was interactive so no trigger was required; use case is unset |
> | Platform logs | **UNAVAILABLE** | `log_analysis` is blocked on most instances (cross-scope syslog restriction). An instance administrator must grant cross-scope read on `syslog` / `syslog_transaction` to sweep this layer. |
>
> ---
>
> ### ROOT CAUSES
>
> **Root Cause 1 — Dangling provider flow on the capability definition**
>
> | Attribute | Value |
> |-----------|-------|
> | Layer | 6 – GenAI stack |
> | Component | `sys_one_extend_capability_definition`, record `904c0485699a4a73a124446a7231c563` |
> | Finding | `api` field holds the nil sys_id `00000000000000000000000000000000`, which resolves to no record in `sys_hub_flow`. The capability executor has no provider flow to call. |
> | Evidence | `genai_log check_config` — finding `api_dangling`, severity **high**; `sys_hub_flow` read returned **empty** against that sys_id; tool call response digest: `ok: false, status: error, raw_response.status: "error"` (trace artifact, offset 4000) |
> | Confidence | **CONFIRMED** — two independent sources (genai_log config audit + live tool call response) agree |
>
> **Root Cause 2 — Tool binding is inactive (active_tool_count = 0)**
>
> | Attribute | Value |
> |-----------|-------|
> | Layer | 3 – Tool definitions |
> | Component | `sn_aia_agent`, record `8bac1f84f3a1481487fe8dd219295914`; `sn_aia_agent_tool_m2m` binding `3c72dab2668c4ba5a6080a5cd5fb2b91` |
> | Finding | The agent has one tool binding but `active_tool_count = 0`, meaning the tool record itself or its binding is marked inactive. The tool still executed (the binding was followed at runtime), so this is a secondary hygiene defect that would block the tool in stricter routing configurations. |
> | Evidence | `agent_config` overview: `tool_count: 1, active_tool_count: 0` (artifact `46c03ea42b6acf14f243fed2ce91bf04`, offset 0) |
> | Confidence | **CONFIRMED** |
>
> ---
>
> ### FIXES
>
> **Fix 1 — Repoint the capability definition's `api` field to a real provider flow** *(primary fix)*
>
> | Attribute | Value |
> |-----------|-------|
> | Target type | Configuration |
> | Target | `sys_one_extend_capability_definition`, record `904c0485699a4a73a124446a7231c563`, field `api` |
> | Current | `00000000000000000000000000000000` (nil — resolves to nothing in `sys_hub_flow`) |
> | Proposed | The sys_id of the `sys_hub_flow` record for the intended Now LLM Service provider integration (e.g., the standard **Now LLM** or **Amazon Bedrock** spoke flow active on this instance) |
> | Rationale | The capability executor looks up this field to find the flow it must invoke. A nil sys_id means no flow is found; the executor immediately returns `status: error`. Pointing it at a real, active flow restores the dispatch path. |
>
> **Fix 2 — Activate the tool binding**
>
> | Attribute | Value |
> |-----------|-------|
> | Target type | Configuration |
> | Target | `sn_aia_agent_tool_m2m`, binding `3c72dab2668c4ba5a6080a5cd5fb2b91` (or the `sn_aia_tool` record it references), field `active` |
> | Current | Inactive (`active_tool_count = 0`) |
> | Proposed | `true` / checked |
> | Rationale | An inactive tool binding may be excluded from the agent's available tool set in stricter execution modes. Activating it ensures the tool is reliably available regardless of routing logic. |
>
> ---
>
> ### VERIFICATION
>
> 1. After applying Fix 1, open the `sys_one_extend_capability_definition` record `904c0485699a4a73a124446a7231c563` and confirm `api` resolves to a named `sys_hub_flow` record.
> 2. Re-run `genai_log check_config` against capability `92ff62af516741769c437feb88c80ef3` and confirm zero findings of type `api_dangling`.
> 3. Start a new interactive conversation with **Seed 04 Summarizer** using the same objective (`Please summarise bench ticket …`). Expect the tool call to return `ok: true` with a non-null `result`.
> 4. Confirm the final agent message contains a readable summary rather than an error payload.
>
> ---
>
> ### DATA MARKERS
>
> The following record data was quoted as evidence and should be redacted before this report crosses the instance boundary:
>
> - User profile message (trace): `user Email: admin@example.com`, `user Sys ID: 6816f79cc0a8016401c5a33be04be441`, `user Name: System Administrator`
> - Ticket sys_id referenced in objective: `063b49842b2a4bd417a6ffbeee91bf54`
> - Conversation sys_id: `9edd81c82baa4314f243fed2ce91bf8e`

---

## 4. This run's Task 10 audit-trail measurements

These were derived from `x_snc_troubleshoot_audit` (and, for native, the
`sn_aia_gen_ai_m2m` LLM-call linkage) independently of and before any Fix
Report was read for correctness. The audit trail can REFUTE a sweep claim in
the run's own report above, but never CONFER one.

- **`layers_swept` (audit-trail-derived): 5/7 (L1, L2, L3, L6, L7)**
- **Tool-call count:** 9
- **Tool-call order:** `agent_trace`, `read_artifact` ×2, `genai_log`, `read_artifact`, `genai_log`, `read_artifact`, `agent_config`, `read_artifact`
- **LLM-call count:** 7
- **`layers_available`:** 7/7 — `agent_trace, agent_config, schema_lookup, query_table, genai_log, log_analysis, read_artifact`, all `active=true` on the agent record (re-queried directly from the instance for this measurement, not assumed)
- **Terminal state:** Completed
- **Wall clock:** 144s

**Section detail on the `agent_config` call.** This run's one `agent_config`
call requested no specific section (i.e., all sections) and its audit-trail
result row carries `sections_returned: ["overview","instructions","tools",
"triggers"]`, crediting L2, L3, and L7. This matches what the run's own
LAYERS SWEPT table (Section 3 above) claims for those three layers — no
disagreement to flag for this run.

**Anchor-record note.** This run's own `x_snc_troubleshoot_run` anchor row
(the observation-channel record used to derive the measurements above)
remained `status: running` and was never updated to a terminal state, despite
the underlying native execution reaching `Completed` as shown above. This is
a harness-observation-channel gap, not a scoring input.

## 5. Additional notes

No additional run-specific notes beyond the report and measurements above.
