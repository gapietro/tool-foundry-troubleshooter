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
