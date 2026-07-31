---
name: iterative-test-fix
description: "The QA loop: execute agent via MCP, check results, trace failures, identify root cause, categorize the fix type, apply or dispatch the fix, and re-test until everything passes."
scope: project
recommended: false
version: 1.0.0
---
# Skill: Iterative Test-Fix

> The QA loop: execute agent via MCP, check results, trace failures, identify root cause, categorize the fix type, apply or dispatch the fix, and re-test until everything passes.

> **Runtime tooling:** The `servicenow_*` tool names in this document are the Foundry MCP server's runtime tools. Treat them as capabilities — "execute an agent", "read an execution trace", "query a table" — and map them to the equivalents of whatever MCP server is connected. With no MCP server, fall back to manual verification: test in the Now Assist panel / AI Agent Studio and read execution traces from `sn_aia_execution_plan` / `sn_aia_execution_task`; query data via list views or a user-run background script.

---

## Overview

This skill defines the systematic test-diagnose-fix loop for ServiceNow AI agents and skills. Instead of ad-hoc debugging, it follows a structured process:

1. **Execute** — Run the agent with test inputs
2. **Check** — Compare output against expected results
3. **Trace** — If failure, examine execution steps
4. **Diagnose** — Categorize the root cause
5. **Fix** — Apply the fix or dispatch to the right specialist
6. **Re-test** — Verify the fix works

Repeat until all tests pass.

## When to Use

Use this skill when:
- Testing a newly built agent or skill
- An agent is producing incorrect results
- You need to validate an agent works end-to-end
- A fix has been applied and you need to verify it

## Prerequisites

**Context files to reference:**
- `iterative-development-workflow.md` — The development loop
- `tool-script-rules.md` — Common script failures
- `troubleshooting-guide.md` — Debugging patterns
- `now-assist-guardian-governance.md` — Guardian block diagnosis

**MCP Tools required:**
- `servicenow_aia_execute` — Run agents
- `servicenow_aia_trace` — Trace execution steps
- `servicenow_aia_errors` — Get error logs
- `servicenow_skill_execute` — Run skills
- `servicenow_syslogs` — System logs
- `servicenow_aia_logs` — AIA framework logs
- `servicenow_query` — Check data/records

---

## Instructions

### Step 1: Prepare Test Cases (REQUIRED — DO NOT SKIP)

Before running any tests, define what you're testing:

| # | Test Case Field | Description |
|---|----------------|-------------|
| 1 | **Component** | Agent name, tool name, or skill name |
| 2 | **Test input** | Exact input to send |
| 3 | **Expected behavior** | What tools should be used, in what order |
| 4 | **Expected output** | What the response should contain |
| 5 | **Pass criteria** | Specific, checkable conditions |

#### Minimum Test Cases Per Agent

| Test Type | Purpose | Required? |
|-----------|---------|-----------|
| **Happy path** | Normal request with clear inputs | Yes |
| **Edge case** | Ambiguous or minimal input | Yes |
| **Error case** | Invalid input or missing data | Yes |
| **Guardrail test** | Request that should be refused | If agent has NEVER rules |
| **Tool failure** | Simulated tool error | If agent has fallback logic |

### Step 2: Execute the Test

Run the agent with test inputs:

```
MCP call: servicenow_aia_execute
  agent_id: "<agent_sys_id>"
  objective: "<test input / user message>"
  input: {<structured inputs if needed>}
```

For skills:
```
MCP call: servicenow_skill_execute
  skill_id: "<skill_sys_id>"
  input: {<skill inputs>}
```

**Record the execution_id** from the response — you'll need it for tracing.

### Step 3: Check Results

Compare the execution output against your expected results:

| Check | Question | Pass/Fail |
|-------|----------|-----------|
| **Status** | Did the execution complete (not fail/timeout)? | |
| **Tools used** | Did it use the expected tools? | |
| **Tool order** | Did it use tools in the expected sequence? | |
| **Output format** | Does the response match the expected format? | |
| **Output content** | Is the content correct and complete? | |
| **Rules followed** | Did the agent respect all constraints? | |
| **Work notes** | Were work notes populated (if applicable)? | |

**If ALL checks pass:** Move to the next test case. If all test cases pass, the component is verified.

**If ANY check fails:** Continue to Step 4.

### Step 4: Trace the Execution

Get detailed execution steps:

```
MCP call: servicenow_aia_trace
  execution_id: "<execution_id from step 2>"
```

For each step in the trace, analyze:

| Step Aspect | What to Check |
|-------------|--------------|
| **Thought** | Did the agent reason correctly about what to do? |
| **Tool selection** | Did it pick the right tool for this step? |
| **Tool input** | Did it construct the correct input parameters? |
| **Tool output** | Did the tool return expected data? |
| **Next thought** | Did it correctly interpret the tool's output? |

**If the trace shows a tool error**, also check:

```
MCP call: servicenow_aia_errors
  agent_id: "<agent_sys_id>"
  time_window: "1h"
```

```
MCP call: servicenow_syslogs
  query: "source=sn_aia"
  time_window: "1h"
```

### Step 5: Diagnose Root Cause

Categorize the failure into one of these root cause types:

#### Root Cause Categories

| Category | Symptoms | Diagnostic Evidence |
|----------|----------|-------------------|
| **SCRIPT_ERROR** | Tool returns error or hangs | Error in aia_errors; forbidden API in script |
| **ACL_ERROR** | Tool returns empty results or "access denied" | GlideRecord returns data but GlideRecordSecure doesn't |
| **PROMPT_ERROR** | Agent uses wrong tool, wrong sequence, or wrong format | Trace shows incorrect reasoning |
| **SCHEMA_ERROR** | Agent sends wrong/missing inputs to tool | Tool receives null for mandatory field |
| **GUARDIAN_BLOCK** | Response is filtered or generic | Guardian log entry in syslogs |
| **DESIGN_ERROR** | Agent can't complete task within iteration limit | Agent hits max iterations or loops |
| **DATA_ERROR** | Test data doesn't exist or doesn't match expectations | Query on target table returns unexpected results |

#### Diagnostic Decision Tree

```
Did the execution complete?
├── No, it timed out
│   └── Check for forbidden API → SCRIPT_ERROR
│       Check agent iteration count → DESIGN_ERROR (too complex)
├── No, it errored
│   └── Check error message
│       ├── Script error → SCRIPT_ERROR
│       ├── ACL/permission error → ACL_ERROR
│       └── Guardian filter → GUARDIAN_BLOCK
└── Yes, but output is wrong
    └── Check trace
        ├── Wrong tool used → PROMPT_ERROR (tool descriptions)
        ├── Right tool, wrong input → SCHEMA_ERROR
        ├── Right tool, empty results → ACL_ERROR or DATA_ERROR
        ├── Right tool, right results, wrong interpretation → PROMPT_ERROR (instructions)
        └── Response format wrong → PROMPT_ERROR (output format)
```

### Step 6: Apply or Dispatch the Fix

Based on the root cause category, either fix it directly or dispatch to the right specialist:

| Root Cause | Fix Owner | Fix Action |
|-----------|-----------|------------|
| **SCRIPT_ERROR** | Tool Builder | Fix forbidden API usage, fix runtime error |
| **ACL_ERROR** | Instance Admin | Grant roles, update ACLs |
| **PROMPT_ERROR** | Agent Configurator | Revise agent instructions |
| **SCHEMA_ERROR** | Tool Builder | Fix input schema (add mandatory, fix types) |
| **GUARDIAN_BLOCK** | Agent Configurator | Rephrase content to avoid safety filter |
| **DESIGN_ERROR** | Solution Architect | Restructure agent (split into multiple) |
| **DATA_ERROR** | Tester | Fix test data or adjust test expectations |

#### Fix Report Format

```
## Fix Report

**Test case:** [which test case failed]
**Root cause category:** [SCRIPT_ERROR | ACL_ERROR | PROMPT_ERROR | ...]
**Root cause detail:** [Specific description of what went wrong]
**Fix applied:** [What was changed]
**Fix owner:** [Who made the change]
**Ready for re-test:** [Yes/No]
```

### Step 7: Re-Test

After the fix is applied, return to **Step 2** and re-run the SAME test case.

**Re-test rules:**
- Run the exact same test input as before
- Apply the same checks from Step 3
- If the fix introduced a new failure, diagnose the new failure (don't assume it's the same issue)
- After the previously-failing test passes, also re-run ALL other test cases to check for regressions

### Step 8: Generate Test Report

After all test cases pass, generate the final report:

```
## Test Report: [Component Name]

**Component:** [agent/skill name]
**sys_id:** [sys_id]
**Tested by:** [who]
**Date:** [when]

### Test Results

| # | Test Case | Input | Expected | Actual | Status |
|---|-----------|-------|----------|--------|--------|
| 1 | Happy path | [input] | [expected] | [actual] | PASS |
| 2 | Edge case | [input] | [expected] | [actual] | PASS |
| 3 | Error case | [input] | [expected] | [actual] | PASS |

### Issues Found and Resolved

| # | Issue | Root Cause | Fix Applied | Iterations to Fix |
|---|-------|-----------|-------------|-------------------|
| 1 | [issue] | [category] | [fix] | [count] |

### Overall Status: [PASS / FAIL]

### Notes
- [Any observations, recommendations, or known limitations]
```

---

## Validation Checklist

Before declaring a component "tested and passing":

- [ ] At least 3 test cases were executed (happy path, edge case, error case)
- [ ] All test cases pass with the current deployed version
- [ ] Any failures were traced, diagnosed, and fixed
- [ ] Regression testing was performed after each fix
- [ ] Test report is complete with all results documented

## Common Testing Mistakes

| Mistake | Consequence | Prevention |
|---------|------------|------------|
| Testing with only happy path | Edge cases fail in production | Always include edge case and error tests |
| Not re-testing after fix | Fix breaks something else | Always re-run ALL tests after any change |
| Declaring pass without checking output content | Agent returns wrong data | Check output content, not just "no error" |
| Testing once and stopping | Intermittent issues missed | Run each test at least twice |
| Not recording test results | Can't prove the agent works | Always generate the test report |

## Tips

- **Budget 3-7 iterations per agent.** First-time agents rarely work on the first try.
- **Fix one thing at a time.** If you change instructions AND script AND schema at once, you can't tell which fix worked.
- **Read the trace carefully.** The agent's reasoning steps tell you exactly where it went wrong.
- **Check ACLs early.** Empty results are almost always ACL issues — diagnose this before blaming the script.
- **Keep test data stable.** If your test relies on INC0010001 existing, make sure nobody deletes it.

---

*Skill designed for systematic testing of ServiceNow AI agents built via MCP. Test loop validated against Zurich AI Agent framework on gpinst01.*
