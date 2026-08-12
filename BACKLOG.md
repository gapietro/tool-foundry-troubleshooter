# BACKLOG

Persisted by `/next` so no session re-derives priorities from scratch. Read this first when asked
what is next. Ranked by gate-distance, not by issue age or severity label.

**Last ranked:** 2026-08-12 (re-ranked after grade sitting 1) · at version `2026.08.1205` · board
6 open / 103 closed · 0 open PRs

> The board went 1 → 6 open because `/senior-grade` sitting 1 ran and filed F-03…F-07 as
> #216–#220. **That is the audit working as designed, not the backlog rotting** — audits are issue
> generators and run at milestones. Distance-to-gate did not move: it is still 1.

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
| **1** | **#212 — commission the correctness axis** (`next`) | Removes the release blocker above. It is the only open item that touches the current gate, and §5.2 says no further sharpening of the existing instrument can substitute for it. **Design before build** — `/design-spar` first; output lands as a pre-registration in `benchmark/DECISION.md`. |
| 2 | **#216 — no retention or purge for captured customer data** (F-04) | Named one of grade sitting 1's *three largest risks*, and the only open finding that is a **privacy** problem rather than a rigor problem. Blocks the **next** gate (installable on a customer instance / handoff), not this one — so it ranks below #1 but above everything else on the board. |
| 3 | **#220 — no automated integration tier** (F-07) | The one grade cap still standing after PR #222 lifted *No mandatory CI → B*. **Does not bind today** — raw 72.9 already sits below B+ — so it only starts costing once the score rises. Ranks as the gating item for grade sitting 2, not for now. |
| — | Phase 2, shrunk — native triage + Fix Report export | The cheapest alternative source of correctness signal: put it in front of real SCs and let production supply the evidence. **Note it does NOT satisfy §5.6 reason 2**, which requires *the custom harness* in front of real users — shipping the native arm reopens nothing, so this buys production evidence on its own merits, not a reopening condition. Ranked below #1 because shipping a UI over an unmeasured diagnosis is the thing #1 exists to prevent. Considered and not chosen 2026-08-12. |
| — | Close out and package for handoff | `/senior-grade` + `handoff-readiness`. The fallback if #1's design gate concludes a correctness axis cannot be built affordably. Not scheduled. |

**The load-bearing constraint on #1** — from §5.0, which measured the failure mode: 103 issues created
and 84 closed in fourteen days with the board flat because inflow matched outflow. **A pre-registered
stopping condition must be written before the first pass.** A self-scrutinising instrument has no fixed
point unless one is declared up front, and that is precisely what the last one lacked.

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
