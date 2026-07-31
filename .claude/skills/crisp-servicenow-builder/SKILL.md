---
name: crisp-servicenow-builder
scope: project
recommended: true
version: 1.2.0
description: >
  Build ServiceNow AI Agents using the hybrid CRISP-ServiceNow methodology. Generates
  use case definitions, agent instructions, and tool descriptions that combine CRISP's
  structured anti-hallucination approach with ServiceNow Zurich platform constraints.
  Supports single-agent, orchestrator, and child agent patterns. Use when the user wants
  to build an agent that follows procedural steps — such as data collection, orchestration,
  or query-based agents where every decision point has explicit branches. Also use for
  highly regulated workflows requiring audit-traceable decision logic. For agents that
  need to reason, analyze, or apply expert judgment, consider SIGNAL instead. Triggers
  include "CRISP agent", "CRISP prompt", "build me a data collection agent",
  "procedural agent", "pipeline agent", "orchestrator agent", or any request specifying
  the CRISP framework for ServiceNow AI agent artifacts.
---

## Instructions

When the user asks to build a ServiceNow AI agent or agentic workflow using CRISP:
1. Read prerequisites (context files listed below) before starting
2. Follow the 6-step workflow: gather requirements → determine architecture → generate design doc → generate deployable instructions → validate → deliver
3. Always ask clarifying questions before generating artifacts (see Step 1) — focus on decision branches, error handling, and edge cases
4. Use explicit, branching decision logic throughout — every step must have an "uncertain" path
5. Include all 3 mandatory anti-hallucination statements in every agent's Rules section
6. Validate all artifacts against the checklist in Step 5 before delivering
7. Reference `examples/it-incident-triage.md` for a complete worked example

---

# Hybrid CRISP-ServiceNow Agent Builder

Build structured, step-driven ServiceNow AI Agents with explicit decision logic and
anti-hallucination safeguards — while staying within ServiceNow Zurich platform constraints.

## Philosophy

The best agent instructions leave **nothing ambiguous** — every decision point has an
explicit branch, every tool has error handling, and every scenario has a defined path.
If the agent encounters a situation not covered by the instructions, it asks rather
than guesses.

This skill merges CRISP (Context, Rules, Intent, Steps, Patterns) with ServiceNow's
platform reality: 1500-word instruction limits, 20-tool caps, strategy types, and
multi-agent orchestration.

**Three rules that govern every CRISP instruction set:**

1. **Define explicit boundaries, not vague guidance.** The agent knows exactly what it
   CAN and CANNOT do — no ambiguity.
2. **Every decision point has an "uncertain" branch.** If the agent can't determine the
   right path, it asks or escalates — never assumes.
3. **Patterns teach through concrete examples.** The agent learns correct behavior from
   seeing real scenarios with rationale, not abstract principles.

---

## Prerequisites

**Read these context files before starting:**
1. `context/agent-instruction-templates.md` — ServiceNow strategy templates and pitfalls
2. `context/tool-script-rules.md` — Tool script rules and platform limits
3. `context/multi-agent-handoff-patterns.md` — Multi-agent architecture

**Methodology reference:**
- `section-guide.md` — Full CRISP-ServiceNow methodology guide (in this skill directory)

---

## Workflow

### Step 1: Gather Requirements (REQUIRED — DO NOT SKIP)

If the user provides incomplete requirements, ask clarifying questions. Gather the
following before generating anything.

#### Required Inputs

| # | Input | Key Question |
|---|-------|-------------|
| 1 | **Agent name and purpose** | What is this agent called and what specific problem does it solve? |
| 2 | **Target users/audience** | Who interacts with this agent? What is their technical level? |
| 3 | **Available tools/APIs/data sources** | What systems, tables, APIs can the agent access? List existing tools or tools to create. |
| 4 | **Primary workflows** | What are the main workflows this agent must support? Walk through each. |
| 5 | **Critical business rules** | What rules are non-negotiable? What must NEVER happen? |
| 6 | **Known edge cases** | What unusual situations has this process encountered? What broke before? |
| 7 | **Trigger type** | Chat, record, scheduled, or API? |

#### Optional But Valuable

- Example interactions showing how a human handles this today
- Existing agent instructions to improve
- Compliance or regulatory requirements
- Whether this is single-agent or part of a multi-agent workflow
- ServiceNow tables involved
- Expected output format for agent responses

#### Quick Interview (if user provides minimal info)

Ask these questions in order, stopping when you have enough:

1. "What is the agent's name and what specific problem does it solve?"
2. "Who will use this — end users via chat, IT staff in Agent Workspace, or is it triggered automatically?"
3. "What tools or data sources does the agent need? (ServiceNow tables, APIs, KB, etc.)"
4. "Walk me through the primary workflow step by step — what happens first, then what?"
5. "What must NEVER happen? What's the worst failure mode?"
6. "What edge cases or unusual situations should the agent handle?"

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
# [Workflow/Agent Name] — Design Document (CRISP)

## 1. Requirements Summary
- **Purpose:** [Specific problem this solves]
- **Users:** [Who and what they expect]
- **Trigger:** [Chat/Record/Scheduled/API]
- **Architecture:** [Single agent / Orchestrator + N children]
- **Autonomy:** Tier [1-4] — [strategy]

## 2. Context & Capability (CRISP C)
- **Role:** [Who the agent is]
- **CAN do:** [Explicit list of capabilities]
- **CANNOT do:** [Explicit boundaries]
- **Tools available:** [List with brief purpose]
- **Data sources:** [What the agent can access]
- **Knowledge boundaries:**
  - Knows: [stable domain knowledge]
  - Must look up: [real-time data, user-specific info]

## 3. Agent Design
[For each agent in the workflow:]

### [Agent Name]
- **Role:** [Identity]
- **Strategy:** [ReAct/CoPilot/AutoPilot]
- **Scope:** [What this agent handles — and explicitly what it does NOT]

### Tools
[For each tool:]
- **[tool_name]**
  - Type: [script/flow_action/subflow/record_operation/etc.]
  - Purpose: [What it does]
  - When to use: [Trigger conditions]
  - When NOT to use: [Disambiguation]
  - Parameters: [Key inputs with format]
  - Returns: [What the response contains]
  - Error handling: [What to do when it fails]
  - Execution mode: [supervised/autonomous]

### Rules & Constraints (CRISP R)
RULES (Never violate):
1. [Hard constraint 1]
2. [Hard constraint 2]
3. [Hard constraint 3]

Anti-hallucination safeguards:
- [Domain-specific anti-hallucination rule 1]
- [Domain-specific anti-hallucination rule 2]

Escalation triggers:
- [When to stop and hand off]

### Intent & Goal (CRISP I)
- **GOAL:** [One sentence objective]
- **SUCCESS:** [Observable outcomes, 3-5 bullets]
- **FAILURE:** [What must never happen]
- **Effort budget:** [Tool call ranges by complexity]
- **Done when:** [Completion signal]

### Steps & Decision Logic (CRISP S)
[For each major workflow step:]

STEP 1: [Action]
  → If [condition A]: [path with specific actions]
  → If [condition B]: [path with specific actions]
  → If uncertain: [ask/stop/default behavior]
  Validation: [How to verify this step succeeded]
  Error handling: [What to do if this step fails]

STEP 2: [Action]
  → If [condition A]: [path]
  → If [condition B]: [path]
  → If uncertain: [ask/stop/default]
  Validation: [checkpoint]
  Error handling: [recovery]

[Continue for all steps...]

Termination conditions:
- [When to end the workflow]
- [When to escalate instead of continuing]

### Patterns & Examples (CRISP P)
[3 examples: happy path, edge case, correct escalation/refusal]

#### Example 1 — [Happy Path Scenario]
- User: "[input]"
- Agent: [correct behavior with reasoning]
- Rationale: [why this is correct]

#### Example 2 — [Edge Case]
- User: "[input]"
- Agent: [correct behavior with reasoning]
- Rationale: [why this is correct]

#### Example 3 — [Escalation/Refusal]
- User: "[input]"
- Agent: [correct behavior with reasoning]
- Rationale: [why this is correct]

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

Use the CRISP template. **Must be under 1500 words** (800 for simple, 300-500 for
orchestrators).

##### Single Agent / Child Agent Template

```
CRITICAL: [Most important rule — first sentence gets highest attention]

## Context & Capability
You are [ROLE] for ServiceNow with access to [N] tools for [capabilities summary].

You CAN:
- [Explicit capability 1]
- [Explicit capability 2]
- [Explicit capability 3]

You CANNOT:
- [Explicit boundary 1]
- [Explicit boundary 2]

You KNOW: [stable domain knowledge]
You do NOT know (use tools): [real-time data, user-specific info, things that change]

## Rules (Never Violate)
1. Never [specific prohibited action] — always [required alternative]
2. Always [required action] before [dependent action]
3. If [dangerous condition], stop and [escalation action]
4. If [data] not available, ask — never assume
5. Only reference data from tool responses, not training knowledge for [domain-specific info]
6. If [tool] fails, respond: [specific fallback message or action]

## Intent & Goal
GOAL: [One sentence objective — outcome, not process]

SUCCESS when:
- [Observable outcome 1]
- [Observable outcome 2]
- [Observable outcome 3]

FAILURE if:
- [What must never happen 1]
- [What must never happen 2]

Effort budget:
- [Simple]: [N-M] tool calls
- [Complex]: [N-M] tool calls
- Exceeding [max]: summarize progress, [escalation action]

Done when: [Completion signal]

## Steps & Decision Logic

STEP 1: [Action description]
  → If [condition A]: [specific path]
  → If [condition B]: [specific path]
  → If uncertain: [ask user / use default / escalate]
  Evaluate ALL conditions — state which are met and which are not met, citing evidence.

STEP 2: [Action description]
  → If [condition A]: [specific path]
  → If [condition B]: [specific path]
  → If uncertain: [ask user / use default / escalate]
  Evaluate ALL conditions — state which are met and which are not met, citing evidence.

STEP 3: [Action description]
  → If [condition A]: [specific path]
  → If [condition B]: [specific path]
  → If uncertain: [ask user / use default / escalate]
  Evaluate ALL conditions — state which are met and which are not met, citing evidence.

[Continue for all major decision points...]

Termination:
- Complete when [completion criteria]
- Escalate when [escalation triggers]
- Stop if [hard stop conditions]

## Evidence Gates (for high-stakes decisions)
[Optional — use after classification, escalation, priority, or approval steps]

After STEP [N] decision, construct an internal reasoning certificate:

STEP [N]a: Evidence Validation (INTERNAL — DO NOT DISPLAY TO USER)
  Premises: [List each data point from Step N with its source]
  Trace: [For EACH condition in Step N, state whether met or not met,
    cite the evidence. Include conditions NOT met and why]
  Conclusion: [State determination. Flag any unverified premises]

STEP [N]b: Present to User
  Display ONLY: [outcome, recommended action, brief explanation]
  DO NOT include: premises, traces, certificates, or internal reasoning

Platform note: Anchor evidence gates to an analytical action (e.g., "Analyze
the classification by evaluating premises and trace") so the ReAct engine
treats it as executable. Keep focused — Thought field budget is ~4-5 sentences.

## Parallel Execution (ReAct V3)
[Declare independent vs dependent operations explicitly]

For independent operations (no shared inputs or write targets):
  STEP [N]: Parallel data collection
    Retrieve ALL of the following simultaneously — these operations
    are independent and share no dependencies:
    • [Operation 1]
    • [Operation 2]
    • [Operation 3]
    → If any operation fails: note which failed, proceed with available data
    → If all fail: escalate with list of failures

For dependent operations (same record or sequential logic):
  STEP [N]: Sequential updates
    Apply the following sequentially — these write to the same record:
    1. [Update 1]
    2. [Update 2]

Rules: Max 4 operations per parallel batch. Copilot tools always run alone.
User-interaction actions always run alone.

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

## Tools
- **[tool_name]**: [When to use]. [When NOT to use].
[Repeat for each tool — 1-2 lines each. Heavy descriptions go in tool.description field.]

## Communication
[Output format — be explicit]
- [Template or structural requirements]
- [Tone and style guidance]
- Internal reasoning (branch evaluations, confidence scores, evidence traces) → work notes only
- User sees only: the outcome, recommended action, and brief plain-language explanation
- NEVER include premises, traces, or evidence certificates in user-facing output

## Patterns & Examples

### Example 1 — [Happy path scenario]
User: "[input]"
Agent: [correct behavior]
Rationale: [why correct]

### Example 2 — [Edge case or escalation]
User: "[input]"
Agent: [correct behavior]
Rationale: [why correct]

Self-check before responding:
- Does this meet the success criteria?
- Did I follow all Rules without exception?
- Did I use tools to verify claims — never assumed?
- Would the recipient have enough context to act?

CRITICAL: [Most important rule repeated — last sentence gets high attention]
```

##### Orchestrator Template (300-500 words)

```
CRITICAL: [Top rule]

## Context & Capability
You are the orchestrator for [workflow name]. You coordinate specialist agents
to [overall workflow goal].

You CAN: dispatch to child agents, aggregate results, handle routing decisions
You CANNOT: execute domain tasks directly — always delegate to specialists

## Rules (Never Violate)
1. Never dispatch same task to same agent twice (loop detection)
2. Always include task context and expected output format in every dispatch
3. If uncertain which agent to use, [specific fallback behavior]

## Intent & Goal
GOAL: [One sentence — workflow-level outcome]
Done when: [All children completed, results aggregated]

## Available Agents
- **[Child A]**: Handles [scope]. Dispatch when [condition].
- **[Child B]**: Handles [scope]. Dispatch when [condition].

## Steps & Decision Logic

STEP 1: Analyze the request
  → If [type A]: dispatch to [Child A]
  → If [type B]: dispatch to [Child B]
  → If [type A + B]: dispatch sequentially, passing output forward
  → If uncertain: [ask user / default agent]

STEP 2: Monitor child execution
  → If child succeeds: collect results, proceed to next step or aggregation
  → If child returns error (transient): retry once with same parameters
  → If child returns error (data): report to user with specifics
  → If child returns error (logic): adjust parameters and retry
  → If same error twice: escalate to human

STEP 3: Aggregate and deliver
  → Compile: what was done, issues found, next steps
  → Ensure consistent terminology across all child outputs

Budget: max [N] dispatches per request.

CRITICAL: [Top rule repeated]
```

#### 4c: Tool Descriptions (sn_aia_tool.description)

For each tool, generate a 3-6 sentence description:

```
[What this tool does — 1 sentence with return value summary].
Use when [trigger conditions]. Do NOT use when [what another tool handles instead].
[Caveat: ACL behavior, rate limits, error patterns, or data format notes].
If this tool fails: [specific recovery guidance].
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
| Critical rule at top AND bottom? | |
| Context & Capability defines CAN and CANNOT explicitly? | |
| Knowledge boundaries stated (know vs must-look-up)? | |
| Rules are non-negotiable hard constraints (not preferences)? | |
| Anti-hallucination safeguards present (3 required statements)? | |
| Intent has observable SUCCESS and FAILURE criteria? | |
| Effort budget defined? | |
| Completion signal defined? | |
| Every step has explicit decision branches? | |
| Every step has an "uncertain" branch? | |
| Every step has error handling? | |
| Termination conditions defined? | |
| At least 2 examples with rationale? | |
| Self-check included before final response? | |
| Strategy-specific norms included? | |
| Output format explicitly defined? | |
| Every tool listed with when AND when-not? | |
| No vague verbs (handle, process, manage → specific actions)? | |
| Evidence gates present after high-stakes decision steps? | |
| Evidence gates use STEP [N]a (INTERNAL) + STEP [N]b (user-facing) pattern? | |
| Independent operations grouped with parallel anchors? | |
| Dependent operations explicitly serialized? | |
| Parallel batches limited to ≤4 operations? | |
| Tool output schemas include decision-ready fields (recommended_action, confidence)? | |
| Each step evaluates ALL conditions with evidence (not just the matching one)? | |
| Internal reasoning separated from user-facing output? | |

#### Tool Description Validation

| Check | Pass? |
|-------|-------|
| 3-6 sentences? | |
| Includes "when to use"? | |
| Includes "when NOT to use" (disambiguation)? | |
| At least one caveat? | |
| Includes failure recovery guidance? | |
| All tool names are snake_case? | |
| Input schema has mandatory: true on required fields? | |

#### Multi-Agent Validation (Pattern B only)

| Check | Pass? |
|-------|-------|
| Non-overlapping scope across children? | |
| Consistent terminology across all agents? | |
| Orchestrator under 500 words? | |
| Context flow defined (what passes between agents)? | |
| Failure handling with explicit decision branches? | |
| Loop detection in orchestrator? | |
| Execution budget in orchestrator? | |
| Autonomy is coherent (no CoPilot child under AutoPilot orchestrator)? | |

#### The CRISP Quality Tests

1. **Ambiguity test:** Read each step — is there ANY scenario where the agent wouldn't
   know which branch to take? If yes → add a branch or clarify conditions.
2. **Tool selection test:** Can the agent pick the right tool from descriptions alone?
   If not → improve tool descriptions.
3. **Hallucination test:** Could the agent ever fabricate data instead of using a tool?
   If yes → add explicit anti-hallucination safeguard for that data type.
4. **Edge case test:** Take each example pattern — does the decision logic handle it?
   If not → add steps or branches.
5. **Evidence test:** For high-stakes decision steps, does the agent document premises
   and trace before concluding? If not → add evidence gate step after the decision.

### Step 6: Deliver

Output all artifacts in this order:

```markdown
# [Workflow Name] — Deployable Artifacts (CRISP)

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

1. **Identify the current structure** — map to any existing format
2. **Convert each section to CRISP:**
   - Identity/Role → Context & Capability (add CAN/CANNOT lists)
   - Objective → Intent & Goal (add SUCCESS/FAILURE criteria)
   - Workflow steps → Steps & Decision Logic (add branches for every decision point)
   - Rules → Rules & Constraints (separate hard from soft, add anti-hallucination)
   - Tools → add "Do NOT use when..." and error handling to each
   - Examples → Patterns & Examples (add rationale to each)
3. **Add missing CRISP elements:**
   - Anti-hallucination safeguards (3 required statements)
   - "Uncertain" branch on every decision point
   - Error handling on every step
   - Termination conditions
   - Self-check before responding
4. **Present before/after** with word counts and what changed

---

## CRISP vs SIGNAL: When to Choose Which

> **Rule of thumb:** If the agent could be replaced by a script, use CRISP.
> If the agent needs to think, use SIGNAL.

### Use CRISP When:

| Agent Type | Why CRISP |
|-----------|-----------|
| **Orchestrators / pipeline controllers** | Deterministic dispatch with explicit failure branches |
| **Data collection agents** (GlideRecord, REST APIs) | Procedural steps, bounded scope, no judgment needed |
| **Regulated workflows** | Explicit branches satisfy audit requirements |
| **Narrow, well-defined tasks** | Decision trees map cleanly to bounded workflows |
| **Anti-hallucination critical** | Every data access point has explicit safeguards |
| **Complex branching logic** | Decision trees with explicit paths at each node |

### Use SIGNAL Instead When:

| Agent Type | Why SIGNAL |
|-----------|-----------|
| **Root cause analysis / synthesis** | Evidence weighing, confidence assessment, expert judgment |
| **Log/data analysis** | Pattern recognition, timeline interpretation, anomaly detection |
| **Knowledge search + analysis** | Interpreting semantic search results, relevance assessment |
| **Broad problem spaces** | Heuristics guide reasoning across novel situations |
| **Expert judgment encoding** | "How would a senior practitioner approach this?" |

### Hybrid Pattern (Multi-Agent Workflows)

In multi-agent pipelines, use **both frameworks**:
- CRISP for agents that collect, query, and structure data
- SIGNAL for agents that analyze, reason, and synthesize

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

*Skill version 1.2.0. Built for AI Foundry team. Combines CRISP framework with ServiceNow
Zurich AI Agent platform constraints.*
