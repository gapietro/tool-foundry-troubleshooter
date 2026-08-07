/**
 * PaToolLogAnalysis — LLD §4.4, the layer that is blocked at the data source.
 *
 * Two things are being guarded here, and neither is "does it read logs":
 *
 *   the mandatory scoping — an unfiltered syslog read can slow or time out an
 *       instance (K26 guidebook), so an insufficiently scoped query is refused
 *       BEFORE it reaches the database, on any instance, permitted or not.
 *   the explicit degradation — syslog is DENIED from this scope
 *       (caller_access = Caller Restriction, measured twice, R-12/R-19) and the
 *       app's own CrossScopePrivilege installs correctly and does nothing. The
 *       tool ships anyway so the gap is VISIBLE: an agent with no log tool
 *       cannot tell you the log layer was skipped.
 *
 * The read is ATTEMPTED rather than assumed — hard-coding the denial would mean
 * the tool never starts working if an admin lifts the restriction.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeQueryingGlideRecordSecure } = require('./_glideStub')

const PLAN = 'c9d63a932bda8b9417a6ffbeee91bfd0'

function world(overrides) {
    const base = {
        syslog: [],
        sn_aia_execution_plan: [],
    }
    return Object.assign(base, overrides || {})
}

function run(args, tables, options) {
    const GlideRecordSecure = makeQueryingGlideRecordSecure(tables, options)
    const kitCtx = loadScriptInclude('PaToolReadKit.js', { GlideRecordSecure: GlideRecordSecure })

    function GlideDateTime(value) {
        this._v = value || '2026-08-01 12:00:00'
        this.addSeconds = function () {}
        this.toString = function () {
            return this._v
        }
    }

    const ctx = loadScriptInclude('tools/PaToolLogAnalysis.js', {
        GlideRecordSecure: GlideRecordSecure,
        GlideDateTime: GlideDateTime,
        PaToolReadKit: kitCtx.PaToolReadKit,
    })
    return { result: new ctx.PaToolLogAnalysis().execute(args), queries: GlideRecordSecure.calls.queries }
}

describe('mandatory scoping', () => {
    it('refuses a query with no filter at all, naming what is missing', () => {
        const { result, queries } = run(undefined, world())

        expect(result.success).toBe(true)
        expect(result.data.status).toBe('refused_unscoped')
        expect(result.data.missing_conditions.join(' ')).toMatch(/source-contains or message-contains/)
        // Refused BEFORE the database, not after a failed read.
        expect(queries.some((q) => q.table === 'syslog')).toBe(false)
    })

    it('refuses even when a window was supplied, because a window alone is not enough', () => {
        const { result } = run({ minutes_ago: 30 }, world())

        expect(result.data.status).toBe('refused_unscoped')
        expect(result.data.how_to_scope).toMatch(/execution=|source=|message=/)
    })

    it('accepts a source filter', () => {
        const { result, queries } = run({ source: 'x_snc_troubleshoot' }, world())

        expect(result.data.status).not.toBe('refused_unscoped')
        const q = queries.find((x) => x.table === 'syslog')
        expect(q.filters.some((f) => f.field === 'source' && f.op === 'LIKE')).toBe(true)
    })

    it('bounds every accepted query with a time window and a level filter', () => {
        const { queries } = run({ message: 'Unterminated' }, world())
        const q = queries.find((x) => x.table === 'syslog')
        const fields = q.filters.map((f) => f.field)

        expect(fields).toContain('sys_created_on')
        expect(fields).toContain('level')
    })

    it('filters on the stored choice values, not the labels', () => {
        // syslog.level holds Warning=1, Error=2, Fatal=3 (sys_choice, measured
        // on gpinst01). A filter built from the labels matches nothing, ever -
        // an empty log layer over logs that exist, on the one instance where
        // the read is actually permitted.
        const { result, queries } = run({ message: 'boom' }, world())
        const q = queries.find((x) => x.table === 'syslog')
        const levelFilter = q.filters.find((f) => f.field === 'level')

        expect(levelFilter.op).toBe('IN')
        expect(String(levelFilter.value)).toBe('1,2,3')
        expect(result.data.scope.levels_meaning).toMatch(/stored choice values/)
    })

    it('maps a label the caller passes to its stored value', () => {
        const { queries } = run({ message: 'boom', level: 'Error' }, world())
        const q = queries.find((x) => x.table === 'syslog')

        expect(String(q.filters.find((f) => f.field === 'level').value)).toBe('2')
    })

    it('passes a stored value or unknown level through unchanged', () => {
        const { queries } = run({ message: 'boom', level: '3' }, world())
        const q = queries.find((x) => x.table === 'syslog')

        expect(String(q.filters.find((f) => f.field === 'level').value)).toBe('3')
    })

    it('warns when an unmapped level label would match nothing', () => {
        // The warning existed from the start and was DEAD CODE: normalisation
        // ran during argument parsing, before the data envelope existed, so
        // the note had nowhere to land. An unknown label then flowed into the
        // IN filter, matched no rows, and returned a clean `empty`
        // indistinguishable from a genuinely quiet log layer.
        const { result, queries } = run({ message: 'boom', level: 'Sev1' }, world())
        const q = queries.find((x) => x.table === 'syslog')

        expect(String(q.filters.find((f) => f.field === 'level').value)).toBe('Sev1')
        expect(result.data.notes.join(' ')).toMatch(/not one of the measured syslog level labels/)
        expect(result.data.notes.join(' ')).toMatch(/will match nothing/)
    })

    it('does not warn for a mapped label or a numeric value', () => {
        const a = run({ message: 'boom', level: 'Error' }, world())
        const b = run({ message: 'boom', level: '3' }, world())

        expect(a.result.data.notes.join(' ')).not.toMatch(/will match nothing/)
        expect(b.result.data.notes.join(' ')).not.toMatch(/will match nothing/)
    })

    it('clamps an oversized window', () => {
        const { result } = run({ source: 'x_snc', minutes_ago: 99999 }, world())

        expect(result.data.scope.window.minutes_ago).toBe(1440)
        expect(result.data.scope.window.clamped).toBe(true)
    })

    it('treats a bare sys_id as an execution, which scopes the query on its own', () => {
        const { result } = run(PLAN, world())

        expect(result.data.status).not.toBe('refused_unscoped')
        expect(result.data.scope.message_contains).toBe(PLAN)
    })
})

describe('execution-derived scope', () => {
    it('takes the window from the plan start and end, padded either side', () => {
        const { result } = run(
            { execution: PLAN },
            world({
                sn_aia_execution_plan: [
                    {
                        sys_id: PLAN,
                        sys_created_on: '2026-08-01 09:00:00',
                        sys_updated_on: '2026-08-01 09:04:00',
                        state: 'terminated',
                    },
                ],
            })
        )

        expect(result.data.scope.derived_from_execution).toBe(true)
        expect(result.data.scope.window.basis).toMatch(/padded by 120 seconds/)
        expect(result.data.scope.message_contains).toBe(PLAN)
    })

    it('falls back to minutes_ago when the plan cannot be read, and still filters on the sys_id', () => {
        const { result } = run({ execution: PLAN }, world())

        expect(result.data.scope.derived_from_execution).toBe(false)
        expect(result.data.scope.message_contains).toBe(PLAN)
        expect(result.data.notes.join(' ')).toMatch(/Falling back to minutes_ago/)
    })
})

describe('the R-19 degradation', () => {
    it('reports the denial as an unavailable layer, not as a clean one', () => {
        const { result } = run({ source: 'x_snc_troubleshoot' }, world(), { denied: ['syslog'] })

        expect(result.data.status).toBe('unavailable')
        expect(result.data.entries).toEqual([])
        // The distinction the whole tool exists for: "no log entries matched"
        // and "the log layer was not swept" are different diagnoses.
        expect(result.data.evidence_basis.statement).toMatch(/NOT an absence of log entries/)
        expect(result.data.notes.join(' ')).toMatch(/NOT swept/)
    })

    it('names the cause, what was already tried, and whose action is required', () => {
        const { result } = run({ source: 'x_snc_troubleshoot' }, world(), { denied: ['syslog'] })
        const a = result.data.availability

        expect(a.cause).toMatch(/caller_access = Caller Restriction/)
        // Re-attempting the grant has been measured twice as useless; the
        // output has to say so or the next session tries it again.
        expect(a.already_tried).toMatch(/DOES install correctly/)
        expect(a.already_tried).toMatch(/cannot grant itself/)
        expect(a.required_action).toMatch(/instance administrator/)
        expect(a.required_action).toMatch(/CUSTOMER-SIDE PREREQUISITE/)
    })

    it('points at the nearest available substitute rather than leaving a hole', () => {
        const { result } = run({ source: 'x_snc' }, world(), { denied: ['syslog'] })

        expect(result.data.availability.what_this_means_for_the_diagnosis).toMatch(/agent_trace/)
    })

    it('actually attempts the read rather than assuming the denial', () => {
        // If an admin lifts the restriction the tool must start working with no
        // code change. A hard-coded denial would also misreport an instance
        // where syslog was never restricted.
        const { result, queries } = run(
            { source: 'x_snc_troubleshoot' },
            world({
                syslog: [
                    {
                        sys_id: 'l1',
                        sys_created_on: '2026-08-01 12:30:00',
                        // The STORED value, as measured: Error=2. A fixture
                        // holding the label here is what let the label-based
                        // filter pass its tests while matching nothing real.
                        level: '2',
                        level__display: 'Error',
                        source: 'x_snc_troubleshoot.PaToolAgentTrace',
                        message: 'SyntaxError: Unterminated string constant',
                    },
                ],
            })
        )

        expect(queries.some((q) => q.table === 'syslog')).toBe(true)
        expect(result.data.status).toBe('ok')
        expect(result.data.entries[0].message).toMatch(/Unterminated string constant/)
        expect(result.data.availability).toBeUndefined()
    })

    it('distinguishes a readable-but-empty log from an unavailable one', () => {
        const { result } = run({ source: 'nothing_matches_this' }, world())

        expect(result.data.status).toBe('empty')
        expect(result.data.availability).toBeUndefined()
    })
})

describe('argument prefix guard (#122)', () => {
    const PREFIXED = `execution:${PLAN}`

    it('reads execution:<sys_id> as the execution, not as a message substring', () => {
        const { result } = run(PREFIXED, world({ sn_aia_execution_plan: [] }))

        expect(result.data.requested.execution).toBe(PLAN)
        expect(result.data.requested.message).toBeFalsy()
    })

    it('routes source:<name> to the source slot, not to message', () => {
        const { result } = run('source:MyScriptInclude', world())

        expect(result.data.requested.source).toBe('MyScriptInclude')
        expect(result.data.requested.message).toBeFalsy()
    })

    it('says so loudly', () => {
        const { result } = run(PREFIXED, world())

        expect(result.data.notes.join(' ')).toContain(PREFIXED)
    })

    it('leaves an unprefixed message alone', () => {
        const { result } = run('disk full', world())

        expect(result.data.requested.message).toBe('disk full')
    })
})
