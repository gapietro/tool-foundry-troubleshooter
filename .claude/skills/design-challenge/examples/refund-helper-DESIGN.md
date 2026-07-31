> **Reference example** — actual output of `/foundry:design-challenge` (plugin 1.4.0,
> 2026-07-29) run unattended against a deliberately flawed fixture: a "Refund Helper"
> agent whose `x_ref_case` table had two writers. The gate caught the planted
> single-writer violation, found an unplanted naming-drift violation, restructured the
> design (Option B), and recorded verdicts for all 7 failure-catalog scenarios. Shown
> here as the expected shape of a DESIGN.md this skill produces.

# DESIGN.md — Refund Helper (ServiceNow POC)

Status: **Adversarial design-gate complete. No human reviewer was available in this
session — restatement was auto-confirmed and the chosen option was selected by the
reviewing agent with stated reasons. This document has NOT received human approval
and must be signed off before build.**

## 1. Restatement of proposed design (as given)

- One AI Agent, "Refund Helper", exposing 4 tools: `lookup_order`, `check_policy`,
  `issue_refund`, `notify_customer`.
- Entry point: ServiceNow Virtual Agent (conversational trigger).
- State: custom table `x_ref_case`, written directly by **two** tools —
  `issue_refund` and `notify_customer`.
- External dependency: a pricing REST API, called from `check_policy`.

Auto-confirmed as accurate (no corrections available to apply).

## 2. Options round

### Option A — As proposed: single agent, 4 tools, dual writer
- Components: 1 AI Agent, 4 independent tool scripts, `x_ref_case`, VA trigger.
- State ownership: `x_ref_case` has **two writers** (`issue_refund`, `notify_customer`).
- Hardest failure mode: the LLM decides tool-call order and count. Nothing stops it
  from calling `issue_refund` twice on a retried turn, or calling `notify_customer`
  before `issue_refund` has actually committed — i.e., duplicate money movement or a
  false "your refund is on its way" message with no refund behind it.
- Biggest trade-off: simplest to build, but sequencing and exactly-once guarantees
  for a money-moving action are left to LLM judgment rather than deterministic code.

### Option B — Single agent for read-only steps + one deterministic flow-backed tool for the transactional pair
- Components: 1 AI Agent with 3 tools — `lookup_order`, `check_policy` (both
  read-only, safe for the LLM to sequence flexibly), and `execute_refund_case`, a
  single tool backed by a Flow/subflow that performs refund issuance and customer
  notification as one deterministic, idempotent unit and is the **sole writer** to
  `x_ref_case`.
- State ownership: `x_ref_case` owned exclusively by `execute_refund_case`.
- Hardest failure mode: the flow itself must handle partial completion (refund
  issued, notify failed) without becoming a second implicit writer path — needs an
  explicit state machine, not two independent scripts hoping to agree.
- Biggest trade-off: one more artifact (a flow) than a pure tool-script design, plus
  idempotency-key logic to write — but state ownership and sequencing move out of
  the LLM and into deterministic platform code, which is the right place for them
  given this action moves money.

### Option C — Orchestrator + two child agents (Lookup agent, Execution agent)
- Components: router/orchestrator agent, child "Refund Lookup" agent
  (`lookup_order`, `check_policy`), child "Refund Execution" agent (single
  combined write tool).
- State ownership: clean — execution child owns `x_ref_case` alone.
- Hardest failure mode: orchestration adds its own failure surface (duplicate
  trigger at the orchestrator level double-invokes both children; handoff
  bookkeeping between parent and children).
- Biggest trade-off: correct separation of concerns, but the orchestrator/child
  hierarchy is scaled for a coordination problem this POC doesn't have — 4 tools
  and one linear conversation flow don't justify a second agent tier.

### Decision: Option B

Reasons:
1. It directly fixes the concrete defect in the original design — two writers on
   `x_ref_case` — which is a DDD aggregate violation, not a style nit (see §4).
2. It removes exactly the failure mode most likely to bite in a refund flow:
   LLM-driven, non-idempotent execution of a money-moving action. Taking that
   sequencing out of the agent's hands and into a deterministic flow is the
   smallest change that buys the biggest risk reduction.
3. Option C's added orchestration tier solves a coordination problem (multiple
   agents needing to hand off state) that doesn't exist at this POC's scale —
   it would add duplicate-trigger and handoff-bookkeeping risk without a
   corresponding benefit over Option B.
4. `lookup_order` and `check_policy` are read-only and side-effect-free, so
   leaving their sequencing to the LLM is low-risk and keeps the conversational
   flexibility the Virtual Agent entry point is there for.

## 3. Stress-test (chosen design: Option B)

| # | Scenario | Verdict | Detail |
|---|---|---|---|
| 1 | LLM nondeterminism — same input, different tool-call order; hallucinated tool inputs | **mitigated by design change** | Agent instructions specify the required order (`lookup_order` → `check_policy` → `execute_refund_case`), but the design does not trust instructions alone: `execute_refund_case` independently validates that the referenced order exists and policy was actually evaluated (via its own GlideRecordSecure lookups), rejecting calls with hallucinated or unverified order IDs rather than trusting agent-supplied data. |
| 2 | Tool-script partial failure — script error mid-write, REST timeout, half-updated records | **mitigated by design change** | Replacing two independent writers (`issue_refund`, `notify_customer`) with one flow removes the "refund issued but never notified" split-state risk from being two uncoordinated scripts. The flow drives `x_ref_case.state` through an explicit machine (`pending` → `refund_issued` → `notified` → `complete`, with a `notify_failed` terminal state that doesn't roll back the refund). Notify failure is recorded for reconciliation, not silently dropped. |
| 3 | ACL/scope denial — GlideRecordSecure returns silently empty results, not errors | **mitigated by design change** | `lookup_order` and `check_policy` explicitly check result count and return a structured `access_denied` / `no_data_found` status rather than an empty-but-"successful" payload. Agent instructions require surfacing this to the user verbatim instead of improvising an answer from an empty result. |
| 4 | Missing or dirty instance data — the record the demo assumes doesn't exist | **mitigated by design change** | `lookup_order` returns an explicit `not_found` status; agent instructions require stopping and asking the user for clarification rather than fabricating order details. |
| 5 | Instance limits — execution timeouts, payload/attachment size caps | **accepted risk** | The external pricing REST call in `check_policy` gets an explicit timeout with one retry and a circuit-breaker fallback response ("policy service unavailable") instead of hanging the agent turn. No attachments are involved in this flow, so payload-cap exposure is low; full timeout tuning is deferred to build/test rather than blocking the design gate. |
| 6 | Duplicate trigger firing and retry behavior — what happens on the second run | **mitigated by design change** | `execute_refund_case` requires an idempotency key (order ID + case reference). Before acting, it checks `x_ref_case` for an existing case already in `refund_issued`/`complete` state for that key; a second call short-circuits and returns the existing result instead of reissuing the refund. |
| 7 | Data Policy silent record drops at app install | **accepted risk, with a verification step** | The flow performs a read-back after writing `x_ref_case` and fails loudly (returns an explicit error to the agent/VA) if the persisted record doesn't match expected field values, rather than assuming the write succeeded. A full Data Policy audit of `x_ref_case`'s mandatory/ACL'd fields is out of scope for this design gate and is tracked as a build-time verification item, not resolved here. |

## 4. DDD-lite checklist

| Check | Verdict | Detail |
|---|---|---|
| Bounded context → scoped app | **pass** | Single scoped app owns the refund context; `x_ref_case` lives in-scope. The external pricing API is a genuine external system, accessed only through the `check_policy` tool interface — no shared-table coupling. |
| Ubiquitous language | **finding, fixed in this design** | Original tool names (`issue_refund`, `notify_customer`) didn't share the "case" term used by the table `x_ref_case`. Fixed by naming the combined transactional tool `execute_refund_case` and requiring the table label ("Refund Case"), agent instructions, and tool naming all use "refund case" consistently — no synonym drift between agent prompt, tool name, and table label. |
| Aggregates → single writer | **finding, fixed in this design** | Original design had two writers (`issue_refund`, `notify_customer`) on `x_ref_case`. Fixed: `execute_refund_case` (flow-backed) is the sole writer; `lookup_order` and `check_policy` remain read-only. |

## 5. Final component summary (as designed, Option B)

- **Agent**: "Refund Helper" — AI Agent, triggered from Virtual Agent.
- **Tools**:
  - `lookup_order` (read-only, GlideRecordSecure, explicit not_found/access_denied handling)
  - `check_policy` (read-only, calls external pricing REST API with timeout + circuit breaker)
  - `execute_refund_case` (flow-backed, sole writer to `x_ref_case`, idempotent via order+case key, drives explicit state machine, read-back verification on write)
- **State**: `x_ref_case` ("Refund Case"), single writer = `execute_refund_case` flow.
- **External dependency**: pricing REST API, accessed only via `check_policy`.
- **Alternatives rejected**: Option A (original proposal — dual writer, LLM-controlled
  sequencing of a money-moving action; rejected for the failure modes in §3 rows 1–2
  and the DDD violation in §4). Option C (orchestrator + child agents — rejected as
  unjustified coordination overhead for this POC's scale).

## 6. Approval

**Pending.** No user was available in this session to approve this contract. Per the
design-challenge gate, this DESIGN.md must be reviewed and approved by a human
stakeholder before the first now-sdk build begins. Treat anything built against this
document prior to that approval as provisional.
