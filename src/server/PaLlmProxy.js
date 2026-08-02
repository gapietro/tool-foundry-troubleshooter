/**
 * PaLlmProxy — the sole NASK touchpoint for the custom harness (LLD §3, §4.8;
 * Phase 1b Task 2, docs/superpowers/plans/2026-08-02-phase1b-harness.md).
 *
 * WHAT THIS EXISTS FOR
 * PaAgentLoop needs the model to answer in one of three shapes — tool_call,
 * answer, fix_report — and needs that answer as a real object, not a string it
 * has to trust. This class is the strict-JSON boundary (ADR Layer 4): it calls
 * the model, parses what comes back against that contract, and gives the loop
 * exactly ONE retry with the parse failure fed back to the model before giving
 * up. Above this class, nothing deals in raw model text.
 *
 * THE SEAM (why `initialize({invoke})` exists)
 * `invoke(skillName, prompt) -> {success, text}` or `{success:false, error}` is
 * the entire boundary to the platform. `_invokeNask` is the ONLY method in this
 * codebase that knows NASK exists, knows the skill sys_ids, or knows about the
 * double-JSON response envelope — see its own header for the LLD §4.8 call
 * shape. Every other method here, including `_parseResponse`, is pure string
 * logic that would work identically against a fake, a different NASK skill, or
 * a different LLM integration entirely. Tests inject `invoke` and never load
 * `sn_one_extend`.
 *
 * TWO JSON LAYERS, NOT ONE (LLD §4.8)
 * `_invokeNask` unwraps the NASK response envelope (`{"model_output": "..."}`)
 * down to the model's plain-text answer. `_parseResponse` then applies THIS
 * class's own strict-JSON contract to that plain text (tool_call / answer /
 * fix_report). The two parses are independent layers with independent failure
 * modes — see `reason()`'s "invoke-level failure" vs. "parse-level failure"
 * distinction below, which is what `/status` and the Evidence Bundle advice
 * hang on (Task 2 brief, Step 4).
 *
 * STANDING RULES THIS FILE IS BUILT AROUND
 * R-1 Never touch the exception object in a catch. Every catch here names its
 *     own reason and moves on.
 * R-9 Every input may be absent. `reason`/`summarize` degrade explicitly on an
 *     empty prompt rather than calling the seam with nothing.
 *
 * This class touches no Glide API at all — Build Rule #42 (missing ACLs on a
 * plain `Table()`) and Rule #41 (autoNumber) do not apply here.
 */
var PaLlmProxy = Class.create()

PaLlmProxy.prototype = {
    /**
     * @param {Object} [options] {invoke} — `invoke(skillName, prompt) ->
     *        {success, text}` or `{success:false, error}`. Omit to use the
     *        default `_invokeNask` wiring. Tests always inject this; nothing
     *        outside `_invokeNask` should ever assume NASK is the backend.
     */
    initialize: function (options) {
        var o = options || {}
        this._invoke = typeof o.invoke === 'function' ? o.invoke : null
    },

    // =======================================================================
    // Public contract
    // =======================================================================

    /**
     * @param {String} prompt the FULL prompt text — this class composes none
     *        of it. Composition is PaAgentLoop's job.
     * @returns {Object}
     *   success: {success:true, action:Object, raw:String, retried:Boolean}
     *   failure: {success:false, error:String, raw:String|null}
     *
     * `raw` is null only when the failure happened at the invoke layer (no
     * model text was ever produced to show). Once at least one response comes
     * back, `raw` always carries the most recent one — even on failure — so a
     * caller can see what the model actually said.
     */
    reason: function (prompt) {
        var p = this._normPrompt(prompt)
        if (!p) {
            return { success: false, error: 'prompt is required', raw: null }
        }

        var first = this._callInvoke('reason', p)
        if (!first || !first.success) {
            return {
                success: false,
                error: 'LLM invocation failed: ' + this._errText(first),
                raw: null,
            }
        }

        var raw1 = typeof first.text === 'string' ? first.text : ''
        var parsed1 = this._parseResponse(raw1)
        if (parsed1.ok) {
            return { success: true, action: parsed1.action, raw: raw1, retried: false }
        }

        // Exactly ONE retry, and only when the failure was at the PARSE
        // layer — an invoke-layer failure above already returned.
        var retryPrompt = this._buildRetryPrompt(p, parsed1.reason)
        var second = this._callInvoke('reason', retryPrompt)
        if (!second || !second.success) {
            return {
                success: false,
                error: 'LLM invocation failed on retry: ' + this._errText(second),
                raw: raw1,
            }
        }

        var raw2 = typeof second.text === 'string' ? second.text : ''
        var parsed2 = this._parseResponse(raw2)
        if (parsed2.ok) {
            return { success: true, action: parsed2.action, raw: raw2, retried: true }
        }

        return {
            success: false,
            error: 'response could not be parsed as JSON after one retry: ' + parsed2.reason,
            raw: raw2,
        }
    },

    /**
     * @param {String} prompt the FULL prompt text.
     * @returns {Object}
     *   success: {success:true, text:String}
     *   failure: {success:false, error:String}
     *
     * No JSON contract, no retry — a summary is free-form text by design.
     */
    summarize: function (prompt) {
        var p = this._normPrompt(prompt)
        if (!p) {
            return { success: false, error: 'prompt is required' }
        }

        var result = this._callInvoke('summarize', p)
        if (!result || !result.success) {
            return { success: false, error: 'LLM invocation failed: ' + this._errText(result) }
        }

        return { success: true, text: typeof result.text === 'string' ? result.text : '' }
    },

    /**
     * Pure string logic — no Glide, no NASK, no I/O of any kind.
     *
     * @param {String} raw
     * @returns {Object} {ok:true, action:Object} | {ok:false, reason:String}
     *
     * Steps (Task 2 brief, Step 3): trim; strip a single leading/trailing
     * markdown fence; locate the first `{` and last `}` and `JSON.parse` the
     * slice inside a try (R-1: the catch does not read the exception);
     * validate `action` against the three known values and per-action
     * required fields.
     */
    _parseResponse: function (raw) {
        if (raw === null || raw === undefined) {
            return { ok: false, reason: 'empty response' }
        }

        var text = String(raw).replace(/^\s+|\s+$/g, '')
        if (!text) {
            return { ok: false, reason: 'empty response' }
        }

        // A single leading/trailing markdown fence, e.g. ```json\n{...}\n```
        // or ```\n{...}\n```. Anything else (prose, partial fences) is left
        // alone — the brace-slice below strips leading/trailing prose anyway.
        var fenceMatch = /^```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n?```$/.exec(text)
        if (fenceMatch) {
            text = fenceMatch[1].replace(/^\s+|\s+$/g, '')
        }

        var start = text.indexOf('{')
        var end = text.lastIndexOf('}')
        if (start === -1 || end === -1 || end < start) {
            return { ok: false, reason: 'no JSON object found in response' }
        }

        var slice = text.substring(start, end + 1)
        var parsed = null
        try {
            parsed = JSON.parse(slice)
        } catch (e) {
            // R-1: `e` deliberately not inspected.
            return { ok: false, reason: 'malformed JSON' }
        }

        if (!parsed || typeof parsed !== 'object' || this._isArray(parsed)) {
            return { ok: false, reason: 'parsed value is not a JSON object' }
        }

        var action = parsed.action
        if (action === null || action === undefined || action === '') {
            return { ok: false, reason: 'missing action key' }
        }

        if (action !== 'tool_call' && action !== 'answer' && action !== 'fix_report') {
            return { ok: false, reason: 'unknown action: ' + action }
        }

        if (action === 'tool_call') {
            var tool = parsed.tool
            if (typeof tool !== 'string' || !tool.replace(/^\s+|\s+$/g, '')) {
                return { ok: false, reason: 'tool_call is missing a tool name' }
            }
        } else if (action === 'answer') {
            if (typeof parsed.text !== 'string') {
                return { ok: false, reason: 'answer is missing text' }
            }
        } else if (action === 'fix_report') {
            if (!parsed.report || typeof parsed.report !== 'object' || this._isArray(parsed.report)) {
                return { ok: false, reason: 'fix_report is missing a report object' }
            }
        }

        return { ok: true, action: parsed }
    },

    // =======================================================================
    // The seam
    // =======================================================================

    _callInvoke: function (skillName, prompt) {
        if (this._invoke) return this._invoke(skillName, prompt)
        return this._invokeNask(skillName, prompt)
    },

    /**
     * THE ONLY METHOD IN THIS CODEBASE THAT KNOWS NASK EXISTS.
     *
     * Default implementation of the `invoke(skillName, prompt)` seam, wired to
     * the invocation path verified live on gpinst01 — docs/LOW_LEVEL_DESIGN.md
     * §4.8 (Phase 1b Task 1 addendum) and the header of
     * src/fluent/nask-skills.now.ts:
     *
     *   sn_one_extend.OneExtendUtil.executeSecure({
     *     executionRequests: [{
     *       capabilityId: <sys_one_extend_capability sys_id>,
     *       payload: { prompt: prompt },
     *       meta: { skillConfigId: <sn_nowassist_skill_config sys_id> }
     *     }]
     *   })
     *
     * The response is DOUBLE-JSON-WRAPPED: `resp.capabilities[capabilityId]
     * .response` is itself a JSON STRING of the shape `{"model_output":
     * "<text>"}`, not the bare model text (LLD §4.8's load-bearing finding —
     * not guessable from the golden example alone). This method is the one
     * place that unwraps that envelope; everything above it in this class
     * deals only in plain strings.
     *
     * `skillName` here is the logical seam name ('reason' | 'summarize'), not
     * the on-instance skill display name ('pa llm reason' / 'pa llm
     * summarize', SPACED — underscores are rejected at Fluent build time).
     * Per Build Rule #33 (never `Now.ref`, direct sys_id strings only) — same
     * spirit even though this file is server-side JS, not Fluent — the skills
     * are resolved by direct sys_id below, taken from
     * src/fluent/generated/keys.ts (`pa-llm-reason-skill` /
     * `pa-llm-summarize-skill` for the capability, `sn_nowassist_skill_config`
     * for the skill config), not by name lookup at runtime.
     *
     * @returns {Object} {success:true, text:String} | {success:false, error}
     */
    _invokeNask: function (skillName, prompt) {
        var config = this._NASK_SKILLS[skillName]
        if (!config) {
            return { success: false, error: 'no NASK skill mapped for "' + skillName + '"' }
        }

        try {
            if (typeof sn_one_extend === 'undefined' || !sn_one_extend || !sn_one_extend.OneExtendUtil) {
                return { success: false, error: 'sn_one_extend.OneExtendUtil is unavailable' }
            }

            var resp = sn_one_extend.OneExtendUtil.executeSecure({
                executionRequests: [
                    {
                        capabilityId: config.capabilityId,
                        payload: { prompt: prompt },
                        meta: { skillConfigId: config.skillConfigId },
                    },
                ],
            })

            var cap = resp && resp.capabilities ? resp.capabilities[config.capabilityId] : null
            var result = this._isArray(cap) ? cap[0] : cap
            var envelope = result && typeof result.response === 'string' ? result.response : null

            if (!envelope) {
                return { success: false, error: 'NASK call returned no response envelope' }
            }

            var parsed = null
            try {
                parsed = JSON.parse(envelope)
            } catch (e) {
                // R-1: `e` deliberately not inspected.
                return { success: false, error: 'NASK response envelope was not valid JSON' }
            }

            if (!parsed || typeof parsed.model_output !== 'string') {
                return { success: false, error: 'NASK response envelope had no model_output' }
            }

            return { success: true, text: parsed.model_output }
        } catch (e) {
            // R-1: `e` deliberately not inspected.
            return { success: false, error: 'NASK invocation threw' }
        }
    },

    /**
     * Direct sys_id strings from src/fluent/generated/keys.ts, verified live
     * on gpinst01 (Task 1, docs/LOW_LEVEL_DESIGN.md §4.8). `capabilityId` is
     * the `sys_one_extend_capability` sys_id keyed `pa-llm-reason-skill` /
     * `pa-llm-summarize-skill`; `skillConfigId` is the matching
     * `sn_nowassist_skill_config` row (`skill_id` = that same capability).
     */
    _NASK_SKILLS: {
        reason: {
            capabilityId: '0bf0bc13a7414399a1482d21de01231d',
            skillConfigId: '21c00b55a323477082b23a25049a11ba',
        },
        summarize: {
            capabilityId: '3914d62f6a9b42a3a4633432a97a1d0f',
            skillConfigId: '3997e152586a4c8986ebe6d9e6bb6120',
        },
    },

    // =======================================================================
    // Internals
    // =======================================================================

    /**
     * The re-prompt sent on the one allowed retry. Must contain the parse
     * failure reason and the literal phrase "JSON only" (Task 2 brief, Step
     * 4) — that is what tells the model precisely what was wrong and how to
     * fix it, rather than just repeating the original prompt verbatim.
     */
    _buildRetryPrompt: function (originalPrompt, reason) {
        return (
            originalPrompt +
            '\n\nYour previous response could not be parsed: ' +
            reason +
            '. Respond with JSON only, matching the required schema exactly — no prose, ' +
            'no markdown fence, just the JSON object.'
        )
    },

    _normPrompt: function (value) {
        if (value === null || value === undefined) return ''
        return String(value).replace(/^\s+|\s+$/g, '')
    },

    /** @returns {String} a human-readable error even when `result` is malformed. */
    _errText: function (result) {
        if (result && typeof result.error === 'string' && result.error) return result.error
        return 'unknown error'
    },

    _isArray: function (value) {
        return Object.prototype.toString.call(value) === '[object Array]'
    },

    type: 'PaLlmProxy',
}
