/**
 * PaRunAnchor — the diagnostic run record for the current conversation
 * (LOW_LEVEL_DESIGN.md §4.6).
 *
 * WHAT THIS EXISTS FOR
 * Everything else in the system hangs off one record. Artifacts are attachments
 * on it (§4.5). Audit rows reference it (§3.2). Benchmark scoring counts it. So
 * the whole question this component answers is: *for this tool call, which run
 * record is it?* — and the expensive way to get that wrong is not to fail, it is
 * to answer with the WRONG record and keep going.
 *
 * CONTRACT
 *   getOrCreate(context) -> {run_id, number, created, keyed, key_source,
 *                            conversation_id, execution_ref, harness, note?}
 *                         | {run_id:null, degraded:<reason>, ...}
 *   readNativeContext()  -> {present, conversation_id, execution_plan_id,
 *                            agent_id, usecase_id}
 *
 * `context` is optional and every field in it is optional (R-9). It may be an
 * Object, a JSON string, or absent — in the ordinary native case it IS absent,
 * and the ambient `_agentic_context_` supplies everything.
 *
 * ---------------------------------------------------------------------------
 * HOW THE KEY IS CHOSEN, AND WHY THERE IS NO THIRD OPTION
 * ---------------------------------------------------------------------------
 *
 * 1. conversation id — `_agentic_context_.conversation_id`, or an explicit
 *    override. R-2 measured it identical across all 19 tool calls of one
 *    conversation, and matching `sn_aia_execution_plan.conversation`. This is
 *    the key.
 * 2. execution plan id — finer-grained, used only when there is no conversation
 *    id. One conversation spanning two plans splits into two runs under it,
 *    which is worse than the conversation key but still correct.
 * 3. Nothing. A fresh, isolated run for this call alone.
 *
 * There is deliberately no fourth option, and in particular **no time-window
 * key**. R-2 did not merely discourage "one anchor per user per 30 minutes" —
 * it deleted it from the design so it cannot be reached by accident. The reason
 * is specific: a time-window anchor interleaves two benchmark runs onto one run
 * record, which lets run 2 read run 1's artifacts and destroys the blind-run
 * independence the doubled-run protocol exists to measure (DESIGN.md §2.4). A
 * contaminated scorecard does not look contaminated. `gs.getSessionID()` is out
 * for the same family of reason — R-2 found it returns the literal `"SYSTEM"`,
 * so it collides across every conversation on the instance.
 *
 * Case 3 therefore isolates rather than merging. It costs a stray run record per
 * unkeyed call; the alternative costs a silently wrong benchmark.
 *
 * ---------------------------------------------------------------------------
 * CONCURRENCY — why the create path reads twice
 * ---------------------------------------------------------------------------
 * R-3 found the ReAct loop issues up to FOUR tool calls in a single timestamp
 * batch, not one at a time. Each one calls getOrCreate, and all four can miss
 * the lookup before any of them inserts. There is no atomic upsert available
 * here, so convergence is bought after the fact: insert, then re-resolve the
 * key and adopt the deterministic winner (oldest `sys_created_on`, `sys_id` as
 * tie-break — and ties are the NORMAL case, since `sys_created_on` is
 * second-granular and a batch lands inside one second). Every member of the
 * batch then returns the same record.
 *
 * The losers' rows are left in place rather than deleted. An empty extra run is
 * visible and harmless; deleting a record another thread may be mid-write on,
 * to tidy up, is where the real bug would be.
 *
 * ---------------------------------------------------------------------------
 * STANDING RULES THIS FILE IS BUILT AROUND
 * ---------------------------------------------------------------------------
 *
 * R-1  Never touch the exception object in a catch. A cross-scope denial throws
 *      ScopeAccessNotGrantedException and reading `.message` off it throws
 *      AGAIN, escaping the handler and 500ing the request. Every catch here
 *      names its own reason and moves on.
 * R-2  See above. No time-window keying, anywhere, ever.
 * R-6  A wrong field name returns a blank, not an error. Values are normalised
 *      and shape-checked before they are written, so a blank in this table
 *      means "absent", never "written wrong".
 * R-9  Every input may be absent. No argument is mandatory; the native harness
 *      demonstrably fails to pass declared inputs.
 * R-10 Degrade explicitly with a named reason. A null `run_id` with a stated
 *      `degraded` beats a run id pointing at the wrong conversation.
 *
 * Build Rule #42: writes here use plain `GlideRecord`, not `GlideRecordSecure`.
 * A Fluent `Table()` installs with ZERO ACLs, so the secure variant would deny
 * this app write access to its own table while the plain server-side path keeps
 * working. That is not a shortcut — it is the only path that functions.
 */
var PaRunAnchor = Class.create()

PaRunAnchor.prototype = {
    RUN_TABLE: 'x_snc_troubleshoot_run',

    /**
     * ChoiceColumn vocabularies from tables.now.ts — anything else is junk.
     *
     * Arrays and an indexOf check, NOT an object used as a lookup map. An
     * object would answer truthy for `constructor`, `toString`, `valueOf` and
     * every other name on Object.prototype, so an agent that passed
     * `harness: "constructor"` would have that written straight into the choice
     * field. The values here are caller-supplied and this is a two-element set;
     * there is no reason to take the hazard.
     */
    HARNESSES: ['native', 'custom'],
    MODES: ['diagnose', 'collect'],

    DEFAULT_HARNESS: 'native',
    DEFAULT_MODE: 'diagnose',

    /** §4.6: native runs are created `running`, not `queued`. */
    DEFAULT_STATUS: 'running',

    /**
     * @param {Object} [options] {runTable} — override for tests.
     */
    initialize: function (options) {
        if (!options) return
        if (options.runTable) this.RUN_TABLE = String(options.runTable)
    },

    // =======================================================================
    // readNativeContext — R-2's undocumented global
    // =======================================================================

    /**
     * `_agentic_context_` is a global an AI Agent script tool receives. It is a
     * JSON **string**, not an object (R-2) — the single most common way to get
     * this wrong is to dot into it directly and read `undefined` off a string.
     * It is also undocumented, so it is not contractually stable across
     * upgrades, and R-2's closure is API-path-provisional: it was observed via
     * `servicenow_aia_execute`, not the Now Assist panel. Everything here treats
     * its absence as ordinary rather than exceptional.
     *
     * @returns {Object} normalised fields; `present` false if there was nothing
     *          usable to read.
     */
    readNativeContext: function () {
        var empty = {
            present: false,
            conversation_id: '',
            execution_plan_id: '',
            agent_id: '',
            usecase_id: '',
        }

        if (typeof _agentic_context_ === 'undefined' || _agentic_context_ === null) return empty

        var raw = _agentic_context_
        var parsed = null

        if (typeof raw === 'string') {
            try {
                parsed = JSON.parse(raw)
            } catch (e) {
                // R-1: `e` deliberately not inspected. Malformed context is a
                // missing key, not a fault to report — the call still works.
                return empty
            }
        } else if (typeof raw === 'object') {
            parsed = raw
        }

        // `JSON.parse('"a string"')` yields a string, not a context.
        if (!parsed || typeof parsed !== 'object') return empty

        return {
            present: true,
            conversation_id: this._norm(parsed.conversation_id),
            execution_plan_id: this._norm(parsed.execution_plan_id),
            agent_id: this._norm(parsed.agent_id),
            usecase_id: this._norm(parsed.usecase_id),
        }
    },

    // =======================================================================
    // getOrCreate
    // =======================================================================

    /**
     * @param {Object|String} [context] {harness, conversationId, executionRef,
     *        agentId, mode, userId} — all optional, ambient global fills gaps.
     * @returns {Object} see CONTRACT above
     */
    getOrCreate: function (context) {
        var ctx = this._normContext(context)
        var native = this.readNativeContext()

        // THE AMBIENT CONTEXT WINS ON IDENTITY (security review, PR #21).
        //
        // This used to be `ctx.x || native.x` — caller first, unconditionally.
        // That was a liberty, and the wrong one: LLD §4.6 says the native key
        // *is* `_agentic_context_.conversation_id`, and the platform supplies
        // that global itself. Letting a caller override it means a native tool
        // call can name ANY conversation and be handed that conversation's run
        // record — its artifacts, its audit trail — which is the R-2 merge
        // reintroduced through the front door, and the caller's input is partly
        // LLM-derived.
        //
        // So when the platform tells us who we are, it wins. Caller-supplied
        // identity is honoured only where there is no ambient context to
        // contradict it — the custom harness (§4.6: "custom: explicit run_id"),
        // tests, and the self-test route. `harness` and `mode` stay
        // caller-first: they are configuration, not identity.
        var conversationId = native.conversation_id || ctx.conversationId
        var executionRef = native.execution_plan_id || ctx.executionRef
        var agentId = native.agent_id || ctx.agentId

        // Did the KEY come from the caller rather than the platform? Only that
        // case needs the ownership check below.
        var keyFromCaller = !native.present

        var harness = this._oneOf(ctx.harness, this.HARNESSES, this.DEFAULT_HARNESS)
        var mode = this._oneOf(ctx.mode, this.MODES, this.DEFAULT_MODE)

        // The key, chosen once and reported to the caller either way.
        var keyField = null
        var keyValue = ''
        var keySource = null
        if (conversationId) {
            keyField = 'conversation_ref'
            keyValue = conversationId
            keySource = 'conversation'
        } else if (executionRef) {
            keyField = 'execution_ref'
            keyValue = executionRef
            keySource = 'execution'
        }

        var base = {
            keyed: keySource !== null,
            key_source: keySource,
            conversation_id: conversationId,
            execution_ref: executionRef,
            harness: harness,
        }

        if (typeof GlideRecord === 'undefined') {
            return this._degraded(base, 'glide_unavailable')
        }

        // --- get --------------------------------------------------------
        // Only ever with a key. A keyless query matches every run on the
        // table, and the first row it found would silently become this
        // conversation's anchor — the exact merge R-2 exists to prevent.
        //
        // Ownership filtering applies ONLY when the key came from the caller.
        // Never on the ambient path: a false rejection there would split a
        // native conversation across several runs — the bug this component
        // exists to prevent — and the native runtime's identity surface is not
        // something we can verify until Task 10 (R-2 already found
        // `gs.getSessionID()` returns the literal "SYSTEM" there).
        var keyRejected = false
        if (keyField) {
            var existing = this._resolve(keyField, keyValue, keyFromCaller)
            keyRejected = existing.skipped > 0
            if (existing.record) {
                return this._withRejection(this._found(base, existing.record, false), keyRejected)
            }
            // Nothing of ours under this key — fall through and create one,
            // keyed the same way. The next call from THIS user resolves to it,
            // so legitimate use still converges; only cross-user adoption is
            // refused.
        }

        // --- create -----------------------------------------------------
        var mine = this._insert({
            harness: harness,
            mode: mode,
            conversationId: conversationId,
            executionRef: executionRef,
            agentId: agentId,
        })

        if (!mine) return this._degraded(base, 'insert_failed')

        if (!keyField) {
            var unkeyed = this._found(base, mine, true)
            unkeyed.note =
                'No conversation id and no execution plan id were available, so this run is ' +
                'keyed on nothing and is used for THIS tool call only — a later call will get a ' +
                'different run. Anchors are never shared on a time window, because merging two ' +
                'diagnostic runs onto one record lets the second read the first run evidence.'
            return unkeyed
        }

        // Re-resolve so a concurrent batch converges — see the header. Carries
        // the same ownership filter, or the run we just refused wins this
        // lookup by age and gets adopted one step after being rejected.
        var winner = this._resolve(keyField, keyValue, keyFromCaller).record
        var out = winner
            ? this._found(base, winner, winner.run_id === mine.run_id)
            : this._found(base, mine, true)

        return this._withRejection(out, keyRejected)
    },

    // =======================================================================
    // Internals
    // =======================================================================

    /**
     * Deterministic winner for a key: oldest first, `sys_id` breaking the tie.
     * The tie-break is load-bearing, not defensive — `sys_created_on` has
     * second granularity and a concurrent batch lands inside one second, so
     * ordering on it alone leaves the winner up to row order.
     *
     * @param {Boolean} [ownedOnly] skip runs belonging to another user. Set on
     *        the caller-supplied-key path only. It must also be set on the
     *        re-resolve after an insert, or the refused foreign run — which is
     *        older, and therefore wins the ordering — gets adopted one line
     *        after being rejected, and the check achieves nothing.
     * @returns {Object} {record: {run_id, number}|null, skipped: Number} —
     *          `skipped` counts foreign runs passed over, which is how the
     *          caller learns the key is contested even when it did find one of
     *          its own.
     */
    _resolve: function (keyField, keyValue, ownedOnly) {
        var out = { record: null, skipped: 0 }
        try {
            var gr = new GlideRecord(this.RUN_TABLE)
            gr.addQuery(keyField, keyValue)
            // Ordering reaches the DATABASE, before any limit is applied
            // (R-17: sorting a page that was already chosen sorts the wrong
            // rows and mislabels the result).
            gr.orderBy('sys_created_on')
            gr.orderBy('sys_id')
            gr.query()
            while (gr.next()) {
                if (ownedOnly && !this._ownedByCurrentUser(gr.getValue('user'))) {
                    // Skipped, not stopped on: this user's own run for the same
                    // key may be further down the list. Stopping here would
                    // create a new run on every call and turn the ownership
                    // check into the scatter bug it is meant to avoid.
                    out.skipped++
                    continue
                }
                out.record = { run_id: gr.getValue('sys_id'), number: gr.getValue('number') }
                return out
            }
            return out
        } catch (e) {
            // R-1: `e` untouched. A failed lookup means "create one", which is
            // safe — the worst case is a duplicate run, never a merged one.
            return { record: null, skipped: 0 }
        }
    },

    /** @returns {Object|null} {run_id, number} */
    _insert: function (fields) {
        try {
            var gr = new GlideRecord(this.RUN_TABLE)
            gr.initialize()
            gr.setValue('harness', fields.harness)
            gr.setValue('status', this.DEFAULT_STATUS)
            gr.setValue('mode', fields.mode)
            gr.setValue('conversation_ref', fields.conversationId)
            gr.setValue('execution_ref', fields.executionRef)

            // `agent` is a cross-scope ReferenceColumn into sn_aia_agent. A
            // name written into it dangles and reads back BLANK — a blank
            // masquerading as data, which is precisely R-6's complaint. Only a
            // value shaped like a sys_id goes in; anything else is dropped,
            // and the agent stays discoverable through execution_ref anyway.
            if (this._isSysId(fields.agentId)) gr.setValue('agent', fields.agentId)

            // Server-authoritative, never caller-supplied (security review, PR
            // #21). This field is what the ownership check reads, so a caller
            // able to set it could plant a run stamped with someone else's id —
            // which would turn the check into an attack surface instead of a
            // defence.
            var userId = this._currentUser()
            if (userId) gr.setValue('user', userId)

            var sysId = gr.insert()
            if (!sysId) return null
            return { run_id: String(sysId), number: gr.getValue('number') }
        } catch (e) {
            // R-1: `e` untouched.
            return null
        }
    },

    _found: function (base, record, created) {
        return {
            run_id: record.run_id,
            number: record.number || '',
            created: created,
            keyed: base.keyed,
            key_source: base.key_source,
            conversation_id: base.conversation_id,
            execution_ref: base.execution_ref,
            harness: base.harness,
        }
    },

    /**
     * R-10: the caller learns the anchor is gone AND which conversation lost
     * it, so a downstream `no_run_anchor` from PaArtifactStore is attributable
     * to something rather than being an anonymous blank.
     */
    _degraded: function (base, reason) {
        return {
            run_id: null,
            number: '',
            created: false,
            keyed: base.keyed,
            key_source: base.key_source,
            conversation_id: base.conversation_id,
            execution_ref: base.execution_ref,
            harness: base.harness,
            degraded: reason,
            note:
                'No diagnostic run record could be established (' +
                reason +
                '), so artifacts cannot be stored for this call and audit rows will not be ' +
                'linked to a run. Findings are still valid; the evidence trail behind them is not durable.',
        }
    },

    /** R-9: context may be an Object, a JSON string, junk, or absent. */
    _normContext: function (context) {
        var raw = context
        if (typeof raw === 'string') {
            try {
                raw = JSON.parse(raw)
            } catch (e) {
                // R-1: `e` untouched.
                raw = null
            }
        }
        if (!raw || typeof raw !== 'object') raw = {}

        return {
            harness: this._norm(raw.harness),
            mode: this._norm(raw.mode),
            conversationId: this._norm(raw.conversationId || raw.conversation_id),
            executionRef: this._norm(raw.executionRef || raw.execution_ref),
            agentId: this._norm(raw.agentId || raw.agent_id),
            userId: this._norm(raw.userId || raw.user_id),
        }
    },

    /**
     * LLD §4: real rows carry the literal string `"undefined"` in reference
     * fields, and it is TRUTHY. Treat it, `"null"`, `''`, null and undefined
     * alike as empty — otherwise the anchor happily keys a whole conversation
     * on the four-letter word "null".
     */
    _norm: function (value) {
        if (value === null || value === undefined) return ''
        var s = String(value)
        if (s === '' || s === 'undefined' || s === 'null') return ''
        return s
    },

    /** R-10: a contested key is stated, never silently worked around. */
    _withRejection: function (result, rejected) {
        if (!rejected) return result
        result.key_rejected = true
        result.note =
            'A run already exists under this key but belongs to another user, and was not ' +
            'adopted — this call uses a run of its own. Diagnostic runs are never shared across ' +
            'users: adopting one would hand over its artifacts and its audit trail.'
        return result
    },

    /**
     * Fails OPEN on "cannot tell", CLOSED on "can tell, and it is not you".
     *
     * A run with no recorded owner cannot have its ownership violated, and a
     * caller we cannot identify must not be handed an invented denial — in
     * both cases a false rejection costs a split anchor, which is the failure
     * this whole component exists to prevent. The check earns its place on the
     * one case it can actually decide: a run stamped with a different user.
     */
    _ownedByCurrentUser: function (runUser) {
        var owner = this._norm(runUser)
        if (!owner) return true
        var me = this._currentUser()
        if (!me) return true
        return owner === me
    },

    /** Membership by scan — see the note on HARNESSES for why not a map. */
    _oneOf: function (value, allowed, fallback) {
        for (var i = 0; i < allowed.length; i++) {
            if (allowed[i] === value) return value
        }
        return fallback
    },

    _isSysId: function (value) {
        var s = this._norm(value)
        return s.length === 32 && /^[0-9a-f]{32}$/i.test(s)
    },

    _currentUser: function () {
        try {
            var id = gs.getUserID()
            return this._norm(id)
        } catch (e) {
            // R-1: `e` untouched.
            return ''
        }
    },

    type: 'PaRunAnchor',
}
