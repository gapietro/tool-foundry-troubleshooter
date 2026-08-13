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
];

const PROMPT = 'benchmark/extraction/claim-extraction-prompt.md';

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
        // Discovered, not rostered. #241's history is the argument: a guard
        // written from a hand list missed five of its own sites, and only a
        // guard that walks the tree found them.
        const found = [];
        (function walk(dir) {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else found.push(path.relative(REPO, full));
            }
        })(path.join(REPO, 'benchmark', 'extraction'));

        const uncleared = found.filter((f) => CLEARED.indexOf(f) === -1);
        expect(uncleared).toEqual([]);
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

    test('the prompt lifts no sentence from a reading rule', () => {
        /**
         * Substring containment would only catch a wholesale copy. This checks
         * distinctive phrases — the shortest units that would survive light
         * paraphrase — so a rule cannot be smuggled in one clause at a time.
         */
        const offenders = [];
        for (const rule of fixture.reading_rules) {
            for (const phrase of rule.rule.split(/[.;]\s+/)) {
                const trimmed = phrase.trim();
                if (trimmed.length < 25) continue;
                if (prompt.indexOf(trimmed) !== -1) offenders.push(rule.id + ': ' + trimmed);
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
