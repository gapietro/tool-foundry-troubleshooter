/**
 * The `/status` health checks themselves — issue #235.
 *
 * WHY A SECOND PaRestHandlers TEST FILE
 * `PaRestHandlers.test.js` covers the AGGREGATION rule (R-19b: `ready:false`
 * when any check fails) by replacing the entire check list wholesale through
 * `options.checks`. That is the right way to test aggregation, and it is well
 * covered. Its consequence is that the aggregation was tested against fakes
 * while **no check's own logic was tested at all** — #217 measured
 * `PaRestHandlers.js` at 54.44% statements, the outlier in a codebase where
 * every other file sits at 85-98%, with the uncovered ranges `642-874` and
 * `893-993`: the production half of every injection seam.
 *
 * This file drives the DEFAULT implementations instead — the ones reached when
 * nothing is injected — so `options.checks` is deliberately never used here.
 *
 * WHY THIS IS A GATE AND NOT A COVERAGE TARGET
 * Three of these checks exist specifically to catch silent-failure traps this
 * repo has already been bitten by: Build Rule #40 (NASK skills install
 * DEACTIVATED, so existence is not readiness), Build Rule #42 (a Fluent
 * `Table()` installs with zero ACLs), and the stuck-run detection that #73
 * found was dead code matching nothing by construction. **A check that
 * silently stops detecting its trap is worse than no check**, because
 * `ready:true` then becomes a false statement made confidently — and that is
 * the exact failure `_checkStuckRuns` already had once.
 *
 * SCOPE, PER DESIGN.md R-8
 * The Glide globals are stubs, so nothing here is evidence about platform
 * behaviour in either direction. What it does establish is that each check
 * reads the fields it claims to read, gates on the condition it claims to gate
 * on, and returns `error` rather than `ok` when its trap is present. The live
 * instance remains the only authority on the platform half.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeWritableWorld, makeQueryingGlideRecordSecure } = require('./_glideStub')

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** The two capabilities `_checkSkills` / `_checkCapabilityMapping` walk. */
const SKILL_NAMES = ['pa llm reason', 'pa llm summarize']
const CAP_IDS = {
    'pa llm reason': '0bf0bc13a7414399a1482d21de01231d',
    'pa llm summarize': '3914d62f6a9b42a3a4633432a97a1d0f',
}

/** The 15 LLD §2 tables `_checkTableReadability` probes. */
const SECTION2_TABLES = [
    'sn_aia_execution_plan',
    'sn_aia_execution_task',
    'sn_aia_tools_execution',
    'sn_aia_message',
    'sn_aia_agent',
    'sn_aia_tool',
    'sn_aia_agent_tool_m2m',
    'sn_aia_usecase',
    'sn_aia_trigger_configuration',
    'sys_gen_ai_log_metadata',
    'sys_generative_ai_log',
    'syslog',
    'sys_cs_conversation',
    'sys_db_object',
    'sys_dictionary',
]

/** A `gs` carrying the one method the handlers call beyond logging. */
function gsStub() {
    const calls = { info: [], warn: [], error: [], eventQueue: [] }
    return {
        calls: calls,
        info: function (m) {
            calls.info.push(m)
        },
        warn: function (m) {
            calls.warn.push(m)
        },
        error: function (m) {
            calls.error.push(m)
        },
        eventQueue: function (name, gr, a, b) {
            calls.eventQueue.push({ name: name, gr: gr, parm1: a, parm2: b })
        },
        nil: function (v) {
            return v === null || v === undefined || v === ''
        },
    }
}

/**
 * Loads the handlers with a chosen set of platform globals present.
 *
 * A global that is OMITTED is genuinely absent from the vm context, so the
 * production `typeof X === 'undefined'` guards are exercised for real rather
 * than being handed a stand-in that merely behaves like absence.
 */
function load(globals, options) {
    const g = globals || {}
    const extra = { JSON: JSON, gs: g.gs || gsStub() }
    if (g.GlideRecord) extra.GlideRecord = g.GlideRecord
    if (g.GlideRecordSecure) extra.GlideRecordSecure = g.GlideRecordSecure
    if (g.GlidePluginManager) extra.GlidePluginManager = g.GlidePluginManager

    const ctx = loadScriptInclude('rest/PaRestHandlers.js', extra)
    return { handlers: new ctx.PaRestHandlers(options || {}), gs: extra.gs, ctx: ctx }
}

/** A hostile error whose `.message` getter throws — enforces R-1 (never touch `e`). */
function hostile() {
    const h = {}
    Object.defineProperty(h, 'message', {
        get: function () {
            throw new Error('Illegal access to getter method getMessage')
        },
    })
    return h
}

/** GlidePluginManager stub. `active` maps plugin id -> boolean; `throws` blows up. */
function pluginManager(active, mode) {
    return function () {
        this.isActive = function (id) {
            if (mode === 'throwPerPlugin') throw hostile()
            return !!active[id]
        }
        if (mode === 'throwOnConstruct') throw hostile()
    }
}

const ALL_PLUGINS_ACTIVE = {
    'com.now_assist_core': true,
    sn_genai_platform: true,
    'com.sn.generative.ai': true,
    sn_aia: true,
}

/** Rows that make `_checkSkills` pass: both skills present AND active. */
function healthySkillRows() {
    return {
        sn_nowassist_skill_config: [
            { sys_id: 'skill_reason', name: 'pa llm reason' },
            { sys_id: 'skill_summarize', name: 'pa llm summarize' },
        ],
        sn_nowassist_skill_config_status: [
            { sys_id: 'st1', skill_config: 'skill_reason', active: 'true' },
            { sys_id: 'st2', skill_config: 'skill_summarize', active: 'true' },
        ],
    }
}

/** Rows that make `_checkCapabilityMapping` pass: both bindings present. */
function healthyCapabilityRows() {
    return {
        sys_one_extend_capability_definition: [
            {
                sys_id: 'cap1',
                capability: CAP_IDS['pa llm reason'],
                api_type: 'now_llm',
                api: 'now_llm_generic',
            },
            {
                sys_id: 'cap2',
                capability: CAP_IDS['pa llm summarize'],
                api_type: 'now_llm',
                api: 'now_llm_generic',
            },
        ],
    }
}

/** A GlideRecordSecure over the §2 tables, each seeded with one row. */
function readableSecure(denied) {
    const tables = {}
    SECTION2_TABLES.forEach(function (t) {
        tables[t] = [{ sys_id: t + '_row' }]
    })
    return makeQueryingGlideRecordSecure(tables, { denied: denied || [] })
}

// ===========================================================================
// _statusChecks — the production check list itself
// ===========================================================================

describe('_statusChecks — the production list', () => {
    test('is the six documented checks, in order', () => {
        // Pinned because the list is what `/status` actually runs in
        // production; `options.checks` replaces it wholesale, so nothing else
        // in the suite would notice a check being dropped from it.
        const { handlers } = load()
        const names = handlers._statusChecks().map(function (c) {
            return c.name
        })

        expect(names).toEqual([
            'plugins',
            'skills',
            'capability_provider_mapping',
            'micro_invocation',
            'table_readability',
            'stuck_runs',
        ])
    })

    test('each entry is runnable and dispatches to its own check', () => {
        const { handlers } = load()
        handlers._statusChecks().forEach(function (c) {
            expect(typeof c.run).toBe('function')
            // With no globals present every check takes its unavailable
            // branch — which proves the entry is wired to a real check rather
            // than to a stub that returns ok unconditionally.
            expect(c.run().status).toBe('error')
        })
    })
})

// ===========================================================================
// _checkPlugins
// ===========================================================================

describe('_checkPlugins', () => {
    test('ok when all four plugins are active, naming each one', () => {
        const { handlers } = load({ GlidePluginManager: pluginManager(ALL_PLUGINS_ACTIVE) })
        const r = handlers._checkPlugins()

        expect(r.status).toBe('ok')
        expect(Object.keys(r.detail).sort()).toEqual(
            ['com.now_assist_core', 'com.sn.generative.ai', 'sn_aia', 'sn_genai_platform'].sort()
        )
        expect(r.detail['com.now_assist_core']).toEqual({ name: 'Now Assist Core', active: true })
    })

    test('checks com.now_assist_core, NOT the documented com.snc.now_assist', () => {
        // The live finding this check was built around (Task 7, Step 4):
        // now-assist-platform.md's "Required Plugins" table names
        // `com.snc.now_assist`, which resolves isActive() to false even though
        // the plugin IS active — it is simply the wrong id. A check built to
        // the doc's name reports a healthy plugin as down with no signal
        // saying why. This asserts the corrected id is the one queried.
        const asked = []
        const { handlers } = load({
            GlidePluginManager: function () {
                this.isActive = function (id) {
                    asked.push(id)
                    return true
                }
            },
        })
        handlers._checkPlugins()

        expect(asked).toContain('com.now_assist_core')
        expect(asked).not.toContain('com.snc.now_assist')
    })

    test('error naming the specific inactive plugin, not a single boolean', () => {
        // One missing dependency is named rather than folded away — the whole
        // reason the check is per-plugin.
        const { handlers } = load({
            GlidePluginManager: pluginManager({
                'com.now_assist_core': true,
                sn_genai_platform: true,
                'com.sn.generative.ai': true,
                sn_aia: false,
            }),
        })
        const r = handlers._checkPlugins()

        expect(r.status).toBe('error')
        expect(r.detail.sn_aia.active).toBe(false)
        expect(r.detail['com.now_assist_core'].active).toBe(true)
    })

    test('a throwing isActive marks that plugin inactive without touching the error (R-1)', () => {
        const { handlers } = load({
            GlidePluginManager: pluginManager(ALL_PLUGINS_ACTIVE, 'throwPerPlugin'),
        })
        const r = handlers._checkPlugins()

        expect(r.status).toBe('error')
        // Every plugin fails independently rather than one throw aborting the
        // walk — the per-plugin try/catch, not the outer one.
        expect(r.detail.sn_aia.active).toBe(false)
        expect(r.detail['com.now_assist_core'].active).toBe(false)
    })

    test('a throwing constructor degrades to a named failure, not a crash', () => {
        const { handlers } = load({
            GlidePluginManager: pluginManager(ALL_PLUGINS_ACTIVE, 'throwOnConstruct'),
        })
        expect(handlers._checkPlugins()).toEqual({ status: 'error', detail: 'plugin check failed' })
    })

    test('reports the API as unavailable rather than throwing when absent', () => {
        const { handlers } = load({})
        expect(handlers._checkPlugins()).toEqual({
            status: 'error',
            detail: 'GlidePluginManager unavailable',
        })
    })
})

// ===========================================================================
// _checkSkills — Build Rule #40's activation trap
// ===========================================================================

describe('_checkSkills', () => {
    function withRows(rows) {
        const world = makeWritableWorld({ rows: rows })
        return load({ GlideRecord: world.GlideRecord })
    }

    test('ok when both skills exist and are active', () => {
        const r = withRows(healthySkillRows()).handlers._checkSkills()

        expect(r.status).toBe('ok')
        SKILL_NAMES.forEach(function (n) {
            expect(r.detail[n]).toEqual({ found: true, active: true })
        })
    })

    // ---- THE TRAP THIS CHECK EXISTS FOR ----------------------------------
    test('error when a skill EXISTS but is DEACTIVATED (Build Rule #40)', () => {
        // NASK skills install with `active=false` every time, and the Fluent
        // DSL has no field to change that. Existence is therefore not
        // readiness — a check that stopped at `found` would report ready on an
        // instance where every skill invocation fails with a misleading
        // permission error.
        const rows = healthySkillRows()
        rows.sn_nowassist_skill_config_status[0].active = 'false'

        const r = withRows(rows).handlers._checkSkills()

        expect(r.status).toBe('error')
        expect(r.detail['pa llm reason']).toEqual({ found: true, active: false })
        expect(r.detail['pa llm summarize']).toEqual({ found: true, active: true })
    })

    test('a missing status row is not active — absence is not activation', () => {
        const rows = healthySkillRows()
        rows.sn_nowassist_skill_config_status = []

        const r = withRows(rows).handlers._checkSkills()

        expect(r.status).toBe('error')
        expect(r.detail['pa llm reason']).toEqual({ found: true, active: false })
    })

    test("matches the status row by the skill's sys_id, not by name", () => {
        // A status row belonging to a DIFFERENT skill must not satisfy this
        // skill's activation. Pins the `skill_config` join.
        const rows = healthySkillRows()
        rows.sn_nowassist_skill_config_status = [
            { sys_id: 'st1', skill_config: 'some_other_skill', active: 'true' },
        ]

        const r = withRows(rows).handlers._checkSkills()

        expect(r.status).toBe('error')
        expect(r.detail['pa llm reason'].active).toBe(false)
    })

    test("accepts '1' as well as 'true' for the active flag", () => {
        const rows = healthySkillRows()
        rows.sn_nowassist_skill_config_status[0].active = '1'
        rows.sn_nowassist_skill_config_status[1].active = '1'

        expect(withRows(rows).handlers._checkSkills().status).toBe('ok')
    })

    test('error when a skill is missing entirely', () => {
        const rows = healthySkillRows()
        rows.sn_nowassist_skill_config = [{ sys_id: 'skill_reason', name: 'pa llm reason' }]

        const r = withRows(rows).handlers._checkSkills()

        expect(r.status).toBe('error')
        expect(r.detail['pa llm summarize']).toEqual({ found: false, active: false })
    })

    test('a throwing query degrades to not-found without touching the error (R-1)', () => {
        const world = makeWritableWorld({ rows: healthySkillRows(), throwOnQuery: hostile() })
        const r = load({ GlideRecord: world.GlideRecord }).handlers._checkSkills()

        expect(r.status).toBe('error')
        expect(r.detail['pa llm reason']).toEqual({ found: false, active: false })
    })

    test('reports the API as unavailable rather than throwing when absent', () => {
        expect(load({}).handlers._checkSkills()).toEqual({
            status: 'error',
            detail: 'GlideRecord unavailable',
        })
    })
})

// ===========================================================================
// _checkCapabilityMapping
// ===========================================================================

describe('_checkCapabilityMapping', () => {
    function withRows(rows) {
        const world = makeWritableWorld({ rows: rows })
        return load({ GlideRecord: world.GlideRecord })
    }

    test('ok when both capabilities have api_type and api bound', () => {
        const r = withRows(healthyCapabilityRows()).handlers._checkCapabilityMapping()

        expect(r.status).toBe('ok')
        expect(r.detail['pa llm reason']).toEqual({
            capability: CAP_IDS['pa llm reason'],
            mapped: true,
            note: '',
        })
    })

    test('error when api_type is bound but api is not — BOTH are required', () => {
        const rows = healthyCapabilityRows()
        rows.sys_one_extend_capability_definition[0].api = ''

        const r = withRows(rows).handlers._checkCapabilityMapping()

        expect(r.status).toBe('error')
        expect(r.detail['pa llm reason'].mapped).toBe(false)
        expect(r.detail['pa llm reason'].note).toBe(
            'no capability definition with both api_type and api bound'
        )
    })

    test('error when api is bound but api_type is not', () => {
        const rows = healthyCapabilityRows()
        rows.sys_one_extend_capability_definition[0].api_type = ''

        expect(withRows(rows).handlers._checkCapabilityMapping().status).toBe('error')
    })

    test('a fully-bound definition later in the result set still counts', () => {
        // The check walks every definition for the capability and stops at the
        // first complete one; a leading incomplete row must not mask it.
        const rows = healthyCapabilityRows()
        rows.sys_one_extend_capability_definition.unshift({
            sys_id: 'cap0',
            capability: CAP_IDS['pa llm reason'],
            api_type: 'now_llm',
            api: '',
        })

        expect(withRows(rows).handlers._checkCapabilityMapping().status).toBe('ok')
    })

    test("a definition for a DIFFERENT capability does not satisfy this one", () => {
        const rows = {
            sys_one_extend_capability_definition: [
                { sys_id: 'x', capability: 'some_other_capability', api_type: 'now_llm', api: 'x' },
            ],
        }

        const r = withRows(rows).handlers._checkCapabilityMapping()

        expect(r.status).toBe('error')
        expect(r.detail['pa llm reason'].mapped).toBe(false)
    })

    test('a throwing read is reported as a read failure, distinct from "not mapped" (R-1)', () => {
        const world = makeWritableWorld({
            rows: healthyCapabilityRows(),
            throwOnQuery: hostile(),
        })
        const r = load({ GlideRecord: world.GlideRecord }).handlers._checkCapabilityMapping()

        expect(r.status).toBe('error')
        // The two failures are genuinely different problems and the note is
        // the only thing that distinguishes them.
        expect(r.detail['pa llm reason'].note).toBe('capability definition read failed')
    })

    test('reports the API as unavailable rather than throwing when absent', () => {
        expect(load({}).handlers._checkCapabilityMapping()).toEqual({
            status: 'error',
            detail: 'GlideRecord unavailable',
        })
    })
})

// ===========================================================================
// _checkMicroInvocation — the only check that proves a call completes
// ===========================================================================

describe('_checkMicroInvocation', () => {
    test('ok on a successful round-trip, reporting whether it retried', () => {
        const { handlers } = load({}, {
            llmProxy: {
                reason: function () {
                    return { success: true, retried: false }
                },
            },
        })

        expect(handlers._checkMicroInvocation()).toEqual({ status: 'ok', detail: { retried: false } })
    })

    test('surfaces a retry, because a passing-but-retrying provider is not the same as a healthy one', () => {
        const { handlers } = load({}, {
            llmProxy: {
                reason: function () {
                    return { success: true, retried: true }
                },
            },
        })

        expect(handlers._checkMicroInvocation().detail.retried).toBe(true)
    })

    test('sends a prompt that constrains the model to a single JSON answer', () => {
        const prompts = []
        const { handlers } = load({}, {
            llmProxy: {
                reason: function (p) {
                    prompts.push(p)
                    return { success: true }
                },
            },
        })
        handlers._checkMicroInvocation()

        expect(prompts).toHaveLength(1)
        expect(prompts[0]).toContain('{"action":"answer","text":"OK"}')
    })

    test('error carrying the proxy error when the call fails', () => {
        const { handlers } = load({}, {
            llmProxy: {
                reason: function () {
                    return { success: false, error: 'provider unavailable' }
                },
            },
        })

        expect(handlers._checkMicroInvocation()).toEqual({
            status: 'error',
            detail: 'provider unavailable',
        })
    })

    test('error with "unknown failure" when the proxy returns nothing usable', () => {
        const expected = { status: 'error', detail: 'unknown failure' }
        const returning = function (v) {
            return load({}, { llmProxy: { reason: function () { return v } } })
                .handlers._checkMicroInvocation()
        }

        expect(returning(null)).toEqual(expected)
        expect(returning(undefined)).toEqual(expected)
        expect(returning({})).toEqual(expected)
        expect(returning({ success: false })).toEqual(expected)
    })

    test('does not accept a truthy-but-not-true success flag', () => {
        // Pins `result.success === true`. A stringly-typed `'false'` is truthy,
        // so a loosened check would report a healthy provider on an explicit
        // failure.
        const { handlers } = load({}, {
            llmProxy: {
                reason: function () {
                    return { success: 'false', error: 'nope' }
                },
            },
        })

        expect(handlers._checkMicroInvocation().status).toBe('error')
    })

    test('a throwing proxy is an error, not an exception, and `e` is untouched (R-1)', () => {
        const { handlers } = load({}, {
            llmProxy: {
                reason: function () {
                    throw hostile()
                },
            },
        })

        expect(handlers._checkMicroInvocation()).toEqual({
            status: 'error',
            detail: 'micro-invocation threw',
        })
    })
})

// ===========================================================================
// _checkTableReadability — Build Rule #42's no-ACL trap
// ===========================================================================

describe('_checkTableReadability', () => {
    test('ok when every §2 table reads, reporting all fifteen', () => {
        const { handlers } = load({ GlideRecordSecure: readableSecure() })
        const r = handlers._checkTableReadability()

        expect(r.status).toBe('ok')
        expect(Object.keys(r.detail).sort()).toEqual(SECTION2_TABLES.slice(0).sort())
    })

    test('an EMPTY table is readable, not denied', () => {
        // The distinction the check turns on: `next()` returning false means
        // the read succeeded and found nothing. Conflating it with a denial
        // would make `ready` false on any clean instance.
        const tables = {}
        SECTION2_TABLES.forEach(function (t) {
            tables[t] = []
        })
        const r = load({
            GlideRecordSecure: makeQueryingGlideRecordSecure(tables, {}),
        }).handlers._checkTableReadability()

        expect(r.status).toBe('ok')
        expect(r.detail.sn_aia_agent).toBe('empty')
    })

    // ---- THE TRAP THIS CHECK EXISTS FOR ----------------------------------
    test('error on an UNEXPECTED denial (Build Rule #42)', () => {
        // A Fluent Table() installs with zero ACLs and an unmatched ACL denies
        // everyone. The signature is a GlideRecordSecure that throws where a
        // plain GlideRecord would have worked — invisible from the writing
        // code, which is why this check reads through the secure variant.
        const { handlers } = load({ GlideRecordSecure: readableSecure(['sn_aia_agent']) })
        const r = handlers._checkTableReadability()

        expect(r.status).toBe('error')
        expect(r.detail.sn_aia_agent).toBe('DENIED')
    })

    test('syslog is REPORTED but does not flip the status (R-11 / R-19)', () => {
        // syslog carries a permanent caller-restriction this app cannot lift.
        // Counting it would make `ready` permanently false for a known,
        // accepted, unfixable gap — but hiding it would violate R-11, so it is
        // reported with its reason and excluded from the gate only.
        const { handlers } = load({ GlideRecordSecure: readableSecure(['syslog']) })
        const r = handlers._checkTableReadability()

        expect(r.status).toBe('ok')
        expect(r.detail.syslog).toBe('DENIED (known limitation — PaToolLogAnalysis only)')
    })

    test('a known denial does not mask an unexpected one alongside it', () => {
        const { handlers } = load({
            GlideRecordSecure: readableSecure(['syslog', 'sys_dictionary']),
        })
        const r = handlers._checkTableReadability()

        expect(r.status).toBe('error')
        expect(r.detail.syslog).toContain('known limitation')
        expect(r.detail.sys_dictionary).toBe('DENIED')
    })

    test('reports the API as unavailable rather than throwing when absent', () => {
        expect(load({}).handlers._checkTableReadability()).toEqual({
            status: 'error',
            detail: 'GlideRecordSecure unavailable',
        })
    })
})

// ===========================================================================
// _checkStuckRuns — the check that was once dead code (#73)
// ===========================================================================

describe('_checkStuckRuns', () => {
    // 2026-08-13 12:00:00 UTC; the 900000ms budget puts the cutoff at 11:45:00.
    const NOW = Date.UTC(2026, 7, 13, 12, 0, 0)
    const CUTOFF = '2026-08-13 11:45:00'

    function withRuns(runs) {
        const world = makeWritableWorld({ rows: { x_snc_troubleshoot_run: runs } })
        return load({ GlideRecord: world.GlideRecord }, { now: function () { return NOW } })
    }

    function run(overrides) {
        const base = {
            sys_id: 'r' + Math.random(),
            harness: 'custom',
            status: 'running',
            sys_created_on: '2026-08-13 10:00:00',
        }
        Object.keys(overrides || {}).forEach(function (k) {
            base[k] = overrides[k]
        })
        return base
    }

    test('ok with zero stuck runs, and reports the cutoff it used', () => {
        const r = withRuns([]).handlers._checkStuckRuns()

        expect(r.status).toBe('ok')
        expect(r.detail).toEqual({ stuck_count: 0, cutoff: CUTOFF })
    })

    // ---- #73: THIS CHECK ONCE MATCHED NOTHING BY CONSTRUCTION ------------
    test('error counting a custom run left running past the budget', () => {
        const r = withRuns([run()]).handlers._checkStuckRuns()

        expect(r.status).toBe('error')
        expect(r.detail.stuck_count).toBe(1)
    })

    test('a run INSIDE the budget window is not stuck', () => {
        // Guards the cutoff arithmetic in the direction that matters: a
        // too-generous window makes the check dead again, silently.
        const r = withRuns([run({ sys_created_on: '2026-08-13 11:50:00' })]).handlers._checkStuckRuns()

        expect(r.status).toBe('ok')
        expect(r.detail.stuck_count).toBe(0)
    })

    test('NATIVE runs are excluded — R-20 forbids declaring their completeness here', () => {
        // §D5's ScheduledScript sweep owns native runs. Counting them here
        // would both duplicate that job and assert something R-20 says this
        // layer cannot assert.
        const r = withRuns([run({ harness: 'native' })]).handlers._checkStuckRuns()

        expect(r.status).toBe('ok')
        expect(r.detail.stuck_count).toBe(0)
    })

    test('only `running` counts — a completed or failed old run is not stuck', () => {
        const r = withRuns([
            run({ status: 'complete' }),
            run({ status: 'failed' }),
            run({ status: 'awaiting_confirmation' }),
        ]).handlers._checkStuckRuns()

        expect(r.status).toBe('ok')
        expect(r.detail.stuck_count).toBe(0)
    })

    test('counts every stuck run, not just the first', () => {
        const r = withRuns([run(), run(), run()]).handlers._checkStuckRuns()
        expect(r.detail.stuck_count).toBe(3)
    })

    test('a throwing query is a named failure, not a false zero (R-1)', () => {
        // The important direction: without the catch reporting `error`, a
        // broken query would return `stuck_count: 0` — indistinguishable from
        // a healthy instance.
        const world = makeWritableWorld({
            rows: { x_snc_troubleshoot_run: [run()] },
            throwOnQuery: hostile(),
        })
        const r = load({ GlideRecord: world.GlideRecord }, { now: function () { return NOW } })
            .handlers._checkStuckRuns()

        expect(r).toEqual({ status: 'error', detail: 'stuck-run query failed' })
    })

    test('reports the API as unavailable rather than throwing when absent', () => {
        expect(load({}).handlers._checkStuckRuns()).toEqual({
            status: 'error',
            detail: 'GlideRecord unavailable',
        })
    })
})

// ===========================================================================
// _defaultReadRun / _defaultEventQueue — the real Glide seams
// ===========================================================================

describe('_defaultReadRun', () => {
    const ROW = {
        sys_id: 'run1',
        number: 'TR0001042',
        user: 'u1',
        status: 'complete',
        mode: 'diagnose',
        transcript: '[{"role":"assistant"}]',
        context_summary: 'summary',
        fix_report: 'report',
        error: '',
        request: '{"agent":"x"}',
        request_truncated: 'true',
    }

    function withRows(rows) {
        const world = makeWritableWorld({ rows: { x_snc_troubleshoot_run: rows } })
        return load({ GlideRecord: world.GlideRecord })
    }

    test('maps every field the route contract exposes', () => {
        const out = withRows([ROW]).handlers._defaultReadRun('run1')

        expect(out).toEqual({
            run_id: 'run1',
            number: 'TR0001042',
            user: 'u1',
            status: 'complete',
            mode: 'diagnose',
            transcript: [{ role: 'assistant' }],
            context_summary: 'summary',
            fix_report: 'report',
            error: '',
            request: '{"agent":"x"}',
            request_truncated: true,
        })
    })

    test('null for a run that does not exist', () => {
        expect(withRows([]).handlers._defaultReadRun('nope')).toBeNull()
    })

    test('an unparseable transcript degrades to an empty array, not a throw', () => {
        // The transcript is caller-influenced text; a parse failure must not
        // take down a read of an otherwise intact run.
        const out = withRows([Object.assign({}, ROW, { transcript: 'not json' })]).handlers._defaultReadRun('run1')

        expect(out.transcript).toEqual([])
        expect(out.number).toBe('TR0001042')
    })

    test('missing columns become empty strings rather than undefined', () => {
        const out = withRows([{ sys_id: 'run1' }]).handlers._defaultReadRun('run1')

        expect(out.number).toBe('')
        expect(out.status).toBe('')
        expect(out.transcript).toEqual([])
        expect(out.request_truncated).toBe(false)
    })

    test('null on a throwing read, with `e` untouched (R-1)', () => {
        // `get()` is the call on this path, not `query()`, so the world is made
        // hostile at CONSTRUCTION — `throwOnQuery` would never fire here and
        // the catch would go unexercised while the test still passed.
        const Hostile = function () {
            throw hostile()
        }
        expect(load({ GlideRecord: Hostile }).handlers._defaultReadRun('run1')).toBeNull()
    })

    test('null rather than throwing when GlideRecord is absent', () => {
        expect(load({}).handlers._defaultReadRun('run1')).toBeNull()
    })
})

describe('_defaultEventQueue', () => {
    const ROW = { sys_id: 'run1', number: 'TR0001042' }

    function withRows(rows) {
        const world = makeWritableWorld({ rows: { x_snc_troubleshoot_run: rows } })
        return load({ GlideRecord: world.GlideRecord })
    }

    test('queues the run.start event with the brief’s exact call shape', () => {
        const { handlers, gs } = withRows([ROW])
        const ok = handlers._defaultEventQueue('run1', '{"agent":"x"}')

        expect(ok).toBe(true)
        expect(gs.calls.eventQueue).toHaveLength(1)
        const ev = gs.calls.eventQueue[0]
        expect(ev.name).toBe('x_snc_troubleshoot.run.start')
        expect(ev.parm1).toBe('run1')
        expect(ev.parm2).toBe('{"agent":"x"}')
        // A GlideRecord POSITIONED on the run, not just its id — the reason
        // this lives behind the seam rather than in _queueDiagnose.
        expect(ev.gr).toBeTruthy()
        expect(typeof ev.gr.getValue).toBe('function')
        expect(ev.gr.getValue('number')).toBe('TR0001042')
    })

    test('false, and queues nothing, when the run does not exist', () => {
        // Firing the worker for a run that is not there would start a
        // diagnosis against nothing.
        const { handlers, gs } = withRows([])

        expect(handlers._defaultEventQueue('nope', '{}')).toBe(false)
        expect(gs.calls.eventQueue).toHaveLength(0)
    })

    test('false on a throwing lookup, with `e` untouched (R-1)', () => {
        const Hostile = function () {
            throw hostile()
        }
        expect(load({ GlideRecord: Hostile }).handlers._defaultEventQueue('run1', '{}')).toBe(false)
    })

    test('false rather than throwing when GlideRecord is absent', () => {
        expect(load({}).handlers._defaultEventQueue('run1', '{}')).toBe(false)
    })
})

// ===========================================================================
// The seams themselves — the branch that picks default over injected
// ===========================================================================

describe('seam fallthrough', () => {
    // These four lines are the ones that decide whether production runs the
    // default implementation at all. Every other test in the suite injects,
    // so without this block the seams could be wired to the wrong default —
    // or to nothing — and nothing would notice.

    test('_readRun uses the injected reader when one is supplied', () => {
        const seen = []
        const { handlers } = load({}, {
            readRun: function (id) {
                seen.push(id)
                return { run_id: id, injected: true }
            },
        })

        expect(handlers._readRun('run1')).toEqual({ run_id: 'run1', injected: true })
        expect(seen).toEqual(['run1'])
    })

    test('_readRun falls through to _defaultReadRun when nothing is injected', () => {
        const world = makeWritableWorld({
            rows: { x_snc_troubleshoot_run: [{ sys_id: 'run1', number: 'TR0001042' }] },
        })
        const { handlers } = load({ GlideRecord: world.GlideRecord })

        expect(handlers._readRun('run1').number).toBe('TR0001042')
    })

    test('_eventQueue uses the injected queue when one is supplied', () => {
        const seen = []
        const { handlers, gs } = load({}, {
            eventQueue: function (id, json) {
                seen.push({ id: id, json: json })
                return true
            },
        })

        expect(handlers._eventQueue('run1', '{}')).toBe(true)
        expect(seen).toEqual([{ id: 'run1', json: '{}' }])
        expect(gs.calls.eventQueue).toHaveLength(0)
    })

    test('_eventQueue falls through to _defaultEventQueue when nothing is injected', () => {
        const world = makeWritableWorld({
            rows: { x_snc_troubleshoot_run: [{ sys_id: 'run1' }] },
        })
        const { handlers, gs } = load({ GlideRecord: world.GlideRecord })

        expect(handlers._eventQueue('run1', '{}')).toBe(true)
        expect(gs.calls.eventQueue).toHaveLength(1)
    })
})

describe('_now — the production clock', () => {
    test('prefers GlideDateTime, which is the platform clock the rest of the app compares against', () => {
        const ctx = loadScriptInclude('rest/PaRestHandlers.js', {
            JSON: JSON,
            gs: gsStub(),
            GlideDateTime: function () {
                this.getNumericValue = function () {
                    return 1234567890
                }
            },
        })

        expect(new ctx.PaRestHandlers({})._now()).toBe(1234567890)
    })

    test('falls back to Date when GlideDateTime is absent', () => {
        // Off-instance (and in this suite) there is no GlideDateTime; the
        // fallback is what keeps the cutoff arithmetic working rather than
        // throwing inside a check.
        const before = Date.now()
        const value = load({}).handlers._now()

        expect(typeof value).toBe('number')
        expect(value).toBeGreaterThanOrEqual(before)
    })

    test('falls back to Date when GlideDateTime THROWS, with `e` untouched (R-1)', () => {
        const ctx = loadScriptInclude('rest/PaRestHandlers.js', {
            JSON: JSON,
            gs: gsStub(),
            GlideDateTime: function () {
                throw hostile()
            },
        })

        expect(new ctx.PaRestHandlers({})._now()).toBeGreaterThan(0)
    })

    test('an injected clock wins over both', () => {
        expect(load({}, { now: function () { return 42 } }).handlers._now()).toBe(42)
    })
})

// ===========================================================================
// status() end to end, over the REAL check list
// ===========================================================================

describe('status() over the production checks', () => {
    /** Every global present and healthy. */
    function healthyWorld(overrides) {
        const o = overrides || {}
        const rows = Object.assign({}, healthySkillRows(), healthyCapabilityRows(), {
            x_snc_troubleshoot_run: o.runs || [],
        })
        const world = makeWritableWorld({ rows: rows })
        return load(
            {
                GlideRecord: world.GlideRecord,
                GlideRecordSecure: readableSecure(o.denied || []),
                GlidePluginManager: pluginManager(o.plugins || ALL_PLUGINS_ACTIVE),
            },
            {
                now: function () {
                    return Date.UTC(2026, 7, 13, 12, 0, 0)
                },
                llmProxy: {
                    reason: function () {
                        return o.llm === undefined ? { success: true } : o.llm
                    },
                },
            }
        )
    }

    test('ready:true with all six checks ok — no injected check list', () => {
        // The end-to-end assertion #235 asks for: the DEFAULT list runs, and
        // every default implementation reports ok on a healthy world.
        const res = healthyWorld().handlers.status({ body: {}, pathParams: {}, userId: 'u1' })

        expect(res.status).toBe(200)
        expect(res.body.ready).toBe(true)
        expect(res.body.checks.map(function (c) { return c.check })).toEqual([
            'plugins',
            'skills',
            'capability_provider_mapping',
            'micro_invocation',
            'table_readability',
            'stuck_runs',
        ])
        res.body.checks.forEach(function (c) {
            expect(c.status).toBe('ok')
        })
        expect(res.body.caller_dependent_note).toBeUndefined()
    })

    test('a real failing check flips ready:false (R-19b) through the production path', () => {
        const res = healthyWorld({ plugins: { 'com.now_assist_core': true } }).handlers.status({
            body: {},
            pathParams: {},
            userId: 'u1',
        })

        expect(res.body.ready).toBe(false)
        const plugins = res.body.checks.filter(function (c) { return c.check === 'plugins' })[0]
        expect(plugins.status).toBe('error')
    })

    test('a failing micro_invocation does NOT flip ready, but does add the note (#74)', () => {
        // micro_invocation reflects the CALLING user's privileges, not system
        // health, so a non-admin caller seeing it fail on a healthy instance
        // must not be told the system is down.
        const res = healthyWorld({ llm: { success: false, error: 'no permission' } }).handlers.status({
            body: {},
            pathParams: {},
            userId: 'u1',
        })

        expect(res.body.ready).toBe(true)
        const micro = res.body.checks.filter(function (c) { return c.check === 'micro_invocation' })[0]
        expect(micro.status).toBe('error')
        expect(micro.caller_dependent).toBe(true)
        expect(res.body.caller_dependent_note).toContain('Re-run as an admin')
    })

    test('a stuck run reaches ready:false end to end', () => {
        const res = healthyWorld({
            runs: [
                {
                    sys_id: 'r1',
                    harness: 'custom',
                    status: 'running',
                    sys_created_on: '2026-08-13 09:00:00',
                },
            ],
        }).handlers.status({ body: {}, pathParams: {}, userId: 'u1' })

        expect(res.body.ready).toBe(false)
        const stuck = res.body.checks.filter(function (c) { return c.check === 'stuck_runs' })[0]
        expect(stuck.detail.stuck_count).toBe(1)
    })

    test('the known syslog denial alone still reports ready:true', () => {
        // The regression that would otherwise make `/status` permanently
        // false on every instance.
        const res = healthyWorld({ denied: ['syslog'] }).handlers.status({
            body: {},
            pathParams: {},
            userId: 'u1',
        })

        expect(res.body.ready).toBe(true)
    })
})
