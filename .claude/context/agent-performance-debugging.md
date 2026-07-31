# Agent Performance Debugging — Latency and Token-Load Diagnosis

> Why AI Agent executions get slow, how to read the platform's latency signals, and the fix patterns — instruction diet, tool-output discipline, and skill offloading. Platform facts verified live on Zurich Patch 10 (gpinst01, 2026-07). Complements [Performance Tuning](./performance-tuning.md) (platform query performance) and [Agentic Patterns](./agentic-patterns.md) (ReAct engine mechanics).

---

## The Cost Model: Every Token Is Processed on Every Turn

The platform-run ReAct engine ([Agentic Patterns](./agentic-patterns.md)) re-sends the full context to the LLM on **every** loop iteration:

- the agent **instructions** — the entire prompt, every turn
- the **scratchpad** — all prior Thought/Action/Observation steps, including every tool output accumulated so far
- the current user message and conversation context

Two consequences follow, and they compound:

1. **Instruction bloat multiplies.** A 10,000-token prompt is not a one-time cost — it is reprocessed on turn 1, turn 2, turn 3… An agent that averages 6 ReAct turns pays for those instructions six times per execution.
2. **Tool output bloat compounds forward.** A tool that returns a 5,000-token payload writes it into the scratchpad, and every *subsequent* turn reprocesses it. Large raw payloads (unfiltered RAG chunks, raw web-search results, full GlideRecord dumps) also typically force *extra* turns, because the agent must spend reasoning steps interpreting them.

The optimization principle: **the agent orchestrates; it does not process.** Keep instructions lean, push heavy reasoning and data synthesis into tools (Now Assist Skills, flows, script tools), and let tools return concise, structured results.

---

## Reading the Platform's Latency Signals

### sn_aia_execution_plan observability fields (verified Zurich P10)

The execution plan record carries native per-execution latency and token metrics — check these before guessing:

| Field | What it tells you |
|-------|-------------------|
| `execution_time_ms` / `execution_time_sec` | Total wall-clock time for the execution |
| `system_execution_time_ms` / `system_execution_time_sec` | Platform-side processing time |
| `llm_p95_latency` | P95 latency of the LLM calls in this execution — high values point at model-side load (usually oversized context) |
| `tool_p95_latency` | P95 latency of tool executions — high values point at slow tool scripts or oversized tool work |
| `llm_token_avg` | Average LLM response tokens — a rising average across executions tracks growing prompt/scratchpad size |

`llm_p95_latency` vs `tool_p95_latency` is the first fork in the diagnosis: it tells you whether the time is going to *thinking* (context too large) or to *tools* (script or payload problem).

### sys_gen_ai_log_metadata per-call detail (verified Zurich P10)

Every generative AI call made during an execution gets a `sys_gen_ai_log_metadata` record (global scope), linked to execution tasks via `sn_aia_gen_ai_m2m`. The diagnostic fields:

| Field | What it tells you |
|-------|-------------------|
| `prompt_token_count` | Exact prompt size for this call — the direct measure of instruction + scratchpad load |
| `response_token_count` | Response size |
| `time_taken` | Duration of this specific LLM call |
| `model_name` / `model_version` | Which model served the call |
| `gen_ai_log_id` | Reference to `sys_generative_ai_log` for full prompt/response content |
| `error` / `error_code` / `status` | Whether the call failed |

A healthy pattern shows roughly stable `prompt_token_count` across a run's calls. A steadily climbing count call-over-call is scratchpad accumulation — go look at what the tools are returning.

### AI Agent Studio

The Activity view's execution replay flags individual steps with a high-latency warning. Which step type carries the flag is the same fork as the p95 fields: flags on **ReAct engine reasoning steps** mean per-turn context is too large (instruction bloat); flags on **tool steps** mean the tool itself is slow or returning too much.

---

## Diagnosis: Which Kind of Slow?

| Signal | Root cause | Fix pattern |
|--------|-----------|-------------|
| High latency on reasoning steps; high `llm_p95_latency`; large, flat `prompt_token_count` | Instruction bloat — the prompt itself is oversized | Instruction diet (below) |
| `prompt_token_count` climbing across calls within one execution; extra turns spent "interpreting" tool results | Tool output bloat — raw payloads accumulating in the scratchpad | Tool-output discipline (below) |
| High `tool_p95_latency`; slow individual tool steps | Slow tool script — unindexed queries, N+1 patterns, unbounded result sets, synchronous external calls | [Performance Tuning](./performance-tuning.md) — this is ordinary platform script performance |
| Many turns, each individually fast | Too many sequential tool calls for what is logically one operation | Consolidation / skill offloading (below) |

---

## Instruction Bloat Anti-Patterns

Each of these is content the LLM reprocesses on every turn while needing it on almost none. All of them have a better home than the agent prompt:

| Anti-pattern | Why it hurts | Where it belongs |
|--------------|--------------|------------------|
| **Inline decision trees** — full per-category troubleshooting/branching logic in the instructions | All branches are read every turn; the execution uses at most one | A Now Assist Skill tool that runs the decision logic and returns a recommendation |
| **Hardcoded reference data** — error-code tables, command references, mapping lists | Static lookup data processed every turn; the agent needs one entry, on demand | Knowledge articles retrieved by a search tool, or a script tool lookup |
| **Full example conversations** — multi-turn few-shot transcripts | Among the most expensive patterns: thousands of tokens per turn for marginal grounding | Cut to at most one *short* pattern; move format enforcement into explicit output rules |
| **Inline state-variable tracking** — long blocks of variables with per-step update rules | The whole block is parsed every turn even when 2–3 variables are live | Structured tool outputs carry the state; the platform's scratchpad already preserves history |
| **Per-OS / per-variant reference tables** | Every variant processed regardless of which one applies | A tool input (e.g. `os_context`) that filters server-side |
| **Duplicated rules** — closing checklists and wrong/right response templates restating the steps above | Pure token duplication with no new signal | Delete; keep one canonical statement of each rule |

The few-shot caveat: [Prompt Engineering Patterns](./prompt-engineering-patterns.md) treats Examples as a first-class prompt layer, and for **skills** (single LLM call, no loop) that costs you once. For **agents**, every example is re-billed on every ReAct turn — the bar for including one is much higher, and full transcripts almost never clear it.

---

## Tool-Output Discipline

Rules for what a tool may hand back to an agent (the script-side counterpart is in [Tool Script Rules](./tool-script-rules.md)):

- **Filter and structure server-side.** GlideRecord, flows, and script logic run at platform speed; scratchpad tokens are paid on every subsequent turn. Parse, select fields, and summarize *before* returning.
- **Return only decision-relevant fields.** A user lookup that returns 27 fields including notification preferences forces the agent to carry them all forward. Return what the agent's next decision needs.
- **Cap result sets.** `setLimit()` on every query a tool runs; unbounded lists are unbounded token bills.
- **Synthesize multi-source results inside a skill.** If the agent needs knowledge-base *and* web results, a skill that runs both retrievals, synthesizes internally, and returns one concise answer replaces two raw payloads *and* the extra ReAct turns the agent would spend merging them. (Skill tools execute before the skill's single LLM call renders — the multi-tool fan-out happens inside one turn of the agent's loop.)
- **Consolidate always-sequential lookups.** Three tools the agent always calls in a row (user → devices → open incidents) are three selection decisions, three turns, three raw payloads. One tool doing all three server-side is one turn and one structured result — this is the smart-tool pattern in `skills/crisp-servicenow-builder/tool-description-examples.md`.

---

## Fix Workflow

1. **Measure first.** Pull the execution plan record; compare `llm_p95_latency` vs `tool_p95_latency`, and read `prompt_token_count` across the run's `sys_gen_ai_log_metadata` records. Fix what the numbers indict, not what you suspect.
2. **Fix instructions and tools separately.** Apply the instruction diet, re-run, and confirm reasoning-step latency dropped before touching tools — otherwise you can't attribute the improvement.
3. **Then fix tool outputs.** Replace raw-payload tools with synthesizing skills or consolidated script tools; re-run and confirm the turn count dropped along with tool-step latency.
4. **Re-verify with the same objective.** Same test input before and after; compare `execution_time_ms`, turn count, and token counts. Keep the numbers in the PR/test report.

---

## Related Resources

- [Agentic Patterns](./agentic-patterns.md) — the platform-run ReAct engine this cost model falls out of
- [Performance Tuning](./performance-tuning.md) — query-level performance for slow tool scripts
- [Tool Script Rules](./tool-script-rules.md) — structured output and error contracts for tools
- [Prompt Engineering Patterns](./prompt-engineering-patterns.md) / [Agent Instruction Templates](./agent-instruction-templates.md) — what belongs in instructions
- [ServiceNow AI Data Model](./servicenow-ai-data-model.md) — full schema for the execution and Gen AI log tables

---

*Extracted from Knowledge 2026 lab CCL6230-K26 concepts; all table/field claims independently verified on gpinst01 (Zurich Patch 10 Hotfix 3). See issue #266.*
