# Tool Description Examples

Before/after comparisons showing how to transform weak tool descriptions into
SIGNAL-quality descriptions that enable autonomous tool selection.

---

## Example 1: Knowledge Base Search

### Before (Typical)
```
name: search_kb
description: Search knowledge base articles
parameters:
  query: string
```

### After (SIGNAL)
```
name: search_kb
description: Search ServiceNow Knowledge Base for articles matching a natural
  language query. Returns article number, title, short description, body excerpt,
  and relevance score. Results are filtered by the requesting user's KB entitlements.
when_to_use: When the user describes a problem that likely has documented solutions —
  common errors, how-to questions, configuration guidance, known issues. Always check
  KB BEFORE attempting manual troubleshooting to avoid reinventing existing solutions.
when_not_to_use: For searching incident, change, or problem records (use search_table).
  For real-time system status (use monitoring_check). For policies or procedures that
  aren't in KB format (use document_search).
parameters:
  query: Natural language description of the issue. Be specific — "Outlook crashes
    when opening attachments over 25MB" outperforms "Outlook crash". The platform
    handles tokenization and relevance ranking.
  category: Optional category filter (e.g., "Network", "Email", "Hardware").
    Omit to search all categories.
  limit: Max results (default 5, max 20). Use 3-5 for quick lookups, 10-20
    when surveying a topic comprehensively.
returns: Array of {number, title, short_description, body_excerpt, score, url}.
  Scores above 0.8 are strong matches. Between 0.5-0.8, review the excerpt before
  recommending. Below 0.5, mention the article exists but flag low confidence.
caveats: Retired articles are excluded. If zero results, try synonyms or broader
  terms — the same issue may be documented under different vocabulary. Non-English
  queries may have lower relevance scores even for translated content.
```

**Why this matters:** The "before" version forces the prompt to say "Search KB using
search_kb when the user has a question." The "after" version lets the agent decide
on its own — it knows WHEN, WHY, and HOW to search effectively.

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
  or escalate incidents through a single tool with an action parameter. Handles
  field validation, state transitions, and assignment rule triggers automatically.
when_to_use: Any time you need to create a new incident, modify an existing one,
  add diagnostic notes, resolve with a root cause, or escalate priority/assignment.
  Use the action parameter to specify the operation.
when_not_to_use: For reading incident details without modification (use get_record).
  For bulk operations on multiple incidents (recommend human action). For searching
  incidents by criteria (use search_table with table="incident").
parameters:
  action: create | update | resolve | add_work_note | escalate
    - create: Opens new incident. Requires short_description at minimum.
    - update: Modifies fields on existing incident. Requires incident_number.
    - resolve: Closes incident. Requires incident_number, close_code, close_notes.
    - add_work_note: Adds internal note. Requires incident_number, work_notes.
    - escalate: Increases priority and/or reassigns. Requires incident_number.
  incident_number: Required for all actions except create (e.g., "INC0012345")
  fields: Object of field:value pairs. Key fields:
    short_description (required for create), category, subcategory,
    priority (1-4), impact (1-3), urgency (1-3), assignment_group, assigned_to
  work_notes: Internal notes visible to IT staff only. Always include diagnostic
    context when updating or escalating.
  close_code: Required for resolve. Values: "Solved (Permanently)",
    "Solved (Workaround)", "Not Solved (Not Reproducible)", "Closed/Resolved by Caller"
  close_notes: Required for resolve. Describe what fixed the issue and any
    preventive actions taken.
returns: {incident_number, state, sys_id, assignment_group, priority}
caveats: Creating incidents triggers auto-assignment rules — only override
  assignment_group if you have specific reason. Priority is normally calculated
  from impact × urgency; set priority directly only with justification. State
  transitions are enforced (can't skip from New to Resolved without going through
  In Progress). Work notes support basic HTML formatting.
error_guidance:
  "ACL restriction": You lack permission for this incident's group. Inform user
    and suggest they contact the assignment group directly.
  "Invalid state transition": You tried to skip a required state. Check current
    state and use the appropriate next action.
  "Required field missing": The error message lists which field. Ask the user
    for the missing information rather than guessing.
```

**What changed:** Five separate tools collapsed into one with clear action routing.
Error responses guide recovery. The agent can manage the full lifecycle without
being told "use create_incident in step 1, then update_incident in step 3."

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
description: Retrieve user profile information from the sys_user table. Returns
  display name, email, department, location, manager, VIP status, and role
  memberships. Resolves both user_name (jsmith) and sys_id formats.
when_to_use: When you need to identify a user, check their entitlements, find
  their manager for approvals, determine their location for on-site support
  routing, or verify VIP status for priority handling.
when_not_to_use: For checking a user's recent incidents or requests (use
  search_table filtered by caller_id). For modifying user records (escalate
  to Identity Management team).
parameters:
  identifier: User name (e.g., "jsmith"), email (e.g., "jsmith@company.com"),
    display name (e.g., "John Smith"), or sys_id. The tool auto-detects format.
    If using display name, exact match is attempted first, then fuzzy match.
  fields: Optional comma-separated field list to return. Defaults to:
    user_name, name, email, department, location, manager, vip, active, roles
returns: User object with requested fields. manager field returns {name, user_name,
  email} for easy follow-up. roles returns array of role names.
caveats: Inactive users are returned but flagged with active=false. If multiple
  users match a display name, all matches are returned — ask the user to clarify.
  VIP status affects SLA calculations; always check this for priority decisions.
  Manager field may be empty for contractors or executives.
```

---

## Principles Demonstrated

1. **3-4 sentences minimum** per tool description
2. **When to use AND when NOT to use** prevents mis-selection
3. **Parameter descriptions include format AND examples** — not just type
4. **Return value descriptions** tell the agent what to expect and how to interpret it
5. **Caveats are actionable** — they guide behavior, not just warn
6. **Error guidance** turns failures into recovery paths
7. **Consolidation** reduces tool count while increasing capability

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
  "next_steps": "Present KB0045123 resolution to user. If unsuccessful, escalate for reinstall evaluation."
}
```

Benefit: Agent receives a recommendation with confidence score and reasoning — it can act
immediately or challenge the recommendation if evidence seems weak.

### Threshold-Based Output Example

```json
// When record count is high
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
