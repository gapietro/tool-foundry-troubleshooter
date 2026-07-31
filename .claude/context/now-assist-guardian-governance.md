# Now Assist Guardian & AI Governance

> Safety guardrails and governance framework for AI operations on ServiceNow Zurich.

---

## Now Assist Guardian

Guardian is ServiceNow's safety system that monitors and filters AI inputs and outputs to prevent harmful content.

### Safety Categories (16 Total)

Guardian evaluates content across 16 safety categories:

| Category | Description |
|----------|-------------|
| Offensive content | Profanity, slurs, hate speech |
| Sexual content | Sexually explicit material |
| Violence | Graphic violence or threats |
| Self-harm | Content promoting self-harm |
| Harassment | Bullying, intimidation |
| Prompt injection | Attempts to override AI instructions |
| Jailbreak attempts | Attempts to bypass safety controls |
| PII exposure | Personal identifiable information leakage |
| Credential exposure | Passwords, API keys, tokens |
| Code injection | Malicious code in inputs/outputs |
| Data exfiltration | Attempts to extract sensitive data |
| Bias/discrimination | Biased or discriminatory content |
| Misinformation | False or misleading claims |
| Legal/compliance | Content with legal implications |
| Brand safety | Content harmful to brand reputation |
| Custom categories | Organization-defined safety rules |

### Configuration

Navigation: All > Now Assist Admin > Guardian

**Key settings:**
- Enable/disable individual safety categories
- Set sensitivity thresholds per category
- Configure actions (block, warn, log) per category
- Define custom filtered subjects

### Privacy Policies

Guardian enforces privacy policies that control:
- PII detection and masking
- Data classification enforcement
- Cross-boundary data flow restrictions
- Consent management for AI interactions

### Filtered Subjects

Administrators can define custom filtered subjects -- topics or terms that Guardian should flag or block. This allows organization-specific content policies beyond the 16 default categories.

### MCP Guardian Check

For AI agents using MCP tools:
1. Set `mcp_guardian_check = true` in sn_aia_property table
2. Enable Now Assist Guardian on AI Agent Studio Settings page
3. Both conditions must be true for Guardian to check MCP tool executions

---

## AI Governance Framework

### Roles

| Role | Description |
|------|-------------|
| `sn_aia.admin` | Full CRUD on all AI agent records |
| `sn_aia.viewer` | Read-only + report access on all AI tables |
| `agent_role_config_admin` | Access/modify Agent role configurations (parent: sn_aia_admin) |
| `agent_role_config_viewer` | View Agent role configurations (parent: sn_aia_viewer) |
| `sn_mcp_client.admin` | MCP Client admin (inherited from sn_aia.admin) |
| `sn_mcp_client.viewer` | MCP Client read-only (inherited from sn_aia.viewer) |
| `sn_voice_aia.admin` | Access to voice agent configuration |
| `sn_voice_aia.guest` | Use AI voice agents without authentication |
| `sn_voice_aia.integration` | Access to voice agent integrations (e.g., Oracle) |

### Security Architecture

#### Role Masking (6-Step Evaluation Chain)

When an AI agent executes, ServiceNow evaluates access through a 6-step chain:

1. **User identity** -- Who initiated the request
2. **Agent role configuration** -- Roles assigned to the agent
3. **ACL evaluation** -- Access Control Lists on target tables/records
4. **Role masking** -- Intersection of user roles and agent roles
5. **Dynamic user query** -- addUserEncodedQuery() enforcement
6. **Data access** -- Final permission determination

#### Security Models

| Model | Description | When to Use |
|-------|-------------|-------------|
| **Dynamic user** | User passes their roles to AI agent, ACLs determine data access | Default and recommended |
| **AI user** | Agent runs with its own dedicated service account | Service-to-service automation |
| **Specific roles** | Agent limited to explicitly assigned roles | Restricted access scenarios |
| **Public** | Any authenticated user can trigger | Low-risk, broad-access tools |

### Security Dashboard

Navigation: All > AI Agent Studio > Analytics > Security page

Tracks:
- Total/list of blocked executions
- Agentic workflows/AI agents without ACLs
- Workflows/agents without role masking
- Workflows/agents running as dynamic user
- Workflows/agents running as AI user

### GenAI Log Retention

- GenAI log data is retained for **6 months** by default
- To retain longer, export via script to a different table
- Tools Executions table records expire after **13 months**

### Compliance Considerations

- All GenAI requests are logged for audit
- PII data is redacted from voice agent transcripts before storage
- Voice agent usage must comply with anti-wiretapping, recording consent, and applicable privacy laws
- Domain separation (Basic support type) enforces data boundaries across AI artifacts
- AI governance admin can review all AI agent activities, tool executions, and security events

### Data Classification

Ensure proper data classification for:
- AI agent instructions (may contain sensitive business logic)
- Tool scripts (may access sensitive data)
- Execution logs (contain tool inputs/outputs)
- Conversation history (may contain PII)

---

*Validated against ServiceNow Zurich documentation.*
