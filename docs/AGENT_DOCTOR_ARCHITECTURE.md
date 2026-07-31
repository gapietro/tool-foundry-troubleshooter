# Agent Doctor — Proposed Architecture (Phase 1a)

**Status:** proposed — nothing built. This document consolidates the Agent Doctor design from `LOW_LEVEL_DESIGN.md` (§4–§5), `ARCHITECTURE_DECISIONS.md` (Decision 0.5), and the spar record `../DESIGN.md` (changes 2.1–2.5) into one architectural view.
**What it is:** a native ServiceNow AI Agent (AI Agent Studio, ReAct strategy) that automates the K26 CCL6230 troubleshooting runbook — it diagnoses failing AI Agents on the same instance and produces a Fix Report for the builder AI. It is the Option-A front door whose adequacy the seeded-failure benchmark decides.

---

## 1. Position in the Foundry loop

```
Builder AI (Claude Code + Foundry) ──deploy──> AI Agent on POC instance
        ▲                                            │ fails
        │                                            ▼
        │                                   sn_aia_* execution evidence
        │                                            │
        └── Fix Report (markdown) ◄── Agent Doctor (in-instance, this doc)
                                          │ LLM path dead?
                                          ▼
                              PaEvidenceCollector → Evidence Bundle (no LLM)
```

External AI is prohibited on customer instances; every LLM call Agent Doctor makes goes through the customer's governed GenAI Controller. The compliance rule forces *in-instance* — the choice of a **native** harness over a custom loop is the benchmark-gated bet (see §8).

## 2. Component architecture

```
                        Now Assist panel / VA chat  (channel: nap_and_va)
                                      │
        ┌─────────────────────────────▼──────────────────────────────┐
        │   PLATFORM-OWNED HARNESS (AI Agent Studio, sn_aia scope)   │
        │   ReAct strategy f0bff21f… · scratchpad · tool dispatch    │
        │   instructions = agent-doctor-instructions.md (playbook)   │
        └──────┬───────────────────────────────────────────┬────────┘
               │ 7 × sn_aia_tool (type=script, thin)        │ LLM calls
               ▼                                            ▼
   ┌───────────────────────────┐                 GenAI Controller
   │   PaScriptToolAdapter     │                 (customer's governed
   │  parse → anchor → audit → │                  provider — shared with
   │  execute → threshold →    │                  every patient agent)
   │  stringify (never throws) │
   └──────┬──────────┬─────────┘
          │          │
          ▼          ▼
  ┌──────────────┐ ┌─────────────────────────────────────────────┐
  │  TOOL CORES  │ │  RUN-SIDE SERVICES                          │
  │ (harness-    │ │  PaRunAnchor   → x_pa_run (1 per convo)     │
  │  agnostic    │ │  PaArtifactStore → attachments + paging     │
  │  Script      │ │  PaAuditLogger → x_pa_audit                 │
  │  Includes)   │ └─────────────────────────────────────────────┘
  │ AgentTrace   │
  │ AgentConfig  │      ┌──────────────────────────────────────┐
  │ GenAiLog     │◄─────┤  PaEvidenceCollector (LLM-FREE)      │
  │ SchemaLookup │      │  runs cores in playbook order;       │
  │ QueryTable   │      │  background script / UI action;      │
  │ LogAnalysis  │      │  floor + doctor-down canary          │
  │ (+ read_     │      └──────────────────────────────────────┘
  │  artifact)   │
  └──────┬───────┘
         │ GlideRecordSecure, read-only
         ▼
  sn_aia_execution_plan/_task/_tools_execution/_message · sn_aia_agent/
  _tool/_agent_tool_m2m/_usecase/_trigger_configuration · sys_gen_ai_
  usage_log/_log_metadata (→ sys_generative_ai_log) · sys_cs_* · sys_log
```

## 3. Ownership boundary — what we control vs. inherit

| Concern | Owner | Consequence |
|---|---|---|
| Reasoning loop, tool selection order, stop condition | **Platform** (Studio ReAct) | Playbook order is *suggested* via instructions, not enforced |
| Loop budget | **Platform** (`sn_aia.continuous_tool_execution_limit`, per-m2m `max_auto_executions`) | First ceiling a 12–15-call sweep hits; must be verified + tuned pre-benchmark (DESIGN.md 2.2) |
| Scratchpad / context | **Platform** (128K) | Defused by PaArtifactStore excerpts (≤4KB) + `read_artifact` paging |
| Chat UX, progress feedback | **Platform** | Doctor-down looks identical to patient-down in chat (accepted ceiling, DESIGN.md 2.5) |
| Tool I/O contract | **Us** (adapter) | String-only at the boundary; structured JSON inside; never an empty `{}` failure |
| Evidence durability, audit | **Us** (`x_pa_run`, `x_pa_audit`, attachments) | Same records serve native harness, collector, and (if gated in) custom harness |
| Fix Report shape | **Shared** | Markdown template in instructions; schema *validation* is custom-harness-only — benchmark scores how well native approximates it |

## 4. Tool roster (7 — at the platform's 5–7 ceiling; nothing else gets added)

| Tool (LLM-visible name) | Core | Diagnostic role (K26 mapping) |
|---|---|---|
| `agent_trace` | PaToolAgentTrace | Execution replay: plan → task tree → tool calls → messages (+ `sys_cs_*` context); emits `failure_signature` (incl. `security_violation` → ACL-trigger misalignment) and `latency_flags[]` (instruction vs. tool-output bloat) |
| `agent_config` | PaToolAgentConfig | Agent definition: instructions, tools (+`tool_smells[]` anti-pattern scoring), triggers (+User/Data Access vs. run-as alignment check) |
| `genai_log` | PaToolGenAiLog | LLM call detail, token counts, errors, capability→provider mapping health |
| `schema_lookup` | PaToolSchemaLookup | Table existence + field/choice schema (distinguishes "no table" from "unreadable") |
| `query_table` | PaToolQueryTable | Data verification (≤100 rows, GlideRecordSecure) |
| `log_analysis` | PaToolLogAnalysis | `sys_log`, **mandatory-scoped** (time window + level + source/message conditions) |
| `read_artifact` | PaArtifactStore | Paged reads of stored large outputs (≤4KB/page) |

All tool descriptions follow the K26 three-section framework (Purpose incl. when-not-to-use · Inputs · Outputs & Error Handling). All cores share one contract: `execute(args) → {success, data} | {success:false, error}`; every empty/denied read is an explicit finding, never a silent nothing.

## 5. Runtime flow of one diagnosis

1. User (Now Assist panel): *"diagnose execution `<sys_id>`"* → trigger fires the use case; platform starts the ReAct loop with the playbook instructions.
2. First tool call → adapter → **PaRunAnchor** creates/loads the `x_pa_run` for *this conversation* (hard per-conversation key — time-window fallback disqualified for scored runs, DESIGN.md 2.4); `harness=native`, `status=running`.
3. Loop follows the seven-layer sweep: `agent_trace` summary → signature/flags route the next probe (`agent_config`, `genai_log`, `schema_lookup`/`query_table`, `log_analysis`) → `read_artifact` pages only what the evidence points to.
4. Every call is audit-logged (intent → result/error) and thresholded: >4KB results become attachments + excerpt.
5. Terminal output: **Fix Report** (markdown — failure summary, root causes with trace+config evidence per the evidence rule, current→proposed fixes, verification steps, redaction markers) rendered in chat and stored on the run.

## 6. Degraded modes

| Condition | Behavior | Detection |
|---|---|---|
| GenAI stack broken (doctor and patient share it) | Doctor never reasons; chat shows the same generic failure as the patient | Run **PaEvidenceCollector**: bundle produced ⇒ tables readable ⇒ LLM path is the diagnosis; collector also fails ⇒ cross-scope/ACL problem |
| Cross-scope read denied | Tool returns explicit "cannot read X — permission/scope gap" finding | Install-time readability check over every §2 table (LLD §3) |
| Tool budget exhausted mid-sweep | Partial diagnosis or supervision stall | Benchmark cause-of-death field (`tool_limit`, `supervision_stall`, …— DESIGN.md 2.3); budget tuned pre-benchmark |
| Large trace (Seed-1 shaped) | Artifact store absorbs it; context stays bounded | `read_artifact` paging; excerpts ≤4KB |

## 7. Record set & creation path

19 records in `sn_aia` scope (full table: LLD §5): 1 agent (ReAct strategy, `nap_and_va`) · 7 tools · 7 m2m attachments (`execution_mode` auto — all read-only, `display_output=false`, transformation None) · team · use case (**no** `context_processing_script` — a verified failure vector) · trigger · wiring m2m. Created by **Foundry automation** (idempotent, with rollback), *not* the SDK — they are `sn_aia` data, not our app's metadata. The scoped app itself (tables, Script Includes, collector) ships via the ServiceNow SDK.

## 8. Relationship to the gate

Agent Doctor is deliberately disposable; the benchmark is the load-bearing component (DESIGN.md §1). 5 seeded failures × 2 blind runs, 6-point rubric + cause-of-death per run. ≥8/10 → this architecture is the front door and the custom harness shrinks to the Evidence Bundle path + measured gaps; 5–7 → this becomes triage over a custom deep-diagnosis harness; <5 → full custom harness. Everything below the adapter line in §2 — cores, collector, artifact store, anchor, audit, tables — survives *any* gate outcome unchanged.
