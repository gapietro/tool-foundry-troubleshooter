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

/**
 * v14 arm assignment, READ from the source of truth rather than copied.
 * A hardcoded copy would leave this suite green while the CHANGELOG's claim that
 * arms match `v14-rows.json` quietly became false (review of PR #247).
 */
const ARMS = (() => {
  const rows = JSON.parse(fs.readFileSync(path.join(REPO, 'benchmark', 'v14-rows.json'), 'utf8'));
  const map = {};
  for (const row of rows) map['row-' + String(row.row).padStart(2, '0')] = row.arm;
  return map;
})();

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

  test('every rejected candidate text appears verbatim at the line it cites', () => {
    /**
     * The rejections are the anti-drift device for §AX2.5's "correct additions"
     * carve-out, so a transcription slip in one is as consequential as a slip in a
     * claim. Held to the same standard as occurrences (review of PR #247, which
     * found two rejections that did not appear verbatim).
     */
    const misses = [];
    for (const report of fixture.reports) {
      for (const rej of report.rejected_candidates) {
        const line = reportLines[report.report][rej.line - 1];
        if (line === undefined || !line.includes(rej.text)) {
          misses.push(rej.id + ' — ' + JSON.stringify(rej.text));
        }
      }
    }
    expect(misses).toEqual([]);
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
    // Allowlist, not a deny-list: `combined`/`all`/`overall` would have slipped a
    // deny-list of `total`/`pooled` (review of PR #247).
    expect(Object.keys(fixture.denominator_summary).sort()).toEqual(['custom', 'native', 'note']);
  });

  test('exactly the two rejections described as arguable carry a machine-readable flag', () => {
    const flagged = [];
    for (const report of fixture.reports) {
      for (const rej of report.rejected_candidates) {
        if (rej.arguable === true) flagged.push(rej.id);
      }
    }
    expect(flagged.sort()).toEqual(['row-07/X06', 'row-17/X05']);
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
    expect(fixture.contains_no_truth_values.length).toBeGreaterThan(0);
  });

  test('the zero-claim reporting rule is registered in the fixture (§AX10)', () => {
    // row-02 and row-04 have zero claims, so their per-report recall is 0/0. §AX2.3
    // requires a per-report figure; resolving 0/0 after output is seen is the §AU6
    // hazard, so the rule is pinned here (review of PR #247).
    expect(typeof fixture.zero_claim_reporting_rule).toBe('string');
    expect(fixture.zero_claim_reporting_rule).toContain('not applicable');
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
    // Recursive over the whole repo. The first version scanned two directories,
    // non-recursively, for a name containing BOTH "claim" and "extract" — an
    // extractor at benchmark/claimExtractor.js or benchmark/scripts/extractor/index.js
    // would have passed silently, so the guard asserted far less than its name
    // promised (review of PR #247).
    const SKIP = new Set(['node_modules', 'dist', '.git', '.now', '.snc', 'coverage', '@types']);
    const ALLOWED = new Set([path.join('test', 'extractorBriefBlindness.test.js')]);
    const hits = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(js|mjs|cjs|ts)$/.test(entry.name)) {
          // Match the PATH, not the basename: an extractor at
          // benchmark/scripts/extractor/index.js has no "extract" in its filename and
          // slipped a basename check (caught by mutation-verifying this guard).
          const rel = path.relative(REPO, full);
          if (/extract/i.test(rel) && !ALLOWED.has(rel)) hits.push(rel);
        }
      }
    })(REPO);
    expect(hits).toEqual([]);
  });
});
