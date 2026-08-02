/**
 * Pins the ScriptAction body in src/fluent/async-wiring.now.ts — the code
 * that drives the async ReAct worker off `x_snc_troubleshoot.run.start`
 * (Phase 1b Task 7). Nothing else in this repo exercises this script: it
 * lives inside a Fluent `script`...`` tagged template, so `now-sdk build`
 * never runs it, and no other test file reaches into it. That is exactly why
 * a regression here (issue: `String(event.parm1)`/`String(event.parm2)`
 * turning a missing event parm into the literal string `"null"` instead of
 * failing fast / falling back to `{}`) was reviewable only by eye.
 *
 * WHY EXTRACT FROM THE .now.ts SOURCE INSTEAD OF RE-IMPLEMENTING THE LOGIC
 * The whole point is to pin what actually ships. Re-typing the script's logic
 * into this test file would drift from `async-wiring.now.ts` silently and
 * could not have caught the regression this file exists to guard against.
 * The extraction relies on the script body containing no backtick (Build
 * Rule #43 already forbids that for an unrelated reason, so this is safe).
 */

const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { loadScriptInclude } = require('./_loadScriptInclude')

function extractScriptActionBody() {
    const abs = path.resolve(__dirname, '..', 'src', 'fluent', 'async-wiring.now.ts')
    const src = fs.readFileSync(abs, 'utf8')
    const match = src.match(/script:\s*script`([\s\S]*?)`,/)
    if (!match) {
        throw new Error('Could not find the ScriptAction `script` template in async-wiring.now.ts — did it move or get renamed?')
    }
    return match[1]
}

/**
 * Runs the extracted ScriptAction body in a fresh vm context with a fake
 * `event` (the ScriptAction global) and a fake `PaAgentLoop` that just
 * records what it was called with, mirroring how the real class is a bare
 * global inside a ScriptAction (INLINE, not Now.include'd — see the file
 * header of async-wiring.now.ts).
 */
function runScriptAction(parm1, parm2) {
    const calls = []
    const FakePaAgentLoop = function () {}
    FakePaAgentLoop.prototype.run = function (runId, requestJson) {
        calls.push({ runId: runId, requestJson: requestJson })
        return { success: true, outcome: 'answer' }
    }

    const sandbox = {
        event: { parm1: parm1, parm2: parm2 },
        PaAgentLoop: FakePaAgentLoop,
    }
    vm.createContext(sandbox)
    vm.runInContext(extractScriptActionBody(), sandbox, { filename: 'async-wiring-script-action.js' })

    return calls
}

describe('async-wiring.now.ts ScriptAction body (run.start worker)', () => {
    test('a normal {parm1, parm2} pair passes both through to run() correctly', () => {
        const calls = runScriptAction('run-abc-123', '{"execution":"plan1"}')

        expect(calls).toHaveLength(1)
        expect(calls[0].runId).toBe('run-abc-123')
        expect(calls[0].requestJson).toBe('{"execution":"plan1"}')
    })

    test('a null parm1 reaches run() as something the real _str() guard will reject — never the string "null"', () => {
        const calls = runScriptAction(null, '{}')

        expect(calls).toHaveLength(1)
        expect(calls[0].runId).not.toBe('null')

        // Prove this against the REAL guard, not a re-implementation of it:
        // PaAgentLoop.run() computes `var rid = this._str(runId); if (!rid) return {...}`.
        const loopCtx = loadScriptInclude('PaAgentLoop.js', { JSON: JSON })
        const loop = new loopCtx.PaAgentLoop({})
        expect(loop._str(calls[0].runId)).toBe('')
    })

    test('an undefined parm1 reaches run() as something the real _str() guard will reject — never the string "undefined"', () => {
        const calls = runScriptAction(undefined, '{}')

        expect(calls).toHaveLength(1)
        expect(calls[0].runId).not.toBe('undefined')

        const loopCtx = loadScriptInclude('PaAgentLoop.js', { JSON: JSON })
        const loop = new loopCtx.PaAgentLoop({})
        expect(loop._str(calls[0].runId)).toBe('')
    })

    test('a null parm2 arrives at run() as empty string, never the string "null"', () => {
        const calls = runScriptAction('run-1', null)

        expect(calls).toHaveLength(1)
        expect(calls[0].requestJson).toBe('')
        expect(calls[0].requestJson).not.toBe('null')
    })

    test('an undefined parm2 arrives at run() as empty string, never the string "undefined"', () => {
        const calls = runScriptAction('run-1', undefined)

        expect(calls).toHaveLength(1)
        expect(calls[0].requestJson).toBe('')
        expect(calls[0].requestJson).not.toBe('undefined')
    })

    test('an empty-string parm2 normalizes to {} via the real _normRequest, not a fabricated description', () => {
        const calls = runScriptAction('run-1', null)

        const loopCtx = loadScriptInclude('PaAgentLoop.js', { JSON: JSON })
        const loop = new loopCtx.PaAgentLoop({})
        expect(loop._normRequest(calls[0].requestJson)).toEqual({})
    })
})
