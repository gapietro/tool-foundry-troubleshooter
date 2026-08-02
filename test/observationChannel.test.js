/**
 * The observation channel, end to end (issue #72).
 *
 * WHAT THIS TEST IS FOR
 * PaAgentLoop's own suite fakes PaRunManager with a double that does NOT
 * digest (test/PaAgentLoop.test.js:57-75), so it would pass whether or not
 * the model can actually see its own evidence. This file wires the REAL
 * PaAgentLoop to the REAL PaRunManager over the writable-world _glideStub
 * and asserts the one property that matters: a tool payload larger than the
 * 200-char transcript digest survives into the SECOND reasoning prompt.
 *
 * If this test ever goes back to failing, the custom harness is starving its
 * own model again and any benchmark score it produces is measuring that,
 * not diagnostic ability.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeWritableWorld } = require('./_glideStub')

const RUN_TABLE = 'x_snc_troubleshoot_run'

function seedRun() {
    return { sys_id: 'run1', harness: 'custom', status: 'queued', number: 'TR0001042', transcript: '' }
}

test('a >200-char tool result survives into the SECOND reasoning prompt', () => {
    const world = makeWritableWorld({ rows: { [RUN_TABLE]: [seedRun()] } })

    const runCtx = loadScriptInclude('PaRunManager.js', { JSON: JSON, GlideRecord: world.GlideRecord })
    const runs = new runCtx.PaRunManager({})

    // Big enough to be crushed by the 200-char digest, small enough that the
    // 4,000-char prompt ceiling carries it whole — so "did it survive" is a
    // clean yes/no rather than a question about where truncation landed.
    const PAYLOAD = 'EVIDENCE-MARKER-' + 'y'.repeat(3000)

    const prompts = []
    let turn = 0
    const llm = {
        reason: function (prompt) {
            prompts.push(prompt)
            turn += 1
            if (turn === 1) {
                return {
                    success: true,
                    raw: '{"action":"tool_call"}',
                    action: { action: 'tool_call', tool: 'read_artifact', args: { artifact_id: 'a1' } },
                }
            }
            return { success: true, raw: '{"action":"answer"}', action: { action: 'answer', text: 'done' } }
        },
    }

    const tools = {
        promptBlock: function () {
            return 'TOOLBLOCK'
        },
        dispatch: function () {
            return { success: true, data: { content: PAYLOAD } }
        },
    }

    const reports = {
        schemaText: function () {
            return 'SCHEMA'
        },
    }

    const loopCtx = loadScriptInclude('PaAgentLoop.js', { JSON: JSON })
    const loop = new loopCtx.PaAgentLoop({
        llmProxy: llm,
        toolRegistry: tools,
        runManager: runs,
        fixReport: reports,
        playbook: 'PLAYBOOK',
        now: function () {
            return 0
        },
    })

    const res = loop.run('run1', { execution: 'plan1' })

    expect(res.outcome).toBe('answer')
    expect(prompts).toHaveLength(2)

    // THE ASSERTION THIS FILE EXISTS FOR.
    expect(prompts[1]).toContain(PAYLOAD)

    // ...and the first prompt could not have contained it — nothing had been
    // dispatched yet — so this is genuinely the observation path, not an
    // artifact of the payload leaking in through the request or the playbook.
    expect(prompts[0]).not.toContain(PAYLOAD)

    // The UI/audit rendering is untouched: result_digest is still 200-capped.
    const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
    const toolEntry = stored.filter((e) => e.actor === 'tool')[0]
    expect(toolEntry.result_digest.length).toBeLessThan(300)
    expect(toolEntry.result_digest).toContain('more chars]')
    expect(toolEntry.prompt_digest.length).toBeGreaterThan(3000)
})

test('the same payload is NOT visible when prompt_digest is absent — proving the assertion above has teeth', () => {
    // Same wiring, but PROMPT_WINDOW 0 so nothing retains a prompt_digest.
    // This guards against the first test passing for an unrelated reason
    // (e.g. the payload arriving through some other prompt section).
    const world = makeWritableWorld({ rows: { [RUN_TABLE]: [seedRun()] } })
    const runCtx = loadScriptInclude('PaRunManager.js', { JSON: JSON, GlideRecord: world.GlideRecord })
    const runs = new runCtx.PaRunManager({})
    runs.PROMPT_WINDOW = 0

    const PAYLOAD = 'EVIDENCE-MARKER-' + 'y'.repeat(3000)
    const prompts = []
    let turn = 0
    const llm = {
        reason: function (prompt) {
            prompts.push(prompt)
            turn += 1
            if (turn === 1) {
                return { success: true, raw: 'x', action: { action: 'tool_call', tool: 'read_artifact', args: {} } }
            }
            return { success: true, raw: 'x', action: { action: 'answer', text: 'done' } }
        },
    }
    const tools = {
        promptBlock: function () {
            return 'TOOLBLOCK'
        },
        dispatch: function () {
            return { success: true, data: { content: PAYLOAD } }
        },
    }

    const loopCtx = loadScriptInclude('PaAgentLoop.js', { JSON: JSON })
    const loop = new loopCtx.PaAgentLoop({
        llmProxy: llm,
        toolRegistry: tools,
        runManager: runs,
        fixReport: { schemaText: function () { return 'SCHEMA' } },
        playbook: 'PLAYBOOK',
        now: function () {
            return 0
        },
    })

    loop.run('run1', { execution: 'plan1' })

    expect(prompts[1]).not.toContain(PAYLOAD)
})

test('a REALISTIC envelope-shaped dispatch result (JSON-escaped, quote- and newline-dense) survives whole into the second prompt', () => {
    // CRITICAL 1b (final review). The two tests above stub `dispatch` to
    // return a bare `{success, data:{content}}` object whose `content` is
    // plain text with no characters JSON needs to escape. That is NOT what
    // `PaAgentLoop._dispatchTool` actually digests — it digests
    // `this._toText(result)`, the JSON-STRINGIFIED ENVELOPE
    // (`{success, data:{content, offset, next_offset, total, has_more}}`),
    // and JSON escaping (`"` -> `\"`, newline -> `\n`) plus the envelope's
    // own ~200 chars of keys can expand a page well past its raw length —
    // measured up to 2.01x in the pathological all-quotes case. A test that
    // never constructs that shape can't catch a ceiling sized against the
    // wrong string, which is exactly how PROMPT_DIGEST_CHARS = 4000 shipped
    // looking safe. This test pins the real shape.
    const world = makeWritableWorld({ rows: { [RUN_TABLE]: [seedRun()] } })

    const runCtx = loadScriptInclude('PaRunManager.js', { JSON: JSON, GlideRecord: world.GlideRecord })
    const runs = new runCtx.PaRunManager({})

    // A full MAX_PAGE_CHARS (4,000-char) page, built from a chunk that mixes
    // double-quotes AND newlines throughout (so JSON escaping actually
    // expands it, not just a token here or there), ending in a unique tail
    // marker so "did the WHOLE page arrive, including the end" is a precise,
    // checkable claim rather than "did some prefix arrive."
    const TAIL_MARKER = 'TAIL-MARKER-END-OF-PAGE-93a1'
    const CHUNK = 'log line with "quoted value" and\nan embedded newline here\n'
    let PAGE = ''
    while (PAGE.length < 4000 - TAIL_MARKER.length) PAGE += CHUNK
    PAGE = PAGE.slice(0, 4000 - TAIL_MARKER.length) + TAIL_MARKER
    expect(PAGE.length).toBe(4000)
    expect(PAGE).toContain('"')
    expect(PAGE).toContain('\n')

    const prompts = []
    let turn = 0
    const llm = {
        reason: function (prompt) {
            prompts.push(prompt)
            turn += 1
            if (turn === 1) {
                return {
                    success: true,
                    raw: '{"action":"tool_call"}',
                    action: { action: 'tool_call', tool: 'read_artifact', args: { artifact_id: 'a1' } },
                }
            }
            return { success: true, raw: '{"action":"answer"}', action: { action: 'answer', text: 'done' } }
        },
    }

    const tools = {
        promptBlock: function () {
            return 'TOOLBLOCK'
        },
        // THE REALISTIC SHAPE: the full envelope PaToolRegistry.dispatch()
        // actually returns, not a bare {success, data:{content}}. next_offset
        // deliberately precedes content in this literal — same key order the
        // real envelope uses — since that ordering is exactly why a cut that
        // dropped the content tail would still leave next_offset intact and
        // undetectable by the model.
        dispatch: function () {
            return {
                success: true,
                data: {
                    offset: 0,
                    next_offset: 4000,
                    total: 8000,
                    has_more: true,
                    content: PAGE,
                },
            }
        },
    }

    // What actually reaches PaRunManager as `result_digest` is
    // `PaAgentLoop._toText(result)` — the JSON-STRINGIFIED ENVELOPE, quotes
    // and newlines escaped. That escaped string, not the raw PAGE, is what
    // must survive whole into the second prompt.
    const EXPECTED_ENVELOPE_JSON = JSON.stringify({
        success: true,
        data: { offset: 0, next_offset: 4000, total: 8000, has_more: true, content: PAGE },
    })
    expect(EXPECTED_ENVELOPE_JSON.length).toBeGreaterThan(200)
    expect(EXPECTED_ENVELOPE_JSON.length).toBeLessThan(8500)

    const reports = {
        schemaText: function () {
            return 'SCHEMA'
        },
    }

    const loopCtx = loadScriptInclude('PaAgentLoop.js', { JSON: JSON })
    const loop = new loopCtx.PaAgentLoop({
        llmProxy: llm,
        toolRegistry: tools,
        runManager: runs,
        fixReport: reports,
        playbook: 'PLAYBOOK',
        now: function () {
            return 0
        },
    })

    const res = loop.run('run1', { execution: 'plan1' })

    expect(res.outcome).toBe('answer')
    expect(prompts).toHaveLength(2)

    // THE ASSERTION THIS TEST EXISTS FOR: the ENTIRE JSON-escaped envelope —
    // including the page's own final characters — reaches the second prompt,
    // not merely a prefix. A test that only checked the head would have
    // passed under the very defect this pins against (the old 4,000-char
    // ceiling measured against the escaped envelope, not the bare page,
    // could silently drop exactly this tail).
    expect(prompts[1]).toContain(EXPECTED_ENVELOPE_JSON)
    expect(prompts[1]).toContain(TAIL_MARKER)
    expect(prompts[1].indexOf(TAIL_MARKER)).toBeGreaterThan(-1)

    // And the UI/audit rendering is still 200-capped, per the design's
    // dual-threshold contract.
    const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
    const toolEntry = stored.filter((e) => e.actor === 'tool')[0]
    expect(toolEntry.result_digest.length).toBeLessThan(300)
    expect(toolEntry.prompt_digest).toBe(EXPECTED_ENVELOPE_JSON)
})
