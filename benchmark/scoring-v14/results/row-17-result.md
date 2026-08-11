# Row 17 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 2 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| total | 5/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct

The seed spec's header row prints `Expected root-cause layer` = `tool_definition` (layer 3).

The report states three root causes, so §A2.2 Case 2 applies first: evaluate the column against the primary — the entry the report itself labels primary. RC-1 is explicitly headed "(PRIMARY)", and it asserts a defect (it is not a no-defect entry), so it is the subject. RC-2 (layer 2) and RC-3 are secondaries and are neither credited nor charged; I did not scan the list for a matching layer.

§A2.2 Case 1 then governs: RC-1 declares a layer — **"Layer: 3 — Tool definitions"**. The declared value is scored, and it matches the seed's expected layer 3. Score **2**.

Two things I deliberately did not do, per the clause text. I did not score the substance of the finding text (it happens to be accurate — the constant `in_progress` return with no terminal branch — but that would not have changed the value either way). And I did not treat the §3 advance ruling as adverse here: the ruling scores 0 for a *layer-2 (instruction)* reading, and RC-1's declared layer is 3, with the layer-2 reading confined to the secondary RC-2, which Case 2 excludes from this column.

### fix_target_correct

Per §A2.3 Case 2 I read both places in the seed spec. The `Expected fix target` header row gives the area — the **tool's output contract** (i.e. the tool-schema/tool-definition area, and it explicitly excludes the instruction: "**Not** the instruction — see Decoys"). The *Expected diagnosis* section names the specific target: "Fix target: the tool's output contract", `check_processing_status` being unable to report completion.

The report proposes three fixes, so the column takes the highest value any single non-hedged fix earns:

- **FIX-1** — declared `Target type: Tool script`, `Target: sn_aia_tool, sys_id 96d2f732dda847868688307d4c5cd375, field script`. §A2.3 Case 1: the declared target is scored, and the body agrees with it (it rewrites that script). The declared target is the tool's script/return contract, and the rationale states the point explicitly — "Eliminates the constant return value. Once the script reads a real record, the tool can return `complete` or `failed`, which allows the agent's terminal check to fire." That is the specific target the *Expected diagnosis* section names, in that section's own terms (the tool's output contract / ability to report a terminal status). → **2**.
- **FIX-2** — declared `Target type: Instruction`. This is the reading the seed spec explicitly rules out ("Not the instruction"; the Decoys section makes it a 0), so it earns 0 and cannot lift the column.
- **FIX-3** — declared `Target type: Configuration`, on `sn_aia_agent_tool_m2m.max_auto_executions`; a different area, and marked CONDITIONAL. 0.

Highest single value = **2**. FIX-1 is also the report's primary fix, so no restriction on the 1 band is engaged.

### evidence_cites_trace_and_config

§A1 Case 1 does not arise (root causes are stated). Case 2 selects the subject: RC-1, the labelled primary. The column is then evaluated on RC-1's own **Evidence** block alone.

RC-1's evidence lists exactly two items:

1. *"agent_config artifact, tool script body: `return JSON.stringify({ ok: true, batch: ref, status: 'in_progress', ... })`"* — a **config/schema** source.
2. *"Every one of the 75 tool-call output digests in **agent_trace** confirms identical output …"* — the **trace** half.

Case 3 (connection): RC-1's root-cause statement names `sn_aia_tool`, sys_id `96d2f732dda847868688307d4c5cd375`, field `script`, and the constant tool output. The config citation names that same script body; the trace citation names that same tool's call outputs. Both citations name artifacts the root-cause statement names.

Case 4 (audit-trail backing): section 5 records distinct tool names `agent_trace`, `agent_config`, `genai_log (x2)`, `log_analysis`, `read_artifact (x9)`. The trace half is backed by a recorded `agent_trace` call; the config half is backed by a recorded `agent_config` call, which is one of the enumerated six. Both families are present. No validator rejection is carried in this packet.

Case 5 (co-location): both citations sit inside RC-1's own Evidence list, not in the failure summary or the layers-swept table.

Conjunction satisfied → **1**.

### fix_usable_unedited

§A's constraint does not bind (`fix_target_correct` = 2), so §A2.1's cases apply.

§A2.1 Case 5 selects the subject: the proposed fix that addresses the defect the seed carries. That is **FIX-1** alone — FIX-2 addresses the instruction (the seed's decoy, not the seeded defect) and FIX-3 addresses a binding cap. Cases 1–4 are then each necessary conditions on FIX-1.

FIX-1 fails **Case 3** (the fix names the operation but the edit is incomplete). FIX-1 hands over a code snippet as its `Proposed value`, and the snippet does not perform the change the fix describes when applied exactly as given:

- The fix's own prose concedes it: *"Replace with a script that queries the actual batch-tracking record (**the appropriate table and query must be determined by the builder; the script below is illustrative**)"*.
- The snippet contains five unwritten substitutions the fix *describes* rather than *writes*: `new GlideRecord('<your_batch_table>')`, `gr.addQuery('<batch_ref_field>', ref)`, `gr.getValue('<status_field>')`, `<pct_field>`, `<note_field>` — plus the inline requirement that the status field "must include 'complete' or 'failed' as terminal values", which is a characterisation, not a value.

Applying that text verbatim installs a script containing literal `<your_batch_table>` placeholders, which does not produce the described change. Case 3's stated failure shape — "a 'replace this call' whose replacement is characterised rather than given" — is exactly this. Case 3's own note is decisive on the boundary: this is a missing **edit**, not merely a missing value, so it is not rescued by any reading of Case 1, and it is a necessary condition that the fix fails regardless of the other cases. Per §A2.1's combination rule, the first case that fails decides the column.

Note also that the fix does not take the seed's alternative route ("or bound the poll inside the script"), which would have required no external table; it commits to reading a record it never identifies.

Score **0**.

### passes_gate

`passes_gate = 1` iff `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`.
Here: 2 AND 0 → **0**. The run scores 5/6 and still fails the gate, which §A2 states plainly is not an inconsistency — the gate asks the narrower question.

### ambiguity

**Not ambiguous.** Every column was determined by the packet's own material without weighing:

- `root_cause_layer_correct` — the report labels a primary root cause and declares its layer explicitly ("Layer: 3"); §A2.2 Cases 2 then 1 apply mechanically against the seed spec's printed expected layer.
- `fix_target_correct` — each fix carries an explicit `Target type` / `Target` row, and the seed spec prints both the area (header row, with an explicit exclusion of the instruction) and the specific target (Expected diagnosis section).
- `evidence_cites_trace_and_config` — RC-1's evidence block names both halves, both name artifacts the root-cause statement names, and section 5's distinct-tool list backs both families by enumeration.
- `fix_usable_unedited` — the fix text itself states that the table and query "must be determined by the builder" and labels its snippet "illustrative", with five literal placeholder tokens; Case 3 resolves it without judgement.

The judgement that took most care was FIX-1 under §A2.1, but effort is not under-determination: the packet contains the sentence that decides it.
