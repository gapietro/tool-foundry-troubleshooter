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
 * It never fired on the custom harness: agent_config was uninvoked in v3
 * (0/10), Task 10 (0/10) and the v4 smoke (0/4), and the two v2 runs that
 * reached it (runs 9 and 10) both asked for section:"triggers", which returns
 * no instructions. The leak was harmless only because the harness was too
 * shallow to reach it, and would have activated at exactly the moment the
 * depth work succeeded.
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
    // `.history.md` siblings hold the prior-pass narrative removed from the
    // specs by issue #100. They now live in benchmark/seeds/history/, a
    // subdirectory readdirSync (non-recursive) never sees, so no exclusion
    // filter is needed here any more -- the directory layout keeps them out
    // by construction rather than by a second, SILENT exemption this file's
    // header argues against. The roster is still pinned by name below so a
    // future layout change can't quietly swallow a real spec.
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

/**
 * How many ```blind-rule-tokens fences a specimen carries. readTokenBlock's
 * match is non-global and silently takes the FIRST, so a second block would be
 * declared-looking and entirely unscanned — a silent way to be unguarded, which
 * is the failure mode this whole file exists to close. The design says exactly
 * one block per specimen; this is what makes "exactly" hold.
 */
function countTokenBlocks(absPath) {
    return (fs.readFileSync(absPath, 'utf8').match(/```blind-rule-tokens\n/g) || []).length
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
 *   system prompt      PaAgentLoop.js                            custom harness
 *   LLM envelope       PaLlmProxy.js                             custom harness
 *   tool envelope      PaScriptToolAdapter.js                    native harness
 *
 * The last five were missing from the first version of this list, which was
 * under-inclusive against the rule it enforces: the rule binds any text the
 * harness can put in front of the model, and all five qualify.
 * PaArtifactStore writes the excerpt and degradation notes that come back
 * through read_artifact; PaFixReport's validation problem text is fed VERBATIM
 * into the model's repair turn (issue #81 — the repair turn receives the draft
 * and the validation problems, and nothing else); PaAgentLoop BUILDS THE SYSTEM
 * PROMPT, including the fallback playbook used when the instruction read fails;
 * PaLlmProxy wraps every call to the model; PaScriptToolAdapter is the native
 * harness's tool envelope. A guard about model-facing text that skipped the
 * file assembling the prompt was the exact shape of gap #89 exists to close.
 * All five were swept by hand and found clean when the gaps were spotted; they
 * are listed here so that stays true automatically rather than by anyone
 * remembering to re-read them.
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
    'src/server/PaAgentLoop.js',
    'src/server/PaLlmProxy.js',
    'src/server/PaScriptToolAdapter.js',
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
    it('scans every model-facing source — 16 of them', () => {
        // A target with a WRONG path fails loudly: findTokens readFileSync's
        // it and throws. A target that is DELETED fails silently — its `it`
        // simply stops being generated, the suite still reports all-green,
        // and coverage shrinks with nothing to show for it. Silent
        // under-coverage is the failure mode this whole issue is about, so
        // the roster size is pinned rather than left implicit. Changing this
        // number is a deliberate act; changing it downward should need a
        // reason in the commit message.
        expect(SCAN_TARGETS).toHaveLength(16)

        // The count alone does not close its own failure mode: a SUBSTITUTION
        // (delete one target, add another) keeps it at 16 while coverage
        // moves. Pin the paths, so any roster change — shrink, swap or
        // rename — has to be made here, deliberately, in the diff.
        expect(SCAN_TARGETS.map((t) => t.file).sort()).toEqual([
            'docs/agent/agent-doctor-instructions.md',
            'src/fluent/agent-doctor.now.ts',
            'src/server/PaAgentLoop.js',
            'src/server/PaArtifactStore.js',
            'src/server/PaFixReport.js',
            'src/server/PaLlmProxy.js',
            'src/server/PaScriptToolAdapter.js',
            'src/server/PaToolReadKit.js',
            'src/server/PaToolRegistry.js',
            'src/server/tools/PaToolAgentConfig.js',
            'src/server/tools/PaToolAgentTrace.js',
            'src/server/tools/PaToolGenAiLog.js',
            'src/server/tools/PaToolLogAnalysis.js',
            'src/server/tools/PaToolQueryTable.js',
            'src/server/tools/PaToolReadArtifact.js',
            'src/server/tools/PaToolSchemaLookup.js',
        ])
    })

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
        it(s.label + ' has exactly one blind-rule-tokens block', () => {
            expect(readTokenBlock(s.file)).not.toBeNull()

            // Not "at least one": a second block is read by nothing and
            // scanned against nothing, while looking like a declaration.
            expect(countTokenBlocks(s.file)).toBe(1)
        })

        it(s.label + ' declares at least one token', () => {
            expect((readTokenBlock(s.file) || []).length).toBeGreaterThan(0)
        })
    })

    it('covers all eight seeds plus the smoke gate', () => {
        // A new seed spec is picked up by readdirSync and immediately fails the
        // two assertions above until its tokens are declared. That is the
        // point: a seed cannot arrive unguarded.
        expect(SPECIMENS).toHaveLength(9)

        // The count alone does not close its own failure mode: a too-greedy
        // glob change could drop a real spec while a newly added file kept
        // the count at nine. Pin the names, so any roster change has to be
        // made here.
        //
        // Seeds 06-08 added 2026-08-11 (#175) for the out-of-sample pass. Seed
        // 06 replaced a refuted ACL-trigger construction and seed 07 replaced a
        // refuted instruction-bloat one; both refutations are recorded in
        // raw-evidence-seed-qualification-06-08.md, and both replacements are
        // rostered here rather than left to a glob.
        expect(SPECIMENS.map((s) => s.label)).toEqual([
            'seed-01-schema-mismatch.md',
            'seed-02-ambiguous-instruction.md',
            'seed-03-missing-data.md',
            'seed-04-genai-unmapped.md',
            'seed-05-inactive-usecase.md',
            'seed-06-schema-field-missing.md',
            'seed-07-tool-output-bloat.md',
            'seed-08-nonterminating-tool.md',
            'README.md smoke gate',
        ])
    })
})
