---
name: agent-prompt-writer
description: Take a use case, strategy, and tool list — produce effective agent instructions with role definition, workflow, tool usage guidance, guardrails, and output format.
scope: project
recommended: false
version: 1.0.0
---
# Skill: Agent Prompt Writer

> Take a use case, strategy, and tool list — produce effective agent instructions with role definition, workflow, tool usage guidance, guardrails, and output format.

---

## Overview

This skill guides you through writing agent instructions (system prompts) for ServiceNow AI Agents. Given a use case description, selected strategy, and list of available tools, it produces instructions that are clear, complete, and follow tested patterns.

Agent instructions are the most impactful component of an AI agent. A good prompt turns mediocre tools into a great agent. A bad prompt makes great tools useless.

## When to Use

Use this skill when:
- Creating a new AI agent and need to write its instructions
- Improving an existing agent whose behavior is incorrect
- Converting a use case from a solution spec into agent instructions
- Switching an agent from one strategy to another

## Prerequisites

**Read these context files FIRST:**
1. `agent-instruction-templates.md` — Strategy-specific templates
2. `prompt-engineering-patterns.md` — Prompt patterns and debugging
3. `agentic-patterns.md` — Strategy details (ReAct, Planner, CoPilot, AutoPilot)
4. `agent-reasoning-patterns.md` — Reasoning-elicitation index (how platform ReAct reasoning works, where elicitation/self-improvement/verification live)

**Information needed before starting:**
- Use case description
- Selected strategy
- List of tools the agent will have access to
- Trigger type (chat, record, scheduled, API)

---

## Instructions

### Step 1: Collect Agent Specification (REQUIRED — DO NOT SKIP)

**STOP.** Gather this information before writing any instructions:

| # | Required Information | Source |
|---|---------------------|--------|
| 1 | **Agent name** | Solution spec or user |
| 2 | **Agent purpose** (one sentence) | Solution spec or user |
| 3 | **Strategy** (ReAct, Planner, CoPilot, AutoPilot) | Solution spec or select based on use case |
| 4 | **Tool list** with descriptions | From Tool Builder output or solution spec |
| 5 | **Trigger type** (chat, record, scheduled, API) | Solution spec or user |
| 6 | **End user profile** | Solution spec (who interacts with this agent?) |

If strategy is not specified, recommend based on this matrix:

| Scenario | Recommended Strategy |
|----------|---------------------|
| User present, standard Q&A or task | **ReAct** |
| User present, complex multi-step | **Reactive Planner** |
| User present, wants control at each step | **CoPilot** |
| No user, triggered/automated | **AutoPilot** |

### Step 2: Select the Template

Go to `agent-instruction-templates.md` and copy the template for the selected strategy:
- Template 1: ReAct
- Template 2: Reactive Planner
- Template 3: CoPilot
- Template 4: AutoPilot

### Step 3: Fill In the Template

Work through each section of the template:

#### 3a: Identity Section

Write 1-2 sentences defining who the agent is:

```
Pattern: "You are a [ROLE] for ServiceNow. You [PRIMARY ACTION] by [METHOD]."

Examples:
- "You are an incident triage agent for ServiceNow. You analyze incoming incidents and assign correct category, priority, and assignment group."
- "You are a change approval advisor for ServiceNow. You review change requests and recommend approval, rejection, or additional review."
```

**Rules:**
- Keep it to 1-2 sentences
- Be specific about the domain (not "you help with everything")
- Include the primary action verb (triage, analyze, create, review, resolve)

#### 3b: Objective Section

State the specific goal and success criteria:

```
Pattern: "[WHAT TO ACHIEVE]. You are successful when [MEASURABLE OUTCOME]."

Examples:
- "Triage incidents within 30 seconds by setting category, priority, and assignment group. You are successful when all three fields are correctly populated and a work note explains your reasoning."
- "Draft professional customer responses. You are successful when the response acknowledges the issue, provides status, and includes next steps."
```

#### 3c: Tools Section

For EACH tool, write when and why to use it:

```
Pattern: "- **[tool_name]**: Use this to [purpose]. Call this when [trigger condition]."

Examples:
- "- **get_incident_details**: Use this to retrieve the full incident record. Call this first for every new triage request."
- "- **search_knowledge**: Use this to find related KB articles. Call this after reading the incident to check for known issues. Do NOT use this for looking up specific incident records."
```

**Critical:** Add "Do NOT use this for..." when tools could be confused with each other.

#### 3d: Workflow Section

Write numbered steps from start to finish:

```
Pattern:
1. **[ACTION VERB]** — [What to do and why]
2. **[ACTION VERB]** — [What to do and why]
...
```

**Rules:**
- Start each step with a bold action verb
- 3-10 steps maximum
- Include decision points ("If X, then Y")
- End with a reporting/communication step

#### 3e: Rules Section

Write hard constraints — things the agent must NEVER do:

```
Pattern:
- NEVER [prohibited action]
- Always [required behavior]
- If [condition], then [required action]
```

**Must-include rules:**
1. At least one "NEVER" rule (what's out of scope)
2. At least one fallback rule ("If you can't determine X, then Y")
3. At least one error handling rule ("If a tool fails, then Z")

#### 3f: Output Format Section

Define exactly how the agent should respond:

```
Pattern: Template showing the exact format

Example:
"When reporting triage results, use this format:
'I've triaged [incident]:
- Category: [category] — because [reason]
- Priority: [priority] — Impact: [level], Urgency: [level]
- Assigned to: [group]'"
```

#### 3g: Reasoning Elicitation

Activate step-by-step reasoning instead of pattern-matching. This is the cheapest, highest-leverage
quality lever you have — one sentence in the instructions.

A short trigger phrase ("walk through... step by step", "think through... before...") acts as a
"master key" that surfaces the model's latent reasoning *without* needing per-task examples
(zero-shot chain-of-thought, Kojima et al. 2022). In the ReAct loop the quality of the **Thought**
step is governed entirely by how the instructions are written: imperative instructions ("classify
this", "set priority") tend to produce a single pattern-matched guess, while *process* instructions
make the agent reason through the inputs before committing to an answer.

**Pattern: replace imperative instructions with process instructions.**

| Without reasoning trigger | With reasoning trigger |
|---------------------------|------------------------|
| "Classify this incident" | "Walk through the symptoms one at a time, then assign category" |
| "Set priority" | "Think through impact and urgency step by step before setting priority" |
| "Assign to the right group" | "First identify the affected service, then identify the user's role, then select the assignment group" |
| "Summarize the incident" | "Before producing your summary, walk through each work note entry in order and note what changed" |

**Where to apply it:**
- Put the trigger inside the relevant **Workflow** step (3d), not as a standalone rule — it should
  modify the action the agent is about to take.
- Always place a reasoning phase **before any structured output or record write** (3f). The agent
  should reason first, then emit the answer/format — never write to a record on the first inference.
  For the architectural propose → verify → gate pattern behind this (deterministic Script-tool
  verifier, critic child agent, Supervised runtime gate), see the Verification Architecture section
  of `context/agent-reasoning-patterns.md` (#83).
- Keep it to the decision points that actually need judgment (category, priority, routing,
  summarization). Don't wrap trivial lookups in "step by step" — it just adds latency.

> **Two-stage corollary:** reasoning and structured output degrade when forced into one step. For
> decisions that end in JSON or a field write, instruct the agent to reason in prose first, then
> produce the structured result as a separate, final step.

**Anti-reasoning phrases (the negative mirror).** The same instruction text that *elicits* reasoning
can also *suppress* it. The instance LLM obeys brevity/suppression phrasing literally, so a phrase
like "just classify" placed next to a judgment-bearing step collapses the **expressed** reasoning the
Thought step would otherwise produce. Audit for these and replace them:

| Anti-reasoning phrase (next to a judgment step) | Replacement |
|---|---|
| "Make your best guess if unsure" | "List the candidates and the evidence for each, then pick the most likely one" |
| "Just classify the ticket" / "Quickly determine X" | "Walk through the symptoms one at a time, then assign" |
| "Be concise" / "be brief" / "don't overthink" placed next to the task | Move brevity to the **Output Format** section (3f) only; keep it away from the reasoning step |

> **Mechanism:** these phrases suppress the agent's **expressed** reasoning verbosity and
> final-answer detail — expect a sharp token drop (magnitude varies by model and prompt) —
> **not** the platform-run ReAct iteration count, which is unchanged (the loop is platform-run; the
> editable loop ceiling is `sn_aia.continuous_tool_execution_limit`). But a thin Thought step still
> starves the trace and downstream steps of the judgment they depend on.

**Carve-out (same as the elicitation rule above):** only audit **judgment-bearing** decision points —
category, priority, routing, summarization. Brevity is *correct* for output formatting (3f) and
trivial lookups; do not flag "answer clearly and concisely" in an output instruction or scoped
token-cost guidance. The audit targets brevity placed *next to a reasoning step*, not all brevity.

### Step 4: Add Strategy-Specific Elements

#### For ReAct: Add Reasoning Guidance

```
"For each step, explain your reasoning before acting:
Thought: [What I'm considering]
Action: [What tool I'll use]
Observation: [What I learned]"
```

#### For Reactive Planner: Add Planning Phase

```
"Before taking any action, present your plan:
=== PLAN ===
Step 1: [Action] — [Why]
...
=== EXECUTING ==="
```

#### For CoPilot: Add Approval Pattern

```
"Before any action that modifies data:
1. Explain what you want to do and why
2. Ask 'Should I proceed with this?'
3. Only execute after user confirms"
```

#### For AutoPilot: Add Completion Criteria

```
"You are complete when ALL of these are true:
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] Work notes document all decisions"
```

### Step 5: Add Edge Case Handling

Every instruction set should handle these scenarios:

| Scenario | What to Add |
|----------|------------|
| **Ambiguous request** | "If the request is unclear, ask ONE clarifying question before proceeding." |
| **Out-of-scope request** | "If the request is outside your role, explain what you can help with and suggest who can help." |
| **Tool failure** | "If [tool] returns an error, [specific fallback action]." |
| **Missing data** | "If [required field] is empty, [specific handling]." |
| **Low confidence** | "If you are less than 60% confident in your assessment, [escalate/ask/state uncertainty]." |

### Step 6: Review and Optimize

Check the completed instructions against these criteria:

| Criterion | Check |
|-----------|-------|
| **Length** | Under 1500 words? (Under 800 for simple agents) |
| **First sentence** | Does it state the agent's role clearly? |
| **Tool coverage** | Is every tool listed with when to use it? |
| **Negative examples** | Is there at least one "NEVER" rule? |
| **Output format** | Is the response format explicitly defined? |
| **Fallback** | Does every failure mode have a handler? |
| **Critical rules placement** | Are the most important rules at the top? |
| **Reasoning elicitation** | Does the workflow include at least one "walk through X step by step" instruction, and a reasoning phase before any structured output or record write? (see 3g) |
| **Anti-reasoning scan** | Scan instructions for anti-reasoning phrases next to judgment steps ("just classify", "be brief", "make your best guess") and replace them (see 3g) |

### Step 7: Output the Instructions

Return the complete instructions text plus a metadata summary:

```
## Agent Instructions Output

### Metadata
- **Agent name:** [name]
- **Strategy:** [strategy]
- **Instruction word count:** [count]
- **Tools referenced:** [list]
- **Trigger type:** [type]

### Instructions
[Complete instructions text ready to paste into the agent]

### Strategy Recommendation
[If the user didn't specify strategy: "I recommend [strategy] because [reason]"]

### Testing Suggestions
To validate these instructions, test with:
1. [Happy path test case]
2. [Edge case test case]
3. [Out-of-scope test case]
```

---

## Validation Checklist

Before delivering instructions, verify:

- [ ] Identity section is 1-2 sentences
- [ ] Objective has measurable success criteria
- [ ] Every tool is listed with when/why to use it
- [ ] Workflow has 3-10 numbered steps
- [ ] At least one "NEVER" rule exists
- [ ] Output format is explicitly defined
- [ ] Edge cases are handled (ambiguous input, tool failure, out of scope)
- [ ] Strategy-specific elements are included
- [ ] Total length is under 1500 words
- [ ] Most important rules are in the first and last paragraphs
- [ ] Does the workflow include at least one "walk through X step by step" instruction?
- [ ] Is there a reasoning phase before any structured output or record write?
- [ ] Scan instructions for anti-reasoning phrases next to judgment steps (see 3g)

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Agent ignores tools | Tools not mentioned in instructions | Add explicit tool section with when/why |
| Agent uses wrong tool | Tool descriptions overlap | Add "Do NOT use for..." to each tool |
| Agent gives verbose responses | No length constraint | Add word/sentence limit to output format |
| Agent doesn't ask questions | No clarification instruction | Add "If unclear, ask ONE question" |
| Agent takes unauthorized actions | No NEVER rules | Add explicit prohibited actions |
| Agent ignores rules mid-prompt | Rules buried in the middle | Move critical rules to first paragraph |
| Agent gives shallow one-line response | Instructions don't elicit reasoning | Add a step-by-step reasoning trigger (see Step 3g) |

## Tips

- **Read the instructions aloud.** If they're confusing to you, they'll be confusing to the agent.
- **Shorter is better.** Every unnecessary word is a chance for the agent to get confused.
- **Test with the worst input.** If the instructions handle a terrible request gracefully, they'll handle everything.
- **One agent, one job.** If your instructions describe two distinct responsibilities, you need two agents.

---

*Skill designed for writing ServiceNow AI Agent instructions on Zurich. Patterns match Zurich strategy types.*
