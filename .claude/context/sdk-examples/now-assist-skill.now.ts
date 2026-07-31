/**
 * RUNTIME-VALIDATED — Built with SDK 4.8.1 + 4.9.0, installed on gpinst01
 *   (Zurich P10 HF3) from a scratch scope, and ALL FOUR skills executed
 *   end-to-end against the live Now LLM provider on 2026-07-17 (issue #202):
 *   real LLM completions returned; Example 2's Script tools ran a real
 *   Script Include (sys_id substituted for the placeholder — completes the
 *   #196 remediation at runtime); Decision branching verified in BOTH
 *   directions (high-risk change → 'HighRiskAnalysis', standard change →
 *   default 'StandardAnalysis') via syslog markers from the branch tools.
 *   Runtime-REFUTED behaviors found and fixed in this file:
 *     1. InlineScript `inputs.<name>` access — never bound; use {{...}}
 *        templates in the script text (Example 1).
 *     2. Structured Decision conditions ({field,operator,value}) — emitted
 *        edge lacks applicability_script, branch never fires; use a script
 *        condition (Example 2).
 *     3. Payload keys / template refs use the input's INTERNAL
 *        (underscore-normalized) name, not the spaced display name.
 *     4. Skills install DEACTIVATED (config_status.active=false, no Fluent
 *        field for it) — must be activated post-install before execution.
 *     5. Prompt tool references (p.tool.X.output) are emitted VERBATIM as
 *        {{X.output}} where X is the tools() RETURN KEY, but the runtime
 *        resolves templates by TOOL NAME — mismatched key/name interpolates
 *        as empty and the LLM hallucinates. Tool names are now space-free
 *        identifiers equal to their return keys.
 *   Data-Policy drop check (Build Rule #34): all 130 payload records landed;
 *   zero silent drops (plus 2 install-generated sys_security_acl_role rows).
 *   ⚠️ Rename corollary: NASK resource-mapping/edge identity derives from the
 *   tool NAME (not $id) — renaming tools regenerates those records, and
 *   installing the renamed app OVER the old install left the OneExtend engine
 *   silently skipping the decision's condition script (every run took one
 *   branch unconditionally). Full app UNINSTALL + fresh install restored
 *   correct evaluation. After renaming NASK tools, uninstall before
 *   reinstalling.
 * Updated 2026-07-17 (issue #194): securityControls role handling rewritten and
 *   re-validated on SDK 4.8.1 + 4.9.0. `Now.ref('sys_user_role', ...)` in
 *   `roleRestrictions` and `userAccess.roles` has the SAME phantom-GUID defect as
 *   the AIA family (issue #188 / Build Rule #21): the build emits a random GUID
 *   per occurrence per build with no lookup key, so the role silently never
 *   applies. Examples 1–3 now use `roleMap` (role NAMES, resolved on the target
 *   instance; SDK 4.7.0+, instance Zurich P10 / Australia P3+). Example 4 shows
 *   the pre-ZP10 fallback: `roleRestrictions` with direct sys_id strings.
 * Updated 2026-07-17 (issue #196): Script tool `scriptId` switched from
 *   `Now.ref('sys_script_include', ...)` to a direct sys_id placeholder.
 *   The Now.ref form has the same phantom-GUID defect as #188/#194 and is
 *   UNREPAIRABLE at install: the script include name is retained nowhere in
 *   the emitted capability metadata, and the platform resolves scriptId by
 *   sys_id only (no name fallback). Live-verified on gpinst01: the phantom
 *   GUID installs verbatim, pointing at a nonexistent Script Include,
 *   silently. See Build Rule #33.
 * Updated 2026-07-17 (issue #200): Example 2 Decision targets rewritten. Decision
 *   `targets` must be the NAMES of other tools in the same tools() graph (or the
 *   sentinel '_end' = route to the skill prompt). The previous free-form labels
 *   ('high_risk_path'/'standard_path') matched no tool, so the build emitted
 *   TS210 warnings and SKIPPED the branch edge records — the decision routed
 *   nowhere at runtime. NOT a 4.9.0 behavior change: 4.8.1 emits the identical
 *   warnings on an isolated build (plugin edge-resolution code is identical).
 *   The build auto-adds `depends: [<decision>]` to each target tool.
 * Updated 2026-04-30: Fixed NowAssistSkillPlugin warnings and a masked build error:
 *   5. Prompt tool access changed from bracket to dot notation:
 *      `p.tool['name']['output']` → `p.tool.name.output`. The NowAssistSkillPlugin
 *      does not support ElementAccessExpressionShape (bracket notation) for tool
 *      references in prompt templates.
 *   6. Added `tableSysId` to glide_record inputs that also have `testValues`.
 *      The SDK requires tableSysId when testValues is set on a glide_record input.
 *      This error was masked by the plugin warning in earlier builds.
 *
 * Required changes from the 4.5.0 shape (items 1–4 below; items 5–6 added later):
 *   1. deploymentSettings.uiAction needs its own `$id` (it generates a
 *      sys_ui_action record).
 *   2. nowAssistPanel.roles[] should include 'now_assist_panel_user' (warned
 *      otherwise; users may not be able to invoke the skill in the panel).
 *   3. Script tool config requires `$capabilityId` (ExplicitKey) in addition
 *      to `$id`. The capabilityId identifies the underlying skill capability
 *      record.
 *   4. Decision condition operators are now restricted to 'is' | 'is not'.
 *      For comparison logic (>=, <, etc.), pre-compute a categorical value
 *      (e.g. 'high'/'medium'/'low') in an upstream Script tool and compare
 *      on that here.
 *
 * Golden Example: NowAssistSkillConfig — Now Assist Skills Kit skill
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/now-assist-skill-config
 * Import:   import { NowAssistSkillConfig } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - Two-argument pattern: (definition, promptConfig) for IntelliSense
 *   - definition: $id, name, securityControls, inputs[], outputs[], tools(), state, skillSettings, deploymentSettings
 *   - promptConfig: providers[] with prompts[] and model/temperature/maxTokens
 *   - Tool types: InlineScript, Script, Subflow, FlowAction, WebSearch, Skill, Decision
 *   - Tool graph with depends[] for execution ordering
 *   - Return tool handles from tools() to reference outputs in prompts
 *   - Input data types: 'string' | 'boolean' | 'numeric' | 'glide_record' (requires tableName)
 *                       | 'simple_array' | 'json_object' | 'json_array' (4.6.0+ expanded set)
 *   - 4.6.0+: Standard outputs (response, provider, errorcode, status, error) are
 *     auto-generated when `outputs` is omitted. Define `outputs` only for ADDITIONAL
 *     custom outputs beyond the standard set.
 *   - Prompt template accesses: p.input['name'] (brackets, because names have spaces), p.tool.ToolName.output (dot notation required)
 *
 * Build rules (learned from SDK validation):
 *   - MUST import '@servicenow/sdk/global' for Now.ID, Now.ref, etc.
 *   - securityControls.userAccess must be an OBJECT with $id and type, not a plain string
 *   - securityControls needs at least one of `roleMap` (role names; ZP10/AP3+,
 *     SDK 4.7.0+ — preferred) or `roleRestrictions` (direct sys_id strings;
 *     pre-ZP10 fallback). Neither may be an empty [].
 *   - NEVER Now.ref('sys_user_role', ...) in userAccess.roles / roleRestrictions —
 *     builds clean but writes a phantom random GUID (issues #188/#194, Build Rule #21)
 *   - NEVER Now.ref('sys_script_include', ...) in Script tool scriptId — same phantom-GUID
 *     defect, and the name is retained nowhere so install cannot repair it. Use a direct
 *     sys_id string (issue #196, Build Rule #33)
 *   - Input names must NOT contain underscores — use spaces (e.g., 'incident record' not 'incident_record')
 *   - testValues must be a string, not string[] (e.g., 'INC0010001' not ['INC0010001'])
 *   - Tool return must use explicit property assignment (e.g., { FetchIncidentDetails: fetchDetails })
 *   - Tool names MUST be space-free identifiers and the tools() return keys MUST
 *     equal the tool names. p.tool.<key>.output is emitted verbatim as
 *     {{<key>.output}} and the runtime resolves it by TOOL NAME — if they differ,
 *     the prompt interpolates EMPTY (no build warning) and the LLM answers from
 *     nothing (#202). (The runtime template engine itself accepts spaced names —
 *     '{{FetchChangeDetails.output}}' in Script-tool input values and
 *     context.getValue('<Tool Name>.output') both resolve — the constraint comes
 *     from the prompt sugar emitting the handle key.)
 *   - Prompt tool access must use dot notation: p.tool.name.output (bracket notation causes plugin warnings)
 *   - If any prompt has promptState: 'published', the skill must have state: 'published'
 *   - Do not use tableSysId with Now.ref to sys_db_object — just use tableName
 *   - Decision `targets` must be NAMES of tools in the same tools() graph, or '_end'
 *     (routes to the skill prompt). Unresolved names warn (TS210) and the branch
 *     edges are silently dropped — the decision routes nowhere (#200). Target tools
 *     get `depends: [<decision>]` auto-added; don't declare it on them yourself.
 *   - In `branches[].to` / `default`, use string literals — `targets[0]` element
 *     access is unsupported by the extractor and the branch metadata is dropped
 *     silently (no warning; edge loses its name/order/condition) (#200).
 *   - Decision branch conditions MUST be script conditions ({ script: ... },
 *     signature (currentInputs, context) → boolean, read upstream output via
 *     context.getValue('<Tool Name>.output')). The structured
 *     { field, operator, value } form emits a condition-expression edge without
 *     an applicability_script and the engine never takes the branch (#202).
 *   - InlineScript tools get NO input binding — reference skill inputs as
 *     {{internal_name}} templates inside the script text (#202).
 *   - Runtime payload keys and {{...}} references use the input's internal name:
 *     spaces in the Fluent `name` become underscores (#202).
 *   - Skills install with config_status active=false; activate post-install or
 *     execution fails with a permission error (#202).
 */

import '@servicenow/sdk/global'
import { NowAssistSkillConfig } from '@servicenow/sdk/core'

// ===========================================================================
// ⚠️ PROVIDER AVAILABILITY IS INSTANCE-DEPENDENT (read before building)
//
// All examples below hardcode provider: 'Now LLM Service'. The `provider` string
// in promptConfig.providers[] is a free-form DISPLAY NAME resolved at RUNTIME
// against active provider subflows — the Fluent type system does NOT validate it
// at build time, so a wrong/unavailable provider builds clean and fails only at
// execution with "Plan invalid or not created" (confirm exact string on instance).
//
// 'Now LLM Service' maps to a subflow that is INACTIVE on many PDIs / dev
// instances (verified inactive on gpinst01: "Now LLM Integration" and "Execute
// Now LLM" subflows active=false). Do NOT assume a specific BYOLLM fallback is
// available either — Amazon Bedrock was also inactive on gpinst01.
//
// Discover the correct string from the UI: Now Assist Skill Kit → Provider
// dropdown lists only ACTIVE providers. Preflight the backing subflows with:
//   GET /api/now/table/sys_hub_flow?sysparm_query=nameLIKENow LLM^active=true&sysparm_fields=name,active
// See skills/now-assist-skill-builder/SKILL.md → "Provider Selection" and the
// runtime "Provider Health Check" (Testing Checklist, Step Zero).
//
// MULTI-INPUT / json_object NOTE (see Example 4):
//   - `json_object` is a valid input dataType. In the prompt template it arrives
//     as a SERIALIZED JSON STRING — p.input['name'] yields the string; JSON.parse()
//     it inside a tool script if you need individual fields.
//   - Use descriptive input names (e.g. 'query', 'context'). There is NO magic
//     'inputjson' convention.
//   - ⚠️ RUNTIME PAYLOAD KEYS use the input's INTERNAL name: the platform
//     stores the Fluent `name` as the display label and derives the internal
//     name by replacing spaces with underscores (input 'change record' →
//     label 'change record', name 'change_record'). Invocation payload keys
//     must match the INTERNAL name — {"change_record": ...}, not
//     {"change record": ...} (runtime-verified on gpinst01, #202: the space
//     form fails with "Mandatory attributes missing in the input:
//     change_record"). Same rule for {{...}} template references in tool
//     scripts and script conditions ({{incident_record}} resolves; the space
//     form resolves to an empty string).
//   - ⚠️ A missing mandatory input is only REJECTED when the input has no test
//     value. If the input declares `testValues`/`tableSysId`, a missing (or
//     wrong-keyed) payload key is absorbed SILENTLY — the tool runs against
//     the fallback, returns empty data, and the LLM can hallucinate a
//     plausible answer from nothing (runtime-verified, #202).
// ===========================================================================

// ---------------------------------------------------------------------------
// Example 1: Incident Summary Skill with inline script tool
// ---------------------------------------------------------------------------
export const incidentSummarySkill = NowAssistSkillConfig(
  // Argument 1: Definition
  {
    $id: Now.ID['incident-summary-skill'],
    name: 'Summarize Incident',
    description: 'Generates a concise summary of an incident including timeline, impact, and resolution status',
    shortDescription: 'AI-powered incident summarization',
    state: 'published',

    securityControls: {
      // userAccess.roles takes direct role sys_id strings ONLY. Now.ref would
      // build clean but write a phantom random GUID to sys_security_acl_role
      // (#188/#194). OOB role sys_ids are identical on every instance
      // ('282bf1fa...' = itil); verify custom role sys_ids on the target.
      userAccess: { $id: Now.ID['incident-summary-skill-acl'], type: 'roles', roles: ['282bf1fac6112285017366cb5f867469'] },
      // roleMap takes role NAMES, written as sys_agent_access_role_mapping rows
      // that the platform resolves to the correct sys_id on the target instance.
      // Requires SDK 4.7.0+ and instance Zurich P10 / Australia P3+. For older
      // instances use `roleRestrictions` with direct sys_id strings instead
      // (see Example 4) — never Now.ref in either field.
      roleMap: ['itil'],
    },

    inputs: [
      {
        $id: Now.ID['input-incident-record'],
        name: 'incident record',
        description: 'The incident GlideRecord to summarize',
        mandatory: true,
        dataType: 'glide_record',
        tableName: 'incident',
        testValues: 'INC0010001',
        tableSysId: '00000000000000000000000000000000', // placeholder — replace with a real test record sys_id from your instance
      },
    ],

    outputs: [
      {
        $id: Now.ID['output-summary'],
        name: 'summary',
        description: 'Generated incident summary text',
        dataType: 'string',
      },
    ],

    // Tool graph — fetch data before prompting the LLM
    tools: (t) => {
      // ⚠️ InlineScript tools have NO input binding (the SDK's own types say
      // "InlineScript has NO inputs"). At runtime the script's `inputs` global
      // contains ONLY plumbing (`inputs.inputs._meta`, the script's own source,
      // a feature_invocation_id) — `inputs.<skill input>` is ALWAYS undefined.
      // To read a skill input, embed a `{{...}}` TEMPLATE in the script text;
      // the platform substitutes it before execution. Reference inputs by their
      // INTERNAL name (spaces → underscores: input 'incident record' →
      // {{incident_record}}); the space form resolves to an empty string.
      // RUNTIME-VERIFIED on gpinst01 (#202): `inputs.incident_record` yields
      // undefined → GlideRecord.get(undefined) → all-null tool output → the
      // LLM HALLUCINATES a plausible summary from empty data, flagged
      // __dont_treat_as_error__. Silent-failure family of #188/#196.
      const fetchDetails = t.InlineScript('FetchIncidentDetails', {
        $id: Now.ID['tool-fetch-details'],
        script: `(function() {
          var gr = new GlideRecord('incident');
          gr.get('{{incident_record}}');
          return JSON.stringify({
            number: gr.getValue('number'),
            short_description: gr.getValue('short_description'),
            description: gr.getValue('description'),
            state: gr.getDisplayValue('state'),
            priority: gr.getDisplayValue('priority'),
            assigned_to: gr.getDisplayValue('assigned_to'),
            assignment_group: gr.getDisplayValue('assignment_group'),
            opened_at: gr.getValue('opened_at'),
            comments: gr.getValue('comments_and_work_notes')
          });
        })()`,
      })

      // Return handles so prompts can reference tool outputs
      return { FetchIncidentDetails: fetchDetails }
    },

    deploymentSettings: {
      // 4.6.0+: Now Assist Panel access requires the 'now_assist_panel_user'
      // role in addition to any custom-role restrictions.
      nowAssistPanel: { enabled: true, roles: ['itil', 'now_assist_panel_user'] },
      // 4.6.0+: uiAction needs its own $id (it generates a sys_ui_action record).
      uiAction: { $id: Now.ID['incident-summary-ui-action'], table: 'incident' },
      flowAction: true,
    },
  },

  // Argument 2: Prompt configuration
  {
    providers: [
      {
        provider: 'Now LLM Service',
        prompts: [
          {
            name: 'Incident Summary Prompt',
            versions: [
              {
                $id: Now.ID['prompt-v1'],
                version: 1,
                model: 'llm_generic_small',
                temperature: 0.2,
                maxTokens: 500,
                promptState: 'published',
                prompt: (p) => `You are an IT incident analyst. Summarize the following incident concisely.

Incident Data:
${p.tool.FetchIncidentDetails.output}

Provide:
1. One-line summary
2. Current status and priority
3. Key timeline events
4. Impact assessment
5. Recommended next steps

Keep the summary under 200 words.`,
              },
            ],
          },
        ],
      },
    ],
  }
)

// ---------------------------------------------------------------------------
// Example 2: Skill with Script Include tool and Decision branching
// ---------------------------------------------------------------------------
export const changeRiskAssessment = NowAssistSkillConfig(
  {
    $id: Now.ID['change-risk-skill'],
    name: 'Assess Change Risk',
    description: 'Evaluates change request risk using historical data and CI impact analysis',
    shortDescription: 'AI change risk assessment',
    state: 'published',

    securityControls: {
      // Direct sys_id for userAccess.roles, role NAME for roleMap — see Example 1.
      userAccess: { $id: Now.ID['change-risk-skill-acl'], type: 'roles', roles: ['282bf1fac6112285017366cb5f867469'] },
      roleMap: ['itil'],
    },

    inputs: [
      {
        $id: Now.ID['input-change-record'],
        name: 'change record',
        description: 'The change request to assess',
        mandatory: true,
        dataType: 'glide_record',
        tableName: 'change_request',
      },
    ],

    tools: (t) => {
      // Step 1: Fetch change details via Script Include
      // 4.6.0+: Script tool config requires $capabilityId in addition to $id.
      // $capabilityId identifies the underlying skill capability record.
      //
      // ⚠️ scriptId takes a DIRECT sys_id string ONLY (issue #196, Build Rule #33).
      // Now.ref('sys_script_include', { name: ... }) builds clean but writes a
      // random phantom GUID per build into the capability metadata, and the name
      // is retained NOWHERE — the platform resolves scriptId by sys_id only
      // (global.ScriptDetails does a bare GlideRecord get, no name fallback), so
      // the tool points at a nonexistent Script Include and silently never loads
      // its script. The phantom GUID is also baked into the
      // sys_gen_ai_feature_mapping / sys_gen_ai_strategy_mapping identity keys,
      // so every rebuild additionally duplicates those records on redeploy.
      //
      // REPLACE the placeholder with the sys_id of the ChangeRiskUtils Script
      // Include on YOUR target instance (custom Script Include sys_ids are
      // instance-specific — there is no OOB constant). The build accepts the
      // placeholder string; installing it unreplaced yields a tool that cannot
      // execute — fail-safe by design, not an oversight.
      const fetchChange = t.Script('FetchChangeDetails', {
        $id: Now.ID['tool-fetch-change'],
        $capabilityId: Now.ID['tool-fetch-change-cap'],
        scriptId: 'REPLACE_WITH_CHANGERISKUTILS_SYS_ID',
        scriptFunctionName: 'getChangeDetails',
        inputs: [
          { $id: Now.ID['tool-input-change'], name: 'change_sys_id', value: '{{change_record}}' },
        ],
      })

      // Step 2: Check CI impact (depends on step 1)
      // For this example to branch correctly at runtime, the
      // ChangeRiskUtils.getCIImpact Script Include must RETURN THE CATEGORICAL
      // VALUE DIRECTLY as its whole output (one of 'high' | 'medium' | 'low').
      // The Decision below compares the tool's whole output via
      // context.getValue('CheckCIImpact.output'). Compute the comparison
      // HERE in the Script Include, not in the Decision (runtime-verified:
      // a Script tool's declared inputs arrive as plain string function
      // arguments — a glide_record input passes the bare sys_id string, and
      // '{{FetchChangeDetails.output}}' passes that tool's output).
      const checkImpact = t.Script('CheckCIImpact', {
        $id: Now.ID['tool-check-impact'],
        $capabilityId: Now.ID['tool-check-impact-cap'],
        // Direct sys_id string only — same rule as Step 1 (issue #196).
        scriptId: 'REPLACE_WITH_CHANGERISKUTILS_SYS_ID',
        scriptFunctionName: 'getCIImpact',
        inputs: [
          { $id: Now.ID['tool-input-ci'], name: 'ci_list', value: '{{FetchChangeDetails.output}}' },
        ],
        depends: [fetchChange],
      })

      // Step 3: Decision — branch based on the risk_level categorical value
      // emitted by the upstream `CheckCIImpact` step (see comment above).
      //
      // ⚠️ `targets` entries MUST be the NAMES of other tools in this graph
      // (or the sentinel '_end', which routes to the skill prompt / end of
      // graph). They are NOT free-form path labels: the build resolves each
      // target by tool name to create the sys_one_extend_resource_edge branch
      // records, and an unresolved name is SKIPPED SILENTLY apart from a
      // TS210 warning ("Decision target '...' not found") — the build still
      // "succeeds" but the decision routes NOWHERE at runtime (issue #200;
      // confirmed identical on SDK 4.8.1 and 4.9.0).
      //
      // The build auto-wires `depends: [<decision>]` onto each target tool —
      // do NOT declare it yourself on the target tools.
      //
      // ⚠️ In `branches[].to` and `default`, use STRING LITERALS (or property
      // access), never array indexing like `targets[0]`: element-access
      // expressions are unsupported by the branch extractor and the branch is
      // dropped SILENTLY — no warning, the edge is still created but WITHOUT
      // its name/order/condition, so every branch runs unconditionally
      // (same ElementAccessExpressionShape limitation as prompt tool
      // references, header item 5).
      const riskDecision = t.Decision('RiskLevelDecision', {
        $id: Now.ID['tool-risk-decision'],
        depends: [checkImpact],
        targets: ['HighRiskAnalysis', 'StandardAnalysis'] as const,
        branches: () => [
          {
            name: 'High Impact',
            to: 'HighRiskAnalysis',
            // ⚠️ Use a SCRIPT condition. The structured form
            // `{ field, operator, value }` builds clean but emits a
            // condition_expression edge WITHOUT an applicability_script — and
            // the OneExtend engine never traverses a conditional edge whose
            // applicability_script is absent, so the branch SILENTLY never
            // fires and every execution takes the default path
            // (runtime-refuted on gpinst01 Zurich P10, SDK 4.8.1/4.9.0, #202:
            // bare field, whole-output {{...}} template, and dot-path
            // templates all fell through to the default branch).
            //
            // The script receives (currentInputs, context);
            // context.getValue('<Tool Name>.output') reads an upstream tool's
            // output. It must RETURN a boolean. With a script condition the
            // SDK emits applicability_type='script' + the script itself, and
            // routing works end-to-end from a plain `now-sdk install`
            // (runtime-verified both directions, #202).
            //
            // (Repair alternative if you must keep an expression condition:
            // post-install, PATCH a boilerplate `return true` applicability
            // script onto the branch edge — the engine then evaluates the
            // expression. Script conditions need no such repair.)
            condition: {
              script: `(function(currentInputs, context) {
  return context.getValue('CheckCIImpact.output') == 'high';
})(currentInputs, context);`,
            },
          },
        ],
        default: () => 'StandardAnalysis',
      })

      // Steps 4a/4b: Branch targets — one per Decision path, referenced BY NAME
      // in `targets` above. Defined after the Decision (branches route forward);
      // no explicit `depends` — the build adds depends on the Decision for you.
      const highRiskAnalysis = t.InlineScript('HighRiskAnalysis', {
        $id: Now.ID['tool-high-risk-analysis'],
        script: `(function() {
          return JSON.stringify({
            path: 'HIGH_RISK_PATH_EXECUTED',
            guidance: 'Require CAB approval, schedule outside business hours, prepare rollback plan.'
          });
        })()`,
      })

      const standardAnalysis = t.InlineScript('StandardAnalysis', {
        $id: Now.ID['tool-standard-analysis'],
        script: `(function() {
          return JSON.stringify({
            path: 'STANDARD_PATH_EXECUTED',
            guidance: 'Standard change process applies; peer review is sufficient.'
          });
        })()`,
      })

      return {
        FetchChangeDetails: fetchChange,
        CheckCIImpact: checkImpact,
        RiskLevelDecision: riskDecision,
        HighRiskAnalysis: highRiskAnalysis,
        StandardAnalysis: standardAnalysis,
      }
    },
  },
  {
    providers: [
      {
        provider: 'Now LLM Service',
        prompts: [
          {
            name: 'Risk Assessment Prompt',
            versions: [
              {
                $id: Now.ID['risk-prompt-v1'],
                version: 1,
                model: 'llm_generic_small',
                temperature: 0.1,
                maxTokens: 800,
                promptState: 'published',
                prompt: (p) => `Assess the risk of this change request.

Change Details: ${p.tool.FetchChangeDetails.output}
CI Impact Analysis: ${p.tool.CheckCIImpact.output}

Provide a risk score (1-100) and detailed justification.`,
              },
            ],
          },
        ],
      },
    ],
  }
)

// ---------------------------------------------------------------------------
// Example 3: Minimal skill — simplest definition
// ---------------------------------------------------------------------------
export const simpleSkill = NowAssistSkillConfig(
  {
    $id: Now.ID['simple-skill'],
    name: 'Quick Answer',
    description: 'Answers a simple question',
    state: 'published',
    securityControls: {
      userAccess: { $id: Now.ID['simple-skill-acl'], type: 'authenticated' },
      roleMap: ['itil'],
    },
    inputs: [
      { $id: Now.ID['input-question'], name: 'question', description: 'User question', mandatory: true, dataType: 'string' },
    ],
  },
  {
    providers: [
      {
        provider: 'Now LLM Service',
        prompts: [
          {
            name: 'Answer Prompt',
            versions: [
              {
                $id: Now.ID['answer-prompt-v1'],
                version: 1,
                model: 'llm_generic_small',
                temperature: 0.3,
                maxTokens: 300,
                promptState: 'published',
                prompt: (p) => `Answer this question concisely: ${p.input['question']}`,
              },
            ],
          },
        ],
      },
    ],
  }
)

// ---------------------------------------------------------------------------
// Example 4: Multi-input skill — a `string` input plus a `json_object` input
//
// Demonstrates the general multi-input pattern. The platform maps payload keys
// to the inputs' INTERNAL names (spaces → underscores; see the MULTI-INPUT
// note above) — there is no special 'inputjson' keyword. Use descriptive,
// space-free names (here: 'query' and 'context') so label and internal name
// coincide.
//
// In the prompt template, a `json_object` input arrives as a SERIALIZED JSON
// STRING: p.input['context'] yields the string, not an object. If you need
// individual fields, JSON.parse() it inside a Script/InlineScript tool — you
// cannot parse it in the prompt template (Build Rule #13: no function calls in
// Fluent template literals).
//
// Invocation payload (server-side, via OneExtendUtil — keys match input names):
//   payload: { query: 'How do I reset my password?', context: { department: 'IT', locale: 'en' } }
// For the full server-side invocation envelope (executeSecure + meta.skillConfigId), see
// skills/now-assist-skill-builder/SKILL.md → "Programmatic Skill Invocation".
// ---------------------------------------------------------------------------
export const multiInputSkill = NowAssistSkillConfig(
  {
    $id: Now.ID['multi-input-skill'],
    name: 'Contextual Answer',
    description: 'Answers a question using an additional structured context object',
    state: 'published',
    securityControls: {
      userAccess: { $id: Now.ID['multi-input-skill-acl'], type: 'authenticated' },
      // PRE-ZP10 FALLBACK (target instance older than Zurich P10 / Australia P3):
      // `roleMap` is unavailable — use `roleRestrictions` with direct role sys_id
      // strings (legacy role_list column). NEVER Now.ref('sys_user_role', ...):
      // it builds clean but emits a phantom random GUID (#188/#194).
      // '282bf1fa...' = itil (OOB sys_id, identical on every instance).
      roleRestrictions: ['282bf1fac6112285017366cb5f867469'],
    },
    inputs: [
      { $id: Now.ID['input-query'], name: 'query', description: 'The user question', mandatory: true, dataType: 'string' },
      { $id: Now.ID['input-context'], name: 'context', description: 'Structured context (arrives as a serialized JSON string in the prompt)', mandatory: false, dataType: 'json_object' },
    ],
  },
  {
    providers: [
      {
        provider: 'Now LLM Service',
        prompts: [
          {
            name: 'Contextual Answer Prompt',
            versions: [
              {
                $id: Now.ID['multi-input-prompt-v1'],
                version: 1,
                model: 'llm_generic_small',
                temperature: 0.3,
                maxTokens: 400,
                promptState: 'published',
                // p.input['context'] is the json_object serialized as a JSON string.
                prompt: (p) => `Answer the question using the provided context.

Question: ${p.input['query']}
Context (JSON): ${p.input['context']}

Answer concisely and reference the context where relevant.`,
              },
            ],
          },
        ],
      },
    ],
  }
)

// ===========================================================================
// RUNTIME INVOCATION COMPANION (server-side JavaScript — NOT Fluent DSL)
// RUNTIME-VERIFIED end-to-end on gpinst01 (Zurich P10 HF3, SDK 4.9.0, #202).
//
// The DSL above DEFINES a skill; it does not invoke one. At runtime, call the
// skill via One Extend from any server script (RestApi / ScriptInclude /
// BusinessRule / UI Action). This block is a copyable reference, not part of
// the build.
//
// ⚠️ ACTIVATION PREREQUISITE: `now-sdk install` deploys every skill with its
// sn_nowassist_skill_config_status record active=false, and the Fluent DSL has
// NO field to change that (skillSettings only covers pre/post-processors).
// Executing a deactivated skill fails with "Cannot process the one-extend call
// as the user doesn't have permission to execute this skill" — even as admin,
// even with correct ACLs/roleMap. Activate post-install (NASK admin UI, or:
//   PATCH /api/now/table/sn_nowassist_skill_config_status/<sys_id>
//   {"active": "true"}
// ) — one-time per skill per instance; reinstalls do not reset it.
//
//   var capabilityId  = '<sys_one_extend_capability.sys_id>';   // selects the model-bound capability
//   var skillConfigId = '<skill-config sys_id>';                // Now Assist Skill Kit skill config
//
//   var resp = sn_one_extend.OneExtendUtil.executeSecure({
//     executionRequests: [{
//       capabilityId: capabilityId,
//       payload: { query: 'What is the status?',                 // payload KEYS = the input's INTERNAL name (spaces → underscores)
//                  context: { department: 'IT' } },              // json_object: pass the OBJECT — the platform serializes it for the prompt
//       meta: { skillConfigId: skillConfigId }                   // selects which skill config to run
//     }]
//   });
//   // Response is keyed by capabilityId — read defensively.
//   var cap    = resp && resp.capabilities && resp.capabilities[capabilityId];
//   var result = Array.isArray(cap) ? cap[0] : cap;
//   var answer = (result && typeof result.response === 'string') ? result.response : '';
//
// Response-shape gotchas (runtime-observed, #202):
//   - resp.capabilities also contains one entry PER TOOL capability (Script
//     tools appear under their datasource capability with an `output` field).
//     All InlineScript tools share the single OOB InlineScript capability
//     sys_id, so when several ran (e.g. Decision branch targets) only one
//     entry survives in the map — don't treat the response map as a complete
//     execution trace. Decision tools contribute an entry with no output.
//   - A glide_record skill input arrives in tool scripts as the bare sys_id
//     string (via {{...}} templates / Script-tool input values).
//
// Prefer executeSecure() in scoped/ACL contexts (execute() also exists and is
// not broken — see skills/now-assist-skill-builder/SKILL.md → Programmatic
// Skill Invocation for the capabilityId-vs-skillConfigId distinction, the
// post-install ID lookup, and the provider health-check preflight).
//
// Find capabilityId after install (skillConfigId comes from the Skill Kit form):
//   GET /api/now/table/sys_one_extend_capability?sysparm_query=name=<skill name>&sysparm_fields=sys_id,name
// ===========================================================================
