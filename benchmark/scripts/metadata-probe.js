'use strict';
/**
 * metadata-probe.js — the injected instance read that `claim-adjudication.js`
 * is registered to receive, and the last piece between a frozen claim and a
 * verdict.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS READS A SNAPSHOT AND NOT AN INSTANCE
 * ---------------------------------------------------------------------------
 * Brief §7 requires the client be injected rather than constructed inline, and
 * the adjudicator's own header goes further: "this module cannot reach an
 * instance even if asked to, which is what makes every branch testable and what
 * keeps credentials on the far side of the MCP boundary." That boundary is a
 * project rule, not a preference — every instance read goes through the MCP
 * broker so no secret enters an argv, an environment or a transcript, and a
 * Node process has no way to make such a call.
 *
 * So collection and adjudication are split. The metadata is read ONCE through
 * the broker, written to a committed snapshot with its provenance, and this
 * module replays it. Two properties follow, and the second is the one that
 * matters: the adjudication is reproducible by anyone holding the repository,
 * and it stays reproducible after the instance has moved on — which it will,
 * because the reference state is a run that already happened (brief §2.2).
 *
 * ---------------------------------------------------------------------------
 * WHAT A SNAPSHOT MAY NOT DO: ANSWER FOR A TABLE NOBODY READ
 * ---------------------------------------------------------------------------
 * Every path where the evidence is incomplete THROWS, and the adjudicator turns
 * a throw into `unresolvable` / `probe_failed`. None of them returns a shaped
 * answer, because a shaped answer is indistinguishable from an observation.
 *
 * This is §AW2 applied to the evidence rather than to the instance: an
 * instrument's inability to observe must never be recorded as an observation,
 * and "the collector never read this table" is an inability to observe.
 *
 * ---------------------------------------------------------------------------
 * THE INHERITANCE UNION, AND THE CONTROL THAT HAD TO MOVE WITH IT
 * ---------------------------------------------------------------------------
 * `sys_dictionary` lists the columns a table DECLARES. A child table inherits
 * most of what a report would name about it, so a probe answering from the
 * child's declaration alone reports those columns absent.
 *
 * That is not merely incomplete, it is actively dangerous, and the danger is
 * specific: the adjudicator's in-band control is the presence of `sys_id` in
 * the returned field list, and EVERY table re-declares `sys_id` locally
 * (verified on the target instance across base and extended tables alike). So
 * the control passes while the read is truncated, and a report that correctly
 * described an inherited column is scored a control-approved `refuted` — the
 * fabrication §AX13.1 forbids, manufactured by the guard written to prevent it.
 *
 * Hence: the field list is the UNION over the `super_class` chain, and the
 * control becomes per-link — every table in the chain must have returned its
 * own `sys_id`, or the union is truncated somewhere and the whole read is
 * refused. A control only controls for the failure it can actually see, and
 * `sys_id` at the leaf cannot see a missing link above it.
 */

/**
 * The column every table declares for itself, used as the per-link control.
 *
 * Deliberately the same constant the adjudicator uses at the far end. It is
 * not imported from there: the adjudicator checks it on the UNION, this module
 * checks it on each CONTRIBUTION, and collapsing the two would make a single
 * edit silently weaken a check in a file nobody was editing.
 */
const LINK_CONTROL_FIELD = 'sys_id';

/** Guard against a malformed chain walking forever. Chains here are shallow. */
const MAX_CHAIN_DEPTH = 32;

function fail(message) {
    throw new Error('metadata-probe: ' + message);
}

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * The lookup key for a table name.
 *
 * Table names on this platform are lower-case, so no two distinct tables differ
 * only by case or by surrounding space. Without this, a name the model wrote
 * from report prose as `Incident` threw "uncollected is not absent" — an
 * EVIDENCE gap reported for what is really a key-formatting gap. It failed safe
 * on the verdict and deflated determinacy while misdirecting the diagnosis
 * (review of PR #257).
 *
 * Where the assumption behind it would break — two snapshot keys colliding once
 * normalised — `buildIndex` refuses the snapshot rather than picking one.
 */
function normaliseName(name) {
    return String(name).trim().toLowerCase();
}

/**
 * Index the snapshot's tables by normalised name.
 *
 * `Object.create(null)` and not `{}`: with a bare object a table named after a
 * prototype member reads as already-present, and the cycle check below fires on
 * a first visit (review of PR #257).
 */
function buildIndex(tables) {
    const index = Object.create(null);
    const names = Object.keys(tables);

    for (let i = 0; i < names.length; i++) {
        const key = normaliseName(names[i]);
        if (index[key] !== undefined) {
            fail('snapshot keys "' + index[key].name + '" and "' + names[i] + '" collide once normalised');
        }
        index[key] = { name: names[i], entry: tables[names[i]] };
    }

    return index;
}

/**
 * Reject a snapshot that cannot support a verdict, at construction rather than
 * at the first read.
 *
 * Failing early matters because the alternative is failing per-claim, and a
 * per-claim failure reads as a fact about that claim. A snapshot missing its
 * provenance is not a claim-level problem; it is not evidence at all.
 */
function validateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') fail('snapshot must be an object');

    const provenance = snapshot.provenance;
    if (!provenance || typeof provenance !== 'object') {
        fail('snapshot has no provenance — evidence without a source is not evidence');
    }
    if (typeof provenance.instance !== 'string' || provenance.instance === '') {
        fail('provenance must name the instance it was read from');
    }
    if (typeof provenance.collected_at !== 'string' || provenance.collected_at === '') {
        fail('provenance must record collected_at — the reference state is a moment, not a file');
    }
    if (typeof snapshot.control_table !== 'string' || snapshot.control_table === '') {
        fail('snapshot names no control_table, so no absence it reports could be qualified');
    }
    if (!snapshot.tables || typeof snapshot.tables !== 'object') {
        fail('snapshot has no tables map');
    }
    return snapshot;
}

/**
 * The entry for one table, refusing anything short of a usable record.
 *
 * `undefined` and `{exists: false}` are DIFFERENT and the difference is the
 * whole point: the first says nobody looked, the second says somebody looked
 * and it was not there. Only the second is an observation.
 */
function entryFor(index, name, context) {
    const found = index[normaliseName(name)];
    if (found === undefined) {
        fail('table "' + name + '" is not in the snapshot' + context + ' — uncollected is not absent');
    }
    const entry = found.entry;
    if (!entry || typeof entry.exists !== 'boolean') {
        fail('table "' + name + '" has no exists flag' + context);
    }
    return entry;
}

/**
 * Walk `super_class` to the root, collecting each link's declared columns.
 *
 * Returns the union. Throws if any link is uncollected, absent, or came back
 * without its own control column — all three mean the union is missing
 * something, and a union missing something cannot support a `refuted`.
 */
function unionOverChain(index, leaf) {
    const fields = Object.create(null);
    const seen = Object.create(null);
    let name = leaf;
    let depth = 0;

    while (name) {
        const key = normaliseName(name);
        if (seen[key]) fail('cycle in the super_class chain at "' + name + '"');
        seen[key] = true;
        if (++depth > MAX_CHAIN_DEPTH) fail('super_class chain from "' + leaf + '" exceeds the depth limit');

        const context = key === normaliseName(leaf) ? '' : ' (ancestor of "' + leaf + '")';
        const entry = entryFor(index, name, context);
        if (entry.exists !== true) {
            fail('table "' + name + '" is recorded absent' + context + ' — a table cannot extend one that is not there');
        }
        if (!Array.isArray(entry.own_fields)) {
            fail('table "' + name + '" has no own_fields list' + context);
        }
        if (entry.own_fields.indexOf(LINK_CONTROL_FIELD) === -1) {
            fail(
                'link control failed: "' +
                    name +
                    '" returned no ' +
                    LINK_CONTROL_FIELD +
                    context +
                    ' — its contribution to the union is truncated'
            );
        }

        for (let i = 0; i < entry.own_fields.length; i++) fields[entry.own_fields[i]] = true;

        /**
         * THE KEY MUST BE THERE, AND A ROOT SAYS SO EXPLICITLY.
         *
         * This was the most serious finding in review of PR #257, and it was
         * this module's own defect in the species it exists to prevent:
         * `exists` and `own_fields` were both asserted, while `super_class` was
         * type-checked only WHEN PRESENT. A collector that dropped or renamed
         * the key for one row terminated the walk at the leaf — union truncated,
         * per-link control passing because the leaf declares its own `sys_id`,
         * and a report correctly naming an inherited column scored a
         * control-approved `refuted`.
         *
         * Saying nothing is not saying "root". A root declares `null`.
         */
        if (!hasOwn(entry, 'super_class')) {
            fail(
                'table "' +
                    name +
                    '" declares no super_class key' +
                    context +
                    ' — a root must say so with null, and a missing key is not a declared root'
            );
        }
        const parent = entry.super_class;
        if (parent !== null && typeof parent !== 'string') {
            fail('table "' + name + '" has a super_class that is neither a name nor null' + context);
        }
        name = parent || null;
    }

    return Object.keys(fields).sort();
}

/**
 * Build the probe the adjudicator injects.
 *
 * @param {object} snapshot as written by the collector
 * @returns {function(string): {table_exists: boolean, fields: string[], control: {name: string, exists: boolean}}}
 */
function makeProbe(snapshot) {
    validateSnapshot(snapshot);
    const index = buildIndex(snapshot.tables);
    const controlName = snapshot.control_table;

    /**
     * The table-level control, resolved once from the same snapshot as every
     * observation it qualifies — which is what brief §2.1 rule 2 means by "the
     * same call and the same auth context" once the call has been made ahead of
     * time.
     *
     * The two states are NOT collapsed, and the first version of this collapsed
     * them (review of PR #257). A control table the collector **never read** is
     * a hole in the snapshot: it throws here, at construction, because every
     * verdict drawn from that snapshot would be equally unqualified and failing
     * per-claim would report a snapshot-level hole once per claim as though it
     * were claim-level. A control table that **was** looked for and not found is
     * an observation: `exists: false`, which the adjudicator renders
     * `control_failed`. The instrument worked; what it saw supports no verdict.
     *
     * The earlier code reported the first case as the second — §AX14.3's own
     * rule, broken by the code registering it.
     */
    const controlEntry = entryFor(index, controlName, ' (the snapshot control table)');
    const control = {
        name: controlName,
        exists: controlEntry.exists === true,
    };

    return function probe(table) {
        const entry = entryFor(index, table, '');

        if (entry.exists !== true) {
            /**
             * No field list, deliberately. §AX13.5 finding 2 was an adjudicator
             * that demanded one from a table that has none and so disabled the
             * only route to `refuted` — the route this axis exists for. The
             * probe must not re-create that from its own side by inventing an
             * empty list that reads as an observed absence of every column.
             */
            return { table_exists: false, control: control };
        }

        return {
            table_exists: true,
            fields: unionOverChain(index, table),
            control: control,
        };
    };
}

module.exports = {
    makeProbe: makeProbe,
    validateSnapshot: validateSnapshot,
};
