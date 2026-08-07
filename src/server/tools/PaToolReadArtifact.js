/**
 * PaToolReadArtifact — the `read_artifact` tool core (LLD §4.5, Task 9).
 *
 * WHY THIS IS A SEPARATE CORE RATHER THAN THE ADAPTER CALLING THE STORE
 * PaArtifactStore.MAX_PAGE_CHARS is 4000 and THRESHOLD_CHARS is also 4000, so a
 * full page plus its envelope always exceeds the threshold. If paging went
 * through the adapter's ordinary path, applyThreshold would store every page as
 * a new attachment and return an excerpt of it — the agent would never reach the
 * content. `PAGED_OUTPUT` is how the adapter knows to skip that stage, and it
 * lives here rather than in the Fluent wrapper literal because a wrapper literal
 * is a string no unit test can reach.
 *
 * Read-only. Every access-control question is the store's: read() refuses any
 * attachment that is not on x_snc_troubleshoot_run.
 */
var PaToolReadArtifact = Class.create()

PaToolReadArtifact.prototype = {
    /** The adapter reads this to skip applyThreshold. See the header. */
    PAGED_OUTPUT: true,

    /**
     * @param {Object} [options] {store} — injection point for tests.
     */
    initialize: function (options) {
        var o = options || {}
        this._store = o.store || null
    },

    /**
     * @param {Object|String} [args] {artifact_id, offset, length}, a JSON string
     *        of the same, a bare artifact sys_id, or nothing (R-9).
     * @returns {Object} whatever PaArtifactStore.read returns.
     */
    execute: function (args) {
        var a = this._normalizeArgs(args)
        var store = this._store || new PaArtifactStore()

        // Delegated deliberately even when the id is empty: the store owns the
        // "requires an artifact_id" message, and two copies of it drift.
        var result = store.read(a.artifact_id, a.offset, a.length)

        if (a._prefix_stripped && result !== null && typeof result === 'object') {
            // LOUDLY (issues #111, #122), on the returned object — this tool
            // has no data envelope to carry notes in. The SLOT is named
            // because the repair ROUTES to the named parameter rather than
            // stripping and falling through (design §3.2).
            result.notes = (result.notes || []).concat([
                'The argument arrived as "' +
                    a._prefix_stripped +
                    '" — the parameter name prefixed onto its own value. It was read as the "' +
                    a._prefix_param +
                    '" parameter. Send the artifact sys_id on its own, or a JSON object, and ' +
                    'note that this call is recorded in the audit trail as it was sent, not as ' +
                    'it was repaired.',
            ])
        }

        return result
    },

    /** Every key the object branch below reads, aliases included (#122). */
    PARAM_NAMES: ['artifact_id', 'artifactId', 'artifact', 'id', 'offset', 'length'],

    /**
     * Tolerant, in the same shape as PaToolAgentTrace._normalizeArgs. An
     * unrecognisable bare string is treated as an artifact id rather than
     * rejected here — the store answers with a specific "no readable attachment
     * with sys_id X", which tells the caller more than a generic parse error.
     */
    _normalizeArgs: function (args) {
        var raw = args
        var prefixStripped = ''
        var prefixParam = ''
        if (raw === null || raw === undefined) return { artifact_id: '' }

        if (typeof raw === 'string') {
            var s = this._trim(raw)
            if (!s) return { artifact_id: '' }

            var parsed = this._tryParse(s)
            if (parsed && typeof parsed === 'object' && !this._isArray(parsed)) {
                raw = parsed
            } else {
                var split = this._splitParamPrefix(s, this.PARAM_NAMES)
                if (split) {
                    raw = {}
                    raw[split.param] = split.value
                    prefixStripped = split.raw
                    prefixParam = split.param
                } else {
                    return { artifact_id: s }
                }
            }
        }

        if (typeof raw !== 'object' || this._isArray(raw)) return { artifact_id: '' }

        var out = {
            artifact_id: this._str(raw.artifact_id || raw.artifactId || raw.artifact || raw.id),
            offset: this._num(raw.offset),
            length: this._num(raw.length),
        }
        if (prefixStripped) {
            out._prefix_stripped = prefixStripped
            out._prefix_param = prefixParam
        }
        return out
    },

    /**
     * A verbatim copy of PaToolReadKit.splitParamPrefix (#122). This tool does
     * not use the kit — migrating it is issue #41, deliberately not done here.
     * Keep the two in step: anchored at the head, the segment before the first
     * separator must equal a parameter name in full, and the CANONICAL spelling
     * is returned so artifactId is not lower-cased into a key nothing reads.
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

    _tryParse: function (s) {
        try {
            return JSON.parse(s)
        } catch (e) {
            // R-1: `e` untouched. A non-JSON string is an artifact id.
            return null
        }
    },

    _isArray: function (v) {
        return Object.prototype.toString.call(v) === '[object Array]'
    },

    _trim: function (s) {
        return String(s === null || s === undefined ? '' : s).replace(/^\s+|\s+$/g, '')
    },

    _str: function (v) {
        return v === null || v === undefined ? '' : this._trim(v)
    },

    /** undefined rather than 0, so the store applies its own defaults. */
    _num: function (v) {
        if (v === null || v === undefined || v === '') return undefined
        var n = Number(v)
        return isNaN(n) ? undefined : n
    },

    type: 'PaToolReadArtifact',
}
