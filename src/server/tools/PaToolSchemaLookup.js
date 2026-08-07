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

            if (a._prefix_stripped) {
                // LOUDLY (issue #111). Repairing this silently would make the
                // call work and erase the only evidence that the model is
                // malforming arguments — which is exactly how it went
                // unnoticed for a whole smoke: every measure counted which
                // tools were invoked, and this one was.
                data.notes.push(
                    'The argument arrived as "' +
                        a._prefix_stripped +
                        '" — the parameter name prefixed onto its own value. It was read as "' +
                        // #125: this was `a.table` alone, which reported
                        // `read as ""` for a field-only strip — announcing a
                        // repair while withholding its result.
                        (a.table || a.field || '') +
                        '". Pass the value on its own, or a JSON object with table and field, and note ' +
                        'that this call is recorded in the audit trail as it was sent, not as it was repaired.'
                )
            }

            data.requested = { table: a.table || null, field: a.field || null }

            if (!a.table) {
                // R-9: a missing argument is expected, not a fault.
                data.mode = 'no_table'
                data.notes.push(
                    // #111: this note used to say `table=<name>`, modelling the
                    // very parameter-prefixed shape that turned up in two live
                    // runs as `table:incident`. It now shows the value alone.
                    'No table was supplied, so there is nothing to describe. Call with the table name by ' +
                        'itself for the full column list, or a JSON object with table and field for one ' +
                        'column plus its choice values. This is not an error — a missing argument is ' +
                        'expected (DESIGN.md R-9).'
                )
                data.evidence_basis = this._evidenceBasis(data)
                return { success: true, data: data }
            }

            data.mode = a.field ? 'field' : 'table'

            if (!this.TABLE_NAME_PATTERN.test(a.table)) {
                // The finding this REPLACES is the defect (issue #111). A name
                // that cannot belong to any table produces an empty
                // sys_db_object read, which the absence branch below reports
                // as "a genuine absence — the table name is wrong". That
                // sentence is a claim about the INSTANCE, backed by a real
                // read and a success:true audit row, and a model reasoning
                // from it files a plausible, fully-audited, wrong root cause.
                // A malformed name must settle nothing about what exists.
                data.table_exists = 'unknown'
                data.findings = [
                    {
                        finding: 'table_name_malformed',
                        severity: 'high',
                        table: a.table,
                        why:
                            '"' +
                            a.table +
                            '" is not a well-formed table name — table names are letters, digits, ' +
                            'underscores and $ only. No lookup was attempted, so this says nothing about ' +
                            'whether the table you meant exists. This is NOT the table_does_not_exist ' +
                            'finding: that one is a read that came back empty, and this one is a read ' +
                            'that was never worth making.',
                        next_step:
                            'Re-send the call with the table name on its own — "incident", not ' +
                            '"table:incident" — or as a JSON object. Then read the result before ' +
                            'concluding anything about the table.',
                    },
                ]
                data.evidence_basis = this._evidenceBasis(data)
                return { success: true, data: data }
            }

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
            var walk = this._hierarchy(a.table, data)
            var hierarchy = walk.levels
            data.hierarchy = hierarchy
            data.hierarchy_complete = walk.complete
            data.hierarchy_incomplete_reason = walk.incomplete_reason
            data.hierarchy_note =
                'sys_dictionary rows live on the table that DECLARES a column, not on every table that has ' +
                'it. Every field below carries declared_on. A lookup that does not walk this chain reports ' +
                'inherited columns — sys_created_on and the rest of sys_metadata — as absent, which is the ' +
                'exact false schema-mismatch this tool exists to prevent.'

            phase = 'read_fields'
            var fields = this._fields(hierarchy, data)
            data.field_count = fields.length

            if (a.field) {
                data.field = this._oneField(a.field, fields, a.table, data, walk)
            } else {
                data.fields = fields
                data.truncated_at = fields.capped_at || (k.anyTruncation(data) ? this.MAX_FIELDS : null)
                if (fields.levels_not_read) {
                    data.levels_not_read = fields.levels_not_read
                    data.notes.push(
                        'The column list is INCOMPLETE: the sys_dictionary read for ' +
                            fields.levels_not_read
                                .map(function (l) {
                                    return l.table + ' (' + l.status + ')'
                                })
                                .join(', ') +
                            ' returned no rows, so those levels contributed nothing. A column absent from ' +
                            'this list may be declared there.'
                    )
                }
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

    /**
     * A legal ServiceNow table name. Deliberately narrow: anything outside
     * this set cannot name a table, so a lookup on it can only ever come back
     * absent — see `table_name_malformed` in `execute` for why that matters.
     */
    TABLE_NAME_PATTERN: /^[A-Za-z0-9_$]+$/,

    /**
     * The parameter name prefixed onto its own value — `table:incident`.
     *
     * MEASURED, NOT ANTICIPATED (issue #111). Two of six v6 runs called this
     * tool this way, on two different seeds. Root cause was this tool's own
     * contract advertising "the shorthand table.field", whose notation gives a
     * model no way to tell that `table` is a placeholder and not literal text
     * — it is also the JSON key name, one sentence earlier. That wording is
     * fixed at the source (PaToolRegistry + agent-doctor.now.ts); this is the
     * guard for the calls already in flight.
     *
     * #125 widened this from `table|table_name` to the tool's FULL accepted
     * parameter list — the object branch below reads
     * `raw.field || raw.element || raw.column` too, and the tool's description
     * tells the model that table and field are both parameter names. The
     * capture group is load-bearing: see PARAM_PREFIX_SLOT.
     */
    PARAM_PREFIX_PATTERN: /^(table|table_name|field|element|column)\s*[:=]\s*/i,

    /**
     * Which slot each recognised parameter name fills once stripped (#125).
     *
     * This map is why widening PARAM_PREFIX_PATTERN is not a one-line change.
     * The no-dot branch of `_normalizeArgs` puts the surviving text in the
     * TABLE slot, so stripping `field:` without routing would read
     * `field:channel` as a table called `channel`, attempt a real
     * sys_db_object lookup, and report `table_does_not_exist` — "a genuine
     * absence, the table name is wrong". That is a confident claim about the
     * INSTANCE built on a parameter name the model merely spelled out, and it
     * is exactly the false diagnosis the #111 malformed-name guard below
     * exists to prevent. Un-routed, the widening would have reintroduced it
     * through a new door, converting a call that fails SAFE today
     * (table_name_malformed, no read attempted) into one that fails
     * DANGEROUSLY.
     */
    PARAM_PREFIX_SLOT: {
        table: 'table',
        table_name: 'table',
        field: 'field',
        element: 'field',
        column: 'field',
    },

    /**
     * The same prefix carried on the shorthand's OWN delimiter —
     * `table.sn_aia_tool.u_routing_key` (issue #114).
     *
     * MEASURED. The #111 A/B put the pre-fix contract in front of the model
     * under a depth-gate hold and got exactly this back: the placeholder word
     * `table`, then `.`, then the real table and column. It is the cleanest
     * confirmation of #111's root cause available — the model read `table` in
     * "the shorthand table.field" as literal text — and #111's own guard let
     * it through, because `.` could not join `:` and `=` in one class without
     * breaking `incident.priority`.
     *
     * The discriminator is the THIRD segment: `table.<x>.<y>` cannot be a
     * two-part shorthand, so stripping is unambiguous. `table.<x>` alone is
     * genuinely ambiguous — it could name a table called `table` — and is
     * deliberately left to the shorthand path.
     */
    DOTTED_PREFIX_PATTERN: /^(?:table|table_name)\.(?=[^.]+\.[^.]+$)/i,

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
            } else {
                // Strip before the `.` split, so `table:incident.priority`
                // still reaches the shorthand path intact.
                var prefixMatch = s.match(this.PARAM_PREFIX_PATTERN)
                var slot = prefixMatch ? this.PARAM_PREFIX_SLOT[k.lower(prefixMatch[1])] : null
                var bare = k.trim(s.replace(this.PARAM_PREFIX_PATTERN, '').replace(this.DOTTED_PREFIX_PATTERN, ''))
                var out0 = bare === s ? {} : { _prefix_stripped: s }
                if (!bare) return out0

                if (bare.indexOf('.') !== -1) {
                    // "incident.priority" is the natural way to name a field
                    // and costs nothing to accept. The shorthand names both
                    // halves itself, so it outranks the prefix word either way.
                    var parts = bare.split('.')
                    out0.table = k.trim(parts[0])
                    out0.field = k.trim(parts[1])
                    return out0
                }

                if (slot === 'field') {
                    // #125: what follows `field:` names a COLUMN. Leaving it
                    // in the table slot is the dangerous reading — see
                    // PARAM_PREFIX_SLOT. With no table, `execute` reaches the
                    // no_table branch, which is the honest answer: it asks for
                    // the table rather than inventing a verdict about one.
                    out0.field = bare
                    return out0
                }

                out0.table = bare
                return out0
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
                super_class_label: row.super_class_display || null,
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

    /**
     * The table and every ancestor, nearest first.
     *
     * THE WALK ADVANCES BY SYS_ID, NOT BY DISPLAY VALUE. `super_class` is a
     * reference, and a reference's display value is the parent's LABEL —
     * measured on gpinst01: sn_aia_agent's super_class displays as
     * "Application File", not "sys_metadata". A walk that feeds that label
     * into the next name= query dies after one hop and reports every
     * inherited column as absent — the false schema mismatch this tool exists
     * to prevent, produced by the tool. The first version did exactly that,
     * and its unit test hid it by seeding the stub's display with the name
     * (R-8: a stub is not evidence). The raw reference value is the parent's
     * sys_id, which is the one identifier the next lookup can trust.
     */
    _hierarchy: function (table, data) {
        var k = this._k()
        var chain = []
        var seen = {}
        var lookup = { field: 'name', value: table }
        var depth = 0

        // The walk has FOUR ways to end, and only one of them means "the whole
        // ancestry was seen". Round 6 found that the other three — a failed
        // read, a cycle, and the depth ceiling — all left every visited level
        // reading `ok`, so a completeness check derived from per-level
        // statuses called a truncated walk complete and let `exists: false`
        // claim ancestors that were never scanned. The verdict is therefore
        // returned EXPLICITLY by the code that knows why the loop ended,
        // instead of being re-derived downstream from evidence that cannot
        // distinguish the cases.
        var complete = false
        var incompleteReason = null

        while (lookup.value && depth < this.MAX_DEPTH) {
            var read = k.readRows(
                'sys_db_object',
                k.eqQuery(lookup.field, lookup.value),
                ['sys_id', 'name', 'label', 'super_class'],
                ['super_class'],
                1,
                null,
                data
            )

            if (read.status === 'DENIED' || !read.rows.length) {
                chain.push({ table: lookup.value, label: null, read_status: read.status, parent: null })
                incompleteReason =
                    'a level could not be read (sys_db_object ' + read.status + ' for "' + lookup.value + '")'
                break
            }

            var row = read.rows[0]
            if (seen[row.sys_id]) {
                incompleteReason = 'the super_class chain revisits "' + row.name + '" (cycle)'
                data.notes.push(
                    'The super_class chain revisits "' + row.name + '"; the walk stopped to avoid a cycle.'
                )
                break
            }
            seen[row.sys_id] = true

            var parentId = k.refValue(row.super_class)
            chain.push({
                table: row.name,
                label: row.label,
                read_status: read.status,
                // The LABEL, for the reader. The walk itself never uses it.
                parent: parentId ? row.super_class_display || parentId : null,
            })

            if (!parentId) {
                // The only genuine completion: the chain topped out.
                complete = true
                break
            }

            lookup = { field: 'sys_id', value: parentId }
            depth++
        }

        if (!complete && !incompleteReason) {
            incompleteReason =
                depth >= this.MAX_DEPTH
                    ? 'the depth ceiling (' + this.MAX_DEPTH + ') was reached with a parent still unresolved'
                    : 'the walk ended without resolving the chain'
            data.notes.push('The ancestor walk is INCOMPLETE: ' + incompleteReason + '.')
        }

        return { levels: chain, complete: complete, incomplete_reason: incompleteReason }
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

            // A level whose dictionary read did not return rows contributed
            // NOTHING to the merge, and round 7 found that nothing recorded
            // it: the walk verdict was complete, the merged list non-empty,
            // no clip flag — and an absence claim silently spanned a level
            // that was never read. `empty` is recorded too, deliberately:
            // every real table has at least its collection row in
            // sys_dictionary, so an empty level is row-filtering or a wrong
            // name, not a table without columns.
            if (read.status !== 'ok') {
                if (!out.levels_not_read) out.levels_not_read = []
                out.levels_not_read.push({ table: level.table, status: read.status })
                continue
            }

            for (var i = 0; i < read.rows.length; i++) {
                var row = read.rows[i]
                var element = k.trim(row.element)
                // The collection row (element empty) describes the table
                // itself, not a column.
                if (!element) continue
                if (seen[element]) continue

                // The cap is claimed only when a row that WOULD have been
                // added arrives after the list is full. Marking it at
                // `length >= MAX` alone calls an exactly-300-column schema
                // clipped — the same exactly-full ambiguity the kit's limit+1
                // read removes; it pushed a genuinely missing field to
                // `unknown` and table mode to a false truncation ceiling.
                // IN-MEMORY CAP (declared exception), limit+1 semantics:
                if (out.length >= this.MAX_FIELDS) {
                    out.capped_at = this.MAX_FIELDS
                    return out
                }
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

            }
        }

        return out
    },

    _oneField: function (name, fields, table, data, walk) {
        var k = this._k()

        var found = null
        for (var i = 0; i < fields.length; i++) {
            if (fields[i].element === name) {
                found = fields[i]
                break
            }
        }

        if (!found) {
            // "Does not exist" is a claim about the table AND every ancestor,
            // so it is earned only when the whole chain was actually read. A
            // denied dictionary yields zero columns and a denied sys_db_object
            // yields a one-level walk — either way the honest answer is
            // UNKNOWN, and the first version answered `false`: the same
            // empty-result overconfidence QueryTable's verdict had, in the
            // tool whose one job is telling those apart.
            // The walk's OWN verdict — not a re-derivation from per-level
            // statuses, which cannot tell a topped-out chain from one ended by
            // a cycle or the depth ceiling (round 6: all three left every
            // visited level reading `ok`).
            var walkComplete = walk && walk.complete === true
            // A clipped column list is incomplete the same way a broken walk
            // is: _fields stops at its in-memory ceiling BEFORE later ancestor
            // levels are scanned, and a kit-truncated dictionary page drops
            // columns inside a level. Round 3's guard checked the walk and not
            // the list — so `exists: false` could still claim a "complete
            // chain" over ancestors that were never merged.
            var listClipped =
                (fields && fields.capped_at) ||
                (data && data.truncations && data.truncations.sys_dictionary) ||
                null
            var levelsNotRead = (fields && fields.levels_not_read) || []

            if (!fields.length || !walkComplete || listClipped || levelsNotRead.length) {
                return {
                    element: name,
                    exists: 'unknown',
                    note:
                        (!fields.length
                            ? 'No columns could be read for this table or its ancestors at all'
                            : !walkComplete
                              ? 'The ancestor walk was incomplete — ' +
                                ((walk && walk.incomplete_reason) || 'reason unrecorded')
                              : levelsNotRead.length
                                ? 'The dictionary read for level(s) ' +
                                  levelsNotRead
                                      .map(function (l) {
                                          return l.table + ' (' + l.status + ')'
                                      })
                                      .join(', ') +
                                  ' returned no rows, so their columns were never merged'
                                : 'The column list was clipped at ' +
                                listClipped +
                                ' before every ancestor was merged') +
                        ', so whether "' +
                        name +
                        '" exists is UNKNOWN — the question was not answered, and this must not be ' +
                        'treated as a schema mismatch. See read_status_by_table and the hierarchy for ' +
                        'which read failed.',
                    similar_columns: [],
                }
            }

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
                    ' columns checked across the complete chain). A query reading this name gets a BLANK, ' +
                    'not an error — so a blank you are seeing is a schema mismatch, not absent data ' +
                    '(DESIGN.md R-6).',
                similar_columns: near,
            }
        }

        var out = k.isPlainObject(found) ? found : {}
        out.exists = true

        if (found.has_choices) {
            // sys_choice rows live under the table that DECLARES the column —
            // the same ownership rule the hierarchy walk exists for. The first
            // version queried only the caller's table and then emitted a note
            // telling the READER to "re-check the declaring table", while
            // `declared_on` sat right there in `found`: instructing a human to
            // do a join the tool could do itself. Both tables are queried
            // (an extending table can also define its own overrides) and each
            // choice says which one defined it.
            var choiceTables = [table]
            if (found.declared_on && found.declared_on !== table) choiceTables.push(found.declared_on)

            var choiceRead = k.readRows(
                'sys_choice',
                function (gr) {
                    gr.addQuery('name', 'IN', choiceTables.join(','))
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
                    defined_on: row.name,
                    sequence: row.sequence,
                    inactive: row.inactive,
                    dependent_value: row.dependent_value || null,
                    hint: row.hint || null,
                    language: row.language,
                })
            }
            out.choices = choices
            out.choice_read_status = choiceRead.status
            // A clipped choice list is the worst kind of silence in a SCHEMA
            // tool: the reader's next move is "is this value valid?", and a
            // partial list answers no to values that are perfectly valid.
            out.choices_truncated_at = choiceRead.truncated_at || null
            if (out.choices_truncated_at) {
                out.choices_note =
                    'Only the first ' +
                    out.choices_truncated_at +
                    ' choices were read. This list is a LOWER BOUND — do NOT conclude a value is invalid ' +
                    'because it is absent from it.'
            }
            out.choice_tables_queried = choiceTables
            out.choice_read_status = choiceRead.status
            // DENIED is not success. The old guard nulled the note for any
            // non-empty status, so a denied read produced choices: [] with no
            // note — a verified-looking absence over a question that was
            // refused (R-26, in miniature).
            if (choiceRead.status === 'DENIED') {
                out.choice_note =
                    'sys_choice is not readable from this scope, so the choice list is UNAVAILABLE — ' +
                    'an empty choices array here is a permission gap, not evidence the column has no ' +
                    'choice values.'
            } else if (!choiceRead.rows.length && choiceRead.status === 'empty') {
                out.choice_note =
                    'The dictionary marks this column as having choices, but sys_choice holds none ' +
                    'under ' +
                    choiceTables.join(' or ') +
                    ' for element ' +
                    name +
                    '. Both the asked-for table and the declaring table were queried, so this is a ' +
                    'genuine absence of choice rows, not a lookup at the wrong level.'
            } else {
                out.choice_note = null
            }
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

        if (a.field && data.field && data.field.exists === 'unknown') {
            findings.push({
                finding: 'field_existence_unknown',
                severity: 'medium',
                table: a.table,
                field: a.field,
                why:
                    'The column was not found, but the reads behind the answer were incomplete — see the ' +
                    'field note. Reporting field_does_not_exist here would be the empty-result ' +
                    'overconfidence this tool exists to prevent.',
                next_step: 'Re-check once the denied or empty reads in the hierarchy are resolvable.',
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

        // R-26, the third axis. An empty collection has three causes -- nothing
        // matched, the page was clipped, or the read was refused -- and they
        // are not interchangeable.
        var denied = k.deniedTables(data)
        var denialNote = denied.length
            ? 'These tables were DENIED: ' +
              denied.join(', ') +
              '. Any empty result above that depends on them is a permission gap, NOT an absence, and ' +
              'must not be reported as one.'
            : null

        return {
            truncations: truncations,
            truncation_note: truncationNote,
            denied_tables: denied,
            denial_note: denialNote,
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
