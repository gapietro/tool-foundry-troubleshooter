# ServiceNow AI System Properties Reference

> Complete reference for all AI Agent and Now Assist system properties on ServiceNow Zurich.

---

## AI Agent System Properties (glide.properties)

| Property | Description | Default | Roles |
|----------|-------------|---------|-------|
| *(no instance-wide LLM provider property)* | Model selection is **per One Extend capability definition** (`sys_one_extend_capability_definition.connection`, via a GenAI alias), not a single instance-wide provider — `sys_one_extend_capability` itself has no model field. Because binding is per-definition, a different-model critic/judge is achievable. There is **no** `sn_aia.agent_llm_provider` property. | — | |
| `sn_aia.agent_tool_supported_data_types` | Comma-separated supported data types for IntegrationHub spoke tools | (see sys_glide_object) | |
| `sn_aia.analytics_dashboard_sysid` | Sys_id for AI Agents Analytics dashboard | — | read: sn_aia.admin, sn_aia.viewer |
| `sn_aia.continuous_communicator_output_limit` | Max consecutive user-facing output messages the orchestrator or agent can trigger; earlier docs said 3 (provenance unverified) -- live Zurich P10 value verified 5 on gpinst01 (2026-07-29); treat 5 as authoritative for Zurich, verify on target instance | 5 | |
| `sn_aia.continuous_tool_execution_limit` | Max consecutive uses of same tool (developer-editable, not a hard cap); ServiceNow's published property reference states default 7 — live Zurich P10 value verified 25 on gpinst01 (2026-07-18); treat 25 as authoritative for Zurich, verify on target instance | 25 | |
| `sn_aia.enable_usecase_tool_execution_mode_override` | Run workflows fully autonomously, overriding non-automated tools | `false` | |
| `sn_aia.maximum_agent_tools` | Max tools per AI agent | 20 | |
| `sn_aia.max_scheduled_trigger_query` | Records processed per scheduled trigger | 10 | |
| `sn_aia.mid_skill_switch_enabled` | Enable mid-skill switching | `false` | |
| `sn_aia.react_failure_retry_max_limit` | Max retries on execution failure | 3 | |
| `sn_nowassist_va.router_redirect_va_agentic` | AI agent discovery in Virtual Agent (NEVER = no agentic AI) | `ROUTER_DECISION` | |
| `com.glide.cs.dynamic.capability.timeout` | Timeout for AIA Proficiency Descriptor (seconds) | 180 | |
| `sn_aia.enable_follow_up` | Enable follow-up conversations after execution | `true` | |
| `sn_aia.follow_up_message` | Follow-up message after execution | "How else can I help you?" | |
| `sn_aia.allow_context_sharing` | Persist context across executions in same conversation | `true` | |
| `sn_aia.agent_strategy_choice_enabled` | Show LLM reasoning strategy in agent setup | `false` | |
| `sn_aia.context_sharing_strategy` | Strategy for short-term memory storage | `summarise` | |
| `sn_aia.enable_agent_tool_input_value_overrides` | Override agent tool input values | `true` | |
| `sn_aia.follow_up_qna_failure_limit` | Consecutive failed Q&As before exit in follow-up | 1 | |
| `sn_aia.quick_mode_failure_retry_max_limit` | Max retries in Quick Mode | 3 | |
| `sn_aia.user_context_data` | Comma-separated user context data list (profile, manager, reportees, assets). Customizable via UserContextUtil.getUserContext | `profile` | |
| `sn_aia.external_agents.enabled` | Enable external agent features | — | |
| `sn_aia.external_agents.parallel_conversations.enabled` | Enable multiple simultaneous conversations per user | — | |
| `sn_aia.enable_mcp_tool` | Enable MCP tool experience | `false` | |
| `sn_aia.enable_voice_agent_setup` | Enable AI voice agents on instance | — | |

## Long-Term Memory Properties

| Property | Description | Default |
|----------|-------------|---------|
| `sn_aia.ltm.category.auto_create` | Auto-create categories if none match | `true` |
| `sn_aia.ltm.enable_long_term_memory` | Enable long-term memory for agents | `false` |
| `sn_aia.ltm.use_memory_for_ai_agent` | Use stored user memories in interactions | `true` |

> This table is the property reference. For how these properties combine into a memory design — short-term vs. long-term memory, per-agent `memory_scope` on `sn_aia_team_member`, plain-text (non-vector) storage, and the platform-provides-vs-you-configure split — see [Multi-Agent Handoff Patterns](./multi-agent-handoff-patterns.md) § Memory Across Agents.

## MCP Client Properties

| Property | Description | Default |
|----------|-------------|---------|
| `sn_mcp_client.cursor.max_iterations` | Max cursor pagination iterations for MCP tools (0 = unlimited) | — |
| `mcp_guardian_check` | Enable guardian check for MCP Client | `false` |

## Voice Agent Properties

| Property | Description | Default |
|----------|-------------|---------|
| `glide.voice.authenticate.mfa_mandatory` | Require MFA for voice authentication | `true` |

## Voice Agent Attributes (Now Assist Deployment Config Attributes table)

| Attribute | Description | Default |
|-----------|-------------|---------|
| `voice_max_retries` | Max authentication retries before lockout | 3 |
| `voice_minutes_account_is_locked` | Lockout duration in minutes | 1440 |

## Agent Properties (sn_aia_property table)

These are stored in the sn_aia_property table and affect agent behavior:

### General Properties

| Name | Description | Default |
|------|-------------|---------|
| `alert.assist_spike_hours_to_check` | Hours between spike check scheduled job | 3 |
| `alert.assist_spike_usage_percentage_threshold` | % increase to trigger spike notification | 0.5 (50%) |
| `alert.assist_spike_usage_threshold` | Min assists to trigger spike notification | 5000 |
| `alert.consecutive_error_count` | Consecutive latency errors to trigger notification | 3 |
| `alert.llm_latency_threshold` | Seconds before LLM latency error | 10 |
| `alert.tool_latency_threshold` | Seconds before tool latency error | 300 |
| `enable_agent_tool_input_value_overrides` | Allow tool input value overrides | `false` |
| `execution_task.latency_thresholds` | JSON: LLM time boundaries [5000, 10000ms], token limit 500; Tool time boundaries [200000, 300000ms], output char limit 10000 | (JSON) |
| `follow_up_behaviour` | Post-execution actions per agentic workflow | `no_followup_close_conversation` |
| `mcp_guardian_check` | Now Assist Guardian on MCP tool executions | `false` |
| `show_citations` | Add citations to agentic AI responses | `false` |

### Recursive Execution Guardrails

The platform blocks runaway create/update recursion (e.g. an agent's action triggering another agent, which triggers another, etc.). This is **platform-enforced guardrail behavior, not exposed as a configurable `sn_aia.*` sys_property** — no `recursive_check.*` (or equivalent `sn_aia.*`) property exists; verified absent on gpinst01 (Zurich Patch 10 Hotfix 3, 2026-07-18). Treat the values below as observed default guardrail behavior and verify on your target instance.

| Guardrail | Observed default |
|-----------|-------------------|
| Max matching executions creating records | 50 per 15-minute window |
| Max matching executions updating a record | 5 per 15-minute window |

Query matching criteria (observed behavior, not configurable properties):
- Create matching: `objective={objective}^agent={agent}^ORusecase={usecase}`
- Update matching: `related_task_record={related_task_record}^objective={objective}`

## UI/Feature Toggle Properties

| Property | Description | Default |
|----------|-------------|---------|
| `com.glide.agentic_processes_view.enabled` | Enable AI Workflows panel (set true for UI action triggers) | — |

---

## Common Configuration Patterns

### Enable MCP Tools for Agents
```
sn_aia.enable_mcp_tool = true
```
Then enable Guardian check if needed:
```
mcp_guardian_check = true
```

### Enable Voice Agents
```
sn_aia.enable_voice_agent_setup = true
```

### Enable Long-Term Memory
```
sn_aia.ltm.enable_long_term_memory = true
sn_aia.ltm.use_memory_for_ai_agent = true
```

### Enable External Agents
```
sn_aia.external_agents.enabled = true
```

---

*Validated against ServiceNow Zurich documentation. Property availability depends on installed plugins and instance version.*
