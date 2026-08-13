'use strict';

/**
 * Unit tests for the deterministic half of the claim extractor
 * (`benchmark/scripts/claim-extraction.js`).
 *
 * ---------------------------------------------------------------------------
 * WHAT IS AND IS NOT UNDER TEST HERE
 * ---------------------------------------------------------------------------
 * The extractor is model-backed by §AX5, and brief §7 is explicit that
 * determinism is a requirement on SERIALISATION, not on inference: "A
 * model-backed extractor is expected and is not required to be reproducible;
 * what must be deterministic is the adjudicator, and the ordering and
 * formatting of whatever the extractor emits."
 *
 * So this file tests the part that can be tested — validation, dedup, ordering,
 * id assignment, serialisation — and says nothing about claim detection. The
 * prompt is cleared separately by test/extractorClearing.test.js.
 *
 * ---------------------------------------------------------------------------
 * EVERY FIXTURE BELOW IS PROSE THIS FILE AUTHORS
 * ---------------------------------------------------------------------------
 * Brief §7: "Test the extractor against report prose you author yourself — not
 * against corpus reports whose claims you have adjudicated. The extractor's
 * behaviour on the corpus must be unobserved until the burn."
 *
 * Nothing here is copied from, paraphrased from, or shaped by any corpus
 * report. The subjects are deliberately invented and share no vocabulary with
 * the corpus — which test/extractorClearing.test.js mechanically enforces over
 * this file too, so the property is checked rather than promised.
 */

const extraction = require('../benchmark/scripts/claim-extraction');

/** A short invented report body. Line numbers below are 1-based into this array. */
const REPORT = [
    'The widget registry was inspected for the reported fault.', // 1
    'Table zz_demo_widget exists and carries a column named calibration_state.', // 2
    'Record 1111aaaa2222bbbb3333cccc4444dddd has calibration_state set to pending.', // 3
    'Four records on zz_demo_widget are in the pending state.', // 4
    'The registry lookup tool made three calls during this investigation.', // 5
    'Severity is assessed as moderate and the fault is probably intermittent.', // 6
    'Recommend setting calibration_state to complete on the affected record.', // 7
    'As noted, record 1111aaaa2222bbbb3333cccc4444dddd has calibration_state set to pending.', // 8
];

/** Build a well-formed claim, overridable per test. */
function claim(over) {
    return Object.assign(
        {
            proposition: 'Table zz_demo_widget exists.',
            kind: 'existence',
            polarity: 'asserts',
            subject: { table: 'zz_demo_widget' },
            occurrences: [{ line: 2, quote: 'Table zz_demo_widget exists' }],
        },
        over || {}
    );
}

function run(claims) {
    return extraction.normalise({ claims: claims }, { report: 'demo-01', arm: 'native', lines: REPORT });
}

describe('claim extraction — structural validation', () => {
    test('accepts a well-formed claim', () => {
        const out = run([claim()]);
        expect(out.rejected).toEqual([]);
        expect(out.claims).toHaveLength(1);
    });

    test('rejects a claim whose quote is not verbatim at the line it cites', () => {
        /**
         * The load-bearing check, and the same property the inventory fixture is
         * held to. A quote that does not appear where it claims to means the
         * occurrence cannot be located, so the claim cannot be adjudicated
         * against the report it supposedly came from.
         */
        const out = run([claim({ occurrences: [{ line: 2, quote: 'Table zz_demo_widget is absent' }] })]);
        expect(out.claims).toEqual([]);
        expect(out.rejected).toHaveLength(1);
        expect(out.rejected[0].reason).toMatch(/verbatim/i);
    });

    test('rejects a quote that is verbatim but on a different line', () => {
        // Off-by-one line numbers are the likeliest model error and the one a
        // naive "does this string appear anywhere" check would wave through.
        const out = run([claim({ occurrences: [{ line: 3, quote: 'Table zz_demo_widget exists' }] })]);
        expect(out.rejected).toHaveLength(1);
        expect(out.rejected[0].reason).toMatch(/verbatim/i);
    });

    test('rejects a line number outside the report', () => {
        const out = run([claim({ occurrences: [{ line: 99, quote: 'Table zz_demo_widget exists' }] })]);
        expect(out.rejected).toHaveLength(1);
        expect(out.rejected[0].reason).toMatch(/line/i);
    });

    test('rejects a zero or negative line number rather than treating it as an index', () => {
        for (const bad of [0, -1]) {
            const out = run([claim({ occurrences: [{ line: bad, quote: 'The widget registry' }] })]);
            expect(out.rejected).toHaveLength(1);
        }
    });

    test('rejects an unknown kind', () => {
        const out = run([claim({ kind: 'vibe' })]);
        expect(out.rejected).toHaveLength(1);
        expect(out.rejected[0].reason).toMatch(/kind/i);
    });

    test('rejects an empty or missing proposition', () => {
        for (const bad of ['', '   ', undefined]) {
            const out = run([claim({ proposition: bad })]);
            expect(out.rejected).toHaveLength(1);
            expect(out.rejected[0].reason).toMatch(/proposition/i);
        }
    });

    test('rejects a claim with no occurrences', () => {
        const out = run([claim({ occurrences: [] })]);
        expect(out.rejected).toHaveLength(1);
        expect(out.rejected[0].reason).toMatch(/occurrence/i);
    });

    test('a rejected claim is RECORDED, never silently dropped', () => {
        /**
         * A dropped claim depresses recall while looking like an enumeration
         * miss, which would blame the model for a plumbing failure. Rejections
         * are part of the frozen artifact so the figure can account for them.
         */
        const out = run([claim(), claim({ proposition: 'Bad one.', occurrences: [{ line: 2, quote: 'nope' }] })]);
        expect(out.claims).toHaveLength(1);
        expect(out.rejected).toHaveLength(1);
        expect(out.rejected[0].claim.proposition).toBe('Bad one.');
    });
});

describe('claim extraction — polarity (§AX13), and why a missing one does NOT reject the claim', () => {
    test('a valid polarity is carried through verbatim', () => {
        for (const p of ['asserts', 'denies']) {
            const out = run([claim({ polarity: p })]);
            expect(out.rejected).toEqual([]);
            expect(out.claims[0].polarity).toBe(p);
        }
    });

    test('a missing polarity keeps the claim and records the defect', () => {
        /**
         * The distinction this test exists to protect. Recall measures
         * ENUMERATION — whether the extractor found the claim — and a claim
         * found without its polarity was still found. Rejecting it would move
         * it out of `claims` and depress recall for a reason that has nothing
         * to do with enumeration, blaming the model's detection for a defect in
         * its formatting.
         *
         * Polarity governs ADJUDICABILITY instead, and the instrument already
         * has a verdict for a claim it cannot adjudicate. So the claim survives
         * with no polarity, the defect is recorded in the frozen artifact, and
         * the adjudicator returns `unresolvable` on it (§AX13.3).
         */
        const out = run([claim({ polarity: undefined })]);
        expect(out.rejected).toEqual([]);
        expect(out.claims).toHaveLength(1);
        expect(out.claims[0].polarity).toBeUndefined();
        expect(out.defects).toEqual([
            { proposition: 'Table zz_demo_widget exists.', field: 'polarity', reason: 'polarity is missing' },
        ]);
    });

    test('an unrecognised polarity is not coerced to one of the two', () => {
        /**
         * Coercing `probably` to `asserts` would manufacture the very
         * distinction §AX13.1 says the instrument cannot draw, and it would do
         * it silently. The value is dropped, the defect is recorded with what
         * was emitted, and the claim becomes unadjudicable rather than wrongly
         * adjudicated.
         */
        const out = run([claim({ polarity: 'probably' })]);
        expect(out.claims[0].polarity).toBeUndefined();
        expect(out.defects[0].reason).toMatch(/probably/);
    });

    test('defects are ordered by content, not by arrival', () => {
        const a = claim({ proposition: 'Bravo claim.', polarity: undefined, occurrences: [{ line: 4, quote: 'Four records' }] });
        const b = claim({ proposition: 'Alpha claim.', polarity: 'sideways', occurrences: [{ line: 5, quote: 'three calls' }] });
        const forward = run([a, b]).defects.map((d) => d.proposition);
        const backward = run([b, a]).defects.map((d) => d.proposition);
        expect(forward).toEqual(backward);
        expect(forward).toEqual(['Alpha claim.', 'Bravo claim.']);
    });

    test('polarity disagreement across variants of one proposition is recorded as a conflict', () => {
        /**
         * Same rule the module already applies to `kind` and `subject`: a model
         * contradicting itself is a finding about the extraction, not noise to
         * be tidied. Without polarity in the variant key, one of the two would
         * be chosen by arrival order and the disagreement would vanish.
         */
        const out = run([claim({ polarity: 'asserts' }), claim({ polarity: 'denies' })]);
        expect(out.claims).toHaveLength(1);
        expect(out.conflicts).toHaveLength(1);
        expect(out.conflicts[0].kept.polarity).toBe('asserts');
        expect(out.conflicts[0].discarded[0].polarity).toBe('denies');
    });
});

describe('claim extraction — asserted_value is recorded and never interpreted (§AX13.2)', () => {
    test('an asserted value is carried through byte-for-byte', () => {
        const out = run([claim({ kind: 'field_value', asserted_value: '  pending  ' })]);
        expect(out.claims[0].asserted_value).toBe('  pending  ');
    });

    test('a claim asserting no particular value carries no key at all', () => {
        // Absent, not empty-string: an empty value is itself an assertion about
        // a field, and the two must stay distinguishable in the artifact.
        const out = run([claim()]);
        expect(Object.prototype.hasOwnProperty.call(out.claims[0], 'asserted_value')).toBe(false);
    });

    test('a non-string asserted value is recorded as a defect rather than stringified', () => {
        const out = run([claim({ asserted_value: 4 })]);
        expect(Object.prototype.hasOwnProperty.call(out.claims[0], 'asserted_value')).toBe(false);
        expect(out.defects[0].field).toBe('asserted_value');
    });
});

describe('claim extraction — dedup by proposition', () => {
    test('merges repeated propositions and keeps every occurrence', () => {
        // The prompt asks for one entry per distinct proposition with repeats as
        // occurrences; a model that emits the repeat twice is normalised here
        // rather than being counted twice in the denominator.
        const p = 'Record 1111aaaa2222bbbb3333cccc4444dddd has calibration_state pending.';
        const out = run([
            claim({ proposition: p, kind: 'field_value', occurrences: [{ line: 3, quote: 'calibration_state set to pending' }] }),
            claim({ proposition: p, kind: 'field_value', occurrences: [{ line: 8, quote: 'calibration_state set to pending' }] }),
        ]);
        expect(out.claims).toHaveLength(1);
        expect(out.claims[0].occurrences).toHaveLength(2);
        expect(out.claims[0].occurrences.map((o) => o.line)).toEqual([3, 8]);
    });

    test('dedup ignores surrounding whitespace but not wording', () => {
        const out = run([
            claim({ proposition: 'Table zz_demo_widget exists.' }),
            claim({ proposition: '  Table zz_demo_widget exists.  ' }),
            claim({ proposition: 'Table zz_demo_widget does not exist.' }),
        ]);
        expect(out.claims).toHaveLength(2);
    });

    test('duplicate occurrences within one claim collapse', () => {
        const out = run([
            claim({
                occurrences: [
                    { line: 2, quote: 'Table zz_demo_widget exists' },
                    { line: 2, quote: 'Table zz_demo_widget exists' },
                ],
            }),
        ]);
        expect(out.claims[0].occurrences).toHaveLength(1);
    });
});

describe('claim extraction — deterministic ordering and identity', () => {
    const shuffled = [
        claim({ proposition: 'Zeta claim.', occurrences: [{ line: 5, quote: 'three calls' }] }),
        claim({ proposition: 'Alpha claim.', occurrences: [{ line: 2, quote: 'zz_demo_widget' }] }),
        claim({ proposition: 'Mid claim.', occurrences: [{ line: 4, quote: 'pending state' }] }),
    ];

    test('claims sort by first occurrence line, then proposition', () => {
        const out = run(shuffled);
        expect(out.claims.map((c) => c.proposition)).toEqual(['Alpha claim.', 'Mid claim.', 'Zeta claim.']);
    });

    test('arrival order cannot reach the output', () => {
        // Brief §7's requirement in its testable form: two runs over the same
        // claims in different orders must be byte-identical.
        const forward = extraction.serialise(run(shuffled));
        const reversed = extraction.serialise(run(shuffled.slice().reverse()));
        expect(forward).toBe(reversed);
    });

    test('arrival order cannot reach the output THROUGH ANY PATH', () => {
        /**
         * The test above was the guard for the module's central guarantee and it
         * could not see three real violations of it (review of PR #255): its
         * fixture had three DISTINCT propositions, no duplicate proposition
         * carrying a different kind/subject, and NO rejections — so the dedup
         * path and the `rejected` array were both unexercised in the reversed
         * run. All three were arrival-order dependent and shipped green.
         *
         * This fixture drives every path that reaches the artifact at once.
         * Recorded rather than folded into the test above, because the lesson is
         * that a determinism test is only as good as the paths its fixture
         * touches.
         */
        const mixed = [
            claim({ proposition: 'Shared.', kind: 'existence', subject: { table: 'zz_demo_widget' } }),
            claim({ proposition: 'Shared.', kind: 'count', subject: { field: 'calibration_state', table: 'zz_demo_widget' } }),
            claim({ proposition: 'Later.', occurrences: [{ line: 4, quote: 'pending state' }] }),
            claim({ proposition: 'Bad one.', occurrences: [{ line: 2, quote: 'not present here' }] }),
            claim({ proposition: 'Bad two.', occurrences: [{ line: 99, quote: 'The widget registry' }] }),
        ];
        const forward = extraction.serialise(run(mixed));
        const reversed = extraction.serialise(run(mixed.slice().reverse()));
        expect(forward).toBe(reversed);

        // And the fixture genuinely exercises what it claims to.
        const out = run(mixed);
        expect(out.rejected).toHaveLength(2);
        expect(out.conflicts).toHaveLength(1);
    });

    test('a subject key order emitted by the model cannot reach the artifact', () => {
        // `{table, field}` and `{field, table}` are the same subject. Passing the
        // parsed object through by reference made them different bytes.
        const a = claim({ subject: { table: 'zz_demo_widget', field: 'calibration_state' } });
        const b = claim({ subject: { field: 'calibration_state', table: 'zz_demo_widget' } });
        expect(extraction.serialise(run([a]))).toBe(extraction.serialise(run([b])));
        expect(Object.keys(run([b]).claims[0].subject)).toEqual(['table', 'field']);
    });

    test('a subject key the module does not recognise is kept, not discarded', () => {
        // An unrecognised key is data this module has no standing to drop; it is
        // ordered deterministically after the known ones instead.
        const out = run([claim({ subject: { field: 'calibration_state', zzz: 'x', table: 'zz_demo_widget' } })]);
        expect(Object.keys(out.claims[0].subject)).toEqual(['table', 'field', 'zzz']);
    });

    test('rejections are ordered by content, not by arrival', () => {
        const first = claim({ proposition: 'Aaa.', occurrences: [{ line: 4, quote: 'wrong' }] });
        const second = claim({ proposition: 'Bbb.', occurrences: [{ line: 2, quote: 'wrong' }] });
        for (const order of [[first, second], [second, first]]) {
            expect(run(order).rejected.map((r) => r.claim.proposition)).toEqual(['Bbb.', 'Aaa.']);
        }
    });

    test('a rejection citing no line at all still orders deterministically', () => {
        // Rejections often cite nothing usable — that is frequently why they were
        // rejected — so the ordering key must not assume a valid occurrence.
        const noOcc = claim({ proposition: 'No occurrences.', occurrences: [] });
        const badLine = claim({ proposition: 'Bad line.', occurrences: [{ line: 99, quote: 'The widget registry' }] });
        for (const order of [[noOcc, badLine], [badLine, noOcc]]) {
            expect(run(order).rejected.map((r) => r.claim.proposition)).toEqual(['Bad line.', 'No occurrences.']);
        }
    });

    test('propositions on the same line tie-break deterministically', () => {
        const a = claim({ proposition: 'B second.', occurrences: [{ line: 2, quote: 'zz_demo_widget' }] });
        const b = claim({ proposition: 'A first.', occurrences: [{ line: 2, quote: 'zz_demo_widget' }] });
        expect(run([a, b]).claims.map((c) => c.proposition)).toEqual(['A first.', 'B second.']);
        expect(run([b, a]).claims.map((c) => c.proposition)).toEqual(['A first.', 'B second.']);
    });

    test('ids are assigned after sorting, namespaced to the report, and gap-free', () => {
        const out = run(shuffled);
        expect(out.claims.map((c) => c.id)).toEqual(['demo-01/E01', 'demo-01/E02', 'demo-01/E03']);
    });

    test('occurrences within a claim sort by line', () => {
        const out = run([
            claim({
                occurrences: [
                    { line: 8, quote: 'calibration_state set to pending' },
                    { line: 3, quote: 'calibration_state set to pending' },
                ],
            }),
        ]);
        expect(out.claims[0].occurrences.map((o) => o.line)).toEqual([3, 8]);
    });
});

describe('claim extraction — a model contradicting itself is recorded, not tidied away', () => {
    const variantA = claim({ proposition: 'Shared.', kind: 'existence', subject: { table: 'zz_demo_widget' } });
    const variantB = claim({ proposition: 'Shared.', kind: 'count', subject: { table: 'zz_demo_widget' } });

    test('the surviving variant is chosen by content order, not arrival order', () => {
        // 'count' sorts before 'existence', so it wins from either direction.
        expect(run([variantA, variantB]).claims[0].kind).toBe('count');
        expect(run([variantB, variantA]).claims[0].kind).toBe('count');
    });

    test('the discarded variant is recorded with what replaced it', () => {
        const out = run([variantA, variantB]);
        expect(out.conflicts).toHaveLength(1);
        expect(out.conflicts[0].proposition).toBe('Shared.');
        expect(out.conflicts[0].kept.kind).toBe('count');
        expect(out.conflicts[0].discarded.map((d) => d.kind)).toEqual(['existence']);
    });

    test('the claim itself survives, so a model inconsistency cannot depress recall', () => {
        // Rejecting the whole claim over a kind disagreement would turn a
        // reporting problem into a missing claim, which is the one failure the
        // recall figure cannot distinguish from an enumeration miss.
        const out = run([variantA, variantB]);
        expect(out.claim_count).toBe(1);
        expect(out.claims[0].proposition).toBe('Shared.');
    });

    test('agreeing duplicates produce no conflict record', () => {
        expect(run([variantA, claim({ proposition: 'Shared.', kind: 'existence', subject: { table: 'zz_demo_widget' } })]).conflicts).toEqual([]);
    });
});

describe('claim extraction — the zero-claim result is legitimate', () => {
    test('an empty claim list normalises to a zero-claim record, not an error', () => {
        // §AX10 found reports with bodies that assert nothing about instance
        // state. Treating that as a failure would push the model toward
        // inventing claims to avoid an error path.
        const out = run([]);
        expect(out.claims).toEqual([]);
        expect(out.claim_count).toBe(0);
        expect(out.rejected).toEqual([]);
    });

    test('claim_count reflects accepted claims only', () => {
        const out = run([claim(), claim({ proposition: 'Bad.', occurrences: [{ line: 2, quote: 'nope' }] })]);
        expect(out.claim_count).toBe(1);
    });
});

describe('claim extraction — a record must know which report it came from', () => {
    test('a missing report id throws rather than producing a malformed artifact', () => {
        /**
         * Without this, a driver wiring mistake yields ids like `undefined/E01`
         * and a record whose `report` key JSON.stringify drops entirely — a
         * frozen artifact that is silently wrong rather than a failure that
         * stops the sweep (review of PR #255).
         */
        for (const bad of [undefined, '', '   ']) {
            expect(() => extraction.normalise({ claims: [] }, { report: bad, arm: 'native', lines: REPORT })).toThrow(
                /report/i
            );
        }
        expect(() => extraction.normalise({ claims: [] }, undefined)).toThrow(/report/i);
    });
});

describe('claim extraction — the module is inert on import', () => {
    test('exports pure functions and holds no instance client', () => {
        // Brief §7: "No network calls at import time. The instance client is
        // injected, not constructed inline." The extractor needs no instance at
        // all — adjudication is a separate artifact — so the strongest form of
        // that property is that there is nothing here to inject into.
        for (const name of ['normalise', 'serialise', 'stableKey', 'validateClaim']) {
            expect(typeof extraction[name]).toBe('function');
        }
        const surface = Object.keys(extraction).join(' ').toLowerCase();
        for (const forbidden of ['client', 'connect', 'request', 'fetch', 'instance']) {
            expect(surface).not.toContain(forbidden);
        }
    });

    test('serialise emits stable, diffable JSON with a trailing newline', () => {
        const text = extraction.serialise(run([claim()]));
        expect(text.endsWith('\n')).toBe(true);
        expect(JSON.parse(text).claims[0].id).toBe('demo-01/E01');
        expect(text).toBe(extraction.serialise(run([claim()])));
    });
});
