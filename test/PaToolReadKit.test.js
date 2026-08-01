/**
 * PaToolReadKit — the GlideRecordSecure read layer shared by the tool cores.
 *
 * This kit is a verbatim lift of the read layer inside PaToolAgentTrace.js, so
 * these tests exist to stop the two copies diverging on the four behaviours that
 * were expensive to learn:
 *
 *   R-1  a denial's exception object is never touched
 *   R-6  a field the table does not declare is REPORTED, never read as a blank
 *   R-17 ordering reaches the database, before setLimit picks the page
 *        DENIED is sticky — a later permitted read must not overwrite it
 *
 * What this CANNOT verify (DESIGN.md R-8): anything about real platform
 * behaviour — cross-scope readability, ACLs, query semantics, field existence.
 * A stubbed result is not evidence in either direction. Those stay on-instance.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeGlideRecordSecure } = require('./_glideStub')

function kitWith(GlideRecordSecure) {
    const ctx = loadScriptInclude('PaToolReadKit.js', { GlideRecordSecure: GlideRecordSecure })
    return new ctx.PaToolReadKit()
}

/** A stub whose query() throws a value that throws AGAIN when inspected. */
function makeHostileStub() {
    function GlideRecordSecure() {}
    GlideRecordSecure.prototype.addQuery = function () {
        return { addOrCondition: function () {} }
    }
    GlideRecordSecure.prototype.orderBy = function () {}
    GlideRecordSecure.prototype.orderByDesc = function () {}
    GlideRecordSecure.prototype.setLimit = function () {}
    GlideRecordSecure.prototype.isValidField = function () {
        return true
    }
    GlideRecordSecure.prototype.query = function () {
        // Mirrors ScopeAccessNotGrantedException: reading .message throws
        // "Illegal access to getter method getMessage", which escapes the
        // handler and 500s the whole request.
        const hostile = {}
        Object.defineProperty(hostile, 'message', {
            get: function () {
                throw new Error('Illegal access to getter method getMessage')
            },
        })
        throw hostile
    }
    GlideRecordSecure.prototype.next = function () {
        return false
    }
    GlideRecordSecure.prototype.get = function () {
        throw new Error('denied')
    }
    return GlideRecordSecure
}

/** A stub that records the ORDER in which query-shaping calls arrive. */
function makeSequenceStub(sequence) {
    function GlideRecordSecure(table) {
        this._table = table
    }
    GlideRecordSecure.prototype.addQuery = function () {
        sequence.push('addQuery')
        return { addOrCondition: function () {} }
    }
    GlideRecordSecure.prototype.orderBy = function (f) {
        sequence.push('orderBy:' + f)
    }
    GlideRecordSecure.prototype.orderByDesc = function (f) {
        sequence.push('orderByDesc:' + f)
    }
    GlideRecordSecure.prototype.setLimit = function (n) {
        sequence.push('setLimit:' + n)
    }
    GlideRecordSecure.prototype.query = function () {
        sequence.push('query')
    }
    GlideRecordSecure.prototype.isValidField = function () {
        return true
    }
    GlideRecordSecure.prototype.next = function () {
        return false
    }
    return GlideRecordSecure
}

describe('PaToolReadKit.readRows', () => {
    it('returns plucked rows and reports status ok', () => {
        const kit = kitWith(
            makeGlideRecordSecure({
                sn_aia_agent: [{ sys_id: 'a1', name: 'Agent Doctor' }],
            })
        )
        const data = kit.newData()
        const read = kit.readRows('sn_aia_agent', null, ['sys_id', 'name'], [], 10, null, data)

        expect(read.status).toBe('ok')
        expect(read.rows).toEqual([{ sys_id: 'a1', name: 'Agent Doctor' }])
        expect(data.reads.sn_aia_agent).toBe('ok')
    })

    it('reports empty rather than DENIED when the table reads but matches nothing', () => {
        const kit = kitWith(makeGlideRecordSecure({ sn_aia_agent: [] }))
        const data = kit.newData()
        const read = kit.readRows('sn_aia_agent', null, ['sys_id'], [], 10, null, data)

        // The distinction is the whole point: "empty" is a genuine absence and
        // therefore a finding; "DENIED" says nothing about the data at all.
        expect(read.status).toBe('empty')
        expect(data.reads.sn_aia_agent).toBe('empty')
    })

    it('records DENIED without ever inspecting the exception (R-1)', () => {
        const kit = kitWith(makeHostileStub())
        const data = kit.newData()

        // If the kit touches `e` at all, the getter throws a SECOND time, the
        // catch is escaped, and this call throws instead of returning.
        const read = kit.readRows('syslog', null, ['sys_id'], [], 10, null, data)

        expect(read.status).toBe('DENIED')
        expect(read.rows).toEqual([])
        expect(data.reads.syslog).toBe('DENIED')
    })

    it('applies ordering at the database, before setLimit (R-17)', () => {
        const sequence = []
        const kit = kitWith(makeSequenceStub(sequence))
        kit.readRows(
            'sn_aia_execution_plan',
            kit.eqQuery('usecase', 'u1'),
            ['sys_id'],
            [],
            10,
            [{ field: 'sys_created_on', desc: true }, 'sys_id'],
            kit.newData()
        )

        // Sorting AFTER setLimit sorts an arbitrary page and then labels it
        // "the most recent" — how the first trace build reported June plans as
        // the newest on an instance whose newest was July.
        expect(sequence).toEqual([
            'addQuery',
            'orderByDesc:sys_created_on',
            'orderBy:sys_id',
            'setLimit:10',
            'query',
        ])
    })

    it('reports fields the table does not declare instead of reading them as blank (R-6)', () => {
        const Stub = makeGlideRecordSecure({ sn_aia_tools_execution: [{ sys_id: 't1' }] })
        Stub.prototype.isValidField = function (f) {
            return f !== 'execution_plan'
        }

        const kit = kitWith(Stub)
        const data = kit.newData()
        const read = kit.readRows(
            'sn_aia_tools_execution',
            null,
            ['sys_id', 'execution_plan'],
            [],
            10,
            null,
            data
        )

        expect(read.missing_fields).toEqual(['execution_plan'])
        expect(data.field_warnings).toHaveLength(1)
        expect(data.field_warnings[0].table).toBe('sn_aia_tools_execution')
        expect(data.field_warnings[0].missing_fields).toEqual(['execution_plan'])
    })

    it('records the field warning for a table only once', () => {
        const Stub = makeGlideRecordSecure({ sn_aia_agent: [{ sys_id: 'a1' }] })
        Stub.prototype.isValidField = function () {
            return false
        }

        const kit = kitWith(Stub)
        const data = kit.newData()
        kit.readRows('sn_aia_agent', null, ['nope'], [], 10, null, data)
        kit.readRows('sn_aia_agent', null, ['nope'], [], 10, null, data)

        expect(data.field_warnings).toHaveLength(1)
    })

    it('does not claim a field is missing when the presence check itself is unavailable', () => {
        const Stub = makeGlideRecordSecure({ sn_aia_agent: [{ sys_id: 'a1' }] })
        Stub.prototype.isValidField = function () {
            throw new Error('unavailable')
        }

        const kit = kitWith(Stub)
        const read = kit.readRows('sn_aia_agent', null, ['name'], [], 10, null, kit.newData())

        // "I cannot tell" is not "it is missing". Reporting the latter would be
        // the R-6 failure committed by the check meant to prevent it.
        expect(read.missing_fields).toEqual(['(field presence check unavailable)'])
        expect(read.status).toBe('ok')
    })
})

describe('PaToolReadKit.readOne', () => {
    it('returns the row when it exists', () => {
        const kit = kitWith(
            makeGlideRecordSecure({ sn_aia_agent: [{ sys_id: 'a1', name: 'Doctor' }] })
        )
        const read = kit.readOne('sn_aia_agent', 'a1', ['sys_id', 'name'], [], kit.newData())

        expect(read.status).toBe('ok')
        expect(read.row.name).toBe('Doctor')
    })

    it('reports empty for a sys_id that is genuinely absent', () => {
        const kit = kitWith(makeGlideRecordSecure({ sn_aia_agent: [{ sys_id: 'a1' }] }))
        const read = kit.readOne('sn_aia_agent', 'nope', ['sys_id'], [], kit.newData())

        expect(read.status).toBe('empty')
        expect(read.row).toBeNull()
    })

    it('records DENIED without inspecting the exception (R-1)', () => {
        const kit = kitWith(makeHostileStub())
        const read = kit.readOne('syslog', 'x', ['sys_id'], [], kit.newData())

        expect(read.status).toBe('DENIED')
    })
})

describe('PaToolReadKit.noteRead', () => {
    it('keeps DENIED sticky when a later read of the same table succeeds', () => {
        const kit = kitWith(makeGlideRecordSecure({}))
        const data = kit.newData()

        kit.noteRead(data, 'syslog', 'DENIED')
        kit.noteRead(data, 'syslog', 'ok')

        // The denial is the diagnostically important fact. Letting a permitted
        // read overwrite it would report the table as readable.
        expect(data.reads.syslog).toBe('DENIED')
    })

    it('upgrades empty to ok', () => {
        const kit = kitWith(makeGlideRecordSecure({}))
        const data = kit.newData()

        kit.noteRead(data, 'sn_aia_agent', 'empty')
        kit.noteRead(data, 'sn_aia_agent', 'ok')

        expect(data.reads.sn_aia_agent).toBe('ok')
    })

    it('lets any real read outcome supersede unknown', () => {
        // `unknown` means the field-presence check was unavailable — "could not
        // tell", not "could not read". Leaving it in place after rows came back
        // reports a table as indeterminate when it was read successfully, which
        // understates access in the direction this project keeps getting wrong.
        const kit = kitWith(makeGlideRecordSecure({}))

        const a = kit.newData()
        kit.noteRead(a, 't', 'unknown')
        kit.noteRead(a, 't', 'ok')
        expect(a.reads.t).toBe('ok')

        const b = kit.newData()
        kit.noteRead(b, 't', 'unknown')
        kit.noteRead(b, 't', 'empty')
        expect(b.reads.t).toBe('empty')
    })

    it('never downgrades a real outcome back to unknown', () => {
        const kit = kitWith(makeGlideRecordSecure({}))
        const data = kit.newData()

        kit.noteRead(data, 't', 'ok')
        kit.noteRead(data, 't', 'unknown')
        expect(data.reads.t).toBe('ok')
    })

    it('keeps DENIED sticky even against unknown', () => {
        const kit = kitWith(makeGlideRecordSecure({}))
        const data = kit.newData()

        kit.noteRead(data, 't', 'DENIED')
        kit.noteRead(data, 't', 'unknown')
        expect(data.reads.t).toBe('DENIED')
    })
})

describe('PaToolReadKit.pluck', () => {
    it('emits a display value only when it differs from the raw value', () => {
        const kit = kitWith(
            makeGlideRecordSecure({
                t: [{ sys_id: 's1', state: '3', state__display: 'Terminated', name: 'x', name__display: 'x' }],
            })
        )
        const read = kit.readRows('t', null, ['sys_id', 'state', 'name'], ['state', 'name'], 10, null, kit.newData())

        expect(read.rows[0].state_display).toBe('Terminated')
        // Same string twice is noise, not information.
        expect(read.rows[0].name_display).toBeUndefined()
    })
})

describe('PaToolReadKit shaping helpers', () => {
    let kit
    beforeEach(() => {
        kit = kitWith(makeGlideRecordSecure({}))
    })

    it('digests long values and states exactly how much was cut', () => {
        const out = kit.digest('x'.repeat(500), 200)

        expect(out).toHaveLength(200 + '...[+300 more chars]'.length)
        expect(out).toContain('...[+300 more chars]')
    })

    it('leaves short values untouched', () => {
        expect(kit.digest('short', 200)).toBe('short')
    })

    it('stringifies objects before digesting', () => {
        expect(kit.digest({ a: 1 }, 200)).toBe('{"a":1}')
    })

    it('normalises the literal string "undefined" that real reference fields carry', () => {
        // Observed on sn_aia_execution_plan.agent for every security_violation
        // plan. It is truthy, so a plain emptiness check renders a sys_id
        // pointing at nothing (R-15 item 4).
        expect(kit.refValue('undefined')).toBe('')
        expect(kit.refValue('null')).toBe('')
        expect(kit.refValue('')).toBe('')
        expect(kit.refValue(null)).toBe('')
        expect(kit.refValue('  a1b2  ')).toBe('a1b2')
    })

    it('recognises a 32-char hex sys_id and nothing else', () => {
        expect(kit.isSysId('c9d63a932bda8b9417a6ffbeee91bfd0')).toBe(true)
        expect(kit.isSysId('Agent Doctor')).toBe(false)
        expect(kit.isSysId('c9d63a932bda8b9417a6ffbeee91bfd')).toBe(false)
        expect(kit.isSysId(null)).toBe(false)
    })

    it('reads arrays that crossed a realm boundary', () => {
        // instanceof Array compares against the CURRENT realm's constructor, so
        // it is false for a Java-backed list out of a scoped REST request.
        const foreign = loadScriptInclude('PaToolReadKit.js', {}).PaToolReadKit
        expect(new foreign().isArray([])).toBe(true)
        expect(new foreign().isArray({})).toBe(false)
    })

    it('collects distinct values, naming empties rather than dropping them', () => {
        const rows = [{ role: 'agent' }, { role: '' }, { role: 'agent' }, { role: 'user' }]
        expect(kit.distinct(rows, 'role')).toEqual(['agent', '(empty)', 'user'])
    })

    it('parses tolerantly and never throws', () => {
        expect(kit.tryParse('{"a":1}')).toEqual({ a: 1 })
        expect(kit.tryParse('not json')).toBeNull()
    })
})
