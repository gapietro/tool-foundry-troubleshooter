/**
 * Tests for the guard helper itself (issue #27).
 *
 * A guard is only as trustworthy as the thing it is built on, and the defect
 * #27 filed was precisely that the old strip could silently disable a guard.
 * So the stripper gets its own tests, including one that PINS its documented
 * limitation rather than leaving it as prose.
 */

const { stripComments } = require('./_stripComments')

describe('stripComments', () => {
    test('removes a line comment', () => {
        expect(stripComments('const a = 1 // Now.ref( bad\n').includes('Now.ref(')).toBe(false)
    })

    test('removes a JSDoc block', () => {
        expect(stripComments('/** never use Now.ref( here */\nconst a = 1').includes('Now.ref(')).toBe(false)
    })

    test('removes a PLAIN block comment, which the old JSDoc-only regex missed', () => {
        expect(stripComments('/* Now.ref( */ const a = 1').includes('Now.ref(')).toBe(false)
    })

    test('an unterminated block comment runs to EOF rather than leaking', () => {
        expect(stripComments('/* Now.ref( and no close').includes('Now.ref(')).toBe(false)
    })

    // ---------------------------------------------------------------------
    // The false-negative #27 was actually about: a `//` inside a string, on a
    // line that also carries real code. The old regex stripped the tail and
    // the guard went blind.
    // ---------------------------------------------------------------------
    test('a // inside a string does NOT strip the rest of the line', () => {
        const src = "const url = 'https://example.com'; foo(Now.ref('sys_user_role', {}))"
        expect(stripComments(src).includes('Now.ref(')).toBe(true)
    })

    test('a // inside a template literal does NOT strip the rest of the line', () => {
        const src = 'const s = `see https://x.y`; foo(Now.ref())'
        expect(stripComments(src).includes('Now.ref(')).toBe(true)
    })

    test('a /* inside a string does not open a comment', () => {
        const src = "const s = '/*'; foo(Now.ref())"
        expect(stripComments(src).includes('Now.ref(')).toBe(true)
    })

    test('an escaped quote does not end the string early', () => {
        const src = "const s = 'it\\'s // not a comment'; foo(Now.ref())"
        expect(stripComments(src).includes('Now.ref(')).toBe(true)
    })

    // ---------------------------------------------------------------------
    // The other direction #27 warned about: a trailing comment must still be
    // removed, so a guard does not fail over prose sitting after real code.
    // ---------------------------------------------------------------------
    test('a trailing comment after real code is removed, and the code kept', () => {
        const out = stripComments("agent: 'doctor', // never Now.ref( here\n")
        expect(out.includes('Now.ref(')).toBe(false)
        expect(out.includes("agent: 'doctor'")).toBe(true)
    })

    test('line count is preserved so ^ and $ anchors still line up', () => {
        const src = 'a\n/* two\nline */\nb\n'
        expect(stripComments(src).split('\n').length).toBe(src.split('\n').length)
    })

    test('is total — null and undefined produce a string, not a throw', () => {
        expect(stripComments(null)).toBe('')
        expect(stripComments(undefined)).toBe('')
    })

    // ---------------------------------------------------------------------
    // PINNED LIMITATION. This is not a parser: a regex literal containing //
    // is treated as a comment. No guarded .now.ts file contains one today.
    // If this test ever needs changing, the fix is a real tokenizer, NOT a
    // patch here — that decision is what this test exists to force.
    // ---------------------------------------------------------------------
    test('KNOWN LIMITATION: a regex literal containing // is misread as a comment', () => {
        const out = stripComments('const re = /a\\/\\/b/; foo(Now.ref())')
        expect(out.includes('Now.ref(')).toBe(true) // survives here, because the escapes keep it out of comment territory

        const harder = stripComments('const re = /x//; foo(Now.ref())')
        expect(harder.includes('Now.ref(')).toBe(false) // documented blind spot
    })
})
