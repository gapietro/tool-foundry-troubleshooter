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
 * WHAT THIS GUARD COVERS, AND WHAT IT DOES NOT
 * ---------------------------------------------------------------------------
 * The rule binds three channels (benchmark/README.md, "The scorer blind
 * rule"). This guard scans two of them -- SEED SPECS and RUBRIC. PACKETS is
 * not one of the rule's three channels; it is a separate artefact the
 * channels are assembled into, scanned here for a different concern (a
 * repository PATH, not a prior run's outcome). Three pattern lists below,
 * one per row, because uniform treatment of "what this file scans" still
 * needs a list entry for the non-channel artefact:
 *
 *   SEED SPECS   PATTERNS         bans a prior run's OUTCOME
 *   PACKETS      PACKET_PATTERNS  bans a repository PATH
 *   RUBRIC       RUBRIC_PATTERNS  bans a prior pass's outcome or provenance,
 *                + 4 patterns       a repository path, and -- via those 4
 *                  borrowed from     borrowed patterns -- a seed-spec-shaped
 *                  PATTERNS          leak reaching the rubric
 *                + PACKET_PATTERNS  see RUBRIC_PATTERNS' own doc comment for
 *                                    the exact three-source composition
 *
 * The rubric channel is benchmark/scorecard-template.md §A/§A2/§A3 -- the
 * slice copied into EVERY packet, so a leak there reaches every row of a pass
 * at once. It was previously unscanned on a cost/benefit judgement: the
 * section legitimately explains grading with score-shaped text ("a run can
 * score 3/6 and pass"), so a naive scan reddens on guidance. That judgement
 * was once written up as though score-shaped text in the rubric were only
 * ever legitimate guidance; #139 falsified it -- a §A2.1 preamble shipped
 * into the slice carrying a prior pass's grades and two decision-record
 * section pointers, and no guard could have fired. #143 scanned it, with the
 * patterns scoped to the channel rather than borrowed whole. See
 * RUBRIC_PATTERNS for what is deliberately absent and why.
 *
 * The RUN-REPORT channel is per-row prose written fresh each pass. It is
 * bound by the rule and is NOT scanned here, so it remains a hand check.
 *
 * A passing suite is not evidence of blindness; it is evidence the declared
 * patterns did not fire.
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
        why: 'Built path-clean by hand (§T7) and kept that way by this scan.',
    },
    {
        dir: 'scoring-v12',
        packets: 20,
        scanned: true,
        why:
            'The current pass (§AC). Unlike v9 these packets are generated rather than ' +
            'hand-built: scripts/build-v12-packets.js redacts paths mechanically and then ' +
            're-scans every emitted packet with a copy of the patterns below, refusing to ' +
            'write anything if one survives. That copy is deliberate rather than an import -- ' +
            'two independent copies disagreeing is a signal, one shared copy being wrong is ' +
            'invisible. This scan is still the binding check, because the generator could be ' +
            'edited and this cannot be.',
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
 * The directory stems this repository actually uses, as regex alternatives.
 * Named because the rule below interpolates them twice -- once for the
 * "stem/..." form and once for the "../stem" form -- and two copies of a
 * fifteen-item list is two places to forget an entry.
 */
const PATH_STEMS =
    'benchmark|docs|src|test|seed-app|node_modules|dist|\\.claude|\\.superpowers|' +
    'seeds|history|results|scoring-v[0-9]+|' +
    'scorecard-[A-Za-z0-9_-]+|raw-evidence-[A-Za-z0-9_-]+'

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
        // Three alternations, each closing a route measured to be walkable:
        //   1. a stem followed by a slash and ZERO OR MORE path characters.
        //      The "zero or more" is #144: the first shipped version required
        //      one or more, so "the packets are in scoring-v9/" -- a complete
        //      route -- did not match. Measured on that version: scoring-v9/,
        //      results/ and ../results all returned NO HIT.
        //   2. a ./ or ../ prefix followed by a bare stem with no trailing
        //      slash. Alternation 1 cannot reach this because there is no
        //      slash after the stem to anchor on.
        //   3. ANY bare markdown filename. This started as an eight-name
        //      root-level list and was widened in the #139 review: a
        //      whitelist of eight names missed scorecard-v9.md (the literal
        //      per-row answer key), raw-evidence-v9-scored-pass.md and
        //      agent-doctor-instructions.md, and both leaks §T7 found by hand
        //      escape it if written one directory segment shorter.
        //
        // A bare stem WORD with no slash deliberately does NOT match --
        // "the results were mixed" is prose, not a route -- which is the
        // boundary the #144 negative control pins.
        //
        // Residue, stated rather than left to be re-derived: a NON-markdown
        // file outside these stems (a top-level package.json, say) is still
        // not matched. The answer keys in this project are all markdown and
        // the stem list covers every route to them found so far.
        //
        // Measured after this widening: the twelve committed v9 packets scan
        // 0, unchanged from before it, so nothing here was tightened back for
        // a false positive.
        // The third alternation's extension is matched case-insensitively
        // ([mM][dD], not a literal .md) -- M4: the .md alternation used to be
        // case-sensitive while the seed-spec channel's /DECISION\.md/i was
        // not, so a bare DECISION.MD escaped this pattern alone. Scoped to
        // the extension only, so PATH_STEMS stays case-sensitive as written.
        re: new RegExp(
            '(?:(?:\\.{0,2}\\/)*(?:' + PATH_STEMS + ')\\/[A-Za-z0-9_./-]*)' +
                '|(?:(?:\\.{1,2}\\/)+(?:' + PATH_STEMS + ')\\b)' +
                '|\\b[A-Za-z0-9_-]+\\.[mM][dD]\\b'
        ),
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
function scanWith(patterns, text, lineStarts, indexOffset) {
    // Offset for callers that scan a SLICE of a normalized document (the
    // rubric channel does). Match indices are relative to the slice; line
    // numbers must stay relative to the file, or a failure points at a line
    // that does not exist in the source the reader opens.
    const offset = indexOffset || 0
    const hits = []

    patterns.forEach((p) => {
        const re = new RegExp(p.re.source, p.re.flags.replace('g', '') + 'g')
        let m
        while ((m = re.exec(text)) !== null) {
            hits.push({
                pattern: p.name,
                why: p.why,
                line: lineAt(lineStarts, m.index + offset),
                text: m[0],
            })
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

// ---------------------------------------------------------------------------
// THE RUBRIC CHANNEL (issue #143)
// ---------------------------------------------------------------------------
const TEMPLATE = path.join(SCORING, 'scorecard-template.md')

/**
 * The packet-reaching slice of the rubric, as offsets into the WHOLE
 * normalized template.
 *
 * Only §A/§A2/§A3 are copied into a scorer packet, so the scanned range runs
 * from the `## A.` heading to the `## B.` heading. Derived from the headings
 * at scan time and never hardcoded to line numbers, which move.
 *
 * This pins the template's heading structure into a test, which is the
 * objection this file previously recorded against scanning the channel at
 * all. It is the right trade rather than a cost: the PACKET BUILD depends on
 * the same two headings, so a rename that breaks this scan is a rename that
 * changes what ships to twelve scorers. Failing loudly is the correct
 * response.
 *
 * Returns the whole file's text and line map alongside the offsets, because
 * line numbers reported by a scan of the slice must still name lines in the
 * file.
 */
function rubricRange() {
    const { text, lineStarts } = normalizeProse(fs.readFileSync(TEMPLATE, 'utf8'))

    const start = text.indexOf('## A. ')
    const end = text.indexOf('## B. ')

    // A renamed or removed heading must fail LOUDLY. indexOf returns -1 on a
    // miss, and slice(-1, -1) is an EMPTY string that scans clean -- both
    // content scans would go green on nothing, with only the derivation
    // assertion (expect(start).toBeGreaterThan(-1)) left to notice.
    if (start < 0 || end <= start) {
        throw new Error(
            'rubricRange(): "## A. " / "## B. " headings not found (or out of order) in ' + TEMPLATE
        )
    }

    return {
        text: text,
        lineStarts: lineStarts,
        start: start,
        end: end,
    }
}

/** Number words this rubric uses, plus digits. Interpolated twice below. */
const COUNT = '\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve'

/**
 * The rubric channel's pattern list -- the THIRD, kept separate for the same
 * reason PACKET_PATTERNS is separate from PATTERNS: the channels ban
 * different things and scan different files.
 *
 * This is not the stop-list the doctrine at the top of this file forbids.
 * That doctrine bans carve-outs INSIDE a list, which are invisible at the
 * point of failure. A separate list per channel is visible here, carries its
 * own written reason, and is already how PACKET_PATTERNS exists.
 *
 * WHAT IS DELIBERATELY ABSENT: `rubric-fraction`. It fires TEN times on
 * legitimate Task 12 band guidance in this range -- ten, across the two band
 * tables and the §A2 hypothetical, among them `≥ 8/10`, `5–7/10`, `< 5/10`,
 * and "a run can score 3/6 and pass; a run can score 4/6 and fail".
 * The alternative considered and rejected was rewriting the range to be
 * fraction-free so the pattern could apply unchanged; that takes out the one
 * sentence explaining why the gate is not the total, which is lobotomising
 * the packet rather than redacting the leak -- the exact distinction the
 * seed-04 negative control above exists to protect. Coverage is not lost: the
 * #139 leak's "6/6 and 0/6" sits in the same sentence as "moved a whole arm".
 *
 * Residue, stated rather than left to be re-derived: a bare fraction with NO
 * scoring verb and NO run-noun nearby is caught by nothing in RUBRIC_SCAN.
 * Worked example, verified: "the §A2 arm came out 0/6 last time" -- §A2 is a
 * self-reference so outside-section-pointer does not fire on it,
 * scored-a-number requires the literal word "scored", and prior-pass-reference
 * has "last" but its noun list is pass|run|round|scorer -- "time" is not in
 * it. A narrowed fraction pattern (one requiring an adjacent past-tense
 * outcome verb) would close this and was measured clean against all ten
 * legitimate fractions above; it was considered and deliberately NOT shipped,
 * because it would be reverse-engineered from a constructed sentence rather
 * than a real incident -- the exact weakness recorded as #1 below for
 * `verdict-moved`. The coverage argument two paragraphs up ("the #139 leak's
 * `6/6 and 0/6` sits in the same sentence as `moved a whole arm`") argues from
 * the one incident these patterns were derived from; it does not close this
 * shape, and is not an implied guarantee that it does.
 *
 * FOUR WEAKNESSES, recorded rather than glossed:
 *   1. `verdict-moved` is reverse-engineered from the one incident available.
 *      It bans a real shape -- what a prior pass's score did to the verdict --
 *      but nothing establishes it generalises.
 *   2. `credit-awarded` (borrowed, below) sits ONE WORD from a false positive:
 *      the rubric says "to award *partial* credit" and the pattern requires
 *      "awarded".
 *   3. `counted-rows` near-misses "two of the four rubric columns", surviving
 *      only because its noun list stops at runs|rows|passes.
 *   4. The bare-fraction residue documented above is not covered, and the
 *      coverage argument for excluding `rubric-fraction` rests on the single
 *      incident the patterns were built from.
 * Both near-misses are pinned as negative controls. Per the doctrine above, a
 * pattern that reddens on real guidance is fixed by writing a better pattern.
 */
const RUBRIC_PATTERNS = [
    {
        name: 'outside-section-pointer',
        // EVERY § in the whole §A->§B range is a self-reference: §A, §A2,
        // §A2.1, and nothing else. A pointer anywhere else is a pointer OUT
        // of the packet, into a document the scorer does not have -- which is
        // exactly what #139's two bare §O5/§T5 pointers were. §B is rejected
        // too, correctly: a packet ends at §A3.
        //
        // Residue, stated rather than left to be re-derived: "§ O5" -- a
        // space between the mark and the section id -- escapes this pattern.
        // The regex requires an alnum/dot immediately after §; a space there
        // means the pattern never matches at all, so the negative lookahead
        // is never reached to reject or admit it. Verified, not observed in
        // the range today.
        re: /§(?!A[0-9.]*\b)[A-Za-z0-9.]+/,
        why:
            'a section pointer out of the rubric and into the decision record, which a ' +
            'MODEL scorer can follow into every prior pass rows and grades',
    },
    {
        name: 'counted-rows',
        re: new RegExp(
            '\\b(?:' + COUNT + ')\\s+of\\s+(?:the\\s+)?(?:' + COUNT + ')?\\s*(?:runs?|rows?|passes)\\b',
            'i'
        ),
        why: 'how many prior rows or runs did something -- "nine of twelve rows flagged ambiguous"',
    },
    {
        name: 'prior-pass-reference',
        re: /\b(?:prior|previous|earlier|last)\s+(?:pass(?:es)?|runs?|rounds?|scorers?)\b|\bpass(?:es)?\s+(?:later|earlier|ago)\b/i,
        why: 'the provenance vocabulary of an earlier pass -- "three passes later", "a prior run"',
    },
    {
        name: 'verdict-moved',
        re: /\b(?:moved|swung|flipped|shifted)\s+(?:a|an|the)\s+(?:whole\s+|entire\s+)?(?:arm|verdict|gate|pass)\b/i,
        why: 'what a prior pass score did to the verdict -- "moved a whole arm between 6/6 and 0/6"',
    },
]

/**
 * The four spec-channel patterns that are inert on this range today, borrowed
 * by name so the two lists cannot silently drift apart. They cost nothing
 * measured and they cover the seed-spec-shaped leak -- "run 2 named...",
 * "earning full credit" -- if that prose ever migrates into the rubric.
 *
 * `rubric-fraction` and `answer-key-pointer` are the two NOT borrowed: the
 * first per the note above, the second because PACKET_PATTERNS already bans
 * every markdown filename including DECISION.md, so borrowing it would double
 * every hit.
 */
const BORROWED_FOR_RUBRIC = ['scored-a-number', 'scored-runs-or-rows', 'run-N-did', 'credit-awarded']

/**
 * The rubric range is scanned for BOTH an outcome and a path. The path half
 * is PACKET_PATTERNS itself rather than a copy, so the #144 widening reaches
 * this channel automatically.
 */
const RUBRIC_SCAN = RUBRIC_PATTERNS.concat(
    PATTERNS.filter((p) => BORROWED_FOR_RUBRIC.indexOf(p.name) !== -1)
).concat(PACKET_PATTERNS)

/** Every hit of every rubric-channel pattern in the slice [start, end). */
function scanRubric(text, lineStarts, start, end) {
    return scanWith(RUBRIC_SCAN, text.slice(start, end), lineStarts, start)
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

    it('POSITIVE: an upper-cased extension fires (M4) -- DECISION.MD is not a different file', () => {
        // The bare-filename alternation used to be case-sensitive on the
        // extension (`.md` only), so DECISION.MD escaped this pattern even
        // though the spec channel's /DECISION\.md/i would have caught the
        // same string. Scoped to [mM][dD] so this route closes without
        // widening PATH_STEMS to match case-insensitively too.
        const { text, lineStarts } = normalizeProse('cross-check against DECISION.MD before grading')
        const hits = scanPackets(text, lineStarts)

        expect(hits.map((h) => h.text)).toEqual(['DECISION.MD'])
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

    it('POSITIVE: a reference that stops at a directory stem fires (#144)', () => {
        // "the packets are in scoring-v9/" was a walkable route the first
        // shipped version of this rule missed: its path alternation required
        // at least one character after the slash, so a reference that stops
        // at the stem escaped. Measured on the pre-#144 regex: no hit.
        const { text, lineStarts } = normalizeProse('the packets are in scoring-v9/ and results/')

        expect(scanPackets(text, lineStarts).map((h) => h.text).sort()).toEqual([
            'results/',
            'scoring-v9/',
        ])
    })

    it('POSITIVE: a relative reference with no trailing slash fires (#144)', () => {
        // ../results is the same route written from inside a sibling
        // directory. It has no trailing slash for the first alternation to
        // anchor on, which is why the rule needs a prefix-form alternation.
        const { text, lineStarts } = normalizeProse('grades live in ../results')

        expect(scanPackets(text, lineStarts).map((h) => h.text)).toEqual(['../results'])
    })

    it('POSITIVE: the .superpowers workspace stem fires (#144)', () => {
        // Review artefacts live here. It was absent from the stem list.
        const { text, lineStarts } = normalizeProse('see .superpowers/sdd/v9-pass/ for the review')

        expect(scanPackets(text, lineStarts).map((h) => h.text)).toEqual(['.superpowers/sdd/v9-pass/'])
    })

    it('NEGATIVE: a bare stem WORD with no slash does not fire (#144)', () => {
        // The widening must not turn every occurrence of "results" or "test"
        // in ordinary prose into a hit. The slash is what makes it a route.
        const { text, lineStarts } = normalizeProse('the results were mixed and test results matter')

        expect(scanPackets(text, lineStarts)).toEqual([])
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
        expect(PACKET_SETS.map((s) => s.dir)).toEqual(['scoring-v4', 'scoring-v9', 'scoring-v12'])
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

describe('the rubric channel reaches every packet and is scanned (issue #143)', () => {
    it('borrows exactly the four spec patterns it names, by resolved identity', () => {
        // A typo in BORROWED_FOR_RUBRIC would silently drop a pattern: filter
        // returns a shorter array and no one notices. Compare resolved names,
        // not the literal list against itself.
        const borrowed = PATTERNS.filter((p) => BORROWED_FOR_RUBRIC.indexOf(p.name) !== -1)

        expect(borrowed.map((p) => p.name).sort()).toEqual([
            'credit-awarded',
            'run-N-did',
            'scored-a-number',
            'scored-runs-or-rows',
        ])
        expect(RUBRIC_SCAN).toHaveLength(RUBRIC_PATTERNS.length + 4 + PACKET_PATTERNS.length)
    })

    it('derives the packet-reaching range from its own headings', () => {
        const { text, start, end } = rubricRange()

        expect(start).toBeGreaterThan(-1)
        expect(end).toBeGreaterThan(start)

        // §A2.1 must fall inside the range. test/rubricClauses.test.js pins
        // the same placement for a different reason -- that a clause outside
        // §A/§A2/§A3 is a clause the scorers never see. Two tests, one
        // invariant, independent derivations.
        const slice = text.slice(start, end)
        expect(slice).toContain('### A2.1')
    })

    it('states no repository path -- the range ships to twelve scorers', () => {
        // The four paths this range used to carry were removed by hand at
        // PACKET BUILD time (scoring-v9/packet-build-report.md §7.2, four
        // substitutions each asserted to match exactly once). That assertion
        // is real, but it lives in the builder rather than in the suite, and
        // it is path-only -- it did not see the #139 prose leak at all.
        // Reworded at source so the builder no longer has to.
        const { text, lineStarts, start, end } = rubricRange()
        const hits = scanWith(PACKET_PATTERNS, text.slice(start, end), lineStarts, start)

        expect(
            hits.map(
                (h) => 'scorecard-template.md:' + h.line + '  [' + h.pattern + ']  ' + h.text
            )
        ).toEqual([])
    })

    it('POSITIVE: the paragraph that actually leaked is caught, four ways', () => {
        // Verbatim from 253de7f, the §A2.1 preamble removed by the #142 final
        // review. It shipped nowhere -- it was caught by a reviewer reading a
        // diff -- but it was in the file, and benchmark/README.md lists this
        // range as reaching every packet.
        //
        // Pinned by DISTINCT PATTERN NAME, not by hit count: if a later edit
        // leaves only one pattern matching, this must fail rather than stay
        // green on a single point of failure.
        const { text, lineStarts } = normalizeProse(
            "*Added 2026-08-07, issue #139.* §O5 filed this gap and nothing closed it; §T5\n" +
                'measured the cost three passes later — **nine of twelve rows flagged\n' +
                '`ambiguous`**, against a prediction of at most two, and the flag landed on this\n' +
                "column. Because `fix_usable_unedited` is one of §A2's two gate terms, an\n" +
                'under-determined reading of it moved a whole arm between 6/6 and 0/6.'
        )
        const hits = scanRubric(text, lineStarts, 0, text.length)

        expect(hits.map((h) => h.pattern).filter((n, i, a) => a.indexOf(n) === i).sort()).toEqual([
            'counted-rows',
            'outside-section-pointer',
            'prior-pass-reference',
            'verdict-moved',
        ])
        expect(hits.map((h) => h.text).sort()).toEqual([
            'moved a whole arm',
            'nine of twelve rows',
            'passes later',
            '§O5',
            '§T5',
        ])
    })

    it('NEGATIVE: the rubric self-references do not fire', () => {
        // Every § in the whole range points at §A, §A2 or §A2.1. That is what
        // makes outside-section-pointer viable at all -- a pointer anywhere
        // else is a pointer out of the packet, into a document the scorer
        // does not have. §B is correctly rejected too: a packet ends at §A3.
        const { text, lineStarts } = normalizeProse(
            "see §A2.1 for the two cases, §A2's gate expression and §A's constraint"
        )

        expect(scanRubric(text, lineStarts, 0, text.length)).toEqual([])
    })

    it('NEGATIVE: the Task 12 band guidance does not fire', () => {
        // This is why rubric-fraction is not in this channel's list. The
        // fractions here are the gate bands and §A2's hypothetical guidance,
        // which the blind rule explicitly permits -- it forbids what a prior
        // run was AWARDED, not the vocabulary of grading.
        const { text, lineStarts } = normalizeProse(
            'A run can score 3/6 and pass; a run can score 4/6 and fail. The bands are ' +
                '`≥ 8/10`, `5–7/10` and `< 5/10`.'
        )

        expect(scanRubric(text, lineStarts, 0, text.length)).toEqual([])
    })

    it('I4: PATTERNS\' rubric-fraction still fires on the real range -- the exclusion above holds only while this does', () => {
        // The exclusion of rubric-fraction from RUBRIC_SCAN is justified by
        // an argument that is TRUE TODAY, not true forever: it fires 10x on
        // legitimate Task 12 band guidance in this range (DECISION.md §AA2).
        // If a future rewrite ever makes §A2/§A3 fraction-free, the exclusion
        // survives unnoticed and the channel is silently unguarded against
        // exactly the leak shape #139 contained ("6/6 and 0/6"). This test
        // is what forces a re-justification instead of a silent bit-rot: if
        // it goes red, do not delete it -- either restore fraction-shaped
        // guidance or re-examine whether rubric-fraction should be included.
        //
        // Asserts `> 0`, not the measured count (10), deliberately: pinning
        // 10 would fail on any legitimate rubric edit that adds or removes
        // one band example, which is a different failure than the one this
        // test exists to catch. The invariant that matters here is "the
        // exclusion is still justified", not "the count never moves".
        const rubricFraction = PATTERNS.find((p) => p.name === 'rubric-fraction')
        const { text, lineStarts, start, end } = rubricRange()
        const hits = scanWith([rubricFraction], text.slice(start, end), lineStarts, start)

        expect(hits.length).toBeGreaterThan(0)
    })

    it('NEGATIVE: two near-misses on legitimate guidance stay clean', () => {
        // Both sit ONE WORD from firing, and both are guidance a scorer needs.
        // Pinned so a future widening that would take them fails here instead
        // of quietly redacting the rubric.
        //   - credit-awarded requires "awarded"; the rubric says "to award".
        //   - counted-rows stops its noun list at runs|rows|passes; the rubric
        //     says "two of the four rubric COLUMNS".
        const { text, lineStarts } = normalizeProse(
            'instructs the scorer to award *partial* credit for naming "inactive", and ' +
                'names exactly two of the four rubric columns.'
        )

        expect(scanRubric(text, lineStarts, 0, text.length)).toEqual([])
    })

    it('scans ONLY the packet-reaching range, and reports file-absolute lines', () => {
        // Two properties in one control, because they fail the same way -- a
        // scan that silently reads the wrong span reports plausible line
        // numbers for text no scorer ever sees.
        const synthetic = [
            '# Scorecard template', // 1
            '', // 2
            'Copy this file per §T5, the prior reading.', // 3  <- OUTSIDE the range
            '', // 4
            '## A. The 6-point rubric', // 5
            '', // 6
            'see §O5 for how this was decided', // 7  <- INSIDE the range
            '', // 8
            '## B. Four further columns', // 9
            '', // 10
            'and §Z9 down here', // 11 <- OUTSIDE the range
        ].join('\n')

        const { text, lineStarts } = normalizeProse(synthetic)
        const hits = scanRubric(text, lineStarts, text.indexOf('## A. '), text.indexOf('## B. '))

        expect(hits.map((h) => h.text)).toEqual(['§O5'])
        expect(hits[0].line).toBe(7)
    })

    it('states no prior pass outcome -- the real file', () => {
        const { text, lineStarts, start, end } = rubricRange()
        const hits = scanRubric(text, lineStarts, start, end)

        expect(
            hits.map(
                (h) =>
                    'scorecard-template.md:' + h.line + '  [' + h.pattern + ']  ' +
                    h.text + '  -- ' + h.why
            )
        ).toEqual([])
    })

    it('the README guard roster names every channel this file scans', () => {
        // #144 item 2: the roster described only the seed-spec channel, two
        // guard generations after the packet channel landed. A roster that
        // does not match the guard is how the next reader mis-scopes a change,
        // so it is pinned rather than trusted.
        const readme = fs.readFileSync(path.join(SCORING, 'README.md'), 'utf8')

        expect(readme).toContain('scorer-facing seed specs')
        expect(readme).toContain('repository paths')
        expect(readme).toContain("Two of the rule's three channels are now scanned")

        // I1: the roster TABLE ROWS themselves, not only the narrative prose
        // below the table. A review deleted both new rows from the table and
        // re-ran the suite: 48/48 stayed green, because every toContain
        // check above lives in the paragraph below the table, not in it. A
        // wholesale revert of this file is caught by other assertions in
        // this file; a targeted roster-row edit -- the realistic drift -- was
        // not, despite CHANGELOG.md and the plan both claiming "pinned by a
        // test". These two bind the literal rows.
        expect(readme).toContain(
            '| `test/scorerPacketBlindRule.test.js` | **repository paths** reaching a committed scorer packet | #140 |'
        )
        expect(readme).toContain(
            "| `test/scorerPacketBlindRule.test.js` | **a prior pass's outcome or provenance, and repository paths**, reaching the rubric slice | #143 |"
        )

        // The three sentences that became FALSE when the rubric scan landed.
        expect(readme).not.toContain('The guard scans the seed specs — one of the three channels.')
        expect(readme).not.toContain('does the same for the 5 seed specs')

        // M3: matched on a whitespace-collapsed fragment, anchored on "rubric
        // channel" specifically. The literal 'is not\nmachine-scanned' this
        // replaced was coupled to hard-wrap position: a benign reflow of the
        // (still-true, still-present) run-report sentence below -- which
        // legitimately carries the same "is not machine-scanned" words --
        // would have reddened this spuriously, and the false claim
        // reintroduced on a single line would have evaded it entirely.
        const collapsedReadme = readme.replace(/\s+/g, ' ')
        expect(collapsedReadme).not.toMatch(
            /rubric channel is bound by the rule and is not machine-scanned/i
        )
    })
})
