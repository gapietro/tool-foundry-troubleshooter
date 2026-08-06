# Scoring packet — Row 01

**Seed:** 01 · **Harness arm:** native (Agent Doctor, `servicenow_aia_execute`) · **Run:** 1

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
Diagnose the failing AI Agent execution with plan sys_id 4a5bb19d2b66cf54f243fed2ce91bf57. Sweep all seven layers and produce a Fix Report with root causes, evidence citations, and proposed fixes.
```

**This run's own identity:** run_id (`sn_aia_execution_plan` sys_id) `961d7d9d2baa475817a6ffbeee91bf2a`, `conversation_ref` `0e1d3d9d2baa475817a6ffbeee91bfef`  
**Execution under diagnosis:** `sn_aia_execution_plan` `4a5bb19d2b66cf54f243fed2ce91bf57`  
**Terminal state:** `sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty  
**Wall clock:** 5 m 25 s (325 s) — 2026-08-06 02:08:14 → 02:13:39  
**Tool-call count:** 18

`sn_aia_message` sys_id `8c4e3d952bea475817a6ffbeee91bfa1`, `role` = `agent`, created 2026-08-06 02:13:16 — the last agent row carrying the Fix Report.

# Fix Report — Seed 01 Ticket Prioritizer

**Execution plan:** `4a5bb19d2b66cf54f243fed2ce91bf57`  
**Agent:** Seed 01 Ticket Prioritizer  
**Run date:** 2026-08-06 02:00:34 → 02:01:54 (78 s)

---

## FAILURE SUMMARY

The user asked the agent to set the priority of a bench ticket to match the urgency of a total payment-gateway outage. The agent correctly reasoned through steps 1–3 (priority = "critical"), called `set_ticket_priority` with the ticket sys_id and `priority="critical"`, and received `ok:true`. However, **the priority was never actually stored**: `priority_stored` came back `null`. The root cause is a **type mismatch**: the `priority` column on `x_snc_tsbench_ticket` is declared as **Integer**, and GlideRecord silently discards a non-numeric string on an Integer field — `update()` returns success, the readback yields null, and the agent had no mechanism to detect the silent failure. The agent displayed a confident audit report to the user while the ticket's priority remained unchanged.

A secondary problem: the first ReAct turn timed out with `Error: Invalid next entry for scratchpad` before recovering (~30 s delay), caused by instruction bloat. A trigger-wiring gap means the agent cannot be invoked automatically.

---

## LAYERS SWEPT

| Layer | Status | Notes |
|---|---|---|
| 1 — Execution trace | **SWEPT** | `agent_trace` on plan `4a5bb19d2b66cf54f243fed2ce91bf57` |
| 2 — Instructions | **SWEPT** | `agent_config` section `instructions` |
| 3 — Tool definitions | **SWEPT** | `agent_config` section `tools`; full script body read |
| 4 — Data schemas | **SWEPT** | `schema_lookup` on `x_snc_tsbench_ticket.priority` |
| 5 — Data | **SWEPT** | `query_table` on `x_snc_tsbench_ticket` and `incident` |
| 6 — GenAI stack | **SWEPT** | `genai_log` mode `for_execution`; 3 LLM calls, 0 errors, capability wired correctly |
| 7 — Trigger and wiring | **SWEPT** | `agent_config` section `triggers`; finding raised |
| Platform logs | **UNAVAILABLE** | `syslog` is caller-restricted. An instance administrator must relax `caller_access` on `syslog` or export logs from a permitted scope. This layer was **not** reported as clean. |

---

## ROOT CAUSES

### RC-1 — Integer field rejects string priority value — **CONFIRMED**

| Attribute | Detail |
|---|---|
| **Layer** | 4 — Data schema + 3 — Tool definition |
| **Component** | `x_snc_tsbench_ticket.priority`; tool script on `sn_aia_tool` |
| **Finding** | The `priority` column is typed **Integer** (`type: "Integer"`, `has_choices: false`). The tool script calls `gr.setValue('priority', inputs.priority)` where `inputs.priority` is the string `"critical"`. GlideRecord silently discards the non-numeric string; `update()` still returns success. The post-update readback returns `null`, surfacing as `priority_stored: null` in the tool response. |
| **Evidence** | • `schema_lookup x_snc_tsbench_ticket.priority` → `type: "Integer"`, `has_choices: false` (layer 4) <br>• `query_table x_snc_tsbench_ticket` → row exists, `priority: ""` (blank after write) (layer 5) <br>• Tool response: `{"ok":true, "priority_requested":"critical", "priority_stored":null}` from tool-call record (layer 1) <br>• Tool script body: `gr.setValue('priority', inputs.priority)` — no word-to-integer mapping (layer 3) |
| **Confidence** | **CONFIRMED** — corroborated across layers 1, 3, 4, and 5 |

---

### RC-2 — Both tool inputs declared non-mandatory — **CONFIRMED**

| Attribute | Detail |
|---|---|
| **Layer** | 3 — Tool definition |
| **Component** | `sn_aia_agent_tool_m2m` binding (tool `set_ticket_priority`), field `inputs` |
| **Finding** | Both `ticket` and `priority` are declared `"mandatory": false`. If the model omits either input, the script silently dereferences `undefined` and returns a misleading error rather than a platform-level refusal. |
| **Evidence** | `agent_config` tools section binding inputs: `[{"name":"ticket","mandatory":false},{"name":"priority","mandatory":false}]` |
| **Confidence** | **CONFIRMED** |

---

### RC-3 — No trigger wiring — **CONFIRMED**

| Attribute | Detail |
|---|---|
| **Layer** | 7 — Trigger and wiring |
| **Component** | `sn_aia_trigger_agent_usecase_m2m` for this agent |
| **Finding** | Zero trigger links on both the agent-direct branch and the team/use-case chain. All reads returned `empty` (not `DENIED`), confirming real absence. The agent cannot be invoked by any automated trigger. |
| **Evidence** | `agent_config` triggers section: `branches: {agent_direct:0, team_usecase_chain:0}`, wiring finding `no_trigger_wiring` severity `high` |
| **Confidence** | **CONFIRMED** |

---

### RC-4 — ReAct parser error / instruction bloat — **CONFIRMED** (recovered)

| Attribute | Detail |
|---|---|
| **Layer** | 1 — Execution trace + 6 — GenAI stack |
| **Component** | Gen AI task (order 100), AIA ReAct Engine |
| **Finding** | First ReAct turn emitted `"Error: Invalid next entry for scratchpad"` and took 30,873 ms (threshold 15,000 ms). Run recovered on turn 2 (4,079 ms). Cause: verbose multi-step instructions are reprocessed on every turn, inflating token volume and raising malformed-output probability. |
| **Evidence** | Task output_digest: `"Error: Invalid next entry for scratchpad"` (layer 1) <br>• Latency flags: `instruction_bloat` on two Gen AI tasks (30,873 ms and 20,598 ms) <br>• Plan header: `llm_p95_latency: 29,846 ms` <br>• GenAI log: 3 LLM calls, 0 provider errors (layer 6 — eliminates provider fault) |
| **Confidence** | **CONFIRMED** |

---

## FIXES

### Fix 1 — Map priority words to integers in the tool script *(addresses RC-1)*

| | |
|---|---|
| **Target type** | Tool script |
| **Target** | `sn_aia_tool` (set_ticket_priority), field `script` |
| **Current** | `gr.setValue('priority', inputs.priority);` — passes the raw string to an Integer field |
| **Proposed** | Add a word-to-integer mapping before `setValue`: |

javascript
var PRIORITY_MAP = { critical:1, high:2, moderate:3, low:4, planning:5 };
var priorityInt = PRIORITY_MAP[(inputs.priority || '').toLowerCase()];
if (priorityInt === undefined) {
    return JSON.stringify({
        ok: false,
        error: 'unrecognised priority word: ' + inputs.priority +
               '. Must be one of: critical, high, moderate, low, planning.'
    });
}
gr.setValue('priority', priorityInt);


Also update the readback return to confirm both forms:
javascript
return JSON.stringify({
    ok: true, ticket: inputs.ticket,
    priority_requested: inputs.priority,
    priority_stored_int: check.getValue('priority'),
    priority_stored_word: inputs.priority
});


| **Rationale** | The Integer column stores 1–5. The model correctly passes the word. The script must bridge the gap without changing the column type, which is used by platform UI and business rules. |

---

### Fix 1-alt — Change `priority` column type to String with choices *(alternative)*

| | |
|---|---|
| **Target type** | Data schema |
| **Target** | `sys_dictionary` row for `x_snc_tsbench_ticket.priority`, field `internal_type` |
| **Current** | `Integer` |
| **Proposed** | Change to `String`/`choice` and add the five word values, or add a separate `priority_label` String column |
| **Rationale** | Eliminates the type mismatch entirely. Choose Fix 1 (script mapping) if other scripts depend on the Integer column. |

---

### Fix 2 — Mark both inputs as mandatory *(addresses RC-2)*

| | |
|---|---|
| **Target type** | Tool input schema |
| **Target** | `sn_aia_agent_tool_m2m` binding (set_ticket_priority), field `inputs` |
| **Current** | `[{"name":"ticket","mandatory":false},{"name":"priority","mandatory":false}]` |
| **Proposed** | `[{"name":"ticket","mandatory":true},{"name":"priority","mandatory":true}]` |
| **Rationale** | Platform refuses the call before the script runs when a mandatory input is absent, surfacing a clear error to the LLM rather than a silent null dereference. |

---

### Fix 3 — Wire a trigger to the agent *(addresses RC-3)*

| | |
|---|---|
| **Target type** | Wiring |
| **Target** | `sn_aia_trigger_agent_usecase_m2m` — create a row linking this agent to an appropriate trigger |
| **Current** | 0 trigger links |
| **Proposed** | Create at least one trigger link in the AI Agent designer (Virtual Agent topic, record-producer, or workflow — builder must choose based on intended deployment channel). |
| **Rationale** | Without a trigger the agent is unreachable except through direct interactive invocation. |

---

### Fix 4 — Reduce instruction length *(addresses RC-4)*

| | |
|---|---|
| **Target type** | Instruction |
| **Target** | `sn_aia_agent` (Seed 01 Ticket Prioritizer), field `instructions` |
| **Current** | Six verbose steps with full working required; reprocessed on every ReAct turn |
| **Proposed** | Condense to essential decision logic (steps 1–4 inline; steps 5–6 as concise output directives). Move reference/lookup data to KB articles retrieved on demand. Target < 800 tokens. |
| **Rationale** | The trace shows LLM p95 latency of 29,846 ms and two instruction-bloat flags. Shorter instructions reduce both cost and the probability of the `Invalid next entry for scratchpad` parser error. |

---

## VERIFICATION

**Verify Fix 1 (priority write)**
1. Replay the same objective interactively.
2. Confirm `priority_stored_int` in the tool response equals `1` (for "critical").
3. Query `x_snc_tsbench_ticket` directly and confirm `priority = 1`.

**Verify Fix 2 (mandatory inputs)**
1. Submit a call omitting `priority`.
2. Confirm the platform returns a binding-level error before the script executes.

**Verify Fix 3 (trigger wiring)**
1. Run `agent_config` section `triggers` after wiring.
2. Confirm `branches.agent_direct ≥ 1` or `team_usecase_chain ≥ 1`.

**Verify Fix 4 (instruction bloat)**
1. Re-run an equivalent execution and confirm `llm_p95_latency < 15,000 ms`.
2. Confirm no `instruction_bloat` latency flags in the trace.

---

## DATA MARKERS

The following record data was quoted as evidence and should be redacted before this report leaves the instance:

- Ticket sys_id: `464bb9152baa475817a6ffbeee91bfa9` (appears in tool request/response and message stream)
- User email: `admin@example.com` (appears in user profile message)
- User sys_id: `6816f79cc0a8016401c5a33be04be441` (appears in conversation sender field)
- Conversation sys_id: `d55b319d2b66cf54f243fed2ce91bf89`
References: null

### Trailing closing summary (not the Fix Report; the agent's closing message, reproduced for completeness)

Source: `sn_aia_message` sys_id `d55ef5d52bea475817a6ffbeee91bf0c`, `role` = `agent`, 02:13:37.

```
Agent Doctor completed a full seven-layer diagnostic sweep of execution plan 4a5bb19d2b66cf54f243fed2ce91bf57 (Seed 01 Ticket Prioritizer). 

Layers swept: 1 (agent_trace), 2 (agent_config instructions), 3 (agent_config tools + full script), 4 (schema_lookup on x_snc_tsbench_ticket.priority), 5 (query_table on x_snc_tsbench_ticket and incident), 6 (genai_log for_execution), 7 (agent_config triggers). Platform logs (syslog) were UNAVAILABLE due to caller restriction — reported as a gap, not as clean.

Four confirmed root causes were identified and reported:
- RC-1 (PRIMARY): The tool script passes the string 'critical' to an Integer column (x_snc_tsbench_ticket.priority). GlideRecord silently discards it; update() returns success but priority_stored comes back null. The priority was never written. Confirmed across layers 1, 3, 4, and 5.
- RC-2: Both tool inputs (ticket, priority) are declared non-mandatory, allowing silent null dereferences if either is omitted.
- RC-3: No trigger wiring exists on either branch; the agent cannot be invoked automatically.
- RC-4: Instruction bloat caused a ReAct parser error (30,873 ms, threshold 15,000 ms) on the first LLM turn; the run recovered but added ~30 s of latency.

Four fixes were proposed: (1) add a word-to-integer mapping in the tool script, (2) mark both inputs mandatory, (3) wire at least one trigger, (4) condense instructions to under 800 tokens. Verification steps and data markers for redaction were also provided. The Fix Report was shown to the user.
```

---

## 4. This run's audit-trail measurements

Derived from `x_snc_troubleshoot_audit` (`action_type=result`) per §E1–§E2, independently
of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 7/7 (L1, L2, L3, L4, L5, L6, L7) — mechanical §E2 map of the distinct tool set
- **Tool-call count:** 18 result rows
- **Ordered tool-call list:**
  1. `agent_trace` (02:08:25)
  2. `read_artifact` (02:08:37)
  3. `read_artifact` (02:08:37)
  4. `read_artifact` (02:08:37)
  5. `read_artifact` (02:08:37)
  6. `read_artifact` (02:09:04)
  7. `query_table` (02:09:04)
  8. `agent_config` (02:09:05)
  9. `genai_log` (02:09:05)
  10. `read_artifact` (02:09:34)
  11. `read_artifact` (02:09:34)
  12. `log_analysis` (02:09:34)
  13. `agent_config` (02:09:34)
  14. `read_artifact` (02:10:10)
  15. `read_artifact` (02:10:10)
  16. `agent_config` (02:10:11)
  17. `query_table` (02:10:38)
  18. `schema_lookup` (02:10:38)
- **Distinct tool names:** 7 — `agent_trace`, `read_artifact`, `query_table`, `agent_config`, `genai_log`, `log_analysis`, `schema_lookup`
- **LLM-call count:** 9 (`sn_aia_execution_task` `type=gen_ai`; also `tool` 18, `agent` 1, `access_verification` 1, `communicator` 1)
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 on `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`): `agent_trace`, `agent_config`, `schema_lookup`, `query_table`, `genai_log`, `log_analysis`, `read_artifact` — all seven attached and active, `max_auto_executions = 10` on every one. Read before this run and re-read after the run set; no tool attachment changed.
- **Terminal state:** `sn_aia_execution_plan.state` = **`completed`**, `state_reason` empty
- **Wall clock:** 5 m 25 s (325 s) — 2026-08-06 02:08:14 → 02:13:39

---

## 5. Notes specific to this run

- The MCP invocation returned before the run finished (`State: in_progress` at 0 s, exceeding the 120 s window and moving to background). The terminal state recorded above was read by polling this run's own `sn_aia_execution_plan` record.
- This run's `x_snc_troubleshoot_run` anchor record was left at `status: running` even after the agent execution reached `completed`. The terminal state above is read from the execution plan, not from the anchor.
- The report's claim that `syslog` is caller-restricted and the platform-log layer is UNAVAILABLE is the run's own prose. It was not independently verified by the operator; it is reproduced as written.
