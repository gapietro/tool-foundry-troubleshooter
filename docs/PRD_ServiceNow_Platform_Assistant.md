# Product Requirements Document: Foundry Troubleshooter

**Author:** Greg Pietro
**Date:** July 18, 2026
**Status:** Draft — Pending Approval
**Version:** 2.0 (supersedes v1.1 "ServiceNow Platform Assistant")

---

## Executive Summary

The **Foundry Troubleshooter** is an AI-powered diagnostic agent that runs **entirely within a ServiceNow instance**. It exists to close the loop in the Foundry workflow: when an AI Agent, NASK skill, or agent tool built with Foundry misbehaves, the Troubleshooter ingests the failing execution, systematically inspects the agent's **instructions, tool definitions, data schemas, wiring, and the GenAI stack**, identifies the root cause, and produces a structured **Fix Report** that can be fed back into the builder AI (Claude Code + Foundry) to correct the agent.

**The critical constraint it solves:** Foundry-built agents are deployed to customer POC instances containing real customer data. Data privacy policies prohibit pointing external AI tools (Claude Code, ChatGPT, Copilot) at those instances — so when an agent fails there, debugging falls back to manual archaeology. The Troubleshooter runs in-instance, routes all LLM calls through the customer's own GenAI Controller, and **no customer data ever leaves the platform**.

---

## The Foundry Loop

The Troubleshooter is one half of a closed build-diagnose loop:

```
   DEV / LOCAL                          CUSTOMER POC INSTANCE
┌──────────────────┐   deploy    ┌────────────────────────────────┐
│  Builder AI      │ ──────────> │  AI Agent / Skill / Tool       │
│  (Claude Code +  │             │       │                        │
│   Foundry MCP)   │             │       ▼  test run fails        │
│                  │             │  ┌──────────────────────────┐  │
│                  │             │  │  FOUNDRY TROUBLESHOOTER  │  │
│                  │             │  │  - pulls execution trace │  │
│                  │             │  │  - inspects instructions │  │
│                  │             │  │  - inspects tools/schemas│  │
│                  │  Fix Report │  │  - checks data + GenAI   │  │
│  corrects agent  │ <────────── │  │  - finds root cause      │  │
│  and redeploys   │  (sanitized)│  └──────────────────────────┘  │
└──────────────────┘             └────────────────────────────────┘
```

The Fix Report is the interface between the two halves: precise enough that the builder AI can apply the correction without re-diagnosing, and privacy-aware so it can safely cross the instance boundary (see [Fix Report](#the-fix-report)).

---

## Problem Statement

### Current Pain Points

1. **Debugging AI Agent failures is manual archaeology.** A failing Now Assist AI Agent run leaves evidence scattered across execution tables (`sn_aia_*`), GenAI Controller logs, flow contexts, and syslog. Reconstructing "what did the LLM see, what did it call, what came back, where did it go wrong" takes 30–90 minutes of cross-referencing per failure.

2. **Privacy barrier at exactly the wrong moment.** The build side of Foundry uses Claude Code freely against dev instances. The moment an agent is on a customer POC instance — where most real failures surface — external AI is prohibited and the tooling advantage disappears.

3. **Failure modes repeat, diagnosis knowledge doesn't.** The same root causes recur: tool input schema doesn't match the target table, instruction is ambiguous about which record to act on, expected reference data is missing on the POC instance, GenAI provider capability isn't mapped, trigger or use case is inactive. Each is rediscovered from scratch.

4. **"It didn't work" is useless feedback to the builder.** The builder AI needs a precise, structured statement of what is wrong (which instruction, which tool field, which schema mismatch) to produce a correct revision. Vague feedback wastes build-deploy-test cycles.

### The Opportunity

Encode the diagnostic methodology once — as an in-instance agent with first-class access to execution traces, agent configuration, and schemas — and every failure becomes: run the Troubleshooter, review the Fix Report, feed it back to the builder. Minutes instead of hours, and the failure-mode catalog compounds over time.

---

## Proposed Solution

### What It Is

A diagnostic ReAct agent running server-side in ServiceNow, exposed via a Scripted REST API and consumed by a React chat UI (ServiceNow SDK). The user starts a **diagnostic run** by pointing it at a failure via any of:

- **Execution reference** — "Diagnose execution `<sys_id>`" (the primary path)
- **Agent + timeframe** — "My Dispatch Triage agent has been failing since this morning"
- **Pasted logs** — raw execution output pasted into the chat, for cases where execution records are unavailable or the user already has the log in hand

The Troubleshooter then works the problem systematically (see methodology below), narrating its progress, and finishes with a diagnosis and a Fix Report. The user can ask follow-up questions ("show me the exact tool schema", "would renaming the field fix it?") in the same run.

### Example Session

```
User:  My "Incident Triage" agent keeps failing. Last run: sn_aia execution
       a1b2c3. Figure out what's wrong.

Troubleshooter:
  [tool: agent_trace a1b2c3]        → run failed at step 3, tool call
                                       "update_incident" returned an error
  [tool: agent_config "Incident Triage"] → pulls instructions + 4 attached tools
  [tool: schema_lookup incident.priority] → priority is an integer choice (1-5)
  [tool: agent_trace a1b2c3, step 3 detail] → agent passed priority: "High"

Diagnosis: The update_incident tool declares `priority` as a free-text string,
so the LLM passes "High"; the incident table expects choice values 1–5. The
instruction also never states the valid values. Two fixes, either sufficient,
both recommended:
  1. Tool schema: declare priority as choice [1,2,3,4,5] with labels
  2. Instruction: add "priority must be an integer 1 (critical) – 5 (planning)"

[Fix Report ready — copy for Foundry]
```

### Diagnostic Methodology

The system prompt encodes a layered playbook — the same systematic sweep a senior debugger performs, in order:

| # | Layer | What is checked | Typical finding |
|---|-------|-----------------|-----------------|
| 1 | **Execution trace** | Step-by-step replay: what the LLM saw, which tools it called, arguments, results, where the run deviated or died | Failed at step N; wrong tool chosen; looped; hallucinated an answer instead of calling a tool |
| 2 | **Instructions** | Agent/use-case instructions: ambiguity, contradictions, missing guidance for the failing case, format assumptions | Instruction never says which field identifies "the right group" |
| 3 | **Tool definitions** | Each attached tool: description quality, input/output schema, the script or flow behind it | Input schema field type doesn't match the target table; description misleads tool selection |
| 4 | **Data schemas** | Do the tables, fields, choice values, and references that instructions and tools assume actually exist and match? | Tool writes to a field that doesn't exist in this instance's version of the table |
| 5 | **Data** | Does the data the agent expects actually exist on this instance? | Lookup table empty on the POC; assignment group referenced by instruction was never created |
| 6 | **GenAI stack** | Provider configuration, capability mappings, skill config, token limits, quota, model errors | Capability not mapped to a provider; requests failing before the agent ever reasons |
| 7 | **Trigger & wiring** | Trigger conditions, use case activation, channel configuration | Use case inactive; trigger condition never matches |

**Evidence rule:** a root-cause claim must cite concrete evidence from the trace **plus** at least one configuration or schema layer. The Troubleshooter never diagnoses from the trace alone.

### The Fix Report

The terminal artifact of every diagnostic run. Produced in two forms — human-readable markdown in the chat, and JSON via the API:

```json
{
  "run_id": "TR0001042",
  "agent": { "name": "Incident Triage", "sys_id": "..." },
  "failure_summary": "Tool call update_incident rejected: invalid priority value",
  "root_causes": [
    {
      "layer": "tool_schema",
      "component": "update_incident.priority",
      "finding": "Declared as free-text string; target field is integer choice 1-5",
      "evidence": [
        "trace step 3: args {\"priority\": \"High\"}",
        "sys_dictionary incident.priority: type=integer, choices 1-5"
      ],
      "confidence": "high"
    }
  ],
  "fixes": [
    {
      "target_type": "tool_schema",
      "target": "update_incident.priority",
      "current": "string, no constraints",
      "proposed": "choice: [1,2,3,4,5], labels Critical..Planning",
      "rationale": "LLM cannot guess valid values from an unconstrained string"
    },
    {
      "target_type": "instruction",
      "target": "Incident Triage instructions, triage section",
      "current": "\"set the priority appropriately\"",
      "proposed": "append: \"priority is an integer 1 (critical) to 5 (planning)\"",
      "rationale": "Defense in depth; guides the model even if schema fix regresses"
    }
  ],
  "verification": [
    "Re-run the failing scenario; confirm step 3 passes an integer",
    "Check audit that no other tool writes priority as text"
  ],
  "data_markers": []
}
```

**Privacy design:** the report distinguishes **configuration** (instructions, tool definitions, schemas — the SC's own build artifacts, not customer data) from **customer data** (record contents). Fixes and findings reference configuration only. Any evidence line that must quote record data is tagged in `data_markers` so the user can redact it before pasting the report into an external builder AI. The default report is safe to carry across the instance boundary.

### Degraded Mode: Evidence Bundle

If the instance's GenAI stack is itself broken (a common state when debugging GenAI agents — see [circular dependency](#the-circular-dependency)), the Troubleshooter cannot reason, but it can still **collect**. `analyze` with `mode: "collect"` runs the trace/config/schema tools without the LLM and returns an **Evidence Bundle** — the same raw material, organized by layer, ready to hand to whichever AI the user is allowed to use. The tool degrades to a first-class evidence gatherer instead of failing outright.

---

## Target Users

| User | Role | Primary Use Case |
|------|------|-----------------|
| **Solutions Consultants building with Foundry** | Primary | Diagnose failing agents on customer POC instances; feed fixes back to the builder |
| **Technical Consultants** | Secondary | Debug Now Assist AI Agent configurations during implementations |
| **Platform / AI Architects** | Secondary | Validate agent designs; review failure patterns |

---

## Data Privacy & Security

| Concern | How It's Addressed |
|---------|-------------------|
| **Customer data exposure** | All processing happens in-instance via the customer's GenAI Controller. Nothing is sent to external AI services. |
| **Fix Report crossing the boundary** | Reports are configuration-centric by design; record data is tagged in `data_markers` for redaction before export. |
| **LLM provider compliance** | Uses whatever LLM the customer has approved via GenAI Controller — Now LLM, BYOK Azure OpenAI, AWS Bedrock, etc. |
| **Access control** | All queries use `GlideRecordSecure` — the tool sees only what the logged-in user's ACLs allow. |
| **Read-only by default** | All Phase 1–2 tools are read-only. Fix *application* (Phase 3) is confirmation-gated and audit-logged. |
| **Audit trail** | Every diagnostic run and tool execution is logged to a scoped audit table: user, timestamp, tool, input, output. |
| **Clean footprint** | Delivered as a scoped application — install and full removal are one operation each. |

---

## Technical Architecture

> **Harness strategy (July 2026):** the diagnostic tools, playbook, artifact store, and audit components below are **harness-agnostic** and are built first. They are wrapped in a native ServiceNow AI Agent ("Agent Doctor") via AI Agent Studio and measured against the seeded-failure benchmark; the scorecard decides whether the custom harness described in this section (async runs, PaLlmProxy, PaAgentLoop, REST API) gets built, and how much of it. See `ARCHITECTURE_DECISIONS.md` Decision 0.5 and the Implementation Plan's decision gate.

### Execution Model: Asynchronous Runs

Diagnostic runs are long: traces are large, and a thorough sweep takes 10–15 reasoning iterations. A synchronous REST call cannot survive that (Scripted REST APIs time out at ~60 seconds). Runs are therefore **asynchronous**:

1. `POST /analyze` validates input, creates a run record (`x_snc_pa_run`), fires an event, returns `{run_id, status: "queued"}` immediately.
2. A Script Action worker picks up the event and drives the ReAct loop, writing the transcript to the run record **after every iteration**.
3. The client polls `GET /runs/{run_id}` and renders live progress — the user watches tools execute, Claude-Code style, instead of staring at a spinner.
4. Loop bounds: max 15 iterations and a 5-minute wall-clock budget, whichever comes first; on either bound it emits its best partial diagnosis.

### Server-Side Components

#### Script Includes

| Script Include | Purpose |
|---------------|---------|
| **PaLlmProxy** | Sole wrapper around NASK/`GaiScriptedSkill` — `reason()`, `summarize()`; strict-JSON response contract with one re-prompt retry on parse failure |
| **PaToolRegistry** | Tool registration, metadata, destructive-check enforcement, dispatch, prompt generation |
| **PaToolAgentTrace** | Step-by-step replay of an AI Agent execution from the `sn_aia_*` execution tables (per Foundry's data-model mapping) |
| **PaToolAgentConfig** | Agent definition inspection: use case, instructions, attached tools (with full input/output schemas), trigger configuration |
| **PaToolGenAiLog** | GenAI Controller request logs, provider errors, token usage, capability mapping status |
| **PaToolSchemaLookup** | Table/field schema via `sys_dictionary` + `sys_choice` |
| **PaToolQueryTable** | GlideRecordSecure queries — verify the data an agent expects actually exists |
| **PaToolLogAnalysis** | Syslog search with level/source/message/time filters |
| **PaArtifactStore** | Large tool outputs (full traces, long logs) stored as attachments on the run record; transcript holds truncated excerpts + artifact refs; paged reads via a `read_artifact` tool |
| **PaFixReport** | Validates and normalizes the LLM-drafted report against the schema; renders markdown and JSON; applies data markers |
| **PaAuditLogger** | Writes to `x_snc_pa_audit` — intent, result, and error logging |
| **PaRunManager** | Run CRUD, transcript management, context summarization, pending actions, evidence-bundle collection |
| **PaAgentLoop** | The async worker: playbook-guided ReAct loop — reason, act, observe |

#### Scripted REST API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/x_snc_pa/troubleshooter/analyze` | POST | Start a diagnostic run (execution ref, agent+timeframe, or pasted logs; optional `mode: "collect"`) |
| `/api/x_snc_pa/troubleshooter/runs/{run_id}` | GET | Run status, live transcript, and Fix Report when complete (owner-only) |
| `/api/x_snc_pa/troubleshooter/runs/{run_id}/message` | POST | Follow-up question or confirmation response within a run |
| `/api/x_snc_pa/troubleshooter/status` | GET | Deep readiness check — see below |
| `/api/x_snc_pa/troubleshooter/tools` | GET | List available diagnostic tools |

#### Custom Tables (scoped app)

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| **x_snc_pa_run** | Diagnostic run state | number, user, agent ref, execution ref, status (queued / running / awaiting_confirmation / complete / failed), transcript (JSON), context summary, fix_report (JSON), error |
| **x_snc_pa_audit** | Audit trail | run, user, action_type, tool_name, input, output, target_table, target_record, confirmed_by_user |

Large artifacts attach to the run record — no third table.

#### NASK Skills (GenAI Controller)

| Skill | Purpose | Config |
|-------|---------|--------|
| **pa-llm-reason** | Diagnostic reasoning — tool selection, analysis, fix drafting | temp 0.2, max 2000 tokens |
| **pa-llm-summarize** | Transcript compression for long runs | temp 0.1, max 1000 tokens |

### The Circular Dependency

The Troubleshooter uses the GenAI stack to debug agents that use the GenAI stack. When that stack is misconfigured — a frequent root cause — the Troubleshooter must not silently fail alongside the patient. Three defenses:

1. **Deep `/status`:** checks Now Assist + GenAI Controller + AI Agent plugins, capability-to-provider mappings, the Troubleshooter's own two skills, and performs one live micro-invocation. When the assistant can't run, `/status` says exactly why — which is itself frequently the diagnosis.
2. **Minimal, known-good own config:** the Troubleshooter's skills use the plainest possible configuration and are validated at install, so a broken *customer* skill setup doesn't take the Troubleshooter down with it.
3. **Evidence Bundle degraded mode:** full evidence collection works with zero LLM availability.

---

## Technical Requirements

| Requirement | Detail |
|------------|--------|
| **ServiceNow version** | Xanadu or later; Yokohama Patch 4+ recommended (NASK maturity) |
| **Plugins required** | Now Assist, Generative AI Controller, AI Agents (`sn_aia`) — the agents being diagnosed require these anyway |
| **LLM provider** | Any configured via GenAI Controller (Now LLM, BYOK, etc.) |
| **Instance access** | Admin (install); the diagnosing user needs read access to `sn_aia_*` execution/config tables |
| **Note on internals** | `sn_aia_*` execution-table access relies on Foundry's reverse-engineered data-model mapping; exact table names are verified per release at install |

### Instance Footprint

| Records | Count | Purpose |
|---------|-------|---------|
| Scoped application | 1 | Container — clean install/uninstall |
| Scripted REST API | 1 definition + 5 resources | API surface |
| Script Includes | ~13 | Orchestration, tools, state |
| NASK skills | 2 skills (~14 records each via Skills Kit automation) | LLM access |
| Custom tables | 2 | Run state, audit log |
| Event + Script Action | 2 | Async execution |

---

## Business Value

| Metric | Current State | With Troubleshooter | Impact |
|--------|--------------|---------------------|--------|
| **Time to diagnose a failed agent run** | 30–90 min of manual cross-referencing | 5–10 min per run | **~80% reduction** |
| **Build-fix cycles per defect** | 2–4 (vague feedback to builder) | 1–2 (precise Fix Report) | **Fewer redeploys** |
| **AI-assisted debugging on customer POCs** | 0% (privacy-blocked) | 100% (in-instance) | **New capability** |
| **Failure-mode knowledge** | Tribal, per-SC | Encoded in playbook + catalog, compounds over time | **Scales expertise** |

**Strategic:** the Troubleshooter makes Foundry a closed loop — build, diagnose, correct — rather than a build tool with a manual debugging tail. The same architecture is packageable for customer admin teams debugging their own Now Assist agents.

---

## Delivery Plan

### Phase 1a: Tools + Native Agent + Benchmark (1–2 weeks) — THE DECISION GATE

- Harness-agnostic diagnostic tool cores: AgentTrace, AgentConfig, GenAiLog, SchemaLookup, QueryTable, LogAnalysis + PaArtifactStore (truncation/paged reads) and audit logging — Jest-tested where logic is pure
- Diagnostic playbook authored once (seven-layer sweep, evidence rule, Fix Report structure, failure-mode catalog), rendered as native agent instructions
- **"Agent Doctor"** — native AI Agent in AI Agent Studio, tools attached as Script tools via string-I/O adapters, created through Foundry's existing use-case automation
- Seeded-failure benchmark: 5 deliberately broken agents × 2 runs each (blind — defects documented only in the scorecard), scored on root-cause accuracy, fix-target accuracy, evidence citation, and fix usability

**Milestone / gate:** a filled scorecard and a written harness decision — ≥8/10 correct: native is the front door and Phase 1b shrinks; 5–7: native for triage, build the custom deep harness; <5: full custom harness.

### Phase 1b: Custom Diagnostic Harness (0–2 weeks, contingent on the gate)

- Scope set by the scorecard: up to the full async run engine (event + Script Action), PaLlmProxy (strict-JSON + retry), PaToolRegistry, PaFixReport validation, REST API with deep `/status`
- Evidence Bundle mode is built in every outcome (the LLM-free floor)
- The same benchmark re-run against the custom harness for an apples-to-apples comparison

**Milestone:** deep diagnosis passes the same seeded-failure benchmark.

### Phase 2: UI + Deeper Diagnosis (2 weeks)

- React chat UI (ServiceNow SDK): run progress view, transcript, Fix Report export, `/status` panel
- PaToolFlowContext (flow/subflow execution details behind flow-based agent tools)
- PaToolCmdbTraverse (relationship context where agents act on CIs)
- Loop detection in PaAgentLoop; failure-mode catalog v2 from real usage

**Milestone:** full diagnose-and-export workflow through the UI on a POC instance.

### Phase 3: Guided Fix Application (2 weeks)

- Confirmation-gated write tools aimed at **agent repair**: update instructions, fix tool schema records, activate/deactivate use cases and triggers
- Full audit logging for all writes; battle-test the confirmation flow
- One-command install automation with rollback (incl. the ~24-call NASK skill sequence)

**Milestone:** simple fixes applied in-instance with confirmation; complex fixes exported to the builder.

### Phase 4: Polish & Pilot (1 week)

- Timeout/edge-case hardening, error taxonomy
- User guide with example diagnostic sessions
- Pilot with SC team; measure success criteria

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `sn_aia_*` internals change between releases | Medium | High | Table mapping isolated in PaToolAgentTrace/AgentConfig; verified at install; Foundry maintains the mapping |
| GenAI Controller API changes | Medium | Medium | PaLlmProxy is the sole NASK touchpoint — single-file swap |
| LLM output quality varies by customer provider | Medium | Medium | Strict-JSON contract + retry; playbook constrains the reasoning; Evidence Bundle as floor |
| Diagnosis quality insufficient (wrong root causes) | Medium | High | Evidence rule (trace + config corroboration); seeded-failure benchmark gates release |
| Async worker failures leave runs stuck | Low | Medium | Wall-clock budget, status transitions on every iteration, stuck-run detection in `/status` |
| Security review of in-instance agent | Medium | Medium | Read-only Phases 1–2, GlideRecordSecure everywhere, scoped app, full audit trail |

---

## Success Criteria

1. **Seeded-failure benchmark:** against 5 deliberately broken agents (schema mismatch, ambiguous instruction, missing data, unmapped capability, inactive trigger), run twice each (10 scored runs — the doubling tests run-to-run consistency), the Troubleshooter identifies the correct root cause in ≥ 8/10. This same benchmark is the Phase 1a harness decision gate.
2. **Fix Report usability:** ≥ 70% of Fix Reports are accepted by the builder AI without manual editing and produce a working correction.
3. **Time to diagnosis:** under 10 minutes from failure to Fix Report, vs. 30–90 minutes manual baseline.
4. **Privacy validation:** network trace confirms zero customer data egress during diagnostic runs.
5. **Adoption:** 5+ SCs using it on Foundry projects within 30 days of release.

---

## Appendix: Prior Art

This project builds on Foundry's reverse-engineering of the ServiceNow AI Agent and Skills Kit frameworks:

- Complete data-model mapping of AI Agent execution and configuration tables (`sn_aia_*`)
- Working automation for creating Skills Kit skills (~24 API calls) and AI Agent Use Cases (~8 API calls)
- External MCP tooling (Foundry MCP) providing trace/config/log access from Claude Code on dev instances — the Troubleshooter is the in-instance counterpart for environments where external AI is prohibited
- Documentation of both frameworks (Skills Kit + AI Agent)

It is also independently validated by ServiceNow's own material: the Knowledge 2026 hands-on lab **CCL6230-K26 "Inside the Black Box: Troubleshooting and Debugging AI Agents at Scale"** ([guidebook](https://servicenow-events-or-lab-guidebo.gitbook.io/knowledge-2026/knowledge-2026/ccl6230-k26)) teaches a *manual* troubleshooting runbook over the same execution/config/GenAI-log tables the Troubleshooter's tools read, and a failure taxonomy (cold start & ACL-trigger misalignment, inconsistent responses, tool errors, latency from instruction/tool-output bloat, hallucination, infinite loops) that the diagnostic playbook and benchmark now adopt (see `LOW_LEVEL_DESIGN.md` §2.5). The lab confirms both the product gap — debugging is taught as manual table archaeology, with no native diagnostic agent — and the exact investigative method the Troubleshooter automates.

**Clarification for security review:** prior Foundry work includes provisioning techniques that bypass ACLs (e.g., GlideUpdateManager2) for *record creation during automated setup*. The Troubleshooter's runtime uses **none** of these — all runtime data access is `GlideRecordSecure` under the logged-in user's ACLs. Setup automation is admin-executed, install-time only, and audit-visible.
