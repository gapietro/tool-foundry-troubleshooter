# v13 — the determinacy check (`2026.08.1009`, #166)

Pre-registered at `DECISION.md` §AI, merged in `ed0b6c2` before any run of this pass fired.
Infrastructure (§AI7 items 11 and 12) merged in `b36a09d`, also before run 1.

**This file records measurements only.** No prediction is evaluated here — §AI6 seals every tally,
including AI-4 and AI-5 which read off report shape, until all twenty runs have terminated and all
twenty packets have been scored and returned. The verdict is §AJ.

**Framing reminder, because it inverts every prior pass.** v13 is a determinacy check that also
produces milestone figures — not a milestone measurement. The primary outcome is the packet-level
`ambiguous` tally against v12's 8 of 20 (§AD3) and v9's 3 of 12 (§T2's T8). Per §AI4 Ruling 6 the
gate figures are **published, applied to Ruling 3's criterion, and unpredicted**.

---

## 1. Pre-flight (§AI7) — twelve items

Ten items were verified read-only before the smoke gate; item 10 is the smoke gate itself.

### 1.1 Item 1 — the build under test, and the item that was wrong

§AI7 item 1 as merged asks for two probes, neither a version string. Both pass:

| probe | result |
|---|---|
| `sys_app.version` | **`2026.08.1003`** |
| `git log 5fb7648..HEAD -- src/` | **empty** |

`5fb7648` **is** `2026.08.1003` — the commit that published the v12 rows and shipped #155. Versions
`1004`–`1009` are §AE, §AF, §AG, §AH, §AI and the packet infrastructure: documentation and
`benchmark/scripts/`, no `src/`. **So the instance runs repo HEAD's `src/` exactly**, four versions
behind in string and zero lines behind in code.

> **This item was wrong when §AI was first drafted and the pre-flight caught it.** The draft named
> the build `2026.08.1008` and demanded `sys_app.version` read it — three paragraphs after §AI1
> forbids trusting version strings. The live probe returned `1003`, and following the item as written
> would have meant reinstalling a documentation-only version bump to make a cosmetic string match.
> The correction landed before merge and is recorded at §AI1's supersession note.

### 1.2 Items 2 and 3 — the two fixes, probed by content

| item | probe | result |
|---|---|---|
| 2 | `sys_script_include^name=PaFixReport^scriptLIKEthe presence requirement is stated FIRST` | **1 record** — #148 present |
| 3 | `sys_script_include^name=PaFixReport^scriptLIKE_withCanonicalLayersSwept` | **1 record** — #155 present |

**A negative control was run, and it is the reason these are trusted.** Both probes returned exactly
one record — and so did a bare `name=PaFixReport`, which made the `scriptLIKE` clause's contribution
indistinguishable from nothing. `name=PaFixReport^scriptLIKEzzzThisStringCannotPossiblyExistzzz`
returned **zero** records, establishing the filter is real. Without that control the item-3 pass —
the probe §AI9 says the framing depends on — was unfalsifiable.

> **Item 2 named no probe string in the first draft** ("by `scriptLIKE` probe against the fixed
> wording"). An improvised substring can match pre-#148 `PaFixReport` and pass a gate that should
> fail, which is the whole point of §W7. It now names one.

### 1.3 An anomaly, recorded unexplained

Every `x_snc_troubleshoot` script include on gpinst01 reports `sys_updated_on` ≤ **2026-08-02**
(`PaFixReport` at `2026-08-02 05:15:00`), while that same record demonstrably contains code written
**2026-08-10** — `_withCanonicalLayersSwept`, introduced by `5fb7648`, confirmed by `git log -S`.

Both facts are verified. **They are not reconciled.** The code probe is decisive and §W7 already
denies timestamps evidential weight, so nothing here blocks — but an install path that writes
records without touching audit fields is worth understanding, and a future operator reading
`sys_updated_on` on this instance should know it means nothing.

### 1.4 Items 4–9 — knobs, fixtures, and the two-path read

| item | probe | result |
|---|---|---|
| 4 | `PaAgentLoop^scriptLIKEMAX_EVIDENCE_RETURNS: 0` | 1 record — frozen at 0 |
| 5 | `PaAgentLoop^scriptLIKEREQUIRE_RETRIEVAL_TO_RELEASE: false` | 1 record — frozen at false |
| 6 | seed-05 m2m gate `ba30d8775b0c4cebb960c58830590d5d` | `active=true`, `trigger_configuration=x_snc_tsbench_ticket`. **Read, not re-applied** (§AI3.1) |
| 7 | the three seed-05 probe rows | **absent** — re-query returned zero records |
| 8 | `layers_available`, two independent paths | native via `sn_aia_agent_tool_m2m`: **7** tools. Custom via `PaToolRegistry`: the **same 7**. `7/7` both arms, matching v12 |
| 9 | budget knobs, read fresh | `sn_aia.continuous_tool_execution_limit` = **25** (matches v12's `tool_limit`) |

> **Item 9 carries a caveat that is recorded rather than glossed.** `max_auto_executions` **does not
> exist as a property on this instance** — no `sys_properties` row under that name. §T1 recorded the
> first knob as *not read*; the second is now read *and* absent, so this pass inherits an unstated
> platform default exactly as v12 did. It does not confound the comparison — both arms and both
> passes sit under the same unknown ceiling — but it is not a knob anyone has pinned.

The seven tools, agreeing across both paths: `agent_trace`, `agent_config`, `schema_lookup`,
`query_table`, `genai_log`, `log_analysis`, `read_artifact`.

### 1.5 Items 11 and 12 — the two gates the #167 review added

Both were **red** when §AI merged, and both were built before run 1 (`b36a09d`, PR #168).

| item | gate | result |
|---|---|---|
| 11 | a v13 advance-rulings channel | `benchmark/v13-advance-rulings.json` carries §AI4 Ruling 1 (`AI4-R1`) in the v12 shape. Tested: renders into seed-05 packets, absent from seeds 01–04, trips neither `LEAK_PATTERNS` nor `VERDICT_PHRASES` |
| 12 | a v13-capable packet generator | `build-v12-packets.js` → `build-packets.js`, pass as data. `--pass v13` resolves `scoring-v13`, `v13-reports`, `v13-rows.json`, `v13-advance-rulings.json` |

**v12's twenty packets are byte-identical across the parameterisation.** The pre-rename generator and
the parameterised one were each run to a scratch directory; `diff -r` reports no difference. This is
the check that mattered — a parameterisation that quietly altered packet bytes would have invalidated
the v12↔v13 comparison that is this pass's entire primary outcome, and nothing else would have caught
it.

> **The #168 review then found a defect neither the build nor any test covered**, by hand-running a
> full `--pass v13`: the post-build runbook was still hardcoded to `scoring-v12`. Both printed edits
> are already done for `scoring-v12`, so an operator following the runbook would make two no-op
> changes, see `npm test` green, and conclude the gate passed — **while `scoring-v13/` never entered
> `PACKET_SETS` and the blind-rule scan never covered a single v13 packet.** §AI6 puts the operator
> at exactly that point, after twenty runs of instance time. Fixed to interpolate the directory the
> run actually wrote, and two end-to-end tests added over a disposable fixture; reintroducing the
> hardcoded string turns the new test red.

### 1.6 Item 10 — the smoke gate, both arms

Target `c9d63a932bda8b9417a6ffbeee91bfd0` (state `completed`, created 2026-07-31). Expected:
`script_error` citing `context_processing_script` **line 42** — README's known-answer gate, chosen
because it is invisible from the plan header. **Not a scored row; carries no rubric weight.**

| arm | run | terminal | verdict |
|---|---|---|---|
| custom | run `4dead7fe2bae0718f243fed2ce91bfe8` (**`TR1000266`**) | complete, created 00:48:54 → updated 00:49:11 = **17s** | **PASS** — `failure_summary` names "InternalError in the `context_processing_script`… occurring at **line 42**" |
| native | execution `51dadb722b6a0bd817a6ffbeee91bf8b`, conversation `08da5b722b6a0bd817a6ffbeee91bfc2` | completed, **280s**, 15 tool calls, 26 tasks | **PASS** — ReAct scratchpad records *"HIGH-confidence script_error in `sn_aia_agent.601672d32b1a83d0f243fed2ce91bf3e.context_processing_script` **line 42**"*; all seven tool types called |

**Both arms pass. Pre-flight is 12 of 12 and the pass may fire.**

Native's sweep profile matches v12's strongest native row almost exactly: 15 tool calls spanning
`agent_trace`, `read_artifact` (×8, paging a 27,110-char artifact to `eof`), `agent_config` (×2),
`genai_log`, `log_analysis`, `query_table`, `schema_lookup` — **7/7 tool types**. LLM P95 latency
69.3s, tool P95 186ms: the wall-clock is the model, not the harness.

One behaviour worth recording because it shapes report capture: the agent delivered the Fix Report
**twice** — the first `show_output_to_user` truncated mid-`RC-2`, and the ReAct engine then
re-delivered the whole report in one message (*"The previous output was truncated mid-RC-2.
Completing and delivering the full Fix Report now as a single show_output_to_user action."*). §AD's
packet rule already covers it — carry every `role=agent` message after the final tool call,
concatenated in creation order — and this run is why that rule is not optional.

### 1.7 Reading a native report: the field trap that costs an hour

`sn_aia_message` is queried on **`execution_plan`**, not `conversation`, and the report text is in
**`message`**. Getting that wrong does not produce a "no such field" error:

```
sn_aia_message^conversation=<id>   →  "Access denied: Insufficient rights to query records"
sn_aia_message  (no query at all)  →  1 record, read fine
```

**A bad query field on this instance is reported as an ACL failure**, which is indistinguishable at a
glance from the Build Rule #42 no-ACL shape and sends the operator to check roles and ACLs on a
table they can already read. The cheap discriminator is a bare `limit: 1` query with no `query` and
no `fields`: if that returns a row, the table is readable and the field name is the fault.

Report messages for this run: the three `role=agent` rows with an **empty `type`** created after the
final tool call — `d2ab533a2b6a0bd817a6ffbeee91bf9b` (00:52:17), `4deb5b7a2b6a0bd817a6ffbeee91bfa5`
and `55eb5b7a2b6a0bd817a6ffbeee91bfad` (both 00:53:17). The sixteen `type=conversation` rows are
ReAct turn chatter, not report. Order by `sys_created_on`: `message_sequence` is populated on only
the first agent message and empty on the rest (§AD's correction, re-confirmed here).

**A protocol note carried forward and re-confirmed.** `servicenow_aia_execute` with
`waitForCompletion=false` returns a Session ID but **no** execution-plan sys_id, so the plan is
recovered by querying `sn_aia_execution_plan` on a recent-creation window. Session
`44da5b722b6a0bd817a6ffbeee91bf4a` → plan `51dadb722b6a0bd817a6ffbeee91bf8b`. Read terminal state
from `aia_trace` or the plan row, **never** from `aia_logs` (§AC7's tooling note).

**One correction to the custom arm's invocation, for the next operator.** `POST /analyze` takes
`execution`, not `execution_id`; the wrong key returns a bare `400 Bad Request` with no field named.

---

## 2. The ten seeded target executions

*(populated as the pass runs — one row per seed/rep, both arms diagnose the same seeded execution)*

Fresh bench ticket per rep for seeds 01 and 04 so rep 1's agent writes cannot contaminate rep 2
(v9 §2's rule). Seeds 02 and 03 need no ticket. Seed 05 stays inactive per §AI3.

### 2.1 The seed agents are invoked directly — only seed 05 has a trigger, and it is off by design

**Checked before assuming, because v12's §2 column header ("trigger") reads as though the inserts
fired the agents.** They do not. `sn_aia_trigger_configuration` where `target_table =
x_snc_tsbench_ticket` returns exactly **one** record:

| name | active | condition | trigger_flow |
|---|---|---|---|
| `Seed 05 Bench Ticket Created` (`bfb77d6c64884500a80203ee029436ee`) | **false** | `short_descriptionISNOTEMPTY` | `924c09a22b2203d817a6ffbeee91bf63` |

That is seed 05's own seeded defect (§AI3), and it is the **only** trigger on the bench table. So
inserting a ticket fires nothing: seeds 01 and 04 are invoked with `servicenow_aia_execute` against
the ticket as `targetRecord`, and seeds 02 and 03 with a bare message. The insert creates the
fixture; the invocation creates the execution.

> **A second instance of the field trap, inside this same check.** `sn_aia_trigger_configuration`
> has no `table_name` column — the field is **`target_table`** — and querying the wrong one returned
> "Access denied: Insufficient rights to query records" on a table the same session reads without
> difficulty. That is now twice in one pass (§1.7 was the first, on `sn_aia_message`). Treat
> "Access denied" on this instance as **a bad field name until a bare `limit: 1` query proves
> otherwise.**

### 2.2 Bench ticket fixtures

Four created, one per rep for seeds 01 and 04, all with `priority` **empty** at insert. Fresh per
rep so rep 1's agent writes cannot contaminate rep 2 (v9 §2's rule).

| seed | rep | ticket sys_id | short_description |
|---|---|---|---|
| 01 | 1 | `9182277e2bea0bd817a6ffbeee91bf31` | Payment gateway rejects every card transaction at checkout across all storefronts, revenue halted |
| 01 | 2 | `5cc267be2bea0bd817a6ffbeee91bf8b` | VPN concentrator drops all remote sessions every ninety seconds, entire field workforce offline |
| 04 | 1 | `64c2abbe2bea0bd817a6ffbeee91bf2f` | Meeting room display flickers with a magenta cast during video calls on the third floor |
| 04 | 2 | `c5c2a77a2b624718f243fed2ce91bf25` | Nightly inventory reconciliation job omits the final warehouse in its output file |

All four are newly worded rather than reused from v12, so no seeded execution in this pass shares a
`short_description` with one a scorer may have seen.

### 2.3 The executions

| seed | rep | execution plan sys_id | invocation | plan state |
|---|---|---|---|---|
| 02 | 1 | `0913233e2b624718f243fed2ce91bf0f` | `Seed 02 Request Router`, message only | **completed 25s**, 1 tool call `measure_request` (591ms) |
| 03 | 1 | `8513233e2b624718f243fed2ce91bf6e` | `Seed 03 Category Router`, Network category | **completed** |
| 04 | 1 | `a513a33e2b624718f243fed2ce91bf4e` | `Seed 04 Summarizer` on ticket `64c2abbe…` | **completed 21s**, 1 tool call `summarise_ticket` (685ms) |
| 02 | 2 | `d96323b22b2e0bd817a6ffbeee91bf04` | `Seed 02 Request Router`, parking permit | **completed** |
| 03 | 2 | `656323b22b2e0bd817a6ffbeee91bfb7` | `Seed 03 Category Router`, Facilities category | **completed** |
| 04 | 2 | `ea63a3b22b2e0bd817a6ffbeee91bfb0` | `Seed 04 Summarizer` on ticket `c5c2a77a…` | **completed** |
| 01 | 1 | `dfa22b7a2b624718f243fed2ce91bf12` | `Seed 01 Ticket Prioritizer`, sys_id only | **VOID — stalled, see 2.4** |
| **01** | **1** | **`c343e7be2b624718f243fed2ce91bfd3`** | `Seed 01 Ticket Prioritizer`, sys_id + urgent description | **completed 67s**, 1 tool call `set_ticket_priority` (250ms, **OK**) |
| 01 | 2 | `1c65237e2b2e0bd817a6ffbeee91bfff` | `Seed 01 Ticket Prioritizer` on ticket `5cc267be…` | **completed 67s**, 1 tool call `set_ticket_priority` (307ms, **OK**) |
| 05 | 1, 2 | **none, by design** | ticket `0277233a2b6e0bd817a6ffbeee91bf6f` inserted 21:43:52 | **absence verified — see 2.6** |

**All eight execution-producing fixtures are complete.** Seed 05 produces no execution by
design, so the pass needs eight, not ten.

### 2.4a Seed 01's defect, confirmed live and it is sharper than "the value is wrong"

Rep 1's `set_ticket_priority` returned **`[OK]` in 250ms**. The ticket afterwards:

| field | value |
|---|---|
| `priority` | **empty** |
| `sys_mod_count` | **0** |

`sys_mod_count: 0` is the part worth having. The write did not land wrong — **it never happened at
all**, and the tool still reported success. A diagnosis that stops at "the priority is wrong" has
not reached the defect; the record was never updated, and the tool's own status is actively
misleading. This is the schema mismatch the seed exists to plant (a word forwarded to an
Integer-typed column), observed end to end.

### 2.5 Seed 01 rep 2 was NOT a second stall — it was latency, and the claim it was is withdrawn

**This subsection previously reported a "second stall shape" and a flakiness finding. Both were
wrong, and they are corrected here rather than deleted**, because the mistake is the instructive
part.

`1c65237e…` **completed in 67s** with one `set_ticket_priority` call (307ms, `OK`) — the same
duration and the same terminal shape as rep 1. What was read as a hang was the OOB
`organize_general_knowledge` step followed by a slow model turn: **LLM P95 latency 22,037ms** on this
run against 4,780ms on rep 1, a 4.6× spread on identical work.

**The error was calling a stall from two identical polls.** Two consecutive traces showed the same
task list, the same `0` tool calls and no new message, and that was treated as evidence of a hang.
It is not: it is exactly what a 22-second model turn looks like through a polling window shorter
than the turn. The genuine stall (`dfa22b7a…`) is distinguishable and stayed distinguishable — it
carried **an agent message containing an input schema**, which is a positive signal, not an absence.

> **The corrected discriminator, which §2.4's version got half right.** A stall is
> `TOOL CALLS (0)` **plus a message whose body is an input schema**. `TOOL CALLS (0)` on its own
> means nothing — tool calls are recorded on completion, so any run mid-turn shows zero. The earlier
> wording ("`TOOL CALLS (0)` plus an input-schema message") is right only if both halves are
> required, and this pass proved what happens when the second half is treated as optional.

**Seed 01 is therefore not flaky, and the recipe is deterministic:** invoke with the ticket sys_id
**plus** an urgent-sounding description, per the seed spec's Trigger section. One attempt out of
three failed, and it is the one that omitted the description. The risk this subsection previously
raised against seed 01's 4 scored rows does not exist.

Rep 2's defect is confirmed on the same terms as rep 1: ticket `5cc267be…` reads `priority` **empty**
and `sys_mod_count` **0** after a tool call that returned `OK`.

### 2.6 Seed 05 is blocked on seed 01 rep 2, and the reason is a protocol constraint

Seed 05's fixture is an **absence**: insert a bench ticket, then verify **zero execution plans
created instance-wide** across a multi-minute silence window (v12 §3.58; the qualification measured
~1s from insert to plan when the trigger *is* active). That check cannot run while any other agent is
executing, so seed 05 was produced **last**, after all eight execution-producing fixtures had
terminated.

| check | result |
|---|---|
| ticket inserted | `0277233a2b6e0bd817a6ffbeee91bf6f` at **21:43:52**, `short_description` non-empty (satisfies the trigger's `short_descriptionISNOTEMPTY` condition) |
| execution plans created instance-wide since | **zero**, across a 4+ minute silence window |
| m2m gate `ba30d8775b0c4cebb960c58830590d5d` | still **`true`** |
| trigger config `bfb77d6c64884500a80203ee029436ee` | still **Inactive** |

**The empty result was proved to be an absence rather than a stale read, with a positive control.**
§2.3's staleness note is the reason this matters: a narrow window had already returned zero for a
plan that existed. So the silence query was re-run at `minutesAgoStart(20)`, wide enough to reach
back past the last real execution — it returned **all eight** fixture plans, newest
`1c65237e…` at 21:34:44, and **nothing at or after 21:43:52**. The query demonstrably sees plans in
the window it covers; there simply are none after the insert.

With the m2m gate on and only the trigger config off, the seed isolates exactly one gate — which is
the whole point of §A3's void condition for it, and what a correct diagnosis has to name
specifically rather than saying "the trigger is off".

### 2.7 Fixture manifest — all eight execution-producing fixtures, plus seed 05's absence

| seed | rep | plan | created |
|---|---|---|---|
| 01 | 1 | `c343e7be2b624718f243fed2ce91bfd3` | 21:25:38 |
| 01 | 2 | `1c65237e2b2e0bd817a6ffbeee91bfff` | 21:34:44 |
| 02 | 1 | `0913233e2b624718f243fed2ce91bf0f` | 21:24:40 |
| 02 | 2 | `d96323b22b2e0bd817a6ffbeee91bf04` | 21:26:04 |
| 03 | 1 | `8513233e2b624718f243fed2ce91bf6e` | 21:24:41 |
| 03 | 2 | `656323b22b2e0bd817a6ffbeee91bfb7` | 21:26:05 |
| 04 | 1 | `a513a33e2b624718f243fed2ce91bf4e` | 21:24:43 |
| 04 | 2 | `ea63a3b22b2e0bd817a6ffbeee91bfb0` | 21:26:09 |
| 05 | 1, 2 | *(none — the absence is the fixture)* | ticket 21:43:52 |

Plus one void: `dfa22b7a2b624718f243fed2ce91bf12` (seed 01, invoked without a description, §2.4).

**Stage 2 is complete.** Both arms diagnose the same fixture for a given seed/rep, per §AI7.

Seed 02 rep 1 reproduces v12's shape exactly: a routing request answered by a character counter.
Seed 04 rep 1 likewise fires `summarise_ticket` once, the unmapped-capability path.

**All four bench tickets read `priority` empty and `sys_mod_count: 0` at handoff** — no write has
landed on any of them, so every seed-01/04 fixture is intact and uncontaminated.

### 2.4 Seed 01 will not fire from a bare sys_id — and this is a fixture finding, not a harness one

**Both seed-01 attempts stalled with zero tool calls.** The first (`dfa22b7a…`) is diagnostic: at
+23s the agent emitted, as its own message, a request for inputs it had not been given —

```json
[{"name":"ticket_description","prompt":"What is the request or issue described in the ticket? …",
  "dataType":"text"},{"name":"affected_users","prompt":"…"}]
```

— i.e. it entered `collect_input_from_user` and waited. `Mode: Interactive`, and nothing was ever
going to answer it. **The invocation was wrong, not the agent.** `seeds/seed-01-schema-mismatch.md`
§Trigger says it plainly: give the agent *"the ticket sys_id **plus an urgent-sounding
description**"*. The first attempt supplied only the sys_id.

The retry (`c343e7be…`) supplies both and had not requested input by handoff, but had also made no
tool call. **Whether the retry completes is unresolved and is the first thing the next session must
check.** If it also stalls, the next probe is whether `Seed 01 Ticket Prioritizer` requires its
inputs supplied structurally rather than in prose — the other three seeds take a bare message and
fire on the first turn, so seed 01 is the outlier.

> **Two operator lessons, both cheap to bank.** A stalled agent presents as `State: In progress`
> with `Duration: 0s` **indefinitely** — it is indistinguishable at a glance from a slow run, and
> the discriminator is `TOOL CALLS (0)` plus an agent message containing an input schema. And
> `sn_aia_execution_plan.agent` carries the agent's display name, which makes plan→seed mapping
> exact without tracking session IDs; fire different agents concurrently and the mapping stays
> unambiguous, fire the same agent twice and disambiguate on `sys_created_on`.

> **A read-staleness note, matching §3.0's warning in v12's file.** The plan for seed 01 rep 1 was
> created at 01:22:54 and a `sys_created_on>=javascript:gs.minutesAgoStart(3)` query run immediately
> afterwards returned **zero** records; the same query at `minutesAgoStart(10)` returned it. Do not
> read an empty narrow-window result as "the agent did not fire".

---

## 3. The twenty rows — measurements

*(populated as the pass runs)*
