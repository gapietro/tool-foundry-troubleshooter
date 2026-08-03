/**
 * Pure-logic tests for PaToolAgentTrace (LLD §4.1).
 *
 * Covers only the platform-free half: argument handling, digesting, error
 * mining, task-tree assembly, failure signatures, latency flags. The
 * GlideRecordSecure reads are verified on-instance against real `sn_aia_*`
 * rows — a mocked GlideRecord would prove nothing about cross-scope access
 * (DESIGN.md R-8), which is the risk that actually matters here.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')

let trace

beforeEach(() => {
    const ctx = loadScriptInclude('tools/PaToolAgentTrace.js')
    trace = new ctx.PaToolAgentTrace()
})

// ---------------------------------------------------------------------------
// _normalizeArgs — R-9: every declared input may be absent, and the agent
// demonstrably failed to pass declared inputs in EVERY Phase 0 probe run.
// Build brief trap 9: complex inputs arrive as JSON strings at runtime.
// ---------------------------------------------------------------------------
describe('_normalizeArgs', () => {
    test('no args at all yields an empty arg set, not an error', () => {
        expect(trace._normalizeArgs(undefined)).toEqual({})
        expect(trace._normalizeArgs(null)).toEqual({})
        expect(trace._normalizeArgs({})).toEqual({})
    })

    test('parses a JSON string payload (the native script-tool runtime shape)', () => {
        const out = trace._normalizeArgs('{"execution":"abc123","detail":true}')
        expect(out.execution).toBe('abc123')
        expect(out.detail).toBe(true)
    })

    test('a bare non-JSON string is treated as an execution sys_id when it looks like one', () => {
        const sysId = '78f347b72f198310f824ac1bcfa4e3bd'
        expect(trace._normalizeArgs(sysId).execution).toBe(sysId)
    })

    test('a bare non-JSON, non-sys_id string is treated as an agent name', () => {
        expect(trace._normalizeArgs('SIGNAL IT Incident Triage').agent).toBe('SIGNAL IT Incident Triage')
    })

    test('malformed JSON does not throw', () => {
        expect(() => trace._normalizeArgs('{"execution":')).not.toThrow()
    })

    test('empty and whitespace-only strings are dropped, not kept as falsy values', () => {
        const out = trace._normalizeArgs({ execution: '', agent: '   ', step: '' })
        expect(out.execution).toBeUndefined()
        expect(out.agent).toBeUndefined()
        expect(out.step).toBeUndefined()
    })

    test('since is coerced to a positive number; junk is dropped', () => {
        expect(trace._normalizeArgs({ since: '60' }).since).toBe(60)
        expect(trace._normalizeArgs({ since: 60 }).since).toBe(60)
        expect(trace._normalizeArgs({ since: 'soon' }).since).toBeUndefined()
        expect(trace._normalizeArgs({ since: -5 }).since).toBeUndefined()
        expect(trace._normalizeArgs({ since: 0 }).since).toBeUndefined()
    })

    test('detail accepts the string forms an LLM actually emits', () => {
        expect(trace._normalizeArgs({ detail: 'true' }).detail).toBe(true)
        expect(trace._normalizeArgs({ detail: 'false' }).detail).toBe(false)
        expect(trace._normalizeArgs({ detail: false }).detail).toBe(false)
    })
})

describe('_resolveMode', () => {
    test('execution wins over agent when both are supplied', () => {
        expect(trace._resolveMode({ execution: 'x', agent: 'y' })).toBe('execution')
    })

    test('agent alone is enough — since is optional (R-9)', () => {
        expect(trace._resolveMode({ agent: 'Manager' })).toBe('agent')
        expect(trace._resolveMode({ agent: 'Manager', since: 60 })).toBe('agent')
    })

    test('nothing supplied falls back to recent, which is a usable answer not an error', () => {
        expect(trace._resolveMode({})).toBe('recent')
        expect(trace._resolveMode({ since: 60 })).toBe('recent')
    })
})

describe('_isSysId', () => {
    test('accepts a 32-char hex string', () => {
        expect(trace._isSysId('78f347b72f198310f824ac1bcfa4e3bd')).toBe(true)
    })

    test('rejects wrong length, non-hex, and non-strings', () => {
        expect(trace._isSysId('78f347b7')).toBe(false)
        expect(trace._isSysId('zzf347b72f198310f824ac1bcfa4e3bd')).toBe(false)
        expect(trace._isSysId(null)).toBe(false)
        expect(trace._isSysId(12345)).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// _refValue — real gpinst01 rows carry the LITERAL STRING "undefined" in
// sn_aia_execution_plan.agent, not an empty value. Found on-instance
// 2026-07-30 across every security_violation plan. A truthiness check treats
// that as a real sys_id and renders a reference that does not exist.
// ---------------------------------------------------------------------------
describe('_refValue', () => {
    test('the literal strings "undefined" and "null" are treated as empty', () => {
        expect(trace._refValue('undefined')).toBe('')
        expect(trace._refValue('null')).toBe('')
        expect(trace._refValue('NULL')).toBe('')
    })

    test('empty-ish values are normalised to an empty string', () => {
        expect(trace._refValue('')).toBe('')
        expect(trace._refValue(null)).toBe('')
        expect(trace._refValue(undefined)).toBe('')
    })

    test('a real sys_id passes through untouched', () => {
        const id = '9ce763032b0c721017a6ffbeee91bf86'
        expect(trace._refValue(id)).toBe(id)
    })
})

// ---------------------------------------------------------------------------
// _extractBindingId — LLD §2.1 says sn_aia_tools_execution.tool references
// sn_aia_agent_tool_m2m. On gpinst01 that field is EMPTY on every real row
// (verified 2026-07-30); the binding id is carried inside the `request` JSON
// as `toolM2mId`. Without the fallback the tool-call section names no tools
// at all — every tool_name null — which reads as "no tools" rather than
// "we looked in the wrong place".
// ---------------------------------------------------------------------------
describe('_extractBindingId', () => {
    const REQUEST = JSON.stringify({
        start_time: 1785460379053,
        toolM2mId: '3e16b69f2b9a8b9417a6ffbeee91bf0e',
        payload: {},
        type: 'SCRIPT',
    })

    test('prefers the tool field when it holds a real reference', () => {
        const out = trace._extractBindingId({ tool: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', request: REQUEST })
        expect(out.binding_id).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
        expect(out.source).toBe('tool')
    })

    test('falls back to toolM2mId inside the request payload when tool is empty', () => {
        const out = trace._extractBindingId({ tool: '', request: REQUEST })
        expect(out.binding_id).toBe('3e16b69f2b9a8b9417a6ffbeee91bf0e')
        expect(out.source).toBe('request.toolM2mId')
    })

    test('treats the literal string "undefined" in tool as empty and still falls back', () => {
        const out = trace._extractBindingId({ tool: 'undefined', request: REQUEST })
        expect(out.binding_id).toBe('3e16b69f2b9a8b9417a6ffbeee91bf0e')
    })

    test('reports no binding rather than inventing one when neither source has it', () => {
        const out = trace._extractBindingId({ tool: '', request: '{"payload":{}}' })
        expect(out.binding_id).toBe('')
        expect(out.source).toBe('none')
    })

    test('never throws on junk or missing rows', () => {
        expect(() => trace._extractBindingId(null)).not.toThrow()
        expect(() => trace._extractBindingId({})).not.toThrow()
        expect(() => trace._extractBindingId({ tool: '', request: 'not json' })).not.toThrow()
        expect(trace._extractBindingId(null).binding_id).toBe('')
    })
})

// ---------------------------------------------------------------------------
// _digest — LLD §4.1 step 2 caps output digests at 200 chars
// ---------------------------------------------------------------------------
describe('_digest', () => {
    test('short content passes through untouched', () => {
        expect(trace._digest('hello', 200)).toBe('hello')
    })

    test('over-limit content is cut and marked, never silently dropped', () => {
        const out = trace._digest('abcdef', 3)
        expect(out.indexOf('abc')).toBe(0)
        expect(out).toContain('3 more chars')
        expect(out.length).toBeLessThan(40)
    })

    test('empty-ish values become empty strings, not "null" or "undefined"', () => {
        expect(trace._digest(null, 200)).toBe('')
        expect(trace._digest(undefined, 200)).toBe('')
        expect(trace._digest('', 200)).toBe('')
    })

    test('objects are stringified rather than rendered as [object Object]', () => {
        expect(trace._digest({ a: 1 }, 200)).toBe('{"a":1}')
    })

    test('numbers and booleans survive', () => {
        expect(trace._digest(42, 200)).toBe('42')
        expect(trace._digest(false, 200)).toBe('false')
    })
})

// ---------------------------------------------------------------------------
// _parseScriptError — LLD §4.1 step 5. The verified live shape, from failed
// execution 78f347b7… on keynexus01:
//   {"fileName":"sn_aia_usecase.ec9f54a1….context_processing_script",
//    "lineNumber":61, ...}
// ---------------------------------------------------------------------------
describe('_parseScriptError', () => {
    const REAL = JSON.stringify({
        fileName: 'sn_aia_usecase.ec9f54a1a1b2c3d4e5f6.context_processing_script',
        lineNumber: 61,
        name: 'TypeError',
        message: 'Cannot read property "sys_id" from undefined',
    })

    test('extracts source, line and error name from the verified shape', () => {
        const out = trace._parseScriptError(REAL)
        expect(out).not.toBeNull()
        expect(out.source).toBe('sn_aia_usecase.ec9f54a1a1b2c3d4e5f6.context_processing_script')
        expect(out.line).toBe(61)
        expect(out.error_name).toBe('TypeError')
        expect(out.detail).toContain('Cannot read property')
    })

    test('accepts sourceName as an alias for fileName', () => {
        const out = trace._parseScriptError('{"sourceName":"MyScript","lineNumber":12}')
        expect(out.source).toBe('MyScript')
        expect(out.line).toBe(12)
    })

    test('finds JSON embedded in surrounding prose', () => {
        const out = trace._parseScriptError('Execution failed: ' + REAL + ' — see logs')
        expect(out).not.toBeNull()
        expect(out.line).toBe(61)
    })

    test('a line number arriving as a string is still a number on the way out', () => {
        const out = trace._parseScriptError('{"fileName":"X","lineNumber":"61"}')
        expect(out.line).toBe(61)
    })

    test('returns null for ordinary conversational text', () => {
        expect(trace._parseScriptError('Sorry, there was a problem.')).toBeNull()
    })

    test('returns null for JSON that carries no script-error markers', () => {
        expect(trace._parseScriptError('{"status":"ok","count":3}')).toBeNull()
    })

    test('a source with no line number still counts — the source is the evidence', () => {
        const out = trace._parseScriptError('{"fileName":"sn_aia_usecase.abc.context_processing_script"}')
        expect(out).not.toBeNull()
        expect(out.source).toBe('sn_aia_usecase.abc.context_processing_script')
        expect(out.line).toBeNull()
    })

    test('never throws on junk', () => {
        const junk = ['', null, undefined, '{{{{', '}{', '[]', 42, {}]
        junk.forEach((j) => expect(() => trace._parseScriptError(j)).not.toThrow())
    })
})

// ---------------------------------------------------------------------------
// _buildTaskTree — LLD §4.1 step 2: nest via `parent`, order by `order`.
// Observed orders: 50 = agent, 100 = orchestrator.
// ---------------------------------------------------------------------------
describe('_buildTaskTree', () => {
    const flat = [
        { sys_id: 'c1', parent: 'p1', order: 200, type: 'tool', status: 'success' },
        { sys_id: 'p1', parent: '', order: 100, type: 'agent', status: 'success' },
        { sys_id: 'c2', parent: 'p1', order: 150, type: 'gen_ai', status: 'success' },
    ]

    test('nests children under their parent and sorts by order', () => {
        const roots = trace._buildTaskTree(flat)
        expect(roots.length).toBe(1)
        expect(roots[0].sys_id).toBe('p1')
        expect(roots[0].children.map((c) => c.sys_id)).toEqual(['c2', 'c1'])
    })

    test('orders numerically, not lexically — 100 must precede 20', () => {
        const roots = trace._buildTaskTree([
            { sys_id: 'a', parent: '', order: '100' },
            { sys_id: 'b', parent: '', order: '20' },
        ])
        expect(roots.map((r) => r.sys_id)).toEqual(['b', 'a'])
    })

    test('a task whose parent is not in the result set is surfaced as an orphan root, not dropped', () => {
        const roots = trace._buildTaskTree([{ sys_id: 'x', parent: 'missing', order: 10 }])
        expect(roots.length).toBe(1)
        expect(roots[0].sys_id).toBe('x')
        expect(roots[0].orphaned).toBe(true)
    })

    test('a parent cycle is broken and flagged rather than hanging the tool', () => {
        const roots = trace._buildTaskTree([
            { sys_id: 'a', parent: 'b', order: 10 },
            { sys_id: 'b', parent: 'a', order: 20 },
        ])
        expect(roots.length).toBeGreaterThan(0)
        const flagged = roots.filter((r) => r.cycle_detected)
        expect(flagged.length).toBeGreaterThan(0)
        expect(JSON.stringify(roots).length).toBeLessThan(5000)
    })

    test('an empty task list yields an empty tree, not a throw', () => {
        expect(trace._buildTaskTree([])).toEqual([])
        expect(trace._buildTaskTree(null)).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// _shapeTasks — LLD §4.1 step 2 emits {order, type, status, description,
// time_ms, output_digest(200 chars)}. Summary mode must NOT carry full
// payloads: a single real ReAct task on gpinst01 has a ~4KB scratchpad in
// `output`, and returning those verbatim is what PaArtifactStore exists to
// prevent. Verified 2026-07-30 — the first version returned ~35KB for an
// 11-task run.
// ---------------------------------------------------------------------------
describe('_shapeTasks', () => {
    const big = new Array(5000).join('y')

    test('output is digested, not returned whole, and the true length is stated', () => {
        const out = trace._shapeTasks([{ sys_id: 'a', output: big, type: 'tool', status: 'success' }])
        expect(out[0].output_digest.length).toBeLessThan(trace.DIGEST_CHARS + 40)
        expect(out[0].output_length).toBe(big.length)
        expect(out[0].output).toBeUndefined()
    })

    test('metadata is digested too', () => {
        const out = trace._shapeTasks([{ sys_id: 'a', metadata: big }])
        expect(out[0].metadata).toBeUndefined()
        expect(out[0].metadata_digest.length).toBeLessThan(trace.DIGEST_CHARS + 40)
    })

    test('the fields the tree and the heuristics need all survive', () => {
        const out = trace._shapeTasks([
            {
                sys_id: 'a',
                parent: 'p',
                order: '100',
                type: 'gen_ai',
                status: 'ongoing',
                description: 'AIA ReAct Engine',
                execution_time_ms: '10297',
            },
        ])
        expect(out[0].sys_id).toBe('a')
        expect(out[0].parent).toBe('p')
        expect(out[0].order).toBe('100')
        expect(out[0].type).toBe('gen_ai')
        expect(out[0].status).toBe('ongoing')
        expect(out[0].description).toBe('AIA ReAct Engine')
        expect(out[0].execution_time_ms).toBe('10297')
    })

    test('a whole shaped task set stays small enough to hand to an LLM', () => {
        const many = []
        for (let i = 0; i < 30; i++) many.push({ sys_id: 's' + i, output: big, metadata: big })
        expect(JSON.stringify(trace._shapeTasks(many)).length).toBeLessThan(30000)
    })

    test('never throws on empty input', () => {
        expect(trace._shapeTasks(null)).toEqual([])
        expect(trace._shapeTasks([])).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// _applyOrder — ordering must reach the DATABASE, and needs a secondary key.
//
// On gpinst01 five of nine sn_aia_message rows carry an EMPTY
// message_sequence (the tool-result messages). Sorting on that column alone
// leaves those five in arbitrary order at the head of the stream — and the
// message stream is the evidence LLD §4.1 step 4 uses to show dialogue
// progression, so a nondeterministic order misrepresents what happened.
// ---------------------------------------------------------------------------
describe('_applyOrder', () => {
    function recorder() {
        const calls = []
        return {
            calls: calls,
            orderBy: function (f) {
                calls.push(['asc', f])
            },
            orderByDesc: function (f) {
                calls.push(['desc', f])
            },
        }
    }

    test('a bare string sorts ascending', () => {
        const gr = recorder()
        trace._applyOrder(gr, 'sys_created_on')
        expect(gr.calls).toEqual([['asc', 'sys_created_on']])
    })

    test('{field, desc} sorts descending — the recency fix', () => {
        const gr = recorder()
        trace._applyOrder(gr, { field: 'sys_created_on', desc: true })
        expect(gr.calls).toEqual([['desc', 'sys_created_on']])
    })

    test('an array applies every key in order, primary first', () => {
        const gr = recorder()
        trace._applyOrder(gr, ['message_sequence', 'sys_created_on'])
        expect(gr.calls).toEqual([
            ['asc', 'message_sequence'],
            ['asc', 'sys_created_on'],
        ])
    })

    test('no ordering requested issues no sort calls', () => {
        const gr = recorder()
        trace._applyOrder(gr, null)
        expect(gr.calls).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// _deriveFailureSignatures — LLD §4.1 step 6
// ---------------------------------------------------------------------------
describe('_deriveFailureSignatures', () => {
    const sig = (out, name) => out.filter((s) => s.signature === name)[0]

    test('terminated + cancelled orchestrator + ongoing leaf = died mid-reasoning', () => {
        const plan = { state: 'terminated', state_reason: 'execution_failed' }
        const tasks = [
            { sys_id: 'a', type: 'agent', status: 'success', description: 'Agent' },
            { sys_id: 'b', type: 'agent', status: 'cancelled', description: 'Orchestrator' },
            { sys_id: 'c', type: 'gen_ai', status: 'ongoing', description: 'AIA ReAct Engine' },
        ]
        const out = trace._deriveFailureSignatures(plan, tasks, [])
        expect(sig(out, 'died_mid_reasoning')).toBeDefined()
        expect(sig(out, 'died_mid_reasoning').evidence.length).toBeGreaterThan(0)
    })

    test('security_violation maps to ACL-trigger misalignment with a next-step pointer (K26 Lab 1)', () => {
        const out = trace._deriveFailureSignatures(
            { state: 'terminated', state_reason: 'security_violation' },
            [],
            []
        )
        const s = sig(out, 'acl_trigger_misalignment')
        expect(s).toBeDefined()
        expect(s.next_step).toMatch(/agent_config/i)
    })

    test('a non-success access_verification task is cited as the same family', () => {
        const out = trace._deriveFailureSignatures({ state: 'terminated' }, [
            { sys_id: 'v', type: 'access_verification', status: 'cancelled' },
        ], [])
        expect(sig(out, 'access_verification_failed')).toBeDefined()
    })

    test('a mined script error is promoted to a signature with the source as evidence', () => {
        const out = trace._deriveFailureSignatures(
            { state: 'terminated', state_reason: 'execution_failed' },
            [],
            [{ source: 'sn_aia_usecase.abc.context_processing_script', line: 61, error_name: 'TypeError' }]
        )
        const s = sig(out, 'script_error')
        expect(s).toBeDefined()
        expect(JSON.stringify(s.evidence)).toContain('context_processing_script')
    })

    test('no_activity is reported — the agent never did anything is itself the finding', () => {
        const out = trace._deriveFailureSignatures({ state: 'terminated', state_reason: 'no_activity' }, [], [])
        expect(sig(out, 'no_activity')).toBeDefined()
    })

    test('a clean completed run produces no signatures', () => {
        const out = trace._deriveFailureSignatures({ state: 'completed', state_reason: '' }, [
            { sys_id: 'a', type: 'agent', status: 'success' },
        ], [])
        expect(out).toEqual([])
    })

    test('never throws on missing plan or tasks', () => {
        expect(() => trace._deriveFailureSignatures(null, null, null)).not.toThrow()
        expect(trace._deriveFailureSignatures(null, null, null)).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// _deriveLatencyFlags — LLD §4.1 step 7 / K26 Lab 2 heuristic:
//   slow gen_ai step  => instruction bloat (prompt reprocessed every turn)
//   slow tool step    => tool output bloat (scratchpad inflation)
// ---------------------------------------------------------------------------
describe('_deriveLatencyFlags', () => {
    const flag = (out, name) => out.filter((f) => f.flag === name)[0]

    test('a slow gen_ai task flags instruction bloat', () => {
        const out = trace._deriveLatencyFlags({}, [
            { sys_id: 'g', type: 'gen_ai', description: 'AIA ReAct Engine', execution_time_ms: 40000 },
        ], [])
        expect(flag(out, 'instruction_bloat')).toBeDefined()
        expect(flag(out, 'instruction_bloat').observed_ms).toBe(40000)
    })

    test('a high plan-level token average corroborates the instruction-bloat call', () => {
        const out = trace._deriveLatencyFlags({ llm_token_avg: 40000 }, [
            { sys_id: 'g', type: 'gen_ai', execution_time_ms: 40000 },
        ], [])
        expect(flag(out, 'instruction_bloat').corroborated).toBe(true)
    })

    test('a slow tool task flags tool output bloat', () => {
        const out = trace._deriveLatencyFlags({}, [
            { sys_id: 't', type: 'tool', description: 'Search KB', execution_time_ms: 30000 },
        ], [])
        expect(flag(out, 'tool_output_bloat')).toBeDefined()
    })

    test('an oversized tool response flags bloat even when the call was fast', () => {
        const big = new Array(30000).join('x')
        const out = trace._deriveLatencyFlags({}, [], [
            { sys_id: 'tc', tool_name: 'Search KB', execution_time_ms: 100, response_length: big.length },
        ])
        const f = flag(out, 'tool_output_bloat')
        expect(f).toBeDefined()
        expect(f.observed_response_chars).toBe(big.length)
    })

    test('fast tasks within budget produce no flags', () => {
        const out = trace._deriveLatencyFlags({}, [
            { sys_id: 'g', type: 'gen_ai', execution_time_ms: 800 },
            { sys_id: 't', type: 'tool', execution_time_ms: 300 },
        ], [])
        expect(out).toEqual([])
    })

    test('flags are capped and sorted slowest-first, with the drop stated not silent', () => {
        const many = []
        for (let i = 0; i < 20; i++) {
            many.push({ sys_id: 'g' + i, type: 'gen_ai', execution_time_ms: 20000 + i * 1000 })
        }
        const out = trace._deriveLatencyFlags({}, many, [])
        expect(out.length).toBeLessThanOrEqual(trace.MAX_LATENCY_FLAGS)
        expect(out[0].observed_ms).toBeGreaterThan(out[out.length - 1].observed_ms)
        expect(out[0].total_flagged).toBe(20)
    })

    test('every flag carries a remediation drawn from the K26 Lab 2 vocabulary', () => {
        const out = trace._deriveLatencyFlags({}, [
            { sys_id: 'g', type: 'gen_ai', execution_time_ms: 40000 },
            { sys_id: 't', type: 'tool', execution_time_ms: 40000 },
        ], [])
        out.forEach((f) => expect(typeof f.remediation).toBe('string'))
        out.forEach((f) => expect(f.remediation.length).toBeGreaterThan(10))
    })

    test('never throws on missing inputs', () => {
        expect(() => trace._deriveLatencyFlags(null, null, null)).not.toThrow()
        expect(trace._deriveLatencyFlags(null, null, null)).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// Deferred surface — the build brief defers detail mode until PaArtifactStore
// exists. It must say so, not ignore the argument silently.
// ---------------------------------------------------------------------------
describe('deferred detail mode', () => {
    test('the deferral notice names the arg and says what is missing', () => {
        const notice = trace._detailDeferredNotice('some-task-sys-id')
        expect(notice.status).toBe('not_implemented')
        expect(notice.requested_step).toBe('some-task-sys-id')
        expect(notice.detail.toLowerCase()).toContain('paartifactstore')
    })
})

// ---------------------------------------------------------------------------
// Execution smoke tests.
//
// These answer ONE question: does each resolution path actually run? They use
// a permissive GlideRecordSecure stub and prove nothing about platform
// behaviour (DESIGN.md R-8) — cross-scope readability, ACLs and query
// semantics stay on-instance checks.
//
// They exist because a stale `plans` variable survived a refactor in
// _resolveByAgent and reached gpinst01 TWICE: the pure-logic tests could not
// reach that branch, and the R-1 catch dutifully converted the ReferenceError
// into a tidy "failed during phase resolve_target" message. Correct behaviour
// from the handler, and a defect invisible to `npm test`.
// ---------------------------------------------------------------------------
describe('execution paths run end to end', () => {
    const { makeGlideRecordSecure, makeGlideDateTime } = require('./_glideStub')

    const TABLES = {
        sn_aia_execution_plan: [
            {
                sys_id: 'plan0000000000000000000000000001',
                state: 'terminated',
                state_reason: 'security_violation',
                objective: 'Triage INC001',
                usecase: 'uc000000000000000000000000000001',
                agent: 'undefined',
                conversation: '',
                sys_created_on: '2026-07-30 10:00:00',
            },
        ],
        sn_aia_usecase: [{ sys_id: 'uc000000000000000000000000000001', name: 'Triage and categorize' }],
        sn_aia_agent: [],
        sn_aia_execution_task: [
            {
                sys_id: 'task0000000000000000000000000001',
                parent: '',
                order: '100',
                type: 'access_verification',
                status: 'cancelled',
                description: 'Access check',
                execution_time_ms: '900',
            },
        ],
        sn_aia_tools_execution: [],
        sn_aia_message: [
            {
                sys_id: 'msg00000000000000000000000000001',
                message_sequence: '1',
                role: 'agent',
                name: 'Agent',
                message: '{"fileName":"sn_aia_usecase.abc.context_processing_script","lineNumber":61,"name":"TypeError"}',
            },
        ],
        sn_aia_agent_tool_m2m: [],
        sys_cs_conversation: [],
        sys_cs_message: [],
    }

    // The stub does NOT filter on addQuery — it returns whatever rows the table
    // holds. So "does this name match nothing" is expressed by handing it an
    // empty table set, not by passing a name that should not match.
    function load(tables) {
        const ctx = loadScriptInclude('tools/PaToolAgentTrace.js', {
            GlideRecordSecure: makeGlideRecordSecure(tables || TABLES),
            GlideDateTime: makeGlideDateTime(),
        })
        return new ctx.PaToolAgentTrace()
    }

    test('the execution path completes and produces a header', () => {
        const r = load().execute({ execution: 'plan0000000000000000000000000001' })
        expect(r.success).toBe(true)
        expect(r.data.header.execution_plan).toBe('plan0000000000000000000000000001')
    })

    test('the agent-name path completes — the branch that shipped broken twice', () => {
        const r = load().execute({ agent: 'Triage and categorize' })
        expect(r.success).toBe(true)
        expect(r.data.resolution.mode).toBe('agent')
        expect(r.data.header).toBeDefined()
    })

    test('the agent-name path completes with a since window too', () => {
        const r = load().execute({ agent: 'Triage and categorize', since: 60 })
        expect(r.success).toBe(true)
    })

    test('an unmatched agent name returns a finding, not a failure', () => {
        const r = load({ sn_aia_agent: [], sn_aia_usecase: [] }).execute({ agent: 'No Such Agent Anywhere' })
        expect(r.success).toBe(true)
        expect(r.data.resolution.note).toContain('No sn_aia_agent')
        expect(r.data.header).toBeUndefined()
    })

    test('the no-arguments path completes (R-9)', () => {
        const r = load().execute({})
        expect(r.success).toBe(true)
        expect(r.data.resolution.mode).toBe('recent')
        expect(r.data.resolution.candidates.length).toBe(1)
    })

    test('a full run wires the 7 summary steps together', () => {
        const r = load().execute({ execution: 'plan0000000000000000000000000001' })
        const d = r.data
        expect(d.task_tree.length).toBe(1)
        expect(d.script_errors.length).toBe(1)
        expect(d.script_errors[0].line).toBe(61)
        const names = d.header.failure_signature.map((s) => s.signature)
        expect(names).toContain('acl_trigger_misalignment')
        expect(names).toContain('access_verification_failed')
        expect(names).toContain('script_error')
        expect(d.evidence_basis.message_rows).toBe(1)
    })

    test('the literal "undefined" agent reference is reported as unusable', () => {
        const r = load().execute({ execution: 'plan0000000000000000000000000001' })
        expect(r.data.header.agent.sys_id).toBe('')
        expect(r.data.header.agent.raw).toBe('undefined')
    })

    test('the step argument reports the deferral instead of being ignored', () => {
        const r = load().execute({ execution: 'plan0000000000000000000000000001', step: 'task0000000000000000000000000001' })
        expect(r.data.detail.status).toBe('not_implemented')
    })
})

// ---------------------------------------------------------------------------
// Ordering reaches the database, with a total order on the message stream.
//
// Two defects this guards, both found on gpinst01:
//   - candidates were sorted in memory AFTER setLimit(10), so ten arbitrary
//     rows were labelled "the ten most recent"
//   - sn_aia_message.message_sequence is EMPTY on tool-result rows (five of
//     nine on the probe run), so it is not a total order on its own
// ---------------------------------------------------------------------------
describe('ordering is applied at the database', () => {
    const { makeGlideRecordSecure, makeGlideDateTime } = require('./_glideStub')

    function run(args, tables) {
        const GRS = makeGlideRecordSecure(tables || {})
        const ctx = loadScriptInclude('tools/PaToolAgentTrace.js', {
            GlideRecordSecure: GRS,
            GlideDateTime: makeGlideDateTime(),
        })
        new ctx.PaToolAgentTrace().execute(args)
        return GRS.orderCalls
    }

    test('the message stream leads on the timestamp, the only key every row has', () => {
        const calls = run(
            { execution: 'plan0000000000000000000000000001' },
            { sn_aia_execution_plan: [{ sys_id: 'plan0000000000000000000000000001' }] }
        )
        const msg = calls.filter((c) => c[0] === 'sn_aia_message').map((c) => c[2])
        // sequence-primary would put empty-sequence rows ahead of messages
        // created 26 seconds earlier — see the comment at the call site.
        expect(msg).toEqual(['sys_created_on', 'message_sequence', 'sys_id'])
    })

    test('the recent pick-list sorts newest-first in the query, not afterwards', () => {
        const calls = run({})
        expect(calls).toContainEqual(['sn_aia_execution_plan', 'desc', 'sys_created_on'])
    })

    test('the agent pick-list sorts newest-first in the query too', () => {
        const calls = run(
            { agent: 'Some Use Case' },
            { sn_aia_usecase: [{ sys_id: 'uc000000000000000000000000000001', name: 'Some Use Case' }] }
        )
        expect(calls).toContainEqual(['sn_aia_execution_plan', 'desc', 'sys_created_on'])
    })

    test('the conversation stream also gets a tiebreaker', () => {
        const calls = run(
            { execution: 'plan0000000000000000000000000001' },
            {
                sn_aia_execution_plan: [
                    { sys_id: 'plan0000000000000000000000000001', conversation: 'conv000000000000000000000000001' },
                ],
                sys_cs_conversation: [{ sys_id: 'conv000000000000000000000000001' }],
            }
        )
        const cs = calls.filter((c) => c[0] === 'sys_cs_message').map((c) => c[2])
        expect(cs).toEqual(['sequence', 'sys_created_on', 'sys_id'])
    })
})

// ---------------------------------------------------------------------------
// The task-vs-tool-call note (issue #85).
//
// This note used to read "Execution tasks are NOT 1:1 with tool calls (27
// tasks / 19 calls in a measured run)". The 27 and the 19 came from an
// illustrative run measured once during the build, and they shipped in every
// payload. In the v3 scored benchmark pass six of ten scored runs plus the
// smoke run read them as findings about the run under diagnosis and built
// their whole root cause on the supposed discrepancy; one proposed, as its
// fix, adding the very note it had misread.
//
// The counts are now this run's own. A reader who treats them as run data is
// now RIGHT, which is the only version of this note that cannot backfire.
// ---------------------------------------------------------------------------
describe('task-vs-tool-call note carries this run\'s counts (issue #85)', () => {
    const { makeGlideRecordSecure, makeQueryingGlideRecordSecure, makeGlideDateTime } = require('./_glideStub')

    const ok = (total) => ({ total: total, read_status: 'ok' })
    const denied = { total: 0, read_status: 'DENIED' }

    test('states the counts it is given, whatever they are', () => {
        expect(trace._taskVsToolCallNote(ok(27), ok(19))).toContain('27')
        expect(trace._taskVsToolCallNote(ok(27), ok(19))).toContain('19')
        expect(trace._taskVsToolCallNote(ok(4), ok(4))).toContain('4')
    })

    test('a run with nothing in it reports zero, not a remembered run', () => {
        const note = trace._taskVsToolCallNote(ok(0), ok(0))
        expect(note).toMatch(/\b0\b/)
        expect(note).not.toMatch(/\b(27|19)\b/)
    })

    // -----------------------------------------------------------------------
    // A DENIED read is not a measured zero (Bugbot round 1, R-6 / R-19b).
    //
    // Both totals come from row arrays that are EMPTY on a cross-scope denial
    // as surely as on a genuinely empty run, so "This run recorded 0 execution
    // task(s) and 0 tool call(s)" was being asserted about rows nobody could
    // read. That contradicts evidence_basis sitting in the same payload — "a
    // zero with DENIED is a permission gap and says nothing about the run" —
    // and R-19b forbids a note contradicting the status beside it.
    //
    // It is also the SAME defect class this PR exists to fix: a number in a
    // note that is not what it appears to be. Worse in one respect, because a
    // fabricated zero is the exact shape of "the agent called no tools",
    // which is a confident wrong diagnosis rather than a harmless one.
    // -----------------------------------------------------------------------
    test('a DENIED task read is reported as unknown, never as zero tasks', () => {
        const note = trace._taskVsToolCallNote(denied, ok(3))
        expect(note).toMatch(/unknown/i)
        expect(note).toContain('DENIED')
        expect(note).toContain('sn_aia_execution_task')
        expect(note).not.toMatch(/recorded 0 /)
        // The readable side is still stated — a denial on one read says
        // nothing about the other.
        expect(note).toContain('3')
    })

    test('a DENIED tool-call read is reported as unknown, never as zero calls', () => {
        const note = trace._taskVsToolCallNote(ok(5), denied)
        expect(note).toMatch(/unknown/i)
        expect(note).toContain('sn_aia_tools_execution')
        expect(note).toContain('5')
    })

    test('says a denial is a permission gap rather than an absence', () => {
        const note = trace._taskVsToolCallNote(denied, denied)
        expect(note.toLowerCase()).toContain('permission')
        expect(note).not.toMatch(/\b0\b/)
    })

    test('the emitted note never claims a count on a denied read', () => {
        const ctx = loadScriptInclude('tools/PaToolAgentTrace.js', {
            GlideRecordSecure: makeQueryingGlideRecordSecure(
                { sn_aia_execution_plan: [{ sys_id: 'plan0000000000000000000000000001' }] },
                { denied: ['sn_aia_execution_task', 'sn_aia_tools_execution'] }
            ),
            GlideDateTime: makeGlideDateTime(),
        })

        const r = new ctx.PaToolAgentTrace().execute({ execution: 'plan0000000000000000000000000001' })
        const note = r.data.notes.join(' ')

        expect(r.data.task_stats.read_status).toBe('DENIED')
        expect(r.data.tool_call_stats.read_status).toBe('DENIED')
        expect(note).not.toMatch(/recorded 0 /)
        expect(note).toMatch(/unknown/i)
    })

    test('says the gap between the two counts is not a finding', () => {
        // The v3 runs did not merely notice the difference — they reported it
        // as a CONFIRMED layer-1 defect. Telling a reader the counts differ is
        // not enough; the note has to forbid the conclusion.
        expect(trace._taskVsToolCallNote(ok(9), ok(3)).toLowerCase()).toContain('not a finding')
    })

    test('the emitted note matches the run\'s own task_stats and tool_call_stats', () => {
        const ctx = loadScriptInclude('tools/PaToolAgentTrace.js', {
            GlideRecordSecure: makeGlideRecordSecure({
                sn_aia_execution_plan: [{ sys_id: 'plan0000000000000000000000000001' }],
                sn_aia_execution_task: [
                    { sys_id: 'task0000000000000000000000000001', order: '100', type: 'tool', status: 'success' },
                    { sys_id: 'task0000000000000000000000000002', order: '200', type: 'gen_ai', status: 'success' },
                    { sys_id: 'task0000000000000000000000000003', order: '300', type: 'tool', status: 'success' },
                ],
                sn_aia_tools_execution: [{ sys_id: 'te000000000000000000000000000001', execution_plan_id: 'plan0000000000000000000000000001' }],
            }),
            GlideDateTime: makeGlideDateTime(),
        })

        const r = new ctx.PaToolAgentTrace().execute({ execution: 'plan0000000000000000000000000001' })
        const note = r.data.notes.join(' ')

        expect(r.data.task_stats.total).toBe(3)
        expect(r.data.tool_call_stats.total).toBe(1)
        // The numbers in the note and the numbers in the stats blocks are the
        // same numbers, from the same read. Nothing else may appear.
        expect(note).toContain('3')
        expect(note).toContain('1')
        expect(note).not.toContain('27')
        expect(note).not.toContain('19')
    })
})
