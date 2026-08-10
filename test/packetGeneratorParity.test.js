/**
 * The packet generator carries a DELIBERATE copy of the packet guard's
 * repository-path patterns (benchmark/scripts/build-v12-packets.js, and
 * scorerPacketBlindRule.test.js's PACKET_PATTERNS). The stated justification
 * is that "two independent copies disagreeing is a signal; one shared copy
 * being wrong is invisible."
 *
 * That justification has a hole, and the hole was measured: disagreeing is
 * only a signal if something LOOKS. Nothing did, and the copies drifted --
 * #143's M4 made the guard's `.md` alternation case-insensitive so a bare
 * `DECISION.MD` could not escape it, and the generator's copy did not inherit
 * the fix (#155 review, I2). This file is the thing that looks.
 *
 * It does NOT merge the two copies. Both stay independently authored; this
 * asserts they still say the same thing, so the next divergence fails a build
 * instead of being discovered in a packet.
 *
 * The rest of the file pins the #157/#160 repairs to the generator, each
 * against the exact input that produced the defect.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const GENERATOR_PATH = path.join(ROOT, 'benchmark', 'scripts', 'build-v12-packets.js')
const GUARD_PATH = path.join(__dirname, 'scorerPacketBlindRule.test.js')

const gen = require(GENERATOR_PATH)

const GENERATOR_SRC = fs.readFileSync(GENERATOR_PATH, 'utf8')
const GUARD_SRC = fs.readFileSync(GUARD_PATH, 'utf8')

/**
 * The `const PATH_STEMS = ...` declaration as SOURCE TEXT, whitespace
 * collapsed.
 *
 * Compared as text rather than by requiring the guard: requiring a jest test
 * file from another one executes its suite inside this file, and the guard
 * exports nothing anyway. Text comparison also keeps the two copies genuinely
 * independent -- neither imports the other, which is the whole point of the
 * duplication.
 */
function pathStemsDeclaration(src, file) {
    const m = src.match(/const PATH_STEMS\s*=\s*([\s\S]*?)\n\n/)
    if (!m) throw new Error('PATH_STEMS declaration not found in ' + file)
    return m[1].replace(/\s+/g, ' ').trim()
}

describe('packet generator / packet guard pattern parity', () => {
    test('both files declare the same PATH_STEMS', () => {
        expect(pathStemsDeclaration(GENERATOR_SRC, 'generator')).toBe(
            pathStemsDeclaration(GUARD_SRC, 'guard')
        )
    })

    test('both files match a markdown filename case-insensitively', () => {
        // The exact drift I2 found. Asserted on the guard as source text and on
        // the generator as BEHAVIOUR, because only the generator is importable.
        expect(GUARD_SRC).toContain('[mM][dD]')
        expect(gen.LEAK_PATTERNS.some((re) => new RegExp(re.source).test('DECISION.MD'))).toBe(true)
    })

    test.each([
        'benchmark/DECISION.md',
        'scoring-v9/row-01.md',
        '../results',
        './seeds',
        'DECISION.md',
        'DECISION.MD',
        'raw-evidence-v9-scored-pass.md',
        'dist/',
    ])('the generator\'s leak scan still catches %s', (route) => {
        expect(gen.LEAK_PATTERNS.some((re) => new RegExp(re.source).test(route))).toBe(true)
    })

    test('a bare stem word with no route is not a leak', () => {
        // The boundary #144 pinned on the guard, re-pinned on the copy.
        expect(gen.LEAK_PATTERNS.some((re) => new RegExp(re.source).test('the results were mixed'))).toBe(false)
    })
})

describe('redaction preserves meaning (#157, I3)', () => {
    test('one substitution never cascades into another', () => {
        // Produced "a repository a repository document §3" in rows 17-20: the
        // ../stem rule left a bare `.md` behind for the markdown rule to hit.
        const out = gen.redact('Measured 2026-08-09, evidence in\n`../raw-evidence-seed-qualification-02-05.md` §3: activating the trigger', [])
        expect(out).not.toMatch(/a repository a repository/)
        expect(out).toContain('the seed-qualification evidence record §3: activating the trigger')
    })

    test('the setup step is still a runnable command', () => {
        // All 20 packets rendered "cd the build output directory && now-sdk
        // install", which cannot be run.
        const out = gen.redact('Install the fixture app: `cd benchmark/seed-app && now-sdk install --alias gpinst01`.', [])
        expect(out).not.toMatch(/cd the build output directory/)
        expect(out).toContain('`now-sdk install --alias gpinst01`')
    })

    test('a test file is not described as a directory', () => {
        const out = gen.redact('`test/seed02Construction.test.js` (main repo) guards the construction.', [])
        expect(out).toBe('A dedicated unit test in the main repo guards the construction.')
    })

    test('a replacement opening a sentence is capitalised, mid-sentence is not', () => {
        expect(gen.redact('It*. `seed-app/src/fluent/seed-tables-acl.now.ts` grants the read ACL.', []))
            .toContain(". The fixture app's shared ACL Fluent file grants")
        expect(gen.redact('ACLs in `seed-app/src/fluent/seed-tables-acl.now.ts` — Build Rule #42.', []))
            .toContain("in the fixture app's shared ACL Fluent file —")
    })

    test('a path with no reviewed replacement is removed AND reported', () => {
        // The generic sweep used to substitute prose silently, which is how a
        // wrong description shipped in five places. It now fails the build.
        const unreviewed = []
        const out = gen.redact('see `docs/some-new-note.md` for detail', unreviewed)
        expect(out).toContain(gen.REVIEW_SENTINEL)
        expect(out).not.toContain('docs/some-new-note')
        expect(unreviewed).toEqual(['`docs/some-new-note.md`'])
    })
})

describe('rejected reports are labelled correctly (#157)', () => {
    const row = { terminal: 'failed (fix_report rejected, could not be repaired)' }
    const raw = '{"failure_summary":"x"}\n\n---\nVALIDATOR REJECTION\nfix_report failed validation: reason.'

    test('the validator rejection sits outside the json fence', () => {
        const body = gen.reportBody(row, raw)
        const jsonFence = body.slice(body.indexOf('```json'), body.indexOf('```', body.indexOf('```json') + 7))
        expect(jsonFence).toContain('failure_summary')
        expect(jsonFence).not.toContain('VALIDATOR REJECTION')
        expect(jsonFence).not.toContain('fix_report failed validation')
    })

    test('the rejection text survives verbatim', () => {
        expect(gen.reportBody(row, raw)).toContain('fix_report failed validation: reason.')
    })
})

describe('operator commentary stays in a neutral register (#157, I4)', () => {
    const ROWS = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmark', 'v12-rows.json'), 'utf8'))

    test('the v12 manifest carries no operator verdict in a scorer-facing field', () => {
        expect(ROWS.flatMap(gen.registerViolations)).toEqual([])
    })

    test.each([
        ['note', "schema_lookup on incident.priority — an out-of-box table unrelated to this seed's fixture."],
        ['layers_swept', '5/7 — no schema_lookup was called; the report states L4 and L5 were skipped deliberately'],
    ])('the exact v12 %s phrasing would now fail the build', (field, value) => {
        const row = { row: 1 }
        row[field] = value
        expect(gen.registerViolations(row).length).toBeGreaterThan(0)
    })

    test('every scorer-facing field is declared, and operator_note is not one', () => {
        expect(gen.SCORER_FACING_FIELDS).toContain('note')
        expect(gen.SCORER_FACING_FIELDS).toContain('layers_swept')
        expect(gen.SCORER_FACING_FIELDS).not.toContain('operator_note')
    })
})

describe('advance rulings reach the packets (#160)', () => {
    const RULINGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmark', 'v12-advance-rulings.json'), 'utf8'))
    const ROWS = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmark', 'v12-rows.json'), 'utf8'))
    let built

    beforeAll(() => {
        built = gen.buildAll()
    })

    test('every pre-registered ruling ships in every packet it claims', () => {
        for (const r of RULINGS) {
            const targets = built.filter((p) => p.row.seed === r.applies_to.seed)
            expect(targets.length).toBeGreaterThan(0)
            for (const p of targets) expect(p.body).toContain(r.heading)
        }
    })

    test('the section is present on every row, so its presence carries no signal', () => {
        for (const p of built) expect(p.body).toContain('## 3. Advance rulings on scoring columns')
    })

    test('a ruling\'s pre-registration pointer never renders', () => {
        // `source` points into the decision record, which is the answer key.
        for (const p of built) for (const r of RULINGS) expect(p.body).not.toContain(r.source)
    })

    test('operator_note never renders', () => {
        for (const p of built) {
            const op = ROWS.find((r) => r.row === p.row.row).operator_note
            if (op) expect(p.body).not.toContain(op)
        }
    })
})

describe('the generator has no side effect on require (#157)', () => {
    test('requiring it does not rebuild scoring-v12/', () => {
        // An inspection `require()` ran main() and silently rewrote all twenty
        // dispatched packets. This file has required the generator at load; if
        // that still wrote anything, the mtimes below moved.
        const dir = path.join(ROOT, 'benchmark', 'scoring-v12')
        const before = fs.readdirSync(dir).map((f) => fs.statSync(path.join(dir, f)).mtimeMs)
        require(GENERATOR_PATH)
        expect(fs.readdirSync(dir).map((f) => fs.statSync(path.join(dir, f)).mtimeMs)).toEqual(before)
    })

    test('main() refuses to overwrite the dispatched packets', () => {
        expect(() => gen.main([])).toThrow(/already exist in scoring-v12/)
    })
})
