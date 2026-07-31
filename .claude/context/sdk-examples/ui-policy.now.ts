/**
 * Golden Example: UiPolicy — Dynamic form field behavior
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/ui-policy
 * Import:   import { UiPolicy } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - conditions: encoded query that triggers the policy
 *   - actions[]: field-level changes (visible, mandatory, readOnly)
 *   - Each action value: true | false | 'ignore' (no change)
 *   - reverseIfFalse: undo actions when condition no longer met
 *   - onLoad: apply on form load (not just on change)
 *   - scriptTrue / scriptFalse for custom JS execution
 *
 * Build rule: The table property MUST reference a table within the app's
 *   scope (e.g., 'x_snc_myapp_review_task'). Scoped apps cannot create
 *   UI Policies targeting out-of-box tables like 'incident' or 'task'.
 *   The build will fail with a scope violation if an OOB table is used.
 */

import '@servicenow/sdk/global'
import { UiPolicy } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Show/hide fields based on priority (scoped table)
// ---------------------------------------------------------------------------
export const p1FieldVisibility = UiPolicy({
  $id: Now.ID['p1-field-visibility'],
  shortDescription: 'Show additional fields for high-priority review tasks',
  table: 'x_snc_myapp_review_task',
  active: true,
  onLoad: true,
  order: 100,
  conditions: 'priority=1',
  reverseIfFalse: true,

  actions: [
    { field: 'active', visible: true, mandatory: true, readOnly: false },
    { field: 'description', visible: true, mandatory: true, readOnly: false },
    { field: 'name', visible: true, mandatory: false, readOnly: false },
  ],
})

// ---------------------------------------------------------------------------
// Example 2: Make fields read-only when resolved
// ---------------------------------------------------------------------------
export const resolvedReadOnly = UiPolicy({
  $id: Now.ID['resolved-read-only'],
  shortDescription: 'Lock fields when review task is resolved',
  table: 'x_snc_myapp_review_task',
  active: true,
  onLoad: true,
  conditions: 'state=6',
  reverseIfFalse: true,

  actions: [
    { field: 'name', visible: 'ignore', mandatory: 'ignore', readOnly: true },
    { field: 'description', visible: 'ignore', mandatory: 'ignore', readOnly: true },
    { field: 'active', visible: 'ignore', mandatory: 'ignore', readOnly: true },
  ],
})

// ---------------------------------------------------------------------------
// Example 3: With custom scripts
// ---------------------------------------------------------------------------
export const conditionalMandatory = UiPolicy({
  $id: Now.ID['conditional-mandatory'],
  shortDescription: 'Require justification for status change',
  table: 'x_snc_myapp_review_task',
  active: true,
  conditions: 'active=false',
  runScripts: true,
  scriptTrue: `g_form.showFieldMsg('description', 'Please document the reason for closing this review task', 'info');`,
  scriptFalse: `g_form.hideFieldMsg('description');`,
  actions: [
    { field: 'description', visible: true, mandatory: true, readOnly: false },
  ],
})
