# Row 01 — blind score

**Packet:** `benchmark/scoring-v9/row-01-native-seed-01-run-1.md`
**Seed:** 01 (tool schema mismatch) · **Arm:** native (Agent Doctor) · **Run:** 1
**Scored:** 2026-08-05, from the packet only. No other file read; no shell, search or web access used.

---

## 0. Void check (§A3) — first, because it gates everything

§A3 lists exactly two known void conditions, both belonging to other seeds
(seed 5's trigger m2m gate; seed 4's capability sys_id mismatch). Neither applies
to seed 01.

The general rule is "the seed was not in the state its spec requires." The seed
spec requires (a) an installed fixture with an Integer-typed `priority` column,
(b) a bench ticket with `short_description` set and `priority` empty, and (c) an
execution in which the agent passes a priority word. The packet's report
independently confirms all three:

- `schema_lookup` → `type: "Integer"`, `has_choices: false` — matches the spec's
  "measured installed state: plain Integer, no choice list" exactly.
- Tool response `{"ok":true,"priority_requested":"critical","priority_stored":null}`
  — matches the spec's Task 12 measurement (`priority_stored` = `null`) exactly.
- Readback `priority: ""`.

The seed was in the state its spec requires. **void = no.**

(Two irregularities appear in §5 — the MCP call returned before completion, and
the `x_snc_troubleshoot_run` anchor stayed at `status: running`. Neither is a
seed-state condition; both are harness-observation artefacts, and the terminal
state was recovered by polling the plan. §A3 is about the *seed's* state, not the
observation path, so these do not void the run. The diagnostic run's own terminal
state was `completed` with an empty `state_reason` and a Fix Report was produced,
so there is no "run produced nothing" case either.)

---

## 1. `root_cause_layer_correct` — **2**

Expected value: `tool_schema` (layer 3).

The seed's own §"Scoring note — layers 3 and 4 (M18)" is directly on point and
removes the discretion I would otherwise have had:

- layer 3 scores full marks;
- **"a run answering 'layer 4 — the column is Integer-typed and the tool sends a
  word' also scores full marks"**;
- a run naming only one side *without the disagreement* scores 0.

RC-1 in this report is headed "Integer field rejects string priority value" and
its **Layer** cell reads **"4 — Data schema + 3 — Tool definition"**. It names
both sides and, critically, names the disagreement: "The `priority` column is
typed **Integer** … The tool script calls `gr.setValue('priority',
inputs.priority)` where `inputs.priority` is the string `"critical"`."

That is the mismatch, stated as a mismatch, with both halves. It satisfies the
scoring note's full-marks case twice over (it names layer 3 explicitly *and*
gives the layer-4-side framing the note blesses). The disqualifying case — one
half with no mention of what is written to it — plainly does not apply.

The report also carries the spec's own mechanism verbatim ("GlideRecord silently
discards the non-numeric string; `update()` still returns success"), and the
closing summary labels RC-1 **PRIMARY**, so the correct cause is not buried among
the other three RCs.

The word "choice" is absent from the diagnosis and the report affirmatively
reports `has_choices: false`. The scoring note instructs that this must **not**
be penalised. Score stands.

**→ 2.**

---

## 2. `fix_target_correct` — **2**

Expected fix target, from both the header table and §"Expected diagnosis":
**the tool's word-typed contract** — *map the word to its integer inside the
script*, **or** change the tool description + agent instructions to pass 1–5.
The spec also states an explicit anti-target: "constrain the input schema to
1–5" must **not** be the standard, since Fluent script-tool inputs have no `type`
property.

Fix 1 is titled "Map priority words to integers in the tool script", targets
`sn_aia_tool` field `script`, quotes the current line
`gr.setValue('priority', inputs.priority);`, and supplies a
`PRIORITY_MAP = { critical:1, high:2, moderate:3, low:4, planning:5 }` applied
before `setValue`. That is the first of the two accepted targets, stated
literally.

Three things I checked before awarding full marks rather than partial:

1. **Is the anti-target present?** Fix 2 does touch the tool input schema
   (`mandatory: false` → `true`), which is schema-adjacent. But it is not the
   forbidden fix: it does not attempt to constrain priority to 1–5, it is
   presented as addressing a *separate* root cause (RC-2), and Fix 1 — not Fix 2
   — is the one bound to RC-1. The anti-target is not what this run proposes for
   the real defect.
2. **Does Fix 1-alt (change the column to String/choice) contaminate the
   answer?** It is explicitly labelled "*(alternative)*" and subordinated:
   "Choose Fix 1 (script mapping) if other scripts depend on the Integer
   column." The rubric scores whether the diagnosis *names the correct fix
   target*; it does. Offering a documented alternative alongside the correct
   primary is not the same as proposing the wrong one, and the rubric contains no
   penalty for additional proposals. I considered docking to 1 on the theory that
   two competing fixes leave the builder to choose — but the report ranks them,
   and the mapping order in Fix 1's rationale ("The Integer column stores 1–5")
   is correct, so no deduction.
3. **Is the mapping direction right?** critical→1 … planning→5 matches the
   platform convention the seed's column mirrors (`task.priority`). It is not an
   inverted or invented scale.

Partial credit (1) is reserved by §A for the right *area* without the specific
target, and the packet notes it must be justified in notes if used outside seed
5. It is not needed here: the specific target is named.

**→ 2.**

---

## 3. `evidence_cites_trace_and_config` — **1**

The column requires the **root cause** to cite BOTH the execution trace AND at
least one config/schema source.

RC-1's Evidence cell cites four items, tagged by layer:

- *Trace side:* the tool response `{"ok":true,"priority_requested":"critical",
  "priority_stored":null}` "from tool-call record **(layer 1)**".
- *Config/schema side:* `schema_lookup x_snc_tsbench_ticket.priority` →
  `type: "Integer"`, `has_choices: false` **(layer 4)**; and the tool script body
  `gr.setValue('priority', inputs.priority)` — "no word-to-integer mapping"
  **(layer 3)**.
- Plus corroboration from layer 5 (`query_table` → `priority: ""`).

Both required sides are present within the root cause itself, not merely
elsewhere in the report. Independently, the audit-trail measurements in §4 show
`agent_trace` (call 1) and `schema_lookup` (call 18) were both actually executed,
so the citations are backed by tool calls rather than asserted — the §4 numbers
are derived from `x_snc_troubleshoot_audit` and "never inferred from the report's
own prose", which is exactly the corroboration needed to rule out fabricated
evidence.

The seed's "Evidence a correct diagnosis should cite" line asks for precisely
this pair: `priority_stored` disagreeing with `priority_requested` in the trace,
plus the dictionary entry showing integer typing. Both are cited.

**→ 1.**

---

## 4. `fix_usable_unedited` — **1**

Constraint check first: §A forbids 1 while `fix_target_correct` = 0. Here
`fix_target_correct` = 2, so the constraint is not engaged, and the §A2
decoy-hole reasoning (a well-formed fix aimed at the wrong target is a no-op)
does not bite — this fix is aimed at the target the seed actually carries.

Applicability as written:

- The patch is a complete, self-contained code block: build the map, look up
  `(inputs.priority || '').toLowerCase()`, early-return a structured error on an
  unrecognised word, then `gr.setValue('priority', priorityInt)`.
- Insertion point is unambiguous — the report quotes the exact current line it
  replaces.
- It uses only variables the surrounding script already has (`gr`, `inputs`, and
  `check` in the second snippet, which the run read in full at layer 3), so a
  builder does not have to invent context.
- It is defensive in the right direction: an unmapped word now fails loudly
  instead of silently, which is the actual failure mode under test.

Two blemishes I weighed and did not treat as blocking:

- `priority_stored_word: inputs.priority` in the second snippet just echoes the
  requested word rather than reading anything back, so it is a slightly
  misleading field name. It is cosmetic; it does not stop the fix working and is
  in the optional readback block, not the fix proper.
- The **Target** is named as the platform record `sn_aia_tool`, field `script`,
  rather than the Fluent source that generates it. A builder AI working from
  Fluent would place the same code in the Fluent script template. The rubric asks
  whether the *proposed fix* could be applied without manual editing, and the
  substance — the code and its insertion point — transfers unchanged; naming the
  runtime record is an addressing convention, not an edit to the fix. I record
  this as the one judgment call in the row.

The code fences around the two snippets render as bare `javascript` lines in the
packet rather than fenced blocks. Per the packet's own disclosure the redaction
was mechanical and touched paths only, so this is a transcription artefact of the
packet, not a defect in the run — and §1 tells me not to treat packet mechanics
as run defects. Scored on content.

**→ 1.**

---

## 5. Total and gate

| Column | Score |
|---|---|
| `root_cause_layer_correct` | 2 |
| `fix_target_correct` | 2 |
| `evidence_cites_trace_and_config` | 1 |
| `fix_usable_unedited` | 1 |
| **Total** | **6 / 6** |

`passes_gate`, computed from §A2's expression verbatim:

```
passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1
            = 1 iff 2 == 2 AND 1 == 1
            = 1
```

**`passes_gate` = yes (1).** The other two columns are diagnostic detail and are
correctly excluded from the expression; they happen to be full marks here, so the
exclusion changes nothing for this row.

---

## 6. Ambiguity flag — **no**

The rubric determined every column for this row without my having to invent a
rule:

- The layer-3-vs-4 straddle, which would otherwise have been the row's hard call,
  is pre-resolved by the seed's M18 scoring note, including the instruction not
  to require the word "choice".
- The anti-target ("constrain the input schema to 1–5") is stated explicitly, so
  Fix 2's schema touch was decidable rather than a coin-flip.
- The gate expression is given as a formula and I applied it as written.
- §A3's void conditions are enumerated and neither is seed 01's.

The single genuine judgment call — Fix 1 addressing the runtime `sn_aia_tool`
record rather than the Fluent source — I resolved **in the run's favour**,
because the rubric's test is whether the fix is applicable without manual
editing, the code itself needs none, and the seed spec's own phrasing of the
expected target ("map the word to its integer inside the script") is
source-agnostic. I flag it here rather than smoothing it over; a scorer who read
"applied by the builder AI" as strictly requiring a Fluent-file target could
argue for 0 on that column, which would flip `passes_gate` to no. I do not think
that reading survives the seed spec's wording, but it is the one place this row
could reasonably be scored differently.

Noise not penalised (no rubric hook exists for it, and §"Judge on evidence"
forbids scoring presentation): RC-2, RC-3 and RC-4 are incidental findings —
non-mandatory inputs, absent trigger wiring, and instruction bloat — none of
which is the seeded defect. RC-3 in particular describes a normal state for an
interactively-invoked seed agent and is dressed as a "CONFIRMED root cause",
which is decoy-adjacent behaviour. But RC-1 is correctly identified as PRIMARY,
Fix 1 is bound to it, and the rubric has no precision column. The run is not
credited for them either.
