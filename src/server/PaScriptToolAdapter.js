/**
 * PaScriptToolAdapter — the native harness bridge (LLD §4.7, Task 9).
 *
 * An AI Agent script tool is a one-line IIFE that calls invoke(). Everything
 * between the orchestrator and a tool core happens here: tolerant input
 * parsing, run anchoring, audit, artifact thresholding, and — above all —
 * containment. invoke() returns a String on EVERY path, including every failure
 * path. A thrown exception reaching the planner is a documented native pain
 * point, and an exception is the worst shape of all to hand it.
 *
 * TOOLS ARE RESOLVED BY NAME AGAINST A FACTORY MAP, NOT BY CLASS NAME.
 * LLD §4.7 writes the signature as invoke(toolClassName, ...). This deviates
 * deliberately: the first argument originates in a tool-script literal and
 * beyond that in whatever the platform hands the wrapper, so resolving an
 * arbitrary class by string is a code-execution surface. A factory map is a
 * closed set, errors cleanly on a typo, and its key is the same string written
 * to x_snc_troubleshoot_audit.tool_name — so the registry and the audit trail
 * cannot drift apart.
 *
 * accessibleFrom 'public': a script tool runs in rhino.global, not in
 * x_snc_troubleshoot (DESIGN.md R-5).
 */
var PaScriptToolAdapter = Class.create()

PaScriptToolAdapter.prototype = {
    /**
     * @param {Object} [options] {tools, runAnchor, auditLogger, artifactStore}
     *        — injection points for tests and for the probe route.
     */
    initialize: function (options) {
        var o = options || {}
        this._tools = o.tools || null
        this._runAnchor = o.runAnchor || null
        this._auditLogger = o.auditLogger || null
        this._artifactStore = o.artifactStore || null
    },

    // =======================================================================
    // Registry
    // =======================================================================

    /**
     * Name -> factory. Seven entries: the six diagnostic tool cores plus the
     * paging primitive.
     *
     * The key is the string written to x_snc_troubleshoot_audit.tool_name, and
     * that is not incidental — DESIGN.md R-20 makes completeness DERIVED rather
     * than declared: how many layers a diagnosis actually swept is the distinct
     * tool_name set over the audit rows for a run. If a key here drifts from
     * the name in the Fluent tools[] entry, the run looks like it swept fewer
     * layers than it did, and the benchmark scores the drift rather than the
     * diagnosis.
     */
    _registry: function () {
        if (this._tools) return this._tools
        return {
            agent_trace: function () {
                return new PaToolAgentTrace()
            },
            agent_config: function () {
                return new PaToolAgentConfig()
            },
            genai_log: function () {
                return new PaToolGenAiLog()
            },
            schema_lookup: function () {
                return new PaToolSchemaLookup()
            },
            query_table: function () {
                return new PaToolQueryTable()
            },
            log_analysis: function () {
                return new PaToolLogAnalysis()
            },
            read_artifact: function () {
                return new PaToolReadArtifact()
            },
        }
    },

    /** @returns {Array} the registered tool names — used in the unknown-tool error. */
    toolNames: function () {
        var reg = this._registry()
        var names = []
        for (var k in reg) {
            if (Object.prototype.hasOwnProperty.call(reg, k)) names.push(k)
        }
        return names
    },

    // =======================================================================
    // invoke
    // =======================================================================

    /**
     * @param {String} toolName a key of the registry
     * @param {Object|String} [rawInput] the wrapper's single `request` input
     * @param {Object|String} [ctx] passed to PaRunAnchor.getOrCreate
     * @returns {String} ALWAYS a string, never a throw
     */
    invoke: function (toolName, rawInput, ctx) {
        var phase = 'lookup'
        var name = ''
        var runId = ''

        try {
            name = this._normName(toolName)
            var factory = this._registry()[name]
            if (typeof factory !== 'function') {
                // Short-circuit BEFORE any side effect: no anchor for a call
                // that never happened, no audit row for a tool that does not
                // exist.
                return this._errorString(
                    'Unknown tool ' + this._quote(name) + '. Available tools: ' + this.toolNames().join(', ') + '.',
                    'lookup'
                )
            }

            phase = 'parse'
            var args = this.tolerantParse(rawInput)

            phase = 'anchor'
            var run = this._anchor().getOrCreate(ctx)
            runId = run && run.run_id ? String(run.run_id) : ''

            phase = 'intent'
            this._audit('logIntent', { runId: runId, toolName: name, input: args })

            phase = 'execute'
            var core = factory()
            var result = core.execute(args)

            phase = 'threshold'
            if (!core.PAGED_OUTPUT) {
                result = this._store().applyThreshold(runId, result, name)
            }

            phase = 'result'
            result = this._attachRunState(result, run)
            this._audit('logResult', { runId: runId, toolName: name, output: result })

            phase = 'serialize'
            return this._stringify(result)
        } catch (e) {
            // R-1: `e` is NEVER inspected. `phase` is what localises the failure.
            this._audit('logError', {
                runId: runId,
                toolName: name,
                error: 'Adapter failed at phase ' + phase + '.',
            })
            return this._errorString(
                'The diagnostic tool ' +
                    this._quote(name) +
                    ' failed at stage ' +
                    this._quote(phase) +
                    '. The underlying exception is deliberately not inspected, because reading one from a ' +
                    'cross-scope denial throws again. Treat this tool as unavailable for this call rather than ' +
                    'as returning no data.',
                phase
            )
        }
    },

    // =======================================================================
    // Input
    // =======================================================================

    /**
     * LLD §4.7: JSON object -> object, "" -> {}, BARE STRING -> UNCHANGED.
     *
     * The last clause is the one that gets "helpfully" broken. Pre-wrapping a
     * bare string as {value: s} produces an args object with none of the keys
     * the cores read: PaToolAgentTrace maps a bare 32-char hex string to
     * {execution: ...} and any other bare string to {agent: ...}, so a wrapper
     * makes it fall through to the recent-plan pick-list and silently discard
     * the caller's actual request. Nothing errors.
     *
     * It never rejects: a '{'-leading string that fails to parse goes through
     * untouched so the core emits its own _parse_error. One place decides what
     * an input means, and it is not this one.
     */
    tolerantParse: function (rawInput) {
        if (rawInput === null || rawInput === undefined) return {}

        if (typeof rawInput === 'object') return rawInput

        if (typeof rawInput !== 'string') return {}

        var original = String(rawInput)
        var s = original.replace(/^\s+|\s+$/g, '')
        if (!s) return {}

        var parsed = null
        try {
            parsed = JSON.parse(s)
        } catch (e) {
            // R-1: `e` untouched.
            parsed = null
        }

        if (parsed && typeof parsed === 'object' && Object.prototype.toString.call(parsed) !== '[object Array]') {
            return parsed
        }

        return original
    },

    // =======================================================================
    // Collaborators — lazily resolved so tests can inject
    // =======================================================================

    _anchor: function () {
        return this._runAnchor || new PaRunAnchor()
    },

    _store: function () {
        return this._artifactStore || new PaArtifactStore()
    },

    /**
     * Audit is best-effort by construction. It sits in the hot path, and an
     * audit failure must never become a tool failure — the caller came for a
     * diagnosis, not for a durable trail.
     */
    _audit: function (method, params) {
        try {
            var logger = this._auditLogger || new PaAuditLogger()
            if (logger && typeof logger[method] === 'function') logger[method](params)
        } catch (e) {
            // R-1: `e` untouched, and deliberately swallowed.
        }
    },

    // =======================================================================
    // Output
    // =======================================================================

    /**
     * R-10 applied one layer out. PaRunAnchor can degrade to run_id: null, and
     * PaArtifactStore and PaAuditLogger both tolerate that quietly — but the
     * AGENT is never told. A diagnosis whose evidence trail was not durable is
     * still a valid diagnosis; the difference has to be stated rather than
     * inferred. Non-destructive: the core's own result is never mutated.
     */
    _attachRunState: function (result, run) {
        if (!run || !run.degraded) return result
        if (!result || typeof result !== 'object') return result
        if (Object.prototype.toString.call(result) === '[object Array]') return result

        var out = {}
        for (var k in result) {
            if (Object.prototype.hasOwnProperty.call(result, k)) out[k] = result[k]
        }
        out.run = { degraded: run.degraded, note: run.note }
        return out
    },

    _stringify: function (value) {
        if (typeof value === 'string') return value
        if (value === undefined) {
            return this._errorString(
                'The tool returned no result. Treat this tool as unavailable for this call rather than as returning no data.',
                'serialize'
            )
        }
        return JSON.stringify(value)
    },

    _errorString: function (message, phase) {
        return JSON.stringify({ success: false, error: message, phase: phase })
    },

    _normName: function (v) {
        return String(v === null || v === undefined ? '' : v).replace(/^\s+|\s+$/g, '')
    },

    _quote: function (v) {
        return '"' + String(v) + '"'
    },

    type: 'PaScriptToolAdapter',
}
