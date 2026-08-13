/**
 * PaRetentionSweep — the data-at-rest lifecycle for run artifacts (issue #216).
 *
 * WHAT THIS EXISTS FOR
 * `PaToolQueryTable` returns rows from arbitrary customer tables, and
 * `PaArtifactStore` persists the oversized ones as attachments on the run
 * record. Until this class existed, a grep for `retention|purge|ttl|expire`
 * across `src/server/` and `src/fluent/` returned NOTHING: the only scheduled
 * jobs were the run-start worker and the stale-run sweep, and the latter
 * changes a status without deleting anything. Customer data accumulated inside
 * the instance indefinitely.
 *
 * The PRD's "no customer data ever leaves the platform" is about EGRESS and
 * remains true. Retention is a separate obligation, and a diagnostic tool that
 * accumulates customer data with no stated lifecycle cannot be handed to a
 * customer — which is the gate this blocks.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SWEEP DRIVES OFF ATTACHMENTS, NOT RUNS
 * ---------------------------------------------------------------------------
 * The obvious shape is "walk runs older than N days, delete their attachments".
 * It carries a bug that only appears after the job has been live a while: a run
 * whose attachments are already gone stays old forever, so with any per-pass
 * cap and an oldest-first order every later pass re-examines the same
 * already-clean runs and never reaches the newer ones that still hold data. The
 * job appears to run nightly and quietly stops purging anything.
 *
 * Querying `sys_attachment` directly has none of that: the work set SHRINKS as
 * it purges, there is no run-table scan at all, and no "already purged" marker
 * column is needed — which matters, because a new column is a schema change and
 * unverifiable without an install. An attachment's own `sys_created_on` is
 * written during the run, so attachment age and run age are the same fact.
 *
 * ---------------------------------------------------------------------------
 * THE DESTRUCTIVE DIRECTION IS THE DANGEROUS ONE
 * ---------------------------------------------------------------------------
 * Hence the deliberate asymmetry in `retentionDays`: an ABSENT property falls
 * back to the documented 30-day default, while a PRESENT BUT UNPARSEABLE one
 * (`'never'`, `'thirty'`, `'0'`, a negative, an unreplaced template) DISABLES
 * the sweep entirely. "Not configured yet" and "configured wrong" are different
 * facts and only the first has a safe default. A job that deletes on a typo is
 * not a job anyone should install on a customer instance — and the disabled
 * case is announced through `gs.warn`, because a silent no-op would be
 * indistinguishable from a clean sweep in the log.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DELIBERATELY DOES NOT DELETE
 * ---------------------------------------------------------------------------
 * The run ROW survives — status, transcript, `fix_report`, `context_summary`
 * and the verbatim `request` body all stay. Two reasons: the run table is the
 * evidence ledger the benchmark and grading work read from, and deleting rows
 * is far harder to undo than deleting the bulk excerpts. The consequence is
 * worth stating plainly rather than leaving implied: the row still carries
 * 200-char digests of tool output and the original request text, so this closes
 * the BULK data-at-rest exposure, not every trace of it. Widening the purge to
 * run rows is a separate decision with a separate retention window.
 *
 * ---------------------------------------------------------------------------
 * STANDING RULES THIS FILE IS BUILT AROUND
 * ---------------------------------------------------------------------------
 * R-1  Never touch the exception object in a catch — reading `.message` off a
 *      ScopeAccessNotGrantedException throws again and escapes the handler.
 * R-9  Every input may be absent, and arrives as a string when it is not.
 * R-10 Degrade explicitly: a refused delete is counted and named, never
 *      swallowed into a success.
 *
 * Build Rule #42: plain `GlideRecord`, not `GlideRecordSecure` — this is the
 * app operating on its own run table's attachments server-side.
 */
var PaRetentionSweep = Class.create()

PaRetentionSweep.prototype = {
    RUN_TABLE: 'x_snc_troubleshoot_run',
    ATTACHMENT_TABLE: 'sys_attachment',

    /** Read at sweep time, so an admin change takes effect on the next run. */
    RETENTION_PROPERTY: 'x_snc_troubleshoot.retention_days',

    /** Used ONLY when the property is absent or blank — see the header. */
    DEFAULT_RETENTION_DAYS: 30,

    /** Per-pass ceiling. The remainder is purged by the next scheduled run. */
    MAX_DELETES_PER_PASS: 1000,

    /**
     * @param {Object} [options]
     *   retentionDays  override, wins over the property (a job or a test)
     *   maxDeletes     override for MAX_DELETES_PER_PASS
     *   now            clock seam — Date, ms number, or parseable string
     */
    initialize: function (options) {
        var o = options || {}
        this._nowFn = typeof o.now === 'function' ? o.now : null
        this._retentionOverride = o.retentionDays === undefined ? null : o.retentionDays
        this._maxDeletes = o.maxDeletes > 0 ? o.maxDeletes : this.MAX_DELETES_PER_PASS
    },

    /**
     * @returns {Number} days to keep artifacts, or 0 meaning DO NOT SWEEP.
     *          Never negative, never NaN — callers test `> 0` and nothing else.
     */
    retentionDays: function () {
        if (this._retentionOverride !== null) return this._parseDays(this._retentionOverride)

        var raw = null
        try {
            if (typeof gs !== 'undefined' && gs && typeof gs.getProperty === 'function') {
                raw = gs.getProperty(this.RETENTION_PROPERTY)
            }
        } catch (e) {
            // R-1: `e` untouched. An unreadable property is "not configured".
            raw = null
        }

        // Absent or blank — the admin has not touched it. The documented
        // default applies. Anything else present must PARSE or the sweep is off.
        if (raw === null || raw === undefined || String(raw) === '') {
            return this.DEFAULT_RETENTION_DAYS
        }
        return this._parseDays(raw)
    },

    /** @returns {Number} a positive integer, or 0 for "unusable, do nothing". */
    _parseDays: function (value) {
        var s = String(value)
        // `parseInt` alone would read '30 days' as 30 and 'never' as NaN — the
        // first is a guess about intent this class has no business making.
        if (!/^-?[0-9]+$/.test(s)) return 0
        var n = parseInt(s, 10)
        if (isNaN(n) || n <= 0) return 0
        return n
    },

    /**
     * Deletes artifact attachments on run records older than the window.
     *
     * @param {Object} [options] unused today; present so the ScheduledScript
     *        body never has to change shape to pass one.
     * @returns {Object} {swept, reason?, retention_days, cutoff?,
     *          attachments_deleted, runs_affected, failures, capped}
     *          — `swept:false` with a `reason` is a legitimate answer (R-10),
     *          not an error the caller has to handle.
     */
    sweep: function (options) {
        var days = this.retentionDays()

        var result = {
            swept: false,
            retention_days: days,
            attachments_deleted: 0,
            runs_affected: 0,
            failures: 0,
            capped: false,
        }

        if (!(days > 0)) {
            result.reason = 'retention_disabled'
            this._warn(
                'artifact retention is DISABLED — the ' +
                    this.RETENTION_PROPERTY +
                    ' property is set to a value that is not a positive number of days. ' +
                    'Nothing was purged. Clear the property to fall back to the ' +
                    this.DEFAULT_RETENTION_DAYS +
                    '-day default.'
            )
            return result
        }

        if (typeof GlideRecord === 'undefined') {
            result.reason = 'no_glide'
            return result
        }

        var cutoff = this._cutoffString(days)
        result.cutoff = cutoff

        var runIds = {}
        var runCount = 0

        try {
            var gr = new GlideRecord(this.ATTACHMENT_TABLE)
            // SCOPED TO THIS APP'S RUN TABLE, always and first. The sweep runs
            // with rights over far more than its own rows; an unqualified
            // sys_attachment query on an age condition would delete every aged
            // attachment on the instance.
            gr.addQuery('table_name', this.RUN_TABLE)
            // The age test belongs to the DATABASE. Reading every attachment
            // row and filtering in JS is invisible until it is slow, and this
            // is a nightly job on a table that only grows.
            gr.addQuery('sys_created_on', '<', cutoff)
            gr.setLimit(this._maxDeletes)
            gr.query()

            while (gr.next()) {
                // The cap is enforced HERE as well as through setLimit —
                // setLimit is the efficient half, this is the guaranteed half.
                if (result.attachments_deleted + result.failures >= this._maxDeletes) {
                    result.capped = true
                    break
                }

                var runId = gr.getValue('table_sys_id')
                var deleted = false

                try {
                    deleted = gr.deleteRecord() !== false
                } catch (e) {
                    // R-1: `e` untouched. One undeletable row must not end the
                    // pass — the rest of the aged data still has to go.
                    deleted = false
                }

                if (deleted) {
                    result.attachments_deleted += 1
                    if (runId && !runIds[runId]) {
                        runIds[runId] = true
                        runCount += 1
                    }
                } else {
                    result.failures += 1
                }
            }

            result.swept = true
        } catch (e2) {
            // R-1: `e2` untouched. A failed query purges nothing rather than
            // guessing at what was in scope.
            result.reason = 'query_failed'
        }

        result.runs_affected = runCount
        return result
    },

    // =======================================================================
    // Helpers
    // =======================================================================

    _warn: function (message) {
        try {
            if (typeof gs !== 'undefined' && gs && typeof gs.warn === 'function') {
                gs.warn('x_snc_troubleshoot: ' + message)
            }
        } catch (e) {
            // R-1: `e` untouched.
        }
    },

    /** 'YYYY-MM-DD HH:MM:SS' — the lexically-sortable form `sys_created_on` is
     *  stored and compared in everywhere else in this app (see
     *  PaRunManager._cutoffString, which this deliberately mirrors). */
    _cutoffString: function (days) {
        var nowMs
        if (this._nowFn) {
            var n = this._nowFn()
            if (n instanceof Date) nowMs = n.getTime()
            else if (typeof n === 'number') nowMs = n
            else nowMs = new Date(n).getTime()
        } else {
            nowMs = new Date().getTime()
        }
        return this._formatDateTime(new Date(nowMs - days * 86400000))
    },

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

    type: 'PaRetentionSweep',
}
