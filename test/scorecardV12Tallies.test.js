/**
 * scorecardV12Tallies.test.js — re-derives the v12 scorecard's numbers from the
 * twenty blind-scorer verdict files and asserts the published ledger matches.
 *
 * WHY THIS EXISTS. Two false claims reached `scorecard-v12.md` and
 * `DECISION.md` §AD in the first draft of the v12 write-up, and both were found
 * by recomputing from primary files rather than by reading the summaries:
 *
 *   - `fix_usable_unedited` was called "the most frequently under-determined
 *     column, six of twelve" by counting row 13 against it. Row 13's scorer
 *     flagged `evidence_cites_trace_and_config`. The truth is a 5-5 tie.
 *   - Rows 10, 12 and 16 were grouped as having laundered a gate-forced call
 *     into a supporting citation. Only row 10 cites it; 12 and 16 cite `trace`
 *     twice, which is why both scored that column 0.
 *
 * Neither was a scoring error — the twenty verdicts were right and the gate
 * verdict never moved. Both were AUTHORING errors in the layer above, the one
 * this repo's value actually lives in. `scorerPacketBlindRule.test.js` guards
 * what goes INTO the scorers; nothing guarded what came out. This does.
 *
 * It deliberately re-derives rather than restates: every number below is
 * computed from `scoring-v12/results/row-NN-result.md` and then compared with
 * the figure the scorecard publishes, so editing one without the other fails.
 */

'use strict'

const fs = require('fs')
const path = require('path')

const BENCH = path.join(__dirname, '..', 'benchmark')
const RESULTS = path.join(BENCH, 'scoring-v12', 'results')
const REPORTS = path.join(BENCH, 'v12-reports')

const NATIVE_ROWS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
const CUSTOM_ROWS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]

const COLUMNS = [
    'root_cause_layer_correct',
    'fix_target_correct',
    'evidence_cites_trace_and_config',
    'fix_usable_unedited',
]

function pad(n) {
    return String(n).padStart(2, '0')
}

/** One verdict file, parsed from its own result table. */
function verdict(n) {
    const text = fs.readFileSync(path.join(RESULTS, 'row-' + pad(n) + '-result.md'), 'utf8')
    const cell = (key) => {
        const m = text.match(new RegExp('\\|\\s*' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\|\\s*([^|]+?)\\s*\\|'))
        if (!m) throw new Error('row ' + pad(n) + ': no table cell for ' + key)
        return m[1].trim()
    }
    const out = { row: n, text: text }
    COLUMNS.forEach((c) => {
        out[c] = Number(cell(c))
    })
    out.total = Number(cell('total').split('/')[0])
    out.passes_gate = cell('passes_gate')
    out.ambiguous = cell('ambiguous')
    return out
}

const ALL = NATIVE_ROWS.concat(CUSTOM_ROWS)
    .sort((a, b) => a - b)
    .map(verdict)
const byRow = {}
ALL.forEach((v) => {
    byRow[v.row] = v
})

const scorecard = fs.readFileSync(path.join(BENCH, 'scorecard-v12.md'), 'utf8')

function armOf(rows) {
    const vs = rows.map((n) => byRow[n])
    return {
        valid: vs.filter((v) => v.passes_gate !== 'void').length,
        gate: vs.filter((v) => v.passes_gate === '1').length,
        total: vs.reduce((a, v) => a + v.total, 0),
    }
}

describe('v12 scorecard — every published number re-derived from the verdict files', () => {
    test('all twenty verdicts exist and parse', () => {
        expect(ALL).toHaveLength(20)
        ALL.forEach((v) => {
            expect(['0', '1', 'void']).toContain(v.passes_gate)
            expect(['yes', 'no']).toContain(v.ambiguous)
        })
    })

    test('each row total equals the sum of its own four columns', () => {
        ALL.forEach((v) => {
            const sum = COLUMNS.reduce((a, c) => a + v[c], 0)
            expect({ row: v.row, total: v.total }).toEqual({ row: v.row, total: sum })
        })
    })

    test('§A2 gate expression applied exactly: rc==2 AND fu==1, nothing else', () => {
        ALL.forEach((v) => {
            if (v.passes_gate === 'void') return
            const expected = v.root_cause_layer_correct === 2 && v.fix_usable_unedited === 1 ? '1' : '0'
            expect({ row: v.row, gate: v.passes_gate }).toEqual({ row: v.row, gate: expected })
        })
    })

    test("§A2's decoy constraint holds: never fu==1 while ft==0", () => {
        ALL.forEach((v) => {
            if (v.fix_target_correct === 0) {
                expect({ row: v.row, fu: v.fix_usable_unedited }).toEqual({ row: v.row, fu: 0 })
            }
        })
    })

    test('native 6/10 = 60.0%, custom 0/10 = 0.0% — and the scorecard says so', () => {
        const native = armOf(NATIVE_ROWS)
        const custom = armOf(CUSTOM_ROWS)

        expect(native).toEqual({ valid: 10, gate: 6, total: 51 })
        expect(custom).toEqual({ valid: 10, gate: 0, total: 9 })

        expect(scorecard).toContain('**6**')
        expect(scorecard).toContain('**60.0%**')
        expect(scorecard).toContain('**0.0%**')
        expect(scorecard).toContain('51/60')
        expect(scorecard).toContain('9/60')
    })

    test('zero void rows, so §A3.4\'s 8-valid-row floor was never approached', () => {
        expect(ALL.filter((v) => v.passes_gate === 'void')).toHaveLength(0)
    })

    test('AC-2: custom scored root_cause_layer_correct = 0 on exactly 8 of 10', () => {
        const zeros = CUSTOM_ROWS.filter((n) => byRow[n].root_cause_layer_correct === 0)

        // Exactly 8 — one row from AC-2's <=7 refutation threshold. Rows 14 and
        // 20 scored 2, and the scorecard must not round that away.
        expect(zeros).toHaveLength(8)
        expect(CUSTOM_ROWS.filter((n) => byRow[n].root_cause_layer_correct === 2)).toEqual([14, 20])
    })

    test('AC-5: exactly 8 of 20 rows returned ambiguous = no', () => {
        expect(ALL.filter((v) => v.ambiguous === 'no')).toHaveLength(8)
        expect(scorecard).toContain('**8** of 20')
    })

    test('AC-4: seed 05 native passed 2 of 2 and custom 0 of 2', () => {
        expect([17, 19].filter((n) => byRow[n].passes_gate === '1')).toHaveLength(2)
        expect([18, 20].filter((n) => byRow[n].passes_gate === '1')).toHaveLength(0)
    })

    // ---------------------------------------------------------------------
    // The two claims that were WRONG in the first draft. Both are now derived.
    // ---------------------------------------------------------------------

    test('the ambiguity flag tally is a 5-5 tie, not a fix_usable_unedited superlative', () => {
        // The attribution is CURATED, not parsed. Each verdict's `### ambiguity`
        // section argues BOTH readings of its column, so every column name
        // appears in the prose and no regex can distinguish "named as
        // under-determined" from "discussed". Trying anyway is what produced the
        // original miscount. `v12-ambiguity-flags.json` is the single source; the
        // job here is to bind it to the derived facts and to both write-ups.
        const flags = JSON.parse(fs.readFileSync(path.join(BENCH, 'v12-ambiguity-flags.json'), 'utf8')).rows

        // 1. It covers exactly the rows the verdict files flag — no more, no fewer.
        const flaggedRows = Object.keys(flags).map(Number).sort((a, b) => a - b)
        const derivedRows = ALL.filter((v) => v.ambiguous === 'yes').map((v) => v.row)
        expect(flaggedRows).toEqual(derivedRows)

        // 2. Every named column is a real rubric column, and none is named twice
        //    for the same row.
        Object.keys(flags).forEach((row) => {
            flags[row].forEach((c) => expect(COLUMNS).toContain(c))
            expect(flags[row].length).toBe(new Set(flags[row]).size)
        })

        // 3. The tally: a 5-5 tie, 14 flags across 12 rows.
        const count = (c) => Object.keys(flags).filter((r) => flags[r].indexOf(c) !== -1).length
        expect(count('fix_usable_unedited')).toBe(5)
        expect(count('evidence_cites_trace_and_config')).toBe(5)
        expect(count('root_cause_layer_correct')).toBe(2)
        expect(count('fix_target_correct')).toBe(2)
        expect(Object.keys(flags).reduce((a, r) => a + flags[r].length, 0)).toBe(14)

        // 4. Row 13 is the row the first draft mis-attributed. Pinned by name so
        //    the specific error cannot come back.
        expect(flags['13']).toEqual(['evidence_cites_trace_and_config'])

        // 5. Both write-ups must state the tie. Deliberately a POSITIVE
        //    assertion: an earlier version of this test banned the retracted
        //    phrase, and it tripped on the corrections themselves, which quote
        //    the old wording verbatim because this repo retains retracted
        //    claims rather than deleting them. A phrase ban fights that
        //    discipline; binding the published figure to the curated source
        //    does not.
        const decision = fs.readFileSync(path.join(BENCH, 'DECISION.md'), 'utf8')
        expect(scorecard).toContain('five rows each')
        expect(decision).toContain('five rows each')
    })

    test('only row 10 cited its gate-forced call — rows 12 and 16 cite trace twice', () => {
        // The §AD4 outcome table claimed 10, 12 and 16 all laundered the forced
        // call into a supporting citation. The reports refute it for two of them.
        const sources = (n) => {
            const rep = JSON.parse(fs.readFileSync(path.join(REPORTS, 'row-' + pad(n) + '.md'), 'utf8'))
            return (rep.root_causes || []).map((rc) => (rc.evidence || []).map((e) => e.source))
        }

        expect(sources(10)).toEqual([['trace', 'schema']])
        expect(sources(12)).toEqual([['trace', 'trace']])
        expect(sources(16)).toEqual([['trace', 'trace']])

        // Which is exactly why 12 and 16 scored the evidence column 0 and 10 did not.
        expect(byRow[10].evidence_cites_trace_and_config).toBe(1)
        expect(byRow[12].evidence_cites_trace_and_config).toBe(0)
        expect(byRow[16].evidence_cites_trace_and_config).toBe(0)
    })
})
