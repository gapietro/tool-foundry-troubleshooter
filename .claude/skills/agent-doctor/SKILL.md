---
name: agent-doctor
description: Use when a ServiceNow AI Agent or Agentic Workflow isn't behaving as its demo narrative specifies — trace the latest execution, identify root cause (tool script bug, missing data, missing cross-scope privilege, weak instructions, etc.), propose a Fluent DSL fix, apply via now-sdk build+install, verify via MCP, and ship as an issue → branch → PR. Accepts an agent or workflow name as input. SDK owns creation/edits; MCP owns runtime testing.
---

# Agent Doctor

Systematic troubleshooting for ServiceNow AI Agents and Agentic Workflows defined with Fluent DSL + tested via the Foundry MCP server.

> **Runtime tooling:** The `servicenow_*` tool names in this document are the Foundry MCP server's runtime tools. Treat them as capabilities — "execute an agent", "read an execution trace", "query a table" — and map them to the equivalents of whatever MCP server is connected. With no MCP server, fall back to manual verification: test in the Now Assist panel / AI Agent Studio and read execution traces from `sn_aia_execution_plan` / `sn_aia_execution_task`; query data via list views or a user-run background script.

## When to use

- A user says "agent X isn't working," "run a trace on workflow Y," "Scenario N failed," or gives you an agent/workflow name and symptom.
- After the user runs a test in AI Agent Studio and the output doesn't match the demo narrative.
- When tool calls return empty / hallucinated / wrong results and you need to find out why.

**Arguments:** the agent or workflow name (required). Optionally the scenario/objective they tested.

## Instructions

When invoked:

1. **Read project context** — load CLAUDE.md (both the workspace-level and `src/*/CLAUDE.md`), `now.config.json` (scope + alias), and any demo narrative HTML under `../99_Assets/POC_Documents/*.html` or similar. Confirm the MCP connection with `servicenow_status`.
2. **Resolve the agent or workflow** — use `servicenow_aia_list` for agents, `servicenow_aia_usecase_list` for orchestrator workflows. If not found, grep `src/fluent/` for the name.
3. **Pull the latest execution** via `servicenow_aia_logs` (filter by `agentName`, widen `timeRange` as needed). Identify the run matching the user's described symptom.
4. **Trace it** with `servicenow_aia_trace <executionId> --includeRawPayloads true`. Note classification, tool calls that did/didn't fire, inputs/outputs, and final state.
5. **Inspect suspected tool scripts** with `servicenow_aia_tool_get <name> --includeScript true`. Simulate the tool's query in isolation using `servicenow_script` (readonly mode) to confirm the bug.
6. **Verify demo data** with `servicenow_query` / `servicenow_script` — confirm the records the agent needs actually exist with the expected field values (`number`, `active`, `workflow_state`, `category`, location, etc.).
7. **Identify root cause** using the "Typical root-cause patterns" table below.
8. **Report diagnosis and proposed fix**, then **STOP** and wait for user approval. Use the output format shown further down.
9. **On approval:** create a GitHub issue, cut a feature branch from main, edit Fluent DSL files in `src/fluent/`, run `now-sdk build && now-sdk install --alias <alias>`, verify via MCP (re-simulate tool logic, re-trace if possible, confirm created records).
10. **Commit (referencing the issue with `Closes #N`), push, and open a PR with a test plan.** Stop after the PR is opened — user reviews and merges.

**Hard rules:** SDK owns creation/edits; MCP owns runtime. Never edit Fluent until the user approves. Never commit to main. Never stage `src/fluent/generated/`. Skip testing copilot tools via MCP — hand off to AI Agent Studio.

## Operating principles (non-negotiable)

These encode the workflow proven in the PPL Customer Service Orchestrator troubleshooting session.

1. **SDK owns creation and edits. MCP owns runtime.**
   - Any change to agents, tools, workflows, skills, tables, flows, demo data → edit Fluent DSL in `src/fluent/`, run `now-sdk build && now-sdk install --alias <alias>`.
   - Never mutate a Fluent-defined record directly via MCP — the instance will drift from source.
   - MCP is for: listing, reading, tracing, executing, querying, running one-off diagnostic scripts.

2. **Propose, then apply.** Never edit Fluent files until the user has seen the diagnosis and planned changes and said "go" (or equivalent). Match the session pattern: trace → diagnose → recommend → wait for OK → implement.

3. **Always enforce the CLAUDE.md workflow.** Every fix — even a one-line script change — goes through: GitHub issue → feature branch off main → commit referencing the issue with `Closes #N` → push → PR with test plan. No direct-to-main. Stop after the PR is opened; user reviews and merges.

4. **Demo data fixes are code fixes.** If the agent is "working" but the data is missing/wrong (KB article with null `number`, no outage record, missing account), fix it by editing the `*-demo-data.now.ts` files, not by inserting via MCP. Data is versioned alongside agents.

5. **Copilot tools cannot be tested via MCP `aia_execute`.** Non-interactive mode refuses the human-confirmation step (returns `Fatal Error: restricted Action 'collect_input_from_user'`). Do not try. Hand off to the user with exact steps to run in AI Agent Studio → Test AI Reasoning.

6. **Orchestrators (AiAgenticWorkflow) cannot be invoked via MCP `aia_execute` either** (that tool only accepts agents, not use-case sys_ids). Either test child agents individually or ask the user to run the orchestrator interactively.

7. **Respect the demo narrative.** Read it first. If the agent diverges from it, prefer fixing the agent/data to match. Only update the narrative HTML when the agent's behavior is *correct and better* than what the narrative described, and the user confirms.

## The Process

```
1. Read project context
   └─> CLAUDE.md files (project root + SDK subdir)
   └─> now.config.json (scope, alias)
   └─> Any demo narrative HTML in ../99_Assets/POC_Documents/ or similar
   └─> Confirm MCP connection (servicenow_status)

2. Locate the agent/workflow
   └─> servicenow_aia_list (if agent) or servicenow_aia_usecase_list (if workflow)
   └─> If not found, grep src/fluent/ for the name and check it was installed

3. Pull the latest execution
   └─> servicenow_aia_logs --agentName <name> --timeRange 1h (widen to 4h if empty)
   └─> Pick the newest execution that matches the user's described symptom

4. Trace it
   └─> servicenow_aia_trace <execution_id> --includeRawPayloads true
   └─> Note: classification, tool calls (which fired, which didn't), tool inputs/outputs, state

5. Check tool scripts suspected of faults
   └─> servicenow_aia_tool_get <tool name> --includeScript true
   └─> Simulate the tool's query in isolation with servicenow_script to confirm the bug

6. Check demo data existence
   └─> servicenow_query or servicenow_script to verify the records the agent needs actually exist with the expected field values (especially `number`, `active`, `workflow_state`, location/category filters)

7. Identify root cause — typical patterns below

8. Report diagnosis to user, list proposed Fluent DSL changes, wait for approval

9. Apply changes
   └─> Create GitHub issue with problem/root cause/fix
   └─> git checkout main && git pull && git checkout -b fix/<slug>
   └─> Edit src/fluent/*.now.ts (and src/fluent/*-demo-data.now.ts)
   └─> Edit narrative HTML ONLY if user agreed to sync it
   └─> now-sdk build && now-sdk install --alias <alias>
   └─> Verify with MCP: run the fixed tool's query logic directly or invoke a child agent

10. Commit, push, open PR
   └─> git add specific files (never -A or .) — never stage src/fluent/generated/
   └─> Commit message references issue with "Closes #N"
   └─> git push -u origin <branch>
   └─> gh pr create with test plan checklist
   └─> STOP. User reviews and merges.
```

## Typical root-cause patterns (from real fixes)

| Symptom | Likely cause | Fix |
|---|---|---|
| Tool returns `0` results despite data existing | Wrong query operator, enum field compared with free text, or field mismatch | Rewrite with `addEncodedQuery` + token OR match + scoping to the right KB base / category / scope |
| Agent hallucinates KB/record numbers | The records have `number: null`; LLM invented plausible values | Add `number: '<PREFIX>nnnn'` to the Fluent `Record({...})` demo data; rebuild |
| Tool returns `{success: true}` but nothing persists | Silent-success fallback branch hiding the absence of `case_number`/`sys_id` | Rewrite to fail loud with an explicit `error` message pointing the LLM to the right tool |
| Use Case appears "Inactive" in MCP | `sn_aia_usecase` has no `active` column; MCP label is cosmetic for unpublished versions | Usually benign if the version is `published` and the trigger has `active: true`. Test anyway. |
| Cross-scope write fails silently (`insert()` returns null from agent context) | Missing `CrossScopePrivilege` for the target table | Add Fluent `CrossScopePrivilege({operation: 'create'/'write'/'read', targetName: '<table>', targetScope: '<scope>', targetType: 'sys_db_object'})` |
| Work notes appear empty on the record but agent says they wrote them | Journal field — content lives in `sys_journal_field`, not on the record column | Query `sys_journal_field` where `element_id=<case sys_id>` to confirm |
| Agent doesn't call a tool the instructions require | Ambiguous instructions, or tool is copilot in non-interactive test | Tighten instructions to mandate the tool + order; for copilot, retest in AI Agent Studio |
| Agent cites the wrong article/record as "secondary" | Relevance scoring or query terms miss it | Add token weighting in the search script (short_description match worth more than body), or boost key terms in instructions |
| LLM query to search tool misses key dimension (e.g. "DER") | Prompt-engineered query doesn't include all narrative-relevant terms | Either update agent instructions to include those terms, or update the demo narrative to match what the agent actually cites |
| Orchestrator runs KB or Outage Status for a SENSITIVE case | Classification rules in orchestrator base plan too weak | Tighten SENSITIVE criteria in the orchestrator's `instructions` |
| Execution terminates immediately; `sn_aia_execution_plan.state_reason = security_violation` | ACL–trigger misalignment: the trigger runs as the requesting user, whose role isn't in the agent/workflow user-access or data-access roles — config *looks* correct until you check who actually fires the trigger | Align `securityAcl` / `dataAccess` roles in Fluent with the role the real triggering user has; re-test impersonating that user, not admin |
| Agent is slow (high `execution_time_ms` on the plan record) | Instruction bloat or tool-output bloat — every instruction and scratchpad token is reprocessed on each ReAct turn. `llm_p95_latency` high → oversized per-turn context; `tool_p95_latency` high → slow/oversized tool | Diagnose with the plan's p95/token fields and `sys_gen_ai_log_metadata.prompt_token_count`; fix per `context/agent-performance-debugging.md` |
| Agent loops or dies at the retry limit (`sn_aia_message.error_type = retry_limit`) | No completion criteria the agent can evaluate, contradictory agent-vs-workflow instructions, or a trigger that re-fires on records the agent's own writes update | Add an explicit termination condition to instructions; reconcile agent/workflow directives; add a trigger condition excluding agent-authored updates |

## Red flags — stop and investigate before "fixing"

- Trace shows `state: Completed` but zero tool calls → agent is hallucinating action.
- Before deep-tracing a failed run, read `sn_aia_message.error_type` on its error/system messages (`tool_failure`, `execution_error`, `llm_error`, `permission_denied`, `solver_error`, `retry_limit`, `refiner_failure`, `system_error` — verified Zurich P10) — one query often names the failure class and picks your starting step.
- Tool response has `"number": null` / `"sys_id": null` / `"success": true` with no other fields → silent-success stub.
- Cross-scope writes from agent scripts that return `null` on `.insert()` / `.update()` → missing privilege. Don't "try harder" — add the privilege.
- Demo data referenced in the narrative doesn't exist on the instance → the narrative expected seeded data that was never installed. Add it to Fluent, don't hot-insert.
- A scenario runs cleanly in Testing/Interactive mode but fails in production triggers → check the trigger config `active: true` and `targetTable` match the channel (NAP vs VA vs chat).

## MCP toolkit (runtime testing only)

| Tool | Purpose | Notes |
|---|---|---|
| `servicenow_status` | Confirm connected instance + alias | Run first. |
| `servicenow_aia_list` | Find the agent by name | Use `nameFilter` and `includeTools: true`. |
| `servicenow_aia_usecase_list` | Find the orchestrator workflow | Workflows are not agents — different table (`sn_aia_usecase`). |
| `servicenow_aia_usecase_get` | Read orchestrator base plan + linked agents | |
| `servicenow_aia_get` | Read agent instructions + tools | Use `includeToolDetails: true` to see tool scripts inline. |
| `servicenow_aia_logs` | Find recent executions | Filter by `agentName` and `timeRange`. Executions are stored under the top-level agent even for orchestrator runs. |
| `servicenow_aia_trace` | Step-by-step trace of one execution | `includeRawPayloads: true` to see tool I/O. |
| `servicenow_aia_errors` | Error aggregation across runs | Use `groupBy: tool` or `agent` to find systemic issues. |
| `servicenow_aia_tool_get` | Read a tool's script and schema | Single source of truth for what the agent actually runs. |
| `servicenow_aia_execute` | Run an agent directly | **Agents only**, not workflows. Does NOT work for copilot tools. |
| `servicenow_query` | Read records (GlideRecord) | Read-only. For verifying demo data and escalation artifacts. |
| `servicenow_script` | Run scripts on instance | Use `mode: readonly` first. `execute` mode may silently reject `insert/update/delete` — verify via agent runtime instead. |

## SDK toolkit (creation / edits)

| Command | When | Notes |
|---|---|---|
| `now-sdk build` | After every Fluent edit | Must succeed before install; fix type errors first. |
| `now-sdk install --alias <alias>` | After successful build | Deploys `dist/` to the instance. |
| `now-sdk download src/` | Only when instance was edited directly and you need to reconcile | Do not use in normal loop. |

**Critical Fluent DSL rules** (from the project's `sdk-reference.md`):
- Every `.now.ts` file starts with `import '@servicenow/sdk/global'`.
- Script tools must be self-invoking IIFEs: `(function(inputs) { ... })(inputs);` — the trailing `(inputs)` is required or the runtime errors on JSON conversion.
- `CrossScopePrivilege` — use `operation: 'read' | 'write' | 'create'` and `targetType: 'sys_db_object'` for tables.
- No conditionals/ternaries in Fluent template literals.
- Tool return in `tools()` uses explicit property assignment (`{ myTool: myTool }` not shorthand).

## Git + GitHub workflow (enforced — no exceptions)

```bash
# 0. From the SDK project root (where now.config.json lives)
git checkout main && git pull

# 1. Create a GitHub issue documenting the problem + root cause
gh issue create --title "bug(<area>): <one-liner>" --label bug --assignee @me --body "..."

# 2. Feature branch
git checkout -b fix/<short-slug>

# 3. Make the Fluent edits

# 4. Build + install
now-sdk build && now-sdk install --alias <alias>

# 5. Verify with MCP (trace, simulate tool logic, check created records)

# 6. Commit with issue reference
git add src/fluent/<files>            # never git add -A, never include src/fluent/generated/
git commit -m "fix(<area>): <what> (#<issue>)\n\nCloses #<issue>"

# 7. Push and PR
git push -u origin fix/<short-slug>
gh pr create --title "..." --body "## Summary ... ## Test plan ..."

# 8. STOP here. User reviews and merges.
```

Branch naming: `fix/` for bug fixes, `feature/` for new functionality, `chore/` for config/cleanup, `docs/` for documentation.

**Never include `src/fluent/generated/` in commits** — it's a build artifact.

## Copilot tool handoff template

When the diagnosis requires testing a copilot tool (e.g., "Escalate to Human Agent"), hand off with exact instructions:

> The `<tool name>` tool is `executionMode: 'copilot'` — it requires interactive human approval and cannot be triggered through MCP.
>
> To verify, run this from **AI Agent Studio**:
> 1. Open **<agent or workflow name>**
> 2. Click **Test AI Reasoning**
> 3. Paste this objective:
>    > `<exact objective text>`
> 4. Approve the copilot gate when it appears
> 5. Send me the execution ID and I'll trace it

## Narrative-divergence decision tree

When the agent behavior diverges from the demo narrative HTML:

```
Is the agent's behavior WRONG per the narrative's intent?
├─ YES → Fix the agent/data to match the narrative. Don't touch the narrative.
└─ NO — agent is doing something reasonable, just different
   └─ Is the agent's behavior BETTER (cites real KB numbers, picks stronger article, etc.)?
      ├─ YES → Offer to update the narrative to match. Update requires user OK.
      └─ NO — equivalent → Leave narrative, flag the discrepancy in the report.
```

Narrative files typically live OUTSIDE the SDK repo (`../99_Assets/POC_Documents/*.html`) and may not be under git. Always check `git rev-parse --show-toplevel` from the narrative's directory before assuming it's versioned.

## Output format

Deliver diagnoses in this shape:

```
## What's working ✓
- …

## What's wrong ✗
**1. <Headline>**
- <Evidence from trace or query>

**2. <Headline>**
- <Evidence>

## Root causes
- <numbered list tying symptom → cause → exact file:line if Fluent>

## Proposed fix
- <bullet list of Fluent DSL edits>
- Privileges to add: <list>
- Demo data to seed: <list>
- Narrative edits (only if user already agreed to sync): <list>

## Test plan (after install)
- <numbered verification steps>

Want me to go ahead on a branch?
```

## Version bump reminder

Only needed when merging to main — the version bump commit is a separate step the user does at merge time. Current format: `YYYY.MM.DDXX` in `package.json` and the `README.md` badge. Don't include a bump in the fix commit.
