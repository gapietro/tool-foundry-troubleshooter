/**
 * PaAuditLogger — the tool-execution audit trail (LOW_LEVEL_DESIGN.md §4.6,
 * table §3.2).
 *
 * WHAT THIS EXISTS FOR
 * `PaScriptToolAdapter` calls it immediately before and immediately after every
 * tool execution (§4.7). Three rows around a call is the intended shape, not
 * overhead: the **intent** row is written before the tool runs, so it is the
 * only evidence that survives when a tool never returns at all — the silent
 * never-terminating stall R-5 found is exactly that failure, and it leaves no
 * result row and no error row to look at.
 *
 * CONTRACT
 *   logIntent({runId, toolName, input, targetTable, targetRecord})
 *   logResult({runId, toolName, output, ...})
 *   logError({runId, toolName, error, ...})
 *     -> {logged:true, audit_id} | {logged:false, degraded:<reason>}
 *   invokedTools(runId)  -> which tools this run called, deduplicated (#79)
 *   toolCalls(runId)     -> every call, in order, with its payload (#96)
 *     -> {available:true, ...} | {available:false, degraded:<reason>, ...}
 *
 * ---------------------------------------------------------------------------
 * THE PROPERTY THAT MATTERS MOST
 * ---------------------------------------------------------------------------
 * This component sits in the hot path of every tool call, so it must be
 * incapable of taking a tool down with it. A diagnosis that fails because its
 * own audit logging threw is a strictly worse outcome than a diagnosis with a
 * gap in its audit trail. Every public method is therefore total: it returns a
 * result object for any input, including no input, and never propagates a
 * throw. `logged:false` with a named reason is a legitimate answer (R-10); an
 * exception escaping into the orchestrator is not.
 *
 * The corollary is that a missing run anchor does NOT suppress the row. When
 * PaRunAnchor degrades, the audit row still lands — orphaned, flagged — because
 * dropping it too would lose the trail at the exact moment the system is
 * already failing and the trail is most worth having.
 *
 * ---------------------------------------------------------------------------
 * PAYLOAD DISCIPLINE
 * ---------------------------------------------------------------------------
 * Payloads are digested head+tail past a ceiling. Two reasons, and the second
 * is the real one: (a) the columns are 65,536 chars and a real trace summary is
 * ~35KB, so a handful of calls would put megabytes of duplicated payload in the
 * audit table; (b) by the time `logResult` runs, `PaArtifactStore.applyThreshold`
 * has ALREADY replaced any oversized result with an excerpt-plus-`artifact_id`
 * envelope (§4.7 ordering). Re-storing the full payload here would undo that
 * work in a different table. The `artifact_id` sits near the front of the
 * envelope's JSON, so the head of the digest keeps the pointer that makes the
 * row actionable.
 *
 * ---------------------------------------------------------------------------
 * STANDING RULES THIS FILE IS BUILT AROUND
 * ---------------------------------------------------------------------------
 * R-1  Never touch the exception object in a catch — reading `.message` off a
 *      ScopeAccessNotGrantedException throws again and escapes the handler.
 * R-6  A wrong field name returns a blank, not an error. Hence the caller-alias
 *      tolerance below: Task 9 writes the adapter that calls this, and a key
 *      mismatch between the two would surface as an empty column rather than a
 *      failure anyone would notice.
 * R-9  Every input may be absent, and arrives as a string when it is not.
 * R-10 Degrade explicitly with a named reason.
 *
 * Build Rule #42: plain `GlideRecord`, not `GlideRecordSecure` — a Fluent
 * `Table()` installs with zero ACLs, so the secure variant would deny this app
 * write access to its own audit table.
 */
var PaAuditLogger = Class.create()

PaAuditLogger.prototype = {
    AUDIT_TABLE: 'x_snc_troubleshoot_audit',

    /** Past this, `input`/`output` are digested. See PAYLOAD DISCIPLINE. */
    MAX_PAYLOAD_CHARS: 4000,

    /** Head/tail split of the digest — the front is where the shape and any
     *  artifact_id live; the tail is where an error or summary tends to sit. */
    DIGEST_HEAD_CHARS: 3000,
    DIGEST_TAIL_CHARS: 1000,

    /** Column widths from tables.now.ts — a longer value is trimmed, not lost
     *  to a silent platform truncation at a boundary nobody chose. */
    MAX_TOOL_NAME_CHARS: 100,
    MAX_TABLE_NAME_CHARS: 80,
    MAX_RECORD_ID_CHARS: 32,

    /** The only values `retrieval` may take (#121). See `_retrievalValue`. */
    RETRIEVAL_VALUES: ['ok', 'none', 'unknown'],

    /**
     * @param {Object} [options] {auditTable, maxPayloadChars} — for tests and
     *        for callers with a different budget.
     */
    initialize: function (options) {
        if (!options) return
        if (options.auditTable) this.AUDIT_TABLE = String(options.auditTable)
        if (options.maxPayloadChars > 0) this.MAX_PAYLOAD_CHARS = options.maxPayloadChars
    },

    // =======================================================================
    // The three entry points
    // =======================================================================

    /** Written BEFORE the tool runs — the only trace of a call that hangs. */
    logIntent: function (params) {
        return this._write('intent', params, ['input'])
    },

    logResult: function (params) {
        return this._write('result', params, ['output', 'result'])
    },

    logError: function (params) {
        return this._write('error', params, ['error', 'output'])
    },

    // =======================================================================
    // The read side
    // =======================================================================

    /**
     * The ONLY reader of this table in the codebase. #79: a Fix Report
     * citation names a source; this answers which tools the run actually
     * invoked, so PaFixReport can tell a real citation from an invented one.
     *
     * EVERY action_type counts — intent, result and error alike. The intent
     * row is written BEFORE the tool runs (see the header), so a tool that
     * hung or threw still means the model looked. This answers exactly one
     * question — was this tool ever invoked in this run — which is the
     * question fabrication fails. Whether what the tool returned supports the
     * claim is the model's problem, not this method's.
     *
     * A TAGGED result, not a bare array: "no tools were called" and "the
     * trail is unreadable" must not be the same value. A run that reached a
     * fix report necessarily called at least one tool, so zero rows means the
     * trail failed — and a failed trail must not convict an honest report.
     * Every degraded branch still carries `tools: []` so callers never need a
     * null check.
     *
     * WHAT THIS CANNOT DETECT: a PARTIAL trail. `_write` swallows a per-row
     * `insert_failed` (R-10 — it degrades rather than throwing), so if 3 of 5
     * rows for a run land and 2 silently don't, this method has no way to
     * distinguish that from "all 5 landed" — it only ever sees the 3 that
     * made it and reports them as the complete picture. A citation resting on
     * the 2 missing rows would be treated as unsupported (fails toward NOT
     * checking that tool, never toward a false convict), and a citation
     * resting on one of the 3 that landed still passes correctly — so this
     * gap cannot turn an honest report invalid, but it CAN let a genuinely
     * unsupported claim through unnoticed if the row that would have proven
     * it is exactly the one that didn't land. Only a SYSTEMATIC failure (every
     * row for a run lost) is caught here, because that degrades to zero rows
     * and `_noTools('no_audit_rows')` fails open correctly. Do not assume
     * `tools.length > 0` implies total coverage of everything the run did.
     *
     * Build Rule #42: plain GlideRecord — the table has no ACLs, so
     * GlideRecordSecure would deny this app read access to its own trail.
     *
     * `retrievingTools` (#121) is the subset of `tools` with at least one
     * `result` row at `retrieval = 'ok'` — the tools that actually fetched
     * rows, as opposed to the tools that merely ran. A BLANK column is never
     * `ok`: rows written before #121 carry no verdict and must not read back
     * as one in either direction.
     *
     * `tools` is unchanged and stays the answer to "was this tool ever
     * invoked in this run", which is the question fabrication fails (#79). A
     * citation to a tool that ran and returned nothing is a WEAK citation, not
     * a fabricated one, and `_auditContext` must keep convicting on the right
     * charge.
     *
     * @param {*} runId sys_id of the run row; may be absent or non-string (R-9)
     * @returns {Object} {available:true, tools:[String], retrievingTools:[String]}
     *                 | {available:false, degraded:String, tools:[], retrievingTools:[]}
     */
    invokedTools: function (runId) {
        try {
            var id = this._trim(this._norm(runId), this.MAX_RECORD_ID_CHARS)
            // Without a run filter the query would return the whole table —
            // every other run's tools, read as this run's evidence.
            if (!id) return this._noTools('no_run_id')
            if (typeof GlideRecord === 'undefined') return this._noTools('glide_unavailable')

            var gr = new GlideRecord(this.AUDIT_TABLE)
            gr.addQuery('run', id)
            gr.query()

            var tools = []
            var retrieving = []
            while (gr.next()) {
                var name = this._normToolName(gr.getValue('tool_name'))
                if (!name) continue
                if (this._indexOfTool(tools, name) === -1) tools.push(name)

                // #121: the SAME pass, deliberately. This method is on the
                // fix-report path and runs again per depth-gate check; a
                // second query for one column would double its cost for
                // nothing.
                //
                // action_type must be checked here too, not left to the
                // `_write` invariant that only ever sets `retrieval` on a
                // `result` row (#121 review finding 2). That invariant lives
                // in a DIFFERENT method from this read, and the docblock
                // above promises "a `result` row at `retrieval = 'ok'`" — a
                // promise this check now enforces directly rather than
                // trusting the writer never to change.
                if (
                    this._norm(gr.getValue('action_type')) === 'result' &&
                    this._norm(gr.getValue('retrieval')) === 'ok' &&
                    this._indexOfTool(retrieving, name) === -1
                ) {
                    retrieving.push(name)
                }
            }

            if (tools.length === 0) return this._noTools('no_audit_rows')
            return { available: true, tools: tools, retrievingTools: retrieving }
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            return this._noTools('query_failed')
        }
    },

    _noTools: function (reason) {
        return { available: false, degraded: reason, tools: [], retrievingTools: [] }
    },

    /**
     * `invokedTools`'s sibling: the same rows, with what each call actually
     * carried. #96.
     *
     * WHY BOTH EXIST. `invokedTools` answers "was this tool ever invoked in
     * this run", which is the question fabrication fails, and it collapses
     * repeats to do it. That collapse is exactly wrong for the question #96
     * asks — *which* `agent_config` call reached the instructions section —
     * where two calls to one tool are two different facts. So this returns
     * every row, in creation order, undeduplicated.
     *
     * WHY THE PAYLOAD AND NOT JUST THE ARGUMENT. #96 was filed to grade an
     * exposure claim from the recorded `input`, and the measurement it drove
     * showed the argument alone cannot settle it: three `agent_config` calls
     * named no `section` — which returns all four — and still returned
     * `sections_returned: []`, because the agent they named resolved to no
     * record. The claim was only decidable from the RESULT payload. A reader
     * that returned arguments alone would have graded those three as exposed
     * and been wrong on all three, which is the same by-label-not-by-fact
     * defect (#79) the audit trail exists to settle.
     *
     * `payload` is `input` on an intent row and `output` on a result or error
     * row, mirroring what `_write` populates — reading the other column would
     * return a blank, R-6's failure shape aimed at the read side.
     *
     * WHAT THIS CANNOT TELL YOU, and both limits are load-bearing:
     *
     *   1. **The payload is DIGESTED past MAX_PAYLOAD_CHARS** (head + tail —
     *      see PAYLOAD DISCIPLINE). A value in the elided middle is absent
     *      here while being present in what the model actually received. So a
     *      HIT is evidence; a MISS is not evidence of absence, and a caller
     *      searching for a string must say which of the two it found. The
     *      `artifact_id` in the head is the route to the full text.
     *   2. **Intent rows do not pair with result rows.** The table carries no
     *      call id, and `created` is second-granularity — ties are the normal
     *      case in a burst, not an exotic one. `created` is here so a human
     *      can line a call up against an execution trace, NOT so a caller can
     *      match an argument to its result. A tool called twice in one second
     *      cannot be paired from this data, and inventing the pairing would
     *      put a made-up fact into the one place the project treats as ground
     *      truth.
     *
     * `invokedTools`'s partial-trail caveat applies here unchanged, and this
     * method deliberately does NOT layer on top of it: doing so would make
     * every #79 citation check read two 4,000-char payload columns per row
     * that it never looks at, on the fix-report path.
     *
     * @param {*} runId sys_id of the run row; may be absent or non-string (R-9)
     * @returns {Object} {available:true, calls:[{tool,action,payload,created}]}
     *                 | {available:false, degraded:String, calls:[]}
     */
    toolCalls: function (runId) {
        try {
            var id = this._trim(this._norm(runId), this.MAX_RECORD_ID_CHARS)
            // Same reason as invokedTools: an unfiltered query would return
            // every other run's calls, read as this run's evidence.
            if (!id) return this._noCalls('no_run_id')
            if (typeof GlideRecord === 'undefined') return this._noCalls('glide_unavailable')

            var gr = new GlideRecord(this.AUDIT_TABLE)
            gr.addQuery('run', id)
            gr.orderBy('sys_created_on')
            gr.query()

            var calls = []
            while (gr.next()) {
                var name = this._normToolName(gr.getValue('tool_name'))
                // A nameless row cannot be attributed to a tool, so it cannot
                // be evidence about one — skipped, as in invokedTools.
                if (!name) continue

                var action = this._normToolName(gr.getValue('action_type'))
                calls.push({
                    tool: name,
                    action: action,
                    payload: this._norm(
                        action === 'intent' ? gr.getValue('input') : gr.getValue('output')
                    ),
                    created: this._norm(gr.getValue('sys_created_on')),
                })
            }

            if (calls.length === 0) return this._noCalls('no_audit_rows')
            return { available: true, calls: calls }
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            return this._noCalls('query_failed')
        }
    },

    _noCalls: function (reason) {
        return { available: false, degraded: reason, calls: [] }
    },

    /**
     * Normalized the way PaToolRegistry._normName normalizes — the registry
     * and this trail already share one tool vocabulary by construction
     * (PaToolRegistry.js:25), and #79 is the first thing that would break if
     * they ever drift, which is a feature.
     */
    _normToolName: function (value) {
        return String(value === null || value === undefined ? '' : value).replace(/^\s+|\s+$/g, '')
    },

    /** ES5: no Array.prototype.indexOf assumptions on Rhino. */
    _indexOfTool: function (list, value) {
        for (var i = 0; i < list.length; i++) {
            if (list[i] === value) return i
        }
        return -1
    },

    // =======================================================================
    // Internals
    // =======================================================================

    /**
     * The one write path. Total by construction: the whole body is guarded, so
     * any input at all produces a result object rather than a throw.
     *
     * The params are parsed ONCE here and the payload is picked off the parsed
     * form. Picking it off the raw argument instead loses the payload whenever
     * a caller passes params as a JSON string — the fields would come back
     * populated and `input` would be silently empty, which is R-6's blank-not-
     * an-error failure shape aimed at the audit trail itself.
     *
     * @param {String} actionType  intent|result|error, matching the ChoiceColumn
     * @param {Object|String} params  caller params, possibly absent or junk
     * @param {Array} payloadKeys  param names to record, first one present wins
     */
    _write: function (actionType, params, payloadKeys) {
        try {
            var parsed = this._parse(params)
            var p = this._normParams(parsed)
            var runId = p.runId
            var text = this._digest(this._pick(parsed, payloadKeys))

            if (typeof GlideRecord === 'undefined') {
                return { logged: false, audit_id: null, degraded: 'glide_unavailable' }
            }

            var gr = new GlideRecord(this.AUDIT_TABLE)
            gr.initialize()
            gr.setValue('action_type', actionType)
            gr.setValue('tool_name', p.toolName)
            if (runId) gr.setValue('run', runId)
            if (p.userId) gr.setValue('user', p.userId)
            if (p.targetTable) gr.setValue('target_table', p.targetTable)
            if (p.targetRecord) gr.setValue('target_record', p.targetRecord)

            // ALWAYS false in Phase 1a, and not settable by a caller — see the
            // note on `_normParams`. Phase 2's confirmation gate sets this from
            // whatever workflow actually collects the confirmation, which is
            // the only thing that can honestly assert it.
            gr.setValue('confirmed_by_user', 'false')

            // Intent records what went IN; result and error record what came out.
            if (actionType === 'intent') gr.setValue('input', text)
            else gr.setValue('output', text)

            // #121: RESULT rows only. An intent row has no result to classify,
            // and an error row already carries its failure in `output` — a
            // redundant `none` there would invite a reader to count error rows
            // into a denominator built from result rows.
            if (actionType === 'result' && p.retrieval) gr.setValue('retrieval', p.retrieval)

            var sysId = gr.insert()
            if (!sysId) return { logged: false, audit_id: null, degraded: 'insert_failed' }

            var out = { logged: true, audit_id: String(sysId) }
            // The row exists but is orphaned — worth saying, since a run-less
            // audit row cannot be found by walking back from a run record.
            if (!runId) out.degraded = 'no_run_anchor'
            return out
        } catch (e) {
            // R-1: `e` is deliberately not inspected — and this catch is also
            // the outer guard that makes the method total. Anything at all that
            // went wrong lands here as a named degradation rather than as an
            // exception in the middle of somebody's tool call.
            return { logged: false, audit_id: null, degraded: 'insert_failed' }
        }
    },

    /**
     * R-9 + R-6. Accepts `runId`/`run` and `toolName`/`tool` alike: Task 9
     * writes the caller, and a key mismatch across that boundary would show up
     * as a permanently blank column rather than as an error.
     *
     * WHAT IT DELIBERATELY DOES *NOT* ACCEPT — server-authoritative fields.
     * `user` and `confirmed_by_user` are not caller-settable, and the params
     * carrying them are ignored rather than honoured (security review on PR
     * #21, two Medium findings):
     *
     *   `user` comes from `gs.getUserID()`, always. The caller here is the
     *   Task 9 adapter, and part of what reaches the adapter is LLM-derived —
     *   a trace payload is a plausible prompt-injection carrier, which is the
     *   same threat model that made PaArtifactStore.read() refuse foreign
     *   attachments. An audit trail whose *actor* field is supplied by the
     *   thing being audited is not an audit trail.
     *
     *   `confirmed_by_user` is written false unconditionally. Phase 1a is
     *   read-only, so a true value cannot be honest yet, and a forged
     *   confirmation is worse than an absent feature. When Phase 2 adds the
     *   confirmation gate, the workflow that actually collects the
     *   confirmation sets it — not whoever is calling a tool.
     *
     * Neither override had a consumer: nothing calls this component yet except
     * the self-test route, so removing them costs nothing today and closes the
     * hole before Task 9 makes it reachable.
     */
    _normParams: function (raw) {
        var toolName = this._norm(raw.toolName || raw.tool || raw.tool_name)

        return {
            runId: this._trim(this._norm(raw.runId || raw.run || raw.run_id), this.MAX_RECORD_ID_CHARS),
            // tool_name is this table's DISPLAY field — a blank one renders the
            // row as an unnamed entry in every list and every reference.
            toolName: this._trim(toolName || 'unknown', this.MAX_TOOL_NAME_CHARS),
            userId: this._currentUser(),
            targetTable: this._trim(
                this._norm(raw.targetTable || raw.target_table),
                this.MAX_TABLE_NAME_CHARS
            ),
            targetRecord: this._trim(
                this._norm(raw.targetRecord || raw.target_record),
                this.MAX_RECORD_ID_CHARS
            ),
            // #121. Unlike `user` and `confirmed_by_user` above, this IS
            // caller-settable: it is derived by our own dispatch code from the
            // tool core's result, not asserted by the LLM-derived payload. It
            // is whitelisted all the same — see `_retrievalValue`.
            retrieval: this._retrievalValue(raw.retrieval),
        }
    },

    /** R-9: params may be an Object, a JSON string, junk, or absent. */
    _parse: function (params) {
        var raw = params
        if (typeof raw === 'string') {
            try {
                raw = JSON.parse(raw)
            } catch (e) {
                // R-1: `e` untouched.
                raw = null
            }
        }
        if (!raw || typeof raw !== 'object') return {}
        return raw
    },

    /** First of `keys` that the caller actually supplied. */
    _pick: function (params, keys) {
        for (var i = 0; i < keys.length; i++) {
            var v = params[keys[i]]
            if (v !== undefined && v !== null) return v
        }
        return null
    },

    /** Head + elision marker + tail, past the ceiling. */
    _digest: function (value) {
        var text = this._stringify(value)
        if (text.length <= this.MAX_PAYLOAD_CHARS) return text

        var ratio = this.DIGEST_HEAD_CHARS / (this.DIGEST_HEAD_CHARS + this.DIGEST_TAIL_CHARS)
        var head = Math.floor(this.MAX_PAYLOAD_CHARS * ratio)
        var tail = this.MAX_PAYLOAD_CHARS - head

        // #137: BOTH cuts land at an arbitrary code-unit index, so the head can
        // end on an orphaned high surrogate and the tail can begin on an
        // orphaned low one. The elided count is then taken from what the guards
        // actually kept, so the marker stays exact.
        var headText = this._clipUtf16(text, head)
        var tailText = this._clipTailUtf16(text, tail)
        var elided = text.length - headText.length - tailText.length

        return headText + '\n…[elided ' + elided + ' chars]…\n' + tailText
    },

    /**
     * Strings pass through as themselves — §4.7 Note 4 has the adapter pass
     * bare strings to the cores unchanged, and the audit trail should show what
     * the tool actually received, not a re-wrapped version of it.
     */
    _stringify: function (value) {
        if (value === null || value === undefined) return ''
        if (typeof value === 'string') return value
        try {
            var json = JSON.stringify(value)
            if (json !== undefined) return json
        } catch (e) {
            // R-1: `e` untouched. Circular structures and a throwing `toJSON`
            // both land here.
        }
        try {
            return String(value)
        } catch (e2) {
            // R-1 again: a throwing `toString` is not going to cost a tool call.
            return '[unserialisable payload]'
        }
    },

    /** LLD §4: the literal `"undefined"` is truthy and must read as empty. */
    _norm: function (value) {
        if (value === null || value === undefined) return ''
        var s = String(value)
        if (s === '' || s === 'undefined' || s === 'null') return ''
        return s
    },

    _trim: function (value, max) {
        return value.length > max ? this._clipUtf16(value, max) : value
    },

    /**
     * @param {String} text
     * @param {Number} limit
     * @returns {String} `text` clipped to at most `limit` UTF-16 code units,
     *          never ending on a LONE high surrogate.
     *
     * A VERBATIM COPY of `PaToolReadKit.clipUtf16`, which carries the full
     * rationale. This Script Include holds no kit reference, and it sits inside
     * the hot path — PaScriptToolAdapter calls it immediately before and after
     * every tool execution — so a shared helper would add a cross-Script-Include
     * instantiation per call. Same ruling as `PaToolAgentTrace._splitParamPrefix`
     * (#122). Keep the copies in step: `test/utf16ClipContract.test.js` fails if
     * one drifts.
     *
     * In short: an astral-plane character occupies two UTF-16 code units, a
     * `substring` at `limit` can land between them, and the resulting lone
     * surrogate survives into the audit row but can break its JSON encoding and
     * the XML export of the record (#106, #137). Used by `_digest` and `_trim`.
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
     * A VERBATIM COPY of `PaToolReadKit.clipTailUtf16`. `_digest` keeps a head
     * AND a tail, and the tail's cut is what `clipUtf16` cannot reach: it trims
     * the wrong end.
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
     * One of RETRIEVAL_VALUES, or blank (#121).
     *
     * A ChoiceColumn accepts an unlisted value silently, so an unrecognised
     * verdict would sit in the audit trail looking like a fact. R-6 in its
     * purest form: blank is honest, junk is not.
     *
     * Deliberately does NOT route through `_norm` (which coerces via
     * `String(value)`): `String(['ok'])` is the JS string `'ok'`, not
     * `'ok'`'s absence — a single-element array would silently pass the
     * whitelist below and land in the audit column as if it were a real
     * verdict. Requiring `typeof value === 'string'` up front closes that.
     */
    _retrievalValue: function (value) {
        if (typeof value !== 'string') return ''
        for (var i = 0; i < this.RETRIEVAL_VALUES.length; i++) {
            if (this.RETRIEVAL_VALUES[i] === value) return value
        }
        return ''
    },

    /** The session's user, and nothing else. See `_normParams`. */
    _currentUser: function () {
        try {
            return this._norm(gs.getUserID())
        } catch (e) {
            // R-1: `e` untouched. A blank actor is honest; a caller-supplied
            // one would not be.
            return ''
        }
    },

    type: 'PaAuditLogger',
}
