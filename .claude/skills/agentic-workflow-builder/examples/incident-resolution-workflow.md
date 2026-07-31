# Example: Incident Resolution Agentic Workflow

> Complete example of an agentic workflow that automatically triages and resolves P3+ incidents.

---

## Architecture

```
Agentic Workflow: Auto Incident Resolution
    └── Orchestrator: Incident Resolution Orchestrator
            ├── Child: Triage Agent
            │       ├── Tool: get_incident (script)
            │       └── Tool: search_similar_incidents (search retrieval)
            ├── Child: Resolution Agent
            │       ├── Tool: search_knowledge (knowledge graph)
            │       ├── Tool: update_incident (script)
            │       └── Tool: add_work_notes (script)
            └── Child: Escalation Agent
                    └── Tool: escalate_incident (script)
```

## Orchestrator Instructions

```
You are an incident resolution orchestrator. Your goal is to resolve
P3 and P4 incidents automatically.

Step 1: Use the Triage Agent to analyze the incident and find similar past incidents
Step 2: Based on triage results:
   - If similar resolved incidents found with >80% confidence: use Resolution Agent
   - If no similar incidents or low confidence: use Escalation Agent
Step 3: After Resolution Agent acts, verify the incident state was updated
Step 4: If resolution failed after 2 attempts, use Escalation Agent

Always provide a summary of what was done in the final response.
```

## Triage Agent

**Instructions:**
```
You triage incidents to determine the best resolution path.

Step 1: Use get_incident to retrieve full incident details
Step 2: Use search_similar_incidents to find past incidents with similar symptoms
Step 3: Return your analysis:
   - Category assessment
   - Similar incidents found (with resolution notes)
   - Confidence level (high/medium/low)
   - Recommended action (resolve/escalate)
```

**get_incident tool (script):**
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
            outputs.incident = {
                sys_id: gr.getValue('sys_id'),
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                description: gr.getValue('description'),
                category: gr.getDisplayValue('category'),
                subcategory: gr.getDisplayValue('subcategory'),
                priority: gr.getDisplayValue('priority'),
                state: gr.getDisplayValue('state'),
                assigned_to: gr.getDisplayValue('assigned_to'),
                assignment_group: gr.getDisplayValue('assignment_group')
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

## Resolution Agent

**Instructions:**
```
You resolve incidents using knowledge base articles and past resolutions.

Step 1: Use search_knowledge to find relevant KB articles
Step 2: Determine the best resolution based on KB content and similar incidents
Step 3: Use add_work_notes to document your findings
Step 4: Use update_incident to set state to "Resolved" with resolution notes
```

**update_incident tool (script):**
```javascript
(function(inputs) {
    var outputs = {};
    try {
        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('sys_id', String(inputs.sys_id || ''));
        gr.setLimit(1);
        gr.query();
        if (gr.next()) {
            if (inputs.state) gr.setValue('state', inputs.state);
            if (inputs.resolution_notes) gr.setValue('close_notes', inputs.resolution_notes);
            if (inputs.resolution_code) gr.setValue('close_code', inputs.resolution_code);
            gr.update();
            outputs.status = 'success';
            outputs.updated_number = gr.getValue('number');
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

## Trigger Configuration

**Record trigger:**
- Table: `incident`
- Conditions: `priority IN 3,4 AND state=1 AND assignment_group={your_group_sys_id}`
- When: Insert

**API trigger (for testing):**
```javascript
var runtime = new sn_aia.AiAgentRuntimeUtil();
var resp = runtime.startAiAgentConversation({
    targetRecordId: 'incident_sys_id_here',
    targetTable: 'incident',
    usecaseId: 'workflow_sys_id_here',
    objective: 'Triage and resolve this incident',
    conversationUser: 'admin',
    canInteractWithUser: false
});
gs.info('Result: ' + JSON.stringify(resp));
```

## Expected Behavior

1. New P3/P4 incident created → trigger fires
2. Orchestrator sends to Triage Agent
3. Triage Agent retrieves incident, searches for similar past incidents
4. If high confidence match found → Resolution Agent takes over
5. Resolution Agent searches KB, updates work notes, resolves incident
6. If low confidence → Escalation Agent reassigns to specialist group

---

*Example validated against ServiceNow Zurich patterns.*
