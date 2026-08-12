/**
 * Scripted REST API — the custom harness's public surface (Phase 1b Task 7,
 * docs/superpowers/plans/2026-08-02-phase1b-harness.md; LOW_LEVEL_DESIGN.md
 * §4.8 wiring).
 *
 * GET  /api/x_snc_troubleshoot/v1/troubleshooter/tools
 * GET  /api/x_snc_troubleshoot/v1/troubleshooter/status
 * POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze
 * GET  /api/x_snc_troubleshoot/v1/troubleshooter/runs/{run_id}
 * POST /api/x_snc_troubleshoot/v1/troubleshooter/runs/{run_id}/message
 *
 * ALL FIVE ROUTE SCRIPTS ARE ONE-LINE DELEGATIONS TO PaRestHandlers.
 * Build Rule #43: escape sequences and backticks inside a Fluent `script`
 * template are consumed by TypeScript at build time and can corrupt or fail
 * the generated platform script in ways that surface far from their real
 * cause. Every handler's actual logic (validation, the owner gate, the
 * /status aggregation) lives in `src/server/rest/PaRestHandlers.js`
 * (`Now.include`d as a ScriptInclude in script-includes.now.ts) and is
 * unit-tested there with zero Glide (test/PaRestHandlers.test.js). Each
 * route script below does exactly three things: build `ctx` from
 * `request`/`gs.getUserID()`, call the matching PaRestHandlers method, write
 * `result.status`/`result.body` onto `response`. Nothing else belongs here.
 *
 * REST-API GOTCHAS FROM THE GOLDEN EXAMPLE (.claude/context/sdk-examples/
 * rest-api.now.ts, re-verified against this exact pattern in
 * scope-readability.now.ts): `versions[].version` is a NUMBER; every
 * `versions[]` and `routes[]` entry needs its own `$id`; every route needs
 * `version: <n>` linking it to a versions[] entry.
 */

import '@servicenow/sdk/global'
import { RestApi } from '@servicenow/sdk/core'

export const troubleshooterApi = RestApi({
    $id: Now.ID['troubleshooter-api'],
    name: 'Troubleshooter',
    active: true,
    serviceId: 'troubleshooter',
    shortDescription: 'The custom deep-diagnosis harness REST surface — analyze, poll, follow up, health-check',
    consumes: 'application/json',
    produces: 'application/json',

    versions: [
        {
            $id: Now.ID['troubleshooter-api-v1'],
            version: 1,
            active: true,
            isDefault: true,
            shortDescription: 'Initial version',
        },
    ],

    routes: [
        // POST /analyze
        {
            $id: Now.ID['troubleshooter-route-analyze'],
            version: 1,
            name: 'Analyze',
            path: '/analyze',
            method: 'POST',
            active: true,
            authentication: true,
            authorization: true,
            shortDescription:
                'Validates the diagnostic target, creates a run, and either runs the Evidence Bundle synchronously (mode:collect) or queues the async diagnosis worker',
            requestExample: '{"execution": "<sys_id>", "mode": "collect"}',
            script: script`(function process(request, response) {
    var body = request.body && request.body.data ? request.body.data : {};
    var ctx = { body: body, pathParams: request.pathParams, userId: gs.getUserID() };
    var handlers = new PaRestHandlers();
    handlers.emit(response, handlers.analyze(ctx));
})(request, response);`,
        },

        // GET /runs/{run_id}
        {
            $id: Now.ID['troubleshooter-route-get-run'],
            version: 1,
            name: 'Get Run',
            path: '/runs/{run_id}',
            method: 'GET',
            active: true,
            authentication: true,
            authorization: true,
            shortDescription:
                'Owner-only run status, transcript and fix_report (when complete) — a non-owner and a nonexistent run get the same 404',
            parameters: [
                {
                    $id: Now.ID['troubleshooter-param-get-run-id'],
                    name: 'run_id',
                    exampleValue: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
                    required: true,
                    shortDescription: 'sys_id of the x_snc_troubleshoot_run row',
                },
            ],
            script: script`(function process(request, response) {
    var ctx = { pathParams: request.pathParams, userId: gs.getUserID() };
    var handlers = new PaRestHandlers();
    handlers.emit(response, handlers.getRun(ctx));
})(request, response);`,
        },

        // POST /runs/{run_id}/message
        {
            $id: Now.ID['troubleshooter-route-message'],
            version: 1,
            name: 'Message',
            path: '/runs/{run_id}/message',
            method: 'POST',
            active: true,
            authentication: true,
            authorization: true,
            shortDescription:
                'Synchronous single-turn follow-up on a complete run; 409 naming the status on any other run state',
            requestExample: '{"message": "Which layer found the root cause?"}',
            parameters: [
                {
                    $id: Now.ID['troubleshooter-param-message-run-id'],
                    name: 'run_id',
                    exampleValue: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
                    required: true,
                    shortDescription: 'sys_id of the x_snc_troubleshoot_run row',
                },
            ],
            script: script`(function process(request, response) {
    var body = request.body && request.body.data ? request.body.data : {};
    var ctx = { body: body, pathParams: request.pathParams, userId: gs.getUserID() };
    var handlers = new PaRestHandlers();
    handlers.emit(response, handlers.message(ctx));
})(request, response);`,
        },

        // GET /status
        {
            $id: Now.ID['troubleshooter-route-status'],
            version: 1,
            name: 'Status',
            path: '/status',
            method: 'GET',
            active: true,
            authentication: true,
            authorization: true,
            shortDescription:
                'Deep readiness diagnostics: plugins, own skills (existence and activation), capability-provider mapping, a live micro-invocation, section-2 table readability, stuck-run count. ready is false when any check fails',
            script: script`(function process(request, response) {
    var handlers = new PaRestHandlers();
    handlers.emit(response, handlers.status());
})(request, response);`,
        },

        // GET /tools
        {
            $id: Now.ID['troubleshooter-route-tools'],
            version: 1,
            name: 'Tools',
            path: '/tools',
            method: 'GET',
            active: true,
            authentication: true,
            authorization: true,
            shortDescription: 'The diagnostic tool roster the custom harness reasons over — PaToolRegistry.list()',
            script: script`(function process(request, response) {
    var handlers = new PaRestHandlers();
    handlers.emit(response, handlers.tools());
})(request, response);`,
        },
    ],
})
