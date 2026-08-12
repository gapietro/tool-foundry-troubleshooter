# BACKLOG

Persisted by `/next` so no session re-derives priorities from scratch. Read this first when asked
what is next. Ranked by gate-distance, not by issue age or severity label.

**Last ranked:** 2026-08-12 (re-checked after PR #225 merged) · shipped at version `2026.08.1208` ·
board 6 open / 103 closed · 1 open PR (#226, this file's own release)

> The board went 1 → 6 open because `/senior-grade` sitting 1 ran and filed F-03…F-07 as
> #216–#220. **That is the audit working as designed, not the backlog rotting** — audits are issue
> generators and run at milestones. Distance-to-gate did not move: it is still 1.
>
> **What moved on the 2026-08-12 re-check:** PR #225 merged, landing `benchmark/DECISION.md` §AW —
> the claim-veracity axis pre-registration. **#212's design gate is discharged.** #212 stays #1 and
> stays `next`, but its next action is no longer "design it"; it is **build the extractor blind and
> burn the calibration one-shot**. Ranking otherwise unchanged, so the rubric is not re-run below.

---

## Current gate

**Measure whether the Troubleshooter's root causes are RIGHT.**

PRD Success Criterion 1 — *"identifies the correct root cause in ≥ 8/10"* — has never been measured.
Benchmark passes v1–v14 scored **admissibility** (well-formed, sourced, determinate), not
**correctness**. `DESIGN.md` §5.2 is the finding that forced this gate and it is the repo's own:
§AO2 scored a row **6/6 proposing a fix at a column that does not exist**, and §AU passed every
registered prediction with no trigger firing while correctness collapsed **4/4 → 0/4**.

**Blockers to this gate: 1** (`#212`). That is the number that carries weight — not the open count.

### Standing position, so it is not re-derived

- Last scored pass **v14**: native **5/10 · 50.0%** · custom **0/10 · 0.0%**. Quote both arms
  together, always (§AD7).
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
| **1** | **#212 — commission the correctness axis** (`next`) · **Stage 2, in flight** | Removes the release blocker above. It is the only open item that touches the current gate, and §5.2 says no further sharpening of the existing instrument can substitute for it. ~~**Design before build** — `/design-spar` first~~ **Design gate discharged 2026-08-12** (§AW, PR #225). Next action: author the extractor **blind**, freeze it, then burn the calibration set once. See *The blinding constraint* below before starting work — it changes **who** may do it. |
| 2 | **#216 — no retention or purge for captured customer data** (F-04) | Named one of grade sitting 1's *three largest risks*, and the only open finding that is a **privacy** problem rather than a rigor problem. Blocks the **next** gate (installable on a customer instance / handoff), not this one — so it ranks below #1 but above everything else on the board. |
| 3 | **#220 — no automated integration tier** (F-07) | The one grade cap still standing after PR #222 lifted *No mandatory CI → B*. **Does not bind today** — raw 72.9 already sits below B+ — so it only starts costing once the score rises. Ranks as the gating item for grade sitting 2, not for now. |
| — | Phase 2, shrunk — native triage + Fix Report export | The cheapest alternative source of correctness signal: put it in front of real SCs and let production supply the evidence. **Note it does NOT satisfy §5.6 reason 2**, which requires *the custom harness* in front of real users — shipping the native arm reopens nothing, so this buys production evidence on its own merits, not a reopening condition. Ranked below #1 because shipping a UI over an unmeasured diagnosis is the thing #1 exists to prevent. Considered and not chosen 2026-08-12. |
| — | Close out and package for handoff | `/senior-grade` + `handoff-readiness`. The fallback if #1's design gate concludes a correctness axis cannot be built affordably. Not scheduled. |

**The load-bearing constraint on #1** — from §5.0, which measured the failure mode: 103 issues created
and 84 closed in fourteen days with the board flat because inflow matched outflow. **A pre-registered
stopping condition must be written before the first pass.** A self-scrutinising instrument has no fixed
point unless one is declared up front, and that is precisely what the last one lacked. §AW7 now carries
that condition.

### The blinding constraint on #1 — it decides *who* writes the extractor

§AW4 makes the calibration set a **one-shot consumable** and names a deny-list the extractor's author
may not read. Two consequences that are easy to lose across a `/clear`:

1. **The extractor must be authored by a fresh-context agent, not by the session that ranks the board.**
   Ranking requires reading *this file*, and this file restates the answer for one calibration row two
   sections up. A session that has run `/next` is contaminated by construction and cannot be the author.
   Dispatch with an explicit deny-list and require a written blinding attestation; §AW4 puts the burden
   of demonstrating blindness on the **author**, not on a reviewer to prove contamination.
2. **Review the returned extractor for shape, lint and tests only.** Steering its claim-detection
   heuristics from a contaminated position is tuning against the answer key at one remove, and §AW4
   voids the recall figure on exactly that — which per §AW8 voids the veracity figure with it.

3. **Blinding is a property of the DISPATCHING SESSION, not of the author — demonstrated twice, and
   the obvious fix was refuted.** Two authors were dispatched; both aborted on a contamination
   tripwire before writing a line. Neither opened a deny-listed file. The project **auto-memory** —
   which restated a calibration row's answer — is injected into every agent spawned from a session
   scoped to this project. The second dispatch tested the fix: author placed *outside the repo*,
   memory already redacted on disk. **It was contaminated anyway, quoting the pre-redaction text** —
   so the injection rides in the dispatching session's context, not the agent's working directory,
   and **redacting the memory does not clear a session that already loaded it.**

   **Therefore: no agent spawned from a session that has run `/next` can author this.** It must be
   authored from a **session started fresh after the redaction**, whose context never carried the
   answer. See §AW11a for the full finding and for defect 10 (`scorecard-template.md` §A2 discloses
   a seed's decoy — ruled acceptable, seed 04 is not in the corpus).

**Status 2026-08-12 (updated):** two dispatches, two aborts, nothing authored. Project auto-memory
**redacted** (backup outside the repo). **Nothing reviewed, nothing merged, and the calibration burn
has not fired — the instrument is intact and the cost so far is two dispatches.**

**The dispatch brief now exists: `benchmark/EXTRACTOR-BRIEF.md`.** It is answer-free by construction
and safe to hand to a clean session. Three things changed with it, all in `DECISION.md` §AW11b:

1. **Defect 11** — two more leak sources §AW4 never named (`benchmark/scorecard-v14.md` §5, which
   discloses all three calibration answers in prose, and `benchmark/v14-ambiguity-flags.json`
   `_caution`). Found by grep, not by review. **The deny-list is retired for a closed allowlist**;
   a guard that has failed three times the same way is not short two entries.
2. **The author is not told which rows are the sensitivity set.** Naming them would license an
   extractor that fires on exactly those three and scores perfect recall while measuring nothing.
3. **The blind author freezes; a contaminated operator fires the sweep.** Contamination bounds
   *authoring*, not *execution* — once frozen, adjudication is deterministic.

**Next action: start a fresh session in a scope that never carried the answer, and give it
`benchmark/EXTRACTOR-BRIEF.md`.** Not a subagent of a session that has run `/next`.

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
- **Grade sitting 1 findings that block no gate** — **#217** (coverage unmeasurable: the `vm` loader
  bypasses istanbul, so all 21 production files report 0%), **#219** (no rate limit on the endpoints
  that spend LLM calls), **#218** (`markRunning` TOCTOU). #218 is here on the grade's own reasoning,
  not by dismissal: it is **deliberate and documented with a stated trade-off**, which is why sitting 1
  reported it P2 *and declined to use it as a cap* — an accidental race would have capped at B.
- **`DESIGN.md` §5.4 — four corrections to the record** (#183, #187, #110, #107). Facts, not work.
  #187 matters most in practice: **seed 07 must not be used to qualify an ACL behaviour** without
  re-deriving its bar, because its qualification query hits a nonexistent column and a bad field name
  returns *Access denied*, mimicking the missing-ACL failure it claims to have ruled out.
