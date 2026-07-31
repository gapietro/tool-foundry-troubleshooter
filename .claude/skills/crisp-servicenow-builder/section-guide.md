# CRISP Section Guide

Deep-dive reference for each CRISP section. Read the relevant section when you need
detailed guidance, anti-patterns, or examples for a specific part of the framework.

---

## C — Context & Capability

### Purpose
Establish exactly what the agent is, what it can do, and what it cannot do. The agent's
entire decision space is bounded by this section. If something isn't listed in CAN or
CANNOT, it's ambiguous — and ambiguity leads to hallucination or incorrect actions.

### What Good Looks Like

**Strong Context & Capability:**
- Role is specific enough to shape reasoning
- CAN list covers every authorized action
- CANNOT list draws clear boundaries
- Knowledge boundaries separate "knows" from "must look up"

**Template:**
```
You are [ROLE] with access to [TOOLS].

You CAN:
- [Specific authorized action 1]
- [Specific authorized action 2]
- [Specific authorized action 3]

You CANNOT:
- [Explicit boundary 1 — what to do instead]
- [Explicit boundary 2 — what to do instead]

You KNOW: [stable domain knowledge the agent can rely on]
You do NOT know (use tools): [things that change, user-specific data, real-time state]
```

### Anti-Patterns

BAD: "You are an AI assistant that helps users"
- No role specificity, no boundaries, no knowledge delineation

BAD: "You can do anything the user asks"
- No CANNOT list, invitation to hallucinate or overstep

GOOD: "You are a senior IT support specialist for ServiceNow ITSM with access to 6 tools
for incident management, knowledge base search, and user lookup. You CAN: create/update/
resolve incidents, search KB, look up users, add work notes. You CANNOT: delete records,
modify user accounts, access financial data, or make changes to production configurations.
You KNOW: ITIL processes, ServiceNow platform capabilities, common IT troubleshooting
patterns. You do NOT know (use tools): current incident states, user details, CMDB
relationships, recent changes, real-time system status."

### CAN vs CANNOT Design

**CAN should be exhaustive for the agent's domain:**
- List every action type the agent can take
- Group by category if >5 capabilities
- Include the mechanism (which tool enables each)

**CANNOT should focus on likely overreach:**
- What might the agent TRY to do that it shouldn't?
- What do users commonly ask for that's out of scope?
- For each CANNOT, specify what the agent should do instead

### Knowledge Boundary Design

The most effective anti-hallucination technique is explicit knowledge boundaries.
The agent treats "You KNOW" content as safe to reference and "You do NOT know" content
as requiring tool verification.

```
YOU KNOW:
- ITIL v4 processes and terminology
- ServiceNow platform table structures and relationships
- Common enterprise IT troubleshooting patterns
- Standard SLA tiers and escalation paths

YOU DO NOT KNOW (use tools to find out):
- Current state of any specific record (incident, change, user, CI)
- Organization-specific business rules or custom configurations
- Real-time system availability or performance
- User preferences, history, or VIP status
- Approval states or pending actions
```

---

## R — Rules & Constraints

### Purpose
Non-negotiable guardrails. Everything in this section is a hard constraint that cannot
be violated under any circumstances. If it's a preference or soft guidance, it does NOT
belong in Rules — move it to Steps or Patterns.

### Design Principles

1. **Keep it short.** 5-8 rules maximum. Each rule consumes attention. More rules = more
   conflicts = more brittle behavior.

2. **Be specific, not vague.** "Never share PII" is vague. "Customer SSN, account numbers,
   and auth tokens must never appear in agent responses" is specific.

3. **Include the alternative.** Don't just say "Never do X." Say "Never do X — instead, do Y."

4. **Anti-hallucination is a rule.** In enterprise contexts, fabricating data is a safety
   issue. Three anti-hallucination statements are REQUIRED:
   - "If [data] not available, ask — never assume"
   - "Only reference data from tool responses, not training knowledge for [domain info]"
   - "If [tool] fails, respond: [specific fallback message]"

### Template

```
RULES (Never violate):
1. Never [prohibited action] — always [required alternative]
2. Always [required action] before [dependent action]
3. If [dangerous condition], stop and [escalate to specific role/queue]
4. If [data type] not available, ask — never assume
5. Only reference data from tool responses, not training knowledge for [domain-specific info]
6. If [critical tool] fails, respond: "[specific fallback message]"
```

### Anti-Patterns

BAD: A list of 15+ rules covering every edge case
- The agent can't reliably track this many hard constraints
- Move soft preferences to Steps as "preferred paths"

BAD: "Be careful with sensitive data"
- Which data? Careful how? This is not a rule — it's a vibe

BAD: "Follow company policies"
- Which policies? The agent doesn't have your policy docs unless you tell it what they say

GOOD:
```
RULES (Never violate):
1. Never modify incident priority without checking impact × urgency — override only
   with documented justification in work notes
2. Never share customer account numbers, SSNs, or auth tokens in responses — if a
   customer provides these unprompted, acknowledge without repeating and process via
   secure_data_handler tool only
3. If incident involves data breach indicators (unauthorized access, data exfiltration,
   credential compromise), immediately escalate to Security Incident Response — do not
   attempt resolution
4. If any tool returns no data for a user query, state "I wasn't able to find that
   information" — never fabricate records, numbers, or dates
5. Only reference incident details, user information, and CMDB data from tool responses —
   never from general knowledge
6. If manage_incident tool fails, respond: "I'm unable to update the incident right now.
   Please try again or contact the service desk directly at ext. 4357"
```

### Rules vs Steps

| If it's... | Put it in... |
|------------|-------------|
| A hard constraint that can NEVER be violated | Rules |
| A preferred approach that could flex | Steps (as default path) |
| Guidance for how to handle a situation | Steps (as decision branch) |
| An example of correct behavior | Patterns |

---

## I — Intent & Goal

### Purpose
The agent's north star. Everything in the prompt exists to serve this goal. The agent
should be able to self-evaluate against success/failure criteria at any point during
execution.

### What Good Looks Like

**Strong Intent:**
- GOAL is one sentence, outcome-focused (not activity-focused)
- SUCCESS criteria are observable and self-evaluable
- FAILURE conditions are specific (not just "don't mess up")
- Effort budget prevents runaway execution
- Completion signal tells the agent when to stop

**Template:**
```
GOAL: [One sentence — what outcome does this deliver?]

SUCCESS when:
- [Observable outcome 1 — the agent can verify this from its own output]
- [Observable outcome 2]
- [Observable outcome 3]

FAILURE if:
- [Specific bad outcome 1]
- [Specific bad outcome 2]

Effort budget:
- Simple tasks: [N-M] tool calls
- Complex tasks: [N-M] tool calls
- Exceeding [max]: summarize progress, escalate with context

Done when: [Specific completion signal]
```

### Anti-Patterns

BAD GOAL: "Handle customer inquiries efficiently"
- Vague, unmeasurable, activity-focused

GOOD GOAL: "Resolve customer inquiries so that the customer's question is fully answered
with verified information and any required actions are completed or escalated with context"

BAD SUCCESS: "Customer is satisfied"
- Not self-evaluable — the agent can't measure satisfaction

GOOD SUCCESS:
- "Customer's question is answered with specific, verified data"
- "Any required system changes are completed and confirmed"
- "If escalation needed, context summary is attached to the ticket"

BAD FAILURE: "Things go wrong"
GOOD FAILURE:
- "Agent fabricates incident numbers, dates, or user information"
- "Agent resolves incident without confirming root cause"
- "Agent loops >3 times on the same tool without changing approach"

### Effort Budget Design

Effort budgets prevent the agent from going down rabbit holes:

```
EFFORT BUDGET:
- Password reset, FAQ, simple lookup → 1-3 tool calls
- Configuration issue, access request → 3-8 tool calls
- Complex troubleshooting, cross-system → 8-15 tool calls
- Exceeding 15 tool calls → Stop. Summarize findings, identify blockers,
  recommend whether to continue or escalate to human specialist
```

---

## S — Steps & Decision Logic

### Purpose
The operational core of CRISP. Unlike SIGNAL's heuristic approach, CRISP defines
explicit paths for every decision point. The agent follows a structured flow with
clear branches — but every path includes an "uncertain" branch so the agent never
has to guess.

### Design Principles

1. **Every step has branches.** If a step has no decision point, it can be merged with
   the previous step.

2. **Every decision has an "uncertain" path.** This is what prevents hallucination — if
   the agent can't determine the right branch, it has explicit instructions for what to do.

3. **Branches are exhaustive.** For each decision, list ALL possible conditions, not just
   the common ones.

4. **Include validation checkpoints.** After critical steps, verify the action succeeded
   before proceeding.

5. **Define error handling per step.** Don't rely on a generic "if something fails" —
   each step may fail differently and need different recovery.

### Template

```
STEP 1: [Action]
  → If [condition A]: [specific path with actions]
  → If [condition B]: [specific path with actions]
  → If [condition C]: [specific path with actions]
  → If uncertain: [ask user / use safe default / escalate]
  Validate: [How to confirm this step succeeded]
  On error: [What to do if this step fails]

STEP 2: [Action]
  → If [condition A]: [path]
  → If [condition B]: [path]
  → If uncertain: [safe behavior]
  Validate: [checkpoint]
  On error: [recovery]

[Continue...]

TERMINATION:
- Complete when: [all success criteria met]
- Escalate when: [specific triggers]
- Abort when: [hard stop conditions]
```

### Converting Vague Steps to CRISP Decision Logic

**Vague (common in existing instructions):**
```
Step 1: Look up the incident
Step 2: Diagnose the issue
Step 3: Fix it or escalate
```

**CRISP (explicit branches):**
```
STEP 1: Retrieve incident details using get_incident tool
  → If incident found: proceed to Step 2 with full record
  → If incident not found: ask user to verify the incident number
  → If tool fails: inform user of temporary system issue, suggest trying again
  Validate: Incident record contains short_description, state, priority, assignment_group

STEP 2: Assess incident category and severity
  → If category is "Network" AND priority is 1-2: check monitoring_dashboard for active alerts
  → If category is "Software" AND user reports crash: search_kb for known issues matching symptoms
  → If category is unclear from description: ask user for specific symptoms
  → If priority seems miscategorized (description says "entire team affected" but priority=4):
    flag priority mismatch, recommend adjustment
  Validate: Category and priority are consistent with incident description

STEP 3: Attempt resolution based on diagnosis
  → If KB article found with >0.8 match: present solution to user, ask if it helps
  → If monitoring shows active outage: inform user of known issue, link to parent incident
  → If no clear diagnosis after 3 lookups: summarize findings, escalate to assignment group
    with diagnostic notes
  → If resolution requires system changes: present plan to user, wait for approval
  On error: Document what was tried, escalate with context
```

### Anti-Patterns

BAD: Steps with no decision branches (just a linear procedure)
- This is a script, not an agent. If there are no decisions, use a Flow Designer workflow

BAD: "Handle edge cases appropriately"
- Which edge cases? Appropriately how? CRISP requires explicit branches

BAD: Steps that assume tools always succeed
- Every tool can fail. Every step needs error handling

GOOD: Each step has 2-4 explicit branches plus an "uncertain" catch-all

### Termination Design

Define three types of termination:

```
TERMINATION:
- COMPLETE when: [positive exit — all success criteria met]
  Example: "User confirms issue is resolved AND incident state updated to Resolved"

- ESCALATE when: [conditions requiring human intervention]
  Example: "3+ tool calls without progress, security-related issue detected,
  user explicitly requests human agent"

- ABORT when: [hard stop — something has gone wrong]
  Example: "Tool returns unauthorized error, agent detects it's in a loop,
  data integrity concern identified"
```

### Branch Accountability

When a step has conditional logic, require the agent to evaluate EVERY branch — not just
the one it selects. This prevents the ReAct engine from optimizing away branches.

**Without branch accountability:**
```
STEP 3: Classify the incident
  → If symptoms match network issue: Category = Network
  → If symptoms match software issue: Category = Software
  → If uncertain: ask user
```
Agent picks "Software" without documenting why "Network" was ruled out.

**With branch accountability:**
```
STEP 3: Classify the incident
  For EACH condition, state whether met or not met with evidence:
  → If symptoms match network issue: Category = Network
  → If symptoms match software issue: Category = Software
  → If symptoms match hardware issue: Category = Hardware
  → If none of the above: Category = General, ask user for details

  Evaluate ALL conditions — document which are TRUE, which are FALSE,
  and the specific data points that determined each evaluation.
```

**Platform caveat:** ServiceNow's ReAct engine may skip branches it determines aren't met.
Frame branches as mandatory evaluation requirements: "For EACH condition, determine and
document whether it is met. This evaluation is a required step regardless of outcome."

---

## P — Patterns & Examples

### Purpose
Concrete demonstrations of correct agent behavior. Unlike SIGNAL's reasoning-focused
examples, CRISP patterns emphasize the **decision path taken** — showing which branches
were followed and why. Each example includes a rationale so the agent learns the
decision-making pattern.

### What Good Looks Like

Every CRISP prompt needs minimum 3 examples:
1. **Happy path** — standard interaction, everything works
2. **Edge case** — unusual situation handled correctly
3. **Escalation/refusal** — agent correctly stops and escalates

### Template

```
EXAMPLE — [Scenario name]:
User: "[exact input]"
Agent: [exact behavior — which steps taken, which branches followed]
Rationale: [why this is the correct decision path]

EXAMPLE — [Edge case name]:
User: "[exact input]"
Agent: [exact behavior — note which step's "uncertain" branch was used]
Rationale: [why this is correct, what would have been wrong]

EXAMPLE — [Escalation name]:
User: "[exact input]"
Agent: [exact behavior — which rule triggered the escalation]
Rationale: [why escalation is correct here, what would have been dangerous]
```

### Anti-Patterns

BAD examples:
```
User: "Help me with my incident"
Agent: Helped the user with their incident.
```
(Zero learning signal — doesn't show decision path)

BAD examples that show only happy path:
(Agent never sees how to handle edge cases or escalation)

GOOD examples:
```
EXAMPLE — User provides wrong incident number:
User: "What's the status of INC9999999?"
Agent: Used get_incident with INC9999999 → tool returned no results.
  Followed Step 1 "uncertain" branch: "I wasn't able to find incident INC9999999.
  Could you double-check the number? It's usually in the format INC followed by
  7 digits. You can also describe the issue and I can search for it."
Rationale: Agent did NOT fabricate incident details (Rule 4). Used the "uncertain"
  branch from Step 1 instead of guessing. Offered alternative path (search by
  description) rather than dead-ending the conversation.
```

### Example Coverage Checklist

Before delivering, verify examples cover:

| Scenario Type | Covered? |
|--------------|----------|
| Happy path (standard workflow) | |
| Edge case (unusual input or state) | |
| Escalation (agent correctly hands off) | |
| Anti-hallucination (agent refuses to fabricate) | |
| Tool failure (agent handles gracefully) | |

Not all 5 need separate examples — an edge case example can also demonstrate
anti-hallucination. But all 5 scenarios must be covered across the examples.

### Connecting Patterns to Steps

Each example should reference which Steps and branches were followed:

```
EXAMPLE — Customer asks about order not in system:
User: "Where's my order #ORD-12345?"
Agent:
  STEP 1 → Used lookup_order with ORD-12345 → no results
  STEP 1 "uncertain" branch → Asked user: "I can't find that order number.
    Can you confirm the order number from your confirmation email?"
  User provided corrected number → STEP 1 → Found order
  STEP 2 → Order status: "Shipped", tracking available
  STEP 3 → Delivered tracking info with estimated delivery
Rationale: Followed decision logic exactly. Did not assume the order didn't exist —
  asked for correction first (Rule: "If data not available, ask — never assume").
```

### Internal vs External Output Separation

CRISP agents must separate internal reasoning from user-facing output. This prevents
"reasoning leakage" — surfacing evidence traces, confidence calculations, or branch
evaluations to users.

**Internal (work notes, never shown to user):**
- Branch evaluation results ("Condition A: MET, Condition B: NOT MET because...")
- Confidence calculations ("KB score 0.87, 3/4 similar incidents resolved same way")
- Evidence certificates and reasoning traces
- Tool selection rationale

**User-facing (displayed output):**
- The outcome ("I've identified this as a known Outlook issue")
- Recommended action ("Here's the fix...")
- Brief explanation (1-2 plain-language sentences)

**Anti-pattern — Reasoning leakage:**
```
❌ "Based on evaluating conditions A (MET: symptoms match software pattern),
B (NOT MET: no network indicators), and C (NOT MET: no CI changes), with
KB confidence 0.87 and 3/4 similar incidents matching, I classify this as
Software with 92% confidence..."

✅ "This is a known Outlook issue. I found a documented fix that has worked
for similar cases. Let me walk you through it."
```

---

## Evidence Gates (Cross-Cutting)

### Purpose
Force the agent to prove its reasoning before acting on high-stakes decisions. Based on
semi-formal reasoning research showing accuracy improvement from 78% to 93%. In CRISP,
evidence gates are explicit numbered steps inserted after decision points.

### When to Use Evidence Gates

**Use for:**
- Classification decisions (incident category, priority assignment)
- Escalation determinations (when to stop and hand off)
- Conditional branch evaluation (which path to take)
- Any step where the wrong conclusion has downstream consequences

**Skip for:**
- Simple data retrieval confirmations
- Binary outcomes (record found or not)
- Steps with no judgment involved

### CRISP Evidence Gate Pattern

After any decision step, insert a paired evidence gate:

```
STEP 3: Classify the incident based on symptoms and evidence
  → If [condition A]: [Category X]
  → If [condition B]: [Category Y]
  → If uncertain: [ask user / default]

STEP 3a: Classification Evidence Gate (INTERNAL — DO NOT DISPLAY TO USER)
  Premises:
  • [Data point 1] (source: [tool name / user input / record field])
  • [Data point 2] (source: [tool name])
  Trace:
  • Condition A: [MET/NOT MET] — evidence: [specific data]
  • Condition B: [MET/NOT MET] — evidence: [specific data]
  • Alternative considered: [Category Z] — ruled out because [reason]
  Conclusion:
  • Selected [Category X] based on [premises 1 and 2]
  • Unverified: [any gaps]

STEP 3b: Present Classification to User
  Display ONLY:
  • Category: [X]
  • Recommended action: [next step]
  • Brief explanation: [1-2 sentences in plain language]
  DO NOT include premises, traces, or evidence certificates
```

### Critical: Evidence Gates Are Internal

Evidence certificates are Thought-cycle operations. They must NEVER be surfaced to the user.

**The paired step pattern ensures this:**
- STEP [N]a = INTERNAL reasoning (never shown)
- STEP [N]b = user-facing output (always shown)

### Platform Compatibility

ServiceNow's ReAct engine may collapse non-actionable steps. To prevent this:

1. **Anchor to an action:** Phrase as "Analyze the classification decision by evaluating
   premises and trace internally." This triggers built-in analytical tools.

2. **Keep focused:** Full certificates may exceed the Thought field budget (~4-5 sentences).
   Focus on critical decision points.

3. **Always pair:** Every INTERNAL step must be followed by a user-facing step.

### Branch Accountability

When a step has conditional logic, require the agent to evaluate EVERY branch:

```
STEP 5: Resolution path selection
  For EACH condition, state whether met or not met with evidence:
  • IF category = Hardware AND warranty active: Initiate RMA
  • IF category = Software AND KB match found: Present KB resolution
  • IF category = Network AND P1/P2: Escalate to Network Ops
  • IF none of the above: Route to general support

  Document which conditions evaluated TRUE, which FALSE, and the
  specific data points that determined each evaluation.
```

This prevents the ReAct engine from skipping branches it deems irrelevant.

### Anti-Patterns

- **Reasoning leakage:** Agent surfaces evidence certificate to the user
- **Skipped branches:** Agent selects a path without documenting why others were eliminated
- **Ungrounded assertions:** Agent claims classification without citing premises
- **Missing paired step:** Evidence gate without a following user-facing step

---

## V3 Parallel Execution (Cross-Cutting)

### Purpose
Optimize CRISP step sequences for ServiceNow's ReAct V3 engine, which supports parallel
tool execution. Proper use of independence/serialization anchors reduces round-trips.

### V3 Batching Rules

| Check | Result |
|-------|--------|
| Does any required input come from a tool not yet run? | Serialize |
| Do two tools write to the same field on the same record? | Serialize |
| Tool marked non-parallelizable? | Isolate |
| This a copilot tool (requires user permission)? | Isolate |
| None of above? | Batch (max 4 per batch) |

### Token Anchoring Patterns

The V3 engine uses specific language patterns to determine batchability:

**Independence Anchors (trigger parallel execution):**
- "these operations are independent and share no dependencies"
- "retrieve ALL of the following simultaneously"
- "perform ALL of the following independently"
- "each operation reads from [X] but writes to different targets"

**Serialization Anchors (force sequential execution):**
- "must execute sequentially"
- "these write to the same record"
- "Step B depends on the output of Step A"

**Gating Anchors (create sync points):**
- "once all parallel operations complete"
- "using the combined results from the previous step"

### CRISP Step Patterns

**Pattern 1: Parallel Data Collection Step**
```
STEP 2: Gather diagnostic data
  Retrieve ALL of the following simultaneously — these operations
  are independent and share no dependencies:
  • Search KB for articles matching symptoms
  • Look up affected CI and recent changes from CMDB
  • Search for similar incidents in last 30 days
  → If any operation fails: note which failed, proceed with remaining
  → If all operations fail: escalate with list of failures
  Validate: At least 2 of 3 data sources returned results
```

**Pattern 2: Sequential Update Step**
```
STEP 4: Update incident record
  Apply the following updates sequentially — these write to the
  same record and must execute in order:
  1. Update category based on diagnosis
  2. Update priority based on impact × urgency
  3. Update assignment group based on category
  4. Add work notes with diagnosis summary
  → If any update fails: stop, report which update failed
  Validate: All 4 fields updated, work notes contain diagnosis
```

**Pattern 3: Gate → Fan-Out**
```
STEP 1: Retrieve incident record
  [single lookup]
  Validate: Record found with required fields

STEP 2: Parallel analysis (uses Step 1 output)
  Using the incident from Step 1, perform ALL of the following
  independently — each reads from the incident but writes to
  different analysis targets:
  • Assess assignment group workload
  • Match against knowledge base
  • Check for duplicate/parent incidents
```

**Pattern 4: Parallel Collect → Synthesize → Act**
```
STEP 2: Parallel data gathering
  Retrieve ALL simultaneously: [independent reads]

STEP 3: Synthesize findings (depends on Step 2)
  Using the combined results from Step 2, determine resolution approach

STEP 4: Execute resolution
  [actions based on Step 3 determination]
```

### Anti-Patterns

- **Implicit dependencies:** Separate steps that use each other's output without stating
  the dependency — V3 may batch them incorrectly
- **Overloading:** More than 4 operations in one parallel group
- **Mixing copilot tools:** User-permission tools can't be batched with other tools
- **Accidental serialization:** Independent operations in separate numbered steps instead
  of grouped in one parallel step

---

## Anti-Hallucination Safeguards (Cross-Cutting)

CRISP requires three explicit anti-hallucination statements in every prompt.
These are typically placed in Rules but reinforced throughout:

### The Three Required Statements

1. **Data availability:** "If [specific data type] is not available from tools, ask the
   user — never assume or fabricate"

2. **Source restriction:** "Only reference [domain-specific data] from tool responses,
   not from training knowledge"

3. **Tool failure fallback:** "If [critical tool] fails, respond with [specific fallback
   message] — do not attempt to answer from memory"

### Reinforcement Points

These statements should appear in:
- **Rules:** As non-negotiable constraints
- **Steps:** As "uncertain" branches ("If data unavailable → ask, never assume")
- **Patterns:** In at least one example showing correct refusal to fabricate

### Domain-Specific Examples

**IT Service Management:**
```
- If incident details not found via tool, ask user to verify — never fabricate
  incident numbers, dates, or resolution notes
- Only reference CMDB relationships, change records, and user information from
  tool responses — never from general IT knowledge
- If get_incident or search_incidents fails, respond: "I'm temporarily unable to
  access incident records. Please try again in a moment or contact the service
  desk at ext. 4357"
```

**Customer Service:**
```
- If order status not found via tool, ask customer to verify order number — never
  fabricate shipping dates, tracking numbers, or delivery estimates
- Only reference pricing, inventory, and account details from tool responses —
  never from training data (prices and stock change daily)
- If order_lookup fails, respond: "I'm unable to look up your order right now.
  Let me connect you with a team member who can help."
```

---

## Smart Tool Output Design (Cross-Cutting)

### Purpose
Tools should do the heavy computational lifting — scoring, filtering, ranking — so agents
receive decision-ready data. This reduces token consumption and reasoning errors.

### Bad vs Good Output

**Bad output (forces agent to analyze raw data):**
```json
{
  "data": [{"number": "INC001", "priority": "3"}, /* 846 more */],
  "count": 847
}
```

**Good output (agent can act immediately):**
```json
{
  "analysis_complete": true,
  "recommended_action": "FOCUS_ON_CRITICAL",
  "confidence_score": 0.95,
  "key_findings": {
    "critical_items": 3,
    "requires_attention": ["INC001", "INC042"],
    "safe_to_ignore": 844
  },
  "reasoning_trace": {
    "premises": ["847 records scanned", "3 met critical threshold"],
    "logic": "Critical items scored >0.9 on severity index",
    "conclusion": "Focus on 3 critical items"
  },
  "next_steps": "Process critical items in priority order"
}
```

### Design Principles
1. Do the hard work in the platform — complex calculations, scoring, filtering
2. Provide clear next actions — never leave the agent guessing
3. Include confidence indicators — helps agents know when to escalate
4. Include reasoning traces — give agents the premises behind recommendations
5. Structure for scannability — key information immediately visible
6. Design for failure — always include fallback recommendations

### Threshold-Based Intelligence
```javascript
if (total_records > 100) {
  output = { summary_mode: true, critical_subset: topResults };
} else {
  output = { summary_mode: false, detailed_records: records };
}
```
