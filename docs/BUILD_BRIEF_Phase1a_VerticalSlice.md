# Build Brief — Phase 1a Vertical Slice (starts at Task 2)

**What this is:** a self-contained prompt to paste into a **fresh** Claude Code session. It carries
the facts a new session cannot know — live-verified instance state, and the traps that cost hours —
so they are not rediscovered.

**Written:** 2026-07-31, immediately after `PaToolAgentTrace` merged and the ruling ledger was
discharged.
**Naming:** follows `BUILD_BRIEF_PaToolAgentTrace.md`. One brief per block of work.

---

Build the Phase 1a vertical slice in this repo, starting at **Task 2**.

## Where things stand

`main` is clean, at version **2026.07.3104**, building and installing to **gpinst01**. Read these first:

- `docs/IMPLEMENTATION_PLAN.md` — the task list. **Tasks 2, 4, 5, 9, 10** are this block of work.
- `docs/LOW_LEVEL_DESIGN.md` — **§3.1/§3.2** (the two table schemas Task 2 builds), **§4.4–§4.7**
  (artifact store, run anchor, audit logger, adapter), **§5** (the Agent Doctor record set)
- `DESIGN.md` §4 — rulings **R-1 … R-19b**, the build contract. Long, but it is where every
  expensive lesson lives.
- `CLAUDE.md` auto-loads `.claude/context/sdk-reference.md` (42 SDK build rules — #41/#42 were
  added by Task 2 and both concern `Table()`). 39 golden Fluent
  examples in `.claude/context/sdk-examples/`.

**Already built and working:**

- The scoped app `x_snc_troubleshoot` (scopeId `13043037d3da4293904504ef30589334`)
- `src/fluent/scope-readability.now.ts` — `GET /api/x_snc_troubleshoot/scope_probe/reads`
- `src/server/tools/PaToolAgentTrace.js` + `src/fluent/script-includes.now.ts` — the first tool
  core, **summary mode only**, verified against real `sn_aia_*` rows
- `test/` — Jest, 76 tests, `npm test`
- A **temporary** `POST /scope_probe/trace` route — the only way to drive a tool core today.
  **Delete it when Task 9's adapter lands.**

## What to build, in this order

This is a **vertical slice, deliberately chosen over building the remaining five tool cores.** The
reason matters and should not be reversed without a decision: the project's strategy (DESIGN.md §1)
is *"cheap to falsify"*, and nothing has been falsified yet. Building one more tool core proves
nothing new; a working agent answers three open questions at once.

| Task | What | Why it is in the slice |
|---|---|---|
| **2** | Fluent `Table()` for `x_snc_troubleshoot_run` + `_audit` (LLD §3.1/§3.2) | prerequisite for 4 and 5 |
| **4** | `PaArtifactStore` — >4KB content to an attachment, paged reads | **hard blocker**: a real trace is **~35KB against a 4,000-char threshold**, so `PaToolAgentTrace` cannot currently be handed to an agent at all |
| **5** | `PaRunAnchor` + `PaAuditLogger` | anchors artifacts and audit per conversation |
| **9** | `PaScriptToolAdapter` + one thin wrapper | the native-harness bridge |
| **10** | Agent Doctor as a Fluent `AiAgent` — **`agent_trace` ONLY**, not all 7 | the point of the slice |
| — | **Panel smoke test** against the known-answer specimen | answers R-2, R-3 and the 35KB question in one run |

Then: remaining tool cores (Tasks 7, 8), then the benchmark (11, 12).

**Do not** build all seven tools in Task 10. One tool, end to end, on the Now Assist panel.

## Verified facts — use these, don't re-derive them

- **14 of 15 tables readable** from `x_snc_troubleshoot` via `GlideRecordSecure`, **no privilege
  grant needed**. Re-confirm any time with `GET /api/x_snc_troubleshoot/scope_probe/reads`.
- **`syslog` is DENIED, and the `sys_scope_privilege` grant does NOT fix it** (R-19). The grant is
  already declared in `src/fluent/cross-scope-privileges.now.ts`, installs correctly, and is inert:
  `caller_access = Caller Restriction` is not satisfied by a self-declared privilege. **Do not
  re-attempt it.** Blocks `PaToolLogAnalysis` only.
- **Known-answer specimen on gpinst01:** execution `c9d63a932bda8b9417a6ffbeee91bfd0`. Expected
  diagnosis: `script_error` citing `sn_aia_agent.601672d3….context_processing_script` **line 42**,
  `InternalError`. It is **invisible from the plan header** — `state=Completed`, empty
  `state_reason`, all 11 tasks and 5 tool calls `Success` — so it tests whether a shallow diagnosis
  gets caught, not merely whether rows were read.
- **keynexus01 is unreachable** (no `now-sdk auth` entry) and its plugin state is unverified.
  Everything happens on gpinst01.
- `_agentic_context_` is a **JSON string** global available to script tools, carrying `agent_id`,
  `conversation_id`, `usecase_id`, `execution_plan_id`. `PaRunAnchor` keys on `conversation_id`.
  `gs.getSessionID()` returns the literal `"SYSTEM"` — never key on it.

## Traps that will cost you hours — all found the hard way

1. **`input_schema` is an ARRAY** of `{name, description, mandatory}`. A JSON-Schema object causes a
   **silent, never-terminating stall** — the execution hangs in `In progress` forever with no error.
   The single most expensive defect found in Phase 0 (R-5).
2. **There is no `outputs` object.** The signature is `(function(inputs) { … return result; })(inputs);`
   and the trailing `(inputs)` is **required** — omitting it builds and installs cleanly and fails
   only at runtime (Build Rule #19).
3. **Never touch the exception object in a cross-scope `catch`.** Reading `.message` off a
   `ScopeAccessNotGrantedException` throws *again*, escapes the handler, and 500s the whole request.
   Record `'DENIED'` and move on (R-1). Track a `phase` variable if you want to localise failures.
4. **Every declared input may be absent** (R-9). The probe agent never passed a declared input in
   *any* run while its own reasoning text claimed it had. No argument is mandatory.
5. **The adapter must pass bare strings through UNCHANGED** — never wrap as `{value: …}`. The cores
   normalise raw strings themselves (`PaToolAgentTrace` maps a bare sys_id to `{execution: …}`), so
   wrapping produces args with neither key and a silent fall-through (LLD §4 contract, §4.7 Note 4).
6. **A wrong field name returns blanks, not an error** (R-6). Assert field presence with
   `isValidField`; never infer "no data" from an absent field. This caught six real defects.
7. **Script Includes need `accessibleFrom: 'public'`** — script tools execute in `rhino.global`, not
   the app scope, so the default `package_private` builds fine and fails at runtime.
8. **Fluent property values must be a SINGLE literal.** `'foo' + 'bar'` fails the parse with `TS303`
   (Build Rule #29). Use one string or one backtick template.
9. **Jest tests must NOT live under `src/`** — `now-sdk build` lints the whole source tree and a
   test's `require('vm')` fails the entire build (R-14). They go in `test/`.
10. **Scoped table names must begin with the exact scope value** — `x_snc_troubleshoot_*`. `x_pa_*`
    is not shorthand, it is a name the platform rejects (R-13).
11. **For Task 10 specifically:** `securityAcl` is mandatory on `AiAgent`; inline `tools[]` entries
    must **not** carry `$id` (Rule #32); every tool needs a non-empty `description` or the record is
    **silently skipped at install** while its m2m row still installs (Rule #34); **no `triggerConfig`**
    on a bare `AiAgent` — it yields a null usecase and never fires (Rule #31); and never `Now.ref()`
    for roles/agents/scriptIds in the AI family (phantom GUIDs, silent failure — Rules #21, #33).
12. **`context_processing_script` and `applicability_script` are AUTO-POPULATED** by the platform on
    creation. Omitting them does not leave them empty — they must be **explicitly cleared and the
    clearing verified** (R-7). Auto-populated `applicability_script` bodies end in `return false;`,
    which suppresses the agent silently. This is the field class both known failures live in.

## How to verify it works

Build and install, then drive it from MCP against real records. **A tool that returns a
plausible-looking summary from empty data is the failure mode to guard against** — the platform
hands back blanks rather than errors in several places, so check that what you rendered came from
rows that exist. `PaToolAgentTrace` emits an `evidence_basis` block for exactly this; keep the habit.

The slice is done when a conversation on the **Now Assist panel** asks Agent Doctor to diagnose
`c9d63a932bda8b9417a6ffbeee91bfd0` and it returns the script error at line 42.

## Two decisions to make, not assume

1. **`log_analysis` in the roster.** `syslog` is blocked (R-19). Recommendation on record: keep the
   tool at 7 and have it **degrade explicitly** — an agent with no log tool cannot tell you the log
   layer was skipped. Confirm at Task 10.
2. **Where benchmark seed agents live** (Task 11) — Fluent gives reproducibility but ships five
   broken agents inside the product app; MCP keeps them out but is not reproducible. Likely a
   separate scoped app. **Explicitly undecided** — decide before Task 11, not during it.

## Working conventions that are load-bearing here

- **Never commit to `main`** — branch, PR, merge. Every change needs a GitHub issue.
- **SDK owns creation** (Fluent in `src/fluent/`); **MCP owns runtime** (execute, trace, query).
  Agent Doctor is a Fluent `AiAgent`, *not* MCP record automation (R-13, CLAUDE.md).
- Increment the version on every merge to `main` (`YYYY.MM.DDXX`), in `package.json` **and** the
  README badge.
- **Corrections replace the text they invalidate — they do not sit beside it** (R-18b), and in a
  structured record **the status label is part of the claim** (R-19b). The repo uses
  `~~strikethrough~~` for superseded text.
- A ruling whose **Change** clause names a document section is a **work item, not a record**
  (R-18c). Six rulings were found recorded-but-unapplied; the ledger walk is now **bidirectional** —
  check both *applied?* and *superseded?* (R-19a).

Ask before making design choices the LLD doesn't settle. If you defer part of the spec, say so
explicitly rather than narrowing it silently.
