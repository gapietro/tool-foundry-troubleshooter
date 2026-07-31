# ServiceNow Troubleshooting Guide

This guide covers common debugging patterns, diagnostic tools, and troubleshooting workflows for ServiceNow and Now Assist development.

---

## System Logs (syslog)

System logs are the primary debugging tool for server-side issues.

### Accessing Syslogs

```javascript
// Log levels in order of severity
gs.debug('Debug message');      // Level: Debug (most verbose)
gs.info('Info message');        // Level: Info
gs.warn('Warning message');     // Level: Warning
gs.error('Error message');      // Level: Error (most severe)
```

### Syslog Table Structure

| Field | Description |
|-------|-------------|
| `sys_created_on` | Timestamp of log entry |
| `level` | Log level (0=Debug, 1=Info, 2=Warning, 3=Error) |
| `message` | Log message content |
| `source` | Script or source that generated the log |
| `sys_id` | Unique identifier |

### Filtering Syslogs

```javascript
// Query recent errors
var gr = new GlideRecord('syslog');
gr.addQuery('level', '>=', 2); // Warning and above
gr.addQuery('sys_created_on', '>=', gs.daysAgo(1));
gr.orderByDesc('sys_created_on');
gr.setLimit(100);
gr.query();
```

### Best Practices

1. **Use meaningful prefixes** - Tag logs with component names
   ```javascript
   gs.info('[MySkill] Processing request: ' + requestId);
   ```

2. **Log entry and exit points** - Track execution flow
   ```javascript
   gs.debug('[MySkill] START: processInput');
   // ... logic ...
   gs.debug('[MySkill] END: processInput, result=' + result);
   ```

3. **Avoid logging sensitive data** - Never log passwords, tokens, or PII

4. **Use appropriate levels** - Reserve error for actual failures

---

## AI Agent (AIA) Execution Logs

For debugging Now Assist and AI Agent issues.

### Key Tables

| Table | Purpose |
|-------|---------|
| `sn_aia_execution_plan` | Root record per execution — `state`, `state_reason`, `objective`, latency/token fields |
| `sn_aia_execution_task` | Per-step records within a plan — `type` = `manager`/`agent`/`tool`/`gen_ai`/`communicator`/`access_verification`; no agent reference field, agent identity lives in `description` + `metadata` (query by `execution_plan`, order by `order`) |
| `sn_aia_tools_execution` | Per-tool-call records — `request`/`response` payloads, `is_error`, `error_message` |
| `sn_aia_message` | Conversation and system messages, with `error_type` failure classification |
| `sys_gen_ai_log_metadata` | One record per LLM call — token counts, model, status, link to `sys_generative_ai_log` |

Table names verified on gpinst01 (Zurich Patch 10). Full schemas in [ServiceNow AI Data Model](./servicenow-ai-data-model.md).

### Querying AIA Logs

```javascript
// Get recent AI Agent executions
var gr = new GlideRecord('sn_aia_execution_plan');
gr.addQuery('sys_created_on', '>=', gs.hoursAgo(1));
gr.orderByDesc('sys_created_on');
gr.query();

while (gr.next()) {
    gs.info('Execution: ' + gr.sys_id);
    gs.info('State: ' + gr.state + ' (' + gr.state_reason + ')');
    gs.info('Objective: ' + gr.objective);
    gs.info('Agent: ' + gr.agent.getDisplayValue());
}
```

### Execution States

`sn_aia_execution_plan.state` choices (verified gpinst01, Zurich P10):

| State | Meaning |
|-------|---------|
| `queued` / `ready` | Waiting to start |
| `in_progress` | Currently executing |
| `wrap_up` | Finishing up |
| `completed` | Finished |
| `terminated` | Ended abnormally — read `state_reason` for the failure class |
| `abandoned` / `deleted` | Run abandoned, or record deleted |

There is **no `failed` state** — failures surface as `terminated` plus a `state_reason` (`security_violation`, `planning_failed`, `execution_failed`, `no_activity`, `fallback_redirected`, `live_agent_requested`, `user_exited`).

### Debugging Failed Executions

1. Read `state_reason` on the plan — it names the failure class (e.g. `security_violation` means the run-as user failed the agent's access checks)
2. Find the first `status=error` step in `sn_aia_execution_task` — `status` choices are `queued`/`ready`/`ongoing`/`success`/`error`/`cancelled`, there is no `failed` (query by `execution_plan`, order by the `order` integer — `sys_created_on` has one-second resolution, so ties sort arbitrarily)
3. Check `sn_aia_tools_execution` for the plan — `is_error`, `error_message`, and the `request`/`response` payloads
4. Check `sn_aia_message.error_type` (`tool_failure`, `llm_error`, `permission_denied`, `retry_limit`, …) and `sys_gen_ai_log_metadata` for failed LLM calls

---

## Background Script Debugging

### Safe Debugging Pattern

```javascript
// Always wrap in try-catch for background scripts
try {
    var result = myFunction();
    gs.info('Result: ' + JSON.stringify(result));
} catch (e) {
    gs.error('Error: ' + e.message);
    gs.error('Stack: ' + e.stack);
}
```

### Read-Only Testing

```javascript
// Test queries without modifying data
var gr = new GlideRecord('incident');
gr.addQuery('priority', 1);
gr.setLimit(5);
gr.query();

gs.info('Found ' + gr.getRowCount() + ' P1 incidents');
while (gr.next()) {
    gs.info('  - ' + gr.number + ': ' + gr.short_description);
}
// No insert/update/delete = safe to run
```

### Avoiding Dangerous Operations

Never run these without explicit approval:
- `gr.deleteMultiple()` - Bulk delete
- `gr.updateMultiple()` - Bulk update
- `GlideRecord.deleteRecord()` - Single delete
- Direct table truncation
- Workflow/flow modifications

---

## Common Issues and Solutions

### 1. Script Include Not Found

**Symptom:** `TypeError: Cannot call method of null`

**Causes:**
- Script Include not active
- Incorrect API name
- Scope issues (cross-scope access)

**Solution:**
```javascript
// Check if Script Include exists
var si = new GlideRecord('sys_script_include');
si.addQuery('api_name', 'MyScriptInclude');
si.query();
if (si.next()) {
    gs.info('Found: ' + si.api_name + ', Active: ' + si.active);
} else {
    gs.error('Script Include not found');
}
```

### 2. ACL Blocking Access

**Symptom:** Empty results or "no access" errors

**Debug:**
```javascript
// Check user roles
var roles = gs.getUser().getRoles();
gs.info('User roles: ' + roles);

// Test with elevated privileges (debug only!)
var gr = new GlideRecord('table_name');
gr.addQuery('field', 'value');
gs.info('Before: ' + gr.canRead());
```

### 3. Slow Script Performance

**Symptom:** Timeouts or slow execution

**Common causes:**
- Missing indexes on query fields
- N+1 query patterns
- Large result sets without limits

**Solution:**
```javascript
// Bad: N+1 queries
incidents.forEach(function(inc) {
    var user = getUserDetails(inc.assigned_to); // Query per record!
});

// Good: Batch query
var userIds = incidents.map(function(inc) { return inc.assigned_to; });
var users = getUserDetailsBatch(userIds); // Single query
```

### 4. Now Assist Skill Not Responding

**Checklist:**
1. Is the skill active?
2. Are required properties configured?
3. Check GenAI Controller logs
4. Verify NLU model is trained (if applicable)
5. Check skill execution logs

```javascript
// Check skill configuration. Zurich: sn_nowassist_skill_config — the legacy
// sn_gai_skill table only exists on Vancouver/Washington-era instances (absent
// on Zurich; probe before querying, see servicenow-ai-data-model.md §20)
var skill = new GlideRecord('sn_nowassist_skill_config');
skill.addQuery('name', 'MySkill');
skill.query();
if (skill.next()) {
    gs.info('State: ' + skill.state); // the 'active' column is deprecated on Zurich
    gs.info('Family: ' + skill.skill_family.getDisplayValue());
}
```

### 5. Trigger Configuration: `trigger_flow` Not Populated After SDK Install

**Symptom:** Immediately after `now-sdk install`, an `sn_aia_trigger_configuration` record has an
empty `trigger_flow`, and the workflow does not fire on record events.

**Cause:** `trigger_flow` is generated **asynchronously**. The "Create Flow Trigger Action" business
rule (async_always, on insert → `AIATriggerScopedUtil.createFlowTriggerAction()`, Global scope)
writes it after the record commits — it is **not** set synchronously during install, so it may be
null for a few seconds.

**Also expected (not a bug):** `business_rule` stays null for record triggers — it appears
platform-reserved and is observed unpopulated for all current trigger types. Do **not** wait for it
to populate.

**Resolution:**
1. Wait a few seconds and re-query — async generation often completes on its own.
2. Verify the four `sn_aia` trigger BRs are active: **Create Flow Trigger Action**,
   **Update Flow Trigger Action**, **Delete Flow Trigger Action**, **Process AIA trigger**.
3. Check the async worker queue (`sys_trigger` / background workers) for stalled async jobs.
4. Re-save the trigger config in the UI to re-fire the BR.
5. If triggers silently fail to **activate**, check the **"Block trigger config active change"**
   before-BR — it aborts active-field saves on license-restricted instances.

---

## Debugging Workflows

### 1. Identify the Issue

- Reproduce the problem consistently
- Note exact error messages
- Identify affected scope/application

### 2. Gather Information

- Check system logs (filter by time and source)
- Review execution logs for async operations
- Check user permissions and roles

### 3. Isolate the Problem

- Test in background script with minimal code
- Remove complexity until issue disappears
- Add back components to find the cause

### 4. Fix and Verify

- Implement fix in development instance
- Test thoroughly before promoting
- Document the issue and solution

---

## Useful Diagnostic Scripts

### Check Table Record Counts

```javascript
var tables = ['incident', 'sc_request', 'syslog'];
tables.forEach(function(table) {
    var gr = new GlideRecord(table);
    gr.query();
    gs.info(table + ': ' + gr.getRowCount() + ' records');
});
```

### Find Recent Script Errors

```javascript
var gr = new GlideRecord('syslog');
gr.addQuery('level', 3); // Errors only
gr.addQuery('sys_created_on', '>=', gs.hoursAgo(1));
gr.orderByDesc('sys_created_on');
gr.setLimit(20);
gr.query();

while (gr.next()) {
    gs.info('[' + gr.sys_created_on + '] ' + gr.message.substring(0, 200));
}
```

### Check Active Sessions

```javascript
var gr = new GlideRecord('v_user_session');
gr.query();
gs.info('Active sessions: ' + gr.getRowCount());
```

---

## Related Resources

- [Now Assist Platform](./now-assist-platform.md) - Platform architecture
- [GenAI Framework](./genai-framework.md) - Skill development
- [Agentic Patterns](./agentic-patterns.md) - Agent debugging

---

*Part of the Foundry golden repository*
