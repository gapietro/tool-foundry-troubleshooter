# Depth gate — design

**Issue:** #103
**Date:** 2026-08-03
**Branch:** `feature/depth-gate-agent-loop`
**Baseline:** v4 scored pass, app version `2026.08.0301` (DECISION.md §O)
**Status:** design approved, not yet implemented

---

## 1. The problem

`PaAgentLoop` loops only while the model emits `action: 'tool_call'` (`_step` returns
`{terminal:false}` at `:237` and `:252`). The model ends a run by emitting `answer` (`:241`) or
`fix_report` (`:245`). **Nothing gates that choice.** `MAX_ITERATIONS` (`:189`) is a ceiling, not a
floor — the file header's own "BOUNDS ARE A FLOOR" section names the R-3 lesson but the bounds it
describes only cap the top.

Measured on the v4 scored pass (DECISION.md §O4; per-row table at `benchmark/raw-evidence-v4.md:2582`):

- Custom swept **1/7 (L1) on all 20 rows** — every seed, every repetition. Native ranged 1/7 to 6/7
  on the same seeds, the same day, the same instance.
- §H8's acceptance test — one custom run reaching `schema_lookup`, `query_table` or `genai_log` on
  the seed that needs it — is **unmet across 45 runs**.
- **Four of seven tools have never been invoked by the custom harness in any run, ever.**
- `layers_available` measured 7/7 on every row, so nothing was depth-limited by what was attached.
  Budget is not the constraint either (§H5): the deepest run used 2 of 15 iterations and ~13s of a
  300s budget.

## 2. The diagnosis

**The reframing number is not "1 tool call" — it is "2 LLM calls."**

The v4 master table records LLM-call counts beside tool counts. Every custom row on seeds 01, 02 and
05 is 1 tool call / 2 LLM calls; seed 03 is 1/3 and seed 04 is 2/4, and in both cases the extra
calls are validation retries, not investigation. The real shape of a custom run is:

- **turn 1** — no evidence in hand. Emit `agent_trace`.
- **turn 2** — first sight of evidence. Emit the final report.

There is exactly **one** decision point after evidence exists, and it is taken inside the same
generation that first reads that evidence. Native on the same seeds gets 7–10 tool calls across
4–10 turns, and on seed 01 three of those were `read_artifact` re-pages of a trace it had already
fetched. Native's advantage on seed 01 was not more evidence. It was **more turns over the same
evidence**.

So "the model stops too early" is the wrong framing. The model is not cutting an investigation
short — **it never begins one.** The loop has no investigative state at all; its only state is
transcript length.

**The mechanism, as a property of the prompt rather than of the model.** Every `_buildPrompt()`
call, from turn 1, ends with `_responseContract()` (three actions, two of them terminal) followed by
`_fixReportContract()` — the largest, most specific, most structured block in the prompt. The
harness specifies the **deliverable** exhaustively and the **investigation** nowhere. Every gate it
has is dischargeable by writing:

- `NOT_SWEPT` plus a reason closes a layer for free;
- §H7-2 records that the zero-tool-call inconclusive exit is advertised in the first prompt;
- #93 added `UNCONFIRMED` + `would_confirm` as a further legal stop;
- §L6 states outright that every path-C rejection is repairable without tools.

The harness is a report generator with optional tool access, and it is being scored as an
investigator. The model is optimising correctly against what it was actually asked for.

## 3. The two constraints any fix must survive

**Constraint 1 — visibility is not the constraint, and neither is evidence access.** On seed 01
(§O6) the single `agent_trace` call returned `priority_stored: null` **verbatim** — the exact
discrepancy both native runs used as their primary evidence — and both custom reports concluded "no
errors were reported" with empty `root_causes`. Evidence in hand and unused is a different failure
from evidence not fetched.

This design explains it as follows: the model read a raw payload in the same generation in which it
had to emit a finished artifact, so it **summarised** rather than **interrogated**. "The execution
reported no errors" is a faithful summary of a trace whose entries all read success. Nothing in the
loop ever asks *what did this observation rule out, and what does it leave open* — native asked that
implicitly three times by re-paging the same artifact. This is a missing beat between observation
and conclusion: a control-flow defect, not an information defect, and no more-evidence fix reaches
it.

**Constraint 2 — pressure alone was tried and refuted (#88).** Raising the cost of stopping produced
fabrication, because a stop priced in text is paid in text, and the model controls the text. The
lesson is sharper than "avoid pressure":

- any gate must be dischargeable **only** by something the model cannot author — a row in the audit
  trail;
- enforcement must live **in the loop**, where "not yet" can still mean "loop again".

`PaFixReport.validate` is the wrong place by construction: it fires after the run is over, and #81
records that the repair turn cannot gather evidence, so a rejection there is not a path back into
the loop.

**A note on why this is one change and not two.** Both constraints are answered at the same point in
the code — `_step():240–246`, where a terminal action is honored. An interception must put something
into the next prompt, and the content of that something *is* the constraint-1 answer. Saying "you
have not swept enough, keep going" is #88; saying "what did that observation establish, what does it
leave open, which tool closes it" is the interrogation. The entry condition and the message are two
halves of one mechanism. This is not the §O5 Round B confound, where two variables moved the same
readout: here one change has two independent readouts (the audit trail for depth; the report text
against the answer key for reading), and the three possible outcomes are separable — see §7.

## 4. The mechanism

One interception in `_step()`, before `answer` and `fix_report` are honored.

**Hold when all of these hold:**

1. the trail is **not degraded** — see the `no_audit_rows` distinction below;
2. this run has not yet honored a hold (sticky — below);
3. the draft marks ≥ 1 layer `NOT_SWEPT` whose mapped tools are non-empty, and **none** of those
   tools appear in the trail.

**`no_audit_rows` is an answer, not a degradation.** `PaAuditLogger.invokedTools()` returns
`{available:false, degraded:<reason>}` for four distinct situations, and the gate must not treat
them alike:

| `degraded` | Meaning | Gate |
|---|---|---|
| `no_audit_rows` | the trail is readable and says **zero tools were invoked** | **hold** — this is the strongest possible gap |
| `glide_unavailable` / `query_failed` / `no_run_id` | the trail could not be read at all | **allow** — fail open |

Collapsing these would let the zero-tool-call inconclusive exit — which §H7-2 records as advertised
in the very first prompt, and which five of ten runs took in the §H5 pass — bypass the gate
completely, since a run that has invoked nothing has no audit rows. Failing open on a genuine
degradation is still correct and follows `PaAuditLogger`'s own header ("fails toward NOT checking,
never toward a false convict"): a Glide hiccup must never trap a run.

On hold: append a `system` transcript entry containing the interrogation (§5) and return
`{terminal:false}`. The loop re-enters with the enlarged transcript. `MAX_ITERATIONS` and
`BUDGET_MS` remain the backstop and are still checked first, so a hold can never outlive them.

**Sticky release.** At the first hold the loop records *the gap set the model itself named at that
moment* — concretely, the union of the tools `_layerToolMap()` maps those `NOT_SWEPT` layers to. The
gate releases permanently once `invokedTools()` reports any tool in that recorded union; it does
**not** re-derive gaps from later drafts. Without stickiness the goalposts move — the model closes L4, marks
L5 `NOT_SWEPT`, is held again — and every run rides to `partial`, since even native's best sweep was
6/7. With it, the gate buys exactly **one forced beat**, which is the size of the acceptance test.
Held on the loop instance; no schema change and no new column, since a run is one synchronous
invocation.

**`UNAVAILABLE` is never a gap.** That preserves seed 05's honest "nothing ever ran" exit, which #78
exists to protect.

**`answer`** carries no `layers_swept` and so declares no gap; it is held once with the same
interrogation plus a request for a layer report. No custom run took that exit in v4, so this is a
closed door rather than a hot path.

**Two facts that make this cheap.** `PaAuditLogger.invokedTools(runId)` (`:158`) already returns the
distinct tool names for a run and already fails open. `PaFixReport._layerToolMap()` (`:315`) already
maps all seven layers to their tools, and #79b already uses it to **refute** a `SWEPT` claim against
the trail. This is the mirror use of machinery that exists.

## 5. The interrogation

The held turn's `system` entry:

```
HOLD — a terminal action is not available yet.

Your draft marks these layers NOT_SWEPT, each with a reason you wrote:
  layer 4 (data schemas) — "<the model's own reason, quoted back>"
  layer 5 (data)         — "<...>"
The trail shows no tool call has reached any of them.

Before concluding:
  1. What did the last tool result actually establish? Quote the specific
     field or value you are relying on.
  2. What did it NOT settle? Of the layers above, name the one whose answer
     would most change your conclusion.
  3. Call a tool that reaches that layer.

Your draft is preserved. Once the trail shows you did, a terminal action is
available again and you may resubmit it unchanged.
```

Three properties, each load-bearing:

- **It names layers, never tools.** The layer names are the model's own `NOT_SWEPT` entries echoed
  back, and the tool roster is already in every prompt via `promptBlock()`. §H8 item 3 explicitly
  anticipated a mandated fix ("a required-sweep gate, forced tool selection") and kept the test
  unchanged — the test survives mandation only because of four words, *"on the seed that needs it."*
  A gate that named `schema_lookup`, `query_table` or `genai_log` would be teaching to the test and
  would make 45 runs of evidence unreadable. Enforced by test 10.
- **Item 1 is the missing beat.** It is the only part of the design aimed at constraint 1. Demanding
  a quoted field forces one generation whose job is reading rather than concluding.
- **It defers, it does not penalise.** #88 raised the cost of stopping and the model paid in the
  only currency it controls. Here the draft is explicitly preserved and resubmittable unchanged;
  there is no way to satisfy the hold by writing better. Stopping is not expensive — it is
  unavailable.

## 6. Files, and what must not be touched

| File | Change |
|---|---|
| `src/server/PaAgentLoop.js` | the gate in `_step()`, the hold-message builder, the recorded gap set |
| `src/server/PaFixReport.js` | read-only accessor over `_layerToolMap()` plus `unsweptGaps(report)`, so the loop does not hand-copy the map and drift from #79b's copy |
| `test/PaAgentLoop.test.js` | the tests in §7 |

**Untouched, deliberately:** `docs/agent/agent-doctor-instructions.md`, `src/fluent/agent-doctor.now.ts`
and `src/server/PaScriptToolAdapter.js`. Native does not move, so §K5 / §I4 confound 3 is not
reopened. §K5's pending `excerptPriority` propagation to native stays off this branch for the same
reason, even though the hold on it expired with the v4 pass — it is its own change and belongs to
its own measurement.

**`PaFixReport.schemaText()` does not change.** §H7-3 and §H7-5 record that the 0 → 1 → *n* sequence
sits on three different contracts and must not be read as a trend. Here the **turn-1 prompt is
byte-identical to v4's**: the gate is pure control flow, invisible until it fires. This would be the
first depth measurement in the project with exactly one variable behind it, and that property is
worth protecting against any temptation to "also just clarify" the contract while in the file.

## 7. Tests

Unit-level with injected collaborators, zero Glide — the pattern `test/PaAgentLoop.test.js` already
uses. Written before the implementation.

| # | Behavior |
|---|---|
| 1 | Draft with a `NOT_SWEPT` gap and no matching tool in the trail → `{terminal:false}`, `system` entry containing `HOLD` |
| 2 | `invokedTools()` degraded `glide_unavailable`/`query_failed`/`no_run_id` → **allowed** (fails open) |
| 2b | `invokedTools()` degraded `no_audit_rows` (zero tool calls) → **held** — the turn-1 inconclusive exit cannot bypass the gate |
| 3 | Every `NOT_SWEPT` layer's tools already invoked → allowed |
| 4 | All layers `SWEPT`/`UNAVAILABLE` → allowed |
| 5 | `UNAVAILABLE` is never a gap (seed-05 shape) |
| 6 | Sticky release: after one honored hold, a later draft with *new* gaps passes |
| 7 | Repeated terminal with no tool call → held against the *same* recorded set → rides to `MAX_ITERATIONS` → `partial` with the `INCOMPLETE` entry |
| 8 | `answer` held once |
| 9 | Bounds are still checked first — a hold cannot outlive them |
| 10 | **Guard:** the hold message never contains `schema_lookup`, `query_table` or `genai_log` |

Test 10 makes the anti-teaching-to-the-test constraint mechanical rather than a promise, in the same
spirit as the existing `awaiting_confirmation` guard.

## 8. The smoke, and the predictions

**Six runs, unscored:** seeds 01, 03 and 04, two runs each. Those three hide their answers behind
`schema_lookup`, `query_table` and `genai_log` respectively (§H5) — the tools with zero invocations
across 45 runs. A 20-row scored pass is **not** in scope: §H8's acceptance test is a depth test
measured from the trail, and it does not need one.

Depth measured from the audit trail only, never from the report's self-claim — §N7's asymmetry
(the trail can refute a layer credit but never confer one). Recorded per run: tool count, tool
order, distinct tools, audit-derived layer sweep, LLM calls, terminal state, hold count. For seed 01
additionally, the constraint-1 readout: **does the report use `priority_stored: null`?**, judged
against the known answer key.

Two protocol notes. The inbound request bodies are recorded by hand in the evidence file, because
#99 means the harness cannot recover them afterwards. There are no scorer packets in an unscored
smoke, so #100 does not bind here.

**Predictions, filed on issue #103 before a single run:**

| | Prediction | Confidence |
|---|---|---|
| P1 | The hold fires on ≥ 5 of 6 runs | High — all 10 v4 custom rows meet the hold condition retrospectively |
| P2 | **≥ 1 run reaches `schema_lookup`, `query_table` or `genai_log` on the seed that needs it — §H8's test MET** | Moderate. The headline |
| P3 | Median tool calls rises from 1 to ≥ 2 | High |
| P4 | 1–2 runs ride to `partial` (the refusal tail) | Moderate |
| P5 | Seed 01 still misses `priority_stored: null` on ≥ 1 of its 2 runs — depth moving further than reading | Moderate |
| P6 | Unsupported-sweep-claim rate does **not** rise above v4's ~1/10 | High. The #88 regression check |
| P7 | Compliance concentrates on `agent_config` (§10) | Moderate |

**The refusal tail is counted, not special-cased.** A run that will not take its own named next step
rides the bounds to `MAX_ITERATIONS` and returns `outcome: 'partial'` with no fix_report, scoring 0
on every column. That is deliberate: it makes refusal maximally visible, adds no code, and is
pre-registered as P4 so a rise in zero-rows is an expected and informative result rather than
something explained after the fact.

**Falsification, stated in advance.**

- All six ride to `partial` → the model will not act under a hold; the gate is a denial-of-service,
  not a lever. Revert.
- Fabrication rises (P6 fails) → #88 in a new costume. Revert.
- Holds fire and gaps close, but the three tools are never reached → the gate mandates depth without
  directing it. The mechanism is refuted **as specified**, and the next iteration works on direction
  rather than on force.

## 9. Reading the result

Three outcomes, separable because the change has two independent readouts:

| Result | Reading |
|---|---|
| depth up **and** seed 01's discriminant used | the mechanism works |
| depth up, seed 01 still misread | the gate fires; the interrogation does not improve reading |
| depth flat | the gate is not firing, or the model discharges it in text (= #88 again) |

## 10. Known tilt, accepted deliberately

`_layerToolMap()` gives `agent_config` three layers (2, 3, 7) in a single call, while L4 is reachable
only by `schema_lookup` and L5 only by `query_table` / `log_analysis`. The cheapest way to satisfy
the gate is therefore one `agent_config` call, and the mechanism carries a **built-in tilt away from
the very tools the acceptance test measures.** This is the most likely route to a deeper 0/10, and
it originates in the map, not in the gate.

Accepted sticky-once and pre-registered as P7 rather than engineered around, for two reasons. A
non-sticky release would push toward a full sweep but would ride nearly every run to `partial`. And
enforcing against the layer the model *names* in item 2 requires parsing free text — brittle, and a
second variable. If P7 comes true, the trail says so plainly and the finding is clean and directive:
*the gate mandates depth but does not direct it.*

## 11. What this cannot establish

- Six unscored runs, three seeds, one instance, one day. **No claim about gate passes** and no claim
  about a rate — §H8 asks for one run reaching one tool, and one hit is a hit, not a frequency.
- Whether depth converts to score is a v5 scored pass against the v4 baseline. This smoke's job is
  to decide whether that pass is worth firing.
- Nothing here bears on seed 02, where all four v4 runs across both harnesses independently
  concluded "no failure observed" (§O6). That is either a true negative about the fixture or a
  shared blind spot in a trace-first method, and the record deliberately does not rule. Seed 02 is
  excluded from the smoke for that reason.
- The change does not address #81 (the repair turn cannot gather evidence), #99 (the inbound request
  is not persisted) or #100 (scorer-packet blindness). Those remain open and are unaffected.
