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
        const root = makeRoot([{ name: 'a-01', arm: 'native', attempts: [WELL_FORMED, '{bad'] }]);
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

    test('the manifest logs the successful attempt too, so a defect-free retry is visible', () => {
        /**
         * §AX15.3's audit is that a retry with NO recorded defect can be seen in
         * the tree. That is only true if successful attempts appear in the log;
         * listing failures alone would make an unjustified re-roll indis-
         * tinguishable from a justified one.
         */
        const root = makeRoot([{ name: 'a-01', arm: 'native', attempts: [WELL_FORMED, WELL_FORMED] }]);
        const manifest = sweep.freeze(root);
        expect(manifest[0].attempt_log).toHaveLength(2);
        expect(manifest[0].attempt_log.every((a) => a.envelope_defect === null)).toBe(true);
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
