/**
 * PaToolReadKit — the GlideRecordSecure read layer the tool cores share.
 *
 * WHY THIS EXISTS
 * `PaToolAgentTrace` was the first core and carries this layer inline. Tasks 7
 * and 8 add five more, and every one of them needs the identical semantics:
 * the R-6 field-presence assertion, the R-1 no-touch catch, database-side
 * ordering, sticky DENIED. Five private copies of safety-critical plumbing is
 * five chances for one of them to quietly lose a rule that cost real hours to
 * learn. This is that layer lifted out, unchanged in behaviour.
 *
 * `PaToolAgentTrace` is deliberately NOT migrated onto it. It is the only core
 * verified against real sn_aia_* rows on gpinst01, and its tests pin the
 * behaviour of the inline copy; rewriting its read path to prove a refactor is
 * risk spent for no diagnostic gain. Two implementations coexist until a
 * follow-up migrates it.
 *
 * NAMING: methods here are public API, so no leading underscore — the opposite
 * of the private `_readRows` they were lifted from. That is the only difference.
 *
 * accessibleFrom 'public' (DESIGN.md R-5): a script tool runs in rhino.global.
 *
 * ---------------------------------------------------------------------------
 * THE FOUR RULES THIS FILE IS THE HOME OF
 * ---------------------------------------------------------------------------
 * R-1  A cross-scope denial throws ScopeAccessNotGrantedException, and reading
 *      `.message` off it throws AGAIN ("Illegal access to getter method
 *      getMessage"), escaping the catch and 500-ing the whole request. Every
 *      catch below records a status and touches nothing.
 *
 * R-6  A field name the table does not declare yields a BLANK, not an error —
 *      so a typo reads as "no data" rather than as a bug. Every read asserts
 *      presence via isValidField and reports what was absent.
 *
 * R-17 Ordering must be applied at the database, BEFORE setLimit. Sorting the
 *      returned page sorts an arbitrary N rows and then describes them as the
 *      most recent N.
 *
 *      DENIED is sticky. A table denied once must not be reported readable
 *      because a later read of it happened to be permitted — the denial is the
 *      diagnostically important fact.
 */
var PaToolReadKit = Class.create()

PaToolReadKit.prototype = {
    /** Default digest ceiling. Callers pass their own for larger payloads. */
    DIGEST_CHARS: 200,

    initialize: function () {},

    // =======================================================================
    // The result envelope every core carries
    // =======================================================================

    /**
     * The shared shape: `reads` (per-table status), `field_warnings` (R-6
     * mismatches) and `notes`. Cores add their own keys on top.
     *
     * @param {String} [toolName]
     * @param {String} [version]
     */
    newData: function (toolName, version) {
        var data = {
            reads: {},
            // Every read that hit its ceiling, recorded centrally. See
            // readRows: a core cannot forget to check this, because
            // evidence_basis surfaces it whether the core looks or not.
            truncations: {},
            field_warnings: [],
            notes: [],
        }
        if (toolName) data.tool = toolName
        if (version) data.version = version
        return data
    },

    // =======================================================================
    // Reads
    // =======================================================================

    /** @returns {Function} a query builder applying a single equality filter. */
    eqQuery: function (field, value) {
        return function (gr) {
            gr.addQuery(field, value)
        }
    },

    /**
     * @returns {Function} a query builder applying `field IN (values)`.
     *
     * An EMPTY list is deliberately NOT translated into "no filter" — an
     * unfiltered read returning the whole table is far worse than an empty
     * result. It queries an impossible value instead, so the caller gets the
     * empty set they asked for.
     */
    inQuery: function (field, values) {
        var list = values && values.length ? values.join(',') : '__none__'
        return function (gr) {
            gr.addQuery(field, 'IN', list)
        }
    },

    /**
     * @param {String} table
     * @param {Function} [queryFn] receives the GlideRecordSecure
     * @param {Array} fields every one asserted against isValidField (R-6)
     * @param {Array} [displayFields] getDisplayValue is also read for these
     * @param {Number} [limit]
     * @param {String|Object|Array} [orderBy] 'field', {field, desc}, or an array
     * @param {Object} [data] the newData envelope, updated in place
     * @returns {Object} {table, status: 'ok'|'empty'|'DENIED', rows, missing_fields}
     */
    readRows: function (table, queryFn, fields, displayFields, limit, orderBy, data) {
        var result = { table: table, status: 'DENIED', rows: [], missing_fields: [] }

        try {
            var gr = new GlideRecordSecure(table)
            if (queryFn) queryFn(gr)
            // R-17: at the database, and before the limit picks the page.
            this.applyOrder(gr, orderBy)
            // ONE MORE than asked for. `rows.length === limit` cannot tell a
            // truncated result from an exactly-full one, and every consumer of
            // that ambiguity in this codebase resolved it the optimistic way.
            // Reading limit+1 and returning limit turns the guess into a fact
            // for the cost of a single row.
            if (limit) gr.setLimit(limit + 1)
            gr.query()

            result.missing_fields = this.missingFields(gr, fields)

            while (gr.next()) {
                if (limit && result.rows.length >= limit) {
                    result.truncated_at = limit
                    break
                }
                result.rows.push(this.pluck(gr, fields, displayFields))
            }
            result.status = result.rows.length > 0 ? 'ok' : 'empty'
        } catch (e) {
            // R-1: `e` is NOT read. Record and move on.
            result.status = 'DENIED'
        }

        this.noteRead(data, table, result.status)
        this.noteTruncation(data, table, result.truncated_at)
        this.noteFieldWarnings(data, table, result.missing_fields)
        return result
    },

    /**
     * @returns {Object} {table, status: 'ok'|'empty'|'DENIED', row, missing_fields}
     */
    readOne: function (table, sysId, fields, displayFields, data) {
        var result = { table: table, status: 'DENIED', row: null, missing_fields: [] }

        try {
            var gr = new GlideRecordSecure(table)
            result.missing_fields = this.missingFields(gr, fields)
            if (gr.get(sysId)) {
                result.row = this.pluck(gr, fields, displayFields)
                result.status = 'ok'
            } else {
                result.status = 'empty'
            }
        } catch (e) {
            // R-1: `e` is NOT read.
            result.status = 'DENIED'
        }

        this.noteRead(data, table, result.status)
        this.noteFieldWarnings(data, table, result.missing_fields)
        return result
    },

    /**
     * Probes a list of candidate field names and returns the ones the table
     * actually declares.
     *
     * The pattern that settled the `sn_aia_tools_execution` join field on first
     * run: when the documented name is uncertain, ask the table rather than
     * guessing, because a wrong name queries as blank and can return rows that
     * belong to something else entirely.
     *
     * @returns {Object} {valid: [], status: 'ok'|'DENIED'}
     */
    validFields: function (table, candidates, data) {
        var out = { valid: [], status: 'DENIED' }

        try {
            var gr = new GlideRecordSecure(table)
            for (var i = 0; i < candidates.length; i++) {
                try {
                    if (gr.isValidField(candidates[i])) out.valid.push(candidates[i])
                } catch (e) {
                    // R-1: `e` untouched. Cannot tell is not the same as absent.
                    out.status = 'unknown'
                    return out
                }
            }
            out.status = 'ok'
        } catch (e) {
            // R-1: `e` untouched.
            out.status = 'DENIED'
        }

        this.noteRead(data, table, out.status === 'ok' ? this.readStatusOf(data, table) : out.status)
        return out
    },

    /** Current recorded status for a table, so validFields does not downgrade it. */
    readStatusOf: function (data, table) {
        if (!data || !data.reads) return 'ok'
        return data.reads[table] || 'ok'
    },

    /**
     * Accepts 'field', {field, desc}, or an array of either. A secondary key
     * matters because real rows leave the primary one blank: five of nine
     * sn_aia_message rows on gpinst01 carry an EMPTY message_sequence, so a
     * single-key sort puts them in arbitrary order at the front.
     */
    applyOrder: function (gr, orderBy) {
        if (!orderBy) return
        var keys = this.isArray(orderBy) ? orderBy : [orderBy]
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i]
            if (!k) continue
            if (typeof k === 'string') gr.orderBy(k)
            else if (k.desc) gr.orderByDesc(k.field)
            else gr.orderBy(k.field)
        }
    },

    /**
     * R-6: ask the record which of our expected fields it actually has, so an
     * absent field is reported as a schema mismatch rather than read as "no
     * data".
     */
    missingFields: function (gr, fields) {
        var missing = []
        var list = fields || []
        for (var i = 0; i < list.length; i++) {
            try {
                if (!gr.isValidField(list[i])) missing.push(list[i])
            } catch (e) {
                // R-1: `e` untouched. The check being unavailable is not
                // evidence the field is absent — saying otherwise would be the
                // R-6 failure committed by the guard against it.
                return ['(field presence check unavailable)']
            }
        }
        return missing
    },

    pluck: function (gr, fields, displayFields) {
        var row = {}
        var list = fields || []
        var i

        for (i = 0; i < list.length; i++) {
            var f = list[i]
            try {
                var v = gr.getValue(f)
                row[f] = v === null || v === undefined ? '' : String(v)
            } catch (e) {
                row[f] = ''
            }
        }

        var disp = displayFields || []
        for (i = 0; i < disp.length; i++) {
            var d = disp[i]
            try {
                var dv = gr.getDisplayValue(d)
                if (dv && String(dv) !== row[d]) row[d + '_display'] = String(dv)
            } catch (e) {
                // display value unavailable; the raw value already landed above
            }
        }

        return row
    },

    /**
     * DENIED is sticky — see the header.
     *
     * The rest is a strength ordering. `unknown` is the WEAKEST status: it comes
     * from validFields when the presence check itself was unavailable, and means
     * "could not tell", not "could not read". Any real read outcome supersedes
     * it — leaving it in place would report a table as indeterminate when rows
     * were subsequently read from it, understating access in the one direction
     * this project keeps getting wrong (R-11: a partial result read as absence).
     *
     * Strength: unknown < empty < ok, with DENIED overriding everything.
     */
    noteRead: function (data, table, status) {
        if (!data || !data.reads) return
        var prior = data.reads[table]

        if (prior === 'DENIED') return
        if (status === 'DENIED' || !prior) {
            data.reads[table] = status
            return
        }
        if (this._readRank(status) > this._readRank(prior)) data.reads[table] = status
    },

    _readRank: function (status) {
        if (status === 'ok') return 3
        if (status === 'empty') return 2
        if (status === 'unknown') return 1
        return 0
    },

    /**
     * Records that a read hit its ceiling, keeping the LARGEST bound seen for a
     * table so a later smaller read cannot mask a bigger truncation.
     *
     * This is central rather than per-caller because every silent cap found in
     * review had the same shape: the bound was applied in one place and the
     * answer was reported in another, with nothing structurally connecting
     * them. A core can still choose how to present it, but it can no longer
     * fail to know.
     */
    noteTruncation: function (data, table, limit) {
        if (!data || !data.truncations || !limit) return
        var prior = data.truncations[table]
        if (!prior || limit > prior) data.truncations[table] = limit
    },

    /** @returns {Boolean} whether any read recorded a truncation. */
    anyTruncation: function (data) {
        if (!data || !data.truncations) return false
        for (var k in data.truncations) {
            if (Object.prototype.hasOwnProperty.call(data.truncations, k)) return true
        }
        return false
    },

    noteFieldWarnings: function (data, table, missing) {
        if (!data || !data.field_warnings || !missing || !missing.length) return
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
    // Shaping
    // =======================================================================

    /** Truncate to `limit`, always stating how much was cut. Never silent. */
    digest: function (value, limit) {
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
        return s.substring(0, lim) + '...[+' + (s.length - lim) + ' more chars]'
    },

    /**
     * Normalises a reference value. Real gpinst01 rows carry the LITERAL STRING
     * "undefined" in reference fields (observed on sn_aia_execution_plan.agent
     * for every security_violation plan) — a truthy value pointing at nothing.
     * Emit the raw value alongside the normalised one so a reader can see which
     * case they are in.
     */
    refValue: function (v) {
        if (v === null || v === undefined) return ''
        var s = this.trim(String(v))
        var low = s.toLowerCase()
        if (low === 'undefined' || low === 'null') return ''
        return s
    },

    // =======================================================================
    // Small helpers (ES5 / Rhino only — no let/const, arrow, Set or Map)
    // =======================================================================

    /**
     * Realm-safe. `instanceof Array` compares against the CURRENT realm's Array
     * constructor, so it is false for an array that crossed a boundary — a
     * Java-backed list from a scoped REST request, for instance.
     */
    isArray: function (v) {
        return Object.prototype.toString.call(v) === '[object Array]'
    },

    tryParse: function (s) {
        try {
            return JSON.parse(s)
        } catch (e) {
            // R-1: `e` untouched.
            return null
        }
    },

    isPlainObject: function (v) {
        return v !== null && typeof v === 'object' && !this.isArray(v)
    },

    isSysId: function (v) {
        if (typeof v !== 'string') return false
        if (v.length !== 32) return false
        return /^[0-9a-fA-F]{32}$/.test(v)
    },

    trim: function (s) {
        return String(s === null || s === undefined ? '' : s).replace(/^\s+|\s+$/g, '')
    },

    str: function (v) {
        if (v === null || v === undefined) return ''
        return this.trim(String(v))
    },

    num: function (v) {
        if (v === null || v === undefined || v === '') return 0
        var n = Number(v)
        return isNaN(n) ? 0 : n
    },

    bool: function (v) {
        if (v === true || v === false) return v
        if (v === 'true') return true
        if (v === 'false') return false
        return null
    },

    lower: function (v) {
        if (v === null || v === undefined) return ''
        return String(v).toLowerCase()
    },

    /** sys_id list out of a row set, skipping rows that carry none. */
    ids: function (rows) {
        var out = []
        var list = rows || []
        for (var i = 0; i < list.length; i++) {
            if (list[i].sys_id) out.push(list[i].sys_id)
        }
        return out
    },

    /** Distinct values of a field. Empties are NAMED, never dropped. */
    distinct: function (rows, field) {
        var seen = {}
        var out = []
        var list = rows || []
        for (var i = 0; i < list.length; i++) {
            var v = list[i][field]
            if (v === null || v === undefined || v === '') v = '(empty)'
            if (seen[v]) continue
            seen[v] = true
            out.push(v)
        }
        return out
    },

    type: 'PaToolReadKit',
}
