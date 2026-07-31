# Iterative Development Workflow — MCP-Powered AI Agent Development

> The complete development loop for building ServiceNow AI agents using MCP tools: write → deploy → test → trace → diagnose → fix → redeploy. Includes which MCP tools to use at each step and common failure patterns.

> **Runtime tooling:** The `servicenow_*` tool names in this document are the Foundry MCP server's runtime tools. Treat them as capabilities — "execute an agent", "read an execution trace", "query a table" — and map them to the equivalents of whatever MCP server is connected. With no MCP server, fall back to manual verification: test in the Now Assist panel / AI Agent Studio and read execution traces from `sn_aia_execution_plan` / `sn_aia_execution_task`; query data via list views or a user-run background script.

---

## Overview

Building AI agents on ServiceNow is an iterative process. You write a tool script, deploy it to the instance, test the agent, diagnose failures, fix issues, and redeploy. This document formalizes that loop and maps each step to the MCP tools that power it.

The key insight: **never declare an agent "done" until you've run it and verified the output**. The gap between "should work" and "does work" is where most bugs hide.

---

## The Development Loop

```
┌──────────────────────────────────────────────────────────────┐
│                  AI Agent Development Loop                    │
│                                                              │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│   │  WRITE   │───▶│  DEPLOY  │───▶│   TEST   │              │
│   │  locally  │    │ to inst. │    │ execute  │              │
│   └──────────┘    └──────────┘    └──────────┘              │
│        ▲                               │                     │
│        │                               ▼                     │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│   │   FIX    │◀───│ DIAGNOSE │◀───│  TRACE   │              │
│   │  issue   │    │root cause│    │ execution│              │
│   └──────────┘    └──────────┘    └──────────┘              │
│                                                              │
│   Repeat until: All tests pass AND output quality is good   │
└──────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step with MCP Tools

### Step 1: WRITE — Create the Agent Components Locally

Before touching the instance, design your agent locally:

1. **Define the agent specification:**
   - Name, description, strategy (ReAct/Planner/CoPilot/AutoPilot)
   - Instructions text (use templates from `agent-instruction-templates.md`)
   - Tool list with input/output schemas
   - Trigger type (record/scheduled/chat/API)

2. **Write tool scripts:**
   - Follow patterns from `tool-script-cookbook.md`
   - Follow rules from `tool-script-rules.md`
   - Every script must use GlideRecordSecure + addUserEncodedQuery()

3. **Prepare test cases:**
   - Happy path inputs
   - Edge case inputs
   - Expected outputs for each

**No MCP tools needed at this step** — this is local design work.

### Step 2: DEPLOY — Push to Instance

Use MCP tools to create the agent and tools on the ServiceNow instance.

| What to Deploy | MCP Tool | Key Parameters |
|----------------|----------|----------------|
| AI Agent | `servicenow_aia_create` | type: "agent", name, description, strategy, instructions |
| Script Tool | `servicenow_aia_create` | type: "tool", name, script, input_schema, output_schema |
| Now Assist Skill | `servicenow_skill_create` | name, prompt_template, input_schema |

**Deployment order matters:**
1. Create tools FIRST (they need to exist before attaching to agents)
2. Create the agent with tool references
3. Create triggers if needed

#### Dry-Run Pattern

Always deploy with `dry_run: true` first to validate:

```
MCP call: servicenow_aia_create
  type: "tool"
  name: "get_incident_details"
  dry_run: true
  script: "(function(inputs) { ... })(inputs);"
  input_schema: [...]
```

If dry-run succeeds, repeat without `dry_run` to actually create.

### Step 3: TEST — Execute the Agent

Run the agent with test inputs to see if it works.

| Test Type | MCP Tool | Parameters |
|-----------|----------|------------|
| Agent execution | `servicenow_aia_execute` | agent_id, input, objective |
| Script-only test | `servicenow_script` | script (read-only test) |
| Skill execution | `servicenow_skill_execute` | skill_id, input |

#### Test Pattern

```
MCP call: servicenow_aia_execute
  agent_id: "<sys_id from deploy step>"
  objective: "Triage incident INC0010042"
  input: {"incident_number": "INC0010042"}
```

**What to check in the response:**
- Did the agent use the expected tools?
- Did it use them in the expected order?
- Is the output format correct?
- Is the content of the output correct?
- Did it follow the rules in the instructions?

### Step 4: TRACE — Examine Execution Details

If the test reveals issues, trace the execution to understand what happened.

| What to Trace | MCP Tool | What It Shows |
|---------------|----------|---------------|
| Execution steps | `servicenow_aia_trace` | Each step the agent took: thought, tool call, result |
| Error logs | `servicenow_aia_errors` | Script errors, tool failures, timeouts |
| System logs | `servicenow_syslogs` | Platform-level errors |
| AIA logs | `servicenow_aia_logs` | Agent framework logs |

#### Trace Analysis Pattern

```
MCP call: servicenow_aia_trace
  execution_id: "<sys_id from test step>"
```

For each step in the trace, check:
1. **Thought**: Did the agent reason correctly?
2. **Tool selection**: Did it pick the right tool?
3. **Tool input**: Did it construct the input correctly?
4. **Tool output**: Did the tool return expected results?
5. **Next thought**: Did it interpret the tool output correctly?

### Step 5: DIAGNOSE — Identify Root Cause

Map the trace finding to a root cause category:

| Symptom | Root Cause Category | Fix Location |
|---------|-------------------|--------------|
| Agent doesn't use any tools | **Prompt issue** — instructions don't mention tools | Agent instructions |
| Agent uses wrong tool | **Prompt issue** — tool descriptions overlap | Tool descriptions |
| Tool returns empty results | **ACL issue** — user can't access the data | Role/ACL config |
| Tool hangs (no response) | **Script issue** — using forbidden API | Tool script |
| Tool returns error | **Script issue** — runtime error in script | Tool script |
| Agent output is wrong format | **Prompt issue** — no output format specified | Agent instructions |
| Agent ignores a rule | **Prompt issue** — rule is buried or ambiguous | Agent instructions |
| Tool input is missing fields | **Schema issue** — mandatory not set | Input schema |
| Agent loops on same tool | **Prompt issue** — no progress detection | Agent instructions |
| Response blocked/filtered | **Guardian block** — safety filter triggered | Content or Guardian config |
| Agent reaches max iterations | **Design issue** — agent is doing too much | Split into multiple agents |

### Step 6: FIX — Apply the Correction

Based on the diagnosis, fix the specific component:

| Root Cause | What to Fix | How to Redeploy |
|-----------|-------------|-----------------|
| **Script error** | Edit the tool script | `servicenow_aia_create` (update existing) |
| **ACL issue** | Update roles/ACLs on instance | Manual or `servicenow_script` |
| **Prompt issue** | Revise agent instructions | `servicenow_aia_create` (update agent) |
| **Schema issue** | Fix input/output schema | `servicenow_aia_create` (update tool) |
| **Guardian block** | Adjust content or check Guardian rules | Content revision |
| **Design issue** | Restructure agent/tool architecture | Back to Step 1 |

Then return to **Step 3: TEST** and repeat.

---

## Common Failure Patterns

### Pattern 1: Silent Hang

**Symptom:** Tool execution never returns.

**Cause:** Using a forbidden API (`gs.log()`, `GlideDateTime`, `gs.getUserName()`, etc.).

**Diagnosis:**
```
MCP call: servicenow_aia_errors
  agent_id: "<agent_sys_id>"
  time_window: "1h"
```

**Fix:** Replace forbidden APIs with allowed alternatives. See `tool-script-rules.md` Rule 1.

### Pattern 2: Empty Results

**Symptom:** Query returns 0 records even though records exist.

**Cause 1:** `addUserEncodedQuery()` filtering out records the executing user can't access.
**Cause 2:** Missing or incorrect query filter.

**Diagnosis:**
```
MCP call: servicenow_script
  script: "var gr = new GlideRecord('incident'); gr.addQuery('number', 'INC0010001'); gr.query(); gs.info('Count: ' + gr.getRowCount());"
```

Compare GlideRecord (unfiltered) vs GlideRecordSecure (filtered) counts to isolate ACL issues.

**Fix:** Grant necessary roles to the executing user, or adjust the agent's role configuration.

### Pattern 3: Wrong Tool Selected

**Symptom:** Agent uses `search_knowledge` when it should use `get_incident_details`.

**Cause:** Tool descriptions are too similar or agent instructions don't specify when to use each tool.

**Fix:** Make tool descriptions mutually exclusive. Add "Use this when..." and "Do NOT use this for..." to each tool description.

### Pattern 4: Agent Loops

**Symptom:** Agent calls the same tool 25 times in a row (hits the consecutive tool limit) and stops.

**Cause:** Agent doesn't recognize that the tool response means "no more results" or "already done."

**Fix:** Add to instructions: "If [tool_name] returns the same result as the previous call, do not call it again. Move to the next step."

### Pattern 5: Schema Mismatch

**Symptom:** Tool receives `null` for a required input.

**Cause:** Input schema doesn't have `mandatory: true`, so the agent skips collecting that input.

**Fix:** Add `mandatory: true` to all required inputs in the tool's input schema.

### Pattern 6: Guardian Blocks

**Symptom:** Agent response is filtered or replaced with a generic message.

**Cause:** Now Assist Guardian detected content in one of 16 safety categories.

**Diagnosis:**
```
MCP call: servicenow_syslogs
  query: "source=now_assist_guardian"
  time_window: "1h"
```

**Fix:** Adjust the prompt to avoid triggering the safety filter (e.g., rephrase content, avoid sensitive terms in examples). See `now-assist-guardian-governance.md`.

---

## MCP Tool Quick Reference

### Discovery Tools (Read-Only)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `servicenow_query` | Query any ServiceNow table | Check what exists on the instance |
| `servicenow_instance` | Get instance info | Verify connection and version |
| `servicenow_aia_list` | List existing agents | Check for naming conflicts |
| `servicenow_aia_get` | Get agent details | Review existing agent config |
| `servicenow_skill_list` | List existing skills | Check for naming conflicts |

### Build Tools (Write)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `servicenow_aia_create` | Create agent, tool, or workflow | Deploying new components |
| `servicenow_skill_create` | Create a Now Assist skill | Deploying skills |

### Test Tools (Execute)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `servicenow_aia_execute` | Run an agent | Testing agent end-to-end |
| `servicenow_skill_execute` | Run a skill | Testing skill in isolation |
| `servicenow_script` | Run arbitrary script | Testing script logic safely |

### Debug Tools (Diagnose)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `servicenow_aia_trace` | Trace agent execution steps | Understanding agent behavior |
| `servicenow_aia_errors` | Get agent error logs | Finding script/tool failures |
| `servicenow_aia_logs` | Get AIA framework logs | Platform-level debugging |
| `servicenow_syslogs` | Get system logs | Broad debugging |

---

## Workflow Example: Building an Incident Triage Agent

### Iteration 1: Initial Deploy

1. Write triage agent instructions (ReAct strategy)
2. Write `get_incident_details` tool script
3. Write `update_incident` tool script
4. Deploy tools via `servicenow_aia_create`
5. Deploy agent via `servicenow_aia_create`
6. Test via `servicenow_aia_execute` with INC0010001
7. **Result:** Agent doesn't use tools → Trace shows instructions don't mention tool names

### Iteration 2: Fix Prompt

1. Revise instructions to explicitly reference tool names
2. Redeploy agent
3. Re-test
4. **Result:** Agent uses tools but sets wrong priority → Trace shows no priority logic in instructions

### Iteration 3: Add Priority Logic

1. Add priority matrix to instructions
2. Redeploy agent
3. Re-test
4. **Result:** Tool returns empty results → Diagnose as ACL issue

### Iteration 4: Fix ACLs

1. Check user roles via `servicenow_script`
2. Grant `itil` role to test user
3. Re-test
4. **Result:** Agent works correctly, correct priority, correct assignment

### Iteration 5: Edge Cases

1. Test with vague description ("things are slow")
2. **Result:** Agent creates incident without asking questions → Add clarification rule
3. Redeploy and re-test
4. **Result:** Agent asks clarifying question — pass

**Total iterations: 5.** This is normal. Budget 3-7 iterations for a new agent.

---

## Development Checklist

### Before First Deploy
- [ ] Agent instructions follow template from `agent-instruction-templates.md`
- [ ] All tool scripts pass the checklist from `tool-script-cookbook.md`
- [ ] Test cases prepared (happy path + edge cases)
- [ ] Dry-run deployment succeeds

### After Each Test
- [ ] Checked agent output against expected result
- [ ] If failure: traced execution and identified root cause category
- [ ] Fix applied to the correct component (script, instructions, schema, or ACLs)
- [ ] Retested after fix

### Before Declaring Done
- [ ] All happy path tests pass
- [ ] All edge case tests pass
- [ ] Agent handles tool failures gracefully
- [ ] Agent respects all rules in instructions
- [ ] Output format is consistent across test cases
- [ ] Work notes are populated (for triage/update agents)

---

## Related Resources

- [Tool Script Cookbook](./tool-script-cookbook.md) — Script patterns to use at Step 1
- [Tool Script Rules](./tool-script-rules.md) — Mandatory rules for tool scripts
- [Agent Instruction Templates](./agent-instruction-templates.md) — Instruction templates for Step 1
- [Prompt Engineering Patterns](./prompt-engineering-patterns.md) — Prompt debugging at Step 5
- [Troubleshooting Guide](./troubleshooting-guide.md) — Debugging patterns for Step 4

---

*Workflow validated against ServiceNow Zurich using the foundry-mcp MCP server. Failure patterns documented from real debugging sessions on gpinst01.*
