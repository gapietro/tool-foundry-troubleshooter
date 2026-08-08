# Design — scanning the rubric channel, and closing the path rule's residues

**Date:** 2026-08-08
**Issues:** #143 (the unscanned rubric channel), #144 (bare-directory residue + stale roster)
**Governing sections:** `benchmark/DECISION.md` §T7, §T9, §Z (esp. Z4); §O5
**Predecessor spec:** `docs/superpowers/specs/2026-08-07-t9-pass-blockers-design.md`

---

## 1. Why this work, and why now

`benchmark/DECISION.md` §Z6 records the next scored pass as unblocked. That is true of the two
blockers §T9 named. It is not true of the channel those blockers were both about.

The scorer blind rule binds **three channels** that reach a blind scorer (`benchmark/README.md`,
"The scorer blind rule"): the **seed specs**, the **rubric**, and the **run reports**. #100 built a
guard for the first. #140 built one for the packets those channels are assembled into. The rubric —
`benchmark/scorecard-template.md` §A/§A2/§A3, the slice copied into **every** packet — has never been
machine-scanned.

It has now demonstrably leaked. §A2.1's shipped preamble stated what a prior pass measured (*"nine of
twelve rows flagged `ambiguous`"*, *"moved a whole arm between 6/6 and 0/6"*) and carried two bare
`§`-pointers into the decision record. It was caught by a reviewer reading a diff and removed in
`253de7f`.

**That is the same shape as the §T7 failure that motivated #140, one level up.** #140 hardened the
packet channel after a leak was caught by hand; this is the channel that feeds every packet, caught by
hand, with no guard. §Z4's own closing sentence is the standard: *"What the change buys is that the
next leak of this shape is caught by the suite instead of by a reader."*

The fanout is what makes it urgent rather than tidy. A leak in one seed spec reaches the rows scored
against that seed. A leak in the rubric reaches **all twelve rows at once**, which is every row of the
pass whose credibility rests on the rule.

#144 is separate and smaller: two residues from the same review, both understating coverage rather
than overstating it. They ship together because they are the same file and the same regex.

---

## 2. What is being fixed

### 2.1 #143 — the rubric channel is not scanned

The channel is bound by the rule and protected only by hand. `benchmark/scoring-v9/packet-build-report.md`
§7.2 records the protection precisely: four substitutions on the rubric slice, each asserted to match
exactly once at build time. That assertion is real and it worked — but it is a **build-time** check
performed by whoever builds the packets, on paths only, and it did not see the prose leak at all.

The corroborating measurement, run against the shipped slice:

- The four substitutions are **path-only** (A1–A4 in §7.2). The grades and `§`-pointers in the §A2.1
  preamble would have shipped **verbatim to all twelve scorers**.
- The widened `PACKET_PATTERNS` from #140 fires on all four of the slice's repository paths **when
  pointed at the slice** — but nothing points it there.

### 2.2 #144 item 1 — a stem-terminated reference escapes the path rule

`PACKET_PATTERNS`' first alternation requires at least one character after the slash, so a reference
that stops at an enumerated stem does not match. Measured against the shipped regex:

| Probe | Shipped rule | Required |
|---|---|---|
| `scoring-v9/` | no hit | hit |
| `results/` | no hit | hit |
| `../results` | no hit | hit |
| `.superpowers/sdd/v9-pass/` | no hit | hit |
| `seeds/history/` | hit (two segments) | hit |

*"the packets are in `scoring-v9/`"* is a walkable route the guard misses.

### 2.3 #144 item 2 — the README guard roster predates the packet channel

`benchmark/README.md:115` and `:140` describe `scorerPacketBlindRule.test.js` as catching
"prior-run outcomes reaching a scorer" and doing "the same for the 5 seed specs". Neither mentions the
packet channel or the repository-path rule #140 added. The surrounding paragraph still opens *"The
guard scans the seed specs — one of the three channels."*

Stale in the safe direction. A roster that does not match the guard is how the next reader mis-scopes a
change.

---

## 3. Design

### 3.1 A third channel-scoped pattern list

`RUBRIC_PATTERNS`, alongside the two that exist:

| List | Bans | Scans |
|---|---|---|
| `PATTERNS` | a prior run's **outcome** | the 5 seed specs |
| `PACKET_PATTERNS` | a repository **path** | the committed packets |
| `RUBRIC_PATTERNS` *(new)* | a prior pass's **outcome or provenance** | `scorecard-template.md` §A→§B |

The rubric range is scanned with **`RUBRIC_PATTERNS` plus `PACKET_PATTERNS`** — outcome and path are
both forbidden there, and the path half is the rule that already exists rather than a copy of it. The
two other channels are unaffected: the seed specs keep `PATTERNS` alone (they legitimately cite 22
repository paths), and the packets keep `PACKET_PATTERNS` alone.

The matcher (`scanWith`) is shared and unchanged. Three lists is the established shape, and the file's
own reason for the second list applies unaltered to the third: *"the two channels ban different things
and scan different files."*

**Why this is not the stop-list the file's doctrine forbids.** The doctrine — *"deliberately NO
stop-list and no generic-word exemption… An exemption would be a second, SILENT way to be
unguarded"* — forbids carve-outs **inside** a list, which are invisible at the point of failure. A
separate list per channel is visible in the file, carries its own written reason, and is already how
`PACKET_PATTERNS` exists. `rubric-fraction` is not exempted from a list it belongs to; it is not a
member of this channel's list, and §3.3 states why in the file.

### 3.2 Range derivation

The scanned range runs from the `## A.` heading to the `## B.` heading — today lines 10→176 — derived
from the headings at scan time, never hardcoded.

The objection recorded in the test file's own header is that *"a section-scoped scan would pin the
template's heading structure into a test."* It does, deliberately. **The packet build depends on the
same structure**, so a rename that breaks the scan is a rename that changes what ships to scorers.
Failing loudly is the correct response, not a cost.

Line numbers stay **file-absolute** — an index offset is passed into `scanWith` so a failure points at
real source in `scorecard-template.md`, the same property the two existing channels' line maps are
pinned for.

The range assertion also pins that `### A2.1` falls inside it, which is the placement
`test/rubricClauses.test.js` independently requires. Two tests, one invariant, different reasons.

### 3.3 The nine patterns

**Four new**, each measured against the paragraph actually removed in `253de7f`:

| Name | Bans | Catches in the real leak |
|---|---|---|
| `outside-section-pointer` | any `§` reference not pointing at `§A*` | `§O5`, `§T5` |
| `counted-rows` | "N of M runs / rows / passes" | `nine of twelve rows` |
| `prior-pass-reference` | prior/previous/earlier/last + pass/run/round; "passes later" | `passes later` |
| `verdict-moved` | moved/swung/flipped/shifted a whole arm / verdict / gate | `moved a whole arm` |

`outside-section-pointer` is the load-bearing one and the reason this channel is scannable at all.
**Every `§` reference in the entire §A→§B range is a self-reference** — `§A`, `§A2`, `§A2.1`, and
nothing else. A pointer to any other section is a pointer out of the packet, into a document the scorer
does not have. Zero false positives today, and it catches both leaked pointers. `§B` is correctly
rejected too: a scorer's packet ends at §A3.

**Four borrowed** from `PATTERNS`, each verified inert on the range today: `scored-a-number`,
`scored-runs-or-rows`, `run-N-did`, `credit-awarded`. They cost nothing measured, and they cover the
seed-spec-shaped leak — *"run 2 named…"*, *"earning full credit"* — if that prose ever migrates into
the rubric.

**One widened**, `PACKET_PATTERNS`' path rule (§3.5), applied to the range once §3.4 lands.

**`rubric-fraction` is excluded, with the reason written in the file.** It fires **10×** on legitimate
Task 12 band guidance in the range — `≥ 8/10`, `5–7/10`, `< 5/10`, and *"a run can score 3/6 and
pass; a run can score 4/6 and fail."*

The alternative considered and rejected: rewrite the range to be fraction-free so the pattern applies
unchanged. That would require rewriting the one sentence that explains why the gate is not the total.
That is **lobotomising the packet rather than redacting the leak** — the exact distinction the
`seed-04` negative control exists to protect (*"Both sentences are scoring guidance a scorer NEEDS;
both must survive every rewrite"*). The leak's `6/6 and 0/6` sits in the same sentence as
`moved a whole arm`, which `verdict-moved` catches — but note that argues from the one incident the
patterns were derived from, and does not generalise. See weakness 4.

**Residue, stated rather than left to be re-derived** (added 2026-08-08 after the Task 3 review).
A bare fraction carrying **no scoring verb and no run-noun** is caught by nothing in `RUBRIC_SCAN`.
Verified example: *"the §A2 arm came out 0/6 last time"* — `scored-a-number` requires the literal
"scored", and `prior-pass-reference` has `last` but its noun list is `pass|run|round|scorer`, not
`time`.

A **third** option existed and the first draft of this spec missed it: the doctrine's own *"write a
better pattern"* clause. A narrowed fraction rule — one requiring an adjacent past-tense outcome verb
— measures clean against all ten legitimate fractions and would close this shape. **It was considered
and deliberately not shipped**, because it would be reverse-engineered from a sentence a reviewer
constructed rather than from a real incident, which is precisely the weakness recorded below for
`verdict-moved`. Adding a second speculative pattern to compensate for the first is not a fix. The
gap is recorded here and in the code so the next editor sees it rather than re-deriving it.

**Four weaknesses recorded rather than glossed.**

1. **`verdict-moved` is reverse-engineered from that one sentence.** It bans a real shape — what a
   prior pass's score did to the verdict — but it was not derived independently of the incident, and
   nothing here establishes it generalises.
2. **`credit-awarded` is one word from a false positive.** Line 22 reads *"instructs the scorer to
   award *partial* credit"*; the pattern requires `awarded`. Legitimate guidance surviving on a tense.
3. **`counted-rows` near-misses line 39** — *"names exactly two of the four rubric columns"* —
   surviving only because the noun list stops at `runs|rows|passes` and excludes `columns`.
4. **The bare-fraction shape above is not covered**, and the coverage argument for excluding
   `rubric-fraction` rests on the single incident the patterns were built from.

Both near-misses ship as **pinned negative controls**, so a future widening that would take legitimate
guidance fails the suite instead of quietly redacting the rubric. Per doctrine, if any pattern reddens
on real guidance the answer is a better pattern, not an exemption.

### 3.4 The template reword

Apply the packet builder's own A1–A4 replacements permanently to `scorecard-template.md`:

| # | From | To |
|---|---|---|
| A1 | ``the evidence rule from `docs/agent/agent-doctor-instructions.md` `` | the evidence rule from the diagnostic agent's own instructions |
| A2 | ``while `seeds/seed-05-inactive-usecase.md` instructs`` | while seed 5's specification instructs |
| A3 | ``The gate in `docs/IMPLEMENTATION_PLAN.md` Task 12 counts **runs**:`` | The gate counts **runs**: |
| A4 | ``The `IMPLEMENTATION_PLAN.md` Task 12 bands are`` | The Task 12 bands are |

These are not new wording. They are the replacements §7.2 records as already shipping to the v9
scorers, so the packet text is unchanged by this — only its **source** changes.

Two consequences, both wanted:

- The range is **path-clean at source**, so a future editor who adds a path to §A fails the suite
  instead of depending on the packet builder noticing.
- **Deviation set A disappears from the next packet build.** The rubric slice ships byte-verbatim,
  and one hand-asserted step stops being load-bearing.

A3's own note in §7.2 applies unchanged: dropping "Task 12" from that clause loses no meaning, because
the label survives twice later in the same section.

`test/rubricClauses.test.js` continues to pin §A2.1's two clauses and their placement. Untouched.

### 3.5 The widened path rule

Three alternations, replacing two:

1. `stem/` followed by **zero or more** path characters — so `benchmark/scorecard-template.md`,
   `scoring-v9/` and `results/` all fire;
2. a `./` or `../` prefix followed by a bare stem — so `../results` fires;
3. any bare `*.md` filename — unchanged.

`.superpowers` joins the stem list. A bare stem **word** with no slash still correctly misses, which is
what keeps ordinary prose out of it.

Measured:

| | Result |
|---|---|
| All four #144 probes | now hit |
| Both existing negative controls (`Now Assist / AI Skill Studio`, `sn_aia_execution_plan.state`) | still clean |
| *"the results were mixed"*, *"test results matter"* | correctly miss |
| **The twelve committed v9 packets** | **0 hits, before and after** |

The v9 result is the same shape §Z4 reported for #140's widening: no false positive forced a tightening.

### 3.6 What this cannot establish

Borrowing §Z4's framing, because the same limits apply.

- **0 hits on the reworded range confirms the rule agrees with the reword.** It is not a retrospective
  catch, and it does not establish that the v9 scorers saw nothing they should not have. §T7's account
  of that stands as written.
- **This measures nothing about diagnostic quality, for either harness, in either direction.** §T3 is
  unmoved. This is a repair to the measuring instrument.
- **A passing suite is not evidence of blindness.** It is evidence the declared patterns did not fire.
  The run-report channel remains bound by the rule and unscanned, and is out of scope here.
- **Nothing here establishes the four new patterns are the right patterns.** Three were written against
  the one incident available; `verdict-moved` explicitly so.

---

## 4. Testing

TDD, controls before coverage.

1. **Positive, the real incident.** The paragraph removed in `253de7f`, verbatim, must hit. Expected:
   5 hits from 4 distinct patterns (`§O5`, `§T5`, `nine of twelve rows`, `passes later`,
   `moved a whole arm`). Pinned by pattern name, so a future edit that leaves one pattern matching
   cannot silently reduce this to a single point of failure.
2. **Negative, the two near-misses.** Line 22's *"to award *partial* credit"* and line 39's *"two of
   the four rubric columns"* pinned as legitimate guidance that must not fire.
3. **Negative, the real file.** The full reworded §A→§B range scans clean on all nine patterns, with
   zero residual paths.
4. **Range derivation.** The range is non-empty, starts at `## A.`, ends at `## B.`, contains
   `### A2.1`, and a reported hit line number is file-absolute.
5. **#144 probes as controls.** All four bare-directory forms fire; the two existing negatives stay
   clean; the two bare-stem-word prose cases miss.
6. **The v9 packets** re-scan at 0 under the widened rule.

---

## 5. Documentation and record

| Artefact | Change |
|---|---|
| `test/scorerPacketBlindRule.test.js` | The "WHAT THIS GUARD DOES NOT COVER" header is wrong once this lands — the rubric channel moves from "bound but not scanned, so hand-check every addition" to scanned. Rewritten; the run-report channel remains listed as unscanned. |
| `benchmark/README.md` | Guard roster at :115/:140 gains the packet and rubric channels. The *"scans the seed specs — one of the three channels"* paragraph and the hand-check sentence both become false and are rewritten. |
| `benchmark/DECISION.md` | **§AA appended. §Z is not modified.** §Z opens by asserting §A–§Y unmodified and §X asserted the same of §U–§W; appending is the house norm, and §Z4 remains the accurate record of what shipped at `2026.08.0709`. §AA opens with the same "no runs fired, no packet re-scored, no instance touched" framing. |
| `docs/superpowers/specs/2026-08-07-t9-pass-blockers-design.md` | Dated forward note appended. Not rewritten — it accurately describes what was designed then. |
| `CHANGELOG.md` | New version entry; the 0708 entry gets a dated forward note rather than an edit, for the same reason. |
| `package.json` / `README.md` badge | Version bump per `CLAUDE.md`. |

---

## 6. Out of scope

- **The run-report channel.** Per-row prose written fresh each pass, bound by the rule, still unscanned.
  Named in the test header; no guard proposed here.
- **`scoring-v4`.** Stays a declared out-of-scope directory with its written reason (§Z4). The widened
  rule will match more of it; it is not scanned, and editing it would destroy the record it exists to
  hold.
- **Row 10 of the v9 pass**, left unresolved by §Z3 and the open item for whoever next revises §A2.1.
  This work does not touch §A2.1's clauses.
- **The next scored pass.** §Z6 governs: it needs its own §U/§W-style pre-registration, and neither
  §Z nor this spec is one.
