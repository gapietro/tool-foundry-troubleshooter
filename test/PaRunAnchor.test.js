/**
 * PaRunAnchor — pure-logic tests (IMPLEMENTATION_PLAN.md Task 5, LLD §4.6).
 *
 * WHAT THESE TESTS ARE FOR
 * Key resolution. Which key wins, what happens when there is none, whether two
 * calls of one conversation land on ONE run record, and whether a concurrent
 * batch converges instead of splitting. That is decision logic, and decision
 * logic is what a unit test can settle.
 *
 * WHAT THEY DO NOT SETTLE
 * That `_agentic_context_` exists on the Now Assist panel path, or carries the
 * fields R-2 observed via the API path, or that a scoped `GlideRecord` insert
 * into `x_snc_troubleshoot_run` succeeds. Per DESIGN.md R-8 a stub is not
 * evidence about platform behaviour in either direction, and R-2 itself is
 * explicitly API-path-provisional. Those are gpinst01 checks — see issue #20.
 *
 * THE RULING THIS SUITE EXISTS TO PROTECT
 * R-2 removed time-window keying from the design ENTIRELY — not "discouraged",
 * deleted, so it cannot be reached by accident. Two benchmark runs sharing one
 * anchor lets run 2 read run 1's artifacts and destroys the blind-run
 * independence the doubled-run protocol exists to measure (DESIGN.md §2.4). The
 * `no key` block below is the guard on that: an anchor with nothing to key on
 * must isolate, never merge.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeWritableWorld } = require('./_glideStub')

const RUN_TABLE = 'x_snc_troubleshoot_run'

/**
 * A 32-char HEX sys_id, deterministic per seed. Hex is not decoration: the
 * `agent` column is a real cross-scope reference into `sn_aia_agent`, and the
 * guard that keeps a name out of it checks for sys_id shape — so a fixture that
 * merely looked like an id would test a weaker guard than the one shipped.
 */
function sysId(seed) {
    let hex = ''
    for (let i = 0; i < seed.length; i++) hex += seed.charCodeAt(i).toString(16)
    return (hex + '00000000000000000000000000000000').substring(0, 32)
}

const CONV = sysId('conv')
const PLAN = sysId('plan')
const AGENT = sysId('agent')

/**
 * @param {Object} [opts]
 *   world      makeWritableWorld options
 *   context    the `_agentic_context_` global — pass a string to test the real
 *              JSON-string shape, an object, or omit for "not present"
 *   noGlide    leave GlideRecord undefined, as a runtime without it would
 */
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
    if (o.context !== undefined) globals._agentic_context_ = o.context

    const ctx = loadScriptInclude('PaRunAnchor.js', globals)
    return { anchor: new ctx.PaRunAnchor(), world: world, ctx: ctx }
}

/** The `_agentic_context_` payload R-2 observed, as the JSON STRING it really is. */
function nativeContext(overrides) {
    const base = {
        agent_id: AGENT,
        conversation_id: CONV,
        usecase_id: sysId('uc'),
        execution_plan_id: PLAN,
    }
    Object.keys(overrides || {}).forEach((k) => {
        base[k] = overrides[k]
    })
    return JSON.stringify(base)
}

// ---------------------------------------------------------------------------
// readNativeContext — R-2's undocumented global, handled defensively
// ---------------------------------------------------------------------------

describe('readNativeContext', () => {
    test('parses the JSON STRING shape R-2 observed', () => {
        const { anchor } = load({ context: nativeContext() })
        const ctx = anchor.readNativeContext()

        expect(ctx.conversation_id).toBe(CONV)
        expect(ctx.execution_plan_id).toBe(PLAN)
        expect(ctx.agent_id).toBe(AGENT)
        expect(ctx.present).toBe(true)
    })

    test('an already-parsed object is accepted too', () => {
        const { anchor } = load({ context: JSON.parse(nativeContext()) })
        expect(anchor.readNativeContext().conversation_id).toBe(CONV)
    })

    test('the global being absent is not a fault — it is the ordinary custom-harness case', () => {
        const { anchor } = load({})
        const ctx = anchor.readNativeContext()

        expect(ctx.present).toBe(false)
        expect(ctx.conversation_id).toBe('')
    })

    test('malformed JSON degrades to empty rather than throwing', () => {
        const { anchor } = load({ context: '{not json' })
        const ctx = anchor.readNativeContext()

        expect(ctx.present).toBe(false)
        expect(ctx.conversation_id).toBe('')
    })

    test('a JSON string that parses to a scalar is not mistaken for a context', () => {
        const { anchor } = load({ context: '"just a string"' })
        expect(anchor.readNativeContext().present).toBe(false)
    })

    test('the literal string "undefined" in a field reads as empty (LLD §4 normalisation)', () => {
        const { anchor } = load({
            context: nativeContext({ conversation_id: 'undefined', agent_id: 'null' }),
        })
        const ctx = anchor.readNativeContext()

        expect(ctx.conversation_id).toBe('')
        expect(ctx.agent_id).toBe('')
        // The finer key survives, so this context is still usable.
        expect(ctx.execution_plan_id).toBe(PLAN)
    })
})

// ---------------------------------------------------------------------------
// getOrCreate — creation
// ---------------------------------------------------------------------------

describe('getOrCreate — creating the anchor', () => {
    test('with no existing run: creates one, keyed on the conversation', () => {
        const { anchor, world } = load({ context: nativeContext() })
        const res = anchor.getOrCreate()

        expect(res.run_id).toBeTruthy()
        expect(res.created).toBe(true)
        expect(res.keyed).toBe(true)
        expect(res.key_source).toBe('conversation')
        expect(res.conversation_id).toBe(CONV)
        expect(world.calls.inserts).toHaveLength(1)
        expect(world.calls.inserts[0].table).toBe(RUN_TABLE)
    })

    test('the created record carries the LLD §4.6 field set', () => {
        const { anchor, world } = load({ context: nativeContext() })
        anchor.getOrCreate()
        const row = world.calls.inserts[0].row

        // §4.6: "Creates x_snc_troubleshoot_run with harness=native, status=running"
        expect(row.harness).toBe('native')
        expect(row.status).toBe('running')
        expect(row.conversation_ref).toBe(CONV)
        expect(row.execution_ref).toBe(PLAN)
        expect(row.agent).toBe(AGENT)
        expect(row.user).toBe('user1')
        expect(row.mode).toBe('diagnose')
    })

    test('the ambient global beats caller-supplied IDENTITY (security review, PR #21)', () => {
        // This test asserted the opposite until the security review. Letting a
        // caller override the conversation id means a native tool call can name
        // ANY conversation and be handed that conversation's run record — the
        // R-2 merge, reintroduced through the front door, on input that is
        // partly LLM-derived. LLD §4.6 is explicit that for the native harness
        // the key IS `_agentic_context_.conversation_id`.
        const { anchor, world } = load({ context: nativeContext() })
        anchor.getOrCreate({
            conversationId: sysId('attacker'),
            executionRef: sysId('otherplan'),
        })
        const row = world.calls.inserts[0].row

        expect(row.conversation_ref).toBe(CONV)
        expect(row.execution_ref).toBe(PLAN)
    })

    test('harness and mode are still caller-first — they are config, not identity', () => {
        const { anchor, world } = load({ context: nativeContext() })
        anchor.getOrCreate({ harness: 'custom', mode: 'collect' })
        const row = world.calls.inserts[0].row

        expect(row.harness).toBe('custom')
        expect(row.mode).toBe('collect')
    })

    test('with no ambient context, caller-supplied identity IS used (the custom harness path)', () => {
        // §4.6: "custom: explicit run_id". The override is a designed capability
        // for the harness that has no ambient context — it is only the native
        // path, where the platform supplies the truth, that must not be
        // overridable.
        const { anchor, world } = load({})
        anchor.getOrCreate({
            conversationId: sysId('explicit'),
            executionRef: sysId('otherplan'),
        })
        const row = world.calls.inserts[0].row

        expect(row.conversation_ref).toBe(sysId('explicit'))
        expect(row.execution_ref).toBe(sysId('otherplan'))
    })

    test('a partial ambient context is completed from the caller, field by field', () => {
        const { anchor, world } = load({
            context: nativeContext({ execution_plan_id: '' }),
        })
        anchor.getOrCreate({ executionRef: sysId('otherplan') })
        const row = world.calls.inserts[0].row

        expect(row.conversation_ref).toBe(CONV) // from the global, authoritative
        expect(row.execution_ref).toBe(sysId('otherplan')) // gap filled by caller
    })

    test('the run user is server-authoritative, not caller-supplied', () => {
        // `user` is what the ownership check reads. A caller able to set it
        // could plant a run stamped with someone else's id, turning the check
        // into an attack surface rather than a defence.
        const { anchor, world } = load({ context: nativeContext() })
        anchor.getOrCreate({ userId: 'someone.else' })

        expect(world.calls.inserts[0].row.user).toBe('user1')
    })

    test('harness defaults to native — the harness this anchor was built for', () => {
        const { anchor, world } = load({ context: nativeContext() })
        anchor.getOrCreate()
        expect(world.calls.inserts[0].row.harness).toBe('native')
    })

    test('an agent id that is not a sys_id is left off the reference field, not written as junk', () => {
        const { anchor, world } = load({ context: nativeContext({ agent_id: 'Agent Doctor' }) })
        anchor.getOrCreate()

        // `agent` is a real cross-scope ReferenceColumn into sn_aia_agent
        // (tables.now.ts). A name written into it dangles and reads back blank
        // — a blank masquerading as data, which is R-6's whole complaint. The
        // field is not written AT ALL rather than written empty, so the column
        // keeps whatever the table's own default says.
        expect(world.calls.inserts[0].row.agent || '').toBe('')
    })
})

// ---------------------------------------------------------------------------
// getOrCreate — the GET half. This is what the column added in issue #20 buys.
// ---------------------------------------------------------------------------

describe('getOrCreate — resolving an existing anchor', () => {
    test('a second call in the same conversation returns the SAME run', () => {
        const { anchor, world } = load({ context: nativeContext() })
        const first = anchor.getOrCreate()
        const second = anchor.getOrCreate()

        expect(second.run_id).toBe(first.run_id)
        expect(second.created).toBe(false)
        expect(second.keyed).toBe(true)
        expect(world.calls.inserts).toHaveLength(1)
    })

    test('nineteen calls of one conversation produce exactly one run (R-3 shape)', () => {
        // R-3 measured 19 tool calls in a single conversation. Every one of them
        // resolves the anchor; if resolution were per-call the artifacts would
        // scatter across 19 records and the trace would be unreadable.
        const { anchor, world } = load({ context: nativeContext() })
        const ids = []
        for (let i = 0; i < 19; i++) ids.push(anchor.getOrCreate().run_id)

        expect(new Set(ids).size).toBe(1)
        expect(world.calls.inserts).toHaveLength(1)
    })

    test('a different conversation gets a different run', () => {
        // Driven through the no-ambient-context path, because that is now the
        // only way a caller can name the conversation at all — with a native
        // context present it is authoritative and cannot be overridden.
        const { anchor, world } = load({})
        const a = anchor.getOrCreate({ conversationId: CONV })
        const b = anchor.getOrCreate({ conversationId: sysId('conv2') })

        expect(b.run_id).not.toBe(a.run_id)
        expect(world.calls.inserts).toHaveLength(2)
    })

    test('resolution queries on conversation_ref, and orders so the winner is deterministic', () => {
        const { anchor, world } = load({ context: nativeContext() })
        anchor.getOrCreate()
        const q = world.calls.queries[0]

        expect(q.table).toBe(RUN_TABLE)
        expect(q.filters.conversation_ref).toBe(CONV)
        // sys_created_on alone is second-granular, and a concurrent batch lands
        // inside one second — sys_id is the tie-break that makes the winner the
        // same for every caller in the batch.
        expect(q.order).toEqual(['sys_created_on', 'sys_id'])
    })

    test('a concurrent batch converges on ONE anchor rather than splitting', () => {
        // R-3: the harness issued up to 4 tool calls in a single timestamp
        // batch. Each one races to create the anchor. They must all end up
        // pointing at the same record, or the batch's artifacts scatter.
        const { anchor, world } = load({
            world: {
                rows: {
                    // Two runs already exist for this conversation, same second —
                    // the state a lost race leaves behind.
                    [RUN_TABLE]: [
                        {
                            sys_id: sysId('bbb'),
                            conversation_ref: CONV,
                            sys_created_on: '2026-07-31 12:00:00',
                        },
                        {
                            sys_id: sysId('aaa'),
                            conversation_ref: CONV,
                            sys_created_on: '2026-07-31 12:00:00',
                        },
                    ],
                },
            },
            context: nativeContext(),
        })

        const res = anchor.getOrCreate()

        expect(res.run_id).toBe(sysId('aaa')) // lowest sys_id wins the tie
        expect(res.created).toBe(false)
        expect(world.calls.inserts).toHaveLength(0)
    })

    test('a create re-resolves the key afterwards, which is what makes a race converge', () => {
        const { anchor, world } = load({ context: nativeContext() })
        anchor.getOrCreate()

        // query → nothing → insert → query AGAIN. Without that second query
        // each member of a concurrent batch keeps the record it just made, and
        // one conversation ends up with four anchors. The insert cannot be made
        // atomic from here, so convergence is bought by re-reading after it.
        expect(world.calls.inserts).toHaveLength(1)
        expect(world.calls.queries).toHaveLength(2)
    })

    test('when the re-resolve finds someone else won, created flips to false', () => {
        const { anchor, world } = load({ context: nativeContext() })

        // The competitor commits in the same second with a lower sys_id — so it
        // wins the tie-break, and this caller's own row is the orphan.
        world.tables[RUN_TABLE] = [
            {
                sys_id: '0' + sysId('winner').substring(1),
                conversation_ref: CONV,
                sys_created_on: '2026-07-31 12:00:00',
            },
        ]
        const res = anchor.getOrCreate()

        expect(res.run_id).toBe('0' + sysId('winner').substring(1))
        expect(res.created).toBe(false)
    })

    test('the execution ref keys the anchor when no conversation id exists', () => {
        const { anchor, world } = load({
            context: nativeContext({ conversation_id: '' }),
        })
        const first = anchor.getOrCreate()
        const second = anchor.getOrCreate()

        expect(first.key_source).toBe('execution')
        expect(first.keyed).toBe(true)
        expect(second.run_id).toBe(first.run_id)
        expect(world.calls.queries[0].filters.execution_ref).toBe(PLAN)
    })

    test('conversation beats execution when both are present', () => {
        const { anchor, world } = load({ context: nativeContext() })
        const res = anchor.getOrCreate()

        expect(res.key_source).toBe('conversation')
        expect(world.calls.queries[0].filters.conversation_ref).toBe(CONV)
        expect(world.calls.queries[0].filters.execution_ref).toBeUndefined()
    })

    test('an existing run is reported with its number, so a human can find it', () => {
        const { anchor } = load({
            world: {
                rows: {
                    [RUN_TABLE]: [
                        { sys_id: sysId('r1'), conversation_ref: CONV, number: 'TR0001042' },
                    ],
                },
            },
            context: nativeContext(),
        })

        expect(anchor.getOrCreate().number).toBe('TR0001042')
    })
})

// ---------------------------------------------------------------------------
// Ownership — defence in depth on the one key a caller still controls
// ---------------------------------------------------------------------------

describe('getOrCreate — cross-user key fixation (security review, PR #21)', () => {
    /** A run under CONV already owned by somebody else. */
    function foreignRun() {
        return {
            world: {
                rows: {
                    [RUN_TABLE]: [
                        {
                            sys_id: sysId('foreign'),
                            conversation_ref: CONV,
                            user: 'other.user',
                            sys_created_on: '2026-07-31 11:00:00',
                        },
                    ],
                },
            },
        }
    }

    test('a caller-supplied key does NOT adopt another user run', () => {
        const { anchor, world } = load(foreignRun())
        const res = anchor.getOrCreate({ conversationId: CONV })

        expect(res.run_id).not.toBe(sysId('foreign'))
        expect(res.created).toBe(true)
        expect(res.key_rejected).toBe(true)
        expect(world.calls.inserts).toHaveLength(1)
    })

    test('the refusal is stated, not silent (R-10)', () => {
        const { anchor } = load(foreignRun())
        expect(anchor.getOrCreate({ conversationId: CONV }).note).toMatch(/another user/i)
    })

    test('the re-resolve after insert does not re-adopt the run it just refused', () => {
        // The foreign run is OLDER, so it wins the post-insert ordering. Without
        // the ownership filter on that second lookup the check would be undone
        // one line after it fired.
        const { anchor } = load(foreignRun())
        expect(anchor.getOrCreate({ conversationId: CONV }).run_id).not.toBe(sysId('foreign'))
    })

    test('a second call by the same user converges on the run it made', () => {
        // Refusing to adopt must not mean creating a new run every call —
        // that would be the scatter bug wearing a security hat.
        const { anchor, world } = load(foreignRun())
        const first = anchor.getOrCreate({ conversationId: CONV })
        const second = anchor.getOrCreate({ conversationId: CONV })

        expect(second.run_id).toBe(first.run_id)
        expect(second.created).toBe(false)
        expect(world.calls.inserts).toHaveLength(1)
    })

    test('the ambient path is NOT ownership-checked', () => {
        // A false rejection here would split a native conversation across
        // several runs — the bug this component exists to prevent — and the
        // native runtime's identity surface is unverified until Task 10.
        const { anchor, world } = load({
            world: foreignRun().world,
            context: nativeContext(),
        })
        const res = anchor.getOrCreate()

        expect(res.run_id).toBe(sysId('foreign'))
        expect(res.created).toBe(false)
        expect(world.calls.inserts).toHaveLength(0)
    })

    test('a run with no recorded owner is adopted — nothing to violate', () => {
        const { anchor } = load({
            world: {
                rows: {
                    [RUN_TABLE]: [{ sys_id: sysId('ownerless'), conversation_ref: CONV }],
                },
            },
        })
        const res = anchor.getOrCreate({ conversationId: CONV })

        expect(res.run_id).toBe(sysId('ownerless'))
        expect(res.created).toBe(false)
    })

    test('an unidentifiable caller is not handed an invented denial', () => {
        // Fail OPEN on "cannot tell": a split anchor is the worse outcome, and
        // `gs` identity is known to be odd in the script-tool runtime (R-2
        // found getSessionID() returns the literal "SYSTEM" there).
        const { anchor } = load({ userId: null, world: foreignRun().world })
        const res = anchor.getOrCreate({ conversationId: CONV })

        expect(res.run_id).toBe(sysId('foreign'))
        expect(res.created).toBe(false)
    })

    test('a run owned by the caller is adopted normally', () => {
        const { anchor } = load({
            world: {
                rows: {
                    [RUN_TABLE]: [
                        { sys_id: sysId('mine'), conversation_ref: CONV, user: 'user1' },
                    ],
                },
            },
        })
        const res = anchor.getOrCreate({ conversationId: CONV })

        expect(res.run_id).toBe(sysId('mine'))
        expect(res.created).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// No key at all — the R-2 guard
// ---------------------------------------------------------------------------

describe('getOrCreate — nothing to key on (R-2)', () => {
    test('creates a fresh run and says so, rather than merging', () => {
        const { anchor } = load({})
        const res = anchor.getOrCreate()

        expect(res.run_id).toBeTruthy()
        expect(res.created).toBe(true)
        expect(res.keyed).toBe(false)
        expect(res.key_source).toBeNull()
    })

    test('two unkeyed calls NEVER share a run — isolation over tidiness', () => {
        // The single most important assertion in this file. If these two ever
        // return the same id, benchmark run 2 can read run 1's artifacts and
        // the doubled-run protocol is measuring nothing (DESIGN.md §2.4).
        const { anchor, world } = load({})
        const a = anchor.getOrCreate()
        const b = anchor.getOrCreate()

        expect(b.run_id).not.toBe(a.run_id)
        expect(world.calls.inserts).toHaveLength(2)
    })

    test('an unkeyed call does not query for something to adopt', () => {
        const { anchor, world } = load({})
        anchor.getOrCreate()

        // Querying with no key would match every run on the table, and the
        // first thing it found would become this conversation's anchor. There
        // is no query to get wrong here because there is no query.
        expect(world.calls.queries).toHaveLength(0)
    })

    test('the unkeyed reason is named, not implied (R-10)', () => {
        const { anchor } = load({})
        const res = anchor.getOrCreate()

        expect(res.note).toMatch(/no conversation/i)
        expect(res.note).toMatch(/isolat|not.*shared|per call/i)
    })

    test('a context object with only junk keys is still unkeyed', () => {
        const { anchor } = load({ context: JSON.stringify({ something_else: 'x' }) })
        const res = anchor.getOrCreate()

        expect(res.keyed).toBe(false)
        expect(res.created).toBe(true)
    })

    test('the literal "undefined" everywhere is unkeyed, not keyed on a string', () => {
        const { anchor, world } = load({
            context: nativeContext({ conversation_id: 'undefined', execution_plan_id: 'undefined' }),
        })
        const res = anchor.getOrCreate()

        expect(res.keyed).toBe(false)
        expect(world.calls.queries).toHaveLength(0)
        expect(world.calls.inserts[0].row.conversation_ref).toBe('')
    })
})

// ---------------------------------------------------------------------------
// Degradation — R-10 and R-1
// ---------------------------------------------------------------------------

describe('getOrCreate — degradation', () => {
    test('a rejected insert degrades with a named reason and a null run id', () => {
        const { anchor } = load({ world: { failInsert: true }, context: nativeContext() })
        const res = anchor.getOrCreate()

        expect(res.run_id).toBeNull()
        expect(res.created).toBe(false)
        expect(res.degraded).toBe('insert_failed')
        expect(res.note).toBeTruthy()
    })

    test('a throwing insert is contained AND the exception object is never touched (R-1)', () => {
        // Reading `.message` off a ScopeAccessNotGrantedException throws a
        // SECOND time, escapes the handler and 500s the whole request. This
        // exception models that: touching it at all fails the test.
        const hostile = {}
        Object.defineProperty(hostile, 'message', {
            get: function () {
                throw new Error('Illegal access to getter method getMessage')
            },
        })
        Object.defineProperty(hostile, 'name', {
            get: function () {
                throw new Error('Illegal access to getter method getName')
            },
        })

        const { anchor } = load({ world: { throwOnInsert: hostile }, context: nativeContext() })
        const res = anchor.getOrCreate()

        expect(res.run_id).toBeNull()
        expect(res.degraded).toBe('insert_failed')
    })

    test('a throwing query is contained without touching the exception (R-1)', () => {
        const hostile = {}
        Object.defineProperty(hostile, 'message', {
            get: function () {
                throw new Error('Illegal access to getter method getMessage')
            },
        })

        const { anchor } = load({ world: { throwOnQuery: hostile }, context: nativeContext() })
        const res = anchor.getOrCreate()

        // The lookup failed, so it creates rather than pretending it resolved.
        expect(res.run_id).toBeTruthy()
        expect(res.created).toBe(true)
    })

    test('no GlideRecord in the runtime degrades instead of throwing', () => {
        const { anchor } = load({ noGlide: true, context: nativeContext() })
        const res = anchor.getOrCreate()

        expect(res.run_id).toBeNull()
        expect(res.degraded).toBe('glide_unavailable')
    })

    test('a degraded anchor still reports the context it managed to read', () => {
        // PaArtifactStore will degrade with `no_run_anchor` on the back of this;
        // the caller should still be able to say WHICH conversation lost its
        // anchor, or the failure is unattributable.
        const { anchor } = load({ world: { failInsert: true }, context: nativeContext() })
        const res = anchor.getOrCreate()

        expect(res.conversation_id).toBe(CONV)
        expect(res.execution_ref).toBe(PLAN)
    })
})

// ---------------------------------------------------------------------------
// R-9 — every input may be absent, and arrives as a string when it does not
// ---------------------------------------------------------------------------

describe('getOrCreate — tolerant inputs (R-9)', () => {
    test('no argument at all is the normal native call, not an error', () => {
        const { anchor } = load({ context: nativeContext() })
        expect(anchor.getOrCreate().run_id).toBeTruthy()
    })

    test('null, a string and a number as context are all survivable', () => {
        const { anchor } = load({ context: nativeContext() })

        expect(anchor.getOrCreate(null).run_id).toBeTruthy()
        expect(anchor.getOrCreate('nonsense').run_id).toBeTruthy()
        expect(anchor.getOrCreate(42).run_id).toBeTruthy()
    })

    test('a JSON string context is parsed, since the adapter may forward one raw', () => {
        const { anchor, world } = load({})
        anchor.getOrCreate(JSON.stringify({ conversationId: CONV, harness: 'custom' }))

        expect(world.calls.inserts[0].row.conversation_ref).toBe(CONV)
        expect(world.calls.inserts[0].row.harness).toBe('custom')
    })

    test('an unknown harness value is rejected rather than written to the choice field', () => {
        const { anchor, world } = load({ context: nativeContext() })
        anchor.getOrCreate({ harness: 'sideways' })

        // ChoiceColumn accepts native|custom (tables.now.ts). Anything else
        // stores a value no report can group on.
        expect(world.calls.inserts[0].row.harness).toBe('native')
    })

    test('an Object.prototype name is not accepted as a harness value', () => {
        // Regression: the vocabulary check was an object used as a lookup map,
        // so `HARNESSES['constructor']` answered truthy and "constructor" went
        // straight into the choice field. The values are caller-supplied.
        const { anchor, world } = load({ context: nativeContext() })
        anchor.getOrCreate({ harness: 'constructor' })
        expect(world.calls.inserts[0].row.harness).toBe('native')
    })

    test('an Object.prototype name is not accepted as a mode value either', () => {
        const { anchor, world } = load({ context: nativeContext() })
        anchor.getOrCreate({ mode: 'toString' })
        expect(world.calls.inserts[0].row.mode).toBe('diagnose')
    })

    test('an unknown mode falls back to diagnose', () => {
        const { anchor, world } = load({ context: nativeContext() })
        anchor.getOrCreate({ mode: 'rummage' })
        expect(world.calls.inserts[0].row.mode).toBe('diagnose')
    })

    test('a missing user id is left blank rather than written as "null"', () => {
        const { anchor, world } = load({ userId: null, context: nativeContext() })
        anchor.getOrCreate()
        expect(world.calls.inserts[0].row.user || '').toBe('')
    })
})
