# Task 9 Design — PaScriptToolAdapter at the two-wrapper scope

**Written:** 2026-07-31
**Task:** `docs/IMPLEMENTATION_PLAN.md` Task 9 — Script-Tool Adapters (Native Harness Bridge)
**Spec authority:** `docs/LOW_LEVEL_DESIGN.md` §4.7 + §4 contract; `DESIGN.md` R-1, R-5, R-9,
R-10, R-14, R-18b; `docs/BUILD_BRIEF_Phase1a_VerticalSlice.md`

---

## 1. Scope

Task 9 as written in `IMPLEMENTATION_PLAN.md` lists **seven** wrappers. The vertical-slice brief
says **one**. This design lands **two**: `agent_trace` and `read_artifact`.

Two is the smallest set that makes the Task 10 panel smoke test answerable. `agent_trace` is the
diagnosis path; `read_artifact` is how the agent retrieves a trace too large to hand to the
reasoning loop. A real `PaToolAgentTrace` summary measures ~35,000 chars against a 4,000-char
excerpt budget, so without paging exposed as a tool the agent receives an excerpt and an
`artifact_id` it has no way to spend. The remaining five wrappers wait on their tool cores
(Tasks 7 and 8); `agent_config`, `genai_log`, `schema_lookup`, `query_table` and `log_analysis`
do not exist yet, and building a core inside Task 9 would defeat the point of the slice.

### Explicitly deferred, not silently narrowed

The two `sn_aia_tool` script bodies — the IIFE literals that call the adapter — are written in
**Task 10**, not here. Two reasons, both structural:

1. They cannot deploy on their own. A script tool exists only as an entry in an `AiAgent`'s
   `tools[]` array, and the `AiAgent` is Task 10's deliverable.
2. Build Rule #29 rejects a variable initializer for a Fluent property, so the body cannot be
   imported from a shared module and referenced as `script: someConst`. It must be an inline
   literal in `src/fluent/agent-doctor.now.ts`.

Task 9 therefore pins both literals **verbatim in the adapter's header comment**, so Task 10
pastes them rather than reinventing them and rediscovering the `(inputs)` trap.

---

## 2. Components

### New files

| File | What |
|---|---|
| `src/server/PaScriptToolAdapter.js` | The bridge. Parse → anchor → audit → execute → threshold → audit → stringify. |
| `src/server/tools/PaToolReadArtifact.js` | Thin tool core over `PaArtifactStore.read`, carrying `PAGED_OUTPUT: true`. |
| `test/PaScriptToolAdapter.test.js` | Pure-logic Jest, per R-14 (tests live in `test/`, never under `src/`). |
| `test/PaToolReadArtifact.test.js` | Same. |

### Modified files

| File | Change |
|---|---|
| `src/fluent/script-includes.now.ts` | Two more `ScriptInclude` declarations, both `accessibleFrom: 'public'`. |
| `src/fluent/scope-readability.now.ts` | Add `POST /scope_probe/adapter`. |

`accessibleFrom: 'public'` is load-bearing on both: a script tool executes in `rhino.global`, not
in `x_snc_troubleshoot`, so the adapter and every core it reaches are called from outside the app
scope. The default `package_private` builds and installs cleanly and fails only at runtime
(R-5; brief trap 7).

---

## 3. Tool registry

LLD §4.7 gives the signature as `invoke(toolClassName, inputString, ctx)`. **This design deviates:
the first argument is a tool NAME resolved against an explicit factory map**, not a class name
resolved dynamically.

```js
TOOLS: {
    agent_trace:   function () { return new PaToolAgentTrace() },
    read_artifact: function () { return new PaToolReadArtifact() },
}
```

Three things this buys, none of which the class-name form gives:

- **It is an allowlist.** The first argument originates in a tool-script literal, and past that in
  whatever the platform hands the wrapper. Resolving an arbitrary class name by string is a
  code-execution surface; a factory map is a closed set.
- **A typo errors cleanly.** An unknown name returns a structured error naming the valid keys,
  rather than a `ReferenceError` escaping into the orchestrator.
- **The key is the audit name.** `tool_name` on `x_snc_troubleshoot_audit` is the same string,
  so the audit trail and the registry cannot drift apart.

Registry entries are added as cores land. Today it has two.

---

## 4. Pipeline

```
invoke(toolName, rawInput, ctx)

  phase = 'lookup'     factory = TOOLS[toolName]
                       unknown ⇒ error envelope, zero side effects
                       (no run anchor created, no audit row written)

  phase = 'parse'      args = tolerantParse(rawInput)

  phase = 'anchor'     run = new PaRunAnchor().getOrCreate(ctx)

  phase = 'intent'     new PaAuditLogger().logIntent({ runId, toolName, input: args })

  phase = 'execute'    core = factory()
                       result = core.execute(args)

  phase = 'threshold'  if (!core.PAGED_OUTPUT)
                           result = new PaArtifactStore()
                               .applyThreshold(run.run_id, result, toolName)

  phase = 'result'     attach run degradation if any
                       new PaAuditLogger().logResult({ runId, toolName, output: result })
                       return JSON.stringify(result)      // ALWAYS a string
```

### 4.1 `tolerantParse`

| Input | Result |
|---|---|
| `null` / `undefined` | `{}` |
| `""` or whitespace | `{}` |
| An object | passed through unchanged |
| A string that parses to a plain object | that object |
| **Anything else** | **the original string, untouched** |

The last row is LLD §4.7 Note 4. The string is returned **original and untouched**, with no
whitespace trimming. Trimming is used to decide whether the input is empty or can be parsed as JSON,
but once it is decided that this is a bare string, it passes through as received. The tool core owns
all normalisation. This rule is most likely to be "helpfully" broken by a future edit: pre-wrapping
a bare string as `{value: s}` produces an args object with none of the keys the cores read.
`PaToolAgentTrace` maps a bare 32-char hex string to `{execution: …}` and any other bare string to
`{agent: …}`, so a `{value: …}` wrapper makes it fall through to the recent-plan pick-list and
**silently discard the caller's actual request**. No error anywhere.

`tolerantParse` never rejects. A `{`-leading string that fails to parse is passed through
untouched, so `PaToolAgentTrace` emits its own `_parse_error` signal. One place decides what an
input means — the core — and the adapter does not second-guess it.

### 4.2 `PAGED_OUTPUT` — why the exception exists

`PaArtifactStore.MAX_PAGE_CHARS` is 4000 and `THRESHOLD_CHARS` is also 4000. A full
`read_artifact` page is 4000 chars of content **plus** its envelope (`artifact_id`, `file_name`,
`total_length`, `offset`, `next_offset`, `eof`, `page_size`), so a stringified full page always
exceeds the threshold. Routed through `applyThreshold` unchanged, `read_artifact` would store each
page as a *new* artifact and return an excerpt of it: paging that pages, with the agent no closer
to the content on each call.

The fix is a declared property on the tool core:

```js
// PaToolReadArtifact.js
PAGED_OUTPUT: true,
```

and one branch in the adapter:

```js
if (!core.PAGED_OUTPUT)
    result = store.applyThreshold(run.run_id, result, toolName)
```

The knowledge lives with the tool that is already paged, not with whoever writes the wrapper
literal — which matters because the wrapper literal is a Fluent string that no unit test can
reach, while `PAGED_OUTPUT` is asserted directly in `test/PaToolReadArtifact.test.js`.

The two constants stay at 4000. Task 4 live-verified 35,000 chars round-tripping byte-identical in
nine 4KB pages on gpinst01; lowering `MAX_PAGE_CHARS` to dodge the collision would invalidate that
evidence to save one `if`.

### 4.3 Run-anchor degradation surfacing

`PaRunAnchor.getOrCreate` can return `run_id: null` with a `degraded` reason and a `note` (R-10).
`PaArtifactStore` and `PaAuditLogger` both already tolerate that: the store returns a degraded
envelope advertising no paging, and the audit row writes without a run link.

What neither does is tell the *agent*. This design adds it: when `run.degraded` is set and the
result is a plain object, the adapter shallow-copies the result and attaches

```js
run: { degraded: run.degraded, note: run.note }
```

This is an addition beyond LLD §4.7 and is deliberate. An agent reasoning over a diagnosis
otherwise has no way to know the evidence trail behind it was not durable — findings stay valid,
their provenance does not, and that distinction is exactly what R-10 requires be stated rather
than inferred. The copy is shallow and non-destructive; the core's own result shape is never
mutated in place.

---

## 5. Error handling

**The adapter never throws into the orchestrator.** A type or shape mismatch escaping into the
planner is a documented native-harness pain point, and an exception is the worst shape of all.

- The whole body is guarded. On catch, the adapter returns
  `{"success": false, "error": "…", "phase": "<phase>"}` as a **string**.
- **The exception object is never read.** Reading `.message` off a
  `ScopeAccessNotGrantedException` throws *again*, escapes the handler and 500s the whole request
  (R-1; brief trap 3). The `phase` variable is what localises the failure instead — it is set
  before each stage and read only in the catch.
- `logError` is attempted inside its own nested guard, so a failing audit write cannot mask the
  error it was trying to record.
- An unknown tool name short-circuits before any side effect: no run anchor is created and no
  audit row is written for a call that never happened.

Return type is invariant: `invoke` returns a string on every path, including every failure path.

---

## 6. Testing

### Pure logic — Jest in `test/` (R-14)

Tests must not live under `src/`: `now-sdk build` lints the entire source tree and a test file's
`require('vm')` fails the whole build, deploying nothing. Reuse the existing `test/_glideStub.js`
and `test/_loadScriptInclude.js`.

`test/PaScriptToolAdapter.test.js`:

- the `tolerantParse` matrix in §4.1 — object, JSON string, bare sys_id, bare agent name, empty
  string, whitespace, malformed JSON, `null`, absent
- **a bare string reaches `execute()` unchanged** — the Note 4 regression guard, asserted on the
  argument the core actually received
- the return value is a string on every path, success and failure alike
- unknown tool name → structured error, and **no anchor and no audit row created**
- a core that throws → `{success:false, phase:'execute'}` envelope, exception never inspected
- `PAGED_OUTPUT: true` skips `applyThreshold`; a core without it gets `applyThreshold` applied
- a degraded anchor surfaces `run: {degraded, note}` on the result
- `logIntent` is called **before** `core.execute` — it is the only trace of a call that hangs
- a throwing `PaAuditLogger` does not change what `invoke` returns

`test/PaToolReadArtifact.test.js`:

- `PAGED_OUTPUT` is `true`
- argument normalisation: bare 32-char hex → `{artifact_id}`; JSON `{artifact_id, offset, length}`;
  absent input → the store's structured "requires an artifact_id" error, not a throw (R-9)
- delegation to `PaArtifactStore.read` with the parsed offset and length

### Live — gpinst01

`POST /api/x_snc_troubleshoot/scope_probe/adapter`, added to `scope-readability.now.ts` alongside
the three existing temporary routes and carrying the same `TEMPORARY` marker:

1. Drive `agent_trace` against the known-answer specimen `c9d63a932bda8b9417a6ffbeee91bfd0`.
   Expect a truncated envelope: `truncated: true`, a real `artifact_id`, a stated `pages` count.
2. Drive `read_artifact` on that `artifact_id` and page to `eof`.
3. Assert the reassembled content is byte-identical to what `agent_trace` produced.

Step 3 is the point. It proves the 4000/4000 collision closed by measurement rather than by
argument, and it exercises the whole adapter path — anchor, audit, threshold, paging — before an
`AiAgent` exists to confuse a defect here with a defect in an agent definition.

Guard against the project's standing failure mode while reading the result: a tool returning a
plausible summary from empty data. `PaToolAgentTrace` emits `evidence_basis` for this; check it
rather than trusting the shape of the output.

### Route lifecycle

The vertical-slice brief says the three temporary `/scope_probe` routes come out when Task 9's
adapter lands. This design defers that by one task: **all four routes are deleted together at
Task 10**, once the panel smoke test passes.

Deleting them at Task 9 would leave the adapter verifiable only through an agent that does not
exist yet, so its first exercise would be inside Task 10 where an adapter defect and an
agent-definition defect are indistinguishable. The routes are marked temporary, are not referenced
by any shipped artifact, and their removal is a single commit at Task 10.

---

## 7. Wrapper literals for Task 10

Pinned here so Task 10 pastes rather than invents. Both are self-invoking IIFEs and **the trailing
`(inputs)` is required** — omitting it builds and installs cleanly and fails only at runtime
(Build Rule #19).

```js
// agent_trace
(function (inputs) {
    return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('agent_trace', inputs.request, {})
})(inputs);
```

```js
// read_artifact
(function (inputs) {
    return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('read_artifact', inputs.request, {})
})(inputs);
```

The third argument is `{}` deliberately. `PaRunAnchor.getOrCreate` reads `_agentic_context_`
itself, and **ambient context wins on identity** — a caller-supplied `conversation_id` is honoured
only where there is no ambient value to contradict it, because letting an LLM-derived argument name
a conversation would hand it that conversation's run record, artifacts and audit trail. The wrapper
passes no identity at all.

### Input schema — one free-form entry

```js
input_schema: [
    {
        name: 'request',
        description: 'An execution plan sys_id, an agent name, or a JSON object {execution, agent, step, since, detail}.',
        mandatory: false,
    },
]
```

`input_schema` is an **ARRAY**, never a JSON-Schema object — a JSON-Schema object causes a silent,
never-terminating stall, the execution hanging in `In progress` forever with no error. It is the
single most expensive defect found in Phase 0 (R-5).

One free-form entry rather than five named ones (`execution` / `agent` / `step` / `since` /
`detail`), for two reasons:

- **R-9.** The Phase 0 probe agent never passed a declared input in *any* run, while its own
  reasoning text claimed it had. Five optional slots is five chances to pass none; one slot is one.
- It exercises the Note 4 bare-string path the cores were built to normalise, rather than leaving
  that path live in production but untested by the wrapper that feeds it.

`mandatory: false` is correct and not an oversight: every core behaves correctly with all inputs
absent, and `PaToolAgentTrace` falls back to a recent-plan pick-list.

`read_artifact` takes the same single `request` entry, described as an artifact sys_id or a JSON
object `{artifact_id, offset, length}`.

---

## 8. Definition of done

- [ ] `npm test` green, including every case in §6
- [ ] `now-sdk build` clean
- [ ] `now-sdk install --alias gpinst01` clean
- [ ] `POST /scope_probe/adapter` round-trips the 35KB specimen trace byte-identically through
      `agent_trace` → `read_artifact`
- [ ] Audit rows present on `x_snc_troubleshoot_audit` for both calls, both linked to one run
- [ ] Version incremented in `package.json` and the README badge
- [ ] Issue → branch → PR; nothing committed to `main`

## 9. Out of scope

- The five remaining wrappers — they need Tasks 7 and 8 first
- The `AiAgent` record and its tool entries — Task 10
- Deleting the temporary `/scope_probe` routes — Task 10, all four together
- `PaToolAgentTrace` detail mode — still deferred
