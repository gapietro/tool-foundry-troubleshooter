/**
 * `benchmark/EXTRACTOR-BRIEF.md` must not contain corpus vocabulary (§AW11f).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS TEST EXISTS: THE BRIEF IS INSIDE THE BOUNDARY IT DESCRIBES
 * ---------------------------------------------------------------------------
 * The #212 blinding procedure protects a single-use calibration set. Its
 * §AW11e repair introduced §AW11f's defect: the paragraph explaining why a path
 * was withdrawn QUOTED the offending strings verbatim and labelled what each
 * one adjudicated — reproducing the leak into the one file every author is
 * REQUIRED to read. That is strictly worse than the original, because the
 * original strings were unlabelled fixture data and the explanation supplied
 * their significance.
 *
 * §AW11d had already recorded this mechanism ("a string becomes answer-key
 * material retroactively") and its remedy ("state the defect's shape with no
 * vocabulary shared with the corpus"). The remedy was four paragraphs above
 * where the new prose was appended, and the defect recurred anyway.
 *
 * So the guard cannot be care, and it cannot be self-certification either:
 *
 *   > **Registered principle (§AW11f):** the artifact that describes the
 *   > boundary sits inside it. Whoever is qualified to write that description
 *   > is contaminated by construction — they know what must be withheld — so
 *   > they cannot be the one who clears it. The clearing must be mechanical.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DOES AND DOES NOT CLAIM
 * ---------------------------------------------------------------------------
 * This is a vocabulary check, not a semantic one. It cannot tell whether a
 * sentence leaks by implication; it can only tell whether the brief has started
 * naming things it must not name. That is worth having because all three
 * brief-side leaks so far (§AW11d ×2, §AW11f) were VOCABULARY leaks — a fixture
 * table, a count, a shape enumeration — not subtle inferences.
 *
 * The patterns are deliberately NOT documented with examples of what they
 * match, because this file is not on the author's allowlist but is trivially
 * discoverable, and a list of forbidden strings is itself a hint. Each pattern
 * carries only a category name.
 */

const fs = require('fs')
const path = require('path')

const BRIEF = path.join(__dirname, '..', 'benchmark', 'EXTRACTOR-BRIEF.md')

/** Repo-relative path, for readable failure output. */
const BRIEF_REL = 'benchmark/EXTRACTOR-BRIEF.md'

/**
 * The only `./test/` files the brief may name — its allowlist entries.
 *
 * Naming a PERMITTED file points at nothing; the hazard is naming an EXCLUDED
 * one, which is what §AW11f's first repair did. So this is a set check, not a
 * blanket ban: a closed allowlist has to name what it admits.
 */
const PERMITTED_TEST_FILES = [
    '_loadScriptInclude.js',
    '_glideStub.js',
    '_stripComments.js',
    'stripComments.test.js',
    'utf16ClipContract.test.js',
    'PaRetentionSweep.test.js',
]

/**
 * Categories of corpus vocabulary the brief must never contain.
 *
 * MOVED to test/_corpusVocabulary.js so the extractor's §AX5 clearing check —
 * registered as "the same instrument as this file, pointed at the extractor" —
 * shares the patterns rather than copying them. A copy satisfies "same
 * instrument" only until the first widening, and this list has already been
 * widened once under fire (review of PR #246).
 */
const { FORBIDDEN, scan } = require('./_corpusVocabulary')

describe('the extractor brief does not leak corpus vocabulary (§AW11f)', () => {
    const raw = fs.readFileSync(BRIEF, 'utf8')

    test.each(FORBIDDEN)('contains no $label', (pattern) => {
        expect(scan(raw, BRIEF_REL, pattern)).toEqual([])
    })

    test('the brief names no `./test/` file outside its own allowlist', () => {
        // §AW11f's defect in its precise form: the repair named the EXCLUDED
        // file it was withdrawing, which points straight at it. Permitted files
        // must be named; anything else must not be.
        const named = raw.match(/`?\.?\/?test\/[\w.]+`?/g) || []
        const offenders = named
            .map((m) => m.replace(/[`]/g, '').replace(/^\.?\//, '').replace(/^test\//, ''))
            .filter((f) => f.indexOf('.') !== -1)
            .filter((f) => PERMITTED_TEST_FILES.indexOf(f) === -1)
        expect(offenders).toEqual([])
    })

    test('the allowlist still names all six permitted files', () => {
        // The counterweight: a closed allowlist that names nothing admits
        // nothing, and an author with no style exemplars will ask for paths —
        // which is the failure mode §3 tries to avoid.
        for (let i = 0; i < PERMITTED_TEST_FILES.length; i++) {
            expect(raw).toContain(PERMITTED_TEST_FILES[i])
        }
    })

    test('the brief still points at the record it withholds', () => {
        // The split is the design: detail lives in DECISION.md, which is on the
        // author's exclusion list. If the pointer goes, the record is orphaned
        // and the next editor re-derives the detail into the brief.
        expect(raw).toMatch(/DECISION\.md.*AW11/)
    })
})

