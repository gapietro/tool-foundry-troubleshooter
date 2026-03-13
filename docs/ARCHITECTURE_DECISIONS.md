# Architecture Decisions

> Design rationale for the ServiceNow Platform Assistant, captured during architecture review (March 2026).

---

## Layer 1: Client — React Chat UI (ServiceNow SDK)

**Decision:** Thin React component via ServiceNow SDK, no logic in the client.

**Rationale:**
- The UI is a dumb terminal — no LLM calls, no data processing. It sends JSON to the REST API and displays responses.
- Chose in-browser React component over a CLI because SCs are already in ServiceNow — no context switching. Confirmation dialogs for destructive operations are natural in a UI, awkward in a terminal.
- The ServiceNow SDK component (`x-snc-platform-assistant`) is portable across portal pages.

**Extensibility:**
- A CLI can be added in Phase 2-3 with **zero server-side changes** — it's just another HTTP client hitting the same REST API. Any client that can POST JSON and read responses works.
- If the ServiceNow SDK becomes painful, we can swap to a Service Portal widget without touching anything else.

---

## Layer 2: API — Scripted REST API

**Decision:** Four thin REST endpoints as the single entry point to all server-side logic.

**Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/chat` | POST | Triggers the agentic loop — accepts messages and confirmation responses |
| `/status` | GET | Health check — plugin readiness, table existence |
| `/tools` | GET | Lists available tools with descriptions |
| `/history/{session_id}` | GET | Session message history (user-owned only) |

**Rationale:**
- Thin pass-through — validates input, routes to PaAgentLoop, returns result. No business logic in this layer.
- Chose REST over GlideAjax so any client (React UI, CLI, curl, integrations, automated tests) can use it without touching server-side code.
- `/chat` handles both new messages AND confirmation responses via the same endpoint (optional `confirmationResponse` field). One endpoint, one flow — the client just sends different payloads. A separate `/confirm` endpoint was considered and rejected as unnecessary complexity.

**Known risk:** Scripted REST APIs have a ~60 second default timeout on most instances. Mitigated by the 8-iteration cap on the agentic loop — worst case ~40 seconds (8 LLM calls at ~5 seconds each).

---

## Layer 3: Orchestration — PaAgentLoop (ReAct Pattern)

**Decision:** Server-side ReAct loop with max 8 iterations and a destructive-op confirmation gate.

**Rationale:**
- Chose ReAct over single-shot because troubleshooting requires multi-step reasoning. "Why aren't assignment rules working?" needs 3-5 tool calls: query rules, check if active, examine conditions, check interfering business rules. Single-shot can't do this.
- Max 8 iterations prevents runaway loops and keeps within the REST API timeout window. If hit, returns partial results rather than failing.
- CMDB data model traversal works naturally within the loop — the LLM chains QueryTable + SchemaLookup + CmdbTraverse across iterations, following relationships hop by hop.

**Confirmation flow:**
- When the LLM wants to execute a destructive tool (update/create/delete), the loop **pauses**. It does not execute.
- The pending action is stored in the session and a human-readable description is returned to the client: "I want to update incident INC0012345, setting priority to 1. Confirm?"
- The user approves or rejects. If approved, the loop resumes from where it left off. If rejected, the LLM is told "user declined" and adjusts.
- This is the core safety mechanism. No silent writes. No surprises.

**Known risk:** The LLM could loop — calling the same tool with the same args repeatedly. The 8-iteration cap is the primary safeguard. Loop detection (comparing current call to previous) is a candidate for Phase 2.

---

## Layer 4: LLM Invocation — PaLlmProxy + NASK Skills

**Decision:** Use NASK Skills via `sn_gen_ai.GaiScriptedSkill`, wrapped behind PaLlmProxy as the sole abstraction.

### Alternatives Considered

| Approach | Verdict | Reason |
|----------|---------|--------|
| **NASK Skills** | **Selected** | Platform-native, visible to customers in Skills Kit UI, existing automation (~24 API calls), insulates from GenAI Controller changes |
| **AI Agent Use Cases** | Rejected | Would nest an agent inside our agent — we ARE the orchestrator (PaAgentLoop). Surrenders control of iteration limits, tool selection, and confirmation flow to ServiceNow's opaque framework |
| **Direct GenAI Controller calls** | Rejected (for now) | Simplest to implement but no customer visibility, no abstraction from API changes, manual model/token management |

### Key Design Constraint

**`PaLlmProxy` must be the ONLY file that knows NASK exists.** All other components call `reason()` and `summarize()` — they never touch `GaiScriptedSkill` directly.

This ensures switching to direct GenAI Controller calls, future Now-SDK support for NASK/AI Agents, or any other LLM invocation method is a **single-file change**.

### Two Skills, Two Purposes

| Skill | Purpose | Temperature | Max Tokens |
|-------|---------|-------------|------------|
| `pa-llm-reason` | ReAct reasoning — tool selection, analysis, answers | 0.2 | 2000 |
| `pa-llm-summarize` | Conversation compression | 0.1 | 1000 |

Separate skills because NASK bakes configuration at creation time, not at invocation time. We need different temperature/token settings for reasoning vs. summarization.

### Response Parser

`_parseResponse(raw)` is pure string parsing with no ServiceNow dependencies — fully unit-testable with Jest. Handles: valid TOOL_CALL, valid ANSWER, malformed JSON, empty responses, missing prefixes (fallback to answer).

### Known Risks

- NASK skill creation requires ~24 API calls; mid-sequence failure needs manual cleanup
- `GaiScriptedSkill` API is reverse-engineered, not publicly documented
- Skills Kit internals have changed between ServiceNow releases
- **Mitigation:** PaLlmProxy abstraction makes the NASK dependency swappable

---

## Layer 5: Tools — PaToolRegistry + Individual Tools

**Decision:** Centralized registry with consistent tool interface. All Phase 1 tools are read-only.

### Registry Design

PaToolRegistry centralizes the destructive check — it's the **single point of enforcement**. Without it, every piece of code that calls a tool would need to check "is this destructive?" independently. That's a security bug waiting to happen.

All tools return consistent shape: `{success: boolean, data: {...}}` or `{success: false, error: "..."}`. The LLM sees uniform output regardless of which tool ran.

### GlideRecordSecure Everywhere

Every tool uses `GlideRecordSecure`, never `GlideRecord`. This respects the logged-in user's ACLs and role-based access. If a user doesn't have access to a table, the tool returns empty results — no error, no data leak. We don't build custom permissions; we lean on ServiceNow's.

**Tradeoff:** GlideRecordSecure is slower than GlideRecord due to per-record ACL checks. For our use case (max 100 records per query), the performance hit is negligible. Security over speed.

### Phase 1 Tools (All Read-Only)

| Tool | Purpose | Key Limits |
|------|---------|-----------|
| **PaToolQueryTable** | GlideRecordSecure queries on any table | Max 100 records, validates table exists |
| **PaToolSchemaLookup** | Table/field schema via sys_dictionary + sys_choice | Table-level and field-level modes |
| **PaToolLogAnalysis** | System log search with filters | Default 60 min window, max 100 entries |
| **PaToolCmdbTraverse** | CMDB relationship traversal | Default depth 2, max depth 5, max 200 results |

Destructive tools (create/update/delete records) are planned for Phase 3, after the confirmation flow has been battle-tested with real usage.

### CMDB Traversal Design

- Default depth 2 covers 80% of use cases. Max depth 5 covers deep traversals (incident → CI → host → cluster → data center → app service).
- 200 result cap prevents runaway queries on highly-connected CIs.
- The LLM can chain multiple traversal calls across ReAct iterations for deeper exploration.
- **Phase 2 enhancement:** Detect if ServiceNow Knowledge Graph API (`sn_cmdb_api` or CMDB GraphQL) is available. If yes, use it for faster traversal with cycle detection and impact-aware relationships. If no, fall back to manual `cmdb_rel_ci` walking. Universal compatibility with better performance when available.

---

## Layer 6: Data & State — PaSessionManager + PaAuditLogger

**Decision:** Two custom tables — one for conversation state, one for audit trail. Messages stored as JSON, not in a child table.

### Session Management (u_pa_session)

**Messages as JSON vs. child table:**
- We always load ALL messages for a session at once (to build the LLM prompt), so one query returning a JSON field beats N queries to a child table.
- We don't need to search across messages independently.
- Keeps instance footprint minimal (2 tables, not 3).
- If cross-session message search becomes needed, a child table can be added in a future phase.

**Context summarization:**
- After 10 messages, PaSessionManager calls `PaLlmProxy.summarize()` to compress older messages into a paragraph.
- Stores the summary in `u_context`, keeps only the last 4 messages in `u_messages`.
- The LLM sees: summary of earlier conversation + recent messages. This enables unbounded conversations without hitting token limits.

**Session lifecycle:**
- 30-minute inactivity expiry prevents stale context from polluting new questions.
- Pending actions (destructive ops awaiting confirmation) survive across HTTP requests — the user can take time to decide.

### Audit Logging (u_pa_audit_log)

**Three moments, three methods:**

| Method | When | Why |
|--------|------|-----|
| `logIntent(params)` | Before destructive execution | If the system crashes between intent and execution, we have a record of what was attempted |
| `logResult(params)` | After successful execution | Records input, output, affected table/record, user confirmation |
| `logError(params)` | After failed execution | Records what went wrong |

The audit log is **write-only from the assistant's perspective**. It never reads its own audit log. This is purely for humans — admins, security reviewers, managers who want to know what the tool did on a customer instance.

**Known risk:** The `u_messages` JSON field could grow large for very active sessions. Mitigated by summarization at 10 messages and the 30-minute session expiry.
