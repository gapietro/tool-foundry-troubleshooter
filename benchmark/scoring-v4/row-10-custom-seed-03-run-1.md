# Scoring packet — Row 10

**Seed:** 03 (missing data) · **Harness:** custom (`x_snc_troubleshoot`) · **Run:** 1

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

**Harness:** custom (`x_snc_troubleshoot`)
**Body sent (verbatim):** `{"execution": "c4cd01842b6a4bd417a6ffbeee91bfc3", "mode": "diagnose"}`
**This run's own identity:** Run ID `56ed26242b2acf14f243fed2ce91bf16` (`TR1000126`)
**Terminal state:** complete
**Wall clock:** ~19s
**Tool-call count:** 1 (`agent_trace`)

Full `fix_report`:

```json
{
  "failure_summary": "The AI Agent execution for routing a hardware request (monitor replacement) completed successfully but did not match any routing rules. The tool call to 'lookup_routing_rule' returned 0 rules in the table, indicating a potential misconfiguration or missing rules for the 'Hardware' category.",
  "layers_swept": {
    "1": {"status": "SWEPT", "reason": "agent_trace provided execution details and tool call results"},
    "2": {"status": "NOT_SWEPT", "reason": "Instructions were not explicitly requested; focus remained on execution trace and tool output"},
    "3": {"status": "NOT_SWEPT", "reason": "Tool definitions were not inspected due to trace indicating a data gap (0 rules found)"},
    "4": {"status": "NOT_SWEPT", "reason": "Schema lookup not performed as the issue appeared data-related (missing rules)"},
    "5": {"status": "NOT_SWEPT", "reason": "Data existence not verified due to trace indicating rules were absent"},
    "6": {"status": "NOT_SWEPT", "reason": "GenAI stack not inspected as the failure occurred in the tool layer"},
    "7": {"status": "NOT_SWEPT", "reason": "Trigger wiring not analyzed as the root cause appeared in tool execution"}
  },
  "root_causes": [
    {
      "layer": "1",
      "component": "lookup_routing_rule tool call",
      "finding": "No routing rules found for the 'Hardware' category",
      "evidence": [
        {"source": "trace", "detail": "Tool response: 'rules_in_table': 0"},
        {"source": "trace", "detail": "Execution status: Success but no valid route identified"}
      ],
      "confidence": "UNCONFIRMED",
      "would_confirm": "layer 4 — schema_lookup to verify routing rule schema requirements"
    }
  ],
  "fixes": [
    {
      "target_type": "tool schema",
      "target": "lookup_routing_rule tool configuration",
      "current": "No rules defined for 'Hardware' category",
      "proposed": "Add routing rules for 'Hardware' category (e.g., monitor replacement)",
      "rationale": "The tool found 0 rules, indicating a missing configuration to handle hardware requests"
    }
  ],
  "verification": "Re-run the agent and verify the tool call returns matched rules with a non-zero 'rules_in_table' value",
  "data_markers": []
}
```

**Report shape.** This run's `fix_report` carries a populated-`root_causes`
shape: one entry, `confidence: "UNCONFIRMED"`, a non-empty `fixes` array, a
non-empty `verification` string, and no `inconclusive` key.

---

## 4. This run's Task 10 audit-trail measurements

These were derived from `x_snc_troubleshoot_audit` independently of and
before any Fix Report was read for correctness.

- **`layers_swept` (audit-trail-derived): 1/7 (L1)**
- **Tool-call count:** 1
- **Tool-call order:** `agent_trace`
- **LLM-call count:** 3
- **`layers_available`:** 7/7 — `agent_trace, agent_config, schema_lookup, query_table, genai_log, log_analysis, read_artifact`. The custom harness does not resolve its tool roster through `sn_aia_agent_tool_m2m`; its `GET /tools` endpoint returns `PaToolRegistry.list()` verbatim, a hardcoded registry of exactly these 7 keys with no active/enabled flag to filter on — every registered entry is unconditionally listed. This is a direct read of the registry map itself, not an assumption that the two harnesses share one underlying config.
- **Terminal state:** complete
- **Wall clock:** ~19s

## 5. Additional notes

No additional run-specific notes beyond the report and measurements above.
