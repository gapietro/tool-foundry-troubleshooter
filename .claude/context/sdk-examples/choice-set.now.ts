/**
 * VALIDATED — Built successfully against SDK 4.9.0 on 2026-07-17.
 *             4.9.0-ONLY: the ChoiceSet constructor does not exist on <= 4.8.x.
 *
 * Golden Example: ChoiceSet — add choices to fields your app does NOT own
 *
 * SDK Docs: node_modules/@servicenow/sdk/docs/api/choiceset-api.md,
 *           docs/guides/choiceset-guide.md
 * Import:   import { ChoiceSet, Table, ... } from '@servicenow/sdk/core'
 * Requires: SDK >= 4.9.0
 *
 * Key concepts:
 *   - ChoiceSet is exclusively for INHERITED fields (owned by another scope, e.g.
 *     global task fields on your extension table). Choices for a column your app
 *     owns go inline on the column in Table() — targeting an owned field here is
 *     a build error, as is targeting a table outside your scope (extend it first).
 *   - No $id — identity is the (table, field) pair.
 *   - choices map: key = stored value (string or number), value = label string |
 *     ChoiceConfig | ChoiceConfig[] (array form = one sys_choice per entry, for
 *     multi-language labels). Set language on EVERY array entry — omitted entries
 *     default to the project defaultLanguage and can collide.
 *   - camelCase dependentValue/inactiveOnUpdate only (snake_case forms are a
 *     deprecated, mutually-exclusive union branch).
 *   - Omitting a previously-shipped value REMOVES that choice on install (v3
 *     default is delete-then-insert; "legacyChoices": false in now.config.json
 *     opts into additive v4 sys_choice_v2 on Zurich P11+).
 */
import '@servicenow/sdk/global'
import { ChoiceSet, Table, StringColumn } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// In-scope extension of task: priority/contact_type are inherited (global-owned)
// fields on this table, which is exactly what ChoiceSet is for.
// ---------------------------------------------------------------------------
export const x_snc_myapp_cs_ticket = Table({
    name: 'x_snc_myapp_cs_ticket',
    label: 'Vendor Ticket',
    extends: 'task',
    schema: {
        vendor: StringColumn({ label: 'Vendor' }),
    },
})

// ---------------------------------------------------------------------------
// Example 1: Multi-language labels — ChoiceConfig[] per value
// ---------------------------------------------------------------------------
ChoiceSet({
    table: 'x_snc_myapp_cs_ticket',
    field: 'priority',
    choices: {
        1: [
            { label: 'Critical', sequence: 1, language: 'en' },
            { label: 'Critique', sequence: 1, language: 'fr' },
            { label: 'Kritisch', sequence: 1, language: 'de' },
        ],
        2: [
            { label: 'High', sequence: 2, language: 'en' },
            { label: 'Élevée', sequence: 2, language: 'fr' },
            { label: 'Hoch', sequence: 2, language: 'de' },
        ],
        3: { label: 'Normal', sequence: 3 }, // single-language entries still work
    },
})

// ---------------------------------------------------------------------------
// Example 2: hint / inactive / synonyms (typeahead)
// ---------------------------------------------------------------------------
ChoiceSet({
    table: 'x_snc_myapp_cs_ticket',
    field: 'contact_type',
    choices: {
        vendor_portal: {
            label: 'Vendor portal',
            sequence: 1,
            hint: 'Raised by the vendor through the B2B portal',
            synonyms: ['portal', 'b2b'],
        },
        vendor_hotline: {
            label: 'Vendor hotline',
            sequence: 2,
        },
        legacy_fax: {
            label: 'Fax (legacy)',
            sequence: 99,
            inactive: true, // kept for historical records, hidden from pickers
        },
    },
})
