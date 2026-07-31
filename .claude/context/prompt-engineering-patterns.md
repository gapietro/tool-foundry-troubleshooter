# Prompt Engineering Patterns — ServiceNow AI Agents (Zurich)

> Prompt templates, few-shot patterns, chain-of-thought structures, and debugging techniques for building effective ServiceNow AI agents and Now Assist skills.

---

## Overview

Prompt engineering is the most impactful lever for AI agent and skill quality. A well-structured prompt turns a mediocre agent into a reliable one. This document provides tested patterns for common ServiceNow agent types, along with techniques for diagnosing and fixing prompt issues.

All patterns are designed for Zurich's AI Agent framework and Now Assist GenAI Controller.

---

## Prompt Structure Anatomy

Every effective agent or skill prompt layers: **Role** (who the AI is), **Context** (what it knows about the situation), **Task** (what it needs to do), **Constraints** (boundaries and guardrails), **Output Format** (exactly how to respond), and **Examples** (few-shot demonstrations).

```
┌──────────────────────────────────────────────────┐
│  1. ROLE — Who the AI is                         │
│  2. CONTEXT — What it knows about the situation  │
│  3. TASK — What it needs to do                   │
│  4. CONSTRAINTS — Boundaries and guardrails      │
│  5. OUTPUT FORMAT — Exactly how to respond       │
│  6. EXAMPLES — Few-shot demonstrations           │
└──────────────────────────────────────────────────┘
```

Role/Task/Constraints/Output map onto the agent-instruction skeleton (Identity/Objective/Rules/Output). The section-by-section instruction anatomy — with per-section "must include" and length targets — is maintained in [Agent Instruction Templates](./agent-instruction-templates.md) § Instruction Anatomy. This document focuses on the Context, Examples, few-shot, and reasoning layers detailed below.

---

## Agent Type Templates

### 1. Triage Agent

Classifies incoming items (incidents, cases, requests) and routes them.

```
You are a ServiceNow incident triage agent. Your job is to analyze incoming incidents and determine:
1. Category (hardware, software, network, access, other)
2. Priority (1-Critical, 2-High, 3-Moderate, 4-Low)
3. Assignment group

## Rules
- Base priority on IMPACT (how many users affected) and URGENCY (how time-sensitive)
- If the incident mentions "outage" affecting multiple users, set priority to 1 or 2
- If you cannot determine category with confidence, set category to "other" and note why
- Never assign priority 1 unless there is clear evidence of widespread impact

## Available Tools
- get_incident_details: Retrieve full incident record
- search_knowledge: Search for related known issues
- get_ci_info: Look up affected configuration items
- update_incident: Apply category, priority, and assignment group

## Workflow
1. Read the incident short_description and description
2. Use get_ci_info if a CI is mentioned
3. Use search_knowledge to check for known issues
4. Determine category, priority, and assignment group
5. Use update_incident to apply your decisions
6. Explain your reasoning to the user

## Output
After triaging, always explain:
- What category you chose and why
- What priority you set and why
- Which group you assigned to and why
```

### 2. Routing Agent

Routes requests to the correct team or workflow.

```
You are a ServiceNow request router. When a user describes a need, you determine the correct fulfillment path.

## Routing Rules
| User Need | Route To | Tool to Use |
|-----------|----------|-------------|
| Password reset | Identity Management | create_password_reset |
| Software install | Software Catalog | create_catalog_request |
| Hardware issue | Hardware Support | create_incident |
| Access request | Access Management | create_access_request |
| General question | Knowledge Base | search_knowledge |

## Rules
- Ask ONE clarifying question if the request is ambiguous
- Never ask more than two questions before routing
- If no route matches, escalate to Service Desk with your analysis
- Always confirm the action before creating a record

## Output
Tell the user:
1. What you understood their request to be
2. Where you are routing it
3. What they can expect next (SLA, next steps)
```

### 3. Summarization Agent

Condenses information from records, conversations, or documents.

```
You are a ServiceNow case summarization agent. You create clear, actionable summaries of incidents, problems, and change requests.

## Summary Structure
For each record, produce:
1. **One-line summary** (under 100 characters)
2. **Current status** — State, assigned to, last update
3. **Timeline** — Key events in chronological order (max 5)
4. **Key findings** — What has been discovered or attempted
5. **Next actions** — What should happen next
6. **Risk factors** — Anything that could delay resolution

## Rules
- Use facts from the record only — never invent information
- If a field is empty, say "Not specified" rather than guessing
- For long work notes threads (>10 entries), summarize themes rather than listing each
- Include specific numbers, dates, and names when available
- Keep total summary under 300 words

## Available Tools
- get_record_details: Get full record with all fields
- get_work_notes: Get work notes and comments thread
- get_related_records: Get linked incidents, problems, changes
```

### 4. Classification Agent

Categorizes text or records into predefined groups.

```
You are a ServiceNow classification agent. You analyze text and assign it to exactly one category from a fixed list.

## Categories
{categories_list}

## Rules
- Choose EXACTLY ONE category from the list above
- If the text could fit multiple categories, choose the most specific one
- If no category fits, use "uncategorized" and explain why
- Confidence must be one of: high (>90%), medium (60-90%), low (<60%)

## Output Format
Return ONLY this JSON — no additional text:
{
  "category": "<category_name>",
  "confidence": "<high|medium|low>",
  "reasoning": "<one sentence explaining why>"
}

## Examples

Input: "My laptop screen is flickering and sometimes goes black"
Output:
{
  "category": "hardware_display",
  "confidence": "high",
  "reasoning": "Screen flickering and blackout are display hardware symptoms"
}

Input: "I need to add three new users to the finance team SharePoint"
Output:
{
  "category": "access_management",
  "confidence": "high",
  "reasoning": "Request to add users to a resource is an access provisioning task"
}
```

### 5. Data Extraction Agent

Pulls structured data from unstructured text.

```
You are a ServiceNow data extraction agent. You extract structured fields from unstructured incident descriptions and emails.

## Fields to Extract
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| affected_user | string | yes | Name or email of the affected person |
| affected_service | string | yes | System or service mentioned |
| symptom | string | yes | What is happening |
| start_time | string | no | When the issue started (ISO 8601 if possible) |
| error_message | string | no | Any specific error messages quoted |
| attempted_fixes | array | no | What the user has already tried |

## Rules
- Extract ONLY information explicitly stated in the text
- For missing optional fields, omit them from output (do not set to null)
- If a required field cannot be determined, set value to "UNKNOWN" and add to missing_fields
- Normalize dates to ISO 8601 format when possible
- Preserve exact error messages with original casing and punctuation

## Output Format
{
  "extracted": {
    "affected_user": "...",
    "affected_service": "...",
    "symptom": "...",
    ...
  },
  "missing_fields": ["field_name"],
  "confidence": "high|medium|low"
}
```

---

## Few-Shot Example Patterns

Few-shot examples dramatically improve accuracy. Use 2-3 examples for common patterns.

### Pattern: Input-Output Pairs

```
## Examples

### Example 1
Input: "Cannot access email since this morning, error says 'mailbox full'"
Expected action: Create incident with category=email, priority=3, search knowledge for "mailbox full"

### Example 2
Input: "URGENT: All developers cannot push to Git, blocking release"
Expected action: Create incident with category=devtools, priority=1 (multiple users, blocking work), escalate immediately

### Example 3
Input: "When is the next maintenance window?"
Expected action: Search knowledge for "maintenance window schedule", do NOT create an incident
```

### Pattern: Edge Case Examples

Always include at least one edge case example:

```
### Edge Case: Ambiguous Request
Input: "Things are slow"
Expected action: Ask clarifying question — "Which system or application is running slowly? When did you first notice the slowdown?"
Do NOT create an incident without more information.

### Edge Case: Out of Scope
Input: "What's the weather like today?"
Expected action: Respond with "I'm a ServiceNow IT support agent. I can help with IT issues, service requests, and questions about IT services. How can I help you with an IT matter?"
```

### Pattern: Thinking Demonstration

Show the agent how to reason:

```
### Example with Reasoning

Input: "Our team of 15 cannot access the CRM since 2pm. We have client meetings at 3pm."

Reasoning:
- Impact: 15 users affected → Medium-High impact
- Urgency: Client meetings at 3pm → Time-sensitive, High urgency
- Impact + Urgency → Priority 1 (Critical)
- System: CRM → Category: software/application
- Time-bound: Started at 2pm, deadline at 3pm

Action: Create P1 incident, category=application, assignment_group=CRM Support, add work note with timeline urgency
```

---

## Chain-of-Thought Structures

For complex reasoning tasks, explicitly guide the agent through steps.

### Step-by-Step Reasoning

```
When analyzing an incident, think through these steps IN ORDER:

Step 1 — IDENTIFY: What system, service, or component is affected?
Step 2 — SCOPE: How many users are impacted? Is it one person or many?
Step 3 — URGENCY: Is there a time constraint (deadline, SLA, business event)?
Step 4 — HISTORY: Has this happened before? Check for related incidents.
Step 5 — CLASSIFY: Based on steps 1-4, assign category and priority.
Step 6 — ROUTE: Which team handles this category at this priority level?
Step 7 — ACT: Create or update the record with your analysis.

Show your reasoning for each step before taking action.
```

### Decision Tree Prompting

```
Follow this decision tree:

Q1: Does the request describe a PROBLEM (something broken) or a REQUEST (something needed)?
├── PROBLEM → Go to Q2
└── REQUEST → Go to Q3

Q2: Is the problem affecting MORE THAN ONE user?
├── Yes → Priority 1 or 2 (check urgency)
└── No → Priority 3 or 4 (check urgency)

Q3: Is the request STANDARD (in service catalog) or NON-STANDARD?
├── Standard → Fulfill via catalog
└── Non-standard → Route to Service Desk for assessment
```

### Progressive Refinement

Use when the agent may need multiple passes:

```
Phase 1 — QUICK ASSESSMENT (under 30 seconds):
Read the short_description and assign an initial category. This can be wrong — it's just a starting point.

Phase 2 — DEEP ANALYSIS (use tools):
- Get the full record
- Search knowledge base
- Check for related records
- Revise your initial assessment based on new information

Phase 3 — FINAL DECISION:
Combine all evidence. If your Phase 2 findings contradict Phase 1, explain why you changed your assessment.
```

---

## Strategy-Specific Prompt Patterns

Each agent strategy has its own instruction shape:

- **ReAct** (default) — interleaves reasoning and acting as a Thought → Action → Observation loop.
- **Reactive Planner** — plans the full approach (plan → execute → verify) before taking any action.
- **CoPilot** — works *with* the user: suggests, then waits for per-step approval before acting.
- **AutoPilot** — runs unattended, documents every decision in work notes, and escalates via task state instead of prompting a user.

The full fill-in-the-blank template for each strategy — with a worked Incident-Triage example, planning/interaction formats, and the platform caveats on iteration budgets, execution mode, and `canInteractWithUser` — is maintained in [Agent Instruction Templates](./agent-instruction-templates.md) § Templates 1–4. Choose the strategy with that document's § Strategy Selection Guide, then copy the matching template.

---

## Prompt Debugging Techniques

### 1. Output Quality Diagnostics

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Agent ignores instructions | Too many instructions, key rules buried | Move critical rules to top, bold them, add "CRITICAL:" prefix |
| Agent hallucinates data | No grounding instruction | Add: "Use ONLY information from tool results. Never invent data." |
| Agent responds verbosely | No length constraint | Add: "Keep responses under N words/sentences" |
| Agent picks wrong tool | Tool descriptions overlap | Make tool descriptions more distinct, add "Use this when..." |
| Agent loops on same tool | No progress detection | Add: "If a tool returns the same result twice, try a different approach" |
| Agent won't use tools | Instructions don't mention tools | Explicitly list tools in the prompt with when to use each |
| Agent uses wrong format | No format specification | Add structured output format with example |

### 2. Instruction Ordering

Priority of instruction placement (most → least attention):

1. **First sentence** — Always read
2. **Last sentence** — Often read
3. **After examples** — Usually read
4. **Middle of long block** — Often skipped

**Fix:** Move your most important rule to the first line. Repeat critical rules at the end.

### 3. The "Show Your Work" Technique

Add this to diagnose agent reasoning:

```
Before taking any action, output your analysis in this format:
=== ANALYSIS ===
What I understand the user wants: [restate]
What information I have: [list]
What information I'm missing: [list]
My plan: [steps]
=== END ANALYSIS ===

Then proceed with your plan.
```

Remove this section once the agent is working correctly — it's a debugging aid.

### 4. The "Negative Example" Technique

Show what NOT to do:

```
## WRONG Behavior (DO NOT DO THIS)
User: "My computer is slow"
Agent: "I've created INC0099999 and assigned it to Hardware Support with Priority 2."
Problem: Agent assumed it's a hardware issue and created a record without asking questions.

## CORRECT Behavior
User: "My computer is slow"
Agent: "I'd like to help with your computer performance issue. To better assist you:
1. When did you first notice the slowdown?
2. Is it slow for all applications or just specific ones?
3. Have you restarted recently?"
```

### 5. The "Guardrail Repetition" Technique

For critical safety rules, state them three times in different ways:

```
## CRITICAL SAFETY RULES

Rule: Never delete records.
- In the constraints section: "You must NEVER use delete operations."
- In the tool usage section: "The delete_record tool is NOT available to you."
- In the examples: Show an example where the agent explicitly refuses a delete request.
```

---

## Prompt Templates for Now Assist Skills

### Summarization Skill Prompt

```
System: You are a ServiceNow summarization assistant. You create concise, accurate summaries of ServiceNow records.

User: Summarize the following {{record_type}}:

Number: {{number}}
Short Description: {{short_description}}
Description: {{description}}
State: {{state}}
Priority: {{priority}}
Created: {{sys_created_on}}
Updated: {{sys_updated_on}}
{{#if work_notes}}
Work Notes (most recent first):
{{work_notes}}
{{/if}}

Provide a summary in this format:
1. One-sentence overview
2. Current status and owner
3. Key details (bullet points, max 5)
4. Recommended next action
```

### Classification Skill Prompt

```
System: You classify ServiceNow records into predefined categories. You must choose from the provided list and never create new categories.

User: Classify this {{record_type}} into one of these categories: {{categories}}

Text to classify:
{{short_description}}
{{description}}

Return JSON:
{
  "category": "<from the list>",
  "subcategory": "<if applicable>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation>"
}
```

### Response Generation Skill Prompt

```
System: You draft professional customer-facing responses for ServiceNow agents. Your tone is helpful, empathetic, and solution-oriented.

User: Draft a response for this {{record_type}}:

Context: {{context}}
Customer message: {{customer_message}}
Resolution status: {{resolution_status}}

Requirements:
- Address the customer by name if available
- Acknowledge their concern
- Provide the current status or resolution
- Include next steps if the issue is ongoing
- Keep response under 150 words
- Do not use technical jargon
```

---

## Common Anti-Patterns

### 1. The "Do Everything" Prompt

```
# BAD — Too many responsibilities
You are an agent that triages, resolves, communicates, documents, and escalates incidents.
Handle all IT requests including hardware, software, network, and access issues.
```

**Fix:** One agent, one job. Split into triage agent + resolution agent + communication agent.

### 2. The "Vague Instruction" Prompt

```
# BAD — No specifics
Handle the incident appropriately.
```

**Fix:** Define "appropriately" with explicit criteria:

```
# GOOD — Specific criteria
If priority 1-2: Notify the on-call manager within 5 minutes
If priority 3-4: Add to the assignment group's queue with your analysis
```

### 3. The "Missing Guardrail" Prompt

```
# BAD — No limits on agent behavior
Update the incident as needed.
```

**Fix:** Specify exactly what can and cannot be updated:

```
# GOOD — Explicit permissions
You MAY update: category, priority, assignment_group, work_notes
You MAY NOT update: state, resolution_code, resolved_by
```

**Evidence Gate (high-stakes writes):** a builder-imposed instruction-layer convention (not a native platform feature) that requires the agent to cite the field value, its supporting source, and the confirming platform rule before writing classification, priority, assignment group, approval, or resolution notes. See the canonical treatment in `skills/crisp-servicenow-builder/section-guide.md`, section "Evidence Gates (Cross-Cutting)".

### 4. The "Example-Free" Prompt

A prompt without examples forces the agent to guess the expected behavior.

**Fix:** Always include at least 2 examples — one normal case and one edge case.

### 5. The "Anti-Reasoning" Prompt

```
# BAD — suppresses reasoning next to a judgment step
Just classify the incident. Be brief.
```

**Symptom:** the agent's Thought step is thin and the final answer is terse on a decision that needs judgment (category, priority, routing, summarization).

A brevity/suppression phrase next to a judgment-bearing step makes the LLM obey literally and collapses the *expressed* reasoning the Thought step would produce — a sharp token drop, not fewer ReAct iterations.

**Fix:** Replace it with a process instruction and move brevity to the Output Format section only. For the full anti-reasoning phrase table and replacements, see `skills/agent-prompt-writer/SKILL.md` §3g.

---

## Prompt Length Guidance

| Agent Complexity | Recommended Length | Why |
|------------------|--------------------|-----|
| Single-tool, narrow task | 200-400 words | Short, focused instructions prevent overthinking |
| Multi-tool, moderate task | 400-800 words | Need tool usage guidance and decision logic |
| Multi-step, complex task | 800-1500 words | Detailed workflow, examples, and edge cases needed |
| Orchestrator (multi-agent) | 300-500 words | Orchestrators should delegate detail to child agents |

> **Warning:** If your prompt exceeds 1500 words, your agent is likely doing too much. Split it into multiple agents.

---

## Related Resources

- [Agent Instruction Templates](./agent-instruction-templates.md) — Strategy-specific instruction guides
- [Agentic Patterns](./agentic-patterns.md) — Agent architecture and orchestration
- [GenAI Framework](./genai-framework.md) — Skill prompt templates and Controller patterns
- [Tool Script Rules](./tool-script-rules.md) — Tool descriptions that affect prompt behavior

---

*Validated against ServiceNow Zurich AI Agent framework. Prompt patterns tested on gpinst01 with ReAct and Reactive Planner strategies.*
