/**
 * The blind rule binds every channel the harness can put in front of the
 * model — instructions, tool descriptions, and tool output (issue #89).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * benchmark/README.md's smoke gate expects `script_error` citing
 * `context_processing_script` line 42. Until 2026.08.0222, PaToolAgentConfig
 * emitted "an auto-populated body on this instance threw at line 42" inside a
 * FINDING — the gate's own expected answer, handed to the model mid-reasoning,
 * on any agent with a populated context_processing_script.
 *
 * It never fired, because no run has ever invoked agent_config: 0/10 in v3,
 * 0/10 in Task 10, 0/4 in the v4 smoke. The leak was harmless only because the
 * harness was too shallow to reach it, and would have activated at exactly the
 * moment the depth work succeeded.
 *
 * PR #87 removed that instance while sweeping for STATISTICS (#85). It never
 * swept for ANSWERS. This file is that sweep, made permanent.
 *
 * ---------------------------------------------------------------------------
 * HOW A TOKEN IS CHOSEN
 * ---------------------------------------------------------------------------
 * A token names THE ANSWER, not THE VOCABULARY OF THE QUESTION.
 *
 *   DECLARE   strings that exist only because the seed exists —
 *             x_snc_tsbench_*, seed agent and tool names, the seeded value.
 *   DO NOT    platform vocabulary a diagnostic tool legitimately reads.
 *             sn_aia_trigger_configuration is seed 05's answer AND a table
 *             agent_config must query to sweep layer 7. context_processing_script
 *             is the smoke gate's answer AND a field that same tool must read.
 *
 * A token that fires on honest tool code is a bad token, not a finding. Where
 * the answer IS platform vocabulary, declare the surrounding phrasing instead:
 * the smoke gate declares `line 42`, not `context_processing_script`.
 *
 * There is deliberately NO stop-list. A token too generic to be distinctive
 * simply reddens the suite, and that failure IS the signal to pick a better
 * token. A length filter or generic-word exemption would introduce a second,
 * SILENT way to be unguarded — the exact failure mode #89 is about.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SEEDS = path.join(ROOT, 'benchmark', 'seeds')

/** The 5 seed specs plus the README smoke gate — every specimen a run is scored against. */
const SPECIMENS = fs
    .readdirSync(SEEDS)
    .filter((f) => /^seed-\d+-.*\.md$/.test(f))
    .sort()
    .map((f) => ({ label: f, file: path.join(SEEDS, f) }))
    .concat([{ label: 'README.md smoke gate', file: path.join(ROOT, 'benchmark', 'README.md') }])

/**
 * Read a ```blind-rule-tokens fence. Returns null when the file has no block —
 * distinct from an empty block, which is a declared claim of "nothing to hide"
 * and is also rejected.
 */
function readTokenBlock(absPath) {
    const source = fs.readFileSync(absPath, 'utf8')
    const match = source.match(/```blind-rule-tokens\n([\s\S]*?)```/)
    if (!match) return null
    return match[1]
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
}

describe('every specimen declares its answer tokens (issue #89)', () => {
    SPECIMENS.forEach((s) => {
        it(s.label + ' has a blind-rule-tokens block', () => {
            expect(readTokenBlock(s.file)).not.toBeNull()
        })

        it(s.label + ' declares at least one token', () => {
            expect((readTokenBlock(s.file) || []).length).toBeGreaterThan(0)
        })
    })

    it('covers all five seeds plus the smoke gate', () => {
        // A new seed spec is picked up by readdirSync and immediately fails the
        // two assertions above until its tokens are declared. That is the
        // point: a seed cannot arrive unguarded.
        expect(SPECIMENS).toHaveLength(6)
    })
})
