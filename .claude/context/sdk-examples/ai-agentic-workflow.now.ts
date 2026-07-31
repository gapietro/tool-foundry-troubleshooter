/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30;
 * re-build-validated against SDK 4.8.1 and 4.9.0 on 2026-07-17 (issue #191:
 * the resolution agent's KB Search tool migrated from `type: 'rag'` to
 * `type: 'search_retrieval'` with structured mandatory `inputs` — the rename
 * landed in SDK 4.7.0, so this file now requires SDK >= 4.7.0).
 * 2026-07-17 — dataAccess.roleList / team.members / runAs switched from
 * Now.ref() to direct sys_id strings after issue #188 verification: the AIA
 * intent processors drop Now.ref's lookup key and emit random build-time
 * GUIDs (confirmed via build repro on SDK 4.8.0 and 4.9.0 + live records on
 * gpinst01). Other artifact families (UiAction, catalog, SP) keep the lookup
 * key and are unaffected.
 * Required several changes from the 4.5.0 shape:
 *   1. Each AiAgent + each AiAgenticWorkflow now requires a `securityAcl`
 *      config block (Build Rule #21 in sdk-reference.md).
 *   2. Agents are `export const` so they're externally referenceable AND so
 *      the workflow's team.members[] can pass them by reference.
 *   3. team.members[] expects `string | Record<"sn_aia_agent">`. Pass the
 *      exported agent constants with `as any` — the runtime resolves the
 *      agent references correctly. (Now.ID['<key>'] string keys don't have
 *      the right shape; `.id` accessor is banned by Fluent; the agent
 *      constants are typed `AiAgentType` which TS doesn't accept as Record.)
 *   4. team objects need a `name` field — without it, all teams collide on
 *      the same auto-generated sys_id and the build fails with a sn_aia_team
 *      conflict.
 *   5. Trigger `channel` value uses display-name format: 'Now Assist Panel'
 *      (NOT 'now_assist_panel').
 *   6. Even scheduled triggers (`triggerFlowDefinitionType: 'weekly'`) require
 *      channel + triggerCondition + objectiveTemplate + targetTable — they
 *      identify the records the scheduled run iterates over.
 *   7. dataAccess.roleList values must be direct role sys_id GUID strings
 *      (`'282bf1fac6112285017366cb5f867469'` = itil). Bare role NAMES fail
 *      the build ("roleRestrictions field contains non-GUID value") — but do
 *      NOT use `Now.ref('sys_user_role', { name: ... })` either: it builds,
 *      then writes a random build-time GUID to `role_list` that matches no
 *      real role (issue #188 — verified on SDK 4.8.0 AND 4.9.0; the AIA
 *      processors drop the ref's lookup key, so nothing resolves it at
 *      install). The failure is silent: agents run without the intended
 *      data access. OOB role sys_ids (itil, incident_manager, ...) are
 *      identical on every instance; verify custom-role sys_ids on the target.
 *   8. Workflow user-identity field is `runAs` (NOT `runAsUser`).
 *
 * IMPORTANT — companion file:
 * Example 3 references `./scripts/enrich-context.js` via Now.include();
 * a stub is committed alongside under context/sdk-examples/scripts/.
 *
 * Golden Example: AiAgenticWorkflow — Multi-agent orchestration (Use Case)
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/ai-agent-studio/ai-agent-workflow
 * Import:   import { AiAgenticWorkflow, AiAgent } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - Orchestrates multiple AiAgent definitions as a team
 *   - versions[] for instruction versioning (like AiAgent.versionDetails)
 *   - team: { $id, name, members: [<agent records>] }
 *   - triggerConfig[] for record-based or scheduled triggers
 *   - executionMode: 'autopilot' | 'copilot'
 *   - dataAccess.roleList for dynamic user identity (mandatory if runAs omitted)
 *   - runAs (string sys_id) for fixed user identity (mandatory if dataAccess omitted)
 *   - contextProcessingScript for enriching context before execution
 *   - securityAcl is MANDATORY (auto-generates underlying ACL records)
 *
 * Requires: SDK >= 4.7.0 (search_retrieval tool type; rest of the file is 4.6.0-compatible)
 */

import '@servicenow/sdk/global'
import { AiAgenticWorkflow, AiAgent } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// First, define the individual agents that will be team members
// ---------------------------------------------------------------------------
// Agents are `export const` so they're externally referenceable; the workflows
// reference them in team.members[] (with `as any` cast — see header note 3).
// ---------------------------------------------------------------------------
export const triageAgent = AiAgent({
  $id: Now.ID['wf-triage-agent'],
  name: 'Workflow Triage Agent',
  description: 'Classifies and prioritizes incoming requests',
  agentRole: 'Request classifier',
  securityAcl: {
    $id: Now.ID['wf-triage-agent-acl'],
    type: 'Any authenticated user',
  },
  versionDetails: [
    { name: 'V1', number: 1, state: 'published', instructions: 'Classify the request type and urgency...' },
  ],
})

export const resolutionAgent = AiAgent({
  $id: Now.ID['wf-resolution-agent'],
  name: 'Workflow Resolution Agent',
  description: 'Resolves common issues using KB and automation',
  agentRole: 'Issue resolver',
  securityAcl: {
    $id: Now.ID['wf-resolution-agent-acl'],
    type: 'Any authenticated user',
  },
  versionDetails: [
    { name: 'V1', number: 1, state: 'published', instructions: 'Attempt to resolve using KB articles first...' },
  ],
  tools: [
    // 'search_retrieval' (renamed from 'rag' in SDK 4.7.0). `inputs` is
    // mandatory at build (TS210) — this is the minimal valid shape; see
    // ai-agent.now.ts Example 3 for a fully-configured hybrid-search tool.
    {
      name: 'KB Search',
      type: 'search_retrieval',
      executionMode: 'autopilot',
      active: true,
      description: 'Search knowledge base',
      inputs: {
        searchType: { type: 'keyword' },
        searchProfile: { value: 'quick_action_kb_search_profile', label: 'Quick Action KB Search Profile' },
        sources: [{ value: 'kb_knowledge', label: 'Knowledge Base' }],
      },
    },
  ],
})

export const escalationAgent = AiAgent({
  $id: Now.ID['wf-escalation-agent'],
  name: 'Workflow Escalation Agent',
  description: 'Escalates unresolved issues to appropriate teams',
  agentRole: 'Escalation coordinator',
  securityAcl: {
    $id: Now.ID['wf-escalation-agent-acl'],
    type: 'Any authenticated user',
  },
  versionDetails: [
    { name: 'V1', number: 1, state: 'published', instructions: 'Route to the correct assignment group based on category...' },
  ],
})

// ---------------------------------------------------------------------------
// Example 1: Multi-agent workflow with record trigger
// ---------------------------------------------------------------------------
export const incidentResolutionWorkflow = AiAgenticWorkflow({
  $id: Now.ID['incident-resolution-workflow'],
  name: 'Incident Resolution Workflow',
  description: 'Three-stage incident handling: triage -> resolve -> escalate',

  securityAcl: {
    $id: Now.ID['incident-resolution-workflow-acl'],
    type: 'Any authenticated user',
  },

  // Team composition — `name` is required; without it teams collide.
  team: {
    $id: Now.ID['incident-team'],
    name: 'Incident Resolution Team',
    // members[] expects `string | Record<"sn_aia_agent">`. Pass the agent
    // constants with `as any` — the runtime resolves the references correctly.
    // ONLY reference agents defined in THIS package (or direct sys_id strings
    // of pre-existing instance agents). Do NOT use
    // Now.ref('sn_aia_agent', { name: ... }) for agents that already live on
    // the instance: it writes a random build-time GUID to sn_aia_team_member
    // .agent — the member row renders blank and the agent never joins the
    // team (issue #188 addendum; same root cause as roleList above).
    members: [
      triageAgent as any,
      resolutionAgent as any,
      escalationAgent as any,
    ],
  },

  // Orchestrator instructions
  versions: [
    {
      name: 'V1',
      number: 1,
      state: 'published',
      instructions: `You are coordinating incident resolution across three agents:
1. First, delegate to "Workflow Triage Agent" to classify the incident
2. If triaged as auto-resolvable, delegate to "Workflow Resolution Agent"
3. If resolution fails or incident is complex, delegate to "Workflow Escalation Agent"
Always update the incident work_notes with the outcome of each stage.`,
    },
  ],

  executionMode: 'autopilot',

  // Dynamic user identity — uses roleList for data access. Values MUST be
  // direct role sys_id GUID strings. Role NAMES fail the build ("roleRestrictions
  // field contains non-GUID value"), and Now.ref('sys_user_role', { name: ... })
  // is a silent trap: it builds, but writes a random build-time GUID that
  // matches no real role — the agent then runs without the intended data
  // access (issue #188, verified on SDK 4.8.0 and 4.9.0). OOB role sys_ids
  // are identical across instances; verify custom-role sys_ids on the target
  // (query: sys_user_role where name=<role>).
  dataAccess: {
    roleList: [
      '282bf1fac6112285017366cb5f867469', // itil
      '415f09c10bb63200ecfd818393673af1', // incident_manager
    ],
  },

  // Auto-trigger on new incidents
  triggerConfig: [
    {
      name: 'New Incident Trigger',
      active: true,
      channel: 'Now Assist Panel', // 4.6.0 uses display-name format
      targetTable: 'incident',
      triggerFlowDefinitionType: 'record_create',
      triggerCondition: 'active=true',
      objectiveTemplate: 'Resolve incident ${number}',
    },
  ],
})

// ---------------------------------------------------------------------------
// Example 2: Scheduled workflow — weekly review
// ---------------------------------------------------------------------------
export const weeklyReviewWorkflow = AiAgenticWorkflow({
  $id: Now.ID['weekly-review-workflow'],
  name: 'Weekly Incident Review',
  description: 'Reviews open incidents weekly and generates summary report',

  securityAcl: {
    $id: Now.ID['weekly-review-workflow-acl'],
    type: 'Any authenticated user',
  },

  team: {
    $id: Now.ID['review-team'],
    name: 'Weekly Review Team',
    members: [triageAgent as any],
  },

  versions: [
    {
      name: 'V1',
      number: 1,
      state: 'published',
      instructions: 'Review all open P1/P2 incidents and generate a summary...',
    },
  ],

  executionMode: 'autopilot',

  triggerConfig: [
    {
      // 4.6.0: Even scheduled triggers require channel/triggerCondition/
      // objectiveTemplate/targetTable. They identify which records the
      // weekly review iterates over.
      name: 'Weekly Monday Review',
      active: true,
      channel: 'Now Assist Panel',
      targetTable: 'incident',
      triggerCondition: 'active=true^priorityIN1,2',
      objectiveTemplate: 'Weekly review of open P1/P2 incident ${number}',
      triggerFlowDefinitionType: 'weekly',
      schedule: {
        runDayOfWeek: 2, // Monday
        time: '1970-01-01 09:00:00',
      },
    },
  ],
})

// ---------------------------------------------------------------------------
// Example 3: Workflow with context processing script
// ---------------------------------------------------------------------------
export const enrichedWorkflow = AiAgenticWorkflow({
  $id: Now.ID['enriched-workflow'],
  name: 'Context-Enriched Workflow',
  description: 'Pre-processes context before agent execution',

  securityAcl: {
    $id: Now.ID['enriched-workflow-acl'],
    type: 'Any authenticated user',
  },

  team: {
    $id: Now.ID['enriched-team'],
    name: 'Enriched Workflow Team',
    members: [resolutionAgent as any],
  },

  versions: [
    {
      name: 'V1',
      number: 1,
      state: 'published',
      instructions: 'Use the enriched context to resolve the issue...',
    },
  ],

  executionMode: 'autopilot',

  // Enrich context before agents see it
  contextProcessingScript: Now.include('./scripts/enrich-context.js'),

  // Fixed user identity. Field is `runAs` (NOT `runAsUser`) — it takes a user
  // sys_id string and pins the workflow to that identity (lands on
  // sn_aia_usecase_config_override.run_as_user). Prefer the direct sys_id
  // string: Now.ref('sys_user', ...) here emits a build-generated GUID whose
  // install-time resolution is unverified — given issue #188, don't risk it.
  // (The pre-#188 shape, Now.ref('sys_user', { user_name: 'system' }), was
  // doubly broken: 'system' has no sys_user record on verified instances.)
  //
  // REPLACE the placeholder below with the sys_id of a DEDICATED SERVICE
  // ACCOUNT scoped to what the workflow's tools actually need. Do NOT pin
  // admin: with securityAcl 'Any authenticated user', any user could invoke
  // a workflow whose tools run with full admin rights. When runAs pins a
  // privileged identity, also narrow securityAcl to type: 'Specific role'.
  // The build accepts this placeholder string; installing it unreplaced
  // yields an invalid reference (workflow won't run) — that's fail-safe by
  // design, not an oversight.
  // Omit `runAs` entirely to use dynamic user identity (then
  // `dataAccess.roleList` becomes mandatory — see Example 1).
  runAs: 'REPLACE_WITH_SERVICE_ACCOUNT_SYS_ID',
})
