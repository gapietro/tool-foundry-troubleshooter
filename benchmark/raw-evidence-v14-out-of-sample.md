# v14 — the out-of-sample pass (build `5fb7648`, #175)

> **The pass is keyed to a commit, not a version token** (§W7/§AB6; v13's file opens the same way and
> §1.1 there records an item that was wrong precisely because it trusted a version string).
> **The code under test is `5fb7648`.**
>
> **That is the same commit v13 ran, and the identity is load-bearing rather than incidental.**
> `git log 5fb7648..HEAD -- src/` is **not** empty — it contains exactly one commit, `41c0ce6`
> (#173/#180) — but that commit's entire `src/` diff is **45 added lines, all of them comment lines**
> in `src/server/PaAgentLoop.js` (`git diff 5fb7648 HEAD -- src/` = `1 file changed, 45 insertions(+)`;
> filtering the added lines for anything that is not a comment returns nothing). No executable byte
> differs. See §1.1 for the ruling and why the app was deliberately **not** rebuilt to make the log
> literally empty.
>
> **Consequence for §AN1a, and it narrows it — by ONE variable, not to two.** §AN1a states this pass
> is not single-variable against v13 because the platform moved (Zurich P10 Hotfix 3 → **4a**). It is
> now established that the *harness code did not move at all*: v13 and v14 execute the same `5fb7648`.
> **What is excluded is the product code. What remains is at least three things:** the **platform
> patch**, the **distribution**, and **fixture state** — §1.3 records seed 05's m2m gate at
> `sys_mod_count` 4 against qualification's 3, written by something this file cannot attribute. The
> gate's *value* is correct so no row is at risk, but a changed fixture is a mover and enumerating
> only two would be the same over-claim this note exists to correct. §AN8's first bullet stands
> unamended; this narrows what it ranges over and does not soften it.

Pre-registered at `DECISION.md` §AN, merged in `0c4f36c` before any run of this pass fired —
checkable in `git log -p benchmark/DECISION.md`, as §AN7 requires. §AG5's warning is met: §AN is a
pre-registration, not a rubric section.

**This file records measurements only.** No prediction is evaluated here. §AN6's stopping rule seals
every tally — AN-1a, AN-1b, AN-2, AN-3 and both tripwires — until all twenty runs have terminated
and all twenty packets have been scored and returned. The verdict section is not this file.

> **Clock convention — RE-MEASURED for this pass, and v13's note does not transfer as written.**
> v13's header says `sn_aia_execution_plan` rows carry **instance local time, UTC−4** while
> `x_snc_troubleshoot_run` rows carry **UTC**. That offset is **not present in this pass's readings**:
> the custom smoke run terminated at `19:08:32` (`x_snc_troubleshoot_run` transcript) and the native
> plan created seconds later reads `sys_created_on 2026-08-11 19:08:58` — the **same clock**, not four
> hours apart.
>
> The reconciliation is the *access path*, not the table: **the Table API (`servicenow_query`) returns
> UTC, while `servicenow_aia_trace` renders instance-local (UTC−4).** v13 read plan timestamps through
> the trace tool and attributed the offset to the table. Both of v13's observations are correct; the
> attribution was one level off, and it matters because it changes which readings need converting.
>
> **Verified on one plan read both ways, rather than inferred from the arithmetic.** Plan
> `e7a653c32b6a031017a6ffbeee91bf88`: Table API `sys_created_on` = **`19:08:58`**;
> `servicenow_aia_trace` on the same sys_id reports `Started:` **`15:08:59`**. That pair is
> **3h59m59s**, not a round four hours — the two paths read different fields (`sys_created_on` vs the
> trace's own start reading) and disagree by a second. The **message** timestamps are the exact pair:
> trace `15:09:13`/`15:09:23` ↔ table `19:09:13`/`19:09:23`, **4h00m00s**. The offset is 4 hours; the
> headline pair is off by one second and the difference is stated rather than rounded away, because a
> section whose whole point is *read it, do not infer it* cannot round its own reading.
> **The table does not have a clock; the reader does.**
>
> **Rule for this file:** every timestamp below is UTC unless it is explicitly labelled as coming from
> `servicenow_aia_trace`. Convert before comparing across sources, or compare only within one source —
> and note the source, not just the table.

---

## 1. Pre-flight (§AN7) — fourteen items

§AN7 items 1–9 are read-only probes, item 10 is the smoke gate, and items 11–14 are build/infrastructure
gates. **Items 11 and 14 are by design NOT satisfiable before run 1** — both need `v14-rows.json` and
`v14-reports/`, which the pass itself produces — and are discharged at packet-build time (§1.11).

**Provenance of the infrastructure, stated per item rather than in one sweep.** An earlier draft of
this line said items 12–14 "were satisfied by infrastructure merged in `0c4f36c`". That is wrong for
item 14 and the file's own discipline forbids it — *the commit is load-bearing, not the version
token*, so a discharge attributed to the wrong commit is a claim a later reader will follow and find
unsupported:

| item | coverage | landed in |
|---|---|---|
| 12 | the three new seed specs enter the blind-rule scan | `0c4f36c` (specs + `scorerPacketBlindRule.test.js`) |
| 13 | the v14 advance-rulings channel renders per seed | `0c4f36c` (`packetGeneratorPassSelection.test.js`, +74 lines) |
| 14 | the full `--pass` end-to-end build | **`b36a09d`** (#166, built for v13) — **not** `0c4f36c` |

Every item below was probed live against **gpinst01** (`Zurich Patch 10 Hotfix 4a`, connected as
`admin`) on 2026-08-11. Nothing here is inferred from a prior pass.

### 1.1 Item 1 — the installed product code is repo HEAD's `src/`

**Verified by content, and the literal check does NOT pass — the divergence is ruled, not hidden.**

`git log 5fb7648..HEAD -- src/` contains `41c0ce6`. §AN7 item 1 asks for that log to be empty. It is
not, so the item is discharged under **§AI7 item 1's recorded carve-out** — *"a version reading later
than the build is not a failure when the intervening versions are documentation"* — with the
documentation claim **measured rather than asserted**:

| check | result |
|---|---|
| `git diff --stat 5fb7648 HEAD -- src/` | `src/server/PaAgentLoop.js \| 45 +++++`, 1 file, 45 insertions, 0 deletions |
| added lines that are not comment lines | **none** |
| `TARGET-BLIND BY CONSTRUCTION` present in installed `PaAgentLoop` | **no** (`sys_script_include^name=PaAgentLoop^scriptLIKE…` → 0 records) |
| `THE DEFAULT IS RULED` present in installed `PaAgentLoop` | **no** → 0 records |
| `_withCanonicalLayersSwept` present in installed `PaFixReport` | **yes** → 1 record |

The last two rows together are the actual proof: the Aug-10 **behavioural** fix (`5fb7648`, #151/#155)
**is** installed, and only the Aug-11 **comment** commit is not.

> **What these probes establish, stated at their real width.** Three marker greps across **two** of
> the eighteen installed script includes (`PaAgentLoop`, `PaFixReport`) bracket the delta: they place
> the installed code at or after `5fb7648` and strictly before `41c0ce6`. Since `41c0ce6` is the only
> `src/` commit in that interval, the installed code **corresponds to** `src/@5fb7648` — but the
> probes cannot exclude divergence in an artifact they did not read (`PaToolRegistry`,
> `PaAuditLogger`, the Fluent-side records), and §1.1a declines the rebuild that would make the check
> literal. **This is the one claim in the file that most needs its narrowest wording**, so: the delta
> is bracketed, not exhaustively verified, and nothing downstream should be read as depending on more
> than that.

> **The timestamp trap re-fired here and is worth recording again.** Every `sys_script_include` row in
> scope `13043037d3da4293904504ef30589334` reads `sys_updated_on` of **2026-08-02 or earlier**,
> including `PaFixReport` at `2026-08-02 05:15:00` — a record that demonstrably carries Aug-10 code.
> Read on timestamps alone, the instance looks nine days stale and the obvious response is a rebuild.
> **That response would have been the damaging one** (§1.1a). This is the same trap the v5 smoke
> recorded (*"compare deployed script content, never the timestamp"*) and the same mechanism §AN3
> condition 2 names for the m2m gate — *the install path writes record values while touching neither
> `sys_updated_on` nor `sys_mod_count`*. It is now observed on a **third** record class. Treat audit
> fields on this instance as carrying no information about install state, anywhere.

#### 1.1a Ruling — the app was deliberately NOT rebuilt

Rebuilding would make the log literally empty at the cost of installing a comment-only change
immediately before a measured pass. That was declined, on three grounds:

1. **`src/fluent/` is not inert.** It ships `agent-doctor.now.ts` (`AiAgent`) and `nask-skills.now.ts`
   (`NowAssistSkillConfig`). Per **Build Rule #40** a NASK skill installs **deactivated** with no Fluent
   field to prevent it, and an execution against a deactivated skill fails with a *permission* message
   that names the wrong cause. Per **Build Rule #21** a `'Specific role'` agent INSERTs duplicate
   `sys_security_acl_role` rows on every redeploy.
2. **It would add a second uncontrolled change** to a pass §AN1a already concedes is not
   single-variable — and, per the header note, the code is currently the one variable that is
   provably held constant against v13. Rebuilding would spend that for nothing.
3. **The check exists to guarantee the measured code is the reviewed code**, and that is already true
   in substance: no executable byte differs.

**Recorded rather than quietly discharged**, because the #169 review's finding against v13 §1.4 was
exactly that a pre-flight item got declared satisfied ahead of the check. The claim here is narrower
than item 1's text and says so.

### 1.2 Item 2 — the fixture app is the qualified build

All three new-seed agents exist **by name** on gpinst01 (`servicenow_aia_list`):

| seed | agent | sys_id |
|---|---|---|
| 06 | `Seed 06 Hardware Reporter` | `3e8b1e1f2b1c45c8b437c09ecb6c185a` |
| 07 | `Seed 07 Ticket Classifier` | `56c9f86373974407ac1a276a91cdfa79` |
| 08 | `Seed 08 Batch Watcher` | `fad5a34c531446f6989b071636f5491e` |

Seeds 01–05 are also present; the pass uses **02** and **05** of them (§AN2).

### 1.3 Item 3 — seed 05's m2m gate, re-read by value

`sn_aia_trigger_agent_usecase_m2m` `ba30d8775b0c4cebb960c58830590d5d` → **`active: true`**.

Read as the value itself, per §AN3 condition 2, which forbids deciding this from any audit field.
**The audit fields would have been actively misleading here:** `sys_mod_count` reads **4** where
qualification recorded 3, and `sys_updated_on` reads `2026-08-11 18:42:50`. Something wrote the record
after qualification. The gate is nonetheless correct, which is precisely the case condition 2 was
written for — *"a gate that reset looks completely untouched"*, and the converse also holds.

### 1.4 Items 4 and 5 — the two `PaAgentLoop` budget knobs

| probe | expected | result |
|---|---|---|
| `name=PaAgentLoop^scriptLIKEMAX_EVIDENCE_RETURNS: 0` | 1 record | **1 record** (`63cde457a0a34165ab4dc227797dfd16`) |
| `name=PaAgentLoop^scriptLIKEREQUIRE_RETRIEVAL_TO_RELEASE: false` | 1 record | **1 record**, same sys_id |

`REQUIRE_RETRIEVAL_TO_RELEASE` remains `false` — ruled in §AL/§Y6, not merely unset (#173).

### 1.5 Item 6 — the five seeds' §A3 fixture conditions

> **§AN7 item 6 contains a copy-forward defect, and it is recorded rather than silently reinterpreted.**
> Item 6 reads *"All five seeds' §A3 fixture conditions re-read live, **including seed 04's capability
> sys_id**"*. **Seed 04 is not in this pass** — §AN2 fixes the five as 02 · 05 · 06 · 07 · 08, and 04
> lost the anchor tiebreak to 05 (2 of 4 rows flagged against 3 of 4). The phrase is inherited from
> §AI7 item 6, whose seed set *was* 01–05 and for which the seed-04 clause was a live requirement —
> the very clause the #169 review caught being declared discharged before it was probed.
> **Ruling: item 6 is executed against the five seeds §AN2 actually selects.** Seed 04's capability
> sys_id is not probed, because seed 04 contributes no row and no tally can depend on it. §A3's
> seed-state void conditions name only seeds 4 and 5, so seed 05's gate (§1.3) is the only §A3
> seed-state condition this pass can trip; the remaining seeds' conditions come from their specs, as
> §A3 says they do.

| seed | condition (source) | probe | result |
|---|---|---|---|
| **02** | instruction-driven; no fixture state | tool `measure_request` attached + active | **holds** |
| **05** | §A3 — m2m gate on post-install | §1.3 | **holds** (`active: true`) |
| **06** | spec — table populated, `category` column ABSENT | `servicenow_schema` on `x_snc_tsbench_ticket` | **holds** — 8 fields, only `priority` + `short_description` beyond `sys_*`; **no `category`**. Table holds **19 rows** (spec: population is "load-bearing for the decoy"; qualification needed 15+) |
| **07** | spec — the `read_ticket_context` call returns unbounded | tool attached + active | **holds** |
| **08** | spec — the same tool called repeatedly | tool `check_processing_status` attached + active | **holds** |

Seed 05 correctly has **no** `sn_aia_agent_tool_m2m` rows — its defect is trigger wiring, not a tool.
Seeds 07 and 08's attached tool names match their specs and §AN4 Rulings 7 and 8 exactly.

### 1.6 Item 7 — the three seed-05 probe rows are gone

`x_snc_tsbench_ticket` queried on the three sys_ids from §AC3.2
(`e24c49a22b2203d817a6ffbeee91bf16`, `2fac09262b2203d817a6ffbeee91bfa0`,
`f3ec4d662b2203d817a6ffbeee91bfd5`) → **0 records**. An unfiltered read returns **19 rows**, none of
whose `short_description` values names the seed-05 qualification. The §O5-shaped leak is closed.

### 1.7 Item 8 — `layers_available` by two independent paths

| path | arm | result |
|---|---|---|
| `sn_aia_agent_tool_m2m` where `agent=e1392946828940e5a708fc51b0a5e954` (`Agent Doctor`) | native | **7** rows, all `active: true` |
| `PaToolRegistry` registry definition | custom | **7** entries |

Name-for-name identical: `agent_trace`, `agent_config`, `schema_lookup`, `query_table`, `genai_log`,
`log_analysis`, `read_artifact`. The two paths agree.

> **This item is NOT fully discharged, and the earlier draft's claim that it was is withdrawn.** The
> custom-arm figure was read from the **installed source** (bracketed in §1.1 to `src/@5fb7648`), not
> from an executed `PaToolRegistry` enumeration. §AN7 item 8 asks for two *independent* paths and the
> independence is real — the m2m rows and the registry are separate artefacts that could disagree —
> but **one path is static and remains so.**
>
> An earlier draft said *"the live registry read is discharged by the custom arm's smoke run
> (§1.9)"*. **It is not.** §1.9 records that run at **2 tool calls** (`agent_trace`, `schema_lookup`);
> dispatching two tools through the registry proves the registry *resolves and dispatches*, which is
> worth having, but it enumerates nothing and yields no count. The nearest live corroboration of the
> **seven** is the HOLD text at §1.9a — *"layer(s) 2, 3, 4, 5, 6, 7 declared NOT_SWEPT"* plus the
> ranked layer 4 — and that is the **layer** map, not the tool registry, so it is not the same
> operand either.
>
> **Recorded as a standing limitation of this pass:** item 8's custom path is a source read.
> Discharging it live needs an enumeration the smoke protocol does not perform. Written down rather
> than closed by assertion — an item declared satisfied on a check that was not run is the #169
> failure this file is elsewhere careful about (§1.5).

### 1.8 Item 9 — the budget knobs, read fresh

Both knobs R-4 requires on every scored row:

| knob | value | note |
|---|---|---|
| `sn_aia.continuous_tool_execution_limit` (instance property) | **25** | matches the qualification reading; did **not** bind seed 08's 27-call run |
| `sn_aia_agent_tool_m2m.max_auto_executions` (per binding) | **10** on all 7 `Agent Doctor` tools, and **10** on every seed tool | dictionary default and instance-typical (477 of 483 production rows sit at 10) |

**No R-4 divergence to declare on the binding knob**: nothing in this pass runs at E2's raised 20.
R-4's standing statement is unchanged and still binding — the **shipped OOB default of the instance
property remains genuinely unknown** (§DESIGN R-4: `25` may not be silently treated as the default),
so transferability to a default-configured customer instance stays **unverified**.

### 1.9 Item 10 — the smoke gate, both arms

Target `c9d63a932bda8b9417a6ffbeee91bfd0` (`completed`, created 2026-07-31) — README's known-answer
gate, chosen because the answer is invisible from the plan header. Expected: a `script_error` citing
`context_processing_script` **line 42**. **Not a scored row; carries no rubric weight** (§AN7).

Run **sequentially, custom first**. Both arms invoke the same script tools, which write to
`x_snc_troubleshoot_audit` through `PaAuditLogger`, so concurrent arms would cross-contaminate audit
attribution — §O1's hazard, and the reason §AN7's protocol says strictly sequential.

| arm | run | terminal | verdict |
|---|---|---|---|
| custom | run `0f769f432b6a031017a6ffbeee91bff0` (**`TR1000292`**) | `complete`, 19:08:20 → 19:08:32 = **12s**, `fix_report validated` | **PASS** — `failure_summary`: *"an InternalError in the `context_processing_script` at line 42"*; `root_causes[0].component` = `sn_aia_agent.601672d32b1a83d0f243fed2ce91bf3e.context_processing_script`, layer 1 |
| native | plan `e7a653c32b6a031017a6ffbeee91bf88`, conversation `6aa6df832b6a031017a6ffbeee91bf15`, session `92a69f832b6a031017a6ffbeee91bfbd` | `completed`, 19:08:58 → 19:12:10 = **192s**, 17 tasks, 8 tool calls | **PASS** — **RC-2**, *"InterpretError in `context_processing_script` at Line 42"*, component `sn_aia_agent[601672d32b1a83d0f243fed2ce91bf3e].context_processing_script`, confidence **CONFIRMED** |

**Both arms pass. Every item that CAN be discharged before run 1 is discharged, and the pass may
fire** — items **11 and 14** are deferred to packet build (§1.11) and item **8**'s custom path
remains a source read (§1.7). Stated as three open threads rather than as "12 of 12", because the
count is what an earlier draft got wrong in both directions.

Native's report message is `7157530b2b6a031017a6ffbeee91bfa5` — `role=agent` with an **empty `type`**,
created 19:11:52, after the final tool call. The ten `type=conversation` rows are ReAct chatter, not
report. §AD's capture rule is re-confirmed and was needed again here.

**Sweep breadth differs sharply from v13's smoke and the difference is recorded, not smoothed.**
v13's native smoke made 15 tool calls spanning **7/7 tool types**. This one made 8 calls spanning
**3** — `agent_trace` ×1, `read_artifact` ×6 (paging the same 27,110-char artifact to `eof`),
`agent_config` ×1. The custom arm made **2** (`agent_trace`, `schema_lookup`). Neither figure is a
rubric measurement and neither is predicted by §AN5; recorded because a breadth collapse between two
passes on the *same* known-answer target is the kind of thing that is invisible unless written down
when it is observed.

#### 1.9a The custom arm's HOLD fired, and it is §AL's ruled behaviour reproducing live

The depth gate refused the first terminal action at seq 4:

> `HOLD: terminal action refused — layer 4 (ranked) must be reached; layer(s) 2, 3, 4, 5, 6, 7 declared NOT_SWEPT with no tool call behind them.`

The model then called `schema_lookup` on **`sn_aia_agent_tool_m2m`** and the hold released; the
second `fix_report` validated. The discharging call is **off-fixture** — `sn_aia_agent_tool_m2m` is
unrelated to the diagnosed target (`…context_processing_script`) — which is exactly the release
shape §AL ruled **target-blind by construction** (#173). Reproduced here on a known-answer target
before any scored row was spent. Not a defect; ruled behaviour, and the ruling's live instance.

#### 1.9b Native's `agent_config` came back empty — and its own explanation is wrong

Native reported layer 2 **NOT SWEPT** with the note *"`agent_config` returned empty for agent sys_id
`601672d32b1a83d0f243fed2ce91bf3e`; both `sn_aia_agent` and `sn_aia_usecase` read 'empty' — **likely
a cross-scope privilege gap**"*, and built FIX-2 around granting read access.

**Probed directly: `sn_aia_agent` `601672d32b1a83d0f243fed2ce91bf3e` DOES NOT EXIST.** The smoke
fixture's agent record has been deleted since its 2026-07-31 execution. So `empty` was the correct
read, and the tool's own contract says so — *"a section that is empty with status ok or empty means
the data is genuinely absent; DENIED means a permission gap"*. Native inverted its own tool's
semantics and proposed a permissions fix for a record that is simply gone.

Two consequences, and they point in opposite directions:

- **No blocker for the pass.** The seed agents are present and readable — `sn_aia_agent`
  `cd050d48e810411d9f113fd530694fe6` returns `Seed 02 Request Router` (scope
  `9e497c000e78403ba99d1b763d9c8655`). There is no permission regression on this instance, and
  seed 02's layer-2 rows are not at risk. This was checked *because* an unexplained empty read on the
  anchor's own layer would have damaged four scored rows before anyone noticed.
- **It is a diagnostic-quality miss of exactly the kind the rubric grades**, on a smoke run that
  carries no rubric weight. Recorded here, unscored, and **not** carried into any tally (§AN6 seals
  every tally until all twenty packets are returned).

**The fixture itself is now degraded, and that is filed rather than absorbed — #185.** §AN7 item 10
requires this gate to pass on both arms before **every** scored pass, so a permanently unsweepable
layer 2 is not a one-pass curiosity: every future pass re-runs a known-answer gate that reliably
presents the shape which invited this wrong diagnosis. The gate still discharges its stated
criterion (line 42, both arms), which is why v14 proceeds — but half of what it now demonstrates is
fixture rot rather than harness behaviour, and a gate cannot teach that quietly.

### 1.10 One finding against a closed ruling — filed, not folded in

The custom run's audit rows (`x_snc_troubleshoot_audit`, `run=0f769f432b6a031017a6ffbeee91bff0`) are
**4 rows for 2 tool calls** — the known intent+result 2× shape — and `target_table` is **empty on
both calls**, including a `schema_lookup` whose whole argument was a table name.

§AL (#173) states *"`PaAuditLogger` writes `target_table` on every call (`:372`)"*. `:372` is
`if (p.targetTable) gr.setValue('target_table', p.targetTable)` — a **conditional** write, populated
only when the dispatch site supplies it, and `_normParams` derives it from the caller's payload
rather than from the tool's arguments.

**§AL's ruling stands.** Its argument rests on two supports and the other one holds: `toolCalls()`
returns each call's payload, and the payload does carry the target (`args_digest` =
`sn_aia_agent_tool_m2m`), so the target information *is* present and `_trailTools` *does* project it
away before the gate reads it — target-blind by projection, as ruled. What is inaccurate is the
citation: a reader who follows that sentence to the column finds it blank. Filed as a docblock
correction against §AL, **not** a reopening of #173, and deliberately not fixed inside this pass —
`src/` is frozen for the duration (§1.1a).

### 1.11 Items 11 and 14 — deferred BY DESIGN to packet-build time, not outstanding

**Item 11.** §AN7 requires the blind-rule guard be told about `scoring-v14/` **"as part of building
the packets, not after"**. It is **not satisfiable before run 1**, and that is a property of the
guard rather than an oversight: `PACKET_SETS` entries carry a real `packets:` count and
`scorerPacketBlindRule.test.js`'s `packetFiles()` reads the directory, so declaring a set whose
directory does not yet exist fails the suite.

**Item 14.** `buildAll('v14')` needs `v14-rows.json` and `v14-reports/`, which the pass produces. It
is deferred on identical terms — and, per the note above, was briefly ticked green on the strength of
the synthetic `v98` path, which is the very substitution #176 made invisible.

**Both are discharged at packet build, together, and BEFORE the first packet reaches a scorer** —
which is what each item actually protects. The checklist there is: add the `PACKET_SETS` entry
(`dir: 'scoring-v14'`, `scanned: true`, a real `why`, a real `packets:` count), update the hardcoded
membership literal in the same test, call `buildAll('v14')` for real, confirm the v14 rulings render
on a throwaway `--out` build (§AN7 item 13's live half), and confirm `npm test` green. Navigate by
test name — §AC7 pinned a line number that had already drifted.

### 1.12 Items 12–14 — the infrastructure gates

Baseline at branch point: **33 suites, 1657 tests, all passing.**

| item | requirement | status |
|---|---|---|
| 12 | the three new seed specs are re-scanned by the blind-rule suite | **green** — the guard earned its keep on arrival: an `[answer-key-pointer]` to the decision record shipped in the new specs on first authoring and was caught before the pre-registration merged, so coverage is demonstrated on this seed set rather than assumed |
| 13 | `v14-advance-rulings.json` renders per seed | **green** — `packetGeneratorPassSelection.test.js` asserts all three rulings (`AI4-R1`, `AN4-R7`, `AN4-R8`) render into their own seed and **no other**, using a marker unique to each ruling's prose, and that seeds 01/02/03/04/06 receive `None for this seed` |
| 14 | the generator accepts `--pass v14` and `buildAll('v14')` is exercised | **DEFERRED — see below** |

> **A count discrepancy carried upstream, recorded rather than repeated.**
> `test/scorerPacketBlindRule.test.js` says *"**both** new specs shipped an `[answer-key-pointer]`"*,
> but **three** specs were added in `0c4f36c` (`seed-06-schema-field-missing.md`,
> `seed-07-tool-output-bloat.md`, `seed-08-nonterminating-tool.md`). Two and three cannot both be
> right. This file does **not** assert which specs were involved, because it has not checked — it
> records that the guard fired on the new specs and that the upstream count is unreconciled. Flagging
> a copy-forward at §1.5 and silently reproducing one here would be the same defect wearing the other
> hat.

#### Item 14 is DEFERRED, not green — and the earlier draft ticking it is the defect item 14 names

`buildAll('v14')` **is never called by anything.** The suite exercises `buildAll('v12')` and
`buildAll('v13')` (`packetGeneratorPassSelection.test.js`) plus a full `--pass` build under the
synthetic pass **`v98`**. `resolvePaths` accepts any `/^v\d+$/` token, so `v14` resolves — but
resolution is not execution, and `buildAll('v14')` cannot run before the pass produces
`v14-rows.json` and `v14-reports/`.

**This is exactly the failure class item 14 cites as its own reason for existing**: #176 left
`buildAll('v13')` permanently throwing and nothing noticed, *because a parallel path stayed green*.
An earlier draft of this table ticked item 14 green on the strength of the `v98` path — the same
substitution, one pass later. **Item 14 is therefore recorded as deferred to packet-build time on
identical terms to item 11 (§1.11), and both must be discharged before the first packet reaches a
scorer.**

---
