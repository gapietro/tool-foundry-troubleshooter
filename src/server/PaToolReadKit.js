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

    /**
     * Prefix for any number measured on the reference instance rather than
     * read from the thing being diagnosed (issue #85).
     *
     * `agent_trace` shipped a note in every payload reading "Execution tasks
     * are NOT 1:1 with tool calls (27 tasks / 19 calls in a measured run)".
     * The two numbers came from an illustrative run measured once during the
     * build. In the v3 scored benchmark pass SIX OF TEN scored runs plus the
     * smoke run read them as findings about the run under diagnosis and built
     * their entire root cause on the supposed discrepancy — one then proposed,
     * as its fix, adding the very note it had misread. A note written to
     * prevent a misreading was causing one.
     *
     * Deleting these numbers is not the fix: R-22 item 4 requires the
     * denominator to travel with every stated count, and R-22 exists because a
     * 10-row sample went unchallenged for want of one. So the numbers stay and
     * the LABEL does the work — and it has to name what the number is NOT
     * about, because "measured on gpinst01" demonstrably was not enough.
     *
     * Emitted counts about the caller's own subject must be live values
     * computed from the rows actually read. This prefix is only for the other
     * kind, and test/referenceStatistics.test.js fails the build if a
     * hard-coded statistic reaches a payload without it.
     */
    REFERENCE_STAT:
        'REFERENCE STATISTIC, measured on the instance this tool was built against: it is NOT a count of ' +
        'anything in this result and must never be reported as a finding. ',

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
            // Success statuses asserted by a path that did not read rows, kept
            // so a rejected claim is visible rather than merely absent (R-25).
            read_status_rejected: {},
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

        this.noteRead(data, table, result.status, true)
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

        this.noteRead(data, table, result.status, true)
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
        var out = { valid: [], probed: candidates, status: 'DENIED' }

        try {
            var gr = new GlideRecordSecure(table)
            for (var i = 0; i < candidates.length; i++) {
                try {
                    if (gr.isValidField(candidates[i])) out.valid.push(candidates[i])
                } catch (e) {
                    // R-1: `e` untouched. Cannot tell is not the same as absent.
                    // The probe stopped part-way, so `valid` is a PREFIX of the
                    // candidate list rather than an answer about all of them.
                    out.status = 'unknown'
                    out.partial = true
                    this.noteRead(data, table, 'unknown')
                    return out
                }
            }
            out.status = 'ok'
        } catch (e) {
            // R-1: `e` untouched.
            out.status = 'DENIED'
        }

        // A SUCCESSFUL PROBE RECORDS NOTHING.
        //
        // `ok` in data.reads means "read succeeded and rows were present" —
        // readRows sets it only when rows.length > 0. A field probe reads no
        // rows at all, so writing `ok` from here asserts something the probe
        // never established, and because noteRead only ever upgrades, a later
        // read returning zero rows could not correct it. The table would be
        // reported readable-with-data on the strength of a schema question.
        //
        // Only the negative outcomes are real information about access, and
        // those are recorded: DENIED here, `unknown` at the early return above.
        if (out.status === 'DENIED') this.noteRead(data, table, 'DENIED')
        return out
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
     *
     * ---------------------------------------------------------------------
     * ONLY A ROW READ MAY ASSERT A SUCCESS STATUS (R-25)
     * ---------------------------------------------------------------------
     * `ok` means "the read succeeded and rows were present" and `empty` means
     * "it succeeded and there were none". Both are claims about DATA, and only
     * a path that actually fetched rows is in a position to make one. A field
     * probe wrote `ok` from a schema question for six review rounds, and
     * because this function only ever upgrades, no later read could correct it.
     *
     * So `fromRowRead` is required for a success status, and it is passed by
     * exactly two callers: readRows and readOne. Anything else may record only
     * the negative outcomes — DENIED and unknown — which are facts about
     * ACCESS rather than about data, and which any path can legitimately
     * observe. A rejected assertion is recorded rather than dropped, so the
     * attempt is visible instead of silently absent.
     *
     * @param {Boolean} [fromRowRead] true only from a path that fetched rows
     */
    noteRead: function (data, table, status, fromRowRead) {
        if (!data || !data.reads) return
        var prior = data.reads[table]

        if ((status === 'ok' || status === 'empty') && !fromRowRead) {
            if (data.read_status_rejected) data.read_status_rejected[table] = status
            return
        }

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
     * Did this call RETRIEVE anything, or did it merely run? (#121)
     *
     * WHY THIS BELONGS HERE. `noteRead` above already computes the answer and
     * this project already throws it away twice. DECISION.md §T4: the depth
     * gate "counts a layer-4 tool being *called*, not layer 4 being
     * *reached*" — v9 row 07's `schema_lookup` answered `table_exists: false`,
     * retrieved nothing, and released the gate. §U9.1: the evidence-return
     * numerator counted r2-2's `genai_log` call, which returned `entries: []`
     * and `llm_call_rows: 0`. Both counted a tool NAME. This turns the
     * `reads` map into the verdict both of them needed.
     *
     * `'ok'` in `reads` is the right signal and not merely a convenient one:
     * R-25 (see `noteRead`) permits a success status ONLY from a path that
     * passed `fromRowRead`, which is `readRows` and `readOne` and nothing
     * else. A schema probe cannot assert it; a field-presence check cannot
     * assert it. So an `'ok'` here means rows were fetched.
     *
     * THREE VALUES, NOT A BOOLEAN, and the third is the point. A row that was
     * never classified must stay distinguishable from a row classified as
     * barren — collapsing `unknown` into `false` is the R-6 failure shape (a
     * blank read as a fact) aimed at the very instrument this exists to make
     * honest. `x_snc_troubleshoot_audit.retrieval` therefore has no default,
     * and every pre-#121 row reads blank rather than `none`.
     *
     * `success === false` is `'none'` rather than `'unknown'`: an error
     * envelope is a definite statement that nothing came back.
     *
     * KNOWN FALSE NEGATIVE, ACCEPTED. `PaToolQueryTable`'s
     * `rows_exist_but_are_not_visible` finding — a GlideAggregate count above
     * zero against a GlideRecordSecure read of zero — establishes a real ACL
     * fact with `reads` at `'empty'`, and scores `'none'` here. This predicate
     * UNDER-counts retrieval. That is the safe direction for a release gate (a
     * false negative costs one hold, bounded by `MAX_HOLDS`) and the safe
     * direction for a numerator that has twice flattered the change it
     * measures.
     *
     * PURE: no Glide, no audit query, no mutation of `result`.
     *
     * @param {*} result a tool core's result, PRE-THRESHOLD. Passing the
     *        post-`applyThreshold` envelope is a defect at the call site, not
     *        here: that envelope carries no `reads` map and would score
     *        `'unknown'` for every large — i.e. every likely productive —
     *        result. See the design doc §3.1.
     * @returns {String} 'ok' | 'none' | 'unknown'
     */
    retrievalVerdict: function (result) {
        if (!this._isPlainObject(result)) return 'unknown'
        if (result.success === false) return 'none'
        if (result.success !== true) return 'unknown'
        if (!this._isPlainObject(result.data)) return 'unknown'

        var reads = result.data.reads
        if (!this._isPlainObject(reads)) return 'unknown'

        for (var table in reads) {
            // Own properties only: an inherited 'ok' is not this call's read.
            if (!Object.prototype.hasOwnProperty.call(reads, table)) continue
            if (reads[table] === 'ok') return 'ok'
        }
        return 'none'
    },

    /** ES5/Rhino: arrays are objects, and `reads` must be a map. */
    _isPlainObject: function (value) {
        return !!value && typeof value === 'object' && !this._isArray(value)
    },

    /** ES5: no `Array.isArray` assumptions on Rhino. */
    _isArray: function (value) {
        return Object.prototype.toString.call(value) === '[object Array]'
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

    /**
     * Tables that came back DENIED, so a core can say WHICH permission gap
     * shaped an empty answer rather than leaving the reader to infer absence.
     *
     * The third axis of the same rule (R-26). R-24 governs how much was read
     * and R-25 whether anything was; this one governs whether the read was
     * permitted at all. An empty collection has three causes and they are not
     * interchangeable: nothing matched, the page was clipped, or the caller
     * was not allowed to look.
     *
     * @returns {Array} table names, empty when nothing was denied
     */
    deniedTables: function (data) {
        var out = []
        if (!data || !data.reads) return out
        for (var table in data.reads) {
            if (!Object.prototype.hasOwnProperty.call(data.reads, table)) continue
            if (data.reads[table] === 'DENIED') out.push(table)
        }
        return out
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

    /**
     * The parameter name prefixed onto its own value — `execution:<sys_id>`.
     *
     * MEASURED, NOT ANTICIPATED (issues #111, #122). A model that is told
     * "pass a JSON object with mode, and optionally execution" has no way to
     * tell that `execution` is a parameter name rather than part of the value
     * it should send, and two independent tools have now received the prefixed
     * form live. #122's case is the sharp one: `execution:<sys_id>` fails
     * isSysId BECAUSE of the prefix, so genai_log read it as a mode, found no
     * such mode, fell back to the default, and returned nothing — a call that
     * every measure counted as having been made.
     *
     * The match is ANCHORED at the head of the string and the segment before
     * the first separator must equal a parameter name IN FULL. That is what
     * keeps a `:` or `=` inside a legitimate value safe — an encoded query
     * such as `sys_created_on>=javascript:gs.beginningOfToday()` has
     * `sys_created_on>` in front of its first separator, which is nobody's
     * parameter name.
     *
     * @param {String} s          a bare, non-JSON argument string
     * @param {Array}  paramNames the tool's accepted parameter names, aliases
     *                            included — take them from the keys the tool's
     *                            own object branch reads, so a parameter the
     *                            tool does not accept cannot appear here
     * @returns {Object|null} {param, value, raw}, or null when nothing matched.
     *          `param` is the CANONICAL spelling as it appears in paramNames,
     *          never the caller's casing: `encodedQuery` and `artifactId` are
     *          read verbatim off the raw object, so a lower-cased repair would
     *          synthesize a key nothing reads and drop the value silently.
     */
    splitParamPrefix: function (s, paramNames) {
        var text = this.trim(s)
        if (!text) return null

        var names = paramNames || []
        if (!names.length) return null

        var cut = text.search(/[:=]/)
        if (cut < 1) return null

        var head = this.lower(this.trim(text.substring(0, cut)))
        var value = this.trim(text.substring(cut + 1))
        if (!value) return null

        for (var i = 0; i < names.length; i++) {
            if (this.lower(names[i]) === head) {
                return { param: names[i], value: value, raw: text }
            }
        }

        return null
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
