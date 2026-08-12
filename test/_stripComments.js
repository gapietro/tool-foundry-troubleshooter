/**
 * String-aware comment stripping for source-text guard tests (issue #27).
 *
 * ---------------------------------------------------------------------------
 * THIS HELPER IS SHARED — three consumers, and #27 CHANGED ITS SEMANTICS
 * ---------------------------------------------------------------------------
 * Consumers: test/referenceStatistics.test.js (#85), test/blindRule.test.js
 * (#89), and test/agentDoctorInstructions.test.js (#27, added here).
 *
 * Two deliberate changes from the pre-#27 version, both widening what a guard
 * sees, which is the SAFE direction for every current consumer (all three scan
 * for something that must NOT be present, so seeing more text can only add
 * false positives — loud — never false negatives — silent):
 *
 *   1. STRING-AWARE. The old version took the first `//` on a line and cut the
 *      rest, calling it "naive, and deliberately so: a `//` inside a string
 *      literal only causes a scan to look at LESS text, never more." For a
 *      guard hunting a leak or a forbidden call, less text is the direction
 *      that MISSES a defect while still reporting green. `'https://x'` no
 *      longer blinds the rest of its line.
 *   2. BLANKS rather than truncates. The old version returned the line's head;
 *      this replaces comment characters space-for-space, so column offsets
 *      survive along with line numbers and a guard can point at a real
 *      position. referenceStatistics.test.js's assertion was updated to match
 *      — its test name already said "blanks".
 *
 * WHY A SCANNER RATHER THAN A REGEX
 * The guards in agentDoctorInstructions.test.js assert that
 * src/fluent/agent-doctor.now.ts contains no `triggerConfig:` property and no
 * `Now.ref(` call, so the file stays free to DOCUMENT those hazards (Build
 * Rules #21/#31/#33) while the guards still police the code. That requires
 * removing comments before asserting.
 *
 * The previous strip was `/\/\/.*$/gm`, which is not string-aware, plus a
 * block strip that only matched JSDoc (`/** ... *\/`) and missed plain
 * `/* ... *\/`. Both directions of failure are real and neither is acceptable
 * for a guard:
 *
 *   - FALSE NEGATIVE (the worse one): a `//` inside a string or template on a
 *     line that ALSO carries a real `Now.ref(` later would strip the tail, and
 *     the guard goes blind to an actual defect. A guard that can be silently
 *     disabled by an unrelated edit is worse than no guard, because it still
 *     reports green.
 *   - FALSE POSITIVE: anchoring to full-line comments only (`/^\s*\/\/.*$/gm`)
 *     leaves trailing comments in place, so a line like
 *     `foo: 'bar', // never use Now.ref(...)` fails the guard over prose.
 *
 * Issue #27 noted the defect was UNREACHABLE today — every `//` in the file is
 * a genuine line comment and Fluent style puts each property on its own line.
 * It is fixed anyway because reachability here depends on how someone later
 * writes an unrelated comment, which is not a property worth betting a
 * silent-failure guard on.
 *
 * WHAT THIS IS NOT: a JavaScript parser. It does not handle regex literals
 * (`/foo\/bar/`), because `.now.ts` Fluent files contain none and
 * distinguishing division from a regex needs real parsing. If a guarded file
 * ever gains a regex literal containing `//` or `/*`, replace this with a
 * tokenizer rather than patching it — see the assertion in
 * test/stripComments.test.js that pins this limitation.
 *
 * @param {String} source
 * @returns {String} `source` with comments replaced by equivalent whitespace,
 *          so LINE NUMBERS AND COLUMN OFFSETS ARE PRESERVED — a guard that
 *          reports a match position should point at the real file.
 */
function stripComments(source) {
    const src = String(source === null || source === undefined ? '' : source)
    let out = ''
    let i = 0

    // Newlines are preserved inside replacements so `^`/`$` anchors in the
    // caller's regexes keep matching the same lines they would in the original.
    const blank = (text) => text.replace(/[^\n]/g, ' ')

    while (i < src.length) {
        const ch = src[i]
        const next = src[i + 1]

        // Line comment — to end of line, newline itself kept.
        if (ch === '/' && next === '/') {
            const end = src.indexOf('\n', i)
            const stop = end === -1 ? src.length : end
            out += blank(src.slice(i, stop))
            i = stop
            continue
        }

        // Block comment — covers both /* and /**, unterminated runs to EOF.
        if (ch === '/' && next === '*') {
            const end = src.indexOf('*/', i + 2)
            const stop = end === -1 ? src.length : end + 2
            out += blank(src.slice(i, stop))
            i = stop
            continue
        }

        // String or template literal — copied VERBATIM, which is the whole
        // point: a `//` in here is data, not a comment.
        if (ch === "'" || ch === '"' || ch === '`') {
            const quote = ch
            let j = i + 1
            while (j < src.length) {
                if (src[j] === '\\') {
                    j += 2
                    continue
                }
                if (src[j] === quote) {
                    j += 1
                    break
                }
                j += 1
            }
            out += src.slice(i, Math.min(j, src.length))
            i = j
            continue
        }

        out += ch
        i += 1
    }

    return out
}

module.exports = { stripComments }
