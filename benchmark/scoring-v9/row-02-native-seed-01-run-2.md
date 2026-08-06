# Scoring packet — Row 02

**Seed:** 01 · **Harness arm:** native (Agent Doctor, `servicenow_aia_execute`) · **Run:** 2

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

# Seed 01 — tool schema mismatch

| | |
|---|---|
| **Expected root-cause layer** | `tool_schema` (layer 3) |
| **Expected fix target** | the tool's **word-typed contract** — map the word to its integer inside the script, or change the tool description + agent instructions to pass 1–5. **Not** "the tool input schema": Fluent script-tool inputs have no `type` property, so that fix is not expressible — see "Expected diagnosis" |
| **Fluent source** | this seed's Fluent definition file |
| **Agent name** | Seed 01 Ticket Prioritizer |
| **Also stresses** | artifact paging — this seed is built to produce a LARGE trace |

## The defect

> **Fixture state, verified 2026-08-02.** The seed is installed and has been
> executed. What follows was derived from the Fluent source and from the
> records emitted into the fixture app's build output, then confirmed against a real run —
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
*correct* tools (verified in the build output). So there is nothing in the tool's input
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
this seed's Fluent definition file. **Installed-state
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

1. Install the fixture app (Task 12): run `now-sdk install --alias gpinst01` from the fixture app directory
2. Insert one bench ticket with `short_description` set and `priority` empty.
   Record its sys_id. (This is possible only because
   the fixture app's ACL definition file grants record ACLs and the table
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
**Input text sent (verbatim):**  

```
Diagnose the failing AI Agent execution with plan sys_id 45bbfd112ba6cf54f243fed2ce91bfcb. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes.
```

**This run's own identity:** run_id (`sn_aia_execution_plan` sys_id) `853ffd1d2bea475817a6ffbeee91bf0b`, `conversation_ref` `743fbd1d2bea475817a6ffbeee91bf74`  
**Execution under diagnosis:** `sn_aia_execution_plan` `45bbfd112ba6cf54f243fed2ce91bfcb`  
**Terminal state:** `sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty  
**Wall clock:** 4 m 17 s (257 s) — 2026-08-06 02:17:26 → 02:21:43  
**Tool-call count:** 17

`sn_aia_message` sys_id `172082152b2e475817a6ffbeee91bf2b`, `role` = `agent`, created 2026-08-06 02:21:41. (The sibling row at the same second, `1f2082152b2e475817a6ffbeee91bfba`, contains only the platform stub `"The agent/action was invoked successfully."` — not a report.)

# Fix Report — Execution Plan `45bbfd112ba6cf54f243fed2ce91bfcb`

---

## FAILURE SUMMARY

The user asked agent **Seed 01 Ticket Prioritizer** to set the priority on bench ticket `a64b795d2b66cf54f243fed2ce91bf11` to match a P1 urgency description ("checkout service failing for every customer, no workaround"). The agent ran to completion, called `set_ticket_priority` with `priority = "critical"`, and reported success — but the priority on the ticket record was never written. The tool returned `priority_stored: null`, and the ticket's `priority` field is still blank after the run. The silent failure is caused by a **type mismatch**: the `priority` column is declared as **Integer** on the table, but the tool script passes a plain string word ("critical") to `gr.setValue()`. ServiceNow's GlideRecord silently discards a non-numeric string written to an Integer column and leaves the field unchanged. A secondary issue is that both tool inputs (`ticket`, `priority`) are declared non-mandatory, so neither the platform nor the LLM is warned when they are absent or malformed. The agent's own description flags it as "deliberately broken," confirming the defect is intentional for benchmark purposes.

---

## LAYERS SWEPT

| # | Layer | Status | Notes |
|---|-------|--------|-------|
| 1 | Execution trace | **SWEPT** | Plan state Completed; 3 LLM calls, 1 tool call; `priority_stored: null` confirmed |
| 2 | Instructions | **SWEPT** | Instructions well-formed; no script errors in agent instructions |
| 3 | Tool definitions | **SWEPT** | Script body and input schema fully read; type-mismatch and non-mandatory inputs confirmed |
| 4 | Data schemas | **SWEPT** | `x_snc_tsbench_ticket.priority` confirmed Integer |
| 5 | Data | **SWEPT** | Ticket record exists; priority field blank post-run |
| 6 | GenAI stack | **SWEPT** | 3 LLM calls all succeeded (claude-sonnet-4-6 via Amazon Bedrock); no capability findings |
| 7 | Trigger and wiring | **SWEPT** | No trigger links — consistent with conversational invocation; not a defect for this run |
| — | Platform logs | **UNAVAILABLE** | `syslog` is caller-restricted; a cross-scope privilege is installed but cannot lift a caller restriction. An instance administrator must relax `caller_access` on `syslog` or export log evidence independently. |

---

## ROOT CAUSES

### RC-1 — Type mismatch: string written to Integer priority field

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 (Tool definition) + 4 (Data schema) |
| **Component** | `sn_aia_tool` record `set_ticket_priority` · script body; `x_snc_tsbench_ticket.priority` column |
| **Finding** | The tool calls `gr.setValue('priority', inputs.priority)` where `inputs.priority` is a word such as `"critical"`. The column is declared **type: Integer**. GlideRecord silently coerces a non-numeric string to null and performs no write. The read-back `check.getValue('priority')` therefore returns null, which the tool faithfully reports as `priority_stored: null`. |
| **Evidence** | • `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac` — script body (agent_config artifact, page 3): `gr.setValue('priority', inputs.priority); … priority_stored: check.getValue('priority')` → returns `null` · • `schema_lookup` on `x_snc_tsbench_ticket`: field `priority`, type = **Integer** · • Execution task `b2dbf5912ba6cf54f243fed2ce91bf2a` output: `{"ok":true,"priority_requested":"critical","priority_stored":null}` · • Message stream sys_id `32dbf5912ba6cf54f243fed2ce91bfc1`: same null confirmed |
| **Confidence** | **CONFIRMED** — two independent layers agree |

---

### RC-2 — Both tool inputs declared non-mandatory

| Attribute | Value |
|-----------|-------|
| **Layer** | 3 (Tool definition) |
| **Component** | `sn_aia_agent_tool_m2m` binding sys_id `1fa91a286055441bb4afce79fe876207`, `inputs` field |
| **Finding** | Both `ticket` and `priority` are `mandatory: false`. A missing or malformed argument causes a silent null rather than a validation error visible to the LLM or operator. |
| **Evidence** | agent_config artifact page 2 — binding inputs: `[{"name":"ticket",…"mandatory":false},{"name":"priority",…"mandatory":false}]` |
| **Confidence** | **CONFIRMED** |

---

### RC-3 — First LLM call produced a ReAct parser TypeError (recovered)

| Attribute | Value |
|-----------|-------|
| **Layer** | 1 (Execution trace) |
| **Component** | Gen AI task sys_id `99bb31512ba6cf54f243fed2ce91bf16` |
| **Finding** | The first LLM call triggered `TypeError: Cannot read property "Name" from undefined` in the ReAct output parser. The engine retried and recovered. This is a latent fragility, not the cause of the silent write failure, but it extended wall-clock time by ~26 seconds. |
| **Evidence** | Execution task output_digest: `"I have encountered a fatal error (TypeError: Cannot read property \"Name\\" from undefined) with the ReAct output parser and would like to retry the same execution."` |
| **Confidence** | **CONFIRMED** as an error; root cause of the TypeError itself is **UNCONFIRMED** — platform logs (unavailable) would be needed to confirm whether this originates in the capability definition or the engine version. |

---

## FIXES

### Fix 1 — Map priority words to integers in the tool script *(addresses RC-1)*

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool definition — script |
| **Target** | `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac`, field `script` |
| **Current** | `gr.setValue('priority', inputs.priority);` — passes raw word string |
| **Proposed** | Add a mapping at the top of the IIFE before the write: `var MAP = {critical:1, high:2, moderate:3, low:4, planning:5}; var numericPriority = MAP[String(inputs.priority).toLowerCase()]; if (numericPriority === undefined) { return JSON.stringify({ok:false, error:'unknown priority word: ' + inputs.priority}); } gr.setValue('priority', numericPriority);` |
| **Rationale** | The column is Integer; the mapping converts the accepted vocabulary to the stored values. An unknown word now returns an explicit error rather than a silent null. |

---

### Fix 2 — Mark both inputs mandatory *(addresses RC-2)*

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool definition — input schema |
| **Target** | `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac`, field `input_schema`; also `sn_aia_agent_tool_m2m` sys_id `1fa91a286055441bb4afce79fe876207`, field `inputs` |
| **Current** | Both inputs have `"mandatory": false` |
| **Proposed** | Set `"mandatory": true` for both `ticket` and `priority` |
| **Rationale** | Mandatory inputs force the platform to surface a validation error before the script runs if either argument is absent, rather than silently passing null. |

---

### Fix 3 — Add output guidance to the tool description *(defensive; addresses tool smell)*

| Attribute | Value |
|-----------|-------|
| **Target type** | Tool definition — description |
| **Target** | `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac`, field `description` |
| **Current** | `"Sets the priority on a bench ticket. Give it the ticket sys_id and the priority as a word - critical, high, moderate, low or planning. Returns the ticket number and the priority that was stored."` |
| **Proposed** | Append: `"If priority_stored is null in the response, the write did not succeed and the priority was not changed."` |
| **Rationale** | The LLM currently reads `ok:true` and ignores `priority_stored:null`. Explicit output guidance makes the failure case interpretable without the builder changing the ReAct instructions. |

---

## VERIFICATION

1. Apply Fix 1 (integer mapping) and Fix 2 (mandatory inputs) to the tool record.
2. Re-run the agent with the same objective: _"Ticket `a64b795d2b66cf54f243fed2ce91bf11`: checkout service failing… set priority."_
3. Expect the tool response to return `priority_stored: 1` (or the integer matching "critical").
4. Query `x_snc_tsbench_ticket` sys_id `a64b795d2b66cf54f243fed2ce91bf11`, field `priority` — it must be non-blank and match the mapped integer.
5. Confirm the execution plan completes with no `priority_stored: null` in the message stream.

---

## DATA MARKERS

The following record data was quoted as evidence above and should be redacted before this report crosses the instance boundary:

- Ticket sys_id: `a64b795d2b66cf54f243fed2ce91bf11`
- User sys_id from message stream: `6816f79cc0a8016401c5a33be04be441`
- User email quoted in run context: `admin@example.com`
References: null

---

## 4. This run's audit-trail measurements

Derived from `x_snc_troubleshoot_audit` (`action_type=result`) per §E1–§E2, independently
of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 7/7 (L1, L2, L3, L4, L5, L6, L7) — mechanical §E2 map of the distinct tool set
- **Tool-call count:** 17 result rows
- **Ordered tool-call list:**
  1. `agent_trace` (02:17:37)
  2. `read_artifact` (02:17:45)
  3. `read_artifact` (02:17:57)
  4. `read_artifact` (02:17:57)
  5. `read_artifact` (02:18:21)
  6. `agent_config` (02:18:21)
  7. `genai_log` (02:18:21)
  8. `query_table` (02:18:43)
  9. `read_artifact` (02:18:43)
  10. `read_artifact` (02:18:43)
  11. `read_artifact` (02:19:17)
  12. `log_analysis` (02:19:18)
  13. `query_table` (02:19:18)
  14. `schema_lookup` (02:19:18)
  15. `read_artifact` (02:20:00)
  16. `read_artifact` (02:20:00)
  17. `genai_log` (02:20:01)
- **Distinct tool names:** 7 — `agent_trace`, `read_artifact`, `agent_config`, `genai_log`, `query_table`, `log_analysis`, `schema_lookup`
- **LLM-call count:** 8 (`type=gen_ai`; also `tool` 17, `agent` 1, `access_verification` 1, `communicator` 1)
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 on `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`): `agent_trace`, `agent_config`, `schema_lookup`, `query_table`, `genai_log`, `log_analysis`, `read_artifact` — all seven attached and active, `max_auto_executions = 10` on every one. Read before this run and re-read after the run set; no tool attachment changed.
- **Terminal state:** `sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty
- **Wall clock:** 4 m 17 s (257 s) — 2026-08-06 02:17:26 → 02:21:43

---

## 5. Notes specific to this run

- The MCP invocation returned before the run finished; the terminal state recorded above was read by polling this run's own `sn_aia_execution_plan` record.
- This run's `x_snc_troubleshoot_run` anchor record was left at `status: running` even after the agent execution reached `completed`. The terminal state above is read from the execution plan, not from the anchor.
- The report's claim that `syslog` is caller-restricted and the platform-log layer is UNAVAILABLE is the run's own prose. It was not independently verified by the operator; it is reproduced as written.
