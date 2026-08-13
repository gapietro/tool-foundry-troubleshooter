'use strict';
/**
 * claim-adjudication.js — the deterministic adjudicator for the #212 claim
 * veracity axis.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS ALLOWED TO BE
 * ---------------------------------------------------------------------------
 * §AW3 registers the division of labour: "extraction is a model's job;
 * adjudication is not. Adjudication is a deterministic membership test over a
 * metadata read — no model judgement, no scorer packet, no rubric. Where a claim
 * cannot be reduced to a deterministic test, it is `unresolvable` by definition
 * rather than escalated to a judge."
 *
 * So there is no inference here and there must never be one. No prose is parsed;
 * every input this module reasons over is a structured field the extractor
 * emitted. A negation-detector over `proposition` was considered and rejected in
 * §AX13.2 — a negation its token list did not anticipate reads as affirmative
 * and flips a correct observation into a `refuted`, silently, which is the exact
 * failure mode the axis exists to catch.
 *
 * ---------------------------------------------------------------------------
 * THE THREE VERDICTS, AND WHY TWO WOULD BE A DEFECT
 * ---------------------------------------------------------------------------
 * §AW2's registered principle: AN INSTRUMENT'S INABILITY TO OBSERVE MUST NEVER
 * BE RECORDED AS AN OBSERVATION. This project has already shipped and measured a
 * defect of that shape (#205): a sweep that could not see what it was looking
 * for reported a confident absence, and a wrong root cause followed with no
 * diagnostic signal anywhere. `unresolvable` is therefore a first-class result,
 * not a failure to try harder — and it is the default every path falls back to.
 *
 * ---------------------------------------------------------------------------
 * NO CLIENT, NO NETWORK
 * ---------------------------------------------------------------------------
 * The instance read is INJECTED as a function (brief §7). This module cannot
 * reach an instance even if asked to, which is what makes every branch below
 * testable and what keeps credentials on the far side of the MCP boundary.
 */

/** The registered verdicts. There is no fourth, and no free-text alternative. */
const VERDICTS = ['refuted', 'supported', 'unresolvable'];

/**
 * The in-band control for a field-absence observation.
 *
 * Every table on this platform carries `sys_id`. If a metadata read comes back
 * without it, the read is broken or truncated — and an absence observed through
 * a broken read is worth nothing (brief §2.1 rule 2). Taking the control from
 * the SAME returned payload is what makes it "the same call and the same auth
 * context" as a fact about the data rather than a promise about the caller.
 */
const CONTROL_FIELD = 'sys_id';

/**
 * Kinds that assert something ABOUT a subject, and therefore presuppose it.
 *
 * `existence` is deliberately absent: "this column is not there" asserts the
 * absence rather than presupposing the presence, so it is settled by the schema
 * route where polarity is read, not by presupposition failure.
 */
const PRESUPPOSING_KINDS = ['field_value', 'count', 'identity', 'state'];

function result(claim, verdict, reason, evidence) {
    return {
        id: claim.id,
        verdict: verdict,
        reason: reason,
        evidence: evidence || {},
    };
}

/**
 * Adjudicate one claim against one injected metadata read.
 *
 * @param {object} claim as emitted by the extractor: kind, polarity, subject
 * @param {function(string): object} probe table name -> {table_exists, fields[], control:{name,exists}}
 * @returns {{id: string, verdict: string, reason: string, evidence: object}}
 */
function adjudicate(claim, probe) {
    // Polarity first, because without it NOTHING downstream is decidable and
    // the probe would be spent to no purpose (§AX13.1).
    if (claim.polarity !== 'asserts' && claim.polarity !== 'denies') {
        return result(claim, 'unresolvable', 'no_polarity', {});
    }

    const subject = claim.subject || {};
    if (typeof subject.table !== 'string' || subject.table === '') {
        return result(claim, 'unresolvable', 'no_subject_table', {});
    }

    let read;
    try {
        read = probe(subject.table);
    } catch (err) {
        // A probe that threw is an instrument failure, and an instrument
        // failure is never evidence about the instance.
        return result(claim, 'unresolvable', 'probe_failed', { error: String((err && err.message) || err) });
    }

    if (!read || typeof read !== 'object' || !Array.isArray(read.fields)) {
        return result(claim, 'unresolvable', 'probe_failed', {});
    }

    const control = read.control || {};
    const tableControlPassed = control.exists === true;
    const fieldControlPassed = read.fields.indexOf(CONTROL_FIELD) !== -1;
    const asserts = claim.polarity === 'asserts';

    const evidence = {
        table: subject.table,
        table_exists: read.table_exists === true,
        control_table: control.name,
        control_table_present: tableControlPassed,
        control_field_present: fieldControlPassed,
    };
    if (subject.field) evidence.field_present = read.fields.indexOf(subject.field) !== -1;

    // ---- The table, first: everything else is read through it. ----
    if (read.table_exists !== true) {
        if (!tableControlPassed) {
            return result(claim, 'unresolvable', 'control_failed', evidence);
        }
        // A claim that the table is not there, and it is not there.
        if (claim.kind === 'existence' && !subject.field) {
            return result(claim, asserts ? 'refuted' : 'supported', 'table_absent', evidence);
        }
        /**
         * Everything else names the table as the thing it is talking about, so
         * an absent table is a presupposition failure — INCLUDING an existence
         * claim about one of its columns. "That table has no such column" is not
         * vindicated by the table not existing; it asserted a fact about a table
         * that is not there, and the instance contradicts it.
         */
        return result(claim, 'refuted', 'presupposed_table_absent', evidence);
    }

    // ---- The column, where one is named. ----
    if (subject.field) {
        const present = evidence.field_present;
        if (!present && !fieldControlPassed) {
            return result(claim, 'unresolvable', 'control_failed', evidence);
        }
        if (claim.kind === 'existence') {
            const matches = present === asserts;
            return result(claim, matches ? 'supported' : 'refuted', present ? 'field_present' : 'field_absent', evidence);
        }
        if (!present && PRESUPPOSING_KINDS.indexOf(claim.kind) !== -1) {
            /**
             * The one route that survives the mutability rule, and the shape of
             * the failure this axis was commissioned to find: whatever the
             * report said this column contained, and whichever way it said it,
             * there is no such column to contain it. Nothing that has changed on
             * the instance since the run can make the claim true.
             */
            return result(claim, 'refuted', 'presupposed_field_absent', evidence);
        }
        // The column is there. What it CONTAINED at run time is not recoverable.
        return result(claim, 'unresolvable', 'mutable', evidence);
    }

    // ---- No column named. ----
    if (claim.kind === 'existence' && !subject.record) {
        /**
         * The table is there, and the claim is about the TABLE. The
         * record-scoped guard is load-bearing and was missing in the first
         * draft: "this record exists" names the table only to locate the
         * record, and answering it with the table's existence would report a
         * confident verdict about a row nobody looked for — a fabrication of
         * exactly the shape §AW2 forbids, dressed as a schema read.
         */
        return result(claim, asserts ? 'supported' : 'refuted', 'table_present', evidence);
    }

    /**
     * Counts, record identities, record-scoped states and values: the reference
     * state is the run and the run cannot be re-read (brief §2.2). A decisive
     * read today says nothing about then, so a verdict here would be fabricated
     * — §AW5 E-2 registered this exclusion with its own falsifier.
     */
    return result(claim, 'unresolvable', 'mutable', evidence);
}

/**
 * Adjudicate many claims, reading each table exactly once.
 *
 * The memoisation is not an optimisation. Brief §2.1 requires a verdict's
 * control to come from the same call as the observation it qualifies; re-reading
 * per claim would let an observation and its control come from different reads
 * of a moving instance.
 *
 * Output is ordered by claim id — content-derived, so two runs over the same
 * input diff cleanly whatever order the claims arrived in (brief §7).
 */
function adjudicateAll(claims, probe) {
    const cache = new Map();
    const memoised = function (table) {
        if (!cache.has(table)) cache.set(table, probe(table));
        return cache.get(table);
    };

    return claims
        .map(function (claim) {
            return adjudicate(claim, memoised);
        })
        .sort(function (a, b) {
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        });
}

module.exports = {
    VERDICTS: VERDICTS,
    CONTROL_FIELD: CONTROL_FIELD,
    PRESUPPOSING_KINDS: PRESUPPOSING_KINDS,
    adjudicate: adjudicate,
    adjudicateAll: adjudicateAll,
};
