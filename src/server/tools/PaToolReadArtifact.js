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
        return store.read(a.artifact_id, a.offset, a.length)
    },

    /**
     * Tolerant, in the same shape as PaToolAgentTrace._normalizeArgs. An
     * unrecognisable bare string is treated as an artifact id rather than
     * rejected here — the store answers with a specific "no readable attachment
     * with sys_id X", which tells the caller more than a generic parse error.
     */
    _normalizeArgs: function (args) {
        var raw = args
        if (raw === null || raw === undefined) return { artifact_id: '' }

        if (typeof raw === 'string') {
            var s = this._trim(raw)
            if (!s) return { artifact_id: '' }

            var parsed = this._tryParse(s)
            if (parsed && typeof parsed === 'object' && !this._isArray(parsed)) {
                raw = parsed
            } else {
                return { artifact_id: s }
            }
        }

        if (typeof raw !== 'object' || this._isArray(raw)) return { artifact_id: '' }

        return {
            artifact_id: this._str(raw.artifact_id || raw.artifactId || raw.artifact || raw.id),
            offset: this._num(raw.offset),
            length: this._num(raw.length),
        }
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
