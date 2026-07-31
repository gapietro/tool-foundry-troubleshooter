/**
 * Minimal GlideRecordSecure / GlideDateTime stubs.
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
    GlideRecordSecure.prototype.orderBy = function () {}
    GlideRecordSecure.prototype.orderByDesc = function () {}
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
    makeGlideDateTime: makeGlideDateTime,
}
