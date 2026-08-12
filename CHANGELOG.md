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

## 2026.08.1116 — 2026-08-11

**The §AQ floor is measured: AQ-1 and AQ-2 both PASS, no revert trigger fires (#191 part 2, done).**
Measurement only — no `src/` change. Evidence
`benchmark/raw-evidence-v15-aq-floor.md`, verdict `benchmark/DECISION.md` §AR.

- **AQ-1 (primary): 4 of 4** reps record at least one tool call, against a 0-of-4 baseline
  (predicted ≥3 of 4). **AQ-2: 2 of 4** produce a `fix_report` that passes validation (predicted
  ≥1 of 4). All four carry the `empty_trail` hold.
- **No revert trigger fired.** Zero runs finished `partial`; **0 of 4** took the `capped:true` exit
  even though every rep spent both holds — R1's trail-check-before-cap ordering released them as
  genuine compliance; the hold text names no tool.
- **#191's headline is refuted.** *"Files a fix_report with zero tool calls, so the
  two-distinct-sources rule can never be satisfied"* — 4 of 4 now call tools, 2 of 4 satisfy the
  rule. The other 2 still fail it at one distinct source, which is a report-quality question this
  change never claimed (§AQ6).
- **Unpredicted second-order effect (§AR2).** After the floor fires, the model stops claiming a
  blanket `SWEPT` and declares layers honestly `NOT_SWEPT` — which makes the **pre-existing `gaps`
  hold reachable**. The floor restored the operand the rest of the gate was missing, not just one
  tool call.
- **§AQ2 property 5 verified live**, not inferred: the floor's hold block appears in exactly four
  `sys_generative_ai_log` prompts, one per run, so it does not survive the compliant dispatch.
  Corollary: **#196's stale-HOLD defect does not reproduce on the floor path** and is now unblocked.
- **AQ-4 is recorded `not exercised`, not passed** — every rep ran the no-execution path, so the
  tripwire had no `execution` row to fire on. An unrun tripwire is not a clean one.
- **§AQ3's cost is now live:** a v15+ custom gate figure may be reported absolutely and may **not**
  be differenced against v12/v13/v14. No figure is claimed here — no scorer ran (§AQ4 ruling 6).
- **Deployment finding that outranks the pass (§AR5).** `b6d2abe` was merged but **not deployed**;
  gpinst01 was running code older than both #191 commits, caught only by the pre-flight content
  probe. `sys_updated_on` on this app's script includes **does not move on install** — `PaAgentLoop`
  read `2026-08-02 05:15:25` before and after an install that changed its content. Trust neither
  the version string nor the row timestamp; probe content.

---

## 2026.08.1115 — 2026-08-11

**The depth-gate empty-trail floor, built to §AQ (#191 part 2b).** `src/server/PaAgentLoop.js` +
`test/PaAgentLoop.test.js`. **This ships the CODE. It does not run the pass** — AQ-1 through AQ-4
are unmeasured, and nothing here may be quoted as evidence for or against them.

- **The floor.** At the `open.length === 0` allow and nowhere else: if the release set is empty,
  hold with `kind: 'empty_trail'`. Everything above that line enforces a gap the model **admitted**
  — which is the design (§H8 item 3) and also the hole, since a draft that admits nothing is
  unholdable. `unsweptGaps` counts only `NOT_SWEPT`, so `TR1000315`'s layers 2-7 `SWEPT` on zero
  tool calls declared nothing and released the gate permanently.
- **All eight §AQ properties implemented and individually tested**, including the three the PR #194
  review added. The two that were load-bearing: **`_holdNote` gained its own branch** — without it
  an `empty_trail` hold falls through to the gaps wording and renders `layer(s)  declared
  NOT_SWEPT` with an empty list and a false claim, leaving a floor hold byte-indistinguishable
  from a degenerate `gaps` hold and making AQ-3 and revert trigger 1 unmeasurable; and
  **`_holdActive` gained a floor clause** (`_holdActiveKind`) — the I1 clear tests
  `_anyOf(_heldTools, …)`, the floor leaves `_heldTools` null, so without it a model that complied
  by calling a tool would carry *"a terminal action is not available yet"* into its next prompt,
  on the exact turn AQ-1/AQ-2 measure.
- **`_holdBlock`'s new branch names no tool, and the protection it does NOT have is stated in the
  code.** That branch returns early and renders no model-authored text, so `_scrubToolNames` has
  nothing to strip and §H8 item 3 rests entirely on the authored wording. It says evidence is
  required and that a tool is how you get it; it never says which.
- **`_depthGate`'s return contract updated in the same commit**, per §AQ property 7 — including the
  consequence that is easy to miss: **`gaps: []` no longer implies ALLOW.** Read `hold`, never the
  gap list.
- **One existing test changed, deliberately and in the open.** I2 ("an empty recorded release set
  does not deadlock the run") passed `tools: []`, incidental to what it tests — its property is
  that an empty **recorded** set (`_heldTools`) does not latch sticky, nothing about the trail.
  Under the floor an empty trail holds on its own account, which would have masked I2 behind a
  different mechanism. Its fixture now supplies one tool, keeping the first hold identical (the
  recorded gap's `tools` is `[]`, so no trail can close it) while letting the second draft reach
  the allow I2 exists to assert. The empty-trail-does-not-deadlock case is covered separately by
  the §AQ property 1 cap tests.
- **The floor CORROBORATES, and the first cut did not — the same defect part 1 fixed, in the
  collaborator written second** (caught in `/code-review` on PR #195). Testing
  `release.length === 0` alone convicts on an empty trail, and an empty trail is not proof the run
  called nothing: `no_audit_rows` reads identically for a **systematic audit write loss**, and
  under the strict release rule a real, audited, non-retrieving call empties `release` too. The
  result was the harness making **two contradictory claims about one run** — `_auditContext`, one
  function up in the same iteration, writing `audit trail LOST WRITES — this run dispatched 1 tool
  call(s)` while the gate floored that same run for having called nothing and spent the whole
  `MAX_HOLDS` budget on the false charge. Now `release.length === 0 && _dispatchCount === 0`, the
  identical rule part 1 established. Compatible with §AQ property 8 — the floor still reads
  `release`; the conjunct only narrows it.
- **The hold text now asserts only what the branch has established.** It claimed *"Your draft
  accounts for the seven layers"*, which `_safeGaps` cannot support: that returns `[]` both for a
  complete sweep and for a degraded `PaFixReport` (its documented catch path), so the claim may be
  false — and it silently reversed `_safeGaps`' fail-open contract. A hold block that misstates the
  run's own facts is the wrong instrument for measuring evidential honesty.
- **One review finding deliberately NOT fixed here, and filed as #196.** `no_layer_report` shares
  the `_holdActive` defect exactly (it also records nothing, so `_anyOf(null, …)` is false) and the
  one-token fix now exists. §AQ property 5 scoped it out explicitly, and that scoping is not
  bureaucratic: `no_layer_report` is part of the scored instrument, so fixing a second path here
  would widen the instrument change beyond what was pre-registered — the §AO3 mistake arriving
  through the door §AQ was written to close. #196 recommends landing it **after** the four reps.
- Verified by jest only: **33 suites, 1717 tests** (15 new). **Not installed, not exercised against
  gpinst01, and the four §AQ reps have not been run** — the pre-registered predictions remain open.

## 2026.08.1114 — 2026-08-11

**Pre-registration — the depth-gate empty-trail floor (#191 part 2).** `benchmark/DECISION.md`
**§AQ**. Documentation only: **no code changes, and none are permitted until this section is
merged.**

- **Why it needs a pre-registration at all.** The floor changes `_depthGate`, which v13 (§AJ) and
  v14 (§AO) were both scored against. §AO3 is the cautionary case one pass back: the operator
  changed the scorer instruction and the v13→v14 determinacy *comparison* was voided even though
  both passes' absolute figures stood. A silent gate change does the same thing to the custom
  arm's gate figure.
- **The change, in one line:** an empty release set cannot support a terminal report, whatever
  `layers_swept` claims — sitting **below** the `MAX_HOLDS` cap (R2's lesson applied, not
  re-learned: a hold path the cap cannot reach rides to `MAX_ITERATIONS` → `partial`, which is
  C1's pre-registered revert trigger), recording nothing so it never latches sticky, intercepting
  only the `open.length === 0` allow, and **naming no tool** so §H8 item 3 survives.
- **The cost is declared in advance rather than discovered afterwards:** the v15 custom gate figure
  may be reported absolutely and **may not be differenced against v12/v13/v14**. The native arm
  does not run this harness, so the native series stays continuous and §AD7 still requires both
  arms be quoted together.
- **Four predictions filed against a 0-of-4 baseline** (v14 rows 06/08 died at the parser;
  `TR1000315`/`TR1000316` died at validation). AQ-1 is primary (≥3 of 4 reps record a tool call);
  AQ-2 is deliberately weak, because whether the model then writes a citable report is a
  *correctness* question this change does not claim to answer (§AC8, unamended). AQ-3/AQ-4 are
  tripwires that count toward nothing. **No gate-figure prediction is filed**, so Ruling 6 forbids
  claiming one afterwards.
- **The spec listed the properties a review may check, and the review found three more — that is
  the finding, and it is recorded rather than quietly folded in.** `/code-review` on PR #194
  raised six items against the first draft, all six accepted after verification against source,
  and two of them made this section's own predictions **unmeasurable**: (a) `_holdNote` branches
  only on `no_layer_report`, so a floor hold would emit `layer(s)  declared NOT_SWEPT` — an empty
  list and a claim that is false on this path — leaving a floor hold byte-indistinguishable from a
  degenerate `gaps` hold, so AQ-3 and revert trigger 1 could not be evaluated at all; (b) the I1
  `_holdActive` clear tests `_anyOf(_heldTools, …)` and the floor deliberately leaves `_heldTools`
  null, so a model that complies by calling a tool would still carry *"a terminal action is not
  available yet"* into its next prompt — I1's own defect on a new path, landing on the turn AQ-1
  and AQ-2 measure. Both are now enumerated properties with specified behaviour, alongside the
  `_depthGate` return-contract update.
- **Two logical defects in the section's own instrument, both fixed.** Revert trigger 2 read "the
  capped-release rate rises above its v14 level", and the comparable v14 rows issued **no holds at
  all**, so the baseline was 0 and *any* single non-compliant rep would have fired it — while AQ-1
  predicts ≥3 of 4, making one non-compliant rep a **predicted-pass** outcome that trips a
  no-re-litigation revert. Now bounded at >1 of 4. And "baseline is 0-of-4 on every count" was
  wrong for AQ-3/AQ-4: they are negative tripwires, trivially *satisfied* 4-of-4 before a floor
  existed, and the sentence inverted them into starting failed so any non-firing would read as an
  improvement the floor earned. Scoped to AQ-1/AQ-2.
- **Three revert triggers, no re-litigation**, including the one that would prove the placement
  argument wrong (`partial` with a floor hold in the transcript).
- `MAX_EVIDENCE_RETURNS` (`0`, §W6) and `REQUIRE_RETRIEVAL_TO_RELEASE` (`false`, §Y6/§AL4) are
  both **frozen** and explicitly outside what this section may pull.

## 2026.08.1113 — 2026-08-11

**An empty audit trail is an answer, not a degradation (#191, part 1 of 2).**
`src/server/PaAgentLoop.js` + `src/server/PaFixReport.js` + both test files. Validation layer
only — the depth gate is untouched, so §Y6's bar and `REQUIRE_RETRIEVAL_TO_RELEASE` are as v13
and v14 measured them.

- **Root cause, from the model output itself** (`sys_generative_ai_log` `af199457…`, turn 1 of
  `TR1000315`): the model filed a terminal `fix_report` on its FIRST reasoning turn with zero
  tool calls, declaring layer 1 `UNAVAILABLE` and **layers 2-7 `SWEPT`** with empty reasons.
- **Why the depth gate allowed it, and why #191's stated candidate is withdrawn.** The issue
  pointed at the unreadable-trail short-circuit (`_depthGate`, `:1806`), which allows without
  setting `_gateReleased`. That path never ran: the trail was readable and empty. The allow came
  from the no-declared-gap branch — `unsweptGaps` counts only `NOT_SWEPT`, so a blanket false
  `SWEPT` declares no gap, `open.length === 0`, and the gate released permanently. **The gate is
  not malfunctioning**: it enforces *admitted* gaps by design (§H8 item 3 — the harness must
  never name a tool itself), and a report admitting nothing is unholdable by construction.
- **The defect is that the check written for exactly this draft could not fire.**
  `_checkSweptClaims` (#79b) exists to refute a `SWEPT` claim the trail does not support. It
  returns early on `!ctx.auditEnabled`, and `_buildCheckContext` required a **non-empty** tool
  list — so a run that swept nothing was precisely the run whose false sweep claims were
  unfalsifiable. Upstream, `_auditContext` mapped `no_audit_rows` to `auditAvailable:false`,
  making the combination unreachable in the first place.
- **Both halves fixed, and the rationale being overturned is named.** `_trailTools` has always
  read `no_audit_rows` as *readable with zero tools*; `_auditContext` did not, on the reasoning
  in its sibling's header — "for #79b's citation cross-check that distinction does not matter,
  an unverifiable citation and an unsupported one are both do-not-convict." That holds for a run
  that can still gather evidence and **fails for a terminal report**, where the trail proves the
  sweep claims false rather than merely unverified. `no_audit_rows` now reaches validation as an
  available trail answering the empty set.
- **Finding 3 (2026-08-02) is amended, not discarded.** It lumped "empty list" in with
  "malformed list" as one failure shape. Those now split by *why* the list is empty: a raw `[]`
  is the trail answering (**check**); entries that all normalize away, or a non-array, are a
  context this code cannot interpret (**skip**). Finding 3's actual safety property — an
  uninterpretable context convicts nobody — is preserved exactly. Genuine degradations
  (`glide_unavailable`, `query_failed`) still fail open, with the transcript note unchanged.
- **`no_audit_rows` alone is NOT proof of zero tool calls, and the first cut of this fix assumed
  it was** (caught in `/code-review` on PR #193). `PaAuditLogger`'s own header names the other way
  to reach zero rows — a **systematic write loss**, every row for the run gone (`_write` swallows
  `insert_failed`; the reader skips rows whose `tool_name` came back blank) — and relied on that
  case failing open. Passing the reason through blindly would have convicted a run that really did
  call tools and really did cite what they returned: #78's fail-closed defect, arriving through the
  one door the module exists to guard. **The empty trail is now corroborated against a fact the
  loop holds itself and the audit table cannot corrupt** — `_dispatchCount`, counted in
  `_dispatchTool` before dispatch (attempts, so every way it can be wrong falls toward not
  convicting) and reset per run. Zero dispatched + zero rows **agree** → the trail answered, checks
  apply. Any dispatched + zero rows **disagree** → writes were lost, checks skip, and the
  transcript records `audit trail LOST WRITES` rather than a generic degradation, because a run
  that dispatched tools and left no rows is an escalation, not a quiet run. `PaAuditLogger`'s
  docblock — the source of truth that argued the false premise ("a run that reached a fix report
  necessarily called at least one tool") — is corrected in the same commit.
- **Scope limit, stated plainly.** This makes the run fail for the *true* reason and names the
  real defect to the model; it does not on its own make the arm produce a report, because the
  tool-less repair turn still cannot gather evidence (`MAX_EVIDENCE_RETURNS: 0` is §W6-ruled and
  deliberately untouched). Part 2 — a depth-gate floor that holds a terminal action on an empty
  trail regardless of what `layers_swept` claims — **changes scored instrument and is gated
  behind its own `DECISION.md` pre-registration.** Not shipped here.
- Verified by jest only (1699 tests, 33 suites). No live re-run: the fix changes which problems a
  rejected report carries, and both measured runs were already `failed`.

## 2026.08.1112 — 2026-08-11

**The retry answers the failure it actually got (#188).** `src/server/PaLlmProxy.js` +
`test/PaLlmProxy.test.js`. Deployed to gpinst01; v14 is merged, so §T9's `src/` freeze is lifted.

- **Root cause, from the model output itself** (`sys_generative_ai_log` `09c46b8f…`, `a5c4ab8f…`
  for v14 rows 06/08): the model collapsed the two-level envelope and put a TOOL NAME in the
  action slot — `{"action":"agent_config","args":{…}}`. `_parseResponse` is right to reject it;
  the action vocabulary is `tool_call | answer | fix_report`. **The parser is not the defect.**
- **The defect is the retry.** `_buildRetryPrompt` answered *every* parse failure with formatting
  advice ("JSON only … no prose, no markdown fence"), and that response was already flawless JSON
  with no prose and no fence. Told to fix what it had not got wrong, the model returned a
  **byte-identical** response on both runs. The `unknown action:` branch now names the offending
  value, restates the legal vocabulary, and shows the rewrap. Kept free of any `PaToolRegistry`
  dependency — the guidance is conditional ("if X is a tool"), so it is also correct for a
  hallucinated name.
- **Two of #188's premises did not survive and are withdrawn.** `agent_config` was never a legal
  *action* (rows 02/04 used it as a *tool*, a different slot), and prompt assembly does **not**
  differ by request shape — `_buildPrompt` is single-sourced, pushing `promptBlock` and
  `_responseContract()` unconditionally. The parser is in `PaLlmProxy.js`, not `PaAgentLoop.js`.
- **Attribution limit, stated plainly.** Two post-fix seed-05 reps (`TR1000315`, `TR1000316`) both
  cleared the parse layer — but **neither collapsed the envelope, so the repaired branch was never
  exercised live.** The improvement is proven by unit test, *not* attributable to this change by
  the live runs. The 2/2-then-0/2 split suggests the collapse is stochastic rather than
  deterministic; four runs cannot settle that.
- **Review of PR #192 found the same defect in five more slots, all fixed here.** The sibling
  structural failures (`tool_call is missing a tool name`, `answer is missing text`, `fix_report
  is missing a report object`) were still getting formatting advice for non-formatting problems —
  including `{"action":"tool_call","args":{…}}`, the *nearest neighbour* of the observed collapse.
  They now name the missing key. In the new branch itself: a legal action mangled by invisible
  whitespace trimmed back to a legal value and produced the self-contradiction *"tool_call" is not
  one of tool_call/answer/fix_report*; an offender containing a quote made the **exemplar itself**
  invalid JSON (now `JSON.stringify`d); a non-string action produced an `[object Object]` lecture
  (now falls back to generic); and `.` could not cross a newline, so a multi-line action value
  bypassed the branch (now `[\s\S]` with an 80-char cap).
- **Incidental, found while testing:** `_parseResponse` slices from the first `{` to the last `}`,
  so an array wrapping one object parses clean and `parsed value is not a JSON object` is
  **unreachable** through `reason()`. Its advice mapping is kept as defensive cover and asserted
  directly rather than through a fabricated end-to-end path.
- **A second, distinct blocker found and NOT fixed here.** Both post-fix reps reached fix-report
  validation and failed the **two-distinct-sources evidence rule**, having filed a report with
  **zero tool calls** (no `x_snc_troubleshoot_audit` rows), so there were no sources to cite.
  #188's headline — the custom arm cannot diagnose a no-execution scenario — **still stands**;
  the collapsed envelope was the first of at least two causes. Filed separately rather than
  fixed alongside, because the remedy touches the depth gate and the gate is scored instrument.

---

## 2026.08.1111 — 2026-08-11

**The smoke gate keeps its target; its second answer is recorded, not binding (#185).** Ruling in
`DECISION.md` §AP. Documentation and guard only — no `src/` change, no instance change.

- **Premise re-verified live on gpinst01 before ruling.** `sn_aia_agent`
  `601672d32b1a83d0f243fed2ce91bf3e` returns **0 records**; the execution plan and its 11 tasks are
  intact. One fact the issue did not carry and which decided the options: **the plan's own `agent`
  and `usecase` reference fields are empty too**, so the agent sys_id survives only inside the error
  JSON in the agent-role message.
- **The degradation is wider than the issue reported, and code review caught it: layers 2, 3 AND 7
  are unsweepable, not layer 2 alone.** `agent_config` is the only tool for all three, and the
  specimen's `sn_aia_tool` (`de06be5f…`) and `sn_aia_agent_tool_m2m` (`3e16b69f…`) rows went in the
  same Phase 0 cleanup (both live-verified at 0 records), while the probe run created no
  `sn_aia_usecase` at all. **This gate can never demonstrate a layer-2/3/7 sweep** — it demonstrates
  layer-1 error mining, which is what it was chosen for.
- **The binding criterion is unchanged and singular** — `script_error` citing
  `context_processing_script` line 42, both arms. The deleted-agent shape becomes a documented
  second known answer that is **explicitly unscored**: an arm reading `empty` as a privilege gap is
  recorded in raw evidence, not failed. **A gate checks instrument readiness; a rubric checks
  subject quality** — promoting it would have let a poorly-performing arm veto the pass (v14 would
  have been blocked) and biased every pass toward firing only when the arms had already done well.
- **A control probe is now part of the gate.** Seed 02's agent (`cd050d48…` → `Seed 02 Request
  Router`) distinguishes fixture rot from a real permission regression, with the two look-alikes
  named: a bad field name reads as `Access denied` on this instance, and a table with no ACLs denies
  admin too (Build Rule #42).
- **Guard widened:** the agent sys_id is now a `blind-rule-tokens` entry on the gate — swept clean
  across all 16 model-facing sources.
- **One inconsistency fixed in passing:** the Task 12 pre-flight record's weaker reading of the gate
  ("run to terminal with valid outputs, not that they diagnose correctly") is marked as that pass's
  own reading rather than protocol; v13 and v14 both applied the known answer.
- Cross-references added where the specimen is cited: `DESIGN.md` R-16, `docs/LOW_LEVEL_DESIGN.md`
  §5 smoke-test block, `docs/PREFLIGHT_FINDINGS.md` probe-cleanup table, and **both** build briefs
  (`PaToolAgentTrace`, `Phase1a_VerticalSlice`).

## 2026.08.1110 — 2026-08-11

**v14 — the out-of-sample pass, scored (#175).** Verdict in `DECISION.md` §AO; scorecard
`benchmark/scorecard-v14.md`. Twenty runs fired, twenty packets scored by independent blind agents,
zero voids.

- **Primary outcome: 12 of 12 out-of-sample rows returned `ambiguous = no`, zero column flags.**
  All four meaningful predictions confirmed (AN-1a, AN-1b, AN-2, AN-3); both tripwires refuted
  (AN-4, AN-5). AN-6 confirmed at 0 voids and 10 valid rows per arm. This discharges §AJ6's closing
  item — the §AG/§AH clauses were tested on seeds they were not fit to, eight of the twelve rows
  drawn from taxonomy entries selected five days before §AG existed.
- **Gate, both arms together (§AD7): native 5/10 = 50.0% (45/60), custom 0/10 = 0.0% (3/60).**
  Ruling 3's milestone is not met. Ruling 6 governs — no gate prediction was filed, so none may be
  claimed either way.
- **The finding that outranks the result (§AO2): determinacy came apart from correctness at full
  marks.** Row 09 scored 6/6, cleared the gate, was not flagged ambiguous, and proposed repointing a
  query at a `type` column that does not exist — a fact stated in the packet's own seed spec. Row 11
  filed "the table is genuinely empty (0 rows)" against a table holding 22 and proposed the exact
  fix target its seed scores 0. No score was changed and none should be; the manifest was frozen at
  dispatch.
- **Disclosed defect of this pass (§AO3): the operator changed the scorer instruction.** v14 asked
  every verdict for an `### ambiguity` section (v13 required it iff the flag was `yes`, which is what
  gave v13 two independent signals), and added "do not flag `ambiguous` merely because a judgement
  was effortful" — a clause v13 did not carry, licensing behaviour v13's own scorecard recorded as a
  limitation. **The absolute determinacy figures stand; the v13 → v14 determinacy comparison does
  not.**
- **Packet generator: `NO_REPORT_SPLIT`.** A `failed` terminal is now satisfied by a validator
  rejection **or** an explicit no-report marker. Rows 06 and 08 failed before any report body
  existed, and the only failure slot was labelled `VALIDATOR REJECTION`; using it would have told
  twenty scorers the fix-report validator ran when it never did. Additive — carrying both markers is
  itself a refusal. §AN7 items 11 and 14 discharged, the latter pinned by a test rather than by
  having run the CLI once.
- **Two seed-08 fixtures discarded and re-produced solo**, with the reasoning retracted twice in
  `raw-evidence-v14-out-of-sample.md` §2.6/§2.7: concurrency was blamed for a slowdown it did not
  cause, a starvation diagnosis was raised against a run that had already finished, and
  `PATCH sn_aia_execution_plan.state` proved cosmetic. Row 01 was proposed for voiding on that
  diagnosis and the proposal was withdrawn on measurement (279s against v13's ~280s expectation).
- **Operational corrections worth more than the pass:** read terminal state from
  `servicenow_aia_trace`, **not** the plan row — they disagree and v13 §3.3 / §AC7's "or the plan
  row" is wrong; judge liveness from instance timestamps, never elapsed wall clock estimated in
  conversation; a bad field name reads as "Access denied" on this instance and is discriminated only
  by a bare query carrying **neither** `query` nor `fields`.
- **Filed, not fixed:** #187 (seed-07's bar cites `response_length` on `sn_aia_tools_execution`, a
  column that does not exist — the field is real but derived by the harness's own `agent_trace`).

## 2026.08.1109 — 2026-08-11

### Added — v14 stage 1: the pre-flight and the smoke gate, both arms (#175, PR #184)

- `benchmark/raw-evidence-v14-out-of-sample.md`. **No scored row is spent**; §AN6 seals every tally
  until all twenty packets are returned.
- **Both arms pass the known-answer gate** on execution `c9d63a932bda8b9417a6ffbeee91bfd0`: custom
  `TR1000292` in **12s**, native plan `e7a653c3…` in **192s**, both naming `context_processing_script`
  **line 42** (native as RC-2, confidence CONFIRMED).

### Found — the code under test is `5fb7648`, the SAME commit v13 ran

- `git log 5fb7648..HEAD -- src/` is **not** empty, but its one commit (`41c0ce6`) is 45 comment
  lines with zero executable change. **The harness code is held constant across v13→v14**, so
  §AN1a's "not single-variable" excludes the product code. What remains is the platform patch, the
  distribution, and fixture state.
- **The app was deliberately NOT rebuilt** to make that log literally empty: Build Rule #40 would
  deactivate the NASK skills and #21 would duplicate ACL rows — perturbing the instrument to satisfy
  a check about the instrument, and spending the one variable that is provably constant.

### Changed — three inherited claims corrected by measurement

- **§AN7 item 6 names "seed 04's capability sys_id"**, but §AN2 excludes seed 04. Copy-forward from
  §AI7, whose set was 01–05. Executed against §AN2's five; the slip recorded, not reinterpreted.
- **v13's clock note is one level off.** The UTC−4 offset belongs to the **access path**, not the
  `sn_aia_execution_plan` table: same plan reads `19:08:58` via the Table API and `15:08:59` via
  `servicenow_aia_trace`.
- **`sys_updated_on` carries no install information on this instance** — a third record class on
  which records reading 2026-08-02 demonstrably hold Aug-10 code.

### Fixed — eight review findings, three of them items ticked without the check (`/code-review`, PR #184)

- **Item 14 was ticked green** on the synthetic `v98` path; `buildAll('v14')` is called by nothing
  and cannot run before the pass produces its inputs — the exact substitution #176 made invisible,
  and the failure item 14 cites as its reason for existing. Now deferred to packet build with item 11.
- **Item 8's custom path** was declared discharged by the smoke run; that run made 2 tool calls,
  which proves dispatch but enumerates nothing. Recorded as a standing limitation.
- **"Installed `src/` is exactly `src/@5fb7648`"** rested on three greps across two of eighteen
  script includes. Narrowed: the delta is bracketed, not exhaustively verified.
- Items 12–14 misattributed wholesale to `0c4f36c` (item 14's coverage landed in `b36a09d`); the
  header enumerated two uncontrolled movers where fixture state is a third; "clean 4-hour offset"
  described a 3h59m59s pair; "both new specs" where three were added.

### Filed — two follow-ups, neither folded into the pass

- **#183** — §AL cites `target_table` as written on every call, but `PaAuditLogger:372` is a
  conditional write and the column is blank in practice. **The ruling stands** (its other support,
  `toolCalls()` returning the payload, holds); the citation does not. Blocked on the `src/` freeze.
- **#185** — the smoke gate's agent record `601672d3…` is **deleted**, so layer 2 is permanently
  unsweepable on the README known-answer target and the gate reliably invites the privilege-gap
  misdiagnosis native produced. No scored row is at risk; the seed agents were probed and are
  readable.

---

## 2026.08.1108 — 2026-08-11

### Added — the out-of-sample seed set, qualified, and §AN pre-registered (#175)

- **`benchmark/DECISION.md` §AN — the out-of-sample pass, pre-registered before run 1.** Appended,
  not edited: `git diff` reports **347 insertions, 0 deletions**, so §A–§AM are unmodified as the
  section claims. Fixes the distribution (3 new + 2 anchor), the out-of-sample / anchor partition,
  eight advance rulings, four meaningful predictions plus two declared tripwires, a stopping rule
  that seals the partition as well as the tally, and a fourteen-item pre-flight.
- **Three new seeds, built, installed and measured on gpinst01.** Seed 06 — the queried column does
  not exist (layer 4 `data_schema`); seed 07 — unbounded tool return (layer 3); seed 08 —
  non-terminating tool contract (layer 3). Anchors are seeds 02 and 05, chosen on the stated basis
  that they are the two seeds the §AG/§AH clauses were **most fit to** (seed 02 drew 5 of v12's 14
  flags across all four of its rows; seed 05 took the tiebreak on flagged-row count, the metric the
  primary prediction is measured with).
- **`benchmark/raw-evidence-seed-qualification-06-08.md`** — fixture state only, claiming no result
  about either harness, in the seeds-02/05 pattern. Seeds are measured **before** the
  pre-registration names them, per that file's standard: *"a pre-registration binds you to what it
  asserts."*
- **`benchmark/v14-advance-rulings.json`** — Rulings 1, 7 and 8 in the `v12-advance-rulings.json`
  shape, so they reach the scorer in the packet and not only in the pre-registration (§AD5 / #160).

### Found — three measurements that change what the next pass may claim

- **The instance was upgraded between v13 and this pass.** `sys_upgrade_history`
  `b539b6432b220310f243fed2ce91bf45`, 2026-08-11 17:00:15 UTC: Zurich Patch 10 **Hotfix 3 → 4a**.
  v13's runs fired 12:54:57 → 14:38:37 UTC the same day, so the upgrade landed ~2h22m after its last
  row. **v13 is entirely a Hotfix 3 measurement and every later pass is Hotfix 4a.** #175 asked that
  non-single-variable status be stated in advance rather than discovered at scorecard time; §AN1a is
  that statement, and the anchor arm exists to separate a distribution effect from a platform one.
- **The install path writes record values without touching audit fields.** Seed 05's m2m gate read
  `active=false` after install while `sys_updated_on` still read 2026-08-02 — *earlier* than the
  2026-08-09 qualification that read it `true`. A REST PATCH to the same record moved the timestamp
  immediately. This confirms the anomaly §AI1 carried unexplained as pre-flight item 11:
  **`sys_updated_on` cannot detect install-induced drift on this instance.** The gate was restored
  and verified by re-read.
- **`sn_aia.continuous_tool_execution_limit` does not bind.** It reads **25**; seed 08's
  qualification run made **27** calls to one tool. LLD §7's claim that the T6 construction is
  "guarded by" that property is not reliable as a bound — a second, independent reason the
  recursive-trigger variant was not built on a shared instance.

### Refuted — two specified seed constructions, both measured before being discarded

- **K26 T1 (ACL-trigger misalignment) does not reproduce under this benchmark's capture shape.**
  Built twice — `securityAcl: 'Specific role'` alone, then with `dataAccess.roleList` emitting
  `sys_agent_access_role_configuration` `action=limit_to_roles` — and both runs `completed`. T1 is
  **trigger-scoped**: it needs a trigger firing under a non-privileged *initiating* identity, while
  the benchmark captures seeds by direct REST invocation as admin, which passes
  `access_verification` (`isAccessAllowed: true`, 371ms). **Deferred, not abandoned.**
- **K26 T4's instruction-bloat half is unreachable on this instance.** Measured across three builds:
  9,762 chars → 4,770ms P95; 167,530 → 12,082ms slowest `gen_ai` step; 305,589 → **12,269ms**.
  Doubling the instruction moved the slowest step **1.5%** against a 15,000ms threshold — saturated,
  almost certainly by a prompt truncation cap. Lowering `LLM_SLOW_MS` would produce the flag and is
  forbidden in a pass that changes the distribution. The slot kept its K26 Lab 2 provenance and
  moved to the reachable half (tool output bloat, measured at **58,436 chars** against a 20,000
  threshold).
- **A calibration hazard, measured rather than theorised.** `instruction_bloat` fired at
  **15,154ms** on seed 07, whose instruction is ~330 characters, on a step that ran *before* the
  run's only tool call. `LLM_SLOW_MS = 15000` sits inside this instance's noise band. §AN4 Ruling 7
  fixes the disposition in advance and ships it into the packets.

### Changed

- **`test/blindRule.test.js` and `test/scorerPacketBlindRule.test.js` rosters extended to eight
  seeds**, pinned by name as both files require. The guard earned its keep on arrival: both new
  specs shipped an `[answer-key-pointer]` to the decision record — a relative link a model scorer
  could have followed into the answer key — and it caught them before merge.
- **Three answer leaks removed from the new agent `description` fields**, found in code review.
  Each named its own seeded defect ("the column it filters on does not exist"), and
  `PaToolAgentConfig` returns `sn_aia_agent.description` verbatim to both harnesses — so a run could
  have named seed 06's layer-4 root cause without a single `schema_lookup` call, inflating
  `root_cause_layer_correct` on exactly the twelve out-of-sample rows that are this pass's primary
  outcome. All three now use seeds 01–04's non-revealing "deliberately broken". **Note the blind-rule
  suite excludes `benchmark/seed-app/**` from its scan, so no guard fires on this class** — the
  model-facing surface of a fixture agent is currently unguarded.
- **`../raw-evidence-seed-qualification-06-08.md` added to `REDACTIONS`.** Without it the generic
  sweep strips the citation, plants `REVIEW_SENTINEL`, and `buildAll` refuses to write **any** v14
  packet — a failure that would have surfaced only after the twenty runs were spent. Verified by
  exercising `redact()` on all five pass seeds: zero unreviewed paths, no sentinel.
- **`v14-advance-rulings.json` given the coverage the v13 channel already had** — shape, per-seed
  rendering with cross-leak assertions, and the verdict/path lint that makes the generator refuse a
  build. 1,657 tests pass.
- **Build Rule #21 re-confirmed live on a new artifact.** The direct role sys_id survived verbatim
  into all nine emitted `sys_security_acl_role` records and resolved on the instance to
  `x_snc_tsbench.bench` by name, for both `securityAcl.roles[]` and `dataAccess.roleList[]`.

## 2026.08.1107 — 2026-08-11

### Fixed — a hold may not ship without its discharging call, and the rule binds a pass that can still comply (#178)

- **`unnamedHoldViolations` added to `benchmark/scripts/build-packets.js`.** Unconditional on
  `holds > 0`: the row must name a call **argument** in `note`, reading or no reading. §AL5's
  Ruling 3 had already settled the substance — if the targeting judgement is the rubric's (§AL3
  Ruling 2), withholding the call's argument withholds the evidence that judgement is made on.
  What #178 owned was **which passes it binds**.
- **The hole was live, not hypothetical.** #178 argued from a counterfactual; it did not need one.
  **v13 row 02 took a hold and carries neither `note` nor `operator_note`**, so
  `withheldFactViolations` — conditioned on `operator_note` — passes it in silence. It was
  dispatched to scorers with its hold unnamed and no guard said anything. §AM1 carries the
  cross-tab of both checks over v13's ten held rows.
- **Ruling: the boundary is authorability, and it is DERIVED (§AM2).** A delivery guard **refuses**
  on a pass whose `scoring-<pass>/` is empty — still being authored, so it can comply — and
  **reports** to `console.warn` on one that already holds packets. §T9 forbids editing a frozen
  manifest and forbids backfilling one to green a later rule, so a rule written after dispatch has
  no legal remedy there, and a gate whose only remedy is forbidden is a permanent red rather than a
  gate.
- **Why this is not the pass-scoped exemption #178 distrusted.** No list, no cutoff version. The
  reporting branch is reachable only by a pass that already dispatched its packets, and dispatching
  them required passing whatever gate was in force at the time. **A carve-out derived from a state
  the guarded party cannot enter at will is a different object from one written down as a name** —
  the §AL3 move (enforce only over operands the guarded party cannot author) applied to a guard's
  own scope.
- **Option 1 was refused on evidence, not preference.** #176 already left `buildAll('v13')`
  permanently throwing and nothing noticed, because no test or parity path calls it. Extending that
  to v12 would break the freeze tests, the terminal-state check, the advance-ruling delivery tests
  and #168's byte-identical `--pass v12` parity — to enforce a rule where nobody looks.
- **`--force` is not an escape hatch from it.** It overwrites the freeze check; a dispatched pass
  whose rows violate the rule cannot be rebuilt into its own directory at all, or the reporting
  branch — granted because there is no remedy — would itself become the remedy. Scratch rebuilds
  under `--out` are unaffected.
- **Two bounds, both load-bearing (§AM3).** Only `note` is read: `layers_swept` and `terminal` are
  measurements and `invocation` carries `x_snc_troubleshoot` on every row of every pass, so
  accepting them would let boilerplate discharge the requirement. And tool names do not count —
  section 5 prints `distinct_tools` on every packet, so *"schema_lookup answered the HOLD"* delivers
  nothing new. That is the #177 review's F1 applied in the opposite direction.
- **`readHolds` extracted and shared** by both delivery checks, so F6's fail-closed behaviour on an
  unreadable `holds` cannot regress in one of them alone.

### Costs, recorded rather than implied (§AM4)

- **Measured residual:** v12 row 20 clears the check on the word `sys_id` in its prose — a held row
  whose `note` names no call. Not fixed: the fix is a list of tokens that do not count, and no lists
  is this guard family's stated posture.
- **A warning nothing asserts is a report printed where nobody looks**, which is the failure #176's
  two same-direction guards already demonstrated. The frozen violations are therefore pinned **by
  row number** in the test suite: v12 rows 02/04, v13 rows 02/08/10/12/14/16.
- **The destructive `--force` branch is unit-tested, not driven end to end.** Driving it through
  `main()` means pointing the writer at real dispatched evidence; staging a throwaway
  `benchmark/scoring-v9x/` would flake the blind-rule suite's disk-vs-declared membership assertion
  from a parallel jest worker. `forceRefusal` is pure over the three facts `main()` holds and its
  truth table is the test.

### Not done, deliberately

- **No v12 or v13 value moves and neither manifest is backfilled** (§T9). That two v12 rows and six
  v13 rows fail a rule written after them is a fact about the rule's history.
- **v13's custom arm is not made assessable.** §AJ5a's qualification and §AL6 stand: the five
  off-fixture rows stay unassessed until a pass scores them with the argument visible. This closes
  the gap for the next pass and repairs nothing already scored.
- The v98 staged-pass fixture in `packetGeneratorPassSelection.test.js` patches its cloned rows 02
  and 04 with a note marked SCAFFOLDING — cloned into a pass with no dispatched packets they are
  authorable again, so the gate binds them. That patch is the rule working, not a workaround, and
  v12's manifest on disk is untouched.

### Verified

- `npx jest` → **33 suites, 1644 tests, all passing.** `benchmark/README.md` gains the fourth guard
  and the refuse/report table; `benchmark/DECISION.md` gains **§AM**.

---

## 2026.08.1106 — 2026-08-11

### Changed — the `layers_swept` HOLD is ruled target-blind by construction (#173)

**No behaviour change.** `DECISION.md` §AL plus two docblocks; no run was fired, no packet
re-scored, `scoring-v13/` untouched (§T9).

- **v13's five off-fixture HOLD discharges split into two causes, and only one had a lever.** Row 12
  (a barren `query_table` on the invented `sysrule_routing`) is the `REQUIRE_RETRIEVAL_TO_RELEASE`
  case; rows 06/08/10/16 discharged with *successful* calls on unrelated tables, which no existing
  mechanism touches. Treating the retrieval flag as "the fix" repairs one row of five.
- **The gate is target-blind by PROJECTION, not for want of data.** `PaAuditLogger` records
  `target_table` on every call; `_trailTools` projects the audit rows down to tool names before the
  gate sees them. The claim that the harness cannot see which table a call hit is false.
- **The ruling, and its reason: the second operand does not exist.** Nothing on the request states
  what the run is diagnosing in a comparable form — `_normRequest` yields free-form content and
  `r.execution` is consumed into the prompt as text. A targeting check in the loop would have to
  derive the subject from model output, and a gate released by an inference over model output is
  released by the model: #88's fabrication failure wearing a trail check's costume. **The release
  condition stays target-blind; the targeting judgement moves to the rubric** (§T3 / §A2.2), where a
  scorer holds the fixture and the calls at once. Precondition for ever revisiting: a structured
  subject field written by whoever *files* the run.
- **`REQUIRE_RETRIEVAL_TO_RELEASE` stays `false` — ruled, not deferred.** §Y measured 1 changed
  release in 64 (1.6%, Wilson [0.3%, 8.3%]); row 12 is a second instance of the bind case and does
  not clear §Y6's bar, since a retrospective bounds the rule's benefit without ever measuring it.
  Enabling it now would also confound #175 against v13's calibration. What would clear the bar is
  named: a prospective arm with its own pre-registration.
- **The discharging call's argument must reach the scorer**, which settles the substance of #178 and
  leaves it only its versioning question. §AJ5a recorded that all five arguments lived in
  `operator_note` and so reached **no** scorer in v13 — a second reason those four rows were never
  the harness's to answer.

## 2026.08.1105 — 2026-08-11

### Changed — §A3 carries the terminated-run void condition (#174)

- **A third void condition added to `benchmark/scorecard-template.md` §A3**: any seed, any harness,
  where the **platform** closed the execution `state: terminated` / `state_reason:
  execution_failed` **and no report body of any kind was produced**. An intact fixture does not make
  that a valid `0` — a `0` is a report that failed the rubric, and there is no report.
- **The boundary is narrow, and both adjacent cases are named as SCORED**: a report body that was
  produced and then rejected is a report (scored, `0` if it fails the rubric), and a run that
  exhausted a declared budget — tool ceiling, context, supervision stall, wander — is a run that
  failed, scored with `cause_of_death` recording how. The line is *the platform failed the execution
  → void; the run failed, however it failed → score it*. A provider outage with no report body is
  named as **undecided**. Review caught the first draft generalising past all of this and
  reclassifying five already-scored rows (v13 04/16, v12 08/14/20) — see `DECISION.md` §AK4.
- **The two properties that made v13's ruling sound are now requirements on the operator**, not
  remarks about one pass: the condition must be **symmetric** across harnesses, and it must be
  **recorded before the replacement run is fired**. §A3's definition was widened from seed-state
  only (*"the seed was not in the state its spec requires"*) to cover both ways a run can measure
  nothing, and the condition list now separates the two seed-state conditions from the run-state one.
- **§A3.4's floor checked, as #174 required.** Two clauses that lived only in the decision record
  are promoted alongside it, because a run-state void makes both live for the first time: the floor
  is read **per arm** (§AC2 / §AI2) — stated with the sizing premise it needs, since this template
  declares 10 rows total and a pass splitting those across two arms is under the floor before
  anything is scored — and it counts **unrecoverable** voids at the close of the pass, a void whose
  replacement is valid costing the denominator nothing.
- **`benchmark/scorecard-template.md` §A3 rule 2 now requires a declared per-arm re-run cap.**
  Without one a run-state void is always re-firable, so nothing is ever unrecoverable and the floor
  can never bite; "cannot be made valid" is now defined as a void the cap leaves unreplaced. The
  number stays with the pass; the requirement to declare one is standing.
- **Clause (b) rewritten to bind authoring a void condition, not applying a standing one** — as
  first written it refused the void on a terminated *last* row (tallies necessarily visible) while
  the same bullet refused the `0`, leaving the row with no valid disposition.
- **The two filled scorecards are annotated, not retrofitted.** `scorecard-agent-doctor.md` and
  `scorecard-custom-harness.md` embed the §A3 their rows were scored against; each now states that
  the standing rule has moved, what moved, that none of it governed those rows, and where the
  provenance is. Merging the new condition into them would silently restate which contract those
  rows were scored under (§AF1's principle, applied to a filled scorecard). §AK5.
- **Provenance is in `benchmark/DECISION.md` §AK, not in §A3.** §A3 ships inside the slice copied
  verbatim into every scorer packet, where `test/scorerPacketBlindRule.test.js` bans exactly the
  citation #174 asked for — a `§` pointer out of the rubric, a pass named by version, a repository
  path, and the past tense that says a run actually did this. The rule is written in
  provenance-free standing voice; §AK carries the citation to §AJ4 and to §4.1 of
  `benchmark/raw-evidence-v13-determinacy-check.md`, and states the general constraint: a rule that
  reaches a scorer cannot carry its own history.
- **No value moves (§T9).** No run fired, no packet re-scored, no instance touched. Row 05's void
  ruling stands as made. `scoring-v13/`'s twenty packets carry the old §A3 and stay frozen — the
  §AF1 no-clobber guard is what keeps them the record of what the scorers read.

## 2026.08.1104 — 2026-08-11

### Fixed — the unguarded half of §AF2: a call argument could hide in `operator_note` (#176)

- **`withheldFactViolations` added to `benchmark/scripts/build-packets.js`**, failing the build
  before any packet is written when a row with `holds > 0` carries an `operator_note` naming a
  platform identifier that nothing in that row's own scorer-visible text names.
- **What was unguarded.** §AF2's rule is two-sided — a scorer-facing field NAMES the argument of a
  call, and the operator's reading of it lives in `operator_note`, which renders nowhere. Both
  existing guards protected the *second* half (`registerViolations` keeps a reading out of a
  scorer-facing field; the delivery check keeps `operator_note` out of every packet). Nothing
  protected the half §AF2's own text calls **"not optional"** — that the fact arrives at all. Two
  guards pointing the same way read as coverage and were not.
- **How it failed.** v13 authored both halves into `operator_note` on **six of the seven rows**
  that took a hold and carried a reading, leaving `note` null on four. Section 6 rendered
  *"No run-specific notes."* directly beneath section 5's promise that a held call's argument
  "is named in section 6 instead" (`build-packets.js:449`, `:620`). Four of the five off-fixture
  rows §AJ6 asks about are unassessable as a result — and so is row 14, the **on-fixture control**
  that would have bounded them.
- **v12 is the worked example, not a casualty.** All seven of its `operator_note` rows delivered
  the argument in `note` first (row 06: `note` names `schema_lookup on incident.priority`,
  `operator_note` reads it), so the guard is **non-breaking** and the `--pass v12` byte-identical
  parity check (#168) is unaffected. v13's own row 18 followed the convention too — this was an
  authoring regression, not an ambiguous rule.
- **Deliberately broad, per the posture the sibling lint already declares.** The token shape cannot
  distinguish a call argument from any other identifier, so unrelated instrument commentary on a
  held row reddens the build (v13 row 18, measured). No exemption list — an exemption would be a
  second and silent way to be unguarded. Scoped to `holds > 0`, so a row that held nothing keeps
  its `operator_note` free for run plumbing, as the native rows' notes legitimately use it.

### Fixed in review — seven findings from `/code-review` on PR #177, all reproduced before fixing

- **The comparison set was wrong in both directions.** Comparing against `SCORER_FACING_FIELDS`
  flagged `schema_lookup` and `agent_trace` — tool names section 5 prints in *every* packet — and
  told the operator to pad `note` with boilerplate the packet already carried (F1). Comparing
  against the whole built packet was then tried and is worse: the embedded **seed spec launders the
  token**, so v13 row 14 passed — the on-fixture control, whose argument was withheld exactly like
  the four adverse rows. Now compares against that row's **own** scorer-visible text: the
  scorer-facing fields plus `distinct_tools` and `hold_text`.
- **Case-sensitivity bypass (F3).** The lowercase-only token shape scored ZERO on
  `Schema_lookup ran against Incident.priority, and against incident.assignmentGroup` — a
  sentence-initial capital and a camelCase field path, on precisely the v13 failure shape. Regex is
  now case-insensitive and matches are lowercased before comparison.
- **Exact set membership rejected a delivered fact (F4).** A `note` naming
  `x_snc_tsbench_routing.assignment_group` failed a reading that named the bare
  `x_snc_tsbench_routing`. Now a substring comparison.
- **English prose was reported as withheld identifiers (F5).** `e.g` and `i.e` were flagged, and no
  rewrite of `note` can name them. Dotted paths now require segments of 3+ characters; underscored
  identifiers are unaffected.
- **The scope test failed OPEN (F6).** `Number(row.holds) > 0` on a missing field yielded `NaN` and
  silently skipped the row, while section 5 rendered `Harness HOLDs: undefined`. An unreadable
  `holds` now **refuses**, like every other check in `buildAll`.
- **Name collision (F7).** `deliveryViolations` sat beside a pre-existing "delivery check" pointing
  the opposite way, and the README listed both as adjacent rows. Renamed
  **`withheldFactViolations`**.
- **Overclaim corrected, and the hole filed rather than papered over (F2).** The guard is
  conditioned on `operator_note` being present, so it enforces **consistency between two fields,
  not delivery as such** — the docblock, README and this entry previously claimed the §AF2
  requirement "that the fact arrives at all". Omitting the reading passes with `note` still null,
  and deleting the reading is the *cheapest* way to green a red build. The unconditional check
  reddens **v12 rows 02 and 04**, which took a hold and wrote no note, making it a change to a
  frozen fixture's contract and to #168's parity check — a §T9-adjacent decision, not a review-fix
  slip-in. **Filed as #178** and pinned as a measured property in the test suite.

Stated limit, unchanged: a **delivery floor, not a proof of sufficiency**.
- The register lint's remedy string now says to name the fact as well as move the reading, and
  points at this check by number.
- `benchmark/README.md` gains **"Authoring a row manifest: the fact and the reading are two
  fields"** — the rule, v12 row 06 quoted as the worked example, and all three guards in one table.
- Tests: `test/packetGeneratorParity.test.js` gains a `#176` block — v12 passes as authored, each
  of v13's six withholding rows fails, the v13 shape fails synthetically, delivering the argument
  clears it, and `holds: 0` rows stay out of scope. **33 suites, 1621 tests.**

### Not changed

- **§T9 governs.** No v12 or v13 value moves. `scoring-v13/` is not rebuilt — it remains the record
  of what the scorers actually read, and the v13 manifest is frozen evidence that was not
  backfilled to satisfy the new guard.

## 2026.08.1103 — 2026-08-11

### Added — the v13 scored pass, complete (#166)

- **Stage 3 fired and scored in one sitting**, interleaved by seed per §AI7, on build `5fb7648`
  verified by probe. Twenty rows terminal, twenty packets built, twenty independent scorers
  dispatched once. Artefacts: `benchmark/v13-rows.json`, `benchmark/v13-reports/`,
  `benchmark/scoring-v13/` (+ `results/`), `benchmark/scorecard-v13.md`,
  `benchmark/v13-ambiguity-flags.json`, and `DECISION.md` §AJ.
- **Primary outcome (AI-1, Ruling 4): 20 of 20 rows returned `ambiguous = no`** — against v12's
  8 of 20. Zero column flags (AI-2, AI-3). Two independent signals agree: every verdict table reads
  `no`, and not one verdict emitted an `### ambiguity` section.
- **All six predictions confirmed.** §AJ3 and §AJ6 state plainly why six-for-six is weaker evidence
  than it sounds: AI-5 was filed at ~97% prior by its own note, AI-4 and AI-6 bound shapes absent
  from v12 too, and AI-1/2/3 are close to an in-sample check — same seeds, same report formats, same
  instance the clauses were fit to.
- **Gate, both arms together per §AD7: native 4/10 = 40.0% (47/60); custom 0/10 = 0.0% (5/60).**
  Against v12: **native 6/10 = 60.0% (51/60); custom 0/10 = 0.0% (9/60)** — so the native arm
  **declined two rows**.
  Ruling 3's milestone is evaluated and **not met**. Per Ruling 6 no prediction was filed on the
  gate, so no gate prediction is claimed in either direction.
- **#155's fix is visible and did not move the gate.** Two custom rows were rejected by the
  validator on two different rules (unsupported sweep claim; evidence-count shortfall). Both scored
  0/6, as did four custom rows with accepted reports — **nine** of ten custom rows missed upstream, on
  `root_cause_layer_correct` (row 12 is the sole exception).

### Fixed

- **A void condition §A3 does not name.** Row 05 native's first attempt terminated
  `state_reason: execution_failed` with no report (495s, 18 tool calls, ceiling unreached, fixtures
  intact). §A3's definition is seed-state only. Ruled void under §4.1 of the raw-evidence file —
  **symmetric across both arms, and committed in `77d0d44` BEFORE the replacement fired**, so
  `git log -p` shows the rule predating the row it governs. 1 of 3 native re-runs spent.

### Fixed (#172 review)

- **The v12 baseline was published as v4's number, inverting the reported direction of change.**
  `scorecard-v13.md`, §AJ2 and this entry first said "native 3/10 = 30.0%" — that is §O2's v4
  figure. v12's native result is 6/10 = 60.0%, 51/60, pinned by `test/scorecardV12Tallies.test.js`.
  v13's native arm **declined** 60.0% → 40.0%; it did not improve. §AJ2's resolution argument is
  rewritten rather than patched.
- **"Eight of ten custom rows" was v12's count** — in v13 it is nine of ten.
- **`test/scorecardV13Tallies.test.js` added**, the counterpart the v12 tally test's own header
  argues for. Every mechanical property of the v13 primaries was already correct; both errors lived
  purely in prose about them, the one layer no existing guard watched. Deliberately a second
  independent recomputation rather than a shared helper.
- **`build-packets.js` no longer asserts pass-level facts it cannot see.** It emitted, hardcoded and
  unconditional, *"No row in this pass was void, and no arm used any of its permitted re-runs"* —
  true of v12, false of v13, and shipped to all twenty blind scorers. It now states only this row's
  terminal state and whether this row is a replacement. **`scoring-v13/` is NOT rebuilt**: those
  files are the record of what the scorers read, frozen on the same ground as `scoring-v4` and
  `scoring-v12`. Disclosed at §AJ5a with the second defect found alongside it (`operator_note`
  renders nowhere, so two rows with the same report-assembly fact presented differently).

### Verified

- Three guard edits made as part of building the packets, not after: `PACKET_SETS` gains
  `scoring-v13` (`scanned: true`, `packets: 20`), the declared-membership literal lists four sets,
  and `npm test` is green **before** any packet reached a scorer. **32 suites, 1600 tests.**
  `scoring-v12/` untouched — no `--force`.
- §AI7 item 11 confirmed in the artefact: Ruling 1 renders in full into all four seed-05 packets.

## 2026.08.1101 — 2026-08-11

### Fixed

- **`benchmark/raw-evidence-v13-determinacy-check.md` carried two copies of §2.4/§2.4a/§2.5/§2.6/§2.7**
  — the corrected post-review block and the superseded pre-review draft it says it deleted, with the
  stale copy placed **last**. An operator reading linearly therefore finished on the withdrawn claims:
  that *"both seed-01 attempts stalled"*, that the retry's outcome was *"unresolved and the first
  thing the next session must check"*, and that seed 05 was *"blocked on seed 01 rep 2"*. All three
  are false — §2.3's table records the retry completing in 67s and §2.6 records seed 05 produced last. The
  #166 handoff comment was written from the stale block and repeats all three. Duplicate deleted.
- **A still-cited note was collateral damage of the #169 review's cut.** The read-staleness note
  (a `minutesAgoStart(3)` window returning zero for a plan that existed) lived only in the deleted
  block, yet §1's clock convention and §2.6 both cite *"§2.4's staleness note"* by name. Restored
  into §2.4, so both references resolve.
- **Dropped, not restored:** the claim that `sn_aia_execution_plan.agent` *"carries the agent's
  display name"*. Read back through `servicenow_query` the field returns the reference **sys_id** —
  plan→seed mapping is by sys_id unless `displayValue` is requested.

### Fixed (#171 review round)

- **§1's clock convention paired two different executions.** It read the staleness note's `01:22:54`
  and §2.7's `21:25:38` as *"the same seed-01 rep-1 plan… a 4-hour offset"*. They are two plans: the
  **void** `dfa22b7a…` (UTC `01:22:54`) and the retry `c343e7be…` (UTC `01:25:38`), three minutes
  apart — verified live 2026-08-11. As written the worked example implied a 3h57m offset and made the
  clocks look unreliable, in the one paragraph §3.3's "convert before comparing" rule depends on.
  Both pairs are exactly 4h; the referents differ.
- **Two more casualties of the #169 cut, restored to §2.4:** the verbatim input-schema capture (the
  file's framing is *"records measurements only"*, and both §2.5's discriminator and §3.3 item 4 turn
  on what an input-schema message looks like), and the stall presentation — `State: In progress` with
  `Duration: 0s` indefinitely — which §2.5's callout cites as *"§2.4's version"* and critiques. It is
  restored in its original half-right wording, so §2.5's correction has a real referent.
- **§2.4 moved ahead of §2.4a.** The region ran §2.3 → §2.4a → §2.5 → §2.6 → §2.7 → §2.4, so the
  explanation of the void run sat after the manifest and after two sections that refer back to it.
- **`§2.4a records the retry completing in 67s`** → §2.3's table. §2.4a records the 250ms `[OK]` and
  the empty `priority`; the 67s completion is §2.3.

### Verified (gpinst01, before stage 3)

- All **eight** execution-plan fixtures `completed`; all **four** bench tickets `priority` empty,
  `sys_mod_count: 0`, `sys_updated_on` == `sys_created_on` — uncontaminated.
- Seed 05's trigger `Seed 05 Bench Ticket Created` still `active: false`, as designed.
- `git log 5fb7648..HEAD -- src/` empty — the §AH7 single-variable claim still holds.

**Stage 2 is complete and stage 3 is unblocked.** No fixture needs re-firing.

---

## 2026.08.1010 — 2026-08-10

### Added

- **`benchmark/raw-evidence-v13-determinacy-check.md`** — the v13 pass's measurement record, stages 1
  and 2. Pre-flight (12 of 12, probed live), the §AI7 item-10 smoke gate (**both arms PASS**), all
  eight execution-producing fixtures, seed 05's verified absence, and a stage-3 runbook.
- **Stage 3 is deliberately not started.** §AI7 fixes sequencing as *"strictly sequential, one day,
  one deployed version"*; stage 2 closed with the UTC date already rolled over. Beginning twenty rows
  then would have split the pass across a day boundary mid-protocol — a pass that violates its own
  pre-registration on first execution is not the pass §AI registered. §3 records the fixed row order,
  both arms' proven invocation forms, four capture rules and three prohibitions instead.

### Verified

- **Smoke gate, both arms.** Native `51dadb72…` 280s / 15 tool calls / **7-of-7 tool types**; custom
  `TR1000266` 17s. Both name `context_processing_script` **line 42**, the known answer.
- **Seed 01's defect, end to end and sharper than the seed doc states.** `set_ticket_priority`
  returned **`OK`** in 250ms; the ticket afterwards reads `priority` empty **and `sys_mod_count: 0`**.
  The write never happened at all while the tool reported success — a diagnosis stopping at "the
  priority is wrong" has not reached the defect.
- **Seed 05's absence, proved with a positive control** rather than assumed. An empty narrow-window
  query is exactly what this instance's staleness trap produces, so the silence query was re-run wide
  enough to reach past the last real execution: it returned **all eight** fixture plans and nothing at
  or after the insert. Both gates confirmed — m2m **on**, trigger config **inactive**.

### Fixed

- **Two claims made during the pass and withdrawn in it, recorded rather than dropped.** The
  build-under-test version (§AI7 item 1 demanded a version string three paragraphs after §AI1 forbids
  trusting one), and **seed 01's supposed flakiness** — rep 2 was never stalled, it was a 22-second
  model turn read through a shorter polling window. The withdrawal carries the corrected
  discriminator: `TOOL CALLS (0)` alone means nothing, since tool calls are recorded on completion, so
  any run mid-turn shows zero; a real stall additionally carries an agent message whose body is an
  input schema.

### Note

- **Three instance behaviours banked for every future operator.** "Access denied" here means a **bad
  field name** — hit twice (`sn_aia_message` keys on `execution_plan`, `sn_aia_trigger_configuration`
  on `target_table`), both on tables the same session reads fine; the discriminator is a bare
  `limit: 1` query with no `query` and no `fields`. The seed agents are **invoked directly, not
  trigger-driven** — only one trigger exists on the bench table and it is seed 05's, inactive by
  design. And `POST /analyze` takes **`execution`**, not `execution_id`.

---

## 2026.08.1009 — 2026-08-10

### Added

- **`benchmark/v13-advance-rulings.json`** — the delivery channel §AI7 item 11 requires, carrying
  §AI4 Ruling 1 (seed-05 `fix_usable_unedited`) in the `v12-advance-rulings.json` shape. §AD5's
  standing rule is that an advance ruling on a scoring column ships **in the packets**, not only in
  the pre-registration (#160); §AG1 records that rows 17 and 19 flagged that column in v12 precisely
  because the ruling never reached the scorer, and two such flags land AI-3 exactly on its
  refutation boundary — an undelivered ruling would refute a prediction about the rubric using a
  defect in the delivery of the rubric.
- **`test/packetGeneratorPassSelection.test.js`** — 11 tests over pass resolution and the v13 rulings
  channel: all four inputs move together, no pass can resolve onto another's output directory,
  malformed tokens (`../..`, `v12/..`, `V12`, `v12 `) are refused rather than resolved, a missing
  input names the artefact instead of throwing ENOENT out of a `JSON.parse`, and the v13 ruling
  renders into seed-05 packets, is absent from the other four seeds, and carries no operator verdict.

### Changed

- **`build-v12-packets.js` → `build-packets.js`, with the pass as data (`--pass v13`).** §AI7 item 12:
  the generator hardcoded `scoring-v12`, `v12-reports`, `v12-rows.json` and `v12-advance-rulings.json`
  and declared `scoring-v12/` frozen, so the v13 pre-registration named `scoring-v13/` as an artefact
  that **no tool on disk could produce** — and §AI6 forbids touching packets until all twenty runs
  terminate, so the gap would have surfaced after an hour of instance time.
- **Parameterised, not forked.** The generator is the blind-rule boundary *and* the redaction layer;
  two copies drifting apart would make v12's 8-of-20 and v13's tally incomparable with nothing to
  flag it — the shape of §AD3's miscount. One code path, the pass as data.
- **The default pass stays `v12`.** `packetGeneratorParity.test.js` drives the freeze guard through
  `main(['--out', tmp])` with no pass argument; requiring the flag would have changed v12's
  reproducibility to buy nothing. `--out` still wins over the pass's directory so the freeze guard
  stays exercisable on a throwaway.

### Fixed — the #168 review round

- **The post-build runbook was hardcoded to `scoring-v12`, so a `--pass v13` build printed
  instructions for the wrong pass.** Found by the reviewer hand-running a full `--pass v13` build,
  which no test covered. Both printed edits are already done for `scoring-v12`, so an operator
  following the runbook makes two no-op changes, sees `npm test` green, and concludes the gate
  passed — while `scoring-v13/` never enters `PACKET_SETS` and **the blind-rule scan never covers a
  single v13 packet**. §AI6 puts the operator at exactly this point after twenty runs of instance
  time. Now interpolates the directory the run actually wrote.
- **The end-to-end gap that hid it is closed.** Only path resolution and the v12 default were
  covered; nothing exercised a non-default pass from staged inputs through to twenty files and the
  runbook. Two tests added, using a disposable `v98` fixture cloned from v12's inputs and removed in
  `afterAll`. Verified adversarially: reintroducing the hardcoded string turns the new test red.
- **`readInput` was called with `'?'` as the pass** from `buildPacket`, so a missing report — the
  likeliest partial-staging failure, being twenty separate files — reported `MISSING INPUT for pass ?`.
  The real pass is now threaded through, and a second test covers the partially-staged case.
- **The missing-input test drove `main()` with no `--out`**, so its safety rested on the code under
  test throwing; a regression to a default-input fallback would have written twenty packets into
  `benchmark/scoring-v99/` as a test side effect — the accident `packetGeneratorParity.test.js`
  documents as having already happened once. Now driven through a `mkdtemp`, with the directory
  asserted empty afterwards.
- **Two stale navigational pointers** to `build-v12-packets.js` updated in
  `scorerPacketBlindRule.test.js` and `packetGeneratorParity.test.js`. The `CHANGELOG.md` and
  `DECISION.md` §AC/§AI7 references are deliberately left alone — those are historical and
  pre-registration records.

### Verified

- **v12's output is byte-identical across the change.** The pre-rename generator (from `HEAD`) and
  the parameterised one were each run to a scratch directory and `diff -r` reports no difference
  across all twenty packets. This is the check that matters: a parameterisation that quietly altered
  packet bytes would invalidate the v12↔v13 comparison that is v13's entire primary outcome.
- `npm test` → **32 suites, 1577 tests, all passing** (was 31/1566).

### Note

- **§AI is not edited.** Items 11 and 12 are *satisfied* by this work, not amended by it. §AI is a
  merged pre-registration and §AD's rule stands — a pre-registration is only as good as the commit
  it names, so retroactively marking its own gates green would destroy the property it exists for.
  §AI7 item 12's description of `build-v12-packets.js` remains a true statement about the state at
  pre-registration time.

---

## 2026.08.1008 — 2026-08-10

### Added

- **The v13 determinacy check is pre-registered (#166, `DECISION.md` §AI).** Discharges §AH7's
  standing open item — *"The next scored pass is still not scheduled, sized or pre-registered"* —
  a sentence §AG6 and §AH7 both close with. **No run fired, no packet was scored, no
  instance was touched, and no v12 number moves.**
- **The pass is framed as a determinacy check rather than a milestone measurement**, inverting every
  prior scored pass. Primary outcome is the packet-level `ambiguous` tally across 20 rows against
  v12's 8-of-20 (§AD3) and v9's 3-of-12 (§T2). Six predictions are filed, **all on determinacy and
  none on `passes_gate`** — the withheld gate prediction is recorded as a row on the prediction table
  so the omission is visible rather than inferred.
- **Six rulings fixed in advance.** Rulings 1–3 carry from §AC (seed-05 `fix_usable_unedited`, the
  per-arm §A3.4 floor, the milestone criterion). Ruling 4 fixes what counts as a flag, at row and
  column level, and sends the column tally to a hand-curated `v13-ambiguity-flags.json` because the
  `### ambiguity` sections are prose no regex can parse — the miscount §AD3 corrected before merge.
  Ruling 5 declines to convert the single-variable build difference into a prediction, because the
  arms are not symmetric under this pass. Ruling 6 decides in advance that the incidental gate
  figures are **published, applied to Ruling 3's criterion, and unpredicted** — three separable
  things, each a place a later reader could otherwise be told a different story.

### Changed

- **§AC2's sizing justification is explicitly retired and replaced.** The shape stays 5 seeds × 2
  reps × 2 arms, but §AC2 justified ten rows per arm with a binomial-resolution table — an argument
  about resolving a *rate*, which this pass does not read. v13's rationale is **report diversity**;
  the binomial table is demoted to bounding what the incidental gate figures can resolve.
- **§AC6's optional-stopping protection is extended to the flag tally.** Under a determinacy framing
  the ambiguity count *is* the outcome, so no row-level or column-level tally may be computed,
  curated or glanced at until all twenty packets have been scored and returned (§U8.5).

### Fixed — the review round and the pre-flight round, both before merge

- **Eleven `/code-review` findings, all real, applied once.** Two were release-grade: §AI named **no
  `v13-advance-rulings.json`**, re-opening the defect #160 closed (§AD5's rule that an advance ruling
  must ship in the packets — §AG1 records rows 17/19 flagging `fix_usable_unedited` in v12 precisely
  because the ruling never reached the scorer, which alone lands AI-3 on its refutation boundary);
  and **no v13 packet generator exists** — `build-v12-packets.js` hardcodes its paths and declares
  `scoring-v12/` frozen, so there was no path from v13 reports to v13 packets. Both are now
  pre-flight items 11 and 12, gated before run 1.
- **Ruling 4's column scan is now domain-bounded to `ambiguous = yes` rows**, matching how
  `v12-ambiguity-flags.json` was curated. All twenty v12 verdicts carry an `### ambiguity` section,
  so an unbounded scan would have scored AI-2/AI-3 against a denominator different from the v12
  baseline they name.
- **AI-1/AI-2/AI-3 are restated as proportions of valid rows**, with the 20-row figures kept as the
  full-denominator case. §AI6's cost stop permits an arm to close at 8 or 9, which would otherwise
  have left the primary outcome partly a function of the void count, resolvable after the rows exist.
- **The optional-stopping seal now covers AI-4 and AI-5.** Both read off report *shape*, which the
  operator necessarily sees mid-pass; without this AI-5 could have been confirmed at run 3.
- **Two provenance claims withdrawn as unverifiable.** "Closed six consecutive sections (§AC–§AH)"
  was false (§AC discharged the item; §AD–§AF do not carry it), and the "seventh consecutive section"
  ordinal does not reconcile under any consistent rule — §AD1's "fifth" is the last that does. The
  fact is kept, the tally is dropped, and both are recorded rather than silently corrected.
- **AI-5 is disclosed as ~3% refutable** and explicitly not counted toward the section's six
  meaningful predictions.

### Fixed — by the pre-flight the section prescribes

- **The build under test is `2026.08.1003`, not `2026.08.1008`.** A live probe of gpinst01 returned
  `1003`; `5fb7648` *is* `1003`, and `1004`–`1007` are documentation only. Pre-flight item 1 had
  demanded a version-string match three paragraphs after §AI1 forbids trusting version strings —
  **the section carried the rule and a violation of it**, inherited from §AC7. Item 1 now probes
  that `git log 5fb7648..HEAD -- src/` is empty, which is the claim that actually binds.
- **Pre-flight items 2 and 3 verified live against gpinst01**, and item 2 now names its probe string
  (`the presence requirement is stated FIRST`) instead of "the fixed wording"; a `scriptLIKE`
  negative control confirmed the filter is real and not silently dropped.
- **One anomaly recorded unexplained** (new pre-flight item): every `x_snc_troubleshoot` script
  include reports `sys_updated_on` ≤ 2026-08-02 while `PaFixReport` demonstrably contains code
  written 2026-08-10. Verified, unreconciled, blocking nothing — the code probe decides — but an
  install path that writes records without touching audit fields is worth understanding before
  twenty runs rest on it.

### Verified

- **The build under test differs from the code v12 measured by exactly one change.**
  `git log 5fb7648..HEAD -- src/` is empty, and `5fb7648` is the commit that both published the v12
  rows and shipped #155's fix. Pre-flight item 3 probes for it by the distinctive method name
  `_withCanonicalLayersSwept` — the single-variable claim rests on that probe, not on a version
  string (§W7, §AB6).
- **DECISION.md remains append-only.** The pre-branch file is a byte-exact prefix of the new one,
  confirmed by SHA-256 over the first 380,344 bytes.

---

## 2026.08.1007 — 2026-08-10

### Fixed

- **The last four rubric ambiguity flags now decide themselves — all fourteen of §AD3's are closed
  (#164, `DECISION.md` §AH).** §AG closed the ten flags on `evidence_cites_trace_and_config` and
  `fix_usable_unedited` and was careful **not** to call the rubric determinate: four flags remained on
  `root_cause_layer_correct` (rows 07, 14) and `fix_target_correct` (rows 05, 12), **one of them a
  gate term**. Those four are now answered in `scorecard-template.md`, transcribed from each verdict's
  own `### ambiguity` section rather than from the flag tally.

  New **§A2.2** (`root_cause_layer_correct`, §A2's other gate term): where a report declares a layer,
  **the declared value is scored and the finding text's substance is not** — a root cause filed under
  layer 3 whose prose describes the seed's layer-2 mechanism scores 0, and the reverse scores 2; where
  no layer is declared, the root cause must name the expected layer by the **name or number the seed
  spec prints**, since the packet carries no layer-to-artifact map. A report with several root causes
  is scored **against its primary**, lifting §A1 Case 2's selection rule by reference — without which
  a shotgunned five- or seven-layer enumeration scores 2 on every seed and the column measures list
  length. `layers_swept` status and validator rejections are **explicitly kept out** of the column;
  both are scored elsewhere.

  New **§A2.3** (`fix_target_correct`): where a fix declares a target, **the declared field is scored,
  not prose elsewhere in the fix body**. All three bands are fixed against the seed spec's
  `Expected fix target` header row — 2 names the specific target, 1 matches the area without it, 0 is
  a different area **or any reading the seed spec explicitly excludes** (seed 01's *"Not 'the tool
  input schema'"* sits inside the expected area and must not earn the partial band). Where several
  fixes are proposed, the column takes the highest value any one non-hedged fix earns, **and that fix
  is the one §A2.1 Case 5 then evaluates**, so §A's cross-column constraint relates one fix to itself.

- **§A's partial-band note is superseded in place, with the old sentence quoted rather than deleted.**
  *"For the others, 1 is available but must be justified in `notes` if used"* authorised the band
  without locating either boundary, and both `fix_target_correct` flags landed on it. §A2.3 Case 2 now
  locates both, for every seed; `notes` is good practice and no longer the authorisation.

### Changed

- **`test/rubricClauses.test.js` grew two describe blocks (21 tests)** pinning both clause sets inside
  the `## A2.` → `## A3.` window a packet copies, each load-bearing decision term, and the
  supersession note — including that the superseded sentence survives **exactly once and only as a
  quotation**, so a second live occurrence cannot reappear. Suite: **31 files, 1566 tests, green.**
- **`test/scorerPacketBlindRule.test.js` gained three `RUBRIC_PATTERNS`** — `pass-version-token`,
  `empirically-observed`, `rows-were-flagged` — after the review of this PR found two provenance
  leaks inside the packet slice that all four existing patterns walked past (see Notes). Each is
  verified to fire on the exact string it was written for and inert on the slice as it now stands.

### Notes

- **No run was fired, no packet re-scored, no v12 number moved** (§T9 / §AF7 / §AG5). §AH5 reports
  what the clauses *would* have changed rather than recomputing: row 05 `fix_target_correct` 1→0
  (native) and row 14 `root_cause_layer_correct` 2→0 (custom) — one flip per arm, rubric totals 50/60
  and 7/60 against the published 51/60 and 9/60. **No `passes_gate` value moves in either direction**,
  so §AD1's headline (native 6/10 · 60% · middle band, custom 0/10 · 0% · bottom band) is unchanged
  even under the new clauses. §AD2's "8 of 10" for custom `root_cause_layer_correct` = 0 would read
  9 of 10; AC-2's ≤7 refutation threshold still holds.
- **Both flips are downward**, and §AH5 records that rather than explaining it away. The defence is
  §AG5's and no stronger: mechanical clauses, written before any pass scored against them, ordering
  checkable in git.
- **`test/scorerPacketBlindRule.test.js` caught a real defect in this change before it left the
  working tree** — the first cut of §A2.2 pointed a scorer at "§E", which sits outside the
  `## A.` → `## B.` packet slice and would have led a model scorer out of the packet toward prior
  passes' rows and grades. A rubric clause is a blind-rule surface like any other channel (#143).
- **Code review found ten findings on this branch and all ten were real** (`DECISION.md` §AH5a).
  Three were consequential: **two further provenance leaks inside the packet slice** that every
  existing pattern walked past ("two v12 rows were flagged on it"; "a run has been observed doing
  exactly that") — removed, with three new guard patterns added; **§A2.3's first cut contradicted
  §A2.1 Case 5** by claiming to designate which fix that case evaluates, handing a scorer opposite
  values on a gate term; and **§A2.3's 2 band was unreachable on four of five seeds**, because only
  seed 01's `Expected fix target` row names a specific target while the rest print an area.
- **The review's asymmetry finding was right about the gap and wrong about the fix, and the rows
  settled it.** Making §A2.3 use §A2.2's primary-only rule scores row 07's `fix_target_correct` = 0,
  though its FIX-2 names `sn_aia_agent[…].instructions` at full specificity and is merely listed
  second. The asymmetry is kept and its reason is now stated in the clause.
- **The largest hole was found by re-verifying the rows, not by the review: compound declared layers
  are the native format's norm** (`Layer: 3 (tool script) + 4 (schema)`). §A2.2 had no rule for them,
  leaving **eight published full-credit rows undecidable** under the clause meant to make the column
  determinate. Now read on the conjunct naming the expected layer.
- **The §AH5 counterfactual was re-derived after every rule change and is unchanged** — two flips,
  one per arm, no `passes_gate` movement. Every `rc = 2` row and every nonzero `fix_target_correct`
  row was re-checked, not only the four flagged ones.
- **The Phase 1b milestone remains unmet** — the sixth consecutive section to close that way. The next
  scored pass is still not scheduled, sized or pre-registered.

## 2026.08.1006 — 2026-08-10

### Fixed

- **The two most frequently flagged rubric columns now decide themselves (#159, `DECISION.md`
  §AG).** §AD3 measured **fourteen flags over twelve of twenty v12 rows, across four columns** —
  `fix_usable_unedited` (a gate term) and `evidence_cites_trace_and_config` drawing them equally
  often at **five rows each**, with the remaining four falling on `root_cause_layer_correct` and
  `fix_target_correct`. §AD7 item 3 filed it as *"a third clause"* for one shape of citation; the ten
  flags on the two named columns hold **eight distinct questions**, and all eight are now answered in
  `scorecard-template.md`. The other four are **not** closed here — they are filed as **#164**, and
  one of those two columns is also a gate term.

  New **§A1** (five clauses, `evidence_cites_trace_and_config`): a report with no root cause scores 0
  rather than blank; a report with several is scored **against its primary** — skipping any entry
  that asserts no defect exists — not as a whole and not all-entries-must-comply; a citation counts
  only if the root-cause statement **names the artifact cited**; a citation with no backing call in
  the audit trail does not count, with the two tool families **enumerated rather than judged** and
  **the trail deciding, not the validator**; and both halves must sit with the root cause under
  evaluation, unless it refers to the other location explicitly.

  New **§A2.1 Cases 3–5** (`fix_usable_unedited`): a supplied snippet must, applied exactly as given,
  perform the change it describes — Case 1 is about a missing *value*, this is about a missing *edit*;
  a target named by **kind** rather than by name scores 0, with a kind-named *value* routed back
  to Case 1's obtainability test so the two clauses cannot contradict each other; and a report
  proposing several fixes is scored against **the fix that addresses the seeded defect**, with the
  others neither credited nor charged.

  **Both sections now state how their cases combine, and the two rules differ on purpose.** §A1 is a
  pipeline — Cases 1–2 settle which root cause is the subject and never award the point; Cases 3–5
  do. §A2.1 is a conjunction — Case 5 selects which fix is under evaluation, then Cases 1–4 are each
  **necessary**, so the first failure decides and passing a later case never lifts an earlier bar.
  §A2.1 previously had no combination rule at all, which left Cases 2 and 3 able to give opposite
  verdicts on the same fix. The conjunctive reading itself is not new — §Z2 recorded it for Cases 1–2
  and called it load-bearing; it is now in the template, where the scorers are.

  §A1 is a section rather than a third case under §A2 because that heading is *"the column the gate
  actually consumes"* and this column is not in the gate expression. It still ships — the packet
  generator slices §A to §B.

  **No v12 number moves and no row is re-scored** (§T9, §AF7). The clauses bind the next pass.

### Changed

- **The withheld-name defence is refused, closing §AD7 item 5 (#159, §AG4).** Where the blind rule
  withheld an identifier, a fix that names its target by class still scores 0: the column scores what
  the builder AI receives, not what the run could reasonably have known. This is the one place in
  §A2.1 where a fact about the run is excluded from the test, and the template says so.

- **`test/rubricClauses.test.js` guards both clause sets and both placements** — §A2.1 in the
  §A2..§A3 window it has always occupied, §A1 in §A..§A2, and §A1 additionally inside the generator's
  own §A..§B slice. Every new assertion was verified to go red against a mutated template, each
  mutation applied independently. Assertions now match against a whitespace-flattened slice, so a
  paragraph being re-wrapped cannot redden the suite and teach the next reader to shorten the
  assertion until it passes — underscores are deliberately preserved, since every tool name the file
  pins contains one.

## 2026.08.1005 — 2026-08-10

### Fixed

- **The scorer packet generator pre-judged a rubric column, on one arm only (#157, `DECISION.md`
  §AF2).** All ten custom rows took a harness HOLD and no native row did, so the `note` field —
  rendered as packet §5 — landed almost entirely on one arm, **and it carried a verdict**: *"an
  out-of-box table unrelated to this seed's fixture"* told the scorer the layer-4 sweep was hollow,
  which is precisely the `layers_swept` credibility judgement the scorer exists to reach. The other
  arm's shortfall was annotated with the run's own excuse (*"the report states L4 and L5 were skipped
  deliberately"*) — and that one sat inside the **measurement** field, whose own preamble states it is
  derived from the audit trail *"independently of the report text."*

  Scorer-facing fields now **name the argument of a call and stop there**; relevance is the scorer's
  to judge. The operator's reading moved to a new `operator_note` field that renders nowhere, and a
  build-time lint over a declared phrase list fails the build when a scorer-facing field carries a
  verdict. **No v12 score moves and no row is re-scored** (§T9) — this is an instrument repair for the
  next pass.

- **The redaction damaged meaning in five places, contradicting the packets' own guarantee (#157,
  §AF3).** Every packet asserts its redaction *"touches paths only … no sentence has lost its
  meaning."* It was false: all twenty rendered setup step 1 as `cd the build output directory &&
  now-sdk install` (unrunnable); rows 05–08 turned a named unit test into *"the build output
  directory (main repo) guards the construction"*; rows 17–20 read *"a repository a repository
  document §3"* from one substitution cascading into another; a golden SDK example and the SDK
  build-rule reference were both described as a build directory; and every seed's Fluent-source row
  kept a bare filename and a dangling backtick — a navigable pointer the guard cannot see, since
  `.now.ts` is not `.md`. Same text within each seed, so no cross-arm bias.

  Fixed structurally rather than case by case: redaction now runs over **frozen segments**, so text a
  rule produces is invisible to every later rule and a cascade is unreachable; and the generic sweep
  **no longer emits prose** — it removes the path and plants a sentinel that fails the build, so every
  real redaction is a line a human read in context. Replacements are written lower-case and
  capitalised automatically where they open a sentence.

- **A rejected run's validator message was labelled as JSON (#157).** `reportBody()` picked its fence
  from the body's first character, so on rows 08/14/20 the `---` rule and the `VALIDATOR REJECTION`
  prose ended up inside the ` ```json ` fence. No content was lost; the label was wrong.

- **Running the generator silently rewrote twenty dispatched packets (#157, §AF1).** `scoring-v12/`
  no longer reproduces from its own generator — §AE re-derived the band table after the pass was
  scored — and those files are the only record of what the scorers read. An inspection `require()`
  ran `main()` and overwrote all twenty with nothing failing. Two repairs: `main()` runs only under
  `require.main === module`, and the writer refuses to clobber an existing packet without `--force`.

### Added

- **Advance rulings on scoring columns now ship in the packets (#160, §AD7 item 4, §AF4).** §AC4's
  Ruling 1 fixed seed 05's `fix_usable_unedited` exposure in advance and blind, then lived only in
  `DECISION.md`, which no scorer may read. Both seed-05 native scorers flagged the column
  under-determined for exactly that reason; they landed on the ruled value independently, so it
  changed no score, **but that is luck, not compliance.** The generator now reads
  `benchmark/v12-advance-rulings.json` and renders section 3 in **every** packet — empty ones
  included, so its presence carries no signal — with three build-time checks: a ruling matching no
  row fails, a ruling missing from a packet it claims fails, and the ruling's pointer back into the
  decision record must never render.

- **`test/packetGeneratorParity.test.js` (50 tests).** The generator carries a deliberate copy of the
  packet guard's path patterns, justified as *"two independent copies disagreeing is a signal."* That
  holds only if something looks — nothing did, and the copies drifted (#155 review, I2: the guard's
  `.md` alternation became case-insensitive and the copy did not inherit it). This compares them
  without merging them, **two ways**: the stem list as source text, and the composed matchers as
  behaviour over a corpus (planted routes plus every token of every seed spec), the guard's regex
  rebuilt from its own source. Both are needed — the drift lived in the alternations, so a stem-only
  diff would have stayed green through it. The rest pins each #157/#160 repair against the exact
  input that produced the defect.

### Changed

- **The arm stays visible in scorer packets, and that is now a ruling (#157, §AF5).** Packets state
  the arm in plain text and carry three structural tells (JSON versus markdown body, a custom-only
  HOLD block, `run_id` versus `diagnostic execution`). Not a blind-rule violation — `README.md` scopes
  that rule to prior-run *outcomes* — but §AC1's headline is a cross-arm comparison, so it was decided
  explicitly rather than inherited. The tells are inherent to what each arm produces; blinding the
  label alone would be theatre, and normalising the bodies would edit the artefact under test. **The
  cost, stated:** a scorer who knows the arm can bring a prior to a row, and nothing measures whether
  one did. A future arm-blind pass must normalise the report bodies first.

### Review round (§AF6a)

`/code-review` at high effort returned nine findings against the first cut; all nine were taken. The
three worth naming all repeat this work's own lesson — **a guard that cannot fail is worse than no
guard, because it also stops anyone looking**:

- **The freeze guard failed open**, keying on the twenty filenames *this run computes* rather than on
  what the directory holds. Any manifest edit changing `row`/`arm`/`seed`/`rep` — all in the filename
  — slipped it and wrote twenty fresh packets beside twenty stale.
- **The freeze test was itself the accident:** it drove the real writer at the real `scoring-v12/` and
  trusted the guard under test to stop it. Measured in a sandbox — with the directory absent,
  `npm test` wrote all twenty. The writer now takes `--out` so the guard is exercised on a throwaway
  directory.
- **The require-side-effect test could not fail**, because the module was already loaded and the
  `require()` under test hit the module cache. Now run in a child process, and **verified to go red**
  against a generator with `main(['--force'])` at module scope.

Also fixed: a catch-all regex that would attribute another seed's Fluent file to the row under
scoring (now checked against the packet's own seed, falling through to the sentinel rather than
guessing); an empty-rulings line telling the scorer to score *"by section 1 alone"* when the packet
directs them to sections 1 **and** 2; advance rulings bypassing the register lint despite being the
largest block of operator-authored scorer-facing prose in the packet; `hold_text` being *subject* to
that lint with no available remedy, since it is transcribed verbatim rather than authored — **the
boundary is now declared: the lint governs what the operator writes, never what the harness said**;
and nothing tying a `failed` terminal to the presence of a validator rejection, so a packet could
promise one and show none.

---

## 2026.08.1004 — 2026-08-10

### Changed

- **The benchmark band table no longer prescribes across arms (#158, `DECISION.md` §AE).** The
  middle band's Outcome cell read the **native** arm's proportion and prescribed *"build the custom
  deep-diagnosis harness"* — a two-arm prescription carried by a single-arm classification. That was
  sound only while the custom arm was unmeasured; it carried *"the custom arm is unmeasured"* as a
  silent premise rather than a stated precondition. The v12 pass measured both arms on the same
  instance, day, seeds and build (**native 6/10 · 60%**, **custom 0/10 · 0%**) and §AD4 found the
  depth gate — the very component the cell prescribes — *degrading* diagnoses rather than deepening
  them, so adopting the cell as written would have prescribed the component the pass found most
  harmful.

  Re-derived as a measurement-state rule, **binding on passes after v12**: (a) while the other arm is
  unmeasured the original prescription stands; (b) once it is measured, a band prescribes about the
  arm it was read on, and the custom harness is built out only on **its own ≥ 80%** — the fixed
  anchor, not a relative `custom ≥ native` test, which §AC4 Ruling 3 rejected because it makes the
  test a function of native's intra-day drift; (c) either way, a component **measured to degrade** a
  diagnosis is removed or re-derived before any further build, since arm-level proportions can hide
  component-level harm.

  **All three bands carried the defect, not just the middle one.** The bottom band
  (`< 50% → full custom harness as designed`) is claim-(3) end to end; and three copies of the **top**
  band attach a custom-side clause too (*"the custom harness shrinks to the Evidence Bundle path +
  measured gaps"*), which is the same shape in the row that looked clean. What is untouched is the
  **native-side half of every band**, not the top band. The repaired bottom cell reads *"this arm does
  not clear triage on this evidence"* — never *"not a path"*: a bottom-band score is a floor, silent on
  how far below the band an arm sits and on whether it could clear one later.

  Applied across every surface carrying the stale prescription: `benchmark/scorecard-template.md`
  §A3.3 (the live instrument) and `README.md` get the corrected rule; `docs/ARCHITECTURE_DECISIONS.md`
  Decision 0.5, `docs/IMPLEMENTATION_PLAN.md` Task 12 and `docs/AGENT_DOCTOR_ARCHITECTURE.md` §8 take
  supersession notes rather than rewrites, because each is a record of a decision as it was made.
  Two surfaces deliberately keep the retired rule: `benchmark/scorecard-agent-doctor.md` (a historical
  scorecard must state the rule it was scored under) and `DESIGN.md` §4's ruling **R-21**, which quotes
  the `< 5/10` cell as evidence in its own argument — editing it would rewrite the ruling's reasoning.

  **`scorerPacketBlindRule` failed the first cut of the instrument edit** (one `repository-path`,
  three `outside-section-pointer`) — the rubric channel reaches every packet, so the *derivation*
  cannot cross into the template even when the *rule* must. The two prior-run proportions in that
  draft were removed on the same reasoning and would not have been caught by any pattern. **The #161
  review then caught the rewrite still opening with provenance** (*"This column used to prescribe…"*),
  which the guard also passed — two drafts in a row put the derivation at the site of the change, so
  the guard's blind spot needs a named reviewer rather than vigilance. Recorded at §AE6.

  **v12's numbers are unchanged and no re-run is licensed** (§T9). Both halves of §AD7's disposition
  that rest on measurement stand — native remains the recommended path on this instance, and the
  Phase 1b milestone remains unmet. What v12 no longer carries is any prescription to build out the
  custom harness.

### Added

- The three remaining unfiled §AD7 open items are now on the board: **#159** (§A2.1 needs a third
  clause for a formally-present-but-irrelevant citation, plus §Z5's unresolved by-kind-not-by-name
  case) and **#160** (an advance ruling on a scoring column must ship in the packets, not only in the
  pre-registration — Ruling 1 never reached the v12 scorers and changed no score only by luck).

## 2026.08.1003 — 2026-08-10

### Fixed

- **`PaFixReport`: a malformed `layers_swept` no longer withdraws the layer-1 UNAVAILABLE
  relaxation (#155).** A model writing the field as bare status strings —
  `{"1":"UNAVAILABLE","2":"SWEPT",…}` rather than `{"1":{"status":"UNAVAILABLE"},…}` — hit two
  consequences at once. `_checkLayersSwept` requires `_isPlainObject(entry)`, so all seven
  *present* layers were reported **missing**; and `_isTraceUnavailable` requires the same, so it
  returned false and silently withdrew the evidence rule's **route B** (#78's absence-diagnosis
  path). The rule then fell through to the no-trace branch and told the run to *"mark layer 1
  UNAVAILABLE"* — which it had already done. **This is #148's failure shape with a malformed key
  instead of an omitted one.**

  Fixed with a single canonicalisation where the report enters `validate`, so all **eight** sites
  that read a `layers_swept` entry and test `.status` — plus the returned `normalized` — see one
  shape. Per-reader patches were rejected as eight symptom fixes for one cause. The shape is
  treated as reasonable rather than wrong because `_checkLayersSwept`'s own rejection text
  describes the field as *"an object mapping each of the seven layers (1-7) to a status"*, which
  invites exactly this, while the contract block says `{status, reason?}` — and `_hasLayerValue`
  already tolerates number-or-string for `root_causes[].layer` on the stated grounds that
  *"rejecting it was validator pedantry, not a real defect"*.

  It deliberately does **not** invent a home for the `reason` the flat form cannot carry: a flat
  non-SWEPT entry is still rejected, now for the true reason (*"layer 2 is NOT_SWEPT but has no
  reason"*), which a repair turn can act on by switching to the object form.

  Found live by the v12 scored pass (#151) as row 20, `TR1000265` — the pass's best custom
  diagnosis of seed 05, correct layer and correct gate, rejected by a remedy it already satisfied.
  **Seed 05 is the only seed that can surface it**, being the only one where nothing runs and
  route B is live. Replaying row 20's real payload against the fix: both defect signatures gone,
  route B engages, and the run is still rejected on three accurate grounds — including an
  `unsupported sweep claim` on layers 5 and 6 that the shape error had been **masking entirely**,
  so the fix also un-skips checks that were being silently bypassed. Recorded at `DECISION.md`
  §AD5.

### Fixed in review, before merge

- **C1 — the #155 fix had a hole that disarmed the depth gate.** `unsweptGaps` is a **public**
  entry point that `PaAgentLoop._depthGate` calls on the RAW draft, deliberately bypassing
  `validate`, so the canonicalisation inside `validate` never reached it. A flat-form
  `layers_swept` made it return `[]`, `PaAgentLoop` reads an empty gap list as "nothing left to
  sweep" and sets `_gateReleased = true`, and that short-circuits every later gate check — so one
  flat-form draft disarmed the depth gate for the rest of the run, with no later draft able to
  re-arm it. The blindness predates the fix (this method always read the raw draft), but the fix is
  what makes the shape reachable in a run that COMPLETES rather than one rejected at validation.
  `unsweptGaps` now canonicalises for itself; five tests added. `PaAgentLoop.test.js` stubs
  `unsweptGaps` out entirely, so nothing in the suite would have caught this.
- **C2 — a false superlative in the v12 record.** `scorecard-v12.md` and §AD3 called
  `fix_usable_unedited` "the most frequently under-determined column, six of twelve" by counting
  row 13 against it; row 13's scorer flagged `evidence_cites_trace_and_config`. It is a **5-5 tie**.
  The load-bearing claim survives — a gate term is under-determined on a quarter of all rows, so
  §A2.1 did not close its exposure — the superlative does not.
- **C3 — a false attribution in §AD4.** Rows 10, 12 and 16 were grouped as having laundered a
  gate-forced call into a supporting citation. Only row 10 cites it (`trace` + `schema`); rows 12
  and 16 cite `trace` twice and never cite their forced call, which is exactly why both scored that
  column 0. Recorded now as two distinct outcomes.
- **I5 — the pre-registration citation was wrong.** §AC was authored at `a342311` and **amended at
  `8ab2c00`**, which changed three scored refutation criteria (AC-5's binding definition of
  "unambiguous", AC-6's "either of", and AC-8's loosening to "≤2 encountered"). The
  pre-registration property is intact — both commits and the merge precede the first scored run by
  ~40 minutes, and §AC is byte-identical from merge to HEAD — but a pre-registration is only as
  good as the commit it names, so §AD now names `8ab2c00`/`4bcf43c`.
- **I1 — the packet generator was not fail-closed despite saying so.** Scan and write shared one
  loop with write last, so a leak at row 15 threw with 14 packets already on disk, and a re-run
  after an edit left 20 complete-looking files silently mixing fresh and stale ones. It now builds
  all twenty in memory, scans all twenty, checks rubric identity, and only then writes.
- **I2 — the generator's `.md` pattern was case-blind where the guard is not.** The guard fixed
  `DECISION.MD` escaping (with its own control test); this copy never inherited it. No leak
  shipped — the guard's patterns return 0 hits on all 20 committed packets — and regenerating after
  the fix reproduces all twenty byte-identically.
- **I7 — the fix's own docstring misdescribed its coverage**, naming a private `_unsweptGaps` that
  is public and listing `repairPrompt` as covered when it reads no `.status`. Corrected to seven
  sites, six covered via `validate` and `unsweptGaps` canonicalising for itself.

### Added in review

- **`test/scorecardV12Tallies.test.js` — a ledger guard.** Re-derives every published v12 figure
  from the twenty verdict files: per-row column sums, the §A2 gate expression, §A2's decoy
  constraint, both arms' proportions and rubric totals, the void count, and AC-2/AC-4/AC-5's
  numbers. `scorerPacketBlindRule.test.js` guards what goes INTO the scorers; nothing guarded what
  came out, and both C2 and C3 were authoring errors in that unguarded layer.

  The ambiguity attribution is curated in `benchmark/v12-ambiguity-flags.json` rather than parsed:
  each verdict's ambiguity section argues BOTH readings, so every column name appears in the prose
  and no regex can tell "named as under-determined" from "discussed" — attempting that parse is
  what produced C2. The test binds the curated source to the derived flag set and to both
  write-ups. An earlier version banned the retracted phrase and tripped on the corrections
  themselves, which quote it verbatim because this repo retains retracted claims; the assertion is
  positive instead.

  `npm test` 1477 passed, 30 suites; `now-sdk build` clean on SDK 4.9.2.

## 2026.08.1002 — 2026-08-10

### Added

- **The v12 scored pass — verdict (#151).** Pre-registered at `DECISION.md` §AC before any run
  fired; result at §AD, rows at `benchmark/scorecard-v12.md`, measurements at
  `benchmark/raw-evidence-v12-scored-pass.md`, packets exactly as scored at
  `benchmark/scoring-v12/`, each blind scorer's reasoning at `benchmark/scoring-v12/results/`.

  **Native 6/10 · 60.0% · middle band. Custom 0/10 · 0.0% · bottom band.** Rubric totals 51/60
  and 9/60. Twenty rows, five seeds, two reps, two arms, **zero voids** — both arms finished with
  all ten valid and neither used any of its three permitted re-runs. Twenty independent blind
  scorers, one per packet, dispatched once after all twenty runs terminated (§AC6), with
  byte-identical prompts because the prompt is part of the instrument.

  **The Phase 1b milestone is NOT met** — AC4's Ruling 3 fixed the criterion in advance as the
  custom arm reaching ≥80%; it reached 0.0%. Predictions: seven confirmed (AC-1, AC-2, AC-4, AC-6,
  AC-7, AC-8, AC-9), two refuted (AC-3, AC-5). AC-9 was filed against the project's own preferred
  outcome and held.

  Two findings beyond the scoreline. **AC-5's refutation** (8 of 20 unambiguous against a predicted
  ≥14) says §Z's rubric repair made the rubric *reproducible* without making it *determinate*, with
  `fix_usable_unedited` — a gate term — the most-flagged column. And **the depth gate can degrade a
  diagnosis**: across nine held custom rows not one gate-forced call touched anything connected to
  its seed's defect, producing two confident false positives that replaced partly-correct drafts,
  one terminal validation failure, one validated report with an invented fix that cited the forced call,
  and two more whose fixes were non-actionable. §AD4 declines
  to adopt the middle band's "custom deep-diagnosis harness" prescription on that evidence.

  Also added: `benchmark/scripts/build-v12-packets.js`, which generates the packets, asserts the
  rubric section byte-identical across all twenty, and re-scans every emitted packet with a copy
  of the blind-rule path patterns, refusing to write if one survives. `scoring-v12` declared to
  `test/scorerPacketBlindRule.test.js` with `scanned: true` and a packet count of 20.

## 2026.08.1001 — 2026-08-10

### Added — the v12 scored pass is pre-registered (#151, DECISION.md §AC)

Closes #151's last task and §Z6's open item: the next scored pass was unblocked but never
scheduled, sized or pre-registered. §AC fixes all of it before a single run fires, and the ordering
is checkable in `git log -p benchmark/DECISION.md` rather than asserted — the §U/§W standard.

**Shape:** 5 seeds × 2 reps × 2 arms = 20 runs, 10 valid rows per arm, on build `2026.08.1001`
carrying #148's fix (verified by `scriptLIKE` probe, not by version string). This is the v4 shape,
chosen because v4 is the only prior pass to run all five seeds against both arms.

**Three rulings made blind**, each one a decision someone would otherwise make with rows in hand:

1. **Seed 05 `fix_usable_unedited` = 1** for a report that names the specific gate and proposes
   activating it — notwithstanding the qualification's finding that activation alone does not
   restore the acknowledgement. The column is read against the *seeded* defect; the execution-layer
   break is an unseeded second defect no diagnosis could detect. A seed-05 clause for this pass
   only — it does not amend §A2.1 and does not touch §A2's decoy constraint.
2. **§A3.4's floor is per arm**, the strict reading §T8 left contested. Settled in the direction
   that binds harder, and settled while no void count exists.
3. **The milestone criterion is the top band** (custom ≥ 80% of its valid runs), not *custom ≥
   native* — the latter makes the milestone a function of native's measured intra-day drift, so a
   bad native day could carry it without the custom harness improving.

§AC also separates two things §A3.4 leaves adjacent: the **floor** counts valid rows at the close of
the pass, while the **re-run cap** bounds instance time. A void that is successfully re-run costs the
denominator nothing, so a pass that voids six rows and recovers all six is costly, not under-powered.

**Nine predictions with stated refutation criteria**, including AC-9 — *the milestone is NOT met* —
filed against the project's own preferred outcome so the standing prior is exposed rather than
restated. AC-5 (≥14 of 20 rows unambiguous) is the first live test of §Z's rubric repair against
§T8's measured 3 of 12.

**Sizing honesty:** at 10 rows per arm a harness whose true pass rate is exactly 80% lands in the
top band only 67.8% of the time. Tabulated in §AC2 rather than discovered afterwards, and §T9's
"do not re-run this pass to get a firmer number" still governs.

### Fixed — one claim in the seed-qualification record was wrong

`raw-evidence-seed-qualification-02-05.md` §4 item 4 said a new `scoring-v<n>/` directory leaves the
blind-rule suite green until someone declares it. It does not:
the `declares every committed packet set` test in `test/scorerPacketBlindRule.test.js` compares
`PACKET_SETS` against the directories on disk, so an undeclared set turns the suite **red** — the
guard fails closed on declaration. The residual hole is narrower and real: `scanned` is consumed as
`PACKET_SETS.filter((s) => s.scanned)`, so a set declared `scanned: false` is accepted and never
scanned. Corrected in §AC7, which also lists the three edits a declaration actually needs — the
entry with a matching `packets:` count, the hardcoded membership literal in the same test, and a
green `npm test`. Declaring only the entry, as the first draft of §AC7 said, still leaves the suite
red.

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
