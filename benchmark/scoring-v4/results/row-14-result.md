# Row 14 — Scoring Result

**Seed:** 04 (GenAI capability not mapped to a provider) · **Harness:** custom (`x_snc_troubleshoot`) · **Run:** 1
**Expected root-cause layer:** `genai_stack` (layer 6) · **Expected fix target:** capability mapping (repoint `api`)

---

## Treatment of the rejected-draft status

This run terminated `status: "failed"` — the harness's own post-generation
validation gate rejected the `fix_report` twice and no accepted report exists.
Per the task instructions, this is **not** an automatic zero and is **not**
excused either: the rejected draft in `fix_report_rejected.report` is the
complete record of what this run produced, and it is scored on its merits
exactly as if it were the submitted answer. The validation error itself is
also treated as evidence about the report's content (it documents a real
internal contradiction in the draft — see `root_cause_layer_correct` below),
not as a reason to discount the run further. No extra penalty was applied for
"failed" status beyond what the draft's actual content earns under each
column.

---

## Column scores

### `root_cause_layer_correct` = **0** (of 0/2)

The draft's structured `root_causes[0]` entry sets `"layer": "1"`, not `"6"`.
Its `confidence` is `"UNCONFIRMED"` and `"would_confirm": "6"` — i.e., the
draft explicitly states that layer 6 (`genai_stack`) is an *unconfirmed
hypothesis it would still need to check*, not its stated finding. The
harness's own validator caught the same thing: *"would_confirm names layer 6,
which layers_swept marks SWEPT — a layer you already swept cannot also be the
evidence you still need."*

Per the task's instruction to trust the audit-trail measurement over the
report's self-description, the measured `layers_swept` for this run is
**1/7 (L1 only)** — layers 6's tools (`genai_log`, `log_analysis`) were never
invoked (tool calls were `agent_trace`, `read_artifact` only). So the draft's
claim to have swept layer 6 is false, and its formal root-cause layer
assignment is "1," with layer 6 flagged as an open, ungathered hypothesis
rather than an asserted conclusion. The draft never actually commits to
`genai_stack` as the answer — it guesses at it in prose (`failure_summary`
mentions "the tool's capability or configuration") while formally landing the
root cause at layer 1 and marking the layer-6 connection unconfirmed. This
does not meet "names the seed's expected root-cause layer."

### `fix_target_correct` = **0** (of 0/1/2)

The fix's own `target_type` field is `"tool schema"` — one of the rubric's
listed categories, and the wrong one; the correct category is capability
mapping. The `proposed` text — *"Verify the capability's api, api_type, and
connection fields are correctly configured"* — does not isolate `api` (the
seeded defect) from `connection` (the seed's explicit decoy, expected to be
empty and normal); it lists all three undifferentiated, with no diagnosis of
which field is actually broken or what the correct value should be. This is
generic "go check these fields" language, not a named fix target, and it does
not rise to the "right area without the specific target" partial-credit band
because it does not even identify the right *category* (it labels itself
tool-schema-shaped) or narrow the area to the actual defect.

### `evidence_cites_trace_and_config` = **0** (of 0/1)

The `evidence` array for `root_causes[0]` contains exactly two entries, both
`"source": "trace"`. No config/schema source (e.g., the capability
definition's `api`/`api_type`/`connection` field values, or any
`sys_one_extend_capability_definition` record content) is cited anywhere in
the draft. The rubric requires **both** trace and config/schema evidence;
only trace is present.

### `fix_usable_unedited` = **0** (of 0/1)

Per the rubric's explicit constraint, this cannot be 1 while
`fix_target_correct` is 0 — and independently, "verify the fields are
correctly configured" is an instruction to investigate further, not an
applicable edit a builder AI could execute verbatim (no concrete target value
is proposed, unlike the seed's expected fix, which names the healthy `api`
value `936e514a53b3b110f028ddeeff7b128c`).

---

## Total and gate

| Column | Score |
|---|---|
| `root_cause_layer_correct` | 0 / 2 |
| `fix_target_correct` | 0 / 2 |
| `evidence_cites_trace_and_config` | 0 / 1 |
| `fix_usable_unedited` | 0 / 1 |
| **Total** | **0 / 6** |

`passes_gate = (root_cause_layer_correct == 2) AND (fix_usable_unedited == 1)`
→ **0 (fail)**

## Notes

- This run is not void: the packet's "Observed" callout confirms the
  installed capability sys_id (`92ff62af516741769c437feb88c80ef3`) matched
  the tool script, so the seed was in the state its spec requires.
- This is not a clean "decoy hit" in the sense the seed spec describes (a
  report whose *root cause* is asserted to be "no connection bound"). The
  draft's root cause is not confidently asserted as anything at layer 6 at
  all — it is UNCONFIRMED at layer 1 with layer 6 as an unexamined
  hypothesis — while its fix language loosely name-drops `connection`
  alongside `api` without distinguishing decoy from defect. That vagueness,
  not a mistaken confident claim, is what drove the 0s here.
- The validation-gate rejection is itself informative: it shows the draft
  tried to claim more sweep coverage and more confidence than its own tool
  calls support, which is consistent with (and corroborated by) the
  independently measured `layers_swept = 1/7`.
