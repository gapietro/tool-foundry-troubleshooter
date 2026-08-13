# BACKLOG

Persisted by `/next` so no session re-derives priorities from scratch. Read this first when asked
what is next. Ranked by gate-distance, not by issue age or severity label.

**Last ranked:** 2026-08-13 · shipped at version `2026.08.1309` · board **4 open** / 115 closed ·
**0 open PRs** · **blockers to gate: 1**

> **What moved since the 2026-08-12 ranking — #212 stopped being procedure and became code.**
> §AX landed (`0e895e0`), retiring §AW's blind-author regime for artifact-level clearing; the seven
> held-out claim inventories were committed **before any extractor existed** (`77ef851`), which is the
> guarantee §AX2.2 rests on and is verifiable by anyone with `git log`; §AX11 closed the
> small-denominator reportability term (`c1f5969`); and the **extractor itself merged**
> (`29e3266`, §AX12) — frozen prompt, deterministic plumbing, mutation-verified clearing check.
> Three dispatch attempts had produced three aborts and zero code; that arc is closed.
>
> Also closed since: #216, #217, #218, #220, #234, #235, #236, #239, #241, #242. **The board shrank
> while the register grew — that is the shape a good week has here.**
>
> **Still zero figures.** No sweep has run, and there is no adjudicator anywhere in the tree. The gate
> has not moved because nothing yet produces a number.
>
> **This session (the one that ranked) may build and dispatch, but may NOT extract.** §AX retired the
> blinding-by-author rule, so a `/next` session can author. §AX12.1 replaced it with a narrower and
> checkable one: extraction of each report happens in a **fresh context holding only the frozen prompt
> and that one report**. This session has read a held-out proposition and the denominators, so it
> dispatches extraction rather than performing it.

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
| **1** | **#212 — commission the correctness axis** (`next`) · **build stage, in flight** | Removes the release blocker above. Still the only open item touching the current gate, and §5.2 says no further sharpening of the existing instrument can substitute for it. **Design gate discharged twice** — §AW (PR #225), then re-registered as §AX (PR #246) when the blind-author procedure was retired. **Done:** inventories committed pre-extractor (§AX2.2), extractor authored and cleared (§AX5/§AX12), **adjudicator built and unit-green (§AX13, v`2026.08.1310`)** — three-valued, injected probe, control-paired, mutation-verified clearing. **Next action: (b) dispatch the sweep** in fresh per-report contexts (§AX12.1), which requires the real metadata probe wired to the foundry MCP tools; **(c) then adjudicate inventory-driven (§AX2.4) → per-arm recall, spurious rate, veracity, AX-4.** Adjudicator went first because **the sweep effectively freezes the extractor**: §AX7.2 rules that repairing it in response to held-out misses leaves *no valid recall figure from v14 at all*, and the eligible 15 reports are exhausted by the two sets — so a plumbing bug discovered after the sweep is indistinguishable from a real miss and cannot be re-earned. |
| 2 | **#253 — CLAUDE.md states there is no CI and no branch protection; both exist** | Premise verified at ranking time: `.github/workflows/ci.yml` is present and `main` requires the `build · test · lint` status check. A false statement in the **always-loaded** instruction file, so every session is told nothing enforces the checks and nothing blocks a merge. Blocks the **handoff** gate (a runbook that misdescribes the merge path), not this one — and it is a docs edit, so it ranks second on leverage, not on weight. |
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
