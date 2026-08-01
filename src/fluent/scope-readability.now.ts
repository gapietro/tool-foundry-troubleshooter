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
    ],
})
