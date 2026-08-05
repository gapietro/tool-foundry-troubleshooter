# v8 — the hold-block item 1 A/B (`2026.08.0503`, #116)

Run 2026-08-05 on gpinst01. Paired A/B on the one line of `_holdBlock` that names what the model
should quote, driven through the `pa llm reason` NASK skill (capability
`0bf0bc13a7414399a1482d21de01231d`) — the same seam `PaLlmProxy._invokeNask` uses. No tool
executed, so **no `x_snc_troubleshoot_audit` rows** were written and the evidence trail a scored
pass reads is uncontaminated (verified: 0 rows in the hour covering the run).

Predictions S5–S7 were filed on issue #116 **before any code was written**.

**Result in one line: the rewording changed nothing, and the item-1 hypothesis is refuted.**

## 1. What was under test

v7 §4 measured the depth gate's hold pushing `schema_lookup` arguments off well-formed JSON onto
bare scalars, two of which dropped the table entirely (`"priority"`, `"assignment_group"` — both
lexically valid table names, so `_normalizeArgs` cannot tell them from a real one). The design's
§5 hypothesis named a mechanism: item 1 read

```
  1. What did the last tool result actually establish? Quote the specific field
     or value you are relying on.
```

which offers a bare **field** name as a legitimate quotable unit, three lines above "Call a tool
that reaches layer N", in a block that renders LAST in the prompt — after `_responseContract()`.
The candidate rewording made the value and its table co-salient:

```
  1. What did the last tool result actually establish? Quote the specific value you
     are relying on, and the table and field it came from.
```

**Control = the deployed item 1. Treatment = the candidate.** Both arms carry the **deployed**
#113/#114 `schema_lookup` contract, so item 1 is the only free variable.

## 2. The instrument

`benchmark/scripts/build-ab-prompts.js --hold` composes both arms, and this time the hold block is
read out of `PaAgentLoop` via `loadScriptInclude` rather than retyped — the v7 hold arms were
composed ad hoc and are **not reproducible from the repo**, which this closes. The script exits
non-zero unless every pair differs only in item 1's two lines, and it now anchors both constants
to ground truth: the deployed text is checked against `_holdBlock`'s real output, and against its
verbatim appearance in `benchmark/raw-evidence-v5-depth-smoke.md`. (The second anchor exists
because a review proved that a silently-wrong "what v6/v7 emitted" constant would still print
`differs ONLY in item 1: true` and exit 0.)

Six paired scenarios, twelve trials, each prompt sent **once**: the model is deterministic at
production temperature (v7 §2), so repeats of one prompt carry the information of one.

The measured rates below are rates *for this instrument*, not estimates of the live rate.

## 3. Every trial

`args` is the model's value verbatim. Every one of the twelve came back as a bare JSON string.

| # | Scenario | Table in evidence? | Arm | `args` returned | Class |
|---|---|---|---|---|---|
| s1 | `sn_aia_tool` / `u_routing_key` | yes | control | `"sn_aia_tool.u_routing_key"` | dotted-correct |
| s1 | | | treatment | `"sn_aia_tool.u_routing_key"` | dotted-correct |
| s2 | `incident` / `priority` | no | control | `"incident.priority"` | dotted-correct |
| s2 | | | treatment | `"incident.priority"` | dotted-correct |
| **s3** | `task` / `assignment_group` | no | control | `"assignment_group"` | **table-omitted** |
| **s3** | | | treatment | `"assignment_group"` | **table-omitted** |
| s4 | `cmdb_ci_server` / `u_owner_group` | yes | control | `"cmdb_ci_server.u_owner_group"` | dotted-correct |
| s4 | | | treatment | `"cmdb_ci_server.u_owner_group"` | dotted-correct |
| s5 | `sc_req_item` / `u_fulfilment_stage` | yes | control | `"sc_req_item.u_fulfilment_stage"` | dotted-correct |
| s5 | | | treatment | `"sc_req_item.u_fulfilment_stage"` | dotted-correct |
| s6 | `change_request` / `u_risk_band` | no | control | `"change_request.u_risk_band"` | dotted-correct |
| s6 | | | treatment | `"change_request.u_risk_band"` | dotted-correct |

**Every pair is byte-identical between arms.** Zero of six scenarios moved.

## 4. The finding

**The rewording is inert in this instrument, and the refutation comes from a positive control
rather than from an insensitive test.** s3 reproduced the exact v7 C5 defect — `"assignment_group"`,
the table dropped — under the deployed contract. The instrument therefore *can* show the defect;
the treatment simply did not correct it. Scored against the comparable v7 result: the contract
change corrected the defect on **3 of 3** scenarios where it reproduced; item 1's rewording
corrected it on **0 of 1**.

So the hold block's *pull toward a bare field* is not what drops the table. The design's §5
mechanism is wrong, or at least is not the operative one at this prompt size.

**Power is the honest caveat, and it cuts only one way.** One reproducing scenario out of six is a
weak positive control, so this run could not have detected a small effect. It is evidence against
the hypothesis, not proof of a null. What it does establish is that the rewording is not worth
shipping on the strength of a mechanism this test declined to confirm.

**s3 also refines v7's own claim.** v7 §7 reported that the corrected contract supplied the remedy
for the table-omitted residual — C5's `"assignment_group"` became `task.assignment_group` under the
treatment contract. Here, with that contract deployed, an s3 prompt of the same shape still returns
`"assignment_group"`. The contract fix is therefore **not** a general remedy for the
table-omitted class; v7's 3-of-3 was measured on v7's ad-hoc hold arms, and this instrument's arms
are not those. **The table-omitted residual is still live.**

## 5. Scoring the predictions

| | Prediction | Outcome | Measured |
|---|---|---|---|
| S5 | The control arm reproduces ≥ 1 table-omitted argument, else the instrument licenses no claim | **HELD** | 1 of 6 (s3). The fail-safe passes: this is a real refutation, not an uninformative run |
| S6 | The treatment arm emits 0 table-omitted arguments across the 6 scenarios | **REFUTED** | 1 of 6 — the same scenario, the same argument, byte-identical |
| S7 | Both arms stay scalar — R3's refutation replicates; the change moves content, not form | **HELD** | 12 of 12 bare strings, 0 JSON objects, in both arms |

**One held, one refuted, one held — and S6's refutation is the result of the run.**

## 6. What this establishes, and what it does not

**Establishes.** Item 1's wording does not drive the table-omitted argument, in an instrument that
demonstrably reproduces that argument. The candidate rewording was **reverted** on this evidence
rather than shipped (#116; DECISION.md §R). The instrument itself is now reproducible from the
repo, with both of its constants anchored to ground truth.

**Does not establish a null.** Six paired scenarios, one reproducing, one model, one day, one
reduced instrument. A small effect would not have been visible.

**Does not cover the full-size prompt.** Unchanged from v7 §8: the faithful instrument needs the
real 16.7K-char prompt, which needs a server-side trial loop, which needs an execution surface the
app does not have.

**Says nothing about Change A.** The fan-out cap is measured by which layer is targeted, not by
argument form, and no trial here exercised it.

## 7. What it found that was not being looked for

- **A deactivated NASK skill executed normally, twelve times.** `servicenow_skill_list` reports
  `pa llm reason` as `[OFF]` / Inactive on gpinst01, and every `servicenow_skill_execute` call
  against it returned a normal result with no permission error. Build Rule #40 states that
  executing a deactivated skill fails with "Cannot process the one-extend call as the user doesn't
  have permission to execute this skill". Either the OneExtend REST path does not consult the same
  activation toggle the NASK panel does, or the `[OFF]` status `servicenow_skill_list` reports is a
  different flag. **Rule #40's failure signature is not universal across invocation paths.** Not
  chased further here; recorded because a future run that trusts `[OFF]` to mean "will fail" would
  misdiagnose.
- **`tableInEvidence` is the only structural axis in the scenario table.** The six scenarios vary
  table and field lexically, but three name the table in the trace and three do not, and the
  reproducing scenario (s3) is one of the latter. Whether the table's absence from evidence is what
  produces the omission — s2 and s6 also lack it and came back dotted — is unresolved and is the
  obvious next axis if this is pursued.
- **A test pinning the deployed item-1 wording did not exist before this work** and now does, so
  the A/B's assumption about what the block emits is guarded in CI rather than only when someone
  runs the script.

## 8. Recommendation

Do not pursue item-1 wording further without a stronger positive control — a scenario set where
the table-omitted argument reproduces on several scenarios, not one. Until then the mechanism
behind that residual is **unknown**, and v7 §7's "the treatment arm supplied the remedy" should be
read as scoped to v7's arms rather than as a general fix.

The scored pass §Q7 asks for is unaffected by this result and remains the next substantive item.
