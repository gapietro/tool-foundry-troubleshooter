# Pre-Flight Spec — Falsify the Agent Doctor Bet Before Building It

**Date:** 2026-07-30 · **Status:** design approved, nothing executed
**Scope:** a Phase 0 that runs *before* `IMPLEMENTATION_PLAN.md` Task 1.
**Companions:** `docs/LOW_LEVEL_DESIGN.md` (§8 open items) · `DESIGN.md` (spar record, changes 2.2/2.3/2.4) · `docs/AGENT_DOCTOR_ARCHITECTURE.md` · `docs/IMPLEMENTATION_PLAN.md`

---

## 1. Why this exists

`DESIGN.md` §1 chose Option A — native harness first — on one argument: it is **cheap to falsify**. The current plan does not honour that. `IMPLEMENTATION_PLAN.md` runs Task 1 → Task 13 linearly and resolves all ten `LOW_LEVEL_DESIGN.md` §8 open items *inline during the build*.

At least four of those items are not details. They are falsifiers — results that, if they land the wrong way, change the design or waste work already done:

- **§8.5** (runtime identifiers a script tool can see) was already promoted to *benchmark-blocking* by the spar (`DESIGN.md` 2.4).
- **§8.1** (`execution_mode` choice values) decides whether an autonomous sweep is possible at all.
- **§8.10** (Now Assist Panel + product plugin) is a hard blocker on testing *any* agent.
- **§8.4** (cross-scope reads from our own scope) sits under all six tool cores. Everything in LLD §2 was verified as **admin via MCP**, not as a scoped app calling `GlideRecordSecure` — a different question.

Spending Tasks 1–9 before testing these inverts the rationale that justified Option A. This spec inserts the falsification step first.

**Non-goal:** this is not the benchmark. The seeded-failure benchmark (`IMPLEMENTATION_PLAN.md` Tasks 11–12) remains the decision gate for the harness. Phase 0 only establishes whether the thing the benchmark would measure can exist.

---

## 2. Constraints agreed

1. **Nothing is built.** No SDK project, no scoped app, no Script Includes, no repo code.
2. **One exception:** a single disposable probe agent on keynexus01, created → fired once → captured → **deleted**.
3. Phase 0 writes **no properties** and touches **no GenAI provider configuration** (the LLD §8.8 shared-instance concern).
4. Every probe has a written result-to-verdict rule fixed *before* it runs (§5).

---

## 3. Phase 0a — read-only reconnaissance

Run via Foundry MCP against keynexus01 as admin. Ordered so the hard blocker resolves first. A P1 failure blocks **Phase 0b** but not the remaining reads — P2–P6 are pure reads, still cheap, and their answers are needed whenever the panel does come up.

| # | Question | Method | Closes |
|---|---|---|---|
| **P1** | Is the Now Assist Panel enabled, and is at least one Now Assist product plugin (ITSM/HRSD/CSM/SecOps) active? | Active rows in `sys_plugins`; `sys_properties` matching `%now_assist%` | §8.10 |
| **P2** | What are the real loop-budget values? | `sn_aia.continuous_tool_execution_limit`; the `sn_aia_agent_tool_m2m.max_auto_executions` dictionary default; **and the values the 19 OOB agents actually carry** | DESIGN 2.2 |
| **P3** | Does an unsupervised/auto execution mode exist for tools of `type=script`? | `sys_choice` for `sn_aia_agent_tool_m2m.execution_mode` and `sn_aia_tool.type`; cross-check against OOB m2m rows | §8.1 |
| **P4a** | Are the §2 `sn_aia_*` tables reachable from another application scope at all? | `sys_db_object.access` / `caller_access` across the LLD §2 table list; existing `sys_scope_privilege` rows | §8.4 (static half) |
| **P5** | Where do GenAI prompt/response payloads live, and can a non-admin caller read them? | `sys_gen_ai_log_metadata`, `sys_gen_ai_metadata_document`, `sys_one_extend*` and their ACLs | §8.3, §8.6 |
| **P6** | Where are the Studio "Define User Access" / "Define Data Access" role sets stored? | Field scan on `sn_aia_agent` and `sn_aia_usecase` plus any related role m2m | §8.9 |

### P4b — the scoped-read proxy

§8.4's runtime half normally requires our scoped app to exist. It does not have to. **If keynexus01 already hosts any non-global scoped application**, a read-only background script executed *in that scope*, attempting `GlideRecordSecure` reads across the LLD §2 table list, is a faithful proxy for what our tool cores will face. It executes but writes nothing and creates nothing.

Whether such an app exists is itself a P4b finding. If none does, §8.4 stays half-open — closed statically by P4a, confirmed at runtime during the build — and that carry-forward is recorded rather than glossed.

### Deliberately excluded from Phase 0a

P2 **records** budget values; it does not set them. `DESIGN.md` 2.2 calls for "verify + tune", and the tuning half deserves to be a deliberate, recorded decision at build time — not a side effect of reconnaissance. See the transferability caveat in §6.

---

## 4. Phase 0b — the disposable probe agent

One agent, one tool, fired once. Built to answer the maximum per execution.

**Composition**

- 1 × `sn_aia_agent` — ReAct strategy `f0bff21f9f13c6108f431597d90a1c74` (the same strategy Agent Doctor will use), channel `nap_and_va`.
- 1 × `sn_aia_tool` — `probe_context`, `type=script`, read-only, returns immediately.
- Minimal team / use case / trigger / wiring to make it fireable from the Now Assist panel. **No `context_processing_script`** — LLD §5 records that as a verified failure vector.

**All output goes to `sys_log` under source `PA_PROBE`**, not to the chat. This matters: `DESIGN.md` 2.5 accepts that a broken doctor and a broken patient look identical in chat, so the probe must not depend on chat rendering to report its findings.

### E1 — context dump (closes §8.5, the benchmark-blocker)

The script enumerates every identifier visible to it at runtime: the input object it receives, session and current-user identifiers, executing scope, and any conversation or `sn_aia_execution_plan` identifier reachable from that context. There is no way to learn this by reading tables — the context only exists while a real agent conversation is executing the tool.

The result decides `PaRunAnchor`'s key. `DESIGN.md` 2.4 disqualified time-window keying for scored runs and named two fallbacks: the doctor's own `sn_aia_execution_plan` sys_id, or an explicit tester-passed run token. E1 establishes which of those is actually available.

### E2 — 15-call endurance (closes DESIGN 2.2, seeds DESIGN 2.3)

Instructions direct the agent to call `probe_context` fifteen times, once per nominal "layer". The measurement is where it stops **and how**:

- clean completion at 15,
- a hard stop with an error,
- or the **silent supervision stall** that `DESIGN.md` 2.2 warns is the likelier failure mode.

This is the highest-value experiment available before the build, because it tests the load-bearing assumption behind Option A directly: *can a native Studio ReAct loop sustain a 12–15-call autonomous investigation at all?* Studio's harness is workflow-shaped — steps and supervised handoffs — and `DESIGN.md` §1 names that as the actual doubt. E2 also produces the first real observation for the 2.3 cause-of-death taxonomy (`completed | tool_limit | context | supervision_stall | security | wandered | genai_down`), which until now is an untested vocabulary.

The loop is safely bounded: the tool is read-only and returns immediately, so the worst case is a short sequence of no-op calls.

### E3 — data-model confirmation (free)

The run leaves fresh `sn_aia_execution_plan` / `_task` / `_tools_execution` / `_message` rows. Reading them validates LLD §2.1's mapping against an execution **we caused**, rather than only against the 2026-07-18 archaeology and the single reference failure `78f347b72f198310f824ac1bcfa4e3bd`.

### Cleanup

Delete in reverse dependency order: trigger m2m → trigger → use case → team member → team → tool m2m → tool → agent.

**Execution rows from E3 are retained.** They are read-only history, harmless on a dev instance, and a useful known-answer reference for the trace tool. Every created sys_id is recorded in the findings document so the retention is deliberate and reversible.

---

## 5. Falsification criteria

Fixed before execution, so no result can be rationalised after the fact.

| Probe | Result | Verdict |
|---|---|---|
| **P1** | Panel off, or no Now Assist product plugin active | **Hard stop.** No agent can be tested. This is an instance-provisioning task, not a design change — Phase 0b cannot run until it is fixed |
| **P2 + E2** | Fewer than **12** calls complete (the floor for the seven-layer sweep, LLD §5 / DESIGN 2.2), whether by hard stop or stall, and the ceiling is not raisable | Native front door is capped below the diagnostic sweep. The Task 12 gate is effectively pre-decided toward the custom harness, and the whole Phase 1a native build is avoided |
| **P2 + E2** | 12–14 calls complete | Marginal. The sweep fits only with no margin for retries or `read_artifact` paging. Proceed, but the playbook must be budgeted call-by-call and the scorecard's `tool_limit` cause-of-death watched closely |
| **P2 + E2** | All 15 complete cleanly | Option A's core assumption survives. Proceed to Task 1 with the budget values recorded |
| **P3** | No unsupervised/auto mode for `type=script` tools | Autonomous sweep is impossible natively. The benchmark would be measuring a different product than the one specified |
| **P4a/P4b** | `sn_aia_*` unreadable from a non-global scope | Tool cores cannot live in our scope. LLD §6's build approach changes before Task 1 |
| **E1** | No per-conversation identifier and no usable fallback | `DESIGN.md` 2.4's hard-key requirement is unsatisfiable under the native harness. Scored runs would contaminate each other; the benchmark protocol needs redesign before seeds are built |

A verdict of "proceed" requires every row above to land on the non-blocking side. Partial results are recorded as carry-forward risk, not silently absorbed.

---

## 6. Benchmark transferability caveat

If `sn_aia.continuous_tool_execution_limit` is later raised on keynexus01 so the benchmark can complete, **the benchmark result stops transferring to a customer instance running the default.** A scorecard produced under a tuned ceiling measures a configuration the customer does not have.

Therefore:

- P2 records the **OOB default** separately from any value we tune to.
- The benchmark scorecard (`IMPLEMENTATION_PLAN.md` Task 11–12) must state which value each run executed under.
- If the two differ, the gate decision in `benchmark/DECISION.md` must say so explicitly.

---

## 7. Output artifact

`docs/PREFLIGHT_FINDINGS.md`, containing:

1. Each LLD §8 item marked **closed** (with the verified value) or **carried forward** (with the reason).
2. The `DESIGN.md` 2.2 budget values — OOB default and current, recorded separately per §6.
3. The E1 identifier set and the resulting `PaRunAnchor` keying decision.
4. The E2 terminal behaviour and its cause-of-death classification.
5. Every probe-agent sys_id created, and confirmation of deletion.
6. A go / no-go statement against the §5 table.

Any finding that changes the design is additionally filed as a ruling in `DESIGN.md` §4 ("Rulings during implementation"), which exists for exactly this.

---

## 8. What this does not decide

Phase 0 does not decide the harness. It establishes whether the native harness is testable and whether the benchmark can be run validly. The gate thresholds in `ARCHITECTURE_DECISIONS.md` Decision 0.5 and `IMPLEMENTATION_PLAN.md` Task 12 are unchanged — with one addition: if E2 shows the loop cannot sustain the sweep, that evidence enters the gate decision directly, ahead of any scored run.
