# Rubric Channel Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Machine-scan the rubric channel (`benchmark/scorecard-template.md` §A→§B, the slice copied into every scorer packet) for blind-rule violations, and close the two coverage residues the #142 review left in the path rule and the README roster.

**Architecture:** A third channel-scoped pattern list, `RUBRIC_PATTERNS`, is added to `test/scorerPacketBlindRule.test.js` alongside the existing `PATTERNS` (seed specs) and `PACKET_PATTERNS` (packets). The rubric range is derived from its `## A.` / `## B.` headings at scan time and scanned with `RUBRIC_PATTERNS` **plus** `PACKET_PATTERNS`, using the existing shared `scanWith` matcher extended with an index offset so reported line numbers stay file-absolute. The four repository paths currently inside the range are reworded out at source, using the replacements the packet builder already applies at build time.

**Tech Stack:** Node.js, Jest 29.7.0, CommonJS. No new dependencies. Pure text processing — no ServiceNow instance access, no `now-sdk build`, no runs fired.

## Global Constraints

- **Branch:** `fix/143-rubric-channel-scan`, already created. Never commit to `main` (CLAUDE.md).
- **Test command:** `npx jest test/scorerPacketBlindRule.test.js` for the focused file; `npm test` for the full suite.
- **Suite baseline at branch point:** 1374 passed, 28 suites. The count only goes up.
- **No stop-lists, no generic-word exemptions inside a pattern list.** A pattern that reddens on legitimate prose is fixed by writing a better pattern (`test/scorerPacketBlindRule.test.js` doctrine, lines 32–35). Separate lists per channel are the sanctioned shape; carve-outs inside a list are not.
- **`benchmark/DECISION.md` §A through §Z are append-only.** Do not modify any existing section. New material goes in a new `## AA.` section.
- **Do not edit `benchmark/scoring-v4/` or `benchmark/scoring-v9/`.** They are the record of what scorers actually read.
- **Do not modify `test/rubricClauses.test.js`.** It independently pins §A2.1's two clauses and their placement inside §A2.
- **`test/rubricClauses.test.js:9-13` legitimately carries "6/6", "0/6" and "nine of twelve rows flagged ambiguous" in a block comment.** A test file is not a scorer channel. Do not "fix" it.
- **Version bump on merge:** `2026.08.0709` → `2026.08.0801` in `package.json` and the `README.md` badge.
- **Commit trailer:** every commit ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `test/scorerPacketBlindRule.test.js` | All three prose channels' blind-rule guards | Modify — widen path rule, add `indexOffset` to `scanWith`, add `RUBRIC_PATTERNS` + range derivation + rubric scan, rewrite the "WHAT THIS GUARD DOES NOT COVER" header |
| `benchmark/scorecard-template.md` | The rubric; §A/§A2/§A3 are copied into every packet | Modify — four path references reworded out of the §A→§B range |
| `benchmark/README.md` | Benchmark protocol and the guard roster | Modify — roster table at :113 and the stale paragraph at :115 |
| `benchmark/DECISION.md` | Append-only decision record | Modify — append `## AA.` |
| `docs/superpowers/specs/2026-08-07-t9-pass-blockers-design.md` | Predecessor spec | Modify — append dated forward note |
| `CHANGELOG.md` | Version history | Modify — new entry + forward note on the 0708 entry |
| `package.json`, `README.md` | Version | Modify — bump |

Everything testable lives in one test file because all three channels share one matcher and one doctrine; splitting them would duplicate `scanWith` and let the channels' correctness details drift apart, which the file's own comment at lines 202–214 warns against.

---

## Task 1: Widen the path rule to catch stem-terminated references

Closes #144 item 1. Independent of every other task — the widened rule must leave the twelve v9 packets at 0 hits before anything else is built on it.

**Files:**
- Modify: `test/scorerPacketBlindRule.test.js:170-200` (the `PACKET_PATTERNS` declaration)
- Test: `test/scorerPacketBlindRule.test.js` (the `the packet scanner itself works (controls)` describe block, lines 357–435)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `PATH_STEMS` — a `String` of regex alternatives (no anchors, no delimiters), used twice inside `PACKET_PATTERNS`' single `repository-path` regex. Task 3 consumes `PACKET_PATTERNS` as a whole, not `PATH_STEMS`.

- [ ] **Step 1: Write the failing controls**

Add these four tests to the existing `describe('the packet scanner itself works (controls)', …)` block in `test/scorerPacketBlindRule.test.js`, immediately after the existing `POSITIVE: another scorer grade file and an unlisted root doc both fire` test (currently ending at line 418):

```js
    it('POSITIVE: a reference that stops at a directory stem fires (#144)', () => {
        // "the packets are in scoring-v9/" was a walkable route the first
        // shipped version of this rule missed: its path alternation required
        // at least one character after the slash, so a reference that stops
        // at the stem escaped. Measured on the pre-#144 regex: no hit.
        const { text, lineStarts } = normalizeProse('the packets are in scoring-v9/ and results/')

        expect(scanPackets(text, lineStarts).map((h) => h.text).sort()).toEqual([
            'results/',
            'scoring-v9/',
        ])
    })

    it('POSITIVE: a relative reference with no trailing slash fires (#144)', () => {
        // ../results is the same route written from inside a sibling
        // directory. It has no trailing slash for the first alternation to
        // anchor on, which is why the rule needs a prefix-form alternation.
        const { text, lineStarts } = normalizeProse('grades live in ../results')

        expect(scanPackets(text, lineStarts).map((h) => h.text)).toEqual(['../results'])
    })

    it('POSITIVE: the .superpowers workspace stem fires (#144)', () => {
        // Review artefacts live here. It was absent from the stem list.
        const { text, lineStarts } = normalizeProse('see .superpowers/sdd/v9-pass/ for the review')

        expect(scanPackets(text, lineStarts).map((h) => h.text)).toEqual(['.superpowers/sdd/v9-pass/'])
    })

    it('NEGATIVE: a bare stem WORD with no slash does not fire (#144)', () => {
        // The widening must not turn every occurrence of "results" or "test"
        // in ordinary prose into a hit. The slash is what makes it a route.
        const { text, lineStarts } = normalizeProse('the results were mixed and test results matter')

        expect(scanPackets(text, lineStarts)).toEqual([])
    })
```

- [ ] **Step 2: Run the tests to verify three of the four fail**

Run: `npx jest test/scorerPacketBlindRule.test.js -t '#144'`

Expected: 4 tests run, **3 fail, 1 passes**. The three POSITIVE tests fail with `Expected: [...] Received: []` (or a partial match). The NEGATIVE test passes already — it is a regression pin for the widening, not a driver of it.

- [ ] **Step 3: Replace the `PACKET_PATTERNS` declaration**

In `test/scorerPacketBlindRule.test.js`, replace the whole `const PACKET_PATTERNS = [ … ]` block (lines 170–200, from `const PACKET_PATTERNS = [` through the closing `]`) with:

```js
/**
 * The directory stems this repository actually uses, as regex alternatives.
 * Named because the rule below interpolates them twice -- once for the
 * "stem/..." form and once for the "../stem" form -- and two copies of a
 * fifteen-item list is two places to forget an entry.
 */
const PATH_STEMS =
    'benchmark|docs|src|test|seed-app|node_modules|dist|\\.claude|\\.superpowers|' +
    'seeds|history|results|scoring-v[0-9]+|' +
    'scorecard-[A-Za-z0-9_-]+|raw-evidence-[A-Za-z0-9_-]+'

const PACKET_PATTERNS = [
    {
        name: 'repository-path',
        // Three alternations, each closing a route measured to be walkable:
        //   1. a stem followed by a slash and ZERO OR MORE path characters.
        //      The "zero or more" is #144: the first shipped version required
        //      one or more, so "the packets are in scoring-v9/" -- a complete
        //      route -- did not match. Measured on that version: scoring-v9/,
        //      results/ and ../results all returned NO HIT.
        //   2. a ./ or ../ prefix followed by a bare stem with no trailing
        //      slash. Alternation 1 cannot reach this because there is no
        //      slash after the stem to anchor on.
        //   3. ANY bare markdown filename. This started as an eight-name
        //      root-level list and was widened in the #139 review: a
        //      whitelist of eight names missed scorecard-v9.md (the literal
        //      per-row answer key), raw-evidence-v9-scored-pass.md and
        //      agent-doctor-instructions.md, and both leaks §T7 found by hand
        //      escape it if written one directory segment shorter.
        //
        // A bare stem WORD with no slash deliberately does NOT match --
        // "the results were mixed" is prose, not a route -- which is the
        // boundary the #144 negative control pins.
        //
        // Residue, stated rather than left to be re-derived: a NON-markdown
        // file outside these stems (a top-level package.json, say) is still
        // not matched. The answer keys in this project are all markdown and
        // the stem list covers every route to them found so far.
        //
        // Measured after this widening: the twelve committed v9 packets scan
        // 0, unchanged from before it, so nothing here was tightened back for
        // a false positive.
        re: new RegExp(
            '(?:(?:\\.{0,2}\\/)*(?:' + PATH_STEMS + ')\\/[A-Za-z0-9_./-]*)' +
                '|(?:(?:\\.{1,2}\\/)+(?:' + PATH_STEMS + ')\\b)' +
                '|\\b[A-Za-z0-9_-]+\\.md\\b'
        ),
        why:
            'a repository path a MODEL scorer can follow out of the packet and into this ' +
            'project prior conclusions. A pointer to the answer is the same defect as the ' +
            'answer, and the shortest routes found in v9 were one hop, not two.',
    },
]
```

Keep the existing block comment above `const PACKET_PATTERNS` (lines 161–169, beginning `The packet channel's pattern list, kept SEPARATE from PATTERNS above`) exactly as it is — move it so it still sits directly above `const PACKET_PATTERNS`, after the new `PATH_STEMS` declaration.

- [ ] **Step 4: Run the new controls to verify they pass**

Run: `npx jest test/scorerPacketBlindRule.test.js -t '#144'`

Expected: 4 passed.

- [ ] **Step 5: Run the whole file to verify the v9 packets still scan 0**

Run: `npx jest test/scorerPacketBlindRule.test.js`

Expected: all pass, including the twelve `scoring-v9/row-NN-… states no repository path` tests and the seven pre-existing packet controls. **If any v9 packet now reports a hit, stop and report it** — that would be a false positive forced by the widening and the regex needs revisiting, not the packet.

- [ ] **Step 6: Run the full suite**

Run: `npm test`

Expected: 28 suites, 1378 passed (1374 + the 4 new tests).

- [ ] **Step 7: Commit**

```bash
git add test/scorerPacketBlindRule.test.js
git commit -m "$(cat <<'EOF'
fix(#144): the path rule catches a reference that stops at a stem

The first alternation required at least one character after the slash, so
"the packets are in scoring-v9/" -- a complete route to twelve answer keys --
did not match. Measured on the shipped regex: scoring-v9/, results/,
../results and .superpowers/sdd/v9-pass/ all returned no hit; only
seeds/history/ fired, and only because it has two segments.

Three alternations now: stem-plus-slash with zero or more trailing characters,
a ./ or ../ prefix with a bare stem, and any bare markdown filename. A bare
stem WORD with no slash still misses -- "the results were mixed" is prose, not
a route -- pinned as a negative control so a later widening cannot take it.
.superpowers joins the stem list.

The twelve v9 packets scan 0 before and after, so no false positive forced a
tightening.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Derive the rubric range and make it path-clean at source

Adds the range derivation the rubric scan needs, and applies the packet builder's own A1–A4 replacements permanently. The packet **text** does not change — only its source does.

**Files:**
- Modify: `test/scorerPacketBlindRule.test.js` (add range helpers + a new describe block at end of file)
- Modify: `benchmark/scorecard-template.md:16`, `:22`, `:31`, `:153`
- Test: `test/scorerPacketBlindRule.test.js`

**Interfaces:**
- Consumes: `PACKET_PATTERNS` (Task 1), and the existing `scanWith(patterns, text, lineStarts)`, `normalizeProse(source) -> {text, lineStarts}`, `lineAt(lineStarts, offset) -> Number` from `test/_normalizeProse.js`.
- Produces:
  - `TEMPLATE` — absolute path `String` to `benchmark/scorecard-template.md`.
  - `rubricRange()` → `{ text, lineStarts, start, end }` where `text`/`lineStarts` are the **whole normalized file** and `start`/`end` are character offsets into `text` bounding the packet-reaching slice. Task 3 consumes all four.
  - `scanWith(patterns, text, lineStarts, indexOffset)` — a fourth optional parameter, defaulting to `0`. Task 3 relies on it.

- [ ] **Step 1: Add the `indexOffset` parameter to `scanWith`**

In `test/scorerPacketBlindRule.test.js`, replace the `function scanWith(patterns, text, lineStarts) {` signature and its `hits.push` line (currently lines 215 and 222) so the function reads:

```js
function scanWith(patterns, text, lineStarts, indexOffset) {
    // Offset for callers that scan a SLICE of a normalized document (the
    // rubric channel does). Match indices are relative to the slice; line
    // numbers must stay relative to the file, or a failure points at a line
    // that does not exist in the source the reader opens.
    const offset = indexOffset || 0
    const hits = []

    patterns.forEach((p) => {
        const re = new RegExp(p.re.source, p.re.flags.replace('g', '') + 'g')
        let m
        while ((m = re.exec(text)) !== null) {
            hits.push({
                pattern: p.name,
                why: p.why,
                line: lineAt(lineStarts, m.index + offset),
                text: m[0],
            })
            if (m.index === re.lastIndex) re.lastIndex++
        }
    })

    return hits
}
```

Existing callers `scanProse` and `scanPackets` pass three arguments and are unaffected — `indexOffset` is `undefined`, so `offset` is `0`.

- [ ] **Step 2: Add the range derivation helpers**

Add immediately after the `scanPackets` function (currently line 238):

```js
// ---------------------------------------------------------------------------
// THE RUBRIC CHANNEL (issue #143)
// ---------------------------------------------------------------------------
const TEMPLATE = path.join(SCORING, 'scorecard-template.md')

/**
 * The packet-reaching slice of the rubric, as offsets into the WHOLE
 * normalized template.
 *
 * Only §A/§A2/§A3 are copied into a scorer packet, so the scanned range runs
 * from the `## A.` heading to the `## B.` heading. Derived from the headings
 * at scan time and never hardcoded to line numbers, which move.
 *
 * This pins the template's heading structure into a test, which is the
 * objection this file previously recorded against scanning the channel at
 * all. It is the right trade rather than a cost: the PACKET BUILD depends on
 * the same two headings, so a rename that breaks this scan is a rename that
 * changes what ships to twelve scorers. Failing loudly is the correct
 * response.
 *
 * Returns the whole file's text and line map alongside the offsets, because
 * line numbers reported by a scan of the slice must still name lines in the
 * file.
 */
function rubricRange() {
    const { text, lineStarts } = normalizeProse(fs.readFileSync(TEMPLATE, 'utf8'))

    return {
        text: text,
        lineStarts: lineStarts,
        start: text.indexOf('## A. '),
        end: text.indexOf('## B. '),
    }
}
```

- [ ] **Step 3: Write the failing test — the rubric range states no repository path**

Add at the very end of `test/scorerPacketBlindRule.test.js`:

```js
describe('the rubric channel reaches every packet and is scanned (issue #143)', () => {
    it('derives the packet-reaching range from its own headings', () => {
        const { text, start, end } = rubricRange()

        expect(start).toBeGreaterThan(-1)
        expect(end).toBeGreaterThan(start)

        // §A2.1 must fall inside the range. test/rubricClauses.test.js pins
        // the same placement for a different reason -- that a clause outside
        // §A/§A2/§A3 is a clause the scorers never see. Two tests, one
        // invariant, independent derivations.
        const slice = text.slice(start, end)
        expect(slice).toContain('### A2.1')
    })

    it('states no repository path -- the range ships to twelve scorers', () => {
        // The four paths this range used to carry were removed by hand at
        // PACKET BUILD time (scoring-v9/packet-build-report.md §7.2, four
        // substitutions each asserted to match exactly once). That assertion
        // is real, but it lives in the builder rather than in the suite, and
        // it is path-only -- it did not see the #139 prose leak at all.
        // Reworded at source so the builder no longer has to.
        const { text, lineStarts, start, end } = rubricRange()
        const hits = scanWith(PACKET_PATTERNS, text.slice(start, end), lineStarts, start)

        expect(
            hits.map(
                (h) => 'scorecard-template.md:' + h.line + '  [' + h.pattern + ']  ' + h.text
            )
        ).toEqual([])
    })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx jest test/scorerPacketBlindRule.test.js -t 'rubric channel'`

Expected: 2 tests, **1 fails**. `derives the packet-reaching range` passes. `states no repository path` fails listing 4 hits:

```
"scorecard-template.md:16  [repository-path]  docs/agent/agent-doctor-instructions.md",
"scorecard-template.md:22  [repository-path]  seeds/seed-05-inactive-usecase.md",
"scorecard-template.md:31  [repository-path]  docs/IMPLEMENTATION_PLAN.md",
"scorecard-template.md:153  [repository-path]  IMPLEMENTATION_PLAN.md",
```

Exact line numbers may differ by one or two; **four hits with those four texts** is the thing to confirm.

- [ ] **Step 5: Apply the four rewords to the template**

These are not new wording — they are the replacements `benchmark/scoring-v9/packet-build-report.md` §7.2 records as **already shipping** to the v9 scorers.

In `benchmark/scorecard-template.md`, make exactly these four edits.

**A1** — line 16, inside the `evidence_cites_trace_and_config` table row:

```
the evidence rule from `docs/agent/agent-doctor-instructions.md` |
```
becomes
```
the evidence rule from the diagnostic agent's own instructions |
```

**A2** — lines 21–23, in the "Why `fix_target_correct` has a partial band" paragraph:

```
**Why `fix_target_correct` has a partial band.** It was 0-or-2, while
`seeds/seed-05-inactive-usecase.md` instructs the scorer to award *partial*
credit for naming "inactive" without naming which of the two activation gates is
```
becomes
```
**Why `fix_target_correct` has a partial band.** It was 0-or-2, while seed 5's
specification instructs the scorer to award *partial*
credit for naming "inactive" without naming which of the two activation gates is
```

**A3** — lines 31–32, opening §A2:

```
The rubric scores each run **out of 6**. The gate in `docs/IMPLEMENTATION_PLAN.md`
Task 12 counts **runs**: *"≥ 8/10 runs with correct root cause + usable fixes."*
```
becomes
```
The rubric scores each run **out of 6**. The gate counts **runs**:
*"≥ 8/10 runs with correct root cause + usable fixes."*
```

Dropping "Task 12" from this clause loses no meaning — §7.2 records the reasoning, and the label survives twice later in the same section (at the `**The gate verdict**` paragraph and in the band table).

**A4** — lines 152–153, inside §A3's numbered item 3:

```
   `IMPLEMENTATION_PLAN.md` Task 12 bands are `≥ 8/10`, `5–7/10` and `< 5/10`,
```
becomes
```
   Task 12 bands are `≥ 8/10`, `5–7/10` and `< 5/10`,
```

Check the preceding line still reads correctly after the edit — it currently ends `The` and wraps onto this line.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest test/scorerPacketBlindRule.test.js -t 'rubric channel'`

Expected: 2 passed.

- [ ] **Step 7: Verify `rubricClauses.test.js` is unharmed**

Run: `npx jest test/rubricClauses.test.js`

Expected: all pass. None of the four rewords touch §A2.1's two clauses or their placement. **If this fails, a reword strayed outside its four target lines — revert and redo that edit.**

- [ ] **Step 8: Run the full suite**

Run: `npm test`

Expected: 28 suites, 1380 passed.

- [ ] **Step 9: Commit**

```bash
git add test/scorerPacketBlindRule.test.js benchmark/scorecard-template.md
git commit -m "$(cat <<'EOF'
fix(#143): the rubric range is path-clean at source, and scanned for paths

§A/§A2/§A3 are copied into EVERY scorer packet, and the range carried four
repository paths -- two of them one hop from an answer key. They were removed
by hand at packet-build time (scoring-v9/packet-build-report.md §7.2, four
substitutions each asserted to match exactly once), so the shipped text was
clean, but the only protection lived in the builder.

Applies §7.2's own A1-A4 replacements permanently. The packet TEXT is
unchanged -- this is the wording the v9 scorers already read -- but the source
is now clean, so a future editor who adds a path to §A fails the suite instead
of depending on the builder noticing, and deviation set A disappears from the
next packet build entirely.

The range is derived from its `## A.` / `## B.` headings rather than hardcoded.
That pins the template's heading structure into a test, deliberately: the
packet build depends on the same two headings, so a rename that breaks this
scan is a rename that changes what ships to twelve scorers. scanWith gains an
index offset so a hit in the slice still reports its line in the file.

rubricClauses.test.js is untouched and still pins §A2.1's clauses and their
placement.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Scan the rubric range for a prior pass's outcome

The core of #143. Adds `RUBRIC_PATTERNS` and the outcome scan on the range Task 2 established.

**Files:**
- Modify: `test/scorerPacketBlindRule.test.js` (add `RUBRIC_PATTERNS`, `RUBRIC_SCAN`, `scanRubric`; extend the `#143` describe block)
- Test: `test/scorerPacketBlindRule.test.js`

**Interfaces:**
- Consumes: `PATTERNS`, `PACKET_PATTERNS` (Task 1), `rubricRange()`, `scanWith(patterns, text, lineStarts, indexOffset)` (Task 2), `normalizeProse` from `test/_normalizeProse.js`.
- Produces: `scanRubric(text, lineStarts, start, end)` → `Array` of `{pattern, why, line, text}`. Terminal — no later task consumes it.

- [ ] **Step 1: Write the failing controls**

Add to the `describe('the rubric channel reaches every packet and is scanned (issue #143)', …)` block created in Task 2, after the two existing tests:

```js
    it('POSITIVE: the paragraph that actually leaked is caught, four ways', () => {
        // Verbatim from 253de7f, the §A2.1 preamble removed by the #142 final
        // review. It shipped nowhere -- it was caught by a reviewer reading a
        // diff -- but it was in the file, and benchmark/README.md lists this
        // range as reaching every packet.
        //
        // Pinned by DISTINCT PATTERN NAME, not by hit count: if a later edit
        // leaves only one pattern matching, this must fail rather than stay
        // green on a single point of failure.
        const { text, lineStarts } = normalizeProse(
            "*Added 2026-08-07, issue #139.* §O5 filed this gap and nothing closed it; §T5\n" +
                'measured the cost three passes later — **nine of twelve rows flagged\n' +
                '`ambiguous`**, against a prediction of at most two, and the flag landed on this\n' +
                "column. Because `fix_usable_unedited` is one of §A2's two gate terms, an\n" +
                'under-determined reading of it moved a whole arm between 6/6 and 0/6.'
        )
        const hits = scanRubric(text, lineStarts, 0, text.length)

        expect(hits.map((h) => h.pattern).filter((n, i, a) => a.indexOf(n) === i).sort()).toEqual([
            'counted-rows',
            'outside-section-pointer',
            'prior-pass-reference',
            'verdict-moved',
        ])
        expect(hits.map((h) => h.text).sort()).toEqual([
            'moved a whole arm',
            'nine of twelve rows',
            'passes later',
            '§O5',
            '§T5',
        ])
    })

    it('NEGATIVE: the rubric self-references do not fire', () => {
        // Every § in the whole range points at §A, §A2 or §A2.1. That is what
        // makes outside-section-pointer viable at all -- a pointer anywhere
        // else is a pointer out of the packet, into a document the scorer does
        // not have. §B is correctly rejected too: a packet ends at §A3.
        const { text, lineStarts } = normalizeProse(
            "see §A2.1 for the two cases, §A2's gate expression and §A's constraint"
        )

        expect(scanRubric(text, lineStarts, 0, text.length)).toEqual([])
    })

    it('NEGATIVE: the Task 12 band guidance does not fire', () => {
        // This is why rubric-fraction is not in this channel's list. The
        // fractions here are the gate bands and §A2's hypothetical guidance,
        // which the blind rule explicitly permits -- it forbids what a prior
        // run was AWARDED, not the vocabulary of grading.
        const { text, lineStarts } = normalizeProse(
            'A run can score 3/6 and pass; a run can score 4/6 and fail. The bands are ' +
                '`≥ 8/10`, `5–7/10` and `< 5/10`.'
        )

        expect(scanRubric(text, lineStarts, 0, text.length)).toEqual([])
    })

    it('NEGATIVE: two near-misses on legitimate guidance stay clean', () => {
        // Both sit ONE WORD from firing, and both are guidance a scorer needs.
        // Pinned so a future widening that would take them fails here instead
        // of quietly redacting the rubric.
        //   - credit-awarded requires "awarded"; the rubric says "to award".
        //   - counted-rows stops its noun list at runs|rows|passes; the rubric
        //     says "two of the four rubric COLUMNS".
        const { text, lineStarts } = normalizeProse(
            'instructs the scorer to award *partial* credit for naming "inactive", and ' +
                'names exactly two of the four rubric columns.'
        )

        expect(scanRubric(text, lineStarts, 0, text.length)).toEqual([])
    })

    it('scans ONLY the packet-reaching range, and reports file-absolute lines', () => {
        // Two properties in one control, because they fail the same way -- a
        // scan that silently reads the wrong span reports plausible line
        // numbers for text no scorer ever sees.
        const synthetic = [
            '# Scorecard template', // 1
            '', // 2
            'Copy this file per §T5, the prior reading.', // 3  <- OUTSIDE the range
            '', // 4
            '## A. The 6-point rubric', // 5
            '', // 6
            'see §O5 for how this was decided', // 7  <- INSIDE the range
            '', // 8
            '## B. Four further columns', // 9
            '', // 10
            'and §Z9 down here', // 11 <- OUTSIDE the range
        ].join('\n')

        const { text, lineStarts } = normalizeProse(synthetic)
        const hits = scanRubric(text, lineStarts, text.indexOf('## A. '), text.indexOf('## B. '))

        expect(hits.map((h) => h.text)).toEqual(['§O5'])
        expect(hits[0].line).toBe(7)
    })

    it('states no prior pass outcome -- the real file', () => {
        const { text, lineStarts, start, end } = rubricRange()
        const hits = scanRubric(text, lineStarts, start, end)

        expect(
            hits.map(
                (h) =>
                    'scorecard-template.md:' + h.line + '  [' + h.pattern + ']  ' +
                    h.text + '  -- ' + h.why
            )
        ).toEqual([])
    })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest test/scorerPacketBlindRule.test.js -t 'rubric channel'`

Expected: **failures with `scanRubric is not defined`** on the six new tests. The two Task 2 tests still pass.

- [ ] **Step 3: Add `RUBRIC_PATTERNS`, `RUBRIC_SCAN` and `scanRubric`**

Insert immediately after the `rubricRange()` function added in Task 2:

```js
/** Number words this rubric uses, plus digits. Interpolated twice below. */
const COUNT = '\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve'

/**
 * The rubric channel's pattern list -- the THIRD, kept separate for the same
 * reason PACKET_PATTERNS is separate from PATTERNS: the channels ban
 * different things and scan different files.
 *
 * This is not the stop-list the doctrine at the top of this file forbids.
 * That doctrine bans carve-outs INSIDE a list, which are invisible at the
 * point of failure. A separate list per channel is visible here, carries its
 * own written reason, and is already how PACKET_PATTERNS exists.
 *
 * WHAT IS DELIBERATELY ABSENT: `rubric-fraction`. It fires TEN times on
 * legitimate Task 12 band guidance in this range -- `≥ 8/10`, `5–7/10`,
 * `< 5/10`, and "a run can score 3/6 and pass; a run can score 4/6 and fail".
 * The alternative considered and rejected was rewriting the range to be
 * fraction-free so the pattern could apply unchanged; that takes out the one
 * sentence explaining why the gate is not the total, which is lobotomising
 * the packet rather than redacting the leak -- the exact distinction the
 * seed-04 negative control above exists to protect. Coverage is not lost: the
 * #139 leak's "6/6 and 0/6" sits in the same sentence as "moved a whole arm".
 *
 * THREE WEAKNESSES, recorded rather than glossed:
 *   1. `verdict-moved` is reverse-engineered from the one incident available.
 *      It bans a real shape -- what a prior pass's score did to the verdict --
 *      but nothing establishes it generalises.
 *   2. `credit-awarded` (borrowed, below) sits ONE WORD from a false positive:
 *      the rubric says "to award *partial* credit" and the pattern requires
 *      "awarded".
 *   3. `counted-rows` near-misses "two of the four rubric columns", surviving
 *      only because its noun list stops at runs|rows|passes.
 * Both near-misses are pinned as negative controls. Per the doctrine above, a
 * pattern that reddens on real guidance is fixed by writing a better pattern.
 */
const RUBRIC_PATTERNS = [
    {
        name: 'outside-section-pointer',
        // EVERY § in the whole §A->§B range is a self-reference: §A, §A2,
        // §A2.1, and nothing else. A pointer anywhere else is a pointer OUT
        // of the packet, into a document the scorer does not have -- which is
        // exactly what #139's two bare §O5/§T5 pointers were. §B is rejected
        // too, correctly: a packet ends at §A3.
        re: /§(?!A[0-9.]*\b)[A-Za-z0-9.]+/,
        why:
            'a section pointer out of the rubric and into the decision record, which a ' +
            'MODEL scorer can follow into every prior pass rows and grades',
    },
    {
        name: 'counted-rows',
        re: new RegExp(
            '\\b(?:' + COUNT + ')\\s+of\\s+(?:the\\s+)?(?:' + COUNT + ')?\\s*(?:runs?|rows?|passes)\\b',
            'i'
        ),
        why: 'how many prior rows or runs did something -- "nine of twelve rows flagged ambiguous"',
    },
    {
        name: 'prior-pass-reference',
        re: /\b(?:prior|previous|earlier|last)\s+(?:pass(?:es)?|runs?|rounds?|scorers?)\b|\bpass(?:es)?\s+(?:later|earlier|ago)\b/i,
        why: 'the provenance vocabulary of an earlier pass -- "three passes later", "a prior run"',
    },
    {
        name: 'verdict-moved',
        re: /\b(?:moved|swung|flipped|shifted)\s+(?:a|an|the)\s+(?:whole\s+|entire\s+)?(?:arm|verdict|gate|pass)\b/i,
        why: 'what a prior pass score did to the verdict -- "moved a whole arm between 6/6 and 0/6"',
    },
]

/**
 * The four spec-channel patterns that are inert on this range today, borrowed
 * by name so the two lists cannot silently drift apart. They cost nothing
 * measured and they cover the seed-spec-shaped leak -- "run 2 named...",
 * "earning full credit" -- if that prose ever migrates into the rubric.
 *
 * `rubric-fraction` and `answer-key-pointer` are the two NOT borrowed: the
 * first per the note above, the second because PACKET_PATTERNS already bans
 * every markdown filename including DECISION.md, so borrowing it would double
 * every hit.
 */
const BORROWED_FOR_RUBRIC = ['scored-a-number', 'scored-runs-or-rows', 'run-N-did', 'credit-awarded']

/**
 * The rubric range is scanned for BOTH an outcome and a path. The path half
 * is PACKET_PATTERNS itself rather than a copy, so the #144 widening reaches
 * this channel automatically.
 */
const RUBRIC_SCAN = RUBRIC_PATTERNS.concat(
    PATTERNS.filter((p) => BORROWED_FOR_RUBRIC.indexOf(p.name) !== -1)
).concat(PACKET_PATTERNS)

/** Every hit of every rubric-channel pattern in the slice [start, end). */
function scanRubric(text, lineStarts, start, end) {
    return scanWith(RUBRIC_SCAN, text.slice(start, end), lineStarts, start)
}
```

- [ ] **Step 4: Assert the borrowed names actually resolved**

A typo in `BORROWED_FOR_RUBRIC` would silently drop a pattern — `filter` returns fewer entries and nothing complains. Add this test at the top of the `#143` describe block:

```js
    it('borrows exactly the four spec patterns it names, by resolved identity', () => {
        // A typo in BORROWED_FOR_RUBRIC would silently drop a pattern: filter
        // returns a shorter array and no one notices. Compare resolved names,
        // not the literal list against itself.
        const borrowed = PATTERNS.filter((p) => BORROWED_FOR_RUBRIC.indexOf(p.name) !== -1)

        expect(borrowed.map((p) => p.name).sort()).toEqual([
            'credit-awarded',
            'run-N-did',
            'scored-a-number',
            'scored-runs-or-rows',
        ])
        expect(RUBRIC_SCAN).toHaveLength(RUBRIC_PATTERNS.length + 4 + PACKET_PATTERNS.length)
    })
```

- [ ] **Step 5: Run to verify all pass**

Run: `npx jest test/scorerPacketBlindRule.test.js -t 'rubric channel'`

Expected: 9 passed.

- [ ] **Step 6: Prove the guard would have caught the real incident, end to end**

Verify by hand that the check is not circular — the positive control uses the leak text, so confirm the *real file* would fail if the leak were restored:

```bash
git stash list >/dev/null
git show 253de7f^:benchmark/scorecard-template.md > /tmp/leaked-template.md
node -e "
const fs=require('fs');
const src=fs.readFileSync('benchmark/scorecard-template.md','utf8');
const leaked=fs.readFileSync('/tmp/leaked-template.md','utf8');
console.log('pre-fix template differs:', src!==leaked);
"
```

Then temporarily copy the pre-fix §A2.1 preamble into the real template, run `npx jest test/scorerPacketBlindRule.test.js -t 'states no prior pass outcome'`, confirm it **FAILS**, and revert with `git checkout benchmark/scorecard-template.md`. Record the observed failure output in the commit message.

**This step is mandatory.** A guard verified only against a string literal in its own test file is a guard verified against itself.

- [ ] **Step 7: Run the full suite**

Run: `npm test`

Expected: 28 suites, 1387 passed.

- [ ] **Step 8: Commit**

```bash
git add test/scorerPacketBlindRule.test.js
git commit -m "$(cat <<'EOF'
fix(#143): the rubric channel is scanned for a prior pass's outcome

The blind rule binds three channels. #100 guarded the seed specs, #140 guarded
the packets; the rubric slice -- copied into EVERY packet, so a leak there
reaches all twelve rows at once -- has never been machine-scanned, and it
demonstrably leaked (253de7f, caught by a reviewer reading a diff).

RUBRIC_PATTERNS is the third channel-scoped list. Four new patterns:
outside-section-pointer (every § in the whole range is a self-reference to §A*,
so a pointer anywhere else is a route out of the packet), counted-rows,
prior-pass-reference, verdict-moved. Plus four spec patterns verified inert on
the range, plus PACKET_PATTERNS itself so #144's widening reaches this channel
automatically.

Measured both directions: the paragraph removed in 253de7f is caught five times
from four distinct patterns, pinned by distinct pattern name so a later edit
cannot reduce it to a single point of failure; the real range scans clean on
all nine. Verified non-circularly by restoring the leak into the real template
and confirming the file scan fails.

rubric-fraction is deliberately absent -- it fires 10x on legitimate Task 12
band guidance, and rewriting the range to suit it would take out the one
sentence explaining why the gate is not the total. Three weaknesses are
recorded in the file rather than glossed: verdict-moved is reverse-engineered
from the one incident, and credit-awarded and counted-rows each sit one word
from a false positive on real guidance. Both near-misses ship as pinned
negative controls.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Make the guard roster match the guard

Closes #144 item 2, and corrects the test file's own header, which asserts the rubric channel is unscanned.

**Files:**
- Modify: `benchmark/README.md:113-114` (roster table), `:115-130` (the paragraph below it), `:140` (the closing sentence)
- Modify: `test/scorerPacketBlindRule.test.js:37-58` (the `WHAT THIS GUARD DOES NOT COVER` header)
- Test: `test/scorerPacketBlindRule.test.js`

**Interfaces:**
- Consumes: nothing. Documentation plus one regression pin.
- Produces: nothing.

- [ ] **Step 1: Write the failing roster test**

Add to the `#143` describe block in `test/scorerPacketBlindRule.test.js`:

```js
    it('the README guard roster names every channel this file scans', () => {
        // #144 item 2: the roster described only the seed-spec channel, two
        // guard generations after the packet channel landed. A roster that
        // does not match the guard is how the next reader mis-scopes a change,
        // so it is pinned rather than trusted.
        const readme = fs.readFileSync(path.join(SCORING, 'README.md'), 'utf8')

        expect(readme).toContain('scorer-facing seed specs')
        expect(readme).toContain('repository paths')
        expect(readme).toContain('rubric')

        // The three sentences that became FALSE when the rubric scan landed.
        expect(readme).not.toContain('The guard scans the seed specs — one of the three channels.')
        expect(readme).not.toContain('is not\nmachine-scanned')
        expect(readme).not.toContain('does the same for the 5 seed specs')
    })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest test/scorerPacketBlindRule.test.js -t 'README guard roster'`

Expected: FAIL on the first `not.toContain` — the stale sentence is still there.

- [ ] **Step 3: Replace the roster table and the paragraph below it**

In `benchmark/README.md`, replace lines 113–130 — the table beginning `| Guard | Catches | Origin |` through the paragraph ending `the principle rather than defining it.` — with:

```markdown
| Guard | Catches | Origin |
|---|---|---|
| `test/scorerPacketBlindRule.test.js` | **prior-run outcomes** reaching the 5 scorer-facing seed specs | #100 |
| `test/scorerPacketBlindRule.test.js` | **repository paths** reaching a committed scorer packet | #140 |
| `test/scorerPacketBlindRule.test.js` | **a prior pass's outcome or provenance, and repository paths**, reaching the rubric slice | #143 |

One file, three pattern lists, because the three channels ban different things
and scan different files. **Two of the rule's three channels are now scanned.**
The rubric channel — §A/§A2/§A3 of `scorecard-template.md`, the slice copied
into *every* packet — was the last to be covered, and covering it took two
changes rather than one. Its four repository paths were reworded out at source
(they were already being removed by hand at packet-build time), and its
outcome patterns are scoped to the channel: a naive scan reddens on the Task 12
band table, because the rubric legitimately explains grading with score-shaped
text (*"a run can score 3/6 and pass"*). What it does not get to do is report
what a prior pass measured — which is what issue #139 caught it doing, when a
§A2.1 preamble shipped into the slice stating what a prior pass had scored and
pointing twice into `DECISION.md`.

**The run-report channel is bound by the rule and is not machine-scanned.** It
is per-row prose written fresh each pass, so every run report must be checked by
hand against the blind rule before it ships. As with the harness rule, the
roster tracks the principle rather than defining it.
```

- [ ] **Step 4: Fix the closing sentence at the end of the "passing suite" paragraph**

In the same file, in the paragraph beginning `**A passing suite is not evidence of blindness.**`, replace:

```
and
`scorerPacketBlindRule.test.js` does the same for the 5 seed specs — so the next leak in either
channel fails a build instead of waiting for someone to notice.
```

with:

```
and
`scorerPacketBlindRule.test.js` does the same for the 5 seed specs, the committed scorer packets and
the rubric slice — so the next leak in any of those fails a build instead of waiting for someone to
notice.
```

- [ ] **Step 5: Rewrite the test file's own header**

In `test/scorerPacketBlindRule.test.js`, replace the block comment section running from `* WHAT THIS GUARD DOES NOT COVER` through the line `* evidence of blindness; it is evidence the declared patterns did not fire.` (currently lines 38–58) with:

```
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD COVERS, AND WHAT IT DOES NOT
 * ---------------------------------------------------------------------------
 * The rule binds three channels (benchmark/README.md, "The scorer blind
 * rule"). This guard scans TWO of them, with a separate pattern list each:
 *
 *   SEED SPECS   PATTERNS         bans a prior run's OUTCOME
 *   PACKETS      PACKET_PATTERNS  bans a repository PATH
 *   RUBRIC       RUBRIC_PATTERNS  bans a prior pass's outcome or provenance,
 *                + PACKET_PATTERNS  and a repository path
 *
 * The rubric channel is benchmark/scorecard-template.md §A/§A2/§A3 -- the
 * slice copied into EVERY packet, so a leak there reaches every row of a pass
 * at once. It was previously unscanned on a cost/benefit judgement: the
 * section legitimately explains grading with score-shaped text ("a run can
 * score 3/6 and pass"), so a naive scan reddens on guidance. That judgement
 * was once written up as though score-shaped text in the rubric were only
 * ever legitimate guidance; #139 falsified it -- a §A2.1 preamble shipped
 * into the slice carrying a prior pass's grades and two decision-record
 * section pointers, and no guard could have fired. #143 scanned it, with the
 * patterns scoped to the channel rather than borrowed whole. See
 * RUBRIC_PATTERNS for what is deliberately absent and why.
 *
 * The RUN-REPORT channel is per-row prose written fresh each pass. It is
 * bound by the rule and is NOT scanned here, so it remains a hand check.
 *
 * A passing suite is not evidence of blindness; it is evidence the declared
 * patterns did not fire.
```

- [ ] **Step 6: Run the roster test to verify it passes**

Run: `npx jest test/scorerPacketBlindRule.test.js -t 'README guard roster'`

Expected: PASS.

- [ ] **Step 7: Run the full suite**

Run: `npm test`

Expected: 28 suites, 1388 passed.

- [ ] **Step 8: Commit**

```bash
git add benchmark/README.md test/scorerPacketBlindRule.test.js
git commit -m "$(cat <<'EOF'
docs(#144): the guard roster matches the guard

The roster described scorerPacketBlindRule.test.js as catching "prior-run
outcomes" and doing "the same for the 5 seed specs" -- two guard generations
out of date, mentioning neither the packet channel #140 added nor the rubric
channel #143 just added. The surrounding paragraph still opened "The guard
scans the seed specs -- one of the three channels."

Stale in the safe direction, but a roster that does not match the guard is how
the next reader mis-scopes a change, so the three rows are now pinned by a
test rather than trusted.

The test file's own header said the rubric channel "is not machine-scanned, so
every addition to §A/§A2/§A3 must be checked by hand". That is now false and is
rewritten. The run-report channel remains listed as bound-but-unscanned, which
is still true.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Record the change

No code. `DECISION.md` gains an appended section; three documents that describe the narrower guard get dated forward notes rather than edits.

**Files:**
- Modify: `benchmark/DECISION.md` (append `## AA.` at end of file)
- Modify: `docs/superpowers/specs/2026-08-07-t9-pass-blockers-design.md` (append forward note)
- Modify: `CHANGELOG.md` (new entry at top of the entries; forward note on the `2026.08.0708` entry)
- Modify: `package.json:3`, `README.md:3`

**Interfaces:**
- Consumes: the final suite count from Task 4.
- Produces: nothing.

- [ ] **Step 1: Append `## AA.` to `benchmark/DECISION.md`**

Append at the very end of the file. **Do not modify §Z or anything above it.** Fill `<N>` from Task 4's actual suite count.

```markdown

---

## AA. The rubric channel is scanned (`2026.08.0801`, #143 + #144)

**§A through §Z are unmodified** — `git log -p benchmark/DECISION.md` is the check, as §Z said of
§A–§Y and §X of §U–§W. This section appends and changes nothing above it. In particular **§Z4
stands as written**: it is the accurate record of the rule that shipped at `2026.08.0709`, and this
section supersedes it rather than correcting it.

**No runs were fired, no packet was re-scored and no instance was touched.** This is a repair to the
measuring instrument, one reword of the rubric's source, and one test-suite measurement.

Artefacts: `test/scorerPacketBlindRule.test.js` (`RUBRIC_PATTERNS`, `PATH_STEMS`, `rubricRange`) ·
`benchmark/scorecard-template.md` §A–§A3 · `benchmark/README.md` guard roster.

### AA1. What was unguarded

The blind rule binds **three** channels. #100 guarded the seed specs; #140 guarded the packets. The
**rubric** — `scorecard-template.md` §A/§A2/§A3, the slice copied into every packet — was never
machine-scanned, and §Z shipped without touching it.

It had already leaked. §A2.1's preamble stated what a prior pass measured (*"nine of twelve rows
flagged `ambiguous`"*, *"moved a whole arm between 6/6 and 0/6"*) and carried two bare `§`-pointers
into this document. It was caught by a reviewer reading a diff and removed in `253de7f`.

**That is the §T7 failure shape one level up.** #140 hardened the packet channel after a leak was
caught by hand; this is the channel feeding every packet, caught by hand, with no guard. The fanout
is what makes it more than tidiness: a leak in one seed spec reaches the rows scored against that
seed, and a leak in the rubric reaches **all twelve rows at once**.

The protection that existed was real but lived in the wrong place. `scoring-v9/packet-build-report.md`
§7.2 records four substitutions on the rubric slice, each asserted to match exactly once at build
time or the build throws. They are **path-only** — they did not see the prose leak at all.

### AA2. What now binds

A third channel-scoped pattern list. The range is derived from the `## A.` / `## B.` headings rather
than hardcoded, which pins the template's heading structure into a test **deliberately**: the packet
build depends on the same two headings, so a rename that breaks the scan is a rename that changes
what ships to twelve scorers.

Four new patterns, plus four spec-channel patterns verified inert on the range, plus
`PACKET_PATTERNS` itself so the widening below reaches this channel automatically. The load-bearing
one is `outside-section-pointer`: **every `§` in the entire §A→§B range is a self-reference** — `§A`,
`§A2`, `§A2.1`, nothing else — so a pointer anywhere else is a pointer out of the packet, into a
document the scorer does not have. Zero false positives, and it catches both of #139's pointers.

> **The paragraph removed in `253de7f` is caught five times from four distinct patterns. The
> reworded range scans clean on all nine, with zero residual paths.**

Verified non-circularly: the leak was restored into the real template and the file scan was confirmed
to fail, rather than the guard being checked only against a string literal in its own test.

**`rubric-fraction` is deliberately absent, and this is the one judgement call worth quoting.** It
fires **ten times** on legitimate Task 12 band guidance in the range. The alternative — rewriting the
range to be fraction-free so the pattern could apply unchanged — takes out the sentence *"a run can
score 3/6 and pass; a run can score 4/6 and fail"*, which is the only place the rubric explains why
the gate is not the total. That is lobotomising the packet rather than redacting the leak. This is
not the stop-list the guard's doctrine forbids: that doctrine bans carve-outs *inside* a list, and a
separate list per channel is already how `PACKET_PATTERNS` exists.

**And it leaves a residue, recorded rather than left to be re-derived.** A bare fraction carrying no
scoring verb and no run-noun is caught by nothing in the rubric scan — *"the §A2 arm came out 0/6 last
time"* passes every pattern. A narrowed fraction rule requiring an adjacent past-tense outcome verb
would close it and measures clean against all ten legitimate fractions; it was considered and **not**
shipped, because it would be reverse-engineered from a constructed sentence rather than a real
incident, which is the weakness already recorded against `verdict-moved`. Compensating for one
speculative pattern with a second is not a fix. The design review that surfaced this also corrected
the count in this paragraph from six to ten — the first draft enumerated the band table and missed
four, including *"two different 4/6 runs"*.

**The four repository paths in the range were reworded out at source**, using §7.2's own A1–A4
replacements. The packet **text** is unchanged — that is the wording the v9 scorers already read —
but deviation set A disappears from the next packet build, and a future editor who adds a path to §A
now fails the suite instead of depending on the builder noticing.

### AA3. The path rule's residue, closed

§Z4 described the widened rule as firing on *"a longer path … rooted at one of the enumerated
directory stems"*. That was accurate and it understated the gap: the alternation required at least
one character after the slash, so a reference **stopping at a stem** escaped. Measured on the shipped
rule — `scoring-v9/`, `results/`, `../results` and `.superpowers/sdd/v9-pass/` all returned **no
hit**. *"The packets are in `scoring-v9/`"* was a walkable route.

Three alternations now. A bare stem **word** with no slash still correctly misses, pinned as a
negative control so a later widening cannot take ordinary prose.

> **v9: 12 packets, 0 hits — before and after this widening, as before and after §Z4's.** No false
> positive forced a tightening.

`scoring-v4` remains a declared out-of-scope directory for the reason §Z4 gives.

### AA4. What this cannot establish

**This repairs the measuring instrument. It measures nothing about diagnostic quality, for either
harness, in either direction.**

- **§T3 stands unmoved**, and so does everything §Z5 listed. Six custom rows reached layer 4 and all
  six concluded at layer 1; no scan changes that.
- **0 hits on the reworded range confirms the rule agrees with the reword.** It is not a
  retrospective catch, and it does not establish the v9 scorers saw nothing they should not have —
  §T7's account of that stands as written.
- **Nothing here establishes the new patterns are the right patterns.** Three were written against
  the one incident available. `verdict-moved` is explicitly reverse-engineered from a single
  sentence, and the file says so. Two others — `credit-awarded` and `counted-rows` — sit **one word**
  from firing on legitimate rubric guidance, and both near-misses are pinned as negative controls
  precisely because that margin is thin.
- **The rubric channel is scanned, not sealed.** AA2's residue is the standing example: a bare
  fraction with no scoring verb and no run-noun passes every pattern. Scanning a channel is not the
  same as covering it.
- **The run-report channel is still unscanned.** Per-row prose written fresh each pass, bound by the
  rule, hand-checked. Two of three channels are machine-scanned; this is not three.
- **A passing suite is not evidence of blindness.** It is evidence the declared patterns did not
  fire. This section's own count was wrong by four until a review measured it, which is the same
  lesson in miniature: a stated measurement is not a measurement.

### AA5. Disposition

**Both #143 and #144 are closed.** Two of the rule's three channels are machine-scanned, the rubric
slice is path-clean at source, and the guard roster matches the guard.

**§Z6 still governs the next scored pass.** It is unblocked and it is still not scheduled, sized or
pre-registered; any pass needs its own §U/§W-style pre-registration with predictions committed
before a run fires, and **this section is not that pre-registration** any more than §Z was.

**Unchanged: native remains the recommended path on this instance, and the Phase 1b milestone is not
met.** §Z6's quoting rule stands — **34/36 · 4/6** only with the derived file beside it, and **9/36
or 8/36** for the custom total, never a bare figure.

Suite at the close of this section: **<N> passed, 28 suites.** No production code was touched.
```

- [ ] **Step 2: Append the forward note to the predecessor spec**

At the very end of `docs/superpowers/specs/2026-08-07-t9-pass-blockers-design.md`:

```markdown

---

> **Forward note, 2026-08-08 (#144).** This spec describes the path rule as it was designed on
> 2026-08-07, and it is left unedited on that basis. It understated one residue: a reference that
> **stops at an enumerated stem** (`scoring-v9/`, `results/`, `../results`) did not fire. Closed in
> `docs/superpowers/specs/2026-08-08-rubric-channel-scan-design.md`; see `DECISION.md` §AA3.
```

- [ ] **Step 3: Append the forward note to the `2026.08.0708` CHANGELOG entry**

Find the `## 2026.08.0708` heading in `CHANGELOG.md` and append at the end of that entry's body, before the next `## ` heading:

```markdown
> **Forward note, 2026-08-08 (#144).** Accurate for the rule shipped here, and left unedited. It
> understated one residue: a reference stopping at an enumerated stem did not fire. Closed at
> `2026.08.0801`; see `benchmark/DECISION.md` §AA3.
```

- [ ] **Step 4: Add the new CHANGELOG entry**

Insert directly above the `## 2026.08.0709` heading. Fill `<N>` from Task 4's suite count.

```markdown
## 2026.08.0801 — 2026-08-08

### Fixed — the rubric channel is scanned (#143)

The blind rule binds three channels. #100 guarded the seed specs, #140 guarded the packets; the
rubric slice — `scorecard-template.md` §A/§A2/§A3, copied into **every** packet — had never been
machine-scanned, and it demonstrably leaked (`253de7f`, caught by a reviewer reading a diff). A leak
in one seed spec reaches the rows scored against that seed; a leak here reaches all twelve at once.

`RUBRIC_PATTERNS` is the third channel-scoped list, scanning a range derived from the `## A.` /
`## B.` headings. The load-bearing pattern is `outside-section-pointer`: every `§` in the whole range
is a self-reference, so a pointer anywhere else is a route out of the packet. The paragraph removed
in `253de7f` is caught five times from four distinct patterns; the range scans clean on all nine.
Verified non-circularly by restoring the leak into the real template and confirming the file scan
fails.

`rubric-fraction` is deliberately absent — it fires ten times on legitimate Task 12 band guidance,
and rewriting the range to suit it would take out the one sentence explaining why the gate is not
the total. Four weaknesses are recorded in the file rather than glossed, including the residue the
exclusion leaves — a bare fraction with no scoring verb and no run-noun is caught by nothing. Two
near-misses ship as pinned negative controls.

The four repository paths in the range were reworded out at source using the packet builder's own
A1–A4 replacements, so the packet text is unchanged but deviation set A disappears from the next
build.

### Fixed — the path rule catches a stem-terminated reference (#144)

`scoring-v9/`, `results/`, `../results` and `.superpowers/sdd/v9-pass/` all returned no hit on the
shipped rule, because the alternation required at least one character after the slash. Three
alternations now; a bare stem word with no slash still misses, pinned as a control. The twelve v9
packets scan 0 before and after.

### Changed — the guard roster matches the guard (#144)

`benchmark/README.md`'s roster described the guard two generations out of date. Three rows now, pinned
by a test. The test file's own header no longer claims the rubric channel is unscanned.

Suite: **<N> passed, 28 suites.** No production code touched. `benchmark/DECISION.md` §AA.
```

- [ ] **Step 5: Bump the version in two places**

`package.json:3`: `"version": "2026.08.0709",` → `"version": "2026.08.0801",`

`README.md:3`: `![Version](https://img.shields.io/badge/version-2026.08.0709-blue)` → `![Version](https://img.shields.io/badge/version-2026.08.0801-blue)`

- [ ] **Step 6: Verify the record is internally consistent**

```bash
grep -c "2026.08.0801" package.json README.md CHANGELOG.md
grep -n "^## AA\." benchmark/DECISION.md
git diff --stat HEAD~4
```

Expected: version present in all three files; `## AA.` present once; the diff touches only the files this plan names. **Confirm `git diff HEAD~4 -- benchmark/DECISION.md` shows only ADDED lines** — if any line above §AA shows as modified, the append-only constraint was violated and must be fixed before committing.

- [ ] **Step 7: Run the full suite one final time**

Run: `npm test`

Expected: 28 suites, `<N>` passed — the same number written into §AA5 and the CHANGELOG. **If they disagree, fix the documents, not the test.**

- [ ] **Step 8: Commit**

```bash
git add benchmark/DECISION.md CHANGELOG.md package.json README.md docs/superpowers/specs/2026-08-07-t9-pass-blockers-design.md
git commit -m "$(cat <<'EOF'
docs(#143,#140): DECISION.md §AA records the rubric channel scan

Appends §AA; §A through §Z unmodified, per the norm §Z asserted of §A-§Y and
§X of §U-§W. §Z4 stands as the accurate record of the rule that shipped at
2026.08.0709 -- §AA supersedes it rather than correcting it, and the
predecessor spec and the 0708 CHANGELOG entry get dated forward notes on the
same principle.

§AA4 states what this cannot establish, in §Z5's shape: §T3 is unmoved, 0 hits
on the reworded range confirms the rule agrees with the reword rather than
being a retrospective catch, verdict-moved is reverse-engineered from one
incident, and the run-report channel is still unscanned -- two of three
channels, not three.

Version 2026.08.0801.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

- [ ] **Full suite green:** `npm test` → 28 suites, count matches §AA5 and the CHANGELOG.
- [ ] **The guard is not self-referential:** Task 3 Step 6 was performed against the real template and observed to fail.
- [ ] **`DECISION.md` diff is append-only:** `git diff main -- benchmark/DECISION.md` shows only additions.
- [ ] **`scoring-v4/` and `scoring-v9/` untouched:** `git diff --name-only main | grep scoring-v` returns nothing.
- [ ] **`rubricClauses.test.js` untouched:** `git diff --name-only main | grep rubricClauses` returns nothing.
- [ ] **Push and open the PR** against `main`, body closing both issues:

```bash
git push -u origin fix/143-rubric-channel-scan
gh pr create --title "fix(#143,#144): scan the rubric channel, close the path rule's residues" --body "$(cat <<'EOF'
Closes #143. Closes #144.

The blind rule binds three channels. #100 guarded the seed specs, #140 guarded the packets. The rubric slice — `scorecard-template.md` §A/§A2/§A3, copied into **every** packet — had never been machine-scanned, and it demonstrably leaked (`253de7f`, caught by a reviewer reading a diff). A leak in one seed spec reaches the rows scored against that seed; a leak here reaches all twelve at once.

## What ships

- **`RUBRIC_PATTERNS`**, the third channel-scoped list, over a range derived from the `## A.` / `## B.` headings. The load-bearing pattern is `outside-section-pointer` — every `§` in the whole range is a self-reference, so a pointer anywhere else is a route out of the packet.
- **The four repository paths reworded out at source**, using the packet builder's own A1–A4 replacements. Packet text unchanged; deviation set A disappears from the next build.
- **The path rule widened** (#144): `scoring-v9/`, `results/`, `../results`, `.superpowers/…` all fired no hit before and do now.
- **The guard roster rewritten** to match the guard, pinned by a test.

## Measured

| | |
|---|---|
| The paragraph removed in `253de7f` | caught **5×** from **4 distinct patterns** |
| The reworded §A→§B range | **clean on all nine patterns**, 0 residual paths |
| The twelve v9 packets, widened rule | **0 hits**, before and after |

Verified non-circularly: the leak was restored into the real template and the file scan confirmed to fail, rather than the guard being checked only against a string literal in its own test.

## Judgement calls worth reviewing

- **`rubric-fraction` is deliberately absent.** It fires 10× on legitimate Task 12 band guidance. Rewriting the range to suit it would take out *"a run can score 3/6 and pass; a run can score 4/6 and fail"* — the only sentence explaining why the gate is not the total. Not the stop-list the doctrine forbids: that bans carve-outs *inside* a list, and a separate list per channel is already how `PACKET_PATTERNS` exists.
- **Three weaknesses are recorded rather than glossed.** `verdict-moved` is reverse-engineered from the one incident. `credit-awarded` and `counted-rows` each sit **one word** from a false positive on real guidance; both near-misses ship as pinned negative controls.
- **`DECISION.md` §AA appends; §Z is untouched.** §Z4 remains the accurate record of what shipped at `2026.08.0709`.

## What this does not establish

§T3 is unmoved — this repairs the measuring instrument and measures nothing about diagnostic quality. Two of three channels are machine-scanned; the run-report channel is still hand-checked. §Z6 still governs the next scored pass, which remains unscheduled and un-pre-registered.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review notes

Checked against `docs/superpowers/specs/2026-08-08-rubric-channel-scan-design.md`:

| Spec section | Task |
|---|---|
| §2.1 rubric unscanned | 2, 3 |
| §2.2 stem-terminated residue | 1 |
| §2.3 stale roster | 4 |
| §3.1 third pattern list + range scanned by both lists | 3 (`RUBRIC_SCAN`) |
| §3.2 range derivation, file-absolute lines | 2 (helper), 3 (control) |
| §3.3 nine patterns, `rubric-fraction` excluded, three weaknesses | 3 |
| §3.4 template reword A1–A4 | 2 |
| §3.5 widened path rule | 1 |
| §3.6 what this cannot establish | 5 (§AA4) |
| §4 testing, controls before coverage | 1–4, each task's Step 1 |
| §5 documentation and record | 4, 5 |
| §6 out of scope | Global Constraints; §AA5 |

**Deliberate addition beyond the spec:** Task 3 Step 6 (restore the leak into the real template and confirm the file scan fails). The spec's §4 item 1 pins the leak as a string literal in the test file, which verifies the patterns against themselves. The extra step verifies the wiring — range derivation, offset, list composition — against the real file, and is marked mandatory.
