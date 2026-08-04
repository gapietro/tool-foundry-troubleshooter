# Scorer Packet Blind Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a seed spec safe to hand to a blind scorer by default, with a guard that fails the build when a prior run's behaviour or grade appears in scorer-facing text.

**Architecture:** Each of the five seed specs is split into a wholly scorer-facing `seed-0N-*.md` and a sibling `seed-0N-*.history.md` holding the prior-pass narrative. A new guard, `test/scorerPacketBlindRule.test.js`, scans the scorer-facing specs for phrase patterns naming what a prior run did or scored. It cannot reuse `blindRule.test.js`'s per-line matcher, so it ships with a shared prose normalizer that strips blockquote markers and joins wrapped lines while preserving a line map.

**Tech Stack:** Node, Jest 29.7.0 (`npm test`). No product code, no ServiceNow instance access, no build or deploy. Docs and tests only.

**Spec:** `docs/superpowers/specs/2026-08-03-scorer-packet-blind-rule-design.md`

## Global Constraints

- **Branch:** `fix/scorer-packet-blind-rule`, already created off `main`. Never commit to `main`; ship via PR (`CLAUDE.md` → Development Workflow).
- **Issue:** #100. Every commit message references it.
- **Classification rule, applied to every judgement call in this plan:** *scorer-facing* = the fixture's own state, however it was learned. *History* = what a prior diagnostic run did, proposed, or was awarded.
- **Links run history → spec only, never spec → history.** A pointer from the spec is an invitation to read what was just removed.
- **No score anywhere in the repo moves.** No row is re-scored, no packet re-issued, no file under `benchmark/scoring-v4/` edited.
- **`benchmark/DECISION.md` is not edited.** §O8's queue bullet is a dated record.
- **Version after merge:** `2026.08.0303` (current `2026.08.0302`), in `package.json` and the `README.md` badge.
- **The full suite must be green at the end of every task except Task 1**, which commits a deliberately red guard so the red state is in the branch history.

---

### Task 1: The prose normalizer and the guard, committed red

**Files:**
- Create: `test/_normalizeProse.js`
- Create: `test/scorerPacketBlindRule.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `normalizeProse(source) -> { text: string, lineStarts: number[] }` and `lineAt(lineStarts, offset) -> number` from `test/_normalizeProse.js`. `test/scorerPacketBlindRule.test.js` exports nothing; later tasks only run it.

- [ ] **Step 1: Write the prose normalizer**

Create `test/_normalizeProse.js`:

```js
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
 * "earning full - not partial - fix-target credit" is split across lines 21-22;
 * a per-line scanner misses it entirely and reports GREEN over a live leak,
 * which is the silent under-coverage this class of guard exists to prevent.
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
 * Strip one leading blockquote marker per line, join with a single space, and
 * record where each line starts in the joined string.
 */
function normalizeProse(source) {
    const lineStarts = []
    let cursor = 0

    const lines = source.split('\n').map((line) => {
        const stripped = line.replace(/^\s*>\s?/, '')
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
```

- [ ] **Step 2: Write the guard**

Create `test/scorerPacketBlindRule.test.js`:

```js
/**
 * The blind rule binds every channel that reaches a SCORER, not only the
 * channels that reach the harness (issue #100).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS, AND WHY IT IS NOT PART OF blindRule.test.js
 * ---------------------------------------------------------------------------
 * blindRule.test.js protects the measurement SUBJECT: it keeps the seeded
 * answer out of anything the harness can put in front of the model. This file
 * protects the measurement INSTRUMENT: it keeps a prior run's behaviour and
 * grade out of anything a blind scorer reads.
 *
 * Both became necessary at different times. The first mattered from the
 * beginning. The second only mattered from v3, when scoring moved from a human
 * operator to independent blind agents whose packets embed the seed spec
 * verbatim -- at which point four of five specs were narrating what earlier
 * runs had scored, including literal grades ("scored 6/6", "2/6, fail",
 * "earning full -- not partial -- fix-target credit").
 *
 * ---------------------------------------------------------------------------
 * HOW A PATTERN IS CHOSEN
 * ---------------------------------------------------------------------------
 * A pattern names a PRIOR RUN'S OUTCOME, not the vocabulary of grading.
 *
 *   DECLARE   past-tense, run-subject phrasing -- "both scored runs",
 *             "run 2 named", "scored 6/6", "earning full ... credit".
 *   DO NOT    scoring GUIDANCE, which a seed spec is entitled to give:
 *             "a decoy hit scores 2/0/1/0", "must not be scored as a hit",
 *             "would have been scored a miss". These are rules and
 *             hypotheticals, not reports of what happened.
 *
 * As in blindRule.test.js there is deliberately NO stop-list and no
 * generic-word exemption. A pattern too broad simply reddens the suite, and
 * that failure IS the signal to write a better pattern. An exemption would be
 * a second, SILENT way to be unguarded.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD DOES NOT COVER
 * ---------------------------------------------------------------------------
 * The rule binds three channels (benchmark/README.md, "The scorer blind
 * rule"); this guard scans one of them. The rubric channel is
 * benchmark/scorecard-template.md, of which only sections A/A2/A3 reach a
 * packet, and the file legitimately explains grading with score-shaped text
 * ("a run can score 3/6 and pass") -- a whole-file scan would be a
 * false-positive machine, and a section-scoped scan would pin the template's
 * heading structure into a test for no measured benefit. The run-report
 * channel is per-row prose written fresh each pass. Both are bound by the
 * rule and neither is scanned here. A passing suite is not evidence of
 * blindness; it is evidence the declared patterns did not fire.
 */

const fs = require('fs')
const path = require('path')
const { normalizeProse, lineAt } = require('./_normalizeProse')

const ROOT = path.join(__dirname, '..')
const SEEDS = path.join(ROOT, 'benchmark', 'seeds')

/**
 * The scorer-facing seed specs. `.history.md` siblings hold what was removed
 * from them and are deliberately NOT scanned -- they are never copied into a
 * packet, which is the whole point of the split.
 */
const SPECS = fs
    .readdirSync(SEEDS)
    .filter((f) => /^seed-\d+-.*\.md$/.test(f) && !/\.history\.md$/.test(f))
    .sort()

const PATTERNS = [
    {
        name: 'scored-a-number',
        re: /scored\s+(?:the\s+canonical\s+)?\d/i,
        why: 'a literal grade awarded to a prior run -- "scored 6/6", "scored the canonical 2/0/1/0"',
    },
    {
        name: 'scored-runs-or-rows',
        re: /scored\s+(?:runs?|rows?)\b/i,
        why: 'names the prior scored runs as a group -- "both scored runs", "2 scored rows are void"',
    },
    {
        name: 'run-N-did',
        re: /\b(?:run|rows?)\s+[12]\s+(?:found|named|diagnosed|proposed)\b/i,
        why: 'what an individual prior run concluded -- "run 2 named the empty connection"',
    },
    {
        name: 'credit-awarded',
        re: /earning\s+(?:full|partial)[^.]{0,60}credit/i,
        why: 'the exact credit level a prior run was awarded, which is the grade the scorer is about to assign',
    },
    {
        name: 'rubric-fraction',
        re: /\d\s*\/\s*6\b/,
        why: 'a score out of the rubric total -- "2/6, fail"',
    },
    {
        name: 'answer-key-pointer',
        re: /DECISION\.md/i,
        why:
            'a relative link a MODEL scorer can follow into the most concentrated answer key in ' +
            'the repo. A pointer to the answer is the same defect as the answer. ' +
            '../scorecard-template.md refs are fine -- the rubric is already in the packet.',
    },
]

/**
 * Every hit of every pattern, as {pattern, line, text}. Pure -- no file I/O --
 * so the controls below exercise THE REAL MATCHER on planted prose.
 */
function scanProse(text, lineStarts) {
    const hits = []

    PATTERNS.forEach((p) => {
        const re = new RegExp(p.re.source, p.re.flags + 'g')
        let m
        while ((m = re.exec(text)) !== null) {
            hits.push({ pattern: p.name, line: lineAt(lineStarts, m.index), text: m[0] })
            if (m.index === re.lastIndex) re.lastIndex++
        }
    })

    return hits
}

/** Read a seed spec and normalize it in one step. */
function load(filename) {
    return normalizeProse(fs.readFileSync(path.join(SEEDS, filename), 'utf8'))
}

describe('no prior run outcome reaches a scorer-facing seed spec (issue #100)', () => {
    it('scans every scorer-facing spec -- five of them', () => {
        // Pinned by name as well as by count: a substitution (one spec renamed,
        // another added) would keep the count at five while coverage moved, and
        // a `.history.md` glob that grew too greedy would silently drop a real
        // spec from the roster. Both are the silent-under-coverage failure this
        // guard exists to prevent.
        expect(SPECS).toEqual([
            'seed-01-schema-mismatch.md',
            'seed-02-ambiguous-instruction.md',
            'seed-03-missing-data.md',
            'seed-04-genai-unmapped.md',
            'seed-05-inactive-usecase.md',
        ])
    })

    SPECS.forEach((filename) => {
        it(filename + ' states no prior run outcome', () => {
            const { text, lineStarts } = load(filename)
            const hits = scanProse(text, lineStarts)

            expect(
                hits.map((h) => filename + ':' + h.line + '  [' + h.pattern + ']  ' + h.text)
            ).toEqual([])
        })
    })
})

describe('the scanner itself works (controls)', () => {
    it('POSITIVE: catches a leak split across a line break inside a blockquote', () => {
        // The exact shape a per-line scanner misses, and the reason
        // _normalizeProse.js exists. If normalization ever regresses, this
        // fails HERE rather than turning the main scan silently green.
        const { text, lineStarts } = normalizeProse(
            '> named the specific gate with the m2m link verified intact, earning\n' +
                '> full - not partial - fix-target credit, and both flagged the empty\n'
        )

        expect(scanProse(text, lineStarts).map((h) => h.pattern)).toContain('credit-awarded')
    })

    it('POSITIVE: catches a literal grade', () => {
        const { text, lineStarts } = normalizeProse('ruled out) and scored 6/6.')
        const hits = scanProse(text, lineStarts).map((h) => h.pattern).sort()

        expect(hits).toEqual(['rubric-fraction', 'scored-a-number'])
    })

    it('NEGATIVE: present-tense scoring guidance does not fire', () => {
        // "a decoy hit scores 2/0/1/0" is a RULE the spec is entitled to give.
        // Only the past-tense report of a run having scored it is a leak.
        const { text, lineStarts } = normalizeProse('a decoy hit scores the canonical 2/0/1/0 row.')

        expect(scanProse(text, lineStarts)).toEqual([])
    })

    it('NEGATIVE, real file: seed 04 keeps its decoy guidance and still scans clean', () => {
        // This is the falsifiable core of issue #100's fix: it distinguishes
        // redacting the leak from lobotomising the packet. Both sentences are
        // scoring guidance a scorer NEEDS; both must survive every rewrite.
        const { text, lineStarts } = load('seed-04-genai-unmapped.md')

        expect(text).toContain('must not be scored as a hit')
        expect(text).toContain('would have been scored a **miss**')
        expect(scanProse(text, lineStarts)).toEqual([])
    })

    it('NEGATIVE, real file: seed 01 keeps its fixture ground truth and still scans clean', () => {
        // `priority_stored` = `null` was measured during a prior pass, and is
        // FIXTURE STATE rather than a run outcome. A scorer cannot judge a
        // seed-01 diagnosis without it. Pinned so a future redaction sweep
        // cannot take it by mistake.
        const { text, lineStarts } = load('seed-01-schema-mismatch.md')

        expect(text).toContain('`priority_stored` = `null`')
        expect(scanProse(text, lineStarts)).toEqual([])
    })
})
```

- [ ] **Step 3: Run the guard and confirm it is red with exactly the filed hits**

Run: `npx jest test/scorerPacketBlindRule.test.js 2>&1 | tee /tmp/scorer-guard-red.txt`

Expected: **FAIL**. Four of the five per-spec tests fail (seed 01 passes), plus the two real-file negative controls fail for seeds 01 and 04 — seed 04 because the file still has hits, seed 01 because `scanProse` finds nothing but the *other* specs' failures do not affect it (seed 01's control should PASS at this point; if it fails, the normalizer is wrong, not the specs).

The design filed the red state in advance. Confirm the reported hits are exactly these **14**:

| Spec | Pattern-hits | Reported as |
|---|---|---|
| seed 01 | 0 | — |
| seed 02 | 3 | `scored runs` (:41), `2/6` (:42), `DECISION.md` (:43) |
| seed 03 | 3 | `scored runs` (:16), `scored 6` (:18), `6/6` (:18) |
| seed 04 | 5 | `scored runs` (:20), `run 1 found` (:20), `run 2 named` (:22), `scored the canonical 2` (:23), `DECISION.md` (:24) |
| seed 05 | 3 | `scored runs` (:20), `earning full — not partial — fix-target credit` (:22), `scored rows` (:79) |

**13 distinct leak locations, 14 pattern-hits.** The counts differ because every pattern is scanned independently: seed 03's `scored 6/6` is one sentence tripping both `scored-a-number` and `rubric-fraction`. The guard prints pattern-hits, so 14 is what a red run reports.

**Anything other than these 14 means the implementation drifted from the design. Stop and report it rather than adjusting the expectation.**

*(This number was 9, then 11, in earlier drafts — miscounted prose beside correct tables, corrected after an implementer hit the tripwire and stopped, exactly as instructed. The set of leaking text never changed.)*

- [ ] **Step 4: Commit the red guard**

The red state belongs in the branch history — a guard nobody saw fail is not known to work.

```bash
git add test/_normalizeProse.js test/scorerPacketBlindRule.test.js
git commit -m "test: scorer blind-rule guard, red against today's specs (#100)

Fails on 11 prior-run outcome statements across seeds 02-05. Seed 01 is
clean of this defect. The rewrites that turn it green follow.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Let `blindRule.test.js` coexist with `.history.md` siblings

Must land **before** any history file is created: `blindRule.test.js` globs `^seed-\d+-.*\.md$` and demands a `blind-rule-tokens` block from every match, so the first history file would fail it.

**Files:**
- Modify: `test/blindRule.test.js:53-58` (the `SPECIMENS` glob) and the `covers all five seeds plus the smoke gate` test at `:274-279`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable. Later tasks rely only on `blindRule.test.js` staying green once history files exist.

- [ ] **Step 1: Exclude history files from the specimen glob**

In `test/blindRule.test.js`, replace:

```js
const SPECIMENS = fs
    .readdirSync(SEEDS)
    .filter((f) => /^seed-\d+-.*\.md$/.test(f))
    .sort()
```

with:

```js
const SPECIMENS = fs
    .readdirSync(SEEDS)
    // `.history.md` siblings hold the prior-pass narrative removed from the
    // specs by issue #100. They are not model-facing -- same category as the
    // rest of benchmark/**, which this file's header already excludes by
    // design -- so they declare no token block. The exclusion is pinned by
    // name in the roster test below, so it can never quietly swallow a real
    // spec: an unpinned exemption would be the second, SILENT way to be
    // unguarded that this file's header argues against.
    .filter((f) => /^seed-\d+-.*\.md$/.test(f) && !/\.history\.md$/.test(f))
    .sort()
```

- [ ] **Step 2: Pin the specimen roster by name**

Replace the body of the `covers all five seeds plus the smoke gate` test:

```js
    it('covers all five seeds plus the smoke gate', () => {
        // A new seed spec is picked up by readdirSync and immediately fails the
        // two assertions above until its tokens are declared. That is the
        // point: a seed cannot arrive unguarded.
        expect(SPECIMENS).toHaveLength(6)
    })
```

with:

```js
    it('covers all five seeds plus the smoke gate', () => {
        // A new seed spec is picked up by readdirSync and immediately fails the
        // two assertions above until its tokens are declared. That is the
        // point: a seed cannot arrive unguarded.
        expect(SPECIMENS).toHaveLength(6)

        // The count alone does not close its own failure mode once the glob
        // carries a `.history.md` exclusion (#100): a too-greedy exclusion
        // could drop a real spec while a newly added file kept the count at
        // six. Pin the names, so any roster change has to be made here.
        expect(SPECIMENS.map((s) => s.label)).toEqual([
            'seed-01-schema-mismatch.md',
            'seed-02-ambiguous-instruction.md',
            'seed-03-missing-data.md',
            'seed-04-genai-unmapped.md',
            'seed-05-inactive-usecase.md',
            'README.md smoke gate',
        ])
    })
```

- [ ] **Step 3: Run `blindRule` and confirm still green**

Run: `npx jest test/blindRule.test.js`
Expected: **PASS**, all tests. No history files exist yet, so the exclusion is a no-op — this proves it did not drop a real spec.

- [ ] **Step 4: Commit**

```bash
git add test/blindRule.test.js
git commit -m "test: exclude .history.md from blindRule specimens, pin roster by name (#100)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Split seed 03

Smallest split — one callout, cleanly separable. Do this one first to establish the pattern the next three follow.

**Files:**
- Modify: `benchmark/seeds/seed-03-missing-data.md:13-18`
- Create: `benchmark/seeds/seed-03-missing-data.history.md`

**Interfaces:**
- Consumes: `test/scorerPacketBlindRule.test.js` from Task 1; the glob exclusion from Task 2.
- Produces: the history-file format Tasks 4–6 copy — an H1, a "not for scorer packets" preamble, a back-link to the spec, and dated H2 sections.

- [ ] **Step 1: Create the history file**

Create `benchmark/seeds/seed-03-missing-data.history.md`:

```markdown
# Seed 03 — prior-pass history

**Not for scorer packets.** This file records what earlier diagnostic runs did
and what they scored. It is the half of the old spec that the scorer blind rule
(`../README.md`, "The scorer blind rule", issue #100) keeps away from a blind
scorer, whose packet embeds the spec verbatim.

Scorer-facing spec: [`seed-03-missing-data.md`](./seed-03-missing-data.md) —
which does not link back here, deliberately.

## Task 12 (2026-08-02)

Both scored runs diagnosed layer 5 with the `genuinely_empty` verdict
(unfiltered count 0, ACL denial ruled out) and scored 6/6, on seed execution
`c4cd01842b6a4bd417a6ffbeee91bfc3`.
```

- [ ] **Step 2: Rewrite the spec's callout in a fixture voice**

In `benchmark/seeds/seed-03-missing-data.md`, replace:

```markdown
> **OBSERVED AT TASK 12 (2026-08-02) — the prediction held.** Seed execution
> `c4cd01842b6a4bd417a6ffbeee91bfc3`: `lookup_routing_rule` returned
> `{ok: true, matched: false, category: "Hardware", rules_in_table: 0}` — the
> measured GlideAggregate count, not a constant. Both scored runs diagnosed
> layer 5 with the `genuinely_empty` verdict (unfiltered count 0, ACL denial
> ruled out) and scored 6/6.
```

with:

```markdown
> **Fixture state, verified 2026-08-02.** Seed execution
> `c4cd01842b6a4bd417a6ffbeee91bfc3`: `lookup_routing_rule` returned
> `{ok: true, matched: false, category: "Hardware", rules_in_table: 0}` — the
> measured GlideAggregate count, not a constant.
```

- [ ] **Step 3: Run both guards**

Run: `npx jest test/scorerPacketBlindRule.test.js test/blindRule.test.js`
Expected: `seed-03-missing-data.md states no prior run outcome` now **PASSES**. Seeds 02, 04 and 05 still fail. All of `blindRule.test.js` passes — the new `.history.md` file is excluded from its specimen roster, and the pinned name list still reports six.

- [ ] **Step 4: Commit**

```bash
git add benchmark/seeds/seed-03-missing-data.md benchmark/seeds/seed-03-missing-data.history.md
git commit -m "docs: split seed 03 into scorer-facing spec and history (#100)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Split seed 02

Different shape from seed 03: the leak is two sentences buried inside a section that is otherwise fixture provenance. The section heading is renamed so "History" means one thing in this directory.

**Files:**
- Modify: `benchmark/seeds/seed-02-ambiguous-instruction.md:32,40-44`
- Create: `benchmark/seeds/seed-02-ambiguous-instruction.history.md`

**Interfaces:**
- Consumes: the history-file format from Task 3.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Create the history file**

Create `benchmark/seeds/seed-02-ambiguous-instruction.history.md`:

```markdown
# Seed 02 — prior-pass history

**Not for scorer packets.** This file records what earlier diagnostic runs did
and what they scored. It is the half of the old spec that the scorer blind rule
(`../README.md`, "The scorer blind rule", issue #100) keeps away from a blind
scorer, whose packet embeds the spec verbatim.

Scorer-facing spec:
[`seed-02-ambiguous-instruction.md`](./seed-02-ambiguous-instruction.md) —
which does not link back here, deliberately.

## Task 12 (2026-08-02) — the v1 construction

Agent Doctor diagnosed the zero-tool binding (layer 3) in both scored runs,
which were scored strictly against the expected layer-2 answer (2/6, fail, not
void — the seed was in its specified state). See `../DECISION.md` §D2. **No
valid Task 12 run exercised layer-2 diagnosis**, which is why v2 exists.
```

- [ ] **Step 2: Rename the section heading**

In `benchmark/seeds/seed-02-ambiguous-instruction.md`, replace:

```markdown
## History: the v1 construction was refuted at Task 12
```

with:

```markdown
## Why v2: the v1 construction was refuted
```

The rename matters beyond style. The retained text is *fixture provenance* — why the seed is built as it is — and leaving it under a heading called "History" invites a future redaction sweep to move the whole section into the `.history.md` file, taking legitimate scorer-facing content with it.

- [ ] **Step 3: Remove the two leaking sentences**

Replace:

```markdown
could only ever test the zero-tool binding (layer 3); Agent Doctor diagnosed
exactly that in both scored runs, which were scored strictly against the
expected layer-2 answer (2/6, fail, not void — the seed was in its specified
state). See `../DECISION.md` §D2. **No valid Task 12 run exercised layer-2
diagnosis**; v2 exists so the comparison re-run does, on both harnesses.
```

with:

```markdown
could only ever test the zero-tool binding (layer 3), never the instruction
ambiguity this seed exists to isolate. v2 exists so that a run of this seed
reaches layer-2 diagnosis, on both harnesses.
```

- [ ] **Step 4: Run both guards**

Run: `npx jest test/scorerPacketBlindRule.test.js test/blindRule.test.js`
Expected: seeds 02 and 03 **PASS**; 04 and 05 still fail; `blindRule.test.js` fully green.

- [ ] **Step 5: Commit**

```bash
git add benchmark/seeds/seed-02-ambiguous-instruction.md benchmark/seeds/seed-02-ambiguous-instruction.history.md
git commit -m "docs: split seed 02 into scorer-facing spec and history (#100)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Split seed 04

The callout mixes fixture state and run outcomes in adjacent sentences. Keep everything through `ok: false`; move the decoy-split narrative and the `DECISION.md` pointer.

**Files:**
- Modify: `benchmark/seeds/seed-04-genai-unmapped.md:13-25`
- Create: `benchmark/seeds/seed-04-genai-unmapped.history.md`

**Interfaces:**
- Consumes: the history-file format from Task 3.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Create the history file**

Create `benchmark/seeds/seed-04-genai-unmapped.history.md`:

```markdown
# Seed 04 — prior-pass history

**Not for scorer packets.** This file records what earlier diagnostic runs did
and what they scored. It is the half of the old spec that the scorer blind rule
(`../README.md`, "The scorer blind rule", issue #100) keeps away from a blind
scorer, whose packet embeds the spec verbatim.

Scorer-facing spec:
[`seed-04-genai-unmapped.md`](./seed-04-genai-unmapped.md) — which does not
link back here, deliberately.

## Task 12 (2026-08-02) — the decoy performed its function

The doubled scored runs SPLIT: run 1 found the dangling `api` and proposed the
exact healthy repoint (`936e514a53b3b110f028ddeeff7b128c`); run 2 named the
empty `connection` as primary cause and scored the canonical 2/0/1/0 decoy row.

See `../DECISION.md` §D3, including the `genai_log check_config` sampling gap
this exposed — first-100-by-name cannot reach an `x_*` capability.
```

- [ ] **Step 2: Rewrite the spec's callout in a fixture voice**

In `benchmark/seeds/seed-04-genai-unmapped.md`, replace:

```markdown
> **OBSERVED AT TASK 12 (2026-08-02) — the prediction held.** The primary
> construction installed without refusal (no fallback needed), the placeholder
> was substituted with capability sys_id `92ff62af516741769c437feb88c80ef3` and
> verified in the installed script, and the seed execution
> `16ddc10c2baa4314f243fed2ce91bf15` produced the predicted signature:
> `OneExtendUtil.execute` returned `status: "error"`, message "Plan invalid…",
> `capabilities: {}`, and the tool returned `ok: false`. The decoy also
> performed its function: the doubled scored runs SPLIT — run 1 found the
> dangling `api` and proposed the exact healthy repoint
> (`936e514a53b3b110f028ddeeff7b128c`); run 2 named the empty `connection` as
> primary cause and scored the canonical 2/0/1/0 decoy row. See
> `../DECISION.md` §D3, including the `genai_log check_config` sampling gap
> this exposed (first-100-by-name cannot reach an `x_*` capability).
```

with:

```markdown
> **Fixture state, verified 2026-08-02.** The primary construction installed
> without refusal (no fallback needed), the placeholder was substituted with
> capability sys_id `92ff62af516741769c437feb88c80ef3` and verified in the
> installed script, and the seed execution
> `16ddc10c2baa4314f243fed2ce91bf15` produced the predicted signature:
> `OneExtendUtil.execute` returned `status: "error"`, message "Plan invalid…",
> `capabilities: {}`, and the tool returned `ok: false`.
```

- [ ] **Step 3: Run both guards**

Run: `npx jest test/scorerPacketBlindRule.test.js test/blindRule.test.js`
Expected: seeds 02, 03, 04 **PASS**, and critically the control `NEGATIVE, real file: seed 04 keeps its decoy guidance and still scans clean` now passes — proving *"must not be scored as a hit"* and *"would have been scored a **miss**"* survived the rewrite. Seed 05 still fails; `blindRule.test.js` fully green.

- [ ] **Step 4: Commit**

```bash
git add benchmark/seeds/seed-04-genai-unmapped.md benchmark/seeds/seed-04-genai-unmapped.history.md
git commit -m "docs: split seed 04 into scorer-facing spec and history (#100)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Split seed 05

The most entangled: run outcomes are sandwiched between fixture state and an open question inside one callout, and a second leak sits 60 lines away in the void rule.

**Files:**
- Modify: `benchmark/seeds/seed-05-inactive-usecase.md:14-25,78-79`
- Create: `benchmark/seeds/seed-05-inactive-usecase.history.md`

**Interfaces:**
- Consumes: the history-file format from Task 3.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Create the history file**

Create `benchmark/seeds/seed-05-inactive-usecase.history.md`:

```markdown
# Seed 05 — prior-pass history

**Not for scorer packets.** This file records what earlier diagnostic runs did
and what they scored. It is the half of the old spec that the scorer blind rule
(`../README.md`, "The scorer blind rule", issue #100) keeps away from a blind
scorer, whose packet embeds the spec verbatim.

Scorer-facing spec:
[`seed-05-inactive-usecase.md`](./seed-05-inactive-usecase.md) — which does not
link back here, deliberately.

## Task 12 (2026-08-02)

Both scored runs named the specific gate
(`sn_aia_trigger_configuration.active` on `bfb77d6c64884500a80203ee029436ee`)
with the m2m link verified intact, earning full — not partial — fix-target
credit, and both flagged the empty run-as as an UNCONFIRMED advisory.

This seed's 2 scored rows at Task 12 were **not** void: the mandatory m2m PATCH
was performed, so the seed was in its specified state. The void-by-construction
case described in the spec is what would have happened without it.
```

- [ ] **Step 2: Rewrite the spec's callout in a fixture voice**

In `benchmark/seeds/seed-05-inactive-usecase.md`, replace:

```markdown
> **OBSERVED AT TASK 12 (2026-08-02) — the prediction held.** The m2m gate was
> PATCHed on post-install and re-read `true`
> (`sn_aia_trigger_agent_usecase_m2m` `ba30d8775b0c4cebb960c58830590d5d`);
> the trigger config stayed `active=false` as seeded. Ticket
> `29fd09c42b6a4bd417a6ffbeee91bfb0` (non-empty short_description) was inserted
> and **no execution plan was created anywhere on the instance** in the
> following minutes — the absence the seed exists to produce. Both scored runs
> named the specific gate (`sn_aia_trigger_configuration.active` on
> `bfb77d6c64884500a80203ee029436ee`) with the m2m link verified intact, earning
> full — not partial — fix-target credit, and both flagged the empty run-as as
> an UNCONFIRMED advisory. The run-as question below **stays open**: the
> trigger was never activated, so whether it fires with empty run-as remains
> unmeasured.
```

with:

```markdown
> **Fixture state, verified 2026-08-02.** The m2m gate was
> PATCHed on post-install and re-read `true`
> (`sn_aia_trigger_agent_usecase_m2m` `ba30d8775b0c4cebb960c58830590d5d`);
> the trigger config stayed `active=false` as seeded. Ticket
> `29fd09c42b6a4bd417a6ffbeee91bfb0` (non-empty short_description) was inserted
> and **no execution plan was created anywhere on the instance** in the
> following minutes — the absence the seed exists to produce. The run-as
> question below **stays open**: the trigger was never activated, so whether it
> fires with empty run-as remains unmeasured.
```

- [ ] **Step 3: Degrade the void rule from a report to a rule**

Still in `benchmark/seeds/seed-05-inactive-usecase.md`, replace:

```markdown
off** — verified in the emitted XML — and with both off the seed isolates
nothing, a diagnosis naming either gate is arguably right, and this seed's 2
scored rows are void by construction.
```

with:

```markdown
off** — verified in the emitted XML — and with both off the seed isolates
nothing, a diagnosis naming either gate is arguably right, and any rows
scored against it are void by construction.
```

The conditional rule is scoring guidance and stays; the count of a *particular* prior pass's void rows is a report and moves.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: **all green**, including all five per-spec tests, both real-file negative controls, and `blindRule.test.js`'s pinned six-specimen roster.

- [ ] **Step 5: Commit**

```bash
git add benchmark/seeds/seed-05-inactive-usecase.md benchmark/seeds/seed-05-inactive-usecase.history.md
git commit -m "docs: split seed 05 into scorer-facing spec and history (#100)

Turns the scorer blind-rule guard green across all five specs.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Fix seed 01's stale self-contradiction

No leak here — seed 01 scanned clean throughout. This is the other instrument defect the same sweep found: the spec tells a scorer the seed was never executed, then hands them a measurement from executing it.

**Files:**
- Modify: `benchmark/seeds/seed-01-schema-mismatch.md:13-18`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Replace the stale callout**

In `benchmark/seeds/seed-01-schema-mismatch.md`, replace:

```markdown
> **PREDICTED, NOT OBSERVED.** No seed has been installed or executed. What
> follows is derived from the Fluent source and from the records emitted into
> `seed-app/dist/`, which is build-time evidence, not runtime evidence.
> **Confirm at Task 12** before scoring, and correct this section if the run
> disagrees. Four predictions in this seed set were already wrong once and were
> only caught by reading `dist/`.
```

with:

```markdown
> **Fixture state, verified 2026-08-02.** The seed is installed and has been
> executed. What follows was derived from the Fluent source and from the
> records emitted into `seed-app/dist/`, then confirmed against a real run —
> the measurement is recorded under "Expected diagnosis". Where this section
> states a value, it is observed rather than predicted.
```

The replacement carries no run outcome, so the guard stays green either way; it is the *contradiction* being removed, not a leak.

- [ ] **Step 2: Verify the contradiction is gone and the ground truth is intact**

Run: `grep -n "PREDICTED, NOT OBSERVED\|No seed has been installed" benchmark/seeds/seed-01-schema-mismatch.md`
Expected: no output.

Run: `npx jest test/scorerPacketBlindRule.test.js`
Expected: **PASS**, including the seed 01 real-file control, which asserts `` `priority_stored` = `null` `` is still present.

- [ ] **Step 3: Commit**

```bash
git add benchmark/seeds/seed-01-schema-mismatch.md
git commit -m "docs: seed 01 no longer tells a scorer it was never executed (#100)

The callout claimed 'No seed has been installed or executed' three lines
above a measurement taken from executing it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: State the rule, and the packet-assembly procedure

The guard is the mechanical half. This is the half that tells a human which half of a spec to copy.

**Files:**
- Modify: `benchmark/README.md` (the `## The blind rule` section, around `:21-80`)
- Modify: `benchmark/scorecard-template.md` (append to the section describing how a scored row is prepared)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Add the scorer blind rule to `benchmark/README.md`**

Immediately after the existing guards table (the one listing `referenceStatistics` and `blindRule`) and before the paragraph beginning **"A passing suite is not evidence of blindness"**, insert:

```markdown
## The scorer blind rule

The rule above binds what reaches the **harness**. Seed specs deliberately never
reach the harness — they *are* the answer key — so nothing bound what they
carried until scoring itself became a model.

> **The scorer blind rule.** No text placed in front of a scorer may state what
> a prior diagnostic run did or what it scored.

This was sufficient while a human operator scored the rows. It stopped being
sufficient at v3, when scoring moved to independent blind agents whose packets
embed the seed spec verbatim — at which point four of five specs were narrating
what earlier runs had scored, grades included (`DECISION.md` §O5, issue #100).
The first rule protects the measurement **subject**; this one protects the
measurement **instrument**. Both are needed once the instrument is itself a
model.

| Channel | Source | Reaches |
|---|---|---|
| Seed specification | `seeds/seed-0N-*.md` | every packet for that seed |
| Rubric | `scorecard-template.md` §A / §A2 / §A3 | every packet |
| Run report + audit measurements | per-row, from `raw-evidence-*.md` | one packet each |

**What it permits, and the distinction is the whole point** — a redaction sweep
that takes the wrong half is as damaging as the leak. Permitted: the fixture's
own state, however it was learned (seed 01's `priority_stored` = `null` was
measured during a prior pass and a scorer cannot judge that seed without it);
the expected layer and fix target; scoring guidance including decoy rules, void
rules and partial-credit cases; hypothetical grading statements such as *"a
diagnosis naming the bogus condition would have scored a miss"*. Forbidden: what
a prior run diagnosed, proposed, or was awarded — and links to `DECISION.md`,
which a model scorer can follow into every prior pass's rows and grades.

**Where the removed text went.** Each seed's prior-pass narrative lives in a
sibling `seeds/seed-0N-*.history.md`. **The history file links to the spec; the
spec does not link back**, because a pointer from the spec is an invitation to
read what was just removed. A packet embeds the spec and never the history file.

| Guard | Catches | Origin |
|---|---|---|
| `test/scorerPacketBlindRule.test.js` | **prior-run outcomes** reaching a scorer | #100 |

The guard scans the seed specs — one of the three channels. The rubric and the
run reports are bound by the rule and not by the guard: only §A/§A2/§A3 of
`scorecard-template.md` reach a packet and the file legitimately explains
grading with score-shaped text (*"a run can score 3/6 and pass"*), so a
whole-file scan would be a false-positive machine. As with the harness rule, the
roster tracks the principle rather than defining it.
```

- [ ] **Step 2: Add the packet-assembly procedure to `benchmark/scorecard-template.md`**

Append this subsection to the end of the file:

```markdown
## Building a scorer packet

A packet is handed to an independent scorer who sees that one file and nothing
else. It contains the rubric (§A / §A2 / §A3 above), **the scorer-facing seed
spec** (`seeds/seed-0N-*.md`), that run's report verbatim, and that run's
audit-trail measurements.

**Never copy `seeds/seed-0N-*.history.md` into a packet.** It holds what earlier
runs did and what they scored — the scorer blind rule (`README.md`) is the
reason it is a separate file. Copying the spec is safe; the split exists so that
the obvious action is the correct one.

Before scoring, run `npx jest test/scorerPacketBlindRule.test.js`. A green run
means the declared patterns did not fire on any spec — not that the packets are
blind. §O5 of `DECISION.md` records what a leaked round cost the last time this
was checked by hand instead.
```

- [ ] **Step 3: Verify the rendered structure and the suite**

Run: `grep -n "^## " benchmark/README.md | head -20`
Expected: `## The scorer blind rule` appears after `## The blind rule` and before whatever section followed it; no heading was displaced or duplicated.

Run: `npm test`
Expected: **all green**.

- [ ] **Step 4: Commit**

```bash
git add benchmark/README.md benchmark/scorecard-template.md
git commit -m "docs: state the scorer blind rule and the packet-assembly procedure (#100)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Version, changelog, PR

**Files:**
- Modify: `package.json:<the "version" line>`
- Modify: `README.md:3` (version badge)
- Modify: `CHANGELOG.md` (new entry at the top of the entry list)

**Interfaces:**
- Consumes: everything above.
- Produces: the PR.

- [ ] **Step 1: Bump the version in both places**

In `package.json`, change `"version": "2026.08.0302"` to `"version": "2026.08.0303"`.

In `README.md` line 3, change `version-2026.08.0302-blue` to `version-2026.08.0303-blue`.

- [ ] **Step 2: Add the changelog entry**

Add at the top of `CHANGELOG.md`'s entry list, matching the surrounding entry format:

```markdown
## 2026.08.0303 — the scorer blind rule (#100)

The blind rule now binds the channels that reach a **scorer**, not only those
that reach the harness. Four of five seed specs narrated prior passes' outcomes
and grades, and scorer packets embed the spec verbatim, so a blind scorer could
see what a comparable run had scored before grading this one (`DECISION.md` §O5
measures the cost at roughly one row on a 10-row pass).

- **Split** — each `benchmark/seeds/seed-0N-*.md` is now wholly scorer-facing,
  with the prior-pass narrative in a sibling `seed-0N-*.history.md`. The history
  file links to the spec and not the reverse, so copying the spec is correct by
  construction — the v4 pass had to hand-redact 29 files to work around the old
  shape.
- **Guard** — `test/scorerPacketBlindRule.test.js`, a sibling to
  `blindRule.test.js`. It cannot reuse that file's per-line matcher: the specs
  hard-wrap, so phrases straddle line breaks (seed 05's *"earning full — not
  partial — fix-target credit"* spans two lines), and every leak sat inside a
  `>` callout. `test/_normalizeProse.js` strips blockquote markers and joins
  wrapped lines while preserving a line map. Measured red state before the
  rewrites: 11 hits across seeds 02–05, zero false positives.
- **Guidance survives, and it is pinned** — two real-file controls assert seed
  04's decoy rule and seed 01's `priority_stored` ground truth are still present
  *and* scan clean. That is what separates redacting the leak from lobotomising
  the packet.
- **Seed 01** no longer opens by telling a scorer the seed was never executed
  three lines above a measurement taken from executing it.

No score moves. Custom's Round A rows were never re-scored on clean packets and
still have not been — `DECISION.md` §O7's caveat stands.
```

- [ ] **Step 3: Final verification before the PR**

Run: `npm test`
Expected: **all green**. Record the summary line (suites/tests passed) for the PR body.

Run: `git log --oneline main..HEAD`
Expected: the design commit plus eight implementation commits, in the order of this plan.

- [ ] **Step 4: Commit and open the PR**

```bash
git add package.json README.md CHANGELOG.md
git commit -m "chore: version 2026.08.0303 + changelog for the scorer blind rule (#100)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"

git push -u origin fix/scorer-packet-blind-rule
```

Then open the PR against `main` with `gh pr create`, titled `Extend the blind rule to scorer packets (#100)`. The body must include:

- `Closes #100`.
- The **measured red state** from Task 1 Step 3 — the 11 hits, quoted from the guard's own failure output. The design filed that number in advance; the PR is where it is shown to have been met.
- The final green `npm test` summary.
- The two mechanics findings (line-straddling phrases, blockquote markers), since either one alone would have produced a green guard over a live leak.
- The note that no score moved and that §O7's Round A caveat is untouched.
- The trailer: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Self-Review

**Spec coverage** — §1 sentence-level split → Tasks 3–6 (each gives exact before/after text). §2 rule text → Task 8 Step 1. §3 file split and link direction → Tasks 3–6 plus the README paragraph in Task 8. §3 glob exclusion with pinned names → Task 2. §4 guard, patterns, three controls → Task 1. §4 normalizer mechanics → Task 1 Step 1. §4 measured red state → Task 1 Step 3. §5 seed 01 stale callout → Task 7. §6 packet-assembly procedure → Task 8 Step 2. Ship section → Task 9. No gaps.

**Placeholder scan** — no TBDs; every edit gives verbatim old and new text; every test step gives an exact command and expected result.

**Type consistency** — `normalizeProse` returns `{ text, lineStarts }` in Task 1 and is destructured that way in `load()`, both controls, and the guard body. `lineAt(lineStarts, offset)` is called only from `scanProse`. `scanProse(text, lineStarts)` returns `{pattern, line, text}` objects, consumed as `h.pattern` / `h.line` / `h.text` in the failure message and in both POSITIVE controls. `SPECS` holds filenames (strings) and is compared against a string array; `SPECIMENS` in `blindRule.test.js` holds `{label, file}` objects and is compared via `.map((s) => s.label)` — the two rosters are shaped differently and are never mixed.
