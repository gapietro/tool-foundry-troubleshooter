# Persist the inbound request payload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write the `POST /analyze` body onto the run record at creation time and expose it on `GET /runs/{run_id}`, so a diagnostic run's own subject is recoverable from its record.

**Architecture:** Two new columns on `x_snc_troubleshoot_run` (`request` text, `request_truncated` boolean). `PaRestHandlers.analyze()` passes the validated body through to `PaRunManager.createRun()`, which serializes it and writes it in the **same** `update()` that already forces `status:'queued'` — no second write, no change to `PaRunAnchor` or `PaAgentLoop`. Truncation past a named ceiling sets the boolean rather than letting `setValue` clip silently.

**Tech Stack:** ServiceNow SDK 4.9.2 (Fluent DSL, `src/fluent/*.now.ts`), ES5/Rhino Script Includes (`src/server/**/*.js`), Jest 29.7.0 against the in-repo `_glideStub`.

**Spec:** `docs/superpowers/specs/2026-08-04-persist-inbound-request-design.md`
**Issue:** #99
**Branch:** `fix/persist-inbound-request` (already created, spec already committed)

## Global Constraints

- **ES5 only** in `src/server/**` — no `let`/`const`/arrow functions/`Set`/`Map`/`Object.assign`. These files run on Rhino. Tests in `test/**` are ordinary Node and may use modern syntax.
- **R-1: never touch the exception object in a `catch`.** No `e.message`, no `String(e)`, no rethrow. Each handler picks its own reason string. Reading `.message` off a `ScopeAccessNotGrantedException` throws again and 500s the request.
- **R-9: every input may be absent.** A missing `request` param must behave exactly as today.
- **R-10 / "degrade explicitly, never silently."** A clipped body must be flagged. A body that will not serialize must be recorded as absent, never as a partial.
- **R-19b: never hand a caller a claim the row would contradict.** A failed write is reported in the returned `note`.
- **Build Rule #43:** no `\n`, `\t`, `\\`, `${...}` or backticks inside a Fluent `` script`…` `` template. This plan touches no script templates, but `tables.now.ts` edits must stay inside ordinary object literals and `//` comments.
- **Every `.now.ts` already starts with** `import '@servicenow/sdk/global'` — do not add or remove that line.
- **`now-sdk build` must succeed before `now-sdk install`.**
- **Never commit to `main`.** All work stays on `fix/persist-inbound-request`; integration is by PR.
- **Named constant:** `REQUEST_CHARS: 60000`, against a column `maxLength` of `65536`.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/fluent/tables.now.ts` | Table schema | Modify — two columns on `x_snc_troubleshoot_run` |
| `src/server/PaRunManager.js` | Run lifecycle; owns the run table's write contract | Modify — `REQUEST_CHARS`, `_serializeRequest`, `_requestFields`, `_forceFields`, `createRun` |
| `src/server/rest/PaRestHandlers.js` | REST surface | Modify — `analyze` passes the body; `_defaultReadRun` projects the columns; `getRun` exposes them |
| `test/PaRunManager.test.js` | Manager unit tests | Modify — new `createRun — request persistence` describe block |
| `test/PaRestHandlers.test.js` | REST unit tests | Modify — write-path assertions and a new `getRun request` describe block |
| `CHANGELOG.md`, `package.json`, `README.md` | Release bookkeeping | Modify — version `2026.08.0402` |

Serialization and truncation live in `PaRunManager` because it owns the run table's write contract; `PaRestHandlers` only forwards an object. That is why `analyze()` does not reuse its own `_safeStringify` for this — the column's ceiling is not the REST layer's business.

---

### Task 1: Schema — the two columns

**Files:**
- Modify: `src/fluent/tables.now.ts:150-153` (insert immediately after the `execution_ref` column)

**Interfaces:**
- Consumes: nothing
- Produces: columns `request` (string, 65536) and `request_truncated` (boolean, default false) on `x_snc_troubleshoot_run`. Tasks 2 and 4 write and read these exact names.

- [ ] **Step 1: Add the columns**

In `src/fluent/tables.now.ts`, find the `execution_ref` column inside `x_snc_troubleshoot_run`'s `schema`:

```ts
        execution_ref: StringColumn({
            label: 'Execution Plan',
            maxLength: 32,
        }),
```

Insert directly after its closing `}),` — before the `// THE ANCHOR KEY` comment block:

```ts
        // THE RUN'S SUBJECT (issue #99).
        //
        // The inbound POST /analyze body, verbatim, written by
        // PaRunManager.createRun. Before this existed, a run recorded only
        // what the model DERIVED from the request (tool arguments in the
        // audit table) and never the request itself — so a later benchmark
        // pass could not prove it had asked the same question as an earlier
        // one, and no run was reproducible from its own record.
        //
        // Empty on every native run by construction: PaRunAnchor keys on
        // `_agentic_context_` and there is no inbound body on that path.
        // Empty is the honest value there, not a gap to fill later.
        request: MultiLineTextColumn({
            label: 'Request',
            maxLength: 65536,
        }),

        // Set when the body exceeded PaRunManager.REQUEST_CHARS and the
        // stored text is a PREFIX. A separate flag rather than a JSON
        // envelope: a clipped body is not parseable JSON, so an envelope
        // would have to hold it as an escaped string, and escaping a log
        // paste can nearly double its length against a fixed ceiling.
        //
        // Three states, all distinguishable from the row alone:
        //   request non-empty + false -> whole body, JSON.parse is valid
        //   request non-empty + true  -> a prefix; documentation, not data
        //   request empty     + false -> absent (native run, or a body that
        //                                would not serialize)
        // Absent and truncated must never collapse into one state.
        request_truncated: BooleanColumn({
            label: 'Request Truncated',
            default: false,
        }),
```

`MultiLineTextColumn` and `BooleanColumn` are both already imported at the top of the file — do not add imports.

- [ ] **Step 2: Verify the build accepts the schema**

Run: `now-sdk build`
Expected: succeeds with no errors. If it reports an unknown column constructor, confirm the import list at the top of `tables.now.ts` (around line 68) contains both `MultiLineTextColumn` and `BooleanColumn`.

- [ ] **Step 3: Commit**

```bash
git add src/fluent/tables.now.ts
git commit -m "feat: request + request_truncated columns on the run table (#99)"
```

---

### Task 2: `PaRunManager.createRun` persists the request

**Files:**
- Modify: `src/server/PaRunManager.js` — constants block (near `:130`), `createRun` (`:224-251`), `_forceStatus` (`:834-838`), helpers section (near `:928`)
- Test: `test/PaRunManager.test.js` — new describe block after the existing `createRun` block (which ends at `:231`)

**Interfaces:**
- Consumes: the columns from Task 1.
- Produces:
  - `createRun(params)` accepts a new optional `params.request` — any value; an object or string is expected, anything else is treated as absent.
  - `PaRunManager.REQUEST_CHARS === 60000`
  - `_serializeRequest(request) -> String` (`''` when absent or unserializable)
  - `_requestFields(request) -> {request: String, request_truncated: Boolean} | null`
  - `_forceFields(runId, fields) -> Boolean`
  - Task 3 calls `createRun({agent, executionRef, mode, request})`.

- [ ] **Step 1: Write the failing tests**

Append this describe block to `test/PaRunManager.test.js`, immediately after the closing `})` of the existing `describe('createRun', ...)` block (currently ends at line 231, just before the `appendTranscript` banner comment):

```javascript
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
        expect(row.request_truncated).toBe(false)
    })

    test('a string body is stored as-is, without a second round of JSON quoting', () => {
        const { row } = createWith('why did the agent stop')

        expect(row.request).toBe('why did the agent stop')
        expect(row.request_truncated).toBe(false)
    })

    test('the request lands in the SAME update that forces status:queued — one write, not two', () => {
        const { row } = createWith({ execution: 'plan1' })

        expect(row.status).toBe('queued')
        expect(row.request).toBeTruthy()
    })

    test('an oversize body is clipped at REQUEST_CHARS AND flagged — never silently', () => {
        const { row, mgr } = createWith({ logs: new Array(80000).join('x') })

        expect(row.request.length).toBe(mgr.REQUEST_CHARS)
        expect(row.request_truncated).toBe(true)
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
        expect(world.tables[RUN_TABLE][0].request_truncated).toBe(false)
    })

    test('a body that will not serialize is recorded ABSENT, not partial — the two states stay distinct', () => {
        const circular = { execution: 'plan1' }
        circular.self = circular

        const { row } = createWith(circular)

        expect(row.request).toBe('')
        expect(row.request_truncated).toBe(false)
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaRunManager.test.js -t "request persistence"`
Expected: FAIL. The first tests fail because `row.request` is `undefined`; the `REQUEST_CHARS` tests fail because `mgr.REQUEST_CHARS` is `undefined`.

- [ ] **Step 3: Add the `REQUEST_CHARS` constant**

In `src/server/PaRunManager.js`, in the constants block, immediately after `PROMPT_WINDOW: 3,` (around line 164), add:

```javascript
    /** Ceiling for the persisted inbound request (issue #99). Derived from
     *  the `request` column's own maxLength of 65536 with headroom, the same
     *  way PaRestHandlers.STUCK_RUN_BUDGET_MS is derived from PaAgentLoop's
     *  BUDGET_MS rather than independently guessed. The column holds the JSON
     *  text directly, so no escaping expansion sits between this constant and
     *  the column limit; the margin is slack against a future column resize
     *  being made without revisiting this number. Past it, the stored text is
     *  a PREFIX and `request_truncated` says so — see _requestFields. */
    REQUEST_CHARS: 60000,
```

- [ ] **Step 4: Add the serialization helpers**

In the same file, in the small-helpers section, immediately **before** `_stringifyForDigest` (around line 928), add:

```javascript
    /**
     * The inbound request as text, for the `request` column.
     *
     * DELIBERATELY NOT `_stringifyForDigest`: that helper falls back to
     * `String(value)` on a circular structure, which would store
     * `[object Object]` and read as a real (if useless) request. Here an
     * unserializable body must be ABSENT, so the empty/truncated states
     * stay distinguishable from the row alone (issue #99).
     *
     * @param {*} request
     * @returns {String} '' when absent, unserializable, or not an
     *          object/string.
     */
    _serializeRequest: function (request) {
        if (request === null || request === undefined) return ''
        if (typeof request === 'string') return request
        if (typeof request !== 'object') return ''
        try {
            var json = JSON.stringify(request)
            return typeof json === 'string' ? json : ''
        } catch (e) {
            // R-1: `e` untouched. A circular body lands here and is
            // recorded as absent rather than as a String() coercion.
            return ''
        }
    },

    /**
     * @param {*} request
     * @returns {Object|null} {request, request_truncated} to merge into the
     *          creation write, or null when there is nothing to store — in
     *          which case neither column is written at all, so a native run
     *          keeps whatever the anchor left there.
     */
    _requestFields: function (request) {
        var text = this._serializeRequest(request)
        if (!text) return null
        if (text.length <= this.REQUEST_CHARS) {
            return { request: text, request_truncated: false }
        }
        return { request: text.substring(0, this.REQUEST_CHARS), request_truncated: true }
    },
```

- [ ] **Step 5: Widen `_forceStatus` into `_forceFields`**

Replace the existing `_forceStatus` (around line 834):

```javascript
    /** Forces a fresh row's status right after creation — see the file
     *  header's note on why this is a direct write, not an anchor param. */
    _forceStatus: function (runId, status) {
        var gr = this._getRun(runId)
        if (!gr) return false
        return this._writeUpdate(gr, { status: status })
    },
```

with:

```javascript
    /** Forces fields onto a fresh row right after creation — see the file
     *  header's note on why this is a direct write, not an anchor param.
     *  Carries the request columns alongside `status` (issue #99) so
     *  creation stays ONE update, not two. */
    _forceFields: function (runId, fields) {
        var gr = this._getRun(runId)
        if (!gr) return false
        return this._writeUpdate(gr, fields)
    },
```

`_forceStatus` has exactly one caller (`createRun`, rewritten in the next step) and no test references it, so it is replaced rather than kept as a delegate.

- [ ] **Step 6: Rewrite the write in `createRun`**

In `createRun` (around line 224), change the JSDoc `@param` line from:

```javascript
     * @param {Object} [params] {user, agent, executionRef, mode} — all
```

to:

```javascript
     * @param {Object} [params] {user, agent, executionRef, mode, request} —
     *        all
```

and add after the existing `user` note in that JSDoc block:

```javascript
     *        `request` is the inbound POST /analyze body (issue #99),
     *        stored verbatim on the row. It is NEVER forwarded to the
     *        anchor — the anchor keys identity, and the request is subject
     *        matter, not identity.
```

Then replace this block:

```javascript
        var out = { run_id: created.run_id, number: created.number || '' }
        if (!this._forceStatus(created.run_id, 'queued')) {
            out.note =
                'The run record was created but its status could not be forced to queued — ' +
                'it may still read as running until the next successful write. The run_id is real ' +
                'and usable regardless.'
        }

        return out
```

with:

```javascript
        var out = { run_id: created.run_id, number: created.number || '' }

        // ONE update, not two: the request columns ride along with the
        // status force that already happens here (issue #99).
        var fields = { status: 'queued' }
        var requestFields = this._requestFields(p.request)
        if (requestFields) {
            fields.request = requestFields.request
            fields.request_truncated = requestFields.request_truncated
        }

        if (!this._forceFields(created.run_id, fields)) {
            out.note =
                'The run record was created but its status could not be forced to queued — ' +
                'it may still read as running until the next successful write. The run_id is real ' +
                'and usable regardless.'
            // R-19b: the same write carried the request, so a caller told
            // only about the status would still be told something the row
            // contradicts.
            if (requestFields) {
                out.note += ' The inbound request was not persisted either, for the same reason.'
            }
        }

        return out
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest test/PaRunManager.test.js`
Expected: PASS — the new block and every pre-existing `createRun` test, including `a run_id is still returned when forcing status:queued fails`.

- [ ] **Step 8: Fix the stale comment in the pre-existing test**

In `test/PaRunManager.test.js` around line 210, change `createRun used to ignore _forceStatus's result` to `createRun used to ignore the creation write's result` — `_forceStatus` no longer exists.

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions in any other file.

- [ ] **Step 10: Commit**

```bash
git add src/server/PaRunManager.js test/PaRunManager.test.js
git commit -m "feat: createRun persists the inbound request, in the creation write (#99)"
```

---

### Task 3: `analyze` passes the body through

**Files:**
- Modify: `src/server/rest/PaRestHandlers.js:151-155`
- Test: `test/PaRestHandlers.test.js` — extend the existing `analyze — collect mode` and `analyze — diagnose mode (default)` describe blocks (`:160` and `:184`)

**Interfaces:**
- Consumes: `createRun({agent, executionRef, mode, request})` from Task 2.
- Produces: nothing new — Task 4 reads from the row, not from this call.

- [ ] **Step 1: Write the failing tests**

`fakeRunManager()` records every `createRun` argument in its own `calls.createRun` array (`test/PaRestHandlers.test.js:41-48`). Note the wiring: `load()` returns `{handlers, ctx}` — the fake is constructed locally and injected, exactly as the existing tests at `:129-134` do. Add these two tests — the first inside `describe('analyze — diagnose mode (default)', ...)`, the second inside `describe('analyze — collect mode', ...)`:

```javascript
    test('the validated body reaches createRun so the run records its own subject (#99)', () => {
        const runManager = fakeRunManager()
        const { handlers } = load({ runManager: runManager, eventQueue: () => true })

        handlers.analyze({
            body: { execution: 'plan1', timeframe: '1 hour' },
            pathParams: {},
            userId: 'u1',
        })

        expect(runManager.calls.createRun[0].request).toEqual({
            execution: 'plan1',
            timeframe: '1 hour',
        })
    })
```

```javascript
    test('collect mode records its request too — it never queues, so nothing downstream would (#99)', () => {
        const runManager = fakeRunManager()
        const { handlers } = load({ runManager: runManager, eventQueue: () => true })

        handlers.analyze({
            body: { execution: 'plan1', mode: 'collect' },
            pathParams: {},
            userId: 'u1',
        })

        expect(runManager.calls.createRun[0].request).toEqual({
            execution: 'plan1',
            mode: 'collect',
        })
    })
```

And add this one to `describe('analyze — validation', ...)`:

```javascript
    test('a rejected body creates no run, so nothing is persisted', () => {
        const runManager = fakeRunManager()
        const { handlers } = load({ runManager: runManager, eventQueue: () => true })

        const res = handlers.analyze({ body: { agent: 'Agent Doctor' }, pathParams: {}, userId: 'u1' })

        expect(res.status).toBe(400)
        expect(runManager.calls.createRun.length).toBe(0)
    })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaRestHandlers.test.js -t "#99"`
Expected: FAIL — `runManager.calls.createRun[0].request` is `undefined`. (The validation test may already pass; that is fine, it is a regression guard.)

- [ ] **Step 3: Pass the body through**

In `src/server/rest/PaRestHandlers.js`, in `analyze` (line 151), change:

```javascript
        var created = this._runs().createRun({
            agent: body.agent,
            executionRef: body.execution,
            mode: validation.mode,
        })
```

to:

```javascript
        var created = this._runs().createRun({
            agent: body.agent,
            executionRef: body.execution,
            mode: validation.mode,
            // The whole validated body, so the run records its own subject
            // (issue #99). Passed as an object, not a string: PaRunManager
            // owns the run table's write contract and with it the column's
            // ceiling and truncation flag. Deliberately NOT reusing
            // `_queueDiagnose`'s `_safeStringify` result — that one exists
            // for the event payload and has no ceiling.
            request: body,
        })
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaRestHandlers.test.js`
Expected: PASS, including every pre-existing analyze test.

- [ ] **Step 5: Commit**

```bash
git add src/server/rest/PaRestHandlers.js test/PaRestHandlers.test.js
git commit -m "feat: analyze passes the validated body to createRun (#99)"
```

---

### Task 4: `getRun` exposes the request

**Files:**
- Modify: `src/server/rest/PaRestHandlers.js:271-280` (`getRun` body), `:696-716` (`_defaultReadRun`), helpers section near `:836`
- Test: `test/PaRestHandlers.test.js` — new describe block after `describe('getRun fix_report_rejected', ...)` (ends at `:391`)

**Interfaces:**
- Consumes: the columns from Task 1, written by Task 2.
- Produces: `getRun` response body gains `request` (parsed object when whole, raw prefix string when truncated, `null` when absent) and `request_truncated` (always a boolean). New helper `_toBool(value) -> Boolean`.

- [ ] **Step 1: Write the failing tests**

Add this describe block to `test/PaRestHandlers.test.js` immediately after the closing `})` of `describe('getRun fix_report_rejected', ...)`:

```javascript
// ===========================================================================
// getRun — the persisted request (#99)
// ===========================================================================

describe('getRun request', () => {
    function runRow(overrides) {
        return Object.assign(
            {
                run_id: 'run1',
                number: 'TR0001042',
                user: 'u1',
                status: 'complete',
                mode: 'diagnose',
                transcript: [],
                context_summary: '',
                fix_report: '{}',
                error: '',
                request: '{"execution":"plan1","timeframe":"1 hour"}',
                request_truncated: false,
            },
            overrides
        )
    }

    function getRunFor(overrides) {
        const { handlers } = load({ readRun: fakeReadRun(runRow(overrides)) })
        return handlers.getRun({ pathParams: { run_id: 'run1' }, userId: 'u1' })
    }

    test('a whole request comes back parsed, so a consumer reads the run subject directly', () => {
        const res = getRunFor({})

        expect(res.status).toBe(200)
        expect(res.body.request).toEqual({ execution: 'plan1', timeframe: '1 hour' })
        expect(res.body.request_truncated).toBe(false)
    })

    test('a truncated request comes back as the RAW prefix, never as a half-parsed object', () => {
        const res = getRunFor({ request: '{"logs":"xxxxx', request_truncated: true })

        expect(res.body.request).toBe('{"logs":"xxxxx')
        expect(res.body.request_truncated).toBe(true)
    })

    test('an absent request is null, and the flag is still a boolean', () => {
        const res = getRunFor({ request: '', request_truncated: false })

        expect(res.body.request).toBeNull()
        expect(res.body.request_truncated).toBe(false)
    })

    test('an unparseable stored request is returned raw rather than dropped', () => {
        const res = getRunFor({ request: 'not json at all' })

        expect(res.body.request).toBe('not json at all')
    })

    test('a row from before this column existed does not produce undefined fields', () => {
        const { handlers } = load({
            readRun: fakeReadRun({
                run_id: 'run1',
                number: 'TR0001042',
                user: 'u1',
                status: 'complete',
                mode: 'diagnose',
                transcript: [],
                context_summary: '',
                fix_report: '{}',
                error: '',
            }),
        })

        const res = handlers.getRun({ pathParams: { run_id: 'run1' }, userId: 'u1' })

        expect(res.body.request).toBeNull()
        expect(res.body.request_truncated).toBe(false)
    })
})

// ===========================================================================
// _toBool — the platform's boolean getValue contract (#99)
// ===========================================================================

describe('_toBool', () => {
    test("ServiceNow's '0'/'1' getValue strings map to real booleans", () => {
        const { handlers } = load()

        expect(handlers._toBool('1')).toBe(true)
        expect(handlers._toBool('0')).toBe(false)
    })

    test("'true'/'false' strings and real booleans map too", () => {
        const { handlers } = load()

        expect(handlers._toBool('true')).toBe(true)
        expect(handlers._toBool('false')).toBe(false)
        expect(handlers._toBool(true)).toBe(true)
        expect(handlers._toBool(false)).toBe(false)
    })

    test('absent, empty and junk are all false, never undefined', () => {
        const { handlers } = load()

        expect(handlers._toBool(undefined)).toBe(false)
        expect(handlers._toBool(null)).toBe(false)
        expect(handlers._toBool('')).toBe(false)
        expect(handlers._toBool('yes')).toBe(false)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaRestHandlers.test.js -t "getRun request"`
Expected: FAIL — `res.body.request` is `undefined`.

Run: `npx jest test/PaRestHandlers.test.js -t "_toBool"`
Expected: FAIL with `handlers._toBool is not a function`.

- [ ] **Step 3: Add the helpers**

In `src/server/rest/PaRestHandlers.js`, immediately before `_nonEmptyString` (around line 836), add:

```javascript
    /**
     * A ServiceNow boolean column reads back through `getValue` as the
     * STRING '0' or '1', not as a boolean — so a bare truthiness test on it
     * makes '0' true. Real booleans arrive from the injected `readRun` seam
     * in tests and from any in-process caller, so both shapes are handled.
     *
     * @returns {Boolean} always a boolean — junk and absence are false.
     */
    _toBool: function (value) {
        if (value === true) return true
        if (typeof value === 'string') return value === '1' || value === 'true'
        return false
    },

    /**
     * The persisted inbound request, for the `getRun` body (issue #99).
     *
     * @returns {Object|String|null} the parsed body when it is whole, the
     *          RAW prefix string when `request_truncated` is set (a clipped
     *          body is not parseable and must never be presented as though
     *          it were), the raw string when it is whole but unparseable
     *          (returned rather than dropped — losing it is the defect this
     *          change exists to fix), and null when absent.
     */
    _requestBody: function (run) {
        if (!this._nonEmptyString(run.request)) return null
        if (this._toBool(run.request_truncated)) return run.request
        var parsed = this._parseJsonSafe(run.request)
        return parsed === null ? run.request : parsed
    },
```

- [ ] **Step 4: Expose the fields in `getRun`**

In `getRun` (around line 271), change:

```javascript
        var body = {
            run_id: run.run_id,
            number: run.number,
            status: run.status,
            mode: run.mode,
            transcript: this._isArray(run.transcript) ? run.transcript : [],
            context_summary: run.context_summary || '',
            error: run.error || '',
            fix_report: run.status === 'complete' ? this._parseJsonSafe(run.fix_report) : null,
        }
```

to:

```javascript
        var body = {
            run_id: run.run_id,
            number: run.number,
            status: run.status,
            mode: run.mode,
            transcript: this._isArray(run.transcript) ? run.transcript : [],
            context_summary: run.context_summary || '',
            error: run.error || '',
            fix_report: run.status === 'complete' ? this._parseJsonSafe(run.fix_report) : null,
            // The run's own subject (issue #99). Persisting it without
            // exposing it would repeat the #78 shape — the data in the row,
            // and every API consumer still reading the table by hand.
            request: this._requestBody(run),
            request_truncated: this._toBool(run.request_truncated),
        }
```

- [ ] **Step 5: Project the columns in `_defaultReadRun`**

In `_defaultReadRun` (around line 696), the returned object is an **explicit projection** — a column absent from it is invisible to `getRun` no matter what the row holds. Add the two fields after `error`:

```javascript
                error: gr.getValue('error') || '',
                request: gr.getValue('request') || '',
                request_truncated: this._toBool(gr.getValue('request_truncated')),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest test/PaRestHandlers.test.js`
Expected: PASS.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/server/rest/PaRestHandlers.js test/PaRestHandlers.test.js
git commit -m "feat: getRun exposes the persisted request (#99)"
```

---

### Task 5: Live verification, release bookkeeping, PR

**Files:**
- Modify: `package.json` (version), `README.md` (version badge), `CHANGELOG.md` (new top entry)

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: the merged change.

Spec §9 requires this task. R-8 — "a stub is not evidence about platform behaviour" — means the Jest suite settles the arithmetic and nothing else; the column write itself has to be seen on gpinst01.

- [ ] **Step 1: Build**

Run: `now-sdk build`
Expected: succeeds.

- [ ] **Step 2: Install to gpinst01**

Run: `now-sdk install --alias gpinst01`
Expected: succeeds.

- [ ] **Step 3: Verify the columns exist on the instance**

Use the foundry MCP tools, never the shell — `servicenow_connect` (`authType="keychain"`, instance `gpinst01`), then `servicenow_query` on `sys_dictionary` with `name=x_snc_troubleshoot_run^elementSTARTSWITHrequest`.
Expected: two rows — `request` (`max_length` 65536) and `request_truncated` (type `boolean`).

- [ ] **Step 4: Round-trip a real request**

`servicenow_request`: `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze` with body `{"execution":"<any sys_id>","timeframe":"1 hour"}`, then `GET /api/x_snc_troubleshoot/v1/troubleshooter/runs/<run_id>` from the 202 response.
Expected: the `GET` body's `request` field equals the body that was sent, and `request_truncated` is `false`.

- [ ] **Step 5: Verify collect mode too**

`servicenow_request`: `POST .../analyze` with `{"execution":"<any sys_id>","mode":"collect"}` — this path returns 200 inline and never queues.
Expected: `servicenow_query` on `x_snc_troubleshoot_run` for the returned `run_id` shows a populated `request` column. This is the path a worker-side write would have missed, so it is verified separately rather than assumed.

- [ ] **Step 6: Bump the version**

`package.json`: `"version": "2026.08.0402"`. `README.md`: update the version badge to the same string. Format is `YYYY.MM.DDXX` — 2026, August, day 04, second merge of the day.

- [ ] **Step 7: Write the CHANGELOG entry**

Add a new top section to `CHANGELOG.md`, above `## 2026.08.0401`, following that entry's house style — `### Added` for the columns and the API field, `### Measured` **only** for what step 3-5 actually observed on the instance. Do not write a `### Measured` claim that the live steps did not produce.

- [ ] **Step 8: Commit and push**

```bash
git add package.json README.md CHANGELOG.md
git commit -m "chore: version 2026.08.0402 + changelog for the persisted request (#99)"
git push -u origin fix/persist-inbound-request
```

- [ ] **Step 9: Open the PR**

```bash
gh pr create --title "Persist the inbound request payload (#99)" --body "Closes #99. See docs/superpowers/specs/2026-08-04-persist-inbound-request-design.md."
```

Include the live evidence from steps 3-5 in the PR body — the round-tripped request, verbatim.

---

## Self-Review

**Spec coverage:** §3 data flow → Tasks 2-3. §3.1 rejected alternatives → recorded in the spec and in the Task 3 comment explaining why `_safeStringify` is not reused. §4 schema → Task 1. §5 truncation contract, all three states → Task 2 steps 3-4 and its boundary/circular/absent tests. §6 read surface → Task 4, including the `_defaultReadRun` projection the spec did not name (a real gap: without it `getRun` would return `undefined` on the instance while every unit test passed against the injected seam). §7 non-goals → no task, correctly: native emptiness and the no-backfill decision are things the change must *not* do, and Task 2's "no request param" test guards the first. §8 testing → Tasks 2-4. §9 acceptance → Task 5.

**Placeholder scan:** none — every code step carries the literal text to insert, and every test step carries the assertions.

**Type consistency:** `REQUEST_CHARS`, `_serializeRequest`, `_requestFields`, `_forceFields` (PaRunManager); `_toBool`, `_requestBody` (PaRestHandlers); columns `request`, `request_truncated`. Each name is used identically in the task that defines it and in every task that consumes it. `_forceStatus` is removed in Task 2 step 5 and its one stale test comment is fixed in step 8.
