# Foundry Troubleshooter — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal (Phase 1a — execute now):** Build the harness-agnostic diagnostic tools, wrap them in a native ServiceNow AI Agent ("Agent Doctor") via AI Agent Studio, and run the seeded-failure benchmark. The benchmark scorecard decides whether the custom harness (Phase 1b) gets built, and how much of it.

**Strategy:** Tools-first, benchmark-gated — see `docs/ARCHITECTURE_DECISIONS.md` Decision 0.5. The expensive assets (diagnostic tools, playbook, artifact store, audit) are portable across harnesses; nothing built in Phase 1a is wasted regardless of the gate outcome.

**Tech Stack:** ServiceNow JavaScript (Script Includes), AI Agent Studio (native harness), NASK/GenAI Controller (custom harness, contingent), Jest

**PRD:** `docs/PRD_ServiceNow_Platform_Assistant.md` (v2.0)

**Branch:** `feature/phase1a-tools-and-benchmark` — create BEFORE Task 1.

---

## Design Rules for Phase 1a

| Rule | Consequence |
|------|-------------|
| Tool cores are harness-agnostic | Each tool is a Script Include with `execute(args) → {success, data|error}` object API; it never knows who called it |
| Native adapter handles string-only I/O | AI Agent Script tools only pass strings: thin per-tool wrappers do `JSON.parse(input)` / `JSON.stringify(result)` via a shared `PaScriptToolAdapter` |
| Every diagnostic anchors to a run record | `x_snc_pa_run` has a `harness` field (`native`\|`custom`). The native adapter gets-or-creates a run per conversation — artifacts, audit, and benchmark scoring work identically in both worlds |
| `sn_aia_*` mapping containment | Execution-table names/fields appear ONLY in PaToolAgentTrace + PaToolAgentConfig |
| Benchmark is blind | Seeded defects are documented in the scorecard only — never in Agent Doctor's instructions or tool descriptions |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json` (version `2026.07.1801`, jest devDependency, test script)
- Create: `CHANGELOG.md` (entry: v2.0 re-aim + tools-first/benchmark-gated strategy)

**Commit:** `chore: add package.json and changelog`

---

## Task 2: Directory Structure + Table Definitions

**Files:**
- Create directories: `src/instance/script-includes/tools/`, `src/instance/script-includes/adapters/`, `src/instance/script-includes/__tests__/`, `src/instance/agent/` (Agent Doctor definition), `src/instance/tables/`, `benchmark/` (seeded agents + scorecards)
- Create: `src/instance/tables/x_snc_pa_run.json` — number, user, harness (native|custom), agent ref, execution_ref, status, transcript (JSON), context_summary, fix_report (JSON), mode, error
- Create: `src/instance/tables/x_snc_pa_audit.json` — run, user, action_type, tool_name, input, output, target_table, target_record, confirmed_by_user

**What:** Scoped `x_snc_pa_*` tables (schema contract for on-instance creation). The `harness` field is what lets one run table serve both worlds.

**Commit:** `chore: create directory structure and scoped table definitions`

---

## Task 3: The Diagnostic Playbook (Single Source, Two Renderings)

**Files:**
- Create: `src/instance/agent/playbook.md` — the harness-neutral core
- Create: `src/instance/agent/agent-doctor-instructions.md` — native rendering (fits AI Agent Studio's instruction field)

**playbook.md must encode:**
1. Mission: diagnose a failing AI Agent run; terminal output is a Fix Report
2. The seven-layer sweep in order: execution trace → instructions → tool definitions → data schemas → data → GenAI stack → trigger/wiring
3. Evidence rule: every root cause cites trace evidence PLUS at least one config/schema source
4. Fix Report structure: failure_summary, root_causes[] (layer, component, finding, evidence, confidence), fixes[] (target_type, target, current, proposed, rationale), verification[], data markers
5. Privacy rule: fixes reference configuration only; record data flagged for redaction
6. AIA data-model knowledge (per Foundry mapping) + failure-mode catalog v1: tool-schema/table mismatch, ambiguous instruction, missing reference data, unmapped capability, inactive use case/trigger, misleading tool description
7. **ServiceNow's official symptom taxonomy** (K26 CCL6230 guidebook — see LLD §2.5), so diagnoses use the vocabulary the platform's own troubleshooting lab teaches: cold start (incl. **ACL-trigger misalignment** → security violation), inconsistent responses, tool errors, high latency (**instruction bloat** vs. **tool output bloat** — ReAct-engine step slow vs. tool step slow), hallucinated responses (empty/stale retrieval), infinite loops (no completion criteria, conflicting directives, recursive triggers)
8. The guidebook's **quick decision guide** (symptom → first table → our tool) as the playbook's entry-point routing, and its syslog rule: never query `syslog` unscoped — always time-window + level + source/message conditions (table name corrected from `sys_log` per DESIGN.md R-6)
9. Fix vocabulary for latency findings (from K26 Lab 2): offload decision logic to Now Assist Skills, move reference data to KB articles retrieved on demand, consolidate sequential searches into one parallel-executing Skill, return synthesized not raw tool output

**agent-doctor-instructions.md:** the playbook adapted to Studio conventions — no JSON response contract (native tool calling handles dispatch); Fix Report rendered as structured markdown (schema-validated JSON is a custom-harness capability; how well native approximates it is one of the things the benchmark scores). Include tool-usage guidance: use `read_artifact` to page through large evidence rather than re-querying.

**NOTE:** the seeded-failure catalog in `benchmark/` must NOT be referenced here — the playbook teaches the method, not the answers.

**Commit:** `feat: add diagnostic playbook and Agent Doctor instructions`

---

## Task 4: PaArtifactStore — Large Output Handling (Harness-Agnostic)

**Files:**
- Create: `src/instance/script-includes/PaArtifactStore.js`
- Create: `src/instance/script-includes/__tests__/PaArtifactStore.test.js`

**What:** `store(runId, toolName, content)` — over-threshold (~4KB) content saved as attachment on the run record, returns `{artifact_id, excerpt, total_length}`; under threshold returns content unchanged. `read(artifactId, offset, length)` — paged retrieval (max 4KB/page). `_truncate(content, limit)` — head+tail excerpt with elision marker. This is the mitigation for the native harness's string-only I/O and 128K context: big traces live in artifacts, both harnesses page through them.

**Tests (pure logic, TDD):** truncation under/over limit, excerpt shape, paging math, boundaries.

**Commit:** `feat: add PaArtifactStore for large tool outputs with paged reads`

---

## Task 5: PaAuditLogger + PaRunAnchor

**Files:**
- Create: `src/instance/script-includes/PaAuditLogger.js` — `logIntent/logResult/logError` → `x_snc_pa_audit`
- Create: `src/instance/script-includes/PaRunAnchor.js` — `getOrCreate(context)` → run record for the current conversation (native: keyed on the AIA execution/conversation id; custom: explicit run_id). Anchors artifacts + audit for both harnesses.

**Commit:** `feat: add audit logger and run anchor`

---

## Task 6: PaToolAgentTrace — Execution Replay (CORE TOOL)

**Files:**
- Create: `src/instance/script-includes/tools/PaToolAgentTrace.js`

**What:** Reconstructs an AI Agent run step-by-step from `sn_aia_execution_plan` → `sn_aia_execution_task` / `sn_aia_tools_execution` → `sn_aia_message` (+ `sys_cs_conversation`/`sys_cs_message` context when the plan links a conversation — channel type NAP vs. VA, dialogue progression) (per Foundry mapping — names live ONLY here and in PaToolAgentConfig). Args: `execution` (sys_id) OR `agent`+`since`; optional `step` for full detail. Summary mode: per-step sequence, type, tool, args digest, outcome, error. Detail mode: full payloads via PaArtifactStore. Emits `failure_signature` (incl. `security_violation` → ACL-trigger misalignment pointer) and `latency_flags[]` (instruction bloat vs. tool output bloat) per LLD §4.1. GlideRecordSecure throughout; if `sn_aia_*` reads return empty, say so explicitly (worker-user/ACL gaps are a known platform failure mode — an empty trace is itself a diagnostic finding, not a silent nothing).

**Commit:** `feat: add PaToolAgentTrace for step-by-step execution replay`

---

## Task 7: PaToolAgentConfig — Agent Definition Inspection (CORE TOOL)

**Files:**
- Create: `src/instance/script-includes/tools/PaToolAgentConfig.js`

**What:** Args: `agent` (name or sys_id), `section` (overview|instructions|tools|triggers). Returns use case + activation state, full instruction text, attached tools with complete I/O schemas and backing script/flow refs, trigger config. Large bodies via PaArtifactStore. Two K26-derived analyses (LLD §4.2): `tool_smells[]` — each attached tool scored against the Lab 3 anti-pattern checklist (description missing Purpose/Inputs/Outputs-and-errors sections, no input validation, raw/unbounded output, empty-object failure path, redundant overlapping tools); and the **access alignment check** — User Access + Data Access role sets vs. trigger run-as roles, flagging the ACL-trigger misalignment that terminates runs as security violations.

**Commit:** `feat: add PaToolAgentConfig for agent definition inspection`

---

## Task 8: PaToolGenAiLog + Supporting Tools

**Files:**
- Create: `src/instance/script-includes/tools/PaToolGenAiLog.js` — GenAI request logs (timestamp, capability, provider, model, status, error, tokens; default 60-min window, errors_only default) + `check_config` mode (capability→provider mappings, credential existence)
- Create: `src/instance/script-includes/tools/PaToolSchemaLookup.js` — table-level (sys_dictionary) and field-level (+ sys_choice) modes; validates table exists
- Create: `src/instance/script-includes/tools/PaToolQueryTable.js` — GlideRecordSecure query: table, encoded query, fields, limit (default 20, max 100); validates via GlideTableDescriptor
- Create: `src/instance/script-includes/tools/PaToolLogAnalysis.js` — syslog: level/source/message filters, minutes_ago (default 60), limit (default 50, max 100). **Mandatory-scoped** per the K26 guidebook (LLD §4.4): refuses unscoped queries (unfiltered `syslog` reads can slow/time out an instance; table name corrected from `sys_log` per DESIGN.md R-6) with a structured error naming the missing condition; when given an execution context, defaults the window to the plan's start/end ± 2 min and message-contains the plan sys_id

**Commit:** `feat: add GenAI log, schema, query, and syslog diagnostic tools`

---

## Task 9: Script-Tool Adapters (Native Harness Bridge)

**Files:**
- Create: `src/instance/script-includes/adapters/PaScriptToolAdapter.js`
- Create: `src/instance/script-includes/adapters/` — one thin wrapper per tool (7: agent_trace, agent_config, genai_log, schema_lookup, query_table, log_analysis, read_artifact)
- Create: `src/instance/script-includes/__tests__/PaScriptToolAdapter.test.js`

**What:** `PaScriptToolAdapter.invoke(toolScriptInclude, inputString, context)`: parse JSON input string (tolerant — accept bare values for single-arg tools), resolve run anchor, call tool core, audit-log the execution, stringify result. Errors return `{"success":false,"error":"..."}` as a string — never throw into the orchestrator (a documented native pain point is type/shape mismatches confusing the planner). `read_artifact` wrapper exposes PaArtifactStore paging as a native tool.

**Tests (pure logic):** input parsing (JSON object, bare string, malformed), output stringification, error shaping.

**Commit:** `feat: add script-tool adapters bridging tools into AI Agent Studio`

---

## Task 10: Agent Doctor — Native AI Agent Definition

**Files:**
- Create: `src/instance/agent/agent-doctor.json` — agent + use case definition: name, description, instructions (from Task 3), the 7 script tools with input descriptions, supervised-mode flags (all off — every tool read-only), output transformation "None" for tools / conversational for the agent. Every tool description follows the K26 Lab 3 **three-section framework** (Purpose incl. when-not-to-use · Understanding Tool Inputs · Understanding Tool Outputs & Error Handling) — we hold our own tools to the bar the config tool scores customer tools against

**What:** The definition contract for creating Agent Doctor on-instance via Foundry's existing use-case automation (~8 API calls). 7 tools sits at the top of the platform's 5–7 guidance — do NOT add more; anything else goes through query_table.

**On-instance step (documented in the file header):** create via Foundry automation against the dev instance; smoke-test one conversation ("diagnose execution `<sys_id>`") before benchmarking.

**Commit:** `feat: add Agent Doctor native agent definition`

---

## Task 11: Seeded-Failure Benchmark Suite

**Files:**
- Create: `benchmark/README.md` — protocol (below)
- Create: `benchmark/seeds/seed-01-schema-mismatch.md` … `seed-05-inactive-usecase.md` — per seed: the broken agent's definition, the defect, expected root-cause layer, expected fix target, setup steps
- Create: `benchmark/scorecard-template.md`

**The five seeds (from PRD):**

| # | Seeded failure | Expected layer | Expected fix target |
|---|---------------|----------------|--------------------|
| 1 | Tool declares `priority` as free string; table wants integer choice 1–5 | tool_schema | tool input schema |
| 2 | Instruction says "assign to the right group", no lookup guidance | instruction | instruction text |
| 3 | Instruction references a lookup table that is empty on the instance | data | data seeding |
| 4 | GenAI capability not mapped to a provider | genai_stack | capability mapping |
| 5 | Use case exists but is inactive | wiring | activation |

Seed 1's broken agent should produce a **large trace** (multi-step, verbose payloads) so the benchmark exercises artifact paging — the native harness's weakest documented area.

The five seeds cover four of the six symptoms in ServiceNow's official K26 failure taxonomy (LLD §2.5). The remaining two — cold start via ACL-trigger misalignment, and high latency / infinite loops — are specced as **stretch seeds 6–8** in LLD §7: not gate-scored, built after the gate (or swapped in if a core seed proves unbuildable on the shared instance).

**Protocol:**
- Each seed: build the broken agent (via Foundry automation), trigger the failure, capture the execution sys_id
- **2 runs per seed** (fresh conversation each) = 10 scored runs — the doubled runs test the documented "inconsistent behavior on identical inputs" failure mode
- Blind: Agent Doctor's instructions/tools contain no knowledge of the seeds

**Scoring per run (6 points):** root-cause layer correct (2) · fix target correct (2) · evidence cites trace + config/schema (1) · fix output usable by the builder AI without manual editing (1). Also record: iterations/tool calls, assists consumed, wall-clock, and failure behavior (graceful partial vs. wandering/stuck).

**Commit:** `feat: add seeded-failure benchmark suite and scoring protocol`

---

## Task 12: Run the Benchmark → DECISION GATE

**What:** Execute the 10 runs against Agent Doctor on the dev instance; fill `benchmark/scorecard-agent-doctor.md`; write `benchmark/DECISION.md` applying the gate from ADR Decision 0.5:

| Scorecard | Decision |
|-----------|----------|
| **≥ 8/10 runs with correct root cause + usable fixes** | Native is the front door. Phase 1b shrinks to Evidence Bundle mode + whatever specific gaps the scorecard shows |
| **5–7/10** | Native kept for lightweight triage; build the custom deep-diagnosis harness (Phase 1b) |
| **< 5/10** | Full custom harness as designed |

Whatever the outcome, the scorecard's *failure notes* (where it wandered, what it truncated, what it hallucinated) become requirements for Phase 1b and/or playbook v2.

**Commit:** `docs: add benchmark scorecard and harness decision`

---

## Task 13: Jest Run + Branch/PR

**What:** `npm install`; Jest config (testMatch `src/**/__tests__/*.test.js`, node env); `npm test` all green (PaArtifactStore, PaScriptToolAdapter). Push `feature/phase1a-tools-and-benchmark`, open PR summarizing Phase 1a + the benchmark result.

---

## Phase 1b (CONTINGENT — scope set by the Task 12 gate)

Build only what the scorecard demands. Full component specs are in ADR Layers 1–4 and PRD v2.0; summary roster:

- **PaLlmProxy** — NASK invocation, strict-JSON contract, parse-retry (Jest-tested)
- **PaToolRegistry** — registration, destructive-check enforcement, dispatch, prompt generation (tools from Phase 1a reused unchanged)
- **PaFixReport** — schema validation incl. evidence rule, repair loop, markdown/JSON rendering, data markers
- **PaRunManager** — custom-harness run lifecycle, transcript, summarization, Evidence Bundle (`mode: "collect"`) — *the Evidence Bundle is built even in the reduced outcome*
- **PaAgentLoop + async event wiring** — playbook-guided ReAct worker, 15 iterations / 5-min budget, partial-result guarantee
- **Scripted REST API** — `/analyze`, `/runs/{id}`, `/runs/{id}/message`, `/status` (deep GenAI diagnostics), `/tools`
- **Re-run the same benchmark** against the custom harness — same seeds, same scoring — so the two harnesses are compared on identical evidence

Phases 2–4 (UI, deeper tools, gated fix application, pilot) per PRD; Phase 2's UI scope depends on the gate (native front door = native chat, UI phase shrinks to Fix Report export polish).

---

## Dependency Order (Phase 1a)

```
Task 1 (scaffolding) → Task 2 (dirs + tables) → Task 3 (playbook)
  → Task 4 (PaArtifactStore) → Task 5 (audit + run anchor)
    → Tasks 6, 7, 8 (tool cores — parallelizable)
      → Task 9 (adapters)
        → Task 10 (Agent Doctor definition)   → on-instance: create agent
        → Task 11 (benchmark suite)           → on-instance: seed agents
          → Task 12 (RUN BENCHMARK → DECISION)
            → Task 13 (tests + PR)
```

---

## Verification

### Local
- `npm test` — PaArtifactStore truncation/paging, PaScriptToolAdapter parse/stringify/error-shaping all pass

### On-Instance
1. Deploy Script Includes + tables; create Agent Doctor via Foundry automation
2. Smoke test: one conversation diagnosing a real (non-seeded) failed execution — all 7 tools invocable, artifacts paging works, audit rows written with `harness: native`
3. The benchmark itself (Task 12) is the milestone: a filled scorecard and a written harness decision
