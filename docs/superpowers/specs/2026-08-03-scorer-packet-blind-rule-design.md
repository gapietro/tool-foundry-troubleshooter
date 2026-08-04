# The blind rule must bind scorer packets — design

**Date:** 2026-08-03
**Issue:** #100 (seed specs narrate prior passes' scored outcomes, so blind SCORER packets leak the answer and the expected grade)
**Branch:** `fix/scorer-packet-blind-rule`
**Status:** approved, ready for implementation planning

---

## Problem

`benchmark/README.md`'s blind rule binds three channels — instructions, tool descriptions, tool
output — and all three are **things that reach the harness**. Seed specs deliberately never reach
the harness; they *are* the answer key.

That was sufficient while a human operator scored the rows. It stopped being sufficient at v3, when
scoring moved to **independent blind agents** whose packets embed the seed spec so the scorer knows
the expected root-cause layer and fix target. Nothing bound what else those specs carried.

Four of five specs narrate previous passes' outcomes, including literal grades:

- `seed-03-missing-data.md` — *"Both scored runs diagnosed layer 5 … and **scored 6/6**."*
- `seed-04-genai-unmapped.md` — *"the doubled scored runs SPLIT — run 1 found the dangling `api` … run 2 named the empty `connection` … and **scored the canonical 2/0/1/0 decoy row**."*
- `seed-05-inactive-usecase.md` — *"Both scored runs named the specific gate … **earning full — not partial — fix-target credit**."*
- `seed-02-ambiguous-instruction.md` — *"…in both scored runs, which were scored strictly against the expected layer-2 answer (**2/6, fail**…)"*

A scorer holding this knows not only the right answer but the grade a comparable run received, and —
in seed 05's case — the exact credit level it is about to assign.

**The existing rule protects the measurement subject. This protects the measurement instrument.**
Both are needed once the instrument is itself a model.

**Measured cost.** `DECISION.md` §O5 puts the leak at roughly one row on a 10-row pass (Round A,
leaked → 2/10; Round C, redacted → 3/10, scorer topology held fixed). Small, and stated there as
SUGGESTED at n=1. The reason to fix it is not the size of the effect but that **every future scored
pass inherits it** until the rule is extended — and the v4 pass had to hand-redact 29 files mid-pass
to work around it.

---

## Goal

A seed spec that is safe to hand to a blind scorer **by default**, with a guard that fails the build
prospectively — the same protection the blind rule already gives the harness channels — and without
losing the prior-pass knowledge, which is real project record and belongs somewhere.

---

## The finding that shapes the work

The split is **sentence-level, not block-level.** The initial reading — "move the `OBSERVED AT TASK
12` callouts" — does not survive contact with the text. Seed 05's callout contains, in adjacent
sentences:

> the trigger config stayed `active=false` as seeded … **no execution plan was created anywhere on
> the instance** … — the absence the seed exists to produce.

which is fixture ground truth a scorer needs in order to judge an absence diagnosis at all, and

> Both scored runs named the specific gate … **earning full — not partial — fix-target credit**

which is the leak. Seed 04's callout splits the same way: the substituted capability sys_id and the
reproduced failure signature are fixture state; *"run 1 found … run 2 named … and scored the
canonical 2/0/1/0 decoy row"* is not.

Consequence: this is five careful rewrites, not five cut-and-pastes, and the retained callouts are
restated in a **fixture voice** (*"Fixture state, verified 2026-08-02: …"*) rather than a prior-pass
voice.

---

## The classification rule

Taken from the issue, and it discriminates correctly across all five specs as written:

| | |
|---|---|
| **Scorer-facing** | the fixture's own state, however it was learned |
| **History** | what a prior diagnostic run did, proposed, or was awarded |

Worked against the real text:

| Text | Verdict | Why |
|---|---|---|
| seed 01 — *"`priority_stored` measured at Task 12: `null`"* | scorer-facing | fixture state; the provenance is incidental |
| seed 04 — *"a diagnosis that names the empty `connection` … must not be scored as a hit"* | scorer-facing | scoring guidance, hypothetical, no run named |
| seed 04 — *"an agent correctly reporting the malformed envelope would have been scored a **miss**"* | scorer-facing | hypothetical grading, explains the seed's construction |
| seed 05 — *"no execution plan was created anywhere on the instance"* | scorer-facing | fixture state; the absence the seed produces |
| seed 03 — *"Both scored runs diagnosed layer 5 … and scored 6/6"* | history | run behaviour + grade |
| seed 05 — *"earning full — not partial — fix-target credit"* | history | the credit level the scorer is about to assign |
| seed 02 — *"Agent Doctor diagnosed exactly that in both scored runs … (2/6, fail…)"* | history | run behaviour + grade |
| seed 02 — *"v1 bound no tools at all … the ReAct engine cancels a tool-less agent"* | scorer-facing | fixture provenance — why the seed is built as it is |

Note the last row: seed 02's `## History:` heading is **not** a reliable marker of what moves. Most
of that section explains the v1→v2 construction and belongs with the spec; two sentences inside it
are the leak.

---

## Architecture

### 1. The rule text (`benchmark/README.md`)

A second rule stated beside the existing one, **by principle rather than by roster**, matching the
shape the harness rule already has:

> **The scorer blind rule.** No text placed in front of a scorer may state what a prior diagnostic
> run did or what it scored.

| Channel | Source | Reaches |
|---|---|---|
| Seed specification | `benchmark/seeds/seed-0N-*.md` | every packet for that seed |
| Rubric | `scorecard-template.md` §A / §A2 / §A3 | every packet |
| Run report + audit measurements | per-row, from `raw-evidence-*.md` | one packet each |

Stated explicitly under the rule, because the distinction is the whole point and a future reader
will otherwise redact the wrong half:

- **Permitted** — the fixture's own state however it was learned; the expected layer and fix target;
  scoring guidance including decoy rules, void rules and partial-credit cases; hypothetical grading
  statements.
- **Forbidden** — what a prior run diagnosed, proposed, or was awarded.

The guards table gains a third row:

| Guard | Catches | Origin |
|---|---|---|
| `test/scorerPacketBlindRule.test.js` | **prior-run outcomes** reaching a scorer | #100 |

The section closes with the same honesty the existing rule already carries: **a passing suite is not
evidence of blindness**, only that the declared patterns did not fire.

### 2. File split

Per seed, two files:

| File | Contents |
|---|---|
| `seed-0N-<name>.md` | wholly scorer-facing — header table, defect mechanism, why it is built this way, fixture ground truth, setup, trigger, expected diagnosis, scoring guidance, safety, `blind-rule-tokens` block |
| `seed-0N-<name>.history.md` | prior-pass narrative — what earlier runs did and what they scored |

**Links run history → spec only, never the reverse.** A pointer from the spec to the history file is
an invitation to read the thing just removed, and the packet builder that reads it is the exact
actor the fix exists to protect. The history file carries the back-pointer and a one-line statement
that it is never copied into a scorer packet.

A seed with no prior-pass narrative needs no history file; the guard does not require one.

### 3. `blindRule.test.js`'s specimen glob

`SPECIMENS` currently globs `^seed-\d+-.*\.md$`, which would swallow `.history.md` files and demand
a `blind-rule-tokens` block from each. History files are not model-facing — same category as the
rest of `benchmark/**`, which that test's header already excludes by design — so the glob excludes
them.

That test's header argues, correctly, that exemptions are "a second, SILENT way to be unguarded."
The exclusion therefore ships **with a pinned filename list** beside the existing
`expect(SPECIMENS).toHaveLength(6)`, so it can never quietly swallow a real spec — the same
substitution-proofing `SCAN_TARGETS` already has.

### 4. The guard (`test/scorerPacketBlindRule.test.js`)

A **sibling**, not an extension of `blindRule.test.js`. Different rule, different subject: `blindRule`
protects the measurement subject from the answer, this protects the measurement instrument from the
grade. Structure mirrors it deliberately — declared patterns with a written rationale each, a pinned
specimen roster, and controls that exercise the real matcher.

Patterns are **past-tense and run-subject anchored**, which is what separates the leak from the
guidance in the actual text:

| Pattern | Catches | Deliberately does not fire on |
|---|---|---|
| `scored\s+(the\s+canonical\s+)?\d` | "scored 6/6", "scored the canonical 2/0/1/0" | "a decoy hit **scores** 2/0/1/0" (present-tense rule) |
| `scored\s+(runs?\|rows?)` | "both scored runs", "the doubled scored runs", "2 scored rows are void" | — |
| `(run\|rows?)\s+[12]\s+(found\|named\|diagnosed\|proposed)` | "run 2 named the empty connection" | — |
| `earning\s+(full\|partial)[^.]*credit` | "earning full — not partial — fix-target credit" | — |
| `\d\s*/\s*6\b` | "2/6, fail", "6/6" | — |
| `DECISION\.md` | *"See `../DECISION.md` §D2"* | `../scorecard-template.md` refs — the rubric is already in the packet |

**The last pattern was added during planning, after the set above was filed.** Seeds 02 and 04 cite
`../DECISION.md` §D2/§D3. A packet is meant to be self-contained, but a *model* scorer with
repository access can follow a relative link, and `DECISION.md` is the most concentrated answer key
in the repo — every prior pass's rows, grades and verdicts. A pointer to the answer is the same
defect as the answer, so the rule binds it. Both current instances sit inside text this design was
already moving to history, so the pattern costs nothing today and closes the channel prospectively.

Following `blindRule`'s stated philosophy there is **no stop-list and no generic-word exemption**: a
pattern too broad simply reddens the suite, and that failure is the signal to write a better
pattern. A silent exemption would be the failure mode the guard exists to close.

#### `blindRule`'s `scanText` cannot be reused, and the reason is not cosmetic

Both facts below were measured against the five specs while writing this design, not predicted.

**1. Matching must run on whitespace-normalized whole text, not per line.** `blindRule` scans line by
line, which is fine for its tokens — they are single identifiers (`x_snc_tsbench_routing`). These
patterns are *phrases*, and the specs are hard-wrapped at ~76 characters, so phrases straddle line
breaks routinely. Seed 05's `earning full — not partial — fix-target credit` is split across lines
21–22 and a per-line scanner **misses it entirely** — a leak passing a green guard, which is exactly
the silent under-coverage this class of test exists to prevent.

**2. Blockquote markers must be stripped per line before joining.** Every leak found sits *inside* a
`>` callout, so this is the majority case rather than an edge one. Joining lines naively yields
`earning > full — not partial — fix-target credit`, and the pattern misses it for a second,
independent reason.

Mechanics that follow: strip leading `>` markers per line, join, collapse whitespace runs, match —
while retaining a line index so a failure still reports the line number and the matched excerpt.

#### Measured behaviour of this pattern set, before any rewrite

Run against the five specs as they stand today, with the mechanics above:

| Spec | Hits |
|---|---|
| Spec | Leak locations | Pattern-hits |
|---|---|---|
| seed 01 | 0 | 0 |
| seed 02 | `scored runs`, `2/6`, `DECISION.md` | 3 |
| seed 03 | `scored runs`, `scored 6/6` | 3 — `scored 6/6` trips **two** patterns |
| seed 04 | `scored runs`, `run 1 found`, `run 2 named`, `scored the canonical 2/0/1/0`, `DECISION.md` | 5 |
| seed 05 | `scored runs`, `earning full — not partial — fix-target credit`, `scored rows` | 3 |

**13 distinct leak locations, 14 pattern-hits, zero false positives.** The two counts differ because
each pattern is scanned independently: seed 03's `scored 6/6` is one sentence that trips both
`scored-a-number` (on `scored 6`) and `rubric-fraction` (on `6/6`). The guard reports pattern-hits,
so **14 is the number a red run prints**. The guidance that must survive —
seed 04's *"must not be scored as a hit"* and *"would have been scored a **miss**"* — and seed 01's
`priority_stored` ground truth are all untouched by the set. Seed 01 scoring zero is the expected
result, not a gap: its defect is the stale callout in §5, which is not a scored-outcome leak.

Three controls:

1. **POSITIVE** — a planted sentence fires the real matcher, so a matcher that stops matching fails
   here rather than passing vacuously.
2. **NEGATIVE, real file** — seed 04's *"must not be scored as a hit"* and *"would have been scored
   a **miss**"* are asserted **present in the file** and asserted to produce **zero hits**. Guidance
   surviving redaction is pinned mechanically rather than promised in prose.
3. **NEGATIVE, real file** — seed 01's `priority_stored` ground truth, likewise present and clean.

Control 2 is the falsifiable core of the whole design: it is what distinguishes this fix from
lobotomising the packet, and it is the property §O5 had to establish by hand during the v4 pass.

### 5. Seed 01's stale contradiction

`seed-01-schema-mismatch.md` opens *"**PREDICTED, NOT OBSERVED.** No seed has been installed or
executed … Confirm at Task 12 before scoring"* and, three lines later, reports *"measured at Task 12:
`priority_stored` = `null`"*. A scorer reads both. Restated as observed fixture state.

Included in this pass because it is the same class of defect found in the same sweep — the
instrument handing a scorer something false — not because #100 names it.

### 6. Packet-assembly procedure

`benchmark/scorecard-template.md` records that a packet embeds the scorer-facing spec only and that
`.history.md` never enters a packet. The template is the durable home; `scoring-v4/README.md` is one
pass's artifact and is left frozen.

---

## Expected outcome, stated in advance

- The guard goes **red against today's five specs** before any rewrite — **14 pattern-hits across
  seeds 02–05, 0 on seed 01**, per the measured table above — and the failing output is captured in
  the PR. A guard that was never seen failing is not known to work. A first run producing anything
  other than those 14 means the implementation drifted from this design, and is a reason to stop
  rather than to adjust the expectation.

  *(Number history, kept because the tripwire above is only worth anything if its own corrections
  are visible. Filed at "9" and then "11" in this paragraph while the measured tables beside it
  listed 11 and then 13 entries — the prose was simply miscounted at authoring, twice. The
  implementer that hit the tripwire measured 14 and stopped, which is the specified behaviour, and
  an independent re-count confirmed it: 13 leak locations, one of which trips two patterns. What
  never moved is the **inventory** — the same 13 pieces of text were identified from the first
  measurement onward. Only the arithmetic over them was wrong.)*
- After the rewrites: green, with the two real-file negative controls proving the guidance survived.
- **No score anywhere in the repo moves.** No row is re-scored, no packet is re-issued.

---

## Testing

`npm test`. New file `test/scorerPacketBlindRule.test.js`; modified `test/blindRule.test.js` (glob
exclusion + pinned filenames). Written guard-first, red before the rewrites, green after.

The existing suite must stay green throughout — in particular `blindRule.test.js`'s
`expect(SPECIMENS).toHaveLength(6)`, which is what proves the glob exclusion dropped history files
and nothing else.

---

## Out of scope

- **No re-scoring.** §O7's note that custom's 0/10 was never scored on clean packets stands as
  filed; a future custom pass inherits that caveat, not this branch.
- **No automated packet extractor.** Packet assembly stays a documented manual step. Considered and
  declined: it adds a tool to maintain for a failure the file split already makes safe-by-default.
- **The frozen `scoring-v4/` artifacts are not edited** — packets, `packets-redacted/` and
  `rescore/` are pass evidence and stay as they were scored.
- **The harness-facing blind rule and its 16 scan targets are untouched.**
- **`DECISION.md` is not edited.** §O8's queue bullet is a dated record of what was open at the time
  of the v4 pass; the next scored pass writes the next section and can note #100 closed. Rewriting a
  filed record to reflect later events is the thing this project keeps declining to do.

---

## Ship

Issue #100 → branch `fix/scorer-packet-blind-rule` → PR to `main`. Version bump in `package.json`
and the `README.md` badge, plus a `CHANGELOG.md` entry, per the repo's merge convention.
