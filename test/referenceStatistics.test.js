/**
 * Reference statistics may never be mistakable for run data (issue #85).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * `agent_trace` shipped a note in EVERY payload reading:
 *
 *     "Execution tasks are NOT 1:1 with tool calls (27 tasks / 19 calls in a
 *      measured run). task_stats and tool_call_stats count different things;
 *      do not reconcile them."
 *
 * The 27 and the 19 describe an illustrative run measured once during the
 * build. In the v3 scored benchmark pass (version 2026.08.0220, 2026-08-02)
 * the model read them as findings about the run UNDER DIAGNOSIS in six of ten
 * scored runs plus the smoke run, and built its entire root cause on the
 * supposed discrepancy. One run then proposed, as its fix, adding a note
 * clarifying task_stats vs tool_call_stats — i.e. it proposed adding the note
 * it had itself misread. A note written to PREVENT a misreading was causing
 * one, and it plausibly contributed to the depth collapse measured in #82: a
 * run that believes it found a CONFIRMED layer-1 defect in its first tool
 * result has no reason to sweep further.
 *
 * The audit that followed found the same shape in five more emitted strings
 * across two sibling tools. Every one of them stated a count measured on the
 * reference instance, sitting in a payload beside the real counts for the
 * thing being diagnosed.
 *
 * ---------------------------------------------------------------------------
 * THE TWO RULES THIS FILE PINS
 * ---------------------------------------------------------------------------
 * 1. A count about THIS run/agent/record is emitted as a live value, computed
 *    from the rows actually read. Never a remembered one.
 * 2. A count about the reference instance is emitted ONLY behind
 *    PaToolReadKit.REFERENCE_STAT, whose text says in so many words that the
 *    number is not about anything in the result. DESIGN.md R-22 item 4
 *    requires the denominator to travel with every stated count, so deleting
 *    these numbers is not an option — labelling them is.
 *
 * This is a source scan rather than an output assertion because the risk is a
 * FUTURE hard-coded number, in a note nobody thought to test. The per-tool
 * test files assert the resulting payload text.
 */

const fs = require('fs')
const path = require('path')

const { stripComments } = require('./_stripComments')

const SRC = path.join(__dirname, '..', 'src', 'server')

const FILES = [
    'PaToolReadKit.js',
    path.join('tools', 'PaToolAgentTrace.js'),
    path.join('tools', 'PaToolAgentConfig.js'),
    path.join('tools', 'PaToolGenAiLog.js'),
    path.join('tools', 'PaToolLogAnalysis.js'),
    path.join('tools', 'PaToolQueryTable.js'),
    path.join('tools', 'PaToolSchemaLookup.js'),
    path.join('tools', 'PaToolReadArtifact.js'),
]

/**
 * `38 of 40 rows`, `1 of 2026 rows`, `27 tasks / 19 calls`, `(15.7%)`, and a
 * remembered stack line (`threw at line 42` — the one that sat inside a
 * FINDING, next to the subject field naming the real record, where a reader
 * had every reason to take it for the line this script threw at).
 *
 * A percentage gets its own pattern because the count either side of it may be
 * built from constants — `this.CONNECTION_EMPTY_COUNT + ' of ' + …` puts no
 * digits in the string at all, and the literal `(15.7%)` is the only thing
 * left to catch.
 */
const STAT_PATTERNS = [
    { name: 'X of Y', re: /\b\d+\s+of\s+\d[\d,]*\b/ },
    { name: 'hard-coded percentage', re: /\(\d+(\.\d+)?\s?%\)/ },
    { name: 'remembered stack line', re: /\bat line \d+/i },
    { name: 'illustrative run counts', re: /in a measured run/i },
]

function scan(file) {
    const source = fs.readFileSync(path.join(SRC, file), 'utf8')
    const lines = stripComments(source).split('\n')
    const hits = []

    lines.forEach((line, i) => {
        STAT_PATTERNS.forEach((p) => {
            if (!p.re.test(line)) return
            // A number built from a variable is live data, not a remembered
            // measurement — `' of ' + total + ' rows'` never matches, because
            // the digits are not in the source at all.
            hits.push({ file: file, line: i + 1, text: line.trim(), pattern: p.name })
        })
    })

    return { lines: lines, hits: hits }
}

/** True if REFERENCE_STAT is referenced within the same emitted expression. */
function labelledNearby(lines, lineNumber) {
    const from = Math.max(0, lineNumber - 1 - 12)
    const to = Math.min(lines.length, lineNumber + 2)
    return lines.slice(from, to).join('\n').indexOf('REFERENCE_STAT') !== -1
}

describe('no reference-instance count reaches a payload unlabelled (issue #85)', () => {
    FILES.forEach((file) => {
        it(file + ' labels every hard-coded statistic with REFERENCE_STAT', () => {
            const { lines, hits } = scan(file)
            const unlabelled = hits.filter((h) => !labelledNearby(lines, h.line))

            expect(
                unlabelled.map((h) => h.file + ':' + h.line + '  [' + h.pattern + ']  ' + h.text)
            ).toEqual([])
        })
    })

    it('the exact text that caused six misdiagnoses reaches no payload', () => {
        FILES.forEach((file) => {
            const source = fs.readFileSync(path.join(SRC, file), 'utf8')
            // Comment-stripped: the measurement is still worth recording, and
            // PaToolAgentTrace's header keeps it as a build trap. What it may
            // never do again is ship in the output.
            expect(stripComments(source)).not.toContain('27 tasks / 19 calls')
        })
    })
})

describe('PaToolReadKit.REFERENCE_STAT', () => {
    const { loadScriptInclude } = require('./_loadScriptInclude')

    function text() {
        return new (loadScriptInclude('PaToolReadKit.js', {}).PaToolReadKit)().REFERENCE_STAT
    }

    it('exists as one authored constant rather than a phrase retyped per tool', () => {
        expect(typeof text()).toBe('string')
        expect(text().length).toBeGreaterThan(0)
    })

    it('says outright that the number is not about anything in the result', () => {
        // The v3 failure was a model treating a labelled-but-vague statistic as
        // run data. Two of the six sites ALREADY said "measured over the whole
        // table on gpinst01" and that was not enough — the label has to name
        // what the number is NOT about, not merely where it came from.
        expect(text()).toMatch(/NOT/)
        expect(text().toLowerCase()).toMatch(/this (result|run)/)
    })

    it('reads as a prefix, so the sentence it labels follows it', () => {
        expect(text()).toMatch(/\s$/)
    })
})

describe('the shared comment stripper (test/_stripComments.js)', () => {
    const { stripComments } = require('./_stripComments')

    it('blanks a block comment but keeps the line count', () => {
        const src = 'a\n/* leak\n   leak */\nb'
        expect(stripComments(src).split('\n')).toHaveLength(4)
        expect(stripComments(src)).not.toContain('leak')
    })

    it('blanks a line comment and keeps the code before it', () => {
        expect(stripComments("var x = 1 // leak")).toBe('var x = 1 ')
    })

    it('leaves a source with no comments untouched', () => {
        expect(stripComments("var x = 'plain'")).toBe("var x = 'plain'")
    })
})
