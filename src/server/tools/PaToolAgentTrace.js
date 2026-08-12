/**
 * PaToolAgentTrace — AI Agent execution replay (LOW_LEVEL_DESIGN.md §4.1).
 *
 * The first Agent Doctor tool core. Reconstructs one `sn_aia_execution_plan`
 * run into a diagnosable summary: plan header, task tree, tool calls, message
 * stream, mined script errors, failure signatures, latency flags.
 *
 * CONTRACT (LLD §4): execute(args) -> {success: true, data: Object}
 *                                  | {success: false, error: String}
 * Pure objects in and out. No harness knowledge. All reads GlideRecordSecure.
 *
 * ---------------------------------------------------------------------------
 * STANDING RULES THIS FILE IS BUILT AROUND — each cost real hours to find.
 * Sources: DESIGN.md §4 rulings, docs/BUILD_BRIEF_PaToolAgentTrace.md.
 * ---------------------------------------------------------------------------
 *
 * R-1  NEVER touch the exception object in a cross-scope catch. A denial throws
 *      ScopeAccessNotGrantedException; reading `.message` off it throws AGAIN
 *      ("Illegal access to getter method getMessage"), escapes the handler and
 *      500s the whole request. Every catch here records a status and moves on.
 *      LLD §4's "every empty/denied read is an explicit finding" contract
 *      depends on these catches surviving.
 *
 * R-9  Every declared input may be absent. The Phase 0 probe agent never passed
 *      a declared input in ANY run, while its own reasoning text claimed it had.
 *      So: no argument is mandatory, no argument being missing is reported as a
 *      platform fault, and a call with no arguments at all returns something
 *      useful (the recent-executions pick-list).
 *
 * R-6  A wrong field name yields rows with the field silently absent, not an
 *      error — so a typo looks like an empty result rather than a bug. Every
 *      read asserts field presence via isValidField and reports what was
 *      missing in `field_warnings`. Never infer "no data" from an absent field.
 *
 * R-8  A REST/MCP denial says nothing about in-tool readability
 *      (`sn_aia_tools_execution` reads fine from inside a scoped script but is
 *      denied over the Table API). Nothing here is designed around a REST
 *      denial.
 *
 * Trap: execution tasks are NOT 1:1 with tool calls — 27 task rows for 19 tool
 *      calls in a measured run. Tasks and tool calls are read and reported
 *      independently; no join between them is attempted.
 *
 *      Those two numbers belong HERE and nowhere else. Emitting them in the
 *      payload cost six of ten v3 benchmark runs their diagnosis — see
 *      _taskVsToolCallNote and issue #85.
 *
 * Trap: `plan.agent` is often EMPTY on real rows. Agent-name resolution goes
 *      through BOTH `sn_aia_agent` and `sn_aia_usecase` — the usecase is the
 *      reliable anchor.
 *
 * ---------------------------------------------------------------------------
 * SCOPE OF THIS VERSION
 * ---------------------------------------------------------------------------
 * Summary mode only, per docs/BUILD_BRIEF_PaToolAgentTrace.md. Deferred, and
 * announced rather than silently dropped:
 *   - detail mode (`step`) — returns an explicit not_implemented finding
 *   - PaArtifactStore paging for oversized payloads
 *   - prompt-level detail via sn_aia_gen_ai_m2m -> sys_gen_ai_log_metadata
 * All three land with PaArtifactStore (IMPLEMENTATION_PLAN.md Task 4).
 *
 * ---------------------------------------------------------------------------
 * LATENCY THRESHOLDS ARE ASSUMPTIONS, NOT MEASUREMENTS
 * ---------------------------------------------------------------------------
 * LLD §4.1 step 7 specifies the K26 Lab 2 heuristic (slow gen_ai step =>
 * instruction bloat; slow tool step => tool output bloat) but sets no numbers.
 * The constants below are starting values, deliberately absolute rather than
 * relative to the run's own p95 — a run where EVERY call is slow has a high
 * p95 and would flag nothing. The plan's p95 metrics travel with each flag as
 * context. Tune once benchmark runs give a real distribution.
 */
var PaToolAgentTrace = Class.create()

PaToolAgentTrace.prototype = {
    /** Output digest ceiling, LLD §4.1 step 2. */
    DIGEST_CHARS: 200,

    /** A gen_ai (ReAct engine) step slower than this suggests instruction bloat. */
    LLM_SLOW_MS: 15000,

    /** A tool step slower than this suggests tool output bloat. */
    TOOL_SLOW_MS: 10000,

    /** A tool response longer than this inflates the scratchpad every later turn. */
    RESPONSE_BLOAT_CHARS: 20000,

    /** Plan-level llm_token_avg above this corroborates an instruction-bloat call. */
    TOKEN_AVG_BLOAT: 8000,

    /** Latency flags are capped; the dropped count is always stated (never a silent truncation). */
    MAX_LATENCY_FLAGS: 5,

    MAX_PLANS: 10,
    MAX_TASKS: 200,
    MAX_TOOL_CALLS: 100,
    MAX_MESSAGES: 100,
    MAX_CS_MESSAGES: 20,

    /**
     * @param {Object} [options] {readKit} — injection point for tests, matching
     *        every other core. #41: this core was the last one outside
     *        PaToolReadKit, exempted in #36 because it was the only one
     *        verified against real `sn_aia_*` rows and rewriting its read path
     *        mid-stack was risk for no diagnostic gain. The exemption's cost
     *        was real and test-pinned: three sites inferred truncation from
     *        `rows.length >= MAX`, so an EXACTLY-FULL page was reported as
     *        truncated, and it missed R-25 `fromRowRead` and R-26
     *        `denied_tables`/`denial_note` entirely.
     */
    initialize: function (options) {
        var o = options || {}
        this._readKit = o.readKit || null
    },

    _k: function () {
        if (!this._readKit) this._readKit = new PaToolReadKit()
        return this._readKit
    },

    // =======================================================================
    // Entry point
    // =======================================================================

    /**
     * @param {Object|String} args {execution?, agent?, since?, step?, detail?}
     *        May be a JSON string (the native script-tool runtime shape), a bare
     *        sys_id, a bare agent name, or nothing at all.
     * @returns {Object} {success: true, data: {...}} | {success: false, error: String}
     */
    execute: function (args) {
        // Phase is tracked so a failure can name where it died WITHOUT reading
        // the exception object (R-1). This is deliberately better diagnostics
        // than a message we cannot safely touch.
        var phase = 'normalize_args'

        try {
            var a = this._normalizeArgs(args)
            var data = {
                tool: 'PaToolAgentTrace',
                version: 'summary-only',
                resolution: {},
                reads: {},
                field_warnings: [],
                notes: [],
            }

            if (a._parse_error) {
                data.notes.push(
                    'Arguments arrived as a string that looked like JSON but did not parse. ' +
                        'Proceeding as if no arguments were supplied.'
                )
            }

            if (a._prefix_stripped) {
                // LOUDLY (issues #111, #122). Repairing this silently would
                // make the call work and erase the only evidence that the
                // model is malforming arguments — which is how it went
                // unnoticed for a whole smoke: every measure counted which
                // tools were invoked, and this one was.
                //
                // The SLOT is named, not just the raw string. The repair
                // ROUTES the value to the parameter the model named rather
                // than stripping the prefix and falling through (design
                // §3.2), so on a false positive the value lands in a slot the
                // caller did not ask for — naming it is the only way a reader
                // of the transcript can see that happened.
                data.notes.push(
                    'The argument arrived as "' +
                        a._prefix_stripped +
                        '" — the parameter name prefixed onto its own value. It was read as the "' +
                        a._prefix_param +
                        '" parameter. Send the value on its own, or a JSON object, and note that ' +
                        'this call is recorded in the audit trail as it was sent, not as it was ' +
                        'repaired.'
                )
            }

            phase = 'resolve_target'
            var mode = this._resolveMode(a)
            data.resolution.mode = mode
            data.resolution.requested = {
                execution: a.execution || null,
                agent: a.agent || null,
                since: a.since || null,
                step: a.step || null,
            }

            var planSysId = null

            if (mode === 'execution') {
                planSysId = a.execution
            } else if (mode === 'agent') {
                var resolved = this._resolveByAgent(a, data)
                if (!resolved.plan_sys_id) {
                    data.resolution.note = resolved.note
                    data.resolution.candidates = resolved.candidates
                    return this._answer(data)
                }
                planSysId = resolved.plan_sys_id
                data.resolution.matched_agents = resolved.matched_agents
                data.resolution.matched_usecases = resolved.matched_usecases
                data.resolution.candidates = resolved.candidates
                data.resolution.note = resolved.note
            } else {
                var recent = this._recentPlans(a, data)
                data.resolution.candidates = recent.candidates
                data.resolution.note = recent.note
                return this._answer(data)
            }

            // ---- Step 1: plan header -------------------------------------
            phase = 'read_plan'
            var planRead = this._readOne(
                'sn_aia_execution_plan',
                planSysId,
                this.PLAN_FIELDS,
                this.PLAN_DISPLAY,
                data
            )

            if (planRead.status === 'DENIED') {
                data.notes.push(
                    'sn_aia_execution_plan is not readable from scope x_snc_troubleshoot. ' +
                        'This is a cross-scope privilege gap, not an absent execution.'
                )
                return this._answer(data)
            }
            if (!planRead.row) {
                data.notes.push(
                    'No sn_aia_execution_plan row with sys_id "' +
                        planSysId +
                        '". The table read succeeded, so this is a genuine absence, not a permission problem. ' +
                        'An agent that never triggered leaves no plan at all — check triggers via agent_config.'
                )
                return this._answer(data)
            }

            var plan = planRead.row
            data.header = this._buildHeader(plan, planSysId)

            // ---- Step 2: task tree ---------------------------------------
            phase = 'read_tasks'
            var taskRead = this._readRows(
                'sn_aia_execution_task',
                this._eqQuery('execution_plan', planSysId),
                this.TASK_FIELDS,
                this.TASK_DISPLAY,
                this.MAX_TASKS,
                'order',
                data
            )
            var tasks = taskRead.rows
            // Signatures and latency flags read the RAW rows; only the emitted
            // tree is digested.
            data.task_tree = this._buildTaskTree(this._shapeTasks(tasks))
            data.task_stats = this._taskStats(tasks, taskRead)

            // ---- Step 3: tool calls --------------------------------------
            // The join field could not be established in Phase 0 (the REST read
            // was denied — see R-8, and DESIGN.md R-1's open E3 checks). Both
            // candidates are probed and the one actually used is reported, so
            // this run settles the question instead of assuming it.
            phase = 'read_tool_calls'
            var toolCallRead = this._readToolCalls(planSysId, data)
            data.tool_calls = toolCallRead.rows
            data.tool_call_stats = {
                total: toolCallRead.rows.length,
                join_field_used: toolCallRead.join_field_used,
                join_fields_probed: toolCallRead.join_fields_probed,
                join_fields_valid: toolCallRead.join_fields_valid || null,
                read_status: toolCallRead.status,
                note: toolCallRead.note || null,
                truncated_at: toolCallRead.truncated_at || null,
            }
            data.notes.push(this._taskVsToolCallNote(data.task_stats, data.tool_call_stats))

            // ---- Step 4: messages + conversation context -----------------
            phase = 'read_messages'
            var messageRead = this._readRows(
                'sn_aia_message',
                this._eqQuery('execution_plan', planSysId),
                this.MESSAGE_FIELDS,
                this.MESSAGE_DISPLAY,
                this.MAX_MESSAGES,
                // DELIBERATE DEVIATION from LLD §4.1 step 4's "order by
                // message_sequence", forced by real data (DESIGN.md R-15 item 6).
                //
                // On the gpinst01 probe run five of nine rows have an EMPTY
                // message_sequence (the tool-result messages). Empty sorts
                // FIRST, so sequence-primary puts those five ahead of the
                // user's opening message — which was created 26 seconds
                // EARLIER. The stream then reads as though the agent replied
                // before it was asked. Since step 4's whole purpose is showing
                // dialogue progression, that ordering actively misrepresents
                // the run.
                //
                // sys_created_on is the only key populated on every row, so it
                // leads. message_sequence breaks ties within a second (where it
                // IS populated it orders correctly); sys_id makes the result
                // fully deterministic, which the benchmark needs to compare
                // runs. Timestamps travel with every message so a reader can
                // check the ordering rather than trust it.
                ['sys_created_on', 'message_sequence', 'sys_id'],
                data
            )
            data.messages = this._shapeMessages(messageRead.rows)
            // Discharges an open E3 check (DESIGN.md R-1): the sn_aia_message
            // `role` vocabulary was only ever validated against 2026-07-18
            // archaeology, never against a run we caused.
            data.message_stats = {
                total: messageRead.rows.length,
                read_status: messageRead.status,
                observed_roles: this._distinct(messageRead.rows, 'role'),
                documented_roles: ['user_profile', 'user', 'agent'],
            }

            phase = 'read_conversation'
            data.conversation = this._readConversation(plan, data)

            // ---- Step 5: error mining ------------------------------------
            phase = 'mine_script_errors'
            data.script_errors = this._mineScriptErrors(messageRead.rows)

            // ---- Step 6: failure signatures ------------------------------
            phase = 'derive_failure_signatures'
            data.header.failure_signature = this._deriveFailureSignatures(plan, tasks, data.script_errors)

            // ---- Step 7: latency flags -----------------------------------
            phase = 'derive_latency_flags'
            data.latency_flags = this._deriveLatencyFlags(plan, tasks, data.tool_calls)

            // ---- Deferred surface ----------------------------------------
            if (a.step || a.detail === true) {
                data.detail = this._detailDeferredNotice(a.step || null)
            }

            phase = 'finalize'

            return this._answer(data)
        } catch (e) {
            // R-1: the exception object is deliberately NOT read. On a
            // cross-scope denial, touching it throws a second time and escapes
            // this handler entirely. The phase name localises the failure
            // without that risk.
            return {
                success: false,
                error:
                    'PaToolAgentTrace failed during phase "' +
                    phase +
                    '". Exception detail deliberately not read — see DESIGN.md R-1 ' +
                    '(reading a ScopeAccessNotGrantedException throws again and kills the request).',
            }
        }
    },

    // =======================================================================
    // Field lists. Every one is asserted against isValidField (R-6) and any
    // absent field is reported in field_warnings rather than silently yielding
    // a blank.
    // =======================================================================

    PLAN_FIELDS: [
        'sys_id',
        'state',
        'state_reason',
        'status',
        'objective',
        'run_type',
        'execution_mode',
        'execution_channel',
        'usecase',
        'agent',
        'team',
        'worker',
        'conversation',
        'related_task_table',
        'related_task_record',
        'execution_time_ms',
        'execution_time_sec',
        'llm_p95_latency',
        'tool_p95_latency',
        'llm_token_avg',
        'gen_ai_usage_log',
        'sys_created_on',
        'sys_updated_on',
    ],
    PLAN_DISPLAY: [
        'state',
        'state_reason',
        'status',
        'run_type',
        'execution_mode',
        'execution_channel',
        'usecase',
        'agent',
        'team',
        'conversation',
    ],

    // `status` and `type` — NOT `state`/`task_type`. There is no `agent` field
    // on this table (build brief trap 3).
    TASK_FIELDS: [
        'sys_id',
        'execution_plan',
        'parent',
        'order',
        'type',
        'status',
        'description',
        'output',
        'metadata',
        'execution_time_ms',
        'start_time',
        'end_time',
        'og_task_id',
        'task_dependencies',
    ],
    TASK_DISPLAY: ['type', 'status'],

    TOOL_CALL_FIELDS: [
        'sys_id',
        'tool',
        'request',
        'response',
        'error_message',
        'execution_status',
        'execution_mode',
        'run_as_user',
        'execution_time_ms',
        'sys_created_on',
    ],
    TOOL_CALL_DISPLAY: ['tool', 'execution_status', 'execution_mode', 'run_as_user'],

    MESSAGE_FIELDS: [
        'sys_id',
        'execution_plan',
        'message_sequence',
        'role',
        'name',
        'message',
        'user_message',
        'error_type',
        'type',
        'sys_created_on',
    ],
    MESSAGE_DISPLAY: ['role', 'type'],

    // Verified against sys_dictionary on gpinst01, 2026-07-30. The first pass
    // guessed `channel`/`name`/`document_id` here and `text`/`type` on
    // sys_cs_message — none of which exist. field_warnings caught all five,
    // which is exactly what R-6's field-presence assertion is for: the reads
    // had returned blanks, not errors.
    //
    // There is no `channel` field. The nearest thing to the K26 guidebook's
    // "NAP vs VA" channel question is conversation_type + device_type +
    // provenance, so all three are read rather than one being presented as
    // the answer.
    CS_CONVERSATION_FIELDS: [
        'sys_id',
        'conversation_type',
        'device_type',
        'provenance',
        'state',
        'title',
        'topic_definition_name',
        'sys_created_on',
        'conversation_completed',
    ],
    CS_CONVERSATION_DISPLAY: ['conversation_type', 'device_type', 'state'],

    // `payload` is the message text; `message_type` is the type; `sequence` is
    // the sortable counter.
    CS_MESSAGE_FIELDS: [
        'sys_id',
        'conversation',
        'direction',
        'payload',
        'message_type',
        'sequence',
        'sender',
        'is_agent',
        'is_bot_message',
        'status',
        'sys_created_on',
    ],
    CS_MESSAGE_DISPLAY: ['direction', 'message_type', 'status'],

    // =======================================================================
    // Argument handling (R-9)
    // =======================================================================

    /** Every key the object branch below reads, aliases included (#122). */
    PARAM_NAMES: ['execution', 'agent', 'step', 'since', 'detail'],

    /**
     * Tolerant argument normalisation. Accepts an object, a JSON string, a bare
     * sys_id, a bare agent name, or nothing.
     */
    _normalizeArgs: function (args) {
        var raw = args
        var prefixStripped = ''
        var prefixParam = ''

        if (raw === null || raw === undefined) return {}

        if (typeof raw === 'string') {
            var s = this._trim(raw)
            if (!s) return {}

            var parsed = this._tryParse(s)
            if (parsed && typeof parsed === 'object' && !this._isArray(parsed)) {
                raw = parsed
            } else if (s.charAt(0) === '{' || s.charAt(0) === '[') {
                // Meant to be structured and is not. Say so rather than
                // treating the braces as an agent name.
                return { _parse_error: true }
            } else {
                var split = this._splitParamPrefix(s, this.PARAM_NAMES)
                if (split) {
                    raw = {}
                    raw[split.param] = split.value
                    prefixStripped = split.raw
                    prefixParam = split.param
                } else if (this._isSysId(s)) {
                    return { execution: s }
                } else {
                    return { agent: s }
                }
            }
        }

        if (typeof raw !== 'object' || this._isArray(raw)) return {}

        var out = {}
        var execution = this._str(raw.execution)
        var agent = this._str(raw.agent)
        var step = this._str(raw.step)

        if (execution) out.execution = execution
        if (agent) out.agent = agent
        if (step) out.step = step

        var since = this._num(raw.since)
        if (since > 0) out.since = since

        var detail = this._bool(raw.detail)
        if (detail !== null) out.detail = detail

        if (prefixStripped) {
            out._prefix_stripped = prefixStripped
            out._prefix_param = prefixParam
        }

        return out
    },

    /** execution > agent > recent. Never errors on an empty arg set (R-9). */
    _resolveMode: function (a) {
        var args = a || {}
        if (args.execution) return 'execution'
        if (args.agent) return 'agent'
        return 'recent'
    },

    _isSysId: function (v) {
        if (typeof v !== 'string') return false
        if (v.length !== 32) return false
        return /^[0-9a-fA-F]{32}$/.test(v)
    },

    /**
     * A verbatim copy of PaToolReadKit.splitParamPrefix (#122). This tool does
     * not use the kit — migrating it is issue #41, deliberately not done here.
     * Keep the two in step: anchored at the head, the segment before the first
     * separator must equal a parameter name in full, and the CANONICAL spelling
     * is returned so a camelCase parameter is not lower-cased into a key
     * nothing reads.
     */
    _splitParamPrefix: function (s, paramNames) {
        var text = this._trim(s)
        if (!text) return null

        var names = paramNames || []
        if (!names.length) return null

        var cut = text.search(/[:=]/)
        if (cut < 1) return null

        var head = String(this._trim(text.substring(0, cut))).toLowerCase()
        var value = this._trim(text.substring(cut + 1))
        if (!value) return null

        for (var i = 0; i < names.length; i++) {
            if (String(names[i]).toLowerCase() === head) {
                return { param: names[i], value: value, raw: text }
            }
        }

        return null
    },

    // =======================================================================
    // Digesting and error mining
    // =======================================================================

    /** Truncate to `limit`, always marking how much was cut. Never silent. */
    _digest: function (value, limit) {
        var lim = typeof limit === 'number' && limit > 0 ? limit : this.DIGEST_CHARS
        if (value === null || value === undefined) return ''

        var s
        if (typeof value === 'string') {
            s = value
        } else if (typeof value === 'object') {
            try {
                s = JSON.stringify(value)
            } catch (e) {
                s = '[unstringifiable object]'
            }
        } else {
            s = String(value)
        }

        if (s.length <= lim) return s
        // Count from the CLIPPED length — the surrogate guard can shave one
        // more unit, and the marker must state what was actually cut (#137).
        var clipped = this._clipUtf16(s, lim)
        return clipped + '...[+' + (s.length - clipped.length) + ' more chars]'
    },

    /**
     * @param {String} text
     * @param {Number} limit
     * @returns {String} `text` clipped to at most `limit` UTF-16 code units,
     *          never ending on a LONE high surrogate.
     *
     * A VERBATIM COPY of `PaToolReadKit.clipUtf16`, which carries the full
     * rationale. This tool does not use the kit — migrating it is issue #41,
     * deliberately not done here, the same standing ruling that governs
     * `_splitParamPrefix` above (#122). Keep the copies in step:
     * `test/utf16ClipContract.test.js` fails if one drifts.
     *
     * In short: an astral-plane character occupies two UTF-16 code units, a
     * `substring` at `limit` can land between them, and the resulting lone
     * surrogate survives into the transcript and the artifact body but can
     * break their JSON encoding (#106, #137).
     */
    _clipUtf16: function (text, limit) {
        var clipped = text.substring(0, limit)
        if (!clipped) return clipped
        var last = clipped.charCodeAt(clipped.length - 1)
        if (last >= 0xd800 && last <= 0xdbff) {
            return clipped.substring(0, clipped.length - 1)
        }
        return clipped
    },

    /**
     * @param {String} text
     * @param {Number} count
     * @returns {String} the last `count` UTF-16 code units of `text`, never
     *          BEGINNING on a lone low surrogate.
     *
     * A VERBATIM COPY of `PaToolReadKit.clipTailUtf16`. Nothing here clips a
     * tail today; it is carried anyway so the next truncation written in this
     * file finds the guard already present instead of reaching for `substring`
     * — which is exactly how #106's one-site fix became #137's eight sites.
     */
    _clipTailUtf16: function (text, count) {
        var clipped = count >= text.length ? text : text.substring(text.length - count)
        if (!clipped) return clipped
        var first = clipped.charCodeAt(0)
        if (first >= 0xdc00 && first <= 0xdfff) {
            return clipped.substring(1)
        }
        return clipped
    },

    /**
     * LLD §4.1 step 5. An agent-role message whose body parses as JSON carrying
     * `fileName`/`sourceName`/`lineNumber` is a server-script stack error — the
     * single highest-value piece of root-cause evidence in a trace.
     *
     * Verified live shape, from failed execution 78f347b7… :
     *   {"fileName":"sn_aia_usecase.<sys_id>.context_processing_script",
     *    "lineNumber":61, ...}
     *
     * @returns {Object|null} {source, line, error_name, detail}
     */
    _parseScriptError: function (text) {
        if (text === null || text === undefined) return null

        var s = ''
        if (typeof text === 'string') {
            s = text
        } else if (typeof text === 'object') {
            try {
                s = JSON.stringify(text)
            } catch (e) {
                return null
            }
        } else {
            return null
        }
        if (!s) return null

        var obj = this._extractJsonObject(s)
        if (!obj) return null

        var source = obj.fileName || obj.sourceName || obj.script_name || null
        var lineRaw = obj.lineNumber
        var hasLine = lineRaw !== undefined && lineRaw !== null && lineRaw !== ''

        // Neither marker present => ordinary JSON, not a stack error.
        if (!source && !hasLine) return null

        var line = null
        if (hasLine) {
            var n = parseInt(lineRaw, 10)
            if (!isNaN(n)) line = n
        }

        return {
            source: source,
            line: line,
            error_name: obj.name || obj.errorName || obj.type || null,
            detail: this._digest(obj.message || obj.description || '', this.DIGEST_CHARS),
        }
    },

    /** Direct parse first, then the first balanced {...} embedded in prose. */
    _extractJsonObject: function (s) {
        var direct = this._tryParse(s)
        if (this._isPlainObject(direct)) return direct

        var start = s.indexOf('{')
        var attempts = 0
        while (start !== -1 && attempts < 20) {
            attempts++
            var end = this._matchBrace(s, start)
            if (end !== -1) {
                var cand = this._tryParse(s.substring(start, end + 1))
                if (this._isPlainObject(cand)) return cand
            }
            start = s.indexOf('{', start + 1)
        }
        return null
    },

    /** Index of the `}` closing the `{` at `start`, honouring strings/escapes. */
    _matchBrace: function (s, start) {
        var depth = 0
        var inString = false
        var escaped = false

        for (var i = start; i < s.length; i++) {
            var c = s.charAt(i)

            if (escaped) {
                escaped = false
                continue
            }
            if (c === '\\') {
                escaped = true
                continue
            }
            if (c === '"') {
                inString = !inString
                continue
            }
            if (inString) continue

            if (c === '{') depth++
            else if (c === '}') {
                depth--
                if (depth === 0) return i
            }
        }
        return -1
    },

    _mineScriptErrors: function (messages) {
        var out = []
        var rows = messages || []

        for (var i = 0; i < rows.length; i++) {
            var m = rows[i]
            var role = this._lower(m.role)
            // Restrict to agent-role bodies per LLD §4.1 step 5; user text does
            // not carry server stack traces.
            if (role.indexOf('agent') === -1) continue

            var parsed = this._parseScriptError(m.message)
            if (!parsed) continue

            out.push({
                source: parsed.source,
                line: parsed.line,
                error_name: parsed.error_name,
                detail: parsed.detail,
                message_sequence: m.message_sequence,
                message_sys_id: m.sys_id,
                speaker: m.name || null,
            })
        }
        return out
    },

    // =======================================================================
    // Task tree (LLD §4.1 step 2)
    // =======================================================================

    /**
     * LLD §4.1 step 2: emit {order, type, status, description, time_ms,
     * output_digest(200 chars)} — NOT the raw row.
     *
     * This is load-bearing, not cosmetic. A single real ReAct task carries a
     * multi-KB scratchpad in `output`; returning those verbatim produced a 35KB
     * response for an 11-task run on gpinst01, and real runs reach 27 tasks.
     * Summary mode has to stay small enough to sit in a reasoning loop's
     * context — full payloads are what detail mode and PaArtifactStore are for.
     * The true length travels with every digest so nothing is silently lost.
     */
    _shapeTasks: function (tasks) {
        var rows = tasks || []
        var out = []

        for (var i = 0; i < rows.length; i++) {
            var t = rows[i]
            var node = {
                sys_id: t.sys_id,
                parent: t.parent,
                order: t.order,
                type: t.type_display || t.type,
                type_value: t.type,
                status: t.status_display || t.status,
                status_value: t.status,
                description: t.description,
                execution_time_ms: t.execution_time_ms,
                start_time: t.start_time,
                end_time: t.end_time,
                output_digest: this._digest(t.output, this.DIGEST_CHARS),
                output_length: (t.output || '').length,
                metadata_digest: this._digest(t.metadata, this.DIGEST_CHARS),
                metadata_length: (t.metadata || '').length,
            }
            if (t.og_task_id) node.og_task_id = t.og_task_id
            if (t.task_dependencies) node.task_dependencies = t.task_dependencies
            out.push(node)
        }
        return out
    },

    _buildTaskTree: function (tasks) {
        if (!tasks || !tasks.length) return []

        var byId = {}
        var nodes = []
        var i

        for (i = 0; i < tasks.length; i++) {
            var node = this._shallowCopy(tasks[i])
            node.children = []
            byId[node.sys_id] = node
            nodes.push(node)
        }

        var roots = []
        for (i = 0; i < nodes.length; i++) {
            var n = nodes[i]
            var pid = n.parent

            if (!pid) {
                roots.push(n)
                continue
            }

            var parent = byId[pid]
            if (!parent) {
                // Parent exists but is outside this result set (truncation, or
                // a task we cannot read). Surface it — never drop the row.
                n.orphaned = true
                roots.push(n)
                continue
            }

            if (this._createsCycle(n, byId, nodes.length + 1)) {
                n.cycle_detected = true
                roots.push(n)
                continue
            }

            parent.children.push(n)
        }

        this._sortTree(roots)
        return roots
    },

    /** True if walking up from n's parent reaches n again. */
    _createsCycle: function (n, byId, cap) {
        var cursor = byId[n.parent]
        var steps = 0
        while (cursor && steps < cap) {
            if (cursor.sys_id === n.sys_id) return true
            cursor = cursor.parent ? byId[cursor.parent] : null
            steps++
        }
        return steps >= cap
    },

    _sortTree: function (arr) {
        var self = this
        arr.sort(function (x, y) {
            var d = self._num(x.order) - self._num(y.order)
            if (d !== 0) return d
            return String(x.sys_id) < String(y.sys_id) ? -1 : 1
        })
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].children && arr[i].children.length) this._sortTree(arr[i].children)
        }
    },

    _taskStats: function (tasks, read) {
        var rows = tasks || []
        var byStatus = {}
        var byType = {}

        for (var i = 0; i < rows.length; i++) {
            var st = this._lower(rows[i].status) || '(empty)'
            var ty = this._lower(rows[i].type) || '(empty)'
            byStatus[st] = (byStatus[st] || 0) + 1
            byType[ty] = (byType[ty] || 0) + 1
        }

        return {
            total: rows.length,
            read_status: read ? read.status : 'unknown',
            by_status: byStatus,
            by_type: byType,
            truncated_at: read && read.truncated_at ? read.truncated_at : null,
        }
    },

    // =======================================================================
    // Failure signatures (LLD §4.1 step 6)
    // =======================================================================

    _deriveFailureSignatures: function (plan, tasks, scriptErrors) {
        if (!plan) return []

        var sigs = []
        var rows = tasks || []
        var errs = scriptErrors || []
        var state = this._lower(plan.state)
        var reason = this._lower(plan.state_reason)

        // --- K26 Lab 1: ACL-trigger misalignment -------------------------
        // The config looks correct at surface level; only the trace reveals it.
        if (reason === 'security_violation') {
            sigs.push({
                signature: 'acl_trigger_misalignment',
                confidence: 'high',
                finding:
                    'The run terminated with state_reason=security_violation. The trigger invoked the ' +
                    'workflow under the initiating user context, and that user failed the agent or ' +
                    "workflow's User Access or Data Access check.",
                evidence: ['sn_aia_execution_plan.state_reason = security_violation'],
                next_step:
                    'Call agent_config for the triggers section: compare the trigger run_as/run_as_user roles ' +
                    'against the User Access AND Data Access role sets (sys_agent_access_role_configuration, ' +
                    'keyed by agent + agent_table). Both lists must independently cover the invoking role.',
            })
        }

        // --- Same family, seen from the task side ------------------------
        var av = []
        for (var i = 0; i < rows.length; i++) {
            if (this._lower(rows[i].type) !== 'access_verification') continue
            var st = this._lower(rows[i].status)
            if (st === 'success' || st === 'completed') continue
            av.push(rows[i])
        }
        if (av.length) {
            sigs.push({
                signature: 'access_verification_failed',
                confidence: 'high',
                finding:
                    'An access_verification task did not succeed. Same family as ACL-trigger misalignment: ' +
                    'the access check itself is the failing step.',
                evidence: this._taskEvidence(av),
                next_step:
                    'Call agent_config for the triggers section and compare run-as roles against the ' +
                    'User Access / Data Access role sets.',
            })
        }

        // --- Died mid-reasoning ------------------------------------------
        var cancelled = this._byStatus(rows, 'cancelled')
        var ongoing = this._byStatus(rows, 'ongoing')
        if (state === 'terminated' && cancelled.length > 0 && ongoing.length > 0) {
            sigs.push({
                signature: 'died_mid_reasoning',
                confidence: 'high',
                finding:
                    'Terminated run with a cancelled orchestrator task and a leaf task still ongoing — ' +
                    'the reasoning loop stopped partway and left a step hanging.',
                evidence: this._taskEvidence(cancelled).concat(this._taskEvidence(ongoing)),
                next_step:
                    'Read the ongoing task output and the last agent-role message; if script_errors is ' +
                    'non-empty the cause is usually there.',
            })
        }

        // --- Server script threw -----------------------------------------
        if (errs.length > 0) {
            var ev = []
            for (var j = 0; j < errs.length; j++) {
                ev.push(
                    'sn_aia_message[seq ' +
                        errs[j].message_sequence +
                        '] script error in ' +
                        errs[j].source +
                        (errs[j].line === null ? '' : ' line ' + errs[j].line)
                )
            }
            sigs.push({
                signature: 'script_error',
                confidence: 'high',
                finding:
                    'A server-side script threw during the run. The stack was captured in an agent-role ' +
                    'message body — this is the root cause, not a symptom.',
                evidence: ev,
                next_step:
                    'Call agent_config for the instructions section to read the offending script source ' +
                    '(context_processing_script and applicability_script are auto-populated by the platform ' +
                    'and are a verified failure vector — see DESIGN.md R-7).',
            })
        }

        // --- Nothing happened at all --------------------------------------
        if (reason === 'no_activity') {
            sigs.push({
                signature: 'no_activity',
                confidence: 'medium',
                finding:
                    'The plan terminated with state_reason=no_activity — the agent produced no work. ' +
                    'This is a finding in itself, not an empty trace.',
                evidence: ['sn_aia_execution_plan.state_reason = no_activity'],
                next_step:
                    'Check trigger wiring and applicability_script (auto-populated bodies end in ' +
                    '`return false;`, which suppresses the agent silently) via agent_config.',
            })
        }

        return sigs
    },

    _byStatus: function (rows, status) {
        var out = []
        for (var i = 0; i < rows.length; i++) {
            if (this._lower(rows[i].status) === status) out.push(rows[i])
        }
        return out
    },

    _taskEvidence: function (rows) {
        var out = []
        for (var i = 0; i < rows.length; i++) {
            out.push(
                'sn_aia_execution_task[' +
                    rows[i].sys_id +
                    '] type=' +
                    (rows[i].type || '(empty)') +
                    ' status=' +
                    (rows[i].status || '(empty)') +
                    ' description=' +
                    this._digest(rows[i].description, 80)
            )
        }
        return out
    },

    // =======================================================================
    // Latency flags (LLD §4.1 step 7 / K26 Lab 2)
    // =======================================================================

    _deriveLatencyFlags: function (plan, tasks, toolCalls) {
        var p = plan || {}
        var taskRows = tasks || []
        var callRows = toolCalls || []
        if (!taskRows.length && !callRows.length) return []

        var flags = []
        var tokenAvg = this._num(p.llm_token_avg)
        var corroborated = tokenAvg > this.TOKEN_AVG_BLOAT
        var p95Note =
            'plan llm_p95_latency=' +
            (p.llm_p95_latency || 'n/a') +
            ', tool_p95_latency=' +
            (p.tool_p95_latency || 'n/a') +
            ', llm_token_avg=' +
            (p.llm_token_avg || 'n/a')

        var i

        for (i = 0; i < taskRows.length; i++) {
            var t = taskRows[i]
            var ms = this._num(t.execution_time_ms)
            var type = this._lower(t.type)

            if (type === 'gen_ai' && ms > this.LLM_SLOW_MS) {
                flags.push({
                    flag: 'instruction_bloat',
                    target: 'sn_aia_execution_task[' + t.sys_id + ']',
                    target_description: this._digest(t.description, 120),
                    observed_ms: ms,
                    threshold_ms: this.LLM_SLOW_MS,
                    corroborated: corroborated,
                    evidence: [
                        'gen_ai (ReAct engine) step took ' + ms + 'ms, over the ' + this.LLM_SLOW_MS + 'ms threshold',
                        p95Note,
                    ],
                    remediation:
                        'Instructions are reprocessed on every ReAct turn, so their size multiplies. Offload ' +
                        'decision logic to a Now Assist Skill, move reference data (error-code maps, lookup ' +
                        'tables) to KB articles retrieved on demand, and cut inline example conversations.',
                })
            }

            if (type === 'tool' && ms > this.TOOL_SLOW_MS) {
                flags.push({
                    flag: 'tool_output_bloat',
                    target: 'sn_aia_execution_task[' + t.sys_id + ']',
                    target_description: this._digest(t.description, 120),
                    observed_ms: ms,
                    threshold_ms: this.TOOL_SLOW_MS,
                    corroborated: false,
                    evidence: ['tool step took ' + ms + 'ms, over the ' + this.TOOL_SLOW_MS + 'ms threshold', p95Note],
                    remediation:
                        'Return synthesized output rather than raw records, cap result counts, and consolidate ' +
                        'searches the agent always runs in sequence into one parallel-executing Skill.',
                })
            }
        }

        for (i = 0; i < callRows.length; i++) {
            var c = callRows[i]
            var cms = this._num(c.execution_time_ms)
            var len = this._num(c.response_length)
            var slow = cms > this.TOOL_SLOW_MS
            var big = len > this.RESPONSE_BLOAT_CHARS
            if (!slow && !big) continue

            var why = []
            if (slow) why.push('call took ' + cms + 'ms, over the ' + this.TOOL_SLOW_MS + 'ms threshold')
            if (big)
                why.push(
                    'response was ' + len + ' chars, over the ' + this.RESPONSE_BLOAT_CHARS + '-char threshold'
                )
            why.push(p95Note)

            flags.push({
                flag: 'tool_output_bloat',
                target: 'sn_aia_tools_execution[' + c.sys_id + ']',
                target_description: c.tool_name || c.tool_display || c.tool || null,
                observed_ms: cms,
                observed_response_chars: len,
                threshold_ms: this.TOOL_SLOW_MS,
                threshold_response_chars: this.RESPONSE_BLOAT_CHARS,
                corroborated: slow && big,
                evidence: why,
                remediation:
                    'Oversized tool output accumulates in the scratchpad and is re-read on every later turn, ' +
                    'so the cost compounds. Return named structured fields instead of raw record dumps, and ' +
                    'apply setLimit so the result set is bounded.',
            })
        }

        flags.sort(function (x, y) {
            return (y.observed_ms || 0) - (x.observed_ms || 0)
        })

        var total = flags.length
        var kept = flags.slice(0, this.MAX_LATENCY_FLAGS)
        for (i = 0; i < kept.length; i++) {
            kept[i].total_flagged = total
            // No silent caps: say what was dropped.
            kept[i].flags_omitted = total - kept.length
        }
        return kept
    },

    /**
     * The task-vs-tool-call note, built from THIS run's counts (issue #85).
     *
     * The note used to carry the counts of an illustrative run — "Execution
     * tasks are NOT 1:1 with tool calls (27 tasks / 19 calls in a measured
     * run)" — and shipped them in every payload. In the v3 scored benchmark
     * pass (2026.08.0220) SIX OF TEN scored runs plus the smoke run read those
     * two numbers as findings about the run under diagnosis, elevated the
     * supposed discrepancy to a CONFIRMED layer-1 root cause, and stopped
     * looking; one proposed, as its fix, adding a note clarifying task_stats
     * vs tool_call_stats — the note it had itself misread. Seed 03's real
     * answer was sitting in the same payload those runs were reading.
     *
     * A note written to PREVENT a misreading was reliably causing one, and it
     * is a plausible contributor to the depth collapse in #82: a run that
     * believes it found a confirmed defect in its first tool result has no
     * reason to open a second layer.
     *
     * The counts are now the run's own, taken from the same reads that fill
     * task_stats and tool_call_stats. A reader who treats them as run data is
     * now correct, which is the only version of this note that cannot
     * backfire. The guidance itself also sits in the agent_trace tool
     * description, where it is read once at tool-selection time rather than
     * re-read on every call.
     */
    _taskVsToolCallNote: function (taskStats, toolCallStats) {
        var denied = []
        var tasks = this._countPhrase(taskStats, 'execution task(s)', 'sn_aia_execution_task', denied)
        var calls = this._countPhrase(toolCallStats, 'tool call(s)', 'sn_aia_tools_execution', denied)

        var note = 'This run recorded ' + tasks + ' and ' + calls + '. '

        // The denial, if any, leads — it governs how the counts above are to be
        // read, and burying it after the reconciliation guidance would put the
        // caveat behind the thing it qualifies.
        if (denied.length) {
            note +=
                denied.join(' and ') +
                ' could not be read (DENIED). That is a permission gap and says nothing about the run: ' +
                'each "unknown number" above is NOT a zero, and NOT an absence of those rows. '
        }

        return (
            note +
            'Execution tasks and tool calls are not 1:1 and are not expected to match: task_stats ' +
            'counts sn_aia_execution_task rows — the reasoning engine\'s own steps, including ' +
            'orchestrator and access-verification tasks that call no tool — while tool_call_stats ' +
            'counts sn_aia_tools_execution rows. The difference between them is NOT a finding and ' +
            'must not be reported as one.'
        )
    },

    /**
     * One side of the count above, stated only when it was actually measured.
     * Appends `table` to `denied` when it was not, so the caller can explain
     * the gap once in its own sentence rather than inline (an inline clause
     * here produced "…says nothing about the run and 1 tool call(s)", which
     * garden-paths on the conjunction — bad prose in a note whose entire
     * purpose is not being misread).
     *
     * Both totals are `rows.length`, and a cross-scope denial leaves that array
     * as empty as a genuinely empty run does (R-1: the catch records DENIED and
     * moves on without touching the exception). Rendering the denial as "0
     * execution task(s)" asserts a count nobody could read — and contradicts
     * evidence_basis sitting in the same payload, which says a zero with status
     * DENIED "says nothing about the run". R-19b forbids exactly that: a note
     * may never contradict the status beside it.
     *
     * It is also, precisely, the defect class this note was rewritten to fix
     * (issue #85) — a number in a note that is not what it appears to be —
     * except that a fabricated ZERO is the worse shape, because "the agent
     * called no tools" is a confident wrong diagnosis rather than a harmless
     * one. Found in review of that same rewrite.
     *
     * A denial on one read says nothing about the other, so the sides are
     * decided independently.
     */
    _countPhrase: function (stats, noun, table, denied) {
        var s = stats || {}
        if (s.read_status === 'DENIED') {
            denied.push(table)
            return 'an unknown number of ' + noun
        }
        return s.total + ' ' + noun
    },

    _detailDeferredNotice: function (step) {
        return {
            status: 'not_implemented',
            requested_step: step,
            detail:
                'Detail mode (full task output / tool request / tool response, and prompt-level detail via ' +
                'sn_aia_gen_ai_m2m -> sys_gen_ai_log_metadata) is deferred until PaArtifactStore exists — ' +
                'IMPLEMENTATION_PLAN.md Task 4. Full payloads routinely exceed what can be returned inline, ' +
                'so shipping this without paging would truncate evidence silently. The argument was received ' +
                'and is reported here rather than ignored.',
            available_now:
                'Summary mode already returns 200-char digests of every task output and every tool ' +
                'request/response, plus fully parsed script errors.',
        }
    },

    // =======================================================================
    // Reads — all GlideRecordSecure, all denial-safe (R-1), all field-asserted (R-6)
    // =======================================================================

    _eqQuery: function (field, value) {
        return function (gr) {
            gr.addQuery(field, value)
        }
    },

    /**
     * Applies one or more sort keys. Accepts 'field', {field, desc}, or an
     * array of either — a secondary key matters because real rows leave the
     * primary one blank: on gpinst01 five of nine sn_aia_message rows carry an
     * EMPTY message_sequence, so a single-key sort puts them in arbitrary
     * order at the front of the stream.
     */
    _applyOrder: function (gr, orderBy) {
        if (!orderBy) return
        var keys = this._isArray(orderBy) ? orderBy : [orderBy]
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i]
            if (!k) continue
            if (typeof k === 'string') gr.orderBy(k)
            else if (k.desc) gr.orderByDesc(k.field)
            else gr.orderBy(k.field)
        }
    },

    /**
     * Locates the sn_aia_agent_tool_m2m binding for a tool-call row.
     *
     * LLD §2.1 says `sn_aia_tools_execution.tool` holds it. On gpinst01 that
     * field is EMPTY on every real row (verified 2026-07-30) while the binding
     * id sits inside the `request` JSON as `toolM2mId`. Both are checked and
     * the source is reported, so a null tool name is never mistaken for "this
     * run called no tools".
     *
     * @returns {Object} {binding_id, source: 'tool'|'request.toolM2mId'|'none'}
     */
    _extractBindingId: function (row) {
        if (!row) return { binding_id: '', source: 'none' }

        var direct = this._refValue(row.tool)
        if (direct) return { binding_id: direct, source: 'tool' }

        var parsed = this._tryParse(row.request)
        if (this._isPlainObject(parsed)) {
            var fromRequest = this._refValue(parsed.toolM2mId || parsed.tool_m2m_id)
            if (fromRequest) return { binding_id: fromRequest, source: 'request.toolM2mId' }
        }

        return { binding_id: '', source: 'none' }
    },

    /**
     * @param {String|Object} [orderBy] field name, or {field, desc} for descending
     * @returns {Object} {status: 'ok'|'empty'|'DENIED', rows: [], missing_fields: []}
     *
     * Ordering MUST be applied here, at the database, not to the returned rows.
     * Sorting after setLimit() sorts an arbitrary N rows and then describes them
     * as the "most recent" N — which is how the first version of this tool
     * reported plans from June as the newest on an instance whose newest plan
     * was from July. Wrong data wearing a confident label is precisely the
     * failure mode this tool exists to catch in other people's agents.
     */
    // #41 — DELEGATED TO PaToolReadKit. Call sites are unchanged on purpose:
    // this core's value is its tool-specific logic (binding resolution,
    // message ordering, error mining), and rewriting ~40 call sites to reach
    // the kit directly would have risked that logic for no behavioural gain.
    // What the delegation buys is the kit's MEASURED truncation (it reads
    // limit+1, so `truncated_at` is a fact rather than the `rows.length >= MAX`
    // guess this core used), plus R-25 `fromRowRead` and R-26 `denied_tables`.
    _readRows: function (table, queryFn, fields, displayFields, limit, orderBy, data) {
        return this._k().readRows(table, queryFn, fields, displayFields, limit, orderBy, data)
    },

    _readOne: function (table, sysId, fields, displayFields, data) {
        return this._k().readOne(table, sysId, fields, displayFields, data)
    },

    /**
     * R-6: a field that does not exist yields a blank, not an error. Ask the
     * record which of our expected fields it actually has, so an absent field
     * is reported as a schema mismatch rather than read as "no data".
     */
    _missingFields: function (gr, fields) {
        var missing = []
        for (var i = 0; i < fields.length; i++) {
            try {
                if (!gr.isValidField(fields[i])) missing.push(fields[i])
            } catch (e) {
                // isValidField itself unavailable — do not let that abort the
                // read, and do not claim the field is missing when we cannot tell.
                return ['(field presence check unavailable)']
            }
        }
        return missing
    },

    _pluck: function (gr, fields, displayFields) {
        return this._k().pluck(gr, fields, displayFields)
    },

    /**
     * DENIED is sticky. A table that was denied once must not be reported as
     * readable because a later read of it happened to be permitted — the
     * denial is the diagnostically important fact.
     */
    _noteRead: function (data, table, status) {
        if (!data) return
        var prior = data.reads[table]
        if (prior === 'DENIED') return
        if (!prior || status === 'DENIED' || (prior === 'empty' && status === 'ok')) {
            data.reads[table] = status
        }
    },

    _noteFieldWarnings: function (data, table, missing) {
        if (!data || !missing || !missing.length) return
        for (var i = 0; i < data.field_warnings.length; i++) {
            if (data.field_warnings[i].table === table) return
        }
        data.field_warnings.push({
            table: table,
            missing_fields: missing,
            meaning:
                'These field names were requested but do not exist on this table. Any value read from them ' +
                'would be blank — treat that blank as a schema mismatch, not as absent data.',
        })
    },

    // =======================================================================
    // Resolution
    // =======================================================================

    /**
     * `agent` may name an sn_aia_agent OR an sn_aia_usecase. plan.agent is
     * often empty on real rows, so the usecase is the reliable anchor and both
     * are searched.
     */
    _resolveByAgent: function (a, data) {
        var out = { plan_sys_id: null, matched_agents: [], matched_usecases: [], candidates: [], note: '' }
        var name = a.agent
        var self = this

        var agentRead = this._readRows(
            'sn_aia_agent',
            function (gr) {
                var qc = gr.addQuery('name', name)
                qc.addOrCondition('internal_name', name)
                if (self._isSysId(name)) qc.addOrCondition('sys_id', name)
            },
            ['sys_id', 'name', 'internal_name'],
            [],
            10,
            null,
            data
        )
        out.matched_agents = agentRead.rows

        var usecaseRead = this._readRows(
            'sn_aia_usecase',
            function (gr) {
                var qc = gr.addQuery('name', name)
                qc.addOrCondition('internal_name', name)
                if (self._isSysId(name)) qc.addOrCondition('sys_id', name)
            },
            ['sys_id', 'name', 'internal_name'],
            [],
            10,
            null,
            data
        )
        out.matched_usecases = usecaseRead.rows

        var agentIds = this._ids(agentRead.rows)
        var usecaseIds = this._ids(usecaseRead.rows)

        if (!agentIds.length && !usecaseIds.length) {
            out.note =
                'No sn_aia_agent and no sn_aia_usecase matched "' +
                name +
                '" (searched name, internal_name and sys_id on both). Read status — sn_aia_agent: ' +
                agentRead.status +
                ', sn_aia_usecase: ' +
                usecaseRead.status +
                '. If both read "ok" or "empty" this is a genuine name mismatch; if either reads "DENIED" ' +
                'it is a scope privilege gap and the name may well be correct.'
            return out
        }

        var since = a.since
        var planRead = this._readRows(
            'sn_aia_execution_plan',
            function (gr) {
                var qc = null
                if (usecaseIds.length) qc = gr.addQuery('usecase', 'IN', usecaseIds.join(','))
                if (agentIds.length) {
                    if (qc) qc.addOrCondition('agent', 'IN', agentIds.join(','))
                    else qc = gr.addQuery('agent', 'IN', agentIds.join(','))
                }
                if (since) {
                    var gdt = new GlideDateTime()
                    gdt.addSeconds(-1 * since * 60)
                    gr.addQuery('sys_created_on', '>=', gdt)
                }
            },
            ['sys_id', 'state', 'state_reason', 'status', 'objective', 'sys_created_on'],
            ['state', 'state_reason'],
            this.MAX_PLANS,
            { field: 'sys_created_on', desc: true },
            data
        )
        var plans = planRead.rows
        out.candidates = plans

        if (!plans.length) {
            out.note =
                'Matched the name, but found no execution plans' +
                (since ? ' in the last ' + since + ' minutes' : '') +
                '. Read status for sn_aia_execution_plan: ' +
                planRead.status +
                '. An agent that never triggered leaves NO plan — that absence is itself the diagnosis; ' +
                'check trigger wiring via agent_config, triggers section.'
            return out
        }

        out.plan_sys_id = plans[0].sys_id
        out.note =
            'Traced the most recent of ' +
            plans.length +
            ' matching execution plan(s). LLD §4.1 specifies a pick-list when more than one matches; the ' +
            'full list is in resolution.candidates, and the newest is traced as well so a single call ' +
            // #122: `execution=<sys_id>` here taught the exact malformation
            // the guard in _normalizeArgs repairs. Name the value instead.
            'returns usable evidence. Re-call with another plan sys_id on its own to trace a different one.'
        return out
    },

    /** No arguments at all (R-9): hand back something to choose from. */
    _recentPlans: function (a, data) {
        var since = a.since
        var read = this._readRows(
            'sn_aia_execution_plan',
            function (gr) {
                if (since) {
                    var gdt = new GlideDateTime()
                    gdt.addSeconds(-1 * since * 60)
                    gr.addQuery('sys_created_on', '>=', gdt)
                }
            },
            ['sys_id', 'state', 'state_reason', 'status', 'objective', 'usecase', 'agent', 'sys_created_on'],
            ['state', 'state_reason', 'usecase', 'agent'],
            this.MAX_PLANS,
            { field: 'sys_created_on', desc: true },
            data
        )

        var plans = read.rows

        return {
            candidates: plans,
            note:
                'No execution and no agent were supplied, so nothing specific could be traced. The ' +
                plans.length +
                ' most recent execution plan(s)' +
                (since ? ' from the last ' + since + ' minutes' : '') +
                ' are listed above (read status: ' +
                read.status +
                // #122: was `execution=<sys_id> ... agent=<name>`, on the
                // pick-list path — the first thing a model sees when it calls
                // this tool with nothing, and the moment before it retries.
                //
                // #127: that rewrite then offered the agent ONLY as a JSON
                // key, though _normalizeArgs's string branch ends
                // `return { agent: s }` and the description advertises it. The
                // note was steering the model off a supported, simpler shape
                // at the exact moment it retries. "on its own, or a JSON
                // object" is PaToolAgentConfig's register for the same
                // sentence; both halves are offered bare here.
                '). Re-call with one of those plan sys_ids on its own, or an agent or use case name on ' +
                'its own, or a JSON object with agent set to one. This is not an error — a missing ' +
                'argument is expected (DESIGN.md R-9).',
        }
    },

    // =======================================================================
    // Shaping
    // =======================================================================

    /**
     * Normalises a reference value. Real gpinst01 rows carry the LITERAL
     * STRING "undefined" in sn_aia_execution_plan.agent (observed on every
     * security_violation plan, 2026-07-30) — a truthy value that points at
     * nothing. Rendering it as a sys_id would invent a reference that does not
     * exist, and would suppress the "agent is empty, use the usecase" note
     * exactly when it is most needed.
     */
    _refValue: function (v) {
        return this._k().refValue(v)
    },

    _buildHeader: function (plan, planSysId) {
        var agentRef = this._refValue(plan.agent)
        var usecaseRef = this._refValue(plan.usecase)

        return {
            execution_plan: planSysId,
            state: plan.state,
            state_display: plan.state_display || null,
            state_reason: plan.state_reason,
            status: plan.status,
            objective: this._digest(plan.objective, 500),
            run_type: plan.run_type_display || plan.run_type,
            execution_mode: plan.execution_mode_display || plan.execution_mode,
            execution_channel: plan.execution_channel_display || plan.execution_channel,
            usecase: { sys_id: usecaseRef, name: plan.usecase_display || null },
            // plan.agent is often EMPTY (or the literal string "undefined") on
            // real rows — say so explicitly rather than rendering a blank that
            // reads like a missing agent, or a sys_id that points at nothing.
            agent: {
                sys_id: agentRef,
                name: plan.agent_display || null,
                raw: plan.agent,
                note: agentRef
                    ? null
                    : 'plan.agent carries no usable reference (empty, or the literal string "undefined" seen on real rows). This is common and is NOT a fault — the use case is the reliable anchor.',
            },
            team: { sys_id: this._refValue(plan.team), name: plan.team_display || null },
            conversation: this._refValue(plan.conversation),
            related_task: {
                table: this._refValue(plan.related_task_table),
                record: this._refValue(plan.related_task_record),
            },
            timings: {
                execution_time_ms: plan.execution_time_ms,
                execution_time_sec: plan.execution_time_sec,
                llm_p95_latency: plan.llm_p95_latency,
                tool_p95_latency: plan.tool_p95_latency,
                llm_token_avg: plan.llm_token_avg,
            },
            gen_ai_usage_log: plan.gen_ai_usage_log,
            created: plan.sys_created_on,
            updated: plan.sys_updated_on,
        }
    },

    /**
     * The join field on sn_aia_tools_execution could not be established in
     * Phase 0 — the REST read was denied, and per R-8 that says nothing about
     * in-tool access. Both documented candidates are probed and the one used is
     * reported, so this settles the open E3 check on first run.
     */
    _readToolCalls: function (planSysId, data) {
        var candidates = ['execution_plan_id', 'execution_plan']
        var out = { rows: [], status: 'DENIED', join_field_used: null, join_fields_probed: candidates }
        var valid = []

        for (var i = 0; i < candidates.length; i++) {
            var field = candidates[i]
            var fields = this.TOOL_CALL_FIELDS.concat([field])
            var read = this._readRows(
                'sn_aia_tools_execution',
                this._eqQuery(field, planSysId),
                fields,
                this.TOOL_CALL_DISPLAY,
                this.MAX_TOOL_CALLS,
                null,
                data
            )

            out.status = read.status
            if (read.status === 'DENIED') break

            // A field the table does not have would query as blank and could
            // return rows that belong to other plans. Only trust a candidate
            // the table actually declares.
            if (read.missing_fields.length && read.missing_fields.join(',').indexOf(field) !== -1) continue
            valid.push(field)

            if (read.rows.length) {
                out.join_field_used = field
                out.join_fields_valid = valid
                out.rows = this._shapeToolCalls(read.rows, data)
                return out
            }
        }

        out.join_fields_valid = valid
        if (out.status !== 'DENIED' && !out.rows.length) {
            out.note =
                'No sn_aia_tools_execution rows for this plan. Join fields that exist on the table: ' +
                (valid.length ? valid.join(', ') : 'none of the probed candidates') +
                '. If none exist, the join field name is wrong and this empty result is a schema mismatch, ' +
                'not an absence of tool calls.'
        }
        return out
    },

    _shapeToolCalls: function (rows, data) {
        var out = []
        var cache = {}

        for (var i = 0; i < rows.length; i++) {
            var r = rows[i]
            var found = this._extractBindingId(r)
            var binding = this._resolveToolBinding(found.binding_id, cache, data)

            out.push({
                sys_id: r.sys_id,
                // binding -> sn_aia_agent_tool_m2m -> {tool, agent}. NOT a
                // direct reference to sn_aia_tool.
                binding_sys_id: found.binding_id,
                binding_id_source: found.source,
                binding_name: binding ? binding.binding_name : null,
                tool_name: binding ? binding.tool_name : null,
                agent_name: binding ? binding.agent_name : null,
                binding_note: binding ? binding.note || null : null,
                execution_status: r.execution_status_display || r.execution_status,
                execution_mode: r.execution_mode_display || r.execution_mode,
                run_as_user: r.run_as_user_display || r.run_as_user,
                error_message: r.error_message || null,
                execution_time_ms: r.execution_time_ms,
                request_digest: this._digest(r.request, this.DIGEST_CHARS),
                response_digest: this._digest(r.response, this.DIGEST_CHARS),
                request_length: (r.request || '').length,
                response_length: (r.response || '').length,
                created: r.sys_created_on,
            })
        }
        return out
    },

    _resolveToolBinding: function (m2mSysId, cache, data) {
        if (!m2mSysId) return null
        if (cache[m2mSysId]) return cache[m2mSysId]

        var entry = { binding_name: null, tool_name: null, agent_name: null, note: null }
        var read = this._readOne(
            'sn_aia_agent_tool_m2m',
            m2mSysId,
            ['sys_id', 'name', 'tool', 'agent', 'active', 'execution_mode'],
            ['tool', 'agent', 'execution_mode'],
            data
        )

        if (read.status === 'ok' && read.row) {
            entry.binding_name = read.row.name || null
            entry.tool_name = read.row.tool_display || null
            entry.agent_name = read.row.agent_display || null
            entry.execution_mode = read.row.execution_mode_display || read.row.execution_mode || null
            entry.active = read.row.active
        } else {
            entry.note =
                'sn_aia_agent_tool_m2m read returned "' +
                read.status +
                '" for binding ' +
                m2mSysId +
                ' — tool and agent names are unavailable, not absent.'
        }

        cache[m2mSysId] = entry
        return entry
    },

    _shapeMessages: function (rows) {
        var out = []
        for (var i = 0; i < rows.length; i++) {
            var m = rows[i]
            // LLD §4.1 step 4 emits {seq, role, name, content_digest}. The full
            // `message` is deliberately NOT carried: error mining already ran
            // against the raw rows, so nothing downstream needs it, and message
            // bodies are among the largest payloads in a trace.
            out.push({
                seq: m.message_sequence,
                sys_id: m.sys_id,
                role: m.role_display || m.role,
                role_value: m.role,
                name: m.name,
                type: m.type_display || m.type,
                error_type: m.error_type || null,
                created: m.sys_created_on,
                content_digest: this._digest(m.message, this.DIGEST_CHARS),
                content_length: (m.message || '').length,
                user_message_digest: this._digest(m.user_message, this.DIGEST_CHARS),
            })
        }
        return out
    },

    /**
     * K26 guidebook addition (LLD §2.5 item 1): the conversation confirms the
     * channel type (NAP vs VA) and shows where a caller disconnected or got an
     * unexpected reply.
     */
    _readConversation: function (plan, data) {
        var conversationId = this._refValue(plan.conversation)

        if (!conversationId) {
            return {
                present: false,
                note: 'plan.conversation carries no usable reference — no conversation context to read for this run.',
            }
        }

        var convo = this._readOne(
            'sys_cs_conversation',
            conversationId,
            this.CS_CONVERSATION_FIELDS,
            this.CS_CONVERSATION_DISPLAY,
            data
        )

        var row = convo.row
        var out = {
            present: true,
            sys_id: conversationId,
            read_status: convo.status,
            // K26 guidebook (LLD §2.5): the conversation confirms the channel
            // type. sys_cs_conversation has no `channel` field, so the three
            // fields that actually carry that signal are reported as-is rather
            // than one being dressed up as "the channel".
            channel_signals: row
                ? {
                      conversation_type: row.conversation_type_display || row.conversation_type,
                      device_type: row.device_type_display || row.device_type,
                      provenance: row.provenance,
                  }
                : null,
            title: row ? row.title : null,
            topic: row ? row.topic_definition_name : null,
            state: row ? row.state_display || row.state : null,
            completed: row ? row.conversation_completed : null,
            messages: [],
        }

        if (convo.status === 'DENIED') {
            out.note =
                'sys_cs_conversation is not readable from this scope. Channel type (NAP vs VA) and dialogue ' +
                'progression are unavailable — a privilege gap, not an absence.'
            return out
        }

        var csRead = this._readRows(
            'sys_cs_message',
            this._eqQuery('conversation', conversationId),
            this.CS_MESSAGE_FIELDS,
            this.CS_MESSAGE_DISPLAY,
            this.MAX_CS_MESSAGES,
            ['sequence', 'sys_created_on', 'sys_id'],
            data
        )

        for (var i = 0; i < csRead.rows.length; i++) {
            var c = csRead.rows[i]
            out.messages.push({
                sequence: c.sequence,
                direction: c.direction_display || c.direction,
                message_type: c.message_type_display || c.message_type,
                status: c.status_display || c.status,
                sender: c.sender,
                is_agent: c.is_agent,
                is_bot_message: c.is_bot_message,
                text_digest: this._digest(c.payload, this.DIGEST_CHARS),
                text_length: (c.payload || '').length,
                created: c.sys_created_on,
            })
        }
        out.message_read_status = csRead.status
        out.messages_truncated_at = csRead.truncated_at || null
        if (out.messages_truncated_at) {
            out.truncation_note =
                'Only the first ' +
                this.MAX_CS_MESSAGES +
                ' conversation messages are shown. Most are platform ProcessingMessage chatter rather than ' +
                'dialogue. Stated rather than silently dropped; full paging arrives with PaArtifactStore.'
        }
        return out
    },

    /**
     * The failure mode this tool must not have: a plausible-looking summary
     * rendered from empty data. This block states, per section, which rows the
     * output actually came from.
     */
    /**
     * The ONE exit. #41 — found by the R-24/R-25 cross-core contract the moment
     * this core joined the kit-based set: four of the five `return` paths
     * (agent unresolved, recent-plans listing, plan DENIED, plan absent) went
     * out WITHOUT `evidence_basis`, so on exactly the adverse paths where a
     * reader most needs to tell a permission gap from an absence, the field
     * that says which one it was did not exist.
     *
     * The denial path is the sharpest case: it pushed a note saying "this is a
     * cross-scope privilege gap, not an absent execution" and then omitted the
     * structured `denied_tables`/`denial_note` a consumer would parse.
     *
     * Routing every exit through here is what makes that structural rather
     * than four remembered call sites — the same argument R-24 makes about
     * truncations.
     */
    _answer: function (data) {
        data.evidence_basis = this._evidenceBasis(data)
        return { success: true, data: data }
    },

    _evidenceBasis: function (data) {
        var k = this._k()

        // #41 — the two axes this core owed the R-24 contract and did not pay
        // while it was exempt. Both are surfaced whether or not the section
        // that hit the bound thought to mention it; that structural placement
        // is the whole point of R-24, and the reason four review rounds on a
        // sibling core produced four silent caps before it existed.
        var truncations = data.truncations || {}
        var truncationNote = k.anyTruncation(data)
            ? 'One or more reads hit their ceiling — see truncations. Any count or absence derived from ' +
              'those tables is a LOWER BOUND, not a complete answer.'
            : null

        // R-26, the third axis. An empty collection has three causes — nothing
        // matched, the page was clipped, or the read was refused — and they are
        // not interchangeable.
        var denied = k.deniedTables(data)
        var denialNote = denied.length
            ? 'These tables were DENIED: ' +
              denied.join(', ') +
              '. Any empty result above that depends on them is a permission gap, NOT an absence, and ' +
              'must not be reported as one.'
            : null

        return {
            truncations: truncations,
            truncation_note: truncationNote,
            denied_tables: denied,
            denial_note: denialNote,
            statement:
                'Every count below is the number of rows actually read. A zero with read status "ok"/"empty" ' +
                'is a genuine absence; a zero with "DENIED" is a permission gap and says nothing about the run.',
            plan_rows: data.header ? 1 : 0,
            task_rows: data.task_stats ? data.task_stats.total : 0,
            tool_call_rows: data.tool_calls ? data.tool_calls.length : 0,
            message_rows: data.messages ? data.messages.length : 0,
            script_errors_found: data.script_errors ? data.script_errors.length : 0,
            conversation_message_rows: data.conversation && data.conversation.messages ? data.conversation.messages.length : 0,
            read_status_by_table: data.reads,
            tables_with_missing_fields: data.field_warnings.length,
        }
    },

    // =======================================================================
    // Small helpers (ES5 / Rhino only — no let/const, arrow, Set or Map)
    // =======================================================================

    /**
     * Realm-safe array check. `instanceof Array` compares against the Array
     * constructor of the CURRENT realm, so it returns false for an array that
     * crossed a boundary — a Java-backed list from a scoped REST
     * `request.queryParams`, or a value from another script context. The
     * toString form asks the value what it IS rather than where it came from.
     */
    _isArray: function (v) {
        return Object.prototype.toString.call(v) === '[object Array]'
    },

    _tryParse: function (s) {
        try {
            return JSON.parse(s)
        } catch (e) {
            return null
        }
    },

    _isPlainObject: function (v) {
        return v !== null && typeof v === 'object' && !this._isArray(v)
    },

    _shallowCopy: function (o) {
        var out = {}
        var keys = Object.keys(o)
        for (var i = 0; i < keys.length; i++) out[keys[i]] = o[keys[i]]
        return out
    },

    _trim: function (s) {
        return String(s).replace(/^\s+|\s+$/g, '')
    },

    _str: function (v) {
        if (v === null || v === undefined) return ''
        var s = this._trim(String(v))
        return s
    },

    _num: function (v) {
        if (v === null || v === undefined || v === '') return 0
        var n = Number(v)
        return isNaN(n) ? 0 : n
    },

    _bool: function (v) {
        if (v === true || v === false) return v
        if (v === 'true') return true
        if (v === 'false') return false
        return null
    },

    _lower: function (v) {
        if (v === null || v === undefined) return ''
        return String(v).toLowerCase()
    },

    _ids: function (rows) {
        var out = []
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].sys_id) out.push(rows[i].sys_id)
        }
        return out
    },

    _distinct: function (rows, field) {
        var seen = {}
        var out = []
        for (var i = 0; i < rows.length; i++) {
            var v = rows[i][field]
            if (v === null || v === undefined || v === '') v = '(empty)'
            if (seen[v]) continue
            seen[v] = true
            out.push(v)
        }
        return out
    },

    type: 'PaToolAgentTrace',
}
