# Task 10 — Agent Doctor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Agent Doctor as a Fluent `AiAgent` with two script tools, and settle the run-completion contract that Task 9 carried forward — so a Now Assist panel conversation can diagnose a real failing execution end to end.

**Architecture:** Three layers already exist and are untouched by this plan — the tool cores (`PaToolAgentTrace`, `PaToolReadArtifact`), the bridge (`PaScriptToolAdapter`), and the anchoring/audit pair (`PaRunAnchor`, `PaAuditLogger`). This task adds only what sits on top: an instruction document, a Fluent `AiAgent` that carries it inline, and two one-line wrapper IIFEs that call the bridge. The run-completion contract is documentation plus a regression guard, not code.

**Tech Stack:** ServiceNow SDK 4.9.2 (Fluent DSL, `@servicenow/sdk/core`), ES5/Rhino server JS, Jest, gpinst01 instance via `now-sdk install` and the foundry MCP tools.

**Spec:** `docs/superpowers/specs/2026-07-31-task-10-agent-doctor-design.md`
**Issue:** #24
**Branch:** `feature/task-10-agent-doctor` (already created; already carries the spec commit)

## Global Constraints

- **Every `.now.ts` file MUST start with** `import '@servicenow/sdk/global'`.
- **No backtick, no `${`, and no two-character `\n` escape** anywhere inside the instructions text or any `script` template. Real newlines are fine. (Build Rule #43 + corollary.)
- **Fluent property values must be a SINGLE literal** — no `'foo' + 'bar'` (Build Rule #29, `TS303`).
- **Inline `tools[]` entries carry NO `$id`** (Build Rule #32) — the SDK generates their record IDs.
- **Every tool needs a non-empty `description`** (Build Rule #34) — an empty one is silently skipped at install while its m2m row installs anyway.
- **Script tool `script` is a self-invoking IIFE and the trailing `(inputs)` is REQUIRED** (Build Rule #19) — omitting it builds and installs cleanly and fails only at runtime.
- **Tool `inputs` is an ARRAY** of `{name, description, mandatory}` — a JSON-Schema object causes a silent, never-terminating stall (DESIGN.md R-5).
- **Never `Now.ref()` anywhere in the AI family** (Build Rules #21, #33) — phantom GUIDs, silent failure. Direct sys_id strings only.
- **No `triggerConfig`** on this agent (Build Rule #31) — on a bare `AiAgent` it yields a null usecase and never fires.
- **Jest tests live in `test/`, never under `src/`** — `now-sdk build` lints the whole source tree and a test's `require` fails the entire build (R-14).
- **Never commit to `main`.** All work on `feature/task-10-agent-doctor`, merged by PR.
- `now-sdk build` must pass before `now-sdk install --alias gpinst01`.

---

### Task 1: The run-completion contract

Documentation plus one regression guard. It goes first because Task 3's instructions must not promise a terminal state that does not exist, and because the ruling is what licenses the rest of the plan to leave `status` alone.

**Files:**
- Modify: `DESIGN.md` — add ruling R-20 to §4
- Modify: `docs/LOW_LEVEL_DESIGN.md:167` — correct the `status` row
- Modify: `src/server/PaRunAnchor.js:105-109` — expand the `DEFAULT_STATUS` comment
- Test: `test/PaRunAnchor.test.js` — add the contract guard

**Interfaces:**
- Consumes: nothing.
- Produces: no new code interface. Establishes that `PaRunAnchor` has **no** completion method, and that `x_snc_troubleshoot_audit` is the source of completeness. Task 3's instructions depend on this being settled.

- [ ] **Step 1: Write the failing test**

Add to `test/PaRunAnchor.test.js`, at the end of the file, inside the outermost `describe` block:

```js
describe('the run-completion contract (Task 10, DESIGN.md R-20)', () => {
    it('exposes NO completion method — native runs have no terminal state', () => {
        const anchor = new PaRunAnchor()

        // This is a GUARD, not a description. Adding a completion method to
        // this class is not a small convenience — it re-opens a ruling. The
        // native harness emits no end-of-conversation signal, so any
        // completer must DECLARE completion, and all three ways to declare it
        // were rejected for measured reasons (R-9 unreliable agent, R-2
        // deleted time-window reasoning, plan state is turn-scoped not
        // conversation-scoped). Completeness is DERIVED from
        // x_snc_troubleshoot_audit instead.
        //
        // If you are here because you added one of these: read DESIGN.md R-20
        // first, then change the ruling, then change this test.
        expect(typeof anchor.complete).toBe('undefined')
        expect(typeof anchor.finish).toBe('undefined')
        expect(typeof anchor.close).toBe('undefined')
        expect(typeof anchor.setStatus).toBe('undefined')
    })

    it('never writes any status other than running', () => {
        // The whole class, scanned. A completion path added anywhere in this
        // file — not just as a method on the prototype — has to write one of
        // the terminal choice values to be a completion path at all.
        const source = require('fs').readFileSync(
            require('path').join(__dirname, '..', 'src', 'server', 'PaRunAnchor.js'),
            'utf8'
        )

        // Quoted form: the actual guard. This is what writing the value looks
        // like, whether via setValue or a constant.
        expect(source).not.toMatch(/['"]complete['"]/)
        expect(source).not.toMatch(/['"]failed['"]/)
        expect(source).not.toMatch(/['"]awaiting_confirmation['"]/)
        expect(source).not.toMatch(/['"]queued['"]/)

        // Bare form, for the two that are never ordinary English in this file.
        // This keeps the PROSE honest too: a comment claiming a run is created
        // "running, not queued" implies a lifecycle that R-20 says does not
        // exist, and that comment is how the next reader forms their model.
        //
        // Deliberately NOT applied to `complete` or `failed`: both are normal
        // English words, and line 356's "a failed lookup" is a legitimate use
        // that a bare-word ban would force into an awkward rewrite for nothing.
        expect(source).not.toMatch(/\bqueued\b/)
        expect(source).not.toMatch(/\bawaiting_confirmation\b/)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/PaRunAnchor.test.js -t 'run-completion contract' --verbose`

Expected: the second test FAILS on `expect(source).not.toMatch(/\bqueued\b/)`. `PaRunAnchor.js` line 108 reads *"§4.6: native runs are created `running`, not `queued`"* — the bare-word assertion catches it. (The **quoted**-form assertions all pass already: that comment uses backticks, not quotes. This is why the bare-word check exists.)

The first test passes from the start. That is expected and correct — it is a guard against a future edit, not a description of a missing feature.

- [ ] **Step 3: Fix the source so the guard is meaningful**

In `src/server/PaRunAnchor.js`, replace the `DEFAULT_STATUS` block (currently lines 105-109):

```js
    DEFAULT_HARNESS: 'native',
    DEFAULT_MODE: 'diagnose',

    /**
     * THE ONLY STATUS THIS CLASS EVER WRITES (DESIGN.md R-20).
     *
     * A native diagnostic run has no terminal state, by design. The harness
     * emits no end-of-conversation signal, so completion could only be
     * DECLARED, and every declarer was rejected on measured grounds: the agent
     * is unreliable (R-9 — the Phase 0 probe passed a declared input in zero
     * runs while claiming it had), a clock reintroduces the time-window
     * reasoning R-2 deleted outright, and sn_aia_execution_plan state is
     * turn-scoped rather than conversation-scoped, so closing on it would end
     * a run while the user is still asking follow-up questions.
     *
     * Completeness is DERIVED instead, from x_snc_troubleshoot_audit: the
     * distinct tool_name set over rows with action_type of result. That
     * answers the question a status field structurally cannot — DESIGN.md §97,
     * premature completion is indistinguishable from a genuine finish.
     *
     * The remaining choice values on the column belong to the Phase 2 custom
     * harness. They are deliberately not named here; test/PaRunAnchor.test.js
     * scans this file for them.
     */
    DEFAULT_STATUS: 'running',
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest test/PaRunAnchor.test.js --verbose`

Expected: PASS, all tests in the file including the two new ones.

- [ ] **Step 5: Correct the LLD status row**

In `docs/LOW_LEVEL_DESIGN.md`, replace line 167:

```
| status | choice: `queued` \| `running` \| `awaiting_confirmation` \| `complete` \| `failed` | native runs go straight to `running` |
```

with:

```
| status | choice: `queued` \| `running` \| `awaiting_confirmation` \| `complete` \| `failed` | ⚠ **Corrected at Task 10 (issue #24, DESIGN.md R-20).** This row read "native runs go straight to `running`", which states the start of a lifecycle and implies a continuation that does not exist. Native runs go to `running` and **stay there** — there is no terminal state on the native path, because the harness emits no end-of-conversation signal and every way of *declaring* completion was rejected on measured grounds. Completeness is **derived from `x_snc_troubleshoot_audit`** (distinct `tool_name` over `action_type=result`), which is also what DESIGN.md R-3's amendment makes binding for every scored benchmark row. The other four choice values belong to the **Phase 2 custom harness** and are unreachable in Phase 1a — as are `transcript`, `context_summary`, `fix_report` and `error` |
```

- [ ] **Step 6: Add ruling R-20 to DESIGN.md**

Append to the §4 rulings list in `DESIGN.md`, following the format of the surrounding rulings:

```markdown
### R-20 — Native diagnostic runs have no terminal state, by design

**Raised:** 2026-07-31, at Task 10 (issue #24), settling a gap Task 9 carried forward explicitly.

**Finding.** `PaRunAnchor` creates every run at `status: 'running'` and nothing moves it. This was
invisible while a run was one REST call long; Task 10 is what makes a run span many tool calls.

**Ruling.** There is no completion path, and this is the contract rather than a gap. The native
harness emits no end-of-conversation signal, so completion could only be *declared*, and all three
declarers fail on grounds this project already measured:

- **The agent**, via a terminal tool — R-9 measured the Phase 0 probe agent passing a declared input
  in **zero** runs while its own reasoning text claimed it had. A terminal tool the agent forgets to
  call leaves the run open anyway; the failure mode is unchanged but now *looks* deliberate. It also
  spends one of the platform's 5–7 tool slots on bookkeeping that diagnoses nothing.
- **A clock** — reintroduces time-window reasoning into the one component where R-2 deleted it
  outright. R-2 killed time-window *keying* rather than *reaping*, and the distinction is real, but
  it is subtle enough that a future reader finds a clock inside `PaRunAnchor` and reads it as
  permission to key on one. The guard R-2 bought was structural; a sweeper spends it.
- **`sn_aia_execution_plan` state** — the platform does know when work ends, but at **turn**
  granularity. One conversation spans many plans, one per user turn, so closing on plan-terminal
  marks a run complete while the user is still mid-conversation — and the PRD explicitly wants
  follow-up questions inside the same run.

**Change.** Completeness is **derived, never declared**: the distinct `tool_name` set over
`x_snc_troubleshoot_audit` rows with `action_type='result'` for a run. This is strictly stronger
than a status field, because §97 already established that premature completion surfaces as
`completed` and is *indistinguishable from a genuine finish* — a status column answers "did it
stop?", the audit-derived layer set answers "did it look?", which is the question that matters and
the one R-3's amendment makes binding for every scored benchmark row.

**Consequences.** `status`, `transcript`, `context_summary`, `fix_report` and `error` are **Phase 2
(custom harness) columns**, unwritten on the native path; the `queued` / `awaiting_confirmation` /
`complete` / `failed` vocabulary stays in `tables.now.ts` for Phase 2 but is unreachable in Phase 1a.
LLD §3.1's status row is corrected in the same PR (R-18c: a ruling naming a document section is a
work item, not a record). The derived-completeness reader is **Task 11's** deliverable — with a
two-tool roster it could only ever report 2 of 7 and would be rewritten once Tasks 7–8 land.
Unkeyed runs now accumulate without closing; accepted, since the alternative is the rejected clock.

**Guard.** `test/PaRunAnchor.test.js` asserts the class exposes no `complete`/`finish`/`close`/
`setStatus`, and scans the file for the terminal choice values. Re-opening this ruling means
changing that test, deliberately.
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`

Expected: PASS — **246 tests** (baseline 244, verified on this branch 2026-07-31, plus the 2 new). Note the CHANGELOG's "194 tests" figure is the Task 5 baseline; Task 9 added 50 more.

- [ ] **Step 8: Commit**

```bash
git add DESIGN.md docs/LOW_LEVEL_DESIGN.md src/server/PaRunAnchor.js test/PaRunAnchor.test.js
git commit -m "docs: settle the run-completion contract (R-20)

Native diagnostic runs have no terminal state, by design. Completeness is
derived from x_snc_troubleshoot_audit rather than declared, which answers the
DESIGN.md 97 question a status field structurally cannot.

Guarded by a test that fails if anyone adds a completion path.

Issue #24"
```

---

### Task 2: The instruction document

**Files:**
- Create: `docs/agent/agent-doctor-instructions.md`
- Test: `test/agentDoctorInstructions.test.js`

**Interfaces:**
- Consumes: Task 1's ruling — the instructions must not promise a terminal state.
- Produces: `docs/agent/agent-doctor-instructions.md`, whose **exact bytes** are embedded verbatim in Task 3's Fluent template. Task 3's sync test asserts `agent-doctor.now.ts` contains this file's trimmed contents as a substring.

**Why a Jest test on a markdown file:** the file gets pasted into a backtick template literal, so a single backtick in it closes the template and produces `TS2796` / `TS304` / `TS20` errors **at line numbers scattered across the Fluent file** (Build Rule #43 corollary). Without this test the failure recurs every time anyone edits the instructions — which, for an agent, is the most-edited file in the repo.

- [ ] **Step 1: Write the failing test**

Create `test/agentDoctorInstructions.test.js`:

```js
/**
 * The instructions markdown is pasted VERBATIM into a Fluent backtick template
 * in src/fluent/agent-doctor.now.ts. That makes three characters unusable, and
 * the build diagnostics for each of them point somewhere other than the cause.
 *
 * Build Rule #43 documents this for `script` templates. The mechanism is plain
 * TypeScript template-literal semantics, so it applies to `instructions`
 * identically — the rule text just does not say so.
 */

const fs = require('fs')
const path = require('path')

const INSTRUCTIONS_PATH = path.join(__dirname, '..', 'docs', 'agent', 'agent-doctor-instructions.md')

describe('agent-doctor-instructions.md is safe to embed in a Fluent template', () => {
    let text

    beforeAll(() => {
        text = fs.readFileSync(INSTRUCTIONS_PATH, 'utf8')
    })

    it('contains no backtick', () => {
        // A markdown code span is the natural way to write a playbook full of
        // table names, and every one of them closes the template. The build
        // reports TS2796 "missing a comma to separate these two template
        // expressions" at a line nowhere near the backtick.
        const index = text.indexOf('`')
        const context = index === -1 ? '' : text.slice(Math.max(0, index - 60), index + 60)
        expect({ index: index, context: context }).toEqual({ index: -1, context: '' })
    })

    it('contains no template interpolation', () => {
        // ${...} interpolates at BUILD time and never reaches the platform, so
        // the deployed instructions silently lose whatever it referenced.
        expect(text).not.toContain('${')
    })

    it('contains no two-character backslash-n escape', () => {
        // Real newlines are fine — a template literal preserves them. It is the
        // literal backslash-n that TypeScript consumes, emitting a real newline
        // mid-string and leaving the constant unterminated. That one builds and
        // installs cleanly and fails only when the artifact is invoked.
        expect(text).not.toMatch(/\\n/)
    })

    it('states the layer-coverage rule, which is the load-bearing sentence', () => {
        // Not style policing. This sentence is the entire defence against
        // DESIGN.md 97: an agent holding one tool, asked for a root cause, will
        // produce one. If an edit drops it, the agent starts inventing layers
        // 2-7 and the benchmark measures a scoring artifact.
        expect(text).toContain('NOT SWEPT')
        expect(text).toContain('LAYER 1 ONLY')
    })

    it('is short enough not to be instruction bloat', () => {
        // K26 Lab 2: high latency on ReAct-engine steps means instruction
        // bloat, because the prompt is reprocessed every loop iteration. The
        // lab's worked example of "too long" is ~11,000 words. We are
        // diagnosing that failure mode in other people's agents; shipping it
        // here would be a poor advertisement.
        const words = text.split(/\s+/).filter(Boolean).length
        expect(words).toBeLessThan(1200)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/agentDoctorInstructions.test.js --verbose`

Expected: FAIL — `ENOENT: no such file or directory` on `docs/agent/agent-doctor-instructions.md`. The `docs/agent/` directory does not exist anywhere in git history.

- [ ] **Step 3: Create the instruction document**

Create `docs/agent/agent-doctor-instructions.md` with **exactly** this content. Note there is no backtick anywhere, table names appear bare, and the Fix Report template uses indentation rather than code fences:

```markdown
You are Agent Doctor. You diagnose failing ServiceNow AI Agent executions and produce a Fix Report a builder can apply without re-diagnosing.

## What you are given

A user names a failing execution - usually an execution plan sys_id from sn_aia_execution_plan, sometimes an agent name. Find the root cause and cite the evidence for it.

## The seven-layer sweep

A complete diagnosis sweeps seven layers, in order:

1. Execution trace - what actually happened: plan state, task tree, tool calls, errors
2. Instructions - the agent's own instruction text
3. Tool definitions - tool descriptions and input schemas
4. Data schemas - the tables and fields the tools read and write
5. Data - whether the records the agent needed actually exist
6. GenAI stack - capability mapping, provider, assist consumption
7. Trigger and wiring - use case state, trigger configuration, ACLs

## What you can sweep in THIS build

You have tools for LAYER 1 ONLY.

    agent_trace     layer 1 - the execution trace
    read_artifact   not a layer - pages large evidence

Layers 2 through 7 have no tool in this build. Report every one of them as NOT SWEPT. Do not infer them, do not reason about them from the trace alone, and never describe a root cause in those layers as though you had checked it.

This matters more than it looks. An agent holding one tool, asked for a root cause, will produce one. A confident Fix Report built from a one-layer sweep is exactly the failure you exist to catch in other people's agents. Stating what you did not look at is part of the answer, not a caveat on it.

## The evidence rule

Every root cause cites trace evidence PLUS at least one configuration or schema source.

With only layer 1 available you will often be unable to meet that bar. When you cannot, say so plainly: name the candidate root cause, name the layer that would confirm it, and mark it UNCONFIRMED. An unconfirmed candidate that names its missing evidence is useful. A confident claim resting on one layer is not.

## Reading evidence

agent_trace returns a summary of the execution. When the trace is large it is stored as an artifact and you receive an excerpt plus an artifact id.

When that happens, page through it with read_artifact. Do NOT call agent_trace again - re-running it costs a tool call, returns the same thing, and you will exhaust your tool budget before you have read what you already fetched.

If a result carries a run block saying degraded, the evidence trail behind your diagnosis was not stored durably. Your findings are still valid. Say the trail is degraded rather than leaving the reader to assume it is intact.

## What blank data means

The platform returns blanks rather than errors in several places, so a blank field is not evidence of absence. Reference fields carry the literal string "undefined", which is not the same as empty.

If agent_trace reports a read as DENIED or EMPTY, that is a finding - report it as one. Never render a conclusion from data you did not actually receive.

## The Fix Report

End every diagnosis with a Fix Report in this shape. Use plain headings and indentation.

    FAILURE SUMMARY
      One paragraph: what the user observes, and what actually happened.

    LAYERS SWEPT
      Layer 1 execution trace: SWEPT
      Layers 2-7: NOT SWEPT - no tool in this build

    ROOT CAUSES
      For each:
        layer       which of the seven
        component   the specific record, table and field
        finding     what is wrong
        evidence    where you saw it: table, sys_id, field, value
        confidence  CONFIRMED or UNCONFIRMED - if unconfirmed, what would confirm it

    FIXES
      For each:
        target type  instruction, tool schema, data, configuration, or wiring
        target       the exact record and field to change
        current      the current value
        proposed     the value to set
        rationale    why this addresses the root cause

    VERIFICATION
      How to prove the fix worked: what to run, what to expect.

    DATA MARKERS
      Any record data quoted above, flagged for redaction before this report
      leaves the instance.

## Privacy

Fixes reference configuration only - instruction text, schemas, field names, wiring. Where you must quote record data as evidence, list it under DATA MARKERS so it can be redacted before the report crosses the instance boundary.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest test/agentDoctorInstructions.test.js --verbose`

Expected: PASS, 5 tests.

If the backtick test fails, its failure message prints the offending index and 120 characters of surrounding context — read that rather than searching the file by eye.

- [ ] **Step 5: Commit**

```bash
git add docs/agent/agent-doctor-instructions.md test/agentDoctorInstructions.test.js
git commit -m "docs: add Agent Doctor instructions, scoped to the two shipped tools

Task 3 was never built - docs/agent/ does not exist anywhere in git history -
so Task 10's instructions property had no source. This is the native rendering
scoped to the tools that exist; playbook.md stays deferred to Tasks 7-8.

The layer-coverage rule is the load-bearing sentence: tools exist for layer 1
only, and layers 2-7 must be reported NOT SWEPT rather than inferred. Without
it the agent invents the other six layers, which is the DESIGN.md 97 failure
we exist to catch in other people's agents.

Tested for the three characters a Fluent backtick template cannot carry.

Issue #24"
```

---

### Task 3: The Fluent AiAgent

**Files:**
- Create: `src/fluent/agent-doctor.now.ts`
- Test: `test/agentDoctorInstructions.test.js` (extend with the sync check)

**Interfaces:**
- Consumes: `docs/agent/agent-doctor-instructions.md` (Task 2, embedded verbatim); `PaScriptToolAdapter.invoke(toolName, request, context)` returning a String on every path; the adapter's registry keys **`agent_trace`** and **`read_artifact`** (confirmed in `src/server/PaScriptToolAdapter.js:49,52`).
- Produces: `sn_aia_agent` record "Agent Doctor" with two `script` tools, installed by `now-sdk install`. Task 4 verifies it live.

- [ ] **Step 1: Write the failing sync test**

Append to `test/agentDoctorInstructions.test.js`:

```js
describe('the Fluent agent carries the instructions verbatim', () => {
    // Task 10's verification step says "verify the deployed instructions match
    // the markdown". Half of that is checkable offline and permanently: the
    // Fluent file must contain the markdown byte-for-byte. The other half - that
    // what INSTALLED matches what was built - is the live check in Task 4.
    //
    // Two copies of a 700-word document drift silently. This is the guard.
    it('src/fluent/agent-doctor.now.ts contains the markdown byte-for-byte', () => {
        const md = fs.readFileSync(INSTRUCTIONS_PATH, 'utf8').trim()
        const fluent = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        expect(fluent).toContain(md)
    })

    it('declares no triggerConfig', () => {
        // Build Rule #31: triggerConfig on a bare AiAgent yields a trigger whose
        // usecase is null. It never fires, and nothing reports that it did not.
        const fluent = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        expect(fluent).not.toContain('triggerConfig')
    })

    it('uses no Now.ref anywhere', () => {
        // Build Rules #21 and #33: Now.ref in the AI family emits a random
        // build-time GUID with no lookup key retained, so it installs verbatim
        // pointing at nothing. Silent at build, install, and in the logs.
        const fluent = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        expect(fluent).not.toContain('Now.ref')
    })

    it('ends both wrapper IIFEs with the required (inputs) invocation', () => {
        // Build Rule #19: without the trailing (inputs) the runtime receives a
        // function object instead of a JSON string. Builds clean, installs
        // clean, fails only when the tool is called.
        const fluent = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        const invocations = fluent.match(/\}\)\(inputs\);/g) || []
        expect(invocations.length).toBe(2)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/agentDoctorInstructions.test.js --verbose`

Expected: the four new tests FAIL with `ENOENT` on `src/fluent/agent-doctor.now.ts`. The five Task 2 tests still pass.

- [ ] **Step 3: Create the Fluent agent**

Create `src/fluent/agent-doctor.now.ts`. Paste the Task 2 markdown verbatim into the `instructions` template — do not re-type or reflow it, or the sync test fails:

```ts
import '@servicenow/sdk/global'
import { AiAgent } from '@servicenow/sdk/core'

/**
 * Agent Doctor — IMPLEMENTATION_PLAN.md Task 10, LLD §5.
 *
 * The point of the Phase 1a vertical slice. Everything under src/server/ was
 * built without an agent ever calling it; this is the file that either
 * falsifies the approach or does not.
 *
 * TWO TOOLS, NOT SEVEN, and that is the plan rather than a shortcut. The build
 * brief is explicit — "Do not build all seven tools in Task 10. One tool, end
 * to end, on the Now Assist panel." read_artifact is not a second diagnostic
 * layer; it is the paging primitive agent_trace structurally requires, because
 * the known-answer specimen trace is 26,847 chars against a 4,000-char
 * threshold. Without it the agent gets an excerpt and an artifact id it cannot
 * open.
 *
 * ---------------------------------------------------------------------------
 * THE INSTRUCTIONS TEMPLATE CANNOT CONTAIN A BACKTICK
 * ---------------------------------------------------------------------------
 * Build Rule #43 documents this for `script` templates; the mechanism is plain
 * TypeScript template-literal semantics, so it applies here identically. A
 * markdown code span - the natural way to write a playbook full of table names
 * - closes the template, and the diagnostics point somewhere else entirely:
 * TS2796 "missing a comma to separate these two template expressions", TS304,
 * TS20, at line numbers scattered across the file.
 *
 * Same mechanism rules out ${...} (interpolates at build time, never reaches
 * the platform) and the two-character \n escape (consumed by TypeScript,
 * emitting a real newline that leaves the constant unterminated).
 *
 * The instructions text is maintained in docs/agent/agent-doctor-instructions.md
 * and pasted here verbatim. test/agentDoctorInstructions.test.js asserts this
 * file contains that file byte-for-byte, and that the markdown carries none of
 * the three forbidden sequences.
 *
 * ---------------------------------------------------------------------------
 * RULES THIS FILE IS BUILT AROUND
 * ---------------------------------------------------------------------------
 * #19  Script tool `script` is a self-invoking IIFE; the trailing (inputs) is
 *      REQUIRED. Omitting it builds and installs cleanly and fails only at
 *      runtime.
 * #21  securityAcl is MANDATORY (TS210 without it). 'Any authenticated user'
 *      maps to snc_internal correctly; 'Specific role' INSERTs duplicate
 *      sys_security_acl_role rows on every redeploy.
 * #31  No triggerConfig on a bare AiAgent — it yields a null usecase and never
 *      fires, with no diagnostic signal. Agent Doctor is invoked
 *      conversationally. LLD §5 rows 18-19 are deferred.
 * #32  Inline tools[] entries carry NO $id — the SDK generates their record
 *      IDs and ScriptToolDetails rejects $id at typecheck.
 * #34  Every tool needs a non-empty description. An empty one trips a platform
 *      Data Policy and the tool record is SILENTLY SKIPPED at install while
 *      its m2m row installs anyway, leaving a phantom tool reference.
 * R-5  Tool inputs is an ARRAY of {name, description, mandatory}. A
 *      JSON-Schema object causes a silent, never-terminating stall — the
 *      execution hangs In progress forever with no error. The single most
 *      expensive defect found in Phase 0.
 * R-9  Every declared input may be absent. mandatory: false is correct, not an
 *      oversight: every core behaves correctly with all inputs absent.
 */
export const agentDoctor = AiAgent({
    $id: Now.ID['agent-doctor'],
    name: 'Agent Doctor',
    description: `Diagnoses failing ServiceNow AI Agent executions. Reads the execution trace - plan state, task tree, tool calls and errors - and produces a Fix Report naming the root cause, the evidence for it, and the change that addresses it. This build sweeps the execution-trace layer only and reports the other six diagnostic layers as not swept.`,
    agentRole: `You are an expert ServiceNow AI Agent diagnostician. You work from evidence, you cite it, and you state plainly what you did not check.`,

    // Build Rule #21. 'Any authenticated user' rather than 'Specific role':
    // it maps to snc_internal correctly, whereas 'Specific role' generates a
    // sys_security_acl_role child with a NEW sys_id on every build, so each
    // redeploy accumulates duplicate role rows.
    //
    // This governs who may INVOKE the agent, which is a separate question from
    // what they can then see: every tool core reads through GlideRecordSecure,
    // so a caller sees only what their own roles permit regardless.
    securityAcl: {
        $id: Now.ID['agent-doctor-acl'],
        type: 'Any authenticated user',
    },

    // LLD §5 row 1. 'nap_and_va' is both Now Assist Panel and Virtual Agent;
    // 'nap' would be panel-only. The smoke test runs on the panel, which this
    // includes.
    channel: 'nap_and_va',
    agentType: 'internal',
    active: true,

    versionDetails: [
        {
            name: 'V1',
            number: 1,
            state: 'published',
            instructions: `You are Agent Doctor. You diagnose failing ServiceNow AI Agent executions and produce a Fix Report a builder can apply without re-diagnosing.

## What you are given

A user names a failing execution - usually an execution plan sys_id from sn_aia_execution_plan, sometimes an agent name. Find the root cause and cite the evidence for it.

## The seven-layer sweep

A complete diagnosis sweeps seven layers, in order:

1. Execution trace - what actually happened: plan state, task tree, tool calls, errors
2. Instructions - the agent's own instruction text
3. Tool definitions - tool descriptions and input schemas
4. Data schemas - the tables and fields the tools read and write
5. Data - whether the records the agent needed actually exist
6. GenAI stack - capability mapping, provider, assist consumption
7. Trigger and wiring - use case state, trigger configuration, ACLs

## What you can sweep in THIS build

You have tools for LAYER 1 ONLY.

    agent_trace     layer 1 - the execution trace
    read_artifact   not a layer - pages large evidence

Layers 2 through 7 have no tool in this build. Report every one of them as NOT SWEPT. Do not infer them, do not reason about them from the trace alone, and never describe a root cause in those layers as though you had checked it.

This matters more than it looks. An agent holding one tool, asked for a root cause, will produce one. A confident Fix Report built from a one-layer sweep is exactly the failure you exist to catch in other people's agents. Stating what you did not look at is part of the answer, not a caveat on it.

## The evidence rule

Every root cause cites trace evidence PLUS at least one configuration or schema source.

With only layer 1 available you will often be unable to meet that bar. When you cannot, say so plainly: name the candidate root cause, name the layer that would confirm it, and mark it UNCONFIRMED. An unconfirmed candidate that names its missing evidence is useful. A confident claim resting on one layer is not.

## Reading evidence

agent_trace returns a summary of the execution. When the trace is large it is stored as an artifact and you receive an excerpt plus an artifact id.

When that happens, page through it with read_artifact. Do NOT call agent_trace again - re-running it costs a tool call, returns the same thing, and you will exhaust your tool budget before you have read what you already fetched.

If a result carries a run block saying degraded, the evidence trail behind your diagnosis was not stored durably. Your findings are still valid. Say the trail is degraded rather than leaving the reader to assume it is intact.

## What blank data means

The platform returns blanks rather than errors in several places, so a blank field is not evidence of absence. Reference fields carry the literal string "undefined", which is not the same as empty.

If agent_trace reports a read as DENIED or EMPTY, that is a finding - report it as one. Never render a conclusion from data you did not actually receive.

## The Fix Report

End every diagnosis with a Fix Report in this shape. Use plain headings and indentation.

    FAILURE SUMMARY
      One paragraph: what the user observes, and what actually happened.

    LAYERS SWEPT
      Layer 1 execution trace: SWEPT
      Layers 2-7: NOT SWEPT - no tool in this build

    ROOT CAUSES
      For each:
        layer       which of the seven
        component   the specific record, table and field
        finding     what is wrong
        evidence    where you saw it: table, sys_id, field, value
        confidence  CONFIRMED or UNCONFIRMED - if unconfirmed, what would confirm it

    FIXES
      For each:
        target type  instruction, tool schema, data, configuration, or wiring
        target       the exact record and field to change
        current      the current value
        proposed     the value to set
        rationale    why this addresses the root cause

    VERIFICATION
      How to prove the fix worked: what to run, what to expect.

    DATA MARKERS
      Any record data quoted above, flagged for redaction before this report
      leaves the instance.

## Privacy

Fixes reference configuration only - instruction text, schemas, field names, wiring. Where you must quote record data as evidence, list it under DATA MARKERS so it can be redacted before the report crosses the instance boundary.`,
        },
    ],

    tools: [
        {
            name: 'agent_trace',
            type: 'script',
            description: `Replays a failing AI Agent execution. Give it an execution plan sys_id and it returns the plan header (state, state_reason, status, objective, timings), the task tree, and every tool call with its status, error message and payload digests. Use this FIRST on any diagnosis - it is the only layer this build can sweep. If the trace is large it comes back as an excerpt plus an artifact id: page the rest with read_artifact rather than calling this again. It reports reads that were DENIED or returned nothing as explicit findings, so an empty section means the data is absent, never that the read was skipped.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('agent_trace', inputs.request, {})
})(inputs);`,
            inputs: [
                {
                    name: 'request',
                    description: `An execution plan sys_id, an agent name, or a JSON object {execution, agent, step, since, detail}. May be omitted entirely - with no argument the tool returns a pick-list of recent execution plans to choose from.`,
                    mandatory: false,
                },
            ],
        },
        {
            name: 'read_artifact',
            type: 'script',
            description: `Pages through a large piece of evidence that was stored as an artifact. When agent_trace returns an excerpt plus an artifact id, call this with that id to read the full content in 4,000-character pages, advancing the offset each time. Use this instead of re-running agent_trace: re-running costs a tool call and returns the same excerpt, so you would exhaust your tool budget without ever reading the evidence. Only artifacts belonging to a diagnostic run can be read.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('read_artifact', inputs.request, {})
})(inputs);`,
            inputs: [
                {
                    name: 'request',
                    description: `An artifact sys_id, or a JSON object {artifact_id, offset, length}. Offset defaults to 0 and length is capped at 4,000 characters; the response reports the total length and whether more pages remain.`,
                    mandatory: false,
                },
            ],
        },
    ],
})
```

> **The third `invoke()` argument is `{}` deliberately.** `PaRunAnchor.getOrCreate` reads
> `_agentic_context_` itself, and ambient context **wins on identity** — so the wrapper passes no
> identity at all. Letting an LLM-derived argument name a conversation would hand it that
> conversation's run record, artifacts and audit trail.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/agentDoctorInstructions.test.js --verbose`

Expected: PASS, 9 tests.

If `contains the markdown byte-for-byte` fails, the paste was reflowed or re-typed. Do not fix it by editing the markdown to match the paste — re-paste from the file.

- [ ] **Step 5: Build**

Run: `now-sdk build`

Expected: clean.

If you see a cluster of unrelated-looking syntax errors — `TS2796`, `TS304` ShorthandPropertyAssignment, `TS20` CloseBraceToken — at scattered line numbers, **grep the file for a backtick before reading any of them** (Build Rule #43 corollary). The reported line numbers do not indicate the cause.

- [ ] **Step 6: Run the full suite**

Run: `npm test`

Expected: PASS — **255 tests** (246 after Task 1, +5 from Task 2, +4 from Task 3).

- [ ] **Step 7: Commit**

```bash
git add src/fluent/agent-doctor.now.ts test/agentDoctorInstructions.test.js
git commit -m "feat: add Agent Doctor as a Fluent AiAgent definition

Two script tools - agent_trace and read_artifact - wrapping
PaScriptToolAdapter.invoke with the IIFE literals Task 9 pinned. read_artifact
is not a second diagnostic layer; it is the paging primitive agent_trace
requires, since the specimen trace is 26,847 chars against a 4,000 threshold.

Instructions carried inline from docs/agent/agent-doctor-instructions.md, with
tests asserting the two copies stay byte-identical and that the file carries no
triggerConfig, no Now.ref, and two trailing (inputs) invocations.

Issue #24"
```

---

### Task 4: Install and verify live on gpinst01

Nothing before this proves anything. `npm test` exercises pure logic and `now-sdk build` exercises the compiler; neither has ever seen the platform. This task is where the slice is falsified or not.

**Files:**
- Modify: `docs/superpowers/plans/2026-07-31-task-10-agent-doctor.md` (record results inline as you go)

**Interfaces:**
- Consumes: the installed `sn_aia_agent` record from Task 3.
- Produces: verified evidence for the DoD, and the answer to R-2's API-path-provisional caveat.

- [ ] **Step 1: Install**

Run: `now-sdk install --alias gpinst01`

Expected: clean.

- [ ] **Step 2: Connect MCP and confirm the agent installed with both tools**

Use `mcp__foundry__servicenow_connect` (`authType="keychain"`, instance `gpinst01`), then
`mcp__foundry__servicenow_aia_list` / `servicenow_aia_get` for the agent named "Agent Doctor".

Confirm: the agent exists, `active` is true, and **two** tool records are attached.

**Why the count matters:** Build Rule #34 — a tool whose `description` is empty is silently skipped
at install while its `sn_aia_agent_tool_m2m` row installs anyway. One tool instead of two means a
phantom reference, and nothing in the build or install output says so.

- [ ] **Step 3: The R-7 check — the field class both known Phase 0 failures live in**

Read back `context_processing_script` and `applicability_script` on the installed agent via
`mcp__foundry__servicenow_query` against `sn_aia_agent`.

Expected: **both empty.**

These are **auto-populated by the platform on creation**; omitting them from the Fluent definition
does not leave them empty. An auto-populated `applicability_script` body ends in `return false;`,
which **suppresses the agent silently** — it simply never responds, with no error anywhere.

If either is populated, clear it and record the fact: it means the Fluent path does not suppress
auto-population, which is a finding worth a ruling of its own.

- [ ] **Step 4: Diff the deployed instructions against the markdown**

Read `instructions` from the published version record via MCP and compare it to
`docs/agent/agent-doctor-instructions.md`.

Expected: identical. Task 3's test proved source-to-source; this proves source-to-installed, which
is the half that catches a build-time transform.

- [ ] **Step 5: The panel smoke test**

On the **Now Assist panel** (not `servicenow_aia_execute` — the panel path is the one under test),
open a conversation with Agent Doctor and ask it to diagnose execution
`c9d63a932bda8b9417a6ffbeee91bfd0`.

**Expected diagnosis:** `script_error` citing `sn_aia_agent.601672d3….context_processing_script`
**line 42**, `InternalError`.

**Why this specimen and not an easier one:** the defect is **invisible from the plan header** —
`state=Completed`, empty `state_reason`, all 11 tasks and 5 tool calls `Success`. A shallow read
finds a healthy execution. So this tests whether a shallow diagnosis gets caught, not merely whether
rows were read.

**Also check the Fix Report says layers 2-7 were NOT SWEPT.** An agent that quietly diagnoses layers
it has no tool for has failed this task even if it happens to name the right root cause — that is
the DESIGN.md §97 mode, and getting the right answer by luck is exactly what makes it dangerous.

- [ ] **Step 6: The anchor check, and the closure it buys**

Query `x_snc_troubleshoot_audit` for the rows written by that conversation, via
`mcp__foundry__servicenow_query`.

Expected: **every row resolves to ONE run** via the conversation key.

This is the first exercise of `_agentic_context_` on the **Now Assist panel** path. R-2's closure
was explicitly API-path-provisional — observed via `servicenow_aia_execute` only — and the build
brief requires re-confirming it before the benchmark. If the global is absent here, every tool call
isolates into its own run, and the symptom shows up now rather than as contaminated benchmark data
in Task 12.

Record the outcome either way. A negative result closes R-2 just as usefully as a positive one.

- [ ] **Step 7: Confirm artifact paging happened**

Check that `read_artifact` was actually called, and that `x_snc_troubleshoot_run` has **one**
attachment for the run — not one per page.

The specimen trace exceeds the 4,000-char threshold, so a healthy run stores one artifact and pages
it. An advancing attachment count is the Task 9 paging-that-pages defect resurfacing.

- [ ] **Step 8: Record results and commit**

Append a short results block to this plan file under Task 4 — what passed, what did not, and the
`_agentic_context_` finding.

```bash
git add docs/superpowers/plans/2026-07-31-task-10-agent-doctor.md
git commit -m "test: record Task 10 live verification results on gpinst01

Issue #24"
```

---

### Task 5: Delete the temporary probe routes

Separate from Task 4 deliberately. `POST /scope_probe/adapter` is the only way to drive a tool core
**without** the agent, which makes it the instrument that distinguishes *the agent or wrapper is
broken* from *the core is broken* — same input, one call, unambiguous. Deleting it in the commit
that first exercises the agent removes the differential exactly when it is needed.

**Do not start this task until Task 4 Step 5 has passed.**

**Files:**
- Modify: `src/fluent/scope-readability.now.ts` — remove four routes
- Test: `test/` — no new tests; the existing suite must stay green

**Interfaces:**
- Consumes: a passing smoke test from Task 4.
- Produces: `GET /scope_probe/reads` as the only surviving route.

- [ ] **Step 1: Confirm the precondition**

Task 4 Step 5 passed. If it did not, **stop** — the probe routes are what you debug with.

- [ ] **Step 2: Delete the four routes**

In `src/fluent/scope-readability.now.ts`, remove the route definitions at:
- `path: '/trace'` (line ~144)
- `path: '/artifact_selftest'` (line ~228)
- `path: '/anchor_selftest'` (line ~436)
- `path: '/adapter'` (line ~720)

**Keep** `path: '/reads'` (line ~57) — it is the standing cross-scope readability check, not a
temporary probe, and the build brief calls for re-running it any time.

CHANGELOG 2026.07.3110 names all four as ungated and write-capable, held back only by a source
comment. Deferring their removal a second time is how a temporary route becomes permanent.

- [ ] **Step 3: Build and test**

Run: `now-sdk build && npm test`

Expected: both clean.

- [ ] **Step 4: Install and confirm the routes are gone**

Run: `now-sdk install --alias gpinst01`

Then confirm via MCP that `GET /api/x_snc_troubleshoot/scope_probe/reads` still answers and the
other four paths do not.

- [ ] **Step 5: Commit**

```bash
git add src/fluent/scope-readability.now.ts
git commit -m "chore: delete the four temporary scope_probe routes

Ungated and write-capable, held back only by a source comment (CHANGELOG
2026.07.3110). Kept through the Task 10 smoke test so a failure could be
bisected against the tool cores; removed now that the agent path is verified.

GET /scope_probe/reads survives - it is the standing cross-scope readability
check, not a temporary probe.

Issue #24"
```

---

### Task 6: Version, changelog, PR

**Files:**
- Modify: `package.json` — version → `2026.07.3111`
- Modify: `README.md` — version badge
- Modify: `CHANGELOG.md` — new entry at the top

**Interfaces:**
- Consumes: everything above.
- Produces: a merged PR.

- [ ] **Step 1: Bump the version**

`package.json`: `2026.07.3110` → `2026.07.3111` (same day, next daily counter).
`README.md`: update the version badge to match.

- [ ] **Step 2: Write the changelog entry**

Add to the top of `CHANGELOG.md`, below the header block, following the prose style of the existing
entries — what was decided and why, not a list of files. Cover:

- The **run-completion contract (R-20)** and why nothing declares completion
- **Task 3's absence**, discovered — `docs/agent/` was never built, and how it was discharged
- The **backtick constraint** on `instructions`, and that Rule #43's corollary reaches beyond `script`
- The **live results** from Task 4, especially the `_agentic_context_` panel-path finding
- Known gaps carried forward: `playbook.md`, the five remaining cores, the layers-swept reader,
  and the `log_analysis` roster decision still open at Task 8

- [ ] **Step 3: Run the full verification once more**

Run: `npm test && now-sdk build`

Expected: both clean.

- [ ] **Step 4: Push and open the PR**

```bash
git add package.json README.md CHANGELOG.md
git commit -m "chore: bump version to 2026.07.3111 and add the changelog entry

Issue #24"
git push -u origin feature/task-10-agent-doctor
```

Open the PR against `main`, titled `Task 10: Agent Doctor as a Fluent AiAgent + the run-completion contract`, body summarising the three decisions (R-20, the Task 3 discharge, the backtick constraint) and the live verification results. Close #24 on merge.

---

## Self-Review

**Spec coverage.** §1 run-completion contract → Task 1 (ruling, LLD correction, guard test). §1.4
consequences → Task 1 Steps 5-6. §2 scope, two tools → Task 3. §2.1 deferrals → recorded in Task 6's
changelog. §3 Task 3 dependency → Task 2. §4.1 instruction content, all 7 requirements → Task 2
Step 3. §4.2 layer-coverage rule → Task 2 Step 3 + its test. §4.3 backtick constraint → Task 2's
three lint tests + Task 3's build note. §5.1 agent shape → Task 3 Step 3. §5.2 rules table → Global
Constraints + Task 3's header comment + Task 3's four static tests. §5.3 wrappers verbatim → Task 3
Step 3. §5.4 input schema → Task 3 Step 3. §6 verification, all 7 steps → Task 4 Steps 1-7. §6.1
probe route lifecycle → Task 5. §7 DoD → covered across Tasks 4-6. §8 out of scope → nothing in this
plan touches it.

**Placeholder scan.** No TBD/TODO. Every code step carries the actual content. The one thing not
written out in full is Task 6's changelog prose, which is specified by required *topics* rather than
text — deliberate, because it must report Task 4's live results, which are unknown until they
happen.

**Type consistency.** `invoke(toolName, request, context)` matches `PaScriptToolAdapter.js`. Registry
keys `agent_trace` / `read_artifact` verified at `PaScriptToolAdapter.js:49,52`. Tool `name` values
match the registry keys deliberately, so the LLM-facing name, the `invoke()` argument and
`x_snc_troubleshoot_audit.tool_name` cannot drift. `INSTRUCTIONS_PATH` defined once in Task 2 and
reused by Task 3's appended describe block — Task 3 must append to the same file, not create a new
one.

**One gap found and fixed during review:** Task 1's guard test originally asserted only the absence
of prototype methods, which a completion path written as a free function would slip past. Added the
source scan for terminal choice values.
