/**
 * PaRunManager — pure-logic tests (Phase 1b Task 5, LLD §3.1/§4.6,
 * DECISION.md §D5, DESIGN.md R-20).
 *
 * WHAT THESE TESTS ARE FOR
 * The custom harness's own lifecycle: create → queued/custom, transcript
 * append + summarization threshold, legal/illegal close transitions, the
 * Evidence Bundle (NO LLM in the call path), and the §D5 stale-native sweep
 * (native-only, `running`-only so `awaiting_confirmation` never expires, and
 * the exact R-20 citation on every row it closes).
 *
 * `PaRunAnchor.getOrCreate` is ALWAYS a test double here, never the real
 * class — this suite is not re-testing PaRunAnchor's key-resolution/ownership
 * logic (PaRunAnchor.test.js already owns that). What PaRunManager does with
 * whatever the anchor hands back — forcing `status:'queued'` on a fresh
 * custom run, manufacturing a single-use identity so two `createRun` calls
 * never converge on one row — is what this file settles.
 *
 * The GlideRecord side of every other method (`appendTranscript`, `close`,
 * `sweepStaleNative`, `collectBundle`'s run-context read) runs against the
 * REAL writable-world `_glideStub`, the same "does this code run" floor
 * DESIGN.md R-8 sets for every other component in this app.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeWritableWorld } = require('./_glideStub')

const RUN_TABLE = 'x_snc_troubleshoot_run'
const AUDIT_TABLE = 'x_snc_troubleshoot_audit'

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function fakeAnchor(result) {
    const calls = []
    return {
        calls: calls,
        getOrCreate: function (ctx) {
            calls.push(ctx)
            return result
        },
    }
}

function fakeLlm(responses) {
    const calls = []
    let i = 0
    return {
        calls: calls,
        summarize: function (prompt) {
            calls.push(prompt)
            const r = responses[i]
            i += 1
            return r === undefined ? { success: true, text: 'summary' } : r
        },
    }
}

function fakeRegistry(resultsByName) {
    const calls = []
    const results = resultsByName || {}
    return {
        calls: calls,
        dispatch: function (name, args, runCtx) {
            calls.push({ name: name, args: args, runCtx: runCtx })
            const r = results[name]
            return r === undefined ? { success: true, data: {} } : r
        },
    }
}

/**
 * @param {Object} [opts]
 *   world       makeWritableWorld options ({rows, failInsert, throwOnUpdate, ...})
 *   runAnchor / llmProxy / toolRegistry   collaborator overrides (omit for
 *               "not in the object graph" — see the structural bundle test)
 *   now         PaRunManager's clock seam
 *   noGlide     leave GlideRecord undefined, as a runtime without it would
 */
function load(opts) {
    const o = opts || {}
    const world = makeWritableWorld(o.world || {})
    const globals = { JSON: JSON }
    if (!o.noGlide) globals.GlideRecord = world.GlideRecord

    const ctx = loadScriptInclude('PaRunManager.js', globals)
    const mgr = new ctx.PaRunManager({
        runAnchor: o.runAnchor,
        llmProxy: o.llmProxy,
        toolRegistry: o.toolRegistry,
        now: o.now,
        maxAgeHours: o.maxAgeHours,
    })
    return { mgr: mgr, world: world, ctx: ctx }
}

function seedRun(overrides) {
    return Object.assign(
        { sys_id: 'run1', harness: 'custom', status: 'queued', number: 'TR0001042' },
        overrides
    )
}

// ===========================================================================
// createRun
// ===========================================================================

describe('createRun', () => {
    test('returns {run_id, number} and forces status to queued, regardless of what the anchor inserted', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: 'TR0001042' })
        const { mgr, world } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] } },
        })

        const res = mgr.createRun({ agent: 'Agent Doctor', executionRef: 'plan1', mode: 'diagnose' })

        expect(res).toEqual({ run_id: 'run1', number: 'TR0001042' })
        expect(world.tables[RUN_TABLE][0].status).toBe('queued')
    })

    test('passes harness:custom to the anchor', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: '' })
        const { mgr } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.createRun({})
        expect(anchor.calls[0].harness).toBe('custom')
    })

    test('passes executionRef/agent through, and mode', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: '' })
        const { mgr } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.createRun({ executionRef: 'plan1', agent: 'agentX', mode: 'collect' })

        expect(anchor.calls[0].executionRef).toBe('plan1')
        expect(anchor.calls[0].agentId).toBe('agentX')
        expect(anchor.calls[0].mode).toBe('collect')
    })

    test('omits executionRef/agent from the anchor call when not supplied (R-9)', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: '' })
        const { mgr } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.createRun({})

        expect(anchor.calls[0].executionRef).toBeUndefined()
        expect(anchor.calls[0].agentId).toBeUndefined()
    })

    test('manufactures a FRESH conversationId every call, so two runs never converge on one anchor', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: '' })
        const { mgr } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.createRun({ executionRef: 'plan1' })
        mgr.createRun({ executionRef: 'plan1' })

        expect(anchor.calls[0].conversationId).toBeTruthy()
        expect(anchor.calls[1].conversationId).toBeTruthy()
        expect(anchor.calls[0].conversationId).not.toBe(anchor.calls[1].conversationId)
    })

    test('the `user` param is never forwarded as anchor identity — it is server-authoritative there', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: '' })
        const { mgr } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.createRun({ user: 'someone.else' })

        expect(anchor.calls[0].user).toBeUndefined()
        expect(anchor.calls[0].userId).toBeUndefined()
    })

    test('a degraded anchor is reported, not papered over', () => {
        const anchor = fakeAnchor({ run_id: null, degraded: 'insert_failed' })
        const { mgr } = load({ runAnchor: anchor })

        const res = mgr.createRun({})

        expect(res.run_id).toBeNull()
        expect(res.degraded).toBe('insert_failed')
    })

    test('no run id at all from the anchor is reported the same way', () => {
        const anchor = fakeAnchor(null)
        const { mgr } = load({ runAnchor: anchor })

        const res = mgr.createRun({})

        expect(res.run_id).toBeNull()
        expect(res.degraded).toBeTruthy()
    })

    test('a run_id is still returned when forcing status:queued fails, with a note rather than a silent claim', () => {
        // Review minor: createRun used to ignore the creation write's result
        // entirely — a failed status write was indistinguishable from a
        // successful one from the caller's side, which is the same
        // "status contradicts what actually happened" shape R-19b forbids
        // elsewhere in this file. The row is still real and usable (the
        // anchor DID insert it), so this must not be reported as `degraded`
        // — only flagged.
        const anchor = fakeAnchor({ run_id: 'run1', number: 'TR0001042' })
        const { mgr } = load({
            runAnchor: anchor,
            world: {
                rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] },
                failUpdate: true,
            },
        })

        const res = mgr.createRun({})

        expect(res.run_id).toBe('run1')
        expect(res.number).toBe('TR0001042')
        expect(res.note).toEqual(expect.stringContaining('could not be forced to queued'))
    })
})

// ===========================================================================
// createRun — request persistence (#99)
// ===========================================================================

describe('createRun — request persistence', () => {
    function createWith(request) {
        const anchor = fakeAnchor({ run_id: 'run1', number: 'TR0001042' })
        const { mgr, world } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] } },
        })
        const res = mgr.createRun({ request: request })
        return { res: res, row: world.tables[RUN_TABLE][0], mgr: mgr }
    }

    test('an object body is stored as JSON, verbatim, and not marked truncated', () => {
        const body = { execution: 'plan1', mode: 'diagnose' }
        const { row } = createWith(body)

        expect(JSON.parse(row.request)).toEqual(body)
        // This asserts the STUB's coercion, not the platform's: `_glideStub`'s
        // `setValue` renders whatever it is handed through `String(value)`, so
        // it would read 'false' here even if `_requestFields` still returned a
        // JS boolean — this test alone cannot distinguish the two. The
        // platform's own `getValue` on a real boolean column returns '0'/'1',
        // a THIRD shape distinct from both the JS boolean and this stub's
        // string. `_requestFields` writes the string form 'true'/'false' on
        // purpose (matching `PaAuditLogger`'s precedent, not this stub's
        // behaviour — see that method's own doc comment), and
        // `PaRestHandlers._toBool` on the read side accepts boolean `true`,
        // `'1'`, and `'true'` alike, so it covers the real platform shape and
        // the string-literal shape both without needing to special-case '0'.
        expect(row.request_truncated).toBe('false')
    })

    test('a string body is stored as-is, without a second round of JSON quoting', () => {
        const { row } = createWith('why did the agent stop')

        expect(row.request).toBe('why did the agent stop')
        // String-form assertion — see the coercion note in the test above.
        expect(row.request_truncated).toBe('false')
    })

    test('the request lands in the SAME update that forces status:queued — one write, not two', () => {
        const { row } = createWith({ execution: 'plan1' })

        expect(row.status).toBe('queued')
        expect(row.request).toBeTruthy()
    })

    test('an oversize body is clipped at REQUEST_CHARS AND flagged — never silently', () => {
        const { row, mgr } = createWith({ logs: new Array(80000).join('x') })

        expect(row.request.length).toBe(mgr.REQUEST_CHARS)
        // String-form assertion — see the coercion note earlier in this block.
        expect(row.request_truncated).toBe('true')
    })

    test('a body of exactly REQUEST_CHARS is not marked truncated (boundary)', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: 'TR0001042' })
        const { mgr, world } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] } },
        })
        const exact = new Array(mgr.REQUEST_CHARS + 1).join('y')

        mgr.createRun({ request: exact })

        expect(world.tables[RUN_TABLE][0].request.length).toBe(mgr.REQUEST_CHARS)
        // String-form assertion — see the coercion note earlier in this block.
        expect(world.tables[RUN_TABLE][0].request_truncated).toBe('false')
    })

    test('a clip landing mid-emoji drops the orphaned half rather than storing a lone surrogate (#106)', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: 'TR0001042' })
        const { mgr, world } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] } },
        })
        // REQUEST_CHARS - 1 units of filler, then a two-unit astral character:
        // the naive substring(0, REQUEST_CHARS) keeps its high surrogate and
        // leaves the low one behind. A lone surrogate is not valid UTF-16 and
        // can break JSON encoding of GET /runs/{run_id} and XML export.
        const emoji = '😀'
        const straddling = new Array(mgr.REQUEST_CHARS).join('x') + emoji

        mgr.createRun({ request: straddling })

        const stored = world.tables[RUN_TABLE][0].request
        const lastCode = stored.charCodeAt(stored.length - 1)
        expect(lastCode >= 0xd800 && lastCode <= 0xdbff).toBe(false)
        expect(stored.length).toBe(mgr.REQUEST_CHARS - 1)
        // Still a clip, and still says so.
        expect(world.tables[RUN_TABLE][0].request_truncated).toBe('true')
    })

    test('a clip landing just PAST an emoji keeps the whole pair — the guard trims only orphans (#106)', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: 'TR0001042' })
        const { mgr, world } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] } },
        })
        // The pair ends exactly ON the boundary, so both halves are inside the
        // clip and nothing should be dropped.
        const emoji = '😀'
        const aligned = new Array(mgr.REQUEST_CHARS - 1).join('x') + emoji + 'zzz'

        mgr.createRun({ request: aligned })

        const stored = world.tables[RUN_TABLE][0].request
        expect(stored.length).toBe(mgr.REQUEST_CHARS)
        expect(stored.slice(-2)).toBe(emoji)
    })

    test('a body that will not serialize is recorded ABSENT, not partial — the two states stay distinct', () => {
        const circular = { execution: 'plan1' }
        circular.self = circular

        const { row } = createWith(circular)

        // Unwritten-in-the-stub and empty-on-the-platform are the same state:
        // a fresh ServiceNow column reads as '' (string) / false (boolean,
        // read back as 'false') whether or not anything ever wrote to it, so
        // `_requestFields` treats an unserializable body the same as no
        // request at all — neither column gets written here. "the two states
        // stay distinct" (this test's name) refers to absent vs truncated,
        // not absent vs untouched.
        expect(row.request).toBeFalsy()
        expect(row.request_truncated).toBeFalsy()
    })

    test('no request param leaves both fields untouched (R-9)', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: 'TR0001042' })
        const { mgr, world } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] } },
        })

        const res = mgr.createRun({ executionRef: 'plan1' })

        expect(res).toEqual({ run_id: 'run1', number: 'TR0001042' })
        expect(world.tables[RUN_TABLE][0].request).toBeUndefined()
    })

    test('the anchor call is unchanged — request is never forwarded as anchor identity', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: '' })
        const { mgr } = load({
            runAnchor: anchor,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.createRun({ executionRef: 'plan1', request: { execution: 'plan1' } })

        expect(anchor.calls[0].request).toBeUndefined()
        expect(anchor.calls[0].executionRef).toBe('plan1')
    })

    test('a failed write says the request was lost too, not only the status', () => {
        const anchor = fakeAnchor({ run_id: 'run1', number: 'TR0001042' })
        const { mgr } = load({
            runAnchor: anchor,
            world: {
                rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] },
                failUpdate: true,
            },
        })

        const res = mgr.createRun({ request: { execution: 'plan1' } })

        expect(res.run_id).toBe('run1')
        expect(res.note).toEqual(expect.stringContaining('could not be forced to queued'))
        expect(res.note).toEqual(expect.stringContaining('request'))
    })
})

// ===========================================================================
// appendTranscript
// ===========================================================================

describe('appendTranscript', () => {
    test('run not found returns success:false, never throws', () => {
        const { mgr } = load({})
        expect(() => mgr.appendTranscript('nope', { actor: 'llm' })).not.toThrow()
        expect(mgr.appendTranscript('nope', { actor: 'llm' })).toEqual({
            success: false,
            error: expect.stringContaining('not found'),
        })
    })

    test('appends a normalized entry and auto-assigns seq from the current length', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ transcript: '' })] } } })

        const res = mgr.appendTranscript('run1', { actor: 'tool', tool: 'agent_trace', result_digest: 'ok' })

        expect(res.success).toBe(true)
        expect(res.entry.seq).toBe(1)
        expect(res.entry.actor).toBe('tool')
        expect(res.entry.tool).toBe('agent_trace')
        expect(res.count).toBe(1)

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored).toHaveLength(1)
        expect(stored[0].tool).toBe('agent_trace')
    })

    test('writes AFTER EVERY call — the transcript grows by exactly one entry each time', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'llm' })
        mgr.appendTranscript('run1', { actor: 'tool' })
        mgr.appendTranscript('run1', { actor: 'system' })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored).toHaveLength(3)
        expect(stored.map((e) => e.seq)).toEqual([1, 2, 3])
    })

    test('an unrecognised or absent actor falls back to system', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'hacker' })
        mgr.appendTranscript('run1', {})

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].actor).toBe('system')
        expect(stored[1].actor).toBe('system')
    })

    test('args_digest/result_digest are digested to the 200-char ceiling', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })
        const long = 'x'.repeat(500)

        mgr.appendTranscript('run1', { actor: 'tool', args_digest: long, result_digest: long })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].args_digest.length).toBeLessThan(250)
        expect(stored[0].args_digest).toContain('...[+')
        expect(stored[0].result_digest.length).toBeLessThan(250)
    })

    test('a short digest passes through unchanged (idempotent, not padded or altered)', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'tool', args_digest: 'short' })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].args_digest).toBe('short')
    })

    test('artifact_id is carried through untouched when present', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'tool', artifact_id: 'art1' })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].artifact_id).toBe('art1')
    })

    test('ts defaults to something non-empty when the caller does not supply one', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'llm' })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(typeof stored[0].ts).toBe('string')
        expect(stored[0].ts.length).toBeGreaterThan(0)
    })

    test('a caller-supplied ts is honored verbatim', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'llm', ts: '2026-08-02 12:00:00' })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].ts).toBe('2026-08-02 12:00:00')
    })

    test('a corrupted transcript field is treated as empty rather than crashing the append', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ transcript: '{not json' })] } } })

        expect(() => mgr.appendTranscript('run1', { actor: 'llm' })).not.toThrow()
        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored).toHaveLength(1)
    })
})

// ===========================================================================
// prompt_digest — the prompt-facing observation channel (issue #72)
// ===========================================================================

describe('prompt_digest', () => {
    test('a long TOOL result gets a prompt_digest at the 8500-char ceiling, while result_digest stays at 200', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })
        const long = 'z'.repeat(10000)

        mgr.appendTranscript('run1', { actor: 'tool', tool: 'read_artifact', result_digest: long })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].result_digest).toContain('...[+9800 more chars]')
        expect(stored[0].result_digest.length).toBeLessThan(300)
        expect(stored[0].prompt_digest).toContain('...[+1500 more chars]')
        expect(stored[0].prompt_digest.substring(0, 8500)).toBe('z'.repeat(8500))
    })

    test('a result that already fits inside 200 chars gets NO prompt_digest — it would only duplicate result_digest', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'tool', tool: 'agent_trace', result_digest: 'short result' })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].result_digest).toBe('short result')
        expect(stored[0].prompt_digest).toBeUndefined()
    })

    test('llm and system entries never get a prompt_digest, however long they are', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })
        const long = 'z'.repeat(5000)

        mgr.appendTranscript('run1', { actor: 'llm', result_digest: long })
        mgr.appendTranscript('run1', { actor: 'system', result_digest: long })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].prompt_digest).toBeUndefined()
        expect(stored[1].prompt_digest).toBeUndefined()
    })

    test('args_digest never gets the larger ceiling — only results are the observation channel', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })
        const long = 'z'.repeat(5000)

        mgr.appendTranscript('run1', { actor: 'tool', args_digest: long, result_digest: 'short' })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].args_digest.length).toBeLessThan(300)
        expect(stored[0].prompt_digest).toBeUndefined()
    })

    test('a caller-supplied prompt_digest is IGNORED — the field is derived, never accepted', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })

        mgr.appendTranscript('run1', { actor: 'tool', result_digest: 'short', prompt_digest: 'x'.repeat(50000) })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].prompt_digest).toBeUndefined()
    })

    test('only the newest PROMPT_WINDOW carriers keep prompt_digest — older ones are pruned on append', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })
        const long = 'z'.repeat(5000)

        for (let i = 0; i < 5; i++) {
            mgr.appendTranscript('run1', { actor: 'tool', tool: 't' + i, result_digest: long })
        }

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        const carriers = stored.filter((e) => e.prompt_digest !== undefined).map((e) => e.tool)
        expect(carriers).toEqual(['t2', 't3', 't4'])
        // every entry keeps its 200-char result_digest regardless — the UI/audit path is untouched
        expect(stored.filter((e) => typeof e.result_digest === 'string')).toHaveLength(5)
    })

    test('short results do not consume a window slot', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })
        const long = 'z'.repeat(5000)

        mgr.appendTranscript('run1', { actor: 'tool', tool: 'big1', result_digest: long })
        mgr.appendTranscript('run1', { actor: 'tool', tool: 'small1', result_digest: 'tiny' })
        mgr.appendTranscript('run1', { actor: 'tool', tool: 'small2', result_digest: 'tiny' })
        mgr.appendTranscript('run1', { actor: 'tool', tool: 'big2', result_digest: long })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        const carriers = stored.filter((e) => e.prompt_digest !== undefined).map((e) => e.tool)
        expect(carriers).toEqual(['big1', 'big2'])
    })

    test('T6 row-size bound: a worst-case 15-iteration transcript stays far under the 65536-char column ceiling', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })
        const hugeResult = 'z'.repeat(20000)
        const hugeArgs = 'a'.repeat(20000)

        // MAX_ITERATIONS is 15 and each iteration appends at most two entries
        // (llm + tool). Every result is oversized, so this is the worst case
        // the loop can produce, not a typical one.
        for (let i = 0; i < 15; i++) {
            mgr.appendTranscript('run1', { actor: 'llm', result_digest: hugeResult })
            mgr.appendTranscript('run1', { actor: 'tool', tool: 't' + i, args_digest: hugeArgs, result_digest: hugeResult })
        }

        const raw = world.tables[RUN_TABLE][0].transcript
        const stored = JSON.parse(raw)

        expect(stored).toHaveLength(30)
        expect(stored.filter((e) => e.prompt_digest !== undefined)).toHaveLength(3)
        // Re-derived for PROMPT_DIGEST_CHARS = 8,500 (final review, issue #72
        // critical-1): design spec §4.4 now projects ~38,300 worst case
        // (baseline ~12,800 + window 3 x 8,500 = 25,500); measured here at
        // 38,340. 40,000 keeps that measured number under the assertion with
        // headroom; 65,536 is the hard column ceiling (tables.now.ts:201-204)
        // — roughly 1.7x above the measured worst case, not the 2x the old
        // 4,000-char ceiling gave, but still comfortable. If this ever
        // regresses above 40,000, raise the threshold to a value with clear
        // headroom under 65,536 and report the new measured number — do not
        // silently loosen it.
        expect(raw.length).toBeLessThan(40000)
    })
})

// ===========================================================================
// loadContext
// ===========================================================================

describe('loadContext', () => {
    test('returns the parsed transcript and the context_summary', () => {
        const transcript = JSON.stringify([{ seq: 1, actor: 'llm' }])
        const { mgr } = load({
            world: { rows: { [RUN_TABLE]: [seedRun({ transcript: transcript, context_summary: 'so far...' })] } },
        })

        const ctx = mgr.loadContext('run1')

        expect(ctx.transcript).toEqual([{ seq: 1, actor: 'llm' }])
        expect(ctx.context_summary).toBe('so far...')
    })

    test('a missing run degrades to empty rather than throwing', () => {
        const { mgr } = load({})
        expect(mgr.loadContext('nope')).toEqual({ transcript: [], context_summary: '' })
    })
})

// ===========================================================================
// maybeSummarize
// ===========================================================================

function entriesOf(n, withArtifacts) {
    const out = []
    for (let i = 1; i <= n; i++) {
        const e = { seq: i, actor: 'tool', tool: 'agent_trace', result_digest: 'r' + i }
        if (withArtifacts && i <= 3) e.artifact_id = 'artifact-' + i
        out.push(e)
    }
    return out
}

describe('maybeSummarize', () => {
    test('at or below the 10-entry threshold, nothing happens and summarize is never called', () => {
        const llm = fakeLlm([])
        const transcript = JSON.stringify(entriesOf(10))
        const { mgr } = load({
            llmProxy: llm,
            world: { rows: { [RUN_TABLE]: [seedRun({ transcript: transcript })] } },
        })

        const res = mgr.maybeSummarize('run1')

        expect(res.summarized).toBe(false)
        expect(llm.calls).toHaveLength(0)
    })

    test('11 entries: summarizes the 6 oldest, keeps the newest 5 verbatim, sets context_summary', () => {
        const llm = fakeLlm([{ success: true, text: 'compact summary' }])
        const transcript = JSON.stringify(entriesOf(11, true))
        const { mgr, world } = load({
            llmProxy: llm,
            world: { rows: { [RUN_TABLE]: [seedRun({ transcript: transcript })] } },
        })

        const res = mgr.maybeSummarize('run1')

        expect(res.summarized).toBe(true)
        expect(res.summarized_count).toBe(6)
        expect(res.kept_count).toBe(5)
        expect(llm.calls).toHaveLength(1)

        const row = world.tables[RUN_TABLE][0]
        expect(row.context_summary).toBe('compact summary')

        const remaining = JSON.parse(row.transcript)
        expect(remaining).toHaveLength(5)
        expect(remaining.map((e) => e.seq)).toEqual([7, 8, 9, 10, 11])
    })

    test('artifact ids from the summarized (oldest) entries are present in the summary input verbatim', () => {
        const llm = fakeLlm([{ success: true, text: 'summary' }])
        const transcript = JSON.stringify(entriesOf(11, true)) // artifacts on seq 1-3, all in the oldest 6
        const { mgr } = load({
            llmProxy: llm,
            world: { rows: { [RUN_TABLE]: [seedRun({ transcript: transcript })] } },
        })

        mgr.maybeSummarize('run1')

        const prompt = llm.calls[0]
        expect(prompt).toContain('artifact-1')
        expect(prompt).toContain('artifact-2')
        expect(prompt).toContain('artifact-3')
    })

    test('an existing context_summary is folded into the summarize prompt', () => {
        const llm = fakeLlm([{ success: true, text: 'new summary' }])
        const transcript = JSON.stringify(entriesOf(11))
        const { mgr } = load({
            llmProxy: llm,
            world: {
                rows: { [RUN_TABLE]: [seedRun({ transcript: transcript, context_summary: 'PRIOR_SUMMARY_MARKER' })] },
            },
        })

        mgr.maybeSummarize('run1')

        expect(llm.calls[0]).toContain('PRIOR_SUMMARY_MARKER')
    })

    test('summarize FAILURE leaves the transcript untouched and does not fail the run', () => {
        const llm = fakeLlm([{ success: false, error: 'llm down' }])
        const transcript = JSON.stringify(entriesOf(11))
        const { mgr, world } = load({
            llmProxy: llm,
            world: { rows: { [RUN_TABLE]: [seedRun({ transcript: transcript, status: 'running' })] } },
        })

        const res = mgr.maybeSummarize('run1')

        expect(res.summarized).toBe(false)
        expect(res.reason).toEqual(expect.stringContaining('llm down'))

        const row = world.tables[RUN_TABLE][0]
        expect(JSON.parse(row.transcript)).toHaveLength(11) // untouched
        expect(row.status).toBe('running') // NOT failed — summarization is an optimization
        expect(world.calls.updates).toHaveLength(0)
    })

    test('a missing run degrades cleanly rather than throwing', () => {
        const llm = fakeLlm([])
        const { mgr } = load({ llmProxy: llm })
        expect(() => mgr.maybeSummarize('nope')).not.toThrow()
        expect(mgr.maybeSummarize('nope').summarized).toBe(false)
    })
})

// ===========================================================================
// close — legal and illegal transitions
// ===========================================================================

describe('close', () => {
    const legal = [
        ['queued', 'complete'],
        ['queued', 'failed'],
        ['running', 'complete'],
        ['running', 'failed'],
    ]
    test.each(legal)('%s -> %s is legal', (from, to) => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ status: from })] } } })
        const res = mgr.close('run1', to, {})

        expect(res).toEqual({ success: true, run_id: 'run1', status: to })
        expect(world.tables[RUN_TABLE][0].status).toBe(to)
    })

    const illegal = [
        ['awaiting_confirmation', 'complete'],
        ['awaiting_confirmation', 'failed'],
        ['complete', 'complete'],
        ['complete', 'failed'],
        ['failed', 'complete'],
        ['queued', 'queued'],
        ['queued', 'running'],
        ['queued', 'awaiting_confirmation'],
        ['running', 'awaiting_confirmation'],
    ]
    test.each(illegal)('%s -> %s is illegal: returns {success:false} naming the transition, never throws', (from, to) => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ status: from })] } } })

        let res
        expect(() => {
            res = mgr.close('run1', to, {})
        }).not.toThrow()

        expect(res.success).toBe(false)
        expect(res.error).toContain(from)
        expect(res.error).toContain(to)
        // The row must not have been touched by a refused transition.
        expect(world.tables[RUN_TABLE][0].status).toBe(from)
    })

    test('stamps fix_report and error on a successful close', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] } } })

        mgr.close('run1', 'failed', { fixReport: { failure_summary: 'x' }, error: 'boom' })

        const row = world.tables[RUN_TABLE][0]
        expect(JSON.parse(row.fix_report)).toEqual({ failure_summary: 'x' })
        expect(row.error).toBe('boom')
    })

    test('run not found returns {success:false} rather than throwing', () => {
        const { mgr } = load({})
        expect(() => mgr.close('nope', 'complete', {})).not.toThrow()
        expect(mgr.close('nope', 'complete', {}).success).toBe(false)
    })

    test('a throwing update is contained without touching the exception (R-1)', () => {
        const hostile = {}
        Object.defineProperty(hostile, 'message', {
            get: function () {
                throw new Error('Illegal access to getter method getMessage')
            },
        })

        const { mgr } = load({
            world: { rows: { [RUN_TABLE]: [seedRun({ status: 'running' })] }, throwOnUpdate: hostile },
        })

        let res
        expect(() => {
            res = mgr.close('run1', 'complete', {})
        }).not.toThrow()
        expect(res.success).toBe(false)
    })
})

// ===========================================================================
// collectBundle — the Evidence Bundle, NO LLM anywhere in the call path
// ===========================================================================

describe('collectBundle', () => {
    test('dispatches exactly once per collection tool', () => {
        const registry = fakeRegistry({})
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        mgr.collectBundle('run1')

        const names = registry.calls.map((c) => c.name).sort()
        expect(names).toEqual(['agent_config', 'agent_trace', 'genai_log', 'query_table', 'schema_lookup'])
    })

    test('organizes the result into layers 1-7, fanning agent_config across 2/3/7', () => {
        const registry = fakeRegistry({
            agent_trace: { success: true, data: { plan: 'header' } },
            agent_config: {
                success: true,
                data: { instructions: { text: 'do X' }, tools: [{ name: 't1' }], triggers: [{ name: 'tr1' }] },
            },
            schema_lookup: { success: true, data: { columns: [] } },
            query_table: { success: true, data: { rows: [] } },
            genai_log: { success: true, data: { calls: [] } },
        })
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')

        expect(res.success).toBe(true)
        const layers = res.data.layers
        expect(Object.keys(layers).map(Number).sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
        expect(layers[1].tool).toBe('agent_trace')
        expect(layers[1].data).toEqual({ plan: 'header' })
        expect(layers[2].name).toBe('Instructions')
        expect(layers[2].data).toEqual({ text: 'do X' })
        expect(layers[3].name).toBe('Tool definitions')
        expect(layers[3].data).toEqual([{ name: 't1' }])
        expect(layers[7].name).toBe('Trigger and wiring')
        expect(layers[7].data).toEqual([{ name: 'tr1' }])
        expect(layers[4].tool).toBe('schema_lookup')
        expect(layers[5].tool).toBe('query_table')
        expect(layers[6].tool).toBe('genai_log')
    })

    test('a DENIED read inside a tool result is reported as DENIED on the layer, not silently ok', () => {
        const registry = fakeRegistry({
            agent_trace: { success: true, data: { reads: { sn_aia_execution_plan: 'DENIED' } } },
        })
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')
        expect(res.data.layers[1].status).toBe('DENIED')
    })

    test('a tool that fails outright is reported, not ok', () => {
        const registry = fakeRegistry({
            genai_log: { success: false, error: 'boom' },
        })
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')
        expect(res.data.layers[6].status).toBe('error')
    })

    test('a healthy read is reported ok', () => {
        const registry = fakeRegistry({
            schema_lookup: { success: true, data: { reads: { sys_dictionary: 'ok' } } },
        })
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')
        expect(res.data.layers[4].status).toBe('ok')
    })

    test('works with NO LLM PROXY in the object graph at all — the LLM-free floor is structural', () => {
        // Deliberately no `llmProxy` option — PaRunManager must never touch
        // `this._llm()` anywhere inside collectBundle's call path.
        const registry = fakeRegistry({})
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')

        expect(res.success).toBe(true)
        expect(Object.keys(res.data.layers)).toHaveLength(7)
    })

    test('passes the run row execution_ref/agent through as dispatch args when present', () => {
        const registry = fakeRegistry({})
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun({ execution_ref: 'plan1', agent: 'agentX' })] } },
        })

        mgr.collectBundle('run1')

        const traceCall = registry.calls.filter((c) => c.name === 'agent_trace')[0]
        expect(traceCall.args.execution).toBe('plan1')
        expect(traceCall.args.agent).toBe('agentX')
        expect(traceCall.runCtx.run_id).toBe('run1')
    })

    test('a run with no execution_ref/agent still runs the bundle with empty args (R-9)', () => {
        const registry = fakeRegistry({})
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        expect(() => mgr.collectBundle('run1')).not.toThrow()
        const traceCall = registry.calls.filter((c) => c.name === 'agent_trace')[0]
        expect(traceCall.args.execution).toBeUndefined()
    })

    // -----------------------------------------------------------------------
    // Truncated-envelope handling (review fix round, issue #64/#65) — a
    // truncated PaToolRegistry.dispatch result (PaArtifactStore.applyThreshold)
    // has NO `.data` key at all: {success, truncated:true, tool, total_length,
    // artifact_id, page_size, pages, excerpt, note}. Before this fix, reading
    // `result.data` off it was `undefined`, and every pick() silently returned
    // null — indistinguishable from "genuinely nothing here" even though the
    // real content exists, paged, behind `artifact_id`. Live-caught on
    // gpinst01, Task 7 Step 4: `mode:"collect"` against a real execution
    // returned `data: null` for layers 1/2/3/6/7.
    // -----------------------------------------------------------------------

    test('a truncated dispatch result carries the artifact reference as the layer data, not null', () => {
        const registry = fakeRegistry({
            agent_trace: {
                success: true,
                truncated: true,
                tool: 'agent_trace',
                total_length: 5874,
                artifact_id: 'art1',
                page_size: 4000,
                pages: 2,
                excerpt: '{"success":true,"data":{"tool":"...',
            },
        })
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')

        expect(res.data.layers[1].data).toEqual({
            truncated: true,
            artifact_id: 'art1',
            excerpt: '{"success":true,"data":{"tool":"...',
            total_length: 5874,
            page_size: 4000,
            pages: 2,
        })
        // The layer is not reported null/absent — status still reflects the
        // underlying dispatch's own success.
        expect(res.data.layers[1].status).toBe('ok')
    })

    test('a truncated agent_config result hands the SAME artifact reference to layers 2, 3 and 7', () => {
        const registry = fakeRegistry({
            agent_config: {
                success: true,
                truncated: true,
                tool: 'agent_config',
                total_length: 12790,
                artifact_id: 'art2',
                page_size: 4000,
                pages: 4,
                excerpt: '{"success":true,"data":{"reads":...',
            },
        })
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')
        const layers = res.data.layers

        for (const n of [2, 3, 7]) {
            expect(layers[n].data).toEqual({
                truncated: true,
                artifact_id: 'art2',
                excerpt: '{"success":true,"data":{"reads":...',
                total_length: 12790,
                page_size: 4000,
                pages: 4,
            })
        }
        // Each fanned layer still carries its own identity — a consumer can
        // tell which of the three it is looking at.
        expect(layers[2].name).toBe('Instructions')
        expect(layers[3].name).toBe('Tool definitions')
        expect(layers[7].name).toBe('Trigger and wiring')
    })

    test('an untruncated result is unaffected — pick() still runs against .data as before', () => {
        const registry = fakeRegistry({
            agent_trace: { success: true, data: { plan: 'header' } },
        })
        const { mgr } = load({
            toolRegistry: registry,
            world: { rows: { [RUN_TABLE]: [seedRun()] } },
        })

        const res = mgr.collectBundle('run1')
        expect(res.data.layers[1].data).toEqual({ plan: 'header' })
    })

    test('an UNKNOWN run id still runs the bundle — no run to read context from is not an error', () => {
        // No rows seeded at all: `_readRunContext` can't find 'ghost' and
        // degrades to empty context, same as any other absent-run read in
        // this class (R-9). The bundle itself is still worth collecting —
        // it doesn't depend on the run row existing, only on the registry.
        const registry = fakeRegistry({})
        const { mgr } = load({ toolRegistry: registry, world: {} })

        let res
        expect(() => {
            res = mgr.collectBundle('ghost')
        }).not.toThrow()

        expect(res.success).toBe(true)
        expect(Object.keys(res.data.layers)).toHaveLength(7)

        const names = registry.calls.map((c) => c.name).sort()
        expect(names).toEqual(['agent_config', 'agent_trace', 'genai_log', 'query_table', 'schema_lookup'])
        registry.calls.forEach((c) => {
            expect(c.runCtx.run_id).toBe('ghost')
            expect(c.args.execution).toBeUndefined()
            expect(c.args.agent).toBeUndefined()
        })
    })
})

// ===========================================================================
// sweepStaleNative — the §D5 close-out
// ===========================================================================

describe('sweepStaleNative', () => {
    const NOW = new Date('2026-08-02T12:00:00Z')
    function now() {
        return NOW
    }

    test('closes a native running run older than maxAgeHours with no audit rows at all', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({
                            sys_id: 'stale1',
                            harness: 'native',
                            status: 'running',
                            sys_created_on: '2026-07-31 00:00:00', // 36h old
                        }),
                    ],
                },
            },
        })

        const res = mgr.sweepStaleNative({ maxAgeHours: 24 })

        expect(res.closed).toEqual(['stale1'])
        expect(world.tables[RUN_TABLE][0].status).toBe('complete')
    })

    test('appends the EXACT R-20 citation transcript entry on every run it closes', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'stale1', harness: 'native', status: 'running', sys_created_on: '2026-07-31 00:00:00' }),
                    ],
                },
            },
        })

        mgr.sweepStaleNative({ maxAgeHours: 24 })

        const transcript = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        const systemEntry = transcript.filter((e) => e.actor === 'system')[0]
        expect(systemEntry.result_digest).toBe(
            'stale-closed by lifecycle sweep; completeness remains audit-derived (R-20)'
        )
    })

    test('does NOT close a native run that has a RECENT audit row, even if the run itself is old', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'active1', harness: 'native', status: 'running', sys_created_on: '2026-07-31 00:00:00' }),
                    ],
                    [AUDIT_TABLE]: [{ sys_id: 'aud1', run: 'active1', sys_created_on: '2026-08-02 10:00:00' }],
                },
            },
        })

        const res = mgr.sweepStaleNative({ maxAgeHours: 24 })

        expect(res.closed).toEqual([])
        expect(world.tables[RUN_TABLE][0].status).toBe('running')
    })

    test('DOES close a native run whose only audit rows are also stale', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'stale2', harness: 'native', status: 'running', sys_created_on: '2026-07-30 00:00:00' }),
                    ],
                    [AUDIT_TABLE]: [{ sys_id: 'aud1', run: 'stale2', sys_created_on: '2026-07-30 01:00:00' }],
                },
            },
        })

        const res = mgr.sweepStaleNative({ maxAgeHours: 24 })
        expect(res.closed).toEqual(['stale2'])
    })

    test('does not close a run younger than maxAgeHours', () => {
        const { mgr } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'young1', harness: 'native', status: 'running', sys_created_on: '2026-08-02 00:00:00' }),
                    ],
                },
            },
        })

        expect(mgr.sweepStaleNative({ maxAgeHours: 24 }).closed).toEqual([])
    })

    test('never closes a CUSTOM harness run, however old and idle', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'custom1', harness: 'custom', status: 'running', sys_created_on: '2026-07-01 00:00:00' }),
                    ],
                },
            },
        })

        expect(mgr.sweepStaleNative({ maxAgeHours: 24 }).closed).toEqual([])
        expect(world.tables[RUN_TABLE][0].status).toBe('running')
    })

    test('never closes an awaiting_confirmation run — it never expires and is not closeable by the sweep', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({
                            sys_id: 'wait1',
                            harness: 'native',
                            status: 'awaiting_confirmation',
                            sys_created_on: '2026-01-01 00:00:00', // very old
                        }),
                    ],
                },
            },
        })

        expect(mgr.sweepStaleNative({ maxAgeHours: 24 }).closed).toEqual([])
        expect(world.tables[RUN_TABLE][0].status).toBe('awaiting_confirmation')
    })

    test('never closes a run that is already complete or failed', () => {
        const { mgr } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'done1', harness: 'native', status: 'complete', sys_created_on: '2026-01-01 00:00:00' }),
                        seedRun({ sys_id: 'done2', harness: 'native', status: 'failed', sys_created_on: '2026-01-01 00:00:00' }),
                    ],
                },
            },
        })

        expect(mgr.sweepStaleNative({ maxAgeHours: 24 }).closed).toEqual([])
    })

    test('defaults maxAgeHours to 24 when not supplied', () => {
        const { mgr } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        // 25h old — stale under the 24h default
                        seedRun({ sys_id: 'stale3', harness: 'native', status: 'running', sys_created_on: '2026-08-01 11:00:00' }),
                    ],
                },
            },
        })

        expect(mgr.sweepStaleNative({}).closed).toEqual(['stale3'])
    })

    test('closes multiple eligible runs in one pass', () => {
        const { mgr } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'stale4', harness: 'native', status: 'running', sys_created_on: '2026-07-01 00:00:00' }),
                        seedRun({ sys_id: 'stale5', harness: 'native', status: 'running', sys_created_on: '2026-07-01 00:00:00' }),
                    ],
                },
            },
        })

        expect(mgr.sweepStaleNative({ maxAgeHours: 24 }).closed.sort()).toEqual(['stale4', 'stale5'])
    })

    test('no GlideRecord in the runtime degrades to an empty sweep instead of throwing', () => {
        const { mgr } = load({ noGlide: true, now: now })
        expect(() => mgr.sweepStaleNative({})).not.toThrow()
        expect(mgr.sweepStaleNative({})).toEqual({ closed: [] })
    })

    // -----------------------------------------------------------------------
    // Regression (review finding): a failed close() must never leave the
    // R-20 note behind. `close()` and `appendTranscript` write different
    // fields (`status` vs `transcript`), so a scenario where ONE of the two
    // updates fails and the other succeeds needs a PER-CALL failure hook —
    // the global `failUpdate`/`throwOnUpdate` flags fail every update() in
    // the world and cannot isolate just the close's status write.
    // -----------------------------------------------------------------------

    test('REGRESSION: a failed close() never leaves the stale-closed note in the transcript', () => {
        const { mgr, world } = load({
            now: now,
            world: {
                rows: {
                    [RUN_TABLE]: [
                        seedRun({ sys_id: 'stale6', harness: 'native', status: 'running', sys_created_on: '2026-07-01 00:00:00' }),
                    ],
                },
                // Fail ONLY the update that sets `status` — i.e. close()'s
                // write — never the transcript-only update appendTranscript
                // makes on its own. Under the pre-fix ordering (note first,
                // unconditionally, THEN close) this reproduces exactly what
                // the review found: the note lands even though the row's
                // status is untouched. Under the fix (close first, note only
                // on success) the note must never be written here.
                failUpdateIf: (table, row, pending) =>
                    table === RUN_TABLE && Object.prototype.hasOwnProperty.call(pending, 'status'),
            },
        })

        const res = mgr.sweepStaleNative({ maxAgeHours: 24 })

        expect(res.closed).toEqual([])
        expect(world.tables[RUN_TABLE][0].status).toBe('running')

        const transcript = JSON.parse(world.tables[RUN_TABLE][0].transcript || '[]')
        expect(transcript.filter((e) => e.actor === 'system')).toHaveLength(0)
    })
})

// ===========================================================================
// markRunning — issue #73
//
// `createRun` forces every run to 'queued' and NOTHING ever moved a custom
// run off it, so `PaRestHandlers._checkStuckRuns` — which queries
// `harness=custom^status=running` — could never match. Measured on gpinst01
// 2026-08-12 across 214 custom runs: complete 159, failed 54, queued 1,
// running ZERO. The one mechanism designed to spot a dead worker was dead
// code, and the single stuck 'queued' run was invisible to it.
//
// `close()` cannot do this job: 'queued' -> 'running' is in its ILLEGAL list
// by design, because close() is the terminal transition and widening it would
// let a worker "close" a run into a non-terminal state.
// ===========================================================================

describe('markRunning', () => {
    test('queued -> running is written', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ status: 'queued' })] } } })
        const res = mgr.markRunning('run1')

        expect(res.success).toBe(true)
        expect(res.status).toBe('running')
        expect(world.tables[RUN_TABLE][0].status).toBe('running')
    })

    test('a missing run id is refused', () => {
        const { mgr } = load({ world: { rows: { [RUN_TABLE]: [] } } })
        expect(mgr.markRunning('').success).toBe(false)
    })

    test('an unknown run is refused', () => {
        const { mgr } = load({ world: { rows: { [RUN_TABLE]: [] } } })
        const res = mgr.markRunning('nope')
        expect(res.success).toBe(false)
        expect(res.error).toMatch(/run not found/)
    })

    const illegalSources = ['running', 'complete', 'failed', 'awaiting_confirmation']
    test.each(illegalSources)('%s -> running is refused and leaves the row untouched', (from) => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ status: from })] } } })
        const res = mgr.markRunning('run1')

        expect(res.success).toBe(false)
        expect(res.error).toMatch(/illegal transition/)
        expect(world.tables[RUN_TABLE][0].status).toBe(from)
    })

    test('close() still accepts running as a source, so the new state is terminal-reachable', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun({ status: 'queued' })] } } })
        mgr.markRunning('run1')
        const res = mgr.close('run1', 'complete', {})

        expect(res.success).toBe(true)
        expect(world.tables[RUN_TABLE][0].status).toBe('complete')
    })
})
