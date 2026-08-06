# Scoring packet — Row 03

**Seed:** 03 · **Harness arm:** native (Agent Doctor, `servicenow_aia_execute`) · **Run:** 1

This packet is self-contained. It contains the scoring rubric, this seed's
specification, this run's full report, and this run's audit-trail
measurements — nothing else. Score this row using only the content below.

---

## 1. Scoring rubric

Section 1 is reproduced from this project's scorecard template; section 2 is reproduced from
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
| `fix_usable_unedited` | 0 or 1 | The Fix Report's proposed fix could be applied by the builder AI as written, with no manual editing first — **and it addresses the defect the seed actually carries.** A well-formed fix aimed at the wrong target is a no-op, not a usable fix, so **`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0.** See the note under the gate rule for why this constraint lives here rather than in the gate expression |

**Total: 6 points per run.**

**Why `fix_target_correct` has a partial band.** It was 0-or-2, while
seed 5's specification instructs the scorer to award *partial*
credit for naming "inactive" without naming which of the two activation gates is
off — an instruction the scale could not express, leaving the scorer to round
arbitrarily in either direction. The 1 band resolves it. Seed 5 is the only seed
that currently defines a partial case; for the others, 1 is available but must be
justified in `notes` if used.

## A2. `passes_gate` — the column the gate actually consumes

The rubric scores each run **out of 6**. The gate counts **runs**: *"≥ 8/10 runs with correct root cause + usable fixes."*
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
| **Fluent source** | this seed's Fluent definition file |
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
it*. The fixture app's ACL definition file grants the read ACL for
exactly this reason (Build Rule #42). Granting `create` there does **not** seed
the table; it stays empty, and nothing in the app inserts into it.

## Setup

Install the fixture app (Task 12): run `now-sdk install --alias gpinst01` from the fixture app directory.
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
**Input text sent (verbatim):**  

```
Diagnose the failing AI Agent execution with plan sys_id 3afbf1192baa475817a6ffbeee91bf10. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes.
```

**This run's own identity:** run_id (`sn_aia_execution_plan` sys_id) `74010e192b2e475817a6ffbeee91bfda`, `conversation_ref` `2c0186152b2e475817a6ffbeee91bf97`  
**Execution under diagnosis:** `sn_aia_execution_plan` `3afbf1192baa475817a6ffbeee91bf10`  
**Terminal state:** `sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty  
**Wall clock:** 2 m 47 s (167 s) — 2026-08-06 02:25:20 → 02:28:07  
**Tool-call count:** 13

`sn_aia_message` sys_id `c5a18e5d2b2e475817a6ffbeee91bf52`, `role` = `agent`, created 2026-08-06 02:28:05. (Sibling row `c5a18e5d2b2e475817a6ffbeee91bf7e` at the same second holds only the stub `"The agent/action was invoked successfully."`)

## Fix Report — Execution Plan `3afbf1192baa475817a6ffbeee91bf10`

---

### FAILURE SUMMARY

The user asked agent **Seed 03 Category Router** to route a Hardware-category request to the correct assignment group. The agent ran to completion without error: it called the `lookup_routing_rule` tool, which queried table `x_snc_tsbench_routing` and returned `{matched: false, rules_in_table: 0}`. The LLM correctly interpreted the empty result and told the user no assignment group was found. The execution plan state is **Completed** — there is no crash or timeout — but the agent produced no routing answer because the routing table contains zero rows. The defect is missing seed data, not a code or configuration error.

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | Plan completed; 1 tool call; `rules_in_table:0, matched:false` |
| 2 | Agent instructions | **SWEPT** | Instructions structurally present; 329 chars; no script errors |
| 3 | Tool definitions | **SWEPT** | 1 tool (`lookup_routing_rule`), binding active, script correct |
| 4 | Data schemas | **SWEPT** | `x_snc_tsbench_routing` exists; columns `category` and `assignment_group` confirmed |
| 5 | Data | **SWEPT** | Table is **genuinely empty** — 0 rows confirmed without ACL filtering |
| 6 | GenAI stack | **SWEPT** | 2 LLM calls to `claude-sonnet-4-6` via `AIA ReAct Engine_Amazon Bedrock`; both succeeded; no errors |
| 7 | Trigger and wiring | **SWEPT** | No trigger wiring rows exist; agent ran interactively/conversationally, so this is expected and not a defect |
| — | Platform logs (syslog) | **UNAVAILABLE** | `syslog` table has `caller_access` restriction; DENIED for this scope. An instance administrator must either relax `caller_access` on `syslog` or export the log entries from a permitted scope. Platform-level script errors around (not inside) the run were therefore not swept. |

---

### ROOT CAUSES

**Root Cause 1 — Missing routing data (PRIMARY)**

| Attribute | Value |
|-----------|-------|
| **Layer** | 5 — Data |
| **Component** | Table `x_snc_tsbench_routing` |
| **Finding** | The table exists and is structurally correct, but contains **zero rows**. The tool script counted all rows (`rules_in_table: 0`) and queried by category (`matched: false`). There are no routing rules for any category, including Hardware. |
| **Evidence** | `query_table` → `x_snc_tsbench_routing`, read_status `empty`, `unfiltered_row_count: 0`, `verdict: genuinely_empty` (confirmed without ACL filtering). Tool call response: `{ok:true, matched:false, category:"Hardware", rules_in_table:0}` — `sn_aia_tools_execution` sys_id `b80c39192baa475817a6ffbeee91bf6a`. |
| **Confidence** | **CONFIRMED** — two independent reads (tool script at runtime + `query_table` diagnostic) agree. |

---

**Root Cause 2 — `category` input not marked mandatory (CONTRIBUTING)**

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` sys_id `3bd31a0be63d4e81856598dbd2c96788`, input schema field `category` |
| **Finding** | The `category` input is declared with `mandatory: false`. The tool's entire query pivot is this field; if the LLM omits it, the query returns all rows (or, on an empty table, zero rows) with no diagnostic signal about a missing input. |
| **Evidence** | `agent_config` tools section → binding sys_id `3bacb3ef18454586b86a87f11ffaae9a`, `inputs: [{"name":"category","mandatory":false}]`. Tool script has no null/missing-input guard before `gr.addQuery('category', inputs.category)`. |
| **Confidence** | **CONFIRMED** (configuration) — impact on this specific run is **UNCONFIRMED** because the LLM did pass `category:"Hardware"` correctly in this execution; the risk is latent. |

---

**Root Cause 3 — Tool description lacks negative guidance and input format statement (MINOR)**

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_tool` sys_id `3bd31a0be63d4e81856598dbd2c96788`, `description` field |
| **Finding** | The description does not state what inputs the tool expects or what the caller should do when the tool returns `matched:false`. The LLM correctly handled the empty result in this run because the instructions are well-written, but the tool itself provides no contract boundary. |
| **Evidence** | `agent_config` tools section → `description`: *"Looks up the assignment group for a category in the bench routing table. Give it a category name. Returns the matching assignment group, or reports explicitly that no rule matched."* Tool smells logged: `description_no_negative_guidance`, `description_no_input_guidance`. |
| **Confidence** | **CONFIRMED** (text scan) — behavioural impact in this run was nil; risk is latent. |

---

### FIXES

**Fix 1 — Seed the routing table (addresses Root Cause 1)**

| Attribute | Value |
|-----------|-------|
| **Target type** | Data |
| **Target** | Table `x_snc_tsbench_routing` |
| **Current** | 0 rows |
| **Proposed** | Insert at minimum one row with `category = Hardware` and `assignment_group = <correct group name>`. Seed all categories the agent is expected to handle. |
| **Rationale** | The tool script and schema are correct. The only reason `matched:false` was returned is the absence of data. Inserting the routing rules directly resolves the failure. |

---

**Fix 2 — Mark `category` input mandatory (addresses Root Cause 2)**

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` sys_id `3bd31a0be63d4e81856598dbd2c96788`, input schema → `category` → `mandatory` |
| **Current** | `mandatory: false` |
| **Proposed** | `mandatory: true` |
| **Rationale** | The tool cannot return a meaningful result without this field. Marking it mandatory causes the platform to reject a call that omits it before the script runs, producing a clear failure signal rather than a silent empty-match. |

---

**Fix 3 — Add input validation to the tool script (addresses Root Cause 2)**

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema / script |
| **Target** | `sn_aia_tool` sys_id `3bd31a0be63d4e81856598dbd2c96788`, `script` field |
| **Current** | Script reads `inputs.category` directly with no null/empty guard |
| **Proposed** | Add a guard at the top of the IIFE: `if (!inputs.category) { return JSON.stringify({ok:false, error:'category input is required'}); }` |
| **Rationale** | Defensive validation ensures a missing or empty input produces an actionable error message rather than silently querying with a blank category value. |

---

**Fix 4 — Strengthen tool description (addresses Root Cause 3)**

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` sys_id `3bd31a0be63d4e81856598dbd2c96788`, `description` field |
| **Current** | *"Looks up the assignment group for a category in the bench routing table. Give it a category name. Returns the matching assignment group, or reports explicitly that no rule matched."* |
| **Proposed** | Append: *"Input: category (string, required) — the exact category name. Do not call this tool without a known category. When matched:false is returned, report the absence to the user and do not guess an assignment group."* |
| **Rationale** | Explicit negative guidance prevents the model from calling the tool speculatively or fabricating a fallback answer when no match is found. |

---

### VERIFICATION

1. After inserting routing rows (Fix 1): Re-run the same objective — *"Please route a request in the Hardware category to the correct assignment group."* — against agent `Seed 03 Category Router`.
2. Confirm the new execution plan shows a tool call response where `matched:true` and `assignment_group` is populated.
3. Confirm the agent's final message contains the assignment group name rather than a "no match" notice.
4. To verify Fix 2 and Fix 3: Invoke the tool with an empty `category` and confirm the call is rejected at the platform level (mandatory) or returns `{ok:false, error:"category input is required"}` (script guard).

---

### DATA MARKERS

The following record data was cited as evidence and should be reviewed for redaction before this report leaves the instance:

- User profile message: `user Email: admin@example.com`, `user Sys ID: 6816f79cc0a8016401c5a33be04be441` — sourced from `sn_aia_message` (User Profile role), execution plan `3afbf1192baa475817a6ffbeee91bf10`.
- Tool call request/response payload: `{category:"Hardware"}` / `{ok:true, matched:false, category:"Hardware", rules_in_table:0}` — sourced from `sn_aia_tools_execution` sys_id `b80c39192baa475817a6ffbeee91bf6a`. These values are configuration-level and low-sensitivity, but are flagged per protocol.

---

> **Note on platform logs:** The `syslog` table was DENIED for this diagnostic scope due to a `caller_access` restriction. The platform log layer was **not swept**. Script errors raised *outside* the execution boundary (e.g., platform-level ACL evaluation or trigger resolution errors) were not observable. To sweep this layer, an instance administrator must relax `caller_access` on `syslog` or provide a log export from a permitted scope.
References: null

---

## 4. This run's audit-trail measurements

Derived from `x_snc_troubleshoot_audit` (`action_type=result`) per §E1–§E2, independently
of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 7/7 (L1, L2, L3, L4, L5, L6, L7) — mechanical §E2 map of the distinct tool set
- **Tool-call count:** 13 result rows
- **Ordered tool-call list:**
  1. `agent_trace` (02:25:31)
  2. `read_artifact` (02:25:41)
  3. `read_artifact` (02:25:41)
  4. `read_artifact` (02:25:41)
  5. `read_artifact` (02:25:41)
  6. `agent_config` (02:26:04)
  7. `genai_log` (02:26:04)
  8. `read_artifact` (02:26:23)
  9. `read_artifact` (02:26:23)
  10. `read_artifact` (02:26:23)
  11. `log_analysis` (02:26:51)
  12. `schema_lookup` (02:26:51)
  13. `query_table` (02:26:51)
- **Distinct tool names:** 7 — `agent_trace`, `read_artifact`, `agent_config`, `genai_log`, `log_analysis`, `schema_lookup`, `query_table`
- **LLM-call count:** 6 (`type=gen_ai`; also `tool` 13, `agent` 1, `access_verification` 1, `communicator` 1)
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 on `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`): `agent_trace`, `agent_config`, `schema_lookup`, `query_table`, `genai_log`, `log_analysis`, `read_artifact` — all seven attached and active, `max_auto_executions = 10` on every one. Read before this run and re-read after the run set; no tool attachment changed.
- **Terminal state:** `sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty
- **Wall clock:** 2 m 47 s (167 s) — 2026-08-06 02:25:20 → 02:28:07

---

## 5. Notes specific to this run

- The MCP invocation returned before the run finished; the terminal state recorded above was read by polling this run's own `sn_aia_execution_plan` record.
- This run's `x_snc_troubleshoot_run` anchor record was left at `status: running` even after the agent execution reached `completed`. The terminal state above is read from the execution plan, not from the anchor.
- The report's claim that `syslog` is caller-restricted and the platform-log layer was not swept is the run's own prose. It was not independently verified by the operator; it is reproduced as written.
