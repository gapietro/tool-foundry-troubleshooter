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

/**
 * Collapse runs of whitespace to single spaces.
 *
 * The template is hard-wrapped prose, so a phrase this file pins can sit
 * across a line break -- and which break depends on where the paragraph was
 * last re-wrapped. Without this, a pure copy-edit reddens the suite and the
 * next reader learns to shorten the assertion until it passes, which is how a
 * guard becomes vacuous. Bold/code markers are dropped for the same reason:
 * whether a word is bolded is not what these tests are about.
 *
 * UNDERSCORES ARE KEPT. They are markdown emphasis too, but they are also in
 * every tool name this file pins -- `log_analysis`, `schema_lookup` -- and
 * stripping them would quietly turn those assertions into matches against
 * `loganalysis`, which the template never contains.
 */
function flat(text) {
    return text.replace(/[*`]/g, '').replace(/\s+/g, ' ')
}

/** A named slice of the template, with both bounds proven to exist. */
function between(text, startHeading, endHeading) {
    const start = text.indexOf(startHeading)
    const end = text.indexOf(endHeading)

    // indexOf returns -1 on a miss and slice(-1, -1) is the empty string,
    // which passes every `toContain` below vacuously. Assert both bounds.
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)

    return flat(text.slice(start, end))
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
        //
        // Both strings are DISTINCTIVE on purpose. An earlier cut asserted the
        // bare word 'describes', which any future paragraph in this window
        // would satisfy -- the clause could then be deleted and the guard stay
        // green, which is the failure mode this file exists to prevent.
        const range = packetReachingRange(source)

        expect(range).toContain('produces the change the fix describes')
        expect(range).toContain('exactly as given')
    })

    it('§A2.1 says how its cases combine, and that they are not a cascade', () => {
        // Without this, Case 2 (address resolves, fields named -> 1) and Case 3
        // (snippet does not perform the change -> 0) give opposite verdicts on
        // the same fix, and the scorer picks by reading order. That is the
        // under-determination on a gate term the whole section removes.
        const range = packetReachingRange(source)

        expect(range).toContain('necessary conditions')
        expect(range).toContain('the first case that fails')
    })

    it('clause 5 scores the fix aimed at the seeded defect, not the union', () => {
        // A multi-part fix report otherwise scores either as its best part or
        // its worst, and nothing said which.
        const range = packetReachingRange(source)

        expect(range).toContain('addresses the defect the seed carries')
        expect(range).toContain('neither credited nor charged')
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

    it('clause 2 selects the subject without awarding the point', () => {
        // "Score 1 if that entry carries both citations" read alone lets a
        // scorer stop at case 2 -- before case 3 is reached to disqualify a
        // citation the primary carries but does not connect to.
        expect(evidenceClauseRange(source)).toContain('it does not award the point')
    })

    it('clause 2 skips a primary entry that asserts no defect exists', () => {
        // Case 1 fires on a report with no root causes. A report whose FIRST
        // root cause is itself a non-diagnosis passes case 1 and would then be
        // scored against the non-diagnosis.
        expect(evidenceClauseRange(source)).toContain('asserts no defect exists')
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

    it('clause 4 enumerates the two tool families instead of leaving them judged', () => {
        // "the corresponding tool family" is a judgement call unless the
        // membership is written down -- one config claim is reachable through
        // four of the six tools, and asking which one it "really" came from
        // reintroduces exactly what the preamble disclaims.
        const range = evidenceClauseRange(source)

        expect(range).toContain('enumerated rather than judged')
        expect(range).toContain('and by nothing else')
        // The trace family has one member; the config/schema family has six.
        // Naming two of the six catches a rewrite that drops the list.
        expect(range).toContain('schema_lookup')
        expect(range).toContain('read_artifact')
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

describe('the root_cause_layer_correct clauses exist (issue #164)', () => {
    it('§A2.2 exists and sits inside the range copied into a packet', () => {
        expect(source).toContain('### A2.2')
        expect(packetReachingRange(source)).toContain('### A2.2')
    })

    it('clause 1 scores the DECLARED layer, and says so about the substance too', () => {
        // The whole clause is the choice between the label and the finding
        // text. Pinning only "declared value" would stay green on a rewrite
        // that awarded 2 for correct substance under a wrong label, which is
        // the reading this section exists to refuse.
        const range = packetReachingRange(source)

        expect(range).toContain('score the declared value')
        expect(range).toContain('Do not score the substance of the finding text')
    })

    it('clause 1 rules on a compound declared layer', () => {
        // Compound layers are the NATIVE report format's norm, not an edge
        // case: row 01 declares `3 (tool script) + 4 (schema)` and row 03
        // declares `3 (Tool definition) + 4 (Data schema) + 5 (Data)`. Without
        // this rule eight published full-credit rows have no decidable value,
        // which is a larger hole than the four flags this section was filed to
        // close.
        const range = packetReachingRange(source)

        expect(range).toContain('A declared layer naming more than one layer')
        expect(range).toContain('conjunct that names the expected layer')
        // The reason the compound is treated differently from a LIST, which is
        // what stops this reading from reopening case 2.
        expect(range).toContain('the cheapness is in the list, not in the compound')
    })

    it('clause 1 gives the no-declared-layer fallback without inventing a layer map', () => {
        // The scorer packet carries the seed spec and the rubric -- it does
        // NOT carry a layer-to-artifact map. A fallback that asked which layer
        // an unlabelled artifact belongs to would be unanswerable from the
        // packet, which is the defect, not a stricter rule.
        const range = packetReachingRange(source)

        expect(range).toContain('name or the number the seed spec prints')
        expect(range).toContain('no layer-to-artifact map')
        // The fallback must be scoped to the SELECTED ENTRY, not the report.
        // Scoped to the report ("declares no layer anywhere"), a report whose
        // primary is unlabelled prose and whose secondaries carry Layer rows
        // falls through both branches -- and the nearest reading pulls a
        // secondary's label in, which is the scan-the-list reading case 2 bans.
        expect(range).toContain('Where the entry selected under Case 2 declares no layer')
        expect(range).toContain('is read on the primary alone')
    })

    it('clause 2 evaluates the primary only, and refuses the scan-the-list reading', () => {
        // Without the second half, "evaluate the primary" and "the expected
        // layer appears in the list" are both defensible and a shotgunned
        // seven-layer enumeration scores 2 on every seed.
        const range = packetReachingRange(source)

        expect(range).toContain('Do not scan the list')
        expect(range).toContain('measure list length rather than diagnosis')
    })

    it('clause 2 reuses §A1 case 2 rather than restating a second primary rule', () => {
        // Two independently-worded primary rules drift apart on the first
        // copy-edit and then disagree on the same report.
        const range = packetReachingRange(source)

        expect(range).toContain('same rule §A1 Case 2 uses')
        expect(range).toContain('asserts no defect exists')
    })

    it('clause 2 keeps layers_swept and the validator OUT of this column', () => {
        // Both are scored elsewhere -- §E and §A1 case 4. Importing either
        // charges the same defect twice and re-opens the column.
        const range = packetReachingRange(source)

        expect(range).toContain('NOT_SWEPT')
        expect(range).toContain('validator')
        expect(range).toContain('score the same defect twice')
    })

    it('§A2.2 states that this column IS a gate term', () => {
        // §A1 says its column is not one. The contrast is the reason §A2.2
        // lives under §A2 at all, and a scorer needs it stated on both.
        expect(packetReachingRange(source)).toContain("§A2's other gate term")
    })

    it('the root_cause_layer_correct row points a scorer at §A2.2', () => {
        const row = source.split('\n').find((l) => l.startsWith('| `root_cause_layer_correct`'))

        expect(row).toBeDefined()
        expect(row).toContain('§A2.2')
    })
})

describe('the fix_target_correct clauses exist (issue #164)', () => {
    it('§A2.3 exists and sits inside the range copied into a packet', () => {
        expect(source).toContain('### A2.3')
        expect(packetReachingRange(source)).toContain('### A2.3')
    })

    it('clause 1 scores the DECLARED target, not prose elsewhere in the fix', () => {
        const range = packetReachingRange(source)

        expect(range).toContain('score the declared value')
        expect(range).toContain('rewards breadth over aim')
    })

    it('clause 2 fixes all three bands, and sources the 2 band OFF the header row', () => {
        // The superseded note located neither boundary. Each band must be
        // pinned, or a rewrite can drop one and stay green.
        //
        // The second half is the sharper guard. Four of the five seed specs
        // print only an AREA in their `Expected fix target` row -- "activation",
        // "data seeding" -- so a 2 band defined against that row alone is
        // unreachable on those four, and every full-credit fix silently
        // becomes a partial. The specific target lives in the seed's
        // `Expected diagnosis` section, and the clause must send the scorer
        // to both places.
        const range = packetReachingRange(source)

        expect(range).toContain('Expected fix target')
        expect(range).toContain('same one of §A\'s five areas')
        expect(range).toContain('does not name the specific target')
        expect(range).toContain('two different places in the document')
        expect(range).toContain('Expected diagnosis section names')
    })

    it('clause 2 scores 0 for a reading the seed spec explicitly excludes', () => {
        // Seed 01's expected-target row rules out "the tool input schema" in
        // as many words, and that reading sits INSIDE the expected area -- so
        // the area test alone would award it 1 and inert the decoy.
        const range = packetReachingRange(source)

        expect(range).toContain('explicitly excludes')
        expect(range).toContain('naming a miss')
    })

    it('clause 2 releases the partial band from the notes-justification rule', () => {
        // §A's superseded note made `notes` the authorisation. Leaving that
        // live alongside this clause gives two answers to the same question.
        const range = packetReachingRange(source)

        expect(range).toContain('available on every seed')
        expect(range).toContain('no notes justification')
    })

    it('the §A partial-band note is marked superseded rather than left contradicting §A2.3', () => {
        // The note sits ABOVE §A1 in the file, outside every window helper
        // here, so it is asserted against the whole source.
        //
        // The superseded sentence is QUOTED in the replacement -- a reader who
        // only sees the new rule cannot tell what changed -- so a bare
        // not.toContain would be false by construction. What must hold is that
        // it survives exactly once and only as a quotation: a second live
        // occurrence would give the scorer two answers on who authorises the
        // 1 band.
        const flattened = flat(source)
        const stale = 'must be justified in notes if used'

        expect(flattened).toContain('Superseded 2026-08-10, issue #164')
        expect(flattened).toContain('This note used to continue')
        expect(flattened.split(stale).length - 1).toBe(1)
    })

    it('the multi-fix rule caps enumeration at the 1 band without capping the 2 band', () => {
        // Both halves are load-bearing and they pull opposite ways.
        //
        // Highest-value-wins alone lets a report list one area-only fix per
        // area and collect the partial band on every seed. Primary-fix-only
        // -- the rule §A2.2 case 2 uses -- would score row 07 a 0, though its
        // FIX-2 names `sn_aia_agent[...].instructions`, the seed's expected
        // target at full specificity, because its FIX-1 is listed first. The
        // rule has to split: cheap band restricted, expensive band open.
        const range = packetReachingRange(source)

        expect(range).toContain('highest value any single non-hedged proposed fix earns')
        expect(range).toContain('the 1 band is available only from the report\'s primary fix')
        expect(range).toContain('cannot lift it to')
    })

    it('§A2.3 states WHY it does not use §A2.2 case 2\'s primary-only rule', () => {
        // An undocumented asymmetry between two adjacent clause sets reads as
        // an oversight and invites a future editor to "fix" it by making them
        // match, which would silently re-score every multi-fix report.
        const range = packetReachingRange(source)

        expect(range).toContain('Naming a layer is free')
        expect(range).toContain('Naming the specific target is not free')
    })

    it('§A2.3 disclaims redirecting §A2.1 case 5, which selects its own subject', () => {
        // The first cut claimed this column designated case 5's subject. Case
        // 5 already picks its own by a different test, and where several
        // fixes address the seeded defect it requires ALL of them to pass --
        // so the claim contradicted an unamended clause on a gate term.
        const range = packetReachingRange(source)

        expect(range).toContain('does not redirect §A2.1 Case 5')
        expect(range).toContain('relates their')
    })

    it('clause 1 rules on a compound declared target', () => {
        // Row 05's declared value is literally `Tool definition + wiring`, so
        // the shape the clause was written against is itself compound.
        const range = packetReachingRange(source)

        expect(range).toContain('A declared target naming more than one area')
        expect(range).toContain('conjunct that names the seed\'s expected area')
    })

    it('the residual note does NOT claim the enumeration case cannot earn 2', () => {
        // It can: five specific fixes, one per area, name the seeded target on
        // any seed. An earlier cut asserted the opposite and bounded the
        // exposure at 1, which is a false reassurance in the one place the
        // section is supposed to be honest about what it leaves open.
        const range = packetReachingRange(source)

        expect(range).toContain('earns 2 on any seed')
        expect(range).not.toContain('It cannot earn 2')
    })

    it('the fix_target_correct row points a scorer at §A2.3', () => {
        const row = source.split('\n').find((l) => l.startsWith('| `fix_target_correct`'))

        expect(row).toBeDefined()
        expect(row).toContain('§A2.3')
    })
})
