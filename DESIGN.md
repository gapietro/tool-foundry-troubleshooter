# DESIGN.md — Harness Strategy Spar Record

**Date:** 2026-07-30 · **Method:** design-spar (adversarial review, pre-build)
**Scope:** Decision 0.5 (harness strategy) and its load-bearing subsystems. Companions: `docs/LOW_LEVEL_DESIGN.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ARCHITECTURE_DECISIONS.md` — this file records what the spar *changed or confirmed*; the companions hold the full design.

---

## 1. Decision confirmed: Option A — tools-first, benchmark-gated

Alternatives re-examined and rejected:

- **B — custom harness first, native never.** Rejected: costs weeks before learning whether the native harness would have sufficed; sole ownership of every orchestration bug; NASK invocation is reverse-engineered and could break on a customer patch with no fallback harness.
- **C — deterministic pipeline only (no agent).** Rejected as the *whole* product: caps diagnostic depth at pre-coded signatures, in a product whose value is finding unanticipated root causes. **Adopted as a component** — see change #1.

**The real rationale for A (write this down, say it this way):** the compliance rule (no external AI on customer instances; governed LLM via GenAI Controller only) eliminates external tooling like Claude Code — it does **not** discriminate between A, B, and C, which are all in-instance and governed. What discriminates is **cost of being wrong**: A costs days and produces a scorecard that measures the actual doubt (Studio's harness is workflow-shaped — steps and supervised handoffs — not built for open-ended sense-decide-act investigation loops). Native-first is not "native is right"; it is "native is **cheap to falsify**." Under A the load-bearing component is the **benchmark**, not Agent Doctor.

---

## 2. Design changes from the spar

### 2.1 Promote the Evidence Bundle collector to Phase 1a (harness-agnostic core)

**Found:** `mode: "collect"` lived behind the custom harness's REST API — which is gate-contingent. In pure Option-A world the "Evidence Bundle floor" did not exist; the fallback was manual table archaeology (the K26 runbook by hand — the pre-product baseline).
**Change:** a runner Script Include (working name `PaEvidenceCollector`) that executes the tool cores in fixed playbook order — trace → config → GenAI log → schema/data → wiring — anchors an `x_snc_troubleshoot_run` (this clause originally said `x_pa_run` — a name the platform rejects; superseded by R-13, and LLD §3 is the authority), stores outputs via PaArtifactStore. No LLM, no harness. Invoked via background script / UI action by an admin.
**This one component is also:**
- the **doctor-down detector**: Agent Doctor silent → run collector. Bundle produced ⇒ tables readable, LLM path is the broken thing (itself a diagnosis). Collector also fails ⇒ cross-scope/ACL problem. Every outcome informative.
- the **benchmark de-risker**: run it against each seed before scoring — separates "tools can't see the defect" from "agent can't reason to it."

### 2.2 Verify + tune the platform tool budget before benchmark day

**Found:** the first ceiling a 12–15-call diagnostic sweep hits is **not** the 128K context window (PaArtifactStore's 4KB excerpts/pages defuse it — ~1K tokens per call) — it is the platform's autonomous tool budget: `sn_aia.continuous_tool_execution_limit` + per-m2m `max_auto_executions`, sized for 3-tool workflow agents, not 15-call investigators. Failure mode may be a silent supervision stall, not an error.
**Change:** verify both values on keynexus01, set `max_auto_executions` deliberately for all 7 tools, record the values in the benchmark protocol. LLD §8 verify item.

### 2.3 Scorecard records cause-of-death per run

**Found:** a 0-point run that died at the tool-call limit and a 0-point run that reasoned badly are *opposite* verdicts on the gate ("raise the limit and re-run" vs. "build the custom harness") — the current scorecard can't tell them apart.
**Change:** add a terminal-cause field to every scored run: `completed | tool_limit | context | supervision_stall | security | wandered | genai_down`. Gate interpretation must consider cause-of-death distribution, not just points.

### 2.4 Time-window run-anchor keying is disqualified for scored runs

**Found:** PaRunAnchor's fallback ("one anchor per user per 30 min") glues benchmark run 2 (fresh conversation, 20 min later) onto run 1's `x_pa_run`: interleaved artifacts/audit, contaminated scorecard — and run 2 can `read_artifact` into run 1's evidence, breaking the blind-runs independence the doubled-run protocol exists to measure.
**Change:** scored runs require a hard per-conversation key. LLD open item 5 (what identifiers a script tool sees at runtime) is **benchmark-blocking**. If no native per-conversation identifier exists: key on the doctor's own `sn_aia_execution_plan` sys_id (fresh per conversation) or an explicit tester-passed run token. Never time-window keying where run identity matters.

### 2.5 Known ceiling, accepted: doctor/patient indistinguishability in-chat

When Agent Doctor's own LLM path fails, the user sees the same generic "Sorry, there was a problem" the patient produced. The Claude-Code-style live progress feed the product wants is a property of the harness, which Option A does not own. Mitigation = 2.1 (collector as canary) + benchmark scores "failure behavior" as a gate input. A custom-harness build (if gated in) owns this UX fully.

---

## 3. Standing verification items elevated by this spar

| Item | Was | Now |
|---|---|---|
| LLD §8.5 — runtime identifiers available to script tools | ⚠ VERIFY | **benchmark-blocking** (change 2.4) |
| `sn_aia.continuous_tool_execution_limit`, `max_auto_executions` values | implicit | explicit pre-benchmark verify + tune (change 2.2) |
| Collector runnable with zero LLM dependency | not specced | Phase 1a acceptance criterion (change 2.1) |

## 4. Rulings during implementation

*(Record deviations from this file here, with justification and the user's ruling.)*

### Phase 0 pre-flight rulings — all dated 2026-07-30

Source of evidence for every ruling below: `docs/PREFLIGHT_FINDINGS.md` (run against keynexus01, 2026-07-30). Each states the finding, then the change it forces.

**R-1 — P4b runtime scoped-read proxy was not executed; §8.4's runtime half is carried forward. (2026-07-30)**
**Found:** the spec §3 P4b proxy (a read-only background script executed *inside* an existing non-global scoped app) could not run: the Foundry MCP toolset contains **no background-script executor**. Six active non-global scoped apps do exist on the instance (`x_snc_sdktest1`, `x_snc_acme_triage`, `x_snc_bstest_42`, `x_snc_pockeysre216`, `x_snc_build_agent`, `x_snc_update_all`), so the proxy *would* have been possible had the tooling existed — this is a tooling gap, not an instance limitation. The probe tool's own `GlideRecordSecure` reads succeeded on all five tables tried, but the probe record landed in `sys_scope: Global`, so those reads do not simulate a restricted `x_pa_*` scope either.
**Change:** LLD §8.4 is **carried forward, not closed**. The static half is closed (no §2 table is `access=none`; none carries a restrictive `caller_access`; **47 standing `sys_scope_privilege` Read grants — among 79 privilege rows total, the rest being 17 Write, 14 Create and 1 Delete — across 8 distinct Read targets** prove the mechanism works in production, though only from first-party scopes, with **no custom `x_*` precedent**). The runtime half becomes an explicit first-build verification: the very first thing the scoped app does after `now-sdk install` is attempt `GlideRecordSecure` reads across the §2 table list from its own scope, before any tool core is written against them. `IMPLEMENTATION_PLAN.md` Task 1 must carry that check.

**DISCHARGED 2026-07-30 — the runtime check was built and run; §8.4 is now CLOSED.** Implemented as LLD §6's `/status`-equivalent readability check: a Scripted REST API inside `x_snc_troubleshoot` (`src/fluent/scope-readability.now.ts`, `GET /api/x_snc_troubleshoot/scope_probe/reads`) attempting `GlideRecordSecure` reads across the §2 list from its own scope. **14 of 15 tables readable; exactly one denied — `syslog`**, the single table P4a had flagged with `caller_access = Caller Restriction`. The static prediction was correct, including about its one exception.

Consequences, split because they differ:

- **For the tool cores: cleared.** Every table `PaToolAgentTrace`, `PaToolAgentConfig`, `PaToolGenAiLog`, `PaToolSchemaLookup` and `PaToolQueryTable` read is available from our own scope with **no privilege grant required**. LLD §6's build approach stands unchanged. This was the falsifier that could have forced the tool cores out of a scoped app; it does not.
- **For `PaToolLogAnalysis`: blocked.** R-12's constraint is now **measured, not predicted**. ⚠ **The remedy this bullet originally prescribed — "add a `sys_scope_privilege` Read grant and re-verify" — was TESTED AND DISPROVED by R-19 (2026-07-31).** The grant installs correctly and `syslog` stays `DENIED`: `caller_access = Caller Restriction` is not satisfied by a self-declared privilege, because an application cannot grant itself access to a caller-restricted table. P4a's "no custom `x_*` precedent among 79 rows" was pointing at this. **Do not spend time re-attempting the grant** — it is declared, correct, and inert. The real paths are an instance-admin action or a different evidence source; see R-19.
- **New build rule for every tool core.** A cross-scope denial throws `ScopeAccessNotGrantedException`, and reading `.message` off it throws a **second** time (`Illegal access to getter method getMessage`), escaping the `catch` and killing the whole request. The first version of this probe did exactly that and returned no per-table detail at all. **Handlers must not touch the exception object.** This is load-bearing: LLD §4's contract that "every empty/denied read is an explicit finding, never a silent nothing" depends on the catch surviving, and the naive implementation does not.
**Two E3 checks join this same in-instance verification list (added 2026-07-30):**
- **`sn_aia_message` role vocabulary** — pre-flight plan Task 10 Step 4 (read `sn_aia_message` for a run we caused and confirm the `role` values against LLD §2.1's `user_profile` / `user` / `agent`) was never performed. Confirm it in-instance.
- **`sn_aia_tools_execution` join field** — could not be established in Phase 0 because the REST read was denied. Confirm the join field from inside the scoped app.
Both tables are inputs to `PaToolAgentTrace` and were, at the time of writing, validated only against the 2026-07-18 archaeology. Per **R-8**, the REST denial on `sn_aia_tools_execution` proves nothing about in-tool readability — it read fine via `GlideRecordSecure` from inside the probe — so these were unfinished checks, not suspected limitations. **Both CLOSED 2026-07-30 by R-15**, against a run we caused: the join field is `execution_plan_id` (there is no `execution_plan` field, confirmed by exclusion) and the observed `role` vocabulary is `agent` / `user_profile` / `user`, matching LLD §2.1.

**R-2 — `_agentic_context_.conversation_id` is a real per-conversation key; time-window anchor keying is dropped from the design entirely. (2026-07-30)**
**Found:** a script tool receives an undocumented global `_agentic_context_` — a **JSON string**, not an object — carrying `agent_id`, `conversation_id`, `usecase_id`, `execution_plan_id`. The `conversation_id` was identical across all 19 calls of the E2 conversation and matches `sn_aia_execution_plan.conversation`. `gs.getSessionID()` returns the literal `"SYSTEM"`, so anything keyed on session ID would collide across conversations.
**Change:** §2.4 above is superseded in its remedy, not its reasoning. §2.4 disqualified time-window keying *for scored runs* and named two fallbacks — the doctor's own `sn_aia_execution_plan` sys_id, or a tester-passed run token. **Neither fallback is needed, and time-window keying is now removed from the design entirely, not merely disqualified for scored runs.** `PaRunAnchor` keys on `_agentic_context_.conversation_id`, with `execution_plan_id` available as a second, finer-grained key. The design carries no time-window path at all, so it cannot be reached by accident.
**Provisionality, stated because it is load-bearing:** this was obtained via the API path (`servicenow_aia_execute`), **not** the Now Assist panel, because no Now Assist product plugin is active on keynexus01 (see R-11). The panel is the production path. `_agentic_context_` is also undocumented and therefore not contractually stable across upgrades. Both facts must be re-confirmed on the panel path before the benchmark; until then this closure is API-path-provisional.

**R-3 — E2 endurance passed at 19 calls; the sweep fits. The ReAct loop also executes concurrently. (2026-07-30)**
**Found:** the probe agent executed **19 tool calls in a single conversation** (4 with no `layer` value + layers 1–15 each exactly once) against a request for 15, finishing `state=Completed` with empty `state_reason` in 51s wall clock. Cause-of-death under the §2.3 vocabulary: **`completed`**. The stop was not a cap — the m2m `max_auto_executions` was 20 and the instance property is 25.
**Change:** the load-bearing assumption behind Option A survives, and §5 of the pre-flight spec puts this on the "all 15 complete cleanly" row: proceed to Task 1 with the budget values recorded. **What this does not mean:** it is one assumption surviving, not the benchmark being won. The Task 12 gate in `IMPLEMENTATION_PLAN.md` is unchanged, and E2 removes only the "the native loop cannot sustain a 12–15-call sweep" pre-emption that spec §8 allowed to enter the gate ahead of any scored run. That pre-emption does not apply. Two caveats travel with it: 19 is close to the 20 attachment cap, so a sweep that grows past ~15 calls must be re-tested rather than extrapolated; and this ran through the API path, not the panel.
**Concurrency discovery (unplanned):** the 19 calls arrived in **six timestamp batches of up to 4 concurrent calls**, not 19 sequential reason-act rounds. Two consequences. (a) Latency is far better than a sequential model predicts. (b) The ordered seven-layer sweep is **less enforceable than the LLD assumed**: `AGENT_DOCTOR_ARCHITECTURE.md` §3's "playbook order is *suggested* via instructions, not enforced" is correct, but for a stronger reason — the harness issues several probes in one batch *before seeing any result*, so a probe cannot consume an earlier probe's output within a batch. Any tool whose input depends on a prior tool's finding must either be designed to tolerate that input being absent, or the dependency must be made explicit and sequential in the instructions. `PaEvidenceCollector` (§2.1) is unaffected — it runs the cores in fixed order with no LLM — which strengthens the case for it as the ordering-guaranteed path.

**AMENDED 2026-07-30 (cross-instance run on gpinst01) — the headline of this ruling was too narrow.** The same probe, same prompt, same request for 15 calls, executed **5 tool calls** on gpinst01 and finished `state=Completed` with empty `state_reason` in 64s. Task tree: 1 Access Verification · 1 Agent · 4 Gen AI reasoning turns · 5 Tool, all `Success`. `max_auto_executions` was 20 and the instance property 25 — **nothing was capped**, exactly as on keynexus01.

So the difference between 19 and 5 is **instruction adherence, not harness capacity**. Three consequences, all sharper than the original ruling:

1. **The binding constraint on a 12–15 call sweep is not the loop budget.** keynexus01 established that the harness *permits* a long sweep. gpinst01 establishes that permitting one does not make the agent *perform* one. Designing to the budget ceiling addresses the wrong risk.
2. **Premature completion is harder to detect than exhaustion.** Budget exhaustion surfaces as `tool_limit` in the §2.3 cause-of-death taxonomy. Stopping early after five probes surfaces as **`completed`** — indistinguishable from a genuine finish. An Agent Doctor that skips four of seven diagnostic layers and emits a confident Fix Report fails *less visibly* than one that runs out of budget, which makes it the more dangerous mode.
3. **The benchmark needs a completeness measure, not only a correctness score.** The 6-point rubric scores whether the root cause was found. It must also record **how many layers were actually swept**, or a lucky shallow run scores identically to a thorough one. This is a new requirement on `IMPLEMENTATION_PLAN.md` Task 11.

Stated plainly: these are **single samples per instance**. The qualitative finding — "completed" does not mean "swept" — is solid and design-relevant. The 19-vs-5 numbers are not a stable per-instance rate and must not be quoted as one. The doubled-run blind protocol exists for exactly this reason.

**R-4 — Benchmark transferability is a BINDING constraint on the scorecard, not a caveat. (2026-07-30)**
**Found:** spec §6 requires that the OOB default of `sn_aia.continuous_tool_execution_limit` be recorded separately from any value we later tune to, because a scorecard produced under a raised ceiling measures a configuration the customer does not have. **P2 could not establish the shipped default.** The property reads `25` on keynexus01, with `sys_updated_on` bit-identical to `sys_created_on` (the signature of "never modified after creation") but `sys_updated_by = admin`, not blank. Those two signals point opposite ways and were recorded unresolved rather than reconciled. The OOB default is therefore **genuinely unknown**, not "25". (The separate dictionary default of `10` for `sn_aia_agent_tool_m2m.max_auto_executions` is a *different knob* — per-binding, not instance-wide — and is not a substitute for it.)
**Change, binding on `IMPLEMENTATION_PLAN.md` Tasks 11–12:** every scored run's scorecard row **must record BOTH budget knobs that run executed under** — the instance property `sn_aia.continuous_tool_execution_limit` **and** the per-binding `sn_aia_agent_tool_m2m.max_auto_executions` for each attached tool — read at run time, not assumed. §2.2 names both; recording only the property would leave the binding invisible, and the binding is not a lesser knob: **E2's 19-call result was reachable only because the probe's `max_auto_executions` was set to 20, against an instance-typical 10** (477 of 483 production rows sit at the dictionary default). A scorecard produced at 20 measures a configuration a default-configured customer does not have, exactly as a raised property ceiling would. If either value differs from the instance-typical value or from the shipped/dictionary default, `benchmark/DECISION.md` must state so explicitly and say what the difference is. Because the OOB default is unknown, `benchmark/DECISION.md` must additionally state that it is unknown and that transferability to a default-configured customer instance is therefore **unverified** — it may not silently treat `25` as the default. Establishing the true shipped default (fresh instance, release notes, or ServiceNow docs) is a prerequisite for any transferability claim. Filed as a ruling now specifically so it survives the Phase 0 → Phase 1a boundary.

**R-5 — Two corrections to the LLD §4.7 script-tool contract, plus one probe defect that produced the most valuable finding of Phase 0. (2026-07-30)**
**Found:** established by three failed probe executions before a clean one. Items 2 and 3 are genuine gaps in our own documented contract, not platform limitations. **Item 1 is not** — it was a defect in the probe script, which deviated from a document that was already correct.
1. `input_schema` is an **ARRAY**, `[{"name":…,"description":…,"mandatory":…}]` — **not** a JSON Schema object. **Attribution corrected:** LLD §2.2 (lines 62–65) and §4.7 (line 247) **already document the array format correctly, and already label it the verified live format**. The probe supplied a JSON-Schema object in deviation from our own correct spec; the LLD needs no change here. **The finding itself stands, undiminished:** supplying a JSON-Schema object causes a **silent non-terminating stall** — the execution hangs in `In progress` forever (`AiAgentBaseDao: TypeError: The object is not a string`, then `AgentReActUtil: Cannot find function filter in object`) instead of raising an error. That is a platform behaviour, it is the single most expensive defect found in Phase 0, and it is exactly why the array format must be enforced by the adapter template rather than left to whoever writes the next tool.
2. **There is no `outputs` object.** The signature is `(function(inputs) { … return result; })(inputs)`. Referencing `outputs` throws `ReferenceError: "outputs" is not defined` and terminates the run.
3. Execution scope is **`rhino.global`**, and `gs.getSessionID()` returns the literal **`"SYSTEM"`**.
**Change:** LLD §4.7 (`PaScriptToolAdapter`) must be corrected for items **2 and 3** before any of the 7 tool cores is written; item 1 needs no LLD change, only enforcement. The adapter's own template must embody all three facts. ⚠ **This clause originally ended "Correcting the LLD body is a separate, not-yet-taken decision" — and it stayed untaken for three weeks, which is exactly how R-18 found it. DISCHARGED 2026-07-30 by R-18b:** §4.7 now carries all six corrections (no `outputs` object, self-invoking IIFE with the required trailing `(inputs)`, `rhino.global` scope, bare-string pass-through, `input_schema` as an ARRAY, R-9 absent-input tolerance), and the §4 contract line was widened to `Object | String` to stop contradicting them.

**R-6 — Two naming defects in the design docs; a tool written to the documented names fails. (Item 3 withdrawn — see below.) (2026-07-30)**
**Found:** two places where the docs name something that does not exist on the instance. A third, originally filed as a naming defect, did not survive verification and is re-sourced as a platform behaviour finding.
1. **`sys_log` → `syslog`.** `docs/LOW_LEVEL_DESIGN.md` (§2 area, lines ~96, ~112 and §4.4 ~221) and `docs/AGENT_DOCTOR_ARCHITECTURE.md` (lines ~63, ~87) name the system log table `sys_log`. **That table does not exist on keynexus01** — a direct `sys_db_object` query for `name=sys_log` returns zero rows. The real table is `syslog`. The docs are already internally inconsistent: LLD line ~102 and ~221 both cite `syslog.filter` as the sanctioned pattern in the same breath as the wrong name. `PaToolLogAnalysis` written to the documented name fails outright.
2. **`sn_aia_admin` → `sn_aia.admin`.** LLD §1 (line ~22) cites the role as `sn_aia_admin`; the instance's real role is **`sn_aia.admin`** (dot-separated), alongside `sn_aia.viewer`.
3. ~~**`sn_aia_execution_task` field names.**~~ **WITHDRAWN as a docs defect — re-sourced as a platform behaviour finding.** The original claim was that LLD §2.1 names `state`, `task_type` and `agent` on `sn_aia_execution_task`. **It does not.** LLD §2.1 (line 48, unchanged since 354a8ce) already documents `type` and `status` and lists no `agent` field, and the string `task_type` appears nowhere in this repo. What actually happened is that the E3 probe queried `state`/`task_type`/`agent` — field names that do not exist — and the query returned rows with those fields silently absent. The real and still-valuable finding is that **`servicenow_query` returns rows with non-existent fields omitted rather than erroring**, so a tool querying a wrong field name looks like an empty result rather than a bug. That silent-miss behaviour stands and must be designed for in `PaToolAgentTrace` (assert on field presence, do not infer "no data" from an absent field). No LLD correction is required for this item — the LLD text is already correct.
**Change:** items 1 and 2 must be corrected in `docs/LOW_LEVEL_DESIGN.md` and `docs/AGENT_DOCTOR_ARCHITECTURE.md` before the affected tools are built.

**Status (updated 2026-07-30):** **`docs/LOW_LEVEL_DESIGN.md` is CORRECTED.** All five `sys_log` references (§2.5 ~96, ~102, the symptom table ~112, §4.4 ~221, and the §8 item-4 disposition) now read `syslog`, and both `sn_aia_admin` references in §1 ~22 now read `sn_aia.admin`. Each site carries a short note pointing back to this ruling. Verified no collateral damage: `sys_gen_ai_log_metadata` and `sys_generative_ai_log` are unaffected, since neither contains `sys_log` as a substring. **`docs/AGENT_DOCTOR_ARCHITECTURE.md` is now CORRECTED too (2026-07-30)** — its §2 table list (~63) and §4 tool roster (~87) both read `syslog`. **`docs/IMPLEMENTATION_PLAN.md` is also CORRECTED (2026-07-30)** — the two prose references to the K26 syslog scoping rule (Task list item 8, ~66, and the `PaToolLogAnalysis` task, ~129) both read `syslog`. **No file remains outstanding on item 1.** Collateral damage re-verified after these edits: `sys_gen_ai_log_metadata`, `sys_generative_ai_log` and `sys_gen_ai_usage_log` are untouched — none contains `sys_log` as a substring. The only remaining occurrences of the literal `sys_log` anywhere in the repo are historical records of the defect itself (this ruling, and `docs/PREFLIGHT_FINDINGS.md`'s P4 evidence), which are deliberately preserved. Item 3 needs no correction: the LLD text it accused was already right. Two related facts to fold in at the same time: `sn_aia_execution_task`'s per-step timings (`execution_time_ms`, `start_time`/`end_time`) are referred to in LLD §2.1 only as the collective "timings" and should be named explicitly, since the `latency_flags[]` feature reads them (the other fields the trace tool wants — `parent`, `order`, `output`, `metadata`, `og_task_id`, `task_dependencies` — are already named there); and **execution tasks are not 1:1 with tool calls** (27 task rows for 19 tool calls), so `PaToolAgentTrace` must not assume that mapping.

**R-7 — `context_processing_script` is auto-populated; LLD §5's "keep ours empty" is unachievable by omission. (2026-07-30)**
**Found:** LLD §5 record 17 instructs "no custom `context_processing_script` (verified failure vector — keep ours empty)". Creating an `sn_aia_agent` with the field simply omitted did **not** leave it empty — the platform populated it with a default template script. `applicability_script` was likewise auto-populated, with a body ending in `return false;`. This matters because the instance's known reference failure (`78f347b7…`, LLD §1) has its root cause in a `context_processing_script` throwing at line 61 — i.e. the exact field class we intended to avoid arrives populated by default.
**Change:** LLD §5's instruction is not implementable as written and must be restated: the field must be **explicitly cleared after creation** if an empty value is genuinely wanted, and the Foundry automation that creates the agent record set must do that clearing and verify it. "Omit the field" is not a control. Also worth folding into the design: the auto-populated script's own signature documents that `task`, `user_utterance`, `agent_id` and `context` (`pageContext`, `triggerContext`) are available at that hook — a different and better-documented surface than the script-tool runtime context of R-2.

**AMENDED 2026-07-31 (gpinst01, Task 10, issue #24) — HALF-REFUTED, and the field lives on the wrong record in LLD §5.** Building the real Agent Doctor `sn_aia_agent` on Fluent and reading the installed record back split this ruling's two auto-population claims. `applicability_script` — the **dangerous** half, the claim that auto-populated bodies end in `return false;` and silently suppress the agent — came back **EMPTY**. That half is **refuted**. `context_processing_script` came back **auto-populated at 2,124 characters** of platform boilerplate: a comment block followed by a no-op pass-through returning `{ pageContext: context?.pageContext, triggerContext: context?.triggerContext }`. That half — that Fluent omission does not leave the field empty — is **confirmed**. It was deliberately **left uncleared**: clearing an unverified field immediately before the one test that had to work would have put three candidate causes (agent broken / anchor broken / cleared context) behind any failed smoke test, with no way to attribute the failure. That script is also what forwards context into the agent — `PaRunAnchor` keys every run on `_agentic_context_.conversation_id` — so test first, decide after. The smoke test then **passed** with the boilerplate in place, `_agentic_context_` propagation included (16 audit rows resolved to one run). It remains uncleared and the question is **OPEN**, with a follow-up filed to decide whether to clear it now that a passing baseline exists. **Note for LLD §5 row 17:** the populated field was found on **`sn_aia_agent`**, not on `sn_aia_usecase`, which is where row 17 places it — this branch built no usecase at all, so row 17's own subject does not yet exist on the instance.

**R-8 — MCP reconnaissance understates in-instance access; REST denial is not an ACL denial. (2026-07-30)**
**Found:** `sn_aia_tools_execution` reads **OK** via `GlideRecordSecure` from inside the running script tool, but is **denied to the same admin user over the REST API** (`servicenow_query` → "Access denied: Insufficient rights to query records"). The denial is an API-layer restriction, not a table ACL.
**Change, methodological and binding on the remaining verification items:** an MCP/REST probe result may **not** be used as a proxy for what an in-instance tool can read. A REST denial is evidence of nothing about tool-runtime access and must be re-tested in-instance before any capability is written off. This cuts both ways: it is an argument *for* the in-instance design (the tools can see more than the recon suggested), and a caution that Phase 0's read-only reconnaissance systematically **understates** available access. Any Phase 1a decision that turns on "table X is unreadable" must cite an in-instance test, not an MCP result.

**R-9 — Declared tool inputs are not reliably passed; tolerant input parsing is load-bearing, not defensive. (2026-07-30)**
**Found:** in every probe run the agent logged `inputs: {}` — it never passed the declared `layer` value, despite an explicit instruction to pass it, a correctly declared `layer` input in the schema, and its own reasoning text asserting *"calling pa_probe_context once with layer set to \"1\""*. The model said it was passing the value and did not.
**Change:** LLD §4.7's "tolerant input parsing" requirement is promoted from a robustness nicety to a hard correctness requirement: **every tool core must behave correctly when every declared input is absent**, and must not report an error that a diagnostician would read as a platform fault when it is simply a missing input. This is empirical, not anticipatory.

**R-10 — `PaToolGenAiLog` cannot surface raw prompt/response for a non-admin caller. (2026-07-30)**
**Found:** the prompt/response payload lives in `sys_generative_ai_log` (`prompt`, `response`), **not** in the `sys_gen_ai_log_metadata` / `sys_gen_ai_metadata_document` tables the LLD names. Its read ACLs grant only `sn_na_analytics.ai_engmt_viewer`, `maint` and `admin`. The AI-Agent role set a customer administrator actually holds — `sn_aia.admin` / `sn_aia.viewer` — is **absent from every read ACL on that table**, though it does grant read on the metadata table.
**Change:** this is a real capability limit on 1 of the 7 Phase 1a tools, and must be specified rather than discovered at demo time. `PaToolGenAiLog` must (a) read `sys_generative_ai_log.prompt`/`.response` as its payload source, (b) **degrade explicitly** when the caller lacks the role — returning a stated "payload not readable under caller's roles; metadata only" result rather than an empty or ambiguous one — and (c) have that degradation documented in `HANDOFF.md` as a customer-side prerequisite (`maint` or equivalent grant) rather than a bug.

**R-11 — ~~No Now Assist product plugin on keynexus01: a blocking provisioning gap, and the reason several Phase 0 closures are provisional.~~ RETRACTED 2026-07-30 — the finding was an instrument error. (2026-07-30)**

> **RETRACTED 2026-07-30.** The ruling below is **wrong** and must not be acted on. The ruling number and its original text are kept, unrenumbered, so the record of what was believed survives. What is actually true, what the ruling claimed, and why the probe misled are all stated here.
>
> **What is actually true (verified 2026-07-30 on gpinst01 via `sys_scope`):** the Now Assist product plugins **are installed and active**. A `sys_scope` query returned 60 rows (the limit was reached, so there are likely more), including `sn_itsm_aia` — "IT Service Management AI agent collection" v9.1.1, active; `sn_csm_gen_ai` — "Now Assist for Customer Service Management (CSM)" v13.0.3, active; `sn_fsm_gen_ai` — "Now Assist for Field Service Management (FSM)" v10.0.1, active; `sn_ex_gen_ai` — "Now Assist for Employee Experience" v4.3.2, active; `sn_km_gen_ai` — "Now Assist in Knowledge Management" v30.10.3, active; `sn_nowassist_va` — "Now Assist in Virtual Agent" v19.0.10, active; `sn_na_center` — "Now Assist Center" v4.0.2, active; `sn_nowassist_admin` — "Now Assist Admin Console" v10.0.12, active; plus roughly fifty more Now Assist scopes.
>
> **Why the probe was wrong — the part worth keeping.** P1 queried **`v_plugin`**, which returned only a handful of rows because plugin visibility is restricted for this caller. That **partial** result was read as **absence**. This is exactly the failure mode this project's own standards warn against — `AGENT_DOCTOR_ARCHITECTURE.md` §4 requires that "every empty/denied read is an explicit finding, never a silent nothing" — and it is the same trap recorded in the E3 findings, where `servicenow_query` silently omits non-existent fields so a wrong field name looks like an empty result rather than a bug (see **R-6** item 3). The probe committed the error the methodology existed to prevent. **`sys_scope` (installed scoped applications) is the correct instrument; `v_plugin` is not.**
>
> **Consequences of the retraction:** the "blocking provisioning gap" does not exist on gpinst01 — there is nothing to provision there. The Now Assist Panel is not blocked by a missing product plugin. The Phase 0 verdict no longer carries P1 as a blocking row (see `docs/PREFLIGHT_FINDINGS.md` § Verdict); the remaining carried-forward item is the **P4b runtime scoped-read test** (**R-1**). The API-path provisionality noted in **R-2** and **R-3** is *not* thereby discharged: those results were still obtained via `servicenow_aia_execute` rather than the panel, and re-confirmation on the panel path before the benchmark is still required — what changes is that no plugin gap stands in the way of doing so.
>
> **keynexus01 is NOT re-verified.** The keynexus01 P1 result used the same `v_plugin` instrument and is therefore **SUSPECT by the same reasoning**. That instance is not currently connected and has **not** been re-checked. Do not treat keynexus01 as fixed; it must be **re-verified with `sys_scope`** before any claim is made about its plugin state.

*Original ruling text, preserved as retracted:*

~~**Found:** `panel_available: false`. Only `Now Assist Core`, `now-assist-self-service` and the Skill Step Plugin are active — **no** Now Assist **product** plugin (ITSM / HRSD / CSM / SecOps) exists or is active. LLD §1 records that the Now Assist Panel requires ≥1 such plugin. No `sys_properties` entry independently disables the panel; the plugin gap alone is sufficient.~~
~~**Change:** this is an **instance-provisioning task, not a design change**, and it is the one falsification row that landed on the blocking side. Its reach is wider than E1's provisionality: **LLD §7's smoke test and the K26 lab prerequisites both assume panel-based testing**, and neither can run as written until it is fixed. It must be closed before the benchmark, and it is the reason the Phase 0 verdict is **conditional** rather than an unqualified go. Everything Phase 0b established came through `servicenow_aia_execute` — the API path — and carries that qualification.~~

**R-12 — `syslog` carries a restrictive `caller_access`; `PaToolLogAnalysis` needs a resolved access path. (2026-07-30)**
**Found:** of every table examined in Phase 0, exactly one carries a non-default restrictive setting: `syslog` has `caller_access = Caller Restriction` (an explicit departure from the empty/unrestricted dictionary default). All 11 §2 `sn_aia_*`/`sys_gen_ai_*` tables are unrestricted. `syslog` is the data source for `log_analysis` / `PaToolLogAnalysis`, one of exactly 7 Phase 1a tools, and is not on any §2 deferral list.
**Change:** cross-scope reads of `syslog` from the `x_snc_troubleshoot` scope (the finalized name — R-13; this clause originally said `x_pa_*`) must be resolved **at build time, before `PaToolLogAnalysis` is written** — either by confirming a `sys_scope_privilege` Read grant is obtainable, or by adopting a documented fallback. It is not covered by the P4 "scoped_read_viable: likely" verdict, which rests only on the 11 §2 rows.

**RESOLVED 2026-07-31 by R-19 — the first branch was tested and FAILED; the fallback branch is the answer.** The grant was declared as Fluent `CrossScopePrivilege`, installs correctly (verified in `sys_scope_privilege`), and does **not** lift the denial: `caller_access = Caller Restriction` is not satisfied by a self-declared privilege. `PaToolLogAnalysis` needs an instance-admin action or a different evidence path, and should degrade explicitly. This ruling is closed; read R-19 for the measurement and the recommended tool shape.

**R-13 — Scope prefix finalized to `x_snc_troubleshoot`; the placeholder table names were unbuildable, and `IMPLEMENTATION_PLAN.md` is reconciled to the SDK structure. (2026-07-30)**

**Found:** two related drifts, both introduced when the SDK app was scaffolded (cc871d2) and neither noticed at the time.

1. **The table names in every design doc are names the platform would reject.** `docs/LOW_LEVEL_DESIGN.md` §3 deferred the decision explicitly — *"All names below use `x_pa_*` shorthand; finalize at SDK setup"* — and SDK setup then happened without the finalization being made. Verified live on gpinst01: a `sys_db_object` sample of 40 `x_snc_*` tables shows **40 of 40** named `<sys_scope.scope>_<name>`, with no exceptions. Our scope is `x_snc_troubleshoot`, so `x_pa_run` and `x_snc_pa_run` cannot be created from this app at all. The distinction matters: this was not a shorthand awaiting expansion, it was a value that fails at build.
2. **`IMPLEMENTATION_PLAN.md` still described a structure that does not exist** — a hand-rolled `src/instance/**` tree, JSON table definitions, and (Task 10) creating Agent Doctor "on-instance via Foundry's existing use-case automation (~8 API calls)". That last item directly contradicts CLAUDE.md's boundary — *"SDK owns creation. Agents, tools, tables, flows — defined as Fluent DSL in `src/fluent/`"* — so executing the plan as written would have built the product's central artifact on the wrong side of the line the project sets for itself.

**Change:** LLD §3 is now the authority for table names and records the finalized `x_snc_troubleshoot_run` / `x_snc_troubleshoot_audit`, with the buildability evidence. `IMPLEMENTATION_PLAN.md` gains a "Structural contract" section and has Tasks 1, 2, 3, 4, 5, 10, the Design Rules table, the dependency order, and Verification reconciled to Fluent. Task 10 becomes a Fluent `AiAgent` in `src/fluent/agent-doctor.now.ts`. Two Phase 0 rulings that tool authors kept having to rediscover — R-9 (declared inputs may be absent) and R-1 (never touch the exception object in a cross-scope catch) — are promoted into the plan's standing Design Rules table so they are read before each task rather than looked up after a failure.

**Deliberately not done:** `PRD_ServiceNow_Platform_Assistant.md`, `ARCHITECTURE_DECISIONS.md` and `AGENT_DOCTOR_ARCHITECTURE.md` still carry `x_snc_pa_*` / `x_pa_*` in prose. Mass-rewriting design-history text would create churn for no build benefit and would blur which document decides. LLD §3 carries a pointer stating it is the authority; those documents are read as design rationale, not as name sources.

### Phase 1a build rulings

**R-14 — Jest tests cannot live under `src/`; `IMPLEMENTATION_PLAN.md` Tasks 4 and 9 specify a path that does not build. (2026-07-30)**

**Found:** the plan places Jest tests at `src/server/__tests__/*.test.js` (Task 4 for `PaArtifactStore`, Task 9 for `PaScriptToolAdapter`). `now-sdk build` lints **every** file under `src/` against the platform runtime, so a test file's `require('fs')` / `require('path')` / `require('vm')` fails the build outright: `TS213: Dependency vm is not found in package.json` plus `TS307: The fs Node.js API is not supported in now platform`. The build cannot be run at all while such a file exists, which means the failure is total rather than partial — no Script Include deploys either.

**Change:** tests live in a top-level **`test/`** directory, outside the SDK source tree, with Jest `testMatch` set to `<rootDir>/test/**/*.test.js`. `IMPLEMENTATION_PLAN.md` Tasks 4 and 9 are corrected. This is a structural constraint of the SDK, not a preference: platform source and test source cannot share a tree.

**R-15 — Six data-model corrections from the first build against real `sn_aia_*` rows on gpinst01. Two of them close open E3 checks; four contradict what the LLD documents. (2026-07-30)**

**Found:** `PaToolAgentTrace` was driven against real execution plans on gpinst01. The field-presence assertion required by **R-6** reported each mismatch instead of returning blanks, which is how all six surfaced.

1. **`sn_aia_tools_execution.execution_plan` does not exist — the join field is `execution_plan_id`, confirmed by exclusion.** R-1 left this as an open E3 check because the Phase 0 REST read was denied. The tool probes both candidates and reports which the table declares; `execution_plan` came back in `field_warnings` as absent. **E3 check CLOSED.**
2. **`sn_aia_message.role` vocabulary confirmed as `agent` / `user_profile` / `user`** — matching LLD §2.1, now validated against a run we caused rather than 2026-07-18 archaeology. **E3 check CLOSED.**
3. **`sn_aia_tools_execution.tool` is EMPTY on every real row.** LLD §2.1 states it references `sn_aia_agent_tool_m2m`; the field exists but is unpopulated. The binding sys_id is carried **inside the `request` JSON as `toolM2mId`**. Without a fallback, every tool call reports a null tool name — which reads as "this run called no tools" rather than "we looked in the wrong field". LLD §2.1 corrected.
4. **Reference fields carry the literal string `"undefined"`, not an empty value.** Observed in `sn_aia_execution_plan.agent` on every `security_violation` plan, and in `related_task_table`. A truthiness check treats it as a real sys_id and renders a reference to nothing — and suppresses the "agent is empty, use the usecase" guidance exactly when it is needed. Every reference read goes through a normaliser.
5. **`sys_cs_conversation` has no `channel` field**, so the K26 guidebook's "NAP vs VA" channel question has no single answer. The signal is spread across `conversation_type`, `device_type` and `provenance` (observed: `Interactive` / `AI Agent` / `glide`); all three are reported rather than one being presented as the channel. Also no `name` (it is `title`) and no `document_id`.
6. **`sys_cs_message` field names:** the text is **`payload`** (not `text`), the type is **`message_type`** (not `type`), and the sort key is **`sequence`**. Separately — and more seriously — **`sn_aia_message.message_sequence` cannot be the primary sort key at all.** It is EMPTY on tool-result rows (five of nine on the probe run), and empty sorts *first*, so LLD §4.1 step 4's specified "order by `message_sequence`" put five agent messages **ahead of the user's opening message, which was created 26 seconds earlier** — the stream read as though the agent replied before it was asked. Since step 4 exists to show dialogue progression, the specified ordering actively misrepresents the run. **The tool orders by `sys_created_on`, then `message_sequence`, then `sys_id`** (only the timestamp is populated on every row; `sys_id` makes it fully deterministic, which the benchmark needs to compare runs). This is a deliberate, measured deviation from the LLD, not an oversight; §2.1 and §4.1 are corrected. Timestamps are emitted with every message so a reader can check the ordering rather than trust it.

**Change:** `docs/LOW_LEVEL_DESIGN.md` §2.1 gains the corrections for items 3 and 4 and a pointer here. Items 5 and 6 were never documented in the LLD (the `sys_cs_*` shapes came from the K26 guidebook by name only) and are now recorded. **Methodological note:** all six were caught by the R-6 field-presence assertion. Without it each would have returned a blank, and the tool would have rendered a confident, complete-looking trace from fields that do not exist — the exact failure this project keeps warning about, committed by the tool built to detect it.

**R-16 — gpinst01 has its own known-answer failure specimen, and it is invisible from the plan header. (2026-07-30)**

**Found:** the build brief states that known-answer failure specimens exist only on **keynexus01**, which has no `now-sdk auth` entry. Tracing gpinst01 execution `c9d63a932bda8b9417a6ffbeee91bfd0` (the Phase 0 probe run) mined a server-script stack error out of an agent-role message: `sn_aia_agent.601672d32b1a83d0f243fed2ce91bf3e.context_processing_script`, **line 42**, `InternalError`.

The plan's `state` is **`Completed`** with an **empty `state_reason`**. Nothing in the header, the task tree (11 tasks, all `Success`), or the tool calls (5, all `Success`) indicates a problem. The error exists only in the message stream.

**Why this matters, in three directions:**
- It **corroborates R-7** on a second instance: `context_processing_script` is auto-populated by the platform and is a live failure vector. R-7 said the field arrives populated whether you want it or not; this shows one of those auto-populated bodies actually throwing.
- It **validates LLD §4.1 step 5's error-mining heuristic against a case nobody had catalogued.** The keynexus01 specimen was a known answer; this one was found.
- It **sharpens the R-3 amendment's warning.** That ruling established that `completed` does not mean `swept`. This adds that `completed` does not mean *succeeded* — a run can throw a server-side script error and still report `state=Completed, state_reason=(empty)`. Any diagnosis that reads the plan header and stops will miss it. The seven-layer sweep is not thoroughness for its own sake; the message layer is load-bearing.

**Change:** gpinst01 execution `c9d63a932bda8b9417a6ffbeee91bfd0` is recorded as a **local known-answer specimen** (expected diagnosis: `script_error` signature citing `context_processing_script` line 42), removing the keynexus01 dependency from basic error-mining verification. It does **not** replace the keynexus01 set — the stall and `ReferenceError` specimens remain unavailable, and keynexus01 still needs an auth entry.

> **Amendment (2026-08-11, #185) — the specimen's agent record no longer exists.** `sn_aia_agent` `601672d32b1a83d0f243fed2ce91bf3e` was deleted as Phase 0 probe cleanup and returns 0 records on gpinst01; the plan's own `agent`/`usecase` reference fields are empty too, so the sys_id above survives only inside the error JSON in the agent-role message. **The known answer is unaffected** — the message stream is intact and both arms recovered line 42 in v13 and v14 — but **layers 2, 3 and 7 are permanently unsweepable on this specimen** — the agent, its `sn_aia_tool` row and its `sn_aia_agent_tool_m2m` row were all deleted, and the probe run created no `sn_aia_usecase` at all — so `agent_config`, the only tool for those three layers, correctly returns `empty` against it and that is not a permission gap. Ruled in `benchmark/DECISION.md` §AP; the operating rules and the control probe live in `benchmark/README.md` step 3.

**R-17 — Correcting the data model (§2.1) does not correct the algorithm that consumes it (§4.1). Two consecutive review rounds caught the same drift. (2026-07-30)**

**Found:** R-15 corrected six data-model facts in LLD §2.1. **§4.1 — the step-by-step algorithm the tool is built from — was left describing the old, wrong facts**, and code review found it twice running:

- Round 1 caught §2.1 contradicting itself on `message_sequence`. Fixing that exposed a live ordering defect in the shipped code.
- Round 2 caught §4.1 step 3 still specifying the `tool.tool.name` dot-walk (yields nothing — `tool` is empty on every real row) and step 4 still specifying a `sys_cs_conversation` "channel type" read (no such field).

A sweep of the rest of §4.1 found **three more** the reviewer had not flagged: the Resolution rule presenting `since` as required and mandating in-memory sorting after the pick-list is cut (both contradicted by R-9 and the sort-after-`setLimit` defect); step 7 keying instruction-bloat on "high prompt token counts" when **no per-task token count exists** on `sn_aia_execution_task` — only plan-level `llm_token_avg`; and Detail mode reading as built when it is deferred.

**Why this is a ruling and not five typos.** §2.1 is the reference and §4.1 is its only consumer, so a §2.1 correction that stops at §2.1 leaves the *buildable* half of the spec wrong. The five §4.1 items would each have produced a working-looking tool emitting nothing useful — unnamed tool calls, dropped channel context, a mislabelled pick-list, an untriggerable latency flag. That is this project's signature failure mode (R-11's partial-read-as-absence, R-15's blanks-not-errors), reached this time through documentation rather than data.

Round 2 differed from round 1 in one important way: **both findings were documentation-only — the code was already correct**, because it had been written against real rows rather than against §4.1. That is the reverse of round 1, where the doc contradiction pointed at a live bug. Neither outcome can be assumed; both were checked against the code before anything was edited.

**Change:** §4.1 is corrected on all five points, each carrying the ⚠ marker and a pointer to the ruling that forced it. **Standing rule for the remaining tool cores:** a correction to §2.x is not complete until §4.x has been re-read against it. `PaToolAgentConfig` (§4.2) and `PaToolGenAiLog` (§4.3) consume §2.2 and §2.3 the same way and will need the same sweep when their build turns up data-model surprises — which, on the evidence of this one, it will.

**R-18 — Full §2↔§4 consistency pass: 14 corrections, and the dangerous ones were not §2↔§4 at all. (2026-07-30)**

**Why run it:** R-17 established that a §2.x correction is not complete until §4.x has been re-read against it, after two review rounds caught the same drift. This pass swept every §2↔§4 pair before the next tool core, instead of waiting for a third round.

**Method:** every concrete claim §4.1–§4.7 makes was extracted and tested — field names against `sys_dictionary` on gpinst01 (the instrument that caught the `sys_cs_*` errors), table shapes against live rows, and readability against the `/scope_probe/reads` endpoint. Document-internal consistency was **not** treated as evidence of correctness.

**The §2 field claims held up.** Every field §2.2 and §2.3 document exists: all 16 on `sn_aia_agent`, all 9 on `sn_aia_tool`, all 14 on `sn_aia_agent_tool_m2m`, all 10 on `sn_aia_usecase`, all 14 on `sn_aia_trigger_configuration`, all 12 on `sys_gen_ai_usage_log`, all 17 on `sys_gen_ai_log_metadata`. The "no `active` field on `sn_aia_usecase`" claim is also correct. §2's field-level archaeology was sound.

**One §2 table shape was wrong, and it is load-bearing.** `sn_aia_trigger_agent_usecase_m2m` is described in §2.2 as "agent↔usecase wiring" and consumed by §4.2's overview section on that basis. It has **no `agent` column and no `usecase` column**. It is a trigger-to-resource link — `trigger_configuration` plus a **polymorphic** `related_resource_table` / `related_resource_record` pair, the same shape as `sys_agent_access_role_configuration`. Live rows carry `sn_aia_usecase` on five and `sn_aia_agent` on one. Code written to §4.2 would have queried non-existent columns and, per **R-6**, received blanks rather than errors — reporting an agent as having no wiring.

**The premise of the pass turned out to be too narrow.** Framing it as §2↔§4 assumed §2 was the only upstream. It is not: **§8's open-item closures and the R-1…R-17 rulings are also upstream of §4, and that is where the worst drift was.** Five §4 sections contradicted a *ruling* rather than §2:

- **§4.6 still specified the time-window run-anchor fallback that R-2 deleted from the design.** R-2 removed it precisely so it "cannot be reached by accident" — §2.4 had disqualified it because it interleaves two benchmark runs onto one run record and lets run 2 read run 1's artifacts, destroying the blind-run independence the doubled-run protocol exists to measure. An implementer building §4.6 as written would have rebuilt the thing the ruling deleted, and the damage would surface as a quietly contaminated scorecard. **The most serious finding of the pass.**
- **§4.7 never received the corrections R-5 explicitly mandated** "before any of the 7 tool cores is written" — R-5 even noted that correcting the LLD body was "a separate, not-yet-taken decision", and it stayed untaken. Now applied: no `outputs` object, self-invoking IIFE with the required trailing `(inputs)`, `rhino.global` scope, `input_schema` as an ARRAY (a JSON-Schema object causes a silent never-terminating stall — the most expensive Phase 0 defect), and R-9's absent-input tolerance. Plus a **new integration hazard**: §4.7's `bare string → {value: s}` rule silently breaks the tool cores, which do their own tolerant parsing — `PaToolAgentTrace` maps a bare sys_id to `{execution:…}`, so wrapping it as `{value:…}` produces args with neither key and the tool falls back to the pick-list, discarding the caller's request. It would have shipped as a Task 9 integration bug with no error anywhere.
- **§4.3 omitted R-10 entirely** — no payload source and, more importantly, none of the mandatory explicit degradation. R-10 called this "a real capability limit on 1 of the 7 Phase 1a tools" that "must be specified rather than discovered at demo time"; §4.3 was the place to specify it and did not.
- **§4.4 asserted it was "unchanged by instance research (`sys_dictionary`/`sys_choice`/`syslog` are standard)".** False for `syslog`, and measured false: `/scope_probe/reads` returns 14 readable / 1 denied, the denial being `syslog` (re-confirmed 2026-07-30). R-12 requires a resolved access path before `PaToolLogAnalysis` is written, and P4a found no custom `x_*` precedent among the 79 existing privilege rows.
- **§4.2's access-alignment check carried a wrong guess and an impossible requirement.** §8 item 9 closed the storage question — `sys_agent_access_role_configuration`, polymorphic, plus `sys_agent_access_role_mapping` — and also established that **no structural field distinguishes "User Access" from "Data Access"**; the split is conventional, carried in free-text `description`. §4.2 asked for two clean role sets, which cannot be produced. It now emits the roles with their descriptions and states that the split is heuristic.

**Also corrected:** four stale `⚠ VERIFY` markers on questions §8 had already closed (`sn_aia_tool.type` choices; `execution_mode` = `autopilot`/`copilot`; the prompt/response payload location, where the "likely in metadata documents" guess was **wrong** — it is `sys_generative_ai_log.prompt`/`.response`); §4.2's instructions section reading only the **usecase** `context_processing_script` when the field exists on both and R-16's live specimen threw in the **agent's** copy; and §2.2's use-case activation question, now answered — activation is carried on `sn_aia_trigger_configuration.active` and `sn_aia_trigger_agent_usecase_m2m.active`.

**Change:** 14 corrections applied across §2.2, §2.3 and §4.2–§4.7, each marked ⚠ with the ruling that forced it. **Standing rule, widened from R-17:** §4.x is downstream of §2.x *and of §8 and every R-ruling*. A closure recorded in §8 or a ruling that names a §4 section is not complete until that section is edited — "recorded in DESIGN.md" is not the same as "in the spec the next session builds from". R-5 sat unapplied for exactly this reason.

**R-18a — Two of R-18's own corrections were defective, and one reproduced the exact failure R-18 was written to prevent. (2026-07-30)**

**Found:** review of the R-18 pass caught two defects introduced *by that pass*, both in §4.2:

1. **The `sn_aia_trigger_agent_usecase_m2m` traversal was inverted.** R-18 correctly established that the table has no `agent`/`usecase` columns, then told implementers to *"query it by `trigger_configuration`"*. `PaToolAgentConfig` starts from an **agent** and has no trigger sys_id at that point — and keying on `trigger_configuration` also skips the agent-direct rows. Verified live: the working key is `related_resource_record` + `related_resource_table`, and **two** branches must be walked — agent-direct, and the team chain (`sn_aia_team_member.agent` → `.team` → `sn_aia_usecase.team` → usecase sys_ids). Branch 2 holds most rows (5 of 6 sampled), so walking only branch 1 reports a wired agent as unwired.
2. **The access-alignment check contradicted itself.** R-18 established that User Access and Data Access cannot be separated structurally and had the tool emit one combined set — but left the original trailing requirement *"Both lists must independently cover the invoking user's role"* in place. Both cannot be true. Corrected by separating the two claims: the **platform** does enforce two gates and the invoking role must satisfy both; the **tool** cannot attribute a role row to a gate and must say so, rather than reporting "both lists check out".

**Why this is recorded rather than quietly fixed.** Defect 1 is the **R-6 blank-not-error failure** — a query against the wrong key returning rows-with-blanks instead of an error — which is the precise failure mode R-18's §4.2 correction existed to remove. The corrected text would have caused it in a different way. Two lessons, both cheap to state and expensive to relearn:

- **A documentation correction is untested code.** R-18's field-existence claims were verified against `sys_dictionary` and all held; its *traversal* claim was reasoned, not executed, and was wrong. Verifying that a column exists is not verifying that a query starting from the tool's actual entry point returns anything. R-18a's traversal was executed against live rows before being written.
- **Removing a wrong requirement is a two-part edit.** Defect 2 came from replacing a premise while leaving the sentence that depended on it. When a correction invalidates a claim, every downstream sentence in that block has to be re-read — the contradiction sat two lines below the fix.

**Change:** §4.2's overview traversal and access-alignment check corrected, each carrying the verified query shape. **Standing rule:** any §4.x correction that specifies a *query* must be executed against live rows from the tool's real entry point before it is written down — field-existence checks do not cover it.

**R-18b — Four more corrections, and the failure mode is now named: a correction placed BESIDE a wrong sentence does not correct it. (2026-07-30)**

**Found (all four confirmed against the documents and the shipped code):**

1. **§4's authoritative contract forbade what §4.7 required.** The §4 preamble read `execute(args: Object)` — *"pure objects in/out, **no strings**"*. R-18's §4.7 Note 4 requires the adapter to pass bare strings straight through, because the cores normalise them (`PaToolAgentTrace` maps a bare sys_id to `{execution:…}`). A contract line and a note two sections apart said opposite things, and **the contract is the higher-altitude statement** — an adapter author would follow it and wrap, producing args with neither key and a silent fall-through to no-argument behaviour. Corrected to `Object | String` with the pass-through rule stated at contract level, and the §4.7 pseudocode's `// object contract` comment fixed to match. This is the one a reader was most likely to act on, and it survived three rounds precisely because both halves looked correct in isolation.
2. **§2.1 still prescribed the broken dot-walk as its primary sentence.** R-15 appended a ⚠ correction *below* the bullet while leaving *"dot-walk `tool.tool.name` for the tool, `tool.agent.name` for the agent"* intact as the first thing anyone reads. Now removed from the sentence itself.
3. **`IMPLEMENTATION_PLAN.md` Task 9 never received the bare-string rule.** It still said "tolerant — accept bare values for single-arg tools", which is the ambiguity that produced the `{value: …}` wrapper in the first place. Task 9 is what the next session builds from.
4. **§4.1 step 1 never received the reference normaliser.** §2.1 documents that reference fields carry the literal string `"undefined"`; the algorithm step that builds the header did not mention it. The shipped code does normalise (`_refValue`), so this was doc-only — but §4.1 is the spec a reimplementation would follow.

**Two further gaps found by sweeping for the same patterns rather than waiting for another round:** §2.2 never listed `sys_agent_access_role_configuration` / `sys_agent_access_role_mapping`, despite §4.2 being required to read them — the data-model section omitted a source its own consumer uses. And reference normalisation was stated only in §4.1 step 1, when it applies to every core, so it moved up to the §4 preamble.

**The named failure mode.** Findings 2 and 4, plus R-18a's access-check contradiction, are one pattern appearing for the third time:

> **A correction appended beside a wrong sentence does not correct it.** Readers stop at the first sentence; `grep` finds the ⚠ note while a human reads the original. Every one of these was *technically documented* and *practically wrong.*

**Standing rule, added to R-17/R-18:** a correction must **replace** the text it invalidates, not sit below it. Appending is acceptable only for provenance — the evidence and ruling reference — after the wrong claim itself is gone.

**Second rule, from finding 1:** contract statements outrank notes. When a ruling changes behaviour that a **contract line** describes (§4's `execute()` signature, §4.7's adapter pseudocode, the Design Rules table in `IMPLEMENTATION_PLAN.md`), the contract must be edited. A note that contradicts a contract loses, however clearly it is written and however close it sits.

**Assessment of the four rounds, stated plainly.** Every finding across rounds 2–4 has been in *prose*, not code: the shipped tool already did the right thing in all four cases here, because it was written against live rows. The defect rate in reasoned prose corrections has been materially worse than in executed ones — which is what R-18a's rule addressed for queries, and what these two rules address for placement and altitude.

**R-18c — §5–§7 swept: 11 corrections, two more unapplied rulings, and the scope of the audit was underestimated for the third time. (2026-07-31)**

**Found (2 flagged by review, 9 by sweeping the rest of the unswept surface):**

| § | Was | Now |
|---|---|---|
| **5 heading** | *"created via Foundry automation, **NOT SDK**"* | **Fluent `AiAgent`** — R-13 reversed this and CLAUDE.md forbids the old path |
| 5 rows 9–15 | `execution_mode`=`unsupervised/auto` ⚠VERIFY | **`autopilot`** — neither old value is in the choice list |
| 5 row 17 | "no custom `context_processing_script` — keep ours empty" | **explicitly clear it after creation and verify** (R-7) |
| 5 row 18 | trigger, `active`=true | **deferred** — conflicts with Task 10 + Build Rule #31 |
| 5 row 19 | "trigger↔usecase↔agent" | polymorphic `related_resource_table`/`_record` |
| 6 status | "nothing here is built yet" | app installed on gpinst01; `PaToolAgentTrace` ships |
| 6 table | Agent Doctor via "Foundry automation" | **SDK / Fluent** (R-13) |
| 6 table | seed agents via "Foundry automation" | **UNDECIDED** — Task 11 records it as open |
| 6 layout | `src/instance/**` + `src/agent-doctor/**` | the real tree; tests in `test/` (R-13, R-14) |
| 6 deploy | keynexus01 | **gpinst01** — keynexus01 has no auth entry |
| 7 | "Benchmark Implementation **on keynexus01**" | gpinst01 primary, with the R-16 specimen; keynexus01 blocked on auth and its plugin state unverified |

**Two more rulings found unapplied.** R-7 mandated that §5's `context_processing_script` cell "must be restated"; R-13 moved Agent Doctor to Fluent and §5's heading plus §6's table still instructed the opposite. Both had been *recorded* and neither *applied* — the same failure as R-5/§4.7 in R-18. **That is three unapplied rulings across three sweeps**, which makes it a process defect, not three oversights.

**The §5 heading is the most serious single item in five rounds.** It did not merely contradict a ruling — it instructed a build path CLAUDE.md explicitly forbids (*"SDK owns creation"*), in the heading of the section describing the product's central artifact. Anyone building §5 as written would have created Agent Doctor via MCP record automation, exactly what R-13 was written to prevent.

**Scope underestimated, third time.** R-17 framed the problem as §2→§4. R-18 found the real upstreams also included §8 and the rulings. R-18c finds that §4 was never the only *downstream* either: **§5 (record set), §6 (build approach) and §7 (benchmark) all consume §2 and the rulings the same way**, and none had been swept. Each time the fix was correct and the boundary was drawn too tightly. The boundary is now the whole document: §2–§7 have all been swept, and §8 is the ruling ledger itself.

**Change:** 11 corrections across §5–§7. **Standing rule, the one that would have prevented all three unapplied rulings:** a ruling whose **Change** clause names a document section is a **work item, not a record**. It is not discharged until that section is edited, and the ruling should say so explicitly. "Recorded in DESIGN.md" has now failed three times as a substitute for "changed in the spec the next session builds from" (R-18) — and the failure repeated *after* that rule was written, because nothing checked the back-catalogue of rulings for undischarged Change clauses. Before the next tool core, every R-ruling's Change clause should be walked once and confirmed applied.

**R-19 — Ledger walk discharges three more unapplied rulings, all binding on the benchmark; and R-12 is resolved NEGATIVELY: a scoped app cannot grant itself `syslog`. (2026-07-31)**

**Part 1 — the ledger walk R-18c mandated, run for the first time.** All 21 rulings' Change clauses were walked. **Three more were recorded but never applied**, after R-5, R-7 and R-13 in earlier sweeps — six in total. What makes these three worse than the earlier ones: **all three bind on the benchmark**, which DESIGN.md §1 identifies as the load-bearing component of the entire strategy ("Under A the load-bearing component is the **benchmark**, not Agent Doctor").

- **R-3's amendment** required Task 11 to record **how many layers were actually swept**. Unapplied, the 6-point rubric scores only whether the root cause was found — so a lucky shallow run scores identically to a thorough one. The amendment's own evidence is the reason this matters: the same probe, same prompt, ran 19 tool calls on keynexus01 and **5** on gpinst01, and *both* reported `state=Completed` with empty `state_reason`. Exhaustion surfaces as `tool_limit`; **stopping early surfaces as `completed`** and is invisible.
- **R-4** required every scored row to record **both** budget knobs read at run time, and `benchmark/DECISION.md` to state that the shipped OOB default is **unknown**. Unapplied, a scorecard produced under a raised `max_auto_executions` (E2 needed 20 against an instance-typical 10) would be read as transferable to a default-configured customer. R-4 called itself "binding on Tasks 11–12" and was filed "specifically so it survives the Phase 0 → Phase 1a boundary". It did not survive it.
- **R-1** required Task 1 to carry the cross-scope readability check. The check was *built and run*; the plan never mentioned it, so a reader of the plan would not know it existed or that it had already answered the question.

Stated plainly: had the benchmark been run before this walk, it would have produced a scorecard that **does not measure what the gate needs** — and the gate is the decision the whole project is organised around. Applied now to Tasks 1, 8, 11 and 12. R-1's own text is also corrected: it still described the two E3 checks as open, which R-15 closed.

**Part 2 — R-12 resolved, negatively and definitively.** R-12 required the `syslog` access path be settled *before* `PaToolLogAnalysis` is written. Tested rather than assumed:

- The grant was declared as a Fluent `CrossScopePrivilege` and **installs correctly** — verified in `sys_scope_privilege`: `source_scope = x_snc_troubleshoot`, `target_name = syslog`, `target_scope = global`, `operation = read`, `status = allowed`.
- **`syslog` remains `DENIED`**, on two separate probe runs after install (ruling out scope-access caching).
- The blocker is `sys_db_object.caller_access = Caller Restriction` — the one non-default setting Phase 0 found on any examined table. **A self-declared privilege does not satisfy it: an application cannot grant itself access to a caller-restricted table.** That is the mechanism P4a's "no custom `x_*` precedent among 79 rows" was hinting at, now measured rather than inferred.

**Incidental discovery, worth keeping:** the platform **auto-creates** `sys_scope_privilege` rows for this scope as the app makes cross-scope calls — `sn_aia_execution_plan`, `sys_cs_message`, `sys_cs_conversation_task`, plus scriptables (`GlideRecordSecure.getValue`, `RESTAPIRequest`, …), all timestamped during the `PaToolAgentTrace` runs. So the privilege mechanism is working and self-populating; `syslog` is blocked by a *different* gate, not by a missing privilege.

**Change:** `PaToolLogAnalysis` (LLD §4.4, Task 8) is **blocked at the data source** and needs an instance-admin action or a different evidence path. This is a **customer-side prerequisite, not a code defect** — the same shape as R-10's `sys_generative_ai_log` limit, and it belongs in `HANDOFF.md` alongside it. **Recommended (confirm at Task 10):** keep the tool in the roster and have it **degrade explicitly** — a diagnosis that says "platform logs unavailable from this scope, admin grant required" is far more useful than an agent with no log tool, which cannot tell you the log layer was skipped. Dropping to 6 tools would make the gap invisible, which is the failure mode this project keeps legislating against. The Fluent declaration is **kept**: it is the half we own, and it must already exist if an admin lifts the restriction.

**Method note.** Two near-misses during this work, both caught by the project's own rules. Querying `sys_scope_privilege` for a `source` field returned blanks on *every* row including OOB ones — the field is `source_scope`, and `servicenow_query` silently omitted the non-existent name (**R-6**). Reading that as "the privilege has no source" would have produced a confident wrong diagnosis. And the install succeeding was **not** treated as evidence the grant worked — per **R-8** and the R-11 retraction, the privilege record was verified in the table and the effect re-measured through the in-scope probe.

**R-19a — The ledger walk only checks one direction. A ruling can go stale by being SUPERSEDED, not just by being unapplied. (2026-07-31)**

**Found:** review of R-19 caught that **R-1's discharge still prescribed the remedy R-19 had just disproved** — *"a `sys_scope_privilege` Read grant … must be added and re-verified"* — while R-19, Task 8 and LLD §4.4 all now say that grant installs and does nothing. Sweeping the ledger *backwards* found **two more** the reviewer had not flagged:

- **R-12's Change clause** still posed the syslog question as open ("either confirm a grant is obtainable, or adopt a fallback") when R-19 had answered it — first branch tested and failed, fallback branch is the answer. It also still said `x_pa_*`, a scope name R-13 superseded.
- **R-5's Change clause** still ended *"Correcting the LLD body is a separate, **not-yet-taken** decision."* R-18b took it. That sentence is precisely why the correction sat unapplied long enough for R-18 to find it — it documented its own deferral and nothing ever came back.

**The methodological gap, which is the real finding.** The ledger walk R-18c mandated, and that R-19 ran for the first time, asks exactly one question per ruling: **"has this Change clause been applied?"** It does not ask the second: **"has this Change clause been superseded?"** Those fail differently and both produce a spec that misleads:

| Failure | Symptom | Caught by |
|---|---|---|
| **Unapplied** | the spec never learned the fact | forward walk (R-18c) — found R-1, R-3, R-4, R-5, R-7, R-13 |
| **Superseded** | the spec still carries a remedy that has since been *disproved* | nothing, until now |

Superseded is arguably the more expensive of the two: an unapplied ruling leaves a gap someone may notice, whereas a superseded remedy is **confident, specific, and wrong** — R-1 told a builder to go add a privilege grant that R-19 had already measured as inert. That is wasted work with a plausible rationale attached, which is the hardest kind to abandon.

**Scope of the backward sweep, run once the gap was named.** Beyond the three rulings, the disproved syslog remedy was still being prescribed in **four more places**, including the two a fresh session actually reads first: `docs/BUILD_BRIEF_PaToolAgentTrace.md` ("It needs a `sys_scope_privilege` Read grant"), LLD §8 item 4, and two forward-action items in `docs/PREFLIGHT_FINDINGS.md`. The Phase 0 evidence text there is **preserved** — per the R-6 precedent that historical records of a defect are kept deliberately — but its *forward actions* now carry superseded pointers, because an action item is an instruction, not evidence. Also corrected: DESIGN.md §2.1 still told the collector to anchor an `x_pa_run`, a table name the platform rejects (R-13).

**Change:** R-1, R-5 and R-12 corrected, each now carrying a forward pointer to the ruling that resolved or disproved it; plus the four downstream sites above. **The ledger walk becomes bidirectional:** for every ruling, ask *(a)* is the Change applied, and *(b)* has a later ruling superseded it. When a ruling resolves an open question, the walk must also update **every earlier ruling that prescribed a remedy for that question** — resolving it in one place is not enough, because the rulings are read individually, not as a sequence.

**Corollary worth stating:** a Change clause that documents its own deferral ("a separate, not-yet-taken decision") is a defect in the ruling, not a neutral note. R-5 deferred, nothing tracked the deferral, and it surfaced three weeks later through review. Either take the decision or file it as a work item — do not record it as pending inside the ruling and move on.

**R-19b — Two corrections to R-19a's own execution: a status label is part of the claim, and the repo already had the convention I should have used. (2026-07-31)**

**Found:** review of R-19a caught two sites where the supersession was announced but the superseded text still read as live. **Both were introduced by the R-19a commit itself — the commit whose stated rule was "a correction must REPLACE the text it invalidates, not sit below it."**

1. **`PREFLIGHT_FINDINGS.md` verdict action 1.** I put a ⚠ banner *above* the instruction and left the instruction intact — the exact "correction beside a wrong sentence" failure R-18b named. Worse, the same commit's own text said *"an action item is an instruction, not evidence"*, and I then applied the R-6 evidence-preservation precedent to it anyway. **The repo already had the right convention and I did not use it:** `~~strikethrough~~` appears 17 times across `PREFLIGHT_FINDINGS.md` and `DESIGN.md` for exactly this purpose, including four lines further down the same file. Now struck, with the current state stated after it — the record is preserved *and* the instruction no longer reads as actionable.
2. **LLD §8 item 4.** I patched the `syslog` sentence inside the item and left the item's **disposition label** reading `**CARRIED FORWARD**` and its body claiming `Runtime half **untested**`. Both had been false since **R-1's discharge on 2026-07-30** — the runtime half was measured a day earlier by `/scope_probe/reads` (14 of 15 readable from a genuinely restricted scope, which is precisely the measurement P4b could not obtain). So the open-items ledger was advertising an open question that two rulings had closed.

**The generalizable rule, which is new:** in a *structured* record — a numbered open-items list, a verdict's action list, a status table — **the status label is part of the claim, not decoration.** Correcting an item's prose while leaving its label at `CARRIED FORWARD` / `⚠ VERIFY` / `blocked` produces a document that contradicts itself at a glance, and the label is what a reader scans. Every correction to such an item must update **both** the body and the label, and a reader scanning only labels must not be misled.

**Second rule, cheaper and duller:** before inventing a notation for superseded text, check what the repo already uses. R-19a invented a banner; `~~strikethrough~~` was already the house convention in the very file being edited.

**Assessment, stated plainly.** R-18's premise was too narrow, R-19's ledger walk was one-directional, and R-19a's own edits reintroduced the failure it had just named. Three consecutive processes with a blind spot on first execution — and in each case the blind spot was found by review, not by the process. The honest reading is that a rule written in the same pass as the work it governs does not get applied to that work; the pass is already committed to its own approach by the time the rule is articulated. Rules from this project should be checked against the *next* pass, deliberately, rather than assumed to bind retroactively on the one that produced them.

**R-20 — Native diagnostic runs have no terminal state, by design. (2026-07-31)**

**Raised:** 2026-07-31, at Task 10 (issue #24), settling a gap Task 9 carried forward explicitly.

**Finding.** `PaRunAnchor` creates every run at `status: 'running'` and nothing moves it. This was
invisible while a run was one REST call long; Task 10 is what makes a run span many tool calls.

**Ruling.** There is no completion path, and this is the contract rather than a gap. The native
harness emits no end-of-conversation signal, so completion could only be *declared*, and all three
declarers fail on grounds this project already measured:

- **The agent**, via a terminal tool — R-9 measured the Phase 0 probe agent passing a declared input
  in **zero** runs while its own reasoning text claimed it had. A terminal tool the agent forgets to
  call leaves the run open anyway; the failure mode is unchanged but now *looks* deliberate. It also
  spends one of the platform's 5–7 tool slots on bookkeeping that diagnoses nothing.
- **A clock** — reintroduces time-window reasoning into the one component where R-2 deleted it
  outright. R-2 killed time-window *keying* rather than *reaping*, and the distinction is real, but
  it is subtle enough that a future reader finds a clock inside `PaRunAnchor` and reads it as
  permission to key on one. The guard R-2 bought was structural; a sweeper spends it.
- **`sn_aia_execution_plan` state** — the platform does know when work ends, but at **turn**
  granularity. One conversation spans many plans, one per user turn, so closing on plan-terminal
  marks a run complete while the user is still mid-conversation — and the PRD explicitly wants
  follow-up questions inside the same run.

**Change.** Completeness is **derived, never declared**: the distinct `tool_name` set over
`x_snc_troubleshoot_audit` rows with `action_type='result'` for a run. This is strictly stronger
than a status field, because §97 already established that premature completion surfaces as
`completed` and is *indistinguishable from a genuine finish* — a status column answers "did it
stop?", the audit-derived layer set answers "did it look?", which is the question that matters and
the one R-3's amendment makes binding for every scored benchmark row.

**Consequences.** `status`, `transcript`, `context_summary`, `fix_report` and `error` are **Phase 2
(custom harness) columns**, unwritten on the native path; the `queued` / `awaiting_confirmation` /
`complete` / `failed` vocabulary stays in `tables.now.ts` for Phase 2 but is unreachable in Phase 1a.
LLD §3.1's status row is corrected in the same PR (R-18c: a ruling naming a document section is a
work item, not a record). The derived-completeness reader is **Task 11's** deliverable — with a
two-tool roster it could only ever report 2 of 7 and would be rewritten once Tasks 7–8 land.
Unkeyed runs now accumulate without closing; accepted, since the alternative is the rejected clock.

**Guard.** `test/PaRunAnchor.test.js` asserts the class exposes no `complete`/`finish`/`close`/
`setStatus`, and scans the file for the terminal choice values. Re-opening this ruling means
changing that test, deliberately.

---

**R-21 — The seed-location gate is resolved; and the resolution exposes that a scored run today can't be meaningful, only interpretable. (2026-07-31)**

**Found:** two things, discovered building Task 11.

1. **The seed-location decision** (`IMPLEMENTATION_PLAN.md`'s "OPEN — decide before Task 11" gate,
   raised 2026-07-30 against R-13). Both prior candidates failed on a requirement the other
   satisfied: Fluent in `src/fluent/` (the product app) gives reproducibility but ships five
   deliberately broken agents inside `x_snc_troubleshoot`, the scope every customer installs; MCP/
   Foundry record automation keeps them out of the product app but violates CLAUDE.md's port-to-
   Fluent rule and is not reliably reproducible months later, which is exactly when Phase 1b needs
   it. A **separate scoped fixture app** — `benchmark/seed-app/`, scope `x_snc_tsbench`, the five
   seeds authored as Fluent DSL — takes reproducibility from the first option and app-separation
   from the second, at the accepted cost of a second scope and a second install target. The
   measured fact that made scaffolding it low-risk: `now-sdk init` contacts the instance during
   scaffolding but creates no record there — a `sys_scope` query for `scope=x_snc_tsbench` returned
   zero rows against an instance where the same query for other scopes returned nine. Full
   rationale and the rejected-options table: `benchmark/DECISION-seed-location.md`.
2. **The layer-availability finding**, surfaced while checking that finding against the seeds'
   expected layers. `docs/agent/agent-doctor-instructions.md` states it directly: Agent Doctor "has
   tools for LAYER 1 ONLY" — `agent_trace` and `read_artifact` (paging, not a layer), the deliberate
   Task 10 vertical-slice scope. Layers 2–7 have no tool in this build. All five gate-scored seeds
   target layers 2–7 (schema, instruction, data, genai_stack, wiring — none targets layer 1), so a
   scored run executed today returns near-0/10 **by construction**, and Task 12's gate table reads
   that as `< 5/10 → Full custom harness as designed` — the most expensive decision in the project,
   reached from a missing-tools gap rather than anything measured about the native harness.

**Change:** `benchmark/scorecard-template.md` records `layers_available` alongside `layers_swept` —
extending R-3's *finished vs. did not look* distinction to a third state, *could not look*, so a
near-0 score reads as "no tools to look with" rather than "looked and failed." Task 12's scored
protocol is **blocked on Tasks 7–8** (the remaining five tool cores) and is filed as its own issue —
**issue #32** — separate from this ruling, since discharging R-21 here does not build those tools.

⚠ **Amended 2026-08-01 by R-22.** R-21's finding 1 and its `layers_available` change both stand. What
does not stand is what R-21 was recorded alongside: the seed 4 construction it closed **LLD §8 item 8**
on. That construction rested on R-18's reading of `sys_one_extend_capability_definition.connection`,
which R-22 refutes. Item 8's safety half stays closed; its efficacy half is re-opened, and seed 4 is
re-targeted at `api`. Nothing about the seed-*location* decision is affected.

---

**R-22 — A Phase 0 inference from a 10-row sample was contradicted by the full 2026-row table, inside the instrument built to catch exactly that. (2026-08-01)**

**Found:** seed 4's defect was an empty `connection` on its own
`sys_one_extend_capability_definition`, on R-18's theory that `connection` is *the* provider binding
and an empty one is therefore precisely the "capability not mapped to a provider" finding. LLD §8
item 8 was closed on it (R-21), and the previous fix wave hardened every *other* field on the record
to make `connection` "the only gap". Measured against the whole table on gpinst01, read-only:

| Measurement | Value |
|---|---|
| `sys_one_extend_capability_definition` rows | **2026** — R-18 sampled **10** (0.5%); the fix wave then asserted "all 12" |
| …with `connection` empty | **318 of 2026 (15.7%)**, including shipped OOB Now Assist definitions |
| `sys_dictionary` — `connection` | `reference` → `sys_alias`, **`mandatory=false`** |
| `sys_dictionary` — `capability`, `api_type`, `api` | all **`mandatory=true`** |

An empty `connection` is a normal, common, supported state. The hardening had turned the seed into a
**structural clone of a working OOB definition differing only in an optional field** — a specimen
that would most likely not fail at all. A benchmark row that measures nothing scores as a miss
against the diagnostic agent and is indistinguishable from one that measures something, which is the
worst failure a benchmark has.

**This is the project's own signature failure mode, and it is worth recording in its own right.**
R-11 retracted a `v_plugin` finding for reading a truncated result as absence; R-6 records the same
shape. R-18 read 10 rows of 2026 and generalised. The failure then survived a full adversarial fix
wave — which *tightened* the seed around the wrong field and asserted a false denominator ("all 12
rows") three times — and was caught only by a second review that re-measured the denominator. The
instrument being built here exists to catch partial results read as wholes, and it was built with
one inside it. **A count without its denominator is not a measurement**, and that applies to the
evidence a ruling is written from, not only to the code it governs.

**Change:**

1. **Seed 4 is re-targeted at a mandatory binding.** `api` now holds
   `00000000000000000000000000000000` against `api_type=sys_hub_flow` — the definition names a
   provider integration Flow that does not exist. Justification, same denominator of 2026: `api` is
   `mandatory=true` and `internal_type=document_id`, so it carries **no referential integrity** and
   installs verbatim; **1 of 2026 rows (0.05%)** has an empty `api` and **1 of 2026 (0.05%)** has a
   dangling one (a single OOB profanity-filter row), making it ~300× rarer than an empty
   `connection` and genuinely anomalous. The all-zeros value is deliberately unmistakable; a
   plausible random GUID would read as real drift. The rejected alternative — a dangling `capability`
   reference — is a true `reference` column the platform may validate, and breaking it changes the
   signature to *capability not found*, which is the documented **fallback**, not the primary.
2. **`connection` stays empty as a documented decoy.** `benchmark/seeds/seed-04-genai-unmapped.md`
   now scores a "no connection bound" diagnosis as a correct **layer** with a **0 fix target**, and
   requires the decoy hit to be recorded in `notes`.
3. **LLD §8 item 8 is split** — safety CLOSED (it never depended on R-18), efficacy RE-OPENED until a
   Task 12 run produces the failure. R-21 is annotated accordingly. LLD §8 item 6 carries the
   sample-size correction at the point R-18's reading originated.
4. **Standing rule, and it is a reporting rule, not a research one:** state the denominator every
   time a count is stated, in rulings and in specs alike. "12 rows" and "318 of 2026" are the same
   sentence shape and only one of them can be checked.
5. **LLD §4.3's `check_config` is corrected — added 2026-08-01 after PR #33 review, and this item is
   the ruling's most important one for anything not yet built.** Items 1–3 corrected the *seed*; they
   left §4.3 — the build spec for `PaToolGenAiLog` (Task 8, **unbuilt**) — still instructing the tool
   that *"`connection` empty or unresolvable **is** the capability not mapped to a provider finding"*.
   A tool built to that sentence would report **318 of 2026** healthy capabilities as broken: not a
   diagnostic, a false-positive generator, and one shipped inside the product rather than confined to
   a fixture. §4.3 now strikes the refuted heuristic and specifies the mandatory-binding check in its
   place. **This is R-17's standing rule re-failed** — *"a correction to §2.x is not complete until
   §4.x has been re-read against it"* — and the re-failure is the point: R-17 was written about §2↔§4,
   the R-19a walk was made bidirectional, and neither caught this because the correction originated in
   §7/§8 and nobody asked which §4 consumer read from it. **Extend the walk: when a ruling invalidates
   a *fact*, sweep every section that consumes the fact, not only the section that stated it** — and
   give unbuilt specs priority in that sweep, because a wrong sentence in a spec for existing code
   contradicts something a reader can check, while a wrong sentence in a spec for unbuilt code simply
   becomes the code.

---

**R-23 — Seven data-model corrections from building `PaToolAgentConfig` against real rows; and §4.2's access-alignment check turns out to be executable on 8% of triggers, not on the ones that fail. (2026-08-01)**

**Found:** the field lists for Task 7 were written from LLD §2.2 and then checked against `sys_dictionary` and against whole-table counts on gpinst01 *before* the tool was wired to anything. Six of the seven would have produced blanks rather than errors (**R-6**), and the seventh changes what the tool is able to claim.

| # | Claim in the spec | Measured on gpinst01, 2026-08-01 |
|---|---|---|
| 1 | §2.2: "per-role breakout in `sys_agent_access_role_mapping`" — join field unnamed | The table declares exactly **three** columns: `role`, **`agent_access_config`**, `sys_id`. None of the five names this build first guessed matched, so the entire breakout would have been skipped while `role_list` was reported as the complete picture. 34 rows exist across three `agent_table` values |
| 2 | §2.2: `sys_agent_access_role_configuration` catalogued by shape only | 8 columns: `name`, `action`, `allow_all_session_roles`, `agent_table`, `agent`, `description`, `role_list`, `sys_id`. There is **no `active`** column, which this build guessed at |
| 3 | §4.2: the User/Data split "is conventional, carried in free-text `description`" | `description` is **EMPTY on 638 of 703 rows (91%)**. The one signal the split is supposed to travel in is absent from nine rows in ten. `action` is no substitute: **703 of 703** read `Limit To Roles` |
| 4 | §4.2: "emit the role sets alongside the trigger's `run_as`/`run_as_user` roles, and flag any role the run-as user lacks" | **`run_as` is not a user.** Its dictionary type is `field_name` — it names a FIELD on `target_table` (`caller_id`, `assigned_to`, `employee`), so the identity is whoever sits in that field on the record that fired the trigger. Static `run_as_user` is set on **3 of 36** trigger configurations (8%); the `run_as` field path on **18 of 36** (50%) |
| 5 | R-18a: branch 2 holds "5 of 6 sampled" m2m rows | Whole table: **38 of 40 (95%)** are `related_resource_table=sn_aia_usecase`, 2 are `sn_aia_agent` |
| 6 | §2.2: 14 verified fields on `sn_aia_trigger_configuration`, `name` not among them | 30 columns, and **`name` is declared and mandatory** — LLD §4.2 asked for it and §2.2's list did not carry it, so the tool probed for it needlessly. `usecase` and `business_rule` are both labelled **"(deprecated)"** in the dictionary |
| 7 | §2.2: 14 fields on `sn_aia_agent_tool_m2m` | 28 columns. The **binding carries its own `description`**, distinct from the tool's |

**Item 4 is the one that matters, and it is not a field-name defect.** §4.2's access-alignment check — the automated form of the K26 Lab 1 security-violation diagnosis — is written against `run_as_user`, and `run_as_user` is set on roughly one trigger in twelve. On the other 92% the identity is resolved *per triggering record*, which is precisely the Lab 1 semantic ("the trigger invokes the workflow under the **initiating user's** context") and precisely why the misalignment is invisible from configuration. **A config-time comparison cannot answer the question the check exists to answer.** The tool therefore reports which identity path each trigger uses, compares only the static ones, states the coverage as a fraction, and points at `agent_trace` for the initiating user of a real failing run. A silent "no missing roles" over a 1-in-12 sample would have been the most dangerous output this tool could produce: confident, specific, and blind to the failing case.

**Item 3 compounds it.** R-18a already narrowed the claim from "two verified lists" to "one combined set plus a heuristic". The heuristic's only input is empty 91% of the time, so the honest output is a per-row `gate_attribution` of `UNKNOWABLE` rather than a `description: null` a reader will skim past.

**Why this is a ruling and not seven notes.** Every one of the six field defects was caught by checking `sys_dictionary` *before* wiring the tool up, which is the R-15 method applied deliberately instead of by accident. Had they been left in, each would have produced a working-looking config summary rendered from columns that do not exist — an agent reported as having no access configuration, no trigger name, no per-role breakout. That is this project's signature failure mode for the fourth recorded time (R-11, R-15, R-18a, R-22), and the only reason it did not ship again is that the check is now routine. **Standing rule, cheap: a field list written from a design document is unverified until `sys_dictionary` has been asked. Ask before the code is wired, not after it returns blanks.**

**Change:** applied in the same PR that found them, per R-18c — `docs/LOW_LEVEL_DESIGN.md` §2.2 gains items 1, 2, 6 and 7 and the corrected R-18a denominator; §4.2's access-alignment bullet is corrected for items 3 and 4 with the refuted instruction struck rather than annotated (R-19b). `src/server/tools/PaToolAgentConfig.js` carries all seven, each with the measurement inline, and `test/PaToolAgentConfig.test.js` carries a regression guard per correction — an unguarded correction is one that comes back.

---

**R-24 — Twelve review findings across four rounds on one file, and eleven are the same defect. Patching instances was not converging; the invariant is now enforced in the read layer. (2026-08-01)**

**Found:** `PaToolAgentConfig` went through four rounds of automated review. Twelve findings, of which **eleven are one failure mode**: *a partial, excluded, empty or bounded read presented as a definitive answer.*

| Round | Finding | Shape |
|---|---|---|
| 1 | `allow_all_session_roles` excluded from requirements but still counted | excluded-yet-counted |
| 1 | `trigger_unreadable` named the linked agent, not the trigger | wrong subject on a partial read |
| 1 | trigger traversal capped at 25 per branch, silently | silent cap |
| 1 | `unknown` sticky in `noteRead`, never upgraded | "cannot tell" frozen as an answer |
| 2 | `no_trigger_wiring` emitted over a DENIED read | denial as absence |
| 2 | partial role comparison discarded on one denial | computed findings thrown away |
| 3 | name-matched use cases seeded into agent mode | unrelated data presented as related |
| 3 | vacuous `completed` over an empty requirement set | clean bill of health over nothing checked |
| 3 | access-configuration read capped at 50, silently | silent cap |
| 4 | `sys_user_has_role` capped at 200, silently | silent cap feeding a false "missing" |
| 4 | `_traversalIntegrity` reported complete over a truncated input | **the integrity check itself lied** |
| 4 | `completed` claimed over a truncated requirement set | silent cap, one layer up |

**Four of the twelve were introduced or left behind by fixes earlier in the same review cycle.** Round 3's vacuous pass was *opened* by round 1's permissive-row fix, which emptied the requirement set without anyone asking what an empty set meant downstream. Round 3's silent cap was round 1's silent cap, in the same file, twelve lines from code edited for exactly that defect. Round 4's integrity failure was round 2's fix — a function written to answer "was this traversal complete?" that checked denials and not truncation, and so answered *yes* over a use-case list cut at 20.

**Why this is a ruling rather than twelve fixed bugs.** The file's own header cites R-6, R-11, R-15 and R-22 — the four rulings about precisely this failure — and then committed eleven instances of it. Being *aware* of the pattern demonstrably did not prevent it; each instance was locally reasonable and the bound was always applied in one place while the answer was reported in another, with nothing structurally connecting them. Fixing instances one at a time was **not converging**: rounds 3 and 4 both produced fresh instances of a defect class that the previous round had supposedly addressed.

**Change — the invariant is enforced in `PaToolReadKit`, not remembered by callers.**

1. **`readRows` reads `limit + 1` and returns `limit`.** `rows.length === limit` cannot distinguish a truncated result from an exactly-full one, and every consumer of that ambiguity in this codebase resolved it optimistically. One extra row turns the guess into a fact, and `result.truncated_at` is now a measurement rather than a heuristic.
2. **Every truncation is recorded centrally** in `data.truncations` by the kit itself, keeping the largest bound per table. A core cannot fail to *know* it truncated; it can only choose how to present it.
3. **Every core's `evidence_basis` surfaces `data.truncations`** with a note that any count or absence derived from those tables is a **lower bound**. This is the structural half: a silent cap now requires deleting a line from the evidence block, not merely forgetting one at a call site.
4. **Standing rule, the one that generalises:** *a bound, an exclusion, a denial or an empty set must travel with the answer it shaped.* Any code path that narrows what was read and then reports a conclusion must state the narrowing in the same object as the conclusion. "Reported somewhere in the payload" is not enough — R-19b's lesson applies here too: **the status label is part of the claim**, so a `comparison_status` of `completed` computed over a truncated input is a false statement regardless of what a neighbouring note says.

**Method note, and the reason to trust these twelve fixes more than the earlier ones.** Every guard added from round 2 onward was **mutation-tested**: the fix was reverted and the test confirmed to fail. That caught a real problem — my first regression test for round 2's partial-comparison defect passed without ever reaching the branch it claimed to cover, because the table-level test stub could not deny one user's roles and not another's. It would have shipped as a green test over an unguarded fix, which is the same class of defect as the code it was guarding: *an artefact that looks like verification and is not.*

**Open, and deliberately not closed here:** the other five cores were written in the same style and are unreviewed. `PaToolGenAiLog.check_config` caps at 100 definitions against ~2026 rows, and `PaToolQueryTable`'s empty-result verdict rests on an unfiltered count that can itself be unavailable. They inherit items 1–3 automatically by using the kit, but their *consumers* of truncation have not been audited. That sweep is a work item, not a record (R-18c).

---

**R-25 — The second half of R-24's invariant: a status is a claim, and only the path that established it may write one. (2026-08-01)**

**Found:** review rounds 5 and 6 on `PaToolAgentConfig`. R-24 made *truncation* structural and the class stopped recurring on that axis — but the same failure simply moved to the adjacent one. `validFields`, a field probe that reads **no rows at all**, wrote `ok` into `data.reads`:

- `ok` is set by `readRows` only when `rows.length > 0`. It means *"the read succeeded and rows were present"* — a claim about **data**.
- The probe asked a **schema** question. It was in no position to make that claim.
- And because `noteRead` only ever *upgrades*, a later read returning zero rows **could not correct it**. The evidence block would report a table as readable-with-data on the strength of a question that fetched nothing.

A second defect in the same function: on a mid-probe throw it returned before recording anything, so a consumer checking only for `DENIED` proceeded on a `valid` list that is a **prefix** of the candidates rather than an answer about them.

**Why this needed a ruling and not a third fix.** The composition is what makes it dangerous. `role_list` is a column a partial probe can miss; missing it empties the requirement set; and R-22's fix reports an empty requirement set as `no_requirements` — *"nothing was required"* — when the truth is *"we could not tell what was required"*. **Three individually-correct mechanisms compose into a confident wrong answer**, and no single one of them is wrong. Reviewing each in isolation would never find it.

**Change — enforced, not remembered:**

1. **`noteRead` requires a `fromRowRead` flag for a success status.** Exactly two callers pass it: `readRows` and `readOne`. Everything else may record only `DENIED` and `unknown`, which are facts about **access** rather than about data and which any path can legitimately observe.
2. **A rejected assertion is recorded** in `data.read_status_rejected` rather than dropped, so the attempt is visible instead of merely absent — the same reasoning as R-24's truncation record.
3. **A source-level guard** asserts no core passes a success literal to `noteRead`, mirroring R-24's heuristic lint. Both halves matter: the runtime one stops the write, the source one stops the pattern.
4. **A partial probe records `unknown`, flags itself, and returns `probed` alongside `valid`** so a prefix cannot be mistaken for an answer. Both consumers stop rather than reading with a truncated column list.

**The generalised rule, which is R-24's stated in full.** R-24 said *a bound must travel with the answer it shaped*. R-25 is the other half: **a status may only be written by the operation that established it.** Together: *every claim in a diagnostic result names what backed it, and nothing may assert a claim it did not earn.* That is now enforced for the two claim types this tool makes about a read — how much it saw, and whether it saw anything.

**Assessment, stated plainly.** Sixteen findings across six rounds on one file, fifteen of one class. Six were introduced or left behind by fixes earlier in the same cycle. The pattern only stopped recurring on an axis once that axis had a **mechanical** control — `limit + 1`, the contract test, and now the `fromRowRead` flag. Every axis governed only by attention regressed. The honest generalisation for the remaining cores is that they are not safe because they were written carefully; they are safe only where a control makes the defect impossible, and the rest is unverified.

---

**R-26 — The third axis, and the reason the first two guards could not see it: a control against a wrong line does not catch a missing one. (2026-08-01)**

**Found:** review of `PaToolGenAiLog` (PR #38, round 2). `_forExecution` handled a denied `sn_aia_execution_plan` read with an explicit privilege-gap note and then **never checked `taskRead.status` or `m2mRead.status`**. So a denied `sn_aia_gen_ai_m2m` returned `llm_calls: []` — shaped exactly like a run that genuinely called no provider — and a denied `sn_aia_execution_task` silently collapsed the join to the plan sys_id alone, reporting zero task ids as though the execution had no steps.

**Why this is a third ruling and not a repeat of R-24.** The same *failure* on a new *axis*. An empty collection in this codebase has three causes and they are not interchangeable:

| cause | axis | control before this ruling |
|---|---|---|
| nothing matched | — | the genuine finding |
| the page was clipped | bound | **R-24** — `limit + 1`, central record, evidence block |
| the read was refused | denial | **none** — fixed case by case in `PaToolAgentConfig`, never generalised |
| (and the status itself unearned) | status | **R-25** — `fromRowRead` flag, source guard |

**The methodological finding, which matters more than the fix.** Neither R-24's nor R-25's guard could have caught this, and the reason is structural rather than an oversight: **both scan for a pattern** — a length comparison, a success literal. Here there was no pattern to find, because the check was simply **absent**. A control against a *wrong line* does not catch a *missing* one. The same blind spot produced PR #38's first finding (a bound with no report at all), and I confirmed it by asking the question the guards could not — *which reads have a bound or a denial, and which answers carry one* — which then surfaced two further instances in `PaToolSchemaLookup` and `PaToolQueryTable` that no sweep had flagged.

**Change:**

1. **`PaToolReadKit.deniedTables(data)`** returns the tables that came back `DENIED`, so a core can name the gap rather than leave a reader to infer absence.
2. **Every core's `evidence_basis` carries `denied_tables` and `denial_note`**, the exact analogue of R-24's truncation block, enforced by the same cross-core contract test.
3. **`_forExecution` states it on the answer**, not only in the evidence: `llm_calls_status` becomes `unavailable`, with a note saying an empty `llm_calls` here is a permission gap and is indistinguishable *in shape alone* from a run that called no provider.

**Standing rule, completing R-24 and R-25.** Three axes, one sentence: **every claim names what backed it — how much was read, whether anything was, and whether the read was permitted — and no claim may be asserted by a path that did not establish it.** All three now have a mechanical control and a cross-core test.

**What is still uncontrolled, stated so it is not mistaken for solved.** The guards catch a *wrong* line; nothing catches a *missing* one. The only instrument that found those was the manual question above, run over every read. That is a checklist, not a control, and it is the honest boundary of what this file's review cycle has achieved: seventeen findings across seven rounds, fifteen of one class, and the class stopped recurring on an axis only once that axis had a mechanism — never because the code was read more carefully.

---

**R-27 — R-23 verified field NAMES; nothing verified field VALUES. Two high defects shipped through that gap, and both were masked by fixtures that seeded the assumption under test. (2026-08-02)**

**Found:** PR #39 review, both findings high, both measured on gpinst01 before fixing:

1. **A reference's display value is the target's LABEL, not its name.** `PaToolSchemaLookup`'s hierarchy walk advanced with `super_class_display` and fed it into the next `name=` query. Measured: `sn_aia_agent.super_class` displays as **"Application File"**, not `sys_metadata` — so the walk died after one hop and reported every inherited column as absent. That is the false schema mismatch the tool exists to prevent, produced by the tool, on its primary path (every AIA table extends `sys_metadata`). The walk now advances by the raw reference value — the sys_id — which is the one identifier the next lookup can trust; the label is carried for the reader only.
2. **A choice field stores the VALUE, not the label.** `PaToolLogAnalysis` filtered `syslog.level IN ('Error','Warning')`. Measured against `sys_choice` (name=syslog, element=level, all 6 rows): Trace=−2, Debug=−1, Information=0, **Warning=1, Error=2, Fatal=3**. The label filter matches nothing, ever — so on the one instance where the syslog read IS permitted, the tool returns an empty log layer over logs that exist. Defaults are now the stored values for Warning-and-worse; a caller's label maps through the measured table, and anything else passes through with a note.

**Why R-23's rule did not catch either.** R-23's standing rule — *a field list written from a design document is unverified until `sys_dictionary` has been asked* — was followed for both tools, and it answers only *does this column exist and what type is it*. `sys_dictionary` says `level` is a string and `super_class` is a reference; it says nothing about what a reference **displays as** or what a choice field **stores**. Names and values are different axes, and only the first had a rule.

**The masking, which is the R-8 lesson a third time.** Both defects had green unit tests, because both fixtures seeded the assumption under test: the schema fixture put the parent's *name* in the display field, the log fixture put the *label* in the level column. A stub built from the code's own beliefs verifies nothing but internal consistency. The fixtures now encode the measured semantics — raw ref = sys_id, display = label, level = stored value — so the wrong implementation *fails against realistic data*, which is the only kind of unit test that carries information about this class.

**Standing rule, extending R-23:** for every reference column a tool dot-walks, joins on, or feeds into a subsequent query, and for every choice column a tool filters on, the **runtime value shape** must be measured — one display-value read, one `sys_choice` read — before the code is written. And the fixture must encode the measured shape, not the convenient one: *a fixture that agrees with the code by construction is a second copy of the bug.*

---

*Next steps agreed in spar: fold changes 2.1–2.4 into `docs/IMPLEMENTATION_PLAN.md` (new collector task; scorecard field; anchor keying rule) and `docs/LOW_LEVEL_DESIGN.md` (§4.6 anchor spec, §7 protocol, §8 items). Drift review after Phase 1a build compares the built system to this record.*
