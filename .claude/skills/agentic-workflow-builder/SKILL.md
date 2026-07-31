---
name: agentic-workflow-builder
description: Design methodology for ServiceNow Agentic Workflows — flat peer-team coordination (the default shape), the opt-in orchestrator/child hierarchy, trigger selection, and testing patterns.
scope: project
recommended: false
version: 2.1.0
---
# Skill: Agentic Workflow Builder

> Design methodology for ServiceNow Agentic Workflows — flat peer-team coordination (the default shape), the opt-in orchestrator/child hierarchy, trigger selection, and testing patterns.

> **For creating workflows via Fluent DSL, read: `.claude/context/sdk-examples/ai-agentic-workflow.now.ts`.** This skill covers workflow design methodology and architecture decisions.

> **For the supported coordination topologies (single agent, team of peers, parent/child hierarchy, sequential pipeline, native parallelism, generator + critic) mapped to the live `sn_aia` data model, see `context/multi-agent-coordination-patterns.md`.**

> **For how reasoning works on the platform** (platform-run ReAct, reasoning elicitation, offline self-improvement, and the propose→verify→gate verification architecture), read `context/agent-reasoning-patterns.md`.

> **Path resolution:** `.claude/context/...` paths in this skill assume a
> Foundry-MCP-provisioned project (`foundry_init` / `foundry_add`). When this
> skill runs from the Foundry Claude Code plugin instead, the same files live
> under `${CLAUDE_PLUGIN_ROOT}/context/...` — read whichever path exists.

---

## Purpose

This skill guides you through designing Agentic Workflows in ServiceNow — multi-agent orchestrations most often built as a **team of flat peer agents** (`sn_aia_team_member` rows under one `sn_aia_team` + strategy), coordinated by the platform strategy rather than a hand-coded dispatch tree. An **orchestrator/child hierarchy** (`sn_aia_agent_child`) is a deliberate opt-in for genuine delegation depth, not the default shape — there is no `sn_aia_usecase.orchestrator_agent` field. It does not generate code; it helps you make the right architecture and design decisions before implementation.

## When to Use

- Deciding between single-agent vs multi-agent architecture
- Designing a multi-agent coordination shape — flat peer teams by default, an opt-in orchestrator/child hierarchy when genuine delegation depth is needed
- Choosing trigger types (record, scheduled, chat, API)
- Writing effective agent instructions and handoff logic
- Planning test and evaluation strategies

## Prerequisites

1. ServiceNow instance with AI Agent Studio enabled
2. `sn_aia.admin` role
3. Now Assist AI Agents plugin (`sn_aia`) installed
4. SDK >= 4.7.0 for Fluent DSL creation (`AiAgenticWorkflow`; the `search_retrieval` tool type requires 4.7.0)

---

## Single-Agent vs Multi-Agent

**Use a single agent** when:
- The task has a linear, predictable flow
- Fewer than 5 tools are needed
- No branching logic or specialist knowledge required

**Use multi-agent (agentic workflow)** when:
- The task has distinct phases (triage, resolution, escalation)
- Different phases need different tool sets or security contexts
- You want independent testability of each phase
- Total tools exceed 10-15 (split across team member agents, max 20 per agent)

**Default to a flat team of peer agents** (`sn_aia_team_member` rows under one `sn_aia_team` + strategy, coordinated by the platform strategy) — this is the native multi-agent shape and covers the large majority of designs. **Reach for the opt-in parent/child hierarchy** (`sn_aia_agent_child`) only when a peer team can't express the relationship — i.e., you need a parent agent to delegate to a child as a distinct, nested reasoning context. This is rare in practice (~3 rows on a live instance); do not choose it by default. See `context/multi-agent-coordination-patterns.md` for the full topology decision tree (single agent → peer team → hierarchy → pipeline → parallelism → generator/critic).

---

## Step 1: Design the Architecture

Before building, define:

1. **End goal** — what business outcome does this workflow produce?
2. **Team members (or child agents, if you've chosen the opt-in hierarchy)** — what distinct roles are needed?
3. **Tools per agent** — what capabilities does each role require? (max 20 per agent)
4. **Trigger** — what event starts the workflow?
5. **Execution mode** — `autopilot` (autonomous) or `copilot` (supervised)?
6. **Verification architecture (required)** — how does the workflow *propose → verify → gate* before any write-of-authority? Decide which leg is a deterministic Script tool, which (if any) is a critic peer or child agent, and what the runtime gate is. See the Verification Architecture section of `context/agent-reasoning-patterns.md`.

**Architecture template (default — flat peer team):**
```
Agentic Workflow: {workflow_name}
    └── Team + Strategy
            ├── Peer Agent: {agent_1_name}
            │       ├── Tool: {tool_1a}
            │       └── Tool: {tool_1b}
            ├── Peer Agent: {agent_2_name}
            │       └── Tool: {tool_2a}
            └── Direct Tool: {tool_direct}
```

**Architecture template (opt-in — parent/child hierarchy, only for genuine delegation depth):**
```
Agentic Workflow: {workflow_name}
    └── Parent Agent: {orchestrator_name}
            ├── Child Agent: {agent_1_name}
            │       ├── Tool: {tool_1a}
            │       └── Tool: {tool_1b}
            ├── Child Agent: {agent_2_name}
            │       └── Tool: {tool_2a}
            └── Direct Tool: {tool_direct}
```

## Step 2: Write Agent Instructions

The instructions below use **orchestrator/child** vocabulary because it is the clearest way to describe handoff mechanics — see `context/multi-agent-handoff-patterns.md`. Read "orchestrator" as "whichever agent is coordinating a handoff": the parent, if you've chosen the opt-in hierarchy; or, in the default flat peer team, there is no single lead agent — coordination belongs to the platform strategy, and each peer's own instructions cover when it hands off or escalates.

**Orchestrator instructions** should:
- State the overall workflow goal
- Name which child agent handles which sub-task
- Define handoff conditions (e.g., "if confidence < 80%, escalate")
- Specify when to stop and escalate to a human

**Child agent instructions** should:
- Be numbered steps (Step 1, Step 2, ...)
- Reference tools by name
- Define success/failure criteria for the agent's scope
- Avoid duplicating orchestrator-level logic

**Example orchestrator instructions:**
```
You coordinate incident resolution across three agents:
1. Delegate to "Triage Agent" to classify the incident
2. If triaged as auto-resolvable, delegate to "Resolution Agent"
3. If resolution fails after 2 attempts, delegate to "Escalation Agent"
4. Always update work_notes with the outcome of each stage
```

## Step 3: Select Triggers

| Trigger Type | Use When | Key Config |
|-------------|----------|------------|
| **Record** | React to table changes (create/update) | Table, conditions, insert/update/both |
| **Scheduled** | Periodic batch processing | Cron/interval, max records (default 10) |
| **Chat** | User-initiated via Virtual Agent | Requires `sn_nowassist_va.router_redirect_va_agentic` = `ROUTER_DECISION` |
| **API** | Programmatic invocation from scripts/flows | `sn_aia.AiAgentRuntimeUtil.startAiAgentConversation()` |

## Step 4: Plan Data Access

- **Dynamic user identity** (recommended): Uses `roleList` to scope data access per execution
- **Fixed user** (`runAs`): Runs as a specific user — use for system-level workflows
- **Peer team (default)**: there is no parent whose security model is inherited — configure identity explicitly via the workflow's `runAs` / `dataAccess.roleList` (see `context/sdk-examples/ai-agentic-workflow.now.ts`)
- **Opt-in hierarchy only**: if you've chosen a parent/child design, child agents inherit the parent (orchestrator) agent's security model

## Step 5: Test the Workflow

1. **Manual reasoning test**: AI Agent Studio > Testing > Test AI reasoning
   - Select the workflow, provide test input, step through each agent's decisions

2. **Automated evaluation**: Now Assist Skill Kit > Agentic Evaluations
   - Create evaluation runs against the workflow
   - Use execution logs as dataset
   - Review task completeness and tool performance metrics

3. **API test** (scripted): Use `AiAgentRuntimeUtil` to invoke programmatically with `canInteractWithUser: false`

---

## Key Tables

| Table | Purpose |
|-------|---------|
| `sn_aia_usecase` | Agentic workflow definitions. There is no `orchestrator_agent` field — a use case maps to one team + one strategy |
| `sn_aia_team` | The team + strategy that coordinates a use case's agents |
| `sn_aia_team_member` | Flat agent peers on a team (no order/sequence field) — the default multi-agent shape |
| `sn_aia_agent` | Agent definitions (peer, or parent/child if you've chosen the opt-in hierarchy) |
| `sn_aia_agent_child` | Opt-in parent/child relationships — rare in practice, not the default |
| `sn_aia_tool` | Tool definitions |
| `sn_aia_agent_tool_m2m` | Agent-to-tool mappings |
| `sn_aia_trigger_configuration` | Trigger configs |
| `sn_aia_execution_plan` | Execution records |

## Safety and Limits

- Max 20 tools per individual agent
- Recursive check: max 50 creates and 5 updates within 15-minute windows
- Scheduled triggers process max 10 records per run (configurable via `sn_aia.max_scheduled_trigger_query`)
- Tool execution records expire after 13 months; GenAI logs after 6 months
- If you've chosen the opt-in parent/child hierarchy, the parent (orchestrator) MUST be a separate agent from its children — this rule doesn't apply to the default flat peer team, which has no parent agent

---

## Design Validation Checklist

Before building, validate the design on paper — most agentic failures are designed in, not coded in:

- [ ] Can you state the business outcome the workflow produces in one sentence?
- [ ] Does each additional agent (peer or child) prevent a *named* failure mode that a single agent could not handle? (If not, collapse it.)
- [ ] Is there a quality gate (Evaluator → Optimizer, or human-in-the-loop) before any irreversible external action?
- [ ] Is there shared state (work notes or a custom table) for any multi-step or multi-turn reasoning?
- [ ] Does every loop have an explicit success criterion **and** an iteration budget? (The budget is an instruction-level convention the LLM is asked to honor — **not** a platform property; there is no `sn_aia.max_iterations`.)
- [ ] Is a verifier slot reserved before the agent writes to a record of authority? (propose → verify → gate — see the Verification Architecture section of `context/agent-reasoning-patterns.md`; for a high-stakes output, make the verifier a **different-model critic** per option B there)
- [ ] **Have you checked your design against the anti-pattern catalog (below)?**

---

## Anti-Patterns

Individual "Common Errors" tables catch technical and runtime errors. This catalog catches
*architectural* mistakes — the design decisions that make an agentic workflow unreliable,
expensive, or hard to debug **before a single line of code is written**. Check every design
against this list during the [Design Validation Checklist](#design-validation-checklist).

| Anti-Pattern | Why It Fails | Better Approach |
|---|---|---|
| **"More agents = better"** | More agents = more failure modes, more latency, more cost, more debugging surface | Start with one agent; add another only when you can name the specific failure mode it prevents |
| **Symmetric multi-agent** (3 agents, same prompt, voting) | Same model → same blind spots → false confidence in the result | Use a *different-model* judge or a deterministic check instead. Bind a different model per One Extend capability definition and gate with `execution_mode=copilot` + HITL — see **B. Critic agent — different-model judge** in the Verification Architecture section of `context/agent-reasoning-patterns.md` (copyable PASS/FAIL critic instruction + same-model fallback) |
| **Building a supervisor when routing is fixed** | The supervisor LLM call is wasted latency + cost on every request when the route never changes | Sequential pipeline — no routing decision needed |
| **No quality gate before irreversible actions** | Agent sends the wrong email, books the wrong meeting, or files the wrong record with no checkpoint | Evaluator → Optimizer + Human-in-the-Loop before any external action (see the verifier slot, #83) |
| **No shared state for multi-step research** | Agent forgets between turns; the user cannot inspect intermediate state | Work notes or a custom table as shared context (see Memory Architecture in `context/agentic-patterns.md`) |
| **No stopping condition** | The loop burns context-window tokens on an ambiguous objective | Define explicit success criteria + an iteration budget **in the agent's instructions** — it is a convention the LLM is asked to honor, **not** a configurable platform cap (no `sn_aia.max_iterations`); the real platform brakes are `continuous_tool_execution_limit` (=25) + `react_failure_retry_max_limit` (=3) (recursive-execution protection — often cited as 50 creates / 5 updates per 15 min — likely also applies, but is not confirmable as a configurable `sn_aia.*` property; *confirm on instance during build*). `on_hold` escalation works only if the agent is granted a state-change tool (`sn_aia_agent_tool_m2m` + run_as_user ACL) (#90) |
| **Anti-reasoning instructions** | "Just classify," "be brief," "don't overthink" suppress the Thought step the agent needs to reason | Use instructive replacements that direct *how* to reason (#87) |
| **Mixing reasoning and structured output in one step** | Both degrade when combined — the model trades reasoning quality for format compliance | Two-stage prompting: reason first, extract structured output second (#88) |
| **No verifier slot** | Agent writes to the record on first inference; errors compound downstream with nothing to catch them | Always reserve the verifier slot before the write-of-authority — propose → verify → gate (Verification Architecture section of `context/agent-reasoning-patterns.md`, #83) |

> **Rule of thumb:** every agent and every LLM call in your design should earn its place by
> preventing a failure mode you can name. If you can't name the failure it prevents, remove it.

Related: this catalog tracks to the meta assessment in #80; the verifier slot (#83), instructive
reasoning (#87), two-stage prompting (#88), and stopping conditions (#90) each have dedicated issues.

---

*Validated against ServiceNow Zurich+ and SDK 4.5.0; golden AiAgenticWorkflow example re-build-validated against SDK 4.8.1 and 4.9.0 on 2026-07-17.*
