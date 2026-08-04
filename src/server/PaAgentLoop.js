/**
 * PaAgentLoop — the custom harness's async ReAct worker (ADR Decision 0.5
 * Layer 3 "Orchestration"; Phase 1b Task 6,
 * docs/superpowers/plans/2026-08-02-phase1b-harness.md).
 *
 * WHAT THIS EXISTS FOR
 * Every other Phase 1b class is a passive collaborator: PaLlmProxy talks to
 * the model, PaToolRegistry dispatches a tool core, PaRunManager owns the
 * run row, PaFixReport checks a report's shape. Something has to actually
 * DRIVE them — reason, act, observe, repeat, until the model produces an
 * answer or a Fix Report, or a bound is hit. That is this class's entire
 * job. It is the Script Action entry point Task 7 wires an async platform
 * event to: `new PaAgentLoop().run(run_id, request_json)`.
 *
 * THE LOOP SHAPE
 *   run(runId, request):
 *     load the playbook + tool promptBlock (once)
 *     loop:
 *       BOUNDS CHECKED FIRST, before any reasoning happens this iteration —
 *       exceeding either one ends the run right here, never mid-reason
 *         iteration count  > MAX_ITERATIONS  -> partial
 *         elapsed wall time >= BUDGET_MS      -> partial
 *       _step(): load context, _buildPrompt(), PaLlmProxy.reason()
 *         reason() failure                    -> failed (never a silent stop)
 *         action:tool_call  -> PaToolRegistry.dispatch(), append the
 *                               observation (success OR error — an unknown
 *                               tool's dispatch error is fed back exactly
 *                               like any other observation, so the model
 *                               gets to re-plan), loop again
 *         action:answer     -> close complete, outcome:'answer'
 *         action:fix_report -> validate; invalid -> ONE repair through the
 *                               proxy; still invalid -> close failed with
 *                               the problems AND the last draft preserved;
 *                               valid -> RENDERED both ways
 *                               (PaFixReport.renderJson/renderMarkdown —
 *                               see `_completeFixReport`), stored, close
 *                               complete
 *
 * BOUNDS ARE A FLOOR, NEVER A SILENT STOP (the R-3 lesson)
 * DESIGN.md's R-3 finding was that a premature "the diagnosis is done"
 * conclusion is indistinguishable from a genuine one unless something says
 * otherwise. Hitting MAX_ITERATIONS or BUDGET_MS is exactly that shape —
 * the run did not finish reasoning, but from the outside a `status:complete`
 * row looks identical to one that did. So a bound-triggered stop (a)
 * reports `outcome:'partial'`, distinct from `'answer'`/`'fix_report'`, and
 * (b) writes an explicit `system` transcript entry containing the literal
 * word INCOMPLETE, naming which bound tripped — never just a quiet return.
 * The run row itself still closes `complete` (the RUN finished — a worker
 * that ran to a bound and stopped cleanly, as designed — it is the
 * DIAGNOSIS that is incomplete; R-19b requires the two claims not to be
 * confused with each other, which is exactly why they are reported through
 * two different fields: `close()`'s status vs. `run()`'s `outcome`).
 *
 * `_buildPrompt(playbook, promptBlock, context, request)` TAKES PLAYBOOK AS
 * AN ARGUMENT, NOT A HARDCODED STRING
 * The playbook is `docs/agent/agent-doctor-instructions.md` — the SAME text
 * the native Agent Doctor AiAgent carries (see `src/fluent/agent-doctor.now.ts`
 * and `test/agentDoctorInstructions.test.js`'s byte-for-byte guard against
 * that Fluent copy). A THIRD hand-typed copy in this file would be exactly
 * the drift risk that guard exists to prevent, so this class never embeds
 * the playbook text itself: `run()` resolves it ONCE via `_loadPlaybook()`
 * (an injectable seam; the runtime default reads `sn_aia_agent.instructions`
 * off the installed agent record, the same single source of truth the
 * Fluent copy was built from, degrading to a short built-in fallback rather
 * than throwing if that read fails) and threads the resulting string through
 * every `_buildPrompt()` call as a plain parameter. Tests always inject a
 * literal string and never touch Glide.
 *
 * PROMPT ASSEMBLY IS SINGLE-SOURCED FROM PaToolRegistry.promptBlock()
 * `promptBlock()` is ~8-9KB of verbatim tool descriptions, resent on every
 * reasoning call by design (per its own header). This class calls it once
 * per run and threads the RESULT through every iteration's prompt — it never
 * re-describes a tool, trims a description, or duplicates any of that text
 * itself. If the tools section needs to change, PaToolRegistry is the only
 * place to change it.
 *
 * THE `awaiting_confirmation` BRANCH (Phase 3) — A COMMENT, NOT CODE
 * ADR Decision 0.5's "Confirmation flow (Phase 3 writes)" describes a loop
 * that, on a DESTRUCTIVE tool_call, pauses instead of dispatching: it stores
 * the pending action on the run, sets `status:'awaiting_confirmation'`
 * (which — per the same ADR section and DECISION.md — never expires and is
 * excluded from PaRunManager.sweepStaleNative by construction), and waits
 * for a human response before resuming. Phase 1b never needs that branch:
 * PaToolRegistry.dispatch fails CLOSED on every tool that is not EXPLICITLY
 * registered `destructive:false` (see that file's header), and every Phase 1
 * tool is read-only — so no tool_call this loop can ever receive is capable
 * of reaching a confirmation gate. The branch is documented here, in this
 * comment, exactly where Phase 3 will need to add it (inside `_step()`,
 * where `action.action === 'tool_call'` is handled below) — not written as
 * dead code that would either silently rot or need a fake destructive tool
 * to exercise. See `test/PaAgentLoop.test.js`'s guard: the literal string
 * `awaiting_confirmation` must appear in a comment, and must NOT appear
 * anywhere in this file's executable code.
 *
 * STANDING RULES THIS FILE IS BUILT AROUND
 * R-1  Never touch the exception object in a catch. The only catches here
 *      guard the default playbook read and the plain-JS clock fallback.
 * R-9  Every input may be absent — `runId`, `request`, a malformed action
 *      shape from the proxy, all degrade explicitly rather than throwing.
 * R-19b A status must never contradict the notes sitting next to it — see
 *      BOUNDS ARE A FLOOR above for how `close()`'s status and `run()`'s
 *      `outcome` stay two separate, non-contradicting claims.
 *
 * This class touches Glide ONLY inside `_defaultPlaybook()` (best-effort,
 * degrades cleanly) and `_now()`'s Rhino branch — every other method is
 * plain ES5 object/string logic exercised with zero Glide in the tests.
 */
var PaAgentLoop = Class.create()

PaAgentLoop.prototype = {
    /** Checked BEFORE each iteration begins reasoning — see BOUNDS ARE A
     *  FLOOR above. Overridable per instance for tests; the brief's numbers
     *  are the production defaults. */
    MAX_ITERATIONS: 15,
    BUDGET_MS: 300000,

    /** The installed native agent this class reads its default playbook
     *  from — see `_defaultPlaybook()`. */
    AGENT_NAME: 'Agent Doctor',

    /** Used only when no `playbook` seam is injected AND the runtime read
     *  of `sn_aia_agent.instructions` fails or finds nothing — a thin
     *  fallback so the loop can still reason, never a throw. */
    _FALLBACK_PLAYBOOK:
        'You are a ServiceNow AI Agent diagnostic assistant. Diagnose the failing execution named ' +
        'in the request below. Sweep the seven diagnostic layers (execution trace, instructions, ' +
        'tool definitions, data schemas, data, GenAI stack, trigger and wiring) using the tools ' +
        'available to you, cite evidence for every root cause, and end with a Fix Report.',

    /**
     * @param {Object} [options] {llmProxy, toolRegistry, runManager,
     *        fixReport, auditLogger, now, playbook, maxIterations,
     *        budgetMs} — every
     *        collaborator is an injection point; tests inject all of them
     *        and touch no Glide API. `now` is a zero-arg clock function —
     *        the Rhino default is `new GlideDateTime().getNumericValue()`
     *        (see `_now()`); Jest injects a fake. `playbook`, when a
     *        string, is used verbatim and `_defaultPlaybook()` is never
     *        consulted.
     */
    initialize: function (options) {
        var o = options || {}
        this._llmProxy = o.llmProxy || null
        this._toolRegistry = o.toolRegistry || null
        this._runManager = o.runManager || null
        this._fixReport = o.fixReport || null
        this._auditLogger = o.auditLogger || null
        this._nowFn = typeof o.now === 'function' ? o.now : null
        this._playbook = typeof o.playbook === 'string' ? o.playbook : null

        // Depth gate state (issue #103). A run is one synchronous
        // invocation, so instance fields are sufficient — no column, no
        // schema change. `_heldTools` is the union of tools that close the
        // gaps recorded at the FIRST hold; it is the only thing that can
        // release the gate afterwards.
        this._gateReleased = false
        this._heldGaps = null
        this._heldTools = null

        if (o.maxIterations > 0) this.MAX_ITERATIONS = o.maxIterations
        if (o.budgetMs > 0) this.BUDGET_MS = o.budgetMs
    },

    // =======================================================================
    // run — the Script Action entry point
    // =======================================================================

    /**
     * @param {String} runId an existing run row (PaRunManager.createRun
     *        already created it — this method never creates one).
     * @param {Object|String} [request] the diagnostic target — an object
     *        `{execution?, agent?, timeframe?, logs?, mode?}`, or a JSON
     *        string of the same (Task 7's `gs.eventQueue` parm2), or a
     *        free-form string. All optional (R-9).
     * @returns {Object} {success, outcome:'answer'|'fix_report'|'partial'|'failed', ...}
     *          — the shape carries outcome-specific extra fields (`text`,
     *          `report`, `error`, `problems`, `draft`, `reason`) on top of
     *          the common `success`/`outcome`/`run_id`.
     */
    run: function (runId, request) {
        var rid = this._str(runId)
        if (!rid) {
            return { success: false, outcome: 'failed', error: 'run id is required' }
        }

        var req = this._normRequest(request)
        var playbook = this._loadPlaybook()
        var promptBlock = this._safePromptBlock()
        var startMs = this._now()

        var iteration = 0
        while (true) {
            iteration += 1

            // BOUNDS FIRST — see the file header's BOUNDS ARE A FLOOR note.
            // Neither check ever fires mid-reasoning; both fire only before
            // the next iteration would otherwise begin.
            if (iteration > this.MAX_ITERATIONS) {
                return this._finishPartial(rid, 'reached the maximum of ' + this.MAX_ITERATIONS + ' reasoning iterations')
            }
            if (this._now() - startMs >= this.BUDGET_MS) {
                return this._finishPartial(rid, 'exceeded the ' + this.BUDGET_MS + 'ms diagnosis time budget')
            }

            var stepResult = this._step(rid, playbook, promptBlock, req)
            if (stepResult.terminal) return stepResult.outcome
            // else: a non-terminal tool_call was dispatched and observed —
            // loop again with the enlarged transcript.
        }
    },

    // =======================================================================
    // _step — one reason/act/observe cycle
    // =======================================================================

    /**
     * @returns {Object} {terminal:false} to keep looping, or
     *          {terminal:true, outcome:<the run() return value>} to stop.
     */
    _step: function (runId, playbook, promptBlock, request) {
        var context = this._runs().loadContext(runId)
        var prompt = this._buildPrompt(playbook, promptBlock, context, request)

        var reasoned = this._llm().reason(prompt)
        if (!reasoned || reasoned.success !== true) {
            return { terminal: true, outcome: this._finishFailedLlm(runId, reasoned) }
        }

        this._runs().appendTranscript(runId, { actor: 'llm', result_digest: this._toText(reasoned.raw) })

        var action = this._isPlainObject(reasoned.action) ? reasoned.action : {}

        if (action.action === 'tool_call') {
            // ---------------------------------------------------------------
            // Phase 3 (NOT implemented here): a DESTRUCTIVE tool_call would
            // be gated right here, before dispatch — pause the run, persist
            // the pending action, set status:'awaiting_confirmation' (never
            // expires, excluded from PaRunManager.sweepStaleNative by
            // construction) and return without closing, per ADR Decision 0.5
            // "Confirmation flow (Phase 3 writes)". Not reachable in Phase
            // 1b: PaToolRegistry.dispatch fails CLOSED on every tool not
            // EXPLICITLY registered destructive:false, and every Phase 1
            // tool is read-only. See the file header for the full rationale.
            // ---------------------------------------------------------------
            this._dispatchTool(runId, action)
            return { terminal: false }
        }

        if (action.action === 'answer') {
            return { terminal: true, outcome: this._finishAnswer(runId, action.text) }
        }

        if (action.action === 'fix_report') {
            return { terminal: true, outcome: this._handleFixReport(runId, action.report) }
        }

        // Unreachable in practice — PaLlmProxy._parseResponse rejects any
        // action outside these three before reason() ever returns
        // success:true — but degrade rather than crash if it ever happens
        // (R-9): treat it as an empty observation and let the model re-plan.
        return { terminal: false }
    },

    _dispatchTool: function (runId, action) {
        var toolName = this._str(action.tool)
        var args = action.args
        var result = this._tools().dispatch(toolName, args, { run_id: runId })

        this._runs().appendTranscript(runId, {
            actor: 'tool',
            tool: toolName,
            args_digest: this._toText(args),
            result_digest: this._toText(result),
        })

        return result
    },

    // =======================================================================
    // Terminal outcomes
    // =======================================================================

    _finishAnswer: function (runId, text) {
        this._runs().appendTranscript(runId, { actor: 'system', result_digest: 'answer: ' + this._str(text) })
        var closeRes = this._runs().close(runId, 'complete', {})
        return {
            success: !!(closeRes && closeRes.success === true),
            outcome: 'answer',
            text: this._str(text),
            run_id: runId,
        }
    },

    /**
     * Validate; on failure, exactly ONE repair turn through PaLlmProxy
     * (PaFixReport.validate has no retry logic of its own — that policy is
     * enforced here, the caller, mirroring PaLlmProxy's own one-retry
     * philosophy at the parse layer). Whatever the repair produces —
     * valid, invalid, not even another fix_report, or an LLM failure — is
     * final; there is no second repair attempt.
     */
    _handleFixReport: function (runId, report) {
        var context = this._auditContext(runId)

        var validated = this._reports().validate(report, context)
        if (validated.valid) {
            return this._completeFixReport(runId, validated.normalized)
        }

        var repairPrompt = this._reports().repairPrompt(report, validated.problems)
        var repaired = this._llm().reason(repairPrompt)

        this._runs().appendTranscript(runId, {
            actor: 'llm',
            result_digest: this._toText(repaired && repaired.raw),
        })

        if (!repaired || repaired.success !== true) {
            return this._finishFailedFixReport(runId, validated.problems, report)
        }

        var repairedAction = this._isPlainObject(repaired.action) ? repaired.action : {}
        if (repairedAction.action !== 'fix_report') {
            // The repair turn did not come back with another fix_report —
            // the original draft and problems are the best evidence we have.
            return this._finishFailedFixReport(runId, validated.problems, report)
        }

        var validated2 = this._reports().validate(repairedAction.report, context)
        if (validated2.valid) {
            return this._completeFixReport(runId, validated2.normalized)
        }

        return this._finishFailedFixReport(runId, validated2.problems, repairedAction.report)
    },

    /**
     * Resolve the run's audit trail ONCE per fix-report handling and reuse the
     * SAME object across the repair turn — a repair turn makes no tool calls,
     * so a second query would return the same set at twice the cost.
     *
     * A degraded trail is RECORDED, not swallowed. #79's whole point is that a
     * passing Fix Report should carry an evidential guarantee; a cross-check
     * that silently skipped would leave that guarantee unfalsifiable, which is
     * the same defect one layer down. The transcript note is what lets a later
     * audit tell "citations verified" from "citations unverified".
     *
     * Total by construction: a broken audit logger degrades the CHECK, never
     * the diagnosis. Same reasoning as PaAuditLogger's own write path — a
     * diagnosis that fails because its audit query threw is strictly worse
     * than a diagnosis with an unverified citation.
     */
    _auditContext: function (runId) {
        var res = null
        try {
            res = this._audits().invokedTools(runId)
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            res = null
        }

        var available = !!(res && res.available === true)
        if (!available) {
            this._runs().appendTranscript(runId, {
                actor: 'system',
                result_digest:
                    'audit trail unavailable (' +
                    this._str(res && res.degraded ? res.degraded : 'query_failed') +
                    ') — citation and sweep cross-checks SKIPPED for this report',
            })
        }

        return {
            auditAvailable: available,
            invokedTools: res && this._isArray(res.tools) ? res.tools : [],
        }
    },

    /**
     * The depth gate's read of the audit trail (issue #103).
     *
     * WHY THIS IS NOT `_auditContext`
     * `PaAuditLogger.invokedTools()` collapses FOUR situations into
     * `available:false`, and one of them is not a degradation at all:
     * `no_audit_rows` means the query ran fine and the answer is "this run
     * has invoked nothing." For #79b's citation cross-check that distinction
     * does not matter — an unverifiable citation and an unsupported one are
     * both "do not convict." For the gate it is the whole ballgame: a run
     * that has invoked nothing is the STRONGEST possible gap, and treating
     * it as a degradation would fail open and let the zero-tool-call
     * inconclusive exit — advertised in the first prompt, per DECISION.md
     * §H7-2, and taken by five of ten runs in the §H5 pass — bypass the gate
     * entirely.
     *
     * Genuine degradations still fail OPEN, per PaAuditLogger's own header
     * ("fails toward NOT checking, never toward a false convict"). A Glide
     * hiccup must never trap a run in a hold it cannot escape.
     *
     * @param {String} runId
     * @returns {Object} {readable:Boolean, tools:[String], degraded:String}
     */
    _trailTools: function (runId) {
        var res = null
        try {
            res = this._audits().invokedTools(runId)
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            return { readable: false, tools: [], degraded: 'query_failed' }
        }

        if (res && res.available === true) {
            return {
                readable: true,
                tools: this._isArray(res.tools) ? res.tools : [],
                degraded: '',
            }
        }

        var reason = this._str(res && res.degraded ? res.degraded : 'query_failed')
        if (reason === 'no_audit_rows') {
            return { readable: true, tools: [], degraded: reason }
        }
        return { readable: false, tools: [], degraded: reason }
    },

    /**
     * THE DEPTH GATE (issue #103) — the floor `run()`'s bounds are not.
     *
     * DECISION.md §O4: the custom harness swept 1/7 on all 20 rows of the v4
     * pass, and §H8's acceptance test is unmet across 45 runs. The v4 master
     * table's reframing number is not "1 tool call" but "2 LLM calls" — turn
     * 1 fetches, turn 2 concludes — so the single decision point after
     * evidence exists is taken inside the same generation that first reads
     * it. The model is not cutting an investigation short; it never begins
     * one. Nothing in this loop ever said the diagnosis was unfinished.
     *
     * WHAT RELEASES IT, AND WHY THAT AND NOTHING ELSE
     * #88 raised the COST of stopping and got fabrication, because a stop
     * priced in text is paid in text. So the gate is discharged only by
     * something the model cannot author: a row in the audit trail. And it is
     * enforced HERE, in the loop, where "not yet" can still mean "loop
     * again" — not in `PaFixReport.validate`, which fires after the run is
     * over and which #81 records the repair turn cannot act on.
     *
     * The target is the model's OWN: a layer it marked `NOT_SWEPT` is it
     * declaring a gap in its own words, and `_layerToolMap()` says which
     * tools close it. The harness never names a tool (see `_holdBlock`).
     *
     * STICKY, DELIBERATELY
     * The gap set is recorded at the FIRST hold and never re-derived. Without
     * that the goalposts move — close layer 4, declare layer 5, be held again
     * — and every run rides to `MAX_ITERATIONS`, since even native's best
     * sweep in the v4 pass was 6/7. The gate buys exactly ONE forced beat,
     * which is the size of the acceptance test. A run that then declines to
     * act rides the bounds to `outcome:'partial'`, and that tail is counted
     * rather than special-cased (issue #103, prediction P4).
     *
     * KNOWN TILT, ACCEPTED: `_layerToolMap()` gives `agent_config` three
     * layers (2, 3, 7) against one apiece for layers 4 and 5, so the cheapest
     * compliance is a single `agent_config` call — a built-in tilt AWAY from
     * the tools the acceptance test measures. Pre-registered as P7 on #103
     * rather than engineered around: if it happens the trail says so plainly,
     * and "the gate mandates depth but does not direct it" is a clean
     * finding that directs the next iteration.
     *
     * @param {String} runId
     * @param {Object} action the terminal action the model just emitted
     * @returns {Object} {hold:Boolean, gaps:Array, kind:'gaps'|'no_layer_report'}
     */
    _depthGate: function (runId, action) {
        if (this._gateReleased) return { hold: false, gaps: [], kind: '' }

        var trail = this._trailTools(runId)
        if (!trail.readable) return { hold: false, gaps: [], kind: '' }

        // Once a hold has been issued, the recorded set is the ONLY thing
        // that can release the gate — later drafts never move it.
        if (this._heldTools) {
            if (this._anyOf(this._heldTools, trail.tools)) {
                this._gateReleased = true
                return { hold: false, gaps: [], kind: '' }
            }
            return { hold: true, gaps: this._heldGaps, kind: 'gaps' }
        }

        if (!this._isPlainObject(action) || action.action !== 'fix_report') {
            // `answer` carries no `layers_swept`, so it declares no gap and
            // there is nothing to enforce against. Hold and ask for a layer
            // report; no run took this exit in the v4 pass.
            return { hold: true, gaps: [], kind: 'no_layer_report' }
        }

        var open = this._openGaps(this._safeGaps(action.report), trail.tools)
        if (open.length === 0) {
            this._gateReleased = true
            return { hold: false, gaps: [], kind: '' }
        }

        this._heldGaps = open
        this._heldTools = this._unionTools(open)
        return { hold: true, gaps: open, kind: 'gaps' }
    },

    /**
     * Gap derivation, guarded. Same reasoning as `_safeSchemaText`: a broken
     * or absent PaFixReport must degrade the GATE, never trap the run. An
     * empty list means "no declared gap", which allows — failing open, in
     * line with `_trailTools`' treatment of a degraded trail.
     */
    _safeGaps: function (report) {
        try {
            var gaps = this._reports().unsweptGaps(report)
            return this._isArray(gaps) ? gaps : []
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            return []
        }
    },

    /**
     * Gaps whose tools the trail shows were NEVER invoked. A malformed
     * element (not a plain object, or a non-array `tools`) is a gap this
     * code cannot interpret — it is SKIPPED rather than treated as open, per
     * R-9: an upstream contract violation must degrade this method, never
     * throw inside `_depthGate`.
     */
    _openGaps: function (gaps, invoked) {
        var list = this._isArray(gaps) ? gaps : []
        var open = []
        for (var i = 0; i < list.length; i++) {
            var gap = list[i]
            if (!this._isPlainObject(gap) || !this._isArray(gap.tools)) continue
            if (!this._anyOf(gap.tools, invoked)) open.push(gap)
        }
        return open
    },

    /**
     * Every tool that would close any of these gaps, de-duplicated. Same
     * per-element guard as `_openGaps` — a malformed element contributes NO
     * tools to the recorded union rather than throwing.
     */
    _unionTools: function (gaps) {
        var list = this._isArray(gaps) ? gaps : []
        var out = []
        for (var i = 0; i < list.length; i++) {
            var gap = list[i]
            if (!this._isPlainObject(gap) || !this._isArray(gap.tools)) continue
            var tools = gap.tools
            for (var j = 0; j < tools.length; j++) {
                var found = false
                for (var k = 0; k < out.length; k++) {
                    if (out[k] === tools[j]) found = true
                }
                if (!found) out.push(tools[j])
            }
        }
        return out
    },

    _anyOf: function (candidates, invoked) {
        var c = this._isArray(candidates) ? candidates : []
        var inv = this._isArray(invoked) ? invoked : []
        for (var i = 0; i < c.length; i++) {
            for (var j = 0; j < inv.length; j++) {
                if (c[i] === inv[j]) return true
            }
        }
        return false
    },

    /**
     * The held turn's prompt block (issue #103) — the payload, and the whole
     * difference between this gate and #88.
     *
     * IT NAMES LAYERS, NEVER TOOLS. The layer names and reasons here are the
     * model's OWN `NOT_SWEPT` entries read back to it, and the tool roster is
     * already in every prompt via `PaToolRegistry.promptBlock()`. DECISION.md
     * §H8 item 3 anticipated a mandated fix and kept the acceptance test
     * unchanged — the test survives mandation only because it requires the
     * right tool ON THE SEED THAT NEEDS IT. A gate that named the measured
     * tools would be teaching to the test and would make 45 runs of evidence
     * unreadable. There is a unit test guarding this.
     *
     * ITEM 1 IS THE MISSING BEAT. §O6: on seed 01 the single `agent_trace`
     * call returned `priority_stored: null` verbatim — the exact discrepancy
     * both native runs used as primary evidence — and both custom reports
     * concluded "no errors were reported" with empty `root_causes`. The model
     * read a raw payload in the same generation in which it had to emit a
     * finished artifact, so it SUMMARISED instead of INTERROGATING. Demanding
     * a quoted field buys one generation whose job is reading.
     *
     * IT DEFERS, IT DOES NOT PENALISE. #88 raised the cost of stopping and
     * the model paid in the only currency it controls. Here the draft is
     * preserved and resubmittable unchanged; there is no way to satisfy the
     * hold by writing better. Stopping is not expensive — it is unavailable.
     */
    _holdBlock: function (gaps, kind) {
        var lines = ['## HOLD — a terminal action is not available yet', '']

        if (kind === 'no_layer_report') {
            lines.push(
                'Your last step tried to end this run without a layer report, so there is nothing ' +
                    'on record about which of the seven diagnostic layers you actually looked at.'
            )
            lines.push('')
            lines.push('Submit a fix_report whose layers_swept accounts for all seven layers, or call a tool.')
            return lines.join('\n')
        }

        lines.push('Your draft marks these layers NOT_SWEPT, each with a reason you wrote:')
        var list = this._isArray(gaps) ? gaps : []
        for (var i = 0; i < list.length; i++) {
            var g = list[i]
            lines.push('  layer ' + g.layer + ' (' + g.name + ') — "' + this._str(g.reason) + '"')
        }
        lines.push('The trail shows no tool call has reached any of them.')
        lines.push('')
        lines.push('Before concluding:')
        lines.push('  1. What did the last tool result actually establish? Quote the specific field')
        lines.push('     or value you are relying on.')
        lines.push('  2. What did it NOT settle? Of the layers above, name the one whose answer would')
        lines.push('     most change your conclusion.')
        lines.push('  3. Call a tool that reaches that layer.')
        lines.push('')
        lines.push(
            'Your draft is preserved. Once the trail shows you did, a terminal action is available ' +
                'again and you may resubmit it unchanged.'
        )
        return lines.join('\n')
    },

    /**
     * Renders the SAME normalized report both ways (PaFixReport header:
     * "the two renderings describe the same report") and stores each where
     * it is actually consumed, rather than a third ad-hoc re-stringify of
     * the raw object: `renderJson(normalized)` — the canonical
     * serialization — is what lands in the run row's `fix_report` field via
     * `close()`'s existing `{fixReport}` option (PaRunManager's `_stringify`
     * passes an already-a-string value through untouched, so this is not a
     * double-encode); `renderMarkdown(normalized)` — the human-readable
     * rendering the playbook's "Fix Report" section describes — is returned
     * directly on `run()`'s result as `renderedMarkdown`. NOTE (final
     * review, Phase 1b): in production this value is currently dead — the
     * only caller, the ScriptAction async worker (async-wiring.now.ts),
     * discards `run()`'s return value, and GET /runs re-parses the stored
     * JSON `fix_report` rather than reading a stored markdown rendering.
     * `renderedMarkdown` is reachable today only from tests that call
     * `run()` directly. See the tracked follow-up issue for exposing
     * `fix_report_markdown` on GET /runs once complete.
     */
    _completeFixReport: function (runId, normalized) {
        var renderedMarkdown = this._reports().renderMarkdown(normalized)
        var renderedJson = this._reports().renderJson(normalized)

        this._runs().appendTranscript(runId, { actor: 'system', result_digest: 'fix_report validated' })
        var closeRes = this._runs().close(runId, 'complete', { fixReport: renderedJson })
        return {
            success: !!(closeRes && closeRes.success === true),
            outcome: 'fix_report',
            report: normalized,
            renderedMarkdown: renderedMarkdown,
            run_id: runId,
        }
    },

    /** The invalid (post-repair, or original if the repair itself failed)
     *  draft is stamped onto the run's fix_report field — "the raw draft
     *  preserved" the brief asks for — even though it never validated. */
    _finishFailedFixReport: function (runId, problems, rawDraft) {
        var errText = 'fix_report failed validation and could not be repaired: ' + this._joinProblems(problems)
        this._runs().appendTranscript(runId, { actor: 'system', result_digest: errText })
        var closeRes = this._runs().close(runId, 'failed', { error: errText, fixReport: rawDraft })
        return {
            success: false,
            outcome: 'failed',
            error: errText,
            problems: this._isArray(problems) ? problems : [],
            draft: rawDraft,
            run_id: runId,
        }
    },

    /**
     * The error text names both floors a human/operator can fall back on
     * when the LLM layer itself is down — the Evidence Bundle
     * (`mode: "collect"`, no LLM in its call path — PaRunManager.collectBundle)
     * and `/status`'s deep GenAI-stack checks (Task 7) — verbatim, so a
     * caller reading `run().error` or the run row's `error` field is told
     * exactly what to do next rather than just that something failed.
     */
    _finishFailedLlm: function (runId, reasoned) {
        var underlying = reasoned && reasoned.error ? this._str(reasoned.error) : 'unknown error'
        var errText =
            'LLM reasoning failed: ' +
            underlying +
            '. Retry with mode: "collect" for the Evidence Bundle floor (no LLM required), or check /status for GenAI stack health.'

        this._runs().appendTranscript(runId, { actor: 'system', result_digest: errText })
        var closeRes = this._runs().close(runId, 'failed', { error: errText })
        return { success: false, outcome: 'failed', error: errText, run_id: runId }
    },

    /**
     * A bound-triggered stop — see the file header's BOUNDS ARE A FLOOR
     * section for why this closes the RUN as `complete` while reporting
     * the DIAGNOSIS as `outcome:'partial'`, and why the transcript entry
     * must contain the literal word INCOMPLETE rather than a vague note.
     */
    _finishPartial: function (runId, reasonText) {
        var flag =
            'INCOMPLETE: ' +
            reasonText +
            ' — the loop stopped before the model produced an answer or fix_report; the transcript ' +
            'above is the best partial diagnosis available, not a confirmed conclusion.'

        this._runs().appendTranscript(runId, { actor: 'system', result_digest: flag })
        var closeRes = this._runs().close(runId, 'complete', {})
        return {
            success: !!(closeRes && closeRes.success === true),
            outcome: 'partial',
            reason: reasonText,
            run_id: runId,
        }
    },

    // =======================================================================
    // _buildPrompt — pure string assembly, no Glide, no I/O
    // =======================================================================

    /**
     * @param {String} playbook resolved ONCE by `run()` — see the file
     *        header's note on why this is a parameter, not a hardcoded
     *        string.
     * @param {String} promptBlock `PaToolRegistry.promptBlock()`'s output,
     *        resolved ONCE by `run()` and threaded through every iteration
     *        verbatim — see "PROMPT ASSEMBLY IS SINGLE-SOURCED" above.
     * @param {Object} context `{transcript:[...], context_summary}` from
     *        `PaRunManager.loadContext()`.
     * @param {Object} request the normalized diagnostic target.
     * @returns {String} the full prompt text handed to `PaLlmProxy.reason()`.
     */
    _buildPrompt: function (playbook, promptBlock, context, request) {
        var ctx = this._isPlainObject(context) ? context : {}
        var lines = []

        lines.push(this._str(playbook))
        lines.push('')
        lines.push('## Available tools')
        lines.push('')
        lines.push(this._str(promptBlock))
        lines.push('')
        lines.push('## Diagnostic request')
        lines.push('')
        lines.push(this._renderRequest(request))

        if (this._nonEmptyString(ctx.context_summary)) {
            lines.push('')
            lines.push('## Summary of earlier steps')
            lines.push('')
            lines.push(ctx.context_summary)
        }

        lines.push('')
        lines.push('## Transcript so far')
        lines.push('')
        lines.push(this._renderTranscript(ctx.transcript))

        lines.push('')
        lines.push(this._responseContract())

        lines.push('')
        lines.push(this._fixReportContract())

        return lines.join('\n')
    },

    _renderRequest: function (request) {
        var r = this._isPlainObject(request) ? request : {}
        var parts = []
        if (this._nonEmptyString(r.execution)) parts.push('execution: ' + r.execution)
        if (this._nonEmptyString(r.agent)) parts.push('agent: ' + r.agent)
        if (this._nonEmptyString(r.timeframe)) parts.push('timeframe: ' + r.timeframe)
        if (this._nonEmptyString(r.logs)) parts.push('logs: ' + r.logs)
        if (this._nonEmptyString(r.mode)) parts.push('mode: ' + r.mode)
        if (this._nonEmptyString(r.description)) parts.push('description: ' + r.description)

        if (parts.length === 0) {
            return '(no specific target supplied in the request — work from the transcript/context below, or answer that a target is needed)'
        }
        return parts.join('\n')
    },

    _renderTranscript: function (transcript) {
        var list = this._isArray(transcript) ? transcript : []
        if (list.length === 0) {
            return '(none yet — this is the first reasoning step)'
        }

        var lines = []
        for (var i = 0; i < list.length; i++) {
            var e = this._isPlainObject(list[i]) ? list[i] : {}
            var label = this._nonEmptyString(e.tool) ? this._str(e.actor) + ':' + e.tool : this._str(e.actor)
            var line = '#' + (e.seq !== undefined && e.seq !== null ? e.seq : i + 1) + ' [' + label + ']'
            if (e.args_digest !== undefined && e.args_digest !== null) line += ' args=' + this._str(e.args_digest)

            // THE OBSERVATION CHANNEL (issue #72). When PaRunManager kept a
            // prompt-facing digest for this entry, render THAT — the 200-char
            // `result_digest` is the UI/audit rendering, not what the model
            // is supposed to reason over. Before this, a 4,000-character
            // read_artifact page reached the next prompt as ~200 characters,
            // which is the leading identified mechanical cause of the Phase
            // 1b benchmark's 0/10 (benchmark/DECISION.md §G3a).
            //
            // Block form rather than an inline `result=` suffix: 4,000
            // characters crammed onto one line is hard for the model to parse
            // and unreadable for a human pulling the prompt back out of
            // sys_generative_ai_log to check what the model actually saw.
            if (e.prompt_digest !== undefined && e.prompt_digest !== null) {
                lines.push(line)
                lines.push('result:')
                lines.push(this._str(e.prompt_digest))
                continue
            }

            if (e.result_digest !== undefined && e.result_digest !== null) line += ' result=' + this._str(e.result_digest)
            lines.push(line)
        }
        return lines.join('\n')
    },

    _responseContract: function () {
        return [
            '## Response format',
            '',
            'Respond with exactly one JSON object and nothing else - no prose, no markdown fence. It must be one of:',
            '',
            '  {"action":"tool_call","tool":"<tool name>","args":{...}}',
            '  {"action":"answer","text":"<final answer, once no further tool call is needed>"}',
            '  {"action":"fix_report","report":{...}}',
        ].join('\n')
    },

    /**
     * The fix_report JSON contract — CUSTOM-HARNESS-ONLY prompt content, not
     * part of the shared playbook (fix round, issue #64/#65).
     *
     * WHY THIS EXISTS
     * Live-caught on gpinst01, Task 7 Step 4: 3/3 diagnose runs against the
     * smoke specimen produced a first fix_report attempt keyed on the
     * playbook's own markdown headings ("FAILURE SUMMARY", "LAYERS SWEPT",
     * ...) rather than the JSON schema `PaFixReport.validate` actually
     * requires (`failure_summary`, `layers_swept`, ... lowercase
     * snake_case). The playbook describes the Fix Report as HUMAN-READABLE
     * prose sections — correctly, since it is shared verbatim with the
     * native harness's `AiAgent` (`agent-doctor.now.ts`) for the Tasks 9-10
     * benchmark comparison, and is explicitly off limits here (changing it
     * changes the native agent's behaviour too and introduces a benchmark
     * confound). The JSON key names are a CUSTOM-HARNESS-ONLY concern — the
     * native harness never parses a `fix_report` action at all — so they
     * belong in this class's own prompt layer, not the shared playbook.
     *
     * SINGLE-SOURCED, NOT A SECOND HAND-WRITTEN SCHEMA
     * The field list comes from `PaFixReport.schemaText()` — the SAME text
     * `PaFixReport.repairPrompt` embeds under "Required schema:" — via
     * `_safeSchemaText()` below, never retyped here. If the schema ever
     * changes, `PaFixReport.js` is the one place to change it.
     *
     * THE ENVELOPE REMINDER
     * Also states, again, that a fix_report submission must be wrapped in
     * the `{"action":"fix_report","report":{...}}` envelope
     * `_responseContract()` already shows — repeated here because this
     * block is exactly where a model reads the schema, and the two facts
     * (these are the field names; wrap them in the envelope) belong
     * together for the SAME reason `PaFixReport.repairPrompt`'s own
     * envelope instruction sits right after ITS schema line.
     */
    _fixReportContract: function () {
        var schema = this._safeSchemaText()
        var lines = [
            '## fix_report JSON contract',
            '',
            'When you submit a fix_report action, the report object MUST use exactly these lowercase ' +
                'field names - NOT the section headings shown in the playbook above under "The Fix Report" ' +
                '(do not use "FAILURE SUMMARY" or similar as a JSON key; use failure_summary, and so on):',
            '',
        ]
        if (this._nonEmptyString(schema)) lines.push(schema)
        lines.push('')
        lines.push(
            'The whole response must still be the response envelope from the Response format section above: ' +
                '{"action":"fix_report","report":{...the object described here...}}. Never submit the report ' +
                'object by itself.'
        )
        return lines.join('\n')
    },

    /**
     * @returns {String} `PaFixReport.schemaText()`, or '' if no PaFixReport
     *          is available. Degrades rather than throwing (R-1/R-9) — a
     *          missing collaborator here must not crash the loop before it
     *          can even attempt an answer/fix_report, same standard
     *          `_safePromptBlock()` already applies to
     *          `PaToolRegistry.promptBlock()`.
     */
    _safeSchemaText: function () {
        try {
            var text = this._reports().schemaText()
            return typeof text === 'string' ? text : ''
        } catch (e) {
            // R-1: `e` untouched — a broken/absent PaFixReport must not
            // crash the loop before it can even attempt an answer/fix_report.
            return ''
        }
    },

    // =======================================================================
    // Request normalization
    // =======================================================================

    /**
     * @param {Object|String} request Task 7's `gs.eventQueue` parm2 arrives
     *        as a JSON string; direct in-process callers may pass an object.
     *        On the platform (Rhino), `event.parm2` is instead delivered as
     *        a Java String — `typeof` on it is `'object'`, so a plain-object
     *        check run FIRST (the pre-#77 order) mistook it for an
     *        already-parsed request and handed it back untouched, with
     *        every field read off it (`request.execution` etc.) coming back
     *        `undefined`. `_looksLikeJavaObject` below is what tells the two
     *        apart. See issue #77.
     * @returns {Object} always a plain object (R-9) — `{}` when nothing
     *          usable was supplied (including a real array/number/boolean/
     *          function — those are NEVER coerced to a description, see the
     *          fix-round note below), `{description: <text>}` when a real
     *          JS string or a Java-object-shaped value coerced to text that
     *          was non-JSON and non-empty.
     */
    _normRequest: function (request) {
        if (request === null || request === undefined) return {}

        // Computed once, used twice below. Safe on every input shape —
        // see `_looksLikeJavaObject`'s own header for why member access is
        // itself guarded.
        var isForeignObject = this._looksLikeJavaObject(request)

        // A genuine plain object (a `{...}` literal a direct in-process
        // caller passed, or a prior `JSON.parse` result) is trusted as-is —
        // UNLESS it looks like a LiveConnect-wrapped Java object (a Rhino
        // java.lang.String satisfies `_isPlainObject`: `typeof` is
        // `'object'`, and it is not an array). This check has to run before
        // any dispatch on `_isPlainObject` — a branch added only after that
        // check would never fire, since the Java String already returns
        // true there (issue #77).
        if (this._isPlainObject(request) && !isForeignObject) return request

        // A genuine JS string: parsed as JSON if possible, else wrapped as
        // a free-form description.
        if (typeof request === 'string') {
            return this._nonEmptyString(request) ? this._parseRequestText(request) : {}
        }

        // Fix-round note (issue #77 review): ONLY a value that actually
        // looks foreign is coerced through `String()` below. Earlier this
        // branch ran for ANY non-plain-object, non-string value, which
        // silently changed behaviour for genuine arrays/numbers/booleans/
        // functions — e.g. `String([1,2])` -> `{description:'1,2'}`,
        // and a function's SOURCE TEXT would have landed verbatim in an
        // LLM prompt. Those four now fall straight through to the `{}`
        // below, unchanged from pre-#77 behaviour.
        if (isForeignObject) {
            var coerced = String(request)
            return this._nonEmptyString(coerced) ? this._parseRequestText(coerced) : {}
        }

        return {}
    },

    /**
     * @param {String} text A non-empty string — either a genuine JS string
     *        request, or a Java-object-shaped value already coerced via
     *        `String()`.
     * @returns {Object} the parsed object if `text` is JSON for a plain
     *          object, else `{description: text}`. Shared by both
     *          `_normRequest` branches that reach this point so the JSON-
     *          parse-or-describe logic exists exactly once.
     */
    _parseRequestText: function (text) {
        try {
            var parsed = JSON.parse(text)
            if (this._isPlainObject(parsed)) return parsed
        } catch (e) {
            // R-1: `e` untouched — not JSON, fall through to a free-form
            // description instead.
        }
        return { description: text }
    },

    /**
     * @param {*} value Any `_normRequest` input except `null`/`undefined`
     *        (those return before this is called).
     * @returns {Boolean} true if `value` looks like a Rhino LiveConnect
     *          wrapper around a Java object (e.g. `event.parm2` as the
     *          platform actually delivers it) rather than a genuine JS
     *          value. LiveConnect exposes the underlying `java.lang.Object`
     *          methods on a wrapped Java value — `getClass()` chief among
     *          them — which no ordinary JS object/array/number/boolean/
     *          function carries unless something deliberately added it.
     *
     *          KNOWN LIMITATION (fix-round review): this hallmark is
     *          UNVERIFIED against a real scoped-app `event.parm2` — it has
     *          only been exercised against a Jest double built to expose
     *          `getClass()`. A genuine Rhino value that does not happen to
     *          expose `getClass` would still slip past this check
     *          entirely. The LOAD-BEARING fix for issue #77 is the
     *          ScriptAction's own `String(event.parm2)` coercion in
     *          `async-wiring.now.ts` (review-confirmed byte-correct in the
     *          generated dist XML) — this helper is defence-in-depth for
     *          direct in-process callers that bypass that ScriptAction,
     *          not a verified mechanism in its own right. Do not mistake
     *          it for one.
     *
     *          Reading `.getClass` off a genuinely restricted/foreign
     *          object could itself throw inside ServiceNow's sandboxed
     *          LiveConnect — exactly the situation this guard exists to
     *          survive. A throw here is treated as "yes, foreign" (R-9:
     *          degrade, never propagate a throw out of `_normRequest`)
     *          rather than left to crash the run.
     */
    _looksLikeJavaObject: function (value) {
        try {
            return typeof value.getClass === 'function'
        } catch (e) {
            // R-1: `e` untouched — the property access itself threw, which
            // alone means `value` is not an ordinary JS request object.
            return true
        }
    },

    // =======================================================================
    // Collaborators — lazily resolved so tests can inject
    // =======================================================================

    _llm: function () {
        return this._llmProxy || new PaLlmProxy()
    },

    _tools: function () {
        return this._toolRegistry || new PaToolRegistry()
    },

    _runs: function () {
        return this._runManager || new PaRunManager()
    },

    _reports: function () {
        return this._fixReport || new PaFixReport()
    },

    _audits: function () {
        return this._auditLogger || new PaAuditLogger()
    },

    _safePromptBlock: function () {
        try {
            var block = this._tools().promptBlock()
            return typeof block === 'string' ? block : ''
        } catch (e) {
            // R-1: `e` untouched — a broken tools roster must not crash the
            // loop before it can even attempt an answer/fix_report.
            return ''
        }
    },

    // =======================================================================
    // Playbook — resolved once per run(), then threaded as a parameter
    // =======================================================================

    _loadPlaybook: function () {
        if (this._playbook !== null) return this._playbook
        return this._defaultPlaybook()
    },

    /**
     * Runtime default: read the SAME text off the installed native agent
     * (`sn_aia_agent.instructions`) rather than hardcoding a third copy —
     * see the file header. Best-effort; never throws (R-1/R-9).
     */
    _defaultPlaybook: function () {
        try {
            if (typeof GlideRecord !== 'undefined') {
                var gr = new GlideRecord('sn_aia_agent')
                gr.addQuery('name', this.AGENT_NAME)
                gr.setLimit(1)
                gr.query()
                if (gr.next()) {
                    var text = gr.getValue('instructions')
                    if (this._nonEmptyString(text)) return text
                }
            }
        } catch (e) {
            // R-1: `e` untouched — fall through to the built-in fallback.
        }
        return this._FALLBACK_PLAYBOOK
    },

    // =======================================================================
    // Clock — the Rhino default is new GlideDateTime().getNumericValue()
    // =======================================================================

    _now: function () {
        if (this._nowFn) return this._nowFn()
        try {
            if (typeof GlideDateTime !== 'undefined') return new GlideDateTime().getNumericValue()
        } catch (e) {
            // R-1: `e` untouched — fall through to the plain-JS clock.
        }
        try {
            return new Date().getTime()
        } catch (e2) {
            // R-1: `e2` untouched.
            return 0
        }
    },

    // =======================================================================
    // Small helpers (ES5 / Rhino only)
    // =======================================================================

    _joinProblems: function (problems) {
        var list = this._isArray(problems) ? problems : []
        if (list.length === 0) return '(no problems recorded)'
        return list.join('; ')
    },

    /** Stringifies anything into transcript-safe text — objects go through
     *  JSON.stringify so an observation like a dispatch error survives into
     *  the next prompt's rendered transcript verbatim (R-1 on the catch). */
    _toText: function (value) {
        if (typeof value === 'string') return value
        if (value === null || value === undefined) return ''
        try {
            var json = JSON.stringify(value)
            return json === undefined ? String(value) : json
        } catch (e) {
            // R-1: `e` untouched. Circular structures land here.
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

    type: 'PaAgentLoop',
}
