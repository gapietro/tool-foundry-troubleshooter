# Prompt-Facing Observation Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the custom harness from starving its own model — feed a 4,000-character prompt-facing digest of each recent tool result into the next reasoning prompt, let an honest "I couldn't conclude" Fix Report validate when it cites what it read, then re-run the 10-row benchmark and publish whatever number comes out.

**Architecture:** `PaRunManager` writes a second, larger `prompt_digest` alongside the existing 200-char `result_digest` and prunes it to a rolling window of the newest 3 carriers so the transcript row stays bounded; `PaAgentLoop._renderTranscript` prefers `prompt_digest` when present. Separately, `PaFixReport` accepts empty `root_causes`/`fixes` only when the report carries a valid `inconclusive` block citing evidence actually read. Nothing else in the loop changes.

**Tech Stack:** ES5/Rhino-safe ServiceNow Script Includes (`src/server/*.js`), Fluent DSL (`src/fluent/*.now.ts`), Jest with the repo's `_glideStub` writable world, ServiceNow SDK 4.9.2, deploy target `gpinst01`.

**Spec:** `docs/superpowers/specs/2026-08-02-observation-channel-design.md`
**Issue:** [#72](https://github.com/gapietro/tool-foundry-troubleshooter/issues/72) (bundles T4 and T6)
**Branch:** `fix/phase1b-observation-channel` (already created, spec already committed as `f4edd75`)

## Global Constraints

- **ES5 / Rhino only** in `src/server/*.js` — `var` not `let`/`const`, no arrow functions, no `Set`/`Map`, no template literals, no `Object.assign`. Test files are Node/Jest and may use modern syntax.
- **Standing rule R-1:** never inspect the exception object in a `catch`. Every catch names its own reason and moves on.
- **Standing rule R-9:** every input may be absent — degrade explicitly, never throw.
- **Standing rule R-19b:** a status must not contradict the notes sitting next to it.
- **Build Rule #43:** escape sequences and backticks inside a Fluent `` script`…` `` template are consumed by TypeScript. The one Fluent edit in this plan (Task 4) is to a top-level `//` comment **outside** any script template — verified — so it is safe, but do not add backticks or `\n` escapes to it anyway.
- **Never commit to `main`.** All work on `fix/phase1b-observation-channel`, merged via PR.
- **Version format `YYYY.MM.DDXX`.** Current is `2026.08.0216`; this work bumps to `2026.08.0217` in both `package.json` and the README badge, with a `CHANGELOG.md` entry.
- **Do not edit** `docs/agent/agent-doctor-instructions.md` or any playbook text. Playbook v2 was already in effect for all ten benchmark rows; editing it would confound the one variable under test.
- **`npm test` must be green** before any `now-sdk build`.

---

### Task 1: `PaRunManager` — write and window the prompt-facing digest

**Files:**
- Modify: `src/server/PaRunManager.js` (constants near `:125`, `appendTranscript` at `:226-242`, `_normalizeEntry` at `:244-260`, new private helpers near `_digest` at `:830-835`, header CONTRACT block at `:22-24`)
- Test: `test/PaRunManager.test.js` (new `describe` block after the existing `appendTranscript` block, which ends around `:300`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: transcript entries may now carry `prompt_digest: String`. Constants `PaRunManager.PROMPT_DIGEST_CHARS = 4000` and `PaRunManager.PROMPT_WINDOW = 3`. Private helpers `_promptDigest(value) -> String|null` and `_prunePromptWindow(list) -> undefined`. Task 2 reads `entry.prompt_digest`; Tasks 3 and 4 rely on all of it.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaRunManager.test.js`. The existing helpers `load()` (`:81`) and `seedRun()` (`:98`) are already in that file — use them, do not redefine them.

```js
// ===========================================================================
// prompt_digest — the prompt-facing observation channel (issue #72)
// ===========================================================================

describe('prompt_digest', () => {
    test('a long TOOL result gets a prompt_digest at the 4000-char ceiling, while result_digest stays at 200', () => {
        const { mgr, world } = load({ world: { rows: { [RUN_TABLE]: [seedRun()] } } })
        const long = 'z'.repeat(5000)

        mgr.appendTranscript('run1', { actor: 'tool', tool: 'read_artifact', result_digest: long })

        const stored = JSON.parse(world.tables[RUN_TABLE][0].transcript)
        expect(stored[0].result_digest).toContain('...[+4800 more chars]')
        expect(stored[0].result_digest.length).toBeLessThan(300)
        expect(stored[0].prompt_digest).toContain('...[+1000 more chars]')
        expect(stored[0].prompt_digest.substring(0, 4000)).toBe('z'.repeat(4000))
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
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaRunManager.test.js -t "prompt_digest"`
Expected: FAIL — `stored[0].prompt_digest` is `undefined` where a string is expected.

- [ ] **Step 3: Add the two constants**

In `src/server/PaRunManager.js`, immediately after the `DIGEST_CHARS: 200,` declaration (around `:125`):

```js
    /** Prompt-facing ceiling, deliberately equal to
     *  PaArtifactStore.MAX_PAGE_CHARS so exactly ONE read_artifact page
     *  survives into the next reasoning prompt intact (issue #72). DISTINCT
     *  from DIGEST_CHARS, which stays 200 for the polling UI and the audit
     *  row — raising that one globally is what this design deliberately does
     *  NOT do. */
    PROMPT_DIGEST_CHARS: 4000,

    /** How many of the most recent entries CARRYING a prompt_digest keep it.
     *  Older carriers are pruned on append, which is what bounds the
     *  `transcript` column — see the row-size arithmetic in
     *  docs/superpowers/specs/2026-08-02-observation-channel-design.md §4.4. */
    PROMPT_WINDOW: 3,
```

- [ ] **Step 4: Derive `prompt_digest` in `_normalizeEntry`**

In `_normalizeEntry` (`:244-260`), immediately after the existing `result_digest` line:

```js
        if (e.result_digest !== undefined && e.result_digest !== null) out.result_digest = this._digest(e.result_digest)
```

insert:

```js
        // The observation channel (issue #72). DERIVED, never accepted: a
        // caller-supplied `entry.prompt_digest` is ignored exactly like any
        // other unknown key, so the ceiling cannot be forged from the loop
        // side. Tool results only — an `llm` entry is the model's own prior
        // reasoning and a `system` entry is a status note; neither is the
        // evidence channel this fixes, and including them would double the
        // row cost for no diagnostic gain.
        if (out.actor === 'tool' && e.result_digest !== undefined && e.result_digest !== null) {
            var promptText = this._promptDigest(e.result_digest)
            if (promptText !== null) out.prompt_digest = promptText
        }
```

Note `out.actor`, not `e.actor` — an unrecognised actor has already fallen back to `'system'` by this point and must not be treated as a tool.

- [ ] **Step 5: Add the two private helpers**

In `src/server/PaRunManager.js`, directly after `_digest` (`:830-835`):

```js
    /**
     * The prompt-facing digest — same never-silent marker as `_digest`, at
     * PROMPT_DIGEST_CHARS instead of DIGEST_CHARS.
     *
     * @returns {String|null} null when the text already fits inside
     *          DIGEST_CHARS: `result_digest` carries it verbatim in that
     *          case, and a duplicate would be dead bytes in a column with a
     *          hard ceiling.
     */
    _promptDigest: function (value) {
        var s = this._stringifyForDigest(value)
        if (s.length <= this.DIGEST_CHARS) return null
        if (s.length <= this.PROMPT_DIGEST_CHARS) return s
        return (
            s.substring(0, this.PROMPT_DIGEST_CHARS) +
            '...[+' +
            (s.length - this.PROMPT_DIGEST_CHARS) +
            ' more chars]'
        )
    },

    /**
     * Keeps `prompt_digest` on the newest PROMPT_WINDOW entries that CARRY
     * one and deletes it from every older carrier. The window is over
     * carriers, not over tool entries generally — a short tool result that
     * never got a prompt_digest does not consume a slot.
     *
     * The bound on the `transcript` column lives HERE, in the append path,
     * rather than in an assumption about how long the loop runs.
     */
    _prunePromptWindow: function (list) {
        var kept = 0
        for (var i = list.length - 1; i >= 0; i--) {
            var entry = list[i]
            if (!this._isPlainObject(entry) || entry.prompt_digest === undefined) continue
            kept += 1
            if (kept > this.PROMPT_WINDOW) delete entry.prompt_digest
        }
    },
```

- [ ] **Step 6: Call the pruner from `appendTranscript`**

In `appendTranscript` (`:226-242`), after `list.push(normalized)`:

```js
        list.push(normalized)
        this._prunePromptWindow(list)
```

- [ ] **Step 7: Update the header CONTRACT block**

In the file header (`:22-24`), the `appendTranscript` contract line currently reads:

```
 *     entry: {seq?, actor:'llm'|'tool'|'system', tool?, args_digest?,
 *             result_digest?, artifact_id?, ts?}
```

Replace with:

```
 *     entry: {seq?, actor:'llm'|'tool'|'system', tool?, args_digest?,
 *             result_digest?, artifact_id?, ts?}
 *     A stored entry may additionally carry `prompt_digest` — DERIVED from
 *     `result_digest` on tool entries only, at PROMPT_DIGEST_CHARS, and
 *     pruned to the newest PROMPT_WINDOW carriers. Never accepted from the
 *     caller. This is the prompt-facing observation channel (issue #72);
 *     `result_digest` remains the 200-char UI/audit rendering.
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest test/PaRunManager.test.js`
Expected: PASS — the new block plus every pre-existing `PaRunManager` test (the 200-char behaviour is unchanged, so none of them should move).

- [ ] **Step 9: Commit**

```bash
git add src/server/PaRunManager.js test/PaRunManager.test.js
git commit -m "feat: prompt-facing digest with a rolling window in PaRunManager (#72)"
```

---

### Task 2: `PaAgentLoop` — render the prompt-facing digest

**Files:**
- Modify: `src/server/PaAgentLoop.js` (`_renderTranscript` at `:485-501`)
- Test: `test/PaAgentLoop.test.js` (new `describe` block at end of file)

**Interfaces:**
- Consumes: transcript entries carrying optional `prompt_digest: String` (Task 1).
- Produces: prompts in which a `prompt_digest`-carrying entry renders as a three-line block (`#N [actor:tool] args=…` / `result:` / `<payload>`) instead of an inline `result=` suffix. Task 3 asserts against this rendering.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaAgentLoop.test.js`. That file already has `function load(opts)` at `:125-129`, which returns `new ctx.PaAgentLoop(o)` — use it, do not define another.

```js
// ===========================================================================
// _renderTranscript — the observation channel rendering (issue #72)
// ===========================================================================

describe('_renderTranscript prompt_digest rendering', () => {
    test('an entry carrying prompt_digest renders it as a block, not an inline result=', () => {
        const rendered = load()._renderTranscript([
            { seq: 1, actor: 'tool', tool: 'read_artifact', args_digest: '{"id":"a1"}', result_digest: 'SHORT', prompt_digest: 'FULL PAYLOAD' },
        ])

        expect(rendered).toBe('#1 [tool:read_artifact] args={"id":"a1"}\nresult:\nFULL PAYLOAD')
        expect(rendered).not.toContain('SHORT')
    })

    test('an entry without prompt_digest renders exactly as before — inline result=', () => {
        const rendered = load()._renderTranscript([
            { seq: 1, actor: 'tool', tool: 'agent_trace', result_digest: 'SHORT' },
        ])

        expect(rendered).toBe('#1 [tool:agent_trace] result=SHORT')
    })

    test('mixed entries render each in its own form', () => {
        const rendered = load()._renderTranscript([
            { seq: 1, actor: 'llm', result_digest: 'thinking' },
            { seq: 2, actor: 'tool', tool: 'read_artifact', result_digest: 'SHORT', prompt_digest: 'BIG' },
        ])

        expect(rendered).toBe('#1 [llm] result=thinking\n#2 [tool:read_artifact]\nresult:\nBIG')
    })

    test('an empty transcript still reports the first-step message', () => {
        expect(load()._renderTranscript([])).toContain('first reasoning step')
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaAgentLoop.test.js -t "prompt_digest rendering"`
Expected: FAIL — the first test gets `#1 [tool:read_artifact] args={"id":"a1"} result=SHORT`, because `prompt_digest` is ignored today.

- [ ] **Step 3: Rewrite `_renderTranscript`**

Replace `_renderTranscript` in `src/server/PaAgentLoop.js` (`:485-501`) with:

```js
    _renderTranscript: function (transcript) {
        var list = this._isArray(transcript) ? transcript : []
        if (list.length === 0) {
            return '(none yet — this is the first reasoning step)'
        }

        var lines = []
        for (var i = 0; i < list.length; i++) {
            var e = this._isPlainObject(list[i]) ? list[i] : {}
            var label = this._nonEmptyString(e.tool) ? this._str(e.actor) + ':' + e.tool : this._str(e.actor)
            var line = '#' + (e.seq !== undefined && e.seq !== null ? e.seq : i + 1) + ' [' + label + ']'
            if (e.args_digest !== undefined && e.args_digest !== null) line += ' args=' + this._str(e.args_digest)

            // THE OBSERVATION CHANNEL (issue #72). When PaRunManager kept a
            // prompt-facing digest for this entry, render THAT — the 200-char
            // `result_digest` is the UI/audit rendering, not what the model
            // is supposed to reason over. Before this, a 4,000-character
            // read_artifact page reached the next prompt as ~200 characters,
            // which is the leading identified mechanical cause of the Phase
            // 1b benchmark's 0/10 (benchmark/DECISION.md §G3a).
            //
            // Block form rather than an inline `result=` suffix: 4,000
            // characters crammed onto one line is hard for the model to parse
            // and unreadable for a human pulling the prompt back out of
            // sys_generative_ai_log to check what the model actually saw.
            if (e.prompt_digest !== undefined && e.prompt_digest !== null) {
                lines.push(line)
                lines.push('result:')
                lines.push(this._str(e.prompt_digest))
                continue
            }

            if (e.result_digest !== undefined && e.result_digest !== null) line += ' result=' + this._str(e.result_digest)
            lines.push(line)
        }
        return lines.join('\n')
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaAgentLoop.test.js`
Expected: PASS — including every pre-existing test in that file, since entries without `prompt_digest` render byte-identically to before.

- [ ] **Step 5: Commit**

```bash
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "feat: render the prompt-facing digest into the next prompt (#72)"
```

---

### Task 3: The integration test the issue mandates

**Files:**
- Create: `test/observationChannel.test.js`
- Test: itself

**Interfaces:**
- Consumes: `PaRunManager.prompt_digest` (Task 1) and `PaAgentLoop._renderTranscript` (Task 2), wired together for real.
- Produces: nothing consumed downstream — this is the regression floor.

**Why a new file:** `test/PaAgentLoop.test.js` uses `fakeRunManager` (`:57-75`), which copies entries verbatim and does not digest. Issue #72 calls that out by name: no existing unit test could catch this defect or verify the fix. This test exists specifically to close that gap by wiring the two **real** classes over the writable-world `_glideStub`.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/observationChannel.test.js`
Expected: if Tasks 1 and 2 are already committed, this **passes** — it is a regression floor over work just done, not a red-first test for new code. Run it anyway and confirm. If it fails, the failure is real: fix Task 1 or 2 before continuing rather than adjusting this test's assertions.

The second test (`PROMPT_WINDOW = 0`) is the meaningful red/green control here: temporarily set it to `3` and confirm that test fails, then set it back to `0`. That proves the first test's assertion is measuring the channel and not something incidental.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 4: Commit**

```bash
git add test/observationChannel.test.js
git commit -m "test: integration floor for the observation channel over real collaborators (#72)"
```

---

### Task 4: The T6 row-size re-check — guard test and comment update

**Files:**
- Modify: `test/PaRunManager.test.js` (append to the `prompt_digest` describe block from Task 1)
- Modify: `src/fluent/async-wiring.now.ts` (the `DEFERRED` comment block at `:61-87`)

**Interfaces:**
- Consumes: `PROMPT_DIGEST_CHARS`, `PROMPT_WINDOW` and the pruner (Task 1).
- Produces: nothing consumed downstream.

**Why:** the DEFERRED block justifies not wiring `maybeSummarize` on arithmetic that assumed a 200-char ceiling (`~15 * 2 * 200 = 6,000` chars against the column's 65,536). Task 1 invalidates that number. The conclusion still holds on the new arithmetic — but a comment that has been silently falsified is exactly the kind of rot this project files issues about, so the new bound is both written down and asserted.

- [ ] **Step 1: Write the failing guard test**

Append inside the `describe('prompt_digest', ...)` block in `test/PaRunManager.test.js`:

```js
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
        // Design spec §4.4 derives ~30,000 worst case. 40,000 is that with
        // headroom; 65,536 is the hard column ceiling (tables.now.ts:201-204).
        expect(raw.length).toBeLessThan(40000)
    })
```

- [ ] **Step 2: Run it**

Run: `npx jest test/PaRunManager.test.js -t "T6 row-size bound"`
Expected: PASS. If it FAILS on the 40,000 assertion, do not raise the number — that is the pruner not working, and Task 1 needs fixing.

- [ ] **Step 3: Update the DEFERRED comment**

In `src/fluent/async-wiring.now.ts`, the block at `:75-86` currently reads (in part):

```
// Deferring is also empirically safe for Phase 1b's bound: MAX_ITERATIONS
// is 15, each iteration appends at most two transcript entries (llm + tool,
// or llm + system), each digested to <=200 chars (PaRunManager.DIGEST_CHARS)
// — worst case ~15 * 2 * 200 = 6,000 characters, well inside the `transcript`
// column's 65,536-char ceiling (tables.now.ts).
```

Replace those five lines with:

```
// Deferring is also empirically safe for Phase 1b's bound, RE-DERIVED
// 2026-08-02 for issue #72's prompt-facing digest (the 6,000-char figure
// this comment carried before assumed a 200-char ceiling on every entry,
// which is no longer true). MAX_ITERATIONS is 15 and each iteration appends
// at most two transcript entries (llm + tool, or llm + system). Every entry
// still carries a <=200-char result_digest (PaRunManager.DIGEST_CHARS), so
// the baseline is ~30 entries * ~600 chars including args and JSON overhead
// = ~18,000. On top of that, at most PROMPT_WINDOW (3) tool entries retain a
// prompt_digest of up to PROMPT_DIGEST_CHARS (4,000) = 12,000. Worst case
// ~30,000 characters against the transcript column's 65,536-char ceiling
// (tables.now.ts) — roughly 2x headroom, and asserted by the "T6 row-size
// bound" test in test/PaRunManager.test.js so this paragraph cannot go
// stale silently again.
```

**Rule #43 caution:** this is a top-level `//` comment outside any `script` template (verified), so backticks would be tolerated — but do not introduce any, and do not add `\n` escapes. Keep the existing plain-prose style.

- [ ] **Step 4: Verify the Fluent file still builds**

Run: `now-sdk build`
Expected: success. This is a comment-only edit, so a failure here means a stray backtick or escape was introduced — grep the block before reading any other diagnostic (Rule #43's corollary: the reported line numbers will point somewhere else).

- [ ] **Step 5: Commit**

```bash
git add test/PaRunManager.test.js src/fluent/async-wiring.now.ts
git commit -m "test: assert the T6 transcript row-size bound, re-derive the DEFERRED note (#72)"
```

---

### Task 5: `PaFixReport` — accept an earned inconclusive report

**Files:**
- Modify: `src/server/PaFixReport.js` (`_checkRootCauses` at `:193-207`, `_checkEvidenceRule` at `:250-285`, `_checkFixes` at `:287-321`, `_checkVerification` at `:323-327`, new helpers)
- Test: `test/PaFixReport.test.js` (new `describe` block at end)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `validate()` accepts `report.inconclusive = {evidence_read: [{source, detail}], needed_to_conclude: String}` as the licence for empty `root_causes` and `fixes`. New private helpers `_isInconclusiveShape(report) -> Boolean`, `_checkInconclusive(report, problems) -> undefined`, `_checkEvidenceEntries(evidence, label, problems) -> {hasTrace, hasOther}`. Task 6 renders and advertises this shape.

**Why (T4):** `root_causes` and `fixes` are both hard-required non-empty today, so a model that swept honestly and found nothing conclusive has no valid way to say so — the only structurally acceptable output is a claimed root cause, which is pressure toward fabrication. That is the same failure family as the 200-char starvation, and the benchmark's fabricated-evidence mode is consistent with it. The escape hatch is deliberately **expensive**: `layers_swept` already demands all seven layers with a reason on each un-swept one (`_checkLayersSwept:160-191`, unchanged), and `evidence_read` demands citations for what was actually read. It should cost more to write than a real diagnosis of a seed the model actually solved.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaFixReport.test.js`. Follow that file's existing construction helper for building a `PaFixReport` and its existing helper for a valid baseline report if one exists; the snippet below builds what it needs locally so it does not depend on a helper whose exact name may differ.

```js
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
        const res = load().validate(inconclusiveReport({ verification: undefined }))

        expect(res.valid).toBe(true)
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
})
```

`load()` is the file's existing constructor helper (`test/PaFixReport.test.js:21-24`) — use it as-is. That file also already has `sweptLayers()` (`:27`) and `validReport(overrides)` (`:40`); read them before writing the block above and prefer them over the locally-defined `allSevenSwept`/`inconclusiveReport` where they fit, since duplicating a fixture that already exists is how the two drift apart.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaFixReport.test.js -t "inconclusive reports"`
Expected: FAIL — the first test reports `root_causes must include at least one entry` and `fixes must include at least one entry`.

- [ ] **Step 3: Extract the shared evidence-entry check**

In `src/server/PaFixReport.js`, replace `_checkEvidenceRule` (`:250-285`) with these two methods. The per-entry label is built as `label + '[' + i + ']'` and callers pass `label` already ending in `.evidence`, so the emitted labels stay byte-identical to today's (`root_causes[0].evidence[0]`) and no existing test moves.

```js
    /**
     * Per-entry shape check, shared by `_checkEvidenceRule` (root causes) and
     * `_checkInconclusive` (evidence_read). Returns the source tally so the
     * caller can apply — or deliberately NOT apply — the evidence rule.
     */
    _checkEvidenceEntries: function (evidence, label, problems) {
        var sources = this._evidenceSources()
        var tally = { hasTrace: false, hasOther: false }

        for (var i = 0; i < evidence.length; i++) {
            var entry = evidence[i]
            var entryLabel = label + '[' + i + ']'

            if (!this._isPlainObject(entry) || this._indexOf(sources, entry.source) === -1) {
                problems.push(
                    entryLabel + ' has an invalid or missing source (must be one of: ' + sources.join(', ') + ')'
                )
                continue
            }
            if (!this._nonEmptyString(entry.detail)) {
                problems.push(entryLabel + ' is missing a detail citation (table, sys_id, field, or value)')
            }

            if (entry.source === 'trace') tally.hasTrace = true
            else tally.hasOther = true
        }

        return tally
    },

    /**
     * The evidence rule, enforced structurally: at least one 'trace' citation
     * PLUS at least one 'config' | 'schema' | 'data' citation. Every problem
     * this raises contains the literal phrase "evidence rule" (Task 4 brief,
     * Step 1) and names the cause so a repair prompt — or a human — can find
     * it without re-deriving which entry failed.
     */
    _checkEvidenceRule: function (evidence, label, causeName, problems) {
        var tally = this._checkEvidenceEntries(evidence, label + '.evidence', problems)

        if (!tally.hasTrace) {
            problems.push(
                label + ' (' + causeName + '): evidence rule violation — no trace citation found; ' +
                    'a candidate resting on config/schema/data alone is not a confirmed root cause'
            )
        }
        if (tally.hasTrace && !tally.hasOther) {
            problems.push(
                label + ' (' + causeName + '): evidence rule violation — evidence cites only the trace; ' +
                    'at least one config, schema, or data citation is required'
            )
        }
    },
```

- [ ] **Step 4: Add the inconclusive helpers**

Add directly after `_checkEvidenceRule`:

```js
    /**
     * True when the report is CLAIMING the inconclusive path — an empty
     * `root_causes` plus an `inconclusive` object. Whether that claim is
     * VALID is `_checkInconclusive`'s job; this predicate only decides
     * whether `fixes` may be empty and `verification` may be absent, so it
     * must NOT re-raise the problems that method already raises.
     */
    _isInconclusiveShape: function (report) {
        return (
            this._isArray(report.root_causes) &&
            report.root_causes.length === 0 &&
            this._isPlainObject(report.inconclusive)
        )
    },

    /**
     * T4 (issue #72): an honest "I could not reach a conclusion" must be
     * expressible, or the only structurally valid output is an invented root
     * cause — which is pressure toward fabrication, not a validation floor.
     *
     * But it must be EARNED, not cheap. Two costs sit on this path: the
     * seven-layer `layers_swept` report with a reason on every un-swept layer
     * (unchanged, `_checkLayersSwept`), and the `evidence_read` citations
     * below. Writing an honest inconclusive report should cost more than
     * diagnosing a defect the model actually found.
     *
     * NOTE the evidence RULE (trace PLUS one of config/schema/data) is
     * deliberately NOT applied to `evidence_read`: that array is a record of
     * what was READ, not a claim about a cause, and demanding a trace
     * citation from a run whose trace was unavailable is exactly the
     * pedantry this path exists to remove.
     */
    _checkInconclusive: function (report, problems) {
        var inc = report.inconclusive

        if (!this._isPlainObject(inc)) {
            problems.push(
                'root_causes is empty, which is allowed ONLY for an honest inconclusive report — and such a ' +
                    'report must carry an `inconclusive` object of {evidence_read, needed_to_conclude}. Either ' +
                    'name at least one root cause with evidence, or add that object. Do NOT invent a root cause ' +
                    'to satisfy this check.'
            )
            return
        }

        var ev = inc.evidence_read
        if (!this._isArray(ev) || ev.length === 0) {
            problems.push(
                'inconclusive.evidence_read is required and must be a non-empty array of {source, detail} ' +
                    'recording what you actually read — an uncited inconclusive report is not distinguishable ' +
                    'from not having looked'
            )
        } else {
            this._checkEvidenceEntries(ev, 'inconclusive.evidence_read', problems)
        }

        if (!this._nonEmptyString(inc.needed_to_conclude)) {
            problems.push(
                'inconclusive.needed_to_conclude is required and must be a non-empty string naming what would ' +
                    'be needed to reach a conclusion'
            )
        }
    },
```

- [ ] **Step 5: Route the three checks through it**

In `_checkRootCauses` (`:193-207`), replace:

```js
        if (rcs.length === 0) {
            problems.push('root_causes must include at least one entry')
            return
        }
```

with:

```js
        if (rcs.length === 0) {
            // T4 — the earned-inconclusive path. See `_checkInconclusive`.
            this._checkInconclusive(report, problems)
            return
        }
```

In `_checkFixes` (`:287-321`), replace:

```js
        if (fixes.length === 0) {
            problems.push('fixes must include at least one entry')
            return
        }
```

with:

```js
        if (fixes.length === 0) {
            // Empty `fixes` rides on the inconclusive path ONLY. A NAMED root
            // cause with nothing proposed is still a defect — the report
            // claims to know what broke and declines to say what to do.
            if (!this._isInconclusiveShape(report)) {
                problems.push('fixes must include at least one entry')
            }
            return
        }
```

In `_checkVerification` (`:323-327`), replace the whole method with:

```js
    _checkVerification: function (report, problems) {
        // Nothing to verify when no fix was proposed — demanding a string
        // here would only invite "n/a" boilerplate.
        if (this._isInconclusiveShape(report)) return

        if (!this._nonEmptyString(report.verification)) {
            problems.push('verification is required and must be a non-empty string')
        }
    },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest test/PaFixReport.test.js`
Expected: PASS — the new block plus every pre-existing `PaFixReport` test. The evidence-label refactor in Step 3 is designed to be byte-identical in output; if an existing test moves, that refactor is wrong, not the test.

- [ ] **Step 7: Commit**

```bash
git add src/server/PaFixReport.js test/PaFixReport.test.js
git commit -m "feat: accept an earned inconclusive fix report (T4, #72)"
```

---

### Task 6: Advertise and render the inconclusive path

**Files:**
- Modify: `src/server/PaFixReport.js` (`schemaText` at `:409-442`, `renderMarkdown` at `:454-529`, file header at `:20-26`)
- Test: `test/PaFixReport.test.js` (append to the `inconclusive reports` describe block)

**Interfaces:**
- Consumes: the `inconclusive` shape accepted by Task 5.
- Produces: `schemaText()` documents the field; `renderMarkdown()` emits an `## INCONCLUSIVE` section and an `(not applicable — inconclusive)` verification line.

**Why this is where the confound lives:** `schemaText()` is the single source read by BOTH `PaFixReport.repairPrompt()` (`:375`) and `PaAgentLoop._fixReportContract()` via `_safeSchemaText()` (`:550`, `:577`) — so one edit advertises the path in both the first-attempt contract and the repair turn, and no `PaAgentLoop` change is needed. This is a deliberate prompt-text change entering the benchmark re-run, and Task 9 records it as a named confound. An escape hatch the model is never told about would change nothing.

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('inconclusive reports', ...)` block:

```js
    test('schemaText documents the inconclusive field so the model knows the path exists', () => {
        const text = load().schemaText()

        expect(text).toContain('inconclusive')
        expect(text).toContain('evidence_read')
        expect(text).toContain('needed_to_conclude')
        // and it must say the honest path is preferred over invention
        expect(text.toLowerCase()).toContain('preferred')
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaFixReport.test.js -t "inconclusive"`
Expected: FAIL — `schemaText` has no `inconclusive` line and `renderMarkdown` emits no such section.

- [ ] **Step 3: Update `schemaText`**

In `schemaText()` (`:409-442`), change the `root_causes` line's opening from `'root_causes: non-empty array of ...'` to `'root_causes: array of ...'` and the `fixes` line's opening from `'fixes: non-empty array of ...'` to `'fixes: array of ...'`, then append the qualifier to each and add the new field. Concretely, the `root_causes` push becomes:

```js
        lines.push(
            'root_causes: array of {layer, component, finding, evidence, confidence?} — NON-EMPTY unless you ' +
                'supply the `inconclusive` object described below; layer is the ' +
                'layer number as a string "1".."7" (a bare JSON number 1-7 is also accepted and normalized to a ' +
                'string); component is a non-empty string naming the specific record/table/field; finding is a ' +
                'non-empty string describing what is wrong; evidence is a non-empty array of {source, detail} ' +
                'where source is a string, one of ' + this._evidenceSources().join('|') + ', and detail is a ' +
                'non-empty string citation (table, sys_id, field, or value); EVERY root cause needs at least one ' +
                '"trace" evidence entry PLUS at least one of ' + this._nonTraceEvidenceSources().join('|') +
                ' (the evidence rule); confidence, if present, is a string (e.g. CONFIRMED or UNCONFIRMED)'
        )
```

the `fixes` push becomes:

```js
        lines.push(
            'fixes: array of {target_type, target, current, proposed, rationale} — NON-EMPTY unless root_causes ' +
                'is empty and you supply `inconclusive`; target_type is a ' +
                'string, one of ' + this._fixTargetTypes().join('|') + '; target, proposed and rationale are ' +
                'each non-empty strings; current is a string and may be empty but must be present'
        )
```

the `verification` push becomes:

```js
        lines.push('verification: non-empty string — may be omitted ONLY on the inconclusive path')
```

and add this immediately after the `data_markers` line, as the last entry:

```js
        lines.push(
            'inconclusive: OPTIONAL object {evidence_read, needed_to_conclude} — supply it ONLY when you could ' +
                'not isolate a cause. When present, root_causes and fixes may both be empty arrays and ' +
                'verification may be omitted. evidence_read is a non-empty array of {source, detail} in the same ' +
                'shape as root_causes[].evidence, recording what you ACTUALLY read (the trace-plus-one evidence ' +
                'rule does NOT apply to it); needed_to_conclude is a non-empty string naming what would be ' +
                'required to conclude. An honest inconclusive report is always preferred to an invented root ' +
                'cause. It does NOT excuse a shallow sweep: layers_swept must still report all seven layers with ' +
                'a reason on every one you did not sweep, and you should exhaust your tool budget before ' +
                'concluding you cannot tell.'
        )
```

- [ ] **Step 4: Update `renderMarkdown`**

In `renderMarkdown` (`:454-529`), immediately after the LAYERS SWEPT loop's closing `lines.push('')` (around `:477`) and before `lines.push('## ROOT CAUSES')`, insert:

```js
        // Rendered only when present — a normal report is byte-identical to
        // before. Placed after LAYERS SWEPT because it explains the sweep the
        // reader has just looked at, before the (empty) causes below.
        var inc = this._isPlainObject(r.inconclusive) ? r.inconclusive : null
        if (inc) {
            lines.push('## INCONCLUSIVE')
            lines.push('')
            lines.push('evidence read:')
            var read = this._isArray(inc.evidence_read) ? inc.evidence_read : []
            if (read.length === 0) {
                lines.push('  (none)')
            } else {
                for (var p = 0; p < read.length; p++) {
                    var re = this._isPlainObject(read[p]) ? read[p] : {}
                    lines.push('  - ' + this._str(re.source) + ': ' + this._str(re.detail))
                }
            }
            lines.push('needed to conclude: ' + this._str(inc.needed_to_conclude))
            lines.push('')
        }
```

Then change the VERIFICATION body line (`:514`) from:

```js
        lines.push(this._nonEmptyString(r.verification) ? r.verification : '(not provided)')
```

to:

```js
        lines.push(
            this._nonEmptyString(r.verification)
                ? r.verification
                : inc
                  ? '(not applicable — inconclusive)'
                  : '(not provided)'
        )
```

`inc` is declared with `var` earlier in the same function, so it is in scope here.

- [ ] **Step 5: Update the file header**

In the header block (`:20-26`), the sentence describing the renderings currently says the markdown section order is "six headings, in that order". Replace that sentence with:

```
 * `renderMarkdown` and `renderJson` both take the SAME `normalized` object
 * validate() produced. The markdown section order is copied verbatim from the
 * playbook's "The Fix Report" section: FAILURE SUMMARY, LAYERS SWEPT, ROOT
 * CAUSES, FIXES, VERIFICATION, DATA MARKERS — six headings, in that order,
 * plus a seventh INCONCLUSIVE section rendered between LAYERS SWEPT and ROOT
 * CAUSES ONLY when the report took the earned-inconclusive path (T4, issue
 * #72). If the playbook's section order ever changes, LAYOUT below is the one
 * place to change it to keep the two in sync.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest test/PaFixReport.test.js`
Expected: PASS, all tests in the file.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: PASS, all files. `PaAgentLoop`'s contract-block tests read `schemaText()` through `_safeSchemaText()`; if any of them assert on exact schema text, update those assertions to match — the wording change is intended.

- [ ] **Step 8: Commit**

```bash
git add src/server/PaFixReport.js test/PaFixReport.test.js
git commit -m "feat: advertise and render the inconclusive path (T4, #72)"
```

---

### Task 7: Build, deploy, version

**Files:**
- Modify: `package.json` (version), `README.md` (version badge), `CHANGELOG.md` (new entry)

**Interfaces:**
- Consumes: all code from Tasks 1-6.
- Produces: version `2026.08.0217` installed on `gpinst01`, which Task 8 runs the benchmark against.

- [ ] **Step 1: Confirm the suite is green**

Run: `npm test`
Expected: PASS, all files. Do not proceed on a red suite.

- [ ] **Step 2: Bump the version**

In `package.json:3`, change `"version": "2026.08.0216"` to `"version": "2026.08.0217"`.
In `README.md:3`, change `version-2026.08.0216-blue` to `version-2026.08.0217-blue`.

- [ ] **Step 3: Add the CHANGELOG entry**

Add directly under the `---` that ends the `CHANGELOG.md` preamble, above the previous newest entry:

```markdown
## 2026.08.0217 — 2026-08-02

### Fixed
- **The 200-character observation channel (#72).** `PaRunManager` now writes a second,
  prompt-facing `prompt_digest` (`PROMPT_DIGEST_CHARS` 4,000 — deliberately equal to
  `PaArtifactStore.MAX_PAGE_CHARS`, so one `read_artifact` page survives whole) alongside the
  unchanged 200-char `result_digest`, pruned on append to the newest `PROMPT_WINDOW` (3) carriers
  so the `transcript` column stays bounded. `PaAgentLoop._renderTranscript` renders it as a block.
  Previously a 4,000-character evidence page reached the next reasoning prompt as ~200 characters —
  the leading identified mechanical cause of the Phase 1b comparison benchmark's 0/10
  (`benchmark/DECISION.md` §G3a).
- **Fabrication pressure in `PaFixReport` (T4).** `root_causes` and `fixes` may now both be empty
  when the report carries an `inconclusive` object citing `evidence_read` and `needed_to_conclude`,
  so an honest "I could not isolate this" is expressible instead of structurally rejected. The
  seven-layer `layers_swept` requirement is unchanged, which is what keeps the path from becoming a
  cheap exit.

### Changed
- `PaFixReport.schemaText()` documents the inconclusive path — reaching both the first-attempt
  contract (via `PaAgentLoop._fixReportContract`) and the repair turn from one source.
- `renderMarkdown` gains a conditional `## INCONCLUSIVE` section.
- The `DEFERRED` note in `async-wiring.now.ts` re-derives the T6 transcript row-size bound
  (~30,000 worst case against the 65,536 ceiling, was ~6,000), now asserted by a test.
```

- [ ] **Step 4: Build**

Run: `now-sdk build`
Expected: success. On failure, fix before installing — a build must pass before install.

- [ ] **Step 5: Install to gpinst01**

Run: `now-sdk install --alias gpinst01`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add package.json README.md CHANGELOG.md
git commit -m "chore: version 2026.08.0217 — observation channel + earned inconclusive"
```

---

### Task 8: Re-run the benchmark, custom harness only

**Files:**
- Modify: `benchmark/scorecard-custom-harness.md`
- Modify: `benchmark/DECISION.md` (new `## H` section)

**Interfaces:**
- Consumes: the deployed app from Task 7.
- Produces: the number this whole plan exists to obtain.

**Ground rule:** honest re-measurement. Whatever the score is, it gets written down. Do not tune anything mid-run to improve it; if something looks wrong with the harness during the run, record it and finish the 10 rows.

- [ ] **Step 1: Verify the seed fixtures before scoring anything**

Two seeds are VOID without post-install setup (`benchmark/README.md` "The protocol", step 2). Using the foundry MCP tools — never shell `curl`, per CLAUDE.md:

- Seed 5: read `sn_aia_trigger_agent_usecase_m2m` for the seed's row and confirm `active` is `true`; `sn_aia_trigger_configuration.active` must stay `false` (that is the seeded defect).
- Seed 4: confirm the capability sys_id hardcoded in the installed `summarise_ticket` tool script matches the instance's `sys_one_extend_capability` record named `x_snc_tsbench_unmapped_capability` (gpinst01: `92ff62af516741769c437feb88c80ef3`).

Record both confirmations in the scorecard's protocol notes. If either is wrong, fix the fixture and re-verify before running.

- [ ] **Step 2: Run 5 seeds x 2 runs against the custom harness**

For each of `seed-01` … `seed-05`, twice: `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze` with the seed's trigger target, then poll `GET /runs/{id}` to a terminal state. Native is **not** re-run — its 8/10 is already recorded against unchanged seeds.

For every row capture: run_id, terminal outcome, tool-call count and the sequence of tool names, whether the Fix Report validated (and whether it took the inconclusive path), the identified root-cause layer versus the seed's expected layer, and the pass/fail per the scorecard's existing criteria.

- [ ] **Step 3: Capture the tool-call profile specifically**

The 0/10 baseline's signature was every row calling exactly two tools (`agent_trace`, then one `read_artifact` page). Whether that profile changed is the single most informative observation this re-run produces, independent of the score — record it per row even where the outcome is unchanged.

- [ ] **Step 4: Fill the scorecard**

Fill `benchmark/scorecard-custom-harness.md` following its existing structure. Preserve the prior 0/10 measurement rather than overwriting it — the comparison between the two custom-harness runs is itself evidence.

- [ ] **Step 5: Write `DECISION.md` §H**

Add a `## H. Post-fix re-run — the custom harness, re-measured` section covering: the new score against native's recorded 8/10; the tool-call profile change (or its absence); how many rows took the inconclusive path; and a **Confounds** subsection naming, at minimum, (a) the `schemaText()` prompt-text change from Task 6, which was unavoidable because an unadvertised escape hatch changes nothing, and (b) that native was not re-measured on the same day, so the G2 confound surface between the two harnesses is narrowed but not closed. State the verdict the number supports — including "still does not clear the bar" if that is what it says.

- [ ] **Step 6: Commit**

```bash
git add benchmark/scorecard-custom-harness.md benchmark/DECISION.md
git commit -m "docs: Phase 1b post-fix benchmark re-run — scorecard + DECISION.md §H (#72)"
```

---

### Task 9: Pull request

**Files:** none modified.

- [ ] **Step 1: Final verification**

Run: `npm test` — expected PASS, all files.
Run: `now-sdk build` — expected success.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin fix/phase1b-observation-channel
gh pr create --title "fix: the 200-char observation channel + earned inconclusive fix reports (#72)" --body "$(cat <<'EOF'
Closes #72 (bundling ledger items T4 and T6).

## What changed

- **Observation channel.** `PaRunManager` writes a prompt-facing `prompt_digest` (4,000 chars,
  equal to `PaArtifactStore.MAX_PAGE_CHARS`) alongside the unchanged 200-char `result_digest`,
  pruned on append to the newest 3 carriers. `PaAgentLoop._renderTranscript` renders it as a
  block. A 4,000-char evidence page now reaches the next reasoning prompt intact.
- **T4.** `PaFixReport` accepts empty `root_causes`/`fixes` when the report carries an
  `inconclusive` block citing `evidence_read` and `needed_to_conclude`. `layers_swept` is
  unchanged, which is what keeps the path from being a cheap exit.
- **T6.** The transcript row-size bound is re-derived (~30,000 worst case against the 65,536
  ceiling) and asserted by a test rather than asserted in a comment.

## Verification

- `npm test` green, including a new integration test wiring the REAL `PaAgentLoop` to the REAL
  `PaRunManager` over `_glideStub` — the digest-blind `fakeRunManager` could not have caught this.
- `now-sdk build` + `now-sdk install --alias gpinst01`.
- 10-row benchmark re-run against the custom harness — see `benchmark/DECISION.md` §H.

## Confound, stated

`PaFixReport.schemaText()` changed, so the fix_report contract text entering the re-run is not
identical to the 0/10 baseline's. This was unavoidable: an escape hatch the model is never told
about changes nothing. Recorded in §H.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage.** §4.1 → Task 1. §4.2 → Task 2. §4.3 → Tasks 5 (validate) and 6 (advertise + render). §4.4 → Task 4. §5 → Tasks 1-6 (each carries its own tests; the mandated integration test is Task 3). §6 → Tasks 7-9. §7's exclusions are in Global Constraints (no playbook edit) and are not implemented anywhere.

**One spec correction found while planning.** §4.3 says `PaAgentLoop._fixReportContract()` and `PaFixReport.repairPrompt()` "must both describe" the inconclusive path. Reading the source, both already read from the single `PaFixReport.schemaText()` (`:375` and `:550`/`:577`), so **one** edit covers both and no `PaAgentLoop` change is needed. The spec's requirement is satisfied more cheaply than it assumed; Task 6 notes this.

**Placeholder scan.** No TBDs. An earlier draft hedged on two test-construction helpers ("match whatever the file uses"); both were then read and pinned to the real thing — `load()` at `test/PaFixReport.test.js:21-24` and `load(opts)` at `test/PaAgentLoop.test.js:125-129`, with `loadScriptInclude` taking a bare filename (`'PaAgentLoop.js'`), not a path constant. No hedges remain.

**Type consistency.** `prompt_digest` (string, optional) is written in Task 1, read in Task 2, asserted in Tasks 3 and 4. `PROMPT_DIGEST_CHARS`/`PROMPT_WINDOW` spelled identically throughout. `_isInconclusiveShape` / `_checkInconclusive` / `_checkEvidenceEntries` defined in Task 5, referenced by name in Task 6. `inconclusive.evidence_read` and `inconclusive.needed_to_conclude` spelled identically in Tasks 5, 6, 7, 8.
