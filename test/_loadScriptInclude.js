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
    const src = fs.readFileSync(abs, 'utf8')

    const sandbox = { Class: classStub(), gs: gsStub() }
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
