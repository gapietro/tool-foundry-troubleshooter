/**
 * v13's published ledger, recomputed from the twenty primary verdict files.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * `test/scorecardV12Tallies.test.js` was written because two false claims
 * reached `scorecard-v12.md` and §AD, and both were found by recomputing from
 * primary files rather than by reading the summaries. v13 added a pass with a
 * published ledger and did NOT add that test's counterpart -- and two false
 * claims immediately reached `scorecard-v13.md`, §AJ and CHANGELOG.md:
 *
 *   1. v12's native baseline was published as 3/10 = 30.0%. That is v4's
 *      figure (§O2). v12's native result is 6/10 = 60.0%, 51/60. Because the
 *      baseline was wrong, the DIRECTION of the headline change was reported
 *      backwards: native declined two rows, it did not improve by one.
 *   2. "eight of ten custom rows scored root_cause_layer_correct = 0" -- also
 *      v12's count. In v13 it is NINE of ten; row 12 is the sole exception,
 *      and v13's own scorecard table shows it.
 *
 * Every mechanical property of the v13 primaries was already correct. The
 * errors lived only in prose ABOUT them, which is exactly the layer no other
 * guard in this repo watches: `scorerPacketBlindRule.test.js` guards what goes
 * INTO the scorers, `packetGeneratorParity.test.js` guards the generator's
 * pattern copy, and nothing guarded what came OUT. This does, for v13.
 *
 * The v12 test is deliberately NOT parameterised into a shared helper. Two
 * independent recomputations that agree are a signal; one shared helper being
 * wrong is invisible -- the same argument `scorerPacketBlindRule.test.js` makes
 * for keeping the generator's pattern copy separate.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const BENCH = path.join(ROOT, 'benchmark')
const RESULTS = path.join(BENCH, 'scoring-v13', 'results')

const COLUMNS = [
    'root_cause_layer_correct',
    'fix_target_correct',
    'evidence_cites_trace_and_config',
    'fix_usable_unedited',
]

/** Pull one value out of a verdict's header table. */
function cell(text, column) {
    const m = text.match(new RegExp('\\|\\s*' + column + '\\s*\\|\\s*([^|]+?)\\s*\\|'))
    if (!m) throw new Error('column ' + column + ' not found in verdict')
    return m[1].trim()
}

/** Every verdict, parsed from its own file. */
const VERDICTS = fs
    .readdirSync(RESULTS)
    .filter((f) => /^row-\d+-result\.md$/.test(f))
    .sort()
    .map((f) => {
        const text = fs.readFileSync(path.join(RESULTS, f), 'utf8')
        const row = parseInt(f.match(/row-(\d+)-/)[1], 10)
        const scores = {}
        COLUMNS.forEach((c) => {
            scores[c] = parseInt(cell(text, c), 10)
        })
        return {
            row,
            file: f,
            text,
            scores,
            total: cell(text, 'total'),
            gate: parseInt(cell(text, 'passes_gate'), 10),
            ambiguous: cell(text, 'ambiguous'),
            // Odd rows are native, even are custom -- §3.1's fixed interleave.
            arm: row % 2 === 1 ? 'native' : 'custom',
        }
    })

const scorecard = fs.readFileSync(path.join(BENCH, 'scorecard-v13.md'), 'utf8')
const decision = fs.readFileSync(path.join(BENCH, 'DECISION.md'), 'utf8')
const flags = JSON.parse(fs.readFileSync(path.join(BENCH, 'v13-ambiguity-flags.json'), 'utf8'))

function arm(name) {
    const sel = VERDICTS.filter((v) => v.arm === name)
    return {
        valid: sel.length,
        gate: sel.reduce((n, v) => n + v.gate, 0),
        total: sel.reduce((n, v) => n + COLUMNS.reduce((s, c) => s + v.scores[c], 0), 0),
    }
}

describe('v13 tallies, recomputed from the primary verdicts', () => {
    it('has exactly twenty verdicts, rows 01-20', () => {
        expect(VERDICTS).toHaveLength(20)
        expect(VERDICTS.map((v) => v.row)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    })

    it('every row total equals its own column sum', () => {
        VERDICTS.forEach((v) => {
            const sum = COLUMNS.reduce((s, c) => s + v.scores[c], 0)
            expect(v.total).toBe(sum + '/6')
        })
    })

    it('applies §A2 gate expression exactly: RCL == 2 AND FUU == 1', () => {
        VERDICTS.forEach((v) => {
            const expected =
                v.scores.root_cause_layer_correct === 2 && v.scores.fix_usable_unedited === 1 ? 1 : 0
            expect({ row: v.row, gate: v.gate }).toEqual({ row: v.row, gate: expected })
        })
    })

    it("honours §A's constraint: fix_usable_unedited is never 1 while fix_target_correct is 0", () => {
        VERDICTS.forEach((v) => {
            if (v.scores.fix_target_correct === 0) {
                expect({ row: v.row, fuu: v.scores.fix_usable_unedited }).toEqual({
                    row: v.row,
                    fuu: 0,
                })
            }
        })
    })

    it('native 4/10 = 40.0% (47/60), custom 0/10 = 0.0% (5/60) — and the scorecard says so', () => {
        expect(arm('native')).toEqual({ valid: 10, gate: 4, total: 47 })
        expect(arm('custom')).toEqual({ valid: 10, gate: 0, total: 5 })

        expect(scorecard).toContain('40.0%')
        expect(scorecard).toContain('47 / 60')
        expect(scorecard).toContain('0.0%')
        expect(scorecard).toContain('5 / 60')
    })

    /**
     * The check that would have caught the published error. v12's baseline is
     * NOT recomputed here -- `scorecardV12Tallies.test.js` owns it. What is
     * asserted is that v13's prose quotes v12's real numbers and never v4's.
     */
    it('quotes v12 as the baseline, never v4 — 60.0%/51/60, not 30.0%/42/60', () => {
        ;[scorecard, decision].forEach((doc) => {
            expect(doc).toContain('60.0%')
            expect(doc).toContain('51/60')
        })
        // The negative has to distinguish ASSERTING the wrong baseline from
        // DISOWNING it -- both documents now quote "3/10 (30.0%)" inside a
        // correction note explaining that it was v4's. This is Ruling 4's
        // named-vs-discussed problem in miniature, and the same answer applies:
        // do not try to regex the difference out of prose. Pin the one sentence
        // that would carry the claim instead.
        expect(scorecard).not.toContain('Against v12 on the same seeds: native 3/10')
        expect(decision).not.toContain('Against v12 on the same seeds: native 3/10 = 30.0%')
        // v4's point total has no business in a v12 baseline sentence at all.
        expect(scorecard).not.toMatch(/v12[^.\n]{0,60}42\s*\/\s*60/)
    })

    it('says nine of ten custom rows missed root_cause_layer_correct, because nine did', () => {
        const zero = VERDICTS.filter(
            (v) => v.arm === 'custom' && v.scores.root_cause_layer_correct === 0
        )
        expect(zero).toHaveLength(9)
        // Row 12 is the sole custom row above 0 on that column.
        expect(
            VERDICTS.filter(
                (v) => v.arm === 'custom' && v.scores.root_cause_layer_correct > 0
            ).map((v) => v.row)
        ).toEqual([12])
        // Markdown emphasis can fall between the words ("**nine of ten**
        // custom rows"), so the match tolerates markers rather than assuming
        // one document's formatting.
        ;[scorecard, decision].forEach((doc) => {
            expect(doc).toMatch(/[Nn]ine of ten[*_\s]+custom rows/)
        })
        // And the count that was published first must not survive anywhere as
        // a claim about v13's custom arm.
        ;[scorecard, decision].forEach((doc) => {
            expect(doc).not.toMatch(/[Ee]ight of ten custom rows scored/)
        })
    })

    it('records zero flags, and the two flag signals agree', () => {
        // Signal 1: every header table reads no.
        VERDICTS.forEach((v) => expect({ row: v.row, a: v.ambiguous }).toEqual({ row: v.row, a: 'no' }))
        // Signal 2: no verdict emitted an `### ambiguity` section. The scorer
        // instruction required that section iff the flag was yes, so the two
        // are independent and a disagreement would be the finding.
        VERDICTS.forEach((v) => expect(v.text).not.toMatch(/^###\s+ambiguity/im))
        // Signal 3: the curated tally agrees with both.
        expect(flags.rows).toEqual({})
    })

    it('keeps the curated flag file honest about being curated', () => {
        expect(typeof flags._why).toBe('string')
        expect(typeof flags._verified).toBe('string')
        // §AI8's caveat is load-bearing on a zero and must travel with it.
        expect(typeof flags._caution).toBe('string')
        expect(flags._caution).toMatch(/in-sample/i)
    })
})
