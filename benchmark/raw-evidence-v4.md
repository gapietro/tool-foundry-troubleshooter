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
