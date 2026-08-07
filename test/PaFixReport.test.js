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

// =========================================================================
// #78 — the absence-diagnosis path
// =========================================================================

/**
 * A report diagnosing a defect where the agent NEVER RAN: layer 1 is
 * UNAVAILABLE because no sn_aia_execution_plan row exists to read. This is
 * seed 05's shape.
 */
function absenceReport(evidence) {
    const layers = sweptLayers()
    layers[1] = { status: 'UNAVAILABLE', reason: 'no sn_aia_execution_plan row exists — the agent never ran' }
    return validReport({
        layers_swept: layers,
        root_causes: [
            {
                layer: 'layer 7',
                component: 'sn_aia_trigger_configuration bfb77d6c64884500a80203ee029436ee',
                finding: 'active=false, so the trigger never fires and no execution is ever created.',
                evidence: evidence,
            },
        ],
    })
}

describe('#78 absence-diagnosis', () => {
    test('layer 1 UNAVAILABLE + two DISTINCT non-trace sources → valid', () => {
        const reports = load()
        const report = absenceReport([
            { source: 'config', detail: 'sn_aia_trigger_configuration.active = false, sys_id bfb77d6c...' },
            { source: 'schema', detail: 'sn_aia_trigger_configuration.active is a boolean, default true' },
        ])

        expect(reports.validate(report).valid).toBe(true)
    })

    test('layer 1 UNAVAILABLE + two citations of the SAME source → invalid; the relaxation is not a giveaway', () => {
        const reports = load()
        const report = absenceReport([
            { source: 'config', detail: 'sn_aia_trigger_configuration.active = false' },
            { source: 'config', detail: 'sn_aia_usecase.execution_mode = copilot' },
        ])

        const result = reports.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('evidence rule') !== -1)).toBe(true)
    })

    test('layer 1 SWEPT + config only → still invalid; mode B is not triggered', () => {
        const reports = load()
        const report = validReport({
            root_causes: [
                {
                    layer: 'layer 7',
                    component: 'sn_aia_trigger_configuration',
                    finding: 'active=false',
                    evidence: [
                        { source: 'config', detail: 'active = false' },
                        { source: 'schema', detail: 'active is boolean' },
                    ],
                },
            ],
        })

        const result = reports.validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('evidence rule') !== -1)).toBe(true)
    })

    test('MONOTONICITY: trace + config still passes via mode A even when layer 1 is UNAVAILABLE', () => {
        const reports = load()
        const report = absenceReport([
            { source: 'trace', detail: 'sn_aia_execution_plan: no rows in 24h' },
            { source: 'config', detail: 'sn_aia_trigger_configuration.active = false' },
        ])

        expect(reports.validate(report).valid).toBe(true)
    })

    test('the no-trace problem tells the model how to report an absence', () => {
        const reports = load()
        const report = validReport({
            root_causes: [
                {
                    layer: 'layer 7',
                    component: 'sn_aia_trigger_configuration',
                    finding: 'active=false',
                    evidence: [{ source: 'config', detail: 'active = false' }],
                },
            ],
        })

        const result = reports.validate(report)

        expect(result.problems.some((p) => p.indexOf('UNAVAILABLE') !== -1)).toBe(true)
    })

    test('validate(report) with ONE argument is unchanged', () => {
        const reports = load()

        expect(reports.validate(validReport()).valid).toBe(true)
    })
})

// =========================================================================
// #79a — citations cross-checked against what the run actually invoked
// =========================================================================

/** The context PaAgentLoop passes in. */
function auditCtx(tools) {
    return { auditAvailable: true, invokedTools: tools }
}

/** Every tool invoked — the shape that lets validReport() pass unchanged. */
function allToolsCtx() {
    return auditCtx([
        'agent_trace',
        'agent_config',
        'schema_lookup',
        'query_table',
        'genai_log',
        'log_analysis',
        'read_artifact',
    ])
}

describe('#79a citation cross-check', () => {
    test('a citation naming a source no invoked tool reads → invalid, and names the source', () => {
        const reports = load()
        // The exact live shape: run 100c8910... cited agent_config having
        // only ever invoked agent_trace.
        const report = validReport({
            root_causes: [
                {
                    layer: 'layer 7',
                    component: 'sn_aia_trigger_configuration',
                    finding: 'active=false',
                    evidence: [
                        { source: 'trace', detail: 'sn_aia_execution_plan: no rows' },
                        { source: 'config', detail: 'sn_aia_trigger_configuration.active = false' },
                    ],
                },
            ],
        })

        const result = reports.validate(report, auditCtx(['agent_trace']))

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('unsupported citation') !== -1)).toBe(true)
        expect(result.problems.some((p) => p.indexOf('config') !== -1)).toBe(true)
    })

    test('a citation supported through an ALTERNATE tool passes — the map is permissive', () => {
        const reports = load()
        const layers = sweptLayers()
        // Only the layers genai_log and agent_trace can answer.
        layers[2] = { status: 'NOT_SWEPT', reason: 'not reached' }
        layers[3] = { status: 'NOT_SWEPT', reason: 'not reached' }
        layers[4] = { status: 'NOT_SWEPT', reason: 'not reached' }
        layers[5] = { status: 'NOT_SWEPT', reason: 'not reached' }
        layers[7] = { status: 'NOT_SWEPT', reason: 'not reached' }
        const report = validReport({
            layers_swept: layers,
            root_causes: [
                {
                    layer: 'layer 6',
                    component: 'sys_generative_ai_capability api field',
                    finding: 'api points at a definition that does not exist.',
                    evidence: [
                        { source: 'trace', detail: 'OneExtendUtil.execute status:error' },
                        { source: 'config', detail: 'capability.api = 7c9f... which resolves to nothing' },
                    ],
                },
            ],
        })

        // genai_log alone supports BOTH trace and config.
        const result = reports.validate(report, auditCtx(['genai_log']))

        expect(result.valid).toBe(true)
    })

    test('inconclusive.evidence_read is cross-checked identically', () => {
        const reports = load()
        const layers = sweptLayers()
        Object.keys(layers).forEach((k) => {
            layers[k] = { status: 'NOT_SWEPT', reason: 'no tool reached this layer' }
        })
        const report = validReport({
            layers_swept: layers,
            root_causes: [],
            fixes: [],
            verification: undefined,
            inconclusive: {
                evidence_read: [{ source: 'schema', detail: 'sys_dictionary for x_snc_troubleshoot_run' }],
                needed_to_conclude: 'A schema read of the target table.',
            },
        })

        const result = reports.validate(report, auditCtx(['agent_trace']))

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('unsupported citation') !== -1)).toBe(true)
    })

    test('auditAvailable:false skips the cross-check entirely — a degraded trail convicts nobody', () => {
        const reports = load()
        const report = validReport()

        const result = reports.validate(report, { auditAvailable: false, invokedTools: [] })

        expect(result.valid).toBe(true)
    })

    test('a malformed context skips the cross-check rather than failing closed', () => {
        const reports = load()

        expect(reports.validate(validReport(), { auditAvailable: 'yes' }).valid).toBe(true)
        expect(reports.validate(validReport(), null).valid).toBe(true)
    })

    test('a fully supported report passes with the audit check active', () => {
        const reports = load()

        expect(reports.validate(validReport(), allToolsCtx()).valid).toBe(true)
    })
})

// =========================================================================
// #79b — SWEPT claims cross-checked against what the run actually invoked
// =========================================================================

describe('#79b sweep-claim cross-check', () => {
    test('layers marked SWEPT with no supporting tool → invalid', () => {
        const reports = load()

        // The re-run's worst draft: all seven layers SWEPT on two tool calls,
        // both reads of the same trace.
        const result = reports.validate(validReport(), auditCtx(['agent_trace', 'read_artifact']))

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('unsupported sweep claim') !== -1)).toBe(true)
    })

    test('ONE collapsed problem, not one per layer', () => {
        const reports = load()

        const result = reports.validate(validReport(), auditCtx(['agent_trace']))
        const sweepProblems = result.problems.filter((p) => p.indexOf('unsupported sweep claim') !== -1)

        expect(sweepProblems.length).toBe(1)
    })

    test('the collapsed problem names every offending layer', () => {
        const reports = load()

        const result = reports.validate(validReport(), auditCtx(['agent_trace']))
        const problem = result.problems.filter((p) => p.indexOf('unsupported sweep claim') !== -1)[0]

        // agent_trace answers layer 1 only; 2-7 are all unsupported.
        expect(problem.indexOf('2 (Instructions)')).not.toBe(-1)
        expect(problem.indexOf('4 (Data schemas)')).not.toBe(-1)
        expect(problem.indexOf('7 (Trigger and wiring)')).not.toBe(-1)
        expect(problem.indexOf('1 (Execution trace)')).toBe(-1)
    })

    test('NOT_SWEPT and UNAVAILABLE are never cross-checked', () => {
        const reports = load()
        const layers = sweptLayers()
        layers[2] = { status: 'NOT_SWEPT', reason: 'budget exhausted before instructions' }
        layers[4] = { status: 'UNAVAILABLE', reason: 'schema read denied cross-scope' }
        layers[5] = { status: 'NOT_SWEPT', reason: 'no data question arose' }
        layers[6] = { status: 'NOT_SWEPT', reason: 'not reached' }
        const report = validReport({ layers_swept: layers })

        // agent_trace covers 1; agent_config covers 3 and 7. 2/4/5/6 are not SWEPT.
        const result = reports.validate(report, auditCtx(['agent_trace', 'agent_config']))

        expect(result.valid).toBe(true)
    })

    test('auditAvailable:false skips the sweep cross-check too', () => {
        const reports = load()

        const result = reports.validate(validReport(), { auditAvailable: false, invokedTools: [] })

        expect(result.valid).toBe(true)
    })

    test('read_artifact alone supports NO layer — its producing tool is what counts', () => {
        const reports = load()

        const result = reports.validate(validReport(), auditCtx(['read_artifact']))
        const sweepProblems = result.problems.filter((p) => p.indexOf('unsupported sweep claim') !== -1)

        // All seven layers are SWEPT and none is supported: one collapsed problem.
        expect(sweepProblems.length).toBe(1)
        expect(sweepProblems[0].indexOf('7 layer(s)')).not.toBe(-1)
    })

    test('read_artifact alone supports NO citation either — the Task 3 map is corrected here', () => {
        const reports = load()

        const result = reports.validate(validReport(), auditCtx(['read_artifact']))

        expect(result.problems.some((p) => p.indexOf('unsupported citation') !== -1)).toBe(true)
    })
})

// =========================================================================
// The contract the model is actually shown
// =========================================================================

describe('schemaText contract additions', () => {
    test('tells the model citations are checked against tools actually called', () => {
        const text = load().schemaText()

        expect(text.indexOf('actually called') !== -1 || text.indexOf('actually invoked') !== -1).toBe(true)
    })

    test('tells the model a SWEPT layer needs a tool call behind it', () => {
        const text = load().schemaText()

        expect(text.indexOf('SWEPT')).not.toBe(-1)
        expect(text.toLowerCase().indexOf('tool call')).not.toBe(-1)
    })

    test('tells the model how to report an absence', () => {
        const text = load().schemaText()

        expect(text.indexOf('UNAVAILABLE')).not.toBe(-1)
        expect(text.indexOf('two distinct')).not.toBe(-1)
    })

    test('is still a single non-empty string', () => {
        const text = load().schemaText()

        expect(typeof text).toBe('string')
        expect(text.length > 0).toBe(true)
    })

    // -----------------------------------------------------------------
    // Regression net (fix round 1): the four tests above are presence-only
    // and would survive a wrong tool mapping, a flipped read_artifact rule,
    // or a "two citations" absence clause that no longer requires the
    // sources to be DISTINCT. These derive their expectations from the
    // enforcement code itself (_citationToolMap / _nonTraceEvidenceSources)
    // so the test tracks the rule, not a hand-copied string, and fails on a
    // wrong RULE rather than on harmless rewording.
    // -----------------------------------------------------------------

    test('the citation clause correctly maps each evidence source to the tools that actually support it (per _citationToolMap)', () => {
        const fx = load()
        const text = fx.schemaText()
        const map = fx._citationToolMap()

        // Isolate the citation-cross-check paragraph so a tool name that
        // legitimately appears elsewhere in the schema (e.g. the SWEPT
        // clause also names agent_config) can't produce a false pass.
        const start = text.indexOf('EVIDENCE IS CHECKED AGAINST WHAT YOU ACTUALLY CALLED')
        const end = text.indexOf('A LAYER MARKED SWEPT')
        expect(start).not.toBe(-1)
        expect(end).not.toBe(-1)
        const clause = text.slice(start, end)

        Object.keys(map).forEach((source) => {
            // Capture whatever tool list follows "<source> from"/"<source>
            // comes from" up to the next comma or period — tolerant of the
            // exact connector wording and of '/' vs ', ' as the tool
            // separator, but still positionally tied to THIS source.
            const re = new RegExp(source + ' (?:comes from|from) ([^,.]+)', 'i')
            const m = clause.match(re)
            expect(m).not.toBeNull()

            const mentioned = m[1]
                .split(/[\/,]+/)
                .map((s) => s.trim())
                .filter(Boolean)
                .sort()
            const expected = map[source].slice().sort()

            expect(mentioned).toEqual(expected)
        })
    })

    // -----------------------------------------------------------------
    // #110 — the tool-name set schemaText() emits is PINNED, not empty.
    //
    // §H8 item 3 rested on "the harness never names the measured tools to
    // the model". That premise was never true: PaToolRegistry.promptBlock()
    // puts ~8-9KB of descriptions for all seven tools into every prompt by
    // design, because a tool-calling agent has to be told what tools it has.
    // schemaText() names them too — in the citation clause (load-bearing for
    // #79) and in the per-layer clause list generated from _layerToolMap().
    //
    // This test does NOT forbid that, and must not be "fixed" by removing
    // names. It pins WHICH tools appear so the set cannot drift silently:
    // a change to what the model is told then fails CI and has to go through
    // DECISION.md §S rather than arriving as a side effect of a map edit.
    // -----------------------------------------------------------------

    test('the SWEPT clause advertises exactly _layerToolMap per layer, and introduces no tool _scrubToolNames cannot strip (#110)', () => {
        const fx = load()
        const text = fx.schemaText()
        const map = fx._layerToolMap()

        // _ALL_TOOL_NAMES is the list PaAgentLoop._scrubToolNames strips out
        // of the hold block. Read it from the source rather than retyping it,
        // so this test and the scrubber cannot disagree.
        const loopCtx = loadScriptInclude('PaAgentLoop.js', { JSON: JSON })
        const allTools = new loopCtx.PaAgentLoop({})._ALL_TOOL_NAMES
        expect(allTools.length).toBe(7)

        // (1) Per-layer correspondence, checked POSITIONALLY inside the SWEPT
        // clause, against a PINNED literal snapshot of _layerToolMap() — NOT
        // a live call to it. Unlike the citation clause (hardcoded prose,
        // independent of _citationToolMap()), the SWEPT clause is
        // PROGRAMMATICALLY GENERATED from _layerToolMap() itself (schemaText()
        // calls `this._layerToolMap()` to build the "N (Name) needs one of:
        // ..." list). Comparing the rendered text to a live `fx._layerToolMap()`
        // call is therefore a tautology — both sides read the same (possibly
        // edited) function within the same run and can never disagree.
        // Confirmed empirically: perturbing _layerToolMap()'s layer 4 entry
        // from ['schema_lookup'] to ['agent_config'] produced NO test failure
        // against a live comparison (see task-1-report.md). Pinning to a
        // literal is what gives this assertion teeth against a silent
        // _layerToolMap() edit — the exact class of regression #110 exists to
        // catch, and the exact failure mode this file's own history (52a0798)
        // warns about: a guard weaker than the thing it guards.
        //
        // A whole-text scan would not catch a layer-map narrowing either way:
        // all seven tools are also named in the citation clause above, so "is
        // schema_lookup mentioned somewhere?" stays true even if layer 4 stops
        // advertising it. Same clause-isolation technique as the
        // _citationToolMap test above.
        const expectedLayerToolMap = {
            1: ['agent_trace', 'genai_log', 'log_analysis'],
            2: ['agent_config'],
            3: ['agent_config'],
            4: ['schema_lookup'],
            5: ['query_table', 'log_analysis'],
            6: ['genai_log', 'log_analysis'],
            7: ['agent_config'],
        }

        // The literal is a SNAPSHOT, so the loop below iterates ITS keys — a
        // layer added to both _layerDefs() and _layerToolMap() would be
        // advertised in this clause and checked by nothing. Pin the key SET
        // against the live map so a new (or removed) layer fails loudly here
        // and has to be added to the snapshot deliberately. This is not the
        // tautology the per-layer comparison would be: the values still come
        // from the literal, only the layer roster is read live.
        expect(Object.keys(expectedLayerToolMap).sort()).toEqual(Object.keys(map).sort())

        // Bound the slice at the next clause, exactly as the _citationToolMap
        // test above does — `text.slice(start)` would run to end-of-text and
        // let a layer clause that migrated out of the SWEPT paragraph still
        // satisfy the regex from wherever it landed.
        const start = text.indexOf('A LAYER MARKED SWEPT')
        const end = text.indexOf('IF NOTHING EVER RAN, SAY SO')
        expect(start).not.toBe(-1)
        expect(end).not.toBe(-1)
        const clause = text.slice(start, end)

        Object.keys(expectedLayerToolMap).forEach((layer) => {
            // "4 (Schema) needs one of: schema_lookup" — capture the tool
            // list between "needs one of: " and the clause separator.
            const re = new RegExp('\\b' + layer + ' \\([^)]*\\) needs one of: ([^;.]+)')
            const m = clause.match(re)
            expect(m).not.toBeNull()

            const advertised = m[1]
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .sort()
            expect(advertised).toEqual(expectedLayerToolMap[layer].slice().sort())
        })

        // (2) Registered-set membership — widening, where it bites. A tool
        // entering _layerToolMap() without entering _ALL_TOOL_NAMES would be
        // rendered into every prompt here AND survive _scrubToolNames in the
        // hold block, breaking the one claim §S says still holds: that the
        // depth gate's DIRECTION names no tool.
        Object.keys(map).forEach((layer) => {
            map[layer].forEach((t) => {
                expect(allTools).toContain(t)
            })
        })

        // (3) Whole-set presence — a coarse backstop recording that the leak
        // is total. This is the assertion that fails if someone "fixes" #110
        // by deleting names instead of going through DECISION.md §S.
        const named = allTools.filter((t) => text.indexOf(t) !== -1).sort()
        expect(named).toEqual(allTools.slice().sort())
    })

    test('states read_artifact does NOT count as evidence on its own (the negation, not just the token)', () => {
        const text = load().schemaText()

        expect(text.indexOf('read_artifact does NOT count')).not.toBe(-1)
        // A flip to "read_artifact DOES count" or "also counts" would still
        // contain the bare token "read_artifact" — assert the negated
        // guidance, not merely that the tool name is mentioned somewhere.
        expect(text.indexOf('read_artifact DOES count')).toBe(-1)
    })

    test('the SWEPT cross-check is stated as independent from the citation tool-map, not "the same way"', () => {
        const text = load().schemaText()

        // #79b's _layerToolMap is deliberately finer-grained than #79a's
        // _citationToolMap (layers 2/3/7 require agent_config specifically,
        // where the "config" evidence source also accepts genai_log) — the
        // schema text must not claim the two checks share one map, or a
        // model could conclude a genai_log-only run supports a layer-2
        // SWEPT claim.
        expect(text.indexOf('verified independently')).not.toBe(-1)
        expect(text.indexOf('verified the same way')).toBe(-1)
    })

    test('the absence clause requires two DISTINCT non-trace sources (from _nonTraceEvidenceSources), not merely two citations', () => {
        const fx = load()
        const text = fx.schemaText()

        // The exact source list is derived from the same helper the
        // enforcement code (_checkEvidenceRule) calls, so a change to what
        // counts as a non-trace source is caught here too.
        expect(text.indexOf('cite two distinct sources from ' + fx._nonTraceEvidenceSources().join('/'))).not.toBe(
            -1
        )
        expect(text.indexOf('Two citations of the same source are one source')).not.toBe(-1)
    })

    // -----------------------------------------------------------------
    // Final whole-branch review (2026-08-02), finding 1: the SWEPT clause
    // told the model claims are "verified independently, against the tools
    // this run invoked" without ever saying WHICH tool backs WHICH layer —
    // only the citation clause spelled its map out. A model that swept a
    // layer with a real, audited tool call outside `_layerToolMap`'s
    // per-layer choice (e.g. `query_table` directly against `sn_aia_agent`
    // for layer 2/3) had no way to predict the rejection, and the only
    // repair available in the one allowed repair turn is downgrading an
    // honest SWEPT to NOT_SWEPT/UNAVAILABLE — teaching the model to
    // under-report itself, the inverse of what this check exists to
    // protect (same class of defect as issue #78). Derived from
    // `_layerToolMap()`/`_layerDefs()`, exactly like the existing citation-
    // clause test derives from `_citationToolMap()`, so this fails on a
    // wrong RULE rather than surviving a silent drift between the map and
    // the prose.
    // -----------------------------------------------------------------

    test('the SWEPT clause lists the per-layer tool map, generated from _layerToolMap (finding 1 — an honest sweep must be predictable, not a repair-turn trap)', () => {
        const fx = load()
        const text = fx.schemaText()
        const map = fx._layerToolMap()
        const defs = fx._layerDefs()

        const start = text.indexOf('A LAYER MARKED SWEPT')
        const end = text.indexOf('IF NOTHING EVER RAN')
        expect(start).not.toBe(-1)
        expect(end).not.toBe(-1)
        const clause = text.slice(start, end)

        defs.forEach((def) => {
            const re = new RegExp(def.number + ' \\(' + def.name + '\\) needs one of: ([^;.]+)', 'i')
            const m = clause.match(re)
            expect(m).not.toBeNull()

            const mentioned = m[1]
                .split(/[\/,]+/)
                .map((s) => s.trim())
                .filter(Boolean)
                .sort()
            const expected = (map[def.number] || []).slice().sort()

            expect(mentioned).toEqual(expected)
        })
    })
})

// =========================================================================
// Final whole-branch review (2026-08-02), finding 2: `_citationToolMap().data`
// and `_layerToolMap()[5]` are the same concept (layer 1 was already kept
// aligned with the `trace` source) and should agree, so a `log_analysis`
// read that is valid `data` evidence is also valid layer-5 ("Data") sweep
// support.
// =========================================================================

describe('finding 2 — layer 5 (Data) is aligned with the data citation source', () => {
    test('_layerToolMap()[5] matches _citationToolMap().data exactly', () => {
        const fx = load()

        const layerFive = fx._layerToolMap()[5].slice().sort()
        const citationData = fx._citationToolMap().data.slice().sort()

        expect(layerFive).toEqual(citationData)
    })

    test('log_analysis alone supports a layer-5 (Data) SWEPT claim, matching its role as a data citation', () => {
        const reports = load()
        const layers = sweptLayers()
        layers[2] = { status: 'NOT_SWEPT', reason: 'not reached' }
        layers[3] = { status: 'NOT_SWEPT', reason: 'not reached' }
        layers[4] = { status: 'NOT_SWEPT', reason: 'not reached' }
        layers[6] = { status: 'NOT_SWEPT', reason: 'not reached' }
        layers[7] = { status: 'NOT_SWEPT', reason: 'not reached' }
        // Layers 1 and 5 stay SWEPT; both are answerable by log_analysis alone.
        const report = validReport({
            layers_swept: layers,
            root_causes: [
                {
                    layer: 'layer 5',
                    component: 'sn_aia_execution_plan payload row',
                    finding: 'the row referenced by the trace is malformed.',
                    evidence: [
                        { source: 'trace', detail: 'log analysis: malformed payload row flagged' },
                        { source: 'data', detail: 'log analysis: same row, raw value dump' },
                    ],
                },
            ],
        })

        const result = reports.validate(report, auditCtx(['log_analysis']))

        expect(result.valid).toBe(true)
    })
})

// =========================================================================
// Final whole-branch review (2026-08-02), finding 3: `_buildCheckContext`
// enabled the cross-checks whenever `auditAvailable === true` and
// `invokedTools` was an array — including an empty one, or one containing
// only blanks. `_anyInvoked` then matches nothing, so EVERY citation and
// EVERY SWEPT claim is rejected at once — a fail-CLOSED outcome for a
// context that should fail OPEN exactly like `auditAvailable:false` does.
// =========================================================================

describe('finding 3 — auditAvailable:true with an empty invokedTools list fails OPEN, not closed', () => {
    test('an empty invokedTools array disables the audit-backed checks entirely, same as auditAvailable:false', () => {
        const reports = load()

        const result = reports.validate(validReport(), { auditAvailable: true, invokedTools: [] })

        expect(result.valid).toBe(true)
    })

    test('an invokedTools array of only blanks/whitespace/null also disables the checks', () => {
        const reports = load()

        const result = reports.validate(validReport(), {
            auditAvailable: true,
            invokedTools: ['', '   ', null, undefined],
        })

        expect(result.valid).toBe(true)
    })

    test('a genuinely non-empty invokedTools array still enables the checks as before (no over-correction)', () => {
        const reports = load()

        // Only agent_trace invoked; validReport()'s other SWEPT layers are unsupported.
        const result = reports.validate(validReport(), auditCtx(['agent_trace']))

        expect(result.valid).toBe(false)
    })
})

// =========================================================================
// #93 — the UNCONFIRMED trace-only exemption (path C).
//
// `docs/agent/agent-doctor-instructions.md:48` promises the model an escape
// from the evidence rule — *"name the candidate root cause, name the layer
// that would confirm it, and mark it UNCONFIRMED"* — that the contract never
// honoured. `benchmark/DECISION.md` §K2: on `2026.08.0225` the harness
// produced its first correct seeded diagnosis (seed 03, `rules_in_table: 0`)
// and `_checkEvidenceRule` threw it away, because both citations were
// `source: trace`.
//
// Path C is a THIRD passing route, checked after A and B, so it can only
// widen. What it costs, and why:
//
//   confidence === 'UNCONFIRMED'  the claim is marked as what it is
//   would_confirm names a layer   the missing evidence is named, per line 48
//   that layer is not SWEPT       a sweep claim and a "still needed" claim
//                                 about the same layer contradict; #88 showed
//                                 this model fabricates rather than declines
//   one citation per SWEPT layer  the inconclusive path's pricing, reused
// =========================================================================

/** Layer statuses with `numbers` marked NOT_SWEPT and the rest SWEPT. */
function sweptExcept(numbers) {
    const layers = sweptLayers()
    numbers.forEach((n) => {
        layers[n] = { status: 'NOT_SWEPT', reason: 'not reached before the tool budget ran out' }
    })
    return layers
}

/**
 * A trace-only root cause on path C. Layer 5 is the missing evidence, so
 * layer 5 is NOT_SWEPT and the other six are — hence six citations.
 */
function unconfirmedReport(overrides, causeOverrides) {
    const cause = Object.assign(
        {
            layer: 'layer 1',
            component: 'lookup_routing_rule tool call',
            finding: 'the tool returned 0 rules for the Hardware category',
            evidence: [
                { source: 'trace', detail: "Tool call response: 'rules_in_table': 0" },
                { source: 'trace', detail: 'sn_aia_execution_plan TR1000112 state=Completed' },
                { source: 'trace', detail: 'tool_calls[2].status = ok' },
                { source: 'trace', detail: 'script_errors: none' },
                { source: 'trace', detail: 'header.objective names the Hardware category' },
                { source: 'trace', detail: 'message_stats: 4 messages' },
            ],
            confidence: 'UNCONFIRMED',
            would_confirm: 'layer 5 — query_table against the routing rule table',
        },
        causeOverrides || {}
    )

    return validReport(
        Object.assign(
            {
                layers_swept: sweptExcept([5]),
                root_causes: [cause],
            },
            overrides || {}
        )
    )
}

describe('#93 path C — a trace-only root cause marked UNCONFIRMED', () => {
    test('UNCONFIRMED + would_confirm naming an unswept layer + priced citations → valid', () => {
        expect(load().validate(unconfirmedReport()).valid).toBe(true)
    })

    test('seed 03 regression: the report §K2 records as rejected now validates', () => {
        // The real shape — one tool call, so one layer SWEPT and one citation.
        const report = validReport({
            failure_summary: 'The routing lookup returned no rules, so the agent had nothing to route on.',
            layers_swept: Object.assign(sweptExcept([2, 3, 4, 5, 6, 7]), { 1: { status: 'SWEPT' } }),
            root_causes: [
                {
                    layer: 'layer 1',
                    component: 'lookup_routing_rule',
                    finding: "the tool call returned 0 rules found for the 'Hardware' category",
                    evidence: [{ source: 'trace', detail: "Tool call response: 'rules_in_table': 0" }],
                    confidence: 'UNCONFIRMED',
                    would_confirm: 'layer 5 — query_table against the routing rule table',
                },
            ],
        })

        expect(load().validate(report, auditCtx(['agent_trace'])).valid).toBe(true)
    })

    test('trace-only WITHOUT the confidence marker is still rejected, with the old message', () => {
        const report = unconfirmedReport(undefined, { confidence: 'CONFIRMED' })
        const result = load().validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('evidence rule') !== -1)).toBe(true)
        expect(result.problems.some((p) => p.indexOf('cites only the trace') !== -1)).toBe(true)
    })

    test('an absent confidence field does not open path C', () => {
        const cause = {
            layer: 'layer 1',
            component: 'lookup_routing_rule tool call',
            finding: 'the tool returned 0 rules',
            evidence: [{ source: 'trace', detail: "'rules_in_table': 0" }],
            would_confirm: 'layer 5',
        }
        const report = validReport({ layers_swept: sweptExcept([2, 3, 4, 5, 6, 7]), root_causes: [cause] })

        expect(load().validate(report).valid).toBe(false)
    })

    test('UNCONFIRMED without would_confirm is rejected, and the problem names the field', () => {
        const report = unconfirmedReport(undefined, { would_confirm: undefined })
        const result = load().validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('would_confirm') !== -1)).toBe(true)
    })

    test('a would_confirm that names no layer is rejected, and the problem says how to phrase one', () => {
        const report = unconfirmedReport(undefined, { would_confirm: 'reading the routing table would confirm it' })
        const result = load().validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('would_confirm') !== -1)).toBe(true)
        expect(result.problems.some((p) => p.indexOf('layer 5') !== -1)).toBe(true)
    })

    test('a bare layer number in would_confirm is accepted', () => {
        expect(load().validate(unconfirmedReport(undefined, { would_confirm: '5' })).valid).toBe(true)
    })

    test('digits inside a table name are NOT read as layer numbers', () => {
        // sn_aia_agent_tool_m2m contains a 2; layer 2 is SWEPT here, so a
        // naive digit scan would invent a contradiction.
        const report = unconfirmedReport(undefined, {
            would_confirm: 'layer 5 — query_table against sn_aia_agent_tool_m2m',
        })

        expect(load().validate(report).valid).toBe(true)
    })
})

describe('#93 path C — the sweep cross-check', () => {
    test('naming a layer that is marked SWEPT is a contradiction and is rejected', () => {
        const report = unconfirmedReport({ layers_swept: sweptLayers() })
        const result = load().validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('would_confirm') !== -1 && p.indexOf('SWEPT') !== -1)).toBe(true)
    })

    test('the contradiction problem names the offending layer', () => {
        const report = unconfirmedReport({ layers_swept: sweptLayers() })
        const result = load().validate(report)

        expect(
            result.problems.some((p) => p.indexOf('would_confirm') !== -1 && p.indexOf('layer 5') !== -1)
        ).toBe(true)
    })

    test('EVERY layer named must be unswept — one swept out of two is still a contradiction', () => {
        const report = unconfirmedReport(
            { layers_swept: sweptExcept([5]) },
            { would_confirm: 'layer 4 or layer 5 would settle it' }
        )

        expect(load().validate(report).valid).toBe(false)
    })

    test('two unswept layers named together is fine', () => {
        const report = unconfirmedReport(
            { layers_swept: sweptExcept([4, 5]) },
            { would_confirm: 'layer 4 or layer 5 would settle it' }
        )
        // Five layers SWEPT now, so five citations suffice.
        report.root_causes[0].evidence = report.root_causes[0].evidence.slice(0, 5)

        expect(load().validate(report).valid).toBe(true)
    })

    test('a layer marked UNAVAILABLE is not a contradiction — it was not swept', () => {
        const layers = sweptExcept([5])
        layers[5] = { status: 'UNAVAILABLE', reason: 'query_table is not attached to this agent' }
        const report = unconfirmedReport({ layers_swept: layers })

        expect(load().validate(report).valid).toBe(true)
    })
})

describe('#93 path C — priced like the inconclusive path', () => {
    test('fewer citations than layers marked SWEPT is rejected', () => {
        const report = unconfirmedReport()
        report.root_causes[0].evidence = report.root_causes[0].evidence.slice(0, 3)
        const result = load().validate(report)

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('SWEPT') !== -1)).toBe(true)
    })

    test('the pricing problem tells the model it can mark layers NOT_SWEPT instead', () => {
        const report = unconfirmedReport()
        report.root_causes[0].evidence = report.root_causes[0].evidence.slice(0, 3)
        const result = load().validate(report)

        expect(result.problems.some((p) => p.indexOf('NOT_SWEPT') !== -1)).toBe(true)
    })

    test('marking layers honestly NOT_SWEPT drops the bill — one sweep, one citation', () => {
        const report = unconfirmedReport({
            layers_swept: Object.assign(sweptExcept([2, 3, 4, 5, 6, 7]), { 1: { status: 'SWEPT' } }),
        })
        report.root_causes[0].evidence = report.root_causes[0].evidence.slice(0, 1)

        expect(load().validate(report).valid).toBe(true)
    })
})

describe('#93 path C — monotonicity and containment', () => {
    test('MONOTONICITY: every existing valid report is unaffected', () => {
        expect(load().validate(validReport()).valid).toBe(true)
    })

    test('MONOTONICITY: path A wins first — trace + config passes even when marked UNCONFIRMED', () => {
        const report = validReport({
            root_causes: [
                Object.assign(validReport().root_causes[0], {
                    confidence: 'UNCONFIRMED',
                    // No would_confirm, and every layer is SWEPT: path C would
                    // reject this twice over. Path A must return before it.
                }),
            ],
        })

        expect(load().validate(report).valid).toBe(true)
    })

    test('MONOTONICITY: path B is unaffected — absence diagnosis still passes without a confidence marker', () => {
        const report = absenceReport([
            { source: 'config', detail: 'sn_aia_trigger_configuration.active = false' },
            { source: 'schema', detail: 'active is boolean, default true' },
        ])

        expect(load().validate(report).valid).toBe(true)
    })

    test('the citation cross-check still applies on path C — a trace citation from a run that read no trace fails', () => {
        const report = unconfirmedReport({
            layers_swept: Object.assign(sweptExcept([2, 3, 4, 5, 6, 7]), { 1: { status: 'SWEPT' } }),
        })
        report.root_causes[0].evidence = report.root_causes[0].evidence.slice(0, 1)

        const result = load().validate(report, auditCtx(['schema_lookup']))

        expect(result.valid).toBe(false)
        expect(result.problems.some((p) => p.indexOf('unsupported citation') !== -1)).toBe(true)
    })

    test('path C does not leak into inconclusive.evidence_read — that path is unchanged', () => {
        const report = validReport({
            layers_swept: sweptExcept([2, 3, 4, 5, 6, 7]),
            root_causes: [],
            fixes: [],
            verification: undefined,
            inconclusive: {
                evidence_read: [{ source: 'trace', detail: 'sn_aia_execution_plan: state Completed' }],
                needed_to_conclude: 'a read of the routing table',
            },
        })

        expect(load().validate(report).valid).toBe(true)
    })

    test('an UNCONFIRMED root cause still owes a fix and a verification step', () => {
        const report = unconfirmedReport({ fixes: [] })

        expect(load().validate(report).valid).toBe(false)
    })

    test('would_confirm survives into `normalized` untouched', () => {
        const result = load().validate(unconfirmedReport())

        expect(result.normalized.root_causes[0].would_confirm).toBe(
            'layer 5 — query_table against the routing rule table'
        )
    })

    test('renderMarkdown surfaces would_confirm, so a human sees what is missing', () => {
        const reports = load()
        const normalized = reports.validate(unconfirmedReport()).normalized

        expect(reports.renderMarkdown(normalized)).toEqual(expect.stringContaining('query_table against the routing'))
    })
})

describe('#93 schemaText contract additions', () => {
    test('schemaText documents would_confirm so the model knows the field exists', () => {
        expect(load().schemaText()).toEqual(expect.stringContaining('would_confirm'))
    })

    test('schemaText states the UNCONFIRMED marker by name', () => {
        expect(load().schemaText()).toEqual(expect.stringContaining('UNCONFIRMED'))
    })

    test('schemaText states the sweep cross-check', () => {
        const text = load().schemaText()

        expect(text.indexOf('would_confirm') !== -1 && text.indexOf('SWEPT') !== -1).toBe(true)
    })

    test('schemaText states the citation-per-SWEPT-layer price on the UNCONFIRMED path too', () => {
        const text = load().schemaText()
        const clause = text.split('\n').filter((l) => l.indexOf('would_confirm') !== -1)

        expect(clause.length).toBeGreaterThan(0)
        expect(clause.join(' ')).toEqual(expect.stringContaining('SWEPT'))
    })

    test('schemaText tells the model the exemption does not excuse not looking', () => {
        const text = load().schemaText()
        const clause = text.split('\n').filter((l) => l.indexOf('would_confirm') !== -1)

        expect(clause.join(' ')).toEqual(expect.stringContaining('NOT_SWEPT'))
    })
})

describe('unsweptGaps (#103)', () => {
    function reportWith(layersSwept) {
        return { layers_swept: layersSwept }
    }

    test('a NOT_SWEPT layer becomes a gap carrying its reason and tools', () => {
        const fr = load()
        const gaps = fr.unsweptGaps(
            reportWith({
                1: { status: 'SWEPT' },
                4: { status: 'NOT_SWEPT', reason: 'no schema read was needed' },
            })
        )
        expect(gaps).toEqual([
            { layer: 4, name: 'Data schemas', reason: 'no schema read was needed', tools: ['schema_lookup'] },
        ])
    })

    test('SWEPT and UNAVAILABLE are never gaps', () => {
        const fr = load()
        const gaps = fr.unsweptGaps(
            reportWith({
                1: { status: 'UNAVAILABLE', reason: 'nothing ever ran' },
                2: { status: 'SWEPT' },
                3: { status: 'SWEPT', reason: 'read the tool definitions' },
            })
        )
        expect(gaps).toEqual([])
    })

    test('gaps come back ordered by layer number', () => {
        const fr = load()
        const gaps = fr.unsweptGaps(
            reportWith({
                5: { status: 'NOT_SWEPT', reason: 'r5' },
                2: { status: 'NOT_SWEPT', reason: 'r2' },
            })
        )
        expect(gaps.map((g) => g.layer)).toEqual([2, 5])
    })

    test('every gap carries at least one tool — _layerToolMap must never map a layer to zero tools, or _depthGate would deadlock on an empty release set (I2)', () => {
        const fr = load()
        const gaps = fr.unsweptGaps(
            reportWith({
                1: { status: 'NOT_SWEPT', reason: 'r' },
                2: { status: 'NOT_SWEPT', reason: 'r' },
                3: { status: 'NOT_SWEPT', reason: 'r' },
                4: { status: 'NOT_SWEPT', reason: 'r' },
                5: { status: 'NOT_SWEPT', reason: 'r' },
                6: { status: 'NOT_SWEPT', reason: 'r' },
                7: { status: 'NOT_SWEPT', reason: 'r' },
            })
        )
        expect(gaps).toHaveLength(7)
        gaps.forEach((g) => expect(g.tools.length).toBeGreaterThan(0))
    })

    test('a layer number outside 1-7 is ignored', () => {
        const fr = load()
        const gaps = fr.unsweptGaps(reportWith({ 8: { status: 'NOT_SWEPT', reason: 'r' } }))
        expect(gaps).toEqual([])
    })

    test('a missing reason degrades to an empty string rather than throwing', () => {
        const fr = load()
        const gaps = fr.unsweptGaps(reportWith({ 4: { status: 'NOT_SWEPT' } }))
        expect(gaps).toEqual([{ layer: 4, name: 'Data schemas', reason: '', tools: ['schema_lookup'] }])
    })

    test.each([undefined, null, 'a string', 42, [], {}, { layers_swept: null }, { layers_swept: 'x' }])(
        'malformed input %p returns an empty array',
        (input) => {
            const fr = load()
            expect(fr.unsweptGaps(input)).toEqual([])
        }
    )
})

// ===========================================================================
// directed depth gate (#109) — toolFanOut / declaredLayers
//
// Two thin accessors over `_layerToolMap` and `_layersNamedBy`, added so
// PaAgentLoop can rank gaps by how DEDICATED their tools are without ever
// re-typing the map. Pure: no Glide, no audit query, no validation effect.
// ===========================================================================

describe('directed depth gate (#109) — toolFanOut', () => {
    test('counts the layers each tool can close', () => {
        expect(load().toolFanOut()).toEqual({
            agent_trace: 1,
            genai_log: 2,
            log_analysis: 3,
            agent_config: 3,
            schema_lookup: 1,
            query_table: 1,
        })
    })

    test('every tool named anywhere in the layer map has a fan-out of at least 1', () => {
        const fanOut = load().toolFanOut()
        Object.keys(fanOut).forEach((tool) => {
            expect(fanOut[tool]).toBeGreaterThanOrEqual(1)
        })
    })
})

describe('directed depth gate (#109) — declaredLayers', () => {
    test('reads the layer a root cause names in would_confirm', () => {
        const report = { root_causes: [{ would_confirm: 'layer 4 — the schema of the routing table' }] }
        expect(load().declaredLayers(report)).toEqual([4])
    })

    test('collects across several root causes, de-duplicated and ascending', () => {
        const report = {
            root_causes: [
                { would_confirm: 'layer 5 would settle it' },
                { would_confirm: 'layer 4 as well' },
                { would_confirm: 'layer 5 again' },
            ],
        }
        expect(load().declaredLayers(report)).toEqual([4, 5])
    })

    test('a root cause with no would_confirm contributes nothing', () => {
        const report = { root_causes: [{ layer: 1, finding: 'x' }, { would_confirm: 'layer 6' }] }
        expect(load().declaredLayers(report)).toEqual([6])
    })

    test.each([undefined, null, 42, 'a string', [], { root_causes: 'not an array' }, { root_causes: [null, 7] }])(
        'degrades to [] on malformed input (%p) rather than throwing (R-9)',
        (input) => {
            let out
            expect(() => {
                out = load().declaredLayers(input)
            }).not.toThrow()
            expect(out).toEqual([])
        }
    )

    test('inherits _layersNamedBy: a table name carrying a digit is NOT read as a layer', () => {
        const report = { root_causes: [{ would_confirm: 'check sn_aia_agent_tool_m2m' }] }
        expect(load().declaredLayers(report)).toEqual([])
    })
})

describe('evidenceProblems classification — evidence rule (#81)', () => {
    function baseReport(overrides) {
        const report = {
            failure_summary: 'the agent returned nothing',
            layers_swept: {
                1: { status: 'SWEPT' },
                2: { status: 'NOT_SWEPT', reason: 'not needed' },
                3: { status: 'NOT_SWEPT', reason: 'not needed' },
                4: { status: 'NOT_SWEPT', reason: 'not needed' },
                5: { status: 'NOT_SWEPT', reason: 'not needed' },
                6: { status: 'NOT_SWEPT', reason: 'not needed' },
                7: { status: 'NOT_SWEPT', reason: 'not needed' },
            },
            root_causes: [
                {
                    layer: '1',
                    component: 'x_snc_tsbench_ticket',
                    finding: 'the tool returned no rows',
                    evidence: [{ source: 'trace', detail: 'rows_returned: 0' }],
                },
            ],
            fixes: [
                {
                    target_type: 'data',
                    target: 'x_snc_tsbench_ticket',
                    current: '0 rows',
                    proposed: 'seed the table',
                    rationale: 'the query has nothing to match',
                },
            ],
            verification: 're-run the agent and confirm rows come back',
            data_markers: [],
        }
        return Object.assign(report, overrides || {})
    }

    it('classifies a trace-only evidence rule violation as an evidence problem', () => {
        const fr = load()
        const res = fr.validate(baseReport())

        expect(res.valid).toBe(false)
        expect(res.evidenceProblems.length).toBe(1)
        expect(res.evidenceProblems[0]).toContain('evidence cites only the trace')
        // subset invariant
        expect(res.problems).toEqual(expect.arrayContaining(res.evidenceProblems))
    })

    it('classifies a missing-trace evidence rule violation as an evidence problem', () => {
        const fr = load()
        const res = fr.validate(
            baseReport({
                root_causes: [
                    {
                        layer: '4',
                        component: 'incident.assignment_group',
                        finding: 'the field is missing',
                        evidence: [{ source: 'schema', detail: 'no such column' }],
                    },
                ],
            })
        )

        expect(res.valid).toBe(false)
        expect(res.evidenceProblems.length).toBe(1)
        expect(res.evidenceProblems[0]).toContain('no trace citation found')
    })

    it('classifies the absence-path shortfall as an evidence problem', () => {
        const fr = load()
        const report = baseReport({
            layers_swept: {
                1: { status: 'UNAVAILABLE', reason: 'nothing ever ran' },
                2: { status: 'NOT_SWEPT', reason: 'not needed' },
                3: { status: 'NOT_SWEPT', reason: 'not needed' },
                4: { status: 'NOT_SWEPT', reason: 'not needed' },
                5: { status: 'NOT_SWEPT', reason: 'not needed' },
                6: { status: 'NOT_SWEPT', reason: 'not needed' },
                7: { status: 'NOT_SWEPT', reason: 'not needed' },
            },
            root_causes: [
                {
                    layer: '7',
                    component: 'sn_aia_trigger_configuration',
                    finding: 'the trigger is inactive',
                    evidence: [{ source: 'config', detail: 'active=false' }],
                },
            ],
        })
        const res = fr.validate(report)

        expect(res.valid).toBe(false)
        expect(res.evidenceProblems.length).toBe(1)
        expect(res.evidenceProblems[0]).toContain('TWO DISTINCT sources')
    })

    it('classifies would_confirm shape problems as SHAPE, not evidence', () => {
        const fr = load()
        const res = fr.validate(
            baseReport({
                root_causes: [
                    {
                        layer: '1',
                        component: 'x_snc_tsbench_ticket',
                        finding: 'the tool returned no rows',
                        evidence: [{ source: 'trace', detail: 'rows_returned: 0' }],
                        confidence: 'UNCONFIRMED',
                    },
                ],
            })
        )

        expect(res.valid).toBe(false)
        expect(res.problems.length).toBe(1)
        expect(res.problems[0]).toContain('would_confirm')
        expect(res.evidenceProblems).toEqual([])
    })

    it('classifies the UNCONFIRMED evidence-per-swept-layer shortfall as an evidence problem', () => {
        const fr = load()
        const res = fr.validate(
            baseReport({
                layers_swept: {
                    1: { status: 'SWEPT' },
                    2: { status: 'SWEPT' },
                    3: { status: 'SWEPT' },
                    4: { status: 'NOT_SWEPT', reason: 'not needed' },
                    5: { status: 'NOT_SWEPT', reason: 'not needed' },
                    6: { status: 'NOT_SWEPT', reason: 'not needed' },
                    7: { status: 'NOT_SWEPT', reason: 'not needed' },
                },
                root_causes: [
                    {
                        layer: '1',
                        component: 'x_snc_tsbench_ticket',
                        finding: 'the tool returned no rows',
                        evidence: [{ source: 'trace', detail: 'rows_returned: 0' }],
                        confidence: 'UNCONFIRMED',
                        would_confirm: 'layer 5',
                    },
                ],
            })
        )

        expect(res.valid).toBe(false)
        expect(res.evidenceProblems.length).toBe(1)
        expect(res.evidenceProblems[0]).toContain('at least one piece of evidence per layer')
    })

    it('returns an empty evidenceProblems array for a non-object report (R-9)', () => {
        const fr = load()
        const res = fr.validate(null)

        expect(res.valid).toBe(false)
        expect(res.problems).toEqual(['fix report must be a JSON object'])
        expect(res.evidenceProblems).toEqual([])
    })

    it('returns no evidenceProblems key requirement on a valid report', () => {
        const fr = load()
        const res = fr.validate(
            baseReport({
                root_causes: [
                    {
                        layer: '1',
                        component: 'x_snc_tsbench_ticket',
                        finding: 'the tool returned no rows',
                        evidence: [
                            { source: 'trace', detail: 'rows_returned: 0' },
                            { source: 'data', detail: 'x_snc_tsbench_ticket has 0 rows' },
                        ],
                    },
                ],
            })
        )

        expect(res.valid).toBe(true)
        expect(res.normalized).toBeDefined()
    })
})

describe('evidenceProblems classification — audit-backed checks (#81)', () => {
    const CTX = { auditAvailable: true, invokedTools: ['agent_trace'] }

    it('classifies an unsupported citation as an evidence problem', () => {
        const fr = load()
        const res = fr.validate(
            {
                failure_summary: 'the agent returned nothing',
                layers_swept: {
                    1: { status: 'SWEPT' },
                    2: { status: 'NOT_SWEPT', reason: 'not needed' },
                    3: { status: 'NOT_SWEPT', reason: 'not needed' },
                    4: { status: 'NOT_SWEPT', reason: 'not needed' },
                    5: { status: 'NOT_SWEPT', reason: 'not needed' },
                    6: { status: 'NOT_SWEPT', reason: 'not needed' },
                    7: { status: 'NOT_SWEPT', reason: 'not needed' },
                },
                root_causes: [
                    {
                        layer: '5',
                        component: 'x_snc_tsbench_ticket',
                        finding: 'the table is empty',
                        evidence: [
                            { source: 'trace', detail: 'rows_returned: 0' },
                            { source: 'data', detail: 'x_snc_tsbench_ticket has 0 rows' },
                        ],
                    },
                ],
                fixes: [
                    {
                        target_type: 'data',
                        target: 'x_snc_tsbench_ticket',
                        current: '0 rows',
                        proposed: 'seed the table',
                        rationale: 'the query has nothing to match',
                    },
                ],
                verification: 're-run the agent and confirm rows come back',
                data_markers: [],
            },
            CTX
        )

        expect(res.valid).toBe(false)
        const unsupported = res.evidenceProblems.filter(function (p) {
            return p.indexOf('unsupported citation') !== -1
        })
        expect(unsupported.length).toBe(1)
        expect(res.problems).toEqual(expect.arrayContaining(res.evidenceProblems))
    })

    it('classifies an unsupported sweep claim as an evidence problem', () => {
        const fr = load()
        const res = fr.validate(
            {
                failure_summary: 'the agent returned nothing',
                layers_swept: {
                    1: { status: 'SWEPT' },
                    2: { status: 'NOT_SWEPT', reason: 'not needed' },
                    3: { status: 'NOT_SWEPT', reason: 'not needed' },
                    4: { status: 'SWEPT' },
                    5: { status: 'NOT_SWEPT', reason: 'not needed' },
                    6: { status: 'NOT_SWEPT', reason: 'not needed' },
                    7: { status: 'NOT_SWEPT', reason: 'not needed' },
                },
                root_causes: [
                    {
                        layer: '1',
                        component: 'x_snc_tsbench_ticket',
                        finding: 'the tool returned no rows',
                        evidence: [{ source: 'trace', detail: 'rows_returned: 0' }],
                    },
                ],
                fixes: [
                    {
                        target_type: 'data',
                        target: 'x_snc_tsbench_ticket',
                        current: '0 rows',
                        proposed: 'seed the table',
                        rationale: 'the query has nothing to match',
                    },
                ],
                verification: 're-run the agent and confirm rows come back',
                data_markers: [],
            },
            CTX
        )

        expect(res.valid).toBe(false)
        const sweep = res.evidenceProblems.filter(function (p) {
            return p.indexOf('unsupported sweep claim') !== -1
        })
        expect(sweep.length).toBe(1)
    })

    it('leaves plain shape problems out of evidenceProblems', () => {
        const fr = load()
        const res = fr.validate({ layers_swept: {}, root_causes: [], fixes: [], data_markers: [] }, CTX)

        expect(res.valid).toBe(false)
        expect(res.problems.length).toBeGreaterThan(0)
        expect(res.evidenceProblems).toEqual([])
    })
})
