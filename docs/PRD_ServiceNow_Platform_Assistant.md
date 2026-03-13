# Product Requirements Document: ServiceNow Platform Assistant

**Author:** Greg Pietro
**Date:** March 12, 2026
**Status:** Draft — Pending Approval
**Version:** 1.1

---

## Executive Summary

The **ServiceNow Platform Assistant** is an AI-powered interactive troubleshooting and configuration tool for ServiceNow Solutions Consultants (SCs). It provides a conversational interface — similar to developer tools like Claude Code or GitHub Copilot — that enables SCs to explore, diagnose, and configure ServiceNow instances through natural language.

**The critical differentiator:** All AI/LLM processing runs entirely within the ServiceNow instance using the customer's corporate-approved or BYOK (Bring Your Own Key) LLM providers via the GenAI Controller. **No customer data ever leaves the ServiceNow platform.** This makes it safe for POC environments with real customer data — a scenario where external AI tools like Claude Code or ChatGPT cannot be used due to data privacy policies.

---

## Problem Statement

### Current Pain Points

1. **Privacy barrier to AI-assisted work:** SCs cannot use modern AI coding assistants (Claude Code, Copilot, ChatGPT) when working on POC instances containing customer data. Our data privacy policies prohibit sending customer data to external AI services.

2. **Steep learning curve for instance exploration:** New and experienced SCs spend significant time navigating the ServiceNow platform — querying tables, debugging configurations, understanding ACLs, tracing business rules — through manual UI clicks and script debugging.

3. **Repetitive troubleshooting patterns:** Common issues (broken ACLs, misconfigured flows, missing records, performance bottlenecks) follow predictable patterns, yet every SC must rediscover solutions independently.

4. **Setup complexity:** Configuring ServiceNow features (AI Agent Use Cases, Skills Kit skills, integrations) requires creating numerous records across multiple tables in a specific order. Mistakes are silent and hard to diagnose.

### The Opportunity

By routing AI capabilities through ServiceNow's own GenAI Controller, we can build a tool that gives SCs the power of AI-assisted troubleshooting and configuration **without any data privacy concerns**. The tool uses whatever LLM the customer has already approved — Now LLM, Azure OpenAI (BYOK), AWS Bedrock, or any other configured provider.

---

## Proposed Solution

### What It Is

A conversational AI assistant that runs **entirely within ServiceNow**, exposed via a Scripted REST API and consumed by a React chat UI built with the ServiceNow SDK. It helps SCs:

- **Explore:** Query tables, inspect records, understand schemas, check configurations
- **Diagnose:** Find errors in logs, check ACLs, trace business rule execution, identify misconfigurations
- **Configure:** Create and update records, deploy configurations, set up features

### How It Works

The assistant runs as a **server-side ReAct agentic loop** on the ServiceNow instance itself. The SC interacts through a React-based chat component (ServiceNow SDK) that sends questions and receives answers. All data processing, LLM reasoning, and tool execution happens within the ServiceNow platform boundary.

```
SC's Browser                    Customer's ServiceNow Instance
    |                                    |
    | "Why are incidents not             |
    |  auto-assigning?"                  |
    | ---------------------------------> |
    |                                    | -> Queries assignment rules
    |                                    | -> Checks business rules
    |                                    | -> Examines ACLs
    |                                    | -> Asks LLM to analyze (via GenAI Controller)
    |                                    | -> LLM uses customer's approved model
    |                                    |
    | "Found 3 issues:                   |
    |  1. Assignment rule inactive...    |
    |  2. Business rule has error..."    |
    | <--------------------------------- |
```

### Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI** | React (ServiceNow SDK) | Chat interface component |
| **API** | Scripted REST API | HTTP endpoints for chat, status, tools, history |
| **Orchestration** | Script Includes (PaAgentLoop) | ReAct agentic loop — reason, act, observe |
| **LLM** | NASK Skills / GenAI Controller | LLM invocation via platform-native APIs |
| **Tools** | Script Includes (PaTool*) | GlideRecordSecure-based query, schema, log tools |
| **State** | Custom Tables | Session management, audit logging |

### Key Capabilities

| Capability | Examples |
|-----------|----------|
| **Natural language queries** | "Show me all P1 incidents from the last week" |
| **Configuration diagnosis** | "Why aren't my assignment rules working?" |
| **Schema exploration** | "What fields does the change_request table have?" |
| **Log analysis** | "Show me recent errors related to the CMDB" |
| **Setup assistance** | "Create a business rule that sets priority based on impact and urgency" |
| **Platform knowledge** | "How does the ACL evaluation order work in ServiceNow?" |

---

## Target Users

| User | Role | Primary Use Case |
|------|------|-----------------|
| **Solutions Consultants** | Primary | POC setup, troubleshooting, demos |
| **Technical Consultants** | Secondary | Implementation debugging, configuration |
| **Platform Architects** | Secondary | Architecture exploration, best practice validation |

---

## Data Privacy & Security

This is the core value proposition. The architecture ensures:

| Concern | How It's Addressed |
|---------|-------------------|
| **Customer data exposure** | All data stays within the ServiceNow instance. The UI only sends questions and receives sanitized answers. |
| **LLM provider compliance** | Uses whatever LLM the customer has already approved via GenAI Controller — Now LLM, BYOK Azure OpenAI, AWS Bedrock, etc. |
| **Access control** | All queries use `GlideRecordSecure`, which respects the authenticated user's ACLs and role-based access. |
| **Audit trail** | All configuration changes are logged to a dedicated audit table with user, timestamp, and details. |
| **Destructive operations** | Modifications require explicit user confirmation before execution. |
| **No external dependencies** | The tool uses only ServiceNow's built-in APIs and the customer's configured LLM. No external services, no data egress. |

---

## Technical Architecture

### Server-Side Components

#### NASK Skills (GenAI Controller)

Two skills registered via Skills Kit automation:

| Skill | Purpose | Config |
|-------|---------|--------|
| **pa-llm-reason** | Primary reasoning — tool selection, analysis, answers | temp 0.2, max 2000 tokens, text_generation |
| **pa-llm-summarize** | Context compression for long conversations | temp 0.1, max 1000 tokens |

#### Script Includes

| Script Include | Purpose |
|---------------|---------|
| **PaLlmProxy** | Wraps `sn_gen_ai.GaiScriptedSkill` — `reason()` and `summarize()` methods, response parsing |
| **PaToolRegistry** | Tool registration, metadata, dispatch, prompt generation |
| **PaToolQueryTable** | GlideRecordSecure table queries with field selection and limits |
| **PaToolSchemaLookup** | Table/field schema inspection via sys_dictionary and sys_choice |
| **PaToolLogAnalysis** | System log search with level/source/message/time filters |
| **PaAuditLogger** | Writes to u_pa_audit_log — intent, result, and error logging |
| **PaSessionManager** | Session CRUD, message history, context summarization, pending actions |
| **PaAgentLoop** | Core ReAct loop — reason/act/observe with max 8 iterations |

#### Scripted REST API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/x_snc_pa/assistant/chat` | POST | Primary entry point — triggers agentic loop |
| `/api/x_snc_pa/assistant/status` | GET | Health check — plugin readiness, table existence |
| `/api/x_snc_pa/assistant/tools` | GET | List available tools and their descriptions |
| `/api/x_snc_pa/assistant/history/{session_id}` | GET | Retrieve session message history (user-owned only) |

#### Custom Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| **u_pa_session** | Conversation state | session_id, user, status, messages (JSON), context, pending_action |
| **u_pa_audit_log** | Audit trail | session_id, user, action_type, tool_name, input, output, target_table, target_record, confirmed_by_user |

### Client-Side Component

A React chat UI built with the ServiceNow SDK (`x-snc-platform-assistant`). Communicates with the Scripted REST API. Handles:

- Message input and display
- Confirmation dialogs for destructive operations
- Tool execution visualization
- Session management

### ReAct Agentic Loop

The core reasoning pattern:

```
User sends message
  -> PaAgentLoop.run()
    -> PaSessionManager.getOrCreateSession()
    -> Add user message to session
    -> Loop (max 8 iterations):
        -> PaSessionManager.buildConversationPrompt()
        -> PaLlmProxy.reason(prompt)
        -> Parse response:
            TOOL_CALL + destructive -> store pending action, return confirmation_required
            TOOL_CALL + safe -> PaToolRegistry.execute() -> feed result back
            ANSWER -> save to session, return response
    -> Return result with tool execution trace
```

### System Prompt Rules

The LLM system prompt enforces:

1. Use `GlideRecordSecure` for all data access (never `GlideRecord`)
2. Explain what you're about to do before any destructive operation
3. Limit query results to max 100 records
4. Ask for clarification when the request is ambiguous
5. Cross-reference at least 2 sources before diagnosing issues
6. Response format: `TOOL_CALL: {name, args}` or `ANSWER: text`

---

## Technical Requirements

| Requirement | Detail |
|------------|--------|
| **ServiceNow version** | Yokohama Patch 4+ or Xanadu (for NASK support) |
| **Plugins required** | Now Assist, Generative AI Controller, Integration Hub |
| **LLM provider** | Any configured via GenAI Controller (Now LLM, BYOK, etc.) |
| **Instance access** | Admin role (for setup); itil or equivalent (for usage) |

### Instance Footprint

| Records | Count | Purpose |
|---------|-------|---------|
| Scripted REST API (definition + endpoints) | 4 | Chat endpoint, status, tools list |
| Skills Kit skill (full set) | ~14 | LLM proxy for GenAI Controller access |
| Custom tables | 2 | Session state, audit log |

All records are contained and can be removed cleanly.

---

## Business Value

### Quantifiable Benefits

| Metric | Current State | With Platform Assistant | Impact |
|--------|--------------|------------------------|--------|
| **POC setup time** | 4-8 hours per feature | 1-2 hours per feature | **60-75% reduction** |
| **Troubleshooting time** | 30-60 min per issue (avg) | 5-15 min per issue | **50-75% reduction** |
| **SC onboarding** | 2-4 weeks to platform proficiency | Immediate assistance from day 1 | **Accelerated ramp** |
| **AI tool usage on customer POCs** | 0% (blocked by privacy policy) | 100% (privacy-safe) | **New capability** |

### Strategic Benefits

1. **Competitive differentiation:** No competitor offers a privacy-safe AI assistant that works within the ServiceNow platform using the customer's own LLM.
2. **SC productivity at scale:** Every SC benefits immediately — the tool encodes platform expertise that currently lives only in senior SC knowledge.
3. **Customer confidence:** Demonstrating that AI tools can work within their data governance framework builds trust in our approach to AI-powered services.
4. **Reusable for customers:** The architecture could be packaged as a deployable solution for customer admins, creating additional value.

---

## Delivery Plan

### Phase 1: Foundation (2 weeks)

- Initialize project scaffolding and git repository
- Define NASK skill configurations and system prompt
- Build PaLlmProxy (LLM invocation wrapper with response parsing)
- Build PaToolRegistry (tool registration, dispatch, prompt generation)
- Build exploration tools: PaToolQueryTable, PaToolSchemaLookup, PaToolLogAnalysis
- Build PaAuditLogger and PaSessionManager
- Build PaAgentLoop (core ReAct orchestrator)
- Create Scripted REST API endpoints (chat, status, tools, history)
- Unit tests for parsing logic, registry lookups, prompt building

**Milestone:** Server-side foundation complete. SC can connect to an instance via API and ask natural language questions about its data.

### Phase 2: Diagnostic Tools (2 weeks)

- Add ACL checking, script search, flow execution history tools
- Enhance system prompt with ServiceNow platform knowledge
- Add session history and context management
- Build React chat UI component (ServiceNow SDK)

**Milestone:** SC can diagnose common configuration issues through conversation with a UI.

### Phase 3: Setup & Configuration Tools (2 weeks)

- Add record creation/update tools with confirmation prompts
- Implement full audit logging for destructive operations
- Add one-command setup automation

**Milestone:** SC can both diagnose and fix issues, with full audit trail.

### Phase 4: Polish & Documentation (1 week)

- Error handling, edge cases, timeout management
- User guide and example sessions
- Internal demo and feedback collection

**Milestone:** Tool ready for broader SC team adoption.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| GenAI Controller API changes in future ServiceNow releases | Medium | Medium | Abstract the LLM invocation layer; update as needed per release |
| LLM response quality varies by provider | Medium | Low | Tool works with any model; SCs can switch models if quality is insufficient |
| Instance performance impact from agentic loop | Low | Medium | Loop limited to 5-8 iterations; uses standard GlideRecordSecure (same as UI usage) |
| Security review required for Script Runner pattern | Medium | Medium | Use GlideRecordSecure everywhere; audit logging; confirmation for destructive ops |

---

## Success Criteria

1. **Privacy validation:** Confirmed via network trace that zero customer data leaves the instance during tool usage
2. **Time savings:** 50%+ reduction in common troubleshooting tasks (measured in pilot)
3. **Adoption:** 5+ SCs actively using the tool within 30 days of release
4. **Accuracy:** LLM-generated queries and diagnoses are correct 80%+ of the time

---

## Appendix: Prior Art

This project builds on reverse-engineering work already completed for the ServiceNow AI Agent and Skills Kit frameworks:

- Working automation for creating Skills Kit skills (~24 API calls, fully automated)
- Working automation for creating AI Agent Use Cases (~8 API calls, fully automated)
- Deployed Script Runner API for server-side script execution
- Deployed Provisioning API for Gen AI record creation
- Discovery of GlideUpdateManager2 technique for bypassing ACL-protected operations
- Complete documentation of both frameworks (Skills Kit + AI Agent)

The Platform Assistant is the natural next step — using these capabilities to build an interactive tool rather than one-shot automation scripts.
