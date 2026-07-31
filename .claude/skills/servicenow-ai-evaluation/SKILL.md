---
name: servicenow-ai-evaluation
description: Step-by-step guide for evaluating AI agents and agentic workflows using ServiceNow's built-in evaluation framework.
scope: project
recommended: false
version: 1.0.0
---
# Skill: ServiceNow AI Evaluation

> Step-by-step guide for evaluating AI agents and agentic workflows using ServiceNow's built-in evaluation framework.

---

## Purpose

This skill guides you through setting up and running evaluations for AI agents and agentic workflows to measure performance, identify issues, and determine deployment readiness.

## When to Use

Use this skill when you need to:
- Evaluate an AI agent or agentic workflow before deployment
- Set up automated evaluation datasets
- Create custom evaluation metrics
- Interpret evaluation results and thresholds

## Prerequisites

1. ServiceNow Zurich instance
2. `sn_aia.admin` role
3. AI Agent Studio and Skill Kit installed
4. An existing AI agent or agentic workflow to evaluate

---

## Instructions

### Step 1: Navigate to Evaluations

Navigation: All > Now Assist Skill Kit > Agentic Evaluations

Or: All > AI Agent Studio > Testing > Start automated evaluation

### Step 2: Create Evaluation

The guided setup has 4 steps:

#### 2a. General Info
- **Name**: Descriptive name (e.g., "Incident Triage v2 Evaluation")
- **Select**: AI agent or agentic workflow to evaluate

#### 2b. Select Metrics
- **Overall task completeness** (default, always included)
- Add custom metrics if needed (must be published first)

#### 2c. Choose Dataset

**Option A: Generate new execution logs**

| Field | Description |
|-------|-------------|
| Table | Source table (e.g., `incident`) |
| Max records | Maximum records to evaluate |
| Filters | Conditions to narrow records |
| Starting phrase | Utterance template, e.g., `Help me resolve {{incident.number}}` |
| Additional business context | Supplementary info for the LLM |

Use `{{table.field}}` syntax for dynamic values in starting phrases.

**Option B: Use existing execution logs**

| Field | Description |
|-------|-------------|
| Max records (optional) | Maximum records |
| Filters | Conditions on execution log records |

#### 2d. Review and Start
- Review configuration
- Click Start to begin evaluation
- Evaluations auto-save as drafts between steps

**IMPORTANT:** The user submitting the evaluation must pass ACLs of the AI agent/agentic workflow AND all child agents. Otherwise, logs report "user does not have access."

### Step 3: Interpret Results

#### Overall Task Completeness

| Range | Label | Recommendation |
|-------|-------|---------------|
| 90-100% | Excellent | Proceed with confidence |
| 70-89% | Good | Deploy with caution |
| 50-69% | Moderate | Investigate root causes |
| 0-49% | Poor | **Do not deploy** |

Thresholds are customizable via "Customize metric thresholds."

#### Per-Record Task Completeness

| Score | Label | Description |
|-------|-------|-------------|
| 3 | Successful | Main task fully completed, logical sequence, no critical errors |
| 2 | Partially successful | Partially completed, some unresolved subtasks |
| 1 | Unsuccessful | Not completed, critical subtasks abandoned or failed |

#### Tool Performance

| Score | Label | Description |
|-------|-------|-------------|
| 1 | True | Right tool chosen for the action |
| 0 | False | Wrong tool chosen |

#### Tool Calling

| Score | Label | Description |
|-------|-------|-------------|
| 1 | True | Input key completeness AND value correctness AND format correctness all true |
| 0 | False | Any sub-metric is false (AND aggregation) |

### Step 4: Create Custom Metrics (Optional)

Navigation: All > Now Assist Skill Kit > Agentic Evaluations > Evaluation metrics tab > Create metric

Custom metrics use scripts that access the Agentic Evaluation Parser Tool output:

```javascript
// Access parsed execution data in custom metric script
var parserToolOutput = context['AgenticExecutionParserTool.output'];
if (typeof parserToolOutput == 'string') {
    parserToolOutput = JSON.parse(parserToolOutput);
}
var payload = parserToolOutput.payload;

var inputs = payload.executionInputs;      // Workflow setup, agent/tool names
var outputs = payload.executionOutputs;    // Agent actions and tool results
var messages = payload.executionMessages;  // User-facing conversation flow
var planDetails = payload.executionPlanDetails;  // Execution metadata

// Your custom metric logic here
// Output must match the metric output template
```

**Parser Tool Output Structure:**

| Field | Contents |
|-------|---------|
| `executionInputs` | Workflow name, description, instructions, utterance, agents with tools |
| `executionOutputs` | Agent actions, tool inputs/outputs per agent |
| `executionMessages` | Array of `{role, message, order}` (role: "agent" or "user") |
| `executionPlanDetails` | State, runType (API/Chat/Evaluation/Testing/Trigger), conversationId, relatedTask |

**IMPORTANT:** Custom metrics must be **published** before they appear in evaluation guided setup.

### Step 5: When to Run Evaluations

- After manual testing of basic execution
- After significant changes to workflows/agents
- Before promoting to production
- Use multiple evaluation methods for comprehensive picture
- Use filters to target specific time frames or versions
- You can generate new execution logs as part of evaluation setup

---

## Gotchas

- Custom metrics must be published to appear in evaluation setup
- ACL requirements must be met by the submitting user across ALL agents in the workflow
- Tool calling metric uses AND aggregation — if any sub-metric is 0, the entire score is 0
- An "assist" is considered "small" tier until it exceeds 20 tool executions

---

*Validated against ServiceNow Zurich documentation.*
