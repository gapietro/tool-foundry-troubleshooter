/**
 * Examples 1, 2: VALIDATED (build-tested against SDK 4.5.0 on 2026-04-01)
 * Example 3:     VALIDATED against SDK 4.6.0 on 2026-04-30 (#60 + #62).
 *                4.5.0 → 4.6.0 changes incorporated:
 *                - flowVariables now uses Column constructors (e.g.
 *                  `IntegerColumn({ label: '...' })`) — same pattern as
 *                  Subflow/Action inputs+outputs (#60).
 *                - forEach iterable uses dataPill type 'array.object' (not
 *                  'records'), and the body callback takes the per-iteration
 *                  item as a parameter — using `incidents.Records` directly
 *                  inside the body would pass the whole collection (#62).
 * Examples 4, 5: VALIDATED (build + install against SDK 4.6.0 on 2026-04-30).
 *                Example 4 uses inlined action.core.* steps for install-safe
 *                activation; the wfa.action(CustomAction, …) pattern is
 *                documented in the Example 4 header (see Build Rule #30).
 *                Example 5 covers Subflow define + invoke.
 *
 * Golden Example: Flow — Flow Designer workflow-as-code
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/flow
 * Import:   import { Flow, Subflow, wfa, action, trigger } from '@servicenow/sdk/automation'
 *
 * Key concepts:
 *   - Flow(config, triggerInstance, body) — three-argument pattern
 *   - Subflow(config, body?) — two-argument pattern, NO trigger, typed inputs/outputs
 *   - Triggers: trigger.record.{created|updated|createdOrUpdated},
 *               trigger.application.{serviceCatalog|inboundEmail|remoteTableQuery|slaTask}
 *   - Actions: action.core.{createRecord|updateRecord|deleteRecord|lookUpRecord|lookUpRecords|
 *              sendEmail|sendSms|sendNotification|fireEvent|log|waitForCondition|
 *              slaPercentageTimer|getCatalogVariables|createCatalogTask|createTask|
 *              askForApproval|getAttachmentsOnRecord|copyAttachment}
 *   - 4.6.0+ Composition:
 *       wfa.subflow(SubflowRef, { $id }, { ...inputs, waitForCompletion })  — invoke a Subflow
 *       wfa.action(ActionRef,    { $id }, { ...inputs })                     — invoke a Custom Action
 *   - Flow logic: wfa.flowLogic.{if|elseIf|else|forEach|setFlowVariables|assignSubflowOutputs}
 *   - Data pills: wfa.dataPill(value, type) where type = 'string'|'reference'|'email'|'html'|'array.string'|'array.object'|'records'|'table_name'
 *       - 'records' is the result-container type returned by action.core.lookUpRecords
 *       - 'array.object' is the iterable type for wfa.flowLogic.forEach (the body
 *         callback receives the per-iteration item as its parameter — see Example 3)
 *   - Helpers: TemplateValue({}), Duration({}), wfa.approvalRules({})
 *   - flowVariables: a record of Column-constructor values
 *     (e.g. `{ counter: IntegerColumn({ label: 'Counter' }) }`).
 *   - Conditions use ServiceNow encoded query syntax: 'field=value^field2=value2'
 */

import '@servicenow/sdk/global'
import { Flow, Subflow, wfa, action, trigger } from '@servicenow/sdk/automation'
import { StringColumn, BooleanColumn, IntegerColumn } from '@servicenow/sdk/core'

// =====================================================================
// Composes with: custom-action.now.ts
//   Example 4 below documents the wfa.action(CustomAction, ...) pattern.
//   The Custom Action (escalateIncident) is defined in custom-action.now.ts.
//   The live example uses inlined action.core.* steps because Custom Actions
//   installed via now-sdk install are always in state=draft — see Build Rule
//   #30 in sdk-reference.md. custom-action.now.ts Example 1 has the companion
//   note explaining why this matters.
// =====================================================================

// ---------------------------------------------------------------------------
// Example 1: Incident auto-assignment flow with conditional logic
// ---------------------------------------------------------------------------
export const incidentAutoAssign = Flow(
  // Config
  {
    $id: Now.ID['incident-auto-assign-flow'],
    name: 'Incident Auto-Assignment',
    description: 'Automatically assigns new incidents based on category and priority',
    flowPriority: 'HIGH',
    runAs: 'system',
  },

  // Trigger — fires when incident is created
  wfa.trigger(
    trigger.record.created,
    { $id: Now.ID['trigger-incident-created'] },
    {
      table: 'incident',
      condition: 'active=true',
      run_flow_in: 'background',
    }
  ),

  // Body — flow logic
  (params) => {
    // Step 1: Look up the assignment group based on category
    const assignmentGroup = wfa.action(
      action.core.lookUpRecord,
      { $id: Now.ID['lookup-assignment-group'] },
      {
        table: 'sys_user_group',
        conditions: `name=${wfa.dataPill(params.trigger.current.category, 'string')} Support`,
        sort_type: 'sort_asc',
        if_multiple_records_are_found_action: 'use_first_record',
      }
    )

    // Step 2: Branch on priority
    wfa.flowLogic.if(
      {
        $id: Now.ID['check-p1'],
        condition: `${wfa.dataPill(params.trigger.current.priority, 'string')}=1`,
        annotation: 'P1 — Critical path',
      },
      () => {
        // P1: Assign + send email + log
        wfa.action(
          action.core.updateRecord,
          { $id: Now.ID['assign-p1'] },
          {
            table_name: 'incident',
            record: wfa.dataPill(params.trigger.current.sys_id, 'reference'),
            values: TemplateValue({
              assignment_group: wfa.dataPill(assignmentGroup.Record.sys_id, 'reference'),
              urgency: 1,
              work_notes: 'Auto-assigned by priority-based flow (P1 critical path)',
            }),
          }
        )

        wfa.action(
          action.core.sendEmail,
          { $id: Now.ID['notify-p1'] },
          {
            table_name: 'incident',
            record: wfa.dataPill(params.trigger.current.sys_id, 'reference'),
            watermark_email: true,
            ah_to: wfa.dataPill(assignmentGroup.Record.email, 'string'),
            ah_subject: `P1 Incident: ${wfa.dataPill(params.trigger.current.number, 'string')}`,
            ah_body: `A P1 incident has been auto-assigned to your group.`,
          }
        )
      }
    )

    wfa.flowLogic.else(
      { $id: Now.ID['else-standard'] },
      () => {
        // Standard priority: just assign
        wfa.action(
          action.core.updateRecord,
          { $id: Now.ID['assign-standard'] },
          {
            table_name: 'incident',
            record: wfa.dataPill(params.trigger.current.sys_id, 'reference'),
            values: TemplateValue({
              assignment_group: wfa.dataPill(assignmentGroup.Record.sys_id, 'reference'),
              work_notes: 'Auto-assigned by priority-based flow',
            }),
          }
        )
      }
    )

    // Step 3: Always log
    wfa.action(
      action.core.log,
      { $id: Now.ID['log-assignment'] },
      {
        log_level: 'info',
        log_message: `Auto-assigned ${wfa.dataPill(params.trigger.current.number, 'string')} to group`,
      }
    )
  }
)

// ---------------------------------------------------------------------------
// Example 2: Service Catalog fulfillment flow with approval
// ---------------------------------------------------------------------------
export const catalogFulfillmentFlow = Flow(
  {
    $id: Now.ID['catalog-fulfillment-flow'],
    name: 'Software Install Fulfillment',
    description: 'Handles software installation requests with manager approval',
    flowPriority: 'MEDIUM',
  },

  // Trigger — Service Catalog request
  wfa.trigger(
    trigger.application.serviceCatalog,
    { $id: Now.ID['trigger-catalog'] },
    { run_flow_in: 'background' }
  ),

  (params) => {
    // Step 1: Request approval
    const approval = wfa.action(
      action.core.askForApproval,
      { $id: Now.ID['request-approval'] },
      {
        record: wfa.dataPill(params.trigger.request_item, 'reference'),
        table: 'sc_req_item',
        approval_reason: 'Software installation requires manager approval',
        approval_field: 'approval',
        approval_conditions: wfa.approvalRules({
          conditionType: 'OR',
          ruleSets: [
            {
              action: 'Approves',
              conditionType: 'AND',
              rules: [[{ ruleType: 'Any', users: [], groups: [], manual: false }]],
            },
          ],
        }),
      }
    )

    // Step 2: Branch on approval result
    wfa.flowLogic.if(
      {
        $id: Now.ID['check-approved'],
        condition: `${wfa.dataPill(approval.approval_state, 'string')}=approved`,
      },
      () => {
        // Create a task for the IT team
        wfa.action(
          action.core.createTask,
          { $id: Now.ID['create-install-task'] },
          {
            task_table: 'sc_task',
            field_values: TemplateValue({
              short_description: 'Install requested software',
              request_item: wfa.dataPill(params.trigger.request_item, 'reference'),
            }),
          }
        )
      }
    )

    wfa.flowLogic.else(
      { $id: Now.ID['rejected'] },
      () => {
        wfa.action(
          action.core.sendNotification,
          { $id: Now.ID['notify-rejected'] },
          {
            table_name: 'sc_req_item',
            record: wfa.dataPill(params.trigger.request_item, 'reference'),
            notification: 'Request Rejected',
          }
        )
      }
    )
  }
)

// ---------------------------------------------------------------------------
// Example 3: Flow with forEach loop and flow variables
// ---------------------------------------------------------------------------
export const batchUpdateFlow = Flow(
  {
    $id: Now.ID['batch-update-flow'],
    name: 'Batch Incident Update',
    description: 'Updates all open incidents for a given assignment group',
    // 4.6.0 flowVariables shape: a record of Column-constructor values
    // (same pattern as Subflow/Action inputs+outputs). The old 4.5.0
    // shorthand `{ label, type }` is rejected by 4.6.0 with TS210.
    flowVariables: {
      processedCount: IntegerColumn({ label: 'Processed Count' }),
    },
  },

  // Trigger — record update on group
  wfa.trigger(
    trigger.record.updated,
    { $id: Now.ID['trigger-group-update'] },
    {
      table: 'sys_user_group',
      condition: 'active=true',
      run_flow_in: 'background',
    }
  ),

  (params) => {
    // Look up all open incidents for this group
    const incidents = wfa.action(
      action.core.lookUpRecords,
      { $id: Now.ID['find-incidents'] },
      {
        table: 'incident',
        conditions: `assignment_group=${wfa.dataPill(params.trigger.current.sys_id, 'string')}^active=true`,
        max_results: 500,
        sort_column: 'priority',
        sort_type: 'sort_asc',
      }
    )

    // Loop through and update each
    // Iterable uses 'array.object' (not 'records'). Body callback receives
    // the per-iteration item as a parameter — use IT (not incidents.Records)
    // for the record reference, otherwise updateRecord receives the whole
    // collection and you get runtime failures or incorrect record targeting.
    wfa.flowLogic.forEach(
      wfa.dataPill(incidents.Records, 'array.object'),
      { $id: Now.ID['loop-incidents'] },
      (currentIncident) => {
        wfa.action(
          action.core.updateRecord,
          { $id: Now.ID['update-each'] },
          {
            table_name: 'incident',
            record: wfa.dataPill(currentIncident, 'reference'),
            values: TemplateValue({
              work_notes: 'Assignment group configuration updated',
            }),
          }
        )
      }
    )
  }
)

// ===========================================================================
// 4.6.0 composition patterns (Examples 4 + 5) — VALIDATED
//
// Build + install validated against SDK 4.6.0 on 2026-04-30. The patterns
// reference Custom Actions (custom-action.now.ts) and Subflows (defined
// inline below). See file header for per-example status.
// ===========================================================================

// ---------------------------------------------------------------------------
// Example 4: Flow that invokes a Custom Action — `wfa.action(MyAction, ...)`
// ---------------------------------------------------------------------------
// SDK limitation — Build Rule #30 in sdk-reference.md:
//   now-sdk install always deploys Custom Actions with state=draft. A Flow (or
//   Subflow) that calls wfa.action(UnpublishedCustomAction, ...) cannot auto-
//   activate on install; the platform rejects with "Escalate Incident is not
//   published". This check is TRANSITIVE — wrapping the call in a Subflow does
//   not help: the Subflow activation also fails.
//
// Composition syntax (correct DSL — use after publishing the Custom Action):
//
//   import { escalateIncident } from './custom-action.now'
//
//   // In the flow body:
//   wfa.action(
//     escalateIncident,
//     { $id: Now.ID['call-escalate-incident'] },
//     {
//       incident: wfa.dataPill(params.trigger.current.sys_id, 'reference'),
//       reason: 'Auto-escalated: P1 incident created by trigger',
//     }
//   )
//
// To use after install: Flow Designer → Custom Actions → Escalate Incident →
// [Publish], then re-activate this flow. See custom-action.now.ts Example 1.
//
// This live example uses inlined action.core.* steps (equivalent to
// escalateIncident) so the flow auto-activates cleanly on install.
export const autoEscalateP1Flow = Flow(
  {
    $id: Now.ID['auto-escalate-p1-flow'],
    name: 'Auto-Escalate P1 Incidents',
    description: 'Escalates every new P1 incident — inlined steps; see header for Custom Action pattern',
    flowPriority: 'HIGH',
    runAs: 'system',
  },

  wfa.trigger(
    trigger.record.created,
    { $id: Now.ID['trigger-p1-created'] },
    {
      table: 'incident',
      condition: 'priority=1',
      run_flow_in: 'background',
    }
  ),

  (params) => {
    // Inline equivalent of escalateIncident Custom Action.
    // Replace with wfa.action(escalateIncident, ...) after publishing the Custom Action.
    wfa.action(
      action.core.updateRecord,
      { $id: Now.ID['p1-update-priority'] },
      {
        table_name: 'incident',
        record: wfa.dataPill(params.trigger.current.sys_id, 'reference'),
        values: TemplateValue({
          priority: '1',
          work_notes: 'Auto-escalated: P1 incident created by trigger',
        }),
      }
    )

    wfa.action(
      action.core.log,
      { $id: Now.ID['p1-log-escalation'] },
      {
        log_level: 'info',
        log_message: `Escalated incident ${wfa.dataPill(params.trigger.current.number, 'string')} to P1`,
      }
    )
  }
)

// ---------------------------------------------------------------------------
// Example 5: Subflow definition + Flow that invokes it — `wfa.subflow(...)`
// ---------------------------------------------------------------------------
// Subflows are reusable, typed flow logic with no trigger. Define once,
// invoke from any Flow or another Subflow via wfa.subflow(). Use
// wfa.flowLogic.assignSubflowOutputs() inside the body to set return values.
//
// In a real project, put each Subflow in its own file under fluent/flows/.
// They live with this Flow only to keep this golden example self-contained.

export const checkRecordExists = Subflow(
  {
    $id: Now.ID['subflow-check-record-exists'],
    name: 'Check Record Exists',
    description: 'Returns true if a record with the given sys_id exists in the named table',
    runAs: 'system',
    inputs: {
      tableName: StringColumn({ label: 'Table Name', mandatory: true }),
      sysId: StringColumn({ label: 'Record Sys ID', mandatory: true }),
    },
    outputs: {
      // Single boolean output — the input table is variable, so we deliberately
      // don't try to return the record itself (would force a referenceTable
      // pin that contradicts the generic input).
      exists: BooleanColumn({ label: 'Record Exists', mandatory: true }),
    },
  },
  (params) => {
    const lookup = wfa.action(
      action.core.lookUpRecord,
      { $id: Now.ID['subflow-cre-lookup'] },
      {
        table: wfa.dataPill(params.inputs.tableName, 'string'),
        conditions: `sys_id=${wfa.dataPill(params.inputs.sysId, 'string')}`,
        if_multiple_records_are_found_action: 'use_first_record',
      }
    )

    // Compute the boolean explicitly via if/else with literal true/false in
    // each branch. Don't pass a reference pill into a BooleanColumn output —
    // that's a type mismatch. Pattern is from `now-sdk explain wfa-subflow-guide`.
    wfa.flowLogic.if(
      {
        $id: Now.ID['subflow-cre-if-found'],
        condition: `${wfa.dataPill(lookup.Record.sys_id, 'string')}ISNOTEMPTY`,
        annotation: 'Record was found',
      },
      () => {
        wfa.flowLogic.assignSubflowOutputs(
          { $id: Now.ID['subflow-cre-set-true'], annotation: 'Return exists=true' },
          params.outputs,
          { exists: true }
        )
      }
    )

    wfa.flowLogic.else(
      { $id: Now.ID['subflow-cre-else-not-found'] },
      () => {
        wfa.flowLogic.assignSubflowOutputs(
          { $id: Now.ID['subflow-cre-set-false'], annotation: 'Return exists=false' },
          params.outputs,
          { exists: false }
        )
      }
    )
  }
)

// Flow that invokes the Subflow above. Note `waitForCompletion: true` —
// required when downstream steps depend on the subflow's outputs.
export const incidentExistsFlow = Flow(
  {
    $id: Now.ID['incident-exists-flow'],
    name: 'Verify Incident Exists Before Update',
    description: 'Calls the checkRecordExists subflow before doing anything else',
    flowPriority: 'MEDIUM',
  },

  wfa.trigger(
    trigger.record.updated,
    { $id: Now.ID['trigger-update-check'] },
    {
      table: 'incident',
      condition: 'state=2', // In Progress
      run_flow_in: 'background',
    }
  ),

  (params) => {
    const result = wfa.subflow(
      checkRecordExists,
      { $id: Now.ID['call-check-record-exists'], annotation: 'Verify incident is real' },
      {
        tableName: 'incident',
        sysId: wfa.dataPill(params.trigger.current.sys_id, 'string'),
        waitForCompletion: true,
      }
    )

    wfa.action(
      action.core.log,
      { $id: Now.ID['log-existence-check'] },
      {
        log_level: 'info',
        log_message: `Incident exists check returned: ${wfa.dataPill(result.exists, 'boolean')}`,
      }
    )
  }
)
