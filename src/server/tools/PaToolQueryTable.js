/**
 * PaToolQueryTable — bounded record reads (LOW_LEVEL_DESIGN.md §4.4).
 *
 * Diagnostic layer 5: does the data the agent needed actually exist. This is
 * the tool that separates "the query is wrong" from "the table is empty" from
 * "the caller cannot see the rows".
 *
 * CONTRACT (LLD §4): execute(args) -> {success: true, data: Object}
 *                                  | {success: false, error: String}
 * Read-only. Data reads are GlideRecordSecure, through PaToolReadKit.
 *
 * ---------------------------------------------------------------------------
 * THE EMPTY-RESULT PROBLEM, AND THE ONE DELIBERATE ACL BYPASS IN THIS APP
 * ---------------------------------------------------------------------------
 * A layer-5 sweep has to distinguish two states that look identical:
 *
 *   the table genuinely holds no matching rows   -> a DATA defect
 *   the rows exist but this caller cannot see them -> an ACCESS defect
 *
 * LLD's own diagnostic for this is explicit: "if new GlideRecordSecure(table)
 * .query() returns 0 rows but new GlideRecord(table).query() returns rows, a
 * missing record-read ACL is the cause." Without it, a missing read ACL is
 * indistinguishable from an empty table BY THE VERY TOOL MEANT TO FIND IT —
 * which is the failure the benchmark's data seed is built around.
 *
 * So when, and ONLY when, the secure read returns zero rows, this tool takes a
 * COUNT through GlideAggregate, which is not ACL-enforced. The bound is
 * deliberate and narrow:
 *
 *   - it runs only on an empty secure result, never alongside one
 *   - it returns a COUNT and nothing else. No field values, no sys_ids, no
 *     row content of any kind crosses the boundary
 *   - the count is reported as what it is, so a reader knows the number came
 *     from an unfiltered read
 *
 * A count is the smallest disclosure that answers the question. Returning rows
 * would make this a "read any table regardless of ACLs" primitive, and it is
 * LLM-callable — that is not a trade worth making for a diagnosis.
 *
 * Standing rules: R-1 (never touch the exception object), R-6 (a blank is a
 * schema mismatch, never absence), R-9 (behave correctly with every input
 * absent).
 */
var PaToolQueryTable = Class.create()

PaToolQueryTable.prototype = {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,

    /** Per-value ceiling. A journal field or a script column would swamp the result. */
    VALUE_CHARS: 500,

    /** Fields returned when the caller names none. */
    MAX_AUTO_FIELDS: 12,

    MAX_DEPTH: 15,

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

    execute: function (args) {
        var phase = 'normalize_args'

        try {
            var k = this._k()
            var a = this._normalizeArgs(args)
            var data = k.newData('PaToolQueryTable', 'bounded-1')

            if (a._parse_error) {
                data.notes.push(
                    'Arguments arrived as a string that looked like JSON but did not parse. ' +
                        'Proceeding as if no arguments were supplied.'
                )
            }

            data.requested = {
                table: a.table || null,
                query: a.query || null,
                fields: a.fields || null,
                limit: a.limit || null,
            }

            if (!a.table) {
                // R-9. A refusal, but not a fault — and it says what to supply.
                data.status = 'no_table'
                data.rows = []
                data.notes.push(
                    'No table was supplied, so there is nothing to query. Call with table=<name>, ' +
                        'optionally query=<encoded query>, fields=<comma-separated list> and limit (default ' +
                        this.DEFAULT_LIMIT +
                        ', max ' +
                        this.MAX_LIMIT +
                        '). This is not an error — a missing argument is expected (DESIGN.md R-9).'
                )
                data.evidence_basis = this._evidenceBasis(data)
                return { success: true, data: data }
            }

            phase = 'validate_table'
            var check = this._tableExists(a.table, data)
            data.table_exists = check.exists

            if (check.exists === false) {
                data.status = 'table_does_not_exist'
                data.rows = []
                data.findings = [
                    {
                        finding: 'table_does_not_exist',
                        severity: 'high',
                        table: a.table,
                        why:
                            'No sys_db_object row is named "' +
                            a.table +
                            '". Querying a non-existent table does not error — it returns nothing, which ' +
                            'reads as "no data" rather than "wrong name".',
                        next_step: 'Confirm the name with schema_lookup before querying it.',
                    },
                ]
                data.evidence_basis = this._evidenceBasis(data)
                return { success: true, data: data }
            }

            data.table_info = check.row

            phase = 'resolve_fields'
            var fields = this._resolveFields(a, data)
            data.fields_returned = fields

            phase = 'query'
            var limit = this._limit(a, data)
            var query = a.query || ''
            var read = k.readRows(
                a.table,
                function (gr) {
                    if (query) gr.addEncodedQuery(query)
                },
                fields,
                fields,
                limit,
                null,
                data
            )

            data.read_status = read.status
            data.rows = this._shapeRows(read.rows, fields)
            data.row_count = data.rows.length
            data.limit_applied = limit
            data.truncated_at = data.rows.length >= limit ? limit : null

            if (read.status === 'DENIED') {
                data.status = 'denied'
                data.notes.push(
                    'The table could not be read from this scope at all. This is a privilege gap and says ' +
                        'NOTHING about whether the rows exist.'
                )
            } else if (!data.rows.length) {
                phase = 'disambiguate_empty'
                data.status = 'empty'
                data.empty_result = this._disambiguateEmpty(a.table, query, data)
            } else {
                data.status = 'ok'
            }

            phase = 'finalize'
            data.evidence_basis = this._evidenceBasis(data)
            return { success: true, data: data }
        } catch (e) {
            // R-1: the exception object is deliberately NOT read.
            return {
                success: false,
                error:
                    'PaToolQueryTable failed during phase "' +
                    phase +
                    '". Exception detail deliberately not read — see DESIGN.md R-1 ' +
                    '(reading a ScopeAccessNotGrantedException throws again and kills the request).',
            }
        }
    },

    // =======================================================================
    // Arguments (R-9)
    // =======================================================================

    _normalizeArgs: function (args) {
        var k = this._k()
        var raw = args

        if (raw === null || raw === undefined) return {}

        if (typeof raw === 'string') {
            var s = k.trim(raw)
            if (!s) return {}

            var parsed = k.tryParse(s)
            if (k.isPlainObject(parsed)) {
                raw = parsed
            } else if (s.charAt(0) === '{' || s.charAt(0) === '[') {
                return { _parse_error: true }
            } else {
                return { table: s }
            }
        }

        if (!k.isPlainObject(raw)) return {}

        var out = {}
        var table = k.str(raw.table || raw.table_name)
        var query = k.str(raw.query || raw.encoded_query || raw.encodedQuery)

        if (table) out.table = table
        if (query) out.query = query

        var fields = this._fieldList(raw.fields)
        if (fields.length) out.fields = fields

        var limit = k.num(raw.limit)
        if (limit > 0) out.limit = limit

        return out
    },

    /** Accepts an array or a comma-separated string — both arrive in practice. */
    _fieldList: function (value) {
        var k = this._k()
        var out = []
        var i

        if (k.isArray(value)) {
            for (i = 0; i < value.length; i++) {
                var v = k.str(value[i])
                if (v) out.push(v)
            }
            return out
        }

        var s = k.str(value)
        if (!s) return out

        var parts = s.split(',')
        for (i = 0; i < parts.length; i++) {
            var p = k.trim(parts[i])
            if (p) out.push(p)
        }
        return out
    },

    _limit: function (a, data) {
        var requested = a.limit || this.DEFAULT_LIMIT
        if (requested > this.MAX_LIMIT) {
            data.notes.push(
                'The requested limit of ' +
                    requested +
                    ' exceeds the ' +
                    this.MAX_LIMIT +
                    '-row ceiling and was clamped. Stated rather than silently applied — an unbounded read ' +
                    'inflates the scratchpad and every later reasoning turn re-reads it.'
            )
            return this.MAX_LIMIT
        }
        return requested
    },

    // =======================================================================
    // Table and fields
    // =======================================================================

    _tableExists: function (table, data) {
        var k = this._k()
        var read = k.readRows(
            'sys_db_object',
            k.eqQuery('name', table),
            ['sys_id', 'name', 'label', 'super_class', 'caller_access', 'ws_access'],
            ['super_class', 'caller_access'],
            1,
            null,
            data
        )

        if (read.status === 'DENIED') {
            data.notes.push(
                'sys_db_object is not readable from this scope, so the table name could not be validated ' +
                    'before querying. The query below was attempted anyway; an empty result may mean the ' +
                    'name is wrong.'
            )
            return { exists: 'unknown', row: null }
        }
        if (!read.rows.length) return { exists: false, row: null }

        var row = read.rows[0]
        return {
            exists: true,
            row: {
                name: row.name,
                label: row.label,
                super_class: row.super_class_display || null,
                caller_access: row.caller_access,
                caller_access_label: row.caller_access_display || null,
                ws_access: row.ws_access,
            },
        }
    },

    /**
     * With no field list, return sys_id plus the columns most likely to
     * identify a row — and SAY the list was chosen rather than requested.
     */
    _resolveFields: function (a, data) {
        var k = this._k()
        if (a.fields && a.fields.length) {
            var out = a.fields.slice(0)
            if (out.indexOf('sys_id') === -1) out.unshift('sys_id')
            return out
        }

        var chosen = ['sys_id']
        var read = k.readRows(
            'sys_dictionary',
            function (gr) {
                gr.addQuery('name', a.table)
            },
            ['sys_id', 'element', 'display', 'internal_type'],
            [],
            this.MAX_AUTO_FIELDS * 4,
            'element',
            data
        )

        var displayField = null
        var candidates = []
        for (var i = 0; i < read.rows.length; i++) {
            var element = k.trim(read.rows[i].element)
            if (!element) continue
            if (k.lower(read.rows[i].display) === 'true') displayField = element
            candidates.push(element)
        }

        if (displayField) chosen.push(displayField)
        if (candidates.indexOf('name') !== -1 && chosen.indexOf('name') === -1) chosen.push('name')
        if (candidates.indexOf('number') !== -1) chosen.push('number')
        if (candidates.indexOf('short_description') !== -1) chosen.push('short_description')
        if (candidates.indexOf('active') !== -1) chosen.push('active')
        chosen.push('sys_created_on')

        for (var c = 0; c < candidates.length && chosen.length < this.MAX_AUTO_FIELDS; c++) {
            if (chosen.indexOf(candidates[c]) === -1) chosen.push(candidates[c])
        }

        data.notes.push(
            'No fields were requested, so ' +
                chosen.length +
                ' were chosen automatically (sys_id, the display column, and the first identifying columns ' +
                'declared on the table). This is a SAMPLE of the record, not the whole of it — name the ' +
                'fields you need to see the rest.'
        )
        return chosen
    },

    _shapeRows: function (rows, fields) {
        var k = this._k()
        var out = []

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i]
            var shaped = {}
            for (var f = 0; f < fields.length; f++) {
                var name = fields[f]
                var value = row[name]
                shaped[name] = k.digest(value, this.VALUE_CHARS)
                var display = row[name + '_display']
                if (display !== undefined) shaped[name + '_display'] = k.digest(display, this.VALUE_CHARS)
            }
            out.push(shaped)
        }
        return out
    },

    // =======================================================================
    // The empty-result disambiguation — read the header before changing it
    // =======================================================================

    /**
     * Runs ONLY on an empty secure result, and returns ONLY a count. See the
     * header for why the bypass is bounded this way.
     */
    _disambiguateEmpty: function (table, query, data) {
        var out = {
            visible_rows: 0,
            unfiltered_row_count: null,
            verdict: 'unknown',
            method:
                'The data read above is GlideRecordSecure and returned nothing. To tell an empty table ' +
                'from an ACL-filtered one, a COUNT — and only a count, never row content — is taken ' +
                'without ACL filtering.',
        }

        var total = this._unfilteredCount(table, query)
        out.unfiltered_row_count = total.count
        out.count_status = total.status

        if (total.status !== 'ok') {
            out.verdict = 'unknown'
            out.detail =
                'The unfiltered count could not be taken (' +
                total.status +
                '), so an empty table cannot be distinguished from an ACL-filtered one. Do not read this ' +
                'empty result as proof the data is missing.'
            return out
        }

        if (total.count > 0) {
            out.verdict = 'acl_filtered'
            out.detail =
                'The rows EXIST — ' +
                total.count +
                ' match this query — but none of them are visible to the caller. This is an ACCESS defect, ' +
                'not a data defect, and the fix is a record-read ACL rather than seeding data. Note the ' +
                'count comes from an unfiltered read; no row content was returned.'
            data.findings = (data.findings || []).concat([
                {
                    finding: 'rows_exist_but_are_not_visible',
                    severity: 'high',
                    table: table,
                    why:
                        'GlideRecordSecure returned 0 rows while an unfiltered count returned ' +
                        total.count +
                        '. A missing record-read ACL is the documented cause.',
                    next_step:
                        'Add an Acl({type: "record", table, operation: "read"}) for the role that needs it. ' +
                        'Note a Fluent Table() installs with ZERO ACLs, which denies everyone including ' +
                        'admin while server-side scoped GlideRecord keeps working — so the gap is invisible ' +
                        'from the code that writes the rows (SDK Build Rule #42).',
                },
            ])
            return out
        }

        out.verdict = 'genuinely_empty'
        out.detail =
            'No rows match, with or without ACL filtering. This is a DATA finding: the records the agent ' +
            'needed are not there. The query and the table name are both confirmed above, so this is not a ' +
            'lookup mistake.'
        return out
    },

    /**
     * @returns {Object} {count, status: 'ok'|'unavailable'}
     *
     * GlideAggregate is used rather than a GlideRecord walk so the row content
     * is never materialised at all — the count is the only thing that can come
     * back. If it is unavailable in this scope the answer is "unknown", which
     * is a valid answer; guessing is not.
     */
    _unfilteredCount: function (table, query) {
        try {
            var ga = new GlideAggregate(table)
            if (query) ga.addEncodedQuery(query)
            ga.addAggregate('COUNT')
            ga.query()
            if (ga.next()) {
                var n = parseInt(ga.getAggregate('COUNT'), 10)
                return { count: isNaN(n) ? 0 : n, status: 'ok' }
            }
            return { count: 0, status: 'ok' }
        } catch (e) {
            // R-1: `e` is NOT read. GlideAggregate may be unavailable to this
            // scope for the same reason the secure read came back empty.
            return { count: null, status: 'unavailable' }
        }
    },

    _evidenceBasis: function (data) {
        var k = this._k()
        // R-24: every bound that was hit, surfaced whether or not the section
        // that hit it thought to mention it. A silent cap now requires deleting
        // a line here rather than forgetting one at a call site.
        var truncations = data.truncations || {}
        var truncationNote = k.anyTruncation(data)
            ? 'One or more reads hit their ceiling — see truncations. Any count or absence derived from ' +
              'those tables is a LOWER BOUND, not a complete answer.'
            : null

        return {
            truncations: truncations,
            truncation_note: truncationNote,
            statement:
                'row_rows is the number of rows actually returned by a GlideRecordSecure read. A zero with ' +
                'status "empty" is checked against an unfiltered count before being called an absence; a ' +
                'zero with status "denied" says nothing about the data at all.',
            row_rows: data.rows ? data.rows.length : 0,
            status: data.status || null,
            empty_verdict: data.empty_result ? data.empty_result.verdict : null,
            read_status_by_table: data.reads,
            tables_with_missing_fields: data.field_warnings.length,
        }
    },

    type: 'PaToolQueryTable',
}
