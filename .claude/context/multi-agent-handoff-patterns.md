# Multi-Agent Handoff Patterns — ServiceNow Zurich

> Context sharing mechanisms, failure propagation, result aggregation, handoff conditions, memory across agents, recursive execution controls, and follow-up behavior configuration for multi-agent workflows.

---

## Overview

In ServiceNow Zurich, most multi-agent use cases are handled by a **team of flat peer agents** (`sn_aia_team_member` rows under one `sn_aia_team`), coordinated by the platform **strategy** — there is no `sn_aia_usecase.orchestrator_agent` field and no hand-coded dispatch tree. A **parent/child hierarchy**, where a parent agent dispatches to specialist **child agents** via `sn_aia_agent_child`, is a deliberate **opt-in** for genuine delegation depth — rare in practice (~3 rows on a live instance), not the default shape. See [Multi-Agent Coordination Patterns](./multi-agent-coordination-patterns.md) for when each shape applies.

This document covers the mechanics of how agents hand off work to each other, share context, handle failures, and aggregate results. The patterns below are written using orchestrator/child-agent vocabulary because that is the clearest way to illustrate the mechanics — they apply both to the opt-in parent/child hierarchy and, with "orchestrator" read as "whichever agent is coordinating," to a flat peer team routing work under the platform strategy.

---

## Architecture Recap

The default shape is a **flat team of peer agents**, coordinated by the platform strategy — not a hand-coded dispatch tree:

```
sn_aia_usecase
    └── sn_aia_team              (team + strategy)
            └── sn_aia_team_member   (flat agent peers — no order field)
                    └── sn_aia_agent
                            └── sn_aia_tool     (via agent-tool m2m)
```

Where genuine delegation depth is needed, a **parent/child hierarchy** is an opt-in overlay via `sn_aia_agent_child` — rare in practice (~3 rows on a live instance):

```
Agentic Workflow (sn_aia_usecase)
    └── Parent Agent
            ├── Child Agent A (specialist)
            │       ├── Tool A1
            │       └── Tool A2
            ├── Child Agent B (specialist)
            │       └── Tool B1
            └── Child Agent C (specialist)
                    └── Tool C1
```

The parent is itself an AI agent with a strategy (typically ReAct). Where the hierarchy is used, it "calls" child agents the same way it calls tools — the platform handles routing. The rest of this document uses **orchestrator** as shorthand for whichever agent is coordinating a handoff. In the parent/child hierarchy that is the parent; within a flat peer team there is no single lead agent — coordination belongs to the platform strategy routing among peers. "Orchestrator" is this document's vocabulary for that coordinating role, not a distinct field or record type.

---

## Context Sharing Mechanisms

### How Context Flows Between Agents

When an orchestrator dispatches to a child agent, context is shared via the **context sharing strategy**:

| Strategy | Property | Behavior |
|----------|----------|----------|
| **Summarize** (default) | `sn_aia.context_sharing_strategy = summarise` | Previous context is summarized and passed to the next agent |
| **Full context** | Custom configuration | Full conversation history is passed (higher token usage) |
| **No sharing** | Disabled | Each agent starts with a clean slate |

### Controlling Context Sharing

```
System property: sn_aia.allow_context_sharing
Default: true

When true: Orchestrator's context (including child agent results) is
summarized and available to subsequent child agents in the same workflow.
```

### What Gets Shared

| Shared | Not Shared |
|--------|------------|
| Orchestrator's objective | Child agent's internal reasoning steps |
| Tool inputs and outputs | Child agent's intermediate tool calls |
| Child agent's final response | Debug/trace information |
| Summary of prior child executions | Full conversation transcript |

### Design Implications

1. **Child agents should return self-contained results** — don't assume the next agent can see your intermediate steps.
2. **The orchestrator's instructions should specify what to pass** — "Include the incident number and triage results when dispatching to the resolution agent."
3. **Keep child agent outputs concise** — they become context for the orchestrator, which adds to token usage.

---

## Handoff Conditions

### When to Dispatch to a Child Agent

The orchestrator decides when to dispatch based on its instructions. Common patterns:

#### Pattern 1: Task-Based Dispatch

```
Orchestrator instructions:
"Analyze the request and determine which specialist to use:
- If the task involves CREATING or MODIFYING tool scripts → dispatch to Tool Builder
- If the task involves WRITING agent instructions → dispatch to Agent Configurator
- If the task involves TESTING or DEBUGGING → dispatch to QA Debugger
- If the task involves multiple of the above → dispatch sequentially, starting with Tool Builder"
```

#### Pattern 2: Stage-Based Dispatch

```
Orchestrator instructions:
"Follow this pipeline for every POC request:
1. First, dispatch to Solution Designer to create the architecture spec
2. Using the spec, dispatch to Tool Builder for each tool in the spec
3. Dispatch to Agent Configurator with the tools and spec
4. Finally, dispatch to QA Debugger to test everything
Report results after each stage."
```

#### Pattern 3: Conditional Dispatch

```
Orchestrator instructions:
"After initial analysis:
- If this is a simple single-agent use case → handle directly without child agents
- If this requires 2+ agents → dispatch to Solution Designer first
- If this is a debugging request → dispatch to QA Debugger directly"
```

### Handoff Data Format

When dispatching to a child agent, the orchestrator should provide:

```
Dispatch to [Child Agent]:
{
  "task": "Brief description of what to do",
  "context": {
    "source": "What the user originally asked",
    "prior_results": "What other agents have already done",
    "constraints": "Any specific requirements or limitations"
  },
  "expected_output": "What the orchestrator needs back"
}
```

---

## Failure Propagation

### How Failures Flow

```
Child Agent fails
    ↓
Child returns error to Orchestrator
    ↓
Orchestrator decides:
    ├── Retry the same child agent
    ├── Try a different child agent
    ├── Handle the failure itself
    └── Escalate to human
```

### Orchestrator Failure Handling Instructions

```
Orchestrator instructions:
"## Handling Child Agent Failures

If a child agent returns an error:
1. Read the error message carefully
2. Categorize the failure:
   - TRANSIENT (timeout, rate limit) → Retry once
   - DATA ISSUE (missing record, ACL) → Report to user, suggest fix
   - LOGIC ERROR (wrong output, invalid script) → Adjust instructions and retry
   - UNKNOWN → Escalate to human

3. Never retry more than once for the same error
4. If two different child agents fail on the same task, escalate to human"
```

### Child Agent Error Reporting

Child agents should return structured error information:

```
Child agent instructions:
"If you encounter an error you cannot resolve:
Return this format:
{
  'status': 'failed',
  'error_type': 'script_error|acl_error|data_error|timeout|unknown',
  'error_message': 'Clear description of what went wrong',
  'partial_results': 'Any work completed before the failure',
  'suggested_fix': 'What might resolve this issue'
}"
```

---

## Result Aggregation

### How the Orchestrator Collects Results

The orchestrator receives results from each child agent and must aggregate them into a coherent response.

#### Pattern: Sequential Aggregation

```
Orchestrator instructions:
"After each child agent completes, record:
- Agent name
- Task assigned
- Result (success/failure)
- Key outputs (sys_ids, numbers, etc.)

After ALL child agents have completed, compile a summary:
=== Solution Build Report ===
Components created:
- Tools: [list with sys_ids]
- Agents: [list with sys_ids]
- Skills: [list with sys_ids]
Test results: [pass/fail summary]
Issues found: [list]
=== End Report ==="
```

#### Pattern: Dependency-Aware Aggregation

When later agents need outputs from earlier agents:

```
Orchestrator instructions:
"1. Dispatch Tool Builder → receives: tool_sys_ids
2. Dispatch Agent Configurator with tool_sys_ids → receives: agent_sys_id
3. Dispatch QA Debugger with agent_sys_id → receives: test_results

Pass the output of each step as input to the next step.
If step N fails, do NOT proceed to step N+1."
```

---

## Memory Across Agents

Agent memory in ServiceNow is built on one real, populated table — **`sn_aia_memory`** ("AI Agent Memory", scope `sn_aia`) — plus a short-term context-summarisation strategy. Before you design where memory lives, map each memory concept to the actual platform primitive. Most of the work is **configuration**, not building a store: the platform owns the store and the extraction; you decide what feeds it and per which agent.

> Storage in `sn_aia_memory` is **plain text** — the `memory` content field is a string, not a vector/embedding. Vector storage is a separate subsystem (see "Plain text, not vectors" below). This is the single most common mis-design: do not architect `sn_aia_memory` as a vector store.

### Memory Architecture — Concept → Real Primitive

| Concept | ServiceNow primitive | Format / scope |
|---|---|---|
| Working / short-term | `sn_aia.context_sharing_strategy = summarise`; auto-summarised per execution | Transient, not developer-managed |
| Semantic (facts) | `sn_aia_memory` rows (semantic tier) | Plain-text `memory` string |
| Episodic (past reflections) | `sn_aia_memory` rows (episodic tier; agent-generated) | Plain-text `memory` string |
| Example | `sn_aia_memory` rows (example tier) | Plain-text `memory` string |
| Procedural (persona / rules) | Agent instructions + role | Authored config — **no runtime store** |

The `sn_aia_memory` row distinguishes memory tiers by a tier/type field. Treat the exact tier enum values (e.g. `semantic` / `episodic` / `example`) and any tier-specific source tables (e.g. `sn_aia_version`) as **(confirm on instance during build)** — verify the choice list before hard-coding tier names. The full field list (`type`, `task`, `relevance_score`, `category` reference, `source_table`, `source_id`, `active`) is likewise **(confirm on instance during build)**.

### Short-Term Memory (Within a Conversation)

- Governed by the **strategy property** `sn_aia.context_sharing_strategy` (default `summarise`) — this is a platform-level strategy, **not** a per-agent field.
- With `summarise`, prior context is **automatically condensed** by the platform each execution; it is transient and not a developer-managed blackboard.
- Available within the same agentic workflow execution. Do not rely on it persisting across separate workflow runs.

### Long-Term Memory (Across Conversations) — `sn_aia_memory`

Long-term memory persists facts, reflections, and examples in `sn_aia_memory` rows across separate conversations.

#### Platform provides vs. you configure

| Platform provides | You configure |
|---|---|
| Short-term context summarisation (`context_sharing_strategy = summarise`) | `sn_aia.ltm.enable_long_term_memory` (turn LTM on) |
| Platform-run, **async** LTM extraction/update into `sn_aia_memory` | `sn_aia.ltm.use_memory_for_ai_agent` (let agents use stored memory) |
| Category-based injection of memory into the prompt at runtime | Which memory **categories** apply (and `sn_aia.ltm.category.auto_create`) |
| The `sn_aia_memory` store itself (rows, tiers, relevance) | **`memory_scope` per `sn_aia_team_member`** — which agent owns memory |

LTM extraction is **platform-run and asynchronous**: you configure *what* feeds LTM, and the platform performs the extraction/update into `sn_aia_memory`. The specific business-rule name, its trigger condition, and the util/method that drive extraction are **(confirm on instance during build)** — do not name a specific rule or class until verified.

#### Enablement properties (`sn_aia` scope)

| Property | Default | Description |
|---|---|---|
| `sn_aia.ltm.enable_long_term_memory` | false | Master switch for long-term memory |
| `sn_aia.ltm.use_memory_for_ai_agent` | true | Allow agents to use stored memory at runtime |
| `sn_aia.ltm.category.auto_create` | true | Auto-create memory categories |

Confirm the live values of these properties per instance during build. (The canonical property reference and any related topology fixes are owned by the keystone doc-correctness ticket **#107** — reference it, do not re-fix property docs here.)

### Per-Agent Memory Is First-Class

Per-agent memory is a first-class primitive: **`memory_scope` is a field on `sn_aia_team_member`** (the per-agent record), not on the team or any orchestrator record. Each `sn_aia_team_member` is an agent peer; the team/orchestrator record holds **no** memory configuration. There is no "only the orchestrator has memory" and no "child agents inherit memory from the orchestrator" — you scope memory per agent member. Confirm the exact `memory_scope` choice values and default on instance during build.

### Plain Text, Not Vectors

`sn_aia_memory` stores **plain text** — the `memory` field is a string. It is **not** a vector/embedding store. Vector embeddings live in the decoupled **AI Search** subsystem (server-side semantic embeddings are exposed via AI Search RAG — exact API surface per #100/#119), which is separate from agent memory. When you need semantic/vector retrieval, that is an AI Search design concern, not an `sn_aia_memory` one. (Confirm the exact `memory` string length on instance during build.)

### Procedural Memory = Instructions

There is **no runtime procedural-memory table**. An agent's persona, rules, and how-to behaviour live entirely in its **instructions and role** — authored configuration, not a runtime store. This means procedural-memory quality is purely an instruction-authoring concern: if you want an agent to "remember how" to do something, you encode it in instructions, not in `sn_aia_memory`.

### Retrieval — Automatic Category-Based Injection

Retrieval of long-term memory is **automatic, category-based injection** of relevant memory rows into the agent prompt at runtime, gated by `sn_aia.ltm.enable_long_term_memory && sn_aia.ltm.use_memory_for_ai_agent`. Because `sn_aia_memory` stores plain text, do **not** assume semantic/vector retrieval for it — confirm any similarity/relevance/retrieval mechanism (e.g. how `relevance_score` and `category` gate injection) on instance during build before documenting it.

### Context Budget

Context budget is **provider/capability-governed** — set by the per-capability model configuration, which is bound on the capability *definition* (`sys_one_extend_capability_definition.connection`), not on `sys_one_extend_capability` itself. There is **no** fixed, instance-wide context-window constant in the platform or this repo; do not assert a 128K (or any single) token ceiling. Confirm the specific budget for the capability your agents use on instance during build.

### Memory Design Considerations

1. **Short-term memory is automatic** — ensure `context_sharing_strategy = summarise` (the default); it is summarised, transient, and not developer-managed.
2. **Long-term memory requires explicit enablement** — turn on `enable_long_term_memory`, choose categories, and apply privacy judgement to what you persist.
3. **Per-agent memory is first-class** — set `memory_scope` per `sn_aia_team_member`; there is no orchestrator-only memory and no inheritance from a parent agent.
4. **Memory across workflow runs is NOT free-form** — only what the platform extracts into `sn_aia_memory` (and re-injects by category) persists; each trigger otherwise starts a fresh execution.

---

## Recursive Execution Controls

### Platform Protections

ServiceNow prevents infinite loops in multi-agent workflows via a platform-enforced guardrail — not a configurable `sn_aia.*` sys_property (verified absent on gpinst01, Zurich Patch 10 Hotfix 3, 2026-07-18). Observed default behavior:

| Operation | Limit | Time Window |
|-----------|-------|-------------|
| **Create triggers** | 50 matching executions | 15 minutes |
| **Update triggers** | 5 matching executions | 15 minutes |

If an agent's action triggers another agent, which triggers another agent, etc., the platform will abort new executions after hitting these limits. Verify behavior on your target instance.

### Design Safeguards

#### Pattern: Depth Tracking

```
Orchestrator instructions:
"Track the depth of dispatch:
- Level 0: Orchestrator (you)
- Level 1: First child agent
- Level 2: Child of child (if applicable)

NEVER dispatch beyond Level 2. If a child agent needs help from another specialist,
return to the orchestrator and let it dispatch the second specialist."
```

#### Pattern: Loop Detection

```
Orchestrator instructions:
"Keep a list of tasks you've dispatched. If you find yourself dispatching
the same task to the same agent a second time, STOP and report:
'Detected potential loop: [task] was sent to [agent] twice. Human review needed.'"
```

#### Pattern: Execution Budget

```
Orchestrator instructions:
"You have a budget of 10 total child agent dispatches per request.
After 10 dispatches, compile whatever results you have and report to the user.
Do not continue dispatching."
```

---

## Follow-Up Behavior Configuration

### After Execution Completes

| Property | Default | Description |
|----------|---------|-------------|
| `sn_aia.follow_up_message` | "How else can I help you?" | Message shown after completion |
| `follow_up_behaviour` | Per workflow | Controls what happens after completion |
| `sn_aia.follow_up_qna_failure_limit` | 1 | Exit after N consecutive follow-up failures |

### Follow-Up Patterns

#### Pattern: Continue in Context

```
Workflow config:
  follow_up_behaviour: "continue"

After the agent completes:
  - Shows follow-up message
  - User can ask related questions
  - Context from the completed task is available
```

#### Pattern: End After Completion

```
Workflow config:
  follow_up_behaviour: "end"

After the agent completes:
  - Conversation ends
  - No follow-up questions accepted
  - Suitable for triggered/automated workflows
```

#### Pattern: Handoff After Completion

```
Workflow config:
  follow_up_behaviour: "handoff"

After the agent completes:
  - Transfers to a different agent or live support
  - Used when the completing agent is a specialist and the user may have broader needs
```

---

## Multi-Agent Design Checklist

### Before Building

- [ ] Each child agent has a clearly defined, non-overlapping responsibility
- [ ] Orchestrator instructions specify dispatch conditions for each child
- [ ] Data dependencies between agents are mapped (who needs what from whom)
- [ ] Failure handling is defined for each possible child agent failure
- [ ] Recursive execution limits are considered
- [ ] Follow-up behavior is configured

### During Testing

- [ ] Test each child agent independently before testing the full workflow
- [ ] Test orchestrator dispatch logic with mock child responses
- [ ] Test failure scenarios (child fails, child times out, child returns wrong format)
- [ ] Verify context sharing works (child receives needed context from orchestrator)
- [ ] Verify result aggregation is correct
- [ ] Test recursive execution protection (no infinite loops)

### Common Mistakes

| Mistake | Consequence | Fix |
|---------|------------|-----|
| Child agents with overlapping scope | Orchestrator dispatches to wrong child | Make scopes mutually exclusive |
| No failure handling in orchestrator | Workflow hangs on child failure | Add explicit error handling instructions |
| Passing too much context to children | Token budget exceeded, slow execution | Summarize context before dispatch |
| Not testing children independently | Can't isolate failures | Test each agent in isolation first |
| No execution budget | Runaway dispatches | Set max dispatch limit in instructions |

---

## Related Resources

- [Agentic Patterns](./agentic-patterns.md) — Orchestration architecture and strategies
- [Agent Instruction Templates](./agent-instruction-templates.md) — Templates for orchestrator instructions
- [ServiceNow AI Data Model](./servicenow-ai-data-model.md) — Workflow and execution tables
- [ServiceNow AI System Properties](./servicenow-ai-system-properties.md) — Memory and follow-up properties

---

*Patterns validated against ServiceNow Zurich agentic workflow architecture. Context sharing and recursive protection match Zurich platform behavior.*
