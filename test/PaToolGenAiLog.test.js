/**
 * PaToolGenAiLog — LLD §4.3, the GenAI-stack layer (layer 6).
 *
 * The tests that matter here are the ones guarding against the tool being
 * CONFIDENTLY WRONG, which is the failure mode this component has a documented
 * history of:
 *
 *   R-22  an empty `connection` is NORMAL — 318 of 2026 rows on gpinst01,
 *         mandatory=false, including shipped OOB definitions. LLD §4.3 used to
 *         say the opposite, and a tool built to that sentence reports 318
 *         healthy capabilities as broken.
 *   R-11  "unverifiable" and "dangling" are different answers. `api_type` is not
 *         always a table name (`Decision` is not), and a target table this
 *         scope cannot read is not a missing record.
 *   R-10  the prompt/response payload is role-gated. Absent it, the tool says
 *         so; it does not return an empty result that reads as "no payload".
 *   R-9   every input may be absent.
 *
 * What this CANNOT verify (R-8): that any of these tables are readable from
 * x_snc_troubleshoot, or that the ACLs behave as R-10 describes.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeQueryingGlideRecordSecure } = require('./_glideStub')

const PLAN = 'c9d63a932bda8b9417a6ffbeee91bfd0'

function world(overrides) {
    const base = {
        sys_gen_ai_usage_log: [],
        sys_gen_ai_log_metadata: [],
        sys_generative_ai_log: [],
        sys_one_extend_capability_definition: [],
        sys_one_extend_capability: [],
        sn_aia_gen_ai_m2m: [],
        sn_aia_execution_plan: [],
        sn_aia_execution_task: [],
        sys_db_object: [
            { sys_id: 'db1', name: 'sys_hub_flow' },
            { sys_id: 'db2', name: 'sys_script_include' },
        ],
        sys_hub_flow: [{ sys_id: 'flow1', name: 'Provider Integration' }],
    }
    return Object.assign(base, overrides || {})
}

function run(args, tables, options) {
    const GlideRecordSecure = makeQueryingGlideRecordSecure(tables, options)
    const kitCtx = loadScriptInclude('PaToolReadKit.js', { GlideRecordSecure: GlideRecordSecure })
    const ctx = loadScriptInclude('tools/PaToolGenAiLog.js', {
        GlideRecordSecure: GlideRecordSecure,
        PaToolReadKit: kitCtx.PaToolReadKit,
        GlideDateTime: function () {
            this.addSeconds = function () {}
            this.toString = function () {
                return '2026-08-01 00:00:00'
            }
        },
    })
    return { result: new ctx.PaToolGenAiLog().execute(args), queries: GlideRecordSecure.calls.queries }
}

describe('argument handling (R-9)', () => {
    it('defaults to the llm mode with no arguments at all', () => {
        const { result } = run(undefined, world())

        expect(result.success).toBe(true)
        // A missing argument returns evidence, not a menu — the same choice
        // agent_trace makes when it traces the newest plan rather than only
        // listing candidates.
        expect(result.data.mode).toBe('llm')
        expect(result.data.notes.join(' ')).toMatch(/not an error/i)
    })

    it('accepts a bare mode name', () => {
        expect(run('check_config', world()).result.data.mode).toBe('check_config')
    })

    it('treats a bare sys_id as an execution to look up', () => {
        const { result } = run(PLAN, world())

        expect(result.data.mode).toBe('for_execution')
        expect(result.data.requested.execution).toBe(PLAN)
    })

    it('falls back to llm and says so when the mode is unknown', () => {
        const { result } = run({ mode: 'everything' }, world())

        expect(result.data.mode).toBe('llm')
        expect(result.data.notes.join(' ')).toContain('everything')
    })

    it('clamps an absurd window rather than refusing it', () => {
        const { result } = run({ mode: 'llm', minutes_ago: 999999 }, world())

        expect(result.data.window.minutes_ago).toBe(10080)
        expect(result.data.window.clamped).toBe(true)
    })
})

describe('check_config — the refuted heuristic (R-22)', () => {
    function definition(over) {
        return Object.assign(
            {
                sys_id: 'def1',
                name: 'Now LLM Generic',
                capability: 'cap1',
                api_type: 'sys_hub_flow',
                api: 'flow1',
                connection: '',
            },
            over || {}
        )
    }

    it('reports an empty connection as normal state, never as a finding', () => {
        const { result } = run(
            { mode: 'check_config' },
            world({
                sys_one_extend_capability_definition: [definition()],
                sys_one_extend_capability: [{ sys_id: 'cap1', name: 'Summarize' }],
            })
        )

        const row = result.data.definitions[0]
        expect(row.connection_state).toBe('empty — normal, not a defect')
        expect(result.data.findings).toEqual([])
    })

    it('does not present a denied audit as a clean one', () => {
        // Zero definitions and zero findings is shaped exactly like an
        // instance where every capability is healthy.
        const { result } = run({ mode: 'check_config' }, world(), {
            denied: ['sys_one_extend_capability_definition'],
        })

        expect(result.data.audit_status).toBe('unavailable')
        expect(result.data.definitions).toEqual([])
        expect(result.data.notes.join(' ')).toMatch(/NOTHING was audited/)
        expect(result.data.notes.join(' ')).toMatch(/identical to an instance where every definition is healthy/)
    })

    it('reports a genuinely clean audit as ok', () => {
        const { result } = run(
            { mode: 'check_config' },
            world({
                sys_one_extend_capability_definition: [definition()],
                sys_one_extend_capability: [{ sys_id: 'cap1', name: 'Summarize' }],
            })
        )

        expect(result.data.audit_status).toBe('ok')
        expect(result.data.findings).toEqual([])
    })

    it('states the denominator behind the connection claim (R-22 item 4)', () => {
        const { result } = run({ mode: 'check_config' }, world({
            sys_one_extend_capability_definition: [definition()],
            sys_one_extend_capability: [{ sys_id: 'cap1', name: 'Summarize' }],
        }))

        // "318 of 2026" and "12 rows" are the same sentence shape and only one
        // of them can be checked. The refuted heuristic survived three
        // correction passes because the denominator was never stated.
        expect(result.data.connection_note).toContain('318')
        expect(result.data.connection_note).toContain('2026')
    })

    it('flags an empty mandatory binding', () => {
        const { result } = run(
            { mode: 'check_config' },
            world({
                sys_one_extend_capability_definition: [definition({ api: '' })],
                sys_one_extend_capability: [{ sys_id: 'cap1', name: 'Summarize' }],
            })
        )

        const finding = result.data.findings.find((f) => f.finding === 'mandatory_binding_empty')
        expect(finding).toBeDefined()
        expect(finding.field).toBe('api')
        expect(finding.severity).toBe('high')
    })

    it('flags an api that resolves to nothing in the table api_type names', () => {
        const { result } = run(
            { mode: 'check_config' },
            world({
                sys_one_extend_capability_definition: [
                    definition({ api: '00000000000000000000000000000000' }),
                ],
                sys_one_extend_capability: [{ sys_id: 'cap1', name: 'Summarize' }],
            })
        )

        const finding = result.data.findings.find((f) => f.finding === 'api_dangling')
        expect(finding).toBeDefined()
        // document_id carries no referential integrity, so a dangling value
        // installs verbatim and nothing complains until the capability runs.
        expect(finding.why).toMatch(/referential integrity/i)
    })

    it('reports a non-table api_type as unverifiable, NOT as dangling', () => {
        // `Decision` is not a table on gpinst01, and that single row is also the
        // one row of 2026 with an empty api. Collapsing unverifiable into
        // dangling fires on exactly the row most likely to be inspected.
        const { result } = run(
            { mode: 'check_config' },
            world({
                sys_one_extend_capability_definition: [
                    definition({ api_type: 'Decision', api: 'whatever', name: 'Decision' }),
                ],
                sys_one_extend_capability: [{ sys_id: 'cap1', name: 'Summarize' }],
            })
        )

        const row = result.data.definitions[0]
        expect(row.api_state).toBe('unverifiable')
        expect(result.data.findings.map((f) => f.finding)).not.toContain('api_dangling')
        expect(row.api_note).toMatch(/not a table/i)
    })

    it('reports an unreadable target table as unverifiable, NOT as dangling', () => {
        const { result } = run(
            { mode: 'check_config' },
            world({
                sys_one_extend_capability_definition: [definition()],
                sys_one_extend_capability: [{ sys_id: 'cap1', name: 'Summarize' }],
            }),
            { denied: ['sys_hub_flow'] }
        )

        expect(result.data.definitions[0].api_state).toBe('unverifiable')
        expect(result.data.findings.map((f) => f.finding)).not.toContain('api_dangling')
    })

    it('flags a capability reference that resolves to nothing', () => {
        const { result } = run(
            { mode: 'check_config' },
            world({
                sys_one_extend_capability_definition: [definition({ capability: 'gone' })],
                sys_one_extend_capability: [],
            })
        )

        expect(result.data.findings.map((f) => f.finding)).toContain('capability_unresolvable')
    })

    it('states how many definitions it checked, not just how many were bad', () => {
        const { result } = run(
            { mode: 'check_config' },
            world({
                sys_one_extend_capability_definition: [definition(), definition({ sys_id: 'def2' })],
                sys_one_extend_capability: [{ sys_id: 'cap1', name: 'Summarize' }],
            })
        )

        expect(result.data.stats.definitions_checked).toBe(2)
        expect(result.data.stats.findings).toBe(0)
    })
})

describe('llm mode and the payload (R-10)', () => {
    const metadata = {
        sys_id: 'md1',
        started_at: '2026-08-01 09:00:00',
        model_name: 'now-llm',
        status: 'error',
        error: 'provider timeout',
        error_code: '504',
        prompt_token_count: '900',
        response_token_count: '0',
        time_taken: '30000',
        definition: 'def1',
        caller: 'sn_aia',
        gen_ai_log_id: 'log1',
        sys_created_on: '2026-08-01 09:00:00',
    }

    it('returns metadata rows for the window', () => {
        const { result } = run({ mode: 'llm' }, world({ sys_gen_ai_log_metadata: [metadata] }))

        expect(result.data.entries).toHaveLength(1)
        expect(result.data.entries[0].error).toBe('provider timeout')
    })

    it('filters to errors by default and says the filter was applied', () => {
        const { queries, result } = run({ mode: 'llm' }, world({ sys_gen_ai_log_metadata: [metadata] }))
        const q = queries.find((x) => x.table === 'sys_gen_ai_log_metadata')

        expect(q.filters.some((f) => f.field === 'status')).toBe(true)
        expect(result.data.window.errors_only).toBe(true)
    })

    it('does not fetch the payload unless it was asked for', () => {
        const { queries } = run({ mode: 'llm' }, world({ sys_gen_ai_log_metadata: [metadata] }))
        expect(queries.some((q) => q.table === 'sys_generative_ai_log')).toBe(false)
    })

    it('returns the prompt and response when the caller can read them', () => {
        const { result } = run(
            { mode: 'llm', include_payload: true },
            world({
                sys_gen_ai_log_metadata: [metadata],
                sys_generative_ai_log: [{ sys_id: 'log1', prompt: 'the prompt', response: 'the response' }],
            })
        )

        expect(result.data.entries[0].payload.status).toBe('ok')
        expect(result.data.entries[0].payload.prompt).toBe('the prompt')
    })

    it('degrades explicitly when the payload table is denied, naming the roles required', () => {
        const { result } = run(
            { mode: 'llm', include_payload: true },
            world({
                sys_gen_ai_log_metadata: [metadata],
                sys_generative_ai_log: [{ sys_id: 'log1', prompt: 'p', response: 'r' }],
            }),
            { denied: ['sys_generative_ai_log'] }
        )

        const payload = result.data.entries[0].payload
        // An empty result here reads as "there was no prompt". The difference
        // between that and "you may not read the prompt" is the whole finding.
        expect(payload.status).toBe('not_readable')
        expect(payload.detail).toMatch(/ai_engmt_viewer|maint|admin/)
        expect(payload.prompt).toBeUndefined()
        expect(result.data.notes.join(' ')).toMatch(/metadata only/i)
    })

    it('reports a metadata row carrying no payload link as a genuine absence', () => {
        const { result } = run(
            { mode: 'llm', include_payload: true },
            world({ sys_gen_ai_log_metadata: [Object.assign({}, metadata, { gen_ai_log_id: '' })] })
        )

        expect(result.data.entries[0].payload.status).toBe('no_payload_link')
    })
})

describe('for_execution mode', () => {
    it('joins through sn_aia_gen_ai_m2m on the plan and its task sys_ids', () => {
        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({
                sn_aia_execution_plan: [{ sys_id: PLAN, gen_ai_usage_log: 'usage1' }],
                sn_aia_execution_task: [{ sys_id: 'task1', execution_plan: PLAN }],
                sn_aia_gen_ai_m2m: [
                    { sys_id: 'm1', source_id: 'task1', source_table: 'sn_aia_execution_task', gen_ai_log_metadata: 'md1' },
                ],
                sys_gen_ai_log_metadata: [{ sys_id: 'md1', model_name: 'now-llm', status: 'success' }],
                sys_gen_ai_usage_log: [{ sys_id: 'usage1', assists: '3', status: 'success' }],
            })
        )

        expect(result.data.usage_log.assists).toBe('3')
        expect(result.data.llm_calls).toHaveLength(1)
        expect(result.data.llm_calls[0].model_name).toBe('now-llm')
        expect(result.data.source_ids_joined).toEqual([PLAN, 'task1'])
    })

    it('says llm_calls is incomplete when the task list was clipped', () => {
        // Both reads feed the join. A clipped either omits calls while the
        // result still looks like a complete join - the exact shape R-24
        // governs, and a global evidence note is not the same as the bound
        // travelling with the answer it shaped.
        const tasks = []
        for (let i = 0; i < 250; i++) tasks.push({ sys_id: 't' + i, execution_plan: PLAN })

        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({
                sn_aia_execution_plan: [{ sys_id: PLAN }],
                sn_aia_execution_task: tasks,
            })
        )

        expect(result.data.task_truncated_at).toBe(200)
        expect(result.data.llm_calls_truncated_at).toBe(200)
        expect(result.data.notes.join(' ')).toMatch(/llm_calls is INCOMPLETE/)
        expect(result.data.notes.join(' ')).toMatch(/fewer\s+provider calls than it did/)
    })

    it('says so when the m2m link list itself was clipped', () => {
        const links = []
        for (let i = 0; i < 150; i++) {
            links.push({
                sys_id: 'm' + i,
                source_id: PLAN,
                source_table: 'sn_aia_execution_plan',
                gen_ai_log_metadata: 'md1',
            })
        }

        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({
                sn_aia_execution_plan: [{ sys_id: PLAN }],
                sn_aia_gen_ai_m2m: links,
                sys_gen_ai_log_metadata: [{ sys_id: 'md1', model_name: 'now-llm', status: 'success' }],
            })
        )

        expect(result.data.m2m_truncated_at).toBe(100)
        expect(result.data.notes.join(' ')).toMatch(/link list was truncated/)
    })

    it('states the payload omission once, not once per linked call', () => {
        const links = []
        for (let i = 0; i < 5; i++) {
            links.push({
                sys_id: 'm' + i,
                source_id: PLAN,
                source_table: 'sn_aia_execution_plan',
                gen_ai_log_metadata: 'md' + i,
            })
        }
        const metadata = links.map((l, i) => ({
            sys_id: 'md' + i,
            model_name: 'now-llm',
            status: 'success',
        }))

        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({
                sn_aia_execution_plan: [{ sys_id: PLAN }],
                sn_aia_gen_ai_m2m: links,
                sys_gen_ai_log_metadata: metadata,
            })
        )

        const repeated = result.data.notes.filter((n) => n.indexOf('were NOT fetched') !== -1)
        expect(result.data.llm_calls).toHaveLength(5)
        // Five identical notes bury the four that carry information.
        expect(repeated).toHaveLength(1)
    })

    it('says llm_calls is unavailable when the m2m link table is denied', () => {
        // An empty llm_calls has three causes and they are not
        // interchangeable: no calls were made, the list was clipped, or the
        // caller may not look. Only the first is a finding about the run.
        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({ sn_aia_execution_plan: [{ sys_id: PLAN }] }),
            { denied: ['sn_aia_gen_ai_m2m'] }
        )

        expect(result.data.llm_calls).toEqual([])
        expect(result.data.llm_calls_status).toBe('unavailable')
        expect(result.data.m2m_read_status).toBe('DENIED')
        expect(result.data.notes.join(' ')).toMatch(/EMPTY FOR A REASON THAT HAS NOTHING TO DO WITH THE RUN/)
    })

    it('says the join ran on the plan alone when the task table is denied', () => {
        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({ sn_aia_execution_plan: [{ sys_id: PLAN }] }),
            { denied: ['sn_aia_execution_task'] }
        )

        expect(result.data.task_read_status).toBe('DENIED')
        // Zero task ids here is a permission gap, not an execution with no steps.
        expect(result.data.source_ids_joined).toEqual([PLAN])
        expect(result.data.notes.join(' ')).toMatch(/NOT an execution without tasks/)
    })

    it('distinguishes a genuinely empty join from an unavailable one', () => {
        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({ sn_aia_execution_plan: [{ sys_id: PLAN }] })
        )

        expect(result.data.llm_calls_status).toBe('empty')
        expect(result.data.evidence_basis.denied_tables).toEqual([])
        expect(result.data.evidence_basis.denial_note).toBeNull()
    })

    it('names the denied tables in evidence_basis', () => {
        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({ sn_aia_execution_plan: [{ sys_id: PLAN }] }),
            { denied: ['sn_aia_gen_ai_m2m'] }
        )

        expect(result.data.evidence_basis.denied_tables).toContain('sn_aia_gen_ai_m2m')
        expect(result.data.evidence_basis.denial_note).toMatch(/permission gap, NOT an absence/)
    })

    it('does not report empty when the task join was denied', () => {
        // Round 2 closed the m2m branch and left this one: a DENIED task read
        // collapses the join to the plan sys_id alone, so every per-step call
        // is missing - and `empty` asserts there were none. The status is the
        // claim a reader scans (R-19b); a note beside it does not repair it.
        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({ sn_aia_execution_plan: [{ sys_id: PLAN }] }),
            { denied: ['sn_aia_execution_task'] }
        )

        expect(result.data.llm_calls).toEqual([])
        expect(result.data.llm_calls_status).toBe('unavailable')
    })

    it('reports partial when the task join was denied but calls were still found', () => {
        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({
                sn_aia_execution_plan: [{ sys_id: PLAN }],
                sn_aia_gen_ai_m2m: [
                    {
                        sys_id: 'm1',
                        source_id: PLAN,
                        source_table: 'sn_aia_execution_plan',
                        gen_ai_log_metadata: 'md1',
                    },
                ],
                sys_gen_ai_log_metadata: [{ sys_id: 'md1', model_name: 'now-llm', status: 'success' }],
            }),
            { denied: ['sn_aia_execution_task'] }
        )

        // Plan-level calls were readable; per-step ones were not.
        expect(result.data.llm_calls).toHaveLength(1)
        expect(result.data.llm_calls_status).toBe('partial')
    })

    it('reports partial when the join was truncated rather than denied', () => {
        // This is the case that caught a live ordering bug: _callsStatus reads
        // llm_calls_truncated_at, and the first version derived the status one
        // line before that field was assigned, leaving the branch dead.
        const tasks = []
        for (let i = 0; i < 250; i++) tasks.push({ sys_id: 't' + i, execution_plan: PLAN })

        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({
                sn_aia_execution_plan: [{ sys_id: PLAN }],
                sn_aia_execution_task: tasks,
                sn_aia_gen_ai_m2m: [
                    {
                        sys_id: 'm1',
                        source_id: PLAN,
                        source_table: 'sn_aia_execution_plan',
                        gen_ai_log_metadata: 'md1',
                    },
                ],
                sys_gen_ai_log_metadata: [{ sys_id: 'md1', model_name: 'now-llm', status: 'success' }],
            })
        )

        expect(result.data.llm_calls_truncated_at).toBe(200)
        expect(result.data.llm_calls_status).toBe('partial')
    })

    it('does not quote a task count taken from a denied read', () => {
        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({ sn_aia_execution_plan: [{ sys_id: PLAN }] }),
            { denied: ['sn_aia_execution_task'] }
        )
        const notes = result.data.notes.join(' ')

        // "plus each of its 0 task sys_ids" reads as an execution with no
        // steps, contradicting the denial note two lines above it.
        expect(notes).not.toMatch(/each of its 0 task sys_ids/)
        expect(notes).toMatch(/NO task sys_ids, because sn_aia_execution_task could not be read/)
    })

    it('never leaves llm_calls_status undefined, on any path', () => {
        // The generic form of round 4's first finding. Three early returns
        // assigned llm_calls and returned without a status - a gap reached
        // through CONTROL FLOW, which the consolidated derivation could not
        // see because it only ever ran on the success path. Enumerating the
        // paths is the only thing that catches that.
        const VOCABULARY = ['ok', 'empty', 'partial', 'unavailable']
        const paths = {
            'no execution supplied': [{ mode: 'for_execution' }, world(), undefined],
            'plan denied': [
                { mode: 'for_execution', execution: PLAN },
                world(),
                { denied: ['sn_aia_execution_plan'] },
            ],
            'plan absent': [{ mode: 'for_execution', execution: PLAN }, world(), undefined],
            'task denied': [
                { mode: 'for_execution', execution: PLAN },
                world({ sn_aia_execution_plan: [{ sys_id: PLAN }] }),
                { denied: ['sn_aia_execution_task'] },
            ],
            'm2m denied': [
                { mode: 'for_execution', execution: PLAN },
                world({ sn_aia_execution_plan: [{ sys_id: PLAN }] }),
                { denied: ['sn_aia_gen_ai_m2m'] },
            ],
            'genuinely empty': [
                { mode: 'for_execution', execution: PLAN },
                world({ sn_aia_execution_plan: [{ sys_id: PLAN }] }),
                undefined,
            ],
        }

        Object.keys(paths).forEach((name) => {
            const [args, tables, options] = paths[name]
            const status = run(args, tables, options).result.data.llm_calls_status
            expect({ path: name, status: status }).toEqual({
                path: name,
                status: expect.stringMatching(new RegExp('^(' + VOCABULARY.join('|') + ')$')),
            })
        })
    })

    it('does not report ok when a linked metadata row was denied', () => {
        // The stub is present in `calls` and carries no model, status or
        // tokens. Counting it toward `ok` reports a set complete in length and
        // not in content.
        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({
                sn_aia_execution_plan: [{ sys_id: PLAN }],
                sn_aia_gen_ai_m2m: [
                    {
                        sys_id: 'm1',
                        source_id: PLAN,
                        source_table: 'sn_aia_execution_plan',
                        gen_ai_log_metadata: 'md1',
                    },
                ],
            }),
            { denied: ['sys_gen_ai_log_metadata'] }
        )

        expect(result.data.link_stubs).toEqual({ unreadable: 1, dangling: 0, no_ref: 0 })
        expect(result.data.llm_calls_status).toBe('unavailable')
    })

    it('routes an execution object to for_execution when no mode is given', () => {
        // The object shape is what the native wrapper actually produces after
        // tolerantParse. A bare sys_id string already routed correctly; the
        // common path fell through to a time-window query that ignored the
        // execution entirely.
        const { result } = run(
            { execution: PLAN },
            world({ sn_aia_execution_plan: [{ sys_id: PLAN }] })
        )

        expect(result.data.mode).toBe('for_execution')
        expect(result.data.plan.sys_id).toBe(PLAN)
        expect(result.data.notes.join(' ')).toMatch(/an execution was, so for_execution was used/)
    })

    it('does not report empty when join rows exist without metadata references', () => {
        // The link rows ARE evidence the engine recorded LLM interactions.
        // `empty` asserts the run called no provider - a wrong claim made
        // exactly when the data is at its most broken.
        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({
                sn_aia_execution_plan: [{ sys_id: PLAN }],
                sn_aia_gen_ai_m2m: [
                    { sys_id: 'm1', source_id: PLAN, source_table: 'sn_aia_execution_plan', gen_ai_log_metadata: '' },
                    { sys_id: 'm2', source_id: PLAN, source_table: 'sn_aia_execution_plan', gen_ai_log_metadata: '' },
                ],
            })
        )

        expect(result.data.link_stubs).toEqual({ unreadable: 0, dangling: 0, no_ref: 2 })
        // The stubs are IN llm_calls, so the join rows are visible.
        expect(result.data.llm_calls).toHaveLength(2)
        expect(result.data.llm_calls_status).toBe('partial')
        expect(result.data.llm_calls[0].note).toMatch(/unrecoverable from this row/)
    })

    it('does not report ok when some links dangle', () => {
        // A dangling ref is a read that SUCCEEDED and found nothing - the
        // record is gone, which is itself a GenAI-stack finding, not a
        // permission gap and not an absence of calls.
        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({
                sn_aia_execution_plan: [{ sys_id: PLAN }],
                sn_aia_gen_ai_m2m: [
                    { sys_id: 'm1', source_id: PLAN, source_table: 'sn_aia_execution_plan', gen_ai_log_metadata: 'md1' },
                    { sys_id: 'm2', source_id: PLAN, source_table: 'sn_aia_execution_plan', gen_ai_log_metadata: 'gone' },
                ],
                sys_gen_ai_log_metadata: [{ sys_id: 'md1', model_name: 'now-llm', status: 'success' }],
            })
        )

        expect(result.data.link_stubs).toEqual({ unreadable: 0, dangling: 1, no_ref: 0 })
        expect(result.data.llm_calls).toHaveLength(2)
        expect(result.data.llm_calls_status).toBe('partial')
        const stub = result.data.llm_calls.find((c) => c.read_status === 'empty')
        expect(stub.note).toMatch(/DANGLING/)
    })

    it('reports partial, not empty, when every link dangles', () => {
        const { result } = run(
            { mode: 'for_execution', execution: PLAN },
            world({
                sn_aia_execution_plan: [{ sys_id: PLAN }],
                sn_aia_gen_ai_m2m: [
                    { sys_id: 'm1', source_id: PLAN, source_table: 'sn_aia_execution_plan', gen_ai_log_metadata: 'gone' },
                ],
            })
        )

        expect(result.data.llm_calls_status).toBe('partial')
        expect(result.data.llm_calls_status).not.toBe('empty')
    })

    it('says the plan is absent rather than reporting no LLM calls', () => {
        const { result } = run({ mode: 'for_execution', execution: PLAN }, world())

        // "This run made no LLM calls" and "there is no such run" are different
        // diagnoses and only one of them is about the GenAI stack.
        expect(result.data.notes.join(' ')).toMatch(/no sn_aia_execution_plan/i)
        expect(result.data.llm_calls).toEqual([])
    })

    it('asks for an execution rather than guessing when none was supplied', () => {
        const { result } = run({ mode: 'for_execution' }, world())

        expect(result.success).toBe(true)
        expect(result.data.notes.join(' ')).toMatch(/execution/i)
    })
})

describe('usage mode', () => {
    it('returns assist consumption rows for the window', () => {
        const { result } = run(
            { mode: 'usage' },
            world({
                sys_gen_ai_usage_log: [
                    {
                        sys_id: 'u1',
                        assists: '2',
                        status: 'error',
                        caller_scope: 'sn_aia',
                        execution_type: 'sync',
                        sys_created_on: '2026-08-01 09:00:00',
                    },
                ],
            })
        )

        expect(result.data.entries).toHaveLength(1)
        expect(result.data.entries[0].assists).toBe('2')
    })
})

describe('read failures', () => {
    it('does not explain a denied usage read with assist-consumption semantics', () => {
        // The semantics note is a plausible WRONG cause when the read was
        // denied: it steers the investigation toward execution timing when
        // the emptiness is an ACL gap.
        const { result } = run({ mode: 'usage' }, world(), { denied: ['sys_gen_ai_usage_log'] })
        const notes = result.data.notes.join(' ')

        expect(notes).not.toMatch(/failed before reaching\s+the provider/)
        expect(notes).toMatch(/PERMISSION GAP/)
        expect(notes).toMatch(/do not reason about\s+execution timing/)
    })

    it('keeps the semantics note on a genuinely empty usage window', () => {
        const { result } = run({ mode: 'usage' }, world())

        expect(result.data.read_status).toBe('empty')
        expect(result.data.notes.join(' ')).toMatch(/ASSIST CONSUMPTION, not LLM calls/)
    })

    it('reports a denied read as a privilege gap, not as an empty stack', () => {
        const { result } = run({ mode: 'usage' }, world(), { denied: ['sys_gen_ai_usage_log'] })

        expect(result.success).toBe(true)
        expect(result.data.reads.sys_gen_ai_usage_log).toBe('DENIED')
        expect(result.data.evidence_basis.statement).toMatch(/DENIED/)
    })
})
