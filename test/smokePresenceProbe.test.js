/**
 * The presence-only probe for query-refused tables — issue #242.
 *
 * WHAT THIS REPLACES, AND WHY THE CORRECTION IS THE POINT
 * `scripts/smoke.js` used to carry a `REFUSED_TABLES` set documented as tables
 * "the instance refuses to serve over the Table API even to an admin". The 403
 * behind that was real and correctly measured. The CONCLUSION was wrong: it is
 * not the table that is refused, it is any request carrying a `sysparm_query`.
 * The same tables return 200 and rows without one.
 *
 * The cost of the misdiagnosis was not the four records. It was that a
 * permanent exemption, written into the code as a platform fact, stops being
 * re-examined — and per Build Rule #33 these are precisely the tables whose
 * composite identity keys churn and DUPLICATE on every redeploy, so the probe
 * was blind exactly where drift is most likely.
 *
 * WHAT IS ASSERTED HERE VERSUS ON THE INSTANCE
 * These are unit tests over a stubbed `child_process`, so per DESIGN.md R-8
 * they are evidence about this shell's LOGIC and about nothing platform-side.
 * The platform claims they are built on — that `-q ''` returns 200 with
 * sys_ids, that a `sysparm_query` returns 403, and that a denied business
 * column is silently omitted rather than errored — were measured live on
 * gpinst01 and are recorded in the constant's header in `scripts/smoke.js`.
 */

jest.mock('child_process')

const { execFileSync } = require('child_process')
const smoke = require('../scripts/smoke')

const {
    PRESENCE_ONLY_TABLES,
    PRESENCE_LIMIT,
    AUTH_FLAG,
    installArgs,
    presenceArgs,
    presenceSweep,
    probeByPresence,
    NOTE_KINDS,
    SHELL_KINDS,
    PRINTERS,
} = smoke

/** An envelope as `now-sdk query -o json` prints it. */
function envelope(sysIds, hasMore, nextOffset) {
    return JSON.stringify({
        ok: true,
        hasMore: !!hasMore,
        nextOffset: nextOffset === undefined ? null : nextOffset,
        records: sysIds.map(function (id) {
            return { sys_id: id }
        }),
    })
}

/** Queues stdout responses, one per execFileSync call, in order. */
function respondWith(responses) {
    let i = 0
    execFileSync.mockImplementation(function () {
        const r = responses[i++]
        if (r === undefined) throw new Error('unexpected extra now-sdk call #' + i)
        if (r instanceof Error) throw r
        return r
    })
}

/** A non-zero exit that still printed its envelope, as a refusal does. */
function refusal(message) {
    const err = new Error('Command failed')
    err.stdout = JSON.stringify({ ok: false, error: { message: message } })
    return err
}

beforeEach(() => {
    execFileSync.mockReset()
})

// ===========================================================================
// The set itself
// ===========================================================================

describe('PRESENCE_ONLY_TABLES', () => {
    test('names the two tables measured to 403 on a sysparm_query', () => {
        expect(Array.from(PRESENCE_ONLY_TABLES).sort()).toEqual([
            'sys_gen_ai_feature_mapping',
            'sys_gen_ai_strategy_mapping',
        ])
    })

    test('the old REFUSED_TABLES export is gone, not merely renamed alongside', () => {
        // A lingering alias would let a caller keep the wholesale-skip
        // behaviour this issue exists to remove.
        expect(smoke.REFUSED_TABLES).toBeUndefined()
    })
})

// ===========================================================================
// presenceArgs — the argv that makes the read legal
// ===========================================================================

describe('presenceArgs', () => {
    test('passes an EMPTY -q, which is what dodges the 403', () => {
        // The CLI marks -q [required], so it cannot be omitted; an empty value
        // satisfies the parser while producing a request with no
        // sysparm_query. That is the entire mechanism.
        const argv = presenceArgs('sys_gen_ai_feature_mapping', 2000, 0, 'gpinst01')
        const q = argv.indexOf('-q')

        expect(q).toBeGreaterThan(-1)
        expect(argv[q + 1]).toBe('')
    })

    test('carries no field name that could be mistaken for a query operand', () => {
        const argv = presenceArgs('sys_gen_ai_feature_mapping', 2000, 0, null)
        expect(argv).not.toContain('sys_idIN')
        expect(argv.join(' ')).not.toContain('sysparm_query')
    })

    test('asks only for sys_id', () => {
        const argv = presenceArgs('t', 2000, 0, null)
        const f = argv.indexOf('-f')

        expect(f).toBeGreaterThan(-1)
        expect(argv[f + 1]).toBe('sys_id')
    })

    test('threads limit and offset through as strings', () => {
        const argv = presenceArgs('t', 2000, 4000, null)

        expect(argv[argv.indexOf('--limit') + 1]).toBe('2000')
        expect(argv[argv.indexOf('--offset') + 1]).toBe('4000')
    })

    // ---- the #239 / #240 guard, extended to the new seam -----------------
    test('resolves the SAME instance as install does', () => {
        // The defect this repo has now hit twice (#236, #239): a read helper
        // and the install helper disagreeing about the auth flag, so the probe
        // verifies an instance the deploy never touched. A new read path is a
        // new chance to reintroduce it.
        const authPortion = function (argv) {
            const i = argv.indexOf(AUTH_FLAG)
            return i === -1 ? [] : argv.slice(i, i + 2)
        }

        expect(authPortion(presenceArgs('t', 10, 0, 'keynexus01'))).toEqual(
            authPortion(installArgs('keynexus01'))
        )
        expect(authPortion(presenceArgs('t', 10, 0, 'keynexus01'))).toEqual([AUTH_FLAG, 'keynexus01'])
    })

    test('omits auth entirely when no alias is given, rather than sending an empty one', () => {
        expect(presenceArgs('t', 10, 0, null)).not.toContain(AUTH_FLAG)
    })

    test('never emits --alias, which now-sdk would ignore silently', () => {
        expect(presenceArgs('t', 10, 0, 'gpinst01')).not.toContain('--alias')
    })
})

// ===========================================================================
// presenceSweep — pagination
// ===========================================================================

describe('presenceSweep', () => {
    test('collects sys_ids from a single page', () => {
        respondWith([envelope(['a', 'b', 'c'], false)])

        const out = presenceSweep('sys_gen_ai_feature_mapping', 'gpinst01')

        expect(out.ok).toBe(true)
        expect(Array.from(out.sysIds).sort()).toEqual(['a', 'b', 'c'])
        expect(out.pages).toBe(1)
        expect(execFileSync).toHaveBeenCalledTimes(1)
    })

    test('uses the measured page size, so one page covers both tables today', () => {
        respondWith([envelope(['a'], false)])
        presenceSweep('sys_gen_ai_feature_mapping', null)

        const argv = execFileSync.mock.calls[0][1]
        expect(argv[argv.indexOf('--limit') + 1]).toBe(String(PRESENCE_LIMIT))
        expect(PRESENCE_LIMIT).toBe(2000)
    })

    test('follows hasMore across pages and unions the results', () => {
        // "Fits in one page" is a property of the instance, not of the code —
        // 648 rows today, and nothing stops that growing.
        respondWith([
            envelope(['a', 'b'], true, 2),
            envelope(['c', 'd'], true, 4),
            envelope(['e'], false),
        ])

        const out = presenceSweep('sys_gen_ai_feature_mapping', null)

        expect(out.ok).toBe(true)
        expect(Array.from(out.sysIds).sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
        expect(out.pages).toBe(3)
        expect(execFileSync.mock.calls[1][1]).toContain('2')
        expect(execFileSync.mock.calls[2][1]).toContain('4')
    })

    test('derives the next offset when the envelope omits one', () => {
        respondWith([envelope(['a', 'b'], true), envelope(['c'], false)])

        const out = presenceSweep('t', null)

        expect(out.ok).toBe(true)
        const secondArgv = execFileSync.mock.calls[1][1]
        expect(secondArgv[secondArgv.indexOf('--offset') + 1]).toBe('2')
    })

    test('refuses to loop when pagination does not advance', () => {
        // hasMore:true with a non-advancing offset would otherwise re-read page
        // one forever, or — worse — stop and report a confident partial set.
        respondWith([envelope(['a'], true, 0), envelope(['a'], true, 0)])

        const out = presenceSweep('t', null)

        expect(out.ok).toBe(false)
        expect(out.error).toContain('pagination did not advance')
    })

    test('a refused read is a failure carrying the platform message', () => {
        respondWith([refusal('Insufficient rights to query records')])

        const out = presenceSweep('t', null)

        expect(out.ok).toBe(false)
        expect(out.error).toBe('Insufficient rights to query records')
    })

    test('ignores records with no sys_id rather than adding undefined to the set', () => {
        respondWith([JSON.stringify({ ok: true, hasMore: false, records: [{ sys_id: 'a' }, {}] })])

        const out = presenceSweep('t', null)

        expect(Array.from(out.sysIds)).toEqual(['a'])
    })
})

// ===========================================================================
// probeByPresence — what the sweep is turned into
// ===========================================================================

describe('probeByPresence', () => {
    const RECORDS = [
        { table: 'sys_gen_ai_feature_mapping', sysId: 'aaa' },
        { table: 'sys_gen_ai_feature_mapping', sysId: 'bbb' },
    ]

    test('a present record is a presence_only NOTE, not a pass and not a failure', () => {
        respondWith([envelope(['aaa', 'bbb', 'zzz'], false)])
        const findings = []

        probeByPresence('sys_gen_ai_feature_mapping', RECORDS, null, findings)

        // `instanceRows` is the sweep's own row count (3 here), NOT the number
        // of our records found (2). Only the former can move on a redeploy, so
        // only the former can show Build Rule #33's duplication.
        expect(findings).toEqual([
            { kind: 'presence_only', table: 'sys_gen_ai_feature_mapping', sysId: 'aaa', instanceRows: 3 },
            { kind: 'presence_only', table: 'sys_gen_ai_feature_mapping', sysId: 'bbb', instanceRows: 3 },
        ])
    })

    test('a page of rows with NO readable sys_id fails the sweep instead of reporting every record missing', () => {
        // The confident-wrong-direction failure the review caught: this file's
        // header documents that a DENIED column is omitted silently rather than
        // errored, and `sys_id` is a column. Without this guard the sweep
        // succeeds with an empty set and every dist record is reported MISSING
        // citing Build Rule #34 — a red run with a precisely wrong cause.
        respondWith([JSON.stringify({ ok: true, hasMore: false, records: [{}, {}] })])
        const findings = []

        probeByPresence('sys_gen_ai_feature_mapping', RECORDS, null, findings)

        expect(findings).toHaveLength(1)
        expect(findings[0].kind).toBe('unreadable')
        expect(findings[0].error).toContain('no readable sys_id')
        expect(findings.filter((f) => f.kind === 'missing')).toEqual([])
    })

    test('a full page with no next link fails rather than reporting the rest missing', () => {
        // `hasMore` comes from the `Link: rel="next"` header alone, so a
        // stripped header reads as "that was everything". probeByNaturalKey
        // already refuses to guess here; this path now matches it.
        const full = Array.from({ length: PRESENCE_LIMIT }, (_, i) => ({ sys_id: 'x' + i }))
        respondWith([JSON.stringify({ ok: true, hasMore: false, records: full })])
        const findings = []

        probeByPresence('sys_gen_ai_feature_mapping', RECORDS, null, findings)

        expect(findings).toHaveLength(1)
        expect(findings[0].kind).toBe('unreadable')
        expect(findings[0].error).toContain('may be truncated')
    })

    // ---- THE COVERAGE THIS ISSUE RECOVERS --------------------------------
    test('an ABSENT record is a real `missing` finding — Build Rule #34', () => {
        // The whole point. Under the old code these four records were skipped
        // wholesale, so a record silently dropped at install by a Data Policy
        // was indistinguishable from one that installed correctly.
        respondWith([envelope(['aaa'], false)])
        const findings = []

        probeByPresence('sys_gen_ai_feature_mapping', RECORDS, null, findings)

        expect(findings).toContainEqual({
            kind: 'missing',
            table: 'sys_gen_ai_feature_mapping',
            sysId: 'bbb',
        })
        // `missing` is a failure kind, so this reddens the run.
        expect(NOTE_KINDS).not.toContain('missing')
    })

    test('a failed sweep is `unreadable` and names it as a sweep failure', () => {
        // Now a REAL finding rather than an expected refusal: the read is
        // measured to work, so a failure means something changed.
        respondWith([refusal('Insufficient rights to query records')])
        const findings = []

        probeByPresence('sys_gen_ai_feature_mapping', RECORDS, null, findings)

        expect(findings).toHaveLength(1)
        expect(findings[0].kind).toBe('unreadable')
        expect(findings[0].count).toBe(2)
        expect(findings[0].error).toContain('presence sweep failed')
        expect(NOTE_KINDS).not.toContain('unreadable')
    })

    test('sweeps once per table, not once per record', () => {
        respondWith([envelope(['aaa', 'bbb'], false)])
        probeByPresence('sys_gen_ai_feature_mapping', RECORDS, null, [])

        expect(execFileSync).toHaveBeenCalledTimes(1)
    })
})

// ===========================================================================
// Kind classification
// ===========================================================================

describe('presence_only is classified as a disclosure', () => {
    test('registered as a shell kind, so the completeness test sees it', () => {
        expect(SHELL_KINDS).toContain('presence_only')
    })

    test('is a note — it does not redden the exit code', () => {
        expect(NOTE_KINDS).toContain('presence_only')
    })

    test('has no failure printer, which would contradict being a note', () => {
        expect(PRINTERS.presence_only).toBeUndefined()
    })
})

// ===========================================================================
// report() — the grade line, which is this issue's whole thesis
// ===========================================================================

/**
 * The summary line is the one sentence anyone reads, and #242 is entirely about
 * it not stating something false. It was also the only logic in the fix with no
 * test (review of PR #250) — the three probe functions were pinned by 23 tests
 * while the branch computing the headline was exercised by nothing.
 */
describe('report — the grade line', () => {
    let out

    beforeEach(() => {
        out = []
        jest.spyOn(process.stdout, 'write').mockImplementation((s) => {
            out.push(String(s))
            return true
        })
        process.exitCode = 0
    })

    afterEach(() => {
        process.stdout.write.mockRestore()
        process.exitCode = 0
    })

    const text = () => out.join('')
    const presence = (n, table, instanceRows) =>
        Array.from({ length: n }, (_, i) => ({
            kind: 'presence_only',
            table: table || 'sys_gen_ai_feature_mapping',
            sysId: 'p' + i,
            instanceRows: instanceRows === undefined ? 648 : instanceRows,
        }))

    test('with no presence records it keeps the original wording', () => {
        smoke.report([], 165)
        expect(text()).toContain('✓ deploy smoke passed — 165 of 165 records present and matching')
    })

    test('names the two grades separately rather than folding them into one figure', () => {
        smoke.report(presence(4), 165)
        expect(text()).toContain(
            '✓ deploy smoke passed — 165 of 165 records present — 161 field-matched, 4 presence-only'
        )
    })

    // ---- the review finding: the headline must not contradict the findings --
    test('a MISSING presence record comes off the present count, not the matched count', () => {
        // Previously this printed "165 of 165 records present — 162
        // field-matched" while a MISSING finding for that very record was
        // printed underneath. 165 were not present and 162 were not matched.
        const findings = presence(3).concat([
            { kind: 'missing', table: 'sys_gen_ai_feature_mapping', sysId: 'gone' },
        ])
        smoke.report(findings, 165)

        expect(text()).toContain('164 of 165 records present — 161 field-matched, 3 presence-only')
        expect(text()).not.toContain('165 of 165')
    })

    test('a MISSING record on any table comes off the count too', () => {
        smoke.report([{ kind: 'missing', table: 'sys_script_include', sysId: 'x' }], 165)
        expect(text()).toContain('164 of 165')
    })

    test('unreadable and missing both subtract, without double-counting', () => {
        const findings = [
            { kind: 'unreadable', table: 't', count: 10, error: 'refused' },
            { kind: 'missing', table: 'u', sysId: 'x' },
        ]
        smoke.report(findings, 165)
        expect(text()).toContain('154 of 165')
    })

    test('the presence block reports BOTH numbers, and says which one moves', () => {
        // The finding count is bounded by dist and constant across redeploys;
        // only the instance row count can show Build Rule #33's duplication.
        smoke.report(presence(2, 'sys_gen_ai_feature_mapping', 648), 165)

        expect(text()).toContain('sys_gen_ai_feature_mapping — 2 of ours found, 648 rows on the instance')
        expect(text()).toContain('Build Rule #33')
    })

    test('presence_only alone does not redden the exit code', () => {
        smoke.report(presence(4), 165)
        expect(process.exitCode).toBe(0)
        expect(text()).toContain('✓')
    })

    test('a missing presence record DOES redden the exit code', () => {
        smoke.report(
            presence(3).concat([{ kind: 'missing', table: 'sys_gen_ai_feature_mapping', sysId: 'gone' }]),
            165
        )
        expect(process.exitCode).toBe(1)
        expect(text()).toContain('✗ deploy smoke FAILED')
    })
})
