/**
 * Blank out block comments and line comments, preserving line numbering so a
 * failure can name the line.
 *
 * Shared by test/referenceStatistics.test.js (#85, reference statistics) and
 * test/blindRule.test.js (#89, seeded answers). Both guards must agree on what
 * counts as emitted text; a per-file copy would let them drift, and the drift
 * would be silent — a scan that looks at LESS text still passes.
 *
 * Explanatory prose ABOUT a leak is exactly where that knowledge belongs. The
 * rule both guards enforce is about what reaches a PAYLOAD.
 */
function stripComments(source) {
    const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    return withoutBlocks
        .split('\n')
        .map((line) => {
            const at = line.indexOf('//')
            if (at === -1) return line
            // Naive, and deliberately so: a `//` inside a string literal only
            // causes a scan to look at LESS text, never more.
            return line.slice(0, at)
        })
        .join('\n')
}

module.exports = { stripComments }
