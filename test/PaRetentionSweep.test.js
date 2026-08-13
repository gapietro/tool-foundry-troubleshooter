/**
 * PaRetentionSweep — the data-at-rest lifecycle (issue #216).
 *
 * WHAT THIS EXISTS FOR
 * `PaToolQueryTable` returns rows from arbitrary customer tables and
 * `PaArtifactStore` persists the oversized ones as attachments on the run
 * record. Before this class, a grep for `retention|purge|ttl|expire` across
 * `src/server/` and `src/fluent/` returned nothing: the only scheduled jobs
 * were the run-start worker and the stale-run sweep, and the latter changes a
 * status without deleting anything. Customer data accumulated in the instance
 * forever. The marketing claim that "no customer data ever leaves the platform"
 * is about EGRESS and stays true — retention is a separate obligation, and it
 * was absent.
 *
 * WHY THE SWEEP DRIVES OFF ATTACHMENTS RATHER THAN RUNS
 * The obvious shape — walk old runs, delete their attachments — has a bug that
 * only shows up after it has been running for a while. Runs whose attachments
 * are already gone stay old forever, so with any per-pass cap and an
 * oldest-first order the sweep spends every night re-examining the same
 * already-clean runs and never reaches the newer ones that still hold data.
 * Driving off `sys_attachment` directly has none of that: the work set shrinks
 * as it purges, there is no run-table scan, and no "already purged" marker
 * column is needed (which would have meant a schema change, unverifiable
 * without an install).
 *
 * THE DESTRUCTIVE DIRECTION IS THE DANGEROUS ONE
 * Hence the asymmetry asserted below: an ABSENT property falls back to the
 * documented 30-day default, while a PRESENT BUT UNPARSEABLE one disables the
 * sweep entirely. "Not configured yet" and "configured wrong" are different
 * facts, and only the first has a safe default. A job that deletes on a typo is
 * not a job anyone should install on a customer instance.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeWritableWorld } = require('./_glideStub')

const RUN_TABLE = 'x_snc_troubleshoot_run'
const ATTACHMENTS = 'sys_attachment'
const PROPERTY = 'x_snc_troubleshoot.retention_days'

/** Fixed clock — every cutoff below is relative to this. */
const NOW = new Date('2026-08-12T12:00:00Z')

function daysAgo(n) {
    const d = new Date(NOW.getTime() - n * 86400000)
    return d.toISOString().slice(0, 19).replace('T', ' ')
}

function attachment(overrides) {
    return Object.assign(
        {
            sys_id: 'att1',
            table_name: RUN_TABLE,
            table_sys_id: 'run1',
            file_name: 'artifact-1-agent_trace.json',
            sys_created_on: daysAgo(60),
        },
        overrides
    )
}

/**
 * @param {Object} [opts]
 *   rows      seed tables
 *   property  value for `x_snc_troubleshoot.retention_days` (omit for absent)
 *   options   constructor options for PaRetentionSweep
 *   noGlide   leave GlideRecord undefined, as a runtime without it would
 */
function load(opts) {
    const o = opts || {}
    const world = makeWritableWorld({
        rows: o.rows || {},
        failDelete: o.failDelete,
        throwOnDelete: o.throwOnDelete,
        failDeleteIf: o.failDeleteIf,
        throwOnQuery: o.throwOnQuery,
    })

    const globals = { JSON: JSON }
    if (!o.noGlide) globals.GlideRecord = world.GlideRecord

    const ctx = loadScriptInclude('PaRetentionSweep.js', globals)
    if (o.property !== undefined) ctx.gs.properties[PROPERTY] = o.property

    const sweep = new ctx.PaRetentionSweep(
        Object.assign({ now: () => NOW }, o.options || {})
    )
    return { sweep: sweep, world: world, ctx: ctx }
}

// ===========================================================================
// The window
// ===========================================================================

describe('the retention window', () => {
    test('an ABSENT property falls back to the documented 30-day default', () => {
        const { sweep } = load({})
        expect(sweep.retentionDays()).toBe(30)
    })

    test('a configured property wins', () => {
        const { sweep } = load({ property: '7' })
        expect(sweep.retentionDays()).toBe(7)
    })

    test('a constructor override wins over the property — the seam a job or a test needs', () => {
        const { sweep } = load({ property: '7', options: { retentionDays: 90 } })
        expect(sweep.retentionDays()).toBe(90)
    })

    const disabling = ['0', '-1', 'never', 'thirty', '{{broken}}']
    test.each(disabling)('a present-but-unusable value (%s) DISABLES the sweep rather than defaulting', (value) => {
        const { sweep, world } = load({
            property: value,
            rows: { [ATTACHMENTS]: [attachment()] },
        })

        const res = sweep.sweep()

        expect(res.swept).toBe(false)
        expect(res.reason).toBe('retention_disabled')
        // The point of the whole test: nothing was deleted.
        expect(world.tables[ATTACHMENTS]).toHaveLength(1)
        expect(world.calls.deletes).toHaveLength(0)
    })

    test('a blank property is treated as absent, not as unusable', () => {
        // An empty `sys_properties` value is what an admin sees before they
        // ever touch it — that is "not configured", not "configured wrong".
        const { sweep } = load({ property: '' })
        expect(sweep.retentionDays()).toBe(30)
    })

    test('disabling is announced, so a silent no-op is not mistaken for a clean sweep', () => {
        const { sweep, ctx } = load({ property: 'never' })
        sweep.sweep()
        expect(ctx.gs.calls.warn.join(' ')).toMatch(/retention/i)
    })
})

// ===========================================================================
// The purge itself
// ===========================================================================

describe('purging aged artifacts', () => {
    test('ACCEPTANCE: a run older than the window has its attachments removed', () => {
        const { sweep, world } = load({
            property: '30',
            rows: {
                [ATTACHMENTS]: [
                    attachment({ sys_id: 'a1', sys_created_on: daysAgo(60) }),
                    attachment({ sys_id: 'a2', sys_created_on: daysAgo(45) }),
                ],
            },
        })

        const res = sweep.sweep()

        expect(res.swept).toBe(true)
        expect(res.attachments_deleted).toBe(2)
        expect(world.tables[ATTACHMENTS]).toHaveLength(0)
    })

    test('an attachment INSIDE the window is left alone', () => {
        const { sweep, world } = load({
            property: '30',
            rows: {
                [ATTACHMENTS]: [
                    attachment({ sys_id: 'old', sys_created_on: daysAgo(31) }),
                    attachment({ sys_id: 'new', sys_created_on: daysAgo(29) }),
                ],
            },
        })

        const res = sweep.sweep()

        expect(res.attachments_deleted).toBe(1)
        expect(world.tables[ATTACHMENTS].map((r) => r.sys_id)).toEqual(['new'])
    })

    test('attachments belonging to OTHER tables are never touched', () => {
        // The sweep runs as the app, which can see far more than its own rows.
        // Deleting an incident's attachments because it happened to be old
        // would be catastrophic and is exactly the mistake an unscoped
        // `sys_attachment` query makes.
        const { sweep, world } = load({
            property: '30',
            rows: {
                [ATTACHMENTS]: [
                    attachment({ sys_id: 'ours' }),
                    attachment({ sys_id: 'theirs', table_name: 'incident', table_sys_id: 'inc1' }),
                ],
            },
        })

        sweep.sweep()

        expect(world.tables[ATTACHMENTS].map((r) => r.sys_id)).toEqual(['theirs'])
    })

    test('the age test is pushed to the DATABASE, not filtered in JS', () => {
        // A nightly full-table scan of sys_attachment on a customer instance is
        // not acceptable, and a JS-side filter is invisible until it is slow.
        const { sweep, world } = load({
            property: '30',
            rows: { [ATTACHMENTS]: [attachment()] },
        })

        sweep.sweep()

        const q = world.calls.queries.filter((x) => x.table === ATTACHMENTS)
        expect(q).toHaveLength(1)
        expect(q[0].filters.table_name).toBe(RUN_TABLE)
    })

    test('the run rows themselves survive — this purge is artifacts only', () => {
        const { sweep, world } = load({
            property: '30',
            rows: {
                [RUN_TABLE]: [{ sys_id: 'run1', status: 'complete', sys_created_on: daysAgo(60) }],
                [ATTACHMENTS]: [attachment()],
            },
        })

        sweep.sweep()

        expect(world.tables[RUN_TABLE]).toHaveLength(1)
        expect(world.calls.deletes.map((d) => d.table)).toEqual([ATTACHMENTS])
    })

    test('distinct runs touched are counted, not just rows', () => {
        const { sweep } = load({
            property: '30',
            rows: {
                [ATTACHMENTS]: [
                    attachment({ sys_id: 'a1', table_sys_id: 'run1' }),
                    attachment({ sys_id: 'a2', table_sys_id: 'run1' }),
                    attachment({ sys_id: 'a3', table_sys_id: 'run2' }),
                ],
            },
        })

        const res = sweep.sweep()

        expect(res.attachments_deleted).toBe(3)
        expect(res.runs_affected).toBe(2)
    })

    test('nothing to do is a clean sweep, not a failure', () => {
        const { sweep } = load({ property: '30', rows: { [ATTACHMENTS]: [] } })
        const res = sweep.sweep()

        expect(res.swept).toBe(true)
        expect(res.attachments_deleted).toBe(0)
        expect(res.failures).toBe(0)
    })
})

// ===========================================================================
// Degrading, per R-1 / R-10
// ===========================================================================

describe('the sweep degrades rather than throwing', () => {
    test('a rejected delete is counted as a failure and does not abort the pass', () => {
        const { sweep, world } = load({
            property: '30',
            rows: {
                [ATTACHMENTS]: [
                    attachment({ sys_id: 'a1' }),
                    attachment({ sys_id: 'a2' }),
                    attachment({ sys_id: 'a3' }),
                ],
            },
            failDeleteIf: (table, row) => row.sys_id === 'a2',
        })

        const res = sweep.sweep()

        expect(res.attachments_deleted).toBe(2)
        expect(res.failures).toBe(1)
        expect(world.tables[ATTACHMENTS].map((r) => r.sys_id)).toEqual(['a2'])
    })

    test('a delete that THROWS does not take the pass down — R-1, e untouched', () => {
        const hostile = {}
        Object.defineProperty(hostile, 'message', {
            get: function () {
                throw new Error('Illegal access to getter method getMessage')
            },
        })

        const { sweep } = load({
            property: '30',
            rows: { [ATTACHMENTS]: [attachment()] },
            throwOnDelete: hostile,
        })

        let res
        expect(() => {
            res = sweep.sweep()
        }).not.toThrow()
        expect(res.failures).toBeGreaterThan(0)
    })

    test('a failed query sweeps nothing rather than guessing', () => {
        const hostile = {}
        Object.defineProperty(hostile, 'message', {
            get: function () {
                throw new Error('Illegal access to getter method getMessage')
            },
        })

        const { sweep } = load({
            property: '30',
            rows: { [ATTACHMENTS]: [attachment()] },
            throwOnQuery: hostile,
        })

        const res = sweep.sweep()

        expect(res.attachments_deleted).toBe(0)
        expect(res.swept).toBe(false)
    })

    test('no GlideRecord in the runtime degrades explicitly', () => {
        const { sweep } = load({ property: '30', noGlide: true })
        const res = sweep.sweep()

        expect(res.swept).toBe(false)
        expect(res.reason).toBe('no_glide')
    })

    test('a pass is capped, and says so when it hits the cap', () => {
        // An unbounded delete loop on a year of accumulated artifacts is how a
        // nightly job becomes an outage. The cap makes the sweep resumable:
        // the remainder is purged by the next run.
        const rows = []
        for (let i = 0; i < 10; i++) rows.push(attachment({ sys_id: 'a' + i }))

        const { sweep, world } = load({
            property: '30',
            rows: { [ATTACHMENTS]: rows },
            options: { maxDeletes: 4 },
        })

        const res = sweep.sweep()

        expect(res.attachments_deleted).toBe(4)
        expect(res.capped).toBe(true)
        expect(world.tables[ATTACHMENTS]).toHaveLength(6)
    })

    test('an uncapped pass reports capped:false, so the flag means something', () => {
        const { sweep } = load({
            property: '30',
            rows: { [ATTACHMENTS]: [attachment()] },
            options: { maxDeletes: 4 },
        })

        expect(sweep.sweep().capped).toBe(false)
    })
})
