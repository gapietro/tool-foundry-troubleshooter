/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * No code changes from the 4.5.0 shape. The example's `Now.include()` reference
 * is to a companion stub file at `./client/change-request-onload.js` (committed
 * alongside under `context/sdk-examples/client/`); copy that directory along
 * with this file when adapting the example to a real project.
 *
 * Golden Example: ClientScript — Client-side form scripts
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/client-script
 * Import:   import { ClientScript } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - type: 'onLoad' | 'onChange' | 'onSubmit' | 'onCellEdit'
 *   - field: required for onChange and onCellEdit
 *   - uiType: 'desktop' | 'all' | 'mobile_or_service_portal'
 *   - isolateScript: true for strict mode (no DOM/jQuery)
 *   - appliesExtended: true to run on child tables
 *   - Use Now.include() for external .js files
 */

import '@servicenow/sdk/global'
import { ClientScript } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: onLoad — show info message and set defaults
// ---------------------------------------------------------------------------
export const incidentOnLoad = ClientScript({
  $id: Now.ID['incident-onload'],
  name: 'Incident Form Load',
  table: 'incident',
  type: 'onLoad',
  active: true,
  uiType: 'all',
  script: `function onLoad() {
    // Show a reminder for P1 incidents
    if (g_form.getValue('priority') == '1') {
      g_form.addInfoMessage('This is a P1 incident. Please follow the major incident process.');
    }
    // Hide fields not needed for new records
    if (g_form.isNewRecord()) {
      g_form.setVisible('close_code', false);
      g_form.setVisible('close_notes', false);
    }
  }`,
})

// ---------------------------------------------------------------------------
// Example 2: onChange — react to field value changes
// ---------------------------------------------------------------------------
export const priorityOnChange = ClientScript({
  $id: Now.ID['priority-onchange'],
  name: 'Priority Change Handler',
  table: 'incident',
  type: 'onChange',
  field: 'priority',
  active: true,
  script: `function onChange(control, oldValue, newValue, isLoading) {
    if (isLoading || newValue === '') return;
    // Make assignment_group mandatory for P1/P2
    if (newValue == '1' || newValue == '2') {
      g_form.setMandatory('assignment_group', true);
      g_form.addInfoMessage('High priority: assignment group is now required.');
    } else {
      g_form.setMandatory('assignment_group', false);
    }
  }`,
})

// ---------------------------------------------------------------------------
// Example 3: onSubmit — validate before saving
// ---------------------------------------------------------------------------
export const incidentOnSubmit = ClientScript({
  $id: Now.ID['incident-onsubmit'],
  name: 'Incident Submit Validation',
  table: 'incident',
  type: 'onSubmit',
  active: true,
  script: `function onSubmit() {
    // Require close notes when resolving
    var state = g_form.getValue('state');
    if (state == '6' && !g_form.getValue('close_notes')) {
      g_form.addErrorMessage('Please provide close notes before resolving.');
      return false;
    }
    return true;
  }`,
})

// ---------------------------------------------------------------------------
// Example 4: External file pattern
// ---------------------------------------------------------------------------
export const complexOnLoad = ClientScript({
  $id: Now.ID['complex-onload'],
  name: 'Complex Form Initialization',
  table: 'change_request',
  type: 'onLoad',
  active: true,
  script: Now.include('./client/change-request-onload.js'),
})
