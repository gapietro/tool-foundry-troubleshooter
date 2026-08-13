/**
 * The coverage measurement itself, asserted — issue #217.
 *
 * WHY THIS FILE EXISTS
 * #217 was not a wrong number, it was an ABSENT one: `vm.runInContext` on raw
 * file text bypassed Jest's instrumenting transform, so `--coverage` reported
 * 0% across all 21 production files while 1,800+ tests exercised them. It went
 * unnoticed for the whole life of the repo because it failed in the reassuring
 * direction — a coverage report that renders, with every cell wrong.
 *
 * A number that can silently become meaningless needs a test on the MECHANISM,
 * not just a threshold on the OUTPUT. A threshold alone cannot catch this: if
 * instrumentation breaks again, coverage returns to 0% and the threshold does
 * fail — but so would a genuine regression, and the two would be
 * indistinguishable from the CI log. These tests say which one happened.
 */

const path = require('path')

const LOADER = './_loadScriptInclude'

/** Runs `fn` with the instrumentation env var forced, then restores it. */
function withInstrumentation(fn) {
    const prev = process.env.PA_INSTRUMENT_COVERAGE
    process.env.PA_INSTRUMENT_COVERAGE = '1'
    try {
        // The loader reads the env var at module scope, so it has to be
        // re-required after the change — the cached copy captured the old value.
        jest.resetModules()
        return fn(require(LOADER))
    } finally {
        if (prev === undefined) delete process.env.PA_INSTRUMENT_COVERAGE
        else process.env.PA_INSTRUMENT_COVERAGE = prev
        jest.resetModules()
    }
}

describe('the vm loader is instrumented when coverage is requested (#217)', () => {
    test('loading a Script Include records counters against its real path', () => {
        const target = path.resolve(__dirname, '..', 'src', 'server', 'PaRunManager.js')

        withInstrumentation(({ loadScriptInclude }) => {
            loadScriptInclude('PaRunManager.js', { JSON: JSON })

            const entry = global.__coverage__ && global.__coverage__[target]
            expect(entry).toBeTruthy()
            expect(entry.path).toBe(target)

            // Statements were not merely DECLARED — they were counted. A
            // shape-only assertion would pass against an instrumented file
            // that never actually ran, which is the 0% case wearing a
            // disguise.
            const hits = Object.keys(entry.s).filter((k) => entry.s[k] > 0)
            expect(hits.length).toBeGreaterThan(0)
        })
    })

    test('counters ACCUMULATE across loads rather than resetting', () => {
        // The suites re-load the same source once per test, so a fresh
        // coverage object per load would throw away everything but the last
        // one — the failure mode that makes a shared object load-bearing in
        // `_loadScriptInclude`.
        const target = path.resolve(__dirname, '..', 'src', 'server', 'PaRunManager.js')

        withInstrumentation(({ loadScriptInclude }) => {
            loadScriptInclude('PaRunManager.js', { JSON: JSON })
            const first = global.__coverage__[target].s[0]

            loadScriptInclude('PaRunManager.js', { JSON: JSON })
            const second = global.__coverage__[target].s[0]

            expect(second).toBeGreaterThan(first)
        })
    })

    test('the instrumented source still behaves identically', () => {
        // Instrumentation that changed behaviour would be worse than no
        // measurement at all.
        withInstrumentation(({ loadScriptInclude }) => {
            const ctx = loadScriptInclude('PaToolReadKit.js')
            const kit = new ctx.PaToolReadKit()

            expect(kit.clipUtf16('abcdef', 3)).toBe('abc')
            expect(typeof kit.digest).toBe('function')
        })
    })

    test('instrumentation is OFF by default, so a normal run pays no Babel cost', () => {
        jest.resetModules()
        const before = process.env.PA_INSTRUMENT_COVERAGE
        delete process.env.PA_INSTRUMENT_COVERAGE

        try {
            const { loadScriptInclude } = require(LOADER)
            const ctx = loadScriptInclude('PaToolReadKit.js')
            // The tell is in the source the vm executed: an instrumented body
            // carries istanbul's counter calls, a raw one does not.
            expect(ctx.PaToolReadKit.prototype.clipUtf16.toString()).not.toMatch(/cov_[0-9a-z]+\(\)/)
        } finally {
            if (before !== undefined) process.env.PA_INSTRUMENT_COVERAGE = before
            jest.resetModules()
        }
    })
})

describe('the globalSetup that decides it', () => {
    const setup = require('./_coverageSetup')

    afterEach(() => {
        delete process.env.PA_INSTRUMENT_COVERAGE
    })

    test('collectCoverage true turns instrumentation on', () => {
        delete process.env.PA_INSTRUMENT_COVERAGE
        setup({ collectCoverage: true })
        expect(process.env.PA_INSTRUMENT_COVERAGE).toBe('1')
    })

    test('collectCoverage false leaves it alone', () => {
        delete process.env.PA_INSTRUMENT_COVERAGE
        setup({ collectCoverage: false })
        expect(process.env.PA_INSTRUMENT_COVERAGE).toBeUndefined()
    })

    test('a missing config is not a crash — globalSetup failing takes the whole run down', () => {
        expect(() => setup(undefined)).not.toThrow()
    })
})
