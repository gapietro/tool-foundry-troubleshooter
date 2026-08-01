# Task 11 — Seeded-Failure Benchmark Suite

**Issue:** #31
**Date:** 2026-07-31
**Status:** design, pending implementation plan

DESIGN.md §1 says it plainly: *"Under A the load-bearing component is the **benchmark**, not Agent
Doctor."* Task 10 built the thing being measured. This task builds the measuring instrument, and the
instrument is the artifact the whole Option A strategy rests on — a scorecard that measures the
wrong thing produces a confident answer to a question the gate did not ask.

That is not a hypothetical worry here. R-19's ledger walk found that **three rulings binding on this
exact task had been recorded and never applied**, and stated the consequence directly: *"had the
benchmark been run before this walk, it would have produced a scorecard that does not measure what
the gate needs."* Two of those three (R-3's amendment, R-4) are requirements on the scorecard
columns. They are the reason §3 of this design exists in the shape it does.

---

## 1. The blocking decision: where the seed agents live

### 1.1 Why it was held open

Task 11 has carried an explicit gate since 2026-07-30:

> **OPEN — decide before Task 11, not during it (DESIGN.md R-13).** How the five deliberately-broken
> seed agents get created is genuinely unsettled, and the two obvious answers are both wrong as
> stated.

The vertical-slice brief repeats it as item 2 of "Two decisions to make, not assume". Both documents
name the same trap: the two obvious options each fail on a requirement the other satisfies.

| Option | Satisfies | Fails |
|---|---|---|
| **Fluent in `src/fluent/`** | reproducibility — Phase 1b re-runs this benchmark against the custom harness, and *the comparison is only valid on identical seeds* | ships five deliberately broken agents inside `x_snc_troubleshoot` to every customer who installs the product |
| **MCP / Foundry record automation** | keeps the broken agents out of the product app | CLAUDE.md requires MCP prototypes be ported to Fluent before the session ends; hand-built seeds are not reliably reproducible months later, which is exactly when Phase 1b needs them |

### 1.2 The resolution

**A separate scoped fixture app.** A nested SDK project at `benchmark/seed-app/`, scope
`x_snc_tsbench`, with the five seeds authored as Fluent DSL.

This takes reproducibility from the first option and app-separation from the second. The cost is
real and is accepted: a second scope and a second install target. Both design documents already
named this as the likely answer (*"Likely resolution is a separate scoped app … but that costs a
second scope and a second install target. Not decided here."*) — this task takes the decision rather
than restating the likelihood.

Scope name is `x_snc_tsbench` (13 chars) — `now-sdk init --scopeName` caps at 18.

Two constraints follow from the scope change and must not be missed:

1. **Seed 3's lookup table renames.** LLD §7 specifies `x_snc_troubleshoot_bench_routing`. A scoped
   table name must begin with its own application's exact scope value — R-13 verified 40 of 40
   sampled `x_snc_*` tables with no exceptions, and established that these were *names the platform
   rejects*, not shorthand awaiting expansion. In the fixture app the table is
   **`x_snc_tsbench_routing`**.
2. **The fixture app is never installed alongside the product.** This is the entire point of the
   second scope, and it belongs in the fixture app's own README rather than in tribal memory.

### 1.3 What this task does *not* do

Scaffold and build only. **No `now-sdk install` to gpinst01, no seed executions triggered, no
failing execution sys_ids captured.** Those are Task 12's setup half. Building the seeds here
de-risks the gate — it proves the seeds are constructible before benchmark day, which is the
cheaper place to discover that one of them is not.

### 1.4 The one risk that cannot be retired from the design

`now-sdk init` may require an instance round-trip to reserve the new scope's `sys_id`. If it does,
"scaffold but do not install" is only partly achievable and the fallback is to hand-author the
project structure against this repo's existing layout and **report the build as unverified**.

Stated explicitly because this project has a documented failure mode about exactly this: R-8 and the
R-11 retraction both turn on treating a successful-looking step as evidence of an effect that was
never measured. A build that could not be run will be reported as not run.

---

## 2. Deliverables

```
benchmark/
  README.md                        rewritten — the run protocol
  DECISION-seed-location.md        the §1 resolution and its evidence
  scorecard-template.md            one row per scored run
  seeds/
    seed-01-schema-mismatch.md
    seed-02-ambiguous-instruction.md
    seed-03-missing-data.md
    seed-04-genai-unmapped.md
    seed-05-inactive-usecase.md
  seed-app/                        second SDK project — Fluent, builds, not installed
    now.config.json                scope x_snc_tsbench
    package.json
    README.md                      "never install this alongside the product app"
    src/fluent/seed-0{1..5}.now.ts
    src/server/                    seed 1's deliberately-mismatched script tool
```

The current `benchmark/README.md` is a 17-line placeholder whose stated reason for existing is that
the seed-location question had to be settled before anything landed in the directory. That question
is now settled, so the file is **replaced**, not appended to.

One rule in the current placeholder survives verbatim into the new README, because it is the
condition that makes the scores mean anything:

> the seeded-failure catalog must **not** be referenced from `docs/agent/playbook.md`. The playbook
> teaches the diagnostic method; an agent that has read the answer key is not being measured on
> anything.

---

## 3. The scorecard — and why four of its columns are not optional

The 6-point rubric from the plan is necessary and **not sufficient**. Four further columns are
required, three by rulings and one (§3.1) found while building this design. Each exists because a
specific measured failure would otherwise be invisible.

| Column group | Source | The failure it makes visible |
|---|---|---|
| root-cause layer (2) · fix target (2) · evidence cites trace + config/schema (1) · fix usable by the builder AI unedited (1) | plan Task 11 | — the baseline rubric |
| **layers swept — n/7, and which** | **R-3 amendment** | The same probe, same prompt, ran **19** tool calls on keynexus01 and **5** on gpinst01, and *both* finished `state=Completed` with empty `state_reason`. Nothing was capped in either case, so the difference is instruction adherence, not harness capacity. Without this column a lucky shallow run scores identically to a thorough one. |
| **layers *available* to sweep — n/7, and which** | §3.1 | Separates *"the agent did not look"* from *"the agent could not look — no tool exists"*. Without it, a build missing tool cores scores identically to an inattentive agent. |
| **cause of death** — `completed \| tool_limit \| context \| supervision_stall \| security \| wandered \| genai_down` | **DESIGN.md §2.3** | A 0-point run that died at the tool-call limit and a 0-point run that reasoned badly are *opposite* verdicts on the gate — "raise the limit and re-run" vs. "build the custom harness". Points alone cannot tell them apart. |
| **`sn_aia.continuous_tool_execution_limit`** and **`max_auto_executions` per attached tool** | **R-4 / #30** | E2's 19-call result was reachable only because that probe's `max_auto_executions` was **20** against an instance-typical **10** — 477 of 483 production rows sit at the dictionary default. A scorecard produced at 20 measures a configuration a default-configured customer does not have. |
| tool calls · assists consumed · wall clock · failure behavior (graceful partial vs. wandering/stuck) | plan Task 11 | — |

Three properties of the budget columns, all load-bearing:

- **Read at run time, not assumed.** R-4's words. The template ships with them blank and carries the
  read procedure; a pre-filled value is an assumption wearing a measurement's clothes.
- **Both knobs, not one.** *"recording only the property would leave the binding invisible, and the
  binding is not a lesser knob."*
- **The product app deliberately does not set `maxAutoExecutions`** (#24, #30), so the binding takes
  the dictionary default a real customer has. That is what makes the scorecard transferable — and it
  is precisely why reading the actual value at run time is the only way to know what was measured.

The completeness column is derivable rather than eyeballed. R-20 settled that run completeness comes
from `x_snc_troubleshoot_audit` — distinct `tool_name` over rows where `run = <run_id>` and
`action_type = 'result'` — so "layers swept" has a defined query behind it, not a scorer's
impression.

### 3.1 The third state: "could not look"

R-3's amendment draws one distinction — *finished* vs. *did not look*. Building this instrument
surfaced that a third state exists and is currently the **dominant** one.

**Agent Doctor as shipped has tools for layer 1 only.** `docs/agent/agent-doctor-instructions.md`
states it without hedging: *"You have tools for LAYER 1 ONLY … Layers 2 through 7 have no tool in
this build. Report every one of them as NOT SWEPT."* Task 10 shipped two tools — `agent_trace` and
`read_artifact` — as the deliberate vertical-slice scope from the Phase 1a build brief (*"Do not
build all seven tools in Task 10. One tool, end to end."*). The remaining five cores are Tasks 7–8,
unbuilt. Issue #29 already tracks the plan text still claiming seven.

The five gate-scored seeds target layers **3, 2, 5, 6, 7**. Not one targets layer 1. So a scored run
executed against the build as it stands today would score near-0/10 **by construction**, and the
Task 12 gate table reads that as:

> **< 5/10** → Full custom harness as designed

That is the most expensive decision in the project, reached from a missing-tools gap rather than
from anything measured about the native harness. It is the same shape as the failures this project
keeps legislating against — R-11's partial-read-as-absence, R-15's blanks-not-errors — arriving this
time through an instrument that cannot distinguish two very different zeroes.

**Change:** every scored row records **layers available** alongside **layers swept**. Availability is
read from the agent's attached tool set, not assumed from the design intent. A run showing
`swept 1/7, available 1/7` is an agent doing everything it can; `swept 1/7, available 7/7` is an
agent that stopped early. Identical scores, opposite verdicts — which is exactly the argument DESIGN.md §2.3
makes for cause-of-death, applied one level up.

The instrument is still built against the **intended seven-layer** target rather than trimmed to
today's two tools: it is the measuring device for the Phase 1b comparison as well, and trimming it
to a transient build state would have to be undone.

**Consequence for Task 12, filed rather than absorbed:** the scored 10-run protocol is not
meaningfully executable until Tasks 7–8 land. That is recorded as its own issue, not buried in this
design — a prerequisite discovered while building the instrument is a finding about the plan's
dependency order, and the plan is where it has to be visible.

### 3.2 Run identity

Scored runs key on a **hard per-conversation identifier**: `_agentic_context_.conversation_id`
(LLD §8 item 5 — stable across all 19 calls of a conversation, matches
`sn_aia_execution_plan.conversation`).

DESIGN.md §2.4 disqualifies time-window keying for scored runs outright, and the reason is not tidiness:
PaRunAnchor's "one anchor per user per 30 min" fallback would glue benchmark run 2 — a fresh
conversation 20 minutes later — onto run 1's anchor. That interleaves artifacts and audit rows into
one contaminated scorecard, and lets run 2 `read_artifact` its way into run 1's evidence, breaking
the blind independence the doubled-run protocol exists to measure.

---

## 4. The protocol

- **Smoke test before any seed is scored.** gpinst01 execution `c9d63a932bda8b9417a6ffbeee91bfd0`,
  expected diagnosis `script_error` citing `context_processing_script` **line 42**. This specimen is
  chosen over an easier one deliberately: it is *invisible from the plan header* — `state=Completed`,
  empty `state_reason`, all 11 tasks and all 5 tool calls `Success` — so it tests whether a diagnosis
  that stops at the header gets caught, not merely whether the tools can read rows.
- **2 runs per seed, fresh conversation each = 10 scored runs.** The doubling is a measurement of the
  documented "inconsistent behavior on identical inputs" mode, not redundancy.
- **Blind.** Agent Doctor's instructions, its tools, and the playbook contain no seed knowledge.
- Per-run capture: score, layers swept, layers available, cause of death, both budget knobs, tool
  calls, assists, wall clock, failure-behavior notes.

**The de-risking step named in DESIGN.md §2.1 is unavailable and the README says so.** DESIGN.md §2.1 casts
`PaEvidenceCollector` as the benchmark de-risker — run it against each seed before scoring to
separate *"tools cannot see the defect"* from *"agent cannot reason to it"*. That component is not
built (it is not in the Phase 1a task list). The substitute is a manual pre-scoring pass invoking the
tool cores directly against each seed. Recording the substitution matters more than the substitution
itself: an unbuilt de-risker that everyone assumes ran is how a benchmark produces scores nobody can
interpret.

---

## 5. Seed specifications

Each seed file carries: the defect, the expected root-cause layer, the expected fix target, the
Fluent construction, setup and trigger steps, the expected diagnosis signature, and safety notes.

| # | Seeded failure | Layer | Fix target | Construction note |
|---|---|---|---|---|
| 1 | Tool declares `priority` as free string; table wants integer choice 1–5 | `tool_schema` | tool input schema | Must produce a **large** trace — verbose multi-step instructions — so the benchmark exercises artifact paging, the native harness's weakest documented area |
| 2 | "Assign to the right group", no lookup guidance, no group tool | `instruction` | instruction text | |
| 3 | Instructions reference lookup table `x_snc_tsbench_routing`, created empty | `data` | data seeding | Table renamed per §1.2 |
| 4 | GenAI capability not mapped to a provider | `genai_stack` | capability mapping | See §5.1 |
| 5 | Use case exists but is inactive | `wiring` | activation | See §5.2 |

Seed 1 stays inside the **array** `input_schema` format. R-5 item 1 measured that supplying a
JSON-Schema object instead causes a *silent non-terminating stall* — the execution hangs `In progress`
forever. Seed 1 is meant to test a schema **type mismatch**, not to reproduce a platform hang; a seed
that stalls produces no trace to diagnose and would test nothing.

### 5.1 Seed 4 — closing LLD §8 item 8

§8 item 8 is the last open construction: *"Seed 4 construction that cannot degrade the shared
instance's GenAI config."*

**Construction: the fixture app declares its own `sys_one_extend_capability_definition` with
`connection` empty.** R-18 established that `connection` is the bound provider credential alias, so
*an empty or unresolvable `connection` is precisely the "capability not mapped to a provider"
finding* seed 4 needs to produce. Creating a new capability rather than unmapping a real one is what
respects the shared-instance constraint the open item exists to protect — gpinst01 is shared, and
LLD §7 carries an explicit ⚠ **do NOT unmap real capabilities**.

Item 8 is closed in **both body and status label** (R-19b: in a structured record the status label is
part of the claim, and a reader scanning only labels must not be misled). The closure is qualified
honestly: **build-proven, not yet runtime-proven** — the runtime half arrives with Task 12.

### 5.2 Seed 5 — naming the right gate

There are **two independent activation gates** (LLD §8 item 2, R-18):
`sn_aia_trigger_configuration.active` and `sn_aia_trigger_agent_usecase_m2m.active`. A use case reads
as inactive when *either* is off.

The seed sets **one false and leaves the other true**, so a correct diagnosis has to name the
specific gate rather than score for observing "something is inactive". Note also that SDK 4.9.0
deploys triggers **inactive** by default — the seed's construction must make the intended gate state
explicit rather than inherit it, or the seed tests the SDK's default instead of the defect.

### 5.3 Stretch seeds 6–8

Not written as spec files. They are explicitly not gate-scored (LLD §7), and specs for seeds that may
never be built are cost without benefit. The README carries a short pointer to LLD §7 identifying
them as the swap-in set if a core seed proves unbuildable on the shared instance.

---

## 6. Doc reconciliation — part of this task, not follow-up

This project's rulings treat a Change clause naming a document section as **a work item, not a
record** (R-18c), and the ledger walk is bidirectional (R-19a). Three edits therefore ship with the
deliverables:

| Document | Edit | Governing rule |
|---|---|---|
| `IMPLEMENTATION_PLAN.md` Task 11 | The `> **OPEN — decide before Task 11**` block is **replaced** by the resolution | R-18b — a correction replaces the text it invalidates; it does not sit beside it |
| `LOW_LEVEL_DESIGN.md` §8 item 8 | **Body and status label both** move from `STILL OPEN` to closed | R-19b — the status label is part of the claim |
| `DESIGN.md` | New ruling recording the seed-location decision **and** the §3.1 availability finding | R-19a — a decision the ledger cannot see is a decision the next walk will re-open |

Plus one **new GitHub issue**, not a document edit: Task 12's scored protocol is blocked on Tasks 7–8
(§3.1). Filed separately so it is visible in the tracker rather than only inside a design doc — the
plan's dependency graph already has `Tasks 6,7,8 → 9 → 10/11`, and the gap is that Task 10 shipped
against a narrowed vertical slice while Task 11's downstream consumer still assumes seven tools.

Also to check while in these files: LLD §7's seed 3 row names `x_snc_troubleshoot_bench_routing`,
which §1.2 supersedes. Correct it there rather than leaving the two documents disagreeing about a
table name — that is the precise shape of the R-13 defect this project already paid for once.

---

## 7. Testing

No Jest tests. The deliverables are documents plus Fluent definitions; this repo's Jest suite covers
Script Include logic under `test/` (R-14), and there is no logic here to unit-test.

Verification is:

1. **`now-sdk build` passes in `benchmark/seed-app/`** — the fixture app's five seeds compile. This
   is the substantive check and the one §1.4 flags as at risk.
2. **`now-sdk build` still passes at the repo root** — the nested project must not disturb the
   product build. Worth asserting rather than assuming: R-14 established that `now-sdk build` lints
   *every* file under `src/`, and a nested project placed carelessly is exactly the kind of thing
   that turns a total build failure into a mystery.
3. **`npm test` still green** — no product code changes, so any failure here is collateral damage.
4. Seed docs cross-checked against LLD §7 so the two do not drift on construction detail.

Deliberately **not** verified in this task: that the seeds actually fail on-instance in the way their
specs predict. That requires an install and a triggered run, and it is Task 12's.
