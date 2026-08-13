/**
 * `now-sdk install --alias` must not appear in any INSTRUCTION file (#241).
 *
 * ---------------------------------------------------------------------------
 * WHY A TEST AND NOT CARE
 * ---------------------------------------------------------------------------
 * `now-sdk install` has no `--alias`. Both `install` and `query` document
 * `-a, --auth`; `--alias` is valid only on `auth --add`. This is not a naming
 * nit, because now-sdk **ignores unknown flags silently** (#236) and falls
 * through to the DEFAULT credential — so the misspelling deploys to whatever
 * the default happens to be while the reader believes they named an instance.
 *
 * It has now recurred three times: #236 (CLAUDE.md), #239 (`scripts/smoke.js`,
 * where install and probe targeted different instances), and #241 (sixteen
 * sites across three skill files and three docs). Three occurrences of one
 * mistake is the definition of something a human reviewer is the wrong guard
 * for.
 *
 * The `.claude/skills/` files are the sharpest of the three: those instructions
 * are executed by a coding agent, so there is no human reading the
 * "Attempting to log into instance ..." line that CLAUDE.md tells operators to
 * check before believing a deploy.
 *
 * ---------------------------------------------------------------------------
 * DISCOVERY IS BY GLOB, NOT BY ROSTER — AND THAT WAS A REVIEW FINDING
 * ---------------------------------------------------------------------------
 * The first version of this guard listed seven files by hand and asserted that
 * three of them were skill files — an assertion derived from the same list it
 * checked, so it could only fail if someone DELETED an entry. It could not see
 * an unlisted file, and there are 39 skill `.md` files, not 3. Review of PR
 * #243 caught that, plus five live sites the hand roster had missed
 * (`docs/IMPLEMENTATION_PLAN.md` x4, `docs/BUILD_BRIEF_PaToolAgentTrace.md`).
 * A roster you must remember to update is the same failure mode this file's
 * header argues a human reviewer is the wrong guard for.
 *
 * So the file set is now DISCOVERED. A new skill file or design doc is covered
 * the moment it lands, without anyone remembering this test exists.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY OUT OF SCOPE
 * ---------------------------------------------------------------------------
 * RECORDS, permanently. The `benchmark/raw-evidence-*.md` files, the
 * `benchmark/scoring-v*` directories, `benchmark/DECISION.md`, `CHANGELOG.md`,
 * and every dated file under `docs/superpowers/plans` and
 * `docs/superpowers/specs` record commands that were ACTUALLY RUN, wrong flag
 * and all. Rewriting a record to match present-day correctness destroys the
 * evidence that the command was once wrong — the same reason
 * `benchmark/README.md` preserves its blind rule verbatim. Individual evidence
 * LINES inside scanned files are handled by CITATIONS below.
 *
 * PENDING, tracked in #241. `benchmark/scripts/build-packets.js` emits this
 * command INTO SCORER PACKETS and `test/packetGeneratorParity.test.js` pins the
 * exact string; the eight `benchmark/seeds/seed-0*.md` specs are packet inputs.
 * Editing them is a benchmark-instrument change while #212's claim-veracity
 * pass is in flight, which is what section AO3 already cost us once (the
 * operator changed the scorer instruction and voided the v13 to v14 determinacy
 * comparison). They join this scan when #212 reaches a verdict, or under an
 * explicit section AW amendment recorded at the moment it is made (AT3).
 */

const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')

/** Directories walked for instruction files. */
const SCAN_DIRS = ['.claude/skills', 'docs']

/** Individually named instruction files outside those trees. */
const SCAN_FILES = [
    'CLAUDE.md',
    'README.md',
    'benchmark/README.md',
    'benchmark/seed-app/README.md',
]

/** Path prefixes holding records rather than instructions. */
const RECORD_PREFIXES = [
    'docs/superpowers/plans',
    'docs/superpowers/specs',
]

/**
 * Lines that mention the flag legitimately — either QUOTING the defect to
 * explain why it is wrong, or WARNING against it.
 *
 * CLAUDE.md's instance-split block records the actual incident ("deployed the
 * app to keynexus01 while reporting success"), which is evidence and must not
 * be rewritten into correctness. Its Key Commands block warns against the flag
 * by naming it. `benchmark/README.md`'s reinstall note is past-tense evidence
 * of a deploy that happened.
 *
 * Keyed on a distinctive PHRASE rather than a line NUMBER, which drifts on
 * every edit above it. Each entry is asserted below to still match exactly one
 * line that still contains the flag, so an exemption cannot go stale and cannot
 * widen to cover a real offender that lands nearby.
 */
const CITATIONS = [
    {
        file: 'CLAUDE.md',
        phrase: 'the command this file used to document',
        why: 'records the #236 incident: this exact command deployed to keynexus01 reporting success',
    },
    {
        file: 'CLAUDE.md',
        phrase: 'is NOT an option',
        why: 'the Key Commands warning names the wrong flag in order to warn against it',
    },
    {
        file: 'benchmark/README.md',
        phrase: 'and reinstalled',
        why: 'past-tense evidence of a seed-app reinstall that actually happened',
    },
]

/**
 * A line offends if it mentions `--alias` without mentioning `auth`.
 *
 * Deliberately broader than the first version's `/\binstall\s+--alias\b/`,
 * which required adjacency and so missed
 * `now-sdk install --source dist --alias x` and any fenced block that wrapped
 * the flag onto its own line — the shape CLAUDE.md's Key Commands block is
 * formatted as (review of PR #243). Mentioning `auth` is what makes an
 * occurrence plausibly legitimate: `now-sdk auth --add x --alias y` is the one
 * real use, and prose contrasting `--auth` with `--alias` carries the word too.
 */
function offends(line) {
    return line.indexOf('--alias') !== -1 && line.indexOf('auth') === -1
}

function citationFor(relative, line) {
    for (let i = 0; i < CITATIONS.length; i++) {
        if (CITATIONS[i].file === relative && line.indexOf(CITATIONS[i].phrase) !== -1) return CITATIONS[i]
    }
    return null
}

function isRecord(relative) {
    for (let i = 0; i < RECORD_PREFIXES.length; i++) {
        if (relative.indexOf(RECORD_PREFIXES[i]) === 0) return true
    }
    return false
}

/** Every instruction-bearing markdown file, discovered rather than listed. */
function discover() {
    const found = []
    for (let i = 0; i < SCAN_DIRS.length; i++) {
        const root = path.join(REPO, SCAN_DIRS[i])
        if (!fs.existsSync(root)) continue
        const entries = fs.readdirSync(root, { recursive: true })
        for (let j = 0; j < entries.length; j++) {
            const relative = SCAN_DIRS[i] + '/' + String(entries[j]).split(path.sep).join('/')
            if (!/\.md$/.test(relative) || isRecord(relative)) continue
            if (fs.statSync(path.join(REPO, relative)).isFile()) found.push(relative)
        }
    }
    for (let i = 0; i < SCAN_FILES.length; i++) {
        if (fs.existsSync(path.join(REPO, SCAN_FILES[i]))) found.push(SCAN_FILES[i])
    }
    return found.sort()
}

const FILES = discover()

describe('no instruction file tells anyone to run `now-sdk install --alias` (#241)', () => {
    test('discovery is not vacuous', () => {
        // A glob that silently returns [] would make every assertion below pass
        // while reading nothing — `ci.yml`'s header calls a vacuously-passing
        // step worse than no step, because it reads as a gate.
        expect(FILES.length).toBeGreaterThan(35)
        expect(FILES).toContain('.claude/skills/agent-doctor/SKILL.md')
        expect(FILES).toContain('docs/IMPLEMENTATION_PLAN.md')
        expect(FILES).toContain('CLAUDE.md')
        expect(FILES.filter((f) => f.indexOf('.claude/skills/') === 0).length).toBeGreaterThan(20)
    })

    test('records are excluded from the scan, not silently included', () => {
        // If this ever finds one, the exclusion broke and the next run will
        // demand that evidence be rewritten into correctness.
        expect(FILES.filter(isRecord)).toEqual([])
    })

    test('no discovered instruction file carries the flag', () => {
        const offenders = []
        for (let i = 0; i < FILES.length; i++) {
            const lines = fs.readFileSync(path.join(REPO, FILES[i]), 'utf8').split('\n')
            for (let j = 0; j < lines.length; j++) {
                if (offends(lines[j]) && !citationFor(FILES[i], lines[j])) {
                    offenders.push(FILES[i] + ':' + (j + 1) + ' — ' + lines[j].trim())
                }
            }
        }
        expect(offenders).toEqual([])
    })

    test.each(CITATIONS)('citation exemption in $file is still live ($why)', (citation) => {
        // A stale exemption is worse than none: it reads as "reviewed and
        // allowed" while covering nothing, and the next real offender on that
        // line inherits the pass.
        const lines = fs.readFileSync(path.join(REPO, citation.file), 'utf8').split('\n')
        const matching = lines.filter((l) => l.indexOf(citation.phrase) !== -1)
        expect(matching).toHaveLength(1)
        expect(matching[0].indexOf('--alias')).toBeGreaterThan(-1)
    })

    test('the correct flag is what the installed SDK actually documents', () => {
        // Pins the replacement rather than only banning the mistake — the
        // reason #236's first two fixes were each wrong in a new way. Verified
        // against `now-sdk install --help` on SDK 4.9.2: `-a, --auth <alias>`.
        const claudeMd = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8')
        expect(claudeMd).toContain('now-sdk install --auth gpinst01')
    })

    test('the adjacency-only pattern that missed cases is not what runs', () => {
        // Regression lock on the review finding: prove the widened rule catches
        // the two shapes the original `/\binstall\s+--alias\b/` let through.
        expect(offends('now-sdk install --source dist --alias gpinst01')).toBe(true)
        expect(offends('      --alias gpinst01   # wrapped onto its own line')).toBe(true)
        expect(offends('now-sdk auth --add keynexus01 --alias keynexus01')).toBe(false)
        expect(offends('now-sdk install --auth gpinst01')).toBe(false)
    })
})

// ===========================================================================
// The DEFERRED half of #241 — recorded here rather than left invisible
// ===========================================================================

/**
 * The benchmark-instrument sites that still carry `--alias`, deliberately NOT
 * fixed, pending #212's claim-veracity pass.
 *
 * WHY THESE ARE NOT IN `SCAN_DIRS` AND WHY THAT IS NOT AN OVERSIGHT
 * `benchmark/scripts/build-packets.js` does not merely mention the command — it
 * carries it on BOTH SIDES of a `REDACTIONS` entry, so the flag reaches every
 * scorer packet verbatim in the redacted output. Editing it therefore changes
 * text that reaches the scorer, and it cannot be edited alone: the seeds supply
 * the left-hand side the redaction must match exactly, and
 * `packetGeneratorParity.test.js` pins the resulting string. All twelve move
 * together or not at all.
 *
 * §AO3 is what makes that a reason to wait rather than a reason to hurry: the
 * operator changed the scorer instruction mid-pass once already and it VOIDED
 * the v13→v14 determinacy comparison. §AT3's rule is that an amendment to a
 * registered instrument term belongs in `DECISION.md` at the moment it is made.
 * So this half waits for #212 to reach a verdict, or for an explicit §AX
 * amendment recorded then.
 *
 * WHY A TEST AND NOT A COMMENT ON THE ISSUE
 * Because the failure mode of a deliberate gap is that it stops being
 * deliberate. #241's own history is the argument: it was filed listing ten
 * sites from a hand grep and MISSED five, which were found only once the guard
 * was rebuilt to discover files rather than check a list. An exemption that
 * lives only in an issue comment decays the same way. Pinning the exact counts
 * makes both directions of drift loud:
 *
 *   - the gap WIDENS (a new seed, a new instruction site) -> count rises -> red
 *   - the gap CLOSES (someone lands the fix) -> count falls -> red, with the
 *     message telling them to delete this block and close #241
 *
 * Records are excluded on purpose and are NOT listed here — `raw-evidence-*`,
 * the `scoring-v<n>` directories and the dated plan/spec files record what was
 * actually run, and rewriting a record to match present-day correctness
 * destroys the evidence that the command was once wrong.
 *
 * (Written as `scoring-v<n>` deliberately: the natural glob spelling ends in
 * `*` followed by `/`, which CLOSES this block comment and turns the rest of it
 * into code. Build Rule #43's corollary, one punctuation mark over — a backtick
 * inside a Fluent template comment terminates the template the same way.)
 */
const DEFERRED = [
    { file: 'benchmark/scripts/build-packets.js', lines: 2, why: 'both sides of a REDACTIONS entry — the flag reaches scorer packets' },
    { file: 'test/packetGeneratorParity.test.js', lines: 2, why: 'pins the exact redacted string, so it moves with build-packets.js' },
    { file: 'benchmark/seeds/seed-01-schema-mismatch.md', lines: 1, why: 'seed setup step; packet input' },
    { file: 'benchmark/seeds/seed-02-ambiguous-instruction.md', lines: 1, why: 'seed setup step; packet input' },
    { file: 'benchmark/seeds/seed-03-missing-data.md', lines: 1, why: 'seed setup step; packet input' },
    { file: 'benchmark/seeds/seed-04-genai-unmapped.md', lines: 1, why: 'seed setup step; packet input' },
    { file: 'benchmark/seeds/seed-05-inactive-usecase.md', lines: 1, why: 'seed setup step; packet input' },
    { file: 'benchmark/seeds/seed-06-schema-field-missing.md', lines: 1, why: 'seed setup step; packet input' },
    { file: 'benchmark/seeds/seed-07-tool-output-bloat.md', lines: 1, why: 'seed setup step; packet input' },
    { file: 'benchmark/seeds/seed-08-nonterminating-tool.md', lines: 1, why: 'seed setup step; packet input' },
]

/** Where a NEW live instruction site could appear without any test noticing. */
const DEFERRED_SCAN = ['benchmark/seeds', 'benchmark/scripts']

function offendingLineCount(relative) {
    const abs = path.join(REPO, relative)
    if (!fs.existsSync(abs)) return null
    return fs.readFileSync(abs, 'utf8').split('\n').filter(offends).length
}

describe('the deferred #241 sites are recorded, not forgotten (#212 in flight)', () => {
    test.each(DEFERRED)('$file still carries exactly $lines — deferred, not fixed', (entry) => {
        const actual = offendingLineCount(entry.file)

        expect(actual).not.toBeNull()
        expect({ file: entry.file, lines: actual }).toEqual({ file: entry.file, lines: entry.lines })
    })

    test('the deferred total is twelve lines across ten files', () => {
        // The headline number #241 carries. If this drops, the benchmark half
        // has landed: DELETE this whole block and close #241. If it rises,
        // a new instruction site was added to the frozen set.
        const total = DEFERRED.reduce((n, e) => n + offendingLineCount(e.file), 0)

        expect(total).toBe(12)
        expect(DEFERRED).toHaveLength(10)
    })

    test('no UNLISTED file in the deferred trees carries the flag', () => {
        // The half that keeps the list from decaying the way #241's original
        // hand grep did: discovery, not a roster. A ninth seed added with the
        // old command fails here rather than joining the gap unnoticed.
        const listed = DEFERRED.map((e) => e.file)
        const surprises = []

        DEFERRED_SCAN.forEach((dir) => {
            const root = path.join(REPO, dir)
            if (!fs.existsSync(root)) return
            fs.readdirSync(root, { recursive: true }).forEach((entry) => {
                const relative = dir + '/' + String(entry).split(path.sep).join('/')
                if (listed.indexOf(relative) !== -1) return
                if (!fs.statSync(path.join(REPO, relative)).isFile()) return
                if (offendingLineCount(relative) > 0) surprises.push(relative)
            })
        })

        expect(surprises).toEqual([])
    })

    test('deferred discovery is not vacuous', () => {
        // The trap the coverage-threshold work hit the same day: a glob that
        // matches nothing passes everything while reading nothing.
        const scanned = DEFERRED_SCAN.filter((d) => fs.existsSync(path.join(REPO, d)))
        expect(scanned).toEqual(DEFERRED_SCAN)
        expect(DEFERRED.every((e) => fs.existsSync(path.join(REPO, e.file)))).toBe(true)
    })

    test('every deferred file is genuinely instrument, never a record', () => {
        // Records must stay wrong on purpose and must never be listed as
        // "deferred", which would imply someone intends to rewrite them.
        DEFERRED.forEach((e) => {
            expect(e.file).not.toMatch(/raw-evidence|scoring-v\d/)
            expect(e.why).toBeTruthy()
        })
    })
})
