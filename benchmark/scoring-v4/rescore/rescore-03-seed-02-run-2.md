# Scoring Packet — Seed 02, Run 2

This packet contains everything needed to score one diagnostic run against the rubric below.
Score it as a run to be graded.

---

## 1. Rubric

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

The rubric scores each run **out of 6**. The gate in `docs/IMPLEMENTATION_PLAN.md`
Task 12 counts **runs**: *"≥ 8/10 runs with correct root cause + usable fixes."*
Nothing connected the two, so two different 4/6 runs could be opposite verdicts —
correct cause with an unusable fix, versus wrong cause with a usable fix and
cited evidence — and whoever writes `benchmark/DECISION.md` would have invented
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
`DECISION.md` — it is the gate asking a narrower question than the rubric.

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
the Task 12 gate table. Record the sum explicitly in `DECISION.md`; do not
re-derive it from the /6 totals.

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
   `IMPLEMENTATION_PLAN.md` Task 12 bands are `≥ 8/10`, `5–7/10` and `< 5/10`,
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
   5–7 (middle), 0–4 (bottom). `DECISION.md` must show the percentage it read,
   not only the fraction.
4. **Floor: below 8 valid runs the gate is not evaluable.** `DECISION.md` must
   record the outcome as *gate not met — insufficient data*, state how many runs
   were void and why, and must **not** compute a verdict from the survivors. Two
   void rows already take this to exactly 8; a third puts the benchmark under its
   own floor. This is the case the whole column exists to make visible rather
   than let a low total hide it.

---

## 2. Seed spec — `benchmark/seeds/seed-02-ambiguous-instruction.md`

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

## History: the v1 construction was refuted at Task 12

v1 bound **no tools at all**, on the theory that absence was the purest form of
the defect. Measured 2026-08-02 on execution `11bd8d882baa4314f243fed2ce91bfb3`:
the ReAct engine **cancels a tool-less agent before the LLM is ever invoked** —
the run lasted ~2s, the Gen AI task was cancelled with output digest `{}`, and
the agent replied *"I am unable to complete the task since I have no
instructions or actions."* The instruction's ambiguity was never reached, so v1
could only ever test the zero-tool binding (layer 3); Agent Doctor diagnosed
exactly that in both scored runs, which were scored strictly against the
expected layer-2 answer. **No valid Task 12 run exercised layer-2
diagnosis**; v2 exists so the comparison re-run does, on both harnesses.

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

---

## 3. Run report — full text, verbatim

Retrieved from `sn_aia_message.message` (identical to `.user_message`), sys_id
`b7829d0c2b2e4314f243fed2ce91bf16`, on execution plan `13f1d5842b2e4314f243fed2ce91bf3c`
(conversation `cff195842b2e4314f243fed2ce91bfd1`).

> ## Fix Report — Seed 02 Request Router
> **Execution:** `11bd8d882baa4314f243fed2ce91bfb3`
>
> ---
>
> ## FAILURE SUMMARY
>
> The user submitted "My laptop will not boot. Please route this request." to the Seed 02 Request Router agent. The agent reached the ReAct (Gen AI) execution step but immediately cancelled and replied: **"I am unable to complete the task since I have no instructions or actions."** No tool was ever called, no group was ever assigned, and the execution completed in 1.68 seconds with zero tool calls recorded. The agent has valid instruction text (183 characters) but **zero tools bound to it**. The ReAct engine requires at least one action (tool) to begin its reasoning loop; with none available, it aborts before making a single LLM call.
>
> ---
>
> ## LAYERS SWEPT
>
> | Layer | Status | Notes |
> |---|---|---|
> | 1 – Execution trace | **SWEPT** | `agent_trace` on execution `11bd8d882baa4314f243fed2ce91bfb3` |
> | 2 – Instructions | **SWEPT** | `agent_config` — instructions present, 183 chars |
> | 3 – Tool definitions | **SWEPT** | `agent_config` — zero tool bindings confirmed |
> | 4 – Data schemas | **NOT SWEPT** | Agent never reached a tool call; no schema to validate |
> | 5 – Data | **NOT SWEPT** | No tool was invoked; no record existence to check |
> | 6 – GenAI stack | **NOT SWEPT** | Gen AI task was cancelled before any LLM call was made; `genai_log` would add nothing beyond what the task tree already shows |
> | 7 – Trigger / wiring | **SWEPT (partial)** | `agent_config` triggers section — no trigger wiring found, but the run was invoked conversationally so this is expected and is NOT a finding |
>
> **Platform log layer:** NOT SWEPT. `log_analysis` is blocked on most instances (cross-scope syslog restriction). An instance administrator would need to grant cross-scope syslog read access to sweep this layer. It is not expected to change the diagnosis here.
>
> ---
>
> ## ROOT CAUSES
>
> ### RC-1 — No tools bound to the agent
>
> | Attribute | Value |
> |---|---|
> | **Layer** | 3 – Tool definitions |
> | **Component** | `sn_aia_agent_tool_m2m` (tool-to-agent binding table) |
> | **Finding** | Zero tool bindings exist for this agent. The ReAct engine cannot enter its reasoning loop without at least one action to consider. |
> | **Evidence** | `agent_config` (agent `cd050d48e810411d9f113fd530694fe6`): `tool_count=0`, `active_tool_count=0`, `tool_binding_rows=0`, `sn_aia_agent_tool_m2m` read status `empty` (genuine absence — read status was `ok`, not `DENIED`). Agent task output (task `e5bdcd882baa4314f243fed2ce91bf22`, message `f5bdcd882baa4314f243fed2ce91bf5f`): *"I am unable to complete the task since I have no instructions or actions."* |
> | **Confidence** | **CONFIRMED** — two independent sources (config binding count + runtime agent message) agree. |
>
> ### RC-2 (contributing) — Agent description flags intentional breakage
>
> | Attribute | Value |
> |---|---|
> | **Layer** | 2 – Instructions |
> | **Component** | `sn_aia_agent.description`, agent `cd050d48e810411d9f113fd530694fe6` |
> | **Finding** | Description reads: *"Routes an incoming request to the correct assignment group. Benchmark seed - deliberately broken."* This confirms RC-1 is intentional in the seed and not an accidental omission. |
> | **Evidence** | `agent_config` artifact, `overview.description` |
> | **Confidence** | **CONFIRMED** |
>
> ---
>
> ## FIXES
>
> ### Fix 1 — Bind a routing tool to the agent
>
> | Attribute | Value |
> |---|---|
> | **Target type** | Tool binding (wiring) |
> | **Target** | Create a record in `sn_aia_agent_tool_m2m` linking agent `cd050d48e810411d9f113fd530694fe6` to a tool that can look up the matching assignment group and write it to the target record |
> | **Current** | No rows in `sn_aia_agent_tool_m2m` for this agent |
> | **Proposed** | Bind at minimum one active tool whose script reads the incoming request text, looks up the matching assignment group (e.g. by querying `sys_user_group`), and writes the `assignment_group` field back to the target record. A confirm/finish tool should also be bound so the agent can report the outcome to the user. |
> | **Rationale** | The ReAct engine requires at least one action. Without a tool it cannot enter the reasoning loop and cancels immediately — exactly what the trace shows. |
>
> ### Fix 2 — Remove the "deliberately broken" description
>
> | Attribute | Value |
> |---|---|
> | **Target type** | Configuration |
> | **Target** | `sn_aia_agent.description`, record `cd050d48e810411d9f113fd530694fe6` |
> | **Current** | `"Routes an incoming request to the correct assignment group. Benchmark seed - deliberately broken."` |
> | **Proposed** | `"Routes an incoming request to the correct assignment group."` |
> | **Rationale** | Cosmetic — prevents future confusion about whether the breakage is intentional. |
>
> ---
>
> ## VERIFICATION
>
> 1. After binding the routing tool, open **AI Agent Studio → Seed 02 Request Router → Tools** and confirm at least one active tool appears.
> 2. Start a new conversational execution with the same objective: *"My laptop will not boot. Please route this request."*
> 3. In the new execution trace, confirm:
>    - Agent task status = `Success` (not `Cancelled`)
>    - At least one row in `sn_aia_tools_execution` for the new plan
>    - The agent's final message names an assignment group (e.g. "Service Desk" or "Hardware Support")
> 4. Optionally query the target incident/task record to confirm `assignment_group` is populated.
>
> ---
>
> ## DATA MARKERS
>
> The following values were quoted as evidence and should be redacted before this report leaves the instance:
>
> - User email: sourced from the User Profile message in the execution trace
> - User sys_id: sourced from the same User Profile message
> - Conversation sys_id: `09bd0d882baa4314f243fed2ce91bf0a`
> References: null

---

## 4. Measurements recorded in the 2026-08-02 scorecard

These four values were not recomputed today — they are copied as-is from
`benchmark/scorecard-agent-doctor.md`'s row for this run.

| Field | Value recorded in the 2026-08-02 scorecard |
|---|---|
| `layers_swept` | 4/7 (L1,L2,L3,L7) |
| `layers_available` | 7/7 (measured) |
| `tool_calls` | 7 |
| `wall_clock` | 151s |
