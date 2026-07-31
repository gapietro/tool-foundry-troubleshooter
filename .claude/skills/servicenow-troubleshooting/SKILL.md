---
name: servicenow-troubleshooting
description: This skill teaches Claude how to debug ServiceNow issues using system logs, AI Agent execution traces, and background scripts.
scope: project
recommended: false
version: 1.0.0
---
# ServiceNow Troubleshooting Skill

This skill teaches Claude how to debug ServiceNow issues using system logs, AI Agent execution traces, and background scripts.

> **Runtime tooling:** The `servicenow_*` tool names in this document are the Foundry MCP server's runtime tools. Treat them as capabilities — "execute an agent", "read an execution trace", "query a table" — and map them to the equivalents of whatever MCP server is connected. With no MCP server, fall back to manual verification: test in the Now Assist panel / AI Agent Studio and read execution traces from `sn_aia_execution_plan` / `sn_aia_execution_task`; query data via list views or a user-run background script.

---

## Purpose

Use this skill when you need to:
- Debug Now Assist skill failures
- Investigate AI Agent execution issues
- Analyze system logs for errors
- Run diagnostic scripts safely
- Trace execution flows

---

## Available Tools

When connected to a ServiceNow instance via the MCP server, you have access to:

| Tool | Purpose |
|------|---------|
| `servicenow_syslogs` | Query system logs with filters |
| `servicenow_aia_logs` | Get AI Agent execution traces |
| `servicenow_query` | Run GlideRecord-style queries |
| `servicenow_script` | Execute background scripts |
| `servicenow_instance` | Get instance info and health |

---

## Troubleshooting Workflow

### Step 1: Understand the Problem

Ask clarifying questions:
- What is the expected behavior?
- What is the actual behavior?
- When did the issue start?
- Is it reproducible? How?
- Any recent changes?

### Step 2: Check System Logs

```
servicenow_syslogs level="error" timeRange="1h" limit=50
```

Look for:
- Error messages matching the issue
- Stack traces
- Timing correlations

### Step 3: Check AI Agent Logs (for Now Assist issues)

```
servicenow_aia_logs status="failure" timeRange="1h"
```

Review:
- Failed executions
- Skill invocation errors
- Input/output mismatches

### Step 4: Run Diagnostic Queries

```
servicenow_query table="incident" query="priority=1" fields="number,short_description,state" limit=10
```

Verify:
- Data exists as expected
- Relationships are intact
- Configuration is correct

### Step 5: Test with Background Scripts

Use read-only scripts first:
```
servicenow_script script="gs.info('Test')" mode="readonly"
```

For mutations (with caution):
```
servicenow_script script="..." mode="execute"
```

---

## Common Issues and Solutions

### Now Assist Skill Not Triggering

**Investigation steps:**
1. Check if skill is active
2. Verify NLU training (if applicable)
3. Check skill logs for errors
4. Verify user has appropriate roles

**Diagnostic script:**
```javascript
// Zurich: sn_nowassist_skill_config. The legacy sn_gai_skill table only exists
// on Vancouver/Washington-era instances — probe before querying.
var skill = new GlideRecord('sn_nowassist_skill_config');
skill.addQuery('name', 'CONTAINS', 'SkillName');
skill.query();
while (skill.next()) {
    gs.info('Skill: ' + skill.name);
    gs.info('State: ' + skill.state); // 'active' column is deprecated on Zurich
    gs.info('Family: ' + skill.skill_family.getDisplayValue());
}
```

### AI Agent Execution Failing

**Investigation steps:**
1. Get execution ID from logs
2. Check execution steps
3. Review tool configurations
4. Verify permissions

**Query execution details:**
```javascript
// Failures surface as state=terminated + a state_reason — there is no 'failed' state
var exec = new GlideRecord('sn_aia_execution_plan');
exec.addQuery('sys_created_on', '>=', gs.hoursAgo(1));
exec.addQuery('state', 'terminated');
exec.query();
while (exec.next()) {
    gs.info('ID: ' + exec.sys_id);
    gs.info('Reason: ' + exec.state_reason);
    gs.info('Objective: ' + exec.objective);
}
```

### Slow Performance

**Investigation steps:**
1. Check for large result sets
2. Look for N+1 query patterns
3. Verify indexes exist
4. Check for synchronous external calls

**Performance check script:**
```javascript
var start = new Date().getTime();
// Your query here
var gr = new GlideRecord('incident');
gr.query();
var count = gr.getRowCount();
var elapsed = new Date().getTime() - start;
gs.info('Query returned ' + count + ' records in ' + elapsed + 'ms');
```

### ACL/Permission Issues

**Investigation steps:**
1. Check user roles
2. Review table ACLs
3. Test with different users
4. Check scope access

**Permission check script:**
```javascript
var user = gs.getUser();
gs.info('User: ' + user.getName());
gs.info('Roles: ' + user.getRoles());

var gr = new GlideRecord('target_table');
gr.addQuery('sys_id', 'record_sys_id');
gr.query();
gs.info('Can read: ' + gr.canRead());
gs.info('Can write: ' + gr.canWrite());
```

---

## Safety Guidelines

### Always Safe Operations
- Reading system logs
- Querying records (SELECT)
- Getting instance info
- Read-only background scripts

### Requires Caution
- Scripts that modify data
- Bulk operations
- Workflow/flow changes
- Configuration changes

### Never Without Approval
- Delete operations
- Bulk updates/deletes
- Schema changes
- Security configuration changes

---

## Best Practices

1. **Start with logs** - Always check syslogs and execution logs first
2. **Read before write** - Query data before attempting modifications
3. **Use limits** - Always limit query results
4. **Test incrementally** - Run small tests before large operations
5. **Document findings** - Note what you discovered and tried
6. **Escalate when needed** - Some issues require admin access

---

## Example Prompts

> "Check for errors in the last hour related to the catalog skill"

> "Why is the incident creation AI agent failing?"

> "Find all P1 incidents created today that are unassigned"

> "Check if the MyScriptInclude script is active"

> "What's the instance version and health status?"

---

## Related Resources

- [Troubleshooting Guide](../../context/troubleshooting-guide.md)
- [Security Patterns](../../context/security-patterns.md)
- [Now Assist Platform](../../context/now-assist-platform.md)

---

*Part of the Foundry golden repository*
