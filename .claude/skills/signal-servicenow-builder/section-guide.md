# SIGNAL Section Guide

Deep-dive reference for each SIGNAL section. Read the relevant section when you need
detailed guidance, anti-patterns, or examples for a specific part of the framework.

---

## S — Success Criteria & Outcomes

### Purpose
The agent's north star. Everything else in the prompt exists to serve these criteria.
The agent should be able to self-evaluate against them at any point during execution.

### What Good Looks Like

**Strong success criteria are:**
- Observable — you can verify them from the agent's output
- Measurable — there's a clear pass/fail or quality gradient
- Self-evaluable — the agent can check its own work against them
- Outcome-focused — they describe results, not activities

**Effort budgets prevent runaway execution:**
- Simple tasks: 1-5 tool calls
- Medium tasks: 5-15 tool calls
- Complex research: 15-30 tool calls
- If exceeding budget: escalate, summarize progress, ask for guidance

**Completion signals tell the agent when to stop:**
- "The incident is resolved and the user has confirmed"
- "All requested data points have been gathered and synthesized"
- "The recommendation has been delivered with supporting evidence"

### Anti-Patterns

BAD: "Handle customer inquiries efficiently"
- Vague, unmeasurable, activity-focused

GOOD: "Resolve customer inquiries so that: (1) the customer's question is fully answered
with verified information, (2) any required actions are completed or escalated with context,
(3) response time is under 2 minutes for simple lookups, under 5 for research-heavy queries."

BAD: "Process incidents"
GOOD: "Triage and route incidents so that: (1) category and priority are set based on
impact assessment, (2) assignment group matches the technical domain, (3) initial diagnosis
notes capture symptoms, affected systems, and attempted remediation."

### Effort Budget Examples

```
EFFORT BUDGET:
- Password reset, account lookup, FAQ → 1-3 tool calls, resolve directly
- Configuration issue, access request → 3-8 tool calls, may require investigation
- Complex troubleshooting, cross-system issue → 8-15 tool calls, document findings
- Exceeding 15 tool calls → Summarize what you've found, identify blockers,
  recommend whether to continue or escalate to a human specialist
```

---

## I — Identity & Autonomy

### Purpose
Establish who the agent is, what it knows, how much freedom it has, and how it relates
to the human in the loop.

### Identity Design

The identity should be specific enough to shape reasoning but not so rigid it creates
a character that overrides good judgment.

**Good identity:**
"You are a senior IT support specialist with deep knowledge of ServiceNow ITSM,
Active Directory, and enterprise networking. You have 10+ years of experience triaging
complex incidents and know when a problem needs escalation vs. when you can resolve it."

**Over-constrained identity:**
"You are ServiceBot v2.3. You only speak in formal English. You always introduce yourself
at the start of every interaction. You never use contractions."
(This wastes tokens and constrains communication without improving task performance.)

### Autonomy Tier Selection Guide

**Choose Tier 1 (Advisory) when:**
- Agent is new and untested
- Domain has high compliance requirements
- Actions are irreversible (financial transactions, data deletion)
- User population expects full human control

**Choose Tier 2 (Proposal) when:**
- Agent has been tested but isn't fully trusted yet
- Actions are reversible but have meaningful impact
- Audit trail of human approval is required
- This is the right default for most enterprise agents

**Choose Tier 3 (Supervised Action) when:**
- Agent has demonstrated reliability over time
- Actions are logged and can be reviewed/reversed
- Only specific high-impact decisions need human approval
- Speed matters — waiting for approval creates bottlenecks

**Choose Tier 4 (Autonomous) when:**
- Agent handles well-defined, repeatable tasks
- Failure impact is low and easily recoverable
- Volume makes human review impractical
- Extensive testing and monitoring are in place

### Knowledge Boundaries

Explicitly state what the agent knows vs. what it must look up. This prevents
hallucination more effectively than generic "don't make things up" instructions.

```
YOU KNOW:
- ITIL processes and best practices
- ServiceNow platform capabilities and common configurations
- General networking, AD, and enterprise IT concepts

YOU DO NOT KNOW (use tools to find out):
- Current incident details, user information, or CMDB state
- Organization-specific configurations or custom business rules
- Real-time system status or recent changes
```

---

## G — Guardrails & Safety

### Purpose
The smallest possible set of absolute constraints. Everything here is non-negotiable.
If it's a preference rather than a hard rule, it belongs in Norms.

### Design Principles

1. **Keep it short.** Every guardrail the agent must track consumes reasoning capacity.
   More guardrails = more chances for conflict = more brittle behavior.

2. **Write positive directives.** "Only collect order ID and email for verification" is
   clearer than "Do NOT ask for personal information." Positive framing defines a clear
   action space; negative framing leaves ambiguity about what IS allowed.

3. **Include escalation triggers.** Define specific conditions where the agent must stop
   and involve a human, not just what it can't do.

4. **Anti-hallucination is a guardrail.** Fabricating data in enterprise contexts is a
   safety issue, not a quality issue. Treat it accordingly.

### Template

```
HARD CONSTRAINTS:
- Never modify production data without [specific approval mechanism]
- Never share [specific data types] outside [specific boundaries]
- Escalate to [role] when [specific trigger conditions]

ANTI-HALLUCINATION PROTOCOL:
- For [domain-specific data]: only reference information returned by tool calls
- If a tool call fails or returns no data: state this clearly and suggest alternatives
- Never generate [specific data types] — always retrieve from [specific sources]
- When uncertain about facts: say "I'm not sure about this — let me check" and use tools

DATA HANDLING:
- [Specific PII/sensitive data rules]
- [Retention and logging requirements]
```

### Anti-Patterns

BAD: A long list of "Never do X" statements covering edge cases
- The agent can't track 20 negative constraints reliably
- Move soft preferences to Norms

BAD: "Be careful with sensitive data"
- Vague. Which data? Careful how?

GOOD: "Customer SSN, account numbers, and authentication tokens must never appear in
agent responses or logs. If a customer provides these unprompted, acknowledge receipt
without repeating the values and process them via the secure_data_handler tool only."

---

## N — Norms & Heuristics

### Purpose
This is the heart of what makes a SIGNAL prompt agentic. Norms encode the judgment of
skilled practitioners — the "how to think about it" rather than "what to do."

### The Three Types of Norms

**1. Behavioral Norms — How the agent operates**

These are the meta-cognitive instructions that transform a chatbot into an agent.
Based on converging guidance from Anthropic, OpenAI, and Andrew Ng:

```
BEHAVIORAL NORMS:
- Plan before acting: Before each tool call, briefly state what you expect to learn
  and how it connects to the goal.
- Reflect after results: After receiving tool output, assess whether it changes your
  approach or confirms your hypothesis.
- Persist through obstacles: If the first approach doesn't work, try alternatives
  before escalating. Aim for at least 2-3 different approaches.
- Tools over assumptions: When you could guess or look it up, always look it up.
- Know when to stop: If you're not making progress after [N] attempts, summarize
  what you've tried and escalate rather than spinning.
```

**2. Expert Heuristics — How domain experts think**

These capture the judgment that separates a novice from an expert. They should read
like advice from a senior colleague, not a procedure manual.

EXAMPLE — IT incident triage:
```
EXPERT HEURISTICS:
- Start from symptoms, not categories. Let the evidence guide classification rather
  than trying to fit the issue into a predefined bucket immediately.
- Check for recent changes first. In enterprise IT, most incidents correlate with
  recent changes — deployments, patches, config updates. This is your highest-value
  first move.
- Broaden before escalating. If the obvious cause isn't confirmed within 3-5
  diagnostic checks, step back and consider adjacent systems. The actual root cause
  is often one layer removed from where symptoms appear.
- Match urgency to impact, not to the reporter's tone. A calm report of a payment
  processing failure outranks an urgent-sounding request about a UI glitch.
```

EXAMPLE — Customer service:
```
EXPERT HEURISTICS:
- Solve the real problem, not just the stated one. Customers often describe symptoms,
  not root causes. If someone asks "how do I reset my password," consider whether
  they might actually be locked out, have a compromised account, or need a broader
  access issue resolved.
- Front-load value. Give the customer something useful in your first response —
  even if it's partial. "I can see your order shipped yesterday, tracking number
  is X. Let me also check on the delivery estimate you asked about" beats
  "Let me look into that for you."
- Calibrate depth to complexity. Simple lookups get direct answers. Complex issues
  get structured responses with clear next steps.
```

**3. Communication Norms — How the agent interacts**

```
COMMUNICATION NORMS:
- Match the user's formality level
- Lead with the answer, then provide context
- When delivering bad news, pair it with a concrete next step
- Use specific quantities over vague qualifiers ("3 incidents this week" not "several")
```

### Converting Steps to Heuristics

This is the most critical skill in SIGNAL. When you encounter step-by-step instructions
that need conversion:

**Deterministic (bad for agentic):**
```
Step 1: Query the CMDB for the CI
Step 2: Check the CI's relationships
Step 3: Look up recent changes to related CIs
Step 4: Search for similar incidents
Step 5: Assign to the appropriate group
```

**Heuristic (good for agentic):**
```
Start by understanding what's affected — look up the configuration item and its
dependencies to get the full picture. Then investigate what changed recently in
that ecosystem, since most incidents trace to recent changes. Check whether this
is a known issue by searching for similar patterns. Once you have a diagnosis
(or a strong hypothesis), route to the team best positioned to resolve it.
The goal is: right team, right context, right urgency — not speed of assignment.
```

The heuristic version gives the same guidance but allows the agent to:
- Skip steps that aren't relevant (no CMDB entry? Move on)
- Reorder based on available information
- Add steps the author didn't anticipate
- Adapt to novel situations

### Branch Reasoning in Heuristics

When agents make judgment calls, they should briefly document why they chose one approach
over alternatives. This prevents "silent branch skipping" where the agent picks a path
without considering others.

In SIGNAL's heuristic style, this is a norm rather than a structural requirement:

"When you choose an approach, briefly note in work notes why alternatives were ruled out.
This is especially important for classification, escalation, and routing decisions."

This is lighter than CRISP's exhaustive branch evaluation but still ensures the agent
considers alternatives rather than fixating on the first plausible option.

**Example:**
```
Work notes: "Classified as Software rather than Network because symptoms are
application-level (Outlook crash) not connectivity-related. Considered Hardware
but no CI changes or device-specific indicators."
```

### Anti-Patterns

BAD: "Process the request appropriately"
- Zero signal. Appropriate how?

BAD: "Follow ITIL best practices"
- The agent may have general ITIL knowledge but doesn't know YOUR interpretation

GOOD: Specific heuristics that encode YOUR organization's interpretation of best practices

---

## A — Agent Tool Interface

### Purpose
Enable the agent to autonomously select the right tool for the situation based on
descriptions alone. If you have to tell the agent which tool to use, the descriptions
are broken.

### The 3-4 Sentence Rule

Every tool description should contain at minimum:
1. What the tool does (capability)
2. When to use it (trigger conditions)
3. When NOT to use it (disambiguation from similar tools)
4. Important caveats (rate limits, auth, known issues)

### Before/After Examples

**Before (typical weak description):**
```
Tool: search_incidents
Description: Search for incidents
```

**After (SIGNAL-quality description):**
```
Tool: search_incidents
Purpose: Search the incident table for existing records matching specified criteria.
  Returns incident number, short description, state, priority, and assignment group.
When to use: When you need to find existing incidents — for duplicate detection,
  pattern analysis, or looking up a specific incident the user references. Supports
  filtering by any incident field including state, category, priority, assignment
  group, and date ranges.
When NOT to use: Don't use this for creating or updating incidents (use
  manage_incident instead). Don't use for searching other tables like problems or
  changes (use search_records with the appropriate table).
Parameters:
  - query: ServiceNow encoded query string (e.g., "priority=1^state=2^assignment_group=Network")
  - fields: Comma-separated field names to return (default: number, short_description,
    state, priority, assigned_to, assignment_group, sys_created_on)
  - limit: Max records to return (default: 20, max: 100)
Caveats: Results are limited by the agent's ACL permissions. Date fields use
  ServiceNow format (YYYY-MM-DD HH:MM:SS). Encoded queries use ^ as AND separator.
  If you get zero results, try broadening your filters before concluding no match exists.
```

### Tool Consolidation

Prefer fewer, more capable tools over many narrow ones:

**Fragmented (harder to select):**
- create_incident
- update_incident
- resolve_incident
- add_comment
- escalate_incident

**Consolidated (easier to select):**
- manage_incident (action: create | update | resolve | comment | escalate)
- search_incidents
- get_incident_details

### Error Response Design

Tool error responses should guide recovery, not just report failure:

**Bad error:** `{"error": "404 Not Found"}`

**Good error:** `{"error": "No incident found with number INC0012345. This could mean:
(1) the number was mistyped — check with the user, (2) the incident was deleted or
merged — try searching by short description instead, (3) the agent lacks permission
to view this incident's assignment group."}`

### Smart Tool Output Design

Tools should do the heavy lifting — complex calculations, scoring, filtering — so agents
receive decision-ready data rather than raw dumps.

**Bad output (forces agent to analyze):**
```json
{
  "data": [{"number": "INC001", "priority": "3", ...}, /* 846 more records */],
  "count": 847
}
```

**Smart output (agent can act immediately):**
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
    "conclusion": "Focus on 3 critical items; remainder is routine"
  },
  "next_steps": "Process critical items in priority order"
}
```

**Design principles:**
1. Do the hard work in the platform — scoring, filtering, ranking
2. Provide clear next actions — never leave the agent guessing
3. Include confidence indicators — helps agents know when to escalate
4. Include reasoning traces — give agents the premises behind recommendations
5. Structure for scannability — key information immediately visible
6. Design for failure — always include fallback recommendations

**Threshold-based intelligence:**
```javascript
if (total_records > 100) {
  // Return summary + critical subset
  output = { summary_mode: true, critical_subset: topResults };
} else {
  // Return full detail
  output = { summary_mode: false, detailed_records: records };
}
```

---

## L — Learning & Evaluation

### Purpose
Give the agent examples that teach reasoning patterns, build in self-correction
mechanisms, and establish how prompt quality will be measured.

### Example Design

Examples should expose the agent's reasoning process, not just show input→output.
The agent learns decision-making patterns from seeing HOW to think, not just WHAT to do.

**Weak example (shows only actions):**
```
User: "My laptop won't connect to WiFi"
Agent: Searched KB → Found article → Sent to user
```

**Strong example (shows reasoning):**
```
EXAMPLE — Ambiguous symptom requiring investigation:
Situation: User reports "my laptop won't connect to WiFi"
Agent Reasoning: This could be device-specific (driver, hardware, profile), network-specific
  (AP down, DHCP exhausted, auth issue), or account-specific (certificate expired, group
  policy). I'll start with scope — is it just this user or are others affected?
Actions: Checked network monitoring dashboard for the user's building → No widespread outage.
  Searched recent incidents for WiFi issues in same location → Found 0 similar reports.
  This narrows to device or account-specific. Asked user: "Can you connect to other
  networks, like a mobile hotspot?" → User confirms yes.
  Checked AD for user's device certificate → Certificate expired yesterday.
Outcome: Renewed device certificate via remote management tool. User confirmed connectivity
  restored. Created incident record documenting root cause for future pattern detection.
Why this is correct: Systematic narrowing from broad to specific, used tools to eliminate
  hypotheses rather than guessing, confirmed resolution with the user.
```

### Reflection Patterns

Build self-correction into the prompt:

```
REFLECTION PROTOCOL:
After completing a task, before delivering the response:
1. Re-read the success criteria. Does your output meet each one?
2. Check for assumptions. Did you state anything without tool verification?
3. Consider alternatives. Is there a better interpretation of the user's request?
4. Assess completeness. Would the user need to ask a follow-up, or is this self-contained?
```

### Internal vs External Output Separation

Agent reasoning and user-facing output serve different purposes. Keep them separated:

**Internal (work notes, Thought cycle):**
- Tool selection rationale ("I'm checking KB first because...")
- Confidence assessments ("KB score 0.87 suggests strong match")
- Evidence traces and reasoning certificates
- Alternative approaches considered
- Classification reasoning

**User-facing (displayed output):**
- The outcome ("I've identified this as a known Outlook issue")
- Recommended action ("Let me walk you through the fix")
- Brief plain-language explanation (1-2 sentences)
- Status updates ("I'm investigating this now")

**Anti-pattern — Reasoning leakage:**
```
❌ "Based on my analysis of 4 similar incidents with 0.87 KB relevance
score and CMDB CI showing no recent changes, I've determined this is
a Software category issue with 92% confidence..."

✅ "I've identified this as a known Outlook issue with a documented fix.
Let me walk you through the resolution."
```

The agent should think like an expert but communicate like a concierge.

### Evaluation Scenarios

Provide 3-5 test scenarios with the delivered prompt. These serve double duty:
validation for the current prompt, and the foundation for eval-driven iteration.

Each scenario should specify:
- Input/trigger
- Expected agent behavior (not exact output — expected reasoning approach)
- What would constitute failure
- Which SIGNAL section is primarily being tested

**Example test scenario structure:**
```
TEST: Edge case — user provides wrong incident number
Input: "Can you check on INC9999999?"
Expected: Agent searches, finds no result, asks user to verify the number rather
  than fabricating information or immediately escalating.
Failure: Agent makes up incident details or gives up without attempting alternatives.
Tests: G (anti-hallucination), N (persistence norm), A (tool error handling)
```

---

## Evidence Gates (Cross-Cutting)

### Purpose
Force the agent to construct explicit reasoning certificates before making high-stakes
determinations. Based on semi-formal reasoning research showing accuracy improvement
from 78% to 93% by requiring agents to construct logical certificates.

### When to Use Evidence Gates

**Use for:**
- Classification decisions (incident category, priority assignment)
- Escalation determinations (when to stop and hand off)
- Approval/rejection decisions
- Any step where the wrong conclusion has downstream consequences

**Skip for:**
- Simple data retrieval confirmations
- Binary outcomes (record found or not)
- Steps with no judgment involved

### The Three Components

**1. Premises** — Explicit statements of fact the agent has gathered. Each must reference
a verifiable source: tool output, record field, user statement, or platform value.

```
Premises Gathered:
• Incident INC0012345 has priority = P1 (from incident record)
• Assignment group 'Network Ops' has 3 open P1s (from workload query)
• Caller reported 'complete outage' (from user input)
```

**2. Execution Trace** — Step-by-step logical path connecting premises to a determination.
Must trace each branch evaluated, including branches NOT taken and why.

```
Execution Trace:
• P1 + 'complete outage' → Major Incident criteria met
• Network Ops has 3 open P1s → workload exceeds threshold (>2)
• Evaluated: reassign to backup group? NO — no backup group configured
• Determined path: escalate to Major Incident Management
```

**3. Formal Conclusion** — Determination derived solely from documented premises and trace.
No new information may appear that wasn't established in premises.

```
Formal Conclusion:
• Based on P1 priority, complete outage, and workload threshold exceeded,
  this meets Major Incident criteria
• Action: Escalate to Major Incident Management
• Unverified premises: None
```

### Critical: Evidence Gates Are Internal

Evidence certificates are INTERNAL Thought-cycle operations. They must NEVER be surfaced to the user.
Always follow an evidence gate with a separate user-facing step defining exactly what output
the user sees.

### Platform Compatibility

ServiceNow's ReAct engine constrains the Thought field to ~4-5 sentences and may collapse
non-tool-invoking steps. To prevent this:

1. **Anchor to an action:** Instead of pure reasoning, phrase as "Analyze the classification
   decision by organizing premises, trace, and conclusion internally." This triggers built-in
   analytical tools.

2. **Keep focused:** Full Premises → Trace → Conclusion certificates may exceed the Thought
   budget. Focus on critical decision points, not exhaustive documentation.

3. **Separate from user output:** Evidence gates produce internal reasoning. Always follow
   with a distinct step that defines user-facing output.

### Anti-Patterns

- **Reasoning leakage:** Agent surfaces evidence certificate to the user instead of keeping
  it in the Thought cycle
- **Ungrounded assertions:** Agent claims "this is a hardware issue" without citing which
  premise led to that conclusion
- **Phantom premises:** Conclusion references data never retrieved or stated in premises
- **Circular reasoning:** Conclusion restates a premise as evidence for itself

### SIGNAL Integration

In SIGNAL, evidence gates are framed as a heuristic rather than a structural requirement:

"Before committing to a high-stakes classification, construct an internal reasoning
certificate. Cite your premises (what data points led you here), trace your logic
(why this path and not others), and state your conclusion with explicit linkage to
the evidence. This is internal reasoning — present only the outcome to the user."

This preserves SIGNAL's flexibility while adding reasoning rigor where it matters most.

---

## V3 Parallel Execution (Cross-Cutting)

### Purpose
Optimize agent instructions for ServiceNow's ReAct V3 engine, which supports parallel
tool execution. Proper parallelism reduces round-trips and improves response time.

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

**Gating Anchors (create sync points between parallel groups):**
- "once all parallel operations complete"
- "using the combined results from the previous step"

### Prompt Patterns

**Pattern 1: Parallel Data Collection**
```
Retrieve ALL of the following simultaneously — these operations
are independent and share no dependencies:
• Fetch the caller's incident history for the last 90 days
• Fetch the caller's asset assignments from CMDB
• Fetch the caller's open change requests
• Fetch the caller's service entitlements
```

**Pattern 2: Gate → Fan-Out**
```
### Retrieve the incident record
[single tool call to get incident]

### Using the incident, perform parallel analysis
Using the incident record, perform ALL of the following
independently — each reads from the incident but writes
to different targets:
• Analyze assignment group workload
• Retrieve matching knowledge articles
• Check for duplicate incidents in the last 30 days
```

**Pattern 3: Parallel Collect → Synthesize → Parallel Distribute**
```
### Gather (parallel)
Retrieve ALL simultaneously: KB articles, device health, interaction history

### Synthesize (sequential)
Using all gathered data, compile prioritized resolution plan

### Distribute (parallel, if applicable)
Execute ALL applicable resolution actions simultaneously
```

**Pattern 4: Avoiding Accidental Serialization**

❌ Forces serial (separate steps writing same record):
```
### Update incident priority
### Update incident assignment group
```

✅ Acknowledges serialization:
```
### Update incident record
Apply the following updates sequentially — these write to
the same record:
1. Update priority to P2
2. Update assignment group to Network Operations
```

### SIGNAL Integration

In SIGNAL's heuristic style, parallel execution guidance fits naturally in the Expert
Approach section:

"When investigating, gather independent data sources simultaneously — KB articles,
CMDB records, and similar incidents can all be fetched at once since they have no
shared dependencies. Save sequential execution for when one step's output feeds the
next, or when multiple updates target the same record."

### Anti-Patterns

- **Implicit dependencies:** If Step 4 uses Step 3's output, state the dependency
  explicitly or V3 may batch them incorrectly
- **Overloading batches:** V3 caps at 4 per batch — group into clusters of ≤4
- **Mixing user interaction with tool calls:** FALLBACK actions always run alone;
  combining a fetch with a user prompt wastes a cycle
