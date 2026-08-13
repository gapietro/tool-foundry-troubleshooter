'use strict';

/**
 * The corpus-vocabulary instrument, shared by every artifact that must be
 * cleared of it.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS ONE MODULE AND NOT TWO COPIES
 * ---------------------------------------------------------------------------
 * §AX5 registers the extractor's clearing check as "the same instrument as
 * test/extractorBriefBlindness.test.js, pointed at the extractor". A copied
 * pattern list would satisfy that sentence on the day it was copied and stop
 * satisfying it at the first widening — and this list has already been widened
 * once under fire (review of PR #246 found the locator pattern blind to the
 * `row-NN` filename form, the single most likely way a locator would appear).
 *
 * Sharing the module makes "same instrument" a fact about the code rather than
 * a claim in a comment.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES AND DOES NOT CLAIM
 * ---------------------------------------------------------------------------
 * A vocabulary check, not a semantic one. It cannot see a leak by implication;
 * it can only see an artifact starting to name things it must not name. That is
 * worth having because every leak caught so far has been a vocabulary leak — a
 * fixture table, a count, a shape enumeration, a filename.
 *
 * Patterns carry category labels and no examples, deliberately: a documented
 * list of forbidden strings is itself a hint.
 */

/**
 * Categories of corpus vocabulary a cleared artifact must never contain.
 *
 * A hit is not automatically a leak, but it is always a thing to justify, and
 * the justification belongs in DECISION.md rather than in an inline exemption.
 */
const FORBIDDEN = [
    { label: 'fixture table identifier', re: /x_snc_tsbench\w*/i },
    { label: 'field-count assertion', re: /\b\d+\s+fields?\b/i },
    { label: 'row-count assertion', re: /\b\d+\s+rows?\b/i },
    { label: 'seed identifier', re: /\bseed[-\s]?0?\d\b/i },
    // `[-\s]` and not `\s` alone: the corpus names its members `row-NN`, and a
    // whitespace-only pattern matched none of them. Pointed at an extractor that
    // special-cased a report by filename, the check passed while the locator sat
    // in the source — a mechanical clearing unenforced in its most likely form
    // (review of PR #246, registered in §AX5).
    { label: 'calibration row locator', re: /\brows?[-\s]0?\d+\b/i },
];

/**
 * Scan text for forbidden vocabulary.
 *
 * @param {string} raw file contents
 * @param {string} rel repo-relative path, for readable failure output
 * @param {{label: string, re: RegExp}} pattern one entry from FORBIDDEN
 * @returns {string[]} one entry per hit, located and quoted
 */
function scan(raw, rel, pattern) {
    const lines = raw.split('\n');
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
        if (pattern.re.test(lines[i])) hits.push(rel + ':' + (i + 1) + ' — ' + lines[i].trim());
    }
    return hits;
}

module.exports = { FORBIDDEN: FORBIDDEN, scan: scan };
