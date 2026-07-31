/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * No code changes from the 4.5.0 shape. The example's `Now.include()` reference
 * is to a companion stub file at `./server/ChangeRiskUtils.js` (committed
 * alongside under `context/sdk-examples/server/`); copy that directory along
 * with this file when adapting the example to a real project.
 *
 * Golden Example: ScriptInclude — Reusable server-side classes
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/script-include
 * Import:   import { ScriptInclude } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - name MUST match the class name in the script
 *   - clientCallable: true enables GlideAjax calls from client scripts
 *   - accessibleFrom: 'public' allows cross-scope access
 *   - Use Now.include() for external .js files (recommended for non-trivial scripts)
 *   - Script must define a single class or global function
 */

import '@servicenow/sdk/global'
import { ScriptInclude } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Standard class-based script include
// ---------------------------------------------------------------------------
export const incidentUtils = ScriptInclude({
  $id: Now.ID['incident-utils'],
  name: 'IncidentUtils',
  description: 'Utility functions for incident processing',
  active: true,
  accessibleFrom: 'public',
  script: `var IncidentUtils = Class.create();
IncidentUtils.prototype = {
  initialize: function() {},

  getRelatedIncidents: function(cmdbCi) {
    var incidents = [];
    var gr = new GlideRecord('incident');
    gr.addQuery('cmdb_ci', cmdbCi);
    gr.addQuery('active', true);
    gr.orderByDesc('sys_created_on');
    gr.setLimit(10);
    gr.query();
    while (gr.next()) {
      incidents.push({
        number: gr.getValue('number'),
        short_description: gr.getValue('short_description'),
        priority: gr.getValue('priority'),
        state: gr.getDisplayValue('state')
      });
    }
    return incidents;
  },

  calculatePriority: function(impact, urgency) {
    var matrix = {
      '1-1': 1, '1-2': 2, '1-3': 3,
      '2-1': 2, '2-2': 3, '2-3': 4,
      '3-1': 3, '3-2': 4, '3-3': 5
    };
    return matrix[impact + '-' + urgency] || 4;
  },

  type: 'IncidentUtils'
};`,
})

// ---------------------------------------------------------------------------
// Example 2: Client-callable script include (GlideAjax)
// ---------------------------------------------------------------------------
export const userLookupAjax = ScriptInclude({
  $id: Now.ID['user-lookup-ajax'],
  name: 'UserLookupAjax',
  description: 'Client-callable user lookup for forms',
  active: true,
  clientCallable: true,
  script: `var UserLookupAjax = Class.create();
UserLookupAjax.prototype = Object.extendsObject(AbstractAjaxProcessor, {
  getUserDetails: function() {
    var userId = this.getParameter('sysparm_user_id');
    var gr = new GlideRecord('sys_user');
    if (gr.get(userId)) {
      var result = {
        name: gr.getDisplayValue('name'),
        email: gr.getValue('email'),
        department: gr.getDisplayValue('department'),
        manager: gr.getDisplayValue('manager')
      };
      return JSON.stringify(result);
    }
    return JSON.stringify({ error: 'User not found' });
  },

  type: 'UserLookupAjax'
});`,
})

// ---------------------------------------------------------------------------
// Example 3: External file pattern (recommended for large scripts)
// ---------------------------------------------------------------------------
export const changeRiskUtils = ScriptInclude({
  $id: Now.ID['change-risk-utils'],
  name: 'ChangeRiskUtils',
  description: 'Risk assessment utilities for change management',
  active: true,
  accessibleFrom: 'public',
  script: Now.include('./server/ChangeRiskUtils.js'),
})
