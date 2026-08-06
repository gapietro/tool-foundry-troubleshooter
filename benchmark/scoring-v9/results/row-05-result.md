# Row 05 — scoring reasoning

**Packet:** `benchmark/scoring-v9/row-05-native-seed-04-run-1.md`
**Seed:** 04 (GenAI capability not mapped to a provider) · **Arm:** native (Agent Doctor) · **Run:** 1
**Scored blind:** only the packet was read. No other file, no directory listing, no grep, no Bash, no web.

---

## 0. Void check (§A3) — first, because it gates everything else

§A3's seed-4 void condition: the capability sys_id in the installed `sn_aia_tool.script` does
not match the target instance's `sys_one_extend_capability` record, so the tool tests a
malformed reference rather than an unmapped provider.

Evidence in the packet that the condition does **not** hold:

- The seed spec's own "Fixture state, verified 2026-08-02" block records that the placeholder was
  substituted with `92ff62af516741769c437feb88c80ef3` and **verified in the installed script**.
- The run's report shows the tool invoking capability `92ff62af516741769c437feb88c80ef3`, and
  `genai_log check_config` on that same sys_id **returned a definition row**
  (`definitions[0]`, `api_type = sys_hub_flow`, `api = 000…0`). A capability sys_id that matched
  nothing on the instance could not have yielded a definition row.
- The observed failure signature (`ok:false`, `status:"error"`, empty `requestPayload`) matches
  the spec's predicted signature, not a "capability not found" signature.
- §A3 states explicitly that a hardcoded value which MATCHES the instance record is a valid
  install, not a void. This is a gpinst01 run against the gpinst01-hardcoded value.

The fallback construction ("capability that exists nowhere") was clearly **not** used — the
capability was reached and its definition inspected. So the primary signature applies.

Run terminated `completed`, `state_reason` empty; the report exists and was not rejected by a
validator (no validator rejection is recorded anywhere in the packet).

**void = no.** All four rubric columns are scored.

---

## 1. `root_cause_layer_correct` — **2**

Expected layer: `genai_stack` (layer 6).

The report's **Root Cause 1**, explicitly flagged *PRIMARY — blocks every execution*, is
"Dangling capability `api` binding", **Layer: 6 – GenAI stack**, on
`sys_one_extend_capability_definition`, identifying `api = 00000000000000000000000000000000`
against `api_type = sys_hub_flow` resolving to no `sys_hub_flow` row.

That is the seeded defect named at the seeded layer, in the seeded mechanism (mandatory pointer
at a provider integration subflow that does not exist). Not a layer guess that happened to land —
the substance matches.

**Decoy check (spec's scoring note):** the report never proposes the empty `connection` as a root
cause; the word `connection` does not appear in its root-cause or fix sections at all. This is
*not* a decoy hit, so none of the decoy penalties apply.

Three additional root causes are reported (RC2 `active_tool_count: 0`, RC3 `ticket` input not
mandatory, RC4 no trigger wiring). These are noise relative to the seed, but the rubric scores
whether the diagnosis *names the expected layer*, and RC1 is unambiguously designated the primary
blocker while RC2 is marked UNCONFIRMED and RC3/RC4 are explicitly marked as not causing this
failure. The report does not hedge between competing primaries. Score stands at 2.

---

## 2. `fix_target_correct` — **2**

Expected fix target: **capability mapping** — repoint `api` at the real provider integration
subflow; explicitly *not* the tool script and *not* the agent instructions.

**Fix 1** is "Repoint the capability `api` to a real provider flow", target
`sys_one_extend_capability_definition` sys_id `904c0485699a4a73a124446a7231c563` · field `api`,
current `00000000000000000000000000000000`, and is labelled *(addresses RC1 — required to
unblock)*. That is capability mapping, named at the exact record and exact column.

The report also does not misroute the fix to the tool script or the instructions: Fixes 2 and 3
touch tool schema and tool description but are explicitly scoped as "defensive hardening" /
"defensive", and Fix 4 is conditional on record-event firing being intended. The rationale on
Fix 1 states "Setting a real subflow sys_id is the only change needed to unblock invocation" —
the report itself ranks the correct fix as the sole unblocker.

No partial band needed; full 2. (Seed 4 defines no partial case, and none is required here.)

---

## 3. `evidence_cites_trace_and_config` — **1**

The rubric requires the root cause to cite BOTH the execution trace AND at least one
config/schema source. RC1's Evidence block cites exactly two, one of each:

- **Config:** `genai_log check_config` → `definitions[0]`: `api_type = sys_hub_flow`,
  `api = 00000000000000000000000000000000`, `api_state = dangling`, plus the `sys_hub_flow`
  read returning 0 rows, and `findings[0].finding = api_dangling` (severity high).
- **Trace:** `agent_trace` → `tool_calls[0].response_digest`: `ok:false`, `status:"error"`,
  `requestPayload:{}`.

This is also precisely the pair the seed spec asks for under "Evidence a correct diagnosis should
cite": the tool's execution failure from `OneExtendUtil.execute`, **plus** the capability
definition row showing the unresolvable `api`. The report's own Confidence line frames them as
two independent confirmations of the same `capability_id`. Score 1.

The audit-trail measurements independently corroborate that both tools actually ran
(`agent_trace` at 02:40:15, `genai_log` at 02:41:06 among the 14 result rows), so the citations
are not fabricated prose.

---

## 4. `fix_usable_unedited` — **1** (ambiguous; see §5)

Constraint check first: `fix_target_correct` = 2, so the "may not be 1 while `fix_target_correct`
is 0" bar is not engaged. The fix addresses the defect the seed actually carries — the no-op
clause in §A2 does not apply.

Remaining question is the literal one: could the builder AI apply Fix 1 **as written, with no
manual editing first**?

What the fix supplies concretely: target table, target record sys_id, target field, current value,
and the exact semantics of the change. What it does **not** supply is the replacement sys_id —
it says "The `sys_id` of the Now Assist / LLM provider subflow in `sys_hub_flow` that should
service `x_snc_tsbench_unmapped_capability`. Locate the correct subflow in Flow Designer under the
NowAssist or provider scope, then set `api` to its sys_id." The seed spec's expected diagnosis
names the healthy gpinst01 value (`936e514a53b3b110f028ddeeff7b128c`, used by 422 of 2026 rows);
the report does not reach it. Note that this value is a listed blind-rule token, so the run could
not be expected to have been told it — but nothing stopped the run from *discovering* it, and it
did not.

I resolve this to **1**. Reasoning:

- The rubric's phrase is "no **manual** editing first". The gap here is a discovery step the
  builder AI can execute itself (query `sys_hub_flow` / the definition table for the provider
  subflow the healthy definitions use); it is not a hole a human must patch into the report text
  before the report can be handed over. Executing an instruction is not editing it.
- The fix is fully determinate about *what record and field to change and why*, which is the part
  a builder AI cannot reconstruct on its own. The instance-specific sys_id is exactly the sort of
  value the project's own house pattern treats as substituted at apply time.
- The rubric's stated purpose for this column, spelled out at length in §A2, is to stop
  well-formed-but-wrong-target fixes from passing. That failure mode is absent here.
- The report supplies a verification procedure that closes the loop (`api_state` should move
  `dangling` → `resolved`), which is what an appliable fix looks like.

The contrary reading — that a fix whose replacement value is a description rather than a literal
cannot be "applied as written" — is genuinely available on the text, and would give 0 here,
dropping the total to 5 and flipping `passes_gate` to no. I record it rather than bury it; see §5.

---

## 5. Ambiguity flag (explicit, per instruction)

**The rubric does not determine `fix_usable_unedited` for a fix whose target is exactly right but
whose replacement *value* is under-specified.** §A2 and the seed's scoring note both discuss this
column only in the wrong-target direction ("a fix aimed at the wrong target is a no-op"). Neither
addresses the right-target/unresolved-value case that this run presents. No band, note or example
in the packet covers it.

- **How I resolved it:** awarded 1, on the reading that "no manual editing" bars handing over a
  report a human must first fix up, and that a builder AI performing a lookup is executing the
  fix rather than editing it — plus the column's stated purpose (per §A2) being wrong-target
  no-ops, which this is not.
- **What the other resolution costs:** `fix_usable_unedited` = 0 → total 5/6 → `passes_gate` = no.
  This single undetermined column is the difference between a pass and a fail on this row, which
  makes the gap worth recording rather than smoothing over.

Secondary, non-scoring observations recorded for the reproducibility question:

- The rubric offers no handling for **extra, unseeded root causes and fixes** (RC2–RC4, Fixes
  2–4). I did not penalise them, because no column mentions precision/noise, and the report
  correctly subordinates all of them to RC1. A rubric that intended to penalise diagnostic noise
  would need a fifth column; as written it does not.
- The packet's §5 flags that the report's `syslog`-DENIED claim was not independently verified.
  It bears on no scored column — the platform-logs sweep is not one of the seven layers the
  audit trail scores, and RC1 does not rest on it.
- The `x_snc_troubleshoot_run` anchor left at `status: running` is likewise a harness artefact,
  not a scoring input; terminal state was read from the execution plan, which is `completed`.

---

## 6. `passes_gate` — computed from §A2 verbatim

```
passes_gate = 1  iff  root_cause_layer_correct == 2  AND  fix_usable_unedited == 1
```

`root_cause_layer_correct` = 2 ✓ · `fix_usable_unedited` = 1 ✓ → **passes_gate = 1 (yes)**.

`evidence_cites_trace_and_config` and `fix_target_correct` are not terms in the expression and
were not used to reach this verdict.

---

## 7. Final row

| Column | Score |
|---|---|
| `root_cause_layer_correct` | 2 |
| `fix_target_correct` | 2 |
| `evidence_cites_trace_and_config` | 1 |
| `fix_usable_unedited` | 1 |
| **Total** | **6 / 6** |
| `passes_gate` | **yes** (1) |
| void | no |
| ambiguous | yes — `fix_usable_unedited`, see §5 |

**Notes for the scorecard:** Decoy not taken — the empty `connection` is never named as a root
cause or fix target. Fix 1 identifies the dangling `api` on the capability definition and repoints
it, but stops short of naming the replacement subflow sys_id; scored usable on the reading that
the lookup is execution, not editing. That single judgment is the row's pass/fail hinge.
