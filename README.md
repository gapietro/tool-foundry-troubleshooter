# Foundry Troubleshooter

![Version](https://img.shields.io/badge/version-2026.08.1307-blue)

An AI-powered diagnostic agent that runs **entirely within ServiceNow**. When an AI Agent built with Foundry fails on a customer instance — where external AI tools are prohibited — the Troubleshooter ingests the failing execution, systematically inspects the agent's instructions, tools, schemas, data, and GenAI stack, finds the root cause, and produces a structured **Fix Report** to feed back into the builder AI.

All LLM calls route through GenAI Controller via NASK skills — no customer data ever leaves the platform.

## The Foundry Loop

```
Builder AI (Claude Code + Foundry) ──deploy──> AI Agent on POC instance
        ▲                                            │ fails
        │                                            ▼
        └────── Fix Report ◄────── Foundry Troubleshooter (in-instance)
```

## How a Diagnosis Works

1. **Point it at a failure** — an execution sys_id, an agent name + timeframe, or pasted logs
2. **It sweeps seven layers systematically** — execution trace → instructions → tool definitions → data schemas → data → GenAI stack → trigger/wiring
3. **Evidence rule** — every root cause must cite the trace *plus* corroborating config/schema evidence
4. **Fix Report** — root causes, concrete fixes (current → proposed), verification steps; configuration-only by default, with customer data flagged for redaction before export

If the instance's GenAI stack is itself broken, `mode: "collect"` returns an **Evidence Bundle** — organized raw evidence, no LLM required.

## Harness Strategy: Tools-First, Benchmark-Gated

The diagnostic tools and playbook are built **harness-agnostic**, then wrapped first in a native ServiceNow AI Agent (**"Agent Doctor"**, AI Agent Studio + Script tools). A blind seeded-failure benchmark — 5 deliberately broken agents × 2 runs each — decides whether the custom harness below gets built:

| Scorecard | Outcome — for the arm the score was read on |
|-----------|---------|
| ≥ 8/10 correct root causes, usable fixes | That arm is the front door |
| 5–7/10 | That arm is lightweight triage only |
| < 5/10 | That arm does not clear triage on this evidence |

**A band prescribes about the arm it was read on, and about no other.** These bands originally read the
*native* score and prescribed what to do with the **custom** arm — *"build the custom deep-diagnosis
harness"* at 5–7/10, *"full custom harness"* below 5, and *"the custom harness shrinks to the Evidence
Bundle path + measured gaps"* at ≥ 8/10. All three are the same shape, and all three held only while the
custom arm was unmeasured. Both arms are now measured (v12: **native 6/10 · 60%**, **custom 0/10 · 0%**),
so those clauses are retired: the custom harness is built out only on **its own ≥ 80%**, and a component
measured to *degrade* a diagnosis is removed or re-derived first. Re-derivation and the reasoning:
`benchmark/DECISION.md` §AE (binds on passes after v12).

**A bottom-band result is a floor** — it does not say how far below the band the arm sits, nor that it
cannot reach a higher band later.

**Current standing:** native is the recommended path **as triage** on this instance — that is what its
middle band prescribes and no more — and the Phase 1b milestone is not met. Quote the last scored pass,
**v14** (`DESIGN.md` §5.1), as **native 5/10 · 50% · middle band** with **custom 0/10 · 0% · bottom
band** — never one arm without the other. The v12 figures above are retained because they are what
retired the cross-arm clauses; they are **not** the current standing.

See `docs/ARCHITECTURE_DECISIONS.md` (Decision 0.5, partially superseded) and the benchmark protocol in `docs/IMPLEMENTATION_PLAN.md`.

## Architecture (custom harness — contingent on the benchmark)

```
React Chat UI (ServiceNow SDK)  — polls run progress
        |
  Scripted REST API   /analyze  /runs/{id}  /runs/{id}/message  /status  /tools
        |
  [event queue — async worker]
        |
  PaAgentLoop (playbook-guided ReAct, max 15 iterations / 5 min)
        |
  ┌─────┴─────┐
  PaLlmProxy   PaToolRegistry
  (NASK/GenAI)  |
     AgentTrace · AgentConfig · GenAiLog · Schema · Query · Syslog · ReadArtifact
```

All queries use `GlideRecordSecure`. Phase 1–2 tools are read-only; fix application (Phase 3) is confirmation-gated. Every run and tool execution is audit-logged.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React (ServiceNow SDK) — Phase 2 |
| API | Scripted REST API (`/api/x_snc_troubleshoot/v1/troubleshooter/*`), async runs |
| Orchestration | Script Includes (server-side JavaScript) |
| LLM | NASK Skills / GenAI Controller (strict-JSON contract) |
| State | Scoped tables (x_snc_troubleshoot_run, x_snc_troubleshoot_audit) + attachments for large artifacts |

## Requirements

- ServiceNow Xanadu or later (Yokohama Patch 4+ recommended)
- Plugins: Now Assist, Generative AI Controller, AI Agents (`sn_aia`)
- LLM: any provider configured via GenAI Controller
- Delivered as a scoped app — clean install and removal

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/analyze` | POST | Start a diagnostic run (async — returns `run_id` immediately) |
| `/runs/{run_id}` | GET | Run status, live transcript, Fix Report when complete |
| `/runs/{run_id}/message` | POST | Follow-up question or confirmation response |
| `/status` | GET | Deep readiness check — plugins, mappings, own-skill health, stuck runs |
| `/tools` | GET | List available diagnostic tools |

## Project Structure

```
src/
  instance/
    script-includes/         # Orchestration + PaFixReport, PaArtifactStore, PaRunManager
      tools/                 # Diagnostic tool implementations
      __tests__/             # Jest unit tests
    scripted-rest-api/       # REST endpoint definitions
    skills/                  # NASK skill configs + diagnostic playbook prompt
    tables/                  # Scoped table schema definitions
    events/                  # Async run event + Script Action
  component/
    x-snc-platform-assistant/  # React chat UI (Phase 2)
docs/
```

## Documentation

- [Product Requirements Document](docs/PRD_ServiceNow_Platform_Assistant.md) — v2.0, Foundry Troubleshooter
- [Architecture Decisions](docs/ARCHITECTURE_DECISIONS.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) — Phase 1a: tools + Agent Doctor + benchmark
- [Low-Level Design](docs/LOW_LEVEL_DESIGN.md) — instance-verified data model (keynexus01, Zurich), component specs, Agent Doctor record set, SDK build approach
- [Agent Doctor Architecture](docs/AGENT_DOCTOR_ARCHITECTURE.md) — consolidated architecture of the native diagnostic agent: components, ownership boundary, runtime flow, degraded modes
- [Design Spar Record](DESIGN.md) — harness-strategy decisions from adversarial review; the build contract for Phase 1a changes

> Note: the HTML/PDF exports in `docs/` (executive summary, architecture diagram, interactive plan) still reflect PRD v1.1 ("ServiceNow Platform Assistant") and are pending regeneration.

## License

Internal use only.
