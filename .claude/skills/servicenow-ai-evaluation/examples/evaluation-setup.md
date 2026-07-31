# Example: Evaluating an Incident Triage Agent

> Step-by-step walkthrough of setting up and interpreting an evaluation for an AI agent.

---

## Scenario

You have an "Incident Triage Agent" that classifies and prioritizes incidents. Before deploying to production, you want to evaluate its performance against real incident data.

## Setup

### 1. Create Evaluation

Navigation: All > Now Assist Skill Kit > Agentic Evaluations > New

| Field | Value |
|-------|-------|
| Name | Incident Triage Agent - February Evaluation |
| Type | AI Agent |
| Target | Incident Triage Agent |

### 2. Select Metrics

- [x] Overall task completeness (default)
- [x] Tool performance
- [x] Tool calling

### 3. Configure Dataset (New Execution Logs)

| Field | Value |
|-------|-------|
| Table | `incident` |
| Max records | 50 |
| Filter | `state=1^priority IN 3,4^sys_created_on>=javascript:gs.daysAgoStart(30)` |
| Starting phrase | `Triage and categorize incident {{incident.number}}` |
| Business context | "Focus on accurate category assignment and priority validation" |

### 4. Run and Wait

Click "Start evaluation." The system will:
1. Query 50 incidents matching your filter
2. For each: execute the agent with the starting phrase
3. Use a Now LLM Service model to judge each execution
4. Aggregate scores across all records

## Interpreting Results

### Overall Dashboard

```
Overall Task Completeness: 82% (Good)
├── Successful (score 3): 38/50 records (76%)
├── Partially successful (score 2): 9/50 records (18%)
└── Unsuccessful (score 1): 3/50 records (6%)

Tool Performance: 91% (Excellent)
└── Correct tool selection in 91% of cases

Tool Calling: 78% (Good)
├── Input key completeness: 95%
├── Input value correctness: 85%
└── Input format correctness: 88%
```

### Analysis

- **82% task completeness** → "Good" range (70-89%), deploy with caution
- **3 unsuccessful records** → Investigate these specific incidents for patterns
- **Tool calling at 78%** → Input value correctness (85%) is the weakest link
  - Agent is selecting right tools but sometimes passing incorrect values
  - Review the failing cases to identify common input errors

### Action Items

1. Review the 3 unsuccessful records — what made them fail?
2. Check the 9 partially successful records — what subtasks were missed?
3. Improve agent instructions to handle the failure patterns
4. Re-run evaluation after changes to measure improvement

## Custom Metric Example

**Metric: Category Accuracy**

Checks if the agent assigned the correct category compared to the eventual human-assigned category.

```javascript
// Custom metric script
var parserToolOutput = context['AgenticExecutionParserTool.output'];
if (typeof parserToolOutput == 'string') {
    parserToolOutput = JSON.parse(parserToolOutput);
}
var payload = parserToolOutput.payload;
var outputs = payload.executionOutputs;
var planDetails = payload.executionPlanDetails;

// Get the related incident
var incidentSysId = planDetails.relatedTask;
var gr = new GlideRecord('incident');
if (gr.get(incidentSysId)) {
    var humanCategory = gr.getValue('category');

    // Find what category the agent assigned
    var agentCategory = '';
    for (var i = 0; i < outputs.agents.length; i++) {
        var agent = outputs.agents[i];
        for (var j = 0; j < agent.tools.length; j++) {
            var tool = agent.tools[j];
            if (tool.name == 'update_incident' && tool.inputs.category) {
                agentCategory = tool.inputs.category;
                break;
            }
        }
    }

    // Score: 1 if match, 0 if mismatch
    output.score = (agentCategory == humanCategory) ? 1 : 0;
    output.details = 'Agent: ' + agentCategory + ', Human: ' + humanCategory;
}
```

Publish this metric, then include it in future evaluation runs.

---

*Example validated against ServiceNow Zurich evaluation framework.*
