/**
 * PaToolSchemaLookup — LLD §4.4, diagnostic layer 4.
 *
 * Two behaviours carry this tool, and both are guards against it producing the
 * false diagnosis it exists to prevent:
 *
 *   the inheritance walk — sys_dictionary rows live on the table that DECLARES
 *       a column. Every AIA table extends sys_metadata, so a single-level
 *       lookup reports sys_created_on as ABSENT and hands back a confident
 *       "that field does not exist, your blank is a schema mismatch" about a
 *       perfectly real column.
 *   table_does_not_exist vs no_fields_readable — identical from the caller's
 *       side (an empty field list), opposite fixes (LLD §4.4).
 *
 * What this CANNOT verify (R-8): that any of it is readable from
 * x_snc_troubleshoot.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeQueryingGlideRecordSecure } = require('./_glideStub')

function world(overrides) {
    const base = {
        sys_db_object: [
            // Reference semantics as MEASURED on gpinst01: the raw value is the
            // parent's sys_id and the display is the parent's LABEL - not its
            // name. The first fixture seeded the display with the name, which
            // let a display-based walk pass its tests while dying after one
            // hop on real data (R-8: a stub is not evidence).
            { sys_id: 't1', name: 'sn_aia_agent', label: 'AI Agent', super_class: 't2', super_class__display: 'Application File' },
            { sys_id: 't2', name: 'sys_metadata', label: 'Application File', super_class: '' },
            { sys_id: 't3', name: 'syslog', label: 'Log Entry', super_class: '', caller_access: '2', caller_access__display: 'Caller Restriction' },
        ],
        sys_dictionary: [
            { sys_id: 'd1', name: 'sn_aia_agent', element: 'name', internal_type: 'translated_text', mandatory: 'true', column_label: 'Name' },
            { sys_id: 'd2', name: 'sn_aia_agent', element: 'channel', internal_type: 'choice', choice: '1' },
            { sys_id: 'd3', name: 'sn_aia_agent', element: '', internal_type: 'collection' },
            { sys_id: 'd4', name: 'sys_metadata', element: 'sys_created_on', internal_type: 'glide_date_time' },
        ],
        sys_choice: [
            { sys_id: 'c1', name: 'sn_aia_agent', element: 'channel', value: 'nap', label: 'Now Assist Panel', sequence: '0' },
            { sys_id: 'c2', name: 'sn_aia_agent', element: 'channel', value: 'nap_and_va', label: 'Panel and VA', sequence: '1' },
        ],
    }
    return Object.assign(base, overrides || {})
}

function run(args, tables, options) {
    const GlideRecordSecure = makeQueryingGlideRecordSecure(tables, options)
    const kitCtx = loadScriptInclude('PaToolReadKit.js', { GlideRecordSecure: GlideRecordSecure })
    const ctx = loadScriptInclude('tools/PaToolSchemaLookup.js', {
        GlideRecordSecure: GlideRecordSecure,
        PaToolReadKit: kitCtx.PaToolReadKit,
    })
    return { result: new ctx.PaToolSchemaLookup().execute(args), queries: GlideRecordSecure.calls.queries }
}

describe('argument handling (R-9)', () => {
    it('explains itself when called with no arguments', () => {
        const { result } = run(undefined, world())

        expect(result.success).toBe(true)
        expect(result.data.mode).toBe('no_table')
        expect(result.data.notes.join(' ')).toMatch(/not an error/i)
    })

    it('accepts a bare table name', () => {
        expect(run('sn_aia_agent', world()).result.data.mode).toBe('table')
    })

    it('accepts table.field shorthand', () => {
        const { result } = run('sn_aia_agent.channel', world())

        expect(result.data.mode).toBe('field')
        expect(result.data.field.element).toBe('channel')
    })
})

describe('existence — the distinction LLD 4.4 asks for', () => {
    it('reports a table that is genuinely not there', () => {
        const { result } = run('sn_aia_agnet', world())

        expect(result.data.table_exists).toBe(false)
        const finding = result.data.findings[0]
        expect(finding.finding).toBe('table_does_not_exist')
        expect(finding.why).toMatch(/genuine absence/i)
    })

    it('reports an existing table with no readable columns as a DIFFERENT finding', () => {
        // Same empty field list from the caller's side; opposite fix.
        const { result } = run('sn_aia_agent', world({ sys_dictionary: [] }))

        expect(result.data.table_exists).toBe(true)
        expect(result.data.findings.map((f) => f.finding)).toContain('no_fields_readable')
        expect(result.data.findings.map((f) => f.finding)).not.toContain('table_does_not_exist')
    })

    it('reports existence as unknown when sys_db_object itself is denied', () => {
        const { result } = run('sn_aia_agent', world(), { denied: ['sys_db_object'] })

        expect(result.data.table_exists).toBe('unknown')
        expect(result.data.notes.join(' ')).toMatch(/Unknown, not absent/i)
    })
})

describe('the inheritance walk', () => {
    it('finds a column declared on an ancestor', () => {
        // The whole tool turns on this. A single-level lookup would report
        // sys_created_on as absent and call a real column a schema mismatch.
        const { result } = run({ table: 'sn_aia_agent', field: 'sys_created_on' }, world())

        expect(result.data.field.exists).toBe(true)
        expect(result.data.field.declared_on).toBe('sys_metadata')
        expect(result.data.field.inherited).toBe(true)
    })

    it('marks columns declared on the table itself as not inherited', () => {
        const { result } = run({ table: 'sn_aia_agent', field: 'name' }, world())

        expect(result.data.field.declared_on).toBe('sn_aia_agent')
        expect(result.data.field.inherited).toBe(false)
    })

    it('walks the whole chain and reports it', () => {
        const { result } = run('sn_aia_agent', world())

        expect(result.data.hierarchy.map((h) => h.table)).toEqual(['sn_aia_agent', 'sys_metadata'])
        // The parent is reported by LABEL for the reader; the walk itself must
        // have resolved the real table name above, which only the sys_id can
        // give it - the label matches no sys_db_object.name.
        expect(result.data.hierarchy[0].parent).toBe('Application File')
    })

    it('skips the collection row, which describes the table rather than a column', () => {
        const { result } = run('sn_aia_agent', world())
        // Ordering is the database's job (orderBy 'element'), and the stub
        // does not sort -- so compare as a set. What is being asserted is that
        // the element-less collection row is absent, not the sequence.
        expect(result.data.fields.map((f) => f.element).sort()).toEqual([
            'channel',
            'name',
            'sys_created_on',
        ])
    })

    it('stops rather than looping when the chain cycles', () => {
        const { result } = run(
            'a',
            world({
                sys_db_object: [
                    { sys_id: 'x', name: 'a', super_class: 'y', super_class__display: 'B Label' },
                    { sys_id: 'y', name: 'b', super_class: 'x', super_class__display: 'A Label' },
                ],
                sys_dictionary: [],
            })
        )

        expect(result.success).toBe(true)
        expect(result.data.notes.join(' ')).toMatch(/cycle/i)
    })
})

describe('field detail', () => {
    it('returns choice values for a choice column', () => {
        const { result } = run({ table: 'sn_aia_agent', field: 'channel' }, world())

        expect(result.data.field.choices).toHaveLength(2)
        expect(result.data.field.choices[0].value).toBe('nap')
    })

    it('says so when the choice list was clipped', () => {
        // The reader's next move after asking for choices is "is this value
        // valid?" - and a silently partial list answers no for values that
        // are perfectly valid. Found by sweeping before review rather than in
        // it (R-24 / R-25).
        const many = []
        for (let i = 0; i < 150; i++) {
            many.push({
                sys_id: 'c' + i,
                name: 'sn_aia_agent',
                element: 'channel',
                value: 'v' + i,
                label: 'V ' + i,
                sequence: String(i),
            })
        }

        const { result } = run({ table: 'sn_aia_agent', field: 'channel' }, world({ sys_choice: many }))

        expect(result.data.field.choices_truncated_at).toBe(100)
        expect(result.data.field.choices_note).toMatch(/LOWER BOUND/)
        expect(result.data.field.choices_note).toMatch(/do NOT conclude a value is invalid/)
    })

    it('reports no clipping when the whole choice list fits', () => {
        const { result } = run({ table: 'sn_aia_agent', field: 'channel' }, world())

        expect(result.data.field.choices).toHaveLength(2)
        expect(result.data.field.choices_truncated_at).toBeNull()
    })

    it('reports a missing column as a schema mismatch and suggests near misses', () => {
        const { result } = run({ table: 'sn_aia_agent', field: 'chanel' }, world())

        expect(result.data.field.exists).toBe(false)
        expect(result.data.field.note).toMatch(/BLANK, not an error/)
        expect(result.data.field.similar_columns).toContain('channel')
        expect(result.data.findings.map((f) => f.finding)).toContain('field_does_not_exist')
    })
})

describe('caller_access — the cross-scope fact', () => {
    it('spells out what a caller restriction means for a denied read', () => {
        const { result } = run('syslog', world())

        // caller_access=2 is why syslog is denied from this scope, and why the
        // app's own CrossScopePrivilege does not help (R-19).
        expect(result.data.table.caller_access_meaning).toMatch(/RESTRICTED/)
        expect(result.data.table.caller_access_meaning).toMatch(/does not lift it|instance-admin/)
    })

    it('says so plainly when a table carries no restriction', () => {
        const { result } = run('sn_aia_agent', world())
        expect(result.data.table.caller_access_meaning).toMatch(/unrestricted/)
    })
})
