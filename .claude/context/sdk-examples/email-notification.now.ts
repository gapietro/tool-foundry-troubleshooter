/**
 * Golden Example: EmailNotification — Automated email notifications
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/email-notification
 * Import:   import { EmailNotification } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - table: target table
 *   - triggerConditions: onRecordInsert / onRecordUpdate
 *   - recipientDetails: recipientFields[] with table field names
 *   - emailContent: subject + messageHtml with ${field} tokens
 */

import '@servicenow/sdk/global'
import { EmailNotification } from '@servicenow/sdk/core'

export const incidentCreatedNotification = EmailNotification({
  $id: Now.ID['incident-created-notification'],
  name: 'New Incident Assigned',
  table: 'incident',
  active: true,
  triggerConditions: {
    onRecordInsert: true,
    onRecordUpdate: false,
  },
  recipientDetails: {
    recipientFields: ['assigned_to', 'watch_list'],
  },
  emailContent: {
    subject: 'New Incident Assigned: ${number} - ${short_description}',
    messageHtml: `<p>A new incident has been assigned to you:</p>
<table>
  <tr><td><b>Number:</b></td><td>\${number}</td></tr>
  <tr><td><b>Priority:</b></td><td>\${priority}</td></tr>
  <tr><td><b>Description:</b></td><td>\${short_description}</td></tr>
  <tr><td><b>Category:</b></td><td>\${category}</td></tr>
</table>
<p><a href="\${URI_REF}">View Incident</a></p>`,
  },
})
