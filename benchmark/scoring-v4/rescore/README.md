# Rescore packets — 8 of the 10 runs graded 2026-08-02

## What this directory is

Eight scoring packets, one per run, to be graded independently by a blind scorer using the
same method that graded the twenty fresh 2026-08-03 runs. Each packet is a self-contained
grading unit: the rubric, the seed's specification, the run's full diagnostic report, and a
handful of measurement fields — nothing else.

The purpose is a like-for-like re-grade. The ten runs originally recorded in
`benchmark/scorecard-agent-doctor.md` (filled 2026-08-02) were scored by a human operator; the
twenty fresh runs were scored by independent blind scorers. Comparing the two sets as they stand
would conflate two different things — how the system behaved, and how the scoring method itself
differs — because the scorer type changed along with the date. Re-grading the original ten with
the same blind method used on the fresh twenty isolates the behavioral question from the scorer
question. This directory is the packet-building half of that: it hands a blind scorer everything
it needs to produce an independent verdict, and nothing that would let it grade to a known answer.

## How the packets were built

A recoverability probe (`.superpowers/sdd/2026-08-03-v4-scored-pass/task-12-probe-report.md`,
not tracked in git) queried gpinst01 read-only and established that the full Fix Report text for
8 of the 10 originally-scored runs is still retrievable verbatim, and located exactly where:
the last non-tool-call, `role=agent` message on each conversation's `sn_aia_execution_plan`, in
`sn_aia_message.message`. Each packet's report text was pulled from that field via the foundry
MCP server (`servicenow_connect` + `servicenow_request`, raw REST reads to avoid the audit
trail's 4,000-char digest truncation) and reproduced verbatim.

Each packet (`rescore-01-seed-01-run-2.md` through `rescore-08-seed-05-run-1.md`, numbered 01–08
in seed order) contains exactly four things:

1. **The rubric** — copied verbatim from `benchmark/scorecard-template.md`: §A's four scored
   columns and point values, §A2's `passes_gate` rule with its exact expression, §A3's void-run
   rule in full, and the partial-credit note for `fix_target_correct`.
2. **That seed's spec file**, in full, from `benchmark/seeds/`.
3. **That run's full Fix Report**, verbatim, as retrieved from `sn_aia_message.message`.
4. **That run's `layers_swept`, `layers_available`, `tool_calls`, and `wall_clock`**, copied
   as-is from `benchmark/scorecard-agent-doctor.md`'s row for that run — explicitly labeled as
   values recorded in the 2026-08-02 scorecard, not recomputed today, since unlike the fresh
   pass's rows they were not re-derived from the audit trail as part of building these packets.

## The two missing rows

Two of the ten originally-scored runs — **seed 01 run 1** and **seed 05 run 2** — have no packet
and were never going to. The probe established this is a **structural absence**, not a retrieval
failure: for both conversations, the model's own terminal turn was a short one-paragraph prose
summary, not the structured Fix Report. This was confirmed two independent ways — (a) every
message row in both conversations was read in full via raw REST, with no other candidate row
found, and (b) neither execution plan has any `sn_aia_execution_task` row of type `communicator`
(the platform's delivery step for a full-length message), where all 8 recoverable plans have
exactly one. No full report was ever produced as a delivered message for these two runs, so
there is nothing for a blind scorer to grade against the same standard applied to the other
eight. This fact needs to survive independently of the probe report, because
`.superpowers/sdd/` is gitignored and is deleted when the parent plan completes — this README is
the durable record of it.

## What was deliberately excluded from every packet

- **The operator's original scores.** No `passes_gate` value, no `/6` total, no filled rubric
  column, no scoring note from `benchmark/scorecard-agent-doctor.md` for this run or any other.
  This is the load-bearing exclusion: the entire point of a blind re-score is an independent
  verdict, and a scorer that can see the answer it is meant to reproduce is not blind.
- **Any other run's report text, identity, or measurements**, and **any other seed's spec.**
- **`benchmark/DECISION.md` content**, or any reference to a prior pass's conclusions,
  expectations, predictions, or this project's narrative.
- **Any statement that this is a re-score**, or that a prior verdict exists for this run. Each
  packet presents its run as one to be graded, full stop.
- **Any cross-system or cross-date comparison.**
