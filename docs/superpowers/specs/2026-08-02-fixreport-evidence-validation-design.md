# Fix Report evidence validation — design

**Date:** 2026-08-02
**Issues:** #78 (absence-diagnosis structurally rejected), #79 (citations checked by label, not by fact)
**Branch:** `fix/fixreport-evidence-validation`
**Status:** approved, ready for implementation planning

---

## Problem

`PaFixReport.validate` decides whether a Fix Report is acceptable. Two defects found in the
2026-08-02 benchmark re-run (`benchmark/DECISION.md` §H5, §H6) make that decision uncorrelated with
whether the report is honest.

**#79 — the evidence rule checks labels, not facts.** `_checkEvidenceRule`
(`src/server/PaFixReport.js:284`) requires every root cause to cite `trace` evidence plus at least
one of `config`/`schema`/`data`. It never checks whether the labelled source was consulted. The
label is self-asserted by the model and taken at face value. Live consequence, controller-verified
against `x_snc_troubleshoot_audit`:

| Run | Tools actually invoked | Cites | Validation |
|---|---|---|---|
| `100c89102b22cfd417a6ffbeee91bf42` | `agent_trace` only | `agent_config` | **PASSED** |
| `ebdc41942b6ac714f243fed2ce91bff1` | `agent_trace`, `read_artifact` | `agent_config` | **PASSED** |
| `a66d01182b22cfd417a6ffbeee91bf28` | genuine config reads | `config` only | **FAILED** |

Across the pass, 11 layer-sweep claims in 4 runs name a tool that was never invoked; one rejected
draft claimed all seven layers `SWEPT` on two tool calls, both reads of the same trace.

**#78 — the rule structurally rejects a correct absence-diagnosis.** Seed 05 is a defect where the
agent never ran, so no `sn_aia_execution_plan` row exists and no trace can be cited. Run
`a66d01182b22cfd417a6ffbeee91bf28` produced the correct diagnosis — right layer (7), right gate
(`sn_aia_trigger_configuration bfb77d6c64884500a80203ee029436ee`, `active=false`), right PATCH value,
both citations genuine and audit-supported. `validate` rejected it for citing only `config`.

The same rule therefore rejected a correct, honestly-cited diagnosis and accepted two fabricated
ones. The one seed the harness solved scored zero.

## Goal

A passing Fix Report should carry an evidential guarantee it does not carry today, and an honest
report should not be rejected for a label it could not legitimately have used. Until both hold, no
score computed from passing reports means much — which makes this a precondition for the depth work
that is the actual blocker (`benchmark/DECISION.md` §H8, items 1–3).

**Non-goal:** improving diagnostic depth. Four of seven tools have never been invoked in twenty
scored runs. That is a separate, harder problem, and it is deliberately not addressed here.

---

## Architecture

Three existing components change. Nothing new is created.

```
PaAgentLoop._handleFixReport(runId, report)
   │
   ├─1─ PaAuditLogger.invokedTools(runId)          ← NEW read method
   │      GlideRecord x_snc_troubleshoot_audit where run = runId
   │      → {available:true,  tools:['agent_trace','agent_config']}
   │      → {available:false, degraded:'<reason>'}
   │
   ├─2─ PaFixReport.validate(report, context)      ← context is NEW, optional
   │      context = {invokedTools: [...], auditAvailable: <bool>}
   │      existing shape checks ......... unchanged
   │      + absence-diagnosis path ...... #78
   │      + citation cross-check ........ #79a
   │      + layers_swept cross-check .... #79b
   │
   └─3─ on failure → repairPrompt(report, problems) → one repair turn → validate again
                                                      (same context, reused, not re-queried)
```

### Why `invokedTools` lives on `PaAuditLogger`

It already owns the table name, the column names, and the never-throw contract. A reader anywhere
else duplicates all three. Today nothing in the codebase reads `x_snc_troubleshoot_audit` — it is
write-only from code, though the ACLs (`src/fluent/acls.now.ts:98`) already permit read.

It returns a **tagged result** rather than a bare array because "no tools were called" and "the trail
is unreadable" must not be the same value. The first is a legitimate finding about the report; the
second must never convict anyone.

### Why the context is passed in rather than queried

Issue #79's own design note, and `PaFixReport`'s header contract: `validate` is a pure function of
its inputs. It gains a second parameter; it does not gain a dependency on the platform.

### Which audit rows count

Any `action_type` — `intent`, `result` or `error`. The intent row is written *before* execution and
is, per `PaAuditLogger`'s header, "the only evidence that survives when a tool never returns." A tool
that was called and failed still means the model looked. Whether what it found supports the claim is
the model's problem; the check answers exactly one question — *was this tool ever invoked in this
run?* — which is the question fabrication fails.

### Query cadence

Resolved once in `_handleFixReport`, reused across the repair turn. A repair turn makes no tool
calls, so re-querying returns the same set at twice the cost.

### Vocabulary coupling

The returned tool names are deduplicated and normalized the way `PaToolRegistry._normName`
normalizes them. The registry and the audit trail already share one vocabulary by construction
(`src/server/PaToolRegistry.js:25`); this check is the first thing that would break if they drift,
which is a feature.

---

## Rule changes

### #78 — the absence-diagnosis path

Stated as an **additional** way to satisfy the evidence rule, never a stricter one, so nothing that
passes today can newly fail:

```
evidence rule passes if EITHER
  (A) >= 1 trace citation AND >= 1 non-trace citation          (today's rule, untouched)
  OR
  (B) layers_swept["1"].status == "UNAVAILABLE"
      AND >= 2 DISTINCT non-trace sources                      (new)
```

The "two independent sources" property the rule exists for is preserved. Only the privileged status
of the `trace` label is relaxed, and only where the report has declared on the record — with a
`reason` that `_checkLayersSwept` already makes mandatory for any non-`SWEPT` layer — that no trace
exists.

A `trace` citation in mode B is not rejected; it simply does not count toward the two distinct
non-trace sources. Because B is an alternative rather than a replacement, a report citing
trace-plus-one still passes via A regardless of what layer 1 says.

**This change alone does not rescue seed 05's rejected report.** That report cited two `config`
entries — one distinct source — so it still fails B. What changes is that the correct diagnosis
becomes *expressible*: the model can satisfy B by citing the trigger config plus a schema or data
read, where today no citation set could have passed. The `schemaText` change below is what tells it
so.

### #79a — citation cross-check

Inserted into `_checkEvidenceEntries` (`src/server/PaFixReport.js:252`), already the shared iterator
for both `root_causes[].evidence` and `inconclusive.evidence_read`, so one insertion covers both
paths. `evidence_read` is checked identically — it is the most directly falsifiable claim in the
schema, since it literally asserts "I read this."

```
trace  ← agent_trace, genai_log, log_analysis
config ← agent_config, genai_log
schema ← schema_lookup
data   ← query_table, log_analysis
```

A citation passes if **any** tool in its set appears in `invokedTools`. The map is deliberately
permissive: the goal is to stop fabrication, not to add new pedantry — which is the exact failure
mode #78 exists to fix. `genai_log` supports `config` because seed 03's answer (a dangling `api`) is
found through it and is legitimately configuration evidence; a strict 1:1 map would reject that
honest citation.

**`read_artifact` supports nothing on its own** — corrected 2026-08-02, during implementation, from
an earlier version of this spec that made it a wildcard for every source. Artifacts are created only
inside `PaToolRegistry.dispatch` (`src/server/PaToolRegistry.js:267`) and
`PaScriptToolAdapter.invoke` (`src/server/PaScriptToolAdapter.js:135`), both of which write an audit
`intent` row for the producing tool *before* the call. So within a run, `read_artifact` can only page
an artifact whose producing tool is **already in the trail**. That makes the wildcard redundant when
the citation is honest — the producer supports it directly — and a blanket pass for all four sources
when it is not. Under the wildcard, the re-run's worst draft (all seven layers `SWEPT` on
`agent_trace` + `read_artifact`, both reads of the same trace) passed both cross-checks: precisely
the draft #79b exists to catch. Nothing honest is lost by dropping it.

The problem text names the unsupported source and the tools that would support it, so the repair
turn can either go get the evidence or drop the claim.

### #79b — layers_swept cross-check

The layer→tool map extends `PaRunManager._collectionTools` (`src/server/PaRunManager.js:511`) with
the one tool it does not cover (`log_analysis`). `read_artifact` supports nothing here either, for
the same reason it supports nothing in the citation map above — it is never a wildcard.

```
1 Execution trace   ← agent_trace, genai_log, log_analysis
2 Instructions      ← agent_config
3 Tool definitions  ← agent_config
4 Data schemas      ← schema_lookup
5 Data              ← query_table, log_analysis
6 GenAI stack       ← genai_log, log_analysis
7 Trigger + wiring  ← agent_config
```

*(Layer 5 corrected 2026-08-02, final whole-branch review finding 2: it is the same concept as the
`data` citation source below and had drifted from it — a `log_analysis` read was valid `data`
evidence but not a valid layer-5 sweep, which could reject an honest sweep performed with a real
tool call. Layer 1 was already deliberately kept aligned with `trace`; layer 5 now is too.)*

`read_artifact` is absent here for the same reason it is absent from the citation map above.

**The two maps are separate by design, not duplicates.** Layers are finer-grained than the four
evidence sources — layers 2, 3 and 7 all correspond to the `config` source but each is answered by a
specific section of `agent_config`'s output. Layers 1 and 5 are kept aligned with the `trace` and
`data` sources respectively (same concept, same tool set); the rest are layer-specific. Neither map
is derived from the other.

Only `SWEPT` is checked. `NOT_SWEPT` and `UNAVAILABLE` are claims of *not* having looked, already
priced by their mandatory `reason`.

**One problem, not seven.** All unsupported sweep claims collapse into a single `problems` entry
listing them together. The re-run's worst draft claimed all seven layers `SWEPT` on two tool calls;
per-layer problems would put five near-identical entries into a repair prompt that also carries the
citation problems, and burying the signal is how a repair turn gets wasted.

**Interaction with the existing citation-per-sweep pricing** (`_checkInconclusive`,
`src/server/PaFixReport.js:390`) is deliberate — both stay. `_countSweptLayers` prices honest sweeps;
the audit check falsifies dishonest ones. A report can no longer dodge the price by inflating its
sweep claims.

---

## Failure modes

### Fail open, and say so

The #79 checks run **only** when `context.auditAvailable === true` and `context.invokedTools`
normalizes to a **non-empty** list of tool names. Anything else — no second argument, a malformed
context, `auditAvailable` absent or falsy, or an `invokedTools` array that is empty or contains only
blanks — skips both checks entirely and runs today's rules unchanged. The flag is tested for explicit
`true` rather than truthiness so that a missing flag fails toward *not* checking. A degraded audit
trail must not convict an honest report. #78's mode B does not depend on the audit trail and stays
active in every case.

*(Empty-array case corrected 2026-08-02, final whole-branch review finding 3: `auditAvailable:true`
with `invokedTools:[]` originally still counted as "enabled," and an enabled check with nothing in
its allow-list matches no citation and no sweep claim — every check fails CLOSED at once instead of
skipping. Not reachable from `PaAgentLoop` today, since `invokedTools()` only reports
`available:true` when it found at least one tool, but `validate` is public and this branch's own
on-instance verification step builds a context by hand.)*

The critical corollary: **a skipped check must be visible, or a passing report's evidential guarantee
is unfalsifiable.** When the trail is unavailable, `_handleFixReport` appends a transcript entry
naming the degradation reason. Without it, the next benchmark cannot distinguish "citations verified"
from "citations unverified" — reintroducing, one layer down, the exact ambiguity #79 exists to
remove.

### `invokedTools` discipline

Inherits `PaAuditLogger`'s existing contract:

- total on any input including none (R-9: `runId` may be absent, or arrive as a non-string);
- never propagates a throw;
- never touches the exception object in a catch (R-1 — reading `.message` off a
  `ScopeAccessNotGrantedException` throws again and escapes the handler);
- zero rows returns `{available:false, degraded:'no audit rows for run'}` rather than an empty array,
  because a run that reached a fix report necessarily called at least one tool. Zero rows means the
  trail failed, not that the model was idle.

### Problem-text anchors

`_checkEvidenceRule`'s existing convention is that every problem it raises contains the literal
phrase `evidence rule`, so a repair prompt — or a human — can find it without re-deriving which entry
failed. The new checks follow it with their own stable phrases: **`unsupported citation`** for #79a
and **`unsupported sweep claim`** for #79b. Tests anchor on these literals, and they must not drift
without updating the tests that assert them.

### Backward compatibility

`validate(report)` with one argument keeps working: today's rules plus #78. Every existing test and
caller is unaffected by construction, and the second parameter is optional.

---

## Contract text (`schemaText`)

`schemaText()` (`src/server/PaFixReport.js:542`) is the only description of the rules the model ever
sees. Judging a report against rules it was never told is the #78 defect in a new costume. Three
additions:

- a citation must name a source you actually read **with a tool, in this run** — unsupported
  citations are rejected;
- a layer marked `SWEPT` must have a tool call behind it;
- if no trace exists, mark layer 1 `UNAVAILABLE` with a reason and cite two distinct non-trace
  sources.

**This is a benchmark confound and must be recorded as one.** `benchmark/DECISION.md` §H7-3 already
notes that the contract text changed between the 0/10 and 1/10 passes, blocking clean attribution of
that movement. This branch changes it again. The same limitation must be written into whatever
section reports the next measurement — stated up front, not discovered afterward.

---

## REST change (#78 side-defect)

A rejected draft **is** written to `x_snc_troubleshoot_run.fix_report` by `_finishFailedFixReport`
(`src/server/PaAgentLoop.js:361`), and the validation problems are persisted inside the same row's
`error` text. But `PaRestHandlers.js:279` gates on status — `run.status === 'complete' ?
parse(run.fix_report) : null` — so the correct diagnosis was invisible to every API consumer.

Add a sibling field rather than loosening the existing one:

```
GET /runs/{id}
  fix_report:          <validated report>  |  null      ← unchanged semantics
  fix_report_rejected: {report, problems}  |  absent     ← new, non-complete runs only
```

`fix_report` keeps meaning "a report that passed validation" — that is what the `null` was
protecting, and loosening it would let a consumer treat a rejected draft as a diagnosis. `problems`
is parsed back out of the persisted `error` text. **No table change and no migration are required.**

---

## Testing

TDD — tests first, then implementation.

### `test/PaFixReport.test.js`

Pure unit tests; `context` is a plain object, no Glide stub needed.

| Case | Expect |
|---|---|
| #78 layer 1 `UNAVAILABLE` + 2 **distinct** non-trace sources | valid |
| #78 layer 1 `UNAVAILABLE` + 2 **same** source (`config`,`config`) | **invalid** — seed 05's actual shape; the relaxation is not a giveaway |
| #78 layer 1 `SWEPT` + config only | invalid — mode B not triggered |
| #78 monotonicity: trace + config, layer 1 `UNAVAILABLE` | valid via mode A |
| #79a citation whose source has no supporting tool | invalid; problem names the source and the supporting tools |
| #79a `config` cited, only `genai_log` invoked | valid — the permissive map earns its keep |
| #79a same check on `inconclusive.evidence_read` | invalid |
| #79b layer `SWEPT` with no supporting tool | invalid; **exactly one** problem listing all such layers |
| #79b `NOT_SWEPT` / `UNAVAILABLE` with no tool | valid — never checked |
| `auditAvailable:false` | both #79 checks skipped; today's rules only |
| `validate(report)` one-argument | identical to today, plus #78 |

### `test/PaAuditLogger.test.js`

`invokedTools`: deduplicates repeated calls; counts `intent`, `result` and `error` rows alike;
absent or non-string `runId` degrades rather than throwing; zero rows returns `available:false`; a
throwing `GlideRecord` degrades without touching the exception object.

### `test/PaAgentLoop.test.js`

The trail is queried **once** and the same context is reused across the repair turn; a degraded trail
appends the transcript entry naming the reason.

### `test/PaRestHandlers.test.js`

`fix_report_rejected` present on a failed run carrying a stored draft, absent on a complete run;
`fix_report` still `null` on failed runs.

### Regression as the monotonicity proof

The existing suite must stay green untouched. #78 is specified as a widening, and #79 only activates
with a context argument no existing test passes — so any existing test that breaks is a design
violation, not a test to update. It is the cheapest available check on the claim that nothing which
passes today newly fails.

### Live verification on gpinst01 (merge gate)

1. `now-sdk build` → `now-sdk install --alias gpinst01`.
2. Run seed 05; confirm a correct absence-diagnosis now validates.
3. Deterministic fabrication check: invoke `PaFixReport.validate` on-instance with a known-fabricated
   report plus the **real** audit context of a real run, and confirm rejection. This tests the
   deployed code against real audit rows without depending on model behaviour.

**Explicitly deferred:** the full 10-run benchmark re-run, which per §H7-4 is only worth running
paired with a same-day native re-measurement. That is its own session.

---

## Success criteria

- [ ] A correct absence-diagnosis with two distinct non-trace sources validates.
- [ ] A citation naming a tool the run never invoked fails validation and names the unsupported
      source.
- [ ] A layer marked `SWEPT` with no supporting tool call fails validation, in one collapsed problem.
- [ ] A degraded or unreadable audit trail skips the cross-checks and records the degradation in the
      transcript.
- [ ] The existing Jest suite passes unchanged.
- [ ] A rejected draft is retrievable from `GET /runs/{id}` as `fix_report_rejected`.
- [ ] Both behaviours verified live on gpinst01.

## Out of scope

- Diagnostic depth (§H8 item 3) — the four never-invoked tools.
- The 10-run benchmark re-run and its same-day native baseline.
- `fix_report_markdown` on `GET /runs` (separately tracked; see `PaAgentLoop.js:334-341`).
