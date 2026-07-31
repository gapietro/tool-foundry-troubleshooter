# Example: CRISP IT Incident Triage Workflow

> Complete worked example of the CRISP-ServiceNow methodology applied to an
> IT Incident Triage use case. Orchestrator + 2 Children (Pattern B), Tier 2 CoPilot.
> Use this as a reference when building similar multi-agent workflows.

---

## Use Case

**Name:** CRISP IT Incident Triage

**Description:**

Triage incoming IT incidents reported via chat, diagnose root cause using knowledge base and CMDB data, and either resolve the incident directly or route to the correct assignment group — with security escalation safeguards and VIP priority handling.

Workflow pattern: Orchestrator + 2 children
Trigger: Chat (user reports an issue in Agent Workspace)
Autonomy: Tier 2 — CoPilot

Agents:
- CRISP Triage Orchestrator: Reads the incident, determines whether diagnosis, resolution, or both are needed, and routes to the appropriate child agent. Max 4 dispatches per request.
- CRISP Diagnosis Agent: Investigates root cause using KB search, CMDB lookup, and similar incident search. Returns structured DIAGNOSIS REPORT with confidence level.
- CRISP Resolution & Routing Agent: Takes diagnosis output and resolves the incident, routes to the correct assignment group, or escalates.

Success criteria:
- Incident is triaged with correct category, priority, and assignment group
- Root cause diagnosis is supported by tool-verified evidence (KB, CMDB, or similar incidents)
- Security incidents are escalated immediately without attempted resolution
- VIP users receive priority handling
- All actions are documented in work notes

---

## Agent: CRISP Triage Orchestrator

**Strategy:** CoPilot
**Execution mode:** copilot
**Word count:** 498

**Key CRISP elements demonstrated:**
- **C**: Explicit CAN/CANNOT list for orchestrator scope
- **R**: 5 hard rules including loop detection and anti-fabrication
- **I**: Single-sentence GOAL with explicit done-when condition
- **S**: 4 steps with exhaustive branches including security bypass at Step 1
- **P**: Security incident bypass as built-in pattern

**Instructions:**

```
CRITICAL: Never attempt to diagnose or resolve incidents directly — always delegate to specialist child agents. Never dispatch the same task to the same agent twice.

## Context & Capability
You are the orchestrator for CRISP IT Incident Triage. You coordinate two specialist agents to triage, diagnose, and resolve or route IT incidents reported via chat in Agent Workspace.

You CAN: dispatch to child agents, aggregate results, make routing decisions, communicate with the IT support user.
You CANNOT: execute diagnosis or resolution tasks directly — always delegate to specialists.

## Rules (Never Violate)
1. Never dispatch the same task to the same agent twice — adjust context or escalate
2. Always include incident context and expected output format in every dispatch
3. If security indicators detected — skip all child agents, escalate to Security Incident Response immediately
4. Max 4 dispatches per request
5. Never fabricate incident numbers, statuses, or resolution details

## Intent & Goal
GOAL: Ensure every reported incident is triaged with a verified diagnosis and either resolved or routed to the correct team.
Done when: Incident has diagnosis in work notes AND is resolved or assigned, OR security escalation initiated.

## Steps & Decision Logic

STEP 1: Read the user's reported issue
  → If security indicators (unauthorized access, data breach, credential compromise): escalate immediately — do NOT dispatch
  → If clear and actionable: proceed to Step 2
  → If vague: ask ONE clarifying question
  → If uncertain whether security: ask user to confirm

STEP 2: Determine workflow path
  → If likely known cause: dispatch to CRISP Diagnosis Agent
  → If straightforward routing: dispatch directly to CRISP Resolution & Routing Agent
  → If needs both: dispatch Diagnosis first, pass results to Resolution
  → If uncertain: dispatch Diagnosis first

STEP 3: Monitor child execution
  → Success: collect, proceed
  → Transient error: retry once
  → Data error: report to user
  → Logic error: adjust and retry
  → Same error twice: escalate to human

STEP 4: Aggregate and deliver
  → Compile diagnosis, action, state, next steps
  → Ensure consistent terminology

CRITICAL: Never attempt to diagnose or resolve incidents directly — always delegate.
```

**V3 Parallel Execution Notes:**

The orchestrator dispatches sequentially (each child depends on prior output). Within child agents:
- **Diagnosis Agent** uses parallel data collection: search_kb, lookup_ci, and search_incidents are independent reads → batched simultaneously
- **Resolution Agent** serializes record updates: priority, assignment group, and state changes write to the same incident → sequential execution

---

## Agent: CRISP Diagnosis Agent

**Strategy:** CoPilot
**Execution mode:** copilot
**Word count:** 1,247
**Tools:** search_kb (autonomous), lookup_ci (autonomous), search_incidents (autonomous)

**Key CRISP elements demonstrated:**
- **C**: Explicit CAN/CANNOT lists, knowledge boundaries (knows ITIL, must look up current data)
- **R**: 6 hard rules including 3 anti-hallucination statements, security bypass rule
- **I**: SUCCESS with confidence percentages, FAILURE conditions, effort budget
- **S**: 5 steps with branches, validation checkpoints, error handling, termination conditions
- **P**: 3 examples showing exact decision path taken at each step with rationale

**Structured Output Format:**
```
DIAGNOSIS REPORT
- Category: [network/software/hardware/database/security/unknown]
- Confidence: [High/Medium/Low] ([percentage]%)
- Root cause: [description with evidence source]
- Evidence:
  - KB: [article numbers and relevance, or "None found"]
  - CMDB: [CI name, status, recent changes, or "Not applicable"]
  - Similar incidents: [numbers and resolutions, or "None found"]
- Affected CI: [name and relationships, or "Not identified"]
- VIP: [Yes/No]
- Recommended action: [resolve / route / escalate / investigate further]
- Security flag: [None / IMMEDIATE ESCALATION REQUIRED]
```

**Evidence Gate Example (Diagnosis Agent — STEP 5a):**

After the Diagnosis Agent's classification step, an evidence gate validates reasoning:

```
STEP 5a: Classification Evidence Gate (INTERNAL — DO NOT DISPLAY TO USER)
  Premises:
  • KB search returned KB0045123 "Outlook attachment crash" score 0.87 (from search_kb)
  • CMDB shows Outlook 16.78, no recent CI changes (from lookup_ci)
  • 4 similar incidents in 30 days, 3 resolved via KB0045123 (from search_incidents)

  Trace:
  • Category = Software? MET — symptoms are application-level, KB match is software fix
  • Category = Hardware? NOT MET — no CI changes, multiple users same Outlook version
  • Category = Network? NOT MET — symptoms are app-level crashes, not connectivity
  • Confidence >80%? MET — KB 0.87 + 3/4 similar incidents confirm pattern

  Conclusion:
  • Category: Software. Confidence: High (92%). Root cause: corrupted Outlook temp folder.
  • Unverified: whether user's Outlook build includes preventive patch

STEP 5b: Present Diagnosis to Orchestrator
  Return DIAGNOSIS REPORT with:
  • Category: Software
  • Confidence: High (92%)
  • Root cause: Corrupted Outlook temp folder (KB0045123)
  • Recommended action: Resolve via KB0045123 procedure
  DO NOT include premises, trace, or evidence certificates
```

**V3 Parallel Data Collection (Diagnosis Agent — STEP 2):**

```
STEP 2: Gather diagnostic data
  Retrieve ALL of the following simultaneously — these operations
  are independent and share no dependencies:
  • Search KB for articles matching "Outlook crash attachments"
  • Look up user's device CI and recent changes
  • Search incidents for similar symptoms in last 30 days
  → If any fails: note which source unavailable, proceed with remaining
  → If all fail: return Low confidence diagnosis, recommend manual investigation
  Validate: At least 2 of 3 sources returned data
```

---

## Agent: CRISP Resolution & Routing Agent

**Strategy:** CoPilot
**Execution mode:** copilot
**Word count:** 1,412
**Tools:** manage_incident (supervised), lookup_user (autonomous), add_work_notes (supervised)

**Key CRISP elements demonstrated:**
- **R**: 7 hard rules with explicit per-error-type recovery for manage_incident
- **S**: 4 steps with per-error branches (ACL restriction, invalid state transition, required field missing)
- **P**: Example 2 shows VIP detection + priority recalculation with documented justification

**Structured Output Format:**
```
PROPOSED ACTION: [Resolve / Route / Escalate]
- Incident: [number]
- Diagnosis: [summary]
- Action: [what will be done]
- Assignment group: [group name, if routing]
- Priority: [current → proposed, with justification]
- VIP: [Yes/No]
Shall I proceed?
```

---

## Tool Descriptions (CRISP Quality)

### search_kb
```
Search ServiceNow Knowledge Base for articles matching a natural language query. Returns
article number, title, short description, body excerpt, and relevance score. Use when
investigating symptoms or error messages. Always search BEFORE concluding an issue is novel.
Do NOT use for incident records or CMDB lookups. Scores >0.8 = strong match; 0.5-0.8 =
review excerpt; <0.5 = low confidence. If tool fails: inform orchestrator KB unavailable,
proceed with remaining tools, recommend manual KB verification after diagnosis.
```

### lookup_ci
```
Retrieve CI details from CMDB including relationships, support group, operational status,
and last 5 changes. Use when a specific system, server, or application is mentioned in the
incident. Do NOT use for user lookups or incident searches. If CI not found: ask for exact
name or asset tag before concluding it doesn't exist. If tool fails: note CMDB unavailable,
proceed with KB and incident search, flag gap in diagnosis output.
```

### search_incidents
```
Search incident table for matching records. Returns number, description, state, priority,
assignment group, close code, and close notes. Use for similar past incident pattern
analysis. Do NOT use for KB or CMDB searches. If multiple incidents with same resolution:
high-confidence pattern. If resolutions vary: medium confidence, present options. If tool
fails: note incident search unavailable, proceed with available data.
```

---

## Decision Logic Comparison (vs SIGNAL)

| Decision Point | SIGNAL Approach | CRISP Approach |
|---------------|----------------|---------------|
| When to dispatch Diagnosis vs Resolution | "Assess whether it needs investigation, immediate action, or both" | "If likely known cause → Diagnosis. If straightforward routing → Resolution. If both → Diagnosis first. If uncertain → Diagnosis" |
| Confidence threshold | "High confidence with known fix → resolve. Medium → route with notes" | "High (>80%) → Step 2 resolve. Medium (50-80%) → Step 3 route. Low (<50%) → Step 4 escalate" |
| Security handling | Guardrail: "Security indicators → escalate immediately" | STEP 1 explicit branch: "If security indicators → STOP, escalate, do not proceed" |
| Tool failure | "Try alternatives before giving up" | Per-step: "If tool fails → [specific fallback with exact message]" |

---

## Test Scenarios

1. **Happy path — KB match**: "Outlook keeps crashing when I open attachments"
   - Expected: STEP 2 search_kb score >0.8 → STEP 5 High confidence → Resolution resolves with KB reference
   - Tests: C (capability boundaries), R (anti-hallucination), S (Steps 2 and 5)

2. **No KB match, CMDB reveals change**: "Multiple users in Building 3 can't access SAP since this morning"
   - Expected: STEP 2 low KB score → STEP 3 lookup_ci finds recent change → STEP 5 Medium confidence → Route to Network Ops
   - Tests: S (all 5 steps executed), I (confidence threshold applied correctly)

3. **Security escalation**: "Someone logged into my account from another country at 3 AM"
   - Expected: STEP 1 security indicator detected → immediate "SECURITY" return, no further steps
   - Tests: R (Rule 3), S (STEP 1 security branch), P (Example 3)

4. **VIP priority mismatch**: Same as scenario 2 but VIP caller, P4 incident
   - Expected: Resolution STEP 3 lookup_user returns VIP → priority recalculated P4→P1 with justification → work notes document Rule 1 compliance
   - Tests: R (Rule 1 priority justification), S (STEP 3 VIP branch)

5. **Tool failure degradation**: search_kb unavailable
   - Expected: STEP 2 tool fails → log failure, note KB unavailable, proceed to STEP 3 CMDB + STEP 4 incidents
   - Tests: S (error handling on each step), R (Rule 6 fallback message)

6. **Evidence gate reasoning**: Agent classifies incident and must document branch evaluation
   - Expected: STEP 5a evidence gate traces all premises with sources, evaluates each category branch (met/not met), concludes with cited evidence
   - Failure: Agent asserts category without evidence gate, or surfaces evidence certificate to user
   - Tests: Evidence Gates (branch accountability, internal-only enforcement)

---

## Autonomy Graduation Path
- Current: Tier 2 (CoPilot — reads auto, writes supervised)
- Tier 3 after: 30 days with <5% escalation rate, zero security misses, zero priority modifications without justification
- Tier 4 after: Narrow, well-tested incident categories only (e.g., password resets, known Outlook issues)
