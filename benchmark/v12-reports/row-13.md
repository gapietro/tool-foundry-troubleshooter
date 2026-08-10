# Fix Report — Seed 04 Summarizer

**Plan:** `27eea5be2b2687d817a6ffbeee91bff2` | **Agent:** Seed 04 Summarizer (`8bac1f84f3a1481487fe8dd219295914`)

---

## FAILURE SUMMARY

The user asked the agent to summarise bench ticket `BENCH0001042`. The LLM correctly chose the `summarise_ticket` tool, which executed and returned `ok: false, status: error, result: null`. The capability (`x_snc_tsbench_unmapped_capability`) has its `api` field set to the null sentinel `00000000000000000000000000000000`, resolving to no `sys_hub_flow` record — so the executor has no provider flow to dispatch through. Compounding this, both the tool record and its agent binding are marked **inactive**, so the tool would be unavailable even if the capability were repaired. The target record exists and is readable; the data layer is not at fault.

---

## LAYERS SWEPT

| # | Layer | Status |
|---|-------|--------|
| 1 | Execution trace | ✅ SWEPT — via `agent_trace` + `read_artifact` |
| 2 | Instructions | ✅ SWEPT — instructions are sound |
| 3 | Tool definitions | ✅ SWEPT — script and schema read via `agent_config` |
| 4 | Data schemas | ✅ SWEPT — `x_snc_tsbench_bench_ticket` confirmed via `schema_lookup` |
| 5 | Data | ✅ SWEPT — `BENCH0001042` confirmed present via `query_table` |
| 6 | GenAI stack | ✅ SWEPT — dangling api confirmed via `genai_log check_config`; LLM call confirmed via `genai_log for_execution` |
| 7 | Trigger & wiring | ✅ SWEPT — no triggers; binding inactive confirmed via `agent_config` |
| — | Platform logs | ⚠️ UNAVAILABLE — `syslog` is caller-restricted; instance admin must relax `caller_access` on `syslog` |

---

## ROOT CAUSES

### RC-1 — Capability api points to a non-existent flow *(primary)*
- **Layer:** 6 — GenAI stack
- **Component:** `sys_one_extend_capability_definition` · `904c0485699a4a73a124446a7231c563`
- **Finding:** Field `api` = `00000000000000000000000000000000`; `api_type` = `sys_hub_flow`; no matching row exists in `sys_hub_flow`.
- **Evidence:** `genai_log check_config` → `findings[0].finding = api_dangling`, `field = api`, `value = 00000000000000000000000000000000`; `sys_hub_flow` read status `empty`.
- **Confidence:** ✅ CONFIRMED

### RC-2 — Tool record and agent binding are both inactive
- **Layer:** 3 / 7 — Tool definitions / Wiring
- **Component:** `sn_aia_agent_tool_m2m` · `3c72dab2668c4ba5a6080a5cd5fb2b91`; `sn_aia_tool` · `37d6957bb5cd4bda96fc9a93de494eac`
- **Finding:** `binding_active = false`, `tool_active = false`; `active_tool_count = 0`.
- **Evidence:** `agent_config` artifact → `bindings[0].binding_active = false`, `bindings[0].tool_active = false`; overview `active_tool_count = 0`.
- **Confidence:** ✅ CONFIRMED

### RC-3 — Tool script lacks error handling *(contributing)*
- **Layer:** 3 — Tool definitions
- **Component:** `sn_aia_tool` script · `37d6957bb5cd4bda96fc9a93de494eac`
- **Finding:** No `try/catch` or `gs.error`. Checklist grade C (2/4). Errors from the capability propagate silently.
- **Evidence:** `agent_config` artifact → `checklist.grade = C`, `quality_flags[0].flag = missing_error_handling`.
- **Confidence:** ✅ CONFIRMED

---

## FIXES

### FIX-1 — Repoint capability `api` to a real flow
| | |
|---|---|
| **Target type** | Configuration |
| **Target** | `sys_one_extend_capability_definition` · `904c0485699a4a73a124446a7231c563` · field `api` |
| **Current** | `00000000000000000000000000000000` |
| **Proposed** | `sys_id` of the `sys_hub_flow` record implementing the summarisation provider integration |
| **Rationale** | Fixes RC-1. The executor cannot dispatch without a valid flow reference. |

### FIX-2 — Activate the tool record and binding
| | |
|---|---|
| **Target type** | Wiring |
| **Target A** | `sn_aia_tool` · `37d6957bb5cd4bda96fc9a93de494eac` · field `active` |
| **Current** | `false` |
| **Proposed** | `true` |
| **Target B** | `sn_aia_agent_tool_m2m` · `3c72dab2668c4ba5a6080a5cd5fb2b91` · field `active` |
| **Current** | `false` |
| **Proposed** | `true` |
| **Rationale** | Fixes RC-2. An inactive tool is not offered to the agent regardless of capability state. |

### FIX-3 — Add error handling to the tool script
| | |
|---|---|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` · `37d6957bb5cd4bda96fc9a93de494eac` · field `script` |
| **Current** | No `try/catch`; uncaught exception surfaces as generic failure |
| **Proposed** | Wrap the `cap.getCapability(...).execute(...)` call in `try/catch`; on catch, set `outputs.summary = null` and call `gs.error(e.message)` |
| **Rationale** | Fixes RC-3. Surfaces actionable diagnostics when the capability errors. |

---

## VERIFICATION

1. After FIX-1 and FIX-2, re-run the agent with objective: *"Please summarise the bench ticket with sys_id `0aee61be2b2687d817a6ffbeee91bf40`"*.
2. In the new execution trace, confirm: `task_tree[tool].status = Success` and `tool_calls[0].response_digest` contains a non-null `summary`.
3. Run `genai_log check_config` against capability `92ff62af516741769c437feb88c80ef3` and confirm no `api_dangling` finding.
4. Run `agent_config` against the agent and confirm `active_tool_count = 1`.

---

## DATA MARKERS

The following record data was quoted as evidence and should be redacted before this report leaves the instance:
- Bench ticket `short_description`: *"Test bench ticket for summarisation"* (table `x_snc_tsbench_bench_ticket`, `sys_id 0aee61be2b2687d817a6ffbeee91bf40`)
- User profile: email `admin@example.com`, name *System Administrator* (from execution message stream)
References: null