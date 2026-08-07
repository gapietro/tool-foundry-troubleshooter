/**
 * Source scanner for the `<param>=<value>` drift guard (issue #126).
 *
 * Test-only. It reads source as TEXT rather than loading it, because the
 * strings it guards are spread across template literals, concatenated
 * fragments and the Fluent arm's TypeScript — none of which is reachable by
 * executing the tools.
 *
 * ---------------------------------------------------------------------------
 * THE TWO RULES, AND WHY THEY ARE THESE TWO
 * ---------------------------------------------------------------------------
 * Both were derived from the tree, not guessed. A naive line scan over
 * `src/server/tools/**` plus the Fluent file finds 237 matches; restricting to
 * STRING LITERALS drops that to 16, because `table: a.table` and
 * `out.limit = limit` are object syntax that never reaches a model. Of the 16
 * survivors, 15 are deliberate counter-examples and 1 is English punctuation.
 *
 *   1. TIGHT FORM ONLY — `execution=<sys_id>`, no space around the delimiter.
 *      Call syntax is written tight; prose is not. This is what separates a
 *      taught shape from "Call agent_config for the triggers section: compare
 *      the trigger run_as" (PaToolAgentTrace.js:901), which is the single
 *      non-counter-example survivor.
 *
 *   2. NEGATION EXEMPTS — an occurrence immediately preceded by `not` (with an
 *      optional opening quote between) is a counter-example, and showing the
 *      wrong shape in order to reject it is the point. All 15 legitimate
 *      survivors are this: `not execution:<sys_id>`, `not table:incident`,
 *      `not "table:incident"`.
 *
 * Rule 2 is the opt-out that issue #126 asked for, and it is deliberately NOT
 * the file+line allowlist the issue sketched. An allowlist has to be
 * hand-maintained, goes stale silently when lines move, and records that a
 * line is exempt without recording why. The negation is the actual semantic
 * property that makes the string safe, so the sanctioned way to show a bad
 * shape is to negate it — which is what every author has already done without
 * being told.
 *
 * KNOWN LIMIT, stated rather than hidden: a drifted string written loosely
 * (`Re-call with execution = <sys_id>`) passes rule 1. Every occurrence in the
 * two live incidents (#111, #122) was tight, and tightening rule 1 further
 * would flag ordinary prose. The guard is calibrated to the malformation that
 * actually happened.
 */

const fs = require('fs')
const path = require('path')

const TOOL_DIR = path.join(__dirname, '..', 'src', 'server', 'tools')
const FLUENT_FILE = path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts')

/**
 * Every string literal in `src`, with the line it opened on.
 *
 * Comments are skipped first, so a block comment quoting the removed shape to
 * explain it — which several in this tree do — is not scanned, and an
 * apostrophe in comment prose ("the tool's own note") cannot open a literal
 * and swallow the rest of the file.
 *
 * @returns {Array<{line: number, body: string}>}
 */
function stringLiterals(src) {
    var out = []
    var i = 0
    var line = 1
    var n = src.length

    while (i < n) {
        var c = src.charAt(i)

        if (c === '\n') {
            line++
            i++
            continue
        }

        if (c === '/' && src.charAt(i + 1) === '/') {
            while (i < n && src.charAt(i) !== '\n') i++
            continue
        }

        if (c === '/' && src.charAt(i + 1) === '*') {
            i += 2
            while (i < n && !(src.charAt(i) === '*' && src.charAt(i + 1) === '/')) {
                if (src.charAt(i) === '\n') line++
                i++
            }
            i += 2
            continue
        }

        if (c === '"' || c === "'" || c === '`') {
            var quote = c
            var startLine = line
            var body = ''
            i++
            while (i < n && src.charAt(i) !== quote) {
                if (src.charAt(i) === '\\') {
                    body += src.charAt(i) + src.charAt(i + 1)
                    i += 2
                    continue
                }
                if (src.charAt(i) === '\n') line++
                body += src.charAt(i)
                i++
            }
            i++
            out.push({ line: startLine, body: body })
            continue
        }

        i++
    }

    return out
}

function escapeForPattern(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * How far into a literal an occurrence can sit and still be negated by the
 * PREVIOUS literal. Wide enough for an opening quote and a stray space,
 * narrow enough that a fragment ending in `not ` cannot excuse a taught shape
 * further along the next one.
 */
var BRIDGE_CHARS = 3

/**
 * Is this occurrence a negated counter-example? See rule 2 in the header.
 *
 * `prev` is the preceding string literal, if any. These notes are assembled by
 * concatenating wrapped fragments, so `not ` regularly ends one literal and
 * the counter-example opens the next — `PaToolSchemaLookup`'s
 * `table_name_malformed` next_step is exactly that, and it is the case #126
 * named as needing an opt-out. Without the bridge the rule would flag the one
 * string the issue promised to spare.
 */
function isNegated(body, index, prev) {
    var before = body.slice(Math.max(0, index - 12), index)
    if (/\bnot\s+["'`]?$/.test(before)) return true

    if (prev !== null && prev !== undefined && index <= BRIDGE_CHARS) {
        var head = body.slice(0, index)
        // Only an opening quote may sit between the negation and the shape.
        if (!/^["'`]?\s*$/.test(head)) return false
        return /\bnot\s+["'`]?\s*$/.test(prev.slice(-12))
    }

    return false
}

/**
 * Occurrences of the parameter-prefixed shape in `src`'s string literals.
 *
 * @param {String} src source text
 * @param {Array<String>} paramNames the tool's own accepted parameter names
 * @returns {Array<{line: number, param: string, excerpt: string}>}
 */
function scanSource(src, paramNames) {
    if (!paramNames || !paramNames.length) return []

    var alternation = paramNames
        .slice(0)
        .sort(function (a, b) {
            // Longest first, so `table_name` is tried before `table` and a hit
            // is reported against the name the author actually wrote.
            return b.length - a.length
        })
        .map(escapeForPattern)
        .join('|')

    // Tight form only (rule 1), and the value must start with `<` (placeholder)
    // or a word character. A trailing (?![\w_]) after the name stops `table`
    // matching inside `table_prefix=`.
    var pattern = new RegExp('(?:^|[^A-Za-z0-9_$])(' + alternation + ')[:=](<|[A-Za-z0-9_$])', 'g')

    var hits = []
    var literals = stringLiterals(src)

    for (var l = 0; l < literals.length; l++) {
        var body = literals[l].body
        var m
        pattern.lastIndex = 0

        while ((m = pattern.exec(body))) {
            // m.index points at the character before the name unless the name
            // opened the literal.
            var at = m.index + (m[0].length - m[1].length - 2)

            if (isNegated(body, at, l > 0 ? literals[l - 1].body : null)) continue

            hits.push({
                line: literals[l].line,
                param: m[1],
                excerpt: body.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, ' '),
            })
        }
    }

    return hits
}

/**
 * The parameter names a tool declares for itself.
 *
 * Read from source rather than by loading the tool, so the scan does not
 * depend on the tools being constructible. `PARAM_NAMES` is the list #122 gave
 * every tool; `PaToolSchemaLookup` carries the same information as the keys of
 * `PARAM_PREFIX_SLOT` (#125), since its guard is a regex rather than a list.
 */
function toolParamNames(file) {
    var src = fs.readFileSync(file, 'utf8')

    var list = src.match(/PARAM_NAMES\s*:\s*\[([\s\S]*?)\]/)
    if (list) return literalStringsIn(list[1])

    var slot = src.match(/PARAM_PREFIX_SLOT\s*:\s*\{([\s\S]*?)\}/)
    if (slot) {
        var keys = []
        var km
        var kre = /([A-Za-z0-9_$]+)\s*:/g
        while ((km = kre.exec(slot[1]))) keys.push(km[1])
        return keys
    }

    return []
}

function literalStringsIn(fragment) {
    var out = []
    var m
    var re = /['"]([^'"]+)['"]/g
    while ((m = re.exec(fragment))) out.push(m[1])
    return out
}

module.exports = {
    stringLiterals: stringLiterals,
    scanSource: scanSource,
    toolParamNames: toolParamNames,
    TOOL_DIR: TOOL_DIR,
    FLUENT_FILE: FLUENT_FILE,
}
