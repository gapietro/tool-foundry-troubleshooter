# Directed Depth Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the depth gate direct the model at ONE specific diagnostic layer instead of accepting any tool call, so a single `agent_config` call can no longer discharge gaps on layers it never touched.

**Architecture:** One rule — fan-out minimality — applied twice. `PaFixReport` gains two pure accessors (`toolFanOut()`, `declaredLayers()`) that keep `_layerToolMap` single-sourced. `PaAgentLoop._depthGate` uses them to select a single target gap (the model's own `would_confirm` layer when it names one that is open, otherwise the gap with the most dedicated tool) and records only that gap's dedicated tools as the release set. Cost stays at exactly one forced beat; stickiness, the audit-trail-only release, and the never-name-a-tool constraint are all unchanged.

**Tech Stack:** ServiceNow Script Includes written as ES5/Rhino-safe JavaScript under `src/server/`, unit-tested off-platform with Jest via `test/_loadScriptInclude.js`. Deployment through `now-sdk build` + `now-sdk install --alias gpinst01`. Runtime verification through the foundry MCP tools.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-04-directed-depth-gate-design.md`. **Issue:** #109. **Branch:** `feature/directed-depth-gate` (already created; the spec is committed on it at `138c4c0`).
- **ES5/Rhino only** in `src/server/*.js` — no `let`/`const`, no arrow functions, no `Set`/`Map`, no `Array.prototype.find`, no template literals, no `Object.keys` shorthand assumptions beyond ES5. Match the surrounding code exactly.
- **R-9 / R-1 posture:** a broken or absent collaborator degrades the gate, never throws inside `_depthGate` and never traps the run. Caught exceptions are deliberately not inspected (`// R-1: e is deliberately not inspected.`).
- **`_layerToolMap()` must NOT be edited.** Editing the map would change what every prior pass measured. This work reads it; it does not rewrite it.
- **Nothing native-facing moves.** `docs/agent/agent-doctor-instructions.md` stays byte-identical and no `excerptPriority` work lands here, so DECISION.md §K5 sequencing and §I4 confound 3 stay closed and the v5 comparison holds.
- **`_scrubToolNames` and its guard tests must keep passing unchanged.** The hold block names layers, never tools.
- **`_holdNote` output must stay under `DIGEST_CHARS` (200).**
- **Never commit to `main`.** All work on the feature branch, merged by PR.
- **Version format `YYYY.MM.DDXX`.** Current is `2026.08.0402`; this work bumps to `2026.08.0403` in both `package.json` and the README badge.
- **Run `npx jest` from the repo root.** Full suite must be green before any deploy step.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/server/PaFixReport.js` | Owns the layer↔tool map and all pure report reading. Gains two thin public accessors so the loop never re-types the map. | Modify — add `toolFanOut()`, `declaredLayers()` |
| `src/server/PaAgentLoop.js` | Owns the gate: selection, stickiness, the held prompt block, the transcript note. | Modify — `_depthGate`, new selection helpers, `_holdBlock`, `_holdNote`, `run()` reset |
| `test/PaFixReport.test.js` | Pure-logic tests for the two new accessors. | Modify — new describe block |
| `test/PaAgentLoop.test.js` | Gate tests. The `fakeFixReport` fake gains the two new methods; one existing sticky test changes behaviour by design. | Modify |
| `package.json`, `README.md`, `CHANGELOG.md` | Version and history. | Modify |
| `benchmark/raw-evidence-v6-directed-depth.md` | Smoke evidence. | Create |
| `benchmark/DECISION.md` | §Q write-up. | Modify — append only |

**Note on `toolFanOut()`:** spec §7 enumerates only `declaredLayers` as the `PaFixReport` addition. `toolFanOut()` is a second thin accessor over the same private map, added because the ranking rule needs fan-out and `_layerToolMap` must stay single-sourced in `PaFixReport` (the same discipline `schemaText()` already follows — `PaAgentLoop.js:994` says the schema is "never retyped here"). No behaviour beyond exposing a derived view of an existing private method.

---

### Task 1: `PaFixReport` — the two pure accessors

**Files:**
- Modify: `src/server/PaFixReport.js` (add after `_layerToolMap`, ends `:376`)
- Test: `test/PaFixReport.test.js`

**Interfaces:**
- Consumes: the existing private `_layerToolMap()` (`:366`), `_layersNamedBy(text)` (`:713`), and the helpers `_isPlainObject` (`:1215`), `_isArray` (`:1224`), `_nonEmptyString` (`:1228`), `_indexOf` (`:1236`).
- Produces:
  - `toolFanOut()` → `Object` mapping tool name → `Number` of layers that tool can close. With today's map: `{agent_trace:1, genai_log:2, log_analysis:3, agent_config:3, schema_lookup:1, query_table:1}`.
  - `declaredLayers(report)` → `Array` of `Number`, ascending and de-duplicated, of layers named by any `root_causes[].would_confirm`. `[]` for any malformed input.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaFixReport.test.js`:

```js
// ===========================================================================
// directed depth gate (#109) — toolFanOut / declaredLayers
//
// Two thin accessors over `_layerToolMap` and `_layersNamedBy`, added so
// PaAgentLoop can rank gaps by how DEDICATED their tools are without ever
// re-typing the map. Pure: no Glide, no audit query, no validation effect.
// ===========================================================================

describe('directed depth gate (#109) — toolFanOut', () => {
    test('counts the layers each tool can close', () => {
        expect(load().toolFanOut()).toEqual({
            agent_trace: 1,
            genai_log: 2,
            log_analysis: 3,
            agent_config: 3,
            schema_lookup: 1,
            query_table: 1,
        })
    })

    test('every tool named anywhere in the layer map has a fan-out of at least 1', () => {
        const fanOut = load().toolFanOut()
        Object.keys(fanOut).forEach((tool) => {
            expect(fanOut[tool]).toBeGreaterThanOrEqual(1)
        })
    })
})

describe('directed depth gate (#109) — declaredLayers', () => {
    test('reads the layer a root cause names in would_confirm', () => {
        const report = { root_causes: [{ would_confirm: 'layer 4 — the schema of the routing table' }] }
        expect(load().declaredLayers(report)).toEqual([4])
    })

    test('collects across several root causes, de-duplicated and ascending', () => {
        const report = {
            root_causes: [
                { would_confirm: 'layer 5 would settle it' },
                { would_confirm: 'layer 4 as well' },
                { would_confirm: 'layer 5 again' },
            ],
        }
        expect(load().declaredLayers(report)).toEqual([4, 5])
    })

    test('a root cause with no would_confirm contributes nothing', () => {
        const report = { root_causes: [{ layer: 1, finding: 'x' }, { would_confirm: 'layer 6' }] }
        expect(load().declaredLayers(report)).toEqual([6])
    })

    test.each([undefined, null, 42, 'a string', [], { root_causes: 'not an array' }, { root_causes: [null, 7] }])(
        'degrades to [] on malformed input (%p) rather than throwing (R-9)',
        (input) => {
            let out
            expect(() => {
                out = load().declaredLayers(input)
            }).not.toThrow()
            expect(out).toEqual([])
        }
    )

    test('inherits _layersNamedBy: a table name carrying a digit is NOT read as a layer', () => {
        const report = { root_causes: [{ would_confirm: 'check sn_aia_agent_tool_m2m' }] }
        expect(load().declaredLayers(report)).toEqual([])
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaFixReport.test.js -t "#109"`
Expected: FAIL — `load(...).toolFanOut is not a function` and `load(...).declaredLayers is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/server/PaFixReport.js`, immediately after `_layerToolMap` (which ends at `:376` with `},`), insert:

```js
    /**
     * Fan-out per tool: how many of the seven layers `_layerToolMap()` lets
     * that tool close. Exposed for PaAgentLoop's directed depth gate (issue
     * #109), which ranks a draft's declared gaps by how DEDICATED their tools
     * are — a tool that closes three layers discharges a gap incidentally, a
     * tool that closes one can only discharge it deliberately.
     *
     * Derived from `_layerToolMap()` rather than hand-listed, for the same
     * reason PaAgentLoop reads `schemaText()` instead of re-typing the
     * schema: one source, so a map edit cannot silently desynchronise the
     * ranking from the mapping it claims to rank.
     *
     * PURE: no Glide, no audit query, no validation side effects.
     *
     * @returns {Object} {toolName: Number}, every value >= 1
     */
    toolFanOut: function () {
        var map = this._layerToolMap()
        var out = {}
        for (var layer in map) {
            if (!Object.prototype.hasOwnProperty.call(map, layer)) continue
            var tools = map[layer]
            if (!this._isArray(tools)) continue
            for (var i = 0; i < tools.length; i++) {
                out[tools[i]] = out[tools[i]] === undefined ? 1 : out[tools[i]] + 1
            }
        }
        return out
    },

    /**
     * Layer numbers this draft's root causes name in `would_confirm`, the
     * model's OWN statement of what evidence it is missing (#93).
     *
     * The directed depth gate (#109) gives this precedence over its
     * structural ranking: DECISION.md §P4 recorded a run whose
     * `would_confirm` correctly named layer 4 while the model still did not
     * call the tool that closes it. The model can identify the missing layer;
     * binding the release to its own naming is direction rather than force.
     *
     * Parsing is `_layersNamedBy`'s, unchanged — deliberately not a bare
     * digit scan, since table names carry digits.
     *
     * PURE: no Glide, no audit query, no validation side effects.
     *
     * @param {*} report a fix_report draft; any shape (R-9)
     * @returns {Array} ascending, de-duplicated layer numbers; `[]` for
     *          anything malformed
     */
    declaredLayers: function (report) {
        var rep = this._isPlainObject(report) ? report : {}
        var rcs = this._isArray(rep.root_causes) ? rep.root_causes : []
        var found = []

        for (var i = 0; i < rcs.length; i++) {
            var rc = rcs[i]
            if (!this._isPlainObject(rc) || !this._nonEmptyString(rc.would_confirm)) continue
            var named = this._layersNamedBy(rc.would_confirm)
            for (var j = 0; j < named.length; j++) {
                if (this._indexOf(found, named[j]) === -1) found.push(named[j])
            }
        }

        found.sort(function (a, b) {
            return a - b
        })
        return found
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/PaFixReport.test.js -t "#109"`
Expected: PASS, all cases.

- [ ] **Step 5: Run the whole PaFixReport suite for regressions**

Run: `npx jest test/PaFixReport.test.js`
Expected: PASS. Nothing existing should move — both additions are new methods over unchanged private ones.

- [ ] **Step 6: Commit**

```bash
git add src/server/PaFixReport.js test/PaFixReport.test.js
git commit -m "feat: PaFixReport exposes toolFanOut and declaredLayers (#109)"
```

---

### Task 2: `PaAgentLoop` — target selection and the narrowed release set

**Files:**
- Modify: `src/server/PaAgentLoop.js` — `run()` reset (`:174-177`), `_depthGate` (`:539-583`), new helpers after `_unionTools` (ends `:640`)
- Test: `test/PaAgentLoop.test.js` — `fakeFixReport` (`:78-123`), the `_depthGate` describe (`:883-1055`)

**Interfaces:**
- Consumes: `PaFixReport.toolFanOut()` and `PaFixReport.declaredLayers(report)` from Task 1.
- Produces:
  - `_selectTarget(open, action)` → `{layer: Number, source: 'declared'|'ranked', tools: [String]}` or `null` when no gap can be scored.
  - `this._heldTarget` — the selected target, or `null`. Read by Task 3.
  - `_depthGate(...)` return gains a `target` property carrying the same object (`null` on every ALLOW path and on the `no_layer_report` path).

- [ ] **Step 1: Teach the test fake the two new methods**

In `test/PaAgentLoop.test.js`, inside `fakeFixReport` (after the existing `unsweptGaps`, `:119-121`), add:

```js
        // Directed depth gate (#109). The loop ranks gaps by fan-out and
        // gives the model's own `would_confirm` layer precedence; both come
        // from PaFixReport so the layer map stays single-sourced. These
        // mirror the REAL values of `PaFixReport.toolFanOut()` — a fake that
        // invented its own numbers would test the ranking against a map the
        // product does not have.
        toolFanOut: function () {
            return {
                agent_trace: 1,
                genai_log: 2,
                log_analysis: 3,
                agent_config: 3,
                schema_lookup: 1,
                query_table: 1,
            }
        },
        declaredLayers: function () {
            return declared === undefined ? [] : declared
        },
```

and widen the signature on `:78` to carry the new stub value:

```js
function fakeFixReport(validateResults, gaps, declared) {
```

- [ ] **Step 2: Write the failing tests**

Append a new describe block to `test/PaAgentLoop.test.js`, after the existing `depth gate (#103) — _depthGate` block (ends `:1055`):

```js
// ===========================================================================
// directed depth gate (#109) — target selection
//
// #103 recorded the UNION of every open gap's tools as the release set, so
// one `agent_config` call (layers 2, 3 and 7) discharged the layer-4 and
// layer-5 gaps having touched neither — DECISION.md §P2/§P7, measured 6 of 6.
// The gate now picks ONE target gap and records only its DEDICATED tools.
// Cost is unchanged: still exactly one forced beat.
// ===========================================================================

describe('directed depth gate (#109) — target selection', () => {
    const GAP2 = { layer: 2, name: 'Instructions', reason: 'r2', tools: ['agent_config'] }
    const GAP4 = { layer: 4, name: 'Data schemas', reason: 'r4', tools: ['schema_lookup'] }
    const GAP5 = { layer: 5, name: 'Data', reason: 'r5', tools: ['query_table', 'log_analysis'] }
    const GAP6 = { layer: 6, name: 'GenAI stack', reason: 'r6', tools: ['genai_log', 'log_analysis'] }
    const FIX = { action: 'fix_report', report: { layers_swept: {} } }

    function gateLoop(invoked, gaps, declared) {
        return load({
            auditLogger: fakeAuditLogger({ available: true, tools: invoked }),
            fixReport: fakeFixReport([], gaps, declared),
        })
    }

    test('RANKED: the gap with the most dedicated tool wins over a shared-tool gap', () => {
        const gate = gateLoop(['agent_trace'], [GAP2, GAP4])._depthGate('RUN1', FIX)
        expect(gate.hold).toBe(true)
        expect(gate.target.layer).toBe(4)
        expect(gate.target.source).toBe('ranked')
        expect(gate.target.tools).toEqual(['schema_lookup'])
    })

    test('RANKED: ties break on the lowest layer number', () => {
        // Layers 4 and 5 both have a fan-out-1 tool.
        const gate = gateLoop(['agent_trace'], [GAP4, GAP5])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(4)
    })

    test('RANKED: a fan-out-2 gap outranks a fan-out-3 gap', () => {
        const gate = gateLoop(['agent_trace'], [GAP2, GAP6])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(6)
        expect(gate.target.tools).toEqual(['genai_log'])
    })

    test('NARROWED: a shared tool is dropped from the target gap release set', () => {
        // layer 5 is reachable by query_table (fan-out 1) and log_analysis
        // (fan-out 3, shared with layers 1 and 6). Only the dedicated one is
        // recorded — a log_analysis call must not close a data gap without
        // touching data.
        const gate = gateLoop(['agent_trace'], [GAP5])._depthGate('RUN1', FIX)
        expect(gate.target.tools).toEqual(['query_table'])
    })

    test('NARROWED: the shared tool does NOT release the hold', () => {
        let invoked = ['agent_trace']
        const loop = load({
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: invoked.slice() }
                },
            },
            fixReport: fakeFixReport([], [GAP5]),
        })

        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        invoked = ['agent_trace', 'log_analysis']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        invoked = ['agent_trace', 'log_analysis', 'query_table']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('THE #103 TILT IS CLOSED: agent_config no longer discharges a layer-4 gap', () => {
        let invoked = ['agent_trace']
        const loop = load({
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: invoked.slice() }
                },
            },
            fixReport: fakeFixReport([], [GAP2, GAP4]),
        })

        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        // §P2's measured behaviour: all six v5 runs released on exactly this.
        invoked = ['agent_trace', 'agent_config']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        invoked = ['agent_trace', 'agent_config', 'schema_lookup']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('DECLARED: would_confirm beats the ranking when it names an open gap', () => {
        // Ranking alone would pick layer 4; the model named layer 2.
        const gate = gateLoop(['agent_trace'], [GAP2, GAP4], [2])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(2)
        expect(gate.target.source).toBe('declared')
        expect(gate.target.tools).toEqual(['agent_config'])
    })

    test('DECLARED: the lowest-numbered declared layer that is open wins', () => {
        const gate = gateLoop(['agent_trace'], [GAP2, GAP4, GAP5], [5, 2])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(2)
    })

    test('DECLARED: a named layer that is NOT an open gap falls through to ranked', () => {
        const gate = gateLoop(['agent_trace'], [GAP2, GAP4], [7])._depthGate('RUN1', FIX)
        expect(gate.target.layer).toBe(4)
        expect(gate.target.source).toBe('ranked')
    })

    test('STICKY: the target is recorded at the FIRST hold and a later draft cannot move it', () => {
        let gaps = [GAP2, GAP4]
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: {
                unsweptGaps: function () {
                    return gaps
                },
                toolFanOut: function () {
                    return { agent_config: 3, schema_lookup: 1, query_table: 1, log_analysis: 3 }
                },
                declaredLayers: function () {
                    return []
                },
            },
        })

        const first = loop._depthGate('RUN1', FIX)
        expect(first.target.layer).toBe(4)

        gaps = [GAP5]
        const second = loop._depthGate('RUN1', FIX)
        expect(second.hold).toBe(true)
        expect(second.target.layer).toBe(4)
    })

    test('FALLBACK: an unscorable gap set falls back to the union rather than latching', () => {
        // A PaFixReport with no toolFanOut at all (an older or broken
        // collaborator): no gap can be scored, so the gate must behave as
        // #103 did rather than record an empty, unreleasable set.
        let invoked = ['agent_trace']
        const loop = load({
            auditLogger: {
                invokedTools: function () {
                    return { available: true, tools: invoked.slice() }
                },
            },
            fixReport: {
                unsweptGaps: function () {
                    return [GAP2, GAP4]
                },
            },
        })

        const gate = loop._depthGate('RUN1', FIX)
        expect(gate.hold).toBe(true)
        expect(gate.target).toBe(null)

        invoked = ['agent_trace', 'agent_config']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
    })

    test('R-9: a throwing declaredLayers degrades to the ranked path, it does not trap the run', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: {
                unsweptGaps: function () {
                    return [GAP2, GAP4]
                },
                toolFanOut: function () {
                    return { agent_config: 3, schema_lookup: 1 }
                },
                declaredLayers: function () {
                    throw new Error('boom')
                },
            },
        })

        let gate
        expect(() => {
            gate = loop._depthGate('RUN1', FIX)
        }).not.toThrow()
        expect(gate.target.layer).toBe(4)
        expect(gate.target.source).toBe('ranked')
    })

    test('R-9: a throwing toolFanOut degrades to the union fallback', () => {
        const loop = load({
            auditLogger: fakeAuditLogger({ available: true, tools: ['agent_trace'] }),
            fixReport: {
                unsweptGaps: function () {
                    return [GAP2, GAP4]
                },
                toolFanOut: function () {
                    throw new Error('boom')
                },
            },
        })

        let gate
        expect(() => {
            gate = loop._depthGate('RUN1', FIX)
        }).not.toThrow()
        expect(gate.hold).toBe(true)
        expect(gate.target).toBe(null)
    })

    test('a fresh run() resets the recorded target', () => {
        const loop = gateLoop(['agent_trace'], [GAP2, GAP4])
        loop._depthGate('RUN1', FIX)
        expect(loop._heldTarget).not.toBe(null)

        loop._resetGate()
        expect(loop._heldTarget).toBe(null)
    })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest test/PaAgentLoop.test.js -t "#109"`
Expected: FAIL — `gate.target` is `undefined`, and `loop._resetGate is not a function`.

- [ ] **Step 4: Extract the gate reset**

The `run()` body currently resets the gate inline at `:174-177`. Task 2 adds a fourth field and the reset needs to be reachable from a test, so lift the four lines into a named method. Replace `:174-177`:

```js
        this._gateReleased = false
        this._heldGaps = null
        this._heldTools = null
        this._holdActive = null
```

with:

```js
        this._resetGate()
```

and add the method immediately before `_depthGate` (i.e. before `:539`'s doc comment):

```js
    /**
     * Per-run gate state, cleared at the top of `run()`. Lifted out of the
     * body when #109 added `_heldTarget`, so the reset has exactly one
     * definition and a test can assert it.
     */
    _resetGate: function () {
        this._gateReleased = false
        this._heldGaps = null
        this._heldTools = null
        this._heldTarget = null
        this._holdActive = null
    },
```

- [ ] **Step 5: Write the selection helpers**

Insert immediately after `_unionTools` (which ends at `:640` with `},`):

```js
    /**
     * The FAN-OUT of a gap: the lowest fan-out among the tools that close it
     * (issue #109). A gap reachable only by a tool that closes nothing else
     * scores 1 and is the most worth forcing — nothing else the model does
     * will produce that evidence incidentally.
     *
     * @returns {Number} the score, or -1 when no tool of this gap appears in
     *          the fan-out map at all (an unknown tool, or a degraded map) —
     *          which `_selectTarget` reads as "unscorable" and skips.
     */
    _gapFanOut: function (gap, fanOut) {
        var tools = this._isArray(gap.tools) ? gap.tools : []
        var best = -1
        for (var i = 0; i < tools.length; i++) {
            var score = fanOut[tools[i]]
            if (typeof score !== 'number' || score < 1) continue
            if (best === -1 || score < best) best = score
        }
        return best
    },

    /**
     * The DEDICATED tools of a gap: those whose fan-out equals the gap's own
     * (issue #109). Layer 5 keeps `query_table` and drops `log_analysis`,
     * which also closes layers 1 and 6 and would otherwise discharge a data
     * gap without touching data — DECISION.md §P6's second candidate remedy,
     * falling out of the same rule as the ranking rather than needing one of
     * its own.
     */
    _dedicatedTools: function (gap, fanOut) {
        var best = this._gapFanOut(gap, fanOut)
        if (best === -1) return []
        var tools = this._isArray(gap.tools) ? gap.tools : []
        var out = []
        for (var i = 0; i < tools.length; i++) {
            if (fanOut[tools[i]] === best) out.push(tools[i])
        }
        return out
    },

    /**
     * ONE target gap, and the tools that can close it (issue #109).
     *
     * WHY ONE. #103 recorded the UNION of every open gap's tools, and
     * `_layerToolMap` gives `agent_config` three layers against one apiece
     * for layers 4 and 5 — so the cheapest compliance was a single
     * `agent_config` call that discharged gaps on layers it never touched.
     * Measured 6 of 6 on the v5 smoke (DECISION.md §P2/§P7): holds fired
     * every time and the tools the acceptance test measures were reached
     * zero times. Force was sufficient to make the model act and insufficient
     * to make it act on the right layer.
     *
     * PRECEDENCE. The model's OWN `would_confirm` layer wins when it names an
     * open gap — §P4 recorded a run naming layer 4 correctly and still not
     * calling the tool that closes it, so the model can identify the missing
     * layer and this binds it to its own naming. Otherwise the structural
     * rank: lowest fan-out, ties to the lowest layer number.
     *
     * THE RANK NEVER MENTIONS A TOOL NAME, and neither does the block built
     * from it (`_holdBlock`). §H8 item 3's non-vacuity condition is that the
     * harness does not name the measured tools to the model; the rank is
     * stated over the map's structure and would produce its ordering under a
     * different map. The spec's §8 records the qualification this still
     * carries, and issue #110 records the one that predates it.
     *
     * COST IS UNCHANGED: one target, one release, one forced beat. The
     * stickiness argument in `_depthGate`'s header applies unaltered.
     *
     * @param {Array} open gaps the trail shows were never closed; already
     *        filtered by `_openGaps` to plain objects with an array `tools`
     * @param {Object} action the terminal action carrying the draft
     * @returns {Object|null} {layer, source:'declared'|'ranked', tools} or
     *          `null` when nothing is scorable — the caller then falls back
     *          to #103's union rather than recording an unreleasable set
     */
    _selectTarget: function (open, action) {
        var fanOut = this._safeFanOut()
        var report = this._isPlainObject(action) ? action.report : null
        var declared = this._safeDeclaredLayers(report)
        var chosen = null
        var source = ''
        var i

        // 1. Declared. `declaredLayers` returns ascending, so the first
        //    match is the lowest-numbered declared layer that is open.
        for (var d = 0; d < declared.length && chosen === null; d++) {
            for (i = 0; i < open.length; i++) {
                if (open[i].layer === declared[d]) {
                    chosen = open[i]
                    source = 'declared'
                    break
                }
            }
        }

        // 2. Ranked. `open` arrives in ascending layer order and the
        //    comparison is STRICTLY less-than, so the first minimum wins —
        //    which is the ascending tie-break, without a second sort.
        if (chosen === null) {
            var best = -1
            for (i = 0; i < open.length; i++) {
                var score = this._gapFanOut(open[i], fanOut)
                if (score === -1) continue
                if (best === -1 || score < best) {
                    best = score
                    chosen = open[i]
                }
            }
            source = 'ranked'
        }

        if (chosen === null) return null

        var tools = this._dedicatedTools(chosen, fanOut)
        if (tools.length === 0) return null

        return { layer: chosen.layer, source: source, tools: tools }
    },

    /**
     * `PaFixReport.toolFanOut()`, guarded. Same standard as
     * `_safeSchemaText`/`_safeGaps`: a broken or absent PaFixReport degrades
     * the gate to #103's union behaviour, never trapping the run.
     */
    _safeFanOut: function () {
        try {
            var map = this._reports().toolFanOut()
            return this._isPlainObject(map) ? map : {}
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            return {}
        }
    },

    /**
     * `PaFixReport.declaredLayers()`, guarded. A failure here means "the
     * model declared nothing", which falls to the structural rank — a strictly
     * milder degradation than losing the gate.
     */
    _safeDeclaredLayers: function (report) {
        try {
            var layers = this._reports().declaredLayers(report)
            return this._isArray(layers) ? layers : []
        } catch (e) {
            // R-1: `e` is deliberately not inspected.
            return []
        }
    },
```

- [ ] **Step 6: Wire selection into `_depthGate`**

Replace the sticky-branch return at `:564`:

```js
            return { hold: true, gaps: this._heldGaps, kind: 'gaps' }
```

with:

```js
            return { hold: true, gaps: this._heldGaps, kind: 'gaps', target: this._heldTarget }
```

Replace the first-hold recording at `:580-582`:

```js
        this._heldGaps = open
        this._heldTools = this._unionTools(open)
        return { hold: true, gaps: open, kind: 'gaps' }
```

with:

```js
        // #109: ONE target gap, and only its dedicated tools, instead of the
        // union of every gap's tools. `null` means nothing was scorable —
        // fall back to #103's union rather than recording an empty,
        // unreleasable set (the same reasoning as the I2 guard above).
        var target = this._selectTarget(open, action)
        this._heldGaps = open
        this._heldTarget = target
        this._heldTools = target === null ? this._unionTools(open) : target.tools
        return { hold: true, gaps: open, kind: 'gaps', target: target }
```

Add `target: null` to each of the four ALLOW returns (`:540`, `:543`, `:562`, `:577`) and to the `no_layer_report` return (`:571`), so every caller sees the property. For example `:540` becomes:

```js
        if (this._gateReleased) return { hold: false, gaps: [], kind: '', target: null }
```

- [ ] **Step 7: Run the new tests to verify they pass**

Run: `npx jest test/PaAgentLoop.test.js -t "#109"`
Expected: PASS, all cases.

- [ ] **Step 8: Fix the one #103 test whose behaviour changes by design**

Run: `npx jest test/PaAgentLoop.test.js -t "#103"`
Expected: exactly one FAIL — `STICKY: the recorded gap set releases the gate, and later gaps do not re-hold` (`:948`). It closes layer 2 with `agent_config` against a recorded set of `{2, 4}` and expects release. That is precisely the tilt #109 removes: the target is now layer 4, and `agent_config` is no longer in the recorded set.

**If any OTHER #103 test fails, stop and report it** — the rest of the gate's behaviour is meant to be untouched.

Update that test in place. Replace its body from the first `expect` to the end:

```js
        // First evaluation records layers {2,4}. Under #109 the TARGET is
        // layer 4 — `schema_lookup` closes nothing else, while `agent_config`
        // also closes layers 3 and 7 — so the recorded set is
        // {schema_lookup}, not the union.
        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        // Closing layer 2 no longer releases: that is the #103 tilt (§P7,
        // six of six releases) which #109 exists to remove.
        invoked = ['agent_trace', 'agent_config']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(true)

        // The target's own tool releases it.
        invoked = ['agent_trace', 'agent_config', 'schema_lookup']
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)

        // A later draft naming a brand-new gap must NOT re-hold: the gate
        // buys ONE forced beat, it does not chase a full sweep.
        gaps = [GAP5]
        expect(loop._depthGate('RUN1', FIX).hold).toBe(false)
```

Note this test builds its fake inline (`:951-962`) without `toolFanOut`/`declaredLayers`, so add both to it, matching the values in Step 1's `fakeFixReport`.

- [ ] **Step 9: Run the full suite**

Run: `npx jest`
Expected: PASS, all files. If `test/blindRule.test.js` or `test/observationChannel.test.js` fail, stop and report — they guard cross-cutting invariants this task must not touch.

- [ ] **Step 10: Commit**

```bash
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "feat: depth gate targets ONE layer and records only its dedicated tools (#109)"
```

---

### Task 3: The interrogation and the transcript note

**Files:**
- Modify: `src/server/PaAgentLoop.js` — `_holdBlock` (`:679-717`), `_holdNote` (`:731-748`), the call site (`:289`)
- Test: `test/PaAgentLoop.test.js` — the `_holdBlock` and `_holdNote` describes

**Interfaces:**
- Consumes: `_heldTarget` / `gate.target` from Task 2 — `{layer, source, tools}` or `null`.
- Produces: `_holdBlock(gaps, kind, target)` — third parameter optional; when absent or malformed the block keeps #103's generic item 2 wording. `_holdNote(gate)` reads `gate.target` the same way.

- [ ] **Step 1: Write the failing tests**

Append to `test/PaAgentLoop.test.js`:

```js
// ===========================================================================
// directed depth gate (#109) — the directed interrogation
//
// Item 2 used to ask the model which layer mattered most. The harness now
// answers that itself, so leaving the question would be theatre. It still
// names a LAYER and never a tool — see the #103 GUARD tests, which must keep
// passing unchanged.
// ===========================================================================

describe('directed depth gate (#109) — _holdBlock', () => {
    const GAPS = [
        { layer: 2, name: 'Instructions', reason: 'the trace showed no routing problem', tools: ['agent_config'] },
        { layer: 4, name: 'Data schemas', reason: 'no schema read was needed', tools: ['schema_lookup'] },
    ]

    test('RANKED: states which layer must be closed, and why that one', () => {
        const block = load()._holdBlock(GAPS, 'gaps', { layer: 4, source: 'ranked', tools: ['schema_lookup'] })
        expect(block).toContain('layer 4')
        expect(block).toMatch(/no other line of investigation reaches/i)
        expect(block).toMatch(/Call a tool that reaches layer 4/i)
    })

    test('DECLARED: quotes the model back to itself instead', () => {
        const block = load()._holdBlock(GAPS, 'gaps', { layer: 2, source: 'declared', tools: ['agent_config'] })
        expect(block).toContain('layer 2')
        expect(block).toMatch(/your own report names it/i)
        expect(block).toMatch(/Call a tool that reaches layer 2/i)
    })

    test('both gaps still appear — the target directs, it does not hide the rest', () => {
        const block = load()._holdBlock(GAPS, 'gaps', { layer: 4, source: 'ranked', tools: ['schema_lookup'] })
        expect(block).toContain('layer 2 (Instructions)')
        expect(block).toContain('layer 4 (Data schemas)')
    })

    test('item 1 is unchanged — it still asks for a quoted field', () => {
        const block = load()._holdBlock(GAPS, 'gaps', { layer: 4, source: 'ranked', tools: ['schema_lookup'] })
        expect(block).toMatch(/quote/i)
    })

    test('the draft-is-preserved closing survives verbatim', () => {
        const block = load()._holdBlock(GAPS, 'gaps', { layer: 4, source: 'ranked', tools: ['schema_lookup'] })
        expect(block).toContain('preserved')
        expect(block).toMatch(/resubmit/i)
    })

    test.each([undefined, null, {}, { layer: 'four' }, 42])(
        'R-9: a missing or malformed target (%p) keeps the #103 generic wording rather than throwing',
        (target) => {
            let block
            expect(() => {
                block = load()._holdBlock(GAPS, 'gaps', target)
            }).not.toThrow()
            expect(block).toContain('HOLD')
            expect(block).toMatch(/did it not settle|not settle/i)
        }
    )

    test('GUARD: the directed variants still never name a measured tool', () => {
        const ranked = load()._holdBlock(
            [{ layer: 4, name: 'Data schemas', reason: 'r', tools: ['schema_lookup'] }],
            'gaps',
            { layer: 4, source: 'ranked', tools: ['schema_lookup'] }
        )
        const declared = load()._holdBlock(
            [{ layer: 5, name: 'Data', reason: 'r', tools: ['query_table'] }],
            'gaps',
            { layer: 5, source: 'declared', tools: ['query_table'] }
        )
        ;[ranked, declared].forEach((block) => {
            expect(block).not.toContain('schema_lookup')
            expect(block).not.toContain('query_table')
            expect(block).not.toContain('genai_log')
        })
    })
})

describe('directed depth gate (#109) — _holdNote', () => {
    const GAPS = [
        { layer: 2, name: 'Instructions', reason: 'r', tools: ['agent_config'] },
        { layer: 4, name: 'Data schemas', reason: 'r', tools: ['schema_lookup'] },
    ]

    test('records the target layer and the selection source', () => {
        const note = load()._holdNote({
            kind: 'gaps',
            gaps: GAPS,
            target: { layer: 4, source: 'ranked', tools: ['schema_lookup'] },
        })
        expect(note).toContain('layer 4')
        expect(note).toContain('ranked')
    })

    test('records the declared source distinctly — the smoke tells the two paths apart by this', () => {
        const note = load()._holdNote({
            kind: 'gaps',
            gaps: GAPS,
            target: { layer: 2, source: 'declared', tools: ['agent_config'] },
        })
        expect(note).toContain('declared')
    })

    test('stays inside DIGEST_CHARS (200) — the #72 / §G3a constraint', () => {
        const note = load()._holdNote({
            kind: 'gaps',
            gaps: [
                { layer: 1, name: 'Execution', reason: 'r', tools: ['agent_trace'] },
                { layer: 2, name: 'Instructions', reason: 'r', tools: ['agent_config'] },
                { layer: 3, name: 'Tools', reason: 'r', tools: ['agent_config'] },
                { layer: 4, name: 'Data schemas', reason: 'r', tools: ['schema_lookup'] },
                { layer: 5, name: 'Data', reason: 'r', tools: ['query_table'] },
                { layer: 6, name: 'GenAI stack', reason: 'r', tools: ['genai_log'] },
                { layer: 7, name: 'Platform', reason: 'r', tools: ['agent_config'] },
            ],
            target: { layer: 4, source: 'declared', tools: ['schema_lookup'] },
        })
        expect(note.length).toBeLessThanOrEqual(200)
    })

    test('R-9: a missing target is omitted rather than dereferenced', () => {
        let note
        expect(() => {
            note = load()._holdNote({ kind: 'gaps', gaps: GAPS })
        }).not.toThrow()
        expect(note).toContain('HOLD')
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/PaAgentLoop.test.js -t "#109 — _hold"`
Expected: FAIL — the block ignores its third argument, so the directed wording is absent and `Call a tool that reaches layer 4` does not appear.

- [ ] **Step 3: Implement the directed item 2 and item 3**

In `_holdBlock`, change the signature (`:679`) to `function (gaps, kind, target)` and replace the `Before concluding:` section (`:705-710`):

```js
        lines.push('Before concluding:')
        lines.push('  1. What did the last tool result actually establish? Quote the specific field')
        lines.push('     or value you are relying on.')
        lines.push('  2. What did it NOT settle? Of the layers above, name the one whose answer would')
        lines.push('     most change your conclusion.')
        lines.push('  3. Call a tool that reaches that layer.')
```

with:

```js
        // #109: items 2 and 3 are DIRECTED. #103 asked the model which layer
        // mattered most and accepted any tool call in reply, so the cheapest
        // release — one `agent_config` call, which the map credits with three
        // layers — discharged gaps on layers it never touched (§P2/§P7, six
        // of six). The target is chosen in `_selectTarget`; this only renders
        // it, and it renders a LAYER NUMBER, never a tool name.
        var directed = this._isPlainObject(target) && typeof target.layer === 'number'

        lines.push('Before concluding:')
        lines.push('  1. What did the last tool result actually establish? Quote the specific field')
        lines.push('     or value you are relying on.')

        if (!directed) {
            // R-9: no usable target (an unscorable gap set, or a degraded
            // PaFixReport) — fall back to #103's wording rather than
            // rendering a hold that directs at nothing.
            lines.push('  2. What did it NOT settle? Of the layers above, name the one whose answer would')
            lines.push('     most change your conclusion.')
            lines.push('  3. Call a tool that reaches that layer.')
        } else {
            if (target.source === 'declared') {
                lines.push(
                    '  2. Layer ' + target.layer + ' is the one this run needs closed — your own report ' +
                        'names it as what would confirm your finding.'
                )
            } else {
                lines.push(
                    '  2. Of the layers above, layer ' + target.layer + ' is the one no other line of ' +
                        'investigation reaches.'
                )
            }
            lines.push('  3. Call a tool that reaches layer ' + target.layer + '.')
        }
```

Then update the call site at `:289`:

```js
                this._holdActive = this._holdBlock(gate.gaps, gate.kind, gate.target)
```

- [ ] **Step 4: Implement the note**

In `_holdNote`, after the `nums` loop and before the return (`:747`), replace the return with:

```js
        var note = 'HOLD: terminal action refused — '
        if (this._isPlainObject(gate.target) && typeof gate.target.layer === 'number') {
            // #109: the SOURCE is what lets a smoke tell the declared path
            // from the ranked one after the fact, without re-deriving it.
            note += 'layer ' + gate.target.layer + ' (' + this._str(gate.target.source) + ') must be reached; '
        }
        return note + 'layer(s) ' + nums.join(', ') + ' declared NOT_SWEPT with no tool call behind them.'
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest test/PaAgentLoop.test.js -t "#109"`
Expected: PASS, all cases.

- [ ] **Step 6: Run the full suite**

Run: `npx jest`
Expected: PASS, all files. The #103 `GUARD` and `I3` scrub tests must be green **without modification** — they call `_holdBlock(gaps, 'gaps')` with no target and now exercise the fallback path.

- [ ] **Step 7: Update the class header**

`PaAgentLoop.js:63-69` describes the gate. Add one sentence recording that the gate now targets a single layer, citing #109 and DECISION.md §P, in the style of the surrounding header.

- [ ] **Step 8: Commit**

```bash
git add src/server/PaAgentLoop.js test/PaAgentLoop.test.js
git commit -m "feat: the hold block directs at the target layer, and the note records it (#109)"
```

---

### Task 4: Build, deploy, and verify the deploy

**Files:**
- Modify: `package.json:3`, `README.md:3`, `CHANGELOG.md`

- [ ] **Step 1: Bump the version**

`package.json:3` → `"version": "2026.08.0403"`. `README.md:3` badge → `version-2026.08.0403-blue`.

- [ ] **Step 2: Write the changelog entry**

Add a `2026.08.0403` section at the top of the entries in `CHANGELOG.md`, matching the surrounding style: what changed (single-target selection, dedicated-tool release set, directed interrogation), why (§P2/§P7, six of six releases on `agent_config`), and the issue (#109).

- [ ] **Step 3: Build**

Run: `now-sdk build`
Expected: success. A failure here is a Fluent/SDK problem, not a logic problem — check `.claude/context/sdk-reference.md` build rules before changing any source.

- [ ] **Step 4: Install**

Run: `now-sdk install --alias gpinst01`
Expected: success.

- [ ] **Step 5: Verify the deploy by CONTENT, not by timestamp**

Read the installed `PaAgentLoop` Script Include body back through the foundry MCP broker (`servicenow_connect`, then `servicenow_code` or `servicenow_query` against `sys_script_include`) and compare `_selectTarget` and `_dedicatedTools` literally against `src/server/PaAgentLoop.js`.

**Do NOT accept `sys_script_include.sys_updated_on` as evidence.** DECISION.md §P1 recorded it reading `2026-08-02` immediately after a successful install — the content was branch HEAD and the timestamp was stale. A pass that checks only the timestamp will wrongly conclude the install did not land.

- [ ] **Step 6: Commit**

```bash
git add package.json README.md CHANGELOG.md
git commit -m "chore: version 2026.08.0403 + changelog for the directed depth gate (#109)"
```

---

### Task 5: The live smoke and the write-up

**Files:**
- Create: `benchmark/raw-evidence-v6-directed-depth.md`
- Modify: `benchmark/DECISION.md` (append §Q only — the file is append-only)

- [ ] **Step 1: Run the smoke**

**Six runs: seeds 01, 03, 04, two each, custom harness only.** Fire sequentially, polling each to a terminal status before POSTing the next. No native arm — nothing native-facing moved on this branch, so §K5 / §I4 confound 3 stays closed.

- [ ] **Step 2: Capture the evidence**

Into `benchmark/raw-evidence-v6-directed-depth.md`, following `raw-evidence-v5-depth-smoke.md`'s structure: per-run tool calls with audit-row confirmation, `layers_swept` labels, verbatim delivered reports, and **at least one verbatim captured hold prompt** read from `sys_generative_ai_log` — confirming the directed item 2 rendered whole and named no tool.

Per-run, record the **target layer and selection source** from the `_holdNote` transcript entry. Q7 is scored from these.

- [ ] **Step 3: Score Q1–Q8**

Score each prediction from the spec §10 table HELD or REFUTED against the evidence. **A prediction that was wrong is recorded as wrong regardless of which way it was wrong** — §P2's treatment of P4 is the precedent.

Check both revert triggers explicitly: `partial` above 2 of 6, or the unsupported-sweep-claim rate rising above v5's 0 of 6. If either fired, **stop and report before writing §Q** — the pre-registered response is to revert, not to tune.

- [ ] **Step 4: Write §Q**

Append to `benchmark/DECISION.md`, following §P's structure: what was run, the scored predictions table, what the smoke establishes, any countervailing observation that cuts against the headline, what it does NOT establish, and the recommendation.

Carry §8 of the spec forward: **a §H8 pass earned under this design is reported with its qualification attached, not as a clean pass.**

- [ ] **Step 5: Commit and open the PR**

```bash
git add benchmark/
git commit -m "bench: v6 directed-depth smoke, DECISION.md section Q (#109)"
git push -u origin feature/directed-depth-gate
gh pr create --title "Directed depth gate: target ONE layer, release on its dedicated tools (#109)" --body "..."
```

The PR body should state the Q1–Q8 outcomes and whether §H8's acceptance test was met.

---

## Self-Review

**Spec coverage:** §4.1 selection → Task 2 Step 5. §4.2 narrowing → Task 2 Steps 5–6. §4.3 stickiness → Task 2 Step 2's STICKY test. §5 interrogation → Task 3. §6 state/degradation → Task 2 Steps 4–5 and Task 3 Step 3's fallback. §7 files → the File Structure table, with the `toolFanOut()` deviation flagged. §8 non-vacuity → Task 2 Step 5's doc comment and Task 3's GUARD test. §9's nine tests → all present: (1) Task 2 DECLARED-beats-ranked, (2) DECLARED-falls-through, (3) RANKED order + tie-break, (4) NARROWED shared tool, (5) STICKY, (6) R-9 pair, (7) FALLBACK, (8) `_holdNote` source + 200 chars, (9) GUARD on both variants. §10 smoke → Task 5. §11–12 reading/limits → Task 5 Step 4.

**Placeholder scan:** the only `"..."` is the `gh pr create --body` argument, whose content is specified in the sentence beneath it.

**Type consistency:** `_selectTarget` returns `{layer, source, tools}` in Task 2 and is read as `target.layer` / `target.source` in Task 3 — consistent. `toolFanOut()` returns `{tool: Number}` in Task 1 and is indexed as `fanOut[toolName]` in Task 2 — consistent. `declaredLayers(report)` returns `[Number]` in Task 1 and is compared against `open[i].layer` (a number) in Task 2 — consistent. `_resetGate()` is created in Task 2 Step 4 and asserted in Task 2 Step 2's last test — consistent.
