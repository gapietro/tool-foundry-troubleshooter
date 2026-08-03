# Benchmark Raw Evidence v4 — 2026-08-03

Instance: `gpinst01.service-now.com` (Zurich Patch 10 Hotfix 3)
App version under test: **`2026.08.0301`** (`sys_app.version`, verified post-install)
Endpoint: `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`
Polling: `GET /api/x_snc_troubleshoot/v1/troubleshooter/runs/{run_id}`
Audit derivation: `x_snc_troubleshoot_audit` where `run=<run_id>`, all `action_type` values, ordered ascending.

This file is a MEASUREMENT record. Scoring lives in the v4 scorecard(s) (TBD by later tasks in this pass).

---

## Deploy verification (Task 1, done before any run)

The pass opened by finding the instance was **not** running the version under test:

- `sys_app.version` read **`2026.08.0226`** before the install (queried via
  `servicenow_query` on `sys_app`, `sys_id=13043037d3da4293904504ef30589334`,
  fields `name,version`).
- Per branch discipline, the deploy itself was run from `main`, not from this
  task branch: `git checkout main && git pull` (main already up to date at
  `8c909cd`, `package.json` version `2026.08.0301`) + `now-sdk build` (clean)
  + `now-sdk install --alias gpinst01`.
- Immediately after install, returned to
  `chore/benchmark-v4-scored-pass` — no commit was made on `main`.
- Post-install `sys_app.version` reads **`2026.08.0301`** (re-queried, same
  fields).

### Content byte-comparison — Script Includes

`sys_updated_on` is **not** bumped by an SDK install and is a misleading
indicator, so content was compared directly rather than trusting the
timestamp. For each of the four Script Includes the custom harness depends
on, the instance's `sys_script_include.script` was pulled via the Table API
(`GET /api/now/table/sys_script_include`, `sysparm_query=name=<name>`,
`sysparm_fields=name,script`) and diffed byte-for-byte against the matching
file in `src/server/`:

| Script Include | Instance vs. `src/server/*.js` | Result |
|---|---|---|
| `PaFixReport` | `diff` exit 0 | **Byte-identical** |
| `PaArtifactStore` | `diff` exit 0 | **Byte-identical** |
| `PaToolRegistry` | `diff` exit 0 | **Byte-identical** |
| `PaScriptToolAdapter` | `diff` exit 0 | **Byte-identical** |

All four matched exactly — no divergence, not even a trailing-newline
difference.

### Content byte-comparison — shared agent instructions

`sn_aia_agent` (`sys_id=e1392946828940e5a708fc51b0a5e954`, fields
`name,instructions`) was pulled via the Table API and diffed against
`docs/agent/agent-doctor-instructions.md`:

- **Content byte-identical** across all 120 lines.
- The only difference: the repo file ends with a trailing newline; the
  instance's `instructions` field value does not (`instance` 7297 bytes vs.
  `repo` 7298 bytes, diff flags `\ No newline at end of file` on the last
  line only). This is the expected artifact of how the field was populated
  and is **not** treated as a divergence — noted per the task brief's
  guidance that trailing-newline differences are common and not
  stop-worthy.

**Conclusion: the deployed code on gpinst01 (`2026.08.0301`) is confirmed
identical to the code committed on `main` at `8c909cd` for all four Script
Includes and the shared Agent Doctor instructions.** The rest of this v4
pass measures the committed code, not something else.

---

## Seed fixture preconditions (§A3 void conditions) — all verified, none void

All queries run via `servicenow_query` against gpinst01, admin session, connected
through the foundry MCP `servicenow_connect` broker (no shell credentials used).

| Condition | Read | Verdict |
|---|---|---|
| Seed 02 `sn_aia_agent_tool_m2m` for agent `cd050d48e810411d9f113fd530694fe6` (`active=true`) | 1 row: `tool.name=measure_request`, `max_auto_executions=10` | v2 construction is live — not void |
| Seed 04 capability `x_snc_tsbench_unmapped_capability` | `sys_id=92ff62af516741769c437feb88c80ef3` | matches the value hardcoded in the installed tool script — not void |
| Seed 04 definition `904c0485699a4a73a124446a7231c563` | `api_type=sys_hub_flow`, `api=00000000000000000000000000000000` (dangling), `connection` empty (decoy) | matches expected v3 construction — not void |
| Seed 05 `sn_aia_trigger_agent_usecase_m2m` `ba30d8775b0c4cebb960c58830590d5d` | `active=true` (already on — no PATCH required) | gate on, as required — not void |
| Seed 05 `sn_aia_trigger_configuration` `bfb77d6c64884500a80203ee029436ee` | `active=false` | the seeded defect, intact — not void |
| Seed 05 bench ticket `29fd09c42b6a4bd417a6ffbeee91bfb0` | present in `x_snc_tsbench_ticket`, short_description "New starter needs laptop provisioned before Monday", priority `3` | reusable |
| Seeds 01–04 execution targets (`b07dc9082baa4314f243fed2ce91bf4b`, `4b315ecc2b66c314f243fed2ce91bfca`, `c4cd01842b6a4bd417a6ffbeee91bfc3`, `16ddc10c2baa4314f243fed2ce91bf15`) | all four present in `sn_aia_execution_plan`, all four `state=completed` | reusable — not void |

**No PATCH was required for Step 3.** Seed 5's `sn_aia_trigger_agent_usecase_m2m`
gate already read `active=true` on first query — the fixture was already in its
correct post-install state, so the one permitted repair action was not exercised.
`sn_aia_trigger_configuration.active` was read (not touched) and confirmed `false`,
as the seeded defect requires.

**All five seeds: not void.**

### Budget knobs and `layers_available` (§E3 query)

`sn_aia_agent_tool_m2m` for agent `e1392946828940e5a708fc51b0a5e954` (`active=true`)
returned **7 rows**, each `max_auto_executions=10`:

| tool.name | max_auto_executions |
|---|---|
| `agent_trace` | 10 |
| `agent_config` | 10 |
| `schema_lookup` | 10 |
| `query_table` | 10 |
| `genai_log` | 10 |
| `log_analysis` | 10 |
| `read_artifact` | 10 |

`sys_properties` `sn_aia.continuous_tool_execution_limit` = **`25`**.

**Measured `layers_available`: 7/7** — all seven tools are registered on the
agent record read directly from the instance (not copied from a prior pass).
The gap measured by scored runs is "did not look", never "could not look with".

---

## Smoke gate (Task 3) — both harnesses, not a scored row

One run fired per harness against the standing smoke specimen (execution plan
`c9d63a932bda8b9417a6ffbeee91bfd0`), invocation text exactly per the brief and
nothing else. Bar: terminal with structurally valid output — not correct
diagnosis. Full raw transcripts (complete tool-call payloads, full Fix Report
text) are in `.superpowers/sdd/2026-08-03-v4-scored-pass/task-3-report.md` for
bulk reference only — that path is gitignored and will not survive the plan;
every judgement a later reader needs is inlined below.

### Native (Agent Doctor, `e1392946828940e5a708fc51b0a5e954`)

Prompt: `Diagnose execution plan c9d63a932bda8b9417a6ffbeee91bfd0.`

- Execution ID `0781aaec2ba2871817a6ffbeee91bfce`, conversation
  `d2816aec2ba2871817a6ffbeee91bf4e`
- **Terminal state: Completed** — **wall clock: 241s** — **11 tool calls**
  (`agent_trace` ×1, `read_artifact` ×7, `agent_config` ×2, `genai_log` ×1,
  `log_analysis` ×1)
- Fix Report is well-formed (FAILURE SUMMARY / LAYERS SWEPT / ROOT CAUSES /
  FIXES / VERIFICATION) and named `context_processing_script` line 42 as
  RC-2 with CONFIRMED confidence — matching the known answer, consistent
  with native also finding it at Task 9 and Task 12.
- **Caveat on RC-2's wording:** native's Fix Report also claims, as part of
  RC-2, that the `sn_aia_agent` record owning that script "no longer exists."
  This reads as a misinterpretation of an `agent_config` empty read against a
  script-owning sub-record, not evidence of an actual deletion. Recorded here
  as an observation about native's output/reasoning, not as a fact about the
  instance; flagged for whoever scores this fixture in the 20-row pass.

**Gate: PASS.**

### Custom (`x_snc_troubleshoot`)

Body: `{"execution": "c9d63a932bda8b9417a6ffbeee91bfd0", "mode": "diagnose"}`

- Run ID `5702a2242be2871817a6ffbeee91bfc9` (`TR1000117`), polled via
  `GET .../runs/{run_id}` (trusted per the brief over any single-record
  `servicenow_query`, which is stale on this instance)
- **Terminal state: complete** — **wall clock: ~10s** — **1 tool call**
  (`agent_trace`)
- `fix_report` has all documented keys (`failure_summary`, `layers_swept`,
  `root_causes`, `fixes`, `verification`, `data_markers`) and named
  `context_processing_script` line 42 as the sole root cause — but only
  Layer 1 was swept (all other layers `NOT_SWEPT`) and confidence is
  explicitly `UNCONFIRMED`. Right answer, shallow evidence — flagged for
  the scored pass, not treated as a gate signal.

**Gate: PASS.**

### Result

| Harness | Terminal state | Wall clock | Tool calls | Line 42 named |
|---|---|---|---|---|
| Native (Agent Doctor) | Completed | 241s | 11 | YES |
| Custom (`x_snc_troubleshoot`) | complete | ~10s | 1 | YES |

Both harnesses passed: terminal, structurally valid output. Gate is
terminality + structural validity, not correctness — both happened to name
the known answer this time, which is not guaranteed to repeat across the 20
scored runs. Pass may proceed.

---

## Seed 05 request body recovery (Task 4)

Seed 05 has no execution plan by design (see the seed spec's "The defect")
— its diagnostic request takes an `agent` + `timeframe` + `description` form
rather than an `{"execution": ...}` form. Recovering the exact v3 text, not a
paraphrase, was the whole deliverable of this task.

**Path 1 (stored request on the v3 run records) — FAILED, and not just
empty.** Queried `x_snc_troubleshoot_run` for both TR1000103
(`ee3a71dc2baecfd417a6ffbeee91bfe5`) and TR1000104
(`734a7dd02b6a0b14f243fed2ce91bf73`). `servicenow_schema` shows this table
has **no `request` field at all** — the brief's assumed field name doesn't
exist on the table. The plausible alternates (`context_summary`,
`execution_ref`, `agent`) are empty on both rows, and the `transcript` field
(pulled untruncated via `/api/now/table/x_snc_troubleshoot_run`) opens at
`seq:1, actor:"llm"` with a tool-call decision — there is no `actor:"user"`
(or equivalent) entry anywhere on the run record that carries the original
inbound request text. The harness does not persist the raw request payload
on this table at all.

**Path 2 (audit trail's first intent row) — returned a real finding, but not
the request text.** `x_snc_troubleshoot_audit` where
`run=<sys_id>^action_type=intent`, first row for both runs:
`tool_name=agent_trace`, `input={"execution":
"29fd09c42b6a4bd417a6ffbeee91bfb0"}`. This confirms the diagnostic target
delivered was the seed's bench ticket sys_id — the model pulled it out of the
request's `description` text and mis-used it as an `execution` argument (the
tool correctly reported a genuine absence, since a ticket sys_id is not an
execution-plan sys_id). But this is the model's own derived tool-call
argument, not the original request payload — it doesn't reproduce the
`agent`/`timeframe`/`description` fields or their literal wording, so on its
own it does not satisfy "recover the exact text."

**Resolution — recovered from a preserved v2 artifact, not reconstructed
from the seed spec.** Before falling through to Step 3's reconstruction,
`.superpowers/sdd/2026-08-02-observation-channel/benchmark-raw-evidence-v2.md`
was checked — a still-present (gitignored, unversioned) measurement record
from the prior, v2, benchmark pass. It records the seed-05 request body
verbatim, used identically across both of its own seed-05 runs (Run 9
`a66d01182b22cfd417a6ffbeee91bf28` / TR1000089, and Run 10):

> `{"agent": "Seed 05 Ticket Acknowledger", "timeframe": "last 24 hours",
> "description": "A bench ticket was created (sys_id
> 29fd09c42b6a4bd417a6ffbeee91bfb0) and the agent that should have triaged it
> never ran."}`

`benchmark/raw-evidence-v3.md` line 60 states in its own words that the ten
v3 scored runs' "Request bodies [were] reused verbatim from the prior pass so
the diagnostic targets are identical," explicitly naming seed 05 "in
`agent`+`timeframe`+`description` form naming bench ticket
`29fd09c42b6a4bd417a6ffbeee91bfb0`" — the same ticket sys_id embedded in the
v2 body above. This is corroborated behaviorally, not just by citation: v3's
own audit trail (Path 2 above) shows the model extracting that identical
ticket sys_id into its first `agent_trace` call — the exact same
(mis-)extraction documented against the identical body in the v2 evidence
file. Both lines of evidence agree independently, so this text is treated as
**RECOVERED** — an artifact of the actual prior pass, not a paraphrase built
from the seed spec's prose — even though it surfaced from neither of the
brief's two ServiceNow-query paths. **Step 3 (reconstruct from
`seed-05-inactive-usecase.md`'s Trigger section) was not exercised; no
invented text appears anywhere in this file for seed 05.**

**Caveat for whoever scores seed 05 in this pass:** this text's provenance is
one level removed from a live v3 database record — it is a copy preserved in
another plan's gitignored evidence file, corroborated on two independent
signals (v3's own "reused verbatim" claim, and the matching sys_id extraction
in v3's live audit trail) but not independently certified byte-for-byte
against whatever the v3 HTTP request actually carried over the wire, because
that payload itself was never logged anywhere on the instance (Path 1's
finding above). Worth a follow-up issue in its own right: the harness does
not persist the inbound request text on `x_snc_troubleshoot_run` — only what
its own model chooses to do with it.

**Recovered seed 05 request body for this pass (v4), unchanged from v2/v3:**

```json
{"agent": "Seed 05 Ticket Acknowledger", "timeframe": "last 24 hours", "description": "A bench ticket was created (sys_id 29fd09c42b6a4bd417a6ffbeee91bfb0) and the agent that should have triaged it never ran."}
```

### Fix round: stronger source attempted — v3's own live transcript, negative result

A follow-up check went after a stronger source than the filesystem artifact
above: the v3 seed-05 runs' **own live transcript on gpinst01**, on the
hypothesis (from this file's Task 3 smoke-gate note that "the observation
channel carries the full ~4,300-char envelope in `prompt_digest`, not a
200-char digest") that the full request envelope might be preserved
somewhere in `TR1000103`/`TR1000104`'s own record.

Pulled every text-bearing field on both run records
(`ee3a71dc2baecfd417a6ffbeee91bfe5`, `734a7dd02b6a0b14f243fed2ce91bf73`)
untruncated via `/api/now/table/x_snc_troubleshoot_run` —
`transcript`, `fix_report`, `error`, `context_summary` — and searched all of
it for `"Seed 05 Ticket Acknowledger"`, `"timeframe"`, `"last 24 hours"`, and
`"description"`. **No match anywhere.**

This is **not** an ambiguous digest-truncation miss (the "elided middle"
hazard) — it is confirmed absent by construction, verified in
`src/server/PaRunManager.js` `_normalizeEntry` (~lines 296–308): a
transcript entry only ever gets a `prompt_digest` when `actor === 'tool'`,
and that `prompt_digest` is derived from **that same entry's own
`result_digest`** — i.e. a tool's own output, re-expanded past the 200-char
ceiling. The code comment states this explicitly: an `llm` entry is "the
model's own prior reasoning" and a `system` entry "a status note; neither is
the evidence channel this fixes." `src/server/PaAgentLoop.js` `_step` /
`_dispatchTool` confirm the same from the write side: `_buildPrompt` embeds
`_renderRequest(request)` — the original diagnostic request — into the
prompt sent to the LLM at every turn, but only the LLM's **response**
(`result_digest`) and the tool's own args/result get written back to the
transcript; the constructed prompt itself, request text included, is never
persisted anywhere. So the field the hypothesis pointed at cannot, by
construction, ever have carried the original request — not "not found in
the preserved portion," but not there for any version of this run, digest
window or not. This sharpens (does not merely repeat) Path 1's finding above.

**Outcome: recovered text is unchanged, and the caveat/wording above stands
exactly as written.** No discrepancy was found to flag — there was nothing
to compare against, only a confirmed absence. This negative result is
recorded here so the next person does not re-spend effort re-checking the
v3 transcript for this text.

**Two provenance notes:**

1. The recovery source used above —
   `.superpowers/sdd/2026-08-02-observation-channel/benchmark-raw-evidence-v2.md`
   — sits in a **different plan's** working directory than this one
   (`2026-08-03-v4-scored-pass`), which is outside this plan's normal
   boundary. It produced a correct, corroborated result and is not being
   undone, but the recovered JSON body is quoted verbatim, in full, directly
   above in this committed file — so this file's record does not depend on
   that other path remaining readable or even continuing to exist.
2. The gap this task surfaced — **`x_snc_troubleshoot_run` has no field that
   ever stores the inbound diagnostic request text**, for any seed, not only
   seed 05 (confirmed against the schema and reinforced by this fix round's
   source-code read) — is a real product gap, not a benchmarking
   inconvenience, and is worth its own GitHub issue.

---

## Seed 01 — scored run block (Task 5)

**Target: execution plan `b07dc9082baa4314f243fed2ce91bf4b`.** These are
scored rows, not a gate. Invocation text sent to each harness was exactly the
brief's text and nothing else — no seed spec file was read before firing.
Order fired: native run 1 → custom run 1 → native run 2 (fresh conversation)
→ custom run 2 (fresh POST), per the brief's interleaving requirement. Firing
was interleaved as specified; native runs were left to complete
asynchronously in the background while the custom runs (which are fast) were
fired and polled to terminal, then both native runs were polled to terminal
last — this changes only when each run's *terminal state* was observed, not
the fire order, which matches the brief exactly.

### Native run 1 (Agent Doctor, `e1392946828940e5a708fc51b0a5e954`)

Prompt: `Diagnose execution plan b07dc9082baa4314f243fed2ce91bf4b.`

- Execution ID `98d72a2c2b66cf14f243fed2ce91bf8e`, conversation
  `e7c7eae82b2acb14f243fed2ce91bf79`
- Fired 2026-08-03 21:19:20Z. **Terminal state: Completed** (per
  `servicenow_aia_trace`: Started 2026-08-03 17:19:26 / Ended 17:19:26→17:24:00
  instance-local; cross-checked via multi-record `sn_aia_execution_plan`
  query: `sys_created_on=2026-08-03 21:19:25`, `sys_updated_on=2026-08-03
  21:24:01`, `state=completed`, agreeing to within a second).
- **Wall clock: 274s** (trace-reported duration; multi-record query gives
  276s — consistent).
- **Tool-call count: 10** — `agent_trace` ×1, `read_artifact` ×6,
  `agent_config` ×1, `query_table` ×1, `schema_lookup` ×1 (23 execution
  tasks total, per `servicenow_aia_trace`).

Full text of the Fix Report (pulled from `sys_cs_message`
`a1b862242ba6cf14f243fed2ce91bffb`, `payload.value`, the message the user/
caller actually sees):

> # Fix Report — Execution Plan b07dc9082baa4314f243fed2ce91bf4b
>
> ---
>
> ## FAILURE SUMMARY
>
> The user asked agent **Seed 01 Ticket Prioritizer** to set ticket
> `532bc10c2b6a4314f243fed2ce91bf4b` to Critical priority. The execution plan
> completed without error, the agent told the user "Priority set to
> **Critical**", and the tool call returned `ok: true`. However, the field
> was never actually updated: the tool's own read-back reported
> `priority_stored: null`. The defect is a silent data-type mismatch in the
> tool script: the script passes the string word `"critical"` to
> `GlideRecord.setValue()` on a field of type **Integer**. GlideRecord
> silently discards a non-numeric string on an Integer column;
> `gr.update()` proceeds without error, and the field retains its previous
> value (or null). Because the tool does not validate the stored value
> against the requested value before returning `ok: true`, neither the agent
> nor the user had any signal that the write failed.
>
> ---
>
> ## LAYERS SWEPT
>
> | # | Layer | Status | Notes |
> |---|-------|--------|-------|
> | 1 | Execution trace | SWEPT | `agent_trace` on plan `b07dc9082baa4314f243fed2ce91bf4b` |
> | 2 | Agent instructions | SWEPT | `agent_config` section: tools (instructions also returned) |
> | 3 | Tool definitions | SWEPT | `agent_config` section: tools — script body and input schema inspected |
> | 4 | Data schemas | SWEPT | `schema_lookup` on `x_snc_tsbench_ticket.priority` |
> | 5 | Data / record existence | SWEPT | `query_table` confirmed ticket exists in `x_snc_tsbench_ticket` (tool returned `ok:true`; my cross-check on the `task` super-table returned empty because `x_snc_tsbench_ticket` does not extend `task` — not a finding) |
> | 6 | GenAI stack | NOT SWEPT | The trace showed all LLM calls succeeded and the model behaved correctly; the defect is in the tool script, not the model layer. Sweeping layer 6 would not change the diagnosis. |
> | 7 | Trigger and wiring | NOT SWEPT | The execution completed; access verification passed (`isAccessAllowed: true`). No trigger failure was present in the trace. |
>
> > **Platform log layer (log_analysis):** NOT swept. The `syslog` table
> > restricts cross-scope callers and the diagnostic application cannot lift
> > that restriction. An instance administrator must run a scoped syslog
> > query against plan `b07dc9082baa4314f243fed2ce91bf4b` to confirm there
> > are no additional server-side errors. This layer is reported as a gap,
> > not clean.
>
> ---
>
> ## ROOT CAUSES
>
> ### RC-1 — Tool script passes a string word to an Integer priority field
>
> | | |
> |---|---|
> | **Layer** | 3 — Tool definition / 4 — Data schema |
> | **Component** | Tool `set_ticket_priority` (`sn_aia_tool`, sys_id `8953483c2762479b97bf55da8ed1c4ac`), field `x_snc_tsbench_ticket.priority` |
> | **Finding** | The script calls `gr.setValue('priority', inputs.priority)` where `inputs.priority` is the string `"critical"`. The `priority` column on `x_snc_tsbench_ticket` is declared as type **Integer** with no choice list. GlideRecord silently ignores a non-numeric string on an Integer column; `gr.update()` runs without error; the read-back returns `null`. |
> | **Evidence** | Tool script body: `sn_aia_tool.sys_id=8953483c2762479b97bf55da8ed1c4ac`, field `script`. Schema: `x_snc_tsbench_ticket.priority`, type=`Integer`, `has_choices=false` (schema_lookup). Tool call response: `priority_requested="critical"`, `priority_stored=null` (`sn_aia_tools_execution.sys_id=869d4d482baa4314f243fed2ce91bf89`). |
> | **Confidence** | **CONFIRMED** — two independent layers (tool script + schema) plus the observed null read-back all agree. |
>
> ---
>
> ### RC-2 — Tool inputs `ticket` and `priority` are not marked mandatory
>
> | | |
> |---|---|
> | **Layer** | 3 — Tool definition |
> | **Component** | Tool binding `set_ticket_priority` (`sn_aia_agent_tool_m2m`, sys_id `1fa91a286055441bb4afce79fe876207`), `inputs` field |
> | **Finding** | Both `ticket` and `priority` inputs are declared `"mandatory": false`. If either is omitted by the model, the tool silently proceeds with `undefined`, and the script's `gr.get(undefined)` query returns false — leading to the `ok: false / ticket not found` error path. In this run the model did supply both values, so this did not cause the failure, but it is a latent defect. |
> | **Evidence** | `sn_aia_agent_tool_m2m.inputs` on binding `1fa91a286055441bb4afce79fe876207`: both entries carry `"mandatory":false`. |
> | **Confidence** | **CONFIRMED** as a configuration defect. Did not trigger in this run (latent). |
>
> ---
>
> ### RC-3 (Secondary) — Instruction bloat causing elevated LLM latency
>
> | | |
> |---|---|
> | **Layer** | 1 — Execution trace |
> | **Component** | Execution task `sn_aia_execution_task.sys_id=997dc9082baa4314f243fed2ce91bfe3` (AIA ReAct Engine, first turn) |
> | **Finding** | First ReAct turn took **17 656 ms**, exceeding the 15 000 ms threshold. The trace flagged `instruction_bloat`. Instructions are reprocessed on every ReAct turn, so their size multiplies with each step. |
> | **Evidence** | `latency_flags[0].flag="instruction_bloat"`, `observed_ms=17656`, `threshold_ms=15000` (agent_trace artifact `fbd7226c2b66cf14f243fed2ce91bfad`). |
> | **Confidence** | **CONFIRMED** as a latency finding. Not the cause of the silent write failure. |
>
> ---
>
> ## FIXES
>
> ### FIX-1 — Map the priority word to the correct integer before writing (addresses RC-1)
>
> | | |
> |---|---|
> | **Target type** | Tool schema (data mapping in script) |
> | **Target** | `sn_aia_tool.sys_id=8953483c2762479b97bf55da8ed1c4ac`, field `script` |
> | **Current** | `gr.setValue('priority', inputs.priority);` — passes the raw string word |
> | **Proposed** | Add a word-to-integer map before the `setValue` call, and reject unknown values (script body omitted here — see the run's stored message for the full snippet). |
> | **Rationale** | Maps the agent-supplied word to the integer the column actually stores; validates the write succeeded before returning `ok:true`; rejects unknown words instead of silently storing null. |
>
> ---
>
> ### FIX-2 — Mark both inputs mandatory (addresses RC-2)
>
> | | |
> |---|---|
> | **Target type** | Tool schema |
> | **Target** | `sn_aia_agent_tool_m2m.sys_id=1fa91a286055441bb4afce79fe876207`, field `inputs` |
> | **Current** | `[{"name":"ticket","mandatory":false},{"name":"priority","mandatory":false}]` |
> | **Proposed** | `[{"name":"ticket","description":"The sys_id of the bench ticket to update.","mandatory":true},{"name":"priority","description":"The priority as a word: critical, high, moderate, low or planning.","mandatory":true}]` |
> | **Rationale** | Ensures the LLM must supply both parameters; prevents silent undefined-value bugs. |

No VERIFICATION section was present in this run's Fix Report (unlike native
run 2, below, which has one) — recorded as observed, not corrected.

### Custom run 1 (`x_snc_troubleshoot`)

Body: `{"execution": "b07dc9082baa4314f243fed2ce91bf4b", "mode": "diagnose"}`

- Run ID `db78ae602ba6cf14f243fed2ce91bfe2` (`TR1000119`), `conversation_ref`
  `custom-1-1785792141846-937896369`, polled via `GET .../runs/{run_id}`
- Fired 2026-08-03 21:22:20Z. **Terminal state: complete** (last transcript
  entry `2026-08-03 21:22:28`).
- **Wall clock: ~8s.**
- **Tool-call count: 1** (`agent_trace`).

Full `fix_report`:

```json
{
  "failure_summary": "The AI Agent execution for the Seed 01 Ticket Prioritizer completed successfully, with the tool call to set ticket priority returning a success status. The execution processed the objective to prioritize ticket 532bc10c2b6a4314f243fed2ce91bf4b as critical, and no errors were reported in the trace.",
  "layers_swept": {
    "1": {"status": "SWEPT", "reason": "agent_trace provided execution details and tool call status"},
    "2": {"status": "NOT_SWEPT", "reason": "No configuration issues observed in the trace; agent_config not called"},
    "3": {"status": "NOT_SWEPT", "reason": "Tool definitions validated via tool call success in the trace"},
    "4": {"status": "NOT_SWEPT", "reason": "No schema mismatches indicated in the trace"},
    "5": {"status": "NOT_SWEPT", "reason": "Data existence assumed valid due to successful tool execution"},
    "6": {"status": "NOT_SWEPT", "reason": "GenAI stack not explicitly checked via genai_log"},
    "7": {"status": "NOT_SWEPT", "reason": "Trigger wiring not inspected via agent_config"}
  },
  "root_causes": [],
  "fixes": [],
  "verification": "",
  "data_markers": [],
  "inconclusive": {
    "evidence_read": [
      {"source": "trace", "detail": "agent_trace showed successful tool execution with no errors"},
      {"source": "trace", "detail": "tool_call status was 'Success' for setting ticket priority"}
    ],
    "needed_to_conclude": "Further inspection of trigger wiring (layer 7) and GenAI stack (layer 6) via agent_config and genai_log would confirm no configuration gaps"
  }
}
```

**Judgement flag for scoring:** the raw `agent_trace` tool output this run
read (seq 2 of its own transcript, captured live during polling) contains
`"response_digest":"...priority_requested\":\"critical\",\"priority_stored\":
null..."` — the exact discrepancy that both native runs used as their
primary evidence — verbatim in the one tool call this run made. The model
nonetheless concluded "no errors were reported" and returned an empty
`root_causes` array. This is not a case of insufficient evidence (as the
smoke-gate custom run was, correctly-shallow with an UNCONFIRMED root
cause); the defect-bearing field was in front of the model in its one tool
call and it did not read it. Flagged for whoever scores this row, not
corrected or re-run — a valid, if wrong, recorded result per the task's
"recording, not judging" instruction.

### Native run 2 (Agent Doctor, `e1392946828940e5a708fc51b0a5e954`, fresh conversation)

Prompt: `Diagnose execution plan b07dc9082baa4314f243fed2ce91bf4b.`

- Execution ID `68986aa02ba6cf14f243fed2ce91bf0e`, conversation
  `1098e2602ba6cf14f243fed2ce91bfe1` (distinct from native run 1's
  `e7c7eae82b2acb14f243fed2ce91bf79`)
- Fired 2026-08-03 21:22:41Z. **Terminal state: Completed** (trace: Started
  2026-08-03 17:22:44 / Ended 17:25:43 instance-local; cross-checked via
  multi-record `sn_aia_execution_plan` query: `sys_created_on=2026-08-03
  21:22:43`, `sys_updated_on=2026-08-03 21:25:43`, `state=completed`).
- **Wall clock: 179s** (trace-reported duration).
- **Tool-call count: 10** — `agent_trace` ×1, `read_artifact` ×4,
  `agent_config` ×1, `query_table` ×2, `schema_lookup` ×1 (20 execution
  tasks total).

Full text of the Fix Report (pulled from `sys_cs_message`
`88492e282ba6cf14f243fed2ce91bfd5`, `payload.value`):

> ## Fix Report — Execution Plan `b07dc9082baa4314f243fed2ce91bf4b`
>
> ---
>
> ### FAILURE SUMMARY
>
> The user asked agent **Seed 01 Ticket Prioritizer** to set ticket
> `532bc10c2b6a4314f243fed2ce91bf4b` to *critical* priority. The execution
> completed without any error status: all tasks reported Success, the tool
> `set_ticket_priority` ran, and the agent told the user "Priority set to
> **Critical**." However, the priority was **never written**. The tool's own
> response shows `priority_requested: "critical"` and `priority_stored:
> null`. The cause is a type mismatch: `x_snc_tsbench_ticket.priority` is
> declared as an **Integer** field with no choice list, but the tool script
> passes the plain string `"critical"` to `gr.setValue()`. GlideRecord
> silently discards a non-numeric string into an Integer column, stores
> nothing, and returns no error — so neither the tool nor the agent detected
> the failure. The agent then reported success based on the `ok: true` flag
> alone, which was set before the read-back check that exposed the null.
>
> ---
>
> ### LAYERS SWEPT
>
> | # | Layer | Status | Notes |
> |---|-------|--------|-------|
> | 1 | Execution trace | SWEPT | Full task tree and tool call read |
> | 2 | Agent instructions | SWEPT | Reviewed via agent_config (tools section covers binding context) |
> | 3 | Tool definitions | SWEPT | Script body, input schema, and tool smells read in full |
> | 4 | Data schemas | SWEPT | `x_snc_tsbench_ticket.priority` confirmed as Integer, no choices |
> | 5 | Data | SWEPT | Ticket record confirmed present; `priority` column value is blank |
> | 6 | GenAI stack | NOT SWEPT | Trace shows LLM calls completed normally (3 Gen AI tasks, all Success); no model-call failure signature; sweeping this layer would not change the finding |
> | 7 | Trigger and wiring | NOT SWEPT | Execution completed and the agent was invoked correctly; trigger was not implicated by the trace |
>
> ---
>
> ### ROOT CAUSES
>
> **Root Cause 1 — Type mismatch: string passed to Integer column**
>
> | Attribute | Value |
> |-----------|-------|
> | Layer | 4 — Data schema + 3 — Tool definition |
> | Component | `x_snc_tsbench_ticket.priority` field / `set_ticket_priority` tool script |
> | Finding | The `priority` column is type **Integer** with no choice list. The tool script calls `gr.setValue('priority', inputs.priority)` where `inputs.priority` is the string `"critical"`. GlideRecord cannot coerce that string to an integer and silently stores `null`. |
> | Evidence — schema | `schema_lookup` on `x_snc_tsbench_ticket.priority`: `type = Integer`, `has_choices = false`, `declared_on = x_snc_tsbench_ticket` |
> | Evidence — tool script | `agent_config` tools section, tool sys_id `8953483c2762479b97bf55da8ed1c4ac`: `gr.setValue('priority', inputs.priority)` followed by `check.getValue('priority')` returning `null` |
> | Evidence — trace | `sn_aia_tools_execution` row `869d4d482baa4314f243fed2ce91bf89`: response `{ok: true, priority_requested: "critical", priority_stored: null}` |
> | Evidence — data | `query_table` on `x_snc_tsbench_ticket` sys_id `532bc10c2b6a4314f243fed2ce91bf4b`: row exists, `priority` column value is blank |
> | Confidence | **CONFIRMED** — two independent layers (schema + data) corroborate the tool script evidence |
>
> **Root Cause 2 — Tool silently reports `ok: true` when write fails**
>
> | Attribute | Value |
> |-----------|-------|
> | Layer | 3 — Tool definition |
> | Component | `set_ticket_priority` script, `ok` flag logic |
> | Finding | The script sets `ok: true` and only checks whether the record still exists after update; it does not check whether `priority_stored` equals `priority_requested`. The agent reads `ok: true` and concludes success without inspecting `priority_stored: null`. |
> | Evidence | Tool script body (agent_config artifact): the `ok: true` branch is reached whenever `check.get(inputs.ticket)` succeeds, regardless of the stored value |
> | Confidence | **CONFIRMED** |
>
> ---
>
> ### FIXES
>
> **Fix A — Correct the field type (preferred)**
>
> | Attribute | Value |
> |-----------|-------|
> | Target type | Data (schema) |
> | Target | `x_snc_tsbench_ticket`, field `priority` — `sys_dictionary` row where `name = x_snc_tsbench_ticket` and `element = priority` |
> | Current | `type = Integer`, no choice list |
> | Proposed | Change `type` to `Choice` (or `String`); add choice entries mapping labels `critical / high / moderate / low / planning` to the stored values the tool description advertises |
> | Rationale | Aligns the column type with the string values the tool contract specifies; GlideRecord will then store and return the word correctly |
>
> **Fix B — Map words to integers in the tool script (alternative)**
>
> | Attribute | Value |
> |-----------|-------|
> | Target type | Tool schema |
> | Target | `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac`, `script` field |
> | Current | `gr.setValue('priority', inputs.priority)` — passes raw string |
> | Proposed | Add a lookup map at the top of the script mapping `critical/high/moderate/low/planning` to integers 1-5, returning an error for unknown values, then `gr.setValue('priority', val)` |
> | Rationale | Keeps the field as Integer; converts the human-readable word to the integer the column accepts before writing |
>
> **Fix C — Harden the success check (apply alongside A or B)**
>
> | Attribute | Value |
> |-----------|-------|
> | Target type | Tool schema |
> | Target | `sn_aia_tool` sys_id `8953483c2762479b97bf55da8ed1c4ac`, `script` field |
> | Current | Returns `ok: true` whenever the record exists after update, regardless of `priority_stored` value |
> | Proposed | Before returning, compare `priority_stored` against the requested value (or expected integer); if they differ, return `ok: false` with a descriptive error |
> | Rationale | Prevents the agent from reporting success on a silent write failure |
>
> ---
>
> ### VERIFICATION
>
> 1. Apply Fix A or Fix B (not both).
> 2. Apply Fix C to the same script.
> 3. Re-run the agent with the same objective: *"The payment gateway is down for all customers, no workaround. Please prioritise ticket `532bc10c2b6a4314f243fed2ce91bf4b` accordingly."*
> 4. In the new execution trace, verify:
>    - `set_ticket_priority` returns `priority_stored` equal to `"critical"` (Fix A) or the mapped integer (Fix B).
>    - `ok: true` is only present when those values match.
> 5. Query `x_snc_tsbench_ticket` directly and confirm the `priority` column holds the expected value.
>
> ---
>
> ### DATA MARKERS
>
> The following record data was quoted as evidence and should be redacted
> before this report crosses the instance boundary:
>
> - `x_snc_tsbench_ticket` sys_id `532bc10c2b6a4314f243fed2ce91bf4b` — ticket record
> - User sys_id from execution messages — System Administrator identity
> - Email address from execution message stream

### Custom run 2 (`x_snc_troubleshoot`, fresh POST)

Body: `{"execution": "b07dc9082baa4314f243fed2ce91bf4b", "mode": "diagnose"}`

- Run ID `8c19ea682b66871817a6ffbeee91bf4c` (`TR1000121`), `conversation_ref`
  `custom-1-1785792293340-321669767` (distinct token from custom run 1's
  `custom-1-1785792141846-937896369`), polled via `GET .../runs/{run_id}`
- Fired 2026-08-03 21:24:52Z. **Terminal state: complete** (last transcript
  entry `2026-08-03 21:25:02`).
- **Wall clock: ~10s.**
- **Tool-call count: 1** (`agent_trace`).

Full `fix_report` (structurally identical to custom run 1's, same
`inconclusive` shape, same substantive miss):

```json
{
  "failure_summary": "The AI Agent execution for the Seed 01 Ticket Prioritizer completed successfully, with the tool call to set ticket priority returning a success status. The execution processed the objective to prioritize ticket 532bc10c2b6a4314f243fed2ce91bf4b as critical, and no errors were reported in the trace.",
  "layers_swept": {
    "1": {"status": "SWEPT", "reason": "agent_trace provided execution details and tool call status"},
    "2": {"status": "NOT_SWEPT", "reason": "No configuration issues observed in the trace; agent_config not called"},
    "3": {"status": "NOT_SWEPT", "reason": "Tool definitions validated via tool call success in the trace"},
    "4": {"status": "NOT_SWEPT", "reason": "No schema mismatches indicated in the trace"},
    "5": {"status": "NOT_SWEPT", "reason": "Data existence assumed valid due to successful tool execution"},
    "6": {"status": "NOT_SWEPT", "reason": "GenAI stack not explicitly checked via genai_log"},
    "7": {"status": "NOT_SWEPT", "reason": "Trigger wiring not inspected via agent_config"}
  },
  "root_causes": [],
  "fixes": [],
  "verification": "",
  "data_markers": [],
  "inconclusive": {
    "evidence_read": [
      {"source": "trace", "detail": "agent_trace showed successful tool execution with no errors"},
      {"source": "trace", "detail": "tool_call status was 'Success' for setting ticket priority"}
    ],
    "needed_to_conclude": "Further inspection of trigger wiring (layer 7) and GenAI stack (layer 6) via agent_config and genai_log would confirm no configuration gaps"
  }
}
```

**Note on identity verification:** all four run identities are distinct —
two native conversation ids (`e7c7eae82b2acb14f243fed2ce91bf79`,
`1098e2602ba6cf14f243fed2ce91bfe1`) and two custom run sys_ids
(`db78ae602ba6cf14f243fed2ce91bfe2`, `8c19ea682b66871817a6ffbeee91bf4c`) with
two distinct `conversation_ref` anchor tokens, confirmed by direct query of
`x_snc_troubleshoot_run` rather than inference from timing. No anchor
collision — the "one anchor per user per 30 min" fallback did not trigger
despite both custom runs sharing the same `user` (admin) and firing ~2.5
minutes apart.

### Result summary

| Run | Identity | Terminal state | Wall clock | Tool calls |
|---|---|---|---|---|
| Native run 1 | conversation `e7c7eae82b2acb14f243fed2ce91bf79` | Completed | 274s | 10 |
| Custom run 1 | run `db78ae602ba6cf14f243fed2ce91bfe2` (TR1000119) | complete | ~8s | 1 |
| Native run 2 | conversation `1098e2602ba6cf14f243fed2ce91bfe1` | Completed | 179s | 10 |
| Custom run 2 | run `8c19ea682b66871817a6ffbeee91bf4c` (TR1000121) | complete | ~10s | 1 |

**Both native runs named the correct root cause** (Integer-typed
`priority` column silently discarding the string `"critical"`, producing
`priority_stored: null` while the tool still returned `ok: true`) with
CONFIRMED confidence, consistently across two independent conversations.
**Both custom runs missed it** — same shallow layer-1-only sweep, empty
`root_causes`, and (per the judgement flag above) the miss is not
attributable to insufficient tool access, since the one tool call made
carried the discrepancy in its own output. All four runs reached a valid
terminal state on the first attempt; no re-fire was needed.
