/**
 * PaRestHandlers — the custom harness's REST surface (LOW_LEVEL_DESIGN.md
 * §4.8 wiring; Phase 1b Task 7,
 * docs/superpowers/plans/2026-08-02-phase1b-harness.md).
 *
 * WHAT THIS EXISTS FOR
 * Everything built in Tasks 1-6 (PaLlmProxy, PaToolRegistry, PaFixReport,
 * PaRunManager, PaAgentLoop) is reachable only from server-side script. This
 * class is the thin REST business-logic layer over them: five methods —
 * `analyze`, `getRun`, `message`, `status`, `tools` — each a PLAIN FUNCTION
 * taking `{body, pathParams, userId}` and returning `{status, body}`. The
 * Fluent `RestApi` route script (`src/fluent/rest-api.now.ts`) is a one-line
 * adapter: build `ctx` from `request`/`gs.getUserID()`, call the matching
 * method, write `result.status`/`result.body` onto `response`.
 *
 * WHY EVERY COLLABORATOR IS INJECTED, INCLUDING THE GLIDE-TOUCHING ONES
 * `readRun`, `eventQueue` and the `/status` check list all have a REAL
 * (Glide/NASK-touching) default implementation, reached only when no
 * injection is supplied. That is what makes this file testable with ZERO
 * Glide (Task 7 brief, Step 1) without pretending the REST layer doesn't
 * touch the platform at all — the defaults are exercised on-instance only
 * (Step 4), the same split every other Phase 1b component in this app uses.
 *
 * OWNER GATE — NO EXISTENCE ORACLE
 * `getRun`/`message` return the SAME literal 404 (`_notFoundRun()`, one
 * constant-shaped object) whether the run does not exist or exists but
 * belongs to someone else. A run with NO recorded owner (`user` blank) is
 * refused too, rather than matched against an equally-blank caller id — see
 * `getRun` below. This mirrors PaRunAnchor's "fails OPEN on cannot tell,
 * CLOSED on can tell and it is not you" only where it can actually decide;
 * an unowned row genuinely cannot be attributed to the caller, so it is
 * refused rather than guessed open.
 *
 * /status — R-19b, MADE EXPLICIT
 * Every check is `{check, status, detail}`; a check that throws is caught
 * (R-1) and reported as its own failed check, never a crashed request. The
 * top-level `ready` is `true` only when EVERY check status is `'ok'` — a
 * consumer gates on `ready`, so one degraded check (the skills deactivated,
 * Rule #40; a provider outage; a stuck run) must not be diluted into a
 * partial "mostly fine" signal.
 *
 * STANDING RULES THIS FILE IS BUILT AROUND
 * R-1  Never touch the exception object in a catch. Every catch here names
 *      its own reason and moves on; a `/status` check that throws is caught
 *      at the aggregation layer too, so one broken check cannot 500 the
 *      whole endpoint.
 * R-9  Every input may be absent — `ctx`, `ctx.body`, `ctx.pathParams` all
 *      degrade explicitly rather than throwing.
 * R-11 A DENIED table read is reported as DENIED in `/status` detail, never
 *      collapsed into a silent "table missing".
 * R-19b A status must not contradict the notes sitting next to it — see the
 *      owner-gate and /status notes above.
 *
 * Build Rule #42: the default `_defaultReadRun`/`_defaultEventQueue` use
 * plain `GlideRecord`, not `GlideRecordSecure` — a Fluent `Table()` installs
 * with zero ACLs, so the secure variant would deny this app read/write
 * access to its own run table from inside a REST handler running as the
 * calling user. Ownership is enforced explicitly by this class instead
 * (the owner gate above), which is the same reasoning `x_snc_troubleshoot`'s
 * other Glide-touching components already apply.
 */
var PaRestHandlers = Class.create()

PaRestHandlers.prototype = {
    RUN_TABLE: 'x_snc_troubleshoot_run',
    RUN_START_EVENT: 'x_snc_troubleshoot.run.start',

    /** LLD §2 tables the tool cores actually read — mirrors
     *  src/fluent/scope-readability.now.ts's TABLES list, so `/status`'s
     *  readability check measures the same surface the scope probe does. */
    SECTION2_TABLES: [
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
        'sys_dictionary',
    ],

    /** syslog carries a permanent, documented `caller_access = Caller
     *  Restriction` this app cannot lift for itself (DESIGN.md R-19,
     *  src/fluent/cross-scope-privileges.now.ts) — PaToolLogAnalysis alone is
     *  blocked by it. Counting it against `/status`'s readiness gate would
     *  make `ready` permanently false for a known, accepted, unfixable gap
     *  unrelated to any of this task's other checks. It is still reported in
     *  `table_readability`'s detail (R-11 — DENIED is never hidden), it just
     *  does not flip the check's own status. */
    KNOWN_DENIED_TABLES: ['syslog'],

    /** Direct sys_id strings for the two NASK skills' backing capabilities —
     *  same values as PaLlmProxy._NASK_SKILLS (Build Rule #33: never
     *  Now.ref, direct sys_id only). Duplicated rather than imported: this
     *  is a Rhino ES5 file with no module system, and `/status`'s capability
     *  check is a read-only probe independent of PaLlmProxy's own call path. */
    NASK_CAPABILITIES: {
        'pa llm reason': '0bf0bc13a7414399a1482d21de01231d',
        'pa llm summarize': '3914d62f6a9b42a3a4633432a97a1d0f',
    },

    /** A custom run stuck at `status:'running'` longer than this is a worker
     *  that died mid-flight, not one still working — PaAgentLoop's own
     *  BUDGET_MS (300000) bounds a single run() call, so this is that bound
     *  plus a generous margin for queueing/processing latency, not a second
     *  independent guess. */
    STUCK_RUN_BUDGET_MS: 900000,

    /**
     * @param {Object} [options] {runManager, toolRegistry, llmProxy, readRun,
     *        eventQueue, checks, now} — every collaborator is an injection
     *        point; tests inject all of them and touch no Glide API. `checks`
     *        replaces the ENTIRE `/status` check list wholesale (the same
     *        "cores" pattern PaToolRegistry uses), not a merge.
     */
    initialize: function (options) {
        var o = options || {}
        this._runManager = o.runManager || null
        this._toolRegistry = o.toolRegistry || null
        this._llmProxy = o.llmProxy || null
        this._readRunFn = typeof o.readRun === 'function' ? o.readRun : null
        this._eventQueueFn = typeof o.eventQueue === 'function' ? o.eventQueue : null
        this._checks = this._isArray(o.checks) ? o.checks : null
        this._nowFn = typeof o.now === 'function' ? o.now : null
    },

    // =======================================================================
    // POST /analyze
    // =======================================================================

    /**
     * @param {Object} ctx {body, pathParams, userId}
     * @returns {Object} {status, body}
     */
    analyze: function (ctx) {
        var c = ctx || {}
        var body = this._isPlainObject(c.body) ? c.body : {}

        var validation = this._validateAnalyze(body)
        if (!validation.valid) {
            return { status: 400, body: { error: validation.error } }
        }

        var created = this._runs().createRun({
            agent: body.agent,
            executionRef: body.execution,
            mode: validation.mode,
        })

        if (!created || !created.run_id) {
            return {
                status: 500,
                body: {
                    error:
                        'failed to create diagnostic run: ' +
                        (created && created.degraded ? created.degraded : 'unknown'),
                },
            }
        }

        if (validation.mode === 'collect') {
            return this._runCollect(created.run_id)
        }

        return this._queueDiagnose(created.run_id, body)
    },

    /**
     * Names the exact missing input, never a generic "bad request" — the
     * brief's validation matrix requires every case to name the missing
     * field. `execution`, `logs`, or `agent`+`timeframe` together satisfy the
     * requirement; `agent` or `timeframe` alone name the other one missing.
     */
    _validateAnalyze: function (body) {
        var hasExecution = this._nonEmptyString(body.execution)
        var hasAgent = this._nonEmptyString(body.agent)
        var hasTimeframe = this._nonEmptyString(body.timeframe)
        var hasLogs = this._nonEmptyString(body.logs)

        var mode = 'diagnose'
        if (body.mode !== undefined && body.mode !== null && body.mode !== '') {
            if (body.mode !== 'collect' && body.mode !== 'diagnose') {
                return { valid: false, error: 'mode must be "collect" or "diagnose" (or omitted)' }
            }
            mode = body.mode
        }

        if (hasExecution || hasLogs || (hasAgent && hasTimeframe)) {
            return { valid: true, mode: mode }
        }

        if (hasAgent && !hasTimeframe) {
            return { valid: false, error: 'timeframe is required when agent is provided' }
        }
        if (hasTimeframe && !hasAgent) {
            return { valid: false, error: 'agent is required when timeframe is provided' }
        }

        return {
            valid: false,
            error: 'one of execution, agent+timeframe, or logs is required',
        }
    },

    /**
     * `mode:'collect'` — the Evidence Bundle floor, NO LLM in the call path
     * (PaRunManager.collectBundle's own contract). Runs synchronously and
     * returns the bundle inline; the run is closed `complete` immediately
     * since there is no async worker to transition it later — leaving it at
     * `queued` forever would be a stuck-looking row for work that already
     * finished.
     */
    _runCollect: function (runId) {
        var bundle = this._runs().collectBundle(runId)
        this._runs().close(runId, 'complete', {})
        return {
            status: 200,
            body: {
                run_id: runId,
                mode: 'collect',
                data: bundle && bundle.data ? bundle.data : {},
            },
        }
    },

    /**
     * The ordinary path: queue the async worker via the platform event and
     * answer immediately. `gs.eventQueue('x_snc_troubleshoot.run.start',
     * runGr, run_id, request_json)` per the brief's interface — the run
     * GlideRecord and the platform call are behind the `eventQueue` seam
     * (`_defaultEventQueue` below) so this method stays Glide-free.
     */
    _queueDiagnose: function (runId, body) {
        var requestJson = this._safeStringify(body)
        var queued = this._eventQueue(runId, requestJson)

        if (!queued) {
            return {
                status: 500,
                body: { error: 'run ' + runId + ' was created but the diagnosis could not be queued' },
            }
        }

        return { status: 202, body: { run_id: runId, status: 'queued' } }
    },

    // =======================================================================
    // GET /runs/{run_id}
    // =======================================================================

    /**
     * @param {Object} ctx {pathParams:{run_id}, userId}
     * @returns {Object} {status, body}
     */
    getRun: function (ctx) {
        var c = ctx || {}
        var pathParams = this._isPlainObject(c.pathParams) ? c.pathParams : {}
        var runId = this._str(pathParams.run_id)
        if (!runId) return this._notFoundRun()

        var run = this._readRun(runId)
        if (!this._ownedByCaller(run, c.userId)) return this._notFoundRun()

        var body = {
            run_id: run.run_id,
            number: run.number,
            status: run.status,
            mode: run.mode,
            transcript: this._isArray(run.transcript) ? run.transcript : [],
            context_summary: run.context_summary || '',
            error: run.error || '',
            fix_report: run.status === 'complete' ? this._parseJsonSafe(run.fix_report) : null,
        }

        return { status: 200, body: body }
    },

    /**
     * Owner gate, shared by getRun and message. A run with no recorded owner
     * (`user` blank — an edge case, but PaRunAnchor's own docs allow for a
     * degraded anchor) is refused rather than matched against an equally
     * blank caller id: `'' === ''` would otherwise hand an unowned row to
     * anyone, which is the exact ownership bypass PaRunAnchor's own review
     * history (PR #21) already found and fixed for a different component.
     */
    _ownedByCaller: function (run, userId) {
        if (!run) return false
        var owner = this._str(run.user)
        if (!owner) return false
        return owner === this._str(userId)
    },

    /** ONE literal shape, always — the byte-identical 404 the brief requires
     *  for both "does not exist" and "exists but is not yours". No existence
     *  oracle: the caller cannot tell the two apart from this response. */
    _notFoundRun: function () {
        return { status: 404, body: { error: 'run not found' } }
    },

    // =======================================================================
    // POST /runs/{run_id}/message
    // =======================================================================

    /**
     * @param {Object} ctx {pathParams:{run_id}, body:{message}, userId}
     * @returns {Object} {status, body}
     */
    message: function (ctx) {
        var c = ctx || {}
        var pathParams = this._isPlainObject(c.pathParams) ? c.pathParams : {}
        var runId = this._str(pathParams.run_id)
        if (!runId) return this._notFoundRun()

        var run = this._readRun(runId)
        if (!this._ownedByCaller(run, c.userId)) return this._notFoundRun()

        if (run.status !== 'complete') {
            return { status: 409, body: { error: 'run is not complete (status: ' + run.status + ')' } }
        }

        var body = this._isPlainObject(c.body) ? c.body : {}
        var messageText = this._nonEmptyString(body.message) ? body.message : ''
        if (!messageText) {
            return { status: 400, body: { error: 'message is required' } }
        }

        var prompt = this._buildMessagePrompt(run, messageText)
        var reasoned = this._llm().reason(prompt)

        if (!reasoned || reasoned.success !== true) {
            return {
                status: 502,
                body: {
                    error: 'LLM reasoning failed: ' + (reasoned && reasoned.error ? reasoned.error : 'unknown error'),
                },
            }
        }

        var action = this._isPlainObject(reasoned.action) ? reasoned.action : {}
        var reply =
            action.action === 'answer' && typeof action.text === 'string' ? action.text : this._str(reasoned.raw)

        this._runs().appendTranscript(runId, { actor: 'llm', args_digest: 'message: ' + messageText })
        this._runs().appendTranscript(runId, { actor: 'llm', result_digest: reply })

        return { status: 200, body: { run_id: runId, reply: reply } }
    },

    /**
     * A short, single-turn prompt over the run's own context — the run's
     * fix_report and context_summary, plus the caller's question — asking
     * for PaLlmProxy's strict `{"action":"answer",...}` shape (the only
     * shape `reason()` accepts that fits a free-form reply; see
     * PaLlmProxy._parseResponse).
     */
    _buildMessagePrompt: function (run, messageText) {
        var lines = []
        lines.push('You already completed a diagnostic run. Answer a short follow-up question about it.')
        lines.push('')
        lines.push('Fix Report (if any):')
        lines.push(this._nonEmptyString(run.fix_report) ? run.fix_report : '(none)')
        lines.push('')
        lines.push('Context summary:')
        lines.push(this._nonEmptyString(run.context_summary) ? run.context_summary : '(none)')
        lines.push('')
        lines.push('Follow-up question:')
        lines.push(messageText)
        lines.push('')
        lines.push('Respond with exactly one JSON object and nothing else: {"action":"answer","text":"<your reply>"}')
        return lines.join('\n')
    },

    // =======================================================================
    // GET /status
    // =======================================================================

    /**
     * @returns {Object} {status:200, body:{ready, checks:[{check,status,detail}]}}
     *          — `ready` is true only when every check is 'ok' (R-19b).
     */
    status: function () {
        var checks = this._checks || this._statusChecks()
        var results = []
        var ready = true

        for (var i = 0; i < checks.length; i++) {
            var c = checks[i]
            var result = null
            try {
                result = c.run()
            } catch (e) {
                // R-1: `e` untouched — a broken check is reported as a failed
                // check, not a crashed request.
                result = null
            }

            var st = result && this._nonEmptyString(result.status) ? result.status : 'error'
            var detail = result && result.detail !== undefined ? result.detail : null

            results.push({ check: c.name, status: st, detail: detail })
            if (st !== 'ok') ready = false
        }

        return { status: 200, body: { ready: ready, checks: results } }
    },

    /** The production check list — see the file header's "/status — R-19b"
     *  note. Replaced WHOLESALE via `options.checks` for tests. */
    _statusChecks: function () {
        var self = this
        return [
            { name: 'plugins', run: function () { return self._checkPlugins() } },
            { name: 'skills', run: function () { return self._checkSkills() } },
            {
                name: 'capability_provider_mapping',
                run: function () { return self._checkCapabilityMapping() },
            },
            { name: 'micro_invocation', run: function () { return self._checkMicroInvocation() } },
            { name: 'table_readability', run: function () { return self._checkTableReadability() } },
            { name: 'stuck_runs', run: function () { return self._checkStuckRuns() } },
        ]
    },

    /** Now Assist / GenAI Controller / sn_aia — see now-assist-platform.md
     *  "Required Plugins". `sys_scope` was the corrected instrument
     *  (PREFLIGHT_FINDINGS.md P1); `GlidePluginManager.isActive()` is the
     *  documented, scriptable equivalent, checked per-plugin so one missing
     *  dependency is named rather than folded into a single boolean. */
    _checkPlugins: function () {
        var plugins = {
            'com.snc.now_assist': 'Now Assist Core',
            sn_genai_platform: 'Now Assist for Platform',
            'com.sn.generative.ai': 'Generative AI Controller',
            sn_aia: 'AI Agent Studio',
        }

        if (typeof GlidePluginManager === 'undefined') {
            return { status: 'error', detail: 'GlidePluginManager unavailable' }
        }

        var detail = {}
        var allActive = true
        try {
            var mgr = new GlidePluginManager()
            for (var id in plugins) {
                if (!Object.prototype.hasOwnProperty.call(plugins, id)) continue
                var active = false
                try {
                    active = !!mgr.isActive(id)
                } catch (e) {
                    // R-1: `e` untouched.
                    active = false
                }
                detail[id] = { name: plugins[id], active: active }
                if (!active) allActive = false
            }
        } catch (e) {
            // R-1: `e` untouched.
            return { status: 'error', detail: 'plugin check failed' }
        }

        return { status: allActive ? 'ok' : 'error', detail: detail }
    },

    /** Both skills exist AND are active — Rule #40's activation trap is
     *  exactly the state this catches: `sn_nowassist_skill_config` existing
     *  is not enough, `sn_nowassist_skill_config_status.active` must be true
     *  too (skills install deactivated, every time). */
    _checkSkills: function () {
        if (typeof GlideRecord === 'undefined') {
            return { status: 'error', detail: 'GlideRecord unavailable' }
        }

        var detail = {}
        var allOk = true
        for (var name in this.NASK_CAPABILITIES) {
            if (!Object.prototype.hasOwnProperty.call(this.NASK_CAPABILITIES, name)) continue

            var found = false
            var active = false
            try {
                var gr = new GlideRecord('sn_nowassist_skill_config')
                gr.addQuery('name', name)
                gr.setLimit(1)
                gr.query()
                if (gr.next()) {
                    found = true
                    var statusGr = new GlideRecord('sn_nowassist_skill_config_status')
                    statusGr.addQuery('skill_config', gr.getValue('sys_id'))
                    statusGr.setLimit(1)
                    statusGr.query()
                    if (statusGr.next()) {
                        var activeVal = statusGr.getValue('active')
                        active = activeVal === 'true' || activeVal === '1'
                    }
                }
            } catch (e) {
                // R-1: `e` untouched.
            }

            detail[name] = { found: found, active: active }
            if (!found || !active) allOk = false
        }

        return { status: allOk ? 'ok' : 'error', detail: detail }
    },

    /** Is each skill's capability wired to a provider at all — the same
     *  question PaToolGenAiLog's check_config asks of an arbitrary
     *  capability (mandatory bindings `capability`/`api_type`/`api`; an
     *  empty `connection` is NORMAL, per that tool's own refuted-heuristic
     *  header), narrowed to exactly the two capabilities this app depends
     *  on. */
    _checkCapabilityMapping: function () {
        if (typeof GlideRecord === 'undefined') {
            return { status: 'error', detail: 'GlideRecord unavailable' }
        }

        var detail = {}
        var allOk = true
        for (var name in this.NASK_CAPABILITIES) {
            if (!Object.prototype.hasOwnProperty.call(this.NASK_CAPABILITIES, name)) continue
            var capId = this.NASK_CAPABILITIES[name]
            var mapped = false
            var note = ''

            try {
                var gr = new GlideRecord('sys_one_extend_capability_definition')
                gr.addQuery('capability', capId)
                gr.query()
                while (gr.next()) {
                    var apiType = gr.getValue('api_type')
                    var api = gr.getValue('api')
                    if (apiType && api) {
                        mapped = true
                        break
                    }
                }
                if (!mapped) note = 'no capability definition with both api_type and api bound'
            } catch (e) {
                // R-1: `e` untouched.
                note = 'capability definition read failed'
            }

            detail[name] = { capability: capId, mapped: mapped, note: note }
            if (!mapped) allOk = false
        }

        return { status: allOk ? 'ok' : 'error', detail: detail }
    },

    /** One live round-trip through PaLlmProxy.reason() — the same call
     *  PaAgentLoop makes every iteration. A structural pass (skill exists,
     *  capability mapped) says nothing about whether a call actually
     *  completes; this is the only check here that does. */
    _checkMicroInvocation: function () {
        var result
        try {
            result = this._llm().reason(
                'Respond with exactly this JSON and nothing else: {"action":"answer","text":"OK"}'
            )
        } catch (e) {
            // R-1: `e` untouched.
            return { status: 'error', detail: 'micro-invocation threw' }
        }

        if (result && result.success === true) {
            return { status: 'ok', detail: { retried: !!result.retried } }
        }
        return { status: 'error', detail: result && result.error ? result.error : 'unknown failure' }
    },

    /** Same §2 table list as src/fluent/scope-readability.now.ts's
     *  /scope_probe/reads, run from inside this scope with
     *  GlideRecordSecure — so this measures what the tool cores actually
     *  experience. `syslog` is EXCLUDED from the ok/error gate (see
     *  KNOWN_DENIED_TABLES) but still reported (R-11). */
    _checkTableReadability: function () {
        if (typeof GlideRecordSecure === 'undefined') {
            return { status: 'error', detail: 'GlideRecordSecure unavailable' }
        }

        var detail = {}
        var unexpectedDenied = 0

        for (var i = 0; i < this.SECTION2_TABLES.length; i++) {
            var t = this.SECTION2_TABLES[i]
            var known = this._indexOf(this.KNOWN_DENIED_TABLES, t) !== -1
            try {
                var gr = new GlideRecordSecure(t)
                gr.setLimit(1)
                gr.query()
                detail[t] = gr.next() ? 'ok' : 'empty'
            } catch (e) {
                // R-1: `e` untouched — a cross-scope denial's `.message`
                // getter throws again.
                detail[t] = known ? 'DENIED (known limitation — PaToolLogAnalysis only)' : 'DENIED'
                if (!known) unexpectedDenied++
            }
        }

        return { status: unexpectedDenied === 0 ? 'ok' : 'error', detail: detail }
    },

    /** Custom-harness runs stuck at `status:'running'` past their own worker
     *  budget — PaAgentLoop always closes to complete/failed within
     *  BUDGET_MS; a run older than that plus a margin never got a worker at
     *  all, or the worker died mid-flight. Deliberately NOT native runs —
     *  those are §D5's ScheduledScript sweep's job, and R-20 forbids
     *  declaring a native run's completeness from this layer. */
    _checkStuckRuns: function () {
        if (typeof GlideRecord === 'undefined') {
            return { status: 'error', detail: 'GlideRecord unavailable' }
        }

        var cutoff = this._cutoffString(this.STUCK_RUN_BUDGET_MS)
        var count = 0
        try {
            var gr = new GlideRecord(this.RUN_TABLE)
            gr.addQuery('harness', 'custom')
            gr.addQuery('status', 'running')
            gr.addQuery('sys_created_on', '<', cutoff)
            gr.query()
            while (gr.next()) count++
        } catch (e) {
            // R-1: `e` untouched.
            return { status: 'error', detail: 'stuck-run query failed' }
        }

        return { status: count === 0 ? 'ok' : 'error', detail: { stuck_count: count, cutoff: cutoff } }
    },

    // =======================================================================
    // GET /tools
    // =======================================================================

    /** @returns {Object} {status:200, body:{tools:[...]}} — PaToolRegistry.list() verbatim. */
    tools: function () {
        var list = this._tools().list()
        return { status: 200, body: { tools: this._isArray(list) ? list : [] } }
    },

    // =======================================================================
    // readRun / eventQueue seams
    // =======================================================================

    _readRun: function (runId) {
        if (this._readRunFn) return this._readRunFn(runId)
        return this._defaultReadRun(runId)
    },

    /** Plain GlideRecord — see the file header's Build Rule #42 note. The
     *  route's own ownership check (`_ownedByCaller`) is the access control
     *  here, not the ACL layer. */
    _defaultReadRun: function (runId) {
        if (typeof GlideRecord === 'undefined') return null
        try {
            var gr = new GlideRecord(this.RUN_TABLE)
            if (!gr.get(String(runId))) return null
            return {
                run_id: String(runId),
                number: gr.getValue('number') || '',
                user: gr.getValue('user') || '',
                status: gr.getValue('status') || '',
                mode: gr.getValue('mode') || '',
                transcript: this._parseJsonSafe(gr.getValue('transcript')) || [],
                context_summary: gr.getValue('context_summary') || '',
                fix_report: gr.getValue('fix_report') || '',
                error: gr.getValue('error') || '',
            }
        } catch (e) {
            // R-1: `e` untouched.
            return null
        }
    },

    _eventQueue: function (runId, requestJson) {
        if (this._eventQueueFn) return this._eventQueueFn(runId, requestJson)
        return this._defaultEventQueue(runId, requestJson)
    },

    /** `gs.eventQueue('x_snc_troubleshoot.run.start', runGr, run_id,
     *  request_json)` — the brief's exact call shape. Needs a GlideRecord
     *  positioned on the run, not just its id, so this stays behind the
     *  seam rather than living in `_queueDiagnose`. */
    _defaultEventQueue: function (runId, requestJson) {
        if (typeof GlideRecord === 'undefined' || typeof gs === 'undefined') return false
        try {
            var gr = new GlideRecord(this.RUN_TABLE)
            if (!gr.get(String(runId))) return false
            gs.eventQueue(this.RUN_START_EVENT, gr, String(runId), requestJson)
            return true
        } catch (e) {
            // R-1: `e` untouched.
            return false
        }
    },

    // =======================================================================
    // Collaborators — lazily resolved so tests can inject
    // =======================================================================

    _runs: function () {
        return this._runManager || new PaRunManager()
    },

    _tools: function () {
        return this._toolRegistry || new PaToolRegistry()
    },

    _llm: function () {
        return this._llmProxy || new PaLlmProxy()
    },

    // =======================================================================
    // Clock — mirrors PaRunManager's own cutoff math (self-contained; this
    // is a Rhino ES5 file with no module system to share it through)
    // =======================================================================

    _now: function () {
        if (this._nowFn) return this._nowFn()
        try {
            if (typeof GlideDateTime !== 'undefined') return new GlideDateTime().getNumericValue()
        } catch (e) {
            // R-1: `e` untouched.
        }
        try {
            return new Date().getTime()
        } catch (e2) {
            // R-1: `e2` untouched.
            return 0
        }
    },

    _cutoffString: function (windowMs) {
        var nowMs = this._now()
        var cutoffMs = nowMs - windowMs
        return this._formatDateTime(new Date(cutoffMs))
    },

    /** 'YYYY-MM-DD HH:MM:SS' — the same lexically-sortable form
     *  `sys_created_on` is stored and compared in elsewhere in this app. */
    _formatDateTime: function (d) {
        function pad(n) {
            return n < 10 ? '0' + n : String(n)
        }
        return (
            d.getUTCFullYear() +
            '-' +
            pad(d.getUTCMonth() + 1) +
            '-' +
            pad(d.getUTCDate()) +
            ' ' +
            pad(d.getUTCHours()) +
            ':' +
            pad(d.getUTCMinutes()) +
            ':' +
            pad(d.getUTCSeconds())
        )
    },

    // =======================================================================
    // Small helpers (ES5 / Rhino only)
    // =======================================================================

    _parseJsonSafe: function (raw) {
        if (!raw) return null
        try {
            return JSON.parse(raw)
        } catch (e) {
            // R-1: `e` untouched — a corrupted field reads as null rather
            // than crashing the request.
            return null
        }
    },

    _safeStringify: function (value) {
        try {
            var json = JSON.stringify(value)
            return json === undefined ? '{}' : json
        } catch (e) {
            // R-1: `e` untouched.
            return '{}'
        }
    },

    _isPlainObject: function (value) {
        return value !== null && value !== undefined && typeof value === 'object' && !this._isArray(value)
    },

    _isArray: function (value) {
        return Object.prototype.toString.call(value) === '[object Array]'
    },

    _nonEmptyString: function (value) {
        return typeof value === 'string' && this._trim(value).length > 0
    },

    _trim: function (value) {
        return String(value).replace(/^\s+|\s+$/g, '')
    },

    _str: function (value) {
        if (value === null || value === undefined) return ''
        return String(value)
    },

    _indexOf: function (arr, value) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === value) return i
        }
        return -1
    },

    type: 'PaRestHandlers',
}
