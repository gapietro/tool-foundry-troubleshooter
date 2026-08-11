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
        expect(() => gen.main(['--pass', 'v99'])).toThrow(/v99-rows\.json/)
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
