/**
 * Prepare markdown prose for PHRASE matching, preserving a line map so a
 * failure can still name the line it found.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT _stripComments.js, AND NOT blindRule's per-line scan
 * ---------------------------------------------------------------------------
 * blindRule.test.js matches TOKENS -- single identifiers like
 * x_snc_tsbench_routing -- so scanning line by line is safe: an identifier
 * never straddles a line break. This guard matches PHRASES, and the seed specs
 * are hard-wrapped at ~76 characters, so phrases straddle constantly. Seed 05's
 * "earning full - not partial - fix-target credit" is split across lines 22-23
 * (measured against the pre-branch file); a per-line scanner misses it entirely
 * and reports GREEN over a live leak, which is the silent under-coverage this
 * class of guard exists to prevent.
 *
 * Second reason, independent of the first: every leak issue #100 found sits
 * inside a `>` blockquote callout. Joining lines naively yields
 * "earning > full - not partial - ..." and the phrase misses again.
 *
 * Whitespace is deliberately NOT collapsed. Collapsing would break the
 * offset -> line map and cost every failure its line number. Patterns use \s+
 * instead, which covers both the joining space and any wrapped indentation.
 */

/**
 * Strip all leading blockquote markers per line (nested callouts use `>>`,
 * `> >`, etc. -- stripping only one leaves a stray `>` mid-phrase, which is
 * the exact failure this function exists to prevent), join with a single
 * space, and record where each line starts in the joined string.
 */
function normalizeProse(source) {
    const lineStarts = []
    let cursor = 0

    const lines = source.split('\n').map((line) => {
        const stripped = line.replace(/^\s*(?:>\s?)+/, '')
        lineStarts.push(cursor)
        cursor += stripped.length + 1 // +1 for the single space the join adds
        return stripped
    })

    return { text: lines.join(' '), lineStarts }
}

/** 1-indexed source line containing a character offset into normalizeProse().text. */
function lineAt(lineStarts, offset) {
    let line = 1
    for (let i = 0; i < lineStarts.length; i++) {
        if (lineStarts[i] > offset) break
        line = i + 1
    }
    return line
}

module.exports = { normalizeProse, lineAt }
