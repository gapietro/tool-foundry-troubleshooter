/**
 * Scope readability check — the `/status`-equivalent from LOW_LEVEL_DESIGN.md §6.
 *
 * LLD §6 order of operations: "install scoped app -> run /status-equivalent
 * readability check (§3 cross-scope) -> create Agent Doctor records".
 * This is that check.
 *
 * WHY IT EXISTS
 * Phase 0's P4 closed the STATIC half of the cross-scope question (no §2 table is
 * access=none, none carries a restrictive caller_access except syslog) but left the
 * RUNTIME half carried forward: the disposable probe tool landed in Global scope, so
 * its successful reads proved nothing about a restricted x_* application scope. See
 * docs/PREFLIGHT_FINDINGS.md P4 and DESIGN.md R-1.
 *
 * This endpoint runs inside x_snc_troubleshoot, so its results ARE the runtime answer:
 * every tool core in LLD §4 will read these same tables from this same scope.
 *
 * GET /api/x_snc_troubleshoot/scope_probe/reads
 *
 * Returns, per table: ok (readable, rows present) | empty (readable, no rows) |
 * denied (read blocked) | error (with the message). The three are deliberately
 * distinguished - LLD §4 requires that "every empty/denied read is an explicit
 * finding, never a silent nothing", and Phase 0 was bitten twice by treating an
 * empty result as absence.
 *
 * Read-only. Uses GlideRecordSecure so it measures what the tool cores will
 * actually experience, not what an unrestricted GlideRecord could reach.
 */

import '@servicenow/sdk/global'
import { RestApi } from '@servicenow/sdk/core'

export const scopeProbeApi = RestApi({
    $id: Now.ID['scope-probe-api'],
    name: 'Scope Readability Probe',
    active: true,
    serviceId: 'scope_probe',
    shortDescription: 'Cross-scope readability check for the Agent Doctor tool cores',
    consumes: 'application/json',
    produces: 'application/json',

    versions: [
        {
            $id: Now.ID['scope-probe-v1'],
            version: 1,
            active: true,
            isDefault: true,
            shortDescription: 'Initial version',
        },
    ],

    routes: [
        {
            $id: Now.ID['scope-probe-reads'],
            version: 1,
            name: 'Table Reads',
            path: '/reads',
            method: 'GET',
            active: true,
            authentication: true,
            authorization: true,
            shortDescription: 'Attempts a GlideRecordSecure read of every LLD section 2 table',
            script: script`(function process(request, response) {
    var TABLES = [
        'sn_aia_execution_plan',
        'sn_aia_execution_task',
        'sn_aia_tools_execution',
        'sn_aia_message',
        'sn_aia_agent',
        'sn_aia_tool',
        'sn_aia_agent_tool_m2m',
        'sn_aia_usecase',
        'sn_aia_trigger_configuration',
        'sys_gen_ai_log_metadata',
        'sys_generative_ai_log',
        'syslog',
        'sys_cs_conversation',
        'sys_db_object',
        'sys_dictionary'
    ];

    var out = { scope: 'x_snc_troubleshoot', reads: {}, summary: {} };
    var counts = { ok: 0, empty: 0, denied: 0, error: 0 };

    try { out.currentScope = gs.getCurrentScopeName(); } catch (e) { out.currentScope = 'unavailable'; }
    try { out.user = gs.getUserName(); } catch (e) { out.user = 'unavailable'; }

    for (var i = 0; i < TABLES.length; i++) {
        var t = TABLES[i];
        try {
            var gr = new GlideRecordSecure(t);
            gr.setLimit(1);
            gr.query();
            if (gr.next()) {
                out.reads[t] = 'ok';
                counts.ok++;
            } else {
                // Readable but no rows, OR readable-but-every-row-filtered. These are
                // NOT the same as denied, and must not be reported as absence.
                out.reads[t] = 'empty';
                counts.empty++;
            }
        } catch (e) {
            // DO NOT touch the exception object. A cross-scope denial throws
            // ScopeAccessNotGrantedException, and reading .message off it throws a
            // SECOND time - "Illegal access to getter method getMessage" - which
            // escapes this handler and 500s the whole endpoint. Learned the hard way
            // on 2026-07-30: the first version of this probe did exactly that and
            // returned no per-table detail at all.
            out.reads[t] = 'DENIED';
            counts.denied++;
        }
    }

    out.summary = counts;
    out.verdict = (counts.denied === 0 && counts.error === 0)
        ? 'scoped_read_viable: CONFIRMED at runtime'
        : 'scoped_read_viable: BLOCKED - see per-table detail';

    response.setStatus(200);
    response.setContentType('application/json');
    response.getStreamWriter().writeString(JSON.stringify(out));
})(request, response);`,
        },

        // -------------------------------------------------------------------
        // TEMPORARY — remove or role-gate when the Task 9 adapter lands.
        //
        // A Script Include cannot be driven from MCP: Phase 0 established there
        // is no background-script executor in the Foundry MCP toolset (DESIGN.md
        // R-1). Until PaScriptToolAdapter and the Agent Doctor AiAgent exist
        // (IMPLEMENTATION_PLAN.md Tasks 9-10), this route is the only way to
        // execute PaToolAgentTrace against real sn_aia_* rows and verify it
        // reads what it claims to read.
        //
        // Read-only: it calls execute(), which only ever issues GlideRecordSecure
        // reads. It is still an authenticated, authorized endpoint that returns
        // execution-trace content, so it does not survive past Task 9.
        // -------------------------------------------------------------------
        {
            $id: Now.ID['scope-probe-trace'],
            version: 1,
            name: 'Agent Trace Probe',
            path: '/trace',
            method: 'POST',
            active: true,
            authentication: true,
            authorization: true,
            shortDescription: 'TEMPORARY verification harness for PaToolAgentTrace - remove at Task 9',
            script: script`(function process(request, response) {
    var out;

    try {
        // Accept a JSON body, query params, or nothing at all. R-9: every
        // declared input may be absent, and a call with no arguments must
        // still return something useful rather than an error.
        var args = {};

        try {
            if (request.body && request.body.data) {
                args = request.body.data;
            }
        } catch (bodyErr) {
            args = {};
        }

        try {
            var qp = request.queryParams || {};
            var names = ['execution', 'agent', 'since', 'step', 'detail'];
            for (var i = 0; i < names.length; i++) {
                var n = names[i];
                if (args[n] !== undefined && args[n] !== null && args[n] !== '') continue;
                var v = qp[n];
                if (v === undefined || v === null) continue;
                // Scoped REST hands query params back as arrays.
                args[n] = (v instanceof Array) ? v[0] : v;
            }
        } catch (qpErr) {
            // query params unavailable; whatever came from the body still stands
        }

        out = new PaToolAgentTrace().execute(args);
    } catch (e) {
        // Never touch the exception object - a cross-scope denial throws again
        // when read and escapes the handler (DESIGN.md R-1).
        out = {
            success: false,
            error: 'Probe route failed before or during PaToolAgentTrace.execute(). Exception detail deliberately not read - see DESIGN.md R-1.'
        };
    }

    response.setStatus(200);
    response.setContentType('application/json');
    response.getStreamWriter().writeString(JSON.stringify(out));
})(request, response);`,
        },
    ],
})
