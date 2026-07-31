/**
 * PaAuditLogger — pure-logic tests (IMPLEMENTATION_PLAN.md Task 5, LLD §4.6).
 *
 * WHAT THESE TESTS ARE FOR
 * The audit logger sits INSIDE the hot path: PaScriptToolAdapter calls it
 * immediately before and immediately after every tool execution (LLD §4.7). So
 * the property that matters most is not what it records — it is that it can
 * never take the tool down with it. Roughly half of what follows is a variation
 * on "this input should have broken it, and the tool still got its answer".
 *
 * The rest is payload discipline: an audit row must not become a second copy of
 * the 35KB payload PaArtifactStore just spent a round trip keeping out of the
 * prompt.
 *
 * WHAT THEY DO NOT SETTLE
 * That a scoped `GlideRecord` insert into `x_snc_troubleshoot_audit` succeeds on
 * the instance (DESIGN.md R-8). That is a gpinst01 check — see issue #20.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeWritableWorld } = require('./_glideStub')

const AUDIT_TABLE = 'x_snc_troubleshoot_audit'
const RUN = 'run00000000000000000000000000000'

function load(opts) {
    const o = opts || {}
    const world = makeWritableWorld(o.world || {})
    const globals = {
        JSON: JSON,
        gs: {
            info: function () {},
            warn: function () {},
            error: function () {},
            debug: function () {},
            getUserID: function () {
                return o.userId === undefined ? 'user1' : o.userId
            },
            getUserName: function () {
                return 'test.user'
            },
            nil: function (v) {
                return v === null || v === undefined || v === ''
            },
        },
    }
    if (!o.noGlide) globals.GlideRecord = world.GlideRecord

    const ctx = loadScriptInclude('PaAuditLogger.js', globals)
    return { logger: new ctx.PaAuditLogger(o.options), world: world, ctx: ctx }
}

/** The exception shape a cross-scope denial throws — hostile to inspection. */
function hostileException() {
    const e = {}
    ;['message', 'name', 'toString'].forEach((prop) => {
        Object.defineProperty(e, prop, {
            get: function () {
                throw new Error('Illegal access to getter method get' + prop)
            },
        })
    })
    return e
}

function rows(world) {
    return world.calls.inserts.map((i) => i.row)
}

// ---------------------------------------------------------------------------
// The three entry points
// ---------------------------------------------------------------------------

describe('logIntent / logResult / logError', () => {
    test('logIntent writes an intent row against the run', () => {
        const { logger, world } = load()
        const res = logger.logIntent({
            runId: RUN,
            toolName: 'agent_trace',
            input: { execution: 'abc' },
        })

        expect(res.logged).toBe(true)
        expect(res.audit_id).toBeTruthy()
        expect(world.calls.inserts[0].table).toBe(AUDIT_TABLE)

        const row = rows(world)[0]
        expect(row.action_type).toBe('intent')
        expect(row.tool_name).toBe('agent_trace')
        expect(row.run).toBe(RUN)
        expect(row.user).toBe('user1')
        expect(JSON.parse(row.input).execution).toBe('abc')
    })

    test('logResult writes a separate result row — the intent row is not overwritten', () => {
        // LLD §3.2 / tables.now.ts: the intent row records what the agent MEANT
        // to do, and it is the only evidence that survives when a tool never
        // returns. Updating it in place would erase exactly that.
        const { logger, world } = load()
        logger.logIntent({ runId: RUN, toolName: 'agent_trace', input: 'x' })
        logger.logResult({ runId: RUN, toolName: 'agent_trace', output: { success: true } })

        const all = rows(world)
        expect(all).toHaveLength(2)
        expect(all[0].action_type).toBe('intent')
        expect(all[1].action_type).toBe('result')
        expect(all[0].sys_id).not.toBe(all[1].sys_id)
    })

    test('logError writes an error row carrying the message in output', () => {
        const { logger, world } = load()
        logger.logError({ runId: RUN, toolName: 'agent_trace', error: 'plan not found' })

        const row = rows(world)[0]
        expect(row.action_type).toBe('error')
        expect(row.output).toContain('plan not found')
    })

    test('an error given as an object is serialised, not stringified to [object Object]', () => {
        const { logger, world } = load()
        logger.logError({
            runId: RUN,
            toolName: 'agent_trace',
            error: { success: false, error: 'denied' },
        })

        expect(rows(world)[0].output).toContain('denied')
        expect(rows(world)[0].output).not.toContain('[object Object]')
    })

    test('target table and record are recorded when the caller knows them', () => {
        const { logger, world } = load()
        logger.logIntent({
            runId: RUN,
            toolName: 'query_table',
            input: '{}',
            targetTable: 'sn_aia_execution_plan',
            targetRecord: 'c9d63a932bda8b9417a6ffbeee91bfd0',
        })

        const row = rows(world)[0]
        expect(row.target_table).toBe('sn_aia_execution_plan')
        expect(row.target_record).toBe('c9d63a932bda8b9417a6ffbeee91bfd0')
    })

    test('confirmed_by_user is written false — Phase 1a is read-only', () => {
        const { logger, world } = load()
        logger.logIntent({ runId: RUN, toolName: 't', input: '{}' })
        expect(rows(world)[0].confirmed_by_user).toBe('false')
    })

    test('an explicitly confirmed action records the confirmation', () => {
        // The column exists now because an audit trail that gains it later
        // cannot answer the question retroactively (tables.now.ts).
        const { logger, world } = load()
        logger.logResult({ runId: RUN, toolName: 't', output: 'ok', confirmedByUser: true })
        expect(rows(world)[0].confirmed_by_user).toBe('true')
    })
})

// ---------------------------------------------------------------------------
// Never throw. This is the property the adapter depends on.
// ---------------------------------------------------------------------------

describe('never throws into the caller', () => {
    test('a throwing insert is contained AND the exception is never touched (R-1)', () => {
        const { logger } = load({ world: { throwOnInsert: hostileException() } })

        let res
        expect(() => {
            res = logger.logIntent({ runId: RUN, toolName: 't', input: '{}' })
        }).not.toThrow()
        expect(res.logged).toBe(false)
        expect(res.degraded).toBe('insert_failed')
    })

    test('a rejected insert reports it rather than claiming success', () => {
        const { logger } = load({ world: { failInsert: true } })
        const res = logger.logIntent({ runId: RUN, toolName: 't', input: '{}' })

        expect(res.logged).toBe(false)
        expect(res.audit_id).toBeNull()
        expect(res.degraded).toBe('insert_failed')
    })

    test('no GlideRecord in the runtime degrades instead of throwing', () => {
        const { logger } = load({ noGlide: true })
        const res = logger.logIntent({ runId: RUN, toolName: 't', input: '{}' })

        expect(res.logged).toBe(false)
        expect(res.degraded).toBe('glide_unavailable')
    })

    test('no params at all is survivable on all three methods', () => {
        const { logger } = load()

        expect(() => logger.logIntent()).not.toThrow()
        expect(() => logger.logResult()).not.toThrow()
        expect(() => logger.logError()).not.toThrow()
    })

    test('null, a string and a number as params are all survivable', () => {
        const { logger } = load()

        expect(logger.logIntent(null).logged).toBeDefined()
        expect(logger.logResult('nonsense').logged).toBeDefined()
        expect(logger.logError(42).logged).toBeDefined()
    })

    test('circular output is recorded as something rather than exploding', () => {
        const { logger, world } = load()
        const circular = { name: 'loop' }
        circular.self = circular

        expect(() => logger.logResult({ runId: RUN, toolName: 't', output: circular })).not.toThrow()
        expect(rows(world)[0].output).toBeTruthy()
    })

    test('an output whose toString throws is still contained (R-1 in spirit)', () => {
        const { logger } = load()
        const nasty = {
            toJSON: function () {
                throw new Error('nope')
            },
            toString: function () {
                throw new Error('also nope')
            },
        }

        expect(() => logger.logResult({ runId: RUN, toolName: 't', output: nasty })).not.toThrow()
    })

    test('a missing run id still writes the row — an orphan audit beats no audit', () => {
        // The run anchor can legitimately be degraded (PaRunAnchor returns a
        // null run_id when the insert was denied). Dropping the audit row too
        // would lose the trail at exactly the moment it is most needed.
        const { logger, world } = load()
        const res = logger.logIntent({ toolName: 'agent_trace', input: '{}' })

        expect(res.logged).toBe(true)
        expect(rows(world)[0].run || '').toBe('')
        expect(res.degraded).toBe('no_run_anchor')
    })
})

// ---------------------------------------------------------------------------
// Payload discipline
// ---------------------------------------------------------------------------

describe('payload digesting', () => {
    const big = 'x'.repeat(12000)

    test('a small payload is recorded verbatim', () => {
        const { logger, world } = load()
        logger.logResult({ runId: RUN, toolName: 't', output: 'small enough' })
        expect(rows(world)[0].output).toBe('small enough')
    })

    test('an oversized payload is digested head+tail with an elision count', () => {
        const { logger, world } = load()
        logger.logResult({ runId: RUN, toolName: 't', output: big })
        const out = rows(world)[0].output

        expect(out.length).toBeLessThan(big.length)
        expect(out).toMatch(/\[elided \d+ chars\]/)
        expect(out.indexOf('x')).toBe(0)
    })

    test('the elision count is exactly what was dropped', () => {
        const { logger, world } = load()
        logger.logResult({ runId: RUN, toolName: 't', output: big })

        const dropped = Number(/\[elided (\d+) chars\]/.exec(rows(world)[0].output)[1])
        const kept = rows(world)[0].output.replace(/\n?…\[elided \d+ chars\]…\n?/, '').length
        expect(kept + dropped).toBe(big.length)
    })

    test('a payload at exactly the ceiling is NOT digested (boundary)', () => {
        const { logger, world } = load({ options: { maxPayloadChars: 100 } })
        logger.logResult({ runId: RUN, toolName: 't', output: 'y'.repeat(100) })

        expect(rows(world)[0].output).toBe('y'.repeat(100))
    })

    test('one char over the ceiling IS digested (boundary)', () => {
        const { logger, world } = load({ options: { maxPayloadChars: 100 } })
        logger.logResult({ runId: RUN, toolName: 't', output: 'y'.repeat(101) })

        expect(rows(world)[0].output).toMatch(/\[elided 1 chars\]/)
    })

    test('the input side is digested on the same rule', () => {
        const { logger, world } = load()
        logger.logIntent({ runId: RUN, toolName: 't', input: big })

        expect(rows(world)[0].input).toMatch(/\[elided \d+ chars\]/)
    })

    test('an already-truncated envelope keeps its artifact_id visible in the digest', () => {
        // PaArtifactStore.applyThreshold runs BEFORE logResult (LLD §4.7), so
        // what arrives here is usually an envelope. The artifact_id is the one
        // field that makes the audit row actionable — it must survive digesting,
        // and it sits near the front of the JSON, which the head+tail split
        // keeps.
        const { logger, world } = load()
        logger.logResult({
            runId: RUN,
            toolName: 'agent_trace',
            output: {
                success: true,
                truncated: true,
                artifact_id: 'attach0000000000000000000000000',
                excerpt: big,
            },
        })

        expect(rows(world)[0].output).toContain('attach0000000000000000000000000')
    })

    test('objects are serialised as JSON, not [object Object]', () => {
        const { logger, world } = load()
        logger.logIntent({ runId: RUN, toolName: 't', input: { agent: 'Doctor', since: 60 } })

        const parsed = JSON.parse(rows(world)[0].input)
        expect(parsed.agent).toBe('Doctor')
        expect(parsed.since).toBe(60)
    })

    test('a bare string input is recorded as itself, not wrapped', () => {
        // §4.7 Note 4: the adapter passes bare strings through unchanged. The
        // audit trail should show what the tool actually received.
        const { logger, world } = load()
        logger.logIntent({ runId: RUN, toolName: 't', input: 'c9d63a932bda8b9417a6ffbeee91bfd0' })

        expect(rows(world)[0].input).toBe('c9d63a932bda8b9417a6ffbeee91bfd0')
    })

    test('null and undefined payloads record as empty, not as the string "null"', () => {
        const { logger, world } = load()
        logger.logIntent({ runId: RUN, toolName: 't', input: null })
        logger.logResult({ runId: RUN, toolName: 't', output: undefined })

        expect(rows(world)[0].input).toBe('')
        expect(rows(world)[1].output).toBe('')
    })
})

// ---------------------------------------------------------------------------
// Field hygiene
// ---------------------------------------------------------------------------

describe('field hygiene', () => {
    test('a missing tool name is recorded as unknown, not left blank', () => {
        // tool_name is the audit table's DISPLAY field (tables.now.ts). A blank
        // one renders every such row as an unnamed entry in every list.
        const { logger, world } = load()
        logger.logIntent({ runId: RUN, input: '{}' })

        expect(rows(world)[0].tool_name).toBe('unknown')
    })

    test('an over-long tool name is trimmed to the column width', () => {
        const { logger, world } = load()
        logger.logIntent({ runId: RUN, toolName: 'n'.repeat(500), input: '{}' })

        expect(rows(world)[0].tool_name.length).toBeLessThanOrEqual(100)
    })

    test('an over-long target table is trimmed to the column width', () => {
        const { logger, world } = load()
        logger.logIntent({ runId: RUN, toolName: 't', targetTable: 'z'.repeat(200) })

        expect(rows(world)[0].target_table.length).toBeLessThanOrEqual(80)
    })

    test('a JSON-string params object keeps its payload, not just its fields', () => {
        // Regression: params were parsed for the FIELDS but the payload was
        // picked off the raw string argument, so a JSON-string call wrote a row
        // with a correct tool name and a silently empty input — a blank that
        // reads as "the agent sent nothing" (R-6).
        const { logger, world } = load()
        logger.logIntent(JSON.stringify({ runId: RUN, toolName: 'agent_trace', input: 'payload' }))

        const row = rows(world)[0]
        expect(row.tool_name).toBe('agent_trace')
        expect(row.input).toBe('payload')
    })

    test('caller aliases are accepted — run/runId and tool/toolName', () => {
        // Task 9 writes the adapter that calls this. A key mismatch between the
        // two would surface as a blank column, not an error (R-6).
        const { logger, world } = load()
        logger.logIntent({ run: RUN, tool: 'agent_trace', input: '{}' })

        expect(rows(world)[0].run).toBe(RUN)
        expect(rows(world)[0].tool_name).toBe('agent_trace')
    })

    test('the literal string "undefined" as a run id is treated as no run (LLD §4)', () => {
        const { logger, world } = load()
        const res = logger.logIntent({ runId: 'undefined', toolName: 't' })

        expect(rows(world)[0].run || '').toBe('')
        expect(res.degraded).toBe('no_run_anchor')
    })

    test('a missing user id is left blank rather than written as "null"', () => {
        const { logger, world } = load({ userId: null })
        logger.logIntent({ runId: RUN, toolName: 't' })

        expect(rows(world)[0].user || '').toBe('')
    })
})
