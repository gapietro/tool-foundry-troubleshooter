# Design — the prompt-facing observation channel (issue #72) + earned-inconclusive Fix Reports (T4)

**Date:** 2026-08-02
**Issue:** [#72](https://github.com/gapietro/tool-foundry-troubleshooter/issues/72) (bundles ledger items T4 and T6)
**Branch:** `fix/phase1b-observation-channel`
**Phase:** 1b, post-comparison remediation

---

## 1. The problem

The custom harness's only feedback path from a tool call back to the model is the run transcript,
and that transcript is digested to 200 characters per entry before the model sees it again:

- `PaAgentLoop._dispatchTool` appends the tool's result to the transcript (`src/server/PaAgentLoop.js:258-263`).
- `PaRunManager._normalizeEntry` runs every `result_digest` through `_digest()`, truncating at
  `DIGEST_CHARS = 200` (`src/server/PaRunManager.js:256-257`, `_digest` at `:831-835`).
- `PaAgentLoop._buildPrompt` renders only that digested transcript into the next reasoning prompt
  (`src/server/PaAgentLoop.js:434-467`).
- The full result object is otherwise discarded — `_step()` returns `{terminal:false}` without it
  (`:234-235`).

`PaArtifactStore.MAX_PAGE_CHARS` is 4,000, so a `read_artifact` page is crushed 20:1 before the
model can reason over it. This is the leading identified mechanical cause of the Phase 1b comparison
benchmark's 0/10 result (`benchmark/DECISION.md` §G3a): all ten rows called exactly two tools
(`agent_trace` once, `read_artifact` for one page) before producing a Fix Report or failing
validation.

**T4, bundled.** `PaFixReport._checkRootCauses:199` and `_checkFixes:293` hard-require at least one
entry each. A report that honestly says "I could not reach a conclusion" is therefore structurally
rejected, which pressures the model toward fabrication rather than an honest partial answer — the
same failure family as the starvation above, and consistent with the benchmark's observed
fabricated-evidence mode.

**T6, bundled.** `src/fluent/async-wiring.now.ts`'s DEFERRED comment block justifies not wiring
`PaRunManager.maybeSummarize` partly on the 200-char digest premise (worst case ~15 × 2 × 200 =
6,000 chars against the `transcript` column's 65,536-char ceiling). Raising the prompt-facing
threshold invalidates that arithmetic, so it is re-derived here.

## 2. Success criteria

Optimize for **honest re-measurement**, not for a passing score. The goal is to remove the
identified mechanical defect and re-measure, whatever the number. A custom-harness score of 3/10
with real cited evidence is a legitimate, publishable result; the `DECISION.md` verdict stays open
until the number is in. Design decisions are made on "is this the right mechanism", not "will this
raise the score", and the confound surface entering the re-run is kept minimal and stated.

Done means:

1. A >200-character tool payload demonstrably survives into the *second* reasoning prompt, proven by
   an integration test over a real `PaRunManager` (not the digest-blind `fakeRunManager`).
2. An honest inconclusive Fix Report validates, but only when it cites what was actually read.
3. The worst-case transcript row size is re-derived and guarded by a test.
4. The 10-row benchmark is re-run against the custom harness and the result written up, whatever it
   is.

## 3. Approach chosen, and the two rejected

**Chosen — dual threshold, persisted, with a rolling window.** `PaRunManager` writes a second,
larger `prompt_digest` alongside the existing 200-char `result_digest`, and prunes it off all but
the newest few entries so the row stays bounded. `PaAgentLoop` renders `prompt_digest` when present.

**Rejected — in-memory carry-through of the last dispatch only.** Smallest diff and zero row-size
risk, but it shows only the single newest result in full: page 2 of an artifact would arrive whole
while page 1 collapsed back to 200 characters, defeating the accumulate-across-pages behavior this
work exists to enable.

**Rejected — in-memory rolling window of K results.** Fixes the paging problem without a
`PaRunManager` change, but shares the decisive flaw with the option above: what the model actually
saw is not reconstructible from the run row. `DECISION.md` §G3 derived its findings from the audit
trail — "audit-derived, not assumed" — and this product is itself an evidence tool. Persisting the
prompt-facing text is what lets the next analysis be derived rather than inferred.

## 4. Components

### 4.1 `PaRunManager` — the second threshold

Two new constants:

| Constant | Value | Rationale |
|---|---|---|
| `PROMPT_DIGEST_CHARS` | `8500` | **Corrected in final review — see note below.** Sized against the JSON-stringified dispatch envelope (what is actually digested), not the bare page: escaping can nearly double a page's length (measured up to 2.01x pathological), so the ceiling sits above the measured 8,057-char worst case plus envelope-key variance, guaranteeing one full `read_artifact` page survives intact regardless of content. |
| `PROMPT_WINDOW` | `3` | Number of most-recent tool entries that retain `prompt_digest`. |

**Correction, final review (2026-08-02).** The original rationale above — "deliberately equal to
`PaArtifactStore.MAX_PAGE_CHARS`, so exactly one page survives intact" — was found FALSE in final
review, before this branch shipped. `PaAgentLoop._dispatchTool` digests `this._toText(result)`, the
JSON-stringified **envelope** (`{success, data:{content, offset, next_offset, total, has_more,
...}}`), not the bare page. JSON escaping (`"` -> `\"`, newline -> `\n`) plus the envelope's own
~200 chars of keys means a full 4,000-char page is not guaranteed to survive a 4,000-char cut —
measured expansion ranged from 1.08x (log-like text) to 2.01x (pathological all-quotes content,
4,000 chars -> 8,057). Worse, `next_offset` precedes `content` in the envelope's key order, so it
always survives a cut that drops the content tail — the model reads a `next_offset` that looks
valid and pages onward believing it read contiguously, with no signal that a chunk of the prior
page never reached it. `PROMPT_DIGEST_CHARS` was raised to 8,500 to close that gap; the row-size
arithmetic in §4.4 is re-derived accordingly.

`_normalizeEntry` gains one narrow rule. When **all** of the following hold, it additionally writes
`out.prompt_digest`:

- `actor === 'tool'`, and
- `result_digest` is present, and
- the raw text length exceeds `DIGEST_CHARS` (below that it would merely duplicate `result_digest`).

`prompt_digest` is truncated at `PROMPT_DIGEST_CHARS` using the same `...[+N more chars]` marker
`_digest` already emits, so truncation is never silent. It is **not** written for `llm` or `system`
actors, and **never** for `args_digest` (model-authored, already small). The existing 200-char
`result_digest` is written unchanged on every entry — the polling UI and audit path this table was
sized around are unaffected.

`prompt_digest` is **derived, never accepted**. A caller-supplied `entry.prompt_digest` is ignored
exactly as any other unknown key is; `_normalizeEntry` computes it from `result_digest` or not at
all. This keeps the ceiling unforgeable from the loop side.

`appendTranscript` prunes after pushing: walk the list newest-first, count entries that **carry a
`prompt_digest`**, and delete the field from every such entry past the newest `PROMPT_WINDOW`. The
window is over entries that have the field, not over tool entries generally — a short tool result
that never got one does not consume a slot. Bounding the row is the append path's job, not something
delegated to an assumption that the loop stays short.

Two comments describing the transcript entry shape go stale with this change and are updated in the
same commit: `PaRunManager`'s header CONTRACT block (the `entry:` line), and the comment above the
`transcript` column in `src/fluent/tables.now.ts:198-200`. The latter is a comment-only edit to a
Fluent file — no column change, so no schema impact on install.

### 4.2 `PaAgentLoop` — render what was kept

`_renderTranscript` prefers `prompt_digest` over `result_digest` when present. When the large value
is used, the entry renders as a block rather than crammed onto the single `#N [tool:x] result=...`
line:

```
#3 [tool:read_artifact] args={"artifact_id":"..."}
result:
<up to 4,000 chars>
```

Entries without `prompt_digest` render exactly as they do today. A row written before this change
therefore still renders correctly (R-9: every input may be absent).

No other `PaAgentLoop` change. `_step()` and `_dispatchTool` keep their current shapes; the fix
lives in what is persisted and what is rendered, not in new loop state.

### 4.3 `PaFixReport` — earned inconclusive

`root_causes: []` validates **only** when `report.inconclusive` is present and valid:

- `inconclusive.evidence_read` — non-empty array of `{source, detail}`, reusing the existing
  `trace | config | schema | data` vocabulary and the same per-entry checks `root_causes[].evidence`
  already applies. These are the teeth: an honest exit still has to cite what it actually read.
- `inconclusive.needed_to_conclude` — non-empty string naming what would be required to conclude.

Additional rules:

- `fixes: []` is permitted only when `root_causes` is also empty. A named root cause with no
  proposed fix remains a validation error.
- `verification` becomes optional on the inconclusive path only — there is nothing to verify — and
  renders as `(not applicable — inconclusive)`.
- `layers_swept` needs **no change**: all seven layers present, with a `reason` on every `NOT_SWEPT`
  and `UNAVAILABLE`, is already enforced (`_checkLayersSwept:160-191`). That existing requirement is
  most of what makes the inconclusive path more expensive to write than a real diagnosis of a seed
  the model actually solved, which is the property that keeps it from becoming a cheap early exit.
- `renderMarkdown` gains an INCONCLUSIVE section. `root_causes` and `fixes` already render `(none)`
  (`:482`, `:501`).

**A deliberate confound, stated up front.** The escape hatch only works if the model knows it
exists, so `PaAgentLoop._fixReportContract()` and `PaFixReport.repairPrompt()` must both describe
it. That is a prompt-text change entering the re-run. It is unavoidable given the T4 requirement,
and it is recorded as a named confound in the §H addendum rather than glossed over.

### 4.4 Row-size arithmetic (the T6 re-check)

**Re-derived in final review** for `PROMPT_DIGEST_CHARS = 8,500` (was 4,000 — see the §4.1
correction). Worst case under `MAX_ITERATIONS = 15`, two transcript entries per iteration:

| Component | Count | Each | Subtotal |
|---|---|---|---|
| Baseline entries (200-char `result_digest`/`args_digest` + JSON overhead) | 30 | ~400-600 | ~12,800 |
| `prompt_digest` retained by the window | 3 | 8,500 | 25,500 |
| **Total (projected)** | | | **~38,300** |

The "T6 row-size bound" test in `test/PaRunManager.test.js` runs the real append path against a
synthetic worst case and **measures** 38,340 characters — matching the projection, not merely
assumed. Against the `transcript` column's 65,536-char ceiling (`tables.now.ts`), that leaves
roughly 1.7× headroom (down from the ~2× the superseded 4,000-char ceiling gave, but still
comfortable, and the test's own 40,000-char assertion has ~1,660 chars of slack above the measured
value). T6's conclusion — deferring the `maybeSummarize` wiring is safe for Phase 1b's bound —
therefore still holds, on this re-derived and measured arithmetic. The DEFERRED comment block in
`src/fluent/async-wiring.now.ts` is updated to cite these numbers, and the bound remains guarded by
that same test so it cannot go stale silently again.

## 5. Testing

Test-first, per the project's TDD requirement.

**The test the issue mandates.** One integration test wiring a real `PaAgentLoop` to a real
`PaRunManager` over `_glideStub` — explicitly not `fakeRunManager` (`test/PaAgentLoop.test.js:57-75`),
which copies entries verbatim and would pass regardless of whether the fix works. It dispatches a
~3,000-character tool payload and asserts that payload survives into the **second** prompt handed to
`PaLlmProxy.reason()`.

**`PaRunManager` units.** `prompt_digest` is written for long tool results; not written for results
at or under 200 chars; not written for `llm` or `system` actors; never written for `args_digest`;
pruned to the newest `PROMPT_WINDOW` entries as the transcript grows; and `result_digest` remains
exactly 200-char-truncated on every entry.

**`PaFixReport` units.** Empty `root_causes` + empty `fixes` with a valid `inconclusive` block
validates; the same report without the block is rejected with a named problem; empty `fixes` with
non-empty `root_causes` is rejected; an `evidence_read` entry with a source outside the vocabulary
is rejected; `renderMarkdown` emits the INCONCLUSIVE section and the `(not applicable)` verification
line.

**Row-size guard.** A test that builds a worst-case 15-iteration transcript through the real append
path and asserts the serialized JSON stays under a stated ceiling — encoding §4.4 as an executable
check rather than a comment.

## 6. Verification and the re-run

1. `npm test` green.
2. `now-sdk build`, then `now-sdk install --alias gpinst01`.
3. Re-verify the seed fixtures per `benchmark/README.md` before scoring anything: seed 5's second
   activation gate (`sn_aia_trigger_agent_usecase_m2m.active`) and seed 4's capability sys_id.
4. Re-run 5 seeds × 2 runs through `/analyze` against the **custom harness only**. The native
   scorecard (8/10) is already recorded against unchanged seeds; re-measuring it would mostly
   re-spend assist units. Surviving confounds are stated in the write-up rather than spent away.
5. Fill `benchmark/scorecard-custom-harness.md`.
6. Write `benchmark/DECISION.md` §H — the post-fix comparison, against the recorded native 8/10,
   with the §4.3 prompt-text confound named.
7. Version bump (`package.json`, README badge) + `CHANGELOG.md` per CLAUDE.md, PR into `main`. No
   direct commits to `main`.

## 7. Explicitly out of scope

- **No playbook or agent-instructions edit.** Playbook v2 was already in effect, on the same shared
  `Agent Doctor` instructions record, for all ten benchmark rows (`DECISION.md` §G2 item 3,
  live-verified against `sys_generative_ai_log`). Editing it now would confound the one variable
  under test.
- **No loop-policy knob** such as a minimum-tool-call floor before an inconclusive report is
  accepted. Considered and rejected: it would itself be a confound in the re-run.
- **No change to `DIGEST_CHARS`.** The 200-char digest exists for the UI/audit path and stays.
- **Issues #73, #74, #75** (stuck-run transition, REST hardening, audit-trail gap) are separate work
  and are not touched here.
