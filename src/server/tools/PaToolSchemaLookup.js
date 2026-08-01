/**
 * PaToolSchemaLookup — table and field schema (LOW_LEVEL_DESIGN.md §4.4).
 *
 * Diagnostic layer 4. Answers "does this table exist, does this field exist,
 * and what shape is it" — the layer that turns a tool returning blanks into a
 * named schema mismatch.
 *
 * CONTRACT (LLD §4): execute(args) -> {success: true, data: Object}
 *                                  | {success: false, error: String}
 * Read-only. All reads GlideRecordSecure, through PaToolReadKit.
 *
 * ---------------------------------------------------------------------------
 * WHY THE EXISTENCE CHECK COMES FIRST
 * ---------------------------------------------------------------------------
 * LLD §4.4: "sys_db_object existence check first, so 'table does not exist' is
 * a distinct finding from 'no fields readable' (cross-scope signal)". Those two
 * look identical from a caller's side — both are an empty field list — and they
 * have completely different fixes. One is a typo in a tool script; the other is
 * a privilege gap.
 *
 * ---------------------------------------------------------------------------
 * THE INHERITANCE TRAP, AND IT IS THE REASON THIS TOOL EXISTS
 * ---------------------------------------------------------------------------
 * `sys_dictionary` rows live on the table that DECLARES the column, not on the
 * table that has it. Every AIA table extends `sys_metadata`, so a query for
 * `name=sn_aia_agent` finds none of `sys_created_on`, `sys_updated_on`,
 * `sys_created_by`. A lookup that does not walk `super_class` reports those
 * fields as ABSENT — which is precisely the "field does not exist, so the blank
 * you are seeing is a schema mismatch" conclusion this tool exists to reach,
 * arrived at wrongly, about a field that is perfectly real.
 *
 * So the walk is not a refinement. A single-level lookup would make this tool a
 * generator of exactly the false diagnosis it was built to prevent. Every field
 * carries `declared_on` so an inherited field is visibly inherited.
 *
 * Standing rules: R-1 (never touch the exception object), R-6 (a blank is a
 * schema mismatch, never absence), R-9 (behave correctly with every input
 * absent).
 */
var PaToolSchemaLookup = Class.create()

PaToolSchemaLookup.prototype = {
    DIGEST_CHARS: 200,

    MAX_FIELDS: 300,
    MAX_CHOICES: 100,
    /** Depth guard for the super_class walk — a cycle would otherwise hang. */
    MAX_DEPTH: 15,

    initialize: function (options) {
        var o = options || {}
        this._readKit = o.readKit || null
    },

    _k: function () {
        if (!this._readKit) this._readKit = new PaToolReadKit()
        return this._readKit
    },

    // =======================================================================
    // Entry point
    // =======================================================================

    execute: function (args) {
        var phase = 'normalize_args'

        try {
            var k = this._k()
            var a = this._normalizeArgs(args)
            var data = k.newData('PaToolSchemaLookup', 'hierarchy-1')

            if (a._parse_error) {
                data.notes.push(
                    'Arguments arrived as a string that looked like JSON but did not parse. ' +
                        'Proceeding as if no arguments were supplied.'
                )
            }

            data.requested = { table: a.table || null, field: a.field || null }

            if (!a.table) {
                // R-9: a missing argument is expected, not a fault.
                data.mode = 'no_table'
                data.notes.push(
                    'No table was supplied, so there is nothing to describe. Call with table=<name> for the ' +
                        'full column list, or table=<name>, field=<column> for one column plus its choice ' +
                        'values. This is not an error — a missing argument is expected (DESIGN.md R-9).'
                )
                data.evidence_basis = this._evidenceBasis(data)
                return { success: true, data: data }
            }

            data.mode = a.field ? 'field' : 'table'

            phase = 'check_table_exists'
            var existence = this._tableExists(a.table, data)
            data.table_exists = existence.exists
            data.table = existence.row

            if (existence.exists === false) {
                data.findings = [
                    {
                        finding: 'table_does_not_exist',
                        severity: 'high',
                        table: a.table,
                        why:
                            'No sys_db_object row is named "' +
                            a.table +
                            '". The read succeeded, so this is a genuine absence — the table name is wrong. ' +
                            'This is a DIFFERENT finding from "the table exists but no fields are readable", ' +
                            'which is a cross-scope privilege gap, and the two have opposite fixes.',
                        next_step:
                            'Correct the table name in whatever referenced it — a tool script, an encoded ' +
                            'query, or a field list. A query against a non-existent table returns rows with ' +
                            'every field blank rather than an error.',
                    },
                ]
                data.evidence_basis = this._evidenceBasis(data)
                return { success: true, data: data }
            }

            phase = 'walk_hierarchy'
            var hierarchy = this._hierarchy(a.table, data)
            data.hierarchy = hierarchy
            data.hierarchy_note =
                'sys_dictionary rows live on the table that DECLARES a column, not on every table that has ' +
                'it. Every field below carries declared_on. A lookup that does not walk this chain reports ' +
                'inherited columns — sys_created_on and the rest of sys_metadata — as absent, which is the ' +
                'exact false schema-mismatch this tool exists to prevent.'

            phase = 'read_fields'
            var fields = this._fields(hierarchy, data)
            data.field_count = fields.length

            if (a.field) {
                data.field = this._oneField(a.field, fields, a.table, data)
            } else {
                data.fields = fields
                data.truncated_at = fields.capped_at || (k.anyTruncation(data) ? this.MAX_FIELDS : null)
            }

            phase = 'derive_findings'
            data.findings = this._findings(a, data, fields)

            phase = 'finalize'
            data.evidence_basis = this._evidenceBasis(data)
            return { success: true, data: data }
        } catch (e) {
            // R-1: the exception object is deliberately NOT read.
            return {
                success: false,
                error:
                    'PaToolSchemaLookup failed during phase "' +
                    phase +
                    '". Exception detail deliberately not read — see DESIGN.md R-1 ' +
                    '(reading a ScopeAccessNotGrantedException throws again and kills the request).',
            }
        }
    },

    // =======================================================================
    // Field lists — read from sys_dictionary on gpinst01 2026-08-01 before this
    // file was written (DESIGN.md R-23's standing rule).
    // =======================================================================

    TABLE_FIELDS: [
        'sys_id',
        'name',
        'label',
        'super_class',
        'access',
        'caller_access',
        'read_access',
        'ws_access',
        'sys_scope',
        'is_extendable',
    ],
    TABLE_DISPLAY: ['super_class', 'caller_access', 'sys_scope'],

    DICTIONARY_FIELDS: [
        'sys_id',
        'name',
        'element',
        'column_label',
        'internal_type',
        'mandatory',
        'max_length',
        'reference',
        'default_value',
        'choice',
        'read_only',
        'active',
        'display',
        'virtual',
        'unique',
        'dependent',
        'use_dependent_field',
        'attributes',
        'comments',
    ],
    DICTIONARY_DISPLAY: ['internal_type', 'reference', 'column_label'],

    CHOICE_FIELDS: [
        'sys_id',
        'name',
        'element',
        'value',
        'label',
        'sequence',
        'inactive',
        'dependent_value',
        'hint',
        'language',
    ],

    // =======================================================================
    // Arguments (R-9)
    // =======================================================================

    _normalizeArgs: function (args) {
        var k = this._k()
        var raw = args

        if (raw === null || raw === undefined) return {}

        if (typeof raw === 'string') {
            var s = k.trim(raw)
            if (!s) return {}

            var parsed = k.tryParse(s)
            if (k.isPlainObject(parsed)) {
                raw = parsed
            } else if (s.charAt(0) === '{' || s.charAt(0) === '[') {
                return { _parse_error: true }
            } else if (s.indexOf('.') !== -1) {
                // "incident.priority" is the natural way to name a field and
                // costs nothing to accept.
                var parts = s.split('.')
                return { table: k.trim(parts[0]), field: k.trim(parts[1]) }
            } else {
                return { table: s }
            }
        }

        if (!k.isPlainObject(raw)) return {}

        var out = {}
        var table = k.str(raw.table || raw.table_name)
        var field = k.str(raw.field || raw.element || raw.column)

        if (table) out.table = table
        if (field) out.field = field

        return out
    },

    // =======================================================================
    // Existence and hierarchy
    // =======================================================================

    /** @returns {Object} {exists: true|false|'unknown', row} */
    _tableExists: function (table, data) {
        var k = this._k()
        var read = k.readRows(
            'sys_db_object',
            k.eqQuery('name', table),
            this.TABLE_FIELDS,
            this.TABLE_DISPLAY,
            1,
            null,
            data
        )

        if (read.status === 'DENIED') {
            data.notes.push(
                'sys_db_object is not readable from this scope, so whether "' +
                    table +
                    '" exists could not be established. Unknown, not absent — the rest of this result is ' +
                    'reported on that basis.'
            )
            return { exists: 'unknown', row: null }
        }

        if (!read.rows.length) return { exists: false, row: null }

        var row = read.rows[0]
        return {
            exists: true,
            row: {
                name: row.name,
                label: row.label,
                super_class: k.refValue(row.super_class),
                super_class_name: row.super_class_display || null,
                scope: row.sys_scope_display || k.refValue(row.sys_scope),
                is_extendable: row.is_extendable,
                // ws_access gates the REST surface; it is NOT security. The
                // ACLs gate the data (SDK Build Rule #42).
                ws_access: row.ws_access,
                read_access: row.read_access,
                caller_access: row.caller_access,
                caller_access_label: row.caller_access_display || null,
                caller_access_meaning: this._callerAccessMeaning(row),
            },
        }
    },

    /**
     * A non-empty caller_access is the single most useful cross-scope fact a
     * schema lookup can surface. It is what blocks `syslog` from this scope
     * (measured: caller_access=2), and a self-declared CrossScopePrivilege does
     * NOT satisfy it — an application cannot grant itself access to a
     * caller-restricted table (DESIGN.md R-19).
     */
    _callerAccessMeaning: function (row) {
        var k = this._k()
        var value = k.trim(row.caller_access)
        if (!value) {
            return 'unrestricted — no caller restriction is declared on this table'
        }
        return (
            'RESTRICTED (caller_access=' +
            value +
            (row.caller_access_display ? ', "' + row.caller_access_display + '"' : '') +
            '). A cross-scope caller can be denied regardless of ACLs, and a privilege the calling ' +
            'application declares for itself does not lift it — that needs an instance-admin action. ' +
            'If a read of this table came back DENIED, this is why.'
        )
    },

    /** The table and every ancestor, nearest first. */
    _hierarchy: function (table, data) {
        var k = this._k()
        var chain = []
        var seen = {}
        var current = table
        var depth = 0

        while (current && depth < this.MAX_DEPTH) {
            if (seen[current]) {
                data.notes.push(
                    'The super_class chain revisits "' + current + '"; the walk stopped to avoid a cycle.'
                )
                break
            }
            seen[current] = true

            var read = k.readRows(
                'sys_db_object',
                k.eqQuery('name', current),
                ['sys_id', 'name', 'label', 'super_class'],
                ['super_class'],
                1,
                null,
                data
            )

            if (read.status === 'DENIED' || !read.rows.length) {
                chain.push({ table: current, label: null, read_status: read.status, parent: null })
                break
            }

            var row = read.rows[0]
            var parentName = row.super_class_display || null
            chain.push({
                table: row.name,
                label: row.label,
                read_status: read.status,
                parent: parentName,
            })

            current = parentName
            depth++
        }

        return chain
    },

    // =======================================================================
    // Fields
    // =======================================================================

    _fields: function (hierarchy, data) {
        var k = this._k()
        var out = []
        var seen = {}

        for (var h = 0; h < hierarchy.length; h++) {
            var level = hierarchy[h]
            var read = k.readRows(
                'sys_dictionary',
                k.eqQuery('name', level.table),
                this.DICTIONARY_FIELDS,
                this.DICTIONARY_DISPLAY,
                this.MAX_FIELDS,
                'element',
                data
            )

            for (var i = 0; i < read.rows.length; i++) {
                var row = read.rows[i]
                var element = k.trim(row.element)
                // The collection row (element empty) describes the table
                // itself, not a column.
                if (!element) continue
                if (seen[element]) continue
                seen[element] = true

                out.push({
                    element: element,
                    label: row.column_label_display || row.column_label || null,
                    type: row.internal_type_display || row.internal_type,
                    mandatory: row.mandatory,
                    max_length: row.max_length,
                    reference: row.reference_display || k.refValue(row.reference),
                    reference_sys_id: k.refValue(row.reference),
                    default_value: k.digest(row.default_value, this.DIGEST_CHARS),
                    has_choices: k.num(row.choice) > 0,
                    choice: row.choice,
                    read_only: row.read_only,
                    active: row.active,
                    display: row.display,
                    virtual: row.virtual,
                    unique: row.unique,
                    dependent: row.dependent || null,
                    attributes: k.digest(row.attributes, this.DIGEST_CHARS),
                    comments: k.digest(row.comments, this.DIGEST_CHARS),
                    // The point of the hierarchy walk.
                    declared_on: level.table,
                    inherited: h > 0,
                })

                // IN-MEMORY CAP: an accumulation ceiling across the whole
                // hierarchy walk, not any single read's limit - so it cannot
                // take the kit's measured value and is declared here instead.
                // It still must not be silent.
                if (out.length >= this.MAX_FIELDS) {
                    out.capped_at = this.MAX_FIELDS
                    return out
                }
            }
        }

        return out
    },

    _oneField: function (name, fields, table, data) {
        var k = this._k()

        var found = null
        for (var i = 0; i < fields.length; i++) {
            if (fields[i].element === name) {
                found = fields[i]
                break
            }
        }

        if (!found) {
            var near = this._nearMisses(name, fields)
            return {
                element: name,
                exists: false,
                note:
                    'No column named "' +
                    name +
                    '" is declared on ' +
                    table +
                    ' or on any of its ancestors (' +
                    fields.length +
                    ' columns checked across the chain). A query reading this name gets a BLANK, not an ' +
                    'error — so a blank you are seeing is a schema mismatch, not absent data (DESIGN.md R-6).',
                similar_columns: near,
            }
        }

        var out = k.isPlainObject(found) ? found : {}
        out.exists = true

        if (found.has_choices) {
            var choiceRead = k.readRows(
                'sys_choice',
                function (gr) {
                    gr.addQuery('name', table)
                    gr.addQuery('element', name)
                },
                this.CHOICE_FIELDS,
                [],
                this.MAX_CHOICES,
                'sequence',
                data
            )

            var choices = []
            for (var c = 0; c < choiceRead.rows.length; c++) {
                var row = choiceRead.rows[c]
                choices.push({
                    value: row.value,
                    label: row.label,
                    sequence: row.sequence,
                    inactive: row.inactive,
                    dependent_value: row.dependent_value || null,
                    hint: row.hint || null,
                    language: row.language,
                })
            }
            out.choices = choices
            out.choice_read_status = choiceRead.status
            out.choice_note =
                choiceRead.rows.length || choiceRead.status !== 'empty'
                    ? null
                    : 'The dictionary marks this column as having choices, but sys_choice holds none for ' +
                      table +
                      '.' +
                      name +
                      '. Choices may be inherited from the column\'s declaring table (' +
                      found.declared_on +
                      ') — re-check there.'
        }

        return out
    },

    /** Cheap edit-distance-free near miss: shared prefix or containment. */
    _nearMisses: function (name, fields) {
        var out = []
        var lower = String(name).toLowerCase()

        for (var i = 0; i < fields.length && out.length < 8; i++) {
            var e = String(fields[i].element).toLowerCase()
            if (e === lower) continue
            if (e.indexOf(lower) !== -1 || lower.indexOf(e) !== -1) {
                out.push(fields[i].element)
                continue
            }
            if (e.length > 3 && lower.length > 3 && e.substring(0, 4) === lower.substring(0, 4)) {
                out.push(fields[i].element)
            }
        }
        return out
    },

    _findings: function (a, data, fields) {
        var findings = []

        // The distinction LLD §4.4 asks for: the table is real, but nothing
        // came back. That is a privilege gap, not a schema fact.
        if (data.table_exists === true && !fields.length) {
            findings.push({
                finding: 'no_fields_readable',
                severity: 'high',
                table: a.table,
                why:
                    'The table exists in sys_db_object, but sys_dictionary returned no columns for it or ' +
                    'any ancestor. That is a cross-scope readability problem, NOT a missing table — the ' +
                    'opposite fix from table_does_not_exist.',
                next_step:
                    'Check the read status per table below. ' +
                    (data.table && data.table.caller_access
                        ? 'This table also declares a caller restriction (' +
                          data.table.caller_access +
                          '), which a self-declared cross-scope privilege does not lift.'
                        : 'If sys_dictionary itself reads DENIED, no schema lookup is possible from this scope.'),
            })
        }

        if (a.field && data.field && data.field.exists === false) {
            findings.push({
                finding: 'field_does_not_exist',
                severity: 'high',
                table: a.table,
                field: a.field,
                why:
                    'The column is not declared on the table or any ancestor. A read of it returns a blank ' +
                    'rather than an error, so code using this name looks like it found no data when it ' +
                    'actually asked the wrong question (DESIGN.md R-6).',
                next_step: (data.field.similar_columns || []).length
                    ? 'Columns with similar names exist: ' + data.field.similar_columns.join(', ') + '.'
                    : 'Re-read the column list for this table.',
            })
        }

        return findings
    },

    _evidenceBasis: function (data) {
        var k = this._k()
        // R-24: every bound that was hit, surfaced whether or not the section
        // that hit it thought to mention it. A silent cap now requires deleting
        // a line here rather than forgetting one at a call site.
        var truncations = data.truncations || {}
        var truncationNote = k.anyTruncation(data)
            ? 'One or more reads hit their ceiling — see truncations. Any count or absence derived from ' +
              'those tables is a LOWER BOUND, not a complete answer.'
            : null

        return {
            truncations: truncations,
            truncation_note: truncationNote,
            statement:
                'Every count below is the number of rows actually read. A zero with read status "ok"/"empty" ' +
                'is a genuine absence; a zero with "DENIED" is a permission gap and says nothing about the ' +
                'schema.',
            table_exists: data.table_exists === undefined ? null : data.table_exists,
            hierarchy_levels: data.hierarchy ? data.hierarchy.length : 0,
            field_rows: data.field_count || 0,
            choice_rows: data.field && data.field.choices ? data.field.choices.length : 0,
            read_status_by_table: data.reads,
            tables_with_missing_fields: data.field_warnings.length,
        }
    },

    type: 'PaToolSchemaLookup',
}
