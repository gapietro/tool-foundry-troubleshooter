# Flow Designer for AI — ServiceNow Zurich

> Flow Designer patterns for AI workflows: flow actions as tool types, subflow design, trigger configuration, flow-to-agent integration, and error handling in AI-powered flows.

---

## Overview

Flow Designer is ServiceNow's no-code/low-code automation engine. In Zurich, it integrates directly with AI Agents through two mechanisms:

1. **Flow Actions as Agent Tools** — An AI agent can invoke a flow action as a tool type
2. **Subflows as Agent Tools** — Agents can trigger subflows for complex multi-step operations
3. **Flows Triggering Agents** — Flows can programmatically invoke AI agents via `AiAgentRuntimeUtil`

Understanding both directions — agents calling flows AND flows calling agents — is essential for building production-ready AI solutions.

---

## Flow Actions as Agent Tool Types

### How It Works

In the AI Agent Studio, when adding a tool to an agent, you can select:
- **Flow action** — Links to an existing IntegrationHub spoke action
- **Subflow** — Links to an existing subflow

The agent can then invoke these flows as tools during execution.

### When to Use Flow Actions vs Script Tools

| Use Flow Action | Use Script Tool |
|----------------|-----------------|
| Logic already exists in a spoke | Need custom GlideRecordSecure queries |
| Multi-system integration (REST, SOAP, email) | Simple single-table operations |
| Approval workflows needed | Quick data lookups |
| Complex branching logic already built | Custom data transformation |
| Need audit trail of flow execution | Performance-critical operations (<100ms) |

### Connecting a Flow Action to an Agent

1. Navigate to the agent in AI Agent Studio
2. Add a new tool → Select type "Flow action"
3. Choose the spoke and action
4. Map the agent's tool inputs to the flow action's inputs
5. Map the flow action's outputs back to the tool outputs

```
Agent Tool Input → Flow Action Input Mapping → Flow Execution → Output Mapping → Agent Tool Output
```

### Key Considerations

- **Performance:** Flow actions add latency (typically 1-5 seconds). For simple lookups, prefer script tools.
- **Error handling:** Flow action errors propagate as tool errors to the agent. The agent should have fallback instructions.
- **Execution context:** Flow actions run under the context of the flow, not the agent user. ACLs in flows are based on the flow's run-as user.

---

## Subflow Design for AI Agents

### Subflow vs Flow Action

| Aspect | Flow Action | Subflow |
|--------|-------------|---------|
| **Scope** | Single operation | Multi-step sequence |
| **Reuse** | Across flows and agents | Across flows and agents |
| **Inputs/Outputs** | Defined on the action | Defined on the subflow |
| **Error handling** | Built-in retry | Custom error paths |
| **Best for** | Atomic operations | Orchestrated sequences |

### Subflow Design Patterns for AI

#### Pattern 1: Approval Subflow

When an agent needs human approval before proceeding:

```
Subflow: Request Change Approval
  Input: change_request_sys_id, requested_by, justification
  Steps:
    1. Get change request details
    2. Determine approval group based on risk level
    3. Create approval request
    4. Wait for approval (with timeout)
    5. If approved → return {status: "approved", approver: "..."}
    6. If rejected → return {status: "rejected", reason: "..."}
    7. If timeout → return {status: "timeout"}
  Output: approval_status, approver, timestamp
```

#### Pattern 2: Multi-System Subflow

When an agent needs to coordinate across systems:

```
Subflow: Provision User Access
  Input: user_sys_id, system_name, access_level
  Steps:
    1. Validate user exists in ServiceNow
    2. Check if user already has access
    3. Call external system API to provision (REST step)
    4. Wait for confirmation (polling or callback)
    5. Update ServiceNow access record
    6. Send notification to user
  Output: provisioning_status, access_id, completion_time
```

#### Pattern 3: Data Enrichment Subflow

When an agent needs aggregated data from multiple sources:

```
Subflow: Enrich Incident Context
  Input: incident_sys_id
  Steps:
    1. Get incident record
    2. Get caller's recent incidents (last 30 days)
    3. Get affected CI's recent changes (last 7 days)
    4. Get knowledge articles matching description
    5. Aggregate into enriched context object
  Output: enriched_context (JSON with all gathered data)
```

---

## Trigger Configuration

### Trigger Types for AI Agent Workflows

| Trigger | How It Works | Configuration |
|---------|-------------|---------------|
| **Record** | Fires when a record matches conditions | Target table + filter conditions + operation (create/update) |
| **Scheduled** | Runs on a cron schedule | Schedule expression + max records per run (default: 10) |
| **Chat** | User initiates via Virtual Agent | No table config — conversation-driven |
| **API** | Programmatic invocation | Via `sn_aia.AiAgentRuntimeUtil` |

### Record Trigger Design

```
Trigger: New P1 Incident
  Table: incident
  Operation: Insert
  Conditions: priority = 1 AND state = New
  Agent: Incident Triage Agent
```

**Key settings:**
- **Run type:** `Trigger` (automatic)
- **Recursive protection:** Max 50 creates or 5 updates in 15 minutes
- **Target record:** The record that triggered the workflow becomes the context

### Scheduled Trigger Design

```
Trigger: Daily SLA Review
  Schedule: Every day at 8:00 AM
  Max records: 25
  Query: active=true AND sla_breach=imminent
  Agent: SLA Review Agent
```

**Key settings:**
- **Max records per run:** Controls batch size (default: 10)
- **Query:** Filters which records to process in each run
- **Run type:** `Trigger` (scheduled)

### API Trigger Design

For programmatic invocation from other scripts or flows:

```javascript
// Invoke AI agent from a flow action or business rule
var runtime = new sn_aia.AiAgentRuntimeUtil();
var req = {
    targetRecordId: current.sys_id.toString(),
    targetTable: 'incident',
    agentId: '<agent_sys_id>',
    objective: 'Analyze and triage this incident',
    conversationUser: current.caller_id.toString(),
    canInteractWithUser: false  // FALSE for automated triggers
};
var resp = runtime.startAiAgentConversation(req);
```

> **Important:** Set `canInteractWithUser: false` for any automated invocation. The agent cannot ask questions when there's no user on the other end.

---

## Flow-to-Agent Integration Patterns

### Pattern 1: Flow Triggers Agent

A flow detects a condition and invokes an AI agent:

```
Flow: Incident Auto-Triage
  Trigger: Record created on incident table
  Condition: category is empty AND priority is empty
  Actions:
    1. Invoke AI Agent (via Script step calling AiAgentRuntimeUtil)
    2. Wait for agent completion (poll execution status)
    3. If agent succeeded → end
    4. If agent failed → assign to Service Desk for manual triage
```

### Pattern 2: Agent Invokes Flow

An AI agent calls a subflow as one of its tools:

```
Agent: Change Implementation Agent
  Tools:
    - get_change_details (Script tool)
    - validate_change_plan (Script tool)
    - request_approval (Subflow tool → "Change Approval Subflow")
    - implement_change (Subflow tool → "Change Implementation Subflow")
```

### Pattern 3: Bidirectional (Flow ↔ Agent)

A flow triggers an agent, and the agent invokes subflows during its execution:

```
Flow: End-to-End Incident Resolution
  Trigger: P1 incident created
  Actions:
    1. Invoke "Incident Triage Agent"
       → Agent uses script tools to analyze
       → Agent uses "Assign to Group" subflow
    2. Wait for assignment
    3. Invoke "Resolution Agent"
       → Agent uses script tools to diagnose
       → Agent uses "Apply Resolution" subflow
    4. Invoke "Notification Subflow" to inform stakeholders
```

---

## Error Handling in AI Flows

### Flow Action Error Handling

```
Flow Action: Call External API
  Try:
    1. Make REST call
    2. Parse response
  Catch:
    - HTTP 429 (rate limit) → Wait 30 seconds, retry (max 3)
    - HTTP 500 (server error) → Log error, return error status
    - Timeout → Log error, return timeout status
    - Parse error → Log raw response, return parse error
```

### Agent Execution Error Handling

When a flow invokes an agent and the agent fails:

```
Flow: Agent-Powered Workflow
  Steps:
    1. Start agent conversation
    2. Poll for completion (timeout: 5 minutes)
    3. Check execution status:
       - completed → Continue with agent output
       - failed → Log failure, assign to human queue
       - cancelled → Log cancellation, notify admin
       - timeout → Log timeout, retry once, then human queue
```

### Error Recovery Pattern

```javascript
// Flow script step: Invoke agent with error recovery
var runtime = new sn_aia.AiAgentRuntimeUtil();
var maxRetries = 2;
var attempt = 0;
var success = false;

while (attempt < maxRetries && !success) {
    try {
        var resp = runtime.startAiAgentConversation({
            targetRecordId: current.sys_id.toString(),
            targetTable: 'incident',
            agentId: agentSysId,
            objective: 'Triage this incident',
            canInteractWithUser: false
        });

        if (resp && resp.executionId) {
            success = true;
            fd_data.execution_id = resp.executionId;
        }
    } catch (e) {
        attempt++;
        if (attempt >= maxRetries) {
            // Final fallback: assign to human
            current.assignment_group = fallbackGroupSysId;
            current.work_notes = 'AI triage failed after ' + maxRetries + ' attempts: ' + e.message;
            current.update();
        }
    }
}
```

---

## Best Practices

### 1. Keep Flows and Agents Complementary

- **Flows** handle: deterministic logic, approvals, notifications, system integration, scheduling
- **Agents** handle: reasoning, classification, content generation, analysis, decision-making

Don't use agents for things flows do better (sending emails, waiting for approvals).
Don't use flows for things agents do better (analyzing text, making judgment calls).

### 2. Design for Failure

Every flow-agent integration should have a human fallback:

```
If agent succeeds → Use agent output
If agent fails → Assign to human queue with agent's partial work
```

### 3. Mind the Latency Budget

| Component | Typical Latency |
|-----------|----------------|
| Script tool | 100-500ms |
| Flow action tool | 1-5s |
| Subflow tool | 2-10s |
| Agent execution (1-3 tools) | 5-30s |
| Agent execution (5+ tools) | 30-120s |

If total latency matters (chat interface), minimize flow action tools. Use script tools for speed-critical operations.

### 4. Test Flow-Agent Integration Separately

1. Test the flow without the agent (mock agent responses)
2. Test the agent without the flow (direct API invocation)
3. Test the full integration

---

## Related Resources

- [Agentic Patterns](./agentic-patterns.md) — Agent architecture and trigger types
- [Iterative Development Workflow](./iterative-development-workflow.md) — The test loop
- [Tool Script Rules](./tool-script-rules.md) — Script tool patterns
- [ServiceNow AI Data Model](./servicenow-ai-data-model.md) — Workflow and trigger tables

---

*Patterns validated against ServiceNow Zurich Flow Designer with AI Agent integration. Trigger types and execution patterns match Zurich documentation.*
