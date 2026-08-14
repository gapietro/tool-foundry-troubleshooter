'use strict';
/**
 * The §AX15 retry bound, and the sweep driver's refusals.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS ACTUALLY UNDER TEST
 * ---------------------------------------------------------------------------
 * §AX15.1 registers a permission ("retry once") and immediately observes that
 * the permission does not carry itself: "retry on failure" is a judgement unless
 * *failure* is decided mechanically. The bound is therefore the artifact, and
 * the bound is what these tests point at.
 *
 * The cases that matter are the ones where a retry would be WRONG, because
 * those are the ones a re-roll would travel through:
 *
 *   - a well-formed empty envelope, which is the registered correct answer for a
 *     report asserting nothing about instance state;
 *   - an envelope whose CONTENT looks thin or was partly rejected.
 *
 * Each is asserted to be non-retryable directly, rather than left to follow from
 * the shape of the implementation. §AX14.7's lesson is the reason: a rule and
 * its enforcement are different artifacts, and both defects found there were the
 * registered principle defeated by a mechanical detail in the module written to
 * enforce it.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const sweep = require('../benchmark/scripts/claim-extraction-sweep');

/**
 * A throwaway corpus, so the refusal paths can be constructed.
 *
 * Names here are fixtures of this test and not members of the real corpus — the
 * driver enumerates whatever directory it is pointed at, which is the property
 * that lets this exist at all.
 */
function makeRoot(reports) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-'));
    const reportDir = path.join(root, 'benchmark', 'v14-reports');
    const rawDir = path.join(root, 'benchmark', 'extraction', 'v14', 'raw');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.mkdirSync(rawDir, { recursive: true });

    const pass = [];
    reports.forEach((report, i) => {
        fs.writeFileSync(path.join(reportDir, report.name + '.md'), report.body || 'a line\n', 'utf8');
        pass.push({ row: i + 1, arm: report.arm });
        (report.attempts || []).forEach((text, j) => {
            fs.writeFileSync(path.join(rawDir, report.name + '.attempt-' + (j + 1) + '.raw.json'), text, 'utf8');
        });
    });
    fs.writeFileSync(path.join(root, 'benchmark', 'v14-rows.json'), JSON.stringify(pass), 'utf8');
    return root;
}

const WELL_FORMED = JSON.stringify({
    claims: [
        {
            proposition: 'A table named alpha exists.',
            kind: 'existence',
            polarity: 'asserts',
            subject: { table: 'alpha' },
            occurrences: [{ line: 1, quote: 'a line' }],
        },
    ],
});

describe('§AX15.2 — what may be retried is decided by the parser', () => {
    test('an emission that does not parse is an envelope defect', () => {
        expect(sweep.envelopeDefect('{not json').defect).toBe('unparseable');
    });

    test('an emission that parses without a claims array is an envelope defect', () => {
        expect(sweep.envelopeDefect('{"result": "none"}').defect).toBe('no_claims_array');
        expect(sweep.envelopeDefect('{"claims": {}}').defect).toBe('no_claims_array');
        expect(sweep.envelopeDefect('[]').defect).toBe('no_claims_array');
        expect(sweep.envelopeDefect('null').defect).toBe('no_claims_array');
    });

    test('an EMPTY but well-formed envelope is not a defect', () => {
        /**
         * The load-bearing one. This is the registered result for a report that
         * asserts nothing about instance state, and reports in this corpus are
         * structurally claim-free (§AX4). If it were retryable, the instrument
         * would re-roll exactly the reports whose correct answer is nothing —
         * and it would do so while looking like ordinary error handling.
         */
        expect(sweep.envelopeDefect('{"claims": []}')).toBeNull();
    });

    test('content is never an envelope defect', () => {
        /**
         * A claim missing its required fields is a REJECTION, recorded by
         * claim-extraction.js rather than dropped. If thin or partly invalid
         * content could trigger a retry, "the emission looked wrong" would
         * become a retry ground — the discretionary door §AX15.1 says the
         * bound exists to close.
         */
        const thin = JSON.stringify({ claims: [{ proposition: 'no kind, no occurrences' }] });
        expect(sweep.envelopeDefect(thin)).toBeNull();
    });

    test('at most one retry — a third attempt is refused at construction', () => {
        const root = makeRoot([
            { name: 'a-01', arm: 'native', attempts: ['{bad', '{bad', WELL_FORMED] },
        ]);
        expect(() => sweep.survey(root)).toThrow(/permitted attempts/);
    });

    test('a retry with no defect behind it is REFUSED, not merely logged', () => {
        /**
         * §AX15.2 permits a retry only ON an envelope defect. The attempt COUNT
         * was enforced from the start; the GROUND was only recorded, so a second
         * attempt whose predecessor parsed cleanly was accepted and frozen — a
         * re-roll, visible in the manifest but not refused, under a header
         * claiming the bound is enforced rather than described (review of PR
         * #258).
         */
        const root = makeRoot([{ name: 'a-01', arm: 'native', attempts: [WELL_FORMED, WELL_FORMED] }]);
        expect(() => sweep.survey(root)).toThrow(/parsed cleanly and was retried anyway/);
        expect(() => sweep.freeze(root)).toThrow(/parsed cleanly and was retried anyway/);
    });

    test('an empty envelope followed by a retry is refused too — it is not a defect', () => {
        // The load-bearing pairing: `{"claims": []}` is a valid result, so a
        // retry after one is a re-roll of exactly the reports whose correct
        // answer is nothing.
        const root = makeRoot([{ name: 'a-01', arm: 'native', attempts: ['{"claims": []}', WELL_FORMED] }]);
        expect(() => sweep.survey(root)).toThrow(/parsed cleanly and was retried anyway/);
    });

    test('a missing earlier attempt is refused — the audit rests on all of them being there', () => {
        const root = makeRoot([{ name: 'a-01', arm: 'native' }]);
        const rawDir = path.join(root, 'benchmark', 'extraction', 'v14', 'raw');
        fs.writeFileSync(path.join(rawDir, 'a-01.attempt-2.raw.json'), WELL_FORMED, 'utf8');
        expect(() => sweep.survey(root)).toThrow(/not contiguous/);
    });
});

describe('the driver freezes all or nothing', () => {
    test('a report with no emission blocks the freeze, and is distinguished from a defective one', () => {
        const root = makeRoot([
            { name: 'a-01', arm: 'native', attempts: [WELL_FORMED] },
            { name: 'a-02', arm: 'custom' },
        ]);
        const surveyed = sweep.survey(root);
        expect(surveyed.map((r) => r.status)).toEqual(['ok', 'missing']);
        expect(() => sweep.freeze(root)).toThrow(/partial sweep/);
        expect(fs.existsSync(path.join(root, 'benchmark', 'extraction', 'v14', 'a-01.json'))).toBe(false);
    });

    test('a defective last attempt blocks the freeze', () => {
        /**
         * Both attempts defective — a report that used its one retry and still
         * came back malformed. The earlier version of this test put a CLEAN
         * attempt first, which the §AX15.2 ground check now refuses outright as
         * an ungrounded retry; that scenario is no longer constructible, which
         * is the point of the check.
         */
        const root = makeRoot([{ name: 'a-01', arm: 'native', attempts: ['{bad', '{alsobad'] }]);
        expect(sweep.survey(root)[0].status).toBe('defective');
        expect(() => sweep.freeze(root)).toThrow(/partial sweep/);
    });

    test('a retry that succeeded freezes the LAST attempt and records both', () => {
        const root = makeRoot([{ name: 'a-01', arm: 'native', attempts: ['{bad', WELL_FORMED] }]);
        const manifest = sweep.freeze(root);
        expect(manifest[0].claim_count).toBe(1);
        expect(manifest[0].attempts).toBe(2);
        expect(manifest[0].attempt_log.map((a) => a.envelope_defect)).toEqual(['unparseable', null]);
    });

    test('the manifest logs the successful attempt too, so the retry ground is auditable', () => {
        /**
         * §AX15.3's audit needs successful attempts in the log, not only failed
         * ones — otherwise a justified retry and an unjustified one look the
         * same from outside. (The unjustified case is now refused outright by
         * the test above; this keeps the record legible for the justified one.)
         */
        const root = makeRoot([{ name: 'a-01', arm: 'native', attempts: ['{bad', WELL_FORMED] }]);
        const manifest = sweep.freeze(root);
        expect(manifest[0].attempt_log).toHaveLength(2);
        expect(manifest[0].attempt_log[1].envelope_defect).toBeNull();
    });

    test('freeze writes NOTHING when a later report fails to normalise', () => {
        /**
         * All-or-nothing covered envelope defects only: normalise ran inside the
         * write loop, so a throw on a later report left earlier artifacts on
         * disk with no manifest — a half-frozen tree that reads as complete to a
         * later scorer run (review of PR #258).
         *
         * DELETING the later report does not reproduce it — `discoverReports`
         * enumerates the directory, so a deleted report is simply not swept.
         * Making it UNREADABLE does: it is still discovered, and the read throws
         * during the build phase, which is the shape this guards.
         */
        const root = makeRoot([
            { name: 'a-01', arm: 'native', attempts: [WELL_FORMED] },
            { name: 'a-02', arm: 'custom', attempts: [WELL_FORMED] },
        ]);
        fs.chmodSync(path.join(root, 'benchmark', 'v14-reports', 'a-02.md'), 0o000);
        expect(() => sweep.freeze(root)).toThrow();
        expect(fs.existsSync(path.join(root, 'benchmark', 'extraction', 'v14', 'a-01.json'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'benchmark', 'extraction', 'v14', 'manifest.json'))).toBe(false);
    });
});

describe('the driver encodes nothing about the corpus', () => {
    test('an unrecorded arm is fatal rather than defaulted', () => {
        const root = makeRoot([{ name: 'a-01', arm: 'native', attempts: [WELL_FORMED] }]);
        fs.writeFileSync(path.join(root, 'benchmark', 'v14-rows.json'), JSON.stringify([]), 'utf8');
        expect(() => sweep.survey(root)).toThrow(/no arm recorded/);
    });

    test('reports are discovered from the directory, not declared', () => {
        const root = makeRoot([
            { name: 'z-09', arm: 'custom', attempts: [WELL_FORMED] },
            { name: 'a-01', arm: 'native', attempts: [WELL_FORMED] },
        ]);
        // Sorted by name, and containing whatever the directory holds — the
        // driver has no opinion about which reports exist.
        expect(sweep.discoverReports(root)).toEqual(['a-01', 'z-09']);
    });

    test('the real corpus is discovered whole', () => {
        expect(sweep.discoverReports().length).toBe(require('../benchmark/v14-rows.json').length);
    });
});
