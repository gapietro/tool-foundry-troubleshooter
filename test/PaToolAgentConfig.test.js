/**
 * PaToolAgentConfig — LLD §4.2, agent definition inspection.
 *
 * These tests pin the four things that have already gone wrong once, in the
 * design or in a sibling tool:
 *
 *   R-18a  the trigger traversal runs agent -> m2m, keyed on
 *          related_resource_record, and BOTH branches must be walked. The first
 *          version of that correction had it backwards, and walking only the
 *          agent-direct branch reports a wired agent as unwired — a blank, not
 *          an error (R-6). Branch 2 held 5 of 6 sampled rows.
 *   R-18a  the access check may not present User Access and Data Access as two
 *          verified lists, and may not report "both lists check out". No field
 *          distinguishes them.
 *   R-9    every input may be absent; no arguments returns a pick-list, not an
 *          error.
 *   R-6    a DENIED read is never rendered as an absence.
 *
 * What this CANNOT verify (DESIGN.md R-8): that these table and field names are
 * right, or that any of it is readable from x_snc_troubleshoot. A stubbed row
 * set is not evidence about the platform. Those are on-instance checks.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeQueryingGlideRecordSecure } = require('./_glideStub')

const AGENT = 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1'
const USECASE = 'u1u1u1u1u1u1u1u1u1u1u1u1u1u1u1u1'
const TEAM = 'e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1'

/** A healthy agent wired through the team/usecase chain — the common shape. */
function world(overrides) {
    const base = {
        sn_aia_agent: [
            {
                sys_id: AGENT,
                name: 'Seed Agent',
                internal_name: 'seed_agent',
                description: 'An agent used as a fixture.',
                role: 'You are a fixture.',
                instructions: 'Do the fixture thing.',
                proficiency: 'intermediate',
                strategy: 'strat1',
                strategy__display: 'ReAct',
                channel: 'nap_and_va',
                agent_type: 'internal',
                context_processing_script: '',
                applicability_script: '',
            },
        ],
        sn_aia_usecase: [
            { sys_id: USECASE, name: 'Seed Usecase', team: TEAM, base_plan: 'plan text' },
        ],
        sn_aia_team_member: [{ sys_id: 'tmem1', agent: AGENT, team: TEAM }],
        sn_aia_agent_tool_m2m: [],
        sn_aia_tool: [],
        sn_aia_trigger_agent_usecase_m2m: [],
        sn_aia_trigger_configuration: [],
        sys_agent_access_role_configuration: [],
        sys_agent_access_role_mapping: [],
        sys_user_has_role: [],
    }
    return Object.assign(base, overrides || {})
}

function run(args, tables, options) {
    const GlideRecordSecure = makeQueryingGlideRecordSecure(tables, options)
    // The kit must be loaded with the SAME stub: a vm context resolves a
    // script's free variables against its own sandbox, so a kit loaded without
    // GlideRecordSecure raises a ReferenceError on every read — which its R-1
    // catch faithfully records as DENIED. On the platform both live in one
    // scope; here they do not unless we say so.
    const kitCtx = loadScriptInclude('PaToolReadKit.js', { GlideRecordSecure: GlideRecordSecure })
    const ctx = loadScriptInclude('tools/PaToolAgentConfig.js', {
        GlideRecordSecure: GlideRecordSecure,
        PaToolReadKit: kitCtx.PaToolReadKit,
    })
    return { result: new ctx.PaToolAgentConfig().execute(args), queries: GlideRecordSecure.calls.queries }
}

describe('argument handling (R-9)', () => {
    it('returns an agent pick-list when called with no arguments at all', () => {
        const { result } = run(undefined, world())

        expect(result.success).toBe(true)
        expect(result.data.resolution.mode).toBe('list')
        expect(result.data.resolution.candidates.length).toBeGreaterThan(0)
        // A missing argument is expected, not a fault. Saying "agent is
        // required" would read as a platform error to a diagnostician.
        expect(result.data.resolution.note).toMatch(/not an error/i)
    })

    it('accepts a bare sys_id string', () => {
        const { result } = run(AGENT, world())

        expect(result.data.resolution.agent.sys_id).toBe(AGENT)
        expect(result.data.resolution.agent.name).toBe('Seed Agent')
    })

    it('accepts a bare name string', () => {
        const { result } = run('Seed Agent', world())
        expect(result.data.resolution.agent.sys_id).toBe(AGENT)
    })

    it('accepts a JSON string, which is how complex inputs arrive at runtime', () => {
        const { result } = run(JSON.stringify({ agent: 'Seed Agent', section: 'overview' }), world())

        expect(result.data.resolution.agent.sys_id).toBe(AGENT)
        expect(result.data.sections_returned).toEqual(['overview'])
    })

    it('reports a string that meant to be JSON and was not, rather than treating it as a name', () => {
        const { result } = run('{"agent": broken', world())

        expect(result.success).toBe(true)
        expect(result.data.notes.join(' ')).toMatch(/did not parse/i)
    })

    it('falls back to every section when an unknown section is asked for, and says so', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'wiring' }, world())

        expect(result.data.sections_returned).toEqual(['overview', 'instructions', 'tools', 'triggers'])
        expect(result.data.notes.join(' ')).toContain('wiring')
    })

    it('returns all four sections by default', () => {
        const { result } = run('Seed Agent', world())
        expect(result.data.sections_returned).toEqual(['overview', 'instructions', 'tools', 'triggers'])
    })
})

describe('resolution', () => {
    it('names both read statuses when nothing matches, so a miss is not read as a denial', () => {
        const { result } = run('No Such Agent', world())

        expect(result.success).toBe(true)
        expect(result.data.resolution.note).toContain('sn_aia_agent')
        expect(result.data.resolution.note).toContain('sn_aia_usecase')
    })

    it('reports a DENIED agent read as a privilege gap, never as a missing agent', () => {
        const { result } = run('Seed Agent', world(), { denied: ['sn_aia_agent'] })

        expect(result.success).toBe(true)
        expect(result.data.reads.sn_aia_agent).toBe('DENIED')
        expect(result.data.resolution.note).toMatch(/DENIED/)
    })

    it('anchors on the use case when the name matches one but no agent', () => {
        const { result } = run('Seed Usecase', world())

        expect(result.data.resolution.matched_usecases).toHaveLength(1)
        expect(result.data.resolution.note).toMatch(/use case/i)
    })
})

describe('trigger traversal (R-18a)', () => {
    const triggerRow = {
        sys_id: 'trg1',
        active: 'true',
        condition: 'active=true',
        target_table: 'incident',
        objective_template: 'Do the thing',
        channel: 'ch1',
        channel__display: 'Now Assist Panel',
        trigger_strategy: 'react',
        run_as: 'user',
        run_as_user: 'user1',
    }

    it('finds a trigger linked directly to the agent', () => {
        const { result } = run(
            { agent: 'Seed Agent', section: 'triggers' },
            world({
                sn_aia_trigger_agent_usecase_m2m: [
                    {
                        sys_id: 'tm2m1',
                        trigger_configuration: 'trg1',
                        related_resource_table: 'sn_aia_agent',
                        related_resource_record: AGENT,
                        active: 'true',
                    },
                ],
                sn_aia_trigger_configuration: [triggerRow],
            })
        )

        expect(result.data.triggers.links).toHaveLength(1)
        expect(result.data.triggers.links[0].found_via).toBe('agent_direct')
        expect(result.data.triggers.branches).toEqual({ agent_direct: 1, team_usecase_chain: 0 })
    })

    it('finds a trigger linked through the team/usecase chain — the branch that holds most rows', () => {
        // The regression that matters: walking only the agent-direct branch
        // reports this agent as unwired. 5 of 6 sampled rows live here.
        const { result } = run(
            { agent: 'Seed Agent', section: 'triggers' },
            world({
                sn_aia_trigger_agent_usecase_m2m: [
                    {
                        sys_id: 'tm2m2',
                        trigger_configuration: 'trg1',
                        related_resource_table: 'sn_aia_usecase',
                        related_resource_record: USECASE,
                        active: 'true',
                    },
                ],
                sn_aia_trigger_configuration: [triggerRow],
            })
        )

        expect(result.data.triggers.links).toHaveLength(1)
        expect(result.data.triggers.links[0].found_via).toBe('team_usecase_chain')
        expect(result.data.triggers.wiring_findings).toEqual([])
    })

    it('queries the m2m on related_resource_record, never on trigger_configuration', () => {
        // Keying on trigger_configuration is the inverted traversal R-18a
        // caught: there is no trigger sys_id at this point, and it skips the
        // agent-direct rows entirely.
        const { queries } = run({ agent: 'Seed Agent', section: 'triggers' }, world())
        const m2m = queries.filter((q) => q.table === 'sn_aia_trigger_agent_usecase_m2m')

        expect(m2m.length).toBeGreaterThan(0)
        m2m.forEach((q) => {
            const fields = q.filters.map((f) => f.field)
            expect(fields).toContain('related_resource_record')
            expect(fields).toContain('related_resource_table')
            expect(fields).not.toContain('trigger_configuration')
        })
    })

    it('reports the m2m active flag and the trigger active flag separately', () => {
        const { result } = run(
            { agent: 'Seed Agent', section: 'triggers' },
            world({
                sn_aia_trigger_agent_usecase_m2m: [
                    {
                        sys_id: 'tm2m3',
                        trigger_configuration: 'trg1',
                        related_resource_table: 'sn_aia_agent',
                        related_resource_record: AGENT,
                        active: 'false',
                    },
                ],
                sn_aia_trigger_configuration: [Object.assign({}, triggerRow, { active: 'true' })],
            })
        )

        const link = result.data.triggers.links[0]
        expect(link.m2m_active).toBe('false')
        expect(link.trigger.active).toBe('true')
        // Either being false unwires the agent, so the finding must fire even
        // though the trigger record itself looks healthy.
        expect(result.data.triggers.wiring_findings.map((f) => f.finding)).toContain('inactive_link')
    })

    it('reports an agent with no links as unwired, stating both branches were walked', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'triggers' }, world())

        const findings = result.data.triggers.wiring_findings.map((f) => f.finding)
        expect(findings).toContain('no_trigger_wiring')
        expect(result.data.triggers.branches).toEqual({ agent_direct: 0, team_usecase_chain: 0 })
    })
})

describe('access alignment (R-18a — what the tool may claim)', () => {
    function withAccess() {
        return world({
            sys_agent_access_role_configuration: [
                {
                    sys_id: 'acc1',
                    agent: AGENT,
                    agent_table: 'sn_aia_agent',
                    description: 'User access for the seed agent',
                    role_list: 'role_itil',
                },
            ],
        })
    }

    it('emits one combined role set, never a User Access and Data Access split', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'triggers' }, withAccess())
        const access = result.data.triggers.access_alignment

        expect(access.role_rows).toHaveLength(1)
        expect(access.role_rows[0].description).toBe('User access for the seed agent')
        // No structural field distinguishes the two gates. Emitting keys named
        // for them would assert exactly what the tool cannot know.
        expect(Object.keys(access)).not.toContain('user_access')
        expect(Object.keys(access)).not.toContain('data_access')
    })

    it('states that attributing a role to one gate or the other is heuristic', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'triggers' }, withAccess())
        const access = result.data.triggers.access_alignment

        expect(access.caveat).toMatch(/heuristic/i)
        expect(access.caveat).toMatch(/Studio/)
    })

    it('never reports that both lists check out', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'triggers' }, withAccess())
        const rendered = JSON.stringify(result.data.triggers.access_alignment).toLowerCase()

        // The platform does enforce two gates and the invoking role must
        // satisfy both. The TOOL cannot attribute a row to a gate, so it is not
        // in a position to certify either one.
        expect(rendered).not.toContain('both lists')
        expect(rendered).not.toContain('check out')
    })

    it('reads the per-role breakout through agent_access_config', () => {
        // The join field, measured against sys_dictionary on gpinst01: the
        // table declares exactly three columns — role, agent_access_config,
        // sys_id. None of the five names originally guessed here matched, so
        // the breakout would have been skipped entirely while role_list rows
        // were reported as the complete picture.
        const { result } = run(
            { agent: 'Seed Agent', section: 'triggers' },
            world({
                sys_agent_access_role_configuration: [
                    { sys_id: 'acc1', agent: AGENT, agent_table: 'sn_aia_agent', description: 'd' },
                ],
                sys_agent_access_role_mapping: [
                    { sys_id: 'map1', agent_access_config: 'acc1', role: 'role_itil' },
                ],
                sys_user_role: [{ sys_id: 'role_itil', name: 'itil' }],
            })
        )

        const roles = result.data.triggers.access_alignment.role_rows[0].roles
        expect(roles).toHaveLength(1)
        expect(roles[0].name).toBe('itil')
        expect(roles[0].source).toBe('sys_agent_access_role_mapping.agent_access_config')
    })

    it('marks the gate unknowable when the row carries no description', () => {
        // 638 of 703 rows on gpinst01 (91%) have an empty description, and it
        // is the only signal for the User/Data split. A null here must not read
        // as "nothing notable about this row".
        const { result } = run(
            { agent: 'Seed Agent', section: 'triggers' },
            world({
                sys_agent_access_role_configuration: [
                    { sys_id: 'acc1', agent: AGENT, agent_table: 'sn_aia_agent', description: '' },
                ],
            })
        )

        expect(result.data.triggers.access_alignment.role_rows[0].gate_attribution).toMatch(/UNKNOWABLE/)
    })

    it('reports the comparison as not possible rather than passing when run-as roles cannot be read', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'triggers' }, withAccess(), {
            denied: ['sys_user_has_role'],
        })
        const access = result.data.triggers.access_alignment

        expect(access.comparison_status).toBe('not_possible')
        expect(access.missing_roles).toBeNull()
    })
})

describe('run-as identity paths', () => {
    function withTrigger(trigger) {
        return world({
            sn_aia_trigger_agent_usecase_m2m: [
                {
                    sys_id: 'l1',
                    trigger_configuration: 'trg1',
                    related_resource_table: 'sn_aia_agent',
                    related_resource_record: AGENT,
                    active: 'true',
                },
            ],
            sn_aia_trigger_configuration: [
                Object.assign(
                    { sys_id: 'trg1', name: 'Fires on incident', active: 'true', target_table: 'incident' },
                    trigger
                ),
            ],
            sys_agent_access_role_configuration: [
                { sys_id: 'acc1', agent: AGENT, agent_table: 'sn_aia_agent', role_list: 'role_itil' },
            ],
            sys_user_role: [{ sys_id: 'role_itil', name: 'itil' }],
        })
    }

    it('treats run_as as a field on the target table, not as a user', () => {
        // Dictionary type is field_name, and the real values on gpinst01 are
        // caller_id / assigned_to / employee. Reading this as a user reference
        // would invent an identity that does not exist.
        const { result } = run({ agent: 'Seed Agent', section: 'triggers' }, withTrigger({ run_as: 'caller_id' }))
        const access = result.data.triggers.access_alignment

        expect(access.run_as[0].identity_resolution).toBe('per_record_field')
        expect(access.run_as[0].run_as_field).toBe('caller_id')
        expect(access.run_as[0].comparable).toBe(false)
        expect(access.run_as[0].note).toContain('incident.caller_id')
    })

    it('states which trigger paths it could not check rather than implying coverage', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'triggers' }, withTrigger({ run_as: 'caller_id' }))
        const access = result.data.triggers.access_alignment

        // A static run-as user is set on 3 of 36 triggers (8%). Silence about
        // the other 92% would read as "checked and fine".
        expect(access.comparison_status).toBe('not_possible')
        expect(access.run_as_paths).toEqual({
            static_user: 0,
            per_record_field: 1,
            script: 0,
            none: 0,
        })
        expect(access.comparison_note).toMatch(/field on the triggering record|from a field on the triggering record/)
    })

    it('compares the roles when a static run-as user is set, and states the coverage', () => {
        const { result } = run(
            { agent: 'Seed Agent', section: 'triggers' },
            withTrigger({ run_as_user: 'user1' })
        )
        const access = result.data.triggers.access_alignment

        expect(access.comparison_status).toBe('completed')
        expect(access.missing_roles[0].roles[0].name).toBe('itil')
        expect(access.comparison_note).toContain('1 of 1 trigger link(s) were comparable')
    })

    it('reads the trigger name from the name column', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'triggers' }, withTrigger({}))
        expect(result.data.triggers.links[0].trigger.name).toBe('Fires on incident')
    })
})

describe('instructions section (R-7 / R-16)', () => {
    it('reads the two scripts from BOTH the agent and the use case', () => {
        const { result } = run(
            { agent: 'Seed Agent', section: 'instructions' },
            world({
                sn_aia_agent: [
                    Object.assign({}, world().sn_aia_agent[0], {
                        context_processing_script: 'agent copy of the script',
                    }),
                ],
                sn_aia_usecase: [
                    {
                        sys_id: USECASE,
                        name: 'Seed Usecase',
                        team: TEAM,
                        context_processing_script: 'usecase copy of the script',
                    },
                ],
            })
        )

        // The live gpinst01 specimen threw in the AGENT's copy, not the use
        // case's. Reading one side misses half the failure surface.
        expect(result.data.instructions.agent.context_processing_script.body).toContain('agent copy')
        expect(result.data.instructions.usecases[0].context_processing_script.body).toContain('usecase copy')
    })

    it('flags a populated context_processing_script as a verified failure vector', () => {
        const { result } = run(
            { agent: 'Seed Agent', section: 'instructions' },
            world({
                sn_aia_agent: [
                    Object.assign({}, world().sn_aia_agent[0], { context_processing_script: 'boilerplate' }),
                ],
            })
        )

        expect(result.data.instructions.script_findings.map((f) => f.finding)).toContain(
            'context_processing_script_populated'
        )
    })

    it('flags an applicability_script that ends in return false', () => {
        const { result } = run(
            { agent: 'Seed Agent', section: 'instructions' },
            world({
                sn_aia_agent: [
                    Object.assign({}, world().sn_aia_agent[0], {
                        applicability_script: '(function () {\n  return false;\n})();',
                    }),
                ],
            })
        )

        const finding = result.data.instructions.script_findings.find(
            (f) => f.finding === 'applicability_script_suppresses_agent'
        )
        expect(finding).toBeDefined()
        // It is a text scan, and R-7's claim that the platform auto-populates
        // this body was refuted on gpinst01. Say which one this is.
        expect(finding.confidence).toBe('heuristic')
    })

    it('carries instruction text in full rather than a 200-char digest', () => {
        const long = 'x'.repeat(3000)
        const { result } = run(
            { agent: 'Seed Agent', section: 'instructions' },
            world({
                sn_aia_agent: [Object.assign({}, world().sn_aia_agent[0], { instructions: long })],
            })
        )

        // The instruction text IS the layer-2 evidence. A digest here means the
        // full text never reaches the artifact either, because the store
        // offloads the result object rather than the source record.
        expect(result.data.instructions.agent.instructions).toHaveLength(3000)
        expect(result.data.instructions.agent.instructions_length).toBe(3000)
    })
})

describe('tool_smells (K26 Lab 3)', () => {
    function withTool(tool, binding) {
        return world({
            sn_aia_agent_tool_m2m: [
                Object.assign(
                    { sys_id: 'm1', agent: AGENT, tool: 'tool1', name: 'lookup_thing', active: 'true' },
                    binding || {}
                ),
            ],
            sn_aia_tool: [
                Object.assign(
                    {
                        sys_id: 'tool1',
                        name: 'lookup_thing',
                        type: 'script',
                        description:
                            'Purpose: looks a thing up, and do not use it for writes. Inputs: accepts a sys_id string. Outputs: returns a JSON object, or a structured error when it fails.',
                        input_schema: '[{"name":"id","description":"the id","mandatory":false}]',
                        script: '(function (inputs) {\n  if (!inputs.id) { return {success:false}; }\n  var gr = new GlideRecordSecure("incident");\n  gr.setLimit(10);\n  gr.query();\n  return {ok:true};\n})(inputs);',
                        active: 'true',
                    },
                    tool || {}
                ),
            ],
        })
    }

    it('finds nothing to report on a tool that meets the bar', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'tools' }, withTool())
        expect(result.data.tools.tool_smells).toEqual([])
    })

    it('states the denominator alongside the count (R-22)', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'tools' }, withTool())
        const stats = result.data.tools.tool_smell_stats

        // "3 smells" and "3 of 42 checks over 1 tool" are the same sentence
        // shape and only one of them can be checked.
        expect(stats.tools_checked).toBe(1)
        expect(stats.checks_per_tool).toBeGreaterThan(0)
        expect(stats.smells_found).toBe(0)
    })

    it('flags an empty tool description at high severity', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'tools' }, withTool({ description: '' }))
        const smell = result.data.tools.tool_smells.find((s) => s.smell === 'description_empty')

        expect(smell).toBeDefined()
        expect(smell.severity).toBe('high')
        expect(smell.confidence).toBe('high')
        // Build Rule #34: an empty description trips a platform Data Policy and
        // the tool record is skipped at install while its m2m installs anyway.
        expect(smell.why).toMatch(/Data Policy|silently skipped/i)
    })

    it('flags an input_schema that is a JSON-Schema object rather than an array', () => {
        const { result } = run(
            { agent: 'Seed Agent', section: 'tools' },
            withTool({ input_schema: '{"type":"object","properties":{"id":{"type":"string"}}}' })
        )
        const smell = result.data.tools.tool_smells.find((s) => s.smell === 'input_schema_not_array')

        expect(smell).toBeDefined()
        expect(smell.severity).toBe('high')
        // The single most expensive defect found in Phase 0: the execution
        // hangs In progress forever with no error at all.
        expect(smell.why).toMatch(/stall|never-terminating/i)
    })

    it('flags a script tool whose IIFE is missing the trailing invocation', () => {
        const { result } = run(
            { agent: 'Seed Agent', section: 'tools' },
            withTool({ script: '(function (inputs) {\n  return {ok:true};\n})' })
        )

        expect(result.data.tools.tool_smells.map((s) => s.smell)).toContain('script_missing_iife_invocation')
    })

    it('flags an unbounded query', () => {
        const { result } = run(
            { agent: 'Seed Agent', section: 'tools' },
            withTool({
                script: '(function (inputs) {\n  var gr = new GlideRecord("incident");\n  gr.query();\n  return {ok:true};\n})(inputs);',
            })
        )

        expect(result.data.tools.tool_smells.map((s) => s.smell)).toContain('script_unbounded_query')
    })

    it('flags an inactive binding, which stops the agent calling the tool at all', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'tools' }, withTool({}, { active: 'false' }))
        expect(result.data.tools.tool_smells.map((s) => s.smell)).toContain('binding_inactive')
    })

    it('reports tools it could not score rather than scoring them clean', () => {
        const { result } = run({ agent: 'Seed Agent', section: 'tools' }, withTool(), {
            denied: ['sn_aia_tool'],
        })

        // Zero smells over an unreadable tool row is the partial-read-as-absence
        // failure this whole project legislates against.
        expect(result.data.tools.tool_smell_stats.tools_not_scored).toBe(1)
        expect(result.data.tools.tool_smell_stats.tools_checked).toBe(0)
    })
})

describe('overview', () => {
    it('summarises wiring and tool counts', () => {
        const { result } = run(
            { agent: 'Seed Agent', section: 'overview' },
            world({
                sn_aia_agent_tool_m2m: [
                    { sys_id: 'm1', agent: AGENT, tool: 'tool1', name: 'a', active: 'true' },
                    { sys_id: 'm2', agent: AGENT, tool: 'tool2', name: 'b', active: 'false' },
                ],
            })
        )

        expect(result.data.overview.tool_count).toBe(2)
        expect(result.data.overview.active_tool_count).toBe(1)
        expect(result.data.overview.usecases).toHaveLength(1)
        expect(result.data.overview.strategy).toBe('ReAct')
    })
})

describe('evidence basis', () => {
    it('states which rows every section came from', () => {
        const { result } = run('Seed Agent', world())
        const basis = result.data.evidence_basis

        expect(basis.statement).toMatch(/DENIED/)
        expect(basis.read_status_by_table.sn_aia_agent).toBe('ok')
        expect(basis).toHaveProperty('tool_binding_rows')
        expect(basis).toHaveProperty('trigger_link_rows')
    })
})
