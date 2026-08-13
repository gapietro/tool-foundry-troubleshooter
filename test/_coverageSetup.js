/**
 * Jest `globalSetup` — turns loader instrumentation on, and ONLY when coverage
 * was actually asked for (issue #217).
 *
 * WHY THIS FILE EXISTS AT ALL, RATHER THAN A CHECK INSIDE THE LOADER
 * `test/_loadScriptInclude.js` needs to know whether to put a Babel transform
 * in front of every source it loads. It cannot find that out for itself:
 * `--coverage` is a flag on the Jest CLI process, and the suites run inside
 * FORKED WORKERS whose `process.argv` does not carry it. `globalSetup` is
 * handed the resolved `globalConfig` and runs BEFORE any worker is created, so
 * an env var set here is inherited by every worker — which is the only signal
 * that reliably crosses that boundary.
 *
 * It reads `collectCoverage` rather than sniffing argv so that `--coverage`,
 * `--collectCoverage`, and a `collectCoverage: true` in the Jest config all
 * behave identically. Nothing here is conditional on HOW coverage was
 * requested.
 */

module.exports = function coverageSetup(globalConfig) {
    if (globalConfig && globalConfig.collectCoverage) {
        process.env.PA_INSTRUMENT_COVERAGE = '1'
    }
}
