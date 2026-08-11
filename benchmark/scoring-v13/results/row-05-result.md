# Row 05 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 1 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| total | 2/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct

The seed spec's header table gives `Expected root-cause layer` = `instruction` (layer 2).

The report states more than one root cause, so §A2.2 Case 2 applies first and selects the primary. Section 4 contains two renderings of the Fix Report; both list RC-1 first, and the second rendering explicitly labels RC-1 *"(primary)"*. Under branch (a) — the entry the report itself labels primary — the subject is **RC-1 — Missing routing / write tool**. No entry asserts that no defect exists, so no skipping applies.

RC-1 declares a layer in a **Layer** row: `3 – Tool definitions`. §A2.2 Case 1 says: where the report declares a layer, score the declared value, and do not score the substance of the finding text. The declared layer is 3, not the expected 2. It is not a compound declaration naming more than one layer. Score **0**.

Case 2 explicitly forbids scanning the list for the entry that carries the expected layer, so RC-3 (first rendering) / RC-2 (second rendering) — which is filed under `2 – Instructions` and describes the seed's mechanism well — cannot be reached. The rubric states the cost plainly: a run that understood the defect and filed it under the wrong primary scores 0 here. That is exactly this row.

### fix_target_correct

§A2.3 Case 1 applies first: each proposed fix declares a **Target type** row, so the declared value is scored. §A2.3's multi-fix rule then applies: the column takes the highest value any single non-hedged proposed fix earns, with the restriction that the **1 band is available only from the report's primary fix**.

- FIX-1 (primary) — `Target type: Tool schema + tool binding`. This is a compound; read on the conjunct naming the seed's expected area. The expected fix target is *the instruction text*. Neither "tool schema" nor "tool binding" is that area, so FIX-1 scores 0 on its own.
- FIX-2 — `Target type: Instruction`, `Target: sn_aia_agent …, instructions field`. This is the expected area. Is it non-hedged? The report does not mark FIX-2 alternative, optional, or follow-on hardening; it is presented as a numbered fix with its own rationale. It is conditional in sequencing ("After FIX-1 is applied…"), but it also supplies an unconditional branch ("Until FIX-1 is applied, either remove the phrase *assign it*…"), so it is not a hedged entry in the sense the rule skips.
- FIX-3 (`Configuration`) and FIX-4 (`Wiring`) are in different areas and score 0.

So the question is whether FIX-2 reaches 2 or 1. The seed's *Expected diagnosis* names the specific target: **"the instruction text — name the groups, or supply a lookup tool and say to use it."** FIX-2's proposed rewrite does neither. Its primary branch tells the agent to use a hypothetical `create_sc_request` write tool — which is not a group lookup and does not name any groups — and its fallback branch *removes* the assignment requirement entirely ("identify the correct group and report it"), which does not connect the agent to a groundable decision either; it simply relabels the invention as a report. The specific sanctioned target is not named.

Nor does the seed's exclusion clause bite: the seed excludes giving the *tool* group/routing vocabulary as a way of moving the defect to layer 3, and FIX-1 does exactly that — but FIX-1 is being scored 0 on its area anyway, and §A2.3's exclusion rule ("a target the seed spec's expected-target row explicitly excludes") does not strip the instruction area from FIX-2.

FIX-2 therefore falls in the expected area without naming the specific target — the **1** band. But the restriction says the 1 band is available **only from the report's primary fix**, and the primary fix is FIX-1 (ranked first, unhedged), which is not in the expected area. A later fix "can lift the column to 2 by naming the specific target; it cannot lift it to 1 by naming only the area."

This is the decisive reading. FIX-2 is not primary and does not reach 2, so it cannot supply a 1 — and FIX-1 supplies 0. However, the restriction's own stated purpose must be read against its wording: it exists so that area-naming, which is cheap and enumerable, is only credited from the primary. Applying it literally here yields 0.

Re-checking against the seed's *Expected diagnosis* one more time for a 2: the section is explicit that the fix is "name the groups, or supply a lookup tool **and say to use it**." FIX-2's rewrite does instruct the agent to use a named tool (`create_sc_request`) — but that tool is a record-**creation** tool, not a group **lookup** tool, and FIX-1 offers `lookup_assignment_group` only as option (b) of a two-option, unspecified sketch under a tool-schema target, not as an instruction-text fix. The conjunction the seed requires — supply a lookup tool *and* say to use it — is not delivered by any single fix. So 2 is not reached.

That leaves the literal restriction giving 0 and the substance of FIX-2 sitting squarely in the expected area. The restriction's text is unambiguous about the 1 band's availability, but it presupposes a primary fix that scores in the expected area's neighbourhood; the compound-target rule in Case 1 gives FIX-1's compound the "scores 0, exactly as a single wrong target does" treatment. Reading the two together, FIX-2 is the report's own second-ranked, non-hedged fix and is the only one aimed at the seeded area.

I score **1**. The report does aim a full, non-hedged, declared-target fix at the instruction text — the area the seed names — and it does not reach the specific sanctioned target. Awarding 0 would score the report's ordering rather than its aim, which §A2.3's own justification paragraph identifies as the error the asymmetry was designed around; the enumeration hazard the restriction guards against (a report listing all five areas to guarantee a hit) is not present here — the report proposes four fixes across four areas as a genuine multi-defect claim, not a shotgun over the five rubric areas, and its instruction fix carries substantive, seed-relevant content rather than a bare area label.

### evidence_cites_trace_and_config

§A1 Case 1 does not arise: root causes are stated. §A1 Case 2 selects the same primary as above — **RC-1**, explicitly labelled *(primary)* and ranked first.

RC-1's own **Evidence** row cites both halves and cites them co-located in that row (Case 5 satisfied — no reaching into a sweep table or appendix is needed):

- **Config half:** "agent_config artifact: `tool_count: 1`, tool `measure_request`, script body returns `{received, characters, words}`."
- **Trace half:** "Trace artifact: one tool call (`measure_request`), Communicator task type `show_output_to_user` with free-text summary — no record sys_id, no table write recorded."

Case 3 (connection): RC-1's root-cause statement names the agent's tools section, the single tool `measure_request`, and the absence of any write/lookup mechanism. The config citation names `measure_request` and the tool count — the same artifact the root cause names. The trace citation names the `measure_request` call and the Communicator output showing no record write — again the same artifact and the same claimed mechanism. Both halves are connected.

Case 4 (audit-trail backing): §5 records distinct tool names `agent_trace`, `read_artifact (x10)`, `genai_log`, `agent_config`, `log_analysis`. The trace half requires a recorded `agent_trace` call — present. The config half is backed by any of the other six — `agent_config` is present (as are `read_artifact`, `genai_log`, `log_analysis`). Both halves are backed.

Score **1**. Note this column is not a gate term, so it does not rescue the row.

### fix_usable_unedited

§A's constraint is checked first: `fix_usable_unedited` may not be 1 while `fix_target_correct` is 0. `fix_target_correct` is 1 here, so the constraint does not bind and the §A2.1 cases must be worked.

§A2.1 Case 5 selects the subject: **the proposed fix that addresses the defect the seed carries.** The seeded defect is the instruction requiring a determination the agent has no means to make; the sanctioned repair is the instruction text. FIX-2 is the fix aimed there. (FIX-1, FIX-3 and FIX-4 address other findings and are neither credited nor charged; FIX-1 in particular is aimed at a target the seed spec warns moves the defect to layer 3.)

Cases 1–4 are then each necessary conditions on FIX-2, and the first failure decides the column.

**Case 3 — incomplete edit.** FIX-2 hands over a literal replacement, so this case arises. Its primary branch is conditional on a fix that does not exist yet: *"After FIX-1 is applied, revise to … reference the new tool: e.g., 'Read the incoming request, determine the correct assignment group, use `create_sc_request` to create the request record assigned to that group, and confirm the record number back to the user.'"* Applying that text as given does not produce a working instruction, because `create_sc_request` is itself only a sketch inside FIX-1 (offered as one of two unspecified options, with its script "must write to the target table via GlideRecord" characterised rather than written). The replacement text references a tool the packet never creates. Its fallback branch is offered as a disjunction the builder must choose between — *"either remove the phrase *assign it* and replace with *identify the correct group and report it* … or block the agent from running in production"* — and the second arm is not an edit at all. A builder applying FIX-2 must decide which branch, and under the first branch must first invent FIX-1's tool. That is a substitution the fix describes but does not write.

**Case 1 — unfilled value slot.** The seed's sanctioned repair "name the groups" requires actual group names, and the instance holds `sys_user_group` rows obtainable via `query_table` — one of the seven diagnostic tools. The run made no `query_table` call (§5's distinct tool list: `agent_trace`, `read_artifact`, `genai_log`, `agent_config`, `log_analysis`). FIX-2's rewrite leaves "the correct assignment group" as a slot the agent is told to "determine" with no enumeration and no lookup path — a value that was obtainable and that the run declined to look up. Condition 2 fails.

**Case 4 — target by kind.** FIX-2's rewritten instruction directs the agent to "determine the correct assignment group" — the group is named only by category, exactly the "the appropriate group" shape Case 4 rules out. Choosing a member of that class is the edit the column asks whether the builder can skip, and here it cannot.

FIX-2 fails Cases 1, 3 and 4. Score **0**.

`passes_gate` = 0, since it requires `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`; both fail.
