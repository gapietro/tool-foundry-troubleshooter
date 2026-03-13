# ServiceNow Platform Assistant — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered troubleshooting assistant that runs entirely within ServiceNow, routing all LLM calls through GenAI Controller via NASK skills.

**Architecture:** Server-side ReAct agentic loop (Script Includes) exposed via Scripted REST API, with a React chat UI (ServiceNow SDK). All queries use GlideRecordSecure. Destructive ops require user confirmation.

**Tech Stack:** ServiceNow JavaScript (Script Includes), React (ServiceNow SDK), NASK/GenAI Controller

**PRD:** `docs/PRD_ServiceNow_Platform_Assistant.md`

**Architecture Decisions:** `docs/ARCHITECTURE_DECISIONS.md`

---

## Architectural Decision: LLM Invocation via NASK Skills

**Decision:** Use NASK Skills (`sn_gen_ai.GaiScriptedSkill`) for all LLM invocation, wrapped behind PaLlmProxy.

| Approach | Verdict | Reason |
|----------|---------|--------|
| **NASK Skills** | **Selected** | Platform-native, visible to customers in Skills Kit UI, existing automation (~24 API calls), insulates from GenAI Controller changes |
| **AI Agent Use Cases** | Rejected | Would nest an agent inside our agent — we ARE the orchestrator (PaAgentLoop). Surrenders control of iteration limits, tool selection, and confirmation flow |
| **Direct GenAI Controller calls** | Rejected (for now) | Simplest to implement but no customer visibility, no abstraction from API changes |

**Key constraint:** `PaLlmProxy` must be the **only file that knows NASK exists.** Switching LLM invocation methods is a single-file change.

See `docs/ARCHITECTURE_DECISIONS.md` for full layer-by-layer rationale.

---

## Task 1: Project Scaffolding (Remaining Files)

**Already done:** Git repo initialized, `.gitignore`, `README.md`, PRD pushed to `main`.

**Files:**
- Create: `package.json` (version `2026.03.1201`, jest devDependency, test script)
- Create: `CHANGELOG.md` (initial entry)

**What:** Add remaining project scaffolding. Package.json should include Jest for unit testing the parsing/logic code that doesn't depend on ServiceNow APIs.

**Commit:** `chore: add package.json and changelog`

---

## Task 2: Create Directory Structure + Table Definitions

**Files:**
- Create directories: `src/instance/script-includes/tools/`, `src/instance/scripted-rest-api/`, `src/instance/skills/`, `src/instance/tables/`, `src/component/x-snc-platform-assistant/components/`, `src/component/x-snc-platform-assistant/__tests__/`
- Create: `src/instance/tables/u_pa_session.json` — Session table schema (fields: u_session_id, u_user, u_status, u_messages JSON, u_context, u_pending_action)
- Create: `src/instance/tables/u_pa_audit_log.json` — Audit log schema (fields: u_session_id, u_user, u_action_type, u_tool_name, u_input, u_output, u_target_table, u_target_record, u_confirmed_by_user)

**What:** Establish the full project directory tree per the architecture doc. Table definition JSONs serve as documentation for what to create on-instance — they aren't auto-deployed but define the schema contract.

**Commit:** `chore: create directory structure and table definitions`

---

## Task 3: NASK Skill Definitions + System Prompt

**Files:**
- Create: `src/instance/skills/pa-llm-reason.json` — Primary reasoning skill config (temp 0.2, max 2000 tokens, text_generation type)
- Create: `src/instance/skills/pa-llm-summarize.json` — Context compression skill config (temp 0.1, max 1000 tokens)
- Create: `src/instance/skills/system-prompt.md` — System prompt template with `{{tool_definitions}}` placeholder, rules (GlideRecordSecure only, explain before destructive, max 100 records, ask if unsure, check 2+ sources), response format spec (`TOOL_CALL: {...}` or `ANSWER: ...`). **Must include CMDB knowledge:** relationship traversal patterns (`cmdb_rel_ci` parent/child queries, `cmdb_rel_type` for relationship types like Depends on/Runs on/Contains), common data model paths (incident -> CI -> support_group, CI -> application_service -> dependent CIs).

**What:** Define the NASK skills that will be created on-instance via Skills Kit automation. The system prompt encodes all behavioral rules for the LLM, including CMDB data model knowledge for relationship traversal.

**Commit:** `feat: add NASK skill definitions and system prompt`

---

## Task 4: PaLlmProxy — LLM Invocation Wrapper

**Files:**
- Create: `src/instance/script-includes/PaLlmProxy.js`
- Create: `src/instance/script-includes/__tests__/PaLlmProxy.test.js`

**What:** Wraps `sn_gen_ai.GaiScriptedSkill` to invoke NASK skills. Two public methods: `reason(prompt)` and `summarize(conversation)`. Internal `_parseResponse(raw)` method parses LLM output into structured format: `{type: 'tool_call', toolCall: {name, args}}` or `{type: 'answer', text}` or `{type: 'error', error}`. Handles empty responses, malformed JSON in TOOL_CALL, and missing prefixes (fallback to answer).

**Tests:** Unit test `_parseResponse` with Jest — this is pure parsing logic, no ServiceNow deps. Test cases: valid TOOL_CALL, valid ANSWER, malformed JSON, empty string, no prefix (fallback).

**TDD:** Write tests first → verify fail → implement → verify pass.

**Commit:** `feat: add PaLlmProxy for NASK skill invocation with response parsing`

---

## Task 5: PaToolRegistry — Tool Registration + Dispatch

**Files:**
- Create: `src/instance/script-includes/PaToolRegistry.js`
- Create: `src/instance/script-includes/__tests__/PaToolRegistry.test.js`

**What:** Maintains a registry of all 10 tools with metadata: scriptInclude name, destructive flag, description, parameter definitions (name, type, required, description). Public methods:
- `listTools()` — returns array of tool metadata
- `getToolDefinitionsForPrompt()` — formats tools for system prompt injection
- `isDestructive(toolName)` — returns boolean
- `getTool(toolName)` — returns config or null
- `execute(toolName, args)` — validates required params, instantiates Script Include, calls `execute(args)`

**Tests:** Unit test listTools, getToolDefinitionsForPrompt, isDestructive, getTool with known/unknown names.

**TDD:** Write tests first → verify fail → implement → verify pass.

**Commit:** `feat: add PaToolRegistry for tool registration, dispatch, and prompt generation`

---

## Task 6: PaToolQueryTable — Table Query Tool

**Files:**
- Create: `src/instance/script-includes/tools/PaToolQueryTable.js`

**What:** Executes GlideRecordSecure queries. Accepts: table (required), query (encoded query string), fields (comma-separated, default: sys_id,number,short_description,state), limit (default 20, max 100). Validates table exists via `GlideTableDescriptor.isValid()`. Orders by sys_created_on desc. Returns `{success, data: {table, query, count, records[]}}`.

**Commit:** `feat: add PaToolQueryTable for GlideRecordSecure table queries`

---

## Task 7: PaToolSchemaLookup — Schema Inspection Tool

**Files:**
- Create: `src/instance/script-includes/tools/PaToolSchemaLookup.js`

**What:** Inspects table/field schemas. Two modes: table-level (queries sys_dictionary for all fields, returns name/label/type/max_length/mandatory/reference) and field-level (single field details plus choice values from sys_choice). Validates table exists.

**Commit:** `feat: add PaToolSchemaLookup for table/field schema inspection`

---

## Task 8: PaToolLogAnalysis — System Log Search

**Files:**
- Create: `src/instance/script-includes/tools/PaToolLogAnalysis.js`

**What:** Queries syslog table via GlideRecordSecure. Filters by level, source (CONTAINS), message (CONTAINS), and time range (minutes_ago, default 60). Default limit 50, max 100. Orders by sys_created_on desc. Returns timestamp, level, source, message for each entry.

**Commit:** `feat: add PaToolLogAnalysis for system log search`

---

## Task 8b: PaToolCmdbTraverse — CMDB Relationship Traversal

**Files:**
- Create: `src/instance/script-includes/tools/PaToolCmdbTraverse.js`

**What:** Traverses CMDB relationships via GlideRecordSecure. Accepts: ci (sys_id, required), direction (upstream/downstream/both, default both), depth (max hops, default 2, max 5), rel_type (optional filter by relationship type name). Queries `cmdb_rel_ci` following parent/child links, joins `cmdb_rel_type` for human-readable relationship names. Returns `{success, data: {ci, direction, depth, relationships[]}}` where each relationship includes: related_ci (sys_id, name, class), relationship_type, direction, hop_level. Validates CI exists before traversal. Caps total results at 200 to prevent runaway queries on highly-connected CIs.

**Phase 2 enhancement — Knowledge Graph:** Check if `sn_cmdb_api` or CMDB GraphQL API is available on the instance. If yes, use ServiceNow Knowledge Graph for traversal (faster, handles cycle detection, understands impact/service-aware relationships). If no, fall back to manual `cmdb_rel_ci` walking. This keeps the tool universally compatible while leveraging better infrastructure when available.

**Use cases:**
- "What depends on this CI?" -> downstream, depth 1
- "What's the blast radius if this app service goes down?" -> downstream, depth 2-3
- "Show me the full relationship map for this server" -> both, depth 2
- "Help me understand the data model path from incident to support group" -> schema_lookup + cmdb_traverse in sequence

**Commit:** `feat: add PaToolCmdbTraverse for CMDB relationship traversal`

---

## Task 9: PaAuditLogger — Audit Trail

**Files:**
- Create: `src/instance/script-includes/PaAuditLogger.js`

**What:** Writes to u_pa_audit_log table. Three methods: `logIntent(params)` (before destructive execution), `logResult(params)` (after success), `logError(params)` (on failure). All methods capture session_id, user, tool_name, input/output JSON, target_table, target_record, confirmed_by_user flag.

**Commit:** `feat: add PaAuditLogger for audit trail of tool executions`

---

## Task 10: PaSessionManager — Conversation State

**Files:**
- Create: `src/instance/script-includes/PaSessionManager.js`

**What:** Manages u_pa_session records. Key behaviors:
- `getOrCreateSession(sessionId?)` — loads existing or creates new (generates GUID)
- `addMessage(sessionId, role, content, toolExecutions?)` — appends to u_messages JSON
- Context summarization: after 10 messages, calls PaLlmProxy.summarize(), stores summary in u_context, keeps only last 4 messages
- `setPendingAction(sessionId, action)` / `consumePendingAction(sessionId)` — for destructive op confirmation flow
- `buildConversationPrompt(sessionId)` — assembles context + messages into LLM prompt string
- Session expiry: 30 min inactivity check on load
- `closeSession(sessionId)` — sets status to closed

**Depends on:** PaLlmProxy (for summarization)

**Commit:** `feat: add PaSessionManager for conversation state and context management`

---

## Task 11: PaAgentLoop — Core ReAct Agentic Loop

**Files:**
- Create: `src/instance/script-includes/PaAgentLoop.js`
- Create: `src/instance/script-includes/__tests__/PaAgentLoop.test.js`

**What:** The central orchestrator. `run(params)` method implements:
1. Get/create session via PaSessionManager
2. If confirmationResponse provided → handle confirmation flow (execute confirmed action, log audit, get LLM interpretation)
3. Otherwise: add user message, enter ReAct loop (max 8 iterations)
4. Each iteration: build prompt → call PaLlmProxy.reason() → parse response
5. If TOOL_CALL + destructive → store pending action, return `{status: 'confirmation_required', pendingAction}`
6. If TOOL_CALL + non-destructive → execute via PaToolRegistry, feed result back into next iteration
7. If ANSWER → save to session, return `{status: 'success', response, toolExecutions}`
8. If max iterations → return partial results

Helper: `_describeAction(toolName, args)` — human-readable description for confirmation dialog.

**Tests:** Unit test `_buildPrompt` — verify it includes system prompt, tool definitions, conversation, and tool results when provided.

**Depends on:** PaLlmProxy, PaToolRegistry, PaSessionManager, PaAuditLogger

**Commit:** `feat: add PaAgentLoop with ReAct pattern, confirmation flow, and iteration bounds`

---

## Task 12: Scripted REST API — Endpoints

**Files:**
- Create: `src/instance/scripted-rest-api/api-definition.js` — API metadata (name, namespace x_snc_pa, base path)
- Create: `src/instance/scripted-rest-api/resource-chat.js` — POST /chat — validates request body, instantiates PaAgentLoop, calls run(), returns result
- Create: `src/instance/scripted-rest-api/resource-status.js` — GET /status — checks GenAI Controller plugin, Now Assist plugin, session table, audit table; returns readiness object
- Create: `src/instance/scripted-rest-api/resource-tools.js` — GET /tools — instantiates PaToolRegistry, returns listTools()
- Create: `src/instance/scripted-rest-api/resource-history.js` — GET /history/{session_id} — loads session via GlideRecordSecure, enforces user ownership, returns messages

**What:** Four REST endpoints composing the API surface. All require authentication. Chat endpoint is the primary entry point that triggers the full agentic loop.

**Commit:** `feat: add Scripted REST API with chat, status, tools, and history endpoints`

---

## Task 13: Install Dependencies + Run All Tests

**What:** Run `npm install` to get Jest. Configure Jest in package.json (testMatch, testEnvironment: node). Run `npm test` — all unit tests should pass (PaLlmProxy parsing, PaToolRegistry lookups, PaAgentLoop prompt building).

**Commit:** `chore: configure Jest and install dependencies`

---

## Task 14: Branch + PR

**What:** Per CLAUDE.md — all work on a feature branch, never main. Branch name: `feature/phase1-server-foundation`. Push and create PR with summary of all Phase 0+1 deliverables.

**Note:** The branch should be created BEFORE Task 1 — first thing when execution starts. This task is a reminder to push and PR at the end.

---

## Dependency Order

```
Task 1 (scaffolding) → Task 2 (dirs + tables) → Task 3 (skills)
  → Task 4 (PaLlmProxy) → Task 5 (PaToolRegistry)
    → Tasks 6,7,8,8b (tools — can be parallel)
    → Task 9 (PaAuditLogger)
    → Task 10 (PaSessionManager, depends on Task 4)
      → Task 11 (PaAgentLoop, depends on 4,5,9,10)
        → Task 12 (REST API, depends on 11)
          → Task 13 (tests) → Task 14 (PR)
```

---

## Verification

### Local
- `npm test` — all unit tests pass

### On-Instance (Phase 1 milestone)
1. Deploy Script Includes to test instance
2. Deploy Scripted REST API
3. Create NASK skills via Skills Kit automation
4. Create custom tables (u_pa_session, u_pa_audit_log)
5. `curl -X POST https://<instance>/api/x_snc_pa/assistant/chat -d '{"message": "Show me all P1 incidents"}'` → verify response with tool execution trace
6. `curl https://<instance>/api/x_snc_pa/assistant/status` → all checks pass
