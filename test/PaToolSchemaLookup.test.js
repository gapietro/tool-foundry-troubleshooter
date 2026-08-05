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
            { sys_id: 'd5', name: 'sys_metadata', element: 'lifecycle', internal_type: 'choice', choice: '1' },
        ],
        sys_choice: [
            { sys_id: 'c1', name: 'sn_aia_agent', element: 'channel', value: 'nap', label: 'Now Assist Panel', sequence: '0' },
            { sys_id: 'c2', name: 'sn_aia_agent', element: 'channel', value: 'nap_and_va', label: 'Panel and VA', sequence: '1' },
            // Choices for an INHERITED column live under the DECLARING table -
            // the same ownership rule as sys_dictionary itself.
            { sys_id: 'c3', name: 'sys_metadata', element: 'lifecycle', value: 'draft', label: 'Draft', sequence: '0' },
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

/**
 * Issue #111, measured live in the v6 smoke: two of six runs called this tool
 * with `table:incident` — the PARAMETER NAME prefixed onto the value. Root
 * cause is the contract's `table.field` shorthand, whose notation cannot tell
 * a model that `table` is a placeholder rather than literal text (fixed in
 * PaToolRegistry + agent-doctor.now.ts).
 *
 * These two behaviours are the tool-side guard, and the SECOND one is the one
 * that matters: an unparseable name previously produced a confident
 * `table_does_not_exist`, which is a claim about the INSTANCE. A model that
 * reasons from it concludes the table is missing and files a plausible,
 * fully-audited, wrong root cause. A malformed name must never be able to say
 * anything about what exists.
 */
describe('malformed table names (#111)', () => {
    it('strips a parameter-name prefix and finds the real table', () => {
        const { result } = run('table:sn_aia_agent', world())

        expect(result.data.mode).toBe('table')
        expect(result.data.table_exists).toBe(true)
        expect(result.data.requested.table).toBe('sn_aia_agent')
    })

    it('records the repair rather than silently erasing it', () => {
        // The issue is explicit: normalise LOUDLY. A silent strip would make
        // the two measured calls work and destroy the evidence that the model
        // is malforming arguments at all.
        const { result } = run('table:sn_aia_agent', world())

        expect(result.data.notes.join(' ')).toMatch(/table:sn_aia_agent/)
        expect(result.data.notes.join(' ')).toMatch(/parameter name/i)
    })

    it('accepts the = form as well as the : form', () => {
        // The tool's own no-table note tells the model `table=<name>`, so the
        // `=` spelling is one this contract actively invites.
        expect(run('table=sn_aia_agent', world()).result.data.requested.table).toBe('sn_aia_agent')
    })

    /**
     * Issue #114. The A/B experiment for #111 showed the pre-fix contract
     * eliciting `table.sn_aia_tool.u_routing_key` — the placeholder word
     * `table` prefixed with the shorthand's OWN `.` delimiter. #111's guard
     * only stripped `:` and `=`, so this went through as
     * {table:'table', field:'sn_aia_tool'} and produced exactly the confident
     * table_does_not_exist that #111 existed to prevent.
     *
     * `.` cannot join `:` and `=` in the character class, because
     * `incident.priority` is the legitimate shorthand. The discriminator is
     * segment count: `table.<x>.<y>` cannot be a two-part shorthand.
     */
    it('strips a DOT-delimited parameter prefix when a third segment proves it is one', () => {
        const { result } = run('table.sn_aia_agent.channel', world())

        expect(result.data.requested.table).toBe('sn_aia_agent')
        expect(result.data.requested.field).toBe('channel')
        expect(result.data.findings.map((f) => f.finding)).not.toContain('table_does_not_exist')
    })

    it('records the dot-delimited repair too', () => {
        const { result } = run('table.sn_aia_agent.channel', world())

        expect(result.data.notes.join(' ')).toMatch(/table\.sn_aia_agent\.channel/)
        expect(result.data.notes.join(' ')).toMatch(/parameter name/i)
    })

    it('leaves the two-segment shorthand alone, because it is ambiguous', () => {
        // `table.channel` could be a real table called `table` — nothing here
        // proves otherwise, so the honest reading is the shorthand's.
        expect(run('table.channel', world()).result.data.requested.table).toBe('table')
    })

    it('does not mistake a legitimate shorthand for a prefix', () => {
        const { result } = run('sn_aia_agent.channel', world())

        expect(result.data.requested.table).toBe('sn_aia_agent')
        expect(result.data.notes.join(' ')).not.toMatch(/parameter name/i)
    })

    it('does NOT report a still-malformed name as table_does_not_exist', () => {
        const { result } = run('not a table name!', world())

        const findings = result.data.findings.map((f) => f.finding)
        expect(findings).not.toContain('table_does_not_exist')
        expect(findings).toContain('table_name_malformed')
    })

    it('says the malformed name settles nothing about what exists', () => {
        const { result } = run('not a table name!', world())

        const finding = result.data.findings[0]
        expect(finding.why).toMatch(/not a well-formed table name/i)
        expect(finding.why).toMatch(/says nothing about whether/i)
    })

    it('still reports a well-formed name that is genuinely absent as absent', () => {
        // The guard must not swallow the real finding it sits next to.
        const { result } = run('sn_aia_agnet', world())

        expect(result.data.findings.map((f) => f.finding)).toContain('table_does_not_exist')
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
            'lifecycle',
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

    it('finds choices declared on an ancestor rather than telling the reader to look', () => {
        // The old lookup queried sys_choice only under the caller's table and
        // then emitted a note telling the READER to re-check the declaring
        // table - with declared_on already in hand. The tool now does that
        // join itself.
        const { result } = run({ table: 'sn_aia_agent', field: 'lifecycle' }, world())

        expect(result.data.field.inherited).toBe(true)
        expect(result.data.field.declared_on).toBe('sys_metadata')
        expect(result.data.field.choices).toHaveLength(1)
        expect(result.data.field.choices[0].defined_on).toBe('sys_metadata')
        expect(result.data.field.choice_note).toBeNull()
        expect(result.data.field.choice_tables_queried).toEqual(['sn_aia_agent', 'sys_metadata'])
    })

    it('reports a missing column as a schema mismatch and suggests near misses', () => {
        const { result } = run({ table: 'sn_aia_agent', field: 'chanel' }, world())

        expect(result.data.field.exists).toBe(false)
        expect(result.data.field.note).toMatch(/BLANK, not an error/)
        expect(result.data.field.similar_columns).toContain('channel')
        expect(result.data.findings.map((f) => f.finding)).toContain('field_does_not_exist')
    })
})

describe('absence is earned by a complete walk (round 3)', () => {
    it('answers UNKNOWN, not false, when the dictionary could not be read', () => {
        // A denied dictionary yields zero columns; `exists: false` over that
        // is the empty-result overconfidence this tool exists to prevent -
        // QueryTable's verdict got the same guard one round earlier.
        const { result } = run({ table: 'sn_aia_agent', field: 'sys_created_on' }, world(), {
            denied: ['sys_dictionary'],
        })

        expect(result.data.field.exists).toBe('unknown')
        expect(result.data.field.note).toMatch(/UNKNOWN/)
        expect(result.data.field.note).toMatch(/must not be\s+treated as a schema mismatch/)
        const findings = result.data.findings.map((f) => f.finding)
        expect(findings).toContain('field_existence_unknown')
        expect(findings).not.toContain('field_does_not_exist')
    })

    it('answers UNKNOWN when the ancestor walk was incomplete', () => {
        // sys_db_object denied: the walk covers one level at best, so "not
        // declared on ANY ancestor" is a claim about tables never read.
        const { result } = run({ table: 'sn_aia_agent', field: 'nonexistent_col' }, world(), {
            denied: ['sys_db_object'],
        })

        expect(result.data.field.exists).toBe('unknown')
        expect(result.data.findings.map((f) => f.finding)).not.toContain('field_does_not_exist')
    })

    it('answers UNKNOWN when the column list was clipped before the ancestors', () => {
        // 300+ columns on the base table hit the in-memory cap before
        // sys_metadata is ever scanned, so an ancestor's column is simply not
        // in the merged list. Round 3's guard checked the WALK and not the
        // LIST, so exists: false still claimed a "complete chain" over
        // ancestors that were never merged.
        const wide = []
        for (let i = 0; i < 305; i++) {
            wide.push({ sys_id: 'w' + i, name: 'sn_aia_agent', element: 'col_' + i, internal_type: 'string' })
        }

        const { result } = run(
            { table: 'sn_aia_agent', field: 'sys_created_on' },
            world({ sys_dictionary: wide.concat([{ sys_id: 'd4', name: 'sys_metadata', element: 'sys_created_on', internal_type: 'glide_date_time' }]) })
        )

        expect(result.data.field.exists).toBe('unknown')
        expect(result.data.field.note).toMatch(/clipped at 300/)
        expect(result.data.findings.map((f) => f.finding)).not.toContain('field_does_not_exist')
    })

    it('answers UNKNOWN when the walk stopped on a cycle', () => {
        // A cycle ends the walk with every visited level reading `ok`, so a
        // completeness check derived from per-level statuses called the walk
        // complete — and exists: false claimed ancestors beyond the cycle
        // point. The walk now reports its own verdict.
        const { result } = run(
            { table: 'a', field: 'some_col' },
            world({
                sys_db_object: [
                    { sys_id: 'x', name: 'a', super_class: 'y', super_class__display: 'B Label' },
                    { sys_id: 'y', name: 'b', super_class: 'x', super_class__display: 'A Label' },
                ],
                sys_dictionary: [{ sys_id: 'da', name: 'a', element: 'other_col', internal_type: 'string' }],
            })
        )

        expect(result.data.hierarchy_complete).toBe(false)
        expect(result.data.hierarchy_incomplete_reason).toMatch(/cycle/)
        expect(result.data.field.exists).toBe('unknown')
        expect(result.data.findings.map((f) => f.finding)).not.toContain('field_does_not_exist')
    })

    it('answers UNKNOWN when the depth ceiling ended the walk with a parent unresolved', () => {
        // MAX_DEPTH+2 tables chained: every visited level reads ok, but the
        // deepest still points at a parent that was never scanned.
        const tables = []
        const dict = []
        for (let i = 0; i < 18; i++) {
            tables.push({
                sys_id: 't' + i,
                name: 'tbl_' + i,
                super_class: i < 17 ? 't' + (i + 1) : '',
                super_class__display: i < 17 ? 'Label ' + (i + 1) : '',
            })
            dict.push({ sys_id: 'dd' + i, name: 'tbl_' + i, element: 'col_' + i, internal_type: 'string' })
        }

        const { result } = run(
            { table: 'tbl_0', field: 'col_17' },
            world({ sys_db_object: tables, sys_dictionary: dict })
        )

        expect(result.data.hierarchy_complete).toBe(false)
        expect(result.data.hierarchy_incomplete_reason).toMatch(/depth ceiling/)
        expect(result.data.field.exists).toBe('unknown')
    })

    it('does not call an exactly-full column list clipped', () => {
        // The accumulator's own limit+1: exactly MAX_FIELDS columns, all
        // consumed, is a COMPLETE list. Marking it clipped pushed a genuinely
        // missing field to unknown and table mode to a false ceiling — the
        // mirror direction of every other finding in this cycle.
        const exact = []
        for (let i = 0; i < 299; i++) {
            exact.push({ sys_id: 'e' + i, name: 'sn_aia_agent', element: 'ecol_' + i, internal_type: 'string' })
        }
        // 299 on the base + 1 inherited = exactly 300 across the chain.
        exact.push({ sys_id: 'em', name: 'sys_metadata', element: 'sys_created_on', internal_type: 'glide_date_time' })

        const fieldMode = run({ table: 'sn_aia_agent', field: 'genuinely_absent' }, world({ sys_dictionary: exact }))
        const tableMode = run('sn_aia_agent', world({ sys_dictionary: exact }))

        expect(fieldMode.result.data.field_count).toBe(300)
        expect(fieldMode.result.data.field.exists).toBe(false)
        expect(fieldMode.result.data.findings.map((f) => f.finding)).toContain('field_does_not_exist')
        // Table mode reports no ceiling either - truncated_at is its field.
        expect(tableMode.result.data.truncated_at).toBeNull()
    })

    it('answers UNKNOWN when an ancestor level contributed no dictionary rows', () => {
        // The base level reads fine, sys_metadata's dictionary read comes back
        // empty - so the merged list is non-empty, the walk verdict complete,
        // no clip flag, and round 7 found exists: false claiming a column on
        // exactly the level that contributed nothing. Every real table has at
        // least its collection row, so an empty level is row-filtering or a
        // wrong name, never a table without columns.
        const { result } = run(
            { table: 'sn_aia_agent', field: 'sys_created_on' },
            world({
                sys_dictionary: [
                    { sys_id: 'd1', name: 'sn_aia_agent', element: 'name', internal_type: 'translated_text' },
                ],
            })
        )

        expect(result.data.field.exists).toBe('unknown')
        expect(result.data.field.note).toMatch(/sys_metadata \(empty\)/)
        expect(result.data.field.note).toMatch(/never merged/)
        expect(result.data.findings.map((f) => f.finding)).not.toContain('field_does_not_exist')
    })

    it('table mode states which levels contributed nothing', () => {
        const { result } = run(
            'sn_aia_agent',
            world({
                sys_dictionary: [
                    { sys_id: 'd1', name: 'sn_aia_agent', element: 'name', internal_type: 'translated_text' },
                ],
            })
        )

        expect(result.data.levels_not_read).toEqual([{ table: 'sys_metadata', status: 'empty' }])
        expect(result.data.notes.join(' ')).toMatch(/may be declared there/)
    })

    it('still answers false over a complete walk with rows read', () => {
        const { result } = run({ table: 'sn_aia_agent', field: 'chanel' }, world())

        expect(result.data.field.exists).toBe(false)
        expect(result.data.field.note).toMatch(/complete chain/)
        expect(result.data.findings.map((f) => f.finding)).toContain('field_does_not_exist')
    })

    it('reports a denied choice read as unavailable, never as verified absence', () => {
        const { result } = run({ table: 'sn_aia_agent', field: 'channel' }, world(), {
            denied: ['sys_choice'],
        })

        expect(result.data.field.choices).toEqual([])
        expect(result.data.field.choice_read_status).toBe('DENIED')
        expect(result.data.field.choice_note).toMatch(/UNAVAILABLE/)
        expect(result.data.field.choice_note).toMatch(/permission gap/)
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
