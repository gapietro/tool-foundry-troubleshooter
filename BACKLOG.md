# BACKLOG

Persisted by `/next` so no session re-derives priorities from scratch. Read this first when asked
what is next. Ranked by gate-distance, not by issue age or severity label.

**Last ranked:** 2026-08-13 · shipped at version `2026.08.1313` · board **5 open** / 115 closed ·
**0 open PRs** · **blockers to gate: 1**

> **What moved (2026-08-13, later): the gate's premise was refuted by this repo's own record, and
> #259 was re-scoped.** A premise check run before designing #259 found that its gate statement —
> *"SC-1 has never been measured"* — is contradicted by `DECISION.md` §AW0 and `DESIGN.md` §5.6,
> both written the day before #259 was filed. Correctness has been in `passes_gate` since v9;
> **SC-1 stands at native 7/10 · 70.0%, custom 0/10 · 0.0%** (§AD7, both arms; a v14 absolute, and
> **not** on §AQ3's authority — see the standing position below). The gate
> is restated as *reliability of those judgements*, #259 is cut to the one direction that survives,
> and no instrument was built. **Nothing was measured and nothing was designed this session** — the
> deliverable is a corrected record.
>
> **What moved before that: the #212 sweep RAN, and its result is that the axis does not answer the gate.**
> Twenty reports extracted in twenty fresh contexts, frozen, adjudicated against a live gpinst01
> metadata snapshot, scored. Figures in `benchmark/extraction/v14/results.json`, re-derivable with
> `node benchmark/scripts/pass-figures.js`, recorded in `DECISION.md` §AX17.
>
> **AX-1a enumeration recall native 58/60 = 96.7% PASSED**; AX-1b custom `not exercised` (n=2 < 5, fixed
> by the fixture before the extractor was written). AX-2 passed and pre-satisfied; **AX-4 passed and
> EXERCISED** (0 of 7 refuted inventory claims missed vs a 3.3% per-arm rate) — that verdict is what
> §AX16.2's polarity overlay bought. Spurious rate native 21.3% / custom 62.5%, both **upper bounds**:
> §AX2.5's carve-out was deliberately not exercised because it can only lower the rate and the operator
> is contaminated in the extractor's favour.
>
> **The headline is not a pass, it is the unresolvable column.** 195 of 254 claims — **77%** — are
> `unresolvable`. §AX13.3 registered that consequence before any code ran and it held. So §AX17.3 states
> plainly: **this is a claim-veracity axis, not the gate's answer.** A report can be truthful about every
> table and column it names and still diagnose the wrong root cause — which is §AO2's finding, one of the
> two that opened this gate in the first place.
>
> Two instrument gaps were found and registered *before* being repaired: the held-out inventory predates
> §AX13's polarity amendment (§AX16.1, AX-4 had no denominator), and §AX2.3 never registered **who
> decides a match** (§AX16.3, dispatched to fresh contexts). A third was found by a guard: the scorer
> must read the fixture that the cleared set is defined by not reading, so a **second artifact class**
> was registered (§AX17.1) rather than the check being relaxed.

---

## Current gate

**Establish the RELIABILITY of the correctness judgements we already make.**

> **Corrected 2026-08-13.** This section previously read *"Measure whether the Troubleshooter's root
> causes are RIGHT"* and asserted that PRD Success Criterion 1 *"has never been measured"* and that
> v1–v14 scored admissibility and not correctness. **That is refuted by `benchmark/DECISION.md` §AW0**
> (2026-08-12) and by `DESIGN.md` §5.6's correction (a), both of which predate the paragraph they were
> re-imported over. The claim has now been refuted once and re-imported twice; it is quarantined here
> rather than deleted so the third re-import is recognisable as one.

**SC-1 is measured, and has been since v9.** `root_cause_layer_correct` (0/2) and
`fix_target_correct` (0/1/2) are correctness columns — 4 of the rubric's 6 points — and the former is
one of the two terms in `passes_gate` (`scorecard-template.md` §A2). Ground truth is independent of
the harness and predates every run: each seed spec declares **Expected root-cause layer** and
**Expected fix target**, authored when the defect was injected. The seeds v14 scores were committed
in `82247ca` (seeds 01–03), `1253cbf` (seeds 04–05) — both 2026-07-31 — and `0c4f36c` (seeds 06–08,
2026-08-11); all three predate every run, checkable with `git merge-base --is-ancestor`, which is the
§AX0-preferred shape (a property of the artifact, not a certification about an author).

**What is actually unmeasured is narrower: whether a report's factual claims are TRUE.** That is
§AO2's own closing line, and it is why §AO2's row 09 scored **6/6 and cleared the gate while proposing
a fix at a column that does not exist** — re-confirmed by live read (`DESIGN.md` §5.6 correction (b)).
The judge reads report prose and never checks it against the instance. **Rows 09, 11 and 13 each
named their layer correctly and carried false claims anyway** — so the reliability gap sits *beside*
the layer call, not inside it, and that — not an absent measurement — is the gate.

**Blockers to this gate: 1.** Not `#212`: that instrument is built, measured and closed (§AX17.5), and
§AX17.3 rules that schema-level claim veracity cannot be bridged to root-cause correctness by
sharpening the adjudicator. The one surviving requirement is **§AX17.5 reason 2** — an adjudicator able
to settle **values and counts** against a reference state *contemporaneous with the run* — ruled a
*different instrument*, not an amendment. That is **#259**, re-scoped 2026-08-13 to that reason alone
and labelled `next`.

### Standing position, so it is not re-derived

- Last scored pass **v14**, `passes_gate`: native **5/10 · 50.0%** · custom **0/10 · 0.0%**. Quote
  both arms together, always (§AD7).
- **SC-1 itself** — `root_cause_layer_correct == 2`, the PRD's *"identifies the correct root cause"* —
  is a **different and looser figure** than the gate, because `passes_gate` ANDs in
  `fix_usable_unedited`. From `scorecard-v14.md` §1: native **7/10 · 70.0%** · custom **0/10 · 0.0%**.
  Native is **one row short** of SC-1's ≥ 8/10 bar. Both arms together (§AD7). **Quoted as a v14
  absolute; no cross-pass series is offered.** *(§AQ3 does not govern this figure — it binds the
  **v15 custom gate** figure and states in terms that "the native arm is unaffected … the native
  series remains continuous". A v12→v14 SC-1 series would need its own justification against §AN1a's
  not-single-variable finding, not §AQ3.)*
- **What 70.0% does NOT say.** It counts whether a report **named** the right layer — nothing more.
  §AO2's rows 09, 11 and 13 all named correctly *and* carried false factual claims (row 09's Fix 1
  repoints at a nonexistent column; row 11 claims 0 rows against a 21-row table; row 13 lists five
  `u_*` columns that do not exist). **Do not read 70.0% as seven sound diagnoses.** It is also not
  shown to be an *upper bound*: row 09's layer call is explicitly correct in §AO2, so it does not
  come out of the numerator, and row 11's alternative reading is a Build Rule #42 harness defect
  rather than a fabrication — §AO2 leaves that open.
- Native's middle band prescribes **triage only**; custom's bottom band prescribes **does not clear
  triage**. **Neither arm is a front door.**
- **Phase 1b is closed on the board but its milestone is NOT met.** Board state and acceptance
  criteria are different ledgers; do not read the release as the milestone.
- Phase 2 as written in the PRD ("React chat UI… full diagnose-and-export workflow") **assumes a
  front door exists**. It is mis-scoped until this gate answers, which is why it is not ranked.
- The v1–v14 instrument is **closed** (`DESIGN.md` §5). It reopens only under §5.6. Issue #212 is
  §5.6 reason 1 and commissions a *new* instrument — it does not amend the old one.

---

## Ranked queue

| # | Item | Why it ranks here |
|---|---|---|
| **1** | **#259 — capture run-contemporaneous reference state** (`next`, **re-scoped 2026-08-13**) | The gate's only remaining blocker. §AX17.5 reason 2: an adjudicator settling **values and counts** against a reference state **contemporaneous with the run** — the v14 snapshot reads the instance *now* and the runs it judges already happened, which is why 77% of claims came back `unresolvable` rather than false. A different instrument, not an amendment. **Two of its three filed candidate directions are dead and were removed:** direction 2 (score the diagnosis against seeded ground truth) is what `scorecard-template.md` §A2 has done **since v9**, and §AW0 rules that sharpening seed labels "would not have caught a single one of the three known-bad rows"; direction 3 (restrict to time-invariant claims) **is** #212, built and closed. Only direction 1 survives — capture reference state at run time — and it helps **future passes only**, which is the honest cost to weigh before committing. Inherited and not renegotiable: §AX7.2 (held-out set spent), §AX10 (n ≥ 10 custom bar), §AQ3, §AX0, §AX7.1 (**stopping condition written before the first pass**). **Design gate first, and §AX17.6 before that.** |
| 2 | **#253 — `CLAUDE.md` says there is no CI and no branch protection; both exist** | Not a gate blocker, so strictly register-class — ranked anyway because it is wrong *in the behaviour-changing direction* inside the file every session loads. `strict: true` means every branch needs rebasing onto `main`; `enforce_admins: true` means the escape hatch a reader would reach for (`gh pr merge --admin`) is refused. Costs a session per rediscovery, and #259 will run several PRs. ~10 minutes. |
| 3 | **#212 — commission the correctness axis** *(instrument complete, kept open as #259's parent)* | Built, run, scored and closed out (§AX17). AX-1a 96.7% passed, AX-4 passed and exercised, AX-2 pre-satisfied. **Its headline ask is not satisfied** — the issue says "score whether a root cause is RIGHT" and §AX17.3 concludes the axis scores claim veracity instead. Note the ask was *also mis-stated*: §AW0, filed under #212's own pre-registration, records that correctness was already scored. Kept open as #259's parent so the unmet half stays visible on the board rather than in a closed issue's tail. Closing it remains the operator's call. |
| — | Phase 2, shrunk — native triage + Fix Report export | The cheapest alternative source of correctness signal: put it in front of real SCs and let production supply the evidence. **Note it does NOT satisfy §5.6 reason 2**, which requires *the custom harness* in front of real users — shipping the native arm reopens nothing, so this buys production evidence on its own merits, not a reopening condition. Ranked below #1 because shipping a UI over an unmeasured diagnosis is the thing #1 exists to prevent. Considered and not chosen 2026-08-12. |
| — | Close out and package for handoff | `/senior-grade` + `handoff-readiness`. The fallback if #1's design gate concludes a correctness axis cannot be built affordably. Not scheduled. |

**The load-bearing constraint on #1** — from §5.0, which measured the failure mode: 103 issues created
and 84 closed in fourteen days with the board flat because inflow matched outflow. **A pre-registered
stopping condition must be written before the first pass.** A self-scrutinising instrument has no fixed
point unless one is declared up front, and that is precisely what the last one lacked. §AW7 now carries
that condition.

### Who may do what — the constraint that replaced blinding

**§AW's blind-author regime is retired** (`DECISION.md` §AX0/§AX9, PR #246). It protected the recall
figure with a property of the *author's context* — unverifiable from outside — and it cost three
dispatches, three aborts and zero measurement, two of the aborts caused by the operator's own repairs.
§AX substitutes properties of the **artifact**: the inventories were committed before the extractor
existed (checkable with `git log`), and the prompt is cleared mechanically. **A session that has run
`/next` may author this work.**

**What replaced it is narrower and still binding — §AX12.1.** The extractor is model-backed, so
"frozen" does not make its execution independent of what the executing context knows. Registered:
**each report is extracted in a fresh context holding only the frozen prompt and that one report** —
never the inventory fixture, never `DECISION.md`, never another report. *The operator dispatches; the
operator does not extract.* The brief's §6 ("contamination applies to authoring, not execution") is
superseded on exactly this point.

**And §AX12.2:** the prompt derives from §AX3 + §AX10's count ruling — the registered specification —
and from **nothing in the fixture**. Copying the inventory's seven reading rules into it would make
recall score two implementations of one operationalisation against each other, which is R-27 arriving
through the back door.

*History of the retired procedure, kept because it cost the most:* blinding rode in the **dispatching
session's context**, not the agent's working directory — an author placed outside the repo, with the
project memory already redacted on disk, still quoted the pre-redaction text. Redacting a memory does
not clear a session that already loaded it. Full record in §AW11a–f.

---

## Register — real, blocks no gate, not backlog

Not ranked and not counted as debt. A finding landing here is the register working correctly.

- ~~**`README.md` "Current standing" quotes a superseded figure.**~~ **Cleared 2026-08-12** in the same
  PR that created this file: the line quoted v12's **native 6/10 · 60%** while `DESIGN.md` §5.1 — same
  release, same day — records **v14** at **5/10 · 50.0%**. Now reads v14, with a note that the v12
  figures above it are retained only because they are what retired the cross-arm clauses.
- **`DESIGN.md` §5.3 — five documented-not-fixed instrument defects** (#202, #203, #204, #205, #207).
  Deliberately unscheduled with mechanism and measurement status recorded. #203's class is
  **0 of 301 runs observed**; #207's harmful variant is **0 of 2, unmeasured**; **#202 is unmeasured**.
  **#205 is the exception — it IS measured** (§AU: 4/4 reps queried `task` instead of
  `x_snc_tsbench_ticket`), and a candidate fix was measured *and reverted* on the 4/4 → 0/4 correctness
  collapse this file cites above as the reason for the gate. They reopen only under §5.6 — in
  particular §5.6 reason 3, a live observation.
- **Grade sitting 1 findings that block no gate** — **#219** (no rate limit on the endpoints that
  spend LLM calls) is the one still open. **#217** (coverage unmeasurable through the `vm` loader) and
  **#218** (`markRunning` TOCTOU) were both fixed and closed 2026-08-13, so the register shrank here
  without anything being re-ranked.
- **#251 — six route descriptions exceed the 80-char `short_description` column and are truncated at
  install.** Measured by the #220 deploy probe on gpinst01, which reports them as `truncated`:
  `sys_ws_definition` ×1, `sys_ws_operation` ×5. The platform stores the first 80 characters and drops
  the tail silently. Blocks no gate — the routes work — and the fix is a source edit in
  `src/fluent/rest-api.now.ts`. Filed 2026-08-13 with the `register` label, deliberately not scheduled.
- ~~**Four records cannot be probed at all** — `sys_gen_ai_feature_mapping` /
  `sys_gen_ai_strategy_mapping` return 403 to an admin.~~ **Retracted 2026-08-13 (#242, PR #250): the
  premise was a misdiagnosis.** The instance does not refuse those *tables*; it refuses any request
  carrying a `sysparm_query` — a bare read returns 200 with rows, `sysparm_fields=sys_id` returns 200,
  and only `sysparm_query=` draws *"Field(s) present in the query do not have permission to be read"*.
  Probe coverage went 161 → **165 of 165 records present** (161 field-matched, 4 presence-only).
  **Keep this one in view while building #212's adjudicator:** it is a third instance-side way for a
  read to come back looking like absence — alongside #187's nonexistent-field *Access denied* and
  Build Rule #42's no-ACL denial — and a denied column is **silently omitted rather than errored**.
  That is precisely the confusion §AX's `unresolvable` verdict exists to refuse to launder.
- **`DESIGN.md` §5.4 — four corrections to the record** (#183, #187, #110, #107). Facts, not work.
  #187 matters most in practice: **seed 07 must not be used to qualify an ACL behaviour** without
  re-deriving its bar, because its qualification query hits a nonexistent column and a bad field name
  returns *Access denied*, mimicking the missing-ACL failure it claims to have ruled out.
