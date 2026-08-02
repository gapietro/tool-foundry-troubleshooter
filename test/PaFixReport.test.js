/**
 * PaFixReport — pure-logic tests (Phase 1b Task 4,
 * docs/superpowers/plans/2026-08-02-phase1b-harness.md; ADR Layer 3 evidence
 * rule; docs/agent/agent-doctor-instructions.md "The Fix Report").
 *
 * WHAT THIS COMPONENT IS
 * The structural floor under the Fix Report JSON the LLM produces at the end
 * of a diagnosis run: `validate` checks the required shape (INCLUDING the
 * evidence rule — a root cause needs a trace citation PLUS a config/schema/
 * data citation, not just prompt language asking nicely for it), `repairPrompt`
 * builds the one allowed repair turn, and `renderMarkdown`/`renderJson` turn a
 * validated report into the two output shapes PaAgentLoop stores and shows.
 *
 * VALIDATION IS A FLOOR, NOT A CEILING
 * Unknown extra keys on the report survive `normalized` untouched — the model
 * may add insight beyond the required shape, and this class must not strip it.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')

function load() {
    const ctx = loadScriptInclude('PaFixReport.js', { JSON: JSON })
    return new ctx.PaFixReport()
}

/** All seven layers SWEPT — the common case that needs no `reason`. */
function sweptLayers() {
    return {
        1: { status: 'SWEPT' },
        2: { status: 'SWEPT' },
        3: { status: 'SWEPT' },
        4: { status: 'SWEPT' },
        5: { status: 'SWEPT' },
        6: { status: 'SWEPT' },
        7: { status: 'SWEPT' },
    }
}

/** A fully valid Fix Report matching every structural requirement. */
function validReport(overrides) {
    const base = {
        failure_summary: 'The agent never called the tool because the trigger never fired.',
        layers_swept: sweptLayers(),
        root_causes: [
            {
                layer: 'layer 7',
                component: 'sn_aia_trigger_configuration on Agent Doctor',
                finding: 'usecase field is null, so the trigger never binds to a flow.',
                evidence: [
                    { source: 'trace', detail: 'sn_aia_execution_plan: no rows for this agent in 24h' },
                    { source: 'config', detail: 'sn_aia_trigger_configuration.usecase = NULL, sys_id abc123' },
                ],
                confidence: 'CONFIRMED',
            },
        ],
        fixes: [
            {
                target_type: 'wiring',
                target: 'AiAgenticWorkflow triggerConfig, not AiAgent alone',
                current: 'triggerConfig on AiAgent',
                proposed: 'triggerConfig on AiAgenticWorkflow with executionMode: autopilot',
                rationale: 'Only AiAgenticWorkflow creates the sn_aia_usecase row the trigger binds to.',
            },
        ],
        verification: 'Fire the trigger event and confirm a new sn_aia_execution_plan row appears within 60s.',
        data_markers: [],
    }
    return Object.assign({}, base, overrides || {})
}

// ===========================================================================
// validate — structural matrix (Task 4 brief, Step 1)
// ===========================================================================

describe('PaFixReport.validate — structural matrix', () => {
    test('a fully valid report normalizes: {valid:true, normalized}', () => {
        const fx = load()
        const report = validReport()

        const result = fx.validate(report)

        expect(result.valid).toBe(true)
        expect(result.normalized).toEqual(report)
        expect(result.problems).toBeUndefined()
    })

    test('non-object input (null, undefined, string, array) is invalid, never throws (R-9)', () => {
        const fx = load()

        ;[null, undefined, 'not an object', 42, ['array', 'not', 'object']].forEach((bad) => {
            expect(() => fx.validate(bad)).not.toThrow()
            const result = fx.validate(bad)
            expect(result.valid).toBe(false)
            expect(Array.isArray(result.problems)).toBe(true)
            expect(result.problems.length).toBeGreaterThan(0)
        })
    })

    test('missing failure_summary → named problem', () => {
        const fx = load()
        const report = validReport()
        delete report.failure_summary

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('failure_summary') !== -1)).toBe(true)
    })

    test('empty-string failure_summary → named problem', () => {
        const fx = load()
        const report = validReport({ failure_summary: '   ' })

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('failure_summary') !== -1)).toBe(true)
    })

    test('missing layers_swept entirely → named problem', () => {
        const fx = load()
        const report = validReport()
        delete report.layers_swept

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('layers_swept') !== -1)).toBe(true)
    })

    test('layers_swept missing one of the seven layers → named problem', () => {
        const fx = load()
        const report = validReport()
        delete report.layers_swept[4]

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('layer 4') !== -1)).toBe(true)
    })

    test('layers_swept with an unknown status value → named problem', () => {
        const fx = load()
        const report = validReport()
        report.layers_swept[3] = { status: 'MAYBE_SWEPT' }

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('layer 3') !== -1 && p.indexOf('status') !== -1)).toBe(true)
    })

    test('NOT_SWEPT layer with no reason → named problem', () => {
        const fx = load()
        const report = validReport()
        report.layers_swept[2] = { status: 'NOT_SWEPT' }

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('layer 2') !== -1 && p.indexOf('reason') !== -1)).toBe(true)
    })

    test('UNAVAILABLE layer with no reason → named problem', () => {
        const fx = load()
        const report = validReport()
        report.layers_swept[6] = { status: 'UNAVAILABLE' }

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('layer 6') !== -1 && p.indexOf('reason') !== -1)).toBe(true)
    })

    test('NOT_SWEPT / UNAVAILABLE layer WITH a reason is valid', () => {
        const fx = load()
        const report = validReport()
        report.layers_swept[2] = { status: 'NOT_SWEPT', reason: 'trace already cleared this layer' }
        report.layers_swept[6] = { status: 'UNAVAILABLE', reason: 'syslog cross-scope restriction, needs an admin' }

        const result = fx.validate(report)

        expect(result.valid).toBe(true)
    })

    test('missing root_causes entirely → named problem', () => {
        const fx = load()
        const report = validReport()
        delete report.root_causes

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('root_causes') !== -1)).toBe(true)
    })

    test('empty root_causes array → named problem', () => {
        const fx = load()
        const report = validReport({ root_causes: [] })

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('root_causes') !== -1)).toBe(true)
    })

    test('a root cause missing layer/component/finding → each named', () => {
        const fx = load()
        const report = validReport()
        delete report.root_causes[0].layer
        delete report.root_causes[0].component
        delete report.root_causes[0].finding

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('layer') !== -1)).toBe(true)
        expect(result.problems.some((p) => p.indexOf('component') !== -1)).toBe(true)
        expect(result.problems.some((p) => p.indexOf('finding') !== -1)).toBe(true)
    })

    test('the evidence rule: a root cause whose evidence cites ONLY the trace → "evidence rule" problem naming the cause', () => {
        const fx = load()
        const report = validReport()
        report.root_causes[0].evidence = [
            { source: 'trace', detail: 'sn_aia_execution_plan: no rows for this agent in 24h' },
        ]

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        const evidenceProblem = result.problems.find((p) => p.toLowerCase().indexOf('evidence rule') !== -1)
        expect(evidenceProblem).toBeDefined()
        expect(evidenceProblem.indexOf('sn_aia_trigger_configuration on Agent Doctor')).not.toBe(-1)
    })

    test('the evidence rule: a root cause whose evidence cites ONLY config (no trace) → "evidence rule" problem', () => {
        const fx = load()
        const report = validReport()
        report.root_causes[0].evidence = [
            { source: 'config', detail: 'sn_aia_trigger_configuration.usecase = NULL, sys_id abc123' },
        ]

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.toLowerCase().indexOf('evidence rule') !== -1)).toBe(true)
    })

    test('the evidence rule: schema or data citations satisfy the non-trace half, not just config', () => {
        const fx = load()
        const withSchema = validReport()
        withSchema.root_causes[0].evidence = [
            { source: 'trace', detail: 'trace excerpt' },
            { source: 'schema', detail: 'x_snc_troubleshoot_run.number has no default' },
        ]
        const withData = validReport()
        withData.root_causes[0].evidence = [
            { source: 'trace', detail: 'trace excerpt' },
            { source: 'data', detail: 'x_snc_troubleshoot_run: 0 rows for this agent' },
        ]

        expect(fx.validate(withSchema).valid).toBe(true)
        expect(fx.validate(withData).valid).toBe(true)
    })

    test('a root cause with no evidence array at all → named problem', () => {
        const fx = load()
        const report = validReport()
        delete report.root_causes[0].evidence

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('evidence') !== -1)).toBe(true)
    })

    test('missing fixes entirely → named problem', () => {
        const fx = load()
        const report = validReport()
        delete report.fixes

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('fixes') !== -1)).toBe(true)
    })

    test('empty fixes array → named problem', () => {
        const fx = load()
        const report = validReport({ fixes: [] })

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('fixes') !== -1)).toBe(true)
    })

    test('a fix with an invalid target_type → named problem', () => {
        const fx = load()
        const report = validReport()
        report.fixes[0].target_type = 'sparkles'

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('target_type') !== -1)).toBe(true)
    })

    test('a fix missing target/proposed/rationale → each named; current may legitimately be empty', () => {
        const fx = load()
        const report = validReport()
        delete report.fixes[0].target
        delete report.fixes[0].proposed
        delete report.fixes[0].rationale
        report.fixes[0].current = ''

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('target') !== -1 && p.indexOf('target_type') === -1)).toBe(true)
        expect(result.problems.some((p) => p.indexOf('proposed') !== -1)).toBe(true)
        expect(result.problems.some((p) => p.indexOf('rationale') !== -1)).toBe(true)
        // current is not flagged just because it is empty
        expect(result.problems.some((p) => p.indexOf('current') !== -1)).toBe(false)
    })

    test('missing verification → named problem', () => {
        const fx = load()
        const report = validReport()
        delete report.verification

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('verification') !== -1)).toBe(true)
    })

    test('missing data_markers entirely → named problem', () => {
        const fx = load()
        const report = validReport()
        delete report.data_markers

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('data_markers') !== -1)).toBe(true)
    })

    test('data_markers as an empty array is VALID — may be empty, must be present', () => {
        const fx = load()
        const report = validReport({ data_markers: [] })

        const result = fx.validate(report)

        expect(result.valid).toBe(true)
    })

    test('data_markers with entries normalizes them through untouched', () => {
        const fx = load()
        const report = validReport({ data_markers: ['user.email: gapietro@gmail.com'] })

        const result = fx.validate(report)

        expect(result.valid).toBe(true)
        expect(result.normalized.data_markers).toEqual(['user.email: gapietro@gmail.com'])
    })

    test('unknown extra keys survive normalization untouched — validation is a floor, not a ceiling', () => {
        const fx = load()
        const report = validReport({
            confidence_narrative: 'the model added this on its own initiative',
            extra_nested: { anything: 'goes here' },
        })

        const result = fx.validate(report)

        expect(result.valid).toBe(true)
        expect(result.normalized.confidence_narrative).toBe('the model added this on its own initiative')
        expect(result.normalized.extra_nested).toEqual({ anything: 'goes here' })
    })

    test('multiple problems across independent blocks all surface at once, not just the first', () => {
        const fx = load()
        const report = validReport()
        delete report.failure_summary
        delete report.verification
        delete report.data_markers

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.length).toBeGreaterThanOrEqual(3)
    })
})

// ===========================================================================
// renderMarkdown / renderJson (Task 4 brief, Step 4)
// ===========================================================================

describe('PaFixReport.renderMarkdown', () => {
    test('contains the six playbook section headings, in playbook order', () => {
        const fx = load()
        const { normalized } = fx.validate(validReport())

        const md = fx.renderMarkdown(normalized)

        const headings = ['FAILURE SUMMARY', 'LAYERS SWEPT', 'ROOT CAUSES', 'FIXES', 'VERIFICATION', 'DATA MARKERS']
        let lastIndex = -1
        headings.forEach((h) => {
            const idx = md.indexOf(h)
            expect(idx).toBeGreaterThan(-1)
            expect(idx).toBeGreaterThan(lastIndex)
            lastIndex = idx
        })
    })

    test('renders failure_summary text under FAILURE SUMMARY', () => {
        const fx = load()
        const { normalized } = fx.validate(validReport())

        const md = fx.renderMarkdown(normalized)

        expect(md).toEqual(expect.stringContaining('The agent never called the tool because the trigger never fired.'))
    })

    test('renders data markers under DATA MARKERS', () => {
        const fx = load()
        const { normalized } = fx.validate(validReport({ data_markers: ['ticket.short_description: contains PII'] }))

        const md = fx.renderMarkdown(normalized)

        const dataMarkersIdx = md.indexOf('DATA MARKERS')
        const markerIdx = md.indexOf('ticket.short_description: contains PII')
        expect(dataMarkersIdx).toBeGreaterThan(-1)
        expect(markerIdx).toBeGreaterThan(dataMarkersIdx)
    })

    test('empty data markers render something explicit, not a blank section', () => {
        const fx = load()
        const { normalized } = fx.validate(validReport({ data_markers: [] }))

        const md = fx.renderMarkdown(normalized)
        const dataMarkersSection = md.substring(md.indexOf('DATA MARKERS'))

        expect(dataMarkersSection.length).toBeGreaterThan('DATA MARKERS'.length)
    })

    test('does not throw on a sparse/partial object (defensive rendering, R-9)', () => {
        const fx = load()

        expect(() => fx.renderMarkdown({})).not.toThrow()
        expect(() => fx.renderMarkdown(null)).not.toThrow()
        expect(() => fx.renderMarkdown(undefined)).not.toThrow()
    })
})

describe('PaFixReport.renderJson', () => {
    test('renders valid, parseable JSON that round-trips the normalized report', () => {
        const fx = load()
        const { normalized } = fx.validate(validReport())

        const json = fx.renderJson(normalized)
        const parsed = JSON.parse(json)

        expect(parsed).toEqual(normalized)
    })

    test('does not throw on odd input (R-9)', () => {
        const fx = load()

        expect(() => fx.renderJson(undefined)).not.toThrow()
        expect(() => fx.renderJson(null)).not.toThrow()
    })
})

// ===========================================================================
// repairPrompt (Task 4 brief, Step 4)
// ===========================================================================

describe('PaFixReport.repairPrompt', () => {
    test('contains every problem string verbatim', () => {
        const fx = load()
        const problems = ['failure_summary is required and must be a non-empty string', 'root_causes must include at least one entry']

        const prompt = fx.repairPrompt({ failure_summary: '' }, problems)

        problems.forEach((p) => {
            expect(prompt).toEqual(expect.stringContaining(p))
        })
    })

    test('contains the phrase "JSON only"', () => {
        const fx = load()

        const prompt = fx.repairPrompt({}, ['some problem'])

        expect(prompt).toEqual(expect.stringContaining('JSON only'))
    })

    test('contains the schema (mentions every required top-level field)', () => {
        const fx = load()

        const prompt = fx.repairPrompt({}, ['some problem'])

        ;['failure_summary', 'layers_swept', 'root_causes', 'fixes', 'verification', 'data_markers'].forEach((field) => {
            expect(prompt).toEqual(expect.stringContaining(field))
        })
    })

    test('does not throw when problems or report are absent (R-9)', () => {
        const fx = load()

        expect(() => fx.repairPrompt(undefined, undefined)).not.toThrow()
        expect(() => fx.repairPrompt(null, null)).not.toThrow()
        expect(() => fx.repairPrompt({}, [])).not.toThrow()
    })
})
