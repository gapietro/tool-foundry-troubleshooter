# The harness has always named its tools — restating §H8 item 3's premise — design

**Issue:** #110
**Date:** 2026-08-05
**Branch:** `docs/schematext-tool-name-leak`
**Deployed main:** `2026.08.0503` (DECISION.md §R)
**Ships as:** `2026.08.0504`
**Status:** design approved; docs + one test, no change to any string the model reads

---

## 1. What this is, and what it deliberately is not

Issue #110 filed a leak: `PaFixReport.schemaText()` renders the layer-to-tool map into every
prompt, qualifying §H8 item 3's non-vacuity premise that *"the harness never names to the model the
tools the test measures."*

Investigating it found the premise is not qualified. **It was never true, and could not have been
true.** `PaToolRegistry.promptBlock()` — ~8-9KB of verbatim tool descriptions naming all seven
tools and cross-referencing them — is in every prompt by design, because a tool-calling agent has
to be told what tools it has.

So this round restates the premise rather than annotating it, and records what replaces it.

**It changes nothing the model reads.** The next thing on the roadmap is the scored pass §R9 asks
for, whose value depends on comparability against §O's baseline. Any edit to prompt text would
confound it. This ships docs and one test.

The scope was set with two explicit rulings:

- **Docs plus a pinning guard test only** — issue option 1, not options 2 or 3.
- **The #109 collision stays inside #110** as a known-open sub-item, unfixed.

## 2. Every site that names a tool to the model

Five, in descending order of size. The issue named two.

| # | Site | What it names | Removable? |
|---|---|---|---|
| 0 | `PaToolRegistry.promptBlock()`, threaded via `PaAgentLoop._safePromptBlock()` → `_buildPrompt()` (`PaAgentLoop.js:98`, `:1695`) | All seven tools with full descriptions, cross-referencing each other | **No** |
| 1 | `PaFixReport.js:1099-1101` — the "EVIDENCE IS CHECKED AGAINST WHAT YOU ACTUALLY CALLED" block | All seven, mapped to evidence-source categories, plus `read_artifact does NOT count` | **No** — see §3 |
| 2 | `PaFixReport.js:1104-1116` — the generated layer-to-tool clause list | All seven, mapped to layers | Yes, at a cost — see §6 |
| 3 | `PaFixReport.js:1130` — the `would_confirm` example | `query_table` | Yes |
| 4 | `PaFixReport.js:732` — the `_checkUnconfirmed` rejection message, reaching the model on the repair turn | `query_table` | Yes |

Sites 0, 1 and 4 are new to the record. Site 2 is generated from `_layerToolMap()` rather than
hand-written, so any future map edit re-leaks by construction — which is what §6's test exists for.

### Site 0 is why the premise cannot be rescued

The catalogue does not merely name the tools; it *teaches their sequencing*. `schema_lookup`'s
description says **"Use it whenever a value read back blank and you need to know whether the column
exists at all"** and **"query_table does that"**; `query_table`'s says **"run schema_lookup first so
your query names real columns"**; `agent_trace`'s says **"page the rest with read_artifact"**.

A harness that withheld this would be a harness whose model could not call tools. There is no
version of the acceptance test in which the measured tools are unnamed.

## 3. Site 1 is load-bearing, which is why issue option 3 is wrong as stated

The evidence-source block is not stray prose. `PaFixReport` validates every citation's `source`
against the tools the run actually invoked (#79, §H8 item 2, verified working in §I5). The model
cannot comply with a rule it is not told, so the mapping — `trace` from
`agent_trace`/`genai_log`/`log_analysis`, `config` from `agent_config`/`genai_log`, `schema` from
`schema_lookup`, `data` from `query_table`/`log_analysis` — has to be stated. It is contract-tested
at `PaFixReport.test.js:1316`.

Issue option 3 ("replace passage 1's per-layer clause list with layer names only") was scoped to
site 2 and did not account for site 1. De-naming site 1 would break a shipped feature. This is
recorded so the option is not revived on scheduling grounds alone.

## 4. What replaces the premise

**Struck:** *the harness never names to the model the tools the test measures.*

**Replaces it:** *the depth gate's direction names no tool.*

This one is true, is enforced, and is the claim the arguments actually rest on:

- `_holdBlock` states gaps as layer numbers and names, never tools.
- `_scrubToolNames` (`PaAgentLoop.js:1776-1793`) replaces every `_ALL_TOOL_NAMES` entry with
  `[tool]` in the model's own quoted-back reasons, so a tool name cannot re-enter the direction by
  the model's own words. Guarded by unit tests in `PaAgentLoop.test.js`.
- The fan-out rank is stated over the map's structure and would produce its ordering under a
  different map (§R, `PaAgentLoop.js:895-900`).

**This is the claim §R4 spends**, and it survives intact. §R4 rejects a tie-break preferring layer 6
because no structural argument picks it over layer 4 "other than *that is where the unreached tool
is*", which "forfeits §H8 item 3's non-vacuity condition". That reasoning is about the *gate*
selecting for a measured tool, not about the catalogue mentioning one. Unaffected.

## 5. The measurement, per tool, and the correction it forces

Issue #110 says the three tools "were invoked in 0 of 51 runs". **That is stale as a present-tense
claim** and is corrected here. §Q3, dated the same day, records the acceptance test met.

| Tool | Status |
|---|---|
| `schema_lookup` | Invoked. v6 smoke, seed 01 runs 1–2. Run 1's call was malformed (`table:incident`, #111) and retrieved nothing; run 2's returned evidence |
| `query_table` | Invoked. v6 smoke, seed 03 run 3 — a well-formed query returning 0 rows, which *is* the finding |
| `genai_log` | **Zero**, now 57 runs (§Q5) |
| `log_analysis` | **Zero**, now 57 runs (§Q5) |

Stated correctly the argument is stronger than the issue's version, not weaker:

**The model was handed full descriptions of all seven tools, an explicit instruction to run
`schema_lookup` before `query_table`, the layer-to-tool map, and the evidence-source map — in every
prompt, for 51 runs — and invoked the measured tools zero times. They were first invoked when a
structural gate aimed the model at a layer (#109).**

Naming a tool is not the mechanism that makes a model call it. Fifty-one runs of naming did
nothing; one structural change did it in a six-run smoke. That is the strongest available evidence
that #109 and #116 are not teaching to the test, and it is available *because* of the leak rather
than in spite of it.

**What it does not establish.** Nothing about correctness. No claim that the naming did or did not
affect any prior score — the 0-of-51 window is consistent with "no effect" but does not prove it,
and a scored pass measures a different quantity. This is bookkeeping on a premise, not a
re-measurement.

## 6. The #109 collision — recorded, not fixed

Site 2 advertises `log_analysis` as satisfying layer 5, and `genai_log`/`log_analysis` as
satisfying layers 1 and 6. The #109 directed gate releases a hold only on the target layer's
**dedicated** tools — for layer 5, `query_table` alone. So for targets on layers 1, 5 and 6 the
harness advertises a strictly wider set than the gate accepts, and a compliant-looking call can
fail to release the hold.

Already documented in the source at `PaAgentLoop.js:583-599` and `:906-910`. Bounded by
`MAX_HOLDS: 2`, which releases the third terminal attempt unconditionally, flagged `capped:true`.

**Never observed live.** §Q5: zero `GATE:` notes across six runs; all seven holds discharged by the
trail; the cap never fired. It is a live mismatch with no measured instance.

**Deliberately unfixed.** Both remedies — narrowing the advertised list, or widening the gate's
release set — change what the model is told, and would confound the scored pass. It stays open on
#110 with the pass's S2–S4 evidence to be read against it.

## 7. What ships

### 7.1 DECISION.md §S

A dated non-pass section, following the **Fix Round 1** precedent, appended after §R. Contents map
to this spec: §S1 the five sites; §S2 site 0 and why the premise cannot be rescued; §S3 the
replacement claim and that §R4 survives; §S4 the per-tool measurement and the 0-of-51 correction;
§S5 the #109 collision as known-open; §S6 what this does not establish.

No verified number moves. No historical text is rewritten.

### 7.2 Inline pointers

A short dated block quote at each site asserting the struck premise, each pointing to §S:

| File | Location | What it asserts today |
|---|---|---|
| `benchmark/DECISION.md` | §H8 item 3 (line 666) | The acceptance test, on which the premise rests |
| `benchmark/DECISION.md` | §P (line 1930) | "so the harness never named a tool and §H8's test stayed non-vacuous" |
| `benchmark/DECISION.md` | §Q3 (line 2072) | "The rule is structural and names no tool" |
| `benchmark/DECISION.md` | §R4 (line 2239) | Spends item 3's non-vacuity condition — annotate that it survives under §4's restatement |
| `src/server/PaAgentLoop.js` | `:568` | "The harness never names a tool (see `_holdBlock`)" — true of `_holdBlock`, false as written |

§Q3's and §P's statements are true *of the depth gate* and false as unrestricted claims; the
annotation says which, rather than striking them.

### 7.3 The guard test

New in `test/PaFixReport.test.js`, sibling to the `_scrubToolNames` guards in
`PaAgentLoop.test.js`. Its polarity is **inverted** from the issue's suggestion: it cannot assert
"`schemaText()` names no registered tool", so it asserts the exact set that IS named. Measured
today that set is all seven — `agent_trace`, `agent_config`, `schema_lookup`, `query_table`,
`genai_log`, `log_analysis`, `read_artifact` — identical to `PaAgentLoop._ALL_TOOL_NAMES`, and the
test asserts set equality against that constant rather than a retyped literal, so the two cannot
drift apart silently.

It does not prevent naming. It prevents site 2 silently widening or narrowing when `_layerToolMap()`
is edited — a change to what the model is told then fails CI and has to go through the record
rather than arriving as a side effect.

Deliberately **not** extended to site 0. The catalogue is 8-9KB of prose under active revision;
pinning its tool mentions would fire on every description edit and be deleted within a month.

### 7.4 Housekeeping

- Correct issue #110's body: add sites 0, 1 and 4; replace the stale "0 of 51" with §5's table.
- `CHANGELOG.md` entry.
- `package.json` and `README.md` badge: `2026.08.0503` → `2026.08.0504`.
- Branch → PR → merge. No direct commit to main.

## 8. Testing

`npm test` must pass unchanged apart from the one added test. No behavioural code is touched, so
the existing suite is the regression check: any failure means this round edited something it
claimed not to.

Verification that nothing the model reads has changed: `git diff main -- src/` must show only
comment-line changes, and `PaFixReport.js` must show none at all.

## 9. What this round does not do

- **No prompt change.** Sites 2, 3 and 4 keep their tool names.
- **No fix for the #109 collision** (§6).
- **Nothing about correctness**, and nothing about native.
- **No claim about the scored pass**, which this exists to leave uncontaminated.
