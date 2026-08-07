/**
 * PaToolAgentConfig — AI Agent definition inspection (LOW_LEVEL_DESIGN.md §4.2).
 *
 * The layer-2/3/7 half of the diagnosis. Where PaToolAgentTrace answers "what
 * happened", this answers "what was it configured to do": instructions, the
 * attached tools and their contracts, and the trigger wiring that decides
 * whether the agent ever runs at all.
 *
 * CONTRACT (LLD §4): execute(args) -> {success: true, data: Object}
 *                                  | {success: false, error: String}
 * Read-only. All reads GlideRecordSecure, through PaToolReadKit.
 *
 * ---------------------------------------------------------------------------
 * STANDING RULES THIS FILE IS BUILT AROUND
 * ---------------------------------------------------------------------------
 *
 * R-1   NEVER touch the exception object in a cross-scope catch — reading
 *       `.message` off a ScopeAccessNotGrantedException throws AGAIN and kills
 *       the request. Every catch is inside PaToolReadKit, plus the phase-named
 *       one at the bottom of execute().
 *
 * R-6   A wrong field name returns rows with the field silently ABSENT, so a
 *       blank must never be reported as absence. Every read asserts field
 *       presence; where a name is genuinely unverified (the two Global-scope
 *       access tables) the field list is PROBED against the table rather than
 *       guessed — and that probe earned its keep: the mapping table's join
 *       column is `agent_access_config`, which none of the first five guesses
 *       matched.
 *
 * R-9   Every declared input may be absent — the Phase 0 probe agent passed a
 *       declared input in zero runs while its reasoning text claimed it had. No
 *       argument is mandatory; no argument at all returns an agent pick-list.
 *
 * R-18a THE TRIGGER TRAVERSAL, and it has already been written backwards once.
 *       This tool starts from an AGENT, so `sn_aia_trigger_agent_usecase_m2m`
 *       is keyed on `related_resource_record` — NOT on `trigger_configuration`,
 *       which we do not have a value for at this point and which also skips the
 *       agent-direct rows. BOTH branches are walked: agent-direct, and the
 *       team/usecase chain. Branch 2 held 5 of 6 sampled rows on gpinst01, so
 *       an implementation walking only branch 1 reports a wired agent as
 *       unwired — a blank, not an error.
 *
 * R-18a WHAT THE ACCESS CHECK MAY CLAIM. The platform enforces two independent
 *       gates (User Access, Data Access) and the invoking role must satisfy
 *       both — that is real. What the TOOL cannot do is say which gate a role
 *       row belongs to, because no structural field records it; the split is
 *       conventional, carried in free-text `description`. So: one combined role
 *       set, each row's description included, the heuristic stated. Never two
 *       verified lists, and never "both lists check out".
 *
 * R-7/R-16 `context_processing_script` and `applicability_script` are read from
 *       BOTH `sn_aia_agent` AND `sn_aia_usecase`. The field exists on both, the
 *       platform populates the agent's copy whether you want it or not, and the
 *       live gpinst01 specimen threw in the AGENT's copy. Reading one side
 *       misses half the failure surface.
 *
 * ---------------------------------------------------------------------------
 * WHY SCRIPT BODIES AND INSTRUCTIONS ARE NOT DIGESTED TO 200 CHARS
 * ---------------------------------------------------------------------------
 * PaToolAgentTrace digests everything, which is right for a trace: the payloads
 * are scratchpads and the evidence is the shape of the run. Here the instruction
 * text and the script bodies ARE the evidence — seed 01's layer-3 diagnosis
 * turns on a tool script, and R-16's specimen on a context_processing_script.
 * Digesting them would also put them out of reach permanently: the artifact
 * store offloads the RESULT OBJECT, not the source record, so a 200-char digest
 * means the full body never reaches the artifact either. They are carried up to
 * BODY_CHARS with the true length stated, and the adapter's threshold offloads
 * the whole result for read_artifact to page.
 */
var PaToolAgentConfig = Class.create()

PaToolAgentConfig.prototype = {
    SECTIONS: ['overview', 'instructions', 'tools', 'triggers'],

    /** Digest ceiling for incidental values (descriptions, conditions). */
    DIGEST_CHARS: 200,

    /** Ceiling for evidence-bearing bodies — see the header. */
    BODY_CHARS: 20000,

    MAX_AGENTS: 20,
    MAX_USECASES: 20,
    MAX_TEAMS: 20,
    MAX_TOOLS: 50,
    MAX_TRIGGER_LINKS: 25,
    MAX_ROLE_ROWS: 50,
    MAX_ROLE_NAMES: 20,
    MAX_USER_ROLES: 200,

    /** Lexical overlap at or above which two tool descriptions are a consolidation candidate. */
    OVERLAP_THRESHOLD: 0.6,

    /**
     * @param {Object} [options] {readKit} — injection point for tests.
     */
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

    /**
     * @param {Object|String} [args] {agent?, section?}. May be a JSON string
     *        (the native runtime shape), a bare sys_id, a bare name, or nothing.
     * @returns {Object} {success: true, data: {...}} | {success: false, error: String}
     */
    execute: function (args) {
        // The phase localises a failure WITHOUT reading the exception (R-1).
        var phase = 'normalize_args'

        try {
            var k = this._k()
            var a = this._normalizeArgs(args)
            var data = k.newData('PaToolAgentConfig', 'sections-1')

            if (a._parse_error) {
                data.notes.push(
                    'Arguments arrived as a string that looked like JSON but did not parse. ' +
                        'Proceeding as if no arguments were supplied.'
                )
            }

            if (a._prefix_stripped) {
                // LOUDLY (issues #111, #122). Repairing this silently would
                // make the call work and erase the only evidence that the
                // model is malforming arguments — which is how it went
                // unnoticed for a whole smoke: every measure counted which
                // tools were invoked, and this one was.
                data.notes.push(
                    'The argument arrived as "' +
                        a._prefix_stripped +
                        '" — the parameter name prefixed onto its own value. It was read as ' +
                        'the value alone. Send the value on its own, or a JSON object, and note ' +
                        'that this call is recorded in the audit trail as it was sent, not as it ' +
                        'was repaired.'
                )
            }

            data.resolution = {
                requested: { agent: a.agent || null, section: a.section || null },
            }

            phase = 'resolve_sections'
            var sections = this._resolveSections(a, data)

            phase = 'resolve_target'
            var target = this._resolveTarget(a, data)
            data.resolution.mode = target.mode
            data.resolution.matched_agents = target.matched_agents
            data.resolution.matched_usecases = target.matched_usecases
            data.resolution.candidates = target.candidates
            if (target.name_collision_usecases) {
                data.resolution.name_collision_usecases = target.name_collision_usecases
            }
            data.resolution.agent = target.agent
            data.resolution.note = target.note

            if (!target.agent_sys_id && !target.usecase_ids.length) {
                data.sections_returned = []
                data.evidence_basis = this._evidenceBasis(data)
                return { success: true, data: data }
            }

            data.sections_returned = sections

            // One context, filled lazily, so a single-section call does not pay
            // for reads it will not render.
            var ctx = {
                agent_sys_id: target.agent_sys_id,
                agent_row: target.agent_row,
                seed_usecases: target.seed_usecases || [],
                usecases: null,
                teams: null,
                bindings: null,
                trigger_links: null,
            }

            if (this._wants(sections, 'overview')) {
                phase = 'overview'
                data.overview = this._overview(ctx, data)
            }
            if (this._wants(sections, 'instructions')) {
                phase = 'instructions'
                data.instructions = this._instructions(ctx, data)
            }
            if (this._wants(sections, 'tools')) {
                phase = 'tools'
                data.tools = this._tools(ctx, data)
            }
            if (this._wants(sections, 'triggers')) {
                phase = 'triggers'
                data.triggers = this._triggers(ctx, data)
            }

            phase = 'finalize'
            data.evidence_basis = this._evidenceBasis(data, ctx)

            return { success: true, data: data }
        } catch (e) {
            // R-1: the exception object is deliberately NOT read.
            return {
                success: false,
                error:
                    'PaToolAgentConfig failed during phase "' +
                    phase +
                    '". Exception detail deliberately not read — see DESIGN.md R-1 ' +
                    '(reading a ScopeAccessNotGrantedException throws again and kills the request).',
            }
        }
    },

    // =======================================================================
    // Field lists
    //
    // Everything below was verified against sys_dictionary on gpinst01 by the
    // R-18 pass (all 16 on sn_aia_agent, all 14 on sn_aia_agent_tool_m2m, all 9
    // on sn_aia_tool, all 10 on sn_aia_usecase, all 14 on
    // sn_aia_trigger_configuration). Names NOT on that list are probed at
    // runtime rather than requested — see _probeFields.
    // =======================================================================

    AGENT_FIELDS: [
        'sys_id',
        'name',
        'internal_name',
        'description',
        'role',
        'instructions',
        'proficiency',
        'inputs',
        'outputs',
        'strategy',
        'channel',
        'agent_type',
        'advanced_mode',
        'context_processing_script',
        'applicability_script',
        'condition',
        'compiled_handbook',
        'sys_created_on',
        'sys_updated_on',
    ],
    AGENT_DISPLAY: ['strategy', 'channel', 'agent_type'],

    AGENT_LIST_FIELDS: ['sys_id', 'name', 'internal_name', 'description', 'sys_updated_on'],

    USECASE_FIELDS: [
        'sys_id',
        'name',
        'internal_name',
        'description',
        'team',
        'strategy',
        'base_plan',
        'execution_mode',
        'context_processing_script',
        'applicability_script',
        'condition',
    ],
    USECASE_DISPLAY: ['team', 'strategy'],

    TEAM_MEMBER_FIELDS: ['sys_id', 'agent', 'team'],
    TEAM_MEMBER_DISPLAY: ['team'],

    M2M_FIELDS: [
        'sys_id',
        'agent',
        'tool',
        'name',
        // The BINDING carries its own description, distinct from the tool's.
        // Verified on gpinst01 2026-08-01: the table declares 28 fields, not
        // the 14 LLD §2.2 lists.
        'description',
        'active',
        'execution_mode',
        'max_auto_executions',
        'timeout',
        'inputs',
        'output_transformation_strategy',
        'display_output',
        'pre_message',
        'post_message',
        'post_processing_script',
        'tool_attributes',
    ],
    M2M_DISPLAY: ['tool', 'execution_mode'],

    TOOL_FIELDS: [
        'sys_id',
        'name',
        'description',
        'type',
        'script',
        'input_schema',
        'active',
        'target_document_table',
        'target_document',
        'record_type',
    ],
    TOOL_DISPLAY: ['type'],

    TRIGGER_M2M_FIELDS: [
        'sys_id',
        'trigger_configuration',
        'related_resource_table',
        'related_resource_record',
        'active',
        'objective_template',
    ],
    TRIGGER_M2M_DISPLAY: ['trigger_configuration'],

    // `name` IS declared (mandatory string) — measured against sys_dictionary on
    // gpinst01 2026-08-01, closing LLD §4.2's request for it against §2.2's
    // verified list, which omitted it. `usecase` and `business_rule` are both
    // labelled "(deprecated)" in the dictionary and are read for completeness
    // rather than relied on.
    TRIGGER_FIELDS: [
        'sys_id',
        'name',
        'internal_name',
        'description',
        'usecase',
        'active',
        'condition',
        'target_table',
        'objective_template',
        'channel',
        'trigger_strategy',
        'run_as',
        'run_as_user',
        'run_as_script',
        'business_rule',
        'trigger_flow',
    ],
    TRIGGER_DISPLAY: ['channel', 'usecase', 'run_as_user'],

    // Both access tables are Global-scope and were catalogued by SHAPE in §2.2,
    // never by a full sys_dictionary read. Read on gpinst01 2026-08-01:
    //   sys_agent_access_role_configuration declares 8 fields — name, action,
    //   allow_all_session_roles, agent_table, agent, description, role_list,
    //   sys_id. There is NO `active` column, which the first version of this
    //   list guessed at.
    //   sys_agent_access_role_mapping declares 3 — role, agent_access_config,
    //   sys_id. The join field is `agent_access_config`, which NONE of the five
    //   names originally guessed here matched, so the whole per-role breakout
    //   would have been skipped while the tool reported the role_list rows as
    //   the complete picture.
    // Still probed rather than hardcoded: these are Global-scope platform
    // tables we do not own, and the probe reports what it found either way.
    ACCESS_CONFIG_CANDIDATES: [
        'sys_id',
        'agent',
        'agent_table',
        'name',
        'action',
        'description',
        'role_list',
        'allow_all_session_roles',
    ],
    ACCESS_MAPPING_JOIN_CANDIDATES: [
        'agent_access_config',
        'role_configuration',
        'access_role_configuration',
        'agent_access_role_configuration',
    ],
    ACCESS_MAPPING_ROLE_CANDIDATES: ['role', 'sys_user_role', 'role_name'],

    // =======================================================================
    // Arguments (R-9)
    // =======================================================================

    /** Every key the object branch reads, aliases included (#122). */
    PARAM_NAMES: ['agent', 'agent_name', 'name', 'section'],

    _normalizeArgs: function (args) {
        var k = this._k()
        var raw = args
        var prefixStripped = ''

        if (raw === null || raw === undefined) return {}

        if (typeof raw === 'string') {
            var s = k.trim(raw)
            if (!s) return {}

            var parsed = k.tryParse(s)
            if (k.isPlainObject(parsed)) {
                raw = parsed
            } else if (s.charAt(0) === '{' || s.charAt(0) === '[') {
                // Meant to be structured and is not. Say so rather than
                // treating the braces as an agent name.
                return { _parse_error: true }
            } else {
                var split = k.splitParamPrefix(s, this.PARAM_NAMES)
                if (split) {
                    raw = {}
                    raw[split.param] = split.value
                    prefixStripped = split.raw
                } else {
                    // A bare sys_id and a bare name both resolve through the
                    // same path here — unlike the trace tool, where a sys_id
                    // means a different record type entirely.
                    return { agent: s }
                }
            }
        }

        if (!k.isPlainObject(raw)) return {}

        var out = {}
        var agent = k.str(raw.agent || raw.agent_name || raw.name)
        var section = k.lower(k.str(raw.section))

        if (agent) out.agent = agent
        if (section) out.section = section

        if (prefixStripped) out._prefix_stripped = prefixStripped

        return out
    },

    /** Unknown or absent section => every section, with the fallback stated. */
    _resolveSections: function (a, data) {
        var requested = a.section
        if (!requested || requested === 'all') return this.SECTIONS.slice(0)

        for (var i = 0; i < this.SECTIONS.length; i++) {
            if (this.SECTIONS[i] === requested) return [requested]
        }

        data.notes.push(
            'Unknown section "' +
                requested +
                '". Valid sections are: ' +
                this.SECTIONS.join(', ') +
                ' (or omit it for all four, which is the default). Returning all four rather than nothing.'
        )
        return this.SECTIONS.slice(0)
    },

    _wants: function (sections, name) {
        for (var i = 0; i < sections.length; i++) {
            if (sections[i] === name) return true
        }
        return false
    },

    // =======================================================================
    // Resolution
    // =======================================================================

    /**
     * Resolves a name or sys_id against `sn_aia_agent`, falling back to
     * `sn_aia_usecase`. Each key is queried separately rather than as one OR
     * condition, so the answer carries WHICH key matched — a name that resolves
     * only on internal_name is worth knowing about.
     */
    _findByIdentity: function (table, needle, fields, display, data) {
        var k = this._k()
        var out = { rows: [], matched_on: null, status: 'empty' }

        if (k.isSysId(needle)) {
            var one = k.readOne(table, needle, fields, display, data)
            out.status = one.status
            if (one.status === 'ok' && one.row) {
                out.rows = [one.row]
                out.matched_on = 'sys_id'
                return out
            }
            if (one.status === 'DENIED') return out
        }

        var keys = ['name', 'internal_name']
        for (var i = 0; i < keys.length; i++) {
            var read = k.readRows(table, k.eqQuery(keys[i], needle), fields, display, this.MAX_AGENTS, null, data)
            if (read.status === 'DENIED') {
                out.status = 'DENIED'
                return out
            }
            if (read.rows.length) {
                out.rows = read.rows
                out.matched_on = keys[i]
                out.status = 'ok'
                return out
            }
            out.status = read.status
        }

        return out
    },

    _resolveTarget: function (a, data) {
        var k = this._k()
        var out = {
            mode: 'list',
            agent_sys_id: '',
            agent_row: null,
            agent: { sys_id: '', name: null, matched_on: null, note: null },
            matched_agents: [],
            matched_usecases: [],
            usecase_ids: [],
            seed_usecases: [],
            candidates: [],
            note: '',
        }

        if (!a.agent) {
            // R-9: no argument at all is a valid call, not an error.
            var list = k.readRows(
                'sn_aia_agent',
                null,
                this.AGENT_LIST_FIELDS,
                [],
                this.MAX_AGENTS,
                'name',
                data
            )
            out.candidates = list.rows
            out.note =
                'No agent was supplied, so nothing specific could be inspected. The ' +
                list.rows.length +
                ' agent(s) readable from this scope are listed above (read status: ' +
                list.status +
                '). Re-call with agent=<name or sys_id>, optionally with section=' +
                this.SECTIONS.join('|') +
                '. This is not an error — a missing argument is expected (DESIGN.md R-9).'
            return out
        }

        var agentFind = this._findByIdentity(
            'sn_aia_agent',
            a.agent,
            this.AGENT_FIELDS,
            this.AGENT_DISPLAY,
            data
        )
        var usecaseFind = this._findByIdentity(
            'sn_aia_usecase',
            a.agent,
            this.USECASE_FIELDS,
            this.USECASE_DISPLAY,
            data
        )

        out.matched_agents = this._slim(agentFind.rows, ['sys_id', 'name', 'internal_name'])
        out.matched_usecases = this._slim(usecaseFind.rows, ['sys_id', 'name', 'internal_name', 'team'])
        out.usecase_ids = k.ids(usecaseFind.rows)

        if (!agentFind.rows.length && !usecaseFind.rows.length) {
            out.note =
                'No sn_aia_agent and no sn_aia_usecase matched "' +
                a.agent +
                '" (searched sys_id, name and internal_name on both). Read status — sn_aia_agent: ' +
                agentFind.status +
                ', sn_aia_usecase: ' +
                usecaseFind.status +
                '. If both read "ok" or "empty" this is a genuine name mismatch; if either reads "DENIED" ' +
                'it is a scope privilege gap and the name may well be correct.'
            return out
        }

        if (agentFind.rows.length) {
            out.mode = 'agent'
            out.agent_row = agentFind.rows[0]
            out.agent_sys_id = out.agent_row.sys_id

            // The use cases matched by NAME are deliberately NOT seeded in this
            // mode. They were found by searching the same string against
            // sn_aia_usecase, which says nothing about whether this agent is
            // related to them — and a use case pulled in on a name collision
            // would contribute its trigger links to branch 2 and its role rows
            // to the access check, attributing another use case's wiring to
            // this agent. In agent mode the relationship must come from the
            // team chain, which is the only thing that actually records one.
            // (When the agent and its use case genuinely share a name, the
            // chain finds it anyway, so nothing legitimate is lost.)
            out.seed_usecases = []
            if (usecaseFind.rows.length) {
                out.name_collision_usecases = this._slim(usecaseFind.rows, ['sys_id', 'name'])
            }
            out.agent = {
                sys_id: out.agent_sys_id,
                name: out.agent_row.name || null,
                matched_on: agentFind.matched_on,
                note: null,
            }
            out.note =
                'Matched sn_aia_agent on ' +
                agentFind.matched_on +
                '. ' +
                (agentFind.rows.length > 1
                    ? agentFind.rows.length +
                      ' agents matched; the first is inspected and the full list is in ' +
                      'resolution.matched_agents. Re-call with agent=<sys_id> to inspect a different one.'
                    : 'One agent matched.') +
                (out.name_collision_usecases
                    ? ' NOTE: ' +
                      out.name_collision_usecases.length +
                      ' use case(s) also match that name. They are NOT treated as this agent\'s use cases — ' +
                      'a shared name is not a relationship. Use cases below come from the team chain only, ' +
                      'and the name matches are listed in resolution.name_collision_usecases.'
                    : '')
            return out
        }

        // Use-case anchor only. The agent-keyed sections (tools, agent-direct
        // triggers) have nothing to key on and say so rather than reading empty.
        // Here the matched use cases ARE the anchor, so they are seeded.
        out.mode = 'usecase'
        out.seed_usecases = usecaseFind.rows
        out.agent = {
            sys_id: '',
            name: null,
            matched_on: null,
            note:
                'The name matched a use case, not an agent. Sections keyed on an agent — the attached ' +
                'tools, and the agent-direct trigger branch — cannot be read from a use case anchor.',
        }
        out.note =
            'No sn_aia_agent matched "' +
            a.agent +
            '", but ' +
            usecaseFind.rows.length +
            ' use case(s) did (on ' +
            usecaseFind.matched_on +
            '). Inspecting from the use case anchor. Re-call with an agent name or sys_id for the ' +
            'tool and agent-direct trigger sections.'
        return out
    },

    // =======================================================================
    // Shared reads, resolved once per call
    // =======================================================================

    /** Usecases reachable from the agent: team chain, plus any matched by name. */
    _ensureUsecases: function (ctx, data) {
        if (ctx.usecases) return ctx.usecases
        var k = this._k()

        var teams = []
        if (ctx.agent_sys_id) {
            var members = k.readRows(
                'sn_aia_team_member',
                k.eqQuery('agent', ctx.agent_sys_id),
                this.TEAM_MEMBER_FIELDS,
                this.TEAM_MEMBER_DISPLAY,
                this.MAX_TEAMS,
                null,
                data
            )
            for (var i = 0; i < members.rows.length; i++) {
                var t = k.refValue(members.rows[i].team)
                if (t && teams.indexOf(t) === -1) teams.push(t)
            }
            ctx.team_read_status = members.status
        }
        ctx.teams = teams

        var rows = []
        var seen = {}
        var j

        // Seeded from resolution: a use case matched by name is in scope even
        // if the agent is not a member of its team.
        for (j = 0; j < ctx.seed_usecases.length; j++) {
            var seed = ctx.seed_usecases[j]
            if (seed.sys_id && !seen[seed.sys_id]) {
                seen[seed.sys_id] = true
                rows.push(seed)
            }
        }

        if (teams.length) {
            var byTeam = k.readRows(
                'sn_aia_usecase',
                k.inQuery('team', teams),
                this.USECASE_FIELDS,
                this.USECASE_DISPLAY,
                this.MAX_USECASES,
                null,
                data
            )
            for (j = 0; j < byTeam.rows.length; j++) {
                var u = byTeam.rows[j]
                if (u.sys_id && !seen[u.sys_id]) {
                    seen[u.sys_id] = true
                    rows.push(u)
                }
            }
            ctx.usecase_read_status = byTeam.status
        }

        ctx.usecases = rows
        return rows
    },

    /** The agent's tool bindings, each with its sn_aia_tool row where readable. */
    _ensureBindings: function (ctx, data) {
        if (ctx.bindings) return ctx.bindings
        var k = this._k()

        if (!ctx.agent_sys_id) {
            ctx.bindings = []
            ctx.binding_read_status = 'not_applicable'
            return ctx.bindings
        }

        var read = k.readRows(
            'sn_aia_agent_tool_m2m',
            k.eqQuery('agent', ctx.agent_sys_id),
            this.M2M_FIELDS,
            this.M2M_DISPLAY,
            this.MAX_TOOLS,
            'name',
            data
        )
        ctx.binding_read_status = read.status

        var out = []
        for (var i = 0; i < read.rows.length; i++) {
            var m = read.rows[i]
            var toolId = k.refValue(m.tool)
            var toolRead = toolId
                ? k.readOne('sn_aia_tool', toolId, this.TOOL_FIELDS, this.TOOL_DISPLAY, data)
                : { status: 'empty', row: null }

            out.push({ binding: m, tool: toolRead.row, tool_read_status: toolRead.status })
        }

        ctx.bindings = out
        return out
    },

    // =======================================================================
    // Section: overview
    // =======================================================================

    _overview: function (ctx, data) {
        var k = this._k()
        var agent = ctx.agent_row || {}
        var usecases = this._ensureUsecases(ctx, data)
        var bindings = this._ensureBindings(ctx, data)
        var links = this._ensureTriggerLinks(ctx, data)

        var activeTools = 0
        var i
        for (i = 0; i < bindings.length; i++) {
            if (k.lower(bindings[i].binding.active) === 'true') activeTools++
        }

        var activeLinks = 0
        var activeTriggers = 0
        for (i = 0; i < links.length; i++) {
            if (k.lower(links[i].m2m_active) === 'true') activeLinks++
            if (links[i].trigger && k.lower(links[i].trigger.active) === 'true') activeTriggers++
        }

        var ucOut = []
        for (i = 0; i < usecases.length; i++) {
            ucOut.push({
                sys_id: usecases[i].sys_id,
                name: usecases[i].name || null,
                team: k.refValue(usecases[i].team),
                team_name: usecases[i].team_display || null,
            })
        }

        return {
            sys_id: ctx.agent_sys_id || null,
            name: agent.name || null,
            internal_name: agent.internal_name || null,
            description: k.digest(agent.description, this.DIGEST_CHARS),
            role_digest: k.digest(agent.role, this.DIGEST_CHARS),
            proficiency: agent.proficiency || null,
            strategy: agent.strategy_display || k.refValue(agent.strategy) || null,
            channel: agent.channel_display || agent.channel || null,
            agent_type: agent.agent_type_display || agent.agent_type || null,
            advanced_mode: agent.advanced_mode || null,
            instruction_chars: (agent.instructions || '').length,
            tool_count: bindings.length,
            active_tool_count: activeTools,
            usecases: ucOut,
            teams: ctx.teams || [],
            trigger_links: links.length,
            active_trigger_links: activeLinks,
            active_trigger_configurations: activeTriggers,
            created: agent.sys_created_on || null,
            updated: agent.sys_updated_on || null,
            note:
                'Counts here are summaries of the tools and triggers sections. A zero tool_count with ' +
                'binding read status "' +
                (ctx.binding_read_status || 'unknown') +
                '" is a genuine absence only if that status is "ok" or "empty".',
        }
    },

    // =======================================================================
    // Section: instructions (R-7 / R-16)
    // =======================================================================

    _bodyOf: function (value) {
        var k = this._k()
        var s = value === null || value === undefined ? '' : String(value)
        var truncated = s.length > this.BODY_CHARS
        return {
            present: s.length > 0,
            length: s.length,
            truncated: truncated,
            body: truncated ? k.digest(s, this.BODY_CHARS) : s,
        }
    },

    _instructions: function (ctx, data) {
        var k = this._k()
        var agent = ctx.agent_row || {}
        var usecases = this._ensureUsecases(ctx, data)
        var findings = []

        var agentOut = {
            sys_id: ctx.agent_sys_id || null,
            instructions: agent.instructions || '',
            instructions_length: (agent.instructions || '').length,
            role: agent.role || '',
            proficiency: agent.proficiency || null,
            condition: agent.condition || null,
            context_processing_script: this._bodyOf(agent.context_processing_script),
            applicability_script: this._bodyOf(agent.applicability_script),
        }
        if (agentOut.instructions.length > this.BODY_CHARS) {
            agentOut.instructions = k.digest(agentOut.instructions, this.BODY_CHARS)
            agentOut.instructions_truncated = true
        }

        this._scriptFindings(findings, 'sn_aia_agent', ctx.agent_sys_id, agentOut)

        var ucOut = []
        for (var i = 0; i < usecases.length; i++) {
            var u = usecases[i]
            var entry = {
                sys_id: u.sys_id,
                name: u.name || null,
                base_plan: k.digest(u.base_plan, this.BODY_CHARS),
                condition: u.condition || null,
                context_processing_script: this._bodyOf(u.context_processing_script),
                applicability_script: this._bodyOf(u.applicability_script),
            }
            this._scriptFindings(findings, 'sn_aia_usecase', u.sys_id, entry)
            ucOut.push(entry)
        }

        return {
            agent: agentOut,
            usecases: ucOut,
            script_findings: findings,
            // This note used to add that "the known failure specimen on this
            // instance threw in the AGENT copy". A real administrator has no
            // referent for that phrase — it only parses with a benchmark
            // specimen open — and it paired with the detail in
            // _scriptFindings to hand a model the smoke gate's answer minus
            // its line number (issue #89). The R-7/R-16 guidance is the
            // asymmetry itself, and it survives without the anecdote.
            note:
                'context_processing_script and applicability_script are read from BOTH sn_aia_agent and ' +
                'sn_aia_usecase. The platform populates the agent copy whether or not you declare it, so ' +
                'reading one side misses half the failure surface (DESIGN.md R-7, R-16).',
        }
    },

    _scriptFindings: function (findings, table, sysId, entry) {
        var k = this._k()

        if (entry.context_processing_script.present) {
            findings.push({
                finding: 'context_processing_script_populated',
                severity: 'medium',
                confidence: 'high',
                subject: table + '[' + sysId + '].context_processing_script',
                // The specimen's LINE NUMBER used to be quoted here ("threw at
                // line 42"). It is the worst place in this tool for a
                // remembered number: a finding, beside a `subject` naming the
                // real record, with a `next_step` pointing at agent_trace's
                // script_errors — which carry a genuine `line`. Six of ten v3
                // benchmark runs misread a far weaker instance of this shape
                // as run data (issue #85). What the anecdote is FOR is that a
                // populated body has thrown in practice; the line it threw at
                // adds nothing and invites the misread.
                //
                // The rest of the anecdote went the same way in round 2 of
                // #89's review. "…has thrown at runtime, terminating a run
                // that reported state=Completed with an empty state_reason"
                // is, word for word, the REASON a benchmark specimen was
                // chosen — a run invisible from its plan header. Naming the
                // mechanism generically loses nothing: the actionable half
                // ("a run can throw here and still look healthy in the plan
                // header") is already in next_step, where it belongs.
                detail:
                    'The script is populated (' +
                    entry.context_processing_script.length +
                    ' chars). Fluent omission does not leave this field empty — the platform writes ' +
                    'boilerplate into it — and an auto-populated body can throw at runtime (DESIGN.md ' +
                    'R-7, R-16).',
                next_step:
                    'Cross-check agent_trace script_errors for a source matching this record. A run can ' +
                    'throw here and still look healthy in the plan header.',
            })
        }

        var applicability = entry.applicability_script
        if (applicability.present && this._endsInReturnFalse(applicability.body)) {
            findings.push({
                finding: 'applicability_script_suppresses_agent',
                severity: 'high',
                // A text scan over a script body, and R-7's claim that the
                // platform auto-populates this with `return false` was REFUTED
                // on gpinst01 (the field came back empty). So this reports what
                // the body says, not what the platform did.
                confidence: 'heuristic',
                subject: table + '[' + sysId + '].applicability_script',
                detail:
                    'The applicability script appears to return false, which suppresses the agent silently ' +
                    '— no plan is created and nothing reports that none was.',
                evidence: k.digest(applicability.body, this.DIGEST_CHARS),
                next_step:
                    'Read the full body above and confirm the return is unconditional. If it is, the agent ' +
                    'never runs, and an absent execution plan is the expected symptom rather than a ' +
                    'trigger fault.',
            })
        }
    },

    /** Last `return` statement in the body returns a false literal. */
    _endsInReturnFalse: function (body) {
        var s = String(body || '')
        var matches = s.match(/return\s+(false|!1)\s*;?/g)
        if (!matches || !matches.length) return false
        var lastReturn = s.lastIndexOf('return')
        var tail = s.substring(lastReturn)
        return /^return\s+(false|!1)\s*;?/.test(tail)
    },

    // =======================================================================
    // Section: tools + tool_smells (K26 Lab 3)
    // =======================================================================

    _tools: function (ctx, data) {
        var k = this._k()
        var bindings = this._ensureBindings(ctx, data)
        var out = []
        var smells = []
        var scored = 0
        var notScored = 0
        var i

        for (i = 0; i < bindings.length; i++) {
            var b = bindings[i]
            var m = b.binding
            var t = b.tool

            var entry = {
                binding: {
                    sys_id: m.sys_id,
                    name: m.name || null,
                    active: m.active,
                    // §8 item 1: exactly two active choices — autopilot is
                    // "Autonomous", copilot is "Supervised". This is the
                    // confirmation-gate flag.
                    execution_mode: m.execution_mode,
                    execution_mode_label: m.execution_mode_display || null,
                    max_auto_executions: m.max_auto_executions,
                    timeout: m.timeout,
                    output_transformation_strategy: m.output_transformation_strategy,
                    display_output: m.display_output,
                    inputs: m.inputs || null,
                    post_processing_script: this._bodyOf(m.post_processing_script),
                },
                tool_read_status: b.tool_read_status,
                tool: t
                    ? {
                          sys_id: t.sys_id,
                          name: t.name || null,
                          type: t.type_display || t.type,
                          type_value: t.type,
                          active: t.active,
                          description: t.description || '',
                          description_length: (t.description || '').length,
                          // Verbatim, per LLD §4.2 — the shape is the finding.
                          input_schema: t.input_schema || '',
                          script: this._bodyOf(t.script),
                          target_document_table: t.target_document_table || null,
                          target_document: k.refValue(t.target_document),
                          record_type: t.record_type || null,
                      }
                    : null,
            }

            if (!t) {
                notScored++
                entry.smell_note =
                    'The sn_aia_tool row could not be read (status: ' +
                    b.tool_read_status +
                    '), so this tool was NOT scored. Zero smells here would mean "not looked at", not "clean".'
            } else {
                scored++
                this._smellsFor(smells, m, t)
            }

            out.push(entry)
        }

        if (scored > 1) this._overlapSmells(smells, bindings)

        var bySeverity = { high: 0, medium: 0, low: 0 }
        for (i = 0; i < smells.length; i++) {
            var sev = smells[i].severity
            bySeverity[sev] = (bySeverity[sev] || 0) + 1
        }

        return {
            tools: out,
            tool_smells: smells,
            // R-22 item 4: a count without its denominator is not a
            // measurement. "3 smells" and "3 over 12 checks on 1 of 4 tools"
            // are the same sentence shape and only one can be checked.
            tool_smell_stats: {
                bindings_found: bindings.length,
                tools_checked: scored,
                tools_not_scored: notScored,
                checks_per_tool: this.PER_TOOL_CHECKS.length,
                check_names: this.PER_TOOL_CHECKS,
                smells_found: smells.length,
                by_severity: bySeverity,
                read_status: ctx.binding_read_status,
            },
            note:
                'Smells are scored against the K26 Lab 3 tool-quality framework: a tool call fails at ' +
                'selection (the description), invocation (the inputs) or interpretation (the output). ' +
                'Checks marked confidence=heuristic are text scans over a description or script body and ' +
                'can be wrong in both directions — read the evidence before acting on one.',
        }
    },

    /** Named here so the stats block can state the denominator honestly. */
    PER_TOOL_CHECKS: [
        'binding_inactive',
        'tool_inactive',
        'description_empty',
        'description_thin',
        'description_no_negative_guidance',
        'description_no_input_guidance',
        'description_no_output_guidance',
        'input_schema_missing',
        'input_schema_unparseable',
        'input_schema_not_array',
        'script_missing_iife_invocation',
        'script_no_input_validation',
        'script_unbounded_query',
        'script_empty_failure_path',
        'script_raw_record_dump',
    ],

    _smell: function (list, m, t, smell, severity, confidence, finding, why, suggested, evidence) {
        list.push({
            tool_name: (t && t.name) || m.name || null,
            binding_sys_id: m.sys_id,
            tool_sys_id: t ? t.sys_id : null,
            smell: smell,
            severity: severity,
            confidence: confidence,
            finding: finding,
            why: why,
            suggested_action: suggested,
            evidence: evidence || null,
        })
    },

    _smellsFor: function (list, m, t) {
        var k = this._k()
        var desc = String(t.description || '')
        var low = desc.toLowerCase()
        var script = String(t.script || '')
        var isScript = k.lower(t.type) === 'script' || k.lower(t.type_display) === 'script'

        // --- wiring: the tool cannot be called at all -----------------------
        if (k.lower(m.active) === 'false') {
            this._smell(
                list,
                m,
                t,
                'binding_inactive',
                'high',
                'high',
                'The sn_aia_agent_tool_m2m binding is inactive.',
                'An inactive binding removes the tool from the agent entirely. The tool record still ' +
                    'exists and looks healthy, so this reads as "the agent ignored the tool" rather than ' +
                    '"the agent never had it".',
                'Set active=true on the binding, or confirm the removal was intended.',
                'sn_aia_agent_tool_m2m[' + m.sys_id + '].active = false'
            )
        }
        if (k.lower(t.active) === 'false') {
            this._smell(
                list,
                m,
                t,
                'tool_inactive',
                'high',
                'high',
                'The sn_aia_tool record is inactive.',
                'The binding may be active while the tool behind it is not.',
                'Set active=true on the tool record.',
                'sn_aia_tool[' + t.sys_id + '].active = false'
            )
        }

        // --- selection: the description is the LLM's only signal ------------
        if (!desc) {
            this._smell(
                list,
                m,
                t,
                'description_empty',
                'high',
                'high',
                'The tool has no description.',
                'Two failures at once. The description is the only signal the model has for choosing the ' +
                    'tool, so an empty one means selection is guesswork — and a platform Data Policy on ' +
                    'sn_aia_tool mandates Description, so an app installing this tool has the record ' +
                    'silently skipped while its m2m row installs anyway, leaving a phantom reference ' +
                    '(SDK Build Rule #34).',
                'Write the three sections the K26 framework requires: Purpose including when NOT to use ' +
                    'it, the input formats accepted, and what success, empty and error responses look like.',
                'sn_aia_tool[' + t.sys_id + '].description is empty'
            )
        } else {
            if (desc.length < 120 || this._sentenceCount(desc) < 2) {
                this._smell(
                    list,
                    m,
                    t,
                    'description_thin',
                    'medium',
                    'heuristic',
                    'The description is a single short statement.',
                    'Selection, invocation and interpretation all read from this one field. A one-liner ' +
                        'covers at most the first.',
                    'Expand to Purpose / Understanding Tool Inputs / Understanding Tool Outputs and Error ' +
                        'Handling.',
                    k.digest(desc, this.DIGEST_CHARS)
                )
            }
            if (!this._mentionsAny(low, ['not ', "n't", 'instead', 'rather than', 'avoid', 'only when', 'never'])) {
                this._smell(
                    list,
                    m,
                    t,
                    'description_no_negative_guidance',
                    'medium',
                    'heuristic',
                    'The description never says when NOT to use the tool.',
                    'Every additional tool multiplies selection risk. Without a boundary the model reaches ' +
                        'for whichever description is nearest the request.',
                    'Add a sentence naming the cases this tool does not cover and what to use instead.',
                    k.digest(desc, this.DIGEST_CHARS)
                )
            }
            if (!this._mentionsAny(low, ['input', 'argument', 'parameter', 'accepts', 'pass ', 'format', 'omit'])) {
                this._smell(
                    list,
                    m,
                    t,
                    'description_no_input_guidance',
                    'medium',
                    'heuristic',
                    'The description does not say what inputs the tool takes or in what format.',
                    'The model constructs the call from this text. Unstated formats are invented.',
                    'State each input, its format, and what happens when an unexpected format arrives.',
                    null
                )
            }
            if (!this._mentionsAny(low, ['return', 'output', 'response', 'empty', 'error', 'fails'])) {
                this._smell(
                    list,
                    m,
                    t,
                    'description_no_output_guidance',
                    'medium',
                    'heuristic',
                    'The description does not say what the tool returns, or what an error looks like.',
                    'Interpretation is the third failure point: a model that cannot tell an empty result ' +
                        'from a failure will narrate one as the other.',
                    'Describe the success shape, the empty shape, and the error shape.',
                    null
                )
            }
        }

        // --- invocation: the input schema -----------------------------------
        var schema = String(t.input_schema || '')
        if (!schema) {
            this._smell(
                list,
                m,
                t,
                'input_schema_missing',
                'low',
                'high',
                'The tool declares no input schema.',
                'Valid for a tool that genuinely takes no input; otherwise the model has nothing to fill in.',
                'Declare inputs as an array of {name, description, mandatory}, or confirm none are needed.',
                null
            )
        } else {
            var parsed = k.tryParse(schema)
            if (parsed === null) {
                this._smell(
                    list,
                    m,
                    t,
                    'input_schema_unparseable',
                    'high',
                    'high',
                    'The input schema is not valid JSON.',
                    'The runtime parses this field. A value it cannot parse fails at call time, not at save time.',
                    'Replace with a JSON array of {name, description, mandatory}.',
                    k.digest(schema, this.DIGEST_CHARS)
                )
            } else if (!k.isArray(parsed)) {
                this._smell(
                    list,
                    m,
                    t,
                    'input_schema_not_array',
                    'high',
                    'high',
                    'The input schema is a JSON object, not an array.',
                    'The verified format is an ARRAY of {name, description, mandatory}. A JSON-Schema ' +
                        'object causes a SILENT, NEVER-TERMINATING STALL — the execution sits in ' +
                        'In progress forever with no error anywhere (AiAgentBaseDao: "The object is not a ' +
                        'string", then AgentReActUtil: "Cannot find function filter in object"). It is the ' +
                        'single most expensive defect found in this project\'s pre-flight.',
                    'Convert to [{"name":"...","description":"...","mandatory":false}].',
                    k.digest(schema, this.DIGEST_CHARS)
                )
            }
        }

        // --- the script itself ----------------------------------------------
        if (isScript && script) {
            if (!/\)\s*\(\s*inputs\s*\)\s*;?\s*$/.test(script)) {
                this._smell(
                    list,
                    m,
                    t,
                    'script_missing_iife_invocation',
                    'high',
                    'high',
                    'The script does not end with the trailing (inputs) invocation.',
                    'A script tool must be a self-invoking IIFE. Without the trailing (inputs) the runtime ' +
                        'receives a function object instead of a result and fails converting it to JSON. ' +
                        'It builds and installs cleanly and fails only when the tool is called ' +
                        '(SDK Build Rule #19).',
                    'End the script with })(inputs);',
                    k.digest(script.substring(Math.max(0, script.length - 120)), this.DIGEST_CHARS)
                )
            }
            if (
                script.indexOf('inputs.') !== -1 &&
                !this._mentionsAny(script, ['typeof', 'JSON.parse', 'if (!inputs', 'if(!inputs', '!inputs.'])
            ) {
                this._smell(
                    list,
                    m,
                    t,
                    'script_no_input_validation',
                    'medium',
                    'heuristic',
                    'The script reads its inputs without validating or normalising them.',
                    'Complex inputs arrive as JSON STRINGS at runtime, not as parsed values, and a declared ' +
                        'input may not arrive at all. Trusting the model to pass the right shape is the ' +
                        'documented way a tool fails on its first real call.',
                    'Parse defensively at the top of the IIFE and behave correctly when every input is absent.',
                    null
                )
            }
            if (
                this._mentionsAny(script, ['GlideRecord', 'GlideRecordSecure']) &&
                script.indexOf('.query(') !== -1 &&
                script.indexOf('setLimit(') === -1
            ) {
                this._smell(
                    list,
                    m,
                    t,
                    'script_unbounded_query',
                    'medium',
                    'heuristic',
                    'The script queries without a setLimit.',
                    'An unbounded result set inflates the scratchpad, and the cost compounds because every ' +
                        'later ReAct turn re-reads it.',
                    'Apply setLimit and return synthesized fields rather than whole records.',
                    null
                )
            }
            if (this._mentionsAny(script, ['return {}', "return ''", 'return ""', 'return null'])) {
                this._smell(
                    list,
                    m,
                    t,
                    'script_empty_failure_path',
                    'medium',
                    'heuristic',
                    'The script appears to return an empty value on a failure path.',
                    'An empty object is indistinguishable from "found nothing". The model cannot tell a ' +
                        'failure from an absence and will narrate whichever fits its prompt.',
                    'Return a structured error carrying what failed and a suggested_action.',
                    null
                )
            }
            if (this._mentionsAny(script, ['.serialize(', 'getFields()', 'GlideRecordUtil'])) {
                this._smell(
                    list,
                    m,
                    t,
                    'script_raw_record_dump',
                    'medium',
                    'heuristic',
                    'The script appears to return a whole serialized record.',
                    'Dozens of unnamed fields per row is tool output bloat: it fills the scratchpad and ' +
                        'buries the two fields that mattered.',
                    'Return named fields the diagnosis actually uses.',
                    null
                )
            }
        }
    },

    /**
     * Tools an agent must call in sequence multiply selection, invocation and
     * interpretation risk. Lexical overlap is a weak proxy for that and is
     * reported as a candidate, never as a verdict.
     */
    _overlapSmells: function (list, bindings) {
        var k = this._k()
        for (var i = 0; i < bindings.length; i++) {
            for (var j = i + 1; j < bindings.length; j++) {
                var a = bindings[i]
                var b = bindings[j]
                if (!a.tool || !b.tool) continue

                var overlap = this._overlap(a.tool.description, b.tool.description)
                if (overlap < this.OVERLAP_THRESHOLD) continue

                list.push({
                    tool_name: a.tool.name + ' + ' + b.tool.name,
                    binding_sys_id: a.binding.sys_id,
                    tool_sys_id: a.tool.sys_id,
                    smell: 'overlapping_tools',
                    severity: 'low',
                    confidence: 'heuristic',
                    finding:
                        'These two tool descriptions overlap lexically (' +
                        Math.round(overlap * 100) +
                        '% of the smaller word set).',
                    why:
                        'Overlapping descriptions make selection ambiguous, and tools the agent always ' +
                        'calls in sequence are consolidation candidates — each extra tool multiplies the ' +
                        'three failure points.',
                    suggested_action:
                        'Read both descriptions. If they serve one job, consolidate; if not, sharpen the ' +
                        'boundary between them.',
                    evidence: k.digest(a.tool.description, 120) + ' || ' + k.digest(b.tool.description, 120),
                })
            }
        }
    },

    _sentenceCount: function (s) {
        var m = String(s).match(/[.!?]+/g)
        return m ? m.length : 1
    },

    _mentionsAny: function (haystack, needles) {
        for (var i = 0; i < needles.length; i++) {
            if (String(haystack).indexOf(needles[i]) !== -1) return true
        }
        return false
    },

    /** Word-set overlap over the smaller set. No Set/Map — Rhino is ES5. */
    _overlap: function (a, b) {
        var setA = this._words(a)
        var setB = this._words(b)
        var keysA = Object.keys(setA)
        var keysB = Object.keys(setB)
        if (!keysA.length || !keysB.length) return 0

        var shared = 0
        for (var i = 0; i < keysA.length; i++) {
            if (setB[keysA[i]]) shared++
        }
        return shared / Math.min(keysA.length, keysB.length)
    },

    _words: function (s) {
        var out = {}
        var parts = String(s || '')
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, ' ')
            .split(/\s+/)
        for (var i = 0; i < parts.length; i++) {
            if (parts[i].length > 3) out[parts[i]] = true
        }
        return out
    },

    // =======================================================================
    // Section: triggers (R-18a)
    // =======================================================================

    /**
     * THE TRAVERSAL. Read R-18a before changing anything here.
     *
     * `sn_aia_trigger_agent_usecase_m2m` is not an agent-to-usecase m2m despite
     * the name: it has no `agent` and no `usecase` column. It is a polymorphic
     * trigger-to-resource link — `related_resource_table` + `related_resource_record`.
     * We start from an agent, so that pair is the key. Two branches, both walked:
     *
     *   1. agent-direct        related_resource_record = agentSysId
     *                          ^related_resource_table = sn_aia_agent
     *   2. team/usecase chain  sn_aia_team_member(agent) -> team
     *                          -> sn_aia_usecase(team)   -> usecase sys_ids
     *                          related_resource_record IN (those)
     *                          ^related_resource_table = sn_aia_usecase
     *
     * Branch 2 held 5 of 6 sampled rows. Walking only branch 1 reports a wired
     * agent as unwired, and a wrong key returns blanks rather than an error, so
     * nothing anywhere says the traversal missed.
     */
    _ensureTriggerLinks: function (ctx, data) {
        if (ctx.trigger_links) return ctx.trigger_links
        var k = this._k()

        var triggerFields = this.TRIGGER_FIELDS
        var cache = {}
        var links = []
        var branches = { agent_direct: 0, team_usecase_chain: 0 }
        var statuses = []

        // No silent caps: each branch is limited independently, so a branch
        // that hits the ceiling has to say so or a partial traversal reads as a
        // complete one — the failure this whole section exists to avoid.
        var truncated = {}

        function collect(self, read, via) {
            statuses.push(read.status)
            if (read.truncated_at) truncated[via] = read.truncated_at
            for (var i = 0; i < read.rows.length; i++) {
                var row = read.rows[i]
                var triggerId = k.refValue(row.trigger_configuration)
                var trigger = null
                var triggerStatus = 'empty'

                if (triggerId) {
                    if (cache[triggerId]) {
                        trigger = cache[triggerId].row
                        triggerStatus = cache[triggerId].status
                    } else {
                        var tr = k.readOne(
                            'sn_aia_trigger_configuration',
                            triggerId,
                            triggerFields,
                            self.TRIGGER_DISPLAY,
                            data
                        )
                        cache[triggerId] = { row: tr.row, status: tr.status }
                        trigger = tr.row
                        triggerStatus = tr.status
                    }
                }

                links.push({
                    m2m_sys_id: row.sys_id,
                    found_via: via,
                    m2m_active: row.active,
                    // Carried separately from `trigger` because when the read
                    // is DENIED there is no trigger object to take it from, and
                    // a finding about an unreadable trigger has to name the
                    // trigger — not the agent or use case the link points at.
                    trigger_sys_id: triggerId,
                    related_resource_table: row.related_resource_table,
                    related_resource_record: k.refValue(row.related_resource_record),
                    m2m_objective_template: k.digest(row.objective_template, self.DIGEST_CHARS),
                    trigger_read_status: triggerStatus,
                    trigger: trigger
                        ? {
                              sys_id: trigger.sys_id,
                              name: trigger.name || null,
                              internal_name: trigger.internal_name || null,
                              description: k.digest(trigger.description, self.DIGEST_CHARS),
                              active: trigger.active,
                              condition: k.digest(trigger.condition, self.DIGEST_CHARS),
                              target_table: trigger.target_table,
                              objective_template: k.digest(trigger.objective_template, self.BODY_CHARS),
                              channel: trigger.channel_display || k.refValue(trigger.channel),
                              trigger_strategy: trigger.trigger_strategy,
                              // Both labelled "(deprecated)" in sys_dictionary —
                              // carried for completeness, not leaned on.
                              usecase_deprecated: k.refValue(trigger.usecase),
                              usecase_name: trigger.usecase_display || null,
                              // NOT a user. `run_as` is internal_type
                              // field_name: it names a FIELD on target_table,
                              // and the identity is whoever sits in that field
                              // on the record that fired the trigger.
                              run_as_field: trigger.run_as || null,
                              run_as: trigger.run_as,
                              run_as_user: k.refValue(trigger.run_as_user),
                              run_as_user_name: trigger.run_as_user_display || null,
                              run_as_script: self._bodyOf(trigger.run_as_script),
                              business_rule_deprecated: k.refValue(trigger.business_rule),
                              trigger_flow: k.refValue(trigger.trigger_flow),
                          }
                        : null,
                })
                branches[via]++
            }
        }

        // Branch 1 — agent-direct.
        if (ctx.agent_sys_id) {
            var agentSysId = ctx.agent_sys_id
            var direct = k.readRows(
                'sn_aia_trigger_agent_usecase_m2m',
                function (gr) {
                    gr.addQuery('related_resource_record', agentSysId)
                    gr.addQuery('related_resource_table', 'sn_aia_agent')
                },
                this.TRIGGER_M2M_FIELDS,
                this.TRIGGER_M2M_DISPLAY,
                this.MAX_TRIGGER_LINKS,
                null,
                data
            )
            collect(this, direct, 'agent_direct')
        }

        // Branch 2 — the team/usecase chain, where most rows live.
        var usecaseIds = k.ids(this._ensureUsecases(ctx, data))
        var chain = k.readRows(
            'sn_aia_trigger_agent_usecase_m2m',
            function (gr) {
                gr.addQuery('related_resource_record', 'IN', usecaseIds.length ? usecaseIds.join(',') : '__none__')
                gr.addQuery('related_resource_table', 'sn_aia_usecase')
            },
            this.TRIGGER_M2M_FIELDS,
            this.TRIGGER_M2M_DISPLAY,
            this.MAX_TRIGGER_LINKS,
            null,
            data
        )
        collect(this, chain, 'team_usecase_chain')

        ctx.trigger_links = links
        ctx.trigger_branches = branches
        ctx.trigger_read_statuses = statuses
        ctx.trigger_usecase_ids = usecaseIds
        ctx.trigger_truncated = truncated

        if (truncated.agent_direct || truncated.team_usecase_chain) {
            data.notes.push(
                'The trigger traversal hit its per-branch ceiling of ' +
                    this.MAX_TRIGGER_LINKS +
                    ' link(s) on: ' +
                    Object.keys(truncated).join(', ') +
                    '. More links exist than are reported, so an absent trigger below is NOT evidence that ' +
                    'no such trigger is wired. Stated rather than silently truncated.'
            )
        }
        return links
    },

    /**
     * Whether every read the trigger traversal depends on actually succeeded.
     *
     * Wider than the two m2m reads, deliberately. Branch 2's INPUT is the use
     * case list, which comes from sn_aia_team_member -> sn_aia_usecase. If
     * either of those is denied the list is empty, the branch queries a
     * deliberately impossible value, and it returns empty — an absence
     * manufactured one hop upstream that looks identical to a real one.
     *
     * @returns {Object} {complete, denied: [table, ...], statuses}
     */
    _traversalIntegrity: function (ctx, data) {
        var denied = []
        var truncated = []
        var statuses = ctx.trigger_read_statuses || []

        for (var i = 0; i < statuses.length; i++) {
            if (statuses[i] === 'DENIED' && denied.indexOf('sn_aia_trigger_agent_usecase_m2m') === -1) {
                denied.push('sn_aia_trigger_agent_usecase_m2m')
            }
        }
        if (ctx.team_read_status === 'DENIED') denied.push('sn_aia_team_member')
        if (ctx.usecase_read_status === 'DENIED') denied.push('sn_aia_usecase')

        // A TRUNCATED input is as damaging here as a denied one, and the first
        // version of this function checked only denials — so it reported
        // "complete" over a use-case list that had been cut at 20. Branch 2
        // keys solely on that list, so wiring on the omitted use cases is never
        // queried, and the result then reads as an authoritative absence.
        var truncations = (data && data.truncations) || {}
        var sources = ['sn_aia_team_member', 'sn_aia_usecase', 'sn_aia_trigger_agent_usecase_m2m']
        for (i = 0; i < sources.length; i++) {
            if (truncations[sources[i]]) {
                truncated.push(sources[i] + ' (at ' + truncations[sources[i]] + ')')
            }
        }

        return {
            complete: denied.length === 0 && truncated.length === 0,
            denied: denied,
            truncated: truncated,
            m2m_read_statuses: statuses,
            team_member_read_status: ctx.team_read_status || 'not_read',
            usecase_read_status: ctx.usecase_read_status || 'not_read',
        }
    },

    _triggers: function (ctx, data) {
        var k = this._k()
        var links = this._ensureTriggerLinks(ctx, data)
        var findings = []
        var i

        for (i = 0; i < links.length; i++) {
            var l = links[i]
            if (k.lower(l.m2m_active) === 'false') {
                findings.push({
                    finding: 'inactive_link',
                    severity: 'high',
                    subject: 'sn_aia_trigger_agent_usecase_m2m[' + l.m2m_sys_id + ']',
                    detail:
                        'The link between the trigger and this resource is inactive. Either this flag or ' +
                        'the trigger configuration active flag being false unwires the agent, and the ' +
                        'other one looking healthy hides it.',
                    next_step: 'Set active=true on the m2m row, or confirm the agent is meant to be unwired.',
                })
            }
            if (l.trigger && k.lower(l.trigger.active) === 'false') {
                findings.push({
                    finding: 'inactive_trigger',
                    severity: 'high',
                    subject: 'sn_aia_trigger_configuration[' + l.trigger.sys_id + ']',
                    detail: 'The trigger configuration itself is inactive, so it never fires.',
                    next_step: 'Set active=true on the trigger configuration.',
                })
            }
            if (l.trigger_read_status === 'DENIED') {
                findings.push({
                    finding: 'trigger_unreadable',
                    severity: 'medium',
                    // The TRIGGER's sys_id. related_resource_record is the
                    // agent or use case the link points at, and naming it here
                    // would send an investigator to the wrong record under a
                    // label saying otherwise.
                    subject: 'sn_aia_trigger_configuration[' + (l.trigger_sys_id || '(no reference on the link)') + ']',
                    via_link: 'sn_aia_trigger_agent_usecase_m2m[' + l.m2m_sys_id + ']',
                    detail:
                        'The link exists but its trigger configuration could not be read from this scope. ' +
                        'The wiring state is unknown, not absent.',
                    next_step: 'Re-check with a role that can read sn_aia_trigger_configuration.',
                })
            }
        }

        // An empty traversal means "no wiring" ONLY if the traversal actually
        // ran. If any read behind it was denied, the same empty result means
        // "unknown" — and reporting that as a definitive high-severity
        // configuration finding is the exact partial-read-as-absence failure
        // this project keeps legislating against (R-6, R-11), committed by the
        // tool built to detect it.
        var integrity = this._traversalIntegrity(ctx, data)

        if (!links.length && integrity.complete) {
            findings.push({
                finding: 'no_trigger_wiring',
                severity: 'high',
                subject: 'sn_aia_trigger_agent_usecase_m2m',
                detail:
                    'No trigger link was found on either branch — agent-direct (' +
                    (ctx.trigger_branches.agent_direct || 0) +
                    ' rows) or the team/usecase chain (' +
                    (ctx.trigger_branches.team_usecase_chain || 0) +
                    ' rows, over ' +
                    (ctx.trigger_usecase_ids || []).length +
                    ' use case(s)). Every read behind this traversal succeeded, so the absence is real. ' +
                    'An agent with no trigger wiring never starts on its own, and leaves NO execution ' +
                    'plan — the absence is the diagnosis.',
                next_step:
                    'If the agent is invoked conversationally this is expected. If it is meant to fire on a ' +
                    'record event, the trigger configuration is missing.',
            })
        } else if (!links.length) {
            findings.push({
                finding: 'trigger_wiring_unreadable',
                severity: 'high',
                subject: 'sn_aia_trigger_agent_usecase_m2m',
                detail:
                    'No trigger link was found, but the traversal was INCOMPLETE — ' +
                    (integrity.denied.length ? 'denied: ' + integrity.denied.join(', ') + '. ' : '') +
                    (integrity.truncated.length
                        ? 'truncated: ' + integrity.truncated.join(', ') + '. '
                        : '') +
                    'The wiring state is UNKNOWN, not absent. Do not diagnose this agent as unwired on ' +
                    'the strength of this result.',
                next_step: integrity.denied.length
                    ? 'Re-run with a role that can read ' +
                      integrity.denied.join(' and ') +
                      ', or check the wiring in AI Agent Studio directly.'
                    : 'Narrow the query so the truncated read fits inside its ceiling, or check the ' +
                      'wiring in AI Agent Studio directly.',
            })
        } else if (!integrity.complete) {
            findings.push({
                finding: 'trigger_traversal_partial',
                severity: 'medium',
                subject: 'sn_aia_trigger_agent_usecase_m2m',
                detail:
                    'Trigger links were found, but the traversal was incomplete — ' +
                    (integrity.denied.length ? 'denied: ' + integrity.denied.join(', ') + '. ' : '') +
                    (integrity.truncated.length
                        ? 'truncated: ' + integrity.truncated.join(', ') + '. '
                        : '') +
                    'There may be further wiring this result does not show.',
                next_step: 'Treat the link list below as a lower bound rather than the complete set.',
            })
        }

        return {
            links: links,
            branches: ctx.trigger_branches,
            truncated_at: ctx.trigger_truncated,
            traversal_integrity: integrity,
            usecases_walked: ctx.trigger_usecase_ids || [],
            wiring_findings: findings,
            access_alignment: this._accessAlignment(ctx, links, data),
            // The 38/40 below sits immediately beside `branches`, which holds
            // THIS agent's real per-branch link counts — so it needs the
            // REFERENCE_STAT label, not merely the "measured over the whole
            // table" phrasing it already had. Two of the six sites the #85
            // audit found were already scoped that way and were misread
            // anyway; the label has to say what the number is NOT about.
            traversal_note:
                'sn_aia_trigger_agent_usecase_m2m has no agent and no usecase column — it is a polymorphic ' +
                'trigger-to-resource link. Both branches are walked from related_resource_record: ' +
                'agent-direct, and the team/usecase chain. ' +
                this._k().REFERENCE_STAT +
                'Over the whole table on gpinst01 (2026-08-01), 38 of 40 rows (95%) carry ' +
                'related_resource_table=sn_aia_usecase and only 2 carry sn_aia_agent — so a traversal ' +
                'walking only the agent-direct branch misses 95% of the wiring and reports a wired agent ' +
                'as unwired (DESIGN.md R-18a). For this agent, see branches above.',
        }
    },

    // =======================================================================
    // Access alignment (K26 Lab 1 / R-18a)
    // =======================================================================

    /**
     * WHAT THIS MAY AND MAY NOT CLAIM — R-18a, and the boundary is the point.
     *
     * The PLATFORM enforces two independent gates: User Access (who may
     * discover and execute the agent) and Data Access (which roles execute
     * runtime operations). The invoking user's role must satisfy BOTH, and a
     * failure terminates the run as a Security Violation with no surface-level
     * config error anywhere. That is real and it is the K26 Lab 1 semantic.
     *
     * What this TOOL cannot do is say which gate any given role row belongs to.
     * No structural field records it — `sys_agent_access_role_configuration` is
     * keyed polymorphically by agent + agent_table and the User/Data split is
     * conventional, carried in free-text `description`. So: one combined role
     * set, each row's description attached, the heuristic stated plainly. Never
     * two verified lists, and never "both lists check out" — the tool is not in
     * a position to know that.
     *
     * MEASURED 2026-08-01 on gpinst01, and it makes the boundary tighter still:
     * of 703 configuration rows, 638 (91%) have an EMPTY `description`. The one
     * signal LLD §4.2 says the User/Data distinction is carried in is absent
     * from nine rows in ten. `action` is not a substitute — it is a mandatory
     * choice reading "Limit To Roles" on 703 of 703 rows, so it carries no
     * discriminating information at all on this instance. The tool therefore
     * says even less than §4.2 anticipated, and says so explicitly rather than
     * emitting a null description that reads as "nothing to see here".
     */
    _accessAlignment: function (ctx, links, data) {
        var k = this._k()

        var probe = k.validFields('sys_agent_access_role_configuration', this.ACCESS_CONFIG_CANDIDATES, data)
        var out = {
            statement:
                'The platform enforces two independent access gates and the invoking role must satisfy ' +
                'both. This tool reports ONE combined role set because no field distinguishes them.',
            // The 638/703 sits beside role_rows — THIS agent's own rows, each
            // carrying a description a reader can see for themselves. Labelled
            // per issue #85.
            caveat:
                'Attributing any role below to User Access rather than Data Access is HEURISTIC — the ' +
                'only signal is the free-text description on each row, and it is usually blank. ' +
                k.REFERENCE_STAT +
                'On the instance this tool was built against, that description is empty on 638 of 703 ' +
                'rows (91%). Confirm the split in AI Agent Studio\'s Define User Access / Define Data ' +
                'Access panels before acting on it.',
            config_fields_probed: this.ACCESS_CONFIG_CANDIDATES,
            config_fields_valid: probe.valid,
            role_rows: [],
            run_as: [],
            missing_roles: null,
            comparison_status: 'not_possible',
            comparison_note: '',
        }

        out.config_probe_status = probe.status

        if (probe.status === 'DENIED') {
            out.comparison_note =
                'sys_agent_access_role_configuration is not readable from this scope. The access ' +
                'configuration is unknown, not absent.'
            return out
        }
        if (probe.status !== 'ok') {
            // The probe stopped part-way, so `valid` is a prefix of the
            // candidate list, not an answer about it. Reading with that list
            // would quietly omit whichever columns were never reached — and
            // role_list is one of them, so the requirement set could come back
            // empty for a reason that has nothing to do with the data.
            out.comparison_note =
                'The field probe on sys_agent_access_role_configuration did not complete (status "' +
                probe.status +
                '"), so only ' +
                probe.valid.length +
                ' of ' +
                probe.probed.length +
                ' candidate columns were confirmed. Reading with a partial column list would silently ' +
                'omit whichever were never reached, so the access role set was NOT read. Unknown, not ' +
                'absent.'
            return out
        }
        if (probe.valid.indexOf('agent') === -1 || probe.valid.indexOf('agent_table') === -1) {
            out.comparison_note =
                'sys_agent_access_role_configuration does not declare the agent / agent_table pair this ' +
                'check keys on, so the role set could not be read. Fields the table does declare: ' +
                (probe.valid.length ? probe.valid.join(', ') : 'none of the probed candidates') +
                '. This is a schema mismatch, not an empty access configuration.'
            return out
        }

        var subjects = []
        if (ctx.agent_sys_id) subjects.push({ table: 'sn_aia_agent', record: ctx.agent_sys_id })
        var usecaseIds = ctx.trigger_usecase_ids || k.ids(this._ensureUsecases(ctx, data))
        for (var s = 0; s < usecaseIds.length; s++) {
            subjects.push({ table: 'sn_aia_usecase', record: usecaseIds[s] })
        }

        var requiredRoles = {}
        var permissiveRows = 0
        var i

        for (i = 0; i < subjects.length; i++) {
            var subject = subjects[i]
            var read = k.readRows(
                'sys_agent_access_role_configuration',
                (function (sub) {
                    return function (gr) {
                        gr.addQuery('agent', sub.record)
                        gr.addQuery('agent_table', sub.table)
                    }
                })(subject),
                probe.valid,
                [],
                this.MAX_ROLE_ROWS,
                null,
                data
            )

            if (read.truncated_at) {
                out.role_rows_truncated_at = read.truncated_at
            }

            for (var r = 0; r < read.rows.length; r++) {
                var row = read.rows[r]
                var roles = this._rolesForConfig(row, data)

                // `allow_all_session_roles` makes this row's role list MOOT:
                // the configuration accepts whatever roles the session carries,
                // so nothing in the list is required and a role the run-as user
                // lacks is not a gap. Merging these into requiredRoles produces
                // a false missing_roles entry — and, because a missing role
                // reads as the K26 Lab 1 security-violation cause, a confident
                // wrong diagnosis of the most serious kind this tool emits.
                // Live on 47 of 703 configuration rows (6.7%) on gpinst01, so
                // this is a path real instances take, not a hypothetical.
                var permissive = k.lower(row.allow_all_session_roles) === 'true'
                if (!permissive) {
                    for (var x = 0; x < roles.length; x++) {
                        if (roles[x].sys_id) requiredRoles[roles[x].sys_id] = roles[x]
                    }
                } else {
                    permissiveRows++
                }

                var description = row.description === undefined ? '' : row.description
                out.role_rows.push({
                    config_sys_id: row.sys_id,
                    config_name: row.name === undefined ? null : row.name,
                    subject_table: subject.table,
                    subject_record: subject.record,
                    action: row.action === undefined ? null : row.action,
                    // The ONLY signal for which gate this row serves. Emitted
                    // verbatim rather than interpreted — and when it is empty,
                    // said so, because a null here means the gate is
                    // unknowable from the data, not that the row is unremarkable.
                    description: description || null,
                    gate_attribution: description
                        ? 'heuristic — read the description, then confirm in Studio'
                        : 'UNKNOWABLE — this row has no description, which is the only signal',
                    // A true value here makes the role list below moot: the
                    // configuration accepts any role the session carries.
                    allow_all_session_roles:
                        row.allow_all_session_roles === undefined ? null : row.allow_all_session_roles,
                    roles: roles,
                    roles_truncated_at: roles.truncated || null,
                    // Stated per row, because the same role list means opposite
                    // things depending on this flag.
                    roles_are_required: !permissive,
                    roles_note: permissive
                        ? 'allow_all_session_roles is true on this row, so its role list is NOT a ' +
                          'requirement — the configuration accepts whatever roles the session carries. ' +
                          'These roles are listed for information and are excluded from the missing-role ' +
                          'comparison.'
                        : null,
                })
            }
        }

        out.permissive_rows = permissiveRows
        out.required_role_count = Object.keys(requiredRoles).length
        if (out.role_rows_truncated_at) {
            out.truncation_note =
                'Access configuration rows were truncated at ' +
                out.role_rows_truncated_at +
                ' per subject. The required-role set below is a LOWER BOUND, so a run-as identity reported ' +
                'as holding every required role may still be missing one that was never read. Stated ' +
                'rather than silently applied.'
        }
        if (permissiveRows) {
            out.permissive_note =
                permissiveRows +
                ' of ' +
                out.role_rows.length +
                ' configuration row(s) set allow_all_session_roles=true. Their roles are excluded from the ' +
                'comparison below because the configuration accepts any role the session carries — ' +
                'treating them as required would report a missing role, which reads as the ACL-trigger ' +
                'security-violation cause.'
        }

        // --- the run-as side -------------------------------------------------
        //
        // `run_as` is NOT a user. Its dictionary type is field_name: it names a
        // FIELD on the trigger's target_table, and the identity is whoever sits
        // in that field on the record that fired the trigger — caller_id,
        // assigned_to, employee are the real values on gpinst01. That is the
        // K26 Lab 1 semantic exactly ("the trigger invokes the workflow under
        // the INITIATING user's context"), and it means the identity is
        // per-record and cannot be resolved from configuration at all.
        //
        // The static `run_as_user` reference is the only path a config-time
        // comparison can cover, and it is the RARE one: 3 of 36 trigger
        // configurations on gpinst01 (8%) set it, against 18 of 36 (50%) that
        // set the run_as field. So a "no missing roles" result here covers a
        // minority of the wiring, and the tool has to say which paths it did
        // and did not check rather than letting silence imply coverage.
        var users = {}
        var byPath = { static_user: 0, per_record_field: 0, script: 0, none: 0 }

        for (i = 0; i < links.length; i++) {
            var t = links[i].trigger
            if (!t) continue

            var path = 'none'
            if (t.run_as_user) path = 'static_user'
            else if (t.run_as_field) path = 'per_record_field'
            else if (t.run_as_script && t.run_as_script.present) path = 'script'
            byPath[path]++

            var entry = {
                trigger_sys_id: t.sys_id,
                trigger_name: t.name || null,
                target_table: t.target_table || null,
                identity_resolution: path,
                run_as_field: t.run_as_field || null,
                run_as_user: t.run_as_user || '',
                run_as_user_name: t.run_as_user_name || null,
                run_as_script_present: t.run_as_script ? t.run_as_script.present : false,
                comparable:
                    path === 'static_user'
                        ? true
                        : false,
                note:
                    path === 'per_record_field'
                        ? 'The identity is read from ' +
                          (t.target_table || 'the target table') +
                          '.' +
                          t.run_as_field +
                          ' on whichever record fires the trigger, so it varies per execution and cannot ' +
                          'be checked from configuration. Compare the role set against a REAL failing ' +
                          "run's initiating user — agent_trace reports it."
                        : path === 'script'
                          ? 'The identity is computed by run_as_script, so it cannot be resolved from ' +
                            'configuration. The script body is in the trigger link above.'
                          : path === 'none'
                            ? 'This trigger names no run-as identity at all.'
                            : null,
            }
            out.run_as.push(entry)
            if (t.run_as_user) users[t.run_as_user] = entry
        }
        out.run_as_paths = byPath

        var userIds = Object.keys(users)
        if (!userIds.length) {
            out.comparison_status = 'not_possible'
            out.comparison_note =
                'No trigger supplies a STATIC run-as user, so there is no identity to compare the role set ' +
                'against. Of ' +
                links.length +
                ' trigger link(s): ' +
                byPath.per_record_field +
                ' resolve the identity from a field on the triggering record, ' +
                byPath.script +
                ' from a script, and ' +
                byPath.none +
                ' name none. This is the NORMAL shape — a static run-as user is set on roughly one trigger ' +
                'in twelve — and it is the reason ACL-trigger misalignment is invisible from configuration. ' +
                'Take the initiating user from a real failing run (agent_trace) and compare their roles ' +
                'against the set above.'
            return out
        }

        var missing = []
        var comparedUsers = []
        var uncomparableUsers = []
        for (i = 0; i < userIds.length; i++) {
            var userId = userIds[i]
            var held = k.readRows(
                'sys_user_has_role',
                k.eqQuery('user', userId),
                ['sys_id', 'user', 'role'],
                ['role'],
                this.MAX_USER_ROLES,
                null,
                data
            )

            // Note on what a denial here means: the Foundry MCP toolset refuses
            // sys_user_has_role outright ("restricted for security reasons"),
            // which per R-8 says NOTHING about in-tool readability — a REST or
            // MCP denial is an API-layer restriction, not an ACL result. So the
            // read is attempted and the degradation reported, rather than the
            // capability being written off in advance.
            if (held.status === 'DENIED') {
                // One unreadable identity does not invalidate the ones that WERE
                // read. Discarding their results would throw away a real missing
                // -role finding because a different user could not be checked.
                uncomparableUsers.push({ user: userId, reason: 'sys_user_has_role not readable' })
                continue
            }
            if (held.truncated_at) {
                // A PARTIAL role set cannot support a "this identity lacks X"
                // claim: the roles it actually holds may be among the ones not
                // read, and the output of that mistake is a false security-
                // violation diagnosis.
                uncomparableUsers.push({
                    user: userId,
                    reason:
                        'holds more than ' +
                        held.truncated_at +
                        ' role assignments, so the set read is partial and cannot show what is missing',
                })
                continue
            }
            comparedUsers.push(userId)

            var heldSet = {}
            for (var h = 0; h < held.rows.length; h++) {
                var roleRef = k.refValue(held.rows[h].role)
                if (roleRef) heldSet[roleRef] = true
            }

            var lacking = []
            var requiredIds = Object.keys(requiredRoles)
            for (var q = 0; q < requiredIds.length; q++) {
                if (!heldSet[requiredIds[q]]) lacking.push(requiredRoles[requiredIds[q]])
            }
            if (lacking.length) {
                missing.push({
                    user: userId,
                    user_name: users[userId].run_as_user_name,
                    roles: lacking,
                    meaning:
                        'This run-as identity does not hold these roles. Because the two gates cannot be ' +
                        'separated here, a missing role may block discovery, runtime data access, or ' +
                        'both — and the run terminates as a Security Violation with no config error.',
                })
            }
        }

        out.users_compared = comparedUsers.length
        out.users_not_comparable = uncomparableUsers.length
        out.not_comparable = uncomparableUsers

        // An empty required set makes every comparison vacuously true. Reporting
        // that as "completed — every identity holds every role" is a clean bill
        // of health issued over nothing checked, which is the shape of wrong
        // answer this tool exists to catch. Say WHY the set is empty instead:
        // the three causes need different responses.
        if (!out.required_role_count) {
            out.comparison_status = 'no_requirements'
            out.comparison_note =
                'No roles were required, so there was nothing to compare and this is NOT an all-clear. ' +
                (out.role_rows.length === 0
                    ? 'No access configuration rows exist for this agent or its use cases at all — which ' +
                      'may itself be the finding, since an agent with no access configuration is governed ' +
                      'by whatever default the platform applies.'
                    : out.permissive_rows === out.role_rows.length
                      ? 'All ' +
                        out.role_rows.length +
                        ' configuration row(s) set allow_all_session_roles=true, so none of their roles is ' +
                        'a requirement.'
                      : 'The configuration rows carry no resolvable roles.') +
                (out.role_rows_truncated_at
                    ? ' Role rows were also TRUNCATED at ' +
                      out.role_rows_truncated_at +
                      ', so the requirement set may be incomplete.'
                    : '')
            return out
        }

        if (!comparedUsers.length) {
            out.comparison_status = 'not_possible'
            out.comparison_note =
                'No static run-as user could be compared (' +
                userIds.length +
                ' examined). Reasons: ' +
                this._reasonSummary(uncomparableUsers) +
                '. The role set above is still what the agent requires.'
            return out
        }

        // Whatever WAS computed is reported, even when another identity could
        // not be read. A missing role found for user A is a real finding
        // regardless of whether user B was readable.
        out.missing_roles = missing.length ? missing : []

        if (uncomparableUsers.length) {
            out.comparison_status = 'partial'
            out.comparison_note =
                (missing.length
                    ? 'At least one static run-as identity is missing a required role — see missing_roles. '
                    : 'Every static run-as identity that COULD be read holds every required role. ') +
                comparedUsers.length +
                ' of ' +
                userIds.length +
                ' static run-as user(s) were comparable; the other ' +
                uncomparableUsers.length +
                ' could not be (' +
                this._reasonSummary(uncomparableUsers) +
                '). An empty missing_roles here does NOT mean every identity checks out, because ' +
                uncomparableUsers.length +
                ' were never checked. This does not certify either access gate — see caveat.'
            return out
        }

        var clipped = this._requirementsClipped(out)
        if (clipped) {
            // The requirement set is a lower bound, so "holds every required
            // role" is unprovable — an identity can hold everything that was
            // read and still lack one that was not.
            out.requirements_incomplete_because = clipped
            out.comparison_status = 'partial'
            out.comparison_note =
                (missing.length
                    ? 'At least one static run-as identity is missing a required role — see missing_roles. '
                    : 'Every static run-as identity holds every role in the requirement set that was read. ') +
                'But that set is INCOMPLETE — ' +
                clipped +
                ' — so an identity reported as holding every required role may still lack one that was ' +
                'never read. Do not read this as an access all-clear.'
            return out
        }

        out.comparison_status = 'completed'
        out.comparison_note =
            (missing.length
                ? 'At least one static run-as identity is missing a required role. See missing_roles. '
                : 'Every STATIC run-as identity holds every role in the combined set. ') +
            'Coverage: ' +
            userIds.length +
            ' of ' +
            links.length +
            ' trigger link(s) were comparable; ' +
            byPath.per_record_field +
            ' resolve their identity per triggering record and ' +
            byPath.script +
            ' from a script, and neither can be checked from configuration. This does NOT certify either ' +
            'access gate individually — see caveat.'
        return out
    },

    /**
     * Roles for one configuration row: the `role_list` column where present,
     * plus the `sys_agent_access_role_mapping` breakout. Neither table's schema
     * was read from sys_dictionary, so the join and role columns are PROBED —
     * a guessed field name queries as blank and reports an agent with no access
     * configuration at all (R-6).
     */
    _rolesForConfig: function (row, data) {
        var k = this._k()
        var out = []
        var seen = {}
        var i

        var listed = String(row.role_list === undefined ? '' : row.role_list)
        if (listed) {
            var parts = listed.split(',')
            if (parts.length > this.MAX_ROLE_NAMES) out.truncated = this.MAX_ROLE_NAMES
            for (i = 0; i < parts.length && out.length < this.MAX_ROLE_NAMES; i++) {
                var id = k.trim(parts[i])
                if (!id || seen[id]) continue
                seen[id] = true
                out.push({ sys_id: id, name: this._roleName(id, data), source: 'role_list' })
            }
        }

        if (!this._mappingProbe) {
            this._mappingProbe = {
                join: k.validFields(
                    'sys_agent_access_role_mapping',
                    this.ACCESS_MAPPING_JOIN_CANDIDATES,
                    data
                ),
                role: k.validFields(
                    'sys_agent_access_role_mapping',
                    this.ACCESS_MAPPING_ROLE_CANDIDATES,
                    data
                ),
            }
        }

        var joinProbe = this._mappingProbe.join
        var roleProbe = this._mappingProbe.role
        var joinField = joinProbe.valid.length ? joinProbe.valid[0] : null
        var roleField = roleProbe.valid.length ? roleProbe.valid[0] : null

        if (joinProbe.status !== 'ok' || roleProbe.status !== 'ok') {
            // An incomplete probe here means the per-role breakout may exist
            // and simply not have been reachable. Returning the role_list rows
            // alone would present a partial set as the whole one.
            out.mapping_probe_status = joinProbe.status + '/' + roleProbe.status
            return out
        }
        if (!joinField || !roleField) return out

        var mapped = k.readRows(
            'sys_agent_access_role_mapping',
            k.eqQuery(joinField, row.sys_id),
            ['sys_id', joinField, roleField],
            [roleField],
            this.MAX_ROLE_NAMES,
            null,
            data
        )

        if (mapped.truncated_at) out.truncated = mapped.truncated_at

        for (i = 0; i < mapped.rows.length; i++) {
            var ref = k.refValue(mapped.rows[i][roleField])
            if (!ref || seen[ref]) continue
            seen[ref] = true
            out.push({
                sys_id: ref,
                name: mapped.rows[i][roleField + '_display'] || this._roleName(ref, data),
                source: 'sys_agent_access_role_mapping.' + joinField,
            })
        }

        return out
    },

    /**
     * Every way the requirement set can be a lower bound, in one place.
     *
     * There are three, and the first version of the completed-gate consulted
     * exactly one of them — the config-row count — so a single row carrying
     * more roles than the per-row cap still produced an all-clear. Enumerating
     * them here means a fourth source has one obvious place to be added, rather
     * than a condition somewhere else to be remembered.
     *
     * @returns {String|null} why the set is incomplete, or null if it is not
     */
    _requirementsClipped: function (out) {
        var reasons = []

        if (out.role_rows_truncated_at) {
            reasons.push('access configuration rows were truncated at ' + out.role_rows_truncated_at)
        }

        var clippedRows = 0
        for (var i = 0; i < out.role_rows.length; i++) {
            if (out.role_rows[i].roles_truncated_at) clippedRows++
        }
        if (clippedRows) {
            reasons.push(
                clippedRows +
                    ' configuration row(s) carry more roles than the per-row ceiling, so their role lists ' +
                    'are partial'
            )
        }

        return reasons.length ? reasons.join('; ') : null
    },

    /** Distinct reasons an identity could not be compared, with counts. */
    _reasonSummary: function (entries) {
        var counts = {}
        var order = []
        var i

        for (i = 0; i < entries.length; i++) {
            var reason = entries[i].reason
            if (counts[reason] === undefined) {
                counts[reason] = 0
                order.push(reason)
            }
            counts[reason]++
        }

        var parts = []
        for (i = 0; i < order.length; i++) {
            parts.push(counts[order[i]] + ' × ' + order[i])
        }
        return parts.length ? parts.join('; ') : 'none recorded'
    },

    /** A bare sys_id is unreadable to a diagnostician. Degrade to it silently is fine. */
    _roleName: function (sysId, data) {
        var k = this._k()
        if (!this._roleCache) this._roleCache = {}
        if (this._roleCache[sysId] !== undefined) return this._roleCache[sysId]

        var read = k.readOne('sys_user_role', sysId, ['sys_id', 'name'], [], data)
        var name = read.row ? read.row.name || null : null
        this._roleCache[sysId] = name
        return name
    },

    // =======================================================================
    // Shaping
    // =======================================================================

    _slim: function (rows, fields) {
        var out = []
        for (var i = 0; i < rows.length; i++) {
            var o = {}
            for (var f = 0; f < fields.length; f++) {
                o[fields[f]] = rows[i][fields[f]]
            }
            out.push(o)
        }
        return out
    },

    /**
     * The failure mode this tool must not have: a plausible-looking config
     * summary rendered from rows that were never read. States, per section,
     * what the output actually came from.
     */
    _evidenceBasis: function (data, ctx) {
        var c = ctx || {}
        var k = this._k()

        // Every bound that was hit, surfaced whether or not the section that
        // hit it thought to mention it. Four review rounds produced four silent
        // caps in this file alone; the fix that stops the fifth is structural,
        // not another remembered call site (DESIGN.md R-24).
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
                'configuration.',
            agent_rows: c.agent_row ? 1 : 0,
            usecase_rows: c.usecases ? c.usecases.length : 0,
            tool_binding_rows: c.bindings ? c.bindings.length : 0,
            trigger_link_rows: c.trigger_links ? c.trigger_links.length : 0,
            read_status_by_table: data.reads,
            tables_with_missing_fields: data.field_warnings.length,
        }
    },

    type: 'PaToolAgentConfig',
}
