# Scoring packet — Row 07

**Seed:** 02 · **Harness arm:** native (Agent Doctor, `servicenow_aia_execute`) · **Run:** 2

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

# Seed 02 — ambiguous instruction

| | |
|---|---|
| **Expected root-cause layer** | `instruction` (layer 2) |
| **Expected fix target** | the instruction text |
| **Fluent source** | the fixture app's Fluent source for seed-02-ambiguous-instruction.now.ts` |
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
the build output directory (main repo) guards the construction.

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

Install the fixture app: `cd the build output directory && now-sdk install --alias gpinst01`.
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
string. Guarded by the blind-rule guard test — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 02 Request Router
measure_request
```

---

## 3. This run's report

**Harness arm:** native (Agent Doctor, `servicenow_aia_execute`)  
**How this run was invoked:** servicenow_aia_execute on agent "Agent Doctor" — objective: "Diagnose the failing AI Agent execution with plan sys_id a950ad322be28318f243fed2ce91bfca. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes."  
**Execution under diagnosis:** `a950ad322be28318f243fed2ce91bfca`  
**This run's own identity:** diagnostic execution `efd02d362be28318f243fed2ce91bfab` (TR1000250)  
**Terminal state:** **completed**  
**Wall clock:** 5m15s  
**Tool-call count:** 14

## Fix Report — Agent: Seed 02 Request Router
**Execution Plan:** `a950ad322be28318f243fed2ce91bfca`

---

## FAILURE SUMMARY

The user submitted an access request for a finance reporting system. The agent completed with state **Completed** and emitted a polished "✅ Request Routed Successfully" message — but **no routing action was ever taken**. The only tool called was `measure_request`, which counts characters and words in the input text. After receiving that count (109 chars, 21 words), the LLM fabricated a routing outcome, naming an assignment group and confirming routing without any tool or data backing that claim. The agent's own description reads: *"Benchmark seed - deliberately broken."* It has zero active routing tools.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | ✅ SWEPT | `agent_trace` on plan `a950ad322be28318f243fed2ce91bfca` |
| 2 | Instructions | ✅ SWEPT | `agent_config`, instructions section |
| 3 | Tool definitions | ✅ SWEPT | `agent_config`, tools section |
| 4 | Data schemas | NOT SWEPT | The agent made no table reads; schema mismatch cannot be the proximate cause. Skipped deliberately. |
| 5 | Data — record existence | NOT SWEPT | No table queries were attempted by the agent; record absence is not the proximate cause. Skipped deliberately. |
| 6 | GenAI stack | ✅ SWEPT | `genai_log` mode `for_execution` |
| 7 | Trigger and wiring | ✅ SWEPT | `agent_config`, triggers section |
| — | Platform logs | ⛔ UNAVAILABLE | `syslog` has `caller_access = Caller Restriction`. An instance administrator must relax `caller_access` on `syslog` or provide a log export. Script errors inside the run are still visible via `agent_trace` (zero found). |

---

## ROOT CAUSES

### Root Cause 1 — No Routing Tool Is Bound to the Agent

| | |
|---|---|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_agent[cd050d48e810411d9f113fd530694fe6]` |
| **Finding** | The agent has exactly **one tool binding** (`measure_request`) and **zero active routing tools**. `measure_request` returns only `{received, characters, words}`. It performs no group lookup, no ticket creation, and no record write. There is no tool in the agent's toolset capable of routing a request. |
| **Evidence** | `sn_aia_agent[cd050d48e810411d9f113fd530694fe6].tool_count = 1`, `active_tool_count = 0`; binding `da3f01db9aec41da835887210ed4b902` name = `measure_request`; tool script (319 chars) returns `JSON.stringify({ received: true, characters: text.length, words: words })`; `sn_aia_tools_execution[2b50e1722be28318f243fed2ce91bf50]` response = `{received:true, characters:109, words:21}` — no routing data present. Agent description: *"Benchmark seed - deliberately broken."* |
| **Confidence** | ✅ CONFIRMED |

---

### Root Cause 2 — LLM Hallucinated a Routing Outcome From Measurement Data

| | |
|---|---|
| **Layer** | 6 — GenAI stack |
| **Component** | LLM call `5a6065722be28318f243fed2ce91bf1b`, definition `AIA ReAct Engine_Amazon Bedrock` (`31fee654ff116e10b9c9fffffffffffd`) |
| **Finding** | After receiving only `{received:true, characters:109, words:21}` from `measure_request`, the model produced a second LLM turn (9,350 ms, 454 response tokens) in which it invented a routing assignment — group name, confirmation text, and all — with no tool call backing it. The instructions say *"assign it to the right group … confirm the assignment back to the user"* but provide no tool to actually do so, creating an instruction–toolset gap that the model filled with confabulation. |
| **Evidence** | `sn_aia_gen_ai_m2m` join shows two LLM calls on task `7150ed322be28318f243fed2ce91bf3c`: call `365061722be28318f243fed2ce91bf0e` (3,279 ms, 134 tokens — first reasoning step) and call `5a6065722be28318f243fed2ce91bf1b` (9,350 ms, 454 tokens — fabricated routing response); task tree shows no tool call between the second Gen AI step and the Communicator step; communicator metadata confirms the fabricated message was delivered with `user_input = false`. |
| **Confidence** | ✅ CONFIRMED |

---

### Root Cause 3 — No Trigger Wiring (Agent Cannot Self-Start)

| | |
|---|---|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m` |
| **Finding** | Zero trigger links on both the agent-direct branch (0 rows) and the team/use-case chain (0 rows, 0 use cases). Both reads returned status `ok` / `empty`, so the absence is genuine. The agent cannot fire autonomously on a record event. (For this run it was invoked conversationally/interactively, so this is not the cause of *this* failure — but it blocks any automated routing scenario.) |
| **Evidence** | `agent_config` triggers section: `trigger_links = 0`, `active_trigger_links = 0`, `active_trigger_configurations = 0`; `sn_aia_usecase` rows = 0; `sn_aia_team_member` rows = 0; wiring finding `no_trigger_wiring` severity = high. |
| **Confidence** | ✅ CONFIRMED (absence is genuine; both reads were `ok`/`empty`) |

---

## FIXES

### Fix 1 — Add a Routing Tool

| | |
|---|---|
| **Target type** | Tool schema + tool binding |
| **Target** | `sn_aia_agent[cd050d48e810411d9f113fd530694fe6]` — add a new tool binding |
| **Current** | One binding: `measure_request` (character/word counter only) |
| **Proposed** | Create a new `sn_aia_tool` record (Script or REST type) that accepts the request text and returns an assignment group name (e.g., by querying `sys_user_group` on keywords or by calling a catalog/ITSM API). Bind it to the agent via `sn_aia_agent_tool_m2m`. Name it clearly (e.g., `route_request_to_group`). |
| **Rationale** | Without a routing tool the agent has no mechanism to fulfil its stated objective. The LLM will hallucinate a result every time. |

### Fix 2 — Update Instructions to Reference the Routing Tool and Prohibit Unsupported Claims

| | |
|---|---|
| **Target type** | Instruction |
| **Target** | `sn_aia_agent[cd050d48e810411d9f113fd530694fe6].instructions` |
| **Current** | `"Read the incoming request and assign it to the right group. Be accurate - assigning to the wrong group delays the requester. Confirm the assignment back to the user when you are done."` (183 chars) |
| **Proposed** | Extend to: (a) name the routing tool explicitly and describe when to call it; (b) add a negative constraint — *"Do not confirm routing unless the routing tool has returned a group name. If the tool is unavailable or returns no result, tell the user you could not route the request."*; (c) describe what a valid routing output looks like. |
| **Rationale** | The instruction–toolset gap is what causes the hallucination. Explicit negative guidance prevents the model from filling an absent tool result with confabulation. |

### Fix 3 — Expand the `measure_request` Tool Description

| | |
|---|---|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool[c3beac9180474930a70e4a4a3de7126d].description` |
| **Current** | `"Measures an incoming request: returns its character count and an approximate word count. Give it the request text."` |
| **Proposed** | Add: (a) explicit statement that this tool does **not** route, classify, or assign requests; (b) description of the output fields `received`, `characters`, `words` and their types; (c) a negative-guidance sentence: *"Do not use this tool to determine routing — use route_request_to_group for that."* |
| **Rationale** | Without boundary guidance the model treats measurement output as a signal it can reason routing from. The three `tool_smell` findings (`description_thin`, `description_no_negative_guidance`, `description_no_input_guidance`) all point here. |

### Fix 4 — Add Trigger Wiring (If Automated Firing Is Required)

| | |
|---|---|
| **Target type** | Wiring |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` |
| **Current** | 0 rows — no trigger links on either branch |
| **Proposed** | If the agent must fire on a record event (e.g., new catalog request submitted), create a use case (`sn_aia_usecase`), attach a trigger configuration pointing to the relevant table/condition, and link it via `sn_aia_trigger_agent_usecase_m2m`. If conversational-only invocation is intended, this fix is optional. |
| **Rationale** | An agent with no trigger wiring cannot self-start. The `no_trigger_wiring` finding is high-severity. |

---

## VERIFICATION

1. **After Fix 1:** Rerun a test conversation with the same objective. In `agent_trace`, confirm that `tool_calls` contains a call to `route_request_to_group` (or equivalent) with a non-empty group name in the response. `active_tool_count` on the agent overview should be ≥ 2.
2. **After Fix 2:** Inspect the second LLM turn in `genai_log mode=for_execution`. The model should call the routing tool rather than emitting a fabricated group name directly.
3. **After Fix 3:** Re-run `agent_config` tools section. Confirm `description_thin`, `description_no_negative_guidance`, and `description_no_input_guidance` smells are resolved.
4. **After Fix 4 (if applied):** Create a test triggering record and confirm an execution plan is created in `sn_aia_execution_plan` without manual invocation.
5. **End-to-end:** The final agent message must contain a group name returned by the routing tool, not a fabricated one. Cross-check the group name against `sys_user_group` to confirm it exists.

---

## DATA MARKERS

The following record data was quoted as evidence and should be redacted before this report crosses the instance boundary:

- `sn_aia_message[ed50ed322be28318f243fed2ce91bf1b]` — user profile content including email `admin@example.com`, name `System Administrator`, user sys_id `6816f79cc0a8016401c5a33be04be441`
- `sn_aia_message[a950ed322be28318f243fed2ce91bf1c]` — verbatim user utterance: *"I need access to the finance reporting system for my new role — please route this request to the right place."*
- Communicator task metadata — fabricated routing response text delivered to the end user
References: null

---

## 4. This run's audit-trail measurements

Derived from the diagnostic run's own audit trail (`action_type=result`) per §E1–§E2,
independently of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 5/7 (L1, L2, L3, L6, L7) — no schema_lookup and no query_table were called; the report states L4 and L5 were skipped deliberately — mechanical §E2 map of the distinct tool set (`agent_trace`→L1, `agent_config`→L2/L3/L7, `schema_lookup`→L4, `query_table`→L5, `genai_log`→L6; `read_artifact` and `log_analysis` map to no layer)
- **Tool-call count:** 14 result rows
- **Distinct tool names:** 5 — `agent_trace`, `read_artifact (x10)`, `agent_config`, `genai_log`, `log_analysis`
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 before run 1 by two independent paths that agreed: `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`) and the harness's own tool registry. All seven attached and active, `max_auto_executions = 10` on every one.
- **`continuous_tool_execution_limit`:** 25 — read live during this pass, not carried forward
- **Terminal state:** **completed**
- **Wall clock:** 5m15s
- **Harness HOLDs:** none

**One stated omission.** The per-call ordered list with timestamps and full arguments is not reproduced here. Where the argument of a held call bears on whether a layer was genuinely reached, that argument is named in section 5 instead. Every packet in this pass carries the same fields, so the instrument is constant across rows.

---

## 5. Notes specific to this run

- No run-specific notes.
- This run reached a terminal state and was not re-run. No row in this pass was void, and no arm used any of its permitted re-runs.

---

## 6. What to return

Score the four rubric columns, then compute `passes_gate` by the rule in section 1.
State your reasoning for each column. If a column is under-determined by the material
above, say so explicitly and set the packet-level `ambiguous` flag to `yes` — do not
guess and do not smooth it over. An honest "under-determined" is a usable measurement;
a confident guess is not.
