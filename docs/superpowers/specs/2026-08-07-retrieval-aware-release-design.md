# Design — A gathering call counts only when it retrieved something

**Date:** 2026-08-07 · **Issue:** [#121](https://github.com/gapietro/tool-foundry-troubleshooter/issues/121) ·
**Branch:** `fix/121-retrieval-aware-release` · **Version at design time:** `2026.08.0602`

---

## 1. The problem, restated against current code

Two measurements in this project count a tool being **called** where they mean a tool having
**established something**, and they are the same defect in two places.

**The depth gate.** `PaAgentLoop._depthGate` releases on
`this._anyOf(this._heldTools, trail.tools)`, where `trail.tools` is the set of tool *names* read
off `x_snc_troubleshoot_audit`. Nothing in the release path inspects what the call returned.
`DECISION.md` §T4 measured the consequence: v9 row 07's `schema_lookup` correctly answered
`table_exists: false` — it retrieved nothing at all — and the gate released the run anyway.

> §T4: *"So the gate counts a layer-4 tool being **called**, not layer 4 being **reached**."*

**The evidence-return numerator.** §U8.3 defined `N` as *"runs that made a tool call at a higher
`seq` than the first `EVIDENCE RETURN` note"*. Nothing in it inspects the result either. Pooled
over all eight seed-01 runs across both rounds (§U9.1):

| | count | runs |
|---|---|---|
| Runs that fired at least one `EVIDENCE RETURN` | 4 | v10-1, v10-2, r2-2, r2-3 |
| …that made a tool call after it (`N`, as pre-registered) | **2** | v10-2, r2-2 |
| …whose call actually **retrieved** anything | **1** | v10-2 only |

r2-2's `genai_log` call carried `execution:45bbfd112ba6cf54f243fed2ce91bfcb` — a bare string with
the `<param>:<value>` prefix. The tool answered *"Unknown mode … Returning the default (llm)"* and
returned `entries: []` with `llm_call_rows: 0`. It counted.

**So `2 of 4` is an artefact of the metric, and the honest rate is 1 of 4.** §T9 recommended the
correction for the gate and §U9.3 queued it for the numerator. One predicate serves both.

### 1.1 What this design does NOT do

Scope was fixed with the developer before any code: **steps 1 and 2 of the issue only.** The sized
round (#121 step 3) and the `MAX_EVIDENCE_RETURNS` flip (step 4) are deferred to a separate issue,
because they need a deployed build, an `n` sized against the observed ~½ fire rate, and a stopping
rule fixed in advance — §U8.5 is explicit that a second 4-run round would land on the boundary
again.

The five prerequisites filed on #121's first comment (the `_resetGate` cross-run leak, the
`null >= 0` guard, the missing 1→2 evidence-return test, `_finishAnswer`'s dropped draft, and two
inaccurate comments) also stay out. They block the **cap flip**, not this change. One of them is
answered incidentally: §5's new option is read with a strict `=== true` test rather than the
`>= 0` shape that accepts `null`.

---

## 2. The predicate — `PaToolReadKit.retrievalVerdict(result)`

### 2.1 Why the read kit already owns this

`PaToolReadKit.noteRead` maintains, on every tool that uses the kit, a
`data.reads = { <table>: 'ok' | 'empty' | 'unknown' | 'DENIED' }` map. Its own header defines the
values:

> *"`ok` means 'the read succeeded and rows were present' and `empty` means 'it succeeded and there
> were none'."*

and R-25 restricts who may assert one:

> *"So `fromRowRead` is required for a success status, and it is passed by exactly two callers:
> `readRows` and `readOne`."*

That is exactly the predicate #121 asks for — **already tool-agnostic, already guarded against
overstatement, and already load-bearing enough that a six-round review defect in it was fixed.**
The change does not invent a notion of productivity; it reads the one the tools already compute
and currently throw away.

All six real tools build results through `newData()` and return `{ success: true, data: {…} }`
(`PaToolAgentConfig`, `PaToolAgentTrace`, `PaToolGenAiLog`, `PaToolLogAnalysis`, `PaToolQueryTable`,
`PaToolSchemaLookup` — grep `CONTRACT (LLD §4)` in each). The seventh, `PaToolReadArtifact`,
delegates to `PaArtifactStore.read` and has no `reads` map; see §2.4.

### 2.2 The contract

Pure. No Glide, no audit query, no side effects — same discipline as `PaFixReport.toolFanOut()`.

```
retrievalVerdict(result) -> 'ok' | 'none' | 'unknown'
```

| Verdict | Condition |
|---|---|
| `'ok'` | `result` is a plain object, `result.success === true`, `result.data` is a plain object, `result.data.reads` is a plain object, and **at least one own value equals `'ok'`** |
| `'none'` | `result` is a plain object and `result.success === false`; **or** a readable `reads` map containing no `'ok'` |
| `'unknown'` | `result` is absent or not a plain object; **or** `success === true` with no readable `reads` map |

**Three values, not a boolean.** A row that was never classified must be distinguishable from a row
classified as barren. Collapsing `unknown` into `false` is the R-6 failure shape — a blank read as
a fact — aimed at the instrument this change exists to make honest.

`success === false` is `'none'` rather than `'unknown'`: an error envelope is a definite statement
that nothing came back, not an inability to tell.

### 2.3 Regression anchors — the two cases the issue names, as tests

| Input shape | Source | Verdict |
|---|---|---|
| `{success:true, data:{table_exists:false, finding:'table_does_not_exist', reads:{sys_db_object:'empty'}}}` | §T4 row 07 | `'none'` |
| `{success:true, data:{entries:[], llm_call_rows:0, reads:{sys_generative_ai_log:'empty'}}}` | §U9.1 r2-2 | `'none'` |
| `{success:true, data:{llm_call_rows:3, reads:{sys_generative_ai_log:'ok'}}}` | §U9.1 v10-2 | `'ok'` |

### 2.4 Two accepted limits, named rather than buried

**A false negative.** `PaToolQueryTable`'s `rows_exist_but_are_not_visible` finding — a
`GlideAggregate` count above zero against a `GlideRecordSecure` read of zero — establishes a real
ACL fact while leaving `reads` at `'empty'`. It scores `'none'`. The predicate therefore
**under-counts retrieval**. That is the safe direction for a release gate (a false negative costs a
hold, bounded by `MAX_HOLDS: 2`) and the safe direction for a numerator that has twice flattered
the change it measures.

**`read_artifact` scores `'unknown'`, and it never matters.** It builds no `reads` map. It also
appears in **no layer** of `PaFixReport._layerToolMap()`, whose seven layers between them name only
six tools — `agent_trace`, `genai_log`, `log_analysis`, `agent_config`, `schema_lookup`,
`query_table` — so it can never enter `_heldTools`
and can never be the tool a release turns on. Its verdict is recorded for completeness and is not
load-bearing.

---

## 3. Storage — one new audit column

### 3.1 Why the verdict cannot be re-derived post-hoc

`PaToolRegistry.dispatch` calls `this._store().applyThreshold(...)` **before** `this._audit('logResult', ...)`.
Past `THRESHOLD_CHARS`, `applyThreshold` returns a different object entirely —
`{success, truncated:true, tool, total_length, artifact_id, page_size, pages, excerpt, note}` — in
which `data.reads` may not appear at all. `PaAuditLogger` then digests anything past
`MAX_PAYLOAD_CHARS: 4000` to head 3,000 + tail 1,000, and its own header states the consequence:

> *"A value in the elided middle is absent here while being present in what the model actually
> received. So a HIT is evidence; a MISS is not evidence of absence."*

**The largest results are the most likely to be productive and the most likely to lose the
evidence.** A predicate that parsed `output` after the fact would systematically score productive
calls as barren — the same by-label-not-by-fact defect, relocated.

So the verdict is computed where the undigested result exists, and stored.

### 3.2 The column

`x_snc_troubleshoot_audit.retrieval` — `ChoiceColumn({ ok, none, unknown })`, no default.

**Blank means a pre-#121 row.** No default is deliberate: the eight §U9.1 runs already on the
instance must not read back as a mechanical `none`. That 1-of-4 was derived by hand and stays
labelled as one.

Written on `logResult` rows only. `logIntent` has no result to classify; `logError` already carries
its failure in `output` and adding a redundant `none` would invite a reader to count error rows in
a denominator built from result rows.

Fluent change in `src/fluent/tables.now.ts`, Build Rule #8 (`{ value_key: 'Label' }`) applies.

### 3.3 Write path

Both call sites compute the verdict on the **raw** `core.execute(args)` result, before
`applyThreshold`:

- `PaToolRegistry.dispatch` (the custom loop's path)
- `PaScriptToolAdapter` (the native agent's script-tool path)

and pass it through as `logResult({ runId, toolName, output, retrieval })`.

`PaAuditLogger._normParams` whitelists the three values; **anything else writes blank**, never the
raw string. A ChoiceColumn accepts an unlisted value silently, so the guard belongs on the writing
side.

Both call sites keep the existing `_audit` try/catch. The verdict computation is wrapped so a throw
inside the predicate degrades to `'unknown'` and never takes a tool call down with it — the
property `PaAuditLogger`'s header calls the one that matters most.

### 3.4 Read path

`PaAuditLogger.invokedTools(runId)` gains one field:

```
{available: true, tools: [...], retrievingTools: [...]}
{available: false, degraded: <reason>, tools: [], retrievingTools: []}
```

`retrievingTools` is the subset with **at least one result row at `retrieval === 'ok'`**. Same
single query, one extra `getValue` per row. `tools` is unchanged, so `_auditContext`'s #79 citation
cross-check is untouched by this change.

`PaAgentLoop._trailTools` mirrors it: `{readable, tools, retrieving, degraded}`, with `retrieving`
empty on every degraded path exactly as `tools` is.

---

## 4. The gate — shipped dormant

### 4.1 The switch

```
PaAgentLoop.REQUIRE_RETRIEVAL_TO_RELEASE: false
```

settable via `initialize({ requireRetrievalToRelease: true })` with a strict `=== true` test.
Deliberately **not** the `>= 0` shape used by `maxEvidenceReturns`, which #121's comment showed
accepts `null` (`null >= 0` is `true`).

**Why dormant, per §U9's precedent.** §T9 calls the retrieval-aware release rule *"the obvious next
candidate"* and immediately adds *"whether it helps is unmeasured"*. §U9 ruled, one version ago,
that *"No verdict is not the same as proven, so the default is off"*. Turning this on by default
would change an instrument that eight passes of measurement are calibrated against, on no evidence,
in the same week that ruling was made.

**And the dormancy is not inert.** The audit column is written on **every** run regardless of the
flag. So the next round — whatever it is run for — measures for free how often the tightened rule
would have changed a release, on runs that were happening anyway, before anything is turned on.
That is the cheapest possible route to the evidence §T9 says is missing.

### 4.2 Where the release set is consumed

One private helper:

```
_releaseSet: function (trail) {
    return this.REQUIRE_RETRIEVAL_TO_RELEASE === true ? trail.retrieving : trail.tools
}
```

Consumed in **both** places `_depthGate` reads the trail:

1. The sticky release check (`_depthGate`, the `sticky && this._anyOf(this._heldTools, …)` branch).
2. `_openGaps(this._safeGaps(action.report), …)` — the first-hold derivation.

Both, not just the first. A gap is open unless a tool that *retrieved* closed it; using the strict
set in the release check while deriving gaps from the loose one would let a cosmetic call pre-close
a gap before any hold could be issued — the identical defect, one step earlier.

Everything else in `_depthGate` is untouched: the `_gateReleased` short-circuit, the unreadable-trail
fail-open, the I2 non-empty-array guard, R1's trail-before-cap ordering, R2's cap position, and the
`no_layer_report` path all stand as written.

### 4.3 Two decided residues

**`_step`'s optimistic `_holdActive = null` still clears by tool name.** When the model dispatches a
tool in the recorded release set, `_step` clears the hold block immediately so the next prompt does
not still say *"a terminal action is not available yet"*. Under the strict flag that clear can fire
on a call that retrieved nothing.

It stays as it is. It affects **prompt wording only** — the real trail-backed check still runs at
the next terminal action, and the comment already there says so explicitly (*"`_depthGate` still
does the real (trail-backed) release check"*). Making it retrieval-aware would mean plumbing the
pre-threshold verdict back out of `_dispatchTool`, which returns the post-threshold result, for a
cosmetic gain. Recorded here so a future reader finds a decision rather than an oversight.

**`_auditContext` keeps using `tools`, not `retrievingTools`.** #79's citation cross-check asks
"was this tool ever invoked in this run", which is the question fabrication fails. A citation to a
tool that was called and returned nothing is a *weak* citation, not a *fabricated* one, and
conflating the two would convict on the wrong charge. Out of scope, and deliberately so.

---

## 5. The metric — `DECISION.md` §V

A new append-only section, in the §U style, filed as a pre-registration. §U1–§U9 are not modified;
`git log -p benchmark/DECISION.md` remains the check.

It records:

- **The amended numerator.** A gathering call counts toward `N` only when its
  `x_snc_troubleshoot_audit` result row carries `retrieval = ok`. `N` becomes one encoded query —
  `run=<sys_id>^action_type=result^retrieval=ok` — rather than a payload read subject to §3.1's
  digest problem.
- **The number to beat is 1 of 4** (§U9.1), not 2 of 4.
- **Pre-#121 rows are blank and cannot be re-scored mechanically.** The 1-of-4 was hand-derived from
  two payloads and stays labelled as a hand derivation.
- **What is deferred:** the sized round and the cap flip, with §U8.5's warning attached — `n` sized
  against a ~½ fire rate, stopping rule fixed before the first run, no extension on a tied split.
- **That the gate change ships dormant**, and that the audit column measures the counterfactual for
  free in the meantime.

It does **not** claim any result. Nothing has been run.

---

## 6. Testing

TDD throughout. Five suites touched; two carry the design.

**`test/PaToolReadKit.test.js`** — the predicate. All three verdicts across shapes: absent input, a
non-object, `success:false`, `success:true` with no `data`, `data` with no `reads`, an empty `reads`
map, `reads` with only `empty`/`unknown`/`DENIED`, `reads` with one `ok` among several, and the
three §2.3 regression anchors verbatim. Plus: an inherited `ok` on the prototype chain does not
count (own properties only).

**`test/PaToolRegistry.test.js` and `test/PaScriptToolAdapter.test.js`** — the ordering claim from
§3.1, and this is the test the design turns on: **a productive result large enough to be replaced
by an excerpt envelope still logs `retrieval='ok'`**, even though the object the caller receives no
longer contains `reads`. Plus a throwing predicate degrading to `'unknown'` without failing the
dispatch.

**`test/PaAuditLogger.test.js`** — `retrieval` written on result rows, absent on intent and error
rows; an unlisted value writes blank; `invokedTools` returns `retrievingTools`; a blank column never
counts as `ok`; `retrievingTools` is `[]` on every degraded path; a tool with one barren and one
productive call appears in `retrievingTools` once.

**`test/PaAgentLoop.test.js`** —

- *Ships dormant:* constructed with **no** option, a barren call in the recorded set still releases
  the gate, byte-identical to today. This is the §U9 dormancy-test pattern, and it is what makes the
  change safe to merge without a round.
- *Flag on, barren call:* a `schema_lookup` at `retrieval='none'` does **not** release; the run takes
  a second hold.
- *Flag on, productive call:* the same tool at `retrieval='ok'` releases.
- *Flag on, `_openGaps`:* a barren call does not pre-close a declared gap.
- *Flag on, cap:* `MAX_HOLDS: 2` still bounds the run and still reports `capped: true`.
- *Flag on, degraded trail:* an unreadable trail still fails **open**.
- *Option guard:* `requireRetrievalToRelease: null` leaves the default at `false`.

Full suite must stay green. **Baseline measured on this branch before any edit: 1,198 passing, 26
suites** (`npx jest`, 2026-08-07). Any test that fails because
it assumed the loose rule is fixed **at the fixture**, by declaring `requireRetrievalToRelease: true`
— never by moving the production default.

---

## 7. Files touched

| File | Change |
|---|---|
| `src/server/PaToolReadKit.js` | `retrievalVerdict(result)` — new public pure method |
| `src/fluent/tables.now.ts` | `retrieval` ChoiceColumn on `x_snc_troubleshoot_audit` |
| `src/server/PaAuditLogger.js` | write `retrieval` on result rows, whitelist it, return `retrievingTools` from `invokedTools` |
| `src/server/PaToolRegistry.js` | compute the verdict pre-threshold, pass to `logResult` |
| `src/server/PaScriptToolAdapter.js` | same |
| `src/server/PaAgentLoop.js` | `REQUIRE_RETRIEVAL_TO_RELEASE`, `initialize` option, `_trailTools.retrieving`, `_releaseSet`, both `_depthGate` consumers |
| `benchmark/DECISION.md` | new append-only §V |
| `test/…` (5 suites) | per §6 |
| `package.json`, `README.md`, `CHANGELOG.md` | version bump on merge |

`now-sdk build` must pass before any install; the table change is the only artifact requiring a
deploy, and no deploy is part of this scope.
