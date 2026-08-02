# Scorecard — Agent Doctor (Task 12, filled 2026-08-02)

One row per scored run, **10 rows** — 2 runs per seed × 5 seeds (`benchmark/seeds/seed-01` through
`seed-05`). The smoke-test run (see `benchmark/README.md`) is not one of the 10; it is a pass/fail
gate run before scoring starts, not a scored row.

**This is the filled Task 12 scorecard** (copied from `scorecard-template.md`; the template's
column definitions and rules are preserved below as the scoring contract this file was filled
against — with one post-fill wording update applied identically in both files: the §A3 seed-4
void condition now describes the hardcoded-sys_id state, per PR #43 review). Runs executed 2026-08-02 01:31–02:16 UTC on gpinst01, Agent Doctor
sys_id `e1392946828940e5a708fc51b0a5e954`, all 7 tools attached and active. The verdict and its
caveats live in `DECISION.md`.

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
                  fields = tool_name
```

Take the **distinct** `tool_name` values. `action_type='result'` is deliberate: an `intent` row
records what the agent *meant* to call, and a tool that was attempted but never returned has not
swept anything.

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

Against the current build this is expected to return `1/7 (L1)` — Agent Doctor ships with
`agent_trace` and `read_artifact` only, and `docs/agent/agent-doctor-instructions.md` states it
without hedging. **Record the measured value anyway.** A scorecard whose `layers_available` was
assumed rather than read cannot support the `swept 1/7, available 1/7` versus `swept 1/7,
available 7/7` distinction that is the column's whole purpose.

---

## The scorecard

Blank template — one filled row per run. `run_id` is the run-identity key from
`benchmark/README.md` (`_agentic_context_.conversation_id`), not a time window.

`passes_gate` is `1`, `0` or `void` — computed by the rule in §A2, **not** from `total /6`. It is
the only column the Task 12 gate consumes.

| seed | run # | run_id (conversation_id) | root_cause_layer_correct | fix_target_correct | evidence_cites_trace_and_config | fix_usable_unedited | total /6 | **passes_gate** | layers_swept (n/7, which) | layers_available (n/7, which) | cause_of_death | continuous_tool_execution_limit | max_auto_executions (per tool) | tool_calls | assists_consumed | wall_clock | failure_behavior | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | 1 | `715e41c42b6a4bd417a6ffbeee91bf29` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L3,L4,L5) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 8 | not measurable (see §F) | 145s | n/a — success; unswept layers stated | Word→Integer mismatch found from both sides (M18 full credit). One `query_table` probe hit `incident` (wrong table), self-corrected. ~6 LLM calls. |
| 01 | 2 | `2fdf8d0c2baa4314f243fed2ce91bfa3` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L3,L4,L5) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 11 | not measurable | 224s | n/a — success | Full structured Fix Report incl. complete word→int map code + post-write guard + negative test; DATA MARKERS section. `log_analysis` called; syslog unavailability reported honestly. ~8 LLM calls. |
| 02 | 1 | `86015dc42baa4bd417a6ffbeee91bf51` | 0 | 1 | 1 | 0 | 2 | **0** | 4/7 (L1,L2,L3,L7) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 5 | not measurable | 102s | graceful_partial | Named L3 "zero tools bound" (runtime-accurate) vs expected L2 instruction. `fix_target` 1 (partial): "supply a lookup tool" is half of the seed's own sanctioned fix; instruction half absent. Fix is an outline, not appliable → 0. See seed-2 construction finding in DECISION.md §D2. |
| 02 | 2 | `cff195842b2e4314f243fed2ce91bfd1` | 0 | 1 | 1 | 0 | 2 | **0** | 4/7 (L1,L2,L3,L7) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 7 | not measurable | 151s | graceful_partial | Identical diagnosis to run 1 — consistent across the doubled runs. Same scoring rationale. |
| 03 | 1 | `f3a2950c2baa4bd417a6ffbeee91bfb4` | 2 | 2 | 1 | 1 | 6 | **1** | 4/7 (L1,L3,L5,L6) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 9 | not measurable | 172s | n/a — success | `genuinely_empty` verdict CONFIRMED by two independent reads. Report claims 6/7 swept; E2 strict derivation credits 4/7 (L2 "instructions section not pulled" by its own admission; L4 claimed implicit via query_table, schema_lookup not called). K26 tool smells as secondary findings. |
| 03 | 2 | `e1c319c02b6e4314f243fed2ce91bf68` | 2 | 2 | 1 | 1 | 6 | **1** | 5/7 (L1,L2,L3,L5,L6) | 7/7 (measured) | completed | 25 | 10 × all 7 tools | 8 | not measurable | 150s | n/a — success | Consistent with run 1. genai_log identified 2 successful LLM calls (model `claude-sonnet-4-6`). L4 again claimed implicit — not credited. |
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
  the claim is noted (seed 3 rows).
- **`layers_available`** was read fresh per run via the §E3 m2m query; all runs returned the same
  7 active bindings → 7/7. This differs from the template's forward-looking expectation of 1/7,
  which described the pre-Tasks-7/8 build; #32's blocker was cleared before this benchmark ran.
- **Run anchor status:** every scored conversation's `x_snc_troubleshoot_run` row remains
  `status=running` after the conversation ends — the native adapter opens the anchor but nothing
  closes it. Recorded as a harness observation for Phase 1b; does not affect scoring.

If valid runs < 8, record **gate not met — insufficient data** and stop; do not compute a verdict
from the survivors (§A3). *(Not triggered: 10 valid runs.)*
