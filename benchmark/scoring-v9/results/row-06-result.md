# Row 06 — blind score

**Packet:** `benchmark/scoring-v9/row-06-native-seed-04-run-2.md`
**Seed:** 04 (GenAI capability not mapped to a provider) · **Arm:** native (Agent Doctor) · **Run:** 2
**Scored from the packet only.** No other file, directory, command or network source was consulted.

---

## 0. Void check (§A3) — FIRST, before any rubric column

§A3's seed-4 void condition: *"the capability sys_id in the installed `sn_aia_tool.script` does
not match the target instance's `sys_one_extend_capability` record … Either way the tool tests a
malformed reference rather than an unmapped provider. A hardcoded value that MATCHES the
instance's record is a valid install, not a void."*

Evidence in the packet that the reference **resolved**:

- The report states the tool invoked capability `x_snc_tsbench_unmapped_capability`
  (`92ff62af516741769c437feb88c80ef3`) — the exact sys_id the seed spec's Setup step 2 records as
  gpinst01's installed capability and as the value now hardcoded in the Fluent source.
- The diagnostic agent read an actual `sys_one_extend_capability_definition` row for it
  (`904c0485699a4a73a124446a7231c563`) via `genai_log check_config`. A malformed/unreachable
  reference would not have yielded a definition row.
- The observed failure signature matches the spec's fixture-verified prediction exactly:
  `status: "error"`, message "Plan invalid or not created.", `planId: null`, tool `ok: false`.
  The spec's 2026-08-02 fixture note predicts `status: "error"`, "Plan invalid…", and `ok: false`.
  This is *capability reached, provider behind it missing* — the primary construction — not
  *capability not found* (the fallback signature).

Neither seed-4 void condition holds, and the seed-5 conditions are not applicable.
**Not void.** The four rubric columns are scored.

Also confirmed: the fallback construction described under "Install risk and the fallback" was
**not** used (the signature is the primary one), so the run is scored against the primary
expected diagnosis, per the spec.

---

## 1. `root_cause_layer_correct` — **2**

Expected layer: `genai_stack` (layer 6).

The report's **Root Cause 1 — PRIMARY** is explicitly labelled *"Layer 6: GenAI Stack"*, `layer` =
`6 — GenAI stack`, and the named component is
`sys_one_extend_capability_definition` sys_id `904c0485699a4a73a124446a7231c563`, name
`x_snc_tsbench_unmapped_capability`. The finding is that `api` holds
`00000000000000000000000000000000`, resolving to no `sys_hub_flow` row, and that `api` is the
mandatory binding for `api_type = sys_hub_flow`.

That is the seeded defect named at the seeded layer, and it is named as the **primary** cause, not
buried among alternatives. The two other causes listed are explicitly secondary (tool-description
quality) and informational (no trigger wiring, marked UNCONFIRMED and correctly noted as
irrelevant to a conversational invocation) — they do not dilute or displace the primary.

**Decoy check (spec's scoring note):** the run did **not** name the empty `connection` anywhere as
a root cause or as a fix target. The decoy was not taken. Recorded in notes per the spec's
instruction to record the decoy outcome either way.

→ **2**

## 2. `fix_target_correct` — **2**

Expected fix target: **capability mapping** — repoint `api` at the real provider integration
subflow; explicitly *not* the tool script and *not* the agent instructions.

**Fix 1** targets `sys_one_extend_capability_definition` sys_id `904c0485699a4a73a124446a7231c563`,
field `api`, current value `00000000000000000000000000000000`, proposed: the sys_id of the
`sys_hub_flow` record implementing the intended LLM provider integration. Its rationale restates
that `api` is the mandatory binding for `api_type = sys_hub_flow`.

This is the capability→provider mapping, at the right record and the right field. It is not the
tool script, not the instructions, not the connection alias.

Fix 2 (tool description / `mandatory` flag) is additional and is presented as addressing the
*secondary* cause, explicitly stated not to have caused this failure. It does not compete with
Fix 1 for "the" fix — Fix 1 is flagged *"Apply this first"*.

No partial band needed; the specific target is named, not just the area.

→ **2**

## 3. `evidence_cites_trace_and_config` — **1**

The rule: root cause cites BOTH the execution trace AND at least one config/schema source.

Root Cause 1's evidence row cites both, in one line:

- **Config source:** `genai_log check_config` → definition `904c0485699a4a73a124446a7231c563`,
  `api = 00000000000000000000000000000000`, `api_state: dangling`, `finding: api_dangling,
  severity: high`.
- **Execution trace:** `agent_trace` tool call `0f5cbd992baa475817a6ffbeee91bf42` → `ok: false`,
  `status: error`, `planId: null`.

This is exactly the pairing the seed's "Evidence a correct diagnosis should cite" section asks for:
the tool's execution failure from the `OneExtendUtil` call **plus** the capability definition row
showing the unresolvable `api`.

→ **1**

## 4. `fix_usable_unedited` — **1** *(ambiguous; see below)*

Gate constraint satisfied on the precondition side: `fix_target_correct` = 2, so the §A2/§A-note
prohibition (`fix_usable_unedited` may not be 1 while `fix_target_correct` = 0) does not bind. The
fix addresses the defect the seed actually carries — the dangling `api`, not the decoy.

**The ambiguity, stated rather than smoothed over.** The rubric wording is *"could be applied by
the builder AI as written, with no manual editing first."* Fix 1 does **not** supply a concrete
replacement sys_id. It supplies a description of the required value ("the `sys_id` of the
`sys_hub_flow` record that implements the intended LLM provider integration for this capability")
and a three-step discovery procedure whose step 1 is a **UI** action ("Open Now Assist / AI Skill
Studio and locate the provider integration"). The seed's expected diagnosis, by contrast, names a
concrete healthy value (`936e514a53b3b110f028ddeeff7b128c`, used by 422 of 2026 rows on gpinst01).

The rubric does not state whether a fix that names the target and the *class* of correct value, but
requires one lookup to obtain the literal value, counts as applicable "as written". Both readings
are defensible:

- **Reading toward 0:** the `proposed` cell is a description, not a value; a builder must fill it
  in before applying, which is editing. Step 1 is also a UI navigation the builder AI cannot
  perform through the SDK/MCP path.
- **Reading toward 1:** nothing in the fix is *wrong* or needs correcting — the table, sys_id,
  field, current value and required semantics are all exact. What remains is a read-only lookup of
  an instance-specific sys_id, which is a discovery step rather than an edit to the fix. It is also
  the documented house norm for instance-specific sys_ids in this project (the
  `REPLACE_WITH_..._SYS_ID` placeholder pattern the seed spec itself cites approvingly in Setup
  step 2 as "fails loudly rather than pointing silently at the wrong record"), so requiring a
  literal sys_id would penalise the practice the specs treat as correct.

**Resolved to 1**, for three reasons. (a) The rubric's own stated rationale for this column, given
at length in §A2, is entirely about *wrong-target* no-op fixes — the hole the R-22 decoy exposed —
not about value specificity; nothing in §A2 suggests the column was meant to police how concretely
an instance-specific identifier is supplied. (b) The seed's "Expected diagnosis" phrases the fix as
*"repoint `api` at the real provider integration subflow"*, with the concrete sys_id in a
parenthetical framed as the healthy value on gpinst01 — reference for the scorer, not a mandated
component of the answer. (c) The fix requires no correction to be applied; only a lookup.

Flagged as `ambiguous=yes`. This is a genuine rubric gap, and it is the only column in this row
where the rubric does not determine the answer. A scorer taking the stricter reading would record
`fix=0`, `total=5`, `passes_gate=no` — so the gap is outcome-changing for this row, which is worth
recording explicitly for the reproducibility question the pass is measuring.

→ **1**

## 5. Total and gate

Total = 2 + 2 + 1 + 1 = **6 / 6**

§A2 expression, applied literally:

```
passes_gate = 1  iff  root_cause_layer_correct == 2 AND fix_usable_unedited == 1
```

`root_cause_layer_correct` = 2 ✔ · `fix_usable_unedited` = 1 ✔ → **passes_gate = 1 (yes)**.

(`fix_target_correct` and `evidence_cites_trace_and_config` are recorded but are not gate terms,
per §A2.)

---

## 6. Things deliberately NOT scored

- **Sweep breadth / layer count.** 7/7 layers swept per the audit trail, 17 tool calls, 9 LLM
  calls. None of the four rubric columns score breadth, effort, latency or presentation, so this
  is context only and did not influence any column.
- **The syslog gap.** The report declares the platform-log layer UNAVAILABLE and explicitly refuses
  to report it clean — honest, but not a rubric column. The packet's §5 note flags that the
  `caller_access = Caller Restriction` claim is the run's own unverified prose; since it bears on
  no scored column, it changes nothing here.
- **The `x_snc_troubleshoot_run` anchor left at `status: running`** (§5). A harness-side bookkeeping
  defect, not a void condition under §A3 and not a rubric column. The terminal state used for the
  void check came from the execution plan, as the packet directs.
- **The report's ancillary findings** (tool description smells, absent trigger wiring). Correctly
  scoped by the run itself as non-causal; they neither add nor subtract points.
