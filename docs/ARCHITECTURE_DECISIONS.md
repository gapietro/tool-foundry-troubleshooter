# Architecture Decisions

> Design rationale for the Foundry Troubleshooter, revised July 2026 when the product was re-aimed from general platform assistance to **diagnosing Foundry-built AI Agents** and producing Fix Reports for the builder AI.

---

## Decision 0: The Mission Shapes Everything

**Decision:** The Troubleshooter is a *diagnostic* agent, not a general assistant. Its terminal artifact is a **Fix Report** consumable by the builder AI (Claude Code + Foundry), not just a chat answer.

**Consequences that ripple through every layer:**
- The tool roster is agent-debugging-first (trace, config, GenAI logs) — generic platform tools (table query, schema) are supporting cast.
- Runs are long and evidence-heavy → asynchronous execution, artifact storage, transcript truncation.
- The output must cross the instance privacy boundary → configuration/data separation with data markers baked into the report format.
- The reasoning is playbook-guided (systematic layer sweep), not open-ended conversation.

---

## Decision 0.5: Harness Strategy — Tools-First, Benchmark-Gated (July 2026)

**Decision:** Build the diagnostic tools, playbook, artifact store, and audit logging as **harness-agnostic** components. Wrap them first in a **native ServiceNow AI Agent** ("Agent Doctor") via AI Agent Studio. Run the seeded-failure benchmark against it. The scorecard — not opinion — decides whether the custom harness (Layers 1–4 below) gets built, and how much of it.

**Why try native first:**
- The platform gives the harness away: ReAct-style loop, native tool calling, chat UI, session handling, and per-tool **supervised execution** (our confirmation gate, built in).
- Our diagnostic tools drop in as Script tools; Foundry's existing use-case automation creates the agent in ~8 API calls. Days of work, not weeks.
- ServiceNow's own field guidance confirms there is no native "agent that debugs agents" — the product gap exists regardless of harness.
- **The methodology is officially sanctioned:** ServiceNow's Knowledge 2026 lab CCL6230-K26 ("Inside the Black Box") teaches AI Agent debugging as a *manual* runbook over exactly the tables our tools read — `sn_aia_execution_plan` → `execution_task` → `tools_execution` → `sys_gen_ai_log_metadata` → `sn_aia_message`/`sys_cs_*` → scoped `sys_log` (see LLD §2.5). Agent Doctor is that runbook automated; its failure taxonomy (cold start/ACL misalignment, tool errors, latency bloat, hallucination, loops) is now baked into the playbook and benchmark, so diagnoses land in vocabulary ServiceNow practitioners already recognize.

**Why native may not be enough (documented ceilings, to be tested, not assumed):**
- Script tools are **string-only I/O**; 128K context; no native truncation/paging — large traces are exactly where this breaks. (Partially mitigated: PaArtifactStore + a `read_artifact` script tool work in either harness.)
- Orchestration is opaque: playbook order, the evidence rule, and Fix Report schema validity can be *suggested* in instructions but not enforced; "inconsistent behavior on identical inputs" is a documented failure pattern.
- Loop bounds are blunt (`sn_aia.continuous_tool_execution_limit`, 5-runs-per-15-min recursion limit) vs. our governed budget with partial-result guarantee; runaway loops burn paid assists.
- **Total circularity:** built natively, the Troubleshooter runs on the exact framework it debugs and inherits its failure modes (worker-user permission gaps, cross-scope denial). The custom harness depends only on NASK, one layer down, and keeps the Evidence Bundle floor.
- Guidance caps agents at 5–7 tools — our roster of 7 sits exactly at the line.

**The gate (see benchmark spec in the Implementation Plan):** 5 seeded-failure agents × 2 runs each, defects blind to Agent Doctor.
- **≥ 8/10 correct root causes with usable fix output** → native agent is the front door; Phase 1b shrinks to the Evidence Bundle path and whatever the scorecard showed native can't do.
- **5–7/10** → native stays as lightweight triage; build the custom deep-diagnosis harness.
- **< 5/10** → full custom harness as designed below.

> **⚠ Partially superseded (August 2026) — the custom-side half of the 5–7/10 and < 5/10 bands.**
> Each of those two bands reads the **native** arm's score and prescribes about the **custom** arm. That
> inference was sound while the custom harness was unbuilt and unmeasured — with one arm measured it is
> the only inference available — but it carried *"the custom arm is unmeasured"* as a silent premise.
> Phase 1b is now built, and the v12 scored pass measured both arms on the same day, seeds and build:
> **native 6/10 · 60% (middle band), custom 0/10 · 0%**, with the depth gate — the component the middle
> band's prescription names — measured to *degrade* diagnoses rather than deepen them.
> **Re-derived in `benchmark/DECISION.md` §AE**, which binds on passes after v12: a band prescribes about
> the arm it was read on; the custom harness is built out only on **its own ≥ 80%**; and a component
> measured to degrade a diagnosis is removed or re-derived first. The thresholds themselves, the
> native-side prescriptions, and the ≥ 8/10 band are unchanged. Everything above this note is left as
> written — it is the decision as it was made, and §AE says why it was right in its own context.

**What this means for the rest of this document:** Layers 1–4 (client, async REST API, custom ReAct loop, PaLlmProxy/NASK) describe the **custom harness — contingent on the gate**. Layers 5–7 (tools, state, packaging) are **harness-agnostic and get built regardless**; the tool cores never know which harness called them. Every diagnostic — native or custom — anchors to an `x_snc_pa_run` record (with a `harness` field), so artifacts, audit, and benchmark scoring work identically in both worlds.

---

## Layer 1: Client — React Chat UI (ServiceNow SDK) *(custom harness — contingent)*

**Decision:** Thin React component via ServiceNow SDK, no logic in the client.

**Rationale:**
- The UI is a dumb terminal — no LLM calls, no data processing. It POSTs to the REST API and polls for run progress.
- In-browser beats CLI here: the SC is already in the instance, confirmation dialogs are natural, and the live tool-execution feed (rendered from the polled transcript) gives the Claude-Code "watch it work" experience.
- The component (`x-snc-platform-assistant`) is portable across portal pages.

**Extensibility:** any HTTP client works with zero server changes — including **Foundry MCP itself**, which can call `/analyze` and retrieve Fix Reports programmatically on dev instances, making the diagnose step scriptable from the builder side where policy allows.

---

## Layer 2: API — Scripted REST API with Asynchronous Runs *(custom harness — contingent)*

**Decision:** Five thin endpoints; `/analyze` is asynchronous — it enqueues a run and returns immediately.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/analyze` | POST | Create run (execution ref, agent+timeframe, or pasted logs; optional `mode: "collect"`), fire event, return `{run_id, status}` |
| `/runs/{run_id}` | GET | Status + live transcript + Fix Report when complete (owner-only) |
| `/runs/{run_id}/message` | POST | Follow-up question or confirmation response |
| `/status` | GET | Deep readiness diagnostics (see Layer 4) |
| `/tools` | GET | Tool roster |

**Why async is non-negotiable:**
- Scripted REST APIs time out around 60 seconds on most instances.
- A real diagnostic run is 10–15 LLM iterations plus tool time — traces are big, prompts are big, and customer-side LLM latency varies from ~3s to ~20s per call. The synchronous v1.1 design (8 iterations × ~5s, "~40 seconds worst case") only worked on optimistic math and would have forced shallow diagnoses.
- Async also *improves* UX: writing the transcript to the run record after every iteration means polling clients render live progress.

**Mechanics:** `/analyze` inserts an `x_snc_pa_run` record and fires a platform event (`x_snc_pa.run.start`) via `gs.eventQueue()`; a Script Action invokes the PaAgentLoop worker. No MID server, no scheduled-job polling latency, standard platform machinery.

**Rejected alternative:** synchronous `/chat` (v1.1). Kept the `message` sub-resource for follow-ups within a completed run, which are short single-turn exchanges and can afford to be synchronous.

---

## Layer 3: Orchestration — PaAgentLoop (Playbook-Guided ReAct) *(custom harness — contingent)*

**Decision:** Server-side ReAct loop, max 15 iterations and a 5-minute wall-clock budget, guided by the diagnostic playbook rather than free-form.

**Rationale:**
- Diagnosis is inherently multi-step: pull trace → find the deviation point → pull the implicated config → corroborate against schema/data → draft fixes. Single-shot cannot do this.
- The playbook (in the system prompt) sequences the seven layers — trace, instructions, tools, schemas, data, GenAI stack, wiring — so the model works systematically instead of wandering. The **evidence rule** (root cause must cite trace + at least one config/schema source) is enforced in the prompt and checked by PaFixReport at report time.
- 15 iterations + 5 minutes: async execution removed the 60-second straitjacket, but bounds still prevent runaway loops and runaway spend on the customer's LLM. On hitting either bound the loop emits its best partial diagnosis with an explicit "incomplete" flag — never a silent failure.

**Confirmation flow (Phase 3 writes):**
- When the LLM proposes a destructive tool (fix application), the loop pauses, stores the pending action on the run, sets status `awaiting_confirmation`, and surfaces a human-readable description.
- Approval resumes the loop; rejection informs the LLM and it re-plans. No silent writes.
- Pending actions persist on the run record; a run in `awaiting_confirmation` does not expire (unlike v1.1's 30-minute session expiry, which silently interacted badly with pending confirmations).

**Known risk:** repeated identical tool calls. Mitigation: iteration + wall-clock caps now, call-signature loop detection in Phase 2.

---

## Layer 4: LLM Invocation — PaLlmProxy + NASK Skills *(custom harness — contingent; the native agent uses the platform's own LLM path)*

**Decision:** NASK Skills via `sn_gen_ai.GaiScriptedSkill`, wrapped behind PaLlmProxy as the sole abstraction. Unchanged from v1.1 — the reasoning held.

| Approach | Verdict | Reason |
|----------|---------|--------|
| **NASK Skills** | **Selected** | Platform-native, customer-visible in Skills Kit UI, existing Foundry automation, insulates from GenAI Controller changes |
| **AI Agent Use Cases** | Rejected | Nests an agent inside our agent — we ARE the orchestrator; surrenders iteration control, tool selection, confirmation flow. Also: the Troubleshooter must not be built on the exact framework it exists to debug. |
| **Direct GenAI Controller calls** | Rejected (for now) | No customer visibility, no abstraction from API changes |

**Key constraint (unchanged):** `PaLlmProxy` is the **only** file that knows NASK exists. All callers use `reason()` / `summarize()`. Swapping invocation methods — including native structured-output APIs when GenAI Controller exposes them — is a single-file change.

### Response Contract: Strict JSON, Not Prefix Parsing

**Decision:** The LLM must return a single JSON object — `{"action": "tool_call", ...}`, `{"action": "answer", ...}`, or `{"action": "fix_report", ...}` — replacing v1.1's `TOOL_CALL:`/`ANSWER:` string prefixes.

**Rationale:** the Troubleshooter runs on *whatever model the customer configured*. Free-text prefix parsing fails differently per model. JSON-only with an explicit schema in the prompt, plus **one automatic re-prompt on parse failure** ("your last response was not valid JSON — respond again, JSON only"), is the cheapest reliability win available. `_parseResponse(raw)` stays pure string logic, fully Jest-testable: valid actions, malformed JSON, JSON in markdown fences, empty responses, trailing prose.

### The Circular Dependency

The Troubleshooter uses the GenAI stack to debug the GenAI stack. Defenses:

1. **Deep `/status`** — plugin checks (Now Assist, GenAI Controller, `sn_aia`), capability-to-provider mappings, the Troubleshooter's own skills, one live micro-invocation, stuck-run detection. When the Troubleshooter can't reason, `/status` says why — which is often the customer's actual problem too.
2. **Minimal own config** — the two skills use the plainest configuration, validated at install; a broken customer skill setup can't cascade into ours.
3. **Evidence Bundle** (`mode: "collect"`) — PaRunManager runs the collection tools without any LLM and returns organized raw evidence. The floor is "expert evidence gatherer," never "dead."

### Two Skills

| Skill | Purpose | Temperature | Max Tokens |
|-------|---------|-------------|------------|
| `pa-llm-reason` | Diagnostic reasoning, fix drafting | 0.2 | 2000 |
| `pa-llm-summarize` | Transcript compression | 0.1 | 1000 |

Separate because NASK bakes config at creation time, not invocation time.

### Known Risks

- NASK creation is ~24 API calls per skill; mid-sequence failure needs cleanup → Phase 3 installs with rollback
- `GaiScriptedSkill` is reverse-engineered, not documented; Skills Kit internals shift between releases
- **Mitigation:** the PaLlmProxy abstraction makes all of it swappable

---

## Layer 5: Tools — PaToolRegistry + Diagnostic Tool Roster

**Decision:** Centralized registry, consistent interface, roster re-built around agent diagnosis. All Phase 1–2 tools read-only.

### Registry Design (unchanged)

PaToolRegistry is the **single point of destructive-check enforcement**. All tools return `{success, data}` or `{success: false, error}` — uniform shape for the LLM regardless of tool.

### Phase 1 Roster (read-only)

| Tool | Purpose | Key Limits |
|------|---------|-----------|
| **PaToolAgentTrace** | Step-by-step execution replay from `sn_aia_*` execution tables: per-step LLM input, tool calls, args, results, errors | Per-step detail mode; full payloads go to artifact store |
| **PaToolAgentConfig** | Agent definition: use case, instructions, attached tools with full I/O schemas, trigger config | Read-only; resolves tool → backing script/flow |
| **PaToolGenAiLog** | GenAI Controller request log, provider errors, token usage, capability mappings | Default 60-min window, max 100 entries |
| **PaToolSchemaLookup** | Table/field schema via `sys_dictionary` + `sys_choice` | Table-level and field-level modes |
| **PaToolQueryTable** | GlideRecordSecure queries — verify expected data exists | Max 100 records, validates table |
| **PaToolLogAnalysis** | Syslog search | Default 60-min window, max 100 entries |
| **read_artifact** (PaArtifactStore) | Paged reads of stored large outputs | Offset + length, like reading a file in chunks |

**Phase 2 additions:** PaToolFlowContext (flow/subflow execution behind flow-based agent tools), PaToolCmdbTraverse (relationship context when agents act on CIs — demoted from Phase 1 headline in v1.1: valuable, but not on the critical diagnostic path).

**Phase 3 additions (destructive, confirmation-gated):** targeted agent-repair writes — update instruction text, fix tool schema records, toggle use case/trigger activation. Deliberately *not* generic record CRUD: narrow verbs are easier to describe to the LLM, confirm with the user, and audit.

### The `sn_aia_*` Dependency

AgentTrace/AgentConfig read reverse-engineered execution tables that can shift between ServiceNow releases. Containment: the table/field mapping lives in those two tools only (mirroring the PaLlmProxy pattern), is verified by `/status` at install, and is maintained upstream in Foundry's data-model documentation.

### GlideRecordSecure Everywhere (unchanged)

Every tool uses `GlideRecordSecure`. ACL-filtered empty results — not errors, not leaks. The per-record ACL cost is negligible at our query sizes (≤100 records). Security over speed.

### Large Outputs: Truncate + Page

A full execution trace or log dump can exceed what any prompt should carry. Every tool result passes through PaArtifactStore: results over a size threshold are stored as attachments on the run record; the transcript gets a truncated excerpt plus an artifact ref; the LLM pulls more via `read_artifact` with offsets — the same pattern coding agents use to read big files. This is what makes "feed it the execution logs" actually work instead of blowing the context window.

This is also ServiceNow's own performance guidance applied to ourselves: the K26 lab (CCL6230, Lab 2) names **tool output bloat** — raw payloads accumulating in the scratchpad and reprocessed on every ReAct turn — as a primary agent latency/failure cause, and prescribes synthesized, minimal tool returns. PaArtifactStore is that principle enforced mechanically, and the same lab's three-section tool-description framework (Purpose / Inputs / Outputs & Error Handling) is the writing standard for the roster's descriptions (LLD §2.5, §5).

---

## Layer 6: Data & State — PaRunManager + PaAuditLogger

**Decision:** Two scoped tables — `x_snc_pa_run` (diagnostic runs) and `x_snc_pa_audit` (audit trail). Transcript as JSON on the run; large artifacts as attachments.

### Why "runs," not "sessions"

A diagnostic run has a lifecycle a chat session doesn't: `queued → running → (awaiting_confirmation) → complete | failed`, a definite terminal artifact (Fix Report or Evidence Bundle), and value as a *record* — past runs on an instance are a debugging history worth keeping per-POC.

### Run Management (x_snc_pa_run)

- **Transcript as JSON** on the run record: always loaded whole to build prompts, one query, no child table. Cross-run search isn't a requirement; if it becomes one, add a child table then.
- **Progress visibility:** the worker updates the transcript after every iteration — this is what the polling UI renders.
- **Context summarization:** past ~10 transcript entries, `summarize()` compresses older entries into the context field, keeping recent entries verbatim. Artifact refs survive summarization — the LLM can always page back into full evidence.
- **No inactivity expiry for pending confirmations:** a run in `awaiting_confirmation` waits indefinitely; only `running` runs are subject to the wall-clock budget. (Fixes a v1.1 design bug where 30-minute session expiry could silently swallow a pending confirmation.)

### Audit Logging (x_snc_pa_audit) — unchanged in spirit

| Method | When | Why |
|--------|------|-----|
| `logIntent` | Before destructive execution | Crash between intent and execution still leaves a record |
| `logResult` | After success | Input, output, affected table/record, confirmation flag |
| `logError` | After failure | What went wrong |

Write-only from the Troubleshooter's perspective; it never reads its own audit log. It exists for humans — admins and security reviewers on the customer instance.

---

## Layer 7: Packaging — Scoped Application

**Decision:** Everything ships as a scoped app (`x_snc_pa`), not global-scope `u_` artifacts (a v1.1 inconsistency: it named the `x_snc_pa` namespace but specified `u_` tables).

**Rationale:** the deployment target is *someone else's instance*. A scoped app makes install/uninstall a single demonstrable operation, contains all artifacts under one scope for the customer's security review, and turns "all records can be removed cleanly" from an assertion into a platform-enforced property. Install automation (incl. the NASK skill sequence) with rollback lands in Phase 3; until then, install is scripted-but-supervised.
