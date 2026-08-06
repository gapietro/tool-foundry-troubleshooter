# Design — Evidence-shortfall rejections return to the loop

**Date:** 2026-08-06 · **Issue:** [#81](https://github.com/gapietro/tool-foundry-troubleshooter/issues/81) ·
**Branch:** `fix/81-evidence-return-to-loop` · **Version at design time:** `2026.08.0505`

---

## 1. The problem, restated against current code

`PaAgentLoop._handleFixReport` allows exactly one repair turn, and that turn is a single
`PaLlmProxy.reason()` call with no tool access. When `PaFixReport.validate` rejects a report
because its *evidence* is insufficient, the model's only legal moves are to weaken the root cause,
switch to the `inconclusive` shape, or fabricate a citation. It cannot go and read another source.

The failure mode is current, not historical. In the v9 scored pass
(`benchmark/raw-evidence-v9-scored-pass.md` §3.4), two of six custom rows terminated `failed` on
exactly this:

| row | rejection |
|---|---|
| 07 | `root_causes[0] (sn_tsbench_bench_ticket table): evidence rule violation — evidence cites only the trace; at least one config, schema, or data citation is required.` |
| 08 | three × `unsupported citation — cites "config"/"data" but this run never invoked a tool that reads it … Tools invoked this run: agent_trace, schema_lookup, read_artifact.` |

`raw-evidence-v9-scored-pass.md:202`: *"Both rejections name an evidence/citation shortfall, and
both survived the harness's repair attempts."*

Issue option 3 — have the validator name the tool to call — **is already implemented**.
`_checkCitationSupported` emits *"Either call one of those tools and cite what it actually
returned, or drop the claim"* and lists the supporting tools by name. Row 08 received that text and
still failed. Naming the tool cannot help a turn that cannot call it.

### What changed since the issue was filed

`#103`'s depth gate already built the mechanism this fix needs. `PaAgentLoop._depthGate` converts a
terminal action into `{terminal:false}` with a system transcript note, a prompt-injected hold
block, and a `MAX_HOLDS` cap. `PaAgentLoop.js:564` names #81 as the thing the gate deliberately
sits upstream of. Routing evidence rejections back into the loop is therefore the *cheap* option
now, not the ambitious one.

---

## 2. Decision

**Split by problem class.** Evidence-shortfall rejections return to the main loop, where tools are
available and iterations remain. Shape rejections keep the existing tool-less repair turn, which
`#64`/`#65` established works for them.

Rejected alternatives:

- **Give the repair turn its own tools.** Self-contained, but duplicates the main loop's dispatch,
  bounds, audit and prompt-assembly logic for no benefit the loop does not already provide.
- **Repair-prompt guidance only** ("downgrade to UNCONFIRMED, or go inconclusive"). Concedes that
  an under-evidenced correct diagnosis is unrecoverable. `DECISION.md` §R6 also records a
  prompt-only fix being refuted by its own test on this same axis.
- **Route every rejection to the loop.** One code path, but spends a full iteration and prompt
  render on problems a cheap tool-less turn fixes reliably.

---

## 3. Control flow

`_handleFixReport` returns `_step`'s result shape — `{terminal:true, outcome}` or
`{terminal:false}` — so `PaAgentLoop.js:338` becomes:

```js
if (action.action === 'fix_report') {
    return this._handleFixReport(runId, action.report)
}
```

The handler itself:

```
_handleFixReport(runId, report)
  _evidenceBlock = null                       // re-derived per submission
  validated = validate(report, _auditContext(runId))
  if validated.valid  -> {terminal:true, outcome: _completeFixReport(...)}

  if validated.evidenceProblems.length > 0
     && _evidenceReturns < MAX_EVIDENCE_RETURNS
     && _hasEvidenceHeadroom():
        _evidenceReturns += 1
        _evidenceBlock = _evidenceReturnBlock(validated)
        _rejectedDraft = { report: report, problems: validated.problems }
        appendTranscript(runId, {actor:'system', result_digest: _evidenceNote(validated)})
        return {terminal:false}

  // shape problems, cap reached, or no headroom — TODAY'S PATH, UNCHANGED
  repairPrompt -> _llm().reason() -> validate2 -> complete | _finishFailedFixReport
```

**Worst case equals current behaviour by construction.** Every guard that fails falls through to
the existing repair turn with the same arguments it receives today.

### Why a separate `_evidenceBlock`, not `_holdActive`

`_holdActive` is owned by the depth gate's state machine: it is cleared when a held tool is
dispatched (`PaAgentLoop.js:299-301`, keyed off `_heldTools`) and when the gate releases
(`:330`). Reusing it would entangle two gates that hold on different things — sweep breadth
before validation, evidence quality after it. `_evidenceBlock` is a separate field rendered in
`_buildPrompt` alongside the hold slot, set on evidence return and cleared at the top of the next
`_handleFixReport`. The depth gate's fields are not touched by this change.

---

## 4. Problem classification

`validate()` returns `{valid:false, problems, evidenceProblems}`. `evidenceProblems` is a subset of
the *same strings* in `problems`, populated **at the push site** — never by string-matching the
messages afterwards. `problems` is unchanged in content and order, so `repairPrompt`,
`_finishFailedFixReport`, the transcript text and the audit trail are all untouched.

**The test:** can this problem be satisfied without either weakening the diagnosis or fabricating a
citation? If no, it is an evidence problem.

| Check | Class |
|---|---|
| `_checkEvidenceRule` — path B (absence, fewer than 2 distinct sources), the no-trace message, and the only-trace fall-through | **evidence** |
| `_checkCitationSupported` — unsupported citation | **evidence** |
| `_checkSweptClaims` — layer marked SWEPT with no tool behind it | **evidence** |
| `_checkUnconfirmed` — "cite at least one piece of evidence per layer you claim to have swept" | **evidence** |
| `_checkUnconfirmed` — `would_confirm` missing / not a layer number / names a SWEPT layer | shape |
| Everything else — missing `failure_summary`, unknown status, missing `reason`, bad enum, `layer` type, missing `component`/`finding`, `fixes`/`verification`/`data_markers` shape | shape |

`_checkSweptClaims` and the `_checkUnconfirmed` evidence entry are both also satisfiable by
downgrading a claim. They are classed as evidence because *calling the tool* is the better legal
move and only the loop can make it available; the downgrade remains available on the next
submission either way.

`_checkUnconfirmed`'s first three messages are shape because adding or correcting a `would_confirm`
string is a legal edit that neither weakens the diagnosis nor invents evidence — it names missing
evidence honestly, which is what the `#93` UNCONFIRMED path exists for.

---

## 5. State and bounds

| Member | Value | Notes |
|---|---|---|
| `MAX_EVIDENCE_RETURNS` | `2` | Matches `MAX_HOLDS`. Separate counter. |
| `EVIDENCE_HEADROOM_MS` | `30000` | Class member alongside `BUDGET_MS`, so a test can lower it. |
| `_evidenceReturns` | `0` | Reset in `_resetGate()`, next to `_holdCount`. |
| `_evidenceBlock` | `null` | Reset in `_resetGate()`; cleared per `_handleFixReport`. |
| `_rejectedDraft` | `null` | Reset in `_resetGate()`. See §7. |
| `_iteration`, `_startMs` | — | Stashed by `run()` so `_hasEvidenceHeadroom()` is checkable. |

**Separate counter, not shared with `_holdCount`.** A shared pool of two forced beats would give a
run that spent both on depth holds zero evidence returns — which is precisely rows 07 and 08, so a
shared budget would not have fixed the case that motivated the issue. Worst case is 2 depth holds +
2 evidence returns = 4 forced beats against `MAX_ITERATIONS` of 15; the deepest custom run in v9
used 6 iterations total.

**`_hasEvidenceHeadroom()`** requires both:

- `MAX_ITERATIONS - _iteration >= 2` — one iteration to call a tool, one to resubmit. Returning
  with a single iteration left guarantees `partial`.
- `BUDGET_MS - (_now() - _startMs) >= EVIDENCE_HEADROOM_MS` (30 000 ms against a 300 000 ms
  budget). Without the time check, a return with a second left immediately trips `run()`'s budget
  guard and downgrades a rejection into a `partial`.

**Not sticky, deliberately.** The depth gate freezes its gap set because re-deriving it lets the
goalposts move — close layer 4, declare layer 5, be held again. That does not apply here: the
evidence problems are a function of the submitted draft and the audit trail, so a model that
gathers the missing source genuinely clears them. The cap, not stickiness, is what bounds run
length.

---

## 6. What the model sees

Two channels, matching the depth gate's split:

**The prompt block** (`_evidenceReturnBlock`) carries the full text, injected by `_buildPrompt`:

```
## EVIDENCE SHORTFALL — your fix_report was not accepted

Your report is well-formed, but its evidence does not support it:

  - <each evidenceProblems entry, verbatim>

The run is not over. Tools are still available and the audit trail records what you
actually call. Before resubmitting: call a tool that reads the missing source and cite
what it returned, or state the claim at the strength your evidence supports.

Resubmit the fix_report when the evidence backs it.
```

Problems are quoted verbatim because `_checkCitationSupported` and `_checkSweptClaims` already name
the supporting tools and the tools invoked this run — that text is the actionable part. Note this
does **not** cross the boundary `DECISION.md` §R6 was burned for: it is the gate's own refusal
text, authored by the validator, not an edit to `agent-doctor-instructions.md` or to the shared
playbook.

**The transcript note** (`_evidenceNote`) must stay inside `PaRunManager.DIGEST_CHARS` (200) or it
is silently truncated — the defect class `#72`/§G3a exists to avoid:

```
EVIDENCE RETURN <n>/<MAX>: fix_report not accepted — <k> evidence problem(s); run continues.
```

---

## 7. Regression guard — the rejected draft must survive

Today rows 07 and 08 end `failed` with the draft attached, and
`benchmark/raw-evidence-v9-scored-pass.md` §3.4 states both were **scored from
`fix_report_rejected.report`**. A run that returns to the loop and then never resubmits rides to
`MAX_ITERATIONS` and lands in `_finishPartial`, which currently attaches no draft. Without a guard,
this change would blind the next scored pass on exactly the rows it is meant to fix.

`_finishPartial` therefore attaches `_rejectedDraft` when one was stashed:

```js
{ success, outcome: 'partial', reason, run_id,
  draft: _rejectedDraft.report,      // present only when an evidence return occurred
  problems: _rejectedDraft.problems }
```

The `INCOMPLETE:` transcript flag gains a clause naming the stashed draft so an analyst reading the
transcript sees the same thing the return value carries. Runs with no evidence return are
byte-identical to today.

---

## 8. Testing

`PaAgentLoop.test.js`:

- evidence-only rejection with headroom and budget → `{terminal:false}`, `_evidenceReturns` is 1,
  `_evidenceBlock` set, transcript note under 200 chars, **no** `reason()` call for a repair
- shape-only rejection → repair turn fires exactly as today, `_evidenceReturns` stays 0
- mixed evidence + shape rejection → returns to the loop (the model can fix both on resubmission)
- cap: third evidence rejection with `_evidenceReturns` at 2 → falls through to the repair turn
- headroom: `_iteration = MAX_ITERATIONS - 1` → falls through; elapsed within 30 s of `BUDGET_MS` →
  falls through
- `_evidenceBlock` reaches the next prompt via `_buildPrompt`, and is cleared on the next
  `_handleFixReport`
- an evidence return followed by no resubmission → `partial` carrying `draft` and `problems`
- `_resetGate()` clears all three new fields
- the depth gate's own behaviour is unchanged (existing tests must pass untouched)

`PaFixReport.test.js`:

- one case per row of §4's table asserting the problem lands in the right bucket
- `evidenceProblems` is always a subset of `problems`, and `problems` is unchanged in content and
  order from the current expectations
- a valid report returns no `evidenceProblems` key requirement (callers must tolerate absent/empty)
- `validate(null)` and other R-9 degradations still return `{valid:false, problems:[…]}` without
  throwing

---

## 9. Measurement

Per the scoping decision on this issue, **no scored pass**. `DECISION.md` §T9 asks for the rubric
fix before another scored round, and a score taken now would be confounded by the open rubric
clause.

What ships instead:

1. A pre-registered prediction section in `benchmark/DECISION.md` written **before** the smoke —
   stating what an evidence return should do to seeds 01 and 03, and what would refute it.
2. A targeted unscored smoke on gpinst01 against seeds 01 and 03 — the two that produced rows
   07/08 — recorded as a smoke, explicitly not as a pass, with `n`, seed and arm stated the way
   §H7-5's smoke block does.
3. The revert trigger stated up front: if evidence returns push runs to `outcome:'partial'` without
   producing a resubmission that clears the problems, the change costs a scored draft and buys
   nothing, and `MAX_EVIDENCE_RETURNS` drops to 0 rather than the code being kept and explained.

**This design does not claim the change improves diagnostic correctness.** §T3 records six custom
rows reaching layer 4 and concluding at layer 1; a run that gathers the missing citation may still
be diagnosing the wrong thing. The claim is narrower and falsifiable: a rejection that is fixable
only by reading another source stops being unfixable by construction.

---

## 10. Out of scope

- The rubric clause `DECISION.md` §T9 asks for — separate work, separate issue.
- The depth gate's release rule (§T4: it counts a call, not a reach) — a change to `_depthGate`,
  not to this path.
- `agent-doctor-instructions.md:48`'s standing contradiction with the contract block (§H7-5) —
  editing it moves the unmeasured native baseline.
- Any change to `repairPrompt` or `schemaText`. The contract text stays as it is on this branch, so
  the smoke has one variable in it.
