---
name: tool-script-writer
description: Take a tool description and produce a complete, safe ServiceNow AI Agent tool script with GlideRecordSecure, input/output schemas, error handling, and naming conventions.
scope: project
recommended: false
version: 1.0.0
---
# Skill: Tool Script Writer

> Take a tool description and produce a complete, safe ServiceNow AI Agent tool script with GlideRecordSecure, input/output schemas, error handling, and naming conventions.

> **Path resolution:** `.claude/context/...` paths in this skill assume a
> Foundry-MCP-provisioned project (`foundry_init` / `foundry_add`). When this
> skill runs from the Foundry Claude Code plugin instead, the same files live
> under `${CLAUDE_PLUGIN_ROOT}/context/...` — read whichever path exists.

> **Runtime tooling:** The `servicenow_*` tool names in this document are the Foundry MCP server's runtime tools. Treat them as capabilities — "execute an agent", "read an execution trace", "query a table" — and map them to the equivalents of whatever MCP server is connected. With no MCP server, fall back to manual verification: test in the Now Assist panel / AI Agent Studio and read execution traces from `sn_aia_execution_plan` / `sn_aia_execution_task`; query data via list views or a user-run background script.

---

## Overview

This skill transforms a natural language tool description into a production-ready tool script for ServiceNow AI Agents. Every script produced follows the mandatory safety rules from `tool-script-rules.md` and uses patterns from `tool-script-cookbook.md`.

The output is a complete package: script + input schema + output schema + deployment configuration — ready to deploy via MCP.

## When to Use

Use this skill when:
- You need to create a new tool script for an AI agent
- You're converting a tool requirement from a solution spec into code
- You need to refactor an existing tool to follow safety rules
- You're building tools for voice agents (string-only I/O)

## Prerequisites

**CRITICAL:** Read these context files FIRST before writing any script:
1. `tool-script-rules.md` — Mandatory safety rules (forbidden APIs, GlideRecordSecure)
2. `tool-script-cookbook.md` — Tested patterns to base your script on
3. `servicenow-ai-data-model.md` — Table reference
4. `security-patterns.md` — ACL and role considerations

**MCP Tools Available:**
- `servicenow_script` — Test scripts in read-only mode
- `servicenow_query` — Verify tables and data exist
- `servicenow_aia_create` — Deploy the tool

---

## Instructions

### Step 1: Gather Tool Requirements (REQUIRED — DO NOT SKIP)

**STOP.** Before writing any code, clarify these questions with the user:

| # | Question | Default if Not Answered |
|---|----------|------------------------|
| 1 | **What should this tool do?** (one sentence) | — (required) |
| 2 | **Which tables does it access?** | — (required) |
| 3 | **Does it read, write, or both?** | Read-only |
| 4 | **What inputs does it need?** | Derive from description |
| 5 | **Is this for a voice agent?** | No |
| 6 | **What fields should be in the output?** | Derive from description |

### Step 2: Choose the Base Pattern

Select the closest pattern from the cookbook:

| Tool Purpose | Base Pattern | Cookbook Recipe # |
|-------------|-------------|-----------------|
| Get one record by ID/number | Get Single Record | Recipe 1 |
| Query multiple records | Query and Summarize | Recipe 2 |
| Create a new record | Create Record | Recipe 3 |
| Update existing record | Update Fields | Recipe 4 |
| Count/aggregate records | Query with Aggregation | Recipe 5 |
| Call external API | Call REST API | Recipe 6 |
| Read → decide → act | Chain Operations | Recipe 7 |
| Branch based on data | Conditional Logic | Recipe 8 |
| Voice-compatible tool | Voice-Compatible Script | Recipe 9 |
| Batch processing | Bulk Operations | Recipe 10 |
| Follow references | Reference Field Resolution | Recipe 11 |
| Time-based queries | Date-Based Filtering | Recipe 12 |

### Step 3: Write the Tool Script

Follow this exact structure:

```javascript
(function(inputs) {
    var outputs = {};
    try {
        // 1. VALIDATE INPUTS
        var requiredField = String(inputs.field_name || "").trim();
        if (!requiredField) {
            outputs.error = "field_name is required";
            outputs.status = "error";
            return outputs;
        }

        // 2. QUERY DATA (GlideRecordSecure + addUserEncodedQuery)
        var gr = new GlideRecordSecure('table_name');
        gr.addUserEncodedQuery();  // MANDATORY — enforces ACLs
        gr.addQuery('field', requiredField);
        gr.setLimit(N);  // MANDATORY — prevent unbounded queries
        gr.query();

        // 3. PROCESS RESULTS
        if (gr.next()) {
            outputs.data = {
                // Return only needed fields
            };
            outputs.status = "success";
        } else {
            outputs.error = "Record not found: " + requiredField;
            outputs.status = "not_found";
        }

    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Step 4: Write the Input Schema

```json
[
  {"name": "field_name", "type": "string", "mandatory": true, "description": "Clear description of this input"},
  {"name": "optional_field", "type": "string", "mandatory": false, "description": "Clear description"}
]
```

**Rules:**
- Every required input MUST have `mandatory: true`
- Use `string` type for voice agent tools (all inputs and outputs)
- Include clear `description` — the agent reads this to decide what to ask the user
- Keep inputs minimal — only what the script actually uses

### Step 5: Write the Output Schema

```json
[
  {"name": "status", "type": "string", "description": "success, error, or not_found"},
  {"name": "data", "type": "object", "description": "The result data"},
  {"name": "error", "type": "string", "description": "Error message if status is error"}
]
```

### Step 6: Run the Safety Checklist

Before deploying, verify EVERY item:

- [ ] **GlideRecordSecure** used (NOT GlideRecord)
- [ ] **addUserEncodedQuery()** called immediately after `new GlideRecordSecure()`
- [ ] **No forbidden `gs.*` calls** — no `gs.log`, `gs.getUserName`, `gs.getUserID`, `gs.getSessionID`, `gs.info`, `gs.print`, `gs.error`, `gs.debug`, `gs.warn` (session/logging APIs undefined in the tool sandbox). Exception: `gs.getProperty()` is permitted — it's used by this skill's own outbound-REST credential pattern (see below).
- [ ] **No `GlideDateTime`** — uses `new Date()` for dates
- [ ] **All inputs validated** with `String()` conversion
- [ ] **`setLimit()` called** on every query
- [ ] **`try/catch`** wraps the entire function
- [ ] **`outputs.status`** is always set (success, error, or not_found)
- [ ] **Tool name** uses `snake_case` (no CamelCase)
- [ ] **Input schema** has `mandatory: true` for required fields
- [ ] **Execution mode** is `copilot` (UI: Supervised) for writes, `autopilot` (UI: Autonomous) for reads
- [ ] **Voice compatible** if for voice agents (string-only I/O)
- [ ] **Journal fields via Script tool only** — `work_notes` / `comments` writes silently fail in CRUD update tools (SDK 4.9.0 guide); this script pattern (GlideRecordSecure) is the supported path
- [ ] **Query outputs include `sys_id`** so downstream tools/agents can act on the record

**If ANY item fails, fix it before deploying.** Do not skip this checklist.

### Step 7: Test the Script

Use the `servicenow_script` MCP tool to test in read-only mode:

```
MCP call: servicenow_script
  script: "<your tool script>"
  readonly: true
```

Verify:
- Script executes without errors
- Output structure matches the output schema
- Data returned is correct

### Step 8: Deploy the Tool

Use dry-run first, then deploy:

```
MCP call: servicenow_aia_create
  type: "tool"
  name: "your_tool_name"
  description: "Clear description for the agent"
  script: "<your script>"
  input_schema: [...]
  output_schema: [...]
  execution_mode: "autonomous"  (or "supervised" for writes)
  dry_run: true  ← FIRST

Then repeat without dry_run to actually create.
```

### Step 9: Return the Deployment Report

Output this report to the orchestrator or user:

```
## Tool Deployment Report

**Tool Name:** [snake_case_name]
**sys_id:** [from deployment]
**Execution Mode:** [Autonomous/Supervised]
**Tables Accessed:** [list]

### Input Schema
| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| ... | ... | ... | ... |

### Output Schema
| Name | Type | Description |
|------|------|-------------|
| ... | ... | ... |

### Test Results
- Script execution: [PASS/FAIL]
- Dry-run deployment: [PASS/FAIL]
- Live deployment: [PASS/FAIL]

### Safety Checklist
- GlideRecordSecure: PASS
- addUserEncodedQuery: PASS
- No forbidden APIs: PASS
- Input validation: PASS
- Error handling: PASS
```

---

## Validation Checklist

Before declaring this skill complete, verify:

- [ ] Script follows the exact structure from Step 3
- [ ] Input schema has all mandatory fields marked
- [ ] Safety checklist (Step 6) passes with no exceptions
- [ ] Script has been tested via `servicenow_script`
- [ ] Deployment report is complete

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Tool hangs, no response | Using `gs.log()` or `GlideDateTime` | Replace with allowed alternatives |
| "Access denied" or empty results | Missing `addUserEncodedQuery()` or user lacks roles | Add `addUserEncodedQuery()`, check user roles |
| Agent doesn't collect required input | `mandatory: true` missing from schema | Add `mandatory: true` to required inputs |
| Tool name rejected | CamelCase in tool name | Use `snake_case` only |
| Script error on insert/update | Using `GlideRecord` for mutations | Switch to `GlideRecordSecure` |

## Tips

- **Copy from the cookbook.** Don't write from scratch — adapt the closest recipe.
- **Less is more.** Return only the fields the agent needs, not every field on the record.
- **Validate inputs defensively.** Always use `String(inputs.x || "")` — inputs can be null.
- **Name tools for the agent.** The tool name and description are what the agent reads to decide when to use it. Make them clear and distinct.

---

## Inbound Scripted REST APIs

For inbound Scripted REST APIs via Fluent DSL, see `.claude/context/sdk-examples/rest-api.now.ts`.

---

## Outbound REST API Patterns

Use these patterns when a tool script needs to call an external API from ServiceNow using `sn_ws.RESTMessageV2`.

### RESTMessageV2 Client Template

```javascript
/**
 * Outbound REST API client with retry, auth, and error handling.
 * Adapt this class inside a tool script or Script Include.
 */
var OutboundAPIClient = Class.create();
OutboundAPIClient.prototype = {

    initialize: function(config) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.authType = config.authType || 'basic'; // 'basic' | 'oauth' | 'api_key' | 'none'
        this.oauthProfile = config.oauthProfile;     // required when authType === 'oauth'
        this.timeout = config.timeout || 30000;
        this.maxRetries = config.maxRetries || 3;
    },

    get: function(endpoint, params) {
        return this._execute('GET', endpoint, params, null);
    },
    post: function(endpoint, data, params) {
        return this._execute('POST', endpoint, params, data);
    },
    put: function(endpoint, data, params) {
        return this._execute('PUT', endpoint, params, data);
    },
    patch: function(endpoint, data, params) {
        return this._execute('PATCH', endpoint, params, data);
    },
    delete: function(endpoint, params) {
        return this._execute('DELETE', endpoint, params, null);
    },

    // ---------- Internal ----------

    _execute: function(method, endpoint, params, data) {
        var url = this._buildUrl(endpoint, params);
        var attempt = 0;
        var lastError = null;

        while (attempt < this.maxRetries) {
            attempt++;
            try {
                var result = this._makeRequest(method, url, data);
                if (result.success) return result;
                if (!this._shouldRetry(result.statusCode, attempt)) return result;
                lastError = result;
                this._waitBeforeRetry(attempt, result);
            } catch (e) {
                lastError = { error: e.message };
                if (attempt >= this.maxRetries) break;
                this._waitBeforeRetry(attempt, null);
            }
        }
        return { success: false, error: 'Max retries exceeded', lastError: lastError, attempts: attempt };
    },

    _makeRequest: function(method, url, data) {
        var request = new sn_ws.RESTMessageV2();
        request.setEndpoint(url);
        request.setHttpMethod(method);
        request.setHttpTimeout(this.timeout);
        this._applyAuth(request);
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestHeader('Accept', 'application/json');

        if (data && ['POST', 'PUT', 'PATCH'].indexOf(method) !== -1) {
            request.setRequestBody(JSON.stringify(data));
        }

        var response = request.execute();
        var statusCode = parseInt(response.getStatusCode(), 10);
        var body = response.getBody();
        var parsed = null;
        if (body) { try { parsed = JSON.parse(body); } catch (e) { parsed = body; } }
        var success = statusCode >= 200 && statusCode < 300;
        return { success: success, statusCode: statusCode, data: success ? parsed : null, error: success ? null : parsed };
    },

    _applyAuth: function(request) {
        switch (this.authType) {
            case 'basic':
                request.setBasicAuth(
                    gs.getProperty('outbound.api.username'),
                    gs.getProperty('outbound.api.password')
                );
                break;
            case 'oauth':
                if (this.oauthProfile) {
                    request.setAuthenticationProfile('oauth2', this.oauthProfile);
                }
                break;
            case 'api_key':
                request.setRequestHeader('Authorization',
                    'Bearer ' + gs.getProperty('outbound.api.key'));
                break;
            case 'none':
                break;
        }
    },

    _buildUrl: function(endpoint, params) {
        var url = this.baseUrl + (endpoint.charAt(0) === '/' ? endpoint : '/' + endpoint);
        if (params && Object.keys(params).length > 0) {
            var parts = [];
            for (var key in params) {
                if (params.hasOwnProperty(key) && params[key] != null) {
                    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
                }
            }
            if (parts.length) url += '?' + parts.join('&');
        }
        return url;
    },

    _shouldRetry: function(statusCode, attempt) {
        return attempt < this.maxRetries && (statusCode === 429 || statusCode >= 500);
    },

    _waitBeforeRetry: function(attempt, result) {
        var delay;
        if (result && result.headers && result.headers['Retry-After']) {
            delay = parseInt(result.headers['Retry-After'], 10) * 1000;
        } else {
            delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s ...
        }
        delay = Math.min(delay, 30000);
        var start = new Date().getTime();
        while (new Date().getTime() < start + delay) { /* wait */ }
    },

    type: 'OutboundAPIClient'
};
```

### Authentication Setup

| Auth Type | How to Configure |
|-----------|-----------------|
| **Basic** | Store credentials in system properties: `gs.getProperty('outbound.api.username')` / `.password` |
| **OAuth 2.0** | Create an OAuth provider in **System OAuth > Application Registry** with Client ID, Client Secret, Authorization URL, Token URL, and Grant Type. Reference the profile name via `request.setAuthenticationProfile('oauth2', 'profile_name')`. |
| **API Key** | Store in an encrypted system property: `gs.getProperty('outbound.api.key')`. Send as a header (e.g. `Authorization: Bearer ...` or `X-API-Key: ...`). |

> **Security rule:** Never hardcode credentials. Always use `gs.getProperty()` backed by encrypted system properties.

### Error Handling Strategy

```javascript
var ErrorHandler = {
    handle: function(error, context) {
        if (error.statusCode === 401) return { retry: false, action: 'alert_admin' };
        if (error.statusCode === 429) {
            var retryAfter = (error.headers && error.headers['Retry-After']) || 60;
            return { retry: true, delay: retryAfter * 1000 };
        }
        if (error.statusCode >= 500) return { retry: true, delay: context.attempt * 2000 };
        return { retry: false, action: 'log_and_continue' };
    }
};
```

| Status Code | Category | Action |
|-------------|----------|--------|
| 401 | Auth failure | Do not retry. Alert admin / refresh credentials. |
| 429 | Rate limit | Retry after `Retry-After` header (default 60 s). |
| 5xx | Server error | Retry with exponential backoff. |
| Other 4xx | Client error | Do not retry. Log and surface to caller. |

### Pagination Pattern

When the external API returns paged results, loop with an offset or cursor:

```javascript
function fetchAllPages(client, endpoint, pageSize) {
    var all = [];
    var offset = 0;
    var hasMore = true;

    while (hasMore) {
        var result = client.get(endpoint, { limit: pageSize, offset: offset });
        if (!result.success || !result.data || !result.data.length) break;
        all = all.concat(result.data);
        offset += pageSize;
        hasMore = result.data.length === pageSize;
    }
    return all;
}
```

### Usage Example

```javascript
var client = new OutboundAPIClient({
    baseUrl: 'https://api.example.com/v1',
    authType: 'oauth',
    oauthProfile: 'example_oauth_profile',
    timeout: 30000,
    maxRetries: 3
});

// GET with query params
var users = client.get('/users', { limit: 10, status: 'active' });

// POST
var created = client.post('/users', { name: 'Jane Doe', email: 'jane@example.com' });

// PUT
var updated = client.put('/users/123', { name: 'Jane Updated' });

// DELETE
var deleted = client.delete('/users/123');
```

---

*Skill designed for safe tool script production on ServiceNow Zurich. All patterns enforce GlideRecordSecure + addUserEncodedQuery() as mandatory.*
