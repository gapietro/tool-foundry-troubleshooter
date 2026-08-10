# Scoring packet — Row 11

**Seed:** 03 · **Harness arm:** native (Agent Doctor, `servicenow_aia_execute`) · **Run:** 2

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

# Seed 03 — missing data

| | |
|---|---|
| **Expected root-cause layer** | `data` (layer 5) |
| **Expected fix target** | data seeding |
| **Fluent source** | the fixture app's Fluent source for seed-03-missing-data.now.ts` |
| **Agent name** | Seed 03 Category Router |
| **Also stresses** | — |

## The defect

> **Fixture state, verified 2026-08-02.** Seed execution
> `c4cd01842b6a4bd417a6ffbeee91bfc3`: `lookup_routing_rule` returned
> `{ok: true, matched: false, category: "Hardware", rules_in_table: 0}` — the
> measured GlideAggregate count, not a constant.

The table exists, the tool queries it correctly, and the instructions are
unambiguous. The table is empty. Every lookup returns `matched: false`. This
is the seed that separates "the data is absent" from "the read failed" —
indistinguishable from a trace unless the tool reports empty reads
explicitly, which is exactly the R-6 / R-11 failure mode this project keeps
legislating against.

## Why it is built this way

Everything upstream of the data is correct: the query, the tool's contract,
the instructions telling the agent never to guess. The only thing wrong is
that `x_snc_tsbench_routing` was installed with zero rows. A diagnosis that
blames the tool or the query is chasing a layer that has no defect in it —
the tool reports the empty result honestly (`matched: false`, plus a
`rules_in_table` count), so the evidence needed to reach the correct layer is in
the trace if it is read.

**`rules_in_table` is now measured, corrected 2026-08-01.** ~~The tool reports
`rules_in_table: 0`.~~ It previously returned the literal `0` unconditionally,
with no count — which handed the diagnostic agent the seed's answer as a
constant rather than as a measured empty read, and would have reported "0 rules"
even from a populated table. It is now a real `GlideAggregate` count returned on
both the matched and unmatched paths, so the distinction the seed is built to
reward — *no rule for this category* versus *no rules at all* — is something the
tool actually establishes.

**The read ACL is part of the instrument, not housekeeping.** A layer-5 sweep
using `GlideRecordSecure` against a table with no read ACL returns zero rows
whether the table is empty or merely unreadable — which would make this seed's
defect indistinguishable from an access denial *by the very tool meant to find
it*. the seed's Fluent source file grants the read ACL for
exactly this reason (Build Rule #42). Granting `create` there does **not** seed
the table; it stays empty, and nothing in the app inserts into it.

## Setup

Install the fixture app (Task 12): `cd the build output directory && now-sdk install --alias gpinst01`.
Add no rows to `x_snc_tsbench_routing` — the emptiness is the defect.

## Trigger

Open a fresh conversation with **Seed 03 Category Router** and ask it to route
a request in any category. Capture the resulting `sn_aia_execution_plan`
sys_id.

## Expected diagnosis

Root cause in `data`: the routing table holds zero rows. Fix target: data
seeding, not the tool or the instructions. A diagnosis naming the tool or the
query is a **miss**, and the scorecard should record it as one.

## Safety

Table owned by the fixture app; created empty by design.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by the blind-rule guard test — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 03 Category Router
x_snc_tsbench_routing
rules_in_table
```

---

## 3. This run's report

**Harness arm:** native (Agent Doctor, `servicenow_aia_execute`)  
**How this run was invoked:** servicenow_aia_execute on agent "Agent Doctor" — objective: "Diagnose the failing AI Agent execution with plan sys_id 704ca97e2be68318f243fed2ce91bf61. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes."  
**Execution under diagnosis:** `704ca97e2be68318f243fed2ce91bf61`  
**This run's own identity:** diagnostic execution `5aac69fe2be287d817a6ffbeee91bf4b` (TR1000254)  
**Terminal state:** **completed**  
**Wall clock:** 4m51s  
**Tool-call count:** 15

# Fix Report — Agent "Seed 03 Category Router"
**Execution Plan:** `704ca97e2be68318f243fed2ce91bf61`

---

## FAILURE SUMMARY

Agent **Seed 03 Category Router** ran to completion without a script error, but delivered a negative result: *"no matching assignment group was found"* for the Software category. The agent's tool `lookup_routing_rule` executed successfully, queried table `x_snc_tsbench_routing` for a row where `category = 'Software'`, and reported `rules_in_table = 0`. The table is **genuinely empty** — no routing rules have ever been seeded. The agent behaved correctly given its instructions; the data it needed does not exist. The agent's own description acknowledges this: *"Benchmark seed - deliberately broken."*

Secondary observations: the agent overview counter `active_tool_count = 0` despite both binding and tool showing `active = 1` and the tool executing successfully; no trigger wiring is present (expected for interactive/conversational invocation); and the GenAI `check_config` filter for "AIA ReAct Engine" returned empty — functionally not blocking, as both LLM calls completed with status `success`.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `agent_trace` on plan `704ca97e2be68318f243fed2ce91bf61` |
| 2 | Instructions | **SWEPT** | `agent_config` instructions section |
| 3 | Tool definitions | **SWEPT** | `agent_config` tools section — script, schema, smell checks |
| 4 | Data schemas | **SWEPT** | `schema_lookup` on `x_snc_tsbench_routing` — table exists, 8 columns |
| 5 | Data | **SWEPT** | `query_table` on `x_snc_tsbench_routing` — `genuinely_empty` verdict |
| 6 | GenAI stack | **SWEPT** | `genai_log` `for_execution` (2 LLM calls, both success) + `check_config` (see RC-3) |
| 7 | Trigger / wiring | **SWEPT** | `agent_config` triggers section — no trigger links on either branch (expected for interactive invocation) |
| — | Platform logs | **UNAVAILABLE** | `syslog` restricts cross-scope callers (`caller_access = Caller Restriction`). The application's CrossScopePrivilege grant does not lift this. **Required action:** an instance administrator must relax `caller_access` on `syslog` or export logs from a permitted scope. |

---

## ROOT CAUSES

### RC-1 (PRIMARY) — Empty routing data table

| Field | Value |
|-------|-------|
| **Layer** | 5 — Data |
| **Component** | Table `x_snc_tsbench_routing`, all rows |
| **Finding** | The routing table is genuinely empty. The tool script queries this table by category; with zero rows it can never match any request. The execution plan state shows `Completed` — masking the defect from a quick status check. |
| **Evidence** | • `sn_aia_tools_execution` sys_id `a05ca1be2be68318f243fed2ce91bfb1`: response `{"ok":true,"matched":false,"category":"Software","rules_in_table":0}` |
| | • `query_table` on `x_snc_tsbench_routing`: `unfiltered_row_count=0`, `verdict=genuinely_empty` |
| | • Tool script (sn_aia_tool `3bd31a0be63d4e81856598dbd2c96788`) uses `GlideAggregate` COUNT before querying; returned 0 |
| **Confidence** | **CONFIRMED** |

---

### RC-2 (SECONDARY) — Input `category` not marked mandatory; no input validation

| Field | Value |
|-------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` `3bd31a0be63d4e81856598dbd2c96788`, field `input_schema` — mandatory flag on input `category` |
| **Finding** | `category` is declared `mandatory=false`. If the LLM omits the argument, the GlideRecord query runs with an empty string and returns no match — indistinguishable from a genuine miss. The script also performs no input validation or normalisation. |
| **Evidence** | • `agent_config` tools section, binding `3bacb3ef18454586b86a87f11ffaae9a`: `"mandatory":false` |
| | • Tool smell `script_no_input_validation` (severity medium, confidence heuristic) flagged in `agent_config` artifact |
| **Confidence** | **CONFIRMED** (mandatory flag); **UNCONFIRMED** (whether a missing-input call has occurred — current run passed category correctly) |

---

### RC-3 (OBSERVATION) — GenAI capability definition not found by name filter

| Field | Value |
|-------|-------|
| **Layer** | 6 — GenAI stack |
| **Component** | `sys_one_extend_capability_definition`, name containing "AIA ReAct Engine" |
| **Finding** | `check_config` returned empty for the "AIA ReAct Engine" filter (matched=0). Two LLM calls did succeed against definition `AIA ReAct Engine_Amazon Bedrock`, so the capability is functionally wired. The mismatch may indicate the definition lives in a scope not readable by this application. |
| **Evidence** | • `genai_log check_config`: filter matched 0 definitions, `read_status=empty` |
| | • `genai_log for_execution`: 2 LLM calls, both `status=success`, `definition_name="AIA ReAct Engine_Amazon Bedrock"` |
| **Confidence** | **UNCONFIRMED** — a direct `query_table` on `sys_one_extend_capability_definition` filtered by `nameLIKEAIA ReAct Engine%` would confirm or clear it. Not blocking current runs. |

---

## FIXES

### FIX-1 — Seed the routing table *(addresses RC-1)*

| Field | Value |
|-------|-------|
| **Target type** | Data |
| **Target** | `x_snc_tsbench_routing` (label: Bench Routing Rule) |
| **Current** | 0 rows — table is empty |
| **Proposed** | Insert at minimum one row: `category = "Software"`, `assignment_group = <correct group name, e.g. "Software Support">`. Add one row per category the agent is expected to route. |
| **Rationale** | The tool can only return a match when a row exists. No code change is needed — the script, schema, and agent instructions are all correct. Only data is missing. |

---

### FIX-2 — Mark `category` input mandatory *(addresses RC-2, part 1)*

| Field | Value |
|-------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` `3bd31a0be63d4e81856598dbd2c96788`, field `input_schema` |
| **Current** | `[{"name":"category","description":"The category to look up in the routing table.","mandatory":false}]` |
| **Proposed** | `[{"name":"category","description":"The category to look up in the routing table. Must be a plain string, e.g. \"Software\". Required — do not call this tool without a category value.","mandatory":true}]` |
| **Rationale** | Marking `mandatory=true` causes the ReAct engine to block execution and re-prompt the LLM if `category` is absent, rather than silently passing an empty string that returns a spurious no-match. Expanding the description also addresses tool smell `description_no_input_guidance`. |

---

### FIX-3 — Add defensive input validation to the tool script *(addresses RC-2, part 2)*

| Field | Value |
|-------|-------|
| **Target type** | Tool schema (script body) |
| **Target** | `sn_aia_tool` `3bd31a0be63d4e81856598dbd2c96788`, field `script` |
| **Current** | Script reads `inputs.category` without validating it |
| **Proposed** | Add a guard at the top of the IIFE: `var cat = (inputs.category \|\| '').toString().trim(); if (!cat) { return JSON.stringify({ok:false, error:'category is required'}); }` — then use `cat` in place of `inputs.category` throughout. |
| **Rationale** | Prevents a blank-string query returning `matched=false` that is indistinguishable from a legitimate miss. Satisfies tool smell `script_no_input_validation`. |

---

## VERIFICATION

**After applying FIX-1:**
1. Open a new interactive session and send: *"Please route a request in the Software category to the correct assignment group."*
2. Expect `agent_trace` on the new execution plan to show tool call response:
   `{"ok":true,"matched":true,"category":"Software","assignment_group":"<seeded group>","rules_in_table":1}`
3. Expect the agent's final message to name the assignment group rather than reporting no match.

**After applying FIX-2 and FIX-3:**
1. Send a request that omits the category (e.g., *"Route this request."*).
2. Expect the agent to ask for clarification rather than calling the tool with an empty input.

**For RC-3 (GenAI capability hygiene):**
Run `query_table` on `sys_one_extend_capability_definition` with `query=nameLIKEAIA ReAct Engine` and confirm `api`, `api_type`, and `capability` fields are non-empty on the matching row.

---

## DATA MARKERS

*The following record data was cited as evidence and should be redacted before this report crosses the instance boundary:*

- **User profile** (`sn_aia_message` `814ca97e2be68318f243fed2ce91bfa5`): user email, user sys_id, user name
- **Tool execution response** (`sn_aia_tools_execution` `a05ca1be2be68318f243fed2ce91bfb1`): category value "Software"
- **Conversation sys_id** `633ce57e2be68318f243fed2ce91bf63` and associated message sequence numbers
References: null

---

## 4. This run's audit-trail measurements

Derived from the diagnostic run's own audit trail (`action_type=result`) per §E1–§E2,
independently of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 7/7 (L1, L2, L3, L4, L5, L6, L7) — mechanical §E2 map of the distinct tool set (`agent_trace`→L1, `agent_config`→L2/L3/L7, `schema_lookup`→L4, `query_table`→L5, `genai_log`→L6; `read_artifact` and `log_analysis` map to no layer)
- **Tool-call count:** 15 result rows
- **Distinct tool names:** 7 — `agent_trace`, `read_artifact (x8)`, `agent_config`, `genai_log (x2)`, `log_analysis`, `schema_lookup`, `query_table`
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 before run 1 by two independent paths that agreed: `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`) and the harness's own tool registry. All seven attached and active, `max_auto_executions = 10` on every one.
- **`continuous_tool_execution_limit`:** 25 — read live during this pass, not carried forward
- **Terminal state:** **completed**
- **Wall clock:** 4m51s
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
