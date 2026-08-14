'use strict';
/**
 * pass-figures.js — the SCORER, and a different artifact class from the
 * instrument it scores.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT IN THE §AX5 CLEARED SET, AND MUST NOT BE
 * ---------------------------------------------------------------------------
 * The cleared set carries a rule that no member may read the held-out inventory
 * at runtime: the fixture is the denominator, an extractor that could read it
 * could be tuned to it, and no vocabulary check would see that.
 *
 * A scorer is the one thing that MUST read it. Recall's denominator IS the
 * fixture, so a scorer unable to open it could not compute the figure at all.
 *
 * The first draft of this code lived inside the sweep driver and the guard went
 * red — correctly. The temptation at that moment is to relax the guard, since
 * the author knows this particular read is innocent; relaxing an enforcement to
 * fit the code it just caught is the move this project has repeatedly recorded
 * as the failure (§AR1a, §AX14.7). The guard stands unchanged. The code moved.
 *
 * ---------------------------------------------------------------------------
 * WHAT REPLACES CLEARING HERE
 * ---------------------------------------------------------------------------
 * Being outside the cleared set is not being unconstrained. Three properties
 * carry the weight instead, and the clearing test asserts all three (§AX17):
 *
 *   1. It DECIDES nothing. Adjudication is `claim-adjudication.js`; matching was
 *      decided in dispatched contexts (§AX16.3); polarity in others (§AX16.2).
 *      This module counts what those artifacts already say. No threshold here is
 *      one a judgement could move.
 *   2. It cannot feed back. It runs after extraction and adjudication are frozen
 *      and writes only its own output, so nothing it reads can change what was
 *      emitted or how it was judged.
 *   3. It is still subject to every corpus-vocabulary pattern, and it is still
 *      DISCOVERED by the walk — it cannot be renamed, or joined by a sibling,
 *      without a test noticing.
 *
 * ---------------------------------------------------------------------------
 * THE FLOORS ARE APPLIED HERE, NOT LEFT TO WHOEVER QUOTES THE NUMBERS
 * ---------------------------------------------------------------------------
 * §AX11's registered reasoning: a figure whose meaning depends on a caveat being
 * re-attached by its reader will eventually be quoted without it. So the status
 * goes in the VERDICT, where it travels with the number.
 */

const fs = require('fs');
const path = require('path');
const adjudication = require('./claim-adjudication');
const { makeProbe } = require('./metadata-probe');
const { discoverReports } = require('./claim-extraction-sweep');

const REPO = path.join(__dirname, '..', '..');

/** §AX11's reportability floor and §AX6's AX-4 floor share one threshold. */
const SMALL_DENOMINATOR = 5;

/** AX-1a / AX-1b pass at or above this. */
const RECALL_BAR = 0.8;

function layout(root) {
    const base = root || REPO;
    return { root: base, sweep: path.join(base, 'benchmark', 'extraction', 'v14') };
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function figures(root) {
    const where = layout(root);
    const probe = makeProbe(readJson(path.join(where.root, 'benchmark', 'v14-metadata-snapshot.json')));
    const fixture = readJson(path.join(where.root, 'benchmark', 'v14-claim-inventory-heldout.json'));
    const overlay = readJson(
        path.join(where.root, 'benchmark', 'v14-claim-inventory-polarity-overlay.json')
    ).polarity;
    const matchFor = (report) => readJson(path.join(where.sweep, 'matching', report + '.json'));

    /** Veracity: every emitted claim, both arms separately (§AD7, §AX7.1). */
    const arms = { native: [], custom: [] };
    for (const report of discoverReports(root)) {
        const frozen = readJson(path.join(where.sweep, report + '.json'));
        for (const claim of frozen.claims) arms[frozen.arm].push(claim);
    }
    const veracity = {};
    for (const arm of ['native', 'custom']) {
        const tally = { refuted: 0, supported: 0, unresolvable: 0 };
        for (const v of adjudication.adjudicateAll(arms[arm], probe)) tally[v.verdict]++;
        veracity[arm] = { claims: arms[arm].length, verdicts: tally };
    }

    /** Recall and the spurious rate, both from the one dispatched matching pass. */
    const recall = { native: { hit: 0, total: 0, per_report: [] }, custom: { hit: 0, total: 0, per_report: [] } };
    const spurious = { native: { unmatched: 0, emitted: 0 }, custom: { unmatched: 0, emitted: 0 } };
    for (const entry of fixture.reports) {
        const m = matchFor(entry.report);
        const hit = Object.keys(m.a_to_b).filter((k) => m.a_to_b[k]).length;
        recall[entry.arm].hit += hit;
        recall[entry.arm].total += entry.claim_count;
        recall[entry.arm].per_report.push({ report: entry.report, hit: hit, of: entry.claim_count });
        const classes = Object.keys(m.b_class).map((k) => m.b_class[k]);
        spurious[entry.arm].unmatched += classes.filter((c) => c !== 'a').length;
        spurious[entry.arm].emitted += classes.length;
    }

    /** AX-4: are enumeration misses concentrated in the claims that are false? */
    const inventory = [];
    for (const entry of fixture.reports) {
        for (const claim of entry.claims) {
            const id = entry.report + '/' + claim.id;
            inventory.push({
                id: id,
                kind: claim.kind,
                subject: claim.subject,
                polarity: overlay[id],
                _report: entry.report,
                _local: claim.id,
            });
        }
    }
    const verdicts = {};
    for (const v of adjudication.adjudicateAll(inventory, probe)) verdicts[v.id] = v.verdict;
    const refuted = inventory.filter((c) => verdicts[c.id] === 'refuted');
    const refutedMisses = refuted.filter((c) => matchFor(c._report).a_to_b[c._local] === null).length;

    const out = { veracity: veracity, recall: {}, spurious: {}, ax2: {}, ax4: {} };

    for (const arm of ['native', 'custom']) {
        const r = recall[arm];
        const rate = r.total ? r.hit / r.total : null;
        out.recall[arm] = {
            hit: r.hit,
            total: r.total,
            rate: rate,
            per_report: r.per_report,
            verdict:
                r.total < SMALL_DENOMINATOR
                    ? 'not exercised (n=' + r.total + ' < ' + SMALL_DENOMINATOR + ')'
                    : rate >= RECALL_BAR
                      ? 'passed'
                      : 'failed',
        };

        const s = spurious[arm];
        out.spurious[arm] = {
            unmatched: s.unmatched,
            emitted: s.emitted,
            rate: s.emitted ? s.unmatched / s.emitted : null,
            // §AX2.5's carve-out is operator discretion and is deliberately NOT
            // exercised: it can only LOWER the rate, and the operator is
            // contaminated in the extractor's favour. This is the upper bound.
            correct_additions_carve_out_applied: false,
            // §AX11.2a: never floored — its denominator is one the system under
            // test chooses, and flooring on that lets the subject escape a
            // verdict by emitting less. Recorded as weight on a PASS only.
            weight: s.emitted < SMALL_DENOMINATOR ? 'emitted n=' + s.emitted + ' — a pass here carries no evidential weight' : 'full',
        };
    }

    const totalRefuted = veracity.native.verdicts.refuted + veracity.custom.verdicts.refuted;
    out.ax2 = {
        refuted_across_all_reports: totalRefuted,
        verdict: totalRefuted >= 1 ? 'passed' : 'failed',
        note: 'Pre-satisfied and labelled as such (§AX6) — one report was already known to carry a false claim, so this falsifier was impossible. That is the finding, not the test.',
    };

    const perArmMiss = {
        native: recall.native.total ? (recall.native.total - recall.native.hit) / recall.native.total : null,
        custom: recall.custom.total ? (recall.custom.total - recall.custom.hit) / recall.custom.total : null,
    };
    out.ax4 = {
        refuted_population: refuted.length,
        misses_among_refuted: refutedMisses,
        miss_rate_among_refuted: refuted.length ? refutedMisses / refuted.length : null,
        per_arm_miss_rate: perArmMiss,
        verdict: null,
    };
    if (refuted.length < SMALL_DENOMINATOR) {
        out.ax4.verdict = 'not exercised (' + refuted.length + ' refuted < ' + SMALL_DENOMINATOR + ')';
    } else {
        // "Not concentrated in refuted claims" = the refuted miss rate does not
        // exceed the ordinary one. Compared against the highest per-arm rate,
        // which is the reading most likely to let AX-4 pass — so a pass here is
        // the weaker of the two available claims, stated as such.
        const bar = Math.max(perArmMiss.native || 0, perArmMiss.custom || 0);
        out.ax4.compared_against = bar;
        out.ax4.verdict = out.ax4.miss_rate_among_refuted <= bar ? 'passed' : 'failed';
    }

    fs.writeFileSync(path.join(where.sweep, 'results.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
    return out;
}

module.exports = { figures: figures, SMALL_DENOMINATOR: SMALL_DENOMINATOR, RECALL_BAR: RECALL_BAR };

if (require.main === module) {
    process.stdout.write(JSON.stringify(figures(), null, 2) + '\n');
}
