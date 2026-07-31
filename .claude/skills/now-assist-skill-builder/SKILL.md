---
name: now-assist-skill-builder
description: "For creating skills via Fluent DSL, read the golden example: `.claude/context/sdk-examples/now-assist-skill.now.ts`. This skill covers Skill Kit architecture, evaluation, and runtime testing."
scope: project
recommended: false
version: 2.1.0
---
# Skill: Now Assist Skill Builder

> For creating skills via Fluent DSL, read the golden example:
> `.claude/context/sdk-examples/now-assist-skill.now.ts`.
> This skill covers Skill Kit architecture, evaluation, and runtime testing.

> **Path resolution:** `.claude/context/...` paths in this skill assume a
> Foundry-MCP-provisioned project (`foundry_init` / `foundry_add`). When this
> skill runs from the Foundry Claude Code plugin instead, the same files live
> under `${CLAUDE_PLUGIN_ROOT}/context/...` — read whichever path exists.

---

## Purpose

This skill provides guidance on Now Assist Skill Kit architecture, evaluation
metrics, programmatic invocation, and testing strategies. It does NOT cover
skill creation — use the `NowAssistSkillConfig` Fluent DSL for that.

## When to Use

Use this skill when you need to:
- Understand the Skill Kit architecture and its components
- Evaluate skill quality using ServiceNow's built-in metrics
- Invoke skills programmatically from server-side scripts
- Test and validate deployed skills

---

## Skill Kit Architecture (Zurich+)

The Now Assist Skill Kit is a no-code/low-code tool for building custom skills.

### Navigation

All > Now Assist Skill Kit

### Components

| Component | Description |
|-----------|-------------|
| **Provider** | LLM provider configuration |
| **Prompt** | System and user prompt templates |
| **Tools** | Tool definitions the skill can use (InlineScript, Script, Subflow, FlowAction, WebSearch, Skill, Decision) |
| **Retriever** | Knowledge retrieval configuration (RAG) |
| **Input/Output Schema** | Structured data definitions |

### Retriever Configuration (RAG Skills)

- **Data source**: Knowledge base, table, or custom source
- **Chunking strategy**: Configure chunk size and overlap
- **Embedding model**: Select embedding provider
- **Top-K results**: Number of chunks to retrieve

### Deployment Touchpoints

Where skills can be invoked after deployment:
- Now Assist Panel (sidebar)
- Virtual Agent conversations
- Flow Designer actions
- Scripted invocations via `sn_one_extend.OneExtendUtil.execute()`
- Context menu items
- Agentic workflows (as Now Assist skill tool type)

### Security Controls — Role Access (`securityControls`)

`securityControls` is required and needs `userAccess` plus at least one of `roleMap` or `roleRestrictions` (neither may be empty `[]`):

- **`roleMap` (preferred)** — role **names** (e.g. `roleMap: ['itil']`). Requires SDK 4.7.0+ and instance Zurich P10 / Australia P3+. Written as `sys_agent_access_role_mapping` rows whose update XML carries the name as resolution metadata, so the platform resolves the correct sys_id on the target instance at install. Stable record identity across rebuilds.
- **`roleRestrictions` (pre-ZP10 fallback)** — direct role **sys_id strings** (legacy `role_list` column), e.g. `roleRestrictions: ['282bf1fac6112285017366cb5f867469']` (itil; OOB role sys_ids are identical on every instance — verify custom roles on the target).
- **`userAccess.roles`** (the `type: 'roles'` variant) — direct sys_id strings only.

**Never `Now.ref('sys_user_role', ...)` in any of these fields.** It builds clean but the build drops the lookup key and writes a random phantom GUID per occurrence per build — the role silently never applies (issues #188/#194, verified on SDK 4.8.1 and 4.9.0; Build Rule #21). See `.claude/context/sdk-examples/now-assist-skill.now.ts` Examples 1 (roleMap) and 4 (fallback).

### Script Tools — `scriptId` (`tools: (t) => t.Script(...)`)

`scriptId` takes a **direct sys_id string only** — never `Now.ref('sys_script_include', {name})`. The ref form builds clean but emits a random phantom GUID per build into the capability metadata with the script include name retained **nowhere**, and the platform resolves `scriptId` strictly by sys_id (`global.ScriptDetails` — no name fallback), so nothing can repair it at install: the tool silently points at a nonexistent Script Include (issue #196, live-verified on gpinst01; Build Rule #33). The churning GUID also duplicates the skill's `sys_gen_ai_feature_mapping`/`sys_gen_ai_strategy_mapping` records on every redeploy. Custom Script Include sys_ids are instance-specific — look the sys_id up on the target instance and hardcode it (or ship a `REPLACE_WITH_..._SYS_ID` placeholder). See `.claude/context/sdk-examples/now-assist-skill.now.ts` Example 2.

---

## Prompt Authoring (Skill Kit)

A skill's prompt lives in the **second** argument to `NowAssistSkillConfig` —
`promptConfig.providers[].prompts[].versions[]` — separate from the definition
(inputs, tools, security) in the first argument. Read
`.claude/context/sdk-examples/now-assist-skill.now.ts` for the full shape; this
section is the authoring guidance layered on top of what that golden example does.

For general prompt craft — system/user anatomy, few-shot pairs, chain-of-thought,
output-format discipline — the canonical repo docs are
`.claude/context/prompt-engineering-patterns.md` and
`.claude/context/agent-instruction-templates.md`. They target AI Agents, but the
prompt-writing patterns transfer; reuse them by reference rather than re-deriving
here.

### Prompt version shape

The Skill Kit **Prompt** component conceptually separates system and user templates
(see Skill Kit Architecture above). In the Fluent `NowAssistSkillConfig` DSL, the
golden example expresses each prompt version as a **single composed template
function** that carries the model binding alongside it:

| Field | Role | Golden-example values |
|-------|------|-----------------------|
| `model` | Model identifier for this prompt version | `'llm_generic_small'` |
| `temperature` | Sampling temperature | `0.1`–`0.3` (low = more deterministic) |
| `maxTokens` | Output token budget | `300`–`800` |
| `promptState` | `'draft'` or `'published'` | `'published'` |
| `prompt` | `(p) => \`template\`` returning ONE string | see below |

`promptState: 'published'` requires the skill's `state: 'published'` as well — set
both or leave both draft (Build Rule #16).

### Wiring inputs and tool outputs into the template

The `prompt` function receives a `p` accessor with two interpolation forms, and the
distinction is load-bearing:

- **Skill inputs:** `p.input['name']` — **bracket** notation, because input names
  may contain spaces (Build Rule #14). A `json_object` input arrives as a
  **serialized JSON string**, not an object; you cannot `JSON.parse()` it in the
  template (Build Rule #13 forbids function calls in Fluent template literals) —
  parse it inside a Script/InlineScript tool if you need individual fields
  (golden-example Example 4).
- **Tool outputs:** `p.tool.ToolName.output` — **dot** notation only; bracket
  notation breaks the plugin transform (Build Rule #14). It is emitted verbatim as
  `{{ToolName.output}}`, and the runtime resolves it by TOOL NAME — so a tool's
  `tools()` return key MUST equal its name and both must be space-free identifiers,
  or the placeholder interpolates EMPTY (no build warning) and the model answers
  from nothing (Build Rule #39). This is why every tool in the golden example is
  CamelCase.

### The tool graph feeds the prompt

A skill prompt is only as good as the data staged before it. The `tools()` factory
builds a graph (types: InlineScript, Script, Subflow, FlowAction, WebSearch, Skill,
Decision — see Skill Kit Architecture) whose outputs the prompt reads. Authoring
pitfalls that silently produce empty interpolations, and therefore a hallucinating
model:

- **InlineScript tools get NO input binding** — reference skill inputs as
  `{{internal_name}}` templates inside the script text, never `inputs.<name>`
  (Build Rule #37).
- **Input names underscore-normalize at runtime** — `'incident record'` becomes
  `{{incident_record}}` in templates and payload keys (Build Rule #38).
- **Decision branch conditions must be script conditions** — the structured
  `{ field, operator, value }` form never fires (Build Rule #36), and Decision
  `targets` must name real tools in the graph or the sentinel `'_end'`
  (Build Rule #35).

Standard outputs (`response`, `provider`, `errorcode`, `status`, `error`) are
auto-generated — declare `outputs` only for ADDITIONAL custom outputs (Build Rule
#22).

---

## Provider Selection — Instance-Dependent (Demo PDI Gotcha)

The `provider` string in `NowAssistSkillConfig.promptConfig.providers[]` (e.g. `'Now LLM Service'`)
is a **free-form display name resolved at runtime** against the instance's active provider subflows.
The Fluent type system does **not** validate it at build time — a skill that names an unavailable
provider builds clean and only fails at execution.

**The failure mode:** when the named provider's backing subflow is inactive, execution fails with
**"Plan invalid or not created"** *(confirm the exact string on instance during build)*. This is
commonly mistaken for a skill-logic bug and wastes hours.

**Why it bites on demo PDIs / dev instances:** `'Now LLM Service'` maps to subflows that are often
**inactive** out of the box (verified inactive on gpinst01: "Now LLM Integration" and "Execute Now
LLM" `active=false`; what was active there was "Now LLM LTS Integration"). Do **not** assume a
specific BYOLLM fallback is available — "Amazon Bedrock Chat Completions" was **also** inactive on
gpinst01. There is no universally-safe fallback provider to hardcode.

**UI-discovery workflow (authoritative):** in **Now Assist Skill Kit**, the **Provider** dropdown
lists only **active** providers for that instance. Pick the provider string from there rather than
copying `'Now LLM Service'` blindly.

**Authoring-time preflight (which Now LLM subflows are active):**
```
GET /api/now/table/sys_hub_flow?sysparm_query=nameLIKENow LLM^active=true&sysparm_fields=name,active
```

> For the **runtime** provider health check at test time (per-capability `api.active`), see the
> Testing Checklist → **Step Zero: Provider Health Check** below (#150).

---

## Provider & Model Configuration (BYOLLM)

> This section is about WHICH provider/model to bind and how the binding works.
> For the instance-availability gotcha — why `'Now LLM Service'` may fail at
> runtime and how to discover which providers are actually active — see
> **Provider Selection — Instance-Dependent** above.

Zurich supports Bring Your Own LLM. The providers the GenAI framework documents:

| Provider | Connection | Default model |
|----------|-----------|---------------|
| Azure OpenAI | `https://{resource}.openai.azure.com` | GPT-4 |
| Amazon Bedrock | IAM user with `bedrock:InvokeModel` | Amazon Titan |
| Google Vertex AI | Vertex AI endpoint | Gemini |
| Now LLM Service | ServiceNow-hosted | Now LLM |

Custom providers are added via custom transformers that translate request/response.
Provider connections are configured at **Now Assist Admin → LLM Configuration**.

**Provider strings in Fluent (4.9.0):** the golden example uses `'Now LLM Service'`.
SDK 4.9.0 additionally documents the NASK provider strings `'Now LLM LTS Generic'`,
`'Google Cloud Vertex AI'`, and `'Amazon Bedrock'`. The `provider` string is a
free-form display name resolved at runtime, not build-validated (see Provider
Selection above).

**Where the model binding lives:** `model` / `temperature` / `maxTokens` are set per
prompt version in the Fluent DSL (see Prompt Authoring). At the platform level the
model and token budget are bound **per One Extend capability definition**
(`sys_one_extend_capability_definition.connection`, via a GenAI alias such as
`sn_generative_ai.Now_LLM`); the `sys_one_extend_capability` record itself has no
model field, and there is no ad-hoc per-request or instance-wide model/temperature/
`max_tokens` override.

**Constraints to design around:**
- Only **one provider can be default per capability** at a time.
- Capabilities from other Now Assist applications use Now LLM Service and **cannot
  be reconfigured**.
- Web Search augmentation is **not supported by Azure OpenAI**; Dynamic Translation
  is not available for Virtual Agent or Now Assist Panel capabilities.
- The GenAI Controller supports **text generation only** (no image/audio).

---

## Evaluation

Navigation: All > Now Assist Skill Kit > Agentic Evaluations

### Metrics

| Metric | Scale | Description |
|--------|-------|-------------|
| Overall Task Completeness | 0-100% | Percentage of tasks fully completed |
| Task Completeness (per record) | 1-3 | 3=Successful, 2=Partial, 1=Unsuccessful |
| Tool Performance | 0-1 | 1=Correct tool chosen, 0=Wrong tool |
| Tool Calling | 0-1 | Input key completeness AND value correctness AND format correctness |

### Threshold Interpretation

| Range | Label | Recommendation |
|-------|-------|----------------|
| 90-100% | Excellent | Proceed with confidence |
| 70-89% | Good | Deploy with caution |
| 50-69% | Moderate | Investigate root causes |
| 0-49% | Poor | **Do not deploy** |

### Skill-Kit-specific evaluation glue

The full evaluation workflow — guided setup, dataset generation, custom-metric
scripting, and result interpretation — lives in
`.claude/skills/servicenow-ai-evaluation/SKILL.md` (Skill Kit and AI Agent
evaluations share the same **Now Assist Skill Kit → Agentic Evaluations**
framework). Read it rather than re-deriving the process; the metric and threshold
tables above are the quick reference. What is specific to a Skill Kit skill:

- **Tool Performance / Tool Calling** metrics score the skill's `tools()` graph —
  whether the right tool was chosen and whether its input keys, values, and format
  were correct. A skill that interpolates empty tool output (Build Rule #39) or
  falls through a dead Decision branch (Build Rules #35–#36) surfaces here, not as a
  prompt-quality problem — check `sys_generative_ai_log.prompt` to confirm the
  rendered prompt actually contained the tool data.
- **Custom metrics must be published** before they appear in evaluation setup, and
  they read execution data via the Agentic Evaluation Parser Tool output — see the
  evaluation skill for the parser-output structure.
- **Run evaluations only after Step Zero (Provider Health Check) passes** — an
  inactive provider subflow fails execution before any metric is meaningful.

---

## Programmatic Skill Invocation

Invoke a deployed skill from server-side scripts via `sn_one_extend.OneExtendUtil`. Production
platform code that targets a **specific skill configuration** passes a `meta.skillConfigId` inside
each `executionRequests[]` entry — alongside `capabilityId` and `payload` — yet most examples omit
it. Include it:

```javascript
// Server-side skill invocation. Two IDs, two jobs (see below).
var capabilityId = 'your_capability_sys_id';    // sys_one_extend_capability.sys_id
var skillConfigId = 'your_skill_config_sys_id'; // Now Assist Skill Kit skill-config sys_id

var request = {
  executionRequests: [{
    capabilityId: capabilityId,                     // sys_one_extend_capability.sys_id
    payload: { query: 'Summarize this incident' },  // key matches your skill's input name
    meta: { skillConfigId: skillConfigId }          // selects the skill configuration
  }]
};
var resp = sn_one_extend.OneExtendUtil.executeSecure(request);

// Response is keyed by capabilityId — read the per-capability result defensively.
var result = resp && resp.capabilities && resp.capabilities[capabilityId];
var answer = (result && typeof result.response === 'string') ? result.response : '';
```

**The two IDs are different records with different jobs:**

| ID | Comes from | Role |
|----|-----------|------|
| `capabilityId` | `sys_one_extend_capability.sys_id` | Selects the model-bound One Extend capability to execute |
| `meta.skillConfigId` | the Now Assist Skill Kit skill-config record | Selects **which skill configuration** of that capability to run |

Find them: open **Now Assist Skill Kit** → your skill to get the **skillConfigId** (the skill-config
record's `sys_id`); the **capability** record is linked from the skill-config form, giving the
**capabilityId**.

> **`execute()` vs `executeSecure()`:** both exist and work. `executeSecure()` runs the invocation
> under ACL enforcement — prefer it in scoped or ACL-sensitive contexts. `execute()` is **not**
> broken; it is just the non-ACL-enforced mode. (Platform code uses both: live counts show ~20
> Script Includes calling `execute()` and ~15 calling `executeSecure()`.)

---

## Testing Checklist

After deploying a skill (via Fluent DSL build+install or Skill Kit UI):

### Step Zero: Provider Health Check (run this *before* anything else)

Before debugging skill logic, confirm the capability's backing provider subflow is actually active.
An inactive subflow produces a **"Plan invalid or not created"** error *(confirm exact string on
instance during build)* at execution time — which looks like a skill bug but is really a provider
availability problem, and burns hours if you chase it as a logic issue.

1. **Preflight (REST):**
   ```
   GET /api/now/table/sys_one_extend_capability_definition?sysparm_query=capability={capabilityId}&sysparm_fields=name,api.active,api.name,connection.name
   ```
   If `api.active=false`, the backing subflow is inactive and `executeSecure()` will fail — fix the
   provider before touching skill logic. (See #153 for choosing the right provider at authoring time.)
2. The **default** definition is the `sys_one_extend_definition_config` row where
   `active=true^default=true` for the capability.
3. ⚠️ `api.active` is a **dot-walk** through the `api` `document_id` to `sys_hub_flow.active` — it is
   **REST-only**. GlideScript `getValue('api.active')` returns **null**; do not implement this check
   as a Script Include.

### Functional checks

- [ ] Provider health check passes (`api.active=true` for the default definition — see Step Zero)
- [ ] Skill appears in Now Assist Admin > Skills
- [ ] Input validation rejects invalid data
- [ ] Successful execution with valid test input
- [ ] Output matches expected schema
- [ ] Error handling returns meaningful messages
- [ ] Performance is acceptable (check response time)
- [ ] Security controls restrict access to intended roles
- [ ] Evaluation metrics meet deployment thresholds (see above)

### Quick Test via Scripts - Background

```javascript
// Verify a deployed skill responds correctly
var capabilityId = 'your_capability_sys_id';     // sys_one_extend_capability.sys_id
var skillConfigId = 'your_skill_config_sys_id';  // Now Assist Skill Kit skill-config sys_id
var resp = sn_one_extend.OneExtendUtil.executeSecure({
    executionRequests: [{
        capabilityId: capabilityId,
        payload: { /* test data matching your input schema */ },
        meta: { skillConfigId: skillConfigId }
    }]
});
var result = resp && resp.capabilities && resp.capabilities[capabilityId];
gs.info('Test result: ' + JSON.stringify(result, null, 2));
```

---

## Tips

- Start with a narrow scope and expand iteratively
- Use low temperature (0.1-0.3) for consistent, deterministic outputs
- Include few-shot examples in prompts for complex tasks
- Run agentic evaluations before promoting to production
- Use `depends[]` in the tool graph to control execution order
- Log skill executions for debugging via `gs.info()` in inline scripts
