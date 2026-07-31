# Phase 0 Pre-Flight Findings

**Instance:** keynexus01.service-now.com · **Run date:** 2026-07-30
**Spec:** `docs/superpowers/specs/2026-07-30-preflight-agent-doctor-design.md`
**Status:** complete — conditional

## Verdict

### Overall: **CONDITIONAL GO**

Phase 0 set out to falsify the Agent Doctor bet before building it. The bet survived — but not cleanly, and the spec's own rule is explicit: *"a verdict of 'proceed' requires every row above to land on the non-blocking side."* One row (**P1**) landed on the blocking side and one probe (**P4b**) could not be run at all. Neither is a design failure; both are unfinished preconditions. Hence conditional, not go.

**What survived, and it is the important one.** The load-bearing assumption behind Option A — that a native Studio ReAct loop can sustain a 12–15-call autonomous investigation — was tested directly and held: 19 tool calls in one conversation, clean `Completed`, cause-of-death `completed`, 51s. The second benchmark-blocker, `DESIGN.md` 2.4's per-conversation anchor key, was also answered affirmatively. Those were the two results most capable of ending the project early. They did not.

**What is conditional on it.** Two conditions must be discharged before the benchmark, and one before Task 1:

1. **Before the benchmark — provision a Now Assist product plugin on keynexus01** (P1). Until then the Now Assist Panel does not exist, the LLD §7 smoke test and the K26 lab prerequisites cannot run as written, and every Phase 0b result carries an API-path qualification.
2. **Before the benchmark — establish the OOB default of `sn_aia.continuous_tool_execution_limit`** and record per-run which value each scored run executed under (spec §6; filed as `DESIGN.md` ruling R-4). Phase 0 could **not** establish the shipped default — it is genuinely unknown.
3. **At Task 1 — run the scoped-read runtime test that P4b could not** (`GlideRecordSecure` across the §2 table list from inside the `x_pa_*` scope), before any tool core is written against those tables.

Phase 0 does not decide the harness, and this verdict does not pre-empt the `IMPLEMENTATION_PLAN.md` Task 12 gate. It removes one pre-emption that spec §8 would have allowed: E2's result means the "the loop cannot sustain the sweep" evidence does **not** enter the gate decision ahead of any scored run.

### Row-by-row against the spec §5 falsification table

| # | Probe | Falsifying result the spec named | What happened | Verdict |
|---|---|---|---|---|
| 1 | **P1** | Panel off, or no Now Assist product plugin active → **hard stop** | `panel_available: false`. No Now Assist product plugin (ITSM/HRSD/CSM/SecOps) exists or is active — only Now Assist Core, now-assist-self-service, Skill Step Plugin. No property independently disables the panel; the plugin gap alone fails the precondition | **FAILED — landed on the blocking side. CARRIED FORWARD as an instance-provisioning task**, not a design change. Spec §5 pre-committed this row as a **hard stop** ("Phase 0b cannot run"); Phase 0b ran anyway because `servicenow_aia_execute` fires an agent through the API without the panel. **That is a relaxed falsification rule** — relaxed during planning, before results were known — and it is why the verdict is conditional rather than a pass. The substitution is also what makes E1 provisional. See the P1 Step 4 note. Must be closed before the benchmark (`DESIGN.md` R-11) |
| 2 | **P2 + E2** | Fewer than **12** calls complete, by hard stop or stall, ceiling not raisable → native front door capped below the sweep; Phase 1a native build avoided | 19 calls completed | **Did not occur** |
| 3 | **P2 + E2** | **12–14** calls complete → marginal; budget the playbook call-by-call | 19 calls completed | **Did not occur** |
| 4 | **P2 + E2** | All **15** complete cleanly → Option A's core assumption survives; proceed to Task 1 with budget values recorded | 19 calls in one conversation (4 layer-absent + layers 1–15 each exactly once), `state=Completed`, `state_reason` empty, cause-of-death `completed`, 51s. Not capped: m2m `max_auto_executions`=20, property=25 | **PASS.** Recorded budget values: property `sn_aia.continuous_tool_execution_limit` = **25**; `max_auto_executions` dictionary default = **10** (a *different*, per-binding knob), instance distribution 477/483 rows at 10. Two qualifications carried: 19 is close to the 20 attachment cap, so a longer sweep must be re-tested not extrapolated; and this ran on the API path, not the panel |
| 5 | **P3** | No unsupervised/auto mode for `type=script` tools → autonomous sweep impossible natively; the benchmark would measure a different product | `execution_mode` has exactly two active choices, stored values `autopilot` ("Autonomous") and `copilot` ("Supervised"); `sn_aia_tool.type` includes stored value `script`. Both modes are in live production use on script-type attachments — 361 `autopilot` / 23 `copilot` of 384 rows | **PASS.** `unsupervised_available: true`, and it is exercised in production, not merely present in a choice list |
| 6a | **P4a** (static half) | `sn_aia_*` unreadable from a non-global scope → tool cores cannot live in our scope; LLD §6 build approach changes before Task 1 | None of the 11 §2 tables present is `access=none` (not a valid value on this version — the only choices are `public` and `package_private`) and none carries a restrictive `caller_access`. **47 standing `sys_scope_privilege` Read grants** (among 79 privilege rows total — the other 32 are 17 Write, 14 Create, 1 Delete) exist against 8 distinct Read targets among them | **PASS, qualified.** `scoped_read_viable: likely`. Two qualifications on the record: all 79 precedent rows come from **first-party** scopes — **no custom `x_*` precedent** exists; and `syslog` (the real name of the LLD's `sys_log`) carries `caller_access = Caller Restriction`, a live constraint on `PaToolLogAnalysis` (`DESIGN.md` R-12) |
| 6b | **P4b** (runtime half) | same row — runtime confirmation via a background script executed in an existing non-global scope | **NOT EXECUTED.** No background-script executor exists in the Foundry MCP toolset. Six active non-global scoped apps *do* exist, so the proxy would have been possible had the tooling existed. The probe tool's own reads succeeded on all five tables tried, but it ran in `Global` scope, so it does not simulate a restricted `x_pa_*` scope | **CARRIED FORWARD — not a pass.** Reason: tooling gap, not an instance limitation. Becomes a Task 1 first-build verification (`DESIGN.md` R-1) |
| 7 | **E1** | No per-conversation identifier **and** no usable fallback → `DESIGN.md` 2.4's hard-key requirement unsatisfiable; benchmark protocol needs redesign before seeds are built | A script tool receives an undocumented global `_agentic_context_` (a JSON **string**) carrying `agent_id`, `conversation_id`, `usecase_id`, `execution_plan_id`. `conversation_id` was identical across all 19 E2 calls and matches `sn_aia_execution_plan.conversation` | **PASS, provisional.** A genuine hard per-conversation key exists; neither named fallback is needed. Provisional in two respects, both recorded rather than glossed: obtained via the **API path, not the panel** (row 1), and `_agentic_context_` is **undocumented**, so it is not contractually stable across upgrades. Re-confirm on the panel path before the benchmark |

**Summary:** 4 pass (rows 4, 5, 6a, 7 — two of them qualified), 1 failed and carried forward (row 1), 1 not executed and carried forward (row 6b), 2 falsifying results did not occur (rows 2, 3). No row was silently absorbed.

### Transferability statement (spec §6)

Recorded here because spec §6 requires the OOB default be kept separate from any tuned value, and because Phase 0 could not supply it.

- **Current value on keynexus01:** `sn_aia.continuous_tool_execution_limit` = **25**.
- **OOB shipped default:** **UNKNOWN.** The evidence is genuinely ambiguous and was recorded unresolved: `sys_updated_on` is bit-identical to `sys_created_on` (the signature of "never modified since install"), but `sys_updated_by` reads `admin`, not blank. The two signals point opposite ways. The `max_auto_executions` dictionary default of **10** is a *different knob* (per-binding, not instance-wide) and is not a substitute.
- **Binding consequence:** the benchmark scorecard must record **both** budget knobs each run executed under — the property **and** the per-binding `max_auto_executions` on every attached tool — read at run time. The binding matters as much as the property here: E2 reached 19 calls only with `max_auto_executions` set to **20**, against the instance-typical **10**, so a scorecard produced under that binding is no more transferable than one produced under a raised property ceiling. `benchmark/DECISION.md` must state that the OOB default is unknown and that transferability to a default-configured customer instance is therefore **unverified** — it may not treat 25 as the default. Filed as `DESIGN.md` ruling **R-4**.

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
Result: Found 33 record(s) — base ITSM/CSM/SecOps product and Performance Analytics plugins (e.g. "ITSM Spoke" active, "Customer Service" inactive, "Performance Analytics Premium for Security Operations" inactive, "ITSM Guided Setup" active). None of the 33 is a Now-Assist-branded product plugin. Full unfiltered list below.

Table: v_plugin, Query: nameLIKENow Assist for^ORidLIKEsn_now_assist_itsm^ORidLIKEsn_now_assist_csm^ORidLIKEsn_now_assist_hr^ORidLIKEsn_now_assist_sec
Result: "No records found ... Try adjusting your query or checking the table name."
```

<details>
<summary>Full verbatim result — Query: <code>nameLIKEITSM^ORnameLIKEHR Service Delivery^ORnameLIKECustomer Service^ORnameLIKESecOps^ORnameLIKESecurity Operations</code> against <code>v_plugin</code> (33 records, unfiltered)</summary>

```
[1]  id: com.snc.pa.cs.context_sensitive_analytics       | Performance Analytics - Context Sensitive Analytics for Customer Service | active: inactive | version: 1.0.0
[2]  id: com.snc.itsm.notifications_redirection          | ITSM Notifications Redirection                                            | active: active   | version: 1.0.0
[3]  id: com.snc.household                               | Customer Service Household                                                | active: inactive | version: 1.0.0
[4]  id: com.snc.itsm.spoke                               | ITSM Spoke                                                                 | active: active   | version: 1.0.0
[5]  id: com.snc.itsm.virtualagent.lite                    | ITSM Virtual Agent Conversation Topics Lite                               | active: inactive | version: 2.0.3
[6]  id: com.snc.itsm_pa.demo                              | ITSM and PA Demo Data                                                      | active: inactive | version: 1.0.0
[7]  id: com.snc.pa.customer_service                       | Performance Analytics - Content Pack - Customer Service                   | active: inactive | version: 1.0.0
[8]  id: com.snc.pa.itsm_dashboards                         | Performance Analytics - Content Pack - ITSM Dashboards                    | active: inactive | version: 1.0.0
[9]  id: com.snc.pa.premium.all_content                     | Performance Analytics - Content Packs for ITSM                           | active: inactive | version: 1.0.0
[10] id: com.snc.pa.premium.cs                               | Performance Analytics Premium for Customer Service                       | active: inactive | version: 1.0.0
[11] id: com.snc.pa.premium.sir                              | Performance Analytics Premium for Security Operations                    | active: inactive | version: 1.0.0
[12] id: com.snc.guided_setup_metadata.itsm                  | ITSM Guided Setup                                                         | active: active   | version: 1.0.0
[13] id: com.snc.pa.self_service_analytics_csm                | Self-Service Analytics for Customer Service                              | active: inactive | version: 28.0.13
[14] id: com.snc.pa.customer_service_advanced                  | Performance Analytics - Content Pack - Customer Service Management - Advanced | active: inactive | version: 1.0.0
[15] id: com.snc.cs_base_extension                             | Customer Service Base Extension Entities                                 | active: inactive | version: 1.0.0
[16] id: com.snc.csm_action_status                              | Customer Service Case Action Status                                      | active: inactive | version: 1.0.0
[17] id: com.snc.csm_fsm_integration                             | Customer Service with Field Service Management                           | active: inactive | version: 1.0.0
[18] id: com.snc.csm_ml                                           | Predictive Intelligence for Customer Service Management                  | active: inactive | version: 1.0.0
[19] id: com.snc.csm_ocs                                          | Outsourced Customer Service                                              | active: inactive | version: 1.0.0
[20] id: com.snc.csm_time_recording                                | Time Recording for Customer Service                                      | active: inactive | version: 1.0.0
[21] id: com.snc.customer_service.spoke                             | Customer Service Spoke                                                   | active: inactive | version: 1.0.0
[22] id: com.snc.customerservice.demo                                | Customer Service Management Demo Data                                    | active: inactive | version: 1.0.0
[23] id: com.sn_cs_sm                                                 | Customer Service with Service Management                                 | active: inactive | version: 1.0.0
[24] id: com.sn_cs_sm_request                                         | Customer Service with Request Management                                | active: inactive | version: 1.0.0
[25] id: com.sn_cs_social                                              | Customer Service Social Integration                                      | active: inactive | version: 28.0.12
[26] id: com.sn_csm.nlu                                                 | Customer Service NLU Model for Virtual Agent Conversations               | active: inactive | version: 1.0.0
[27] id: com.sn_csm.virtualagent                                        | Customer Service Virtual Agent Conversations                             | active: inactive | version: 1.0.0
[28] id: com.sn_csm_doc_template                                        | Customer Service Document Template                                       | active: inactive | version: 1.0.0
[29] id: com.sn_csm_mobile                                              | Customer Service Mobile                                                  | active: inactive | version: 28.0.12
[30] id: com.sn_customerservice                                          | Customer Service                                                         | active: inactive | version: 28.0.29
[31] id: com.sn_itsm_ettr_card                                           | sn-itsm-ettr-card                                                        | active: inactive | version: 19.0.5
[32] id: com.snc.app_common.service_portal                               | Common ITSM Service Portal Application Components                       | active: active   | version: 1.0.0
[33] id: com.devsnc_sn_itsm_new_record_interceptor                       | @devsnc/sn-itsm-new-record-interceptor                                   | active: active   | version: 24.0.3
```

None of these 33 is a Now-Assist-branded product plugin (e.g. "Now Assist for ITSM", "Now Assist for CSM"). They are base ITSM/CSM/SecOps and Performance Analytics plugins.
</details>

**Step 1 conclusion:** Only `Now Assist Core`, `now-assist-self-service`, and the `Now Assist Skill Step Plugin` are active. No Now-Assist product plugin (ITSM, HRSD, CSM, SecOps) is present or active on this instance.

**Step 2 — `sys_properties` query.**

```
Table: sys_properties
Query: nameLIKEnow_assist^ORnameLIKEnowassist^ORnameLIKEsn_aia
Found: 159 record(s)
```

Full verbatim name/value/description list, all 159 rows, unfiltered, recorded below (this is the finding — not trimmed to what looks relevant). No property among the 159 explicitly disables the Now Assist Panel; the only panel-namespaced properties found are UI strings (`com.glide.cs.now_assist_panel.translating_error`, `com.glide.cs.now_assist_panel.translating_message`, `com.glide.cs.conversation_faulted_reason.now_assist_panel`), not enablement switches. `sn_now_assist_code.enable_code_assist = true` and several `sn_aia.*` agent-framework flags are on, but these govern the AIA/Code Assist frameworks, not panel availability for a product Now Assist use case.

<details>
<summary>Full verbatim result — <code>sys_properties</code> query <code>nameLIKEnow_assist^ORnameLIKEnowassist^ORnameLIKEsn_aia</code> (159 records, unfiltered name/value/description)</summary>

```
1. sn_now_assist_cr.og_ao.catalog_agent.sys_id = 734f698affdff290c74effffffffff55 — This property will be used to discover Catalog Agent offglide
2. sn_aia.enable_specialist_memory_ui = false — Controls the visibility of the specialist memories section within the AIUX framework. When false (default), the Memories nav item and section content are hidden.
3. sn_nowassist_admin.legacy_nap_customer = true — (no description)
4. sn_aia.og_ao.data_collector.engine = ao_native — Determines the data collector engine used in NextWave. Supported values: ao_native, legacy_cs. Defaulted to ao_native.
5. sn_aia.og_ao.aia_kg_widget_generator = llm — Defines the KG widget generation mode for Planner2. Supported values: off | api | llm | api_with_llm_fallback. Defaulted to llm.
6. sn_nowassist_va.analytics.persistence_strategy = event — Indicates how events will get persisted for analytics — event: legacy method (sys_ci_analytics); table: newer method.
7. sn_nowassist_admin.whitelisted_scopes = sn_nowassist_admin,sn_na_center,sn_now_assist_karu — (no description)
8. sn_nowassist_va.is_next_wave_click_metrics_enabled = true — When true (default), the processor uses the next wave click metrics flow and returns the URL persisted in the click metrics record. When false, it skips the lookup and returns the request target_url.
9. sn_aia.og_ao.aia_enable_kg_field_labels = true — Determines if KG response should include fieldLabels. Defaulted to true.
10. sn_aia.og_ao.aia_enable_kg_widgets_using_aix_api = false — Determines if planner2 KG widgets are generated using AIX API. Defaulted to false.
11. sn_nowassist_va.nextwave_anlaytics_enabled = true — flag to enable analytics service for next wave
12. sn_nowassist_va.nextwave_analytics_feature_parity = false — flag to enable analytics, deflection log, click metrics for next wave
13. sn_nowassist_va.nw.auto_suggest_api_type = rest — System property that determines whether to use old graphql or new UR rest API
14. sn_aia.native_worker_execution = false — Controls whether the worker execution runs off-glide (native) or on-glide (non-native).
15. sn_aia.og_ao.enable_processing_messages = true — Controls whether processing messages (progress indicators) should be displayed in the chat conversation. When true, step-by-step status updates are shown. When false, processing messages are suppressed.
16. sn_aia.learn_more_enabled = false — Controls whether the "Learn more" link is displayed within the "Support your team with an AI specialist" section.
17. sn_aia.external_agents.multi_task.enabled = true — Enable multi-task A2A support. When enabled, each request uses a separate taskId, allowing multiple tasks within the same contextId.
18. sn_nowassist_va.enhanced_chat_pin_enabled.esc = true — (no description)
19. sn_nowassist_va.show_voice_input_disabled_georouting_alert = true — Shows a warning banner when voice input is auto-disabled due to geo routing. Directs users to "Additional chat features" to review data residency policies before re-enabling.
20. sn_nowassist_admin.ignoreFulfillerSubscriptionCheck = true — (no description)
21. sn_nowassist_va.nap_preupgrade_experience = self_service_dialog — Used to store what display experience was set for NAP Platform assistant before upgrading NAVA app and getting premium chat. Value should be set through "Create NAP deployment channel" fix script.
22. sn_aia.optimize_existing_rag_tools = false — Default Chunking Strategy Optimization for existing RAG tool.
23. sn_nowassist_va.use_llm_closure_message = true — Using the response message from LLM result as chat closure message, instead of using the hard coded message.
24. sn_aia.og_ao.aia_prompt_version = 1.20 — Temporary property to use 1.19 prompt and post-processing. Supported values: 1.18, 1.19, 1.20. Defaulted to "1.18" in AO when not set.
25. sn_aia.type2_disamb_low_threshold = 4 — The default value is 4. Sets the ambiguity score threshold used when sn_aia.type_2_disamb is set to low.
26. sn_aia.type2_disamb_high_threshold = 2 — The default value is 2. Sets the ambiguity score threshold used when sn_aia.type_2_disamb is set to high.
27. sn_aia.type_2_disamb = off — The default value is off. off/on controls disambiguation/follow-up/clarifying questions.
28. sn_aia.type_1_disamb = false — a boolean flag with default set to True enabling the disambiguation. If false, we use the current flow.
29. sn_nowassist_va.assistant_personalization = AGENT_PERSONA — Property to configure personalization of chat type assistants
30. sn_now_assist_cr.enable_alternative_translation = false — Enables LLM-based translation of selected text when the session language differs from the user's profile language.
31. sn_now_assist_cr.llm.lookup_select_choice_limit = 20 — Specifies the upper limit for the number of choices of a reference question beyond which the item does not support conversational requests. Default value 20.
32. sn_nowassist_va.synthesized_response.shorten_response.disabled = false — System property to determine whether or not we show the "show more" button and if the text will be clamped when it reaches too many lines (default: long text over 6 lines needs "show more").
33. sn_nowassist_va.show_ai_native_experience = false — Used to determine whether to show AI native related configurations in the Assistant Designer chat assistant guided setup (AI native messages, premium chat, etc.)
34. sn_nowassist_va.automatic_session_interval = 300 — Refreshes the session ID after the given interval. Default value 5 min (300 seconds). Unit is seconds.
35. sn_aia.enable_ai_workers = false — (no description)
36. sn_nowassist_va.use_planner2_response_as_fallback = false — Using the response message from planner 2 result as fallback message, instead of using a hard coded fallback msg.
37. sn_aia.last_reflection_mandatory = false — (no description)
38. sn_now_assist_code.disable_user_provider_override = false — Disable end-user ability to select an AI provider that overrides instance configurations
39. sn_aia.enable_conversational_debugger = false — Enable Conversational Debugging in AIA Studio. When set to true, the Analysis button will show up in the Testing Playground next to "Chat responses" button.
40. sn_nowassist_va.show_help_enhanced_chat = false — Show the need more help button in enhanced chat to take the users to the configured fallback topic.
41. sn_aia.memory_scope_enabled = false — System property to enable Memory Scope
42. sn_aia.rich_control_enabled = true — (no description)
43. sn_aia.glide_react_enabled = false — This property turns the Glide implementation of AIA-ReAct topic on/off.
44. sn_aia.topic_tool_output_refiner.enabled = false — (no description)
45. sn_aia.agent_hierarchy_enabled = true — System property to enable Agent Hierarchy
46. sn_aia.deep_research_limits = { "initial_subquery_limit": 10, "reflection_limit": 0, "reflection_depth_cutoff": 2, "max_chunk_size_tokens": 512, "search_type": "hybrid", "search_results_limit": 20, "doc... (truncated in source output) — This property defines a number of global limits for deep research retrieval, planning and reflection.
47. sn_aia.external_agents.manual_configuration_enabled = false — The manual integration protocol for external agents is no longer supported and disabled by default.
48. sn_now_assist_cr.enable_ref_qualifier_checks_on_large_tables = false — Specifies whether reference qualifier filters should be honored on tables with records exceeding limit set in sn_now_assist_cr.llm.reference_question_choices.limit property. Advised to use this ...
49. sn_aia.agent_parallel_tool_execution.enabled = true — (no description)
50. sn_aia.internal_agents.enabled_external = true — (no description)
51. sn_nowassist_va.nava_oct25_first_time_install = true — This system property is unloaded only during the first-time installation of nowassist_va store app from YP8+ and ZP2+
52. sn_aia.supported_tools = action,flow,subflow,script,capability,rag,knowledge_graph,crud — Comma-separated list of tool types that should be routed through the Glide Java layer for processing. Enables specific tool types to leverage the Glide platform's Java-based execution.
53. sn_now_assist_code.disable_snowsk8s_autocomplete = false — A property to let the user disable or enable use of SnowSk8s for autocomplete feature.
54. sn_aia.skip_reflection_for_last_objective = true — (no description)
55. sn_aia.reactive_planner.override_to_swarm = true — System property to override the Reactive Planner across all use cases, converting it to the Swarm Planner. This enables agents within a use case to directly communicate with each other, without fallin...
56. sn_aia.max_allowed_preferred_skills = 20 — Maximum number of allowed preferred skills.
57. sn_aia.workflow_orchestration_threshold = 30 — (no description)
58. sn_aia.enable_java_capability_execution = true — (no description)
59. sn_nowassist_va.display_default_catalog_image = true — Sysprop to show or not show the default image for catalog cards on NAVA when the corresponding catalog does not have an associated image.
60. sn_nowassist_va.agentic_synth_topic_block = f4d35c19b7632210d84c3e43ce11a95f — (no description)
61. sn_aia.use_agents_in_planner = true — This property controls if the Unified Planner in the fully Agentic mode execution prefers "Agents" over Catalog/Skills.
62. sn_aia.stream_end_patterns = **Actions**,**Act,**Action,**Actions — Ending stream patterns for AIA Planner2
63. sn_nowassist_va.enable_nass_show_all_options = false — Displays the "Show all options" button in the dynamic window UI
64. sn_nowassist_va.transcript_message_read_limit_conversation_history = 50 — The number of sys_cs_messages to read to create the conversation history in the sys_gen_ai_message_history table.
65. sn_aia.enable_perf_logs = false — (no description)
66. sn_nowassist_gs.agentic_nap_usecase_skill = d8d41fbeb7f22210d84c3e43ce11a946 — (no description)
67. sn_aia.external_agent_guardian_check = true — (no description)
68. sn_aia.external_agents.enabled = true — (no description)
69. sn_aia.enable_deep_research_tool = false — System property to enable addition of Deep Research Tools from AI Agent Studio
70. sn_aia.enable_trigger_AI_user = false — System property to enable selecting AI users as run_as_user for triggers.
71. sn_aia.list_item_max_limit = 25 — Default list item limit for any typeahead or select component
72. sn_aia.episodic_memory_limit = 5 — Maximum number of episodic memories to inject into prompt when an Agent is invoked. Allowed values less than or equal to 5.
73. sn_now_assist_code.code_gen_system_prompt = "# You are a ServiceNow JavaScript expert. Generate precise, efficient code for the ServiceNow platform, focusing on: 1. ServiceNow APIs (GlideRecordSecure, GlideSystem, etc.) 2. Server-side vs cli..." (truncated in source output) — (no description)
74. sn_aia.enable_model_availability_check = false — (no description)
75. sn_aia.conversational_workflows = 802d751eff942210d09effffffffff73,808453beb7f22210d84c3e43ce11a9f4 — Comma-separated list of workflow sys_ids for enabling conversational orchestration.
76. sn_aia.use_global_graph = true — Enables global graph in KG as a tool for AI Agents
77. sn_aia.external_agents.user_data_access.enabled = false — Enables or disables gaining of insights across your ServiceNow data for smarter automation and more accurate responses.
78. sn_aia.external_agents.stm_access.enabled = true — Enables or disables stored user memories to be utilized in AI agent interactions.
79. sn_aia.external_agents.ltm_access.enabled = true — Enables or disables user memories from past interactions to be collected and utilized in future interactions to enhance the overall user experience.
80. sn_nowassist_va.nass_show_end_flow_button = true — Property to controls whether to show or hide an end flow button. Default value is true
81. sn_nowassist_va.max_suggested_queries = 6 — The maximum number of suggested queries that can be displayed in the VA
82. sn_nowassist_va.enable_suggested_queries = false — This determines whether or not we show suggested queries in the default greetings topic
83. sn_now_assist_cr.enable_question_grouping = false — This sys prop is deprecated, DO NOT use it.
84. sn_aia.agent_orchestration_threshold = 30 — Minimum number of agents required to enable dynamic orchestration.
85. sn_aia.enable_episodic_memory = true — Enable episodic memory. When enabled, episodic memories from past interactions will be collected and stored in sn_aia_memory and utilized in future interactions to enhance the overall experience.
86. sn_aia.use_episodic_memory_for_ai_agent = true — Enable episodic memory injection for AI agent interactions. When enabled, stored user memories will be utilized in AI agent interactions.
87. sn_now_assist_cr.recommend_form_question_threshold = 10 — when the catalog item number of the questions exceed this limit, conversational catalog will recommend the user to complete the request in (pop-up) form. When this value is -1, the conversational cat...
88. sn_nowassist_va.enhanced_chat_pin_enabled.sp = true — Enables the pinned mode for enhanced chat for (sp) portal.
89. sn_nowassist_va.max_aia_conversational_tool_iteration = 10 — The maximum number of times a particular tool can be executed consecutively in the AIA - Conversational strategy
90. sn_aia.va_share_conversation_history = true — If this value is true, va conversation history will be shared with AIA Orchestrator.
91. sn_aia.enable_mcp_tool = true — System property to enable addition of MCP Tools from AI Agent Studio
92. sn_nowassist_va.aia_conversational.max_user_turns = 9 — Number of user turns (excluding current user query) which should be added into the Conversational ReAct prompt.
93. sn_aia.agent_strategy_choice_enabled = true — Enable the property to show the LLM reasoning strategy in the agent setup screen.
94. sn_aia.context_sharing_strategy = summarise — This property defines the strategy to use for storing short-term memory for an execution.
95. sn_nowassist_va.router_redirect_va_agentic = ROUTER_DECISION — ROUTER_DECISION is default, which directs as per routers outputs. If NEVER, it will default to QnA if decision was "agent" from router. If ALWAYS, any router response will be ignored and sent to "agen...
96. sn_nowassist_va.enable_suggested_actions = false — Valid values for this sysprop are: true, false, log_only. Note: values are case sensitive.
97. sn_nowassist_va.agentic_va_usecase_skill = 49475ba2ff502210d84cffffffffff06 — The sysId of the sn_aia_usecase that is tied to the virtual agent
98. sn_aia.quick_mode_failure_retry_max_limit = 3 — System property to define maximum limit for retries in case of a failure in Quick Mode execution.
99. sn_nowassist_va.websearch_fallback_enabled = no_response_from_aisearch,no_response_from_llm — (no description)
100. sn_aia.follow_up_qna_failure_limit = 1 — This property defines the limit to exit execution if this number of consecutive question answers are not available in the follow-up.
101. sn_aia.enable_follow_up = true — Enabling this flag allows users to continue the conversation with follow-ups after the use case is completed.
102. sn_aia.follow_up_message = How else can I help you? — This property defines a follow-up message sent after execution is completed.
103. sn_nowassist_va.standard_chat_enabled = true — Determines whether users can have standard chat enabled for their NAVA assistants
104. sn_aia.allow_context_sharing = true — This property enables the sharing of short-term memory, allowing context to persist across execution within the same conversation.
105. sn_aia.user_context_data = profile — This property defines a comma-separated list of user context data to be used with AI Agents. This list will be used to pick the data available from knowledge graph API: getUserContext.
106. sn_now_assist_cr.enable_knowledge_graph = true — This flag is used to determine whether to enable knowledge graph slot fill from VA initial slot fill prompt. By default, it is false to disable knowledge graph.
107. sn_nowassist_va.doc_qna.show_summary_and_example_questions = true — (no description)
108. sn_genai_platform.now_assist_platform.mar25.fresh_install = true — This sytem property is unloaded only during the first-time installation of sn_genai_platform store app from YP1+ or XP7+
109. sn_aia.llm_consent_provided = MODEL_AVAILABLE — (no description)
110. sn_aia.agent_tool_supported_output_data_types = integer,long,boolean,string,string_full_utf8,choice,email,glide_duration,glide_date,due_date,glide_date_time,schedule_date_time,calendar_date_time,date_time,url,decimal,float,char,ip_address,day_of_we... (truncated) — This property defines a comma-separated list of supported output data types for tools used by agents for IntegrationHub spoke. Each value corresponds to the name field of records in the sys_glide_obj...
111. sn_aia.enable_aiagents_discovery = false — Enable displaying discovery options on AI agent page. When set to true, component for enabling discovery options shows on AI agent page.
112. sn_vad_genai.now_assist.search.user_knowledge_graph.enabled = true — Indicates that VA NowAssist should include KnowledgeGraph user data when performing a search.
113. sn_aia.continuous_communicator_output_limit = 5 — Defines the maximum number of continous output messages that the Orchestrator or Agent can trigger to show something to users.
114. sn_aia.mid_skill_switch_enabled = false — Disable mid skill switching within AI Agents. This forces non-LLM enhanced input collection within all the framework topics of AI Agents.
115. sn_aia.enable_va_conversation = true — Enable displaying AI agent output in Virtual Agent (VA) conversations. When set to true, component for enabling shows on usecase page.
116. sn_aia.max_scheduled_trigger_query = 10 — System property to define maximum limit for querying target records in target table in scheduled triggers.
117. sn_aia.ltm.category.auto_create = true — Enable the automatic creation of categories. When this feature is enabled, categories will be generated based on AI agent details using an LLM if no matching categories exist.
118. sn_aia.ltm.enable_long_term_memory = true — Enable long-term memory. When enabled, user memories from past interactions will be collected and utilized in future interactions to enhance the overall user experience.
119. sn_aia.ltm.use_memory_for_ai_agent = true — Enable long-term memory for AI agent interactions. When enabled, stored user memories will be utilized in AI agent interactions.
120. sn_now_assist_code.async_max_payload_size = 7056 — Max payload size when using Now Assist for code generation in async mode
121. sn_now_assist_code.enable_auto_complete = true — Globally disabled autocomplete functionality for CodeAssist enabled editors (description text as returned by the instance)
122. sn_aia.analytics_dashboard_sysid = 370f503383721210bf0991b0222bc094 — The sysid of the dashboard that is linked from AI Agent Studio. Default is: 370f503383721210bf0991b0222bc094
123. sn_aia.react_failure_retry_max_limit = 3 — System property to define maximum limit for retries in case of a failure in ReACT execution.
124. sn_now_assist_code.autocomplete_debounce_time = 500 — The debounce time (in milliseconds) before the autocomplete is triggered.
125. sn_now_assist_code.enable_async = true — (no description)
126. sn_nowassist_va.ai_search.topic_reduction.enabled = true — Use the time reduction framework for fast AI search result display.
127. sn_aia.agent_tool_supported_input_data_types = integer,long,boolean,string,string_full_utf8,choice,email,glide_duration,glide_date,due_date,glide_date_time,schedule_date_time,calendar_date_time,date_time,url,decimal,float,char,ip_address,day_of_we... (truncated) — This property defines a comma-separated list of supported input data types for tools used by agents for IntegrationHub spoke.
128. sn_aia.maximum_agent_tools = 20 — Defines the maximum number of tools that can be associated with a single agent, specifically those created for IntegrationHub spokes.
129. sn_nowassist_va.show_view_more_for_synthesized = (empty value) — This property determines whether or not we show the "view more" card to show regular search results for different scenarios (otherwise it is only shown if no answer is found). This is a comma-separate...
130. sn_aia.enable_usecase_tool_execution_mode_override = false — Enable running use cases FULLY autonomously. When set to true, usecases with an "Autonomous" execution mode will override the execution mode setting for all the agents' tools under the use case.
131. sn_nowassist_va.nass_streaming_enabled = true — If true, streaming is enabled on NASS
132. sn_nowassist_va.synth_response_revisit_position = AFTER_FALLBACK — Determine where the "Revisit 'X'" option appears in the regular results list after clicking on "View more options" in the synthesized response
133. sn_aia.glide.ai.agents.tools.topics = ad1ea74b7f851210035737e0fc866536,1c2b92bb93585210aa5730f1648918ee — (no description)
134. sn_nowassist_admin.enable_va_modality = false — (no description)
135. sn_nowassist_va.ais_call_mechanism = router — This sytem property specifies how we call the AI search server to fetch results. Applicable only to Async AI Search Requests.
136. sn_aia.continuous_tool_execution_limit = 25 — Maximum limit for continuous, uninterrupted executions for the same tool.
137. sn_now_assist_cr.log.level = info — (no description)
138. sn_aia.use_clummerization = true — This property is used as flag for clummerization usage in AI agents
139. sn_nowassist_va.honor_search_source_order_in_genius_result = false — Show genius result in carousel in search source order.
140. sn_nowassist_va.nass_evam_config_id = abc7b0e27309d2100714eee2ef148bd2 — Default EVAM Configuration for NASS
141. sn_now_assist_cr.llm.accept_user_input_as_is = 0 — When filling out catalog forms in NowAssist chat window, this allows users input to be taken as is, even if AI assistant is not sure if the answer is appropriate. Applies only to textual fields.
142. sn_nowassist_va.nass_animated_avatar_enabled = true — Enbales sparkle icon animation during loading states.
143. sn_nowassist_va.synthesized_autostart_items = topic,agent,agent_with_sources — When a synthesized response returns just one action item, this will decide which scenarios that action item can auto-start (skipping the synthesized output response). Comma-separated list.
144. sn_nowassist_va.nass_notification_enabled = true — If true, Virtual Agent notifications are enabled on the full-page experience.
145. com.glide.cs.now_assist_panel.translating_error = Sorry! Translations unavailable — (no description)
146. com.glide.cs.now_assist_panel.translating_message = Chat is dynamically translated — (no description)
147. sn_now_assist_code.enable_code_edit = true — (no description)
148. sn_now_assist_cr.llm.reference_question_choices.limit = 2000000 — Specifies the upper limit for the number of choices of a reference question beyond which the item does not support conversational requests. Default value 2,000,000.
149. sn_nowassist_va.fdih_aisearch_execution_mode = async — Determines which fdih action to use for running ai search in now assist
150. sn_now_assist_cr.llm.conversational.request.question.limit = 500 — Specifies the upper limit for the maximum number of questions, beyond which the item does not support conversational requests using LLM. When -1, forces all catalog items conversational.
151. sn_nowassist_va.enable_mid_topic_ai_search_catalog_result = false — Enable or disable AI Search Catalog result in Mid Topic Discovery using this flag.
152. sn_nowassist_va.now.assist.generic.ticket.fallback.subflow = sn_nava_config.fetch_generic_ticket_producer_for_conversational_catalog_request — (no description)
153. sn_nowassist_va.now.assist.generic.ticket.fallback.record.producer = ec6040f3778231105e3db2a07b5a99b0 — (no description)
154. sn_nowassist_va.setup_updated = true — (no description)
155. sn_now_assist_code.collect_schema_for_code_assist = true — (no description)
156. com.glide.cs.conversation_faulted_reason.now_assist_panel = Conversations with Now Assist end after a period of inactivity. Start a new one to ask more questions. — Message that displays when a conversation has faulted in the Now Assist Panel channel
157. sn_now_assist_code.enable_code_assist = true — Enable Now Assist for code generation
158. sn_now_assist_code.show_ai_code_line_marker = true — (no description)
159. sn_now_assist_code.log_edited_response = true — Turn on/off logging of editor current content
```

</details>

**Step 3 — Product plugin confirmation.** From Step 1: **no** ITSM / HRSD / CSM / SecOps Now Assist product plugin is active (none even exists as a plugin record on this instance under the expected naming). Per LLD §1 the panel requires one of these to be active.

**Step 4 — Verdict.**

```
panel_available: false
```

Failed precondition: **no Now Assist product plugin (ITSM/HRSD/CSM/SecOps) is active** — `v_plugin` shows only `Now Assist Core` / `now-assist-self-service` active, with no product-line Now Assist plugin present at all. No `sys_properties` entry independently disables the panel; the plugin gap alone is sufficient to fail the Step 3 precondition.

Per the brief's Step 4 wording, **this does not stop Phase 0b.** `servicenow_aia_execute` fires an agent through the API without the panel, so E1 and E2 still run — but E1's answer becomes **provisional**, because the production path is the panel and runtime identifiers may differ between the API and panel execution paths. Resolving the missing product plugin is an instance-provisioning task, not a design change, and must be completed before the benchmark.

**Named plainly: this is a relaxed falsification rule.** Spec §5 pre-committed "P1 fails → **hard stop**, Phase 0b cannot run," and Phase 0b ran anyway. That pre-commitment was relaxed **during planning, before any result was known** — the plan's Task 2 Step 4 wording (and Task 7's stated precondition) introduced the API path — not after seeing that P1 had failed, which is the failure mode the pre-commitment existed to prevent. The relaxation is sound on its merits: the API path (`servicenow_aia_execute`) does not require the panel, so E2's endurance result is unaffected by the panel's absence, and E1 was recorded **provisional** rather than closed precisely because the panel is the production path. It is nonetheless a relaxation of a rule that was fixed in advance so it could not be relaxed, and it is the reason this verdict is **CONDITIONAL** rather than a pass.

### P2 — Loop budget (DESIGN 2.2)

**Step 1 — Continuous execution limit property.**

```
Table: sys_properties
Query: nameLIKEcontinuous_tool_execution^ORnameLIKEtool_execution_limit
Fields: name, value, description, sys_created_on, sys_updated_on, sys_updated_by
Result: Found 1 record(s)

[1] sys_id: 8611f7a4433112106c3603295bb8f219
  name: sn_aia.continuous_tool_execution_limit
  value: 25
  description: Maximum limit for continuous, uninterrupted executions for the same tool.
  sys_created_on: 2024-11-08 07:21:07
  sys_updated_on: 2024-11-08 07:21:07
  sys_updated_by: admin
```

Note on interpretation: `sys_updated_by` is **not** empty here — it reads `admin`, not blank — which at first glance looks like evidence of a manual change. But `sys_updated_on` is bit-for-bit identical to `sys_created_on` (`2024-11-08 07:21:07`, same to the second), which is the actual signature of "never modified after creation": ServiceNow stamps `sys_updated_by`/`sys_updated_on` at insert time too, and plugin-seeded properties are frequently inserted under the `admin` user rather than a `system` account, depending on how the install ran. Recording both facts verbatim rather than resolving them into a single verdict: (a) `sys_updated_by = admin`, not empty; (b) `sys_updated_on == sys_created_on` to the second. (b) is the stronger signal of "untouched since install." No corrective re-query was run against a different field — this is the one property record that matched, returned as-is.

**Step 2 — `sn_aia_agent_tool_m2m` schema and dictionary default for `max_auto_executions`.**

`servicenow_schema` (28 fields total, full list below) confirms `max_auto_executions` exists as type `integer`, labeled "Maximum auto executions" — but the schema tool's output does not surface a dictionary default value, so a direct `sys_dictionary` query was run as a follow-up to get it:

```
Table: sys_dictionary
Query: name=sn_aia_agent_tool_m2m^element=max_auto_executions
Result: Found 1 record(s)

[1] sys_id: d8444c242f37f210f824ac1bcfa4e399
  element: max_auto_executions
  internal_type: integer
  default_value: 10
  mandatory: false
  active: true
  sys_created_on: 2026-03-19 16:32:09
  sys_updated_on: 2026-03-19 16:32:09
  sys_updated_by: system
```

`sys_updated_on == sys_created_on` here too, and `sys_updated_by = system` — consistent with an untouched, plugin-installed dictionary entry. Dictionary default: **10**.

<details>
<summary>Full field list — <code>sn_aia_agent_tool_m2m</code> (28 fields, extends <code>sys_metadata</code>, scope <code>sn_aia</code>, not extendable) — needed by Task 5 and Task 7</summary>

```
display_mode (choice) "Display Mode"
execution_mode (choice) "Execution mode"
agent (reference → sn_aia_agent) [mandatory] "Agent"
pre_run (boolean) "Pre Run"
requires_widget_transformation (boolean) "Requires Widget Transformation"
should_display_refined_message (boolean) "Should display refined message"
widgets (glide_list → sys_ux_widget) "Widgets"
sys_domain (domain_id) "Domain"
transformation_instructions (string) "Transformation instructions"
entity (table_name) "Entity"
entity_id (document_id) "Entity ID"
name (string) [mandatory] "Name"
output_transformation_strategy (choice) "Output transformation strategy"
tool (reference → sn_aia_tool) [mandatory] "Tool"
post_message (translated_text) "Post message"
sys_id (GUID) "Sys ID"
tool_attributes (json) "Tool attributes"
inputs (json) "Inputs"
display_output (boolean) "Display output"
description (string) "Description"
timeout (integer) "Timeout"
pre_message (translated_text) "Pre message"
requires_text_refined_message (boolean) "Requires text refined message"
sys_overrides (reference → sn_aia_agent_tool_m2m) "Overrides"
post_processing_script (script) "Post processing script"
max_auto_executions (integer) "Maximum auto executions"
active (boolean) "Active"
document_status (choice) "Document status"
```

</details>

**Step 3 — What agent/tool pairs actually use, instance-wide.**

The brief's exact query (`fields: agent, tool, max_auto_executions, execution_mode, output_transformation_strategy, display_output, active`, `displayValue: all`, `limit: 200`) was run first and hit the 200-row page limit ("Found: 200 record(s) (limit reached)") — **not** an empty result, but a truncated one, which is its own kind of misleading-if-uninvestigated result per the brief's rule 5. Re-ran with `limit: 500` to get the true total:

```
Table: sn_aia_agent_tool_m2m
Fields: agent, tool, max_auto_executions, execution_mode, output_transformation_strategy, display_output, active
displayValue: all, limit: 500
Result: Found 483 record(s) (no further truncation — 483 < 500)
```

This is materially different from the brief's framing of "the 19 OOB agents": the table holds **483** agent-tool mappings spanning **141 distinct `agent` display values** (including 15 rows where `agent` resolved to empty — i.e. an orphaned/broken reference, and 4 rows where `agent` is a bare sys_id string rather than a resolved name, suggesting deleted or inaccessible agent records). This instance is not limited to the 19 shipped OOB agents — it carries a much larger population of agents (custom, CoE-built, and product-shipped) with tool bindings. The distribution below is over the full instance-wide population actually present, not a filtered "OOB-only" 19-agent subset — no field on this table distinguishes OOB-shipped agents from custom ones, so that filter could not be applied without a separate join to `sn_aia_agent` scope/vendor metadata, which the brief did not request.

`max_auto_executions` distribution across all 483 rows:

```
value 10  → 477 rows
value 3   →   3 rows
value 2   →   2 rows
value 50  →   1 row
```

The non-default rows, by agent/tool:

```
max_auto_executions=3, agent="Incident Category Configuration AI Agent", tool="Validate and Process Categories", execution_mode=Autonomous
max_auto_executions=3, agent="Incident Category Configuration AI Agent", tool="Bulk Category Importer", execution_mode=Autonomous
max_auto_executions=3, agent="Incident Category Configuration AI Agent", tool="Database Manager", execution_mode=Autonomous
max_auto_executions=2, agent="Incident Category Configuration AI Agent", tool=19d43b0f2ffe7210b488941bcfa4e35a (unresolved sys_id), execution_mode=Autonomous
max_auto_executions=2, agent="ITSM incident resolution investigation AI agent", tool="AIA RAG Retriever", execution_mode=Autonomous
max_auto_executions=50, agent="Smart Documents Agent", tool="Get answer from document", execution_mode=Autonomous
```

Other cross-tabs recorded for completeness: `active` — 482 `true` / 1 `false`; `execution_mode` — 459 `Autonomous` / 24 `Supervised`.

<details>
<summary>Full verbatim per-agent row counts (141 distinct <code>agent</code> display values, from the 483-row / limit:500 query)</summary>

```
(empty/unresolved agent reference) 15
AI Search Configuration Agent 5
AI Search XCC Agent 7
AICT Security Analyzer Agent 2
Additional incident context AI agent 4
Approval Assistance Agent 5
Architecture KB Analyzer 2
Architecture KB Analyzer v2 2
Architecture KB Analyzer v3 2
Architecture KB Analyzer v4 1
Architecture KB Analyzer v5 2
Architecture KB Analyzer v6 1
Automation Finder 3
Automation Table Discovery Agent 3
CAB Configuration Agent 2
CI form contextual help AI agent 2
CMDB CI creator AI agent 2
CMDB Data Model Navigator Agent 1
CMDB Staleness Remediation AI agent 4
CMDB Visibility Analyzer Agent 5
CMDB data certification and attestation manager AI agent 2
CMDB data ownership manager AI agent 3
CMDB health metrics manager AI agent 3
CMDB life cycle manager AI agent 2
CMDB lifecycle insights AI agent 3
CMDB principal class manager AI agent 5
CMDB search AI agent 3
Catalog Agent 6
Categorize ITSM incident AI agent 2
Change CI suggestion AI agent 4
Change Models Configuration Agent 4
Change Request Plans AI Agent 3
Change Risk Configuration Agent 6
Change Schedule Configuration Agent 7
Change Team Role Configuration Agent 5
Change conflict assessor AI agent 10
Change outage assistant AI agent 5
Change quality assessor AI agent 7
Classify service and CI AI agent 2
Clone FAQ Agent 1
Clone Troubleshooting Agent 1
Configuration item summarization AI agent 1
Create Incident AI Agent 3
Create incident with voice AI agent 1
Data Visualization Generation Agent 1
Data and Policy Configuration Agent 6
Decomposition Agent 5
Document and visual insights AI agent 6
Edit Model Provider Agent 5
Elastic Log Analyst 2
Email Generator Agent 2
Email action and information AI agent 11
Error Analysis and Remediation Agent 7
Explain SLA 4
Find catalog item AI agent 1
Guardian Settings Modifier Agent 4
Guardian Settings Modifier Agent NAC 4
Guardian Settings Viewer Agent 3
Guardian Settings Viewer Agent NAC 3
ITSM incident resolution investigation AI agent 4
ITSM incident resolution plan investigation AI agent 3
Image Processor Agent 6
Incident Category Configuration AI Agent 4
Incident context AI agent 4
Incident knowledge article AI agent 4
Incident known error article AI agent 2
Incident resolution details AI agent 4
Incident routing configuration agent 4
Incident trends analyzer 1
Instruction Refinement AI agent 2
Intent Executor Agent 3
Intent Identification Agent 2
Issue readiness 2
Issue trend analysis AI agent 3
KB content consolidation AI agent 1
KB content creation AI agent 2
Language Configuration Agent 2
Link incident to problem AI agent 2
Link major incident or problem AI Agent 3
Manage ticket with voice AI agent 4
Model Provider Policy Agent 1
Model Provider Query and History Agent 4
Model Version Modifier Agent 7
Model Version Viewer Agent 3
NAC Help Agent 1
Next action recommendation AI agent 8
Notification Agent 13
Notification Content Agent 7
Password reset with voice AI agent 3
Performance analysis AI agent 2
Playbook Activity Context Agent 1
Playbook data gathering and processing agent 7
Prioritize work AI agent 4
Proactive Escalation AI Agent 2
Problem investigator 3
Problems investigation AI agent 2
Recommend Service Graph Connectors AI agent 1
Record field value prediction AI agent 10
Record management AI agent 11
Request Status Agent 6
Request catalog item with voice AI agent 7
SGC Debugger AI Agent 7
SHA Diagnostic Agent 1
SIGNAL Diagnosis Agent 3
SIGNAL Resolution & Routing Agent 3
SRE Context Test — Mock Data Gatherer v2 1
SRE Context Test — Mock ITSM Enricher v2 1
SRE Context Test — Mock Telemetry Collector v2 1
SRE Context Test — SRE Analyst v2 1
SRE Elastic Log Analyzer v1 2
Schedule Change Request AI Agent 4
ServiceNow Record Navigator 2
Skill Configuration AI Agent 2
Skill Configuration Agent 2
Skill Discovery AI Agent 2
Skill Discovery Agent 2
Smart Documents Agent 1
Standard change template proposal AI agent 3
Standard change template recommender AI agent 3
Submit account unlock catalog with voice AI agent 1
Suggested Actions AI Agent 8
Survey Analysis AI agent 2
Survey analyzer 1
Survey filling answer suggester 1
Survey filling data collection AI agent 1
Survey filling data collector 1
Survey requirement collector 1
Survey response suggestion AI agent 1
Theme Builder Agents 1
Translation Settings Agent 3
Troubleshoot outlook issue with voice AI agent 2
Troubleshooting Agent 4
UI Builder Agent 17
Update work plan AI agent 1
Web Automation Agent 1
Web research and recommendation AI agent 2
Work Allocator AI Agent 2
cfe83365ffe0c7108b82ffffffffff84 (unresolved sys_id) 1
e1ea5d623be1b210712d6764c3e45aae (unresolved sys_id) 1
e79ccf80333c4310c92afba19e5c7b6f (unresolved sys_id) 1
e83f0971fb10c31015fcfee34eefdcb7 (unresolved sys_id) 1
```

</details>

**Step 4 — Recorded values and verdict.**

```
oob_default: 10   (sys_dictionary default_value for max_auto_executions on sn_aia_agent_tool_m2m; sys_updated_on == sys_created_on, sys_updated_by = system → untouched since install)
current_value: 25 (sys_properties sn_aia.continuous_tool_execution_limit; sys_updated_on == sys_created_on, but sys_updated_by = admin, not empty — see Step 1 caveat)
oob_m2m_distribution: 477/483 rows at 10 (the dictionary default), 3 rows at 3, 2 rows at 2, 1 row at 50 — overwhelmingly clustered at the shipped default, with a handful of deliberate per-tool overrides both below (2–3) and above (50) the default; none of the 483 rows sit anywhere near the property-level ceiling of 25
```

These two numbers are **not the same knob**: `sn_aia.continuous_tool_execution_limit` (25) is an instance-wide property governing continuous/uninterrupted executions of the *same tool*, while `max_auto_executions` (dictionary default 10) is a per-agent-tool-binding field on `sn_aia_agent_tool_m2m` governing that specific tool binding's auto-execution ceiling. They differ in scope (global vs. per-binding) and in value (25 vs. 10), and neither shows unambiguous evidence of manual tuning on this instance — both have `sys_updated_on == sys_created_on`, though the property's `sys_updated_by = admin` (not blank) leaves a residual ambiguity flagged above rather than resolved.

**Predicted E2 ceiling:** the operative per-tool-call ceiling for any given OOB-shaped agent-tool binding is **10** (the `max_auto_executions` dictionary default that 477/483 rows actually carry), not the property value of 25 — the property is a broader, same-tool continuous-execution safety net that sits above the per-binding ceiling and would only bind if a binding's own `max_auto_executions` were raised past it (as the one outlier at 50 does). Task 9 (E2) should expect the loop to stop at 10 auto-executions for a default-configured tool binding, with the possibility of stopping earlier if a specific binding has been configured below default (as seen on 6 of the 483 rows here), and should treat 25 as the instance-wide backstop rather than the expected per-tool stop point.

### P3 — Execution mode choices (LLD §8.1)

**Step 1 — `execution_mode` choice list (`sn_aia_agent_tool_m2m.execution_mode`).**

```
Table: sys_choice
Query: name=sn_aia_agent_tool_m2m^element=execution_mode
Fields: value, label, sequence, inactive
Found: 2 record(s)

[1] sys_id: 1c444c242f37f210f824ac1bcfa4e3e7 | sequence: 200 | inactive: false | label: Supervised | value: copilot
[2] sys_id: d8444c242f37f210f824ac1bcfa4e3e7 | sequence: 100 | inactive: false | label: Autonomous | value: autopilot
```

Exact stored values (not labels): **`copilot`** = Supervised, **`autopilot`** = Autonomous.

**Step 2 — tool `type` choice list (`sn_aia_tool.type`).**

```
Table: sys_choice
Query: name=sn_aia_tool^element=type
Fields: value, label, sequence, inactive
Found: 14 record(s)

[1]  sequence: 900  | inactive: false | label: Web Automation          | value: web_automation
[2]  sequence: 1200 | inactive: false | label: Knowledge Graph         | value: knowledge_graph
[3]  sequence: 100  | inactive: false | label: Flow Action             | value: action
[4]  sequence: 500  | inactive: false | label: Topic                   | value: topic
[5]  sequence: 1000 | inactive: false | label: Topic Block             | value: topic_block
[6]  sequence: 1300 | inactive: false | label: Desktop Automation      | value: desktop_automation
[7]  sequence: 200  | inactive: false | label: Subflow                 | value: subflow
[8]  sequence: 600  | inactive: false | label: Catalog                 | value: catalog
[9]  sequence: 1100 | inactive: false | label: Deep Research           | value: deep_research
[10] sequence: 300  | inactive: false | label: Capability              | value: capability
[11] sequence: 700  | inactive: false | label: Record Operation        | value: crud
[12] sequence: 1100 | inactive: false | label: Search Retriever        | value: rag
[13] sequence: 400  | inactive: false | label: Script                  | value: script
[14] sequence: 800  | inactive: false | label: Model Context Protocol  | value: mcp
```

All 14 `inactive: false`. Exact stored value meaning "script": **`script`** (label "Script", sequence 400) — confirms LLD §5's assumption.

**Step 3 — cross-check against real usage.**

Per Task 3 Step 3 (P2 section above), `sn_aia_agent_tool_m2m` holds 483 rows across 141 distinct `agent` display values instance-wide, with no field distinguishing OOB-shipped agents from custom/CoE-built ones. The brief's reference to "the 19 OOB agents" does not correspond to any isolable subset on this instance — that filter cannot be applied. Reporting the `execution_mode` distribution across **script-type tool attachments as a whole** instead, per corrected instruction:

Exact reproducible query (verbatim MCP call, `servicenow_query`):

```json
{"table": "sn_aia_agent_tool_m2m", "query": "tool.type=script",
 "fields": ["sys_id", "agent", "tool", "tool.type", "execution_mode", "active"],
 "displayValue": "all", "limit": 500}
```

```
Found: 384 record(s) (no truncation — 384 < 500, so the full population)

execution_mode distribution (script-type tool attachments only, 384 rows):
  Autonomous (stored value: autopilot) → 361 rows
  Supervised (stored value: copilot)   → 23 rows
active: true → 384 / 384 (all 384 script-type m2m rows are active; 0 inactive)
```

Both `sys_choice` values (`autopilot`, `copilot`) are in live production use on script-type tools — this is not a choice that exists only in the dictionary/choice list with zero real usage. `autopilot` (Autonomous/unsupervised) is the overwhelming majority: 361/384 = 94.0% of script-type tool attachments instance-wide.

Durability note: the raw 384-row dump (~71K chars incl. sys_id/tool.type/active per row) is not reproduced here in full — re-running the exact query above regenerates it byte-for-byte, and the total/split above (361/23/384) is the arithmetic result of that query, verifiable by re-running it. Instead of pasting all 384 trimmed rows, only the **minority case — the 23 `Supervised` (copilot) rows** — is recorded verbatim below, trimmed to `agent | tool | execution_mode`, since these are the exception worth inspecting individually; the 361 `autopilot` rows are recorded as a count only (this is an explicit, reasoned omission, not a silent one — the count is independently re-derivable by running the query above and counting `execution_mode: Autonomous` occurrences, or by subtracting 23 from the total of 384).

<details>
<summary>Verbatim — the 23 <code>Supervised</code> (<code>execution_mode=copilot</code>) rows out of 384 script-type tool attachments, trimmed to <code>agent | tool | execution_mode</code></summary>

```
Model Version Modifier Agent | Model version Updater | Supervised
Model Version Modifier Agent | Model version configuration Modifier | Supervised
Data and Policy Configuration Agent | Update Data Overflow Processing | Supervised
Data and Policy Configuration Agent | Update Data Sharing Opt Out | Supervised
Elastic Log Analyst | Post Elastic Analysis | Supervised
Elastic Log Analyst | Get Elastic Logs | Supervised
SRE Elastic Log Analyzer v1 | Post Elastic Analysis to Work Notes | Supervised
SRE Elastic Log Analyzer v1 | Get Elastic Logs | Supervised
Architecture KB Analyzer v3 | Get KB Article Image Attachment | Supervised
Architecture KB Analyzer v3 | Search KB for Architecture | Supervised
Architecture KB Analyzer v2 | Search KB for Architecture | Supervised
Architecture KB Analyzer v2 | Get KB Attachment Image | Supervised
Architecture KB Analyzer | Search KB for Architecture | Supervised
Architecture KB Analyzer | Get KB Attachment Image | Supervised
Theme Builder Agents | Open Theme Builder Tool | Supervised
Change quality assessor AI agent | Record the quality summary of the Change Request | Supervised
Instruction Refinement AI agent | Create version | Supervised
Change quality assessor AI agent | Set chosen Change Fields | Supervised
Change conflict assessor AI agent | Set Change Work Note | Supervised
Change quality assessor AI agent | Set Change Field | Supervised
Schedule Change Request AI Agent | Schedule the change | Supervised
Change quality assessor AI agent | Set Change Work Note | Supervised
Change conflict assessor AI agent | Update Change request's planned start date and planned end date | Supervised
```

</details>

**Step 4 — recorded result and verdict.**

```
unsupervised_available: true
execution_mode=autopilot
```

`autopilot` is the exact literal that means unsupervised/autonomous execution on `sn_aia_agent_tool_m2m.execution_mode` — not the label "Autonomous". The tool-type literal for "script" is `script` (not the label "Script") on `sn_aia_tool.type`. Both literals are confirmed both in `sys_choice` metadata (Steps 1–2) and in live production usage on this instance (Step 3: 361 script-type m2m rows already run with `execution_mode=autopilot`). Proceed — Task 7 should write `execution_mode=autopilot` verbatim, attached to a tool whose `type=script`, when creating the probe m2m row.

### P4 — Cross-scope reachability (LLD §8.4)

**Why this matters:** if any §2 table is unreadable from a non-global scope, the diagnostic tool cores cannot live in their own scoped app, and LLD §6's build approach changes before Task 1. Step 1's `access`/`caller_access` values are the load-bearing data for that call.

**Step 1 — table access settings, brief's exact query.**

```json
{"table": "sys_db_object",
 "query": "nameINsn_aia_execution_plan,sn_aia_execution_task,sn_aia_tools_execution,sn_aia_message,sn_aia_agent,sn_aia_tool,sn_aia_agent_tool_m2m,sn_aia_usecase,sn_aia_trigger_configuration,sys_gen_ai_usage_log,sys_gen_ai_log_metadata,sys_log",
 "fields": ["name", "label", "access", "caller_access", "read_access", "sys_scope"],
 "displayValue": "all", "limit": 100}
```

Result: **"Found: 11 record(s)"** — one short of the 12 names in the query. `sys_log` did not match anything (recorded verbatim below, then investigated).

| name | label | sys_scope | access | caller_access | read_access |
|---|---|---|---|---|---|
| sn_aia_message | Message | Now Assist AI Agents | (empty) | (empty) | true |
| sn_aia_usecase | Use case | Now Assist AI Agents | (empty) | (empty) | true |
| sn_aia_tools_execution | Tools Execution | Now Assist AI Agents | (empty) | (empty) | true |
| sn_aia_agent_tool_m2m | Agent Tool | Now Assist AI Agents | (empty) | (empty) | true |
| sn_aia_agent | AI Agent | Now Assist AI Agents | (empty) | (empty) | true |
| sn_aia_tool | Tool | Now Assist AI Agents | (empty) | (empty) | true |
| sn_aia_trigger_configuration | AIA Trigger Configuration | Now Assist AI Agents | (empty) | (empty) | true |
| sn_aia_execution_task | Execution Task | Now Assist AI Agents | (empty) | (empty) | true |
| sn_aia_execution_plan | Execution Plan | Now Assist AI Agents | (empty) | (empty) | true |
| sys_gen_ai_log_metadata | Gen AI Log Metadata | Global | (empty) | (empty) | true |
| sys_gen_ai_usage_log | Generative AI Usage Log | Global | (empty) | (empty) | true |

**Investigating the missing `sys_log`.** Re-queried `sys_db_object` with `name=sys_log` alone: **"No records found in \"sys_db_object\" matching query: name=sys_log."** — verbatim, confirmed not a typo-of-display, the table literally does not exist under that name. Broadened to `nameLIKEsyslog^ORnameLIKEsys_log` (limit 20): returned 20 `syslog_*` extension/partition tables (e.g. `syslog_awa*`, `syslog_data_privacy*`, `syslog_cancellation*`), capped at the 20-row limit requested, but none named exactly `syslog`. Direct follow-up `name=syslog` (limit 10) resolved the real base table:

```
Table: sys_db_object, Query: name=syslog, limit 10
Found: 1 record(s)
[1] name: syslog | label: Log Entry | sys_scope: Global | access: (empty) | caller_access: Caller Restriction | read_access: true
```

This is the one materially different value found anywhere in Step 1: `syslog` (the base System Log table LLD §2's "sys_log" almost certainly intends) carries **`caller_access: Caller Restriction`**, not empty — a real, restrictive, non-default setting. It is a genuine choice, not a display artifact: `sys_choice` for `sys_db_object.caller_access` (queried below) has exactly two values, `1 = "Caller Tracking"` and `2 = "Caller Restriction"`, and `sys_dictionary` confirms `caller_access.default_value` is empty (`choice: "Dropdown with -- None --"`), so an *empty* value is the unrestricted default and `syslog`'s explicit "Caller Restriction" is a deliberate departure from it.

Interpreting the "(empty)" values on the 11 real §2 tables: `sys_dictionary` for `sys_db_object.access` shows `default_value: public`, `choice: "Dropdown without -- None -- (must specify a default value)"` — and `sys_choice` for that element lists only two values, `public` ("All application scopes") and `package_private` ("This application scope only"); **`none` is not a valid choice for `access` on this instance/version at all.** So an empty `access` resolves to the default, `public`. Empty `caller_access` resolves to no restriction (per the dictionary default above). Applying the brief's Step 1 rule ("`access=none`, or a restrictive `caller_access`, means a scoped app cannot read it regardless of privileges granted"): **none of the 11 §2 tables is `access=none`** (impossible value on this instance) **and none carries a restrictive `caller_access`** — all 11 are effectively `access=public` / no caller restriction. The one restrictive `caller_access` found anywhere in this probe belongs to `syslog`.

**Correction — `syslog` is NOT out of scope; it is a live constraint on a shipped Phase 1a tool.** An initial pass at this section framed `syslog`'s restrictive `caller_access` as "outside the §2 tool-core list" and therefore not a concern. That framing was wrong, verified against this repo:

- `docs/AGENT_DOCTOR_ARCHITECTURE.md` §4, line ~87: the tool roster table lists `log_analysis` → `PaToolLogAnalysis`, whose stated data source is `sys_log`, "**mandatory-scoped**."
- `docs/LOW_LEVEL_DESIGN.md` §4.4, lines ~217–221: a full mandatory-scoping rule for `PaToolLogAnalysis` querying that table (bounded time window, level ≤ Warning, source/message conditions), citing the K26 guidebook's `syslog.filter` discipline.
- `docs/LOW_LEVEL_DESIGN.md` §6, line ~263: `log_analysis` is named as one of exactly 7 tools in the Phase 1a tool roster ("nothing else gets added").
- `docs/LOW_LEVEL_DESIGN.md` §2 does not list the system log table among tables deferred out of Phase 1a — it is in scope for the shipped build.

`PaToolLogAnalysis` runs inside the scoped app — that is exactly the situation this P4 probe exists to test. A restrictive `caller_access` on the table it reads is therefore a **live design constraint that must be resolved at build time** (either a `sys_scope_privilege` Read grant against `syslog` from the tool's scope, or a documented fallback), not an irrelevance to wave off.

**Second, related defect — table-name inconsistency in the design docs themselves.** The design docs name this table `sys_log`, which **does not exist** on this instance (Step 1 above: `sys_db_object` query for `name=sys_log` returned zero rows, verbatim). The real table is `syslog`. The docs are internally inconsistent about this:

- `docs/AGENT_DOCTOR_ARCHITECTURE.md` line 63 and line 87 both say `sys_log`.
- `docs/LOW_LEVEL_DESIGN.md` line 96, line 102 ("never open `sys_log` unfiltered"), and line 112 all say `sys_log` — but line 102 and line 221 also both reference `syslog.filter` as "the sanctioned pattern" / "the platform's own... discipline," using the correct name in the same breath as the incorrect one.

A tool script written to query the documented name `sys_log` verbatim would fail outright on this instance (as this probe's own Step 1 query demonstrated). This naming defect needs correcting in `AGENT_DOCTOR_ARCHITECTURE.md` and `LOW_LEVEL_DESIGN.md` before `PaToolLogAnalysis` is built — left for a later task; not corrected here per this task's read-only/no-cross-section-edit scope.

**Step 2 — cross-scope privilege precedent, brief's exact query.**

```json
{"table": "sys_scope_privilege", "query": "targetLIKEsn_aia^ORtargetLIKEsys_gen_ai",
 "fields": ["source", "target", "operation", "status"], "displayValue": "all", "limit": 200}
```

Result, recorded verbatim: **"Found: 200 record(s) (limit reached)"** — the exact round-number-at-cap pattern flagged as a known instance surprise. Every returned row showed only `sys_id`, `operation`, `status`; **`source` and `target` never appeared in the output at all**, for any of the 200 rows. Investigated rather than accepted:

- Re-ran the identical query at `limit: 5`, `displayValue: "true"` — same result, `source`/`target` still absent from every row.
- `servicenow_schema` on `sys_scope_privilege` shows the real field names are **`source_scope`** (reference → `sys_scope`), **`target_scope`** (reference → `sys_scope`), **`target_name`** (string), **`target_type`** (string) — there is no `source` or `target` field on this table. The brief's query names fields that do not exist.
- `servicenow_aggregate` with the brief's exact filter (`targetLIKEsn_aia^ORtargetLIKEsys_gen_ai`) returned **`count=3031`**. `servicenow_aggregate` with no filter at all on the same table also returned **`count=3031`** — identical. This confirms the filter condition silently no-op'd (unknown field name in an encoded query was ignored rather than erroring) and the brief's query, as literally written, returned an **unfiltered** first page of the whole table, not a filtered one. The "limit reached" message was real, but the 200 rows it capped were not the 200 highest-relevance matches — they were just the first 200 rows of `sys_scope_privilege` in default order.

Corrected re-run using the real field names, same intent as the brief's query:

```json
{"table": "sys_scope_privilege", "query": "target_nameLIKEsn_aia^ORtarget_nameLIKEsys_gen_ai",
 "fields": ["source_scope", "target_scope", "target_name", "operation", "status"],
 "displayValue": "all", "limit": 200}
```

Result: **"Found: 79 record(s)"** — no truncation (79 < 200). This is precedent data, recorded in full:

<details>
<summary>Verbatim — all 79 <code>sys_scope_privilege</code> rows matching <code>target_nameLIKEsn_aia^ORtargetLIKEsys_gen_ai</code> (corrected field names), trimmed to <code>source_scope | target_name | operation | status</code></summary>

```
AI Agent Advisor | sn_aia_tool | Read | Allowed
AI Agent Advisor | sn_aia_team_member | Read | Allowed
AI Agent Advisor | sn_aia_tool | Create | Allowed
AI Agent Advisor | sn_aia_agent | Create | Allowed
AI Agent Advisor | sn_aia_agent_tool_m2m | Write | Allowed
AI Agent Advisor | sn_aia_agent_config | Read | Allowed
AI Agent Advisor | sn_aia_agent_config | Create | Allowed
AI Agent Advisor | sn_aia_agent_config | Write | Allowed
AI Agent Advisor | sn_aia_agent_tool_m2m | Read | Allowed
AI Agent Advisor | sn_aia_agent_tool_m2m | Create | Allowed
AI Agent Advisor | sn_aia_agent | Write | Allowed
AI Agent Advisor | sn_aia_tool | Write | Allowed
AI Agent Advisor | sn_aia_usecase | Read | Allowed
AI Agent Advisor | sn_aia_agent | Read | Allowed
Now Assist for Automation Center | sn_aia_agent | Read | Allowed
Now Assist for Automation Center | sn_aia_usecase | Create | Allowed
Now Assist for Automation Center | sn_aia_agent | Write | Allowed
Now Assist for Automation Center | sn_aia_execution_task | Read | Allowed
Now Assist for Automation Center | sn_aia_execution_plan | Read | Allowed
Now Assist Analytics | sn_aia_execution_plan | Read | Allowed (target_scope: Knowledge Center)
Now Assist Analytics | sn_aia_execution_plan | Read | Allowed (target_scope: Now Assist in Virtual Agent)
Now Assist Analytics | sn_aia_execution_plan | Read | Allowed (target_scope: Now Assist Center)
Now Assist Analytics | sn_aia_execution_plan | Read | Allowed (target_scope: Now Assist Admin Console)
Now Assist Analytics | sn_aia_usecase | Read | Allowed
Now Assist Analytics | sn_aia_execution_task | Read | Allowed
Now Assist Analytics | sn_aia_agent | Read | Allowed
Now Assist Analytics | sn_aia_agent_config | Read | Allowed
Now Assist Analytics | sn_aia_execution_plan | Read | Allowed
Now Assist Admin Console | sys_gen_ai_control_setting | Read | Allowed
AI Desktop Actions Core | sn_aia_agent_tool_m2m | Write | Allowed
AI Desktop Actions Core | sn_aia_agent_tool_m2m | Read | Allowed
Now Assist Analytics | sys_gen_ai_log_metadata | Read | Allowed
Now Assist Analytics | sys_gen_ai_usage_log | Read | Allowed
Generative AI Controller | sn_aia_execution_task_ext_staging | Write | Allowed
Generative AI Controller | sn_aia_memory_ext_staging | Write | Allowed
Generative AI Controller | sn_aia_execution_plan_ext_staging | Create | Allowed
Generative AI Controller | sn_aia_execution_plan_ext_staging | Read | Allowed
Generative AI Controller | sn_aia_memory_ext_staging | Create | Allowed
Generative AI Controller | sys_gen_ai_message_history_ext_staging | Write | Allowed
Generative AI Controller | sn_aia_memory_ext_staging | Read | Allowed
Generative AI Controller | sn_aia_execution_plan_ext_staging | Write | Allowed
Generative AI Controller | sn_aia_execution_task_ext_staging | Create | Allowed
Generative AI Controller | sn_aia_message_ext_staging | Write | Allowed
Generative AI Controller | sn_aia_message_ext_staging | Create | Allowed
Generative AI Controller | sn_aia_execution_task_ext_staging | Read | Allowed
Generative AI Controller | sys_gen_ai_message_history_ext_staging | Create | Allowed
Generative AI Controller | sn_aia_message_ext_staging | Read | Allowed
Generative AI Controller | sys_gen_ai_message_history_ext_staging | Read | Allowed
Generative AI Controller | sn_aia_tools_execution_ext_staging | Read | Allowed
Generative AI Controller | sn_aia_tools_execution_ext_staging | Write | Allowed
Generative AI Controller | sn_aia_tools_execution_ext_staging | Create | Allowed
Now Assist Admin Console | sys_gen_ai_feature_group | Read | Allowed
Now Assist Admin Console | sys_gen_ai_skill | Read | Allowed
Now Assist Admin Console | sys_gen_ai_provider_routing | Read | Allowed
Now Assist Admin Console | sys_gen_ai_routing_selection | Read | Allowed
Now Assist Admin Console | sys_gen_ai_provider | Read | Allowed
AI Security and Privacy | sn_aia_execution_task | Read | Allowed
AI Security and Privacy | sn_aia_tool | Read | Allowed
AI Security and Privacy | sn_aia_team_member | Read | Allowed
AI Security and Privacy | sn_aia_usecase | Read | Allowed
AI Security and Privacy | sn_aia_agent | Read | Allowed
Now Assist Admin Console | sys_gen_ai_filter_config | Read | Allowed
Now Assist Admin Console | sys_gen_ai_filter_config | Create | Allowed
Now Assist Admin Console | sys_gen_ai_filter_config | Write | Allowed
Now Assist Analytics | sys_gen_ai_feature_mapping | Read | Allowed
Now Assist Admin Console | sys_gen_ai_filter_sample | Delete | Allowed
Now Assist Admin Console | sys_gen_ai_filter_sample | Create | Allowed
Now Assist Admin Console | sys_gen_ai_filter_sample | Write | Allowed
Now Assist Admin Console | sys_gen_ai_filter | Write | Allowed
Now Assist Admin Console | sys_gen_ai_filter_sample | Read | Allowed
Now Assist Admin Console | sys_gen_ai_filter | Read | Allowed
Now Assist Admin Console | sys_gen_ai_control_setting_data | Read | Allowed
Now Assist Admin Console | sys_gen_ai_control_data | Read | Allowed
Generative AI Controller | sys_gen_ai_feature_mapping | Read | Allowed
Now Assist Skill Discovery and Execution | sys_gen_ai_message_history | Create | Allowed
Now Assist Skill Discovery and Execution | sys_gen_ai_message_history | Write | Allowed
Now Assist Skill Discovery and Execution | sys_gen_ai_message_history | Read | Allowed
Now Assist Admin Console | sys_gen_ai_skill_applicability | Write | Allowed
Now Assist Admin Console | sys_gen_ai_skill_applicability | Read | Allowed
```

</details>

All 79 rows show `status: Allowed`. Real, standing `Read` grants exist for 8 of the 11 §2 tables (`sn_aia_tool`, `sn_aia_agent`, `sn_aia_usecase`, `sn_aia_execution_task`, `sn_aia_execution_plan`, `sn_aia_agent_tool_m2m`, `sys_gen_ai_log_metadata`, `sys_gen_ai_usage_log`) plus several `_ext_staging` companions and `sys_gen_ai_*` admin/config tables not in the §2 list. No row's `target_name` matched `sn_aia_message`, `sn_aia_tools_execution`, or `sn_aia_trigger_configuration` specifically — their absence from these 79 rows is **not** evidence against reachability (per the brief: no precedent found ≠ impossible), it only means no other scope has yet requested a cross-scope grant against those three specific tables.

Caveat, stated plainly: **every `source_scope` in all 79 rows is a first-party ServiceNow/Now-Assist product scope** (AI Agent Advisor, Now Assist for Automation Center, Now Assist Analytics, Now Assist Admin Console, AI Desktop Actions Core, Generative AI Controller, AI Security and Privacy, Now Assist Skill Discovery and Execution). **None is a custom `x_*` scoped app.** This is precedent that `sys_scope_privilege` Read grants against `sn_aia_*`/`sys_gen_ai_*` targets are mechanically grantable and exercised in production — it is not precedent specifically for a custom scoped app doing so. Recorded as "no custom-scope precedent found," not as a negative verdict.

**Step 3 — non-global scoped apps on this instance, brief's exact query.**

```json
{"table": "sys_scope", "query": "scope!=global^scopeSTARTSWITHx_",
 "fields": ["name", "scope", "version", "active"], "limit": 100}
```

Result: **"Found: 6 record(s)"** (no truncation).

| name | scope | version | active |
|---|---|---|---|
| sdkptesting1 | x_snc_sdktest1 | 0.0.1 | true |
| Acme Incident Triage | x_snc_acme_triage | 0.0.1 | true |
| BootstrapTest | x_snc_bstest_42 | 0.0.1 | true |
| POCKeySREAgent | x_snc_pockeysre216 | 1.0.0 | true |
| Build Agent Troubleshooter | x_snc_build_agent | 0.0.1 | true |
| ServiceNow Update All | x_snc_update_all | 1.0.6 | true |

Yes — **6 non-global scoped apps already exist** on this instance, all active. None of them appears among the 79 `sys_scope_privilege` source scopes in Step 2, so none has (yet) requested or been granted a cross-scope privilege against any `sn_aia_*`/`sys_gen_ai_*` target. This determines that a real scoped-app + background-script runtime test *would* have been possible here (independent of the tooling gap below) — worth knowing before the build.

**Step 4 — recorded result and verdict.**

```
scoped_read_viable: likely
```

Basis: none of the 11 §2 tables actually present (`sn_aia_execution_plan`, `sn_aia_execution_task`, `sn_aia_tools_execution`, `sn_aia_message`, `sn_aia_agent`, `sn_aia_tool`, `sn_aia_agent_tool_m2m`, `sn_aia_usecase`, `sn_aia_trigger_configuration`, `sys_gen_ai_usage_log`, `sys_gen_ai_log_metadata`) is `access=none` (impossible value on this instance/version) or carries a restrictive `caller_access` (all show empty/unrestricted). Standing `sys_scope_privilege` Read grants exist against 8 of the 11 (see Step 2), demonstrating the mechanism works in production, though only from first-party scopes — no custom-scope precedent. No §2 table blocks a scoped read.

**Caveat — `likely` is qualified, not unconditional.** The only table anywhere in this probe with a restrictive `caller_access` (`Caller Restriction`) is `syslog` — the base System Log table, reached only because the brief's literal name `sys_log` does not exist on this instance. Unlike the 11 §2 tables above, `syslog` is **not** irrelevant to Phase 1a: it is the documented data source for `PaToolLogAnalysis` (`log_analysis`), one of the exactly 7 tools in the Phase 1a roster (`docs/AGENT_DOCTOR_ARCHITECTURE.md` §4 line ~87; `docs/LOW_LEVEL_DESIGN.md` §4.4 lines ~217–221 and §6 line ~263), and no §2-table deferral list excludes it. Its restrictive `caller_access` is therefore a **live constraint to resolve at build time** for that one tool (confirm a `sys_scope_privilege` grant is obtainable, or plan a fallback), separate from and not overridden by the "likely" verdict above, which rests only on the 11 actual §2 rows queried in Step 1. Additionally, the design docs' use of the name `sys_log` (which does not exist here; the real table is `syslog`) is an internal documentation inconsistency that must be fixed before `PaToolLogAnalysis` is written, or the tool will fail outright against the documented table name.

Verbatim, as required: **P4b runtime proxy NOT EXECUTED — no background-script executor in the MCP toolset; runtime confirmation carried forward to build time.**

### P5 — GenAI log payloads and ACLs (LLD §8.3, §8.6)

**Step 1 — schema of the three brief-named tables, verbatim.**

```json
{"table": "sys_gen_ai_log_metadata", "includeFields": true, "maxFields": 200}
```
Result: 34 fields. No field holds prompt/response text. Token-count and perf fields only: `prompt_token_count`, `response_token_count`, `output_metadata` (string), `additional_data` (string), plus a polymorphic pointer `metadata_document` (document_id) / `metadata_documents` (glide_list → `sys_gen_ai_metadata_document`) / `metadata_table` (table_name), and `gen_ai_log_id` (reference → `sys_generative_ai_log`).

```json
{"table": "sys_gen_ai_metadata_document", "includeFields": true, "maxFields": 200}
```
Result: 10 fields, all housekeeping (`sys_*`, `metadata_document` document_id pointer, `metadata_table`). No payload text field at all.

```json
{"table": "sys_gen_ai_usage_log", "includeFields": true, "maxFields": 200}
```
Result: 20 fields — licensing/assist-count telemetry (`assists`, `trial_assists`, `license_name`, `feature`, `strategy`, `status`). No payload text field.

Sampled `sys_gen_ai_log_metadata` records (`fields: ["sys_id","metadata_document","metadata_table","additional_data","output_metadata","status","source"]`, limit 5) to confirm rather than assume: `metadata_document`, `metadata_table`, `additional_data`, `source` were empty on every returned row; `output_metadata` held only a `perf_traces` JSON blob (stage timings), never prompt/response content. **None of the three brief-named tables stores the actual prompt/response payload.**

**Corrected finding — the real payload table is `sys_generative_ai_log`.** Followed the `gen_ai_log_id` reference off `sys_gen_ai_log_metadata` and described it:

```json
{"table": "sys_generative_ai_log", "includeFields": true, "maxFields": 200}
```
Result: 44 fields, including **`prompt` (string) "Prompt"** and **`response` (string) "Response"** (plus `untranslated_prompt`, `edited_response`, `prompt_token_count`, `model_name`, `model_version`). Verified populated, not just declared, by sampling 3 records (`fields: ["sys_id","prompt","response","status","source","caller"]`, limit 3):

```
[1] prompt: {"prompt":[{"role":"user","content":[{"text":"You are an AI assistant tasked with analyzing a conversation to extract only meaningful, long-term user-specific facts within predefined categories. Your ...
    response: {\n  "facts": []\n}
[3] prompt: {"systemPrompt":[{"text":"Whenever the mode is show_output_to_user or Collect_input_from_user, the content should follow the resolved session language. If a session_language or explicit language prefe...
    response: [\n  {\n    "agent": "CMDB Visibility Analyzer Agent", "agent_task": "Identify and report all CI Classes currently being discovered in the CMDB..." ...
```

**Closed — payload table and fields: `sys_generative_ai_log.prompt` and `sys_generative_ai_log.response`.** `sys_gen_ai_log_metadata` and `sys_gen_ai_metadata_document` (the two brief named for ACL inspection) hold only metadata/telemetry about a log entry, linked to the payload row via `gen_ai_log_id`.

**Step 2 — ACLs, brief's exact tables plus the corrected payload table.**

`sys_gen_ai_log_metadata` (`servicenow_code {"type":"acl","table":"sys_gen_ai_log_metadata","includeSource":true,"limit":50}`): 10 ACL rows returned, but `servicenow_code` showed only `name`/`operation`/`type`/`active` — no roles. Re-queried `sys_security_acl` directly (`name=sys_gen_ai_log_metadata^operation=read`, limit 20): 2 rows — one `admin_overrides:true` with empty description, one `admin_overrides:false` with description **"Allow read for records in sys_gen_ai_log_metadata, for users with roles (maint, admin)."** The description undersells the actual grant: querying `sys_security_acl_role` for that ACL's sys_id (`c72aba9143fb0210abcf84b49bb8f256`) returned **5** role rows, not 2: `sn_aia.viewer`, `sn_aia.admin`, `sn_nowassist_admin.nsa_admin`, `maint`, `admin`.

`sys_gen_ai_metadata_document` (`servicenow_code` type=acl): 6 rows, all field-level wildcards (`sys_gen_ai_metadata_document.*`), no plain record-level ACL exists (confirmed: `sys_security_acl` query `name=sys_gen_ai_metadata_document^operation=read` → "No records found"). The wildcard read ACL (sys_id `1409b25543820210203884b49bb8f2f5`) has description **"Allow read for all fields in sys_gen_ai_multi_metadata, for users with role maint"** (note: description references a different table name, `sys_gen_ai_multi_metadata` — an apparent copy-paste artifact in the platform's own ACL description, recorded verbatim, not corrected). Its role rows (queried by ACL sys_id): `platform_ml_read`, `maint`.

`sys_generative_ai_log` (the actual payload table — checked because it, not the brief's two tables, is what LLD §8.3 needs answered): query `nameSTARTSWITHsys_generative_ai_log^operation=read` (limit 20) returned **4 rows total**, but only **3** of those are read ACLs on `sys_generative_ai_log` itself — **corrected count: 3 read ACLs**, sys_ids `3756777ab3500310cd0586210762a3eb`, `5f48c850ff7022100158ffffffffff56`, `1c1bae85535221106b38ddeeff7b123c`. The 4th row, sys_id `b9fcf250b7383910116a25168e11a984`, `name: sys_generative_ai_log_ext_staging.*`, is a field-level wildcard read ACL on a **different table** — `sys_generative_ai_log_ext_staging` (an extraction/staging table) — caught only because the query's `nameSTARTSWITH` prefix match also matches that longer table name; it is not a grant on `sys_generative_ai_log` and does not belong in this table's ACL count. (Re-confirmed by re-running the identical query: same 4 rows, same 4th-row identity.) Of the 3 real `sys_generative_ai_log` rows, two carry roles: sys_id `5f48c850ff7022100158ffffffffff56` desc **"Deny access to sys_generative_ai_log unless user has maint role"**; sys_id `1c1bae85535221106b38ddeeff7b123c` desc **"Allow read for records in sys_generative_ai_log, for users with role maint."** (the third, `3756777ab3500310cd0586210762a3eb`, has `admin_overrides:true` and an empty description). Role rows across these 3 ACLs (`sys_security_acl_role` query on all 3 sys_ids): `sn_na_analytics.ai_engmt_viewer`, `admin`, `maint` (×2, deduped to one role).

**Step 2 verdict (LLD §8.3).** Combined read-role set:
| Table | Roles that can read |
|---|---|
| `sys_gen_ai_log_metadata` (metadata only, no payload text) | `sn_aia.viewer`, `sn_aia.admin`, `sn_nowassist_admin.nsa_admin`, `maint`, `admin` |
| `sys_gen_ai_metadata_document` (no payload text) | `platform_ml_read`, `maint` |
| `sys_generative_ai_log` (**actual `prompt`/`response` payload**) | `sn_na_analytics.ai_engmt_viewer`, `maint`, `admin` |

A customer's non-admin AI-Agent-scoped user holds `sn_aia.viewer` / `sn_aia.admin` (**note the exact role name on this instance is dot-separated, `sn_aia.admin`/`sn_aia.viewer` — not `sn_aia_admin` as LLD §8.3 phrases it; a naming variant worth fixing in the docs, same class of issue as the `sys_log`/`syslog` mismatch in P4**). That role set is sufficient to read `sys_gen_ai_log_metadata` but **is absent from every read ACL on `sys_generative_ai_log`**, the table that actually holds `prompt`/`response`. **Answer: the `genai_log` tool's raw-payload read only works for `maint`/`admin`/`sn_na_analytics.ai_engmt_viewer` callers — a customer's `sn_aia.admin`-only user can see log metadata (timing, token counts, status) but not the prompt/response text itself**, unless a `maint` (or equivalent) grant is added.

**Step 3 — capability-to-provider mapping, brief's exact query.**

```json
{"table": "sys_db_object", "query": "nameSTARTSWITHsys_one_extend", "fields": ["name","label","access"], "limit": 100}
```
Result: **"Found: 38 record(s)"** — under the 100 cap, no truncation. Full list (all `access` empty/public):

<details>
<summary>Verbatim — all 38 <code>sys_one_extend_*</code> tables (<code>name | label</code>)</summary>

```
sys_one_extend_metric_aggregator | Metric Aggregator
sys_one_extend_aggregator_score_map | Aggregator Score Map
sys_one_extend_eval_strategy | OneExtend Eval Strategy
sys_one_extend_capability | OneExtend Capability
sys_one_extend_definition_category | OneExtend Definition Category
sys_one_extend_usage | OneExtend Usage
sys_one_extend_resource_attribute_mapping | OneExtend Resource Attribute Mapping
sys_one_extend_definition_attribute | OneExtend Capability Attribute
sys_one_extend_batch_run | OneExtend Batch Run
sys_one_extend_rate_limit_rules | One Extend Rate Limit Rule
sys_one_extend_periodic_batch_run | OneExtend Periodic Batch Run
sys_one_extend_capability_attribute_resource_lookup | OneExtend Capability Attribute Resource Lookup
sys_one_extend_dataset_attribute_mapping | OneExtend Dataset Attribute Mapping
sys_one_extend_eval_metric_result | OneExtend Eval Metric Result
sys_one_extend_batch_run_task | OneExtend Batch Run Task
sys_one_extend_capability_definition | OneExtend Capability Definition
sys_one_extend_dataset_skill_mapping | OneExtend Dataset Skill Mapping
sys_one_extend_rate_limit_count | One Extend Rate Limit Rule Count
sys_one_extend_resource_edge | OneExtend Resource Edge
sys_one_extend_rate_limit_violations | One Extend Rate Limit Rule Violations
sys_one_extend_definition_attribute_cache_whitelist | OneExtend Capability Attribute Cache Whitelist
sys_one_extend_eval_strategy_metric | OneExtend Eval Strategy Metric
sys_one_extend_test_dataset | OneExtend Test Dataset
sys_one_extend_resource_mapping | OneExtend Resource Mapping
sys_one_extend_eval_applicability | OneExtend Eval Applicability
sys_one_extend_dataset_attribute_value | OneExtend Dataset Attribute Value
sys_one_extend_batch_result | OneExtend Batch Result
sys_one_extend_eval_suggestion | OneExtend Eval Suggestion
sys_one_extend_definition_config | OneExtend Definition Config
sys_one_extend_eval_attribute | OneExtend Eval Attribute
sys_one_extend_test_record | OneExtend Test Record
sys_one_extend_truncate_strategy | OneExtend Truncate Strategy
sys_one_extend_resource_param_value | OneExtend Resource Param Value
sys_one_extend_translate_strategy | OneExtend Translation Strategy
sys_one_extend_builder_capability | OneExtend Builder Capability
sys_one_extend_builder_config | OneExtend Builder Config
sys_one_extend_dataset_attribute | OneExtend Dataset Attribute
sys_one_extend_attribute_group | OneExtend Attribute Group
```
</details>

Table matching "capability/provider mapping" by label: **`sys_one_extend_capability_definition`** ("OneExtend Capability Definition"). Described it:

```
Fields (17): filter_properties, api (document_id, mandatory), postprocessor (script), preprocessor (script),
description, api_type (string, mandatory), order, truncate_strategy (reference → sys_one_extend_truncate_strategy),
connection (reference → sys_alias) "Connection And Credential Alias", capability (reference → sys_one_extend_capability, mandatory),
name (mandatory), metadata (json), advanced (boolean), category (reference → sys_one_extend_definition_category)
```

Sampled 10 records (`fields: ["name","capability","api_type","api","connection"]`, `displayValue: "all"`) to confirm the mapping is live, not just structurally plausible — every row resolves a named capability to a real provider connection, e.g.:

```
capability: Error Framework AI Insights Skill | api_type: Flow Designer Subflow | connection: sn_amz_bedrock_spk.Amazon_Bedrock       | api: Flow: Amazon Bedrock Chat Completions
capability: Error Framework AI Insights Skill | api_type: Flow Designer Subflow | connection: sn_google_bard_spk.Google_Bard_Vertex_AI | api: Flow: Google Cloud Chat Completions - Vertex AI
capability: Error Framework AI Insights Skill | api_type: Flow Designer Subflow | connection: sn_generative_ai.Now_LLM                 | api: Flow: Now LLM Integration
capability: Error Framework AI Insights Skill | api_type: Flow Designer Subflow | connection: sn_azure_openai.Azure_OpenAI             | api: Flow: Azure OpenAI Chat Completions
capability: AI Agent Advisor - Agent Assignment | api_type: Flow Designer Subflow | connection: sn_generative_ai.LLM_Proxy_OEM          | api: Flow: Amazon Bedrock Chat Completions
capability: AI Agent Advisor - Agent Assignment | api_type: Flow Designer Subflow | connection: sn_azure_openai.Azure_OpenAI            | api: Flow: Azure OpenAI Chat Completions
```

**Closed — capability mapping table: `sys_one_extend_capability_definition`.** Fields the `genai_log` tool would read for `check_config`: `capability` (which skill/agent capability), `name` (human label including provider variant), `api_type` + `api` (which integration mechanism, e.g. Flow Designer subflow), `connection` (which provider credential alias is bound — Bedrock/Vertex/Azure OpenAI/Now LLM).

### P6 — User/Data Access role storage (LLD §8.9)

**Step 4 — schema of the brief's two candidate tables, brief's exact query.**

```json
{"table": "sn_aia_agent", "includeFields": true, "maxFields": 200}
```
Result: 29 fields. The only field with "role" in its name is `role` (translated_text, "Role") — this is the agent's **persona role** text (e.g. "You are a..."), not an access-control role list. No field named/labeled user access, data access, or run-as.

```json
{"table": "sn_aia_usecase", "includeFields": true, "maxFields": 200}
```
Result: 17 fields. No access/role/run-as field either (`team` reference → `sn_aia_team` is the closest candidate but is a team-assignment link, not a role set).

Brief's fallback m2m search, exact query:

```json
{"table": "sys_db_object", "query": "nameSTARTSWITHsn_aia^nameLIKErole", "fields": ["name","label"], "limit": 50}
```
Result, verbatim: **"No records found in \"sys_db_object\" matching query: nameSTARTSWITHsn_aia^nameLIKErole."** Verified this is a genuine empty result, not a bad-field-name no-op like the P4 `sys_scope_privilege` incident: `name`/`label` are confirmed-real fields on `sys_db_object` (used successfully in every other query this task and in P4). A broader unfiltered check, `nameSTARTSWITHsn_aia` alone (limit 100), returned **60** real `sn_aia_*` tables — none of the 60 names contains "role" or "access" (verbatim list available on request; scanned in full). So the fallback pattern in the brief is correctly empty — the storage is simply not under the `sn_aia_` prefix.

**Broadened search — found it outside the brief's search pattern.** Queried `sys_db_object` for `nameLIKEagent_access` (not in the brief, but the natural next guess once `sn_aia_*` came up empty):

```
sys_agent_access_role_mapping | Agent Access Role Mapping | Global
sys_agent_access_permission_set_configuration | Agent Access Permission Set Configuration | Global
sys_agent_access_role_configuration | Agent Access Role Configuration | Global
```

All three are **Global** scope, not `sn_aia` scope — this is why a search restricted to `nameSTARTSWITHsn_aia` could never find them. Described the primary table:

```
Table: sys_agent_access_role_configuration (8 fields)
  role_list (glide_list → sys_user_role) "Role List"
  agent (document_id, mandatory) "Agent"
  agent_table (table_name, mandatory) "Agent Table"
  allow_all_session_roles (boolean) "Allow all session roles"
  action (choice, mandatory) "Action"   — sys_choice shows exactly one value on this instance: limit_to_roles = "Limit To Roles"
  description (string), name (string, mandatory), sys_id
```
`sys_agent_access_role_mapping`: 3 fields — `agent_access_config` (reference → the table above), `role` (reference → `sys_user_role`) — the exploded one-row-per-role breakout of `role_list`. `sys_agent_access_permission_set_configuration`: 3 fields — links a `sys_development_permission_set` to the same config row (a permission-set-based grant path alongside the role-list path).

Queried, filtered to the two `sn_aia_*` tables actually in scope:

```json
{"table": "sys_agent_access_role_configuration", "query": "agent_tableINsn_aia_agent,sn_aia_usecase",
 "fields": ["name","agent_table","agent","action","role_list","allow_all_session_roles"], "displayValue": "all", "limit": 20}
```
Result: **"Found: 20 record(s) (limit reached)"** — flagged as the round-number-at-cap pattern, verified rather than trusted: re-ran as `servicenow_aggregate` with the identical filter → **`count=159`**. The 20-row sample is a small fraction of the true set, recorded as such.

<details>
<summary>Verbatim — first 20 rows (of 159) of <code>sys_agent_access_role_configuration</code> for <code>sn_aia_agent</code>/<code>sn_aia_usecase</code>, trimmed to <code>agent_table | agent | role_list</code></summary>

```
sn_aia_usecase | Use case: CMDB Visibility Analyzer | itil, discovery_admin
sn_aia_agent   | AI Agent: Catalog Agent | public
sn_aia_usecase | Use case: Error Analysis and Remediation Workflow | 8015b3442f232210127c40171ea4e38d, 7046fbc42f232210127c40171ea4e3d2
sn_aia_agent   | AI Agent: Error Analysis and Remediation Agent | 8015b3442f232210127c40171ea4e38d, 7046fbc42f232210127c40171ea4e3d2
sn_aia_agent   | AI Agent: Guardian Settings Modifier Agent NAC | sn_na_center.nac_user, sn_na_center.nac_admin
sn_aia_agent   | AI Agent: Guardian Settings Viewer Agent NAC | sn_na_center.nac_user, sn_na_center.nac_admin
sn_aia_usecase | Use case: Guardian Settings NAC | sn_na_center.nac_user, sn_na_center.nac_admin
sn_aia_usecase | Use case: Identify escalation signals | sn_uxc_gen_ai.platform_ai_proactive_escalation
sn_aia_agent   | AI Agent: Automation Finder | sn_ac.automation_technical_user
sn_aia_usecase | Use case: Automation Explorer | sn_ac.automation_technical_user
sn_aia_agent   | AI Agent: Automation Table Discovery Agent | sn_ac.automation_technical_user
sn_aia_agent   | AI Agent: Skill Configuration Agent | sn_na_center.nac_admin
sn_aia_agent   | AI Agent: Skill Discovery Agent | sn_na_center.nac_admin
sn_aia_usecase | Use case: Skill Management | sn_na_center.nac_admin
sn_aia_usecase | Use case: Self Healing | (empty)
sn_aia_agent   | AI Agent: Suggested Actions AI Agent | itil, sn_uxc_gen_ai.platform_ai_suggested_actions
sn_aia_agent   | AI Agent: SHA Diagnostic Agent | (empty)
sn_aia_agent   | AI Agent: SHA Triage Agent | (empty)
sn_aia_agent   | AI Agent: Proactive Escalation AI Agent | sn_uxc_gen_ai.platform_ai_proactive_escalation
sn_aia_agent   | AI Agent: Clone FAQ Agent | clone_admin
```
</details>

Sampled rows with non-empty `description` (11 of the 20 above, `descriptionISNOTEMPTY` filter added) to confirm this one table structurally serves **both** halves of LLD §8.9's "User Access" / "Data Access" split — the platform's own text uses both terms against the same schema:

```
"Grants execute access to the Suggested Actions AI Agent. Roles allowed: itil ... and sn_uxc_gen_ai.platform_ai_suggested_actions ..."   [User/execute access]
"Limit the data access to itil role"                                                                                                       [Data access]
"Limit data access to ITIL"
"Allowing all roles for Playbook Activity Assist"
"Users with knowledge_manager or knowledge_admin can access this agent"
"Role masking for generate change request plans workflow"
```

Note: the table has no separate structural field distinguishing a "User Access" row from a "Data Access" row (both use the same 8 fields, same single `action` choice value `limit_to_roles`) — the distinction is conventional, carried in free-text `description`, not enforced by schema. Studio's Agent Access role sets for a given agent/usecase are therefore not guaranteed to be exactly one row each; querying `agent`+`agent_table` for a specific record and inspecting `description` is the way to tell which access dimension a given row represents.

**Closed.** Storage location: **`sys_agent_access_role_configuration`** (Global scope), keyed polymorphically via `agent` (document_id) + `agent_table` (table_name, values `sn_aia_agent` / `sn_aia_usecase` among others) — **not** a field on `sn_aia_agent`/`sn_aia_usecase` themselves, and **not** an `sn_aia_`-prefixed m2m (confirming the brief's fallback query was correctly empty, just aimed at the wrong scope prefix). Per-role breakout lives in the companion table **`sys_agent_access_role_mapping`** (`agent_access_config` reference + `role` reference → `sys_user_role`); a parallel permission-set-based grant path exists via **`sys_agent_access_permission_set_configuration`**. 159 configuration rows exist for `sn_aia_agent`/`sn_aia_usecase` combined on this instance (verified via `servicenow_aggregate`, not the capped 20-row page). This is the table the §4.2 access-alignment check must query, joined against a trigger's `run_as`/`run_as_user` role (LLD §8.9, §4.2).

## Phase 0b — Disposable probe agent

### Created records

Every sys_id is recorded here **as it is created**, and committed before the next
record is created, so Task 11 cleanup is always possible even if a later step aborts.

| # | Table | Name | sys_id | Created | Deleted |
|---|-------|------|--------|---------|---------|
| 1 | `sn_aia_tool` | `pa_probe_context` | `218f555b2f1243d0f824ac1bcfa4e39b` | 2026-07-30 11:51:10 | _pending Task 11_ |
| 2 | `sn_aia_agent` | `PA Probe Agent` | `7abf5ddf0f9e87d0fc5c28f300d1b220` | 2026-07-30 11:52:05 | _pending Task 11_ |
| 3 | `sn_aia_agent_tool_m2m` | `PA Probe Agent - pa_probe_context` | `ccff55130fde87d0fc5c28f300d1b294` | 2026-07-30 11:52:59 | _pending Task 11_ |

Attachment as created and confirmed by the platform's response:
`execution_mode` = `autopilot` (stored back as display **Autonomous**),
`output_transformation_strategy` = `none` (display **None**),
`display_output` = false, `active` = true,
`max_auto_executions` = **20** — set deliberately above the 15 that E2 requests so that
if the loop stops short, the per-attachment cap is excluded as the cause and the stop is
attributable to the instance-wide property (**25**, recorded in P2). 20 is also unremarkable
for this instance: P2 observed one production attachment at 50.

#### Two more plan-text literal defects, found by checking before writing

Both would have created a broken or rejected record had the plan been followed literally:

1. **`sn_aia_agent_tool_m2m.name` is mandatory** and the plan's Task 7 Step 6 field list
   omits it entirely.
2. **`output_transformation_strategy` stored value is `none` (lowercase)**, not `None`.
   The plan specified `"None"`, which is the *display label*. This is the same
   value-versus-label trap P3 was written to defuse for `execution_mode` — the plan applied
   the lesson to one field and not the other.

#### Unplanned finding at agent creation — `context_processing_script` is auto-populated

LLD §5 record 17 instructs: **"no custom `context_processing_script` (verified failure
vector — keep ours empty)"**. Creating `sn_aia_agent` with that field simply omitted did
**not** leave it empty. The platform populated it with a default template script:

```javascript
(function(task, user_utterance, agent_id, context) {
    return {
        pageContext : context?.pageContext,
        triggerContext : context?.triggerContext
    };
})(task,user_utterance, agent_id, context);
```

This matters because the instance's known reference failure
(`78f347b72f198310f824ac1bcfa4e3bd`, LLD §1) has its root cause in a
`context_processing_script` throwing at line 61. "Keep ours empty" is therefore **not
achievable by omission** — the field arrives populated and must be explicitly cleared if
an empty value is genuinely wanted. LLD §5's instruction needs correcting: it describes an
outcome the platform does not give you by default.

The docstring on the auto-populated script is also useful design input in its own right: it
documents that `task`, `user_utterance`, `agent_id`, and `context` (with `pageContext` and
`triggerContext`) are the variables available at that hook — a different and better-documented
surface than the script-tool runtime context E1 is probing.

`applicability_script` was likewise auto-populated, with a default body ending in
`return false;`. Recorded here because it may affect whether the agent is considered
applicable in some invocation paths; E1 will show whether it blocks execution in practice.

Also recorded: `agent_type` was submitted as `internal` and stored with display value
**`Chat`**; `channel` was submitted as `nap_and_va` and stored as **`NAP and VA`**;
`strategy` resolved correctly to **ReAct** (`f0bff21f9f13c6108f431597d90a1c74`, confirmed
present in `sn_aia_strategy` before use — LLD §5's value is correct). `sys_scope` is
**Global**, as with the tool.

**Note on scope — record verbatim, it qualifies E1.** The created `sn_aia_tool` record
landed in **`sys_scope: Global`** (and `sys_package: Global`), not in the `sn_aia` scope,
despite `sn_aia_tool` itself being an `sn_aia`-scoped table. Consequence for E1: the probe
script executes in **Global** scope, which has broad table access. Therefore E1's
`GlideRecordSecure` read results demonstrate that a script tool *can* reach these tables,
but they do **not** simulate a read from a restricted custom application scope
(`x_pa_*`). The P4 cross-scope question is not closed by this probe — it remains as
recorded in P4: static half closed, runtime half carried forward to build time.

Probe tool configuration as created:

- `type` = `script` (stored value confirmed in P3)
- `active` = `true`
- `input_schema` declares one input, `layer` (string), so E1 also reveals whether and in
  what shape inputs reach the script — not only what globals exist.
- `script` = the read-only context-dump body specified in the plan, amended in one respect:
  the table list it attempts to read uses **`syslog`** and **`sys_generative_ai_log`**, the
  real table names established by P4 and P5, rather than the non-existent `sys_log` and the
  metadata-only `sys_gen_ai_log_metadata` named in the original plan text.

### E1 — Runtime context dump (LLD §8.5)

**Verdict: `per_conversation_key` = `_agentic_context_.conversation_id`. LLD §8.5 CLOSED.
`DESIGN.md` 2.4's benchmark-blocking question is answered affirmatively.**

#### The answer

A script tool receives an undocumented global named **`_agentic_context_`**. It is a
**JSON string** (`typeof` = `"string"`, so it must be `JSON.parse`d, not read as an object)
containing exactly the identifiers `PaRunAnchor` needs:

```json
{
  "agent_id":         "7abf5ddf0f9e87d0fc5c28f300d1b220",
  "conversation_id":  "cbb1a1df2f1243d0f824ac1bcfa4e38e",
  "usecase_id":       "",
  "execution_plan_id": "17b16ddf2f1243d0f824ac1bcfa4e390"
}
```

Corroborated two ways: the `execution_plan_id` matches the Execution ID the API returned
for this run (`17b16ddf…`), and a separate global key
`SYSTEM_LOCK:sys_cs_conversation:cbb1a1df2f1243d0f824ac1bcfa4e38e` carries the same
conversation sys_id.

**Consequence for the design.** `DESIGN.md` 2.4 disqualified time-window run-anchor keying
for scored runs and named two fallbacks — the doctor's own `sn_aia_execution_plan` sys_id, or
a tester-passed run token. Neither fallback is needed: a genuine hard per-conversation key is
available directly. `PaRunAnchor` should key on `_agentic_context_.conversation_id`, with
`execution_plan_id` available as a second, finer-grained key. Time-window keying can be
dropped from the design entirely rather than merely disqualified for scored runs.

**Caveat — provisional, as planned.** This was obtained via the API path
(`servicenow_aia_execute`), not the Now Assist panel, because P1 found no Now Assist product
plugin active. The production path is the panel. `_agentic_context_` is also undocumented,
so it is not contractually stable across upgrades. Both facts must be re-confirmed before the
benchmark.

#### What is NOT available

From an explicit `typeof` probe of 20 candidate names:

| Available | Not available (`undefined`) |
|---|---|
| `inputs` (object), `_agentic_context_` (string), `sn_aia` (object), `current` (object), `gs` | `outputs`, `context`, `task`, `user_utterance`, `agent_id`, `execution_plan_id`, `executionPlanId`, `conversationId`, `conversation_id`, `parentSubtaskId`, `toolM2mId`, `agentId`, `vaInputs`, `vaVars`, `vaSystem`, `scratchpad` |

Note the trap: the identifiers exist **only** inside `_agentic_context_`. The obvious bare
names (`conversation_id`, `execution_plan_id`, `agent_id`) are all `undefined` despite being
the exact key names inside it.

`current` is an object but **not** a GlideRecord — both `getTableName()` and
`getUniqueValue()` are absent.

#### The script-tool contract — two corrections to LLD §4.7, and one probe defect

Established by three failed executions before a clean one. Items 2 and 3 are genuine gaps in
the plan/LLD, not platform limitations. **Item 1 is not a docs defect** — the probe deviated
from a document that was already right:

1. **`input_schema` is an ARRAY, not a JSON Schema object.** Real format, confirmed against
   OOB tool `check_multisource_data`:
   `[{"name":"layer","description":"…","mandatory":false}]`.
   **Attribution, corrected:** LLD §2.2 (lines 62–65) and §4.7 (line 247) **already document
   this array format, and already call it the verified live format**. The probe script supplied
   a JSON-Schema object anyway. This one is on the probe, not the LLD, and the LLD needs no
   change for it.
   **The finding stands in full:** supplying a JSON-Schema object
   (`{"type":"object","properties":{…}}`) causes the agent to stall **silently** —
   `AiAgentBaseDao: Error retrieving inputs for tool: TypeError: The object is not a string`,
   then `AgentReActUtil: Error filtering tools config inputs: Cannot find function filter in
   object`. The execution hangs in `In progress` and **never terminates** — no error surfaces to
   the caller. That the platform stalls rather than rejecting a malformed schema is a real
   platform behaviour and the most expensive single defect found in Phase 0. Its consequence is
   unchanged: `PaScriptToolAdapter`'s template must emit the array form so the format cannot be
   got wrong by hand.
2. **There is no `outputs` object.** The signature is `(function(inputs) { … return result; })(inputs)`.
   Referencing `outputs` throws `ReferenceError: "outputs" is not defined` and terminates the run.
3. **Execution scope is `rhino.global`**, and `gs.getSessionID()` returns the literal
   `"SYSTEM"` — not a per-conversation value. Anything keyed on session ID would collide
   across conversations.

#### Cross-scope reads from the script — all five tables readable

`GlideRecordSecure` reads attempted from inside the running tool:

| Table | Result |
|---|---|
| `sn_aia_execution_plan` | OK |
| `sn_aia_message` | OK |
| `sn_aia_tools_execution` | OK |
| `sys_generative_ai_log` | OK |
| `syslog` | OK |

**An important asymmetry, recorded rather than resolved.** `sn_aia_tools_execution` reads
**OK from inside the script tool** but is **denied to the same admin user over the REST API**
(`servicenow_query` → "Access denied: Insufficient rights to query records"). So the denial is
an API-layer restriction, not a table ACL. Consequence: MCP-based reconnaissance systematically
understates what an in-instance tool can read — which is an argument *for* the in-instance
design, and a caution against using MCP probe results as a proxy for tool-runtime access.
These reads ran in **Global** scope (see Created records), so they still do not settle P4's
runtime half for a restricted `x_pa_*` scope.

#### Agent behaviour finding — declared inputs were not passed

In every run the agent logged `inputs: {}` — it never passed the `layer` value, despite an
explicit instruction to pass the sequence number, a declared `layer` input in the schema, and
its own reasoning text stating *"calling pa_probe_context once with layer set to \"1\""*. The
model said it was passing the value and did not. Relevant to tool design: `PaScriptToolAdapter`
must treat every declared input as potentially absent, which the LLD §4.7 "tolerant input
parsing" requirement already anticipates — this is empirical confirmation that it is load-bearing,
not defensive boilerplate.

### E2 — 15-call endurance (DESIGN 2.2, 2.3)

**Verdict: `endurance: pass`, decisively. 19 tool calls completed in a single conversation.
Option A's load-bearing assumption survives.**

| Measure | Value |
|---|---|
| Tool calls executed in one conversation | **19** (4 without a `layer` value + layers 1–15, each exactly once) |
| Requested | 15 |
| Plan `state` | **Completed** |
| Plan `state_reason` | *(empty)* |
| Cause-of-death (DESIGN 2.3 vocabulary) | **`completed`** |
| Wall clock | 51s |
| LLM P95 latency | 3894 ms |
| Execution plan | `ae22ed132f5243d0f824ac1bcfa4e361` |
| Conversation | `922221132f5243d0f824ac1bcfa4e33f` |

Counted from `syslog` (19 `PA_E2` rows, all carrying the same `conversation_id`) and
cross-checked against `sn_aia_execution_plan.state`. Both agree.

**This answers the doubt `DESIGN.md` §1 names.** The concern was that Studio's harness is
workflow-shaped — steps and supervised handoffs — and might not sustain an open-ended
investigation loop. It sustained 19 autonomous calls and terminated cleanly. The seven-layer
diagnostic sweep at 12–15 calls fits with margin.

The stop was not attributable to any cap: `max_auto_executions` was set to 20 on the
attachment (Task 7) and the instance property is 25 (P2). The run finished because the agent
finished, not because it hit a ceiling. Note 19 is close to the 20 attachment cap — a longer
sweep should re-test rather than extrapolate.

#### Unplanned finding — the ReAct loop batches tool calls concurrently

The 19 calls did not run as 19 sequential reason-act rounds. Timestamps cluster into six
batches:

| Time | Calls in batch |
|---|---|
| 19:02:59 | 4 (`layer` absent) |
| 19:03:14 | 4 (layers 1–4) |
| 19:03:20 | 3 (layers 5–7) |
| 19:03:21 | 1 (layer 8) |
| 19:03:27 | 4 (layers 9–12) |
| 19:03:32 | 3 (layers 13–15) |

Design consequences, both favourable and both unanticipated by the LLD:

- **Latency is far better than a sequential model predicts** — 19 calls in 51s, not 19 × round-trip.
- **The playbook's "seven-layer sweep in order" is not enforceable.** The harness may issue
  several probes in one batch before seeing any result. LLD §2's ordered sweep and
  `AGENT_DOCTOR_ARCHITECTURE.md` §3's "playbook order is *suggested* via instructions, not
  enforced" are correct to be cautious — but the reason is stronger than assumed: it is not
  merely that the model may reorder, it is that the harness executes concurrently, so a probe
  cannot depend on an earlier probe's output within a batch. Any tool whose input depends on a
  prior tool's finding must be designed for that, or the dependency must be made explicit in
  the instructions.

Layers 1–15 each appear exactly once and none is missing, so concurrency did not cost
correctness here.

#### Corroboration of E1

All 19 calls logged the identical `conversation_id` from `_agentic_context_`, and it matches
`sn_aia_execution_plan.conversation` exactly. The per-conversation key is **stable across
every call within a conversation** — precisely the property `PaRunAnchor` requires and the one
`DESIGN.md` 2.4 was worried about. E1's answer is confirmed by an independent 19-sample run.

### E3 — Data model confirmation (LLD §2.1)

Validated against an execution **we caused** for two of the four tables; the other two are
carried forward — see the stated omission below.

| Table | Link field | Result on plan `ae22ed13…` |
|---|---|---|
| `sn_aia_execution_plan` | — | 1 row. `state`, `state_reason`, `objective`, `conversation` all readable and populated as LLD §2.1 describes |
| `sn_aia_execution_task` | **`execution_plan`** ✅ | 27 rows. Join field is as documented |
| `sn_aia_tools_execution` | **unconfirmed** | **Denied over REST**, readable from inside a tool — see the asymmetry note in E1. Join field not established on a run we caused |
| `sn_aia_message` | **not checked** | Plan Task 10 Step 4 (read the messages, confirm the `role` vocabulary) was **not performed** — carried forward |

**Silent-miss behaviour on `sn_aia_execution_task` — corrected attribution.** This probe
queried `state`, `task_type` and `agent`. The real schema has **`status`** (not `state`),
**`type`** (not `task_type`), and **no `agent` field at all** — so all three requested names
were wrong, and the query returned rows with those fields **silently absent rather than an
error**: the same silent-miss failure mode that bit P1, P2 and P4.

**The blame was originally put on the LLD, and that was wrong.** LLD §2.1 already documents
`type` and `status` and names no `agent` field; the string `task_type` appears nowhere in this
repo. The wrong names came from the probe, not from the design docs. What survives — and it is
the finding worth keeping — is the platform behaviour: **`servicenow_query` omits non-existent
fields from its result rows instead of erroring**, so a tool built against a mistyped field name
returns blank detail and reads as an empty result rather than a bug. `PaToolAgentTrace` must
therefore assert field presence explicitly and must never infer "no data" from an absent field.

Fields the trace tool needs, and where LLD §2.1 stands on them: `parent` (self-reference — the
task *tree*), `order`, `output` (tool output), `metadata`, `og_task_id` and `task_dependencies`
are **all already named in LLD §2.1** — the earlier claim that the LLD omitted them was also
wrong. The one genuine gap is naming: the per-step timings `execution_time_ms` and
`start_time`/`end_time` (latency analysis for the `latency_flags[]` feature) appear there only as
the collective word "timings" and should be spelled out.

**A caution for the trace tool's shape:** 19 tool calls produced **27** execution-task rows, so
tasks are not 1:1 with tool calls. `PaToolAgentTrace` must not assume that mapping.

**Stated omission — E3 covers 2 of the 4 tables `PaToolAgentTrace` is built on.** Recorded
because it was previously a silent gap, and this project's standard is that omissions are
stated.

- **Plan Task 10 Step 4 was never performed or recorded.** That step called for reading
  `sn_aia_message` for this execution and confirming the **role vocabulary** (LLD §2.1 records
  `user_profile` / `user` / `agent`) against a run we caused. It was not run, and nothing in
  this section stands in for it.
- **`sn_aia_tools_execution`'s join field could not be confirmed** — the REST read was denied
  (see the asymmetry note in E1), so Step 3 produced no join-field evidence.

Consequence: of the four tables `PaToolAgentTrace` reads, only `sn_aia_execution_plan` and
`sn_aia_execution_task` are validated against an execution **we caused**. `sn_aia_message` and
`sn_aia_tools_execution` remain validated only against the 2026-07-18 archaeology. E3 gates
nothing, so this is minor — but it is carried forward, not closed: both checks are added to
`DESIGN.md` R-1's in-instance verification list for the next phase. Per `DESIGN.md` R-8, the
REST denial on `sn_aia_tools_execution` proves **nothing** about its in-tool readability — it
read **OK** via `GlideRecordSecure` from inside the probe tool — so this is an unfinished check,
not a suspected limitation.

#### `servicenow_query` returns a narrow default field set

Recorded because it nearly caused a false finding during this task. Querying
`sn_aia_execution_plan` without an explicit `fields` list returned only `sys_id`,
`sys_created_on`, `sys_updated_on` — which initially looked like ACL field-level restriction.
It is not: naming the fields explicitly returns them all. Any future probe must pass an
explicit `fields` list before concluding a field is unreadable.

### Cleanup

**All three probe records deleted from keynexus01, in reverse dependency order, and
independently verified absent.**

| Order | Table | sys_id | Delete | Verified absent |
|---|---|---|---|---|
| 1 | `sn_aia_agent_tool_m2m` | `ccff55130fde87d0fc5c28f300d1b294` | success | ✅ 0 rows |
| 2 | `sn_aia_tool` | `218f555b2f1243d0f824ac1bcfa4e39b` | success | ✅ 0 rows |
| 3 | `sn_aia_agent` | `7abf5ddf0f9e87d0fc5c28f300d1b220` | success | ✅ 0 rows |

Verification was a fresh query per table (`nameLIKEPA Probe` / `nameLIKEpa_probe`), not
reliance on the delete calls' own success messages.

No team, use case, trigger, or wiring records were created — `servicenow_aia_execute` fires an
agent directly, so the plan's Task 7 team/usecase/trigger records proved unnecessary. Nothing
of that kind is outstanding.

#### Retained by decision — execution history

Per the spec, execution rows from E1/E2 are **retained**: read-only history, harmless on a dev
instance, and a useful known-answer reference for `PaToolAgentTrace` development. They are
recorded here so the retention is deliberate and reversible.

| Execution plan | Conversation | What it is |
|---|---|---|
| `9510e1db2f1243d0f824ac1bcfa4e3e2` | `d010a1db2f1243d0f824ac1bcfa4e3b6` | E1 run 1 — **stalled forever in `In progress`** from the malformed JSON-Schema `input_schema`. A genuine silent-stall specimen |
| `f9e0655f2f1243d0f824ac1bcfa4e3d8` | `39e0655f2f1243d0f824ac1bcfa4e3b7` | E1 run 2 — `terminated` by `ReferenceError: "outputs" is not defined` |
| `72616d9f2f1243d0f824ac1bcfa4e3b2` | *(see plan)* | E1 run 3 — first clean `completed` |
| `17b16ddf2f1243d0f824ac1bcfa4e390` | `cbb1a1df2f1243d0f824ac1bcfa4e38e` | E1 run 4 — the `_agentic_context_` dump |
| `ae22ed132f5243d0f824ac1bcfa4e361` | `922221132f5243d0f824ac1bcfa4e33f` | **E2 — 19 calls, `Completed`** |

The first two are worth keeping deliberately: they are *known-answer failure specimens* on this
instance, with causes we established from the logs. The instance previously had one such
reference failure (`78f347b7…`, LLD §1); it now has three, covering two additional failure
modes — a silent non-terminating stall and a script `ReferenceError`. Both are directly useful
for testing `PaToolAgentTrace` against failures whose root cause is already known.

Probe-generated `syslog` rows (`PA_PROBE`, `PA_PROBE2`, `PA_E2` markers) are also retained; they
are ordinary log entries and age out with normal log rotation.

## LLD §8 disposition

Item numbering is `docs/LOW_LEVEL_DESIGN.md` §8's own. The same dispositions are appended inline to each item in that file.

| # | Item | Disposition |
|---|---|---|
| **1** | `sn_aia_agent_tool_m2m.execution_mode` choice values; `sn_aia_tool.type` full choice list | **CLOSED (Phase 0).** `execution_mode` = 2 active choices, stored values `autopilot` ("Autonomous") / `copilot` ("Supervised"). `sn_aia_tool.type` = 14 active choices; the script one is stored value `script` ("Script"). Both execution modes in live production use on script-type attachments (361/23 of 384) |
| **2** | Use-case activation mechanism (no `active` on `sn_aia_usecase`) | **not in Phase 0 scope** |
| **3** | `sys_gen_ai_log_metadata` ACLs for non-admin callers; prompt/response payload location | **CLOSED (Phase 0).** Payload is in neither table the item names — it is `sys_generative_ai_log.prompt` / `.response`. Read roles: metadata table → `sn_aia.viewer`, `sn_aia.admin`, `sn_nowassist_admin.nsa_admin`, `maint`, `admin`; `sys_gen_ai_metadata_document` → `platform_ml_read`, `maint`; payload table → `sn_na_analytics.ai_engmt_viewer`, `maint`, `admin`. A customer's `sn_aia.admin`-only caller reads metadata but **not** prompt/response (capability limit filed as `DESIGN.md` R-10) |
| **4** | Cross-scope read privileges per §2 table from our app scope | **CARRIED FORWARD.** Static half closed (no §2 table is `access=none` — not a valid value here — none carries a restrictive `caller_access`; **47 standing `sys_scope_privilege` Read grants among 79 privilege rows** — 17 Write, 14 Create, 1 Delete make up the rest — against 8 distinct Read targets, all from first-party scopes, **no custom `x_*` precedent**). Runtime half untested: **no background-script executor in the MCP toolset** (P4b), and the probe tool ran in `Global` scope so its successful reads do not simulate `x_pa_*`. Plus the `syslog` `Caller Restriction` constraint. Becomes a Task 1 verification (`DESIGN.md` R-1, R-12) |
| **5** | Native tool-script runtime execution context (anchors PaRunAnchor keying) — *benchmark-blocking per `DESIGN.md` 2.4* | **CLOSED (Phase 0).** `_agentic_context_`, an undocumented global **JSON string**, carries `agent_id`, `conversation_id`, `usecase_id`, `execution_plan_id`. `PaRunAnchor` keys on `_agentic_context_.conversation_id` (stable across all 19 E2 calls; matches `sn_aia_execution_plan.conversation`); `execution_plan_id` is a finer-grained second key. Bare names are `undefined`; `gs.getSessionID()` = literal `"SYSTEM"`. **Closure is API-path-provisional and rests on an undocumented global** — re-confirm on the panel path before the benchmark (`DESIGN.md` R-2) |
| **6** | Capability→provider mapping table for `check_config` (`sys_one_extend*` family) | **CLOSED (Phase 0).** `sys_one_extend_capability_definition`. Fields for the tool: `capability`, `name`, `api_type`, `api`, `connection` (bound provider alias — Bedrock / Vertex / Azure OpenAI / Now LLM). Confirmed live by sampling 10 rows, not merely structurally |
| **7** | Final app scope prefix (assigned at SDK app creation) | **not in Phase 0 scope** |
| **8** | Seed 4 construction that cannot degrade the shared instance's GenAI config | **not in Phase 0 scope** |
| **9** | Storage of Studio's "Define User Access" / "Define Data Access" role sets | **CLOSED (Phase 0).** `sys_agent_access_role_configuration` (Global scope), keyed polymorphically by `agent` (document_id) + `agent_table` (table_name) — **not** a field on `sn_aia_agent`/`sn_aia_usecase`, and **not** an `sn_aia_`-prefixed m2m. Per-role breakout in `sys_agent_access_role_mapping`; parallel permission-set path via `sys_agent_access_permission_set_configuration`. 159 config rows. No structural field separates "User Access" from "Data Access" — the distinction is conventional, carried in free-text `description` |
| **10** | Now Assist Panel enabled on keynexus01 (needs ≥1 product plugin) | **CARRIED FORWARD.** `panel_available: false` — no Now Assist product plugin exists or is active. An instance-provisioning task, not a design change. Blocks the LLD §7 smoke test and the K26 lab prerequisites as written, and qualifies every Phase 0b result as API-path evidence. Must be closed before the benchmark (`DESIGN.md` R-11) |

**Tally:** 5 CLOSED (1, 3, 5, 6, 9) · 2 CARRIED FORWARD (4, 10) · 3 not in Phase 0 scope (2, 7, 8).
