/**
 * The blind rule binds every channel that reaches a SCORER, not only the
 * channels that reach the harness (issue #100).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS, AND WHY IT IS NOT PART OF blindRule.test.js
 * ---------------------------------------------------------------------------
 * blindRule.test.js protects the measurement SUBJECT: it keeps the seeded
 * answer out of anything the harness can put in front of the model. This file
 * protects the measurement INSTRUMENT: it keeps a prior run's behaviour and
 * grade out of anything a blind scorer reads.
 *
 * Both became necessary at different times. The first mattered from the
 * beginning. The second only mattered from v3, when scoring moved from a human
 * operator to independent blind agents whose packets embed the seed spec
 * verbatim -- at which point four of five specs were narrating what earlier
 * runs had scored, including literal grades ("scored 6/6", "2/6, fail",
 * "earning full -- not partial -- fix-target credit").
 *
 * ---------------------------------------------------------------------------
 * HOW A PATTERN IS CHOSEN
 * ---------------------------------------------------------------------------
 * A pattern names a PRIOR RUN'S OUTCOME, not the vocabulary of grading.
 *
 *   DECLARE   past-tense, run-subject phrasing -- "both scored runs",
 *             "run 2 named", "scored 6/6", "earning full ... credit".
 *   DO NOT    scoring GUIDANCE, which a seed spec is entitled to give:
 *             "a decoy hit scores 2/0/1/0", "must not be scored as a hit",
 *             "would have been scored a miss". These are rules and
 *             hypotheticals, not reports of what happened.
 *
 * As in blindRule.test.js there is deliberately NO stop-list and no
 * generic-word exemption. A pattern too broad simply reddens the suite, and
 * that failure IS the signal to write a better pattern. An exemption would be
 * a second, SILENT way to be unguarded.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD DOES NOT COVER
 * ---------------------------------------------------------------------------
 * The rule binds three channels (benchmark/README.md, "The scorer blind
 * rule"); this guard scans one of them. The rubric channel is
 * benchmark/scorecard-template.md, of which only sections A/A2/A3 reach a
 * packet, and the file legitimately explains grading with score-shaped text
 * ("a run can score 3/6 and pass") -- a whole-file scan would be a
 * false-positive machine, and a section-scoped scan would pin the template's
 * heading structure into a test for no measured benefit. The run-report
 * channel is per-row prose written fresh each pass. Both are bound by the
 * rule and neither is scanned here. A passing suite is not evidence of
 * blindness; it is evidence the declared patterns did not fire.
 */

const fs = require('fs')
const path = require('path')
const { normalizeProse, lineAt } = require('./_normalizeProse')

const ROOT = path.join(__dirname, '..')
const SEEDS = path.join(ROOT, 'benchmark', 'seeds')

/**
 * The scorer-facing seed specs. `.history.md` siblings hold what was removed
 * from them and live in benchmark/seeds/history/ -- a subdirectory this
 * non-recursive readdirSync never sees, so no exclusion filter is needed
 * here. They are never copied into a packet, which is the whole point of
 * the split.
 */
const SPECS = fs
    .readdirSync(SEEDS)
    .filter((f) => /^seed-\d+-.*\.md$/.test(f))
    .sort()

const PATTERNS = [
    {
        name: 'scored-a-number',
        re: /scored\s+(?:the\s+canonical\s+)?\d/i,
        why: 'a literal grade awarded to a prior run -- "scored 6/6", "scored the canonical 2/0/1/0"',
    },
    {
        name: 'scored-runs-or-rows',
        re: /scored\s+(?:runs?|rows?)\b/i,
        why: 'names the prior scored runs as a group -- "both scored runs", "2 scored rows are void"',
    },
    {
        name: 'run-N-did',
        re: /\b(?:runs?|rows?)\s+[12]\s+(?:found|named|diagnosed|proposed|concluded|identified|reported|flagged|missed)\b/i,
        why: 'what an individual prior run concluded -- "run 2 named the empty connection"',
    },
    {
        name: 'credit-awarded',
        re: /(?:earning|earned|awarded|received)\s+(?:full|partial)[^.]{0,60}credit/i,
        why: 'the exact credit level a prior run was awarded, which is the grade the scorer is about to assign',
    },
    {
        name: 'rubric-fraction',
        re: /\d\s*\/\s*(?:6|10)\b/,
        why: 'a score out of the rubric total or the pass denominator -- "2/6, fail", "8/10"',
    },
    {
        name: 'answer-key-pointer',
        re: /DECISION\.md/i,
        why:
            'a relative link a MODEL scorer can follow into the most concentrated answer key in ' +
            'the repo. A pointer to the answer is the same defect as the answer. ' +
            '../scorecard-template.md refs are fine -- the rubric is already in the packet.',
    },
]

/**
 * The packet channel's pattern list, kept SEPARATE from PATTERNS above
 * because the two channels ban different things and scan different files.
 * PATTERNS bans a prior run's outcome and scans the seed specs. This bans a
 * repository path and scans the packets. Merging them would force the seed
 * specs -- which legitimately cite 22 repository paths, because a spec that
 * cannot say which Fluent file installs its seed is not a usable source
 * document -- to satisfy a rule written for a different artifact.
 */
const PACKET_PATTERNS = [
    {
        name: 'repository-path',
        // Two alternations, both deliberate:
        //   1. a path qualified by one of this repo's top-level directories,
        //      with optional ./ or ../ prefixes (the specs use both forms);
        //   2. a bare root-level document name -- DESIGN.md was invisible to
        //      the old literal DECISION.md pattern and is one hop from the
        //      same answers.
        // No file-extension requirement on alternation 1: "benchmark/seeds"
        // is a route even without a filename, and seeds/history/ is what
        // sits at the end of it.
        re:
            /(?:\.{0,2}\/)*(?:benchmark|docs|src|test|seed-app|node_modules|dist|\.claude)\/[A-Za-z0-9_./-]+|\b(?:DECISION|DESIGN|CHANGELOG|README|IMPLEMENTATION_PLAN|LOW_LEVEL_DESIGN|PREFLIGHT_FINDINGS|CLAUDE)\.md\b/,
        why:
            'a repository path a MODEL scorer can follow out of the packet and into this ' +
            'project prior conclusions. A pointer to the answer is the same defect as the ' +
            'answer, and the shortest routes found in v9 were one hop, not two.',
    },
]

/**
 * Every hit of every pattern in `patterns`, as {pattern, line, text}. Pure --
 * no file I/O -- so the controls below exercise THE REAL MATCHER on planted
 * prose. Shared by both channels (scanProse/scanPackets) because the loop
 * carries two non-obvious correctness details that must not drift apart if
 * one channel's pattern list is ever tuned without the other in mind:
 *   - the RegExp reconstruction strips 'g' from p.re.flags before adding it
 *     back, because p.re.flags + 'g' would duplicate 'g' (and throw) if a
 *     future pattern is ever declared with it already set;
 *   - the zero-width-match guard (`if (m.index === re.lastIndex)
 *     re.lastIndex++`) prevents an infinite loop if a pattern can match an
 *     empty string.
 */
function scanWith(patterns, text, lineStarts) {
    const hits = []

    patterns.forEach((p) => {
        const re = new RegExp(p.re.source, p.re.flags.replace('g', '') + 'g')
        let m
        while ((m = re.exec(text)) !== null) {
            hits.push({ pattern: p.name, why: p.why, line: lineAt(lineStarts, m.index), text: m[0] })
            if (m.index === re.lastIndex) re.lastIndex++
        }
    })

    return hits
}

/** Every hit of every spec-channel pattern. See scanWith for the matcher. */
function scanProse(text, lineStarts) {
    return scanWith(PATTERNS, text, lineStarts)
}

/** Every hit of every packet-channel pattern. See scanWith for the matcher. */
function scanPackets(text, lineStarts) {
    return scanWith(PACKET_PATTERNS, text, lineStarts)
}

/** Read a seed spec and normalize it in one step. */
function load(filename) {
    return normalizeProse(fs.readFileSync(path.join(SEEDS, filename), 'utf8'))
}

describe('no prior run outcome reaches a scorer-facing seed spec (issue #100)', () => {
    it('scans every scorer-facing spec -- five of them', () => {
        // Pinned by name as well as by count: a substitution (one spec renamed,
        // another added) would keep the count at five while coverage moved. That
        // is the silent-under-coverage failure this guard exists to prevent.
        expect(SPECS).toEqual([
            'seed-01-schema-mismatch.md',
            'seed-02-ambiguous-instruction.md',
            'seed-03-missing-data.md',
            'seed-04-genai-unmapped.md',
            'seed-05-inactive-usecase.md',
        ])
    })

    SPECS.forEach((filename) => {
        it(filename + ' states no prior run outcome', () => {
            const { text, lineStarts } = load(filename)
            const hits = scanProse(text, lineStarts)

            expect(
                hits.map(
                    (h) =>
                        filename + ':' + h.line + '  [' + h.pattern + ']  ' + h.text + '  -- ' + h.why
                )
            ).toEqual([])
        })
    })
})

describe('the scanner itself works (controls)', () => {
    it('POSITIVE: catches a leak split across a line break inside a blockquote', () => {
        // The exact shape a per-line scanner misses, and the reason
        // _normalizeProse.js exists. If normalization ever regresses, this
        // fails HERE rather than turning the main scan silently green.
        const { text, lineStarts } = normalizeProse(
            '> named the specific gate with the m2m link verified intact, earning\n' +
                '> full - not partial - fix-target credit, and both flagged the empty\n'
        )
        const hits = scanProse(text, lineStarts)

        expect(hits.map((h) => h.pattern)).toContain('credit-awarded')

        // The match starts on "earning" -- line 1 of the planted text -- even
        // though the phrase it completes is on line 2. Pinning the reported
        // line number is the point of keeping the line map at all: if this
        // ever silently drifted to line 2 (or 0), the map that lets a failure
        // point at real source has quietly broken.
        const creditHit = hits.find((h) => h.pattern === 'credit-awarded')
        expect(creditHit.line).toBe(1)
    })

    it('POSITIVE: catches a literal grade', () => {
        const { text, lineStarts } = normalizeProse('ruled out) and scored 6/6.')
        const hits = scanProse(text, lineStarts).map((h) => h.pattern).sort()

        expect(hits).toEqual(['rubric-fraction', 'scored-a-number'])
    })

    it('NEGATIVE: present-tense scoring guidance does not fire', () => {
        // "a decoy hit scores 2/0/1/0" is a RULE the spec is entitled to give.
        // Only the past-tense report of a run having scored it is a leak.
        const { text, lineStarts } = normalizeProse('a decoy hit scores the canonical 2/0/1/0 row.')

        expect(scanProse(text, lineStarts)).toEqual([])
    })

    it('NEGATIVE, real file: seed 04 keeps its decoy guidance and still scans clean', () => {
        // This is the falsifiable core of issue #100's fix: it distinguishes
        // redacting the leak from lobotomising the packet. Both sentences are
        // scoring guidance a scorer NEEDS; both must survive every rewrite.
        const { text, lineStarts } = load('seed-04-genai-unmapped.md')

        expect(text).toContain('must not be scored as a hit')
        expect(text).toContain('would have been scored a **miss**')
        expect(scanProse(text, lineStarts)).toEqual([])
    })

    it('NEGATIVE, real file: seed 01 keeps its fixture ground truth and still scans clean', () => {
        // `priority_stored` = `null` was measured during a prior pass, and is
        // FIXTURE STATE rather than a run outcome. A scorer cannot judge a
        // seed-01 diagnosis without it. Pinned so a future redaction sweep
        // cannot take it by mistake.
        const { text, lineStarts } = load('seed-01-schema-mismatch.md')

        expect(text).toContain('`priority_stored` = `null`')
        expect(scanProse(text, lineStarts)).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// THE PACKET CHANNEL (issue #140)
// ---------------------------------------------------------------------------
// The spec channel above bans a prior run's OUTCOME. This channel bans a
// repository PATH, which is a different defect: not the answer, but a route a
// MODEL scorer can walk to reach it. Issue #100's fix produced packets that
// named their own sources -- "(verbatim from benchmark/scorecard-template.md)"
// -- and that template cites DECISION.md, so the route was two hops from a
// packet and one hop from the citation. The old answer-key-pointer pattern
// matched a literal DECISION.md and saw neither.
//
// The rule here is deliberately UNIFORM: any repository path, no judgement
// about which paths are "safe". §T7's reasoning -- a selective rule forces
// every future reader to re-derive which paths were judged safe, and that
// re-derivation is where the next leak hides.
describe('the packet scanner itself works (controls)', () => {
    it('POSITIVE: a directory-qualified path fires', () => {
        const { text, lineStarts } = normalizeProse('(verbatim from benchmark/scorecard-template.md)')
        const hits = scanPackets(text, lineStarts)

        expect(hits.map((h) => h.pattern)).toEqual(['repository-path'])
        expect(hits[0].text).toBe('benchmark/scorecard-template.md')
    })

    it('POSITIVE: a bare root-level doc name fires -- the case the old literal pattern missed', () => {
        // The old answer-key-pointer matched /DECISION\.md/i and nothing else.
        // DESIGN.md is a root-level answer-adjacent document and was invisible
        // to it. Both must fire now.
        const { text, lineStarts } = normalizeProse('see DESIGN.md and DECISION.md for the rulings')
        const hits = scanPackets(text, lineStarts)

        expect(hits.map((h) => h.text).sort()).toEqual(['DECISION.md', 'DESIGN.md'])
    })

    it('POSITIVE: a relative path fires, and reports the line it opened on', () => {
        // Packets embed spec content, and the specs use ../ and ../../ forms.
        // The line map matters for the same reason it does in the spec channel:
        // a failure must point at real source.
        const { text, lineStarts } = normalizeProse(
            'first line with nothing\n' + 'the guard is ../../test/blindRule.test.js today\n'
        )
        const hits = scanPackets(text, lineStarts)

        expect(hits.map((h) => h.text)).toEqual(['../../test/blindRule.test.js'])
        expect(hits[0].line).toBe(2)
    })

    it('NEGATIVE: prose containing a slash but no repository path does not fire', () => {
        // Row 06's real packet text. A UI breadcrumb is not a path into this
        // repo, and a pattern that reddened on it would be untenable.
        const { text, lineStarts } = normalizeProse('Open Now Assist / AI Skill Studio and locate the provider integration')

        expect(scanPackets(text, lineStarts)).toEqual([])
    })

    it('NEGATIVE: a platform table or field name does not fire', () => {
        const { text, lineStarts } = normalizeProse(
            'sn_aia_execution_plan.state, x_snc_tsbench_routing, api_type=sys_hub_flow'
        )

        expect(scanPackets(text, lineStarts)).toEqual([])
    })
})
