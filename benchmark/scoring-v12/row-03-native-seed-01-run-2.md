# Scoring packet — Row 03

**Seed:** 01 · **Harness arm:** native (Agent Doctor, `servicenow_aia_execute`) · **Run:** 2

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

# Seed 01 — tool schema mismatch

| | |
|---|---|
| **Expected root-cause layer** | `tool_schema` (layer 3) |
| **Expected fix target** | the tool's **word-typed contract** — map the word to its integer inside the script, or change the tool description + agent instructions to pass 1–5. **Not** "the tool input schema": Fluent script-tool inputs have no `type` property, so that fix is not expressible — see "Expected diagnosis" |
| **Fluent source** | the fixture app's Fluent source for seed-01-schema-mismatch.now.ts` |
| **Agent name** | Seed 01 Ticket Prioritizer |
| **Also stresses** | artifact paging — this seed is built to produce a LARGE trace |

## The defect

> **Fixture state, verified 2026-08-02.** The seed is installed and has been
> executed. What follows was derived from the Fluent source and from the
> records emitted into the build output directory, then confirmed against a real run —
> the measurement is recorded under "Expected diagnosis". Where this section
> states a value, it is observed rather than predicted.

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
*correct* tools (verified in the build output directory). So there is nothing in the tool's input
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
the fixture app's Fluent source for seed-01-schema-mismatch.now.ts`. **Installed-state
addendum (Task 12, 2026-08-02):** the Fluent source declares the choices, but
the install did not create them — `schema_lookup` reads the installed column as
`type: Integer`, `has_choices: false`. The integer typing carried the defect
regardless; treat "plain Integer column" as the ground truth for scoring.

## Why it is built this way

The instructions are deliberately verbose and multi-step. Seed 1 is the
benchmark's artifact-paging stressor: it is built to produce a large trace
because a benchmark of five small traces would never exercise paging at all.

**Deviation from LLD §7, recorded not hidden.** §7 specifies writing to
`incident.priority`. This seed writes to `x_snc_tsbench_ticket`, a table the
fixture app owns. R-19 measured that a scoped app cannot always reach a global
table — `syslog` stays `DENIED` even with a self-declared `sys_scope_privilege`.
A seed that failed at the scope boundary would be correctly diagnosed as a
privilege problem, and would score as a miss on `tool_schema`. The defect under
test is unchanged; the obstacle in front of it is removed.

## Setup

1. Install the fixture app (Task 12): `cd the build output directory && now-sdk install --alias gpinst01`
2. Insert one bench ticket with `short_description` set and `priority` empty.
   Record its sys_id. (This is possible only because
   the seed's Fluent source file grants record ACLs and the table
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
string. Guarded by the blind-rule guard test — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 01 Ticket Prioritizer
x_snc_tsbench_ticket
set_ticket_priority
priority_stored
priority_requested
```

---

## 3. This run's report

**Harness arm:** native (Agent Doctor, `servicenow_aia_execute`)  
**How this run was invoked:** servicenow_aia_execute on agent "Agent Doctor" — objective: "Diagnose the failing AI Agent execution with plan sys_id 396a15be2b6e47d817a6ffbeee91bf0a. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes."  
**Execution under diagnosis:** `396a15be2b6e47d817a6ffbeee91bf0a`  
**Triggering record:** `c46a19ba2b228318f243fed2ce91bfca`  
**This run's own identity:** diagnostic execution `cb0b15be2b228318f243fed2ce91bf21` (TR1000246)  
**Terminal state:** **completed**  
**Wall clock:** 5m08s  
**Tool-call count:** 16

# Fix Report — Seed 01 Ticket Prioritizer
**Execution Plan:** `396a15be2b6e47d817a6ffbeee91bf0a`

---

## FAILURE SUMMARY

The user asked the agent to set the priority on bench ticket `c46a19ba2b228318f243fed2ce91bfca` to match its urgency. The agent correctly analysed the request, chose the priority word **"critical"**, and called `set_ticket_priority`. The tool reported `ok: true`, which the model interpreted as success, and a full audit-trail reply was delivered. However, **the priority was never persisted.**

The root cause is a **type mismatch**: the `priority` column on `x_snc_tsbench_ticket` is declared as type **Integer**, but the tool script passes a plain-text word ("critical") to `gr.setValue()`. GlideRecord silently discards a non-numeric string on an Integer column — no exception is raised, `gr.update()` succeeds, and the field is left blank. The tool's read-back correctly returned `priority_stored: null`, which was visible in the response, but the model had already accepted the `ok: true` flag and moved on.

A separate first-turn **TypeError** in the ReAct output parser caused a ~26-second retry before the tool was called; this inflated latency but did not block completion.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | `agent_trace` on plan `396a15be2b6e47d817a6ffbeee91bf0a`; 7 tasks, 1 tool call, full message stream read |
| 2 | Instructions | **SWEPT** | `agent_config` returned full 954-char instruction text; 6-step ReAct prompt confirmed |
| 3 | Tool definitions | **SWEPT** | `agent_config` returned full tool schema and script body for `set_ticket_priority` |
| 4 | Data schemas | **SWEPT** | `schema_lookup` on `x_snc_tsbench_ticket.priority`; type = Integer confirmed |
| 5 | Data | **SWEPT** | `query_table` on ticket `c46a19ba2b228318f243fed2ce91bfca`; record exists, priority blank post-execution |
| 6 | GenAI stack | **SWEPT** | `genai_log` (for_execution); 3 LLM calls all success; capability **AIA ReAct Engine_Amazon Bedrock** verified, no dangling refs |
| 7 | Trigger and wiring | **SWEPT** | `agent_config` triggers section; no trigger links found — expected for a conversationally invoked agent |
| — | Platform logs | **UNAVAILABLE** | `syslog` is caller-restricted (caller_access = Caller Restriction). An instance administrator must relax `caller_access` on `syslog` or export log entries from a permitted scope. Script errors inside the run remain visible through `agent_trace` (which mines them from the message stream). |

---

## ROOT CAUSES

### ROOT CAUSE 1 — Integer field type mismatch *(PRIMARY — CONFIRMED)*

- **Layer:** 3 (Tool definition) + 4 (Data schema) + 5 (Data)
- **Component:** Tool script `set_ticket_priority`, table `x_snc_tsbench_ticket`, field `priority`
- **Finding:** The tool script calls `gr.setValue('priority', inputs.priority)` where `inputs.priority` is a plain-text word such as "critical". The column is declared type **Integer**. GlideRecord silently discards the string, `gr.update()` succeeds, but the value is never stored.
- **Evidence:**
  - `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac].script` — `gr.setValue('priority', inputs.priority)` with no numeric conversion *(agent_config artifact `fe4b19322b628318f243fed2ce91bfd5`, offset 8000)*
  - `sys_dictionary[x_snc_tsbench_ticket.priority]` — `type = Integer`, `has_choices = false` *(schema_lookup result)*
  - `sn_aia_tools_execution[378a19fe2b6e47d817a6ffbeee91bf93].response` — `priority_stored: null` *(agent_trace artifact, offset 4000)*
  - `x_snc_tsbench_ticket[c46a19ba2b228318f243fed2ce91bfca].priority` = `""` (blank) after execution *(query_table result)*
- **Confidence:** **CONFIRMED** — three independent layers converge on the same cause.

---

### ROOT CAUSE 2 — ReAct output parser TypeError on first LLM turn *(SECONDARY — CONFIRMED for occurrence)*

- **Layer:** 1 (Execution trace)
- **Component:** `sn_aia_execution_task[0a6a15be2b6e47d817a6ffbeee91bfdc]` — AIA ReAct Engine (turn 1)
- **Finding:** The first ReAct turn threw `TypeError: Cannot read property "Name" from undefined` inside the output parser. The engine retried; the second turn (task `718a51fe2b6e47d817a6ffbeee91bf43`) succeeded. The error added ~26 seconds of wasted latency but did not block the run.
- **Evidence:**
  - `sn_aia_execution_task[0a6a15be2b6e47d817a6ffbeee91bfdc].output_digest` — `"I have encountered a fatal error (TypeError: Cannot read property \"Name\" from undefined) with the ReAct output parser"` *(agent_trace artifact, offset 0–4000)*
  - `execution_time_ms = 26304` on that task *(agent_trace artifact)*
- **Confidence:** **CONFIRMED** for occurrence. The underlying cause of the TypeError (malformed model output vs. platform parser bug) is **UNCONFIRMED** — platform logs (syslog) were unavailable. An instance-admin log export covering `2026-08-10 15:27:33–15:28:05` would confirm whether the parser received unexpected JSON.

---

### ROOT CAUSE 3 — LLM latency / instruction bloat *(PERFORMANCE — CONFIRMED for latency; attribution UNCONFIRMED)*

- **Layer:** 1 (Execution trace) + 6 (GenAI stack)
- **Component:** `sn_aia_execution_task[0a6a15be2b6e47d817a6ffbeee91bfdc]` (26,304 ms) and `sn_aia_execution_task[8c9a59fe2b6e47d817a6ffbeee91bf09]` (29,047 ms)
- **Finding:** Both ReAct turns exceeded the 15,000 ms latency threshold. Plan `llm_p95_latency = 26,576 ms` vs. `tool_p95_latency = 371 ms`. The verbose 6-step audit-trail instruction pattern produces ~874 response tokens per turn. Instructions are re-sent on every ReAct turn, multiplying cost.
- **Evidence:**
  - `latency_flags` — two `instruction_bloat` flags, `corroborated = false` *(agent_trace artifact, offset 16000)*
  - `sys_gen_ai_log_metadata` — `response_token_count = 874`, `time_taken = 26304` *(genai_log artifact)*
- **Confidence:** **CONFIRMED** for latency. Attribution to instruction size specifically is **UNCONFIRMED** (flags are `corroborated = false`); model provider response time may also be a factor.

---

## FIXES

### FIX 1 — Map priority word to Integer in the tool script *(addresses Root Cause 1)*

- **Target type:** Tool script
- **Target:** `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac]`, field `script`
- **Current:** `gr.setValue('priority', inputs.priority);` — passes raw string word directly
- **Proposed:** Add a word-to-integer mapping before the `setValue` call and validate the input:

javascript
(function (inputs) {
    var PRIORITY_MAP = { critical: 1, high: 2, moderate: 3, low: 4, planning: 5 };
    var priorityWord = String(inputs.priority || '').toLowerCase().trim();
    var priorityInt = PRIORITY_MAP[priorityWord];
    if (!priorityInt) {
        return JSON.stringify({ ok: false, error: 'unrecognised priority: ' + inputs.priority });
    }
    var gr = new GlideRecord('x_snc_tsbench_ticket');
    if (!gr.get(inputs.ticket)) {
        return JSON.stringify({ ok: false, error: 'ticket not found' });
    }
    gr.setValue('priority', priorityInt);
    gr.update();
    var check = new GlideRecord('x_snc_tsbench_ticket');
    if (!check.get(inputs.ticket)) {
        return JSON.stringify({ ok: false, error: 'ticket vanished after update' });
    }
    return JSON.stringify({
        ok: true,
        ticket: inputs.ticket,
        priority_requested: inputs.priority,
        priority_stored: check.getValue('priority')
    });
})(inputs);


- **Rationale:** `x_snc_tsbench_ticket.priority` is type Integer. GlideRecord silently discards non-numeric strings. Mapping the word before `setValue` makes the write succeed; the defensive parse guards against model output variation.

---

### FIX 2 — Mark both tool inputs as mandatory *(complements Fix 1)*

- **Target type:** Tool schema
- **Target:** `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac]`, field `input_schema`; also `sn_aia_agent_tool_m2m[1fa91a286055441bb4afce79fe876207]`, field `inputs`
- **Current:** Both `ticket` and `priority` have `mandatory: false`
- **Proposed:** Set both to `mandatory: true`
- **Rationale:** Making inputs mandatory causes the platform to reject the call before it reaches the script if the model omits either argument, producing a clear error rather than a silent null write.

---

### FIX 3 — Resolve or document the ReAct parser TypeError *(addresses Root Cause 2)*

- **Target type:** Configuration / platform investigation
- **Target:** `sn_aia_execution_task[0a6a15be2b6e47d817a6ffbeee91bfdc]` / AIA ReAct Engine capability `31fee654ff116e10b9c9fffffffffffd`
- **Current:** First ReAct turn sporadically produces output the parser cannot handle, causing a retry loop
- **Proposed:** An instance administrator should export syslog entries for `2026-08-10 15:27:33–15:28:05` and check for script errors from scope `sn_aia`. If the error is reproducible, open a platform support case referencing task `0a6a15be2b6e47d817a6ffbeee91bfdc` and the TypeError text. As an interim measure, keeping instruction output concise (Fix 4 below) reduces the surface area for parser edge cases.
- **Rationale:** Without platform logs the exact trigger is unconfirmed, but the symptom is a 26-second wasted retry on every affected run.

---

### FIX 4 — Reduce per-turn instruction verbosity *(addresses Root Cause 3)*

- **Target type:** Instruction
- **Target:** `sn_aia_agent[914db68f3e364222a47f9e5398b6ac8d]`, field `instructions`
- **Current:** Six verbose audit-trail steps; model produces ~874 tokens per turn; two turns at ~26–29 s each
- **Proposed:** Consolidate Steps 5 and 6 (audit trail and uncertainty listing) into the final response only, not repeated on every reasoning turn. Move the enumerated step structure into a briefer prompt that still names the required actions. Target output < 300 tokens per intermediate turn.
- **Rationale:** Instructions are reprocessed on every ReAct turn. A shorter prompt and briefer intermediate outputs reduce per-turn latency. The audit trail is only needed in the final Communicator step, not in every Gen AI reasoning turn.

---

## VERIFICATION

1. **Fix 1 (primary):** After updating the script, trigger a new interactive execution with the same objective. Confirm the tool response shows `priority_stored: 1` (or the mapped integer) and that `x_snc_tsbench_ticket[c46a19ba2b228318f243fed2ce91bfca].priority` equals `1` when queried immediately after.
2. **Fix 2:** Attempt a tool call that omits the `priority` argument. The platform should reject it with a missing-mandatory-input error rather than proceeding to the script.
3. **Fix 3:** Run agent_trace on the next execution after the platform log grant is in place. Confirm `script_errors_found = 0` and no Gen AI task shows a TypeError in its output_digest.
4. **Fix 4:** After instruction revision, rerun a full execution and confirm both ReAct Gen AI tasks complete in under 15,000 ms. Check `latency_flags` in agent_trace is empty.

---

## DATA MARKERS

The following record data was quoted as evidence and should be redacted before this report crosses the instance boundary:

- `x_snc_tsbench_ticket[c46a19ba2b228318f243fed2ce91bfca]` — ticket sys_id and post-execution priority value
- `sys_cs_conversation[256ad1ba2b6e47d817a6ffbeee91bf14]` — conversation sys_id
- `sn_aia_execution_plan[396a15be2b6e47d817a6ffbeee91bf0a]` — execution plan sys_id
- User profile message: `admin@example.com`, `6816f79cc0a8016401c5a33be04be441` (user sys_id)
References: null

---

## 4. This run's audit-trail measurements

Derived from the diagnostic run's own audit trail (`action_type=result`) per §E1–§E2,
independently of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 7/7 (L1, L2, L3, L4, L5, L6, L7) — mechanical §E2 map of the distinct tool set (`agent_trace`→L1, `agent_config`→L2/L3/L7, `schema_lookup`→L4, `query_table`→L5, `genai_log`→L6; `read_artifact` and `log_analysis` map to no layer)
- **Tool-call count:** 16 result rows
- **Distinct tool names:** 7 — `agent_trace`, `read_artifact (x9)`, `agent_config`, `genai_log`, `log_analysis`, `schema_lookup`, `query_table (x2)`
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 before run 1 by two independent paths that agreed: `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`) and the harness's own tool registry. All seven attached and active, `max_auto_executions = 10` on every one.
- **`continuous_tool_execution_limit`:** 25 — read live during this pass, not carried forward
- **Terminal state:** **completed**
- **Wall clock:** 5m08s
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
