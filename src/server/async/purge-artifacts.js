// ScheduledScript body for the artifact retention purge (issue #216).
//
// Pulled in via Now.include for the same reason as sweep-stale-runs.js —
// Build Rule #43. One line of real logic: PaRetentionSweep.sweep() already
// carries the whole policy (attachment-driven rather than run-driven, scoped
// to this app's run table, capped per pass, and DISABLED rather than
// defaulting when the retention property is present but unparseable) — see
// that file's header. This script is just the daily trigger.
//
// The log line always fires, including on a disabled or degraded pass, because
// a retention job that says nothing is indistinguishable from one that is not
// running at all — and "we have retention" is a claim someone will make to a
// customer on the strength of this job existing.
;(function () {
    var result = new PaRetentionSweep().sweep({})

    if (!result || result.swept !== true) {
        gs.info(
            'x_snc_troubleshoot: artifact retention purge did NOT run (' +
                ((result && result.reason) || 'unknown') +
                '); retention_days=' +
                ((result && result.retention_days) || 0)
        )
        return
    }

    gs.info(
        'x_snc_troubleshoot: artifact retention purge deleted ' +
            result.attachments_deleted +
            ' attachment(s) across ' +
            result.runs_affected +
            ' run(s) older than ' +
            result.retention_days +
            ' days (cutoff ' +
            result.cutoff +
            '), failures ' +
            result.failures +
            ', capped ' +
            result.capped
    )
})()
