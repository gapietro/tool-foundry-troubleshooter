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

    /**
     * THE PROBE CONTRACT, ENFORCED AT THE BOUNDARY RATHER THAN IMPLIED.
     *
     * `table_exists` must be a boolean — a probe that does not say whether the
     * table is there has not answered. `fields` is required only where a field
     * is actually read: the first version demanded it unconditionally, so a
     * probe answering about a NONEXISTENT table — which naturally has no field
     * list to return — produced `probe_failed` for every such read. That
     * silently disables the only route that can return `refuted`, and the pass
     * would have reported "nothing false found" while never having looked
     * (review of PR #256).
     */
    if (!read || typeof read !== 'object' || typeof read.table_exists !== 'boolean') {
        return result(claim, 'unresolvable', 'probe_failed', {});
    }
    if (read.table_exists && !Array.isArray(read.fields)) {
        return result(claim, 'unresolvable', 'probe_failed', {});
    }
    const fields = Array.isArray(read.fields) ? read.fields : [];

    const control = read.control || {};
    const tableControlPassed = control.exists === true;
    const fieldControlPassed = fields.indexOf(CONTROL_FIELD) !== -1;
    const asserts = claim.polarity === 'asserts';

    const evidence = {
        table: subject.table,
        table_exists: read.table_exists,
        control_table: control.name,
        control_table_present: tableControlPassed,
        control_field_present: fieldControlPassed,
    };
    if (subject.field) evidence.field_present = fields.indexOf(subject.field) !== -1;

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
         * An existence claim about one of the table's COLUMNS, where the table
         * itself is gone, splits by polarity — and the first version did not
         * split it, returning `refuted` either way (review of PR #256).
         *
         * `asserts` — the report says the column is there, and there is not even
         * a table to hold it. The instance contradicts it.
         *
         * `denies` — the report says the column is not there, and it is not.
         * The instance does not contradict that; nor does it corroborate it,
         * because the claim asserted a fact about a table that does not exist.
         * Scoring it `refuted` manufactures a false claim out of a correct
         * observation, which is the failure mode this axis exists to catch and
         * the one §AX13 amended the frozen prompt to prevent. A claim the
         * instrument cannot place on either side gets the third verdict, which
         * is the entire reason there are three.
         */
        if (claim.kind === 'existence' && subject.field && !asserts) {
            return result(claim, 'unresolvable', 'presupposition_failed', evidence);
        }

        /**
         * Everything else names the table as the thing it is talking about, so
         * an absent table is a presupposition failure that cuts one way only:
         * the claim said something about the contents of a table that is not
         * there.
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
        if (!cache.has(table)) {
            /**
             * A FAILURE IS A READ TOO. The first version only cached successful
             * reads, so a transient failure sent the next claim back to the
             * instance — and two claims about one table were then adjudicated
             * against two different reads of a moving instance, which is the
             * condition this memo exists to rule out. It held in every case
             * except the one where the instance was already misbehaving
             * (review of PR #256).
             */
            try {
                cache.set(table, { value: probe(table) });
            } catch (err) {
                cache.set(table, { error: err });
            }
        }
        const entry = cache.get(table);
        if (entry.error) throw entry.error;
        return entry.value;
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
