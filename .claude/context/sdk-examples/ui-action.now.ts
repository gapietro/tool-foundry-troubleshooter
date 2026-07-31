/**
 * Golden Example: UiAction — Form/list buttons, links, context menus
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/ui-action
 * Import:   import { UiAction } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - Display options: form (showButton/showLink/showContextMenu), list (same + bannerButton)
 *   - style: 'primary' | 'destructive' | 'unstyled'
 *   - condition: visibility script
 *   - client: { isClient, onClick } for client-side execution
 *   - workspace: { clientScriptV2, isConfigurableWorkspace } for workspace support
 *   - roles[] for access control
 *
 * Build rule: The `form` object only accepts showButton, showLink, showContextMenu,
 *   and style. Properties like showUpdate and showInsert do NOT exist in the SDK
 *   type and will cause build errors.
 */
import '@servicenow/sdk/global'

import { UiAction } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Server-side form button
// ---------------------------------------------------------------------------
export const escalateAction = UiAction({
  $id: Now.ID['escalate-action'],
  name: 'Escalate to Manager',
  table: 'incident',
  active: true,
  order: 100,
  condition: 'current.priority <= 2 && current.state != 6',
  roles: [Now.ref('sys_user_role', { name: 'itil' })],

  // Show as primary button on form, not on list
  form: { showButton: true, showLink: false, showContextMenu: false, style: 'primary' },
  list: { showButton: false },

  script: `(function executeAction(current) {
    current.escalation = 1;
    current.work_notes = 'Escalated to management by ' + gs.getUserDisplayName();
    current.update();
    action.setRedirectURL(current);
  })(current);`,
})

// ---------------------------------------------------------------------------
// Example 2: Client-side action with confirmation
// ---------------------------------------------------------------------------
export const closeIncidentAction = UiAction({
  $id: Now.ID['close-incident-action'],
  name: 'Close Incident',
  table: 'incident',
  active: true,
  order: 200,
  condition: 'current.state != 7',

  form: { showButton: true, style: 'destructive' },

  client: {
    isClient: true,
    onClick: `function closeIncident() {
      var dialog = new GlideDialogWindow('confirm_close');
      if (confirm('Are you sure you want to close this incident?')) {
        g_form.setValue('state', 7);
        g_form.setValue('close_code', 'Solved (Permanently)');
        gsftSubmit(null, g_form.getFormElement(), 'close_incident');
      }
    }`,
  },
})

// ---------------------------------------------------------------------------
// Example 3: List action with workspace support
// ---------------------------------------------------------------------------
export const assignToMeAction = UiAction({
  $id: Now.ID['assign-to-me-action'],
  name: 'Assign to Me',
  table: 'incident',
  active: true,
  order: 50,

  form: { showButton: true, showLink: true, style: 'unstyled' },
  list: { showButton: true, showListChoice: true },

  workspace: {
    isConfigurableWorkspace: true,
    showFormButtonV2: true,
  },

  script: `(function executeAction(current) {
    current.assigned_to = gs.getUserID();
    current.work_notes = 'Assigned to ' + gs.getUserDisplayName();
    current.update();
  })(current);`,
})
