# v7 — the `schema_lookup` contract A/B (`2026.08.0501`, #111 / #114)

Run 2026-08-05 on gpinst01. Paired A/B on the one sentence #113 changed, driven through the
`pa llm reason` NASK skill (capability `0bf0bc13a7414399a1482d21de01231d`) — the same seam
`PaLlmProxy._invokeNask` uses. No tool executed, so **no `x_snc_troubleshoot_audit` rows** were
written and the evidence trail a scored pass reads is uncontaminated.

Predictions R1–R4 and the instrument amendment were filed on issue #111 **before any trial ran**.

## 1. The instrument, and what it is not

The faithful instrument is the real 16.7K-char prompt. It needs a server-side trial loop, which
needs an execution surface the app does not have — ServiceNow exposes no supported REST path for
arbitrary script execution, and the MCP request tool permits only `/api/` paths. Adding an
admin-gated `/experiment` route was offered and declined. **So the prompt was reduced to
2,095 chars (control) / 2,315 (treatment)**, keeping only the elements with a plausible causal role:
`schema_lookup`'s full description, the `execution: <sys_id>` request block (`_renderRequest` emits
literal `key: value`), a transcript entry whose args are JSON, the verbatim response contract, and
the playbook's blank-field routing line. `benchmark/scripts/build-ab-prompts.js` composes both arms
and **exits non-zero unless they differ only in the contract sentence.**

The measured rates below are rates *for this instrument*, not estimates of the live rate.

## 2. The finding that invalidated the pre-registered design

**The model is deterministic at production temperature.** The same prompt sent twice returned
byte-identical output, with latencies of 2,697 ms and 3,450 ms — a real second call, not a cache
hit. A third trial varying only the table and field returned correspondingly varied args, so it
tracks content; it simply does not sample.

That kills the pre-registered "N = 30 repeats per arm": 30 repeats of one prompt carry exactly the
information of one. **Variation in v6 came from prompt variation across runs, not from sampling
noise.** The design was changed on the spot to *paired distinct scenarios* — same scenario, both
contracts — which is also the more powerful design. It does mean N is now the number of scenarios,
and 3 paired scenarios is a demonstration, not a rate.

## 3. Every trial

Control = the pre-#113 contract sentence. Treatment = the deployed one. Argument text is the
model's `args` value verbatim.

| # | Hold? | Table in evidence? | Arm | `args` returned | Verdict |
|---|---|---|---|---|---|
| C1 | no | yes (`sn_aia_tool`) | control | `{"table":"sn_aia_tool","field":"u_routing_key"}` | well-formed |
| C1′ | no | yes | control | *byte-identical to C1* | determinism check |
| C2 | no | yes (`cmdb_ci_server`) | control | `{"table":"cmdb_ci_server","field":"u_owner_group"}` | well-formed |
| C3 | no | **no** | control | `{"table":"incident","field":"priority"}` | well-formed |
| **C4** | **yes** | **no** | control | `"priority"` | **degraded — no table at all** |
| **C5** | **yes** | **no** | control | `"assignment_group"` | **degraded — no table at all** |
| **C6** | **yes** | yes (`sn_aia_tool`) | control | `"table.sn_aia_tool.u_routing_key"` | **THE DEFECT** |
| T4 | yes | no | treatment | `"incident.priority"` | correct |
| T5 | yes | no | treatment | `"task.assignment_group"` | correct |
| T6 | yes | yes | treatment | `"sn_aia_tool.u_routing_key"` | correct |

T4/T5/T6 are paired with C4/C5/C6 — identical prompts but for the contract sentence.

## 4. The hold block is the trigger, and that is the headline

**Without a hold: 3 of 3 control trials produced well-formed JSON. With a hold: 3 of 3 degraded.**
Including C3, where the model had no table in evidence, guessed `incident` and `priority` — v6's
exact guess — and still emitted correct JSON.

So the malformation is not a property of the contract alone. It is the contract **under the depth
gate's hold**. #109's own mechanism, the thing that finally moved §H8's acceptance test, is what
pushes the model off the object form onto a bare scalar — and the ambiguous shorthand then decides
what that scalar contains. Two defects compose, and neither reproduces alone in this instrument.

That is worth carrying into the declared-path work: the hold text is not neutral with respect to
argument quality.

## 5. Scoring the predictions

| | Prediction | Outcome | Measured |
|---|---|---|---|
| R1 | Control reproduces the parameter-prefixed form on ≥ 20% of trials | **HELD** | C6 — `table.sn_aia_tool.u_routing_key`, the literal placeholder word prefixed onto the value. 1 of 7 control trials, 1 of 3 under a hold. |
| R2 | Treatment produces 0 parameter-prefixed arguments | **HELD, but on 3 pairs, not 30** | 0 of 3. The pre-registered bound was NOT earned — see §6. |
| R3 | Treatment shifts argument form toward JSON objects (≥ 50% JSON) | **REFUTED** | 0 of 3 treatment trials used a JSON object. Both arms used scalars under a hold; the contract fixed the scalar's **content**, not its form. |
| R4 | Where malformation appears it uses `:` rather than `=` | **REFUTED** | It used `.` — the shorthand's own delimiter, a spelling neither R4 nor #113's guard anticipated. |

**Two held, two refuted — and R4's refutation is the most useful result of the run.**

## 6. What this establishes, and what it does not

**Establishes.** #111's root cause is confirmed directly rather than inferentially: C6 shows the
model emitting the literal placeholder word `table`, joined by the shorthand's own `.`, which is
what "it read `table` as literal text" predicts and nothing else does. On every scenario where the
defect reproduces, the corrected contract produces a correct call — 3 of 3, paired.

**Does not establish a rate or a bound.** 3 paired scenarios, one model, one day, one reduced
instrument. Rule-of-three on 3 observations gives a ~63% upper bound, which is worthless. **The
pre-registered ~10% bound was not achieved and is not claimed.** Anyone quoting this run as "the fix
is verified" is overreading it; the defensible claim is "the mechanism is confirmed and the fix
corrects it wherever it reproduced".

**Does not cover the full-size prompt.** The reduced instrument needed a hold block to reproduce the
defect at all. Whether the full 16.7K prompt reproduces it more readily is untested.

## 7. What it found that was not being looked for

- **#114 — the guard shipped in #113 is incomplete.** It strips `table:` and `table=` but not
  `table.`, because `.` could not join the character class without breaking `incident.priority`.
  C6's argument therefore normalised to `{table:'table', field:'sn_aia_tool'}` and returned
  `table_does_not_exist` — the exact silent wrong answer #111 existed to close, surviving in the
  spelling the defect most naturally takes. Fixed by segment count: `table.<x>.<y>` cannot be a
  two-part shorthand, so stripping is unambiguous there; `table.<x>` stays ambiguous and is left
  alone.
- **A residual no lexical guard can catch.** C4 and C5 returned `"priority"` and
  `"assignment_group"` — the table omitted entirely. Both are lexically valid table names, so
  `_normalizeArgs` cannot distinguish them from a real one; they resolve to `table_does_not_exist`
  for a table named `priority`. The remedy is behavioural, and the treatment arm supplied it:
  `incident.priority` and `task.assignment_group` on the identical prompts.
- **`_renderRequest` emits literal `key: value`** into every prompt (`execution: <sys_id>`). Kept in
  both arms, so it did not confound, but it remains a standing format donor and is the likeliest
  reason the v6 spelling was `:` where this run's was `.`.

## 8. Recommendation

Re-run this A/B against the **full-size prompt** once an execution surface exists, with enough
distinct scenarios to earn a bound rather than a demonstration. Until then #111 and #114 are
mechanism-confirmed and rate-unknown.

The e2e smoke §Q7 asks for should still run before the scored pass — but note that it inherits this
run's limitation, not its strength: it samples few `schema_lookup` calls and cannot bound a rate
either.
