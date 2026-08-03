# Blind rule binds tool output — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Broaden the benchmark's blind rule to bind every text channel the harness can put in front of the model, and add a build-time guard that fails when a seeded answer reaches one.

**Architecture:** Each seed spec declares its own answer tokens in a fenced ` ```blind-rule-tokens ` block. A new Jest source-scan (`test/blindRule.test.js`) reads those blocks and asserts no token appears in any model-facing string across the product app — the 7 tool cores, `PaToolReadKit`, `PaToolRegistry` descriptions, the Fluent agent, and the instructions doc. Comments are stripped from `.js`/`.ts` before scanning, because prose *about* a leak is where that knowledge belongs; the instructions `.md` is scanned whole.

**Tech Stack:** Node, Jest 29.7.0 (`npm test`), plain CommonJS test helpers. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-02-blind-rule-tool-output-design.md`
**Issue:** #89
**Branch:** `fix/blind-rule-binds-tool-output` (already created; the design doc is committed on it)

## Global Constraints

- **No new dependencies.** Jest 29.7.0 and Node built-ins (`fs`, `path`) only.
- **Test files match `<rootDir>/test/**/*.test.js`** (`package.json` jest config). A helper named `_stripComments.js` is not collected as a suite — this follows the existing `_glideStub.js` / `_loadScriptInclude.js` convention.
- **Never commit to `main`.** All work on `fix/blind-rule-binds-tool-output`; ship via PR.
- **Version `2026.08.0227`** — day-02 counter continued. The CHANGELOG's `2026-08-03` dates are UTC; local is still 2026-08-02. Update `package.json`, the `README.md` badge, and `CHANGELOG.md`.
- **The quoted blind rule in `benchmark/README.md` stays verbatim.** Only the pointer paragraph beneath it changes. The file states this preservation is deliberate.
- **Tokens name the answer, not the vocabulary of the question.** Never declare platform vocabulary a diagnostic tool legitimately reads (`sn_aia_trigger_configuration`, `context_processing_script`, `api_type`). A token that fires on honest tool code is a bad token, not a finding.
- **Removal, not labelling,** for any leak found. `REFERENCE_STAT` exists because R-22 item 4 requires a denominator to travel with a count; an answer has no equivalent justification.
- **Scan the product app only.** `benchmark/seed-app/**` implements the defects and `benchmark/**` docs are the answer key — both are full of tokens by construction and neither is model-facing.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `test/_stripComments.js` | Create | Sole owner of comment-blanking for source scans. Shared by both guards so they cannot drift. |
| `test/referenceStatistics.test.js` | Modify | Drops its private copy of `stripComments`, requires the shared one. Behavior unchanged. |
| `test/blindRule.test.js` | Create | Parses token blocks, asserts structure, scans model-facing sources. |
| `benchmark/seeds/seed-0{1..5}-*.md` | Modify | Each declares its own answer tokens. |
| `benchmark/README.md` | Modify | Smoke-gate token block; broadened rule pointer paragraph. |
| `benchmark/DECISION.md` | Modify | §M — the sweep, its findings, any native-facing edit. |
| `CHANGELOG.md`, `package.json`, `README.md` | Modify | Version `2026.08.0227`. |

---

### Task 1: Extract the shared comment stripper

`stripComments` currently lives privately inside `test/referenceStatistics.test.js:66-78`. Both guards need identical comment semantics; a copy would let them drift, and the drift would be silent (a scan that looks at *less* text still passes).

**Files:**
- Create: `test/_stripComments.js`
- Modify: `test/referenceStatistics.test.js:45-78` (add require, delete the local function)
- Test: `test/referenceStatistics.test.js` (existing suite is the regression gate)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `module.exports = { stripComments }` where `stripComments(source: string) => string` — blanks block comments and line comments while **preserving line numbering**, so a failure can name a real line number.

- [ ] **Step 1: Write the failing test**

Add to the bottom of `test/referenceStatistics.test.js`:

```javascript
describe('the shared comment stripper (test/_stripComments.js)', () => {
    const { stripComments } = require('./_stripComments')

    it('blanks a block comment but keeps the line count', () => {
        const src = 'a\n/* leak\n   leak */\nb'
        expect(stripComments(src).split('\n')).toHaveLength(4)
        expect(stripComments(src)).not.toContain('leak')
    })

    it('blanks a line comment and keeps the code before it', () => {
        expect(stripComments("var x = 1 // leak")).toBe('var x = 1 ')
    })

    it('leaves a source with no comments untouched', () => {
        expect(stripComments("var x = 'plain'")).toBe("var x = 'plain'")
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/referenceStatistics.test.js -t 'shared comment stripper'`
Expected: FAIL — `Cannot find module './_stripComments'`

- [ ] **Step 3: Create the shared helper**

Create `test/_stripComments.js` with the function moved verbatim from `referenceStatistics.test.js`, plus a header explaining why it is shared:

```javascript
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
```

- [ ] **Step 4: Point `referenceStatistics.test.js` at the shared helper**

Delete the local `function stripComments(...)` block (currently lines 61-78, including its JSDoc) and add beside the other requires at the top:

```javascript
const { stripComments } = require('./_stripComments')
```

- [ ] **Step 5: Run the full suite to verify nothing regressed**

Run: `npm test`
Expected: PASS — every previously passing suite still passes, plus the three new stripper tests. The #85 guard must behave identically; it is the regression gate for this refactor.

- [ ] **Step 6: Commit**

```bash
git add test/_stripComments.js test/referenceStatistics.test.js
git commit -m "refactor: share the comment stripper between the two source-scan guards (#89)"
```

---

### Task 2: Declare answer tokens on every specimen

The guard needs an answer key in machine-readable form, and it needs to fail when a specimen arrives without one. Test-first: the parser and its structural assertions are written before any block exists, so their failure proves they can detect an unguarded seed.

**Files:**
- Create: `test/blindRule.test.js` (parser + structural assertions only; the scan lands in Task 3)
- Modify: `benchmark/seeds/seed-01-schema-mismatch.md`, `seed-02-ambiguous-instruction.md`, `seed-03-missing-data.md`, `seed-04-genai-unmapped.md`, `seed-05-inactive-usecase.md`, `benchmark/README.md`

**Interfaces:**
- Consumes: nothing from Task 1 (the scan in Task 3 consumes `stripComments`).
- Produces: `readTokenBlock(absPath: string) => string[] | null` — `null` when the file has no block, an array of trimmed non-empty lines otherwise. `SPECIMENS` — an array of `{label: string, file: string}` covering the 5 seed specs plus the README smoke gate. Task 3 consumes both.

- [ ] **Step 1: Write the failing test**

Create `test/blindRule.test.js`:

```javascript
/**
 * The blind rule binds every channel the harness can put in front of the
 * model — instructions, tool descriptions, and tool output (issue #89).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * benchmark/README.md's smoke gate expects `script_error` citing
 * `context_processing_script` line 42. Until 2026.08.0222, PaToolAgentConfig
 * emitted "an auto-populated body on this instance threw at line 42" inside a
 * FINDING — the gate's own expected answer, handed to the model mid-reasoning,
 * on any agent with a populated context_processing_script.
 *
 * It never fired, because no run has ever invoked agent_config: 0/10 in v3,
 * 0/10 in Task 10, 0/4 in the v4 smoke. The leak was harmless only because the
 * harness was too shallow to reach it, and would have activated at exactly the
 * moment the depth work succeeded.
 *
 * PR #87 removed that instance while sweeping for STATISTICS (#85). It never
 * swept for ANSWERS. This file is that sweep, made permanent.
 *
 * ---------------------------------------------------------------------------
 * HOW A TOKEN IS CHOSEN
 * ---------------------------------------------------------------------------
 * A token names THE ANSWER, not THE VOCABULARY OF THE QUESTION.
 *
 *   DECLARE   strings that exist only because the seed exists —
 *             x_snc_tsbench_*, seed agent and tool names, the seeded value.
 *   DO NOT    platform vocabulary a diagnostic tool legitimately reads.
 *             sn_aia_trigger_configuration is seed 05's answer AND a table
 *             agent_config must query to sweep layer 7. context_processing_script
 *             is the smoke gate's answer AND a field that same tool must read.
 *
 * A token that fires on honest tool code is a bad token, not a finding. Where
 * the answer IS platform vocabulary, declare the surrounding phrasing instead:
 * the smoke gate declares `line 42`, not `context_processing_script`.
 *
 * There is deliberately NO stop-list. A token too generic to be distinctive
 * simply reddens the suite, and that failure IS the signal to pick a better
 * token. A length filter or generic-word exemption would introduce a second,
 * SILENT way to be unguarded — the exact failure mode #89 is about.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SEEDS = path.join(ROOT, 'benchmark', 'seeds')

/** The 5 seed specs plus the README smoke gate — every specimen a run is scored against. */
const SPECIMENS = fs
    .readdirSync(SEEDS)
    .filter((f) => /^seed-\d+-.*\.md$/.test(f))
    .sort()
    .map((f) => ({ label: f, file: path.join(SEEDS, f) }))
    .concat([{ label: 'README.md smoke gate', file: path.join(ROOT, 'benchmark', 'README.md') }])

/**
 * Read a ```blind-rule-tokens fence. Returns null when the file has no block —
 * distinct from an empty block, which is a declared claim of "nothing to hide"
 * and is also rejected.
 */
function readTokenBlock(absPath) {
    const source = fs.readFileSync(absPath, 'utf8')
    const match = source.match(/```blind-rule-tokens\n([\s\S]*?)```/)
    if (!match) return null
    return match[1]
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
}

describe('every specimen declares its answer tokens (issue #89)', () => {
    SPECIMENS.forEach((s) => {
        it(s.label + ' has a blind-rule-tokens block', () => {
            expect(readTokenBlock(s.file)).not.toBeNull()
        })

        it(s.label + ' declares at least one token', () => {
            expect((readTokenBlock(s.file) || []).length).toBeGreaterThan(0)
        })
    })

    it('covers all five seeds plus the smoke gate', () => {
        // A new seed spec is picked up by readdirSync and immediately fails the
        // two assertions above until its tokens are declared. That is the
        // point: a seed cannot arrive unguarded.
        expect(SPECIMENS).toHaveLength(6)
    })
})
```

No `module.exports` — Task 3 adds the scan to **this same file**, so `SPECIMENS` and `readTokenBlock` are already in scope there. An export would be dead code.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/blindRule.test.js`
Expected: FAIL — 10 failures, one pair per specimen: `expect(received).not.toBeNull()`. The `toHaveLength(6)` assertion passes. This proves the parser detects an unguarded specimen, which is the property Task 2 exists to establish.

- [ ] **Step 3: Declare tokens on seed 01**

Append to `benchmark/seeds/seed-01-schema-mismatch.md`:

````markdown
## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by `../../test/blindRule.test.js` — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 01 Ticket Prioritizer
x_snc_tsbench_ticket
set_ticket_priority
priority_stored
priority_requested
```
````

- [ ] **Step 4: Declare tokens on seeds 02-05**

Append the same section (heading, one-line pointer, fence) to each, varying only the fence body:

`benchmark/seeds/seed-02-ambiguous-instruction.md`:

```blind-rule-tokens
Seed 02 Request Router
measure_request
```

`benchmark/seeds/seed-03-missing-data.md`:

```blind-rule-tokens
Seed 03 Category Router
x_snc_tsbench_routing_rule
rules_in_table
```

`benchmark/seeds/seed-04-genai-unmapped.md`:

```blind-rule-tokens
Seed 04 Summarizer
x_snc_tsbench_unmapped_capability
936e514a53b3b110f028ddeeff7b128c
```

`benchmark/seeds/seed-05-inactive-usecase.md`:

```blind-rule-tokens
Seed 05 Ticket Acknowledger
Seed 05 Ticket Acknowledgement
Seed 05 Bench Ticket Created
```

Note on seed 05: `sn_aia_trigger_configuration` is its answer *and* a table `agent_config` must query to sweep layer 7. It is deliberately **not** declared, per the authoring rule. The seed-specific trigger and agent names carry the same information without firing on honest code.

- [ ] **Step 5: Declare tokens on the README smoke gate**

Add to `benchmark/README.md`, immediately after the step-3 smoke-test paragraph (currently ending "…not one of the 10 scored rows."):

````markdown
   The smoke gate's own answer tokens, guarded by `../test/blindRule.test.js`:

   ```blind-rule-tokens
   c9d63a932bda8b9417a6ffbeee91bfd0
   line 42
   ```

   `context_processing_script` is deliberately **not** a token: it is this
   gate's answer *and* a field `agent_config` must read to sweep layer 4. A
   token that fires on honest tool code is a bad token, not a finding.
````

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest test/blindRule.test.js`
Expected: PASS — 13 assertions (6 × 2 + the count).

- [ ] **Step 7: Commit**

```bash
git add test/blindRule.test.js benchmark/seeds benchmark/README.md
git commit -m "test: declare answer tokens on every benchmark specimen (#89)"
```

---

### Task 3: Scan every model-facing source

The parser has an answer key; now it needs targets. This task adds the scan, plus the two controls that distinguish a guard that passes because the code is clean from one that passes because it silently matched nothing.

**Files:**
- Modify: `test/blindRule.test.js` (add scan targets, controls, and the real assertion)
- Test: itself

**Interfaces:**
- Consumes: `stripComments` from `test/_stripComments.js` (Task 1); `SPECIMENS`, `readTokenBlock` from Task 2.
- Produces: `SCAN_TARGETS` — array of `{file: string, stripComments: boolean}`, repo-relative paths. `scanText(text: string, tokens: {token, from}[]) => {line, token, from, text}[]` — pure matcher. `findTokens(target, tokens) => {file, line, token, from, text}[]` — `scanText` plus file read and comment policy. Nothing later consumes them.

- [ ] **Step 1: Write the scan**

Add to `test/blindRule.test.js`, **after** the `readTokenBlock` definition and **before** the existing `describe` (it uses `SPECIMENS`, `readTokenBlock`, `fs`, `path`, and `ROOT` from Task 2):

**A note on TDD shape.** A guard test cannot go red-green the ordinary way: the scan assertion passes whenever the code is clean, which is the desired end state and also what a broken scanner looks like. The POSITIVE control is what substitutes for the red phase — it proves the matcher fires — and the NEGATIVE control proves comment-stripping still holds. Write all three together; the controls are not optional extras here, they are the test's evidence that it tested anything.

```javascript
const { stripComments } = require('./_stripComments')

/**
 * Everything the harness can put in front of the model.
 *
 *   instructions       docs/agent/agent-doctor-instructions.md   both harnesses
 *   tool descriptions  PaToolRegistry.js -> agent-doctor.now.ts  both harnesses
 *   tool output        the 7 cores + PaToolReadKit               both harnesses
 *
 * NOT scanned, and the distinction is the whole point: benchmark/seed-app/**
 * is the fixture that IMPLEMENTS the defects, and benchmark/** docs ARE the
 * answer key. Both are full of tokens by construction; neither is model-facing.
 */
const SCAN_TARGETS = [
    'src/server/tools/PaToolAgentTrace.js',
    'src/server/tools/PaToolAgentConfig.js',
    'src/server/tools/PaToolGenAiLog.js',
    'src/server/tools/PaToolLogAnalysis.js',
    'src/server/tools/PaToolQueryTable.js',
    'src/server/tools/PaToolSchemaLookup.js',
    'src/server/tools/PaToolReadArtifact.js',
    'src/server/PaToolReadKit.js',
    'src/server/PaToolRegistry.js',
    'src/fluent/agent-doctor.now.ts',
].map((f) => ({ file: f, stripComments: true }))
    // The instructions doc is scanned WHOLE. All of it is model-facing, so
    // there is no non-model-facing half to exempt.
    .concat([{ file: 'docs/agent/agent-doctor-instructions.md', stripComments: false }])

/** Every declared token across every specimen, with its source spec attached. */
function allTokens() {
    const out = []
    SPECIMENS.forEach((s) => {
        ;(readTokenBlock(s.file) || []).forEach((t) => out.push({ token: t, from: s.label }))
    })
    return out
}

/**
 * Case-insensitive substring hits in already-prepared text, as
 * {line, token, from, text}. Pure — no file I/O, no comment handling — so the
 * POSITIVE control below can exercise THE REAL MATCHER on a planted line.
 */
function scanText(text, tokens) {
    const hits = []

    text.split('\n').forEach((line, i) => {
        const haystack = line.toLowerCase()
        tokens.forEach((t) => {
            if (haystack.indexOf(t.token.toLowerCase()) === -1) return
            hits.push({ line: i + 1, token: t.token, from: t.from, text: line.trim() })
        })
    })

    return hits
}

/** scanText against a target file, with that target's comment policy applied. */
function findTokens(target, tokens) {
    const raw = fs.readFileSync(path.join(ROOT, target.file), 'utf8')
    const text = target.stripComments ? stripComments(raw) : raw
    return scanText(text, tokens).map((h) => Object.assign({ file: target.file }, h))
}

describe('no seeded answer reaches a model-facing string (issue #89)', () => {
    SCAN_TARGETS.forEach((target) => {
        it(target.file + ' names no seed answer', () => {
            const hits = findTokens(target, allTokens())
            expect(
                hits.map(
                    (h) =>
                        h.file + ':' + h.line + '  [' + h.from + ': ' + h.token + ']  ' + h.text
                )
            ).toEqual([])
        })
    })
})

describe('the scanner itself works (controls)', () => {
    it('POSITIVE: the real matcher catches a planted token', () => {
        // A guard that passes because it silently matched NOTHING is
        // indistinguishable from one that passes because the code is clean.
        // This calls scanText -- the same function the scan above runs on every
        // target -- so a matcher that stops matching fails HERE.
        const hits = scanText("    detail: 'the Seed 03 Category Router never fired',", [
            { token: 'Seed 03 Category Router', from: 'control' },
        ])

        expect(hits).toHaveLength(1)
        expect(hits[0].line).toBe(1)
        expect(hits[0].token).toBe('Seed 03 Category Router')
    })

    it('POSITIVE: the real matcher is case-insensitive', () => {
        expect(
            scanText('RULES_IN_TABLE', [{ token: 'rules_in_table', from: 'control' }])
        ).toHaveLength(1)
    })

    it('NEGATIVE: a token inside a real comment does not fire', () => {
        // PaToolRegistry.js documents the #91 section ranking by naming seed
        // 03's whole answer -- `rules_in_table: 0` -- in a comment. That prose
        // is exactly where the knowledge belongs and must stay writable. It is
        // a real-file control: if comment-stripping ever breaks, this fails
        // BEFORE the main scan turns into noise.
        const registry = { file: 'src/server/PaToolRegistry.js', stripComments: true }
        const raw = fs.readFileSync(path.join(ROOT, registry.file), 'utf8')

        expect(raw.toLowerCase()).toContain('rules_in_table')
        expect(findTokens(registry, [{ token: 'rules_in_table', from: 'control' }])).toEqual([])
    })
})
```

- [ ] **Step 2: Run the controls and confirm both pass**

Run: `npx jest test/blindRule.test.js -t 'controls'`
Expected: PASS, both.

- If the **POSITIVE** control fails, the matcher is broken and every clean scan result below is meaningless. Fix it before reading anything else.
- If the **NEGATIVE** control fails, comment-stripping is broken — Task 1 regressed. Fix that first; otherwise the main scan will light up on prose that is supposed to be writable and you will "fix" comments that were never leaks.

- [ ] **Step 3: Record the scan outcome**

Run: `npx jest test/blindRule.test.js 2>&1 | tee /tmp/blindrule-scan.txt`

There are two legitimate outcomes, and the spec predicts both:

- **All 11 targets pass.** A real result, not a disappointing one — PR #87's sweep already read these files once, and #89's own text says the residual gap is *the rule*, not a known second instance. The guard's value is prospective. Record the clean sweep in Task 5.
- **A target fails.** Read the named line. If it is a genuine leak, fix it in Step 4. If the token fires on honest tool code, the **token** is wrong — revise it per the authoring rule and note why in the spec's token table.

- [ ] **Step 4: Sweep the cores by hand — the half no token can reach**

The guard only finds what it was told to look for. #89 item 3 asks for a sweep of the seven cores against the smoke specimen and the five seed specs for *any other answer-shaped constant*, and the #85 audit is the cautionary precedent: it swept for statistics and walked past `threw at line 42`.

Read each of the seven cores' **emitted strings** — `detail`, `next_step`, `summary`, `note`, finding text, and the descriptions in `PaToolRegistry.js` — with the six specimens open. You are looking for anything that would tell a model what it is supposed to conclude, rather than what the instance contains:

- a remembered value from a specimen run (a sys_id, a count, a state, a field value);
- a diagnosis stated as a general truth ("a populated context script usually means X") where X is a seeded answer;
- a `next_step` that names the seeded fix rather than the next read;
- an example in a tool description drawn from a specimen.

For each hit, decide: genuine leak (fix in Step 5), or a token that should have caught it (add the token in Task 2's blocks and re-run). Record the files read and the outcome — a hand sweep that found nothing is a result and belongs in §M2, but only if it actually happened.

- [ ] **Step 5: Fix any genuine leak found**

Removal, not labelling — there is no version of "the seeded diagnosis, but labelled" that belongs in a payload. If the leak is in `PaToolRegistry.js` or `src/fluent/agent-doctor.now.ts`, it is **native-shared**: fix it anyway (a leak invalidates a measurement rather than tilting it, and PR #87 set this precedent), and note the file and date for Task 5's §M entry.

If nothing is found, skip this step and say so explicitly in the commit body.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — all suites green, including `referenceStatistics` (unchanged behavior) and the new scan.

- [ ] **Step 7: Commit**

```bash
git add test/blindRule.test.js src/
git commit -m "test: scan every model-facing source for seeded answers (#89)"
```

---

### Task 4: Broaden the rule text

The guard is mechanical; the rule is what it enforces. `benchmark/README.md` still says the rule binds Agent Doctor's *instructions*.

**Files:**
- Modify: `benchmark/README.md:30-35` (the pointer paragraph beneath the quoted rule)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by code. The token blocks from Task 2 are already in this file.

- [ ] **Step 1: Confirm the quoted rule is untouched**

Run: `git diff main -- benchmark/README.md | grep -c '^-.*seeded-failure catalog'`
Expected: `0` — the quoted rule at lines 26-28 must not appear in the removed side of the diff. It is preserved verbatim by design and the file says so.

- [ ] **Step 2: Replace the pointer paragraph's final sentence**

The paragraph currently ends:

> The rule binds anything that becomes part of Agent Doctor's instructions, whatever it ends up being called.

Replace that sentence with:

````markdown
**What the rule binds.** Instructions were the only channel that existed when this rule was written
for the native harness. There are now three, and the rule binds all of them:

| Channel | Source | Reaches |
|---|---|---|
| Instructions | `docs/agent/agent-doctor-instructions.md` | both harnesses |
| Tool descriptions | `src/server/PaToolRegistry.js` (single-sourced), mirrored into `src/fluent/agent-doctor.now.ts` | both harnesses |
| Tool output | the 7 cores in `src/server/tools/` + `src/server/PaToolReadKit.js` | both harnesses |

Tool output is the most direct of the three: it lands in the reasoning loop at the moment of
diagnosis, not in a preamble read once at the start. Until `2026.08.0222`, `PaToolAgentConfig`
emitted this gate's own expected answer — *"threw at line 42"* — inside a finding. It never fired
only because no run has ever invoked `agent_config`, and it would have activated at exactly the
moment the depth work succeeded (#89, `DECISION.md` §J4, §M).

Two guards enforce the mechanical half:

| Guard | Catches | Origin |
|---|---|---|
| `test/referenceStatistics.test.js` | reference **statistics** mistakable for run data | #85 |
| `test/blindRule.test.js` | **answers** — the seeded diagnosis itself | #89 |

`blindRule` reads the ` ```blind-rule-tokens ` block each specimen declares, so a new seed is
covered the moment its spec lands and fails the build until its tokens are declared.

**A passing suite is not evidence of blindness.** Neither guard can catch what it was not told to
look for, and a token that names platform vocabulary a tool legitimately reads is a bad token
rather than a finding. The human half of the rule governs everything the patterns cannot reach.
````

- [ ] **Step 3: Verify the tests still pass**

Run: `npm test`
Expected: PASS. `benchmark/README.md` is a specimen (its smoke-gate block) but not a scan target, so prose changes here cannot break the scan — this run confirms the token block survived the edit intact.

- [ ] **Step 4: Commit**

```bash
git add benchmark/README.md
git commit -m "docs: the blind rule binds tool descriptions and tool output (#89)"
```

---

### Task 5: Record the sweep and ship

**Files:**
- Modify: `benchmark/DECISION.md` (append §M), `CHANGELOG.md`, `package.json:3`, `README.md:3`
- Modify (conditional): `benchmark/scorecard-agent-doctor.md` — only if Task 3 changed native-shared text

**Interfaces:**
- Consumes: the scan outcome recorded in Task 3, Step 3.
- Produces: nothing.

- [ ] **Step 1: Append `DECISION.md` §M**

Follow the house style of §J–§L: a dated heading, numbered subsections, and an explicit "what this does not establish". Cover:

- **§M1 — what was changed.** The rule now binds three channels; two mechanical guards; tokens declared per specimen.
- **§M2 — the sweep result.** State the actual outcome from Task 3 Step 3 verbatim. If clean: say so plainly, and say that a clean sweep is a real result whose value is prospective — #89's residual gap was the rule, not a known second instance. If a leak was found: name the file, the token, and whether it was native-shared.
- **§M3 — native movement, if any.** Only if Task 3 Step 4 edited `PaToolRegistry.js` or `src/fluent/agent-doctor.now.ts`. Record the edit and note that native's standing seed 1/3/4/5 rows in `scorecard-agent-doctor.md` predate it. Omit the subsection entirely if nothing native-facing moved.
- **§M4 — what this does not establish.** No score movement and none claimed. Depth is untouched (§K4 remedy 2, §L7 — still the milestone blocker). The guard is a build-time source scan: a leak assembled at runtime from live fixture data is not caught and cannot be, since a tool reading the fixture app's tables will legitimately return fixture strings. The blind rule has always been about authored text.
- **§M5 — the queue.** §J5's item 2 of 3 is now done. Next is the v4 scored pass: ten rows, blind, audit-derived, native re-measured the same day (closes §H7-4 / §I4 confound 3), with confound 2 (`agent-doctor-instructions.md:48`) resolved in that same pass.

- [ ] **Step 2: Annotate the native scorecard, only if native text moved**

If and only if Task 3, Step 4 edited native-shared text, add a note above the seed 1/3/4/5 rows in `benchmark/scorecard-agent-doctor.md` stating that those rows were scored before the #89 fix and naming the file changed. If nothing native-facing moved, skip this step.

- [ ] **Step 3: Bump the version**

Three files, one value — `2026.08.0227`:

```bash
sed -i '' 's/"version": "2026.08.0226"/"version": "2026.08.0227"/' package.json
sed -i '' 's/version-2026.08.0226-blue/version-2026.08.0227-blue/' README.md
```

Then verify both landed:

```bash
grep -n '"version"' package.json && grep -n 'shields.io/badge/version' README.md
```

- [ ] **Step 4: Add the CHANGELOG entry**

Insert above the `## 2026.08.0226` heading, matching the existing entry style (a body that explains the mechanism, not just the change). This is the clean-sweep wording; if Task 3 found a leak, replace the final paragraph with the file, the token, and whether it was native-shared:

```markdown
## 2026.08.0227 — 2026-08-02

### Fixed
- **The blind rule bound instructions only, so tool output could carry the answer (#89).**
  `benchmark/README.md`'s rule — the condition that makes every score in this repo mean
  anything — bound the text that becomes Agent Doctor's *instructions*. It did not bind tool
  descriptions or tool output, and tool output is the more direct channel: it lands in the
  reasoning loop at the moment of diagnosis rather than in a preamble read once at the start.

  The leak that proved it: until `2026.08.0222`, `PaToolAgentConfig` emitted *"an auto-populated
  body on this instance threw at line 42"* inside a finding — the smoke gate's own expected
  answer — on any agent with a populated `context_processing_script`. It never fired because no
  run has ever invoked `agent_config` (0/10 in v3, 0/10 in Task 10, 0/4 in the v4 smoke). The
  leak was harmless only because the harness was too shallow to reach it, and would have
  activated at exactly the moment the depth work succeeded. PR #87 removed that instance while
  sweeping for *statistics* (#85); it never swept for *answers*.

  The rule now binds all three channels — instructions, tool descriptions, tool output.

### Added
- **`test/blindRule.test.js` — the mechanical half for answers.** Each seed spec and the README
  smoke gate declares its own tokens in a fenced ` ```blind-rule-tokens ` block; the guard fails
  the build when one reaches a model-facing string across the seven tool cores, `PaToolReadKit`,
  `PaToolRegistry`, `src/fluent/agent-doctor.now.ts`, or the instructions doc. A new seed is
  picked up automatically and fails until its tokens are declared.

  A token names **the answer, not the vocabulary of the question**.
  `sn_aia_trigger_configuration` is seed 05's answer *and* a table `agent_config` must query to
  sweep layer 7; `context_processing_script` is the smoke gate's answer *and* a field that same
  tool must read. Neither is declared — a token that fires on honest tool code is a bad token,
  not a finding. There is deliberately no stop-list: a too-generic token reddens the suite, and
  that failure is the signal to pick a better one.

  Paired with `test/referenceStatistics.test.js` (#85, statistics), which now shares its comment
  stripper via `test/_stripComments.js` so the two guards cannot drift.

  The sweep this guard formalises found no second leak — see `benchmark/DECISION.md` §M2. That
  is a real result: #87 had already read these files once, and #89's residual gap was the rule
  itself, not a known second instance. The guard's value is prospective.
```

- [ ] **Step 5: Run the full suite one last time**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 6: Commit and open the PR**

```bash
git add benchmark/DECISION.md CHANGELOG.md package.json README.md benchmark/scorecard-agent-doctor.md
git commit -m "docs: record the #89 sweep as DECISION.md §M, bump to 2026.08.0227"
git push -u origin fix/blind-rule-binds-tool-output
```

Then open the PR with a body built from this skeleton — fill the two bracketed lines from the actual outcome, and delete the native-movement section if nothing native-facing moved:

```markdown
## What

The blind rule in `benchmark/README.md` bound Agent Doctor's *instructions*. It now binds every
channel the harness can put in front of the model: instructions, tool descriptions, and tool output.

Tool output is the most direct of the three — it lands in the reasoning loop at the moment of
diagnosis, not in a preamble. Until `2026.08.0222`, `PaToolAgentConfig` emitted the smoke gate's own
expected answer ("threw at line 42") inside a finding. It never fired only because no run has ever
invoked `agent_config`, and it would have activated at exactly the moment the depth work succeeded.

## The guard

`test/blindRule.test.js` reads a ` ```blind-rule-tokens ` block from each of the six specimens and
fails the build when a token reaches any of 11 model-facing sources. A new seed is picked up
automatically and fails until its tokens are declared.

Tokens name **the answer**, not the vocabulary of the question — `sn_aia_trigger_configuration` and
`context_processing_script` are deliberately not declared, because the tools legitimately read them.

Two controls, because a guard that passes on a silently-dead matcher looks exactly like a guard that
passes on clean code: a POSITIVE control asserting the matcher fires, and a NEGATIVE control pinning
that `PaToolRegistry.js`'s comment naming seed 03's answer does **not** fire.

## Sweep result

[Clean across all 11 targets, plus a hand sweep of the seven cores' emitted strings — recorded in
`DECISION.md` §M2. / Found: <file>:<line>, <token>, native-shared yes/no.]

## Native movement

[None — no native-shared text changed. / <file> changed; native's standing seed 1/3/4/5 rows in
`scorecard-agent-doctor.md` are annotated as predating the fix.]

## Not in scope

Depth (`DECISION.md` §K4 remedy 2, §L7) — still the milestone blocker. This is §J5's item 2 of 3 and
a precondition for the v4 scored pass, not part of it.

Closes #89

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Verification before claiming done

- [ ] `npm test` passes in full — not a filtered run.
- [ ] `git diff main -- benchmark/README.md` shows the quoted blind rule unchanged.
- [ ] Every one of the 6 specimens has a non-empty token block.
- [ ] The NEGATIVE control passes — a token in a real comment does not fire.
- [ ] The POSITIVE control passes — the matcher is live.
- [ ] The hand sweep of the seven cores' emitted strings actually happened, and its outcome — including "found nothing" — is in §M2.
- [ ] `DECISION.md` §M states the actual sweep outcome, including a clean one.
- [ ] Version is `2026.08.0227` in `package.json`, the `README.md` badge, and `CHANGELOG.md`.
- [ ] Every native-facing edit is named in §M, or §M states there were none.
