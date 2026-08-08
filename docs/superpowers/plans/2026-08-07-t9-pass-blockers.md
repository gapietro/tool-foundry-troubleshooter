# §T9 Pass Blockers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two blockers `benchmark/DECISION.md` §T9 pre-committed to before another scored benchmark pass is spent — the under-determined `fix_usable_unedited` rubric column (#139) and the blind-rule gate that scans seed specs but not scorer packets (#140).

**Architecture:** Two independent changes to the **measurement instrument**, delivered as two branches and two PRs that share no files. #140 adds a second pattern list and a declared packet-directory registry to one Jest file. #139 adds two decision clauses to the rubric markdown that reaches scorer packets, publishes a derived recompute of the v9 rows beside the untouched original scorecard, and pins the clauses with a guard test. Neither runs a benchmark pass, touches `src/`, or changes the harness.

**Tech Stack:** Node/Jest (CommonJS, no TypeScript in `test/`), markdown. No ServiceNow instance access required — **nothing in this plan calls an MCP tool or `now-sdk`.**

**Spec:** `docs/superpowers/specs/2026-08-07-t9-pass-blockers-design.md`

## Global Constraints

- **Never commit to `main`.** Every change goes on a branch, then a PR. No exceptions for "config-only" or "docs-only" changes (`CLAUDE.md` § Development Workflow).
- **All work is tied to a GitHub issue.** #140 for Part 1, #139 for Part 2. Both already exist and are assigned.
- **Version bump on every merge to main.** Format `YYYY.MM.DDXX`. Current is `2026.08.0707`. Part 1's PR bumps to `2026.08.0708`; Part 2's PR bumps to `2026.08.0709`. Update **both** `package.json` `"version"` and the `README.md` badge on line 3, and add a `CHANGELOG.md` entry (newest-first, directly under the `---` on line 18).
- **Test suite baseline: 1345 passed, 27 suites**, measured on `2026.08.0707`. Nothing existing may go red. New tests add to the count.
- `test/` is CommonJS: `const x = require('...')`, `module.exports = {...}`. No ESM, no TypeScript.
- **Do not edit `benchmark/scorecard-v9.md`.** Those are the scores twelve blind scorers produced. The recompute is published as a separate file.
- **Do not edit any file under `benchmark/scoring-v4/`.** Those packets are the record of what the v4 scorers actually read.
- **Do not edit the five files matching `benchmark/seeds/seed-0*.md`.** They keep their repository paths by design (spec §3.2).
- Run tests with `npx jest`. A single file: `npx jest test/<name>.test.js`.

---

# PART 1 — #140, the blind-rule packet scan

**Branch:** `fix/140-blind-rule-packet-scan`
**Touches exactly one file:** `test/scorerPacketBlindRule.test.js`

## Background the implementer needs

`test/scorerPacketBlindRule.test.js` protects the measurement **instrument**: it keeps a prior run's behaviour and grade out of anything a blind scorer reads. It currently scans one channel — the five scorer-facing seed specs in `benchmark/seeds/` — with five patterns. The fifth, `answer-key-pointer`, matches the literal `/DECISION\.md/i`.

§T7 found the gap: the suite passed 11/11 while two one-hop routes to the answer key sat in the **v9 packet framing**, which the guard does not scan at all. A packet is the single self-contained file handed to one blind scorer (`benchmark/scoring-v9/row-NN-*.md`). Both leaks were removed by hand. That was the second consecutive round where a leak was caught by a human rather than the gate.

**Why the fix is not "widen the existing pattern".** The five seed specs legitimately carry 22 repository-path strings (`../../test/blindRule.test.js`, `seed-app/src/fluent/seed-tables-acl.now.ts`, `DESIGN.md`, …). A spec that cannot say which Fluent file installs the seed stops being a usable source document. So the any-path rule binds the **packet** channel, and the specs keep their existing five patterns. Paths are stripped when spec content is embedded into a packet — which is exactly what the v9 packet builder did by hand.

**Measured before this plan was written**, so the implementer knows the expected answer:

| Packet set | `row-*.md` files | repository-path hits |
|---|---|---|
| `benchmark/scoring-v9/` | 12 | **0** |
| `benchmark/scoring-v4/` | 20 | **164** |

v4 is held out of the scan by an explicit declaration with a written reason — a directory-level declaration, not a pattern-level exemption. The file's doctrine forbids stop-lists because they are a *silent* second way to be unguarded; a named directory with a stated reason is neither silent nor a hole inside a scanned file.

## File Structure — Part 1

| File | Responsibility | Change |
|---|---|---|
| `test/scorerPacketBlindRule.test.js` | Guards every channel that reaches a blind scorer. Gains a second pattern list (`PACKET_PATTERNS`) and a declared packet registry (`PACKET_SETS`), both scoped to the packet channel. The existing `PATTERNS` / `SPECS` spec-channel logic is untouched. | Modify |

One file, because the two channels are two halves of one rule and a reader checking "what can reach a scorer" should find both in one place. The existing file already frames itself that way in its header comment.

---

### Task 1: The packet scanner, as a unit under test

The file's own doctrine (its `_paramShapeScan` sibling states it explicitly): *"A source-scan guard has one characteristic failure: it matches nothing, for a reason no one notices, and reports green forever. So the scanner is a unit under test in its own right — fed synthetic sources with known answers — before it is pointed at the real tree."* This task builds and proves the scanner. Task 2 points it at the packets.

**Files:**
- Modify: `test/scorerPacketBlindRule.test.js` (add `PACKET_PATTERNS` near the existing `PATTERNS` array at :96-105; add `scanPackets` near `scanProse` at :107-127; add a new `describe` block after the existing `'the scanner itself works (controls)'` block, which ends at the end of file)

**Interfaces:**
- Consumes: `normalizeProse`, `lineAt` from `./_normalizeProse` (already imported at :139 of the current file — `const { normalizeProse, lineAt } = require('./_normalizeProse')`). `normalizeProse(source)` returns `{ text, lineStarts }`; `lineAt(lineStarts, offset)` returns a 1-indexed line number.
- Produces: `PACKET_PATTERNS` (array of `{name, re, why}`) and `scanPackets(text, lineStarts)` returning an array of `{pattern, why, line, text}` — Task 2 calls `scanPackets` over real files.

- [ ] **Step 1: Write the failing controls**

Append this `describe` block to the end of `test/scorerPacketBlindRule.test.js`:

```js
// ---------------------------------------------------------------------------
// THE PACKET CHANNEL (issue #140)
// ---------------------------------------------------------------------------
// The spec channel above bans a prior run's OUTCOME. This channel bans a
// repository PATH, which is a different defect: not the answer, but a route a
// MODEL scorer can walk to reach it. Issue #100's fix produced packets that
// named their own sources -- "(verbatim from benchmark/scorecard-template.md)"
// -- and that template cites DECISION.md, so the route was two hops from a
// packet and one hop from the citation. The old answer-key-pointer pattern
// matched a literal DECISION.md and saw neither.
//
// The rule here is deliberately UNIFORM: any repository path, no judgement
// about which paths are "safe". §T7's reasoning -- a selective rule forces
// every future reader to re-derive which paths were judged safe, and that
// re-derivation is where the next leak hides.
describe('the packet scanner itself works (controls)', () => {
    it('POSITIVE: a directory-qualified path fires', () => {
        const { text, lineStarts } = normalizeProse('(verbatim from benchmark/scorecard-template.md)')
        const hits = scanPackets(text, lineStarts)

        expect(hits.map((h) => h.pattern)).toEqual(['repository-path'])
        expect(hits[0].text).toBe('benchmark/scorecard-template.md')
    })

    it('POSITIVE: a bare root-level doc name fires -- the case the old literal pattern missed', () => {
        // The old answer-key-pointer matched /DECISION\.md/i and nothing else.
        // DESIGN.md is a root-level answer-adjacent document and was invisible
        // to it. Both must fire now.
        const { text, lineStarts } = normalizeProse('see DESIGN.md and DECISION.md for the rulings')
        const hits = scanPackets(text, lineStarts)

        expect(hits.map((h) => h.text).sort()).toEqual(['DECISION.md', 'DESIGN.md'])
    })

    it('POSITIVE: a relative path fires, and reports the line it opened on', () => {
        // Packets embed spec content, and the specs use ../ and ../../ forms.
        // The line map matters for the same reason it does in the spec channel:
        // a failure must point at real source.
        const { text, lineStarts } = normalizeProse(
            'first line with nothing\n' + 'the guard is ../../test/blindRule.test.js today\n'
        )
        const hits = scanPackets(text, lineStarts)

        expect(hits.map((h) => h.text)).toEqual(['../../test/blindRule.test.js'])
        expect(hits[0].line).toBe(2)
    })

    it('NEGATIVE: prose containing a slash but no repository path does not fire', () => {
        // Row 06's real packet text. A UI breadcrumb is not a path into this
        // repo, and a pattern that reddened on it would be untenable.
        const { text, lineStarts } = normalizeProse('Open Now Assist / AI Skill Studio and locate the provider integration')

        expect(scanPackets(text, lineStarts)).toEqual([])
    })

    it('NEGATIVE: a platform table or field name does not fire', () => {
        const { text, lineStarts } = normalizeProse(
            'sn_aia_execution_plan.state, x_snc_tsbench_routing, api_type=sys_hub_flow'
        )

        expect(scanPackets(text, lineStarts)).toEqual([])
    })
})
```

- [ ] **Step 2: Run the controls to verify they fail**

Run: `npx jest test/scorerPacketBlindRule.test.js`
Expected: FAIL — five failures, each `ReferenceError: scanPackets is not defined`. If any control passes, stop: the file already has a symbol by that name and the plan's assumptions are wrong.

- [ ] **Step 3: Add `PACKET_PATTERNS` and `scanPackets`**

Insert immediately after the closing `]` of the existing `PATTERNS` array (currently ending at :105, just before the `/** Every hit of every pattern ... */` comment for `scanProse`):

```js
/**
 * The packet channel's pattern list, kept SEPARATE from PATTERNS above
 * because the two channels ban different things and scan different files.
 * PATTERNS bans a prior run's outcome and scans the seed specs. This bans a
 * repository path and scans the packets. Merging them would force the seed
 * specs -- which legitimately cite 22 repository paths, because a spec that
 * cannot say which Fluent file installs its seed is not a usable source
 * document -- to satisfy a rule written for a different artifact.
 */
const PACKET_PATTERNS = [
    {
        name: 'repository-path',
        // Two alternations, both deliberate:
        //   1. a path qualified by one of this repo's top-level directories,
        //      with optional ./ or ../ prefixes (the specs use both forms);
        //   2. a bare root-level document name -- DESIGN.md was invisible to
        //      the old literal DECISION.md pattern and is one hop from the
        //      same answers.
        // No file-extension requirement on alternation 1: "benchmark/seeds"
        // is a route even without a filename, and seeds/history/ is what
        // sits at the end of it.
        re:
            /(?:\.{0,2}\/)*(?:benchmark|docs|src|test|seed-app|node_modules|dist|\.claude)\/[A-Za-z0-9_./-]+|\b(?:DECISION|DESIGN|CHANGELOG|README|IMPLEMENTATION_PLAN|LOW_LEVEL_DESIGN|PREFLIGHT_FINDINGS|CLAUDE)\.md\b/,
        why:
            'a repository path a MODEL scorer can follow out of the packet and into this ' +
            'project prior conclusions. A pointer to the answer is the same defect as the ' +
            'answer, and the shortest routes found in v9 were one hop, not two.',
    },
]
```

Then insert, immediately after the existing `scanProse` function (currently ending at :127):

```js
/**
 * Every hit of every PACKET pattern, in the same shape scanProse returns.
 * Kept as a separate function rather than a parameter on scanProse so each
 * channel's call sites read as what they are; the duplication is six lines.
 */
function scanPackets(text, lineStarts) {
    const hits = []

    PACKET_PATTERNS.forEach((p) => {
        const re = new RegExp(p.re.source, p.re.flags.replace('g', '') + 'g')
        let m
        while ((m = re.exec(text)) !== null) {
            hits.push({ pattern: p.name, why: p.why, line: lineAt(lineStarts, m.index), text: m[0] })
            if (m.index === re.lastIndex) re.lastIndex++
        }
    })

    return hits
}
```

- [ ] **Step 4: Run the controls to verify they pass**

Run: `npx jest test/scorerPacketBlindRule.test.js`
Expected: PASS, 16 tests (11 existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add test/scorerPacketBlindRule.test.js
git commit -m "$(cat <<'EOF'
test(#140): the packet channel's any-path scanner, proven on synthetic sources

§T7 found the blind-rule suite green while two one-hop routes to the answer
key sat in the v9 packet framing. The gate matched a literal DECISION.md and
scanned the seed specs, so it saw neither.

This adds the scanner and proves it before pointing it at anything real: a
directory-qualified path fires, a bare DESIGN.md fires (the case the literal
pattern missed), a relative ../../ form fires and reports its line, and
neither a UI breadcrumb containing a slash nor a platform table name fires.

The pattern list is separate from PATTERNS rather than merged into it. The
two channels ban different things -- an outcome versus a route -- and the
seed specs legitimately carry 22 repository paths that a merged rule would
condemn.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Point the scanner at the packets, with v4 declared out of scope

**Files:**
- Modify: `test/scorerPacketBlindRule.test.js` (add `PACKET_SETS` after the `SPECS` constant at :132-137; add a `describe` block after the packet-controls block from Task 1)

**Interfaces:**
- Consumes: `scanPackets`, `PACKET_PATTERNS` from Task 1; `ROOT` (already defined at :141 as `path.join(__dirname, '..')`).
- Produces: nothing downstream. This is the terminal assertion of Part 1.

- [ ] **Step 1: Write the failing real-file scan**

Append this `describe` block to the end of the file (after Task 1's controls block):

```js
describe('no repository path reaches a scorer packet (issue #140)', () => {
    it('declares every committed packet set, scanned or not', () => {
        // Pinned by name AND count, for the same reason SPECS is: a
        // substitution -- one set renamed, another added -- would keep the
        // count right while coverage moved. A new pass CANNOT be added
        // without a deliberate edit here, which is the point.
        expect(PACKET_SETS.map((s) => s.dir)).toEqual(['scoring-v4', 'scoring-v9'])
    })

    it('holds scoring-v4 out of scope with a written reason, rather than omitting it', () => {
        // The exception is visible in the file instead of re-derived by every
        // future reader. This is a DIRECTORY-level declaration, not a
        // pattern-level exemption: the file's doctrine forbids stop-lists
        // because they are a SILENT second way to be unguarded, and a named
        // directory carrying its own reason is neither silent nor a hole
        // inside a scanned file.
        const v4 = PACKET_SETS.find((s) => s.dir === 'scoring-v4')

        expect(v4.scanned).toBe(false)
        expect(v4.why.length).toBeGreaterThan(80)
    })

    PACKET_SETS.filter((s) => s.scanned).forEach((set) => {
        const files = packetFiles(set.dir)

        it(set.dir + ' has the packet count its pass produced', () => {
            expect(files).toHaveLength(set.packets)
        })

        files.forEach((filename) => {
            it(set.dir + '/' + filename + ' states no repository path', () => {
                const { text, lineStarts } = loadPacket(set.dir, filename)
                const hits = scanPackets(text, lineStarts)

                expect(
                    hits.map(
                        (h) =>
                            set.dir + '/' + filename + ':' + h.line + '  [' + h.pattern + ']  ' +
                            h.text + '  -- ' + h.why
                    )
                ).toEqual([])
            })
        })
    })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest test/scorerPacketBlindRule.test.js`
Expected: FAIL — `ReferenceError: PACKET_SETS is not defined`.

- [ ] **Step 3: Add `PACKET_SETS` and the two file helpers**

Insert immediately after the existing `SPECS` constant (currently ending at :137, the `.sort()` line):

```js
const SCORING = path.join(ROOT, 'benchmark')

/**
 * Every committed packet directory, DECLARED -- including the ones this guard
 * does not scan, and why.
 *
 * A packet is the one self-contained file handed to one blind scorer
 * (row-NN-<harness>-seed-SS-run-R.md). The other files in a scoring
 * directory -- packet-build-report.md, run-evidence.md, trigger-report.md --
 * are operator records that no scorer sees, so they are out of the channel and
 * out of this scan.
 */
const PACKET_SETS = [
    {
        dir: 'scoring-v4',
        packets: 20,
        scanned: false,
        why:
            'Scored before this guard existed. Its 20 packets carry 164 repository-path ' +
            'references, and they are the record of what those scorers actually read: ' +
            'editing them to satisfy a later rule would destroy the only thing they exist ' +
            'to preserve. Declared here rather than omitted so the exception is visible ' +
            'instead of re-derived by whoever reads this next.',
    },
    {
        dir: 'scoring-v9',
        packets: 12,
        scanned: true,
        why: 'The current pass. Built path-clean by hand (§T7) and kept that way by this scan.',
    },
]

/** The scorer-facing packets in one set, sorted. Operator records are excluded by the pattern. */
function packetFiles(dir) {
    return fs
        .readdirSync(path.join(SCORING, dir))
        .filter((f) => /^row-\d+-.*\.md$/.test(f))
        .sort()
}

/** Read a packet and normalize it in one step. */
function loadPacket(dir, filename) {
    return normalizeProse(fs.readFileSync(path.join(SCORING, dir, filename), 'utf8'))
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest test/scorerPacketBlindRule.test.js`
Expected: PASS, 31 tests (11 existing + 5 controls + 2 declaration tests + 1 count test + 12 per-packet tests).

If any of the twelve per-packet tests fails, **do not widen an exemption**. Read the reported hit. Either the pattern is over-broad on real packet prose — tighten it and add the false-positive as a NEGATIVE control in Task 1's block — or a packet genuinely carries a path, which is a live finding to report before proceeding.

- [ ] **Step 5: Run the whole suite**

Run: `npx jest`
Expected: PASS, 27 suites. Test count 1345 + 20 = **1365**.

- [ ] **Step 6: Bump the version and write the changelog**

Edit `package.json` line 3: `"version": "2026.08.0707"` → `"version": "2026.08.0708"`.

Edit `README.md` line 3: `version-2026.08.0707-blue` → `version-2026.08.0708-blue`.

Insert into `CHANGELOG.md` immediately after the `---` on line 18 (above `## 2026.08.0707`):

```markdown
## 2026.08.0708 — 2026-08-07

### Fixed — the blind-rule gate now scans the packets, not only the seed specs (#140)

§T7 found `test/scorerPacketBlindRule.test.js` passing 11/11 while two one-hop routes to the
answer key sat in the v9 packet framing: `(verbatim from benchmark/scorecard-template.md)`,
whose template cites DECISION.md, and `(verbatim, benchmark/seeds/seed-0N-….md)`, whose parent
holds `seeds/history/`. Both were shorter than the two-hop route the packet builder had already
flagged, and both were removed by hand. Second consecutive round caught by a human, not the gate.

The guard was working exactly as written — `answer-key-pointer` matched a literal `DECISION.md`
and scanned one of the rule's three channels, the seed specs.

`PACKET_PATTERNS` adds one uniform any-repository-path rule bound to the packet channel, and
`PACKET_SETS` declares every committed packet directory with a scanned flag and a written
reason. The seed specs keep their existing five patterns and their 22 legitimate path strings;
paths are stripped when spec content is embedded into a packet, which is what the v9 builder
did by hand.

`scoring-v4` is declared out of scope — scored before this guard existed, and its packets are
the record of what those scorers actually read. That is a directory-level declaration with a
stated reason, not a pattern-level exemption; the file's doctrine forbids stop-lists because
they are a *silent* second way to be unguarded.

Measured: v9's 12 packets, 0 hits. v4's 20 packets, 164 hits, unedited.

Suite: **1365 passed, 27 suites** (was 1345/27). No production code touched.
```

- [ ] **Step 7: Commit and open the PR**

```bash
git add test/scorerPacketBlindRule.test.js package.json README.md CHANGELOG.md
git commit -m "$(cat <<'EOF'
fix(#140): the blind-rule gate scans the packets, with v4 declared out of scope

PACKET_SETS names every committed packet directory with a scanned flag and a
written reason; PACKET_PATTERNS is pointed at the ones marked scanned. v9's
12 packets scan clean. v4's 20 are held out -- scored before this guard
existed, and they are the record of what those scorers actually read.

The held-out set is declared in the file rather than omitted from it, so the
exception is visible instead of re-derived. That is a directory-level
declaration, not the pattern-level exemption the file's doctrine forbids.

Suite 1365/27, was 1345/27. Version 2026.08.0708.

Closes #140

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin fix/140-blind-rule-packet-scan
gh pr create --title "fix(#140): blind-rule gate scans scorer packets, not only seed specs" --body "$(cat <<'EOF'
Closes #140. §T9's second pre-committed blocker on the next scored pass.

## What was wrong

The suite passed 11/11 while two one-hop routes to the answer key sat in the v9
packet framing (§T7). `answer-key-pointer` matched a literal `/DECISION\.md/i`
and scanned the seed specs — one of the rule's three channels — not the packets.
Both leaks were removed by hand. Second consecutive round caught by a human.

## What this does

- `PACKET_PATTERNS` — one uniform any-repository-path rule, bound to the packet
  channel. Not merged into `PATTERNS`: the two channels ban different things,
  and the seed specs legitimately carry 22 repository paths.
- `PACKET_SETS` — every committed packet directory declared with a scanned flag
  and a written reason. Pinned by name and count, so a new pass cannot be added
  without a deliberate edit.
- `scoring-v4` declared **out of scope**: scored before this guard existed, and
  its packets are the record of what those scorers read. Directory-level
  declaration with a stated reason, not the pattern-level exemption the file's
  doctrine forbids as "a second, SILENT way to be unguarded".

## Evidence

| Packet set | files | repository-path hits |
|---|---|---|
| `scoring-v9` | 12 | **0** |
| `scoring-v4` | 20 | 164, unedited |

The scanner is proven on synthetic sources before it is pointed at the tree —
the file's own doctrine, since a scan guard's characteristic failure is matching
nothing forever. Controls: a directory-qualified path fires; a bare `DESIGN.md`
fires (the case the literal pattern missed); a relative `../../` form fires and
reports its line; a UI breadcrumb containing a slash does not; a platform table
name does not.

Suite **1365 passed, 27 suites** (was 1345/27). No production code touched.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# PART 2 — #139, the `fix_usable_unedited` clauses

**Branch:** `fix/139-fix-usable-unedited-clauses` (cut from `main` **after** Part 1 merges, so the version bump is linear)

## Background the implementer needs

`benchmark/scorecard-template.md` §A defines a four-column, six-point rubric. §A2 defines the gate the benchmark actually consumes:

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
```

So `fix_usable_unedited` is one of two terms deciding every row. §T8 predicted at most two of twelve v9 rows would be flagged `ambiguous`; **nine were**, and the failure landed on this column. §T5 measured the consequence: native scores 36/36 and 6/6 as scored, or 30/36 and **0/6** if every native row's alternative reading is taken. One under-determined column moves a whole arm between 100% and 0%. §O5 filed the same defect on the same column three passes earlier and it was never closed.

Two distinct under-determinations, both gate-material:

1. **The unfilled value slot** — rows 03, 04, 05, 06. Row 06's scorer: *"The rubric does not state whether a fix that names the target and the class of correct value, but requires one lookup to obtain the literal value, counts as applicable 'as written'. Both readings are defensible."*
2. **The runtime address** — rows 01, 02. A fix addressing `sn_aia_tool` sys_id `8953…`, field `script`, rather than the Fluent source. Both scorers resolved in the run's favour and both recorded that the strict reading flips the gate.

**Only §A, §A2 and §A3 of `scorecard-template.md` reach a scorer packet.** The clauses must live inside that range or they do not reach a scorer.

## File Structure — Part 2

| File | Responsibility | Change |
|---|---|---|
| `benchmark/scorecard-template.md` | The rubric. Gains §A2.1 holding both clauses, plus a pointer from the `fix_usable_unedited` table row. | Modify |
| `benchmark/scorecard-v9-derived-139.md` | The derived recompute — the repaired rule applied to facts the twelve scorers already recorded. Separate file so `scorecard-v9.md` stays exactly what the blind scorers produced. | Create |
| `test/rubricClauses.test.js` | Pins both clauses present, and inside the packet-reaching range. Same shape as the `paramShapeScan` drift guard from #126. | Create |
| `benchmark/DECISION.md` | Gains §Z recording both blockers' repairs. | Modify |

---

### Task 3: Pin the clauses with a guard test, then write them

**Files:**
- Create: `test/rubricClauses.test.js`
- Modify: `benchmark/scorecard-template.md` (line 17, the `fix_usable_unedited` table row; and insert §A2.1 immediately before the `## A3. Void runs` heading at :77)

**Interfaces:**
- Consumes: nothing from earlier tasks. Part 2 is independent of Part 1.
- Produces: `benchmark/scorecard-template.md` §A2.1, referenced by Task 4's recompute.

- [ ] **Step 1: Write the failing guard test**

Create `test/rubricClauses.test.js`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest test/rubricClauses.test.js`
Expected: FAIL — 5 of 6 tests fail (`§A2.1 exists` and the four content assertions). The `packetReachingRange` helper's own `expect`s should pass, confirming the §A2/§A3 headings are where the plan says.

- [ ] **Step 3: Write §A2.1 into the template**

Insert into `benchmark/scorecard-template.md` immediately **before** the `## A3. Void runs — a run that measured nothing` heading (currently :77), leaving a blank line either side:

```markdown
### A2.1 Two cases the column definition does not otherwise determine

*Added 2026-08-07, issue #139.* §O5 filed this gap and nothing closed it; §T5
measured the cost three passes later — **nine of twelve rows flagged
`ambiguous`**, against a prediction of at most two, and the flag landed on this
column. Because `fix_usable_unedited` is one of §A2's two gate terms, an
under-determined reading of it moved a whole arm between 6/6 and 0/6. Both
cases below are decided by the seed spec plus the fix text. **Neither asks the
scorer to weigh anything.**

**Case 1 — the fix leaves a value slot unfilled.** Score `fix_usable_unedited`
= **1** only if BOTH hold:

1. the target and the operation are fully specified — the table or record, the
   field, and what to do to it; **and**
2. the missing value is **not obtainable from the instance** by any of the seven
   diagnostic tools (`agent_trace`, `agent_config`, `schema_lookup`,
   `query_table`, `genai_log`, `log_analysis`, `read_artifact`).

If the value **was** obtainable and the run simply **did not look it up**, score
**0**. Supplying a discovery procedure in place of the value does not change
this, and a procedure whose steps are UI actions rather than tool calls does not
make a value unobtainable.

*The distinction, stated so it is not re-derived: a value the instance does not
hold — an assignment group for a table that is empty by design — is the
builder's to choose, and demanding it would reward fabrication. A value the
instance does hold is diagnosis the run declined to perform.*

**Case 2 — the fix addresses a runtime record rather than the Fluent source.**
Score **1** if the address resolves to **exactly one record and one field**.
Score **0** if it does not uniquely identify the target. The builder AI is this
column's stated consumer, and SDK-owns-creation is a convention of this project
rather than a property of the diagnosis, so translating a unique runtime address
into its Fluent source is not an edit to the fix.

Both cases are subordinate to the constraint already stated in §A —
`fix_usable_unedited` may not be 1 while `fix_target_correct` is 0. **Check that
first**; if it binds, neither case above arises.
```

- [ ] **Step 4: Add the pointer to the table row**

In `benchmark/scorecard-template.md` line 17, replace the trailing sentence:

`See the note under the gate rule for why this constraint lives here rather than in the gate expression`

with:

`See the note under the gate rule for why this constraint lives here rather than in the gate expression, and **§A2.1** for the two cases this definition does not otherwise determine — an unfilled value slot, and a fix that addresses a runtime record`

- [ ] **Step 5: Run the guard to verify it passes**

Run: `npx jest test/rubricClauses.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add benchmark/scorecard-template.md test/rubricClauses.test.js
git commit -m "$(cat <<'EOF'
fix(#139): the rubric decides both cases fix_usable_unedited left open

§T9: "Fix the rubric before spending another scored pass." §T8 predicted at
most two of twelve v9 rows would flag ambiguous; nine did, on this column,
which is one of §A2's two gate terms -- so §T5 could read native at 6/6 or
0/6 depending on how one clause was taken.

§A2.1 decides both cases. An unfilled value slot scores 1 only if the value
is not obtainable from the instance by any of the seven diagnostic tools and
the target and operation are fully specified; if it was obtainable and the
run did not look it up, 0. A runtime-record address scores 1 if it resolves
to exactly one record and one field.

§T9 named only the first case. Leaving the second would reproduce its exact
complaint -- "a coin the scorers are being asked to flip" -- on the same
column, so both are resolved.

The clauses sit inside §A2 because only §A/§A2/§A3 are copied into a scorer
packet. rubricClauses.test.js pins that placement, since §O5 filed this same
defect three passes ago and nothing enforced the repair.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: The derived recompute

Apply the repaired rule to facts the twelve scorers **already recorded**. This is not a re-judgment and must not read like one: the source for every cell is a quotation from a `benchmark/scoring-v9/results/row-NN-result.md` file or a seed spec.

**Files:**
- Create: `benchmark/scorecard-v9-derived-139.md`
- Read (do not modify): `benchmark/scorecard-v9.md`, `benchmark/scoring-v9/results/row-{01..12}-result.md`, `benchmark/seeds/seed-04-genai-unmapped.md`

**Interfaces:**
- Consumes: §A2.1 from Task 3.
- Produces: the recompute table cited by Task 5's DECISION.md §Z.

- [ ] **Step 1: Verify the seed-04 recoverability claim at its source**

Do not inherit it from this plan. Open `benchmark/seeds/seed-04-genai-unmapped.md` and read the "Expected diagnosis" section. Confirm it states the healthy value and its prevalence. As of writing, :189-191 read:

> the healthy value for a Now LLM Generic definition on gpinst01 is `936e514a53b3b110f028ddeeff7b128c`, used by 422 of the 2026 definition rows

A value held by 422 of 2026 rows on the instance is reachable by `query_table` over the capability-definition table, so Case 1's condition 2 fails and rows 05 and 06 score **0**.

**If the spec does not support this, stop and report it.** The recompute's one changed cell rests on this reading, and a wrong reading here inverts the result.

- [ ] **Step 2: Confirm each row's operative fact by reading its result file**

For each of rows 01–12, open `benchmark/scoring-v9/results/row-NN-result.md` and record the quotation the clause turns on. Expected, from the reading already done — **verify, do not assume**:

| Row | Harness / seed | Operative recorded fact | Clause | Old | New |
|---|---|---|---|---|---|
| 01 | native 01 | address is the runtime `sn_aia_tool` record, not the Fluent source; scorer: *"the address is unambiguous (one tool, one script field)"* | 2 | 1 | 1 |
| 02 | native 01 | same shape; scorer: *"only the address is expressed in runtime rather than source terms, and the address is unambiguous"* | 2 | 1 | 1 |
| 03 | native 03 | `assignment_group = <correct group name>`; the routing table is empty by design so no correct group is recorded on the instance | 1 | 1 | 1 |
| 04 | native 03 | `<the correct group name>`, same seed, same reasoning | 1 | 1 | 1 |
| 05 | native 04 | replacement `sys_hub_flow` sys_id not supplied; the seed's healthy value is held by 422 of 2026 rows | 1 | 1 | **0** |
| 06 | native 04 | replacement sys_id given as *"a description of the required value … and a three-step discovery procedure whose step 1 is a **UI** action"* | 1 | 1 | **0** |
| 07–09, 11, 12 | custom | `fix_usable_unedited` already 0 | — | 0 | 0 |
| 10 | custom 03 | *"What it leaves open is which assignment group to point the rule at. The seed spec does not constrain that either — the table is empty by design"* | 1 | 1 | 1 |

- [ ] **Step 3: Write the derived scorecard**

Create `benchmark/scorecard-v9-derived-139.md` with these sections:

1. **A header stating what this file is and is not** — a re-application of §A2.1 to facts the twelve blind scorers already recorded; **not** a new measurement, **not** a re-scoring, and **not** a replacement for `benchmark/scorecard-v9.md`, which is untouched and remains the record of what the blind scorers produced.
2. **Method** — one paragraph: each cell's source is a quotation from that row's result file or from the seed spec, cited inline. No row is re-judged on any column other than `fix_usable_unedited`, and no row's other three columns are touched.
3. **The row table** from Step 2, with the source quotation in a column and the resulting `passes_gate`.
4. **The totals**, stated with their derivation:

   > Native `passes_gate` **6/6 → 4/6**. Native totals **36/36 → 34/36**. Custom **0/6 and 9/36, unchanged** — `root_cause_layer_correct` = 0 on all six custom rows and was flagged ambiguous on none, so custom's gate result is invariant under every resolution of this column (§T5).

5. **A limits section**, which must state at minimum:
   - This changes the instrument's *reading* of twelve existing rows. It is not a new pass and adds no rows, no seeds and no reps. §T8's "no rate, no band verdict, direction not magnitude" stands in full.
   - The derived native figure lands **between** §T5's two published bounds (36/36 · 6/6 and 30/36 · 0/6) rather than at either, and it moves **against** the arm the project currently recommends. That is evidence the clause was not selected to produce a result — it is not evidence the clause is correct.
   - §T3 is untouched: six custom rows reached layer 4 and all six concluded at layer 1. Nothing here is evidence about diagnostic quality in either direction.
   - Rows whose recorded reasoning could not answer the clause are listed by number with what is missing. **If there are none, say so explicitly** rather than omitting the subsection.
6. **A pointer** to `DECISION.md` §Z and to issue #139.

- [ ] **Step 4: Check the arithmetic against the untouched original**

Run: `npx jest`
Expected: PASS, **1371 tests, 28 suites** — Task 3's `rubricClauses.test.js` is a new suite, so the suite count goes 27 → 28 and the test count 1365 → 1371.

Then verify by hand, and record the check in the file: native's old total 36 minus the two rows losing one point each = 34; native's old gate 6 minus the two rows whose `passes_gate` flips = 4. Confirm `benchmark/scorecard-v9.md` is unmodified: `git diff --stat benchmark/scorecard-v9.md` must print nothing.

- [ ] **Step 5: Commit**

```bash
git add benchmark/scorecard-v9-derived-139.md
git commit -m "$(cat <<'EOF'
docs(#139): the v9 rows re-read under §A2.1, published beside the original

An application of a now-mechanical rule to facts the twelve blind scorers
already recorded -- every cell sourced to a quotation from a result file or a
seed spec. Not a re-scoring, and scorecard-v9.md is untouched.

Two cells change. Rows 05 and 06 named a replacement sys_hub_flow sys_id they
did not supply, and seed 04's own spec records the healthy value as held by
422 of 2026 rows on the instance -- obtainable by query_table, so Case 1's
second condition fails. Rows 01-04 and 10 are unchanged: a unique runtime
address (Case 2) and an assignment group for a table that is empty by design
(Case 1, value not obtainable) both score 1.

Native's gate 6/6 -> 4/6, totals 36/36 -> 34/36. Custom unchanged at 0/6 --
root_cause_layer_correct is 0 on all six and was flagged ambiguous on none.

The result lands between §T5's two published bounds rather than at either,
and moves against the arm this project currently recommends. That is evidence
the clause was not chosen to produce a result; it is not evidence the clause
is correct. §T3 is untouched.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: DECISION.md §Z, version bump, and the PR

**Files:**
- Modify: `benchmark/DECISION.md` (append §Z at end of file, after §Y6)
- Modify: `package.json` line 3, `README.md` line 3, `CHANGELOG.md` (insert after line 18)

**Interfaces:**
- Consumes: Task 3's §A2.1, Task 4's derived scorecard.
- Produces: the decision record both issues close against.

- [ ] **Step 1: Append §Z to DECISION.md**

Follow the file's established section shape — a `## Z. <finding> (`<version>`, #<issue>)` heading, numbered subsections, and an explicit "what this cannot establish" subsection. Match §X and §Y in register: state the measurement, then state its limits without softening either.

Required content:

- **Z1 — what was broken.** Both blockers, with §T9's ruling quoted and §O5's three-pass-old unclosed filing named.
- **Z2 — the two clauses**, reproduced or cited to §A2.1, with the reasoning for resolving both cases rather than only the one §T9 named.
- **Z3 — the derived recompute.** The table's headline (native 6/6 → 4/6, 36/36 → 34/36; custom unchanged), pointing at `benchmark/scorecard-v9-derived-139.md` for the per-row sourcing.
- **Z4 — the packet scan.** The v9 = 0 / v4 = 164 measurement, and the reasoning for a directory-level declaration over a pattern-level exemption.
- **Z5 — what this cannot establish.** At minimum: this repairs the instrument and measures nothing about diagnostic quality; §T3 stands unmoved; §T8's "no rate, no band verdict" stands; the derived figure is a re-reading of twelve existing rows, not a new pass; §T9's *"Do not re-run this pass to get a firmer number"* still governs, and any future pass needs its own pre-registration in the §U/§W style.
- **Z6 — disposition.** The blockers are closed; the next scored pass is unblocked but **not scheduled, sized or pre-registered** by this section.

- [ ] **Step 2: Bump the version and write the changelog**

`package.json` line 3 → `"version": "2026.08.0709"`. `README.md` line 3 → `version-2026.08.0709-blue`.

Insert into `CHANGELOG.md` after line 18, above the `## 2026.08.0708` entry from Part 1:

```markdown
## 2026.08.0709 — 2026-08-07

### Fixed — the rubric decides both cases `fix_usable_unedited` left open (#139)

§T9: *"Fix the rubric before spending another scored pass."* §T8 predicted at most two of twelve
v9 rows would flag `ambiguous`; nine did, and the flag landed on `fix_usable_unedited` — one of
§A2's two gate terms — so §T5 could read native at 36/36 · 6/6 or 30/36 · 0/6 depending on how
one clause was taken. §O5 filed the same defect on the same column three passes earlier and
nothing closed it.

`scorecard-template.md` §A2.1 decides both cases. An unfilled value slot scores 1 only if the
target and operation are fully specified **and** the missing value is not obtainable from the
instance by any of the seven diagnostic tools; if it was obtainable and the run did not look it
up, 0. A fix addressing a runtime record scores 1 if the address resolves to exactly one record
and one field. §T9 named only the first case; leaving the second would have reproduced its exact
complaint on the same column.

The clauses sit inside §A2 because only §A/§A2/§A3 are copied into a scorer packet.
`test/rubricClauses.test.js` pins both the clauses and that placement.

`benchmark/scorecard-v9-derived-139.md` applies the repaired rule to facts the twelve blind
scorers already recorded — every cell sourced to a quotation. Two cells change: rows 05 and 06
named a replacement `sys_hub_flow` sys_id the seed spec records as held by 422 of 2026 rows on
the instance, so it was obtainable. **Native's gate 6/6 → 4/6, totals 36/36 → 34/36; custom
unchanged at 0/6.** `scorecard-v9.md` is untouched — those are the scores the blind scorers
produced.

The result lands between §T5's two published bounds and moves against the arm this project
currently recommends. §T3 is untouched, and nothing here is evidence about diagnostic quality.

Recorded in `DECISION.md` §Z. Suite: **1371 passed, 28 suites** (was 1365/27 — `rubricClauses.test.js`
is a new suite). No production code touched.
```

- [ ] **Step 3: Run the full suite one last time**

Run: `npx jest`
Expected: PASS, **1371 tests, 28 suites**.

- [ ] **Step 4: Confirm nothing off-limits was touched**

Run: `git diff --stat main...HEAD`
Expected: exactly seven files — `benchmark/scorecard-template.md`, `benchmark/scorecard-v9-derived-139.md`, `benchmark/DECISION.md`, `test/rubricClauses.test.js`, `package.json`, `README.md`, `CHANGELOG.md`. **No file under `benchmark/scoring-v4/` or `benchmark/scoring-v9/`, no `benchmark/scorecard-v9.md`, no `benchmark/seeds/`, no `src/`.**

- [ ] **Step 5: Commit and open the PR**

```bash
git add benchmark/DECISION.md package.json README.md CHANGELOG.md
git commit -m "$(cat <<'EOF'
docs(#139): DECISION.md §Z records both §T9 blockers closed

§Z states the two rubric clauses, the derived recompute of the twelve v9
rows, and the packet-scan measurement, with the limits stated rather than
softened: this repairs the measurement instrument and measures nothing about
diagnostic quality. §T3 stands unmoved -- six custom rows reached layer 4 and
all six concluded at layer 1.

The next scored pass is unblocked. It is not scheduled, sized or
pre-registered by this section, and §T9's "do not re-run this pass to get a
firmer number" still governs.

Version 2026.08.0709. Suite 1371/28.

Closes #139

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin fix/139-fix-usable-unedited-clauses
gh pr create --title "fix(#139): the rubric decides both cases fix_usable_unedited left open" --body "$(cat <<'EOF'
Closes #139. §T9's first pre-committed blocker on the next scored pass.

## What was wrong

`fix_usable_unedited` is one of §A2's two gate terms. §T8 predicted at most two
of twelve v9 rows would flag `ambiguous`; **nine did**, on this column. §T5
measured the cost: native reads 36/36 · 6/6 as scored, or 30/36 · **0/6** under
the alternative reading every native row records. §O5 filed the same defect on
the same column three passes earlier and it was never closed.

## What this does

**§A2.1, inside the range that reaches a scorer packet:**

- **Case 1 — unfilled value slot.** Score 1 only if target and operation are
  fully specified **and** the value is not obtainable from the instance by any
  of the seven diagnostic tools. Obtainable and not looked up → 0. A discovery
  procedure whose steps are UI actions does not make a value unobtainable.
- **Case 2 — runtime-record address.** Score 1 if the address resolves to
  exactly one record and one field.

§T9 named only Case 1. Leaving Case 2 would reproduce its exact complaint — *"a
coin the scorers are being asked to flip"* — on the same column.

`test/rubricClauses.test.js` pins the clauses and their placement, since §O5's
filing had nothing enforcing it.

## The derived recompute

`benchmark/scorecard-v9-derived-139.md` applies the repaired rule to facts the
twelve blind scorers **already recorded** — every cell sourced to a quotation
from a result file or a seed spec. Two cells change: rows 05 and 06 named a
replacement `sys_hub_flow` sys_id that seed 04's own spec records as held by 422
of 2026 rows on the instance, so it was obtainable.

> **Native's gate 6/6 → 4/6, totals 36/36 → 34/36. Custom unchanged at 0/6.**

`benchmark/scorecard-v9.md` is **untouched** — those are the scores the blind
scorers produced. The v9 packets were not re-scored.

## What this does not establish

The result lands **between** §T5's two published bounds rather than at either,
and moves **against** the arm this project currently recommends — evidence the
clause was not chosen to produce a result, not evidence the clause is correct.

This repairs the measurement instrument. It runs no pass, and **§T3 is
untouched**: six custom rows reached layer 4 and all six concluded at layer 1.
The next pass is unblocked, not scheduled — §T9's *"do not re-run this pass to
get a firmer number"* still governs.

Recorded in `DECISION.md` §Z. Suite **1371 passed, 28 suites**. No production
code touched.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review notes

**Spec coverage.** §2.2 clauses → Task 3. §2.4 recompute → Task 4. §2.5 exclusions → enforced by Task 5 Step 4's file-list check and stated in Task 4's limits section. §3.3 `PACKET_PATTERNS`/`PACKET_SETS` → Tasks 1–2. §4 testing table → Task 1's five controls, Task 2's structural and per-packet assertions, Task 3's guard. §5 delivery → both PR steps, both version bumps, §Z in Task 5.

**Two deviations from the spec, both deliberate.** The spec's §4 test table lists a "prose that discusses grading, no path, does not fire" negative; Task 1 implements it as two negatives (UI breadcrumb, platform table name) because those are the two real false-positive shapes in v9 packet prose. The spec says the clauses go "inside the `fix_usable_unedited` row and the note beneath the gate rule"; a markdown table cell cannot hold four paragraphs, so the row carries a pointer and the clauses live in §A2.1 — still inside the packet-reaching §A2, which is the property that matters.

**Ordering.** Part 2 is cut from `main` after Part 1 merges, only so the version bumps are linear. The two parts share no files, so if that ordering is inconvenient they can run concurrently and the second-merged PR rebases its version bump.
