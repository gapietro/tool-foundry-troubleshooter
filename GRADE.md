# GRADE.md — Senior Production-Readiness Grade Ledger

Grade ledger for `/senior-grade`. Audit/fix findings belong in `AUDIT.md` (does not exist yet).
Newest sitting first.

---

## Remediation log — changes since sitting 1

Appended as findings close. **The sitting-1 score and cap analysis below are deliberately NOT
rewritten**: a grade is a measurement at a commit, and editing it as fixes land would make sittings
incomparable and quietly erase the baseline the next one is measured against. Sitting 2 re-measures
and reports the movement; this log is what it will read.

| Finding | Closed at | Evidence |
|---|---|---|
| **F-01** (P0, release blocker) | `2026.08.1204`, #214 / PR #221 | Scaffold deleted; live-verified on gpinst01 — both records gone from this scope, other three apps' copies untouched. Full before/after table under F-01 below. |
| **F-02** (cap trigger: no mandatory CI) | `2026.08.1205`, #215 / PR #222 | `.github/workflows/ci.yml` runs lint → build → test; **required** on `main` with `strict: true` **and `enforce_admins: true`**. Proven, not assumed: throwaway PR #223 with a failing test went red, `mergeStateStatus` **BLOCKED**, `gh pr merge` refused (*"the base branch policy prohibits the merge"*); and a direct push to `main` was refused with **`GH006: Protected branch update failed`**. |
| **F-09** (no linter) | `2026.08.1205`, #215 / PR #222 | ESLint flat config, `ecmaVersion: 5` over `src/server/**`, blocking. Guard proven by injecting `const PROBE = 1` → `Parsing error: The keyword 'const' is reserved`. First run: 151 problems, 150 of which were config-vs-deliberate-pattern; **4 genuine dead assignments across 18k lines**, all fixed. |
| **F-11** (no working typecheck) | `2026.08.1205`, #215 / PR #222 | `src/tsconfig.json` + `tsconfig.server.json` + `tsconfig.client.json` **deleted rather than repaired** — verified `now-sdk build` succeeds with all three absent. `now-sdk build` is the typecheck; CI deliberately carries no `tsc` step that could pass vacuously. |

**Caps that would no longer trigger at sitting 2:** *No mandatory CI → B* is fully lifted (required
check + `enforce_admins`). *No realistic integration or browser coverage → B+* still stands — #220.

**Still open from sitting 1:** F-03 (#218), F-04 (#216), F-05 (#219), F-06 (#217), F-07 (#220),
F-12 (#212). F-08, F-10 and F-13 remain on the register by decision, not oversight.

---

## Sitting 1 — 2026-08-12 @ `82a2d36` (first grade)

**Score 72.9/100 → C** · Previous: none · Production-ready: **No** · Senior-quality: **Partly**

Branch `main`, worktree clean. Node v26.5.0 · npm 11.17.0 · TypeScript 5.5.4 · `@servicenow/sdk` 4.9.2.

### Executed (not read — commands run, output quoted in findings)

| Command | Result |
|---|---|
| `npx jest` | **34 suites / 1781 tests pass**, 0.725s |
| `npx jest --coverage --collectCoverageFrom='src/server/**/*.js'` | **0% across all 21 files** — artifact of the `vm` loader, not absent tests (see F-06) |
| `npx now-sdk build` | **Build completed successfully** |
| `npx tsc --noEmit -p src/tsconfig.json` | pass, no output — **but vacuous: `files: []`, checks nothing** (F-11) |
| `npx tsc --build src/tsconfig.json --dry` | **TS18003 twice** — both referenced projects match zero files (F-11) |
| `npm audit` | 3 high · 8 moderate · 0 critical (all dev-tree) |
| `npm outdated` | sdk 4.9.2→4.10.1 · jest 29→30 · typescript 5.5→7.0 |
| Secrets: working tree + `git log -p --all` (609 commits / 4473 objects) | **clean** |
| Live read-only verification vs gpinst01 (Zurich P10 Hotfix 4a) | F-01 confirmed installed — since **resolved and re-verified**, see F-01 |
| Lint | **no linter configured** — no `.eslintrc*`, no `eslint.config.*` (F-09) |
| CI | **no `.github/workflows`** (F-02) |

### Three strongest qualities

1. **Decision provenance is best-in-class.** `DESIGN.md` §4 rulings, `benchmark/DECISION.md`
   pre-registrations with falsifiers and revert triggers, 43 build rules each traced to an observed
   failure. §5 closes the benchmark by *documenting* nine defects rather than burying them, and
   §5.2 publishes the finding most damaging to the author's own thesis.
2. **The AI-reachable read path is correctly secured.** The model chooses table *and* encoded query
   with no allow-list (`PaToolQueryTable.js:175`), and that is safe because every core read goes
   through `PaToolReadKit.readRows`/`readOne`, both of which use `GlideRecordSecure`
   (`PaToolReadKit.js:148,188`) — so an injected instruction cannot reach data the caller could not.
   Paired with `PaToolRegistry`'s fail-closed `destructive:false` gate.
3. **Test mass is real and proportionate** — 20,151 test lines against 18,453 source lines (1.09:1),
   1,309 of 1,781 tests against product modules.

### Three largest risks

1. **F-01** — SDK scaffold code ships and is **installed and active on `incident`**.
2. **F-04** — customer data captured into run artifacts has **no retention or purge** anywhere.
3. **F-02/F-06/F-07** — no CI, no measurable coverage, no integration test: nothing mechanical
   defends any of the above, in a repo whose own `CLAUDE.md` states "a green `now-sdk build`
   carries almost no signal."

### Grading table

| Category | Weight | Raw | Weighted | Rationale |
|---|---|---|---|---|
| Product coherence | 5% | 78 | 3.90 | Coherent workflow with deliberate failure behavior (Evidence Bundle floor, partial-result guarantee, cause-of-death taxonomy). Held back by an unmeasured core claim and F-01 shipping unrelated artifacts. |
| Architecture | 15% | 84 | 12.60 | Clear SDK/MCP boundary; harness-agnostic cores; single read path; `PaLlmProxy` sole NASK touchpoint; server logic in testable `.js` not Fluent templates. Held back by a 2,556-line `PaAgentLoop`, F-01 litter, F-11 dead config. |
| Correctness | 15% | 64 | 9.60 | Build, typecheck, 1,781 tests and the live install path all pass. But the product's purpose — right root causes — is unmeasured and demonstrably weak: §AO2 scored 6/6 proposing a fix at a nonexistent column; §AU went 4/4 → 0/4; custom arm 0/10. |
| Security and privacy | 15% | 72 | 10.80 | No secrets in 609 commits; `GlideRecordSecure` on every AI-reachable read; REST ACL decided, emitted and verified; audit table append-only *by deliberate ACL omission* — an elegant control. Held back by F-04 (retention), F-05 (no rate limit on LLM spend), F-08 (accepted prompt injection), F-01. |
| Reliability and concurrency | 10% | 74 | 7.40 | Real bounds (15 iterations / 300s), partial-result guarantee, stale-run sweep, documented fail-open. Held back by F-03's TOCTOU and no event-redelivery idempotency. |
| Testing and AI quality | 15% | 68 | 10.20 | Large suite; an AI evaluation suite far more rigorous than typical (blind seeds, pre-registration, revert triggers). Held back by F-06 (coverage unmeasurable), F-07 (no integration tier), R-27's own admission that fixtures agree with the code by construction and green tests caught none of §5.3, and an eval suite that measured admissibility rather than correctness. |
| Maintainability | 10% | 72 | 7.20 | Exceptional inline rationale, consistent ES5/Rhino discipline. Held back by F-09 (no linter at all), F-10 (2,556-line module), F-11. |
| Operations and observability | 10% | 68 | 6.80 | `/status` deep-readiness (plugins, skill activation, capability mapping, live micro-invocation, table readability, stuck runs) is a genuine strength, as is the audit trail. Held back by no CI/CD, no monitoring, no retention, and `/status` costing an LLM call per request. |
| Documentation and governance | 5% | 88 | 4.40 | The strongest dimension. Docked only for the README figure staleness found and fixed this session, F-11, and docs asserting a read-only posture that F-01 contradicts. |
| **Total** | | | **72.90** | **C** |

### Grade-cap analysis — every cap checked

| Cap | Applies | Evidence |
|---|---|---|
| Secrets committed (tree or history) → F | **No** | `git log -p --all` across 609 commits: zero matches for key/token/PEM patterns. `.gitignore:14-16` covers `.env`/`.snc`. |
| Production build/artifact cannot start → C+ | **No** | `now-sdk build` succeeds; app is installed and functioning on gpinst01 (214 custom runs recorded, 159 complete). |
| Primary user workflow broken → C | **No** | The diagnose workflow executes end-to-end. Its *accuracy* is poor, which the rubric scores under Correctness rather than treating as breakage. |
| Reachable critical/high production vulnerability → C | **No** | F-01 is unintended active code, not a privilege or data-exposure path. F-08 is bounded by read-only + `GlideRecordSecure` and cannot exceed caller privilege. |
| Known critical authorization or data-exposure problem → C+ | **No** | REST ACL verified into `dist/` as `troubleshooter` / `REST_Endpoint` / `execute`; `serviceId` matches the ACL `name`; `enforceAcl` set explicitly on all five routes. |
| No runtime validation at trust boundaries → B− | **No** | `PaRestHandlers` validates request shape; `PaLlmProxy._validate` gates model output; `PaToolRegistry` fails closed on unknown/destructive tools. |
| Unbounded or race-prone async processing → B | **No, narrowly** | Processing is bounded (`MAX_ITERATIONS: 15`, `BUDGET_MS: 300000`). The `markRunning` race (F-03) is real but *deliberate and documented* with a stated trade-off, not accidental concurrency. Reported as P2 rather than used to cap. |
| **No mandatory CI → B** | **YES** | No `.github/workflows`. `CLAUDE.md` states it plainly: "There is currently no CI and no branch protection on this repo — nothing runs these checks for you, and nothing blocks a merge." **Cap does not bind: raw 72.9 already sits below B.** |
| **No realistic integration or browser coverage → B+** | **YES** | All 1,781 tests are unit tests over `vm`-loaded sources with stubbed Glide. Zero automated on-instance tests; every platform claim is verified by hand via MCP. **Does not bind** (subsumed). |
| No production health/shutdown/observability story → B+ | **No** | `/status` is a real readiness surface; runs carry status transitions, transcript and audit trail. |
| AI behavior lacks repeatable evaluation suite → B− (AI) | **No** | A repeatable suite demonstrably exists and ran fourteen times with blind seeds and frozen scorer packets. That it measured the wrong axis is finding F-12, not an absence. |

### Component grades

| Component | Grade | Strongest | Largest risk | Blocks A |
|---|---|---|---|---|
| Diagnostic tool cores (`src/server/tools/`) | B | `GlideRecordSecure` throughout; empty-vs-denied disambiguation is genuinely careful | Correctness unmeasured | No integration tier |
| Agent loop / harness (`PaAgentLoop`, `PaRunManager`) | C+ | Real bounds + partial-result guarantee | F-03 TOCTOU; 2,556-line module | Size, race, 0/10 measured |
| REST surface (`PaRestHandlers`, `rest-api.now.ts`) | B | ACL decided, emitted, verified; `emit()` envelope fix | F-05 no rate limit on LLM spend | Rate limiting, retention |
| Fluent artifacts (`src/fluent/`) | **D** | `acls.now.ts` is exemplary | **F-01 — scaffold live on `incident`** | Remove F-01 |
| Persistence + audit | B+ | Append-only by ACL omission | F-04 no retention | Data lifecycle |
| Tests | C+ | 1.09:1 ratio; thoughtful harness | F-06 unmeasurable, F-07 no integration | Coverage gate + integration |
| Operations | C+ | `/status` depth | No CI/CD, no monitoring | F-02 |
| Docs/governance | A− | Decision provenance | Claims outrun artifacts (F-01) | Keep claims and artifacts in sync |

### Reliability failure timelines

1. **Event redelivered / two workers claim one run.** Both read `status='queued'`
   (`PaRunManager.js:490-497`), both pass the guard, both write `running`. `PaAgentLoop.js:329-338`
   ignores the claim result by design, so both proceed. **Invariant not preserved** — duplicate LLM
   spend, interleaved transcript, last-write-wins `fix_report`. Bounded in cost by iteration/wall
   budget. (F-03)
2. **Worker dies mid-run.** Run is left `running`; the daily sweep closes stale *native* runs only
   (`sweep-stale-runs.js`), while `_checkStuckRuns` surfaces custom ones in `/status`.
   **Invariant preserved** — detectable and reportable, though not auto-recovered.
3. **Budget expires mid-reasoning.** Bounds are evaluated only at the top of each iteration
   (`PaAgentLoop.js:346-356`), never mid-step, and `_finishPartial` persists what exists.
   **Invariant preserved** — this is the design's strongest reliability property.

### Findings

**F-01 · P0 · Confidence High · Security/Correctness — SDK scaffold ships active artifacts onto `incident`, and they are installed**

`src/fluent/example.now.ts` is unmodified `now-sdk init` scaffold and was never deleted. It declares
a `ClientScript` (`table: 'incident'`, `active: true`, `global: true`, `type: 'onLoad'`) that calls
`g_form.addInfoMessage("Table loaded successfully!!")`, and a `BusinessRule`
(`table: 'incident'`, `action: ['update']`, `when: 'after'`, `active: true`).

Verified through the whole chain, not inferred:
- Emitted to `dist/app/update/sys_script_client_af760ca041894ddd9b914b5af65cb766.xml`
  (`table incident`, `active true`, `ui_type 10`) and
  `dist/app/update/sys_script_85b27e4c889943a1bb30af6a98e2ab33.xml`
  (`collection incident`, `action_update true`, `active true`, `sys_scope 13043037…` — this app).
- **Live on gpinst01:** `sys_script_client` name=`my_client_script` and `sys_script`
  name=`LogStateChange` each return **4 active rows on `incident`** from four scopes, one of which
  (`13043037d3da4293904504ef30589334`) is this application, installed `2026-07-31 00:58:04`.

**Impact.** Every incident form load in the instance pops a debug message, and every incident update
fires a no-value after-rule. On a customer instance this is a visible defect on the core ITSM table
and an immediate security-review finding. It also contradicts the PRD's own "Read-only Phases 1–2"
posture — a BusinessRule on `incident` update is a write-path hook on a table this app has no reason
to touch. That the same pair appears from three *other* scopes indicates a scaffold-leak pattern
across projects, so the fix is worth generalizing.

**Fix.** Delete `src/fluent/example.now.ts` and `src/server/script.ts`; rebuild; reinstall.

**RESOLVED AND LIVE-VERIFIED 2026-08-12** (issue #214, PR #221, at `2026.08.1204`). The deletion
propagated on install and the acceptance criteria are met against gpinst01:

| Check | Before | After install |
|---|---|---|
| `sys_script_client` where `sys_scope=13043037…` | 1 (`af760ca0…`, incident, active) | **0 records** |
| `sys_script` where `sys_scope=13043037…` | 1 (`85b27e4c…`, incident, active) | **0 records** |
| `sys_script_client` name=`my_client_script` (all scopes) | 4 | **3** — other apps untouched, `sys_id`s unchanged |
| `sys_script` name=`LogStateChange` (all scopes) | 4 | **3** — other apps untouched, `sys_id`s unchanged |
| App health after install | — | **18/18 Script Includes active; 10/10 ACLs present** incl. `troubleshooter` REST_Endpoint execute |

**The mechanism is worth keeping.** Deleting the source is not the fix by itself — `now-sdk build`
writes `deleted: true` markers into the tracked file `src/fluent/generated/keys.ts` (here: `br0`,
`cs0`, and the `sys_module` for `script.ts`), and *those markers* are what remove already-installed
records. Committing `keys.ts` is part of the change; without it the install leaves the live records
in place. Rollback context: `bc0898272ba64b10f243fed2ce91bfe7`.

---

**F-02 · P1 · High · Operations — No CI; nothing enforces any check (cap trigger)**

No `.github/workflows`. `CLAUDE.md` concedes it. Every gate — build, 1,781 tests, typecheck — is
run only if a human remembers, in a repo that merged 103 issues in fourteen days.
**Fix:** a workflow running `npm ci`, `npx now-sdk build`, `npx jest`, `npx tsc --noEmit -p
src/tsconfig.json`; make it required on `main`.
**Acceptance:** a PR with a deliberately failing test cannot merge. **Effort S. Impact +4 to +5.**

---

**F-03 · P1 · High · Reliability — `markRunning` is a read-then-write with no lock, and the caller proceeds when it fails**

`PaRunManager.js:486-503` reads `status`, compares to `'queued'`, then writes — no optimistic
locking, so two workers can both observe `queued`. `PaAgentLoop.js:329-338` then ignores the result
entirely (documented as deliberate fail-open). A redelivered event yields two concurrent diagnoses
of one run: double LLM spend, interleaved transcript, last-write-wins report.
**Fix:** make the claim conditional at the database (`addQuery('status','queued')` on the update, or
a dedicated claim token), and keep fail-open only for the *monitoring* concern while refusing to
re-enter reasoning when the claim was lost to another worker.
**Acceptance:** a test simulating two concurrent `run()` calls on one id shows exactly one reasoning
pass. **Effort M. Impact +2.**

---

**F-04 · P1 · High · Privacy — No retention or purge for captured customer data**

`PaToolQueryTable` returns rows from arbitrary customer tables and `PaArtifactStore` persists
excerpts as attachments on the run record (`PaArtifactStore.js:642`, `new GlideRecord('sys_attachment')`).
Grep for `retention|purge|ttl|expire|auto_flush` across `src/server/` and `src/fluent/` returns
nothing; the only scheduled jobs are the run-start worker and a stale-run sweep that changes status
without deleting anything. Issue #107 already recorded that the no-redaction argument "conflates
transient prompt use with data at rest" — this is that gap, unclosed.
**Impact.** Customer incident/user data accumulates indefinitely inside a diagnostic app whose
marketing claim is data-boundary safety. The claim is about *egress* and remains true; retention is
a separate obligation and is absent.
**Fix:** a retention property (default e.g. 30 days) plus a scheduled purge of runs, artifacts and
their attachments; document it in the PRD's privacy section.
**Acceptance:** a run older than the window has its attachments removed by the job in a test.
**Effort M. Impact +2 to +3.**

---

**F-05 · P2 · High · Security/Cost — No rate limiting on endpoints that spend LLM calls**

`POST /analyze` creates a run that spends up to 15 LLM iterations; `GET /status` performs a **live
micro-invocation** on every call (`PaRestHandlers.js:598-605`). Grep for `rate.?limit|throttl|quota`
returns nothing. The `x_snc_troubleshoot.admin` ACL (F-01's counterpart, correctly applied) bounds
*who*, not *how often* — issue #74 fixed the authorization half and left the volume half open.
**Fix:** per-user run quota; cache `/status`'s micro-invocation with a short TTL.
**Acceptance:** N+1 runs within the window is refused with 429. **Effort M. Impact +1.**

---

**F-06 · P2 · High · Testing — Coverage is unmeasurable by construction**

`test/_loadScriptInclude.js:93` executes sources via `vm.runInContext` on raw file text, bypassing
Jest's instrumenting transform, so istanbul reports **0% for all 21 production files** while 1,309
tests genuinely exercise them. The number is wrong in the *safe* direction, but the consequence is
real: **no coverage gate is possible and no one can identify untested branches.** The loader's
design rationale (R-14: test code cannot live under `src/` or `now-sdk build` rejects it) is sound —
the gap is that no alternative measurement was substituted.
**Fix:** instrument explicitly — pre-transform sources through `babel-plugin-istanbul` before
`runInContext`, or relocate loading to a `require`-based shim with the Glide globals injected.
**Acceptance:** `--coverage` reports non-zero and a threshold is enforced in CI.
**Effort M. Impact +2.**

---

**F-07 · P2 · High · Testing — No automated integration tier**

1,781 unit tests, 0.725s, all against stubbed Glide. Every platform-behavior claim in this repo was
established by hand through MCP. `DESIGN.md` R-27 states the consequence directly — "a fixture that
agrees with the code by construction is a second copy of the bug, which is why the instrument's own
green tests never caught any of §5.3."
**Fix:** a small on-instance smoke suite (install → create run → poll → assert terminal state +
audit rows) runnable against a dev instance from CI.
**Acceptance:** one command exercises the real install path and fails on a broken deploy.
**Effort L. Impact +2 to +3.**

---

**F-08 · P2 · Med · Security — Prompt-injection surface accepted but unmitigated**

`rest-api.now.ts:35-44` documents that `body.logs` and `body.description` are interpolated verbatim
into the reasoning prompt. Bounded — read-only tools, `GlideRecordSecure`, fail-closed registry — so
it cannot exceed caller privilege; what it *can* do is corrupt the diagnosis the caller receives,
which for a diagnostic product is the whole deliverable. Recorded here because the rubric counts
deferred risk while it remains, not to dispute the acceptance.
**Fix:** delimit untrusted spans in the prompt and instruct the model to treat them as data.
**Effort S. Impact +1.**

---

**F-09 · P2 · Med · Maintainability — No linter or formatter**

No `.eslintrc*`, no `eslint.config.*`, no Prettier config, no `lint` script. For ES5/Rhino-targeted
code where `const`, arrow functions and `Set`/`Map` are runtime landmines, a linter is the cheapest
possible guard and it is absent.
**Fix:** ESLint with `es5` parser options over `src/server/`, wired into F-02's workflow.
**Acceptance:** `npm run lint` passes and gates CI. **Effort S. Impact +1 to +2.**

---

**F-10 · P3 · Med · Maintainability — `PaAgentLoop.js` at 2,556 lines**

Holds the ReAct loop, bounds, hold/gate state machine, prompt assembly, playbook resolution and
clock. Comprehension cost is high and the depth-gate defects (#204/#205) live here.
**Fix:** extract prompt assembly and the hold/gate state machine. **Effort L. Impact +1.**

---

**F-11 · P2 · High · Maintainability — There is no working TypeScript typecheck at all**

*Upgraded from P3 during the sitting; the first reading ("one dead config file") was wrong and the
correction matters, because it invalidates evidence recorded earlier in this same ledger.*

`src/tsconfig.json` is a solution-style config — `files: []` plus two project references. **Both
referenced projects match zero files:** `tsconfig.server.json` includes `./**/*.server.js` and
`tsconfig.client.json` includes `./**/*.client.js`, naming conventions this repo does not use.

Consequences, in order of severity:
1. `tsc --noEmit -p src/tsconfig.json` **exits 0 having checked nothing.** That command is the
   obvious one to put in CI (#215) and it would be a permanently green no-op — a false gate, which
   is the exact failure family `CLAUDE.md` warns about for `now-sdk build`.
2. `tsc --build src/tsconfig.json` surfaces the truth: `TS18003` for both projects.
3. `now.config.json` points `tsconfigPath` at `src/server/tsconfig.json`, which includes `./**/*.ts`
   excluding `*.now.ts`. After #214 deleted `src/server/script.ts` — the only `.ts` there — **that
   config now also matches zero files.**

So the repo's TypeScript surface is `src/fluent/*.now.ts`, which is checked by the Fluent plugin
during `now-sdk build` rather than by any `tsc` invocation available to a developer or to CI.
**Fix:** repoint the referenced projects at what actually exists, or delete the reference chain and
run the SDK's own check explicitly. Whichever is chosen, CI must not carry a `tsc` step that passes
vacuously. **Acceptance:** a deliberately introduced type error fails the command CI runs.
**Effort S. Impact +1.**

---

**F-12 · P3 · High · Testing — The evaluation suite measures admissibility, not correctness**

Already root-caused by the repo itself (`DESIGN.md` §5.2) and commissioned as **#212**. Recorded so
the ledger carries it. **Impact +3 when closed.**

---

**F-13 · P3 · Med · Dependencies — 3 high / 8 moderate advisories; SDK one minor behind**

All in the dev tree (800 dev deps, 1 prod), so no production exposure. `@servicenow/sdk`
4.9.2 → 4.10.1 available; given this repo's build-rule history, treat an SDK bump as a change
requiring its own verification pass, not a routine update. **Effort S. Impact +0.5.**

### Path to A

**Phase 1 — remove what should never have shipped (→ ~C+/B−).** F-01, F-11. Days.
**Phase 2 — make the checks mandatory (→ ~B).** F-02, F-09, F-06. Verify:
a knowingly-broken PR is refused. One week.
**Phase 3 — lifecycle and cost (→ ~B+).** F-04, F-05, F-03. Verify: purge job test, 429 on quota,
concurrent-claim test. One to two weeks.
**Phase 4 — prove it works on a real instance (→ ~A−).** F-07 integration tier, then F-12/#212's
correctness axis. Verify: CI exercises install→run→assert; a correctness figure exists with a
pre-registered stopping condition. Several weeks — this is the phase that decides whether the
product is good, not merely well-built.
**Phase 5 — maintainability (→ A).** F-10, F-08.

### Senior-engineer assessment

- **Could a new senior safely own this?** Yes for *rationale* — the decision record is better than
  most commercial codebases. No for *mechanics*: nothing stops them merging a regression.
- **Deployable repeatably?** Partly. `now-sdk build` + `install` work and are documented; there is
  no pipeline, no rollback, and F-01 proves the artifact set is not curated.
- **Trust boundaries enforced at runtime?** Yes, and deliberately — `GlideRecordSecure` on all
  AI-reachable reads, fail-closed tool registry, REST ACL verified into `dist/`.
- **Concurrency designed or accidental?** Designed, with one known hole (F-03) the authors chose
  knowingly.
- **AI evaluable before changes ship?** A rigorous harness exists but is closed and measured the
  wrong axis; #212 is the fix.
- **Can operators detect/diagnose/recover?** Detect and diagnose, yes (`/status`, audit trail).
  Recover, partly — stuck runs are surfaced, not auto-recovered.
- **Docs accurate?** Unusually so, and self-correcting. The exception is where claims outrun
  artifacts: a "read-only" posture beside an active `incident` BusinessRule.
- **What prevents an A today?** F-01 first, then the absence of any enforcing mechanism (F-02/06/07)
  and an unmeasured correctness axis (F-12).

```json
{
  "audit_date": "2026-08-12", "commit": "82a2d36", "overall_score": 72.9, "overall_grade": "C",
  "production_ready": false, "senior_quality": false,
  "applied_grade_caps": ["no_mandatory_ci_max_B_non_binding", "no_integration_coverage_max_B+_non_binding"],
  "category_scores": { "product_coherence": 78, "architecture": 84, "correctness": 64,
    "security_privacy": 72, "reliability_concurrency": 74, "testing_ai_quality": 68,
    "maintainability": 72, "operations_observability": 68, "documentation_governance": 88 },
  "release_blockers": [],
  "p0_count": 0, "p1_count": 3, "p2_count": 6, "p3_count": 3,
  "fixed_since_previous_review": [], "remaining_existing_issues": ["#212","#214","#215","#216","#217","#218","#219","#220"],
  "new_findings": ["F-01","F-02","F-03","F-04","F-05","F-06","F-07","F-08","F-09","F-10","F-11","F-12","F-13"],
  "top_three_next_actions": [
    "F-01 delete src/fluent/example.now.ts, rebuild, reinstall, remove the two live incident records in this scope",
    "F-02 add a CI workflow running build + jest + tsc and make it required on main",
    "F-04 add a retention property and scheduled purge for run artifacts holding customer data"
  ]
}
```
