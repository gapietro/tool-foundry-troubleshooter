# Scoring packet — Row 16

**Seed:** 04 · **Harness arm:** custom (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`) · **Run:** 2

This packet is self-contained. It contains the scoring rubric, this seed's
specification, this run's full report, and this run's audit-trail
measurements — nothing else. Score this row using only the content below.

---

## 1. Scoring rubric

Section 1 is reproduced from this project's scoring template; section 2 is reproduced from
this seed's specification. **One deliberate change, applied to both:** repository file paths
have been replaced with plain-language descriptions of what they point at, because they are
navigable pointers to material a blind scorer must not read. The redaction is **mechanical and
touches paths only** — no rule, band, threshold, points value, measurement, setup step or
scoring note has been altered, added or removed, and no sentence has lost its meaning. This
rubric section is byte-identical in every packet.

## A. The 6-point rubric

| Column | Points | What it scores |
|---|---|---|
| `root_cause_layer_correct` | 0 or 2 | Diagnosis names the seed's expected root-cause layer (see the seed's own spec file for the expected value) |
| `fix_target_correct` | 0, 1 or 2 | Diagnosis names the correct fix target (tool schema / instruction text / data seeding / capability mapping / activation). **1 = partial**: the right area, without the specific target. See the partial-credit note below |
| `evidence_cites_trace_and_config` | 0 or 1 | Root cause cites BOTH the execution trace AND at least one config/schema source — the evidence rule from the diagnostic agent's own instructions |
| `fix_usable_unedited` | 0 or 1 | The Fix Report's proposed fix could be applied by the builder AI as written, with no manual editing first — **and it addresses the defect the seed actually carries.** A well-formed fix aimed at the wrong target is a no-op, not a usable fix, so **`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0.** See the note under the gate rule for why this constraint lives here rather than in the gate expression, and **§A2.1** for the two cases this definition does not otherwise determine — an unfilled value slot, and a fix that addresses a runtime record |

**Total: 6 points per run.**

**Why `fix_target_correct` has a partial band.** It was 0-or-2, while seed 5's
specification instructs the scorer to award *partial* credit for naming "inactive"
without naming which of the two activation gates is off — an instruction the scale
could not express, leaving the scorer to round arbitrarily in either direction. The
1 band resolves it. Seed 5 is the only seed that currently defines a partial case;
for the others, 1 is available but must be justified in `notes` if used.

## A2. `passes_gate` — the column the gate actually consumes

The rubric scores each run **out of 6**. The gate counts **runs**:
*"≥ 8/10 runs with correct root cause + usable fixes."*
Nothing connected the two, so two different 4/6 runs could be opposite verdicts —
correct cause with an unusable fix, versus wrong cause with a usable fix and
cited evidence — and whoever writes the decision record would have invented
the aggregation rule on the spot, on the most expensive decision in the project.

**The rule, derived from the gate's own wording.** "Correct root cause + usable
fixes" names exactly two of the four rubric columns, so:

```
passes_gate = 1  if and only if  root_cause_layer_correct == 2
                                 AND fix_usable_unedited == 1
              0  otherwise
```

Nothing else feeds it. `evidence_cites_trace_and_config` and
`fix_target_correct` are **not** in the gate expression — they are diagnostic
detail that explains *why* a run passed or failed and must still be filled in,
but a run does not pass by accumulating them. A run can score 3/6 and pass; a run
can score 4/6 and fail. That is not an inconsistency to be smoothed over in
the scored-pass write-up — it is the gate asking a narrower question than the rubric.

**Why `fix_target_correct` still constrains the gate indirectly, and why that is
not a third term** (added 2026-08-01, PR #33 review round 2). Excluding
`fix_target_correct` from the expression opened a hole big enough to swallow the
R-22 decoy. Seed 4 carries an empty `connection` deliberately, as a normal state
dressed as a defect; a run that falls for it names the right **layer**
(`genai_stack` → `root_cause_layer_correct` = 2) and proposes "bind a connection
alias" — a fix that is perfectly well-formed and fixes **nothing**, because the
real break is a dangling `api`. Under a purely formal reading of "applied as
written", that run scored `fix_usable_unedited` = 1 and **passed the gate**,
making the decoy's `fix_target_correct` = 0 inert. A decoy with no scoring
consequence is not a decoy.

The fix is in the column definition, not the expression: a fix aimed at the wrong
target is not usable, so `fix_usable_unedited` = 0 whenever
`fix_target_correct` = 0. The gate keeps the two-term shape the Task 12 wording
actually specifies — *"correct root cause + usable fixes"* — and "usable" now
means what the word means. **A scorer who marks a decoy run 2 / 0 / 1 has
mis-scored it**; the correct row is 2 / 0 / 0, `passes_gate` = 0.

**The gate verdict** is `sum(passes_gate) / <number of valid runs>`, read against
the Task 12 gate table. Record the sum explicitly in the decision record; do not
re-derive it from the /6 totals.

### A2.1 Two cases the column definition does not otherwise determine

*Added 2026-08-07, issue #139, after this column was found under-determined on
the majority of the rows it was applied to. The rationale is in the project's
decision record.* Because `fix_usable_unedited` is one of §A2's two gate terms,
an under-determined reading of it is not a rounding error — it changes the
verdict. Both cases below are decided by the seed spec plus the fix text.
**Neither asks the scorer to weigh anything.**

**Case 1 — the fix leaves a value slot unfilled.** Score `fix_usable_unedited`
= **1** only if BOTH hold:

1. the target and the operation are fully specified — the table or record, the
   field, and what to do to it; **and**
2. the missing value is **not obtainable from the instance** by any of the seven
   diagnostic tools (`agent_trace`, `agent_config`, `schema_lookup`,
   `query_table`, `genai_log`, `log_analysis`, `read_artifact`).

If the value **was** obtainable and the run simply **did not look it up**, score
**0**. Supplying a discovery procedure in place of the value does not change
this, and a procedure whose steps are UI actions rather than tool calls does not
make a value unobtainable.

*The distinction, stated so it is not re-derived: a value the instance does not
hold — an assignment group for a table that is empty by design — is the
builder's to choose, and demanding it would reward fabrication. A value the
instance does hold is diagnosis the run declined to perform.*

**Case 2 — the fix addresses a runtime record rather than the Fluent source.**
Score **1** if the address resolves to **exactly one record** and
**names every field it changes**. Score **0** if a scorer would have to work out
which record or which field the fix means. The builder AI is this column's stated
consumer, and SDK-owns-creation is a convention of this project rather than a
property of the diagnosis, so translating a unique runtime address into its
Fluent source is not an edit to the fix.

Both cases are subordinate to the constraint already stated in §A —
`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0. **Check that
first**; if it binds, neither case above arises.

## A3. Void runs — a run that measured nothing

A run is **void** when the seed was not in the state its spec requires, so the
run tested something other than the seeded defect. It is neither a hit nor a
miss, and scoring it either way corrupts the gate.

Known void conditions, both from the seed specs:

- **Seed 5** — the `sn_aia_trigger_agent_usecase_m2m` gate was not turned on
  post-install, so *both* activation gates were off and the seed isolated
  nothing. (Also void if the trigger fails to fire for the unresolved SDK 4.9.0
  run-as reason — see that seed's spec.)
- **Seed 4** — the capability sys_id in the installed `sn_aia_tool.script` does
  not match the target instance's `sys_one_extend_capability` record (originally:
  the `REPLACE_WITH_SEED_04_CAPABILITY_SYS_ID` placeholder was not substituted;
  since Task 12 the Fluent source hardcodes **gpinst01's** sys_id
  `92ff62af516741769c437feb88c80ef3`, which is equally void on any *other*
  instance until re-substituted — see the seed spec's Setup step 2). Either way
  the tool tests a malformed reference rather than an unmapped provider. A
  hardcoded value that MATCHES the instance's record is a valid install, not a
  void.

**How to record one.** Put `void` in `passes_gate` — not `0` — write the reason
in `notes`, and leave the four rubric columns blank. A blank rubric with a stated
reason is honest; a `0` is a measurement that did not happen.

**What a void row does to the denominator.**

1. A void row counts in **neither** the numerator nor the denominator. The
   denominator is the number of **valid** runs, not 10.
2. **Void runs should be re-run**, not absorbed. Fix the setup, run the seed
   again, and score the replacement. Voidness is a property of the run, not of
   the seed.
3. If a void run cannot be made valid, the gate is read as
   `sum(passes_gate) / <valid runs>` against the **same proportions**, and
   *all three* bands are proportional — not just the top one. The
   Task 12 bands are `≥ 8/10`, `5–7/10` and `< 5/10`,
   which are:

   | Band | Proportion of valid runs | Outcome |
   |---|---|---|
   | Top (`≥ 8/10`) | **≥ 80%** | Native is the front door |
   | Middle (`5–7/10`) | **≥ 50% and < 80%** | Native for lightweight triage + custom deep-diagnosis harness |
   | Bottom (`< 5/10`) | **< 50%** | Full custom harness as designed |

   Edges are **inclusive at the bottom of each band** (`≥`), and the comparison
   is on the proportion — do **not** round the pass count to a /10 equivalent
   first. Worked example, because this is the case that had no stated answer:
   **8 valid runs, 4 passes = 50.0% → middle band.** At 8 valid runs the bands
   are 7–8 passes (top), 4–6 (middle), 0–3 (bottom); at 9 valid runs, 8–9 (top),
   5–7 (middle), 0–4 (bottom). The decision record must show the percentage it read,
   not only the fraction.
4. **Floor: below 8 valid runs the gate is not evaluable.** The decision record must
   record the outcome as *gate not met — insufficient data*, state how many runs
   were void and why, and must **not** compute a verdict from the survivors. Two
   void rows already take this to exactly 8; a third puts the benchmark under its
   own floor. This is the case the whole column exists to make visible rather
   than let a low total hide it.

---

## 2. Seed specification (in full; repository paths redacted — see the note in section 1)

# Seed 04 — GenAI capability not mapped to a provider

| | |
|---|---|
| **Expected root-cause layer** | `genai_stack` (layer 6) |
| **Expected fix target** | capability mapping |
| **Fluent source** | the fixture app's Fluent source for seed-04-genai-unmapped.now.ts` |
| **Agent name** | Seed 04 Summarizer |
| **Also stresses** | — |

## The defect

> **Fixture state, verified 2026-08-02.** The primary construction installed
> without refusal (no fallback needed), the placeholder was substituted with
> capability sys_id `92ff62af516741769c437feb88c80ef3` and verified in the
> installed script, and the seed execution
> `16ddc10c2baa4314f243fed2ce91bf15` produced the predicted signature:
> `OneExtendUtil.execute` returned `status: "error"`, message "Plan invalid…",
> `capabilities: {}`, and the tool returned `ok: false`.

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
that the failure is guaranteed rather than hoped for. See **a repository document R-22**.

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
(see the seed's Fluent source file). The old form could
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
`connection` premise. See LLD §8 item 8 and a repository document R-22.

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

1. Install the fixture app (Task 12): `cd the build output directory && now-sdk install --alias gpinst01`

2. **Verify the capability sys_id in the tool script matches the installed
   capability — mandatory.** *(State updated 2026-08-02: the Fluent source no
   longer ships the placeholder.)* At Task 12 the placeholder
   `REPLACE_WITH_SEED_04_CAPABILITY_SYS_ID` (the Build Rule #33 house pattern —
   the sys_id exists only after install, and an unreplaced placeholder fails
   loudly rather than pointing silently at the wrong record) was substituted
   with **gpinst01's** installed capability sys_id
   `92ff62af516741769c437feb88c80ef3`, and that value is now hardcoded in
   the seed's Fluent source file. What to do depends on
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
   the seed's Fluent source file — Build Rule #42.)

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
  is a no-op, not a usable fix. See the scoring template §A2: the column
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

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by the blind-rule guard test — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 04 Summarizer
x_snc_tsbench_unmapped_capability
936e514a53b3b110f028ddeeff7b128c
```

---

## 3. This run's report

**Harness arm:** custom (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`)  
**How this run was invoked:** POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze with body {"execution": "6bd175722ba687d817a6ffbeee91bf91"}  
**Execution under diagnosis:** `6bd175722ba687d817a6ffbeee91bf91`  
**Triggering record:** `b4d1b9be2b6a8318f243fed2ce91bf30`  
**This run's own identity:** run_id `dc1431be2baa8318f243fed2ce91bfbd` (TR1000259)  
**Terminal state:** **complete (fix_report validated)**  
**Wall clock:** 24s  
**Tool-call count:** 3

```json
{
  "failure_summary": "The AI Agent execution for summarizing a bench ticket failed due to an error in the tool response, indicating a potential issue with the tool's input schema or execution context. The tool call returned an error status with a raw response containing a capability ID and status 'error', but no further details were provided in the trace.",
  "layers_swept": {
    "1": {
      "status": "SWEPT",
      "reason": "agent_trace provided execution details including tool call status and error message"
    },
    "2": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect instructions"
    },
    "3": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect tool definitions"
    },
    "4": {
      "status": "SWEPT",
      "reason": "schema_lookup confirmed sn_aia_tools_execution table exists and has required fields"
    },
    "5": {
      "status": "NOT_SWEPT",
      "reason": "No query_table call made to verify ticket record existence"
    },
    "6": {
      "status": "NOT_SWEPT",
      "reason": "No genai_log call made to inspect capability mappings"
    },
    "7": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect trigger wiring"
    }
  },
  "root_causes": [
    {
      "layer": "1",
      "component": "tool_call for summarise_ticket",
      "finding": "Tool call returned error status with capability ID 92ff62af516741769c437feb88c80ef3 but no actionable error details",
      "evidence": [
        {
          "source": "trace",
          "detail": "tool_call status: error, response_digest contains capability ID and status 'error'"
        },
        {
          "source": "trace",
          "detail": "execution_status: Success (conflict with error response)"
        }
      ],
      "confidence": "UNCONFIRMED",
      "would_confirm": "layer 3 - agent_config to verify tool schema matches expected input for ticket sys_id"
    }
  ],
  "fixes": [
    {
      "target_type": "tool schema",
      "target": "sn_aia_agent_tool_m2m.sys_id=3c72dab2668c4ba5a6080a5cd5fb2b91",
      "current": "unknown",
      "proposed": "Validate input schema requires valid ticket sys_id field",
      "rationale": "Ensure tool expects and can process the ticket sys_id provided in the execution objective"
    }
  ],
  "verification": "Re-run the agent and check if the tool call now returns a valid response when provided with a valid ticket record",
  "data_markers": [],
  "inconclusive": null
}
```

---

## 4. This run's audit-trail measurements

Derived from the diagnostic run's own audit trail (`action_type=result`) per §E1–§E2,
independently of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 2/7 (L1, L4) — mechanical §E2 map of the distinct tool set (`agent_trace`→L1, `agent_config`→L2/L3/L7, `schema_lookup`→L4, `query_table`→L5, `genai_log`→L6; `read_artifact` and `log_analysis` map to no layer)
- **Tool-call count:** 3 result rows
- **Distinct tool names:** 3 — `agent_trace`, `read_artifact`, `schema_lookup`
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 before run 1 by two independent paths that agreed: `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`) and the harness's own tool registry. All seven attached and active, `max_auto_executions = 10` on every one.
- **`continuous_tool_execution_limit`:** 25 — read live during this pass, not carried forward
- **Terminal state:** **complete (fix_report validated)**
- **Wall clock:** 24s
- **Harness HOLDs:** 1

The HOLD, recorded on the transcript by actor `system`, verbatim:

```
HOLD: terminal action refused — layer 4 (ranked) must be reached.
```

**One stated omission.** The per-call ordered list with timestamps and full arguments is not reproduced here. Where the argument of a held call bears on whether a layer was genuinely reached, that argument is named in section 5 instead. Every packet in this pass carries the same fields, so the instrument is constant across rows.

---

## 5. Notes specific to this run

- The call that answered the HOLD was schema_lookup on sn_aia_tools_execution — a platform table unrelated to this seed's fixture.
- This run reached a terminal state and was not re-run. No row in this pass was void, and no arm used any of its permitted re-runs.

---

## 6. What to return

Score the four rubric columns, then compute `passes_gate` by the rule in section 1.
State your reasoning for each column. If a column is under-determined by the material
above, say so explicitly and set the packet-level `ambiguous` flag to `yes` — do not
guess and do not smooth it over. An honest "under-determined" is a usable measurement;
a confident guess is not.
