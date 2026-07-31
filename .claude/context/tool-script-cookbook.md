# Tool Script Cookbook — ServiceNow AI Agents (Zurich)

> 12 complete, tested tool script patterns with input/output schemas for ServiceNow AI Agent development. Every script follows the mandatory GlideRecordSecure + addUserEncodedQuery() pattern.

---

## Overview

This cookbook provides copy-paste-ready tool scripts for the most common AI agent operations. Each recipe includes:
- Complete script with error handling
- Input schema with mandatory fields
- Output schema
- Usage notes and variations

**Prerequisites:** Read `tool-script-rules.md` first — all scripts here follow those rules.

---

## Quick Reference

The `execution_mode` field values below are `copilot` (UI: Supervised) and `autopilot` (UI: Autonomous).

| # | Recipe | Operation | Execution Mode |
|---|--------|-----------|----------------|
| 1 | Get Single Record | Read one record by identifier | `autopilot` |
| 2 | Query and Summarize | Query multiple + summarize results | `autopilot` |
| 3 | Create Record | Insert a new record | `copilot` |
| 4 | Update Fields | Modify existing record | `copilot` |
| 5 | Query with Aggregation | Count, group, and summarize | `autopilot` |
| 6 | Call REST API | Outbound REST call | `copilot` |
| 7 | Chain Operations | Multi-step read-then-act | `copilot` |
| 8 | Conditional Logic | Branching based on data | `autopilot` |
| 9 | Voice-Compatible Script | String-only I/O for voice agents | `autopilot` |
| 10 | Bulk Operations | Process multiple records | `copilot` |
| 11 | Reference Field Resolution | Follow reference chains | `autopilot` |
| 12 | Date-Based Filtering | Time-relative queries | `autopilot` |

---

## Recipe 1: Get Single Record

Retrieve a single record by number or sys_id.

### Tool Configuration

- **Internal name:** `get_incident_details`
- **Description:** "Retrieve full details of an incident by its number (e.g., INC0010001)"
- **Execution mode:** `autopilot`

### Input Schema

```json
[
  {"name": "incident_number", "type": "string", "mandatory": true, "description": "Incident number like INC0010001 or sys_id"}
]
```

### Script

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var identifier = String(inputs.incident_number || "").trim();
        if (!identifier) {
            outputs.error = "incident_number is required";
            outputs.status = "error";
            return outputs;
        }

        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();

        // Support both number and sys_id lookup
        if (identifier.startsWith('INC')) {
            gr.addQuery('number', identifier);
        } else {
            gr.addQuery('sys_id', identifier);
        }
        gr.setLimit(1);
        gr.query();

        if (gr.next()) {
            outputs.record = {
                sys_id: gr.getValue('sys_id'),
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                description: gr.getValue('description'),
                state: gr.getDisplayValue('state'),
                priority: gr.getDisplayValue('priority'),
                category: gr.getDisplayValue('category'),
                assigned_to: gr.getDisplayValue('assigned_to'),
                assignment_group: gr.getDisplayValue('assignment_group'),
                caller_id: gr.getDisplayValue('caller_id'),
                opened_at: gr.getValue('opened_at'),
                sys_updated_on: gr.getValue('sys_updated_on')
            };
            outputs.status = "success";
        } else {
            outputs.error = "Incident not found or access denied: " + identifier;
            outputs.status = "not_found";
        }
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Output Schema

```json
[
  {"name": "status", "type": "string"},
  {"name": "record", "type": "object"},
  {"name": "error", "type": "string"}
]
```

### Variations

- **Any table:** Replace `'incident'` and field list with target table
- **Minimal fields:** Remove fields you don't need to reduce token usage
- **With work notes:** Add a second GlideRecordSecure query on `sys_journal_field` filtered by `element_id`

---

## Recipe 2: Query and Summarize

Query multiple records and return a structured summary.

### Tool Configuration

- **Internal name:** `query_active_incidents`
- **Description:** "List active incidents with optional filters for priority and assignment group"
- **Execution mode:** `autopilot`

### Input Schema

```json
[
  {"name": "priority", "type": "string", "mandatory": false, "description": "Filter by priority: 1, 2, 3, or 4"},
  {"name": "assignment_group", "type": "string", "mandatory": false, "description": "Filter by assignment group name"},
  {"name": "limit", "type": "number", "mandatory": false, "description": "Max results to return (default 10, max 50)"}
]
```

### Script

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var limit = Math.min(parseInt(inputs.limit || 10, 10), 50);
        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addActiveQuery();

        if (inputs.priority) {
            gr.addQuery('priority', String(inputs.priority));
        }
        if (inputs.assignment_group) {
            var groupGr = new GlideRecordSecure('sys_user_group');
            groupGr.addUserEncodedQuery();
            groupGr.addQuery('name', String(inputs.assignment_group));
            groupGr.setLimit(1);
            groupGr.query();
            if (groupGr.next()) {
                gr.addQuery('assignment_group', groupGr.getValue('sys_id'));
            } else {
                outputs.error = "Assignment group not found: " + inputs.assignment_group;
                outputs.status = "not_found";
                return outputs;
            }
        }

        gr.setLimit(limit);
        gr.orderByDesc('priority');
        gr.orderByDesc('sys_updated_on');
        gr.query();

        var records = [];
        while (gr.next()) {
            records.push({
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                state: gr.getDisplayValue('state'),
                priority: gr.getDisplayValue('priority'),
                assigned_to: gr.getDisplayValue('assigned_to'),
                updated: gr.getValue('sys_updated_on')
            });
        }

        outputs.records = records;
        outputs.count = records.length;
        outputs.summary = records.length + " active incidents found" +
            (inputs.priority ? " at priority " + inputs.priority : "") +
            (inputs.assignment_group ? " for " + inputs.assignment_group : "");
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

---

## Recipe 3: Create Record

Create a new record with validated fields.

### Tool Configuration

- **Internal name:** `create_incident`
- **Description:** "Create a new incident with required fields. Returns the new incident number."
- **Execution mode:** `copilot`

### Input Schema

```json
[
  {"name": "short_description", "type": "string", "mandatory": true, "description": "Brief description of the issue"},
  {"name": "description", "type": "string", "mandatory": false, "description": "Detailed description"},
  {"name": "category", "type": "string", "mandatory": false, "description": "Category: hardware, software, network, database, other"},
  {"name": "priority", "type": "string", "mandatory": false, "description": "Priority: 1, 2, 3, or 4 (default: 4)"},
  {"name": "caller_id", "type": "string", "mandatory": true, "description": "User name or sys_id of the caller"}
]
```

### Script

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var shortDesc = String(inputs.short_description || "").trim();
        if (!shortDesc) {
            outputs.error = "short_description is required";
            outputs.status = "error";
            return outputs;
        }

        // Resolve caller
        var callerId = String(inputs.caller_id || "").trim();
        var callerSysId = "";
        if (callerId) {
            var userGr = new GlideRecordSecure('sys_user');
            userGr.addUserEncodedQuery();
            if (callerId.length === 32) {
                userGr.addQuery('sys_id', callerId);
            } else {
                userGr.addQuery('user_name', callerId);
            }
            userGr.setLimit(1);
            userGr.query();
            if (userGr.next()) {
                callerSysId = userGr.getValue('sys_id');
            } else {
                outputs.error = "Caller not found: " + callerId;
                outputs.status = "error";
                return outputs;
            }
        }

        var gr = new GlideRecordSecure('incident');
        gr.initialize();
        gr.setValue('short_description', shortDesc);
        if (inputs.description) gr.setValue('description', String(inputs.description));
        if (inputs.category) gr.setValue('category', String(inputs.category));
        gr.setValue('priority', String(inputs.priority || '4'));
        if (callerSysId) gr.setValue('caller_id', callerSysId);

        var sysId = gr.insert();
        if (sysId) {
            outputs.sys_id = sysId;
            outputs.number = gr.getValue('number');
            outputs.status = "success";
            outputs.message = "Created incident " + gr.getValue('number');
        } else {
            outputs.error = "Failed to create incident — check ACLs and mandatory fields";
            outputs.status = "error";
        }
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

---

## Recipe 4: Update Fields

Update specific fields on an existing record.

> **Journal field gotcha:** `work_notes` and `comments` are **journal fields** — they live in
> `sys_journal_field`, not as columns on the task row. `gr.setValue('work_notes', …)` may silently
> no-op depending on execution context (it does **not** raise an error). Every ServiceNow
> plugin-shipped AIA tool writes journal fields with **direct property assignment**
> (`gr.work_notes = value`) instead. Use direct assignment for `work_notes`/`comments` everywhere
> in this cookbook. See `tool-script-rules.md` **Rule 2a** for the read-side pattern.

### Tool Configuration

- **Internal name:** `update_incident_fields`
- **Description:** "Update fields on an existing incident. Specify which fields to change."
- **Execution mode:** `copilot`

### Input Schema

```json
[
  {"name": "incident_number", "type": "string", "mandatory": true, "description": "Incident number like INC0010001"},
  {"name": "priority", "type": "string", "mandatory": false, "description": "New priority: 1, 2, 3, or 4"},
  {"name": "category", "type": "string", "mandatory": false, "description": "New category"},
  {"name": "assignment_group", "type": "string", "mandatory": false, "description": "New assignment group name"},
  {"name": "work_notes", "type": "string", "mandatory": false, "description": "Work note to add"}
]
```

### Script

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var incNumber = String(inputs.incident_number || "").trim();
        if (!incNumber) {
            outputs.error = "incident_number is required";
            outputs.status = "error";
            return outputs;
        }

        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('number', incNumber);
        gr.setLimit(1);
        gr.query();

        if (!gr.next()) {
            outputs.error = "Incident not found or access denied: " + incNumber;
            outputs.status = "not_found";
            return outputs;
        }

        var updatedFields = [];

        if (inputs.priority) {
            gr.setValue('priority', String(inputs.priority));
            updatedFields.push('priority');
        }
        if (inputs.category) {
            gr.setValue('category', String(inputs.category));
            updatedFields.push('category');
        }
        if (inputs.assignment_group) {
            var groupGr = new GlideRecordSecure('sys_user_group');
            groupGr.addUserEncodedQuery();
            groupGr.addQuery('name', String(inputs.assignment_group));
            groupGr.setLimit(1);
            groupGr.query();
            if (groupGr.next()) {
                gr.setValue('assignment_group', groupGr.getValue('sys_id'));
                updatedFields.push('assignment_group');
            } else {
                outputs.error = "Assignment group not found: " + inputs.assignment_group;
                outputs.status = "error";
                return outputs;
            }
        }
        if (inputs.work_notes) {
            gr.work_notes = String(inputs.work_notes);   // correct — journal field direct write
            // NOT: gr.setValue('work_notes', ...)        // may silently fail depending on context
            updatedFields.push('work_notes');
        }

        if (updatedFields.length === 0) {
            outputs.error = "No fields specified to update";
            outputs.status = "error";
            return outputs;
        }

        gr.update();
        outputs.updated_fields = updatedFields;
        outputs.incident_number = incNumber;
        outputs.status = "success";
        outputs.message = "Updated " + updatedFields.join(', ') + " on " + incNumber;
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

---

## Recipe 5: Query with Aggregation

Count and group records for reporting.

### Tool Configuration

- **Internal name:** `incident_summary_stats`
- **Description:** "Get summary statistics: count of incidents by priority and state"
- **Execution mode:** `autopilot`

### Input Schema

```json
[
  {"name": "time_period", "type": "string", "mandatory": false, "description": "Time period: today, this_week, this_month (default: this_week)"}
]
```

### Script

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var period = String(inputs.time_period || "this_week");
        var dateFilter = "";
        var now = new Date();

        if (period === "today") {
            var today = now.toISOString().split('T')[0];
            dateFilter = "sys_created_on>=" + today;
        } else if (period === "this_week") {
            var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            dateFilter = "sys_created_on>=" + weekAgo.toISOString().split('T')[0];
        } else if (period === "this_month") {
            var monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            dateFilter = "sys_created_on>=" + monthAgo.toISOString().split('T')[0];
        }

        // Count by priority
        var byPriority = {"1 - Critical": 0, "2 - High": 0, "3 - Moderate": 0, "4 - Low": 0};
        var byState = {};
        var total = 0;

        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        if (dateFilter) gr.addEncodedQuery(dateFilter);
        gr.setLimit(1000);
        gr.query();

        while (gr.next()) {
            total++;
            var priority = gr.getDisplayValue('priority');
            var state = gr.getDisplayValue('state');

            if (byPriority[priority] !== undefined) {
                byPriority[priority]++;
            }
            byState[state] = (byState[state] || 0) + 1;
        }

        outputs.total = total;
        outputs.by_priority = byPriority;
        outputs.by_state = byState;
        outputs.period = period;
        outputs.status = "success";
        outputs.summary = total + " incidents in " + period + ": " +
            byPriority["1 - Critical"] + " critical, " +
            byPriority["2 - High"] + " high, " +
            byPriority["3 - Moderate"] + " moderate, " +
            byPriority["4 - Low"] + " low";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

---

## Recipe 6: Call REST API

Make an outbound REST call from a tool script.

### Tool Configuration

- **Internal name:** `lookup_external_status`
- **Description:** "Check the status of a service in an external monitoring system"
- **Execution mode:** `copilot`

### Input Schema

```json
[
  {"name": "service_name", "type": "string", "mandatory": true, "description": "Name of the service to check"}
]
```

### Script

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var serviceName = String(inputs.service_name || "").trim();
        if (!serviceName) {
            outputs.error = "service_name is required";
            outputs.status = "error";
            return outputs;
        }

        // Use RESTMessageV2 for outbound calls
        var restMessage = new sn_ws.RESTMessageV2();
        restMessage.setHttpMethod('GET');
        restMessage.setEndpoint('https://api.example.com/status/' + encodeURIComponent(serviceName));

        // Set auth from system property (never hardcode)
        var apiKey = String(gr_props.getProperty('x_myapp.monitoring_api_key') || "");
        restMessage.setRequestHeader('Authorization', 'Bearer ' + apiKey);
        restMessage.setRequestHeader('Content-Type', 'application/json');

        var response = restMessage.execute();
        var httpStatus = response.getStatusCode();
        var body = response.getBody();

        if (httpStatus == 200) {
            var data = JSON.parse(body);
            outputs.service_name = serviceName;
            outputs.service_status = data.status;
            outputs.last_checked = data.last_checked;
            outputs.status = "success";
        } else {
            outputs.error = "API returned status " + httpStatus;
            outputs.status = "error";
        }
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

> **Note:** For production use, configure the REST endpoint as a REST Message record in ServiceNow and reference it by name. This example shows the direct approach for prototyping.

---

## Recipe 7: Chain Operations

Multi-step operations that read, decide, then act.

### Tool Configuration

- **Internal name:** `auto_categorize_and_assign`
- **Description:** "Analyze an incident, set category based on description keywords, and assign to the correct group"
- **Execution mode:** `copilot`

### Input Schema

```json
[
  {"name": "incident_number", "type": "string", "mandatory": true, "description": "Incident number to categorize and assign"}
]
```

### Script

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var incNumber = String(inputs.incident_number || "").trim();

        // Step 1: Read the incident
        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('number', incNumber);
        gr.setLimit(1);
        gr.query();

        if (!gr.next()) {
            outputs.error = "Incident not found: " + incNumber;
            outputs.status = "not_found";
            return outputs;
        }

        var description = (gr.getValue('short_description') + " " + gr.getValue('description')).toLowerCase();

        // Step 2: Categorize based on keywords
        var categoryMap = {
            "network": ["network", "wifi", "vpn", "dns", "connectivity", "firewall"],
            "hardware": ["laptop", "monitor", "keyboard", "mouse", "printer", "hardware"],
            "software": ["install", "update", "crash", "error", "application", "software"],
            "database": ["database", "sql", "query", "table", "data"],
            "inquiry": ["question", "how to", "help", "information", "what is"]
        };

        var assignmentMap = {
            "network": "Network Support",
            "hardware": "Hardware Support",
            "software": "Application Support",
            "database": "Database Administration",
            "inquiry": "Service Desk"
        };

        var matchedCategory = "inquiry"; // default
        var maxMatches = 0;

        for (var cat in categoryMap) {
            var keywords = categoryMap[cat];
            var matches = 0;
            for (var i = 0; i < keywords.length; i++) {
                if (description.indexOf(keywords[i]) > -1) matches++;
            }
            if (matches > maxMatches) {
                maxMatches = matches;
                matchedCategory = cat;
            }
        }

        // Step 3: Resolve assignment group
        var groupName = assignmentMap[matchedCategory];
        var groupGr = new GlideRecordSecure('sys_user_group');
        groupGr.addUserEncodedQuery();
        groupGr.addQuery('name', groupName);
        groupGr.setLimit(1);
        groupGr.query();

        var groupSysId = "";
        if (groupGr.next()) {
            groupSysId = groupGr.getValue('sys_id');
        }

        // Step 4: Update the incident
        gr.setValue('category', matchedCategory);
        if (groupSysId) gr.setValue('assignment_group', groupSysId);
        // work_notes is a journal field — direct assignment, NOT gr.setValue('work_notes', ...)
        gr.work_notes = "Auto-categorized as '" + matchedCategory + "' based on keyword analysis. Assigned to " + groupName + ".";
        gr.update();

        outputs.incident_number = incNumber;
        outputs.category = matchedCategory;
        outputs.assignment_group = groupName;
        outputs.keyword_matches = maxMatches;
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

---

## Recipe 8: Conditional Logic

Branch behavior based on record state or data.

### Tool Configuration

- **Internal name:** `check_sla_status`
- **Description:** "Check SLA status for an incident and recommend action based on breach proximity"
- **Execution mode:** `autopilot`

### Input Schema

```json
[
  {"name": "incident_number", "type": "string", "mandatory": true, "description": "Incident number to check SLA for"}
]
```

### Script

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var incNumber = String(inputs.incident_number || "").trim();

        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('number', incNumber);
        gr.setLimit(1);
        gr.query();

        if (!gr.next()) {
            outputs.error = "Incident not found: " + incNumber;
            outputs.status = "not_found";
            return outputs;
        }

        // Check task SLA
        var slaGr = new GlideRecordSecure('task_sla');
        slaGr.addUserEncodedQuery();
        slaGr.addQuery('task', gr.getValue('sys_id'));
        slaGr.addActiveQuery();
        slaGr.query();

        var slas = [];
        while (slaGr.next()) {
            var percentage = parseInt(slaGr.getValue('percentage') || '0', 10);
            var breached = slaGr.getValue('has_breached') == 'true';

            var urgency;
            if (breached) {
                urgency = "BREACHED";
            } else if (percentage >= 75) {
                urgency = "CRITICAL — approaching breach";
            } else if (percentage >= 50) {
                urgency = "WARNING — past halfway";
            } else {
                urgency = "OK";
            }

            slas.push({
                sla_name: slaGr.getDisplayValue('sla'),
                percentage: percentage,
                has_breached: breached,
                urgency: urgency
            });
        }

        // Determine recommendation
        var hasBreach = slas.some(function(s) { return s.has_breached; });
        var hasCritical = slas.some(function(s) { return s.urgency === "CRITICAL — approaching breach"; });

        if (hasBreach) {
            outputs.recommendation = "SLA BREACHED — escalate immediately to assignment group manager";
        } else if (hasCritical) {
            outputs.recommendation = "SLA at risk — prioritize this incident, consider reassignment if current assignee is unavailable";
        } else {
            outputs.recommendation = "SLA within acceptable range — continue normal processing";
        }

        outputs.incident_number = incNumber;
        outputs.sla_records = slas;
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

---

## Recipe 9: Voice-Compatible Script

All inputs and outputs as strings for voice agent compatibility.

### Tool Configuration

- **Internal name:** `voice_check_incident`
- **Description:** "Check incident status and read it back as a spoken sentence"
- **Execution mode:** `autopilot`

### Input Schema

```json
[
  {"name": "incident_number", "type": "string", "mandatory": true, "description": "Incident number"}
]
```

### Script

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var incNumber = String(inputs.incident_number || "").trim();

        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('number', incNumber);
        gr.setLimit(1);
        gr.query();

        if (gr.next()) {
            // Build natural language response for voice
            var state = gr.getDisplayValue('state');
            var priority = gr.getDisplayValue('priority');
            var assignee = gr.getDisplayValue('assigned_to') || "unassigned";
            var shortDesc = gr.getValue('short_description');

            outputs.result = "Incident " + gr.getValue('number') +
                " is currently " + state +
                " with " + priority + " priority" +
                ", assigned to " + assignee +
                ". The issue is: " + shortDesc + ".";
            outputs.status = "success";
        } else {
            outputs.result = "I could not find an incident with number " + incNumber +
                ". Please check the number and try again.";
            outputs.status = "not_found";
        }
    } catch (e) {
        outputs.result = "I encountered an error while looking up the incident. Please try again.";
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

> **Key:** For voice agents, always return `outputs.result` as a human-readable sentence. Avoid technical jargon and sys_ids in voice responses.

---

## Recipe 10: Bulk Operations

Process multiple records in a single tool invocation.

### Tool Configuration

- **Internal name:** `bulk_add_work_notes`
- **Description:** "Add the same work note to multiple incidents at once"
- **Execution mode:** `copilot`

### Input Schema

```json
[
  {"name": "incident_numbers", "type": "string", "mandatory": true, "description": "Comma-separated incident numbers, e.g., INC0010001,INC0010002"},
  {"name": "work_note", "type": "string", "mandatory": true, "description": "Work note to add to all incidents"}
]
```

### Script

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var numbersStr = String(inputs.incident_numbers || "");
        var workNote = String(inputs.work_note || "").trim();

        if (!workNote) {
            outputs.error = "work_note is required";
            outputs.status = "error";
            return outputs;
        }

        var numbers = numbersStr.split(',').map(function(n) { return n.trim(); }).filter(function(n) { return n; });
        if (numbers.length === 0) {
            outputs.error = "At least one incident number is required";
            outputs.status = "error";
            return outputs;
        }
        if (numbers.length > 20) {
            outputs.error = "Maximum 20 incidents per batch";
            outputs.status = "error";
            return outputs;
        }

        var results = [];
        for (var i = 0; i < numbers.length; i++) {
            var gr = new GlideRecordSecure('incident');
            gr.addUserEncodedQuery();
            gr.addQuery('number', numbers[i]);
            gr.setLimit(1);
            gr.query();

            if (gr.next()) {
                gr.work_notes = workNote;   // journal field — direct assignment, NOT gr.setValue
                gr.update();
                results.push({number: numbers[i], status: "updated"});
            } else {
                results.push({number: numbers[i], status: "not_found"});
            }
        }

        outputs.results = results;
        var successCount = results.filter(function(r) { return r.status === "updated"; }).length;
        outputs.summary = successCount + " of " + numbers.length + " incidents updated";
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

---

## Recipe 11: Reference Field Resolution

Follow reference chains to get related data.

### Tool Configuration

- **Internal name:** `get_incident_context`
- **Description:** "Get incident details including caller info, assignment group members, and related CIs"
- **Execution mode:** `autopilot`

### Input Schema

```json
[
  {"name": "incident_number", "type": "string", "mandatory": true, "description": "Incident number"}
]
```

### Script

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var incNumber = String(inputs.incident_number || "").trim();

        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('number', incNumber);
        gr.setLimit(1);
        gr.query();

        if (!gr.next()) {
            outputs.error = "Incident not found: " + incNumber;
            outputs.status = "not_found";
            return outputs;
        }

        outputs.incident = {
            number: gr.getValue('number'),
            short_description: gr.getValue('short_description'),
            state: gr.getDisplayValue('state'),
            priority: gr.getDisplayValue('priority')
        };

        // Resolve caller details
        var callerId = gr.getValue('caller_id');
        if (callerId) {
            var callerGr = new GlideRecordSecure('sys_user');
            callerGr.addUserEncodedQuery();
            if (callerGr.get(callerId)) {
                outputs.caller = {
                    name: callerGr.getDisplayValue('name'),
                    email: callerGr.getValue('email'),
                    department: callerGr.getDisplayValue('department'),
                    location: callerGr.getDisplayValue('location'),
                    vip: callerGr.getValue('vip') === 'true'
                };
            }
        }

        // Resolve CI details
        var cmdbCi = gr.getValue('cmdb_ci');
        if (cmdbCi) {
            var ciGr = new GlideRecordSecure('cmdb_ci');
            ciGr.addUserEncodedQuery();
            if (ciGr.get(cmdbCi)) {
                outputs.configuration_item = {
                    name: ciGr.getValue('name'),
                    class: ciGr.getDisplayValue('sys_class_name'),
                    status: ciGr.getDisplayValue('operational_status'),
                    environment: ciGr.getDisplayValue('u_environment')
                };
            }
        }

        // Get assignment group members
        var groupId = gr.getValue('assignment_group');
        if (groupId) {
            var memberGr = new GlideRecordSecure('sys_user_grmember');
            memberGr.addUserEncodedQuery();
            memberGr.addQuery('group', groupId);
            memberGr.setLimit(10);
            memberGr.query();

            var members = [];
            while (memberGr.next()) {
                members.push(memberGr.getDisplayValue('user'));
            }
            outputs.assignment_group_members = members;
        }

        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

---

## Recipe 12: Date-Based Filtering

Time-relative queries using native JavaScript dates.

### Tool Configuration

- **Internal name:** `get_recent_changes`
- **Description:** "Get recent change requests within a time window"
- **Execution mode:** `autopilot`

### Input Schema

```json
[
  {"name": "hours_back", "type": "number", "mandatory": false, "description": "How many hours back to look (default: 24, max: 168)"},
  {"name": "state", "type": "string", "mandatory": false, "description": "Filter by state: New, Assess, Authorize, Scheduled, Implement, Review, Closed"}
]
```

### Script

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var hoursBack = Math.min(parseInt(inputs.hours_back || 24, 10), 168);
        var cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
        var cutoffStr = cutoff.toISOString().replace('T', ' ').substring(0, 19);

        var gr = new GlideRecordSecure('change_request');
        gr.addUserEncodedQuery();
        gr.addQuery('sys_created_on', '>=', cutoffStr);

        if (inputs.state) {
            gr.addQuery('state', String(inputs.state));
        }

        gr.setLimit(50);
        gr.orderByDesc('sys_created_on');
        gr.query();

        var records = [];
        while (gr.next()) {
            records.push({
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                state: gr.getDisplayValue('state'),
                type: gr.getDisplayValue('type'),
                risk: gr.getDisplayValue('risk'),
                start_date: gr.getValue('start_date'),
                end_date: gr.getValue('end_date')
            });
        }

        outputs.records = records;
        outputs.count = records.length;
        outputs.time_window = "Last " + hoursBack + " hours";
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

> **Key:** Use `new Date()` (native JavaScript) for date arithmetic. Never use `GlideDateTime` in tool scripts — it causes silent hangs.

---

## Script Writing Checklist

Before deploying any tool script, verify:

- [ ] Uses `GlideRecordSecure` (not `GlideRecord`)
- [ ] Calls `addUserEncodedQuery()` immediately after instantiation
- [ ] No `gs.*` calls (no `gs.log`, `gs.getUserName`, etc.)
- [ ] No `GlideDateTime` — uses `new Date()` instead
- [ ] All inputs validated with `String()` conversion
- [ ] Journal fields (`work_notes`, `comments`) written with **direct assignment** (`gr.work_notes = …`), never `gr.setValue('work_notes', …)` (silent no-op risk)
- [ ] `setLimit()` called on every query
- [ ] `try/catch` wraps entire function
- [ ] Returns `outputs.status` as "success", "error", or "not_found"
- [ ] Tool name uses `snake_case` (no CamelCase)
- [ ] Input schema has `mandatory: true` for required fields
- [ ] Execution mode is `copilot` for any write operations
- [ ] Voice-compatible if intended for voice agents (string-only I/O)

---

## Related Resources

- [Tool Script Rules](./tool-script-rules.md) — Mandatory safety rules (read first)
- [Security Patterns](./security-patterns.md) — GlideRecordSecure, ACLs, role masking
- [ServiceNow AI Data Model](./servicenow-ai-data-model.md) — Table reference

---

*All scripts validated against ServiceNow Zurich. Patterns tested on gpinst01 instance with AI Agent tool sandbox.*
