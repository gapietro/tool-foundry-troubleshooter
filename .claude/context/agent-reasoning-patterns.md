# Agent Reasoning Patterns — Now Assist Reasoning-Elicitation Index

> One-page orientation map for the reasoning techniques that separate a demo agent from a
> production one on Now Assist. This is an **index**, not a textbook: it tells you what is
> platform-applicable, what the platform owns, and which doc to open next. Deeper treatments
> live in the canonical owners linked below.

---

## 1. How reasoning works on Now Assist

ServiceNow runs the reasoning loop for you. ReAct is a platform-shipped reasoning **strategy**
(`sn_aia_strategy`, read-only; the default for the large majority of agents): the platform runs the
Thought → Action → Observation cycle, persisting each step in `sn_aia_execution_task` (the step
carries a literal `"Thought"` key). Your leverage is **instructions, tools, strategy, and
memory-feeding — not the loop code.** You do not write the iterate loop; you shape what the agent
thinks inside it.

Topology in one sentence: `sn_aia_usecase` resolves to one `team` (`sn_aia_team`) plus one
`strategy`, agents are flat peers in `sn_aia_team_member` (no order field), and a supervisor→child
hierarchy, where present, is expressed via `sn_aia_agent_child` — there is no
`sn_aia_usecase.orchestrator_agent` field. (Canonical topology/property/API doc fixes are owned by
**#107**; this doc references them, it does not re-fix them.)

Loop bounds are platform-managed, not per-call developer settings: `sn_aia.react_failure_retry_max_limit = 3`
(ReAct failure-retry cap, confirmed) and `sn_aia.continuous_tool_execution_limit` — max consecutive
same-tool calls (**developer-editable**; live Zurich P10 value verified 25 on gpinst01 (2026-07-18);
ServiceNow's published property reference states default 7 — treat 25 as authoritative for Zurich
and verify `sn_aia.continuous_tool_execution_limit` on the target instance; **not** a hard
reasoning-iteration cap). There is **no**
`sn_aia.max_iterations` property. Short-term context is auto-summarised by the platform
(`sn_aia.context_sharing_strategy = summarise`, a strategy property, not a per-agent field). See
`servicenow-ai-system-properties.md` for the full property table.

---

## 2. Reasoning elicitation (pointers, not restatement)

The quality of the ReAct **Thought** step is governed entirely by the agent instruction text. The
techniques below are owned by sibling docs — open the linked owner rather than re-learning them here:

| Technique | What it does | Canonical owner |
|---|---|---|
| **Zero-shot CoT / step-by-step phrasing** | A short trigger phrase ("walk through… step by step", "think through… before…") surfaces latent reasoning without per-task examples; maps directly to agent instructions. | `skills/agent-prompt-writer/SKILL.md` **Step 3g** (shipped via #86) |
| **Anti-reasoning phrase audit** | Catches "just classify", "be brief", "don't overthink" — phrasing that suppresses the Thought step. | **#87** |
| **Two-stage reason→extract** | Reason in prose first, emit the structured result (JSON / field write) as a separate final step, because reasoning and formatting degrade when forced into one step. | **#88** |

**Worked pointer — major-incident summarization (ITSM).** Replace an imperative instruction with a
*process* instruction so the Thought step does real work before the output:

> "Before producing the summary, walk through each work note entry in order and note what changed
> at each step. Then, as a separate final step, emit the summary in the required format."

That is the whole shape: reason step-by-step over the inputs, *then* produce output. For the full
imperative-vs-process pattern table and where to place the trigger, see `agent-prompt-writer` Step 3g.

---

## 3. Self-improvement = offline instruction-improvement (recommended)

> **Honest framing — the runtime loop is platform-managed.** Builders arriving from the Reflexion
> literature reach for a developer-controlled runtime **Actor → Evaluator → Self-Reflection** loop.
> That loop **does not exist on ServiceNow**: the ReAct loop is platform-run, and there is **no**
> `u_agent_reflection` table (confirmed, 0 rows) to persist reflections against. The only
> developer-editable runtime bounds are `sn_aia.continuous_tool_execution_limit` (=25, max
> consecutive same-tool calls) and `sn_aia.react_failure_retry_max_limit` (=3). There is **no**
> `sn_aia.max_iterations` property. Do not build a runtime self-edit loop — improve the **instructions**
> offline, under version control.

The supportable, lower-maintenance technique is an **offline instruction-improvement loop** — a
version-controlled developer cycle, not a runtime self-edit:

1. **Deploy** the agent and let it run on real work.
2. **Collect executions** — trajectories land in `sn_aia_execution_plan` / `sn_aia_execution_task`;
   the `sn_aia_execution_plan.run_type` choice includes an `evaluation` value for harness runs.
3. **Evaluate** — run an Agentic Evaluation (LLM-as-judge over the parsed trajectory) via
   `skills/servicenow-ai-evaluation/`.
4. **Read the failing trajectories** — inspect `sn_aia_execution_task` (each step carries a literal
   `"Thought"` key) and/or the MCP `servicenow_aia_trace` tool. There is no "Reasoning Trace Audit"
   UI feature.
5. **Derive a lesson** from the failure cluster and **edit the instructions** on `sn_aia_agent` /
   the Fluent `AiAgent` in `src/`.
6. **Rebuild + reinstall** (`now-sdk build && now-sdk install`).
7. **Re-evaluate** and compare against the prior instruction version.

### Evaluator-signal selection (read before trusting any metric)

Prefer **high-signal, low-noise** metrics.

> ⚠️ **A noisy judge metric drives *negative* improvement.** If the evaluator's signal is unreliable,
> the loop bakes the *wrong* lesson into the instructions and the agent gets worse with each
> iteration while the metric says it is improving. Ground every LLM-judge metric with a
> **deterministic sub-check** against what ServiceNow already knows — taxonomy (category/subcategory)
> pairs, `sys_id` validity, assignment-group membership — so the judge cannot reward a hallucinated
> success.

**Different-model judge.** The judge capability can use a **different model** than the agent under
test: model selection is **per One Extend capability** (`sys_one_extend_capability`, bound at the
capability-definition layer). There is **no** instance-wide `sn_aia.agent_llm_provider` property.

### Two worked ITSM examples

**(a) Incident-triage re-classification.** Signal: on resolved incidents, compare the agent's
proposed `category`/`subcategory` against the **human-corrected** value at close. Cluster the
mismatches, derive the misclassification pattern (e.g. "VPN issues routed to Network instead of
Access"), and fold a disambiguation rule into the `AiAgent` triage instructions. Re-evaluate against
the next batch of resolved incidents.

**(b) Change-risk re-calibration.** Signal: use the **PIR (post-implementation review) outcome** as
a low-noise label — a successful, no-incident change that the agent scored high-risk (or a failed
change it scored low-risk) is a calibration error. Refine the risk-reasoning instructions on the
`AiAgent` so its risk rationale weights the factors PIR outcomes actually correlate with.

### Memory (optional)

`sn_aia_memory` is real and populated (plain text, no vectors); `memory_scope` is set **per
`sn_aia_team_member`** (choices: agent/private/global). It can carry running "lessons learned" across
runs, but the full STM/LTM/episodic mapping is owned by **#95** — defer the taxonomy there.

### Convergence / stopping

Track instruction versions in **git**. Stop iterating when the judge metric **plateaus**. Flag the
agent for **human review** if successive derived lessons start repeating (the loop is chasing noise,
or the remaining errors are not instruction-fixable). Any automated "semantic repeat" detector for
that last check is **(confirm on instance during build)**.

> **(confirm on instance during build)** — the specific Agentic Evaluation **table/field schema**
> (eval-score / justification / trajectory column names, the exact `run_type=evaluation` choice
> value, and any instance row counts) is **not** in the verified-facts set. Confirm it live before
> relying on it; do not carry over table/column names from prior drafts or marketing names.

---

## 4. Verification Architecture (Generate-then-Verify)

**Principle: never let an agent write to a record of authority on its first inference — propose,
verify, gate.** Generation and verification are different jobs and should be separated
architecturally. The agent that *proposes* a category, assignment, or field value is not the leg
that should *confirm* it. Reserve a verifier slot before every write-of-authority.

### The three verifier implementation options

**A. Deterministic — a Now Assist Script tool (`sn_aia_tool`).**
The highest-value, most ServiceNow-specific leg. The deterministic verifier is a Now Assist
**Script tool**, **NOT a Script Include** — tool scripts are ES5/Rhino, public cross-scope callable,
stateless, follow the `sn_aia_tool` inputs / `outputs.result` contract, and run under a ~298s sync
execution cancel limit. Per `context/tool-script-rules.md` **Rule 2** the script MUST use
`GlideRecordSecure` (field-level ACLs) **with** `addUserEncodedQuery()` (row-level ACLs) — both
together, never one without the other.

> **Outsource what ServiceNow already knows to deterministic tools.** Don't ask the LLM to
> hallucinate facts the platform can answer authoritatively. Use the Script tool to validate
> `sys_id`s, taxonomy pairs (category/subcategory), CMDB CIs, and assignment-group membership
> against the live tables. The LLM proposes; the deterministic tool confirms against the system
> of record.

**B. Critic agent — `sn_aia_agent_child` / different-model judge.**
A second agent that scores the generator's proposal with evidence grounding, realized as a
`sn_aia_agent_child` supervisor→child mapping. (Coordinate the evidence-grounding leg with **#89**
Evidence Gates to de-dupe.)

*(a) When to use.* Reserve a critic agent when **failure cost > inference cost** — i.e. the output
is a hard-to-reverse write of authority. Worked examples: generated code committed to a production
agent or table; change-risk classifications that *route* (auto-approve vs CAB); a KB draft about to
enter a KCS publish queue; any field write that downstream automation trusts. If the action is cheap
to undo, the extra LLM call rarely earns its place — prefer the deterministic check (option A).

*(b) Bind a different model to the critic.* Model selection is **per One Extend capability
definition** (`sys_one_extend_capability_definition.connection`, a GenAI alias such as
`sn_generative_ai.Now_LLM` / `sn_azure_openai.Azure_OpenAI` / `sn_openai.OpenAI`) —
`sys_one_extend_capability` itself has no model field, and there is **no** instance-wide
`sn_aia.agent_llm_provider` property. Two agents that invoke **different capabilities** therefore run
on **different models**; the `capabilityId` in the invocation envelope selects the model-bound
capability. The exact capability-config UI path and the exact envelope field names are
**(confirm on instance during build)**. The server-side invocation envelope itself is already
documented in `context/now-assist-platform.md` (endpoint `/api/now/v1/oneextend/scripted/setup_and_execute`,
`{ executionRequests: [{ capabilityId, payload }] }`) — assemble it, don't reinvent it.

*(c) Topology.* The critic is a `sn_aia_agent_child` of the generator (topology: `sn_aia_usecase` →
one `team` (`sn_aia_team`) → flat `sn_aia_team_member` peers, no order field → `sn_aia_agent`, with
`sn_aia_agent_child` as the explicit supervisor→child mechanism). There is **no**
`sn_aia_usecase.orchestrator_agent` field. Gate the generator's write behind the critic with
`execution_mode = copilot` (Supervised) + HITL before the write-of-authority — there is **no**
"Approval Policies" table/field.

*(d) Copyable critic instruction (find-flaws-only reviewer):*
```
You are a critic. You DO NOT produce or rewrite the answer — you only judge the proposal below.
Check it against the provided evidence and the task requirements. Find flaws; do not restate what
is correct; do not propose alternative content.
Respond in exactly one of two forms:
  PASS — <one-line justification>
  FAIL — <specific problem 1>; <specific problem 2>; ...
If any required fact is unverifiable from the evidence given, respond FAIL.
```

*(e) Same-model fallback.* When no second model is provisioned, run the critic on the **same** model
with adversarial / elevated instructions (the find-flaws-only framing above). The instruction
difference alone yields partial benefit — it is explicitly a **fallback**, not the target state; a
genuinely different model remains preferable because it breaks shared blind spots.

*(f) Deterministic companion (optional).* Pair the critic with a `GlideRecordSecure` Script tool
(`sn_aia_tool`) that outsources authoritative checks to what ServiceNow already knows — `sys_id`
validity, taxonomy (category/subcategory) pairs, CMDB CIs, assignment-group membership. The LLM
critic judges reasoning; the deterministic tool confirms facts. See option A above.

**C. Offline — Agentic Evaluations.**
Run evaluations against historical records before promotion (Now Assist Skill Kit > Agentic
Evaluations). This is the schema-real offline leg conceptually, but **(confirm on instance during
build)**: the specific evaluation table/field schema — table names, eval-score / justification /
trajectory fields, the `sn_aia_execution_plan.run_type=evaluation` choice value, and any eval-row
counts — is **not** in the verified-facts set. Frame it as **schema-to-confirm and operationally
unexercised**, not a turnkey demo.

### The runtime gate

The native runtime checkpoint for write-of-authority actions is **`execution_mode = copilot`
(Supervised) + human-in-the-loop (HITL)**. Verified: `execution_mode` exists with a
`copilot`/Supervised value and HITL gating. **(confirm on instance during build)** the exact field
metadata — label string, `default_value`, the `autopilot`/Autonomous choice mapping, and per-tool
override behavior. There is **no** `Approval Policies` / gate / confirmation table or field in
`sn_aia` (no gating field on `sn_aia_tool`).

**AI Control Tower** is real but is **asset-level governance only** — AI-asset / lifecycle /
inventory / asset-approval governance — **not** a per-execution record-write gate. Its specific
governance table family, table count, and asset-approval-request table/label are **(confirm on
instance during build)**.

**Debugging / trace surface** for a proposal+verify run: `sn_aia_execution_plan` /
`sn_aia_execution_task` (steps carry a literal `"Thought"` key) plus the MCP `servicenow_aia_trace`
tool. There is no "Reasoning Trace Audit" UI feature.

### Worked example — incident triage

1. **Propose.** The generator agent reasons over the incident and proposes a category and an
   assignment group (reasoning step-by-step first, per §2).
2. **Verify (deterministic Script tool).** A Now Assist Script tool — `GlideRecordSecure` +
   `addUserEncodedQuery()` — validates the proposal against what ServiceNow already knows: confirm
   the assignment group exists and is active and staffed, and confirm the affected CI resolves
   against the CMDB. The tool returns pass/fail via `outputs.result`; it does not write.
3. **Gate.** With `execution_mode = copilot` (Supervised), the validated proposal is surfaced to a
   human for HITL confirmation **before** the write commits to the incident record.

Loop bounds throughout are platform-managed (`react_failure_retry_max_limit = 3`; developer-editable
`continuous_tool_execution_limit = 25`; no `max_iterations`).

---

## 5. Memory → see #95

Short-term / long-term / episodic memory mapping (how STM auto-summary, work notes, and any
durable-memory tables fit together) is owned by **#95**. Not documented here — open #95. (Stub
reference.)

---

## References

- **#107** — keystone doc-correctness ticket; OWNS all `sn_aia` property / topology / API doc fixes.
- **#83** — Generate-then-Verify / Verification Architecture (§ Verification Architecture in this file; not yet written).
- `servicenow-ai-system-properties.md` — `sn_aia` loop-bound and context properties (defaults vs instance values).
- **#95** — memory architecture mapping (STM / LTM / episodic).
- **#86** (closed) — zero-shot CoT triggers in `agent-prompt-writer` Step 3g.
- **#87** — anti-reasoning phrase audit.
- **#88** — two-stage reason→extract prompting.
- `skills/agent-prompt-writer/SKILL.md` — agent instruction authoring (Step 3g: reasoning elicitation).
- `skills/agentic-workflow-builder/SKILL.md` — multi-agent architecture design.

---

*Reasoning-elicitation index for ServiceNow Now Assist agents. Platform facts live-verified against
Zurich Patch 8; anything not verified is marked "(confirm on instance during build)".*
