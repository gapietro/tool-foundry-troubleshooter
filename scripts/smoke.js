#!/usr/bin/env node
/**
 * Deploy smoke — did the payload we built actually land? (issue #220)
 *
 * ===========================================================================
 * WHAT THIS TIER IS, AND THE HALF IT DELIBERATELY DOES NOT COVER
 * ===========================================================================
 * #220 filed the exposure: all 1,781 tests are unit tests over `vm`-loaded
 * sources with a stubbed Glide, and every platform-behaviour claim in this repo
 * was established BY HAND through the foundry MCP tools. `ci.yml`'s header says
 * the same thing from the other side — no green tick there is evidence about
 * instance behaviour.
 *
 * This closes the DEPLOY half of that gap and only the deploy half:
 *
 *   COVERED — build, the real install path, and then a record-by-record
 *   comparison of `dist/app/update/*.xml` against what the instance holds.
 *
 *   NOT COVERED — creating a run and driving it to a terminal state. That needs
 *   an authenticated WRITE, and the `now-sdk` CLI has no write channel
 *   (auth · init · download · build · install · dependencies · transform ·
 *   clean · pack · explain · query). The only ways to get one are to export an
 *   instance credential into the environment — which is exactly the boundary
 *   CLAUDE.md draws, since the foundry MCP broker exists to keep the secret out
 *   of shells, argv and transcripts — or to couple the write to install itself,
 *   which would fire a synthetic diagnostic run on every unrelated deploy and
 *   pollute the benchmark's own tables. Neither was worth buying here. The
 *   runtime half stays a live-MCP exercise and is NOT pretended away.
 *
 * ===========================================================================
 * WHY EXPECTATIONS COME FROM dist/, NOT FROM A MANIFEST
 * ===========================================================================
 * `dist/app/update/` is the declarative payload install actually sends. Reading
 * it means the probe never needs updating when the app grows an artifact — a
 * hand-written expectation list would go stale, and a stale check that still
 * passes is worse than no check.
 *
 * It also keeps the probe clear of DESIGN.md R-27 ("a fixture that agrees with
 * the code by construction is a second copy of the bug"). dist is what we asked
 * for; the instance is what happened; the probe is the gap between them, and
 * that gap cannot be reproduced by a unit test with a stubbed Glide.
 *
 * Two documented failure modes fall out of the PRESENCE check alone:
 *
 *   - Build Rule #34 — a platform Data Policy makes app install skip a record
 *     SILENTLY (no build error, no install error, nothing in the logs) while
 *     m2m rows referencing it still install. The record is simply absent, which
 *     is precisely what this reports.
 *   - The §AQ near-miss — `sys_updated_on` does NOT move on `now-sdk install`,
 *     so a merged-but-undeployed commit reads as live to any timestamp probe.
 *     This compares CONTENT, which is the lesson that cost us that one.
 *
 * ===========================================================================
 * USAGE
 * ===========================================================================
 *   npm run smoke                    build + install to the default alias, probe
 *   npm run smoke -- --alias other   target a different instance alias
 *   npm run smoke -- --no-install    probe only; asks "is what is deployed what
 *                                    we built" WITHOUT deploying first, which is
 *                                    the drift question rather than the deploy one
 *   npm run smoke -- --no-build      skip the build, probe the existing dist/
 *
 * Exit code is 0 only when every built record is present and matching.
 */

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const { parseUpdateXml } = require('./smoke/parseUpdateXml')
const { compareRecord } = require('./smoke/compare')
const { hasNaturalKey, naturalKeyFor, NATURAL_KEYS } = require('./smoke/naturalKey')

const UPDATE_DIR = path.join(__dirname, '..', 'dist', 'app', 'update')

/**
 * Composite-key separator: a NUL, which cannot occur in a table or column
 * name. Written as an escape rather than as a literal byte — a raw NUL in
 * source makes the file binary to grep and to every other line-oriented tool.
 */
const SEP = '\u0000'

/** Row ceiling for a natural-key read; a response ON it is treated as unread. */
const NATURAL_LIMIT = 2000

/** Instance query URLs get long; keep each one comfortably inside limits. */
const CHUNK = 40

/**
 * Tables the instance refuses to serve **with a `sysparm_query`** — but which
 * read perfectly well WITHOUT one. Probed for PRESENCE only; see
 * `probeByPresence`.
 *
 * ⚠ THIS CONSTANT USED TO ENCODE A MISDIAGNOSIS, AND THE CORRECTION MATTERS
 * MORE THAN THE FOUR RECORDS. It was previously named `REFUSED_TABLES` and
 * documented as tables "the instance refuses to serve over the Table API even
 * to an admin". The 403 was real and correctly measured; the conclusion drawn
 * from it was wrong. It is not the TABLE that is refused — it is any request
 * carrying a `sysparm_query`. Re-measured on gpinst01 (Zurich P10, admin),
 * issue #242:
 *
 *   GET <table>?sysparm_limit=2                          -> 200, rows
 *   GET <table>?sysparm_fields=sys_id                    -> 200, sys_ids
 *   GET <table>?sysparm_query=sys_idIN<two real sys_ids> -> 403
 *   GET <table>?sysparm_query=sys_class_name=<table>     -> 403
 *
 * The 403 detail says so literally: "Field(s) present in the query do not have
 * permission to be read". It is about fields IN THE QUERY, and it fires on any
 * field including `sys_id`. Reproduced through two independent channels (the
 * foundry MCP broker and `now-sdk query`), so it is a platform ACL property,
 * not a defect in either tool.
 *
 * WHY THE OLD BEHAVIOUR WAS WORSE THAN THE MISSING COVERAGE. Under the old
 * reading these records were skipped wholesale and subtracted from the count,
 * and Build Rule #33 makes them **precisely the tables whose composite identity
 * keys churn and duplicate on every redeploy** — so the probe was blind exactly
 * where drift is most likely, with the blindness written into the code as a
 * permanent platform fact. A standing exemption stops being re-examined; that
 * is the mechanism that kept a real coverage hole looking like weather.
 *
 * WHAT IS RECOVERABLE, AND WHAT IS NOT. Presence and count only. The business
 * columns are field-read-denied even without a query — and, measured the same
 * pass, a denied column asked for by name comes back **silently omitted rather
 * than errored** (`-f sys_id,sys_name,name` returns only `sys_id`), so there is
 * no way to tell "absent column" from "denied column" and field-by-field
 * comparison is genuinely impossible here. Presence and COUNT are still exactly
 * what Build Rule #34's silent install-skip and #33's duplication move, which
 * is why the half that IS recoverable is the half worth having.
 *
 * EVERY OTHER read failure remains a FAILURE, and the distinction is the whole
 * point. Treating all unreadable results as a note meant an expired credential,
 * a wrong alias or an unreachable instance made every query fail, produced zero
 * non-note findings, and printed "deploy smoke passed - 0 of 160 records" with
 * exit 0. A probe that verified nothing exited green: the exact "claiming
 * coverage we do not have" error this file's header cites §AQ for.
 * (Found in review of PR #229.)
 *
 * Note this is now a much STRONGER contract than the old one: because the read
 * is known to work, a presence sweep that fails is a real finding rather than
 * an expected refusal. There is no longer any table this tier is allowed to
 * skip.
 */
const PRESENCE_ONLY_TABLES = new Set([
    'sys_gen_ai_feature_mapping',
    'sys_gen_ai_strategy_mapping',
])

/**
 * Page size for a presence sweep. Measured on gpinst01 (#242): at 2000 the
 * whole sys_id list for both tables came back in a SINGLE page —
 * `sys_gen_ai_feature_mapping` 648 rows, `sys_gen_ai_strategy_mapping` 554,
 * both `hasMore:false` — so this is one request per table, not a scan.
 * Pagination below is still real, because "fits in one page today" is a
 * property of the instance, not of the code.
 */
const PRESENCE_LIMIT = 2000

/** Refuses to loop forever if the instance keeps claiming `hasMore`. */
const PRESENCE_MAX_PAGES = 50

function parseArgs(argv) {
    const args = { alias: null, build: true, install: true }
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--alias') {
            // A bare `--alias` used to leave args.alias undefined, and both the
            // install and the probe then silently fell through to the DEFAULT
            // alias — a typo deploying to the wrong instance and reporting a
            // clean pass for it. (Review of PR #229.)
            const value = argv[++i]
            if (!value || value.startsWith('--')) fail('--alias needs an instance alias')
            args.alias = value
        } else if (argv[i] === '--no-install') {
            args.install = false
        } else if (argv[i] === '--no-build') {
            args.build = false
        } else {
            fail('unknown argument: ' + argv[i])
        }
    }
    return args
}

function fail(message) {
    process.stderr.write('smoke: ' + message + '\n')
    process.exit(2)
}

function run(command, commandArgs, label) {
    process.stdout.write('→ ' + label + '\n')
    try {
        execFileSync(command, commandArgs, { stdio: 'inherit' })
    } catch (err) {
        // A failed build or install is the answer, not an error to recover
        // from: the deploy path is what this tier exists to exercise.
        fail(label + ' failed — the deploy path is broken, nothing was probed')
    }
}

/**
 * The one flag both subcommands take, and the reason it is a constant.
 *
 * `now-sdk install` and `now-sdk query` (SDK 4.9.2) both document
 * `-a, --auth <alias>`. There is no `--alias` on either — that spelling is
 * valid only on `auth --add`. This matters more than a naming nit because
 * **now-sdk ignores unknown flags silently** and falls through to the DEFAULT
 * credential (#236): install once emitted `--alias` here while the probe
 * emitted `-a`, so a named alias installed to the default instance and then
 * verified the named one. If the named instance held a matching older copy,
 * this tier reported a clean pass for an instance it never deployed to
 * (#239).
 *
 * Both argv builders below route through `authArgs`, and
 * `test/smokeDeployProbe.test.js` guards that at two layers: the helpers must
 * agree on the auth portion, AND a source scan keeps subcommand argv literals
 * out of the call sites. The second layer exists because the first one alone
 * left the original bug reachable — inlining argv at `main()` kept every
 * helper test green (review of PR #240).
 */
const AUTH_FLAG = '-a'

function authArgs(alias) {
    return alias ? [AUTH_FLAG, alias] : []
}

/** argv for the deploy half. */
function installArgs(alias) {
    return ['install'].concat(authArgs(alias))
}

/** argv for the read half. */
function queryArgs(table, encodedQuery, limit, alias) {
    return [
        'query', table,
        '-q', encodedQuery,
        '--limit', String(limit),
        '-o', 'json',
        // No `-f` filter on purpose: a nonexistent field name comes back as
        // "Access denied", which mimics a missing-ACL failure and would send
        // the reader hunting the wrong defect entirely.
    ].concat(authArgs(alias))
}

/**
 * argv for a PRESENCE sweep — the same subcommand, deliberately without a
 * `sysparm_query` (issue #242).
 *
 * `-q ''` rather than no `-q` at all: the flag is `[required]` by the CLI's own
 * arg parser, and an empty value satisfies it while producing a request that
 * carries no `sysparm_query` — which is the whole trick, and is why this needs
 * no MCP path and no direct Table API call. The issue was filed believing
 * `now-sdk query` could not express this; measured, it can, so the read stays
 * on the single authenticated channel and no new credential surface is
 * introduced.
 *
 * `-f sys_id` IS safe here, and the no-`-f` rule on `queryArgs` still stands
 * for the reason stated there: that rule exists because a NONEXISTENT field
 * name comes back as "Access denied" and sends the reader hunting a missing
 * ACL. `sys_id` exists on every table by definition, so it cannot trigger that
 * confusion — and asking for it alone is what keeps a 648-row sweep at ~41KB.
 */
function presenceArgs(table, limit, offset, alias) {
    return [
        'query', table,
        '-q', '',
        '--limit', String(limit),
        '--offset', String(offset),
        '-f', 'sys_id',
        '-o', 'json',
    ].concat(authArgs(alias))
}

/**
 * Spawns `now-sdk` and parses its envelope. Extracted so the two read shapes
 * share one spawn/parse path and neither has to carry a subcommand literal.
 *
 * @returns {Object} {ok, records, hasMore, nextOffset} or {ok:false, error}
 */
function runQuery(commandArgs) {
    let raw
    try {
        raw = execFileSync('now-sdk', commandArgs, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    } catch (err) {
        // A refused query exits non-zero but still prints its envelope on
        // stdout, and the envelope carries the only useful part — "Insufficient
        // rights to query records" reads very differently from a network error.
        raw = (err.stdout || '').toString()
        if (!raw) return { ok: false, error: (err.stderr || err.message || '').toString().trim() }
    }

    // The CLI prints a banner before the JSON envelope on some paths.
    const start = raw.indexOf('{')
    if (start === -1) return { ok: false, error: 'no JSON in response' }

    let parsed
    try {
        parsed = JSON.parse(raw.slice(start))
    } catch (err) {
        return { ok: false, error: 'unparseable response: ' + err.message }
    }

    if (parsed.ok === false) {
        return { ok: false, error: (parsed.error && parsed.error.message) || 'query refused' }
    }
    return {
        ok: true,
        records: parsed.records || [],
        hasMore: parsed.hasMore === true,
        nextOffset: typeof parsed.nextOffset === 'number' ? parsed.nextOffset : null,
    }
}

/** `now-sdk query` is the only authenticated read channel the CLI offers. */
function query(table, encodedQuery, limit, alias) {
    return runQuery(queryArgs(table, encodedQuery, limit, alias))
}

/**
 * Every sys_id in `table`, read without a `sysparm_query` (issue #242).
 *
 * @returns {Object} {ok:true, sysIds:Set, pages} or {ok:false, error}
 */
function presenceSweep(table, alias) {
    const sysIds = new Set()
    let offset = 0

    for (let page = 1; page <= PRESENCE_MAX_PAGES; page++) {
        const result = runQuery(presenceArgs(table, PRESENCE_LIMIT, offset, alias))
        if (!result.ok) return { ok: false, error: result.error }

        result.records.forEach(function (record) {
            if (record && record.sys_id) sysIds.add(record.sys_id)
        })

        if (!result.hasMore) return { ok: true, sysIds: sysIds, pages: page }

        // A `hasMore` with no usable `nextOffset` would otherwise re-read page
        // one forever and report a confident partial set.
        const next = result.nextOffset !== null ? result.nextOffset : offset + result.records.length
        if (next <= offset) {
            return { ok: false, error: 'pagination did not advance past offset ' + offset }
        }
        offset = next
    }

    return { ok: false, error: 'presence sweep exceeded ' + PRESENCE_MAX_PAGES + ' pages' }
}

function loadBuiltRecords() {
    if (!fs.existsSync(UPDATE_DIR)) {
        fail('no dist/app/update — run a build first (or drop --no-build)')
    }

    const records = []
    fs.readdirSync(UPDATE_DIR).forEach(function (file) {
        if (!file.endsWith('.xml')) return
        const parsed = parseUpdateXml(fs.readFileSync(path.join(UPDATE_DIR, file), 'utf8'))
        if (!parsed.table || !parsed.sysId) {
            // Reported, never skipped quietly — an unparseable payload file
            // means the probe is blind to that record.
            records.push({ unparseable: file })
            return
        }
        if (parsed.defects.length > 0) {
            records.push({ malformed: file, defects: parsed.defects })
            return
        }
        records.push(parsed)
    })
    return records
}

function groupByTable(records) {
    const byTable = new Map()
    records.forEach(function (record) {
        if (!byTable.has(record.table)) byTable.set(record.table, [])
        byTable.get(record.table).push(record)
    })
    return byTable
}

function chunk(items, size) {
    const out = []
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
    return out
}

function main() {
    const args = parseArgs(process.argv.slice(2))

    if (args.build) run('now-sdk', ['build'], 'now-sdk build')
    if (args.install) {
        run('now-sdk', installArgs(args.alias), 'now-sdk install')
    }

    const built = loadBuiltRecords()
    const unparseable = built.filter(function (r) { return r.unparseable })
    const malformed = built.filter(function (r) { return r.malformed })
    const records = built.filter(function (r) { return !r.unparseable && !r.malformed })

    process.stdout.write('→ probing ' + records.length + ' built records against the instance\n')

    const findings = []
    unparseable.forEach(function (r) {
        findings.push({ kind: 'unparseable', file: r.unparseable })
    })
    malformed.forEach(function (r) {
        findings.push({ kind: 'malformed', file: r.malformed, detail: r.defects.join('; ') })
    })

    groupByTable(records).forEach(function (tableRecords, table) {
        probeTable(table, tableRecords, args.alias, findings)
    })

    report(findings, records.length)
}

/**
 * The columns a table actually returns, read off any record in the response.
 * The Table API returns every column of a record — empty ones as `''` — so a
 * name's absence here means the TABLE lacks that column, not that this record
 * failed to install it. That distinction is what keeps `uncomparable` from
 * becoming a hiding place for real mismatches.
 */
function knownFieldsFrom(actualRecords) {
    if (actualRecords.length === 0) return null
    return new Set(Object.keys(actualRecords[0]))
}

function probeTable(table, tableRecords, alias, findings) {
    // Checked FIRST: these tables 403 on any sysparm_query, so both the sys_id
    // path and the natural-key path below would fail on them by construction.
    if (PRESENCE_ONLY_TABLES.has(table)) {
        return probeByPresence(table, tableRecords, alias, findings)
    }

    // Table metadata is identified by natural key, not sys_id — see
    // scripts/smoke/naturalKey.js for the measurement that forced this. The
    // decision is made from the TABLE, never from whichever record was read
    // first; a per-record shortcut here reintroduced the false-MISSING bug.
    if (hasNaturalKey(table)) {
        return probeByNaturalKey(table, tableRecords, NATURAL_KEYS[table], alias, findings)
    }

    chunk(tableRecords, CHUNK).forEach(function (batch) {
        const sysIds = batch.map(function (r) { return r.sysId })
        const result = query(table, 'sys_idIN' + sysIds.join(','), batch.length, alias)

        if (!result.ok) {
            // One finding for the batch: without the read we know nothing about
            // these records, and reporting them as passed would be a lie.
            findings.push({ kind: 'unreadable', table: table, count: batch.length, error: result.error })
            return
        }

        const knownFields = knownFieldsFrom(result.records)
        const actualBySysId = new Map()
        result.records.forEach(function (record) { actualBySysId.set(record.sys_id, record) })

        batch.forEach(function (expected) {
            compareRecord(expected, actualBySysId.get(expected.sysId) || null, { knownFields: knownFields })
                .forEach(function (finding) { findings.push(finding) })
        })
    })
}

/**
 * Presence-only probe for the tables that 403 on any `sysparm_query` (#242).
 *
 * Sweeps every sys_id in the table with no query, then intersects locally. A
 * record that is absent from that set is a REAL `missing` finding — the same
 * kind and the same exit-code weight as anywhere else, because Build Rule #34's
 * silent install-skip is exactly a record that fails to appear. A record that
 * IS present gets a `presence_only` note, which is a disclosure rather than a
 * failure: it is verified to exist and its field values are verified by
 * nothing, and that limitation is recorded per record instead of being implied
 * by a table-level exemption nobody re-reads.
 *
 * A failed sweep is `unreadable`, and it now reddens the run. Under the old
 * code that was an "expected refusal" and passed; the read is measured to work,
 * so a failure here means something changed and the probe cannot speak for
 * these records.
 */
function probeByPresence(table, tableRecords, alias, findings) {
    const sweep = presenceSweep(table, alias)

    if (!sweep.ok) {
        findings.push({
            kind: 'unreadable',
            table: table,
            count: tableRecords.length,
            error: 'presence sweep failed — ' + sweep.error,
        })
        return
    }

    tableRecords.forEach(function (expected) {
        if (sweep.sysIds.has(expected.sysId)) {
            findings.push({ kind: 'presence_only', table: table, sysId: expected.sysId })
        } else {
            findings.push({ kind: 'missing', table: table, sysId: expected.sysId })
        }
    })
}

/**
 * One query per natural-keyed table rather than one per record: fetch on the
 * first key field with an IN, then match the full composite key locally.
 */
function probeByNaturalKey(table, tableRecords, keyFields, alias, findings) {
    const leadField = keyFields[0]
    const leadValues = []
    tableRecords.forEach(function (r) {
        const value = r.fields[leadField]
        if (value && leadValues.indexOf(value) === -1) leadValues.push(value)
    })

    // Chunked like the sys_id path, and for the same reason: an unchunked
    // `IN` list can outgrow the URL limit CHUNK exists to respect.
    const actualRecords = []
    let readFailed = null
    chunk(leadValues, CHUNK).forEach(function (batch) {
        if (readFailed) return
        const result = query(table, leadField + 'IN' + batch.join(','), NATURAL_LIMIT, alias)
        if (!result.ok) {
            readFailed = result.error
            return
        }
        // A response sitting exactly on the limit may have been cut, and the
        // rows we did not see would be reported MISSING with a confident Build
        // Rule #34 citation. Refuse to guess. (Review of PR #229.)
        if (result.records.length >= NATURAL_LIMIT) {
            readFailed = 'response hit the ' + NATURAL_LIMIT + '-row limit; results may be truncated'
            return
        }
        result.records.forEach(function (record) { actualRecords.push(record) })
    })

    if (readFailed) {
        findings.push({ kind: 'unreadable', table: table, count: tableRecords.length, error: readFailed })
        return
    }
    const result = { records: actualRecords }

    const compositeKey = function (fieldsOf) {
        return keyFields.map(function (f) { return String(fieldsOf[f] === undefined ? '' : fieldsOf[f]) }).join(SEP)
    }

    const knownFields = knownFieldsFrom(result.records)
    const actualByKey = new Map()
    result.records.forEach(function (record) { actualByKey.set(compositeKey(record), record) })

    tableRecords.forEach(function (expected) {
        const natural = naturalKeyFor(expected)
        // No usable key means we refuse to guess — reported, never assumed pass.
        if (!natural) {
            findings.push({ kind: 'unkeyed', table: table, sysId: expected.sysId })
            return
        }
        compareRecord(expected, actualByKey.get(compositeKey(expected.fields)) || null, { knownFields: knownFields })
            .forEach(function (finding) { findings.push(finding) })
    })
}

/**
 * Kinds this shell can emit itself, on top of the ones `compare.js` produces.
 * Both sets are pinned against NOTE_KINDS + PRINTERS by a test, because the
 * two files otherwise have to agree with nothing binding them: a kind added in
 * `compare.js` and forgotten here used to fall through to a generic `else` and
 * print "UNPARSEABLE undefined" while still reddening the run — a red probe
 * with an unactionable line, which is how a check gets ignored and deleted.
 * (Review of PR #230.)
 */
const SHELL_KINDS = ['unparseable', 'malformed', 'unkeyed', 'unreadable', 'presence_only']

/** Kinds that disclose a blind spot without reddening the exit code. */
const NOTE_KINDS = ['uncomparable', 'unasserted', 'truncated', 'nondeterministic', 'presence_only']

/**
 * One printer per failure kind, as data rather than an if/else chain, so the
 * test above can assert the set is complete. A missing kind now throws loudly
 * instead of printing a confident, meaningless line.
 */
const PRINTERS = {
    // Name the most likely cause: this is the one failure mode that produces
    // no error anywhere else in the toolchain.
    missing: function (f) {
        return '  MISSING     ' + f.table + ' ' + f.sysId +
            '\n              built but not on the instance — see Build Rule #34 (Data Policy skips a record silently at install)\n'
    },
    // Window the previews on the first differing character: on a 133KB script
    // body, a head-anchored preview shows two identical strings.
    mismatch: function (f) {
        const at = typeof f.at === 'number' && f.at >= 0 ? f.at : 0
        return '  MISMATCH    ' + f.table + ' ' + f.sysId + ' · ' + f.field +
            ' (first differs at char ' + at + ' of ' + f.expected.length + ')' +
            '\n              expected ' + windowed(f.expected, at) +
            '\n              actual   ' + windowed(f.actual, at) + '\n'
    },
    unreadable: function (f) {
        return '  UNREADABLE  ' + f.table + ' (' + f.count + ' records) — ' + f.error +
            '\n              nothing is known about these records; they are NOT passing\n'
    },
    malformed: function (f) {
        return '  MALFORMED   ' + f.file + ' — ' + f.detail +
            '\n              the probe would compare only a PARTIAL field set for this record\n'
    },
    unkeyed: function (f) {
        return '  UNKEYED     ' + f.table + ' ' + f.sysId +
            '\n              natural-keyed table, but this record lacks its key fields — not probed\n'
    },
    unparseable: function (f) {
        return '  UNPARSEABLE ' + f.file + '\n'
    },
}

/**
 * Blind spots are printed grouped, so the disclosure stays one readable block
 * instead of hundreds of lines nobody reads.
 */
function summarize(allFindings, kind, heading) {
    const counts = new Map()
    allFindings.forEach(function (f) {
        if (f.kind !== kind) return
        const key = f.table + ' · ' + f.field
        counts.set(key, (counts.get(key) || 0) + 1)
    })
    if (counts.size === 0) return

    process.stdout.write('\n' + heading + ':\n')
    counts.forEach(function (count, key) {
        process.stdout.write('  ' + key + ' (' + count + ' record' + (count === 1 ? '' : 's') + ')\n')
    })
}

/**
 * `uncomparable` is a disclosure, not a failure: the field is one dist declared
 * and the target table does not carry, so there is nothing on the instance to
 * be wrong. It is printed — a blind spot nobody can see is the thing this tier
 * exists to stop — but it does not redden the exit code, because a check that
 * fails on a healthy deploy gets ignored and then deleted.
 */
function report(allFindings, total) {
    let probed = total
    const findings = allFindings.filter(function (f) {
        return NOTE_KINDS.indexOf(f.kind) === -1
    })

    summarize(allFindings, 'uncomparable', 'not comparable — dist declares these, the table has no such column')
    summarize(allFindings, 'unasserted', 'not asserted — dist set no value, so the instance value is unchecked')
    summarize(allFindings, 'truncated', 'TRUNCATED BY THE PLATFORM — the column is shorter than the value we built')
    summarize(allFindings, 'nondeterministic', 'regenerated per build — equal once the per-build value is erased')

    // Verified PRESENT, with field comparison impossible rather than skipped
    // (#242). Reported per table with its count, because the count is half of
    // what this recovers: Build Rule #33 duplicates these records on every
    // redeploy, so a number that grows between runs is the signal.
    const presenceOnly = allFindings.filter(function (f) { return f.kind === 'presence_only' })
    if (presenceOnly.length > 0) {
        const byTable = new Map()
        presenceOnly.forEach(function (f) {
            byTable.set(f.table, (byTable.get(f.table) || 0) + 1)
        })
        process.stdout.write(
            '\nPRESENCE ONLY — verified present; field values NOT compared\n' +
            '  (these tables 403 on any sysparm_query and deny field reads, so\n' +
            '   presence and count are all that is recoverable — see issue #242)\n'
        )
        byTable.forEach(function (count, table) {
            process.stdout.write('  ' + table + ' (' + count + ' record' + (count === 1 ? '' : 's') + ')\n')
        })
    }

    // EVERY unread record comes off the count. Otherwise a run that read
    // nothing at all still reported "156 of 160", which is the same overclaim
    // in a smaller font.
    allFindings.forEach(function (f) {
        if (f.kind === 'unreadable') probed -= f.count
    })

    // The pass line names the two grades of verification separately. Folding
    // them into one "present and matching" figure would state something false
    // about the presence-only records, which is the failure this whole issue
    // is about — one number cannot carry two different claims.
    const matched = probed - presenceOnly.length
    const grade = presenceOnly.length === 0
        ? probed + ' of ' + total + ' records present and matching'
        : probed + ' of ' + total + ' records present — ' + matched +
          ' field-matched, ' + presenceOnly.length + ' presence-only'

    if (findings.length === 0) {
        process.stdout.write('\n✓ deploy smoke passed — ' + grade + '\n')
        return
    }

    process.stdout.write('\n✗ deploy smoke FAILED — ' + findings.length + ' finding(s) over ' + grade + '\n\n')

    findings.forEach(function (f) {
        // No `else` fallback on purpose — see PRINTERS.
        process.stdout.write(PRINTERS[f.kind](f))
    })

    process.stdout.write('\n')
    // `process.exitCode` rather than `process.exit()`: exiting immediately after
    // a write can truncate a piped stdout, which in CI drops the very finding
    // list the run exists to produce. (Review of PR #229.)
    process.exitCode = 1
}

/** 60 characters either side of the divergence, with an ellipsis where cut. */
function windowed(value, at) {
    const text = String(value)
    const from = Math.max(0, at - 60)
    const to = Math.min(text.length, at + 60)
    const slice = text.slice(from, to).replace(/\n/g, '\\n')
    return (from > 0 ? '…' : '') + JSON.stringify(slice) + (to < text.length ? '…' : '')
}

/* istanbul ignore next -- entry point */
if (require.main === module) main()

module.exports = {
    NOTE_KINDS: NOTE_KINDS,
    PRINTERS: PRINTERS,
    SHELL_KINDS: SHELL_KINDS,
    PRESENCE_ONLY_TABLES: PRESENCE_ONLY_TABLES,
    PRESENCE_LIMIT: PRESENCE_LIMIT,
    AUTH_FLAG: AUTH_FLAG,
    installArgs: installArgs,
    queryArgs: queryArgs,
    presenceArgs: presenceArgs,
    presenceSweep: presenceSweep,
    probeByPresence: probeByPresence,
}
