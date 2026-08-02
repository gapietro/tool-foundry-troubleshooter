/**
 * PaFixReport — the structural floor under the Fix Report JSON the LLM
 * produces at the end of a diagnosis run (ARCHITECTURE_DECISIONS.md "Layer 3:
 * Orchestration", Phase 1b Task 4).
 *
 * WHAT THIS EXISTS FOR
 * The playbook (docs/agent/agent-doctor-instructions.md, "The Fix Report")
 * asks the model for a specific shape, INCLUDING the evidence rule — every
 * root cause needs a trace citation PLUS at least one config/schema/data
 * citation. Prompt language is a request; this class is the check. PaAgentLoop
 * (Task 6) calls `validate`, gets back either a normalized report or a list of
 * named problems, feeds problems into ONE `repairPrompt` retry through
 * PaLlmProxy, and either accepts the repaired report or fails the run with the
 * best invalid draft attached and the problems stated. There is no second
 * repair attempt — see the header of PaLlmProxy for the same one-retry
 * philosophy applied to the parse layer; this is the analogous policy for the
 * schema layer, enforced by the caller, not by this class (validate() itself
 * has no retry logic — it is a pure function of one report).
 *
 * THE TWO RENDERINGS DESCRIBE THE SAME REPORT
 * `renderMarkdown` and `renderJson` both take the SAME `normalized` object
 * validate() produced. The markdown section order is copied verbatim from the
 * playbook's "The Fix Report" section: FAILURE SUMMARY, LAYERS SWEPT, ROOT
 * CAUSES, FIXES, VERIFICATION, DATA MARKERS — six headings, in that order,
 * plus a seventh INCONCLUSIVE section rendered between LAYERS SWEPT and ROOT
 * CAUSES ONLY when the report took the earned-inconclusive path (T4, issue
 * #72). If the playbook's section order ever changes, the `lines.push('## ...')`
 * sequence in `renderMarkdown` below is the one place to change it to keep
 * the two in sync.
 *
 * VALIDATION IS A FLOOR, NOT A CEILING
 * `validate` checks that the REQUIRED shape is present and internally
 * consistent (the evidence rule, the seven layers, the enum values). It never
 * strips unknown keys — the model may add insight beyond the required shape
 * (an extra `confidence_narrative`, a nested detail block), and `normalized`
 * carries every key from the input report through untouched. This is a
 * structural gate, not a schema-enforcing serializer.
 *
 * THE SEVEN LAYERS AND THE EVIDENCE RULE (playbook, verbatim source of truth)
 * Layers, in playbook order: 1 Execution trace, 2 Instructions, 3 Tool
 * definitions, 4 Data schemas, 5 Data, 6 GenAI stack, 7 Trigger and wiring.
 * `layers_swept` must report on ALL SEVEN, each SWEPT / NOT_SWEPT /
 * UNAVAILABLE — NOT_SWEPT and UNAVAILABLE both require a `reason` (the
 * playbook: "why you chose not to" / "what would make it available"). The
 * evidence rule: every `root_causes[]` entry cites trace evidence PLUS AT
 * LEAST ONE of config, schema or data evidence — one layer is a candidate, not
 * a conclusion. `evidence[]` entries are `{source, detail}` with `source` one
 * of `trace` | `config` | `schema` | `data`.
 *
 * STANDING RULES THIS FILE IS BUILT AROUND
 * R-1 Never touch the exception object in a catch. The only try/catch here
 *     guards a JSON round-trip against a pathological input; the catch names
 *     its own reason and falls back, it does not read what JSON threw.
 * R-9 Every input may be absent — a null/undefined/non-object report is an
 *     INVALID report (a normal `validate()` outcome), never a crash. Render
 *     and repairPrompt degrade the same way rather than throwing on a partial
 *     or missing object.
 *
 * This class touches no Glide API at all — pure ES5 object-walking.
 */
var PaFixReport = Class.create()

PaFixReport.prototype = {
    initialize: function () {},

    // =======================================================================
    // Layer + evidence-source vocabulary — single source for validate + render
    // =======================================================================

    /** Playbook order, "The seven-layer sweep" section — do not reorder. */
    _layerDefs: function () {
        return [
            { number: 1, name: 'Execution trace' },
            { number: 2, name: 'Instructions' },
            { number: 3, name: 'Tool definitions' },
            { number: 4, name: 'Data schemas' },
            { number: 5, name: 'Data' },
            { number: 6, name: 'GenAI stack' },
            { number: 7, name: 'Trigger and wiring' },
        ]
    },

    _sweepStatuses: function () {
        return ['SWEPT', 'NOT_SWEPT', 'UNAVAILABLE']
    },

    /** Playbook "The evidence rule" — trace PLUS at least one of these three. */
    _nonTraceEvidenceSources: function () {
        return ['config', 'schema', 'data']
    },

    _evidenceSources: function () {
        return ['trace'].concat(this._nonTraceEvidenceSources())
    },

    /** Playbook FIXES section: "instruction, tool schema, data, configuration, or wiring". */
    _fixTargetTypes: function () {
        return ['instruction', 'tool schema', 'data', 'configuration', 'wiring']
    },

    // =======================================================================
    // validate
    // =======================================================================

    /**
     * @param {*} report candidate Fix Report — may be anything, including
     *        null/undefined (R-9).
     * @param {Object} [context] {invokedTools:[String], auditAvailable:Boolean}
     *        — what the RUN actually did, resolved by the caller and passed
     *        in so this stays a pure function of its inputs (issue #79's own
     *        design note). Absent or malformed disables the audit-backed
     *        checks; see `_buildCheckContext`.
     * @returns {Object} {valid:true, normalized} | {valid:false, problems:[String]}
     *          `normalized` is a deep copy of `report` with every key —
     *          required and unknown alike — carried through untouched.
     */
    validate: function (report, context) {
        if (!this._isPlainObject(report)) {
            return { valid: false, problems: ['fix report must be a JSON object'] }
        }

        var ctx = this._buildCheckContext(report, context)

        var problems = []
        this._checkFailureSummary(report, problems)
        this._checkLayersSwept(report, problems)
        this._checkSweptClaims(report, problems, ctx)
        this._checkRootCauses(report, problems, ctx)
        this._checkFixes(report, problems)
        this._checkVerification(report, problems)
        this._checkDataMarkers(report, problems)

        if (problems.length > 0) {
            return { valid: false, problems: problems }
        }

        var normalized = this._clone(report)
        this._normalizeRootCauseLayers(normalized)
        return { valid: true, normalized: normalized }
    },

    /**
     * Everything the checks need that is not in the report itself, resolved
     * ONCE per validate() call.
     *
     * `auditEnabled` demands an EXPLICIT `true` plus an array of tools. A
     * missing, malformed or degraded context fails toward NOT checking,
     * because a broken audit trail convicting an honest report is a strictly
     * worse outcome than an unverified citation — that is #78's defect, and
     * reintroducing it through the back door would be worse than leaving #79
     * unfixed.
     */
    _buildCheckContext: function (report, context) {
        var c = this._isPlainObject(context) ? context : {}
        var raw = this._isArray(c.invokedTools) ? c.invokedTools : []
        var names = []
        for (var i = 0; i < raw.length; i++) {
            var name = this._normToolName(raw[i])
            if (name && this._indexOf(names, name) === -1) names.push(name)
        }

        return {
            traceUnavailable: this._isTraceUnavailable(report),
            auditEnabled: c.auditAvailable === true && this._isArray(c.invokedTools),
            invokedTools: names,
        }
    },

    /**
     * #78's trigger. The report has declared on the record — with a `reason`
     * that `_checkLayersSwept` already makes mandatory for any non-SWEPT
     * layer — that no execution trace exists to cite. Seed 05 is exactly this
     * case: nothing fired, so there is no sn_aia_execution_plan row, and the
     * old rule made a correct diagnosis structurally unreportable.
     */
    _isTraceUnavailable: function (report) {
        var ls = this._isPlainObject(report.layers_swept) ? report.layers_swept : {}
        var entry = ls[1]
        return this._isPlainObject(entry) && entry.status === 'UNAVAILABLE'
    },

    /** Matches PaToolRegistry._normName / PaAuditLogger._normToolName. */
    _normToolName: function (value) {
        return String(value === null || value === undefined ? '' : value).replace(/^\s+|\s+$/g, '')
    },

    /**
     * `root_causes[].layer` is accepted as either a non-empty string OR a
     * finite JSON number (see `_hasLayerValue` below) — normalized here to a
     * STRING so every consumer of `normalized` (renderMarkdown, renderJson,
     * a caller comparing it against `_layerDefs()`) sees one consistent
     * type regardless of which shape the model used. Fix round, issue
     * #64/#65 — live-caught on gpinst01: a repair draft that had already
     * fixed both the key-casing and envelope defects still failed
     * validation on `{"layer":1,...}` / `{"layer":4,...}`, which is a
     * perfectly reasonable answer to "which layer" (root_causes shares the
     * same 1-7 range `layers_swept` already keys on) and rejecting it was
     * validator pedantry, not a real defect.
     */
    _normalizeRootCauseLayers: function (normalized) {
        var rcs = this._isArray(normalized.root_causes) ? normalized.root_causes : []
        for (var i = 0; i < rcs.length; i++) {
            var rc = rcs[i]
            if (this._isPlainObject(rc) && typeof rc.layer === 'number') {
                rc.layer = String(rc.layer)
            }
        }
    },

    _checkFailureSummary: function (report, problems) {
        if (!this._nonEmptyString(report.failure_summary)) {
            problems.push('failure_summary is required and must be a non-empty string')
        }
    },

    _checkLayersSwept: function (report, problems) {
        var ls = report.layers_swept
        if (!this._isPlainObject(ls)) {
            problems.push(
                'layers_swept is required and must be an object mapping each of the seven layers (1-7) to a status'
            )
            return
        }

        var defs = this._layerDefs()
        var statuses = this._sweepStatuses()
        for (var i = 0; i < defs.length; i++) {
            var def = defs[i]
            var entry = ls[def.number]
            var label = 'layer ' + def.number + ' (' + def.name + ')'

            if (!this._isPlainObject(entry)) {
                problems.push('layers_swept is missing ' + label)
                continue
            }

            var status = entry.status
            if (this._indexOf(statuses, status) === -1) {
                problems.push('layers_swept ' + label + ' has an unknown status: ' + this._describe(status))
                continue
            }

            if (status !== 'SWEPT' && !this._nonEmptyString(entry.reason)) {
                problems.push('layers_swept ' + label + ' is ' + status + ' but has no reason')
            }
        }
    },

    /**
     * #79b. A layer marked SWEPT is a claim to have LOOKED at it; the audit
     * trail says whether a tool that CAN look was ever invoked. In the
     * 2026-08-02 re-run, 11 layer-sweep claims across 4 runs named a tool
     * that was never invoked, and one rejected draft claimed all seven layers
     * SWEPT on two tool calls — both reads of the same trace.
     *
     * Only SWEPT is checked. NOT_SWEPT and UNAVAILABLE are claims of NOT
     * having looked, already priced by the `reason` `_checkLayersSwept`
     * makes mandatory for them.
     *
     * ALL offenders collapse into ONE problem. Per-layer problems would put
     * five near-identical entries into a repair prompt that also carries the
     * citation problems, and burying the signal is how a repair turn gets
     * wasted.
     *
     * This is complementary to `_checkInconclusive`'s citation-per-sweep
     * pricing, not a replacement for it: `_countSweptLayers` prices honest
     * sweeps, this falsifies dishonest ones. A report can no longer dodge the
     * price by inflating its sweep claims.
     */
    _checkSweptClaims: function (report, problems, ctx) {
        if (!ctx.auditEnabled) return

        var ls = this._isPlainObject(report.layers_swept) ? report.layers_swept : {}
        var defs = this._layerDefs()
        var map = this._layerToolMap()
        var unsupported = []

        for (var i = 0; i < defs.length; i++) {
            var def = defs[i]
            var entry = ls[def.number]
            if (!this._isPlainObject(entry) || entry.status !== 'SWEPT') continue

            var supporting = map[def.number] || []
            if (this._anyInvoked(supporting, ctx)) continue

            unsupported.push(def.number + ' (' + def.name + ') needs one of: ' + supporting.join(', '))
        }

        if (unsupported.length === 0) return

        problems.push(
            'layers_swept: unsupported sweep claim — ' + unsupported.length + ' layer(s) are marked SWEPT ' +
                'but this run never invoked a tool that reads them. ' + unsupported.join('. ') + '. Tools ' +
                'invoked this run: ' + this._invokedList(ctx) + '. Mark a layer you did not actually sweep ' +
                'NOT_SWEPT or UNAVAILABLE with a reason instead of claiming it.'
        )
    },

    /**
     * #79b layer -> tool map. Extends PaRunManager._collectionTools (the same
     * seven-layer mapping the Evidence Bundle uses) with the two tools it does
     * not cover. Layer 1 is kept aligned with the `trace` entry of
     * `_citationToolMap`; the rest are layer-specific, because layers are
     * finer-grained than the four evidence sources.
     */
    _layerToolMap: function () {
        return {
            1: ['agent_trace', 'genai_log', 'log_analysis'],
            2: ['agent_config'],
            3: ['agent_config'],
            4: ['schema_lookup'],
            5: ['query_table'],
            6: ['genai_log', 'log_analysis'],
            7: ['agent_config'],
        }
    },

    _checkRootCauses: function (report, problems, ctx) {
        var rcs = report.root_causes
        if (!this._isArray(rcs)) {
            problems.push('root_causes is required and must be an array')
            return
        }
        if (rcs.length === 0) {
            // T4 — the earned-inconclusive path. See `_checkInconclusive`.
            this._checkInconclusive(report, problems, ctx)
            return
        }

        for (var i = 0; i < rcs.length; i++) {
            this._checkRootCause(rcs[i], i, problems, ctx)
        }
    },

    _checkRootCause: function (rc, index, problems, ctx) {
        var label = 'root_causes[' + index + ']'
        if (!this._isPlainObject(rc)) {
            problems.push(label + ' must be an object')
            return
        }

        if (!this._hasLayerValue(rc.layer)) problems.push(label + ' is missing layer')
        if (!this._nonEmptyString(rc.component)) problems.push(label + ' is missing component')
        if (!this._nonEmptyString(rc.finding)) problems.push(label + ' is missing finding')

        // Prefer the component name in problem text once it exists — it is a
        // more useful pointer back into the report than a bare array index.
        var causeName = this._nonEmptyString(rc.component) ? rc.component : label

        if (!this._isArray(rc.evidence) || rc.evidence.length === 0) {
            problems.push(label + ' (' + causeName + ') is missing evidence')
            return
        }

        this._checkEvidenceRule(rc.evidence, label, causeName, problems, ctx)
    },

    /**
     * `layer` accepts a non-empty string ("layer 7", "7") OR a finite JSON
     * number (7) — see `_normalizeRootCauseLayers` above for why a number is
     * normalized to a string on the way out rather than rejected on the way
     * in.
     */
    _hasLayerValue: function (value) {
        if (this._nonEmptyString(value)) return true
        return typeof value === 'number' && isFinite(value)
    },

    /**
     * Per-entry shape check, shared by `_checkEvidenceRule` (root causes) and
     * `_checkInconclusive` (evidence_read). Returns the source tally so the
     * caller can apply — or deliberately NOT apply — the evidence rule.
     */
    _checkEvidenceEntries: function (evidence, label, problems, ctx) {
        var sources = this._evidenceSources()
        var tally = { hasTrace: false, hasOther: false, distinctOther: 0 }
        var otherSources = []

        for (var i = 0; i < evidence.length; i++) {
            var entry = evidence[i]
            var entryLabel = label + '[' + i + ']'

            if (!this._isPlainObject(entry) || this._indexOf(sources, entry.source) === -1) {
                problems.push(
                    entryLabel + ' has an invalid or missing source (must be one of: ' + sources.join(', ') + ')'
                )
                continue
            }
            if (!this._nonEmptyString(entry.detail)) {
                problems.push(entryLabel + ' is missing a detail citation (table, sys_id, field, or value)')
            }

            // #79a — the citation is checked against what the run ACTUALLY
            // invoked, not against the label the model chose for it.
            this._checkCitationSupported(entry.source, entryLabel, problems, ctx)

            if (entry.source === 'trace') {
                tally.hasTrace = true
            } else {
                tally.hasOther = true
                // DISTINCT, not a count of entries: #78 relaxes the trace
                // requirement in exchange for two INDEPENDENT sources, and two
                // config citations are one source cited twice.
                if (this._indexOf(otherSources, entry.source) === -1) otherSources.push(entry.source)
            }
        }

        tally.distinctOther = otherSources.length
        return tally
    },

    /**
     * #79a. Validation used to be uncorrelated with evidential honesty: a
     * report that invented a citation passed, and one citing only what it
     * genuinely read could fail. Live proof (2026-08-02 re-run, audit-
     * verified): runs 100c8910... and ebdc4194... both cited `agent_config`
     * as evidence and both PASSED, having never invoked that tool.
     *
     * A citation passes if ANY tool that can produce that kind of evidence
     * appears in the run's audit trail. The map is deliberately PERMISSIVE —
     * the goal is to stop fabrication, not to add new pedantry, which is the
     * exact failure mode #78 exists to fix. `genai_log` supports `config`
     * because seed 03's answer (a dangling `api`) is found through it and is
     * legitimately configuration evidence; a strict 1:1 map would reject that
     * honest citation.
     *
     * Skipped entirely when the audit trail is unavailable — see
     * `_buildCheckContext`.
     */
    _checkCitationSupported: function (source, entryLabel, problems, ctx) {
        if (!ctx.auditEnabled) return

        var supporting = this._citationToolMap()[source]
        // An unknown source already raised its own problem above.
        if (!supporting) return
        if (this._anyInvoked(supporting, ctx)) return

        problems.push(
            entryLabel + ': unsupported citation — cites "' + source + '" but this run never invoked a ' +
                'tool that reads it (' + supporting.join(', ') + '). Either call one of those tools and ' +
                'cite what it actually returned, or drop the claim. Tools invoked this run: ' +
                this._invokedList(ctx) + '.'
        )
    },

    /**
     * #79a source -> tool map. Deliberately separate from `_layerToolMap`:
     * layers are finer-grained than the four evidence sources (2, 3 and 7 all
     * correspond to `config` but each is answered by a different section of
     * agent_config's output). `read_artifact` supports NONE of these sources:
     * it only pages an artifact a PRODUCING tool already wrote this run
     * (`PaToolRegistry.dispatch` / `PaScriptToolAdapter.invoke` both audit
     * that producing tool's `intent` before the call), so the producing tool
     * — already in this map — is what actually carries the support. Treating
     * `read_artifact` as a wildcard here would let a run pass every
     * cross-check on nothing but `agent_trace` + `read_artifact` (the
     * 2026-08-02 re-run's worst draft, see `_checkSweptClaims`).
     */
    _citationToolMap: function () {
        return {
            trace: ['agent_trace', 'genai_log', 'log_analysis'],
            config: ['agent_config', 'genai_log'],
            schema: ['schema_lookup'],
            data: ['query_table', 'log_analysis'],
        }
    },

    _anyInvoked: function (candidates, ctx) {
        for (var i = 0; i < candidates.length; i++) {
            if (this._indexOf(ctx.invokedTools, candidates[i]) !== -1) return true
        }
        return false
    },

    _invokedList: function (ctx) {
        return ctx.invokedTools.length > 0 ? ctx.invokedTools.join(', ') : 'none'
    },

    /**
     * The evidence rule, enforced structurally. Two ways to satisfy it:
     *
     *   (A) at least one 'trace' citation PLUS at least one config/schema/
     *       data citation — the original rule, untouched;
     *   (B) layer 1 UNAVAILABLE plus at least TWO DISTINCT non-trace sources
     *       — the absence-diagnosis path (#78).
     *
     * B is an ADDITIONAL route, never a replacement: A returns first, so
     * nothing that passes today can newly fail here. The rule's real content
     * is "one layer is a candidate, not a conclusion" — two independent
     * sources. B preserves that and relaxes only the PRIVILEGED STATUS of the
     * trace label, and only where the report has already declared no trace
     * exists. Seed 05 is why: the agent never ran, so there is no
     * sn_aia_execution_plan row, and a correct diagnosis of that absence was
     * structurally unreportable (issue #78 — the harness's one correct
     * diagnosis in the 2026-08-02 re-run was rejected by this method).
     *
     * A 'trace' citation under B is not rejected; it simply does not count
     * toward the two distinct sources.
     *
     * Every problem raised here contains the literal phrase "evidence rule"
     * (Task 4 brief, Step 1) and names the cause, so a repair prompt — or a
     * human — can find it without re-deriving which entry failed.
     */
    _checkEvidenceRule: function (evidence, label, causeName, problems, ctx) {
        var tally = this._checkEvidenceEntries(evidence, label + '.evidence', problems, ctx)

        // (A) — the original rule. Checked first so B can only ever widen.
        if (tally.hasTrace && tally.hasOther) return

        // (B) — the absence-diagnosis path.
        if (ctx.traceUnavailable) {
            if (tally.distinctOther >= 2) return
            problems.push(
                label + ' (' + causeName + '): evidence rule violation — layer 1 is UNAVAILABLE, so no ' +
                    'trace citation is required, but a diagnosis of an absence still needs corroboration. ' +
                    'Cite at least TWO DISTINCT sources from ' + this._nonTraceEvidenceSources().join('/') +
                    ' — found ' + tally.distinctOther + '. Two citations of the same source are one source.'
            )
            return
        }

        if (!tally.hasTrace) {
            problems.push(
                label + ' (' + causeName + '): evidence rule violation — no trace citation found; ' +
                    'a candidate resting on config/schema/data alone is not a confirmed root cause. If no ' +
                    'execution trace EXISTS for this target — nothing ever ran — mark layer 1 UNAVAILABLE ' +
                    'with a reason and cite two DISTINCT config/schema/data sources instead.'
            )
            return
        }

        problems.push(
            label + ' (' + causeName + '): evidence rule violation — evidence cites only the trace; ' +
                'at least one config, schema, or data citation is required'
        )
    },

    /**
     * True when the report is CLAIMING the inconclusive path — an empty
     * `root_causes` plus an `inconclusive` object. Whether that claim is
     * VALID is `_checkInconclusive`'s job; this predicate only decides
     * whether `fixes` may be empty and `verification` may be absent, so it
     * must NOT re-raise the problems that method already raises.
     */
    _isInconclusiveShape: function (report) {
        return (
            this._isArray(report.root_causes) &&
            report.root_causes.length === 0 &&
            this._isPlainObject(report.inconclusive)
        )
    },

    /**
     * The verification relaxation is narrower than `_isInconclusiveShape`: a
     * report that PROPOSES fixes still owes a verification step, even if it
     * named no root cause. Only a fix-less inconclusive report has nothing
     * to verify.
     */
    _isInconclusiveWithoutFixes: function (report) {
        return this._isInconclusiveShape(report) && this._isArray(report.fixes) && report.fixes.length === 0
    },

    /**
     * How many of the seven layers the report CLAIMS to have swept. Used to
     * price the inconclusive path: a claim to have swept a layer is a claim
     * to have looked at something, and looking at something is citable.
     */
    _countSweptLayers: function (report) {
        var ls = this._isPlainObject(report.layers_swept) ? report.layers_swept : {}
        var defs = this._layerDefs()
        var count = 0
        for (var i = 0; i < defs.length; i++) {
            var entry = ls[defs[i].number]
            if (this._isPlainObject(entry) && entry.status === 'SWEPT') count += 1
        }
        return count
    },

    /**
     * T4 (issue #72): an honest "I could not reach a conclusion" must be
     * expressible, or the only structurally valid output is an invented root
     * cause — which is pressure toward fabrication, not a validation floor.
     *
     * But it must be EARNED, not cheap. `layers_swept` is charged identically
     * on every path (`validate` runs `_checkLayersSwept` unconditionally), so
     * it is NOT by itself a differential cost on the inconclusive path — a
     * report claiming all seven layers SWEPT while citing only one thing in
     * `evidence_read` would otherwise validate. The actual price is the
     * `evidence_read` citations below, SIZED to the sweep claim: at least one
     * citation per layer marked SWEPT (`_countSweptLayers`). Claim seven
     * sweeps, cite seven things; honestly mark most layers NOT_SWEPT /
     * UNAVAILABLE with a reason and the citation bill drops with it. Writing
     * an honest inconclusive report should cost more than diagnosing a
     * defect the model actually found — not because of the layer report
     * (which every path pays), but because of this citation-per-claimed-
     * sweep pricing.
     *
     * NOTE the evidence RULE (trace PLUS one of config/schema/data) is
     * deliberately NOT applied to `evidence_read`: that array is a record of
     * what was READ, not a claim about a cause, and demanding a trace
     * citation from a run whose trace was unavailable is exactly the
     * pedantry this path exists to remove.
     */
    _checkInconclusive: function (report, problems, ctx) {
        var inc = report.inconclusive

        if (!this._isPlainObject(inc)) {
            problems.push(
                'root_causes is empty, which is allowed ONLY for an honest inconclusive report — and such a ' +
                    'report must carry an `inconclusive` object of {evidence_read, needed_to_conclude}. Either ' +
                    'name at least one root cause with evidence, or add that object. Do NOT invent a root cause ' +
                    'to satisfy this check.'
            )
            return
        }

        var ev = inc.evidence_read
        if (!this._isArray(ev) || ev.length === 0) {
            problems.push(
                'inconclusive.evidence_read is required and must be a non-empty array of {source, detail} ' +
                    'recording what you actually read — an uncited inconclusive report is not distinguishable ' +
                    'from not having looked'
            )
        } else {
            this._checkEvidenceEntries(ev, 'inconclusive.evidence_read', problems, ctx)

            var swept = this._countSweptLayers(report)
            if (ev.length < swept) {
                problems.push(
                    'inconclusive.evidence_read has ' + ev.length + ' citation(s) but layers_swept marks ' +
                        swept + ' layer(s) SWEPT — cite at least one piece of evidence per layer you claim to ' +
                        'have swept. If you did not actually sweep a layer, mark it NOT_SWEPT or UNAVAILABLE ' +
                        'with a reason rather than claiming it.'
                )
            }
        }

        if (!this._nonEmptyString(inc.needed_to_conclude)) {
            problems.push(
                'inconclusive.needed_to_conclude is required and must be a non-empty string naming what would ' +
                    'be needed to reach a conclusion'
            )
        }
    },

    _checkFixes: function (report, problems) {
        var fixes = report.fixes
        if (!this._isArray(fixes)) {
            problems.push('fixes is required and must be an array')
            return
        }
        if (fixes.length === 0) {
            // Empty `fixes` rides on the inconclusive path ONLY. A NAMED root
            // cause with nothing proposed is still a defect — the report
            // claims to know what broke and declines to say what to do.
            if (!this._isInconclusiveShape(report)) {
                problems.push('fixes must include at least one entry')
            }
            return
        }

        var targetTypes = this._fixTargetTypes()
        for (var i = 0; i < fixes.length; i++) {
            var fix = fixes[i]
            var label = 'fixes[' + i + ']'

            if (!this._isPlainObject(fix)) {
                problems.push(label + ' must be an object')
                continue
            }

            if (this._indexOf(targetTypes, fix.target_type) === -1) {
                problems.push(
                    label + ' has an invalid target_type (must be one of: ' + targetTypes.join(', ') + '), got: ' +
                        this._describe(fix.target_type)
                )
            }
            if (!this._nonEmptyString(fix.target)) problems.push(label + ' is missing target')
            if (!this._nonEmptyString(fix.proposed)) problems.push(label + ' is missing proposed')
            if (!this._nonEmptyString(fix.rationale)) problems.push(label + ' is missing rationale')
            // `current` may legitimately be an empty string (the current
            // value genuinely is blank) — only its TYPE is checked.
            if (typeof fix.current !== 'string') problems.push(label + ' current must be a string (may be empty)')
        }
    },

    _checkVerification: function (report, problems) {
        // Nothing to verify when no fix was proposed — demanding a string
        // here would only invite "n/a" boilerplate. Note this is narrower
        // than `_isInconclusiveShape`: an inconclusive report that DOES
        // propose fixes still owes a verification step.
        if (this._isInconclusiveWithoutFixes(report)) return

        if (!this._nonEmptyString(report.verification)) {
            problems.push('verification is required and must be a non-empty string')
        }
    },

    _checkDataMarkers: function (report, problems) {
        if (!this._isArray(report.data_markers)) {
            problems.push('data_markers is required and must be an array (it may be empty)')
        }
    },

    // =======================================================================
    // repairPrompt — the one allowed repair turn
    // =======================================================================

    /**
     * @param {*} report the invalid draft (whatever was passed to validate()).
     * @param {Array} problems the `problems` array validate() returned.
     * @returns {String} the problems verbatim + the required schema + the
     *          literal instruction to return corrected JSON only, WRAPPED in
     *          the `{"action":"fix_report","report":{...}}` response
     *          envelope. PaAgentLoop sends this through PaLlmProxy.reason()
     *          for exactly one retry.
     *
     * ENVELOPE INSTRUCTION — fix round, issue #64/#65 (live-caught on
     * gpinst01, Task 7 Step 4). Every earlier version of this prompt asked
     * only for "the corrected fix_report JSON" — the report object alone.
     * `PaLlmProxy.reason()` parses EVERY response, repair or not, against its
     * own strict `{"action":...}` contract (`_parseResponse`), so a model
     * that dutifully returns the bare (even perfectly corrected) report
     * object fails at THAT layer with "missing action key" — 3/3 live runs
     * against the Task 12 smoke specimen reproduced exactly this: the model
     * fixed every structural problem on repair, and the repair still failed,
     * because the prompt never told it to keep the envelope. The instruction
     * below is what closes that gap.
     */
    repairPrompt: function (report, problems) {
        var probs = this._isArray(problems) ? problems : []
        var lines = []

        lines.push(
            'The fix_report you returned failed validation. Fix every problem below and return the ' +
                'corrected fix_report JSON only.'
        )
        lines.push('')
        lines.push('Problems:')
        for (var i = 0; i < probs.length; i++) {
            lines.push('- ' + this._str(probs[i]))
        }
        lines.push('')
        lines.push('Required schema:')
        lines.push(this.schemaText())
        lines.push('')
        lines.push('Previous draft:')
        lines.push(this.renderJson(report))
        lines.push('')
        lines.push(
            'Respond with exactly one JSON object and nothing else — no prose, no markdown fence — wrapping the ' +
                'corrected report in the required response envelope: {"action":"fix_report","report":{...corrected ' +
                'report matching the schema above...}}. Do not return the report object by itself: the caller ' +
                'only accepts a fix_report submission wrapped in that envelope, exactly like every other action.'
        )

        return lines.join('\n')
    },

    /**
     * The fix_report JSON schema, in prose — the single source both
     * `repairPrompt` (above) and `PaAgentLoop`'s own first-attempt contract
     * block read from, so the required field names are authored in exactly
     * ONE place. Public (not `_schemaText`) precisely because it now has a
     * second caller outside this file (fix round, issue #64/#65) — see
     * PaAgentLoop.js's `_fixReportContract`/`_safeSchemaText`.
     *
     * EVERY FIELD'S TYPE IS STATED EXPLICITLY (fix round, issue #64/#65,
     * controller ruling on the third live-caught defect). Two of the three
     * live defects this task found were exactly this shape: the validator
     * enforces a type or key spelling the schema text never actually
     * states, and a model reasonably guesses wrong — root_causes[].layer
     * being rejected for arriving as the JSON number 1-7 rather than the
     * string "1"-"7" was the second occurrence of that class, not the
     * first. Rather than patch the one field, every field below now states
     * its type, so the next field with an unstated type is not the next bug
     * report.
     */
    schemaText: function () {
        var defs = this._layerDefs()
        var layerList = []
        for (var i = 0; i < defs.length; i++) {
            layerList.push(defs[i].number + '=' + defs[i].name)
        }

        var lines = []
        lines.push('failure_summary: non-empty string')
        lines.push(
            'layers_swept: object keyed 1-7 (' + layerList.join(', ') + '), each {status, reason?} — status is ' +
                'a string, one of ' + this._sweepStatuses().join('|') + '; reason is a non-empty string, ' +
                'REQUIRED when status is not SWEPT'
        )
        lines.push(
            'root_causes: array of {layer, component, finding, evidence, confidence?} — NON-EMPTY unless you ' +
                'supply the `inconclusive` object described below; layer is the ' +
                'layer number as a string "1".."7" (a bare JSON number 1-7 is also accepted and normalized to a ' +
                'string); component is a non-empty string naming the specific record/table/field; finding is a ' +
                'non-empty string describing what is wrong; evidence is a non-empty array of {source, detail} ' +
                'where source is a string, one of ' + this._evidenceSources().join('|') + ', and detail is a ' +
                'non-empty string citation (table, sys_id, field, or value); EVERY root cause needs at least one ' +
                '"trace" evidence entry PLUS at least one of ' + this._nonTraceEvidenceSources().join('|') +
                ' (the evidence rule) — UNLESS nothing ever ran, in which case see the absence rule below; ' +
                'confidence, if present, is a string (e.g. CONFIRMED or UNCONFIRMED)'
        )
        lines.push(
            'fixes: array of {target_type, target, current, proposed, rationale} — NON-EMPTY unless root_causes ' +
                'is empty and you supply `inconclusive`; target_type is a ' +
                'string, one of ' + this._fixTargetTypes().join('|') + '; target, proposed and rationale are ' +
                'each non-empty strings; current is a string and may be empty but must be present'
        )
        lines.push(
            'verification: non-empty string — may be omitted ONLY when root_causes is empty, `inconclusive` is ' +
                'present, AND fixes is ALSO empty; if you propose any fixes at all, verification is still ' +
                'required even on the inconclusive path'
        )
        lines.push('data_markers: array (may be empty, must be present)')
        lines.push(
            'inconclusive: OPTIONAL object {evidence_read, needed_to_conclude} — supply it ONLY when you could ' +
                'not isolate a cause. When present, root_causes may be an empty array, and fixes may also be ' +
                'empty; verification may be omitted ONLY when fixes is ALSO empty — if you propose any fixes, ' +
                'verification is still required even though root_causes is empty. evidence_read is a non-empty ' +
                'array of {source, detail} in the same shape as root_causes[].evidence, recording what you ' +
                'ACTUALLY read (the trace-plus-one evidence rule does NOT apply to it); needed_to_conclude is a ' +
                'non-empty string naming what would be required to conclude. evidence_read must contain AT LEAST ' +
                'AS MANY entries as the number of layers marked SWEPT in layers_swept — claim seven sweeps, cite ' +
                'seven things; mark a layer NOT_SWEPT or UNAVAILABLE with a reason instead and fewer citations ' +
                'are required. An honest inconclusive report is always preferred to an invented root cause. It ' +
                'does NOT excuse a shallow sweep: layers_swept must still report all seven layers with a reason ' +
                'on every one you did not sweep, and you should exhaust your tool budget before concluding you ' +
                'cannot tell.'
        )
        lines.push(
            'EVIDENCE IS CHECKED AGAINST WHAT YOU ACTUALLY CALLED. Every citation source is verified ' +
                'against the tools this run actually invoked. Citing a source you did not read with a tool ' +
                'in THIS run is rejected — trace comes from agent_trace/genai_log/log_analysis, config from ' +
                'agent_config/genai_log, schema from schema_lookup, data from query_table/log_analysis. ' +
                'read_artifact does NOT count on its own — cite the tool whose output you paged. Do not ' +
                'label evidence you did not gather.'
        )
        lines.push(
            'A LAYER MARKED SWEPT NEEDS A TOOL CALL BEHIND IT. layers_swept entries marked SWEPT are ' +
                'verified independently, against the tools this run invoked: claiming a layer you never ran ' +
                'a tool against is rejected. Marking a layer NOT_SWEPT or UNAVAILABLE with an honest reason is ' +
                'always acceptable and costs you nothing — an inflated sweep claim costs you the whole report.'
        )
        lines.push(
            'IF NOTHING EVER RAN, SAY SO — you do not need a trace citation. When there is no execution ' +
                'to trace (the agent never fired, so no execution plan exists), mark layer 1 UNAVAILABLE ' +
                'with the reason and cite two distinct sources from ' +
                this._nonTraceEvidenceSources().join('/') + ' instead. Two citations of the same source ' +
                'are one source. This is a fully acceptable root cause — do NOT invent a trace citation to ' +
                'satisfy the evidence rule.'
        )

        return lines.join('\n')
    },

    // =======================================================================
    // Rendering — both take the SAME normalized report
    // =======================================================================

    /**
     * @param {Object} normalized the object validate() returned as `normalized`.
     * @returns {String} markdown with the six playbook section headings, in
     *          playbook order, plus a seventh INCONCLUSIVE section between
     *          LAYERS SWEPT and ROOT CAUSES when the report took that path.
     *          Defensive against a sparse/missing object (R-9) — this is a
     *          rendering path, not a second validation.
     */
    renderMarkdown: function (normalized) {
        var r = this._isPlainObject(normalized) ? normalized : {}
        var lines = []

        lines.push('## FAILURE SUMMARY')
        lines.push('')
        lines.push(this._nonEmptyString(r.failure_summary) ? r.failure_summary : '(not provided)')
        lines.push('')

        lines.push('## LAYERS SWEPT')
        lines.push('')
        var ls = this._isPlainObject(r.layers_swept) ? r.layers_swept : {}
        var defs = this._layerDefs()
        for (var i = 0; i < defs.length; i++) {
            var def = defs[i]
            var entry = this._isPlainObject(ls[def.number]) ? ls[def.number] : {}
            var status = this._nonEmptyString(entry.status) ? entry.status : 'UNKNOWN'
            var line = def.number + '. ' + def.name + ': ' + status
            if (status !== 'SWEPT' && this._nonEmptyString(entry.reason)) {
                line += ' — ' + entry.reason
            }
            lines.push(line)
        }
        lines.push('')

        // Rendered only when present — a normal report is byte-identical to
        // before. Placed after LAYERS SWEPT because it explains the sweep the
        // reader has just looked at, before the (empty) causes below.
        var inc = this._isPlainObject(r.inconclusive) ? r.inconclusive : null
        if (inc) {
            lines.push('## INCONCLUSIVE')
            lines.push('')
            lines.push('evidence read:')
            var read = this._isArray(inc.evidence_read) ? inc.evidence_read : []
            if (read.length === 0) {
                lines.push('  (none)')
            } else {
                for (var p = 0; p < read.length; p++) {
                    var re = this._isPlainObject(read[p]) ? read[p] : {}
                    lines.push('  - ' + this._str(re.source) + ': ' + this._str(re.detail))
                }
            }
            lines.push('needed to conclude: ' + this._str(inc.needed_to_conclude))
            lines.push('')
        }

        lines.push('## ROOT CAUSES')
        lines.push('')
        var rcs = this._isArray(r.root_causes) ? r.root_causes : []
        if (rcs.length === 0) lines.push('(none)')
        for (var j = 0; j < rcs.length; j++) {
            var rc = this._isPlainObject(rcs[j]) ? rcs[j] : {}
            lines.push((j + 1) + '. layer: ' + this._str(rc.layer))
            lines.push('   component: ' + this._str(rc.component))
            lines.push('   finding: ' + this._str(rc.finding))
            lines.push('   evidence:')
            var ev = this._isArray(rc.evidence) ? rc.evidence : []
            for (var k = 0; k < ev.length; k++) {
                var e = this._isPlainObject(ev[k]) ? ev[k] : {}
                lines.push('     - ' + this._str(e.source) + ': ' + this._str(e.detail))
            }
            lines.push('   confidence: ' + this._str(rc.confidence))
            lines.push('')
        }

        lines.push('## FIXES')
        lines.push('')
        var fixes = this._isArray(r.fixes) ? r.fixes : []
        if (fixes.length === 0) lines.push('(none)')
        for (var m = 0; m < fixes.length; m++) {
            var f = this._isPlainObject(fixes[m]) ? fixes[m] : {}
            lines.push((m + 1) + '. target type: ' + this._str(f.target_type))
            lines.push('   target: ' + this._str(f.target))
            lines.push('   current: ' + this._str(f.current))
            lines.push('   proposed: ' + this._str(f.proposed))
            lines.push('   rationale: ' + this._str(f.rationale))
            lines.push('')
        }

        lines.push('## VERIFICATION')
        lines.push('')
        lines.push(
            this._nonEmptyString(r.verification)
                ? r.verification
                : inc
                  ? '(not applicable — inconclusive)'
                  : '(not provided)'
        )
        lines.push('')

        lines.push('## DATA MARKERS')
        lines.push('')
        var markers = this._isArray(r.data_markers) ? r.data_markers : []
        if (markers.length === 0) {
            lines.push('(none)')
        } else {
            for (var n = 0; n < markers.length; n++) {
                lines.push('- ' + this._str(markers[n]))
            }
        }

        return lines.join('\n')
    },

    /**
     * @param {*} normalized
     * @returns {String} JSON.stringify(normalized, null, 2); '{}' on a
     *          pathological input rather than a thrown error (R-1/R-9).
     */
    renderJson: function (normalized) {
        try {
            return JSON.stringify(normalized === undefined ? null : normalized, null, 2)
        } catch (e) {
            // R-1: `e` deliberately not inspected.
            return '{}'
        }
    },

    // =======================================================================
    // Internals
    // =======================================================================

    _isPlainObject: function (value) {
        return (
            value !== null &&
            value !== undefined &&
            typeof value === 'object' &&
            !this._isArray(value)
        )
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

    _indexOf: function (arr, value) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === value) return i
        }
        return -1
    },

    _describe: function (value) {
        if (value === undefined) return 'undefined'
        if (value === null) return 'null'
        if (typeof value === 'string') return '"' + value + '"'
        try {
            return JSON.stringify(value)
        } catch (e) {
            // R-1: `e` deliberately not inspected.
            return String(value)
        }
    },

    _str: function (value) {
        if (value === null || value === undefined) return ''
        return String(value)
    },

    /**
     * Deep copy via JSON round-trip — the report is already plain JSON data
     * (it came from PaLlmProxy's strict-JSON parse), so this is safe in the
     * normal case. Falls back to the original reference rather than throwing
     * on a pathological input (R-1: the catch does not inspect what failed).
     */
    _clone: function (value) {
        try {
            return JSON.parse(JSON.stringify(value))
        } catch (e) {
            // R-1: `e` deliberately not inspected.
            return value
        }
    },

    type: 'PaFixReport',
}
