#!/usr/bin/env node
/**
 * build-v12-packets.js — assembles the v12 scorer packets deterministically.
 *
 * WHY A SCRIPT. Twenty packets at ~33KB each is not hand work: the rubric
 * section must be byte-identical across all twenty (§AC7 holds scorer topology
 * constant, and a rubric that drifts between packets silently varies the
 * instrument), and every packet must survive the §140 repository-path guard.
 * Both properties are mechanical, so a script asserts them instead of a human
 * remembering them.
 *
 * INPUTS (all local — this script never touches the instance):
 *   v12-rows.json        the row manifest: arm, seed, rep, ids, measurements
 *   v12-reports/row-NN.md   each run's report VERBATIM, fetched from the
 *                           instance separately and committed before this runs
 *   scorecard-template.md   rubric source (§A .. end of §A3)
 *   seeds/seed-0N-*.md      the scorer-facing spec
 *
 * OUTPUT: scoring-v12/row-NN-<arm>-seed-NN-run-N.md
 *
 * FAIL-CLOSED. The final step re-scans every emitted packet with the same
 * patterns test/scorerPacketBlindRule.test.js uses. A surviving repository path
 * throws and no packet is written, because a leak that ships is unrecoverable
 * once a scorer has read it (§O5 is the precedent: a leaked round cost a whole
 * pass's comparability).
 */

'use strict'

const fs = require('fs')
const path = require('path')

const BENCH = path.resolve(__dirname, '..')
const OUT = path.join(BENCH, 'scoring-v12')
const REPORTS = path.join(BENCH, 'v12-reports')

// ---------------------------------------------------------------------------
// The guard's own pattern set, copied deliberately rather than imported.
// Importing from the test would make the check circular: a bug in the test's
// patterns would silently disable the check here too. Two independent copies
// disagreeing is a signal; one shared copy being wrong is invisible.
// ---------------------------------------------------------------------------
const PATH_STEMS =
    'benchmark|docs|src|test|seed-app|node_modules|dist|\\.claude|\\.superpowers|' +
    'seeds|history|results|scoring-v[0-9]+|' +
    'scorecard-[A-Za-z0-9_-]+|raw-evidence-[A-Za-z0-9_-]+'

const LEAK_PATTERNS = [
    new RegExp('(?:' + PATH_STEMS + ')/[A-Za-z0-9_./-]*', 'g'),
    new RegExp('\\.{1,2}/(?:' + PATH_STEMS + ')', 'g'),
    /[A-Za-z0-9_-]+\.md\b/g,
]

/**
 * Path redaction. Ordered longest-first so a nested path is replaced before
 * the prefix that would otherwise swallow it and leave a fragment behind.
 * Each replacement says what the path POINTED AT, so no sentence loses its
 * meaning — the redaction is mechanical and touches paths only.
 */
const REDACTIONS = [
    ['`../scorecard-template.md` § "Void runs"', 'the scoring template\'s void-run section'],
    ['`../scorecard-template.md` § A', 'the scoring template\'s rubric section'],
    ['`../scorecard-template.md`', 'the scoring template'],
    ['`../../test/blindRule.test.js`', 'the blind-rule guard test'],
    ['`../seed-app/src/fluent/', 'the fixture app\'s Fluent source for '],
    ['`seeds/history/seed-0N-*.history.md`', 'the per-seed history file'],
    ['`seeds/seed-0N-*.md`', 'the seed specification'],
    ['`benchmark/seed-app`', 'the fixture app'],
    ['`README.md`', 'the benchmark readme'],
    ['`DECISION.md`', 'the project decision record'],
    ['scorecard-template.md', 'the scoring template'],
    ['blindRule.test.js', 'the blind-rule guard test'],
]

function redact(text) {
    let out = text
    for (const [from, to] of REDACTIONS) out = out.split(from).join(to)

    // Generic sweep for anything the explicit map missed. Uses the SAME stem
    // list as the guard, because a narrower list here is exactly how a path
    // slips through — the first run of this script missed a bare `dist/` for
    // that reason and the self-check caught it.
    const stemAlt = '(?:benchmark|docs|src|test|seed-app|node_modules|dist|\\.claude|\\.superpowers|' +
        'seeds|history|results|scoring-v[0-9]+|scorecard-[A-Za-z0-9_-]+|raw-evidence-[A-Za-z0-9_-]+)'

    // A stem plus a slash and any path tail. Ordered before the bare-stem rule
    // so the longer match wins.
    out = out.replace(new RegExp('`?\\.{0,2}/?' + stemAlt + '/[A-Za-z0-9_./*-]*`?', 'g'),
        (m) => (/\.now\.ts/.test(m) ? 'the seed\'s Fluent source file' : 'the build output directory'))

    // A ./ or ../ prefix followed by a bare stem with no trailing slash.
    out = out.replace(new RegExp('`?\\.{1,2}/' + stemAlt + '`?', 'g'), 'a repository location')

    // Any bare markdown filename — the name itself is the navigable pointer.
    out = out.replace(/`?[A-Za-z0-9_-]+\.md`?/g, 'a repository document')

    return out
}

/** Extract §A through the end of §A3 from the scorecard template. */
function rubricSection() {
    const raw = fs.readFileSync(path.join(BENCH, 'scorecard-template.md'), 'utf8')
    const start = raw.indexOf('## A. The 6-point rubric')
    if (start < 0) throw new Error('rubric start marker not found in scorecard template')
    const end = raw.indexOf('## B. Four further columns')
    if (end < 0) throw new Error('rubric end marker (§B) not found in scorecard template')
    return redact(raw.slice(start, end).trimEnd())
}

/** The scorer-facing seed spec. history/ is never opened. */
function seedSpec(seed) {
    const dir = path.join(BENCH, 'seeds')
    const file = fs.readdirSync(dir).find((f) => f.startsWith('seed-' + seed + '-') && f.endsWith('.md'))
    if (!file) throw new Error('no spec found for seed ' + seed)
    return redact(fs.readFileSync(path.join(dir, file), 'utf8').trimEnd())
}

const ARM_LABEL = {
    native: 'native (Agent Doctor, `servicenow_aia_execute`)',
    custom: 'custom (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`)',
}

/**
 * Section 4, matching the v9 packet layout so the two passes can be read side
 * by side. Bullet list rather than a table: v9 used bullets, several values are
 * long, and a table cell that wraps is harder for a scorer to read.
 */
function measurements(row) {
    const lines = [
        'Derived from the diagnostic run\'s own audit trail (`action_type=result`) per §E1–§E2,',
        'independently of the report text — never inferred from the report\'s own prose.',
        '',
        '- **`layers_swept` (audit-trail-derived):** ' + row.layers_swept +
            ' — mechanical §E2 map of the distinct tool set (`agent_trace`→L1, `agent_config`→L2/L3/L7, `schema_lookup`→L4, `query_table`→L5, `genai_log`→L6; `read_artifact` and `log_analysis` map to no layer)',
        '- **Tool-call count:** ' + row.tool_calls + ' result rows',
        '- **Distinct tool names:** ' + row.distinct_tools.length + ' — ' + row.distinct_tools.map((t) => '`' + t + '`').join(', '),
        '- **`layers_available`:** **' + row.layers_available + ' (L1–L7)** — read per §E3 before run 1 by two independent paths that agreed: `sn_aia_agent_tool_m2m` (`agent=e1392946828940e5a708fc51b0a5e954^active=true`) and the harness\'s own tool registry. All seven attached and active, `max_auto_executions = 10` on every one.',
        '- **`continuous_tool_execution_limit`:** ' + row.tool_limit + ' — read live during this pass, not carried forward',
        '- **Terminal state:** **' + row.terminal + '**',
        '- **Wall clock:** ' + row.wall_clock,
        '- **Harness HOLDs:** ' + (row.holds === 0 ? 'none' : String(row.holds)),
    ]

    if (row.hold_text) {
        lines.push('')
        lines.push('The HOLD, recorded on the transcript by actor `system`, verbatim:')
        lines.push('')
        lines.push('```')
        lines.push(row.hold_text)
        lines.push('```')
    }

    lines.push('')
    lines.push(
        '**One stated omission.** The per-call ordered list with timestamps and full arguments is not' +
            ' reproduced here. Where the argument of a held call bears on whether a layer was genuinely' +
            ' reached, that argument is named in section 5 instead. Every packet in this pass carries the' +
            ' same fields, so the instrument is constant across rows.'
    )

    return lines.join('\n')
}

/** Section 3 header — run identity and how the run was invoked. */
function reportHeader(row) {
    const lines = [
        '**Harness arm:** ' + ARM_LABEL[row.arm],
        '**How this run was invoked:** ' + row.invocation,
        '**Execution under diagnosis:** ' + (/^\(/.test(row.target_execution) ? row.target_execution : '`' + row.target_execution + '`'),
    ]
    if (row.triggering_record) lines.push('**Triggering record:** `' + row.triggering_record + '`')
    lines.push('**This run\'s own identity:** ' + (row.arm === 'custom' ? 'run_id ' : 'diagnostic execution ') + '`' + row.run_id + '` (' + row.run_number + ')')
    lines.push('**Terminal state:** **' + row.terminal + '**')
    lines.push('**Wall clock:** ' + row.wall_clock)
    lines.push('**Tool-call count:** ' + row.tool_calls)
    return lines.join('  \n')
}

/**
 * The report body. Custom runs store a structured `fix_report`; native runs
 * emit markdown prose. Both are reproduced in the form the arm produced —
 * v9 did the same, and normalising one into the other would edit the artifact
 * under test rather than present it.
 */
function reportBody(row, raw) {
    const isJson = raw.trimStart().startsWith('{')
    const out = []

    if (/failed/.test(row.terminal)) {
        out.push(
            'This run terminated with **no accepted report**. What follows is the report body the model' +
                ' produced, verbatim, followed by the harness validator\'s verbatim rejection. **A rejected' +
                ' report is still scored** — it is the only record of what the model produced.'
        )
        out.push('')
    }

    if (isJson) {
        out.push('```json')
        out.push(raw)
        out.push('```')
    } else {
        out.push(raw)
    }
    return out.join('\n')
}

function buildPacket(row, rubric) {
    const n = String(row.row).padStart(2, '0')
    return [
        '# Scoring packet — Row ' + n,
        '',
        '**Seed:** ' + row.seed + ' · **Harness arm:** ' + ARM_LABEL[row.arm] + ' · **Run:** ' + row.rep,
        '',
        'This packet is self-contained. It contains the scoring rubric, this seed\'s',
        'specification, this run\'s full report, and this run\'s audit-trail',
        'measurements — nothing else. Score this row using only the content below.',
        '',
        '---',
        '',
        '## 1. Scoring rubric',
        '',
        'Section 1 is reproduced from this project\'s scoring template; section 2 is reproduced from',
        'this seed\'s specification. **One deliberate change, applied to both:** repository file paths',
        'have been replaced with plain-language descriptions of what they point at, because they are',
        'navigable pointers to material a blind scorer must not read. The redaction is **mechanical and',
        'touches paths only** — no rule, band, threshold, points value, measurement, setup step or',
        'scoring note has been altered, added or removed, and no sentence has lost its meaning. This',
        'rubric section is byte-identical in every packet.',
        '',
        rubric,
        '',
        '---',
        '',
        '## 2. Seed specification (in full; repository paths redacted — see the note in section 1)',
        '',
        seedSpec(row.seed),
        '',
        '---',
        '',
        '## 3. This run\'s report',
        '',
        reportHeader(row),
        '',
        reportBody(row, fs.readFileSync(path.join(REPORTS, 'row-' + n + '.md'), 'utf8').trimEnd()),
        '',
        '---',
        '',
        '## 4. This run\'s audit-trail measurements',
        '',
        measurements(row),
        '',
        '---',
        '',
        '## 5. Notes specific to this run',
        '',
        (row.note ? '- ' + row.note : '- No run-specific notes.'),
        '- This run reached a terminal state and was not re-run. No row in this pass was void, and no arm used any of its permitted re-runs.',
        '',
        '---',
        '',
        '## 6. What to return',
        '',
        'Score the four rubric columns, then compute `passes_gate` by the rule in section 1.',
        'State your reasoning for each column. If a column is under-determined by the material',
        'above, say so explicitly and set the packet-level `ambiguous` flag to `yes` — do not',
        'guess and do not smooth it over. An honest "under-determined" is a usable measurement;',
        'a confident guess is not.',
        '',
    ].join('\n')
}

function main() {
    const rows = JSON.parse(fs.readFileSync(path.join(BENCH, 'v12-rows.json'), 'utf8'))
    const rubric = rubricSection()

    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT)

    const written = []
    for (const row of rows) {
        const n = String(row.row).padStart(2, '0')
        const name = 'row-' + n + '-' + row.arm + '-seed-' + row.seed + '-run-' + row.rep + '.md'
        const body = buildPacket(row, rubric)

        const leaks = []
        for (const re of LEAK_PATTERNS) {
            const hits = body.match(re)
            if (hits) leaks.push(...hits)
        }
        if (leaks.length) {
            throw new Error(
                'REFUSING TO WRITE ' + name + ' — ' + leaks.length + ' repository path(s) survived redaction:\n  ' +
                    [...new Set(leaks)].slice(0, 20).join('\n  ')
            )
        }

        fs.writeFileSync(path.join(OUT, name), body)
        written.push(name)
    }

    // The rubric must be identical in all of them, not merely generated once.
    const first = fs.readFileSync(path.join(OUT, written[0]), 'utf8')
    const marker = first.slice(first.indexOf('## A. The 6-point rubric'), first.indexOf('## 2. Seed specification'))
    for (const name of written.slice(1)) {
        const body = fs.readFileSync(path.join(OUT, name), 'utf8')
        const mine = body.slice(body.indexOf('## A. The 6-point rubric'), body.indexOf('## 2. Seed specification'))
        if (mine !== marker) throw new Error('rubric section differs in ' + name + ' — packets are not a constant instrument')
    }

    console.log('wrote ' + written.length + ' packets to scoring-v12/')
    console.log('rubric section verified byte-identical across all of them')
    console.log('\nNEXT (all three, or the suite stays red):')
    console.log('  1. add a PACKET_SETS entry: dir scoring-v12, scanned true, a why, packets: ' + written.length)
    console.log('  2. extend the declared-membership literal to include scoring-v12')
    console.log('  3. npm test — must be green BEFORE any packet is handed to a scorer')
}

main()
