# Seed qualification — seeds 02 and 05 (#151)

Run 2026-08-09 on gpinst01 (Zurich Patch 10 Hotfix 3), as admin, against the `TS Bench Seeds`
fixture app (`sys_scope` `9e497c000e78403ba99d1b763d9c8655`), installed 2026-08-02 01:16.

**Purpose.** The next scored pass is sized at 5 seeds × 2 reps × 2 arms (20 runs, 10 valid per arm,
§A3.4's floor read per arm). Seeds 02 and 05 have been out of scope since §Q6 and had to be
qualified **before** the pre-registration commits to them — a pre-registration binds you to what it
asserts, so its seed set must be measured rather than assumed. §W's build-under-test probe is the
precedent.

**This file claims no result about either harness.** No diagnostic run was fired, no packet was
built, no row was scored. It records fixture state only.

**Mutations made, all to the fixture app and all restored:** one trigger config activated and
deactivated, three rows inserted into `x_snc_tsbench_ticket`. Restoration verified — see §3.4.

---

## 1. Seed 02 — QUALIFIED on construction, with one thing this does not settle

| check | value | verdict |
|---|---|---|
| Agent record | `cd050d48e810411d9f113fd530694fe6` — *Seed 02 Request Router*, updated 2026-08-02 01:16:10 | present |
| Tools bound (`sn_aia_agent_tool_m2m`) | exactly **1**, `active=true` | matches spec |
| The tool | `c3beac9180474930a70e4a4a3de7126d` — `measure_request`, `type=script` | matches spec |
| Tool description | *"Measures an incoming request: returns its character count and an approximate word count. Give it the request text."* | **no group/routing/assignment vocabulary** |

The seed doc's construction rule is *"Do not give the tool group/routing/assignment vocabulary or
capability — a tool that even hints at lookup either moves the defect to layer 3 or makes the fix
appear already applied."* The live description contains no such vocabulary. The v2 construction is
intact on the instance and `test/seed02Construction.test.js` guards it in the repo.

**What this does NOT settle.** Seed 02's two v4 native rows scored **0/6** on a "no failure
observed" convergence, and the custom harness's seed-02 v2 rows scored 0/6 as well. §O6 deliberately
declined to rule whether that is a true negative about the fixture or a shared blind spot in a
trace-first method, and **nothing here rules on it either** — fixture integrity and scoring outcome
are different questions. Including seed 02 in the pass means including two rows per arm whose prior
behaviour is a 0/6 convergence. That is a prediction the pre-registration must file in advance, not
a surprise to absorb afterwards.

---

## 2. Seed 05 — the m2m gate is NOT outstanding

| check | value |
|---|---|
| Agent | `a4b7ef5d793346ea861730c6d28b8f58` — *Seed 05 Ticket Acknowledger* |
| Trigger config | `bfb77d6c64884500a80203ee029436ee` — *Seed 05 Bench Ticket Created* |
| `active` (seeded defect) | **`false`** — as seeded, correct |
| `run_as` / `run_as_script` / `run_as_user` | **all empty** — live confirmation of the seed doc's `dist/` reading |
| `target_table` / `condition` | `x_snc_tsbench_ticket` / `short_descriptionISNOTEMPTY` |
| `sn_aia_trigger_agent_usecase_m2m` `ba30d8775b0c4cebb960c58830590d5d` | **`active=true`** |
| Use case `af15173b98ce46c3a5f35a9f7160e888` | `execution_mode=autopilot` ("Autonomous") |

**The m2m gate PATCHed on 2026-08-02 persisted and still reads `true` today.** The seed doc treats
this as a mandatory pre-flight step whose omission voids both of the seed's runs; it is not
outstanding, and the operator does not need to re-apply it. It should still be **re-read** before the
pass, because the doc's rule is "do not assume the PATCH took" and an intervening reinstall would
reset it.

---

## 3. Seed 05 — the `run_as` question, open since 2026-08-01, is answered

The seed doc: *"SDK 4.9.0 guidance states that trigger run-as configuration is now required for all
trigger types. This workflow sets no `runAs` … The trigger may therefore still not fire even after
the m2m gate is on. If it does not, that is a **second** wiring defect layered on the seeded one and
the seed is no longer isolating a single cause — resolve it before scoring rather than scoring
through it."*

The question has **zero mentions in `DECISION.md`** — it was recorded in the seed doc and never
carried into the decision record or resolved.

### 3.1 The first probe was void, and the reason matters

| time | event |
|---|---|
| ~19:47:2x | `PATCH sn_aia_trigger_configuration/bfb77d6c… {"active":"true"}` |
| **19:47:24** | ticket `e24c49a22b2203d817a6ffbeee91bf16` inserted |
| **19:47:28–29** | `trigger_flow` generated — `sys_hub_flow` `924c09a22b2203d817a6ffbeee91bf63` |

No execution plan resulted, and that is **not** evidence about `run_as`: the ticket was inserted
**four to five seconds before the backing flow existed**. Activation is asynchronous and generates
the flow after the PATCH returns. A probe fired inside that window measures the race, not the seed.

**Carry this into the pass.** Any procedure that activates a trigger and immediately exercises it
must wait for `trigger_flow` to be populated and its `sys_hub_flow.active` to read `true` before
inserting the triggering row. This is the same shape as §W's instruction to verify the build under
test by probe rather than by `sys_updated_on`.

### 3.2 The valid probe — the trigger fires

| time | event |
|---|---|
| 19:47:28 | flow `924c09a2…` — `active=true`, `status=published`, **`run_as=user`** |
| **19:49:06** | ticket `2fac09262b2203d817a6ffbeee91bfa0` inserted |
| **19:49:07** | execution plan `7facc9262b2203d817a6ffbeee91bf18` created — usecase = *Seed 05 Ticket Acknowledgement* |

**Answer: the empty `run_as` does not prevent the trigger from firing.** Activation generates a
trigger flow that carries `run_as: user` of its own, and the trigger fires in ~1 second. There is no
second wiring defect *at the firing layer*, and the 4.9.0 "run-as required" guidance does not bite
here.

### 3.3 But the execution terminates immediately — a second defect at the execution layer

`servicenow_aia_trace` on `7facc926…`:

```
State: Terminated        Run Type: Trigger   Mode: Interactive
EXECUTION TASKS (0)  ·  TOOL CALLS (0)  ·  MESSAGES (0)
```

`sn_aia_execution_plan.status` = **`error`**, `objective` = **empty** (the trigger config carries
`objective_template` = *"Acknowledge the newly created bench ticket"*), and the plan's
`execution_mode` is **`interactive`** while the use case's is **`autopilot`/Autonomous**. The trigger
config's `channel` is *Now Assist Panel*.

So: **the trigger fires, and the acknowledgement still never happens.** Flipping
`sn_aia_trigger_configuration.active` to `true` — the seed's own sanctioned fix — does not produce
the behaviour the seed says should follow from it.

**Why this is a scoring hazard rather than a curiosity.** Seed 05's expected *diagnosis* is
unaffected: root cause `wiring`, the trigger's `active=false`, fix target activation, naming the
specific gate. All of that remains correct and scorable. The exposure is `fix_usable_unedited` —
the gate column that accounted for five of the seven native gate failures in the v4 pass (§O). A
report proposing "activate the trigger" would be proposing a fix that, applied unedited, demonstrably
does not restore the acknowledgement. Whether that costs the column is a rubric question, and it is
**not** settled by §A2.1's two clauses. It must be decided in the pre-registration, before the
scorers meet it.

### 3.4 Restoration — verified, not assumed

| time | event |
|---|---|
| ~19:50:0x | `PATCH … {"active":"false"}` — re-read `active=false` |
| 19:50:03 | flow `924c09a2…` auto-deactivated by the platform — `active=false`, `status=draft` |
| **19:50:12** | ticket `f3ec4d662b2203d817a6ffbeee91bfd5` inserted |
| 19:50–19:54 | **no execution plan created** — the seeded defect holds |

Against a measured 1-second fire time when live, four minutes of silence is conclusive. The seed is
restored.

**One residual difference, recorded rather than smoothed.** `sn_aia_trigger_configuration.trigger_flow`
is now populated (`924c09a2…`, inactive/draft). **Its pre-activation value was not captured** — the
record was first read in full *after* the PATCH — so whether it was previously empty is **unknown**,
and this file does not assert that it was. What is established is that the field is non-empty now,
the referenced flow is inactive and draft, and firing does not resume. A diagnostic agent sweeping
layer 7 can read that field; if a run cites it, the citation should be read against this note.

**Three probe rows** (`e24c49a2…`, `2fac0926…`, `f3ec4d66…`) remain in `x_snc_tsbench_ticket`,
alongside the seven that predate this session. They are inert — the seed's trigger is off — but a
run that queries the table will see them, and their `short_description` values name this
qualification. **They are candidates for deletion before the pass**, since "Qualification probe for
seed 05 run_as question" is text a diagnostic agent could read as a hint.

---

## 4. Disposition

| seed | verdict |
|---|---|
| **02** | **Qualified on construction.** Its 0/6 prior behaviour is a prediction to file, not a defect to fix |
| **05** | **Qualified to fire.** The `run_as` question is answered — no firing-layer defect. An execution-layer defect exists and bears on `fix_usable_unedited` only |

Neither seed is disqualified. Both carry a condition the pre-registration must state explicitly
rather than inherit:

1. **Seed 02** — file the expected 0/6 convergence as a prediction in advance, with what would count
   as refuting it.
2. **Seed 05** — rule, in advance, whether an "activate the trigger" fix scores
   `fix_usable_unedited` given that activation alone does not restore the acknowledgement.
3. **Operational** — re-read the m2m gate before the pass; wait on `trigger_flow` before any
   post-activation probe; decide whether to delete the three probe rows.
4. **The blind-rule guard will not scan the new pass's packets until it is told to.**
   `test/scorerPacketBlindRule.test.js` scans a **hand-maintained `PACKET_SETS` declaration**
   (`scoring-v4`, `scanned: false`; `scoring-v9`, `scanned: true`) — it does **not** auto-discover
   scoring directories. A new `scoring-v<n>/` therefore starts life unscanned, and the suite stays
   green while it is. That is the same shape as #143, where a channel reached every packet and
   nothing scanned it. **Add the new directory to `PACKET_SETS` as part of building the packets, not
   after** — and note this file is correctly *outside* that channel: the guard scans only
   `row-NN-*.md` packets, because operator records like this one are never handed to a scorer.

**Why this file names blind-rule tokens freely.** It is an operator record, in the same class as
`packet-build-report.md` and `run-evidence.md` — explicitly out of the scorer-facing channel by the
guard's own declaration. It must never be pasted into a packet.

**Unchanged:** native remains the recommended path on this instance and the Phase 1b milestone is
not met. Nothing here is evidence about either harness.
