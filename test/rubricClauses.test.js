/**
 * The rubric's decision clauses must exist, and must sit where a scorer
 * can read them (issues #139, #159).
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
 * present, and that it sits inside the slice copied into a scorer packet --
 * §A through §B -- because a clause outside that range is a clause no scorer
 * reads. §A2.1 is pinned to the narrower §A2..§A3 window it has always
 * occupied; §A1 is pinned to §A..§A2.
 *
 * NOT PINNED: the prose. A test asserting a paragraph verbatim would fail on
 * every copy-edit and teach the next reader to update the fixture rather than
 * think about the rule.
 *
 * ---------------------------------------------------------------------------
 * WHY §A1 IS A SECTION AND NOT A THIRD CASE IN §A2.1 (issue #159)
 * ---------------------------------------------------------------------------
 * §A2.1's clauses decide `fix_usable_unedited`, which is a gate term, and they
 * live under §A2 for that reason -- §A2 is the section about what the gate
 * consumes. `evidence_cites_trace_and_config` is NOT in the gate expression, so
 * filing its clauses under §A2 would have made that heading false while adding
 * nothing. They sit in their own section between §A and §A2 instead: still
 * inside the packet-copied slice, adjacent to the column table a scorer starts
 * from, and honest about which column moves the verdict.
 */

const fs = require('fs')
const path = require('path')

const TEMPLATE = path.join(__dirname, '..', 'benchmark', 'scorecard-template.md')
const source = fs.readFileSync(TEMPLATE, 'utf8')

/** A named slice of the template, with both bounds proven to exist. */
function between(text, startHeading, endHeading) {
    const start = text.indexOf(startHeading)
    const end = text.indexOf(endHeading)

    // indexOf returns -1 on a miss and slice(-1, -1) is the empty string,
    // which passes every `toContain` below vacuously. Assert both bounds.
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)

    return text.slice(start, end)
}

/** The §A2.1 window: the slice §A2.1 has always occupied. */
function packetReachingRange(text) {
    return between(text, '## A2. ', '## A3. ')
}

/** The §A1 window: after the column table, before the gate section. */
function evidenceClauseRange(text) {
    return between(text, '## A1. ', '## A2. ')
}

/** Everything a scorer packet copies -- the generator's own two markers. */
function packetSlice(text) {
    return between(text, '## A. ', '## B. ')
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

    it('clause 2 states the unambiguity test for a runtime address', () => {
        const range = packetReachingRange(source)

        // Both halves are load-bearing: "exactly one record" alone leaves a
        // fix that changes several fields on that record an unstated case,
        // which is the exact defect this clause was reworded to close.
        expect(range).toContain('exactly one record')
        expect(range).toContain('names every field it changes')
    })

    it('the fix_usable_unedited row points a scorer at §A2.1', () => {
        // The column definition is where a scorer starts. If it does not
        // forward to the clauses, they are findable only by reading on.
        const row = source.split('\n').find((l) => l.startsWith('| `fix_usable_unedited`'))

        expect(row).toBeDefined()
        expect(row).toContain('§A2.1')
    })

    it('clause 3 states that the snippet, not only the address, must be applicable', () => {
        // Cases 1 and 2 both pass on a fix whose address is perfect and whose
        // supplied edit does not perform the change. That gap is the clause.
        const range = packetReachingRange(source)

        expect(range).toContain('describes')
        expect(range).toContain('exactly as given')
    })

    it('clause 4 rules on a target named by kind, and on the withheld-name defence', () => {
        const range = packetReachingRange(source)

        // Both halves are load-bearing. Without the first, a class-valued
        // target is undecided; without the second, the blind rule reads as an
        // excuse that lifts the bar, which is the open case this clause closes.
        expect(range).toContain('by kind rather than by name')
        expect(range).toContain('is not a defence')
    })

    it('clause 4 routes a kind-named VALUE back to clause 1 rather than deciding it', () => {
        // Clause 1 already disposes of unfilled values by obtainability, and
        // says an unobtainable one scores 1. A clause 4 that swallowed values
        // whole would contradict it.
        expect(packetReachingRange(source)).toContain('decided by Case 1, not here')
    })
})

describe('the evidence_cites_trace_and_config clauses exist (issue #159)', () => {
    it('§A1 exists and sits between the column table and the gate section', () => {
        expect(source).toContain('## A1. ')
        expect(evidenceClauseRange(source)).toContain('Case 1')
    })

    it('§A1 falls inside the slice the packet generator copies', () => {
        // The generator slices §A. .. §B. -- the same two markers. A clause
        // outside that slice reaches no scorer, and nothing else would notice.
        expect(packetSlice(source)).toContain('## A1. ')
    })

    it('§A1 fixes the order the cases are applied in', () => {
        // Without an order, case 2 (which root cause) and case 3 (does this
        // citation count) can be entered in either sequence and disagree.
        expect(evidenceClauseRange(source)).toContain('Apply them in order')
    })

    it('clause 1 scores a report with no root cause 0, not blank', () => {
        // "Not applicable" is the reading that leaves the cell empty and the
        // /6 short, which is a different defect from the one being closed.
        const range = evidenceClauseRange(source)

        expect(range).toContain('no root cause')
        expect(range).toContain('a blank is not a value')
    })

    it('clause 2 names the primary root cause as the single subject', () => {
        const range = evidenceClauseRange(source)

        // The two rejected readings must both be named, or a scorer meeting a
        // multi-cause report re-derives the choice.
        expect(range).toContain('primary')
        expect(range).toContain('the report as a whole')
        expect(range).toContain('every entry')
    })

    it('clause 3 makes relevance a structural test, not a judgement', () => {
        const range = evidenceClauseRange(source)

        // The whole clause turns on the root cause NAMING the cited artifact.
        // Drop that and "irrelevant" becomes the scorer's opinion again.
        expect(range).toContain('names the artifact cited')
    })

    it('clause 4 gives the audit trail authority over the validator', () => {
        const range = evidenceClauseRange(source)

        expect(range).toContain('audit trail')
        expect(range).toContain('trail decides, the validator does not')
    })

    it('clause 5 requires co-location, with an explicit-reference escape', () => {
        const range = evidenceClauseRange(source)

        // Co-location without the escape would score 0 a report that cites its
        // own failure summary by name, which is a reference and not a gap.
        expect(range).toContain('co-located')
        expect(range).toContain('refers to')
    })

    it('§A1 says the column is not a gate term', () => {
        // A scorer who reads §A2.1 first will carry "this changes the verdict"
        // across to a column where it is false. Say so where it is false.
        expect(evidenceClauseRange(source)).toContain('not a gate term')
    })

    it('the evidence_cites_trace_and_config row points a scorer at §A1', () => {
        const row = source
            .split('\n')
            .find((l) => l.startsWith('| `evidence_cites_trace_and_config`'))

        expect(row).toBeDefined()
        expect(row).toContain('§A1')
    })
})
