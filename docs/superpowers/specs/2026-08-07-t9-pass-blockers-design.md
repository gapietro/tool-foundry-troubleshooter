# Design — the two §T9 blockers on the next scored pass

**Date:** 2026-08-07
**Issues:** #139 (rubric clause), #140 (blind-rule widening)
**Governing sections:** `benchmark/DECISION.md` §T5, §T7, §T8, §T9; §O5

---

## 1. Why this work, and why now

`benchmark/DECISION.md` §T3 is the project's governing open result: the custom harness reached
layer 4 six times and concluded at layer 1 six times — 0/6 on the gate against native's 6/6.
Two mechanisms have since been measured and neither moved it. §X refuted the evidence return
(`N/D` = 1/10 against a pre-registered threshold of 1/2). §Y bounded the strict release rule at a
**1.6% bind rate** (1 of 64 gate releases), which deflates §T9's "obvious next candidate" framing
rather than supporting it. Both sections close on the same sentence: *retrieving evidence is not
diagnosing.*

The only instrument that can move §T3 is another scored pass, and §T9 pre-committed to two
blockers before one is spent:

> *"Fix the rubric before spending another scored pass. … Widen the blind-rule test to any
> repository path."*

Neither is done. Neither had an issue. This design closes both.

**Scope boundary.** This work repairs the **measurement instrument**. It does not run a pass, does
not change the harness, the gate, or any prompt, and does not touch §T3. Nothing here is evidence
about diagnostic quality in either direction.

---

## 2. Blocker 1 — `fix_usable_unedited` (#139)

### 2.1 The defect

`fix_usable_unedited` is one of the gate's two terms (`passes_gate = 1` iff
`root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`, `scorecard-template.md` §A2). §T8
predicted at most two of twelve v9 rows would be flagged `ambiguous`; **nine were**, and the
failure landed on this column. §T5's measurement of the consequence:

| | totals | gate |
|---|---|---|
| As scored | native 36/36, custom 9/36 | native 6/6, custom 0/6 |
| Every native `fix_usable_unedited` resolved the other way | native 30/36, custom 9/36 | native **0/6**, custom 0/6 |

One under-determined column moves native between 100% and 0%. **§O5 filed the same defect on the
same column three passes earlier and it was never closed.**

Two distinct under-determinations, both gate-material, both in this column:

1. **The unrecoverable-value placeholder** — rows 03, 04, 05, 06. A fix names target and operation
   exactly but leaves a value slot unfilled: `assignment_group = <correct group name>` (seed 03),
   a replacement `sys_hub_flow` sys_id (seed 04). Row 06's scorer: *"The rubric does not state
   whether a fix that names the target and the class of correct value, but requires one lookup to
   obtain the literal value, counts as applicable 'as written'. Both readings are defensible."*
2. **The runtime address** — rows 01, 02. A fix addresses its target as a runtime `sn_aia_tool`
   record rather than the Fluent source that owns the script. Both scorers resolved in the run's
   favour; both recorded that the strict reading flips `passes_gate`.

§T9 names only the first. Resolving one and leaving the other reproduces §T9's exact complaint —
*"the next pass's headline is again decided by a coin the scorers are being asked to flip"* — on
the same column. Both are resolved.

### 2.2 The two clauses

Added to `benchmark/scorecard-template.md` §A, inside the `fix_usable_unedited` row and the note
beneath the gate rule. **§A/A2/A3 are the only sections that reach a packet**, so the clauses must
live there to reach a scorer.

**Clause 1 — recoverability.** A fix containing an unfilled value slot scores
`fix_usable_unedited` = 1 **only if** the missing value is not obtainable from the instance by any
of the seven diagnostic tools, **and** the target and operation are fully specified. If the value
*was* obtainable and the run simply did not look it up, score 0. A discovery procedure whose steps
are UI actions rather than tool calls does not make a value unobtainable.

**Clause 2 — addressing.** A fix that addresses its target as a runtime record rather than the
Fluent source scores 1 **if** the address resolves to exactly one record and one field. The
builder AI is the column's stated consumer, and SDK-owns-creation is a project convention rather
than a property of the diagnosis. An address that does not uniquely identify the target scores 0.

Both are answerable from the seed spec plus the fix text. Neither asks the scorer to weigh
anything — which is §T9's stated bar: *"Adopt that or its negation; either makes the column
mechanical."*

### 2.3 What was rejected, and why it is recorded

- **Row 03's draft verbatim** — *"a placeholder for a value not recoverable from the instance does
  not make a fix unusable, provided the target and operation are fully specified."* Leaves "not
  recoverable" to the scorer, which is the judgment that produced the ambiguity. Clause 1 is this
  draft with the recoverability question made answerable.
- **The strict negation** (any placeholder → 0). Maximally mechanical, but takes v9 native to 0/6,
  makes the gate read "nothing passes on either arm", and penalises a run for declining to
  fabricate a value it has no evidence for — the behaviour #79's citation cross-check and §L's
  `UNCONFIRMED` exemption exist to encourage.

### 2.4 The derived recompute

An application of a now-mechanical rule to facts the twelve scorers **already recorded** — not a
re-judgment. Published as a derived table **beside** `benchmark/scorecard-v9.md`, clearly
labelled, **never replacing it**. Any row whose recorded reasoning cannot answer the question stays
unresolved and is stated as such.

Expected result. **Every entry is to be verified against the seed specs and the twelve result
files during implementation, not inherited from this document:**

| Rows | Recorded fact | Clause | Result |
|---|---|---|---|
| 01, 02 native seed 01 | address is `sn_aia_tool` sys_id `8953…`, field `script` — scorer: "one tool, one script field" | 2 | 1, unchanged |
| 03, 04 native seed 03 | `<correct group name>`; the routing table is empty, so no correct group is recorded anywhere on the instance | 1 | 1, unchanged |
| 05, 06 native seed 04 | replacement `sys_hub_flow` sys_id; the seed's healthy value is used by 422 of 2026 rows on gpinst01, and the fix's discovery step 1 is a **UI** action | 1 | **0, changed** |
| 07–12 custom | `root_cause_layer_correct` = 0 on all six, flagged ambiguous on none | — | `passes_gate` = 0 regardless |

> **Native's gate 6/6 → 4/6; totals 36/36 → 34/36. Custom stays 0/6 under every reading (§T5).**

**The chosen rule moves the number against the arm the project currently recommends**, and lands
between §T5's two published bounds rather than at either. That is the best available evidence the
clause was not chosen to produce a result. §T5 published both bounds before this design existed,
so no information was gained by choosing after seeing the data.

### 2.5 Not in scope for #139

- **Re-scoring the v9 packets blind.** Considered and declined: the packets exist and are
  path-clean, so it would cost twelve scorer runs and zero instance runs — but re-measuring the
  same rows after seeing the first result invites the "measured until it looked right" reading
  even when pre-declared.
- **Editing `benchmark/scorecard-v9.md`.** The original scores are what the blind scorers produced
  and stay untouched.
- **The recorded v9 ambiguities that are not gate-material** — row 03's "naming the tool is a
  miss" clause, row 04's "root cause singular vs four RCs", and the rest. Noted in #139, resolved
  elsewhere or not at all.
- **`layers_swept`**, still unadjudicated (§T6, §T8), and `continuous_tool_execution_limit`, not
  read during v9 (§T1). Both are outside the gate expression.

---

## 3. Blocker 2 — the blind-rule packet scan (#140)

### 3.1 The defect

`test/scorerPacketBlindRule.test.js` passed 11/11 while two one-hop paths to the answer key sat in
the v9 packet framing (§T7). The gate was working exactly as written: `answer-key-pointer` matches
a literal `/DECISION\.md/i` and nothing else, and it scans the five seed specs — one of the rule's
three channels — not the packets. Both paths were removed by hand. **This is the second
consecutive round in which the leak was caught by hand rather than by the gate.**

### 3.2 The collision §T7 did not mention

A uniform any-path rule cannot simply be pointed at the existing scan target. The five
scorer-facing seed specs carry **22 path-shaped strings** — `../../test/blindRule.test.js` (5),
`seed-app/src/fluent/seed-tables-acl.now.ts` (3), `../scorecard-template.md` (3), `DESIGN.md` (2),
`.claude/context/sdk-reference.md`, and the remaining seed-app Fluent files. Widening the pattern
over the specs turns all five red immediately, and the paths are legitimate there: a spec that
cannot say which Fluent file installs the seed or which test guards it stops being a usable source
document.

Meanwhile the **v9 packets are completely clean** of paths, and the **v4 packets are not** — they
carry `benchmark/scorecard-template.md`, `benchmark/seeds/seed-0N-*.md`,
`docs/agent/agent-doctor-instructions.md` and `DESIGN.md`.

So the decision is not the pattern. It is where the pattern is applied.

### 3.3 The design

**`PACKET_PATTERNS`** — a second pattern list, one regex for any repository path, scanning **packet
files only**. The existing `PATTERNS` keep scanning the five seed specs unchanged. Specs keep their
paths on disk; paths are stripped when spec content is embedded into a packet. This is exactly what
the v9 builder adopted by hand, and it keeps each channel's rule auditable by a single regex —
§T7's stated reason for preferring a uniform rule over a selective one.

**`PACKET_SETS`** — each committed packet directory named explicitly, with a scanned flag and a
written reason:

| Set | Scanned | Reason |
|---|---|---|
| `benchmark/scoring-v9/` | yes | current pass; verified path-clean |
| `benchmark/scoring-v4/` | no | scored before this guard existed; the packets stay a faithful record of what those scorers actually read |

Declared in the file rather than silently absent, so a reader sees the exception instead of
re-deriving it. Pinned by name **and** count, matching the file's existing doctrine — *"a
substitution (one spec renamed, another added) would keep the count at five while coverage
moved"* — so a new pass cannot be added without a deliberate edit.

This is a **directory-level declaration, not a pattern-level exemption**. The file's doctrine
forbids stop-lists and generic-word exemptions because they are *silent* second ways to be
unguarded; a named directory with a written reason is neither silent nor a way to be unguarded
inside a scanned file.

### 3.4 What was rejected, and why it is recorded

- **Uniform rule over specs and packets** — needs the 22 path strings stripped from the specs,
  costing their usefulness as source documents.
- **Split the specs like `seeds/history/`** — consistent with an established repo pattern, but the
  most churn for no measured benefit; the packet is the artifact a scorer actually reads.
- **Scan v4 against a recorded hit inventory** — stronger coverage; a large hand-maintained list.
- **Retro-redact the v4 packets** — cleanest rule, but the packets stop being a faithful record of
  what the v4 scorers read, which is the thing they exist to preserve.

---

## 4. Testing

The blind-rule file's own doctrine sets the bar: *"A passing suite is not evidence of blindness; it
is evidence the declared patterns did not fire."* The controls carry the weight.

**#140 — packet scan**

| Control | Assertion |
|---|---|
| POSITIVE | a planted `benchmark/DECISION.md` fires `PACKET_PATTERNS` |
| POSITIVE | a planted bare `DESIGN.md` fires — the case the old literal pattern missed |
| NEGATIVE, real files | all twelve v9 packets scan clean (the falsifiable core) |
| NEGATIVE | prose that merely discusses grading, with no path, does not fire |
| STRUCTURAL | `scoring-v4` is present in `PACKET_SETS` as declared-and-skipped, not absent |
| STRUCTURAL | `PACKET_SETS` pinned by name and count; v9's packet list pinned by name and count |

**#139 — rubric guard.** A test pinning both clauses present in `benchmark/scorecard-template.md`
§A, in the style of the `paramShapeScan` guard added in #126, so the repair cannot be silently
reverted. It asserts the clauses are present in the sections that reach a packet — not their exact
prose.

**Both** — the full unit suite green. Baseline measured on this branch at `2026.08.0707`:
**1345 passed, 27 suites**. The new tests add to that count; nothing existing may go red.

---

## 5. Delivery

Two issues, two branches, two PRs — the blockers are independent and share no files.

1. **#140** — `test/scorerPacketBlindRule.test.js` only. No production code, no benchmark data.
2. **#139** — `benchmark/scorecard-template.md`, a new derived-recompute artifact beside
   `benchmark/scorecard-v9.md`, and the guard test.

Then, per project convention: `benchmark/DECISION.md` §Z recording the repair, the derived
recompute and the widening; the version bump; the `CHANGELOG.md` entry.

**Explicitly deferred.** The next scored pass. This design unblocks it; it does not schedule it,
size it, or pre-register it. §T9's remaining instruction — *"Do not re-run this pass to get a
firmer number"* — still governs, and any future pass needs its own pre-registration in the §U/§W
style.
