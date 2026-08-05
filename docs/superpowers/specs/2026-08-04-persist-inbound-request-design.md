# Persist the inbound request payload — design

**Issue:** #99
**Date:** 2026-08-04
**Branch:** `fix/persist-inbound-request`
**Baseline:** app version `2026.08.0401` (DECISION.md §P)
**Status:** design approved, not yet implemented

---

## 1. The problem

`x_snc_troubleshoot_run` has **no column for the inbound request**. The `POST /analyze` body is
never written anywhere on the instance. What survives a run is only what the model *derived* from
the request — tool arguments in `x_snc_troubleshoot_audit.input` — not the request itself.

This is absent by construction, not a truncation miss:

- `PaRestHandlers.analyze()` (`src/server/rest/PaRestHandlers.js:142`) reads the body, validates it,
  and passes exactly three fields to `createRun` — `agent`, `execution`, `mode`. `timeframe`,
  `logs` and `description` are dropped on the floor.
- `_queueDiagnose` (`:240`) stringifies the whole body — but only to hand to `gs.eventQueue`, and
  the event payload is not retained.
- `PaRunManager._normalizeEntry` writes `prompt_digest` only onto `actor:'tool'` transcript entries,
  derived from that entry's own tool output. So the request text could never have been in
  `prompt_digest`, at any digest window, for any run.

Found during the v4 scored pass (#98), Task 4, while trying to recover seed 05's exact v3 request
body. It was recovered from a prior plan's scratch file with two corroborating signals, and the
provenance caveat recorded in `benchmark/raw-evidence-v4.md`. That worked by luck of an artifact
that was never meant to be load-bearing.

## 2. Why it matters

A benchmark run's **diagnostic subject is part of its identity**. Without it:

- a later pass cannot prove it asked the same question as an earlier one — exactly the v3↔v4
  comparison Task 4 needed;
- seed 05 is the acute case (no execution plan exists by design, so its request is a composed
  `agent`+`timeframe`+`description` body rather than a sys_id), but this applies to **every seed**;
- reproducing a run from its own record is impossible — you must have kept the request outside the
  system.

The v5 depth smoke (#103) worked around this by recording all six request bodies **before** firing.
That is a manual step every future measurement pass inherits until this is fixed.

## 3. Data flow

```
POST /analyze
  route script  →  ctx.body = request.body.data      (unchanged)
  analyze()     →  _validateAnalyze(body)            (unchanged — a 400 creates no run)
                →  createRun({agent, executionRef, mode, request: body})   ← the one new param
                     ├─ _anchor().getOrCreate(...)   (unchanged — PaRunAnchor untouched)
                     └─ one _writeUpdate: {status:'queued', request, request_truncated}
                →  _runCollect(...)  or  _queueDiagnose(...)    (both already covered)
```

The write lands in the update `createRun` **already performs** to force `status:'queued'`
(`PaRunManager.js:244`), so this adds fields to an existing write rather than a second one.
`PaRunAnchor` and `PaAgentLoop` are not touched.

Writing at `createRun` rather than worker-side is what makes `mode:'collect'` covered: `_runCollect`
never queues an event, so a write in `PaAgentLoop.run()` would miss it entirely.

### 3.1 Alternatives considered and rejected

**The normalized request (`PaAgentLoop._normRequest`'s output) instead of the raw body.** Rejected:
the issue asks *what was sent*, and `_normRequest`'s output is one transform removed from it —
`{description: "..."}` has already lost whether the request arrived as JSON or free-form text. The
raw body is reconstructible into the normalized shape by replaying the function; the reverse is not
true. The counter-argument is real and recorded: persisting `_normRequest`'s output would make a
recurrence of #77's Java-string coercion bug visible in the record. That is a different question
(what the loop *saw*) than the one #99 asks, and conflating them in one column serves neither.

**Both, in one envelope column.** Rejected as YAGNI at this cost — see the paragraph above for the
one thing it would buy, which no current work needs.

**`request.body.dataString` for byte-exact fidelity.** Rejected: it would preserve whitespace and
key order, costs a route-script edit inside a Fluent `script` template (Build Rule #43 territory),
and buys nothing for the actual question. A re-serialization of the parsed body is semantically
identical and arguably more comparable across passes. Both forms preserve every key, including ones
the validator ignores; the only difference is formatting.

## 4. Schema

Two columns on `x_snc_troubleshoot_run` (`src/fluent/tables.now.ts`), placed next to
`agent`/`execution_ref` — this is the run's *subject*, not its output:

```ts
request: MultiLineTextColumn({ label: 'Request', maxLength: 65536 }),
request_truncated: BooleanColumn({ label: 'Request Truncated', default: false }),
```

`BooleanColumn` and `MultiLineTextColumn` are both already imported in that file.

**Two flat columns rather than a JSON envelope.** An envelope would have to hold the body as an
escaped *string* — a clipped body is not parseable JSON, so `{body: <object>}` cannot represent the
truncated case — and JSON-escaping a log paste can nearly double its length against a fixed column
ceiling, making the effective limit unpredictable. Two flat columns make the ceiling the column size
directly.

## 5. Truncation contract

Serialize the body, then clip at a named ceiling **below** the column's 65536 and set
`request_truncated: true` when clipping occurred. Never let `setValue` clip silently — that is
`PaArtifactStore`'s R-10 ("degrade explicitly, never silently") restated for this column, and
silent clipping is the precise failure shape #91 was filed about.

Three states, all distinguishable from the row alone:

| `request` | `request_truncated` | Means |
|---|---|---|
| non-empty | `false` | whole body; `JSON.parse` is valid |
| non-empty | `true` | a prefix; documentation, not data — do not parse |
| empty | `false` | absent — a native run, or a body that would not serialize |

A `_safeStringify` failure writes empty and leaves the flag false: **absent, not truncated.** The
two must not collapse into one state.

The ceiling is a named constant on `PaRunManager` — `REQUEST_CHARS: 60000` — derived from the
column's 65536 with headroom rather than independently guessed, the same way `STUCK_RUN_BUDGET_MS`
is derived from `BUDGET_MS`. The column holds the JSON text directly, so no escaping expansion
sits between the constant and the column limit; the 5,536-char margin is slack against a future
column-size change being made without this constant being revisited, not against escaping.

## 6. Read surface

`getRun` (`PaRestHandlers.js:262`) gains a top-level `request` and a sibling `request_truncated`,
mirroring the existing `fix_report` / `fix_report_rejected` sibling idiom in the same method.
Parsed when whole; the raw prefix string when truncated.

Persisting without exposing would reproduce the #78 shape — the data is in the row, and every API
consumer still has to read the table by hand.

## 7. What this deliberately does not do

- **Native runs get nothing.** `PaRunAnchor.getOrCreate` keys on `_agentic_context_`; there is no
  inbound body on that path. The column stays empty for `harness:'native'`, and empty is the honest
  value, not a gap to fill later.
- **Direct in-process callers of `PaAgentLoop.run()` are not covered.** Accepted tradeoff of
  writing at `createRun`. Every production and benchmark path goes through REST.
- **No redaction or scrubbing.** The body already reaches the model verbatim inside the prompt
  (`_buildPrompt`/`_renderRequest`), so persisting it opens no channel that was not already open. A
  scorer reading it is reading the run's subject, which is what a scorer needs — this is not a
  blind-rule leak in the #89/#100 sense, which concern the seeded *answer*, not the *question*.
- **No backfill.** Existing runs stay empty. Their requests are not recoverable, which is the
  finding this issue records rather than a defect this change can repair.

## 8. Testing

Jest against the existing `_glideStub`; no instance needed until build + install.

`test/PaRunManager.test.js`:
- the request is persisted on create, verbatim, for a body passed as an object
- an oversize body is clipped at the ceiling **and** `request_truncated` is set
- a body at exactly the ceiling is not marked truncated (boundary)
- an unserializable body leaves `request` empty and `request_truncated` false
- `createRun` with no `request` param behaves exactly as before (R-9: every input may be absent)
- the anchor path is unchanged — `getOrCreate` receives the same argument shape as today

`test/PaRestHandlers.test.js`:
- the validated body reaches `createRun` for `mode:'diagnose'`
- the validated body reaches `createRun` for `mode:'collect'`
- a 400 from `_validateAnalyze` still creates no run
- `getRun` returns `request` parsed when whole, and the raw prefix plus the flag when truncated

## 9. Acceptance

A `POST /analyze` on gpinst01 followed by a `GET /runs/{run_id}` returns the same body that was
sent, and the row read through the Table API carries it too. Verified live, not inferred from the
stub — R-8 ("a stub is not evidence about platform behaviour") applies to the column write the same
way it applied to the attachment surface.

## 10. Related

- #99 (this issue), #98 (v4 scored pass, Task 4 — where it was found)
- `benchmark/raw-evidence-v4.md`, "Seed 05 request body recovery (Task 4)"
- `benchmark/DECISION.md` §O8 (the queue), §P (v5 depth smoke — the manual pre-capture workaround)
- Build Rules #41, #42 (the `Table()` defects this schema already accounts for)
