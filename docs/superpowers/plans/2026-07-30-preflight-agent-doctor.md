# Phase 0 Pre-Flight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Falsify or confirm the native-harness bet (Option A) against keynexus01 before any of `docs/IMPLEMENTATION_PLAN.md` Task 1–13 is built.

**Architecture:** Two phases. Phase 0a is six read-only MCP reconnaissance probes. Phase 0b creates one disposable AI Agent, runs three experiments against it, and deletes it. Every probe has a result-to-verdict rule fixed before it runs. The single deliverable is `docs/PREFLIGHT_FINDINGS.md` plus any rulings filed into `DESIGN.md` §4.

**Tech Stack:** Foundry MCP tools against `keynexus01.service-now.com` (Zurich Patch 10 Hotfix 3), admin auth via macOS Keychain. No SDK, no scoped app, no repo source code.

## Global Constraints

- **Nothing is built.** No SDK project, no scoped app, no Script Includes, no application source in `src/`.
- **One exception:** a single disposable probe agent, created → fired → captured → deleted within Phase 0b.
- **No property writes.** `sn_aia.continuous_tool_execution_limit` is read and recorded, never set. Tuning is a build-time decision.
- **No GenAI provider configuration is touched** (LLD §8.8 — shared instance).
- **All probe-created sys_ids are recorded** in `docs/PREFLIGHT_FINDINGS.md` as they are created, before the next step runs, so cleanup is always possible even if a task aborts.
- **Every probe records its result verbatim**, including nulls and errors. An empty result is a finding, never a silent nothing (the same rule LLD §4 imposes on the tool cores).
- Target instance is exactly `keynexus01.service-now.com`. Confirm with `servicenow_status` before any write.

---

## File Structure

| File | Responsibility |
|---|---|
| `docs/PREFLIGHT_FINDINGS.md` | Create. The single output artifact. Grows one section per task; every task commits to it |
| `DESIGN.md` | Modify, §4 "Rulings during implementation" only. Any finding that changes the design is filed here |
| `docs/LOW_LEVEL_DESIGN.md` | Modify, §8 only, final task. Each open item marked closed or carried forward |

No other file is created or modified by this plan.

---

## Task 1: Findings Skeleton and Connection

**Files:**
- Create: `docs/PREFLIGHT_FINDINGS.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/PREFLIGHT_FINDINGS.md` with a fixed section per probe (P1–P6, E1–E3) that later tasks fill in. Later tasks append to their own section only.

- [ ] **Step 1: Confirm the connection targets the right instance**

Call `mcp__foundry__servicenow_status` with `{}`.

Expected: an active connection to `keynexus01.service-now.com`. If it reports a different instance or no connection, call `mcp__foundry__servicenow_connect` with:

```json
{"instance": "keynexus01.service-now.com", "authType": "keychain", "username": "admin"}
```

**Do not proceed to any other task until status shows keynexus01.** Every write in Phase 0b lands on whatever instance is connected.

- [ ] **Step 2: Create the findings skeleton**

Create `docs/PREFLIGHT_FINDINGS.md` with exactly this content:

```markdown
# Phase 0 Pre-Flight Findings

**Instance:** keynexus01.service-now.com · **Run date:** 2026-07-30
**Spec:** `docs/superpowers/specs/2026-07-30-preflight-agent-doctor-design.md`
**Status:** in progress

## Verdict

_Filled by Task 12._

## Phase 0a — Read-only reconnaissance

### P1 — Now Assist Panel and product plugin (LLD §8.10)
_Pending._

### P2 — Loop budget (DESIGN 2.2)
_Pending._

### P3 — Execution mode choices (LLD §8.1)
_Pending._

### P4 — Cross-scope reachability (LLD §8.4)
_Pending._

### P5 — GenAI log payloads and ACLs (LLD §8.3, §8.6)
_Pending._

### P6 — User/Data Access role storage (LLD §8.9)
_Pending._

## Phase 0b — Disposable probe agent

### Created records
_Pending. Every sys_id recorded here as created._

### E1 — Runtime context dump (LLD §8.5)
_Pending._

### E2 — 15-call endurance (DESIGN 2.2, 2.3)
_Pending._

### E3 — Data model confirmation (LLD §2.1)
_Pending._

### Cleanup
_Pending._

## LLD §8 disposition
_Filled by Task 12._
```

- [ ] **Step 3: Commit**

```bash
git add docs/PREFLIGHT_FINDINGS.md
git commit -m "docs: add pre-flight findings skeleton"
```

---

## Task 2: P1 — Panel and Product Plugin Gate

**Files:**
- Modify: `docs/PREFLIGHT_FINDINGS.md` (P1 section)

**Interfaces:**
- Consumes: findings skeleton from Task 1.
- Produces: a boolean `panel_available` recorded in the P1 section. Task 8 and Task 9 read it to decide whether the panel path is testable.

This is the gate. A negative result blocks Phase 0b (Tasks 7–11) but **not** Tasks 3–6, which are pure reads and still worth having.

- [ ] **Step 1: List active Now Assist plugins**

Call `mcp__foundry__servicenow_query`:

```json
{"table": "sys_plugin", "query": "active=true^nameLIKENow Assist^ORnameLIKEnow_assist^ORidLIKEsn_now_assist",
 "fields": ["id", "name", "active", "version"], "limit": 100}
```

If `sys_plugin` returns nothing readable, retry against `v_plugin` with the same query. Record which table answered.

- [ ] **Step 2: Read Now Assist properties**

Call `mcp__foundry__servicenow_query`:

```json
{"table": "sys_properties", "query": "nameLIKEnow_assist^ORnameLIKEnowassist^ORnameLIKEsn_aia",
 "fields": ["name", "value", "description"], "limit": 200}
```

Record every returned name/value pair verbatim in the P1 section. The panel-enablement property name is not known in advance — that is what this step discovers. Do not filter results down to what looks relevant; the full list is the finding.

- [ ] **Step 3: Confirm a product plugin is active**

From Step 1's output, identify whether at least one of ITSM / HRSD / CSM / SecOps Now Assist product plugins is active. Per LLD §1, the panel requires one.

- [ ] **Step 4: Record the result and apply the verdict**

Write into the P1 section: the plugin list, the property list, and one of:

- `panel_available: true` — a Now Assist product plugin is active and no property indicates the panel is disabled. Both the API and panel execution paths are testable.
- `panel_available: false` — the panel path is unavailable. **This does not stop Phase 0b.** `servicenow_aia_execute` fires an agent through the API without the panel, so E1 and E2 still run — but E1's answer becomes **provisional**, because the production path is the panel and the runtime identifiers may differ between the two. Record exactly which precondition failed; it is an instance-provisioning task, not a design change, and it must be resolved before the benchmark.

- [ ] **Step 5: Commit**

```bash
git add docs/PREFLIGHT_FINDINGS.md
git commit -m "docs: P1 pre-flight — Now Assist panel and plugin state"
```

---

## Task 3: P2 — Loop Budget Values

**Files:**
- Modify: `docs/PREFLIGHT_FINDINGS.md` (P2 section)

**Interfaces:**
- Consumes: findings skeleton.
- Produces: two recorded integers — `oob_default` and `current_value` for the tool-call ceiling — read by Task 9 (E2) to predict where the loop should stop, and cited by the §6 transferability caveat.

- [ ] **Step 1: Read the continuous execution limit property**

Call `mcp__foundry__servicenow_query`:

```json
{"table": "sys_properties", "query": "nameLIKEcontinuous_tool_execution^ORnameLIKEtool_execution_limit",
 "fields": ["name", "value", "description", "sys_created_on", "sys_updated_on", "sys_updated_by"], "limit": 50}
```

Record name, value, and **`sys_updated_by`**. If the property has been modified from its shipped value, `sys_updated_by` and `sys_updated_on` reveal it — which is exactly the distinction the transferability caveat depends on.

- [ ] **Step 2: Read the m2m max_auto_executions dictionary default**

Call `mcp__foundry__servicenow_schema`:

```json
{"table": "sn_aia_agent_tool_m2m", "includeFields": true, "maxFields": 200}
```

Record the `max_auto_executions` field's type and default value. Record the full field list too — Task 5 and Task 7 both need to know what fields exist on this table.

- [ ] **Step 3: Read what the OOB agents actually use**

Call `mcp__foundry__servicenow_query`:

```json
{"table": "sn_aia_agent_tool_m2m",
 "fields": ["agent", "tool", "max_auto_executions", "execution_mode", "output_transformation_strategy", "display_output", "active"],
 "displayValue": "all", "limit": 200}
```

Record the distribution of `max_auto_executions` values across the 19 OOB agents. A shipped agent using a high value is evidence the platform tolerates it; all of them at 1–3 is evidence the harness is workflow-shaped, which is the doubt `DESIGN.md` §1 names.

- [ ] **Step 4: Record the result and apply the verdict**

Write into the P2 section, as separate labelled lines:

- `oob_default:` the shipped value (from the dictionary default, and from `sys_updated_by` being empty on the property)
- `current_value:` the value in force on keynexus01 now
- `oob_m2m_distribution:` the observed spread

Then state the predicted E2 ceiling. **Do not change either value.** If they differ, that difference is itself a finding for §6.

- [ ] **Step 5: Commit**

```bash
git add docs/PREFLIGHT_FINDINGS.md
git commit -m "docs: P2 pre-flight — loop budget values (OOB vs current)"
```

---

## Task 4: P3 — Execution Mode Choices

**Files:**
- Modify: `docs/PREFLIGHT_FINDINGS.md` (P3 section)

**Interfaces:**
- Consumes: the `sn_aia_agent_tool_m2m` field list from Task 3 Step 2.
- Produces: the exact string value to use for unsupervised execution, read by Task 7 when creating the probe m2m row.

- [ ] **Step 1: Read the execution_mode choice list**

Call `mcp__foundry__servicenow_query`:

```json
{"table": "sys_choice", "query": "name=sn_aia_agent_tool_m2m^element=execution_mode",
 "fields": ["value", "label", "sequence", "inactive"], "limit": 50}
```

Record every value/label pair verbatim. These strings go directly into Task 7.

- [ ] **Step 2: Read the tool type choice list**

Call `mcp__foundry__servicenow_query`:

```json
{"table": "sys_choice", "query": "name=sn_aia_tool^element=type",
 "fields": ["value", "label", "sequence", "inactive"], "limit": 50}
```

Record the exact value that means "script" — LLD §5 assumes `script`, and Task 7 needs the literal.

- [ ] **Step 3: Cross-check against real usage**

From Task 3 Step 3's output, record which `execution_mode` values the OOB agents actually carry on script-type tools. A choice existing in `sys_choice` but used nowhere is weaker evidence than one in production use.

- [ ] **Step 4: Record the result and apply the verdict**

Write into the P3 section the full choice lists plus one of:

- `unsupervised_available: true` — record the exact literal, e.g. `execution_mode=<value>`. Proceed.
- `unsupervised_available: false` — every mode requires supervision. **Verdict: an autonomous sweep is not possible natively; the benchmark would measure a different product than the one specified.** Record this and continue — E2 in Task 9 becomes even more important, since it will then measure the supervised ceiling instead.

- [ ] **Step 5: Commit**

```bash
git add docs/PREFLIGHT_FINDINGS.md
git commit -m "docs: P3 pre-flight — execution_mode and tool type choices"
```

---

## Task 5: P4 — Cross-Scope Reachability

**Files:**
- Modify: `docs/PREFLIGHT_FINDINGS.md` (P4 section)

**Interfaces:**
- Consumes: findings skeleton.
- Produces: a per-table reachability table read by Task 12's verdict.

**Spec correction, carried in deliberately.** The spec's P4b proposed a read-only background script run in an existing non-global scope. **The Foundry MCP toolset has no background-script executor** — `servicenow_code` only fetches source, and `servicenow_request` is restricted to `/api/` paths while `sys.scripts.do` is not an `/api/` endpoint. P4b as written is not executable here. This task does the static half (P4a) properly and records the runtime half as explicitly carried forward. Task 8 Step 4 recovers part of it — the probe tool's own `GlideRecordSecure` attempts are a real runtime read test, one scope hop short of the production path.

- [ ] **Step 1: Read table access settings across the LLD §2 table list**

Call `mcp__foundry__servicenow_query`:

```json
{"table": "sys_db_object",
 "query": "nameINsn_aia_execution_plan,sn_aia_execution_task,sn_aia_tools_execution,sn_aia_message,sn_aia_agent,sn_aia_tool,sn_aia_agent_tool_m2m,sn_aia_usecase,sn_aia_trigger_configuration,sys_gen_ai_usage_log,sys_gen_ai_log_metadata,sys_log",
 "fields": ["name", "label", "access", "caller_access", "read_access", "sys_scope"],
 "displayValue": "all", "limit": 100}
```

Record `access` and `caller_access` per table. `access=none`, or a restrictive `caller_access`, means a scoped app cannot read it regardless of privileges granted.

- [ ] **Step 2: Read existing cross-scope privileges as precedent**

Call `mcp__foundry__servicenow_query`:

```json
{"table": "sys_scope_privilege", "query": "targetLIKEsn_aia^ORtargetLIKEsys_gen_ai",
 "fields": ["source", "target", "operation", "status"], "displayValue": "all", "limit": 200}
```

Any existing row is precedent that the privilege is grantable. No rows is not proof it is impossible — record it as "no precedent found", not as a negative.

- [ ] **Step 3: Determine whether a non-global scoped app exists**

Call `mcp__foundry__servicenow_query`:

```json
{"table": "sys_scope", "query": "scope!=global^scopeSTARTSWITHx_",
 "fields": ["name", "scope", "version", "active"], "limit": 100}
```

Record the list. This determines whether the spec's P4b proxy would have been possible at all, independent of the tooling gap — worth knowing before the build, when we will have our own scope and a real background-script path via the UI.

- [ ] **Step 4: Record the result and apply the verdict**

Write into the P4 section a per-table reachability table, plus one of:

- `scoped_read_viable: likely` — no §2 table is `access=none`, and precedent exists or the tables are broadly accessible. Runtime confirmation still carried forward.
- `scoped_read_viable: blocked` — one or more §2 tables are unreadable from a non-global scope. **Verdict: the tool cores cannot live in our scope; LLD §6's build approach changes before Task 1.** Name the specific tables.

Also record verbatim: `P4b runtime proxy NOT EXECUTED — no background-script executor in the MCP toolset; runtime confirmation carried forward to build time.`

- [ ] **Step 5: Commit**

```bash
git add docs/PREFLIGHT_FINDINGS.md
git commit -m "docs: P4 pre-flight — cross-scope reachability (static); runtime half carried forward"
```

---

## Task 6: P5 and P6 — GenAI Payloads and Access Role Storage

**Files:**
- Modify: `docs/PREFLIGHT_FINDINGS.md` (P5 and P6 sections)

**Interfaces:**
- Consumes: findings skeleton.
- Produces: field names for the `genai_log` tool's payload reads and for the §4.2 access-alignment check. Neither blocks the build; both shape tool depth.

These two are lower stakes than P1–P4 and are combined into one task because neither can independently fail the gate.

- [ ] **Step 1: Describe the GenAI log tables**

Call `mcp__foundry__servicenow_schema` three times, once per table:

```json
{"table": "sys_gen_ai_log_metadata", "includeFields": true, "maxFields": 200}
```
```json
{"table": "sys_gen_ai_metadata_document", "includeFields": true, "maxFields": 200}
```
```json
{"table": "sys_gen_ai_usage_log", "includeFields": true, "maxFields": 200}
```

Record which table holds the prompt and response payloads, and the exact field names.

- [ ] **Step 2: Read the ACLs on those tables**

Call `mcp__foundry__servicenow_code`:

```json
{"type": "acl", "table": "sys_gen_ai_log_metadata", "includeSource": true, "limit": 50}
```

Repeat for `sys_gen_ai_metadata_document`. Record which roles are required for read. LLD §8.3 asks specifically whether non-admin callers can read these — the answer determines whether the `genai_log` tool works for a customer's `sn_aia_admin` user or only for admins.

- [ ] **Step 3: Find the capability-to-provider mapping**

Call `mcp__foundry__servicenow_query`:

```json
{"table": "sys_db_object", "query": "nameSTARTSWITHsys_one_extend",
 "fields": ["name", "label", "access"], "limit": 100}
```

Record the table list. Then describe the one whose label indicates capability or provider mapping using `mcp__foundry__servicenow_schema`. Record the fields the `genai_log` tool would read for `check_config`.

- [ ] **Step 4: Locate the User Access and Data Access role sets**

Call `mcp__foundry__servicenow_schema`:

```json
{"table": "sn_aia_agent", "includeFields": true, "maxFields": 200}
```

Then the same for `sn_aia_usecase`. Record any field whose name or label indicates user access, data access, roles, or run-as. If no such field exists on either table, search for a related m2m:

```json
{"table": "sys_db_object", "query": "nameSTARTSWITHsn_aia^nameLIKErole",
 "fields": ["name", "label"], "limit": 50}
```

- [ ] **Step 5: Record both results**

Write into P5: the payload table and field names, the read-role requirement, and the capability mapping table. Write into P6: the storage location of the access role sets, or `not found — carried forward` if neither a field nor an m2m surfaces it.

Neither result blocks the gate. Both are recorded as closed or carried forward.

- [ ] **Step 6: Commit**

```bash
git add docs/PREFLIGHT_FINDINGS.md
git commit -m "docs: P5/P6 pre-flight — GenAI payload location, ACLs, access role storage"
```

---

## Task 7: Create the Disposable Probe Agent

**Files:**
- Modify: `docs/PREFLIGHT_FINDINGS.md` ("Created records" section)

**Interfaces:**
- Consumes: `execution_mode` literal and tool `type` literal from Task 4; `sn_aia_agent_tool_m2m` field list from Task 3 Step 2; `panel_available` from Task 2.
- Produces: sys_ids for the probe agent, tool, and m2m, consumed by Tasks 8, 9, and 11.

**Precondition:** none. Phase 0b runs regardless of Task 2's `panel_available` result, because `servicenow_aia_execute` fires the agent through the API without the panel. If `panel_available` is false, Task 8 Step 5 (the panel path) is skipped and E1's answer is recorded as provisional.

**This is the first task that writes to the instance.** Every created sys_id is recorded in `docs/PREFLIGHT_FINDINGS.md` and committed *before* the next step runs, so Task 11 can always clean up even if a later step aborts.

- [ ] **Step 1: Confirm the target instance one more time**

Call `mcp__foundry__servicenow_status` with `{}`. Confirm `keynexus01.service-now.com`. Abort the task if it reports anything else.

- [ ] **Step 2: Create the probe tool**

Call `mcp__foundry__servicenow_table_create`:

```json
{"table": "sn_aia_tool",
 "fields": {
   "name": "pa_probe_context",
   "type": "<the script literal recorded in Task 4 Step 2>",
   "description": "TEMPORARY PRE-FLIGHT PROBE — safe to delete. Read-only. Logs its runtime context to sys_log under PA_PROBE.",
   "script": "<the script body from Step 3 below>"
 }}
```

Record the returned sys_id immediately.

- [ ] **Step 3: Use exactly this script body**

The signature `execute(inputs, outputs)` is an assumption, not a verified fact — confirming it is part of what E1 discovers. The script is written defensively so that a wrong signature still produces a log line rather than a silent failure:

```javascript
(function execute(inputs, outputs) {
    var report = { probe: 'PA_PROBE', ts: new GlideDateTime().getValue() };

    try { report.inputs = JSON.stringify(inputs); }
    catch (e) { report.inputs = 'ERR:' + e.message; }

    try {
        report.user = gs.getUserName();
        report.userId = gs.getUserID();
        report.scope = (typeof gs.getCurrentScopeName === 'function') ? gs.getCurrentScopeName() : 'n/a';
    } catch (e) { report.identity = 'ERR:' + e.message; }

    try { report.sessionId = gs.getSessionID(); }
    catch (e) { report.sessionId = 'ERR:' + e.message; }

    try {
        var names = [];
        for (var k in this) { names.push(k); }
        report.globals = names.sort().join(',');
    } catch (e) { report.globals = 'ERR:' + e.message; }

    report.reads = {};
    ['sn_aia_execution_plan', 'sn_aia_message', 'sn_aia_tools_execution',
     'sys_gen_ai_log_metadata', 'sys_log'].forEach(function (t) {
        try {
            var gr = new GlideRecordSecure(t);
            gr.setLimit(1);
            gr.query();
            report.reads[t] = gr.next() ? 'OK' : 'EMPTY_OR_DENIED';
        } catch (e) { report.reads[t] = 'ERR:' + e.message; }
    });

    gs.info('PA_PROBE ' + JSON.stringify(report));

    try { outputs.result = 'probe logged at ' + report.ts; }
    catch (e) { gs.info('PA_PROBE outputs_unavailable ' + e.message); }
})(inputs, outputs);
```

Three things this is doing on purpose. The `for (var k in this)` enumeration is the only way to learn what bindings the platform hands a script tool — E1's core question. The `GlideRecordSecure` attempts are a real runtime read test, partially recovering what P4b could not do. Everything lands in `sys_log`, not chat, because `DESIGN.md` 2.5 establishes that chat output is unreliable exactly when things break.

- [ ] **Step 4: Record the tool sys_id and commit before proceeding**

Append to the "Created records" section: `sn_aia_tool pa_probe_context = <sys_id>`.

```bash
git add docs/PREFLIGHT_FINDINGS.md
git commit -m "docs: record probe tool sys_id"
```

- [ ] **Step 5: Create the probe agent**

Call `mcp__foundry__servicenow_table_create`:

```json
{"table": "sn_aia_agent",
 "fields": {
   "name": "PA Probe Agent",
   "description": "TEMPORARY PRE-FLIGHT PROBE — safe to delete.",
   "agent_type": "internal",
   "channel": "nap_and_va",
   "strategy": "f0bff21f9f13c6108f431597d90a1c74",
   "role": "Diagnostic probe.",
   "instructions": "You are a probe. When asked to run the layer sweep, call the pa_probe_context tool exactly 15 times in sequence, once per layer, numbering each call from 1 to 15. Do not stop early. Do not summarise between calls. After the 15th call, reply with the single word DONE."
 }}
```

The strategy sys_id is the ReAct strategy verified in LLD §5 — the same one Agent Doctor will use, so E2 measures the real harness rather than a different one.

Record the returned sys_id immediately.

- [ ] **Step 6: Attach the tool to the agent**

Call `mcp__foundry__servicenow_table_create`:

```json
{"table": "sn_aia_agent_tool_m2m",
 "fields": {
   "agent": "<agent sys_id from Step 5>",
   "tool": "<tool sys_id from Step 2>",
   "active": "true",
   "execution_mode": "<the unsupervised literal recorded in Task 4 Step 1>",
   "output_transformation_strategy": "None",
   "display_output": "false",
   "max_auto_executions": "20"
 }}
```

`max_auto_executions` is set to 20 deliberately — above the 15 E2 asks for — so that if the loop stops short, the per-m2m cap is excluded as the cause and the stop is attributable to the instance-wide property recorded in Task 3. This is a probe-record field, not the instance property, so it does not violate the no-property-writes constraint.

- [ ] **Step 7: Record all sys_ids and commit**

Append every created sys_id to the "Created records" section, then:

```bash
git add docs/PREFLIGHT_FINDINGS.md
git commit -m "docs: record probe agent and m2m sys_ids"
```

---

## Task 8: E1 — Runtime Context Dump

**Files:**
- Modify: `docs/PREFLIGHT_FINDINGS.md` (E1 section)

**Interfaces:**
- Consumes: agent sys_id from Task 7 Step 5.
- Produces: the identifier set available to a script tool, and the resulting `PaRunAnchor` keying decision — the answer to `DESIGN.md` 2.4's benchmark-blocking question.

- [ ] **Step 1: Fire the agent once via the API path**

Call `mcp__foundry__servicenow_aia_execute`:

```json
{"agent": "PA Probe Agent", "input": "Call the pa_probe_context tool exactly once. Then reply DONE.",
 "waitForCompletion": true, "timeoutSeconds": 120}
```

Record the returned execution sys_id.

- [ ] **Step 2: Read the probe's log output**

Call `mcp__foundry__servicenow_syslogs`:

```json
{"level": "all", "message": "PA_PROBE", "timeRange": "1h", "limit": 50}
```

Record the full `PA_PROBE` JSON payload verbatim into the E1 section. If no log line appears, that is itself the finding — record `no PA_PROBE log emitted` and check whether the tool was invoked at all via Step 4's trace.

- [ ] **Step 3: Extract the identifier set**

From the logged `globals` and `inputs` fields, list every identifier the script could see. Specifically determine whether **any** of these is available:

1. A conversation or session identifier stable across calls within one conversation.
2. The agent's own `sn_aia_execution_plan` sys_id (`DESIGN.md` 2.4's first named fallback).
3. Anything else usable as a hard per-conversation key.

- [ ] **Step 4: Trace the execution to confirm what actually ran**

Call `mcp__foundry__servicenow_aia_trace`:

```json
{"executionId": "<execution sys_id from Step 1>", "includeRawPayloads": true, "includeTokenUsage": true}
```

Record the tool call count and the input/output payloads. This also confirms whether `servicenow_aia_execute` produces the same execution record shape as a panel-fired run.

- [ ] **Step 5: Repeat via the panel path**

The production path is the Now Assist panel, and the identifiers available may differ between an API-triggered run and a panel-triggered one. In the Now Assist panel on keynexus01, start a conversation with the PA Probe Agent and give it the same single-call instruction. Then re-run Step 2 and record the second `PA_PROBE` payload separately, labelled `panel path`.

If the panel path is unavailable for any reason, record `panel path not run` and the reason. **An E1 answer from the API path alone is provisional** — say so in the record, because `PaRunAnchor` will run under the panel path in production.

- [ ] **Step 6: Record the result and apply the verdict**

Write into the E1 section both payloads, the identifier list, and one of:

- `per_conversation_key: <identifier>` — name it, and state which `PaRunAnchor` keying strategy it enables.
- `per_conversation_key: none` — **Verdict: `DESIGN.md` 2.4's hard-key requirement is unsatisfiable under the native harness. Scored benchmark runs would contaminate each other; the benchmark protocol needs redesign before seeds are built.** Record whether the tester-passed run token fallback (2.4's second option) remains viable.

- [ ] **Step 7: Commit**

```bash
git add docs/PREFLIGHT_FINDINGS.md
git commit -m "docs: E1 pre-flight — runtime identifiers available to a script tool"
```

---

## Task 9: E2 — 15-Call Endurance

**Files:**
- Modify: `docs/PREFLIGHT_FINDINGS.md` (E2 section)

**Interfaces:**
- Consumes: agent sys_id from Task 7; predicted ceiling from Task 3 Step 4.
- Produces: the observed call count and terminal behaviour — the primary input to the §5 verdict on Option A.

This is the highest-value experiment in the plan. It tests the load-bearing assumption directly: can a native Studio ReAct loop sustain a 12–15-call autonomous investigation?

- [ ] **Step 1: Note the log baseline**

Call `mcp__foundry__servicenow_syslogs`:

```json
{"level": "all", "message": "PA_PROBE", "timeRange": "1h", "limit": 200}
```

Record the current count of `PA_PROBE` lines. Task 8 already produced some; E2's count is the delta, so the baseline must be written down before firing.

- [ ] **Step 2: Fire the 15-call sweep**

Call `mcp__foundry__servicenow_aia_execute`:

```json
{"agent": "PA Probe Agent",
 "input": "Run the layer sweep now. Call the pa_probe_context tool exactly 15 times in sequence, numbering each call 1 through 15. Do not stop early. After the 15th call, reply DONE.",
 "waitForCompletion": true, "timeoutSeconds": 120}
```

Record the execution sys_id, the returned text, and **whether the call returned a result, timed out, or hung.** A timeout is not a failed step — it is the `supervision_stall` observation `DESIGN.md` 2.2 predicts, and it must be recorded as data rather than retried away.

- [ ] **Step 3: Count the actual calls**

Re-run the Step 1 syslog query. The delta from the baseline is the observed call count. Cross-check it against the trace:

```json
{"executionId": "<execution sys_id from Step 2>", "includeRawPayloads": false, "includeTokenUsage": true}
```

Record both numbers. If the syslog count and the trace count disagree, record both and note the discrepancy — it would mean calls executed that the trace does not show, which is itself significant for the `agent_trace` tool's design.

- [ ] **Step 4: Classify the terminal behaviour**

Read the execution plan record:

```json
{"table": "sn_aia_execution_plan", "query": "sys_id=<execution sys_id>",
 "fields": ["state", "state_reason", "sys_created_on", "sys_updated_on"], "displayValue": "all", "limit": 1}
```

Classify the ending using the `DESIGN.md` 2.3 vocabulary: `completed | tool_limit | context | supervision_stall | security | wandered | genai_down`. This is the first real observation against that taxonomy, which until now is an untested vocabulary. If the observed behaviour fits none of the seven, **record the gap** — the taxonomy needs a new term before the scorecard uses it.

- [ ] **Step 5: Record the result and apply the verdict**

Write into the E2 section the observed count, the terminal classification, the plan `state`/`state_reason`, and one of:

- `endurance: pass` — all 15 completed cleanly. Option A's core assumption survives.
- `endurance: marginal` — 12 to 14 completed. The seven-layer sweep fits with no margin for retries or `read_artifact` paging. Proceed, but the playbook must be budgeted call-by-call and the scorecard's `tool_limit` cause-of-death watched closely.
- `endurance: fail` — fewer than 12 completed and the ceiling is not raisable. **Verdict: the native front door is capped below the diagnostic sweep. The Task 12 gate is effectively pre-decided toward the custom harness, and the whole Phase 1a native build is avoided.**

Record explicitly whether the stop was attributable to the instance property (Task 3) or something else — `max_auto_executions` was set to 20 in Task 7 Step 6 precisely to exclude the per-m2m cap.

- [ ] **Step 6: Commit**

```bash
git add docs/PREFLIGHT_FINDINGS.md
git commit -m "docs: E2 pre-flight — native ReAct loop endurance over 15 tool calls"
```

---

## Task 10: E3 — Data Model Confirmation

**Files:**
- Modify: `docs/PREFLIGHT_FINDINGS.md` (E3 section)

**Interfaces:**
- Consumes: execution sys_ids from Tasks 8 and 9.
- Produces: a confirmed-or-corrected LLD §2.1 mapping.

The runs from Tasks 8 and 9 left fresh execution records. Reading them validates LLD §2.1 against an execution **we caused**, rather than only against the 2026-07-18 archaeology and the single reference failure `78f347b72f198310f824ac1bcfa4e3bd`.

- [ ] **Step 1: Read the execution plan row**

```json
{"table": "sn_aia_execution_plan", "query": "sys_id=<E2 execution sys_id>",
 "displayValue": "all", "limit": 1}
```

Record every populated field. Compare against LLD §2.1's documented mapping.

- [ ] **Step 2: Read the task tree**

```json
{"table": "sn_aia_execution_task", "query": "execution_plan=<E2 execution sys_id>",
 "displayValue": "all", "limit": 100}
```

- [ ] **Step 3: Read the tool executions**

```json
{"table": "sn_aia_tools_execution", "query": "execution_plan=<E2 execution sys_id>",
 "displayValue": "all", "limit": 100}
```

If `execution_plan` is not the linking field, find the real one from the field list returned and record the correction — LLD §2.1 depends on this join and `PaToolAgentTrace` is built directly on it.

- [ ] **Step 4: Read the messages**

```json
{"table": "sn_aia_message", "query": "execution_plan=<E2 execution sys_id>",
 "displayValue": "all", "limit": 100}
```

Record the message roles present. LLD §1 establishes that the root cause of the reference failure sat in an agent-role message — confirm that role vocabulary matches on a run we generated.

- [ ] **Step 5: Record the result**

Write into the E3 section: each table, its row count, its linking field, and whether LLD §2.1's mapping held. List every discrepancy as a required LLD correction. No verdict attaches to E3 — it does not gate anything. It de-risks `PaToolAgentTrace` before it is written.

- [ ] **Step 6: Commit**

```bash
git add docs/PREFLIGHT_FINDINGS.md
git commit -m "docs: E3 pre-flight — LLD 2.1 mapping confirmed against a fresh execution"
```

---

## Task 11: Cleanup

**Files:**
- Modify: `docs/PREFLIGHT_FINDINGS.md` (Cleanup section)

**Interfaces:**
- Consumes: every sys_id in the "Created records" section.
- Produces: confirmation of deletion.

**Run this task even if Tasks 8, 9, or 10 aborted.** The commit-as-you-create discipline in Task 7 exists so that this task can always run.

- [ ] **Step 1: Delete in reverse dependency order**

Load the delete tool first:

```
ToolSearch: select:mcp__foundry__servicenow_table_delete
```

Then delete, in this order, using the sys_ids recorded in the "Created records" section:

1. `sn_aia_agent_tool_m2m` — the attachment
2. `sn_aia_tool` — `pa_probe_context`
3. `sn_aia_agent` — `PA Probe Agent`

Reverse dependency order matters: deleting the agent first can orphan or block the m2m row.

If Task 7 created a team, use case, trigger, or wiring record (it does not in this plan — `servicenow_aia_execute` fires the agent directly), delete those first, ahead of the m2m.

- [ ] **Step 2: Verify nothing remains**

```json
{"table": "sn_aia_agent", "query": "nameLIKEPA Probe", "fields": ["name", "sys_id"], "limit": 10}
```
```json
{"table": "sn_aia_tool", "query": "nameLIKEpa_probe", "fields": ["name", "sys_id"], "limit": 10}
```

Both must return zero rows. If either returns a row, record the failure and the sys_id prominently — an undeleted probe agent on a shared instance is a loose end that must not be left silently.

- [ ] **Step 3: Record the retention decision**

Execution rows from E1/E2 are **retained** per the spec: read-only history, harmless on a dev instance, and a useful known-answer reference for the trace tool. Record every retained execution sys_id in the Cleanup section so the retention is deliberate and reversible.

- [ ] **Step 4: Commit**

```bash
git add docs/PREFLIGHT_FINDINGS.md
git commit -m "docs: probe agent deleted; execution rows retained by decision"
```

---

## Task 12: Verdict and LLD Disposition

**Files:**
- Modify: `docs/PREFLIGHT_FINDINGS.md` (Verdict and LLD §8 disposition sections)
- Modify: `docs/LOW_LEVEL_DESIGN.md` (§8 only)
- Modify: `DESIGN.md` (§4 "Rulings during implementation" only)

**Interfaces:**
- Consumes: every finding from Tasks 2–10.
- Produces: a go/no-go statement that `docs/IMPLEMENTATION_PLAN.md` Task 1 depends on.

- [ ] **Step 1: Fill the verdict section**

Write a go/no-go statement against the spec §5 falsification table. Every row must be addressed explicitly. A row that could not be tested is recorded as **carried forward with its reason**, never as a pass.

- [ ] **Step 2: Mark each LLD §8 item**

Edit `docs/LOW_LEVEL_DESIGN.md` §8. For each of the ten items, append either `— CLOSED (Phase 0): <value>` or `— CARRIED FORWARD: <reason>`. Items 1, 3, 4, 5, 6, 9, and 10 are addressed by this plan. Items 2, 7, and 8 are not in Phase 0 scope and stay open — mark them `— not in Phase 0 scope`.

- [ ] **Step 3: File design changes as rulings**

For every finding that changes the design, append an entry to `DESIGN.md` §4, which exists for exactly this. At minimum, file:

- The P4b tooling gap and the resulting carry-forward.
- The E1 keying decision (or its absence).
- The E2 endurance result and what it implies for the Task 12 gate.
- **The transferability requirement from spec §6**, stated as a binding constraint on the future benchmark: the scorecard must record which `continuous_tool_execution_limit` value each run executed under, and if that differs from the OOB default recorded in Task 3, `benchmark/DECISION.md` must say so explicitly. Filing it as a ruling now is what keeps it from being lost between Phase 0 and `IMPLEMENTATION_PLAN.md` Task 11.

Each ruling states the finding, the change, and the date.

- [ ] **Step 4: Set the findings status**

Change the header `**Status:** in progress` to `**Status:** complete — <go | no-go | conditional>`.

- [ ] **Step 5: Commit**

```bash
git add docs/PREFLIGHT_FINDINGS.md docs/LOW_LEVEL_DESIGN.md DESIGN.md
git commit -m "docs: Phase 0 verdict — LLD section 8 disposition and design rulings"
```

---

## Verification

Phase 0 produces no code, so there is no test suite. It is complete when all of the following hold:

1. `docs/PREFLIGHT_FINDINGS.md` has no `_Pending._` markers left.
2. Every row of the spec §5 falsification table has an explicit verdict or a recorded carry-forward reason.
3. `sn_aia_agent` and `sn_aia_tool` queries for the probe names both return zero rows (Task 11 Step 2).
4. `docs/LOW_LEVEL_DESIGN.md` §8 has a disposition on all ten items.
5. `DESIGN.md` §4 contains at least the three rulings named in Task 12 Step 3.

Only then does `docs/IMPLEMENTATION_PLAN.md` Task 1 become eligible to start.
