# Agentic Framework Patterns

> This document covers agentic patterns for building AI agents that interact with ServiceNow.

---

## Now Assist Is a ReAct Engine

**You configure a platform-run ReAct engine — you do not code one.** ServiceNow runs the
Thought → Action → Observation loop for you. `ReAct` is a platform-shipped, **read-only** strategy
record in `sn_aia_strategy` and is the default for the large majority of agents on an instance
(~291 of 313 agents on the verified instance). Builders do **not** author or edit strategies, write
the loop, pick a per-agent model, or set a numeric iteration cap.

What an agentic system does — reason about a task, act by invoking tools, observe results, and
iterate until the goal is met — is exactly the loop the platform owns. Your job is to make that
platform-run loop produce good outcomes on ServiceNow data, not to re-implement it.

**Agents are declarative `sn_aia_agent` records**, not loop code. Each agent record carries its
instructions, role, tool bindings, and a reference to a strategy; the platform executes the ReAct
loop against that record. Each step lands in `sn_aia_execution_task` under an execution plan
(`sn_aia_execution_plan`), including a literal `"Thought"` step whose quality is governed by your
instruction text (see agent-prompt-writer Step 3g: Reasoning Elicitation — cross-linked, not
restated here).

**Builder leverage lives in three places, not in loop code:**

- **Instructions** — role, objective, and how to reason (the lever on the `"Thought"` step).
- **Tools** — which `sn_aia_tool` records the agent may invoke, bound via `sn_aia_agent_tool_m2m`.
- **Memory feeding** — what context crosses agent/session boundaries (see Memory Architecture below).

**Loop bounds are platform-capped, not developer-set:**

- `sn_aia.continuous_tool_execution_limit` — max consecutive same-tool executions (developer-editable; 25 on the verified instance).
- `sn_aia.react_failure_retry_max_limit` — retries on ReAct failure (3).

There is **no `sn_aia.max_iterations` property**, no per-agent/per-skill model field, and no
single instance-wide model. Model selection is bound **per One Extend capability definition**
(`sys_one_extend_capability_definition.connection`, a GenAI alias), not on the agent record — the
`sys_one_extend_capability` table itself has no model field, and there is no `sn_aia.agent_llm_provider`.
Any context-window limit is per-provider / per-instance-LLM dependent, not a fixed platform ceiling.

> **For real, build-validated Fluent DSL**, see the golden examples — do not hand-code an agent
> runtime: [`context/sdk-examples/ai-agent.now.ts`](sdk-examples/ai-agent.now.ts) (single agent +
> tools) and [`context/sdk-examples/ai-agentic-workflow.now.ts`](sdk-examples/ai-agentic-workflow.now.ts)
> (multi-agent workflow).

## Tool Definition Patterns

You define a tool as an `sn_aia_tool` record bound to an agent through `sn_aia_agent_tool_m2m`; the
tool's logic is a tool script. You declare the tool's name, description, and input parameters; the
platform supplies the inputs the agent extracted and runs the script when the ReAct loop selects it.

For the canonical, build-validated tool definitions, see
[`context/sdk-examples/ai-agent.now.ts`](sdk-examples/ai-agent.now.ts).

**Tool design patterns:**

- **Single-purpose tool** — one clear capability (e.g., "retrieve an incident by number or sys_id"),
  with a tight parameter contract. Narrow tools are easier for the loop to select correctly.
- **Validated input** — declare required parameters and constrained types so the agent supplies
  well-formed inputs; reject and return a structured error rather than acting on bad input.
- **Composite operation** — a single tool that performs a multi-step unit of work (update a record,
  add a work note, optionally create a knowledge article, notify the requester) and returns a
  structured summary of what it did. Prefer this over making the agent chain several fine-grained
  tools when the steps always go together.

**Tool-script safety (mandatory — per `context/tool-script-rules.md`):**

- Use `GlideRecordSecure` with `addUserEncodedQuery()` for all data access. Never use a raw
  `new GlideRecord(...)` without the secure wrapper.
- `gs.warn()`, `gs.error()`, `gs.debug()` and similar logging calls are **forbidden** in tool
  scripts — those APIs are undefined in the tool sandbox. Return errors as structured data instead.

## Multi-Step Orchestration

Orchestration is configured on the platform, not coded as a JS dispatcher. You decide the topology
through `sn_aia` records and triggers; the ReAct loop drives step selection at runtime.

**Decision sketch — single agent vs. team vs. hierarchy:**

- **Single agent** — start here. One `sn_aia_agent` with the tools it needs. Add more only when you
  can name the failure mode another agent prevents.
- **Team of peers** — a `sn_aia_team` with multiple `sn_aia_team_member` rows (agent peers; there is
  **no order field**, so peers are not an ordered pipeline). Use when distinct specialties must
  collaborate within one usecase.
- **Supervisor → child hierarchy** — opt-in via `sn_aia_agent_child` (rare; 3 rows on the verified
  instance). Use when a supervising agent must delegate to and compose results from sub-agents.

**Sequential, parallel, and branching behavior** are emergent properties of instructions + tool
bindings + the ReAct loop, not constructs you implement. The platform does ship parallel/peer
affordances, in different states on the verified instance: **parallel tool execution is enabled**
(`sn_aia.agent_parallel_tool_execution.enabled = true`), and `sn_aia_execution_task` carries a
`task_dependencies` DAG field. The **Swarm Planner and LLM Compiler** planner strategies
(`sn_aia_strategy` records) are **shipped but unused — 0 of 313 agents run on them** — so
orchestrator+child / team-peer remains the practical default. (Confirm which strategies are enabled
on your target instance during build.)

For a real multi-agent configuration, see
[`context/sdk-examples/ai-agentic-workflow.now.ts`](sdk-examples/ai-agentic-workflow.now.ts).

## Error Handling and Escalation

The platform handles retries and loop bounds for you (`sn_aia.react_failure_retry_max_limit = 3`;
`sn_aia.continuous_tool_execution_limit = 25`). You do not write a backoff/retry loop. Recursive
execution protection is also platform-enforced (see "Recursive Execution Protection" below).

What you **do** design:

- **Graceful degradation** — give the agent fallback instructions and a fallback tool so it can
  return a useful partial result instead of failing hard. Return structured error data from tool
  scripts (never `gs.warn`/`gs.error`).
- **Human escalation** — for low-confidence or sensitive work, route to a human. Use the platform's
  **execution mode** as the human-in-the-loop gate: **Supervised** (copilot) requires approval
  before the agent acts; **Autonomous** (autopilot) does not. Reserve a verifier/approval step
  before any irreversible or write-of-authority action.
- **Tool-side record creation**, when an escalation tool must create a task, uses `GlideRecordSecure`
  + `addUserEncodedQuery()` — see [`context/sdk-examples/ai-agent.now.ts`](sdk-examples/ai-agent.now.ts)
  for the secure pattern.

## Testing Agentic Systems

There is no hand-coded JS unit-test harness for the agent loop — the loop is platform-run, so you
test against a live instance:

- **Test an agent** via the MCP `servicenow_aia_execute` tool, or the Test run type in AI Agent Studio.
- **Inspect reasoning** through `sn_aia_execution_plan` / `sn_aia_execution_task` records (look at the
  literal `"Thought"` key) and the MCP `servicenow_aia_trace` tool.
- **Debug failures** with `servicenow_aia_logs` / `servicenow_aia_errors`.
- **Validate the build** before install with the golden examples as the schema-correct baseline:
  [`context/sdk-examples/ai-agent.now.ts`](sdk-examples/ai-agent.now.ts) and
  [`context/sdk-examples/ai-agentic-workflow.now.ts`](sdk-examples/ai-agentic-workflow.now.ts).

## Best Practices

### 1. Limit Agent Scope
- Define clear boundaries for what the agent can and cannot do
- Require human approval for destructive or irreversible actions

### 2. Maintain Audit Trail
- Log all agent decisions and actions
- Store reasoning for later review

### 3. Implement Circuit Breakers
- Set maximum iterations
- Monitor for loops and repeated failures
- Automatic escalation when stuck

### 4. Design for Observability
- Emit structured logs
- Track metrics (success rate, avg iterations, escalation rate)
- Enable tracing for debugging

### 5. Start Simple
- Begin with narrow, well-defined tasks
- Expand scope gradually as confidence grows
- Always have a human-in-the-loop option

### 6. Avoid Architectural Anti-Patterns

Most agentic failures are designed in before any code is written. Check every design against these
(full catalog with cross-references in the `agentic-workflow-builder` skill):

| Anti-Pattern | Better Approach |
|---|---|
| "More agents = better" | Start with one agent; add another only when you can name the failure mode it prevents |
| Symmetric multi-agent (same prompt, voting) | Different-model judge or a deterministic check |
| Supervisor when the route never changes | Sequential pipeline — no routing decision needed |
| No quality gate before irreversible actions | Evaluator → Optimizer + human-in-the-loop |
| No shared state for multi-step research | Work notes or a custom table as shared context |
| No stopping condition | Explicit success criteria + iteration budget |
| Anti-reasoning instructions ("just classify", "be brief") | Instructive replacements that direct *how* to reason |
| Mixing reasoning and structured output in one step | Two-stage prompting: reason first, extract second |
| No verifier slot | Reserve the verifier slot before any write-of-authority |

**Rule of thumb:** every agent and every LLM call should earn its place by preventing a failure
mode you can name. If you can't name it, remove the agent/call.

---

## ServiceNow Zurich: Agentic Workflow Architecture

In Zurich, ServiceNow formalizes agentic patterns through **Agentic Workflows** — managed multi-agent orchestrations.

### Architecture

The usecase links to agents **through a team** — there is no `orchestrator_agent` field on
`sn_aia_usecase` and no direct usecase → agent link. The verified topology chain is:

```
sn_aia_usecase
    └── sn_aia_team
            └── sn_aia_team_member        (agent peers — NO order field)
                    └── sn_aia_agent      (313 rows on the verified instance)
                            └── sn_aia_agent_tool_m2m
                                    └── sn_aia_tool   (~1110 rows)

Supervisor → child hierarchy, where it exists, is opt-in via:
    sn_aia_agent_child   (3 rows on the verified instance)
```

Team members are **peers** (no ordering field), so a team is not an ordered pipeline. Where a
supervising agent must delegate to sub-agents, that relationship is modeled explicitly with
`sn_aia_agent_child`. The platform **runs** the ReAct loop to decide which tool (or, under
`sn_aia_agent_child`, which child agent) to invoke at each step; the builder configures
instructions, tools, and the strategy reference and never codes the loop. (The exact positive
reference-field list on `sn_aia_usecase` is not part of the verified notes — confirm on instance
during build.)

### Trigger Types

| Trigger | Description | Table Config |
|---------|-------------|-------------|
| **Record** | Fires when a record matches conditions | Target table + filter conditions |
| **Scheduled** | Runs on a schedule | Cron expression, max records per run (default: 10) |
| **Chat** | User conversation via Virtual Agent | No table config needed |
| **API** | Programmatic invocation | Via `sn_aia.AiAgentRuntimeUtil` |

### Execution Plan Lifecycle

```
queued/ready → in_progress → [agent/tool steps...] → wrap_up → completed
                                                        └→ terminated (+ state_reason)
```

`sn_aia_execution_plan.state` choices (verified gpinst01, Zurich P10): `queued`, `ready`,
`in_progress`, `wrap_up`, `completed`, `terminated`, `abandoned`, `deleted`. There is **no
`failed` state** — failures surface as `terminated` plus a `state_reason` such as
`security_violation`, `planning_failed`, `execution_failed`, or `no_activity`.

Run types (`run_type`): `api`, `chat`, `evaluation`, `testing`, `trigger`, `a2a`. Stored
values are lowercase and choice queries are case-sensitive — `run_type=Chat` returns zero rows.

Full field and choice sets in the [ServiceNow AI Data Model](./servicenow-ai-data-model.md)
execution-table sections.

### Memory Architecture

Short-term memory is the platform's context summarisation (`sn_aia.context_sharing_strategy = summarise`, default; persists within one conversation, gated by `sn_aia.allow_context_sharing`). Long-term memory (`sn_aia.ltm.enable_long_term_memory`, off by default; auto-creates categories when `sn_aia.ltm.category.auto_create = true`) persists facts, reflections, and examples in `sn_aia_memory` rows across conversations and re-injects them by category at runtime. Memory is **per-agent** — `memory_scope` on `sn_aia_team_member`, not on the team/orchestrator — and **plain text, not vectors**.

For the full concept → real-primitive mapping, the platform-provides-vs-you-configure split, enablement properties, and memory design considerations, see [Multi-Agent Handoff Patterns](./multi-agent-handoff-patterns.md) § Memory Across Agents.

### Follow-up Conversations

After execution completes:
- Default message: "How else can I help you?" (`sn_aia.follow_up_message`)
- Configurable per workflow via `follow_up_behaviour` property
- Exit after consecutive failures: `sn_aia.follow_up_qna_failure_limit` (default: 1)

### Programmatic Execution

```javascript
var runtime = new sn_aia.AiAgentRuntimeUtil();
var req = {
    targetRecordId: recordSysId,
    targetTable: 'incident',
    agentId: agentSysId,
    objective: 'Analyze and categorize this incident',
    conversationUser: gs.getUserName(),
    canInteractWithUser: false  // FALSE for automation
};
var resp = runtime.startAiAgentConversation(req);
```

### Recursive Execution Protection

ServiceNow prevents infinite loops via a platform-enforced guardrail — not a configurable `sn_aia.*` sys_property (verified absent on gpinst01, Zurich Patch 10 Hotfix 3, 2026-07-18). Observed default behavior:
- **Create operations**: Max 50 matching executions within 15 minutes
- **Update operations**: Max 5 matching executions within 15 minutes
- Exceeding limits causes new executions to abort
- Verify behavior on your target instance

### Analytics

Dashboard: All > AI Agent Studio > Analytics

Key metrics:
- Conversations with AI agent assist
- Average time to close tasks (with/without AI)
- Efficiency gain percentage
- Tasks closed using AI agents
- Inferred CSAT (1-5 scale)
- User effort (Low/Medium/High)

**Data collection jobs** (run in order):
1. `[Now Assist AI Agents] Historical Data Collection` — initial data
2. `[Now Assist AI Agents] Daily Data Collection`
3. `[Now Assist AI Agents] Periodic Data Collection`

Note: Latency indicators update every 15 minutes; other indicators update daily.
