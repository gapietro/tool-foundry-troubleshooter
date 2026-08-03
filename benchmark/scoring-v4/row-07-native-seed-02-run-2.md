# Scoring packet — Row 07

**Seed:** 02 (ambiguous instruction) · **Harness:** native (Agent Doctor) · **Run:** 2

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

## 2. Seed specification (verbatim, `benchmark/seeds/seed-02-ambiguous-instruction.md`)

# Seed 02 — ambiguous instruction

| | |
|---|---|
| **Expected root-cause layer** | `instruction` (layer 2) |
| **Expected fix target** | the instruction text |
| **Fluent source** | `../seed-app/src/fluent/seed-02-ambiguous-instruction.now.ts` |
| **Agent name** | Seed 02 Request Router |
| **Also stresses** | — |

## The defect (v2, 2026-08-02)

"Assign it to the right group" defines neither "right" nor any means of
determining it. The agent's one tool, `measure_request`, returns the character
and word count of the request — it is deliberately incapable of resolving a
group, and the instructions name none. Whatever the agent does about the group
is therefore driven by the instruction alone: it must invent a group name or
stall.

> **Prediction, not yet measured.** With one tool bound the engine enters its
> loop, the model plausibly measures the request, and the instruction then
> forces the invent-or-stall behavior. The Phase 1b comparison re-run is what
> measures this — until then the v2 mechanism carries the same epistemic
> status the v1 mechanism carried before Task 12 refuted it.

**Do not give the tool group/routing/assignment vocabulary or capability** —
the sanctioned fix for this seed is "name the groups, or supply a lookup tool
and say to use it", so a tool that even hints at lookup either moves the defect
to layer 3 or makes the fix appear already applied.
`test/seed02Construction.test.js` (main repo) guards the construction.

> [Editorial note — scoring-isolation boundary: a "History" section originally
> here described a discarded v1 construction of this seed and stated a prior
> benchmark pass's score for two specific runs. It has been omitted from this
> packet because it references prior-pass scores, which must not reach a
> scorer of this pass. Nothing in the omitted section changed the "Expected
> root-cause layer" / "Expected fix target" / "Expected diagnosis" stated in
> this spec.]

## Why it is built this way

The instructions read as complete and confident — "be accurate," "confirm the
assignment" — while giving the agent no way to ground a group decision in
anything but its own invention. The one bound tool changes none of that:
nothing is broken in the tool (it works exactly as described) and nothing is
missing in data (none is involved). The failure lives entirely in what the
instructions ask for versus what they equip the agent to do.

## Setup

Install the fixture app: `cd benchmark/seed-app && now-sdk install --alias gpinst01`.
No data setup needed.

## Trigger

Open a fresh conversation with **Seed 02 Request Router** and give it a request
to route — e.g. *"my laptop will not boot"*. Capture the resulting
`sn_aia_execution_plan` sys_id.

## Expected diagnosis

Root cause in `instruction`: the instruction requires a determination the
agent has no means to make. Fix target: the instruction text — name the
groups, or supply a lookup tool and say to use it. A finding that
`measure_request` is irrelevant to routing is supporting evidence, not the
root cause — the tool does what it says; the instruction is what fails to
connect the agent to a groundable decision.

## Safety

No data touched.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by `../../test/blindRule.test.js` — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 02 Request Router
measure_request
```

---

## 3. This run's report

**Harness:** native (Agent Doctor, agent sys_id `e1392946828940e5a708fc51b0a5e954`, fresh conversation)
**Prompt sent (verbatim):** `Diagnose execution plan 4b315ecc2b66c314f243fed2ce91bfca.`
**This run's own identity:** Execution ID `bd0caa282be6cf14f243fed2ce91bf22`, conversation `a10caae42be6cf14f243fed2ce91bf89`
**Terminal state:** Completed
**Wall clock:** 96s
**Tool-call count (as reported when this run was fired):** 5 — `agent_trace` ×1, `read_artifact` ×4 (13 execution tasks total)

Full text of the Fix Report (the message the user/caller actually sees):

> ## Fix Report — Execution Plan `4b315ecc2b66c314f243fed2ce91bfca`
>
> ---
>
> ### FAILURE SUMMARY
>
> Execution plan `4b315ecc2b66c314f243fed2ce91bfca` was submitted with the
> objective **"my laptop will not boot"** against agent **Seed 02 Request
> Router** on 2026-08-02 06:23:48 UTC.
>
> **The execution did not fail.** It completed in 21 seconds with all 6
> tasks in status `success` and zero script errors. The agent called the
> `measure_request` tool once (365 ms, success), received character/word
> counts, then in a second LLM step routed the request to **"IT Support —
> Hardware & Endpoint"** and delivered the assignment summary to the user
> via `show_output_to_user`. The final outbound message status is
> `Delivered`. No root cause exists because no failure occurred.
>
> ---
>
> ### LAYERS SWEPT
>
> | Layer | Status | Notes |
> |-------|--------|-------|
> | 1. Execution trace | **SWEPT** | Full artifact read (4 pages, 15,850 chars); all read statuses `ok`, no field warnings, no script errors. |
> | 2. Instructions | **NOT SWEPT** | Trace shows no instruction-parse error, no unexpected model output, no early exit. No signal to justify the tool budget. |
> | 3. Tool definitions | **NOT SWEPT** | The one tool call (`measure_request`, binding `da3f01db9aec41da835887210ed4b902`) executed and returned correct output. No schema defect indicated. |
> | 4. Data schemas | **NOT SWEPT** | No blank field reads or schema warnings reported. No column mismatch to investigate. |
> | 5. Data | **NOT SWEPT** | Agent answered from tool output, not from a record lookup. No missing-record signal present. |
> | 6. GenAI stack | **NOT SWEPT** | Both Gen AI tasks completed successfully. No model-not-called or empty-response signal. To sweep this layer: call `genai_log` with `mode=for_execution` and `execution=4b315ecc2b66c314f243fed2ce91bfca`. |
> | 7. Trigger / wiring | **NOT SWEPT** | Conversation completed (state `Completed`, `TopicFinished` delivered). No trigger or wiring defect indicated. |
>
> > **Platform log layer (log_analysis):** Not attempted. On most instances
> > `syslog` is restricted to cross-scope callers and this tool reports the
> > layer as unavailable. An instance administrator can grant cross-scope
> > log access if platform-level entries (ACL denials, script errors
> > outside the execution scope) need to be checked. Given the trace is
> > fully clean, this is not blocking.
>
> ---
>
> ### ROOT CAUSES
>
> **None identified.**
>
> The execution plan reached state `Completed` with every task and tool
> call carrying status `success`. No error messages, no script stack
> traces, no latency flags, and no empty/denied reads were found in the
> trace.
>
> ---
>
> ### FIXES
>
> **None required.**
>
> ---
>
> ### VERIFICATION
>
> To confirm the run is genuinely healthy end-to-end, an operator may
> optionally run:
>
> - `genai_log` with `mode=for_execution`,
>   `execution=4b315ecc2b66c314f243fed2ce91bfca`
>   - **Expect:** Two LLM call rows, both status `success`, token counts
>     consistent with the observed `llm_token_avg` of 209.
>
> No configuration changes are needed before re-running the agent.
>
> ---
>
> ### DATA MARKERS
>
> The following user-supplied content appeared in the trace and should be
> **redacted** before this report crosses the instance boundary:
>
> - **User message text:** *(redacted — contained in `sn_aia_message`)*
> - **User profile email:** *(redacted — found in `sn_aia_message` sys_id
>   `07315ecc2b66c314f243fed2ce91bfd1`)*
> - **User sys_id:** *(redacted — found in user profile message)*
>
> All other quoted values are configuration identifiers (sys_ids, table
> names, field names) and carry no personal data.
>
> ---
>
> ### CONCLUSION
>
> The submitted execution plan ran to **successful completion**. If a
> problem was observed, it may be in a *different* execution plan, or in
> the downstream business outcome (e.g., the assigned group is incorrect)
> rather than in the agent execution itself. Supplying the correct failing
> execution plan sys_id, or describing the observed symptom in detail,
> would allow a targeted re-diagnosis.

---

## 4. This run's Task 10 audit-trail measurements

These were derived from `x_snc_troubleshoot_audit` (and, for native, the
`sn_aia_gen_ai_m2m` LLM-call linkage) independently of and before any Fix
Report was read for correctness. The audit trail can REFUTE a sweep claim in
the run's own report above, but never CONFER one.

- **`layers_swept` (audit-trail-derived): 1/7 (L1)**
- **Tool-call count:** 5
- **Tool-call order:** `agent_trace`, `read_artifact` ×4
- **LLM-call count:** 5
- **`layers_available`:** 7/7 — `agent_trace, agent_config, schema_lookup, query_table, genai_log, log_analysis, read_artifact`, all `active=true` on the agent record (re-queried directly from the instance for this measurement, not assumed)
- **Terminal state:** Completed
- **Wall clock:** 96s

No disagreement between this run's own LAYERS SWEPT table and the audit trail
was found (this run's own report also credits only L1 as SWEPT, consistent
with the audit trail).

**Anchor-record note.** This run's own `x_snc_troubleshoot_run` anchor row
(the observation-channel record used to derive the measurements above)
remained `status: running` and was never updated to a terminal state, despite
the underlying native execution reaching `Completed` as shown in Section 3.
This is a harness-observation-channel gap, not a scoring input.

## 5. Additional notes

No additional run-specific notes beyond the report and measurements above.
