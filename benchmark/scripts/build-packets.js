#!/usr/bin/env node
/**
 * build-packets.js — assembles one pass's scorer packets deterministically.
 *
 * Pass selection is `--pass v13`; the default is v12, whose packets are
 * dispatched, scored evidence. See resolvePaths() for why the pass is data.
 *
 * WHY A SCRIPT. Twenty packets at ~33KB each is not hand work: the rubric
 * section must be byte-identical across all twenty (§AC7 holds scorer topology
 * constant, and a rubric that drifts between packets silently varies the
 * instrument), and every packet must survive the §140 repository-path guard.
 * Both properties are mechanical, so a script asserts them instead of a human
 * remembering them.
 *
 * INPUTS (all local — this script never touches the instance), per pass:
 *   <pass>-rows.json        the row manifest: arm, seed, rep, ids, measurements
 *   <pass>-advance-rulings.json  rulings made on a scoring column BEFORE the pass
 *   <pass>-reports/row-NN.md  each run's report VERBATIM, fetched from the
 *                           instance separately and committed before this runs
 *   scorecard-template.md   rubric source (§A .. end of §A3)
 *   seeds/seed-0N-*.md      the scorer-facing spec
 *
 * OUTPUT: scoring-<pass>/row-NN-<arm>-seed-NN-run-N.md
 *
 * ---------------------------------------------------------------------------
 * scoring-v12/ IS FROZEN. PASS --force TO WRITE OVER IT, AND DO NOT.
 * ---------------------------------------------------------------------------
 * The twenty packets in scoring-v12/ were dispatched to scorers and scored.
 * They are the only record of what those scorers actually read, and the inputs
 * have MOVED since — scorecard-template.md's §A3.3 band table was re-derived
 * after the pass (#158/#161), so re-running this script produces twenty files
 * that differ from the ones that were scored. Overwriting them destroys the
 * evidence and there is no way back. This is the same hazard the packet guard
 * already declares for scoring-v4 ("editing them to satisfy a later rule would
 * destroy the only thing they exist to preserve").
 *
 * So the writer refuses to clobber an existing packet. It was a refusal added
 * after the accident it prevents: an inspection `require()` of this file ran
 * main() and silently rewrote all twenty (#157). Two guards, because either
 * alone would have failed that day — the overwrite check, and main() now
 * running only under `require.main === module`.
 *
 * FAIL-CLOSED, AND LITERALLY SO. Every packet is built in memory and scanned
 * with the same patterns test/scorerPacketBlindRule.test.js uses, and the
 * rubric-identity check runs, all BEFORE anything is written. A surviving
 * repository path throws with nothing on disk — because a leak that ships is
 * unrecoverable once a scorer has read it (§O5 is the precedent: a leaked round
 * cost a whole pass's comparability).
 *
 * The first version interleaved scan and write in one loop, which was not
 * fail-closed at all: a leak at row 15 threw with 14 packets already written,
 * and a re-run after an edit left 20 complete-looking files silently mixing
 * fresh and stale ones. Caught in review (#155 review, I1).
 */

'use strict'

const fs = require('fs')
const path = require('path')

const BENCH = path.resolve(__dirname, '..')

// The pass is DATA, not a filename. This script was `build-v12-packets.js` with
// all four inputs hardcoded, and DECISION.md §AI7 item 12 records what that
// cost: the v13 pre-registration named `scoring-v13/` as an artefact while
// nothing on disk could produce it, and §AI6 forbids touching packets until all
// twenty runs terminate — so the gap would have surfaced after an hour of
// instance time, at the one moment the protocol says not to improvise.
//
// Parameterised rather than forked. This file is the blind-rule boundary AND
// the redaction layer; two copies drifting apart would make one pass's
// ambiguity tally incomparable with another's and nothing would flag it.
const DEFAULT_PASS = 'v12'

/**
 * Resolve a pass token to its four inputs/outputs. Pure — it never touches the
 * filesystem, so a pass whose files do not exist yet still resolves, and the
 * "which artefact is missing" error is raised at read time with the filename in
 * it rather than as an ENOENT out of a JSON.parse.
 *
 * The token is validated because `--pass ../..` or `--pass v12/../scoring-v4`
 * would otherwise resolve outside benchmark/ or onto frozen evidence, and the
 * freeze guard only catches a directory that is already POPULATED.
 */
function resolvePaths(pass) {
    const p = pass === undefined ? DEFAULT_PASS : pass
    if (typeof p !== 'string' || !/^v\d+$/.test(p)) {
        throw new Error(
            'invalid pass token ' + JSON.stringify(p) + ' — a pass is "v" followed by digits ' +
                '(v4, v9, v12, v13). Got something that could resolve outside benchmark/.'
        )
    }
    return {
        pass: p,
        out: path.join(BENCH, 'scoring-' + p),
        reports: path.join(BENCH, p + '-reports'),
        rows: path.join(BENCH, p + '-rows.json'),
        rulings: path.join(BENCH, p + '-advance-rulings.json'),
    }
}

/** Read a required input, naming the artefact and the pass when it is absent. */
function readInput(file, pass, what) {
    if (!fs.existsSync(file)) {
        throw new Error(
            'MISSING INPUT for pass ' + pass + ' — ' + what + ' not found at ' + path.basename(file) + '.\n' +
                'Expected ' + file + '. Every pass needs all four: <pass>-rows.json, ' +
                '<pass>-advance-rulings.json, <pass>-reports/, and a free scoring-<pass>/.'
        )
    }
    return fs.readFileSync(file, 'utf8')
}

// Kept exported and pointing at the dispatched v12 directory: the freeze tests
// in packetGeneratorParity.test.js assert on it.
const OUT = path.join(BENCH, 'scoring-' + DEFAULT_PASS)

const RUBRIC_START = '## A. The 6-point rubric'
const SEED_SECTION = '## 2. Seed specification'

// ---------------------------------------------------------------------------
// The guard's own pattern set, copied deliberately rather than imported.
// Importing from the test would make the check circular: a bug in the test's
// patterns would silently disable the check here too. Two independent copies
// disagreeing is a signal; one shared copy being wrong is invisible.
//
// "Disagreeing is a signal" only holds if something LOOKS. Nothing did, and the
// copies drifted: the guard's `.md` alternation was made case-insensitive and
// this copy did not inherit it (#155 review, I2). test/packetGeneratorParity.
// test.js now compares the stem list as text AND the composed matchers as
// behaviour over a corpus — the drift lived in the alternations, so a stem-list
// diff alone would have stayed green through it. Both are exported below for
// that reason.
// ---------------------------------------------------------------------------
const PATH_STEMS =
    'benchmark|docs|src|test|seed-app|node_modules|dist|\\.claude|\\.superpowers|' +
    'seeds|history|results|scoring-v[0-9]+|' +
    'scorecard-[A-Za-z0-9_-]+|raw-evidence-[A-Za-z0-9_-]+'

const LEAK_PATTERNS = [
    new RegExp('(?:' + PATH_STEMS + ')/[A-Za-z0-9_./-]*', 'g'),
    new RegExp('\\.{1,2}/(?:' + PATH_STEMS + ')', 'g'),
    /[A-Za-z0-9_-]+\.[mM][dD]\b/g,
]

/**
 * Path redaction, explicit arm. Ordered longest-first so a nested path is
 * replaced before the prefix that would otherwise swallow it and leave a
 * fragment behind. Each replacement says what the path POINTED AT, so no
 * sentence loses its meaning — the redaction is mechanical and touches paths
 * only.
 *
 * That last claim is asserted in every packet's section 1, and #157 found it
 * false in five places, all of them paths the explicit map missed and the
 * GENERIC sweep below then mangled. The repair is structural rather than a
 * list of five patches: the generic sweep no longer emits prose at all (see
 * REVIEW_SENTINEL), so a path that reaches it fails the build until someone
 * writes the entry here and reads the resulting sentence.
 */
const REDACTIONS = [
    // A `cd` into a repository directory. Redacting the path alone left
    // "cd the build output directory && now-sdk install" in all 20 packets —
    // a setup step that cannot be run. The command survives; only the path goes.
    [
        '`cd benchmark/seed-app && now-sdk install --alias gpinst01`',
        "run `now-sdk install --alias gpinst01` from the fixture app's directory",
    ],
    ['`../scorecard-template.md` § "Void runs"', "the scoring template's void-run section"],
    ['`../scorecard-template.md` § A', "the scoring template's rubric section"],
    ['`../scorecard-template.md`', 'the scoring template'],
    ['`../../test/blindRule.test.js`', 'the blind-rule guard test'],
    ['`../raw-evidence-seed-qualification-02-05.md`', 'the seed-qualification evidence record'],
    ['`.claude/context/sdk-examples/now-assist-skill.now.ts`', 'the Now Assist skill golden example'],
    ['`.claude/context/sdk-reference.md`', "the project's SDK build-rule reference"],
    // The parenthetical goes with the path because the sentence reads
    // "<path> (main repo) guards the construction" and the replacement is a
    // noun phrase, not a filename.
    ['`test/seed02Construction.test.js` (main repo)', 'a dedicated unit test in the main repo'],
    // The fixture app's Fluent sources, as a pattern rather than ten literals:
    // each seed cites its own file in two forms (`../seed-app/...` in the
    // header table, bare `seed-app/...` in prose). The shared ACL file is a
    // DIFFERENT thing and must be described as one — describing it as "this
    // seed's Fluent source" would tell a scorer the seed declares its own ACLs.
    [/`\.{0,2}\/?seed-app\/src\/fluent\/seed-tables-acl\.now\.ts`/g, "the fixture app's shared ACL Fluent file"],
    // "for this seed" is an ATTRIBUTION, so it is only emitted when the
    // filename actually carries this packet's seed number. Every spec today
    // cites only its own Fluent file, but a spec that one day cites a
    // neighbour's would otherwise be redacted into telling the scorer the file
    // belongs to the row under scoring — a false claim with a green build, and
    // the same meaning-loss class the sentinel exists to stop. Returning null
    // falls through to the sentinel, so the mistake fails the build instead.
    [
        /`\.{0,2}\/?seed-app\/src\/fluent\/[A-Za-z0-9._-]+`/g,
        (m, ctx) => (ctx.seed && m.indexOf('seed-' + ctx.seed + '-') >= 0 ? "the fixture app's Fluent file for this seed" : null),
    ],
    ['**DESIGN.md R-22**', '**the build contract, ruling R-22**'],
    ['`seeds/history/seed-0N-*.history.md`', 'the per-seed history file'],
    ['`seeds/seed-0N-*.md`', 'the seed specification'],
    ['`benchmark/seed-app`', 'the fixture app'],
    ['`seed-app/dist/`', 'the build output directory'],
    ['`dist/`', 'the build output directory'],
    ['`README.md`', 'the benchmark readme'],
    ['`DECISION.md`', 'the project decision record'],
    ['DESIGN.md', 'the build contract'],
    ['scorecard-template.md', 'the scoring template'],
    ['blindRule.test.js', 'the blind-rule guard test'],
]

/**
 * What the generic sweep emits instead of prose.
 *
 * The sweep exists as a safety net — the same stem list as the guard, because
 * a narrower list here is exactly how a path slips through. But a net that
 * QUIETLY substitutes prose is how #157's damage shipped: "the build output
 * directory" is right for `dist/` and wrong for `test/seed02Construction.test.js`,
 * and nothing distinguished them. So the net now removes the path (no leak) and
 * plants a sentinel that fails the build (no unreviewed sentence). Every real
 * redaction is a line in REDACTIONS that a human read in context.
 */
const REVIEW_SENTINEL = '\u27e6PATH NEEDS A REDACTIONS ENTRY\u27e7'

const STEM_ALT = '(?:' + PATH_STEMS + ')'

const SWEEP = [
    // A stem plus a slash and any path tail. Ordered before the bare-stem rule
    // so the longer match wins.
    new RegExp('`?\\.{0,2}/?' + STEM_ALT + '/[A-Za-z0-9_./*-]*`?', 'g'),
    // A ./ or ../ prefix followed by a bare stem, WITH its extension if it has
    // one. Consuming the extension is #157: without it `../raw-evidence-x.md`
    // left a bare `.md` for the rule below to hit, and one substitution
    // cascaded into another ("a repository a repository document §3").
    new RegExp('`?\\.{1,2}/' + STEM_ALT + '(?:\\.[A-Za-z0-9]+)?`?', 'g'),
    // Any bare markdown filename — the name itself is the navigable pointer.
    /`?[A-Za-z0-9_-]+\.[mM][dD]`?/g,
]

/**
 * Redaction over FROZEN segments: text a rule produces is never visible to a
 * later rule.
 *
 * The previous implementation chained String.replace over the whole document,
 * so rule N could match inside rule N-1's output. That is not a hypothetical —
 * it is exactly how "a repository a repository document" was produced, and no
 * amount of care in any single rule prevents it. Freezing makes the class of
 * bug unreachable rather than absent-for-now.
 *
 * `unreviewed` collects paths the generic sweep caught, and paths an explicit
 * rule declined to describe, for the caller to turn into a build failure.
 * `ctx` carries what a replacement may need to know about where it is being
 * applied — currently just `{ seed }`, so an attribution can be checked rather
 * than assumed.
 */
function redact(text, unreviewed, ctx) {
    const where = ctx || {}
    let segs = [{ t: text, frozen: false }]

    /**
     * Replace every match of `from` in the unfrozen segments, freezing the
     * result. `onMatch` returning null means "this rule will not describe this
     * match" — the path is still removed, but as a sentinel that fails the
     * build, never as a guess.
     */
    const apply = (from, onMatch) => {
        segs = segs.flatMap((s) => {
            if (s.frozen) return [s]
            const out = []
            let last = 0
            if (typeof from === 'string') {
                let i = s.t.indexOf(from)
                if (i < 0) return [s]
                while (i >= 0) {
                    out.push({ t: s.t.slice(last, i), frozen: false })
                    out.push({ t: describe(from, onMatch), frozen: true })
                    last = i + from.length
                    i = s.t.indexOf(from, last)
                }
            } else {
                let m
                from.lastIndex = 0
                while ((m = from.exec(s.t)) !== null) {
                    out.push({ t: s.t.slice(last, m.index), frozen: false })
                    out.push({ t: describe(m[0], onMatch), frozen: true })
                    last = m.index + m[0].length
                    if (m.index === from.lastIndex) from.lastIndex++
                }
                if (!out.length) return [s]
            }
            out.push({ t: s.t.slice(last), frozen: false })
            return out
        })
    }

    const describe = (hit, onMatch) => {
        const replacement = onMatch(hit)
        if (replacement !== null && replacement !== undefined) return replacement
        if (unreviewed) unreviewed.push(hit)
        return REVIEW_SENTINEL
    }

    for (const [from, to] of REDACTIONS) {
        apply(from, (hit) => (typeof to === 'function' ? to(hit, where) : to))
    }

    for (const re of SWEEP) apply(re, () => null)

    // A replacement is a noun phrase, and a noun phrase that opens a sentence
    // needs a capital. Every entry in REDACTIONS is written lower-case and
    // capitalised here instead, because the same phrase lands mid-sentence in
    // one seed and sentence-initial in another and a hardcoded case is wrong in
    // one of them. Restricted to text WE produced (frozen segments) and to a
    // preceding sentence terminator — a line break alone does not qualify,
    // because these specs wrap mid-sentence.
    let tail = ''
    for (let i = 0; i < segs.length; i++) {
        if (segs[i].frozen && (tail === '' || /[.!?][)"'`*\]]*\s+$/.test(tail))) {
            segs[i] = { t: segs[i].t.charAt(0).toUpperCase() + segs[i].t.slice(1), frozen: true }
        }
        // Only the sentence terminator and the whitespace after it can match,
        // so a short window is enough and keeps this linear.
        tail = (tail + segs[i].t).slice(-16)
    }

    return segs.map((s) => s.t).join('')
}

/** Extract §A through the end of §A3 from the scorecard template. */
function rubricSection(unreviewed) {
    const raw = fs.readFileSync(path.join(BENCH, 'scorecard-template.md'), 'utf8')
    const start = raw.indexOf(RUBRIC_START)
    if (start < 0) throw new Error('rubric start marker not found in scorecard template')
    const end = raw.indexOf('## B. Four further columns')
    if (end < 0) throw new Error('rubric end marker (§B) not found in scorecard template')
    return redact(raw.slice(start, end).trimEnd(), unreviewed)
}

/** The scorer-facing seed spec. history/ is never opened. */
function seedSpec(seed, unreviewed) {
    const dir = path.join(BENCH, 'seeds')
    const file = fs.readdirSync(dir).find((f) => f.startsWith('seed-' + seed + '-') && f.endsWith('.md'))
    if (!file) throw new Error('no spec found for seed ' + seed)
    return redact(fs.readFileSync(path.join(dir, file), 'utf8').trimEnd(), unreviewed, { seed: seed })
}

const ARM_LABEL = {
    native: 'native (Agent Doctor, `servicenow_aia_execute`)',
    custom: 'custom (`POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`)',
}

/**
 * The operator commentary register lint.
 *
 * §5 landed almost entirely on one arm (all ten custom rows took a harness
 * HOLD; no native row did), and it carried a VERDICT — "an out-of-box table
 * unrelated to this seed's fixture" tells the scorer the layer-4 sweep was
 * hollow, which is precisely the `layers_swept` credibility judgement the
 * scorer is there to reach. The other arm's shortfall was annotated with the
 * report's own excuse instead ("the report states L4 and L5 were skipped
 * deliberately"). One arm's shortfall pre-judged as a defect, the other's
 * excused, in a field every scorer read: a property of the instrument, not of
 * a row (#157, I4).
 *
 * The rule this encodes: scorer-facing fields NAME the argument of a call and
 * stop. Relevance is the scorer's to judge, and the operator's own reading
 * lives in `operator_note`, which renders nowhere.
 *
 * As with the blind-rule guards, a phrase list too broad simply reddens the
 * build, and that failure IS the signal to write a better phrase — there is
 * no exemption list, because an exemption would be a second and silent way to
 * be unguarded.
 *
 * WHAT IS IN SCOPE, AND THE BOUNDARY IS THE POINT. The lint governs prose the
 * OPERATOR AUTHORS about a run: the row's `note`, the `layers_swept` reading,
 * and (below) every advance ruling. It does NOT govern text TRANSCRIBED from
 * the artefact under test — `hold_text` is the harness's own words, quoted
 * verbatim and advertised as such, exactly like the report body in section 4.
 * The lint's remedy is "name the fact and move the reading to `operator_note`",
 * and that remedy does not exist for a field nobody wrote: editing a verbatim
 * quote to satisfy a register rule would falsify the quote. The scorer is
 * entitled to read what the harness said; the rule is that the operator must
 * not add a verdict on top of it.
 */
const VERDICT_PHRASES = [
    { re: /\bunrelated to\b/i, why: 'judges the relevance of a call\'s argument — the scorer\'s job' },
    { re: /\bthe report (?:states|says|claims)\b/i, why: 'repeats the run\'s own excuse into a measurement field' },
    { re: /\bdeliberately\b/i, why: 'attributes intent to the run under scoring' },
    { re: /\bhollow\b|\bsuperficial\b|\bcredible\b|\bnot genuine\b/i, why: 'grades the sweep the scorer is grading' },
]

/**
 * Operator-authored, scorer-facing row fields. `operator_note` is absent
 * because it renders nowhere; `hold_text` is absent because it is transcribed
 * rather than authored — see the boundary note above.
 */
const SCORER_FACING_FIELDS = ['note', 'layers_swept', 'invocation', 'terminal']

/** Every verdict phrase in one authored string, as reportable lines. */
function verdictHits(text, label) {
    const hits = []
    if (typeof text !== 'string') return hits
    for (const p of VERDICT_PHRASES) {
        const m = text.match(p.re)
        if (m) hits.push(label + ': "' + m[0] + '" — ' + p.why)
    }
    return hits
}

function registerViolations(row) {
    const hits = []
    for (const field of SCORER_FACING_FIELDS) {
        hits.push(...verdictHits(row[field], 'row ' + row.row + ' `' + field + '`'))
    }
    return hits
}

/**
 * Section 5, matching the v9 packet layout so the two passes can be read side
 * by side. Bullet list rather than a table: v9 used bullets, several values are
 * long, and a table cell that wraps is harder for a scorer to read.
 */
function measurements(row) {
    const lines = [
        "Derived from the diagnostic run's own audit trail (`action_type=result`) per §E1–§E2,",
        "independently of the report text — never inferred from the report's own prose.",
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
            ' reached, that argument is named in section 6 instead. Every packet in this pass carries the' +
            ' same fields, so the instrument is constant across rows.'
    )

    return lines.join('\n')
}

/** Section 4 header — run identity and how the run was invoked. */
function reportHeader(row) {
    const lines = [
        '**Harness arm:** ' + ARM_LABEL[row.arm],
        '**How this run was invoked:** ' + row.invocation,
        '**Execution under diagnosis:** ' + (/^\(/.test(row.target_execution) ? row.target_execution : '`' + row.target_execution + '`'),
    ]
    if (row.triggering_record) lines.push('**Triggering record:** `' + row.triggering_record + '`')
    lines.push("**This run's own identity:** " + (row.arm === 'custom' ? 'run_id ' : 'diagnostic execution ') + '`' + row.run_id + '` (' + row.run_number + ')')
    lines.push('**Terminal state:** **' + row.terminal + '**')
    lines.push('**Wall clock:** ' + row.wall_clock)
    lines.push('**Tool-call count:** ' + row.tool_calls)
    return lines.join('  \n')
}

/**
 * Where a rejected run's report body ends and the harness validator's verbatim
 * rejection begins. The report file stores them as one document separated by a
 * rule, which is fine on disk and wrong in a packet: reportBody() picked its
 * fence from the body's FIRST character, so on rows 08/14/20 the rule and the
 * rejection prose ended up INSIDE the ```json fence and were labelled JSON
 * (#157). No content was lost; the label was wrong.
 */
const REJECTION_SPLIT = /\n+-{3,}\nVALIDATOR REJECTION\n/

/**
 * The report body. Custom runs store a structured `fix_report`; native runs
 * emit markdown prose. Both are reproduced in the form the arm produced —
 * v9 did the same, and normalising one into the other would edit the artifact
 * under test rather than present it.
 */
function reportBody(row, raw) {
    const out = []

    if (/failed/.test(row.terminal)) {
        out.push(
            'This run terminated with **no accepted report**. What follows is the report body the model' +
                " produced, verbatim, followed by the harness validator's verbatim rejection. **A rejected" +
                ' report is still scored** — it is the only record of what the model produced.'
        )
        out.push('')
    }

    const split = raw.match(REJECTION_SPLIT)
    const body = split ? raw.slice(0, split.index) : raw
    const rejection = split ? raw.slice(split.index + split[0].length).trim() : null

    if (body.trimStart().startsWith('{')) {
        out.push('```json')
        out.push(body.trimEnd())
        out.push('```')
    } else {
        out.push(body.trimEnd())
    }

    if (rejection) {
        out.push('')
        out.push('**Harness validator rejection, verbatim:**')
        out.push('')
        out.push('```')
        out.push(rejection)
        out.push('```')
    }

    return out.join('\n')
}

/**
 * Section 3 — rulings made on a scoring column BEFORE the pass ran.
 *
 * §AC4 ruled on seed 05's `fix_usable_unedited` exposure in advance and blind,
 * precisely so no scorer would improvise it. The ruling lived only in the
 * pre-registration, which no scorer may read, and the packet build did not
 * carry it across: both seed-05 native scorers flagged the column as
 * under-determined for exactly that reason and one named the absence. It
 * changed no score — both landed on the ruled value independently — but that
 * is luck, not compliance (#160). "Before the scorers meet it" was satisfied in
 * time and defeated in delivery.
 *
 * The section renders in EVERY packet, empty ones included, so the instrument
 * carries the same sections on every row (§AC7).
 */
function advanceRulings(row, rulings) {
    const mine = rulings.filter((r) => r.applies_to.seed === row.seed)
    if (!mine.length) {
        return [
            'None for this seed. Score every column from the rubric in section 1, applied to the',
            'material in the rest of this packet.',
            '',
            'This section appears in every packet of this pass whether or not it carries a ruling,',
            'so its presence says nothing about the row.',
        ].join('\n')
    }
    const out = [
        'A ruling below was fixed in writing **before any row of this pass was scored**, so that no',
        'scorer would have to improvise it row by row. It binds this column for this seed. Where a',
        'ruling applies, apply it — do not re-derive it and do not flag the column ambiguous on the',
        'ground the ruling settles.',
    ]
    for (const r of mine) {
        out.push('')
        out.push('### ' + r.heading)
        out.push('')
        out.push(r.text)
    }
    return out.join('\n')
}

function buildPacket(row, rubric, spec, rulings, reportsDir, pass) {
    const n = String(row.row).padStart(2, '0')
    return [
        '# Scoring packet — Row ' + n,
        '',
        '**Seed:** ' + row.seed + ' · **Harness arm:** ' + ARM_LABEL[row.arm] + ' · **Run:** ' + row.rep,
        '',
        'This packet is self-contained. It contains the scoring rubric, this seed\'s',
        'specification, any ruling made on a scoring column before this pass ran, this',
        'run\'s full report, and this run\'s audit-trail measurements — nothing else.',
        'Score this row using only the content below.',
        '',
        '---',
        '',
        '## 1. Scoring rubric',
        '',
        "Section 1 is reproduced from this project's scoring template; section 2 is reproduced from",
        "this seed's specification. **One deliberate change, applied to both:** repository file paths",
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
        spec,
        '',
        '---',
        '',
        '## 3. Advance rulings on scoring columns',
        '',
        advanceRulings(row, rulings),
        '',
        '---',
        '',
        "## 4. This run's report",
        '',
        reportHeader(row),
        '',
        reportBody(row, readInput(path.join(reportsDir, 'row-' + n + '.md'), pass, "this row's report").trimEnd()),
        '',
        '---',
        '',
        "## 5. This run's audit-trail measurements",
        '',
        measurements(row),
        '',
        '---',
        '',
        '## 6. Notes specific to this run',
        '',
        row.note ? '- ' + row.note : '- No run-specific notes.',
        '- This run reached a terminal state and was not re-run. No row in this pass was void, and no arm used any of its permitted re-runs.',
        '',
        '---',
        '',
        '## 7. What to return',
        '',
        'Score the four rubric columns, then compute `passes_gate` by the rule in section 1.',
        'State your reasoning for each column. If a column is under-determined by the material',
        'above, say so explicitly and set the packet-level `ambiguous` flag to `yes` — do not',
        'guess and do not smooth it over. An honest "under-determined" is a usable measurement;',
        'a confident guess is not.',
        '',
    ].join('\n')
}

/**
 * Every packet, built and fully checked, with nothing written.
 *
 * Split out from main() so the checks can be exercised without a filesystem
 * side effect — by test/packetGeneratorParity.test.js, and by anyone who wants
 * to READ a packet before deciding to ship it. Reading the built file back is
 * how two malformed v12 packets were caught before dispatch; no test found
 * them.
 */
function buildAll(pass) {
    const paths = resolvePaths(pass)
    const rows = JSON.parse(readInput(paths.rows, paths.pass, 'the row manifest'))
    const rulings = JSON.parse(readInput(paths.rulings, paths.pass, 'the advance-rulings file'))

    // A pre-registered ruling that matches no row ships in no packet — the
    // #160 failure mode, one typo away, and silent. Fail before building.
    const orphans = rulings.filter((r) => !rows.some((row) => row.seed === r.applies_to.seed))
    if (orphans.length) {
        throw new Error(
            'REFUSING TO WRITE ANY PACKET — advance ruling(s) match no row in this pass, so they would ' +
                'ship to nobody:\n  ' + orphans.map((r) => r.id + ' (seed ' + r.applies_to.seed + ')').join('\n  ')
        )
    }

    // Operator commentary must not pre-judge a rubric column, on EITHER arm.
    // Rulings are operator-authored scorer-facing prose too — the largest block
    // of it in the packet — so they are linted on the same terms. Exempting
    // them would have been the implicit second-and-silent exemption the note
    // above rules out.
    const register = rows.flatMap(registerViolations)
    for (const r of rulings) {
        register.push(...verdictHits(r.heading, 'ruling ' + r.id + ' `heading`'))
        register.push(...verdictHits(r.text, 'ruling ' + r.id + ' `text`'))
    }
    if (register.length) {
        throw new Error(
            'REFUSING TO WRITE ANY PACKET — ' + register.length + ' scorer-facing field(s) carry an ' +
                'operator verdict. Name the fact, move the reading to `operator_note`:\n  ' + register.join('\n  ')
        )
    }

    const unreviewed = []
    const rubric = rubricSection(unreviewed)
    const specs = {}
    for (const row of rows) {
        if (!specs[row.seed]) specs[row.seed] = seedSpec(row.seed, unreviewed)
    }

    if (unreviewed.length) {
        throw new Error(
            'REFUSING TO WRITE ANY PACKET — ' + unreviewed.length + ' path(s) were removed by the generic ' +
                'sweep with no reviewed replacement. Add each to REDACTIONS and READ THE RESULTING ' +
                'SENTENCE:\n  ' + [...new Set(unreviewed)].join('\n  ')
        )
    }

    // FAIL-CLOSED FOR REAL: build every packet and scan every packet BEFORE
    // writing any of them. The first version of this script interleaved scan
    // and write in one loop, so a leak at row 15 threw with 14 packets already
    // on disk — and a re-run after an edit left a directory of 20
    // complete-looking files silently mixing fresh and stale ones, with the
    // rubric check never reached. Caught in review (I1). Nothing touches the
    // filesystem until all 20 are known clean.
    const built = []
    const leaks = []
    const mismatched = []
    for (const row of rows) {
        const n = String(row.row).padStart(2, '0')
        const name = 'row-' + n + '-' + row.arm + '-seed-' + row.seed + '-run-' + row.rep + '.md'
        const body = buildPacket(row, rubric, specs[row.seed], rulings, paths.reports, paths.pass)

        // A `failed` terminal makes the packet PROMISE a validator rejection,
        // and a report carrying one on a passing row shows it with nothing to
        // explain it. Neither is visible from the built file at a glance, and
        // both are one manifest edit away.
        const raw = readInput(path.join(paths.reports, 'row-' + n + '.md'), paths.pass, "this row's report")
        const hasRejection = REJECTION_SPLIT.test(raw)
        if (/failed/.test(row.terminal) !== hasRejection) {
            mismatched.push(
                name + ': terminal is "' + row.terminal + '" but the report ' +
                    (hasRejection ? 'DOES' : 'does NOT') + ' carry a validator rejection'
            )
        }

        for (const re of LEAK_PATTERNS) {
            const hits = body.match(re)
            if (hits) hits.forEach((h) => leaks.push(name + ': ' + h))
        }
        if (body.includes(REVIEW_SENTINEL)) leaks.push(name + ': unreviewed-path sentinel')
        built.push({ name: name, row: row, body: body })
    }

    if (mismatched.length) {
        throw new Error(
            'REFUSING TO WRITE ANY PACKET — a row\'s terminal state and its report disagree about whether ' +
                'the run was rejected:\n  ' + mismatched.join('\n  ')
        )
    }

    if (leaks.length) {
        throw new Error(
            'REFUSING TO WRITE ANY PACKET — ' + leaks.length + ' repository path(s) survived redaction:\n  ' +
                [...new Set(leaks)].slice(0, 20).join('\n  ')
        )
    }

    // Every ruling must be READABLE in every packet it claims — the #160 defect
    // was delivery, not authorship, so authorship alone is not the check.
    const missing = []
    for (const p of built) {
        for (const r of rulings) {
            if (r.applies_to.seed !== p.row.seed) continue
            if (!p.body.includes(r.heading) || !p.body.includes(r.text.split('\n')[0])) {
                missing.push(p.name + ': ' + r.id)
            }
        }
        // `source` is a pointer into the pre-registration. It exists so an
        // operator can trace the ruling; a scorer following it lands in the
        // answer key, so it must never render.
        for (const r of rulings) {
            if (p.body.includes(r.source)) missing.push(p.name + ': leaked ruling source "' + r.source + '"')
        }
        if (p.row.operator_note && p.body.includes(p.row.operator_note)) {
            missing.push(p.name + ': operator_note rendered into the packet')
        }
    }
    if (missing.length) {
        throw new Error('REFUSING TO WRITE ANY PACKET — advance-ruling delivery check failed:\n  ' + missing.join('\n  '))
    }

    // The rubric must be identical across all twenty. Checked on the built
    // bodies, before writing, for the same reason as the leak scan.
    const marker = (body) => body.slice(body.indexOf(RUBRIC_START), body.indexOf(SEED_SECTION))
    const reference = marker(built[0].body)
    if (!reference) throw new Error('rubric section markers not found — a heading was renamed')
    for (const p of built.slice(1)) {
        if (marker(p.body) !== reference) {
            throw new Error('REFUSING TO WRITE ANY PACKET — rubric section differs in ' + p.name +
                ' — packets are not a constant instrument')
        }
    }

    return built
}

/**
 * Packets already in `dir`, by SHAPE rather than by the names this run happens
 * to compute.
 *
 * Keying the freeze check on the computed filenames fails OPEN, which is worse
 * than not having it: rename a row in the manifest (arm, seed and rep are all
 * in the filename) and `existsSync` misses every one, so the guard passes and
 * twenty stale packets sit beside twenty fresh ones. "The directory already
 * holds packets" is the property that actually matters.
 */
function existingPacketsIn(dir) {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter((f) => /^row-\d+-.*\.md$/.test(f))
}

function main(argv) {
    const args = argv || []
    const force = args.includes('--force')
    // `--out` exists so the freeze check can be exercised on a throwaway
    // directory. Without it the only way to test the guard is to point the real
    // writer at the real scoring-v12/ and rely on the guard under test to stop
    // it — a test that writes twenty packets the moment it regresses.
    const outFlag = args.indexOf('--out')
    if (outFlag >= 0 && !args[outFlag + 1]) throw new Error('--out needs a directory')

    const passFlag = args.indexOf('--pass')
    if (passFlag >= 0 && !args[passFlag + 1]) throw new Error('--pass needs a pass token, e.g. --pass v13')
    const paths = resolvePaths(passFlag >= 0 ? args[passFlag + 1] : undefined)

    // `--out` still wins, because it is how the freeze guard is exercised on a
    // throwaway directory. Without an explicit --out the destination is the
    // pass's own directory, never DEFAULT_PASS's.
    const out = outFlag >= 0 ? path.resolve(args[outFlag + 1]) : paths.out

    const built = buildAll(paths.pass)

    // scoring-v12/ holds dispatched, scored evidence. See the header.
    const existing = existingPacketsIn(out)
    if (existing.length && !force) {
        throw new Error(
            'REFUSING TO WRITE ANY PACKET — ' + existing.length + ' packet(s) already exist in ' + out + '.\n' +
                'Those files are the only record of what the scorers actually read, and the inputs have\n' +
                'moved since they were dispatched, so rebuilding does not reproduce them. If you genuinely\n' +
                'mean to destroy that record, re-run with --force.'
        )
    }

    if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true })

    const written = []
    for (const p of built) {
        fs.writeFileSync(path.join(out, p.name), p.body)
        written.push(p.name)
    }

    console.log('wrote ' + written.length + ' packets to ' + out)
    console.log('rubric section verified byte-identical across all of them')
    // The directory THIS run wrote, not a hardcoded one. When these two lines
    // said `scoring-v12` unconditionally, a `--pass v13` build printed a runbook
    // whose two edits were ALREADY DONE — so the operator makes two no-op
    // changes, sees `npm test` green, and concludes the gate passed while
    // scoring-v13/ never enters PACKET_SETS and the blind-rule scan never covers
    // a single v13 packet. §AI6 puts the operator here after twenty runs of
    // instance time, which is the worst possible moment to be told the wrong
    // thing confidently.
    const dirName = path.basename(out)
    console.log('\nNEXT (all three, or the suite stays red):')
    console.log('  1. add a PACKET_SETS entry: dir ' + dirName + ', scanned true, a why, packets: ' + written.length)
    console.log('  2. extend the declared-membership literal to include ' + dirName)
    console.log('  3. npm test — must be green BEFORE any packet is handed to a scorer')
}

// Exported so test/packetGeneratorParity.test.js can diff this copy of the
// guard's patterns against the guard's own, and so redact() can be exercised
// on planted prose. main() runs ONLY as a CLI: a bare require() used to rebuild
// all twenty packets as a side effect (#157).
module.exports = {
    PATH_STEMS,
    LEAK_PATTERNS,
    REDACTIONS,
    REVIEW_SENTINEL,
    VERDICT_PHRASES,
    SCORER_FACING_FIELDS,
    OUT,
    redact,
    reportBody,
    registerViolations,
    verdictHits,
    existingPacketsIn,
    advanceRulings,
    buildAll,
    main,
    resolvePaths,
    readInput,
    DEFAULT_PASS,
}

if (require.main === module) main(process.argv.slice(2))
