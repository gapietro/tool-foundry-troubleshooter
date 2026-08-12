# BACKLOG

Persisted by `/next` so no session re-derives priorities from scratch. Read this first when asked
what is next. Ranked by gate-distance, not by issue age or severity label.

**Last ranked:** 2026-08-12 · at version `2026.08.1202` · board 0 open / 103 closed

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
| 2 | Phase 2, shrunk — native triage + Fix Report export | The cheapest alternative source of correctness signal: put it in front of real SCs and let production supply the evidence (§5.6 reason 2). Ranked below #1 because shipping a UI over an unmeasured diagnosis is the thing #1 exists to prevent. Considered and not chosen 2026-08-12. |
| 3 | Close out and package for handoff | `/senior-grade` + `handoff-readiness`. The fallback if #1's design gate concludes a correctness axis cannot be built affordably. Not scheduled. |

**The load-bearing constraint on #1** — from §5.0, which measured the failure mode: 103 issues created
and 84 closed in fourteen days with the board flat because inflow matched outflow. **A pre-registered
stopping condition must be written before the first pass.** A self-scrutinising instrument has no fixed
point unless one is declared up front, and that is precisely what the last one lacked.

---

## Register — real, blocks no gate, not backlog

Not ranked and not counted as debt. A finding landing here is the register working correctly.

- **`README.md:50` quotes a superseded figure.** "Current standing" reads **v12: native 6/10 · 60%**
  while `DESIGN.md` §5.1 — same release, same day — records **v14** as the last scored pass at
  **5/10 · 50.0%**. Same band, so no prescription changes, but the front door quotes the oldest *and*
  highest figure. One-line fix; fold into the next docs PR rather than picking it up alone.
- **`DESIGN.md` §5.3 — five documented-not-fixed instrument defects** (#202, #203, #204, #205, #207).
  Deliberately unscheduled with mechanism and measurement status recorded. #203's class is
  **0 of 301 runs observed**; #207's harmful variant is **0 of 2, unmeasured**; #202 and #205's fix
  are unmeasured. They reopen only under §5.6 — in particular §5.6 reason 3, a live observation.
- **`DESIGN.md` §5.4 — four corrections to the record** (#183, #187, #110, #107). Facts, not work.
  §187 matters most in practice: **seed 07 must not be used to qualify an ACL behaviour** without
  re-deriving its bar, because its qualification query hits a nonexistent column and a bad field name
  returns *Access denied*, mimicking the missing-ACL failure it claims to have ruled out.
