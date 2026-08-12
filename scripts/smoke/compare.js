/**
 * Compare one built record against the one the instance actually holds (#220).
 *
 * ---------------------------------------------------------------------------
 * THE TWO FINDING KINDS, AND WHY THEY ARE DIFFERENT
 * ---------------------------------------------------------------------------
 * `missing` — the instance has no record with that sys_id. This is Build Rule
 * #34's exact signature: a platform Data Policy makes app install SKIP the
 * record with no build error, no install error and nothing in the logs, while
 * the m2m rows that reference it install fine. It is reported as ONE finding
 * per record, never one per field, because the field-level noise would bury the
 * only fact that matters — the record is not there.
 *
 * `mismatch` — the record exists but a field differs. This is the half that
 * answers "is what is deployed what we built", which is the question the §AQ
 * near-miss taught us to ask by CONTENT: `sys_updated_on` does NOT move on
 * `now-sdk install`, so a merged-but-undeployed commit reads as live if you
 * probe by timestamp.
 *
 * ---------------------------------------------------------------------------
 * THE SKIP LIST IS THE RISKY PART, SO IT IS EXPORTED
 * ---------------------------------------------------------------------------
 * Every entry in VOLATILE_FIELDS is a field the probe is BLIND to. That is a
 * real cost, paid to stop the probe crying wolf on values the platform stamps
 * at install time — a check that reports noise gets ignored, then deleted. The
 * set is exported and unit-pinned so it stays reviewable rather than accreting
 * quietly until the probe compares nothing. Adding to it should feel like
 * spending something, because it is.
 */

/**
 * Stamped or rewritten by the platform at install; comparing them reports
 * differences that carry no signal.
 */
const VOLATILE_FIELDS = new Set([
    'sys_created_by',
    'sys_created_on',
    'sys_mod_count',
    'sys_updated_by',
    'sys_updated_on',
    // The update-set bookkeeping name, not a property of the artifact.
    'sys_update_name',
    // Set by the install machinery from the app, not by our definitions.
    'sys_customer_update',
    'sys_replace_on_upgrade',
    'sys_package',
    'sys_policy',
    // The scheduler's own next-run bookkeeping on sysauto_script, rewritten
    // every time the job runs. Nothing to do with what we deployed.
    'run_start',
    // Tautological where it can be compared (sys_id-keyed lookups matched on
    // it), and known to differ where it cannot: the platform mints its own
    // sys_id for table metadata — see scripts/smoke/naturalKey.js.
    'sys_id',
])

/**
 * `''`, `null` and "the instance did not return this field" are the same state.
 * Line endings are normalized because the platform rewrites them on store, and
 * without this every script include reports a mismatch on its whole body.
 */
function normalize(value) {
    if (value === undefined || value === null) return ''
    return String(value).replace(/\r\n/g, '\n')
}

/**
 * @param {{table: string, sysId: string, fields: Object}} expected from dist
 * @param {Object|null} actual the instance record, or null if absent
 * @param {{knownFields?: Set<string>}} [options] the columns this TABLE returns,
 *        gathered from the query response. Omit to compare everything, which is
 *        the conservative default.
 * @returns {Array<Object>} findings, empty when the record matches
 */
function compareRecord(expected, actual, options) {
    const knownFields = (options && options.knownFields) || null

    if (!actual) {
        return [{
            kind: 'missing',
            table: expected.table,
            sysId: expected.sysId,
        }]
    }

    const findings = []

    // Only fields dist DECLARED are compared. The instance carries platform
    // defaults we never expressed an opinion about, and asserting on those
    // would make the probe fail on changes we did not make.
    Object.keys(expected.fields).forEach(function (field) {
        if (VOLATILE_FIELDS.has(field)) return

        // dist can declare a column the target table does not have — MEASURED:
        // it writes `acl`, `active` and `external` onto sn_aia_agent, which has
        // none of them, and install drops them without a word. Comparing those
        // is permanent red on a healthy deploy. Reporting the blindness instead
        // keeps the fact visible without drowning the real findings.
        if (knownFields && !knownFields.has(field)) {
            findings.push({
                kind: 'uncomparable',
                table: expected.table,
                sysId: expected.sysId,
                field: field,
                expected: normalize(expected.fields[field]),
            })
            return
        }

        const exp = normalize(expected.fields[field])
        const act = normalize(actual[field])
        if (exp === act) return

        // An empty value in dist is an ABSENCE OF ASSERTION, not an assertion
        // of emptiness. MEASURED: the SDK emits `<virtual/>`, `<dynamic_creation/>`
        // and `<reference_floats/>` for fields it holds no value for, and the
        // platform then stores its column default — 72 findings of pure noise
        // across 24 healthy dictionary rows before this was understood.
        //
        // The cost, and it is real: a field dist leaves unset is not checked, so
        // a non-default value there goes unseen. Disclosed rather than dropped.
        if (exp === '') {
            findings.push({
                kind: 'unasserted',
                table: expected.table,
                sysId: expected.sysId,
                field: field,
                actual: act,
            })
            return
        }

        // The instance value is EXACTLY the head of ours: the platform capped
        // the column and dropped the tail at install, without a word. MEASURED:
        // short_description is 80 characters, and six of this app's route
        // descriptions are longer. Worth fixing in source, but it is not the
        // deploy being broken — and a check that stays red on a healthy deploy
        // trains the reader to ignore the whole report.
        // `act.length > 0` is load-bearing: the empty string is a prefix of
        // everything, so without it a field that installed as EMPTY — total
        // absence, the thing most worth catching — was reported as a tidy
        // platform truncation and downgraded out of the failure list.
        if (act.length > 0 && act.length < exp.length && exp.slice(0, act.length) === act) {
            findings.push({
                kind: 'truncated',
                table: expected.table,
                sysId: expected.sysId,
                field: field,
                keptChars: act.length,
                droppedChars: exp.length - act.length,
            })
            return
        }

        findings.push({
            kind: 'mismatch',
            table: expected.table,
            sysId: expected.sysId,
            field: field,
            expected: exp,
            actual: act,
            at: firstDifference(exp, act),
        })
    })

    return findings
}

/**
 * Index of the first differing character, or -1 when equal.
 *
 * The report needs this because the two script includes that first went red
 * differ tens of thousands of bytes in, and printing each side's first 120
 * characters produced byte-identical previews under a MISMATCH heading. A
 * finding the reader cannot act on is barely better than no finding.
 */
function firstDifference(a, b) {
    const shorter = Math.min(a.length, b.length)
    for (let i = 0; i < shorter; i++) {
        if (a.charAt(i) !== b.charAt(i)) return i
    }
    return a.length === b.length ? -1 : shorter
}

module.exports = {
    compareRecord: compareRecord,
    firstDifference: firstDifference,
    normalize: normalize,
    VOLATILE_FIELDS: VOLATILE_FIELDS,
}
