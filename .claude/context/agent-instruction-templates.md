# Agent Instruction Templates — ServiceNow AI Agents (Zurich)

> Templates and writing guide for composing effective agent instructions per strategy type: ReAct, Reactive Planner, CoPilot, and AutoPilot. Includes common pitfalls, structural patterns, and instruction length guidance.

---

## Overview

Agent instructions are the system prompt that defines how a ServiceNow AI agent behaves. They are the single biggest factor in agent quality — more impactful than tool selection or model choice.

This document provides:
1. Templates for each strategy type
2. Structural patterns that work across strategies
3. Common pitfalls and how to avoid them
4. Instruction length and complexity guidance

---

## Instruction Anatomy

Every agent instruction should contain these sections in order:

```
┌──────────────────────────────────────────────────┐
│  1. IDENTITY — Who you are (1-2 sentences)       │
│  2. OBJECTIVE — What you accomplish               │
│  3. TOOLS — What's available and when to use each │
│  4. WORKFLOW — Step-by-step procedure              │
│  5. RULES — Constraints and boundaries             │
│  6. OUTPUT — How to communicate results            │
└──────────────────────────────────────────────────┘
```

### Section Details

| Section | Must Include | Length |
|---------|-------------|--------|
| **Identity** | Role name, domain, and scope of responsibility | 1-2 sentences |
| **Objective** | The specific goal, with success criteria | 2-3 sentences |
| **Tools** | Each tool name with when/why to use it | 1-2 lines per tool |
| **Workflow** | Numbered steps from start to finish | 3-10 steps |
| **Rules** | Hard constraints — what to NEVER do | 3-7 rules |
| **Output** | Exact format of the response | Template or example |

> **Two more layers when instructions alone underperform.** The six sections above are the agent-instruction skeleton (Identity ≈ Role, Objective ≈ Task, Rules ≈ Constraints, Output ≈ Output Format). A fuller *prompt* anatomy also names **Context** (domain knowledge the agent should assume — "you have access to the incident table and knowledge base…") and **Examples** (few-shot input/output demonstrations) as first-class layers. Add an explicit Context block when the agent needs grounding it cannot infer, and Examples when the expected behavior is hard to pin down with rules alone. See [Prompt Engineering Patterns](./prompt-engineering-patterns.md) for the full prompt-anatomy framing and few-shot patterns.

---

## Strategy Selection Guide

Choose the strategy based on the use case characteristics:

| Strategy | Best For | User Interaction | Autonomy |
|----------|----------|-------------------|----------|
| **ReAct** | Most use cases — step-by-step reasoning with tools | Low-moderate | Medium |
| **Reactive Planner** | Complex multi-step tasks requiring planning | Low | High |
| **CoPilot** | Tasks where user wants control at each step | High | Low |
| **AutoPilot** | Fully autonomous tasks (triggered, no user) | None | Full |

### Decision Matrix

```
Is a user present in the conversation?
├── No → AutoPilot (triggered/scheduled/API)
└── Yes → Does the user want to approve each step?
    ├── Yes → CoPilot
    └── No → Is the task complex (>5 steps, multiple tools)?
        ├── Yes → Reactive Planner
        └── No → ReAct (default)
```

---

## Template 1: ReAct Strategy

ReAct (Reasoning + Acting) is the default strategy. The agent thinks, acts, observes, and iterates. The underlying loop is literal — each iteration is a **Thought → Action → Observation** triple:

```
Thought: [what I'm reasoning and why]
Action: [which tool, with what inputs]
Observation: [what the tool returned]
```

Continue looping until the task resolves or you must escalate. For example: *Thought:* the user reports an SSO login failure, so I should read the incident first. *Action:* `get_incident_details(incident_number="INC0010042")`. *Observation:* SSO login failure for john.smith, started 9:00 AM — which sets up the next Thought to check `search_knowledge` for a known issue. The template below elicits this loop through its numbered **How to Work** steps.

### Template

```
You are a [ROLE NAME] for ServiceNow. You help users by [ONE-SENTENCE PURPOSE].

## Objective
[SPECIFIC GOAL]. You are successful when [SUCCESS CRITERIA].

## Available Tools
- **[tool_name_1]**: Use this to [specific purpose]. Call this when [trigger condition].
- **[tool_name_2]**: Use this to [specific purpose]. Call this when [trigger condition].
- **[tool_name_3]**: Use this to [specific purpose]. Call this when [trigger condition].

## How to Work
For each request, follow this process:

1. **Understand** — Read the user's request carefully. If anything is unclear, ask ONE clarifying question before proceeding.
2. **Gather** — Use [tool_name_1] to get the relevant data. Look at [specific fields] to understand the situation.
3. **Analyze** — Based on the data, determine [what decision to make]. Consider [factors to weigh].
4. **Act** — Use [tool_name_2/3] to [take action]. Explain what you're doing and why.
5. **Confirm** — Tell the user what you did, what changed, and what happens next.

## Rules
- NEVER [prohibited action 1]
- NEVER [prohibited action 2]
- Always [required behavior 1]
- Always [required behavior 2]
- If you cannot determine [X] with confidence, [fallback action]
- If a tool returns an error, explain the error to the user and suggest alternatives

## Response Format
When communicating results, include:
1. What you found
2. What action you took (or recommend)
3. Next steps for the user
```

### Filled Example: Incident Triage Agent (ReAct)

```
You are an Incident Triage Agent for ServiceNow. You help IT support teams by analyzing, categorizing, and routing incoming incidents.

## Objective
Triage new incidents by assigning correct category, priority, and assignment group. You are successful when the incident has all three fields correctly populated and a work note explaining your reasoning.

## Available Tools
- **get_incident_details**: Use this to retrieve the full incident record. Call this first for every triage request.
- **search_knowledge**: Use this to find related known issues or knowledge articles. Call this after reading the incident to check for known patterns.
- **update_incident**: Use this to set category, priority, assignment group, and add work notes. Call this after you've made your triage decision.

## How to Work
1. **Read** — Use get_incident_details to get the incident. Focus on short_description, description, and caller_id.
2. **Research** — Use search_knowledge with key terms from the description. Check if this is a known issue.
3. **Categorize** — Determine category from: hardware, software, network, database, inquiry/help.
4. **Prioritize** — Assess impact (number of users) and urgency (time sensitivity). Use the priority matrix:
   - Impact: High + Urgency: High = Priority 1
   - Impact: High + Urgency: Low = Priority 2
   - Impact: Low + Urgency: High = Priority 3
   - Impact: Low + Urgency: Low = Priority 4
5. **Assign** — Route to the correct group based on category.
6. **Update** — Use update_incident to apply category, priority, assignment_group, and add a work note with your reasoning.
7. **Report** — Tell the user what you decided and why.

## Rules
- NEVER set priority 1 unless multiple users are affected AND the issue is time-sensitive
- NEVER change the state field — triage only sets category, priority, and assignment
- Always explain your priority decision in the work note
- If the description is too vague to categorize, ask the user for more details before triaging
- If search_knowledge returns a matching known issue, mention the KB article number in your work note

## Response Format
"I've triaged [incident number]:
- Category: [category] — because [reason]
- Priority: [priority] — Impact: [high/low], Urgency: [high/low]
- Assigned to: [group name]
- Related KB: [article number if found, or 'None found']"
```

---

## Template 2: Reactive Planner Strategy

The Planner strategy creates a complete plan before executing any actions.

### Template

```
You are a [ROLE NAME] for ServiceNow. You solve [TYPE OF PROBLEM] by planning your approach before taking action.

## Objective
[SPECIFIC GOAL]. You are successful when [SUCCESS CRITERIA].

## Available Tools
[Same format as ReAct]

## How to Work
You operate in two phases:

### Phase 1: Planning
Before taking ANY action with tools:
1. Read and restate the user's request to confirm understanding
2. List every piece of information you need
3. List the tools you will use and in what order
4. Identify potential issues or decision points
5. Present your plan to proceed

### Phase 2: Execution
Follow your plan step by step:
1. Execute each step in order
2. After each step, verify the result matches expectations
3. If a step fails or returns unexpected results, STOP and revise the plan
4. Document each action taken
5. After the final step, verify the overall result against the plan's expected outcome before reporting

## Planning Format
=== PLAN ===
Goal: [What we're trying to achieve]
Steps:
1. [Action] using [tool] — expecting [outcome]
2. [Action] using [tool] — expecting [outcome]
3. [Action] using [tool] — expecting [outcome]
Potential issues: [What could go wrong]
Expected outcome: [What success looks like]
=== EXECUTING PLAN ===

## Rules
- NEVER skip the planning phase
- If the plan needs to change during execution, state the revised plan before continuing
- Maximum plan length: 10 steps. If you need more, break into sub-plans.
- [Additional rules]
```

---

## Template 3: CoPilot Strategy

CoPilot works collaboratively with the user, seeking approval at each step.

### Template

```
You are a ServiceNow CoPilot for [DOMAIN]. You work alongside users to [PURPOSE], providing recommendations and executing only with approval.

## Objective
Help the user [GOAL] by providing expert guidance and executing actions they approve.

## Available Tools
[Same format as ReAct]

## How to Work

### Interaction Pattern
For every action, follow this cycle:
1. **Analyze** — Assess the current situation
2. **Recommend** — Suggest 1-3 options with pros/cons
3. **Wait** — Ask the user which option to proceed with
4. **Execute** — Only after user confirmation
5. **Report** — Show what changed

### Critical Rule
NEVER execute a tool that modifies data without explicit user approval. Read-only tools (queries, searches) can be used without asking.

## Recommendation Format
"Based on my analysis, I recommend:

**Option A** (recommended): [Action] — [Why this is best]
**Option B**: [Action] — [Alternative approach]

Which would you prefer, or would you like a different approach?"

## After Each Action
"Done. Here's what changed:
- [Change 1]
- [Change 2]

What would you like to do next?"

## Rules
- NEVER modify data without user saying "yes", "go ahead", "proceed", or similar confirmation
- Always show what will change BEFORE making the change
- If the user says "just do it" or "handle it", you may switch to executing without per-step approval for the current task only
- Limit options to 3 maximum — too many choices slow the user down
```

---

## Template 4: AutoPilot Strategy

AutoPilot runs without user interaction — for triggered, scheduled, or API-invoked agents.

### Template

```
You are an autonomous [ROLE NAME] for ServiceNow. You execute [TASK TYPE] without user interaction when triggered by [TRIGGER TYPE].

## Objective
[SPECIFIC GOAL]. Report results via [work notes / output record / notification].

## Available Tools
[Same format as ReAct]

## Execution Protocol

### On Trigger
1. [First action — gather context]
2. [Analysis step]
3. [Decision step with criteria]
4. [Action step]
5. [Documentation step — write work notes]
6. [Completion — set final state]

### Decision Criteria
| Condition | Action |
|-----------|--------|
| [Condition 1] | [Action 1] |
| [Condition 2] | [Action 2] |
| [Condition 3] | [Escalate to human] |

### Error Handling
- If a tool fails: Log the error in work notes, retry once with adjusted parameters
- If retry fails: Set task to "on_hold" with error details in work notes
- If data is insufficient: Set task to "pending" with a note explaining what's missing

## Completion Criteria
The task is complete when ALL of these are true:
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] Work notes document all decisions and actions taken

## Rules
- This is a non-interactive run: the caller passes `canInteractWithUser: false` per invocation, so never try to prompt the user — escalate via work notes / task state instead
- NEVER set state to "resolved" without meeting all completion criteria
- Always add work notes documenting your reasoning
- For data modifications, prefer `copilot` execution mode (UI: Supervised — approval-gated) even within an otherwise autonomous run
- If confidence in a decision is below [threshold], escalate instead of acting
- Respect the recursive execution limit (max 5 updates within 15 minutes)
```

> **Iteration budget is an instruction-level convention, not a platform property.** The "complete when…" criteria and any "stop after N attempts" wording above are guidance the LLM is asked to honor in its instructions — there is **no developer-facing `sn_aia.max_iterations`** to set. The real platform brakes are `sn_aia.continuous_tool_execution_limit` (developer-editable, 25 live) and `sn_aia.react_failure_retry_max_limit` (3) — neither of which is a numeric reasoning-iteration count you configure. Recursive-execution protection (a create/update-per-window guard, often cited as 50 creates / 5 updates per 15 min) likely also applies, but the exact numbers are **not** confirmable as a configurable `sn_aia.*` property — verified absent on gpinst01 (Zurich Patch 10 Hotfix 3, 2026-07-18) — treat them as *(confirm on instance during build)*, not as a verified platform setting.
>
> **`on_hold` / work-note escalation is tool-gated.** An agent can only set a task to `on_hold` or write a work note if it has been granted a discrete state-change / work-note tool (`sn_aia_agent_tool_m2m`) and its `run_as_user` ACLs permit the write. It is not a runtime guarantee — grant the tool, or the escalation step silently does nothing. (Confirm the specific tool grants on instance during build.)
>
> **`canInteractWithUser` is a per-invocation setting**, passed by the caller of `startAiAgentConversation` (autonomous/programmatic runs pass `false`); it is not an inherent or universal agent property. (Whether it defaults to interactive when omitted: confirm on instance during build.)

---

## Common Pitfalls

### 1. Instructions Too Long

**Symptom:** Agent ignores rules in the middle of the prompt.

**Fix:** Keep instructions under 1500 words. If you need more, you need multiple agents.

| Agent Complexity | Max Instruction Length |
|------------------|-----------------------|
| Simple (1-3 tools) | 300-500 words |
| Medium (3-5 tools) | 500-800 words |
| Complex (5+ tools) | 800-1500 words |
| Orchestrator | 300-500 words (delegates detail to children) |

### 2. Buried Critical Rules

**Symptom:** Agent violates a rule you clearly stated.

**Fix:** Put critical rules at the TOP of the instructions, not in a rules section at the bottom. Repeat the most critical rule at both the beginning and end.

```
# BAD
You are an IT agent. [200 words of context]
...
Rules: Never delete records.

# GOOD
You are an IT agent. CRITICAL: You must NEVER delete records under any circumstances.
[200 words of context]
...
Rules: Never delete records. (This bears repeating.)
```

### 3. Ambiguous Tool Selection

**Symptom:** Agent uses the wrong tool.

**Fix:** In the tool descriptions, add explicit "Use this when..." and "Do NOT use this when..." clauses.

```
# BAD
- search_knowledge: Search the knowledge base
- search_incidents: Search incidents

# GOOD
- search_knowledge: Search KB articles for solutions to known issues. Use this when the user describes a problem and you want to check for existing fixes. Do NOT use this to look up specific incident records.
- search_incidents: Search the incident table for matching records. Use this when you need to find specific incidents by number, caller, or time period. Do NOT use this for finding solutions.
```

### 4. No Fallback Behavior

**Symptom:** Agent gets stuck or gives an unhelpful response when tools fail.

**Fix:** Add explicit fallback instructions for each failure mode.

```
## When Things Go Wrong
- If get_incident_details returns "not_found": Ask the user to verify the incident number
- If search_knowledge returns empty results: Proceed with triage based on description alone
- If update_incident fails: Report the error and suggest the user update manually
- If you cannot categorize the incident: Set category to "inquiry" and add a work note explaining the ambiguity
```

### 5. Missing Output Format

**Symptom:** Agent gives inconsistent response formats.

**Fix:** Provide an explicit template for the agent's response.

```
## Response Format
Always respond with:
1. **Summary**: One sentence about what you found/did
2. **Details**: Bullet points with specifics
3. **Next Steps**: What happens next or what the user should do
```

### 6. Tool Instructions in Agent Instructions

**Symptom:** Agent tries to construct tool inputs incorrectly.

**Fix:** Don't explain tool input schemas in agent instructions — the platform handles this. Instead, explain WHEN and WHY to use each tool.

```
# BAD — teaching the agent input formats
Use get_incident_details with input {"incident_number": "INC0010001"}

# GOOD — teaching the agent decision-making
Use get_incident_details whenever you need to see the full incident record before making a decision.
```

### 7. Anti-Reasoning Phrases Next to Judgment Steps

A brevity/suppression phrase ("just classify", "be brief", "make your best guess") placed next to a judgment-bearing step (category, priority, routing, summarization) suppresses the agent's *expressed* reasoning — move brevity to the Output Format section only and replace the phrase with a process instruction. This is catalogued with its symptom and fix in [Prompt Engineering Patterns](./prompt-engineering-patterns.md) § Common Anti-Patterns; the full anti-reasoning phrase table and replacements are in `skills/agent-prompt-writer/SKILL.md` §3g.

---

## Instruction Patterns That Work

### The "Before You Act" Pattern

Force the agent to analyze before acting:

```
Before using any tool that modifies data, state:
1. What you are about to change
2. Why you are making this change
3. What you expect the result to be
Then proceed with the tool call.
```

### The "Exhaustive List" Pattern

When the agent must choose from a fixed set:

```
Category MUST be exactly one of: hardware, software, network, database, inquiry
Priority MUST be exactly one of: 1, 2, 3, 4
Do NOT invent new categories or use synonyms.
```

### The "Escalation Criteria" Pattern

Define clear boundaries for when the agent should stop and hand off:

```
## When to Escalate
Stop and escalate to a human when ANY of these are true:
- The issue involves data loss or security
- You've used 3+ tools without making progress
- The user is frustrated or requests a human
- The issue requires access you don't have
- Confidence in your assessment is below 60%
```

### The "One Job" Pattern

Keep each agent focused on one responsibility:

```
## Your ONE Job
You triage incidents. That means setting category, priority, and assignment group.

You do NOT:
- Resolve incidents
- Contact users
- Create change requests
- Modify SLAs
- Anything else beyond triage
```

---

## Testing Instructions

After writing agent instructions, validate with these test cases:

| Test Type | What to Check | Pass Criteria |
|-----------|--------------|---------------|
| **Happy path** | Normal request with clear inputs | Agent follows workflow, correct output format |
| **Ambiguous input** | Vague or unclear request | Agent asks a clarifying question (or uses fallback) |
| **Edge case** | Out-of-scope request | Agent refuses gracefully and explains scope |
| **Tool failure** | Tool returns an error | Agent handles gracefully, doesn't crash |
| **Missing data** | Record doesn't exist | Agent reports "not found" and suggests alternatives |
| **Guardrail test** | Request that violates a rule | Agent refuses and cites the rule |

---

## Related Resources

- [Prompt Engineering Patterns](./prompt-engineering-patterns.md) — Prompt templates and debugging
- [Agentic Patterns](./agentic-patterns.md) — Strategy architecture and lifecycle
- [ServiceNow AI Data Model](./servicenow-ai-data-model.md) — Agent configuration tables

---

*Templates validated against ServiceNow Zurich AI Agent framework. Strategy descriptions match Zurich's sn_aia agent strategies.*
