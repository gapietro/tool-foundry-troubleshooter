# Example: Debugging a Now Assist Skill Failure

This example shows how to debug a Now Assist skill that isn't responding to user requests.

---

## Scenario

A user reports: "The 'Create Incident' skill in Now Assist isn't working. When I ask it to create an incident, nothing happens."

---

## Investigation Steps

### 1. Check Recent Skill Execution Logs

```
servicenow_aia_logs agentName="Create Incident" timeRange="1h" limit=20
```

**What to look for:**
- Failed executions
- Error messages
- Input parameters

### 2. Check System Logs for Errors

```
servicenow_syslogs source="GenAI" level="error" timeRange="1h"
```

**What to look for:**
- Script errors
- Null pointer exceptions
- Configuration errors

### 3. Verify Skill Configuration

```
servicenow_script script="
// Zurich: sn_nowassist_skill_config (legacy sn_gai_skill is absent on Zurich)
var skill = new GlideRecord('sn_nowassist_skill_config');
skill.addQuery('name', 'CONTAINS', 'Create Incident');
skill.query();
while (skill.next()) {
    gs.info('Name: ' + skill.name);
    gs.info('State: ' + skill.state);
    gs.info('Sys ID: ' + skill.sys_id);
}
" mode="readonly"
```

### 4. Check User Permissions

```
servicenow_script script="
var user = gs.getUser();
gs.info('Current user: ' + user.getName());
gs.info('Has itil role: ' + gs.hasRole('itil'));
gs.info('Has sn_aia.admin role: ' + gs.hasRole('sn_aia.admin'));
" mode="readonly"

Then compare against the roles actually configured on the skill — skill visibility is governed by the skill's own security controls (user access roles), not a single global role.
```

---

## Common Findings

### Finding 1: Skill is Inactive

**Symptom:** Skill query shows a `state` that is not active

**Solution:** Activate the skill in the Now Assist Admin console (Now Assist Features).

### Finding 2: Missing Role

**Symptom:** User lacks a role listed in the skill's security controls (user access roles)

**Solution:** Add the required role to the user or their group, or extend the skill's user access configuration.

### Finding 3: Script Error in Skill

**Symptom:** Error logs show "TypeError: Cannot read property..."

**Solution:** Review the skill script for null checks and error handling.

### Finding 4: NLU Not Trained

**Symptom:** No executions found, skill is active

**Solution:** Retrain the NLU model to recognize the skill's intents.

---

## Resolution Template

After investigating, report findings like this:

```
## Investigation Summary

**Issue:** Create Incident skill not responding

**Root Cause:** [Describe what you found]

**Evidence:**
- Log entry: [relevant log]
- Script output: [diagnostic result]

**Recommended Fix:**
1. [Step 1]
2. [Step 2]

**Verification:**
- [How to verify the fix worked]
```

---

*Part of the servicenow-troubleshooting skill*
