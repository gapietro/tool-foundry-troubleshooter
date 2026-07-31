# ServiceNow Security Patterns

This guide covers security best practices for ServiceNow development, including ACLs, roles, secure coding, and data protection.

---

## Access Control Lists (ACLs)

ACLs are the primary mechanism for controlling data access in ServiceNow.

### ACL Evaluation Order

1. **Table-level ACLs** - Checked first
2. **Field-level ACLs** - Checked for specific field access
3. **Row-level ACLs** - Additional conditions on records

### ACL Operations

| Operation | Description |
|-----------|-------------|
| `read` | View records |
| `write` | Modify records |
| `create` | Create new records |
| `delete` | Delete records |
| `execute` | Execute scripts (processors, etc.) |

### Creating Effective ACLs

```javascript
// Example: ACL script for incident table
// Only allow access to incidents in user's assignment group

var assignmentGroups = gs.getUser().getMyGroups();
var isAssigned = assignmentGroups.indexOf(current.assignment_group.toString()) > -1;
var isAdmin = gs.hasRole('admin');

answer = isAssigned || isAdmin;
```

### ACL Best Practices

1. **Principle of least privilege** - Grant minimum necessary access
2. **Use roles, not users** - Never hardcode user sys_ids
3. **Test thoroughly** - Verify with different user roles
4. **Document purpose** - Add comments explaining the logic
5. **Avoid `*` ACLs** - Be specific about tables and fields

---

## Roles and Groups

### Role Hierarchy

```
admin
├── itil
│   ├── itil_admin
│   └── incident_manager
├── catalog_admin
└── knowledge_admin
```

### Checking Roles in Scripts

```javascript
// Check single role
if (gs.hasRole('itil')) {
    // User has ITIL role
}

// Check multiple roles (any)
if (gs.hasRole('itil,admin')) {
    // User has ITIL OR admin
}

// Check multiple roles (all)
if (gs.hasRole('itil') && gs.hasRole('catalog')) {
    // User has both roles
}

// Get all user roles
var roles = gs.getUser().getRoles();
gs.info('User roles: ' + roles.toString());
```

### Creating Custom Roles

1. Name with application prefix: `x_myapp_admin`
2. Document the role's purpose
3. Include in appropriate role hierarchy
4. Test with dedicated test users

---

## Secure Coding Practices

### Input Validation

```javascript
// Always validate and sanitize input
function processInput(input) {
    // Check for null/undefined
    if (!input) {
        throw new Error('Input is required');
    }

    // Validate type
    if (typeof input !== 'string') {
        throw new Error('Input must be a string');
    }

    // Sanitize - remove potential script injection
    var sanitized = input.replace(/<[^>]*>/g, '');

    // Validate length
    if (sanitized.length > 1000) {
        throw new Error('Input exceeds maximum length');
    }

    return sanitized;
}
```

### Preventing SQL/GlideRecord Injection

```javascript
// BAD - Direct string concatenation
var table = request.getParameter('table');
var gr = new GlideRecord(table); // Dangerous!

// GOOD - Validate against whitelist
var allowedTables = ['incident', 'problem', 'change_request'];
var table = request.getParameter('table');

if (allowedTables.indexOf(table) === -1) {
    throw new Error('Invalid table');
}
var gr = new GlideRecord(table); // Safe
```

### Encoding Output

```javascript
// Encode HTML output to prevent XSS
var userInput = current.description;
var safeOutput = GlideStringUtil.escapeHTML(userInput);

// Encode for JavaScript context
var jsOutput = GlideStringUtil.escapeScript(userInput);

// Encode for URL parameters
var urlOutput = encodeURIComponent(userInput);
```

### Secure Script Includes

```javascript
var SecureHelper = Class.create();
SecureHelper.prototype = {
    initialize: function() {
        // Validate caller has appropriate access
        if (!gs.hasRole('x_myapp_user')) {
            throw new Error('Access denied');
        }
    },

    // Always validate parameters
    getData: function(recordId) {
        if (!this._isValidSysId(recordId)) {
            throw new Error('Invalid record ID');
        }

        var gr = new GlideRecord('my_table');
        if (gr.get(recordId)) {
            return this._sanitizeRecord(gr);
        }
        return null;
    },

    _isValidSysId: function(sysId) {
        return sysId && /^[a-f0-9]{32}$/.test(sysId);
    },

    _sanitizeRecord: function(gr) {
        // Return only safe fields
        return {
            sys_id: gr.getUniqueValue(),
            name: gr.getValue('name'),
            description: GlideStringUtil.escapeHTML(gr.getValue('description'))
        };
    },

    type: 'SecureHelper'
};
```

---

## Data Protection

### Sensitive Data Handling

```javascript
// Never log sensitive data
gs.info('Processing user: ' + user.sys_id); // OK
gs.info('Password: ' + password); // NEVER DO THIS

// Mask sensitive fields in logs
function maskField(value) {
    if (!value || value.length < 4) return '****';
    return value.substring(0, 2) + '****' + value.substring(value.length - 2);
}

gs.info('Processing card: ' + maskField(cardNumber)); // OK
```

### Encryption

```javascript
// Use platform encryption for sensitive data
var encrypter = new GlideEncrypter();

// Encrypt
var encrypted = encrypter.encrypt('sensitive data');

// Decrypt (only when necessary)
var decrypted = encrypter.decrypt(encrypted);
```

### Secure Properties

```javascript
// Store secrets in system properties, not code
var apiKey = gs.getProperty('x_myapp.api_key');

// Use password2 field type for sensitive properties
// These are encrypted at rest
```

---

## API Security

### REST API Authentication

```javascript
// Validate API authentication in Scripted REST API
(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {

    // Check authentication
    if (!gs.getUser().getID()) {
        response.setStatus(401);
        return { error: 'Authentication required' };
    }

    // Check authorization
    if (!gs.hasRole('x_myapp_api_user')) {
        response.setStatus(403);
        return { error: 'Insufficient permissions' };
    }

    // Process request...

})(request, response);
```

### Rate Limiting

```javascript
// Implement basic rate limiting
var RateLimiter = Class.create();
RateLimiter.prototype = {
    initialize: function(maxRequests, windowSeconds) {
        this.maxRequests = maxRequests || 100;
        this.windowSeconds = windowSeconds || 60;
    },

    isAllowed: function(userId) {
        var key = 'rate_limit_' + userId;
        var gr = new GlideRecord('x_myapp_rate_limit');
        gr.addQuery('user_key', key);
        gr.addQuery('window_start', '>=', gs.secondsAgo(this.windowSeconds));
        gr.query();

        if (gr.getRowCount() >= this.maxRequests) {
            return false;
        }

        // Record this request
        var newGr = new GlideRecord('x_myapp_rate_limit');
        newGr.initialize();
        newGr.user_key = key;
        newGr.window_start = new GlideDateTime();
        newGr.insert();

        return true;
    },

    type: 'RateLimiter'
};
```

---

## Security Checklist

### Before Deployment

- [ ] All inputs validated and sanitized
- [ ] Outputs properly encoded
- [ ] ACLs configured for all tables/fields
- [ ] Roles follow least privilege principle
- [ ] No hardcoded credentials or secrets
- [ ] Sensitive data encrypted
- [ ] API endpoints authenticated/authorized
- [ ] Error messages don't leak sensitive info
- [ ] Logging doesn't include sensitive data
- [ ] Cross-scope access properly controlled

### Code Review Items

- [ ] GlideRecord queries use parameterized values
- [ ] No eval() or similar dynamic code execution
- [ ] User input never directly used in queries
- [ ] Session tokens properly validated
- [ ] CSRF protection on forms
- [ ] File uploads validated and restricted

---

## Common Vulnerabilities

### 1. Insecure Direct Object Reference

```javascript
// BAD - Direct access without authorization check
var gr = new GlideRecord('sensitive_table');
gr.get(request.getParameter('id')); // Anyone can access any record!

// GOOD - Verify access rights
var gr = new GlideRecord('sensitive_table');
gr.addQuery('sys_id', request.getParameter('id'));
gr.query(); // ACLs will filter unauthorized records
```

### 2. Cross-Site Scripting (XSS)

```javascript
// BAD - Unescaped output
document.innerHTML = current.description;

// GOOD - Escaped output
document.textContent = current.description;
// Or use GlideStringUtil.escapeHTML() server-side
```

### 3. Information Disclosure

```javascript
// BAD - Detailed error messages
catch (e) {
    return { error: e.message + '\n' + e.stack }; // Leaks internal details
}

// GOOD - Generic error messages
catch (e) {
    gs.error('Internal error: ' + e.message); // Log details server-side
    return { error: 'An error occurred. Please contact support.' };
}
```

---

## AI Agent Security (Zurich)

### AI-Specific Roles

| Role | Description |
|------|-------------|
| `sn_aia.admin` | Full CRUD on all AI agent records |
| `sn_aia.viewer` | Read-only + report access on all AI tables |
| `agent_role_config_admin` | Access/modify Agent role configurations |
| `agent_role_config_viewer` | View Agent role configurations |
| `sn_mcp_client.admin` | MCP Client admin |
| `sn_mcp_client.viewer` | MCP Client read-only |
| `sn_voice_aia.admin` | Voice agent configuration access |

### Role Prerequisites Mapping

This section maps which roles unlock access to which table groups. An admin user without the correct AI-specific roles will be blocked from agent and skill tables.

| Role | Tables Unlocked | Access Level | Required For |
|------|----------------|--------------|--------------|
| `sn_aia.admin` | `sn_aia_agent`, `sn_aia_tool`, `sn_aia_agent_tool_m2m`, `sn_aia_usecase`, `sn_aia_strategy`, `sn_aia_team`, `sn_aia_team_member`, `sn_aia_trigger_configuration`, `sn_aia_agent_config`, `sn_aia_execution_plan`, `sn_aia_execution_task`, `sn_aia_tools_execution`, `sn_aia_message`, `sn_aia_property` | Full CRUD | Agent creation, tool management, execution monitoring, property configuration |
| `sn_aia.viewer` | Same `sn_aia_*` tables as above | Read-only | Agent discovery, viewing configurations, reading execution logs, reporting |
| `agent_role_config_admin` | `sys_agent_access_role_configuration` | Full CRUD | Configuring which user roles can access which agents |
| `agent_role_config_viewer` | `sys_agent_access_role_configuration` | Read-only | Viewing agent role assignments |
| `now_assist_admin` | `sn_nowassist_skill_config`, `sys_one_extend_capability`, `sys_one_extend_capability_definition`, `sys_one_extend_definition_config`, `sys_one_extend_definition_attribute`, `sys_generative_ai_config` | Full CRUD | Now Assist skill configuration, capability registration, LLM prompt management |
| `sn_mcp_client.admin` | `sn_mcp_server`, `sn_mcp_client_server_session_mapping`, `sn_mcp_execution_logs` | Full CRUD | MCP server registration, session management, execution log review |
| `sn_mcp_client.viewer` | Same `sn_mcp_*` tables as above | Read-only | Viewing MCP server configurations and logs |
| `sn_voice_aia.admin` | Voice agent tables (`sn_voice_aia_*`) | Full CRUD | Voice agent configuration and deployment |

**Common Access Denied Scenarios:**

| Symptom | Missing Role | Fix |
|---------|-------------|-----|
| Cannot create/edit agents in Agent Studio | `sn_aia.admin` | Assign `sn_aia.admin` to the user |
| Cannot view agent execution history | `sn_aia.viewer` (minimum) | Assign `sn_aia.viewer` or `sn_aia.admin` |
| Agent tool API returns 403 | `sn_aia.admin` | Assign `sn_aia.admin`; base `admin` alone is not sufficient |
| Cannot register MCP servers | `sn_mcp_client.admin` | Assign `sn_mcp_client.admin` |
| Cannot configure Now Assist skills | `now_assist_admin` | Assign `now_assist_admin` |
| GenAI Controller tables not accessible | `admin` + GenAI plugin not activated | Activate `com.sn.generative.ai` plugin |
| Cannot modify agent role assignments | `agent_role_config_admin` | Assign `agent_role_config_admin` |

**Verification Script:**
```javascript
// Check if current user has required AI roles
var requiredRoles = ['sn_aia.admin', 'now_assist_admin', 'sn_mcp_client.admin'];
var missingRoles = [];

for (var i = 0; i < requiredRoles.length; i++) {
    if (!gs.hasRole(requiredRoles[i])) {
        missingRoles.push(requiredRoles[i]);
    }
}

if (missingRoles.length > 0) {
    gs.info('Missing AI roles: ' + missingRoles.join(', '));
} else {
    gs.info('All required AI roles are assigned.');
}
```

**Important Notes:**
- The base `admin` role does NOT automatically grant access to `sn_aia_*` tables. The `sn_aia.admin` role is required separately.
- Role requirements vary by ServiceNow version. On pre-Zurich instances, some tables may be accessible with fewer role requirements.
- For programmatic access via REST API, the authenticating user must have the appropriate roles listed above.

### GlideRecordSecure in AI Agent Scripts

**CRITICAL:** AI agent tool scripts MUST use `GlideRecordSecure` (not `GlideRecord`) and MUST call `addUserEncodedQuery()`:

```javascript
// ❌ WRONG — bypasses user ACLs
var gr = new GlideRecord('incident');
gr.query();

// ✅ CORRECT — enforces user permissions
var gr = new GlideRecordSecure('incident');
gr.addUserEncodedQuery();
gr.query();
```

### Role Masking (6-Step Evaluation Chain)

When an AI agent executes, access is evaluated through:

1. **User identity** — Who initiated the request
2. **Agent role configuration** — Roles assigned to the agent
3. **ACL evaluation** — Access Control Lists on target tables/records
4. **Role masking** — Intersection of user roles and agent roles
5. **Dynamic user query** — `addUserEncodedQuery()` enforcement
6. **Data access** — Final permission determination

### Agent Security Models

| Model | Description | When to Use |
|-------|-------------|-------------|
| **Dynamic user** | User passes roles to agent, ACLs determine access | Default and recommended |
| **AI user** | Agent runs with dedicated service account | Service-to-service automation |
| **Specific roles** | Agent limited to assigned roles only | Restricted access scenarios |
| **Public** | Any authenticated user can trigger | Low-risk, broad-access tools |

### Now Assist Guardian

Guardian monitors AI inputs/outputs across 16 safety categories including offensive content, prompt injection, jailbreak attempts, PII exposure, credential exposure, and code injection. See `now-assist-guardian-governance.md` for full details.

---

## Related Resources

- [Now Assist Platform](./now-assist-platform.md) - Platform security features
- [Troubleshooting Guide](./troubleshooting-guide.md) - Security debugging
- ServiceNow Security Best Practices documentation

---

*Part of the Foundry golden repository*
