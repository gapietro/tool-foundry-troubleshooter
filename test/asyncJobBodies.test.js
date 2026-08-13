/**
 * The two ScheduledScript bodies under `src/server/async/` — issue #234.
 *
 * WHY THESE NEED A TEST OF THEIR OWN, WHEN THEIR POLICY CLASSES ARE COVERED
 * `PaRetentionSweep` (94.66%) and `PaRunManager.sweepStaleNative` are both well
 * tested. What was covered by NOTHING is the ten-odd lines that CALL them:
 * the `new`, the branch on the result, and the log string. #217 measured that
 * gap as a literal 0% statements/branches/functions/lines across
 * `src/server/async/**`, and a grep confirmed no test file referenced either
 * body.
 *
 * That glue is the highest-consequence code in the directory, not the lowest.
 * `purge-artifacts.js` is the body that decides DELETION of customer-data
 * attachments (#216). A typo in its `result.swept !== true` branch is a
 * retention job that silently never purges while logging as though it did —
 * exactly the failure #216 exists to prevent, one layer up. And these are
 * `Now.include`d ScheduledScript bodies, the artifact class CLAUDE.md flags as
 * carrying almost no signal from a green build: Build Rule #43's shape is
 * builds clean, installs clean, fails only when invoked — and nothing here is
 * invoked until 03:00 on a customer instance.
 *
 * WHAT THIS FILE ASSERTS, AND WHAT IT DELIBERATELY DOES NOT
 * It asserts the GLUE contract only: that the body calls its collaborator, that
 * it branches the right way on each documented return shape, and that the log
 * line it emits distinguishes a real purge from a non-purge. The collaborators
 * are stubbed, so per DESIGN.md R-8 nothing here is evidence about platform
 * behaviour in either direction — the stubs are pinned to the return shapes the
 * real classes DOCUMENT (`PaRetentionSweep.sweep` -> `{swept, reason?,
 * retention_days, cutoff?, attachments_deleted, runs_affected, failures,
 * capped}` at PaRetentionSweep.js:139-141; `sweepStaleNative` -> `{closed:[...]}`
 * at PaRunManager.js:815), so a drift in either contract shows up here as a
 * failing expectation rather than as a passing fiction.
 *
 * Both bodies are IIFEs, so they RUN during `loadScriptInclude` rather than
 * exporting anything — the collaborator globals must therefore be injected
 * before execution, which is what the harness's `extraGlobals` does.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')

// ---------------------------------------------------------------------------
// Harnesses
// ---------------------------------------------------------------------------

/**
 * Runs `purge-artifacts.js` with `PaRetentionSweep.sweep()` stubbed to return
 * `sweepResult`.
 *
 * @param {object|null} sweepResult  what the stubbed sweep hands back
 * @returns {{info: string[], sweepCalls: any[]}}
 */
function runPurge(sweepResult) {
    const sweepCalls = []
    const ctx = loadScriptInclude('async/purge-artifacts.js', {
        PaRetentionSweep: function () {
            this.sweep = function (options) {
                sweepCalls.push(options)
                return sweepResult
            }
        },
    })
    return { info: ctx.gs.calls.info, sweepCalls: sweepCalls }
}

/**
 * Runs `sweep-stale-runs.js` with `PaRunManager.sweepStaleNative()` stubbed.
 *
 * @param {object|null} sweepResult
 * @returns {{info: string[], sweepCalls: any[]}}
 */
function runStaleSweep(sweepResult) {
    const sweepCalls = []
    const ctx = loadScriptInclude('async/sweep-stale-runs.js', {
        PaRunManager: function () {
            this.sweepStaleNative = function (options) {
                sweepCalls.push(options)
                return sweepResult
            }
        },
    })
    return { info: ctx.gs.calls.info, sweepCalls: sweepCalls }
}

/** A complete, successful sweep result — every field the log line reads. */
function sweptResult(overrides) {
    const base = {
        swept: true,
        retention_days: 30,
        cutoff: '2026-07-14 00:00:00',
        attachments_deleted: 7,
        runs_affected: 3,
        failures: 1,
        capped: false,
    }
    Object.keys(overrides || {}).forEach(function (k) {
        base[k] = overrides[k]
    })
    return base
}

// ---------------------------------------------------------------------------
// purge-artifacts.js — the body that decides deletion
// ---------------------------------------------------------------------------

describe('async/purge-artifacts.js', () => {
    it('invokes the sweep exactly once, with an options object', () => {
        const { sweepCalls } = runPurge(sweptResult())

        expect(sweepCalls).toHaveLength(1)
        // Passed as `{}` rather than omitted: PaRetentionSweep reads its window
        // off the options object, so handing it `undefined` would change which
        // defaults apply.
        expect(sweepCalls[0]).toEqual({})
    })

    it('always logs, exactly once, on every path', () => {
        // The body's header states this as a requirement: a retention job that
        // says nothing is indistinguishable from one that is not running at
        // all, and "we have retention" is a claim someone will make to a
        // customer on the strength of this job existing.
        expect(runPurge(sweptResult()).info).toHaveLength(1)
        expect(runPurge({ swept: false, reason: 'disabled' }).info).toHaveLength(1)
        expect(runPurge(null).info).toHaveLength(1)
    })

    describe('the purge did NOT run', () => {
        // ---- ACCEPTANCE CRITERION of #234 ---------------------------------
        it('logs the "did NOT run" line, not a success line, when swept is false', () => {
            const { info } = runPurge({
                swept: false,
                reason: 'retention property unparseable',
                retention_days: 0,
            })

            expect(info[0]).toBe(
                'x_snc_troubleshoot: artifact retention purge did NOT run ' +
                    '(retention property unparseable); retention_days=0'
            )
            // The half that matters most: no reader, and no log search, can
            // mistake this for a purge.
            expect(info[0]).not.toContain('deleted')
        })

        it('carries the reason through, so a disabled pass is distinguishable from a broken one', () => {
            // R-10: `swept:false` with a reason is a legitimate answer, not an
            // error — which is exactly why the reason has to survive into the
            // log. Without it every non-purge looks the same from outside.
            expect(runPurge({ swept: false, reason: 'disabled', retention_days: 0 }).info[0]).toContain(
                '(disabled)'
            )
            expect(runPurge({ swept: false, reason: 'no retention property set', retention_days: 0 }).info[0]).toContain(
                '(no retention property set)'
            )
        })

        it('reports the configured window even when it did not sweep', () => {
            const { info } = runPurge({ swept: false, reason: 'capped', retention_days: 90 })
            expect(info[0]).toContain('retention_days=90')
        })

        it('falls back to "unknown" and 0 when the sweep returns nothing at all', () => {
            // A collaborator returning null/undefined is the shape that would
            // otherwise throw a TypeError inside a 03:00 scheduled job.
            const expected =
                'x_snc_troubleshoot: artifact retention purge did NOT run (unknown); retention_days=0'

            expect(runPurge(null).info[0]).toBe(expected)
            expect(runPurge(undefined).info[0]).toBe(expected)
            expect(runPurge({}).info[0]).toBe(expected)
        })

        it('treats a MISSING swept flag as "did not run" rather than as success', () => {
            // Fail-safe direction: the body tests `swept !== true`, so anything
            // that is not literally the boolean true is a non-purge. A result
            // that merely forgot the flag must not be reported as a purge.
            const { info } = runPurge({ retention_days: 30, attachments_deleted: 7 })
            expect(info[0]).toContain('did NOT run')
        })

        it('does not accept a TRUTHY-but-not-true swept flag as a purge', () => {
            // Pins the strict `!== true`. A stringly-typed `'false'` is truthy
            // in JS, so a loosened check here would report a purge on a result
            // that explicitly says it did not sweep — the silent-failure
            // direction.
            expect(runPurge(sweptResult({ swept: 'false' })).info[0]).toContain('did NOT run')
            expect(runPurge(sweptResult({ swept: 1 })).info[0]).toContain('did NOT run')
        })
    })

    describe('the purge DID run', () => {
        it('reports the real counts from the sweep result', () => {
            const { info } = runPurge(sweptResult())

            expect(info[0]).toBe(
                'x_snc_troubleshoot: artifact retention purge deleted 7 attachment(s) ' +
                    'across 3 run(s) older than 30 days (cutoff 2026-07-14 00:00:00), ' +
                    'failures 1, capped false'
            )
        })

        it('does not launder a zero-deletion pass into silence', () => {
            // The live verification of #216 recorded exactly this shape — 0
            // deleted, 467 -> 467 — so a real successful pass CAN be all
            // zeroes, and it must still read as a pass rather than vanish.
            const { info } = runPurge(sweptResult({ attachments_deleted: 0, runs_affected: 0, failures: 0 }))

            expect(info[0]).toContain('deleted 0 attachment(s)')
            expect(info[0]).toContain('across 0 run(s)')
            expect(info[0]).not.toContain('did NOT run')
        })

        it('surfaces the capped flag, so a truncated pass is not read as a complete one', () => {
            // `capped:true` means the pass hit `_maxDeletes` and there is more
            // to delete. Reported identically to an uncapped pass, it would
            // look like retention had caught up when it had not.
            expect(runPurge(sweptResult({ capped: true })).info[0]).toContain('capped true')
        })

        it('surfaces failures alongside deletions', () => {
            expect(runPurge(sweptResult({ failures: 12 })).info[0]).toContain('failures 12')
        })
    })

    it('lets a throwing sweep propagate rather than logging a false success', () => {
        // Deliberate, and worth pinning: the body has no try/catch, so a
        // failure inside the sweep surfaces to the scheduler as a failed job
        // instead of being swallowed into a log line nobody reads.
        expect(() =>
            loadScriptInclude('async/purge-artifacts.js', {
                PaRetentionSweep: function () {
                    this.sweep = function () {
                        throw new Error('GlideRecord blew up')
                    }
                },
            })
        ).toThrow('GlideRecord blew up')
    })
})

// ---------------------------------------------------------------------------
// sweep-stale-runs.js — the §D5 close-out
// ---------------------------------------------------------------------------

describe('async/sweep-stale-runs.js', () => {
    it('invokes sweepStaleNative exactly once, with an options object', () => {
        const { sweepCalls } = runStaleSweep({ closed: [] })

        expect(sweepCalls).toHaveLength(1)
        // `{}` rather than omitted, so PaRunManager applies DEFAULT_MAX_AGE_HOURS
        // rather than reading a property off undefined.
        expect(sweepCalls[0]).toEqual({})
    })

    it('reports the number of runs it closed', () => {
        const { info } = runStaleSweep({ closed: ['RUN0001', 'RUN0002', 'RUN0003'] })

        expect(info).toHaveLength(1)
        expect(info[0]).toBe('x_snc_troubleshoot: stale-run sweep closed 3 native run(s)')
    })

    it('logs a zero-close pass rather than staying silent', () => {
        // The steady state on a healthy instance is 0, and it still has to be
        // visible: silence cannot distinguish "nothing was stale" from "the
        // job never fired".
        expect(runStaleSweep({ closed: [] }).info[0]).toBe(
            'x_snc_troubleshoot: stale-run sweep closed 0 native run(s)'
        )
    })

    it('reports 0 rather than throwing when the sweep returns nothing usable', () => {
        const expected = 'x_snc_troubleshoot: stale-run sweep closed 0 native run(s)'

        // `sweepStaleNative` returns `{closed: []}` early when GlideRecord is
        // undefined, but the body must not assume the key is present.
        expect(runStaleSweep(null).info[0]).toBe(expected)
        expect(runStaleSweep(undefined).info[0]).toBe(expected)
        expect(runStaleSweep({}).info[0]).toBe(expected)
    })

    it('counts the array rather than reporting the array', () => {
        // Guards the `.length`: interpolating the array itself would emit
        // "closed RUN0001,RUN0002 native run(s)", which reads as a count to a
        // log scraper and is not one.
        const { info } = runStaleSweep({ closed: ['RUN0001', 'RUN0002'] })

        expect(info[0]).toContain('closed 2 native run(s)')
        expect(info[0]).not.toContain('RUN0001')
    })

    it('lets a throwing sweep propagate rather than logging a false zero', () => {
        // Without this, a broken sweep would log "closed 0 native run(s)" —
        // indistinguishable from a healthy instance with nothing stale.
        expect(() =>
            loadScriptInclude('async/sweep-stale-runs.js', {
                PaRunManager: function () {
                    this.sweepStaleNative = function () {
                        throw new Error('query failed')
                    }
                },
            })
        ).toThrow('query failed')
    })
})
