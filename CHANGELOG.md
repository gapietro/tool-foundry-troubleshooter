# Changelog

Version format is `YYYY.MM.DDXX` per `CLAUDE.md` — year, zero-padded month, then day plus a
two-digit daily counter. Incremented on every merge to `main`.

> **Note on the version string.** It is not valid semver (`2026.07.3001` has a leading zero in
> the month), which npm and `now-sdk build` both accept. It is also **baked into the generated
> module require paths** in `dist/` — e.g.
> `x_snc_troubleshoot/x-snc-troubleshoot/2026.07.3001/src/server/script.ts` — so every version
> bump rewrites those paths in the installed app. Verified 2026-07-30 on SDK 4.9.2.

---

## 2026.07.3111 — 2026-07-31

Phase 1a vertical slice, **Task 10**: Agent Doctor as a Fluent `AiAgent`
(`src/fluent/agent-doctor.now.ts`), wired to the two script tools built in Task 9 —
`agent_trace` and `read_artifact` — with its instruction document at
`docs/agent/agent-doctor-instructions.md`. This is the first time any of the server-side
components built across this slice have been driven by an actual agent rather than a probe
route or a unit test.

**The run-completion contract, new ruling R-20.** Native diagnostic runs have no terminal
state, and that is by design, not an oversight. The native harness emits no
end-of-conversation signal, so completion could only ever be *declared* by something inside
the system, and all three candidates fail on grounds already measured earlier in this slice.
The agent itself is unreliable as a declarer — R-9's Phase 0 probe caught it passing a
declared input in zero runs while its own reasoning trace claimed it had. A clock is out
because it reintroduces the time-window reasoning R-2 deleted outright. And
`sn_aia_execution_plan` state is scoped to a single turn, not to a conversation, so closing a
run on it would end the run while the user is still asking follow-up questions — which the
PRD explicitly wants to support. Completeness is instead **derived**, not declared: read from
`x_snc_troubleshoot_audit`, as the distinct set of `tool_name` values recorded under
`action_type='result'`. That answers the harder question the design doc poses — a run that
stopped early is indistinguishable from one that genuinely finished — which a status column
is structurally incapable of answering, since it can only report what it was last told.
Consequence: `status`, `transcript`, `context_summary`, `fix_report`, and `error` are Phase 2
(custom harness) columns and stay unwritten on the native path; LLD §3.1's status-row
description was corrected in this same PR to say so. A guard test fails the suite if anyone
adds a completion-declaring code path in the future.

**Task 3 was never built, and that surfaced here.** `docs/agent/` did not exist anywhere in
git history. The Phase 1a build brief scoped the slice to Tasks 2, 4, 5, 9, and 10, and
silently dropped Task 3 — but Task 10's `instructions` property was specified as depending on
"the Task 3 native rendering", a document that had never been written. Resolved by writing
the native rendering scoped to the two tools that actually exist, `agent_trace` and
`read_artifact`, rather than the full seven-tool roster the design assumes. The
harness-neutral `playbook.md` stays deferred to Tasks 7–8, where the remaining tool cores get
built.

**Build Rule #43's backtick corollary reaches `instructions`, not just `script`.**
`instructions` is a Fluent backtick template exactly like a tool's `script`, so a markdown
code span inside it closes the template early and produces the same misdirecting cluster of
errors — TS2796, TS304, TS20 — at line numbers scattered across the file rather than at the
offending backtick. The instruction document was therefore written with no backtick, no
`${`, and no two-character backslash-n escape anywhere: table names appear bare in prose
instead of in code spans, and the Fix Report template uses indentation rather than fenced code
blocks. Three Jest tests enforce all three constraints so a future edit can't reintroduce
them. Worth flagging: `.claude/context/sdk-reference.md`'s Rule #43 currently documents this
failure mode for `script` templates only — the text should be broadened, since `instructions`
is exposed to exactly the same TypeScript-consumes-the-escape mechanism.

**The live results on gpinst01 — the actual point of building the slice.** Reported plainly,
including what didn't go as designed:

- Install was clean, and produced exactly two `sn_aia_tool` records and two
  `sn_aia_agent_tool_m2m` rows with names matching the Fluent definitions — Build Rule #34's
  silent-tool-skip-on-missing-description defect did not fire here.
- The panel smoke test found the seeded defect. Agent `601672d3…`,
  `context_processing_script`, line 42, `InternalError` — against a specimen whose failure is
  invisible from the plan header alone: `state=Completed`, `state_reason` empty, all 11 tasks
  and all 5 tool calls reporting `Success`. The defect only shows up once something reads past
  the header.
- The agent correctly reported layers 2–7 as **not swept**, per its instructions, and gave a
  per-layer table showing what it had and hadn't looked at.
- **`_agentic_context_` is present on the Now Assist panel path.** 16 audit rows all resolved
  to one run (`TR1000032`). R-2's earlier closure on this point was explicitly
  API-path-provisional — it had only ever been observed via `servicenow_aia_execute` — and the
  build brief required re-confirming it before the benchmark work in Task 11 could rely on it.
  It is now confirmed on the panel path too.
- Artifact paging held under a real invocation. One attachment, 26,871 bytes; one
  `agent_trace` call; seven `read_artifact` calls at offsets 0, 4000, 8000 … 24000. Task 9's
  paging-that-pages defect stayed closed at the first real agent-driven call, not just in the
  measured probe.
- `sn_aia_message.role` vocabulary is confirmed as `user_profile` / `user` / `agent`, with
  `history` defined on the table but unused in practice — a check DESIGN.md §78 records as
  never having been performed before this task.

**Two findings from the live run that must not be smoothed over.**

R-7 came back half-refuted. `applicability_script` was empty on the installed agent, which is
the dangerous field — the one where an auto-populated `return false;` silently suppresses
everything — and it is clean. But `context_processing_script` *was* auto-populated, with
2,124 characters of platform boilerplate: a comment block followed by a no-op pass-through
returning `{ pageContext: context?.pageContext, triggerContext: context?.triggerContext }`.
The plan called for clearing it. The ruling was not to, at least not before the smoke test,
because that script is what forwards context into the agent, and `PaRunAnchor` keys every
run on `_agentic_context_.conversation_id` — clearing an unverified field first would have put
three candidate causes behind any smoke-test failure with no way to tell them apart. It
remains uncleared on the instance and the question is open.

Second, the agent found the right answer and ranked it second. It produced three candidate
root causes and marked only the layer-1-observable one CONFIRMED, correctly labelling the
line-42 script error UNCONFIRMED — which is exactly what the instructions require, since
confirming a script error needs a Layer 2 tool the agent doesn't have yet. But it gave a
self-generated tool-input-schema narrative primary billing over the correct finding, which the
instructions never asked it to do. The instruction document specifies how to *label*
confidence but says nothing about how to *rank* candidates against each other. This was
deliberately left untuned: with n=1, tuning the instructions against the single specimen we
also test against overfits to that specimen and mildly contaminates the blind-run protocol
§2.4 depends on. Task 11's 5-seeds-by-2-runs benchmark will say whether the mis-ranking is
systematic or a one-off.

**Access findings worth recording for later tasks.** Both `sn_aia_message` and
`sn_aia_version` are ACL-denied on gpinst01 even to admin — the same restriction class already
known for `sys_generative_ai_log`. Verification for this task read `sys_cs_message` and
`sys_choice` instead. Practically, this means the plan's step to read the published version
record directly is not reachable as written on this instance.

**Cleanup.** The four temporary `/scope_probe` routes are gone — all four now return 400, and
`/reads` is the one route that survives. They were removed in a separate commit *after* the
smoke test passed, specifically so a smoke-test failure could have been bisected against the
probe routes still being present, rather than against the tool cores themselves.

**Known gaps carried forward.** `playbook.md` (Tasks 7–8); the five remaining tool cores and
their wrappers; the derived-completeness "layers swept" reader (Task 11); the `log_analysis`
roster decision, still open and now explicitly deferred to Task 8 because
`PaToolLogAnalysis` has no core yet to include or exclude it against; and one minor
test-hardening item — the guard tests strip comments with a regex that isn't string-aware, so
it's currently unreachable but would weaken the `Now.ref` guard if a `//` ever appeared inside
a string literal on a line that also carried a real `Now.ref(` call.

## 2026.07.3110 — 2026-07-31

Phase 1a vertical slice, **Task 9**: `PaScriptToolAdapter` + the `read_artifact` tool core
(LLD §4.7) — the bridge an AI Agent script tool calls to reach a diagnostic tool core. Scoped
to **two** wrappers, `agent_trace` and `read_artifact`, rather than the plan's seven: it is the
smallest set that makes the Task 10 panel smoke test answerable, and the other five need cores
that do not exist yet.

**The defect this task existed to close.** `PaArtifactStore.MAX_PAGE_CHARS` is 4000 and
`THRESHOLD_CHARS` is also 4000, so a full page *plus its envelope* always exceeds the threshold.
Routed through `applyThreshold` like any other result, `read_artifact` would have stored every
page as a **new** attachment and returned an excerpt of it — paging that pages, with the agent no
closer to the content on each call, and nothing anywhere reporting a problem. The exemption is a
`PAGED_OUTPUT: true` flag declared on the tool core rather than in the Fluent wrapper literal,
because a wrapper literal is a string no unit test can reach.

Closed by measurement on gpinst01, not by argument: a real trace of **26,847 chars** stored as
**one** attachment (`1f1a63a7…bf91`) and paged back in seven calls — 6×4000 + 2847 — reassembling
to exactly 26,847, with the joins landing mid-word and mid-sys_id. The attachment counter never
advanced past 1, which is the falsifier that matters.

**Tools resolve by NAME against a closed factory map**, deviating from LLD §4.7's
`invoke(toolClassName, …)`. The first argument originates in a tool-script literal and beyond
that in whatever the platform hands the wrapper, so resolving an arbitrary class by string is a
code-execution surface. The map is an allowlist, errors cleanly on a typo, and its key is the
same string written to `x_snc_troubleshoot_audit.tool_name` — registry and audit trail cannot
drift apart.

**A bare string reaches the tool core completely untouched, whitespace included** (LLD §4.7
Note 4). The plan originally trimmed it; that was reversed mid-build. Wrapping a bare string as
`{value: s}` — the older, superseded reading — produces an args object with none of the keys the
cores read, so `PaToolAgentTrace` falls through to its recent-plan pick-list and **silently
discards the caller's request**. Trimming is milder but the same class of liberty: the core owns
normalisation, and the adapter does not second-guess it.

**Run-anchor degradation is surfaced to the agent** as `run: {degraded, note}` — an addition
beyond LLD §4.7. `PaArtifactStore` and `PaAuditLogger` both tolerate a degraded anchor quietly,
so without this the agent would never learn that the evidence trail behind its diagnosis was not
durable. The findings stay valid; the difference has to be stated rather than inferred (R-10).

**Containment.** `invoke()` returns a String on every path including every failure path, and a
caught exception is never read — a `phase` variable localises failures instead (R-1). The tests
enforce it with a fake whose `.message` getter throws, which is the shape a
`ScopeAccessNotGrantedException` presents: any future edit that reads `e.message` fails the suite
rather than 500-ing on an instance weeks later.

**Known gaps, deliberately carried to Task 10.** `PaRunAnchor` has no run-completion path, so
every run sits at `status: "running"` — invisible while a run is one call long, load-bearing the
moment the wrapper makes a run span calls. The four `/scope_probe` routes are ungated and
write-capable, held back only by a source comment, and are removed with the Task 10 agent.
`_stringify` guards `undefined` but not every non-string `JSON.stringify` return. An unknown tool
name leaves no trace anywhere, so an agent hallucinating a tool name is currently invisible.

## 2026.07.3109 — 2026-07-31

Phase 1a vertical slice, **Task 5**: `PaRunAnchor` + `PaAuditLogger` (LLD §4.6). Every artifact
is an attachment on a run record and every audit row references one, so this is the component
that decides *which* record a given tool call belongs to — and the expensive way to get that
wrong is not to fail, it is to answer with the wrong record and carry on.

**A spec gap closed first.** LLD §4.6 keys the anchor on `_agentic_context_.conversation_id`, but
§3.1's column list had nowhere to store it and `execution_ref` is spent on the execution plan
*under diagnosis*. `getOrCreate` could therefore only ever create, never get. Added
`conversation_ref` to `x_snc_troubleshoot_run`.

**R-2 enforced structurally, not by convention.** With no conversation id and no execution ref
there is no key, and R-2 deleted time-window keying from the design entirely. An unkeyed call now
creates an *isolated* run used for that call alone, and says so. Two unkeyed calls never share a
record — a merged anchor lets benchmark run 2 read run 1's artifacts and quietly destroys the
blind-run independence the doubled-run protocol exists to measure (§2.4). The test named
"two unkeyed calls NEVER share a run" is the guard on that.

**Concurrency.** R-3 measured up to four tool calls in a single timestamp batch, all racing to
create the anchor. There is no atomic upsert available, so convergence is bought after the fact:
insert, then re-resolve the key and adopt the deterministic winner (oldest `sys_created_on`,
`sys_id` as tie-break — and ties are the *normal* case, since a batch lands inside one second).
Losing rows are left alone rather than deleted.

`PaAuditLogger` is total by construction: it sits in the hot path of every tool call, so a
logging failure must degrade the trail, never the diagnosis. It also digests payloads past 4KB,
because `applyThreshold` has already offloaded oversized results by the time `logResult` runs and
re-storing them here would undo that work in a different table.

**Verified on gpinst01, not in a stub** (R-8) via a temporary `POST /scope_probe/anchor_selftest`
route, which cleans up after itself: the conversation key resolves two calls to one run, unkeyed
calls stay isolated, `readNativeContext()` survives `_agentic_context_` being absent (a REST route
is exactly such a runtime — an unguarded read is a `ReferenceError` that kills the request), audit
rows write *and read back*, `autoNumber` still populates `number` (Build Rule #41 re-check), and a
20,008-char payload stored as 4,024. 194 Jest tests pass.

Two defects were caught in self-review and fixed before merge: the choice-vocabulary check used
an object as a lookup map, so a caller-supplied `harness: "constructor"` answered truthy off
`Object.prototype` and was written into the choice field; and `PaAuditLogger` parsed a
JSON-string `params` for its fields but picked the payload off the raw string, writing a correct
tool name beside a silently empty `input`. Both have regression tests.

**Two Medium security findings on PR #21, both fixed and both verified live:**

*Audit metadata is now server-authoritative.* `user` came from the caller when supplied, and
`confirmed_by_user` was caller-settable. The caller is the Task 9 adapter, and part of what
reaches it is LLM-derived — a trace payload is a plausible prompt-injection carrier, the same
threat model behind `PaArtifactStore.read()` refusing foreign attachments. An audit trail whose
*actor* field is supplied by the thing being audited is not an audit trail. `user` is now always
`gs.getUserID()`; `confirmed_by_user` is always false, and Phase 2's gate will set it from the
workflow that actually collects the confirmation. Neither override had a consumer.

*The ambient context now wins over caller-supplied identity.* `getOrCreate` took caller values
first, unconditionally — so a native tool call could name **any** conversation and be handed that
conversation's run record, its artifacts and its audit trail. That is the R-2 merge reintroduced
through the front door. LLD §4.6 already said the native key *is*
`_agentic_context_.conversation_id`; "caller first" was a liberty, and one of the tests had
encoded it. Caller-supplied identity is now honoured only where there is no ambient context to
contradict it — the custom harness (§4.6: "custom: explicit run_id"), tests, and the self-test
route. `harness` and `mode` stay caller-first: they are configuration, not identity.

On that remaining caller-controlled path, a resolved run belonging to a different user is not
adopted. The check fails **open** on "cannot tell" (no recorded owner, or an unidentifiable
caller) and closed only on "can tell, and it is not you" — a false rejection would split an
anchor, which is the failure this component exists to prevent, and the native runtime's identity
surface is unverified until Task 10. It applies to the caller-supplied path only, and to the
post-insert re-resolve as well: the refused run is *older*, so without the filter on that second
lookup it would have been adopted one step after being rejected. Foreign runs are skipped rather
than stopped on, so a second call by the same user converges on its own run instead of creating a
new one every time.

**One High finding on round 2, fixed and reproduced live.** The ownership check derived
"did the caller supply this key" from `native.present` — but `present` only means *the global
parsed to an object*. An `_agentic_context_` of `{}`, or one carrying junk, or one whose
`conversation_id` is the literal string `"undefined"` (which LLD §4 normalises to empty), all
make `present` true while the key still falls through to the caller — so the ownership filter was
skipped on a key the caller chose, re-opening cross-user fixation. Provenance is now tracked **per
field**: the flag is `!native.conversation_id` (or `!native.execution_plan_id`) for whichever
value is actually being used as the key. `readNativeContext()` carries a warning that `present`
must never be used for that decision. Four regression tests, each verified to fail against the
unfixed code.

The self-test route plants a foreign-owned run and attempts every variant. Notably
`context_seen: true` on the partial-context step — assigning `_agentic_context_` without a `var`
declaration does reach `PaRunAnchor` through the Rhino global object, so the vulnerable path was
reproduced in a real runtime rather than only in a stub, and the fix holds there. `refused`,
`key_rejected`, `converges_on_own_run` and `spoof_ignored` all true on gpinst01. 211 Jest tests
pass.

**New SDK finding, folded into Build Rule #43** (`.claude/context/sdk-reference.md`): a backtick
*anywhere* inside a Fluent `` script`…` `` template — including inside a `//` comment — closes the
template. Markdown-style quoting in an explanatory comment is the natural way to write one and
silently terminates the script. It fails at build rather than at runtime, but the diagnostics
(`TS2796`, `TS304`, `TS20`, `Failed to cast TaggedTemplateExpressionShape`) point at lines
scattered across the file rather than at the backtick.

## 2026.07.3108 — 2026-07-31

Housekeeping after Task 4. `IMPLEMENTATION_PLAN.md` and
`BUILD_BRIEF_Phase1a_VerticalSlice.md` both still described `PaArtifactStore` as outstanding, and
the brief still listed it as the **hard blocker** on the vertical slice — which is what the next
session reads to decide what to build. Task 4 is marked done in both, with the measured evidence
and the three findings worth carrying forward rather than rediscovering.

Docs only. No source, no Fluent, no instance change.

## 2026.07.3107 — 2026-07-31

Phase 1a vertical slice, **Task 4**: `PaArtifactStore` — the blocker on the whole slice. A real
`PaToolAgentTrace` summary measures ~35KB against a 4,000-char excerpt budget, so until
oversized output could live outside the prompt, the first tool core could not be handed to an
agent at all.

- **`src/server/PaArtifactStore.js`** — `store()` puts over-threshold content on the run record
  as an attachment and returns a head+tail excerpt plus an `artifact_id`; `read()` pages it back
  4KB at a time (the future `read_artifact` tool); `applyThreshold()` is the wrapper the Task 9
  adapter will apply to every tool result, returning small results by identity.
- **42 Jest tests**, written first. They settle arithmetic — truncation, paging, boundaries,
  byte-identical reassembly — and per **R-8** nothing else.
- **Live-verified on gpinst01**, which is what actually closed LLD §4.5's `⚠ VERIFY` on the
  scoped-app attachment surface: 35,000 chars stored and paged back **byte-identical** in nine
  reads from scope `x_snc_troubleshoot`.

Two deliberate departures from the LLD sketch, both documented in §4.5: `read()` refuses any
attachment outside `x_snc_troubleshoot_run` (it is LLM-callable and takes a caller-supplied
sys_id), and a failed store degrades to the excerpt with a named reason rather than falling back
to the full payload.

**New SDK failure mode found and recorded as Build Rule #43:** a `\n` inside a Fluent
`` script`…` `` template literal is consumed by TypeScript, emitting a real newline that leaves
the platform script's string constant unterminated. Builds clean, installs clean, and fails only
on invocation — at a line number that does not match the source.

## 2026.07.3106 — 2026-07-31

Phase 1a vertical slice, **Task 2**: the two scoped tables every later task anchors to. First
Fluent artifacts in this repo that hold data rather than describe behaviour.

> **Gap noted, not backfilled:** versions `2026.07.3101`–`2026.07.3105` were merged without
> changelog entries. The history is in the git log and the PRs; reconstructing it here was out
> of scope for this task, but the convention says every merge gets an entry.

### Added
- `src/fluent/tables.now.ts` — `x_snc_troubleshoot_run` and `x_snc_troubleshoot_audit` per
  LLD §3.1/§3.2. Installed and verified on gpinst01: 11 and 9 declared columns respectively,
  12 `sys_choice` rows across the 4 choice fields, `TR` auto-number counter, the cross-scope
  `agent` reference into `sn_aia_agent`, and cascade-delete from run to audit.
- `src/fluent/acls.now.ts` — roles `x_snc_troubleshoot.admin` / `.user` and 6 record ACLs.
  Added after the install measurement below; **the audit table deliberately gets `read` +
  `create` only**, making the evidence trail append-only through the ACL layer while the
  server-side writer that fills it is unaffected.
- SDK Build Rules **#41** and **#42** in `.claude/context/sdk-reference.md` — both found by
  inserting a real row after a clean install, neither visible at build or install time.

### Fixed
- **`autoNumber` does not populate `number`.** It writes the `sys_number` counter and stops;
  the column installs with an empty default, so every insert left `number` blank — and with
  `display: 'number'`, every run record would have rendered with a blank display value. Fixed
  with the explicit column default. **The `global.` qualifier is load-bearing:** the bare
  `javascript:getNextObjNumberPadded();` installs identically and still yields `''`, because a
  scoped app cannot resolve the global function unqualified and the failed evaluation degrades
  to empty instead of throwing. Measured, then confirmed against instance convention (8 of 10
  scoped `x_*` tables sampled use the qualified form). Build Rule #41.
- **Custom tables install with zero ACLs and `ws_access=false`,** which denies REST and UI
  access to everyone including admin. Caught because an admin REST insert returned
  `Access denied: User Not Authorized`. It would not have surfaced from the code that writes
  these rows: a server-side scoped `GlideRecord` bypasses ACLs, so Task 5's writes would have
  worked while nobody could read a Fix Report. Build Rule #42.

---

## 2026.07.3001 — 2026-07-30

Reconciled the implementation plan with the SDK structure and finalized the scoped table names.
Docs and project metadata only; no Fluent artifacts changed.

### Fixed
- **Scoped table names were unbuildable.** `LOW_LEVEL_DESIGN.md` §3 deferred the scope prefix
  ("finalize at SDK setup") and SDK setup then happened without it. `x_pa_run` / `x_snc_pa_run`
  cannot be created from scope `x_snc_troubleshoot` — a scoped table name must begin with its
  application's exact scope value (verified on gpinst01: 40 of 40 sampled `x_snc_*` tables).
  Finalized to `x_snc_troubleshoot_run` and `x_snc_troubleshoot_audit`; LLD §3 is now the
  authority for table names.
- **`IMPLEMENTATION_PLAN.md` Task 10 contradicted the SDK/MCP boundary** — it specified creating
  Agent Doctor on-instance via MCP automation, where `CLAUDE.md` requires SDK-owned creation.
  Now a Fluent `AiAgent` in `src/fluent/agent-doctor.now.ts`.
- Plan file paths repointed from the never-created `src/instance/**` tree to the real
  `src/fluent/` + `src/server/` layout.
- `package.json` version aligned with the documented convention (was `0.0.1` from the SDK
  scaffold, against a README badge reading `2026.07.1801`).

### Added
- `CHANGELOG.md` — referenced by `CLAUDE.md` but previously absent.
- `IMPLEMENTATION_PLAN.md` gains a "Structural contract" section, and two Phase 0 rulings that
  tool authors kept rediscovering are promoted into its standing Design Rules table: **R-9**
  (every declared input may be absent at runtime) and **R-1** (never touch the exception object
  in a cross-scope `catch`).
- `DESIGN.md` ruling **R-13** recording the above.

---

## 2026.07.1801 — 2026-07-30

Phase 0 pre-flight and SDK scaffold. Verdict: **GO**, zero items carried forward.

### Added
- ServiceNow SDK app scaffolded — scope `x_snc_troubleshoot`, SDK 4.9.2, building and installing
  to gpinst01.
- `src/fluent/scope-readability.now.ts` — the LLD §6 `/status`-equivalent cross-scope readability
  check, run from inside the scoped app. **14 of 15 tables readable, 1 denied (`syslog`).**
  This discharged the last carried-forward Phase 0 item (R-1) and upgraded the verdict to GO.
- `docs/BUILD_BRIEF_PaToolAgentTrace.md` — self-contained build brief for the first tool core.
- `docs/PREFLIGHT_FINDINGS.md`, `DESIGN.md` §4 rulings R-1..R-12, `AGENT_DOCTOR_ARCHITECTURE.md`.

### Fixed
- **R-11 retracted** — the "no Now Assist product plugin" finding was an instrument error. The
  probe queried `v_plugin`, whose visibility is restricted for this caller, and read a *partial*
  result as *absence*. `sys_scope` shows the Now Assist product plugins installed and active.
  keynexus01 used the same instrument and remains unverified.
- `sys_log` → `syslog` (the former table does not exist) and `sn_aia_admin` → `sn_aia.admin`
  across the design docs (R-6).

### Changed
- **R-3 amended.** The same probe ran 19 tool calls on keynexus01 and 5 on gpinst01, neither
  capped — so the difference is instruction adherence, not harness capacity. Consequence:
  premature completion reports as `completed`, indistinguishable from a genuine finish, so the
  benchmark needs a completeness measure and not only a correctness score.

---

## 2.0 — 2026-07-30

Re-aim: *ServiceNow Platform Assistant* becomes **Foundry Troubleshooter**, the in-instance
diagnostic half of the Foundry build→diagnose loop.

### Changed
- Harness strategy set to **tools-first, benchmark-gated** (`ARCHITECTURE_DECISIONS.md`
  Decision 0.5, confirmed by the design spar in `DESIGN.md` §1). The load-bearing component is
  the benchmark, not Agent Doctor: native-first is not "native is right", it is
  "native is cheap to falsify".
- Evidence Bundle collector promoted to Phase 1a as a harness-agnostic core — it doubles as the
  doctor-down detector and the benchmark de-risker (`DESIGN.md` §2.1).
