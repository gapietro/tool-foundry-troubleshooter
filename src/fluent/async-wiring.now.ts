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
 *      `new PaAgentLoop().run(event.parm1, requestJson)` where `requestJson`
 *      is `String(event.parm2)` guarded against null/undefined — `parm1` is
 *      the run_id, passed through UNCOERCED so `PaAgentLoop.run`'s own
 *      `_str()` guard (null-safe, and correctly converts a Rhino Java
 *      String) can fail fast on a missing run id instead of being handed the
 *      literal string `"null"`. `parm2` is the JSON-stringified diagnostic
 *      request; it still needs an explicit `String()` — the platform
 *      delivers it as a Rhino Java String, not a JS string (issue #77) — but
 *      only when it is actually present, so a missing `parm2` yields `''`
 *      (which `_normRequest` correctly turns into `{}`) rather than the
 *      string `"null"` (which `_normRequest` would JSON-parse into a
 *      fabricated `{description: "null"}`). INLINE, not `Now.include`d, and
 *      that is deliberate: a
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
import { Record, ScriptAction, ScheduledScript, Property } from '@servicenow/sdk/core'
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
        fired_by: 'PaRestHandlers.analyze (REST route: POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze)',
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
// Deferring is also empirically safe for Phase 1b's bound, RE-DERIVED
// 2026-08-02 for issue #72's prompt-facing digest, and RE-DERIVED AGAIN in
// final review the same day once PROMPT_DIGEST_CHARS moved from 4,000 to
// 8,500 (the 4,000 value was sized against the bare read_artifact page;
// final review found the digest actually runs over the JSON-stringified
// dispatch envelope, whose escaping can nearly double a page's length, so
// the ceiling was raised to 8,500 to guarantee one full page survives
// regardless of content — see PaRunManager.js's PROMPT_DIGEST_CHARS comment
// for the full account). MAX_ITERATIONS is 15 and each iteration appends at
// most two transcript entries (llm + tool, or llm + system). Every entry
// still carries a <=200-char result_digest (PaRunManager.DIGEST_CHARS), so
// the baseline is ~30 entries * ~400-600 chars including args and JSON
// overhead = ~12,800. On top of that, at most PROMPT_WINDOW (3) tool
// entries retain a prompt_digest of up to PROMPT_DIGEST_CHARS (8,500) =
// 25,500. Worst case ~38,300 characters against the transcript column's
// 65,536-char ceiling (tables.now.ts) — roughly 1.7x headroom (down from
// the ~2x the old 4,000-char ceiling gave, but still comfortable) — and
// asserted by the "T6 row-size bound" test in test/PaRunManager.test.js
// (measured 38,340 chars against that test's synthetic worst case) so this
// paragraph cannot go stale silently again. Live-verified on gpinst01
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
        'Drives one diagnostic run to completion: new PaAgentLoop().run(event.parm1, requestJson) where parm1 is the run_id (passed uncoerced so run()._str() can fail fast on a missing id) and requestJson is event.parm2 coerced with String() only when present, so a missing parm2 yields empty string rather than the literal "null"',
    eventName: 'x_snc_troubleshoot.run.start',
    order: 100,
    // Inline, not Now.include'd — see the file header's note on why the
    // platform-documented `event` global fails the module linter when
    // pulled in through Now.include. No backtick, no escape sequence.
    script: script`(function () {
    var requestJson = '';
    if (event.parm2 !== null && event.parm2 !== undefined) {
        requestJson = String(event.parm2);
    }
    new PaAgentLoop().run(event.parm1, requestJson);
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

// ---------------------------------------------------------------------------
// 4. Artifact retention — the data-at-rest lifecycle (issue #216)
// ---------------------------------------------------------------------------
//
// `PaToolQueryTable` returns rows from arbitrary customer tables and
// `PaArtifactStore` persists the oversized ones as attachments on the run
// record. Nothing ever removed them: the two jobs above are a run-start worker
// and a status sweep that deletes nothing, so customer data accumulated in the
// instance indefinitely. The PRD's "no customer data ever leaves the platform"
// is about EGRESS and stays true — retention is a separate obligation, and a
// diagnostic tool with no stated lifecycle cannot be handed to a customer.
//
// The window is a PROPERTY rather than a constant because it is exactly the
// kind of thing a customer's own policy dictates, and changing it must not
// require a redeploy. `PaRetentionSweep` reads it at sweep time.
//
// WHY 30 DAYS AS THE SHIPPED DEFAULT: long enough that a diagnosis stays
// reviewable well past the incident that prompted it, short enough that the
// data does not become a liability nobody remembers agreeing to. It is a
// starting point for a conversation with a customer, not a claim about their
// obligations.
export const retentionDaysProperty = Property({
    $id: Now.ID['retention-days-property'],
    name: 'x_snc_troubleshoot.retention_days',
    type: 'integer',
    value: 30,
    description:
        'Days to keep diagnostic run ARTIFACTS (the sys_attachment excerpts of tool output, which may contain customer table data) before the daily purge deletes them. Run records themselves are never deleted by this job. Clear the value to fall back to 30 days. A value that is not a positive whole number DISABLES the purge entirely and logs a warning - deleting on a misconfiguration is the one direction that cannot be undone.',
})

// Runs at 03:30, half an hour after the stale-run sweep, so the two nightly
// jobs do not contend and their log lines stay readable in order.
export const artifactRetentionPurge = ScheduledScript({
    $id: Now.ID['artifact-retention-purge'],
    name: 'Troubleshooter Artifact Retention Purge',
    active: true,
    // As above, ScheduledScript has no `description` field — the rationale is
    // in this comment, in `purge-artifacts.js`, and in PaRetentionSweep's header.
    frequency: 'daily',
    executionTime: { hours: 3, minutes: 30, seconds: 0 },
    script: Now.include('../server/async/purge-artifacts.js'),
})
