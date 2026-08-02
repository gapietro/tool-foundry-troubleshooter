/**
 * The R-24 contract, asserted across every core at once.
 *
 * Twelve review findings on PaToolAgentConfig across four rounds; eleven were
 * the same defect — a partial, excluded or bounded read presented as a
 * definitive answer — and four of them were introduced or left behind by
 * earlier fixes in that same cycle. Fixing instances was not converging.
 *
 * So the invariant is structural: PaToolReadKit records every truncation
 * centrally, and every core surfaces it in evidence_basis whether or not the
 * section that hit the bound thought to mention it. This file is what makes a
 * new core inherit that obligation rather than rediscover it — a core added
 * later without the block fails here, not in review round five.
 */

const fs = require('fs')
const path = require('path')
const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeQueryingGlideRecordSecure } = require('./_glideStub')

/** Cores that read through PaToolReadKit and therefore owe the contract. */
const KIT_CORES = [
    'PaToolAgentConfig',
    'PaToolGenAiLog',
    'PaToolSchemaLookup',
    'PaToolQueryTable',
    'PaToolLogAnalysis',
]

function sourceOf(name) {
    return fs.readFileSync(path.join(__dirname, '..', 'src', 'server', 'tools', name + '.js'), 'utf8')
}

describe('every kit-based core surfaces the bounds it hit (R-24)', () => {
    KIT_CORES.forEach((core) => {
        it(core + ' reports truncations in evidence_basis', () => {
            const src = sourceOf(core)

            // Anchored to the evidence block specifically: reporting a bound
            // somewhere in the payload is not the contract. R-19b's rule
            // applies — the status a reader scans is part of the claim.
            const evidence = src.slice(src.indexOf('_evidenceBasis'))
            expect(evidence).toContain('truncations: truncations')
            expect(evidence).toContain('truncation_note')
            expect(evidence).toContain('LOWER BOUND')

            // R-26: the third axis, enforced identically. An empty result that
            // depends on a denied read is a permission gap, not an absence.
            expect(evidence).toContain('denied_tables: denied')
            expect(evidence).toContain('denial_note')
            expect(evidence).toContain('NOT an absence')
        })
    })

    it('names the cores that are exempt, and why', () => {
        // PaToolAgentTrace carries its own inline read layer and was
        // deliberately not migrated onto the kit (it is the only core verified
        // against real sn_aia_* rows). PaToolReadArtifact performs no bounded
        // record reads at all — it pages an attachment through the store.
        // Both are exemptions with reasons, recorded here so the list cannot
        // grow silently.
        expect(sourceOf('PaToolAgentTrace')).toContain('_readRows')
        expect(sourceOf('PaToolReadArtifact')).toContain('PAGED_OUTPUT')

        const toolsDir = path.join(__dirname, '..', 'src', 'server', 'tools')
        const present = fs
            .readdirSync(toolsDir)
            .filter((f) => f.endsWith('.js'))
            .map((f) => f.replace(/\.js$/, ''))

        // A new core must be classified deliberately: either it uses the kit
        // and owes the contract above, or it is listed as an exemption here.
        expect(present.sort()).toEqual(
            KIT_CORES.concat(['PaToolAgentTrace', 'PaToolReadArtifact']).sort()
        )
    })
})

describe('no kit-based core re-derives truncation from a length', () => {
    // Round 5 found two of these still in place after the R-24 kit fix, and a
    // tip-wide sweep then found five more in the sibling cores. My manual greps
    // kept missing them because the receiver varied — `this.MAX_`, `self.MAX_`,
    // `out.length`, `entries.length`. A grep I have to remember to run, and to
    // write correctly, is the same class of control as a bound I have to
    // remember to report. So it is a test, matched on the CAP name rather than
    // on whatever the rows happen to be called.
    const HEURISTIC = /\.length\s*>=\s*(this\.|self\.)?(MAX_[A-Z_]+|limit)\b/

    KIT_CORES.forEach((core) => {
        it(core + ' uses the kit s measured truncated_at', () => {
            const lines = sourceOf(core).split('\n')
            const offenders = lines
                .map((line, i) => ({
                    line: line.trim(),
                    n: i + 1,
                    // The declaration may sit anywhere in the comment block
                    // immediately above the line it governs.
                    context: lines.slice(Math.max(0, i - 5), i + 1).join(' '),
                }))
                .filter((e) => HEURISTIC.test(e.line))
                // A cap over an in-memory accumulation is NOT a read
                // truncation and cannot use the kit's value - but it must
                // DECLARE itself rather than look identical to the defect.
                .filter((e) => !/IN-MEMORY CAP/.test(e.context))
                .map((e) => e.n + ': ' + e.line)

            // Wrong in BOTH directions: it calls an exactly-full result
            // truncated, and cannot see a clipped one where no limit was set.
            expect(offenders).toEqual([])
        })
    })

    it('is implemented once, in the kit, where the limit+1 read lives', () => {
        const kitSrc = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'server', 'PaToolReadKit.js'),
            'utf8'
        )
        expect(HEURISTIC.test(kitSrc)).toBe(true)
    })

    it('records that PaToolAgentTrace is exempt and what the exemption costs', () => {
        // It keeps its own inline read layer (deliberately unmigrated - it is
        // the only core verified against real sn_aia_* rows), so it still
        // infers truncation from a length comparison in three places. The cost
        // is real and bounded: an exactly-full task, tool-call or conversation
        // page is reported as truncated. Recorded rather than hidden, with a
        // follow-up to migrate it.
        const trace = sourceOf('PaToolAgentTrace')
        const occurrences = trace.split('\n').filter((l) => HEURISTIC.test(l)).length

        expect(occurrences).toBe(3)
    })
})

describe('no core asserts a read status it did not establish (R-25)', () => {
    // R-24's counterpart. R-24 governs how MUCH was read; this governs whether
    // anything was. Both halves of the same rule: every claim in a diagnostic
    // result names what backed it, and nothing may assert a claim it did not
    // earn. Enforced across every core, not just the one that was reviewed.
    const SUCCESS_ASSERTION = /noteRead\s*\([^)]*['"](ok|empty)['"]/

    KIT_CORES.forEach((core) => {
        it(core + ' records only access facts, never a data claim', () => {
            const offenders = sourceOf(core)
                .split('\n')
                .map((line, i) => ({ line: line.trim(), n: i + 1 }))
                .filter((e) => SUCCESS_ASSERTION.test(e.line))
                .map((e) => e.n + ': ' + e.line)

            // DENIED and unknown are observable by any path. `ok` and `empty`
            // are claims about data and belong to readRows/readOne alone.
            expect(offenders).toEqual([])
        })
    })

    it('the kit passes the row-read flag from exactly the two paths that fetch rows', () => {
        const kitSrc = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'server', 'PaToolReadKit.js'),
            'utf8'
        )
        expect((kitSrc.match(/noteRead\(data, table, result\.status, true\)/g) || []).length).toBe(2)
    })
})

describe('the kit makes truncation a measurement, not a guess', () => {
    function kit() {
        const G = makeQueryingGlideRecordSecure({
            t: [{ sys_id: '1' }, { sys_id: '2' }, { sys_id: '3' }],
            exact: [{ sys_id: '1' }, { sys_id: '2' }],
        })
        return new (loadScriptInclude('PaToolReadKit.js', { GlideRecordSecure: G }).PaToolReadKit)()
    }

    it('distinguishes a truncated result from an exactly-full one', () => {
        // The ambiguity behind three of the four silent caps: rows.length ===
        // limit was read optimistically every time it came up.
        const k = kit()

        const truncated = k.readRows('t', null, ['sys_id'], [], 2, null, k.newData())
        const exact = k.readRows('exact', null, ['sys_id'], [], 2, null, k.newData())

        expect(truncated.rows).toHaveLength(2)
        expect(truncated.truncated_at).toBe(2)
        expect(exact.rows).toHaveLength(2)
        expect(exact.truncated_at).toBeUndefined()
    })

    it('never returns more rows than the caller asked for', () => {
        const k = kit()
        const read = k.readRows('t', null, ['sys_id'], [], 2, null, k.newData())

        // limit+1 is read to detect the overflow; it must not leak out.
        expect(read.rows).toHaveLength(2)
    })
})

describe('every core answers with its status intact on an adverse path', () => {
    // Round 4 on #38 found three early returns that assigned an answer and
    // returned without its status. That gap is reached through CONTROL FLOW,
    // and neither pattern-scanning guard above can see it: there is no wrong
    // line to match, only a path that skipped one.
    //
    // The first version of this test asserted "no top-level key is undefined"
    // and PASSED against the reintroduced defect - Object.keys cannot see a key
    // that was never assigned at all, which is precisely what an early return
    // produces. Presence is the assertion; absence of undefined is not.
    const ALL_DENIED = [
        'sn_aia_agent',
        'sn_aia_usecase',
        'sn_aia_team_member',
        'sn_aia_agent_tool_m2m',
        'sn_aia_tool',
        'sn_aia_trigger_agent_usecase_m2m',
        'sn_aia_trigger_configuration',
        'sn_aia_execution_plan',
        'sn_aia_execution_task',
        'sn_aia_gen_ai_m2m',
        'sys_agent_access_role_configuration',
        'sys_agent_access_role_mapping',
        'sys_user_has_role',
        'sys_user_role',
        'sys_gen_ai_usage_log',
        'sys_gen_ai_log_metadata',
        'sys_generative_ai_log',
        'sys_one_extend_capability_definition',
        'sys_one_extend_capability',
        'sys_db_object',
        'sys_dictionary',
        'sys_choice',
        'syslog',
    ]

    /** The field each core must always answer with, however it degrades. */
    const REQUIRED = {
        PaToolAgentConfig: { args: undefined, fields: ['resolution', 'evidence_basis'] },
        PaToolGenAiLog: { args: undefined, fields: ['mode', 'evidence_basis'] },
        PaToolSchemaLookup: { args: 'sn_aia_agent', fields: ['mode', 'table_exists', 'evidence_basis'] },
        PaToolQueryTable: { args: 'sn_aia_agent', fields: ['status', 'evidence_basis'] },
        PaToolLogAnalysis: { args: { source: 'x_snc' }, fields: ['status', 'evidence_basis'] },
    }

    function runCore(core, args) {
        const G = makeQueryingGlideRecordSecure({}, { denied: ALL_DENIED })
        const kitCtx = loadScriptInclude('PaToolReadKit.js', { GlideRecordSecure: G })
        const ctx = loadScriptInclude('tools/' + core + '.js', {
            GlideRecordSecure: G,
            PaToolReadKit: kitCtx.PaToolReadKit,
            GlideAggregate: function () {
                throw new Error('unavailable')
            },
            GlideDateTime: function () {
                this.addSeconds = function () {}
                this.toString = function () {
                    return '2026-08-01 00:00:00'
                }
            },
        })
        return new ctx[core]().execute(args)
    }

    function missing(data, fields) {
        return fields.filter((f) => !Object.prototype.hasOwnProperty.call(data, f))
    }

    KIT_CORES.forEach((core) => {
        it(core + ' answers with every required field when all reads are denied', () => {
            const spec = REQUIRED[core]
            const result = runCore(core, spec.args)

            // Never a throw into the orchestrator, and never a bare failure:
            // a denial is a finding, not an error.
            expect(result.success).toBe(true)
            expect({ core: core, missing: missing(result.data, spec.fields) }).toEqual({
                core: core,
                missing: [],
            })
        })
    })

    it('PaToolGenAiLog carries a status on every mode, not just the default', () => {
        // The default mode alone would have missed round 4's findings, which
        // live in for_execution and check_config.
        const perMode = {
            usage: ['entries', 'read_status'],
            llm: ['entries', 'read_status'],
            for_execution: ['llm_calls', 'llm_calls_status'],
            check_config: ['definitions', 'findings', 'audit_status'],
        }

        Object.keys(perMode).forEach((mode) => {
            const result = runCore('PaToolGenAiLog', {
                mode: mode,
                execution: 'c9d63a932bda8b9417a6ffbeee91bfd0',
            })
            expect({ mode: mode, missing: missing(result.data, perMode[mode]) }).toEqual({
                mode: mode,
                missing: [],
            })
        })
    })
})
