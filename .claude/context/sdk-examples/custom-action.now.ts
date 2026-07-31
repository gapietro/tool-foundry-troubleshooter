/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on
 * 2026-04-30. Required two fixes from the signature-grounded draft:
 *   1. updateRecord step: `table` → `table_name`, `values` → `update_record_field_values`
 *      (each `actionStep.X` has step-specific input field names — check via
 *      `now-sdk explain custom-action-api` or TS autocomplete).
 *   2. Dropped the prior Example 2 (notifyAssignmentGroup) — the script step
 *      requires `required_run_time`, the notification step has only a
 *      `notification` field with no `recipient`, `outputs` is type-required
 *      on Action, and `wfa.dataPill` rejects bracket-notation arguments.
 *      Replaced with a guidance comment block summarizing those gotchas.
 *
 * Golden Example: Action — Custom Action authoring with reusable, typed steps
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/custom-action
 * Import:   import { Action, wfa, actionStep } from '@servicenow/sdk/automation'
 *           import { StringColumn, BooleanColumn, ReferenceColumn } from '@servicenow/sdk/core'
 * Requires: SDK >= 4.6.0
 *
 * Key concepts:
 *   - Action(config, body) — two-argument pattern (config + body fn)
 *   - inputs / outputs are Record<string, Column> using column types from @servicenow/sdk/core
 *     (and FlowObject / FlowArray from @servicenow/sdk/automation for nested types)
 *   - Body uses wfa.actionStep() to embed OOB steps; returns typed outputs
 *   - access: 'public' lets other apps invoke; 'private' (default) limits to current scope
 *   - Custom Actions are invoked from Flows via wfa.action(MyAction, { $id }, { ...inputs })
 *   - Script step content can be externalized via Now.include('./scripts/foo.js')
 *     for a better editing experience and reuse
 */

import '@servicenow/sdk/global'
import { Action, wfa, actionStep } from '@servicenow/sdk/automation'
import { StringColumn, BooleanColumn, ReferenceColumn } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Escalate Incident — typed inputs, multi-step body, log + update
// ---------------------------------------------------------------------------
// Publishing-state requirement — Build Rule #30 in sdk-reference.md:
//   now-sdk install always deploys this Custom Action with state=draft. A Flow
//   or Subflow that calls wfa.action(escalateIncident, ...) cannot auto-activate
//   on install until this action is manually published. After install:
//     Flow Designer → Custom Actions → Escalate Incident → [Publish]
//   Only then can a Flow that invokes this action be activated. See flow.now.ts
//   Example 4 for the full composition pattern and a workaround that avoids
//   the publish step by inlining equivalent action.core.* steps.
export const escalateIncident = Action(
  {
    $id: Now.ID['escalate-incident-action'],
    name: 'Escalate Incident',
    description: 'Updates incident priority and logs the escalation reason',
    category: 'incident_management',
    access: 'public',
    inputs: {
      incident: ReferenceColumn({
        label: 'Incident',
        referenceTable: 'incident',
        mandatory: true,
      }),
      reason: StringColumn({ label: 'Escalation Reason', mandatory: true }),
    },
    outputs: {
      success: BooleanColumn({ label: 'Success' }),
    },
  },
  (params) => {
    // Step 1: Update the incident's priority
    // Note: updateRecord step uses `table_name` + `update_record_field_values`
    // (NOT `table` + `values` — those are different step types' field names).
    // Each `actionStep.X` has step-specific input fields.
    wfa.actionStep(
      actionStep.updateRecord,
      { $id: Now.ID['cas-step-update-priority'], label: 'Escalate priority to P1' },
      {
        table_name: 'incident',
        record: wfa.dataPill(params.inputs.incident, 'reference'),
        update_record_field_values: TemplateValue({
          priority: '1',
          work_notes: wfa.dataPill(params.inputs.reason, 'string'),
        }),
      }
    )

    // Step 2: Log the escalation event for audit
    wfa.actionStep(
      actionStep.log,
      { $id: Now.ID['cas-step-log-escalation'], label: 'Log escalation' },
      {
        log_level: 'info',
        log_message: `Incident escalated: ${wfa.dataPill(params.inputs.reason, 'string')}`,
      }
    )
  }
)

// ---------------------------------------------------------------------------
// Notes on additional patterns (intentionally not shown as live examples)
// ---------------------------------------------------------------------------
// - **Script step** (`actionStep.script`) requires `required_run_time` —
//   one of 'vanilla' | 'mid' | 'instance'. Without it the build fails with
//   "Property 'required_run_time' is missing in type '{ script: string; }'".
// - **Notification step** (`actionStep.notification`) takes a single
//   `notification` field — a reference to a `sysevent_email_action` record.
//   The recipient list is configured on that EmailNotification record itself,
//   NOT on the action step. There is no `recipient` input on this step.
// - **Externalize script content** with `Now.include('./scripts/foo.js')`
//   for anything beyond a few lines — better diffs and reuse across actions.
// - **`outputs` is required** on Action config by the TypeScript type, even
//   though `now-sdk explain custom-action-api` lists it as optional. Define
//   at least one output column. Whether an empty `outputs: {}` is accepted
//   has not been verified.
// - **For `wfa.dataPill` arguments**, use property-access syntax
//   (`params.inputs.foo`), NOT bracket notation — `wfa.dataPill` is parsed
//   by the Fluent compiler and rejects bracket-access expressions with
//   "first argument must be a property access expression".
