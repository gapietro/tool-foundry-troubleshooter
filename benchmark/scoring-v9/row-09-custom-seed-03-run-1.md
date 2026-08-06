# Scoring packet — Row 09

**Seed:** 03 · **Harness arm:** custom (`x_snc_troubleshoot`, `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`) · **Run:** 1

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

**Harness arm:** custom (`x_snc_troubleshoot`, `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`)  
**Request body sent (verbatim):** `{"execution": "3afbf1192baa475817a6ffbeee91bf10", "mode": "diagnose"}`  
**POST response:** `{"run_id": "522986d12beacf54f243fed2ce91bfa7", "status": "queued"}`  
**This run's own identity:** run_id (`x_snc_troubleshoot_run` sys_id) `522986d12beacf54f243fed2ce91bfa7` (`TR1000164`), `conversation_ref` `custom-1-1785985256397-989778566`  
**Execution under diagnosis:** `sn_aia_execution_plan` `3afbf1192baa475817a6ffbeee91bf10`  
**Terminal state:** `x_snc_troubleshoot_run.status` = **`complete`**; `error` empty; `fix_report` present and validated by the harness at seq 8 (`fix_report validated`)  
**Wall clock:** 19 s — 2026-08-06 03:00:56 → 03:01:15  
**Tool-call count:** 2

The run's `fix_report`, verbatim, as returned by the harness.

```json
{
  "failure_summary": "The agent execution for routing a Hardware request failed because the lookup_routing_rule tool found 0 rules in the table, indicating no matching routing rules were available for the 'Hardware' category.",
  "layers_swept": {
    "1": {
      "status": "SWEPT",
      "reason": "agent_trace provided execution details including tool call results"
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
      "reason": "schema_lookup confirmed 'assignment_group' exists on incident table"
    },
    "5": {
      "status": "NOT_SWEPT",
      "reason": "No query_table call made to verify routing rules data"
    },
    "6": {
      "status": "NOT_SWEPT",
      "reason": "No genai_log call made to inspect LLM interactions"
    },
    "7": {
      "status": "NOT_SWEPT",
      "reason": "No agent_config call made to inspect trigger wiring"
    }
  },
  "root_causes": [
    {
      "layer": "1",
      "component": "lookup_routing_rule tool call",
      "finding": "0 rules found in routing table for 'Hardware' category",
      "evidence": [
        {
          "source": "trace",
          "detail": "tool_call response: 'rules_in_table':0"
        },
        {
          "source": "trace",
          "detail": "execution_plan state: completed with objective unfulfilled"
        }
      ],
      "confidence": "UNCONFIRMED",
      "would_confirm": "layer 5 — query_table against routing rules table to verify data existence"
    }
  ],
  "fixes": [
    {
      "target_type": "configuration",
      "target": "lookup_routing_rule tool binding",
      "current": "unknown routing rules data source",
      "proposed": "validate routing rules table contains entries for 'Hardware' category",
      "rationale": "The tool found 0 rules, indicating missing or misconfigured routing data"
    }
  ],
  "verification": "Re-run the agent and verify the tool call returns >0 rules_in_table for 'Hardware' category",
  "data_markers": []
}
```

---

## 4. This run's audit-trail measurements

Derived from `x_snc_troubleshoot_audit` (`action_type=result`) per §E1–§E2, independently
of the report text — never inferred from the report's own prose.

- **`layers_swept` (audit-trail-derived):** 2/7 (L1, L4) — mechanical §E2 map of the distinct tool set (`agent_trace`→L1, `schema_lookup`→L4)
- **Tool-call count:** 2 result rows
- **Ordered tool-call list:**
  1. `agent_trace` (03:01:05) — args `{"execution":"3afbf1192baa475817a6ffbeee91bf10"}`
  2. `schema_lookup` (03:01:11) — args `incident.assignment_group`
- **Distinct tool names:** 2 — `agent_trace`, `schema_lookup`
- **LLM-call count:** 4 (`actor: 'llm'` transcript entries — seq 1, 3, 5, 7)
- **`layers_available`:** **7/7 (L1–L7)** — read per §E3 on `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`): `agent_trace`, `agent_config`, `schema_lookup`, `query_table`, `genai_log`, `log_analysis`, `read_artifact` — all seven attached and active, `max_auto_executions = 10` on every one. Read before this run and re-read after the run set; no tool attachment changed.
- **Terminal state:** `x_snc_troubleshoot_run.status` = **`complete`**; `error` empty; `fix_report` present and validated by the harness at seq 8 (`fix_report validated`)
- **Wall clock:** 19 s — 2026-08-06 03:00:56 → 03:01:15

This run's transcript carries one harness HOLD, recorded at seq 4 (actor `system`), verbatim:

```
HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 2, 4, 5, 7 declared NOT_SWEPT with no tool call behind them.
```

---

## 5. Notes specific to this run

- The run's own `layers_swept` block agrees with the audit-derived swept set: layers 1 and 4 SWEPT; 2, 3, 5, 6 and 7 NOT_SWEPT.
