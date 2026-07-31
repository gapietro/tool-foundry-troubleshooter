---
name: decision-record
description: Use during or after a ServiceNow SDK build to document why it is built the way it is — the user asks to document the architecture, capture design decisions, write ARCHITECTURE.md, or run a drift review against DESIGN.md. Produces dated ADR-lite decision entries with confirmation status; complements servicenow-c4-architect, which documents structure from the live instance.
scope: project
recommended: false
version: 1.0.0
---

# Decision Record — As-Built Architecture With Owned Decisions

## Overview

`servicenow-c4-architect` documents *structure* discovered from the live instance; this skill documents *decisions and why* from the repo. Facts come from the Fluent source and git history; rationale is traceable to `DESIGN.md` or the user — anything else is marked inferred or unowned, never silently presented as intent. Deliverable: `ARCHITECTURE.md` at the engagement project root with an append-only Decisions section. Use both skills together for a full handoff package.

## Process

**1. Sweep.** Read `src/fluent/` and git/PR history. Collect every non-obvious choice — anything with a plausible rejected alternative: agent decomposition, tool granularity, sync vs async, what is retried vs fatal vs tolerated, what is persisted where, trigger choice. Sort into probable decisions and probable bugs.

**2. ADR-lite entries.** One dated entry per decision:

```markdown
### 2026-07-29 — Orchestrator + 2 child agents (confirmed)
Chose: orchestrator pattern, over: single agent with 6 tools,
because: <reason traceable to DESIGN.md or user>, accepting: handoff latency.
Revisit when: child agents share >2 tools.
```

Status is `confirmed` (traceable to `DESIGN.md` or an explicit user statement), `inferred — unconfirmed`, or `unowned` (nobody chose it; it was the default).

**3. Required sections.** Overview + component map, then one section per dimension:

- **State & data flow** — which tables/records hold state, who reads and writes them
- **Failure modes & partial success** — what is retried, what is fatal, what is silently tolerated
- **Boundaries & interfaces** — scope/ACL surface, every cross-scope access point
- **Observability** — "how would we know this is broken in production?" If the answer is "we wouldn't," write exactly that; it is a finding, not an omission.

The final document is: Overview + component map, Decisions (append-only), the four dimension sections, Known Gaps.

When assessing boundaries, apply the DDD-lite checklist from the design-challenge skill — the same three checks, applied to what was actually built.

**4. Known Gaps.** Probable bugs listed as bugs — never dressed up as trade-offs.

**5. Drift review** against `DESIGN.md`: each deviation from the approved design is either ratified (new dated entry referencing the design decision it supersedes) or filed in Known Gaps. If no `DESIGN.md` exists, note that in the Decisions section and skip the drift review.

**6. Supersede, don't rewrite.** When a documented decision changes later, append a new dated entry referencing the old one; history stays.

## Common mistakes

| Mistake | Fix |
|---|---|
| Inferred rationale presented as intent | Every entry carries a confirmation status |
| Bugs presented as trade-offs | Known Gaps section |
| Skipping observability because nothing is instrumented | "We wouldn't know" is itself the finding |
| Rewriting old entries when a decision changes | Append a dated superseding entry; history stays |
