# Row 07 — scorer verdict

| column | value |
|---|---|
| root_cause_layer_correct | 0 |
| fix_target_correct | 2 |
| evidence_cites_trace_and_config | 1 |
| fix_usable_unedited | 0 |
| total | 3/6 |
| passes_gate | 0 |
| ambiguous | no |

## Reasoning

### root_cause_layer_correct
The seed spec's header table prints `Expected root-cause layer` = `instruction` (layer 2).

The report states four root causes, so §A2.2 Case 2 applies first: evaluate the column against the report's primary. RC-1 is explicitly labelled *"(primary cause)"* and is also first in the list, and it does not assert that no defect exists, so RC-1 is the subject. §A2.2 Case 2 expressly forbids scanning the list for the entry that carries the expected layer — RC-2 declares `Layer: 2 — Instructions`, but reaching into it is exactly the scan-the-list reading the case rules out.

§A2.2 Case 1 then governs RC-1: it declares a layer in a **Layer** row — `3 — Tool definitions`. Where a layer is declared, the declared value is scored, not the substance of the finding text. The declared value is a single layer (3), not a compound naming layer 2 among conjuncts. 3 ≠ 2, so the column scores **0**.

Note the seed spec anticipates precisely this miss: "A finding that `measure_request` is irrelevant to routing is supporting evidence, not the root cause." RC-1 is that finding, promoted to primary.

### fix_target_correct
Per §A2.3 Case 2, both the seed's `Expected fix target` header row ("the instruction text") and the *Expected diagnosis* section must be read. The *Expected diagnosis* names the specific target: "the instruction text — name the groups, or supply a lookup tool and say to use it."

The report proposes four fixes. Per §A2.3, the column takes the highest value any single non-hedged proposed fix earns, with the restriction that the **1** band is available only from the primary fix. FIX-3 is hedged ("if autonomous routing is required") and FIX-4 is an investigation; neither is relevant here.

FIX-2 declares `Target type: Instruction` and `Target: sn_aia_agent cd050d48e810411d9f113fd530694fe6, field instructions`. Under Case 1 the declared target is scored: this is squarely the "instruction text" area. Its `Proposed` body specifies explicit steps that call a lookup tool and forbid answering from general knowledge — i.e. "supply a lookup tool and say to use it," in the terms the *Expected diagnosis* section itself uses. That is the specific target named by the seed, so FIX-2 earns **2**.

The 2 band is reachable from a non-primary fix per §A2.3's explicit rule ("A later fix can lift the column to 2 by naming the specific target"), so FIX-2 being second does not cap it. Column = **2**.

### evidence_cites_trace_and_config
§A1 Case 2 applies first (four root causes): the subject is the primary, RC-1, which is labelled primary and is first. Cases 3–5 then decide whether RC-1 carries both halves.

RC-1's own **Evidence** row (co-located with the root cause, satisfying Case 5) offers:
- **Config/schema half** — `agent_config` overview (`tool_count: 1`, `active_tool_count: 0`, table `sn_aia_agent_tool_m2m`), and the `sn_aia_agent` `description` field.
- **Trace half** — "Trace Gen AI task `sys_id: 2f63e7b22b2e0bd817a6ffbeee91bfe0` (order 300) output digest."

Case 3: RC-1's root-cause statement is about the agent's tool binding set (`sn_aia_agent cd050d48e810411d9f113fd530694fe6` — tool binding set; "the agent has exactly one tool: `measure_request`"; "the LLM … answered from general knowledge"). The config citation names `sn_aia_agent_tool_m2m` and the agent record — the same artifacts the statement names. The trace citation names the Gen AI task whose output is the fabricated routing answer — the very behaviour the statement asserts. Both are connected.

Case 4: the audit trail records `agent_trace` (backing the trace half) and `agent_config` and `genai_log` (each backing the config/schema half). Both families are recorded.

All of Cases 3–5 are satisfied for the primary. Column = **1**. (Per §A2, this column is not a gate term.)

### fix_usable_unedited
§A's constraint is checked first: `fix_target_correct` is 2, so the constraint does not bind and the §A2.1 cases arise.

§A2.1 Case 5 selects the fix that addresses the defect the seed carries. The seeded defect is the ambiguous instruction; FIX-2 is the fix addressing it. (FIX-1 adds a tool but is declared against "Tool schema + data" and, on the seed's own terms, would move the defect rather than repair the instruction; FIX-2 is the repair.)

Cases 1–4 are then each necessary conditions on FIX-2:

- **Case 2** (runtime-record address): FIX-2 resolves to exactly one record (`sn_aia_agent` `cd050d48e810411d9f113fd530694fe6`) and names exactly one field (`instructions`). Satisfied.
- **Case 3** (incomplete edit) — **this is where FIX-2 fails.** FIX-2 quotes the `Current` instruction text verbatim but its `Proposed` row supplies no replacement string. It *describes* the amended text — "Expand to explicit steps: (1) call `measure_request` …; (2) call `lookup_assignment_group` …; (3) confirm the group name back to the user. **Explicitly prohibit** answering from general knowledge…" — but never writes the instruction text the builder is to install. This is exactly the shape Case 3 scores 0: "an edit whose surrounding context is quoted as current but never returned as amended," and a replacement "characterised rather than given." The `instructions` field takes a literal string; the builder must compose that string itself.
- **Case 1** compounds it: step (2) directs the agent to call `lookup_assignment_group`, a tool that does not exist and is only created by FIX-1 (which itself names the routing table only by kind — "`sys_user_group` (or the appropriate catalog/routing table)"). The prescribed instruction text therefore references an unbuilt dependency by a name FIX-1 offers as an example ("e.g., `lookup_assignment_group`").

Per §A2.1's combination rule, the first case that fails decides the column and passing Case 2 does not lift Case 3's bar. Column = **0**.

`passes_gate` = 0, since it requires `root_cause_layer_correct == 2` AND `fix_usable_unedited == 1`, and both fail.
