# Scorecard — v9 scored pass (`2026.08.0505`, #119, filled 2026-08-06)

Both harnesses, seeds 01 / 03 / 04, two reps each, **same day, same instance, same app version**.
Twelve scored rows. Raw measurements and every scorer's reasoning:
`benchmark/raw-evidence-v9-scored-pass.md`. Decision-record entry: `DECISION.md` §T.

Rubric, gate expression and void rule are `benchmark/scorecard-template.md` §A / §A2 / §A3, applied
as written and **not restated here** — the template is the single source, and a second copy is a
second thing to drift. The four §B columns, the §C operational columns and the §E derivation rules
are likewise the template's.

---

## 0. How this scorecard deviates from the template's shape, and why

The template's blank scorecard is **10 rows — 2 runs × 5 seeds, one harness**. This pass is
**12 rows — 2 runs × 3 seeds × 2 harnesses**. Three consequences, all stated rather than absorbed:

1. **Seeds 02 and 05 are absent.** Out of scope since §Q6; seed 05 remains untested live.
2. **`arm` is an added column.** The template has no notion of two harnesses in one scorecard
   because the Task 12 instrument scored one.
3. **Each arm has 6 valid runs, and §A3.4 sets the gate's evaluability floor at 8.** See §3.

Nothing else deviates. The rubric columns, the §A2 expression, the §A3 void rule and the §E1–E3
derivation were applied unmodified.

---

## 1. The scorecard

`run_id` for native rows is the new `sn_aia_execution_plan` sys_id; for custom rows it is the
`x_snc_troubleshoot_run` sys_id. `passes_gate` is computed by §A2's expression, **not** from
`total /6`.

| arm | seed | run # | run_id | `root_cause_layer_correct` | `fix_target_correct` | `evidence_cites_trace_and_config` | `fix_usable_unedited` | total /6 | **passes_gate** | layers_swept (n/7, which) | layers_available | cause_of_death | `continuous_tool_execution_limit` | `max_auto_executions` | tool_calls | assists_consumed | wall_clock | failure_behavior | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| native | 01 | 1 | `961d7d9d2baa475817a6ffbeee91bf2a` | 2 | 2 | 1 | 1 | 6 | **1** | 7/7 (L1–L7) *mech.* | 7/7 (L1–L7) | completed | *not read* | 10 (all 7 tools) | 18 | *not read* | 5m25s | graceful_partial | Names the layer-3/4 mismatch on both sides per the seed's M18 note. Fix = word→integer map in the tool script. `ambiguous = no`, with a recorded gate-flipping judgment call on `fix_usable_unedited` (§5 of the evidence file) |
| native | 01 | 2 | `853ffd1d2bea475817a6ffbeee91bf0b` | 2 | 2 | 1 | 1 | 6 | **1** | 7/7 (L1–L7) *mech.* | 7/7 (L1–L7) | completed | *not read* | 10 | 17 | *not read* | 4m17s | graceful_partial | Same shape as run 1. `ambiguous = no`, same recorded judgment call |
| native | 03 | 1 | `74010e192b2e475817a6ffbeee91bfda` | 2 | 2 | 1 | 1 | 6 | **1** | 7/7 (L1–L7) *mech.* | 7/7 (L1–L7) | completed | *not read* | 10 | 13 | *not read* | 2m47s | graceful_partial | RC-1 PRIMARY layer 5, `verdict: genuinely_empty` — passes the empty-vs-ACL-denied discrimination test. **`ambiguous = yes`**, two; one is gate-material |
| native | 03 | 2 | `a6c2061d2b2acf54f243fed2ce91bf34` | 2 | 2 | 1 | 1 | 6 | **1** | 7/7 (L1–L7) *mech.* | 7/7 (L1–L7) | completed | *not read* | 10 | 16 | *not read* | 3m37s | graceful_partial | **`ambiguous = yes`**, three; the scorer records one as "gate-material … should be resolved in the spec text" |
| native | 04 | 1 | `e064ce952b6acf54f243fed2ce91bf28` | 2 | 2 | 1 | 1 | 6 | **1** | 7/7 (L1–L7) *mech.* | 7/7 (L1–L7) | completed | *not read* | 10 | 14 | *not read* | 5m38s | graceful_partial | Decoy **not taken** — `connection` absent from root causes and fixes. **`ambiguous = yes`**, one, gate-flipping |
| native | 04 | 2 | `aa06c65d2bae475817a6ffbeee91bf71` | 2 | 2 | 1 | 1 | 6 | **1** | 7/7 (L1–L7) *mech.* | 7/7 (L1–L7) | completed | *not read* | 10 | 17 | *not read* | 4m21s | graceful_partial | Decoy not taken. **`ambiguous = yes`**, one, gate-flipping (replacement sys_id given as a description + discovery procedure) |
| custom | 01 | 1 | `c5e7421d2baacf54f243fed2ce91bfc0` | 0 | 0 | 1 | 0 | 1 | **0** | 5/7 (L1,L2,L3,L4,L7) *mech., §E2 qualifier unresolved* | 7/7 (L1–L7) | *no enum value fits* — terminal `failed` on validator rejection | *not read* | 10 | 3 | *not read* | 24s | graceful_partial | Root cause filed at layer **4** on `sn_tsbench_bench_ticket`, **a table that does not exist**. `fix_report` null; scored from `fix_report_rejected.report`. **`ambiguous = yes`**, no gate impact |
| custom | 01 | 2 | `1d988e1d2bee475817a6ffbeee91bf4f` | 0 | 1 | 1 | 0 | 2 | **0** | 2/7 (L1,L4) *mech.* | 7/7 (L1–L7) | *no enum value fits* — terminal `failed` on validator rejection | *not read* | 10 | 3 | *not read* | 22s | graceful_partial | Rejected on **three unsupported citations**. Root cause at layer 1; three further "root causes" are the run's own unswept layers. **`ambiguous = yes`**, no gate impact |
| custom | 03 | 1 | `522986d12beacf54f243fed2ce91bfa7` | 0 | 1 | 0 | 0 | 1 | **0** | 2/7 (L1,L4) *mech.* | 7/7 (L1–L7) | completed | *not read* | 10 | 2 | *not read* | 19s | graceful_partial | Layer 1, `UNCONFIRMED`, `would_confirm` names layer 5 — the seed's layer. `query_table` attached, active, never called. **`ambiguous = yes`**, no gate impact |
| custom | 03 | 2 | `4cb98e952b22875817a6ffbeee91bfa1` | 0 | 2 | 0 | 1 | 3 | **0** | 2/7 (L1,L4) *mech.* | 7/7 (L1–L7) | completed | *not read* | 10 | 2 | *not read* | 20s | graceful_partial | Highest custom total. `target_type: "data"` is exactly the expected fix target, but the cause is still filed at layer 1 and both evidence entries are `source: "trace"`. **`ambiguous = yes`**, no gate impact |
| custom | 04 | 1 | `a53a02592beacf54f243fed2ce91bf65` | 0 | 1 | 0 | 0 | 1 | **0** | 2/7 (L1,L4) *mech.* | 7/7 (L1–L7) | completed | *not read* | 10 | 3 | *not read* | 19s | graceful_partial | Layer 1, `UNCONFIRMED`, `would_confirm` names layer 6. Half-bite on the decoy — `connection` carried alongside `api` at equal weight. **`ambiguous = yes`**, no gate impact |
| custom | 04 | 2 | `deba8a1d2b22875817a6ffbeee91bfbb` | 0 | 0 | 1 | 0 | 1 | **0** | 2/7 (L1,L4) *mech.* | 7/7 (L1–L7) | completed | *not read* | 10 | 3 | *not read* | 26s | graceful_partial | Layer 1; layer 6 declared `NOT_SWEPT` by the run itself. `ambiguous = no` |

### Column notes that the table cannot carry

- **`layers_swept` is the mechanical §E2 map on every row.** §E2's qualifier — `agent_config` earns
  L2/L3/L7 only for the layers the diagnosis actually used — was handed to the scorers and **no
  scorer resolved it**; all twelve treated sweep as a non-rubric column. Row 07's single
  `agent_config` call passed `section: "tools"` only, which is the exact shape §O5 corrected from
  5/7 to 4/7 on two v4 native rows. Read every value here as a mechanical maximum, not an
  adjudicated one.
- **`continuous_tool_execution_limit` was not read during this pass**, which §D requires per run.
  The last published measurement is `25` on gpinst01 (§O1, 2026-08-03). It is recorded as *not
  read* rather than carried forward as if measured. `assists_consumed` was likewise not captured.
- **`cause_of_death` has no enum value for rows 07 and 08.** Both reached a terminal state
  (`failed`) because `PaFixReport.validate` rejected the report after repair attempts — not
  `tool_limit`, `context`, `supervision_stall`, `security`, `wandered` or `genai_down`. Recorded
  as free text; the enum needs a value for validator rejection.
- **`failure_behavior`.** Every row states what it could not confirm rather than acting without
  progress, including the two rejected ones — hence `graceful_partial` throughout. This column
  does not distinguish "honest about a shallow sweep" from "honest about a deep one", and on this
  pass it separates nothing.
- **Native `status` on the run anchor is not authoritative.** All six native anchors
  (TR1000156–161) sat at `status: running` after their executions reached `completed`. Terminal
  state was read from `sn_aia_execution_plan.state` for every native row.

---

## 2. Gate tally

Per §A2, `passes_gate` is `root_cause_layer_correct == 2 AND fix_usable_unedited == 1`, and the
verdict is `sum(passes_gate) / <valid runs>`. Recorded explicitly rather than re-derived from the
/6 totals.

| | native | custom | pass total |
|---|---|---|---|
| Valid runs (not void) | **6 / 6** | **6 / 6** | **12 / 12** |
| Void runs and why | 0 — seed 04's capability sys_id verified matching pre-flight, so §A3's one applicable void condition did not fire | 0 — same | 0 |
| `sum(passes_gate)` | **6** | **0** | 6 |
| Proportion | **6/6 = 100.0%** | **0/6 = 0.0%** | 6/12 = 50.0% |
| Rubric total | **36 / 36** | **9 / 36** | 45 / 72 |

**No Task 12 band verdict is stamped on either arm from this pass.** §A3.4 sets the gate's
evaluability floor at **8 valid runs**; each arm here has 6. That clause is written about voids
eroding a 10-row denominator rather than about a pass deliberately designed with 6 rows per arm,
so a reading that the floor does not apply is available — but the number it names is 8 valid runs,
and taking the permissive reading would mean the instrument's one stated floor never binds
whenever a pass is designed under it. The proportions above are recorded as measured; the band
lookup is not performed. `DECISION.md` §T reads them as a direction.

---

## 3. Measurement caveats for this filled scorecard

1. **The precise totals are not stable, and the gate is less stable than the totals.**
   `fix_usable_unedited` is under-determined in two distinct ways across the native arm, and every
   one of the six native rows records an alternative reading of that column yielding 0. Resolving
   all six adversely gives native **30/36** on totals — direction intact — and **0/6** on the gate,
   because §A2 consumes that column as one of its two terms. Full working:
   `raw-evidence-v9-scored-pass.md` §5.
2. **Custom's 0/6 does not have that sensitivity.** `root_cause_layer_correct = 0` was flagged
   ambiguous on **no** custom row; one scorer listed it explicitly under "Not ambiguous, for the
   record", and another considered and rejected a literal reading that would have awarded 2 for a
   bare layer string.
3. **Nine of twelve rows flagged `ambiguous = yes`** against a pre-registered prediction of at most
   two (T8). On the narrower reading — rows whose `passes_gate` was under-determined — the count is
   four, all native. Both are far from the predicted 10-of-12 unambiguous.
4. **§O5 filed this defect and it was never closed.** That entry found the same column scored
   inconsistently on the same `assignment_group` placeholder text across two v4 native rows and
   left it "for whoever next revises §A". Rows 03, 04, 05 and 06 are that finding recurring.
5. **Twelve rows, three seeds, one instance, one day, one model, one app version.** Two reps per
   seed per arm measures a flip, not a frequency.
6. **Not comparable to any prior pass row-for-row.** Different seed set from §O's v4 pass; §R5
   records how easily a construction change makes a split non-comparable. Nothing in this
   scorecard licenses a claim that either harness improved or regressed against an earlier pass.
