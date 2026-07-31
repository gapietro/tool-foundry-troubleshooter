# Tool Script Rules — ServiceNow AI Agents (Zurich)

> Critical rules for writing tool scripts that run inside the ServiceNow AI Agent framework. Violating these rules causes **tool failures** (sandbox-undefined APIs that throw and return no usable output), **security violations**, or **runtime failures**.

---

## All 13 Tool Types in Zurich

ServiceNow Zurich supports 13 distinct tool types for AI Agents. Most rules in this document focus on **Script** tools, but understanding all types is essential for choosing the right approach.

| Tool Type | Description | Key Notes |
|-----------|-------------|-----------|
| **Script** | Custom editable scripts and APIs | GlideRecordSecure mandatory, not GlideRecord |
| **Catalog item** | Service catalog items | Links to existing catalog items |
| **Conversational topic** | VA conversation topics | Links to Virtual Agent topics |
| **Desktop action** | Actions on workspace | Workspace-specific actions |
| **File upload** | PDF, DOCX, TXT files | For voice agents too |
| **Flow action** | IntegrationHub spoke actions | Links to existing flow actions |
| **Knowledge graph** | Knowledge retrieval | Uses knowledge graphs |
| **Now Assist skill** | Invoke Now Assist skills | References existing skills |
| **Record operation** | CRUD on ServiceNow tables | Standard table operations |
| **Search retrieval** | Text search across sources | Use dedicated search profile for voice to reduce latency |
| **Subflow** | Execute subflows | Links to existing subflows |
| **Web search** | Internet search | NOT supported by Azure OpenAI |
| **MCP server tool** | External MCP server tools | Requires `sn_aia.enable_mcp_tool = true` |

### Choosing the Right Tool Type

- **Script** — Use when you need custom logic, conditional branching, or complex data transformations that cannot be achieved by other tool types.
- **Record operation** — Prefer over Script for simple CRUD (create, read, update, delete) on a single table. No code required.
- **Flow action / Subflow** — Use when the logic already exists in IntegrationHub or Flow Designer. Avoids duplicating code.
- **Search retrieval** — Use for text-based search across knowledge bases, catalogs, or custom tables. For voice agents, configure a dedicated search profile to reduce latency.
- **Knowledge graph** — Use for structured knowledge retrieval where relationships between articles matter.
- **File upload** — Use when the agent needs to accept or process uploaded files (PDF, DOCX, TXT).
- **MCP server tool** — Use for integrating external MCP servers. Must enable `sn_aia.enable_mcp_tool = true` in system properties.
- **Web search** — Use for internet search capabilities. Note: **NOT supported** when using Azure OpenAI as the LLM provider.

---

## Tool Naming Rules

### CRITICAL: CamelCase is Forbidden for Tool Names

The `internal_name` of a tool must use **snake_case**. CamelCase will cause failures.

```
get_incident_details      (snake_case)
getIncidentDetails        (CamelCase - FORBIDDEN)

lookup_user_by_email      (snake_case)
lookupUserByEmail         (CamelCase - FORBIDDEN)

create_change_request     (snake_case)
createChangeRequest       (CamelCase - FORBIDDEN)
```

---

## Execution Modes

Each tool has an `execution_mode` that controls whether human approval is required before the tool runs. The field values are `copilot` and `autopilot`; "Supervised" and "Autonomous" are the corresponding UI labels shown to admins.

| Mode | Description | When to Use |
|------|-------------|-------------|
| **`copilot`** (UI: Supervised) | Requires human approval before execution | Destructive operations (update, delete), sensitive data access, external API calls |
| **`autopilot`** (UI: Autonomous) | Executes without human approval | Read-only operations, safe queries, lookups |

### Guidelines

- **Default to `copilot`** for any tool that modifies data (insert, update, delete).
- **Use `autopilot`** only for read-only tools that return non-sensitive data.
- When in doubt, use `copilot`. It is always safer to require approval.

---

## Platform Limits

These system properties control agent and tool behavior. Exceeding them causes errors or throttling.

| Limit | Default Value | System Property |
|-------|---------------|-----------------|
| Max tools per agent | 20 | `sn_aia.maximum_agent_tools` |
| Max consecutive same-tool executions | 25 (developer-editable) | `sn_aia.continuous_tool_execution_limit` |
| Max continuous communicator outputs | 5 (live Zurich P10 value, verified 2026-07-29; earlier docs said 3) | `sn_aia.continuous_communicator_output_limit` |
| Max retries on failure | 3 | `sn_aia.react_failure_retry_max_limit` |
| Tool execution record expiry | 13 months | (automatic, not configurable) |

### Implications for Tool Design

- If your agent needs more than 20 tools, split into multiple specialized agents.
- If the same tool is called `continuous_tool_execution_limit` times in a row (default 25, developer-editable), the agent will stop. Design tools to return complete data in fewer calls.
- Tool execution records are automatically purged after 13 months. Plan any audit or reporting accordingly.

---

## Voice Agent Considerations

When building tools for **voice agents**, input and output data types **must be string** for optimal experience. Voice channels cannot render complex objects, arrays, or nested structures.

```javascript
// For voice agents - inputs and outputs must be string type
[{"name": "incident_number", "type": "string", "mandatory": true}]

// For voice agents - output should be a flat string
outputs.result = "Incident INC0010001 is currently In Progress, priority 2.";
```

For **Search retrieval** tools used by voice agents, configure a **dedicated search profile** to reduce latency. Voice interactions are time-sensitive and cannot tolerate slow search responses.

---

## Rule 1: FORBIDDEN APIs

The AI Agent tool-script sandbox does **not** expose the full `GlideSystem` (`gs`) API or `GlideDateTime`. Referencing them fails — the script does not produce a usable result and the tool call does not complete normally. Use the sandbox-safe alternatives below.

| Forbidden API | Why it fails | Use Instead |
|---------------|-------------|-------------|
| `new GlideDateTime()` | Not available in the tool sandbox | `new Date()` |
| `gs.getUserName()` | `gs` user/session methods not available | Pass as tool input |
| `gs.getUserID()` | `gs` user/session methods not available | Pass as tool input |
| `gs.getSessionID()` | `gs` user/session methods not available | Not needed |
| `gs.log()` | Logging methods not defined in the sandbox | `outputs.log = "message"` |
| `gs.print()` | Logging methods not defined in the sandbox | Return in outputs |
| `gs.info()` | Logging methods not defined in the sandbox | Return in outputs |
| `gs.error()` | Logging methods not defined in the sandbox | `outputs.error = "message"` |
| `gs.debug()` | Logging methods not defined in the sandbox | Return in outputs |
| `gs.warn()` | Logging methods not defined in the sandbox | Return in outputs |

> **Note on the mechanism:** earlier guidance described these as "silent hangs." Verification against a live instance (Zurich Patch 8) shows the logging methods (`gs.log/print/info/error/debug/warn`) are **undefined in the tool sandbox** — referencing them throws rather than hanging — so the tool returns no useful output. Either way the rule is the same: **never call `gs.*` or `GlideDateTime` from a tool script** (exception: `gs.getProperty()` for reading system properties, e.g. credentials for outbound REST). Emit diagnostics through `outputs.*` instead.

**Bottom line:** Never use `gs.*` or `GlideDateTime` in tool scripts (exception: `gs.getProperty()` for reading system properties, e.g. credentials for outbound REST).

---

## Rule 2: GlideRecordSecure is MANDATORY (Security)

### CRITICAL: Use GlideRecordSecure, NOT GlideRecord

In Zurich, **GlideRecordSecure** is the required pattern for all AI Agent tool scripts. GlideRecord technically works but **bypasses ACL enforcement**, creating a security vulnerability where the agent can access data the user is not authorized to see.

```javascript
// WRONG for AI agent scripts — bypasses user permissions
var gr = new GlideRecord('incident');
gr.addQuery('priority', 1);
gr.query();

// REQUIRED for AI agent scripts — enforces user permissions
var gr = new GlideRecordSecure('incident');
gr.addUserEncodedQuery();  // ALSO REQUIRED — enforces ACLs of the executing user
gr.addQuery('priority', 1);
gr.query();
```

### Why Both GlideRecordSecure AND addUserEncodedQuery()?

| Method | What It Does |
|--------|-------------|
| `GlideRecordSecure` | Enforces field-level ACLs — prevents reading fields the user cannot see |
| `addUserEncodedQuery()` | Enforces row-level ACLs — prevents returning records the user cannot access |

**Both are required together.** Using only one leaves a gap:
- `GlideRecordSecure` without `addUserEncodedQuery()` — user might see records they should not access (row-level gap)
- `addUserEncodedQuery()` on plain `GlideRecord` — user might see field values they should not read (field-level gap)

### GlideRecordSecure — Full API Reference

GlideRecordSecure has the same API as GlideRecord. All query methods work identically:

```javascript
// Query building
var gr = new GlideRecordSecure('table_name');
gr.addUserEncodedQuery();                         // ALWAYS call this first
gr.addQuery('field', 'value');                    // Equals
gr.addQuery('field', '!=', 'value');              // Not equals
gr.addQuery('field', 'CONTAINS', 'value');        // Contains
gr.addQuery('field', 'STARTSWITH', 'value');       // Starts with
gr.addQuery('field', '>', 100);                   // Greater than
gr.addQuery('field', 'IN', 'val1,val2,val3');     // In list
gr.addActiveQuery();                              // active = true
gr.addNullQuery('field');                         // IS NULL
gr.addNotNullQuery('field');                      // IS NOT NULL
gr.setLimit(100);                                 // Limit results
gr.orderBy('field');                              // ASC order
gr.orderByDesc('field');                          // DESC order

// Execution
gr.query();                                       // Execute query
gr.hasNext();                                     // Check if results exist

// Record traversal
while (gr.next()) {
    // Process record
}

// Single record fetch
gr.get('sys_id', 'specific-sys-id');              // By sys_id
gr.get('number', 'INC0010001');                   // By field

// Field access
gr.getValue('field_name');                        // Raw value
gr.getDisplayValue('field_name');                 // Display value
gr.getElement('field_name');                      // GlideElement

// Related records
gr.caller_id.getDisplayValue();                   // Reference field display
gr.assigned_to.sys_id.toString();                 // Reference sys_id

// Mutations (use with copilot execution mode)
gr.setValue('field', 'value');                     // Set field
gr.update();                                      // Save changes
gr.insert();                                      // Create record
gr.initialize();                                  // Prepare for insert
```

### Native JavaScript — Always Safe

```javascript
new Date().toISOString();           // Current timestamp
new Date().toLocaleDateString();    // Formatted date
Date.now();                         // Unix timestamp
String(value);                      // Type conversion
Number(value);                      // Type conversion
JSON.parse(jsonString);             // Parse JSON
JSON.stringify(object);             // Serialize JSON
Math.min(a, b);                     // Math operations
parseInt(str, 10);                  // Parse integer
```

---

## Rule 2a: Journal Fields — Direct Assignment, Not setValue

`work_notes` and `comments` are **journal fields**. They are not stored as columns on the task row;
each entry is a row in **`sys_journal_field`** keyed by `element_id` (the task `sys_id`) and `element`
(the field name, e.g. `work_notes`). Because of that indirection, `gr.setValue('work_notes', …)`
**may silently no-op depending on execution context** — it does not throw, so the missing comment is
easy to miss until someone reads the activity stream.

**The platform pattern is direct property assignment.** Every ServiceNow plugin-shipped AIA tool
(in named packages such as `sn_complaint_ai`, `sn_hr_ai_agents`, `sn_csm_ai_agents`, `sn_itsm_aia`,
`sn_uxc_gen_ai`) writes journal fields with `gr.work_notes = value` — **zero** of them use
`setValue` for a journal field. (A handful of admin-authored global/POC tools do use `setValue`; do
not treat the no-op as categorical, but always prefer direct assignment.)

```javascript
// WRITE — correct
gr.work_notes = String(inputs.work_notes);
// NOT: gr.setValue('work_notes', ...)   // may silently no-op depending on context

// READ — latest entry, sandbox-safe
var lastNote = gr.work_notes.getJournalEntry(-1);   // -1 = most recent; 1 = oldest
```

To read the **full history** (not just the latest), query the journal table directly with the
mandatory secure pattern:

```javascript
var jr = new GlideRecordSecure('sys_journal_field');
jr.addUserEncodedQuery();
jr.addQuery('element_id', gr.getValue('sys_id'));
jr.addQuery('element', 'work_notes');   // or 'comments'
jr.orderByDesc('sys_created_on');
jr.setLimit(20);
jr.query();
```

> **Diagnostic chain** when a comment "didn't save": (1) confirm you used direct assignment, not
> `setValue('work_notes', …)`; (2) `gr.work_notes.setJournalEntry(value)` is the documented setter
> if you must call a method; (3) inserting a `sys_journal_field` row directly is a last resort and
> bypasses the normal field plumbing — avoid it in tool scripts.

### Writing journal fields from SDK-authored TypeScript (not the tool sandbox)

The above is plain JS, which is what the AIA tool sandbox runs — there, `gr.work_notes = value`
just works. But if you write a journal field from **SDK-authored TypeScript** (a Fluent
`ScriptInclude`/`BusinessRule` server script typed against `@servicenow/glide`), direct assignment
is a **compile error**: the field accessors are typed as `GlideElement`, so `gr.work_notes = "…"`
fails with `Type 'string' is not assignable to type 'GlideElement'`. This pushes authors toward
`setValue` — the exact silent-no-op trap. Keep the direct-assignment runtime behavior and satisfy
the type checker with a cast:

```typescript
// SDK TypeScript: direct assignment is right at runtime, but a type error — cast it
(gr as any).work_notes = auditNote;   // or: (gr as unknown as Record<string, unknown>).work_notes = auditNote
gr.update();
```

> **Optional — AIA audit dual-write.** When the journal write is an agent audit trail, ServiceNow's
> own AIA tools also insert a row into `sn_aia_agent_execution_activity` (fields: `target_table`,
> `target_record`, `agent`, `usecase`, `notes`, `notes_type`). The `agent`/`usecase` sys_ids can be
> resolved from the `_agentic_context_` the platform passes as the script's 2nd argument. Treat the
> exact field set as **(confirm on instance during build)**.

---

## Rule 3: Input Schema MUST Include "mandatory"

Without `mandatory: true`, the agent may skip collecting required inputs, leading to null values.

```javascript
// BROKEN - Agent may skip this input
[{"name": "incident_number", "type": "string"}]

// CORRECT - Forces agent to collect this input
[{"name": "incident_number", "type": "string", "mandatory": true}]
```

### Supported Schema Types

| Type | Example |
|------|---------|
| `string` | `{"name": "message", "type": "string", "mandatory": true}` |
| `number` | `{"name": "priority", "type": "number", "mandatory": false}` |
| `boolean` | `{"name": "urgent", "type": "boolean", "mandatory": false}` |
| `array` | `{"name": "items", "type": "array", "items": {"type": "string"}}` |
| `object` | `{"name": "data", "type": "object", "properties": {...}}` |

**Voice agent note:** For voice agents, use `string` type for all inputs and outputs to ensure compatibility.

---

## Rule 4: Always Include Error Handling

Every tool script must follow this pattern:

```javascript
(function(inputs) {
    var outputs = {};
    try {
        // Your logic here
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Standard Error Output Format

```javascript
{
    status: "error",
    error: "Descriptive error message",
    error_type: "not_found|validation|system"
}
```

### Standard Success Output Format

```javascript
{
    status: "success",
    data: {},  // Response data
}
```

---

## Rule 5: Performance

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Simple tool | < 100ms | < 500ms |
| GlideRecordSecure query | < 200ms | < 1s |
| Agent with 1 tool | < 500ms | < 2s |
| Agent with 3 tools | < 2s | < 5s |

**Always use `gr.setLimit()`** to prevent unbounded queries.

**Note:** GlideRecordSecure has a slight overhead compared to GlideRecord due to ACL checking. This is expected and acceptable — security takes precedence over micro-optimization.

---

## Common Tool Script Templates

### Get Single Record

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var recordId = String(inputs.incident_number || "");
        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('number', recordId);
        gr.setLimit(1);
        gr.query();

        if (gr.next()) {
            outputs.record = {
                sys_id: gr.getValue('sys_id'),
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                state: gr.getDisplayValue('state'),
                priority: gr.getDisplayValue('priority')
            };
            outputs.status = "success";
        } else {
            outputs.error = "Record not found: " + recordId;
            outputs.status = "not_found";
        }
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Query Multiple Records

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var limit = Math.min(parseInt(inputs.limit || 10), 100);
        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addActiveQuery();
        gr.setLimit(limit);
        gr.orderByDesc('sys_updated_on');
        gr.query();

        outputs.records = [];
        while (gr.next()) {
            outputs.records.push({
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                state: gr.getDisplayValue('state'),
                priority: gr.getDisplayValue('priority')
            });
        }
        outputs.count = outputs.records.length;
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Update Record (`copilot` Execution Mode)

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var incidentNumber = String(inputs.incident_number || "");
        var updates = inputs.updates || {};

        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        if (!gr.get('number', incidentNumber)) {
            outputs.error = "Incident not found: " + incidentNumber;
            outputs.status = "not_found";
            return outputs;
        }

        var updatedFields = [];
        if (updates.state) { gr.setValue('state', updates.state); updatedFields.push('state'); }
        if (updates.priority) { gr.setValue('priority', updates.priority); updatedFields.push('priority'); }
        // work_notes is a journal field — direct assignment, NOT setValue (see Rule 2a)
        if (updates.work_notes) { gr.work_notes = String(updates.work_notes); updatedFields.push('work_notes'); }

        gr.update();
        outputs.updated_fields = updatedFields;
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Voice-Compatible Tool (String-Only I/O)

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var incidentNumber = String(inputs.incident_number || "");
        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('number', incidentNumber);
        gr.setLimit(1);
        gr.query();

        if (gr.next()) {
            outputs.result = "Incident " + gr.getValue('number') +
                " is currently " + gr.getDisplayValue('state') +
                " with priority " + gr.getDisplayValue('priority') +
                ". Short description: " + gr.getValue('short_description');
            outputs.status = "success";
        } else {
            outputs.result = "No incident found with number " + incidentNumber;
            outputs.status = "not_found";
        }
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

---

## Security Best Practices

1. **Use GlideRecordSecure + addUserEncodedQuery()** in every script tool — this is mandatory, not optional
2. **Never hardcode credentials** in tool scripts
3. **Validate all inputs** before database operations
4. **Use setLimit()** to prevent unbounded queries
5. **Set execution_mode to `copilot`** for any tool that modifies data
6. **Sanitize user inputs** to prevent injection — use `String()` on all inputs
7. **Use HTTPS** for any external API calls
8. **Respect the 20-tool limit** per agent — split agents if necessary
9. **Use snake_case** for all tool internal names — CamelCase is forbidden
10. **For voice agents**, restrict input/output types to string

### Migration Checklist: GlideRecord to GlideRecordSecure

If you have existing tool scripts using `GlideRecord`, update them:

1. Replace `new GlideRecord(` with `new GlideRecordSecure(`
2. Add `gr.addUserEncodedQuery();` immediately after instantiation
3. Test that the tool still returns expected results for the user's role
4. Verify that users without access to certain records no longer see them

```javascript
// BEFORE (insecure)
var gr = new GlideRecord('incident');
gr.addQuery('priority', 1);
gr.query();

// AFTER (secure)
var gr = new GlideRecordSecure('incident');
gr.addUserEncodedQuery();
gr.addQuery('priority', 1);
gr.query();
```

---

## Quick Reference Card

| Topic | Rule |
|-------|------|
| Database API | GlideRecordSecure + addUserEncodedQuery() (mandatory) |
| Forbidden APIs | gs.* (except gs.getProperty()), GlideDateTime (undefined in the tool sandbox) |
| Tool naming | snake_case only, no CamelCase |
| Input schema | Always include `mandatory: true` for required fields |
| Error handling | try/catch with status in every script |
| Execution mode | `copilot` for writes, `autopilot` for reads |
| Max tools | 20 per agent |
| Max same-tool calls | 25 consecutive |
| Voice agents | String-only inputs and outputs |
| Performance | Always use setLimit() |

---

*Validated against ServiceNow Zurich instances. The gs.* hang behavior is a known platform characteristic of the AI Agent tool execution sandbox. GlideRecordSecure enforcement is a Zurich security requirement for all AI Agent tool scripts.*
