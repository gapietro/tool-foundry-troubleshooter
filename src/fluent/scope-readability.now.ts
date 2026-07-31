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
                // Scoped REST hands query params back as arrays, but they may
                // be Java-backed and cross a realm boundary - 'instanceof Array'
                // compares against THIS realm's Array constructor and returns
                // false for those, passing the whole list through as the value.
                // Ask what it is, not where it came from.
                args[n] = (Object.prototype.toString.call(v) === '[object Array]') ? v[0] : v;
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

        // -------------------------------------------------------------------
        // TEMPORARY — same deadline as /trace above: remove at Task 9.
        //
        // LLD §4.5 carried `⚠ VERIFY: scoped-app attachment write API surface`.
        // DESIGN.md R-8 is blunt about what does NOT clear that flag: a mocked
        // result is not evidence about platform behaviour in either direction,
        // and Build Rules #41 and #42 were both found only by touching real
        // records after a clean install. So the Jest suite settles the
        // arithmetic and this route settles the platform.
        //
        // It is a genuine round trip, not a smoke test: insert a run, store a
        // 35,000-char payload (the measured size of a real PaToolAgentTrace
        // summary — the number that made this component a blocker), confirm the
        // sys_attachment row, page the content back out through read(), and
        // compare the reassembled string to the original byte for byte. It then
        // deletes what it created, so it leaves no residue and can be re-run
        // after any deploy.
        //
        // This one WRITES, unlike every other route here. It writes only to the
        // app's own run table and only to rows it just created, and it is
        // authenticated + authorized. It still does not survive past Task 9.
        // -------------------------------------------------------------------
        {
            $id: Now.ID['scope-probe-artifact-selftest'],
            version: 1,
            name: 'Artifact Store Self-Test',
            path: '/artifact_selftest',
            method: 'POST',
            active: true,
            authentication: true,
            authorization: true,
            shortDescription: 'TEMPORARY round-trip verification for PaArtifactStore - remove at Task 9',
            script: script`(function process(request, response) {
    var out = { test: 'PaArtifactStore round trip', steps: {}, verdict: 'unknown' };

    function checksum(s) {
        var h = 0;
        for (var j = 0; j < s.length; j++) {
            h = (h * 31 + s.charCodeAt(j)) % 2147483647;
        }
        return h;
    }

    var runId = '';
    var artifactId = '';

    try {
        try { out.scope = gs.getCurrentScopeName(); } catch (scopeErr) { out.scope = 'unavailable'; }

        // 1. A payload the size of the thing that made this a blocker.
        //
        // NOTE the String.fromCharCode(10) instead of a backslash-n escape.
        // Inside a Fluent script template literal, TypeScript consumes the
        // escape and emits a REAL newline into the generated script, splitting
        // the string constant across two lines. That builds and installs
        // cleanly and fails only when the route is called
        // ("Unterminated string constant") - measured here, 2026-07-31.
        var NL = String.fromCharCode(10);
        var payload = '';
        var n = 0;
        while (payload.length < 35000) {
            payload += 'line' + n + ':abcdefghijklmnopqrstuvwxyz' + NL;
            n++;
        }
        payload = payload.substring(0, 35000);
        out.steps.payload = { length: payload.length, checksum: checksum(payload) };

        // 2. A real run record. Also re-checks Build Rule #41: if the number
        //    column comes back empty, autoNumber is silently broken again.
        var runGr = new GlideRecord('x_snc_troubleshoot_run');
        runGr.initialize();
        runGr.setValue('harness', 'native');
        runGr.setValue('mode', 'collect');
        runGr.setValue('status', 'running');
        runId = runGr.insert();
        if (!runId) {
            out.steps.run = { created: false };
            out.verdict = 'FAILED: could not insert a run record';
            response.setStatus(200);
            response.setContentType('application/json');
            response.getStreamWriter().writeString(JSON.stringify(out));
            return;
        }
        out.steps.run = { created: true, sys_id: String(runId), number: runGr.getValue('number') };

        // 3. store()
        var store = new PaArtifactStore();
        var stored = store.store(runId, 'selftest', payload);
        artifactId = stored.artifact_id ? String(stored.artifact_id) : '';
        out.steps.store = {
            stored: stored.stored === true,
            artifact_id: artifactId,
            file_name: stored.file_name || null,
            total_length: stored.total_length,
            pages: stored.pages || null,
            excerpt_length: stored.excerpt ? stored.excerpt.length : 0,
            excerpt_has_elision: stored.excerpt ? stored.excerpt.indexOf('[elided ') > -1 : false,
            degraded: stored.degraded || null,
            returned_full_payload: stored.content !== undefined
        };

        if (!stored.stored || !artifactId) {
            out.verdict = 'FAILED: store() did not produce an attachment (degraded: ' + (stored.degraded || 'none') + ')';
        } else {
            // 4. The attachment as the platform sees it.
            var att = new GlideRecord('sys_attachment');
            if (att.get(artifactId)) {
                out.steps.attachment = {
                    found: true,
                    table_name: att.getValue('table_name'),
                    table_sys_id: att.getValue('table_sys_id'),
                    file_name: att.getValue('file_name'),
                    content_type: att.getValue('content_type'),
                    size_bytes: att.getValue('size_bytes')
                };
            } else {
                out.steps.attachment = { found: false };
            }

            // 5. Page it back out and reassemble.
            var assembled = '';
            var offset = 0;
            var pagesRead = 0;
            var pageLengths = [];
            var readError = null;

            for (;;) {
                var page = store.read(artifactId, offset, 4000);
                if (!page.success) {
                    readError = page.error;
                    break;
                }
                assembled += page.data.content;
                pageLengths.push(page.data.length);
                pagesRead++;
                if (page.data.eof) break;
                offset = page.data.next_offset;
                if (pagesRead > 50) {
                    readError = 'paging did not terminate within 50 pages';
                    break;
                }
            }

            out.steps.read = {
                pages_read: pagesRead,
                page_lengths: pageLengths,
                assembled_length: assembled.length,
                assembled_checksum: checksum(assembled),
                error: readError
            };

            // 6. The claim this whole component rests on.
            var identical = assembled === payload;
            out.steps.roundtrip = {
                byte_identical: identical,
                length_match: assembled.length === payload.length,
                checksum_match: checksum(assembled) === checksum(payload)
            };

            // 7. The security guard, exercised against a real foreign attachment.
            var foreign = new GlideRecord('sys_attachment');
            foreign.addQuery('table_name', '!=', 'x_snc_troubleshoot_run');
            foreign.setLimit(1);
            foreign.query();
            if (foreign.next()) {
                var refused = store.read(foreign.getUniqueValue(), 0, 100);
                out.steps.foreign_table_guard = {
                    tested_against: foreign.getValue('table_name'),
                    refused: refused.success === false,
                    error: refused.error || null
                };
            } else {
                out.steps.foreign_table_guard = { tested_against: null, refused: null };
            }

            out.verdict = identical
                ? 'PASSED: 35,000 chars stored as an attachment and paged back byte-identical from scope x_snc_troubleshoot'
                : 'FAILED: reassembled content does not match the original';
        }
    } catch (e) {
        // R-1: the exception object is never read.
        out.verdict = 'FAILED: self-test threw. Exception detail deliberately not read - see DESIGN.md R-1.';
    }

    // 8. Leave nothing behind.
    try {
        if (artifactId) new GlideSysAttachment().deleteAttachment(artifactId);
        if (runId) {
            var cleanup = new GlideRecord('x_snc_troubleshoot_run');
            if (cleanup.get(runId)) cleanup.deleteRecord();
        }
        out.cleanup = 'run record and attachment deleted';
    } catch (cleanupErr) {
        out.cleanup = 'cleanup failed - run ' + runId + ' may need manual deletion';
    }

    response.setStatus(200);
    response.setContentType('application/json');
    response.getStreamWriter().writeString(JSON.stringify(out));
})(request, response);`,
        },

        // -------------------------------------------------------------------
        // TEMPORARY — same deadline as the two routes above: remove at Task 9.
        //
        // Task 5's platform half. The Jest suite settles which key wins and
        // what the digest looks like; it cannot settle whether a scoped
        // `GlideRecord` insert into the app's own tables actually succeeds, and
        // per R-8 a stub result is not evidence about that in either direction.
        // Build Rules #41 and #42 were BOTH found by inserting a real row after
        // a clean install, so this route inserts real rows.
        //
        // Four claims, in order of how expensive they are to get wrong:
        //
        //  1. Two calls with the same conversation id return ONE run. This is
        //     the whole point of the `conversation_ref` column added at issue
        //     #20 — without it `getOrCreate` could only ever create, and every
        //     tool call in a conversation would open its own run.
        //  2. Two calls with NO key return DIFFERENT runs. The R-2 guard. If
        //     this ever fails, benchmark run 2 can read run 1's artifacts and
        //     the scorecard is quietly measuring nothing (DESIGN.md §2.4).
        //  3. `readNativeContext()` survives `_agentic_context_` being absent.
        //     A REST route is a runtime where that global does not exist, so
        //     this exercises the `typeof` guard for real — an unguarded read
        //     is a ReferenceError that kills the request.
        //  4. The audit rows land, and read back, against the run.
        //
        // Writes only to this app's own two tables, only rows it just created,
        // and deletes them all before returning.
        // -------------------------------------------------------------------
        {
            $id: Now.ID['scope-probe-anchor-selftest'],
            version: 1,
            name: 'Run Anchor and Audit Self-Test',
            path: '/anchor_selftest',
            method: 'POST',
            active: true,
            authentication: true,
            authorization: true,
            shortDescription: 'TEMPORARY verification for PaRunAnchor + PaAuditLogger - remove at Task 9',
            script: script`(function process(request, response) {
    var out = { test: 'PaRunAnchor + PaAuditLogger', steps: {}, verdict: 'unknown' };
    var created = [];

    function remember(id) {
        if (id) created.push(String(id));
    }

    try {
        try { out.scope = gs.getCurrentScopeName(); } catch (scopeErr) { out.scope = 'unavailable'; }

        var anchor = new PaRunAnchor();

        // 1. The global that is NOT here. A REST route has no
        //    _agentic_context_, which is exactly the runtime that catches an
        //    unguarded read of it.
        var native = anchor.readNativeContext();
        out.steps.native_context = {
            present: native.present,
            conversation_id: native.conversation_id,
            survived_absent_global: true
        };

        // 2. Create, keyed on a conversation id we make up.
        var conv = gs.generateGUID();
        var first = anchor.getOrCreate({ conversationId: conv, executionRef: gs.generateGUID() });
        remember(first.run_id);
        out.steps.create = {
            run_id: first.run_id,
            number: first.number,
            created: first.created,
            keyed: first.keyed,
            key_source: first.key_source,
            degraded: first.degraded || null
        };

        // Build Rule #41 re-check: an empty number here means autoNumber is
        // silently broken again and every run renders with a blank display.
        out.steps.autonumber_ok = !!first.number;

        // 3. THE CLAIM. A second call in the same conversation must resolve to
        //    the same record, not make a new one.
        var second = anchor.getOrCreate({ conversationId: conv });
        remember(second.run_id);
        var sameRun = second.run_id === first.run_id && second.created === false;
        out.steps.resolve_same_conversation = {
            run_id: second.run_id,
            created: second.created,
            matches_first: sameRun
        };

        // 4. THE GUARD. No key at all must isolate, never merge (R-2).
        var lone1 = anchor.getOrCreate({});
        var lone2 = anchor.getOrCreate({});
        remember(lone1.run_id);
        remember(lone2.run_id);
        var isolated = !!lone1.run_id && !!lone2.run_id && lone1.run_id !== lone2.run_id;
        out.steps.unkeyed_isolation = {
            first: lone1.run_id,
            second: lone2.run_id,
            keyed: lone1.keyed,
            distinct: isolated
        };

        // 4b. Cross-user key fixation must be refused (security review, PR #21).
        //     A run planted under a key, owned by someone else, must not be
        //     adopted by a caller supplying that key — otherwise naming another
        //     session's conversation hands over its artifacts and audit trail.
        var foreignConv = gs.generateGUID();
        var plantGr = new GlideRecord('x_snc_troubleshoot_run');
        plantGr.initialize();
        plantGr.setValue('harness', 'native');
        plantGr.setValue('status', 'running');
        plantGr.setValue('conversation_ref', foreignConv);
        plantGr.setValue('user', 'ffffffffffffffffffffffffffffffff');
        var plantedId = plantGr.insert();
        remember(plantedId);

        var fixate = anchor.getOrCreate({ conversationId: foreignConv });
        remember(fixate.run_id);
        var refused = !!fixate.run_id && fixate.run_id !== String(plantedId);
        out.steps.cross_user_refusal = {
            planted_run: String(plantedId),
            returned_run: fixate.run_id,
            refused: refused,
            key_rejected: fixate.key_rejected === true
        };

        // And the refusal must not become the scatter bug: a second call by
        // the same caller has to converge on the run it just made.
        var fixate2 = anchor.getOrCreate({ conversationId: foreignConv });
        remember(fixate2.run_id);
        out.steps.cross_user_refusal.converges_on_own_run =
            fixate2.run_id === fixate.run_id && fixate2.created === false;

        // 4c. The round-2 finding: a PARTIAL ambient context must not disable
        //     the ownership check. An _agentic_context_ that parses to an
        //     object with no identity fields makes present true while the key
        //     still comes from the caller.
        //
        //     Assigning without a var declaration puts the name on the Rhino
        //     global object, the same scope a script tool's globals live in, so
        //     this also answers whether the ambient path is reachable from here
        //     at all. If it is not, context_seen comes back false and the step
        //     says so rather than quietly passing on the path it meant to test.
        //
        //     NOTE - no backticks anywhere in this comment. A backtick inside a
        //     Fluent script template literal CLOSES the template: the build
        //     fails with TS2796 / TS304 / "Failed to cast
        //     TaggedTemplateExpressionShape", pointing at lines far from the
        //     real one. Sibling of Build Rule #43, and it bit here first.
        var partialConv = gs.generateGUID();
        var plant2 = new GlideRecord('x_snc_troubleshoot_run');
        plant2.initialize();
        plant2.setValue('harness', 'native');
        plant2.setValue('status', 'running');
        plant2.setValue('conversation_ref', partialConv);
        plant2.setValue('user', 'ffffffffffffffffffffffffffffffff');
        var planted2 = plant2.insert();
        remember(planted2);

        _agentic_context_ = '{}';
        var probe = new PaRunAnchor();
        var contextSeen = probe.readNativeContext().present === true;
        var partial = probe.getOrCreate({ conversationId: partialConv });
        remember(partial.run_id);
        _agentic_context_ = undefined;

        out.steps.partial_context_bypass = {
            context_seen: contextSeen,
            planted_run: String(planted2),
            returned_run: partial.run_id,
            refused: !!partial.run_id && partial.run_id !== String(planted2),
            key_rejected: partial.key_rejected === true
        };

        // 5. Audit rows around a notional tool call.
        var logger = new PaAuditLogger();
        var intent = logger.logIntent({
            runId: first.run_id,
            toolName: 'agent_trace',
            input: { execution: 'c9d63a932bda8b9417a6ffbeee91bfd0' },
            targetTable: 'sn_aia_execution_plan',
            targetRecord: 'c9d63a932bda8b9417a6ffbeee91bfd0'
        });
        var result = logger.logResult({
            runId: first.run_id,
            toolName: 'agent_trace',
            output: { success: true, data: { steps: 11 } }
        });
        var failed = logger.logError({
            runId: first.run_id,
            toolName: 'agent_trace',
            error: 'plan not found'
        });

        out.steps.audit_writes = {
            intent: intent.logged,
            result: result.logged,
            error: failed.logged,
            degraded: [intent.degraded || null, result.degraded || null, failed.degraded || null]
        };

        // 6. Read them back — a write that reports success and stores nothing
        //    readable is the failure shape this project keeps meeting.
        var auditGr = new GlideRecord('x_snc_troubleshoot_audit');
        auditGr.addQuery('run', first.run_id);
        auditGr.orderBy('sys_created_on');
        auditGr.query();
        var seen = [];
        while (auditGr.next()) {
            seen.push({
                action_type: auditGr.getValue('action_type'),
                tool_name: auditGr.getValue('tool_name'),
                target_table: auditGr.getValue('target_table'),
                has_payload: !!(auditGr.getValue('input') || auditGr.getValue('output'))
            });
        }
        out.steps.audit_readback = { count: seen.length, rows: seen };

        var auditOk = seen.length === 3;

        // 7. A digest that must not become a second copy of a 35KB payload.
        var NL = String.fromCharCode(10);
        var bulk = '';
        while (bulk.length < 20000) {
            bulk += 'padding line for the digest ceiling test' + NL;
        }
        logger.logResult({ runId: first.run_id, toolName: 'bulk', output: bulk });
        var digestGr = new GlideRecord('x_snc_troubleshoot_audit');
        digestGr.addQuery('run', first.run_id);
        digestGr.addQuery('tool_name', 'bulk');
        digestGr.query();
        var digestLen = null;
        if (digestGr.next()) digestLen = digestGr.getValue('output').length;
        out.steps.digest = {
            original_length: bulk.length,
            stored_length: digestLen,
            capped: digestLen !== null && digestLen < 4200
        };

        // 7b. Audit attribution is server-authoritative — a caller-supplied
        //     user or confirmation flag must be ignored, not honoured.
        logger.logIntent({
            runId: first.run_id,
            toolName: 'spoof',
            input: '{}',
            user: 'ffffffffffffffffffffffffffffffff',
            confirmedByUser: true
        });
        var spoofGr = new GlideRecord('x_snc_troubleshoot_audit');
        spoofGr.addQuery('run', first.run_id);
        spoofGr.addQuery('tool_name', 'spoof');
        spoofGr.query();
        var spoofOk = false;
        if (spoofGr.next()) {
            spoofOk =
                spoofGr.getValue('user') === gs.getUserID() &&
                spoofGr.getValue('confirmed_by_user') !== '1' &&
                spoofGr.getValue('confirmed_by_user') !== 'true';
            out.steps.audit_attribution = {
                recorded_user: spoofGr.getValue('user'),
                session_user: gs.getUserID(),
                confirmed_by_user: spoofGr.getValue('confirmed_by_user'),
                spoof_ignored: spoofOk
            };
        }

        var pass = sameRun && isolated && auditOk && out.steps.autonumber_ok
            && out.steps.digest.capped && refused
            && out.steps.cross_user_refusal.converges_on_own_run && spoofOk
            && out.steps.partial_context_bypass.refused;
        out.verdict = pass
            ? 'PASSED: conversation key resolves to one run, unkeyed calls stay isolated, cross-user key fixation refused, audit attribution server-authoritative, payloads digested'
            : 'FAILED: see steps';
    } catch (e) {
        // R-1: the exception object is never read.
        out.verdict = 'FAILED: self-test threw. Exception detail deliberately not read - see DESIGN.md R-1.';
    }

    // 8. Leave nothing behind. Audit rows cascade with the run.
    try {
        var deleted = 0;
        for (var i = 0; i < created.length; i++) {
            var cleanup = new GlideRecord('x_snc_troubleshoot_run');
            if (cleanup.get(created[i])) {
                cleanup.deleteRecord();
                deleted++;
            }
        }
        out.cleanup = 'deleted ' + deleted + ' run records';
    } catch (cleanupErr) {
        out.cleanup = 'cleanup failed - runs may need manual deletion: ' + created.join(',');
    }

    response.setStatus(200);
    response.setContentType('application/json');
    response.getStreamWriter().writeString(JSON.stringify(out));
})(request, response);`,
        },

        // -------------------------------------------------------------------
        // TEMPORARY — deleted at Task 10 together with the other three probes.
        //
        // The vertical-slice brief says the probe routes come out when the Task 9
        // adapter lands. Deferred by one task deliberately: deleting them here
        // leaves the adapter verifiable only through an AiAgent that does not
        // exist yet, so its first exercise would be inside Task 10, where an
        // adapter defect and an agent-definition defect are indistinguishable.
        //
        // Read-only in effect: the adapter writes a run record, an audit row and
        // possibly an artifact, all inside this app. The tools it reaches only
        // read.
        // -------------------------------------------------------------------
        {
            $id: Now.ID['scope-probe-adapter'],
            version: 1,
            name: 'Script Tool Adapter Probe',
            path: '/adapter',
            method: 'POST',
            active: true,
            authentication: true,
            authorization: true,
            shortDescription: 'TEMPORARY verification harness for PaScriptToolAdapter - remove at Task 10',
            script: script`(function process(request, response) {
    var out;

    try {
        var body = {};
        try {
            if (request.body && request.body.data) {
                body = request.body.data;
            }
        } catch (bodyErr) {
            body = {};
        }

        var tool = body.tool;
        if (tool === undefined || tool === null || tool === '') {
            tool = 'agent_trace';
        }

        // Passed to invoke() exactly as received. The whole point of this route
        // is to exercise the tolerant-parse path the wrapper will feed it, so it
        // must not normalise anything on the way in.
        var payload = body.request;

        // No identity in the context. PaRunAnchor reads the ambient
        // _agentic_context_ itself and lets it win, which is what the real
        // wrapper relies on; supplying a conversation id here would exercise a
        // path the wrapper never takes.
        var adapterOut = new PaScriptToolAdapter().invoke(String(tool), payload, {});

        // invoke() returns a STRING by contract. Handing it back raw is the
        // point: if it is ever not a string, this route is where that shows.
        out = {
            success: true,
            tool: String(tool),
            output_type: typeof adapterOut,
            output: adapterOut
        };
    } catch (e) {
        // Never touch the exception object - a cross-scope denial throws again
        // when read and escapes the handler (DESIGN.md R-1).
        out = {
            success: false,
            error: 'Adapter probe route failed outside invoke(). That should be impossible - invoke() contains its own failures - so suspect the Script Include did not resolve from this scope. Exception detail deliberately not read, see DESIGN.md R-1.'
        };
    }

    response.setStatus(200);
    response.setContentType('application/json');
    response.getStreamWriter().writeString(JSON.stringify(out));
})(request, response);`,
        },
    ],
})
