/**
 * PaArtifactStore — large tool output handling (LOW_LEVEL_DESIGN.md §4.5).
 *
 * THE PROBLEM THIS EXISTS FOR
 * A real `PaToolAgentTrace` summary measures ~35KB. The excerpt budget a tool
 * result may occupy in an agent's scratchpad is 4,000 chars. Without somewhere
 * else for the other ~31KB to live, the project's first tool core cannot be
 * handed to an agent at all — so this is the blocker on the vertical slice, not
 * a nicety.
 *
 * Over-threshold content becomes an attachment on the diagnostic run record;
 * the caller gets a head+tail excerpt plus an `artifact_id`, and pulls the rest
 * in 4KB pages through `read()` — surfaced to the LLM as the `read_artifact`
 * tool. The same pattern a coding agent uses to read a file it cannot hold.
 *
 * It is also the mechanical enforcement of a platform guidance point rather
 * than a local invention: the K26 lab (CCL6230, Lab 2) names *tool output
 * bloat* — raw payloads accumulating in the scratchpad and reprocessed on every
 * ReAct turn — as a primary agent latency and failure cause. Truncation here is
 * not just a context-window defence; it is a latency defence on every
 * subsequent turn.
 *
 * CONTRACT
 *   store(runId, toolName, content) -> {stored:false, content, total_length}
 *                                    | {stored:true, artifact_id, excerpt, ...}
 *                                    | {stored:false, degraded:<reason>, excerpt, ...}
 *   read(artifactId, offset, length) -> {success:true, data:{content, ...}}
 *                                     | {success:false, error}
 *   applyThreshold(runId, result, toolName) -> result | truncated envelope
 *
 * ---------------------------------------------------------------------------
 * STANDING RULES THIS FILE IS BUILT AROUND
 * ---------------------------------------------------------------------------
 *
 * R-1  NEVER touch the exception object in a catch. A cross-scope denial throws
 *      ScopeAccessNotGrantedException, and reading `.message` off it throws
 *      AGAIN ("Illegal access to getter method getMessage"), escapes the
 *      handler and 500s the whole request. Every catch here records a reason
 *      string it chose itself and moves on. `test/PaArtifactStore.test.js`
 *      enforces this with an exception object whose `.message` getter throws.
 *
 * R-8  A stub is not evidence about platform behaviour. The Jest suite settles
 *      the arithmetic — truncation, paging, reassembly — and nothing else. The
 *      scoped-app `GlideSysAttachment` write surface carried an explicit
 *      `⚠ VERIFY` in LLD §4.5 and was cleared on gpinst01, not in a test. See
 *      issue #16 for the round-trip evidence.
 *
 * R-9  Every input may be absent or arrive as a string. The native harness
 *      passes tool inputs as strings when it passes them at all, so `offset`
 *      and `length` are coerced, junk falls back to defaults, and no argument
 *      being missing is treated as a fault.
 *
 * R-10 Degrade explicitly, never silently. If the attachment cannot be written
 *      — no run anchor yet, a denied write, the API absent — the caller still
 *      gets the excerpt, plus a named reason and a note saying paging is
 *      unavailable. What it must NEVER do is fall back to returning the full
 *      35KB payload: that defeats the one job this component has, and it would
 *      do so at exactly the moment the system is already degraded.
 *
 * ---------------------------------------------------------------------------
 * TWO DELIBERATE CHOICES WORTH KNOWING ABOUT
 * ---------------------------------------------------------------------------
 *
 * 1. `read()` refuses any attachment that is not on the run table. This method
 *    becomes `read_artifact`, an LLM-callable tool taking a caller-supplied
 *    sys_id — without the check it is a generic "read any attachment on the
 *    instance" primitive, and prompt injection in a trace payload is a
 *    plausible way to aim it. GlideRecordSecure already applies ACLs; this is
 *    the second, cheaper lock that does not depend on the instance's
 *    sys_attachment ACLs being tight.
 *
 * 2. Thresholds are module constants with an optional override argument, not
 *    `sys_properties`. They are load-bearing on the context budget rather than
 *    an operational dial, and a property read is one more thing that must
 *    degrade when unset. Tests pass overrides directly.
 */
var PaArtifactStore = Class.create()

PaArtifactStore.prototype = {
    /** Content longer than this goes to an attachment. LLD §4.5. */
    THRESHOLD_CHARS: 4000,

    /** Excerpt head, per LLD §4.5 — enough to see the shape of the payload. */
    EXCERPT_HEAD_CHARS: 1500,

    /** Excerpt tail — where a truncated JSON payload's error/summary tends to sit. */
    EXCERPT_TAIL_CHARS: 500,

    /** Ceiling on one `read()` page, so paging can never blow the same budget. */
    MAX_PAGE_CHARS: 4000,

    /** Artifacts hang off the diagnostic run record and nothing else. */
    RUN_TABLE: 'x_snc_troubleshoot_run',

    /**
     * @param {Object} [options] {thresholdChars, excerptHeadChars,
     *        excerptTailChars, maxPageChars, runTable} — overrides for tests
     *        and for callers with a different budget.
     */
    initialize: function (options) {
        if (!options) return
        if (options.thresholdChars > 0) this.THRESHOLD_CHARS = options.thresholdChars
        if (options.excerptHeadChars > 0) this.EXCERPT_HEAD_CHARS = options.excerptHeadChars
        if (options.excerptTailChars > 0) this.EXCERPT_TAIL_CHARS = options.excerptTailChars
        if (options.maxPageChars > 0) this.MAX_PAGE_CHARS = options.maxPageChars
        if (options.runTable) this.RUN_TABLE = String(options.runTable)
    },

    // =======================================================================
    // store
    // =======================================================================

    /**
     * @param {String} runId    sys_id of the x_snc_troubleshoot_run to attach to
     * @param {String} toolName the producing tool, used in the file name
     * @param {Object|String} content
     * @returns {Object} see CONTRACT above
     */
    store: function (runId, toolName, content) {
        var text = this._stringify(content)
        var total = text.length

        // Under the ceiling: hand it straight back. No attachment, no excerpt,
        // no indirection for the LLM to reason about.
        if (total <= this.THRESHOLD_CHARS) {
            return {
                stored: false,
                artifact_id: null,
                total_length: total,
                content: text,
            }
        }

        var excerpt = this._truncate(text, this.EXCERPT_HEAD_CHARS + this.EXCERPT_TAIL_CHARS)

        if (!runId) return this._degraded(excerpt, total, 'no_run_anchor')

        var run = this._getRun(runId)
        if (!run) return this._degraded(excerpt, total, 'run_not_found')

        if (typeof GlideSysAttachment === 'undefined') {
            return this._degraded(excerpt, total, 'attachment_api_unavailable')
        }

        var fileName = this._fileName(runId, toolName)
        var artifactId = null
        try {
            artifactId = new GlideSysAttachment().write(run, fileName, 'application/json', text)
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            artifactId = null
        }

        if (!artifactId) return this._degraded(excerpt, total, 'attachment_write_failed')

        var pages = Math.ceil(total / this.MAX_PAGE_CHARS)
        return {
            stored: true,
            artifact_id: String(artifactId),
            file_name: fileName,
            total_length: total,
            page_size: this.MAX_PAGE_CHARS,
            pages: pages,
            excerpt: excerpt,
            note:
                'Output was ' +
                total +
                ' chars and was stored as an artifact. The excerpt shows the head and tail only. ' +
                'Call read_artifact with this artifact_id and an offset to page through the rest (' +
                pages +
                ' pages of up to ' +
                this.MAX_PAGE_CHARS +
                ' chars).',
        }
    },

    // =======================================================================
    // read — surfaced to the LLM as `read_artifact`
    // =======================================================================

    /**
     * @param {String} artifactId sys_attachment sys_id from a store() result
     * @param {Number|String} [offset=0]
     * @param {Number|String} [length=MAX_PAGE_CHARS] clamped to MAX_PAGE_CHARS
     * @returns {Object} {success:true, data:{...}} | {success:false, error}
     */
    read: function (artifactId, offset, length) {
        var id = artifactId ? String(artifactId) : ''
        if (!id) {
            return {
                success: false,
                error: 'read_artifact requires an artifact_id — the value returned by the tool whose output was truncated.',
            }
        }

        if (typeof GlideRecordSecure === 'undefined' || typeof GlideSysAttachment === 'undefined') {
            return {
                success: false,
                error: 'The attachment API is not available in this runtime, so stored artifacts cannot be read.',
            }
        }

        var gr = new GlideRecordSecure('sys_attachment')
        var found = false
        try {
            found = gr.get(id)
        } catch (e) {
            // R-1: `e` untouched.
            found = false
        }

        if (!found) {
            return {
                success: false,
                error:
                    'No readable attachment with sys_id ' +
                    id +
                    '. It may not exist, or ACLs may deny this user access to it — those two cases are not distinguishable from here.',
            }
        }

        // Choice 1 in the header: this tool reads the app's own artifacts, not
        // arbitrary instance attachments.
        var tableName = gr.getValue('table_name')
        if (tableName !== this.RUN_TABLE) {
            return {
                success: false,
                error:
                    'Attachment ' +
                    id +
                    ' belongs to table ' +
                    tableName +
                    ', not ' +
                    this.RUN_TABLE +
                    '. read_artifact only reads diagnostic run artifacts; refusing.',
            }
        }

        var content = ''
        try {
            content = new GlideSysAttachment().getContent(gr)
        } catch (e) {
            // R-1: `e` untouched.
            return {
                success: false,
                error: 'Artifact ' + id + ' exists but its content could not be read.',
            }
        }
        content = content === null || content === undefined ? '' : String(content)

        var total = content.length
        var off = this._toInt(offset, 0)
        if (off < 0) off = 0

        var len = this._toInt(length, this.MAX_PAGE_CHARS)
        if (len <= 0 || len > this.MAX_PAGE_CHARS) len = this.MAX_PAGE_CHARS

        var slice = off >= total ? '' : content.substring(off, Math.min(off + len, total))
        var next = off + slice.length
        var eof = next >= total

        return {
            success: true,
            data: {
                artifact_id: id,
                file_name: gr.getValue('file_name'),
                total_length: total,
                offset: off,
                length: slice.length,
                next_offset: eof ? null : next,
                eof: eof,
                page_size: this.MAX_PAGE_CHARS,
                content: slice,
            },
        }
    },

    // =======================================================================
    // applyThreshold — the shape PaScriptToolAdapter calls (LLD §4.7)
    // =======================================================================

    /**
     * Wraps a tool core's result, replacing it with an excerpt + artifact ref
     * when it is too big to hand to the reasoning loop. Under the threshold the
     * result is returned BY IDENTITY — the common path costs nothing.
     *
     * @param {String} runId
     * @param {Object|String} result the tool core's {success, data|error}
     * @param {String} [toolName]
     * @returns {Object|String} `result` unchanged, or a truncated envelope
     */
    applyThreshold: function (runId, result, toolName) {
        var text = this._stringify(result)
        if (text.length <= this.THRESHOLD_CHARS) return result

        var stored = this.store(runId, toolName, text)

        var out = {
            // A truncated failure is still a failure — the flag must survive.
            success: !(result && typeof result === 'object' && result.success === false),
            truncated: true,
            tool: toolName ? String(toolName) : null,
            total_length: stored.total_length,
            artifact_id: stored.artifact_id,
            page_size: this.MAX_PAGE_CHARS,
            pages: stored.pages || Math.ceil(stored.total_length / this.MAX_PAGE_CHARS),
            excerpt: stored.excerpt,
            note: stored.note,
        }
        if (stored.degraded) out.degraded = stored.degraded
        return out
    },

    // =======================================================================
    // Internals
    // =======================================================================

    /**
     * Head + elision marker + tail. `limit` is the budget for RETAINED content;
     * the marker sits outside it, so the excerpt is a few dozen chars longer.
     * The head/tail split follows the ratio of the two constants (3:1 by
     * default), so the documented 1500/500 shape falls out of limit=2000.
     *
     * @param {String} content
     * @param {Number} limit
     * @returns {String}
     */
    _truncate: function (content, limit) {
        var text = this._stringify(content)
        var cap = limit > 0 ? limit : this.EXCERPT_HEAD_CHARS + this.EXCERPT_TAIL_CHARS
        if (text.length <= cap) return text

        var ratio = this.EXCERPT_HEAD_CHARS / (this.EXCERPT_HEAD_CHARS + this.EXCERPT_TAIL_CHARS)
        var head = Math.floor(cap * ratio)
        var tail = cap - head
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
     * R-10: the excerpt survives, the full payload does not, and the reason is
     * named. Deliberately carries no `content` key — a degraded store must not
     * become a back door for the 35KB it exists to keep out of the prompt.
     */
    _degraded: function (excerpt, total, reason) {
        return {
            stored: false,
            artifact_id: null,
            degraded: reason,
            total_length: total,
            excerpt: excerpt,
            note:
                'Output was ' +
                total +
                ' chars but could not be stored as an artifact (' +
                reason +
                '), so paged retrieval via read_artifact is not available for it. ' +
                'Only the excerpt below exists — treat the middle of this payload as unseen rather than absent.',
        }
    },

    /** @returns {GlideRecord|null} the run record, or null if unusable. */
    _getRun: function (runId) {
        if (typeof GlideRecord === 'undefined') return null
        try {
            var gr = new GlideRecord(this.RUN_TABLE)
            // Plain GlideRecord, not GlideRecordSecure: this is the app writing
            // to its own table server-side, the path Build Rule #42 notes keeps
            // working regardless of the table's ACLs.
            if (!gr.get(String(runId))) return null
            return gr
        } catch (e) {
            // R-1: `e` untouched.
            return null
        }
    },

    /** `artifact-<seq>-<tool>.json`, per LLD §4.5. */
    _fileName: function (runId, toolName) {
        return 'artifact-' + this._nextSeq(runId) + '-' + this._safeToolName(toolName) + '.json'
    },

    /** 1-based, counted from what is already attached to this run. */
    _nextSeq: function (runId) {
        if (typeof GlideRecord === 'undefined') return 1
        try {
            var gr = new GlideRecord('sys_attachment')
            gr.addQuery('table_name', this.RUN_TABLE)
            gr.addQuery('table_sys_id', String(runId))
            gr.query()
            return gr.getRowCount() + 1
        } catch (e) {
            // R-1: `e` untouched. A duplicate file name is harmless — the
            // sys_id is what anything actually resolves by.
            return 1
        }
    },

    _safeToolName: function (toolName) {
        var raw = toolName === null || toolName === undefined ? '' : String(toolName)
        var safe = raw.replace(/[^A-Za-z0-9_-]/g, '')
        return safe.length > 0 ? safe.substring(0, 40) : 'tool'
    },

    /** Objects are serialised; strings pass through; nothing is ever null. */
    _stringify: function (value) {
        if (value === null || value === undefined) return ''
        if (typeof value === 'string') return value
        try {
            var json = JSON.stringify(value)
            return json === undefined ? String(value) : json
        } catch (e) {
            // R-1: `e` untouched. Circular structures land here.
            return String(value)
        }
    },

    /** R-9: inputs arrive as strings, or as junk, or not at all. */
    _toInt: function (value, fallback) {
        if (value === null || value === undefined || value === '') return fallback
        var n = parseInt(value, 10)
        return isNaN(n) ? fallback : n
    },

    type: 'PaArtifactStore',
}
