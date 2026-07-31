# SIGNAL Intake Template

Use this template to gather requirements before building an agentic prompt. Not every field
is required for every agent — use judgment about what's relevant.

## 1. Outcome Definition

**What result does this agent deliver?**
(Focus on the outcome for the user, not the process. "Resolved incidents with root cause
documented" not "processes incidents")

**Who are the users?**
(Role, technical level, what they expect from the interaction)

**What does a successful interaction look like?**
(Describe 1-2 scenarios in plain language)

**What does failure look like?**
(What must never happen? What has gone wrong before?)

## 2. Autonomy Assessment

**How much independent action should this agent take?**

- [ ] Tier 1 — Advisory only (analyze, recommend, no actions)
- [ ] Tier 2 — Propose actions for human approval
- [ ] Tier 3 — Act with logging and human override on high-impact decisions
- [ ] Tier 4 — Fully autonomous within defined boundaries

**What decisions require human approval?**
(List specific actions that should pause for confirmation)

**What can the agent do independently?**
(List actions the agent can take without asking)

## 3. Tools & Systems

**What tools/APIs/systems does the agent access?**

For each tool, capture:
- Name and purpose
- What data it reads/writes
- Authentication/permissions
- Rate limits or latency considerations
- Common error states

**Are there tools the agent should NOT use in certain situations?**

## 4. Domain Knowledge

**What does the agent need to know about the business domain?**
(Industry terms, organizational structure, process context)

**What specialized knowledge should it have?**
(Compliance requirements, SLAs, escalation paths)

**What does it NOT know and must look up?**
(Real-time data, user-specific info, things that change)

## 5. Expert Behavior

**How does a skilled human handle this task today?**
(Walk through their decision-making process, not just their steps)

**Where do experts use judgment?**
(The moments where experience matters — these become heuristics)

**What are the common mistakes less experienced people make?**
(These become guardrails or heuristic warnings)

## 6. Constraints & Compliance

**What are the absolute non-negotiable rules?**
(Regulatory, safety, data handling — things that must never be violated)

**What are strong preferences vs. hard rules?**
(Separate "we prefer X" from "we must do X" — only hard rules go in Guardrails)

## 7. Integration Context

**What platform is this agent running on?**
(ServiceNow, custom app, API-based, etc.)

**Token/context window constraints?**

**What information is available at runtime vs. design time?**
(What's in the system prompt vs. injected per-conversation)

## 8. Evolution Plan

**How should this agent's autonomy change over time?**
(What milestones would justify increasing its freedom?)

**What new capabilities might be added later?**
(Plan for extensibility in the prompt structure)
