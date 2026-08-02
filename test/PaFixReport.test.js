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

    // Fix round (issue #64/#65, controller ruling on the third live-caught
    // defect): a bare JSON number (1-7) is a completely reasonable way for a
    // model to answer "which layer" — root_causes[].layer is keyed the same
    // 1-7 range layers_swept already uses, and rejecting the number was
    // validator pedantry, not a real defect. Live-caught on gpinst01: once
    // the key-casing and envelope defects were fixed, the model's repair
    // draft used `"layer":1` / `"layer":4` and both were rejected as
    // "missing layer".
    test('a numeric layer (JSON number 1-7) is accepted, not rejected as missing', () => {
        const fx = load()
        const report = validReport()
        report.root_causes[0].layer = 1

        const result = fx.validate(report)

        expect(result.valid).toBe(true)
        expect(result.problems).toBeUndefined()
    })

    test('a numeric layer is normalized to its string form in the normalized output', () => {
        const fx = load()
        const report = validReport()
        report.root_causes[0].layer = 4

        const result = fx.validate(report)

        expect(result.valid).toBe(true)
        expect(result.normalized.root_causes[0].layer).toBe('4')
        expect(typeof result.normalized.root_causes[0].layer).toBe('string')
    })

    test('a string layer passes through the normalized output unchanged', () => {
        const fx = load()
        const report = validReport()
        report.root_causes[0].layer = 'layer 7'

        const result = fx.validate(report)

        expect(result.valid).toBe(true)
        expect(result.normalized.root_causes[0].layer).toBe('layer 7')
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

    test('a root cause evidence entry with an invalid source names the exact per-entry label (pins the _checkEvidenceEntries refactor)', () => {
        const fx = load()
        const report = validReport()
        report.root_causes[0].evidence = [
            { source: 'vibes', detail: 'it felt wrong' },
            { source: 'config', detail: 'sn_aia_trigger_configuration.usecase = NULL, sys_id abc123' },
        ]

        const result = fx.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.join('\n')).toContain('root_causes[0].evidence[0]')
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

    // Fix round (issue #64/#65): live-caught on gpinst01 — a model that
    // perfectly fixes every structural problem on repair still failed,
    // because the repair prompt never told it to keep the
    // {"action":"fix_report","report":{...}} envelope PaLlmProxy.reason()
    // unconditionally requires. This is the instruction that closes that
    // gap.
    test('contains the response envelope instruction, not just the bare report shape', () => {
        const fx = load()

        const prompt = fx.repairPrompt({}, ['some problem'])

        expect(prompt).toEqual(expect.stringContaining('{"action":"fix_report","report":'))
        expect(prompt).toEqual(expect.stringContaining('Do not return the report object by itself'))
    })
})

// ===========================================================================
// schemaText — single-sourced schema prose (fix round, issue #64/#65):
// PaAgentLoop's own fix_report contract block reads this SAME method, so the
// required JSON key names are authored in exactly one place rather than
// copied by hand into two prompts that can drift apart.
// ===========================================================================

describe('PaFixReport.schemaText', () => {
    test('is public and mentions every required top-level field', () => {
        const fx = load()

        const text = fx.schemaText()

        ;['failure_summary', 'layers_swept', 'root_causes', 'fixes', 'verification', 'data_markers'].forEach(
            (field) => {
                expect(text).toEqual(expect.stringContaining(field))
            }
        )
    })

    test('is what repairPrompt embeds verbatim under "Required schema:"', () => {
        const fx = load()

        expect(fx.repairPrompt({}, ['x'])).toEqual(expect.stringContaining(fx.schemaText()))
    })
})

// ===========================================================================
// The earned-inconclusive path (T4, bundled into issue #72)
// ===========================================================================

describe('inconclusive reports', () => {
    function allSevenSwept(status, reason) {
        const ls = {}
        for (let i = 1; i <= 7; i++) {
            ls[i] = status === 'SWEPT' ? { status: 'SWEPT' } : { status: status, reason: reason }
        }
        return ls
    }

    function inconclusiveReport(overrides) {
        return Object.assign(
            {
                failure_summary: 'The execution failed but the cause could not be isolated.',
                layers_swept: allSevenSwept('UNAVAILABLE', 'the trace record was purged before diagnosis'),
                root_causes: [],
                fixes: [],
                // A real string here (not just an absent key) so the
                // "verification may be omitted" test below is actually
                // exercising the relaxation, not the accident of a key that
                // was never present in the first place.
                verification: 'N/A — no fix was proposed on this path, so there is nothing to verify.',
                data_markers: [],
                inconclusive: {
                    evidence_read: [
                        { source: 'trace', detail: 'sn_aia_execution_plan 8f2c… returned zero task rows' },
                        { source: 'config', detail: 'sn_aia_agent "Order Triage" instructions read, 4200 chars' },
                    ],
                    needed_to_conclude: 'the sn_aia_execution_task rows for this plan, which no longer exist',
                },
            },
            overrides || {}
        )
    }

    test('empty root_causes and fixes VALIDATE when the inconclusive block is present and cited', () => {
        const res = load().validate(inconclusiveReport())

        expect(res.valid).toBe(true)
        expect(res.normalized.inconclusive.needed_to_conclude).toContain('sn_aia_execution_task')
    })

    test('empty root_causes WITHOUT an inconclusive block is still rejected, and the problem says not to invent one', () => {
        const res = load().validate(inconclusiveReport({ inconclusive: undefined }))

        expect(res.valid).toBe(false)
        expect(res.problems.join('\n')).toContain('inconclusive')
        expect(res.problems.join('\n')).toContain('Do NOT invent a root cause')
    })

    test('empty fixes alongside a NAMED root cause is still rejected — a cause with no fix is a defect', () => {
        const res = load().validate(
            inconclusiveReport({
                root_causes: [
                    {
                        layer: '3',
                        component: 'sn_aia_tool "lookup_order"',
                        finding: 'input schema omits order_number',
                        evidence: [
                            { source: 'trace', detail: 'task 3 error: missing required input' },
                            { source: 'schema', detail: 'sn_aia_tool.inputs has no order_number key' },
                        ],
                    },
                ],
                inconclusive: undefined,
            })
        )

        expect(res.valid).toBe(false)
        expect(res.problems.join('\n')).toContain('fixes must include at least one entry')
    })

    test('inconclusive.evidence_read is mandatory and must be non-empty — an uncited "I could not tell" is not earned', () => {
        const res = load().validate(
            inconclusiveReport({
                inconclusive: { evidence_read: [], needed_to_conclude: 'more data' },
            })
        )

        expect(res.valid).toBe(false)
        expect(res.problems.join('\n')).toContain('inconclusive.evidence_read')
    })

    test('an evidence_read entry with a source outside the vocabulary is rejected', () => {
        const res = load().validate(
            inconclusiveReport({
                inconclusive: {
                    evidence_read: [{ source: 'vibes', detail: 'it felt wrong' }],
                    needed_to_conclude: 'more data',
                },
            })
        )

        expect(res.valid).toBe(false)
        expect(res.problems.join('\n')).toContain('inconclusive.evidence_read[0]')
    })

    test('inconclusive.needed_to_conclude is mandatory', () => {
        const res = load().validate(
            inconclusiveReport({
                inconclusive: {
                    evidence_read: [{ source: 'trace', detail: 'zero rows' }],
                    needed_to_conclude: '   ',
                },
            })
        )

        expect(res.valid).toBe(false)
        expect(res.problems.join('\n')).toContain('needed_to_conclude')
    })

    test('the evidence RULE does not bind evidence_read — a record of what was read is not a claim about a cause', () => {
        const res = load().validate(
            inconclusiveReport({
                inconclusive: {
                    evidence_read: [{ source: 'config', detail: 'agent instructions, 4200 chars' }],
                    needed_to_conclude: 'the purged trace',
                },
            })
        )

        expect(res.valid).toBe(true)
    })

    test('verification may be omitted on the inconclusive path — there is nothing to verify', () => {
        const report = inconclusiveReport()
        delete report.verification

        const res = load().validate(report)

        expect(res.valid).toBe(true)
    })

    test('verification is STILL required when the inconclusive path proposes fixes — root_causes empty is not enough to relax it', () => {
        const res = load().validate(
            inconclusiveReport({
                fixes: [
                    {
                        target_type: 'configuration',
                        target: 'sn_aia_trigger_configuration on Agent Doctor',
                        current: '',
                        proposed: 'set usecase to the workflow usecase sys_id',
                        rationale: 'the trigger cannot bind without it',
                    },
                ],
                verification: undefined,
            })
        )

        expect(res.valid).toBe(false)
        expect(res.problems.join('\n')).toContain('verification is required')
    })

    test('inconclusive: [] (an array, not an object) falls back to full enforcement — root_causes must include at least one entry', () => {
        const res = load().validate(inconclusiveReport({ inconclusive: [] }))

        expect(res.valid).toBe(false)
        expect(res.problems.join('\n')).toContain('Do NOT invent a root cause')
    })

    test('inconclusive: null falls back to full enforcement — root_causes must include at least one entry', () => {
        const res = load().validate(inconclusiveReport({ inconclusive: null }))

        expect(res.valid).toBe(false)
        expect(res.problems.join('\n')).toContain('Do NOT invent a root cause')
    })

    test('verification is STILL required when real root causes are named', () => {
        const res = load().validate(
            inconclusiveReport({
                root_causes: [
                    {
                        layer: '3',
                        component: 'sn_aia_tool "lookup_order"',
                        finding: 'input schema omits order_number',
                        evidence: [
                            { source: 'trace', detail: 'task 3 error: missing required input' },
                            { source: 'schema', detail: 'sn_aia_tool.inputs has no order_number key' },
                        ],
                    },
                ],
                fixes: [
                    {
                        target_type: 'tool schema',
                        target: 'sn_aia_tool "lookup_order"',
                        current: '',
                        proposed: 'add order_number',
                        rationale: 'the tool cannot run without it',
                    },
                ],
                inconclusive: undefined,
                verification: undefined,
            })
        )

        expect(res.valid).toBe(false)
        expect(res.problems.join('\n')).toContain('verification is required')
    })

    test('layers_swept is still fully enforced on the inconclusive path — the escape hatch is not a bypass', () => {
        const res = load().validate(
            inconclusiveReport({ layers_swept: { 1: { status: 'SWEPT' } } })
        )

        expect(res.valid).toBe(false)
        expect(res.problems.join('\n')).toContain('layers_swept is missing layer 2')
    })

    test('an un-swept layer with no reason is still rejected on the inconclusive path', () => {
        const ls = {}
        for (let i = 1; i <= 7; i++) ls[i] = { status: 'NOT_SWEPT' }
        const res = load().validate(inconclusiveReport({ layers_swept: ls }))

        expect(res.valid).toBe(false)
        expect(res.problems.join('\n')).toContain('has no reason')
    })

    // -----------------------------------------------------------------------
    // Citation pricing tied to the sweep claim (Critical 1, fix round 1):
    // claiming N layers SWEPT requires at least N evidence_read citations —
    // layers_swept alone is not a differential cost, since every path pays it.
    // -----------------------------------------------------------------------

    test('claiming all seven layers SWEPT with only one citation is INVALID — the citation bill is unpaid', () => {
        const res = load().validate(
            inconclusiveReport({
                layers_swept: allSevenSwept('SWEPT'),
                inconclusive: {
                    evidence_read: [{ source: 'config', detail: 'agent instructions read, 4200 chars' }],
                    needed_to_conclude: 'a clearer trace',
                },
            })
        )

        expect(res.valid).toBe(false)
        expect(res.problems.join('\n')).toContain('inconclusive.evidence_read has 1 citation(s) but layers_swept marks 7 layer(s) SWEPT')
    })

    test('claiming all seven layers SWEPT with seven citations is VALID — the claim is paid for', () => {
        const evidence_read = []
        for (let i = 1; i <= 7; i++) {
            evidence_read.push({ source: 'config', detail: 'layer ' + i + ' checked, nothing conclusive' })
        }
        const res = load().validate(
            inconclusiveReport({
                layers_swept: allSevenSwept('SWEPT'),
                inconclusive: {
                    evidence_read: evidence_read,
                    needed_to_conclude: 'a clearer trace',
                },
            })
        )

        expect(res.valid).toBe(true)
    })

    test('claiming two layers SWEPT and honestly marking the other five NOT_SWEPT/UNAVAILABLE needs only two citations', () => {
        const ls = {
            1: { status: 'SWEPT' },
            2: { status: 'SWEPT' },
            3: { status: 'UNAVAILABLE', reason: 'the trace record was purged before diagnosis' },
            4: { status: 'UNAVAILABLE', reason: 'the trace record was purged before diagnosis' },
            5: { status: 'NOT_SWEPT', reason: 'ran out of time before the data layer' },
            6: { status: 'NOT_SWEPT', reason: 'ran out of time before the data layer' },
            7: { status: 'NOT_SWEPT', reason: 'ran out of time before the data layer' },
        }
        const res = load().validate(
            inconclusiveReport({
                layers_swept: ls,
                inconclusive: {
                    evidence_read: [
                        { source: 'trace', detail: 'sn_aia_execution_plan: no rows for this agent in 24h' },
                        { source: 'config', detail: 'agent instructions read, 4200 chars' },
                    ],
                    needed_to_conclude: 'the purged trace',
                },
            })
        )

        expect(res.valid).toBe(true)
    })

    // -----------------------------------------------------------------------
    // Advertising and rendering the path (T6, issue #72): the escape hatch
    // above changes nothing if the model is never told it exists.
    // -----------------------------------------------------------------------

    test('schemaText documents the inconclusive field so the model knows the path exists', () => {
        const text = load().schemaText()

        expect(text).toContain('inconclusive')
        expect(text).toContain('evidence_read')
        expect(text).toContain('needed_to_conclude')
        // and it must say the honest path is preferred over invention
        expect(text.toLowerCase()).toContain('preferred')
    })

    test('schemaText states the citation-per-sweep pricing rule and that NOT_SWEPT/UNAVAILABLE reduces it (fix round 1, #72)', () => {
        const text = load().schemaText()

        // Pins the at-least-as-many-citations-as-SWEPT-layers rule itself —
        // distinctive enough that a rewording which lost the meaning would
        // break this assertion, not survive it.
        expect(text).toContain('AT LEAST AS MANY entries as the number of layers marked SWEPT in layers_swept')
        expect(text).toContain('claim seven sweeps, cite seven things')
        // Pins that marking a layer NOT_SWEPT/UNAVAILABLE — not SWEPT — is
        // what lowers the citation bill, matching _countSweptLayers exactly.
        expect(text).toContain('mark a layer NOT_SWEPT or UNAVAILABLE with a reason instead and fewer citations are required')
    })

    test('renderMarkdown emits an INCONCLUSIVE section between LAYERS SWEPT and ROOT CAUSES', () => {
        const md = load().renderMarkdown(inconclusiveReport())

        expect(md).toContain('## INCONCLUSIVE')
        expect(md).toContain('needed to conclude: the sn_aia_execution_task rows')
        expect(md).toContain('- trace: sn_aia_execution_plan')
        expect(md.indexOf('## LAYERS SWEPT')).toBeLessThan(md.indexOf('## INCONCLUSIVE'))
        expect(md.indexOf('## INCONCLUSIVE')).toBeLessThan(md.indexOf('## ROOT CAUSES'))
    })

    test('renderMarkdown marks verification not-applicable on the inconclusive path', () => {
        const md = load().renderMarkdown(inconclusiveReport({ verification: undefined }))

        expect(md).toContain('(not applicable — inconclusive)')
    })

    test('renderMarkdown on a normal report is unchanged — no INCONCLUSIVE section, verification reads (not provided)', () => {
        const md = load().renderMarkdown({ failure_summary: 'x', root_causes: [], fixes: [] })

        expect(md).not.toContain('## INCONCLUSIVE')
        expect(md).toContain('(not provided)')
    })
})
