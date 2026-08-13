/**
 * Test harness for Rhino Script Include bodies.
 *
 * WHY THIS LIVES IN `test/` AND NOT `src/server/__tests__/`
 * IMPLEMENTATION_PLAN.md Tasks 4 and 9 place Jest tests under
 * `src/server/__tests__/`. That does not build: `now-sdk build` lints every
 * file under `src/` against the platform's runtime, and a Jest test's
 * `require('fs')` / `require('path')` / `require('vm')` fails with TS213
 * ("Dependency vm is not found in package.json") and TS307 ("The fs Node.js
 * API is not supported in now platform"). Test code is not platform code and
 * cannot live in the platform source tree. See DESIGN.md R-14.
 *
 * Script Include sources are plain ES5 that assume ServiceNow's globals exist
 * (`Class`, `gs`, `GlideRecordSecure`, ...). They carry no module wrapper, so
 * `require()` cannot load them. This runs the source in a fresh `vm` context
 * with those globals stubbed, and hands back the context so a test can reach
 * the constructor it defined.
 *
 * What this DOES verify: the platform-free logic — digesting, error mining,
 * task-tree assembly, failure signatures, latency flags, argument handling.
 * What it CANNOT verify: anything touching GlideRecordSecure, cross-scope
 * reads, or real `sn_aia_*` data. Those are verified on-instance only; see the
 * issue for this build and DESIGN.md R-8 (a stub result is not evidence about
 * platform behaviour, in either direction).
 */

const fs = require('fs')
const path = require('path')
const vm = require('vm')

// ---------------------------------------------------------------------------
// COVERAGE INSTRUMENTATION — issue #217
//
// `vm.runInContext` on raw file text bypasses Jest's instrumenting transform
// entirely, so istanbul never saw a single line of `src/server/**` and
// `--coverage` reported 0% statements/branches/functions/lines across all 21
// production files while 1,800+ tests genuinely exercised them. The number was
// wrong in the safe direction, which is exactly why it went unnoticed: nobody
// could identify an untested branch, and no threshold could gate CI.
//
// The loader's rationale is not the problem and is NOT reverted — R-14 stands,
// test code cannot live under `src/` or `now-sdk build` rejects it with
// TS213/TS307. What was missing is that no alternative measurement was
// substituted. So: instrument the source explicitly through
// `babel-plugin-istanbul` before handing it to `runInContext`.
//
// TWO THINGS MAKE THIS WORK, and both are easy to get subtly wrong:
//
//   1. THE COVERAGE OBJECT MUST BE SHARED, NOT COPIED. The instrumented
//      preamble does `var coverage = <scope>.__coverage__ || (<scope>.__coverage__ = {})`
//      and mutates it in place. `coverageGlobalScope: 'globalThis'` makes that
//      scope the vm context's own global, so the sandbox is seeded with the
//      SAME object Jest collects from (`global.__coverage__`) and the counters
//      accumulate straight into it. Copying after the fact would lose every
//      count written by a later `loadScriptInclude` call — and these suites
//      re-load the same source once per test.
//
//   2. IT IS OFF UNLESS COVERAGE WAS ASKED FOR. Instrumenting on every run
//      would put a Babel parse in front of every one of the ~1,900 loads for
//      no benefit. `test/_coverageSetup.js` (jest `globalSetup`) reads
//      `globalConfig.collectCoverage` and sets the env var below BEFORE any
//      worker is forked, so workers inherit it — which is why this is a
//      globalSetup and not an argv sniff, since `--coverage` does not
//      reliably reach a forked worker's `process.argv`.
//
// Cost when it IS on: one Babel transform per distinct file, cached below, so
// the ~1,900 loads pay it 21 times.
// ---------------------------------------------------------------------------
const INSTRUMENT = process.env.PA_INSTRUMENT_COVERAGE === '1'
const instrumentedCache = new Map()

function instrument(src, abs) {
    if (instrumentedCache.has(abs)) return instrumentedCache.get(abs)

    // Required lazily: on a normal `npx jest` run these are never loaded.
    const babel = require('@babel/core')
    const istanbul = require('babel-plugin-istanbul')

    const out = babel.transformSync(src, {
        filename: abs,
        cwd: path.resolve(__dirname, '..'),
        configFile: false,
        babelrc: false,
        // Sources are ES5 Rhino bodies with no module wrapper — nothing to
        // compile, only to instrument. Any preset here would risk rewriting
        // the very code under test.
        plugins: [
            [
                istanbul.default || istanbul,
                {
                    coverageGlobalScope: 'globalThis',
                    coverageGlobalScopeFunc: false,
                },
            ],
        ],
    })

    const code = out && out.code ? out.code : src
    instrumentedCache.set(abs, code)
    return code
}

/**
 * Mirrors the platform's `Class.create()`: returns a constructor that calls
 * `initialize` if the prototype defines one.
 */
function classStub() {
    return {
        create: function () {
            return function () {
                if (typeof this.initialize === 'function') {
                    this.initialize.apply(this, arguments)
                }
            }
        },
    }
}

/** Records what the script logged, so tests can assert on it if they care. */
function gsStub() {
    const calls = { info: [], warn: [], error: [], debug: [] }
    return {
        calls: calls,
        info: function (m) {
            calls.info.push(m)
        },
        warn: function (m) {
            calls.warn.push(m)
        },
        error: function (m) {
            calls.error.push(m)
        },
        debug: function (m) {
            calls.debug.push(m)
        },
        getUserName: function () {
            return 'test.user'
        },
        getCurrentScopeName: function () {
            return 'x_snc_troubleshoot'
        },
        nil: function (v) {
            return v === null || v === undefined || v === ''
        },
    }
}

/**
 * @param {string} relPath  path relative to `src/server/`, e.g. `tools/PaToolAgentTrace.js`
 * @param {object} [extraGlobals]  additional globals to place in the context
 * @returns {object} the vm context, carrying whatever the source defined
 */
function loadScriptInclude(relPath, extraGlobals) {
    const abs = path.resolve(__dirname, '..', 'src', 'server', relPath)
    const raw = fs.readFileSync(abs, 'utf8')
    const src = INSTRUMENT ? instrument(raw, abs) : raw

    const sandbox = { Class: classStub(), gs: gsStub() }

    // Seeded BEFORE createContext, and seeded with the very object Jest reads
    // rather than a fresh one — see the instrumentation note above on why a
    // copy would silently lose every count after the first load.
    if (INSTRUMENT) {
        if (!global.__coverage__) global.__coverage__ = {}
        sandbox.__coverage__ = global.__coverage__
    }

    if (extraGlobals) {
        Object.keys(extraGlobals).forEach(function (k) {
            sandbox[k] = extraGlobals[k]
        })
    }

    vm.createContext(sandbox)
    vm.runInContext(src, sandbox, { filename: abs })
    return sandbox
}

module.exports = { loadScriptInclude: loadScriptInclude }
