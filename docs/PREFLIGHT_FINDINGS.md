# Phase 0 Pre-Flight Findings

**Instance:** keynexus01.service-now.com · **Run date:** 2026-07-30
**Spec:** `docs/superpowers/specs/2026-07-30-preflight-agent-doctor-design.md`
**Status:** in progress

## Verdict

_Filled by Task 12._

## Phase 0a — Read-only reconnaissance

### P1 — Now Assist Panel and product plugin (LLD §8.10)

**Step 1 — Plugin query.**

`sys_plugin` is not queryable on this instance:

```
Table: sys_plugin
Query: active=true^nameLIKENow Assist^ORnameLIKEnow_assist^ORidLIKEsn_now_assist
Result: ERROR — "Failed to query table \"sys_plugin\": Request failed with status 400: Invalid table sys_plugin"
```

Retried against `v_plugin` per fallback instruction, using the exact query from the brief:

```
Table: v_plugin
Query: active=true^nameLIKENow Assist^ORnameLIKEnow_assist^ORidLIKEsn_now_assist
Result: "No records found in \"v_plugin\" matching query ... Try adjusting your query or checking the table name."
```

This empty result turned out to be a query-syntax artifact, not an empty table: `v_plugin.active` stores the literal choice string `active`/`inactive`, not the boolean `true`/`false` the brief's query assumed. Confirmed by probing `v_plugin` with `active=true` (0 records) and then with no query filter at all (5 records returned, `active` field showing values `active`/`inactive`). Recording both, verbatim, since the brief's exact-query result was empty and that emptiness is itself a finding:

```
Table: v_plugin, Query: active=true, limit 5
Result: "No records found in \"v_plugin\" matching query: active=true."

Table: v_plugin, Query: (all records), limit 5
Result: Found 5 record(s):
[1] id: com.snc.self_service_analytics_core | name: Self-Service Analytics Core | active: active | version: 28.0.3
[2] id: com.snc.service_portfolio.demo_data | name: Service Portfolio Management Foundation Demo Data | active: inactive | version: 1.0.0
[3] id: com.snc.skills_management.seed_data | name: Skills Library Data for Skills Management | active: inactive | version: 1.0.0
[4] id: com.snc.sn_app_fsm_scheduling_flows | name: Field Service Management Scheduling Automations | active: inactive | version: 28.0.14
[5] id: com.snc.universal_request.reporting | name: Universal Request: Reporting | active: inactive | version: 1.0.0
```

To get a usable answer, re-ran the name/id filter from the brief's query without the broken `active=true` clause (this is a corrected re-run of Step 1, not a new/different investigation — the table that ultimately answered is **`v_plugin`**):

```
Table: v_plugin
Query: nameLIKENow Assist^ORnameLIKEnow_assist^ORidLIKEsn_now_assist
Result: Found 2 record(s):
[1] id: com.now_assist_core | name: Now Assist Core | active: active | version: 28.10.8
[2] id: com.glide.utilities.capability_step | name: ServiceNow Call Now Assist Skill Step Plugin | active: active | version: 1.0.0

Table: v_plugin, Query: idLIKEnow_assist
Result: Found 2 record(s):
[1] id: com.now_assist_core | name: Now Assist Core | active: active | version: 28.10.8
[2] id: com.now_assist_self_service | name: now-assist-self-service | active: active | version: 28.10.8

Table: v_plugin, Query: nameLIKEITSM^ORnameLIKEHR Service Delivery^ORnameLIKECustomer Service^ORnameLIKESecOps^ORnameLIKESecurity Operations
Result: Found 33 record(s) — base ITSM/CSM/SecOps product and Performance Analytics plugins (e.g. "ITSM Spoke" active, "Customer Service" inactive, "Performance Analytics Premium for Security Operations" inactive, "ITSM Guided Setup" active). None of the 33 is a Now-Assist-branded product plugin. Full list retained in Task 2 report file.

Table: v_plugin, Query: nameLIKENow Assist for^ORidLIKEsn_now_assist_itsm^ORidLIKEsn_now_assist_csm^ORidLIKEsn_now_assist_hr^ORidLIKEsn_now_assist_sec
Result: "No records found ... Try adjusting your query or checking the table name."
```

**Step 1 conclusion:** Only `Now Assist Core`, `now-assist-self-service`, and the `Now Assist Skill Step Plugin` are active. No Now-Assist product plugin (ITSM, HRSD, CSM, SecOps) is present or active on this instance.

**Step 2 — `sys_properties` query.**

```
Table: sys_properties
Query: nameLIKEnow_assist^ORnameLIKEnowassist^ORnameLIKEsn_aia
Found: 159 record(s)
```

Full verbatim name/value/description list (all 159 rows, unfiltered) recorded in `.superpowers/sdd/2026-07-30-preflight-agent-doctor/task-2-report.md`. No property among the 159 explicitly disables the Now Assist Panel; the only panel-namespaced properties found are UI strings (`com.glide.cs.now_assist_panel.translating_error`, `com.glide.cs.now_assist_panel.translating_message`, `com.glide.cs.conversation_faulted_reason.now_assist_panel`), not enablement switches. `sn_now_assist_code.enable_code_assist = true` and several `sn_aia.*` agent-framework flags are on, but these govern the AIA/Code Assist frameworks, not panel availability for a product Now Assist use case.

**Step 3 — Product plugin confirmation.** From Step 1: **no** ITSM / HRSD / CSM / SecOps Now Assist product plugin is active (none even exists as a plugin record on this instance under the expected naming). Per LLD §1 the panel requires one of these to be active.

**Step 4 — Verdict.**

```
panel_available: false
```

Failed precondition: **no Now Assist product plugin (ITSM/HRSD/CSM/SecOps) is active** — `v_plugin` shows only `Now Assist Core` / `now-assist-self-service` active, with no product-line Now Assist plugin present at all. No `sys_properties` entry independently disables the panel; the plugin gap alone is sufficient to fail the Step 3 precondition.

Per the brief's Step 4 wording, **this does not stop Phase 0b.** `servicenow_aia_execute` fires an agent through the API without the panel, so E1 and E2 still run — but E1's answer becomes **provisional**, because the production path is the panel and runtime identifiers may differ between the API and panel execution paths. Resolving the missing product plugin is an instance-provisioning task, not a design change, and must be completed before the benchmark.

### P2 — Loop budget (DESIGN 2.2)
_Pending._

### P3 — Execution mode choices (LLD §8.1)
_Pending._

### P4 — Cross-scope reachability (LLD §8.4)
_Pending._

### P5 — GenAI log payloads and ACLs (LLD §8.3, §8.6)
_Pending._

### P6 — User/Data Access role storage (LLD §8.9)
_Pending._

## Phase 0b — Disposable probe agent

### Created records
_Pending. Every sys_id recorded here as created._

### E1 — Runtime context dump (LLD §8.5)
_Pending._

### E2 — 15-call endurance (DESIGN 2.2, 2.3)
_Pending._

### E3 — Data model confirmation (LLD §2.1)
_Pending._

### Cleanup
_Pending._

## LLD §8 disposition
_Filled by Task 12._
