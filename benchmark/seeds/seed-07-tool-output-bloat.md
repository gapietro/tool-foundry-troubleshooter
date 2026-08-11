# Seed 07 — unbounded tool return

| | |
|---|---|
| **Expected root-cause layer** | `tool_definition` (layer 3) |
| **Expected fix target** | the **tool's return contract** — bound and summarise what `read_ticket_context` returns (drop `raw_context_feed`, or cap it and return named fields). **Not** the instruction, **not** the table |
| **Fluent source** | `../seed-app/src/fluent/seed-07-tool-output-bloat.now.ts` |
| **Agent name** | Seed 07 Ticket Classifier |
| **Also stresses** | artifact paging — the oversized tool response inflates the trace |

## The defect

> **Fixture state, verified live 2026-08-11.** Seed execution
> `9d9a4f4b2b624310f243fed2ce91bf2d`. A qualification diagnostic run
> (`e5eac7832b66031017a6ffbeee91bf21`) surfaced the flag and named its measured
> size: **`tool_output_bloat` on `read_ticket_context`, response
> 58,436 chars against the 20,000-char threshold, `sn_aia_tools_execution`
> `08bacbcb2b624310f243fed2ce91bf4a`.** Observed, not predicted. That run
> claims nothing comparative about either harness — see the note under
> Qualification bar.

`read_ticket_context` returns the ticket correctly **and** appends
`raw_context_feed`: **58,436 characters** of unfiltered operational event lines
with no bearing on the classification — nearly 3× the threshold.
`PaToolAgentTrace` flags `tool_output_bloat` when a tool response exceeds
`RESPONSE_BLOAT_CHARS = 20000`.

Nothing errors. The classification is **correct**. The run completes. The cost
is that every later ReAct turn re-reads the whole blob from the scratchpad —
the compounding K26 Lab 2 describes, and what the harness's own remediation
string already says: *"Oversized tool output accumulates in the scratchpad and
is re-read on every later turn, so the cost compounds."*

## Why it is built this way

**This slot was first built as the INSTRUCTION-bloat half of K26 Lab 2, at
layer 2, and that half is not reachable on this instance.** Three builds,
each installed and run:

| instruction size | LLM P95 | slowest `gen_ai` step |
|---|---|---|
| 9,762 chars | 4,770ms | — |
| 167,530 chars | 11,757ms | 12,082ms |
| 305,589 chars | 11,997ms | **12,269ms** |

Nearly **doubling** the instruction from 167k to 305k moved the slowest step by
**187ms — 1.5%**. The curve is saturated, almost certainly by a prompt
truncation cap, and `instruction_bloat` fires only above
`LLM_SLOW_MS = 15000ms`. No practical instruction size produces the flag.

**Lowering `LLM_SLOW_MS` is forbidden here**, and the reason generalises:
the pass pre-registration holds the harness and the clauses fixed and changes
only the seed distribution. Retuning a detection threshold in the pass that changes the
distribution confounds the two and spends the out-of-sample check. The
threshold question is real and is filed as its own work.

So the slot keeps its taxonomy entry and its K26 Lab 2 provenance and moves to
the half that **is** reachable: tool output bloat, which trips on response size
rather than on the model's prompt-processing speed. The layer moves from 2 to 3
with it, because the defect is now the tool's contract.

> **⚠ Calibration hazard — MEASURED, and it already fired once.** On the
> qualification run (`9d9a4f4b2b624310f243fed2ce91bf2d`) the **first** `gen_ai`
> step took **15,154ms** — over the `instruction_bloat` threshold — while this
> seed's instruction is **~330 characters**. That step ran at `order: 100`,
> **before** the tool call at `order: 200`, so the tool's output cannot have
> caused it. It is model variance, and it means `LLM_SLOW_MS = 15000` sits
> inside this instance's noise band.
>
> **This is not hypothetical: the qualification diagnostic reported
> `instruction_bloat` as a CONFIRMED root cause of this run**, and proposed
> "offload lookup tables and error-code maps to KB articles" — remediation for
> an instruction that does not exist here. A seed-07 run will therefore often
> carry a spurious `instruction_bloat` flag alongside the real one.
>
> A diagnosis naming instruction bloat as the **primary** root cause is still a
> **miss** — this seed's instruction is clean by construction — but the flag's
> presence is not itself evidence of a bad diagnosis, and a scorer must read
> **which tool the flag is attached to**. §AN carries the advance ruling so the
> scorer meets it in the packet rather than deciding it at the desk.

**How this differs from seed 08, which is also layer 3.** Seed 08's tool cannot
express **completion**, so the loop never converges. This seed's tool completes
on the first call and returns too **much**. Same layer, opposite failure, and
both fixes are edits to a return contract. That is what makes the pair worth
having: `scorecard-template.md` §A2.2 scores the *declared layer*, and two seeds
agreeing on the layer while disagreeing on the mechanism tests whether that
clause **resolves** or merely **matches**.

## Decoys

**The ticket's `priority` is empty on every pre-existing bench ticket**, because
seed 01's defect is that priority is never stored. A diagnosis seizing on the
empty priority is reaching for a layer-5 data finding that is (a) another seed's
defect and (b) not why this run is slow. It scores **0** on
`root_cause_layer_correct`.

The spurious `instruction_bloat` flag described in the hazard note above is a
second, **unintended** decoy. It is documented rather than engineered away,
because engineering it away would mean changing the harness threshold.

## Setup

Install the fixture app: `cd benchmark/seed-app && now-sdk install --alias gpinst01`.
Requires one bench ticket to classify; `ac64074f2baa0310f243fed2ce91bfe5`
("Laptop screen cracked after drop, sharp edges exposed", priority 3) was
inserted 2026-08-11 for this purpose and any bench ticket will serve.

## Trigger

Open a fresh conversation with **Seed 07 Ticket Classifier** and ask it to
classify a bench ticket by sys_id. Capture the resulting
`sn_aia_execution_plan` sys_id.

## Expected diagnosis

Root cause in `tool_definition`: `read_ticket_context` returns 58,436
characters of unfiltered feed the task never consults. Fix target: the tool's
return contract. A diagnosis naming the instruction (layer 2), the ticket data
(layer 5) or the model is a **miss**.

## Qualification bar

A real execution must **complete**, and its `read_ticket_context` call must
record a `response_length` above 20,000 on `sn_aia_tools_execution`.

> **Note on how this is verified.** `sn_aia_tools_execution` is **not readable
> through the foundry MCP broker as admin** — "Access denied: Insufficient
> rights", verified 2026-08-11 both with and without a `fields` filter, so it is
> a genuine ACL denial and not the bad-field-name confusion that mimics one. The
> response size is therefore confirmed by **observing the harness surface the
> `tool_output_bloat` flag**, the same route by which seed 04's efficacy was
> closed at LLD §8 item 8 — observed rather than inferred.
>
> **Met 2026-08-11 at 58,436 chars**, reported with the tool named and the
> threshold quoted. The observing run is a **fixture-qualification** observation
> and claims nothing about either harness's diagnostic quality: no packet was
> built, no row was scored, and it is not a benchmark row. See
> `../raw-evidence-seed-qualification-06-08.md`.

## Safety

Read-only tool on a table owned by the fixture app. The oversized return is
generated in-script and touches no other record.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by `../../test/blindRule.test.js` — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 07 Ticket Classifier
read_ticket_context
raw_context_feed
```
