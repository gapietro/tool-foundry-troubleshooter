# Scorecard — v14, the out-of-sample pass (build `5fb7648`, #175)

**Pre-registration:** `DECISION.md` §AN, merged in `0c4f36c` before any run of this pass fired.
**Raw evidence:** `raw-evidence-v14-out-of-sample.md`. **Rows:** `v14-rows.json`.
**Reports verbatim:** `v14-reports/`. **Packets exactly as scored:** `scoring-v14/`.
**Verdicts:** `scoring-v14/results/`. **Flag tally:** `v14-ambiguity-flags.json`.

**Build under test:** commit `5fb7648` — **the same commit v13 ran**, verified by probe rather than
version string. The harness is held constant across v13 → v14.

> **Read these three before quoting any figure below.**
>
> 1. **§AN1a — this pass is NOT single-variable against v13.** The instance was upgraded between the
>    two passes: Zurich Patch 10 Hotfix 3 → **Hotfix 4a**, ~2h22m after v13's last row. v13 is
>    entirely a Hotfix 3 measurement and v14 entirely a Hotfix 4a one. The anchor arm is a control,
>    not a correction.
> 2. **The scorer instruction changed, and the operator changed it.** See §3.2. Both differences push
>    toward fewer ambiguity flags. This weakens the headline determinacy comparison to v13
>    specifically, and it is the operator's error, not a property of the distribution.
> 3. **§AC8/§AI8 — determinacy is not correctness.** §5 records the sharpest live instance this
>    project has produced.

---

## 1. The twenty rows

| row | arm | seed/rep | RCL | FTC | EV | FUU | total | gate | ambiguous |
|---|---|---|---|---|---|---|---|---|---|
| 01 | native | 02/1 | 0 | 2 | 1 | 1 | 4/6 | 0 | no |
| 02 | custom | 02/1 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 03 | native | 02/2 | 0 | 0 | 1 | 0 | 1/6 | 0 | no |
| 04 | custom | 02/2 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 05 | native | 05/1 | 2 | 2 | 0 | 1 | 5/6 | **1** | no |
| 06 | custom | 05/1 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 07 | native | 05/2 | 2 | 2 | 1 | 1 | **6/6** | **1** | no |
| 08 | custom | 05/2 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 09 | native | 06/1 | 2 | 2 | 1 | 1 | **6/6** | **1** | no |
| 10 | custom | 06/1 | 0 | 0 | 1 | 0 | 1/6 | 0 | no |
| 11 | native | 06/2 | 2 | 2 | 0 | 1 | 5/6 | **1** | no |
| 12 | custom | 06/2 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 13 | native | 07/1 | 0 | 2 | 0 | 1 | 3/6 | 0 | no |
| 14 | custom | 07/1 | 0 | 1 | 1 | 0 | 2/6 | 0 | no |
| 15 | native | 07/2 | 2 | 2 | 0 | 1 | 5/6 | **1** | no |
| 16 | custom | 07/2 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 17 | native | 08/1 | 2 | 2 | 1 | 0 | 5/6 | 0 | no |
| 18 | custom | 08/1 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |
| 19 | native | 08/2 | 2 | 2 | 1 | 0 | 5/6 | 0 | no |
| 20 | custom | 08/2 | 0 | 0 | 0 | 0 | 0/6 | 0 | no |

RCL = `root_cause_layer_correct`, FTC = `fix_target_correct`, EV =
`evidence_cites_trace_and_config`, FUU = `fix_usable_unedited`.

**Valid rows: 10 per arm, 0 void.** No row was voided and none was re-run. Row 01 was proposed for
voiding mid-pass on a starvation diagnosis and the proposal was **withdrawn on measurement** — see
`raw-evidence-v14-out-of-sample.md` §2.6.

**The partition, fixed in advance by §AN2 and not redrawn:**

- **Out-of-sample (the primary outcome):** rows 09–20 — seeds 06, 07, 08. **Twelve rows.**
- **Strongly out-of-sample:** rows 13–20 — seeds 07 and 08, whose taxonomy entries were selected
  2026-08-01, five days before §AG existed. **Eight rows.**
- **Anchor (the drift control):** rows 01–08 — seeds 02 and 05. **Eight rows.**

---

## 2. The gate, both arms together

§AD7 requires these two figures to be quoted together and never singly.

| arm | valid rows | passes_gate | points |
|---|---|---|---|
| native (Agent Doctor) | 10, 0 void | **5 / 10 — 50.0%** | 45 / 60 |
| custom (`x_snc_troubleshoot`) | 10, 0 void | **0 / 10 — 0.0%** | 3 / 60 |

**Ruling 3's milestone is NOT met.** It requires the custom arm at `sum(passes_gate) / valid runs ≥
80%`. The custom arm is at 0.0%.

**Ruling 6 governs what may be said about these figures: published, applied, unpredicted.** §AN5
filed **no prediction on `passes_gate` in either direction**, and recorded that withholding as a row
of its own so it would be visible rather than inferred. **This pass may not claim a confirmed or
refuted prediction about the milestone.**

**The three-pass series, quoted in full because dropping a row inverts the direction:**

| pass | native | custom | patch level |
|---|---|---|---|
| v12 (§AD) | 6/10 — 60.0% (51/60) | 0/10 — 0.0% (9/60) | — |
| v13 (§AJ) | 4/10 — 40.0% (47/60) | 0/10 — 0.0% (5/60) | ZP10 Hotfix 3 |
| **v14** | **5/10 — 50.0% (45/60)** | **0/10 — 0.0% (3/60)** | ZP10 Hotfix 4a |

**`3/10 = 30.0%, 42/60` is v4's native figure (§O2) and is NOT a v12 baseline** — quoting it as one
inverts the direction of change, which shipped once in v13's first draft and was caught only in
review.

Native's 50.0% sits between v12's 60.0% and v13's 40.0%, on a **different seed distribution and a
different platform patch**. Nothing in this pass licenses reading that as movement in the harness.
Its point total (45/60) is the lowest of the three even though its gate count is not.

---

## 3. The determinacy outcome — Ruling 4, the primary result

### 3.1 The figures

**Twenty of twenty rows returned `ambiguous = no`, and the column-flag tally is zero.**

| quantity | v12 | v13 | **v14** |
|---|---|---|---|
| rows `ambiguous = no` | 8/20 | 20/20 | **20/20** |
| column flags | 14 | 0 | **0** |

Against the pre-registered partition:

| prediction | bar | measured | verdict |
|---|---|---|---|
| **AN-1a** | ≥ 10 of the 12 out-of-sample rows `ambiguous = no` | **12 / 12** | **CONFIRMED** |
| **AN-1b** | ≥ 7 of the 8 strongly out-of-sample rows | **8 / 8** | **CONFIRMED** |
| **AN-2** | ≤ 0.20 column flags per out-of-sample row (≤ 2 at n=12) | **0 — 0.00 per row** | **CONFIRMED** |
| **AN-3** | all 8 anchor rows `ambiguous = no` | **8 / 8** | **CONFIRMED** |

AN-3 is the drift control and it is clean, so this pass has no evidence that the platform patch or
the model moved the determinacy result. **§AN8's limit stands: eight anchor rows cannot resolve a
small patch effect, and a clean anchor is equally consistent with "the patch changed nothing" and
with "the patch changed something these two seeds do not exercise."**

AN-1a and AN-1b agree exactly, so **seed 06's weaker provenance made no difference to the outcome**
— the discount §AN3 invited a reader to apply changes nothing.

### 3.2 The scorer instruction changed, and that weakens this section

**This is the operator's error and it is disclosed here rather than in a footnote, because it bears
directly on the headline.** §AN7 fixed the scorer *topology* — independent agents, one per packet,
redacted packets — and that was held. The scorer *instruction* was not part of what §AN7 pinned, and
it differs from v13's in two ways, **both introduced by this operator and both pushing toward fewer
flags**:

1. **v13's instruction required an `### ambiguity` section if and only if the flag was `yes`.** That
   is precisely why scorecard-v13 §3 could cite **two independent agreeing signals**. v14's asked
   every verdict for the section, so **that independence does not exist this pass** — all twenty
   emitted one, and the header table is the only signal.
2. **v14's instruction added: *"do not flag `ambiguous` merely because a judgement was effortful."***
   v13's carried no such clause — and scorecard-v13 §3.1 records two v13 verdicts that made close
   calls **without** flagging and treats that as a **limitation** of the v13 result. v14's prompt
   explicitly licensed the behaviour v13 recorded as a caveat.

**Row 19's verdict shows the clause operating.** Its ambiguity section states the
`fix_usable_unedited` judgement "took work", walks the two competing rubric cases, and then declines
to flag it: *"Effortful is not the same as under-determined, and I have not flagged it as such."*
That is a defensible reading — it is also the reading the prompt supplied.

**What this does and does not cost.** It does **not** touch AN-1a/AN-1b/AN-3 as *absolute* measures:
twelve of twelve out-of-sample rows were determinate under a stated instruction, and that is a real
measurement of the clauses on a distribution they were not fit to. It **does** weaken the
**comparison to v13**, which is the frame §AJ6 and #175 set up. A like-for-like determinacy
comparison across v13 → v14 is **not available from this pass**, and any future quotation that puts
v13's 20/20 and v14's 20/20 side by side without this subsection is a misquotation.

**Remedy for the next pass, recorded so it is not re-derived:** pin the scorer instruction verbatim
in the pre-registration, in the same way §AN7 pins topology, and diff it against the prior pass's
before dispatch.

---

## 4. The two tripwires — both REFUTED

§AN5 filed these as *shape* predictions and stated in advance that **neither counts toward the
section's claim to have filed meaningful predictions**. Both were refuted, and refutation here is
informative rather than damaging.

| prediction | bar | measured | verdict |
|---|---|---|---|
| **AN-4** | ≥ 1 row files a primary root cause at **layer 2** on seed 08 — *the decoy bites* | **0 of 4 seed-08 rows** | **REFUTED** |
| **AN-5** | ≥ 1 seed-07 row's report names an `instruction_bloat` flag | **0 of 4 seed-07 rows** | **REFUTED** |

**AN-4 — the decoy did not bite, and Ruling 8 was never needed.** Ruling 8 pre-ruled that "the agent
has no completion criteria" (layer 2) scores 0 on seed 08. No row filed it. Both native rows (17,
19) filed **layer 3 primary** — the tool script is a hardcoded constant with no terminal branch —
and each explicitly demoted the instruction gap to *contributing*, in RC-2, having noticed the
instruction has no polling cap. Rows 18 and 20 filed layer 1. **The ruling cost nothing and was
never exercised.**

**AN-5 — the flag never appeared, so Ruling 7 was never exercised either.** Ruling 7 exists because
qualification saw `instruction_bloat` fire at 15,154ms against a 15,000ms threshold on a ~330-char
instruction. **No seed-07 report names it.** Both native seed-07 rows (13, 15) name
`tool_output_bloat` instead — three mentions each — at **58,471** and **58,462** chars against the
20,000 threshold. The seeded flag was found and the artefact flag was not.

**This is worth more than the prediction it refutes.** Ruling 7 was written to stop a scorer charging
a run for an instrument artefact, and its premise — that the 15,000ms threshold sits inside this
instance's ordinary variance — was *strengthened* by this pass rather than weakened: measured native
LLM P95 across the ten native rows ran 4,090 / 8,616 / 13,741 / 15,486 / 17,628 / 27,318 / 30,626 /
30,707 / 69,942 / 97,065 ms, so **six of ten native runs sat at or above the threshold**. The flag
did not surface in any seed-07 report anyway. Ruling 7 remains correct and unexercised; do not read
its non-use as evidence it was unnecessary.

**AN-6 — the operational prediction — CONFIRMED.** ≤ 2 voids encountered and every arm finishing
with 10 valid rows. **Zero voids were encountered** and both arms have 10 rows.

**Tally: four meaningful predictions filed, four confirmed; two tripwires filed, two refuted.**
§AJ6's warning applies with full force and is why the count is stated plainly: a pass that confirms
everything it predicted has not thereby shown its predictions were discriminating. AN-1a's bar was
deliberately AI-1's, and §AI8 called clearing it "the MINIMUM the clauses must clear."

---

## 5. Determinacy is not correctness — the sharpest live instance this project has produced

§AC8 and §AI8 have said since v12 that a determinate rubric is not a correct one. **v14 supplies a
row where the two come apart completely, and it is the pass's most useful finding.**

**Row 09 (native, seed 06) scored 6/6, cleared the gate, and was not flagged ambiguous. Its proposed
fix cannot work.**

The report correctly finds that `count_by_category` filters on a `category` column that does not
exist — the seeded layer-4 defect, correctly identified. It then proposes:

> `gr.addQuery('type', category);` — "The `type` column carries values `hardware`, `software`"

and states that `schema_lookup` returned `type` (String, max 40) as present and that `query_table`
confirmed those values on it.

**There is no `type` column on `x_snc_tsbench_ticket`.** Operator re-read of `sys_dictionary` during
the pass: 8 fields, whose only non-system members are `short_description` and `priority`. **The
packet's own seed specification says the same thing in its opening paragraph.** The refuting fact was
in front of the scorer and the verdict did not use it.

Two neighbouring rows show the same shape:

- **Row 11 (native, seed 06)** files a co-primary RC-2 asserting the table is "genuinely empty
  (0 rows, confirmed by unfiltered count)" and proposes **"seed the table"** — the exact fix target
  seed 06's spec says scores 0. `x_snc_tsbench_ticket` held **22 rows** at that moment (COUNT
  aggregate). Row 11 scored 5/6 and cleared the gate.
- **Row 13 (native, seed 07)** lists the table's 8 columns as including `u_caller`, `u_description`,
  `u_impact`, `u_resolution`, `u_ticket_number`. None exist. It got the field *count* right.

**Left deliberately unresolved, and it is the first thing the next pass should settle.** Row 11
attributes its empty-table claim to `query_table` itself returning `unfiltered_row_count: 0` and
`verdict: genuinely_empty`. If the **tool** returned that against a 22-row table, this is a harness
defect and not a model fabrication — and a mechanism exists: `query_table` runs in scope
`x_snc_troubleshoot` while the bench table is owned by `x_snc_tsbench`, and Build Rule #42 records
that a Fluent `Table()` installs with zero ACLs. **This was not investigated mid-pass (§T9 freezes
`src/`), and the two readings have opposite consequences** — one is a model that invents, the other
is a diagnostic tool that reports absence where there is a permission barrier, which is the precise
failure mode `unfiltered_row_count` exists to prevent.

**No score was changed on account of any of this**, and none should be: the manifest was frozen at
dispatch, and re-scoring after seeing results is optional stopping at the most result-sensitive
moment there is (§U8.5). These are recorded as operator observations in `v14-rows.json`
`operator_note`, a field that renders into no packet.

**The transferable statement:** the rubric measures whether a report *names the right layer, targets
the right thing, cites its evidence, and reads as usable*. It does not measure whether the report's
factual claims are true. A run can satisfy all four and still ship a fix that fails on contact —
and on this pass one did, at full marks.

---

## 6. What this pass establishes, and what it does not

**Establishes:**

- The §AG/§AH clause set returned a determinate value on **twelve rows drawn from three seeds it was
  not fit to**, eight of which have provenance predating the clauses by five days. That is the check
  §AJ6 said v13 could not perform and #175 was filed to run.
- The out-of-sample and strongly-out-of-sample figures agree exactly, so seed 06's weaker provenance
  did not carry the result.
- The anchor arm is clean, so nothing in the pass points at platform or model drift as the driver.

**Does not establish:**

- **A like-for-like determinacy comparison with v13** — §3.2, the operator's scorer-instruction
  change.
- **That the rubric is determinate in general.** Zero flags is a measurement under one instruction,
  one scorer topology, one day.
- **That the reports are correct.** §5 — a 6/6 gate-passing row proposed a fix at a column that does
  not exist.
- **Anything about `passes_gate` by prediction.** Ruling 6; no prediction was filed.
- **Single-variable status against v13.** §AN1a — the platform patch moved underneath.
- **That v13's custom-arm off-fixture rows became assessable.** §AJ5a and §AL6 stand.

**§T8 is carried verbatim and unamended.** Twenty rows, five seeds, one instance, one day, one model,
one app version, and now two platform patch levels across the comparison. **Not a rate.**
