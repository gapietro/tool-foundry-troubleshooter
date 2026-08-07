# The `<param>:<value>` guard reaches every tool, not the ones we happened to call — design

**Issue:** #122
**Date:** 2026-08-06
**Branch:** `fix/122-tool-arg-prefix-guard`
**Deployed main:** `2026.08.0601` (DECISION.md §U9)
**Ships as:** `2026.08.0602`
**Status:** design approved; runtime guard on six tools + six prompt descriptions + tests

---

## 1. What this is

Issue #122 reports the `<param>:<value>` argument malformation recurring on `genai_log`. It is not a
recurrence. **The #111 / #113 / #115 fixes were only ever applied to `schema_lookup`, and only ever
validated against the tools the harness happened to call.** DECISION.md §T2's prediction T6 recorded
the malformation at 0 of 6 v9 runs — every argument in that list belongs to `schema_lookup`. No
custom run had called `genai_log` at all until 2026-08-06 (§T6 counted 63 runs with zero). The first
time the harness reached the tool, it malformed the arguments.

So the defect is **scope**, and the fix is to close the scope: every tool that accepts a bare string
gets the guard, whether or not there is runtime evidence against it. `log_analysis` has still never
been called; the absence of evidence there is the absence of any call, not a clean bill.

### 1.1 The measured case, and why the guard fully repairs it

Smoke run `r2-2` (`x_snc_troubleshoot_run` `9b91aa692b6ecb5817a6ffbeee91bfdf`, gpinst01,
2026-08-06 23:26:43) called `genai_log` with the bare string:

```
execution:45bbfd112ba6cf54f243fed2ce91bfcb
```

Traced through `PaToolGenAiLog._normalizeArgs` (`PaToolGenAiLog.js:263-278`): the string is not
JSON, does not start with `{` or `[`, and **fails `k.isSysId` because of the prefix** — so it falls
to `return { mode: k.lower(s) }`. `_resolveMode` finds no such mode and no execution, notes
*"Unknown mode … Returning the default (llm)"*, and the call returns `entries: []`,
`llm_call_rows: 0`.

**Strip the prefix and the remaining 32 hex characters satisfy `k.isSysId` at line 272, which routes
to `{execution: s, mode: 'for_execution'}` — the exactly-correct call.** The same tool called
correctly in `v10-2` returned 5,176 chars with `llm_call_rows: 3`. The guard is therefore fully
repairing here, not merely diagnostic.

## 2. Scope — all seven tools accounted for

| tool | bare-string branch | today | this change |
|---|---|---|---|
| `schema_lookup` | `PaToolSchemaLookup.js:335` | **guarded** (#111 `PARAM_PREFIX_PATTERN`, #114 `DOTTED_PREFIX_PATTERN`) | **untouched** |
| `genai_log` | `PaToolGenAiLog.js:263` | unguarded | shared helper |
| `log_analysis` | `PaToolLogAnalysis.js:199` | unguarded | shared helper |
| `query_table` | `PaToolQueryTable.js:201` | unguarded | shared helper |
| `agent_config` | `PaToolAgentConfig.js:370` | unguarded | shared helper |
| `agent_trace` | `PaToolAgentTrace.js:459` | unguarded | **local copy** — does not use `PaToolReadKit` |
| `read_artifact` | `PaToolReadArtifact.js:54` | unguarded | **local copy** — does not use `PaToolReadKit` |

`agent_trace` and `read_artifact` carry private `_trim` / `_tryParse` / `_isSysId` helpers rather
than `PaToolReadKit`. Migrating them is **issue #41 and stays open** — pulling it into this branch
would rewrite two large tools for a change that does not need it.

### 2.1 `schema_lookup` is deliberately not migrated

Its guard is the only one with production evidence behind it, and #114's `DOTTED_PREFIX_PATTERN`
carries a discriminator that is easy to get wrong: `table.<x>.<y>` is unambiguously a prefix because
a three-segment string cannot be a two-part shorthand, while `table.<x>` is genuinely ambiguous and
is deliberately left to the shorthand path. Rewriting that onto a shared abstraction risks a
regression on the one path we have measured, and buys nothing this issue asks for. Two
implementations is the accepted cost.

> **Resolved 2026-08-07 (#125) — the exemption was right, and it left a real gap.**
> Exempting `schema_lookup` from the migration also left its guard covering `table` and
> `table_name` only, while `_normalizeArgs` accepts `field`, `element` and `column` and the tool's
> description tells the model that *table and field* are both parameter names. It was the only tool
> whose guard did not cover its full accepted parameter list after this change.
>
> #125 closed it **without** migrating — the ruling above still holds, and `DOTTED_PREFIX_PATTERN`
> is untouched. What it could not be is the one-line widening the issue proposed: `_normalizeArgs`'s
> no-dot branch puts whatever survives the strip into the **table** slot, so stripping `field:`
> without routing reads `field:channel` as a table called `channel`, performs a real `sys_db_object`
> read, and reports `table_does_not_exist` — a confident claim about the instance built on a word
> the model merely spelled out, and the exact false diagnosis §1.1's guard exists to prevent. Today
> that call fails **safe** (`table_name_malformed`, no read attempted). So `PARAM_PREFIX_PATTERN`
> gained a capture group and `PARAM_PREFIX_SLOT` maps each name to the slot it fills;
> `field:channel` now reaches the `no_table` branch, which asks for the table rather than inventing
> a verdict about one.

## 3. The mechanism

### 3.1 `PaToolReadKit.splitParamPrefix(s, paramNames)`

A pure string function — no reads, no `data` envelope, testable in isolation.

```
@param   {String} s          a bare, non-JSON argument string
@param   {Array}  paramNames the tool's accepted parameter names, aliases included
@returns {Object|null}       {param, value, raw} when a prefix matched, else null
```

Match rule: `^(<name>)\s*[:=]\s*(.+)$`, **anchored**, case-insensitive, where `<name>` must equal one
of `paramNames` in full. `value` is trimmed; `raw` is the original string, for the note.

**`param` is returned as the entry appears in `paramNames`, not as the caller spelled it and not
lower-cased.** Two accepted parameter names are camelCase — `query_table`'s `encodedQuery` and
`read_artifact`'s `artifactId` — and the object branches read those keys verbatim
(`raw.encodedQuery`, `raw.artifactId`). Lower-casing the match would synthesize `{encodedquery: …}`,
which the object branch does not read, and the repair would silently drop the value. Matching is
case-insensitive; the returned name is canonical.

An empty value does not match: `(.+)` requires at least one character, so a bare `"table:"` falls
through to the existing bare-string branch unchanged.

**Anchoring is the safety property.** A `:` or `=` inside a value never matches — an encoded query
such as `sys_created_on>=javascript:gs.beginningOfToday()` passes through untouched, because the
segment before the first separator (`sys_created_on>`) is not a parameter name.

### 3.2 The repair: synthesize a one-key object, re-enter the object branch

The stripped value is **not** assigned into the output directly. The guard builds `{<param>: value}`
and lets it fall through the tool's existing object path:

```
"execution:45bb…"  →  {execution: "45bb…"}  →  [existing object branch]
                                             →  out.execution set
                                             →  _resolveMode: execution present, no mode
                                             →  mode = "for_execution"          ✓
```

This is what makes the named-slot rule cheap. Every alias table, coercion and inference each tool
already owns applies for free — `execution_plan` → `execution`, `k.num` on `minutes_ago`, `k.bool`
on `errors_only`, `PaToolAgentTrace._resolveMode`'s `execution > agent > recent` precedence — and
the guard contributes no per-tool branching logic, only a list of parameter names.

**Why the named slot rather than stripping and falling through to the bare-string branch.**
Fall-through discards which parameter the model named, and misroutes whenever the value's shape does
not match the slot the bare-string branch assumes:

| input | fall-through | named slot |
|---|---|---|
| `genai_log` `"execution:45bb…"` | `{execution, mode}` ✓ | `{execution, mode}` ✓ |
| `genai_log` `"capability:foo"` | `{mode: "foo"}` ✗ | `{capability: "foo"}` ✓ |
| `agent_trace` `"execution:MyRun"` (not a sys_id) | `{agent: "MyRun"}` ✗ | `{execution: "MyRun"}` ✓ |

### 3.3 The repair is loud

Carried forward verbatim in intent from #111 (`PaToolSchemaLookup.js:79-93`): repairing silently
would make the call work and erase the only evidence that the model is malforming arguments, which
is exactly how this went unnoticed through a whole smoke — every measure counted which tools were
*invoked*, and this one was.

Each tool pushes a note naming the raw string as sent, the slot it was read into, and the fact that
the audit trail records the call as sent rather than as repaired. A false positive from this guard
is therefore visible in the transcript rather than absorbed.

### 3.4 Per-tool parameter lists

Taken from the keys each object branch already reads, so a parameter the tool does not accept cannot
appear in its list.

| tool | parameter names |
|---|---|
| `genai_log` | mode, execution, execution_plan, plan, minutes_ago, minutes, since, errors_only, include_payload, capability, capability_name |
| `log_analysis` | execution, execution_plan, plan, source, message, contains, keyword, level, minutes_ago, minutes, since, limit |
| `query_table` | table, table_name, query, encoded_query, encodedQuery, fields, limit |
| `agent_config` | agent, agent_name, name, section |
| `agent_trace` | execution, agent, step, since, detail |
| `read_artifact` | artifact_id, artifactId, artifact, id, offset, length |

## 4. The prompt-side half

#111's root cause was not the absence of a guard; it was `schema_lookup`'s own contract advertising
*"the shorthand table.field"*, whose notation gives a model no way to tell that `table` is a
placeholder and not literal text — it is also the JSON key name, one sentence earlier. That wording
was fixed at the source. **The other six descriptions were never examined for the same defect.**

`genai_log`'s reads *"pass a JSON object with mode, and optionally execution, minutes_ago,
errors_only and include_payload … A bare mode name works, and a bare sys_id is treated as an
execution."* It names the parameters in prose, offers a bare-string affordance, and never says the
parameter name is not part of the value. `execution:<sys_id>` is a coherent reading of it.

Six descriptions each gain one sentence in their `UNDERSTANDING TOOL INPUTS` section, naming that
tool's own parameters, in the register `schema_lookup` already uses. `schema_lookup`'s is already
correct and is not touched.

> **Followed up 2026-08-07 (#126) — the prompt-side half now has a guard.**
> This section, and the 14 in-band guidance strings the whole-branch review went on to find, were
> both corrected by reading. Nothing failed if the shape drifted back, and it had already recurred
> once (#111 → #122). `test/paramShapeScan.test.js` closes that by construction: it scans the
> **string literals** of `src/server/tools/**` and `src/fluent/agent-doctor.now.ts` for a tight
> `<param>:<value>` / `<param>=<value>` shape, keyed to each tool's own `PARAM_NAMES` — the
> per-tool lists §3.4 introduced are what make it checkable.
>
> Two findings from building it, both from the tree rather than from design:
> - Restricting to string literals is what makes the scan usable at all — a naive line scan finds
>   237 matches, of which 221 are object syntax (`table: a.table`) that never reaches a model.
> - The **negation** is the discriminator, not a file+line allowlist: all 15 legitimate survivors
>   are counter-examples of the form `not execution:<sys_id>`. One of them —
>   `schema_lookup`'s `table_name_malformed` next_step — splits `not ` and `"table:incident"`
>   across a string concatenation, so the scan bridges to the preceding literal for an occurrence
>   within 3 characters of the start.

### 4.1 Two constraints on the edit

1. **Both files, or the suite fails.** Descriptions are duplicated byte-for-byte into
   `src/fluent/agent-doctor.now.ts` (the native arm's roster) and `PaToolRegistry.test.js:462`
   asserts exact equality for all seven. This is already enforced; no new parity test is needed.
2. **Build Rule #43.** The `agent-doctor.now.ts` copy sits inside a Fluent backtick template. No
   backtick, no `\n`, no `${` may appear in the new text — a backtick fails the build with
   diagnostics pointing elsewhere in the file, and an escape sequence installs cleanly and fails at
   invocation. The proposed sentences contain only letters, digits, commas, colons and angle
   brackets. See also open issue #28.

## 5. Tests

Unit tests only — no benchmark round, per the agreed done-bar (§7).

1. **`PaToolReadKit.test.js`** — the splitter in isolation: matches on `:` and `=`; tolerates
   whitespace around the separator; case-insensitive on the name; requires the whole segment to
   equal a parameter name (`executions:x` does not match `execution`); returns `null` on no match
   and on an empty value (`"table:"`); returns the **canonical** spelling for a camelCase parameter
   (`"encodedquery:active=true"` yields `param: 'encodedQuery'`, §3.1); and the anchoring guard —
   `sys_created_on>=javascript:gs.beginningOfToday()` must not match.
2. **Per-tool, in each of the six suites** — three cases each:
   - the measured shape, reproducing #122's exact string where applicable
     (`PaToolGenAiLog` given `"execution:45bbfd112ba6cf54f243fed2ce91bfcb"` resolves mode
     `for_execution` and reads that execution);
   - the case fall-through would misroute (§3.2's table);
   - the loud note is present and names the raw string.
3. **`PaToolRegistry.test.js`** — each of the six descriptions contains the anti-prefix sentence.
   The existing parity test covers the Fluent side.

Full suite must stay green: **1160 passing, 26 suites** as of `2026.08.0601`.
*(Follow-ups #125–#127 took this to **1320 passing, 27 suites**; the new suite is
`test/paramShapeScan.test.js`, per the §4 note.)*

## 6. What this deliberately does not cover

Stated as limits, not omissions:

- **Prefixes inside object values** — `{table: "table:incident"}`. The guard covers the bare-string
  branch only. This shape has never been observed. Unlike #122's gap (tools never exercised, which
  this change closes for all seven), it is a different *shape* with no evidence behind it, and it is
  cheap to add if it appears.
- **Whether the corrected wording changes model behaviour.** Nothing here measures that. The guard
  makes the malformed call work; the wording is a hypothesis about the root cause, and #111's
  identical hypothesis for `schema_lookup` was never independently isolated from its guard either.
- **`schema_lookup`'s behaviour** — unchanged in every respect *by this change*. **Superseded
  2026-08-07:** #125 changed it, routing a stripped `field` / `element` / `column` prefix to the
  field slot instead of the table slot. See the resolution note in §2.1.
- **Issue #41** — `agent_trace` and `read_artifact` remain off `PaToolReadKit`.

## 7. Done-bar

Agreed before design: **unit tests only.** Jest coverage per §5, plus `now-sdk build` and
`now-sdk install --alias gpinst01` to prove it deploys. **No targeted live probe and no benchmark
round.** #121's sized evidence-return round becomes the first live exercise of this fix, which is
acceptable because that round is happening regardless and its numerator — a gathering call counts
only when it returns something — is precisely the measure this fix moves.

**The risk is named:** this ships a fix for a class of defect whose defining feature is that fixes
went unvalidated against unexercised tools. Closing the scope to all seven tools is what addresses
that; unit tests per tool are the substitute for runtime evidence, and #121's round is where the
runtime evidence arrives.

## 8. Sequencing

#122 lands first, then #121. §U9.3 lists them the other way round, but the dependency runs backwards
from how it is written: §U9.1's honest rate is 1 of 4 rather than 2 of 4 **because** `r2-2`'s
gathering call malformed its arguments and retrieved nothing. Running #121's sized round before this
fix would measure the argument bug rather than the evidence-return mechanism, at the cost of a round
that §R2.4's variance figures say must be sized well above four runs.
