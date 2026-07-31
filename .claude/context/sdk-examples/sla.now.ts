/**
 * Golden Example: Sla — SLA definitions
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/sla
 * Import:   import { Sla } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - duration: Duration({}) for target time
 *   - schedule: sys_id of business schedule
 *   - conditions: { start, stop, pause, resume, cancel }
 *   - Conditional field validation rules at build time
 */

import '@servicenow/sdk/global'
import { Sla } from '@servicenow/sdk/core'
// Duration is a GLOBAL — do NOT import it

export const p1ResponseSla = Sla({
  $id: Now.ID['p1-response-sla'],
  name: 'P1 Incident Response',
  table: 'incident',
  active: true,
  duration: Duration({ hours: 1 }),
  schedule: Now.ref('cmn_schedule', { name: '8-5 weekdays' }),
  conditions: {
    start: 'priority=1^active=true',
    stop: 'state=6^ORstate=7',
  },
})

export const p2ResolutionSla = Sla({
  $id: Now.ID['p2-resolution-sla'],
  name: 'P2 Incident Resolution',
  table: 'incident',
  active: true,
  duration: Duration({ hours: 24 }),
  schedule: Now.ref('cmn_schedule', { name: '8-5 weekdays' }),
  conditions: {
    start: 'priority=2^active=true',
    stop: 'state=6',
    pause: 'state=3', // On hold
    resume: 'state!=3',
  },
})
