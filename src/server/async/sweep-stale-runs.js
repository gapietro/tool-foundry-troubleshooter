// ScheduledScript body for the §D5 stale-native-run sweep (Task 7).
//
// Pulled in via Now.include for the same reason as run-start-worker.js —
// Build Rule #43. One line of real logic: PaRunManager.sweepStaleNative
// already carries the entire §D5 policy (native-only, `running`-only so
// `awaiting_confirmation` never expires, the R-20 citation appended on every
// row it closes) — see that file's header. This script is just the daily
// trigger.
(function () {
    var result = new PaRunManager().sweepStaleNative({})
    var closedCount = result && result.closed ? result.closed.length : 0
    gs.info('x_snc_troubleshoot: stale-run sweep closed ' + closedCount + ' native run(s)')
})()
