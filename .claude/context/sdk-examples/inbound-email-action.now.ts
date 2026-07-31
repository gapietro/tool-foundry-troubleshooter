/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on
 * 2026-04-30. Required flattening the `+` string-concat patterns in
 * fieldAction/replyEmail to single literals — see Build Rule #29 in
 * sdk-reference.md.
 *
 * Golden Example: InboundEmailAction — Process inbound emails into ServiceNow records
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/inbound-email-action
 * Import:   import { InboundEmailAction } from '@servicenow/sdk/core'
 * Requires: SDK >= 4.6.0
 *
 * Key concepts:
 *   - action: 'record_action' (create/update a record) | 'reply_email' (auto-reply)
 *   - type:   'new' | 'reply' | 'forward' — when the action triggers
 *   - fieldAction: encoded query string with three flavors of values:
 *       static:        field=value
 *       static-ref:    field=<sys_id>
 *       dynamic-from-email: fieldDYNAMIC<sys_filter_option_dynamic-sys_id>
 *     Separator is `^`, terminate with `^EQ`.
 *   - script: optional custom logic when fieldAction isn't enough.
 *     Receives `current` (target GlideRecord), `event` (sysevent),
 *     `email` (EmailWrapper), `logger`, `classifier`. Prefer Now.include() for
 *     anything more than a few lines.
 *   - filterCondition: encoded query restricting which records this action applies to.
 *   - stopProcessing: true halts further inbound actions for this email.
 */

import '@servicenow/sdk/global'
import { InboundEmailAction } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Create incident from new inbound email — fieldAction (no script)
// ---------------------------------------------------------------------------
// Sets short_description from the email Subject (the OOB sys_filter_option_dynamic
// "Subject" → b637bd21ef3221002841f7f775c0fbb6) and description from the email Body
// (OOB Body → 367bf121ef3221002841f7f775c0fbe2). Replace these sys_ids with the
// dynamic-filter records present on your target instance.
export const createIncidentFromEmail = InboundEmailAction({
  $id: Now.ID['iea-create-incident-from-email'],
  name: 'Create Incident from Inbound Email',
  description: 'Opens a new incident when an external email lands in the inbox',
  table: 'incident',
  type: 'new',
  action: 'record_action',
  active: true,
  order: 100,
  // Map email Subject → short_description, Body → description, set caller_id
  // from sender, default priority to 3. Note: Fluent property values must be
  // single string literals — no `+` concatenation between literals (Build
  // Rule #29). Use one long string and wrap it for readability if needed.
  fieldAction:
    'short_descriptionDYNAMICb637bd21ef3221002841f7f775c0fbb6^descriptionDYNAMIC367bf121ef3221002841f7f775c0fbe2^caller_idDYNAMIC2fd8e97bef3221002841f7f775c0fbc1^priority=3^active=true^EQ',
})

// ---------------------------------------------------------------------------
// Example 2: Auto-reply on first email — no record creation
// ---------------------------------------------------------------------------
export const autoReplyOnNewEmail = InboundEmailAction({
  $id: Now.ID['iea-auto-reply-new-email'],
  name: 'Auto-Reply to New Inbound Email',
  description: 'Sends an automated acknowledgement to the sender',
  type: 'new',
  action: 'reply_email',
  active: true,
  order: 50, // Run before record-creating actions
  replyEmail:
    '<p>Thank you for contacting us. We have received your email and a support agent will respond within one business day.</p>',
})

// ---------------------------------------------------------------------------
// Example 3: Custom script — stamp incident with email metadata
// ---------------------------------------------------------------------------
// Use a script when fieldAction can't express the logic: parsing email body,
// applying conditional updates, calling out to other tables, etc.
//
// For anything beyond ~5 lines, move the script out via:
//   script: Now.include('./scripts/stamp-incident-from-email.js')
export const stampIncidentFromEmail = InboundEmailAction({
  $id: Now.ID['iea-script-stamp-incident'],
  name: 'Stamp Incident with Email Metadata',
  description: 'Adds email subject, sender, and received timestamp to the work notes',
  table: 'incident',
  type: 'new',
  action: 'record_action',
  active: true,
  order: 200,
  filterCondition: 'category=inquiry',
  script: `(function runAction() {
    current.work_notes =
      'Inbound email received\\n' +
      'Subject: ' + email.subject + '\\n' +
      'From: ' + email.from + '\\n' +
      'Received: ' + email.body_text;
    logger.info('Stamped incident from inbound email: ' + email.subject);
  })();`,
})
