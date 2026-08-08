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
 * packet. It is NOT scanned here, and the reason is mechanical rather than
 * principled: the section legitimately explains grading with score-shaped text
 * ("a run can score 3/6 and pass"), so a naive scan reddens on guidance, while
 * a section-scoped scan would pin the template's heading structure into a test.
 *
 * That is a cost/benefit judgement, NOT a claim that the channel is safe. It
 * was once written up as though score-shaped text in the rubric were only ever
 * legitimate guidance; #139 falsified that -- a §A2.1 preamble shipped into the
 * rubric slice carrying a prior pass's grades and two decision-record section
 * pointers, and no guard could have fired. So: the rubric channel is bound by
 * the rule and is not machine-scanned, which makes every addition to §A/§A2/§A3
 * a HAND check against the blind rule before it ships.
 *
 * The run-report channel is per-row prose written fresh each pass. Both are
 * bound by the rule and neither is scanned here. A passing suite is not
 * evidence of blindness; it is evidence the declared patterns did not fire.
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

const SCORING = path.join(ROOT, 'benchmark')

/**
 * Every committed packet directory, DECLARED -- including the ones this guard
 * does not scan, and why.
 *
 * A packet is the one self-contained file handed to one blind scorer
 * (row-NN-<harness>-seed-SS-run-R.md). The other files in a scoring
 * directory -- packet-build-report.md, run-evidence.md, trigger-report.md --
 * are operator records that no scorer sees, so they are out of the channel and
 * out of this scan.
 */
const PACKET_SETS = [
    {
        dir: 'scoring-v4',
        packets: 20,
        scanned: false,
        why:
            'Scored before this guard existed. Its 20 packets carry 164 repository-path ' +
            'references, and they are the record of what those scorers actually read: ' +
            'editing them to satisfy a later rule would destroy the only thing they exist ' +
            'to preserve. Declared here rather than omitted so the exception is visible ' +
            'instead of re-derived by whoever reads this next.',
    },
    {
        dir: 'scoring-v9',
        packets: 12,
        scanned: true,
        why: 'The current pass. Built path-clean by hand (§T7) and kept that way by this scan.',
    },
]

/** The scorer-facing packets in one set, sorted. Operator records are excluded by the pattern. */
function packetFiles(dir) {
    return fs
        .readdirSync(path.join(SCORING, dir))
        .filter((f) => /^row-\d+-.*\.md$/.test(f))
        .sort()
}

/** Read a packet and normalize it in one step. */
function loadPacket(dir, filename) {
    return normalizeProse(fs.readFileSync(path.join(SCORING, dir, filename), 'utf8'))
}

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
        //   1. a path qualified by a directory stem this repo actually uses,
        //      with optional ./ or ../ prefixes (the specs use both forms);
        //   2. ANY bare markdown filename. This started as an eight-name
        //      root-level list and was widened in the #139 review: a
        //      whitelist of eight names missed scorecard-v9.md (the literal
        //      per-row answer key), raw-evidence-v9-scored-pass.md and
        //      agent-doctor-instructions.md, and both leaks §T7 found by hand
        //      escape it if written one directory segment shorter.
        // No file-extension requirement on alternation 1: "benchmark/seeds"
        // is a route even without a filename, and seeds/history/ is what
        // sits at the end of it -- which is also why the stems include the
        // NON-top-level ones (seeds, history, results, scoring-vN): a path
        // written relative to benchmark/ is the same route one segment
        // shorter. The scorecard-/raw-evidence- stems cover directory forms
        // of those documents should they ever gain siblings; today it is
        // alternation 2 that catches them.
        //
        // Measured after widening: the twelve committed v9 packets still scan
        // 0, so nothing here was tightened back for a false positive.
        re:
            /(?:\.{0,2}\/)*(?:benchmark|docs|src|test|seed-app|node_modules|dist|\.claude|seeds|history|results|scoring-v[0-9]+|scorecard-[A-Za-z0-9_-]+|raw-evidence-[A-Za-z0-9_-]+)\/[A-Za-z0-9_./-]+|\b[A-Za-z0-9_-]+\.md\b/,
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
// The rule here aims at UNIFORMITY -- any repository path, no judgement about
// which paths are "safe". §T7's reasoning: a selective rule forces every future
// reader to re-derive which paths were judged safe, and that re-derivation is
// where the next leak hides.
//
// What ships is close to that but not identical to it, and the gap is worth
// naming rather than glossing. ANY bare `*.md` filename fires, so every
// document in this repository is covered by name. Longer paths fire only when
// rooted at one of the enumerated directory stems -- so a non-markdown file
// outside those stems (say a top-level `package.json`) is not matched. That
// residue is deliberate: the answer keys in this project are all markdown, and
// the directory list covers every route to them found so far.
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

    it('POSITIVE: the literal per-row answer key fires by bare filename', () => {
        // scorecard-v9.md holds the graded row table. The pre-#139 pattern
        // whitelisted eight root-level names and this was not one of them, so
        // the single most direct route out of a packet was unguarded.
        const { text, lineStarts } = normalizeProse('cross-check against scorecard-v9.md before grading')
        const hits = scanPackets(text, lineStarts)

        expect(hits.map((h) => h.text)).toEqual(['scorecard-v9.md'])
    })

    it('POSITIVE: a bare seeds/history/ form fires -- the route one segment shorter', () => {
        // seeds/history/ is prior-run outcomes. Written with its benchmark/
        // prefix the old pattern caught it; written relative to benchmark/,
        // as anyone inside that directory would write it, it escaped.
        const { text, lineStarts } = normalizeProse('prior outcomes were moved to seeds/history/')
        const hits = scanPackets(text, lineStarts)

        expect(hits.map((h) => h.text)).toEqual(['seeds/history/'])
    })

    it('POSITIVE: another scorer grade file and an unlisted root doc both fire', () => {
        const { text, lineStarts } = normalizeProse(
            'see scoring-v9/results/row-05-result.md and agent-doctor-instructions.md'
        )

        expect(scanPackets(text, lineStarts).map((h) => h.text).sort()).toEqual([
            'agent-doctor-instructions.md',
            'scoring-v9/results/row-05-result.md',
        ])
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

describe('no repository path reaches a scorer packet (issue #140)', () => {
    it('declares every committed packet set, scanned or not', () => {
        // Checked against the directories actually on disk, not against
        // itself: a literal-vs-literal comparison would keep passing if a
        // future benchmark/scoring-v10/ arrived and nobody edited this file
        // to match -- which is issue #140's own failure pattern (a human
        // catch instead of a gate) reproduced one level up, inside the guard
        // built to prevent it. Both sides sorted so the comparison is
        // order-independent.
        const onDisk = fs
            .readdirSync(SCORING)
            .filter((d) => /^scoring-v\d+$/.test(d) && fs.statSync(path.join(SCORING, d)).isDirectory())
            .sort()

        expect(onDisk).toEqual(PACKET_SETS.map((s) => s.dir).slice().sort())

        // Kept as documentation of the declared order/membership -- the
        // disk-derived assertion above is the one that has to bind.
        expect(PACKET_SETS.map((s) => s.dir)).toEqual(['scoring-v4', 'scoring-v9'])
    })

    it('holds scoring-v4 out of scope with a written reason, rather than omitting it', () => {
        // The exception is visible in the file instead of re-derived by every
        // future reader. This is a DIRECTORY-level declaration, not a
        // pattern-level exemption: the file's doctrine forbids stop-lists
        // because they are a SILENT second way to be unguarded, and a named
        // directory carrying its own reason is neither silent nor a hole
        // inside a scanned file.
        const v4 = PACKET_SETS.find((s) => s.dir === 'scoring-v4')

        expect(v4.scanned).toBe(false)
        expect(v4.why.length).toBeGreaterThan(80)
    })

    PACKET_SETS.filter((s) => s.scanned).forEach((set) => {
        const files = packetFiles(set.dir)

        it(set.dir + ' has the packet count its pass produced', () => {
            expect(files).toHaveLength(set.packets)
        })

        files.forEach((filename) => {
            it(set.dir + '/' + filename + ' states no repository path', () => {
                const { text, lineStarts } = loadPacket(set.dir, filename)
                const hits = scanPackets(text, lineStarts)

                expect(
                    hits.map(
                        (h) =>
                            set.dir + '/' + filename + ':' + h.line + '  [' + h.pattern + ']  ' +
                            h.text + '  -- ' + h.why
                    )
                ).toEqual([])
            })
        })
    })
})
