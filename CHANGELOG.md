# Changelog

Version format is `YYYY.MM.DDXX` per `CLAUDE.md` — year, zero-padded month, then day plus a
two-digit daily counter. Incremented on every merge to `main`.

> **Note on the version string.** It is not valid semver (`2026.07.3001` has a leading zero in
> the month), which npm and `now-sdk build` both accept. It is also **baked into the generated
> module require paths** in `dist/` — e.g.
> `x_snc_troubleshoot/x-snc-troubleshoot/2026.07.3001/src/server/script.ts` — so every version
> bump rewrites those paths in the installed app. Verified 2026-07-30 on SDK 4.9.2.

> **Note on the dates.** Entries are newest-first by version, and a date can look like it runs
> backwards across a boundary — `2026.08.0227` is dated 2026-08-02 directly above `2026.08.0226`
> dated 2026-08-03. That is correct, not a typo: the earlier entries carry the UTC date while local
> time was still 2026-08-02. The **version** ordering is authoritative; dates are not, and no
> existing date should be "corrected" on the strength of this appearance.

---

## 2026.08.0903 — 2026-08-09

### Added — seeds 02 and 05 qualified as pass-ready fixtures (#151, PR #152)

The next scored pass is sized at 5 seeds × 2 reps × 2 arms — 20 runs, 10 valid per arm, with
§A3.4's 8-valid-run floor read **per arm** (the strict reading). Seeds 02 and 05 have been out of
scope since §Q6, so both had to be qualified before a pre-registration commits to them: a
pre-registration binds you to what it asserts, which makes the seed set a design input to be
measured rather than assumed. §W's build-under-test probe is the precedent.

**Seed 02 qualifies on construction** — one tool bound and active (`measure_request`, `type=script`)
whose description carries no group/routing/assignment vocabulary, so the v2 construction rule holds
live. Its 0/6 convergence across both harnesses is a prediction the pre-registration must file, not
a defect to fix; §O6 declined to rule whether that is a true negative or a shared blind spot, and
this change does not rule either.

**Seed 05's `run_as` question is answered — the trigger fires.** Open since 2026-08-01 and never
carried into `DECISION.md`, the question was whether an empty `run_as` blocks firing under the
4.9.0 "run-as required for all trigger types" guidance. It does not: activation generates a backing
`sys_hub_flow` carrying `run_as: user` of its own (`active=true`, `status=published`), and a ticket
inserted after that flow exists produces an `sn_aia_execution_plan` in ~1 second.

Two findings the question did not anticipate, both live:

- **Activation is asynchronous, and the race is indistinguishable from the defect.** The backing
  flow appears 4–5s *after* the activating PATCH returns. The first probe fired inside that window
  and produced no execution plan — a true zero from an unarmed mechanism, which reads exactly like a
  non-firing trigger. Recorded so the next operator does not repeat it: wait for `trigger_flow` to
  be populated and its `sys_hub_flow.active` to read `true` before inserting any triggering row.
- **The execution terminates immediately** — `status=error`, 0 tasks / 0 tool calls / 0 messages,
  `execution_mode=interactive` against an `autopilot` use case, empty `objective` despite an
  `objective_template`. So flipping `active` makes the trigger fire but does **not** produce the
  acknowledgement. The seed's expected diagnosis is unaffected and fully scorable; the exposure is
  `fix_usable_unedited` — the column behind five of seven native gate failures in v4 — which
  §A2.1's clauses do not cover. Any pass including seed 05 must rule on it in its pre-registration.

Also established: the m2m gate PATCHed on 2026-08-02 persisted and still reads `true`, so that
mandatory step is not outstanding (re-read it anyway — a fixture reinstall resets it, and the seed's
rows are void without it).

**Fixture restored and verified**, not assumed: trigger back to `active=false`, the generated flow
auto-deactivated by the platform (`active=false`, `status=draft`), and a third probe ticket produced
no execution plan across four minutes — conclusive against a measured 1-second fire time.
`trigger_flow` is now populated and its pre-activation value was never captured, so the evidence
file records that as **unknown** rather than claiming it was empty.

One finding outside the seeds: `test/scorerPacketBlindRule.test.js` scans a hand-maintained
`PACKET_SETS` declaration and does not auto-discover scoring directories, so a new `scoring-v<n>/`
starts unscanned while the suite stays green — the same shape as #143.

### Added — `LEARNING.md`, the active-recall ledger

New at the repo root, per the `/learn` workflow. Two entries from the #151 session, both logged
`shaky`: admissibility of a null observation (observability) and when a threshold actually binds
(testing). `/retro` reads this file as qualitative input.

### Changed — `CLAUDE.md` records the quality cadence

States that the repo is graded via `/senior-grade` with `AUDIT.md` as the ledger, and that no grade
exists yet — the first sitting is still outstanding.

### Note — this entry also repairs a missed bump

PR #152 merged without incrementing the version, contrary to the convention above. This entry
covers both that merge and the three changes here.

---

## 2026.08.0902 — 2026-08-09

### Fixed — the lone-surrogate clip defect, at every truncation site rather than one (#137)

#106 fixed `PaRunManager._requestFields`: a `substring` at a code-unit index can land between the
two UTF-16 halves of an astral-plane character and store a lone surrogate, which survives the
column and then breaks JSON encoding of the `GET /runs/{run_id}` response and XML export of the
record. #137 found the same arithmetic unfixed in seven more places. A sweep of `src/server/`
during this fix found an **eighth** the issue's table had missed — `PaToolAgentConfig`'s
`script.substring(script.length - 120)` script-smell evidence — and a ninth that is the same
defect in a different costume: `PaArtifactStore.read`, where a page boundary can split a pair at
either end and each page is JSON-encoded into a tool result on its own.

Two guards, because #106's fix only covers one direction. `clipUtf16` trims an orphaned **high**
surrogate off the end of a head clip; `clipTailUtf16` trims an orphaned **low** surrogate off the
front of a tail slice — the case `PaArtifactStore._truncate` and `PaAuditLogger._digest` hit,
which the original helper cannot reach because it trims the wrong end.

Canonical on `PaToolReadKit`, duplicated verbatim into `PaRunManager`, `PaToolAgentTrace`,
`PaArtifactStore` and `PaAuditLogger` — Script Includes with no kit reference, where a shared
helper would put a cross-Script-Include instantiation in the hot digest path. That is the standing
ruling for `PaToolAgentTrace._splitParamPrefix` (#122, migration tracked as #41), applied again
rather than reopened. `PaToolAgentConfig` already holds a kit reference and calls the canonical
copy directly.

Paging keeps its byte-identical reassembly contract. The tail guard ends a page one unit early and
`next_offset` follows `slice.length`, so a straddling pair moves **whole** to the next page rather
than being split or dropped. Two cases deliberately do not trim, both because the reader would
otherwise stop advancing and page forever: the final page, and a single-unit page. The front guard
is only reachable when a caller passes an arbitrary offset, and the response now reports the offset
actually **served** rather than the one requested.

Truncation markers stay exact: every `+N more chars` and `[elided N chars]` count is now taken from
the clipped length rather than from the intended limit, so shaving a surrogate cannot quietly
understate what was cut (R-24).

Duplication is only safe if it cannot drift, so `test/utf16ClipContract.test.js` asserts the copies
are byte-identical and walks all nine sites through their real entry points, failing on an unpaired
surrogate anywhere in the output — the structural form already used by `coreTruncationContract`,
for the same reason: fixing instances one at a time was not converging.

## 2026.08.0901 — 2026-08-09

### Fixed — an omitted `fixes` no longer costs two errors on the inconclusive path (#148)

Found by the #134 retrospective, from live data rather than from reading the code. Six of the seven
`EVIDENCE RETURN` runs that terminated `failed` stored a rejected draft of one shape: `root_causes:
[]`, a well-formed `inconclusive` object, `data_markers: []`, and **no `fixes` key and no
`verification` key** (TR1000168, 174, 182, 208, 214, 218). That two-problem pair, alone, appears in
**0 of the 202** non-firing runs on gpinst01.

The mechanism is a gap between two predicates. `_isInconclusiveShape` was satisfied;
`_isInconclusiveWithoutFixes` additionally required `_isArray(report.fixes)`, so an **absent**
`fixes` was not an **empty** `fixes`, both relaxations vanished together, and one omission raised
two problems. `repairPrompt` then re-served the same schema text that produced the omission, which
is why the one allowed repair turn never rescued any of the six.

Fixed at both layers. `schemaText` now states the presence requirement for the `fixes` array first
and in the words `data_markers` and `fixes[].current` already use — the previous line opened with
"NON-EMPTY unless …", which reads as *omit it unless*. `_checkFixes` and
`_isInconclusiveWithoutFixes` treat a **missing** key as empty on the inconclusive path; a `fixes`
that is present but not an array still errors, and off the inconclusive path nothing is relaxed.

This is not only #134's mechanism. §T4's ruling is that an honest inconclusive must be expressible
or the only structurally valid output is an invented root cause — the trap silently un-did that for
any run choosing the shape. `MAX_EVIDENCE_RETURNS: 0` closed the route those six runs took, not the
trap.

Accepting the omission creates a second valid shape, so `validate` now fills `fixes: []` into
`normalized` — `renderJson(normalized)` is what lands in the run row and comes back out of
`GET /runs/{id}`, and two shapes for one claim is the silent inconsistency this file exists to keep
out.

### Fixed — the same trap one key over, found by review (#148)

`root_causes` carried the identical wording — *"NON-EMPTY unless you supply the `inconclusive`
object"* — and `_isInconclusiveShape` required `_isArray(report.root_causes)`, so omitting **that**
key cost both relaxations the same way. Measured before the fix: three problems from one omission,
and with `fixes: []` supplied it produced `fixes must include at least one entry` — an instruction
to the repair turn to **invent a fix** for a report that explicitly declined to name a cause, which
is the §T4 fabrication pressure the inconclusive path exists to remove. Fixed symmetrically, and the
inconclusive block is still priced for its sweep claims on that path.

Unlike the `fixes` case this is a **predicted** failure, not a measured one — all six live drafts
did send `root_causes: []`.

A `fixes` (or `root_causes`) that is **present but wrong-typed** — `null`, `{}` — is deliberately
not relaxed, and is now pinned by tests. The single repair turn has to see every requirement at
once; relaxing verification for a wrong-typed `fixes` would show it only the type error, and a
repair returning `fixes: [ ... ]` with no verification would then fail with no turns left. An absent
key does not have that shape because it needs no repair at all.

`verification` is deliberately **not** normalized alongside `fixes` and `root_causes`: `[]` is the
real empty value of a list and invents nothing, while a filled `verification` string would fabricate
a claim about a step someone took. `renderMarkdown` already renders the absence as
*"(not applicable — inconclusive)"*.

Suite: **1406 passed, 28 suites** (1390 on `main` + 16). `now-sdk build` clean on SDK 4.9.2.
`benchmark/DECISION.md` §AB.

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

Suite: **1388 passed, 28 suites.** No production code touched. `benchmark/DECISION.md` §AA.

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
and names every field it changes. §T9 named only the first case; leaving the second would have
reproduced its exact complaint on the same column.

The clauses sit inside §A2 because only §A/§A2/§A3 are copied into a scorer packet.
`test/rubricClauses.test.js` pins both the clauses and that placement.

`benchmark/scorecard-v9-derived-139.md` applies the repaired rule to facts the twelve blind
scorers already recorded — every cell sourced to a quotation. Two cells change: rows 05 and 06
left the replacement `api` value unfilled, and seed 04's spec records that value as held by 422
of 2026 capability-definition rows on the instance, so it was obtainable. **Native's gate
6/6 → 4/6, totals 36/36 → 34/36; custom unchanged at 0/6.** Row 10 is listed **unresolved**
rather than decided — its own result file points both ways on whether the fix specifies a table —
so the custom rubric **total** is open between 9/36 and 8/36; the custom **gate** is 0/6 under
either reading. `scorecard-v9.md` is untouched — those are the scores the blind scorers produced.

The result lands between §T5's two published bounds and moves against the arm this project
currently recommends. §T3 is untouched, and nothing here is evidence about diagnostic quality.

Recorded in `DECISION.md` §Z. Suite: **1374 passed, 28 suites** (was 1365/27 — `rubricClauses.test.js`
is a new suite, +6, and the review round added +3 positive controls to
`scorerPacketBlindRule.test.js` when the packet-path regex was widened). No production code touched.

## 2026.08.0708 — 2026-08-07

### Fixed — the blind-rule gate now scans the packets, not only the seed specs (#140)

§T7 found `test/scorerPacketBlindRule.test.js` passing 11/11 while two one-hop routes to the
answer key sat in the v9 packet framing: `(verbatim from benchmark/scorecard-template.md)`,
whose template cites DECISION.md, and `(verbatim, benchmark/seeds/seed-0N-….md)`, whose parent
holds `seeds/history/`. Both were shorter than the two-hop route the packet builder had already
flagged, and both were removed by hand. Second consecutive round caught by a human, not the gate.

The guard was working exactly as written — `answer-key-pointer` matched a literal `DECISION.md`
and scanned one of the rule's three channels, the seed specs.

`PACKET_PATTERNS` adds a single any-repository-path rule bound to the packet channel — any bare
`*.md` filename, plus longer paths rooted at an enumerated directory stem; it aims at uniformity
without quite reaching it, and a non-markdown file outside those stems is not matched — and
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

> **Forward note, 2026-08-08 (#144).** Accurate for the rule shipped here, and left unedited. It
> understated one residue: a reference stopping at an enumerated stem did not fire. Closed at
> `2026.08.0801`; see `benchmark/DECISION.md` §AA3.

## 2026.08.0707 — 2026-08-07

### Fixed — `analyze` stopped discarding `createRun`'s note (#105)

`PaRunManager.createRun` returns a `note` when the creation row exists but the write that forces
`status: 'queued'` failed — the row may read `running`, and since #99 the inbound request was not
persisted either. That is R-19b working: the caller is not handed a claim the row contradicts.

`PaRestHandlers.analyze` never read `created.note`. `_queueDiagnose` answered a hardcoded
`{run_id, status: 'queued'}`, so the note was being written for a consumer that could not see it —
R-19b honoured at the manager boundary and dropped one layer up. An API caller was told `queued` for
a row that might read `running`, and told nothing at all about the request having been lost.

Both response paths now carry it: the 202 from `_queueDiagnose` and the 200 from `_runCollect`,
which the issue flagged for the same gap and which had it.

**The key is added, never blank.** `_withNote` attaches `note` only when there is one, so its mere
presence reads as "something went wrong here" without a consumer also having to test it for
emptiness. An always-present `note: ''` would put the trouble marker on every clean 202. A test pins
this: a clean creation must not carry the key at all.

**Why it matters more since #99.** Before #99 the note covered one concern, the status force. It now
covers two, and the second — the run's own diagnostic subject — is the thing #99 exists to make
recoverable. Losing it silently at the REST boundary is the failure mode #99 was filed against,
reintroduced one layer up.

No route change was needed: `rest-api.now.ts` sets `result.body` verbatim, so the note reaches the
wire as soon as the handler puts it there.

---

## 2026.08.0706 — 2026-08-07

### Fixed — the persisted-request clip no longer splits an emoji in half (#106)

`PaRunManager._requestFields` clipped an oversized inbound body with
`text.substring(0, REQUEST_CHARS)`. JavaScript strings are UTF-16 **code units**, so an
astral-plane character occupies two of them, and a clip landing between the halves left the stored
`request` ending in a **lone high surrogate** — not valid UTF-16. It survives the column, and then
threatens the two places the column is read back out: JSON encoding of the `GET /runs/{run_id}`
response, and XML export of the record.

The clip now goes through `_clipUtf16`, which drops a trailing high surrogate that has no low
surrogate after it. The cost is one code unit off a prefix that `request_truncated` already declares
truncated; the orphan's partner was outside the clip either way, so no whole character is ever
discarded by this.

**Why it was untested before.** #99 measured this path on gpinst01 and confirmed it stores exactly
60,000 units — with ASCII input, where every character is one code unit and the defect cannot
appear. The realistic trigger is the field the clipping exists for in the first place: a pasted
`logs` value containing an emoji, landing on the wrong boundary.

Two tests: one straddling the boundary (the regression), one ending a pair exactly **on** it, which
pins the guard to orphans only and would fail an over-eager trim.

**Sibling sites not touched.** The same code-unit arithmetic backs the digest clips in this file
(`_digest`, `_promptDigest`) and the clips in `PaToolReadKit`, `PaArtifactStore`, `PaToolAgentTrace`
and `PaAuditLogger`. Those feed `transcript` JSON and artifact bodies, so the JSON-encoding exposure
is the same shape. Filed rather than folded in here, to keep this fix scoped the way #106 itself was
scoped out of #99.

---

## 2026.08.0705 — 2026-08-07

### Measured — §V5's counterfactual: the strict release rule would have changed 1 release in 64

**Retrospective. No runs fired, nothing enabled.** `REQUIRE_RETRIEVAL_TO_RELEASE` stays `false`.
`DECISION.md` §Y.

§V5 pre-registered this as the cheap route to the evidence §T9 said was missing — the `retrieval`
column is written on every run regardless of the flag, so the counterfactual is measurable from
runs that were happening anyway. The §W round's 60 runs plus the 4 seed-03 guard runs supply the
first real corpus.

> **1 of 64 gate releases would have changed. 1.6%, 95% Wilson [0.3%, 8.3%].**

**Why the answer is nearly forced.** Of 154 scored rows, 144 are `ok`, 9 are `unknown` and 1 is
`none`. All nine `unknown` rows are `read_artifact` — which is **absent from
`PaFixReport._layerToolMap()`**, so it can never enter `_heldTools` or close a gap and its verdict
is structurally invisible to the gate. That leaves exactly one gate-relevant non-`ok` call.

**The one changed release is §T4's defect, live.** TR1000202 was held on *"layer 4 (ranked)"*, whose
sole tool is `schema_lookup`; it then called `schema_lookup` for `sn_tsbench_bench_ticket`, a guessed
table that does not exist. The tool answered `table_exists: false`, established nothing, and the
gate released on it — §T4 verbatim, with a different guessed name. Under the strict rule the hold
would have stayed sticky.

`_openGaps`, the flag's second consumer, changed nothing: the only barren gate-relevant call landed
*after* its run's first hold, so no gap was pre-closed anywhere in the corpus.

**The limit is severe and is stated in §Y5.** This is retrospective on runs whose behaviour was
shaped by the permissive rule, so it bounds how often the rule would **bind**, not whether it would
**help**. A rule that binds 1.6% of the time cannot help more often than that — the ceiling is the
useful half — but nothing here says it helps when it does bind. Zero `DENIED` rows in 64 runs, so
§V3's more consequential accepted false negative was never exercised and its ruling still blocks the
round.

### Instance — a version-label drift, closed

gpinst01 read `2026.08.0703` while `main` had moved to `2026.08.0705`. The deployed **code** was
correct throughout and probe-verified; only the label lagged, because §W1 pinned the round build at
`2026.08.0703` deliberately (its "one edit" claim) and the post-round restore was installed before
the bump. Synced with a behaviour-neutral rebuild + reinstall and re-probed: `sys_app.version` =
`2026.08.0705`, `MAX_EVIDENCE_RETURNS: 0` → 1 record, `REQUIRE_RETRIEVAL_TO_RELEASE: true` → 0
records. Rollback context `dcc777712bea4f94f243fed2ce91bf30`.

Recorded because §W7's pre-flight item 1 reads `sys_app.version`, and a stale label is exactly the
misleading deploy signal this project has repeatedly been bitten by — `now-sdk install` does not
stamp `sys_updated_on` either, so the `scriptLIKE` probes remain the real check.

---

## 2026.08.0704 — 2026-08-07

### Measured — the §W sized round ran, and the evidence return is REFUTED (#121 steps 3–4)

`MAX_EVIDENCE_RETURNS` **stays at `0`, and #81 is done — not re-measured a third time.**

The round pre-registered in `DECISION.md` §W was executed against gpinst01. §W merged as `2d11e4d`
at 22:50Z; the first run posted at 23:04:32Z, so the prediction preceded the data and the ordering
is checkable in git. Full measurements: `benchmark/raw-evidence-v11-sized-round.md`; verdict and
reasoning: `DECISION.md` §X.

| Quantity | Value |
|---|---|
| `n` | **60** (the §W4 hard cap, reached) — 30 A / 30 B, strictly sequential |
| Terminal states | 56 `complete`, 4 `failed`, **0 `partial`** |
| **`D`** (runs firing an `EVIDENCE RETURN`) | **10** |
| **`N`** (of those, a post-note `retrieval=ok`) | **1** |
| `N / D` | **0.10** vs §W6's `1/2` threshold |

**Nine of the ten runs told "you need a tool call, not a rewrite" rewrote anyway** — two of them
spending both permitted returns doing it. §U8.3 set the bar at one half because the return earns
its machinery (classifier, cap, headroom guard, state block, draft stash, terminal path) only if
the otherwise-impossible move happens at a non-marginal rate. At 1 in 10 it does not.

**This is a refutation, not an undecided round.** §W3 pre-committed to reporting a near-threshold
revert as "not distinguishable from the threshold"; that clause does not apply, because the 95%
Wilson interval on 1-of-10 (~[0.018, 0.404]) excludes 0.5. `D` = 10 is §W4's reduced-power exit
(`8 ≤ D < 12`) and that is stated rather than buried — but the caveat biases toward *ratifying*,
and the round did not ratify.

**§V2's "after the first note" clause did the entire job.** A bare
`run=<sys_id>^action_type=result^retrieval=ok` query matches **all ten** firing runs, because every
run opens with a gate-driven sweep whose tools legitimately score `ok` — before the note. Dropping
that clause would have inflated the numerator 10× and ratified the mechanism on tool calls the run
was always going to make. This is §V1's "counts a call rather than a retrieval" defect in its third
form, caught by the pre-registration.

### Fixed — two silent measurement defects, found before run 1

- **`partial` is not readable from `status`.** A bound-triggered stop closes the run `complete` and
  reports `outcome: 'partial'` — and `outcome` is `run()`'s return value, not a persisted column.
  Counting §W5's partials off `status` would have returned 0 for every run no matter what happened,
  making the ≥3 revert trigger unfireable. The durable marker is the literal `INCOMPLETE:` in the
  transcript (`PaAgentLoop.js:1648`).
- **§W7 probe 2 verified rather than assumed.** `MAX_EVIDENCE_RETURNS` and the docblock's
  `maxEvidenceReturns` differ by underscores, not merely case, so the probe cannot collide with the
  comment whichever way `LIKE` handles case.

### Recorded — observations that are NOT §W6 inputs

- **All 4 `failed` runs were firing runs**, all on the same shape-class problem. `failed` is not
  `partial`, so §W5 is untouched. Whether the extra rejection turn *causes* the malformed report is
  **not established** and needs its own pre-registration.
- **#129 earned its place.** The single conversion called `genai_log` with the parameter-prefixed
  argument shape; #125's routing fix read it correctly (`llm_call_rows: 3`). The identical
  malformation scored `none` in §U9.1, so without the pre-round repair `N` would most likely have
  been **0** — a point that cuts against the change, not for it.
- **Seed-03 regression guard clean** — 4 runs, 4 `complete`, 0 `partial`, 0 fires.

### Instance

Restored to the shipped dormant default and probe-verified after reinstall (`: 0` → 1 record,
`: 2` → 0 records, `REQUIRE_RETRIEVAL_TO_RELEASE: false` → 1 record). Rollback context
`c3b3fff92bee839817a6ffbeee91bfc9`. Unit suite 1340/1340 — the nine dormant-default guards fail on
the round build and pass on the shipped one, confirming they pin the right constant.

---

## 2026.08.0703 — 2026-08-07

### Fixed — the five `PaAgentLoop` prerequisites blocking #121's sized round

`DECISION.md` §V6 condition 3 names a list filed on #121's first comment as blocking the
`MAX_EVIDENCE_RETURNS` flip off `0`. All five live in `src/server/PaAgentLoop.js` and are the
state the round is about to turn on, so they are cleared before it rather than during it (#130).

- **`run()` now resets per-run gate state.** `_resetGate()` was called from `initialize()` alone,
  which made every field it clears per-**instance** rather than per-**run**. Production news up a
  fresh loop per event (the async ScriptAction worker), so nothing could observe the leak — but
  the fields are not equally harmless if one ever did. A carried `_holdCount` costs the next run
  some hold budget; a carried `_rejectedDraft` makes `_finishPartial` persist run N's report onto
  run N+1's row *and* write a transcript note asserting the draft came "from this run". The reset
  covers the depth gate too, deliberately: holds are a per-run budget, so a per-run reset is the
  correct semantic rather than a side effect of where the call was put.
- **A `null` no longer overwrites the evidence-return defaults.** `null >= 0` is `true` in JS, so
  the two guards at `initialize` admitted `null`, `''`, `[]`, `true` and numeric strings — and
  then assigned the value verbatim, so `evidenceHeadroomMs: null` did not fall back to `30000`,
  it made the time margin `null`. `undefined` and `{}` were the only junk the old shape caught,
  because they coerce to `NaN`. Now `typeof … === 'number' && … >= 0`, which keeps `0` settable —
  #81's revert trigger disables the path that way, so a naive `> 0` repair would have been worse
  than the bug. `REQUIRE_RETRIEVAL_TO_RELEASE`'s own guard already cited this defect in its
  comment; these two never got the same treatment.
- **The allowed second evidence return (1 → 2) is covered.** The first return and the cap-spent
  boundary were both tested; the transition between them was the only untested step on the path
  the round enables.
- **`_finishAnswer`'s dropped draft is re-decided, and stays a drop.** `_finishPartial` and
  `_finishFailedLlm` both persist a stashed draft; this path does not, and the asymmetry is the
  decision. Reaching `answer` after an evidence return means the model was handed its draft back,
  went and gathered, and then chose prose over resubmitting — an abandonment, and persisting a
  report the model declined to stand behind would misrepresent it as the run's diagnosis. The two
  paths that keep a draft never got that choice: a `partial` ran out of iterations or clock
  mid-flight, a failed LLM call died before the model could act. Behaviour unchanged; the bare
  omission is now a stated rationale plus a test that locks it.
- **`_buildPrompt`'s comment claimed `_holdActive` and `_evidenceBlock` are never both set.**
  False, and verified false by reading the paths rather than on the strength of the filing:
  `_depthGate`'s unreadable-trail short-circuit allows *without* setting `_gateReleased`, so a run
  can pass on a degraded trail, fire an evidence return, then be held on a later iteration once
  the trail recovers — and because `_handleFixReport` is never reached on the iteration that
  holds, the block is not cleared. The rendering already handled it; only the claim was wrong.

**Neither dormant switch is touched.** `MAX_EVIDENCE_RETURNS` stays `0` and
`REQUIRE_RETRIEVAL_TO_RELEASE` stays `false`. This release clears a precondition for the round; it
does not start it, and it measures nothing.

**Still open on #121 before the cap can leave `0`:** §V6 conditions 1 and 2 — size `n` against the
observed ~50% fire rate for the *denominator*, and fix the stopping rule before the first run
(§U8.3's `D < 3` stop fired at exactly the boundary and could not be extended without optional
stopping). Also deferred, and blocking the separate `REQUIRE_RETRIEVAL_TO_RELEASE` round rather
than this one: §V3's ruling on `reads: 'DENIED'` scoring `retrieval=none`, which by R-26 is a
permission gap rather than an absence. The sixth item on #121's comment — the
`_checkUnconfirmed` / `_checkInconclusive` classification asymmetry in `PaFixReport.js` — is
spec-conformant and stays on #121.

Suite: **1340 passed, 27 suites** (was 1320/27). `now-sdk build` clean on SDK 4.9.2.

---

## 2026.08.0702 — 2026-08-07

### Fixed — the argument-shape layer, ahead of #121's sized round

Three follow-ups from PR #124's whole-branch review, taken together because a malformed tool
argument is what cost #121 its numerator: §U9.1's honest evidence-return rate is **1 of 4 rather
than 2 of 4** because one run's `genai_log` call arrived as the bare string
`execution:45bbfd112ba6cf54f243fed2ce91bfcb`, returned `entries: []`, and counted as a call that
retrieved nothing. Repairing this layer before the round is what stops the round measuring our own
argument bugs.

- **`schema_lookup` routes a stripped parameter prefix to the slot it names** (#125). Its guard
  covered `table` and `table_name` only, while `_normalizeArgs` accepts `field`, `element` and
  `column` and the tool description tells the model that *table and field* are both parameter
  names. It was the last tool whose guard did not cover its full accepted parameter list after
  #122.

  The one-line widening the issue proposed would have made things **worse**. `_normalizeArgs`'s
  no-dot branch puts whatever survives the strip into the **table** slot, so stripping `field:`
  without routing reads `field:channel` as a table called `channel`, performs a real
  `sys_db_object` read, and reports `table_does_not_exist` — "a genuine absence, the table name is
  wrong". That is a confident claim about the instance built on a word the model merely spelled
  out, and it is the exact false diagnosis #111's guard exists to prevent. Today that call fails
  **safe** (`table_name_malformed`, no read attempted). So `PARAM_PREFIX_PATTERN` gained a capture
  group and `PARAM_PREFIX_SLOT` maps each name to its slot; `field:channel` now reaches the
  `no_table` branch, which asks for the table rather than inventing a verdict about one.
  `DOTTED_PREFIX_PATTERN` is untouched — its three-segment discriminator is backed by #114's
  measured behaviour and there is no field-shaped evidence for it.

  Also fixes the `_prefix_stripped` note, which hardcoded `a.table` and so reported `read as ""`
  for a field-only strip — announcing a repair while withholding its result.

- **`agent_trace`'s pick-list offers the bare agent name again** (#127). PR #124's F1 fix correctly
  stopped the string teaching `agent=<name>`, but the replacement offered the agent only as a JSON
  key, while the tool accepts a bare agent name and its own description advertises one. It was
  steering the model off a supported, simpler shape in the message read immediately before a retry.
  Now matches `agent_config`'s register: "on its own, or a JSON object".

### Added — a guard, so this is the last time it is found by reading

- **`test/paramShapeScan.test.js`** (#126) scans the string literals of `src/server/tools/**` and
  `src/fluent/agent-doctor.now.ts` for the tight `<param>:<value>` / `<param>=<value>` shape, keyed
  to each tool's own `PARAM_NAMES`. The shape had been removed from tool-facing text twice (#111,
  then #122 plus its whole-branch review) and found by reading both times; nothing failed if it
  drifted back onto the pick-list, no-args and refusal paths.

  Both rules were derived from the tree. A naive line scan finds 237 matches; restricting to string
  literals leaves 16, because `table: a.table` is object syntax that never reaches a model. Of
  those, 15 are deliberate counter-examples and 1 is English punctuation ("the triggers
  section: compare the trigger run_as") — hence **tight form only**, since call syntax is written
  tight and prose is not. And **negation exempts**, which is #126's requested opt-out in place of
  the file+line allowlist it sketched: an allowlist is hand-maintained, goes stale when lines move,
  and records that a line is exempt without recording why, whereas the negation is the property
  that actually makes showing a bad shape safe.

  The tree then corrected the design: `schema_lookup`'s `table_name_malformed` next_step splits
  `not ` and `"table:incident"` across a string concatenation, so the one string #126 promised to
  spare would have been the one flagged. The check bridges to the preceding literal, but only
  within 3 characters of the start.

  The scanner is a unit under test in its own right before being pointed at the tree — a source
  scan's characteristic failure is matching nothing for a reason nobody notices and reporting green
  forever. Two tests assert it can still see its inputs, and the tree guard was proven to
  discriminate by planting a drifted string in both arms.

### Notes

- Full suite **1320 passing, 27 suites** (from 1287 / 26). `now-sdk build` passes on SDK 4.9.2.
- `docs/superpowers/specs/2026-08-06-tool-arg-prefix-guard-design.md` §2.1, §4, §5 and §6 carry
  resolution notes; §6's "`schema_lookup`'s behaviour — unchanged in every respect" is marked
  superseded.
- **No instance behaviour changed for #121's switches.** `REQUIRE_RETRIEVAL_TO_RELEASE` and
  `MAX_EVIDENCE_RETURNS` remain dormant; this release only repairs the argument path the round
  will run over.

---

## 2026.08.0701 — 2026-08-07

### Added — an instrument, not a behaviour change

- **A tool call is now recorded as having RETRIEVED something, or not.**
  `PaToolReadKit.retrievalVerdict` reads the `data.reads` map every tool core already builds and
  returns `ok` / `none` / `unknown`. R-25 permits an `'ok'` read status only from a path that
  actually fetched rows, so the verdict means rows came back — not that a probe succeeded. Three
  values rather than a boolean, so an unclassified row stays distinguishable from a barren one.

- **`x_snc_troubleshoot_audit.retrieval`** carries the verdict, written by both dispatch sites
  (`PaToolRegistry.dispatch` for the custom harness, `PaScriptToolAdapter.invoke` for the native
  one). **No default:** blank means a row written before this version, so `DECISION.md` §U9.1's
  eight runs never read back as a mechanical `none`.

  The verdict is taken on the tool core's **pre-threshold** result, and the position is the design.
  `PaArtifactStore.applyThreshold` replaces an oversized result with an excerpt envelope carrying
  no `reads` map, and `PaAuditLogger` then digests head+tail past 4,000 chars — so a verdict read
  back off `output` would score `unknown` for exactly the large results most likely to be
  productive.

- **`PaAuditLogger.invokedTools` returns `retrievingTools`**, the subset with at least one result
  row at `retrieval=ok`, read in the same single query. `tools` is unchanged: it remains the answer
  to "was this tool ever invoked", which is the question fabrication fails (#79), and
  `_auditContext`'s citation cross-check still uses it. A citation to a tool that ran and returned
  nothing is a weak citation, not a fabricated one.

### Changed — behind a flag that ships OFF

- **`PaAgentLoop.REQUIRE_RETRIEVAL_TO_RELEASE` (default `false`).** When enabled, the depth gate
  discharges a hold only against a tool that retrieved something. `DECISION.md` §T4 measured why:
  v9 row 07's `schema_lookup` answered `table_exists: false`, established nothing, and released the
  gate, because the release path compares tool names from the audit trail and never inspects the
  result.

  **It ships dormant on §U9's precedent** — *"No verdict is not the same as proven, so the default
  is off"* — because §T9 asked for this rule and said in the same breath that whether it helps is
  unmeasured. At the shipped default, gate behaviour is unchanged in every particular, and a test
  asserts exactly that. The audit column is written regardless of the flag, so the counterfactual
  is measurable for free from runs that were happening anyway.

  Both of `_depthGate`'s trail consumers use the same set — the sticky release check and
  `_openGaps`. Strict in one and loose in the other would let a barren call pre-close a declared
  gap before any hold could be issued.

### Documented

- **`DECISION.md` §V** pre-registers the amended evidence-return numerator: a gathering call counts
  toward `N` only when its audit result row carries `retrieval=ok`. §U1–§U9 unmodified. The number
  a future round must beat is **1 of 4**, not 2 of 4. The sized round and the
  `MAX_EVIDENCE_RETURNS` flip are explicitly deferred, with the three conditions that must hold
  first.

### Not changed, deliberately

- `MAX_EVIDENCE_RETURNS` stays at `0`. This version adds no evidence about the evidence return.
- `_step`'s optimistic hold-clear after a dispatch still matches by tool name. It affects prompt
  wording only; the real trail-backed check still runs at the next terminal action.
- The five prerequisites on #121's first comment are untouched. They block the cap flip, not this.

---

## 2026.08.0602 — 2026-08-06

### Fixed — but SHIPPED WITH NO RUNTIME EVIDENCE, read this first

- **The `<param>:<value>` argument-prefix guard now reaches all seven diagnostic tools, not just
  `schema_lookup`.** `splitParamPrefix` recognises an argument arriving as its own parameter name
  prefixed onto the value (e.g. `execution:45bbfd112ba6cf54f243fed2ce91bfcb`) and **routes the value
  to that named parameter** — it synthesizes `{execution: "45bbfd…"}` and lets it re-enter the
  tool's existing object branch, so every alias, coercion and mode inference the tool already owns
  applies unchanged. It does **not** strip the prefix and fall through to the bare-string branch:
  fall-through discards which parameter the model named and misroutes whenever the value's shape
  does not match what that branch assumes (`capability:foo` would be read as a mode; an
  `execution:MyRun` that is not a sys_id would be read as an agent name). See design §3.2.
  `genai_log`, `log_analysis`, `query_table`, `agent_config`, `agent_trace`, and `read_artifact`
  were added this round; `schema_lookup` already had the guard and is **untouched** by this branch.

- **The repair is never silent.** Each tool pushes a note naming the raw string as sent, **the slot
  the value was read into**, and the fact that the audit trail records the call as sent rather than
  as repaired. Naming the slot is what makes a false positive legible — `log_analysis` given
  `level: DEBUG` reroutes a message search into the `level` parameter, which a reader can only see
  if the note says so.

- **The tool contracts agree with the runtime.** The six corresponding tool descriptions — what the
  LLM reads before calling each tool — gained the same anti-prefix sentence `schema_lookup`'s
  already carried, on **both** the tool-level description and the per-input description the native
  Fluent arm ships. The in-band guidance the tools emit at runtime on their pick-list, no-args and
  refusal paths was rewritten in the same register: it named the `<param>=<value>` shape in fourteen
  places, which taught the exact malformation the guard exists to repair, at the moment before the
  model retries.

- **Stated plainly: this ships with no runtime evidence.** The agreed done-bar for this branch was
  unit tests plus a clean `now-sdk build` and `now-sdk install` — not a live probe or a benchmark
  round. #121's sized evidence-return round is where this fix gets its first live exercise; until
  then, treat "the guard reaches every tool" as tested-in-isolation, not observed-in-production.

- **#41 (migrating `agent_trace` and `read_artifact` onto `PaToolReadKit`) is still open** — this
  branch added the prefix guard to both tools' existing cores without touching that migration.

---

## 2026.08.0601 — 2026-08-06

### Added — but SHIPPED DORMANT, read this first

- **The evidence return (#81) ships DISABLED at `MAX_EVIDENCE_RETURNS: 0`.** The mechanism is
  built, tested and deployed, and it is **inert** unless a caller passes `maxEvidenceReturns`
  through `PaAgentLoop.initialize()`. **Do not read this entry as "the harness now returns
  evidence rejections to the loop" — by default it does not.** Two pre-registered smoke rounds
  over eight seed-01 runs returned **no verdict**, and no verdict is not the same as proven, so
  the default is off. Full reasoning: `benchmark/DECISION.md` §U8/§U9.

- **What the mechanism does when enabled.** `PaFixReport.validate` now classifies its rejection
  problems into a **shape** class (fixable by rewriting) and an **evidence** class (fixable only
  by calling a tool and reading another source), returning the latter as `evidenceProblems`.
  `PaAgentLoop._handleFixReport` hands an evidence-class rejection **back to the main loop**
  (`{terminal:false}`), where tools are live, instead of into the tool-less repair turn that
  cannot fix it. Shape rejections keep the repair turn, which #64/#65 established works for them.
  Bounded by `MAX_EVIDENCE_RETURNS` (2 when enabled, separate from `MAX_HOLDS` — a shared pool
  would have given v9 rows 07/08 zero returns) and `EVIDENCE_HEADROOM_MS` (30 s, plus two
  iterations of headroom). Every guard fails toward the pre-existing behaviour.

### Fixed

- **A rejected `fix_report` draft now survives to the terminal record — via two paths, and only
  one of them has live evidence.** The **pre-existing** `_finishFailedFixReport` close path
  (unchanged by this branch) is **live-verified in production**: smoke run TR1000168 (v10-1)
  closed `failed` with its draft intact — its transcript note is that path's own error text, not
  Task 6's. §T scored v9 rows 07 and 08 from exactly that field, so this pre-existing behaviour
  closes a hole that would otherwise have destroyed scorable rows. **Task 6's new addition** — a
  run that rides an evidence return out to `MAX_ITERATIONS`/`BUDGET_MS` without resubmitting now
  also closes `failed` with its draft attached, via `_finishPartial`/`_finishFailedLlm` stashing
  `_rejectedDraft` — is **tests-only**: 0 of 8 v10 smoke runs (both rounds) terminated `partial`,
  so this path has never run in production. See `benchmark/DECISION.md` §U9.2.

- **`_handleFixReport` now returns `_step`'s result shape** — a pure refactor removing a divergent
  return contract.

### Measured

- **Two pre-registered smoke rounds, eight seed-01 runs, NO VERDICT.** Round 1 (n=4, seeds 01 and
  03) and round 2 (n=4, seed 01) are recorded in
  `benchmark/raw-evidence-v10-evidence-return-smoke.md`. Neither is a scored pass — custom arm
  only, no native control, no scorers, no rubric, no scorecard row, per §T9's call to fix the
  rubric clause before spending another scored round. Round 1's prediction was committed before
  any run fired (`1657a92`); round 2's amended clause and decision rule likewise (`9b45ff1`).

- **Round 1's §U3 clause was defective and yielded no verdict.** Its preamble allowed the
  prediction and its own refutation clause to fire on the same two runs. It was amended to
  per-run and re-run rather than resolved in the change's favour.

- **Round 2 returned UNDER-POWERED by its own pre-registered stop rule** — `D`=2 runs fired a
  return, `N`=1 made a tool call, `N/D` = exactly 1/2, and `D < 3` stops. The round was
  deliberately **not** extended to break the tie, because at the boundary one more run decides
  everything and choosing to continue at that moment is optional stopping.

- **The honest pooled rate is 1 of 4, not 2 of 4.** Across all eight seed-01 runs, four fired a
  return, **two** made a tool call after it, and **one** call actually retrieved anything — the
  other was malformed (`execution:<sys_id>` as a bare string) and returned zero rows. The
  pre-registered numerator counted a *call*, not a *retrieval*, which is the identical defect §T4
  found in the depth gate's release rule. **Quote 1 of 4.**

- **One genuine first: the custom harness called `genai_log`,** after 63 runs that never did
  (§T6), three seconds after an evidence return. It is the single unambiguous instance of the
  mechanism doing what it was built to do.

- **No diagnostic-correctness claim is made.** All four round-1 reports concluded at layer 1 or at
  nothing against seeded layers 3 and 5 — the same result §T3 measured six times. The change
  targets evidence *gathering*; it did not move a diagnosis.

- **A fixed defect regressed:** the `<param>:<value>` argument malformation T6 recorded at 0 of 6
  in v9 is back, on `genai_log` — a tool the #111/#113/#115 fixes never exercised because no
  custom run had ever called one. Filed, not fixed.

---

## 2026.08.0505 — 2026-08-06

### Measured

- **The v9 scored pass: native 36/36 and 6/6 on the gate, custom 9/36 and 0/6 (#119).** Twelve
  scored rows — 6 native + 6 custom, seeds 01/03/04, two reps each, **both arms the same day** on
  gpinst01 at app version `2026.08.0504`, scored blind with one independent scorer per packet. Zero
  void rows, zero retries. Predictions T1–T11 were all filed before any run: **six held, five
  refuted, none unscored.** No product code changed; this pass measures the build §S shipped.

- **Every custom row scored 0 on `root_cause_layer_correct`, and that is the finding.** The depth
  gate aimed all six custom runs at layer 4 and all six went there — and all six then filed their
  root cause at **layer 1** (five literally; the sixth at layer 4 on `sn_tsbench_bench_ticket`, a
  table that does not exist). Seeded layers were 3, 3, 5, 5, 6, 6. **Reaching a layer and
  diagnosing at it are different things**, which bounds what §Q2's "the gate can aim the model at a
  layer" was ever worth. DECISION.md §T3, with a dated pointer at §Q3.

- **The hold is satisfiable cosmetically, and the gate counts a call rather than a reach.** All six
  holds cited "layer 4 (ranked)" and all six were answered by a `schema_lookup`; **not one pointed
  at the table the seeded defect lives in** (five OOB/platform tables, one nonexistent). Row 07's
  lookup returned `table_does_not_exist` and released the hold anyway — confirmed empirically and
  in `_depthGate`, whose release test reads tool **names** out of the audit trail and never
  inspects what the tool returned. DECISION.md §T4.

### Found in the instrument

- **T8 refuted badly, and it undermines confidence in every score in the pass — including the
  favourable ones.** **9 of 12 rows flagged `ambiguous = yes`** against a prediction of ≤2. Rows 03,
  04, 05 and 06 flag the identical gap: a fix naming the right target but omitting a value no
  diagnosis could recover. `fix_usable_unedited` does not determine that case and it is one of the
  gate's two terms; rows 01 and 02 record a second under-determination in the same column. **All
  six native rows carry a recorded alternative reading yielding 0** — which leaves native at 30/36
  on totals (direction intact) but **0/6 on the gate**. **The direction is robust; the precise
  totals are not, and must not be quoted as stable.** Custom's 0/6 has no such sensitivity —
  `root_cause_layer_correct = 0` was flagged ambiguous on no custom row. §O5 filed this defect three
  passes ago and it was never closed. DECISION.md §T5.

- **The blind-rule test passed green while two one-hop paths to the answer key existed** in packet
  framing — `(verbatim from benchmark/scorecard-template.md)`, which cites "§O5 of `DECISION.md`",
  and `(verbatim, benchmark/seeds/seed-0N-….md)`, the parent of `seeds/history/`. **The gate was
  working as written and blind to the real hole:** its `answer-key-pointer` pattern only matches a
  literal `DECISION.md`, and it scans specs, not packets. Both were removed by hand before scoring.
  Recommendation on the record: widen the pattern to any repository path and run it over packets.
  DECISION.md §T7.

- **The native arm never writes a terminal status onto its `x_snc_troubleshoot_run` anchor.** All
  six native anchors sat at `status: running` after their executions reached `completed`. A scorer
  or tool reading `status` off a native anchor would misread it. Recorded, not fixed.

- **`continuous_tool_execution_limit` was not read during the pass**, which template §D requires per
  run. Recorded as *not read* rather than carried forward from §O1's `25` as if measured.

### Added

- `benchmark/raw-evidence-v9-scored-pass.md` — protocol, pre-flight, all 12 rows with
  audit-derived measurements, per-row scorer verdicts and the ambiguity each flagged, the
  sensitivity analysis, and the complete packet-deviation record.
- `benchmark/scorecard-v9.md` — the scorecard proper, §A2's gate expression applied per row. **No
  Task 12 band verdict is stamped**: §A3.4 sets the evaluability floor at 8 valid runs and each arm
  has 6, so the proportions are recorded and the band lookup is not performed.
- `benchmark/scoring-v9/row-01…row-12` — the twelve blind packets exactly as scored, now tracked,
  byte-identical to what each scorer saw and unedited after scoring.
- `benchmark/scoring-v9/results/row-01-result.md…row-12-result.md` — the twelve scorers' full
  reasoning, following v4's `scoring-v4/results/row-NN-result.md` naming so the two passes read
  side by side.
- `benchmark/scoring-v9/trigger-report.md`, `run-evidence.md`, `packet-build-report.md` — how the
  six seeded executions were produced, all 12 rows verbatim (every Fix Report and transcript HOLD),
  and the packet-build report carrying §7's complete deviation record. Placed beside the packets,
  matching how `scoring-v4/` carries its own process subdirectories.
- DECISION.md §T, plus a dated pointer at §Q3.

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
  *positionally* against a **hardcoded literal snapshot** of `_layerToolMap()` — not a live re-read,
  which would be tautological, since the clause is generated from the map and both sides would move
  together. That defect was in the plan's own test design and was caught by the perturbation step
  written to catch exactly it. A second assertion pins that the map introduces no tool outside
  `_ALL_TOOL_NAMES`, which is where widening bites: such a tool would also survive `_scrubToolNames`
  and leak into the depth gate's direction. Teeth verified by perturbation in both directions. The
  literal must be updated by hand when the map changes — that friction is the point. Not extended to
  `PaToolRegistry.promptBlock()`, whose 8-9KB of prose is under active revision.

### Unchanged

- **No string the model reads.** `src/server/PaFixReport.js` is untouched; `PaAgentLoop.js` gained
  one corrected comment. The scored pass §R9 asks for stays comparable to §O's baseline.

## 2026.08.0503 — 2026-08-05

### Fixed

- **The depth gate's declared path let the model select its own cheap compliance (#116).**
  `_selectTarget` gave the model's own `would_confirm` layer precedence whenever it named an open
  gap. DECISION.md §Q4 measured the cost: that path carried 4 of 6 runs, and twice it steered the
  run to a cheap layer — both seed-04 runs named layer 3, whose `agent_config` has fan-out 3, while
  layers 4 and 5 sat open at fan-out 1, and `agent_config` legitimately discharged the hold. The
  target is now always drawn from the **minimal-fan-out class** of open gaps, with the declaration
  deciding only which member of that class wins. Direction survives — the model still chooses among
  equals; force survives — it can no longer nominate a layer cheaper than the run has available.
  Retro-applied to the verbatim v6 hold records, this flips exactly the two seed-04 holds
  (layer 3 → layer 4) and regresses nothing. The `matched` flag retired with it, so an unscorable
  named gap no longer forces the undirected union hold.

  **It does not make layer 6 reachable, and that was pre-registered (S3/S4).** Layers 1, 4 and 5
  score fan-out 1 and layer 6 scores 2, so layer 6 is targeted only once 4 and 5 are closed —
  and `MAX_HOLDS` is 2. The gate cannot **target** layer 6 within the cap; whether the model
  reaches `genai_log`/`log_analysis` unprompted is unmeasured. A tie-break that preferred
  layer 6 was rejected: no structural argument picks it over layer 4 other than "that is where the
  unreached tool is", which forfeits §H8 item 3's non-vacuity condition.

### Measured

- **A hold-block prompt fix was refuted by its own pre-registered test, and reverted (#116).** v7 §4
  found the gate's hold pushing `schema_lookup` arguments onto bare scalars that dropped the table.
  The hypothesis was that item 1's "Quote the specific **field** or value" offered a bare field name
  as a quotable unit. A paired A/B moved **nothing**: six scenarios, twelve trials, every pair
  byte-identical between arms — including the one scenario that reproduced the defect (S6 REFUTED,
  `benchmark/raw-evidence-v8-hold-item1-ab.md`). The rewording was reverted rather than shipped; a
  prompt change to text with 57 runs of history does not ship on a mechanism its own test declined
  to confirm. **This also refines v7 §7:** with the corrected contract deployed, an s3-shaped prompt
  still returns `"assignment_group"`, so the contract fix is not a general remedy for the
  table-omitted class. That residual is still live and its mechanism is unknown.

### Changed

- **The A/B instrument is reproducible from the repo for the first time (#116).**
  `benchmark/scripts/build-ab-prompts.js` gains a `--hold` mode composing both arms from the real
  `_holdBlock` via `loadScriptInclude` — v7's hold arms were composed ad hoc and the committed
  script had no hold block at all. Both item-1 constants are anchored to ground truth: the deployed
  wording against the live source, and against its verbatim appearance in
  `raw-evidence-v5-depth-smoke.md`. Without the second anchor, a wrong claim about the historical
  wording would still have printed `differs ONLY in item 1: true` and exited 0, because the
  substitution and the invariant re-use the same constant.

### Found

- **A deactivated NASK skill executed normally, twelve times.** `servicenow_skill_list` reports
  `pa llm reason` as `[OFF]` on gpinst01, yet every `servicenow_skill_execute` call against it
  returned normally. Build Rule #40 states a deactivated skill fails with a permission-flavoured
  error — that failure signature is **not universal across invocation paths**. Recorded, not
  chased: a future run that trusts `[OFF]` to mean "will fail" would misdiagnose.

---

## 2026.08.0502 — 2026-08-05

### Fixed

- **The #111 guard missed the spelling the defect actually takes (#114).** #113 stripped a `table:`
  or `table=` parameter prefix; the A/B experiment run against the pre-fix contract elicited
  **`table.sn_aia_tool.u_routing_key`** — the placeholder word `table` joined by the shorthand's OWN
  `.` delimiter. That normalised to `{table:'table', field:'sn_aia_tool'}` and returned
  `table_does_not_exist`, the exact silent wrong answer #111 existed to close, surviving in the form
  the defect most naturally takes. `.` could not simply join `:` and `=` in the character class
  because `incident.priority` is the legitimate shorthand; the discriminator is segment count —
  `table.<x>.<y>` cannot be a two-part shorthand, so stripping is unambiguous, while `table.<x>`
  stays ambiguous and is deliberately left to the shorthand path.

### Measured

- **The contract A/B (`benchmark/raw-evidence-v7-contract-ab.md`).** Paired trials on the one
  sentence #113 changed, driven through the `pa llm reason` seam — no tool executed, so no audit
  rows and no contamination of the evidence trail.

  Two findings beyond the fix itself. **The model is deterministic at production temperature** —
  identical prompt, byte-identical output, different latency — which invalidated the pre-registered
  "N = 30 repeats per arm" design outright: 30 repeats carry the information of one. v6's variation
  came from prompt variation, not sampling. The design changed to paired distinct scenarios.

  And **the depth-gate hold block is the trigger.** Without a hold, 3 of 3 control trials produced
  well-formed JSON — including one that guessed `incident`/`priority`, v6's exact guess. With a
  hold, 3 of 3 degraded to bare scalars. The malformation is the ambiguous contract *under the
  gate's hold*; neither reproduces alone in this instrument. #109's own mechanism is not neutral
  with respect to argument quality, which is worth carrying into the declared-path work.

  Predictions scored two held, two refuted. R4 predicted the `:` delimiter and was refuted by `.` —
  and that refutation is what found #114. **No rate or bound is claimed:** 3 paired scenarios, one
  model, one day, one reduced instrument. The pre-registered ~10% bound was not earned.

## 2026.08.0501 — 2026-08-05

### Fixed

- **`schema_lookup`'s own input contract was teaching the model to malform its arguments (#111).**
  Two of the six v6 runs called the tool with `table:incident` — the parameter name prefixed onto
  its own value — on two different seeds. §Q3 had to quote §H8's acceptance test as 2 of 6 rather
  than 3 entirely because of it, and §Q7 named fixing it as a prerequisite for the scored pass.

  Root-caused against the **live audit trail** rather than the benchmark markdown (the 15
  `action_type=intent` rows from the v6 window). The split is total: `agent_trace` (×6),
  `agent_config` (×3), `read_artifact` (×2) and `query_table` (×1) sent **well-formed JSON objects
  12 times out of 12**, while all three `schema_lookup` calls sent bare strings and two of those
  three carried the `table:` prefix. This was never a general tool-call-formatting defect in the
  model — it was one tool's contract.

  What was unique to that contract: `schema_lookup` is the only tool advertising a
  **delimiter-joined shorthand written with the literal parameter names** — "the shorthand
  `table.field`". One sentence earlier the same word names the JSON key ("a JSON object with table
  and field"), so `table` is simultaneously a key name and a placeholder for the table's value, and
  the notation gives a model no way to tell which. The model resolved the ambiguity toward
  *key + delimiter + value* and wrote `table:incident`, picking the `:` it meant over the `.` it was
  shown. Ruled out along the way: string-first phrasing (`agent_trace`, `agent_config` and
  `read_artifact` are all string-first and sent clean JSON 11 of 11 times), the transcript teaching
  the format (`_toText` `JSON.stringify`s objects, so prior calls render as JSON), and our own
  parser flattening a well-formed object (`_toText` returns strings unchanged).

  Fixed at the source in both copies of the description — `PaToolRegistry` and the byte-identical
  duplicate in `agent-doctor.now.ts` — plus the native tool's input-schema text: the shorthand is
  now shown with the real names substituted (`incident.priority`), and the rule that the parameter
  names are never part of a value is stated outright. `PaToolSchemaLookup`'s own no-table note,
  which modelled the same shape as `table=<name>`, now shows the value alone.

- **A malformed table name could claim the table did not exist (#111, the silent half).**
  `_normalizeArgs` took any bare string as a table name verbatim, so `table:incident` became a
  `sys_db_object` lookup for a table that cannot exist — `:` is not legal in a table name — and the
  empty read was reported as `table_does_not_exist`, whose `why` reads "a genuine absence — the
  table name is wrong". That is a claim about the **instance**, backed by a real read and a
  `success: true` audit row, and a model reasoning from it files a plausible, fully-audited, wrong
  root cause. Same silent-wrong-answer shape as the phantom-GUID family, arriving through argument
  formatting rather than through a ref, and invisible to every measure that counts which tools were
  invoked — which is how it survived a whole smoke.

  A name that cannot belong to any table now yields `table_name_malformed` with `table_exists`
  `unknown` and no lookup attempted, stating explicitly that it settles nothing about what exists.
  A recognised parameter prefix is stripped so the call still does its work, but **loudly**, per the
  issue: a note records the argument as sent, so the audit trail keeps the evidence that the model
  malformed it rather than having the repair erase it. A well-formed name that is genuinely absent
  still reports `table_does_not_exist`, guarded by its own test.

### Benchmark note

The tool descriptions are duplicated verbatim into `agent-doctor.now.ts`, so the contract change
lands on the **native** arm as well as the custom one. That is symmetric and is what §Q7 asked for,
but it does mean v6's numbers are not comparable to post-fix numbers on either arm. The prompt-side
half of this fix is unverified live — it is a behavioural claim about the model, and only a run can
settle it.

## 2026.08.0403 — 2026-08-04

### Changed

- **The depth gate now DIRECTS, where #103 only compelled (#109).** §P2 refuted #103's headline
  prediction: holds fired on 6 of 6 runs and the tools §H8 measures were reached 0 of 6. §P7 named
  the mechanism, pre-registered as a known tilt — `_depthGate` recorded the **union** of every open
  gap's tools as the release set, and `_layerToolMap()` credits `agent_config` with layers 2, 3 and
  7, so one `agent_config` call discharged the layer-4 and layer-5 gaps having touched neither. All
  six releases were `agent_config`, exclusively. Force was sufficient to make the model act and
  insufficient to make it act on the right layer.

  The gate now selects **one** target gap and records only that gap's **dedicated** tools. One rule,
  applied twice: a tool's *fan-out* is the number of layers `_layerToolMap()` lets it close, and
  fan-out minimality both picks the target and narrows its release set. Layer 5 is released by
  `query_table` and no longer by `log_analysis`, which is shared with layers 1 and 6 and would close
  a data gap without touching data — §P6's second candidate remedy, falling out of the same rule
  rather than needing one of its own.

  Selection prefers the model's **own** declaration: when a root cause's `would_confirm` names a
  layer that is an open gap, the target comes from that named subset — §P4 recorded a run naming
  layer 4 correctly while still not calling the tool that closes it. Within the named subset, and in
  the structural fallback, the ordering is the same: lowest fan-out, ties on the lowest layer number.

- **The interrogation names the target layer**, and still never names a tool — `_scrubToolNames` and
  its guard tests are untouched, and the block's strong claim ("the one no other line of
  investigation reaches") is now emitted only when the target's fan-out is actually 1, with a neutral
  variant otherwise. The harness does not assert to the model something it cannot know.

### Added

- **A two-hold cap (`MAX_HOLDS`), and a `GATE:` transcript note that marks a capped release.**
  Narrowing the release set broke #103's one-forced-beat arithmetic, which had rested on an
  unexamined premise: that any tool the prompt advertised for a held layer would discharge the hold.
  `PaFixReport.schemaText()` renders the **whole** layer-to-tool map into every prompt (*"5 (Data)
  needs one of: `query_table`, `log_analysis`"*), so for targets on layers 1, 5 and 6 the release set
  is now a strict **subset** of what the model has been told closes that layer — a compliant-looking
  call can fail to release. Uncapped, that rides to `MAX_ITERATIONS` and finishes `partial`, which is
  the pre-filed revert trigger for the smoke that follows, reached by a route the design did not
  anticipate. The cap bounds the cost at two beats; the trail check outranks it, so a genuine
  post-hold compliance is still classified as compliance. **A capped release is not compliance and
  must be counted separately** — that is what the `GATE:` note is for. The underlying advertise/accept
  mismatch is #110's, not this change's.

- **`PaFixReport.toolFanOut()` and `PaFixReport.declaredLayers(report)`** — two pure accessors over
  `_layerToolMap()` and the existing `_layersNamedBy`, so the loop ranks gaps without re-typing the
  map. The map itself is untouched: editing it would change what every prior pass measured.

### Not done in this version

The six-run smoke and its scoring. §P6's recommendation against firing a scored pass on a single
change stands, and this version is the code half only — `benchmark/DECISION.md` §Q and
`raw-evidence-v6-directed-depth.md` follow with the measurement.

---

## 2026.08.0402 — 2026-08-04

### Added

- **The inbound `POST /analyze` body is now persisted on the run it creates (#99).** Before this
  change the harness only ever wrote its own derived state to `x_snc_troubleshoot_run` — the
  request that started a diagnostic run was never recorded anywhere, including the audit table —
  so a run's own subject was unrecoverable after the fact and a later benchmark pass had no way to
  prove it had asked the same question as an earlier one.

- **Columns `request` (`MultiLineTextColumn`, `maxLength: 65536`) and `request_truncated`
  (`BooleanColumn`, `default: false`) on `x_snc_troubleshoot_run`.** Three states are
  distinguishable from the row alone: non-empty + `false` (whole body, `JSON.parse` valid),
  non-empty + `true` (a prefix past `PaRunManager.REQUEST_CHARS` — documentation, not data), and
  empty + `false` (absent — a native run, or a body that would not serialize). Absent and
  truncated never collapse into one state.

- **`PaRunManager.createRun` serializes the validated body and writes it in the same `update()`
  that forces `status: 'queued'`**, for both `mode: 'diagnose'` and `mode: 'collect'` — `collect`
  never queues and returns 200 inline, so its row would have missed a worker-side write entirely.

- **`getRun` returns `request` and `request_truncated`** — `request` is parsed JSON when the row
  is whole, the raw stored prefix when truncated, and `null` when absent. `_defaultReadRun`'s
  column projection was extended to carry both columns through to the API response.

- **No backfill.** Existing runs are not retroactively populated — `request` and
  `request_truncated` stay empty/`false` on every row created before this change, and those
  runs' requests remain unrecoverable, same as the design spec's own §7 non-goal.

### Measured

**Live round-trip on gpinst01 (SDK 4.9.2, Zurich Patch 10 Hotfix 3), both `analyze` modes,
verified after `now-sdk build` + `now-sdk install --alias gpinst01` both reported success.**

- **`sys_dictionary` confirms both columns installed as designed**: `request` —
  `internal_type: multi_two_lines`, `max_length: 65536`, `active: true` (a `MultiLineTextColumn`
  reports as `multi_two_lines` on this platform, matching the Fluent source); `request_truncated`
  — `internal_type: boolean`, `default_value: false`, `active: true`.
- **`mode: 'diagnose'` round-trip.** `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze` with
  `{"execution":"1a9e64bc2ba68354f243fed2ce91bf3d","timeframe":"1 hour"}` returned run
  `8af6123c2b66cb1817a6ffbeee91bf08` (`status: queued`). The following
  `GET .../runs/8af6123c2b66cb1817a6ffbeee91bf08` returned `"request":
  {"execution":"1a9e64bc2ba68354f243fed2ce91bf3d","timeframe":"1 hour"}` and
  `"request_truncated": false` — the parsed object matches the sent body exactly, and this exercised
  the real `_defaultReadRun` projection on a live read, not the injected test seam.
- **`mode: 'collect'` verified separately, as its own run, on its own row** (the path a worker-side
  write would have missed since it returns 200 inline and never queues). `POST .../analyze` with
  `{"execution":"d29e64bc2ba68354f243fed2ce91bf49","mode":"collect"}` returned run
  `33f652382b6e0754f243fed2ce91bf81`; the row read below shows `status: complete` — the 200 body
  itself carries no `status` field (`_runCollect` returns `{run_id, mode, data}` only, unlike the
  202 diagnose path, whose body genuinely does carry `status: 'queued'`). A direct `servicenow_query`
  on `x_snc_troubleshoot_run` for that `sys_id` shows `request:
  {"execution":"d29e64bc2ba68354f243fed2ce91bf49","mode":"collect"}` and
  `request_truncated: false`.
- **Truncation state observed live (fix wave, `_requestFields` now writes the STRING
  `'true'`/`'false'` rather than a JS boolean, matching `PaAuditLogger`'s idiom).** A 61,011-char
  serialized body (`JSON.stringify({logs: <61,000 'x' chars>})`) was built **server-side** inside a
  one-shot `sysauto_script` background job (never as a literal in an MCP tool call) that called
  `new x_snc_troubleshoot.PaRunManager().createRun({mode: 'diagnose', request: {logs: big}})`
  directly, then read the row back with a plain `GlideRecord`. Run `TR1000147`
  (`70232abc2b6acb1817a6ffbeee91bf04`): stored `request` is exactly **60000** characters (`REQUEST_CHARS`,
  not clipped at the column's 65536), and `gr.getValue('request_truncated')` read back the literal
  string **`'1'`** — confirming a ServiceNow boolean column normalizes a `setValue('true')` write to
  the platform's own `'0'`/`'1'` internal form on read, a third shape distinct from both the JS
  boolean and the string literal that was written, exactly as `PaRestHandlers._toBool` (accepting
  boolean `true`, `'1'`, and `'true'` alike) was written to expect.
  `GET /api/x_snc_troubleshoot/v1/troubleshooter/runs/70232abc2b6acb1817a6ffbeee91bf04` then
  returned the SAME row over the real REST route: `"request_truncated": true` (JSON boolean, via
  `_toBool`) and `"request"` as the raw, UNPARSED prefix string — first 60 chars
  `{"logs":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`, decoded length **60000**,
  matching the row exactly. The full 60,000-char value was never printed to this changelog or to
  any tool-call argument — only its length and prefix were asserted.

## 2026.08.0401 — 2026-08-04

### Added

- **The depth gate — a floor under `PaAgentLoop`'s terminal action (#103).** Before this change the
  loop had a ceiling (`MAX_ITERATIONS`) and no floor: the model ended a run by emitting `answer` or
  `fix_report` and nothing gated that choice, so every custom run on seeds 01/02/05 was 1 tool call
  / 2 LLM calls — turn 1 emits `agent_trace`, turn 2 sees evidence for the first time and files the
  report in the same generation. `PaAgentLoop._step()` now intercepts a terminal action, reads the
  draft's own `NOT_SWEPT` layers through the new `PaFixReport.unsweptGaps()`, maps them to the tools
  that would close them, and — when the audit trail shows no call has reached any of them — refuses
  the terminal action **once**, renders an interrogation into the next prompt, and loops again.

  Three properties make this different from #88's refuted pressure experiment. **The hold is
  discharged only by a row in the audit trail**, never by writing better, so a stop priced in text
  cannot be paid in text. **Release is sticky** — the gap set recorded at the first hold is the only
  one that can release it, so the gate buys exactly one forced beat rather than moving the goalposts
  every turn. **The interrogation names layers, never tools**: the layer names are the model's own
  `NOT_SWEPT` reasons echoed back, with any registered tool name scrubbed to `[tool]` (a unit test,
  not a promise), which is what keeps §H8's acceptance test from becoming vacuous.

  `UNAVAILABLE` is deliberately never a gap, so #78's honest "nothing ever ran" exit stays open.

- **`PaFixReport.unsweptGaps(report)`** — a pure read over the same `_layerToolMap()` that #79b uses
  to refute an unsupported `SWEPT` claim, read the other way round: a layer the model marked
  `NOT_SWEPT` is a gap it declared itself, and the map says which tools close it. The loop shares
  the map rather than hand-copying it.

- **`benchmark/raw-evidence-v5-depth-smoke.md`** — the six-run smoke, audit-derived, plus the
  rendered hold prompt captured verbatim from `sys_generative_ai_log` and the six request bodies
  recorded **before** firing (#99 means they are otherwise unrecoverable).

- **`benchmark/DECISION.md` §P** — the verdict.

### Measured

**Six runs on gpinst01, seeds 01/03/04 ×2, unscored by design. Six of eight pre-filed predictions
held; two were refuted, and the refuted one that matters is the headline.**

- **A hold fired on 6 of 6 runs**, each released by a real `agent_config` call verified
  `"success":true` against its own audit row. All six terminated `complete` — **zero `partial`,
  zero `failed`**, so the gate is not a denial-of-service (P4 predicted 1–2 partials and is recorded
  refuted in the favorable direction).
- **Audit-derived sweep moved 1/7 → 4/7 on every run** — the first movement in that number in the
  project's history. Median tool calls 1 → 2, median LLM calls 3 → 4.5.
- **The interrogation reached the model intact**, confirmed against the live prompt rather than
  inferred from source: rendered whole with no digest truncation, and the model's own reasons
  reached it with tool names scrubbed to `[tool]`.
- **P2 — §H8's acceptance test — is REFUTED.** `schema_lookup`, `query_table`, `genai_log` and
  `log_analysis` were invoked in none of the six runs. Those four tools have now never been invoked
  by the custom harness across **51 runs**.
- **The cause was pre-registered as P7 and held exactly:** `_layerToolMap()` gives `agent_config`
  three layers (2, 3, 7) in one call, so the cheapest hold discharge is one `agent_config` call, and
  all six runs took it. Force was sufficient to make the model act and insufficient to make it act
  on the right layer.
- **Constraint 1 is unmoved (P5 held).** Both seed-01 runs bought a second tool call and neither
  spent it on the evidence already in hand: `priority_stored: null` is verbatim in the turn-2 prompt
  of both runs and appears in neither report.
- **No fabrication regression (P6 held):** 0 of 6 unsupported sweep claims, against 1 of 6 on the
  same seeds in v4.
- **Countervailing, recorded because it cuts against the headline:** four of the six runs produced a
  non-empty `root_causes` and a fix, where v4's custom rows on these seeds produced empty
  `root_causes` or a rejected draft. Whether those findings are *correct* is a scored pass's
  question and this smoke does not answer it.

Per the falsification rules filed before the code was written, this is the third case — holds fire,
gaps close, measured tools never reached — so **the mechanism is refuted as specified and the next
iteration works on direction, not force.** Neither revert trigger fired. Native remains the
recommended path on this instance and the Phase 1b milestone is **not** met.

---

## 2026.08.0303 — the scorer blind rule (#100)

The blind rule now binds the channels that reach a **scorer**, not only those
that reach the harness. Four of five seed specs narrated prior passes' outcomes
and grades, and scorer packets embed the spec verbatim, so a blind scorer could
see what a comparable run had scored before grading this one (`DECISION.md` §O5
measures the cost at roughly one row on a 10-row pass).

- **Split** — each `benchmark/seeds/seed-0N-*.md` is now wholly scorer-facing;
  four of the five (seed 01 has no prior-pass narrative) have the prior-pass
  narrative in a sibling `benchmark/seeds/history/seed-0N-*.history.md`. The
  history file links to the spec and not the reverse, so copying the spec is
  correct by construction — the v4 pass had to hand-redact 29 files to work
  around the old shape. History files live in their own subdirectory so the
  bare `seed-0N-*.md` glob used elsewhere to name the scorer-facing specs can
  never pick one up.
- **Guard** — `test/scorerPacketBlindRule.test.js`, a sibling to
  `blindRule.test.js`. It cannot reuse that file's per-line matcher: the specs
  hard-wrap, so phrases straddle line breaks (seed 05's *"earning full — not
  partial — fix-target credit"* spans two lines), and every leak sat inside a
  `>` callout. `test/_normalizeProse.js` strips blockquote markers and joins
  wrapped lines while preserving a line map. Measured red state before the
  rewrites: 14 pattern-hits across 13 leak locations in seeds 02–05, zero false
  positives.
- **Guidance survives, and it is pinned** — two real-file controls assert seed
  04's decoy rule and seed 01's `priority_stored` ground truth are still present
  *and* scan clean. That is what separates redacting the leak from lobotomising
  the packet.
- **Seed 01** no longer opens by telling a scorer the seed was never executed
  three lines above a measurement taken from executing it.

No score moves. Custom's Round A rows were never re-scored on clean packets and
still have not been — `DECISION.md` §O7's caveat stands.

## 2026.08.0302 — 2026-08-03

### Added
- **The v4 scored pass — 20 runs, both harnesses, one day, one deployed version; the project's
  first drift measurement (#98).** Five seeds × 2 runs × 2 harnesses, all at app version
  `2026.08.0301` on gpinst01, deploy-verified byte-identical to `main`@`8c909cd` before any evidence
  was recorded. Gate tally: **native (Agent Doctor) 3/10 (42/60 rubric points)**, **custom
  (`x_snc_troubleshoot`) 0/10 (0/60)** — both scored by 10 independent blind agents on redacted
  packets. Native named the correct root-cause layer on 8 of 10 rows; of the 7 that failed the gate,
  5 lost only `fix_usable_unedited` on fixes a human would likely accept as written. Full rows and
  notes: `benchmark/scorecard-agent-doctor.md` and `benchmark/scorecard-custom-harness.md` (v4
  sections); raw artifacts: `benchmark/raw-evidence-v4.md`; design and pre-filed predictions:
  `docs/superpowers/specs/2026-08-03-v4-scored-pass-design.md`; full verdict:
  `benchmark/DECISION.md` §O.

  **Drift, measured with the scorer-vs-model confound controlled — suggestive, not an established
  regression.** The eight of ten standing 2026-08-02 native rows that could still produce a full Fix
  Report (two have no report to re-score — a structural absence, verified) were blind re-scored on
  the same redacted-packet method as v4, to avoid mixing operator-vs-blind scorer drift with
  model drift: **standing rows, blind re-scored: 4/8 (50%)** vs. **v4 native, same method: 3/10
  (30%)**. Operator and blind scorer agreed on `passes_gate` for 7 of the 8 re-scored rows, so the
  scorer population is not systematically harsher. Three claims, each stated at the strength it
  supports: (1) **established** — native no longer reproduces its standing 8/10 on this instance;
  (2) **established** — part of the apparent gap is not model behavior (scorer population, ~1 row of
  8; two unrecoverable rows the operator had passed); (3) **suggested, not established** — a residual
  behavioral decline of roughly 20 points, real in direction, at n=8 vs. n=10, well inside the range
  a handful of rows could produce. It qualifies every cross-day comparison in `DECISION.md` §G–§N as
  a caveat; it overturns none of them, and model drift is now measured at exactly two points, which
  bounds nothing about shape or rate.

  **Depth is unchanged and now measured 45 runs deep.** Custom swept `1/7 (L1)` on all 20 rows of
  this pass — every seed, every repetition; native ranged `1/7` to `6/7`. §H8's acceptance test (one
  custom run reaching `schema_lookup`, `query_table`, or `genai_log` on the seed that needs it) is
  still UNMET, now across 45 runs, with four of seven tools never invoked by the custom harness in
  any run.

  **Instrument findings, worth more to the next revision of the benchmark's own scoring method than
  the scores themselves.** Scorer packets leaked prior passes' scored outcomes, including literal
  grades, into four seed specs — filed as **#100**; holding scorer topology fixed, redacting the leak
  moved the result by about one row (suggestive, n=1) on the same indeterminate
  `fix_usable_unedited` column, in a direction that argues against an anchoring explanation. Holding
  packets fixed and changing only scorer topology (one agent scoring ten rows sequentially vs. ten
  independent agents on identical packets) moved the result by about two rows (suggestive, n=2) on
  the same column — a property of the scoring instrument, not of either harness, larger than the
  leak effect. A rubric-reproducibility gap was also found: identical unfilled-placeholder fix text
  was scored `fix_usable_unedited = 1` on one row and `= 0` on another by the same blind pass, both
  within the standing re-score and within v4's native round.

  **No product code changed in this pass.** `src/server/` and
  `docs/agent/agent-doctor-instructions.md` were held byte-identical throughout, by design: native's
  ten rows are only a valid drift control if native's inputs are identical to what produced the
  standing baseline. Every available code edit was deliberately deferred so the native delta could
  not become drift-plus-edit, unattributable.

  Also filed: **#99** — the harness never persists the inbound request payload, so a run's own
  diagnostic subject is unrecoverable after the fact for every seed and both harnesses.

### Changed
- **`benchmark/README.md`'s Phase 1b native re-run addendum superseded — all 10 native rows re-run,
  not just seed 2's 2 (Task 14, #98).** The prior addendum re-ran only seed 2, reasoning that
  re-running the other four seeds would measure model drift rather than the harness. That left
  four-fifths of the native/custom comparison cross-day, and the drift it declined to measure is
  exactly what this pass needed to name directly. `benchmark/README.md` keeps the original addendum
  in place with a superseded banner — it was correct when written — followed by "The addendum,
  amended," recording both grounds for the reversal and what re-running the standing eight actually
  cost (blind re-scoring, two unrecoverable rows, the agreement check above).

## 2026.08.0301 — 2026-08-03

### Fixed
- **The audit trail already recorded the tool arguments, so four exposure grades were inferred
  where they could be measured (#96).** `DECISION.md` §M3 graded #89's `PaToolAgentConfig` leak as
  reaching *"1 row established + 7 inferred"* and §M4 cited *"8 of the 12 native rows"*, both on the
  stated premise that no artifact records which `section` a run asked for. Both harnesses have
  recorded it since Task 9 — `PaToolRegistry.js:284` and `PaScriptToolAdapter.js:127` each call
  `logIntent({..., input: args})` before the tool runs — and gpinst01 holds 22 `agent_config` intent
  rows covering every scored run.

  Measured from the trail, reading both the recorded argument and the `sections_returned` the tool
  actually rendered: **7 of the 12 native rows, every one established.** The inferred/established
  split described a limitation that did not exist. Custom-harness exposure is **zero**, as §M3
  concluded, now measured rather than reasoned — and measured for a call shape §M3 never considered
  (`{"execution":…}` with no `section`, which its reasoning would have graded as exposed).

- **The smoke gate was never contaminated — §M3's strongest claim, refuted by its own trail (#96).**
  §M3 held that the gate *"has been passing under those conditions"*. The gate run's single
  `agent_config` call passed an identifier matching no `sn_aia_agent` or `sn_aia_usecase` row and
  returned `sections_returned: []`, so no section rendered and the note never shipped. The gate
  reached its expected answer from the trace, without instruction text at all. The harness finding
  underneath it is the more useful half: the gate's only layer-2/3/7 probe swept nothing, and
  nothing outside the audit trail recorded that.

- **Leak 1's exposure closes at zero (#96).** §M3 could not bound `PaToolGenAiLog`'s
  `capability_unresolvable` text and declined to guess. It fires only in `check_config` mode; the
  corpus holds exactly two such calls (seed 04 runs 1–2) and both recorded `"findings":0` — a count
  the payload digest preserves in its tail, so the absence is read rather than inferred from a
  missing string.

- **One filled scorecard cell was contradicted by the trail (#96).** Seed 03 run 2 was credited
  `layers_swept 5/7 (L1,L2,L3,L5,L6)`, but its only `agent_config` call passed `section:"tools"` and
  received `["tools"]` — the instructions section never rendered, so L2 was not swept. Corrected to
  `4/7 (L1,L3,L5,L6)`. **No gate movement:** `passes_gate` consumes `root_cause_layer_correct` and
  `fix_usable_unedited` only, and eleven of the twelve native rows reconciled unchanged.

### Added
- **`PaAuditLogger.toolCalls(runId)` — the read side, with arguments (#96).** Every audit row for a
  run in creation order, undeduplicated, as `{tool, action, payload, created}`; `payload` is `input`
  on an intent row and `output` on a result or error row, mirroring the write path. `invokedTools`
  is untouched and still answers #79's narrower deduplicated question. Two limits are documented on
  the method because a consumer that forgets them draws a false conclusion: payloads are digested
  head+tail, so **a hit is evidence and a miss is not**, and intent rows **do not pair** with result
  rows — the table carries no call id and timestamps are second-granularity.

### Changed
- **`scorecard-agent-doctor.md` §E2 derives `agent_config`'s layer credit from the call, not the
  claim (#96).** Necessary condition, measured: a layer whose section the call did not return
  cannot be credited (`instructions` → L2, `tools` → L3, `triggers` → L7, read from
  `sections_returned`). Sufficient condition, still judged: receiving a section is not using it. The
  trail can refute a credit and cannot confer one. §E1 now collects `input`/`output` alongside
  `tool_name` and names `toolCalls` as the code path.
- **The #89 scorecard annotations name the affected rows** instead of describing an inference, on
  both `scorecard-agent-doctor.md` and `scorecard-custom-harness.md`. §M3/§M4 are kept as filed with
  superseded-by-§N banners — what #89 concluded on the day is part of the record.

---

## 2026.08.0227 — 2026-08-02

### Fixed
- **The blind rule bound instructions only, so tool output could carry the answer (#89).**
  `benchmark/README.md`'s rule — the condition that makes every score in this repo mean
  anything — bound the text that becomes Agent Doctor's *instructions*. It did not bind tool
  descriptions or tool output, and tool output is the more direct channel: it lands in the
  reasoning loop at the moment of diagnosis rather than in a preamble read once at the start.

  The leak that proved it: until `2026.08.0222`, `PaToolAgentConfig` emitted *"an auto-populated
  body on this instance threw at line 42"* inside a finding — the smoke gate's own expected
  answer — on any agent with a populated `context_processing_script`. It never fired on the
  custom harness: `agent_config` went uninvoked in v3 (0/10), Task 10 (0/10) and the v4 smoke
  (0/4), and the two v2 runs that did reach it (runs 9 and 10) both asked for
  `section:"triggers"`, which returns no instructions. The leak was harmless only because the
  harness was too shallow to reach it, and would have activated at exactly the moment the depth
  work succeeded. PR #87 removed that instance while
  sweeping for *statistics* (#85); it never swept for *answers*.

  The rule now binds all three channels — instructions, tool descriptions, tool output.

- **Two more answer leaks in tool output, found by applying the broadened rule (#89).** Neither
  was a repeat of the #87 instance, and neither was in a file the earlier sweep had reason to
  re-open.

  `src/server/tools/PaToolGenAiLog.js` — the `capability_unresolvable` finding's `next_step`
  called its own signature *"the FALLBACK signature rather than the primary provider-mapping
  one"*. That two-member taxonomy exists only in seed 04's spec, and naming one member tells a
  model by elimination that the other is a provider-mapping failure, which is seed 04's answer.
  Replaced with a contrast between two checks the tool performs on the record in front of it
  (`capability_unresolvable` vs `api_dangling`) — observable and instance-general.

  `src/server/tools/PaToolAgentConfig.js` — the `note` on every `section=instructions` call read
  *"the known failure specimen on this instance threw in the AGENT copy"*, and its sibling
  `detail` restated `README.md`'s reason for choosing that specimen (*"state=Completed with an
  empty state_reason"*) near-verbatim. Together they handed a model the smoke gate's answer minus
  only "line 42". Both clauses removed; the R-7/R-16 guidance they sat in survives intact.

  Exposure, narrowed rather than assumed: no custom-harness run ever received either, and no
  scored seed's answer was leaked to any run. The `PaToolAgentConfig` note *did* ship on native
  runs that pulled the instructions section, and what it named was the smoke gate — a pass/fail
  gate, not one of the ten scored rows. `benchmark/scorecard-agent-doctor.md` is annotated
  accordingly, restating no row. Full analysis in `benchmark/DECISION.md` §M3–§M4.

### Added
- **`test/blindRule.test.js` — the mechanical half for answers.** Each seed spec and the README
  smoke gate declares its own tokens in a fenced ` ```blind-rule-tokens ` block; the guard fails
  the build when one reaches a model-facing string across 16 targets — the seven tool cores,
  `PaToolReadKit`, `PaToolRegistry`, `PaArtifactStore`, `PaFixReport`, `PaAgentLoop`,
  `PaLlmProxy`, `PaScriptToolAdapter`, `src/fluent/agent-doctor.now.ts` and the instructions doc.
  A new seed is picked up automatically and fails until its tokens are declared. The roster size
  is pinned, because a deleted target silently stops generating its assertion while the suite
  stays green.

  A token names **the answer, not the vocabulary of the question**.
  `sn_aia_trigger_configuration` is seed 05's answer *and* a table `agent_config` must query to
  sweep layer 7; `context_processing_script` is the smoke gate's answer *and* a field that same
  tool must read. Neither is declared — a token that fires on honest tool code is a bad token,
  not a finding. There is deliberately no stop-list: a too-generic token reddens the suite, and
  that failure is the signal to pick a better one.

  Paired with `test/referenceStatistics.test.js` (#85, statistics), which now shares its comment
  stripper via `test/_stripComments.js` so the two guards cannot drift.

  **The guard found neither of the two leaks above.** Its first full run reported every target
  passing; its later changes were repairs to its own token list and roster, driven by manual
  review. One leak was caught by a hand sweep and one by an independent reviewer reading the same
  function the hand sweep had already walked past — and the first of them was *framing* rather
  than a value, which no token could have matched. The guard's value is prospective: it pins both
  leaks closed permanently and covers all 16 targets automatically from here, so the next leak of
  a declared value fails a build instead of waiting for someone to notice.

## 2026.08.0226 — 2026-08-03

### Fixed
- **The contract had no UNCONFIRMED exemption, so a correct trace-only diagnosis was unreportable
  (#93).** `docs/agent/agent-doctor-instructions.md:48` promises the model an escape from the
  evidence rule — *"name the candidate root cause, name the layer that would confirm it, and mark it
  UNCONFIRMED"* — that `PaFixReport._checkEvidenceRule` never honoured. Its only passing routes were
  (A) trace plus one of config/schema/data, and (B) the #78 absence path. Neither admitted a
  trace-only cause under any confidence marker, so a model that correctly diagnosed a seed *from the
  trace alone* was structurally forbidden from saying so. `DECISION.md` §K2 is the failing case:
  the first correct seeded diagnosis this harness ever produced — seed 03's `rules_in_table: 0`,
  which **is** a tool-call response digest and therefore trace evidence by construction — was
  rejected for citing only the trace, and the run ended `failed`.

  Added as **path (C)**, checked after A and B so it can only widen; nothing that validated before
  can newly fail. A trace-only root cause now validates when it is marked `UNCONFIRMED`, names the
  layer that would confirm it in a new `would_confirm` field, that layer is **not** marked `SWEPT`
  in `layers_swept`, and the cause cites at least one piece of evidence per layer it claims to have
  swept — `_checkInconclusive`'s pricing, reused per §K4's *"priced like the inconclusive path"*.

  The sweep cross-check is the fabrication guard: a sweep claim and a still-needed claim about the
  same layer contradict each other, and #88 established that this model, pressed to produce more,
  produces claims rather than tool calls. The digit scan behind it requires the word "layer"
  (`/\blayers?\s*([1-7])\b/`) rather than scanning bare digits, because `sn_aia_agent_tool_m2m`
  contains a 2 and a false positive there would invent a contradiction that rejects an honest report.

### Notes
- **Every path-C rejection is repairable without tools** — a missing marker, an unparseable
  `would_confirm`, a contradictory sweep claim, an under-cited sweep list. That is the property #81
  lacks: the single repair turn has no tool access, so a citation-shortfall rejection is unfixable
  by construction. This path is not.
- **Custom-harness only, deliberately.** `PaFixReport` is reached from `PaAgentLoop` and
  `PaRestHandlers` and nowhere else; the native harness's entry point is `PaScriptToolAdapter`.
  `docs/agent/agent-doctor-instructions.md` is **not** edited — it already promises the behaviour in
  prose — so native's instructions stay byte-identical and §J5's "re-measure native in the same
  pass" constraint does not apply. Same containment reasoning as §K5.
- **This produces no depth.** §K4 remedy (2) — making the model take the second step — remains the
  open half, and #82 / §H8's acceptance test is untouched by this change.
- The model learns the field from `PaFixReport.schemaText()` only, which `repairPrompt` embeds and
  `PaAgentLoop._schemaText` reads — the single-sourcing established in #64/#65.

---

## 2026.08.0225 — 2026-08-03

### Fixed
- **Blind head/tail truncation was eliding exactly the diagnostic evidence (#91).**
  `PaArtifactStore._truncate` sliced by character offset with no idea what it was cutting. On a real
  `agent_trace` result that retained `resolution`, `reads`, `notes`, `header` and `evidence_basis` —
  every one of them saying *"state completed, every read ok"* — and elided 16,969 of 18,969 chars in
  the middle, where `tool_calls`, `script_errors` and the failure signatures live. **The excerpt kept
  the reassuring sections and dropped the diagnostic ones**, reading as a clean bill of health for a
  run that had failed. Tools now declare an `excerptPriority` in `PaToolRegistry`; the store fills the
  budget in that order, keeps sections **whole** so the excerpt is parseable JSON rather than a
  chopped string, and **names every section it omitted**. Same ~2,000-char retained budget — the
  envelope is spent better, not grown.

### Measured
- **The evidence now reaches the model, and on seed 03 it finds the answer (TR1000112).** The excerpt
  led with `script_errors`, `header`, `tool_calls`, and the report stated
  *"the tool call to `lookup_routing_rule` returned 0 rules found for the 'Hardware' category"*,
  citing `rules_in_table: 0` — **the seeded answer, cited for the first time in any custom-harness
  run.** Previously that digest was in the elided middle and every run reported "no failure detected".
- **It was then rejected, and the rejection is the line-48 contradiction (§I4 confound 2).** Both
  citations were `source: trace`, so the evidence rule refused it and the run ended `failed`. The
  playbook's own escape — *"name the candidate root cause … and mark it UNCONFIRMED"* — does not
  exist in the contract, which requires trace PLUS one of config/schema/data on **every** root cause.
  The model had genuinely diagnosed the seed from the trace alone and could not express it.
- **Seed 01 is unchanged (TR1000113): `complete`, inconclusive, no root cause.** Its defect — a
  priority word silently dropped into an Integer column while `gr.update()` reports success — is not
  visible in a trace by construction, and still needs `schema_lookup` or `query_table`. Still 1 tool
  call.

### Not established by this version
- **That this moves the score.** Seed 03's report was rejected; seed 01's was empty. Depth is
  unchanged at 1 tool call on both. `0216` paged 10/10 and still scored 0/10 — paging and visibility
  are necessary, not proven sufficient.
- **Anything about native.** `PaScriptToolAdapter` deliberately does NOT pass a priority: it is the
  native harness's tool entry point, and moving both harnesses at once is the confound (§I4 item 3)
  that made three passes hard to read. Propagate after the custom-harness measurement.

## 2026.08.0223 — 2026-08-03

### Measured
- **v4 smoke on `2026.08.0222` — #85 answered, and it was not the cause of the depth collapse.**
  Four runs, seeds 01 and 03, chosen because all four of their v3 rows are named in #85 as having
  built their diagnosis on the illustrative note. Audit-derived from `x_snc_troubleshoot_audit`:
  8 rows, one `intent` + one `result` per run, **all `agent_trace`**. Mean tool calls per run
  **1.0 — identical to v3.** Zero runs reached a second layer. `benchmark/raw-evidence-v4-smoke.md`;
  reading in `benchmark/DECISION.md` §J. **Not a scored pass** — no native control, no blind
  scoring, no rubric.
- **The #85 fix works, and its effect is orthogonal to depth.** Runs building a root cause on the
  note: 4/4 in v3 → **0/4**. `root_causes` emitted: ≥1 each (all seed-irrelevant) → **0**. Terminal
  status: 3 `failed`, 1 `complete` → **4 `complete`**. Removing the false root cause converted
  validator rejections into accepted honest inconclusives *without adding a single tool call*.
- **The depth mechanism is now visible, and it is the loop, not the tool output (#88).** The model
  names the tools it did not call as its reason for not sweeping those layers — TR1000107 names
  `agent_config`, `schema_lookup` and `genai_log` — and then files a report the loop stamps
  `fix_report validated`. Budget was untouched: 2 LLM turns of 15, 10–17 seconds of 300.
  `PaFixReport._checkInconclusive` prices the inconclusive path per layer claimed `SWEPT`, which
  defeats sweep inflation but **rises monotonically with no floor**, so its minimum is one sweep and
  two citations. Honest surrender is now the cheapest structurally valid output, and the loop accepts
  a report the benchmark scores 0.
- **A blind-rule leak, found while verifying the above (#89).** Until `2026.08.0222`,
  `PaToolAgentConfig` emitted *"an auto-populated body on this instance threw at line 42"* — the
  smoke gate's expected answer (`context_processing_script` line 42, confirmed live in
  `sn_aia_message`) — inside a finding, mid-reasoning. Removed by PR #87 as part of the #85 sweep
  and now guarded by `test/referenceStatistics.test.js`. It had never fired because no run has ever
  invoked `agent_config`: **the leak was harmless only because the harness was too shallow to reach
  it**, and would have activated at exactly the moment the depth work succeeded.

### Fixed
- **`raw-evidence-v3.md`'s read-consistency advice was unsafe and is corrected in
  `raw-evidence-v4-smoke.md`.** v3 recorded that single-record table reads went stale and said to
  trust `GET /runs/{id}`. This pass saw the inverse: `GET /runs/{id}` reported `queued` for over four
  minutes after TR1000108 had finished, while a range query read `complete`. Both paths go stale and
  the direction varies — poll both, or derive from `x_snc_troubleshoot_audit`, which was consistent
  throughout.

### Not established by this version
- **Anything about seeds 02, 04 and 05**, which were not run; **anything about native**, not
  re-measured (§I4 confound 3 still open); **that #88's floor will improve depth** — it forces more
  tool calls, and whether they land on the right layer is what a scored pass would measure; and
  **that model drift is not doing the work** — four runs, one day, unbounded as ever.

## 2026.08.0222 — 2026-08-02

### Fixed
- **`agent_trace`'s own explanatory note was being diagnosed as a defect (issue #85).** Every
  payload carried *"Execution tasks are NOT 1:1 with tool calls (27 tasks / 19 calls in a measured
  run)"*. The 27 and the 19 described an illustrative run measured once during the build, not the
  run under diagnosis. In the v3 scored pass **six of ten scored runs plus the smoke run** read them
  as findings about the run they were looking at, elevated the supposed discrepancy to a CONFIRMED
  layer-1 root cause, and stopped; one proposed, as its fix, *"add note clarifying task_stats vs
  tool_call_stats measurement differences"* — the note it had itself misread. Seed 03's real answer
  (`matched:false`, `rules_in_table:0`) was sitting in the same payload those runs were reading.
  The note now carries **this run's own counts**, taken from the same reads that fill `task_stats`
  and `tool_call_stats`, so a reader who treats them as run data is correct. The guidance also
  moved into the `agent_trace` tool description, where it is read once at tool-selection time
  rather than re-read on every call.
- **Five more reference statistics in sibling tools, found by the audit that followed.** Each stated
  a count measured on the reference instance while sitting in a payload beside the real counts for
  the thing being diagnosed: `agent_config`'s trigger `traversal_note` (`38 of 40 rows (95%)`, next
  to this agent's `branches`), its access `caveat` (`638 of 703 rows (91%)`, next to this agent's
  `role_rows`), its `context_processing_script_populated` finding (**`threw at line 42`** — a
  remembered stack line inside a finding whose `next_step` points at `agent_trace`'s `script_errors`,
  which carry a genuine `line`), and `genai_log`'s `connection_note` (`318 of 2026`) and
  `mandatory_binding_empty` finding (`exactly 1 of 2026 rows`, inside a high-severity finding about
  a specific row). The line number is gone; the counts stay and are now prefixed with the new
  `PaToolReadKit.REFERENCE_STAT` label, because **DESIGN.md R-22 item 4 requires the denominator to
  travel with every stated count** — deleting them was not an option, labelling them was. Two of the
  six sites already said "measured over the whole table on gpinst01" and were misread anyway, so the
  label names what the number is *not* about rather than only where it came from.

- **The rewritten note asserted a count on a DENIED read** (caught reviewing the fix above). Both
  totals are `rows.length`, and a cross-scope denial leaves that array as empty as a genuinely empty
  run does — so a denied trace reported *"This run recorded 0 execution task(s) and 0 tool call(s)"*,
  contradicting `evidence_basis` in the same payload (*"a zero with DENIED is a permission gap and
  says nothing about the run"*) and violating R-19b. The same defect class the fix above exists to
  remove, in its worse shape: a fabricated **zero** reads as *"the agent called no tools"*, which is
  a confident wrong diagnosis rather than a harmless one. Each side is now decided independently
  against its own `read_status`, and a denial is stated as an unknown with the gap named.

### Added
- `test/referenceStatistics.test.js` — a source-scan tripwire over all seven tool cores plus the
  read kit. It fails the build if a hard-coded statistic (`X of Y`, a literal percentage, a
  remembered stack line) reaches a payload without `REFERENCE_STAT`. A source scan rather than an
  output assertion because the risk is a *future* hard-coded number, in a note nobody thought to
  test. Payload text is asserted in the three per-tool test files.

### Not established by this version
- **That this fixes the depth collapse (#82).** The note is a plausible contributor — a run that
  believes it found a confirmed layer-1 defect in its first tool result has no reason to open a
  second layer — but six of ten runs misreading it is a correlation, not a demonstrated cause, and
  §I4's four confounds (three different contracts, the `agent-doctor-instructions.md:48`
  contradiction, an unre-measured native baseline, unbounded model drift) are all untouched. §H8's
  acceptance test is unchanged and still unmet.
- **Anything live.** This version is build-verified only (SDK 4.9.2, clean) with 844 unit tests
  passing. No install to gpinst01 and no smoke run were performed.

## 2026.08.0221 — 2026-08-02

### Measured
- **v3 scored benchmark pass on `2026.08.0220` — 0/10, and #82 answered: runs got shallower
  (issue #82).** Ten scored rows, five seeds, doubled runs, custom harness only, targets and rubric
  identical to the v2 pass. **Every one of the ten runs invoked exactly one tool — `agent_trace` —
  and stopped.** Mean tool calls per run across the three passes: 2.0 (0216) → 1.4 (0218) → **1.0
  (0220)**; runs reaching `agent_config`: 0 → 2 → **0**; runs reaching `read_artifact`: 10 → 3 →
  **0**. The n=2 smoke observation that prompted #82 holds at n=10 across all five seeds. Gate
  **0/10**, rubric **4/60**. Budget was never the constraint — 3 LLM turns and 8 seconds against
  bounds of 15 and 300s. Full rows: `benchmark/scorecard-custom-harness.md` § v3; raw evidence:
  `benchmark/raw-evidence-v3.md`; reading: `benchmark/DECISION.md` §I.
- **The #78/#79 branch works as designed, and the trade is now visible.** No run over-claimed a
  sweep (v2 had a run claiming all seven layers SWEPT on two reads of one trace); 7 of 10 rows carry
  zero fabrications; and all 3 runs that still invented `config` citations were **rejected**, each
  told the actual tool roster. Under the pre-#79 validator all three would have passed on their
  source labels. But the emphasis converted over-claiming into **claim-avoidance rather than
  evidence-gathering**: five runs took the inconclusive path, so **every report that passed
  validation in this pass names no root cause, no fix target and no appliable change**. Across ten
  runs the harness delivered zero actionable diagnoses.
- **#81 now has a measured instance, not just a structural argument.** Seed 05 run 1
  (`ee3a71dc2baecfd417a6ffbeee91bfe5`) named layer **7** — the expected layer — with a scrupulously
  honest sweep report, and was rejected for citing zero distinct non-trace sources it had no
  remaining way to gather. Its own proposed fix reads `current: "Unknown (requires agent_config
  inspection)"`. The rows favour #81's option 2 (route citation-shortfall rejections back into the
  main loop, which had 13 of 15 iterations unspent) over giving the repair turn tools.

### Added
- `benchmark/raw-evidence-v3.md` — deploy verification, the six seed-fixture precondition reads, the
  post-install sanity run, the ten run ids, and the audit-derived tool roster.

### Fixed
- Nothing in the product app. **This version is a measurement and its write-up**; no `src/` change.

### Notes
- **The instance was running the wrong version when the pass opened.** `sys_app.version` read
  `2026.08.0219` despite `main` being at `2026.08.0220`; the pass began with a clean build + install
  and re-verified both the version field and two content markers in the deployed code.
  **`sys_updated_on` on `sys_script_include` is not bumped by an SDK install** and must not be used
  to tell what is deployed — check the version field, then grep the deployed script for a marker.
- **Scoring was blind by delegation.** The operator had read the v2 rows before firing, so the ten
  rows were scored by ten independent agents barred from every scorecard, `DECISION.md`,
  `README.md` and `CHANGELOG.md`. The audit derivation and the highest-scoring row were verified
  directly. This differs from how Task 10 and v2 were scored, and is recorded in the scorecard.
- **New defect found by this pass, filed as #85:** `agent_trace`'s own explanatory note — *"27 tasks
  / 19 calls in a measured run"* — is illustrative text about a different run, and six of ten runs
  plus the smoke run diagnosed it as the defect. One proposed, as its fix, adding the note it had
  misread. Plausible contributor to the one-call-and-stop pattern: a run that thinks it found a
  CONFIRMED layer-1 defect in its first result has no reason to sweep further.
- **Confounds unchanged and still open:** third different contract text across three passes; the
  categorical trace-plus-one rule at `docs/agent/agent-doctor-instructions.md:48` still contradicts
  the amended contract block and was deliberately left unedited; native not re-measured (§H7-4);
  model drift unbounded. This pass establishes that depth fell, not that the contract change caused it.
- **Roadmap:** §H8 items 1 and 2 are done and verified working. Item 3 (depth) is the only one left,
  and it moved backwards. Twenty-three scored runs across three versions have produced **zero** runs
  reaching `schema_lookup`, `query_table` or `genai_log`. Native stays the recommended path; the
  Phase 1b milestone remains **not met**.

---

## 2026.08.0220 — 2026-08-02

### Fixed
- **Fix Report validation checked evidence LABELS, not whether the cited source was ever read
  (issue #79).** `PaFixReport.validate` enforced that each root cause carried legal, diverse
  `source` labels and never verified them, so validation was uncorrelated with evidential honesty.
  Audit-verified against `x_snc_troubleshoot_audit`: runs `100c8910…` and `ebdc4194…` both cited
  `agent_config` and PASSED having never invoked it, while `a66d0118…`, citing only what it
  genuinely read, FAILED. Citations and `layers_swept: SWEPT` claims are now cross-checked against
  the tools the run actually invoked, resolved by the new `PaAuditLogger.invokedTools` and passed
  **into** `validate` as an optional second argument so it stays a pure function of its inputs.
- **The evidence rule structurally rejected a correct absence-diagnosis (issue #78).** Seed 05 is a
  defect where the agent never runs, so no `sn_aia_execution_plan` row exists and no `trace`
  citation is possible — and the rule had no exemption, so it rejected the harness's one correct
  diagnosis. Layer 1 `UNAVAILABLE` plus **two distinct** non-trace sources is now a second way to
  satisfy the rule. Specified as a widening: the original rule is evaluated and returns first, so
  nothing that previously validated can newly fail. The pre-existing `PaFixReport` suite passing
  entirely untouched is the proof.
- **A rejected draft was invisible over the API (issue #78, side-defect).** `_finishFailedFixReport`
  already stored the draft in `x_snc_troubleshoot_run.fix_report` and the problems in the same row's
  `error`, but `GET /runs/{id}` gated on status and returned `null` for both — so the correct
  diagnosis above had to be read out of the table by hand. Adds a sibling `fix_report_rejected`
  field; `fix_report` keeps meaning "a report that PASSED validation" so no consumer can mistake a
  draft for a diagnosis. No table change.

### Added
- `PaAuditLogger.invokedTools(runId)` — the only reader of `x_snc_troubleshoot_audit` in the
  codebase. Returns a **tagged** result rather than a bare array so that "no tools were called" and
  "the trail is unreadable" stay distinguishable: a degraded trail disables the cross-checks
  entirely (fail open) and the degradation is recorded in the run transcript, because a check that
  silently skipped would leave a passing report's evidential guarantee unfalsifiable.
- `schemaText()` now states all three new rules, with the per-layer tool list generated from
  `_layerToolMap()` at render time so the contract cannot drift from what is enforced.

### Notes
- **`read_artifact` supports no evidence source and no layer.** Artifacts are only created inside
  audited tool dispatches, so `read_artifact` can only page an artifact whose producing tool is
  already in the trail — making a wildcard redundant when a citation is honest and a blanket pass
  when it is not. Under an earlier draft that treated it as a wildcard, the re-run's worst
  fabricated report (all seven layers `SWEPT` on two reads of the same trace) passed both new
  checks.
- **Benchmark confound, recorded before the next measurement rather than after it.**
  `benchmark/DECISION.md` §H7-5: `schemaText()` changed again here, so the 0 → 1 → *n* sequence
  across three passes has three different contracts behind it and must not be read as a trend. The
  categorical trace-plus-one statement at `docs/agent/agent-doctor-instructions.md:48` was
  deliberately left unedited — that file is also the native harness's instruction source, and
  changing it would move the baseline §H7-4 already flags as unmeasured.
- **Does not fix diagnostic depth.** Two live seed-05 runs on this version were still rejected: each
  made one tool call, never reached `agent_config`, and so had zero distinct non-trace sources. Sweep
  inflation did disappear — both marked layers 2–7 `NOT_SWEPT` with reasons naming the tool they had
  not invoked, where the historical run claimed three layers `SWEPT` with empty reasons. Follow-ups:
  #81 (the repair turn has no tool access, so a citation-shortfall rejection is unfixable by
  construction) and #82 (were these runs shallower *because* of the contract change? n=2).

---

## 2026.08.0219 — 2026-08-02

### Fixed
- **Unconditional `String()` on the async worker's event parms defeated the run-id guard** (PR #80
  review). `String(null)` is `"null"` and `String(undefined)` is `"undefined"` — both non-empty — so
  a missing `event.parm1` no longer failed fast with "run id is required" and instead drove the full
  agent loop under the literal run id `"null"`, invoking the LLM while every `appendTranscript` and
  `close` silently no-opped against a non-existent run row. The `parm1` coercion is removed outright
  rather than guarded: `PaAgentLoop._str` already returns `''` for null/undefined *and* correctly
  converts a Rhino Java String, so it was never needed. The `parm2` coercion is load-bearing (it is
  the fix for #77) and is retained, but null-guarded — previously a missing `parm2` became the string
  `"null"`, which `_normRequest` turned into a fabricated `{description: "null"}` instead of `{}`.
- No effect on the `benchmark/DECISION.md` §H measurement: the two forms differ only when `parm1` or
  `parm2` is null/undefined, and all ten scored runs carried real values on both.

### Added
- `test/asyncWiring.test.js` — extracts the `ScriptAction` body from `src/fluent/async-wiring.now.ts`
  and evaluates it against a fake `event` and a recording fake `PaAgentLoop`, pinning the pass-through
  and both null cases. Nothing previously covered this script, which is why the regression above was
  reviewable only by eye.

---

## 2026.08.0218 — 2026-08-02

### Fixed
- **The async worker never received the diagnostic target (issue #77).** `event.parm2` arrives
  from the platform as a Rhino Java String, whose `typeof` is `'object'`, causing
  `PaAgentLoop._normRequest` to mistake it for an already-parsed request object and silently drop
  the target. Every async diagnostic run reasoned with no target, forcing the model to invent a
  placeholder sys_id and fabricate a diagnosis. Fixed by coercing at the source in the
  `ScriptAction` via `String(event.parm2)` (the load-bearing guarantee), plus a defence-in-depth
  foreign-object guard in `_normRequest`. The Jest suite could not catch this defect because it
  passes a real JavaScript string, which the function always handled correctly; new regression tests
  now emulate the Rhino shape. This defect predates the observation-channel work (issue #72) and
  explains the earlier 0/10 benchmark result, so `benchmark/DECISION.md` §G3a's attribution to the
  200-character observation channel is superseded.

---

## 2026.08.0217 — 2026-08-02

### Fixed
- **The 200-character observation channel (#72).** `PaRunManager` now writes a second,
  prompt-facing `prompt_digest` (`PROMPT_DIGEST_CHARS` 8,500 — sized for the JSON-stringified
  dispatch envelope that actually gets digested, not the bare page: escaping expands content up
  to 2.01x, so a 4,000-char ceiling equal to `PaArtifactStore.MAX_PAGE_CHARS` could silently drop
  a page's tail while `next_offset` — which precedes `content` in the envelope — survived,
  leaving the model to page onward believing it had read contiguously) alongside the unchanged
  200-char `result_digest`, pruned on append to the newest `PROMPT_WINDOW` (3) carriers so the
  `transcript` column stays bounded. `PaAgentLoop._renderTranscript` renders it as a block.
  Previously a 4,000-character evidence page reached the next reasoning prompt as ~200 characters —
  the leading identified mechanical cause of the Phase 1b comparison benchmark's 0/10
  (`benchmark/DECISION.md` §G3a).
- **Fabrication pressure in `PaFixReport` (T4).** `root_causes` and `fixes` may now both be empty
  when the report carries an `inconclusive` object citing `evidence_read` and `needed_to_conclude`,
  so an honest "I could not isolate this" is expressible instead of structurally rejected. The
  seven-layer `layers_swept` requirement is unchanged, which is what keeps the path from becoming a
  cheap exit.

### Changed
- `PaFixReport.schemaText()` documents the inconclusive path — reaching both the first-attempt
  contract (via `PaAgentLoop._fixReportContract`) and the repair turn from one source.
- `renderMarkdown` gains a conditional `## INCONCLUSIVE` section.
- The `DEFERRED` note in `async-wiring.now.ts` re-derives the T6 transcript row-size bound
  (~30,000 worst case against the 65,536 ceiling, was ~6,000), now asserted by a test.

---

## 2026.08.0216 — 2026-08-02

Phase 1b final-review fix wave (docs, issues #72-#75): whole-branch review of the merged Phase 1b
harness (7d0ba37..6fa72fc) found `DECISION.md` §G's playbook attribution false — it claimed
playbook v2 was "native-only" and that the two harnesses "have never shared a playbook." Live
MCP verification (read-only, gpinst01) of `sys_generative_ai_log` prompt content for all 10
custom-harness benchmark runs confirmed the opposite: `PaAgentLoop._defaultPlaybook()` reads
`sn_aia_agent.instructions` off the SAME `Agent Doctor` record native uses, and playbook v2's own
text (the "seven-layer sweep" / "Derive table names" / "GenAI stack" sections) was verbatim in
every one of the 10 runs' prompts — not a separate copy, not the 4-line fallback. §G rewritten:
corrected the architecture claim, named the 200-character transcript-digest observation channel
(`PaAgentLoop`/`PaRunManager`) as the leading identified mechanical cause of the measured 0/10
result (measurement and bottom-band verdict unchanged), and replaced the invalid "playbook pass"
next-step with the observation-channel fix + re-run plan (issue #72). Also fixed three stale REST
base-path copies (`rest-api.now.ts`, `async-wiring.now.ts`, `README.md` — real path is
`/api/x_snc_troubleshoot/v1/troubleshooter`, one copy also had the wrong scope) and a
`PaAgentLoop.js` comment wrongly claiming `renderedMarkdown` is read by "every caller" when the
only production caller discards `run()`'s return value. Filed four follow-up issues for code
fixes deliberately out of scope for this docs-only pass: #72 (200-char observation channel +
re-run, bundling ledger T4/T6 and two minors), #73 (`/status` stuck-run check is vacuous — no
custom run ever reaches `status=running`), #74 (REST hardening bundle — authorization breadth,
dropped note, mislabeled message actor, caller-dependent `/status`, two minors), #75
(destructive/unknown-tool refusals never reach the audit trail — `bug`, pre-Phase 3).

## 2026.08.0215 — 2026-08-02

Phase 1b Task 10 (docs, issue #70): the comparison re-run — MCP-executed on gpinst01, closes the
Phase 1b milestone. Re-verified Task 9's flagged preconditions live before scoring: seed 4's
capability sys_id still matched (not void); seed 5's `sn_aia_trigger_agent_usecase_m2m` gate had
been reset to `active=false` by Task 9's fixture reinstall exactly as that task's concerns section
warned — PATCHed back to `true` and re-confirmed. Fired a fresh seed-02 v2 execution (never run
before this task) and used it as the shared diagnostic target for 2 new native rows and 2 of the
10 custom rows; reused seeds 1/3/4's still-valid Task 12 execution records and seed 5's bench
ticket for the remaining 8 custom rows. Scored all 20 rows (10 custom + 2 new native + 8 standing
native) blind, audit-derived, against `scorecard-template.md` §A2/§A3 — written to the new
`benchmark/scorecard-custom-harness.md`. Result: native 8/10 (80.0%, top band — up from Task 12's
70% because seed 2's v2 fix now lets a run reach layer-2 diagnosis at all); custom **0/10 (0.0%,
bottom band)** — audit trail shows all 10 custom runs called only `agent_trace` + one
`read_artifact` page before attempting a fix, several with fabricated "config"/"schema" evidence
citations for tools the audit trail proves were never called. `DECISION.md` §G records the
side-by-side gate table, the confound surface (seed 2 v2 / `check_config` filter / playbook v2 —
the first two shared by both harnesses, playbook v2 native-only by design), and the verdict: native
remains the deep-diagnosis front door; the custom harness's reasoning-loop depth is the gap, not
its infrastructure (10/10 runs reached a terminal state, 0 stuck, 0 void).

## 2026.08.0214 — 2026-08-02

Phase 1b Task 9 (docs, issue TBD): comparison re-run readiness gate — MCP-verified on gpinst01, plus
one Fluent reinstall (the fixture app only, no product-app code changes). Verified all four Task 9
preconditions with live evidence: reinstalled `benchmark/seed-app` to bring seed 2 v2 (bound
`measure_request`, one weak tool) live — it was still v1 (zero tools) on the instance, its PR having
deferred the install; confirmed `check_config` filter + playbook v2 already live on the product app
byte-identical to the repo (both merged before Task 7's own reinstall); re-read both budget knobs
fresh (`continuous_tool_execution_limit=25`, `max_auto_executions=10`, unchanged from Task 12);
re-ran the smoke gate for both harnesses against the known specimen — native passed (correctly cites
`context_processing_script` line 42), custom reached a structurally valid but substantively wrong Fix
Report (reproducing Task 7's own finding, not a new defect). Along the way, run-verified the
`sn_aia_gen_ai_m2m` native LLM-call-count linkage Task 8 had flagged unverified: `source_id` keys to
the run's top-level `sn_aia_execution_task` (`type=agent`, `order=100`), not the execution plan or
the per-turn `type=gen_ai` sub-tasks. `benchmark/README.md` gets the corrected linkage plus a new
"Phase 1b comparison re-run protocol" section: same 5 seeds / doubled runs / blind / audit-derived
scoring, custom harness scored fresh across all 10 rows, native re-runs seed 2 only (its other 8
scored rows stand — re-running an unchanged construction would measure model drift, not the harness).

## 2026.08.0213 — 2026-08-02

Phase 1b Task 8 (docs, issue TBD): assist-unit measurement source (DECISION.md §D5, LLD §8 item 11)
— MCP read-only probe on gpinst01, no server code, no Fluent. Re-confirmed `sn_value_ai_consumption`
still has 0 rows. Found `sys_gen_ai_usage_log` populated and filterable to this app
(`source_scope=x_snc_troubleshoot`, not the always-empty `caller_scope`: 48 rows, 32 `assists=1` /
16 `assists=0`) but with no working per-run join key — `sn_aia_execution_plan.gen_ai_usage_log`
links only to the zero-assist topic row, and `sys_gen_ai_log_metadata.conversation` reads empty for
this call path. Decision: the Phase 1b scorecard uses LLM-call counts as the comparison proxy
(`sn_aia_gen_ai_m2m` for native, the custom harness's own transcript once built), and assist-units
are marked NOT COMPARABLE to entitlement/licensing units. `benchmark/README.md` gets a new
"Measurement source: assist units" section; `docs/LOW_LEVEL_DESIGN.md` §8 gets a new item 11
closing the question.

## 2026.08.0212 — 2026-08-02

Phase 1b Task 7 (issue #64): async wiring + Scripted REST API — the custom harness's first
end-to-end run on gpinst01. `src/server/rest/PaRestHandlers.js` is the new REST business-logic
layer (28 zero-Glide Jest tests): `analyze`/`getRun`/`message`/`status`/`tools`, each a plain
`{body, pathParams, userId} -> {status, body}` function backing `src/fluent/rest-api.now.ts`'s
5 one-line-delegation routes (`POST /analyze`, `GET /runs/{run_id}`, `POST
/runs/{run_id}/message`, `GET /status`, `GET /tools`, all under
`/api/x_snc_troubleshoot/v1/troubleshooter`). `src/fluent/async-wiring.now.ts` adds the
`x_snc_troubleshoot.run.start` event registration, the ScriptAction worker (`new
PaAgentLoop().run(event.parm1, event.parm2)`), and the daily `PaRunManager.sweepStaleNative({})`
sweep. `src/fluent/script-includes.now.ts` gets six new registrations — PaLlmProxy,
PaToolRegistry, PaFixReport, PaRunManager, PaAgentLoop and PaRestHandlers were pure logic +
tests through Task 6; this is where all six first become resolvable on-instance.

Live-verified end-to-end on gpinst01: `mode:"collect"` returns the Evidence Bundle synchronously
and closes the run; `mode:"diagnose"` queues the async worker, which ran the full reason→act→
observe loop against the Task 12 smoke specimen and closed every run cleanly (no run left
`running`); `/status` reports `ready:true` across all six deep checks (plugins, own-skill
existence+activation, capability-provider mapping, a live micro-invocation, section-2 table
readability, stuck-run count) after fixing a live-caught defect of its own — the Now Assist Core
plugin API name in `now-assist-platform.md`'s "Required Plugins" table is wrong for this
instance (`com.now_assist_core`, not `com.snc.now_assist`; confirmed against `v_plugin`). Also
surfaced, and left unmodified per the task's own instruction, two pre-existing defects in
already-merged Task 2/4 components that make the Fix Report path's one-repair-retry
mechanically incapable of succeeding: the playbook's Fix Report section never states the
required JSON's lowercase snake_case keys, and `PaFixReport.repairPrompt`'s wording never asks
for the `{"action":"fix_report",...}` envelope `PaLlmProxy.reason()` strictly requires — see
`.superpowers/sdd/2026-08-02-phase1b-harness/task-7-report.md` for the full reproduction and
root-cause trail.

---

## 2026.08.0211 — 2026-08-02

Phase 1b Task 6 (issue #62): `PaAgentLoop` (`src/server/PaAgentLoop.js`) — the async ReAct worker
that drives every other Phase 1b collaborator. `run(runId, request)` is the Script Action entry
point (Task 7 wires an async platform event to `new PaAgentLoop().run(run_id, request_json)`):
it resolves the playbook and `PaToolRegistry.promptBlock()` once, then loops
reason→act→observe via `PaLlmProxy.reason()`, `PaToolRegistry.dispatch()`, and
`PaRunManager.appendTranscript()`. Bounds (`MAX_ITERATIONS:15`, `BUDGET_MS:300000`) are checked
BEFORE each iteration begins reasoning, never mid-step; hitting either one closes the run
`complete` but returns `outcome:'partial'` with an explicit `INCOMPLETE` transcript flag — the
R-3 lesson that premature completion must never look like a silent, indistinguishable finish.
An `answer` action closes the run `complete`; a `fix_report` action is validated via
`PaFixReport.validate`, gets exactly ONE repair turn through `PaLlmProxy.reason()` when invalid
(`PaFixReport.repairPrompt`), and on a second failure closes `failed` with the problems and the
last draft preserved on the row. An LLM-layer failure (`reason() → {success:false}`) closes the
run `failed` with error text that names both fallbacks — `mode: "collect"` (the LLM-free
Evidence Bundle floor) and `/status` — rather than a bare error string. An unknown-tool
`tool_call` is not a special case: `PaToolRegistry.dispatch`'s own `{success:false, error}` is
digested into the transcript exactly like any other tool observation, so it is fed back on the
NEXT reasoning prompt and the model gets to re-plan instead of crashing the run. The Phase 3
confirmation flow (`awaiting_confirmation`, ADR Decision 0.5) is deliberately left as a comment
inside `_step()`'s `tool_call` branch, not code — Phase 1b's registry fails closed on every tool
not explicitly `destructive:false`, so no `tool_call` this loop can dispatch is capable of
reaching a confirmation gate yet; a source-level test guards that the string never appears
outside a comment. Every collaborator (`llmProxy`, `toolRegistry`, `runManager`, `fixReport`,
the `now()` clock seam, the `playbook` text) is constructor-injected; the Rhino defaults are
`new GlideDateTime().getNumericValue()` for the clock and a best-effort read of the installed
`sn_aia_agent.instructions` row for the playbook (never a third hand-typed copy of the markdown
playbook — see `test/agentDoctorInstructions.test.js`'s existing byte-for-byte guard on the
Fluent copy), both degrading cleanly rather than throwing. 12 tests in
`test/PaAgentLoop.test.js`, zero Glide.

## 2026.08.0210 — 2026-08-02

Phase 1b Task 5 (issue #60): `PaRunManager` (`src/server/PaRunManager.js`) — the custom harness's
run lifecycle over `x_snc_troubleshoot_run`, including the DECISION.md §D5 close-out. `createRun`
calls `PaRunAnchor.getOrCreate` with `harness:'custom'` and a freshly manufactured single-use
`conversationId` (so two `createRun` calls diagnosing the same execution plan never converge on
one row), then force-writes `status:'queued'` — the anchor only ever inserts `running` (DESIGN.md
R-20's requirement for the harness it was built for). `appendTranscript(runId, entry)` normalizes
and digests entries (200-char ceiling, matching `PaToolReadKit.DIGEST_CHARS`) and writes after
every call. `loadContext`/`maybeSummarize` implement the 11-entry summarization threshold: past
10 transcript entries, the oldest are compressed via `PaLlmProxy.summarize` into
`context_summary`, the newest 5 stay verbatim, every summarized entry's `artifact_id` is embedded
verbatim in the summarize prompt (ADR Layer 6), and a `summarize` failure leaves the transcript
untouched without failing the run (summarization is an optimization, not a correctness
requirement). `close(runId, status, {fixReport?, error?})` guards the only legal transitions
(`queued|running → complete|failed`) and returns `{success:false}` naming the transition on
anything else — never throws; `awaiting_confirmation` is excluded by construction, matching the
brief's "never expires and is not closeable by the sweep." `collectBundle(runId)` is the LLM-free
Evidence Bundle: dispatches the five layer-bearing tool cores through `PaToolRegistry` (no
`PaLlmProxy` anywhere in the call path — verified structurally by constructing `PaRunManager`
with no `llmProxy` at all), fans `agent_config`'s one call across layers 2/3/7, and passes a
DENIED per-table read status straight through to the layer's own `status` (R-11) rather than
collapsing it into a generic failure. `sweepStaleNative({maxAgeHours})` closes NATIVE runs only,
older than the threshold (default 24h) AND with no `x_snc_troubleshoot_audit` row inside that same
window, appending the exact R-20 citation
(`stale-closed by lifecycle sweep; completeness remains audit-derived (R-20)`) before closing via
the same guarded `close()` path everything else uses. `test/_glideStub.js`'s writable-world
`GlideRecord` fake gains an `update()` method (merges pending `setValue`s into the found row,
with `failUpdate`/`throwOnUpdate` R-1 test hooks) — the first component in this app that updates
rather than only inserting. ES5/Rhino, `Class.create()` + `.prototype`. 61 new Jest tests, full
suite 664/664 green.

---

## 2026.08.0209 — 2026-08-02

Phase 1b Task 4 (issue #58): `PaFixReport` (`src/server/PaFixReport.js`) — the structural floor
under the Fix Report JSON the LLM produces at the end of a diagnosis run. `validate(report)`
checks `failure_summary` (non-empty string), `layers_swept` (all seven playbook layers, each
SWEPT/NOT_SWEPT/UNAVAILABLE, with a `reason` required for the latter two), `root_causes[]`
(`layer`, `component`, `finding`, and an `evidence[]` array enforcing the ADR Layer 3 evidence
rule structurally — at least one `trace` citation PLUS at least one `config`/`schema`/`data`
citation, every violation naming the cause and the phrase "evidence rule"), `fixes[]`
(`target_type` from the playbook's five-value enum, `target`/`proposed`/`rationale` non-empty,
`current` may be an empty string but must be present), `verification` (non-empty string), and
`data_markers[]` (must be present, may be empty). Validation is a floor not a ceiling — unknown
extra keys survive `normalized` untouched. `repairPrompt(report, problems)` builds the one
allowed repair turn: problems verbatim + the schema description + "Return the corrected
fix_report JSON only." `renderMarkdown(normalized)` mirrors
`docs/agent/agent-doctor-instructions.md`'s six report section headings in playbook order
(FAILURE SUMMARY, LAYERS SWEPT, ROOT CAUSES, FIXES, VERIFICATION, DATA MARKERS); `renderJson`
round-trips the same object. Pure ES5 object-walking, no Glide (R-9: null/undefined/non-object
input is an invalid report, never a throw). 38 new Jest tests, full suite 603/603 green.

---

## 2026.08.0208 — 2026-08-02

Phase 1b Task 3 (issue #56): `PaToolRegistry` (`src/server/PaToolRegistry.js`) — the custom
harness's dispatch layer over the seven unchanged Phase 1a tool cores plus `read_artifact`.
`list()` returns `[{name, layer, description, readOnly:true}]`; `dispatch(name, args, runCtx)`
resolves the core, audit-logs intent/result/error via `PaAuditLogger`, applies
`PaArtifactStore.applyThreshold` with `runCtx.run_id` (skipped for the `PAGED_OUTPUT`
`read_artifact` core, mirroring `PaScriptToolAdapter`'s 4000/4000 collision guard), and refuses
unknown names with the roster listed in the error. `promptBlock()` generates the reasoning
prompt's tools section purely from `list()` metadata — no hand-written second copy — and its
seven descriptions are the same text `src/fluent/agent-doctor.now.ts` ships, verified by test.
The destructive gate refuses any registration or call marked `destructive:true`, citing "the
confirmation flow is Phase 3", so Phase 3 adds a flow rather than discovering a bypass. Roster
name-set equality with `PaScriptToolAdapter`'s registry keys (R-20's derived-completeness
dependency) is enforced by reading both files as text, mirroring
`test/agentDoctorInstructions.test.js`'s fluent/adapter technique. 17 new Jest tests, full suite
563/563 green.

---

## 2026.08.0207 — 2026-08-02

Phase 1b Task 2 (issue #54): `PaLlmProxy` (`src/server/PaLlmProxy.js`) — the sole NASK
touchpoint for the custom harness. `reason(prompt)` enforces the strict-JSON contract
(`tool_call` / `answer` / `fix_report`) with exactly one retry on a parse failure, re-prompting
with the parse reason plus "JSON only"; `summarize(prompt)` is a plain-text passthrough with no
JSON contract and no retry. `_parseResponse` is pure string logic (trim, strip a single markdown
fence, locate the outermost `{...}`, validate per-action required fields) — no Glide, testable
without an instance. `_invokeNask` is the ONLY method in the codebase that knows NASK exists,
wired to Task 1's verified call shape (LLD §4.8):
`sn_one_extend.OneExtendUtil.executeSecure({executionRequests:[{capabilityId, payload, meta:
{skillConfigId}}]})`, unwrapping the double-JSON response envelope
(`{"model_output":"<text>"}`) down to plain text. Skills resolved by direct sys_id from
`src/fluent/generated/keys.ts`, never by name. Distinguishes invoke-layer failure (no retry,
`raw:null`) from parse-layer failure (one retry, `raw` carries the latest model text) — the
distinction `/status` and the Evidence Bundle advice hang on. 27 new Jest tests, full suite
546/546 green.

---

## 2026.08.0206 — 2026-08-02

Phase 1b Task 1 (issue #52): NASK skills `pa llm reason` / `pa llm summarize`
(`src/fluent/nask-skills.now.ts`) — the minimal passthrough skills PaLlmProxy (Task 2) calls,
each with one `prompt` string input and a `{{prompt}}` template that adds nothing. Skill names
build-reject underscores (TS210: letters/numbers/spaces only), so the platform names are spaced
(`pa llm reason` / `pa llm summarize`); Task 2 resolves them by `$id`-derived sys_id. Gated on
this app's own `x_snc_troubleshoot.admin` role via `roleMap`, not the golden example's demo
`itil`, since both skills are server-side-only (no Now Assist Panel deployment).

Live-verified on gpinst01 before and after install (MCP only, no shell): the Step 1 probe
against three existing custom skill configs and one OOB skill confirmed the documented
`OneExtendUtil.executeSecure({executionRequests:[{capabilityId, payload, meta:{skillConfigId}}]})`
call shape, and turned up a fact not in the golden example — the `response` output attribute is a
JSON-string-wrapped `{"model_output": "<text>"}`, not bare model text, so PaLlmProxy needs one
more `JSON.parse` than the golden example implies. Both skills installed deactivated (Rule #40),
activated via `PATCH sn_nowassist_skill_config_status`, and round-tripped a real completion
("Reply with exactly one word: OK" → `{"model_output": "OK"}`) despite the backing `Now LLM
Integration` subflow reading `active=false` at preflight — the flag is corroborated-unreliable as
an execution gate on this instance (AIA's own LTM subsystem was observed succeeding against
Bedrock under the identical condition), which is now recorded so `check_config`-style tooling
doesn't treat it as a hard signal. Full narrative in the file header and
`docs/LOW_LEVEL_DESIGN.md` §4.8.

## 2026.08.0205 — 2026-08-02

Phase 1b kickoff docs (issue #44). The pre-work design spec
(`docs/superpowers/specs/2026-08-02-phase1b-prework-design.md`) with its post-merge outcome
section, companioning the harness implementation plan
(`docs/superpowers/plans/2026-08-02-phase1b-harness.md`, which reached main inside PR #50's
rebase — attribution recorded in the spec). The plan sequences ten tasks: NASK skills with an
invocation-path probe FIRST, PaLlmProxy (strict-JSON + one retry), PaToolRegistry (destructive
gate now, flow in Phase 3), PaFixReport (structural evidence-rule enforcement), PaRunManager
(lifecycle close-out per DECISION.md §D5 — custom runs get real terminal states; native
anchors get a stale sweep that leaves completeness audit-derived per R-20), PaAgentLoop
(15 iterations / 5-minute budget, partial-result guarantee), async event + ScriptAction + REST
API with deep `/status`, the §D5 assist-unit probe, and the comparison re-run on identical
evidence.

## 2026.08.0204 — 2026-08-02

Phase 1b pre-work, **playbook/instructions v2** (issue #47, DECISION.md §D3/§D4 preconditions of
the comparison re-run). Two benchmark-measured diagnosis failures encoded as instruction rules,
in both renderings (markdown + Fluent, byte-for-byte sync test-enforced): **derive table names
from evidence, never guess** — a table-does-not-exist result on a guessed name is a finding
about the guess (three Task 12 runs guessed; one produced a false secondary finding and a fix
proposing to create a table that exists) — and **read the definition row when a capability is
suspect** — `sys_one_extend_capability_definition` `api`/`api_type`/`connection`, reachable via
`check_config`'s new capability argument; an empty `connection` is normal and never a root
cause on its own (the S4R2 decoy fail, the canonical 2/0/1/0 row). Word budget honored: 1166 of
the 1200-word instruction-bloat cap. Two new guard tests; build clean.
## 2026.08.0203 — 2026-08-02

Phase 1b pre-work, **`check_config` capability filter** (issue #46, DECISION.md §D3 precondition
of the comparison re-run). `PaToolGenAiLog` `check_config` takes an optional `capability`
argument: a sys_id is tried as the definition row first, then as the parent-capability
reference (two sequential reads — no OR query — with `filter.matched_on` recording which step
matched); anything else contains-matches the definition name. Without it the mode still reads
its 100-row name-ordered sample — which can never reach an `x_*` capability, the measured
reason S4R1 only found the dangling `api` by pivoting to `query_table`. A zero-match filter
states both live explanations (misspelled filter vs genuinely no definition row) and concludes
neither (R-6/R-11); a denied filtered read reports `matched: null`, never 0; a truncated
filtered read scopes its note to the matched set with a floor marker; a filtered clean audit
says its `ok` speaks for the matched set, not the table. The truncation note now names the real
argument instead of promising a future one. `genai_log`'s Fluent tool description advertises
the argument. Eleven new Jest cases; build clean.

## 2026.08.0202 — 2026-08-02

Phase 1b pre-work, **Seed 2 v2** (issue #45, DECISION.md §D2 precondition of the comparison
re-run). The refuted tool-less construction now binds exactly one weak tool —
`measure_request`, a side-effect-free character/word counter over the request text — so the
ReAct engine enters its loop and the instruction's ambiguity can actually drive the failure.
Instructions, description and agent name are byte-for-byte unchanged; the defect stays purely
instructional, and the v2 mechanism is recorded in the seed spec as a **prediction until the
re-run measures it**. New offline guard `test/seed02Construction.test.js` (exactly one tool, no
group-resolving vocabulary, v1 instruction verbatim, Rule #19/#43 hygiene); fixture app builds
clean, emitted `sn_aia_tool` record verified to carry the description and the trailing
`(inputs);`. Install deliberately deferred to the re-run's setup step.

## 2026.08.0201 — 2026-08-02

Phase 1a, **Task 12 — the benchmark ran and the harness decision is made** (issue #42). The
`x_snc_tsbench` seed app was installed on gpinst01 alongside the product app, both mandatory
setup steps were applied and verified (seed 4 capability sys_id substituted into the tool script;
seed 5's `sn_aia_trigger_agent_usecase_m2m` gate PATCHed on and re-read), the smoke-test gate
passed (the line-42 `context_processing_script` specimen diagnosed correctly from a
Completed-looking plan header), and **10 scored runs — 2 per seed, fresh conversations, blind —
were executed and scored** per `benchmark/scorecard-template.md`, with `layers_swept` derived
from the audit trail and both budget knobs read fresh per run.

**Result: 7 of 10 valid runs passed the gate (70.0%) → middle band. Native is kept for
lightweight triage; the custom deep-diagnosis harness (Phase 1b) gets built.** Deliverables:
`benchmark/scorecard-agent-doctor.md` (filled) and `benchmark/DECISION.md` (verdict, R-4
unknown-OOB-default caveat, failure notes as Phase 1b requirements).

The three failed runs are themselves findings: seed 2's construction is **refuted** (a tool-less
ReAct agent is cancelled before the LLM runs, so instruction ambiguity can never manifest — seed
2 v2 needs a tool bound); and seed 4's doubled runs **split** on the R-22 decoy (run 1 found the
dangling `api` and the exact healthy repoint; run 2 proposed "bind a connection" — the canonical
2/0/1/0 decoy row), the measured instance of the inconsistent-behavior failure mode the doubled
runs exist to catch. LLD §8 item 8 (seed-4 efficacy) closes on the observed failure; the seed-5
run-as question stays open. The temporary `/scope_probe/derisk` route used for the documented
PaEvidenceCollector substitution was removed and the app reinstalled before merge.

## 2026.08.0102 — 2026-08-01

Phase 1a, **Tasks 7 and 8**: the five remaining diagnostic tool cores, wired into Agent Doctor.
Every one of the seven diagnostic layers now has a tool, which is what **issue #32** was blocked
on — the five gate-scored benchmark seeds target layers 2 through 7, and the previous build could
sweep only layer 1.

Delivered as four stacked PRs: the shared read layer plus `PaToolAgentConfig`, then
`PaToolGenAiLog`, then `PaToolSchemaLookup` / `PaToolQueryTable` / `PaToolLogAnalysis`, then the
wiring. **Runtime-verified end to end on gpinst01**, not merely built: a real Agent Doctor
execution ran `agent_trace`, `agent_config` and `genai_log` through the script-tool path with all
nine tool calls succeeding, a 26,847-char trace offloaded to an artifact and paged back in seven
`read_artifact` calls.

**New ruling R-23 — seven data-model corrections, found before the code was wired.** Every field
list was checked against `sys_dictionary` first. Six would have returned blanks rather than errors
(**R-6**): the `sys_agent_access_role_mapping` join field is `agent_access_config` and matched none
of the five names first guessed, so the entire per-role breakout would have been skipped while
`role_list` was reported as the complete picture; `sys_agent_access_role_configuration` has no
`active` column; `sn_aia_trigger_configuration.name` is declared and mandatory although §2.2's
verified list omitted it; `sn_aia_agent_tool_m2m` has 28 columns rather than 14. R-18a's "5 of 6
sampled" is now measured over the whole table: **38 of 40 (95%)**.

**The seventh is not a field defect and it changes what a tool can claim.** LLD §4.2's
access-alignment check is written against `run_as_user` — which is set on **3 of 36** trigger
configurations. `run_as` is an `internal_type=field_name` column naming a FIELD on the target
table, so the identity is whoever occupies that field on the record that fired the trigger,
resolved per execution and unknowable from configuration. That is the K26 Lab 1 semantic exactly,
and the reason ACL-trigger misalignment is invisible from configuration in the first place. The
tool now classifies each trigger's identity path, compares only the static ones, and states
coverage as a fraction rather than emitting a silent pass computed over one trigger in twelve.
Compounding it: `description`, the only signal for the User-vs-Data split, is empty on **638 of 703
rows (91%)**.

**`check_config` is built to the corrected heuristic (R-22), and carries its own denominator.**
An empty `connection` is reported as normal state — 318 of 2026 rows, `mandatory=false`. Resolving
`api` has three outcomes rather than two: a non-table `api_type` (`Decision` is not a table) or an
unreadable target table is `unverifiable`, never `dangling`.

**`PaToolLogAnalysis` ships blocked, deliberately.** `syslog` still carries
`caller_access = Caller Restriction` and the app's own `CrossScopePrivilege` installs correctly and
does nothing (R-12, R-19). Dropping to six tools would make the gap invisible — an agent with no
log tool cannot tell you the log layer was skipped — so the read is attempted and degrades with a
stated cause, what was already tried, and the admin action required.

**One deliberate ACL bypass, bounded.** `PaToolQueryTable` takes an unfiltered COUNT — and only a
count, never row content — when and only when the secure read returns zero rows, because otherwise
a missing read ACL is indistinguishable from missing data by the very tool meant to find it.

`docs/agent/agent-doctor-instructions.md` is rewritten for seven tools and asserted byte-for-byte
against the Fluent agent. Our own seven tool descriptions are scored by `agent_config`'s own
checklist in the test suite: zero description smells, zero high-severity smells.

---

## 2026.08.0101 — 2026-08-01

Phase 1a vertical slice, **Task 11 remediation**: a scoped re-review of the benchmark suite found
that its GenAI seed was built on a **refuted premise**, plus four residuals. Build-only — **no
`now-sdk install`, no seed executions triggered**. Verified in `benchmark/seed-app/dist/`, not by a
passing build.

**Seed 4's defect was not a defect (new ruling R-22).** The seed's failure mode was an empty
`connection` on its own `sys_one_extend_capability_definition`, on R-18's Phase 0 reading that
`connection` *is* the provider binding. R-18 drew that from a **10-row sample**. Measured against
the whole table on gpinst01, read-only: the table holds **2026 rows**, **318 of them (15.7%)** have
`connection` empty — shipped OOB Now Assist definitions among them — and `sys_dictionary` marks
`connection` **`mandatory=false`** while `capability`, `api_type` and `api` are all
`mandatory=true`. An empty `connection` is a normal, supported state. Worse, the previous fix wave
had *hardened every other field* to make `connection` "the only gap", which turned the seed into a
structural clone of a working OOB definition differing only in an optional field — a specimen that
would most likely not have failed at all. A benchmark row that measures nothing scores as a miss
and is indistinguishable from one that measures something.

**This is the project's own signature failure mode, occurring inside the instrument built to catch
it.** R-11 retracted a `v_plugin` finding for reading a truncated result as absence; R-6 records the
same shape. R-18 read 10 rows of 2026 and generalised, the inference closed LLD §8 item 8, and it
then *survived a full adversarial fix wave* that asserted a false denominator ("all 12 rows") three
times. It was caught only by re-measuring the denominator. **A count without its denominator is not
a measurement** — recorded as a standing reporting rule in R-22, binding on rulings as well as code.

**Seed 4 re-targeted at a mandatory binding.** `api` now holds
`00000000000000000000000000000000` against `api_type=sys_hub_flow` — the definition names a
provider integration Flow that exists nowhere. Justified on the same denominator: `api` is
`mandatory=true` and `internal_type=document_id`, so it carries **no referential integrity** and
installs verbatim; **1 of 2026 rows (0.05%)** has an empty `api` and **1 of 2026 (0.05%)** a
dangling one, making it ~300× rarer than an empty `connection`. The all-zeros value is deliberately
unmistakable — a plausible random GUID would read as real drift. `connection` stays empty as a
**documented decoy**: a "no connection bound" diagnosis now scores the correct layer with a **0**
fix target, and the decoy hit is recorded in `notes`. The rejected alternative, a dangling
`capability` reference, remains the documented install-refusal **fallback** with its own signature
(*capability not found*).

**LLD §8 item 8 split, R-21 annotated.** Safety **closed** — it never depended on R-18; the seed
adds records rather than unmapping anything, and the dangling sys_id cannot collide with a live
flow. Efficacy **re-opened** until a Task 12 run produces the failure: the new construction is a
stronger inference, but it is still an inference from table statistics, and this item was already
closed once on exactly that. §8 item 6 carries the sample-size correction at the point R-18's
reading originated.

**Four residuals.**

- **Two seed 1 summary lines still named a fix target their own body invalidates** — the spec's
  header table and the Fluent header both read "the tool input schema", which the body already
  established is not expressible (Fluent script-tool inputs have no `type` property). Both now name
  the word-typed contract.
- **Seed 1's evidence criterion would have mis-scored a correct run** — it said the trace shows
  `priority_stored` **empty**, but an integer column given a non-numeric string typically settles at
  **`0`**. Reworded to score the *mismatch* rather than a literal value, with `priority_stored ==
  "critical"` called out as a refutation of the seed rather than a miss by the agent.
- **The scorecard stated only the top gate band proportionally** — 8 valid runs with 4 passes had no
  band. All three bands are now given as proportions of the valid-run denominator (≥80% / ≥50% / 
  <50%), with inclusive edges, per-denominator pass counts and that worked example.
- **A general Fluent hazard filed as [#34](https://github.com/gapietro/tool-foundry-troubleshooter/issues/34)** — `Now.ID['key']` inside a `Record()` **data**
  field builds clean and emits the **literal key name**, not a sys_id, corrupting both the column
  and the record's composite identity key in `generated/keys.ts`. Same silent-phantom family as
  Build Rules #21 and #33; proposed for promotion to a numbered rule in `sdk-reference.md`.

**`dist/` evidence for the seed 4 change:**

```xml
<!-- sys_one_extend_capability_definition_904c0485….xml -->
<api>00000000000000000000000000000000</api>
<api_type>sys_hub_flow</api_type>
<capability>92ff62af516741769c437feb88c80ef3</capability>   <!-- the parent record's real sys_id -->
<connection/>                                                <!-- the decoy, not the defect -->
```

Noted while verifying: this record's identity key in `generated/keys.ts` is the **composite
`{capability, api}`**, so changing `api` mints a new sys_id and marks the old entry `deleted: true`
rather than updating in place — which matters because repointing `api` is exactly what *fixing* this
seed means. Recorded in the Fluent header.

## 2026.07.3112 — 2026-07-31

Phase 1a vertical slice, **Task 11**: the seeded-failure benchmark suite — the measuring
instrument DESIGN.md §1 calls the load-bearing component of the whole harness strategy:
*"Under A the load-bearing component is the **benchmark**, not Agent Doctor."* Five
deliberately-broken AI Agents, the run protocol, and the scorecard that will score Agent
Doctor against them. Build-only — **no `now-sdk install`, no seed executions triggered**.

**The seed-location decision, resolved (new ruling R-21).** `IMPLEMENTATION_PLAN.md` had
carried an explicit "OPEN — decide before Task 11, not during it" gate against R-13 since
2026-07-30: where do five deliberately-broken agents live? Both obvious answers failed on a
requirement the other satisfied — Fluent inside `src/fluent/` (the product app) gives
reproducibility for Phase 1b's re-run but ships five broken agents inside
`x_snc_troubleshoot`, the scope every customer installs; MCP/Foundry record automation keeps
them out of the product app but violates CLAUDE.md's port-to-Fluent rule and is not reliably
reproducible months later, which is exactly when Phase 1b needs it. Resolved with a **separate
scoped fixture app**, `benchmark/seed-app/`, scope `x_snc_tsbench`, five seeds authored as
Fluent DSL (`src/fluent/seed-0{1..5}-*.now.ts`) — reproducibility from the first option,
app-separation from the second, at the accepted cost of a second scope and a second install
target. What made scaffolding it low-risk without an install: `now-sdk init` contacts the
instance during scaffolding but creates no record there — a `sys_scope` query for
`scope=x_snc_tsbench` returned zero rows against an instance where the same query for other
scopes returned nine. Full rationale and the rejected-options table in
`benchmark/DECISION-seed-location.md`.

**The five seeds**, one per gate-scored layer, each a Fluent `AiAgent` (seed 5 an
`AiAgenticWorkflow`) built to fail for exactly one documented reason:

- **Seed 01 — tool schema mismatch** (layer 3, `tool_schema`). ~~`set_ticket_priority` declares
  `priority` as a free string~~ ~~and the write silently coerces to empty.~~ **Corrected
  2026-08-01:** Fluent script-tool inputs have **no `type` property**, so nothing is "declared as
  a free string" and the emitted `input_schema` is shape-identical to the *correct* seeds' — the
  word-typed contract lives in the tool description and the script's unguarded `setValue`. And a
  non-numeric string on an integer column typically settles at **`0`**, not empty; the seed spec no
  longer scores on a literal stored value, only on the mismatch. `x_snc_tsbench_ticket.priority` is
  an integer choice 1-5 and `gr.update()` still reports success. Also built to produce a LARGE
  trace, deliberately stressing Task 9's artifact-paging path.
- **Seed 02 — ambiguous instruction** (layer 2, `instruction`). "Assign it to the right group"
  with no group-lookup tool, no routing table, and no group list in the instructions — the
  agent must invent an answer or stall.
- **Seed 03 — missing data** (layer 5, `data`). The lookup table exists and the tool queries it
  correctly, but the table is empty — the seed that separates "the data is absent" from "the
  read failed," the R-6/R-11 failure mode this project keeps legislating against. Its table is
  named `x_snc_tsbench_routing`, not the LLD §7's original `x_snc_troubleshoot_bench_routing`,
  because a scoped table name must begin with its own app's exact scope value (R-13's 40-of-40
  finding) — a build-time rejection, not shorthand awaiting expansion.
- **Seed 04 — GenAI capability not mapped to a provider** (layer 6, `genai_stack`). A new
  capability definition owned by the fixture app rather than unmapping a real one — the
  shared-instance-safe construction. ~~with `connection` left empty — the construction R-18
  narrowed this item to. Closes LLD §8 item 8 **build-proven, not yet runtime-proven**.~~
  **REFUTED and re-targeted 2026-08-01 (R-22)** — an empty `connection` is a normal state
  (318 of 2026 rows, `mandatory=false`); the defect is now a dangling **mandatory** `api`.
  LLD §8 item 8 is split: safety closed, efficacy re-opened until Task 12.
- **Seed 05 — use case exists but is inactive** (layer 7, `wiring`). Everything is correct and
  published except `sn_aia_trigger_configuration.active=false`, with the sibling gate
  `sn_aia_trigger_agent_usecase_m2m.active` deliberately left `true` — so the diagnosis has to
  name the right gate, not just "something is inactive."

**Protocol, scorecard, and decision record** — `benchmark/README.md` (replaces the placeholder
wholesale), `benchmark/scorecard-template.md`, `benchmark/DECISION-seed-location.md`: smoke
test against a known-answer gpinst01 specimen invisible from its plan header, then 2 runs per
seed across all 5 seeds in fresh conversations (10 scored rows), keyed on
`_agentic_context_.conversation_id` rather than a time window — DESIGN.md §2.4 disqualifies
time-window keying outright, since `PaRunAnchor`'s 30-minute fallback would glue a second
blind run onto the first run's anchor and let it read the first run's evidence. The scorecard's
six-point rubric is joined by four further columns, each discharging a specific ruling:
`layers_swept` and `layers_available` (R-3's amendment plus the new `layers_available`
column from R-21, extending "finished vs. did not look" to a third state, "could not look" —
`swept 1/7, available 1/7` and `swept 1/7, available 7/7` are the same total score and opposite
verdicts), `cause_of_death` (§2.3 — a 0-point budget death and a 0-point reasoning death are
opposite verdicts on the gate), and `continuous_tool_execution_limit` /
`max_auto_executions`, read fresh per run rather than assumed (R-4 / #30 — E2's 19-call result
was reachable only because that probe's `max_auto_executions` was 20 against an
instance-typical 10).

**The finding that came out of building the scorecard, not from a probe.** Checking the
seeds' expected layers against what Agent Doctor can actually sweep surfaced that it has tools
for **layer 1 only** — `agent_trace` and `read_artifact` (paging, not a layer), the deliberate
Task 10 vertical-slice scope. All five gate-scored seeds target layers 2-7. A scored run
executed today therefore returns near-0/10 **by construction**, and Task 12's gate table reads
that as `< 5/10 → full custom harness as designed` — the most expensive decision in the
project, reached from a missing-tools gap rather than from anything measured about the native
harness. Recorded as DESIGN.md **R-21** and filed as its own blocker, **issue #32**: Task 12's
scored protocol is blocked on Tasks 7-8 (the remaining five tool cores), independent of this
ruling, since discharging R-21 here does not build those tools.

**What was deliberately not attempted here.** DESIGN.md §2.1's `PaEvidenceCollector` — the
benchmark's pre-scoring de-risker, meant to separate "tools cannot see the defect" from "agent
cannot reason to it" before scoring starts — is not built and not in the Phase 1a task list.
Recording the substitution (a manual pass invoking the tool cores directly against each seed)
matters more than the substitution itself: an unbuilt de-risker everyone assumes ran is how a
benchmark produces scores nobody can interpret.

**Doc reconciliation.** `IMPLEMENTATION_PLAN.md` Task 11, `docs/LOW_LEVEL_DESIGN.md` §7 (the seed
rows — including the corrected `x_snc_tsbench_routing` table name) and ~~§8 item 8 (closed,
build-proven)~~ **§8 item 8 (that closure is withdrawn — see R-22 in 2026.08.0101)**, and
DESIGN.md R-21 all updated in this branch to match what was actually built.
~~§7 instance correction to gpinst01 (R-18c).~~ **That claim was false and is withdrawn:** §7's
instance correction was made on an earlier branch and this branch made no instance correction at
all.

**Fix wave following whole-branch review.** The seeds were broken on purpose, but four of them were
broken in ways their specs did not claim, and two instruments could not measure what they existed
to measure. Verified in `benchmark/seed-app/dist/`, not by a passing build:

- **Seed 5 was void as built** — both activation gates emitted `false`. Fluent has no property for
  the `sn_aia_trigger_agent_usecase_m2m` gate, so the seed could not express its own specification.
  The gate is now a mandatory post-install PATCH, documented in the seed spec, the protocol and LLD §7.
- **Seed 4 would have failed at layer 3, not layer 6** — the `OneExtendUtil` envelope was a flat
  name-keyed object rather than an `executionRequests` array keyed by capability sys_id, so it could
  never have reached the empty `connection`. Envelope corrected and the invocation sys_id moved to
  the house `REPLACE_WITH_..._SYS_ID` placeholder — both still stand. ~~Capability record completed
  so `connection` is the only missing binding.~~ **That hardening was aimed at the wrong field and
  is superseded by R-22 (below).**
- **Build Rule #42 had made three seeds' setup steps impossible** — `dist/` carried six ACLs, all
  `operation=execute`, and zero record ACLs, with `ws_access=false` on both fixture tables. Adds
  `seed-tables-acl.now.ts`. On seed 3 the read ACL is part of the instrument: a `GlideRecordSecure`
  sweep cannot distinguish an empty table from an unreadable one.
- **Seed 1's stated mechanism was false** — the column emitted `internal_type=choice`
  (string-backed) and would have stored `'critical'` verbatim; now `IntegerColumn`. Its evidence
  path also read the in-memory record after `update()` rather than re-querying.
- **Seed 5's trigger condition referenced a column that does not exist** (`active=true` on a table
  with no `active` field), so it could never have matched even with both gates on.
- **The scorecard could not produce the number the gate consumes** — it scored /6 while the gate
  counts runs. Adds `passes_gate` with its rule derived from the gate's wording, a void-run state
  with a denominator rule and an 8-valid-run floor, a partial band on `fix_target_correct`, the
  two-step `layers_swept` derivation (the documented one-step query matched nothing), and the
  canonical tool→layer map (the roster is seven tools, not seven layers).
- Every seed spec's defect section is now marked **predicted, not observed — confirm at Task 12**.

## 2026.07.3111 — 2026-07-31

Phase 1a vertical slice, **Task 10**: Agent Doctor as a Fluent `AiAgent`
(`src/fluent/agent-doctor.now.ts`), wired to the two script tools built in Task 9 —
`agent_trace` and `read_artifact` — with its instruction document at
`docs/agent/agent-doctor-instructions.md`. This is the first time any of the server-side
components built across this slice have been driven by an actual agent rather than a probe
route or a unit test.

**The run-completion contract, new ruling R-20.** Native diagnostic runs have no terminal
state, and that is by design, not an oversight. The native harness emits no
end-of-conversation signal, so completion could only ever be *declared* by something inside
the system, and all three candidates fail on grounds already measured earlier in this slice.
The agent itself is unreliable as a declarer — R-9's Phase 0 probe caught it passing a
declared input in zero runs while its own reasoning trace claimed it had. A clock is out
because it reintroduces the time-window reasoning R-2 deleted outright. And
`sn_aia_execution_plan` state is scoped to a single turn, not to a conversation, so closing a
run on it would end the run while the user is still asking follow-up questions — which the
PRD explicitly wants to support. Completeness is instead **derived**, not declared: read from
`x_snc_troubleshoot_audit`, as the distinct set of `tool_name` values recorded under
`action_type='result'`. That answers the harder question the design doc poses — a run that
stopped early is indistinguishable from one that genuinely finished — which a status column
is structurally incapable of answering, since it can only report what it was last told.
Consequence: `status`, `transcript`, `context_summary`, `fix_report`, and `error` are Phase 2
(custom harness) columns and stay unwritten on the native path; LLD §3.1's status-row
description was corrected in this same PR to say so. A guard test fails the suite if anyone
adds a completion-declaring code path in the future.

**Task 3 was never built, and that surfaced here.** `docs/agent/` did not exist anywhere in
git history. The Phase 1a build brief scoped the slice to Tasks 2, 4, 5, 9, and 10, and
silently dropped Task 3 — but Task 10's `instructions` property was specified as depending on
"the Task 3 native rendering", a document that had never been written. Resolved by writing
the native rendering scoped to the two tools that actually exist, `agent_trace` and
`read_artifact`, rather than the full seven-tool roster the design assumes. The
harness-neutral `playbook.md` stays deferred to Tasks 7–8, where the remaining tool cores get
built.

**Build Rule #43's backtick corollary reaches `instructions`, not just `script`.**
`instructions` is a Fluent backtick template exactly like a tool's `script`, so a markdown
code span inside it closes the template early and produces the same misdirecting cluster of
errors — TS2796, TS304, TS20 — at line numbers scattered across the file rather than at the
offending backtick. The instruction document was therefore written with no backtick, no
`${`, and no two-character backslash-n escape anywhere: table names appear bare in prose
instead of in code spans, and the Fix Report template uses indentation rather than fenced code
blocks. Three Jest tests enforce all three constraints so a future edit can't reintroduce
them. Worth flagging: `.claude/context/sdk-reference.md`'s Rule #43 currently documents this
failure mode for `script` templates only — the text should be broadened, since `instructions`
is exposed to exactly the same TypeScript-consumes-the-escape mechanism.

**The live results on gpinst01 — the actual point of building the slice.** Reported plainly,
including what didn't go as designed:

- Install was clean, and produced exactly two `sn_aia_tool` records and two
  `sn_aia_agent_tool_m2m` rows with names matching the Fluent definitions — Build Rule #34's
  silent-tool-skip-on-missing-description defect did not fire here.
- The panel smoke test found the seeded defect. Agent `601672d3…`,
  `context_processing_script`, line 42, `InternalError` — against a specimen whose failure is
  invisible from the plan header alone: `state=Completed`, `state_reason` empty, all 11 tasks
  and all 5 tool calls reporting `Success`. The defect only shows up once something reads past
  the header.
- The agent correctly reported layers 2–7 as **not swept**, per its instructions, and gave a
  per-layer table showing what it had and hadn't looked at.
- **`_agentic_context_` is present on the Now Assist panel path.** 16 audit rows all resolved
  to one run (`TR1000032`). R-2's earlier closure on this point was explicitly
  API-path-provisional — it had only ever been observed via `servicenow_aia_execute` — and the
  build brief required re-confirming it before the benchmark work in Task 11 could rely on it.
  It is now confirmed on the panel path too.
- Artifact paging held under a real invocation. One attachment, 26,871 bytes; one
  `agent_trace` call; seven `read_artifact` calls at offsets 0, 4000, 8000 … 24000. Task 9's
  paging-that-pages defect stayed closed at the first real agent-driven call, not just in the
  measured probe.
- `sn_aia_message.role` vocabulary is confirmed as `user_profile` / `user` / `agent`, with
  `history` defined on the table but unused in practice — a check DESIGN.md §78 records as
  never having been performed before this task.

**Two findings from the live run that must not be smoothed over.**

R-7 came back half-refuted. `applicability_script` was empty on the installed agent, which is
the dangerous field — the one where an auto-populated `return false;` silently suppresses
everything — and it is clean. But `context_processing_script` *was* auto-populated, with
2,124 characters of platform boilerplate: a comment block followed by a no-op pass-through
returning `{ pageContext: context?.pageContext, triggerContext: context?.triggerContext }`.
The plan called for clearing it. The ruling was not to, at least not before the smoke test,
because that script is what forwards context into the agent, and `PaRunAnchor` keys every
run on `_agentic_context_.conversation_id` — clearing an unverified field first would have put
three candidate causes behind any smoke-test failure with no way to tell them apart. It
remains uncleared on the instance and the question is open.

Second, the agent found the right answer and ranked it second. It produced three candidate
root causes and marked only the layer-1-observable one CONFIRMED, correctly labelling the
line-42 script error UNCONFIRMED — which is exactly what the instructions require, since
confirming a script error needs a Layer 2 tool the agent doesn't have yet. But it gave a
self-generated tool-input-schema narrative primary billing over the correct finding, which the
instructions never asked it to do. The instruction document specifies how to *label*
confidence but says nothing about how to *rank* candidates against each other. This was
deliberately left untuned: with n=1, tuning the instructions against the single specimen we
also test against overfits to that specimen and mildly contaminates the blind-run protocol
§2.4 depends on. Task 11's 5-seeds-by-2-runs benchmark will say whether the mis-ranking is
systematic or a one-off.

**Access findings worth recording for later tasks.** Both `sn_aia_message` and
`sn_aia_version` are ACL-denied on gpinst01 even to admin — the same restriction class already
known for `sys_generative_ai_log`. Verification for this task read `sys_cs_message` and
`sys_choice` instead. Practically, this means the plan's step to read the published version
record directly is not reachable as written on this instance.

**`max_auto_executions` deliberately left unset, a knowing deviation from LLD §5.** The row for
rows 9–15 says to set it explicitly rather than accept the dictionary default of 10; Agent
Doctor's Fluent definition does the opposite on purpose. The tool bindings take the dictionary
default, so the instance this branch benchmarks against is the same one a default-configured
customer would have, rather than a value tuned to whatever this build needed. R-4's actual
requirement was never that this agent pin a budget — it was that Task 11's scorecard **read and
record** both budget knobs at run time, `sn_aia.continuous_tool_execution_limit` and
`sn_aia_agent_tool_m2m.max_auto_executions`, so a transferability claim can be checked rather
than assumed. Pinning a raised value here would reproduce exactly the problem R-4 was filed
against — the Phase 0 probe's 19-call result was reachable only because its own
`max_auto_executions` was set to 20 against an instance-typical 10. The decision lived only in
an untracked execution ledger until now; the LLD row carries the same note.

**Cleanup.** The four temporary `/scope_probe` routes are gone — all four now return 400, and
`/reads` is the one route that survives. They were removed in a separate commit *after* the
smoke test passed, specifically so a smoke-test failure could have been bisected against the
probe routes still being present, rather than against the tool cores themselves.

**Known gaps carried forward.** `playbook.md` (Tasks 7–8); the five remaining tool cores and
their wrappers; the derived-completeness "layers swept" reader (Task 11); the `log_analysis`
roster decision, still open and now explicitly deferred to Task 8 because
`PaToolLogAnalysis` has no core yet to include or exclude it against; and one minor
test-hardening item — the guard tests strip comments with a regex that isn't string-aware, so
it's currently unreachable but would weaken the `Now.ref` guard if a `//` ever appeared inside
a string literal on a line that also carried a real `Now.ref(` call.

## 2026.07.3110 — 2026-07-31

Phase 1a vertical slice, **Task 9**: `PaScriptToolAdapter` + the `read_artifact` tool core
(LLD §4.7) — the bridge an AI Agent script tool calls to reach a diagnostic tool core. Scoped
to **two** wrappers, `agent_trace` and `read_artifact`, rather than the plan's seven: it is the
smallest set that makes the Task 10 panel smoke test answerable, and the other five need cores
that do not exist yet.

**The defect this task existed to close.** `PaArtifactStore.MAX_PAGE_CHARS` is 4000 and
`THRESHOLD_CHARS` is also 4000, so a full page *plus its envelope* always exceeds the threshold.
Routed through `applyThreshold` like any other result, `read_artifact` would have stored every
page as a **new** attachment and returned an excerpt of it — paging that pages, with the agent no
closer to the content on each call, and nothing anywhere reporting a problem. The exemption is a
`PAGED_OUTPUT: true` flag declared on the tool core rather than in the Fluent wrapper literal,
because a wrapper literal is a string no unit test can reach.

Closed by measurement on gpinst01, not by argument: a real trace of **26,847 chars** stored as
**one** attachment (`1f1a63a7…bf91`) and paged back in seven calls — 6×4000 + 2847 — reassembling
to exactly 26,847, with the joins landing mid-word and mid-sys_id. The attachment counter never
advanced past 1, which is the falsifier that matters.

**Tools resolve by NAME against a closed factory map**, deviating from LLD §4.7's
`invoke(toolClassName, …)`. The first argument originates in a tool-script literal and beyond
that in whatever the platform hands the wrapper, so resolving an arbitrary class by string is a
code-execution surface. The map is an allowlist, errors cleanly on a typo, and its key is the
same string written to `x_snc_troubleshoot_audit.tool_name` — registry and audit trail cannot
drift apart.

**A bare string reaches the tool core completely untouched, whitespace included** (LLD §4.7
Note 4). The plan originally trimmed it; that was reversed mid-build. Wrapping a bare string as
`{value: s}` — the older, superseded reading — produces an args object with none of the keys the
cores read, so `PaToolAgentTrace` falls through to its recent-plan pick-list and **silently
discards the caller's request**. Trimming is milder but the same class of liberty: the core owns
normalisation, and the adapter does not second-guess it.

**Run-anchor degradation is surfaced to the agent** as `run: {degraded, note}` — an addition
beyond LLD §4.7. `PaArtifactStore` and `PaAuditLogger` both tolerate a degraded anchor quietly,
so without this the agent would never learn that the evidence trail behind its diagnosis was not
durable. The findings stay valid; the difference has to be stated rather than inferred (R-10).

**Containment.** `invoke()` returns a String on every path including every failure path, and a
caught exception is never read — a `phase` variable localises failures instead (R-1). The tests
enforce it with a fake whose `.message` getter throws, which is the shape a
`ScopeAccessNotGrantedException` presents: any future edit that reads `e.message` fails the suite
rather than 500-ing on an instance weeks later.

**Known gaps, deliberately carried to Task 10.** `PaRunAnchor` has no run-completion path, so
every run sits at `status: "running"` — invisible while a run is one call long, load-bearing the
moment the wrapper makes a run span calls. The four `/scope_probe` routes are ungated and
write-capable, held back only by a source comment, and are removed with the Task 10 agent.
`_stringify` guards `undefined` but not every non-string `JSON.stringify` return. An unknown tool
name leaves no trace anywhere, so an agent hallucinating a tool name is currently invisible.

## 2026.07.3109 — 2026-07-31

Phase 1a vertical slice, **Task 5**: `PaRunAnchor` + `PaAuditLogger` (LLD §4.6). Every artifact
is an attachment on a run record and every audit row references one, so this is the component
that decides *which* record a given tool call belongs to — and the expensive way to get that
wrong is not to fail, it is to answer with the wrong record and carry on.

**A spec gap closed first.** LLD §4.6 keys the anchor on `_agentic_context_.conversation_id`, but
§3.1's column list had nowhere to store it and `execution_ref` is spent on the execution plan
*under diagnosis*. `getOrCreate` could therefore only ever create, never get. Added
`conversation_ref` to `x_snc_troubleshoot_run`.

**R-2 enforced structurally, not by convention.** With no conversation id and no execution ref
there is no key, and R-2 deleted time-window keying from the design entirely. An unkeyed call now
creates an *isolated* run used for that call alone, and says so. Two unkeyed calls never share a
record — a merged anchor lets benchmark run 2 read run 1's artifacts and quietly destroys the
blind-run independence the doubled-run protocol exists to measure (§2.4). The test named
"two unkeyed calls NEVER share a run" is the guard on that.

**Concurrency.** R-3 measured up to four tool calls in a single timestamp batch, all racing to
create the anchor. There is no atomic upsert available, so convergence is bought after the fact:
insert, then re-resolve the key and adopt the deterministic winner (oldest `sys_created_on`,
`sys_id` as tie-break — and ties are the *normal* case, since a batch lands inside one second).
Losing rows are left alone rather than deleted.

`PaAuditLogger` is total by construction: it sits in the hot path of every tool call, so a
logging failure must degrade the trail, never the diagnosis. It also digests payloads past 4KB,
because `applyThreshold` has already offloaded oversized results by the time `logResult` runs and
re-storing them here would undo that work in a different table.

**Verified on gpinst01, not in a stub** (R-8) via a temporary `POST /scope_probe/anchor_selftest`
route, which cleans up after itself: the conversation key resolves two calls to one run, unkeyed
calls stay isolated, `readNativeContext()` survives `_agentic_context_` being absent (a REST route
is exactly such a runtime — an unguarded read is a `ReferenceError` that kills the request), audit
rows write *and read back*, `autoNumber` still populates `number` (Build Rule #41 re-check), and a
20,008-char payload stored as 4,024. 194 Jest tests pass.

Two defects were caught in self-review and fixed before merge: the choice-vocabulary check used
an object as a lookup map, so a caller-supplied `harness: "constructor"` answered truthy off
`Object.prototype` and was written into the choice field; and `PaAuditLogger` parsed a
JSON-string `params` for its fields but picked the payload off the raw string, writing a correct
tool name beside a silently empty `input`. Both have regression tests.

**Two Medium security findings on PR #21, both fixed and both verified live:**

*Audit metadata is now server-authoritative.* `user` came from the caller when supplied, and
`confirmed_by_user` was caller-settable. The caller is the Task 9 adapter, and part of what
reaches it is LLM-derived — a trace payload is a plausible prompt-injection carrier, the same
threat model behind `PaArtifactStore.read()` refusing foreign attachments. An audit trail whose
*actor* field is supplied by the thing being audited is not an audit trail. `user` is now always
`gs.getUserID()`; `confirmed_by_user` is always false, and Phase 2's gate will set it from the
workflow that actually collects the confirmation. Neither override had a consumer.

*The ambient context now wins over caller-supplied identity.* `getOrCreate` took caller values
first, unconditionally — so a native tool call could name **any** conversation and be handed that
conversation's run record, its artifacts and its audit trail. That is the R-2 merge reintroduced
through the front door. LLD §4.6 already said the native key *is*
`_agentic_context_.conversation_id`; "caller first" was a liberty, and one of the tests had
encoded it. Caller-supplied identity is now honoured only where there is no ambient context to
contradict it — the custom harness (§4.6: "custom: explicit run_id"), tests, and the self-test
route. `harness` and `mode` stay caller-first: they are configuration, not identity.

On that remaining caller-controlled path, a resolved run belonging to a different user is not
adopted. The check fails **open** on "cannot tell" (no recorded owner, or an unidentifiable
caller) and closed only on "can tell, and it is not you" — a false rejection would split an
anchor, which is the failure this component exists to prevent, and the native runtime's identity
surface is unverified until Task 10. It applies to the caller-supplied path only, and to the
post-insert re-resolve as well: the refused run is *older*, so without the filter on that second
lookup it would have been adopted one step after being rejected. Foreign runs are skipped rather
than stopped on, so a second call by the same user converges on its own run instead of creating a
new one every time.

**One High finding on round 2, fixed and reproduced live.** The ownership check derived
"did the caller supply this key" from `native.present` — but `present` only means *the global
parsed to an object*. An `_agentic_context_` of `{}`, or one carrying junk, or one whose
`conversation_id` is the literal string `"undefined"` (which LLD §4 normalises to empty), all
make `present` true while the key still falls through to the caller — so the ownership filter was
skipped on a key the caller chose, re-opening cross-user fixation. Provenance is now tracked **per
field**: the flag is `!native.conversation_id` (or `!native.execution_plan_id`) for whichever
value is actually being used as the key. `readNativeContext()` carries a warning that `present`
must never be used for that decision. Four regression tests, each verified to fail against the
unfixed code.

The self-test route plants a foreign-owned run and attempts every variant. Notably
`context_seen: true` on the partial-context step — assigning `_agentic_context_` without a `var`
declaration does reach `PaRunAnchor` through the Rhino global object, so the vulnerable path was
reproduced in a real runtime rather than only in a stub, and the fix holds there. `refused`,
`key_rejected`, `converges_on_own_run` and `spoof_ignored` all true on gpinst01. 211 Jest tests
pass.

**New SDK finding, folded into Build Rule #43** (`.claude/context/sdk-reference.md`): a backtick
*anywhere* inside a Fluent `` script`…` `` template — including inside a `//` comment — closes the
template. Markdown-style quoting in an explanatory comment is the natural way to write one and
silently terminates the script. It fails at build rather than at runtime, but the diagnostics
(`TS2796`, `TS304`, `TS20`, `Failed to cast TaggedTemplateExpressionShape`) point at lines
scattered across the file rather than at the backtick.

## 2026.07.3108 — 2026-07-31

Housekeeping after Task 4. `IMPLEMENTATION_PLAN.md` and
`BUILD_BRIEF_Phase1a_VerticalSlice.md` both still described `PaArtifactStore` as outstanding, and
the brief still listed it as the **hard blocker** on the vertical slice — which is what the next
session reads to decide what to build. Task 4 is marked done in both, with the measured evidence
and the three findings worth carrying forward rather than rediscovering.

Docs only. No source, no Fluent, no instance change.

## 2026.07.3107 — 2026-07-31

Phase 1a vertical slice, **Task 4**: `PaArtifactStore` — the blocker on the whole slice. A real
`PaToolAgentTrace` summary measures ~35KB against a 4,000-char excerpt budget, so until
oversized output could live outside the prompt, the first tool core could not be handed to an
agent at all.

- **`src/server/PaArtifactStore.js`** — `store()` puts over-threshold content on the run record
  as an attachment and returns a head+tail excerpt plus an `artifact_id`; `read()` pages it back
  4KB at a time (the future `read_artifact` tool); `applyThreshold()` is the wrapper the Task 9
  adapter will apply to every tool result, returning small results by identity.
- **42 Jest tests**, written first. They settle arithmetic — truncation, paging, boundaries,
  byte-identical reassembly — and per **R-8** nothing else.
- **Live-verified on gpinst01**, which is what actually closed LLD §4.5's `⚠ VERIFY` on the
  scoped-app attachment surface: 35,000 chars stored and paged back **byte-identical** in nine
  reads from scope `x_snc_troubleshoot`.

Two deliberate departures from the LLD sketch, both documented in §4.5: `read()` refuses any
attachment outside `x_snc_troubleshoot_run` (it is LLM-callable and takes a caller-supplied
sys_id), and a failed store degrades to the excerpt with a named reason rather than falling back
to the full payload.

**New SDK failure mode found and recorded as Build Rule #43:** a `\n` inside a Fluent
`` script`…` `` template literal is consumed by TypeScript, emitting a real newline that leaves
the platform script's string constant unterminated. Builds clean, installs clean, and fails only
on invocation — at a line number that does not match the source.

## 2026.07.3106 — 2026-07-31

Phase 1a vertical slice, **Task 2**: the two scoped tables every later task anchors to. First
Fluent artifacts in this repo that hold data rather than describe behaviour.

> **Gap noted, not backfilled:** versions `2026.07.3101`–`2026.07.3105` were merged without
> changelog entries. The history is in the git log and the PRs; reconstructing it here was out
> of scope for this task, but the convention says every merge gets an entry.

### Added
- `src/fluent/tables.now.ts` — `x_snc_troubleshoot_run` and `x_snc_troubleshoot_audit` per
  LLD §3.1/§3.2. Installed and verified on gpinst01: 11 and 9 declared columns respectively,
  12 `sys_choice` rows across the 4 choice fields, `TR` auto-number counter, the cross-scope
  `agent` reference into `sn_aia_agent`, and cascade-delete from run to audit.
- `src/fluent/acls.now.ts` — roles `x_snc_troubleshoot.admin` / `.user` and 6 record ACLs.
  Added after the install measurement below; **the audit table deliberately gets `read` +
  `create` only**, making the evidence trail append-only through the ACL layer while the
  server-side writer that fills it is unaffected.
- SDK Build Rules **#41** and **#42** in `.claude/context/sdk-reference.md` — both found by
  inserting a real row after a clean install, neither visible at build or install time.

### Fixed
- **`autoNumber` does not populate `number`.** It writes the `sys_number` counter and stops;
  the column installs with an empty default, so every insert left `number` blank — and with
  `display: 'number'`, every run record would have rendered with a blank display value. Fixed
  with the explicit column default. **The `global.` qualifier is load-bearing:** the bare
  `javascript:getNextObjNumberPadded();` installs identically and still yields `''`, because a
  scoped app cannot resolve the global function unqualified and the failed evaluation degrades
  to empty instead of throwing. Measured, then confirmed against instance convention (8 of 10
  scoped `x_*` tables sampled use the qualified form). Build Rule #41.
- **Custom tables install with zero ACLs and `ws_access=false`,** which denies REST and UI
  access to everyone including admin. Caught because an admin REST insert returned
  `Access denied: User Not Authorized`. It would not have surfaced from the code that writes
  these rows: a server-side scoped `GlideRecord` bypasses ACLs, so Task 5's writes would have
  worked while nobody could read a Fix Report. Build Rule #42.

---

## 2026.07.3001 — 2026-07-30

Reconciled the implementation plan with the SDK structure and finalized the scoped table names.
Docs and project metadata only; no Fluent artifacts changed.

### Fixed
- **Scoped table names were unbuildable.** `LOW_LEVEL_DESIGN.md` §3 deferred the scope prefix
  ("finalize at SDK setup") and SDK setup then happened without it. `x_pa_run` / `x_snc_pa_run`
  cannot be created from scope `x_snc_troubleshoot` — a scoped table name must begin with its
  application's exact scope value (verified on gpinst01: 40 of 40 sampled `x_snc_*` tables).
  Finalized to `x_snc_troubleshoot_run` and `x_snc_troubleshoot_audit`; LLD §3 is now the
  authority for table names.
- **`IMPLEMENTATION_PLAN.md` Task 10 contradicted the SDK/MCP boundary** — it specified creating
  Agent Doctor on-instance via MCP automation, where `CLAUDE.md` requires SDK-owned creation.
  Now a Fluent `AiAgent` in `src/fluent/agent-doctor.now.ts`.
- Plan file paths repointed from the never-created `src/instance/**` tree to the real
  `src/fluent/` + `src/server/` layout.
- `package.json` version aligned with the documented convention (was `0.0.1` from the SDK
  scaffold, against a README badge reading `2026.07.1801`).

### Added
- `CHANGELOG.md` — referenced by `CLAUDE.md` but previously absent.
- `IMPLEMENTATION_PLAN.md` gains a "Structural contract" section, and two Phase 0 rulings that
  tool authors kept rediscovering are promoted into its standing Design Rules table: **R-9**
  (every declared input may be absent at runtime) and **R-1** (never touch the exception object
  in a cross-scope `catch`).
- `DESIGN.md` ruling **R-13** recording the above.

---

## 2026.07.1801 — 2026-07-30

Phase 0 pre-flight and SDK scaffold. Verdict: **GO**, zero items carried forward.

### Added
- ServiceNow SDK app scaffolded — scope `x_snc_troubleshoot`, SDK 4.9.2, building and installing
  to gpinst01.
- `src/fluent/scope-readability.now.ts` — the LLD §6 `/status`-equivalent cross-scope readability
  check, run from inside the scoped app. **14 of 15 tables readable, 1 denied (`syslog`).**
  This discharged the last carried-forward Phase 0 item (R-1) and upgraded the verdict to GO.
- `docs/BUILD_BRIEF_PaToolAgentTrace.md` — self-contained build brief for the first tool core.
- `docs/PREFLIGHT_FINDINGS.md`, `DESIGN.md` §4 rulings R-1..R-12, `AGENT_DOCTOR_ARCHITECTURE.md`.

### Fixed
- **R-11 retracted** — the "no Now Assist product plugin" finding was an instrument error. The
  probe queried `v_plugin`, whose visibility is restricted for this caller, and read a *partial*
  result as *absence*. `sys_scope` shows the Now Assist product plugins installed and active.
  keynexus01 used the same instrument and remains unverified.
- `sys_log` → `syslog` (the former table does not exist) and `sn_aia_admin` → `sn_aia.admin`
  across the design docs (R-6).

### Changed
- **R-3 amended.** The same probe ran 19 tool calls on keynexus01 and 5 on gpinst01, neither
  capped — so the difference is instruction adherence, not harness capacity. Consequence:
  premature completion reports as `completed`, indistinguishable from a genuine finish, so the
  benchmark needs a completeness measure and not only a correctness score.

---

## 2.0 — 2026-07-30

Re-aim: *ServiceNow Platform Assistant* becomes **Foundry Troubleshooter**, the in-instance
diagnostic half of the Foundry build→diagnose loop.

### Changed
- Harness strategy set to **tools-first, benchmark-gated** (`ARCHITECTURE_DECISIONS.md`
  Decision 0.5, confirmed by the design spar in `DESIGN.md` §1). The load-bearing component is
  the benchmark, not Agent Doctor: native-first is not "native is right", it is
  "native is cheap to falsify".
- Evidence Bundle collector promoted to Phase 1a as a harness-agnostic core — it doubles as the
  doctor-down detector and the benchmark de-risker (`DESIGN.md` §2.1).
