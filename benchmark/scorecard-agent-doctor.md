# Scorecard — Agent Doctor (Task 12, filled 2026-08-02)

One row per scored run, **10 rows** — 2 runs per seed × 5 seeds (`benchmark/seeds/seed-01` through
`seed-05`). The smoke-test run (see `benchmark/README.md`) is not one of the 10; it is a pass/fail
gate run before scoring starts, not a scored row.

**This is the filled Task 12 scorecard** (copied from `scorecard-template.md`; the template's
column definitions and rules are preserved below as the scoring contract this file was filled
against — with two post-fill wording updates applied identically in both files per PR #43 review:
the §A3 seed-4 void condition now describes the hardcoded-sys_id state, and §E3's expected
`layers_available` now reads `7/7`, superseding the pre-Tasks-7/8 `1/7` expectation). Runs
executed 2026-08-02 01:31–02:16 UTC on gpinst01, Agent Doctor sys_id
`e1392946828940e5a708fc51b0a5e954`, all 7 tools attached and active. The verdict and its caveats
live in `DECISION.md`.

**Smoke-test gate (pre-scoring): PASS.** Execution `4e2cc5c82b2a4bd417a6ffbeee91bf87`
(conversation `742c45c82b2a4bd417a6ffbeee91bf45`, 190s, 9 tool calls) diagnosed the specimen
`c9d63a932bda8b9417a6ffbeee91bfd0` correctly: RC-3 named `context_processing_script` line 42
`InternalError`, CONFIRMED, with the `sn_aia_message` script_errors evidence — found despite the
plan header reading `state=Completed`, empty `state_reason`, all tasks Success. The report also
identified the specimen's prompt-injection objective and empty tool input schema (both genuinely
present), and explicitly listed unswept layers.

## A. The 6-point rubric

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

## A2. `passes_gate` — the column the gate actually consumes

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

## A3. Void runs — a run that measured nothing

> **The standing rule has moved since this file was filled (#174), and this section is deliberately
> NOT updated to match.** `scorecard-template.md` §A3 now carries a third, **run-state** void
> condition — the platform terminating an execution with no report body produced — plus a per-arm
> reading of the §A3.4 floor and a declared re-run cap. None of that governed these 10 rows, which
> were scored with zero voids against the text below. The two post-fill wording updates this file's
> header records were corrections to a *shared* rule; a new condition is not, and mirroring it here
> would silently restate what contract these rows were scored under. Provenance: `DECISION.md` §AK.

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
  void. *(This run: verified matching on gpinst01 — not void.)*

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

## B. Four further columns — required, not optional

Each of these exists because a specific measured failure would otherwise be invisible. Keep the
"why" sentence attached to the column in any copy of this template — a scorer who does not see the
reason will skip the column.

| Column | Why it is here |
|---|---|
| `layers_swept` — n/7 and which | R-3 amendment. The same probe ran **19** tool calls on keynexus01 and **5** on gpinst01, both finishing `state=Completed` with empty `state_reason` and neither capped. Without this column a lucky shallow run scores identically to a thorough one. **Derived by the two-step query in §E1 and mapped through §E2 — tools are not layers.** |
| `layers_available` — n/7 and which | §3.1 of the design. Separates *did not look* from *could not look — no tool exists*. `swept 1/7, available 1/7` is an agent doing everything it can; `swept 1/7, available 7/7` is one that stopped early. Identical scores, opposite verdicts. **Read per run via the §E3 query; never assumed or copied from a prior row.** |
| `cause_of_death` — `completed \| tool_limit \| context \| supervision_stall \| security \| wandered \| genai_down` | DESIGN.md §2.3. A 0-point budget death and a 0-point reasoning death are opposite verdicts on the gate. |
| `continuous_tool_execution_limit` and `max_auto_executions` per attached tool | R-4 / #30. **Read at run time, not assumed.** E2's 19-call result was reachable only because that probe's `max_auto_executions` was 20 against an instance-typical 10 — 477 of 483 production rows sit at the dictionary default. |

## C. Operational columns

| Column | What it captures |
|---|---|
| `tool_calls` | Total tool calls made this run |
| `assists_consumed` | Now Assist assist-unit consumption for the run |
| `wall_clock` | Elapsed time, conversation start to last tool call |
| `failure_behavior` | `graceful_partial` (states what it could not confirm) vs. `wandering_stuck` (keeps acting without progress) — free text if neither fits |
| `notes` | Free text — anything the fixed columns above don't capture |

## D. How to read the budget knobs

The template ships these two values **blank**. A pre-filled value is an assumption wearing a
measurement's clothes — read them fresh for every scored run, because both are per-run/per-binding
state, not fixed constants.

1. **`continuous_tool_execution_limit`** — `servicenow_query` on `sys_properties`,
   `name=sn_aia.continuous_tool_execution_limit`, field `value`.
2. **`max_auto_executions`** (one row per attached tool) — `servicenow_query` on
   `sn_aia_agent_tool_m2m`, filtered to the agent under test, field `max_auto_executions`.

If either value differs from the instance-typical value or from the shipped/dictionary default,
`benchmark/DECISION.md` must say so explicitly and say what the difference is. Because the shipped
OOB default of `continuous_tool_execution_limit` is itself unknown (R-4), `benchmark/DECISION.md`
must also state that it is unknown and that transferability to a default-configured customer
instance is therefore **unverified** until that default is established.

## E. `layers_swept` is derived, not eyeballed

Per R-20, `layers_swept` is not a scorer's impression of the transcript — it is derived from the
audit trail. Run this for every scored row before filling in the column; do not infer sweep
coverage from the agent's prose.

### E1. The query is TWO steps, not one

`run_id` is the conversation id, but `x_snc_troubleshoot_audit.run` is a **ReferenceColumn to
`x_snc_troubleshoot_run`** — it holds a *run-record sys_id*, not a conversation id. The
conversation id lives one hop away, in `x_snc_troubleshoot_run.conversation_ref`
(see `src/fluent/tables.now.ts`). Querying `audit.run = <conversation_id>` matches **nothing**, and
a scorer following it would record `layers_swept 0/7` for all ten runs — a silent blank read as
absence, in the instrument built to prevent exactly that.

**Step 1 — conversation id → run record:**

```
servicenow_query  table = x_snc_troubleshoot_run
                  query = conversation_ref=<conversation_id>
                  fields = sys_id, number, harness, status
```

Expect exactly one row. **Zero rows means the run was never anchored** — that is a finding about
the harness, not a scoring inconvenience: record it in `notes` rather than moving on.

**Step 2 — run record → swept tools:**

```
servicenow_query  table = x_snc_troubleshoot_audit
                  query = run=<sys_id from step 1>^action_type=result
                  fields = tool_name, input, output
```

Take the **distinct** `tool_name` values. `action_type='result'` is deliberate: an `intent` row
records what the agent *meant* to call, and a tool that was attempted but never returned has not
swept anything.

**Take `input` and `output` too, and read them** (#96). The trail records what each call asked for
and what it returned, not merely that it happened — that is what §E2's `agent_config` rule is
derived from, and reading only `tool_name` throws it away. In code the same rows come back from
`PaAuditLogger.toolCalls(runId)`, in creation order, `input` on intent rows and `output` on result
and error rows. (`invokedTools(runId)` answers the narrower "was this tool ever called", and
dedupes; it is the wrong reader for this column.)

**One caveat that must travel with any payload read.** `PaAuditLogger` digests payloads head+tail
past 4,000 chars, so a string in the elided middle is absent from the audit row while being present
in what the model received. **A hit is evidence; a miss is not.** Both values §E2 relies on are in
the preserved part — `sections_returned` sits in the head — but a scorer searching for anything
else must say which of the two they found.

### E2. Distinct tool names are NOT the layer count

The roster is seven **tools**, not seven layers, and the mapping is not 1:1 — so counting distinct
tool names gives the wrong number. `read_artifact` is not a layer at all, and `agent_config` alone
covers three. A run that called `agent_trace` and `read_artifact` has swept **1** layer; a naive
count says 2.

Canonical map (from `docs/agent/agent-doctor-instructions.md` and LLD §4–§5):

| Tool | Script Include | Layer(s) swept |
|---|---|---|
| `agent_trace` | `PaToolAgentTrace` | **1** — execution trace |
| `agent_config` | `PaToolAgentConfig` | **2, 3, 7** — instructions, tool definitions, trigger/wiring |
| `schema_lookup` | `PaToolSchemaLookup` | **4** — data schemas |
| `query_table` | `PaToolQueryTable` | **5** — data |
| `genai_log` | `PaToolGenAiLog` | **6** — GenAI stack |
| `log_analysis` | `PaToolLogAnalysis` | **none of its own** — cross-cutting syslog evidence supporting layers 1 and 6. Do not count it as a layer |
| `read_artifact` | `PaArtifactStore` | **not a layer** — pages large evidence |

Fill the column as `n/7` **plus the layer numbers**, e.g. `1/7 (L1)` or `4/7 (L1,L2,L3,L7)` — the
"and which" half of the column is what makes a shallow run distinguishable from a lucky one.

**`agent_config` counts for all three of its layers only if the diagnosis actually used them.** If
the run called `agent_config` and discussed only the instruction text, record `L2` and say so in
`notes`; do not credit L3 and L7 for a call that never looked at them.

**Derive the credit from the call, not from the claim** (#96). Until this rule landed, "the
diagnosis actually used it" was read off the Fix Report's own prose — the party with an interest —
and it was wrong once in twelve rows (seed 03 run 2, corrected below). The trail settles half of it
outright, and only half:

| | |
|---|---|
| **Necessary — measured** | `agent_config` cannot credit a layer whose section the call did not return. Read `sections_returned` out of the call's `output` (step 2 above) and map it: `instructions` → **L2**, `tools` → **L3**, `triggers` → **L7**. `overview` maps to no layer. A section that never rendered is a layer that was not swept, whatever the report says. |
| **Sufficient — still judged** | Receiving a section is not using it. The scorer still decides whether the diagnosis used what it got, and still says so in `notes`. |

So the trail can **refute** a layer credit and cannot **confer** one. Two shapes to know, both live
in the corpus:

- **A call with no `section` returns all four** (`_resolveSections`), so `{"agent":"…"}` and a bare
  agent name are unqualified calls — L2/L3/L7 are all *eligible*, none automatic.
- **An unqualified call can still return nothing.** If the identifier matches no `sn_aia_agent` or
  `sn_aia_usecase` row the tool returns `sections_returned: []` with a resolution note, and no
  layer was swept. This is not hypothetical: it is what the smoke gate's only `agent_config` call
  did (`DECISION.md` §N4). **Read `sections_returned`; do not infer it from the argument.**

### E3. `layers_available` has its own query — it is READ, not assumed

The column exists to separate *did not look* from *could not look — no tool exists* (§3.1 of the
design), which only works if it is read per run rather than copied from a prior row. Tool
attachments change between builds, and that is the entire signal.

```
servicenow_query  table = sn_aia_agent_tool_m2m
                  query = agent=<Agent Doctor sys_id>^active=true
                  fields = tool, tool.name, max_auto_executions
```

Map the returned tool names through the table in E2 to get the available layer set. This is the
same query section D.2 already requires for `max_auto_executions`, so run it once and fill both
columns from it.

Against the current build this is expected to return `7/7` — Tasks 7–8 landed before Task 12
ran, all seven tools are attached and active, and every Task 12 scored row measured `7/7`
(the earlier `1/7 (L1)` expectation described the pre-Tasks-7/8 build and is superseded; issue
#32 closed). **Record the measured value anyway — never copy this expectation into a row.** A
scorecard whose `layers_available` was assumed rather than read cannot support the `swept 1/7,
available 1/7` versus `swept 1/7, available 7/7` distinction that is the column's whole purpose,
and tool attachments can change between builds — that changing is the entire signal.

---

## The scorecard

Blank template — one filled row per run. `run_id` is the run-identity key from
`benchmark/README.md` (`_agentic_context_.conversation_id`), not a time window.

`passes_gate` is `1`, `0` or `void` — computed by the rule in §A2, **not** from `total /6`. It is
the only column the Task 12 gate consumes.

> **These rows were scored before the #89 blind-rule fix (`2026.08.0227`).** Two tool cores that the
> native harness executes through `PaScriptToolAdapter` changed after every row below was filed:
> `src/server/tools/PaToolAgentConfig.js` (a note on the `instructions` section naming the smoke
> gate's specimen, and a `detail` restating `benchmark/README.md`'s reason for choosing it) and
> `src/server/tools/PaToolGenAiLog.js` (a `capability_unresolvable` `next_step` carrying seed 04's
> construction taxonomy).
>
> **Which rows received the `PaToolAgentConfig` note is measured, not inferred** (#96, superseding
> this note's first version): the audit trail records both the `section` each run asked for and the
> `sections_returned` the tool rendered. **Five of the ten rows below received it** — seed 02 runs 1
> and 2, seed 04 run 2, and seed 05 runs 1 and 2, each of which called `agent_config` without a
> `section` and got all four. **The other five did not:** seed 01 runs 1–2, seed 03 runs 1–2 and
> seed 04 run 1 each passed `section:"tools"` and received `["tools"]` alone. (Both native rows on
> `scorecard-custom-harness.md` also received it, for 7 of the 12 native rows on record.)
>
> **The `PaToolGenAiLog` `capability_unresolvable` text reached no row at all.** It fires only in
> `check_config` mode; the corpus holds exactly two such calls — seed 04 runs 1 and 2 — and both
> recorded `"findings":0`.
>
> **No row is restated and no score movement is claimed.** The removed text named the smoke gate's
> specimen and the reason it was chosen; the smoke gate is a pass/fail gate rather than one of the
> ten scored rows, and no scored seed's expected layer, component or fix appeared in it — and the
> gate itself never received the note either (its `agent_config` call matched no agent record). The
> reason to record this is reproducibility: these rows were measured against a version of a shared
> core that no longer exists. Full per-row measurement is in `DECISION.md` §N3–§N5; §M3/§M4 carry
> the superseded inference-based grade and what #89 concluded on the day.

| seed | run # | run_id (conversation_id) | root_cause_layer_correct | fix_target_correct | evidence_cites_trace_and_config | fix_usable_unedited | total /6 | **passes_gate** | layers_swept (n/7, which) | layers_available (n/7, which) | cause_of_death | continuous_tool_execution_limit | max_auto_executions (per tool) | tool_calls | assists_consumed | wall_clock | failure_behavior | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | 1 | `715e41c42b6a4bd417a6ffbeee91bf29` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L3,L4,L5) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 8 | not measurable (see §F) | 145s | n/a — success; unswept layers stated | Word→Integer mismatch found from both sides (M18 full credit). One `query_table` probe hit `incident` (wrong table), self-corrected. ~6 LLM calls. |
| 01 | 2 | `2fdf8d0c2baa4314f243fed2ce91bfa3` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L3,L4,L5) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 11 | not measurable | 224s | n/a — success | Full structured Fix Report incl. complete word→int map code + post-write guard + negative test; DATA MARKERS section. `log_analysis` called; syslog unavailability reported honestly. ~8 LLM calls. |
| 02 | 1 | `86015dc42baa4bd417a6ffbeee91bf51` | 0 | 1 | 1 | 0 | 2 | **0** | 4/7 (L1,L2,L3,L7) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 5 | not measurable | 102s | graceful_partial | Named L3 "zero tools bound" (runtime-accurate) vs expected L2 instruction. `fix_target` 1 (partial): "supply a lookup tool" is half of the seed's own sanctioned fix; instruction half absent. Fix is an outline, not appliable → 0. See seed-2 construction finding in DECISION.md §D2. |
| 02 | 2 | `cff195842b2e4314f243fed2ce91bfd1` | 0 | 1 | 1 | 0 | 2 | **0** | 4/7 (L1,L2,L3,L7) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 7 | not measurable | 151s | graceful_partial | Identical diagnosis to run 1 — consistent across the doubled runs. Same scoring rationale. |
| 03 | 1 | `f3a2950c2baa4bd417a6ffbeee91bfb4` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L3,L5,L6) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 9 | not measurable | 172s | n/a — success | `genuinely_empty` verdict CONFIRMED by two independent reads. Report claims 6/7 swept; E2 strict derivation credits 4/7 (L2 "instructions section not pulled" by its own admission; L4 claimed implicit via query_table, schema_lookup not called). K26 tool smells as secondary findings. |
| 03 | 2 | `e1c319c02b6e4314f243fed2ce91bf68` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L3,L5,L6) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 8 | not measurable | 150s | n/a — success | Consistent with run 1. genai_log identified 2 successful LLM calls (model `claude-sonnet-4-6`). L4 again claimed implicit — not credited. **`layers_swept` corrected 5/7 → 4/7 (#96):** L2 was credited on the run's prose, but its only `agent_config` call passed `section:"tools"` and returned `["tools"]` (audit row on TR1000043) — the instructions section never rendered, so L2 was not swept. Run 1 said the same about itself and was correctly denied L2. Rubric columns, `total /6` and `passes_gate` unchanged. |
| 04 | 1 | `228411882b6e4314f243fed2ce91bf24` | 2 | 2 | 1 | 1 | 6 | **1** | 5/7 (L1,L3,L4,L5,L6) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 14 | not measurable | 211s | n/a — success | Found the dangling `api` on definition `904c0485…` and proposed repointing to `936e514a53b3b110f028ddeeff7b128c` — the exact healthy value, discovered independently from working definitions. Decoy partially bit (empty `connection` named co-cause, co-fix) but did NOT displace the api fix → not the "connection and nothing else" case. |
| 04 | 2 | `ecc5dd482bea4bd417a6ffbeee91bf2d` | 2 | 0 | 1 | 0 | 3 | **0** | 6/7 (L1,L2,L3,L5,L6,L7) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 10 | not measurable | 206s | n/a — completed with wrong fix | **Canonical decoy row (2/0/1/0).** Named empty `connection` as PRIMARY cause reading the capability parent record; never read the definition row's `api`. Also hallucinated table name `sn_tsbench_ticket` → false "table does not exist" RC-2. Doubled runs SPLIT (run 1 hit / run 2 decoy) — the measured inconsistent-behavior specimen. |
| 05 | 1 | `1b37994c2b2e4bd417a6ffbeee91bf5a` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L2,L3,L7) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 5 | not measurable | 92s | n/a — success | Named the SPECIFIC gate — `sn_aia_trigger_configuration.active=0` on `bfb77d6c…` — with m2m link verified intact (`m2m_active=1`) → full 2/2 under the two-gates rule, not partial. Bonus: flagged missing run-as identity as UNCONFIRMED advisory (the seed spec's own open SDK 4.9.0 concern). |
| 05 | 2 | `d818dd4c2bae4314f243fed2ce91bf7c` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L2,L3,L7) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 5 | not measurable | 95s | n/a — success | Consistent with run 1: same gate, same fix, same run-as advisory. Anchor race observed: 2 run rows created for this conversation (TR1000047/48); all audit rows adopted the deterministic winner — R-3 handling worked; loser row left as designed. |

**Gate tally**

| | |
|---|---|
| Valid runs (not void) | **10** / 10 |
| `sum(passes_gate)` | **7** |
| Gate result | **7 / 10 (70.0%)** — middle band (≥ 50% and < 80%) of the `IMPLEMENTATION_PLAN.md` Task 12 gate table |
| Void runs and why | **None.** Both seed-4 setup conditions held (placeholder substituted and verified in the installed script; primary construction installed, no fallback needed) and seed 5's m2m gate was PATCHed on and re-read `true` before its runs. |

## F. Measurement caveats for this filled scorecard

- **`assists_consumed` is recorded "not measurable"** — `sn_value_ai_consumption` (the only
  assist-ledger table found) had zero rows in the benchmark window, and no other live per-run
  assist-unit source was identified. LLM call counts per run (from the execution task tree) are
  recorded in `notes` as the nearest proxy. This is an honest absence, not a skipped column.
- **`layers_swept` derivation:** every row was derived by the §E1 two-step audit query (conversation
  → `x_snc_troubleshoot_run.conversation_ref` → `x_snc_troubleshoot_audit` `action_type=result`
  distinct tools), then mapped through §E2 with the used-layers discipline for `agent_config`.
  Where a run's own sweep table claimed more than the derivation supports, the derivation won and
  the claim is noted (seed 3 rows). **Re-derived against the recorded call arguments 2026-08-03
  (#96)**, once §E2 gained the measured-necessary-condition rule: eleven of the twelve native rows
  on record reconciled, and seed 03 run 2's L2 credit did not — corrected in the row above. No
  rubric column and no `passes_gate` value moved; `DECISION.md` §N6 has the accounting.
- **`layers_available`** was read fresh per run via the §E3 m2m query; all runs returned the same
  7 active bindings → 7/7. This differs from the template's forward-looking expectation of 1/7,
  which described the pre-Tasks-7/8 build; #32's blocker was cleared before this benchmark ran.
- **Run anchor status:** every scored conversation's `x_snc_troubleshoot_run` row remains
  `status=running` after the conversation ends — the native adapter opens the anchor but nothing
  closes it. Recorded as a harness observation for Phase 1b; does not affect scoring.

If valid runs < 8, record **gate not met — insufficient data** and stop; do not compute a verdict
from the survivors (§A3). *(Not triggered: 10 valid runs.)*

---

## v4 scored pass (Task 13, filled 2026-08-03) — native harness, 10 rows

**Scope of this section: native (Agent Doctor) only.** The companion file
`benchmark/scorecard-custom-harness.md` carries this same pass's 10 custom
rows in its own v4 section — **the two v4 scorecards are sourced from
different scoring rounds, on purpose; see the sourcing note immediately
below.** Instance: gpinst01, app version `2026.08.0301` (confirmed
byte-identical to `main`@`8c909cd` for every Script Include and the shared
agent instructions — `benchmark/raw-evidence-v4.md`, "Deploy verification").
Full run identities, wall clocks, terminal states, and complete Fix Report
text for all 20 v4 rows: `benchmark/raw-evidence-v4.md`, five per-seed
sections (Tasks 5–9). Audit-trail-derived `layers_swept` / `layers_available`
/ tool-call counts / LLM-call counts for all 20 rows: same file, "Task 10 —
audit-trail-derived measurements, all 20 rows".

**Sourcing note — read before trusting any score below.** Three scoring
rounds exist for this pass:

| Round | Directory | Packets | Scorers |
|---|---|---|---|
| A | `benchmark/scoring-v4/results/` | leak present (issue #100) | 10 independent, one per row |
| B | `benchmark/scoring-v4/results-redacted/` | redacted | ONE agent scoring 10 sequentially |
| C | `benchmark/scoring-v4/results-independent/` | redacted | 10 independent, one per row |

**The 10 native rows below are scored from Round C**
(`results-independent/`) — the only round with both a redacted packet and
one-independent-scorer-per-row dispatch, and therefore the only round
comparable to the Task 12 blind re-scores in the section below it. Round A
has the leak (used only for custom, where the leak could only have inflated
scores and every custom row still scored 0/6 — see the companion file).
Round B is not used for any scorecard row; it exists as evidence of a
scorer-topology effect (`DECISION.md`).

**Void check (all 10 rows): not void.** `benchmark/raw-evidence-v4.md`'s
"Seed fixture preconditions" section re-verified all five seeds' §A3
conditions live before any run fired, for both harnesses: "**All five
seeds: not void.**"

### v4 rows — native (Round C)

| seed | run # | run_id (conversation_id) | root_cause_layer_correct | fix_target_correct | evidence_cites_trace_and_config | fix_usable_unedited | total /6 | **passes_gate** | layers_swept (n/7, which) | layers_available (n/7) | cause_of_death | continuous_tool_execution_limit | max_auto_executions (per tool) | tool_calls | assists_consumed | wall_clock | failure_behavior | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | 1 | `e7c7eae82b2acb14f243fed2ce91bf79` | 2 | 2 | 1 | 0 | 5 | **0** | 4/7 (L1,L3,L4,L5) | 7/7 | completed | 25 | 10 × all 7 tools | 10 | not measurable | 274s | graceful_partial — correct diagnosis, fix code omitted | RC-1 names the word→Integer mismatch (CONFIRMED, cites trace + `schema_lookup`). FIX-1's "Proposed" text defers the actual mapping code to "the run's stored message" — not present in the committed Fix Report a builder AI would receive — so `fix_usable_unedited`=0 despite a correctly-targeted fix. FIX-2 (mark inputs mandatory) is fully specified but doesn't address the seed's defect. Report's own LAYERS SWEPT table over-claims L2 (instructions); audit trail shows the `agent_config` call requested/returned `["tools"]` only — flagged, not score-affecting (RC-1's evidence never depends on L2). ~10 LLM calls. |
| 01 | 2 | `1098e2602ba6cf14f243fed2ce91bfe1` | 2 | 2 | 1 | 0 | 5 | **0** | 4/7 (L1,L3,L4,L5) | 7/7 | completed | 25 | 10 × all 7 tools | 10 | not measurable | 179s | graceful_partial — fix hedges between right and wrong target | Same correct diagnosis as run 1. The report's own VERIFICATION section instructs "Apply Fix A or Fix B (not both)" with Fix A — change the dictionary column type — labeled "(preferred)"; Fix A is *not* the seed's accepted target (seed treats the Integer column as fixed). Fix B (word→integer map in the script) is the correct target and is present, but demoted to "alternative". A builder AI following the report's own stated preference lands on the wrong fix first → `fix_usable_unedited`=0. Same L2 over-claim as run 1 (audit: `["tools"]` only). ~7 LLM calls. |
| 02 | 1 | `748b62e42be2871817a6ffbeee91bfcd` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed | 25 | 10 × all 7 tools | 5 | not measurable | 75s | confidently_wrong — mistook a fabricated group for evidence of health | Report concludes "No failure was observed" / "None identified" and explicitly marks L2 (instructions — the seed's expected layer) **NOT SWEPT**. The agent under diagnosis invented a plausible-sounding group ("IT Support — Hardware & Endpoint") with no grounding tool or vocabulary — the seed's own designed symptom — and this run treated the plausible-looking completion as proof of health rather than examining the instruction text that produced it. ~4 LLM calls. |
| 02 | 2 | `a10caae42be6cf14f243fed2ce91bf89` | 0 | 0 | 0 | 0 | 0 | **0** | 1/7 (L1) | 7/7 | completed | 25 | 10 × all 7 tools | 5 | not measurable | 96s | confidently_wrong — same pattern as run 1 | Independently reaches the identical conclusion as run 1 ("The execution did not fail" / "No root cause exists"), same L2-NOT-SWEPT self-report, same failure to examine the instruction text behind the invented group assignment. Doubled-run consistency observed on the miss, not just the hit. ~5 LLM calls. |
| 03 | 1 | `fced2ee82be6cf14f243fed2ce91bfc1` | 2 | 2 | 0 | 1 | 5 | **1** | 5/7 (L1,L3,L4,L5,L6) | 7/7 | completed | 25 | 10 × all 7 tools | 9 | not measurable | 151s | n/a — success (gate pass) | RC-1 correctly names the genuinely-empty routing table (data layer, CONFIRMED via `query_table` unfiltered count 0). Fix 1 seeds the table with a concrete example row and a repeatable pattern — scored usable. `evidence_cites_trace_and_config`=0: RC-1's own Evidence line cites only `query_table` + the tool-call trace, never the `schema_lookup` output the report's own table credits as SWEPT — received but not used in the cited evidence for this root cause. ~7 LLM calls. |
| 03 | 2 | `2c0eaea42be6871817a6ffbeee91bff3` | 2 | 2 | 1 | 0 | 5 | **0** | 4/7 (L1,L3,L4,L5) | 7/7 | completed | 25 | 10 × all 7 tools | 9 | not measurable | 153s | graceful_partial — correct target, fix leaves an unfilled placeholder | Same correct diagnosis as run 1, and this time RC-1's evidence explicitly cites the schema (`x_snc_tsbench_routing` confirmed correct columns) alongside the trace, satisfying the evidence column. Fix 1 correctly targets data seeding but `assignment_group = <target group name>` is an unfilled placeholder and "every other category in scope" is never enumerated — a builder AI cannot produce the actual INSERT statements from this text alone. ~7 LLM calls. |
| 04 | 1 | `ed80b6682b2acf14f243fed2ce91bff0` | 2 | 2 | 1 | 0 | 5 | **0** | 5/7 (L1,L2,L3,L6,L7) | 7/7 | completed | 25 | 10 × all 7 tools | 9 | not measurable | 144s | graceful_partial — correct target, fix value is descriptive not concrete | RC-1 correctly finds the dangling `api` nil sys_id on the capability definition (CONFIRMED, `genai_log check_config` + live tool response) and does **not** fall for the `connection` decoy (never mentioned as a cause). FIX-1's "Proposed" value is a description ("the sys_id of the intended...flow, e.g. the standard Now LLM or Amazon Bedrock spoke flow") rather than a concrete value — no `query_table` call was made to find a working reference to quote — so `fix_usable_unedited`=0 despite the correct target. ~7 LLM calls. |
| 04 | 2 | `d1617ae82b6acf14f243fed2ce91bf76` | 2 | 2 | 1 | 0 | 5 | **0** | 2/7 (L1,L6) | 7/7 | completed | 25 | 10 × all 7 tools | 5 | not measurable | 108s | graceful_partial — same fix-completeness gap as run 1 | Same correct diagnosis and target as run 1, same decoy-avoidance, same fix-completeness gap: "the sys_id of the intended Now LLM Service flow record" is a description of what belongs in the field, not a value to write. ~5 LLM calls. |
| 05 | 1 | `46a3b22c2be6871817a6ffbeee91bf9a` | 2 | 2 | 1 | 1 | 6 | **1** | 6/7 (L1,L2,L3,L5,L6,L7) | 7/7 | completed | 25 | 10 × all 7 tools | 9 | not measurable | 168s | n/a — success (gate pass) | Full credit: names the specific gate (`sn_aia_trigger_configuration.active`, sys_id `bfb77d6c…`), not just generic "inactive" — clears the seed-05 partial-credit bar for full marks. Fix 1 is a directly PATCH-able current→proposed value change. Report's own LAYERS SWEPT table claims 7/7 including L4; the audit trail credits 6/7 (L4 not credited) — flagged, not score-affecting (root cause and its evidence both rest on L7, which the trail does credit). ~5 LLM calls. |
| 05 | 2 | `79743aec2b6acf14f243fed2ce91bfe3` | 2 | 2 | 1 | 1 | 6 | **1** | 6/7 (L1,L2,L3,L5,L6,L7) | 7/7 | completed | 25 | 10 × all 7 tools | 7 | not measurable | 111s | n/a — success (gate pass) | Consistent with run 1: same specific gate, same concrete fix. Report's own table marks L6 "NOT SWEPT (full)" (states a 100-row capability sample was reviewed) where the audit trail credits it SWEPT (one `genai_log` call was made) — a minor labeling difference, not score-affecting since the diagnosis and fix are both independently correct on L7. ~4 LLM calls. |

**Gate tally — native, v4**

| | |
|---|---|
| Valid runs (not void) | **10** / 10 |
| `sum(passes_gate)` | **3** |
| Gate result | **3 / 10 (30.0%)** — bottom band (< 50%) of the `IMPLEMENTATION_PLAN.md` Task 12 gate table |
| Rubric points | **42 / 60** |
| Void runs and why | **None** — all five seeds' §A3 fixture preconditions re-verified live before firing (`raw-evidence-v4.md`, "Seed fixture preconditions") |

### Totals, this pass (both harnesses)

**Native: 3 / 10. Custom: 0 / 10** (custom's 10 rows and their Round A
sourcing are in `benchmark/scorecard-custom-harness.md`). The two numbers are
not from the same scoring round — see the sourcing note above — but both are
independently scored, and native's own 3/10 stands regardless of what round
custom used, since custom's 0/6-on-every-row outcome could not have been
raised any further by round choice (every custom row failed
`root_cause_layer_correct` outright — the leak in Round A could only inflate
a score, never manufacture a false zero).

### Gate-arithmetic verification (Task 13)

Recomputed `passes_gate = 1 iff root_cause_layer_correct==2 AND
fix_usable_unedited==1` by hand against every recorded column value, for all
**20** v4 rows (10 native above + 10 custom in the companion file) and all
**8** blind re-scored standing rows below — **28 rows total, zero
mismatches.** Every row's recorded `passes_gate` matches what the formula
produces from its own four column values. The §A constraint
(`fix_usable_unedited` may not be `1` while `fix_target_correct` is `0`) also
holds in all 28 rows — no row has `fix_target_correct=0` paired with
`fix_usable_unedited=1`.

---

## Blind re-score — Task 12 standing rows (added 2026-08-03, Task 13)

Task 12's ten native rows above (dated 2026-08-02) are the **drift baseline
and are preserved verbatim** — nothing above this section was edited. Eight
of the ten were independently blind re-scored on 2026-08-02/03 by a fresh
scorer given only the §A rubric, one run id, the seed spec, and the
audit-derived tool roster — **never the operator's own score, this
scorecard, `DECISION.md`, `README.md` or `CHANGELOG.md`**. Full packets and
results: `benchmark/scoring-v4/rescore/` and
`benchmark/scoring-v4/rescore-results/`.

**Two of the ten standing rows were not re-scored** — seed 01 run 1 and
seed 05 run 2 — a **structural absence** (no `rescore-*` packet/result
exists for either identity), not a retrieval failure or an intentional
exclusion recorded elsewhere in this pass. They are marked `not re-scored`
below rather than left blank.

**This column never overwrites the operator's original score.** A
disagreement between the operator (Task 12) and the blind re-scorer on the
*same, unchanged* Fix Report is itself data about the rubric's
reproducibility, and both numbers are kept visible side by side.

| seed | run # | run_id | operator (RC / FT / EV / FU → total, gate) | blind re-score (RC / FT / EV / FU → total, gate) | `passes_gate` agreement | notes |
|---|---|---|---|---|---|---|
| 01 | 1 | `715e41c42b6a4bd417a6ffbeee91bf29` | 2/2/1/1 → 6, **1** | **not re-scored** | — | No `rescore-*` packet exists for this run_id — structural absence. |
| 01 | 2 | `2fdf8d0c2baa4314f243fed2ce91bfa3` | 2/2/1/1 → 6, **1** | 2/2/1/1 → 6, **1** | **agree** | Blind re-scorer notes no discrepancy between the report's own LAYERS SWEPT claims and the measured `layers_swept` for this row. |
| 02 | 1 | `86015dc42baa4bd417a6ffbeee91bf51` | 0/1/1/0 → 2, **0** | 0/0/1/0 → 1, **0** | **agree** | Total disagreement on `fix_target_correct`: operator awarded 1 (partial — "supply a lookup tool" as half the sanctioned fix); blind scorer awarded 0, reading Fix 1 as binding a tool that writes `assignment_group` directly (not a lookup/grounding tool) with no instruction-text change at all — "right area" was itself judged not met. `passes_gate` unaffected either way (`root_cause_layer_correct`=0 in both). |
| 02 | 2 | `cff195842b2e4314f243fed2ce91bfd1` | 0/1/1/0 → 2, **0** | 0/0/1/0 → 1, **0** | **agree** | Same `fix_target_correct` disagreement and same reasoning as run 1's re-score. |
| 03 | 1 | `f3a2950c2baa4bd417a6ffbeee91bfb4` | 2/2/1/1 → 6, **1** | 2/2/1/0 → 5, **0** | **DISAGREE** | The one gate-level disagreement in this set. Operator scored `fix_usable_unedited`=1; blind re-scorer scored 0, reading Fix 1's `assignment_group = <target group sys_id>` as an unfilled placeholder a builder AI cannot apply without first resolving a real value. Notably the *same style* of placeholder in seed 03 run 2's fix was scored `fix_usable_unedited`=1 by both the operator **and** its own blind re-score (next row) — that blind re-score's own notes flag it as "the closest call in the row" and reason that `assignment_group` is a plain `StringColumn`, not a reference field, so no real lookup is strictly required. The two blind re-scores of structurally similar fixes did not converge on the same rule for placeholder values — see notes below the table. |
| 03 | 2 | `e1c319c02b6e4314f243fed2ce91bf68` | 2/2/1/1 → 6, **1** | 2/2/1/1 → 6, **1** | **agree** | Blind re-scorer explicitly flags the same placeholder pattern as run 1's fix and scores it usable anyway (see cross-reference above) — full agreement with the operator here. |
| 04 | 1 | `228411882b6e4314f243fed2ce91bf24` | 2/2/1/1 → 6, **1** | 2/2/1/1 → 6, **1** | **agree** | Blind re-scorer separately flags decoy-narrative contamination (the report also describes empty `connection` as jointly causal) but does not zero the row for it, reasoning the rubric's decoy penalty is keyed to a fix that is "bind a connection alias — and nothing else," which this fix is not (it correctly repoints `api`). Same outcome as the operator. |
| 04 | 2 | `ecc5dd482bea4bd417a6ffbeee91bf2d` | 2/0/1/0 → 3, **0** | 2/0/1/0 → 3, **0** | **agree** | Canonical decoy row — both scorers reach the identical 2/0/1/0 pattern the rubric's own §A2 worked example describes. |
| 05 | 1 | `1b37994c2b2e4bd417a6ffbeee91bf5a` | 2/2/1/1 → 6, **1** | 2/2/1/1 → 6, **1** | **agree** | Full agreement, including the specific-gate full-credit reasoning. |
| 05 | 2 | `d818dd4c2bae4314f243fed2ce91bf7c` | 2/2/1/1 → 6, **1** | **not re-scored** | — | No `rescore-*` packet exists for this run_id — structural absence. |

**Agreement summary.** Of the **8** rows actually re-scored, **7 agree** and
**1 disagrees** on `passes_gate` (seed 03 run 1). Three of the eight also
show a *non-gate-level* total-score disagreement (seed 02 runs 1–2, on
`fix_target_correct`'s partial-credit band; seed 03 run 1, which is also the
gate-level disagreement) — meaning three of the eight re-scored rows
produced a different `total /6` than the operator even though only one
changed the verdict that reaches `DECISION.md`.

**What the disagreement is evidence of, not a ruling on which score is
"right."** All three total-score splits and the one gate-level split trace
to the same rubric surface: judgment calls the columns' own text does not
fully close — whether "the right area, wrong specifics" partial credit
extends to a fix that targets a *different mechanism* in the same layer
family (seed 02), and whether an unfilled placeholder in an otherwise
correctly-targeted fix defeats "applied as written, no manual editing first"
(seed 03) — and the two seed-03 rows show that even this same rescoring pass
did not apply one consistent rule to that second question across its own two
rows. This is left as a finding for whoever revises the rubric, not resolved
here by picking a side.
