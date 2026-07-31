/**
 * VALIDATED — Built successfully against SDK 4.8.1 and 4.9.0 on 2026-07-17.
 *             One deviation from the bundled docs found during validation: the
 *             guide's `table: 'incident'` examples FAIL the build in a scoped
 *             app (TS11 — same-scope tables only); see SCOPE note below.
 *
 * Golden Example: DataPolicy — sys_data_policy2 server-side mandatory/read-only rules
 *
 * SDK Docs: node_modules/@servicenow/sdk/docs/api/datapolicy-api.md,
 *           docs/guides/data-policy-guide.md
 * Import:   import { DataPolicy, Table, ... } from '@servicenow/sdk/core'
 * Requires: SDK >= 4.7.0
 *
 * Key concepts:
 *   - Unlike UI Policies, Data Policies enforce on EVERY write path (forms, import
 *     sets, SOAP/REST, scripts) — useAsUiPolicyOnClient additionally mirrors them
 *     to forms (the applyTo... and useAs... booleans all default true; don't
 *     restate them).
 *   - Every policy needs $id + table + shortDescription; every rule needs its own
 *     $id. Rule keys are field names or dot-walk paths ('approver.email').
 *   - mandatory: true + readOnly: true on the same field = build error.
 *   - conditions: encoded query over stored values ('priority=1^ORpriority=2');
 *     omitted = applies to all records.
 *   - SCOPE (build-enforced, TS11): in a scoped app, Data Policies can ONLY
 *     target tables in the same scope — `table: 'incident'` fails the build.
 *     The bundled guide's incident examples compile only in GLOBAL apps, where a
 *     further runtime caveat applies: mandatory rules are silently disabled on
 *     out-of-scope tables (read-only rules still work). For cross-scope
 *     mandatory enforcement use a Business Rule.
 *   - COROLLARY (live-verified, issue #199): platform Data Policies also apply
 *     when an app INSTALL loads records — violating records are SILENTLY
 *     skipped with no build, install, or log error. If a record from your app
 *     is missing on the instance, check the target table's data policies
 *     (that is exactly how sn_aia_tool records without description vanish —
 *     Build Rule #34).
 */
import '@servicenow/sdk/global'
import { DataPolicy, Table, StringColumn, IntegerColumn, ReferenceColumn } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Scoped table used by Example 1 (own-scope tables get full enforcement)
// ---------------------------------------------------------------------------
export const x_snc_myapp_dp_request = Table({
    name: 'x_snc_myapp_dp_request',
    label: 'Governed Request',
    schema: {
        short_description: StringColumn({ label: 'Short description' }),
        justification: StringColumn({ label: 'Business justification', maxLength: 4000 }),
        approver: ReferenceColumn({ label: 'Approver', referenceTable: 'sys_user' }),
        priority: IntegerColumn({ label: 'Priority' }),
        state: IntegerColumn({ label: 'State' }),
    },
})

// ---------------------------------------------------------------------------
// Example 1: Own-scope table — mandatory + read-only + dot-walk rules
// ---------------------------------------------------------------------------
export const requestGovernancePolicy = DataPolicy({
    $id: Now.ID['dp-request-governance'],
    table: 'x_snc_myapp_dp_request',
    shortDescription: 'Require justification and approver on priority-1 requests',
    conditions: 'priority=1',
    rules: {
        justification: {
            $id: Now.ID['dp-request-governance-justification-rule'],
            mandatory: true,
        },
        approver: {
            $id: Now.ID['dp-request-governance-approver-rule'],
            mandatory: true,
        },
        // Dot-walk key: rule applies to the referenced record's field
        'approver.email': {
            $id: Now.ID['dp-request-governance-approver-email-rule'],
            readOnly: true,
        },
    },
})

// ---------------------------------------------------------------------------
// Example 2: Freeze fields once a record is closed — a second policy on the
// same table is fine (one rule per field PER POLICY; when policies compete,
// the most restrictive outcome wins, there is no evaluation order).
// NOTE: `table: 'incident'` here would fail the build in a scoped app (TS11) —
// see the SCOPE note in the header.
// ---------------------------------------------------------------------------
export const requestClosurePolicy = DataPolicy({
    $id: Now.ID['dp-request-closure'],
    table: 'x_snc_myapp_dp_request',
    shortDescription: 'Lock justification and approver on closed requests',
    conditions: 'state=7', // stored value, never the display label
    rules: {
        justification: {
            $id: Now.ID['dp-request-closure-justification-rule'],
            readOnly: true,
        },
        approver: {
            $id: Now.ID['dp-request-closure-approver-rule'],
            readOnly: true,
        },
    },
})
