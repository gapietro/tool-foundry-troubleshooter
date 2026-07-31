/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * No code changes from the 4.5.0 shape. The example's `Now.include()` reference
 * is to a companion stub file at `./server/notify-on-resolve.js` (committed
 * alongside under `context/sdk-examples/server/`); copy that directory along
 * with this file when adapting the example to a real project.
 *
 * Golden Example: BusinessRule — Server-side CRUD logic
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/business-rule
 * Import:   import { BusinessRule } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - when: 'before' | 'after' | 'async' | 'display'
 *   - action: ['insert'] | ['update'] | ['delete'] | ['query'] | combinations
 *   - script: string or (current, previous, dependencies) => void
 *   - condition / filterCondition for conditional execution
 *   - order: number for execution sequence (lower = first)
 *   - Use Now.include() for external script files
 */

import '@servicenow/sdk/global'
import { BusinessRule } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Before insert — validate and set defaults
// ---------------------------------------------------------------------------
export const validateIncidentInsert = BusinessRule({
  $id: Now.ID['validate-incident-insert'],
  name: 'Validate Incident on Insert',
  table: 'incident',
  when: 'before',
  action: ['insert'],
  active: true,
  order: 100,
  filterCondition: 'priority=1',
  script: `(function executeRule(current, previous) {
    // Ensure P1 incidents have a description
    if (!current.description) {
      current.description = current.short_description;
    }
    // Auto-set urgency to match priority
    current.urgency = current.priority;
    // Add work note
    current.work_notes = 'Auto-validated by business rule on insert';
  })(current, previous);`,
})

// ---------------------------------------------------------------------------
// Example 2: After update — trigger downstream actions
// ---------------------------------------------------------------------------
export const notifyOnResolve = BusinessRule({
  $id: Now.ID['notify-on-resolve'],
  name: 'Notify on Incident Resolution',
  table: 'incident',
  when: 'after',
  action: ['update'],
  active: true,
  order: 200,
  filterCondition: 'state=6^state_changes=true',
  script: Now.include('./server/notify-on-resolve.js'),
})

// ---------------------------------------------------------------------------
// Example 3: Async — heavy processing after commit
// ---------------------------------------------------------------------------
export const asyncAuditLog = BusinessRule({
  $id: Now.ID['async-audit-log'],
  name: 'Async Audit Log',
  table: 'change_request',
  when: 'async',
  action: ['insert', 'update', 'delete'],
  active: true,
  order: 500,
  script: `(function executeRule(current, previous) {
    var auditGr = new GlideRecord('x_snc_myapp_audit_log');
    auditGr.initialize();
    auditGr.setValue('table_name', current.getTableName());
    auditGr.setValue('record_sys_id', current.getUniqueValue());
    auditGr.setValue('action', current.operation());
    auditGr.setValue('user', gs.getUserID());
    auditGr.insert();
  })(current, previous);`,
})

// ---------------------------------------------------------------------------
// Example 4: Display — add data for the form view
// ---------------------------------------------------------------------------
export const displayEnrichment = BusinessRule({
  $id: Now.ID['display-enrichment'],
  name: 'Enrich Incident Display',
  table: 'incident',
  when: 'display',
  action: ['query'],
  active: true,
  script: `(function executeRule(current, previous) {
    // Set scratchpad data for client scripts to consume
    g_scratchpad.related_count = new GlideAggregate('incident')
      .addQuery('cmdb_ci', current.cmdb_ci)
      .addAggregate('COUNT')
      .query() && g_scratchpad.related_count;
  })(current, previous);`,
})
