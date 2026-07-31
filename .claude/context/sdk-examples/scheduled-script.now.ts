/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * Required one fix from the 4.5.0 shape:
 *   - `frequency: 'weekly'` requires `daysOfWeek: [...]` (plural, array). The
 *     prior singular `dayOfWeek: 'monday'` is rejected by 4.6.0 with TS11
 *     "daysOfWeek must be defined when frequency is 'weekly'".
 * Plus the example uses Now.include() against `./server/weekly-report.js` and
 * `./server/monthly-billing.js`; companion stubs are committed alongside under
 * context/sdk-examples/server/.
 *
 * Golden Example: ScheduledScript — Scheduled server-side jobs
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/scheduled-script
 * Import:   import { ScheduledScript } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - frequency: 'daily' | 'weekly' | 'monthly' | 'periodically' | 'yearly'
 *   - executionTime: { hours, minutes, seconds }
 *   - executionInterval: Duration({}) for periodic jobs
 *   - daysOfWeek: [...] (plural array) for weekly scheduling — required when
 *     frequency is 'weekly' (4.6.0)
 *   - dayOfMonth for monthly scheduling
 *   - conditional: true + condition script for conditional execution
 *   - runAs: user reference for execution context
 *   - 4.6.0+: script field officially supports module references (Now.include
 *     for build-time inlining of a separate .js file — see Examples 2 and 4)
 */

import '@servicenow/sdk/global'
import { ScheduledScript } from '@servicenow/sdk/core'
// Duration is a GLOBAL — do NOT import it

// ---------------------------------------------------------------------------
// Example 1: Daily cleanup job
// ---------------------------------------------------------------------------
export const dailyCleanup = ScheduledScript({
  $id: Now.ID['daily-cleanup'],
  name: 'Daily Stale Incident Cleanup',
  active: true,
  frequency: 'daily',
  executionTime: { hours: 2, minutes: 0, seconds: 0 },
  script: `(function() {
    var gr = new GlideRecord('incident');
    gr.addQuery('state', 'IN', '1,2'); // New or In Progress
    gr.addQuery('sys_updated_on', '<', gs.daysAgoStart(30));
    gr.query();
    var count = 0;
    while (gr.next()) {
      gr.work_notes = 'Auto-closed: no activity for 30 days';
      gr.state = 7; // Closed
      gr.close_code = 'Closed/Resolved by Caller';
      gr.update();
      count++;
    }
    gs.info('Daily cleanup closed ' + count + ' stale incidents');
  })();`,
})

// ---------------------------------------------------------------------------
// Example 2: Weekly report — runs every Monday at 9 AM
// ---------------------------------------------------------------------------
export const weeklyReport = ScheduledScript({
  $id: Now.ID['weekly-report'],
  name: 'Weekly Incident Summary Report',
  active: true,
  frequency: 'weekly',
  daysOfWeek: ['monday'], // 4.5.0 used singular `dayOfWeek`; 4.6.0 requires plural array
  executionTime: { hours: 9, minutes: 0, seconds: 0 },
  script: Now.include('./server/weekly-report.js'),
})

// ---------------------------------------------------------------------------
// Example 3: Periodic check — every 15 minutes
// ---------------------------------------------------------------------------
export const periodicHealthCheck = ScheduledScript({
  $id: Now.ID['periodic-health-check'],
  name: 'Agent Health Check',
  active: true,
  frequency: 'periodically',
  executionInterval: Duration({ minutes: 15 }),
  conditional: true,
  condition: `(function() {
    // Only run during business hours
    var hour = new GlideDateTime().getLocalTime().getHourLocalTime();
    return hour >= 8 && hour <= 18;
  })()`,
  script: `(function() {
    // Check agent configurations for issues
    var gr = new GlideRecord('x_snc_myapp_agent_config');
    gr.addQuery('active', true);
    gr.query();
    while (gr.next()) {
      // Validate each config
      try {
        JSON.parse(gr.getValue('config_json'));
      } catch (e) {
        gs.warn('Invalid JSON in agent config: ' + gr.getValue('name'));
      }
    }
  })();`,
})

// ---------------------------------------------------------------------------
// Example 4: Monthly billing — 1st of each month
// ---------------------------------------------------------------------------
export const monthlyBilling = ScheduledScript({
  $id: Now.ID['monthly-billing'],
  name: 'Monthly License Audit',
  active: true,
  frequency: 'monthly',
  dayOfMonth: 1,
  executionTime: { hours: 6, minutes: 0, seconds: 0 },
  executionStart: '2026-01-01 00:00:00',
  script: Now.include('./server/monthly-billing.js'),
})
