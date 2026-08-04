# Scoring packet — Row 11

**Seed:** 03 (missing data) · **Harness:** native (Agent Doctor) · **Run:** 2

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

## 2. Seed specification (verbatim, `benchmark/seeds/seed-03-missing-data.md`)

# Seed 03 — missing data

| | |
|---|---|
| **Expected root-cause layer** | `data` (layer 5) |
| **Expected fix target** | data seeding |
| **Fluent source** | `../seed-app/src/fluent/seed-03-missing-data.now.ts` |
| **Agent name** | Seed 03 Category Router |
| **Also stresses** | — |

## The defect

> **OBSERVED AT TASK 12 (2026-08-02) — the prediction held.** Seed execution
> `c4cd01842b6a4bd417a6ffbeee91bfc3`: `lookup_routing_rule` returned
> `{ok: true, matched: false, category: "Hardware", rules_in_table: 0}` — the
> measured GlideAggregate count, not a constant.
>
> [Editorial note — scoring-isolation boundary: a sentence originally here
> stated a prior benchmark pass's score for its two scored runs. It has been
> omitted because it references prior-pass scores, which must not reach a
> scorer of this pass.]

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
it*. `seed-app/src/fluent/seed-tables-acl.now.ts` grants the read ACL for
exactly this reason (Build Rule #42). Granting `create` there does **not** seed
the table; it stays empty, and nothing in the app inserts into it.

## Setup

Install the fixture app (Task 12): `cd benchmark/seed-app && now-sdk install --alias gpinst01`.
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
string. Guarded by `../../test/blindRule.test.js` — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 03 Category Router
x_snc_tsbench_routing
rules_in_table
```

---

## 3. This run's report

**Harness:** native (Agent Doctor, agent sys_id `e1392946828940e5a708fc51b0a5e954`, fresh conversation)
**Prompt sent (verbatim):** `Diagnose execution plan c4cd01842b6a4bd417a6ffbeee91bfc3.`
**This run's own identity:** Execution ID `7c0eeea42be6871817a6ffbeee91bf26`, conversation `2c0eaea42be6871817a6ffbeee91bff3`
**Terminal state:** Completed
**Wall clock:** 153s
**Tool-call count (as reported when this run was fired):** 9 — `agent_trace` ×1, `read_artifact` ×5, `agent_config` ×1, `query_table` ×1, `schema_lookup` ×1 (19 execution tasks total)

Full text of the Fix Report (the message the user/caller actually sees):

> ## Fix Report — Execution Plan `c4cd01842b6a4bd417a6ffbeee91bfc3`
>
> ---
>
> ### FAILURE SUMMARY
>
> The user submitted: *"Please route this hardware request: my monitor is
> flickering and needs replacement."* The agent resolved the category as
> **Hardware**, called the `lookup_routing_rule` tool correctly, and
> received a well-formed response — but that response reported `matched:
> false` and `rules_in_table: 0`. The tool executed without error; the
> routing table `x_snc_tsbench_routing` simply contains no rows. Because
> there was nothing to match against, the agent fell back and told the user
> it could not find a routing rule. The run state is **Completed** (not
> errored), but the functional objective — routing the request to an
> assignment group — was not achieved.
>
> ---
>
> ### LAYERS SWEPT
>
> | Layer | Status | Notes |
> |-------|--------|-------|
> | 1 · Execution trace | **SWEPT** | Full task tree and tool call retrieved |
> | 2 · Agent instructions | **NOT SWEPT** | Trace showed no instruction-parsing error; data absence was established before instructions needed review |
> | 3 · Tool definitions | **SWEPT** | Tool script and input schema retrieved via agent_config |
> | 4 · Data schemas | **SWEPT** | `x_snc_tsbench_routing` confirmed to exist with correct columns |
> | 5 · Data | **SWEPT** | Table confirmed genuinely empty |
> | 6 · GenAI stack | **NOT SWEPT** | Two GenAI tasks completed successfully; no model-call failure in the trace; stack did not need further audit |
> | 7 · Trigger and wiring | **NOT SWEPT** | Access Verification task passed; run was triggered and executed normally |
> | Platform logs | **UNAVAILABLE** | `log_analysis` is blocked on most instances — the syslog table restricts cross-scope callers. An instance administrator must grant cross-scope syslog access to sweep this layer |
>
> ---
>
> ### ROOT CAUSES
>
> **RC-1 — Routing table is empty**
>
> | Attribute | Value |
> |-----------|-------|
> | Layer | 5 · Data |
> | Component | Table `x_snc_tsbench_routing`, all rows |
> | Finding | The table exists and has the correct schema (`category`, `assignment_group`) but contains zero records. The tool cannot match any category because there is nothing to match against. |
> | Evidence | `query_table` → table `x_snc_tsbench_routing`, read_status `empty`, unfiltered_row_count `0`, verdict `genuinely_empty` (sn_aia_tools_execution sys_id `0acd45842b6a4bd417a6ffbeee91bfa1`; tool response `{"ok":true,"matched":false,"category":"Hardware","rules_in_table":0}`) |
> | Confidence | **CONFIRMED** — two independent checks (GlideRecordSecure read + unfiltered COUNT) both returned 0 |
>
> ---
>
> ### FIXES
>
> **Fix 1 — Seed the routing table**
>
> | Attribute | Value |
> |-----------|-------|
> | Target type | Data |
> | Target | Table `x_snc_tsbench_routing` |
> | Current | 0 rows |
> | Proposed | Insert at minimum one row per category the agent is expected to handle. For the failing case: `category = Hardware`, `assignment_group = <target group name>`. Add rows for every other category in scope. |
> | Rationale | The tool script queries this table directly. Without rows, `matched` is always `false` regardless of the input category. |
>
> **Fix 2 (recommended, secondary) — Mark the `category` input as mandatory**
>
> | Attribute | Value |
> |-----------|-------|
> | Target type | Tool schema |
> | Target | `sn_aia_agent_tool_m2m` binding `3bacb3ef18454586b86a87f11ffaae9a`, field `inputs` → `mandatory` flag for the `category` parameter |
> | Current | `"mandatory": false` |
> | Proposed | `"mandatory": true` |
> | Rationale | The input is structurally required for the query. Marking it optional allows the model to omit it; the tool then silently queries with a null category and returns no match. |
>
> **Fix 3 (recommended, secondary) — Add negative guidance to the tool description**
>
> | Attribute | Value |
> |-----------|-------|
> | Target type | Tool schema |
> | Target | `sn_aia_tool` `3bd31a0be63d4e81856598dbd2c96788`, field `description` |
> | Current | `"Looks up the assignment group for a category in the bench routing table. Give it a category name. Returns the matching assignment group, or reports explicitly that no rule matched."` |
> | Proposed | Append: `"Use only for category-to-group routing lookups. Do not call this tool if the category is unknown or if the request does not require group assignment."` |
> | Rationale | The tool-quality scan flagged `description_no_negative_guidance` and `description_no_input_guidance` (medium severity). Without boundaries the model may reach for this tool in inappropriate contexts. |
>
> ---
>
> ### VERIFICATION
>
> 1. Insert at least one row into `x_snc_tsbench_routing` with `category =
>    Hardware` and a valid `assignment_group` value.
> 2. Re-run the agent with the same objective: *"Please route this hardware
>    request: my monitor is flickering and needs replacement."*
> 3. Expect the tool response to return `{"ok": true, "matched": true,
>    "category": "Hardware", "assignment_group": "<inserted value>",
>    "rules_in_table": 1}`.
> 4. Expect the agent's final message to name the resolved assignment group
>    rather than reporting no match.
>
> ---
>
> ### DATA MARKERS
>
> The following record data was observed during diagnosis and should be
> redacted before this report leaves the instance:
>
> - User profile message: user email, first name, last name, sys_id,
>   user_id (from `sn_aia_message` sys_id `54cd01842b6a4bd417a6ffbeee91bfc9`)
> - Conversation sys_id: `44cd85402b6a4bd417a6ffbeee91bf79`
> - Sender sys_id in `sys_cs_message`: `6816f79cc0a8016401c5a33be04be441`

---

## 4. This run's Task 10 audit-trail measurements

These were derived from `x_snc_troubleshoot_audit` (and, for native, the
`sn_aia_gen_ai_m2m` LLM-call linkage) independently of and before any Fix
Report was read for correctness. The audit trail can REFUTE a sweep claim in
the run's own report above, but never CONFER one.

- **`layers_swept` (audit-trail-derived): 4/7 (L1, L3, L4, L5)**
- **Tool-call count:** 9
- **Tool-call order:** `agent_trace`, `read_artifact` ×3, `agent_config`, `read_artifact` ×2, `query_table`, `schema_lookup`
- **LLM-call count:** 7
- **`layers_available`:** 7/7 — `agent_trace, agent_config, schema_lookup, query_table, genai_log, log_analysis, read_artifact`, all `active=true` on the agent record (re-queried directly from the instance for this measurement, not assumed)
- **Terminal state:** Completed
- **Wall clock:** 153s

This run's one `agent_config` call was requested with `section:"tools"` and
returned `sections_returned: ["tools"]` only, crediting Layer 3 (Tool
definitions) only. This matches the run's own LAYERS SWEPT table above, which
already marks Layer 2 (Instructions) NOT SWEPT — no disagreement between this
run's own report and the audit trail on this point.

**Anchor-record note.** This run's own `x_snc_troubleshoot_run` anchor row
(the observation-channel record used to derive the measurements above)
remained `status: running` and was never updated to a terminal state, despite
the underlying native execution reaching `Completed` as shown above. This is
a harness-observation-channel gap, not a scoring input.

## 5. Additional notes

No additional run-specific notes beyond the report and measurements above.
