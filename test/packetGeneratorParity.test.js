/**
 * The packet generator carries a DELIBERATE copy of the packet guard's
 * repository-path patterns (benchmark/scripts/build-packets.js, and
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
 * It does NOT merge the two copies. Both stay independently authored, and
 * neither imports the other; this asserts they still say the same thing by two
 * routes -- the stem list compared as SOURCE TEXT, and the composed matchers
 * compared as BEHAVIOUR over a corpus, the guard's rebuilt from its own source.
 * Both routes are needed: the drift that actually happened lived in the
 * alternations, not in the stem list, so a stem-only diff would have stayed
 * green through it.
 *
 * The rest of the file pins the #157/#160 repairs to the generator, each
 * against the exact input that produced the defect.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const GENERATOR_PATH = path.join(ROOT, 'benchmark', 'scripts', 'build-packets.js')
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

/**
 * The guard's ACTUAL packet-path matcher, rebuilt from its source.
 *
 * Comparing PATH_STEMS alone would not have caught the drift this file exists
 * for: #143's M4 made the `.md` ALTERNATION case-insensitive, and that lives in
 * PACKET_PATTERNS, not in the stem list. So the alternations are compared too --
 * and the only honest way to compare them is to build the guard's regex and run
 * it. The expression is string concatenation around PATH_STEMS, so it is
 * evaluated with that one binding supplied.
 *
 * Reformatting the guard's declaration breaks the extraction and reddens this
 * file, which is the correct outcome: an unreadable guard is an unchecked one.
 */
function guardPacketRegex() {
    const block = GUARD_SRC.slice(GUARD_SRC.indexOf('const PACKET_PATTERNS'))
    const m = block.match(/re: new RegExp\(\n([\s\S]*?)\n\s*\),/)
    if (!m) throw new Error('could not extract PACKET_PATTERNS regex from the guard -- was it reformatted?')
    // eslint-disable-next-line no-new-func
    return new Function('PATH_STEMS', 'return new RegExp(' + m[1] + ')')(gen.PATH_STEMS)
}

const generatorHits = (s) => gen.LEAK_PATTERNS.some((re) => new RegExp(re.source).test(s))

/** Whitespace-separated tokens from every scorer-facing seed spec, deduped. */
function seedSpecTokens() {
    const dir = path.join(ROOT, 'benchmark', 'seeds')
    const text = fs
        .readdirSync(dir)
        .filter((f) => /^seed-\d+-.*\.md$/.test(f))
        .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
        .join('\n')
    return [...new Set(text.split(/\s+/).filter(Boolean))]
}

describe('packet generator / packet guard pattern parity', () => {
    test('both files declare the same PATH_STEMS', () => {
        expect(pathStemsDeclaration(GENERATOR_SRC, 'generator')).toBe(
            pathStemsDeclaration(GUARD_SRC, 'guard')
        )
    })

    test('the guard\'s matcher is still extractable', () => {
        expect(guardPacketRegex()).toBeInstanceOf(RegExp)
    })

    const CORPUS = [
        'benchmark/DECISION.md',
        'benchmark/seeds/seed-01.md',
        '../scorecard-template.md',
        './seeds',
        '../results',
        'scoring-v9/',
        'scoring-v12/row-01-native.md',
        'dist/',
        'seed-app/src/fluent/x.now.ts',
        '.claude/context/sdk-reference.md',
        'DECISION.md',
        'DECISION.MD',
        'raw-evidence-v9-scored-pass.md',
        'node_modules/foo/bar.js',
        'src/server/PaFixReport.js',
        '../../test/blindRule.test.js',
        'history/seed-02.history.md',
        'docs/PRD.md',
        // Negative controls: the #144 boundary, and prose that merely uses a
        // stem as a word.
        'the results were mixed',
        'a repository document',
        'no paths here at all',
        'package.json',
        'seed-app',
    ]

    test.each(CORPUS)('the two copies agree on %s', (s) => {
        expect(generatorHits(s)).toBe(guardPacketRegex().test(s))
    })

    test('the two copies agree on every token in every seed spec', () => {
        // The planted corpus is what a human thought to write down. This is the
        // real input: 22 genuine repository paths across five specs, plus a few
        // thousand words of prose as negative controls.
        const re = guardPacketRegex()
        const disagreements = seedSpecTokens().filter((t) => generatorHits(t) !== re.test(t))
        expect(disagreements).toEqual([])
    })

    test('both files match a markdown filename case-insensitively', () => {
        // The exact drift I2 found, kept as a named test because it is the one
        // divergence that actually happened.
        expect(guardPacketRegex().test('DECISION.MD')).toBe(true)
        expect(generatorHits('DECISION.MD')).toBe(true)
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

    test('"for this seed" is only claimed when the file IS this seed\'s', () => {
        const mine = []
        expect(gen.redact('see `../seed-app/src/fluent/seed-03-missing-data.now.ts`', mine, { seed: '03' }))
            .toContain("the fixture app's Fluent file for this seed")
        expect(mine).toEqual([])

        // A neighbour's file must not be attributed to the row under scoring.
        const theirs = []
        const out = gen.redact('see `../seed-app/src/fluent/seed-01-schema-mismatch.now.ts`', theirs, { seed: '03' })
        expect(out).toContain(gen.REVIEW_SENTINEL)
        expect(out).not.toContain('for this seed')
        expect(theirs).toHaveLength(1)
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

    test('hold_text is out of scope, because it is transcribed rather than authored', () => {
        // A verbatim harness message has no remedy under this lint: rewriting
        // it to satisfy a register rule falsifies the quote the packet
        // advertises as verbatim. The boundary is declared, not implicit.
        expect(gen.SCORER_FACING_FIELDS).not.toContain('hold_text')
        expect(gen.registerViolations({ row: 1, hold_text: 'HOLD: layer 4 declared deliberately NOT_SWEPT' }))
            .toEqual([])
    })

    test('advance-ruling prose is linted on the same terms', () => {
        // The largest block of operator-authored scorer-facing prose in the
        // packet. Exempting it would be the implicit second-and-silent
        // exemption the lint's own note rules out.
        expect(gen.verdictHits('a probe that deliberately left the state', 'ruling X')).toHaveLength(1)
        const RULINGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmark', 'v12-advance-rulings.json'), 'utf8'))
        for (const r of RULINGS) {
            expect(gen.verdictHits(r.heading, r.id)).toEqual([])
            expect(gen.verdictHits(r.text, r.id)).toEqual([])
        }
    })
})

describe('a row\'s terminal state and its report agree (#157)', () => {
    test('every v12 row\'s terminal matches whether its report was rejected', () => {
        // buildAll() throws on a mismatch; that it returns is the assertion.
        // The packet PROMISES a validator rejection whenever the terminal reads
        // `failed`, and shows an unexplained one if a report carries the
        // separator on a passing row.
        expect(gen.buildAll()).toHaveLength(20)
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

describe('the dispatched packets are frozen (#157)', () => {
    const DISPATCHED = path.join(ROOT, 'benchmark', 'scoring-v12')
    const mtimes = (dir) =>
        fs.readdirSync(dir).sort().map((f) => f + ':' + fs.statSync(path.join(dir, f)).mtimeMs)

    test('requiring the generator writes nothing', () => {
        // An inspection `require()` ran main() and silently rewrote all twenty.
        // This MUST run in a child process: this file already required the
        // generator at load, so a same-process require() hits the module cache
        // and executes nothing — a test that cannot fail. Measured: with
        // `main(['--force'])` at module scope, the in-process version stayed
        // green and this one goes red.
        const before = mtimes(DISPATCHED)
        execFileSync(process.execPath, ['-e', 'require(' + JSON.stringify(GENERATOR_PATH) + ')'], {
            stdio: 'ignore',
        })
        expect(mtimes(DISPATCHED)).toEqual(before)
    })

    test('main() refuses to write into a directory that already holds packets', () => {
        // Driven against a throwaway directory, NEVER the dispatched one. The
        // earlier version of this test called main([]) against the real
        // scoring-v12/ and relied on the guard under test to stop it: with the
        // directory absent — or after any manifest edit that changes a filename
        // — that test wrote twenty packets, which is the accident this whole
        // guard exists to prevent.
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'packet-freeze-'))
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {})
        try {
            gen.main(['--out', tmp])
            expect(gen.existingPacketsIn(tmp)).toHaveLength(20)
            expect(() => gen.main(['--out', tmp])).toThrow(/already exist/)
            expect(() => gen.main(['--out', tmp, '--force'])).not.toThrow()
        } finally {
            quiet.mockRestore()
            fs.rmSync(tmp, { recursive: true, force: true })
        }
    })

    test('the guard keys on what the directory holds, not on the names this run computes', () => {
        // The fail-open hole: keying on computed filenames means renaming a row
        // in the manifest (arm/seed/rep are all in the filename) slips every
        // existsSync check and writes twenty fresh packets beside twenty stale.
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'packet-freeze-'))
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {})
        try {
            fs.writeFileSync(path.join(tmp, 'row-99-custom-seed-99-run-9.md'), 'a packet from another manifest')
            expect(() => gen.main(['--out', tmp])).toThrow(/already exist/)
        } finally {
            quiet.mockRestore()
            fs.rmSync(tmp, { recursive: true, force: true })
        }
    })

    test('the default output directory is the dispatched one, and it is populated', () => {
        expect(gen.OUT).toBe(DISPATCHED)
        expect(gen.existingPacketsIn(gen.OUT)).toHaveLength(20)
    })
})
