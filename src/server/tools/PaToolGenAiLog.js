/**
 * PaToolGenAiLog — the GenAI stack layer (LOW_LEVEL_DESIGN.md §4.3).
 *
 * Diagnostic layer 6. Answers three different questions that are easy to
 * conflate: did the LLM get called (usage), what did the call do (llm /
 * for_execution), and is the capability wired to a provider at all
 * (check_config).
 *
 * CONTRACT (LLD §4): execute(args) -> {success: true, data: Object}
 *                                  | {success: false, error: String}
 * Read-only. All reads GlideRecordSecure, through PaToolReadKit.
 *
 * ---------------------------------------------------------------------------
 * THE REFUTED HEURISTIC — read this before touching check_config
 * ---------------------------------------------------------------------------
 * LLD §4.3 used to instruct that an empty `connection` on
 * `sys_one_extend_capability_definition` IS the "capability not mapped to a
 * provider" finding. It is not, and the struck sentence is still visible in
 * §4.3 because it reads perfectly plausibly.
 *
 * Measured against the WHOLE table on gpinst01 (2026-08-01, re-confirming
 * DESIGN.md R-22):
 *
 *   2026 rows total
 *    318 (15.7%) have an EMPTY connection — including shipped OOB Now Assist
 *        definitions. sys_dictionary records the column mandatory=false.
 *      1 (0.05%) is missing one of the three MANDATORY bindings.
 *
 * A check_config written to the struck sentence reports 318 healthy
 * capabilities as broken. That is not a diagnostic, it is a false-positive
 * generator — and one shipped inside the product rather than confined to a
 * fixture. What this tool flags instead is a missing or unresolvable value in
 * `capability`, `api_type` or `api`, all three of which ARE mandatory.
 *
 * R-22's own lesson is the reason the counts above travel in the OUTPUT and
 * not just this comment: the refuted claim survived three correction passes
 * because it was stated as "12 rows" with no denominator. A count without its
 * denominator is not a measurement.
 *
 * ---------------------------------------------------------------------------
 * THREE OUTCOMES FOR `api`, NOT TWO
 * ---------------------------------------------------------------------------
 * `api` is `document_id`, so it carries NO referential integrity: a dangling
 * value installs verbatim and nothing complains until the capability runs.
 * Verifying it means resolving it against the table `api_type` names — and
 * that resolution can fail for two completely different reasons:
 *
 *   resolved      the record exists
 *   dangling      the table exists, this scope can read it, the record is not there
 *   unverifiable  `api_type` is not a table name at all (measured: `Decision`
 *                 is not a table, and that same row is the ONE row of 2026 with
 *                 an empty api), OR the target table cannot be read from this
 *                 scope
 *
 * Collapsing `unverifiable` into `dangling` is the R-11 partial-read-as-absence
 * failure, and it would fire on precisely the row an investigator is most
 * likely to be looking at. api_type values measured on gpinst01: sys_hub_flow
 * 1840, sys_hub_action_type_definition 134, sys_script_include 47,
 * one_api_system_executor 4, Decision 1.
 *
 * ---------------------------------------------------------------------------
 * R-10 — THE PAYLOAD IS ROLE-GATED, AND THE DEGRADATION IS MANDATORY
 * ---------------------------------------------------------------------------
 * The prompt/response payload is NOT on sys_gen_ai_log_metadata. It lives on
 * `sys_generative_ai_log.prompt` / `.response` (string, 16,000 chars each),
 * reached via `gen_ai_log_metadata.gen_ai_log_id`. That table's read ACLs grant
 * only `sn_na_analytics.ai_engmt_viewer`, `maint` and `admin` — the AI-Agent
 * role set a customer administrator actually holds (`sn_aia.admin` /
 * `sn_aia.viewer`) is absent from every one of them.
 *
 * So a denial here is EXPECTED, and it must come back as a stated "payload not
 * readable under caller's roles; metadata only". An empty result would read as
 * "there was no prompt", which is a different and wrong diagnosis.
 *
 * Other standing rules: R-1 (never touch the exception object), R-6 (a blank is
 * a schema mismatch, never absence), R-9 (behave correctly with every input
 * absent).
 */
var PaToolGenAiLog = Class.create()

PaToolGenAiLog.prototype = {
    MODES: ['usage', 'llm', 'for_execution', 'check_config'],

    DIGEST_CHARS: 200,

    /** Payload ceiling. The columns hold 16,000 chars; the store pages the rest. */
    PAYLOAD_CHARS: 8000,

    DEFAULT_MINUTES: 60,
    /** One week. A wider window is clamped and the clamp is stated, never silent. */
    MAX_MINUTES: 10080,

    MAX_ROWS: 50,
    MAX_DEFINITIONS: 100,
    MAX_TASKS: 200,
    MAX_M2M: 100,

    // Measured on gpinst01 2026-08-01 over the whole table. Carried as
    // constants so the numbers in the output cannot drift from the numbers in
    // the reasoning.
    CONNECTION_EMPTY_COUNT: 318,
    DEFINITION_ROW_COUNT: 2026,

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
            var data = k.newData('PaToolGenAiLog', 'modes-1')

            if (a._parse_error) {
                data.notes.push(
                    'Arguments arrived as a string that looked like JSON but did not parse. ' +
                        'Proceeding as if no arguments were supplied.'
                )
            }

            phase = 'resolve_mode'
            data.mode = this._resolveMode(a, data)
            data.requested = {
                mode: a.mode || null,
                execution: a.execution || null,
                minutes_ago: a.minutes_ago || null,
                errors_only: a.errors_only === undefined ? null : a.errors_only,
                include_payload: a.include_payload === true,
            }

            if (!a.mode) {
                data.notes.push(
                    'No mode was supplied, so the default (llm, errors only, last ' +
                        this.DEFAULT_MINUTES +
                        ' minutes) was used. This is not an error — a missing argument is expected ' +
                        '(DESIGN.md R-9). Modes: ' +
                        this.MODES.join(', ') +
                        '.'
                )
            }

            phase = 'run_mode'
            if (data.mode === 'check_config') {
                this._checkConfig(a, data)
            } else if (data.mode === 'for_execution') {
                data.window = this._window(a)
                this._forExecution(a, data)
            } else if (data.mode === 'usage') {
                data.window = this._window(a)
                this._usage(a, data)
            } else {
                data.window = this._window(a)
                this._llm(a, data)
            }

            phase = 'finalize'
            data.evidence_basis = this._evidenceBasis(data)

            return { success: true, data: data }
        } catch (e) {
            // R-1: the exception object is deliberately NOT read.
            return {
                success: false,
                error:
                    'PaToolGenAiLog failed during phase "' +
                    phase +
                    '". Exception detail deliberately not read — see DESIGN.md R-1 ' +
                    '(reading a ScopeAccessNotGrantedException throws again and kills the request).',
            }
        }
    },

    // =======================================================================
    // Field lists — every one read from sys_dictionary on gpinst01 2026-08-01
    // before this file was written (DESIGN.md R-23's standing rule).
    // =======================================================================

    USAGE_FIELDS: [
        'sys_id',
        'assists',
        'trial_assists',
        'status',
        'execution_type',
        'strategy',
        'feature',
        'skill_config_id',
        'user',
        'caller_scope',
        'source_scope',
        'plugin_name',
        'document_table',
        'document',
        'sys_created_on',
    ],
    USAGE_DISPLAY: ['status', 'execution_type', 'strategy', 'feature', 'skill_config_id', 'user'],

    // No `prompt` and no `response` on this table — verified against
    // sys_dictionary. That two-table hop is the whole of R-10.
    METADATA_FIELDS: [
        'sys_id',
        'started_at',
        'completed_at',
        'model_name',
        'model_version',
        'status',
        'error',
        'error_code',
        'prompt_token_count',
        'response_token_count',
        'time_taken',
        'definition',
        'skill_config_id',
        'caller',
        'source',
        'conversation',
        'gen_ai_log_id',
        'output_metadata',
        'sys_created_on',
    ],
    METADATA_DISPLAY: ['definition', 'skill_config_id'],

    PAYLOAD_FIELDS: ['sys_id', 'prompt', 'response', 'untranslated_prompt', 'status', 'error'],

    M2M_FIELDS: ['sys_id', 'source_id', 'source_table', 'gen_ai_log_metadata', 'sys_created_on'],

    DEFINITION_FIELDS: [
        'sys_id',
        'name',
        'capability',
        'api_type',
        'api',
        'connection',
        'category',
        'description',
        'advanced',
        'order',
    ],
    DEFINITION_DISPLAY: ['capability', 'connection', 'category'],

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
                // A bare sys_id can only sensibly mean an execution plan.
                return { execution: s, mode: 'for_execution' }
            } else {
                return { mode: k.lower(s) }
            }
        }

        if (!k.isPlainObject(raw)) return {}

        var out = {}
        var mode = k.lower(k.str(raw.mode))
        var execution = k.str(raw.execution || raw.execution_plan || raw.plan)

        if (mode) out.mode = mode
        if (execution) out.execution = execution

        var minutes = k.num(raw.minutes_ago || raw.minutes || raw.since)
        if (minutes > 0) out.minutes_ago = minutes

        var errorsOnly = k.bool(raw.errors_only)
        if (errorsOnly !== null) out.errors_only = errorsOnly

        if (k.bool(raw.include_payload) === true) out.include_payload = true

        return out
    },

    _resolveMode: function (a, data) {
        var requested = a.mode
        if (!requested) return 'llm'

        for (var i = 0; i < this.MODES.length; i++) {
            if (this.MODES[i] === requested) return requested
        }

        if (a.execution) {
            data.notes.push(
                'Unknown mode "' + requested + '", but an execution was supplied, so for_execution was used.'
            )
            return 'for_execution'
        }

        data.notes.push(
            'Unknown mode "' +
                requested +
                '". Valid modes are: ' +
                this.MODES.join(', ') +
                '. Returning the default (llm) rather than nothing.'
        )
        return 'llm'
    },

    /** errors_only defaults TRUE per LLD §4.3 — the window is for diagnosis, not audit. */
    _window: function (a) {
        var minutes = a.minutes_ago || this.DEFAULT_MINUTES
        var clamped = false
        if (minutes > this.MAX_MINUTES) {
            minutes = this.MAX_MINUTES
            clamped = true
        }
        return {
            minutes_ago: minutes,
            clamped: clamped,
            errors_only: a.errors_only === undefined ? true : a.errors_only,
            note: clamped
                ? 'The requested window exceeded the ' +
                  this.MAX_MINUTES +
                  '-minute ceiling and was clamped. Stated rather than silently applied.'
                : null,
        }
    },

    _since: function (minutes) {
        var gdt = new GlideDateTime()
        gdt.addSeconds(-1 * minutes * 60)
        return gdt
    },

    // =======================================================================
    // usage
    // =======================================================================

    _usage: function (a, data) {
        var k = this._k()
        var w = data.window
        var since = this._since(w.minutes_ago)
        var errorsOnly = w.errors_only

        var read = k.readRows(
            'sys_gen_ai_usage_log',
            function (gr) {
                gr.addQuery('sys_created_on', '>=', since)
                if (errorsOnly) gr.addQuery('status', '!=', 'success')
            },
            this.USAGE_FIELDS,
            this.USAGE_DISPLAY,
            this.MAX_ROWS,
            { field: 'sys_created_on', desc: true },
            data
        )

        var out = []
        for (var i = 0; i < read.rows.length; i++) {
            var r = read.rows[i]
            out.push({
                sys_id: r.sys_id,
                created: r.sys_created_on,
                status: r.status_display || r.status,
                execution_type: r.execution_type_display || r.execution_type,
                strategy: r.strategy_display || r.strategy,
                assists: r.assists,
                trial_assists: r.trial_assists,
                feature: r.feature_display || k.refValue(r.feature),
                skill_config: r.skill_config_id_display || k.refValue(r.skill_config_id),
                user: r.user_display || k.refValue(r.user),
                caller_scope: r.caller_scope,
                source_scope: r.source_scope,
                plugin_name: r.plugin_name,
                document_table: r.document_table,
                document: k.refValue(r.document),
            })
        }

        data.entries = out
        data.read_status = read.status
        data.truncated_at = read.truncated_at || null
        data.notes.push(
            'usage mode counts ASSIST CONSUMPTION, not LLM calls. A run that failed before reaching the ' +
                'provider consumes no assists and leaves no row here — an empty result is not evidence the ' +
                'LLM was never invoked. Use mode=llm for the call detail.'
        )
    },

    // =======================================================================
    // llm + payload (R-10)
    // =======================================================================

    _llm: function (a, data) {
        var k = this._k()
        var w = data.window
        var since = this._since(w.minutes_ago)
        var errorsOnly = w.errors_only

        var read = k.readRows(
            'sys_gen_ai_log_metadata',
            function (gr) {
                gr.addQuery('sys_created_on', '>=', since)
                if (errorsOnly) gr.addQuery('status', '!=', 'success')
            },
            this.METADATA_FIELDS,
            this.METADATA_DISPLAY,
            this.MAX_ROWS,
            { field: 'sys_created_on', desc: true },
            data
        )

        data.entries = this._shapeMetadata(read.rows, a, data)
        data.read_status = read.status
        data.truncated_at = read.truncated_at || null
    },

    _shapeMetadata: function (rows, a, data) {
        var k = this._k()
        var out = []
        var wantPayload = a.include_payload === true

        for (var i = 0; i < rows.length; i++) {
            var r = rows[i]
            var entry = {
                sys_id: r.sys_id,
                started_at: r.started_at,
                completed_at: r.completed_at,
                model_name: r.model_name,
                model_version: r.model_version,
                status: r.status,
                error: r.error || null,
                error_code: r.error_code || null,
                prompt_token_count: r.prompt_token_count,
                response_token_count: r.response_token_count,
                time_taken: r.time_taken,
                definition: k.refValue(r.definition),
                definition_name: r.definition_display || null,
                skill_config: r.skill_config_id_display || k.refValue(r.skill_config_id),
                caller: r.caller,
                source: r.source,
                conversation: k.refValue(r.conversation),
                gen_ai_log_id: k.refValue(r.gen_ai_log_id),
                output_metadata_digest: k.digest(r.output_metadata, this.DIGEST_CHARS),
                created: r.sys_created_on,
            }

            if (wantPayload) entry.payload = this._payload(entry.gen_ai_log_id, data)
            out.push(entry)
        }

        if (!wantPayload && out.length && data.notes.join(' ').indexOf('were NOT fetched') === -1) {
            data.notes.push(
                'Prompt and response payloads were NOT fetched. Re-call with include_payload=true to ' +
                    'attempt them — they live on sys_generative_ai_log, a separate role-gated table, so ' +
                    'they are fetched only on request rather than failing every ordinary call.'
            )
        }

        return out
    },

    /**
     * R-10. The payload is on sys_generative_ai_log, whose read ACLs grant only
     * sn_na_analytics.ai_engmt_viewer / maint / admin. A customer administrator
     * holding sn_aia.admin CANNOT read it, so a denial here is the expected
     * case and must be stated rather than returned as emptiness.
     */
    _payload: function (logId, data) {
        var k = this._k()

        if (!logId) {
            return {
                status: 'no_payload_link',
                detail:
                    'This metadata row carries no gen_ai_log_id, so there is no payload record to read. ' +
                    'A genuine absence, not a permission problem.',
            }
        }

        var read = k.readOne('sys_generative_ai_log', logId, this.PAYLOAD_FIELDS, [], data)

        if (read.status === 'DENIED') {
            var note =
                'sys_generative_ai_log is not readable under the caller\'s roles — METADATA ONLY. Its read ' +
                'ACLs grant sn_na_analytics.ai_engmt_viewer, maint and admin; the AI-Agent role set a ' +
                'customer administrator holds (sn_aia.admin / sn_aia.viewer) is on none of them. This is a ' +
                'known capability limit and a customer-side grant, NOT a bug and NOT an absent prompt ' +
                '(DESIGN.md R-10).'
            if (data.notes.join(' ').indexOf('METADATA ONLY') === -1) data.notes.push(note)
            return { status: 'not_readable', detail: note }
        }

        if (!read.row) {
            return {
                status: 'missing',
                detail:
                    'gen_ai_log_id points at sys_generative_ai_log[' +
                    logId +
                    '], which the read succeeded on but returned no row. The reference is dangling.',
            }
        }

        var row = read.row
        return {
            status: 'ok',
            prompt: k.digest(row.prompt, this.PAYLOAD_CHARS),
            prompt_length: (row.prompt || '').length,
            response: k.digest(row.response, this.PAYLOAD_CHARS),
            response_length: (row.response || '').length,
            untranslated_prompt_length: (row.untranslated_prompt || '').length,
            log_status: row.status,
            log_error: row.error || null,
        }
    },

    // =======================================================================
    // for_execution
    // =======================================================================

    _forExecution: function (a, data) {
        var k = this._k()

        if (!a.execution) {
            data.llm_calls = []
            data.notes.push(
                'for_execution needs an execution plan sys_id and none was supplied. Call agent_trace ' +
                    'first to get one, or use mode=llm for a time-windowed view. This is not an error — a ' +
                    'missing argument is expected (DESIGN.md R-9).'
            )
            return
        }

        var planRead = k.readOne(
            'sn_aia_execution_plan',
            a.execution,
            ['sys_id', 'gen_ai_usage_log', 'state', 'state_reason', 'sys_created_on'],
            ['state'],
            data
        )

        if (planRead.status === 'DENIED') {
            data.llm_calls = []
            data.notes.push(
                'sn_aia_execution_plan is not readable from this scope, so the execution could not be ' +
                    'anchored. A privilege gap, not an absent run.'
            )
            return
        }
        if (!planRead.row) {
            data.llm_calls = []
            data.notes.push(
                'There is no sn_aia_execution_plan with sys_id "' +
                    a.execution +
                    '". The read succeeded, so this is a genuine absence — the run does not exist, which ' +
                    'is a different finding from "the run made no LLM calls".'
            )
            return
        }

        var plan = planRead.row

        // 1. The plan-level usage row (aggregate assists).
        var usageId = k.refValue(plan.gen_ai_usage_log)
        if (usageId) {
            var usageRead = k.readOne(
                'sys_gen_ai_usage_log',
                usageId,
                this.USAGE_FIELDS,
                this.USAGE_DISPLAY,
                data
            )
            data.usage_log = usageRead.row
                ? {
                      sys_id: usageRead.row.sys_id,
                      assists: usageRead.row.assists,
                      trial_assists: usageRead.row.trial_assists,
                      status: usageRead.row.status_display || usageRead.row.status,
                      execution_type: usageRead.row.execution_type_display || usageRead.row.execution_type,
                      caller_scope: usageRead.row.caller_scope,
                  }
                : null
            data.usage_log_read_status = usageRead.status
        } else {
            data.usage_log = null
            data.usage_log_read_status = 'no_reference'
        }

        // 2. The m2m join. Its source_id is the plan OR any of its tasks —
        //    a plan-only query silently returns the per-step calls' absence.
        var taskRead = k.readRows(
            'sn_aia_execution_task',
            k.eqQuery('execution_plan', a.execution),
            ['sys_id', 'execution_plan'],
            [],
            this.MAX_TASKS,
            null,
            data
        )
        var sourceIds = [a.execution].concat(k.ids(taskRead.rows))
        data.source_ids_joined = sourceIds
        data.task_read_status = taskRead.status
        data.task_truncated_at = taskRead.truncated_at || null

        if (taskRead.status === 'DENIED') {
            data.notes.push(
                'sn_aia_execution_task is not readable from this scope, so the join below runs on the ' +
                    'plan sys_id ALONE. Every per-step LLM call is therefore missing from llm_calls, and ' +
                    'the zero task ids reported are a permission gap — NOT an execution without tasks.'
            )
        }

        var m2mRead = k.readRows(
            'sn_aia_gen_ai_m2m',
            k.inQuery('source_id', sourceIds),
            this.M2M_FIELDS,
            [],
            this.MAX_M2M,
            null,
            data
        )

        var calls = []
        for (var i = 0; i < m2mRead.rows.length; i++) {
            var link = m2mRead.rows[i]
            var metadataId = k.refValue(link.gen_ai_log_metadata)
            if (!metadataId) continue

            var mdRead = k.readOne(
                'sys_gen_ai_log_metadata',
                metadataId,
                this.METADATA_FIELDS,
                this.METADATA_DISPLAY,
                data
            )
            if (!mdRead.row) {
                calls.push({
                    m2m_sys_id: link.sys_id,
                    source_id: link.source_id,
                    source_table: link.source_table,
                    metadata_sys_id: metadataId,
                    read_status: mdRead.status,
                    note: 'The link exists but its log metadata row could not be read (' + mdRead.status + ').',
                })
                continue
            }

            var shaped = this._shapeMetadata([mdRead.row], a, data)[0]
            shaped.source_id = link.source_id
            shaped.source_table = link.source_table
            calls.push(shaped)
        }

        data.llm_calls = calls
        data.m2m_read_status = m2mRead.status
        data.m2m_truncated_at = m2mRead.truncated_at || null

        if (m2mRead.status === 'DENIED') {
            data.llm_calls_status = 'unavailable'
            data.notes.push(
                'sn_aia_gen_ai_m2m is not readable from this scope, so llm_calls is EMPTY FOR A REASON ' +
                    'THAT HAS NOTHING TO DO WITH THE RUN. An empty llm_calls here is a permission gap and ' +
                    'is indistinguishable, in shape alone, from a run that genuinely called no provider — ' +
                    'do not read it as the latter.'
            )
        } else {
            data.llm_calls_status = calls.length ? 'ok' : 'empty'
        }
        data.llm_calls_truncated_at = data.task_truncated_at || data.m2m_truncated_at || null

        if (data.llm_calls_truncated_at) {
            data.notes.push(
                'llm_calls is INCOMPLETE. ' +
                    (data.task_truncated_at
                        ? 'The task list was truncated at ' +
                          data.task_truncated_at +
                          ', so calls made by tasks beyond that were never joined. '
                        : '') +
                    (data.m2m_truncated_at
                        ? 'The sn_aia_gen_ai_m2m link list was truncated at ' +
                          data.m2m_truncated_at +
                          '. '
                        : '') +
                    'The join below looks complete and is not — do NOT conclude the run made fewer ' +
                    'provider calls than it did.'
            )
        }

        data.plan = {
            sys_id: plan.sys_id,
            state: plan.state_display || plan.state,
            state_reason: plan.state_reason,
            created: plan.sys_created_on,
        }
        data.notes.push(
            'LLM calls are joined through sn_aia_gen_ai_m2m on source_id IN (the plan, plus each of its ' +
                taskRead.rows.length +
                ' task sys_ids). Querying the plan sys_id alone misses every per-step call.'
        )
    },

    // =======================================================================
    // check_config — see the header before changing anything here
    // =======================================================================

    _checkConfig: function (a, data) {
        var k = this._k()

        var read = k.readRows(
            'sys_one_extend_capability_definition',
            null,
            this.DEFINITION_FIELDS,
            this.DEFINITION_DISPLAY,
            this.MAX_DEFINITIONS,
            'name',
            data
        )

        var findings = []
        var definitions = []
        var tableCache = {}
        var i

        for (i = 0; i < read.rows.length; i++) {
            var row = read.rows[i]
            var entry = {
                sys_id: row.sys_id,
                name: row.name || null,
                capability: k.refValue(row.capability),
                capability_name: row.capability_display || null,
                api_type: row.api_type || '',
                api: k.refValue(row.api),
                category: row.category_display || k.refValue(row.category),
                // NOT a defect. See the header, and the denominator below.
                connection: k.refValue(row.connection),
                connection_name: row.connection_display || null,
                connection_state: k.refValue(row.connection)
                    ? 'bound'
                    : 'empty — normal, not a defect',
            }

            // --- the three MANDATORY bindings ----------------------------
            this._checkMandatory(findings, entry, 'capability', entry.capability)
            this._checkMandatory(findings, entry, 'api_type', entry.api_type)
            this._checkMandatory(findings, entry, 'api', entry.api)

            // --- capability must resolve ---------------------------------
            if (entry.capability) {
                var capRead = k.readOne(
                    'sys_one_extend_capability',
                    entry.capability,
                    ['sys_id', 'name'],
                    [],
                    data
                )
                if (capRead.status === 'DENIED') {
                    entry.capability_state = 'unverifiable'
                    entry.capability_note =
                        'sys_one_extend_capability is not readable from this scope, so the reference could ' +
                        'not be checked. Unknown, not broken.'
                } else if (!capRead.row) {
                    entry.capability_state = 'unresolvable'
                    findings.push({
                        finding: 'capability_unresolvable',
                        severity: 'high',
                        definition: entry.sys_id,
                        definition_name: entry.name,
                        field: 'capability',
                        value: entry.capability,
                        why:
                            'capability is a mandatory reference to sys_one_extend_capability and it ' +
                            'resolves to no record. The capability cannot be dispatched.',
                        next_step:
                            'Repoint capability at a real sys_one_extend_capability row. Note this ' +
                            'produces a "capability not found" signature at runtime, which is the ' +
                            'FALLBACK signature rather than the primary provider-mapping one.',
                    })
                } else {
                    entry.capability_state = 'resolved'
                    entry.capability_name = entry.capability_name || capRead.row.name
                }
            }

            // --- api: three outcomes, not two ----------------------------
            if (entry.api) this._checkApi(findings, entry, tableCache, data)

            definitions.push(entry)
        }

        data.definitions = definitions
        data.findings = findings
        data.read_status = read.status
        data.truncated_at = read.truncated_at || null

        // R-22 item 4: state the denominator every time a count is stated.
        data.connection_note =
            'An EMPTY connection is NOT a defect and is not reported as one. Measured over the whole ' +
            'sys_one_extend_capability_definition table on the reference instance: ' +
            this.CONNECTION_EMPTY_COUNT +
            ' of ' +
            this.DEFINITION_ROW_COUNT +
            ' rows (15.7%) have it empty, including shipped OOB Now Assist definitions, and sys_dictionary ' +
            'records the column mandatory=false. A check that flagged it would report ' +
            this.CONNECTION_EMPTY_COUNT +
            ' healthy capabilities as broken. The mandatory bindings — capability, api_type and api — are ' +
            'what this mode checks (DESIGN.md R-22).'

        data.stats = {
            definitions_checked: definitions.length,
            findings: findings.length,
            read_status: read.status,
            checks_per_definition: 4,
            check_names: [
                'mandatory_binding_empty (capability, api_type, api)',
                'capability_unresolvable',
                'api_dangling',
                'api unverifiable classification',
            ],
            truncated_at: data.truncated_at,
        }

        if (data.truncated_at) {
            data.notes.push(
                'Only the first ' +
                    this.MAX_DEFINITIONS +
                    ' definitions were read, ordered by name. On a typical instance there are around ' +
                    this.DEFINITION_ROW_COUNT +
                    ' of them, so this is a sample rather than a sweep — stated rather than silently ' +
                    'truncated. Narrow the check by naming a capability once that argument exists.'
            )
        }
    },

    _checkMandatory: function (findings, entry, field, value) {
        if (value) return
        findings.push({
            finding: 'mandatory_binding_empty',
            severity: 'high',
            definition: entry.sys_id,
            definition_name: entry.name,
            field: field,
            value: '',
            why:
                field +
                ' is mandatory=true in sys_dictionary and this row has it empty. Measured on the reference ' +
                'instance, exactly 1 of 2026 rows is missing a mandatory binding, so this is genuinely ' +
                'anomalous rather than a common state.',
            next_step: 'Populate ' + field + ' on the capability definition.',
        })
    },

    /**
     * `api` is document_id — no referential integrity, so a dangling value
     * installs verbatim. Resolve it against the table `api_type` names, and
     * keep "cannot check" separate from "checked and missing".
     */
    _checkApi: function (findings, entry, tableCache, data) {
        var k = this._k()
        var typeName = entry.api_type

        if (!typeName) {
            entry.api_state = 'unverifiable'
            entry.api_note = 'api_type is empty, so there is no table to resolve api against.'
            return
        }

        var isTable = this._isTable(typeName, tableCache, data)

        if (isTable === 'unknown') {
            entry.api_state = 'unverifiable'
            entry.api_note =
                'sys_db_object could not be read, so whether "' +
                typeName +
                '" names a table is unknown. api was not checked.'
            return
        }

        if (isTable === false) {
            // Measured: `Decision` is api_type on 1 of 2026 rows and is not a
            // table. Reporting it as dangling would be a false positive on the
            // single most unusual row in the table.
            entry.api_state = 'unverifiable'
            entry.api_note =
                'api_type "' +
                typeName +
                '" is not a table name, so api cannot be resolved by record lookup. This is a real, ' +
                'supported shape — not every capability dispatches through a table — and is NOT reported ' +
                'as a dangling reference.'
            return
        }

        var target = k.readOne(typeName, entry.api, ['sys_id'], [], data)

        if (target.status === 'DENIED') {
            entry.api_state = 'unverifiable'
            entry.api_note =
                typeName +
                ' is not readable from this scope, so api could not be resolved. Unknown, not dangling — ' +
                'reporting a permission gap as a missing record is how a healthy capability gets ' +
                'diagnosed as broken.'
            return
        }

        if (!target.row) {
            entry.api_state = 'dangling'
            findings.push({
                finding: 'api_dangling',
                severity: 'high',
                definition: entry.sys_id,
                definition_name: entry.name,
                field: 'api',
                value: entry.api,
                api_type: typeName,
                why:
                    'api is mandatory and its value resolves to no record in ' +
                    typeName +
                    '. Because api is internal_type document_id it carries NO referential integrity, so a ' +
                    'dangling value installs verbatim and nothing complains until the capability is ' +
                    'invoked — at which point the failure surfaces from the executor, far from its cause.',
                next_step:
                    'Repoint api at a real ' +
                    typeName +
                    ' record — the provider integration the capability is meant to dispatch through.',
            })
            return
        }

        entry.api_state = 'resolved'
    },

    /** @returns {Boolean|String} true, false, or 'unknown' when sys_db_object is unreadable. */
    _isTable: function (name, cache, data) {
        if (cache[name] !== undefined) return cache[name]
        var k = this._k()

        var read = k.readRows(
            'sys_db_object',
            k.eqQuery('name', name),
            ['sys_id', 'name'],
            [],
            1,
            null,
            data
        )

        var result
        if (read.status === 'DENIED') result = 'unknown'
        else result = read.rows.length > 0

        cache[name] = result
        return result
    },

    // =======================================================================
    // Shaping
    // =======================================================================

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
                'GenAI stack.',
            entry_rows: data.entries ? data.entries.length : 0,
            llm_call_rows: data.llm_calls ? data.llm_calls.length : 0,
            definition_rows: data.definitions ? data.definitions.length : 0,
            findings: data.findings ? data.findings.length : 0,
            read_status_by_table: data.reads,
            tables_with_missing_fields: data.field_warnings.length,
        }
    },

    type: 'PaToolGenAiLog',
}
