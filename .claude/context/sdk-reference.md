# ServiceNow SDK — Build Rules & Composition Reference

> **Purpose:** Always-loaded context with the SDK failure-mode build rules
> and multi-API composition patterns that `now-sdk explain` doesn't cover, plus
> an index of the golden examples in `context/sdk-examples/`.
>
> **For live API specs** — signatures, parameters, naming conventions, options —
> run `now-sdk explain <topic>` (or `now-sdk explain --list` to browse all
> topics). ServiceNow's `now-sdk-explain` skill auto-loads these docs for AI
> assistants when installed via `/plugin install fluent`. This file deliberately
> does **not** enumerate the API surface; it covers what `explain` cannot.
>
> **For SDK vs MCP boundary** (what's done in Fluent DSL vs at runtime via the
> foundry MCP server) — see the "SDK Architecture" section in CLAUDE.md.
>
> **Requires:** SDK >= 4.7.0 (`@servicenow/sdk@^4.7.0`) — the AI-agent examples
> use the `search_retrieval` tool type introduced in 4.7.0 (renamed from `'rag'`,
> undocumented in release notes); everything else is 4.6.0-compatible. npm
> `latest` is currently 4.8.1, with 4.9.0 published as dist-tag `next`. The
> authoritative API docs for your installed version ship inside the npm package
> at `node_modules/@servicenow/sdk/docs/` (the public docs site lags npm).
> **Validated:** Build rules learned from real failures during 2026-04-01
> validation against SDK 4.5.0 (original 23 examples) and 2026-04-30 validation
> against SDK 4.6.0 (4 new examples: custom-action, inbound-email-action,
> sp-header-footer, sp-page-route-map). Re-validation of the original 23 against
> 4.6.0 is pending.
> **Updated:** 2026-04-30 — Slim refactor per posture A composition strategy
> (#51); 2026-04-30 — Validation pass against SDK 4.6.0 promoted the 4 DRAFT
> examples to VALIDATED, dropped custom-action.now.ts Example 2, fixed
> inbound-email-action.now.ts string-concat patterns, and added Build Rule #29;
> 2026-04-30 — Second validation pass promoted flow.now.ts Examples 4 + 5 (Custom
> Action call + Subflow invoke) and table.now.ts Example 3 (OverrideColumn) to
> VALIDATED, and flagged flow.now.ts Example 3 as broken against 4.6.0 (#60);
> 2026-04-30 — Fixed flow.now.ts Example 3 `flowVariables` shape (#60): now uses
> Column constructors (`IntegerColumn({ label: '...' })`) instead of the rejected
> 4.5.0 `{ label, type }` shorthand;
> 2026-04-30 — Fixed flow.now.ts Example 3 forEach loop (#62): iterable now uses
> dataPill type `'array.object'` and the body callback takes the per-iteration
> item as a parameter, instead of the prior pattern that passed the whole
> `incidents.Records` collection to the inner updateRecord step. All five
> flow.now.ts examples now build-validated against 4.6.0;
> 2026-04-30 — Re-validation sweep (batch 1): 6 single-error originals validated
> against 4.6.0. workspace + catalog-item moved import path from `/workspace`
> and `/catalog` (4.5.0) to `/core` (4.6.0); import-set scripts[].event renamed
> to `when` and now requires `$id`; script-include + client-script + business-rule
> got committed companion stub assets (server/ + client/) so their `Now.include()`
> references resolve. **15 of 27 examples now build-validated against 4.6.0**;
> 2026-04-30 — Re-validation sweep (batch 2): 4 more originals validated against
> 4.6.0. acl Role names need `x_snc_<scope>.` prefix (dot separator, distinct
> from the underscore convention for tables); rest-api `versions[].version` is
> now a number (was a string), each `versions[]` and `routes[]` entry needs a
> `$id`, and each route needs a `version: <n>` linking it to a versions entry;
> scheduled-script `frequency: 'weekly'` requires `daysOfWeek: [...]` (plural
> array, not the old singular `dayOfWeek`); form.now.ts restructured — sections
> now have a `content[]` array of layout blocks (the `layout` property moved
> from section onto block), annotations need `annotationId` + a predefined
> `annotationType` key like 'Info_Box_Blue', and the view should use the
> exported `default_view` identifier instead of the literal string. **19 of 27
> examples now build-validated against 4.6.0**;
> 2026-04-30 — Re-validation sweep (batch 3a): ui-page validated against 4.6.0.
> No API surface changes; all 4 build errors were missing companion files for
> Now.include() references — committed stubs at context/sdk-examples/client/dist/
> (Example 2 React app), context/sdk-examples/html/ + context/sdk-examples/client/
> (Example 3 config editor). Example 2's `../../client/dist/...` path adjusted
> to self-contained `./client/dist/...` with a teaching comment about the
> typescript.react project-root convention. **20 of 27 examples now build-
> validated against 4.6.0**;
> 2026-04-30 — Re-validation sweep (batch 3b): the AI family — ai-agent,
> ai-agentic-workflow, now-assist-skill — all validated against 4.6.0
> (28 errors → 0). Major API-surface findings drove a rewrite of Build Rule
> #21 (auto-ACL) and a series of new patterns documented in the file headers:
> securityAcl is MANDATORY on AiAgent + AiAgenticWorkflow, team objects need
> a `name` field, team.members[] expects records (use `agent as any`),
> trigger channel uses display-name format ('Now Assist Panel'),
> dataAccess.roleList needs Record refs (not bare strings) [SUPERSEDED by
> the 2026-07-17 entry below — Now.ref role refs write phantom GUIDs; use
> direct sys_id strings], workflow user identity field is `runAs` (not
> `runAsUser`), NowAssistSkillConfig uiAction
> needs $id, Script tools need $capabilityId, and Decision conditions only
> support 'is' | 'is not' operators. Companion stub
> context/sdk-examples/scripts/enrich-context.js added. **23 of 27 examples
> now build-validated against 4.6.0**;
> 2026-04-30 — Re-validation sweep (batch 3c): service-portal validated against
> 4.6.0. Module-subpath consolidation (`/portal` → `/core`); SPTheme asset
> paths self-contained at `./assets/...`; SPWidget `optionSchema` removed
> (4.6.0 type signature tightened with required `section` enum); inline
> clientScript uses `function controller($scope)` per SDK pattern; original
> SPPage example dropped (4.6.0 SPPage shape changed substantially —
> `instances[]` not `widgets[]`, `$id` on rows/columns/instances, JSON-string
> widgetParameters — covered in dedicated SP examples). 6 companion stubs
> added (assets/, server/SPWidget/, client/SPWidget/). **24 of 27 examples
> now build-validated against 4.6.0.**;
> 2026-04-30 — Re-validation sweep (batch 4, final): test.now.ts validated against
> 4.6.0 (issue #72). ATF API renames: every step now requires `$id: Now.ID[...]`;
> `setValues` → `fieldValues` (recordInsert, recordUpdate); `query` → `fieldValues`
> as encoded-query string (recordQuery), `expectedCount` removed; `sysId` →
> `recordId` (recordUpdate, recordDelete); recordInsert output `.sys_id` →
> `.record_id`; `atf.server.fieldValueValidation` removed — replaced by
> `atf.server.recordValidation` with `fieldValues` encoded query; sendRestRequest
> `url` → `path`, HTTP method must be lowercase; assertStatusCode `response`/
> `expectedStatusCode` → `operation: 'equals'`/`statusCode`. Also fixed
> service-portal.now.ts: `theme: Now.ID[...]` → `theme: myTheme` (direct
> reference to the exported SPTheme variable). **27 of 27 examples now
> build-validated against SDK 4.6.0. Re-validation campaign complete.**;
> 2026-07-17 — Issue #188 verified (build repro on SDK 4.8.0 + 4.9.0, live
> records on gpinst01): `Now.ref()` in `AiAgent`/`AiAgenticWorkflow`
> `securityAcl.roles[]`, `dataAccess.roleList[]`, and `team.members[]` emits
> random build-time GUIDs — the AIA intent processors drop the ref's lookup
> key (visible in `src/fluent/generated/keys.ts`), so nothing resolves at
> install and the records point at nonexistent roles/agents, silently. Other
> artifact families (UiAction, catalog, SP) preserve the lookup key and are
> unaffected. Build Rule #21 rewritten; ai-agent + ai-agentic-workflow
> examples switched to direct sys_id strings.;
> 2026-07-17 — Issue #191 drift audit: full 39-example suite build-validated
> against SDK **4.8.1 (npm latest) and 4.9.0 (next)** in a scratch project.
> Only drift found: the two `type: 'rag'` tools — renamed to
> `'search_retrieval'` in SDK 4.7.0 (tarball-verified, absent from release
> notes) with typed structured `inputs` (mandatory at build despite docs
> saying optional). Both examples migrated; `as any` cast dropped; Build Rule
> #20 rewritten. Rule #14 re-verified on 4.9.0: bracket notation in prompt
> templates is now a HARD ERROR (`TS29` with `?.`; plugin transform failure
> without). Role `$id` deprecated in 4.9.0 (identity from `name`) —
> acl.now.ts updated. New 4.7–4.9 API surface catalogued in the
> "SDK 4.7–4.9 surface additions" section below.;
> 2026-07-17 — Issue #194: NASK confirmed to share the #188 phantom-GUID defect
> (build repro on 4.8.1 + 4.9.0): `Now.ref('sys_user_role', ...)` in
> `securityControls.roleRestrictions` / `userAccess.roles` emits a random GUID
> per occurrence per build (no lookup key in keys.ts). `securityControls.roleMap`
> verified HEALTHY: emits `sys_agent_access_role_mapping` rows with
> name-resolution metadata and stable record identity. now-assist-skill.now.ts
> Examples 1–3 migrated to roleMap; Example 4 documents the pre-ZP10
> `roleRestrictions` + direct-sys_id fallback. Build Rules #11 and #21 updated.
> Side-finding (out of scope, follow-up filed): NASK Script tool
> `scriptId: Now.ref('sys_script_include', ...)` also emits a random GUID with
> no name retained in the XML metadata.;
> 2026-07-17 — Issue #196: the #194 side-finding CONFIRMED live on gpinst01
> (SDK 4.8.1): NASK Script tool `scriptId: Now.ref('sys_script_include', ...)`
> emits a random GUID per build into the `sys_one_extend_capability_definition`
> metadata JSON, the GUID installs VERBATIM (no install-time repair — the
> script include name is retained nowhere), and platform resolution is
> sys_id-only (`global.ScriptDetails` → bare `GlideRecord('sys_script_include')
> .get(sys_id)`, no name fallback; same class backs the OneExtend tool
> executor's script cache). The phantom GUID is also embedded in the
> `sys_gen_ai_feature_mapping`/`sys_gen_ai_strategy_mapping` composite identity
> keys, so every rebuild duplicates those records on redeploy. Remediation
> live-verified: a direct sys_id string builds clean, installs verbatim
> pointing at the real Script Include, and keeps record identity stable across
> rebuilds. now-assist-skill.now.ts Example 2 migrated to a
> `REPLACE_WITH_..._SYS_ID` placeholder (custom Script Include sys_ids are
> instance-specific; no OOB constant exists). New Build Rule #33.;
> 2026-07-17 — Issues #200 + #202: NASK now-assist-skill.now.ts runtime-validated
> END-TO-END on gpinst01 (Now LLM provider active again) — first live execution
> of the NASK golden examples. #200 root-caused: Decision `targets` must be
> NAMES of tools in the graph (or '_end'); the old free-form labels emitted
> TS210 and the branch edges were silently skipped — NOT a 4.9.0 change (4.8.1
> emits the same warnings in an isolated build; the "4.8.1 clean" premise was a
> misobservation). Five runtime-refuted SDK behaviors found and fixed in the
> example (Build Rules #35–#40): structured Decision conditions never fire
> (missing applicability_script — use script conditions), InlineScript has no
> input binding (use {{...}} templates), input names underscore-normalize at
> runtime, prompt tool refs resolve by tool name but emit the handle key
> (name tools = return keys, space-free), skills install deactivated, and
> renamed tools require app uninstall before reinstall. Decision branching
> verified live in BOTH directions; Script tools ran a real Script Include
> (completes #196 at runtime); zero Data-Policy drops (Rule #34 check clean).;
> 2026-07-31 — Issue #14 (tool-foundry-troubleshooter Task 2): two `Table()`
> defects found by inserting an actual row after a clean install on gpinst01
> (SDK 4.9.2, Zurich P10), neither visible at build or install time. `autoNumber`
> writes the `sys_number` counter but NOT the column default, so `number` stays
> empty on every insert — and the scoped fix needs the `global.`-qualified
> `javascript:global.getNextObjNumberPadded();`, since the bare call cannot be
> resolved from a scoped app and fails to ''. Separately, a Fluent `Table()`
> installs with **zero ACLs and `ws_access=false`**, which denies REST and UI
> access to everyone including admin while server-side scoped GlideRecord keeps
> working — so the gap is invisible from the code that writes the rows. New
> Build Rules #41 and #42.;
> 2026-07-31 — Issue #16 (tool-foundry-troubleshooter Task 4): a `\n` escape
> written inside a Fluent script template literal is consumed by TypeScript, so
> the generated platform script carries a REAL newline mid-string and the string
> constant is unterminated. Builds and installs cleanly on SDK 4.9.2 and fails
> only when the artifact is invoked (`SyntaxError: Unterminated string
> constant`, reported at a line number that does not match the source). New
> Build Rule #43. The same pass live-cleared LLD §4.5's `⚠ VERIFY` on the
> scoped-app attachment surface: `GlideSysAttachment().write()` and
> `.getContent()` both work from a scoped app against the app's own table, with
> 35,000 chars round-tripped byte-identical in nine 4KB pages, and a
> `GlideRecordSecure('sys_attachment').get()` lookup feeding `getContent()`
> without complaint.

---

## Critical Build Rules (Learned from Testing)

1. **All `.now.ts` files MUST start with** `import '@servicenow/sdk/global'`
2. **`acl` is optional** — NEVER pass `acl: ''` (empty string causes build error). Omit it entirely.
3. **Script tool `script` goes at top level**, not inside `toolAttributes`. `toolAttributes` is for extra metadata only.
4. **CRUD tool `inputs` is a structured object** with `{ operationName, table, inputFields[] }` — NOT a simple array.
5. **SDK >= 4.6.0 required** for AiAgent, AiAgenticWorkflow, NowAssistSkillConfig (with auto-ACL and auto-generated standard outputs), `Form`, `InboundEmailAction`, expanded NASK input types (`glide_record`, `simple_array`, `json_object`, `json_array`), and Custom Action authoring. Earlier versions will fail with "has no exported member" errors or missing platform behavior. **SDK >= 4.7.0 required** for the `search_retrieval` tool type (any AiAgent with a RAG tool — `type: 'rag'` stopped type-checking in 4.7.0, see Rule #20).
6. **`now-sdk build` must succeed before `now-sdk install`** — always fix type errors first.
7. **`TemplateValue`, `Duration`, `Time`, `FieldList` are GLOBALS** — do NOT import them. They exist on the global scope like `Now.ID`.
8. **`ChoiceColumn` choices format:** `{ value_key: 'Label' }` — the object KEY is the choice value, the VALUE is the display label. NOT `[{ value, label }]`.
9. **Table export name must match table name:** `export const x_snc_myapp_table = Table({ name: 'x_snc_myapp_table' })` — mismatch causes build error.
10. **`securityControls.userAccess` is an object** with `{ $id: Now.ID['key'], type: 'authenticated' }` or `{ $id: Now.ID['key'], type: 'roles', roles: [...] }` — NOT a plain string.
11. **`securityControls` needs at least one of `roleMap` or `roleRestrictions`, and neither may be empty `[]`** — `roleMap` (SDK 4.7.0+) takes role **names** and is preferred (see Rule #21 for why, and for the instance-version gate); `roleRestrictions` takes direct role **sys_id strings** (legacy `role_list` column) for pre-ZP10 targets. Never `Now.ref` in either (Rule #21).
12. **NowAssist attribute names: NO underscores** — letters, numbers, and spaces only. Use `incident number` not `incident_number`.
13. **No conditionals/ternaries in Fluent template literals** — only simple property access. No `? :`, no `&&`, no function calls.
14. **Prompt tool output uses dot notation:** `p.tool.toolName.output` — bracket notation is broken, and got WORSE in recent SDKs (re-verified on 4.9.0): `p.tool['name']?.['output']` hard-fails the build (`TS29: Node kind "QuestionDotToken" is not allowed in Fluent files`), and plain `p.tool['name']['output']` makes the `NowAssistSkillPlugin` fail to transform the prompt into a record ("ElementAccessExpressionShape ... not supported") even though the build reports success — the generated artifact is broken. Ignore the official 4.9.0 doc examples showing bracket + optional-chaining style; they do not compile. (`p.input['name with spaces']` bracket access for *inputs* with spaces remains fine.)
15. **Tool return in `tools()` must use explicit property assignment:** `{ myTool: myTool }` — shorthand `{ myTool }` is not allowed in Fluent files.
16. **Prompt `promptState: 'published'` requires skill `state: 'published'`** — set both or leave both as draft.
17. **UiAction `form` only supports:** `showButton`, `showLink`, `showContextMenu`, `style` — `showUpdate`, `showInsert` are NOT valid properties despite appearing in docs.
18. **UiPolicy `table` must be within app scope** — scoped apps can only create UI Policies for tables with matching scope prefix (e.g., `x_snc_myapp_*`). Cannot target OOB tables like `incident`.
19. **Script tool scripts MUST be self-invoking IIFEs** — `(function(inputs) { ... })(inputs);` The `(inputs)` invocation at the end is **required**. Without it, the runtime gets a function object instead of a JSON string result, causing "Error while converting object to JSON" at tool execution. This is a **RUNTIME** error — build and install succeed without it. Two corollaries: **(a)** write `script` as a single inline IIFE *string literal* — a bare TypeScript function reference (`script: myFn`) is a variable initializer the Fluent compiler rejects (Build Rule #29), so the IIFE-string form is the supported shape, not just a style choice; **(b)** **complex inputs (arrays / objects / `json_object`) arrive as JSON strings at runtime**, not as parsed values. Parse defensively inside the IIFE: `var ctx = typeof inputs.context === 'string' ? JSON.parse(inputs.context) : inputs.context;`. (This corollary is about **AiAgent script-tool IIFEs**; NASK `NowAssistSkillConfig` inputs follow the same serialized-string rule but are read in the *prompt template* — see `now-assist-skill.now.ts` Example 4 — a distinct runtime, don't conflate the two.)
20. **RAG tools are `type: 'search_retrieval'` with structured, typed `inputs` (SDK >= 4.7.0)** — the 4.6-era `type: 'rag'` + flat `inputs` array + `as any` cast is DEAD: 4.7.0 renamed the discriminator to `'search_retrieval'` (`'rag'` fails with `TS2322`) and introduced `RagInputType`, so no cast is needed. `inputs` is **mandatory at build** (`TS210: RAG tool ... must have an 'inputs' field`) even though the SDK docs mark it optional. Shape: `inputs: { searchType, searchProfile, sources?, fields?, searchResultsLimit? }` where `searchType` is `{ type: 'keyword' }` or `{ type: 'semantic' | 'hybrid', semanticIndexes: [{value,label}], documentMatchThreshold?: 0-1 }`; `searchProfile`/`sources`/`fields` entries are `{ value, label }` objects (fields use `'table.field'` values). Minimal valid shape: `searchType` + `searchProfile` + `sources`. Do NOT supply a `query` input (auto-generated) and do NOT use `toolAttributes` (serializes as `[object Object]`). The build serializes this back to the platform's flat `sn_aia_agent_tool_m2m.inputs` JSON — verified on 4.8.1 + 4.9.0, including XML round-trip. The `searchProfile` value must match an existing AI Search profile on the instance. See `ai-agent.now.ts` Example 3 (full hybrid config) and `ai-agentic-workflow.now.ts` (minimal keyword config).
21. **`AiAgent` and `AiAgenticWorkflow` require a `securityAcl` config (4.6.0+)** — MANDATORY. The SDK auto-generates the underlying `sys_security_acl` and `sys_security_acl_role` records FROM your `securityAcl` config; the auto-generation is what's automatic, not the requirement to define it. Build fails with `TS210: AI Agent must have a securityAcl field` without it. Shape: `securityAcl: { $id: Now.ID['<key>'], type: 'Any authenticated user' \| 'Specific role' \| 'Public' }`. The `'Specific role'` variant takes `roles: [...]` — an array of **direct role sys_id GUID strings ONLY** (e.g. `'282bf1fac6112285017366cb5f867469'` = itil; OOB role sys_ids are identical on every instance, verify custom roles on the target). **Never `Now.ref('sys_user_role', {...})`** — it builds, but the AIA processors drop the ref's lookup key and write a random build-time GUID to `sys_security_acl_role.sys_user_role` / `sys_agent_access_role_configuration.role_list`, so the role silently never applies (issue #188; verified on SDK 4.8.0 and 4.9.0; same defect hits `dataAccess.roleList[]` and `team.members[]`). Two more caveats: **(a)** the generated `sys_security_acl_role` child records get a NEW sys_id on every build, so each redeploy of a `'Specific role'` agent INSERTs duplicate role rows (enforcement unaffected, but clean them up manually); **(b)** `'Any authenticated user'` is safe — it maps to `snc_internal` correctly. The agent's `runAs` / `dataAccess` is a *separate* concern (controls which user identity the agent runs under, not who can invoke it). Do NOT also define a manual `Acl` for the agent — the auto-generated record covers that. **The same phantom-GUID defect hits the NASK family** (verified on 4.8.1 + 4.9.0, issue #194): `Now.ref('sys_user_role', ...)` in `NowAssistSkillConfig` `securityControls.roleRestrictions` writes a random GUID to `sys_agent_access_role_configuration.role_list`, and in `userAccess.roles` to `sys_security_acl_role.sys_user_role` — a different GUID per occurrence per build, no lookup key in `keys.ts`. Use `securityControls.roleMap` with role **names** instead (SDK 4.7.0+, instance Zurich P10 / Australia P3+): it emits `sys_agent_access_role_mapping` rows that carry the name as resolution metadata (`<role name="itil">`), keep a stable record identity across rebuilds, and are the supported M2M path. Pre-ZP10 fallback: `roleRestrictions` with direct sys_id strings. See `now-assist-skill.now.ts` Examples 1 (roleMap) and 4 (fallback).
22. **NASK standard outputs are auto-generated (4.6.0+)** — when `outputs` is omitted from `NowAssistSkillConfig`, the five standard outputs (`response`, `provider`, `errorcode`, `status`, `error`) are emitted automatically. Define `outputs` only for *additional* custom outputs beyond the standard set.
23. **NASK input `dataType` values:** `string`, `numeric`, `boolean`, `glide_record` (requires `tableName`), `simple_array`, `json_object`, `json_array`. The optional `truncate` flag applies to scalar types only.
24. **Fluent-vs-Fluent sys_id conflicts always error (4.6.0+)** — two `.now.ts` files defining the same `$id` produce a hard build error regardless of the `--errorOnConflict` flag. XML-vs-Fluent conflicts continue to respect that flag.
25. **`now.config.json`: use `defaultLanguage`** — the field was renamed from `tableDefaultLanguage` in 4.6.0. Old name still works but is deprecated; new projects should use `defaultLanguage`.
26. **`tsconfig` lives under `src/`** in 4.6.0 project templates. `now-sdk init` generates it there; `now.config.json` `tsconfigPath` points to `src/tsconfig.json`.
27. **`ScheduledScript` script fields support modules (4.6.0+)** — `Now.include('./jobs/cleanup.js')` and similar module references work inside scheduled job scripts.
28. **`Table` creates `sys_dictionary_override` directly (4.6.0+)** — no separate API required. Use the dictionary override fields on the `Table` definition for child tables that need to override parent column attributes.
29. **Fluent property values must be a single constant** — if the value is one literal (a single quoted string OR a single backtick template), the parse passes. Concatenating multiple literals with `+` (e.g., `'foo' + 'bar'`) does NOT pass: the Fluent compiler walks the AST and only accepts constants it can resolve at build time, failing with `TS303: Failed to parse property` and `TS213: Unsupported variable initializer`. Use a single literal for fields like `fieldAction`, `replyEmail`, `script` (when not a template), etc. Note: `+` *inside* a backtick template is fine because the whole template is still one constant — that `+` is JavaScript runtime executed by the platform, not Fluent compile-time.
30. **Custom Actions are always installed in `state=draft` — Flows that reference them cannot auto-activate** — the build plugin hardcodes `state: 'draft'` for every `Action()` definition; there is no SDK config field to change this. A Flow (or Subflow) whose body calls `wfa.action(MyCustomAction, ...)` cannot auto-activate during `now-sdk install` because the platform rejects activation with "ActionName is not published". This check is **transitive** — wrapping the call inside a Subflow does not help; the Subflow activation also fails. Workaround: (a) inline equivalent `action.core.*` steps in the Flow body so it activates cleanly, then (b) after install, publish the Custom Action manually via Flow Designer → Custom Actions → [Name] → [Publish] and re-activate the Flow. See `custom-action.now.ts` Example 1 and `flow.now.ts` Example 4.
31. **`triggerConfig` belongs on `AiAgenticWorkflow`, not `AiAgent` alone** — placing `triggerConfig` on a bare `AiAgent` is accepted without a build error but yields a `sn_aia_trigger_configuration` whose `usecase` field is **null** (`sn_aia_trigger_configuration.usecase` references `sn_aia_usecase`, and `sn_aia_agent` has no usecase field — only `AiAgenticWorkflow` creates the `sn_aia_usecase` record the trigger must bind to). The result is no backing flow and no BR, so the trigger never fires. **Also set `executionMode: 'autopilot'` whenever `triggerConfig` is present** — the platform default is `copilot` (Supervised, `sn_aia_usecase.execution_mode` `default_value=copilot`), which waits for user invocation and never responds to record-event triggers. And the workflow/usecase version must be **`published`** (not `draft`) for the trigger to activate at all — `draft` + `copilot` is "nothing fires anywhere" with no diagnostic signal, so pair `executionMode: 'autopilot'` with `state: 'published'` for trigger-driven workflows. See `ai-agent.now.ts` (triggerConfig GOTCHA comment) and `ai-agentic-workflow.now.ts` Example 1.
32. **`$id` on tools differs between `AiAgent` and `NowAssistSkillConfig`** — `AiAgent` inline tool entries (the objects inside `tools: [ … ]`) **must NOT carry `$id`**: the SDK auto-generates their record IDs, and `ScriptToolDetails` rejects `$id` at typecheck (`now-sdk build` fails). `$id` on an `AiAgent` is valid only on the top-level declaration and on `securityAcl`. **Contrast NASK:** `NowAssistSkillConfig` tools built via the `tools: (t) => { … }` factory **do require `$id`** (and Script tools additionally require `$capabilityId`). Rule of thumb: `AiAgent` `tools[]` array → no `$id`; NASK `tools()` factory → `$id` (+ `$capabilityId` for Script). See `ai-agent.now.ts` (tools without `$id`) vs `now-assist-skill.now.ts` (tools with `$id`/`$capabilityId`).
33. **NASK Script tool `scriptId` takes a direct sys_id string ONLY — never `Now.ref('sys_script_include', ...)`** — the ref form builds clean but emits a **random GUID per build** into the `sys_one_extend_capability_definition` metadata JSON (`{"scriptFunctionName":"...","scriptId":"<random>"}`), and unlike `roleMap`'s name-carrying XML there is **no lookup key retained anywhere** — so this is UNREPAIRABLE at install (live-verified on gpinst01, issue #196: the phantom GUID installs verbatim, pointing at a nonexistent Script Include, with no error at build, install, or in logs). Platform resolution is sys_id-only: `global.ScriptDetails.getScript()` does a bare `GlideRecord('sys_script_include').get(sys_id)` with no name fallback (and it's the same class behind the OneExtend tool executor's `oe_tool_executor_script_func_params_cache`), so at runtime the tool silently fails to load any script. Corollary: the scriptId value is baked into the `sys_gen_ai_feature_mapping` / `sys_gen_ai_strategy_mapping` composite identity keys AND the capability definition's `sys_name`, so a churning GUID also duplicates those records on every redeploy. **Fix:** a direct sys_id string (`scriptId: '<sys_id>'`) — verified to install verbatim and keep identity stable across rebuilds. Custom Script Include sys_ids are instance-specific with no OOB constant, so golden examples use a `REPLACE_WITH_..._SYS_ID` placeholder (fail-safe if left unreplaced) — same pattern as the #188 `runAs` remediation. See `now-assist-skill.now.ts` Example 2.
34. **AiAgent OOB tool types `deep_research` / `desktop_automation` / `mcp` are NON-FUNCTIONAL from Fluent** (live-verified on SDK 4.9.0 + Zurich P10, issue #199) — three independent failure layers: (1) the build plugin has no OOB link mapping for these three (unlike `web_automation`/`knowledge_graph`/`file_upload`/`search_retrieval`) and emits a NEW `sn_aia_tool` record into your app — the bundled docs' "auto-links to the existing OOB tool record" claim is false; (2) that record ships with an empty `description`, and a platform Data Policy on `sn_aia_tool` mandates Description, so app install **silently skips the tool record while still installing the `sn_aia_agent_tool_m2m` rows** — the agent carries phantom tool references (same silent-phantom family as Rules #21/#33). Setting `description` on the tool config makes the record install — treat `description` as effectively mandatory on every tool; (3) even installed, the record has no `target_document` (functional tools point at a `sys_cs_topic` for deep_research/desktop_automation or an `sn_mcp_server` for mcp), so every call fails with `AIA: Topic not found for target document 'null'` — and hand-repointing the m2m at the instance's OOB tool record still fails (the SDK m2m carries no input mapping; the topic receives an empty task). Do not ship these three tool types from Fluent until ServiceNow adds real support; `ai-agent.now.ts` Example 4 is a compile-shape reference only. **General corollary: platform Data Policies apply to app-install record loading and violations are skipped SILENTLY — no build, install, or log error.**
35. **NASK Decision `targets` must be NAMES of other tools in the same `tools()` graph, or the sentinel `'_end'`** (= route to the skill prompt / end of graph) — they are NOT free-form path labels. An unresolved target emits `TS210: Decision target '...' not found` and the branch edge record is SKIPPED — build still "succeeds" but the decision routes nowhere at runtime (issue #200; identical on 4.8.1 and 4.9.0 — the plugin edge-resolution code is the same). The build auto-adds `depends: [<decision>]` to each target tool (don't declare it yourself), and a decision without an `'_end'` target gets no terminal edge (its branch targets carry those). Corollary: in `branches[].to` / `default`, use STRING LITERALS — `targets[0]` element access is unsupported by the extractor and the branch metadata (name/order/condition) is dropped with NO warning while the edge is still created, so every branch runs unconditionally. See `now-assist-skill.now.ts` Example 2.
36. **NASK Decision branch conditions MUST be script conditions — the structured `{ field, operator, value }` form NEVER fires at runtime** (runtime-refuted on gpinst01 Zurich P10, SDK 4.8.1/4.9.0, issue #202). The structured form emits a `condition_expression` edge WITHOUT an `applicability_script`, and the OneExtend engine does not traverse a conditional edge whose script is absent — every execution silently takes the default branch (tested with bare field names, whole-output `{{...}}` templates, and dot-path templates; all fell through). Use `condition: { script: '(function(currentInputs, context) { return context.getValue("<Tool Name>.output") == "value"; })(currentInputs, context);' }` — this emits `applicability_type='script'` + the script, and routing works from a plain `now-sdk install` (live-verified in both directions). Have the upstream tool return the categorical value as its WHOLE output and compare on that. (NASK-UI-authored expression edges work because the UI also writes a boilerplate applicability_script; if you must repair an expression edge, PATCH a `return true` script onto it post-install.)
37. **NASK InlineScript tools have NO input binding** — the SDK's own types say "InlineScript has NO inputs", and at runtime the script's `inputs` global contains only plumbing (`_meta`, the script's own source, `feature_invocation_id`); `inputs.<name>` is ALWAYS undefined. Read skill inputs by embedding `{{internal_name}}` TEMPLATES in the script text — the platform substitutes them before execution (runtime-verified: `'{{incident_record}}'` yields the sys_id; `inputs.incident_record` yields undefined → all-null output → the LLM hallucinates a plausible answer from empty data, flagged `__dont_treat_as_error__`). Script tools (Script Include-backed) DO get declared inputs, passed as plain string function arguments — a `glide_record` input arrives as the bare sys_id string. See `now-assist-skill.now.ts` Example 1.
38. **NASK input names underscore-normalize at runtime** — the Fluent `name` becomes the display label, and the internal name replaces spaces with underscores (input `'change record'` → name `change_record`). Runtime payload keys (OneExtendUtil / skill invocation) and `{{...}}` template references must use the INTERNAL name — the spaced form fails with "Mandatory attributes missing in the input: change_record" (payload) or resolves empty (templates). Corollary: a missing mandatory input is only rejected when the input has no test value — with `testValues`/`tableSysId` declared, a missing or wrong-keyed payload silently falls back and the tool runs against empty data (hallucination risk). Rule #24's no-underscores-in-names rule still applies at BUILD time; this rule is about the runtime key. See `now-assist-skill.now.ts` MULTI-INPUT note.
39. **NASK tool names must be space-free identifiers and the `tools()` return keys must EQUAL the tool names** — prompt references `p.tool.<key>.output` are emitted VERBATIM as `{{<key>.output}}` (the return-handle key), but the runtime resolves templates by TOOL NAME. If key ≠ name, the prompt interpolates EMPTY with no build warning and the LLM answers from nothing (runtime-caught on gpinst01: the rendered prompt in `sys_generative_ai_log.prompt` showed "Incident Data:" followed by blank, and the model fabricated a complete incident). This is why every OOB NASK tool is CamelCase. The runtime template engine itself accepts spaced names (`'{{FetchChangeDetails.output}}'` in Script-tool input values and `context.getValue('<Tool Name>.output')` both resolve) — the constraint comes from the prompt sugar. Check `sys_generative_ai_log.prompt` to verify interpolation. See `now-assist-skill.now.ts` Examples 1–2.
40. **NASK skills install DEACTIVATED, and the Fluent DSL has no field to change that** — `now-sdk install` writes `sn_nowassist_skill_config_status` with `active=false` (`skillSettings` only covers pre/post-processors). Executing a deactivated skill fails with "Cannot process the one-extend call as the user doesn't have permission to execute this skill" — even as admin with correct ACLs/roleMap (the message is misleading; it's the activation toggle). Activate post-install once per skill per instance (NASK admin UI, or `PATCH sn_nowassist_skill_config_status/<sys_id> {"active":"true"}`); reinstalls don't reset it, but an uninstall does. **Rename corollary:** NASK resource-mapping/edge identity derives from the tool NAME (not `$id`), so renaming tools regenerates those records — and installing the renamed app OVER the old install left the engine silently skipping decision condition scripts (unconditional routing). After renaming NASK tools, UNINSTALL the app before reinstalling. See `now-assist-skill.now.ts` RUNTIME INVOCATION COMPANION.
41. **`Table({ autoNumber })` does not populate `number` — it only creates the counter, and the fix must be `global.`-qualified in a scoped app** (live-verified on gpinst01, SDK 4.9.2). The `autoNumber: { prefix, numberOfDigits, number }` block writes a correct `sys_number` row (verify: `sys_number` where `category=<your table>`), and stops there: the `number` column installs with an EMPTY `default_value`, so every insert — REST, UI or server-side — leaves `number` blank. When `display: 'number'` (the usual pairing), every record then renders with a blank display value and reference fields pointing at it show nothing. Nothing errors at build, install or insert. **Fix:** declare the column with the default Studio's "Auto number" checkbox writes — `number: StringColumn({ label: 'Number', maxLength: 40, readOnly: true, default: 'javascript:global.getNextObjNumberPadded();' })`. **The `global.` prefix is load-bearing:** the unqualified `javascript:getNextObjNumberPadded();` installs identically and STILL yields `''`, because the function lives in global scope and a scoped app cannot resolve it unqualified — the failed evaluation degrades to empty rather than throwing. Instance convention confirms it: of 10 scoped `x_*` tables sampled on gpinst01 with an auto-numbered `number` column, 8 use the `global.`-qualified form (the 2 that don't have the same silent defect). Tables that `extends: 'task'` are unaffected — they inherit a wired `number` column. Note the SDK docs' warning that `autoNumber` requires a `number` column is about the column EXISTING; a standalone table must declare it itself, and declaring it is also where the default goes.
42. **A Fluent `Table()` installs with ZERO ACLs and `ws_access=false`, and an unmatched ACL denies everyone — admin included** (live-verified on gpinst01, SDK 4.9.2). Freshly installed custom tables have no `sys_security_acl` rows at all; an admin REST insert returns `Access denied: User Not Authorized`, and the table cannot be opened in the UI either. This is easy to ship unnoticed because the write path that matters usually keeps working: a **server-side scoped `GlideRecord` bypasses ACLs entirely**, so Script Includes and Business Rules populate the table normally, and only a human opening a record or an integration reading it hits the wall. Two independent switches, both needed and neither implied by the other: (a) `Acl({ type: 'record', table, operation })` declarations — `read` at minimum, plus `create`/`write`/`delete` for whoever maintains the data, with `adminOverrides: true` so an instance admin is not locked out of the app's own tables; (b) `allowWebServiceAccess: true` on the `Table()` for Table API / MCP / integration access (`ws_access`, which is NOT security — it gates the REST surface, the ACLs gate the data). Corollary worth exploiting: **omitting an ACL is itself a control.** Declaring `read` + `create` and no `write`/`delete` makes an audit/evidence table append-only through the ACL layer, while the server-side writer that fills it is unaffected. See `acl.now.ts` for ACL shapes and Rule #21's note that AI-family artifacts auto-generate their own ACLs — plain `Table()` does not.
43. **Escape sequences inside a Fluent `` script`…` `` template literal are consumed by TypeScript, not passed through — a `\n` in a script string emits a REAL newline and leaves the string constant unterminated** (live-verified on gpinst01, SDK 4.9.2). `script\`… payload += 'abc\n'; …\`` generates platform source that reads `payload += 'abc` / `';` across two lines. The build reports success, `now-sdk install` reports success, and the failure surfaces only when the artifact is *invoked*: `SyntaxError: Unterminated string constant`, **at a line number that does not correspond to anything in your source** (measured: reported line 9 for a break at generated line 22), so the error actively misdirects the search. Only `\n` was measured, but the cause is just template-literal semantics, so `\t`, `\\`, `\'` and `${…}` (which interpolates at build time rather than reaching the platform) follow from the same mechanism — treat them as equally unsafe. **Fix:** build the character at runtime — `var NL = String.fromCharCode(10);` — or double the backslash (`'abc\\n'`) so one survives into the generated script. This applies to every Fluent property taking a `script` template: `RestApi` route scripts, `BusinessRule`, `UiAction`, inline `clientScript`. It does **not** apply to code pulled in with `Now.include('../server/Foo.js')`, which is copied verbatim — a good reason to keep any script longer than a few lines in a `.js` file under `src/server/` rather than inline (that path is also unit-testable, per Rule #14's sibling concern about untestable inline strings). **Corollary, measured 2026-07-31 (issue #20):** a **backtick anywhere inside the template — including in a `//` comment** — closes it. Markdown-style quoting in an explanatory comment (`` `_agentic_context_` ``, `` `var` ``) is the natural way to write one and silently terminates the script. Unlike the `\n` case this one *fails at build*, but the diagnostics point somewhere else entirely: `TS2796` ("missing a comma to separate these two template expressions"), `TS304` ShorthandPropertyAssignment, `TS20` CloseBraceToken, and `RestApiPlugin failed to transform … Failed to cast TaggedTemplateExpressionShape to ObjectShape`, at line numbers scattered across the file rather than at the backtick. If a `script` template suddenly produces a cluster of unrelated-looking syntax errors, grep the template for a backtick before reading any of them.

---

## SDK 4.7–4.9 Surface Additions

Catalogued 2026-07-17 from npm-tarball + bundled-docs diffs (4.6.1 → 4.9.0);
sources: release notes + `node_modules/@servicenow/sdk/docs/`. Golden examples
for these landed with #193 (build-validated on 4.8.1 + 4.9.0) — read the
example file first, then `now-sdk explain <topic>` / the bundled docs for the
full spec.

**New artifact APIs** (import from `@servicenow/sdk/core` unless noted):
- `DataPolicy` (4.7.0) — `sys_data_policy2` server-side mandatory/read-only rules — see `data-policy.now.ts` (scoped apps: same-scope tables ONLY, build-enforced TS11; the bundled guide's `incident` examples compile only in global apps)
- `PlaybookDefinition` + `ActivityDefinitions` + `wfa.playbook.*` (4.8.0, from `@servicenow/sdk/automation`) — Process Automation Designer playbooks (lanes, activities, triggers) — see `playbook.now.ts` (deploys as draft; activate in Workflow Studio)
- `RestMessage` (4.8.0) — outbound `sys_rest_message` + functions — see `rest-message.now.ts`
- `Alias` / `AliasTemplate` (4.8.0) — Connection & Credential aliases — see `alias.now.ts`
- `RetryPolicy` (4.8.0) — `sys_retry_policy` (fixed/exponential/retry-after) — see `retry-policy.now.ts`
- `DataLookup` (4.8.0) — `dl_definition` match/set rules — see `data-lookup.now.ts` (matcher must extend `dl_matcher`; seed rows need explicit `active: true`)
- `ChoiceSet` (4.9.0) — add choices to fields your app does NOT own (e.g. inherited global fields); ChoiceConfig gains `language`, `dependentValue`, `synonyms`, array-form multi-language labels — see `choice-set.now.ts` (4.9.0-ONLY: constructor absent on 4.8.x)
- "UserCriteria" (4.8.0, docs-only) — NOT a constructor; documented as a `Record({ table: 'user_criteria', ... })` pattern. Must set `active: true` explicitly (Record applies no platform defaults).

**Flow family** (4.7.0 unless noted): `FlowStage`/`stages` config + `wfa.stage()`, `wfa.flowLogic.tryCatch`, `doInParallel`, `appendToFlowVariables`, `wfa.errorEvaluation()` — see `flow-advanced.now.ts`; Flow `internalName`, `allowHighSecurityRoles`, `main_snapshot` (4.9.0, kills per-rebuild snapshot churn). Custom Action `access` union is `'public' | 'package_private'` — `'private'` fails at build.

**AI family**:
- `dataAccess.roleMap` (4.7.0) — role **names** resolved at build, written to `sys_agent_access_role_mapping` M2M. Requires **Zurich P10 / Australia P3+** on the instance; `roleList` (direct sys_ids) is the legacy path for older instances. Same split on NASK: `securityControls.roleMap` vs legacy `roleRestrictions`. At least one of the two must be present. NASK `roleMap` build-verified healthy in #194: the update XML carries the role name as resolution metadata (`<role name="itil">`), resolved on the target instance at install, with stable record identity across rebuilds — unlike `Now.ref` in `roleRestrictions`, which writes phantom GUIDs (Rule #21). (This M2M path is also the supported remediation route from issue #188.)
- `agentDescriptor` (4.7.0) on AiAgent: `'require_caller_id' | 'created_by_ai_agent_advisor' | 'created_by_build_agent' | ''`
- `protectionPolicy: 'read' | 'protected'` (4.7.0, AIA in 4.9.0) on most artifact types; RestApi's old `policy` prop is deprecated in favor of it (Flow's `protection` likewise)
- NASK providers added in 4.9.0: `'Now LLM LTS Generic'`, `'Google Cloud Vertex AI'`, `'Amazon Bedrock'`; `deploymentSettings.nowAssistPanel` config documented
- 4.9.0 guide hardening (fold into agent designs): triggers deploy **inactive** (manual activation on instance), trigger run-as configuration is now required for all trigger types, scheduled triggers require `objectiveTemplate`, journal fields (`work_notes`/`comments`) cannot be written by CRUD tools (use a Script tool), CRUD `returnFields` should always include `sys_id`

**Fluent globals & CLI**: `$override` escape hatch (4.7.0, write unmapped columns onto generated records — plugin-written columns are rejected with warning TS97/TS112 and ignored; only truly unknown keys pass through) and `Now.del(table, keysOrSysId)` (4.8.0, declarative record deletion) — see `now-del-override.now.ts` for both; `now-sdk query <table> --query '<encoded>'` (4.8.0, read-only Table API from CLI); OAuth `client_credentials` env-var auth for CI installs (4.7.0); `ScheduledScript` `$meta.installMethod` gains `'once'` (4.8.0); Role `$id` deprecated (4.9.0 — identity derived from `name`).

---

## Composite Patterns (Multi-API)

For combining multiple Fluent APIs in one project. Read all listed example files together.

| Scenario | APIs to Combine | Example Files to Read |
|---|---|---|
| Agent + tools + trigger flow | `AiAgent` + `Flow` + `Table` | `ai-agent.now.ts` + `flow.now.ts` + `table.now.ts` |
| Multi-agent orchestration | `AiAgenticWorkflow` + `AiAgent` (×N) | `ai-agentic-workflow.now.ts` + `ai-agent.now.ts` |
| Now Assist skill with tool graph | `NowAssistSkillConfig` | `now-assist-skill.now.ts` |
| Flow that calls a Custom Action | `Flow` + `Action` | `flow.now.ts` (Example 4) + `custom-action.now.ts` |
| Flow that invokes a Subflow | `Flow` + `Subflow` | `flow.now.ts` (Example 5) |
| Catalog request with fulfillment flow | `CatalogItem` + `Flow` | `catalog-item.now.ts` + `flow.now.ts` |
| Table + BR + client script + form | `Table` + `BusinessRule` + `ClientScript` + `Form` | all four example files |
| Scoped table with row-level access control | `Table` + `Acl` + `Role` | `table.now.ts` + `acl.now.ts` |
| Scoped table extending OOB with overrides | `Table` + `OverrideColumn` | `table.now.ts` (Example 3) |
| REST API with ACL | `RestApi` + `Acl` + `Role` | `rest-api.now.ts` + `acl.now.ts` |
| Portal with custom widget | `ServicePortal` + `SPPage` + `SPWidget` + `SPTheme` | `service-portal.now.ts` (covers all four) |
| Portal with header / footer / redirects | `ServicePortal` + `SPHeaderFooter` + `SPPageRouteMap` | `service-portal.now.ts` + `sp-header-footer.now.ts` + `sp-page-route-map.now.ts` |
| Inbound email → record + auto-reply | `InboundEmailAction` | `inbound-email-action.now.ts` |
| No-corpus lexical/structural text dedup (Jaccard) | `ScriptInclude` (+ AI Agent Script Tool wrapper) | `jaccard-similarity.now.ts` |
| Corpus-aware text dedup (TF-IDF) | `ScriptInclude` + `Table` + `ScheduledScript` | `tfidf-similarity.now.ts` (covers all three) |
| Dedup agent-generated Mermaid diagrams | `ScriptInclude` (+ `BusinessRule` / Scheduled Job) | `mermaid-structural-comparator.now.ts` + `script-include.now.ts` |

> **`allowWebServiceAccess: true` ≠ `sys_security_acl`:** the `Table()` option `allowWebServiceAccess: true`
> (→ `sys_db_object.ws_access`) enables out-of-box REST **Table API** access to the table; it does
> **not** create any ACL records. For row-level read/write/create/delete security, add explicit
> `Acl({ type: 'record', table: '…', operation: 'read', … })` declarations in a separate `.now.ts`
> (see `acl.now.ts`). Diagnostic: if `new GlideRecordSecure(table).query()` returns 0 rows but
> `new GlideRecord(table).query()` returns rows, a missing record-read ACL is the cause.

---

## Golden Example Index

File → primary API map. For the API spec, run `now-sdk explain <topic>`.

### AI Agent Studio & Now Assist
| Example File | Primary API | Notes |
|---|---|---|
| `ai-agent.now.ts` | `AiAgent` | Includes RAG via `type: 'search_retrieval'` (Example 3; SDK >= 4.7.0); Example 4: OOB tool types `deep_research`/`desktop_automation`/`mcp` — **runtime-refuted on Zurich P10, do not ship (Build Rule #34)** |
| `ai-agentic-workflow.now.ts` | `AiAgenticWorkflow` | Multi-agent teams. For choosing the coordination topology, see `context/multi-agent-coordination-patterns.md` |
| `now-assist-skill.now.ts` | `NowAssistSkillConfig` | **RUNTIME-VALIDATED e2e on gpinst01 (#202)**: tool graph + script-condition Decision branching (both directions), InlineScript `{{...}}` input templates, real Script Include execution; multi-input (`string` + `json_object`) in Example 4; activation + invocation companion notes |

### Flow Designer & Custom Actions
| Example File | Primary API | Notes |
|---|---|---|
| `flow.now.ts` | `Flow` + `Subflow` | All 5 examples build-validated against 4.6.0. Examples 4–5 are 4.6.0 composition patterns (Custom Action call + Subflow invoke); Example 3 uses the 4.6.0 `flowVariables` Column-constructor shape (#60) |
| `custom-action.now.ts` | `Action` | New in 4.6.0; only Example 1 — see header for step-specific gotchas |
| `flow-advanced.now.ts` | `Flow` + `Action` | SDK >= 4.7.0: stages (`FlowStage`/`wfa.stage`), `tryCatch`, `doInParallel`, `appendToFlowVariables`, `wfa.errorEvaluation` (Action bodies only) |
| `playbook.now.ts` | `PlaybookDefinition` | SDK >= 4.8.0: PAD playbooks — lanes, activities, Decision routing, record trigger. Deploys as draft; activate in Workflow Studio |

### Tables & Data
| Example File | Primary API | Notes |
|---|---|---|
| `table.now.ts` | `Table` (+ `OverrideColumn`) | Example 3 validated against 4.6.0 (OverrideColumn). Rename `x_snc_myapp_` → your scope before building |
| `import-set.now.ts` | `ImportSet` | |
| `record.now.ts` | `Record` | Generic seed/demo records |
| `data-policy.now.ts` | `DataPolicy` | SDK >= 4.7.0; scoped apps: same-scope tables only (TS11) |
| `data-lookup.now.ts` | `DataLookup` | SDK >= 4.8.0; matcher extends `dl_matcher`, seed rows need `active: true` |
| `choice-set.now.ts` | `ChoiceSet` | **4.9.0-ONLY** (constructor absent on 4.8.x); multi-language ChoiceConfig arrays |
| `now-del-override.now.ts` | `Now.del` + `$override` | SDK >= 4.8.0 (Now.del); $override is 4.7.0+. Destructive at install — read the header |

### Server-Side Logic
| Example File | Primary API | Notes |
|---|---|---|
| `business-rule.now.ts` | `BusinessRule` | |
| `script-include.now.ts` | `ScriptInclude` | |
| `jaccard-similarity.now.ts` | `ScriptInclude` | Zero-dependency, no-corpus lexical/structural Jaccard dedup (plain-object token sets — no `Set`/`Map` on Rhino). Shares the TF-IDF tokenizer. ES5/Rhino-safe `server/JaccardSimilarityUtil.js`. See `context/similarity-jaccard-pattern.md` |
| `tfidf-similarity.now.ts` | `ScriptInclude` + `Table` (×2) + `ScheduledScript` | Corpus-aware TF-IDF cosine dedup; corpus persisted in a table (sentinel-row N). ES5/Rhino-safe `server/TfidfSimilarityUtil.js`. See `context/similarity-tfidf-pattern.md` |
| `mermaid-structural-comparator.now.ts` | `ScriptInclude` | Structural dedup of Mermaid diagrams (weighted Jaccard); ES5/Rhino-safe `server/MermaidStructuralComparator.js`. See `context/similarity-mermaid-structural-pattern.md` |
| `scheduled-script.now.ts` | `ScheduledScript` | |
| `rest-api.now.ts` | `RestApi` | Scripted REST endpoints |

### Service Catalog
| Example File | Primary API | Notes |
|---|---|---|
| `catalog-item.now.ts` | `CatalogItem` | |

### Integrations (Outbound)
| Example File | Primary API | Notes |
|---|---|---|
| `rest-message.now.ts` | `RestMessage` | SDK >= 4.8.0; auth profile / MID refs are plain sys_id strings; secrets never in source |
| `retry-policy.now.ts` | `RetryPolicy` | SDK >= 4.8.0; strategy-discriminated union (fixed/exponential/retry-after) |
| `alias.now.ts` | `Alias` + `AliasTemplate` | SDK >= 4.8.0; wires a RetryPolicy + template into an alias by direct object reference |

### Service Portal
| Example File | Primary API | Notes |
|---|---|---|
| `service-portal.now.ts` | `ServicePortal` (+ `SPPage`, `SPWidget`, `SPTheme`) | |
| `sp-header-footer.now.ts` | `SPHeaderFooter` | New in 4.6.0; Example 2 needs Now.include asset stubs |
| `sp-page-route-map.now.ts` | `SPPageRouteMap` | New in 4.6.0 |

### UI / Forms
| Example File | Primary API | Notes |
|---|---|---|
| `form.now.ts` | `Form` | |
| `client-script.now.ts` | `ClientScript` | |
| `ui-action.now.ts` | `UiAction` | |
| `ui-page.now.ts` | `UiPage` | |
| `ui-policy.now.ts` | `UiPolicy` | |
| `workspace.now.ts` | `Workspace` | |

### Email & SLA
| Example File | Primary API | Notes |
|---|---|---|
| `email-notification.now.ts` | `EmailNotification` | |
| `inbound-email-action.now.ts` | `InboundEmailAction` | New in 4.6.0 |
| `sla.now.ts` | `Sla` | |

### Security & Testing
| Example File | Primary API | Notes |
|---|---|---|
| `acl.now.ts` | `Acl` | |
| `test.now.ts` | `Test` | ATF tests |

**APIs without a dedicated example file** — `Role`, `Property`, `ApplicationMenu`, `CrossScopePrivilege`, `ScriptAction`, `List`, `UserPreference`, instance scan (`LinterCheck` / `TableCheck` / etc.), and docs-only "UserCriteria" (a `Record({ table: 'user_criteria', ... })` pattern). For these, run `now-sdk explain <api>` directly or read `node_modules/@servicenow/sdk/docs/`. Note: `Role` does appear inside the `acl.now.ts` and `rest-api.now.ts` examples as part of access-control patterns; use those as composition references. (The 4.7–4.9 additions all have dedicated examples as of #193 — see the index above.)
