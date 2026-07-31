---
name: design-challenge
description: Use after solution-design (or any architecture proposal) exists and before the first now-sdk build — the user asks to review the design, challenge the architecture, poke holes in it, or wants a pre-build design gate for a ServiceNow AI engagement. Adversarial review of the design itself; outputs DESIGN.md as the build contract.
scope: project
recommended: false
version: 1.0.0
---

# Design Challenge — Adversarial Pre-Build Gate

## Overview

The design gets stress-tested, not the human. Before anything is built, the proposed architecture must survive genuinely different alternatives, a ServiceNow failure catalog, and domain-boundary checks. The deliverable is `DESIGN.md` in the engagement project root — the contract the build is held to. Human approval of `DESIGN.md` is the gate.

Works on any architecture proposal: a solution-design output, a whiteboard summary, or a design stated in conversation.

## Process

**1. Restate.** Summarize the design's claims in your own words: components, where state lives and who owns it, triggers, external dependencies. Misstatements surface here, before any challenge — if the user corrects the restatement, re-restate until agreed.

**2. Options round.** Generate 2–3 genuinely different decompositions — e.g. single agent with many tools vs orchestrator/child agents, Now Assist skill vs AI agent, flow vs tool script, sync tool call vs async flow handoff. For each: main components, state ownership, its hardest failure mode, its biggest trade-off. Pick one with stated reasons — ratifying the original proposal is allowed only after real alternatives are on the table.

**3. Stress-test.** Run the chosen design through the failure catalog, one scenario at a time. Each scenario gets a recorded verdict — `handled` / `mitigated by <change>` / `accepted risk` — and a mitigation changes the design, not a footnote:

- LLM nondeterminism — same input, different tool-call sequence; hallucinated tool inputs
- Tool-script partial failure — script error mid-write, REST timeout, half-updated records
- ACL/scope denial — GlideRecordSecure returns silently empty results, not errors
- Missing or dirty instance data — the record the demo assumes doesn't exist
- Instance limits — execution timeouts, payload/attachment size caps
- Duplicate trigger firing and retry behavior — what happens on the second run
- Data Policy silent record drops at app install

**4. DDD-lite checklist.** Violations are design findings, not style notes:

| Check | Requirement |
|---|---|
| Bounded context → scoped app | One scoped app per context; table ownership explicit |
| Ubiquitous language | The same domain term appears identically in agent instructions, tool names, table labels, and skill prompts — no synonym drift |
| Aggregates → single writer | Every record type has exactly one writing owner (agent, tool, or flow); cross-context access goes through a tool interface, never a direct GlideRecord into another scope |

**5. Write `DESIGN.md`** at the engagement project root: components, state ownership, per-dependency failure handling (the catalog verdicts), alternatives rejected and why. Ask the user to approve it. Approved `DESIGN.md` is the contract — deviations during the build are ruled on against it (see the decision-record skill's drift review).

## Common mistakes

| Mistake | Fix |
|---|---|
| Ratifying the proposal without generating real alternatives | Options round always produces 2–3 genuinely different decompositions |
| Scenario verdicts with no design change | `mitigated` means the design changed; otherwise it's `accepted risk`, recorded |
| DDD violations noted but left in the design | Findings are fixed or explicitly accepted before DESIGN.md is written |
| Design lives only in chat | DESIGN.md is the artifact; chat is scratch |
