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
const { makeGlideRecordSecure, makeQueryingGlideRecordSecure } = require('./_glideStub')

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
            // limit + 1, deliberately: see the truncation tests below.
            'setLimit:11',
            'query',
        ])
    })

    it('detects truncation by reading one more row than it returns', () => {
        // `rows.length === limit` cannot distinguish a truncated result from an
        // exactly-full one, and every consumer of that ambiguity in this
        // codebase resolved it the optimistic way - four silent caps across
        // four review rounds. Reading limit+1 makes it a fact.
        const kit = kitWith(
            makeGlideRecordSecure({
                t: [{ sys_id: '1' }, { sys_id: '2' }, { sys_id: '3' }],
            })
        )
        const data = kit.newData()
        const read = kit.readRows('t', null, ['sys_id'], [], 2, null, data)

        expect(read.rows).toHaveLength(2)
        expect(read.truncated_at).toBe(2)
        expect(data.truncations.t).toBe(2)
        expect(kit.anyTruncation(data)).toBe(true)
    })

    it('does not claim truncation when the result exactly fills the limit', () => {
        const kit = kitWith(makeGlideRecordSecure({ t: [{ sys_id: '1' }, { sys_id: '2' }] }))
        const data = kit.newData()
        const read = kit.readRows('t', null, ['sys_id'], [], 2, null, data)

        expect(read.rows).toHaveLength(2)
        expect(read.truncated_at).toBeUndefined()
        expect(kit.anyTruncation(data)).toBe(false)
    })

    it('keeps the largest bound when a table is read more than once', () => {
        const kit = kitWith(makeGlideRecordSecure({}))
        const data = kit.newData()

        kit.noteTruncation(data, 't', 20)
        kit.noteTruncation(data, 't', 5)
        // A later, smaller read must not mask a bigger truncation.
        expect(data.truncations.t).toBe(20)
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

describe('PaToolReadKit.validFields', () => {
    /** A stub whose isValidField throws on a named field, mid-probe. */
    function throwingOn(field) {
        const Stub = makeGlideRecordSecure({ t: [{ sys_id: '1' }] })
        Stub.prototype.isValidField = function (f) {
            if (f === field) throw new Error('unavailable')
            return true
        }
        return Stub
    }

    it('records NOTHING in reads when the probe succeeds', () => {
        // `ok` means "read succeeded and rows were present" — readRows sets it
        // only when rows.length > 0. A probe reads no rows, so writing `ok`
        // from here asserts something it never established, and noteRead only
        // upgrades, so a later empty read could not correct it.
        const kit = kitWith(makeGlideRecordSecure({ t: [] }))
        const data = kit.newData()

        const probe = kit.validFields('t', ['a', 'b'], data)

        expect(probe.status).toBe('ok')
        expect(data.reads.t).toBeUndefined()
    })

    it('does not let a successful probe mask a later empty read', () => {
        const kit = kitWith(makeGlideRecordSecure({ t: [] }))
        const data = kit.newData()

        kit.validFields('t', ['a'], data)
        kit.readRows('t', null, ['a'], [], 10, null, data)

        // The table really did return zero rows, and the evidence block has to
        // say so — an `ok` here would be an absence dressed as data.
        expect(data.reads.t).toBe('empty')
    })

    it('records unknown when the probe stops part-way', () => {
        const kit = kitWith(throwingOn('b'))
        const data = kit.newData()

        const probe = kit.validFields('t', ['a', 'b', 'c'], data)

        expect(probe.status).toBe('unknown')
        expect(probe.partial).toBe(true)
        // Previously this returned early WITHOUT recording anything, so a
        // consumer checking only for DENIED proceeded on a truncated list.
        expect(data.reads.t).toBe('unknown')
    })

    it('reports the candidate list alongside what it confirmed', () => {
        const kit = kitWith(throwingOn('b'))
        const probe = kit.validFields('t', ['a', 'b', 'c'], kit.newData())

        // `valid` is a PREFIX on a partial probe, not an answer about all three.
        expect(probe.valid).toEqual(['a'])
        expect(probe.probed).toEqual(['a', 'b', 'c'])
    })

    it('records DENIED when the table cannot be opened at all', () => {
        // makeHostileStub throws from query(), not from the constructor - a
        // field probe never calls query(), so the denial has to come from
        // opening the table, which is what a cross-scope block actually does.
        const kit = kitWith(makeQueryingGlideRecordSecure({}, { denied: ['syslog'] }))
        const data = kit.newData()

        expect(kit.validFields('syslog', ['a'], data).status).toBe('DENIED')
        expect(data.reads.syslog).toBe('DENIED')
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

        kit.noteRead(data, 'sn_aia_agent', 'empty', true)
        kit.noteRead(data, 'sn_aia_agent', 'ok', true)

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
        kit.noteRead(a, 't', 'ok', true)
        expect(a.reads.t).toBe('ok')

        const b = kit.newData()
        kit.noteRead(b, 't', 'unknown')
        kit.noteRead(b, 't', 'empty', true)
        expect(b.reads.t).toBe('empty')
    })

    it('never downgrades a real outcome back to unknown', () => {
        const kit = kitWith(makeGlideRecordSecure({}))
        const data = kit.newData()

        kit.noteRead(data, 't', 'ok', true)
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

describe('only a row read may assert a success status (R-25)', () => {
    it('refuses ok from a caller that did not read rows, and records the attempt', () => {
        // A field probe wrote `ok` from a schema question for six review
        // rounds. Because noteRead only upgrades, no later read could correct
        // it - the table stayed reported as readable-with-data on the strength
        // of a question that fetched nothing.
        const kit = kitWith(makeGlideRecordSecure({}))
        const data = kit.newData()

        kit.noteRead(data, 't', 'ok')

        expect(data.reads.t).toBeUndefined()
        // Rejected, not dropped: the attempt stays visible.
        expect(data.read_status_rejected.t).toBe('ok')
    })

    it('refuses empty on the same grounds', () => {
        const kit = kitWith(makeGlideRecordSecure({}))
        const data = kit.newData()

        kit.noteRead(data, 't', 'empty')

        expect(data.reads.t).toBeUndefined()
        expect(data.read_status_rejected.t).toBe('empty')
    })

    it('still accepts the negative outcomes from any caller', () => {
        // DENIED and unknown are facts about ACCESS, not about data, and any
        // path can legitimately observe them.
        const kit = kitWith(makeGlideRecordSecure({}))
        const denied = kit.newData()
        const unknown = kit.newData()

        kit.noteRead(denied, 't', 'DENIED')
        kit.noteRead(unknown, 't', 'unknown')

        expect(denied.reads.t).toBe('DENIED')
        expect(unknown.reads.t).toBe('unknown')
    })

    it('accepts a success status from a real read', () => {
        const kit = kitWith(makeGlideRecordSecure({ t: [{ sys_id: '1' }] }))
        const data = kit.newData()

        kit.readRows('t', null, ['sys_id'], [], 10, null, data)

        expect(data.reads.t).toBe('ok')
        expect(data.read_status_rejected).toEqual({})
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

// ---------------------------------------------------------------------------
// splitParamPrefix — the parameter name prefixed onto its own value (#111, #122)
// ---------------------------------------------------------------------------
describe('splitParamPrefix (#122)', () => {
    const kit = () => kitWith(makeGlideRecordSecure([]))
    const GENAI = ['mode', 'execution', 'execution_plan', 'plan', 'capability']

    it('splits the measured genai_log malformation on a colon', () => {
        const r = kit().splitParamPrefix('execution:45bbfd112ba6cf54f243fed2ce91bfcb', GENAI)

        expect(r).toEqual({
            param: 'execution',
            value: '45bbfd112ba6cf54f243fed2ce91bfcb',
            raw: 'execution:45bbfd112ba6cf54f243fed2ce91bfcb',
        })
    })

    it('splits on an equals sign as well as a colon', () => {
        expect(kit().splitParamPrefix('mode=llm', GENAI)).toEqual({
            param: 'mode',
            value: 'llm',
            raw: 'mode=llm',
        })
    })

    it('tolerates whitespace around the separator', () => {
        const r = kit().splitParamPrefix('  execution : 45bb  ', GENAI)

        expect(r.param).toBe('execution')
        expect(r.value).toBe('45bb')
    })

    it('matches the parameter name case-insensitively', () => {
        expect(kit().splitParamPrefix('EXECUTION:45bb', GENAI).param).toBe('execution')
    })

    it('returns the CANONICAL spelling, so a camelCase parameter survives', () => {
        // The object branches read raw.encodedQuery and raw.artifactId
        // verbatim. Returning the caller's lower-cased spelling would
        // synthesize {encodedquery: ...}, which nothing reads — the repair
        // would silently drop the value.
        const names = ['table', 'query', 'encoded_query', 'encodedQuery']

        expect(kit().splitParamPrefix('encodedquery:active=true', names).param).toBe('encodedQuery')
    })

    it('requires the whole segment to be a parameter name', () => {
        expect(kit().splitParamPrefix('executions:45bb', GENAI)).toBeNull()
        expect(kit().splitParamPrefix('my execution:45bb', GENAI)).toBeNull()
    })

    it('does not match a separator inside a value — the anchoring guard', () => {
        // An encoded query is the realistic hazard: it carries both `=` and
        // `:`, and neither is a parameter prefix.
        const names = ['table', 'query', 'limit']
        const encoded = 'sys_created_on>=javascript:gs.beginningOfToday()'

        expect(kit().splitParamPrefix(encoded, names)).toBeNull()
    })

    it('returns null rather than an empty repair when the value is missing', () => {
        expect(kit().splitParamPrefix('execution:', GENAI)).toBeNull()
        expect(kit().splitParamPrefix('execution:   ', GENAI)).toBeNull()
    })

    it('returns null for a leading separator, an empty string and no names', () => {
        expect(kit().splitParamPrefix(':45bb', GENAI)).toBeNull()
        expect(kit().splitParamPrefix('', GENAI)).toBeNull()
        expect(kit().splitParamPrefix('execution:45bb', [])).toBeNull()
        expect(kit().splitParamPrefix('execution:45bb', null)).toBeNull()
    })

    it('leaves an ordinary bare argument alone', () => {
        expect(kit().splitParamPrefix('llm', GENAI)).toBeNull()
        expect(kit().splitParamPrefix('45bbfd112ba6cf54f243fed2ce91bfcb', GENAI)).toBeNull()
    })
})

// ===========================================================================
// retrievalVerdict (#121) — did this call RETRIEVE anything, or merely run?
//
// DECISION.md §T4 found the depth gate releasing on a `schema_lookup` that
// answered `table_exists: false`, and §U9.1 found the evidence-return
// numerator counting a `genai_log` call that returned `entries: []`. Both
// counted a call by NAME. This is the predicate that makes them count a
// retrieval instead, and it reads the `reads` map the kit already computes:
// R-25 lets only a path that actually fetched rows write 'ok' there.
// ===========================================================================

describe('retrievalVerdict (#121)', () => {
    // No Glide is needed — the method is pure. A bare kit is enough.
    function kit() {
        const ctx = loadScriptInclude('PaToolReadKit.js', { JSON: JSON })
        return new ctx.PaToolReadKit()
    }

    test("'ok' when at least one table in `reads` came back with rows", () => {
        expect(kit().retrievalVerdict({ success: true, data: { reads: { sys_user: 'ok' } } })).toBe('ok')
    })

    test("'ok' when one table among several read ok", () => {
        const result = {
            success: true,
            data: { reads: { sys_db_object: 'empty', sys_dictionary: 'ok', syslog: 'DENIED' } },
        }
        expect(kit().retrievalVerdict(result)).toBe('ok')
    })

    test("'none' when every read came back empty, unknown or denied", () => {
        const result = {
            success: true,
            data: { reads: { sys_db_object: 'empty', syslog: 'DENIED', sys_dictionary: 'unknown' } },
        }
        expect(kit().retrievalVerdict(result)).toBe('none')
    })

    test("'none' for an empty reads map — the tool ran and read nothing at all", () => {
        expect(kit().retrievalVerdict({ success: true, data: { reads: {} } })).toBe('none')
    })

    test("'none' for a failure envelope — an error is a definite statement that nothing came back", () => {
        expect(kit().retrievalVerdict({ success: false, error: 'denied' })).toBe('none')
    })

    test.each([undefined, null, '', 'a string', 42, []])(
        "'unknown' for a non-object result (%p) — cannot tell, which is not the same as none",
        (input) => {
            expect(kit().retrievalVerdict(input)).toBe('unknown')
        }
    )

    test("'unknown' when success is true but there is no data object", () => {
        expect(kit().retrievalVerdict({ success: true })).toBe('unknown')
    })

    test("'unknown' when data carries no reads map — a core that does not use this kit", () => {
        // PaToolReadArtifact's shape. It appears in no layer of
        // _layerToolMap(), so this verdict is never load-bearing for the gate.
        expect(kit().retrievalVerdict({ success: true, data: { content: 'abc', eof: true } })).toBe('unknown')
    })

    test("'unknown' when success is absent — the envelope is not one this predicate can read", () => {
        expect(kit().retrievalVerdict({ data: { reads: { sys_user: 'ok' } } })).toBe('unknown')
    })

    test("'unknown' when reads is an array rather than a map", () => {
        expect(kit().retrievalVerdict({ success: true, data: { reads: ['ok'] } })).toBe('unknown')
    })

    test('an inherited ok on the prototype chain does not count — own properties only', () => {
        const reads = Object.create({ sys_user: 'ok' })
        expect(kit().retrievalVerdict({ success: true, data: { reads: reads } })).toBe('none')
    })

    test('the result object is not mutated', () => {
        const result = { success: true, data: { reads: { sys_user: 'ok' } } }
        const before = JSON.stringify(result)
        kit().retrievalVerdict(result)
        expect(JSON.stringify(result)).toBe(before)
    })

    // -----------------------------------------------------------------------
    // The three regression anchors from DECISION.md, verbatim in shape.
    // -----------------------------------------------------------------------

    test("§T4 row 07: schema_lookup answering table_exists:false is 'none'", () => {
        const result = {
            success: true,
            data: {
                table_exists: false,
                finding: 'table_does_not_exist',
                reads: { sys_db_object: 'empty' },
            },
        }
        expect(kit().retrievalVerdict(result)).toBe('none')
    })

    test("§U9.1 r2-2: genai_log answering entries:[] with llm_call_rows:0 is 'none'", () => {
        const result = {
            success: true,
            data: {
                entries: [],
                llm_call_rows: 0,
                reads: { sys_generative_ai_log: 'empty' },
            },
        }
        expect(kit().retrievalVerdict(result)).toBe('none')
    })

    test("§U9.1 v10-2: genai_log returning llm_call_rows:3 is 'ok'", () => {
        const result = {
            success: true,
            data: {
                llm_call_rows: 3,
                reads: { sys_generative_ai_log: 'ok' },
            },
        }
        expect(kit().retrievalVerdict(result)).toBe('ok')
    })
})
