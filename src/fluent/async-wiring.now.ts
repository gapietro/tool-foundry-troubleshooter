/**
 * Async wiring for the custom harness (Phase 1b Task 7,
 * docs/superpowers/plans/2026-08-02-phase1b-harness.md;
 * LOW_LEVEL_DESIGN.md §4.8).
 *
 * Three pieces:
 *   1. The `x_snc_troubleshoot.run.start` event registration (`sysevent_
 *      register` via `Record()` — there is no dedicated Fluent plugin for
 *      it, per the SDK's "Registering Events Guide"). Registered BEFORE
 *      anything fires it: `PaRestHandlers._defaultEventQueue` (Task 7,
 *      `POST /analyze` in diagnose mode) calls `gs.eventQueue()` against
 *      this exact name, and per the guide firing an unregistered event in a
 *      scoped app fails silently — so this record has to exist for
 *      `/analyze` to actually queue anything.
 *   2. The `ScriptAction` that listens for it and drives the diagnosis:
 *      `new PaAgentLoop().run(event.parm1, event.parm2)` — `parm1` is the
 *      run_id, `parm2` the JSON-stringified diagnostic request, exactly as
 *      queued. INLINE, not `Now.include`d, and that is deliberate: a
 *      `Now.include`d module is run through the build's platform-API
 *      linter, which flags the bare identifier `event` as the browser DOM
 *      global ("Unexpected use of 'event' ... Web APIs are not supported",
 *      `no-restricted-globals`, TS307) even though `event` is the
 *      platform-documented ScriptAction global (`node_modules/@servicenow/
 *      sdk/docs/api/scriptaction-api.md`) — build-verified 2026-08-02. The
 *      inline form is exempt from that same-module lint pass. Three lines,
 *      no backtick, no escape sequence, so Build Rule #43's hazards do not
 *      apply here regardless.
 *   3. The daily `ScheduledScript` that runs the §D5 stale-native sweep —
 *      `PaRunManager.sweepStaleNative({})` — body in
 *      `src/server/async/sweep-stale-runs.js` (no `event`/`current` global
 *      reference, so `Now.include` works cleanly here).
 *
 * `x_snc_troubleshoot.run.start` is 27 characters — comfortably inside the
 * guide's 40-character `event_name` ceiling (values past it are silently
 * truncated, which would break every listener bound to the full name).
 */

import '@servicenow/sdk/global'
import { Record, ScriptAction, ScheduledScript } from '@servicenow/sdk/core'
// Duration is a GLOBAL — do NOT import it.

// ---------------------------------------------------------------------------
// 1. Event registration
// ---------------------------------------------------------------------------
export const runStartEvent = Record({
    $id: Now.ID['run-start-event'],
    table: 'sysevent_register',
    data: {
        suffix: 'run.start',
        event_name: 'x_snc_troubleshoot.run.start',
        description: 'Fired by POST /analyze (diagnose mode) to queue the async ReAct worker for one diagnostic run',
        table: 'x_snc_troubleshoot_run',
        fired_by: 'PaRestHandlers.analyze (REST route: POST /api/x_snc_troubleshoot/troubleshooter/analyze)',
        priority: 100,
    },
})

// ---------------------------------------------------------------------------
// 2. ScriptAction — the async ReAct worker
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// DEFERRED: PaRunManager.maybeSummarize(runId) is NOT hooked in here.
//
// The natural hook is BETWEEN PaAgentLoop's reasoning iterations — summarize
// once, keep the newest few verbatim, before the transcript feeds the next
// prompt. But `run(runId, request)` is a single synchronous call from this
// ScriptAction's point of view: there is no seam between iterations for
// glue code sitting OUTSIDE PaAgentLoop to hook into without modifying
// `_step()`/`run()` itself, which Task 7 is explicitly forbidden from doing
// (PaAgentLoop is review-approved, Tasks 1-6). Calling maybeSummarize()
// BEFORE `run()` is a no-op (nothing written yet this call) and calling it
// AFTER is too late (the whole diagnosis, and its transcript, is already
// finished by the time the ScriptAction gets control back).
//
// Deferring is also empirically safe for Phase 1b's bound: MAX_ITERATIONS
// is 15, each iteration appends at most two transcript entries (llm + tool,
// or llm + system), each digested to <=200 chars (PaRunManager.DIGEST_CHARS)
// — worst case ~15 * 2 * 200 = 6,000 characters, well inside the `transcript`
// column's 65,536-char ceiling (tables.now.ts). Live-verified on gpinst01
// (Task 7, Step 4): three real diagnose runs against the Task 12 smoke
// specimen produced 7 transcript entries each. The unbounded-growth risk
// the brief names is real across MANY runs accumulating on one row, which
// does not happen here (`createRun` always manufactures a fresh row,
// PaRunAnchor.js header) — it is a single-run risk, and the single-run
// bound already caps it. Revisit if MAX_ITERATIONS grows, or wire the hook
// inside PaAgentLoop itself in a future task.
// ---------------------------------------------------------------------------

export const runStartWorker = ScriptAction({
    $id: Now.ID['run-start-worker'],
    name: 'Troubleshooter Run Start Worker',
    active: true,
    description:
        'Drives one diagnostic run to completion: new PaAgentLoop().run(event.parm1, event.parm2) where parm1 is the run_id and parm2 is the JSON-stringified diagnostic request',
    eventName: 'x_snc_troubleshoot.run.start',
    order: 100,
    // Inline, not Now.include'd — see the file header's note on why the
    // platform-documented `event` global fails the module linter when
    // pulled in through Now.include. No backtick, no escape sequence.
    script: script`(function () {
    var runId = event.parm1;
    var requestJson = event.parm2;
    new PaAgentLoop().run(runId, requestJson);
})();`,
})

// ---------------------------------------------------------------------------
// 3. ScheduledScript — the §D5 stale-native-run sweep
// ---------------------------------------------------------------------------
export const staleRunSweep = ScheduledScript({
    $id: Now.ID['stale-run-sweep'],
    name: 'Troubleshooter Stale Native Run Sweep',
    active: true,
    // ScheduledScript has no `description` field (build-verified) — the
    // rationale lives in the file header and PaRunManager.sweepStaleNative's
    // own header instead.
    frequency: 'daily',
    executionTime: { hours: 3, minutes: 0, seconds: 0 },
    script: Now.include('../server/async/sweep-stale-runs.js'),
})
