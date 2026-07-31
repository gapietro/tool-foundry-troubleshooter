# Tool Description Examples (CRISP)

Before/after comparisons showing how to transform weak tool descriptions into
CRISP-quality descriptions with explicit error handling and disambiguation.

---

## Example 1: Knowledge Base Search

### Before (Typical)
```
name: search_kb
description: Search knowledge base articles
parameters:
  query: string
```

### After (CRISP)
```
name: search_kb
description: Search ServiceNow Knowledge Base for articles matching a natural
  language query. Returns article number, title, short description, body excerpt,
  and relevance score. Results are filtered by the requesting user's KB entitlements.
Use when: The user describes a problem that likely has documented solutions —
  common errors, how-to questions, configuration guidance, known issues. Always
  check KB BEFORE attempting manual troubleshooting.
Do NOT use when: Searching incident, change, or problem records (use search_table).
  For real-time system status (use monitoring_check). For policies or procedures
  not in KB format (use document_search).
Parameters:
  - query: Natural language description of the issue. Be specific — "Outlook
    crashes when opening attachments over 25MB" outperforms "Outlook crash".
  - category: Optional filter (e.g., "Network", "Email", "Hardware"). Omit to
    search all categories.
  - limit: Max results (default 5, max 20).
Returns: Array of {number, title, short_description, body_excerpt, score, url}.
  Scores above 0.8 = strong match. 0.5-0.8 = review excerpt before recommending.
  Below 0.5 = mention article exists but flag low confidence.
If this tool fails: Inform user "I'm temporarily unable to search the knowledge
  base. Can you describe your issue in more detail so I can help another way?"
  Try broadening search terms. If zero results, try synonyms before concluding
  no documentation exists.
```

**Why this matters:** The "before" version requires the instruction to tell the agent
when to search. The "after" version lets the agent decide autonomously — it knows
WHEN, WHY, HOW, and WHAT TO DO WHEN IT FAILS.

---

## Example 2: Incident Management

### Before
```
name: create_incident
description: Create a new incident
parameters:
  short_description: string
  description: string
  category: string
  priority: number
```

### After
```
name: manage_incident
description: Full incident lifecycle management — create, update, resolve, comment,
  or escalate incidents through a single tool. Handles field validation, state
  transitions, and assignment rule triggers automatically.
Use when: Any time you need to create a new incident, modify an existing one,
  add diagnostic notes, resolve with root cause, or escalate priority/assignment.
Do NOT use when: Reading incident details without modification (use get_record).
  For bulk operations on multiple incidents (recommend human action). For searching
  incidents by criteria (use search_table with table="incident").
Parameters:
  - action: create | update | resolve | add_work_note | escalate
    → create: Opens new incident. Requires short_description.
    → update: Modifies fields. Requires incident_number.
    → resolve: Closes incident. Requires incident_number, close_code, close_notes.
    → add_work_note: Adds internal note. Requires incident_number, work_notes.
    → escalate: Increases priority and/or reassigns. Requires incident_number.
  - incident_number: Required for all actions except create (e.g., "INC0012345")
  - fields: Object of field:value pairs. Key fields: short_description, category,
    subcategory, priority (1-4), impact (1-3), urgency (1-3), assignment_group
  - close_code: Required for resolve. Values: "Solved (Permanently)",
    "Solved (Workaround)", "Not Solved (Not Reproducible)"
  - close_notes: Required for resolve. Describe what fixed the issue.
Returns: {incident_number, state, sys_id, assignment_group, priority}
If this tool fails:
  → "ACL restriction": You lack permission. Inform user, suggest contacting
    assignment group directly.
  → "Invalid state transition": Check current state, use appropriate next action.
  → "Required field missing": Error lists which field. Ask user for it.
  → Any other error: Respond "I'm unable to update the incident right now.
    Please try again or contact the service desk at ext. 4357."
```

**What changed:** Five separate tools collapsed into one with clear action routing.
Error responses are per-error-type with explicit recovery guidance. The agent handles
the full lifecycle without being told "use create_incident in step 1."

---

## Example 3: User Lookup

### Before
```
name: get_user
description: Get user information
parameters:
  user_id: string
```

### After
```
name: lookup_user
description: Retrieve user profile from sys_user table. Returns display name,
  email, department, location, manager, VIP status, and role memberships.
  Resolves both user_name (jsmith) and sys_id formats.
Use when: Need to identify a user, check entitlements, find manager for approvals,
  determine location for on-site routing, or verify VIP status for priority handling.
Do NOT use when: Checking a user's recent incidents or requests (use search_table
  filtered by caller_id). For modifying user records (escalate to Identity
  Management team).
Parameters:
  - identifier: User name (e.g., "jsmith"), email (e.g., "jsmith@company.com"),
    display name (e.g., "John Smith"), or sys_id. Auto-detects format. Display
    name uses exact match first, then fuzzy.
  - fields: Optional comma-separated list. Defaults to: user_name, name, email,
    department, location, manager, vip, active, roles
Returns: User object with requested fields. Manager returns {name, user_name,
  email}. Roles returns array of role names.
If this tool fails:
  → No user found: Ask "I couldn't find a user matching that. Could you provide
    their email address or username?" Do NOT assume the user doesn't exist —
    check spelling first.
  → Multiple matches on display name: Present all matches, ask user to clarify.
  → Tool error: "I'm temporarily unable to look up user information. Can you
    provide the details I need directly?"
Caveats: Inactive users returned but flagged active=false. VIP status affects
  SLA calculations — always check for priority decisions. Manager field may be
  empty for contractors.
```

---

## Example 4: CMDB Configuration Item Lookup

### Before
```
name: get_ci
description: Get a configuration item
parameters:
  ci_name: string
```

### After
```
name: lookup_ci
description: Retrieve configuration item details from the CMDB including
  relationships, support group, operational status, and change history summary.
  Searches by CI name, sys_id, or asset tag.
Use when: Need to understand what's affected by an incident (impact analysis),
  find the support group for a CI, check operational status, or map dependencies
  before a change. Essential for incident triage — always check CI before routing.
Do NOT use when: Searching for multiple CIs by criteria (use search_table with
  table="cmdb_ci"). For modifying CI records (use update_ci or escalate to
  CMDB team). For checking real-time monitoring (use monitoring_check).
Parameters:
  - identifier: CI name (e.g., "PROD-DB-01"), sys_id, or asset tag. Searches
    name field first, falls back to asset_tag. Case-insensitive.
  - include_relationships: Boolean (default true). Returns upstream/downstream
    dependencies. Set false for simple lookups where relationships aren't needed.
  - include_recent_changes: Boolean (default true). Returns last 5 changes
    affecting this CI. Critical for incident investigation.
Returns: {name, class, operational_status, support_group, location, relationships[],
  recent_changes[], attributes{}}. Relationships include type (Runs on, Depends on,
  Used by) and target CI name.
If this tool fails:
  → No CI found: "I couldn't find that configuration item. Can you verify the
    exact name or provide the asset tag?" Try partial name search via search_table
    before giving up.
  → Permission denied: "I don't have access to view this CI's details. This may
    be in a restricted CMDB class. Please check with the CMDB team."
  → Tool error: Continue triage without CI data, note in work notes that CMDB
    lookup failed, recommend manual verification.
Caveats: Retired CIs are returned but flagged. Relationships can be extensive for
  core infrastructure — review only direct (depth=1) relationships unless
  investigating cascading failures.
```

---

## CRISP Tool Description Principles

1. **Explicit error handling per tool** — every tool gets "If this tool fails" with
   specific recovery per error type
2. **When to use AND when NOT to use** — prevents mis-selection between similar tools
3. **Parameter descriptions include format AND examples** — not just types
4. **Return value descriptions** tell the agent what to expect and how to interpret
5. **Tool consolidation** — fewer, more capable tools are easier to select correctly
6. **Disambiguation** — if two tools could apply, the descriptions must make the
   distinction unambiguous

### CRISP vs SIGNAL Tool Descriptions

| Aspect | SIGNAL | CRISP |
|--------|--------|-------|
| Error handling | Caveats section with general guidance | Per-error-type recovery with exact messages |
| Decision guidance | "Use judgment based on context" | "If condition A → use this tool. If condition B → use that tool" |
| Recovery paths | "Try alternatives before giving up" | "If fails: Step 1 try X, Step 2 try Y, Step 3 escalate" |
| Tone | Heuristic — "consider these factors" | Prescriptive — "follow these branches" |

Both approaches produce effective tool descriptions. CRISP is more explicit about error
paths; SIGNAL gives more latitude for creative recovery.

---

## Smart Tool Output Examples

### Before: Raw Data Dump

```json
// Output from search_incidents
{
  "records": [
    {"number": "INC0012340", "short_description": "Outlook crash", "state": "6", "priority": "3"},
    {"number": "INC0012289", "short_description": "Outlook freezes on attachments", "state": "6", "priority": "3"},
    {"number": "INC0012201", "short_description": "Email client crash", "state": "6", "priority": "4"},
    {"number": "INC0012198", "short_description": "Outlook crash opening PDF", "state": "6", "priority": "3"}
  ],
  "count": 4
}
```

Problem: Agent must analyze 4 records, determine pattern, assess confidence — consuming
tokens and introducing reasoning errors.

### After: Decision-Ready Output

```json
// Output from search_incidents (smart version)
{
  "analysis_complete": true,
  "match_count": 4,
  "pattern_detected": true,
  "pattern_summary": "4 Outlook crash incidents in 30 days, 3 resolved via KB0045123",
  "recommended_action": "APPLY_KB_RESOLUTION",
  "confidence_score": 0.89,
  "key_findings": {
    "common_resolution": "KB0045123 — Clear Outlook temp folder",
    "resolution_success_rate": "3/4 (75%)",
    "outlier": "INC0012201 resolved differently (full reinstall)"
  },
  "reasoning_trace": {
    "premises": ["4 incidents matched symptoms", "3 of 4 share same resolution"],
    "logic": "75% resolution consistency exceeds confidence threshold",
    "conclusion": "KB0045123 is the recommended resolution path"
  },
  "next_steps": "Present KB0045123 resolution to user. If unsuccessful, escalate for reinstall."
}
```

Benefit: Agent receives a recommendation it can act on immediately — or challenge if
the evidence seems weak.

### Threshold-Based Output

```json
// When record count exceeds threshold
{
  "summary_mode": true,
  "total_scanned": 312,
  "critical_subset": [
    {"number": "INC0099001", "severity_score": 0.95, "reason": "P1 with SLA breach imminent"},
    {"number": "INC0099042", "severity_score": 0.91, "reason": "VIP caller, unresolved 48h"}
  ],
  "safe_to_defer": 310,
  "recommendation": "Address 2 critical items first. Remaining 310 are within SLA."
}
```

### Error Response with Recovery Guidance

```json
// Smart error — guides agent recovery
{
  "error": true,
  "error_type": "NOT_FOUND",
  "message": "No incident found with number INC0012345",
  "recovery_suggestions": [
    "Verify incident number with user — check for typos",
    "Try searching by short description instead",
    "Check if incident was merged into a parent"
  ],
  "fallback_action": "ASK_USER_TO_VERIFY"
}
```

Compare with a dumb error: `{"error": "404 Not Found"}` — the agent has no guidance
on what to try next.
