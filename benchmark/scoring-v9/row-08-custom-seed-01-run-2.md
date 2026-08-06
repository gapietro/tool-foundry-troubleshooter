# Scoring packet — Row 08

**Seed:** 01 · **Harness arm:** custom (`x_snc_troubleshoot`, `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`) · **Run:** 2

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

**Harness arm:** custom (`x_snc_troubleshoot`, `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`)  
**Request body sent (verbatim):** `{"execution": "45bbfd112ba6cf54f243fed2ce91bfcb", "mode": "diagnose"}`  
**POST response:** `{"run_id": "1d988e1d2bee475817a6ffbeee91bf4f", "status": "queued"}`  
**This run's own identity:** run_id (`x_snc_troubleshoot_run` sys_id) `1d988e1d2bee475817a6ffbeee91bf4f` (`TR1000163`), `conversation_ref` `custom-1-1785985105208-824952581`  
**Execution under diagnosis:** `sn_aia_execution_plan` `45bbfd112ba6cf54f243fed2ce91bfcb`  
**Terminal state:** `x_snc_troubleshoot_run.status` = **`failed`**  
**Wall clock:** 22 s — 2026-08-06 02:58:25 → 02:58:47  
**Tool-call count:** 3

`fix_report` is `null`. The rejected report below is the `fix_report_rejected.report` body, verbatim. A rejected report is still scored — this is the only record of what the model produced.

```json
{
  "failure_summary": "The agent execution for ticket a64b795d2b66cf54f243fed2ce91bf11 completed successfully with a 'critical' priority request, but the priority_stored field in the tool response was null, indicating the priority update may not have persisted. The execution trace shows the set_ticket_priority tool executed successfully, but no confirmation of the stored priority was recorded.",
  "layers_swept": {
    "1": {
      "status": "SWEPT",
      "reason": "agent_trace provided execution details including tool call outcomes"
    },
    "2": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect instructions"
    },
    "3": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect tool definitions"
    },
    "4": {
      "status": "SWEPT",
      "reason": "schema_lookup confirmed incident.priority exists and is valid"
    },
    "5": {
      "status": "NOT_SWEPT",
      "reason": "No query_table call made to verify ticket record state"
    },
    "6": {
      "status": "UNAVAILABLE",
      "reason": "No genai_log or log_analysis call made to inspect GenAI stack details"
    },
    "7": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect trigger wiring"
    }
  },
  "root_causes": [
    {
      "layer": "1",
      "component": "set_ticket_priority tool response",
      "finding": "priority_stored field is null despite successful execution",
      "evidence": [
        {
          "source": "trace",
          "detail": "tool response_digest shows 'priority_stored': null"
        },
        {
          "source": "schema",
          "detail": "incident.priority exists as an integer field with valid choices"
        }
      ]
    },
    {
      "layer": "6",
      "component": "GenAI stack configuration",
      "finding": "No evidence of GenAI stack inspection",
      "evidence": [
        {
          "source": "trace",
          "detail": "agent_trace shows no GenAI tool calls"
        },
        {
          "source": "config",
          "detail": "No agent_config call for GenAI stack parameters"
        }
      ]
    },
    {
      "layer": "5",
      "component": "ticket record state",
      "finding": "No verification of ticket data",
      "evidence": [
        {
          "source": "trace",
          "detail": "agent_trace shows no query_table calls"
        },
        {
          "source": "data",
          "detail": "No log_analysis output for ticket data"
        }
      ]
    },
    {
      "layer": "7",
      "component": "trigger wiring",
      "finding": "No inspection of trigger configuration",
      "evidence": [
        {
          "source": "trace",
          "detail": "agent_trace shows no agent_config calls for triggers"
        },
        {
          "source": "config",
          "detail": "No agent_config output for trigger parameters"
        }
      ]
    }
  ],
  "fixes": [
    {
      "target_type": "tool schema",
      "target": "set_ticket_priority tool's response validation logic",
      "current": "null value allowed for priority_stored",
      "proposed": "ensure priority_stored reflects the actual database value",
      "rationale": "The tool's response should confirm the stored priority matches the requested value to avoid ambiguity"
    },
    {
      "target_type": "configuration",
      "target": "agent_config calls for trigger wiring",
      "current": "",
      "proposed": "add agent_config call to inspect trigger parameters",
      "rationale": "Verify trigger configuration matches expected wiring"
    },
    {
      "target_type": "data",
      "target": "ticket record validation",
      "current": "",
      "proposed": "add query_table call to verify ticket state",
      "rationale": "Confirm ticket priority field matches expected value post-update"
    }
  ],
  "verification": "Re-run the agent execution with added query_table and agent_config calls, then verify priority_stored matches ticket record and trigger parameters are correctly configured",
  "data_markers": []
}
```

`fix_report_rejected.problems` / the run's `error` text, verbatim:

```
fix_report failed validation and could not be repaired: root_causes[1].evidence[1]: unsupported citation — cites "config" but this run never invoked a tool that reads it (agent_config, genai_log). Either call one of those tools and cite what it actually returned, or drop the claim. Tools invoked this run: agent_trace, schema_lookup, read_artifact.; root_causes[2].evidence[1]: unsupported citation — cites "data" but this run never invoked a tool that reads it (query_table, log_analysis). Either call one of those tools and cite what it actually returned, or drop the claim. Tools invoked this run: agent_trace, schema_lookup, read_artifact.; root_causes[3].evidence[1]: unsupported citation — cites "config" but this run never invoked a tool that reads it (agent_config, genai_log). Either call one of those tools and cite what it actually returned, or drop the claim. Tools invoked this run: agent_trace, schema_lookup, read_artifact.
```

---

## 4. This run's audit-trail measurements

Derived from `x_snc_troubleshoot_audit` (`action_type=result`) per §E1–§E2, independently
of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 2/7 (L1, L4) — mechanical §E2 map of the distinct tool set (`agent_trace`→L1, `schema_lookup`→L4, `read_artifact`→not a layer)
- **Tool-call count:** 3 result rows
- **Ordered tool-call list:**
  1. `agent_trace` (02:58:28) — args `{"execution":"45bbfd112ba6cf54f243fed2ce91bfcb"}`
  2. `read_artifact` (02:58:34) — args `{"artifact_id":"9698825d2bee475817a6ffbeee91bfd4","offset":4000}`
  3. `schema_lookup` (02:58:37) — args `incident.priority`
- **Distinct tool names:** 3 — `agent_trace`, `read_artifact`, `schema_lookup`
- **LLM-call count:** 6 (`actor: 'llm'` transcript entries — seq 1, 3, 5, 7, 9, 10)
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 on `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`): `agent_trace`, `agent_config`, `schema_lookup`, `query_table`, `genai_log`, `log_analysis`, `read_artifact` — all seven attached and active, `max_auto_executions = 10` on every one. Read before this run and re-read after the run set; no tool attachment changed.
- **Terminal state:** `x_snc_troubleshoot_run.status` = **`failed`**
- **Wall clock:** 22 s — 2026-08-06 02:58:25 → 02:58:47

This run's transcript carries one harness HOLD, recorded at seq 4 (actor `system`), verbatim:

```
HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 2, 3, 4, 5, 6, 7 declared NOT_SWEPT with no tool call behind them.
```

---

## 5. Notes specific to this run

- This run reached a terminal state (`failed`) and was not retried: the execution brief allowed retries only for runs that could not reach a terminal state.
- The harness's own post-generation validation gate rejected the `fix_report` after its repair attempts, so `fix_report` is `null` and the run terminated `failed`. The rejected report body and the verbatim rejection text are both in §3 above.
- The run's own `layers_swept` block agrees with the audit-derived swept set: layers 1 and 4 SWEPT; 2, 3, 5 and 7 NOT_SWEPT; 6 declared UNAVAILABLE.
