# Task 10 — Agent Doctor as a Fluent AiAgent

**Issue:** #24
**Date:** 2026-07-31
**Status:** design, pending implementation plan

The point of the Phase 1a vertical slice. Everything before this built components that no agent has
ever called; this is the task that either falsifies the approach or does not. Two things ship
together because the second cannot be built honestly without the first: the **run-completion
contract**, and **Agent Doctor** itself.

---

## 1. The run-completion contract

### 1.1 The ruling

**Native diagnostic runs have no terminal state, by design.** `PaRunAnchor` creates a run at
`status: 'running'` and nothing ever moves it. This is the contract, not a gap awaiting closure.

It has to be settled here rather than deferred again because Task 9 carried it forward explicitly
(CHANGELOG 2026.07.3110: *"invisible while a run is one call long, load-bearing the moment the
wrapper makes a run span calls"*) — and Task 10 is exactly what makes a run span calls.

### 1.2 Why nothing declares completion

The native harness emits **no end-of-conversation signal**. There is no callback, no terminal event,
nothing to hook. Completion could therefore only be *declared*, and every candidate declarer fails
for a reason already measured on this project:

| Declarer | Why not |
|---|---|
| **The agent**, via a `complete_run` tool | R-9 measured the Phase 0 probe agent passing a declared input in **zero** runs while its own reasoning text claimed it had. A terminal tool the agent forgets to call leaves the run open anyway — the failure mode is unchanged, but it now *looks* deliberate. It also spends one of the platform's 5–7 tool slots on bookkeeping that diagnoses nothing. |
| **A sweeper job**, on idle time | Reintroduces clock reasoning into the one component where R-2 deleted time-window logic outright. R-2 killed time-window *keying* (identity) rather than *reaping* (lifecycle), and the distinction is real — but it is subtle enough that a future reader finds a clock inside `PaRunAnchor` and reads it as permission to key on one. The guard R-2 bought was structural; a sweeper spends it. |
| **`sn_aia_execution_plan` state** | The platform genuinely knows when work ends — but at **turn** granularity, not conversation granularity. One conversation spans many execution plans, one per user turn. Closing on plan-terminal marks a run complete while the user is still mid-conversation, and the PRD explicitly wants follow-up questions (*"show me the exact tool schema"*, *"would renaming the field fix it?"*) inside the same run. |

### 1.3 What replaces it

Completeness is **derived, never declared** — from `x_snc_troubleshoot_audit`:

    distinct tool_name over rows where run = <run_id> and action_type = 'result'
      -> the set of diagnostic layers actually swept

This is strictly better than a status field, for a reason the project has already written down.
DESIGN.md §97:

> Budget exhaustion surfaces as `tool_limit` [...]. Stopping early after five probes surfaces as
> **`completed`** — indistinguishable from a genuine finish. An Agent Doctor that skips four of
> seven diagnostic layers and emits a confident Fix Report fails *less visibly* than one that runs
> out of budget, which makes it the more dangerous mode.

A `status` column answers *did it stop?* An audit-derived layer set answers *did it look?* — which
is the question that matters, and the one DESIGN.md R-3's amendment makes **binding** for every
scored benchmark row. Locating completeness in the audit trail also puts it in the one table that is
already written on every tool call, by a component (`PaAuditLogger`) built to be total.

### 1.4 Consequences, recorded so they are not later filed as defects

1. **`status`, `transcript`, `context_summary`, `fix_report` and `error` are Phase 2 columns.**
   They belong to the custom harness (LLD §4.6: *"custom: explicit run_id"*), and are unwritten on
   the native path. The `queued` / `awaiting_confirmation` / `complete` / `failed` vocabulary stays
   in `tables.now.ts` — Phase 2 uses it — but is unreachable in Phase 1a.
2. **LLD §3.1's status row is corrected.** It reads *"native runs go straight to `running`"*, which
   states the beginning of the lifecycle and implies a continuation that does not exist. It must say
   they **stay** there, and point at the audit-derived signal.
3. **The derived-completeness reader is Task 11's deliverable, not this task's.** With a two-tool
   roster it could only ever report 2 of 7, and would be rewritten the moment Tasks 7–8 land the
   other five cores. The audit rows accumulate now either way; only the query waits.
4. **Unkeyed runs accumulate.** A call with no conversation id and no execution ref gets an isolated
   run (R-2), which now never closes. This is accepted: an empty extra run is visible and harmless,
   and the alternative — reaping on a clock — is §1.2's rejected option wearing a different hat.

Per R-18c, a ruling naming a document section is a **work item, not a record**, so the LLD edit
ships in the same PR as the ruling. Six rulings were previously found recorded-but-unapplied; this
one does not become the seventh.

---

## 2. Scope

**Two tools, not seven.** `agent_trace` and `read_artifact` — exactly the wrappers Task 9 pinned in
its spec §7, pasted verbatim rather than reinvented.

`read_artifact` is not a diagnostic layer; it is the paging primitive `agent_trace` structurally
requires. The known-answer specimen trace is **26,847 chars** against `PaArtifactStore`'s 4,000-char
threshold, so without `read_artifact` the agent receives an excerpt and an artifact id it cannot
open. The roster is two because two is what makes the smoke test answerable — the build brief's
*"one tool, end to end"*, plus the primitive that tool cannot function without.

### 2.1 Deferred, explicitly

- **`playbook.md`** (Task 3's harness-neutral core) → Tasks 7–8. See §3.
- **`log_analysis` in the roster** (build brief open decision #1, *"confirm at Task 10"*) → **Task
  8**. It is not settleable here: `PaToolLogAnalysis` has no core, so there is nothing to include or
  exclude. The recommendation on record — keep the tool at 7 and have it degrade explicitly, since
  an agent with no log tool cannot tell you the log layer was skipped — stands unchanged and
  undecided.
- **The five remaining wrappers** → Tasks 7–8.
- **`PaToolAgentTrace` detail mode** → still deferred.

---

## 3. The Task 3 dependency, and how it is discharged

**`docs/agent/` does not exist** — not in the working tree, not anywhere in git history. Task 3 (The
Diagnostic Playbook) produces `playbook.md` and `agent-doctor-instructions.md`, and Task 10's
specification says `instructions` is *"the Task 3 native rendering, inline as one backtick
template."* The Phase 1a build brief scoped the slice to Tasks 2, 4, 5, 9, 10 and skipped 3 without
noting the dependency.

**Resolution:** build `docs/agent/agent-doctor-instructions.md` **scoped to the two tools that
exist**; defer `playbook.md` to Tasks 7–8.

The reasoning is the slice strategy itself (DESIGN.md §1, *"cheap to falsify"*). Task 3's nine
content requirements — the K26 symptom taxonomy, the quick decision guide, the latency fix
vocabulary, the failure-mode catalog — overwhelmingly describe tools 2 through 7, which do not
exist. Authoring them now delays the falsification the slice exists to buy, and authors them against
a roster that will have changed by the time they are used.

What is **not** deferred is the instruction file itself. The plan's stated reason for two files is
that instruction text is reviewed as prose and diff-checked against the deployed record; inlining
the only copy into `agent-doctor.now.ts` would make Task 10's own verification step ("verify the
deployed `instructions` matches `docs/agent/agent-doctor-instructions.md`") unrunnable.

---

## 4. The instructions

### 4.1 What they must encode

Scoped to the slice, but complete within it:

1. **Mission.** Diagnose a failing AI Agent run; the terminal output is a Fix Report.
2. **The seven-layer sweep, named in full** — execution trace → instructions → tool definitions →
   data schemas → data → GenAI stack → trigger/wiring.
3. **The layer-coverage rule (§4.2).** Tools exist for layer 1 only. Layers 2–7 are reported **not
   swept**, never reasoned about.
4. **The evidence rule.** Every root cause cites trace evidence **plus** at least one config or
   schema source. With only layer 1 available, most candidate root causes cannot meet this bar —
   which is the point, and must be stated as such rather than left for the model to discover.
5. **Fix Report structure** — failure_summary, root_causes[] (layer, component, finding, evidence,
   confidence), fixes[] (target_type, target, current, proposed, rationale), verification[], data
   markers. Rendered as structured markdown; schema-validated JSON is a custom-harness capability,
   and how well native approximates it is one of the things the benchmark scores.
6. **Privacy rule.** Fixes reference configuration only; record data is flagged for redaction.
7. **Tool usage.** Page large evidence with `read_artifact` rather than re-querying — the specimen
   trace is seven pages, and an agent that re-runs `agent_trace` instead of paging burns its tool
   budget and hits the ceiling before it has read what it already fetched.

### 4.2 The layer-coverage rule, and why it is the load-bearing sentence

The instructions name all seven layers and then state plainly that **this build has tools for layer
1 only**, and that layers 2–7 must be reported as *not swept* rather than inferred.

This is the defence against DESIGN.md §97. An agent holding one tool, asked for a root cause, will
produce one — the platform hands back blanks rather than errors in several places, and a fluent
model fills blanks. A confident Fix Report built from a one-layer sweep is precisely the failure
this whole project exists to catch in *other people's* agents; shipping it in our own would be a
poor advertisement and, worse, would contaminate the Task 12 benchmark baseline with a scoring
artifact rather than a capability measurement.

It also front-loads the honesty the benchmark will demand later: R-3's amendment requires every
scored row to record layers swept, and an agent that already narrates its own coverage makes that
row easy to fill and easy to audit.

### 4.3 Hard constraint: the instructions cannot contain a backtick

`instructions` is a Fluent **backtick template**, so Build Rule #43's corollary applies to it. Rule
#43 documents the hazard for `script` templates, but the mechanism is plain TypeScript
template-literal semantics — nothing about it is specific to `script`.

A single backtick anywhere inside the template closes it. Markdown code spans are the natural way to
write a playbook full of table names, and every one of them is a landmine. The diagnostics do not
point at the backtick: Rule #43 records `TS2796` ("missing a comma to separate these two template
expressions"), `TS304` ShorthandPropertyAssignment, `TS20` CloseBraceToken, and plugin
cast failures, **at line numbers scattered across the file**.

The same mechanism rules out `${` (interpolates at build time, never reaching the platform) and `\n`
escapes (consumed by TypeScript, emitting a real newline that leaves the string unterminated —
Rule #43 proper).

**Therefore:**

- Table and field names appear **bare** — `sn_aia_execution_plan`, not a code span.
- The Fix Report template uses **indentation**, not code fences.
- The markdown source file is written under the **same restriction**, so the two copies stay
  byte-comparable and the §6 diff check is meaningful.
- A Jest case asserts the markdown file contains no backtick, no `${`, and no two-character `\n`
  **escape sequence**. Real newlines are fine and expected — a template literal preserves them; it
  is the literal backslash-n that TypeScript consumes, emitting a real newline mid-string and
  leaving the constant unterminated.

The test is not ceremony. Discovering this at build time costs an hour of reading errors that point
somewhere else entirely, and the failure recurs every time anyone edits the instructions — which,
for an agent, is the file that gets edited most.

---

## 5. The Fluent artifact

`src/fluent/agent-doctor.now.ts`, patterned on `.claude/context/sdk-examples/ai-agent.now.ts`.

### 5.1 Shape

- **Agent:** `name` "Agent Doctor", `agentType: 'internal'`, `active: true`, `description`
  non-empty, and **`channel: 'nap_and_va'`** — the LLD §5 row 1 value, verified against the SDK as
  "both Now Assist Panel and Virtual Agent" (the alternative, `'nap'`, is panel-only). The smoke
  test runs on the panel, which `nap_and_va` includes; the wider value is kept because narrowing it
  is a decision LLD §5 already made and nothing here contradicts.
- **Instructions** live in `versionDetails[]` (`state: 'published'`, number 1), not at top level —
  this is the golden example's shape and the platform's.
- **`securityAcl`** — `type: 'Any authenticated user'`. Mandatory; the build fails `TS210` without
  it. `'Any authenticated user'` maps to `snc_internal` correctly, whereas `'Specific role'`
  INSERTs duplicate `sys_security_acl_role` rows on every redeploy (Rule #21, caveat a). The data-access
  question is separately answered: every core reads through `GlideRecordSecure`, so a caller sees
  only what their own roles permit regardless of who may invoke the agent.
- **Two script tools**, each with `type: 'script'`, a non-empty `description`,
  `executionMode: 'autopilot'`, `active: true`, and `inputs` as a **one-entry array**.
- **No `triggerConfig`.** Agent Doctor is invoked conversationally, and Rule #31 makes a
  `triggerConfig` on a bare `AiAgent` yield a trigger whose `usecase` is null — it never fires, with
  no diagnostic signal. LLD §5 rows 18–19 are deferred, as §5 already records.

### 5.2 Rules that will otherwise cost a rebuild

| Rule | Requirement |
|---|---|
| #32 | Inline `tools[]` entries carry **no `$id`** — the SDK generates their record IDs, and `ScriptToolDetails` rejects `$id` at typecheck. |
| #34 | Every tool needs a **non-empty `description`** — an empty one trips a platform Data Policy, and the tool record is **silently skipped at install while its m2m row still installs**, leaving a phantom tool reference. |
| #19 | Wrapper `script` is a self-invoking IIFE and the trailing **`(inputs)` is required** — omitting it builds and installs cleanly and fails only at runtime. |
| R-5 | Tool `inputs` is an **ARRAY** of `{name, description, mandatory}`. A JSON-Schema object causes a silent, never-terminating stall — the execution hangs `In progress` forever with no error. The single most expensive defect found in Phase 0. |
| #21/#33 | **No `Now.ref()` anywhere in the AI family** — phantom GUIDs, silent failure. |
| #29 | Fluent property values are a **single literal**. No `'foo' + 'bar'`. |

### 5.3 The wrappers, verbatim from Task 9 spec §7

    // agent_trace
    (function (inputs) {
        return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('agent_trace', inputs.request, {})
    })(inputs);

    // read_artifact
    (function (inputs) {
        return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('read_artifact', inputs.request, {})
    })(inputs);

The third argument is `{}` deliberately: `PaRunAnchor.getOrCreate` reads `_agentic_context_` itself
and ambient context wins on identity, so the wrapper passes **no identity at all**. Letting an
LLM-derived argument name a conversation would hand it that conversation's run record, artifacts and
audit trail.

Both Script Includes are already declared `accessibleFrom: 'public'` in
`src/fluent/script-includes.now.ts` — required, because script tools execute in `rhino.global`, not
the app scope.

### 5.4 Input schema — one free-form entry per tool

    inputs: [
        {
            name: 'request',
            description: 'An execution plan sys_id, an agent name, or a JSON object {execution, agent, step, since, detail}.',
            mandatory: false,
        },
    ]

One free-form entry rather than five named ones, for the reasons Task 9 pinned: **R-9** (five
optional slots is five chances to pass none; one slot is one), and it exercises the bare-string path
the cores were built to normalise rather than leaving that path live but untested by the wrapper
that feeds it. `mandatory: false` is correct — every core behaves correctly with all inputs absent.

`read_artifact` takes the same single `request` entry, described as an artifact sys_id or a JSON
object `{artifact_id, offset, length}`.

---

## 6. Verification

Order matters; each step is a different question.

1. **`npm test` green**, including the §4.3 backtick/escape assertions.
2. **`now-sdk build` clean**, then **`now-sdk install --alias gpinst01` clean.**
3. **R-7 check — the field class both known Phase 0 failures live in.** `context_processing_script`
   and `applicability_script` are **auto-populated by the platform on creation**; omitting them from
   the Fluent definition does not leave them empty. Read both back via MCP and confirm they are
   actually empty. An auto-populated `applicability_script` body ends in `return false;`, which
   **suppresses the agent silently**.
4. **Instructions diff** — deployed `instructions` against `docs/agent/agent-doctor-instructions.md`.
5. **Panel smoke test.** A Now Assist panel conversation asks Agent Doctor to diagnose execution
   `c9d63a932bda8b9417a6ffbeee91bfd0`. Expected: `script_error` citing
   `sn_aia_agent.601672d3….context_processing_script` **line 42**, `InternalError`. The defect is
   **invisible from the plan header** — `state=Completed`, empty `state_reason`, all 11 tasks and 5
   tool calls `Success` — so this tests whether a shallow diagnosis gets caught, not merely whether
   rows were read.
6. **Anchor check, and the closure it buys.** Every audit row from the conversation resolves to
   **one** run via the conversation key. This is the first exercise of `_agentic_context_` on the
   **Now Assist panel** path — R-2's closure was explicitly API-path-provisional, observed via
   `servicenow_aia_execute` only, and the build brief requires re-confirming it before the
   benchmark. If the global is absent on this path, every tool call isolates into its own run and
   the symptom is visible here rather than as contaminated benchmark data later.
7. **Artifact paging observed end to end** — the specimen trace exceeds the threshold, so a healthy
   run shows one attachment written and `read_artifact` called against it, not `agent_trace` re-run.

### 6.1 Probe route lifecycle

The four `/scope_probe` routes are deleted in a **separate commit, after the smoke test passes.**

Task 9's spec says "Task 10, all four together", and that is honoured — but not in the commit that
introduces the agent. `POST /scope_probe/adapter` is the only way to drive a tool core without the
agent, which makes it the instrument that distinguishes *the agent or the wrapper is broken* from
*the core is broken*: same input, one call, unambiguous. Deleting it in the commit that first
exercises the agent removes the differential exactly when it is needed.

They do not survive the task. CHANGELOG 2026.07.3110 names them as ungated and write-capable, held
back only by a source comment; deferring their removal twice is how a temporary route becomes
permanent.

---

## 7. Definition of done

- [ ] `npm test` green, including the backtick / `${` / `\n` assertions on the instructions file
- [ ] `now-sdk build` clean
- [ ] `now-sdk install --alias gpinst01` clean
- [ ] `context_processing_script` and `applicability_script` verified **empty** on the installed
      agent via MCP (R-7)
- [ ] Deployed `instructions` matches `docs/agent/agent-doctor-instructions.md`
- [ ] Panel smoke test returns the line-42 script error against
      `c9d63a932bda8b9417a6ffbeee91bfd0`
- [ ] All audit rows for that conversation resolve to one run; `_agentic_context_` confirmed present
      on the panel path (closes R-2's API-path caveat) or its absence recorded
- [ ] LLD §3.1 status row corrected; run-completion ruling added to DESIGN.md §4
- [ ] Four `/scope_probe` routes deleted, in a separate commit after the smoke test
- [ ] Version incremented in `package.json` and the README badge
- [ ] Issue → branch → PR; nothing committed to `main`

---

## 8. Out of scope

- The derived-completeness reader (layers swept) — **Task 11**
- `docs/agent/playbook.md`, the harness-neutral rendering — **Tasks 7–8**
- The five remaining tool cores and their wrappers — **Tasks 7–8**
- `log_analysis` roster decision — **Task 8**
- `PaToolAgentTrace` detail mode — still deferred
- Writing `transcript`, `context_summary`, `fix_report` or `error` — **Phase 2**, per §1.4
- Benchmark seed agents and where they live — **Task 11**, explicitly undecided
