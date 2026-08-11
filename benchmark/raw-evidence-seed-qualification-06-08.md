# Seed qualification — seeds 06, 07 and 08 (#175)

Run 2026-08-11 on gpinst01 (**Zurich Patch 10 Hotfix 4a** — see §0), as admin, against the
`TS Bench Seeds` fixture app (`sys_scope` `9e497c000e78403ba99d1b763d9c8655`).

**Purpose.** #175 changes the benchmark's seed distribution and holds the §AG/§AH clauses fixed.
Three new seeds have to exist and be **measured** before `DECISION.md` §AN can name them — the same
order `raw-evidence-seed-qualification-02-05.md` established for seeds 02 and 05: *"a
pre-registration binds you to what it asserts, so its seed set must be measured rather than
assumed."* §W's build-under-test probe is the precedent.

**This file claims no result about either harness.** No packet was built, no row was scored, no
scorecard value moved. §T9 governs: **no v12 or v13 value is touched.** One diagnostic run was fired
(§4.2) and its status is stated there — it is a fixture observation, not a benchmark row.

**Mutations made, all to the fixture app:** one bench ticket inserted (§0.3, retained deliberately);
one `sn_aia_trigger_agent_usecase_m2m` gate re-enabled (§1); five installs of the fixture app. Two
agent constructions were built, installed, refuted and removed (§2, §3).

---

## 0. Instance state — two findings that bind the pre-registration

### 0.1 The instance was patched between v13 and this pass

| | |
|---|---|
| `sys_upgrade_history` `b539b6432b220310f243fed2ce91bf45` | **2026-08-11 17:00:15** |
| from | `glide-zurich-07-01-2025__patch10-hotfix3-07-01-2026_07-02-2026_1215.zip` |
| to | `glide-zurich-07-01-2025__patch10-hotfix4a-07-24-2026_07-28-2026_2322.zip` |

v13's runs fired **12:54:57 → 14:38:37 UTC** on 2026-08-11 (`x_snc_troubleshoot_run` TR1000268 →
TR1000290). The upgrade landed **~2h22m after the last v13 row**.

**So v13 is entirely a Hotfix 3 measurement and every subsequent pass is Hotfix 4a.** #175 asks that
non-single-variable status be *stated in the pre-registration rather than discovered at scorecard
time*; this is that fact, and it arrived from the platform rather than from a harness change. §AN
carries it.

> Note the two clock conventions, per §AJ5 finding 1: `servicenow_query` returns **UTC** and
> `servicenow_aia_trace` returns **instance-local**. Every timestamp in this file is UTC unless it
> is quoted from a trace.

### 0.2 The install path writes values without touching audit fields

Seed 05's m2m gate read `active=false` after the first install of this session, with
`sys_updated_on` still reading **2026-08-02 06:23:33** — *earlier* than the 2026-08-09 qualification
that read it `true`. The value changed and the audit field did not. A REST `PATCH` to the same
record immediately moved `sys_updated_on` to 17:48:31 and `sys_mod_count` 2 → 3.

This is a direct confirmation of the anomaly §AI1 flagged as unexplained and carried as pre-flight
item 11 (*"an install path that writes records without touching audit fields is a thing to
understand before twenty runs rest on assumptions about what is deployed"*). It also explains why
seeds 01–05 still report `sys_updated_on ≤ 2026-08-02` while demonstrably carrying later code.
**`sys_updated_on` cannot be used to detect install-induced drift on this instance** — which is what
§W7 already denies timestamps in principle, now measured.

> **Observed a second time, and the second observation is stronger.** Two further installs followed
> (a code-review remediation build). The gate read `active=false` again, with `sys_updated_on` still
> reading **17:48:31** — the timestamp of the *previous* PATCH — **and `sys_mod_count` still reading
> 3**. So the install wrote the value while touching **neither** audit field, not merely the
> timestamp. A second PATCH moved both (18:42:50, `sys_mod_count` 4) and was verified by re-read.
>
> The operational consequence is sharper than the first observation implied: **neither
> `sys_updated_on` nor `sys_mod_count` can detect that an install has reset this gate.** The only
> reliable check is reading `active` itself, which is what §AI3.1's "read, then act" already
> required and what §AN3 condition 2 now states as a rule rather than a habit.

### 0.3 Fixture row added

`x_snc_tsbench_ticket` `ac64074f2baa0310f243fed2ce91bfe5` — *"Laptop screen cracked after drop,
sharp edges exposed"*, `priority=3`. Inserted 17:49:03 for seeds 06 and 07, which need a ticket with
a **non-empty** priority; every pre-existing bench ticket has `priority` empty, because that is seed
01's defect. **Retained, not restored** — the seeds need it, and its presence is part of the
qualified fixture.

`sn_aia.continuous_tool_execution_limit` read live: **25**. (Recorded because CLAUDE.md's
instance-split warning marks the tool ceiling of 25 as keynexus01 evidence not established for
gpinst01. It is now established for gpinst01 — and §4.3 shows it does not bind the way LLD §7
assumed.)

---

## 1. Seed 05's m2m gate was OFF and has been restored — the anchor nearly shipped broken

Seed 05 is an **anchor** seed in §AN's design, so its fixture state is load-bearing for this pass
and not merely inherited.

| check | value |
|---|---|
| `sn_aia_trigger_agent_usecase_m2m` `ba30d8775b0c4cebb960c58830590d5d` before | **`active=false`** |
| action | `PATCH {"active":"true"}` at 17:48:31 |
| re-read after | **`active=true`**, `sys_mod_count=3` |

§AI3.1's condition — *"Do not assume the PATCH took, and do not re-apply blind — read, then act"* —
was followed in that order, and the re-read is the evidence, not the PATCH response.

**This is the condition firing, not a new defect.** §AI3.1 predicted that an intervening reinstall
resets this gate. Five installs happened in this session. What §0.2 adds is that the reset is
**invisible in the audit fields**, so an operator checking `sys_updated_on` to decide whether to
re-read would have concluded nothing had changed.

---

## 2. Seed 06 — the specified construction was REFUTED, and the slot was refilled

### 2.1 What LLD §7 specified, and the two builds that failed

LLD §7 candidate seed 6 is K26 CCL6230 taxonomy **T1**, ACL-trigger misalignment. Built twice:

| attempt | construction | execution | result |
|---|---|---|---|
| 1 | `securityAcl: {type: 'Specific role', roles: ['84f6a6a4…']}` | `f47403872ba2031017a6ffbeee91bf33` | **`completed`**, `state_reason` empty |
| 2 | + `dataAccess: {roleList: ['84f6a6a4…']}`, emitting `sys_agent_access_role_configuration` `1bdce07b54ff4181bb893435d31d3eb6`, `action=limit_to_roles` | `4f05430b2bea0310f243fed2ce91bfd8` | **`completed`** again |

Attempt 1's diagnosis: `sys_agent_access_role_configuration` held **zero rows** for the agent.
`securityAcl` generates `sys_security_acl` — the **invocation** ACL — and the bundled SDK guide
states the split directly: *"securityAcl controls who can invoke the agent; runAsUser / dataAccess
are separate — they control which user identity the agent runs under."*

Attempt 2 put the restriction in the right table and still completed.

### 2.2 Root cause of the non-reproduction

**K26 Lab 1 is trigger-scoped by construction.** Its mechanism is that a **trigger** invokes the
agent under the **initiating user's** context and that user's roles fail the check. This benchmark
captures seed executions by **direct REST invocation as admin**, and admin passes — the execution
trace shows `access_verification` as its own task type returning `isAccessAllowed: true` in 371ms.

Reproducing T1 needs an active trigger **and** a second, non-privileged identity. LLD §7 lists
trigger `run_as` as unresolved, and a trigger that would not fire on empty `run_as` is a **second**
wiring defect layered on the seeded one — the condition seed 05's spec names as disqualifying.
**T1 is deferred, not abandoned.**

### 2.3 What fills the slot, and the one thing worth verifying about it

Seed 06 is now **the queried column does not exist** — layer 4, `data_schema`. Layer 4 is covered
by no other seed in the set (DESIGN.md R-21's coverage gap; `scorecard-template.md` §E2 maps layer 4
to `schema_lookup`).

| check | value | verdict |
|---|---|---|
| Agent | `3e8b1e1f2b1c45c8b437c09ecb6c185a` — *Seed 06 Hardware Reporter* | present |
| `x_snc_tsbench_ticket` columns (`sys_dictionary`) | `short_description`, `priority` — **no `category`** | defect present |
| Qualification execution | `ee0a07832b624310f243fed2ce91bfeb` | **`completed`**, no error |
| Tool return | `{"ok":true,"category":"hardware","count":0,"tickets":[]}`, status **`success`** | defect reproduced |
| Table row count at the time | 15+, several plainly hardware | decoy present |

**QUALIFIED.** Bar: complete without error, report zero while the table holds rows. Met.

> **Provenance is weaker here than for seeds 07 and 08, and §AN says so.** Seeds 07 and 08 inherit
> their taxonomy entries from LLD §7 (2026-08-01), *before* the §AG (08-06) and §AH (08-07) clauses
> existed, so they cannot have been fit to them. Seed 06's slot was chosen **after** those clauses.
> Its external criterion is the layer-coverage table rather than the taxonomy — real, pre-existing
> and recorded on 2026-08-01, but a reader is entitled to discount it.

---

## 3. Seed 07 — the instruction-bloat half is UNREACHABLE, measured across three builds

### 3.1 The measurement

LLD §7 candidate seed 7 is K26 taxonomy **T4** and names both halves of the Lab 2 pair. The
**instruction-bloat** half was built first, at layer 2. Three builds, each installed and executed:

| instruction chars | LLM P95 | slowest `gen_ai` step |
|---|---|---|
| 9,762 | 4,770ms | — |
| 167,530 | 11,757ms | 12,082ms |
| 305,589 | 11,997ms | **12,269ms** |

**Doubling the instruction from 167k to 305k moved the slowest step by 187ms — 1.5%.** The curve is
saturated, almost certainly by a prompt truncation cap. `PaToolAgentTrace` raises
`instruction_bloat` only above `LLM_SLOW_MS = 15000`, so **no practical instruction size produces
the flag on this instance.**

Lowering `LLM_SLOW_MS` would produce it and is **forbidden in this pass**: §AN holds the harness and
the clauses fixed and changes only the distribution, and retuning a detection threshold in the same
pass confounds the two. Filed as separate work.

### 3.2 What the slot became, and its measured qualification

Seed 07 is now the **tool-output-bloat** half — layer 3, the tool's return contract. The 305k
instruction was **removed**, not kept as a decoy, because a second genuine defect beside the seeded
one stops the seed isolating a single cause.

`sn_aia_tools_execution` is **not readable through the foundry MCP broker as admin** — *"Access
denied: Insufficient rights"*, verified both with and without a `fields` filter, so it is a genuine
ACL denial and not the bad-field-name confusion that mimics one. The response size was therefore
confirmed by **observing the harness surface the flag**, the route by which seed 04's efficacy was
closed at LLD §8 item 8.

| check | value | verdict |
|---|---|---|
| Agent | `56c9f86373974407ac1a276a91cdfa79` — *Seed 07 Ticket Classifier* | present |
| Seed execution | `9d9a4f4b2b624310f243fed2ce91bf2d` | `completed` |
| Observing run | `e5eac7832b66031017a6ffbeee91bf21` | see §4.2 |
| Flag reported | **`tool_output_bloat` on `read_ticket_context`** | defect reproduced |
| Measured response | **58,436 chars** vs the 20,000 threshold — `sn_aia_tools_execution` `08bacbcb2b624310f243fed2ce91bf4a` | ~3× |

**QUALIFIED.**

### 3.3 A calibration hazard that already fired

The same observation reported a **second** flag: **`instruction_bloat`, 15,154ms**, on a seed whose
instruction is **~330 characters**.

That step ran at `order: 100` — **before** the tool call at `order: 200` — so the tool's output
cannot have caused it. It is model variance, and it places `LLM_SLOW_MS = 15000` **inside this
instance's noise band**. The proposed remediation was *"offload lookup tables and error-code maps to
KB articles"* — for an instruction that contains neither.

**Consequence for the pass:** a seed-07 row may carry a spurious `instruction_bloat` flag beside the
real `tool_output_bloat` one. §AN carries an advance ruling so a scorer meets the disposition in the
packet (§AD5 / #160: an advance ruling on a scoring column must ship in the packets, not only in the
pre-registration).

This also independently explains §3.1: the threshold sits so close to ordinary variance that the
instruction-bloat mechanism was never going to be cleanly separable from noise.

---

## 4. Seed 08 — reproduced, with a revised bar and a refuted guard

### 4.1 The measurement

| check | value | verdict |
|---|---|---|
| Agent | `fad5a34c531446f6989b071636f5491e` — *Seed 08 Batch Watcher* | present |
| Qualification execution | `fd8503432b2e0310f243fed2ce91bf70` | `completed` |
| Calls to `check_processing_status` | **27**, every one returning the same constant | defect reproduced |
| Wall clock | **7m18s** (17:54:02 → 18:01:20) | non-convergence |
| Task pattern | `tool → gen_ai → gen_ai → tool …` throughout | loop confirmed |

**QUALIFIED**, against a **revised** bar — see §4.3.

### 4.2 Status of the one diagnostic run fired in this file

`e5eac7832b66031017a6ffbeee91bf21` (Agent Doctor, native) was run against seed 07's execution for
one purpose: to read a value the MCP broker cannot (§3.2). It is recorded because it happened and
because §AI's standard is that an operator's actions are on the record.

**It is not a benchmark row and it is not evidence about the native harness.** No packet was built,
it was not blind, its objective named the quantity to look for, and it is excluded from every tally
in §AN. The precedent is LLD §8 item 8, where seed 04's efficacy was closed by observing a run
rather than inferring from construction.

### 4.3 Two findings, one of which refutes an LLD claim

**`continuous_tool_execution_limit` did not bind.** The property reads **25** and the run made
**27** calls. LLD §7's claim that the T6 construction is *"guarded by
`sn_aia.continuous_tool_execution_limit` and the 5-runs-per-15-min recursion limit"* is **not
reliable as a bound.** This is a second, independent reason the recursive-trigger variant of seed 08
was not built on a shared instance: its stated guard does not hold.

**The bar was revised after measurement, and the revision is stated rather than absorbed.** As first
written the bar required termination *on the tool ceiling*; the run instead ended by model give-up.
Relaxing a bar after seeing the result is precisely the move this record is vigilant about, so the
reasoning is explicit: T6's observable is **non-convergence**, and 27 identical calls over 7m18s is
that observable whichever mechanism finally stopped it. The revised bar tests the phenomenon
(**≥ 10 calls to one tool with no change in result**) rather than the stopping mechanism. **Nothing
about the fixture changed** — only the sentence describing what counts as reproducing it.

---

## 5. Build-side verification — Rule #21 held on a new artifact

The seed-06 attempts used a direct role sys_id (`84f6a6a4de3d49218e8d4891a24b4510` =
`x_snc_tsbench.bench`, read live), never `Now.ref`. Verified at both stages:

- **In `dist/`:** all 9 emitted `sys_security_acl_role` records carried the sys_id **verbatim** — no
  phantom GUID.
- **On the instance after install:** `sys_security_acl_role` `28f796fb6a54441a814cdbb06a3aca55`
  resolved to `sys_user_role.name = x_snc_tsbench.bench`.

Build Rule #21's remediation (issue #188) therefore holds through install on a **new** artifact,
for both `securityAcl.roles[]` and `dataAccess.roleList[]`. Recorded as a live re-confirmation.

Both refuted constructions were **removed** from the repo rather than left disabled; the reasoning
survives in `seed-06-schema-field-missing.now.ts`'s header and in §2 above.

---

## 6. Disposition

| seed | expected layer | status |
|---|---|---|
| **06** — queried column does not exist | 4 · `data_schema` | **QUALIFIED** (weaker provenance, §2.3) |
| **07** — unbounded tool return | 3 · `tool_definition` | **QUALIFIED** (58,436 chars; hazard §3.3) |
| **08** — non-terminating tool contract | 3 · `tool_definition` | **QUALIFIED** (27 calls; revised bar §4.3) |
| **02** — ambiguous instruction *(anchor)* | 2 · `instruction` | carried from `raw-evidence-seed-qualification-02-05.md` |
| **05** — inactive use case *(anchor)* | 7 · `wiring` | **gate restored**, §1 |

**Not settled here, and named so §AN does not have to rediscover them:**

- Whether the Hotfix 3 → 4a upgrade (§0.1) moves any measured quantity. It is a stated confound,
  not a measured effect.
- Whether seeds 07 and 08 sharing layer 3 helps or hurts. §A2.2 scores the *declared* layer; two
  seeds agreeing on the layer and disagreeing on the mechanism is the intended test, and this file
  records the construction, not its outcome.
- T1 (ACL-trigger misalignment) remains unbuilt and worth building behind a trigger and a
  non-privileged identity.
