/**
 * Tables whose sys_id the platform reassigns at install (issue #220).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS — MEASURED, NOT ASSUMED
 * ---------------------------------------------------------------------------
 * The probe's whole identity model is "the sys_id we built is the sys_id that
 * lands". That holds for every artifact family this app ships EXCEPT table
 * metadata, where the platform mints its own:
 *
 *   dist  sys_db_object b69939bf9e8347aaba5568b133765d6d  x_snc_troubleshoot_audit
 *   inst  sys_db_object 76a9a56f2b5a87d0f243fed2ce91bf7e  x_snc_troubleshoot_audit
 *
 * Both tables are present, populated and healthy. Keyed by sys_id the probe
 * called them MISSING and pointed the reader at Build Rule #34 — a confident
 * citation of the wrong cause, which is worse than no finding at all.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS COSTS, STATED PLAINLY
 * ---------------------------------------------------------------------------
 * For every table listed here the probe can no longer tell "the record we built
 * landed" from "a record with the same natural key was already there". That is
 * a real weakening of the check, which is why the list is exported, unit-pinned
 * to its exact membership, and kept to entries that were MEASURED on a live
 * instance. Do not add a table here because a probe run went red — find out why
 * it went red first, because Build Rule #34's silent skip looks identical from
 * the outside and this list is exactly where you would hide one.
 */

/**
 * table → the fields that identify a record when its sys_id cannot.
 * Every field listed must be present, or `naturalKeyFor` refuses to guess.
 */
const NATURAL_KEYS = {
    // Keyed by table name.
    sys_db_object: ['name'],
    // `name` is the table, `element` the column; neither is unique alone.
    sys_dictionary: ['name', 'element'],
}

/**
 * @param {{table: string, fields: Object}} record a parsed dist record
 * @returns {{query: string, fields: Array<string>}|null} null when the record
 *          should stay sys_id-keyed, or when its key fields are incomplete
 */
function naturalKeyFor(record) {
    const keyFields = NATURAL_KEYS[record.table]
    if (!keyFields) return null

    const parts = []
    for (let i = 0; i < keyFields.length; i++) {
        const field = keyFields[i]

        // DECLARED is the test, not non-empty. The dictionary's TABLE-level row
        // carries `<element/>` — an empty element is what identifies it as the
        // collection row, so refusing empties left one record per table unprobed.
        if (!Object.prototype.hasOwnProperty.call(record.fields, field)) return null

        const value = record.fields[field]

        // The lead field is different: empty there identifies nothing, and a
        // key that matches SOME record silently is the one outcome worse than
        // reporting a false MISSING.
        if (i === 0 && (value === undefined || value === null || value === '')) return null

        parts.push(field + '=' + (value === undefined || value === null ? '' : value))
    }

    return { query: parts.join('^'), fields: keyFields }
}

/**
 * Whether a TABLE is natural-keyed. The keying strategy is a property of the
 * table, never of whichever record happened to be read first: deciding it from
 * one record meant a single record missing a key field sent the entire table
 * back to sys_id keying — under which sys_db_object and sys_dictionary are
 * reported MISSING while citing Build Rule #34, which is the confident-wrong-
 * cause outcome this file exists to eliminate. (Review of PR #229.)
 */
function hasNaturalKey(table) {
    return Object.prototype.hasOwnProperty.call(NATURAL_KEYS, table)
}

module.exports = {
    hasNaturalKey: hasNaturalKey,
    naturalKeyFor: naturalKeyFor,
    NATURAL_KEYS: NATURAL_KEYS,
}
