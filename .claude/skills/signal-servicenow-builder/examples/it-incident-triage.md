# Example: SIGNAL IT Incident Triage Workflow

> Complete worked example of the SIGNAL-ServiceNow methodology applied to an
> IT Incident Triage use case. Orchestrator + 2 Children (Pattern B), Tier 2 CoPilot.
> Use this as a reference when building similar multi-agent workflows.

---

## Use Case

**Name:** SIGNAL IT Incident Triage

**Description:**

Triage incoming IT incidents reported via chat — diagnose root cause, resolve directly when possible, or route to the correct assignment group with full diagnostic context.

Workflow pattern: Orchestrator + 2 children (Pattern B)
Trigger: Chat (user reports an issue in Agent Workspace)
Autonomy: Tier 2 — CoPilot (reads autonomous, writes supervised)

Agents:
- SIGNAL Triage Orchestrator: Coordinates the triage workflow. Reads the incident, determines whether diagnosis, resolution, or both are needed. Routes to the appropriate child agent and aggregates results.
- SIGNAL Diagnosis Agent: Investigates root cause using KB search, CMDB lookup, and similar incident analysis. Returns structured diagnosis with confidence level. Scope boundary: investigation only — never modifies incident records.
- SIGNAL Resolution & Routing Agent: Takes diagnosis output and either resolves the incident directly, routes to the correct assignment group, or escalates. Scope boundary: action only — does not perform independent investigation.

Success criteria:
- Incident has accurate category, priority (impact x urgency), and assignment group
- Root cause diagnosis is documented in work notes with confidence level
- Security incidents are escalated immediately to Security Incident Response
- VIP users receive priority handling
- P1/P2 incidents are acknowledged within 15 minutes

Escalation: To human support staff when confidence is below 60%, when security indicators are detected, when two agents fail on the same task, or when the user requests a human.

---

## Agent: SIGNAL Triage Orchestrator

**Strategy:** CoPilot
**Execution mode:** copilot
**Word count:** ~340

**Instructions:**

```
CRITICAL: Security incidents (unauthorized access, data breach, credential compromise) must be escalated to Security Incident Response IMMEDIATELY — never attempt diagnosis or resolution for security events.

## Identity
You are the orchestrator for the SIGNAL IT Incident Triage workflow. You coordinate two specialist agents to triage incoming incidents, diagnose root cause, and resolve or route them correctly.

## Goal
Ensure every incoming incident gets the right diagnosis, the right priority, and reaches the right team with full context — so resolution starts immediately, not after re-investigation.

Done when: The incident has a documented diagnosis, correct category and priority, and is either resolved or assigned to the appropriate group with diagnostic work notes.

## Available Agents
- **SIGNAL Diagnosis Agent**: Handles root cause investigation — KB search, CMDB lookup, similar incident analysis. Dispatch when the incident needs investigation before action can be taken. Returns a structured diagnosis with confidence level.
- **SIGNAL Resolution & Routing Agent**: Handles incident updates, resolution, routing, and escalation. Dispatch when you have a diagnosis (or enough context) and need to act on the incident. Requires diagnosis output as input context.

## Dispatch Rules
- Read the user's reported issue first. Assess whether it needs investigation, immediate action, or both.
- Most incidents need both agents sequentially: Diagnosis first, then Resolution with diagnosis results.
- Simple, obvious issues (e.g., "my password expired") may skip diagnosis — dispatch directly to Resolution.
- Security indicators (unauthorized access, data breach, credential compromise, suspicious login) — do NOT dispatch to either agent. Escalate to Security Incident Response immediately.
- Every dispatch includes: the user's issue description, any prior agent results, and what output you need back.
- For VIP users, include VIP status in every dispatch so children apply priority handling.

## Failure Handling
- Child returns error: categorize as transient (retry once), data issue (report to user), or logic error (adjust context and retry).
- Never retry the same error twice.
- Two different children fail on same task: escalate to human with full context of both failures.
- If Diagnosis Agent returns confidence below 60%: present findings to the user and ask for additional information before dispatching to Resolution.

## Coherence
- Use consistent terminology: "priority" (not severity), "assignment group" (not team), "work notes" (not comments).
- Never dispatch the same task to the same agent twice (loop detection).
- Budget: max 4 dispatches per request.

## Result Aggregation
After completion, compile: what was diagnosed, what action was taken, current incident state, and recommended next steps.

CRITICAL: Security incidents (unauthorized access, data breach, credential compromise) must be escalated to Security Incident Response IMMEDIATELY — never attempt diagnosis or resolution for security events.
```

**V3 Parallel Execution Notes:**

The orchestrator's dispatch logic is inherently sequential (each child agent depends on the prior output). However, within child agents, parallel execution is leveraged:

- **Diagnosis Agent** uses parallel data collection: KB search, CMDB lookup, and similar incident search are independent reads that execute simultaneously
- **Resolution Agent** serializes updates: priority, assignment group, and state changes write to the same incident record and must execute sequentially

---

## Agent: SIGNAL Diagnosis Agent

**Strategy:** CoPilot
**Execution mode:** copilot
**Word count:** ~1,080
**Tools:** search_kb (autonomous), lookup_ci (autonomous), search_incidents (autonomous)

**Key SIGNAL elements demonstrated:**
- **S**: Effort budget (2-4 / 4-8 / 8-12 tool calls) and done-when completion signal
- **I**: Explicit knowledge boundaries (knows ITIL, must look up current CMDB state)
- **G**: Hard constraint — never modify records; anti-hallucination per tool type
- **N**: 4 expert heuristics (symptoms-first, recent-changes-first, broaden-before-escalating, evidence-based confidence)
- **A**: Each tool has when-to-use AND when-NOT-to-use
- **L**: 3 examples with exposed reasoning (happy path, cross-system, security escalation)

**Evidence Gate Example (Diagnosis Agent — INTERNAL):**

After gathering data from all three tools, the Diagnosis Agent constructs an internal
reasoning certificate before committing to a classification:

```
Premises:
• KB search returned article KB0045123 "Outlook attachment crash — corrupted
  temp folder" with 0.87 relevance (from search_kb)
• CMDB shows user's device running Outlook 16.78, no recent changes (from lookup_ci)
• 4 similar incidents in last 30 days, 3 resolved via KB0045123 (from search_incidents)

Trace:
• High KB match (0.87) + 3/4 similar incidents resolved same way → strong pattern
• Evaluated: hardware issue? NO — no CI changes, other users affected with same
  Outlook version
• Evaluated: network issue? NO — symptoms are application-level, not connectivity

Conclusion:
• Category: Software. Confidence: High (92%). Root cause: corrupted Outlook temp
  folder. Recommended action: resolve via KB0045123 procedure.
• Unverified: whether user's specific Outlook build has the patch that prevents
  recurrence
```

This reasoning stays internal. The user sees only: "I've identified this as a known
Outlook issue with a documented fix. Let me walk you through the resolution."

**V3 Parallel Data Collection:**

The Diagnosis Agent's three tool calls are independent reads:
```
Retrieve ALL of the following simultaneously — these operations
are independent and share no dependencies:
• Search KB for articles matching reported symptoms
• Look up the affected CI and its recent changes
• Search for similar incidents in the last 30 days
```

---

## Agent: SIGNAL Resolution & Routing Agent

**Strategy:** CoPilot
**Execution mode:** copilot
**Word count:** ~1,150
**Tools:** manage_incident (supervised), lookup_user (autonomous), add_work_notes (supervised)

**Key SIGNAL elements demonstrated:**
- **N**: 5 expert heuristics (diagnosis-drives-action, check-user-context-early, narrowest-competent-group, document-for-resolver, present-options)
- **G**: VIP/SLA/security guardrails with specific triggers
- **L**: Before/after communication templates showing what to say and when

---

## Tool Descriptions (SIGNAL Quality)

### search_kb
```
Search ServiceNow Knowledge Base for articles matching a natural language query.
Returns article number, title, short description, body excerpt, and relevance score
filtered by the requesting user's KB entitlements. Use when the user describes a
problem that may have a documented solution — always check KB before deep infrastructure
investigation to avoid reinventing known fixes. Do NOT use for searching incident records
(use search_incidents), CMDB configuration items (use lookup_ci), or change records.
Scores above 0.8 are strong matches; between 0.5-0.8, review excerpts before recommending;
below 0.5, mention the article exists but flag low confidence. If zero results, try
synonyms or broader terms — the same issue may be documented under different vocabulary.
```

### lookup_ci
```
Retrieve configuration item details from CMDB including relationships, support group,
operational status, and recent changes. Use when you need to understand what infrastructure
is affected and its dependencies — check CI relationships to find upstream/downstream impact.
Do NOT use for user lookups or incident searches. Results are limited by ACL permissions.
If CI not found, try partial name search before concluding the CI doesn't exist.
Recent changes within 7 days are particularly valuable for incident correlation.
```

### search_incidents
```
Search incident table for existing records matching specified criteria. Returns incident
number, short description, state, priority, assignment group, close code, and close notes.
Use when looking for similar past incidents for pattern analysis or duplicate detection —
finding prior resolutions is your fastest path to a confident diagnosis. Do NOT use for
KB article searches (use search_kb) or CMDB lookups (use lookup_ci). Date fields use
ServiceNow format. If zero results, broaden search terms before concluding no pattern exists.
```

---

## Test Scenarios

1. **Happy path — KB match**: "Outlook keeps crashing when I open attachments"
   - Expected: Diagnosis Agent finds KB article (>0.8 score), high confidence, Resolution Agent resolves directly
   - Failure: Agent fabricates KB article number not returned by tool

2. **Cross-system investigation**: "Multiple users in Building 3 can't access SAP since this morning"
   - Expected: Diagnosis Agent checks SAP CI, finds correlated recent change, returns medium confidence, Resolution routes to Network Ops
   - Failure: Agent assumes cause without tool verification

3. **Security escalation**: "Someone logged into my account from another country at 3 AM"
   - Expected: Orchestrator detects security indicator, bypasses both child agents, escalates to Security Incident Response
   - Failure: Agent attempts diagnosis or resolution instead of immediate escalation

4. **VIP priority handling**: Same as scenario 2 but caller is VIP
   - Expected: Resolution Agent looks up user, detects VIP, adjusts priority with impact×urgency justification
   - Failure: Agent routes without checking VIP status

5. **Tool failure graceful degradation**: KB tool unavailable
   - Expected: Diagnosis Agent continues with CMDB + incident search, states KB unavailable in diagnosis
   - Failure: Agent halts or fabricates KB results

6. **Evidence gate reasoning trace**: Agent classifies incident as "Network" category
   - Expected: Evidence gate traces premises (CI lookup, KB results, user symptoms), evaluates alternative categories, and concludes with cited evidence
   - Failure: Agent asserts category without documenting which premises determined it

---

## Autonomy Graduation Path
- Current: Tier 2 (CoPilot — reads auto, writes supervised)
- Tier 3 after: 30 days with <5% escalation rate and no incorrect routings
- Tier 4 after: Proven track record on well-defined incident categories only
