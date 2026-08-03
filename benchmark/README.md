# benchmark/

Home for the Phase 1a benchmark (`IMPLEMENTATION_PLAN.md` Tasks 11–12): the seeded-failure catalog,
its run protocol, and the scorecards produced by running Agent Doctor against it. DESIGN.md §1 says
this directory holds the load-bearing component of the whole harness strategy: *"Under A the
load-bearing component is the benchmark, not Agent Doctor."* A benchmark that measures the wrong
thing produces a confident answer to a question the gate did not ask.

- **Seed specs:** `seeds/seed-01-schema-mismatch.md` through `seeds/seed-05-inactive-usecase.md` —
  the defect, expected root-cause layer, expected fix target, setup/trigger steps, and expected
  diagnosis for each of the five gate-scored seeds.
- **Fixture app:** `seed-app/` — the second scoped SDK project (`x_snc_tsbench`) the seed agents are
  built and installed from. **Never shipped *inside* the product app, and never installed on a
  customer instance** — but on the benchmark instance the two apps are deliberately installed **side
  by side**, because Agent Doctor (`x_snc_troubleshoot`) is what diagnoses the seeds. Task 12
  installs both on `gpinst01`. See `seed-app/README.md`.
- **Where the seed agents live, and why:** `DECISION-seed-location.md`.
- **Scorecard:** `scorecard-template.md` — copied to `scorecard-agent-doctor.md` and filled in during
  Task 12's scored runs.

## The blind rule

Preserved verbatim from the placeholder this file replaces, because it is the condition that makes
the scores mean anything:

> The seeded-failure catalog must **not** be referenced from `docs/agent/playbook.md`. The playbook
> teaches the diagnostic method; an agent that has read the answer key is not being measured on
> anything.

**Pointer, not a change to the rule above.** There is no `docs/agent/playbook.md` in the repo, and
nothing was lost: the file that carries Agent Doctor's instructions — the playbook in the sense the
rule means — is **`docs/agent/agent-doctor-instructions.md`**, the only file in `docs/agent/`. The
rule's wording is preserved verbatim because it is the condition that makes the scores mean
anything; read "the playbook" as that file. The rule binds anything that becomes part of Agent
Doctor's instructions, whatever it ends up being called.

## The protocol

Steps 1–2 were previously documented **only** inside the individual seed specs, so the one document
an operator reads top to bottom skipped the first two things they have to do. They are here now;
the per-seed specs remain authoritative for the detail.

1. **Install the fixture app.** `cd benchmark/seed-app && npm install && now-sdk build && now-sdk
   install --alias gpinst01`. This is a **second scoped app** (`x_snc_tsbench`), installed alongside
   the product app, never instead of it — see `seed-app/README.md` and `DECISION-seed-location.md`.
   Task 11 stops at a passing build; the install is Task 12's step.

2. **Per-seed setup — two seeds are VOID without it.** Each spec's "Setup" section is mandatory, not
   illustrative. Two of them do not work by simply installing:

   - **Seed 5** — flip the second activation gate on **post-install**:
     `PATCH sn_aia_trigger_agent_usecase_m2m/<sys_id>` with `{"active": "true"}`, then re-read it and
     confirm it returns `true`. Fluent cannot set this gate — a plain install leaves *both* gates
     off, and with both off the seed isolates nothing. Leave
     `sn_aia_trigger_configuration.active` at `false`; that is the seeded defect.
   - **Seed 4** — verify the capability sys_id in the installed `summarise_ticket` tool script
     **matches** the instance's `sys_one_extend_capability` record
     (`name=x_snc_tsbench_unmapped_capability`). Since Task 12 (2026-08-02) the Fluent source no
     longer ships the `REPLACE_WITH_SEED_04_CAPABILITY_SYS_ID` placeholder — it hardcodes
     **gpinst01's** sys_id `92ff62af516741769c437feb88c80ef3`. On gpinst01 reinstalls, verify and
     move on (do not reintroduce the placeholder); on any **other** instance, read the installed
     capability's sys_id and substitute it before rebuild + reinstall. Full decision table:
     `seeds/seed-04-genai-unmapped.md` Setup step 2. The void condition is a **mismatch**, not a
     skipped find/replace — a matching hardcoded value is a valid install.

   Seeds 1, 4 and 5 also need a bench ticket row inserted and its sys_id recorded. Skipping any of
   this does not merely weaken a run — it makes the run **void**, which has its own recording rule
   in `scorecard-template.md` §A3 and takes the benchmark toward its 8-valid-run floor.

3. **Smoke test, before any seed is scored.** Run Agent Doctor against gpinst01 execution
   `c9d63a932bda8b9417a6ffbeee91bfd0`. Expected diagnosis: `script_error` citing
   `context_processing_script` **line 42**. This specimen is chosen deliberately over an easier one:
   it is *invisible from the plan header* — `state=Completed`, empty `state_reason`, all 11 tasks and
   all 5 tool calls `Success` — so it tests whether a diagnosis that stops at the header gets caught,
   not merely whether the tools can read rows. This is a pass/fail gate, not one of the 10 scored
   rows.

   The smoke gate's own answer tokens, guarded by `../test/blindRule.test.js`:

   ```blind-rule-tokens
   c9d63a932bda8b9417a6ffbeee91bfd0
   line 42
   ```

   `context_processing_script` is deliberately **not** a token: it is this
   gate's answer *and* a field `agent_config` must read to sweep layer 4. A
   token that fires on honest tool code is a bad token, not a finding.
4. **2 runs per seed, in fresh conversations, for all 5 seeds — 10 scored runs.** Each run is blind:
   Agent Doctor's instructions, its tools, and the playbook carry no seed knowledge. The doubling
   measures the documented "inconsistent behavior on identical inputs" failure mode, not redundancy.
5. Score each run against `scorecard-template.md` — including `passes_gate`, which is the only
   column the Task 12 gate consumes, and the void-run rule for any seed whose setup did not hold.

## Run identity

Scored runs key on **`_agentic_context_.conversation_id`** — a hard per-conversation identifier,
stable across every tool call in a conversation. DESIGN.md §2.4 disqualifies time-window keying for
scored runs outright, and not for tidiness: `PaRunAnchor`'s "one anchor per user per 30 min" fallback
would glue benchmark run 2 — a fresh conversation 20 minutes later — onto run 1's anchor. That
interleaves artifacts and audit rows into one contaminated scorecard, and lets run 2 `read_artifact`
its way into run 1's evidence, breaking the blind independence the doubled-run protocol exists to
measure.

## Measurement source: assist units (DECISION.md §D5)

DECISION.md §D5 found `assists_consumed` "not measurable live" during Task 12 (`sn_value_ai_consumption`
empty in the window) and left the Phase 1b comparison's assist-unit source as an open question. Probed
read-only via MCP on **gpinst01, 2026-08-02** (`servicenow_schema`/`servicenow_query`/`servicenow_aggregate`,
`authType=keychain`):

- **`sn_value_ai_consumption`** (AI Value Consumption, scope `sn_value_engine`) — the table exists (16
  fields: `units_consumed`, `vendor`, `ai_system`, `cost`, `include_in_dashboard`, …) but has **0 rows**,
  confirming the Task 12 finding still holds today. This is the presumed backing table for any
  license/entitlement dashboard, so a dashboard has nothing to read either — not independently probeable
  via MCP (no "dashboard" API surface), but a dashboard cannot show what its source table doesn't have.
- **`sys_gen_ai_usage_log`** (the brief's named alternative) — populated instance-wide: 3,250 rows,
  `SUM(assists)=1121`. It filters to this app, but not on the field the schema implies: `caller_scope` is
  **empty on all 3,250 rows**; `source_scope=x_snc_troubleshoot` is the populated field and returns 48 rows.
  Of those: 32 carry `assists=1` on `document_table=sys_one_extend_capability` with
  `skill_config_id=21c00b55a323477082b23a25049a11ba` — **not** Agent Doctor's own tools (those are
  data-fetching script tools with no LLM call in their path) but `PaLlmProxy`'s `reason` NASK skill
  config (`src/server/PaLlmProxy.js` `_NASK_SKILLS.reason`; `keys.ts` resolves the same sys_id to
  `feature_name: 'pa llm reason'`) — i.e. these 32 rows are the **custom harness's own** reasoning-loop
  LLM calls, timestamped today. 16 carry `assists=0` on `document_table=sys_cs_topic` (conversation/
  topic-routing overhead, billed at zero).
- **No per-run join key exists on the `assists=1` rows.** `sn_aia_execution_plan.gen_ai_usage_log` is the
  one documented linkage (LLD §2.3 path 1) and it **is** populated — 10/10 sampled execution plans from
  2026-08-02 carry a reference — but of 3 of those references checked, all 3 point at the plan's
  `sys_cs_topic` row (`assists=0`), never at a `sys_one_extend_capability` row, which is where the actual
  consumption lives. `sys_gen_ai_usage_log` itself has no `conversation` column at all. The sibling
  per-call telemetry table, `sys_gen_ai_log_metadata`, does declare a `conversation` field, but it read
  empty on all 10 sampled rows for `skill_config_id=21c00b55a323477082b23a25049a11ba` — **the custom
  harness's own `PaLlmProxy.reason()` calls, per the correction above** — so this is direct evidence
  that the custom harness's own NASK invocations do not carry conversation identity in platform
  telemetry, not merely a gap on the native side.
- **Net:** a real, current, scope-filterable consumption number exists, but only as an aggregate over a
  time window, not attributable to an individual run. The same reasoning that disqualifies time-window
  keying for run identity above (interleaving) disqualifies it here too.

**Decision:** no usable per-run assist-unit source exists on gpinst01. The Phase 1b scorecard uses
**LLM-call counts** as the comparison proxy, measured identically on both harnesses:

- **Native:** count of `sn_aia_gen_ai_m2m` rows keyed to the run's execution plan / task records (LLD
  §2.3 linkage path 2 — the table is populated, one row per logged LLM call). **Run-verified 2026-08-02
  (Task 9):** the Task 8 probe's direct `source_id=<execution plan sys_id>` query returning 0 rows was
  the wrong key, not a dead linkage. `source_id` keys to the sys_id of the run's **top-level
  `sn_aia_execution_task`** row — `type=agent`, `order=100`, the one whose `description` is the agent's
  name — not the execution plan itself, and not the individual `type=gen_ai` ("AIA ReAct Engine")
  sub-tasks per reasoning turn (there is one `sn_aia_gen_ai_m2m` row per LLM call, but it references the
  parent agent task for all of them, not the sub-task that triggered each call). Read: `servicenow_query
  sn_aia_execution_task query=execution_plan=<plan sys_id>^type=agent^order=100 fields=sys_id`, then
  `servicenow_query sn_aia_gen_ai_m2m query=source_id=<that sys_id>^source_table=sn_aia_execution_task`
  and count the rows. Confirmed against two independent live runs: a completed plan from before this
  task (`74c591c42b2e4bd417a6ffbeee91bf16`, 7 rows, matching its 7 `type=gen_ai` sub-tasks) and the
  Task 9 native smoke-gate re-run itself (`464d8a082b26c314f243fed2ce91bfa2`, 7 rows, matching its 7
  `type=gen_ai` sub-tasks exactly). This is now a verified read for Task 10, not a documented-but-untested
  linkage.
- **Custom harness (Phase 1b, not yet built):** count of `actor:'llm'` entries in the run's own
  transcript — `PaAgentLoop.js` already appends one such entry per reasoning-loop LLM call
  (`this._runs().appendTranscript(runId, { actor: 'llm', ... })`), so this is a deterministic
  per-run count sourced entirely from data the harness owns, verified in code rather than inferred.
  **No platform-telemetry fallback is used** — the probe above shows the custom harness's own
  `PaLlmProxy.reason()` calls are exactly the rows where `sys_gen_ai_log_metadata.conversation` reads
  empty, so a `sys_gen_ai_*`-table cross-check would inherit the same join-key gap as the native path,
  not avoid it.

**Assist-units are NOT COMPARABLE to entitlement/licensing units.** LLM-call counts are a fair
apples-to-apples proxy between the two harnesses' own consumption, not a measurement of billed Now
Assist consumption — `sn_value_ai_consumption`, the entitlement table, is empty, and even
`sys_gen_ai_usage_log`'s `assists` field (1 per capability call, 0 for topic routing) isn't run-attributable,
so there is no live entitlement number to compare a call-count proxy against.

## The tool-availability dependency (RESOLVED before the scored run)

**Resolved 2026-08-02 — issue #32 closed.** When this section was written, Agent Doctor shipped
tools for **layer 1 only** while all five gate-scored seeds target layers 2 through 7, so a scored
run would have returned near-0/10 **by construction** — a missing-tools gap that the Task 12 gate
table would have misread as *"full custom harness as designed"*, the most expensive decision in
the project. Tasks 7–8 landed first (PRs #36/#38/#39/#40), and the Task 12 pre-flight measured
**all seven tools attached and active** — every scored row in `scorecard-agent-doctor.md` records
`layers_available 7/7`, read per run via the §E3 query, so the by-construction scenario did not
occur and the 7/10 result measures the native harness itself.

The `layers_available` column in `scorecard-template.md` exists to make exactly this class of gap
visible in the scored data rather than let it hide inside a low total: a run showing `swept 1/7,
available 1/7` is an agent doing everything it can, while `swept 1/7, available 7/7` is one that
stopped early — the same total score, opposite verdicts. It stays in the protocol for the Phase 1b
re-run.

## The Phase 1b comparison re-run protocol (readiness confirmed — Task 9)

Task 12's scorecard measured the native harness alone. The Phase 1b comparison re-run measures
**both** harnesses — native (already scored once, in `scorecard-agent-doctor.md`) and the custom
deep-diagnosis harness (never scored) — against the same seeds under the same doubled-run, blind,
audit-derived protocol, so the two are compared on identical evidence. Task 9 is the readiness gate
before that re-run starts: every precondition below was checked with live evidence on gpinst01,
2026-08-02, not assumed from a prior task's report.

### Preconditions, each verified

- **Seed 2 v2 installed.** `benchmark/seed-app`'s Fluent source was fixed for the v2 construction
  (PR #48, `2be8cf7`) but that PR's own install was deferred to this gate — confirmed void before
  reinstall: `sn_aia_agent_tool_m2m` for **Seed 02 Request Router** (`cd050d48e810411d9f113fd530694fe6`)
  returned **zero rows**, i.e. the v1 (zero-tool) construction was still live. Rebuilt
  (`now-sdk build`, clean) and reinstalled (`now-sdk install --alias gpinst01`) from
  `benchmark/seed-app`. Re-verified: the agent now has exactly **one** active tool bound
  (`measure_request`, `max_auto_executions=10`), and its instructions read unchanged —
  *"Read the incoming request and assign it to the right group. Be accurate..."* — matching the v2
  seed spec's "instructions unchanged byte-for-byte" claim.
- **`check_config` filter + playbook v2 installed (product app).** Both landed in main before Task
  1 (PRs #49/#50, merged 2026-08-01 23:0x EDT) and Task 7's async-wiring reinstall (2026-08-02
  01:14 EDT) ran after both, so no separate reinstall was needed here — confirmed, not assumed, by
  direct content comparison: the live `sn_aia_agent.instructions` on **Agent Doctor**
  (`e1392946828940e5a708fc51b0a5e954`) is **byte-identical** to
  `docs/agent/agent-doctor-instructions.md`, including the playbook-v2 "Derive table names, never
  guess them" and "The GenAI stack: read the definition row" sections; the live
  `sys_script_include` script for `PaToolGenAiLog` is **byte-identical** to
  `src/server/tools/PaToolGenAiLog.js`, including the `check_config` capability-filter code path
  (`matched_on`, `matched`, definition/capability-reference/name fallback reads).
- **Both budget knobs read fresh.** `sn_aia.continuous_tool_execution_limit = 25`;
  `sn_aia_agent_tool_m2m.max_auto_executions = 10` on all 7 tools attached to Agent Doctor — both
  identical to the values `DECISION.md` §B recorded for the Task 12 scored runs, so the comparison
  re-run starts from the same budget baseline.
- **Smoke gate re-run, both harnesses, against `c9d63a932bda8b9417a6ffbeee91bfd0`:**
  - **Native** — executed via `servicenow_aia_execute` (the documented MCP execution path;
    the Now Assist panel itself has no MCP-drivable equivalent, and R-2/R-3 in `DESIGN.md`
    already establish this API path as validated against the panel path for this exact
    concern). **PASS.** Terminal in 204s, 12 tool calls (`agent_trace` ×1, `read_artifact` ×7,
    `agent_config` ×2, `log_analysis` ×1, `genai_log` ×1), 7 LLM calls. The Fix Report's RC-2 names
    `context_processing_script` line 42, `InternalError`, `CONFIRMED`, citing the trace's
    `script_errors` array entry directly (`source`, `line`, `error_name`, `message_sequence`) —
    the known answer.
  - **Custom** — `POST /analyze {"execution": "...", "mode": "diagnose"}`, polled `GET
    /runs/{id}` to terminal. **Reached `status:"complete"` with a structurally valid `fix_report`**
    (all required fields present, `root_causes[0].layer` a string, `layers_swept` covers all 7
    with a reason each) — but the root cause is generic and **wrong**: "script stack error"
    at layer 1, no mention of `context_processing_script` or line 42. Only 2 tool calls were made
    (`agent_trace`, one `read_artifact` page of 2) before the model went straight to a Fix Report;
    4 LLM calls total (`actor:'llm'` transcript entries). This reproduces Task 7's own live finding
    exactly (structurally valid, substantively wrong, shallow sweep before repair) — not a new
    defect, a second independent confirmation of the same recorded one. Per the brief: the gate is
    that both harnesses **run to terminal with valid outputs**, not that they diagnose correctly,
    so this is a recorded, acceptable smoke-gate outcome, not a blocker.
  - **Native LLM-call count verified against a real run** (see the "Measurement source" section
    above for the corrected `sn_aia_gen_ai_m2m` keying this smoke run confirmed): **7**, exactly
    matching the transcript's 7 `type=gen_ai` "AIA ReAct Engine" reasoning turns.

All four preconditions hold. **The comparison re-run is mechanically ready to start.**

### The protocol addendum

Same 5 seeds (`seed-01` through `seed-05`, seed 2 in its v2 construction), same doubled-run
structure, same blind rule, same audit-derived `layers_swept`/`layers_available` (§E1–§E3, unchanged
— the queries are harness-agnostic: they read `x_snc_troubleshoot_audit`/`sn_aia_*` tables keyed off
whichever run identity the harness produced), same scoring rule (`scorecard-template.md` §A2
`passes_gate`, §A3 void-run handling) — with one asymmetry, stated here because it is a deliberate
scope decision, not an oversight:

- **Custom harness: full 10 rows.** 2 fresh runs × 5 seeds. The custom harness has never been
  scored, so every seed needs a first measurement.
- **Native harness: seed 2 only, 2 fresh runs.** Seeds 1, 3, 4 and 5's fixture Fluent source is
  **byte-identical** between Task 12's scored runs and now — nothing about their construction
  changed, only seed 2's did (v1 → v2, per `DECISION.md` §D2). Re-running an unchanged seed against
  the same native harness measures **model response drift on identical inputs, not the harness** —
  a different question than the comparison re-run exists to answer, and one the doubled-run
  protocol already has a name for the opposite of ("inconsistent behavior on identical inputs" is
  the failure mode the doubling *within* a seed measures; re-running an unchanged seed *across*
  benchmark runs is not that). Native's scored rows for seeds 1/3/4/5 in
  `scorecard-agent-doctor.md` **stand as-is** and carry into the Phase 1b comparison unchanged; only
  seed 2's two native rows are new, run against the v2 construction for the first time. Native's
  comparison total is therefore **8 standing + 2 new = 10 rows**, matching custom's 10 — same
  row count, same gate math, asymmetric sourcing by design. **Before scoring seeds 1/3/4/5's rows
  into this comparison, re-confirm seed 4's capability sys_id match and seed 5's trigger m2m gate
  (`sn_aia_trigger_agent_usecase_m2m.active`) are still in their valid, non-void state** — Task 9's
  fixture-app reinstall touched only seed 2, but a full app reinstall is a broader action than a
  scoped one, and seed 5's gate is a manual post-install PATCH that Fluent does not re-apply.

Each run — native and custom alike — is a **fresh conversation / fresh `POST /analyze`**, blind
(no seed knowledge in either harness's instructions or tools), scored independently. Layer sweeps
are derived from the audit trail per §E1–E3 for both harnesses; for the custom harness, `run_id` in
the scorecard is the `x_snc_troubleshoot_run` sys_id directly (no conversation-id hop needed — the
custom harness owns its own run record), and its LLM-call count is `actor:'llm'` transcript entries
per the "Measurement source" decision above, not `sn_aia_gen_ai_m2m` (that table is Now Assist's own
telemetry, populated for native's NASK-backed reasoning turns, not for a run the custom harness
drives itself through `PaLlmProxy`).

## The de-risking step that is unavailable

DESIGN.md §2.1 casts `PaEvidenceCollector` as the benchmark's pre-scoring de-risker: run it against
each seed before scoring to separate *"tools cannot see the defect"* from *"agent cannot reason to
it."* It is not built, and it is not in the Phase 1a task list. The substitute is a manual pass
invoking the tool cores directly against each seed before scoring begins. Recording the substitution
matters more than the substitution itself — an unbuilt de-risker that everyone assumes ran is how a
benchmark produces scores nobody can interpret.

## Stretch seeds 6–8

Not gate-scored. Candidate seeds drawn from the K26 failure taxonomy (ACL-trigger misalignment,
instruction-bloat latency, infinite loops) — see LLD §7 for their construction. They are the swap-in
set if a core seed proves unbuildable on the shared instance, built after the 5-seed gate rather than
alongside it.
