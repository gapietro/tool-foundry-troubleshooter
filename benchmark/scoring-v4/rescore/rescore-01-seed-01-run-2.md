# Scoring Packet — Seed 01, Run 2

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

## 2. Seed spec — `benchmark/seeds/seed-01-schema-mismatch.md`

# Seed 01 — tool schema mismatch

| | |
|---|---|
| **Expected root-cause layer** | `tool_schema` (layer 3) |
| **Expected fix target** | the tool's **word-typed contract** — map the word to its integer inside the script, or change the tool description + agent instructions to pass 1–5. **Not** "the tool input schema": Fluent script-tool inputs have no `type` property, so that fix is not expressible — see "Expected diagnosis" |
| **Fluent source** | `../seed-app/src/fluent/seed-01-schema-mismatch.now.ts` |
| **Agent name** | Seed 01 Ticket Prioritizer |
| **Also stresses** | artifact paging — this seed is built to produce a LARGE trace |

## The defect

> **PREDICTED, NOT OBSERVED.** No seed has been installed or executed. What
> follows is derived from the Fluent source and from the records emitted into
> `seed-app/dist/`, which is build-time evidence, not runtime evidence.
> **Confirm at Task 12** before scoring, and correct this section if the run
> disagrees. Four predictions in this seed set were already wrong once and were
> only caught by reading `dist/`.

The instructions require the agent to express priority as a **word**
("critical", "high", …), and `set_ticket_priority` passes that word straight
through to `x_snc_tsbench_ticket.priority`, an **Integer** column (declared
with choices 1–5 in the Fluent source, but the choice list did not install —
measured `has_choices: false`; the integer typing alone carries the defect).
`'critical'` is not an integer, so the requested priority is **not what ends up
in the column** (measured at Task 12: `priority_stored` = `null` — see the
measurement note under "Expected diagnosis") — while `gr.update()` still
reports success, so the agent tells the user the ticket was prioritised.

**Where the declaration actually lives — and where it does not.** Script-tool
inputs have no `type` property in Fluent. The emitted `sn_aia_tool.input_schema`
is `[{name, description, mandatory}]`, byte-identical in shape to seeds 3 and 4's
*correct* tools (verified in `dist/`). So there is nothing in the tool's input
schema for a layer-3 sweep to find wrong, and "constrain the input schema to
1–5" is not something the schema can express. The word-typed contract is
declared in two places that *are* readable:

1. the tool **description** — "the priority as a word — critical, high,
   moderate, low or planning";
2. the tool **script**, which does `gr.setValue('priority', inputs.priority)`
   with no mapping or validation.

Those are what a diagnosis can cite and what a builder could actually change.

**Column type corrected 2026-08-01.** ~~The column is a `ChoiceColumn`.~~ It was
originally declared with `ChoiceColumn`, which emits `internal_type=choice`,
`max_length=40` — a *string-backed* column that stores `'critical'` quite
happily. The mechanism above was false as shipped. The column is now
`IntegerColumn` + choices, emitting `internal_type=integer` (the shape
`task.priority` itself uses on gpinst01), which makes the mismatch real. See
`../seed-app/src/fluent/seed-01-schema-mismatch.now.ts`. **Installed-state
addendum (Task 12, 2026-08-02):** the Fluent source declares the choices, but
the install did not create them — `schema_lookup` reads the installed column as
`type: Integer`, `has_choices: false`. The integer typing carried the defect
regardless; treat "plain Integer column" as the ground truth for scoring.

## Why it is built this way

The instructions are deliberately verbose and multi-step. Seed 1 is the
benchmark's artifact-paging stressor: the native harness's weakest documented
area is large evidence, and a benchmark of five small traces would never
exercise it.

**Deviation from LLD §7, recorded not hidden.** §7 specifies writing to
`incident.priority`. This seed writes to `x_snc_tsbench_ticket`, a table the
fixture app owns. R-19 measured that a scoped app cannot always reach a global
table — `syslog` stays `DENIED` even with a self-declared `sys_scope_privilege`.
A seed that failed at the scope boundary would be correctly diagnosed as a
privilege problem, and would score as a miss on `tool_schema`. The defect under
test is unchanged; the obstacle in front of it is removed.

## Setup

1. Install the fixture app (Task 12): `cd benchmark/seed-app && now-sdk install --alias gpinst01`
2. Insert one bench ticket with `short_description` set and `priority` empty.
   Record its sys_id. (This is possible only because
   `seed-app/src/fluent/seed-tables-acl.now.ts` grants record ACLs and the table
   sets `allowWebServiceAccess` — Build Rule #42. Without both, an admin insert
   returns *Access denied: User Not Authorized* and this step cannot be done at
   all.)

## Trigger

Open a fresh conversation with **Seed 01 Ticket Prioritizer** and give it the
ticket sys_id plus an urgent-sounding description — e.g. *"the payment gateway
is down for all customers, no workaround"*. Capture the resulting
`sn_aia_execution_plan` sys_id.

## Expected diagnosis

Root cause in `tool_schema`: the tool accepts and forwards a priority **word**
while the target column is Integer-typed (measured installed state: plain
Integer, no choice list — `has_choices: false`), so the value is never stored.

Fix target: **the tool's word-typed contract** — map the word to its integer
value inside the script before `setValue`, or change the tool description and
the agent instructions to pass 1–5. Do **not** expect "constrain the input
schema to 1–5"; as "The defect" explains, the Fluent input schema has no type
field to constrain, so that fix is not expressible and must not be the standard
a run is scored against.

Evidence a correct diagnosis should cite: the trace showing `priority_stored`
**disagreeing with `priority_requested`** in the tool result, plus the
`x_snc_tsbench_ticket.priority` dictionary entry showing `internal_type=integer`.

**`priority_stored` measured at Task 12 (2026-08-02): `null`.** The seed
execution `b07dc9082baa4314f243fed2ce91bf4b` called `set_ticket_priority` with
`priority: "critical"` and the tool returned `{ok: true, priority_requested:
"critical", priority_stored: null}` while the record's `priority` column read
back empty over REST. GlideRecord silently discarded the non-numeric string —
the seed's mechanism is confirmed as built. (Pre-measurement guidance, kept for
the record: any value that is not the requested word scores as correct
evidence; only `priority_stored == "critical"` would have refuted the seed.)
One correction surfaced by the de-risk pass: the **choice list did not
install** — `schema_lookup` reports `has_choices: false` on the installed
column — so the defect as measured is "word written to a plain Integer column",
not "integer choice 1–5". The integer typing is the operative half and the
seed's diagnosis target is unchanged.

### Scoring note — layers 3 and 4 (M18)

This defect straddles two layers by construction: it is a disagreement *between*
the tool contract (layer 3) and the column type (layer 4), and neither side is
wrong on its own. `root_cause_layer_correct` is binary, so the resolution is
stated here rather than left to the scorer:

- **`tool_schema` (layer 3) is the expected answer** and scores full marks.
- **A run answering "layer 4 — the column is Integer-typed and the tool sends a
  word" also scores full marks.** It describes the same finding from the other
  side and identifies the same fix. (Wording updated 2026-08-02: the measured
  installed state is a **plain Integer column with no choice list** —
  `has_choices: false`, see "The defect" — so do not require the word "choice"
  in the answer, and do not penalise a run for correctly reporting that no
  choice list exists. "Integer choice 1–5" answers score the same as "Integer
  column" answers; the load-bearing half is the integer typing.)
- A run naming only one side *without* the disagreement — e.g. "the column is
  Integer-typed" with no mention of what is being written to it — scores 0. The
  finding is the mismatch, not either half.

## Safety

Touches only `x_snc_tsbench_ticket`, owned by the fixture app. Nothing shared.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by `../../test/blindRule.test.js` — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 01 Ticket Prioritizer
x_snc_tsbench_ticket
set_ticket_priority
priority_stored
priority_requested
```

---

## 3. Run report — full text, verbatim

Retrieved from `sn_aia_message.message` (identical to `.user_message`), sys_id
`deb01d4c2bea4314f243fed2ce91bfe9`, on execution plan `73df81c42bea4314f243fed2ce91bf91`
(conversation `2fdf8d0c2baa4314f243fed2ce91bfa3`).

> ## Fix Report — Seed 01 Ticket Prioritizer
>
> ---
>
> ### FAILURE SUMMARY
>
> The user asked Seed 01 Ticket Prioritizer to set ticket `532bc10c2b6a4314f243fed2ce91bf4b` to critical priority. The agent called `set_ticket_priority`, which located the record and executed `gr.setValue('priority', 'critical')`. Because `x_snc_tsbench_ticket.priority` is an **Integer** column with no choice list, GlideRecord silently discarded the non-numeric string and left the field unchanged (`priority_stored: null`). The script's post-update check tests only that the record still exists — it never compares the stored value to the intended value — so it returned `ok: true`. The agent interpreted that as confirmation and told the user the update had succeeded.
>
> ---
>
> ### LAYERS SWEPT
>
> | Layer | Status | Notes |
> |---|---|---|
> | 1 – Execution trace | **SWEPT** | |
> | 2 – Instructions | **NOT SWEPT** | The LLM selected the correct tool with correct arguments; no instruction-following defect indicated. Budget preserved. |
> | 3 – Tool definitions | **SWEPT** | Script body and input schema inspected. |
> | 4 – Data schemas | **SWEPT** | `task.priority` and `x_snc_tsbench_ticket.priority` both confirmed. |
> | 5 – Data | **SWEPT** | Ticket existence confirmed via tool return path; task-table cross-check confirmed ticket is not in the task hierarchy. |
> | 6 – GenAI stack | **NOT SWEPT** | LLM selected and called the right tool with correct arguments; no model-layer defect indicated. |
> | 7 – Trigger / wiring | **NOT SWEPT** | Execution completed normally; access verification passed. |
> | Platform logs (syslog) | **UNAVAILABLE** | `syslog` has a `caller_access` restriction this application cannot lift. An instance administrator must relax `caller_access` on `syslog` or provide a log export to complete this layer. |
>
> ---
>
> ### ROOT CAUSES
>
> #### Root Cause 1 — Type mismatch: string written to Integer field
>
> | Attribute | Detail |
> |---|---|
> | **Layer** | 3 — Tool script |
> | **Component** | `sn_aia_tool` / `set_ticket_priority` |
> | **Finding** | `gr.setValue('priority', inputs.priority)` passes the string `"critical"` to an Integer column. GlideRecord silently discards non-numeric strings on integer fields; the column is not updated. |
> | **Evidence** | Tool script body (`sn_aia_tool.script`): `gr.setValue('priority', inputs.priority)` with `inputs.priority = "critical"` (from `sn_aia_tools_execution` request_digest). Schema: `x_snc_tsbench_ticket.priority` — type `Integer`, `has_choices: false`, no choice list (schema_lookup). Tool response: `priority_stored: null` (`sn_aia_tools_execution` response_digest). |
> | **Confidence** | ✅ CONFIRMED |
>
> #### Root Cause 2 — False-success return: `ok: true` despite null write
>
> | Attribute | Detail |
> |---|---|
> | **Layer** | 3 — Tool script |
> | **Component** | `sn_aia_tool` / `set_ticket_priority` |
> | **Finding** | The post-update check reads back the record and returns whatever `getValue` returns without asserting that `priority_stored` equals the intended value. When the write silently fails, `ok` is still `true`, hiding the defect from the agent and the user. |
> | **Evidence** | Tool script: `return JSON.stringify({ ok: true, …, priority_stored: check.getValue('priority') })`. Tool response: `{ ok: true, priority_stored: null }` (`sn_aia_tools_execution`). Agent final message: *"The ticket has been updated. Priority set to Critical."* (`sn_aia_message`). |
> | **Confidence** | ✅ CONFIRMED |
>
> ---
>
> ### FIXES
>
> #### Fix 1 — Map the word input to the integer value before writing
>
> | | |
> |---|---|
> | **Target type** | Tool schema (script body) |
> | **Target** | `sn_aia_tool`, field: `script` |
> | **Current** | `gr.setValue('priority', inputs.priority);` |
> | **Proposed** | Replace with a lookup map before the `setValue` call: |
>
> ```javascript
> var priorityMap = {
>     critical: 1,
>     high:     2,
>     moderate: 3,
>     low:      4,
>     planning: 5
> };
> var intPriority = priorityMap[(inputs.priority || '').toLowerCase()];
> if (intPriority === undefined) {
>     return JSON.stringify({
>         ok: false,
>         error: 'unrecognised priority: ' + inputs.priority
>     });
> }
> gr.setValue('priority', intPriority);
> ```
>
> **Rationale:** `x_snc_tsbench_ticket.priority` is an Integer field. The word-to-integer mapping mirrors the choice list on `task.priority` (1 = Critical … 5 = Planning). Passing the integer eliminates the silent GlideRecord discard.
>
> ---
>
> #### Fix 2 — Guard the post-update check so `ok: false` is returned on a mismatch
>
> | | |
> |---|---|
> | **Target type** | Tool schema (script body) |
> | **Target** | `sn_aia_tool`, field: `script` |
> | **Current** | `return JSON.stringify({ ok: true, ticket: …, priority_requested: inputs.priority, priority_stored: check.getValue('priority') });` |
> | **Proposed** | |
>
> ```javascript
> var stored = check.getValue('priority');
> var success = (String(stored) === String(intPriority));
> return JSON.stringify({
>     ok: success,
>     ticket: inputs.ticket,
>     priority_requested: inputs.priority,
>     priority_stored: stored,
>     error: success ? null : 'write did not persist (stored: ' + stored + ')'
> });
> ```
>
> **Rationale:** The agent interprets `ok: true` as confirmed success and relays it to the user. Returning `ok: false` when the stored value does not match the intended value ensures the agent reports the true outcome.
>
> ---
>
> #### Fix 3 — Mark both inputs as mandatory in the tool binding
>
> | | |
> |---|---|
> | **Target type** | Tool schema (input schema) |
> | **Target** | `sn_aia_agent_tool_m2m`, field: `inputs` |
> | **Current** | `mandatory: false` on both `ticket` and `priority` |
> | **Proposed** | Set `mandatory: true` on both inputs. |
> | **Rationale** | Optional inputs allow the LLM to omit them without a schema-level rejection. Mandatory inputs cause the framework to reject the call before execution if either value is absent, preventing silent partial-write failures. |
>
> ---
>
> ### VERIFICATION
>
> 1. Apply Fixes 1 and 2 to the `set_ticket_priority` script body.
> 2. Ensure a bench ticket record exists in `x_snc_tsbench_ticket` (create one if needed).
> 3. Re-invoke the agent: *"Please prioritise ticket `<sys_id>` as critical."*
> 4. **Expected tool response:** `{ ok: true, priority_requested: "critical", priority_stored: "1" }`
> 5. Open the bench ticket record and confirm the Priority field holds the value `1`.
> 6. **Negative test:** Pass an unrecognised word (e.g., `"urgent"`). Expected: `{ ok: false, error: "unrecognised priority: urgent" }`. The agent should report the failure rather than claiming success.
>
> ---
>
> ### DATA MARKERS
>
> The following record identifiers were quoted above as evidence. **Redact before this report crosses the instance boundary:**
>
> - Ticket sys_id: `532bc10c2b6a4314f243fed2ce91bf4b` *(x_snc_tsbench_ticket — subject of failed write)*
> - Execution plan sys_id: `b07dc9082baa4314f243fed2ce91bf4b`
> - Tool execution sys_id: `869d4d482baa4314f243fed2ce91bf89`
> - Agent message sys_id: `3ead09882baa4314f243fed2ce91bf40`
> - User sys_id in conversation: `6816f79cc0a8016401c5a33be04be441`
> - User email in user profile message: `admin@example.com`
> References: null

---

## 4. Measurements recorded in the 2026-08-02 scorecard

These four values were not recomputed today — they are copied as-is from
`benchmark/scorecard-agent-doctor.md`'s row for this run.

| Field | Value recorded in the 2026-08-02 scorecard |
|---|---|
| `layers_swept` | 4/7 (L1,L3,L4,L5) |
| `layers_available` | 7/7 (measured) |
| `tool_calls` | 11 |
| `wall_clock` | 224s |
