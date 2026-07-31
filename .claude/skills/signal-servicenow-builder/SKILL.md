---
name: signal-servicenow-builder
scope: project
recommended: true
version: 1.2.0
description: >
  Build ServiceNow AI Agents using the hybrid SIGNAL-ServiceNow methodology. Generates
  use case definitions, agent instructions, and tool descriptions that combine SIGNAL's
  goal-oriented heuristic approach with ServiceNow Zurich platform constraints. Supports
  single-agent, orchestrator, and child agent patterns. Use when the user wants to build
  an agent that needs to reason, analyze, interpret, or apply expert judgment — such as
  root cause analysis, log pattern analysis, knowledge search analysis, or synthesis
  agents. For procedural data collection or orchestration agents, consider CRISP instead.
  Triggers include "SIGNAL agent", "SIGNAL prompt for ServiceNow", "build me an analysis
  agent", "reasoning agent", "root cause agent", "synthesis agent", or any request
  specifying the SIGNAL framework for ServiceNow AI agent artifacts.
---

## Instructions

When the user asks to build a ServiceNow AI agent or agentic workflow using SIGNAL:
1. Read prerequisites (context files listed below) before starting
2. Follow the 6-step workflow: gather requirements → determine architecture → generate design doc → generate deployable instructions → validate → deliver
3. Always ask clarifying questions before generating artifacts (see Step 1)
4. Use heuristic, goal-oriented language throughout — never write rigid step-by-step procedures
5. Validate all artifacts against the checklist in Step 5 before delivering
6. Reference `examples/it-incident-triage.md` for a complete worked example

---

# Hybrid SIGNAL-ServiceNow Agent Builder

Build goal-oriented, heuristic-driven ServiceNow AI Agents that give the LLM room to
reason instead of scripting it through predetermined steps — while staying within
ServiceNow Zurich platform constraints.

## Philosophy

The best agent instructions define **goals, guardrails, and heuristics** — not procedures.
If you can replace the LLM with if/else statements and the behavior wouldn't change,
you've built a pipeline with an expensive router.

This skill merges SIGNAL (Success, Identity, Guardrails, Norms, Agent-tool-interface,
Learning) with ServiceNow's platform reality: 1500-word instruction limits, 20-tool caps,
strategy types, and multi-agent orchestration.

**Three rules that govern every instruction set:**

1. **Describe what success looks like, not what steps to take.** The agent determines the
   path; you define the destination.
2. **Write tool descriptions as carefully as the instructions.** If the agent can't figure
   out which tool to use from the description alone, the description is broken.
3. **Encode expert judgment as heuristics, not rules.** Translate how a skilled practitioner
   approaches the task into guidance the agent can apply flexibly.

---

## SIGNAL vs CRISP: When to Choose Which

> **Rule of thumb:** If the agent needs to think, use SIGNAL.
> If the agent could be replaced by a script, use CRISP.

### Use SIGNAL When:

| Agent Type | Why SIGNAL |
|-----------|-----------|
| **Root cause analysis / synthesis** | Evidence weighing, confidence assessment, expert judgment |
| **Log/data analysis** | Pattern recognition, timeline interpretation, anomaly detection |
| **Knowledge search + analysis** | Interpreting semantic search results, relevance assessment |
| **Broad problem spaces** | Heuristics guide reasoning across novel situations |
| **Expert judgment encoding** | "How would a senior practitioner approach this?" |

### Use CRISP Instead When:

| Agent Type | Why CRISP |
|-----------|-----------|
| **Orchestrators / pipeline controllers** | Deterministic dispatch with explicit failure branches |
| **Data collection agents** (GlideRecord, REST APIs) | Procedural steps, bounded scope, no judgment needed |
| **Regulated workflows** | Explicit branches satisfy audit requirements |
| **Narrow, well-defined tasks** | Decision trees map cleanly to bounded workflows |

### Hybrid Pattern (Multi-Agent Workflows)

In multi-agent pipelines, use **both frameworks**:
- SIGNAL for agents that analyze, reason, and synthesize
- CRISP for agents that collect, query, and structure data

Example (validated on a production SRE Incident Response Agent — 5 agents):
```
Orchestrator     → CRISP (dispatch logic, failure branches)
Data collectors  → CRISP (GlideRecord queries, REST API calls)
Log analyst      → SIGNAL (pattern recognition from Elastic logs)
Synthesis agent  → SIGNAL (root cause hypothesis, confidence assessment)
```

Both frameworks share ServiceNow platform constraints (1500-word limit, 20-tool cap,
strategy types) and are fully interoperable — a CRISP orchestrator can dispatch to
SIGNAL child agents seamlessly.

---

## Prerequisites

**Read these context files before starting:**
1. `context/agent-instruction-templates.md` — ServiceNow strategy templates and pitfalls
2. `context/tool-script-rules.md` — Tool script rules and platform limits
3. `context/multi-agent-handoff-patterns.md` — Multi-agent architecture

**Methodology reference:**
- `section-guide.md` — Full SIGNAL-ServiceNow methodology guide (in this skill directory)

---

## Workflow

### Step 1: Gather Requirements (REQUIRED — DO NOT SKIP)

If the user provides incomplete requirements, ask clarifying questions. Gather the
following before generating anything.

#### Required Inputs

| # | Input | Key Question |
|---|-------|-------------|
| 1 | **Agent/workflow purpose** | What outcome does this deliver? (Not "what does it do" — what result does it produce?) |
| 2 | **Target users** | Who interacts with this agent? What do they expect? |
| 3 | **Available tools** | What systems, APIs, tables can the agent access? List existing tools or tools to create. |
| 4 | **Autonomy level** | How much independent action? (Tier 1-4, or describe and I'll recommend) |
| 5 | **Domain context** | What does the agent need to know about the business domain? |
| 6 | **Known failure modes** | What has gone wrong before, or what could go wrong? |
| 7 | **Trigger type** | Chat, record, scheduled, or API? |

#### Optional But Valuable

- Example interactions showing how an expert human handles this today
- Existing agent instructions to improve
- Compliance or regulatory requirements
- Whether this is single-agent or part of a multi-agent workflow
- ServiceNow tables involved

#### Quick Interview (if user provides minimal info)

Ask these questions in order, stopping when you have enough:

1. "What is the end result this agent should deliver? Describe the outcome, not the process."
2. "Who will use this — end users via chat, IT staff in Agent Workspace, or is it triggered automatically?"
3. "What tools or data sources does the agent need? (ServiceNow tables, APIs, KB, etc.)"
4. "What must NEVER happen? What's the worst failure mode?"
5. "How does a skilled person handle this task today? Where do they use judgment?"

### Step 2: Determine Architecture Pattern

Based on requirements, determine:

#### Single Agent or Multi-Agent?

```
Can one agent handle the full task with ≤10 tools?
├── Yes → Single Agent (Pattern A)
└── No → Does it span multiple expertise domains?
    ├── Yes → Orchestrator + Children (Pattern B)
    └── No → Can tools be consolidated?
        ├── Yes → Consolidate and use Single Agent
        └── No → Orchestrator + Children (Pattern B)
```

#### Strategy Selection

```
Is a user present in the conversation?
├── No → AutoPilot (Tier 4)
└── Yes → Does the user want to approve each action?
    ├── Yes → CoPilot (Tier 1-2)
    └── No → Is the task complex (>5 steps, multiple tools)?
        ├── Yes → ReAct with Reactive Planner consideration
        └── No → ReAct (Tier 3, default)
```

#### Autonomy Tier

| Tier | Strategy | Tool Modes | When |
|------|----------|-----------|------|
| Tier 1 — Advisory | CoPilot | All supervised | New agent, high compliance |
| Tier 2 — Proposal | CoPilot | Reads autonomous, writes supervised | Default enterprise. Agent proposes, human approves |
| Tier 3 — Supervised | ReAct | Most autonomous, high-impact supervised | Proven agent with track record |
| Tier 4 — Autonomous | AutoPilot | All autonomous | Narrow, well-tested, triggered tasks |

### Step 3: Generate Design Doc

Before writing deployable instructions, generate the full design document. This captures
all the thinking that must be distilled into ServiceNow's constrained fields.

#### Design Doc Structure

```markdown
# [Workflow/Agent Name] — Design Document

## 1. Requirements Summary
- **Purpose:** [Outcome this delivers]
- **Users:** [Who and what they expect]
- **Trigger:** [Chat/Record/Scheduled/API]
- **Architecture:** [Single agent / Orchestrator + N children]
- **Autonomy:** Tier [1-4] — [strategy]

## 2. Success Criteria (SIGNAL S)
- **Goal:** [One sentence]
- **Success when:** [Observable outcomes, 3-5 bullets]
- **Effort budget:** [Tool call ranges by complexity]
- **Completion signal:** [How agent knows it's done]
- **Failure conditions:** [What must never happen]

## 3. Agent Design
[For each agent in the workflow:]

### [Agent Name]
- **Role:** [Identity]
- **Strategy:** [ReAct/CoPilot/AutoPilot]
- **Scope:** [What this agent handles — and explicitly what it does NOT]
- **Knowledge boundaries:**
  - Knows: [domain knowledge]
  - Must look up: [real-time data, user-specific info]

### Tools
[For each tool:]
- **[tool_name]**
  - Type: [script/flow_action/subflow/record_operation/etc.]
  - Purpose: [What it does]
  - When to use: [Trigger conditions]
  - When NOT to use: [Disambiguation]
  - Parameters: [Key inputs with format]
  - Returns: [What the response contains]
  - Caveats: [Rate limits, ACL behavior, error patterns]
  - Execution mode: [supervised/autonomous]

### Guardrails (SIGNAL G)
- [Hard constraint 1]
- [Hard constraint 2]
- Anti-hallucination protocol: [specific to this domain]
- Escalation triggers: [when to stop and hand off]

### Expert Heuristics (SIGNAL N)
[3-5 heuristics that encode how a skilled practitioner thinks about this task.
 For each heuristic, explain WHY it matters.]

1. [Heuristic]: [Reasoning pattern]
   Why: [What goes wrong when this isn't followed]

2. [Heuristic]: [Reasoning pattern]
   Why: [What goes wrong when this isn't followed]

### Examples (SIGNAL L)
[3 examples: happy path, edge case, correct escalation/refusal]

#### Example 1 — [Scenario]
- Situation: [Context]
- Reasoning: [How the agent should think about it]
- Actions: [What tools used and why]
- Outcome: [Result]
- Why correct: [What makes this the right approach]

### Test Scenarios
[3-5 test scenarios with expected behavior and failure criteria]

## 4. Multi-Agent Coherence (if Pattern B)
- **Scope boundaries:** [How responsibilities are divided — no overlap]
- **Terminology alignment:** [Shared terms across agents]
- **Context flow:** [What each agent passes to the next]
- **Failure cascade:** [What happens when one agent fails]

## 5. Autonomy Graduation Path
- Start: Tier [N]
- Graduate to Tier [N+1] after: [milestone]
- Graduate to Tier [N+2] after: [milestone]

## 6. Known Gaps
- [Situations not yet covered]
- [Planned future capabilities]
```

### Step 4: Generate Deployable Instructions

Distill the design doc into ServiceNow-ready artifacts. Each must fit platform constraints.

#### 4a: Use Case Description (sn_aia_usecase.description)

```
[What this workflow accomplishes — 1-2 sentences]

Workflow pattern: [Single agent / Orchestrator + N children]
Trigger: [Record / Scheduled / Chat / API]
Autonomy: Tier [N] — [strategy name]

Agents:
- [Agent name]: [responsibility and scope boundary]

Success criteria:
- [Observable outcome 1]
- [Observable outcome 2]

Escalation: [When and to whom]
```

#### 4b: Agent Instructions (sn_aia_agent.instructions)

Use the hybrid template. **Must be under 1500 words** (800 for simple, 300-500 for
orchestrators).

##### Single Agent / Child Agent Template

```
CRITICAL: [Most important guardrail — first sentence gets highest attention]

## Identity & Expertise
You are a [role] for ServiceNow with expertise in [domain]. You have access to
[N] tools for [capabilities summary].

You know: [stable domain knowledge]
You do NOT know (use tools): [real-time data, user-specific info, things that change]

## Goal
[One sentence — outcome, not process]

Success when:
- [Observable outcome 1]
- [Observable outcome 2]

Effort budget:
- [Simple]: [N-M] tool calls
- [Complex]: [N-M] tool calls
- Exceeding [max]: summarize progress, [escalation action]

Done when: [Completion signal]

## Guardrails
- [Hard constraint 1]
- [Hard constraint 2]
- Escalate to [role/queue] when: [triggers]

Anti-hallucination:
- For [domain data]: only reference information from tool responses
- If a tool returns no data: state this explicitly — never fill gaps
- If uncertain: state your confidence level, do not present guesses as facts

## Expert Approach
[Heuristic-driven guidance replacing numbered workflow steps]

- [Heuristic 1: highest-value first move]
- [Heuristic 2: decision pattern for judgment calls]
- [Heuristic 3: what to do when the obvious approach fails]
- [Heuristic 4: When choosing between approaches, briefly note why alternatives were ruled out — this prevents silent branch skipping]

[Strategy-specific behavioral norms — pick ONE based on strategy:]

[ReAct]: Before each tool call, state what you expect to learn and why.
After results, assess whether they advance the goal or change your approach.
Persist through obstacles — try at least 2 alternative approaches before escalating.

[CoPilot]: Present 1-2 options with tradeoffs. Wait for user approval before
modifying data. Read-only lookups don't require approval. If user says "just do it",
proceed without per-step approval for the current task only.

[AutoPilot]: Document every decision in work notes. If a tool fails, retry once
with adjusted parameters. If still failing, set state to on_hold with explanation.
Never interact with the user (canInteractWithUser is false).

## Evidence Gates (for high-stakes decisions)
[Optional — use for classification, escalation, priority, or approval decisions]

Before committing to a high-stakes determination, construct an internal
reasoning certificate:

Premises: [List data points gathered, each citing its source — tool output,
record field, or user statement]
Trace: [Step through the logic connecting premises to your determination.
Account for alternatives considered and why they were ruled out]
Conclusion: [State determination with explicit linkage to premises.
Flag any premises that could not be verified]

This reasoning is INTERNAL — do not display premises, traces, or certificates
to the user. Present only the outcome and recommended action.

Platform note: Anchor evidence gates to an analytical action (e.g., "Analyze
the classification decision") so the ReAct engine treats it as an executable
step rather than collapsing it. Keep certificates focused — the Thought field
budget is ~4-5 sentences.

## Parallel Execution (ReAct V3)
[When gathering independent data, signal parallelism explicitly]

Independence anchors — use when operations have no shared inputs or write targets:
- "Retrieve ALL of the following simultaneously — these are independent"
- "Perform ALL of the following independently — each reads from [X] but writes to different targets"

Serialization anchors — use when operations depend on each other:
- "Apply the following updates sequentially — these write to the same record"
- "Step [N] depends on the output of Step [N-1]"

Gating anchors — use to create sync points:
- "Using the combined results from the previous step"

Rules: Max 4 operations per parallel batch. Copilot tools always run alone.
User-interaction actions (show_output, collect_input) always run alone.

## Tools
- **[tool_name]**: [When to use]. [When NOT to use].
[Repeat for each tool — 1-2 lines each. Heavy descriptions go in tool.description field.]

## Communication
[Output format — be explicit]
- [Template or structural requirements]
- [Tone and style guidance]
- Internal reasoning (tool selection rationale, confidence assessments, evidence traces) stays in work notes — never in user-facing output
- User sees only: the outcome, recommended action, and brief plain-language explanation

## Examples

### [Scenario 1 — happy path]
Situation: [Context]
Reasoning: [How the agent thinks about it]
Outcome: [Result]

### [Scenario 2 — edge case or escalation]
Situation: [Context]
Reasoning: [Why this differs from standard]
Outcome: [Result]

Self-check before responding:
- Does this meet the success criteria?
- Did I use tools to verify claims?
- Would the recipient have enough context to act?

CRITICAL: [Most important guardrail repeated — last sentence gets high attention]
```

##### Orchestrator Template (300-500 words)

```
CRITICAL: [Top guardrail]

## Identity
You are the orchestrator for [workflow name]. You coordinate specialist agents
to [overall workflow goal].

## Goal
[One sentence — workflow-level outcome]
Done when: [All children completed, results aggregated]

## Available Agents
- **[Child A]**: Handles [scope]. Dispatch when [condition].
- **[Child B]**: Handles [scope]. Dispatch when [condition].

## Dispatch Rules
- Analyze the request. Determine which specialist(s) are needed.
- Single specialist needed → dispatch directly.
- Multiple specialists → dispatch sequentially, pass each output as context to the next.
- Every dispatch includes: the task, prior agent results, expected output format.

## Failure Handling
- Child error → categorize: transient (retry once) / data (report) / logic (adjust & retry).
- Same error twice → escalate to human.
- Two different children fail on same task → escalate to human.

## Coherence
- Consistent terminology across dispatches.
- Never dispatch same task to same agent twice (loop detection).
- Budget: max [N] dispatches per request.

## Result Aggregation
After completion, compile: what was done, issues found, next steps.

CRITICAL: [Top guardrail repeated]
```

#### 4c: Tool Descriptions (sn_aia_tool.description)

For each tool, generate a 3-6 sentence description:

```
[What this tool does — 1 sentence with return value summary].
Use when [trigger conditions]. Do NOT use when [what another tool handles instead].
[Caveat: ACL behavior, rate limits, error patterns, or data format notes].
```

#### 4d: Tool Input/Output Schemas

Generate JSON schemas with `mandatory: true` on required fields:

```json
[
  {"name": "field_name", "type": "string", "mandatory": true, "description": "What this is"},
  {"name": "optional_field", "type": "number", "mandatory": false, "description": "What this is"}
]
```

##### Smart Tool Output Design

When designing tool output schemas, structure responses for agent consumption — not raw data dumps:

```json
{
  "recommended_action": "ROUTE_TO_NETWORK_OPS",
  "confidence_score": 0.92,
  "key_findings": {
    "critical_items": 3,
    "pattern_detected": "Recent change correlated with 4 similar incidents"
  },
  "reasoning_trace": {
    "premises": ["847 records scanned", "3 met critical threshold"],
    "logic": "Critical items scored >0.9 on severity index",
    "conclusion": "Route to Network Ops based on CI relationship and recent change"
  },
  "next_steps": "Assign to Network Ops with change correlation evidence"
}
```

Design principles:
- **Decision-ready outputs:** Return recommendations, confidence scores, and next steps — not raw record arrays
- **Reasoning traces (optional):** Include `reasoning_trace` objects so agents can verify WHY a tool made a recommendation
- **Threshold-based intelligence:** For >100 records, return summary + critical subset. For ≤100, return full detail
- **Failure guidance:** Always include fallback recommendations in error responses

### Step 5: Validate

Before delivering, check every artifact against these criteria:

#### Instruction Validation

| Check | Pass? |
|-------|-------|
| Under 1500 words (800 for simple, 500 for orchestrators)? | |
| Critical guardrail at top AND bottom? | |
| Knowledge boundaries stated (know vs must-look-up)? | |
| Success criteria are observable and self-evaluable? | |
| Effort budget defined? | |
| Completion signal defined? | |
| Hard constraints separated from soft heuristics? | |
| Anti-hallucination protocol present? | |
| Expert heuristics replace numbered workflow steps? | |
| Every tool listed with when AND when-not? | |
| At least 2 examples with reasoning exposed? | |
| Self-check included before final response? | |
| Strategy-specific norms included? | |
| Output format explicitly defined? | |
| Escalation triggers defined? | |
| Evidence gates present for high-stakes decisions? | |
| Evidence gates marked INTERNAL (not shown to user)? | |
| Independent operations use parallel independence anchors? | |
| Dependent operations explicitly serialized? | |
| Parallel batches limited to ≤4 operations? | |
| Tool output schemas include decision-ready fields (recommended_action, confidence)? | |
| Branch reasoning documented (alternatives considered)? | |
| Internal reasoning separated from user-facing output? | |

#### Tool Description Validation

| Check | Pass? |
|-------|-------|
| 3-6 sentences? | |
| Includes "when to use"? | |
| Includes "when NOT to use" (disambiguation)? | |
| At least one caveat? | |
| All tool names are snake_case? | |
| Input schema has mandatory: true on required fields? | |

#### Multi-Agent Validation (Pattern B only)

| Check | Pass? |
|-------|-------|
| Non-overlapping scope across children? | |
| Consistent terminology across all agents? | |
| Orchestrator under 500 words? | |
| Context flow defined (what passes between agents)? | |
| Failure handling in orchestrator instructions? | |
| Loop detection in orchestrator? | |
| Execution budget in orchestrator? | |
| Autonomy is coherent (no CoPilot child under AutoPilot orchestrator)? | |

#### The Litmus Tests

1. **Replacement test:** If you replaced the LLM with if/else, would behavior change?
   If not → add more heuristic latitude.
2. **Tool selection test:** Can the agent pick the right tool from descriptions alone?
   If not → improve tool descriptions.
3. **Novel situation test:** If an uncovered scenario appears, do heuristics provide
   enough guidance? If not → add expert judgment patterns.
4. **Evidence test:** For high-stakes decisions (classification, escalation, priority),
   does the agent document premises before concluding? If not → add evidence gates.

### Step 6: Deliver

Output all artifacts in this order:

```markdown
# [Workflow Name] — Deployable Artifacts

## Use Case
**Name:** [name]
**Description:**
[Use case description text]

## Agent: [Agent Name]
**Strategy:** [ReAct/CoPilot/AutoPilot]
**Execution mode:** [copilot/autopilot]
**Instructions:**
[Full instruction text in a code block]
**Word count:** [N]

## Tool: [tool_name]
**Type:** [script/flow_action/etc.]
**Execution mode:** [supervised/autonomous]
**Description:**
[Tool description text]
**Input schema:**
[JSON]
**Output schema:**
[JSON]

[Repeat for each tool]

---

## Design Document
[Full design doc]

---

## Test Scenarios
1. [Scenario]: [Expected behavior] / [What constitutes failure]
2. [Scenario]: [Expected behavior] / [What constitutes failure]
3. [Scenario]: [Expected behavior] / [What constitutes failure]

## Autonomy Graduation Path
- Current: Tier [N] ([strategy])
- Next: Tier [N+1] after [milestone]
- Future: Tier [N+2] after [milestone]

## Known Gaps
- [Gap 1]
- [Gap 2]
```

---

## Converting Existing Agent Instructions

When the user provides existing ServiceNow agent instructions to upgrade:

1. **Identify the current structure** — map to IDENTITY/OBJECTIVE/TOOLS/WORKFLOW/RULES/OUTPUT
2. **Convert each section:**
   - IDENTITY → Identity & Expertise (add knowledge boundaries)
   - OBJECTIVE → Goal (add effort budget + completion signal)
   - WORKFLOW → Expert Approach (convert numbered steps to heuristics)
   - RULES → split into Guardrails (hard) + Expert Approach (soft norms)
   - TOOLS → add "Do NOT use when..." to each
   - OUTPUT → Communication (keep)
3. **Add missing SIGNAL elements:**
   - Anti-hallucination protocol
   - Examples with reasoning exposed
   - Self-check before responding
   - Strategy-specific behavioral norms
4. **Present before/after** with word counts and what changed

---

## Platform Constraints Reference

| Constraint | Limit | Source |
|-----------|-------|-------|
| Agent instructions | 1500 words max | agent-instruction-templates.md |
| Orchestrator instructions | 300-500 words | agent-instruction-templates.md |
| Tools per agent | 20 | sn_aia.maximum_agent_tools |
| Consecutive same-tool calls | 25 (developer-editable) | sn_aia.continuous_tool_execution_limit |
| Tool naming | snake_case only | tool-script-rules.md |
| Tool scripts | GlideRecordSecure + addUserEncodedQuery() | tool-script-rules.md |
| Forbidden in tool scripts | gs.*, GlideDateTime | tool-script-rules.md |
| Recursive execution | 50 creates / 5 updates per 15 min | agentic-patterns.md |
| Max retries on failure | 3 | sn_aia.react_failure_retry_max_limit |

---

*Skill version 1.2.0. Built for AI Foundry team. Combines SIGNAL framework with ServiceNow
Zurich AI Agent platform constraints.*
