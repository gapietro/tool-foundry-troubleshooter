# v9 scorer packet build report

**Task:** build 12 blind scorer packets for the v9 benchmark pass and prove they are blind.
**Built:** 2026-08-05. **Output:** `benchmark/scoring-v9/` — 12 files, no README, no scorecard.
**Scoring was not performed.** No packet was graded, ranked, or commented on for quality.

---

## 1. What was built

12 packets, named per the `benchmark/scoring-v4/README.md` convention
`row-<NN>-<arm>-seed-<SS>-run-<R>.md`, one per manifest row:

| file | seed | arm | run | run_id | terminal |
|---|---|---|---|---|---|
| `row-01-native-seed-01-run-1.md` | 01 | native | 1 | `961d7d9d2baa475817a6ffbeee91bf2a` | completed |
| `row-02-native-seed-01-run-2.md` | 01 | native | 2 | `853ffd1d2bea475817a6ffbeee91bf0b` | completed |
| `row-03-native-seed-03-run-1.md` | 03 | native | 1 | `74010e192b2e475817a6ffbeee91bfda` | completed |
| `row-04-native-seed-03-run-2.md` | 03 | native | 2 | `a6c2061d2b2acf54f243fed2ce91bf34` | completed |
| `row-05-native-seed-04-run-1.md` | 04 | native | 1 | `e064ce952b6acf54f243fed2ce91bf28` | completed |
| `row-06-native-seed-04-run-2.md` | 04 | native | 2 | `aa06c65d2bae475817a6ffbeee91bf71` | completed |
| `row-07-custom-seed-01-run-1.md` | 01 | custom | 1 | `c5e7421d2baacf54f243fed2ce91bfc0` | **failed** |
| `row-08-custom-seed-01-run-2.md` | 01 | custom | 2 | `1d988e1d2bee475817a6ffbeee91bf4f` | **failed** |
| `row-09-custom-seed-03-run-1.md` | 03 | custom | 1 | `522986d12beacf54f243fed2ce91bfa7` | complete |
| `row-10-custom-seed-03-run-2.md` | 03 | custom | 2 | `4cb98e952b22875817a6ffbeee91bfa1` | complete |
| `row-11-custom-seed-04-run-1.md` | 04 | custom | 1 | `a53a02592beacf54f243fed2ce91bf65` | complete |
| `row-12-custom-seed-04-run-2.md` | 04 | custom | 2 | `deba8a1d2b22875817a6ffbeee91bfbb` | complete |

Every packet has the same five sections:

1. **Scoring rubric** — §A, §A2, §A3 sliced byte-verbatim out of
   `benchmark/scorecard-template.md` (from `## A. The 6-point rubric` to the
   character before `## B. Four further columns`; 7,738 bytes). Identical text
   in all 12, verified by set-equality across the 12 extracted blocks.
2. **Seed specification, in full** — `benchmark/seeds/seed-01-schema-mismatch.md`,
   `seed-03-missing-data.md` or `seed-04-genai-unmapped.md`, copied byte-verbatim.
   **No redaction was applied and none was needed**: the prior-pass narrative that
   v4 had to redact by hand now lives in `benchmark/seeds/history/*.history.md`,
   and `test/scorerPacketBlindRule.test.js` holds the specs clean.
3. **That run's report, verbatim** — extracted programmatically from the
   `<!-- BEGIN VERBATIM row-NN -->` / `<!-- END VERBATIM row-NN -->` markers in
   `.superpowers/sdd/v9-pass/run-evidence.md`, so no transcription happened.
   Preceded by the run's own identity (run_id, `conversation_ref`, the plan under
   diagnosis, terminal state, wall clock, tool-call count) and the report's source
   record.
4. **Audit-trail measurements** — `layers_swept` with layer numbers and the §E2
   mapping shown, tool-call count, the ordered tool-call list (with each call's
   args as recorded), distinct tool set, LLM-call count, `layers_available`
   (7/7, with the §E3 query and `max_auto_executions = 10` on all seven),
   terminal state, wall clock. For custom rows, the run's own harness HOLD text
   verbatim.
5. **Notes specific to that row** — nothing that refers to any other row.

### Rows 07 and 08 (terminal `failed`)

Both carry the full `fix_report_rejected.report` body **and** the verbatim
validation-failure text, exactly once each, with a sentence stating that
`fix_report` is `null` and that a rejected report is still scored. Nothing was
omitted or summarised. Confirmed by grep: the string
`fix_report failed validation and could not be repaired` appears once in each of
those two packets and in no other packet.

### Row 01's trailing message

Row 01's evidence carries a second agent message after the Fix Report (the AIA
closing summary). It is included, clearly labelled as *not* the Fix Report and
reproduced for completeness, because it is that row's own model output. No other
row has one.

---

## 2. Method — mechanical, not transcribed

A build script (`scratchpad/build-packets.js`) assembled every packet from three
programmatic sources — the template slice, the seed files, and the marker-delimited
report blocks — plus a hand-written per-row data table for identity, timings, tool
lists, LLM counts and notes. No rubric text, spec text or report text was retyped.
A verifier then re-derived all three sources independently and asserted
`packet.includes(source)` for each.

---

## 3. Blind-rule enforcement — what was excluded and why

- **`benchmark/seeds/history/` was never opened for content.** Nothing from any
  `.history.md` was copied. Proven mechanically in §4.
- **No other row's material.** No packet contains another row's run_id,
  `conversation_ref`, anchor sys_id or `TR10001xx` number, report text, or
  measurements. Rows sharing a seed are still fully separated.
- **No other seed's spec or blind-rule tokens** (with one measured, benign
  exception documented in §4).
- **No `DECISION.md` content and no `DECISION.md` pointer.**
- **No prior pass, prior score, expected score, expected grade, or project
  conclusion.** No packet names v3–v8, `raw-evidence-*.md`, `scoring-v4`, or any
  earlier result.
- **No operator characterisation of how the runs went.** Specifically dropped from
  the evidence file's per-row "Anomalies" sections and its closing
  "Operator-level observations":
  - the cross-run observation that every custom run answered its HOLD with a
    `schema_lookup`, and that five of six targeted a platform/OOB table while the
    sixth targeted a table that does not exist;
  - the per-row restatements of the same ("the `schema_lookup` targeted
    `incident.priority` rather than the bench table", etc.);
  - "First custom row of the pass to reach `complete`…" and "Same shape as row 09"
    (both inherently cross-row);
  - the artifact-size aside on row 11.

  What was kept instead is the neutral primary data the scorer needs to reach its
  own verdict: **the ordered tool-call list with each call's recorded args**. The
  args are measurement, not opinion — the table name a `schema_lookup` was pointed
  at is a fact from the audit trail, in the same class as the tool name itself. The
  scorer can see `sn_tsbench_bench_ticket` or `incident.assignment_group` and decide
  what it means; the packet does not decide for them.

- **No quality words.** No packet calls a run shallow, deep, thorough, good, bad,
  lucky or correct. Grep-checked (§4).
- The rubric's own §E2 qualifier — that `agent_config` earns L2/L3/L7 only for the
  layers the diagnosis actually used — is flagged as *unresolved and left to the
  scorer* wherever it bites (row 07), rather than resolved by the builder.

---

## 4. Leak checks run, and their results

The jest gate first, then four hand-checks. **Note what green means:** the gate
scans the five seed specs only — one of the rule's three channels. It says the
declared patterns did not fire on any spec; it does not say the packets are blind.
§O5 of `DECISION.md` is the reason the hand-checks below exist.

**Gate — `npx jest test/scorerPacketBlindRule.test.js`: PASS, 11/11.**

| # | Check | Result |
|---|---|---|
| 1 | Byte-verbatim fidelity: rubric slice, seed spec and report block each present unmodified in every packet; rubric text identical across all 12 (set size 1) | **PASS** |
| 2 | Seed answer tokens: every seed's ` ```blind-rule-tokens ` block grepped against all 12 packets | **PASS with one documented exception** — see below |
| 3 | Cross-row identity: all 12 rows' run_ids, `conversation_ref`s, anchor sys_ids and `TR10001xx` numbers grepped against every packet that is not that row | **PASS — 0 hits** |
| 4 | Forbidden strings: `DECISION.md`, `raw-evidence`, `scoring-v4`, `scoring-v3`, `history/`, `.history.md`, `run-evidence.md`, `v9-pass`, `v8`…`v5-depth`, `prior pass`, `previous pass`, `earlier pass`, `shallow`, `Recorded, not judged`, `First custom row`, `Same shape as row`, `compared to`, `the other arm` | **PASS — 0 hits** (one expected hit on `IMPLEMENTATION_PLAN`, see §5) |
| 5 | History-file overlap: every line ≥ 45 chars from all four `seeds/history/*.history.md` files (38 lines) tested for substring presence in each packet | **PASS — 0 matches** |
| 6 | The test's own six PATTERNS (`scored-a-number`, `scored-runs-or-rows`, `run-N-did`, `credit-awarded`, `rubric-fraction`, `answer-key-pointer`) re-run against the **packets** with the rubric block excluded | **PASS — 0 hits across 12 packets** |

Per-packet answer-token counts (occurrences):

| packet | seed-01 tokens | seed-03 tokens | seed-04 tokens |
|---|---|---|---|
| row-01 / row-02 / row-07 / row-08 | 48 / 37 / 22 / 29 | 0 | 0 |
| row-03 / row-04 / row-09 / row-10 | 0 | 23 / 23 / 13 / 13 | 0 |
| row-05 / row-06 | **4 / 5** | 0 | 16 / 16 |
| row-11 / row-12 | 0 | 0 | 9 / 9 |

Seeds 02 and 05 tokens: **0 occurrences anywhere**. Neither seed is in this pass.

**The one exception, and why it is benign.** Rows 05 and 06 (seed 04) contain the
string `x_snc_tsbench_ticket`, which is a seed-01 blind-rule token. Every
occurrence was located and confirmed to sit **inside that row's own verbatim Fix
Report** — the seed-04 agent summarises a bench ticket, so its report names the
bench ticket table. It is a fixture table name in a seed-04 report, not seed 01's
diagnosis, and the scorer of a seed-04 packet is not scoring seed 01. Removing it
would mean editing a verbatim report, which is a worse defect than the one it
would fix. Recorded rather than silently accepted.

**Not covered by any of the above:** these checks are string checks. They cannot
prove that a sentence I wrote in a §5 note is free of implied judgement. That
residual risk is mitigated by construction — §5 notes were written only from
provenance facts (how the terminal state was read, that the anchor status is not
authoritative, whether the run's self-declared sweep agrees with the audit trail,
that a report's syslog claim is the run's own unverified prose) — but it is not
mechanically proven.

---

## 5. Concerns and disclosed deviations

**1. The rubric, copied verbatim as instructed, carries a two-hop pointer to the
answer key.** §A2 reads *"The gate in `docs/IMPLEMENTATION_PLAN.md` Task 12
counts runs…"* and §A3 cites the same file's band table. `docs/IMPLEMENTATION_PLAN.md`
references `benchmark/DECISION.md` three times. A model scorer with filesystem
access could therefore reach every prior pass's rows and grades in two hops. The
test's `answer-key-pointer` pattern only matches a literal `DECISION.md` and does
not fire on this path. **I did not edit it**: the brief said §A/§A2/§A3 must be
verbatim and identical in all 12, and silently rewriting the rubric a scorer grades
against is not a builder's call. The surgical remedy, if wanted, is to replace the
two `IMPLEMENTATION_PLAN.md` references with "the gate table" in the packet copies
only — a two-line change to the build script, leaving `scorecard-template.md`
untouched. Flagging for a decision before scoring starts.

**2. Verbatim §A2/§A3 puts seed-04-specific text into all 12 packets.** §A2 explains
the `fix_target_correct` constraint using seed 4's empty-`connection` decoy by name,
and §A3's void rule names seed 4's capability sys_id and seed 5's activation gate.
Seed-01 and seed-03 scorers therefore see a fragment of seed 04's specification.
This follows directly from "verbatim, identical in all 12", and `benchmark/README.md`
already models the rubric channel as *the whole of §A/§A2/§A3 reaching every packet*,
so it is consistent with the project's own rule. It cannot affect a seed-01 or
seed-03 verdict. Noted, not acted on.

**3. Tool-call args are included; the operator's reading of them is not.** Stated
in §3 above. If the intent was to withhold the args as well, the fix is one line in
the build script — but withholding them would leave `layers_swept` unauditable for
the rows where the §E2 qualifier matters, which is the column's whole purpose.

**4. Nothing else.** All 12 packets were built faithfully; no row required
improvisation, and no material was missing from `run-evidence.md`.

---

## 6. Files touched

Added: `benchmark/scoring-v9/row-01…row-12` (12 files) and this report.
Unmodified, verified by `git diff --name-only`: `benchmark/seeds/`,
`benchmark/scorecard-template.md`, `src/`, `test/` — 0 changes.

---

## 7. AMENDMENT — complete record of every deviation from the source material

Two coordinator rulings landed after the first build: **(round 1)** redact the
navigable path in the rubric, and **(round 2)** extend the same treatment to the
seed-specification copy. Both were applied and all 12 packets were rebuilt.

**This section is the single canonical list.** A future reader diffing a packet
against `benchmark/scorecard-template.md` or against `benchmark/seeds/seed-0N-*.md`
will find differences; every one of them is enumerated below. If a difference is
not in this section, it is a defect, not a deviation.

### 7.1 The governing rule and what it protects

A repository file path inside a packet is a **navigable pointer**. A model scorer
with filesystem access can follow it, and several of these paths reach prior
passes' rows and grades in one or two hops. The rule applied is deliberately
uniform — **no repo path survives anywhere in a packet** — rather than "remove the
dangerous ones", because the uniform rule is auditable by a single regex, while the
selective rule forces every future reader to re-derive which paths were judged safe.

Two properties were preserved ahead of byte-fidelity to the source files:

1. **The rubric is byte-identical across all 12 packets.** A scorer grades against
   this text; per-packet variation would make the 12 verdicts incomparable.
2. **The path goes, never the meaning.** Where a sentence's sense depended on a
   reference, the reference was kept in words. No rule, band, threshold, points
   value, measurement, setup step, decoy note or scoring note was altered, added
   or removed anywhere.

The source files on disk were never written: `benchmark/seeds/`,
`benchmark/scorecard-template.md`, `src/` and `test/` show **0 changes**.

### 7.2 Deviation set A — the rubric (§1 of every packet)

Source: `benchmark/scorecard-template.md` §A/§A2/§A3. Four substitutions, each
asserted to match **exactly once** at build time; a count of 0 or 2 throws and
fails the build rather than shipping an unredacted packet.

| # | Removed | Replacement |
|---|---|---|
| A1 | ``the evidence rule from `docs/agent/agent-doctor-instructions.md` `` | `the evidence rule from the diagnostic agent's own instructions` |
| A2 | ``It was 0-or-2, while `seeds/seed-05-inactive-usecase.md` instructs the scorer to award *partial*`` | `It was 0-or-2, while seed 5's specification instructs the scorer to award *partial*` |
| A3 | ``The gate in `docs/IMPLEMENTATION_PLAN.md` Task 12 counts **runs**:`` | `The gate counts **runs**:` |
| A4 | ``The `IMPLEMENTATION_PLAN.md` Task 12 bands are`` | `The Task 12 bands are` |

A3 drops "Task 12" from that clause only; the label survives twice later in the
same section, so no meaning is lost. Why these mattered: `docs/IMPLEMENTATION_PLAN.md`
references `benchmark/DECISION.md` three times, and `seeds/seed-05-*.md` sits
beside `seeds/history/`, which is prior-run outcomes.

### 7.3 Deviation set B — my own framing text

Not source material; written for the packet. Both removed references turned out to
be **one hop** from the answer key, worse than the two-hop pointer first flagged.

| Removed | Replacement | Why |
|---|---|---|
| ``## 1. Scoring rubric (verbatim from `benchmark/scorecard-template.md`)`` | `## 1. Scoring rubric` | The template contains three `DECISION.md` references, including "§O5 of `DECISION.md`" |
| ``## 2. Seed specification (verbatim, `benchmark/seeds/seed-0N-….md`)`` | `## 2. Seed specification (in full; repository paths redacted — see the note in section 1)` | `benchmark/seeds/` is the parent directory of `seeds/history/` |

A disclosure note heads §1 of every packet, covering both redacted sections, so
the scorer sees that a redaction happened rather than being quietly handed edited
text:

> Section 1 is reproduced from this project's scorecard template; section 2 is
> reproduced from this seed's specification. **One deliberate change, applied to
> both:** repository file paths have been replaced with plain-language descriptions
> of what they point at, because they are navigable pointers to material a blind
> scorer must not read. The redaction is **mechanical and touches paths only** — no
> rule, band, threshold, points value, measurement, setup step or scoring note has
> been altered, added or removed, and no sentence has lost its meaning. This rubric
> section is byte-identical in every packet.

### 7.4 Deviation set C — the seed specification (§2 of every packet)

Round 2. Source files unchanged; only the copy embedded in a packet is redacted.
Same exactly-N assertion per substitution, plus two guards: the `from` string must
contain a repo path and the `to` string must not.

**Common to all three specs** (2 substitutions each):

| Removed | Replacement |
|---|---|
| ``` `cd benchmark/seed-app && now-sdk install --alias gpinst01` ``` | ``run `now-sdk install --alias gpinst01` from the fixture app directory`` |
| ``` `../../test/blindRule.test.js` ``` | `the blind-rule guard test` |

**Seed 01** (4 more):

| Removed | Replacement |
|---|---|
| ``` `../seed-app/src/fluent/seed-01-schema-mismatch.now.ts` ``` (2 occurrences) | `this seed's Fluent definition file` |
| ``` `seed-app/dist/` ``` | `the fixture app's build output` |
| ``` (verified in `dist/`) ``` | `(verified in the build output)` |
| ``` `seed-app/src/fluent/seed-tables-acl.now.ts` grants record ACLs ``` | `the fixture app's ACL definition file grants record ACLs` |

**Seed 03** (2 more):

| Removed | Replacement |
|---|---|
| ``` `../seed-app/src/fluent/seed-03-missing-data.now.ts` ``` | `this seed's Fluent definition file` |
| ``` `seed-app/src/fluent/seed-tables-acl.now.ts` grants the read ACL ``` | `The fixture app's ACL definition file grants the read ACL` (capitalised — it opens the sentence) |

**Seed 04** (7 more) — the spec that carried the residual leak:

| Removed | Replacement |
|---|---|
| ``` `../seed-app/src/fluent/seed-04-genai-unmapped.now.ts` ``` | `this seed's Fluent definition file` |
| ``` hardcoded in `seed-app/src/fluent/seed-04-genai-unmapped.now.ts` ``` | `hardcoded in this seed's Fluent definition file` |
| `See **DESIGN.md R-22**.` | `See **the design contract, ruling R-22**.` |
| `LLD §8 item 8 and DESIGN.md R-22.` | `LLD §8 item 8 and the design contract's ruling R-22.` |
| ``` (see `.claude/context/sdk-examples/now-assist-skill.now.ts`) ``` | `(see the Now Assist skill golden example)` |
| ``` See `../scorecard-template.md` §A2: ``` | `See the scoring rubric §A2:` — the reference still resolves for the scorer, since §A2 is in the same packet |
| ``` `allowWebServiceAccess` in `seed-app/src/fluent/seed-tables-acl.now.ts` ``` | ``` `allowWebServiceAccess` in the fixture app's ACL definition file ``` |

This closes the residual vector reported in the previous round: `../scorecard-template.md`
and `DESIGN.md` no longer appear in the four seed-04 packets, and
`../../test/blindRule.test.js` no longer appears in any packet.

### 7.5 Deliberately left in place

These are **not** repo paths — they are labels, section numbers or API endpoints,
and none is navigable to a file:

- `LLD §7`, `LLD §8`, `Task 12`, `Build Rule #33` / `#42`, rulings `R-4`, `R-6`,
  `R-11`, `R-18`, `R-19`, `R-22`, `M18`, and `PR #33's round-2 review`.
- The REST endpoint `GET /api/now/table/sys_one_extend_capability?…` in seed 04's
  Setup step 2 — a ServiceNow API path the scorer needs to understand the void
  condition, not a repository path.
- `x_snc_tsbench_ticket` in rows 05/06, inside those rows' own verbatim reports —
  left per the ruling, for the reason in §4.

`PR #33` is the one item that is *technically* followable by a reader with GitHub
access. It is a review-thread reference carrying no grade, and removing it would
edit a substantive sentence about why the scale has a partial band. Recorded here
rather than removed.

### 7.6 Verification after both rounds

| # | Check | Result |
|---|---|---|
| 1 | `npx jest test/scorerPacketBlindRule.test.js` | **PASS — 11/11** |
| 2 | Repo-path regex sweep over the **whole** of all 12 packets, seed-spec sections now included | **0 hits** |
| 3 | Rubric block byte-identical across 12 | **TRUE** — 1 distinct value, 7,664 chars |
| 4 | `git status --porcelain` | only `?? benchmark/scoring-v9/`; protected-path changes: **0** |
| 5 | Seed-spec section vs source spec — **round-trip proof**: reversing only the declared substitutions restores each source file **byte-for-byte** | **PASS for seeds 01, 03, 04** |
| 5b | Structural conservation, source vs shipped spec | seed 01: 154 lines / 9 headings / 7 table rows / 3 bullets / 2 fences; seed 03: 83 / 8 / 7 / 0 / 2; seed 04: 244 / 9 / 13 / 10 / 2 — **all identical to source** |
| 6 | Cross-row identities, cross-seed tokens, forbidden strings, report blocks byte-verbatim, six blind-rule PATTERNS over the packets | **PASS — unchanged from §4** |

The round-trip proof in check 5 is the strongest of these: it shows the redaction
is **reversible**, so no sentence, table row, setup step or scoring note was dropped
or mangled. A lossy edit could not round-trip. Check 5b is the independent
structural confirmation — a dropped scoring note would change the bullet or line
count even if the round-trip were somehow satisfied.

### 7.7 Net position

No repo path survives in any packet. The rubric is identical across all 12 and
differs from the template only by the four path substitutions in 7.2. Each seed
spec differs from its source only by the path substitutions in 7.4 and is provably
reversible to it. Reports, audit measurements, per-row notes and run identities are
exactly as described in §1–§4 and were not touched in either round.
