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
