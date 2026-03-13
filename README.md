# ServiceNow Platform Assistant

![Version](https://img.shields.io/badge/version-2026.03.1201-blue)

An AI-powered troubleshooting and configuration assistant that runs **entirely within ServiceNow**. All LLM calls route through GenAI Controller via NASK skills — no customer data ever leaves the platform.

## What It Does

- **Explore** — Query tables, inspect records, understand schemas
- **Diagnose** — Search logs, trace business rules, check ACLs, traverse CMDB relationships, identify misconfigurations
- **Configure** — Create and update records with confirmation prompts and full audit trail

## Architecture

```
React Chat UI (ServiceNow SDK)
        |
  Scripted REST API
        |
  PaAgentLoop (ReAct pattern, max 8 iterations)
        |
  ┌─────┴─────┐
  PaLlmProxy   PaToolRegistry
  (NASK/GenAI)  (dispatch + validation)
                 |
          ┌──────┼──────┼──────┐
    QueryTable  Schema  Logs  CmdbTraverse
```

All queries use `GlideRecordSecure`. Destructive operations require user confirmation. Every tool execution is audit-logged.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React (ServiceNow SDK) |
| API | Scripted REST API (`/api/x_snc_pa/assistant/*`) |
| Orchestration | Script Includes (server-side JavaScript) |
| LLM | NASK Skills / GenAI Controller |
| State | Custom tables (u_pa_session, u_pa_audit_log) |

## Requirements

- ServiceNow Yokohama Patch 4+ or Xanadu
- Plugins: Now Assist, Generative AI Controller, Integration Hub
- LLM: Any provider configured via GenAI Controller

## Project Structure

```
src/
  instance/
    script-includes/         # Server-side logic
      tools/                 # Individual tool implementations
      __tests__/             # Jest unit tests
    scripted-rest-api/       # REST endpoint definitions
    skills/                  # NASK skill configs + system prompt
    tables/                  # Custom table schema definitions
  component/
    x-snc-platform-assistant/  # React chat UI (ServiceNow SDK)
      components/
      __tests__/
docs/
  PRD_ServiceNow_Platform_Assistant.md   # Product requirements
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|------------|
| `/chat` | POST | Send a message, triggers agentic loop |
| `/status` | GET | Health check — plugin and table readiness |
| `/tools` | GET | List available tools |
| `/history/{session_id}` | GET | Retrieve session message history |

## Documentation

- [Product Requirements Document](docs/PRD_ServiceNow_Platform_Assistant.md)
- [Architecture Decisions](docs/ARCHITECTURE_DECISIONS.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Architecture Diagram](docs/architecture-diagram.html) (open in browser)
- [Implementation Plan (interactive)](docs/implementation-plan.html) (open in browser)

## License

Internal use only.
