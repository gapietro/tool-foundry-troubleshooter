# Phase 1b Kickoff — Pre-Work Design

**Date:** 2026-08-02 · **Status:** design — pre-work items are small and fully constrained by
`benchmark/DECISION.md` §D/§E, so this spec fixes the concrete choices and the PR breakdown.
**Companions:** `benchmark/DECISION.md` (the Task 12 gate: 7/10, middle band) ·
`docs/IMPLEMENTATION_PLAN.md` "Phase 1b (CONTINGENT)" · `docs/ARCHITECTURE_DECISIONS.md`
Decision 0.5 + Layers 1–4 · the Phase 1b harness implementation plan
(`docs/superpowers/plans/2026-08-02-phase1b-harness.md`, written after this spec).

---

## 1. What the gate decided, and what this spec covers

Task 12 scored 7/10 — the middle band. Native Agent Doctor stays as the lightweight-triage
front door; the custom deep-diagnosis harness gets built. DECISION.md §E makes three items
**preconditions of the Phase 1b comparison re-run**, each small and each fully specified by a
§D failure note:

1. **Seed 2 v2** (§D2) — the tool-less construction is refuted; bind one weak/irrelevant tool.
2. **`PaToolGenAiLog` `check_config` capability filter** (§D3) — the 100-row name-ordered
   sample can never reach an `x_*` capability.
3. **Playbook/instructions v2** (§D3, §D4) — the definition-row rule and the
   derive-the-table-from-trace rule, in both renderings, kept in sync.

This spec designs those three. The harness components (PaLlmProxy, PaToolRegistry, PaFixReport,
PaRunManager incl. run-lifecycle close-out, PaAgentLoop + async wiring, Scripted REST API) are
**planned, not built**, this session — their design already lives in ADR Layers 1–4 and PRD
v2.0; the implementation plan doc sequences them and folds in the §D5 scope inputs.

---

## 2. Pre-work 1 — Seed 2 v2: bind one weak tool

### The measured problem

A ReAct agent with zero bound tools is cancelled by the engine before the LLM is invoked
(§D2, execution `11bd8d882baa4314f243fed2ce91bfb3`, 737ms, output digest `{}`). The
instruction's ambiguity is never reached; the seed can only ever test layer 3. No valid run in
the benchmark exercised layer-2 diagnosis.

### Options considered

- **(a) Irrelevant tool with no inputs** (`get_current_datetime`): satisfies "engine enters the
  loop" but the model may never call it, and an input-less `tools[]` entry is an untested SDK
  shape (risk of a build surprise for zero diagnostic gain).
- **(b) Weak tool that consumes the request** (`measure_request`: character/word count of the
  request text) — **chosen.** Plausibly router-adjacent, so the model will actually invoke it
  and the loop genuinely runs; structurally incapable of resolving a group, so the defect stays
  purely instructional; side-effect-free.
- **(c) Misleading tool** (e.g. a `lookup_group` that returns nothing): rejected — that moves
  the defect into layer 3 (a broken tool), exactly what §D2 says v2 must not do.

### Design

`benchmark/seed-app/src/fluent/seed-02-ambiguous-instruction.now.ts`:

- **Instructions, agentRole, description, name: UNCHANGED.** The defect under test is the
  instruction text; touching it would make v1/v2 results incomparable in the wrong dimension.
- Add one tool `measure_request` (Rules #19/#32/#34, R-5/R-9): description honest and free of
  meta-commentary (no "deliberately irrelevant" — labeling the mechanism would hand the
  diagnosis away; the agent-level "Benchmark seed - deliberately broken" marker stays, same as
  every other seed), script an IIFE returning `{received, characters, words}` from the request
  text, one optional input. No backslash escapes in the template (Rule #43) — word count via
  plain `split(' ')`, no regex.
- Header comment rewritten: v2 construction, §D2 citation, and the standing warning that the
  tool must never grow group-resolving ability.

`benchmark/seeds/seed-02-ambiguous-instruction.md`: rewrite the defect section as v2. The
refutation banner becomes history (kept, dated); the v2 mechanism — the engine enters its loop,
the model measures the request, then must invent a group or stall — is recorded as a
**prediction until the re-run measures it**, matching the repo's measured-vs-predicted
discipline. Expected layer (2, `instruction`) and fix target (the instruction text) unchanged.

**Test (TDD, offline):** new `test/seed02Construction.test.js` in the main repo (tests live in
`test/` at repo root; the seed-app has no Jest of its own), asserting on the Fluent source:
exactly one tool; its name/description/script contain no group-resolving vocabulary (`group`,
`assignment_group`, `route`); the instructions block still contains the verbatim ambiguous
sentence and still names no group; the IIFE ends with `(inputs);`; no `\n` escape and no `${`
in the added templates. Then `now-sdk build` in `benchmark/seed-app` must pass.

**Not done here:** reinstalling the seed app on gpinst01. Install is the comparison re-run's
setup step (mirroring Task 11/12's split: the PR gate is a passing build).

---

## 3. Pre-work 2 — `check_config` capability filter

### The measured problem

`check_config` reads the first `MAX_DEFINITIONS` (100) of ~2026 `sys_one_extend_capability_definition`
rows ordered by name — an `x_*` capability can never appear (§D3). The mode's own truncation
note promises "narrow the check by naming a capability once that argument exists."

### Design

New optional argument `capability` (aliases `capability_name`, `definition` in
`_normalizeArgs`), semantics chosen to avoid OR queries (the Jest Glide stub's
`addOrCondition` is a no-op, and two sequential reads are more honest in the `reads` block
anyway):

- **Value is a sys_id** → read `sys_id=<v>` first (the definition row itself); if that read is
  clean-empty, read `capability=<v>` (definitions of that parent capability). The output
  records which interpretation matched (`matched_on: 'definition_sys_id' | 'capability_reference'`).
- **Anything else** → `name LIKE <v>` on the definition name (platform contains-match).
- **No argument** → existing behavior byte-for-byte (the 100-row name-ordered sample, existing
  truncation note updated to name the now-real argument).

Output additions: `data.filter` `{value, interpretation, matched_on, matched}`; `requested`
echoes `capability`. A filtered read that matches nothing gets an explicit note: not evidence
the capability is healthy or absent — the filter may be misspelled, or the capability may
genuinely have no definition row, which is itself a candidate finding to confirm via
`query_table` (R-6/R-11: never render absence from a question that may have been wrong).
`audit_status` semantics unchanged ('ok' for a complete clean read — now honest for the
filtered set, with a note stating the audit covered only matching definitions).

`MAX_DEFINITIONS` still caps filtered reads. `DEFINITION_FIELDS`/checks per definition
unchanged — the filter narrows *which* rows, never *what* is checked.

**Fluent description update** (same PR): `genai_log`'s tool description and input description
in `src/fluent/agent-doctor.now.ts` gain the `capability` argument. Requires `now-sdk build`.

**Tests (TDD, extending `test/PaToolGenAiLog.test.js`):** filter by definition sys_id; filter
by capability reference (fallback read observed via `GlideRecordSecure.calls.queries`); filter
by name substring; unfiltered call still unfiltered; empty filtered result carries the
both-possibilities note and no finding; `requested`/`filter` echo; DENIED under filter still
reports the §D3-style nothing-was-audited note.

---

## 4. Pre-work 3 — Playbook/instructions v2

### The measured problems

- **§D3:** S4R2 read only the parent capability record, declared the empty `connection` the
  primary cause — a well-formed no-op fix. The definition row (`api`, `api_type`,
  `connection`) is where the defect lives; empty `connection` is normal (318/2026 = 15.7%).
- **§D4:** three runs guessed table names; one produced a false secondary finding ("table does
  not exist" for `sn_tsbench_ticket`, which exists as `x_snc_tsbench_ticket`) plus a fix
  proposing to create an existing table.

### Design

Two new short sections in `docs/agent/agent-doctor-instructions.md`, pasted verbatim into
`src/fluent/agent-doctor.now.ts` (the byte-for-byte sync test already enforces the pairing).
Text budget: the guard test caps the markdown at 1200 words and it sits at 1055, so the two
sections together must stay under ~140 words. No backtick, no `${`, no `\n` escape (existing
guard tests).

Placement and draft text (final wording tuned to the word budget):

- After "Start at the trace, then follow the evidence":

  > **## Derive table names, never guess them**
  >
  > Take table names from evidence - the tool script, the execution context, the agent's tool
  > schemas - before querying. A table-does-not-exist result on a guessed name is a finding
  > about the guess, not the instance.

- After "What blank data means" (layer-6 rule):

  > **## The GenAI stack: read the definition row**
  >
  > When a capability is suspect, always read its sys_one_extend_capability_definition row -
  > api, api_type, connection - not only the parent capability. genai_log check_config takes a
  > capability name or sys_id. An empty connection is normal and never a root cause on its own;
  > the mandatory bindings are where defects live.

**Tests (TDD, extending `test/agentDoctorInstructions.test.js`):** the text names
`sys_one_extend_capability_definition`; carries "never a root cause on its own"; carries
"finding about the guess"; word cap unchanged at 1200 and still passes.

**Ordering note:** lands after pre-work 2, because the new text tells the model `check_config`
takes a capability argument — that must be true when the instruction installs. Both PRs touch
`agent-doctor.now.ts` in disjoint regions; sequential merge, rebase if needed.

---

## 5. Work breakdown — issues, branches, PRs

House rules: issue per work item, feature branch + PR each, TDD, `now-sdk build` green before
any install claim, version bump per merge (`YYYY.MM.DDXX`, continuing the `2026.08.02XX`
series).

| # | Item | Branch | Touches |
|---|---|---|---|
| 1 | docs: this spec + harness plan | `docs/phase1b-kickoff-spec` | docs/superpowers/ |
| 2 | Seed 2 v2 | `fix/seed-02-v2-weak-tool` | seed-app fluent, seed spec md, new guard test |
| 3 | check_config filter | `feature/check-config-capability-filter` | PaToolGenAiLog.js, its test, agent-doctor.now.ts (genai_log description) |
| 4 | Playbook v2 | `feature/playbook-v2-benchmark-rules` | instructions md, agent-doctor.now.ts (instructions), instructions test |

Sequential (3 → 4 ordered; 2 independent). Not dispatched to parallel agents: items 3 and 4
overlap on `agent-doctor.now.ts`, and item 2's guard test lands beside item 3's test changes —
the "3+ independent tasks" checkpoint is not met once file overlap is counted.

Deliberately **not** in scope: reinstalling either app on gpinst01 (the comparison re-run owns
install + on-instance verification), the harness components themselves (planned in the
companion plan doc), and the §D5 assist-unit measurement source (a plan-doc question, since it
gates only the comparison's bookkeeping, not the build).

---

## 6. Outcome (recorded post-merge, same day)

Shipped as PRs #48 (seed 2 v2, 2026.08.0202), #49 (filter, .0203), #50 (playbook v2, .0204),
each subagent-code-reviewed before merge. Deltas from the design above, all review-driven:

- **Filter:** a DENIED filtered read reports `matched: null` (never 0 — R-11 at field
  granularity); a truncated *filtered* read scopes its note to the matched set with a floor
  marker instead of the whole-table denominator; the zero-match note names the table the
  interpretation actually searched; the `definition` alias was dropped (a stray LLM key must
  not silently narrow an audit meant to be whole-table). The "honest trail in the reads block"
  rationale was corrected — the reads block keys by table and only upgrades status, so
  `filter.matched_on` is the runtime record of which read matched.
- **Seed 2 v2 guard:** the exactly-one-tool count anchors on `type:` entries in the tools slice
  (covers every tool shape, not only `script`); the backslash guard is total.
- **Process note:** the companion harness plan doc reached `main` inside PR #50's rebase rather
  than this docs PR — content identical, attribution recorded here.
