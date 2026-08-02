/**
 * PaToolQueryTable — LLD §4.4, diagnostic layer 5.
 *
 * The behaviour these tests exist for is the empty-result disambiguation. An
 * empty GlideRecordSecure read has two completely different causes with
 * opposite fixes:
 *
 *   the rows are not there            -> a DATA defect, fix by seeding
 *   the rows are there, unreadable    -> an ACCESS defect, fix with an ACL
 *
 * Without the unfiltered count, a missing read ACL is indistinguishable from an
 * empty table BY THE TOOL MEANT TO FIND IT — which is exactly what the
 * benchmark's data seed is built to catch. The count is bounded deliberately:
 * only on an empty secure result, and only ever a count.
 *
 * What this CANNOT verify (R-8): real ACL behaviour, or that GlideAggregate is
 * reachable from x_snc_troubleshoot.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeQueryingGlideRecordSecure } = require('./_glideStub')

function world(overrides) {
    const base = {
        sys_db_object: [{ sys_id: 't1', name: 'x_snc_tsbench_rule', label: 'Routing Rule' }],
        sys_dictionary: [
            { sys_id: 'd1', name: 'x_snc_tsbench_rule', element: 'name', display: 'true' },
            { sys_id: 'd2', name: 'x_snc_tsbench_rule', element: 'active' },
            { sys_id: 'd3', name: 'x_snc_tsbench_rule', element: '' },
        ],
        x_snc_tsbench_rule: [],
    }
    return Object.assign(base, overrides || {})
}

/**
 * @param {Number|null} aggregateCount  what the unfiltered COUNT returns; null
 *        makes GlideAggregate throw, as an unavailable API would.
 */
function run(args, tables, options, aggregateCount) {
    const GlideRecordSecure = makeQueryingGlideRecordSecure(tables, options)
    const kitCtx = loadScriptInclude('PaToolReadKit.js', { GlideRecordSecure: GlideRecordSecure })

    function GlideAggregate() {
        if (aggregateCount === null || aggregateCount === undefined) throw new Error('unavailable')
        this._done = false
    }
    GlideAggregate.prototype.addEncodedQuery = function () {}
    GlideAggregate.prototype.addAggregate = function () {}
    GlideAggregate.prototype.query = function () {}
    GlideAggregate.prototype.next = function () {
        if (this._done) return false
        this._done = true
        return true
    }
    GlideAggregate.prototype.getAggregate = function () {
        return String(aggregateCount)
    }

    const ctx = loadScriptInclude('tools/PaToolQueryTable.js', {
        GlideRecordSecure: GlideRecordSecure,
        GlideAggregate: GlideAggregate,
        PaToolReadKit: kitCtx.PaToolReadKit,
    })
    return { result: new ctx.PaToolQueryTable().execute(args), queries: GlideRecordSecure.calls.queries }
}

describe('argument handling (R-9)', () => {
    it('says what to supply when called with no arguments', () => {
        const { result } = run(undefined, world())

        expect(result.success).toBe(true)
        expect(result.data.status).toBe('no_table')
        expect(result.data.notes.join(' ')).toMatch(/not an error/i)
    })

    it('accepts a bare table name', () => {
        expect(run('x_snc_tsbench_rule', world(), null, 0).result.data.requested.table).toBe(
            'x_snc_tsbench_rule'
        )
    })

    it('accepts fields as a comma-separated string as well as an array', () => {
        const a = run({ table: 'x_snc_tsbench_rule', fields: 'name,active' }, world(), null, 0)
        const b = run({ table: 'x_snc_tsbench_rule', fields: ['name', 'active'] }, world(), null, 0)

        expect(a.result.data.fields_returned).toEqual(b.result.data.fields_returned)
        // sys_id is added whether or not it was asked for — a row you cannot
        // address again is not much use in a diagnosis.
        expect(a.result.data.fields_returned).toContain('sys_id')
    })

    it('clamps the limit and says so', () => {
        const { result } = run({ table: 'x_snc_tsbench_rule', limit: 5000 }, world(), null, 0)

        expect(result.data.limit_applied).toBe(100)
        expect(result.data.notes.join(' ')).toMatch(/clamped/i)
    })

    it('chooses a bounded field list when none is given, and states that it did', () => {
        const { result } = run('x_snc_tsbench_rule', world(), null, 0)

        expect(result.data.fields_returned).toContain('sys_id')
        expect(result.data.fields_returned).toContain('name')
        expect(result.data.notes.join(' ')).toMatch(/SAMPLE of the record/)
    })
})

describe('table validation', () => {
    it('reports a table that does not exist rather than returning nothing', () => {
        const { result } = run('x_snc_tsbench_rules', world(), null, 0)

        expect(result.data.status).toBe('table_does_not_exist')
        expect(result.data.findings[0].why).toMatch(/does not error/i)
    })
})

describe('the empty-result disambiguation', () => {
    it('calls an empty table empty when the unfiltered count agrees', () => {
        const { result } = run('x_snc_tsbench_rule', world(), null, 0)

        expect(result.data.status).toBe('empty')
        expect(result.data.empty_result.verdict).toBe('genuinely_empty')
        expect(result.data.empty_result.detail).toMatch(/DATA finding/)
    })

    it('identifies an ACL-filtered result when rows exist but none are visible', () => {
        const { result } = run('x_snc_tsbench_rule', world(), null, 7)

        expect(result.data.empty_result.verdict).toBe('acl_filtered')
        expect(result.data.empty_result.unfiltered_row_count).toBe(7)

        const finding = result.data.findings.find((f) => f.finding === 'rows_exist_but_are_not_visible')
        expect(finding).toBeDefined()
        // Build Rule #42: a Fluent Table() installs with zero ACLs, and the
        // server-side writer keeps working, so the gap is invisible from the
        // code that populates the table.
        expect(finding.next_step).toMatch(/ZERO ACLs/)
    })

    it('returns a count and never row content from the unfiltered read', () => {
        const { result } = run('x_snc_tsbench_rule', world(), null, 7)
        const rendered = JSON.stringify(result.data.empty_result)

        expect(result.data.empty_result.unfiltered_row_count).toBe(7)
        // The bypass is bounded to a number. Anything else would make this a
        // "read any table regardless of ACLs" primitive, and it is LLM-callable.
        expect(rendered).not.toContain('sys_id')
        expect(result.data.rows).toEqual([])
    })

    it('does not claim the table name was confirmed when it never was', () => {
        // sys_db_object denied + zero unfiltered count: an empty table and a
        // typo'd name produce this identical shape, and the old verdict said
        // "the table name is confirmed above, so this is not a lookup mistake"
        // - a high-confidence DATA finding the tool never established, directly
        // contradicting the earlier validation note.
        const { result } = run('x_snc_tsbench_rule', world(), { denied: ['sys_db_object'] }, 0)

        expect(result.data.table_exists).toBe('unknown')
        expect(result.data.empty_result.verdict).toBe('unknown')
        expect(result.data.empty_result.detail).toMatch(/NEVER CONFIRMED/)
        expect(result.data.empty_result.detail).not.toMatch(/not a lookup mistake/)
    })

    it('still claims genuinely_empty when the table WAS confirmed', () => {
        const { result } = run('x_snc_tsbench_rule', world(), null, 0)

        expect(result.data.empty_result.verdict).toBe('genuinely_empty')
        expect(result.data.empty_result.table_confirmed).toBe(true)
    })

    it('says unknown rather than guessing when the count cannot be taken', () => {
        const { result } = run('x_snc_tsbench_rule', world(), null, null)

        expect(result.data.empty_result.verdict).toBe('unknown')
        expect(result.data.empty_result.detail).toMatch(/Do not read this empty result as proof/)
    })

    it('does not take the count at all when rows came back', () => {
        const { result } = run(
            'x_snc_tsbench_rule',
            world({ x_snc_tsbench_rule: [{ sys_id: 'r1', name: 'Rule A', active: 'true' }] }),
            null,
            99
        )

        expect(result.data.status).toBe('ok')
        expect(result.data.empty_result).toBeUndefined()
    })
})

describe('reads', () => {
    it('returns the requested fields', () => {
        const { result } = run(
            { table: 'x_snc_tsbench_rule', fields: 'name,active' },
            world({ x_snc_tsbench_rule: [{ sys_id: 'r1', name: 'Rule A', active: 'true' }] }),
            null,
            1
        )

        expect(result.data.rows[0].name).toBe('Rule A')
        expect(result.data.row_count).toBe(1)
    })

    it('reports a denied read as a privilege gap, not as missing data', () => {
        const { result } = run('x_snc_tsbench_rule', world(), { denied: ['x_snc_tsbench_rule'] }, 0)

        expect(result.data.status).toBe('denied')
        expect(result.data.notes.join(' ')).toMatch(/says\s+NOTHING about whether the rows exist/)
        // A denial must not be run through the empty-vs-filtered logic; there
        // was no result to disambiguate.
        expect(result.data.empty_result).toBeUndefined()
    })

    it('digests oversized values rather than returning them whole', () => {
        const { result } = run(
            { table: 'x_snc_tsbench_rule', fields: 'name' },
            world({ x_snc_tsbench_rule: [{ sys_id: 'r1', name: 'x'.repeat(3000) }] }),
            null,
            1
        )

        expect(result.data.rows[0].name).toContain('more chars]')
    })
})
