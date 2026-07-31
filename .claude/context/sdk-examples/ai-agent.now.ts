/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30;
 * re-build-validated against SDK 4.8.1 and 4.9.0 on 2026-07-17 (issue #191:
 * RAG tool migrated from `type: 'rag'` to `type: 'search_retrieval'` — the
 * rename landed in SDK 4.7.0, so Example 3 now requires SDK >= 4.7.0).
 * Required one fix from the 4.5.0 shape:
 *   - Each agent now requires a `securityAcl` config block. See Build Rule
 *     #21 in sdk-reference.md (rewritten in this batch). The earlier wording
 *     "ACLs are auto-generated, do not define" was misleading: the SDK *does*
 *     auto-generate the underlying sys_security_acl + sys_security_acl_role
 *     records, but YOU must define the `securityAcl` config that drives the
 *     generation. It's mandatory; the build fails with TS210 without it.
 *   - 2026-07-17 (issue #188): 'Specific role' roles[] and dataAccess
 *     .roleList[] take direct sys_id GUID strings ONLY — Now.ref() silently
 *     writes phantom GUIDs (see securityAcl comment in Example 1).
 *   - 2026-07-17 (issue #193): added Example 4 (deep_research /
 *     desktop_automation / mcp OOB tools) — build-validated on 4.8.1 + 4.9.0.
 *   - 2026-07-18 (issue #199): Example 4 RUNTIME-REFUTED on gpinst01
 *     (Zurich P10): all three tool types are non-functional from Fluent —
 *     silent record drop without `description`, and no target_document
 *     (sys_cs_topic / sn_mcp_server) even with it. Kept as a compile-shape
 *     reference with a DO-NOT-SHIP warning; see Build Rule #34.
 *
 * Golden Example: AiAgent — AI Agent with tools, versioned instructions, and trigger
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/ai-agent-studio/ai-agent
 * Import:   import { AiAgent } from '@servicenow/sdk/core'
 * Requires: SDK >= 4.7.0 — Example 3 uses the search_retrieval tool type
 *           (renamed from 'rag' in 4.7.0), so this FILE does not build on
 *           4.6.x. Examples 1-2 are individually 4.6.0-compatible.
 *
 * Key concepts:
 *   - versionDetails[] for A/B testing instruction versions (state: 'draft' | 'published')
 *   - Tool types by discriminated union on 'type':
 *     - script: requires top-level `script` property as IIFE string `(function(inputs){...})(inputs);`, optional `inputs`
 *     - crud: requires `inputs` with { operationName, table, inputFields[] }
 *     - subflow: requires `subflowId` (reference to sys_hub_flow)
 *     - action: requires `flowActionId`
 *     - capability: requires `capabilityId` (Now Assist skill reference)
 *     - catalog: requires `catalogItemId`
 *     - topic / topic_block: requires `virtualAgentId`
 *     - search_retrieval (renamed from 'rag' in SDK 4.7.0): requires structured
 *       `inputs` (RagInputType) at build — see Example 3
 *     - web_automation, knowledge_graph, file_upload, deep_research,
 *       desktop_automation, mcp: OOB tools, no extra required fields
 *   - triggerConfig[] for automatic execution on record events or schedules
 *   - channel: 'nap' (Now Assist Panel only) or 'nap_and_va' (both, default)
 *   - executionMode on tools: 'autopilot' (default) or 'copilot'
 *   - acl is OPTIONAL — omit it; do NOT pass empty string ''
 *     (4.6.0+ auto-generates the required AiAgent ACL records during build —
 *     defining ACLs manually via the `Acl` API will conflict)
 *
 * VALIDATED: Built and installed successfully against SDK 4.5.0 on 2026-04-01
 * RUNTIME-VALIDATED: Script tool IIFE self-invocation pattern confirmed on keynexus01 2026-04-02
 */

import '@servicenow/sdk/global'
import { AiAgent } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Incident Triage Agent with script tools
// (record-trigger field shape shown as a commented reference — see the note
//  before the triggerConfig block; a working trigger belongs on a workflow)
// ---------------------------------------------------------------------------
export const incidentTriageAgent = AiAgent({
  $id: Now.ID['incident-triage-agent'],
  name: 'Incident Triage Agent',
  description: 'Analyzes new P1/P2 incidents, enriches context, and routes to the correct assignment group',
  agentRole: 'You are an expert IT incident analyst specializing in rapid triage and routing.',

  // 4.6.0+: securityAcl is MANDATORY. The SDK auto-generates the underlying
  // sys_security_acl + sys_security_acl_role records from this config.
  // Types: 'Any authenticated user' | 'Specific role' (requires roles[]) | 'Public'.
  //
  // 'Specific role' — roles[] MUST be direct role sys_id GUID strings:
  //
  //   securityAcl: {
  //     $id: Now.ID['incident-triage-agent-acl'],
  //     type: 'Specific role',
  //     roles: ['282bf1fac6112285017366cb5f867469'], // itil (OOB sys_ids are identical across instances)
  //   },
  //
  // Do NOT use Now.ref('sys_user_role', { name: ... }) here (or in
  // dataAccess.roleList): it builds, but the AIA processors drop the lookup
  // key and write a random build-time GUID to sys_security_acl_role
  // .sys_user_role — the Define-user-access pill renders blank and the role
  // never applies (issue #188, verified on SDK 4.8.0 and 4.9.0). Also note:
  // the generated sys_security_acl_role child gets a NEW sys_id on every
  // build, so repeated deploys of a 'Specific role' agent accumulate
  // duplicate role rows (cosmetic, but they must be cleaned up manually).
  securityAcl: {
    $id: Now.ID['incident-triage-agent-acl'],
    type: 'Any authenticated user',
  },

  // Agent config
  channel: 'nap',
  agentType: 'internal',
  active: true,

  // Versioned instructions — publish V1, keep V2 as draft for testing
  versionDetails: [
    {
      name: 'V1 - Production',
      number: 1,
      state: 'published',
      instructions: `You are an incident triage specialist. For each incident:
1. Read the short description and additional comments
2. Use the "Lookup CI" tool to find the affected configuration item
3. Use the "Get Assignment Rules" tool to determine the correct group
4. Use the "Update Incident" tool to set assignment_group and add work notes
5. If priority is 1, also notify the on-call manager via the notification tool

Always explain your reasoning in work_notes before making changes.`,
    },
    {
      name: 'V2 - Enhanced',
      number: 2,
      state: 'draft',
      instructions: `Enhanced triage with sentiment analysis...`,
    },
  ],

  // Tools — note: 'script' type requires `script` at top level, NOT inside toolAttributes
  // IMPORTANT: Script tools MUST be self-invoking IIFEs ending with (inputs);
  tools: [
    // Script tool — custom server-side logic
    {
      name: 'Lookup CI',
      type: 'script',
      description: 'Finds the configuration item related to the incident based on short_description keywords',
      executionMode: 'autopilot',
      active: true,
      recordType: 'custom',
      // For script tools: `script` must be a self-invoking IIFE with (inputs) at the end
      script: `(function(inputs) {
        var keywords = inputs.keywords || '';
        var gr = new GlideRecord('cmdb_ci');
        gr.addQuery('name', 'CONTAINS', keywords);
        gr.setLimit(1);
        gr.query();
        if (gr.next()) {
          return JSON.stringify({
            ci_name: gr.getValue('name'),
            ci_sys_id: gr.getUniqueValue(),
            ci_class: gr.getValue('sys_class_name')
          });
        }
        return JSON.stringify({ ci_name: 'Not found', ci_sys_id: '', ci_class: '' });
      })(inputs);`,
      // For script tools: `inputs` is optional typed array of ToolInputField
      inputs: [
        { name: 'keywords', description: 'Search keywords from the incident', mandatory: true },
      ],
    },

    // CRUD tool — built-in record operations
    {
      name: 'Update Incident',
      type: 'crud',
      description: 'Updates incident fields like assignment_group, priority, and work_notes',
      executionMode: 'autopilot',
      active: true,
      recordType: 'custom',
      // For crud tools: `inputs` requires { operationName, table, inputFields[] }
      inputs: {
        operationName: 'update',
        table: 'incident',
        inputFields: [
          { name: 'assignment_group', description: 'Target assignment group', mandatory: false, mappedToColumn: 'assignment_group' },
          { name: 'work_notes', description: 'Triage analysis notes', mandatory: false, mappedToColumn: 'work_notes' },
          { name: 'priority', description: 'Adjusted priority', mandatory: false, mappedToColumn: 'priority' },
        ],
      },
    },

    // Subflow tool — references an existing Flow Designer subflow
    {
      name: 'Notify On-Call Manager',
      type: 'subflow',
      description: 'Triggers the on-call notification subflow for critical incidents',
      executionMode: 'copilot', // requires human approval before sending
      active: true,
      recordType: 'custom',
      subflowId: Now.ref('sys_hub_flow', { name: 'Notify On-Call' }),
    },
  ],

  // Trigger — for a record-event trigger, do NOT put triggerConfig on a bare AiAgent.
  //
  // GOTCHA: triggerConfig on AiAgent alone leaves the trigger's `usecase` field null —
  // AiAgent does not create a sn_aia_usecase record (sn_aia_trigger_configuration.usecase
  // references sn_aia_usecase, and sn_aia_agent has no usecase field). Only AiAgenticWorkflow
  // creates the usecase. The build accepts it without error, so the field shape is shown below
  // as a COMMENTED REFERENCE only — it is intentionally NOT live in this standalone-agent
  // example (a live block here would deploy a trigger that never fires). For a working record
  // trigger, wrap this agent in an AiAgenticWorkflow and put triggerConfig on the workflow with
  // executionMode: 'autopilot' AND state: 'published' (the platform default is 'copilot'/Supervised,
  // and a draft never activates — either way it never fires on record events). See
  // ai-agentic-workflow.now.ts Examples 1–3, and Build Rule #31.
  //
  // triggerConfig: [
  //   {
  //     name: 'New P1/P2 Incident',
  //     active: true,
  //     channel: 'now_assist_panel',
  //     targetTable: 'incident',
  //     triggerFlowDefinitionType: 'record_create',
  //     triggerCondition: 'priority<=2',
  //     objectiveTemplate: 'Triage and route incident ${number}',
  //     showNotifications: true,
  //   },
  // ],
})

// ---------------------------------------------------------------------------
// Example 2: Minimal agent — simplest possible definition
// NOTE: Do NOT pass `acl: ''` — it causes a build error. Omit acl entirely.
// ---------------------------------------------------------------------------
export const basicSupportAgent = AiAgent({
  $id: Now.ID['basic-support-agent'],
  name: 'Basic Support Agent',
  description: 'Answers common IT support questions',
  agentRole: 'Helpful IT support specialist',
  securityAcl: {
    $id: Now.ID['basic-support-agent-acl'],
    type: 'Any authenticated user',
  },
  versionDetails: [
    {
      name: 'V1',
      number: 1,
      state: 'published',
      instructions: 'You are a helpful support agent. Answer questions clearly and concisely.',
    },
  ],
})

// ---------------------------------------------------------------------------
// Example 3: Agent with RAG (search_retrieval), knowledge graph, and web search tools
//
// RAG TOOL PATTERN (build-validated 2026-07-17 on SDK 4.8.1 + 4.9.0):
//   - SDK >= 4.7.0 renamed the tool type 'rag' -> 'search_retrieval' and gave
//     it typed, structured `inputs` (RagInputType) — the old flat inputs array
//     and its `as any` cast are gone
//   - `inputs` is MANDATORY at build (TS210 without it), even though the SDK
//     docs mark it optional. Minimal shape: searchType + searchProfile + sources
//   - searchType.type: 'hybrid' (recommended) | 'semantic' | 'keyword' —
//     hybrid/semantic take semanticIndexes[] and documentMatchThreshold (0-1)
//   - searchProfile must match an existing AI Search profile on the instance
//   - fields use { value: 'table.field', label: '...' } format
//   - Do NOT supply a 'query' input — the SDK auto-generates it
//   - Do NOT use `toolAttributes` — it serializes as [object Object] (broken)
//   - The build serializes this back to the platform's flat
//     sn_aia_agent_tool_m2m.inputs format and links the OOB RAG Retriever tool
// ---------------------------------------------------------------------------
export const knowledgeAgent = AiAgent({
  $id: Now.ID['knowledge-agent'],
  name: 'Knowledge Search Agent',
  description: 'Searches knowledge bases and documentation to answer user questions',
  agentRole: 'Knowledge management specialist',
  securityAcl: {
    $id: Now.ID['knowledge-agent-acl'],
    type: 'Any authenticated user',
  },
  channel: 'nap_and_va',
  versionDetails: [
    {
      name: 'V1',
      number: 1,
      state: 'published',
      instructions: `Search the knowledge base first. If no results, try the knowledge graph.
Always cite the KB article number in your response.`,
    },
  ],
  tools: [
    // RAG tool — fully configured with search profile, sources, and fields.
    // Fully typed since SDK 4.7.0 — no cast needed.
    {
      name: 'KB Search',
      type: 'search_retrieval',
      description: 'Searches knowledge base articles for relevant information',
      executionMode: 'autopilot',
      active: true,
      displayOutput: true,
      inputs: {
        searchType: {
          type: 'hybrid',
          semanticIndexes: [
            { value: 'body', label: 'body' },
            { value: 'title', label: 'title' },
          ],
          documentMatchThreshold: 0.75,
        },
        searchProfile: { value: 'quick_action_kb_search_profile', label: 'Quick Action KB Search Profile' },
        sources: [{ value: 'kb_knowledge', label: 'Knowledge Base' }],
        fields: [
          { value: 'kb_knowledge.text', label: 'Text' },
          { value: 'kb_knowledge.number', label: 'Number' },
          { value: 'kb_knowledge.short_description', label: 'Short Description' },
        ],
        searchResultsLimit: 5,
      },
    },
    {
      name: 'Knowledge Graph Lookup',
      type: 'knowledge_graph',
      description: 'Queries the CMDB knowledge graph for relationship data',
      executionMode: 'autopilot',
      active: true,
    },
    {
      name: 'Web Search',
      type: 'web_automation',
      description: 'Falls back to web search for external documentation',
      executionMode: 'autopilot',
      active: true,
      displayOutput: true,
    },
  ],
})

// ---------------------------------------------------------------------------
// Example 4: Remaining OOB tool types — deep_research, desktop_automation, mcp
// (SDK 4.7.0+; compile-shape reference — RUNTIME-REFUTED, see Build Rule #34)
//
// These three OOB types take ONLY { type, name } plus the generic optional
// fields (description, pre/postMessage, executionMode, ...). There is NO
// `inputs` property on them — adding one is a type error (unlike
// search_retrieval, where structured inputs are mandatory).
//
// DO NOT SHIP THESE THREE TOOL TYPES YET. Live-verified on gpinst01
// (Zurich P10, SDK 4.9.0, issue #199) — they fail at three independent layers:
//   1. NO OOB LINK: the docs claim OOB types "auto-link to the existing OOB
//      tool record", but the build plugin only maps web_automation /
//      knowledge_graph / file_upload / rag(search_retrieval). For these three
//      it emits a NEW sn_aia_tool record into your app instead.
//   2. SILENT DROP WITHOUT description: a platform Data Policy on sn_aia_tool
//      mandates Description. Omit `description` and the install SILENTLY
//      skips the tool record while still installing the agent-tool m2m rows —
//      the agent carries phantom tool references (Rule #21/#33 family).
//      ALWAYS set `description` (kept below).
//   3. STRUCTURALLY INCOMPLETE even when installed: functional tools of these
//      types carry target_document → a sys_cs_topic (deep_research,
//      desktop_automation) or an sn_mcp_server (mcp). The SDK writes
//      target_document_table='sn_aia_tool' and no target — every call fails
//      in ms with "AIA: Topic not found for target document 'null'". Even
//      hand-repointing the m2m at the instance's OOB tool record fails (the
//      SDK m2m carries no input mapping; the topic receives an empty task).
// ---------------------------------------------------------------------------
// SECURITY (these are high-privilege tools — lock them down):
//   - ACL: desktop_automation drives user sessions and mcp reaches external
//     systems; do NOT expose them to 'Any authenticated user'. Use a
//     'Specific role' ACL with direct role sys_id strings (Rule #21/#188 —
//     never Now.ref; note the cosmetic duplicate-role-row-per-rebuild caveat
//     in Example 1's securityAcl comment).
//   - executionMode: default is 'autopilot'. Keep desktop_automation and mcp
//     on 'copilot' (human approves each execution — same convention as
//     Example 1's notify subflow); read-only deep_research may run autopilot.
//   - MCP: govern which MCP servers the instance may reach (server config /
//     allowlisting is instance-side; nothing in this artifact constrains it).
export const oobToolSamplerAgent = AiAgent({
  $id: Now.ID['aia-oob-tool-sampler'],
  name: 'OOB Tool Sampler',
  description: 'Demonstrates the 4.7.0+ OOB tool types: deep_research, desktop_automation, mcp',
  agentRole: 'Research assistant that can run deep research, drive desktop sessions, and call MCP servers',
  securityAcl: {
    $id: Now.ID['aia-oob-tool-sampler-acl'],
    type: 'Specific role',
    roles: ['282bf1fac6112285017366cb5f867469'], // itil — direct sys_id string (OOB role sys_ids are identical across instances)
  },
  versionDetails: [
    {
      name: 'V1',
      number: 1,
      state: 'published',
      instructions: `Use Deep Research for multi-source questions, Desktop Automation for
UI-driven tasks, and the MCP tool for external systems exposed over MCP.`,
    },
  ],
  tools: [
    {
      type: 'deep_research',
      name: 'Deep Research',
      // description is EFFECTIVELY MANDATORY (finding 2 above): without it the
      // sn_aia_tool record is silently dropped at install (Data Policy).
      description: 'Multi-source deep research on a user question',
      executionMode: 'autopilot', // read-only research — autopilot acceptable
      preMessage: 'Starting deep research...',
      postMessage: 'Deep research complete.',
    },
    {
      type: 'desktop_automation',
      name: 'Desktop Automation',
      description: 'Drives a desktop session to complete UI tasks',
      executionMode: 'copilot', // drives UI sessions — require human approval
      preMessage: 'Driving the desktop session...',
      postMessage: 'Desktop automation finished.',
    },
    {
      type: 'mcp',
      name: 'MCP Tool',
      description: 'Calls an external system exposed over MCP',
      executionMode: 'copilot', // external system access — require human approval
      preMessage: 'Calling MCP server...',
      postMessage: 'MCP call finished.',
    },
  ],
})
