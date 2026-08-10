# Row 03 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 1 |
| total | 6/6 |
| passes_gate | 1 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct

The seed spec names `tool_schema` (layer 3) as the expected layer, and its M18 scoring
note explicitly extends full marks to a run that answers from the layer-4 side —
"the column is Integer-typed and the tool sends a word" — because the finding is the
*disagreement*, not either half. It withholds credit only from a run that names one
side without the mismatch.

The report's ROOT CAUSE 1 is labelled "Layer: 3 (Tool definition) + 4 (Data schema) +
5 (Data)" and states the mismatch in both directions: the tool script passes the word
`"critical"` to `gr.setValue('priority', …)` while the column is declared Integer, so
GlideRecord silently discards the string and `gr.update()` still reports success. That
is the seed's mechanism stated as a disagreement between the tool contract and the
column type, with the integer typing — the load-bearing half per the spec — correctly
identified, including the measured `has_choices = false`. Naming layer 3 first and
layer 4 alongside it lands inside the expected answer under either reading the note
permits. **2.**

### fix_target_correct

Expected target: the tool's **word-typed contract** — map the word to its integer
inside the script, or change the tool description plus agent instructions to pass 1–5.
The spec explicitly rules out "constrain the input schema to 1–5" as the standard.

FIX 1 is titled "Map priority word to Integer in the tool script", targets
`sn_aia_tool[8953483c2762479b97bf55da8ed1c4ac]` field `script`, and inserts
`PRIORITY_MAP = { critical: 1, high: 2, moderate: 3, low: 4, planning: 5 }` with the
lookup applied before `setValue`. That is the first of the two sanctioned fixes,
verbatim in intent and in mechanism.

FIX 2 does touch the tool `input_schema`, but only to flip `mandatory` flags — it is
not the ruled-out "constrain the schema to 1–5" fix, it is presented as a complement
rather than as the remedy for Root Cause 1, and the spec's exclusion is about what a
run must not be *scored against*, not a penalty for extra hardening. The primary fix
names the specific expected target, not merely the right area, so the partial band
does not apply. **2.**

### evidence_cites_trace_and_config

Root Cause 1's evidence block carries both required kinds:

- **Trace:** `sn_aia_tools_execution[378a19fe…].response` — `priority_stored: null`,
  attributed to the `agent_trace` artifact at offset 4000. This is exactly the
  citation the seed spec asks for (the trace showing `priority_stored` disagreeing
  with `priority_requested`).
- **Config / schema:** `sys_dictionary[x_snc_tsbench_ticket.priority]` —
  `type = Integer`, `has_choices = false`, from the `schema_lookup` result; plus the
  tool's own `sn_aia_tool.script` body from the `agent_config` artifact.

Both a trace source and at least one config/schema source are present, cited with
record identifiers and the tool that produced them. The §4 audit trail independently
confirms `agent_trace`, `agent_config`, `schema_lookup` and `query_table` were all
actually called, so the citations are not decorative. **1.**

### fix_usable_unedited

The §A constraint is checked first and does not bind: `fix_target_correct` = 2, so
`fix_usable_unedited` is free to be 1.

FIX 1 supplies a complete replacement script as a self-invoking IIFE
(`(function (inputs) { … })(inputs);`), with the word→integer map, defensive
lowercase/trim normalisation, a guard returning `{ok: false, error: …}` on an
unrecognised word, the record fetch, the `setValue`/`update`, and a read-back that
reports `priority_stored`. No value slot is left unfilled — the five mapped integers
are derivable from the tool's own documented word list, so §A2.1 Case 1 does not
arise. It addresses the defect the seed actually carries (a word written to an
Integer column), not a decoy.

§A2.1 Case 2 **does** apply: the fix addresses a runtime record rather than Fluent
source. It resolves to exactly one record (`sn_aia_tool` sys_id
`8953483c2762479b97bf55da8ed1c4ac`) and names the single field it changes (`script`),
with the full new value given. Under Case 2 that scores 1; translating that unique
address back to its Fluent source is explicitly not counted as an edit. **1.**

### passes_gate

`passes_gate = 1` iff `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`.
Both gate terms hold (2 and 1), so **passes_gate = 1**. `fix_target_correct` and
`evidence_cites_trace_and_config` are recorded as diagnostic detail and do not enter
the expression.

### ambiguity

`ambiguous: no`. Each column was determined by the packet:

- **root_cause_layer_correct** — the M18 scoring note pre-resolves the layer 3 / 4
  straddle, and the report states the mismatch (not one half alone), so only one value
  is defensible.
- **fix_target_correct** — the report's primary fix is one of the two remedies the
  seed spec names verbatim; there is no reading on which it is merely "the right area
  without the specific target", and FIX 2's schema touch is a mandatory-flag change
  rather than the ruled-out schema-constraint fix.
- **evidence_cites_trace_and_config** — both source kinds are named explicitly with
  the producing tool; presence is a fact on the page, not a judgement.
- **fix_usable_unedited** — the §A constraint is inapplicable, Case 1 is inapplicable
  (no missing value), and Case 2 is satisfied unambiguously by a single record plus a
  single named field. The only cosmetic wrinkle is that the packet's reproduction of
  the code block shows a bare `javascript` line without fence markers, which is a
  transcription artefact of the packet rather than a defect in the fix; the script
  body itself is complete and syntactically closed, so it does not create a second
  defensible reading.
