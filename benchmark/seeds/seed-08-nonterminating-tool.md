# Seed 08 — non-terminating tool contract

| | |
|---|---|
| **Expected root-cause layer** | `tool_definition` (layer 3) |
| **Expected fix target** | the **tool's output contract** — make `check_processing_status` capable of returning a terminal status, or bound the poll inside the script. **Not** the instruction — see Decoys |
| **Fluent source** | `../seed-app/src/fluent/seed-08-nonterminating-tool.now.ts` |
| **Agent name** | Seed 08 Batch Watcher |
| **Also stresses** | run duration and LLM cost — the most expensive seed in the set per execution |

## The defect

> **Fixture state, verified live 2026-08-11.** Seed execution
> `fd8503432b2e0310f243fed2ce91bf70`: **27 calls** to `check_processing_status`,
> every one returning the same `{"status":"in_progress","percent_complete":50}`,
> across **7m18s** (17:54:02 → 18:01:20 UTC) and ~54 LLM turns. Observed, not
> predicted.

The agent is told to poll a batch job until it reports a terminal status. The
tool's **description promises one** — *"returns in_progress while work continues
and complete when it finishes"* — and the script is a **constant**: no clock, no
counter, no record consulted, no terminal branch. Whatever the agent does and
however many times it asks, the answer is the same.

So the run never converges. It loops until the model gives up and answers from
a non-terminal status, which it cannot do correctly, because there is no final
status to report.

## Why it is built this way

**This is a deliberate deviation from LLD §7, recorded rather than made
quietly.** §7 specifies seed 8 as *either* "no completion criteria and
directives conflicting with its workflow" *or* "a trigger whose condition
matches records the agent itself updates (recursive firing)". This seed is
neither.

**The recursive-trigger construction is rejected on safety.** gpinst01 is a
shared instance. A trigger firing on records its own agent writes is bounded
only by platform recursion guards, and §7's own note that it is "guarded by
`sn_aia.continuous_tool_execution_limit` and the 5-runs-per-15-min recursion
limit" is an argument about blast radius, not about zero. A seed whose worst
case is degrading the instance every other project shares is not worth the row
it buys. Seed 04 was re-targeted on the same class of reasoning (R-22: build a
**new** capability rather than unmap a real one).

**The conflicting-directives construction is rejected** because it puts the
defect in the **instruction**, and the pass's other new seeds already sit at
layers 4 and 3; a layer-2 seed here would duplicate anchor seed 02's layer,
which is the layer the §AG/§AH clauses were **most** fit to.

**What is built instead is the same taxonomy entry** — T6's observable is a run
that never converges and is cut off by something other than its own logic —
reached through a bounded, deterministic, fixture-local mechanism that writes no
records and fires no triggers.

> **⚠ Finding: `continuous_tool_execution_limit` did not bind.** The property
> reads **25** on gpinst01 (`sn_aia.continuous_tool_execution_limit`, read live
> 2026-08-11) and the qualification run made **27** calls. The seed's original
> design assumed the platform ceiling would stop the loop; it did not, and the
> run ended by model give-up instead. LLD §7's claim that this construction is
> "guarded by `sn_aia.continuous_tool_execution_limit`" is therefore **not
> reliable as a bound**, which is a second and independent reason not to have
> built the recursive-trigger variant on a shared instance.

**The qualification bar was revised after measurement, and the revision is
stated rather than absorbed.** The bar as first written required the run to
*terminate on the tool ceiling*. It did not — it completed. Relaxing a bar after
seeing the result is exactly the move this project's record is vigilant about,
so the reasoning is on the record: the observable T6 names is
**non-convergence**, and 27 identical calls over 7m18s is that observable
whichever mechanism finally stopped it. The bar now tests the phenomenon
(repeat calls to one tool with no progress) rather than the stopping mechanism
(which turned out not to be the ceiling). Nothing about the fixture changed;
only the sentence describing what counts as reproducing it.

**How this differs from seed 07, which is also layer 3.** Seed 07's tool
completes on the first call and returns too **much**; this seed's tool cannot
express **completion** at all. Same layer, opposite failure, both fixes edits to
a return contract. `scorecard-template.md` §A2.2 scores the *declared layer*, so
the pair tests whether that clause **resolves** or merely **matches**.

## Decoys

**The instruction is clean, and that is the trap.** It states a real, correct
stop condition — *"The terminal statuses are complete and failed. If the status
is terminal, stop polling immediately"* — so an agent given a tool that could
return `complete` would end on the first or second call.

"The agent has no completion criteria" is the **intuitive** diagnosis and the
**wrong** one. It scores **0** on `root_cause_layer_correct` (layer 2, not 3)
and **0** on `fix_target_correct` (rewriting the instruction fixes nothing —
the tool still cannot say when). Quoting the instruction back proves the stop
condition is present; a correct diagnosis notices the loop is not the agent
failing to stop but the tool never saying when.

## Setup

Install the fixture app: `cd benchmark/seed-app && now-sdk install --alias gpinst01`.
No post-install step, no fixture rows required — the tool consults no record.

## Trigger

Open a fresh conversation with **Seed 08 Batch Watcher** and ask it to watch any
batch reference to completion. Capture the resulting `sn_aia_execution_plan`
sys_id. **Expect the run to take several minutes** and to burn one LLM assist
per ReAct turn.

## Expected diagnosis

Root cause in `tool_definition`: `check_processing_status` returns a constant
non-terminal status and cannot report completion, so the documented stop
condition is unreachable. Fix target: the tool's output contract. A diagnosis
naming the instruction (layer 2), the wiring (layer 7) or the model is a
**miss**.

## Qualification bar

A real execution must show **the same tool called repeatedly with no change in
its result** — as a threshold, **≥ 10 calls to one tool** in a single run. The
stopping mechanism is **not** part of the bar (see the revision note above). If
a run instead terminates after one or two calls, the seed has not reproduced and
its rows are void. Met 2026-08-11 at 27 calls; see
`../raw-evidence-seed-qualification-06-08.md`.

## Safety

The tool consults no record and writes nothing — it is a pure constant
function. No trigger, no recursion, no mutation. The only cost is run duration
and LLM assists, which is inherent to the taxonomy entry.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by `../../test/blindRule.test.js` — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 08 Batch Watcher
check_processing_status
```
