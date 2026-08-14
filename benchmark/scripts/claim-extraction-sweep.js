'use strict';
/**
 * claim-extraction-sweep.js — the driver that freezes a sweep's emissions.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT
 * ---------------------------------------------------------------------------
 * §AX12.1 puts the extraction of each report in a fresh context holding only the
 * frozen prompt and that one report. That dispatch happens outside this file and
 * cannot happen inside it: a driver that called a model would be a context this
 * module controls, and controlling it is exactly what §AX12.1 takes away from
 * the operator's side of the line.
 *
 * So the boundary is: something else writes one raw emission per report into
 * `raw/`, and this module turns those emissions into frozen artifacts —
 * validated, deduped, ordered, serialised — by handing each to
 * `claim-extraction.js`. It holds no claim-detection logic and must never
 * acquire any, for the same reason that module states: a heuristic here would be
 * a second extractor nobody cleared.
 *
 * ---------------------------------------------------------------------------
 * IT NAMES NO MEMBER OF THE CORPUS
 * ---------------------------------------------------------------------------
 * §AX5: "An extractor is expected to enumerate its corpus directory, never to
 * name a member of it." This walks the report directory and derives everything
 * per report from what it finds there. There is no list of reports in this file
 * and there must not be one — a special case for a named report is the single
 * most likely way an answer key would enter the instrument, and it is the form
 * the clearing check was widened to catch.
 *
 * The arm each report belongs to is read from the recorded pass rather than
 * reconstructed here, so this file encodes no mapping either.
 *
 * ---------------------------------------------------------------------------
 * THE RETRY BOUND IS ENFORCED HERE, NOT DESCRIBED HERE (§AX15)
 * ---------------------------------------------------------------------------
 * §AX15.2 permits a retry only on an ENVELOPE-level defect: the emission does
 * not parse, or parses without a top-level claims array. Both are decided by
 * `JSON.parse` and `Array.isArray` below, which is what makes the permission a
 * parser's ruling rather than a reader's judgement.
 *
 * Two consequences are load-bearing and are asserted rather than assumed:
 *
 *   - An empty-but-well-formed envelope is NOT a defect. It is the registered
 *     result for a report asserting nothing about instance state, and reports in
 *     this corpus are structurally claim-free. Treating it as retryable would
 *     re-roll precisely the reports whose correct answer is nothing.
 *
 *   - Content is never a defect. A low count, or claims the validator rejected,
 *     are measurements. `claim-extraction.js` records rejections rather than
 *     dropping them, so nothing here needs to compensate for them, and anything
 *     that did would be laundering a miss into a retry.
 *
 * At most two attempts per report (§AX15.2), enforced at construction. Every
 * attempt is preserved and the manifest records which defect triggered each
 * retry (§AX15.3), so a retry with no recorded defect is visible in the tree to
 * anyone who reads it, without trusting the operator's account.
 *
 * ---------------------------------------------------------------------------
 * IT FREEZES ALL OR NOTHING
 * ---------------------------------------------------------------------------
 * If any report still carries an envelope-level defect on its last attempt, no
 * artifact is written at all. A half-frozen tree is the state in which a figure
 * can be computed over a subset while looking complete, and the sweep is not
 * repeatable (§AX7.2), so the failure has to be loud at the only moment it is
 * still cheap.
 */

const fs = require('fs');
const path = require('path');
const { normalise, serialise } = require('./claim-extraction');

const REPO = path.join(__dirname, '..', '..');

/**
 * Where the corpus, the recorded pass, and the sweep's own tree live, relative
 * to a root.
 *
 * Directory paths only: which reports exist is discovered by walking, never
 * declared here.
 *
 * The root is injectable for the same reason §AX14 injects the probe rather
 * than letting it open its own client: the refusal behaviours below are the
 * load-bearing ones, and a test that cannot construct a partial sweep can only
 * assert that the happy path works — which is the case that was never in doubt.
 */
function layout(root) {
    const base = root || REPO;
    const sweep = path.join(base, 'benchmark', 'extraction', 'v14');
    return {
        root: base,
        reports: path.join(base, 'benchmark', 'v14-reports'),
        passRecord: path.join(base, 'benchmark', 'v14-rows.json'),
        sweep: sweep,
        raw: path.join(sweep, 'raw'),
    };
}

/** §AX15.2 — a report gets an original and at most one retry. */
const MAX_ATTEMPTS = 2;

/** Every report in the corpus, discovered and ordered by name. */
function discoverReports(root) {
    return fs
        .readdirSync(layout(root).reports)
        .filter((name) => /\.md$/i.test(name))
        .map((name) => name.replace(/\.md$/i, ''))
        .sort();
}

/**
 * The arm a report belongs to, read from the recorded pass.
 *
 * Absence is fatal rather than defaulted. Both figures are reported per arm
 * (§AD7, §AX7.1), so a report that silently acquired the wrong arm would move a
 * per-arm denominator with nothing to indicate it had — the same shape as the
 * §AX14.7 finding where a missing key produced a confident wrong answer.
 */
function armIndex(root) {
    const raw = JSON.parse(fs.readFileSync(layout(root).passRecord, 'utf8'));
    const records = Array.isArray(raw) ? raw : raw.rows;
    if (!Array.isArray(records)) throw new Error('pass record holds no array of records');

    const index = new Map();
    for (const record of records) {
        if (typeof record.row !== 'number' || typeof record.arm !== 'string') {
            throw new Error('pass record entry is missing an identifier or an arm');
        }
        index.set(record.row, record.arm);
    }
    return index;
}

/** The ordinal in a report's name, which is how the pass record identifies it. */
function ordinalOf(report) {
    const match = /(\d+)\s*$/.exec(report);
    if (!match) throw new Error('report name carries no ordinal: ' + report);
    return Number(match[1]);
}

/**
 * The attempts on disk for one report, in order.
 *
 * Named `<report>.attempt-N.raw.json`. Gaps are fatal: a second attempt with no
 * first one means an attempt was deleted or renamed, and §AX15.3's audit rests
 * on every attempt still being there.
 */
function attemptsFor(report, root) {
    const rawDir = layout(root).raw;
    if (!fs.existsSync(rawDir)) return [];
    const prefix = report + '.attempt-';
    const found = [];
    for (const name of fs.readdirSync(rawDir)) {
        if (!name.startsWith(prefix) || !name.endsWith('.raw.json')) continue;
        const n = Number(name.slice(prefix.length, -'.raw.json'.length));
        if (!Number.isInteger(n) || n < 1) throw new Error('unreadable attempt number: ' + name);
        found.push({ attempt: n, file: path.join(rawDir, name) });
    }
    found.sort((a, b) => a.attempt - b.attempt);
    found.forEach((entry, i) => {
        if (entry.attempt !== i + 1) throw new Error('attempts are not contiguous for ' + report);
    });
    if (found.length > MAX_ATTEMPTS) {
        throw new Error('more than the permitted attempts for ' + report + ' (§AX15.2)');
    }
    return found;
}

/**
 * §AX15.2's envelope test, and the whole of it.
 *
 * Returns null when the emission is usable. The two defects it can return are
 * the two §AX15.2 names, and no third one may be added here without amending
 * that registration — widening this function is how "retry on failure" becomes
 * "retry on anything the operator dislikes".
 */
function envelopeDefect(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        return { defect: 'unparseable', detail: String(err.message) };
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.claims)) {
        return { defect: 'no_claims_array', detail: 'emission parsed but carries no top-level claims array' };
    }
    return null;
}

/**
 * Read every attempt for every report and classify it, writing nothing.
 *
 * This is the whole of the decision about what may be retried, and it runs
 * before any artifact exists so that the answer cannot depend on one.
 */
function survey(root) {
    const arms = armIndex(root);
    const reports = [];

    for (const report of discoverReports(root)) {
        const arm = arms.get(ordinalOf(report));
        if (!arm) throw new Error('no arm recorded for ' + report);

        const attempts = attemptsFor(report, root).map((entry) => {
            const text = fs.readFileSync(entry.file, 'utf8');
            return {
                attempt: entry.attempt,
                file: path.relative(layout(root).root, entry.file),
                defect: envelopeDefect(text),
                text: text,
            };
        });

        const last = attempts.length ? attempts[attempts.length - 1] : null;
        reports.push({
            report: report,
            arm: arm,
            attempts: attempts,
            // Missing and defective are different states and are kept apart:
            // one means the sweep has not reached this report, the other means
            // it reached it and came back malformed.
            status: !last ? 'missing' : last.defect ? 'defective' : 'ok',
        });
    }

    return reports;
}

/**
 * Freeze the sweep: one artifact per report, plus the §AX15.3 manifest.
 *
 * Refuses to write anything unless every report is usable, per this module's
 * all-or-nothing rule.
 */
function freeze(root) {
    const where = layout(root);
    const surveyed = survey(root);
    const blocked = surveyed.filter((r) => r.status !== 'ok');
    if (blocked.length) {
        const detail = blocked.map((r) => r.report + ': ' + r.status).join(', ');
        throw new Error('refusing to freeze a partial sweep — ' + detail);
    }

    fs.mkdirSync(where.sweep, { recursive: true });

    const manifest = [];
    for (const entry of surveyed) {
        const body = fs.readFileSync(path.join(where.reports, entry.report + '.md'), 'utf8');
        const last = entry.attempts[entry.attempts.length - 1];
        const record = normalise(JSON.parse(last.text), {
            report: entry.report,
            arm: entry.arm,
            lines: body.split('\n'),
        });
        fs.writeFileSync(path.join(where.sweep, entry.report + '.json'), serialise(record), 'utf8');

        manifest.push({
            report: entry.report,
            arm: entry.arm,
            claim_count: record.claim_count,
            rejected_count: record.rejected.length,
            attempts: entry.attempts.length,
            // Recorded for every attempt, not only the failed ones: §AX15.3's
            // audit is that a retry with NO recorded defect is visible, and
            // that is only visible if the successful attempt is listed too.
            attempt_log: entry.attempts.map((a) => ({
                attempt: a.attempt,
                file: a.file,
                envelope_defect: a.defect ? a.defect.defect : null,
                detail: a.defect ? a.defect.detail : null,
            })),
        });
    }

    fs.writeFileSync(
        path.join(where.sweep, 'manifest.json'),
        JSON.stringify(
            {
                registered_under: 'benchmark/DECISION.md §AX15',
                retry_rule: 'envelope-level defects only; at most one retry; every attempt preserved',
                reports: manifest,
            },
            null,
            2
        ) + '\n',
        'utf8'
    );

    return manifest;
}

module.exports = {
    MAX_ATTEMPTS: MAX_ATTEMPTS,
    discoverReports: discoverReports,
    envelopeDefect: envelopeDefect,
    survey: survey,
    freeze: freeze,
};

if (require.main === module) {
    const mode = process.argv[2] || 'survey';
    if (mode === 'freeze') {
        const manifest = freeze();
        for (const entry of manifest) {
            process.stdout.write(
                entry.report + '  ' + entry.arm + '  claims=' + entry.claim_count + '  attempts=' + entry.attempts + '\n'
            );
        }
    } else {
        for (const entry of survey()) {
            const defect = entry.attempts.length
                ? entry.attempts[entry.attempts.length - 1].defect
                : null;
            process.stdout.write(
                entry.report +
                    '  ' +
                    entry.arm +
                    '  ' +
                    entry.status +
                    (defect ? '  (' + defect.defect + ')' : '') +
                    '\n'
            );
        }
    }
}
