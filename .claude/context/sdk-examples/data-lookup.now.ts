/**
 * VALIDATED — Built successfully against SDK 4.8.1 and 4.9.0 on 2026-07-17.
 *
 * Golden Example: DataLookup — dl_definition match/set rules
 *
 * SDK Docs: node_modules/@servicenow/sdk/docs/api/datalookup-api.md,
 *           docs/guides/data-lookup-guide.md
 * Import:   import { DataLookup, Table, Record, ... } from '@servicenow/sdk/core'
 * Requires: SDK >= 4.8.0
 *
 * Key concepts:
 *   - Three-part pattern: matcher table (MUST extend dl_matcher) + DataLookup
 *     definition + seed Records. A matcher not extending dl_matcher still BUILDS
 *     but the lookup silently never fires.
 *   - Scope rule (build-enforced): in a scoped app, sourceTable AND matcherTable
 *     must live in the same scope as the DataLookup. To target OOB tables, extend
 *     them into your scope (as below) or ship from a global app.
 *   - Seed rows MUST set active: true — Record() applies no dictionary defaults
 *     and the engine queries with implicit active=true; rows without it never match.
 *   - name is capped at 40 chars (build error beyond).
 *   - Defaults: runOnInsert true, runOnFormChange true, runOnUpdate FALSE —
 *     set runOnUpdate explicitly if server-side updates must re-derive values.
 *   - alwaysReplace: false only fills empty target fields; true overwrites (avoid
 *     on user-editable fields).
 */
import '@servicenow/sdk/global'
import { DataLookup, Table, Record, IntegerColumn, StringColumn } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// 1. Source table (in-scope extension of task so the lookup may target it)
// ---------------------------------------------------------------------------
export const x_snc_myapp_dl_case = Table({
    name: 'x_snc_myapp_dl_case',
    label: 'Support Case',
    extends: 'task',
    schema: {
        product_line: StringColumn({ label: 'Product line' }),
    },
})

// ---------------------------------------------------------------------------
// 2. Matcher table — must extend dl_matcher
// ---------------------------------------------------------------------------
export const x_snc_myapp_dl_case_matcher = Table({
    name: 'x_snc_myapp_dl_case_matcher',
    label: 'Case Priority Matcher',
    extends: 'dl_matcher',
    schema: {
        impact: IntegerColumn({ label: 'Impact' }),
        urgency: IntegerColumn({ label: 'Urgency' }),
        priority: IntegerColumn({ label: 'Priority' }),
    },
})

// ---------------------------------------------------------------------------
// 3. Lookup definition: impact + urgency → priority
// ---------------------------------------------------------------------------
export const casePriorityLookup = DataLookup({
    $id: Now.ID['dl-case-priority'],
    name: 'Case Priority Lookup', // max 40 chars
    sourceTable: 'x_snc_myapp_dl_case',
    matcherTable: 'x_snc_myapp_dl_case_matcher',
    runOnInsert: true,
    runOnUpdate: true, // default is false — enable so server updates re-derive
    runOnFormChange: true,
    matchRules: [
        {
            $id: Now.ID['dl-case-priority-match-impact'],
            sourceField: 'impact',
            matcherField: 'impact',
            exactMatch: true,
        },
        {
            $id: Now.ID['dl-case-priority-match-urgency'],
            sourceField: 'urgency',
            matcherField: 'urgency',
            exactMatch: true,
        },
    ],
    setRules: [
        {
            $id: Now.ID['dl-case-priority-set-priority'],
            targetField: 'priority',
            matcherField: 'priority',
            alwaysReplace: true, // derived field — always recompute
        },
    ],
})

// ---------------------------------------------------------------------------
// 4. Seed matcher rows — active: true is REQUIRED on every row
// ---------------------------------------------------------------------------
Record({
    $id: Now.ID['dl-case-priority-row-1-1'],
    table: 'x_snc_myapp_dl_case_matcher',
    data: { active: true, impact: 1, urgency: 1, priority: 1 },
})
Record({
    $id: Now.ID['dl-case-priority-row-1-2'],
    table: 'x_snc_myapp_dl_case_matcher',
    data: { active: true, impact: 1, urgency: 2, priority: 2 },
})
Record({
    $id: Now.ID['dl-case-priority-row-2-2'],
    table: 'x_snc_myapp_dl_case_matcher',
    data: { active: true, impact: 2, urgency: 2, priority: 3 },
})
