/**
 * The rubric's two decision clauses must exist, and must sit where a scorer
 * can read them (issue #139).
 *
 * ---------------------------------------------------------------------------
 * WHY A TEST GUARDS A MARKDOWN FILE
 * ---------------------------------------------------------------------------
 * `fix_usable_unedited` is one of the two terms in §A2's gate expression, so
 * an under-determined reading of it moves a whole benchmark arm between
 * passing and failing -- §T5 measured native at 6/6 under one reading and 0/6
 * under the other. §O5 filed that defect, nothing enforced the repair, and
 * three passes later §T5 found it again with nine of twelve rows flagged
 * ambiguous. Prose with no guard is prose that silently reverts.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS PINNED, AND WHAT DELIBERATELY IS NOT
 * ---------------------------------------------------------------------------
 * PINNED: that each clause exists, that its load-bearing decision terms are
 * present, and that it sits between the §A2 and §A3 headings -- because only
 * §A/§A2/§A3 are copied into a scorer packet, so a clause outside that range
 * is a clause no scorer reads.
 *
 * NOT PINNED: the prose. A test asserting a paragraph verbatim would fail on
 * every copy-edit and teach the next reader to update the fixture rather than
 * think about the rule.
 */

const fs = require('fs')
const path = require('path')

const TEMPLATE = path.join(__dirname, '..', 'benchmark', 'scorecard-template.md')
const source = fs.readFileSync(TEMPLATE, 'utf8')

/** The slice of the template that gets copied into a scorer packet. */
function packetReachingRange(text) {
    const start = text.indexOf('## A2. ')
    const end = text.indexOf('## A3. ')

    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)

    return text.slice(start, end)
}

describe('the fix_usable_unedited clauses exist (issue #139)', () => {
    it('§A2.1 exists', () => {
        expect(source).toContain('### A2.1')
    })

    it('§A2.1 sits inside the range copied into a packet', () => {
        // A clause after §A3 would never reach a scorer, and nothing else
        // in the repo would notice.
        expect(packetReachingRange(source)).toContain('### A2.1')
    })

    it('clause 1 states the recoverability test in terms a scorer can apply', () => {
        const range = packetReachingRange(source)

        expect(range).toContain('not obtainable from the instance')
        // The seven tools are the test's operative list. Naming two of them
        // is enough to catch a rewrite that drops the enumeration.
        expect(range).toContain('log_analysis')
        expect(range).toContain('read_artifact')
    })

    it('clause 1 states the failing side, not only the passing side', () => {
        // A clause that says when to award 1 and never when to award 0 is
        // half a rule, and the half that was already missing.
        expect(packetReachingRange(source)).toContain('did not look it up')
    })

    it('clause 2 states the uniqueness test for a runtime address', () => {
        expect(packetReachingRange(source)).toContain('exactly one record and one field')
    })

    it('the fix_usable_unedited row points a scorer at §A2.1', () => {
        // The column definition is where a scorer starts. If it does not
        // forward to the clauses, they are findable only by reading on.
        const row = source.split('\n').find((l) => l.startsWith('| `fix_usable_unedited`'))

        expect(row).toBeDefined()
        expect(row).toContain('§A2.1')
    })
})
