/**
 * PaRunManager — the custom harness's run lifecycle (LOW_LEVEL_DESIGN.md
 * §3.1/§4.6, DECISION.md §D5, DESIGN.md R-20; Phase 1b Task 5).
 *
 * WHAT THIS EXISTS FOR
 * The native harness never closes a run — DESIGN.md R-20 rules that out on
 * measured grounds and forbids `PaRunAnchor` from ever exposing a way to do it
 * (see that file's guard test). The CUSTOM harness is a different animal: it
 * IS the thing deciding when a diagnosis is done, so it needs the lifecycle
 * R-20 withheld from the native path — create, append, close, and (per §D5)
 * a sweep that stops native anchors from accumulating as `running` forever
 * without reopening R-20's "completeness is derived, not declared" ruling.
 * This class is where that lifecycle lives; `x_snc_troubleshoot_run` already
 * carries every column it needs (`transcript`, `context_summary`, `fix_report`,
 * `error`, the five-value status choice) — nothing here alters the schema.
 *
 * CONTRACT
 *   createRun({user, agent, executionRef, mode}) -> {run_id, number}
 *     harness:'custom', status:'queued'.
 *   appendTranscript(runId, entry) -> {success, entry, count} | {success:false, error}
 *     entry: {seq?, actor:'llm'|'tool'|'system', tool?, args_digest?,
 *             result_digest?, artifact_id?, ts?}
 *   loadContext(runId) -> {transcript:[...], context_summary}
 *   maybeSummarize(runId) -> {summarized:true, ...} | {summarized:false, reason}
 *   close(runId, status, {fixReport?, error?}) -> {success:true, ...} | {success:false, error}
 *   collectBundle(runId) -> {success:true, data:{layers:{...}}}
 *   sweepStaleNative({maxAgeHours}) -> {closed:[run_id, ...]}
 *
 * ---------------------------------------------------------------------------
 * WHY createRun MANUFACTURES ITS OWN IDENTITY, RATHER THAN KEYING ON THE
 * CALLER'S executionRef
 * ---------------------------------------------------------------------------
 * `PaRunAnchor.getOrCreate` was built for the NATIVE harness's problem: many
 * tool calls with no shared handle except an ambient global, converging on one
 * row via a key lookup. The custom harness does not have that problem — LLD
 * §4.6 point 5 calls this the "custom: explicit run_id" path, and the harness
 * genuinely does hold an explicit run_id from the moment `createRun` returns
 * one, threading it through every later call directly rather than re-deriving
 * it. So `getOrCreate`'s key-based GET is not something this class wants to
 * lean on: if `executionRef` (the plan/agent UNDER diagnosis) were passed as
 * the key, two unrelated `createRun` calls diagnosing the same execution plan
 * would silently converge onto one row — exactly the merge R-2 exists to
 * forbid on the native side, reopened here by accident. `createRun` therefore
 * hands `getOrCreate` a freshly manufactured, single-use `conversationId` so
 * it always takes the create-fresh path; `executionRef`/`agent` still land on
 * the row as data (via the anchor's own field writes), they just never
 * become the lookup key.
 *
 * ---------------------------------------------------------------------------
 * WHY createRun STAMPS status AFTER getOrCreate, NOT THROUGH IT
 * ---------------------------------------------------------------------------
 * `PaRunAnchor` inserts every row at `status:'running'` unconditionally — that
 * is what DESIGN.md R-20 requires for the harness it was built for, and the
 * anchor has no parameter to override it (nor should it: R-20's guard test
 * scans that file for the very status values this class needs to write). A
 * fresh custom run needs to start at `queued` — the REST handler (Task 7)
 * enqueues the async worker and answers the caller before any reasoning has
 * happened — so this class corrects the status with its own direct write
 * immediately after the anchor returns. This is not a workaround: `close()`
 * and the §D5 sweep already prove that lifecycle status-setting belongs to
 * PaRunManager, not to PaRunAnchor; `queued` on create is the same authority
 * exercised one row-write earlier.
 *
 * ---------------------------------------------------------------------------
 * WHY PaArtifactStore ISN'T A DIRECT COLLABORATOR HERE
 * ---------------------------------------------------------------------------
 * `collectBundle` dispatches through `PaToolRegistry`, and every one of the
 * registry's `dispatch()` calls ALREADY runs the result through
 * `PaArtifactStore.applyThreshold` (LLD §4.7's ordering, mirrored in
 * `PaToolRegistry.dispatch`). Wrapping the composed seven-layer bundle in a
 * SECOND threshold pass would collapse its `data.layers.{1..7}` shape into a
 * generic truncated envelope the moment the combined payload crossed 4,000
 * chars — breaking the one shape the REST handler and a human reading the
 * bundle actually need. So this class consumes `PaArtifactStore` only
 * TRANSITIVELY, through the registry it calls; it holds no reference of its
 * own. (`transcript`/`context_summary`/`fix_report` are the run table's own
 * "string (JSON, large)" columns, LLD §3.1 — sized for this purpose, not
 * routed through the artifact-attachment path either.)
 *
 * ---------------------------------------------------------------------------
 * §D5, MADE EXPLICIT: sweepStaleNative DOES NOT REOPEN R-20
 * ---------------------------------------------------------------------------
 * R-20's ruling is that a native run's COMPLETENESS cannot be declared, only
 * derived from the audit trail — and that stands. What DECISION.md §D5
 * observed is a DIFFERENT problem: every benchmarked run's anchor sat at
 * `status:'running'` forever because nothing ever touched it again, which
 * is a resource-accumulation defect, not a claim about whether the diagnosis
 * finished. The sweep closes a native run ONLY when it is old AND has had no
 * audit activity inside the window — evidence of abandonment, not evidence of
 * completion — and it says so IN the row: the appended transcript entry cites
 * R-20 by name so nothing downstream mistakes `status:'complete'` here for a
 * claim that the diagnosis was thorough. `awaiting_confirmation` runs are
 * excluded by construction (the sweep only ever considers `status:'running'`
 * rows) and never expire, matching the brief.
 *
 * ---------------------------------------------------------------------------
 * STANDING RULES THIS FILE IS BUILT AROUND
 * ---------------------------------------------------------------------------
 * R-1  Never touch the exception object in a catch. Every catch here records
 *      a reason it chose itself and moves on.
 * R-9  Every input may be absent. `entry`, `options`, even `runId` itself
 *      degrade explicitly rather than throwing.
 * R-11 A DENIED read is reported as DENIED, never collapsed into an absence.
 *      `collectBundle` passes each tool's own `data.reads` denial through to
 *      the layer's `status` rather than flattening every non-success into one
 *      generic failure.
 * R-19b A status must not contradict the notes sitting next to it — illegal
 *      `close()` transitions are refused with a message naming both the
 *      FROM and the TO state, never silently coerced into a "success" that
 *      the row's own history would then contradict.
 *
 * Build Rule #42: writes here use plain `GlideRecord`, not `GlideRecordSecure`
 * — a Fluent `Table()` installs with zero ACLs, so the secure variant would
 * deny this app write access to its own run/audit tables.
 */
var PaRunManager = Class.create()

PaRunManager.prototype = {
    RUN_TABLE: 'x_snc_troubleshoot_run',
    AUDIT_TABLE: 'x_snc_troubleshoot_audit',

    /** 200-char digests, matching PaToolReadKit.DIGEST_CHARS — the established
     *  ceiling for a single trace line, distinct from PaArtifactStore's much
     *  larger (4,000-char) threshold for a whole tool payload. */
    DIGEST_CHARS: 200,

    /** LLD §D5's default. Overridable per call. */
    DEFAULT_MAX_AGE_HOURS: 24,

    /** "past 10 entries" (Task 5 brief) — summarize once the transcript
     *  exceeds this length, keeping the newest KEEP_RECENT verbatim. */
    SUMMARIZE_THRESHOLD: 10,
    KEEP_RECENT: 5,

    ACTORS: ['llm', 'tool', 'system'],

    /** close() legality — the ONLY transitions this class permits. */
    LEGAL_CLOSE_SOURCES: ['queued', 'running'],
    LEGAL_CLOSE_TARGETS: ['complete', 'failed'],

    /** The exact R-20 citation the §D5 sweep appends — single-sourced so the
     *  transcript entry and this file's own header never drift apart. */
    STALE_CLOSE_NOTE: 'stale-closed by lifecycle sweep; completeness remains audit-derived (R-20)',

    /**
     * @param {Object} [options] {runTable, auditTable, runAnchor, llmProxy,
     *        toolRegistry, now, maxAgeHours} — injection points for tests and
     *        for callers with a different budget. `now` is a zero-arg function
     *        returning a Date (or epoch ms, or anything `new Date(x)` accepts)
     *        — the clock seam the §D5 sweep's staleness math runs on.
     */
    initialize: function (options) {
        var o = options || {}
        if (o.runTable) this.RUN_TABLE = String(o.runTable)
        if (o.auditTable) this.AUDIT_TABLE = String(o.auditTable)
        if (o.maxAgeHours > 0) this.DEFAULT_MAX_AGE_HOURS = o.maxAgeHours

        this._runAnchor = o.runAnchor || null
        this._llmProxy = o.llmProxy || null
        this._toolRegistry = o.toolRegistry || null
        this._nowFn = typeof o.now === 'function' ? o.now : null

        this._seq = 0
    },

    // =======================================================================
    // createRun
    // =======================================================================

    /**
     * @param {Object} [params] {user, agent, executionRef, mode} — all
     *        optional (R-9). `user` is accepted for interface symmetry with
     *        the rest of this app's identity handling, but is NEVER forwarded
     *        as a write — `PaRunAnchor` stamps `user` from `gs.getUserID()`
     *        only, the same server-authoritative rule LLD §4.6 point 5 states
     *        for the native path, and a caller-supplied value here would be
     *        silently discarded by the anchor anyway.
     * @returns {Object} {run_id, number} | {run_id:null, degraded:<reason>}
     *          — a run whose status could not be forced to `queued` still
     *          returns its `run_id` (the row is real and usable) but carries
     *          a `note` saying so, rather than silently claiming `queued`
     *          for a row that may still read `running` (R-19b: the caller
     *          must never be handed a claim the row itself would contradict).
     */
    createRun: function (params) {
        var p = params && typeof params === 'object' ? params : {}

        var created = this._anchor().getOrCreate({
            harness: 'custom',
            mode: p.mode,
            executionRef: this._nonEmptyString(p.executionRef) ? p.executionRef : undefined,
            agentId: this._nonEmptyString(p.agent) ? p.agent : undefined,
            conversationId: this._freshRunToken(),
        })

        if (!created || !created.run_id) {
            return {
                run_id: null,
                number: '',
                degraded: created && created.degraded ? created.degraded : 'anchor_unavailable',
            }
        }

        var out = { run_id: created.run_id, number: created.number || '' }
        if (!this._forceStatus(created.run_id, 'queued')) {
            out.note =
                'The run record was created but its status could not be forced to queued — ' +
                'it may still read as running until the next successful write. The run_id is real ' +
                'and usable regardless.'
        }

        return out
    },

    // =======================================================================
    // appendTranscript
    // =======================================================================

    /**
     * @param {String} runId
     * @param {Object} [entry] {seq?, actor, tool?, args_digest?, result_digest?,
     *        artifact_id?, ts?} — every field optional (R-9); `actor` falls
     *        back to `'system'` when absent or unrecognised.
     * @returns {Object} {success:true, entry, count} | {success:false, error}
     */
    appendTranscript: function (runId, entry) {
        var rid = this._str(runId)
        if (!rid) return { success: false, error: 'run id is required' }

        var gr = this._getRun(rid)
        if (!gr) return { success: false, error: 'run not found: ' + rid }

        var list = this._parseTranscript(gr.getValue('transcript'))
        var normalized = this._normalizeEntry(entry, list.length)
        list.push(normalized)

        if (!this._writeUpdate(gr, { transcript: JSON.stringify(list) })) {
            return { success: false, error: 'transcript write failed' }
        }

        return { success: true, entry: normalized, count: list.length }
    },

    _normalizeEntry: function (entry, priorCount) {
        var e = this._isPlainObject(entry) ? entry : {}
        var out = {
            seq: typeof e.seq === 'number' && e.seq > 0 ? e.seq : priorCount + 1,
            actor: this._indexOf(this.ACTORS, e.actor) !== -1 ? e.actor : 'system',
            ts: this._nonEmptyString(e.ts) ? e.ts : this._nowString(),
        }
        if (this._nonEmptyString(e.tool)) out.tool = e.tool
        // Digested defensively — see the file header's DIGEST_CHARS note. A
        // caller that already digested its own text is a no-op here; one that
        // hands over a raw args/result string or object still lands within
        // the 200-char ceiling this table's polling UI is sized around.
        if (e.args_digest !== undefined && e.args_digest !== null) out.args_digest = this._digest(e.args_digest)
        if (e.result_digest !== undefined && e.result_digest !== null) out.result_digest = this._digest(e.result_digest)
        if (this._nonEmptyString(e.artifact_id)) out.artifact_id = e.artifact_id
        return out
    },

    // =======================================================================
    // loadContext / maybeSummarize
    // =======================================================================

    /** @returns {Object} {transcript:[...], context_summary:String} */
    loadContext: function (runId) {
        var rid = this._str(runId)
        var gr = rid ? this._getRun(rid) : null
        if (!gr) return { transcript: [], context_summary: '' }

        return {
            transcript: this._parseTranscript(gr.getValue('transcript')),
            context_summary: gr.getValue('context_summary') || '',
        }
    },

    /**
     * Compresses everything but the newest KEEP_RECENT entries into
     * `context_summary` once the transcript passes SUMMARIZE_THRESHOLD.
     * Summarization is an optimisation on the context budget, not a
     * correctness requirement — a failed `summarize()` call leaves the
     * transcript untouched and does NOT fail the run; it is reported back as
     * a note for the caller to log if it wants to.
     *
     * @returns {Object} {summarized:true, summarized_count, kept_count}
     *                  | {summarized:false, reason}
     */
    maybeSummarize: function (runId) {
        var rid = this._str(runId)
        if (!rid) return { summarized: false, reason: 'run id is required' }

        var ctx = this.loadContext(rid)
        var entries = ctx.transcript || []

        if (entries.length <= this.SUMMARIZE_THRESHOLD) {
            return { summarized: false, reason: 'below threshold' }
        }

        var keep = this.KEEP_RECENT
        var older = entries.slice(0, entries.length - keep)
        var recent = entries.slice(entries.length - keep)

        var prompt = this._buildSummaryPrompt(ctx.context_summary, older)
        var llmResult = this._llm().summarize(prompt)

        if (!llmResult || llmResult.success !== true) {
            return {
                summarized: false,
                reason: 'summarize failed: ' + (llmResult && llmResult.error ? llmResult.error : 'unknown'),
            }
        }

        var gr = this._getRun(rid)
        if (!gr) return { summarized: false, reason: 'run not found: ' + rid }

        var wrote = this._writeUpdate(gr, {
            context_summary: llmResult.text,
            transcript: JSON.stringify(recent),
        })
        if (!wrote) return { summarized: false, reason: 'update failed' }

        return { summarized: true, summarized_count: older.length, kept_count: recent.length }
    },

    /**
     * Every summarized entry's `artifact_id` — where it carries one — is
     * embedded VERBATIM in the prompt text, never re-digested or dropped.
     * Compressing the prose around a piece of evidence must not compress the
     * pointer TO that evidence; ADR Layer 6 is explicit that artifact refs
     * have to survive summarization or paged evidence becomes unreachable
     * once its describing transcript entries age out.
     */
    _buildSummaryPrompt: function (priorSummary, entries) {
        var lines = []
        if (this._nonEmptyString(priorSummary)) {
            lines.push('Existing summary of earlier context:')
            lines.push(priorSummary)
            lines.push('')
        }
        lines.push(
            'Summarize the following diagnostic transcript entries into a compact narrative. ' +
                'Preserve every artifact_id verbatim so paged evidence can still be retrieved after summarization.'
        )
        lines.push('')

        for (var i = 0; i < entries.length; i++) {
            var e = this._isPlainObject(entries[i]) ? entries[i] : {}
            var seq = e.seq !== undefined && e.seq !== null ? e.seq : i + 1
            var actor = this._str(e.actor)
            var label = e.tool ? actor + ':' + this._str(e.tool) : actor
            var line = '#' + seq + ' [' + label + ']'
            if (e.args_digest !== undefined) line += ' args=' + this._str(e.args_digest)
            if (e.result_digest !== undefined) line += ' result=' + this._str(e.result_digest)
            if (this._nonEmptyString(e.artifact_id)) line += ' artifact_id=' + e.artifact_id
            lines.push(line)
        }

        return lines.join('\n')
    },

    // =======================================================================
    // close
    // =======================================================================

    /**
     * @param {String} runId
     * @param {String} status target status — must be 'complete' or 'failed'
     * @param {Object} [options] {fixReport?, error?}
     * @returns {Object} {success:true, run_id, status} | {success:false, error}
     *          — an illegal transition NAMES the transition and returns,
     *          never throws (R-19b: the caller must never see a status that
     *          contradicts what actually happened to the row).
     */
    close: function (runId, status, options) {
        var o = options || {}
        var rid = this._str(runId)
        var target = this._str(status)

        if (!rid) return { success: false, error: 'run id is required' }

        var gr = this._getRun(rid)
        if (!gr) return { success: false, error: 'run not found: ' + rid }

        var current = gr.getValue('status')
        var legal =
            this._indexOf(this.LEGAL_CLOSE_SOURCES, current) !== -1 &&
            this._indexOf(this.LEGAL_CLOSE_TARGETS, target) !== -1

        if (!legal) {
            return {
                success: false,
                error: 'illegal transition: ' + (current || '(empty)') + ' -> ' + (target || '(empty)'),
            }
        }

        var fields = { status: target }
        if (o.fixReport !== undefined && o.fixReport !== null) fields.fix_report = this._stringify(o.fixReport)
        if (this._nonEmptyString(o.error)) fields.error = this._str(o.error)

        if (!this._writeUpdate(gr, fields)) {
            return { success: false, error: 'update failed' }
        }

        return { success: true, run_id: rid, status: target }
    },

    // =======================================================================
    // collectBundle — the Evidence Bundle, NO LLM in the call path
    // =======================================================================

    /**
     * Runs the five layer-bearing tool cores through PaToolRegistry, with NO
     * PaLlmProxy call anywhere in this method — the Evidence Bundle is the
     * floor every diagnosis stands on even when the LLM layer is unavailable
     * (`/status` advises it, LLD §4.8), so it must work with no proxy in the
     * object graph at all, not merely "usually" avoid calling it.
     *
     * @param {String} runId
     * @returns {Object} {success:true, data:{layers:{'1':{...}, ..., '7':{...}}}}
     */
    collectBundle: function (runId) {
        var rid = this._str(runId)
        var ctx = this._readRunContext(rid)

        var args = {}
        if (ctx.execution_ref) args.execution = ctx.execution_ref
        if (ctx.agent) args.agent = ctx.agent

        var registry = this._registry()
        var tools = this._collectionTools()
        var layers = {}

        for (var i = 0; i < tools.length; i++) {
            var t = tools[i]
            var result = registry.dispatch(t.name, args, { run_id: rid })
            var status = this._layerStatus(result)

            for (var j = 0; j < t.layers.length; j++) {
                var ldef = t.layers[j]
                layers[ldef.number] = {
                    name: ldef.name,
                    tool: t.name,
                    status: status,
                    data: this._pickLayerData(result, ldef.pick),
                }
            }
        }

        return { success: true, data: { layers: layers } }
    },

    /**
     * The seven-layer map, LLD §4.1–§4.3 / PaFixReport's `_layerDefs` —
     * PaToolAgentConfig alone answers three of the seven (layers 2, 3, 7)
     * from its `{overview, instructions, tools, triggers}` sections, so it is
     * dispatched ONCE and its result is fanned out across three layer
     * entries rather than dispatched three times.
     */
    _collectionTools: function () {
        return [
            {
                name: 'agent_trace',
                layers: [
                    {
                        number: 1,
                        name: 'Execution trace',
                        pick: function (data) {
                            return data
                        },
                    },
                ],
            },
            {
                name: 'agent_config',
                layers: [
                    {
                        number: 2,
                        name: 'Instructions',
                        pick: function (data) {
                            return data && data.instructions
                        },
                    },
                    {
                        number: 3,
                        name: 'Tool definitions',
                        pick: function (data) {
                            return data && data.tools
                        },
                    },
                    {
                        number: 7,
                        name: 'Trigger and wiring',
                        pick: function (data) {
                            return data && data.triggers
                        },
                    },
                ],
            },
            {
                name: 'schema_lookup',
                layers: [
                    {
                        number: 4,
                        name: 'Data schemas',
                        pick: function (data) {
                            return data
                        },
                    },
                ],
            },
            {
                name: 'query_table',
                layers: [
                    {
                        number: 5,
                        name: 'Data',
                        pick: function (data) {
                            return data
                        },
                    },
                ],
            },
            {
                name: 'genai_log',
                layers: [
                    {
                        number: 6,
                        name: 'GenAI stack',
                        pick: function (data) {
                            return data
                        },
                    },
                ],
            },
        ]
    },

    /**
     * R-11: a DENIED read inside the tool's own `data.reads` block is
     * reported as DENIED on the layer, never silently folded into 'ok'
     * because the overall dispatch nominally succeeded, and never collapsed
     * into a bare failure that loses WHICH permission gap caused it.
     */
    _layerStatus: function (result) {
        if (!result || result.success === false) return 'error'

        var reads = result.data && result.data.reads
        if (reads && typeof reads === 'object') {
            for (var table in reads) {
                if (Object.prototype.hasOwnProperty.call(reads, table) && reads[table] === 'DENIED') {
                    return 'DENIED'
                }
            }
        }

        return 'ok'
    },

    /**
     * R-11, extended (review fix round, issue #64/#65 — live-caught on
     * gpinst01 Task 7 Step 4): a TRUNCATED dispatch result
     * (`PaToolRegistry.dispatch` via `PaArtifactStore.applyThreshold`) has NO
     * `.data` key at all — it is `{success, truncated:true, tool,
     * total_length, artifact_id, page_size, pages, excerpt, note}`. Handing
     * `result.data` (`undefined`) to a layer's `pick()` silently reports the
     * layer as `null` — indistinguishable from "genuinely nothing here" even
     * though the real content exists, paged, behind `artifact_id`. That is a
     * truncated read reported as an absence, exactly what R-11 forbids for a
     * DENIED read; the same standard applies here. `pick()` is only
     * meaningful against an UNtruncated `.data` shape (it reaches INTO the
     * tool's own result, e.g. `data.instructions`), so it is skipped
     * entirely when truncated — the truncated envelope IS the layer's
     * honest content in that case, and a consumer pages the rest via
     * `read_artifact`. The agent_config fan-out (layers 2/3/7 share one
     * dispatch) hands the SAME envelope reference to all three layers when
     * agent_config truncates — each still carries its own `name`/`tool` so
     * a consumer can tell which of the three it is looking at while knowing
     * they all page through the one artifact.
     *
     * @returns {*} the truncated envelope subset, or `pick(result.data)`
     */
    _pickLayerData: function (result, pick) {
        if (result && result.truncated === true) {
            return {
                truncated: true,
                artifact_id: result.artifact_id,
                excerpt: result.excerpt,
                total_length: result.total_length,
                page_size: result.page_size,
                pages: result.pages,
            }
        }
        return pick(result && result.data)
    },

    _readRunContext: function (runId) {
        var out = { execution_ref: '', agent: '' }
        var gr = runId ? this._getRun(runId) : null
        if (!gr) return out

        out.execution_ref = gr.getValue('execution_ref') || ''
        out.agent = gr.getValue('agent') || ''
        return out
    },

    // =======================================================================
    // sweepStaleNative — the §D5 close-out
    // =======================================================================

    /**
     * Closes NATIVE runs (`harness:'native'`) that are BOTH older than
     * `maxAgeHours` AND have no `x_snc_troubleshoot_audit` row inside that
     * same window — evidence of abandonment, not evidence of completion (see
     * the file header). `status:'running'` is the only status considered, so
     * `awaiting_confirmation` runs are excluded by construction and never
     * expire, matching the brief.
     *
     * @param {Object} [options] {maxAgeHours} default DEFAULT_MAX_AGE_HOURS
     * @returns {Object} {closed:[run_id, ...]}
     */
    sweepStaleNative: function (options) {
        var o = options || {}
        var maxAgeHours = o.maxAgeHours > 0 ? o.maxAgeHours : this.DEFAULT_MAX_AGE_HOURS
        var closed = []

        if (typeof GlideRecord === 'undefined') return { closed: closed }

        var cutoff = this._cutoffString(maxAgeHours)

        try {
            var gr = new GlideRecord(this.RUN_TABLE)
            gr.addQuery('harness', 'native')
            gr.addQuery('status', 'running')
            gr.query()

            while (gr.next()) {
                var runId = gr.getValue('sys_id')
                var createdOn = gr.getValue('sys_created_on')

                // Not old enough yet — leave it running.
                if (createdOn && createdOn >= cutoff) continue
                // Recent tool activity — the diagnosis is still in progress
                // even though the anchor itself is old.
                if (this._hasRecentAudit(runId, cutoff)) continue

                if (this._closeStale(runId)) closed.push(runId)
            }
        } catch (e) {
            // R-1: `e` untouched. A failed sweep pass closes nothing rather
            // than guessing.
        }

        return { closed: closed }
    },

    _hasRecentAudit: function (runId, cutoff) {
        try {
            var gr = new GlideRecord(this.AUDIT_TABLE)
            gr.addQuery('run', runId)
            gr.query()
            while (gr.next()) {
                var createdOn = gr.getValue('sys_created_on')
                if (createdOn && createdOn >= cutoff) return true
            }
            return false
        } catch (e) {
            // R-1: cannot tell whether the run is active — the SAFER
            // direction is to assume it might be, and leave it running
            // rather than closing a diagnosis that is genuinely in progress.
            return true
        }
    },

    /**
     * Closes via the SAME guarded transition `close()` uses everywhere else
     * — no second code path that could drift from the ordinary close
     * semantics — and appends the R-20 citation ONLY once that close
     * actually succeeded.
     *
     * ORDER IS LOAD-BEARING (R-19b, fixed in review). This used to append
     * the note FIRST, unconditionally, then attempt the close. If `close()`
     * refused — the row concurrently moved to `awaiting_confirmation`, or
     * the status write failed for a reason unrelated to the transcript
     * write — the transcript still carried "stale-closed by lifecycle
     * sweep" while the row's actual status was never touched: a status
     * that contradicts its own notes, which is exactly what R-19b forbids.
     * Closing first and gating the note on `result.success` means the note
     * can never be written unless the claim it makes is true.
     */
    _closeStale: function (runId) {
        var result = this.close(runId, 'complete', {})
        if (!result || result.success !== true) return false

        this.appendTranscript(runId, { actor: 'system', result_digest: this.STALE_CLOSE_NOTE })
        return true
    },

    _cutoffString: function (hours) {
        var nowMs
        if (this._nowFn) {
            var n = this._nowFn()
            if (n instanceof Date) nowMs = n.getTime()
            else if (typeof n === 'number') nowMs = n
            else nowMs = new Date(n).getTime()
        } else {
            nowMs = new Date().getTime()
        }
        var cutoffMs = nowMs - hours * 3600000
        return this._formatDateTime(new Date(cutoffMs))
    },

    /** 'YYYY-MM-DD HH:MM:SS' — the same lexically-sortable form
     *  `sys_created_on` is stored and compared in elsewhere in this app. */
    _formatDateTime: function (d) {
        function pad(n) {
            return n < 10 ? '0' + n : String(n)
        }
        return (
            d.getUTCFullYear() +
            '-' +
            pad(d.getUTCMonth() + 1) +
            '-' +
            pad(d.getUTCDate()) +
            ' ' +
            pad(d.getUTCHours()) +
            ':' +
            pad(d.getUTCMinutes()) +
            ':' +
            pad(d.getUTCSeconds())
        )
    },

    // =======================================================================
    // Collaborators — lazily resolved so tests can inject
    // =======================================================================

    _anchor: function () {
        return this._runAnchor || new PaRunAnchor()
    },

    _llm: function () {
        return this._llmProxy || new PaLlmProxy()
    },

    _registry: function () {
        return this._toolRegistry || new PaToolRegistry()
    },

    // =======================================================================
    // Glide internals
    // =======================================================================

    /** @returns {GlideRecord|null} positioned on `runId`, or null if unusable. */
    _getRun: function (runId) {
        if (typeof GlideRecord === 'undefined') return null
        try {
            var gr = new GlideRecord(this.RUN_TABLE)
            if (!gr.get(String(runId))) return null
            return gr
        } catch (e) {
            // R-1: `e` untouched.
            return null
        }
    },

    /** setValue for every key in `fields`, then update(). @returns {Boolean} */
    _writeUpdate: function (gr, fields) {
        try {
            for (var k in fields) {
                if (Object.prototype.hasOwnProperty.call(fields, k)) gr.setValue(k, fields[k])
            }
            var result = gr.update()
            return !!result
        } catch (e) {
            // R-1: `e` untouched.
            return false
        }
    },

    /** Forces a fresh row's status right after creation — see the file
     *  header's note on why this is a direct write, not an anchor param. */
    _forceStatus: function (runId, status) {
        var gr = this._getRun(runId)
        if (!gr) return false
        return this._writeUpdate(gr, { status: status })
    },

    // =======================================================================
    // Small helpers (ES5 / Rhino only)
    // =======================================================================

    _freshRunToken: function () {
        this._seq += 1
        var ms
        try {
            ms = new Date().getTime()
        } catch (e) {
            ms = 0
        }
        return 'custom-' + this._seq + '-' + ms + '-' + Math.floor(Math.random() * 1000000000)
    },

    _nowString: function () {
        try {
            if (typeof GlideDateTime !== 'undefined') return new GlideDateTime().toString()
        } catch (e) {
            // R-1: `e` untouched — fall through to the plain-JS clock.
        }
        try {
            return new Date().toISOString()
        } catch (e2) {
            // R-1: `e2` untouched.
            return ''
        }
    },

    _parseTranscript: function (raw) {
        if (!raw) return []
        try {
            var parsed = JSON.parse(raw)
            return this._isArray(parsed) ? parsed : []
        } catch (e) {
            // R-1: `e` untouched. A corrupted transcript reads as empty
            // rather than crashing every subsequent append.
            return []
        }
    },

    /** Head + "…more chars" marker, past DIGEST_CHARS — never silent. */
    _digest: function (value) {
        var s = this._stringifyForDigest(value)
        if (s.length <= this.DIGEST_CHARS) return s
        return s.substring(0, this.DIGEST_CHARS) + '...[+' + (s.length - this.DIGEST_CHARS) + ' more chars]'
    },

    _stringifyForDigest: function (value) {
        if (value === null || value === undefined) return ''
        if (typeof value === 'string') return value
        try {
            var json = JSON.stringify(value)
            return json === undefined ? String(value) : json
        } catch (e) {
            // R-1: `e` untouched. Circular structures land here.
            return String(value)
        }
    },

    _stringify: function (value) {
        if (typeof value === 'string') return value
        try {
            var json = JSON.stringify(value)
            return json === undefined ? String(value) : json
        } catch (e) {
            // R-1: `e` untouched.
            return String(value)
        }
    },

    _isPlainObject: function (value) {
        return value !== null && value !== undefined && typeof value === 'object' && !this._isArray(value)
    },

    _isArray: function (value) {
        return Object.prototype.toString.call(value) === '[object Array]'
    },

    _nonEmptyString: function (value) {
        return typeof value === 'string' && this._trim(value).length > 0
    },

    _trim: function (value) {
        return String(value).replace(/^\s+|\s+$/g, '')
    },

    _str: function (value) {
        if (value === null || value === undefined) return ''
        return String(value)
    },

    _indexOf: function (arr, value) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === value) return i
        }
        return -1
    },

    type: 'PaRunManager',
}
