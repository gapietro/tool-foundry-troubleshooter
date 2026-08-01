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
  built and installed from. Never installed alongside the product app; see `seed-app/README.md`.
- **Where the seed agents live, and why:** `DECISION-seed-location.md`.
- **Scorecard:** `scorecard-template.md` — copied to `scorecard-agent-doctor.md` and filled in during
  Task 12's scored runs.

## The blind rule

Preserved verbatim from the placeholder this file replaces, because it is the condition that makes
the scores mean anything:

> The seeded-failure catalog must **not** be referenced from `docs/agent/playbook.md`. The playbook
> teaches the diagnostic method; an agent that has read the answer key is not being measured on
> anything.

## The protocol

1. **Smoke test, before any seed is scored.** Run Agent Doctor against gpinst01 execution
   `c9d63a932bda8b9417a6ffbeee91bfd0`. Expected diagnosis: `script_error` citing
   `context_processing_script` **line 42**. This specimen is chosen deliberately over an easier one:
   it is *invisible from the plan header* — `state=Completed`, empty `state_reason`, all 11 tasks and
   all 5 tool calls `Success` — so it tests whether a diagnosis that stops at the header gets caught,
   not merely whether the tools can read rows. This is a pass/fail gate, not one of the 10 scored
   rows.
2. **2 runs per seed, in fresh conversations, for all 5 seeds — 10 scored runs.** Each run is blind:
   Agent Doctor's instructions, its tools, and the playbook carry no seed knowledge. The doubling
   measures the documented "inconsistent behavior on identical inputs" failure mode, not redundancy.
3. Score each run against `scorecard-template.md`.

## Run identity

Scored runs key on **`_agentic_context_.conversation_id`** — a hard per-conversation identifier,
stable across every tool call in a conversation. DESIGN.md §2.4 disqualifies time-window keying for
scored runs outright, and not for tidiness: `PaRunAnchor`'s "one anchor per user per 30 min" fallback
would glue benchmark run 2 — a fresh conversation 20 minutes later — onto run 1's anchor. That
interleaves artifacts and audit rows into one contaminated scorecard, and lets run 2 `read_artifact`
its way into run 1's evidence, breaking the blind independence the doubled-run protocol exists to
measure.

## The tool-availability dependency (stated as fact, not a caveat)

Agent Doctor as shipped has tools for **layer 1 only** — `docs/agent/agent-doctor-instructions.md`
states it without hedging. All five gate-scored seeds target layers 2 through 7. Until Tasks 7–8 land
and the remaining tool cores ship, a scored run against the current build returns near-0/10 **by
construction** — not because the native harness reasons badly, but because the tools it would need
to sweep layers 2–7 do not exist yet. The Task 12 gate table reads any score under 5/10 as *"full
custom harness as designed"*, which would be the most expensive decision in the project, reached from
a missing-tools gap rather than from anything measured about the native harness itself.

The `layers_available` column in `scorecard-template.md` exists to make this visible in the scored
data rather than let it hide inside a low total: a run showing `swept 1/7, available 1/7` is an agent
doing everything it can, while `swept 1/7, available 7/7` is one that stopped early — the same total
score, opposite verdicts. Tracked separately as a blocker issue.

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
