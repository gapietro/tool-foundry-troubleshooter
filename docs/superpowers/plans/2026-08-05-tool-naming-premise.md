# Tool-Naming Premise Restatement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record that §H8 item 3's "the harness never names the measured tools" premise was never true, replace it with the narrower claim that is, and pin the tool names `schemaText()` emits so the set cannot drift silently.

**Architecture:** Documentation plus one Jest test. `benchmark/DECISION.md` gains a new §S and four inline pointers; `src/server/PaAgentLoop.js` gains one corrected comment. **No string the model reads changes** — the next roadmap item is the scored pass §R9 asks for, and its value depends on comparability against §O's baseline.

**Tech Stack:** Markdown (`benchmark/DECISION.md`, `CHANGELOG.md`, `README.md`), Jest (`test/PaFixReport.test.js`), ES5 Rhino Script Includes loaded through `test/_loadScriptInclude.js`, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-08-05-tool-naming-premise-design.md`
**Issue:** #110
**Branch:** `docs/schematext-tool-name-leak` (already created, spec already committed as `f2779d4`)

## Global Constraints

- **Never commit to `main`.** All work on `docs/schematext-tool-name-leak`, merged via PR.
- **No prompt text may change.** `src/server/PaFixReport.js` must not be modified at all. `src/server/PaAgentLoop.js` may only gain comment-line changes.
- Version: `2026.08.0503` → **`2026.08.0504`** in `package.json` and the `README.md` badge.
- Test files live in `test/`, never under `src/` — `now-sdk build` lints `src/` against the platform runtime and a Jest `require('vm')` fails with TS213/TS307 (DESIGN.md R-14).
- Script Include sources are ES5 Rhino with no module wrapper; tests load them via `loadScriptInclude('<File>.js', { JSON: JSON })`.
- DECISION.md is append-plus-annotate: **no verified number moves, no historical text is rewritten.** Corrections are added as marked, dated block quotes.
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `test/PaFixReport.test.js` | Modify — append one test to the existing citation-clause describe block | Pins the exact tool set `schemaText()` names, and that `_layerToolMap()` cannot introduce a tool `_scrubToolNames` does not strip |
| `benchmark/DECISION.md` | Modify — append §S after §R; insert four block-quote pointers | The permanent record: five sites, the restated premise, the per-tool measurement, the #109 collision as known-open |
| `src/server/PaAgentLoop.js` | Modify — comment at `:568` only | Corrects a flatly false in-source claim |
| `CHANGELOG.md` | Modify — new `## 2026.08.0504` section at the top of the entries | Release record |
| `package.json`, `README.md` | Modify — version string / badge | Version bump per CLAUDE.md |

---

### Task 1: Pin the tool set `schemaText()` names

**Files:**
- Test: `test/PaFixReport.test.js` — append after the test ending at line 1339 (`the citation clause correctly maps each evidence source to the tools that actually support it (per _citationToolMap)`)

**Interfaces:**
- Consumes: `PaFixReport#schemaText()` → `String`; `PaFixReport#_layerToolMap()` → `{1..7: String[]}`; `PaAgentLoop#_ALL_TOOL_NAMES` → `String[]` (a prototype property, seven entries). `loadScriptInclude` is already imported at `test/PaFixReport.test.js:18`; the local `load()` helper at `:20-23` returns a `PaFixReport`.
- Produces: nothing consumed by later tasks.

**Why this test is inverted from what issue #110 asked for.** The issue suggests asserting that `schemaText()` names no registered tool. It cannot: the citation clause is load-bearing for #79's citation validation (the model must be told which tool backs which evidence source in order to comply), and it is already contract-tested at `:1308`. So this test pins the set that IS named.

**Three assertions, because a whole-text substring scan is not enough.** All seven tools appear in the citation clause as well as the layer clause, so "is `schema_lookup` mentioned anywhere in `schemaText()`?" stays true even if `_layerToolMap()` drops it entirely. The per-layer correspondence has to be checked positionally, the way the existing `_citationToolMap` test at `:1308` checks the citation clause:

1. **Per-layer correspondence.** Inside the `A LAYER MARKED SWEPT` clause, each layer's advertised tool list equals `_layerToolMap()[layer]` exactly. This is the assertion with real teeth — any map edit changes what the model is told and fails CI.
2. **Registered-set membership.** Every tool in `_layerToolMap()` is in `_ALL_TOOL_NAMES` — catches widening where it bites: `_ALL_TOOL_NAMES` is what `PaAgentLoop._scrubToolNames` strips from the hold block, so a tool entering the layer map without entering that constant would leak into the depth gate's direction, breaking the one claim §S says still holds.
3. **Whole-set presence.** Every `_ALL_TOOL_NAMES` entry appears somewhere in `schemaText()` — a coarse backstop documenting that the leak is total, and the assertion that fails if someone "fixes" the leak by deletion without going through §S.

- [ ] **Step 1: Write the failing test**

Append to `test/PaFixReport.test.js`, immediately after the closing `})` of the `_citationToolMap` test:

```javascript
    // -----------------------------------------------------------------
    // #110 — the tool-name set schemaText() emits is PINNED, not empty.
    //
    // §H8 item 3 rested on "the harness never names the measured tools to
    // the model". That premise was never true: PaToolRegistry.promptBlock()
    // puts ~8-9KB of descriptions for all seven tools into every prompt by
    // design, because a tool-calling agent has to be told what tools it has.
    // schemaText() names them too — in the citation clause (load-bearing for
    // #79) and in the per-layer clause list generated from _layerToolMap().
    //
    // This test does NOT forbid that, and must not be "fixed" by removing
    // names. It pins WHICH tools appear so the set cannot drift silently:
    // a change to what the model is told then fails CI and has to go through
    // DECISION.md §S rather than arriving as a side effect of a map edit.
    // -----------------------------------------------------------------

    test('the SWEPT clause advertises exactly _layerToolMap per layer, and introduces no tool _scrubToolNames cannot strip (#110)', () => {
        const fx = load()
        const text = fx.schemaText()
        const map = fx._layerToolMap()

        // _ALL_TOOL_NAMES is the list PaAgentLoop._scrubToolNames strips out
        // of the hold block. Read it from the source rather than retyping it,
        // so this test and the scrubber cannot disagree.
        const loopCtx = loadScriptInclude('PaAgentLoop.js', { JSON: JSON })
        const allTools = new loopCtx.PaAgentLoop({})._ALL_TOOL_NAMES
        expect(allTools.length).toBe(7)

        // (1) Per-layer correspondence, checked POSITIONALLY inside the SWEPT
        // clause. A whole-text scan would not catch a layer-map narrowing:
        // all seven tools are also named in the citation clause above, so
        // "is schema_lookup mentioned somewhere?" stays true even if layer 4
        // stops advertising it. Same isolation technique as the
        // _citationToolMap test above.
        const start = text.indexOf('A LAYER MARKED SWEPT')
        expect(start).not.toBe(-1)
        const clause = text.slice(start)

        Object.keys(map).forEach((layer) => {
            // "4 (Schema) needs one of: schema_lookup" — capture the tool
            // list between "needs one of: " and the clause separator.
            const re = new RegExp('\\b' + layer + ' \\([^)]*\\) needs one of: ([^;.]+)')
            const m = clause.match(re)
            expect(m).not.toBeNull()

            const advertised = m[1]
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .sort()
            expect(advertised).toEqual(map[layer].slice().sort())
        })

        // (2) Registered-set membership — widening, where it bites. A tool
        // entering _layerToolMap() without entering _ALL_TOOL_NAMES would be
        // rendered into every prompt here AND survive _scrubToolNames in the
        // hold block, breaking the one claim §S says still holds: that the
        // depth gate's DIRECTION names no tool.
        Object.keys(map).forEach((layer) => {
            map[layer].forEach((t) => {
                expect(allTools).toContain(t)
            })
        })

        // (3) Whole-set presence — a coarse backstop recording that the leak
        // is total. This is the assertion that fails if someone "fixes" #110
        // by deleting names instead of going through DECISION.md §S.
        const named = allTools.filter((t) => text.indexOf(t) !== -1).sort()
        expect(named).toEqual(allTools.slice().sort())
    })
```

- [ ] **Step 2: Run the test and confirm it PASSES**

```bash
npx jest test/PaFixReport.test.js -t '#110' --verbose
```

Expected: **PASS**. This is a characterization test — it pins behaviour that already exists, so a green run on first write is correct, not a bug. Step 3 is what proves it has teeth.

- [ ] **Step 3: Prove the pin has teeth — perturb, confirm FAIL, revert**

This step exists because `52a0798` shipped a guard that was weaker than the thing it guarded. Do not skip it.

**Perturbation A — widening.** Temporarily edit `src/server/PaFixReport.js:368` from:

```javascript
            1: ['agent_trace', 'genai_log', 'log_analysis'],
```

to:

```javascript
            1: ['agent_trace', 'genai_log', 'log_analysis', 'not_a_real_tool'],
```

Run: `npx jest test/PaFixReport.test.js -t '#110'`
Expected: **FAIL** on assertion (2), `expect(allTools).toContain('not_a_real_tool')`.

Revert: `git checkout -- src/server/PaFixReport.js`

**Perturbation B — narrowing.** Temporarily edit `src/server/PaFixReport.js:371` from:

```javascript
            4: ['schema_lookup'],
```

to:

```javascript
            4: ['agent_config'],
```

Run: `npx jest test/PaFixReport.test.js -t '#110'`
Expected: **FAIL** on assertion (1), layer `4` — advertised `['agent_config']` against expected `['schema_lookup']`.

Note that assertion (3) does **not** fire here, and that is expected: `schema_lookup` is still named in the citation clause. This is why assertion (1) checks positionally rather than scanning the whole text. If the failure comes from (3) rather than (1), the clause isolation is wrong — fix the regex, do not relax the assertion.

Revert: `git checkout -- src/server/PaFixReport.js`

- [ ] **Step 4: Confirm the working tree is clean of perturbations and the full suite passes**

```bash
git diff --stat -- src/
npm test
```

Expected: `git diff --stat -- src/` prints **nothing** (perturbations reverted). `npm test` passes with one more test than before.

- [ ] **Step 5: Commit**

```bash
git add test/PaFixReport.test.js
git commit -m "$(cat <<'EOF'
test: pin what the SWEPT clause advertises per layer (#110)

The premise that the harness never names the measured tools was never true -
PaToolRegistry.promptBlock() puts all seven into every prompt by design. This
test does not forbid that and must not be "fixed" by removing names.

Three assertions. (1) Inside the SWEPT clause, each layer advertises exactly
_layerToolMap()[layer], checked positionally - a whole-text scan cannot catch
a layer-map narrowing, because all seven tools are also named in the citation
clause above, so "is schema_lookup mentioned somewhere" stays true even if
layer 4 stops advertising it. Same isolation technique as the _citationToolMap
test. (2) Every mapped tool is in _ALL_TOOL_NAMES - a tool entering the map
without entering that constant would leak into the depth gate's direction via
_scrubToolNames, breaking the one claim §S says still holds. (3) A coarse
whole-set backstop that fails if someone deletes names instead of going
through §S.

Teeth verified by perturbation in both directions.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: DECISION.md §S and the five inline pointers

**Files:**
- Modify: `benchmark/DECISION.md` — append §S at end of file (currently 2315 lines); insert block quotes at lines 666, 1930, 2072, 2239
- Modify: `src/server/PaAgentLoop.js:568` — comment only

**Interfaces:**
- Consumes: nothing.
- Produces: §S is referenced by Task 3's CHANGELOG entry and by the corrected issue body.

**Insert the pointers before appending §S**, or the line numbers below shift. Work bottom-up (2239, then 2072, then 1930, then 666) so each insertion leaves the earlier line numbers intact.

- [ ] **Step 1: Insert the §R4 pointer**

Find this text in `benchmark/DECISION.md` (§R4, around line 2239):

```
**A tie-break that prefers layer 6** is the only route to `genai_log`, and no structural argument
picks it over layer 4 other than "that is where the unreached tool is". That forfeits §H8 item 3's
non-vacuity condition and would make 57 runs of evidence unreadable.
```

Append immediately after it, as a new paragraph:

```markdown
> **Restated 2026-08-05 (#110, §S).** §H8 item 3's non-vacuity condition as originally worded — that
> the harness never names the measured tools — was never true. This argument does not depend on it.
> It depends on the narrower claim that survives: the depth gate's *direction* names no tool. A
> tie-break selecting for layer 6 because that is where the unreached tool sits would forfeit that
> claim, and the rejection stands unchanged.
```

- [ ] **Step 2: Insert the §Q3 pointer**

Find this text (§Q3, around line 2072):

```
**The qualification stated in the design's §8 stands and is not waived.** The ranked order puts
layers 4 and 5 near the top, which is where §H8's tools live. The rule is structural and names no
tool, but a pass earned under this design is not the same as a pass earned by a harness that found
those tools unaided. Read Q2 as "the gate can aim the model at a layer", not as "the harness
investigates".
```

Append immediately after it:

```markdown
> **Scoped 2026-08-05 (#110, §S).** "The rule is structural and names no tool" is true of *the
> rule*, and false as an unrestricted claim about the harness: the prompt names all seven tools and
> always has. The sentence is left standing because its subject is the ranking rule, which is
> exactly the scope §S preserves.
```

- [ ] **Step 3: Insert the §P pointer**

Find this text (§P, around line 1930):

```
  defect, confirmed avoided in the live artifact), and `_scrubToolNames` replaced the tool names in
  the model's own quoted-back reasons with `[tool]` — so the harness never named a tool and §H8's
  test stayed non-vacuous.
```

Insert a new bullet immediately after that bullet, at the same indentation level as the surrounding list items:

```markdown
- > **Corrected 2026-08-05 (#110, §S).** "The harness never named a tool" is false as written and
  > was false when written. `_scrubToolNames` kept tool names out of *the hold block*; the prompt
  > that block sits inside named all seven throughout, via `PaToolRegistry.promptBlock()`. The
  > `[tool]` substitution is real and is verified — read the claim as scoped to the interrogation
  > block, which is what §S preserves.
```

- [ ] **Step 4: Insert the §H8 item 3 pointer**

Find this text (§H8 item 3, around line 666):

```
   (H5). Whatever is tried next — instruction changes, a required-sweep gate, forced tool selection —
   the acceptance test is the same: a run that reaches `schema_lookup`, `query_table` or `genai_log`
   on the seed that needs it.
```

Append immediately after it, indented to stay inside list item 3:

```markdown
   > **Qualified 2026-08-05 (#110, §S).** The non-vacuity argument later built on this item assumed
   > the harness never names these three tools to the model. It always has — all seven, with full
   > descriptions and their sequencing, in every prompt. The acceptance test itself is unaffected;
   > what changes is the premise used to argue it is non-vacuous. See §S.
```

- [ ] **Step 5: Correct the false claim in the source**

In `src/server/PaAgentLoop.js`, find line 568:

```javascript
     * tools close it. The harness never names a tool (see `_holdBlock`).
```

Replace with:

```javascript
     * tools close it. The GATE's DIRECTION names no tool — `_holdBlock`
     * states gaps as layer numbers and names, and `_scrubToolNames` strips
     * tool names out of the model's own quoted-back reasons. The PROMPT
     * names all seven and always has, via `PaToolRegistry.promptBlock()`;
     * see issue #110 and DECISION.md §S. Do not read this as a claim that
     * the model is unaware of the tools — it is a claim about the gate.
```

- [ ] **Step 6: Verify only comments changed in `src/`**

```bash
git diff -- src/
```

Expected: `src/server/PaAgentLoop.js` only, and every changed line begins with `*` or `/*` inside the existing JSDoc block. `src/server/PaFixReport.js` must not appear.

- [ ] **Step 7: Append §S to `benchmark/DECISION.md`**

Append at end of file:

```markdown

---

## S. The harness has always named its tools — restating §H8 item 3's premise (`2026.08.0504`, #110)

Filed as a leak: `PaFixReport.schemaText()` renders the layer-to-tool map into every prompt,
qualifying the premise that *"the harness never names to the model the tools the test measures."*
Investigating it found the premise is not qualified. **It was never true, and could not have been
true.** No measurement was run; this is bookkeeping on a claim, and it changes nothing the model
reads.

Design: `docs/superpowers/specs/2026-08-05-tool-naming-premise-design.md`.

### S1. Five sites name a tool to the model, not two

| # | Site | What it names | Removable? |
|---|---|---|---|
| 0 | `PaToolRegistry.promptBlock()` → `PaAgentLoop._safePromptBlock()` → `_buildPrompt()` (`PaAgentLoop.js:98`, `:1695`) | All seven, full descriptions, cross-referencing each other | **No** |
| 1 | `PaFixReport.js:1099-1101` — the "EVIDENCE IS CHECKED" block | All seven, mapped to evidence-source categories | **No** — see S3 |
| 2 | `PaFixReport.js:1104-1116` — the generated per-layer clause list | All seven, mapped to layers | Yes, at a cost — see S6 |
| 3 | `PaFixReport.js:1130` — the `would_confirm` example | `query_table` | Yes |
| 4 | `PaFixReport.js:732` — the `_checkUnconfirmed` rejection, reaching the model on the repair turn | `query_table` | Yes |

Sites 0, 1 and 4 are new to the record. Site 2 is generated from `_layerToolMap()` rather than
hand-written, so any map edit re-leaks by construction — which S7's test now catches.

### S2. Site 0 is why the premise cannot be rescued

The catalogue does not merely name the tools, it teaches their sequencing. `schema_lookup`'s
description says **"Use it whenever a value read back blank and you need to know whether the column
exists at all"** and **"query_table does that"**; `query_table`'s says **"run schema_lookup first so
your query names real columns"**; `agent_trace`'s says **"page the rest with read_artifact"**.

A harness that withheld this would be a harness whose model could not call tools. **There is no
version of the acceptance test in which the measured tools are unnamed.**

### S3. Site 1 is load-bearing, so issue option 3 is wrong as stated

The evidence-source block is not stray prose. `PaFixReport` validates every citation's `source`
against the tools the run actually invoked (#79, §H8 item 2, verified working in §I5). A model
cannot comply with a rule it is not told, so the mapping has to be stated; it is contract-tested at
`PaFixReport.test.js:1308`. The issue's option 3 was scoped to site 2 and did not account for site
1. De-naming site 1 breaks a shipped feature. Recorded so the option is not revived on scheduling
grounds alone.

### S4. What replaces the premise

**Struck:** *the harness never names to the model the tools the test measures.*

**Replaces it:** *the depth gate's direction names no tool.*

True, enforced, and the claim the arguments actually rest on: `_holdBlock` states gaps as layer
numbers and names; `_scrubToolNames` (`PaAgentLoop.js:1776-1793`) replaces every `_ALL_TOOL_NAMES`
entry with `[tool]` in the model's own quoted-back reasons; the fan-out rank is stated over the
map's structure and would produce its ordering under a different map.

**§R4 survives intact.** Its rejection of a layer-6 tie-break turns on the *gate* selecting for a
measured tool, not on the catalogue mentioning one.

### S5. The measurement, per tool — and a correction

Issue #110 said the three tools "were invoked in 0 of 51 runs". **Stale as a present-tense claim.**
§Q3, dated the same day, records the acceptance test met.

| Tool | Status |
|---|---|
| `schema_lookup` | Invoked — v6 smoke, seed 01 runs 1–2. Run 1's call was malformed (`table:incident`, #111) and retrieved nothing; run 2's returned evidence |
| `query_table` | Invoked — v6 smoke, seed 03 run 3; a well-formed query returning 0 rows, which *is* the finding |
| `genai_log` | **Zero**, now 57 runs (§Q5) |
| `log_analysis` | **Zero**, now 57 runs (§Q5) |

Stated correctly the argument is **stronger** than the issue's version:

**The model was handed full descriptions of all seven tools, an explicit instruction to run
`schema_lookup` before `query_table`, the layer-to-tool map and the evidence-source map — in every
prompt, for 51 runs — and invoked the measured tools zero times. They were first invoked when a
structural gate aimed it at a layer (#109).**

Naming a tool is not the mechanism that makes a model call it. Fifty-one runs of naming did
nothing; one structural change did it in a six-run smoke. That is the strongest available evidence
that #109 and #116 are not teaching to the test — available *because* of the leak, not in spite of
it.

### S6. The #109 collision — recorded, not fixed

Site 2 advertises `log_analysis` as satisfying layer 5, and `genai_log`/`log_analysis` as satisfying
layers 1 and 6. The #109 directed gate releases only on the target layer's **dedicated** tools — for
layer 5, `query_table` alone. So for targets on layers 1, 5 and 6 the harness advertises a strictly
wider set than the gate accepts, and a compliant-looking call can fail to release the hold. Already
documented in source at `PaAgentLoop.js:583-599` and `:906-910`; bounded by `MAX_HOLDS: 2`.

**Never observed live** — §Q5 records zero `GATE:` notes across six runs, all seven holds discharged
by the trail, the cap never fired. A live mismatch with no measured instance.

**Deliberately unfixed.** Both remedies — narrowing the advertised list, or widening the gate's
release set — change what the model is told and would confound the scored pass §R9 asks for. It
stays open on #110, to be read against that pass's S2–S4 evidence.

### S7. What shipped

DECISION.md §S plus dated pointers at §H8 item 3, §P, §Q3 and §R4; a corrected comment at
`PaAgentLoop.js:568`; and one test pinning what site 2 advertises — each layer's tool list checked
*positionally* against `_layerToolMap()`, plus that the map cannot introduce a tool
`_scrubToolNames` does not strip. Positional matters: all seven tools are named in the citation
clause too, so a whole-text scan would not notice a layer losing its tool. The test is deliberately
**not** extended to site 0 — the catalogue is 8-9KB of prose under active revision, and pinning its
tool mentions would fire on every description edit.

### S8. What this does not establish

- **Nothing about correctness**, and nothing about native.
- **No claim that the naming did or did not affect any prior score.** The 0-of-51 window is
  consistent with "no effect" but does not prove it.
- **No prompt change**, deliberately — the scored pass §R9 asks for must stay comparable to §O's
  baseline.
- **No fix for the #109 collision** (S6).
```

- [ ] **Step 8: Verify no historical text was rewritten**

```bash
git diff -- benchmark/DECISION.md | grep '^-' | grep -v '^---'
```

Expected: **no output**. Every change is an insertion; a deleted line means historical text moved, which this round forbids.

- [ ] **Step 9: Commit**

```bash
git add benchmark/DECISION.md src/server/PaAgentLoop.js
git commit -m "$(cat <<'EOF'
docs: DECISION.md §S restates the tool-naming premise (#110)

Five sites name a tool to the model, not the two the issue filed. Site 0 -
PaToolRegistry.promptBlock(), ~8-9KB of descriptions teaching the tools'
sequencing - is in every prompt by design and is not removable, so §H8 item
3's "the harness never names the measured tools" was never true.

Struck and replaced with the claim that is true and is load-bearing: the
depth gate's direction names no tool. §R4 survives - its rejection of a
layer-6 tie-break turns on the gate selecting for a measured tool, not on
the catalogue mentioning one.

Site 1 is load-bearing for #79's citation validation, which makes the issue's
option 3 wrong as stated rather than merely badly timed.

Corrects the issue's "0 of 51", stale since §Q3: schema_lookup and query_table
have been invoked; genai_log and log_analysis are still zero across 57 runs.

Pointers added at §H8 item 3, §P, §Q3 and §R4, and the flatly false comment at
PaAgentLoop.js:568 corrected. No historical text rewritten, no verified number
moved, no string the model reads changed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Housekeeping — version, changelog, issue body, PR

**Files:**
- Modify: `package.json` (`"version"`), `README.md:3` (badge), `CHANGELOG.md` (new top entry at line 20)
- External: issue #110 body via `gh`

**Interfaces:**
- Consumes: §S from Task 2 (the CHANGELOG entry and the issue correction both cite it).
- Produces: nothing.

- [ ] **Step 1: Bump the version in both places**

In `package.json`, change `"version": "2026.08.0503",` to `"version": "2026.08.0504",`.

In `README.md` line 3, change:

```markdown
![Version](https://img.shields.io/badge/version-2026.08.0503-blue)
```

to:

```markdown
![Version](https://img.shields.io/badge/version-2026.08.0504-blue)
```

- [ ] **Step 2: Verify both moved and nothing else did**

```bash
grep -rn '2026\.08\.0503' package.json README.md
```

Expected: **no output**.

- [ ] **Step 3: Add the CHANGELOG entry**

Insert immediately above the `## 2026.08.0503 — 2026-08-05` heading (currently line 20):

```markdown
## 2026.08.0504 — 2026-08-05

### Documented

- **§H8 item 3's tool-naming premise was never true, and is restated rather than qualified (#110).**
  The premise — that the harness never names to the model the tools the acceptance test measures —
  underpinned every non-vacuity reading of §H8. `PaToolRegistry.promptBlock()` puts ~8-9KB of
  descriptions for all seven tools into every prompt by design, and those descriptions teach the
  tools' *sequencing*: `schema_lookup`'s says "query_table does that", `query_table`'s says "run
  schema_lookup first". A tool-calling agent has to be told what tools it has, so there is no
  version of the test in which the measured tools are unnamed. Struck and replaced with the claim
  that is true and is what the arguments actually rest on: **the depth gate's direction names no
  tool** (`_holdBlock` + `_scrubToolNames`). §R4's rejection of a layer-6 tie-break survives
  unchanged — it turns on the gate selecting for a measured tool, not on the catalogue mentioning
  one. Five naming sites are now on the record, three of them new; site 1, the evidence-source map,
  is load-bearing for #79's citation validation, which makes the issue's "just remove the names"
  option wrong as stated rather than merely badly timed. DECISION.md §S, with dated pointers at
  §H8 item 3, §P, §Q3 and §R4.

- **The issue's "0 of 51 runs" was stale and is corrected per tool (#110).** §Q3, dated the same
  day, records the acceptance test met. `schema_lookup` and `query_table` have been invoked;
  `genai_log` and `log_analysis` are still at **zero across 57 runs**. Stated correctly the argument
  is stronger: the model was handed full descriptions of all seven tools, plus the layer and
  evidence-source maps, in every prompt for 51 runs, and called the measured tools zero times — they
  were first reached when a structural gate aimed it at a layer. **Naming is not the mechanism.**

- **The #109 collision is recorded as known-open and deliberately unfixed (#110).** The per-layer
  clause list advertises `log_analysis` for layer 5 and `genai_log`/`log_analysis` for layers 1 and
  6, but the directed gate releases only on the target layer's dedicated tools, so a
  compliant-looking call can fail to release. Bounded by `MAX_HOLDS: 2` and never observed live
  (§Q5: zero `GATE:` notes, cap never fired). Both remedies change what the model is told and would
  confound the scored pass §R9 asks for. DECISION.md §S6.

### Added

- **A test pinning what the per-layer clause advertises (#110).** Inverted from what the issue asked
  for, because the names cannot be removed. It checks each layer's advertised tool list
  *positionally* against `_layerToolMap()` — a whole-text scan would miss a narrowing, since all
  seven tools are named in the citation clause as well — and that the map introduces no tool outside
  `_ALL_TOOL_NAMES`, which is where widening bites: such a tool would also survive `_scrubToolNames`
  and leak into the depth gate's direction. Teeth verified by perturbation in both directions. Not
  extended to `PaToolRegistry.promptBlock()`, whose 8-9KB of prose is under active revision.

### Unchanged

- **No string the model reads.** `src/server/PaFixReport.js` is untouched; `PaAgentLoop.js` gained
  one corrected comment. The scored pass §R9 asks for stays comparable to §O's baseline.

```

- [ ] **Step 4: Run the full suite and commit**

```bash
npm test
git add package.json README.md CHANGELOG.md
git commit -m "$(cat <<'EOF'
chore: version 2026.08.0504 and changelog (#110)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: `npm test` passes.

- [ ] **Step 5: Correct issue #110's body**

The issue body is wrong in two ways: it enumerates two naming sites when there are five, and its "0 of 51 runs" is stale. **Prepend a rewrite banner to the existing body — do not delete the original filing**, which already carries one such banner from 2026-08-04 and is part of the record.

Let `SCRATCH` be the session scratchpad directory. Fetch the current body:

```bash
gh issue view 110 --json body --jq .body > "$SCRATCH/110-body-original.md"
```

Read `$SCRATCH/110-body-original.md`, then use the Write tool to create `$SCRATCH/110-body-corrected.md` containing the banner below **followed verbatim by the entire original body**. Do not hand-edit the original text; the banner supersedes it.

Banner:

```markdown
> **Rewritten again 2026-08-05 — see DECISION.md §S.** Two corrections to what is below.
>
> **1. There are five naming sites, not two — and the premise was never true.**
> `PaToolRegistry.promptBlock()` puts ~8-9KB of descriptions for all seven tools into every prompt
> by design (`PaAgentLoop.js:98`, `:1695`), and those descriptions teach the tools' sequencing
> (`schema_lookup`: *"query_table does that"*; `query_table`: *"run schema_lookup first"*). A
> tool-calling agent has to be told what tools it has. Also missed below: `PaFixReport.js:1099-1101`
> (the evidence-source map, all seven tools, **load-bearing for #79** — which makes the suggested
> option 3 wrong as stated, not merely badly timed) and `PaFixReport.js:732` (the `_checkUnconfirmed`
> rejection, reaching the model on the repair turn).
>
> **2. "Invoked in 0 of 51 runs" is stale.** §Q3, dated the same day this was rewritten, records
> the acceptance test met. `schema_lookup` was invoked (v6 seed 01 runs 1–2) and `query_table` (v6
> seed 03 run 3). Only `genai_log` and `log_analysis` remain at zero, now 57 runs. The argument is
> *stronger* stated correctly — 51 runs of naming produced nothing; one structural change produced
> three calls.
>
> **Status:** the premise is restated in DECISION.md §S and the naming is pinned by a test
> (`2026.08.0504`). **This issue stays OPEN for the #109 collision only** — the per-layer clause
> list advertises a wider tool set than the directed gate accepts (§S6). Unfixed deliberately:
> both remedies change what the model is told and would confound the scored pass §R9 asks for.

---

```

Then apply it and confirm the issue is still open:

```bash
gh issue edit 110 --body-file "$SCRATCH/110-body-corrected.md"
gh issue view 110 --json state,body --jq '.state, (.body | split("\n")[0])'
```

Expected: `OPEN`, followed by the banner's first line. **#110 must not be closed** — it stays open for the #109 collision (§S6).

- [ ] **Step 6: Push and open the PR**

```bash
git push -u origin docs/schematext-tool-name-leak
gh pr create --title "docs: restate §H8 item 3's tool-naming premise, and pin the naming (#110)" --body "$(cat <<'EOF'
## What

§H8 item 3's non-vacuity premise — *"the harness never names to the model the tools the test
measures"* — was never true. `PaToolRegistry.promptBlock()` puts ~8-9KB of descriptions for all
seven tools into every prompt by design, teaching their sequencing. A tool-calling agent has to be
told what tools it has.

Struck and replaced with the claim that is true and is load-bearing: **the depth gate's direction
names no tool**. §R4 survives — its rejection of a layer-6 tie-break turns on the gate selecting for
a measured tool, not on the catalogue mentioning one.

## Why it matters

Issue #110 filed this as a `schemaText()` leak qualifying the premise. It is larger than that (five
sites, three new to the record) and the honest reading is a restatement, not an annotation. Better
that this is on the record before the scored pass than discovered by whoever scores it.

The measurement cuts in the harness's favour and is stronger stated correctly: the model was handed
full descriptions of all seven tools, plus an explicit instruction to run `schema_lookup` before
`query_table`, in every prompt for 51 runs — and invoked the measured tools zero times. They were
first reached when a structural gate aimed it at a layer (#109). **Naming is not the mechanism**, which
is the strongest available evidence that #109 and #116 are not teaching to the test.

## What ships

- `benchmark/DECISION.md` §S, with dated pointers at §H8 item 3, §P, §Q3 and §R4
- One corrected comment at `PaAgentLoop.js:568`
- One test pinning the tool set `schemaText()` names, in both directions; teeth verified by perturbation
- Corrected issue body (five sites; the stale "0 of 51")

## What deliberately does not ship

**No string the model reads changes.** `PaFixReport.js` is untouched. The next roadmap item is the
scored pass §R9 asks for, whose value depends on comparability against §O's baseline.

The **#109 collision** stays open on #110: the per-layer clause list advertises a wider tool set than
the directed gate accepts. Bounded by `MAX_HOLDS: 2`, never observed live (§Q5: cap never fired).
Both remedies change what the model is told.

## Verification

- `npm test` passes
- `git diff main -- src/` shows comment lines only; `PaFixReport.js` does not appear
- `git diff main -- benchmark/DECISION.md | grep '^-'` is empty — every change is an insertion

Closes nothing. #110 stays open for §S6.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Verification Checklist

Run before requesting review:

- [ ] `npm test` — passes, one test added
- [ ] `git diff main --stat -- src/` — `PaAgentLoop.js` only; `PaFixReport.js` absent
- [ ] `git diff main -- src/` — every changed line is inside a JSDoc comment
- [ ] `git diff main -- benchmark/DECISION.md | grep '^-' | grep -v '^---'` — empty
- [ ] `grep -rn '2026\.08\.0503' package.json README.md` — empty
- [ ] `grep -c '^## S\.' benchmark/DECISION.md` — 1
- [ ] Issue #110 body carries the rewrite banner and remains OPEN
