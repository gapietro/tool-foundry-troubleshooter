/**
 * PaArtifactStore — pure-logic tests (IMPLEMENTATION_PLAN.md Task 4).
 *
 * WHAT THESE TESTS ARE FOR
 * Truncation arithmetic, paging math, boundary conditions, argument coercion,
 * and — the one that matters most — that paging a large payload back out
 * reassembles byte-identical to what went in. That is arithmetic, and
 * arithmetic is exactly what a unit test can settle.
 *
 * WHAT THEY DO NOT SETTLE
 * Whether `GlideSysAttachment` behaves this way inside a scoped app. The stubs
 * below are hand-written fakes; per DESIGN.md R-8 a mocked result is not
 * evidence about platform behaviour in EITHER direction. LLD §4.5 carries an
 * explicit `⚠ VERIFY` on the scoped attachment write surface, and that flag is
 * cleared on-instance or not at all. See issue #16.
 *
 * The attachment stubs live here rather than in `test/_glideStub.js` because
 * PaArtifactStore is the only component that writes anything — the shared stub
 * is deliberately read-only (GlideRecordSecure), matching every other tool core.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

/**
 * Writable GlideRecord + a sys_attachment store shared with GlideSysAttachment.
 *
 * `attachments` is the fake table: each entry is
 * {sys_id, table_name, table_sys_id, file_name, content_type, content}.
 */
function makeAttachmentWorld(options) {
    const opts = options || {}
    const runs = opts.runs || [{ sys_id: 'run1' }]
    const attachments = opts.attachments ? opts.attachments.slice(0) : []
    const calls = { writes: [], getContent: [] }
    let seq = 0

    function GlideRecord(table) {
        this._table = table
        this._rows = table === 'sys_attachment' ? attachments : runs
        this._i = -1
        this._filters = {}
    }
    GlideRecord.prototype.addQuery = function (f, v) {
        this._filters[f] = String(v)
        return { addOrCondition: function () {}, addCondition: function () {} }
    }
    GlideRecord.prototype.query = function () {
        const filters = this._filters
        this._matched = this._rows.filter((r) =>
            Object.keys(filters).every((k) => String(r[k]) === filters[k])
        )
        this._i = -1
    }
    GlideRecord.prototype.getRowCount = function () {
        return (this._matched || []).length
    }
    GlideRecord.prototype.next = function () {
        this._i++
        return this._i < (this._matched || []).length
    }
    GlideRecord.prototype.get = function (sysId) {
        for (let i = 0; i < this._rows.length; i++) {
            if (this._rows[i].sys_id === String(sysId)) {
                this._i = i
                this._matched = this._rows
                return true
            }
        }
        return false
    }
    GlideRecord.prototype.getValue = function (f) {
        const row = (this._matched || this._rows)[this._i]
        if (!row) return ''
        return row[f] === undefined || row[f] === null ? '' : String(row[f])
    }
    GlideRecord.prototype.getUniqueValue = function () {
        const row = (this._matched || this._rows)[this._i]
        return row ? row.sys_id : ''
    }

    function GlideSysAttachment() {}
    GlideSysAttachment.prototype.write = function (gr, fileName, contentType, content) {
        calls.writes.push({
            table: gr && gr._table,
            fileName: fileName,
            contentType: contentType,
            length: String(content).length,
        })
        if (opts.writeReturns !== undefined) return opts.writeReturns
        if (opts.writeThrows) throw opts.writeThrows
        seq++
        const id = 'att' + seq
        attachments.push({
            sys_id: id,
            table_name: gr._table,
            table_sys_id: gr.getUniqueValue(),
            file_name: fileName,
            content_type: contentType,
            content: String(content),
        })
        return id
    }
    GlideSysAttachment.prototype.getContent = function (gr) {
        calls.getContent.push(gr && gr.getValue('sys_id'))
        if (opts.getContentThrows) throw opts.getContentThrows
        const row = attachments.filter((a) => a.sys_id === gr.getValue('sys_id'))[0]
        return row ? row.content : ''
    }

    // Reads go through GlideRecordSecure; the fake table is the same one.
    function GlideRecordSecure(table) {
        GlideRecord.call(this, table)
    }
    GlideRecordSecure.prototype = Object.create(GlideRecord.prototype)
    GlideRecordSecure.prototype.constructor = GlideRecordSecure

    return {
        globals: {
            GlideRecord: GlideRecord,
            GlideRecordSecure: GlideRecordSecure,
            GlideSysAttachment: GlideSysAttachment,
        },
        attachments: attachments,
        calls: calls,
    }
}

function newStore(world, options) {
    const ctx = loadScriptInclude('PaArtifactStore.js', world ? world.globals : {})
    return new ctx.PaArtifactStore(options)
}

/** Deterministic filler — distinct at every offset, so slice bugs cannot hide. */
function filler(n) {
    let s = ''
    let i = 0
    while (s.length < n) {
        s += 'line' + i + ':' + 'abcdefghijklmnopqrstuvwxyz' + '\n'
        i++
    }
    return s.substring(0, n)
}

// ---------------------------------------------------------------------------
// _truncate
// ---------------------------------------------------------------------------

describe('_truncate', () => {
    test('returns content unchanged when under the limit', () => {
        const store = newStore(makeAttachmentWorld())
        expect(store._truncate('short', 2000)).toBe('short')
    })

    test('returns content unchanged at exactly the limit', () => {
        const store = newStore(makeAttachmentWorld())
        const exact = filler(2000)
        expect(store._truncate(exact, 2000)).toBe(exact)
    })

    test('over the limit: head 1500 + elision marker + tail 500 (LLD §4.5)', () => {
        const store = newStore(makeAttachmentWorld())
        const content = filler(10000)
        const out = store._truncate(content, 2000)

        expect(out.indexOf(content.substring(0, 1500))).toBe(0)
        expect(out.substring(out.length - 500)).toBe(content.substring(9500))
        expect(out).toContain('[elided 8000 chars]')
    })

    test('elision count is exactly what was dropped', () => {
        const store = newStore(makeAttachmentWorld())
        const out = store._truncate(filler(35000), 2000)
        const dropped = Number(/\[elided (\d+) chars\]/.exec(out)[1])
        expect(dropped).toBe(35000 - 2000)
    })

    test('a custom limit keeps the 3:1 head/tail split', () => {
        const store = newStore(makeAttachmentWorld())
        const content = filler(10000)
        const out = store._truncate(content, 400)

        expect(out.indexOf(content.substring(0, 300))).toBe(0)
        expect(out.substring(out.length - 100)).toBe(content.substring(9900))
    })

    test('empty and null content are safe', () => {
        const store = newStore(makeAttachmentWorld())
        expect(store._truncate('', 2000)).toBe('')
        expect(store._truncate(null, 2000)).toBe('')
    })
})

// ---------------------------------------------------------------------------
// store()
// ---------------------------------------------------------------------------

describe('store', () => {
    test('under threshold: content passes through untouched, nothing is written', () => {
        const world = makeAttachmentWorld()
        const store = newStore(world)
        const content = filler(3999)
        const out = store.store('run1', 'agent_trace', content)

        expect(out.stored).toBe(false)
        expect(out.artifact_id).toBeNull()
        expect(out.content).toBe(content)
        expect(out.total_length).toBe(3999)
        expect(world.calls.writes).toHaveLength(0)
    })

    test('exactly at threshold is NOT stored (boundary)', () => {
        const world = makeAttachmentWorld()
        const out = newStore(world).store('run1', 'agent_trace', filler(4000))

        expect(out.stored).toBe(false)
        expect(world.calls.writes).toHaveLength(0)
    })

    test('one char over threshold IS stored (boundary)', () => {
        const world = makeAttachmentWorld()
        const out = newStore(world).store('run1', 'agent_trace', filler(4001))

        expect(out.stored).toBe(true)
        expect(world.calls.writes).toHaveLength(1)
    })

    test('over threshold: returns artifact ref, excerpt and paging math; full payload is NOT returned', () => {
        const world = makeAttachmentWorld()
        const content = filler(35000)
        const out = newStore(world).store('run1', 'agent_trace', content)

        expect(out.stored).toBe(true)
        expect(out.artifact_id).toBe('att1')
        expect(out.total_length).toBe(35000)
        expect(out.page_size).toBe(4000)
        expect(out.pages).toBe(9)
        expect(out.excerpt.length).toBeLessThan(2100)
        expect(out.content).toBeUndefined()
        expect(world.attachments[0].content).toBe(content)
    })

    test('the attachment lands on the run record as JSON', () => {
        const world = makeAttachmentWorld()
        newStore(world).store('run1', 'agent_trace', filler(5000))

        expect(world.calls.writes[0].table).toBe('x_snc_troubleshoot_run')
        expect(world.calls.writes[0].contentType).toBe('application/json')
        expect(world.attachments[0].table_sys_id).toBe('run1')
    })

    test('file name is artifact-<seq>-<tool>.json and the sequence increments per run', () => {
        const world = makeAttachmentWorld()
        const store = newStore(world)
        store.store('run1', 'agent_trace', filler(5000))
        store.store('run1', 'agent_config', filler(5000))

        expect(world.calls.writes[0].fileName).toBe('artifact-1-agent_trace.json')
        expect(world.calls.writes[1].fileName).toBe('artifact-2-agent_config.json')
    })

    test('tool names are sanitised into the file name', () => {
        const world = makeAttachmentWorld()
        newStore(world).store('run1', '../../etc/passwd', filler(5000))

        expect(world.calls.writes[0].fileName).toBe('artifact-1-etcpasswd.json')
    })

    test('a missing tool name still produces a usable file name', () => {
        const world = makeAttachmentWorld()
        newStore(world).store('run1', null, filler(5000))

        expect(world.calls.writes[0].fileName).toBe('artifact-1-tool.json')
    })

    test('object content is serialised before measuring', () => {
        const world = makeAttachmentWorld()
        const payload = { success: true, data: { blob: filler(6000) } }
        const out = newStore(world).store('run1', 'agent_trace', payload)

        expect(out.stored).toBe(true)
        expect(world.attachments[0].content).toBe(JSON.stringify(payload))
    })

    test('null and undefined content are treated as empty, not stored', () => {
        const world = makeAttachmentWorld()
        expect(newStore(world).store('run1', 'agent_trace', null).total_length).toBe(0)
        expect(newStore(world).store('run1', 'agent_trace', undefined).stored).toBe(false)
    })

    // --- degradation (the answer to "what if the side-channel breaks") -----

    test('no run id: degrades to an excerpt with a stated reason, never the full payload', () => {
        const world = makeAttachmentWorld()
        const out = newStore(world).store('', 'agent_trace', filler(35000))

        expect(out.stored).toBe(false)
        expect(out.artifact_id).toBeNull()
        expect(out.degraded).toBe('no_run_anchor')
        expect(out.excerpt.length).toBeLessThan(2100)
        expect(out.content).toBeUndefined()
        expect(out.total_length).toBe(35000)
        expect(out.note).toMatch(/read_artifact/)
    })

    test('run record not found: degrades with run_not_found', () => {
        const world = makeAttachmentWorld()
        const out = newStore(world).store('nosuchrun', 'agent_trace', filler(35000))

        expect(out.degraded).toBe('run_not_found')
        expect(out.excerpt).toContain('[elided')
    })

    test('a write that returns nothing degrades rather than claiming success', () => {
        const world = makeAttachmentWorld({ writeReturns: null })
        const out = newStore(world).store('run1', 'agent_trace', filler(35000))

        expect(out.stored).toBe(false)
        expect(out.degraded).toBe('attachment_write_failed')
    })

    test('a throwing write is contained AND the exception object is never touched (R-1)', () => {
        // A cross-scope denial throws ScopeAccessNotGrantedException, and reading
        // `.message` off it throws AGAIN, escaping the handler and 500-ing the
        // request. This poison object fails the test if the code reads .message.
        const poison = {}
        Object.defineProperty(poison, 'message', {
            get: function () {
                throw new Error('Illegal access to getter method getMessage')
            },
        })
        const world = makeAttachmentWorld({ writeThrows: poison })
        const out = newStore(world).store('run1', 'agent_trace', filler(35000))

        expect(out.stored).toBe(false)
        expect(out.degraded).toBe('attachment_write_failed')
        expect(out.excerpt).toContain('[elided')
    })

    test('a missing attachment API degrades instead of throwing', () => {
        const world = makeAttachmentWorld()
        delete world.globals.GlideSysAttachment
        const out = newStore(world).store('run1', 'agent_trace', filler(35000))

        expect(out.degraded).toBe('attachment_api_unavailable')
    })
})

// ---------------------------------------------------------------------------
// read()
// ---------------------------------------------------------------------------

describe('read', () => {
    function seeded(content) {
        const world = makeAttachmentWorld()
        const store = newStore(world)
        const ref = store.store('run1', 'agent_trace', content)
        return { world: world, store: store, ref: ref }
    }

    test('first page returns MAX_PAGE_CHARS from offset 0 and points at the next offset', () => {
        const content = filler(35000)
        const s = seeded(content)
        const out = s.store.read(s.ref.artifact_id, 0, 4000)

        expect(out.success).toBe(true)
        expect(out.data.content).toBe(content.substring(0, 4000))
        expect(out.data.offset).toBe(0)
        expect(out.data.length).toBe(4000)
        expect(out.data.next_offset).toBe(4000)
        expect(out.data.eof).toBe(false)
        expect(out.data.total_length).toBe(35000)
    })

    test('paging through to the end reassembles byte-identical content', () => {
        const content = filler(35000)
        const s = seeded(content)

        let assembled = ''
        let offset = 0
        let guard = 0
        for (;;) {
            const page = s.store.read(s.ref.artifact_id, offset, 4000)
            expect(page.success).toBe(true)
            assembled += page.data.content
            if (page.data.eof) break
            offset = page.data.next_offset
            if (++guard > 50) throw new Error('paging did not terminate')
        }

        expect(assembled).toBe(content)
        expect(guard + 1).toBe(s.ref.pages)
    })

    test('the last page is short, flags eof and has a null next_offset', () => {
        const s = seeded(filler(35000))
        const out = s.store.read(s.ref.artifact_id, 32000, 4000)

        expect(out.data.length).toBe(3000)
        expect(out.data.eof).toBe(true)
        expect(out.data.next_offset).toBeNull()
    })

    test('an offset past the end returns empty content at eof, not an error', () => {
        const s = seeded(filler(35000))
        const out = s.store.read(s.ref.artifact_id, 99999, 4000)

        expect(out.success).toBe(true)
        expect(out.data.content).toBe('')
        expect(out.data.eof).toBe(true)
    })

    test('length is clamped to the page ceiling', () => {
        const s = seeded(filler(35000))
        expect(s.store.read(s.ref.artifact_id, 0, 999999).data.length).toBe(4000)
    })

    test('missing, zero and negative length fall back to the page ceiling', () => {
        const s = seeded(filler(35000))
        expect(s.store.read(s.ref.artifact_id).data.length).toBe(4000)
        expect(s.store.read(s.ref.artifact_id, 0, 0).data.length).toBe(4000)
        expect(s.store.read(s.ref.artifact_id, 0, -10).data.length).toBe(4000)
    })

    test('a negative offset is clamped to 0', () => {
        const content = filler(35000)
        const s = seeded(content)
        const out = s.store.read(s.ref.artifact_id, -50, 100)

        expect(out.data.offset).toBe(0)
        expect(out.data.content).toBe(content.substring(0, 100))
    })

    test('numeric strings are accepted for offset and length (R-9: inputs arrive as strings)', () => {
        const content = filler(35000)
        const s = seeded(content)
        const out = s.store.read(s.ref.artifact_id, '1500', '250')

        expect(out.data.offset).toBe(1500)
        expect(out.data.content).toBe(content.substring(1500, 1750))
    })

    test('junk offset/length degrade to sane defaults rather than NaN slices', () => {
        const s = seeded(filler(35000))
        const out = s.store.read(s.ref.artifact_id, 'banana', 'pear')

        expect(out.success).toBe(true)
        expect(out.data.offset).toBe(0)
        expect(out.data.length).toBe(4000)
    })

    test('a missing artifact id is a structured error, not a throw', () => {
        const s = seeded(filler(5000))
        expect(s.store.read('').success).toBe(false)
        expect(s.store.read(null).error).toMatch(/artifact_id/)
    })

    test('an unknown artifact id reports that it may not exist OR may be denied', () => {
        const s = seeded(filler(5000))
        const out = s.store.read('nope')

        expect(out.success).toBe(false)
        expect(out.error).toMatch(/ACL|denied|exist/i)
    })

    test('an attachment on a foreign table is refused', () => {
        // read_artifact is exposed to an LLM with a caller-supplied sys_id. It
        // must not become a generic "read any attachment on the instance" tool.
        const world = makeAttachmentWorld({
            attachments: [
                {
                    sys_id: 'foreign1',
                    table_name: 'incident',
                    table_sys_id: 'inc1',
                    file_name: 'salary.xlsx',
                    content: 'confidential',
                },
            ],
        })
        const out = newStore(world).read('foreign1')

        expect(out.success).toBe(false)
        expect(out.error).toMatch(/x_snc_troubleshoot_run/)
        expect(JSON.stringify(out)).not.toContain('confidential')
    })

    test('a throwing getContent is contained without touching the exception (R-1)', () => {
        const poison = {}
        Object.defineProperty(poison, 'message', {
            get: function () {
                throw new Error('Illegal access to getter method getMessage')
            },
        })
        const world = makeAttachmentWorld({
            attachments: [
                {
                    sys_id: 'att1',
                    table_name: 'x_snc_troubleshoot_run',
                    table_sys_id: 'run1',
                    file_name: 'artifact-1-agent_trace.json',
                    content: 'x',
                },
            ],
            getContentThrows: poison,
        })
        const out = newStore(world).read('att1')

        expect(out.success).toBe(false)
        expect(out.error).toMatch(/could not be read/i)
    })
})

// ---------------------------------------------------------------------------
// applyThreshold() — the shape PaScriptToolAdapter calls (LLD §4.7)
// ---------------------------------------------------------------------------

describe('applyThreshold', () => {
    test('a small result is returned by identity, untouched', () => {
        const world = makeAttachmentWorld()
        const result = { success: true, data: { steps: [1, 2, 3] } }
        const out = newStore(world).applyThreshold('run1', result, 'agent_trace')

        expect(out).toBe(result)
        expect(world.calls.writes).toHaveLength(0)
    })

    test('a large result is replaced by an excerpt + artifact ref, carrying success', () => {
        const world = makeAttachmentWorld()
        const result = { success: true, data: { blob: filler(35000) } }
        const out = newStore(world).applyThreshold('run1', result, 'agent_trace')

        expect(out.success).toBe(true)
        expect(out.truncated).toBe(true)
        expect(out.artifact_id).toBe('att1')
        expect(out.excerpt).toContain('[elided')
        expect(out.pages).toBeGreaterThan(1)
        expect(out.note).toMatch(/read_artifact/)
        expect(JSON.stringify(out).length).toBeLessThan(4000)
    })

    test('a failing result stays failed after truncation', () => {
        const world = makeAttachmentWorld()
        const out = newStore(world).applyThreshold(
            'run1',
            { success: false, error: filler(35000) },
            'agent_trace'
        )

        expect(out.success).toBe(false)
        expect(out.truncated).toBe(true)
    })

    test('a large bare string is handled too (tool cores may return strings)', () => {
        const world = makeAttachmentWorld()
        const out = newStore(world).applyThreshold('run1', filler(35000), 'agent_trace')

        expect(out.truncated).toBe(true)
        expect(out.artifact_id).toBe('att1')
    })

    test('degradation is carried through to the caller', () => {
        const world = makeAttachmentWorld({ writeReturns: null })
        const out = newStore(world).applyThreshold('run1', { success: true, data: filler(35000) })

        expect(out.truncated).toBe(true)
        expect(out.artifact_id).toBeNull()
        expect(out.degraded).toBe('attachment_write_failed')
        expect(out.note).toMatch(/not available/i)
    })

    test('a degraded envelope advertises NO paging affordances', () => {
        // The envelope is read by an LLM deciding whether to call read_artifact.
        // A page count next to a null artifact_id is an instruction to make nine
        // calls that cannot succeed — and it contradicts `degraded` and `note`
        // in the same object. Nothing about paging may be stated when paging is
        // impossible. Caught in review of PR #17.
        const world = makeAttachmentWorld({ writeReturns: null })
        const out = newStore(world).applyThreshold('run1', { success: true, data: filler(35000) })

        expect(out.pages).toBeNull()
        expect(out.page_size).toBeNull()
        expect(out.total_length).toBe(out.total_length) // still stated: size is real
    })

    test('every degradation reason produces the same paging-free envelope', () => {
        const cases = [
            ['no_run_anchor', makeAttachmentWorld(), ''],
            ['run_not_found', makeAttachmentWorld(), 'nosuchrun'],
            ['attachment_write_failed', makeAttachmentWorld({ writeReturns: null }), 'run1'],
        ]

        cases.forEach(([reason, world, runId]) => {
            const out = newStore(world).applyThreshold(runId, { success: true, data: filler(35000) })

            expect(out.degraded).toBe(reason)
            expect(out.pages).toBeNull()
            expect(out.page_size).toBeNull()
            expect(out.artifact_id).toBeNull()
        })
    })

    test('a successful store still carries real paging affordances', () => {
        const world = makeAttachmentWorld()
        const out = newStore(world).applyThreshold('run1', { success: true, data: filler(35000) })

        expect(out.degraded).toBeUndefined()
        expect(out.page_size).toBe(4000)
        // Derived, not hardcoded: JSON-escaping the payload's newlines makes the
        // serialised length larger than the raw 35,000 chars.
        expect(out.pages).toBe(Math.ceil(out.total_length / 4000))
        expect(out.pages).toBeGreaterThan(1)
    })
})

// ---------------------------------------------------------------------------
// Constants and overrides
// ---------------------------------------------------------------------------

describe('constants', () => {
    test('defaults match LLD §4.5', () => {
        const store = newStore(makeAttachmentWorld())

        expect(store.THRESHOLD_CHARS).toBe(4000)
        expect(store.EXCERPT_HEAD_CHARS).toBe(1500)
        expect(store.EXCERPT_TAIL_CHARS).toBe(500)
        expect(store.MAX_PAGE_CHARS).toBe(4000)
        expect(store.RUN_TABLE).toBe('x_snc_troubleshoot_run')
    })

    test('an options object overrides them', () => {
        const world = makeAttachmentWorld()
        const store = newStore(world, { thresholdChars: 100, maxPageChars: 50 })

        expect(store.THRESHOLD_CHARS).toBe(100)
        expect(store.store('run1', 'agent_trace', filler(200)).stored).toBe(true)
        expect(store.read('att1', 0, 4000).data.length).toBe(50)
    })

    test('no options at all is fine', () => {
        expect(newStore(makeAttachmentWorld()).THRESHOLD_CHARS).toBe(4000)
    })
})

// ---------------------------------------------------------------------------
// Section-aware excerpts (issue #91).
//
// THE DEFECT THIS REPLACES, measured on gpinst01.
//
// `_truncate` is a blind character-offset slice. For an `agent_trace` result
// that put the REASSURING sections in the retained head and tail — resolution,
// reads, notes, header, evidence_basis, every one of them saying "state
// completed, every read ok" — and elided 16,969 of 18,969 chars in the middle,
// which is where `tool_calls[].response_digest`, `script_errors` and the
// failure signatures live.
//
// Seed 03's entire answer is one of those response digests:
// `{ok:true, matched:false, category:"Hardware", rules_in_table:0}`. Seed 01's
// spec says outright that it exists to stress artifact paging. The excerpt read
// as a clean bill of health for a run that failed, and runs reaching
// `read_artifact` fell 10/10 -> 3/10 -> 0/10 as the excerpt grew richer.
//
// So: the tool declares which of its sections are diagnostic, and the store
// fills the budget in that order. Whole sections only, so the excerpt is
// always valid JSON rather than a chopped string, and every dropped section is
// NAMED — a silently dropped section is the whole reason this issue exists.
// ---------------------------------------------------------------------------
describe('section-aware excerpts (#91)', () => {
    const PRIORITY = ['script_errors', 'header', 'tool_calls', 'task_stats', 'reads', 'task_tree']

    /** An agent_trace-shaped result: small diagnostic sections, huge task_tree. */
    function traceResult() {
        return {
            success: true,
            data: {
                tool: 'PaToolAgentTrace',
                resolution: { mode: 'execution' },
                reads: { sn_aia_execution_plan: 'ok' },
                notes: ['a note'],
                header: { state: 'completed', state_reason: '', failure_signature: [] },
                task_tree: [{ big: filler(6000) }],
                task_stats: { total: 8 },
                tool_calls: [
                    { tool_name: 'lookup_routing_rule', response_digest: '{"ok":true,"matched":false,"rules_in_table":0}' },
                ],
                script_errors: [],
                // Key order mirrors the real PaToolAgentTrace payload: bulky
                // messages and conversation sit AFTER tool_calls, which is
                // what pushes the tool-call digests out of reach of the 500-
                // char tail as well as the 1500-char head. Without these the
                // fixture is not the payload the defect was found in, and the
                // differential test passes for the wrong reason.
                messages: [{ content_digest: filler(1200) }],
                conversation: { messages: [{ text_digest: filler(1200) }] },
                evidence_basis: { plan_rows: 1 },
            },
        }
    }

    function excerptOf(result, priority) {
        const store = newStore(null, { excerptHeadChars: 1500, excerptTailChars: 500 })
        return store.store('', 'agent_trace', result, priority).excerpt
    }

    /** The same payload through the OLD blind path, for a differential check. */
    function blindExcerptOf(result) {
        const store = newStore(null, { excerptHeadChars: 1500, excerptTailChars: 500 })
        return store.store('', 'no_priority_tool', result).excerpt
    }

    it('keeps the answer that blind truncation elided', () => {
        // Differential, not absolute: asserting only that the new excerpt
        // contains the answer would pass even if nothing had changed, because
        // a head/tail slice sometimes catches it by luck. The point is that
        // the blind path LOSES it and the priority path KEEPS it.
        const result = traceResult()
        expect(blindExcerptOf(result)).not.toContain('rules_in_table')
        expect(excerptOf(result, PRIORITY)).toContain('rules_in_table')
    })

    it('drops the bulky low-priority section instead of the diagnostic ones', () => {
        const excerpt = excerptOf(traceResult(), PRIORITY)
        expect(excerpt).not.toContain(filler(6000))
        expect(excerpt).toContain('"header"')
        expect(excerpt).toContain('"tool_calls"')
    })

    it('names every section it dropped — a silent drop is the defect itself', () => {
        const excerpt = excerptOf(traceResult(), PRIORITY)
        expect(excerpt).toMatch(/task_tree/)
        expect(excerpt).toMatch(/omitted|dropped|elided/i)
    })

    it('stays parseable JSON — a chopped string is what it replaces', () => {
        const excerpt = excerptOf(traceResult(), PRIORITY)
        expect(() => JSON.parse(excerpt)).not.toThrow()
    })

    it('a section too large to fit is skipped, not partially serialised', () => {
        // task_tree first in priority, and far too big: it must be skipped
        // whole so the smaller diagnostic sections still land, rather than
        // emitting half an object.
        const excerpt = excerptOf(traceResult(), ['task_tree', 'tool_calls', 'header'])
        expect(() => JSON.parse(excerpt)).not.toThrow()
        expect(excerpt).toContain('lookup_routing_rule')
        expect(excerpt).not.toContain(filler(6000))
    })

    it('carries sections the priority list forgot, after the ones it names', () => {
        // A key absent from the list must not become invisible — that is the
        // same silent-omission failure in a new place.
        const excerpt = excerptOf(traceResult(), ['header'])
        const parsed = JSON.parse(excerpt)
        expect(Object.keys(parsed).length).toBeGreaterThan(1)
    })

    it('falls back to head/tail when no priority is declared', () => {
        const store = newStore(null, { excerptHeadChars: 1500, excerptTailChars: 500 })
        const excerpt = store.store('', 'other_tool', traceResult()).excerpt
        expect(excerpt).toContain('…[elided')
    })

    it('falls back to head/tail when the payload is not an object (R-9)', () => {
        const store = newStore(null, { excerptHeadChars: 1500, excerptTailChars: 500 })
        const excerpt = store.store('', 'agent_trace', filler(9000), PRIORITY).excerpt
        expect(excerpt).toContain('…[elided')
    })

    it('respects the same budget — the envelope is spent better, not grown', () => {
        const excerpt = excerptOf(traceResult(), PRIORITY)
        // 2000 retained + the note naming what was dropped; nowhere near the
        // 4000-char threshold the whole mechanism exists to stay under.
        expect(excerpt.length).toBeLessThan(4000)
    })
})

// ---------------------------------------------------------------------------
// The excerpt states the FACT; the envelope owns the AFFORDANCE (#91 round 1).
//
// The first cut of section-aware excerpting embedded "Read them with
// read_artifact" in the excerpt itself. On the degraded paths — no run anchor,
// run not found, attachment API absent, write failed — `_degraded` returns
// `artifact_id: null` with a note saying in so many words that "paged
// retrieval via read_artifact is not available for it", while the excerpt
// sitting inside the SAME object told the model to go and page. R-19b: a
// status may never contradict the notes next to it.
//
// `applyThreshold` already had this discipline for `pages`/`page_size` — its
// own comment says a page count beside a null artifact_id "reads, to the LLM
// consuming this envelope, as an instruction to make N read_artifact calls
// that cannot succeed". The excerpt reintroduced it one layer down.
//
// Division of labour: the excerpt says WHAT was omitted, always. The envelope
// note says HOW to get it, only when there is something to get.
// ---------------------------------------------------------------------------
describe('a degraded excerpt never promises paging (#91)', () => {
    const PRIORITY = ['header', 'tool_calls', 'task_tree']

    function bulky() {
        return {
            success: true,
            data: { header: { state: 'completed' }, tool_calls: [{ tool_name: 't' }], task_tree: [{ big: filler(6000) }] },
        }
    }

    function degradedResult(world, options) {
        const store = newStore(world, Object.assign({ excerptHeadChars: 1500, excerptTailChars: 500 }, options || {}))
        // No run anchor — the cheapest degrade path, reached before any Glide.
        return store.store('', 'agent_trace', bulky(), PRIORITY)
    }

    it('names the omitted sections even when paging is unavailable', () => {
        const res = degradedResult()
        expect(res.degraded).toBe('no_run_anchor')
        expect(res.excerpt).toContain('task_tree')
    })

    it('does not tell the model to read_artifact when there is no artifact', () => {
        const res = degradedResult()
        expect(res.artifact_id).toBeNull()
        expect(res.excerpt).not.toMatch(/read_artifact/i)
    })

    it('the envelope note still explains the loss — the fact is never dropped', () => {
        const res = degradedResult()
        expect(res.note).toMatch(/not available/i)
        expect(res.note).toMatch(/unseen rather than absent/i)
    })

    it('the degraded note describes the mode that actually ran', () => {
        // "the middle is unreachable" is head/tail language. In section mode
        // what was dropped is a NAMED SET, not a contiguous middle, and the
        // note must not describe a loss the excerpt contradicts.
        expect(degradedResult().note).toMatch(/names the sections it omitted/i)

        const store = newStore(null, { excerptHeadChars: 1500, excerptTailChars: 500 })
        const blind = store.store('', 'no_priority_tool', bulky())
        expect(blind.note).toMatch(/head and tail/i)
    })

    it('the stored path DOES carry the paging instruction, in the note', () => {
        const world = makeAttachmentWorld()
        const store = newStore(world, { excerptHeadChars: 1500, excerptTailChars: 500 })
        const res = store.store('run1', 'agent_trace', bulky(), PRIORITY)

        expect(res.stored).toBe(true)
        expect(res.artifact_id).toBeTruthy()
        // Affordance lives in the note, exactly once, and not in the excerpt.
        expect(res.note).toMatch(/read_artifact/i)
        expect(res.excerpt).not.toMatch(/read_artifact/i)
        // The fact still travels with the excerpt.
        expect(res.excerpt).toContain('task_tree')
    })
})
