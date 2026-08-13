'use strict';

/**
 * Unit tests for the deterministic adjudicator
 * (`benchmark/scripts/claim-adjudication.js`).
 *
 * ---------------------------------------------------------------------------
 * WHAT THE ADJUDICATOR IS, AND WHY IT IS TESTABLE WITHOUT AN INSTANCE
 * ---------------------------------------------------------------------------
 * §AW3: "adjudication is a DETERMINISTIC MEMBERSHIP TEST over a metadata read —
 * no model judgement, no scorer packet, no rubric." Brief §7 adds: "no network
 * calls at import time; the instance client is injected, not constructed
 * inline."
 *
 * So the whole verdict logic is exercised here against a stub read. Every branch
 * has a test, and the branch that matters most — a control that did not come
 * back, which must yield `unresolvable` and never a verdict — has several,
 * because it is the one brief §7 names as easiest to leave uncovered.
 *
 * ---------------------------------------------------------------------------
 * THE FIXTURES ARE INVENTED
 * ---------------------------------------------------------------------------
 * Same rule as the extractor's tests, and mechanically enforced by
 * test/extractorClearing.test.js over this file: an adjudicator whose tests
 * drifted toward corpus vocabulary would be tuned to the corpus through its
 * test suite.
 */

const adjudication = require('../benchmark/scripts/claim-adjudication');

/** A schema read as the injected client returns it: target and control together. */
function read(over) {
    return Object.assign(
        {
            table_exists: true,
            fields: ['sys_id', 'calibration_state', 'zz_label'],
            control: { name: 'zz_control_table', exists: true },
        },
        over || {}
    );
}

/** A probe that answers every table with one canned read. */
function probeReturning(result) {
    return function () {
        return result;
    };
}

function claim(over) {
    return Object.assign(
        {
            id: 'demo-01/E01',
            proposition: 'Table zz_demo_widget carries a column named calibration_state.',
            kind: 'existence',
            polarity: 'asserts',
            subject: { table: 'zz_demo_widget', field: 'calibration_state' },
        },
        over || {}
    );
}

function verdictOf(c, r) {
    return adjudication.adjudicate(c, probeReturning(r === undefined ? read() : r));
}

describe('adjudication — the three-valued verdict is exhaustive and nothing else is emitted', () => {
    test('every verdict is one of the three registered values', () => {
        const cases = [
            claim(),
            claim({ polarity: 'denies' }),
            claim({ kind: 'count', subject: { table: 'zz_demo_widget' } }),
            claim({ polarity: undefined }),
            claim({ subject: undefined }),
        ];
        for (const c of cases) {
            expect(adjudication.VERDICTS).toContain(verdictOf(c).verdict);
        }
    });

    test('a verdict always carries its reason and its evidence', () => {
        /**
         * §5.5, applied one layer up: "a null result is only worth its probe's
         * sensitivity — record the controls next to the null, always." A verdict
         * whose evidence is not recorded cannot be audited after the fact, and
         * this pass is not repeatable.
         */
        const out = verdictOf(claim());
        expect(typeof out.reason).toBe('string');
        expect(out.reason.length).toBeGreaterThan(0);
        expect(out.evidence).toMatchObject({ table_exists: true, field_present: true });
    });
});

describe('adjudication — schema existence, the only route that can return `supported` (§AX13.3)', () => {
    test('a column asserted present and observed present is supported', () => {
        expect(verdictOf(claim()).verdict).toBe('supported');
    });

    test('a column asserted present and observed absent is refuted', () => {
        const out = verdictOf(claim({ subject: { table: 'zz_demo_widget', field: 'zz_absent' } }));
        expect(out.verdict).toBe('refuted');
    });

    test('a column denied and observed absent is supported — the report was right about an absence', () => {
        /**
         * The case a polarity-blind adjudicator would have got exactly wrong,
         * and the reason §AX13 amended the prompt rather than guessing here.
         */
        const out = verdictOf(claim({ polarity: 'denies', subject: { table: 'zz_demo_widget', field: 'zz_absent' } }));
        expect(out.verdict).toBe('supported');
    });

    test('a column denied but observed present is refuted', () => {
        expect(verdictOf(claim({ polarity: 'denies' })).verdict).toBe('refuted');
    });

    test('a table asserted present and observed absent is refuted', () => {
        const out = verdictOf(
            claim({ subject: { table: 'zz_missing' } }),
            read({ table_exists: false, fields: [] })
        );
        expect(out.verdict).toBe('refuted');
    });

    test('a table denied and observed absent is supported', () => {
        const out = verdictOf(
            claim({ polarity: 'denies', subject: { table: 'zz_missing' } }),
            read({ table_exists: false, fields: [] })
        );
        expect(out.verdict).toBe('supported');
    });
});

describe('adjudication — presupposition refutation, and it does not depend on polarity', () => {
    test('a value claim about a column the schema does not have is refuted whatever it asserted', () => {
        /**
         * The shape of the known false claim, and the only route that survives
         * the mutability rule: what the column was said to contain cannot matter
         * when the column is not there.
         */
        for (const polarity of ['asserts', 'denies']) {
            const out = verdictOf(
                claim({
                    kind: 'field_value',
                    polarity: polarity,
                    asserted_value: 'pending',
                    subject: { table: 'zz_demo_widget', record: 'a1b2c3', field: 'zz_absent' },
                })
            );
            expect(out.verdict).toBe('refuted');
            expect(out.reason).toBe('presupposed_field_absent');
        }
    });

    test('a count claim about a table the instance does not have is refuted', () => {
        const out = verdictOf(
            claim({ kind: 'count', subject: { table: 'zz_missing' } }),
            read({ table_exists: false, fields: [] })
        );
        expect(out.verdict).toBe('refuted');
        expect(out.reason).toBe('presupposed_table_absent');
    });

    test('the same claim on a column that IS present is unresolvable, not supported', () => {
        /**
         * The presupposition holding is not the claim holding. Calling this
         * `supported` would report a verdict about the value on the strength of
         * the column merely existing — §AW2's fabrication, one step removed.
         */
        const out = verdictOf(
            claim({ kind: 'field_value', asserted_value: 'pending', subject: { table: 'zz_demo_widget', field: 'calibration_state' } })
        );
        expect(out.verdict).toBe('unresolvable');
        expect(out.reason).toBe('mutable');
    });
});

describe('adjudication — the control-failure path, which must never produce a verdict', () => {
    test('an absent column with no control field in the same read is unresolvable', () => {
        /**
         * An empty or truncated metadata read is indistinguishable from a table
         * that genuinely lacks the column. The control is a field every table on
         * this platform carries, observed in the SAME read: if it is missing,
         * the read is broken and the absence is worth nothing.
         */
        const out = verdictOf(claim({ subject: { table: 'zz_demo_widget', field: 'zz_absent' } }), read({ fields: [] }));
        expect(out.verdict).toBe('unresolvable');
        expect(out.reason).toBe('control_failed');
    });

    test('an absent table whose control table also failed to read is unresolvable', () => {
        const out = verdictOf(
            claim({ subject: { table: 'zz_missing' } }),
            read({ table_exists: false, fields: [], control: { name: 'zz_control_table', exists: false } })
        );
        expect(out.verdict).toBe('unresolvable');
        expect(out.reason).toBe('control_failed');
    });

    test('the control failure is recorded in the evidence, not merely acted on', () => {
        const out = verdictOf(claim({ subject: { table: 'zz_demo_widget', field: 'zz_absent' } }), read({ fields: [] }));
        expect(out.evidence.control_field_present).toBe(false);
    });

    test('a control failure cannot be rescued by polarity', () => {
        // Both directions route to unresolvable: the read is untrustworthy, and
        // which way it would have cut is not a question the instrument may ask.
        for (const polarity of ['asserts', 'denies']) {
            const out = verdictOf(
                claim({ polarity: polarity, subject: { table: 'zz_demo_widget', field: 'zz_absent' } }),
                read({ fields: [] })
            );
            expect(out.verdict).toBe('unresolvable');
        }
    });

    test('a PRESENT observation needs no control, because it is self-evidencing (§AW11c)', () => {
        /**
         * The direction correction: an empty read is indistinguishable from a
         * broken read, but observing the thing present is not — nothing about a
         * broken probe manufactures a row that is there.
         */
        const out = verdictOf(claim(), read({ fields: ['calibration_state'] }));
        expect(out.verdict).toBe('supported');
    });
});

describe('adjudication — mutable state is never adjudicated (§AW5 E-2, brief §2.2)', () => {
    test('counts, record existence, identity and state all route to unresolvable', () => {
        const mutable = [
            claim({ kind: 'count', subject: { table: 'zz_demo_widget' } }),
            claim({ kind: 'existence', subject: { table: 'zz_demo_widget', record: 'a1b2c3' } }),
            claim({ kind: 'identity', subject: { table: 'zz_demo_widget', record: 'a1b2c3' } }),
            claim({ kind: 'state', subject: { table: 'zz_demo_widget', record: 'a1b2c3' } }),
        ];
        for (const c of mutable) {
            const out = verdictOf(c);
            expect(out.verdict).toBe('unresolvable');
            expect(out.reason).toBe('mutable');
        }
    });

    test('a decisive-looking read does not rescue a mutable claim', () => {
        /**
         * Brief §2.2: "if a claim's truth can have changed between then and now
         * it is unresolvable, and it is unresolvable EVEN WHEN today's read
         * looks decisive." The reference state is the run, and the run cannot be
         * re-read.
         */
        const out = verdictOf(claim({ kind: 'count', asserted_value: 'four', subject: { table: 'zz_demo_widget' } }));
        expect(out.verdict).toBe('unresolvable');
    });
});

describe('adjudication — claims the instrument cannot reduce to a test', () => {
    test('a claim with no polarity is unresolvable, never guessed', () => {
        const out = verdictOf(claim({ polarity: undefined }));
        expect(out.verdict).toBe('unresolvable');
        expect(out.reason).toBe('no_polarity');
    });

    test('a claim naming no table is unresolvable — there is nothing to probe', () => {
        expect(verdictOf(claim({ subject: undefined })).reason).toBe('no_subject_table');
        expect(verdictOf(claim({ subject: { record: 'a1b2c3' } })).reason).toBe('no_subject_table');
    });

    test('a probe that returns nothing usable is unresolvable, never refuted', () => {
        for (const bad of [null, undefined, {}, { table_exists: true }]) {
            const out = adjudication.adjudicate(claim(), probeReturning(bad));
            expect(out.verdict).toBe('unresolvable');
            expect(out.reason).toBe('probe_failed');
        }
    });

    test('a probe that throws is unresolvable, and the error is recorded', () => {
        const out = adjudication.adjudicate(claim(), function () {
            throw new Error('gateway timeout');
        });
        expect(out.verdict).toBe('unresolvable');
        expect(out.reason).toBe('probe_failed');
        expect(out.evidence.error).toMatch(/gateway timeout/);
    });
});

describe('adjudication — determinism and inertness', () => {
    test('the module holds no client and makes no call at import', () => {
        expect(typeof adjudication.adjudicate).toBe('function');
        for (const key of Object.keys(adjudication)) {
            expect(['function', 'object', 'string']).toContain(typeof adjudication[key]);
        }
        expect(Object.keys(adjudication)).not.toContain('client');
    });

    test('the same claim and the same read give the same verdict every time', () => {
        const first = verdictOf(claim());
        const second = verdictOf(claim());
        expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    test('adjudicateAll orders by claim id, not by arrival', () => {
        const a = claim({ id: 'demo-01/E02' });
        const b = claim({ id: 'demo-01/E01' });
        const probe = probeReturning(read());
        const forward = adjudication.adjudicateAll([a, b], probe).map((r) => r.id);
        const backward = adjudication.adjudicateAll([b, a], probe).map((r) => r.id);
        expect(forward).toEqual(['demo-01/E01', 'demo-01/E02']);
        expect(forward).toEqual(backward);
    });

    test('adjudicateAll reads each table once, so a control is paired with its own call', () => {
        /**
         * Brief §2.1: the control is probed "in the same call and the same auth
         * context". Re-reading per claim would let a claim be adjudicated
         * against one read and its control against another.
         */
        const seen = [];
        const probe = function (table) {
            seen.push(table);
            return read();
        };
        adjudication.adjudicateAll([claim({ id: 'demo-01/E01' }), claim({ id: 'demo-01/E02' })], probe);
        expect(seen).toEqual(['zz_demo_widget']);
    });
});
