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
