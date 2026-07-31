# Now Assist Platform Context

> This document provides essential context about the Now Assist platform for POC development.

---

## Overview

Now Assist is ServiceNow's generative AI capability that brings large language models (LLMs) into the ServiceNow platform. It provides AI-powered assistance across various workflows including IT Service Management, Customer Service, HR, and custom applications.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Now Assist Layer                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Now Assist  │  │   Skills    │  │  One Extend         │ │
│  │   Panel     │  │  Registry   │  │  (skill execution)  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                 ServiceNow Platform                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Tables    │  │  Workflows  │  │    Integrations     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Services

| Service | Purpose |
|---------|---------|
| **One Extend** (`sn_one_extend.OneExtendUtil`) | Skill execution engine — routes a capability request to its bound model and returns the result |
| **Skills Registry** | Stores and manages Now Assist skills |
| **Now Assist Panel** | UI component for user interaction |
| **Prompt Templates** | Reusable prompt structures |

## Capabilities

### Out-of-Box Features

1. **Case/Incident Summarization**
   - Summarizes ticket history and comments
   - Identifies key information and action items

2. **Knowledge Article Generation**
   - Creates articles from resolved incidents
   - Formats content for knowledge base

3. **Chat Assistance**
   - Virtual agent conversations
   - Context-aware responses

4. **Code Generation**
   - Script generation for ServiceNow
   - Business rule and flow assistance

### Custom Skills

Now Assist can be extended with custom skills for domain-specific use cases. See `genai-framework.md` for skill development patterns.

## Now Assist Skill Catalog (Zurich)

ServiceNow Zurich ships with 100+ out-of-box Now Assist skills across workflows:

### Technology Workflows (ITSM)
- Incident summarization, resolution notes
- Change risk assessment
- Problem root cause analysis
- Knowledge article generation from incidents
- Alert correlation and grouping

### Customer Workflows (CSM)
- Case summarization
- Customer sentiment analysis
- Response generation
- Case routing recommendations

### Employee Workflows (HRSD)
- HR case summarization
- Policy Q&A
- Onboarding assistance

### Creator Workflows
- Code generation assistance
- Flow Designer assistance
- App Engine Studio suggestions

### Platform
- Search enhancement
- Virtual Agent conversation AI
- Now Assist Panel interactions

## Now Assist Admin (5-Step Workflow)

Navigation: All > Now Assist Admin

1. **Setup** — Configure LLM provider and connection
2. **Skills** — Enable/disable skills per application
3. **Panel** — Configure Now Assist panel appearance and behavior
4. **Context Menu** — Set up context menu items for Now Assist
5. **Analytics** — Review usage, quality, and performance metrics

## Key Plugins

| Plugin | API Name | Description |
|--------|----------|-------------|
| Now Assist for Platform | `sn_genai_platform` | Base plugin, auto-installed with any Now Assist product |
| Generative AI Controller | `com.sn.generative.ai` | Central skill execution engine |
| Now Assist AI Agents | `sn_aia` | AI Agent Studio |
| MCP Client | `sn_mcp_client` | External MCP server integration |
| ITSM AI Voice Agents | `sn_itsm_voice_aia` | Voice agents for ITSM |
| HR Voice AI Agents | `sn_hr_voice_aia` | Voice agents for HR |

## Programmatic Skill Invocation

> **Verified path (Zurich Patch 8):** Skills are invoked through **One Extend**, not a `sn_genai.GenAIController`. The class is `sn_one_extend.OneExtendUtil.execute()`, the REST endpoint is `/api/now/v1/oneextend/scripted/setup_and_execute`, and the request envelope wraps one or more `executionRequests`, each carrying a `payload` and a `capabilityId`. There is **no `/api/now/genai/controller/execute` endpoint and no `sn_genai.GenAIController` class** on a real instance (the former 404s, the latter is undefined).

```javascript
// Server-side skill invocation via One Extend
var request = {
    executionRequests: [
        {
            capabilityId: 'skill_capability_sys_id', // sys_one_extend_capability sys_id
            payload: {
                field1: 'value1',
                field2: 'value2'
            },
            meta: { skillConfigId: 'skill_config_sys_id' } // Now Assist Skill Kit skill-config sys_id
        }
    ]
};
// execute() and executeSecure() both exist; prefer executeSecure() in scoped/ACL-sensitive contexts.
var result = sn_one_extend.OneExtendUtil.executeSecure(request);
```

> **Two IDs:** `capabilityId` (`sys_one_extend_capability.sys_id`) selects the model-bound capability;
> `meta.skillConfigId` (the Now Assist Skill Kit skill-config `sys_id`) selects which skill
> configuration of that capability to run. Platform code that targets a specific skill configuration
> passes both. See `skills/now-assist-skill-builder/SKILL.md` → Programmatic Skill Invocation.

## API Reference

### One Extend Skill Execution API

**Endpoint:** `/api/now/v1/oneextend/scripted/setup_and_execute`

**Method:** POST

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "executionRequests": [
    {
      "capabilityId": "summarize_case_capability_sys_id",
      "payload": {
        "case_sys_id": "abc123",
        "include_comments": true
      }
    }
  ]
}
```

> The model and token budget are bound **per One Extend capability definition** (`sys_one_extend_capability_definition.connection`, via a GenAI alias such as `sn_generative_ai.Now_LLM`) — `sys_one_extend_capability` itself has no model field. They are not passed as ad-hoc `options` on the request, and there is no instance-wide model/temperature/`max_tokens` override on this call.

**Response:** a `capabilities` object keyed by `capabilityId`; read `response.capabilities[<capabilityId>]`, where each entry carries the capability's execution status and output. Read the per-capability result rather than a single top-level `result` object.

### Skill Invocation Patterns

**Direct Invocation (Server-side):**
```javascript
var result = sn_one_extend.OneExtendUtil.executeSecure({
    executionRequests: [
        { capabilityId: 'capability_sys_id', payload: { input_field: 'value' },
          meta: { skillConfigId: 'skill_config_sys_id' } }
    ]
});
```

**Flow Designer:** use the **Now Assist / One Extend** action to execute a capability, mapping record fields into the capability `payload` and reading the capability output downstream.

## Skill Execution Activation Prerequisites

Skill execution runs through **One Extend** — `sn_one_extend.OneExtendUtil.execute()` (server-side) and the `/api/now/v1/oneextend/scripted/setup_and_execute` REST endpoint — which become available once the Now Assist platform plugins are activated. (Legacy `sn_genai.GenAIController` / `/api/now/genai/controller/execute` references are **not present on a current instance** and should not be used.)

### Required Plugins

| Plugin | API Name | Required | Purpose |
|--------|----------|----------|---------|
| **Generative AI Controller** | `com.sn.generative.ai` | Yes | Core generative-AI / capability engine backing skill execution and the generative-AI model configuration. |
| **Now Assist for Platform** | `sn_genai_platform` | Yes | Base Now Assist framework. Auto-installed with any Now Assist product plugin. Provides the Now Assist panel and skill registry infrastructure. |
| **Now Assist Core** | `com.snc.now_assist` | Yes | Core Now Assist capabilities. Required dependency for skill execution / the generative-AI engine. |
| **AI Agent Studio** | `sn_aia` | Conditional | Required only if building AI Agents that invoke skills. Provides agent runtime and tool framework. |
| **MCP Client** | `sn_mcp_client` | Conditional | Required only if agents need to call external MCP servers. |

### API Endpoint Availability by Plugin

| API Endpoint / Class | Available When |
|----------------------|----------------|
| `sn_one_extend.OneExtendUtil.execute()` (server-side) | `sn_genai_platform` is active |
| `/api/now/v1/oneextend/scripted/setup_and_execute` (REST) | `sn_genai_platform` is active |
| `/api/now/table/sn_nowassist_skill_config` | `sn_genai_platform` is active |
| `/api/now/table/sn_aia_agent` | `sn_aia` is active |
| Agent execution API (`/api/sn_aia/app/agent/execute`) | `sn_aia` is active |

### How to Verify Plugin Activation

**Via UI:**
1. Navigate to **System Definition > Plugins** (`sys_plugins.list`)
2. Search for the plugin API name (e.g., `com.sn.generative.ai`)
3. Check the **Status** column -- must show `Active`

**Via Script (Background Script or Tool Script):**
```javascript
// Check if the Now Assist platform plugins are active
var pluginManager = new GlidePluginManager();
var plugins = {
    'com.sn.generative.ai': 'Generative AI Controller',
    'sn_genai_platform': 'Now Assist for Platform',
    'com.snc.now_assist': 'Now Assist Core',
    'sn_aia': 'AI Agent Studio',
    'sn_mcp_client': 'MCP Client'
};

for (var apiName in plugins) {
    var isActive = pluginManager.isActive(apiName);
    gs.info(plugins[apiName] + ' (' + apiName + '): ' + (isActive ? 'ACTIVE' : 'INACTIVE'));
}
```

**Via REST API:**
```bash
# Check plugin status via table API
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sys_plugins?sysparm_query=source=com.sn.generative.ai&sysparm_fields=source,name,active"
```

### Common Activation Issues

| Symptom | Root Cause | Resolution |
|---------|-----------|------------|
| `/api/now/v1/oneextend/scripted/setup_and_execute` returns 404 | `sn_genai_platform` plugin not activated | Activate Now Assist for Platform via System Definition > Plugins |
| Code references `/api/now/genai/controller/execute` or `sn_genai.GenAIController` | Fabricated/legacy path — not present on a current instance | Rewrite to One Extend (`sn_one_extend.OneExtendUtil.execute()` / `/api/now/v1/oneextend/scripted/setup_and_execute`) |
| `sn_one_extend.OneExtendUtil` not found | `sn_genai_platform` plugin not activated | Activate Now Assist for Platform plugin |
| Skill executes but returns empty response | LLM provider not configured after plugin activation | Navigate to Now Assist Admin > Setup and configure LLM connection |
| Plugin activation fails with dependency error | Missing prerequisite plugins | Activate plugins in order: `com.snc.now_assist` first, then `com.sn.generative.ai`, then product-specific plugins |
| GenAI tables exist but API returns 403 | Plugin active but user lacks required roles | Assign `admin` role and ensure GenAI-specific roles are granted (see `security-patterns.md` Role Prerequisites) |

### Plugin Activation Order

Plugins must be activated in dependency order. Activating out of order may cause errors:

1. `com.snc.now_assist` -- Now Assist Core (base dependency)
2. `sn_genai_platform` -- Now Assist for Platform
3. `com.sn.generative.ai` -- Generative AI Controller
4. `sn_aia` -- AI Agent Studio (if needed)
5. `sn_mcp_client` -- MCP Client (if needed)
6. Product-specific plugins (e.g., `sn_itsm_voice_aia` for Voice Agents)

---

## Configuration

### Instance Setup

1. **Plugin Activation**
   - `com.snc.now_assist` - Now Assist Core
   - `sn_genai_platform` - Now Assist for Platform
   - `com.sn.generative.ai` - Generative AI Controller
   - See [Skill Execution Activation Prerequisites](#skill-execution-activation-prerequisites) for full plugin list and activation order

2. **LLM Configuration**
   - Navigate to: Now Assist Admin → LLM Configuration
   - Configure API keys for chosen provider
   - Set rate limits and fallback options

3. **Skills Configuration**
   - Navigate to: Now Assist Admin → Skills
   - Enable/disable skills per application
   - Configure skill-specific settings

### Security Considerations

- **Data Classification:** Ensure sensitive data handling compliance
- **PII Filtering:** Configure PII detection and masking
- **Audit Logging:** All GenAI requests are logged
- **Rate Limiting:** Protect against excessive API usage

## Common Patterns

### Pattern: Contextual Summarization

```javascript
// Gather context from multiple sources
var context = {
    incident: getIncidentData(sys_id),
    comments: getComments(sys_id),
    related_items: getRelatedItems(sys_id)
};

// Execute summarization skill via One Extend (capabilityId selects the model-bound capability)
var resp = sn_one_extend.OneExtendUtil.execute({
    executionRequests: [{
        capabilityId: '<contextual_summarize_capability_sys_id>',
        payload: {
            context: JSON.stringify(context),
            focus_areas: ['resolution', 'timeline', 'stakeholders']
        }
    }]
});
var summary = resp.capabilities['<contextual_summarize_capability_sys_id>'];
```

### Pattern: Guided Generation

```javascript
// Provide structured guidance for generation via One Extend
var resp = sn_one_extend.OneExtendUtil.execute({
    executionRequests: [{
        capabilityId: '<generate_response_capability_sys_id>',
        payload: {
            input: userQuery,
            guidelines: {
                tone: 'professional',
                max_length: 200,
                include_next_steps: true,
                reference_kb: true
            }
        }
    }]
});
var result = resp.capabilities['<generate_response_capability_sys_id>'];
```

## Troubleshooting

### Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Skill not found | Skill not registered or disabled | Check Skills Registry |
| Rate limit exceeded | Too many requests | Implement backoff, check quotas |
| Empty response | Input validation failed | Check required fields |
| Timeout | LLM response slow | Increase timeout, simplify prompt |

### Debugging

Enable debug logging:
```javascript
gs.setProperty('com.snc.genai.debug', 'true');
```

Check logs:
- System Logs (`syslog`) filtered to the Now Assist / One Extend source
- Now Assist Admin → Request History

## Resources

- [ServiceNow GenAI Documentation](https://docs.servicenow.com)
- [Now Assist Admin Guide](https://docs.servicenow.com)
- [API Reference](https://developer.servicenow.com)
