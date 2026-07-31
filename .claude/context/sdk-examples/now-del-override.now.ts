/**
 * VALIDATED — Built successfully against SDK 4.8.1 and 4.9.0 on 2026-07-17.
 *
 * Golden Example: Now.del() + $override — Fluent escape hatches
 *
 * SDK Docs: node_modules/@servicenow/sdk/docs/fluent/now-del-guide.md,
 *           docs/fluent/override-guide.md
 * Import:   none — Now is a global; $override is a property on any
 *           WithIdAndMetadata config (BusinessRule, Record, DataPolicy, ...)
 * Requires: SDK >= 4.8.0 (Now.del); $override is 4.7.0+
 *
 * Key concepts:
 *   - Now.del(table, { coalesceKeys }) / Now.del(table, 'sys_id') declaratively
 *     DELETES an instance record at install. Use it ONLY for records your app
 *     shipped through legacy channels or platform leftovers — for Fluent-created
 *     records just delete the code (removal is auto-tracked).
 *   - Top-level statements only; deleting a record that doesn't exist is a no-op.
 *   - $override writes raw column values the Fluent API doesn't model onto the
 *     generated record. Validated behavior (contradicts the guide's "unchecked"
 *     claim): plugin-written columns are rejected with warning TS97/TS112 and
 *     ignored, even when absent from the config type (is_rest, add_message,
 *     advanced, ...). Only truly unknown keys pass through — and a column
 *     missing on the instance is SILENTLY ignored at install. Last resort only —
 *     never for API-modeled properties or protected sys_ fields.
 *
 * WARNING: Now.del is destructive at install time. Keep targets app-prefixed and
 * verify before adopting this pattern against shared instances.
 */
import '@servicenow/sdk/global'
import { BusinessRule } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Now.del by coalesce keys — retire artifacts this app shipped
// before it moved to Fluent (records that never existed are install no-ops)
// ---------------------------------------------------------------------------
Now.del('sys_user_role', { name: 'x_snc_myapp.obsolete_role' })
Now.del('sys_properties', { name: 'x_snc_myapp.deprecated_setting' })

// Example 2: Now.del by sys_id — when there is no natural coalesce key.
// Commented out: replace the placeholder GUID with a real sys_id queried from
// the instance before using this form.
// Now.del('sys_hub_flow', 'a1b2c3d4e5f6789012345678901234ab')

// ---------------------------------------------------------------------------
// Example 3: $override — write columns the Fluent API doesn't expose
// ---------------------------------------------------------------------------
export const flagLegacyRequests = BusinessRule({
    $id: Now.ID['ndo-flag-legacy-br'],
    name: 'Flag legacy requests',
    table: 'x_snc_myapp_dp_request', // defined in data-policy.now.ts
    when: 'before',
    action: ['insert'],
    script: `(function executeRule(current, previous) {
        if (!current.getValue('priority')) {
            current.setValue('priority', 4);
        }
    })(current, previous);`,
    $override: {
        // $override writes raw DB columns onto the generated record, but it is
        // NOT a free-for-all (validated on 4.8.1/4.9.0):
        //  - Any column the build plugin already writes is rejected with warning
        //    TS97/TS112 and ignored — even ones missing from the Fluent config
        //    type (is_rest, add_message, advanced, ...). Use the API property.
        //  - Truly unknown keys (typically instance customization columns like
        //    this u_ one) pass the build unchecked; a typo or a column missing
        //    on the instance is silently ignored at install — verify after
        //    first deploy.
        u_compliance_tag: 'legacy-intake', // instance customization column; no-op where absent
    },
})
