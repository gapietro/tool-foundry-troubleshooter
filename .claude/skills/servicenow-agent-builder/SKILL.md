---
name: servicenow-agent-builder
description: "**For creating agents via Fluent DSL, read the golden example: `.claude/context/sdk-examples/ai-agent.now.ts`. This skill covers runtime rules, testing, and debugging only.**"
scope: project
recommended: false
version: 2.0.0
---
# Claude Code Skill: ServiceNow AI Agent — Runtime Rules, Testing & Debugging

> **For creating agents via Fluent DSL, read the golden example: `.claude/context/sdk-examples/ai-agent.now.ts`.
> This skill covers runtime rules, testing, and debugging only.**

> **Path resolution:** `.claude/context/...` paths in this skill assume a
> Foundry-MCP-provisioned project (`foundry_init` / `foundry_add`). When this
> skill runs from the Foundry Claude Code plugin instead, the same files live
> under `${CLAUDE_PLUGIN_ROOT}/context/...` — read whichever path exists.

> **Runtime tooling:** The `servicenow_*` tool names in this document are the Foundry MCP server's runtime tools. Treat them as capabilities — "execute an agent", "read an execution trace", "query a table" — and map them to the equivalents of whatever MCP server is connected. With no MCP server, fall back to manual verification: test in the Now Assist panel / AI Agent Studio and read execution traces from `sn_aia_execution_plan` / `sn_aia_execution_task`; query data via list views or a user-run background script.

---

## Platform Architecture

**Now Assist runs a ReAct engine — you configure it, you do not code it.** ServiceNow owns the
Thought → Action → Observation loop. `ReAct` is a platform-shipped, **read-only** strategy record in
`sn_aia_strategy` and is the default for the large majority of agents (~291 of 313 on the verified
instance). You do not author or edit strategies, write the loop, choose a per-agent model, or set a
numeric iteration cap.

You build **declarative `sn_aia_agent` records** — instructions, role, tool bindings, and a strategy
reference. The topology runs `sn_aia_usecase` → `sn_aia_team` → `sn_aia_team_member` (agent peers, no
order field) → `sn_aia_agent` → `sn_aia_agent_tool_m2m` → `sn_aia_tool`; supervisor → child
hierarchy, where present, is opt-in via `sn_aia_agent_child`. There is no orchestrator-agent field
on the usecase.

**Builder leverage = instructions, tools, and memory-feeding** (what context crosses agent/session
boundaries) — not loop code. The literal `"Thought"` step recorded in `sn_aia_execution_task` is an
instruction-quality lever; shape it through instruction text, not loop logic. For how to write that
instruction text, see **agent-prompt-writer Step 3g (Reasoning Elicitation)** — cross-linked, not
restated here.

**Loop bounds are platform properties, not developer code:** `sn_aia.continuous_tool_execution_limit`
(= 25, developer-editable) and `sn_aia.react_failure_retry_max_limit` (= 3). There is **no
`sn_aia.max_iterations`**. Model selection is bound **per One Extend capability definition**
(`sys_one_extend_capability_definition.connection`, a GenAI alias), not on the agent — the
`sys_one_extend_capability` table has no model field, there is no `sn_aia.agent_llm_provider`, and no
single instance-wide model. Any context-window limit is per-provider / per-instance-LLM dependent.

---

## Rule 1: Tool Scripts Use Native JS Only

**NEVER use these in tool scripts (they hang indefinitely):**
```javascript
// FORBIDDEN - Causes silent hangs
new GlideDateTime().getDisplayValue();
gs.getUserName();
gs.getSessionID();
gs.getUserID();
gs.log();
gs.print();
gs.info();
```

**ALWAYS use these instead:**
```javascript
// REQUIRED - Native JavaScript only
new Date().toISOString();
new Date().toLocaleDateString();
Date.now();
String(value);
Number(value);
JSON.parse();
JSON.stringify();
```

---

## Rule 2: GlideRecordSecure is Mandatory (Zurich+)

Use `GlideRecordSecure` with `addUserEncodedQuery()` for ACL enforcement:

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('number', String(inputs.incident_number || ''));
        gr.setLimit(1);
        gr.query();

        if (gr.next()) {
            outputs.record = {
                sys_id: gr.getValue('sys_id'),
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description')
            };
            outputs.status = 'success';
        } else {
            outputs.status = 'not_found';
        }
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = 'error';
    }
    return outputs;
})(inputs);
```

On Vancouver instances, `GlideRecord` is acceptable. On Zurich+, always use `GlideRecordSecure`.

### Evidence Gate (high-stakes writes)

Rule 2 secures the *tool* layer (ACL enforcement). An **Evidence Gate** secures the *instruction* layer: it forces the agent to justify a field value with cited evidence before it writes it. This is a **builder-imposed authoring convention you write into the agent's instructions — it is NOT a native ServiceNow feature**, NOT "ReAct V3", and there is no platform setting that turns it on. It is grounded in reasoning research, where semi-formal "show your premises" prompting has been found to meaningfully improve decision accuracy.

Scope it to **high-stakes writes only** — classification (category/subcategory), priority, assignment group, approval decisions, and resolution notes. Do **not** apply it to "any record update"; routine, low-judgment writes do not need a gate and over-gating bloats the Thought cycle.

Copyable instruction template (paste into agent instructions, adapt the field):

```
Before writing a high-stakes field (category, priority, assignment_group,
approval, resolution_notes), you MUST first state, internally:
  • The field and the exact target value you intend to set.
  • The tool output or record field that supports that value
    (cite the source — tool name, user input, or record field).
  • The platform rule that confirms it is valid
    (the category taxonomy, the assignment/priority policy, or CMDB data).
If you cannot cite evidence for all three, DO NOT set the field —
ask the user or hand off instead.
```

**Pair every internal reasoning step with a user-facing step.** The evidence justification is an INTERNAL Thought-cycle operation and must never be surfaced to the user. Use the paired-step pattern: STEP Na (INTERNAL — premises, sources, and rule check; never displayed) followed by STEP Nb (user-facing — the decision and a one-line plain-language explanation only). Skipping the paired user-facing step causes reasoning leakage, where raw premises bleed into the chat.

For the fuller treatment — branch accountability, anti-patterns, and detailed when-to-use scoping — see the canonical pattern at `skills/crisp-servicenow-builder/section-guide.md`, section **"Evidence Gates (Cross-Cutting)"**.

**Post-hoc verification:** the gate's reasoning is auditable after the fact via the agent execution trace, not via any UI. There is **no "Reasoning Trace Audit" feature** in the platform. Use the MCP `servicenow_aia_trace` tool, which reads `sn_aia_execution_plan` and `sn_aia_execution_task` (each task step stores the Thought/Action/Observation cycle under a literal `Thought` key), to confirm the agent cited evidence before writing.

---

## Rule 3: Input Schema MUST Include "mandatory"

```javascript
// BROKEN - Agent may skip inputs
[{"name":"message","type":"string"}]

// WORKING - Forces agent to collect input
[{"name":"message","type":"string","mandatory":true}]
```

---

## Rule 4: Always Include Error Handling

Every tool script must wrap logic in try-catch and return an `outputs` object with a `status` field.

---

## Rule 5: Tool Naming

- `internal_name` must use **snake_case** (e.g. `get_incident_details`)
- CamelCase is forbidden for `internal_name`

---

## Tool Execution Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| **Supervised (copilot)** | Human must approve before execution | Write operations, sensitive data |
| **Autonomous (autopilot)** | Executes without approval | Read-only queries, safe operations |

---

## Platform Limits

| Limit | Value | Configurable Via |
|-------|-------|-----------------|
| Max tools per agent | 20 | `sn_aia.maximum_agent_tools` |
| Max consecutive same-tool | 25 (developer-editable) | `sn_aia.continuous_tool_execution_limit` |
| Max retries on failure | 3 | `sn_aia.react_failure_retry_max_limit` |
| Tool execution record expiry | 13 months | Automatic |

---

## CRUD Tool & Trigger Constraints (from the SDK 4.9.0 AI-agents guide)

- **Journal fields (`work_notes`, `comments`) cannot be written by CRUD update tools** — the write silently fails. Use a Script tool with GlideRecordSecure (`gr.work_notes = '...'; gr.update();`) for journal updates.
- **CRUD query tools: always include `{ name: 'sys_id' }` in `returnFields`** — downstream tools and agents need the sys_id to act on the record.
- **`mappedToColumn` self-check:** query-tool input fields must NOT carry `mappedToColumn`; create/update write fields MUST. Mixing these up produces tools that read filters as writes or vice versa.
- **Triggers deploy INACTIVE** — after `now-sdk install`, activate the `sn_aia_trigger_configuration` on the instance once tested. Don't debug "trigger never fires" before checking `active`.
- **Trigger run-as is required for all trigger types** — prefer `runAs: '<sys_user reference column on the target table>'` (discover candidates with `now-sdk query sys_dictionary --query 'name=<table>^internal_type=reference^reference=sys_user'`); use `runAsUser` for a fixed service account (direct sys_id — see Build Rule #21 / issue #188 on why not `Now.ref`). Scheduled triggers additionally require `objectiveTemplate`.
- **Role access: `dataAccess.roleMap` (role names) vs `roleList` (sys_ids)** — `roleMap` is the current path (SDK 4.7.0+; instance must be Zurich P10 / Australia P3+) and writes supported `sys_agent_access_role_mapping` M2M records. `roleList` is legacy for older instances and takes direct sys_id strings only.

---

## Agent Strategy Selection

| Strategy | Use When | Tool Calling |
|----------|----------|--------------|
| **ReAct** | Agent needs to query data, reason, act | Yes |
| **ReActive Planner** | Complex multi-step planning | May skip tools |
| **CoPilot** | Interactive user assistance | Yes (86% OOTB) |
| **AutoPilot** | Fully automated execution | Yes (7% OOTB) |

**Default Recommendation:** Use **ReAct** for most use cases.

---

## Programmatic Execution

Use `AiAgentRuntimeUtil` for automated workflows (Business Rules, Scheduled Jobs, Flow Designer):

```javascript
var runtime = new sn_aia.AiAgentRuntimeUtil();

var req = {
    targetRecordId: gr.sys_id.toString(),
    targetTable: "incident",
    agentId: "your_agent_sys_id",
    objective: "Analyze and categorize this incident",
    conversationUser: "admin",
    canInteractWithUser: false  // FALSE for automation
};

var resp = runtime.startAiAgentConversation(req);

if (resp.status == "success") {
    gs.info("Agent completed: " + resp.data.conversationId);
} else {
    gs.error("Agent failed: " + JSON.stringify(resp.error));
}
```

---

## Multi-Agent Chaining Pattern

Chain agents via tool outputs:

**Agent 1 Tool Output:**
```javascript
outputs.Status = "SUCCESS";
outputs.NextAgentName = "Agent2";
outputs.data = { /* payload for next agent */ };
```

**Agent 2 Instructions:**
```
Step 1: Receive data from previous agent
Step 2: Check ${Status}
Step 3: If SUCCESS, process ${data}
Step 4: If ERROR, escalate to human
```

---

## Prompt Engineering for Agent Instructions

Write agent instructions as numbered step-by-step procedures. Include:
- Which tools to call and in what order
- What to do with each tool's output
- Explicit fallback behavior (e.g. "If not found, ask the user for clarification")
- When to stop and escalate vs. continue autonomously

Avoid vague instructions like "handle the incident appropriately."

---

## Testing Workflow

### Test AI Reasoning (Recommended)

Navigation: All > AI Agent Studio > Testing > Test AI reasoning tab

1. Select the agent to test
2. Enter test input/utterance
3. Review tool selection, inputs, and outputs step by step
4. Verify reasoning matches expectations

### Automated Evaluation

Navigation: All > Now Assist Skill Kit > Agentic Evaluations

See the `servicenow-ai-evaluation` skill for detailed setup.

---

## Debugging Reasoning

The reasoning trace is **records + MCP, not a dedicated UI feature**. Because the loop is
platform-run, you inspect what the agent thought and did through execution records:

- **`sn_aia_execution_plan`** — one record per agent run (state, run type, lifecycle).
- **`sn_aia_execution_task`** — the per-step trace under a plan, including the literal **`"Thought"`**
  key. A vague or low-quality `"Thought"` step is an *instruction* problem — fix it in the agent's
  instruction text, not in loop code. For how to elicit better reasoning, see **agent-prompt-writer
  Step 3g (Reasoning Elicitation)**.
- **MCP `servicenow_aia_trace`** — pulls the structured reasoning/trace for a run. Pair with
  `servicenow_aia_logs` and `servicenow_aia_errors` for failures, and `servicenow_aia_execute` to
  re-run against the live LLM.

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Tool hangs indefinitely | Used `gs.*` or `GlideDateTime` | Replace with native JS |
| Agent skips tool inputs | Missing `mandatory: true` | Add to input schema |
| Tool returns null | Output not in return statement | Ensure `return outputs;` |
| "Processing..." forever | Glide API hang | Check for forbidden APIs |
| "Cannot find agent" | Wrong agentId | Verify sys_id |
| ACL violation errors | Used `GlideRecord` on Zurich | Switch to `GlideRecordSecure` |

---

## Validation Checklist

Before declaring a workflow complete:

- [ ] Tool script uses native JS only (no gs.*, no GlideDateTime)
- [ ] Tool script includes try-catch error handling
- [ ] Input schema has `mandatory: true` for required fields
- [ ] GlideRecord queries use `setLimit()` for performance
- [ ] Script tools use `GlideRecordSecure` + `addUserEncodedQuery()` (Zurich+)
- [ ] Tool `internal_name` uses snake_case
- [ ] Tool count per agent is 20 or fewer
- [ ] Execution mode set correctly (supervised for writes, autonomous for reads)
- [ ] Programmatic execution sets `canInteractWithUser: false`
- [ ] Test execution completes in < 3 seconds

---

## Performance Targets

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Simple tool | < 100ms | < 500ms |
| GlideRecord query | < 200ms | < 1s |
| Agent with 1 tool | < 500ms | < 2s |
| Agent with 3 tools | < 2s | < 5s |
| Full workflow | < 5s | < 10s |

---

## Security Best Practices

1. Never hardcode credentials in tool scripts
2. Validate all inputs before database operations
3. Use `setLimit()` to prevent unbounded queries
4. Respect ACLs via `GlideRecordSecure`
5. Sanitize user inputs to prevent injection
6. Use HTTPS for external API calls

---

*Runtime patterns validated against ServiceNow Zurich. For agent creation, see `.claude/context/sdk-examples/ai-agent.now.ts`.*
