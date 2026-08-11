/**
 * packetGeneratorPassSelection.test.js — the generator must build ANY pass's
 * packets from one code path, and must not be able to build one pass's packets
 * out of another pass's inputs.
 *
 * WHY THIS EXISTS. `build-packets.js` was `build-v12-packets.js` and hardcoded
 * `scoring-v12`, `v12-reports`, `v12-rows.json` and `v12-advance-rulings.json`.
 * DECISION.md §AI7 item 12 records what that cost: the v13 pre-registration
 * named `scoring-v13/` as an artefact while no tool on disk could produce it,
 * and §AI6 forbids touching packets until all twenty runs have terminated — so
 * the operator would have discovered the gap after an hour of instance time, at
 * the one moment the protocol says not to improvise.
 *
 * The fix is parameterisation, NOT a forked copy. The generator is the blind-rule
 * boundary and the redaction layer; two copies drifting apart would make v12's
 * 8-of-20 and v13's tally incomparable with nothing to flag it — the shape of
 * §AD3's miscount. One code path, the pass as data.
 *
 * The default stays `v12` deliberately. v12's packets are dispatched, scored
 * evidence and `packetGeneratorParity.test.js` drives the freeze guard through
 * `main(['--out', tmp])` with no pass argument; a required flag would have
 * changed v12's reproducibility to buy nothing.
 */

'use strict'

const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const BENCH = path.join(ROOT, 'benchmark')
const gen = require(path.join(BENCH, 'scripts', 'build-packets.js'))

describe('pass selection', () => {
    test('the default pass is v12, and it resolves the dispatched directories', () => {
        const p = gen.resolvePaths()
        expect(p.pass).toBe('v12')
        expect(p.out).toBe(path.join(BENCH, 'scoring-v12'))
        expect(p.reports).toBe(path.join(BENCH, 'v12-reports'))
        expect(p.rows).toBe(path.join(BENCH, 'v12-rows.json'))
        expect(p.rulings).toBe(path.join(BENCH, 'v12-advance-rulings.json'))
    })

    test('--pass v13 resolves every one of the four inputs to v13', () => {
        // All four move together or the generator silently mixes passes — v13
        // rows against v12 rulings would ship a seed-05 ruling written for a
        // different pass, which is #160's failure mode wearing a new hat.
        const p = gen.resolvePaths('v13')
        expect(p.pass).toBe('v13')
        expect(p.out).toBe(path.join(BENCH, 'scoring-v13'))
        expect(p.reports).toBe(path.join(BENCH, 'v13-reports'))
        expect(p.rows).toBe(path.join(BENCH, 'v13-rows.json'))
        expect(p.rulings).toBe(path.join(BENCH, 'v13-advance-rulings.json'))
    })

    test('no pass can resolve onto another pass\'s output directory', () => {
        const v12 = gen.resolvePaths('v12')
        const v13 = gen.resolvePaths('v13')
        expect(v13.out).not.toBe(v12.out)
        expect(v13.rows).not.toBe(v12.rows)
        expect(v13.rulings).not.toBe(v12.rulings)
        expect(v13.reports).not.toBe(v12.reports)
    })

    test('a malformed pass token is refused rather than resolved', () => {
        // Without this, `--pass ../..` or `--pass v12/../scoring-v4` resolves to
        // a path outside benchmark/ or onto frozen evidence. The freeze guard
        // would catch a populated directory, but not an empty one.
        for (const bad of ['', '../..', 'v12/..', 'scoring-v12', '12', 'V12', 'v12 ', 'v-12']) {
            expect(() => gen.resolvePaths(bad)).toThrow(/pass/i)
        }
    })

    test('a well-formed pass token is accepted regardless of whether its files exist yet', () => {
        // Resolution is pure. The generator reports missing inputs when it reads
        // them, with a message naming the file — not as an ENOENT from inside a
        // JSON.parse. v99 has no files and must still resolve.
        const p = gen.resolvePaths('v99')
        expect(p.out).toBe(path.join(BENCH, 'scoring-v99'))
    })

    test('--pass with no value throws, like --out', () => {
        expect(() => gen.main(['--pass'])).toThrow(/--pass needs/)
    })

    test('a missing input file names the file and the pass, not an ENOENT', () => {
        // v99 exists nowhere. The operator hits this AFTER twenty runs, so the
        // message has to say which artefact is absent.
        //
        // Driven through --out into a throwaway, NEVER bare. A bare main() here
        // would rely on the code under test throwing: if the read guard ever
        // regressed to a default-input fallback, this test would WRITE twenty
        // packets into benchmark/scoring-v99/ as a side effect.
        // packetGeneratorParity.test.js documents that exact accident as one
        // that already happened once.
        const fs = require('fs')
        const os = require('os')
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pass-missing-'))
        try {
            expect(() => gen.main(['--pass', 'v99', '--out', tmp])).toThrow(/v99-rows\.json/)
            expect(fs.readdirSync(tmp)).toEqual([])
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true })
        }
    })

    test('OUT stays exported and still points at the dispatched v12 directory', () => {
        // packetGeneratorParity.test.js asserts on gen.OUT; parameterisation
        // must not move it.
        expect(gen.OUT).toBe(path.join(BENCH, 'scoring-v12'))
    })
})

describe('the v13 advance-rulings channel (DECISION.md §AI7 item 11)', () => {
    const fs = require('fs')
    const RULINGS = path.join(BENCH, 'v13-advance-rulings.json')

    // §AD5's standing rule: an advance ruling on a scoring column must ship IN
    // THE PACKETS, not only in the pre-registration. That is #160. §AG1 records
    // the cost of getting it wrong in v12 — rows 17 and 19 flagged
    // `fix_usable_unedited` BECAUSE the ruling never reached the scorer, and two
    // such flags land AI-3 exactly on its refutation boundary. An undelivered
    // ruling would refute a prediction about the rubric using a defect in the
    // delivery of the rubric.

    test('the file exists, parses, and carries §AI4 Ruling 1 in the v12 shape', () => {
        const rulings = JSON.parse(fs.readFileSync(RULINGS, 'utf8'))
        expect(Array.isArray(rulings)).toBe(true)
        expect(rulings).toHaveLength(1)
        const r = rulings[0]
        for (const k of ['id', 'source', 'column', 'applies_to', 'heading', 'text']) {
            expect(Object.keys(r)).toContain(k)
        }
        expect(r.source).toMatch(/§AI4/)
        expect(r.column).toBe('fix_usable_unedited')
        expect(r.applies_to.seed).toBe('05')
    })

    test('it renders into a seed-05 packet and is absent from every other seed', () => {
        const rulings = JSON.parse(fs.readFileSync(RULINGS, 'utf8'))
        const rendered = gen.advanceRulings({ seed: '05' }, rulings)
        expect(rendered).toContain('fix_usable_unedited')
        expect(rendered).toContain('sn_aia_trigger_configuration.active')

        for (const seed of ['01', '02', '03', '04']) {
            const other = gen.advanceRulings({ seed: seed }, rulings)
            expect(other).toContain('None for this seed')
            expect(other).not.toContain('sn_aia_trigger_configuration.active')
        }
    })

    test('its scorer-facing prose carries no operator verdict and no repository path', () => {
        // The generator lints rulings on the same terms as every other
        // scorer-facing field, and refuses to write ANY packet if one trips.
        // Catching it here means catching it before the pass rather than after
        // twenty runs have been spent.
        const rulings = JSON.parse(fs.readFileSync(RULINGS, 'utf8'))
        for (const r of rulings) {
            expect(gen.verdictHits(r.heading, 'heading')).toEqual([])
            expect(gen.verdictHits(r.text, 'text')).toEqual([])
        }
    })
})

describe('the v14 advance-rulings channel (DECISION.md §AN4 + §AN7 item 13)', () => {
    const fs = require('fs')
    const RULINGS = path.join(BENCH, 'v14-advance-rulings.json')

    // Same reasoning as the v13 block above, and the same cost if it is wrong.
    // v14 carries THREE rulings rather than one, across three seeds, and two of
    // them (7 and 8) fix which of two competing readings is the seeded defect —
    // exactly the calls a scorer would otherwise make at the desk with the run's
    // most salient symptom pointing the wrong way. An undelivered Ruling 7 or 8
    // would produce a `root_cause_layer_correct` miss caused by the delivery of
    // the rubric rather than by the report.

    test('the file exists, parses, and carries all three rulings in the v12 shape', () => {
        const rulings = JSON.parse(fs.readFileSync(RULINGS, 'utf8'))
        expect(Array.isArray(rulings)).toBe(true)
        expect(rulings).toHaveLength(3)
        for (const r of rulings) {
            for (const k of ['id', 'source', 'column', 'applies_to', 'heading', 'text']) {
                expect(Object.keys(r)).toContain(k)
            }
        }
        expect(rulings.map((r) => r.id)).toEqual(['AI4-R1', 'AN4-R7', 'AN4-R8'])
        expect(rulings.map((r) => r.applies_to.seed)).toEqual(['05', '07', '08'])
        expect(rulings.map((r) => r.column)).toEqual([
            'fix_usable_unedited',
            'root_cause_layer_correct',
            'root_cause_layer_correct',
        ])
    })

    test('each ruling renders into its own seed and no other', () => {
        const rulings = JSON.parse(fs.readFileSync(RULINGS, 'utf8'))

        // A marker unique to each ruling's prose, so a ruling leaking into the
        // wrong seed's packet is caught rather than merely counted.
        const marker = {
            '05': 'sn_aia_trigger_configuration.active',
            '07': '15,154',
            '08': 'check_processing_status',
        }

        for (const seed of ['05', '07', '08']) {
            const rendered = gen.advanceRulings({ seed: seed }, rulings)
            expect(rendered).toContain(marker[seed])

            for (const other of ['05', '07', '08']) {
                if (other === seed) continue
                expect(rendered).not.toContain(marker[other])
            }
        }

        // The out-of-sample seed with NO ruling, and the anchor that shares the
        // pass with two that have one: neither may receive anything.
        for (const seed of ['01', '02', '03', '04', '06']) {
            const other = gen.advanceRulings({ seed: seed }, rulings)
            expect(other).toContain('None for this seed')
            for (const m of Object.values(marker)) {
                expect(other).not.toContain(m)
            }
        }
    })

    test('its scorer-facing prose carries no operator verdict and no repository path', () => {
        // The generator refuses to write ANY packet in the pass if one of these
        // trips, so an edit to a ruling would otherwise surface only after the
        // twenty runs had been spent.
        const rulings = JSON.parse(fs.readFileSync(RULINGS, 'utf8'))
        for (const r of rulings) {
            expect(gen.verdictHits(r.heading, 'heading')).toEqual([])
            expect(gen.verdictHits(r.text, 'text')).toEqual([])
        }
    })
})


describe('a full --pass build, end to end (the gate no test covered)', () => {
    // The #168 review found the hardcoded runbook by hand-running `--pass v13`
    // with synthetic inputs, because nothing exercised the whole path — only
    // path resolution and the v12 default were covered. That gap is closed
    // here: a build under a non-default pass, from staged inputs, all the way
    // to twenty files and the printed runbook.
    const fs = require('fs')
    const os = require('os')

    const V12_ROWS = path.join(BENCH, 'v12-rows.json')
    const V12_REPORTS = path.join(BENCH, 'v12-reports')
    const PASS = 'v98'
    const rowsFile = path.join(BENCH, PASS + '-rows.json')
    const reportsDir = path.join(BENCH, PASS + '-reports')
    const rulingsFile = path.join(BENCH, PASS + '-advance-rulings.json')

    // v98 inputs are cloned from v12's and removed in afterAll. They are
    // scaffolding for the code path, not evidence: nothing here is scored, and
    // the real v13 inputs arrive from the pass itself.
    //
    // Rows 02 and 04 are PATCHED here, and the patch is the #178 rule working
    // as designed rather than an inconvenience worked around. v12's own rows 02
    // and 04 took a hold and named no discharging call; cloned into a pass with
    // no dispatched packets, they are authorable again, so the gate binds them
    // and refuses to build. The synthetic note below is scaffolding — it
    // asserts nothing about what those two runs actually called, and v12's
    // manifest on disk is untouched (§T9).
    beforeAll(() => {
        const rows = JSON.parse(fs.readFileSync(V12_ROWS, 'utf8'))
        for (const r of rows) {
            if (r.row === 2 || r.row === 4) {
                r.note = 'SCAFFOLDING, not evidence. The call that answered the HOLD was ' +
                    'query_table on x_snc_tsbench_ticket.'
            }
        }
        fs.writeFileSync(rowsFile, JSON.stringify(rows, null, 2))
        fs.copyFileSync(path.join(BENCH, 'v13-advance-rulings.json'), rulingsFile)
        fs.mkdirSync(reportsDir, { recursive: true })
        for (const f of fs.readdirSync(V12_REPORTS)) {
            fs.copyFileSync(path.join(V12_REPORTS, f), path.join(reportsDir, f))
        }
    })

    afterAll(() => {
        fs.rmSync(rowsFile, { force: true })
        fs.rmSync(rulingsFile, { force: true })
        fs.rmSync(reportsDir, { recursive: true, force: true })
    })

    test('builds twenty packets and prints a runbook naming ITS OWN directory', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pass-e2e-'))
        const lines = []
        const quiet = jest.spyOn(console, 'log').mockImplementation((m) => lines.push(String(m)))
        try {
            gen.main(['--pass', PASS, '--out', tmp])
            expect(gen.existingPacketsIn(tmp)).toHaveLength(20)

            // The finding: an unconditional `scoring-v12` here tells the
            // operator to make two edits that are already done, so the suite
            // goes green while the new packets never enter the blind-rule scan.
            const runbook = lines.join('\n')
            expect(runbook).toContain(path.basename(tmp))
            expect(runbook).not.toContain('scoring-v12')
        } finally {
            quiet.mockRestore()
            fs.rmSync(tmp, { recursive: true, force: true })
        }
    })

    /**
     * #178: the delivery rule binds a pass that can still comply.
     *
     * §T9 forbids editing a frozen manifest, so on a DISPATCHED pass a rule
     * written after it has no legal remedy — the check can only report. On a
     * pass still being authored it gates, and nothing is written.
     *
     * The boundary is DERIVED from whether the pass's own directory already
     * holds packets, never declared as a list of pass tokens. That distinction
     * is the whole reason this shape was chosen over an exemption list, and
     * the two tests below are the property, not the mechanism: the SAME
     * manifest gates under a pass with no dispatched packets and reports under
     * one that has them. The only way to reach the reporting branch is to have
     * already dispatched, and dispatching required passing the gate that was in
     * force at the time. An exemption nobody can grant themselves is not one.
     */
    test('a still-authorable pass GATES on a row that names no discharging call', () => {
        const rows = JSON.parse(fs.readFileSync(rowsFile, 'utf8'))
        const saved = JSON.stringify(rows, null, 2)
        for (const r of rows) if (r.row === 2) delete r.note
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pass-held-'))
        try {
            fs.writeFileSync(rowsFile, JSON.stringify(rows, null, 2))
            // benchmark/scoring-v98/ does not exist, so this pass is still
            // being authored and the rule is one it can comply with.
            expect(gen.existingPacketsIn(gen.resolvePaths(PASS).out)).toEqual([])
            expect(() => gen.main(['--pass', PASS, '--out', tmp])).toThrow(/row 2:/)
            expect(fs.readdirSync(tmp)).toEqual([])
        } finally {
            fs.writeFileSync(rowsFile, saved)
            fs.rmSync(tmp, { recursive: true, force: true })
        }
    })

    test('a dispatched pass REPORTS the same violation instead of gating', () => {
        // v12 and v13 are dispatched, scored evidence. v12's rows 02 and 04
        // name no discharging call and v13 fails both halves of the rule; both
        // must stay readable as fixtures, and both must say so out loud.
        const warned = []
        const quiet = jest.spyOn(console, 'warn').mockImplementation((m) => warned.push(String(m)))
        try {
            expect(gen.buildAll('v12')).toHaveLength(20)
            expect(gen.buildAll('v13')).toHaveLength(20)
        } finally {
            quiet.mockRestore()
        }
        const report = warned.join('\n')
        expect(report).toMatch(/row 2:/)
        expect(report).toMatch(/row 4:/)
        expect(report).toMatch(/dispatched/i)
    })

    // §AN7 item 14 exists because #176 left buildAll('v13') permanently
    // throwing and nothing noticed — a parallel path stayed green. Running the
    // CLI once by hand is exactly the substitution that item warns about, so
    // the v14 path is pinned here, where it runs on every suite.
    test("buildAll('v14') builds all twenty rows (§AN7 item 14)", () => {
        const quiet = jest.spyOn(console, 'warn').mockImplementation(() => {})
        try {
            expect(gen.buildAll('v14')).toHaveLength(20)
        } finally {
            quiet.mockRestore()
        }
    })

    // The two shapes a `failed` row can take. Until v14 only the first existed,
    // and a run that died BEFORE producing a body had nowhere truthful to go:
    // the sole failure slot was labelled VALIDATOR REJECTION, which would have
    // told twenty scorers the fix-report validator ran when it never did.
    test('a failed row is satisfied by EITHER a validator rejection or a no-report marker', () => {
        const quiet = jest.spyOn(console, 'warn').mockImplementation(() => {})
        let built
        try {
            built = gen.buildAll('v14')
        } finally {
            quiet.mockRestore()
        }
        const byRow = (n) => built.find((p) => p.row.row === n)

        // Rows 06 and 08: reasoning failed before any report body existed.
        for (const n of [6, 8]) {
            const p = byRow(n)
            expect(p.row.terminal).toMatch(/failed/)
            expect(p.body).toMatch(/no report at all/i)
            expect(p.body).toMatch(/Harness terminal error, verbatim/)
            // It must NOT claim a validator rejection it never had.
            expect(p.body).not.toMatch(/validator rejection, verbatim/i)
        }

        // Row 12: the model DID produce a body and the validator rejected it.
        const twelve = byRow(12)
        expect(twelve.row.terminal).toMatch(/failed/)
        expect(twelve.body).toMatch(/no accepted report/i)
        expect(twelve.body).toMatch(/Harness validator rejection, verbatim/)
        expect(twelve.body).not.toMatch(/no report at all/i)

        // And a passing row carries neither shape.
        expect(byRow(1).body).not.toMatch(/no report at all/i)
        expect(byRow(1).body).not.toMatch(/validator rejection, verbatim/i)
    })

    /**
     * The destructive branch is unit-tested, NOT driven end to end.
     *
     * Reaching it through main() means pointing the writer at real dispatched
     * evidence and relying on the guard under test to stop it — the accident
     * packetGeneratorParity.test.js documents as one that already happened.
     * Staging a throwaway benchmark/scoring-v9x/ is no better: the blind-rule
     * suite asserts the scoring directories on disk against its declared
     * membership, and jest runs files in parallel, so the directory would flake
     * a guard in another worker. The decision is therefore a pure function over
     * the three facts main() holds, and its truth table is the test.
     */
    describe('--force is not also an escape hatch from the delivery rule (#178)', () => {
        const cases = [
            [2, true, true, true, 'a dispatched pass, into its own directory, with violations'],
            [0, true, true, false, 'the same, with no violations'],
            [2, false, true, false, 'a pass that was never dispatched — the gate already threw'],
            [2, true, false, false, 'a scratch rebuild into --out, which destroys nothing'],
        ]

        test.each(cases)('%i violation(s), dispatched=%s, ownDirectory=%s → refuses=%s (%s)',
            (violations, dispatched, ownDirectory, refuses) => {
                const r = gen.forceRefusal(violations, dispatched, ownDirectory)
                expect(Boolean(r)).toBe(refuses)
                if (refuses) expect(r).toMatch(/--force/)
            })

        test('main() consults it, rather than carrying a second copy of the rule', () => {
            const src = fs.readFileSync(path.join(BENCH, 'scripts', 'build-packets.js'), 'utf8')
            expect(src.slice(src.indexOf('function main('))).toContain('forceRefusal(')
        })

        test('the refusal counts the SAME checks the gate does', () => {
            // Review of PR #181: main() first derived its count from its own
            // pair of flatMaps, so a third delivery check added to buildAll
            // would reach the gate and miss the --force refusal — and that
            // asymmetry fails OPEN, on the one path that writes over dispatched
            // evidence. Both now read one definition.
            const src = fs.readFileSync(path.join(BENCH, 'scripts', 'build-packets.js'), 'utf8')
            const mainSrc = src.slice(src.indexOf('function main('))
            expect(mainSrc).toContain('deliveryViolations(')
            expect(mainSrc).not.toContain('withheldFactViolations(')
            expect(mainSrc).not.toContain('unnamedHoldViolations(')

            const d = gen.deliveryViolations(JSON.parse(fs.readFileSync(path.join(BENCH, 'v13-rows.json'), 'utf8')))
            expect(d.withheld).toHaveLength(7)
            expect(d.unnamed).toHaveLength(6)
        })
    })

    test('a partially staged reports directory names the pass, not "?"', () => {
        const missing = path.join(reportsDir, 'row-02.md')
        const saved = fs.readFileSync(missing)
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pass-partial-'))
        try {
            fs.rmSync(missing)
            expect(() => gen.main(['--pass', PASS, '--out', tmp])).toThrow(
                new RegExp('MISSING INPUT for pass ' + PASS)
            )
            expect(fs.readdirSync(tmp)).toEqual([])
        } finally {
            fs.writeFileSync(missing, saved)
            fs.rmSync(tmp, { recursive: true, force: true })
        }
    })
})
