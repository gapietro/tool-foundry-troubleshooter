/**
 * PaToolLogAnalysis — scoped platform log reads (LOW_LEVEL_DESIGN.md §4.4).
 *
 * CONTRACT (LLD §4): execute(args) -> {success: true, data: Object}
 *                                  | {success: false, error: String}
 * Read-only. All reads GlideRecordSecure, through PaToolReadKit.
 *
 * ---------------------------------------------------------------------------
 * THIS TOOL IS BLOCKED AT THE DATA SOURCE, AND SHIPS ANYWAY. READ R-19.
 * ---------------------------------------------------------------------------
 * `syslog` is DENIED from scope x_snc_troubleshoot, measured twice. The cause
 * is `sys_db_object.caller_access = 2` (Caller Restriction) — re-confirmed
 * 2026-08-01 — and a self-declared `CrossScopePrivilege` does NOT satisfy it:
 * an application cannot grant itself access to a caller-restricted table. The
 * Fluent grant in src/fluent/cross-scope-privileges.now.ts installs correctly
 * (verified in sys_scope_privilege: source_scope=x_snc_troubleshoot,
 * target_name=syslog, operation=read, status=allowed) and is INERT.
 *
 * Do not spend time re-attempting the grant. It has been measured twice.
 *
 * WHY THE TOOL SHIPS REGARDLESS. Dropping to six tools would make the gap
 * INVISIBLE: an agent with no log tool cannot tell you the log layer was
 * skipped, and a diagnosis silently missing a layer is worse than one that
 * names what it could not check. So the read is attempted for real and, on
 * denial, the result says "platform logs unavailable from this scope, admin
 * grant required" — the same explicit-degradation shape R-10 mandates for the
 * GenAI payload.
 *
 * ATTEMPTED, not assumed. Hard-coding the denial would mean the tool never
 * starts working if an admin does lift the restriction, and would report a
 * blocked state on an instance where it was never blocked.
 *
 * ---------------------------------------------------------------------------
 * MANDATORY SCOPING — a platform rule, not a preference
 * ---------------------------------------------------------------------------
 * The K26 guidebook is explicit that an unfiltered `syslog` read can slow or
 * time out an instance. Every query here MUST carry:
 *
 *   - a bounded time window (from the execution plan's start/end +/- 2 min when
 *     an execution is supplied, else minutes_ago), AND
 *   - at least one of source-contains or message-contains
 *
 * A query missing either is REFUSED before it reaches the database — including
 * on an instance where the read would be permitted. The refusal names the
 * missing condition rather than failing vaguely.
 *
 * Standing rules: R-1 (never touch the exception object), R-6 (a blank is a
 * schema mismatch, never absence), R-9 (behave correctly with every input
 * absent).
 */
var PaToolLogAnalysis = Class.create()

PaToolLogAnalysis.prototype = {
    TABLE: 'syslog',

    DEFAULT_MINUTES: 60,
    MAX_MINUTES: 1440,
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100,

    MESSAGE_CHARS: 1000,

    /** Padding either side of an execution window, per LLD §4.4. */
    EXECUTION_PAD_SECONDS: 120,

    /** Levels kept by default — the guidebook's "level <= Warning". */
    DEFAULT_LEVELS: ['Error', 'Warning'],

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
            var data = k.newData('PaToolLogAnalysis', 'scoped-1')

            if (a._parse_error) {
                data.notes.push(
                    'Arguments arrived as a string that looked like JSON but did not parse. ' +
                        'Proceeding as if no arguments were supplied.'
                )
            }

            data.requested = {
                execution: a.execution || null,
                source: a.source || null,
                message: a.message || null,
                level: a.level || null,
                minutes_ago: a.minutes_ago || null,
                limit: a.limit || null,
            }

            phase = 'build_scope'
            var scope = this._buildScope(a, data)
            data.scope = scope.scope

            if (!scope.ok) {
                // Refused BEFORE touching the database, and refused even where
                // the read would be permitted.
                data.status = 'refused_unscoped'
                data.entries = []
                data.missing_conditions = scope.missing
                data.refusal =
                    'This query was refused before it reached the database because it is not sufficiently ' +
                    'scoped. An unfiltered syslog read can slow or time out an instance, so every query ' +
                    'must carry a bounded time window AND at least one of source-contains or ' +
                    'message-contains. Missing: ' +
                    scope.missing.join('; ') +
                    '.'
                data.how_to_scope =
                    'Supply execution=<execution plan sys_id> — the window is then taken from the plan ' +
                    'start and end plus or minus 2 minutes and the message is matched on the plan sys_id — ' +
                    'or supply source=<scope or Script Include name> and/or message=<error keyword>, with ' +
                    'minutes_ago for the window.'
                data.evidence_basis = this._evidenceBasis(data)
                return { success: true, data: data }
            }

            phase = 'read_logs'
            var read = this._readLogs(scope.scope, a, data)
            data.status = read.status
            data.entries = read.entries
            data.read_status = read.read_status

            if (read.status === 'unavailable') {
                data.availability = this._unavailableExplanation()
                data.notes.push(
                    'The platform log layer was NOT swept. Report it as unavailable rather than as clean — ' +
                        'a diagnosis missing a layer silently is worse than one that names the gap.'
                )
            }

            phase = 'finalize'
            data.evidence_basis = this._evidenceBasis(data)
            return { success: true, data: data }
        } catch (e) {
            // R-1: the exception object is deliberately NOT read.
            return {
                success: false,
                error:
                    'PaToolLogAnalysis failed during phase "' +
                    phase +
                    '". Exception detail deliberately not read — see DESIGN.md R-1 ' +
                    '(reading a ScopeAccessNotGrantedException throws again and kills the request).',
            }
        }
    },

    // Read from sys_dictionary on gpinst01 2026-08-01: syslog declares exactly
    // these plus sys_class_name, source_package and source_application_family.
    LOG_FIELDS: ['sys_id', 'sys_created_on', 'sys_created_by', 'level', 'source', 'message', 'sequence'],
    LOG_DISPLAY: ['level'],

    PLAN_FIELDS: ['sys_id', 'sys_created_on', 'sys_updated_on', 'state', 'state_reason'],

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
            } else if (k.isSysId(s)) {
                // A bare sys_id is an execution — the one argument that scopes
                // the query completely on its own.
                return { execution: s }
            } else {
                return { message: s }
            }
        }

        if (!k.isPlainObject(raw)) return {}

        var out = {}
        var execution = k.str(raw.execution || raw.execution_plan || raw.plan)
        var source = k.str(raw.source)
        var message = k.str(raw.message || raw.contains || raw.keyword)
        var level = k.str(raw.level)

        if (execution) out.execution = execution
        if (source) out.source = source
        if (message) out.message = message
        if (level) out.level = level

        var minutes = k.num(raw.minutes_ago || raw.minutes || raw.since)
        if (minutes > 0) out.minutes_ago = minutes

        var limit = k.num(raw.limit)
        if (limit > 0) out.limit = limit

        return out
    },

    // =======================================================================
    // Mandatory scoping
    // =======================================================================

    /**
     * @returns {Object} {ok, missing: [], scope: {...}}
     *
     * The window and the filter are BOTH required. An execution supplies both
     * at once: the plan's own start and end bound the window, and the plan
     * sys_id is what the message must contain.
     */
    _buildScope: function (a, data) {
        var k = this._k()
        var missing = []
        var scope = {
            window: null,
            source_contains: a.source || null,
            message_contains: a.message || null,
            levels: a.level ? [a.level] : this.DEFAULT_LEVELS,
            derived_from_execution: false,
        }

        if (a.execution) {
            var plan = k.readOne('sn_aia_execution_plan', a.execution, this.PLAN_FIELDS, ['state'], data)

            if (plan.row) {
                scope.derived_from_execution = true
                scope.window = {
                    from: this._pad(plan.row.sys_created_on, -this.EXECUTION_PAD_SECONDS),
                    to: this._pad(plan.row.sys_updated_on || plan.row.sys_created_on, this.EXECUTION_PAD_SECONDS),
                    basis:
                        'the execution plan start and end, padded by ' +
                        this.EXECUTION_PAD_SECONDS +
                        ' seconds either side',
                }
                // The plan sys_id is the sharpest message filter available, and
                // it is what the K26 guidebook's sanctioned pattern uses.
                if (!scope.message_contains) scope.message_contains = a.execution
                scope.execution = {
                    sys_id: a.execution,
                    state: plan.row.state_display || plan.row.state,
                    state_reason: plan.row.state_reason,
                }
            } else {
                data.notes.push(
                    'execution "' +
                        a.execution +
                        '" could not be read from sn_aia_execution_plan (' +
                        plan.status +
                        '), so the window could not be derived from it. Falling back to minutes_ago, and ' +
                        'still matching the message on that sys_id.'
                )
                if (!scope.message_contains) scope.message_contains = a.execution
            }
        }

        if (!scope.window) {
            var minutes = a.minutes_ago || this.DEFAULT_MINUTES
            var clamped = false
            if (minutes > this.MAX_MINUTES) {
                minutes = this.MAX_MINUTES
                clamped = true
            }
            scope.window = {
                minutes_ago: minutes,
                clamped: clamped,
                basis: 'minutes_ago' + (clamped ? ', clamped to the ' + this.MAX_MINUTES + '-minute ceiling' : ''),
            }
        }

        if (!scope.source_contains && !scope.message_contains) {
            missing.push(
                'a source-contains or message-contains filter (supply source=<scope or Script Include ' +
                    'name>, message=<error keyword>, or execution=<plan sys_id> which supplies both)'
            )
        }

        return { ok: missing.length === 0, missing: missing, scope: scope }
    },

    _pad: function (timestamp, seconds) {
        if (!timestamp) return null
        try {
            var gdt = new GlideDateTime(timestamp)
            gdt.addSeconds(seconds)
            return String(gdt)
        } catch (e) {
            // R-1: `e` untouched. An unparseable timestamp degrades to the raw
            // value rather than losing the bound entirely.
            return String(timestamp)
        }
    },

    // =======================================================================
    // The read
    // =======================================================================

    _readLogs: function (scope, a, data) {
        var k = this._k()
        var limit = a.limit || this.DEFAULT_LIMIT
        if (limit > this.MAX_LIMIT) limit = this.MAX_LIMIT

        var window = scope.window
        var self = this
        var since = null
        if (!window.from) {
            since = new GlideDateTime()
            since.addSeconds(-1 * window.minutes_ago * 60)
        }

        var read = k.readRows(
            this.TABLE,
            function (gr) {
                if (window.from) {
                    gr.addQuery('sys_created_on', '>=', window.from)
                    if (window.to) gr.addQuery('sys_created_on', '<=', window.to)
                } else {
                    gr.addQuery('sys_created_on', '>=', since)
                }
                if (scope.levels && scope.levels.length) {
                    gr.addQuery('level', 'IN', scope.levels.join(','))
                }
                if (scope.source_contains) gr.addQuery('source', 'LIKE', scope.source_contains)
                if (scope.message_contains) gr.addQuery('message', 'LIKE', scope.message_contains)
            },
            this.LOG_FIELDS,
            this.LOG_DISPLAY,
            limit,
            { field: 'sys_created_on', desc: true },
            data
        )

        if (read.status === 'DENIED') {
            return { status: 'unavailable', entries: [], read_status: read.status }
        }

        var entries = []
        for (var i = 0; i < read.rows.length; i++) {
            var row = read.rows[i]
            entries.push({
                sys_id: row.sys_id,
                created: row.sys_created_on,
                created_by: row.sys_created_by,
                level: row.level_display || row.level,
                source: row.source,
                message: k.digest(row.message, this.MESSAGE_CHARS),
                message_length: (row.message || '').length,
                sequence: row.sequence,
            })
        }

        return {
            status: entries.length ? 'ok' : 'empty',
            entries: entries,
            read_status: read.status,
            truncated_at: entries.length >= limit ? limit : null,
        }
    },

    /**
     * The R-19 degradation. This is the whole reason the tool ships blocked
     * rather than being dropped from the roster.
     */
    _unavailableExplanation: function () {
        return {
            available: false,
            summary: 'Platform logs unavailable from this scope — an instance-admin grant is required.',
            cause:
                'syslog declares sys_db_object.caller_access = Caller Restriction. That is not an ACL and ' +
                'not a missing privilege: it is a restriction on which callers may reach the table at all.',
            already_tried:
                'A Fluent CrossScopePrivilege for syslog IS declared by this application and DOES install ' +
                'correctly (source_scope=x_snc_troubleshoot, target_name=syslog, target_scope=global, ' +
                'operation=read, status=allowed, verifiable in sys_scope_privilege). It does not lift the ' +
                'denial, because an application cannot grant itself access to a caller-restricted table. ' +
                'This was measured twice (DESIGN.md R-12, R-19) — re-attempting the grant is wasted effort.',
            required_action:
                'An instance administrator must either relax caller_access on syslog or provide the log ' +
                'evidence another way (an export, or a read performed from a scope that is permitted). ' +
                'This is a CUSTOMER-SIDE PREREQUISITE, not a defect in this application.',
            what_this_means_for_the_diagnosis:
                'The platform log layer was NOT swept. Do not report it as clean and do not infer its ' +
                'contents from the other layers. Script errors that surfaced inside the execution are ' +
                'still visible through agent_trace, which mines them out of the message stream — that is ' +
                'the nearest available substitute, and it covers errors raised inside the run rather than ' +
                'platform-level ones around it.',
        }
    },

    _evidenceBasis: function (data) {
        return {
            statement:
                'entry_rows is the number of syslog rows actually read. status "unavailable" means the ' +
                'table could not be read at all — that is a stated gap in the sweep, NOT an absence of ' +
                'log entries, and it must not be reported as a clean log layer.',
            entry_rows: data.entries ? data.entries.length : 0,
            status: data.status || null,
            scoped: data.scope ? true : false,
            read_status_by_table: data.reads,
            tables_with_missing_fields: data.field_warnings.length,
        }
    },

    type: 'PaToolLogAnalysis',
}
