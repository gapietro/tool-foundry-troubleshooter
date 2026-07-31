# Foundry Troubleshooter — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal (Phase 1a — execute now):** Build the harness-agnostic diagnostic tools, wrap them in a native ServiceNow AI Agent ("Agent Doctor") via AI Agent Studio, and run the seeded-failure benchmark. The benchmark scorecard decides whether the custom harness (Phase 1b) gets built, and how much of it.

**Strategy:** Tools-first, benchmark-gated — see `docs/ARCHITECTURE_DECISIONS.md` Decision 0.5. The expensive assets (diagnostic tools, playbook, artifact store, audit) are portable across harnesses; nothing built in Phase 1a is wasted regardless of the gate outcome.

**Tech Stack:** ServiceNow SDK 4.9.2 / Fluent DSL (all artifact creation), ServiceNow JavaScript on Rhino (Script Include bodies), AI Agent Studio (native harness runtime), NASK/GenAI Controller (custom harness, contingent), Jest

**PRD:** `docs/PRD_ServiceNow_Platform_Assistant.md` (v2.0)

**Branch:** `feature/phase1a-tools-and-benchmark` — create BEFORE Task 1.

---

## Structural contract — read before Task 1

> **Reconciled 2026-07-30.** This plan was written before the SDK app was scaffolded (commit cc871d2) and originally specified a hand-rolled `src/instance/**` tree with JSON table definitions and agent creation "via Foundry automation". That structure does not exist, and its Task 10 form contradicted CLAUDE.md's SDK/MCP boundary. See DESIGN.md **R-13**.

| Concern | Where it lives | Notes |
|---|---|---|
| Every platform artifact — tables, Script Includes, the AI Agent, REST APIs | **Fluent DSL in `src/fluent/*.now.ts`** | SDK owns creation. `now-sdk build` then `now-sdk install --alias gpinst01` |
| Script Include **bodies** (the JS the platform runs) | `src/server/*.js`, referenced by `Now.include('./<file>.js')` from the Fluent `ScriptInclude` | ES5/Rhino-safe — no `let`/`const`/arrow/`Set`/`Map`. Pattern: `.claude/context/sdk-examples/script-include.now.ts` |
| Runtime execution, tracing, log reads | **Foundry MCP tools** | MCP owns runtime. Never create or edit via MCP anything defined in `src/fluent/` |
| `dist/` | build output | never edit, never commit |

**Scope is `x_snc_troubleshoot`.** Every table this app creates must be named `x_snc_troubleshoot_*` — a scoped table name must begin with its application's exact scope value (verified on gpinst01: 40 of 40 sampled `x_snc_*` tables, no exceptions). The `x_snc_pa_*` / `x_pa_*` names in the older design docs are **placeholders the platform would reject**, not shorthand that expands. `docs/LOW_LEVEL_DESIGN.md` §3 is the authority for table names.

**Build rules that bite hardest here** (full list in `.claude/context/sdk-reference.md`): every `.now.ts` starts with `import '@servicenow/sdk/global'`; table export name must equal the table name; no shorthand properties or ternaries in Fluent files; Script tool scripts must be self-invoking IIFEs `(function(inputs){ … })(inputs);`; never `Now.ref()` for roles/agents/scriptIds in the AI family (Rules #21, #33 — phantom GUIDs that fail silently); `AiAgent` requires `securityAcl`, and its inline `tools[]` entries must NOT carry `$id` (Rule #32); every tool needs a non-empty `description` or the record is silently skipped at install (Rule #34).

---

## Design Rules for Phase 1a

| Rule | Consequence |
|------|-------------|
| Tool cores are harness-agnostic | Each tool is a Script Include with `execute(args) → {success, data|error}` object API; it never knows who called it |
| Native adapter handles string-only I/O | AI Agent Script tools only pass strings: thin per-tool wrappers do `JSON.parse(input)` / `JSON.stringify(result)` via a shared `PaScriptToolAdapter` |
| Every diagnostic anchors to a run record | `x_snc_troubleshoot_run` has a `harness` field (`native`\|`custom`). The native adapter gets-or-creates a run per conversation — artifacts, audit, and benchmark scoring work identically in both worlds |
| `sn_aia_*` mapping containment | Execution-table names/fields appear ONLY in PaToolAgentTrace + PaToolAgentConfig |
| Benchmark is blind | Seeded defects are documented in the scorecard only — never in Agent Doctor's instructions or tool descriptions |
| Every declared input may be absent | R-9: the agent demonstrably failed to pass declared inputs in every Phase 0 probe run. Tool cores must behave correctly with all inputs missing, and must not report a platform fault when the cause is a missing input |
| Never touch the exception object in a cross-scope `catch` | R-1: reading `.message` off a `ScopeAccessNotGrantedException` throws a second time and escapes the handler, killing the whole request. Record `'DENIED'` and move on — LLD §4's "every empty/denied read is an explicit finding" contract depends on this catch surviving |

---

## Task 1: Project Scaffolding

**DONE in part — the SDK scaffold (commit cc871d2) already created `package.json`, `now.config.json`, `src/`, and `dist/`. Do not recreate them.**

**Files:**
- Modify: `package.json` — set `version` to the CLAUDE.md convention (`YYYY.MM.DDXX`) so it stops disagreeing with the README badge; add `jest` devDependency and a `test` script alongside the SDK's existing `build`/`deploy`/`transform`/`types` scripts
- Create: `CHANGELOG.md` (referenced by CLAUDE.md, does not yet exist) — entries for v2.0 re-aim, tools-first/benchmark-gated strategy, and Phase 0

**Commit:** `chore: align version with convention, add changelog and jest`

---

## Task 2: Fluent Table Definitions

**Files:**
- Create: `src/fluent/tables.now.ts` — Fluent `Table()` definitions for both tables (fields per LLD §3.1/§3.2)
- Create directories: `benchmark/` (seeds + scorecards). Fluent artifacts go in the existing `src/fluent/`; Script Include bodies in the existing `src/server/`. No `src/instance/**` tree — that structure was superseded by the SDK scaffold

**Table names (final — LLD §3):**
- **`x_snc_troubleshoot_run`** — number, user, harness (`native`|`custom`), agent ref, execution_ref, status, transcript (JSON), context_summary, fix_report (JSON), mode, error
- **`x_snc_troubleshoot_audit`** — run (ref → `x_snc_troubleshoot_run`), user, action_type, tool_name, input, output, target_table, target_record, confirmed_by_user

**What:** The `harness` field is what lets one run table serve both worlds. Follow `.claude/context/sdk-examples/table.now.ts`; note Build Rule #9 (export name must equal table name) and #8 (`ChoiceColumn` choices are `{ value_key: 'Label' }`, not `[{value,label}]`) — the `harness`, `mode`, `status` and `action_type` columns are all choices.

**Verify:** `now-sdk build` passes, then `now-sdk install --alias gpinst01`, then confirm both tables exist in `sys_db_object` with `sys_scope.scope = x_snc_troubleshoot`.

**Commit:** `feat: add scoped run and audit tables as Fluent definitions`

---

## Task 3: The Diagnostic Playbook (Single Source, Two Renderings)

**Files:**
- Create: `docs/agent/playbook.md` — the harness-neutral core
- Create: `docs/agent/agent-doctor-instructions.md` — native rendering (fits AI Agent Studio's instruction field)

**Note on where the instruction text finally lives:** these two files are the authored source of truth and are reviewed as prose. The native rendering is then carried *inline* into the `instructions` property of the Fluent `AiAgent` in Task 10 — Fluent cannot read a markdown file into a property, and Build Rule #29 forbids string concatenation in property values, so it must be one backtick template literal. Keep the two in sync by hand; Task 10's verification includes a diff check.

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
- Create: `src/server/PaArtifactStore.js` — the Rhino body
- Create: `src/fluent/script-includes.now.ts` — the Fluent `ScriptInclude` declaring it (`script: Now.include('../server/PaArtifactStore.js')`). **Every Script Include in Tasks 4–9 gets a declaration here; a `.js` file alone deploys nothing.** One file for all of them keeps the `$id` set in one place
- Create: `src/server/__tests__/PaArtifactStore.test.js`

**What:** `store(runId, toolName, content)` — over-threshold (~4KB) content saved as attachment on the run record, returns `{artifact_id, excerpt, total_length}`; under threshold returns content unchanged. `read(artifactId, offset, length)` — paged retrieval (max 4KB/page). `_truncate(content, limit)` — head+tail excerpt with elision marker. This is the mitigation for the native harness's string-only I/O and 128K context: big traces live in artifacts, both harnesses page through them.

**Tests (pure logic, TDD):** truncation under/over limit, excerpt shape, paging math, boundaries.

**Commit:** `feat: add PaArtifactStore for large tool outputs with paged reads`

---

## Task 5: PaAuditLogger + PaRunAnchor

**Files:**
- Create: `src/server/PaAuditLogger.js` — `logIntent/logResult/logError` → `x_snc_troubleshoot_audit`
- Create: `src/server/PaRunAnchor.js` — `getOrCreate(context)` → run record for the current conversation (native: keyed on the AIA execution/conversation id; custom: explicit run_id). Anchors artifacts + audit for both harnesses.

**Commit:** `feat: add audit logger and run anchor`

---

## Task 6: PaToolAgentTrace — Execution Replay (CORE TOOL)

**Files:**
- Create: `src/server/tools/PaToolAgentTrace.js`

**What:** Reconstructs an AI Agent run step-by-step from `sn_aia_execution_plan` → `sn_aia_execution_task` / `sn_aia_tools_execution` → `sn_aia_message` (+ `sys_cs_conversation`/`sys_cs_message` context when the plan links a conversation — channel type NAP vs. VA, dialogue progression) (per Foundry mapping — names live ONLY here and in PaToolAgentConfig). Args: `execution` (sys_id) OR `agent`+`since`; optional `step` for full detail. Summary mode: per-step sequence, type, tool, args digest, outcome, error. Detail mode: full payloads via PaArtifactStore. Emits `failure_signature` (incl. `security_violation` → ACL-trigger misalignment pointer) and `latency_flags[]` (instruction bloat vs. tool output bloat) per LLD §4.1. GlideRecordSecure throughout; if `sn_aia_*` reads return empty, say so explicitly (worker-user/ACL gaps are a known platform failure mode — an empty trace is itself a diagnostic finding, not a silent nothing).

**Commit:** `feat: add PaToolAgentTrace for step-by-step execution replay`

---

## Task 7: PaToolAgentConfig — Agent Definition Inspection (CORE TOOL)

**Files:**
- Create: `src/server/tools/PaToolAgentConfig.js`

**What:** Args: `agent` (name or sys_id), `section` (overview|instructions|tools|triggers). Returns use case + activation state, full instruction text, attached tools with complete I/O schemas and backing script/flow refs, trigger config. Large bodies via PaArtifactStore. Two K26-derived analyses (LLD §4.2): `tool_smells[]` — each attached tool scored against the Lab 3 anti-pattern checklist (description missing Purpose/Inputs/Outputs-and-errors sections, no input validation, raw/unbounded output, empty-object failure path, redundant overlapping tools); and the **access alignment check** — User Access + Data Access role sets vs. trigger run-as roles, flagging the ACL-trigger misalignment that terminates runs as security violations.

**Commit:** `feat: add PaToolAgentConfig for agent definition inspection`

---

## Task 8: PaToolGenAiLog + Supporting Tools

**Files:**
- Create: `src/server/tools/PaToolGenAiLog.js` — GenAI request logs (timestamp, capability, provider, model, status, error, tokens; default 60-min window, errors_only default) + `check_config` mode (capability→provider mappings, credential existence)
- Create: `src/server/tools/PaToolSchemaLookup.js` — table-level (sys_dictionary) and field-level (+ sys_choice) modes; validates table exists
- Create: `src/server/tools/PaToolQueryTable.js` — GlideRecordSecure query: table, encoded query, fields, limit (default 20, max 100); validates via GlideTableDescriptor
- Create: `src/server/tools/PaToolLogAnalysis.js` — syslog: level/source/message filters, minutes_ago (default 60), limit (default 50, max 100). **Mandatory-scoped** per the K26 guidebook (LLD §4.4): refuses unscoped queries (unfiltered `syslog` reads can slow/time out an instance; table name corrected from `sys_log` per DESIGN.md R-6) with a structured error naming the missing condition; when given an execution context, defaults the window to the plan's start/end ± 2 min and message-contains the plan sys_id

**Commit:** `feat: add GenAI log, schema, query, and syslog diagnostic tools`

---

## Task 9: Script-Tool Adapters (Native Harness Bridge)

**Files:**
- Create: `src/server/adapters/PaScriptToolAdapter.js`
- Create: `src/server/adapters/` — one thin wrapper per tool (7: agent_trace, agent_config, genai_log, schema_lookup, query_table, log_analysis, read_artifact)
- Create: `src/server/__tests__/PaScriptToolAdapter.test.js`

**What:** `PaScriptToolAdapter.invoke(toolScriptInclude, inputString, context)`: parse JSON input string (tolerant — accept bare values for single-arg tools), resolve run anchor, call tool core, audit-log the execution, stringify result. Errors return `{"success":false,"error":"..."}` as a string — never throw into the orchestrator (a documented native pain point is type/shape mismatches confusing the planner). `read_artifact` wrapper exposes PaArtifactStore paging as a native tool.

**Tests (pure logic):** input parsing (JSON object, bare string, malformed), output stringification, error shaping.

**Commit:** `feat: add script-tool adapters bridging tools into AI Agent Studio`

---

## Task 10: Agent Doctor — Native AI Agent Definition

**Files:**
- Create: `src/fluent/agent-doctor.now.ts` — a Fluent `AiAgent`: name, description, instructions (the Task 3 native rendering, inline as one backtick template), the 7 script tools with input descriptions, supervised-mode flags (all off — every tool read-only), output transformation "None" for tools / conversational for the agent. Every tool description follows the K26 Lab 3 **three-section framework** (Purpose incl. when-not-to-use · Understanding Tool Inputs · Understanding Tool Outputs & Error Handling) — we hold our own tools to the bar the config tool scores customer tools against

**What:** Agent Doctor, created by the SDK. 7 tools sits at the top of the platform's 5–7 guidance — do NOT add more; anything else goes through query_table.

> **Changed 2026-07-30 (DESIGN.md R-13).** This task previously specified a hand-written `agent-doctor.json` "created on-instance via Foundry's existing use-case automation (~8 API calls)". That is MCP-side creation of an artifact the SDK owns, which CLAUDE.md forbids: *"SDK owns creation. Agents, tools, tables, flows — defined as Fluent DSL in `src/fluent/`."* The agent is now a Fluent artifact, versioned in git and deployed by `now-sdk install`. Pattern: `.claude/context/sdk-examples/ai-agent.now.ts`.

**Fluent specifics that will otherwise cost a rebuild** (all from `.claude/context/sdk-reference.md`):
- `securityAcl` is **mandatory** — build fails with `TS210` without it. Use `type: 'Any authenticated user'` unless a role gate is wanted; if `'Specific role'`, pass **direct sys_id strings**, never `Now.ref` (Rule #21 — phantom GUIDs, silent failure)
- Inline `tools[]` entries must **NOT** carry `$id` (Rule #32) — the SDK generates their record IDs
- Every tool needs a non-empty `description` (Rule #34) — an empty one trips a platform Data Policy and the tool record is **silently skipped at install** while its m2m rows still install, leaving phantom tool references
- Script tool `script` is a top-level self-invoking IIFE string: `(function(inputs){ … })(inputs);` — a missing `(inputs)` builds and installs cleanly and fails only at runtime (Rule #19)
- `input_schema` is an **array** of `{name, description, mandatory}` — a JSON-Schema object causes a silent, never-terminating stall (DESIGN.md R-5). This is the single most expensive defect found in Phase 0
- No `triggerConfig` here — Agent Doctor is invoked conversationally, and `triggerConfig` on a bare `AiAgent` yields a trigger with a null usecase that never fires (Rule #31)

**On-instance step:** `now-sdk build` → `now-sdk install --alias gpinst01`, then smoke-test one conversation ("diagnose execution `<sys_id>`") via MCP before benchmarking. Verify the deployed `instructions` text matches `docs/agent/agent-doctor-instructions.md`.

**Commit:** `feat: add Agent Doctor as a Fluent AiAgent definition`

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
- Each seed: build the broken agent, trigger the failure, capture the execution sys_id

> **OPEN — decide before Task 11, not during it (raised 2026-07-30, DESIGN.md R-13).** How the five deliberately-broken seed agents get created is genuinely unsettled, and the two obvious answers are both wrong as stated:
> - **Fluent in `src/fluent/`** gives reproducibility — Phase 1b re-runs this same benchmark against the custom harness, and the comparison is only valid on identical seeds. But it would ship five broken agents inside the product app to any customer who installs it.
> - **MCP/Foundry automation** keeps them out of the app, but CLAUDE.md requires anything prototyped via MCP to be ported to Fluent before the session ends, and hand-built seeds are not reliably reproducible months later.
>
> Likely resolution is a **separate scoped app** for the benchmark fixtures (Fluent, reproducible, never installed alongside the product), but that costs a second scope and a second install target. Not decided here.
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
Task 1 (version + changelog) → Task 2 (Fluent tables) → Task 3 (playbook)
  → Task 4 (PaArtifactStore) → Task 5 (audit + run anchor)
    → Tasks 6, 7, 8 (tool cores — parallelizable)
      → Task 9 (adapters)
        → Task 10 (Fluent AiAgent)   → now-sdk build + install
        → Task 11 (benchmark suite)  → on-instance: seed agents
          → Task 12 (RUN BENCHMARK → DECISION)
            → Task 13 (tests + PR)
```

**Deviation for the first tool core.** `docs/BUILD_BRIEF_PaToolAgentTrace.md` starts at **Task 6** (`PaToolAgentTrace`) ahead of Tasks 4 and 5, deliberately: the trace tool's summary mode is useful without artifact paging, and building it first proves the `sn_aia_*` reads before more scaffolding is poured on top. That is a sanctioned reordering, not a skip — the brief says so explicitly. Tasks 4 and 5 must land before Task 9 (the adapter resolves the run anchor and audit-logs every call), and detail mode stays deferred until PaArtifactStore exists.

---

## Verification

### Local
- `now-sdk build` — must pass before any install; type errors first
- `npm test` — PaArtifactStore truncation/paging, PaScriptToolAdapter parse/stringify/error-shaping all pass

### On-Instance
1. `now-sdk install --alias gpinst01` — deploys tables, Script Includes and Agent Doctor together. Confirm the tables landed in `sys_db_object` under `sys_scope.scope = x_snc_troubleshoot`, and that the agent's tool records exist in `sn_aia_tool` (Rule #34: a tool whose record was silently skipped still leaves its `sn_aia_agent_tool_m2m` row, so checking the m2m alone proves nothing)
2. Smoke test via MCP: one conversation diagnosing a real (non-seeded) failed execution — all 7 tools invocable, artifact paging works, audit rows written with `harness: native`
3. The benchmark itself (Task 12) is the milestone: a filled scorecard and a written harness decision

**Guard against the Phase 0 failure mode.** Several of these reads return blanks rather than errors — a wrong field name yields rows with the field silently absent (R-6), and a partial result reads as absence (R-11, the retracted `v_plugin` finding). Assert on field presence; never infer "no data" from an absent field; state explicitly which rows the output came from.
