/**
 * VALIDATED — All three examples (Examples 1, 2, and 3) build + install against
 * SDK 4.6.0 (verified 2026-04-30) when the placeholder scope `x_snc_myapp_` is
 * renamed to the project's actual scope. Example 3 (OverrideColumn for child
 * Security Incident table) is the 4.6.0 dictionary-override pattern.
 *
 * IMPORTANT — scope rename required when copying (applies to ALL three examples):
 * Every example uses `x_snc_myapp_*` for table names AND custom column names.
 * Replace `x_snc_myapp_` with your project's scope prefix (e.g. `x_snc_acme_`)
 * before building. Otherwise the build fails with:
 *   TS11:  'name' property should start with scope prefix '<your-scope>_'
 *   TS303: Column name should be prefixed with scope '<your-scope>_'
 *          if table name does not contain prefix
 *
 * Golden Example: Table — Custom table definitions
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/table
 * Import:   import { Table, StringColumn, IntegerColumn, BooleanColumn, ReferenceColumn,
 *                     DateTimeColumn, ChoiceColumn, OverrideColumn, ... } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - 49 column types available — run `now-sdk explain --list` to browse, or `now-sdk explain <columnname>-api` for a specific column type
 *   - extends: inherit from parent table (e.g., 'task' for task-based tables)
 *   - autoNumber: { prefix, numberOfDigits, number } for auto-numbering
 *   - extensible: true to allow child tables
 *   - display: column name used as display value
 *   - schema: Record<string, Column> defining all columns
 *   - Column options: label, mandatory, maxLength, defaultValue, readOnly, etc.
 *   - ReferenceColumn: referenceTable required
 *   - allowWebServiceAccess: true enables the OOB REST Table API for this table — it does
 *     NOT create sys_security_acl records. For row-level read/write/create/delete security,
 *     add explicit Acl() declarations in a separate .now.ts (see acl.now.ts).
 *
 * Build-tested rules:
 *   - MUST import '@servicenow/sdk/global' at the top of every file
 *   - ChoiceColumn choices use Record<string, string> format: { value: 'Label' }
 *     NOT the array-of-objects format [{ value: 'x', label: 'X' }]
 *   - The export const name MUST match the table name (e.g., export const x_snc_myapp_review_task)
 *     NOT a camelCase alias (e.g., reviewTask)
 */

import '@servicenow/sdk/global'
import { Table, StringColumn, IntegerColumn, BooleanColumn,
         ReferenceColumn, DateTimeColumn, ChoiceColumn,
         JsonColumn, MultiLineTextColumn,
         OverrideColumn } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Custom task-based table with auto-numbering
// ---------------------------------------------------------------------------
export const x_snc_myapp_review_task = Table({
  name: 'x_snc_myapp_review_task',
  label: 'Review Task',
  extends: 'task',
  extensible: false,

  autoNumber: {
    prefix: 'RVW',
    numberOfDigits: 7,
    number: 1000000,
  },

  display: 'number',
  audit: true,
  allowWebServiceAccess: true,

  schema: {
    review_type: ChoiceColumn({
      label: 'Review Type',
      mandatory: true,
      choices: {
        security: 'Security Review',
        architecture: 'Architecture Review',
        code: 'Code Review',
      },
    }),

    reviewer: ReferenceColumn({
      label: 'Reviewer',
      referenceTable: 'sys_user',
      mandatory: true,
    }),

    review_notes: MultiLineTextColumn({
      label: 'Review Notes',
      maxLength: 4000,
    }),

    risk_score: IntegerColumn({
      label: 'Risk Score',
      defaultValue: 0,
    }),

    approved: BooleanColumn({
      label: 'Approved',
      defaultValue: false,
    }),

    review_deadline: DateTimeColumn({
      label: 'Review Deadline',
    }),
  },
})

// ---------------------------------------------------------------------------
// Example 2: Standalone table (not extending task)
// ---------------------------------------------------------------------------
export const x_snc_myapp_agent_config = Table({
  name: 'x_snc_myapp_agent_config',
  label: 'Agent Configuration',
  extensible: true,
  display: 'name',
  audit: true,
  textIndex: true,

  schema: {
    name: StringColumn({
      label: 'Configuration Name',
      mandatory: true,
      maxLength: 100,
    }),

    description: MultiLineTextColumn({
      label: 'Description',
      maxLength: 4000,
    }),

    agent_type: ChoiceColumn({
      label: 'Agent Type',
      mandatory: true,
      choices: {
        triage: 'Triage',
        resolution: 'Resolution',
        escalation: 'Escalation',
      },
    }),

    config_json: JsonColumn({
      label: 'Configuration JSON',
    }),

    active: BooleanColumn({
      label: 'Active',
      defaultValue: true,
    }),

    owner: ReferenceColumn({
      label: 'Owner',
      referenceTable: 'sys_user',
    }),

    assignment_group: ReferenceColumn({
      label: 'Assignment Group',
      referenceTable: 'sys_user_group',
    }),

    max_iterations: IntegerColumn({
      label: 'Max Iterations',
      defaultValue: 10,
    }),
  },
})

// ===========================================================================
// DRAFT — 4.6.0 dictionary override pattern (Example 3)
//
// Signature-grounded against `now-sdk explain overridecolumn-api` for SDK 4.6.0,
// pending build validation. Replaces the old workflow of creating a separate
// sys_dictionary_override record — Table now generates them inline.
// ===========================================================================

// ---------------------------------------------------------------------------
// Example 3: Child table extending `incident` with column overrides
// ---------------------------------------------------------------------------
// A scoped Security Incident table that inherits everything from `incident`
// but tightens a few inherited columns: priority becomes mandatory, state
// becomes display-only in the UI. OverrideColumn defaults `baseTable` to the
// table in `extends`, but spell it out for clarity.
export const x_snc_myapp_security_incident = Table({
  name: 'x_snc_myapp_security_incident',
  label: 'Security Incident',
  extends: 'incident',
  extensible: false,
  display: 'number',
  audit: true,

  schema: {
    // Override inherited columns — generates sys_dictionary_override records
    priority: OverrideColumn({
      baseTable: 'incident',
      mandatory: true, // Force every security incident to have a priority
    }),

    state: OverrideColumn({
      baseTable: 'incident',
      readOnlyOption: 'display_read_only', // Read-only in UI; server scripts can still update
    }),

    // Plus net-new columns specific to security incidents
    threat_severity: ChoiceColumn({
      label: 'Threat Severity',
      mandatory: true,
      choices: {
        critical: 'Critical',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
      },
    }),

    affected_systems: MultiLineTextColumn({
      label: 'Affected Systems',
      maxLength: 4000,
    }),
  },
})
