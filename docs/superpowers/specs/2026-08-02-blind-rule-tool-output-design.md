# The blind rule must bind tool output — design

**Date:** 2026-08-02
**Issue:** #89 (blind rule does not bind tool OUTPUT — `agent_config` was emitting the smoke gate's expected answer)
**Branch:** `fix/blind-rule-binds-tool-output`
**Status:** approved, ready for implementation planning

---

## Problem

`benchmark/README.md` carries the condition that makes every score in this repo mean anything:

> The seeded-failure catalog must **not** be referenced from `docs/agent/playbook.md`. The playbook
> teaches the diagnostic method; an agent that has read the answer key is not being measured on
> anything.

The rule binds **instructions**. It does not bind **tool descriptions** or **tool output** — and
tool output is a strictly more direct channel, because it lands in the reasoning loop at the moment
of diagnosis rather than in a preamble read once at the start.

This was not a deliberate exclusion. Tool output did not exist as a channel when the rule was
written for the native harness.

**The leak that proved it.** Until `2026.08.0222`, `PaToolAgentConfig`'s
`context_processing_script_populated` finding emitted, in its `detail`:

> "…and an auto-populated body on this instance **threw at line 42**, terminating a run that
> reported state=Completed with an empty state_reason."

`benchmark/README.md`'s smoke gate expects exactly `script_error` citing `context_processing_script`
**line 42**. The tool was handing the model the gate's answer, mid-reasoning, on any agent with a
populated `context_processing_script`.

It never fired, because **no run has ever invoked `agent_config`** — 0/10 in v3, 0/10 in Task 10,
0/4 in the v4 smoke. The leak was harmless only because the harness was too shallow to reach it,
and it would have activated at precisely the moment the depth work succeeded — which is the thing
every open workstream is trying to cause.

The instance was removed by PR #87 as a side-effect of the #85 statistics sweep. **The rule is what
remains open.** The #85 audit swept for *statistics*; it never swept for *answers*.

## Goal

Close the gap between what the blind rule says and what it covers, and leave behind a guard that
fails the build the next time an answer reaches a model-facing string — so that the v4 scored pass
runs against a harness whose blindness is enforced rather than asserted.

**Non-goal: diagnostic depth.** Four of seven tools have never been invoked in twenty-five runs
(`DECISION.md` §L7). That is the milestone blocker and it is not addressed here. This work exists
because running ten more scored rows against an unswept harness would produce a number nobody can
trust — it is a precondition for the v4 pass (`DECISION.md` §J5, item 2 of 3).

---

## The three channels

Everything the harness can put in front of the model, and where each lives:

| Channel | Source | Reaches |
|---|---|---|
| Instructions | `docs/agent/agent-doctor-instructions.md` | both harnesses |
| Tool descriptions | `src/server/PaToolRegistry.js` (single-sourced), mirrored into `src/fluent/agent-doctor.now.ts` | both harnesses |
| Tool output | 7 cores in `src/server/tools/` + `src/server/PaToolReadKit.js` | both harnesses |

The rule will bind all three. Today it binds only the first.

---

## Architecture

Four changes. One new file.

```
benchmark/README.md
  ├─ "The blind rule" — pointer paragraph broadened to all three channels
  └─ smoke gate       — gains a ```blind-rule-tokens block

benchmark/seeds/seed-0{1..5}-*.md
  └─ each gains a ```blind-rule-tokens block

test/blindRule.test.js                                   ← NEW
  reads   benchmark/seeds/*.md, benchmark/README.md      (the answer key)
  scans   src/server/tools/*.js  (7)
          src/server/PaToolReadKit.js
          src/server/PaToolRegistry.js
          src/fluent/agent-doctor.now.ts
          docs/agent/agent-doctor-instructions.md
  fails   on a declared token found in any scanned file
  fails   on a seed spec with no block, or an empty one

benchmark/DECISION.md
  └─ §M — the sweep, its findings, and any native-facing edit
```

### 1. The rule text (`benchmark/README.md`)

The quoted rule stays **verbatim**. It is preserved deliberately — the file says so, and that
reasoning is unchanged. What changes is the pointer paragraph beneath it, which currently ends:

> The rule binds anything that becomes part of Agent Doctor's instructions, whatever it ends up
> being called.

It becomes: the rule binds **any text the harness can put in front of the model** — instructions,
tool descriptions, and tool output alike — with the three-channel table above, and a note naming
the two mechanical guards and the class each catches:

| Guard | Catches | Origin |
|---|---|---|
| `test/referenceStatistics.test.js` | reference **statistics** mistakable for run data | #85 |
| `test/blindRule.test.js` | **answers** — the seeded diagnosis itself | #89 |

followed by an explicit statement that the human half still governs everything neither test can
pattern-match, and that a passing suite is not evidence of blindness on its own.

### 2. Declared token blocks

Each seed spec, and the README's smoke gate, grows one fenced block:

~~~
```blind-rule-tokens
Seed 03 Category Router
x_snc_tsbench_routing_rule
rules_in_table
```
~~~

**How to choose a token.** This is the load-bearing judgement in the whole design, and it is where
the guard earns or wastes its keep:

- **✅ Declare** strings that exist only because the seed exists: fixture-scoped identifiers
  (`x_snc_tsbench_*`), seed agent and tool names (`Seed 03 Category Router`, `set_ticket_priority`),
  the seeded value or phrase (`priority_stored`, `rules_in_table`), and the specimen sys_ids.
- **❌ Do not declare** platform vocabulary a diagnostic tool legitimately reads.
  `sn_aia_trigger_configuration` is seed 05's answer *and* a table `agent_config` must query to
  sweep layer 7; `context_processing_script` is the smoke gate's answer *and* a field that same tool
  must read. Declaring either fires on honest code.
- The distinction: a token names **the answer**, not **the vocabulary of the question**. A token
  that fires on legitimate tool code is a bad token, not a finding.

Where the answer *is* platform vocabulary, declare the surrounding phrasing instead — the smoke gate
declares `line 42` and its execution sys_id, not `context_processing_script`.

Draft token sets (final selection during implementation, reviewed in the PR):

| Spec | Tokens |
|---|---|
| seed 01 | `Seed 01 Ticket Prioritizer`, `x_snc_tsbench_ticket`, `set_ticket_priority`, `priority_stored`, `priority_requested` |
| seed 02 | `Seed 02 Request Router`, `measure_request` |
| seed 03 | `Seed 03 Category Router`, `x_snc_tsbench_routing_rule`, `rules_in_table` |
| seed 04 | `Seed 04 Summarizer`, `x_snc_tsbench_unmapped_capability`, `936e514a53b3b110f028ddeeff7b128c` |
| seed 05 | `Seed 05 Ticket Acknowledger`, `Seed 05 Ticket Acknowledgement`, `Seed 05 Bench Ticket Created` |
| smoke gate | `c9d63a932bda8b9417a6ffbeee91bfd0`, `line 42` |

### 3. The guard (`test/blindRule.test.js`)

**Reads.** Every `benchmark/seeds/*.md` and `benchmark/README.md`. Parses the fenced
`blind-rule-tokens` blocks; one token per line, blank lines ignored.

**Structural assertions**, so a new seed cannot arrive unguarded:
- every file matching `benchmark/seeds/seed-*.md` has exactly one block;
- no block is empty.

**Scan targets.** The 7 tool cores, `PaToolReadKit.js`, `PaToolRegistry.js`,
`src/fluent/agent-doctor.now.ts`, `docs/agent/agent-doctor-instructions.md`.

**Explicitly not scanned**, and the distinction is the whole point: `benchmark/seed-app/**` is the
fixture that *implements* the defects, and `benchmark/**` docs *are* the answer key. Both are full
of tokens by construction and neither is model-facing. The scan covers the product app and only the
product app.

**Comment handling** mirrors `referenceStatistics.test.js` and for the same reason: comments are
stripped from `.js` and `.ts` sources, because prose *about* a leak is exactly where that knowledge
belongs and must stay writable. The instructions `.md` is scanned **whole** — all of it is
model-facing, so there is no non-model-facing half to exempt. The existing `stripComments` helper is
extracted to a shared `test/_stripComments.js` rather than copied, so the two guards cannot drift.

**Matching.** Case-insensitive substring. A failure names token, file, and line.

**No stop-list.** With tokens declared per seed, a token too generic to be distinctive simply
reddens the suite, and that failure *is* the signal to pick a better token (per the authoring rule
above). A length filter or generic-word exemption would introduce a second, silent way to be
unguarded — the exact failure mode #89 is about.

### 4. Fix policy for what the sweep finds

**Removal, not labelling.** #85 kept its numbers behind `PaToolReadKit.REFERENCE_STAT` because
`DESIGN.md` R-22 item 4 requires the denominator to travel with every stated count — deleting them
was not an option. An answer has no equivalent justification. There is no version of "the seeded
diagnosis, but labelled" that belongs in a payload.

**Native-shared leaks are fixed on discovery.** `DECISION.md` §J5/§K5 say not to move native's text
before it is re-measured (confound 3), but a leak is not a confound — it invalidates the
measurement outright rather than tilting it, and PR #87 already set this precedent by removing the
line-42 leak from shared tool output the moment it was found. Every native-facing edit is recorded
in `DECISION.md` §M, and native's standing seed 1/3/4/5 rows in `scorecard-agent-doctor.md` are
annotated as predating the fix.

---

## Expected outcome, stated in advance

Two predictions, recorded here so the implementation confirms or refutes them rather than
rationalising whatever happens:

1. **The guard may fail on first run against `docs/agent/agent-doctor-instructions.md`.** That file
   is native-shared, so a hit there opens the §J5 confound-2 conversation earlier than planned.
   Better found now than during the scored pass.
2. **The 7 cores may come back clean.** PR #87's sweep already read them once for statistics, and a
   reader looking for numbers would plausibly have noticed an agent name. A clean result is a real
   result — the guard's value is prospective, and #89's own text says the residual gap is *the rule*,
   not a known second instance.

Neither outcome changes the work.

---

## Testing

`npm test` — the suite is the deliverable, not a check on it.

- New: `test/blindRule.test.js` — token parsing, the two structural assertions (missing block, empty
  block), a positive control (a known-leaking string is caught), and the real scan.
- The positive control matters: a guard that passes because its scan silently matched nothing is
  indistinguishable from a guard that passes because the code is clean. Assert the scanner finds a
  planted token in a fixture string.
- Unchanged: `test/referenceStatistics.test.js` keeps passing after `stripComments` is extracted.

## Out of scope

- **Depth** (`DECISION.md` §K4 remedy 2, §L7) — the milestone blocker, untouched.
- **The v4 scored pass** — this is its precondition, not part of it.
- **#81's repair-turn options** — re-read them after this lands; §L6 changed their shape.
- **Runtime enforcement.** The guard is a build-time source scan. A leak assembled at runtime from
  live data would not be caught, and cannot be — a tool reading the fixture app's own tables will
  legitimately return fixture strings. The blind rule has always been about authored text.

## Ship

Issue #89 → branch `fix/blind-rule-binds-tool-output` → PR to `main`.
Version `2026.08.0227` (day-02 counter continued; the CHANGELOG's `2026-08-03` dates are UTC and
local is still 2026-08-02 — no drift). `package.json` + `README.md` badge + `CHANGELOG.md`.
