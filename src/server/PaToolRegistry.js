/**
 * PaToolRegistry — the custom harness's dispatch layer over the seven Phase 1a
 * tool cores (ARCHITECTURE_DECISIONS.md "Layer 5", Phase 1b Task 3).
 *
 * WHY THIS EXISTS ALONGSIDE PaScriptToolAdapter, NOT INSTEAD OF IT
 * Phase 1a shipped the native harness path: a Fluent AiAgent whose script
 * tools each call PaScriptToolAdapter.invoke(name, ...), which resolves a tool
 * core by name, audits it, thresholds its output, and — because it is called
 * from a platform IIFE — always returns a String. Phase 1b's custom harness
 * runs its OWN reasoning loop (LLD, PaLlmProxy) instead of the native AIA
 * engine, and that loop calls tool cores directly rather than through a
 * platform tool wrapper. It needs the SAME resolve/audit/threshold plumbing,
 * with a shell suited to an in-process caller: dispatch() takes a run context
 * object and returns the result object itself, not a stringified envelope.
 *
 * The tool cores are unchanged. Both harnesses adapt to the same fixed
 * contract — execute(args) -> {success:true, data} | {success:false, error} —
 * from opposite ends.
 *
 * ---------------------------------------------------------------------------
 * ROSTER EQUALITY WITH PaScriptToolAdapter IS LOAD-BEARING
 * ---------------------------------------------------------------------------
 * DESIGN.md R-20 makes sweep completeness DERIVED rather than declared: how
 * many diagnostic layers a run actually swept is read back as the distinct
 * `tool_name` set over that run's x_snc_troubleshoot_audit rows. Both harnesses
 * write to the same audit table. If this registry's keys drifted from the
 * adapter's — a rename, a typo, an extra or missing entry — a run through the
 * custom harness would write different tool_name values than an equivalent run
 * through the native agent, and R-20's derived-completeness metric would score
 * that drift instead of the diagnosis. test/PaToolRegistry.test.js enforces the
 * two rosters are identical by reading both files as text, mirroring the
 * technique test/agentDoctorInstructions.test.js uses for the Fluent-agent /
 * adapter pair (the two sides here are equally incapable of importing one
 * another: ES5 Script Includes have no import, and this repo does not
 * generate one registry from the other).
 *
 * ---------------------------------------------------------------------------
 * promptBlock() IS GENERATED, NEVER HAND-DUPLICATED
 * ---------------------------------------------------------------------------
 * Every tool's description lives in exactly ONE place in this file: the
 * `_registry()` metadata map. `list()` reads it, `promptBlock()` reads
 * `list()`. There is no second, independently-maintained description string
 * anywhere in this file. The text itself is the same wording the native
 * AiAgent carries (src/fluent/agent-doctor.now.ts `tools[].description`) —
 * both harnesses reason about the same seven tools and should describe them
 * identically, not via two prose accounts that drift apart the first time
 * either is edited. test/PaToolRegistry.test.js checks both properties: that
 * promptBlock() reflects whatever list() reports (structural, catches a
 * reintroduced second copy), and that the shipped text matches the Fluent
 * agent's descriptions verbatim (content, catches editorial drift).
 *
 * ---------------------------------------------------------------------------
 * THE DESTRUCTIVE GATE — FAIL CLOSED, NOT FAIL OPEN
 * ---------------------------------------------------------------------------
 * Every Phase 1 tool registers `readOnly: true`. dispatch() refuses to run any
 * tool whose registration does not EXPLICITLY carry `destructive: false`,
 * citing Phase 3's confirmation flow by name. The check is deliberately
 * `entry.destructive !== false` rather than `entry.destructive === true`: the
 * latter fails OPEN for an entry that simply omits the field (`undefined`
 * sails through ungated), which is exactly the failure mode this gate exists
 * to prevent — a future registration author has to positively assert
 * safety to be dispatched, rather than accidentally getting it by forgetting
 * to write a line. Phase 1/1b never registers a destructive tool — the gate is
 * proven now, against a hypothetical registration that OMITS the field as well
 * as one that sets `destructive: true`, precisely so that when Phase 3 adds
 * destructive tools it is adding a confirmation flow on top of an
 * already-enforced, structurally-safe gate, not discovering the gate was
 * never built (or was fail-open) and retrofitting safety after the fact.
 *
 * ---------------------------------------------------------------------------
 * STANDING RULES THIS FILE IS BUILT AROUND
 * ---------------------------------------------------------------------------
 * R-1  Never touch the exception object in a catch. A core running under
 *      GlideRecordSecure can throw a cross-scope denial whose `.message`
 *      getter throws again; every catch here records a reason it chose itself.
 * R-9  Every input (args, runCtx) may be absent.
 * R-20 See ROSTER EQUALITY above.
 */
var PaToolRegistry = Class.create()

PaToolRegistry.prototype = {
    /**
     * @param {Object} [options] {cores, auditLogger, artifactStore, readKit} —
     *        injection points for tests and for callers with a different
     *        collaborator set. `cores` replaces the entire default roster
     *        map wholesale, the same way PaScriptToolAdapter's `tools` option
     *        does — it is not merged with the real seven. `readKit` is a
     *        `PaToolReadKit` instance (#121) — injectable because
     *        PaToolReadKit is a separate Script Include not present in the
     *        `vm` context the tests build for this file.
     */
    initialize: function (options) {
        var o = options || {}
        this._cores = o.cores || null
        this._auditLogger = o.auditLogger || null
        this._artifactStore = o.artifactStore || null
        this._readKit = o.readKit || null
    },

    // =======================================================================
    // Registry — name -> {layer, description, readOnly, destructive, factory}
    // =======================================================================

    /**
     * Seven entries, matching PaScriptToolAdapter's registry key-for-key (see
     * ROSTER EQUALITY above). Descriptions are copied verbatim from
     * src/fluent/agent-doctor.now.ts `tools[].description` — see
     * promptBlock() IS GENERATED above for why that is one authored source
     * rather than two.
     */
    _registry: function () {
        if (this._cores) return this._cores
        return {
            agent_trace: {
                layer: 'layer 1',
                readOnly: true,
                destructive: false,
                // #91 — which sections survive truncation, most diagnostic
                // first. A real trace is ~19KB against a 2,000-char excerpt
                // budget, and the blind head/tail slice this replaces kept
                // `resolution`/`reads`/`notes`/`header` and `evidence_basis`
                // (all of which say "state completed, every read ok") while
                // eliding `tool_calls`, `script_errors` and the failure
                // signatures. Seed 03's whole answer — `rules_in_table: 0` —
                // is a tool-call response digest, i.e. exactly what was being
                // thrown away. `header` ranks high because it carries
                // `failure_signature`; `task_tree` ranks last because its task
                // outputs are the bulk and the least load-bearing.
                excerptPriority: [
                    'script_errors',
                    'header',
                    'tool_calls',
                    'tool_call_stats',
                    'latency_flags',
                    'task_stats',
                    'field_warnings',
                    'reads',
                    'notes',
                    'message_stats',
                    'evidence_basis',
                    'resolution',
                    'messages',
                    'conversation',
                    'task_tree',
                ],
                description:
                    "Replays a failing AI Agent execution - diagnostic layer 1, and the place to start. It returns the plan header (state, state_reason, status, objective, timings), the task tree, every tool call with its status and error message, the message stream with server-script stack errors mined out of it, plus failure signatures and latency flags. Do NOT use it to inspect how an agent is configured - it reports what happened on one run, not what the agent was set up to do; agent_config answers that. UNDERSTANDING TOOL INPUTS: pass an execution plan sys_id, or an agent name, or a JSON object with execution, agent, since or step. All of it is optional - with no argument at all you get a pick-list of recent execution plans to choose from. The words execution, agent, since and step are parameter names, never part of a value: send the sys_id alone, not execution:<sys_id>. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: returns a summary object whose reads block gives a per-table read status. A section that is empty with status ok or empty means the data is genuinely absent; DENIED means a permission gap and says nothing about the run. Execution tasks and tool calls are counted separately and are NOT expected to match - the difference between task_stats and tool_call_stats is never a finding. Large traces come back as an excerpt plus an artifact id - page the rest with read_artifact rather than calling this again.",
                factory: function () {
                    return new PaToolAgentTrace()
                },
            },
            agent_config: {
                layer: 'layers 2, 3 and 7',
                readOnly: true,
                destructive: false,
                description:
                    "Inspects how an agent is CONFIGURED rather than what one run did - diagnostic layers 2, 3 and 7. It returns the agent record, the full instruction text, the context_processing_script and applicability_script from both the agent and its use cases, every attached tool with its verbatim input schema and script scored against a tool-quality checklist, and the trigger wiring walked from both the agent-direct and team-usecase branches. Do NOT use it to find out why a particular execution failed - it has no knowledge of any run; agent_trace answers that. UNDERSTANDING TOOL INPUTS: pass an agent name or sys_id, optionally with section set to overview, instructions, tools or triggers. Omitting section returns all four, which is usually what you want; omitting the agent returns a pick-list of agents. The words agent and section are parameter names, never part of a value: send the agent name alone, not agent:<name>. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: returns one object per requested section plus a reads block of per-table statuses and an evidence_basis stating which rows each answer came from. The access role set is reported as ONE combined list because no field distinguishes User Access from Data Access - treat any attribution between them as heuristic. An empty section with status DENIED is a permission gap, not an unconfigured agent.",
                factory: function () {
                    return new PaToolAgentConfig()
                },
            },
            schema_lookup: {
                layer: 'layer 4',
                readOnly: true,
                destructive: false,
                description:
                    "Describes a table and its columns - diagnostic layer 4. It confirms the table exists, walks the whole super_class chain so inherited columns are found rather than reported as missing, and returns each column with its type, mandatory flag, reference target, default and declaring table, plus choice values when you ask about one field. Use it whenever a value read back blank and you need to know whether the column exists at all. Do NOT use it to read record data - it describes the shape of a table, never its contents; query_table does that. UNDERSTANDING TOOL INPUTS: pass the table name by itself, a JSON object with table and field, or the dotted shorthand with the real names substituted - incident.priority, where incident is the table and priority is the column. The words table and field are parameter names, never part of a value: send incident, not table:incident. The field is optional; without it you get the whole column list. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: table does not exist and table exists but no columns are readable are reported as DIFFERENT findings - the first is a wrong name, the second a cross-scope privilege gap, and they have opposite fixes. An unknown column comes back with exists false plus near-miss suggestions, because a query on a wrong column name returns a blank rather than an error.",
                factory: function () {
                    return new PaToolSchemaLookup()
                },
            },
            query_table: {
                layer: 'layer 5',
                readOnly: true,
                destructive: false,
                description:
                    "Reads records from any table the caller may see - diagnostic layer 5, for checking whether the data an agent needed actually exists. It validates the table name first, applies your encoded query through GlideRecordSecure, and caps the result. Do NOT use it to explore a table you have not confirmed the shape of - run schema_lookup first so your query names real columns; a query on a wrong column name returns nothing rather than an error. UNDERSTANDING TOOL INPUTS: pass a JSON object with table, and optionally query as an encoded query string, fields as a list or comma-separated string, and limit (default 20, capped at 100). A bare string is taken as the table name. The words table, query, fields and limit are parameter names, never part of a value: send incident, not table:incident. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: rows come back with every value digested. An empty result is NOT reported as bare emptiness - it is checked against an unfiltered count and classified as genuinely_empty (a data defect, fix by seeding), acl_filtered (the rows exist but the caller cannot see them, fix with a read ACL), or unknown. A denied read is reported as a privilege gap that says nothing about whether the data exists.",
                factory: function () {
                    return new PaToolQueryTable()
                },
            },
            genai_log: {
                layer: 'layer 6',
                readOnly: true,
                destructive: false,
                description:
                    "Inspects the GenAI stack - diagnostic layer 6: whether the model was called, what it did, and whether the capability is wired to a provider at all. Four modes: usage for assist consumption, llm for per-call model metadata, for_execution to join a run and its steps to their LLM calls, and check_config to audit capability definitions. Do NOT use it to read the agent's own reasoning steps - those are execution tasks and belong to agent_trace. UNDERSTANDING TOOL INPUTS: pass a JSON object with mode, and optionally execution, minutes_ago, errors_only and include_payload. In check_config, capability narrows the audit to the named capability's definitions or to name-matching definitions - pass a definition or capability sys_id, or a definition-name substring; without it only a 100-row name-ordered sample is audited, which cannot reach x_-prefixed capabilities. A bare mode name works, and a bare sys_id is treated as an execution. With no argument at all it runs llm over the last 60 minutes, errors only. The words mode, execution, minutes_ago, errors_only, include_payload and capability are parameter names, never part of a value: send the sys_id alone, not execution:<sys_id>. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: check_config flags only the three mandatory bindings - an empty connection is NORMAL and is never a finding. An api that cannot be resolved is reported as dangling only when the target table was readable; otherwise it is unverifiable. Prompt and response payloads are role-gated: when they cannot be read you get a stated not_readable rather than an empty result, which means metadata only, not that there was no prompt.",
                factory: function () {
                    return new PaToolGenAiLog()
                },
            },
            log_analysis: {
                layer: 'platform logs',
                readOnly: true,
                destructive: false,
                description:
                    "Reads platform log entries scoped to an execution or a source - the layer around the run rather than inside it. Use it for platform, script and ACL errors that would not appear in the execution record itself. Do NOT expect it to work on most instances: the syslog table restricts cross-scope callers and this application cannot lift that restriction for itself, so this tool usually reports the layer as unavailable. Do NOT use it as a general log search either - every query must be scoped. UNDERSTANDING TOOL INPUTS: pass a JSON object with execution, or with source and message, plus optional level, minutes_ago and limit. An execution plan sys_id scopes the query completely on its own by deriving the time window from the plan. The words execution, source, message, level, minutes_ago and limit are parameter names, never part of a value: send the sys_id alone, not execution:<sys_id>. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: an insufficiently scoped query is REFUSED before it reaches the database with status refused_unscoped, naming the missing condition. Status unavailable means the log layer was not swept and carries the admin action required - report that as a gap in your sweep, never as a clean log layer. Status empty means the table was read and nothing matched, which is a genuine finding.",
                factory: function () {
                    return new PaToolLogAnalysis()
                },
            },
            read_artifact: {
                layer: 'not a layer',
                readOnly: true,
                destructive: false,
                description:
                    "Pages through a large piece of evidence that was stored as an artifact. When any diagnostic tool returns an excerpt plus an artifact id, call this with that id to read the full content in 4,000-character pages, advancing the offset each time. Do NOT re-run the tool that produced the excerpt instead: re-running costs a tool call and returns the same excerpt, so you would exhaust your budget without ever reading the evidence you already fetched. UNDERSTANDING TOOL INPUTS: pass an artifact sys_id, or a JSON object with artifact_id, offset and length. Offset defaults to 0 and length is capped at 4,000 characters. The words artifact_id, offset and length are parameter names, never part of a value: send the sys_id alone, not artifact_id:<sys_id>. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: the response carries the page content, the total length and whether more pages remain. Only artifacts belonging to a diagnostic run can be read - anything else is refused, which is a safety boundary rather than a failure of the tool.",
                factory: function () {
                    return new PaToolReadArtifact()
                },
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

    /**
     * @returns {Array} [{name, layer, description, readOnly}] — the roster the
     *          reasoning loop can present to a user, or feed to promptBlock().
     */
    list: function () {
        var reg = this._registry()
        var out = []
        for (var k in reg) {
            if (!Object.prototype.hasOwnProperty.call(reg, k)) continue
            var entry = reg[k]
            out.push({
                name: k,
                layer: entry.layer,
                description: entry.description,
                readOnly: entry.readOnly !== false,
            })
        }
        return out
    },

    // =======================================================================
    // dispatch
    // =======================================================================

    /**
     * @param {String} name a key of the registry
     * @param {Object|String} [args] passed to the core's execute() untouched —
     *        the cores own their own input tolerance (R-9); this method does
     *        not reshape args the way PaScriptToolAdapter.tolerantParse does.
     * @param {Object} [runCtx] {run_id, ...} — the custom harness's own run
     *        context. Unlike the adapter, this does NOT create a run; it
     *        reads run_id from whatever the caller already established.
     * @returns {Object} {success:true, data} | {success:false, error} — the
     *          core's own result (possibly thresholded), never a throw.
     */
    dispatch: function (name, args, runCtx) {
        var reg = this._registry()
        var toolName = this._normName(name)
        var entry = reg[toolName]

        if (!entry || typeof entry.factory !== 'function') {
            return {
                success: false,
                error: 'Unknown tool "' + toolName + '". Available tools: ' + this.toolNames().join(', ') + '.',
                // #200 (§AT) — THIS RETURN IS BEFORE `logIntent`, and saying so
                // is the point. `dispatched:false` marks a call this registry
                // refused without ever attempting an audit row, so a caller
                // reasoning about an EMPTY audit trail can tell "nothing was
                // written because nothing ran" from "nothing was written
                // because the writes were lost". `PaAgentLoop._depthGate`'s
                // §AQ floor is that caller; see `_dispatchTool` there.
                //
                // Marked on the two PRE-EXECUTION gates only. The catch branch
                // below is deliberately NOT marked: `logIntent` has already
                // run by then, so a core that throws did leave a row and its
                // absence really would be a write loss.
                dispatched: false,
            }
        }

        // The destructive gate — fail CLOSED. Every Phase 1 registration sets
        // destructive:false EXPLICITLY; anything else — true, or the field
        // simply omitted — is refused. See THE DESTRUCTIVE GATE above for why
        // this is `!== false` rather than `=== true`.
        if (entry.destructive !== false) {
            return {
                success: false,
                error:
                    'Tool "' +
                    toolName +
                    '" is not registered as explicitly non-destructive (destructive:false). PaToolRegistry refuses to dispatch destructive or unmarked tools directly — the confirmation flow is Phase 3.',
                // #200 (§AT) — the second pre-`logIntent` refusal. Same
                // reasoning as the unknown-tool gate above.
                dispatched: false,
            }
        }

        var runId = runCtx && runCtx.run_id ? String(runCtx.run_id) : ''

        this._audit('logIntent', { runId: runId, toolName: toolName, input: args })

        try {
            var core = entry.factory()
            var result = core.execute(args)

            // #121: THE VERDICT IS TAKEN HERE, and the position is the whole
            // point. `applyThreshold` below replaces an oversized result with
            // an excerpt envelope that carries no `data.reads` at all, and
            // PaAuditLogger then digests head+tail past 4,000 chars — so a
            // verdict read off the logged payload would score 'unknown' for
            // exactly the large results most likely to have retrieved
            // something. DECISION.md §T4 / §U9.1 are what this exists to make
            // countable; see the design doc §3.1.
            var retrieval = this._retrievalVerdict(result)

            // Mirrors PaScriptToolAdapter: a PAGED_OUTPUT core (read_artifact)
            // already returns paged content at the threshold ceiling — running
            // it back through applyThreshold would store every page as a fresh
            // artifact instead of handing the page to the caller.
            if (!core.PAGED_OUTPUT) {
                result = this._store().applyThreshold(runId, result, toolName, entry.excerptPriority)
            }

            this._audit('logResult', { runId: runId, toolName: toolName, output: result, retrieval: retrieval })
            return result
        } catch (e) {
            // R-1: `e` is never inspected.
            this._audit('logError', {
                runId: runId,
                toolName: toolName,
                error: 'PaToolRegistry dispatch failed for ' + toolName + '.',
            })
            return {
                success: false,
                error:
                    'The diagnostic tool "' +
                    toolName +
                    '" failed during dispatch. The underlying exception is deliberately not inspected, because reading one from a ' +
                    'cross-scope denial throws again. Treat this tool as unavailable for this call rather than as returning no data.',
            }
        }
    },

    // =======================================================================
    // promptBlock — the reasoning prompt's tools section
    // =======================================================================

    /**
     * @returns {String} one block per tool, generated from list() — see
     *          promptBlock() IS GENERATED above. No description text is
     *          authored here; every word comes from the registry metadata.
     */
    promptBlock: function () {
        var entries = this.list()
        var lines = []
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i]
            lines.push(e.name + ' (' + e.layer + '): ' + e.description)
        }
        return lines.join('\n\n')
    },

    // =======================================================================
    // Collaborators — lazily resolved so tests can inject
    // =======================================================================

    _store: function () {
        return this._artifactStore || new PaArtifactStore()
    },

    /**
     * The #121 retrieval verdict, taken on a tool core's PRE-THRESHOLD result.
     *
     * Guarded for the same reason `_audit` is: this component is in the hot
     * path of every tool call, and a diagnosis that fails because its own
     * instrumentation threw is strictly worse than a diagnosis with a gap in
     * the instrument. 'unknown' is a legitimate answer (R-10); an exception
     * escaping into the loop is not.
     */
    _retrievalVerdict: function (result) {
        try {
            var kit = this._readKit || new PaToolReadKit()
            return kit.retrievalVerdict(result)
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            return 'unknown'
        }
    },

    /**
     * Audit is best-effort by construction, same as PaScriptToolAdapter._audit
     * — it sits in the hot path, and an audit failure must never become a
     * tool failure.
     */
    _audit: function (method, params) {
        try {
            var logger = this._auditLogger || new PaAuditLogger()
            if (logger && typeof logger[method] === 'function') logger[method](params)
        } catch (e) {
            // R-1: `e` untouched, and deliberately swallowed.
        }
    },

    _normName: function (v) {
        return String(v === null || v === undefined ? '' : v).replace(/^\s+|\s+$/g, '')
    },

    type: 'PaToolRegistry',
}
