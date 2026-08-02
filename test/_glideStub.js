/**
 * Minimal GlideRecordSecure / GlideRecord / GlideDateTime stubs.
 *
 * SCOPE — read this before trusting a test that uses it.
 * This stub exists to catch ONE class of defect: code that never executes.
 * A `ReferenceError` from a stale variable, a typo in a method name, a branch
 * that throws the moment it is entered. That class shipped to the instance
 * twice during this build (`plans is not defined`, surviving in the
 * agent-resolution path because no unit test could reach it), which is why it
 * is here.
 *
 * It proves NOTHING about platform behaviour: not cross-scope readability, not
 * ACLs, not query semantics, not field existence. Per DESIGN.md R-8, a mocked
 * result is not evidence about the platform in either direction. Those remain
 * on-instance checks only.
 *
 * addQuery returns a chainable condition, next()/get() walk a fixed row set,
 * and every field is reported valid — deliberately permissive, because the
 * question being asked is "does this code run", not "is this query right".
 */

function makeGlideRecordSecure(tables) {
    function GlideRecordSecure(table) {
        this._table = table
        this._rows = (tables[table] || []).slice(0)
        this._i = -1
    }

    var condition = {
        addOrCondition: function () {
            return condition
        },
        addCondition: function () {
            return condition
        },
    }

    GlideRecordSecure.prototype.addQuery = function () {
        return condition
    }
    GlideRecordSecure.prototype.addEncodedQuery = function () {}
    // Ordering must reach the DATABASE, so the stub records what was applied
    // and to which table. Sorting after setLimit() sorts an arbitrary page.
    GlideRecordSecure.orderCalls = []
    GlideRecordSecure.prototype.orderBy = function (f) {
        GlideRecordSecure.orderCalls.push([this._table, 'asc', f])
    }
    GlideRecordSecure.prototype.orderByDesc = function (f) {
        GlideRecordSecure.orderCalls.push([this._table, 'desc', f])
    }
    GlideRecordSecure.prototype.setLimit = function () {}
    GlideRecordSecure.prototype.query = function () {}

    GlideRecordSecure.prototype.next = function () {
        this._i++
        return this._i < this._rows.length
    }

    GlideRecordSecure.prototype.get = function (sysId) {
        for (var i = 0; i < this._rows.length; i++) {
            if (this._rows[i].sys_id === String(sysId)) {
                this._i = i
                return true
            }
        }
        return false
    }

    GlideRecordSecure.prototype.isValidField = function () {
        return true
    }

    GlideRecordSecure.prototype.getValue = function (f) {
        var row = this._rows[this._i]
        if (!row) return ''
        return row[f] === undefined || row[f] === null ? '' : String(row[f])
    }

    GlideRecordSecure.prototype.getDisplayValue = function (f) {
        var row = this._rows[this._i]
        if (!row) return ''
        var d = row[f + '__display']
        return d === undefined ? '' : String(d)
    }

    return GlideRecordSecure
}

/**
 * A QUERY-AWARE GlideRecordSecure fake.
 *
 * `makeGlideRecordSecure` above deliberately ignores addQuery — it answers "does
 * this code run", and a permissive stub is right for that. It cannot answer the
 * question PaToolAgentConfig's trigger traversal turns on: *which* key was
 * queried. R-18a's defect was a query against the wrong key returning rows with
 * blanks instead of an error, and a stub that returns every row regardless of
 * the filter reproduces neither the bug nor the fix.
 *
 * Honours addQuery(field, value) and addQuery(field, 'IN', 'a,b,c'), records
 * every query for assertions, and still proves nothing about the platform
 * (DESIGN.md R-8).
 *
 * @param {Object} tables  {tableName: [row, ...]}
 * @param {Object} [options]
 *   denied      [tableName, ...] — these throw on construction, as a cross-scope
 *               denial does. The thrown value's `.message` getter THROWS, so any
 *               handler that inspects it fails the test rather than passing
 *               quietly (R-1).
 *   invalidFields {tableName: [field, ...]} — fields isValidField reports absent
 */
function makeQueryingGlideRecordSecure(tables, options) {
    var opts = options || {}
    var denied = opts.denied || []
    var invalid = opts.invalidFields || {}
    var calls = { queries: [] }

    function hostile() {
        var h = {}
        Object.defineProperty(h, 'message', {
            get: function () {
                throw new Error('Illegal access to getter method getMessage')
            },
        })
        return h
    }

    function GlideRecordSecure(table) {
        if (denied.indexOf(table) !== -1) throw hostile()
        this._table = table
        this._filters = []
        this._matched = null
        this._i = -1
        this._limit = 0
    }

    GlideRecordSecure.calls = calls

    GlideRecordSecure.prototype.addQuery = function (field, op, value) {
        var f = { field: field, op: '=', value: op }
        if (arguments.length >= 3) {
            f.op = String(op).toUpperCase()
            f.value = value
        }
        this._filters.push(f)
        return {
            addOrCondition: function () {
                return this
            },
            addCondition: function () {
                return this
            },
        }
    }

    GlideRecordSecure.prototype.orderBy = function () {}
    GlideRecordSecure.prototype.orderByDesc = function () {}
    GlideRecordSecure.prototype.setLimit = function (n) {
        this._limit = n
    }

    GlideRecordSecure.prototype.query = function () {
        var filters = this._filters
        var rows = (tables[this._table] || []).filter(function (row) {
            return filters.every(function (f) {
                var actual = row[f.field] === undefined || row[f.field] === null ? '' : String(row[f.field])
                var expected = String(f.value)
                switch (f.op) {
                    case 'IN':
                        return expected.split(',').indexOf(actual) !== -1
                    case 'NOT IN':
                        return expected.split(',').indexOf(actual) === -1
                    case '!=':
                        return actual !== expected
                    // Windowed reads compare timestamps as strings, which is
                    // what the platform's own ordering does for glide_date_time
                    // in 'YYYY-MM-DD HH:MM:SS' form.
                    case '>=':
                        return actual >= expected
                    case '<=':
                        return actual <= expected
                    case '>':
                        return actual > expected
                    case '<':
                        return actual < expected
                    case 'LIKE':
                        return actual.indexOf(expected) !== -1
                    case 'STARTSWITH':
                        return actual.indexOf(expected) === 0
                    default:
                        return actual === expected
                }
            })
        })
        calls.queries.push({ table: this._table, filters: filters.slice(0) })
        this._matched = this._limit ? rows.slice(0, this._limit) : rows
        this._i = -1
    }

    GlideRecordSecure.prototype.next = function () {
        this._i++
        return this._i < (this._matched || []).length
    }

    GlideRecordSecure.prototype.get = function (sysId) {
        var rows = tables[this._table] || []
        for (var i = 0; i < rows.length; i++) {
            if (String(rows[i].sys_id) === String(sysId)) {
                this._matched = rows
                this._i = i
                return true
            }
        }
        return false
    }

    GlideRecordSecure.prototype.isValidField = function (f) {
        return (invalid[this._table] || []).indexOf(f) === -1
    }

    GlideRecordSecure.prototype.getValue = function (f) {
        var row = (this._matched || [])[this._i]
        if (!row) return ''
        return row[f] === undefined || row[f] === null ? '' : String(row[f])
    }

    GlideRecordSecure.prototype.getDisplayValue = function (f) {
        var row = (this._matched || [])[this._i]
        if (!row) return ''
        var d = row[f + '__display']
        return d === undefined ? '' : String(d)
    }

    return GlideRecordSecure
}

/**
 * A WRITABLE fake of the app's own tables, for the two components that insert:
 * PaRunAnchor (run records) and PaAuditLogger (audit rows).
 *
 * Plain `GlideRecord`, not `GlideRecordSecure`, matching the real code — Build
 * Rule #42: a Fluent `Table()` installs with zero ACLs, so `GlideRecordSecure`
 * would deny the app write access to its own tables while plain server-side
 * `GlideRecord` keeps working. Stubbing the secure variant here would test a
 * path the production code deliberately does not take.
 *
 * Ordering is applied at query time over the WHOLE matched set, in the sequence
 * `orderBy` was called — because the concurrency tie-break in PaRunAnchor
 * depends on multi-key ordering being real ordering (R-17's lesson: a sort that
 * happens after the page is chosen sorts an arbitrary page).
 *
 * @param {Object} [options]
 *   rows          {tableName: [row, ...]} seed data
 *   failInsert    insert() returns null, as a denied or rejected write does
 *   throwOnInsert throw this value from insert() — pass an object whose
 *                 `.message` getter throws, to enforce R-1
 *   throwOnQuery  same, for query()
 *   failUpdate    update() returns null, as a denied or rejected write does
 *   throwOnUpdate same, for update() — R-1
 *   failUpdateIf  OPTIONAL function(table, row, pendingFields) -> Boolean.
 *                 When it returns true, THAT ONE update() call fails (same
 *                 shape as failUpdate) while every other update — including
 *                 other writes to the SAME row — proceeds normally. This is
 *                 what `failUpdate`/`throwOnUpdate` cannot express: they gate
 *                 every update() call in the whole world, so a scenario like
 *                 "the transcript write succeeds but the status write fails"
 *                 is unreachable with them alone. Opt-in and additive — omit
 *                 it and behavior is identical to before this option existed.
 */
function makeWritableWorld(options) {
    var opts = options || {}
    var tables = {}
    Object.keys(opts.rows || {}).forEach(function (t) {
        tables[t] = opts.rows[t].slice(0)
    })
    var calls = { inserts: [], queries: [], updates: [] }
    var seq = 0

    function rowsFor(table) {
        if (!tables[table]) tables[table] = []
        return tables[table]
    }

    function GlideRecord(table) {
        this._table = table
        this._filters = {}
        this._order = []
        this._pending = null
        this._matched = null
        this._i = -1
    }

    GlideRecord.prototype.initialize = function () {
        this._pending = {}
    }

    GlideRecord.prototype.setValue = function (field, value) {
        if (!this._pending) this._pending = {}
        this._pending[field] = value === null || value === undefined ? '' : String(value)
    }

    GlideRecord.prototype.insert = function () {
        if (opts.throwOnInsert) throw opts.throwOnInsert
        if (opts.failInsert) return null
        seq++
        var row = this._pending || {}
        if (!row.sys_id) row.sys_id = 'sysid' + seq
        // Second granularity, like the platform's — so ties are the NORMAL case
        // in a concurrent batch, not an exotic one.
        if (!row.sys_created_on) row.sys_created_on = opts.now || '2026-07-31 12:00:00'
        if (!row.number) row.number = 'TR000' + (1000000 + seq)
        rowsFor(this._table).push(row)
        calls.inserts.push({ table: this._table, row: row })
        this._matched = [row]
        this._i = 0
        return row.sys_id
    }

    /**
     * MERGES pending field writes into the row found by get()/query(), rather
     * than replacing it wholesale — a real GlideRecord.update() only touches
     * the fields a caller actually setValue()'d. Returns the sys_id, or null
     * on a denied/rejected write (failUpdate) — R-10's degrade-explicitly
     * shape has to be exercisable from a test, same as insert.
     */
    GlideRecord.prototype.update = function () {
        if (opts.throwOnUpdate) throw opts.throwOnUpdate
        if (opts.failUpdate) return null
        var row = (this._matched || [])[this._i]
        if (!row) return null
        var pending = this._pending || {}
        if (typeof opts.failUpdateIf === 'function' && opts.failUpdateIf(this._table, row, pending)) {
            return null
        }
        Object.keys(pending).forEach(function (k) {
            row[k] = pending[k]
        })
        this._pending = null
        calls.updates.push({ table: this._table, row: row })
        return row.sys_id
    }

    GlideRecord.prototype.addQuery = function (field, value) {
        this._filters[field] = String(value)
        return {
            addOrCondition: function () {},
            addCondition: function () {},
        }
    }

    GlideRecord.prototype.orderBy = function (field) {
        this._order.push(field)
    }

    GlideRecord.prototype.setLimit = function () {}

    GlideRecord.prototype.query = function () {
        if (opts.throwOnQuery) throw opts.throwOnQuery
        var filters = this._filters
        var order = this._order
        var matched = rowsFor(this._table).filter(function (row) {
            return Object.keys(filters).every(function (k) {
                return String(row[k] === undefined || row[k] === null ? '' : row[k]) === filters[k]
            })
        })
        if (order.length) {
            matched = matched.slice(0).sort(function (a, b) {
                for (var i = 0; i < order.length; i++) {
                    var f = order[i]
                    var av = String(a[f] === undefined || a[f] === null ? '' : a[f])
                    var bv = String(b[f] === undefined || b[f] === null ? '' : b[f])
                    if (av < bv) return -1
                    if (av > bv) return 1
                }
                return 0
            })
        }
        calls.queries.push({ table: this._table, filters: filters, order: order.slice(0) })
        this._matched = matched
        this._i = -1
    }

    GlideRecord.prototype.getRowCount = function () {
        return (this._matched || []).length
    }

    GlideRecord.prototype.next = function () {
        this._i++
        return this._i < (this._matched || []).length
    }

    GlideRecord.prototype.get = function (sysId) {
        var rows = rowsFor(this._table)
        for (var i = 0; i < rows.length; i++) {
            if (String(rows[i].sys_id) === String(sysId)) {
                this._matched = rows
                this._i = i
                return true
            }
        }
        return false
    }

    GlideRecord.prototype.isValidField = function () {
        return true
    }

    GlideRecord.prototype.getValue = function (field) {
        var row = (this._matched || [])[this._i]
        if (!row) return ''
        return row[field] === undefined || row[field] === null ? '' : String(row[field])
    }

    GlideRecord.prototype.getUniqueValue = function () {
        var row = (this._matched || [])[this._i]
        return row ? String(row.sys_id) : ''
    }

    return { GlideRecord: GlideRecord, tables: tables, calls: calls }
}

function makeGlideDateTime() {
    function GlideDateTime() {
        this._s = 0
    }
    GlideDateTime.prototype.addSeconds = function (n) {
        this._s += n
    }
    GlideDateTime.prototype.toString = function () {
        return '2026-07-30 00:00:00'
    }
    return GlideDateTime
}

module.exports = {
    makeGlideRecordSecure: makeGlideRecordSecure,
    makeQueryingGlideRecordSecure: makeQueryingGlideRecordSecure,
    makeWritableWorld: makeWritableWorld,
    makeGlideDateTime: makeGlideDateTime,
}
