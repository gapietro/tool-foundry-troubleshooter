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

const { stripComments } = require('./_stripComments')

/**
 * Everything the harness can put in front of the model.
 *
 *   instructions       docs/agent/agent-doctor-instructions.md   both harnesses
 *   tool descriptions  PaToolRegistry.js -> agent-doctor.now.ts  both harnesses
 *   tool output        the 7 cores + PaToolReadKit               both harnesses
 *   paged evidence     PaArtifactStore.js                        both harnesses
 *   repair-turn text   PaFixReport.js                            custom harness
 *
 * The last two were missing from the first version of this list, which was
 * under-inclusive against the rule it enforces: the rule binds any text the
 * harness can put in front of the model, and both of these qualify.
 * PaArtifactStore writes the excerpt and degradation notes that come back
 * through read_artifact; PaFixReport's validation problem text is fed VERBATIM
 * into the model's repair turn (issue #81 — the repair turn receives the draft
 * and the validation problems, and nothing else). Both were swept by hand and
 * found clean when the gap was spotted; they are listed here so that stays true
 * automatically rather than by anyone remembering to re-read them.
 *
 * NOT scanned, and the distinction is the whole point: benchmark/seed-app/**
 * is the fixture that IMPLEMENTS the defects, and benchmark/** docs ARE the
 * answer key. Both are full of tokens by construction; neither is model-facing.
 */
const SCAN_TARGETS = [
    'src/server/tools/PaToolAgentTrace.js',
    'src/server/tools/PaToolAgentConfig.js',
    'src/server/tools/PaToolGenAiLog.js',
    'src/server/tools/PaToolLogAnalysis.js',
    'src/server/tools/PaToolQueryTable.js',
    'src/server/tools/PaToolSchemaLookup.js',
    'src/server/tools/PaToolReadArtifact.js',
    'src/server/PaToolReadKit.js',
    'src/server/PaToolRegistry.js',
    'src/server/PaArtifactStore.js',
    'src/server/PaFixReport.js',
    'src/fluent/agent-doctor.now.ts',
].map((f) => ({ file: f, stripComments: true }))
    // The instructions doc is scanned WHOLE. All of it is model-facing, so
    // there is no non-model-facing half to exempt.
    .concat([{ file: 'docs/agent/agent-doctor-instructions.md', stripComments: false }])

/** Every declared token across every specimen, with its source spec attached. */
function allTokens() {
    const out = []
    SPECIMENS.forEach((s) => {
        ;(readTokenBlock(s.file) || []).forEach((t) => out.push({ token: t, from: s.label }))
    })
    return out
}

/**
 * Case-insensitive substring hits in already-prepared text, as
 * {line, token, from, text}. Pure — no file I/O, no comment handling — so the
 * POSITIVE control below can exercise THE REAL MATCHER on a planted line.
 */
function scanText(text, tokens) {
    const hits = []

    text.split('\n').forEach((line, i) => {
        const haystack = line.toLowerCase()
        tokens.forEach((t) => {
            if (haystack.indexOf(t.token.toLowerCase()) === -1) return
            hits.push({ line: i + 1, token: t.token, from: t.from, text: line.trim() })
        })
    })

    return hits
}

/** scanText against a target file, with that target's comment policy applied. */
function findTokens(target, tokens) {
    const raw = fs.readFileSync(path.join(ROOT, target.file), 'utf8')
    const text = target.stripComments ? stripComments(raw) : raw
    return scanText(text, tokens).map((h) => Object.assign({ file: target.file }, h))
}

describe('no seeded answer reaches a model-facing string (issue #89)', () => {
    SCAN_TARGETS.forEach((target) => {
        it(target.file + ' names no seed answer', () => {
            const hits = findTokens(target, allTokens())
            expect(
                hits.map(
                    (h) =>
                        h.file + ':' + h.line + '  [' + h.from + ': ' + h.token + ']  ' + h.text
                )
            ).toEqual([])
        })
    })
})

describe('the scanner itself works (controls)', () => {
    it('POSITIVE: the real matcher catches a planted token', () => {
        // A guard that passes because it silently matched NOTHING is
        // indistinguishable from one that passes because the code is clean.
        // This calls scanText -- the same function the scan above runs on every
        // target -- so a matcher that stops matching fails HERE.
        const hits = scanText("    detail: 'the Seed 03 Category Router never fired',", [
            { token: 'Seed 03 Category Router', from: 'control' },
        ])

        expect(hits).toHaveLength(1)
        expect(hits[0].line).toBe(1)
        expect(hits[0].token).toBe('Seed 03 Category Router')
    })

    it('POSITIVE: the real matcher is case-insensitive', () => {
        expect(
            scanText('RULES_IN_TABLE', [{ token: 'rules_in_table', from: 'control' }])
        ).toHaveLength(1)
    })

    it('NEGATIVE: a token inside a real comment does not fire', () => {
        // PaToolRegistry.js documents the #91 section ranking by naming seed
        // 03's whole answer -- `rules_in_table: 0` -- in a comment. That prose
        // is exactly where the knowledge belongs and must stay writable. It is
        // a real-file control: if comment-stripping ever breaks, this fails
        // BEFORE the main scan turns into noise.
        const registry = { file: 'src/server/PaToolRegistry.js', stripComments: true }
        const raw = fs.readFileSync(path.join(ROOT, registry.file), 'utf8')

        expect(raw.toLowerCase()).toContain('rules_in_table')
        expect(findTokens(registry, [{ token: 'rules_in_table', from: 'control' }])).toEqual([])
    })
})

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
