'use strict';

/**
 * Fixture-shape guard for benchmark/v14-claim-inventory-heldout.json.
 *
 * This is NOT the extractor and must never become it. It checks properties of the
 * inventory artifact itself, which is the substitution §AX0 registers: prefer a
 * property you can check on the artifact over one you must certify about the author.
 *
 * The load-bearing check is quote verbatimness — every occurrence must appear at the
 * line it cites in the report it names. A hand-authored fixture is the denominator of
 * the enumeration-recall figure (§AX2.3); a transcription slip in it silently moves
 * that figure, and no reviewer would catch it by reading.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const FIXTURE = path.join(REPO, 'benchmark', 'v14-claim-inventory-heldout.json');
const REPORT_DIR = path.join(REPO, 'benchmark', 'v14-reports');

/** §AX4's held-out set, restated here so a silent edit to the fixture cannot redefine it. */
const HELD_OUT = ['row-02', 'row-04', 'row-07', 'row-12', 'row-15', 'row-17', 'row-19'];

/** §AX4's development set — none of it may appear in this fixture. */
const DEVELOPMENT = ['row-01', 'row-03', 'row-05', 'row-10', 'row-14', 'row-16', 'row-18', 'row-20'];

/** The three former §AW4 sensitivity rows, excluded from recall by §AX4. */
const EXCLUDED = ['row-09', 'row-11', 'row-13'];

/** v14 arm assignment, from benchmark/v14-rows.json. */
const ARMS = {
  'row-02': 'custom',
  'row-04': 'custom',
  'row-07': 'native',
  'row-12': 'custom',
  'row-15': 'native',
  'row-17': 'native',
  'row-19': 'native'
};

const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

const reportLines = {};
for (const name of HELD_OUT) {
  reportLines[name] = fs.readFileSync(path.join(REPORT_DIR, name + '.md'), 'utf8').split('\n');
}

/** Every claim across every report, flattened. */
function allClaims() {
  const out = [];
  for (const report of fixture.reports) {
    for (const claim of report.claims) out.push({ report: report, claim: claim });
  }
  return out;
}

describe('claim inventory — set membership (§AX4)', () => {
  test('covers exactly the seven held-out reports, in ascending filename order', () => {
    expect(fixture.reports.map((r) => r.report)).toEqual(HELD_OUT);
  });

  test('names no development-set report anywhere in the fixture', () => {
    const raw = fs.readFileSync(FIXTURE, 'utf8');
    for (const name of DEVELOPMENT) {
      expect(raw).not.toContain(name);
    }
  });

  test('names no excluded sensitivity row anywhere in the fixture', () => {
    const raw = fs.readFileSync(FIXTURE, 'utf8');
    for (const name of EXCLUDED) {
      expect(raw).not.toContain(name);
    }
  });

  test('each report declares the arm recorded in v14-rows.json', () => {
    for (const report of fixture.reports) {
      expect(report.arm).toBe(ARMS[report.report]);
    }
  });

  test('each report points at a path that exists', () => {
    for (const report of fixture.reports) {
      expect(report.path).toBe('benchmark/v14-reports/' + report.report + '.md');
      expect(fs.existsSync(path.join(REPO, report.path))).toBe(true);
    }
  });
});

describe('claim inventory — occurrence quotes are verbatim', () => {
  test('every claim occurrence appears at the line it cites', () => {
    const misses = [];
    for (const { report, claim } of allClaims()) {
      for (const occ of claim.occurrences) {
        const line = reportLines[report.report][occ.line - 1];
        if (line === undefined || !line.includes(occ.quote)) {
          misses.push(claim.id + ' @ ' + report.report + ':' + occ.line + ' — ' + JSON.stringify(occ.quote));
        }
      }
    }
    expect(misses).toEqual([]);
  });

  test('every rejected candidate cites a line that exists in its report', () => {
    for (const report of fixture.reports) {
      for (const rej of report.rejected_candidates) {
        expect(typeof rej.line).toBe('number');
        expect(rej.line).toBeGreaterThan(0);
        expect(rej.line).toBeLessThanOrEqual(reportLines[report.report].length);
      }
    }
  });
});

describe('claim inventory — structural integrity', () => {
  test('claim ids are globally unique and namespaced to their report', () => {
    const seen = new Set();
    for (const { report, claim } of allClaims()) {
      expect(claim.id.startsWith(report.report + '/C')).toBe(true);
      expect(seen.has(claim.id)).toBe(false);
      seen.add(claim.id);
    }
  });

  test('rejected-candidate ids are globally unique and namespaced to their report', () => {
    const seen = new Set();
    for (const report of fixture.reports) {
      for (const rej of report.rejected_candidates) {
        expect(rej.id.startsWith(report.report + '/X')).toBe(true);
        expect(seen.has(rej.id)).toBe(false);
        seen.add(rej.id);
      }
    }
  });

  test('claim_count matches the claims actually listed', () => {
    for (const report of fixture.reports) {
      expect(report.claim_count).toBe(report.claims.length);
    }
  });

  test('every claim carries a proposition, a kind, at least one occurrence, and an admitting rule', () => {
    for (const { claim } of allClaims()) {
      expect(typeof claim.proposition).toBe('string');
      expect(claim.proposition.length).toBeGreaterThan(0);
      expect(['existence', 'field_value', 'count', 'identity', 'state']).toContain(claim.kind);
      expect(Array.isArray(claim.occurrences)).toBe(true);
      expect(claim.occurrences.length).toBeGreaterThan(0);
      expect(typeof claim.admitted_by).toBe('string');
      expect(claim.admitted_by.length).toBeGreaterThan(0);
    }
  });

  test('every rejected candidate names the rule that rejected it and a reason', () => {
    for (const report of fixture.reports) {
      for (const rej of report.rejected_candidates) {
        expect(typeof rej.rejected_by).toBe('string');
        expect(rej.rejected_by.length).toBeGreaterThan(0);
        expect(typeof rej.reason).toBe('string');
        expect(rej.reason.length).toBeGreaterThan(0);
      }
    }
  });

  test('every rule cited by a claim or a rejection is defined in reading_rules', () => {
    const defined = new Set(fixture.reading_rules.map((r) => r.id));
    expect(defined.size).toBeGreaterThan(0);
    const cited = new Set();
    for (const { claim } of allClaims()) {
      for (const id of claim.admitted_by.match(/R-[A-Z]/g) || []) cited.add(id);
    }
    for (const report of fixture.reports) {
      for (const rej of report.rejected_candidates) {
        for (const id of rej.rejected_by.match(/R-[A-Z]/g) || []) cited.add(id);
      }
    }
    for (const id of cited) expect(defined.has(id)).toBe(true);
  });

  test('the per-arm denominator summary matches the claims listed', () => {
    const tally = { native: { reports: 0, claims: 0 }, custom: { reports: 0, claims: 0 } };
    for (const report of fixture.reports) {
      tally[report.arm].reports += 1;
      tally[report.arm].claims += report.claims.length;
    }
    expect(fixture.denominator_summary.native.reports).toBe(tally.native.reports);
    expect(fixture.denominator_summary.native.claims).toBe(tally.native.claims);
    expect(fixture.denominator_summary.custom.reports).toBe(tally.custom.reports);
    expect(fixture.denominator_summary.custom.claims).toBe(tally.custom.claims);
  });

  test('no pooled cross-arm total is published in the summary (§AX7.1)', () => {
    expect(fixture.denominator_summary.total).toBeUndefined();
    expect(fixture.denominator_summary.pooled).toBeUndefined();
  });
});

describe('claim inventory — carries no truth values', () => {
  /**
   * The inventory is the enumeration fixture. If it also carried adjudication verdicts,
   * the recall measurement and the veracity measurement would share an author's guess,
   * and §AW2's three-valued verdict would have somewhere to leak from.
   */
  const FORBIDDEN_KEYS = [
    'verdict',
    'expected_verdict',
    'refuted',
    'supported',
    'unresolvable',
    'truth',
    'is_true',
    'is_false',
    'adjudication',
    'answer'
  ];

  test('no object anywhere in the fixture carries a verdict-shaped key', () => {
    const found = [];
    (function walk(node, at) {
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, at + '[' + i + ']'));
        return;
      }
      if (node === null || typeof node !== 'object') return;
      for (const key of Object.keys(node)) {
        if (FORBIDDEN_KEYS.includes(key.toLowerCase())) found.push(at + '.' + key);
        walk(node[key], at + '.' + key);
      }
    })(fixture, '$');
    expect(found).toEqual([]);
  });

  test('the fixture states that it holds no truth values', () => {
    expect(typeof fixture.contains_no_truth_values).toBe('string');
  });
});

describe('claim inventory — provenance (§AX2.2)', () => {
  test('declares the registration it is bound by and that it precedes the extractor', () => {
    expect(fixture.registered_under).toContain('§AX');
    expect(fixture.issue).toBe('#212');
    expect(fixture.authored_before_extractor_existed).toBe(true);
  });

  test('no extractor implementation exists in the repository at this commit', () => {
    /**
     * §AX2.2's guarantee is commit ORDER, and git log is its proof. This is the
     * cheap in-repo corroboration: if an extractor lands in the same commit as the
     * fixture, the ordering claim is false and this fails loudly rather than
     * leaving the point to a reviewer's reading of the diff.
     */
    const candidates = [
      path.join(REPO, 'benchmark', 'scripts'),
      path.join(REPO, 'src', 'server')
    ];
    const hits = [];
    for (const dir of candidates) {
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir)) {
        if (/claim.*extract|extract.*claim/i.test(entry)) hits.push(path.join(dir, entry));
      }
    }
    expect(hits).toEqual([]);
  });
});
