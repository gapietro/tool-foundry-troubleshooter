---
name: solution-design
description: Structured use case intake and AI solution architecture design for ServiceNow Now Assist and AI Agent POCs.
scope: project
recommended: false
version: 1.0.0
---
# Skill: Solution Design

> Structured use case intake and AI solution architecture design for ServiceNow Now Assist and AI Agent POCs.

> **Runtime tooling:** The `servicenow_*` tool names in this document are the Foundry MCP server's runtime tools. Treat them as capabilities — "execute an agent", "read an execution trace", "query a table" — and map them to the equivalents of whatever MCP server is connected. With no MCP server, fall back to manual verification: test in the Now Assist panel / AI Agent Studio and read execution traces from `sn_aia_execution_plan` / `sn_aia_execution_task`; query data via list views or a user-run background script.

---

## Overview

This skill guides you through a structured intake process to transform a vague use case description into a complete solution specification. The output is a standardized solution spec that lists every agent, tool, skill, workflow, trigger, and dependency needed to build the POC.

Use this skill at the START of every new POC — before writing any code or creating any agents.

## When to Use

Use this skill when:
- A developer describes a new use case or POC request
- You need to design the architecture for an AI agent solution
- You need to determine which agents, tools, and skills are required
- You're starting a new project and need to create a build plan

## Prerequisites

- Access to a ServiceNow instance (for discovery queries)
- Familiarity with context files: `agentic-patterns.md`, `servicenow-ai-data-model.md`, `prompt-engineering-patterns.md`
- MCP tools available: `servicenow_query`, `servicenow_instance`, `servicenow_aia_list`, `servicenow_skill_list`

---

## Instructions

### Step 1: Gather Requirements (REQUIRED — DO NOT SKIP)

**STOP.** Before designing anything, ask the developer these questions. Use the `AskUserQuestion` tool to collect answers.

#### Mandatory Questions

| # | Question | Why It Matters |
|---|----------|----------------|
| 1 | **What problem are you solving?** | Defines the core objective |
| 2 | **Who is the end user?** (IT agent, employee, customer, automated system) | Determines the interaction channel |
| 3 | **What data does the solution need to access?** (tables, fields, external systems) | Determines tool requirements |
| 4 | **How will users interact with it?** (chat, panel, voice, API, triggered) | Determines trigger type and agent strategy |
| 5 | **What does success look like?** (specific outcomes, metrics) | Defines acceptance criteria |

#### Optional Questions (Ask If Relevant)

| # | Question | When to Ask |
|---|----------|-------------|
| 6 | Are there existing agents/skills on the instance? | Always — avoids duplication |
| 7 | Does this need human approval at any step? | If the workflow modifies records |
| 8 | Is this a single-agent or multi-agent use case? | If the scope seems complex |
| 9 | What roles/permissions do end users have? | If data access is a concern |
| 10 | Are there SLAs or performance requirements? | If latency matters |

**Do NOT proceed to Step 2 until you have answers to questions 1-5.**

### Step 2: Discover What Exists on the Instance

Before designing new components, check what already exists.

```
MCP calls to make:
1. servicenow_aia_list — Get existing agents
2. servicenow_skill_list — Get existing skills
3. servicenow_query table="sys_user_group" — Check assignment groups
4. servicenow_query table="kb_knowledge" limit=5 — Check knowledge base content
```

Document your findings:
- **Existing agents that could be reused or extended:** [list]
- **Existing skills that could be integrated:** [list]
- **Tables confirmed to exist with data:** [list]
- **Assignment groups available:** [list]

### Step 3: Design the Agent Architecture

Based on requirements and discovery, design the solution.

#### 3a: Determine the Pattern

| Pattern | When to Use | Components |
|---------|-------------|------------|
| **Single agent** | One task, 1-5 tools, one user type | 1 agent + tools |
| **Agent + skills** | Agent uses Now Assist skills for generation | 1 agent + tools + skills |
| **Multi-agent** | Multiple distinct tasks, shared data | Orchestrator + child agents + tools |
| **Triggered agent** | Automated, no user present | 1 agent + trigger + tools |

#### 3b: For Each Agent, Define

1. **Name** — snake_case internal name
2. **Description** — One sentence purpose
3. **Strategy** — ReAct (default), Reactive Planner, CoPilot, or AutoPilot
4. **Tools needed** — List with descriptions
5. **Instructions outline** — Key sections of the prompt
6. **Trigger** — How it's invoked (chat, record, scheduled, API)

#### 3c: For Each Tool, Define

1. **Name** — snake_case internal name
2. **Type** — Script, Record operation, Flow action, Subflow, Search retrieval, etc.
3. **Description** — What it does
4. **Input schema** — Fields with types and mandatory flags
5. **Output schema** — Fields with types
6. **Execution mode** — Autonomous (reads) or Supervised (writes)
7. **Tables accessed** — Which ServiceNow tables

#### 3d: For Each Skill (if needed), Define

1. **Name** — Skill name
2. **Purpose** — What it generates
3. **Input schema** — What data it needs
4. **Prompt template outline** — System + user template structure
5. **Data Kit integration** — Search profile if RAG is needed

### Step 4: Map Dependencies

Create a dependency graph showing what must be built in what order:

```
Example:
1. Tool: get_incident_details (no dependencies)
2. Tool: update_incident (no dependencies)
3. Tool: search_knowledge (no dependencies)
4. Agent: incident_triage_agent (depends on tools 1, 2, 3)
5. Trigger: record trigger on incident (depends on agent 4)
```

### Step 5: Define Test Plan

For each component, specify:

| Component | Test Input | Expected Output | Pass Criteria |
|-----------|-----------|-----------------|---------------|
| [tool_name] | [sample input] | [expected result] | [what constitutes pass] |
| [agent_name] | [sample request] | [expected behavior] | [what constitutes pass] |

### Step 6: Output the Solution Spec

Compile everything into the standardized format below.

---

## Solution Spec Output Format

```markdown
# Solution Spec: [Use Case Name]

## Problem Statement
[From Step 1, question 1]

## End User
[From Step 1, question 2]

## Success Criteria
[From Step 1, question 5]

## Architecture Pattern
[Single agent | Agent + skills | Multi-agent | Triggered agent]

## Existing Components (Reuse)
- [List of existing agents/skills/tables to reuse]

## New Components

### Agents
| # | Name | Strategy | Trigger | Tools | Description |
|---|------|----------|---------|-------|-------------|
| 1 | [name] | [strategy] | [trigger] | [tool list] | [description] |

### Tools
| # | Name | Type | Execution Mode | Tables | Description |
|---|------|------|----------------|--------|-------------|
| 1 | [name] | [type] | [mode] | [tables] | [description] |

### Skills (if applicable)
| # | Name | Purpose | Data Kit? | Description |
|---|------|---------|-----------|-------------|
| 1 | [name] | [purpose] | [yes/no] | [description] |

### Workflows (if multi-agent)
| Orchestrator | Child Agents | Trigger | Pattern |
|-------------|-------------|---------|---------|
| [name] | [child list] | [trigger] | [sequential/parallel/conditional] |

## Dependency Order
1. [First thing to build]
2. [Second thing to build]
3. ...

## Test Plan
| Component | Test Input | Expected Output | Pass Criteria |
|-----------|-----------|-----------------|---------------|
| [component] | [input] | [output] | [criteria] |

## Risks and Considerations
- [Risk 1 and mitigation]
- [Risk 2 and mitigation]
```

---

## Validation Checklist

Before delivering the solution spec, verify:

- [ ] All 5 mandatory questions have been answered
- [ ] Instance discovery has been performed (existing agents/skills checked)
- [ ] Each agent has a clear, non-overlapping purpose
- [ ] Each tool has input/output schemas defined
- [ ] Execution modes are correct (Supervised for writes, Autonomous for reads)
- [ ] Dependencies are mapped — build order is clear
- [ ] Test plan covers happy path and at least one edge case per component
- [ ] Architecture pattern matches the complexity of the use case (not over-engineered)

---

## Examples

See the `examples/` directory for:
- `incident-triage-solution-spec.md` — Single-agent triage POC

## Tips

- **Start simple.** A single agent with 3-5 tools solves most POC requirements.
- **Don't over-engineer.** Multi-agent workflows are for genuinely complex use cases with 3+ distinct roles.
- **Reuse before building.** Check the instance for existing agents, skills, and tools first.
- **Test plan is not optional.** If you can't define what "success" looks like, the design is incomplete.

---

*Skill designed for the AI Foundry team's POC development workflow on ServiceNow Zurich.*
