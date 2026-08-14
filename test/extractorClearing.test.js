'use strict';

/**
 * §AX5 clearing check — the extractor must encode no answer key.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS REPLACES
 * ---------------------------------------------------------------------------
 * §AW protected the recall figure by requiring a BLIND AUTHOR. That is a
 * property of a person's context: unverifiable from outside, dischargeable only
 * by attestation, and it failed three times in a row. §AX0 substituted a
 * property you can check on the artifact:
 *
 *   > Registered principle: prefer a property you can check on the artifact
 *   > over a property you must certify about the author.
 *
 * This file is that check. It is what allows a contaminated operator to author
 * the extractor — the question moves from "what does the author know" to "what
 * does the artifact encode", and only the second is decidable.
 *
 * ---------------------------------------------------------------------------
 * WHY THE PROMPT IS THE PRIMARY TARGET
 * ---------------------------------------------------------------------------
 * §AX5: the extractor is model-backed, so "its tunable surface is its PROMPT,
 * not its plumbing; parse, sort and serialise cannot encode an answer key".
 * The plumbing is cleared too, because that sentence is an argument about where
 * tuning is LIKELY, not a guarantee about where it is possible.
 *
 * The unit-test fixtures are cleared on the same footing. Brief §7 requires the
 * extractor be tested against self-authored prose; a fixture that drifted toward
 * corpus vocabulary would be tuning against the corpus through the test suite,
 * which is the same leak by a longer route.
 */

const fs = require('fs');
const path = require('path');

const { FORBIDDEN, scan } = require('./_corpusVocabulary');

const REPO = path.join(__dirname, '..');

/**
 * Everything that makes up the extractor, cleared as one.
 *
 * The prompt first, because it is where tuning would live. Naming the files
 * explicitly is safe here in a way it is not inside the extractor itself: this
 * list points at the artifact under test, not at a member of the corpus.
 */
const CLEARED = [
    'benchmark/extraction/claim-extraction-prompt.md',
    'benchmark/scripts/claim-extraction.js',
    'test/claimExtraction.test.js',
    // §AX13.4 widened this set to the adjudicator. It is mechanical, so tuning
    // is unlikely there — but "unlikely" is the same argument §AX5 makes about
    // the extractor's own plumbing before clearing it anyway. An adjudicator
    // that special-cased a corpus table by name would move the veracity figure
    // directly, and nobody diffs a file no check covers.
    'benchmark/scripts/claim-adjudication.js',
    'test/claimAdjudication.test.js',
    // §AX14 widens it again to the probe, on §AX13.4's own reasoning. The probe
    // decides what the instance is taken to have said, so an answer key hidden
    // there would move the veracity figure without touching either file above —
    // and its snapshot is deliberately NOT cleared (it must name whatever tables
    // the frozen claims name), which puts the whole burden on this source.
    'benchmark/scripts/metadata-probe.js',
    'test/metadataProbe.test.js',
    // §AX15 adds the sweep driver on the same reasoning one step further out.
    // It decides which emission becomes the frozen artifact for each report, so
    // a driver that special-cased a report — retrying only that one, or
    // preferring an earlier attempt for it — would move both figures without
    // touching any file above it.
    'benchmark/scripts/claim-extraction-sweep.js',
    'test/claimExtractionSweep.test.js',
];

/**
 * The SCORER — a second artifact class, registered in §AX17.
 *
 * It is not in CLEARED and cannot be: the cleared set forbids reading the
 * held-out inventory at runtime, and recall's denominator IS that fixture. A
 * scorer unable to open it could not compute the figure.
 *
 * So it is exempt from that ONE check and from nothing else. It is still held to
 * every corpus-vocabulary pattern, still forbidden from naming a report file,
 * and — the part that matters — still DISCOVERED by the walk below, so a scorer
 * cannot be renamed or joined by a sibling without this test noticing. The
 * exemption is a named list of one, not a category anything can drift into.
 *
 * DISCOVERABILITY IS A CONSTRAINT ON THE FILENAME, not a hope about it. The walk
 * finds files by pattern, so a scorer helper named `scoring.js` would escape both
 * lists and every vocabulary check while being scorer code — the comment above
 * asserting more than the test did (review of PR #258). Every scorer file must
 * MATCH the discovery pattern, asserted below: a scorer that cannot be
 * discovered cannot be a scorer.
 */
const SCORER = ['benchmark/scripts/pass-figures.js'];

/** The names the walk collects. Shared so the two cannot drift apart. */
const DISCOVERY =
    /claim-(extraction|adjudication)|claim(Extraction|Adjudication)|metadata-probe|metadataProbe|extractorClearing|figures|Figures/i;

const PROMPT = 'benchmark/extraction/claim-extraction-prompt.md';

/**
 * Where the collected metadata snapshot goes, pinned before it exists.
 *
 * §AX14.5 registers it as evidence rather than instrument, so it is never
 * cleared. Deliberately outside `benchmark/extraction/`, `benchmark/scripts` and
 * `test/` — the three trees the discovery test walks — so its exclusion does not
 * rest on the extension rule alone.
 */
const SNAPSHOT_PATH = 'benchmark/v14-metadata-snapshot.json';

/** Collected evidence, not instrument source. An instrument here is code. */
function isCollectedEvidence(rel) {
    return /\.json$/i.test(rel);
}

function read(rel) {
    return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

describe('§AX5 — the extractor encodes no corpus vocabulary', () => {
    for (const rel of CLEARED) {
        describe(rel, () => {
            const raw = read(rel);
            test.each(FORBIDDEN)('contains no $label', (pattern) => {
                expect(scan(raw, rel, pattern)).toEqual([]);
            });
        });
    }

    test('every cleared file exists — a renamed file must not silently leave the check', () => {
        /**
         * The failure mode this closes is the one §AX10 recorded for the
         * extractor-absence guard: a check that "asserted far less than its name
         * promised" because the thing it looked for had moved. If a cleared file
         * is renamed, this fails loudly instead of clearing an empty set.
         */
        for (const rel of CLEARED) {
            expect(fs.existsSync(path.join(REPO, rel))).toBe(true);
        }
    });

    test('the cleared set covers every file the extractor is made of', () => {
        /**
         * Discovered, not rostered. #241's history is the argument: a guard
         * written from a hand list missed five of its own sites, and only a
         * guard that walks the tree found them.
         *
         * The first version walked `benchmark/extraction/` ONLY, while two of the
         * three cleared entries live outside it — so a helper at
         * `benchmark/scripts/claim-extraction-*.js`, or a second extractor test
         * file, would have joined the extractor and silently escaped clearing
         * (review of PR #255). That is the exact "asserted far less than its name
         * promised" failure this test's own comment cites as its reason to exist,
         * reproduced inside the test written to cite it.
         */
        const found = [];
        (function walk(dir) {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else found.push(path.relative(REPO, full));
            }
        })(path.join(REPO, 'benchmark', 'extraction'));

        // Every place an extractor file could plausibly live, not just the one
        // directory that happens to hold the prompt.
        for (const dir of ['benchmark/scripts', 'test']) {
            for (const name of fs.readdirSync(path.join(REPO, dir))) {
                const rel = dir + '/' + name;
                if (DISCOVERY.test(name)) {
                    found.push(rel);
                }
            }
        }

        const uncleared = found.filter(
            (f) =>
                CLEARED.indexOf(f) === -1 &&
                SCORER.indexOf(f) === -1 &&
                f !== 'test/extractorClearing.test.js' &&
                !isCollectedEvidence(f)
        );
        expect(uncleared.sort()).toEqual([]);
    });

    test('the snapshot is excluded as evidence, and only where §AX14.5 puts it', () => {
        /**
         * §AX14.5 registers the metadata snapshot as NOT cleared: it must name
         * whatever tables the frozen claims name, including the fixture table
         * the vocabulary check forbids. It is evidence, constrained by
         * provenance rather than by vocabulary.
         *
         * Left implicit, that collides with the discovery widening above — the
         * natural filename for it matches the probe pattern, so the suite would
         * have gone red mid-sweep with two ways out, one of which contradicts
         * the registration (review of PR #257). So the path is PINNED here, and
         * the exclusion is by data-file extension rather than by name: an
         * instrument is code, and a `.js`/`.md` file can never take this route
         * out of clearing.
         */
        expect(SNAPSHOT_PATH.startsWith('benchmark/')).toBe(true);
        expect(isCollectedEvidence(SNAPSHOT_PATH)).toBe(true);
        expect(CLEARED).not.toContain(SNAPSHOT_PATH);

        // The exclusion cannot be widened into a hole for instrument source.
        for (const rel of CLEARED) expect(isCollectedEvidence(rel)).toBe(false);
    });
});

describe('§AX12.2 — the prompt is derived from the specification, not from the fixture', () => {
    /**
     * The inventory records seven reading rules (R-A..R-G) the operator needed
     * to apply §AX3 to real prose. Copying them into the prompt would make
     * enumeration recall compare two implementations of one operationalisation
     * and score its own consistency — R-27's "a fixture that agrees with the
     * code by construction is a second copy of the bug", arriving through the
     * door §AX2's honest limitation left ajar.
     *
     * §AX12.2 registers the prompt as derived from §AX3 and §AX10's count ruling
     * only. This makes that mechanical instead of a promise.
     */
    const prompt = read(PROMPT);
    const fixture = JSON.parse(read('benchmark/v14-claim-inventory-heldout.json'));

    test('the prompt cites no reading-rule identifier', () => {
        const hits = fixture.reading_rules.map((r) => r.id).filter((id) => new RegExp('\\b' + id + '\\b').test(prompt));
        expect(hits).toEqual([]);
    });

    test('the prompt lifts no clause from a reading rule', () => {
        /**
         * WHAT THIS CATCHES, STATED HONESTLY. Clause-level copying, insensitive
         * to case, whitespace and punctuation — so reindentation, a capitalised
         * first word or a swapped comma will not defeat it. That is strictly
         * more than the verbatim-only check this started as, which is what
         * caught the R-D draft.
         *
         * WHAT IT DOES NOT CATCH: genuine paraphrase. A rule reworded in
         * different words passes, and no mechanical check at this cost will say
         * otherwise. An earlier version of this comment claimed the phrases were
         * "the shortest units that would survive light paraphrase", which
         * overstated it (review of PR #255) — and §AX12.2 leans on this being
         * mechanical rather than a promise, so the comment must not promise more
         * than the code delivers.
         *
         * The residual risk is accepted and named: paraphrasing a reading rule
         * into the prompt is possible and undetected here. What makes that less
         * likely than the copy it does catch is that paraphrase requires
         * intending to smuggle the rule in, whereas copying is what happens by
         * accident when both documents sit open — which is precisely how the R-D
         * violation occurred.
         */
        const flatten = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
        const flatPrompt = flatten(prompt);

        /**
         * §AX3's own text is subtracted before matching, and this is not an
         * exemption of convenience.
         *
         * Several reading rules QUOTE §AX3 — R-G's stated justification is that
         * it is "stated verbatim from §AX3". §AX12.2 registers the prompt as
         * derived FROM §AX3, so a phrase the prompt shares with the
         * specification is evidence of nothing, and flagging it would make the
         * check fire on exactly the derivation it exists to permit. Only wording
         * a rule adds BEYOND the specification can indicate fixture-derivation.
         *
         * Read from DECISION.md rather than restated here, so the subtraction
         * tracks the registered text instead of a copy that drifts from it.
         */
        const decision = read('benchmark/DECISION.md');
        const ax3 = decision.slice(decision.indexOf('### AX3.'), decision.indexOf('### AX4.'));
        expect(ax3.length).toBeGreaterThan(500); // the slice found the section, not an empty range
        const flatAx3 = flatten(ax3);

        const offenders = [];
        for (const rule of fixture.reading_rules) {
            for (const phrase of rule.rule.split(/[.;,]\s+/)) {
                const flat = flatten(phrase);
                if (flat.length < 25) continue;
                if (flatAx3.indexOf(flat) !== -1) continue; // shared with the specification
                if (flatPrompt.indexOf(flat) !== -1) offenders.push(rule.id + ': ' + phrase.trim());
            }
        }
        expect(offenders).toEqual([]);
    });

    test('the prompt still carries the two things §AX12.2 requires it to carry', () => {
        /**
         * The counterweight. A prompt stripped of everything would trivially
         * pass the checks above while measuring nothing, so the registered
         * INCLUSIONS are pinned too: §AX3's definition and §AX10's count ruling.
         */
        expect(prompt).toMatch(/true or false of instance state/i);
        expect(prompt).toMatch(/count is a claim/i);
    });

    test('the prompt tells the model not to filter on adjudicability', () => {
        // Brief §1: "a claim you declined to emit is invisible, and invisible is
        // the one outcome the recall figure cannot detect." Dropping this line
        // would bias the figure at the stage where bias is undetectable.
        expect(prompt).toMatch(/invisible/i);
    });
});

describe('§AX5 — the extractor names no member of its corpus', () => {
    test('no cleared file names a report file', () => {
        /**
         * "An extractor is expected to enumerate its corpus directory, never to
         * name a member of it" (§AX5). The locator pattern above covers the
         * `row-NN` form; this covers the path form, which the vocabulary
         * patterns would not catch.
         */
        const offenders = [];
        for (const rel of CLEARED) {
            const raw = read(rel);
            if (/v1\d-reports\//.test(raw)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    test('no cleared file reads the inventory fixture at runtime', () => {
        // The fixture is the denominator. An extractor that could read it could
        // be tuned to it, and no vocabulary check would see that.
        const offenders = [];
        for (const rel of CLEARED) {
            if (/claim-inventory/.test(read(rel))) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });
});

describe('§AX17 — the scorer is exempt from ONE check and constrained by the rest', () => {
    /**
     * A scorer must read the fixture, so the check above cannot apply to it.
     * Every other constraint does, and that is what keeps "scorer" from becoming
     * the category anything inconvenient gets moved into.
     */
    for (const rel of SCORER) {
        describe(rel, () => {
            const raw = read(rel);
            test.each(FORBIDDEN)('contains no $label', (pattern) => {
                expect(scan(raw, rel, pattern)).toEqual([]);
            });
            test('names no report file', () => {
                expect(/v1\d-reports\//.test(raw)).toBe(false);
            });
        });
    }

    test('every scorer file exists', () => {
        for (const rel of SCORER) expect(fs.existsSync(path.join(REPO, rel))).toBe(true);
    });

    test('every scorer filename matches the discovery pattern', () => {
        /**
         * Without this, "cannot be joined by a sibling" was untrue: a scorer
         * helper with an unmatched name escapes the walk, both lists, and every
         * vocabulary check. Requiring the name to be discoverable makes the
         * sibling case impossible rather than unlikely.
         */
        for (const rel of SCORER) expect(DISCOVERY.test(path.basename(rel))).toBe(true);
    });

    test('the scorer and the cleared set are disjoint', () => {
        /**
         * The exemption must not be reachable from inside the instrument. If a
         * file were on both lists it would inherit the scorer's exemption while
         * being part of the extractor — the hole this split exists to avoid.
         */
        for (const rel of SCORER) expect(CLEARED).not.toContain(rel);
    });

    test('no cleared file reaches the scorer through its requires', () => {
        /**
         * List disjointness alone asserted far less than the comment above
         * promised (review of PR #258): a cleared file could `require` the
         * scorer and reach the held-out fixture transitively, and the
         * fixture-read guard — a per-file text scan — would not see it.
         *
         * The dependency currently runs the safe way round (the scorer requires
         * the sweep driver, not the reverse), so this passes today. It is here
         * so it keeps passing.
         */
        const scorerModules = SCORER.map((rel) => path.basename(rel, '.js'));
        const seen = new Set();
        const reaches = [];

        const walkRequires = (rel, origin) => {
            if (seen.has(rel)) return;
            seen.add(rel);
            const raw = read(rel);
            const requires = raw.match(/require\(['"](\.[^'"]+)['"]\)/g) || [];
            for (const call of requires) {
                const target = call.replace(/^require\(['"]/, '').replace(/['"]\)$/, '');
                const base = path.basename(target, '.js');
                if (scorerModules.indexOf(base) !== -1) {
                    reaches.push(origin + ' -> ' + rel + ' -> ' + target);
                    continue;
                }
                const resolved = path.join(path.dirname(rel), target);
                const candidate = /\.js$/.test(resolved) ? resolved : resolved + '.js';
                if (fs.existsSync(path.join(REPO, candidate))) walkRequires(candidate, origin);
            }
        };

        for (const rel of CLEARED) {
            if (!/\.js$/.test(rel)) continue;
            seen.clear();
            walkRequires(rel, rel);
        }
        expect(reaches).toEqual([]);
    });

    test('the scorer decides nothing — it holds no verdict vocabulary of its own', () => {
        /**
         * §AX17's first property, made mechanical rather than promised. The
         * scorer may COUNT verdicts, so it names them; what it must not do is
         * compute one, which in this codebase means calling the adjudicator's
         * decision surface or re-implementing a membership test over a probe
         * read. It calls `adjudicateAll` and nothing else from that module.
         */
        const raw = read(SCORER[0]);
        expect(/adjudication\.adjudicate\b(?!All)/.test(raw)).toBe(false);
        expect(/table_exists|control_failed|presupposed/.test(raw)).toBe(false);
    });
});
