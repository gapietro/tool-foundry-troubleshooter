# CRISP Intake Template

Use this template to gather requirements before building an agentic prompt. The CRISP
framework requires explicit definitions for every decision point, so thoroughness here
prevents ambiguity in the final output.

## 1. Agent Identity

**What is the agent's name?**
(A clear, descriptive name — e.g., "IT Incident Triage Agent")

**What specific problem does this agent solve?**
(One sentence — the outcome, not the process)

**Who are the target users?**
(Role, technical level, what they expect from the interaction)

**What can the agent do? (Explicit capabilities)**
(List every action the agent is authorized to perform)

**What can the agent NOT do? (Explicit boundaries)**
(List actions that are outside scope — be specific)

## 2. Rules & Constraints

**What are the absolute non-negotiable rules?**
(Things that must NEVER be violated — regulatory, safety, data handling)

**What data must NEVER be assumed or fabricated?**
(Identify specific data types that must always come from tool lookups)

**When should the agent stop and escalate to a human?**
(List specific trigger conditions for escalation)

**What happens when a tool fails?**
(For each critical tool, define the fallback behavior)

## 3. Intent & Success Criteria

**What is the agent's primary goal?**
(One sentence — the observable outcome)

**What does success look like?**
(3-5 observable, measurable outcomes)

**What does failure look like?**
(What must never happen? What has gone wrong before?)

**When is the agent "done"?**
(The specific signal that the task is complete)

## 4. Workflow & Decision Logic

**Walk through the primary workflow step by step.**
For each step, capture:
- What action does the agent take?
- What conditions determine the next step?
- What happens if the expected condition isn't met?
- What happens if the agent isn't sure?

**Step 1:** ___
- If ___: then ___
- If ___: then ___
- If uncertain: ___

**Step 2:** ___
- If ___: then ___
- If ___: then ___
- If uncertain: ___

**Step 3:** ___
- If ___: then ___
- If ___: then ___
- If uncertain: ___

(Add more steps as needed)

**What are the termination conditions?**
(When does the workflow end? When should it abort?)

## 5. Tools & Systems

**What tools/APIs/systems does the agent access?**

For each tool, capture:
- Name and purpose
- What data it reads/writes
- When to use it
- When NOT to use it
- Common error states and recovery actions
- Execution mode (supervised/autonomous)

**Are there tools that are easily confused?**
(Pairs of tools where the agent might pick the wrong one — define disambiguation)

## 6. Patterns & Examples

**Provide a happy-path example:**
- User says: "___"
- Agent should: ___
- Why this is correct: ___

**Provide an edge case example:**
- User says: "___"
- Agent should: ___
- Why this is correct: ___

**Provide an escalation/refusal example:**
- User says: "___"
- Agent should: ___
- Why this is correct: ___

## 7. Autonomy Assessment

**How much independent action should this agent take?**

- [ ] Tier 1 — Advisory only (analyze, recommend, no actions)
- [ ] Tier 2 — Propose actions for human approval
- [ ] Tier 3 — Act with logging and human override on high-impact decisions
- [ ] Tier 4 — Fully autonomous within defined boundaries

**What decisions require human approval?**
(List specific actions that should pause for confirmation)

**What can the agent do independently?**
(List actions the agent can take without asking)

## 8. Output Format

**What format should agent responses use?**
(Structured, free-form, template-based?)

**What information must always be included in responses?**
(Mandatory fields or data points)

**What tone and style?**
(Professional, conversational, technical?)

## 9. Integration Context

**What platform is this running on?**
(ServiceNow version, plugins installed)

**Is this a single agent or part of a multi-agent workflow?**
- [ ] Single agent
- [ ] Child agent (part of a larger workflow)
- [ ] Orchestrator (coordinates other agents)

**If multi-agent: what other agents exist and what are their scopes?**

## 10. Evolution Plan

**How should this agent's autonomy change over time?**
(What milestones would justify increasing its freedom?)

**What new capabilities might be added later?**
(Plan for extensibility)
