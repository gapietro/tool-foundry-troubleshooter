# Phase 1b Custom Deep-Diagnosis Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the custom deep-diagnosis harness the Task 12 gate mandated (7/10, middle band): PaLlmProxy, PaToolRegistry, PaFixReport, PaRunManager (with run-lifecycle close-out), PaAgentLoop with async event wiring, and the Scripted REST API — then re-run the same benchmark against it.

**Architecture:** A server-side playbook-guided ReAct loop (PaAgentLoop) driven asynchronously by a platform event + Script Action, reasoning through PaLlmProxy (the sole NASK touchpoint, strict-JSON contract), dispatching the unchanged Phase 1a tool cores through PaToolRegistry, persisting every iteration to `x_snc_troubleshoot_run` via PaRunManager, and terminating in a PaFixReport-validated report or an LLM-free Evidence Bundle. Specs: ADR Decision 0.5 Layers 1–4, PRD v2.0 "Server-Side Components", LLD §3, DECISION.md §D/§E.

**Tech Stack:** ServiceNow SDK 4.9.2 Fluent DSL (`src/fluent/`), ES5/Rhino Script Includes (`src/server/`), Jest (`test/`, node env), NASK skills via Fluent `NowAssistSkillConfig`, foundry MCP for runtime verification on gpinst01.

## Global Constraints

- **SDK owns creation, MCP owns runtime** (CLAUDE.md): every record ships as Fluent in `src/fluent/`; runtime testing via `servicenow_connect` keychain → gpinst01. Never modify via MCP what exists in Fluent.
- **Branch + PR per task, issue per task, never commit to main.** Version bump `YYYY.MM.DDXX` per merge.
- **`now-sdk build` green before any install claim; `npm test` green before any commit.**
- **ES5/Rhino only** in `src/server/` — `var`, no arrow/let/const/template literals. Class shape: `Class.create()` + `.prototype`, matching every existing include.
- **Table/scope names:** scope `x_snc_troubleshoot`; run table `x_snc_troubleshoot_run`, audit `x_snc_troubleshoot_audit` (LLD §3 is the authority; PRD's `x_snc_pa_*` is historical prose). REST base path `/api/x_snc_troubleshoot/troubleshooter`.
- **The tool cores are reused UNCHANGED** (IMPLEMENTATION_PLAN Phase 1b). The registry adapts to their contract — `execute(args) → {success:true, data} | {success:false, error}` — not the other way round.
- **Standing rulings:** R-1 (never read exception objects), R-6 (blank ≠ absence), R-9 (every input may be absent), R-11 (partial ≠ absence), R-19b (statuses are what consumers gate on — they must not contradict notes).
- **Build Rules that bite here:** #43 (no backtick/backslash-escape/`${}` in any Fluent template — keep scripts in `src/server/` via `Now.include`), #19 (IIFE + trailing `(inputs);`), #21/#33 (no `Now.ref` in the AI family; direct sys_id strings), Rules #35–#40 for the NASK skills (script-condition decisions n/a here, but: skills install DEACTIVATED — activation is a documented post-install step; input names underscore-normalize; tool/skill naming constraints).
- **Never commit `dist/`, `.snc/`, `.now/`, credentials.**

## File Structure

```
src/server/PaLlmProxy.js            sole NASK wrapper: reason/summarize, strict-JSON parse + one retry
src/server/PaToolRegistry.js        roster, metadata, dispatch, destructive gate, prompt block
src/server/PaFixReport.js           schema validation (evidence rule), repair prompt, md/json render, data markers
src/server/PaRunManager.js          run CRUD, transcript, summarization, close-out, Evidence Bundle
src/server/PaAgentLoop.js           the async ReAct worker
src/fluent/nask-skills.now.ts       pa_llm_reason + pa_llm_summarize NowAssistSkillConfig
src/fluent/async-wiring.now.ts      sysevent_register record + ScriptAction worker stub
src/fluent/rest-api.now.ts          Scripted REST API, 5 routes (bodies via Now.include or thin inline)
src/server/rest/PaRestHandlers.js   route handler bodies (testable, included from rest-api.now.ts)
test/PaLlmProxy.test.js             parse contract, retry, seam injection
test/PaToolRegistry.test.js         roster completeness, dispatch, gate
test/PaFixReport.test.js            validation matrix, repair, rendering
test/PaRunManager.test.js           lifecycle, transcript, summarize trigger, bundle, close-out
test/PaAgentLoop.test.js            loop skeleton with injected seams
test/PaRestHandlers.test.js         request validation, owner gate, status shapes
benchmark/scorecard-custom-harness.md   comparison re-run scorecard (Task 10 here)
```

Each Script Include mirrors the established constructor-injection pattern (`initialize(options)` accepting overrides for its collaborators) so Jest drives it with the `_glideStub`/`_loadScriptInclude` harness already in `test/`.

---

### Task 1: NASK skills (Fluent) + invocation-path verification

**Files:**
- Create: `src/fluent/nask-skills.now.ts`
- Reference: `.claude/context/sdk-examples/now-assist-skill.now.ts` (RUNTIME INVOCATION COMPANION notes), Build Rules #11, #21–#24, #33, #35–#40

**Interfaces:**
- Produces: two installed skills named `pa_llm_reason` (temp 0.2, max 2000 tokens) and `pa_llm_summarize` (temp 0.1, max 1000 tokens), each with ONE input `prompt` (string) and a passthrough template — the entire prompt is composed server-side by PaAgentLoop/PaLlmProxy; the skill adds nothing.
- Produces (knowledge, for Task 2): the verified runtime invocation call + payload shape, recorded in the file header and in `docs/LOW_LEVEL_DESIGN.md` §4 addendum.

- [ ] **Step 1: Verify the invocation path BEFORE writing the proxy.** Phase-0-style probe, MCP only, no build: on gpinst01 execute an existing installed NASK skill (`servicenow_skill_execute`, or a background-script `sn_one_extend.OneExtendUtil` call per the now-assist-skill golden example's companion notes) and record: the API called, the exact payload (skill sys_id vs name, `{prompt: ...}` input keying after underscore-normalization, Rule #38), and the response envelope path to the model text. If the documented path fails, STOP — file the finding; PaLlmProxy's seam design (Task 2) does not proceed on a guessed call.
- [ ] **Step 2: Write the Fluent skills.** Follow `now-assist-skill.now.ts` Example 4's minimal shape: `NowAssistSkillConfig` with `securityControls.roleMap` (role names, never `Now.ref` — Rule #21), one `string` input named `prompt`, prompt template exactly `{{prompt}}`, no tools, no decisions, provider left to instance default. Two configs, `$id` keys `pa-llm-reason-skill` / `pa-llm-summarize-skill`. Set temperature/max-token fields only if the SDK exposes them on this shape (`now-sdk explain nowassistskillconfig`); otherwise record them as skill-config records to set post-install and note it in the header.
- [ ] **Step 3: Build.** `now-sdk build` — green before proceeding.
- [ ] **Step 4: Install + activate + micro-invoke.** `now-sdk install --alias gpinst01`; activate both skills (Rule #40: they install deactivated — `PATCH sn_nowassist_skill_config_status/<sys_id> {"active":"true"}` via MCP); execute `pa_llm_reason` once with a trivial prompt and confirm a non-empty completion. Record the round-trip in the PR.
- [ ] **Step 5: Commit** on `feature/phase1b-nask-skills`, PR referencing this task's issue.

### Task 2: PaLlmProxy

**Files:**
- Create: `src/server/PaLlmProxy.js`, `test/PaLlmProxy.test.js`
- Reference: ADR Layer 4 (strict-JSON contract), Task 1's verified invocation path

**Interfaces:**
- Produces:
  - `reason(prompt) → {success:true, action:Object, raw:String, retried:Boolean} | {success:false, error:String, raw:String|null}` — `action` is the parsed `{action:'tool_call', tool, args}` / `{action:'answer', text}` / `{action:'fix_report', report}` object.
  - `summarize(prompt) → {success:true, text:String} | {success:false, error:String}` — plain text, no JSON contract.
  - `_parseResponse(raw) → {ok:true, action} | {ok:false, reason}` — pure string logic, no Glide.
  - `initialize({invoke})` — `invoke(skillName, prompt) → {success, text|error}` seam; the default implementation is the ONLY code in the codebase that knows NASK exists.

- [ ] **Step 1: Write the failing parse-contract tests.** The documented matrix, one `it` each:

```javascript
const cases = [
    ['valid tool_call', '{"action":"tool_call","tool":"agent_trace","args":{"execution":"abc"}}', true],
    ['valid answer', '{"action":"answer","text":"done"}', true],
    ['valid fix_report', '{"action":"fix_report","report":{"failure_summary":"x"}}', true],
    ['fenced JSON', '```json\n{"action":"answer","text":"ok"}\n```', true],
    ['leading prose then JSON', 'Sure, here it is: {"action":"answer","text":"ok"}', true],
    ['malformed JSON', '{"action":"tool_call",', false],
    ['empty response', '', false],
    ['valid JSON, unknown action', '{"action":"delete_everything"}', false],
    ['valid JSON, no action key', '{"tool":"agent_trace"}', false],
]
```

Plus: `tool_call` without a `tool` name is `ok:false`; the `reason` string on every failure names what was wrong (the retry prompt embeds it).
- [ ] **Step 2: Run** `npx jest test/PaLlmProxy.test.js` — expect failures (module absent).
- [ ] **Step 3: Implement `_parseResponse`** (ES5): trim; strip a single leading/trailing markdown fence; locate first `{` and last `}` and `JSON.parse` the slice inside a try (R-1 style: the catch does not read the exception); validate `action` against the three known values and per-action required fields.
- [ ] **Step 4: Write the failing reason/retry tests.** With an injected `invoke` stub: first response malformed → exactly ONE re-prompt whose text contains the parse failure reason and "JSON only"; second response valid → `{success:true, retried:true}`. Two malformed → `{success:false}` carrying the raw text. Invoke-level failure (`{success:false}` from the seam) → no retry, error states the LLM layer (not the parse layer) failed — the distinction is what `/status` and the Evidence Bundle advice hang on.
- [ ] **Step 5: Implement `reason()`/`summarize()`** over the seam; wire the default `invoke` to Task 1's verified call, isolated in one method `_invokeNask` with the LLD-addendum reference in its comment.
- [ ] **Step 6: Full suite green, commit** on `feature/phase1b-llm-proxy`.

### Task 3: PaToolRegistry

**Files:**
- Create: `src/server/PaToolRegistry.js`, `test/PaToolRegistry.test.js`
- Reference: ADR Layer 5; `src/server/PaScriptToolAdapter.js` (the native counterpart — the registry is the custom-harness sibling of its tool map)

**Interfaces:**
- Consumes: the seven Phase 1a cores (unchanged) + `PaArtifactStore.read` for `read_artifact`.
- Produces:
  - `list() → [{name, layer, description, readOnly:true}]` — the roster; name set MUST equal PaScriptToolAdapter's registry keys (the derived-completeness rule R-20 counts distinct `tool_name` audit values; a drift makes a full sweep look partial).
  - `dispatch(name, args, runCtx) → {success, data|error}` — resolves the core, audit-logs intent/result/error via PaAuditLogger, applies PaArtifactStore.applyThreshold with `runCtx.run_id`, refuses unknown names with the roster in the error.
  - `promptBlock() → String` — the tools section for the reasoning prompt, generated from the same descriptions the native agent carries (single source: read them from the registry metadata, not a second copy).
  - Destructive gate: every Phase 1 tool registers `readOnly:true`; `dispatch` REFUSES any registration or call marked destructive with "confirmation flow is Phase 3" — the gate exists and is tested now so Phase 3 adds a flow, not a bypass.

- [ ] **Step 1: Failing tests:** roster equals the adapter's seven names + `read_artifact` (read both sources the way `agentDoctorInstructions.test.js` reads the fluent/adapter pair); dispatch of a stubbed core returns its result and writes intent+result audit rows (stub PaAuditLogger, assert calls); dispatch of unknown name → `{success:false}` error listing valid names; a hypothetical `{destructive:true}` registration → dispatch refused; artifact threshold applied (stub `applyThreshold`, assert called with run id).
- [ ] **Step 2: Run — red.** `npx jest test/PaToolRegistry.test.js`
- [ ] **Step 3: Implement** with constructor-injected collaborators (`{cores, auditLogger, artifactStore}`) defaulting to the real ones.
- [ ] **Step 4: Green + full suite + commit** on `feature/phase1b-tool-registry`.

### Task 4: PaFixReport

**Files:**
- Create: `src/server/PaFixReport.js`, `test/PaFixReport.test.js`
- Reference: the Fix Report shape in `docs/agent/agent-doctor-instructions.md` (the two renderings must describe the SAME report), ADR Layer 3 evidence rule

**Interfaces:**
- Produces:
  - `validate(report) → {valid:true, normalized} | {valid:false, problems:[String]}` — required: `failure_summary` (string), `layers_swept` (all seven, each `SWEPT|NOT_SWEPT|UNAVAILABLE` with a reason for the latter two), `root_causes[]` (`layer`, `component`, `finding`, `evidence` with at least a trace citation PLUS one config/schema/data citation — the evidence rule, enforced structurally here and not only in the prompt), `fixes[]` (`target_type`, `target`, `current`, `proposed`, `rationale`), `verification`, `data_markers[]` (may be empty, must be present).
  - `repairPrompt(report, problems) → String` — one repair loop: the problems list verbatim + the schema + "return the corrected fix_report JSON only".
  - `renderMarkdown(normalized) → String` / `renderJson(normalized) → String` — markdown mirrors the playbook's report section order.
- Consumed by: PaAgentLoop (validate → one repair via PaLlmProxy → accept or fail the run with the best invalid draft attached and the problems stated).

- [ ] **Step 1: Failing validation-matrix tests:** a fully valid report normalizes; each required block missing → named problem; a root cause whose evidence cites only the trace → `evidence rule` problem naming the cause; `layers_swept` missing a layer or using an unknown state → problem; unknown extra keys survive normalization untouched (the LLM may add insight; validation is a floor not a ceiling).
- [ ] **Step 2: Run — red.**
- [ ] **Step 3: Implement `validate`** (pure ES5 object-walking, no Glide).
- [ ] **Step 4: Failing rendering + repair tests:** markdown contains the six section headings in playbook order; data markers render under DATA MARKERS; `repairPrompt` contains every problem string and the phrase `JSON only`.
- [ ] **Step 5: Implement rendering + repairPrompt; green; commit** on `feature/phase1b-fix-report`.

### Task 5: PaRunManager (incl. the §D5 close-out)

**Files:**
- Create: `src/server/PaRunManager.js`, `test/PaRunManager.test.js`
- Modify: none — `x_snc_troubleshoot_run` already carries `transcript`, `context_summary`, `fix_report`, `error`, and the five status choices (built at Task 2/Phase 1a; LLD §3.1)
- Reference: LLD §3.1/§4.6, DECISION.md §D5, DESIGN.md R-20

**Interfaces:**
- Consumes: `PaRunAnchor.getOrCreate` (custom-path: explicit ids, caller-supplied identity allowed per §4.6 point 5), `PaArtifactStore`, `PaLlmProxy.summarize`, `PaToolRegistry` (bundle mode).
- Produces:
  - `createRun({user, agent, executionRef, mode}) → {run_id, number}` with `harness:'custom'`, `status:'queued'`.
  - `appendTranscript(runId, entry)` — entry `{seq, actor:'llm'|'tool'|'system', tool?, args_digest, result_digest, artifact_id?, ts}`; digests through the established 200-char digest convention; writes after EVERY iteration (the polling UI reads this).
  - `loadContext(runId) → {transcript:[...], context_summary}` and `maybeSummarize(runId)` — past 10 entries, `summarize()` compresses all but the newest 5 into `context_summary`; artifact refs are carried into the summary text verbatim (they must survive summarization — ADR Layer 6).
  - `close(runId, status, {fixReport?, error?})` — the lifecycle close-out: guards legal transitions (`queued|running → complete|failed`; `awaiting_confirmation` never expires and is not closeable by the sweep), stamps `fix_report`/`error`.
  - `collectBundle(runId) → {success, data:{layers:{...}}}` — Evidence Bundle: runs trace/config/schema/genai tools via the registry with NO LLM, organized by the seven layers, honest per-layer status (a DENIED read is reported as DENIED — R-11).
  - `sweepStaleNative({maxAgeHours}) → {closed:[run_id]}` — **the §D5 decision, made explicit:** native anchors stay `running` because the native harness emits no completion signal and R-20 rejected every way of declaring one; completeness remains audit-derived and that is NOT revisited here. What §D5 does demand is that anchors stop accumulating as `running` forever, so the sweep closes native runs with no audit row in `maxAgeHours` (default 24) as `complete`, appending a system transcript entry `{actor:'system', result_digest:'stale-closed by lifecycle sweep; completeness remains audit-derived (R-20)'}`. Wired to a `ScheduledScript` in Task 7's Fluent.

- [ ] **Step 1: Failing lifecycle tests:** create → queued/custom; legal and illegal `close` transitions (illegal returns `{success:false}` naming the transition, never throws); `awaiting_confirmation` unaffected by sweep; stale sweep closes only native runs older than the threshold with no recent audit rows, and its transcript entry carries the R-20 citation.
- [ ] **Step 2: Run — red; implement create/append/close/sweep** against the `_glideStub` querying stub.
- [ ] **Step 3: Failing summarization tests:** 11 entries → `summarize` stub called with the 6 oldest, `context_summary` set, newest 5 verbatim, artifact ids from summarized entries present in the summary input; `summarize` failure → transcript untouched, run NOT failed (summarization is an optimization, its failure is a note).
- [ ] **Step 4: Failing bundle tests:** registry stub called once per collection tool with no LLM proxy in the object graph at all (construct PaRunManager without a proxy and assert bundle still works — the LLM-free floor is structural); per-layer statuses pass DENIED through.
- [ ] **Step 5: Implement; green; full suite; commit** on `feature/phase1b-run-manager`.

### Task 6: PaAgentLoop

**Files:**
- Create: `src/server/PaAgentLoop.js`, `test/PaAgentLoop.test.js`
- Reference: ADR Layer 3; the playbook (`docs/agent/agent-doctor-instructions.md`) is the system-prompt source — read at build from the same text the native agent carries, single-sourced

**Interfaces:**
- Consumes: `PaLlmProxy.reason`, `PaToolRegistry.dispatch/promptBlock`, `PaRunManager` (transcript, close), `PaFixReport` (validate/repair).
- Produces: `run(runId, request) → {success, outcome:'fix_report'|'answer'|'partial'|'failed'}` — the Script Action entry point. Bounds: `MAX_ITERATIONS: 15`, `BUDGET_MS: 300000`, checked before each iteration; on either bound the loop emits its best partial diagnosis with `outcome:'partial'` and an explicit incomplete flag in the transcript — never a silent stop (the R-3 lesson: premature completion must be visible).

- [ ] **Step 1: Failing loop-skeleton tests** (all seams injected, zero Glide):
  - happy path: reason→tool_call→dispatch→observe repeated twice, then answer → run closed `complete`, transcript has llm+tool entries per iteration;
  - fix_report path: valid report → validated, rendered, stored, closed `complete`;
  - invalid report → ONE repair via `repairPrompt` → valid → complete; invalid twice → closed `failed` with the problems and the raw draft preserved;
  - iteration bound: reason stub always calls tools → exactly 15 iterations, closed `complete` with `outcome:'partial'` and incomplete flag;
  - clock bound: injected clock passes budget after 3 iterations → partial (inject a `now()` seam — `Date.now` is fine in Jest but the seam is what the Rhino impl uses via `new GlideDateTime().getNumericValue()`);
  - LLM failure mid-run: reason `{success:false}` → run closed `failed`, error text advises `mode: "collect"` (the Evidence Bundle floor) and `/status`;
  - unknown tool requested: dispatch error fed back as the observation (the model gets to re-plan), not a crash.
- [ ] **Step 2: Run — red; implement** the loop as a plain iteration driver: `_buildPrompt(playbook, promptBlock, context, request)`, `_step()`, bounds checks first. No confirmation flow (Phase 3) — but the `awaiting_confirmation` branch left as an explicit refusal comment citing the ADR.
- [ ] **Step 3: Green; full suite; commit** on `feature/phase1b-agent-loop`.

### Task 7: Async wiring + Scripted REST API (Fluent)

**Files:**
- Create: `src/fluent/async-wiring.now.ts` (event registration + ScriptAction + the stale-sweep ScheduledScript), `src/fluent/rest-api.now.ts`, `src/server/rest/PaRestHandlers.js`, `test/PaRestHandlers.test.js`
- Reference: `.claude/context/sdk-examples/rest-api.now.ts`, `scheduled-script.now.ts`; `now-sdk explain scriptaction`; Build Rule #43 (bodies live in `src/server/rest/`, `Now.include`d — no inline script beyond one-line delegation)

**Interfaces:**
- Produces: event `x_snc_troubleshoot.run.start` (fired with `run_id` in parm1); ScriptAction invoking `new PaAgentLoop().run(parm1, parm2)`; ScheduledScript (daily) calling `PaRunManager.sweepStaleNative({})`; REST routes:

| Route | Method | Handler contract |
|---|---|---|
| `/analyze` | POST | validate body (one of `execution`, `agent`+`timeframe`, `logs`; optional `mode:'collect'`); `createRun`; `collect` runs the bundle synchronously (no LLM, fast) and returns it; otherwise `gs.eventQueue('x_snc_troubleshoot.run.start', runGr, run_id, request_json)` and 202 `{run_id, status:'queued'}` |
| `/runs/{run_id}` | GET | owner-only (`user == gs.getUserID()`; a non-owner gets the SAME 404 as a nonexistent run — no existence oracle); status + transcript + fix_report when complete |
| `/runs/{run_id}/message` | POST | synchronous single-turn follow-up on a `complete` run (short reason() call with run context); on any other status → 409 naming the status |
| `/status` | GET | deep checks, each `{check, status, detail}`: plugins (Now Assist, GenAI Controller, sn_aia), the two skills exist AND active (Rule #40 is exactly the state this catches), capability-to-provider mapping for them, one live micro-invocation of `pa_llm_reason`, §2-table readability, stuck-run count (`running` custom runs older than budget) |
| `/tools` | GET | `PaToolRegistry.list()` |

- [ ] **Step 1: Failing handler tests** (handlers are plain objects taking `{body, pathParams, userId}` and returning `{status, body}` — the Fluent route is a one-line adapter): analyze validation matrix (each missing-input case names the missing field; collect returns a bundle inline; diagnose returns 202 + queued), owner gate (non-owner and nonexistent are byte-identical 404s), message-on-running → 409, status aggregates check results and its top-level `ready` is false when ANY check fails (R-19b: the status is what a consumer gates on).
- [ ] **Step 2: Run — red; implement handlers.**
- [ ] **Step 3: Write the Fluent** (routes → `Now.include` handlers; event + ScriptAction + ScheduledScript). `now-sdk build` green. Watch rest-api gotchas from the golden example: numeric `versions[].version`, `$id` on versions and routes, route→version linkage.
- [ ] **Step 4: Install to gpinst01; runtime-verify via MCP:** POST /analyze (collect) returns a bundle; POST /analyze (diagnose) → poll GET /runs/{id} until `complete`; GET /status all-green after skill activation; confirm the run row left `running`. This is the harness's first end-to-end run — diagnose the Task 12 smoke specimen `c9d63a932bda8b9417a6ffbeee91bfd0` and sanity-check the Fix Report against the known answer (`context_processing_script` line 42).
- [ ] **Step 5: Commit** on `feature/phase1b-async-rest`.

### Task 8: Assist-unit measurement source (§D5)

**Files:**
- Modify: `benchmark/README.md` (measurement-source section), `docs/LOW_LEVEL_DESIGN.md` (§8 open item)

- [ ] **Step 1: Probe, MCP read-only:** is `sn_value_ai_consumption` populated on gpinst01 now? Any alternative (`sys_gen_ai_usage_log` aggregation, license dashboards)? Timebox the probe; the outcome is a documented DECISION either way.
- [ ] **Step 2: Record the decision:** if a source exists, specify the per-run read for the scorecard; if not, declare LLM-call counts the proxy for the comparison (both harnesses measured identically) and mark assist-units NOT COMPARABLE to entitlement units. Commit as docs PR.

### Task 9: Comparison re-run readiness gate

**Files:**
- Modify: `benchmark/README.md` (re-run protocol section)

- [ ] **Step 1: Verify preconditions, each with evidence:** seed 2 v2 installed on gpinst01 (fixture app reinstalled — the PR deferred install to this step); check_config filter + playbook v2 installed (product app reinstalled); both budget knobs read fresh; smoke gate re-run for BOTH harnesses (native panel + custom `/analyze`) against the known specimen.
- [ ] **Step 2: Write the re-run protocol addendum:** same 5 seeds, 2 runs each per harness, fresh conversation/run each, blind, audit-derived layer sweeps, scoring per `scorecard-template.md` §A2/§A3 unchanged; native re-runs seed 2 only (its other rows stand — document this choice explicitly: seeds 1/3–5 are byte-identical, re-running them would measure model drift, not the harness) vs full 10 custom-harness rows.
- [ ] **Step 3: Commit** as part of the same docs PR as Task 8 or its own.

### Task 10: Run the comparison benchmark → decision addendum

**Files:**
- Create: `benchmark/scorecard-custom-harness.md` (from `scorecard-template.md`)
- Modify: `benchmark/DECISION.md` (addendum §G: the comparison verdict)

- [ ] **Step 1: Execute per Task 9's protocol** — 10 custom-harness runs via POST /analyze, 2 native seed-2 runs; scorecard rows filled from audit-derived evidence only.
- [ ] **Step 2: Write the DECISION.md addendum:** side-by-side gate table, the same §A2 pass rule, explicit statement of what changed between harnesses (seed 2 v2, filter, playbook v2 — shared) so the comparison's confound surface is on the record.
- [ ] **Step 3: Commit + PR;** this closes the Phase 1b milestone ("deep diagnosis passes the same seeded-failure benchmark" — PRD).

## Task Dependency Order

```
Task 1 (skills + invocation path)
  → Task 2 (PaLlmProxy)
Task 3 (registry)          — parallel with 1–2
Task 4 (PaFixReport)       — parallel with 1–2
  → Task 5 (PaRunManager, needs registry for bundle)
    → Task 6 (PaAgentLoop, needs 2+3+4+5)
      → Task 7 (wiring + REST, needs 6)
Task 8 (assist units)      — parallel any time after Task 7 starts
  → Task 9 (readiness)     → Task 10 (comparison re-run)
```

## Self-Review Notes

- Spec coverage: every §E scope input has a task — definition-row/table rules (shipped pre-work, verified installed at Task 9), seed 2 v2 (pre-work, installed at Task 9), check_config filter (pre-work, installed at Task 9), run close-out (Task 5), assist-unit source (Task 8), Evidence Bundle in every outcome (Task 5/7), re-run on identical evidence (Tasks 9–10).
- The confirmation flow (`awaiting_confirmation`) is deliberately Phase 3; the status value and the no-expiry rule are honored by Task 5's transition guard so Phase 3 adds behavior, not schema.
- Deep `/status` covers the circular-dependency defenses (ADR Layer 4): plugin checks, own-skill checks incl. the Rule #40 activation trap, live micro-invocation, stuck-run detection.
