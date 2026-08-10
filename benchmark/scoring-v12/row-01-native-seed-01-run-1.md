# Scoring packet — Row 01

**Seed:** 01 · **Harness arm:** native (Agent Doctor, `servicenow_aia_execute`) · **Run:** 1

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
**How this run was invoked:** servicenow_aia_execute on agent "Agent Doctor" — objective: "Diagnose the failing AI Agent execution with plan sys_id a860d5322b6e4318f243fed2ce91bf93. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes."  
**Execution under diagnosis:** `a860d5322b6e4318f243fed2ce91bf93`  
**Triggering record:** `3b4051322b6e4318f243fed2ce91bf73`  
**This run's own identity:** diagnostic execution `24c05d362baa47d817a6ffbeee91bfcd` (TR1000242)  
**Terminal state:** **completed**  
**Wall clock:** 4m24s  
**Tool-call count:** 15

## Fix Report — Execution `a860d5322b6e4318f243fed2ce91bf93`

---

### FAILURE SUMMARY

The user observed that the agent "Seed 01 Ticket Prioritizer" completed without error, yet the ticket priority was never actually updated. The agent correctly reasoned through triage steps, called `set_ticket_priority` with `priority = "critical"`, and received `ok: true` from the tool. However the tool's own read-back returned `priority_stored: null`, confirming a **silent write failure**. The defect is a type mismatch: the `priority` column on `x_snc_tsbench_ticket` is declared as **Integer**, but the tool script passes the string word `"critical"` directly into `gr.setValue()`. GlideRecord silently discards a string written to an Integer field; the `gr.update()` call succeeds (no exception is thrown), and the read-back returns null. The agent then reported success to the user based on `ok: true`, which was set before the type mismatch was detectable.

---

### LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | agent_trace on plan `a860d5322b6e4318f243fed2ce91bf93` |
| 2 | Agent instructions | **SWEPT** | agent_config, instructions section |
| 3 | Tool definitions | **SWEPT** | agent_config, tools section — full script body read |
| 4 | Data schemas | **SWEPT** | schema_lookup on `x_snc_tsbench_ticket.priority` |
| 5 | Data (record existence) | **SWEPT** | query_table confirmed ticket exists, priority blank post-run |
| 6 | GenAI stack | **SWEPT** | genai_log for_execution — 3 LLM calls, all successful |
| 7 | Trigger and wiring | **SWEPT** | agent_config triggers section — no trigger wiring (expected: conversational invocation) |
| — | Platform logs | **UNAVAILABLE** | `syslog` read returned DENIED. The table enforces `caller_access = Caller Restriction` which cannot be lifted by application scope. An instance administrator must either relax `caller_access` on `syslog` or export the log externally. Script errors raised *inside* the execution are visible through agent_trace (0 found); errors at the platform layer around the run are not covered. |

---

### ROOT CAUSES

#### RC-1 — Integer field receives string value (CONFIRMED)

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 (tool script) + 4 (schema) |
| **Component** | Tool script `set_ticket_priority`, field `x_snc_tsbench_ticket.priority` |
| **Finding** | The tool calls `gr.setValue('priority', inputs.priority)` where `inputs.priority` is the string `"critical"`. The `priority` column is declared as type **Integer** (no choices). GlideRecord silently ignores a non-numeric value written to an Integer field; the subsequent read returns null. |
| **Evidence — trace** | `sn_aia_tools_execution` row `f6805d722b6e4318f243fed2ce91bf3f`: response `{"ok":true, "priority_requested":"critical", "priority_stored":null}` |
| **Evidence — schema** | `schema_lookup` on `x_snc_tsbench_ticket.priority`: `type: "Integer"`, `has_choices: false`, `declared_on: x_snc_tsbench_ticket` |
| **Evidence — data** | `query_table` on `x_snc_tsbench_ticket` sys_id `3b4051322b6e4318f243fed2ce91bf73`: `priority: ""` (empty after run) |
| **Evidence — script** | agent_config artifact, tool script body: `gr.setValue('priority', inputs.priority); gr.update(); ... check.getValue('priority')` — no type conversion anywhere in the 593-char script |
| **Confidence** | **CONFIRMED** |

#### RC-2 — Tool inputs declared non-mandatory (CONFIRMED)

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 (tool definition) |
| **Component** | `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac]` input schema |
| **Finding** | Both `ticket` and `priority` inputs are `mandatory: false`. The LLM can omit either input without the platform raising a validation error, making the silent failure mode broader than RC-1 alone. |
| **Evidence** | agent_config artifact, tool input schema: `[{"name":"ticket","mandatory":false},{"name":"priority","mandatory":false}]` |
| **Confidence** | **CONFIRMED** |

#### RC-3 — Instruction bloat causing excess LLM latency (CONFIRMED)

| Attribute | Value |
|-----------|-------|
| **Layer** | 1 (trace latency flags) + 2 (instructions) |
| **Component** | Agent instructions, `sn_aia_agent[914db68f3e364222a47f9e5398b6ac8d]` |
| **Finding** | Two ReAct engine steps breached the 15,000 ms latency threshold (27,768 ms and 20,317 ms). Instructions are reprocessed on every ReAct turn, amplifying their cost. The plan `llm_p95_latency = 25,366 ms`. This does not prevent correctness but degrades user experience and raises token costs. |
| **Evidence** | agent_trace latency_flags: tasks `896019322b6e4318f243fed2ce91bfed` (27,768 ms) and `07805d722b6e4318f243fed2ce91bff4` (20,317 ms), both flagged `instruction_bloat`. `instruction_chars: 954`. |
| **Confidence** | **CONFIRMED** |

#### RC-4 — ReAct parser error on first LLM step (CONFIRMED, recovered)

| Attribute | Value |
|-----------|-------|
| **Layer** | 1 (execution trace) |
| **Component** | Gen AI task `896019322b6e4318f243fed2ce91bfed` (AIA ReAct Engine, step order 100) |
| **Finding** | The first ReAct step produced output that triggered `Error: Invalid next entry for scratchpad`. The engine recovered by retrying the same reasoning on step order 200. This added ~27 s of latency and indicates the LLM output structure was malformed on the first turn — consistent with instruction-induced confusion or an overly complex prompt shape. |
| **Evidence** | agent_trace task tree, task `896019322b6e4318f243fed2ce91bfed` output_digest: `"I have encountered a fatal error (Error: Invalid next entry for scratchpad) with the ReAct output parser and would like to retry the same execution."` |
| **Confidence** | **CONFIRMED** |

---

### FIXES

#### FIX-1 — Add integer mapping to tool script (addresses RC-1)

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool script |
| **Target** | `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac]`, field `script` |
| **Current** | `gr.setValue('priority', inputs.priority)` — passes raw string directly |
| **Proposed** | Add a word-to-integer map at the top of the IIFE and validate before writing: `var MAP = {critical:1, high:2, moderate:3, low:4, planning:5}; var pInt = MAP[String(inputs.priority).toLowerCase()]; if (pInt === undefined) { return JSON.stringify({ok:false, error:'unrecognised priority word: ' + inputs.priority}); }`
References: null

*(Continuing the Fix Report from FIX-1 above)*

---

#### FIX-2 — Mark both tool inputs as mandatory (addresses RC-2)

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac]`, field `input_schema` |
| **Current** | `[{"name":"ticket","mandatory":false},{"name":"priority","mandatory":false}]` |
| **Proposed** | `[{"name":"ticket","description":"The sys_id of the bench ticket to update.","mandatory":true},{"name":"priority","description":"The priority as a word: critical, high, moderate, low or planning.","mandatory":true}]` |
| **Rationale** | Marking both inputs mandatory causes the platform to reject a tool call before it reaches the script if either value is absent, eliminating the silent-omission failure path identified in RC-2. |

#### FIX-3 — Simplify agent instructions to reduce ReAct parse failures and latency (addresses RC-3 and RC-4)

| Attribute | Value |
|-----------|-------|
| **Target type** | Instruction |
| **Target** | `sn_aia_agent[914db68f3e364222a47f9e5398b6ac8d]`, field `instructions` |
| **Current** | 954-character six-step instruction block requiring the agent to narrate every reasoning step inline before calling the tool |
| **Proposed** | Condense to the minimum needed: identify urgency factors, decide a priority word, call `set_ticket_priority`, report result and reasoning. Move the audit-trail requirement to a post-call summary step rather than demanding inline narration at every turn. Target under 400 characters. |
| **Rationale** | Instructions are reprocessed on every ReAct turn. Verbose step-by-step narration requirements increase prompt size, amplify per-turn latency (observed p95 = 25,366 ms vs. 15,000 ms threshold), and produce the complex output structures that caused the ReAct parser error on the first LLM step (RC-4). Shorter, action-oriented instructions reduce both latency and parse-failure risk. |

---

### VERIFICATION

1. **RC-1 (type mismatch):** After applying FIX-1, trigger the agent with the same objective. Inspect the tool response: `priority_stored` must return a non-null integer (e.g., `1` for critical). Run `query_table` on `x_snc_tsbench_ticket` with `sys_id=3b4051322b6e4318f243fed2ce91bf73` and confirm `priority` is no longer blank.
2. **RC-2 (non-mandatory inputs):** After applying FIX-2, attempt to invoke `set_ticket_priority` without passing `priority`. The platform should reject the call before the script runs and return a validation error rather than a null write.
3. **RC-3 / RC-4 (latency and parser error):** After applying FIX-3, re-run the same objective and inspect agent_trace latency_flags. Both ReAct engine steps should fall below the 15,000 ms threshold, and no `Invalid next entry for scratchpad` error should appear in the task tree output digests.
4. **End-to-end:** Confirm the conversation ends with `priority_stored` equal to the integer value that maps to `critical`, and that `query_table` confirms the field is set on the record.

---

### DATA MARKERS

The following record values were quoted as evidence above. **Flag for redaction before this report crosses the instance boundary:**

| Label | Value | Source |
|-------|-------|--------|
| Ticket sys_id | `3b4051322b6e4318f243fed2ce91bf73` | `sn_aia_tools_execution`, `x_snc_tsbench_ticket` |
| Execution plan sys_id | `a860d5322b6e4318f243fed2ce91bf93` | `sn_aia_execution_plan` |
| Tool call sys_id | `f6805d722b6e4318f243fed2ce91bf3f` | `sn_aia_tools_execution` |
| Tool response payload | `{"ok":true,"priority_requested":"critical","priority_stored":null}` | `sn_aia_tools_execution.response` |
| User profile email | `admin@example.com` | `sn_aia_message` user profile row |

---

*End of Fix Report. All seven diagnostic layers were swept; the platform log layer (syslog) was UNAVAILABLE due to a caller-restriction that requires an instance-administrator grant to lift.*
References: null

---

## 4. This run's audit-trail measurements

Derived from the diagnostic run's own audit trail (`action_type=result`) per §E1–§E2,
independently of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 7/7 (L1, L2, L3, L4, L5, L6, L7) — mechanical §E2 map of the distinct tool set (`agent_trace`→L1, `agent_config`→L2/L3/L7, `schema_lookup`→L4, `query_table`→L5, `genai_log`→L6; `read_artifact` and `log_analysis` map to no layer)
- **Tool-call count:** 15 result rows
- **Distinct tool names:** 7 — `agent_trace`, `read_artifact (x9)`, `agent_config`, `genai_log`, `log_analysis`, `schema_lookup`, `query_table`
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 before run 1 by two independent paths that agreed: `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`) and the harness's own tool registry. All seven attached and active, `max_auto_executions = 10` on every one.
- **`continuous_tool_execution_limit`:** 25 — read live during this pass, not carried forward
- **Terminal state:** **completed**
- **Wall clock:** 4m24s
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
