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
        var elided = text.length - head - tail

        return (
            text.substring(0, head) +
            '\n…[elided ' +
            elided +
            ' chars]…\n' +
            text.substring(text.length - tail)
        )
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
        return value.length > max ? value.substring(0, max) : value
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
