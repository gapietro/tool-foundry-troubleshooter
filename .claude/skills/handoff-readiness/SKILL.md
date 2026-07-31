---
name: handoff-readiness
description: Use at ServiceNow engagement close to verify the build can actually be handed off — the user asks "are we ready to hand off", mentions customer handoff or a handoff readiness check, or wants the runbook and ownership package for a POC. Verifies rationale coverage, writes and verifies the HANDOFF.md runbook, and proves it with a sabotage test on the POC instance.
scope: project
recommended: false
version: 1.0.0
---

# Handoff Readiness — Verified Ownability Gate

## Overview

Ownership is a property of the artifacts, verified — not assumed from a walkthrough. The build is ready to hand off when every component's rationale is documented, a runbook exists, and the runbook demonstrably diagnoses a real failure using only what the customer will have. Output: `HANDOFF.md` at the engagement project root, ending in an explicit pass/fail readiness verdict.

## The three checks

**1. Rationale coverage.** Every agent, tool, and skill in `src/fluent/` maps to a `DESIGN.md` or `ARCHITECTURE.md` entry. Orphan artifacts are findings — document or delete before handoff. If `ARCHITECTURE.md` does not exist, run the decision-record skill first.

**2. Runbook.** Write or verify `HANDOFF.md`: per-component diagnostic paths — symptom → where to look → which tool — using only what the customer will have: platform UI (AI Agent execution views, flow execution details), system logs, instance-side trace views. Include the observability answers from `ARCHITECTURE.md`; where the answer was "we wouldn't know," the runbook must state what to add or what risk is accepted.

**3. Sabotage test.** Seed one realistic failure on the POC instance — deactivate a tool, corrupt an input record, revoke a role — then diagnose it using only the runbook: follow `HANDOFF.md` from symptom to root cause without leaning on session memory or the repo. If the runbook does not lead to the diagnosis, the gap is the finding: fix the runbook or the observability, then re-test with a fresh seeded failure.

## Guardrails

- POC/dev instance only — never a customer production instance.
- Sabotage touches configuration and data only — never destructive schema changes.
- Forced cleanup of every seeded failure before the session ends, verified by re-running the happy path end to end.

## Verdict

`HANDOFF.md` ends with a dated readiness verdict: **PASS** (all three checks) or **NOT READY** with the open findings. A failed sabotage test is never a demo problem — it is an observability or runbook gap, and the fix → re-test loop runs until it passes.

## Common mistakes

| Mistake | Fix |
|---|---|
| Diagnosing the sabotage from session memory | Only the runbook and customer-visible views count |
| Skipping cleanup verification | Happy-path re-run after cleanup is mandatory |
| Failed sabotage treated as bad luck | It is a runbook/observability gap; fix and re-test |
| Handing off with orphan artifacts | Document or delete; orphans block the verdict |
