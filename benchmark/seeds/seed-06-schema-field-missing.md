# Seed 06 — the queried column does not exist

| | |
|---|---|
| **Expected root-cause layer** | `data_schema` (layer 4) |
| **Expected fix target** | the **table schema** — add the `category` column to `x_snc_tsbench_ticket`, or repoint the tool at a column the dictionary declares. **Not** "seed the table" — see Decoys |
| **Fluent source** | `../seed-app/src/fluent/seed-06-schema-field-missing.now.ts` |
| **Agent name** | Seed 06 Hardware Reporter |
| **Also stresses** | the layer-4 coverage gap — no other seed targets `schema_lookup` |

## The defect

> **Fixture state, verified live 2026-08-11.** Seed execution
> `ee0a07832b624310f243fed2ce91bfeb`: `count_by_category` returned
> `{"ok":true,"category":"hardware","count":0,"tickets":[]}` with tool status
> **`success`**, and the agent reported zero hardware tickets. The table held
> 15+ rows at the time, several of them plainly hardware ("Laptop screen
> cracked after drop", "Badge printer in the security office jams", two
> displays). Observed, not predicted.

`count_by_category` filters `x_snc_tsbench_ticket` on a `category` column.
**That column does not exist.** The table declares exactly two non-system
columns — `short_description` and `priority` (read from `sys_dictionary`,
2026-08-11). `GlideRecord.addQuery` does not throw on an unknown field; the
condition simply matches nothing.

So the tool succeeds, the run completes, and the answer is fluent and wrong.
Nothing in the trace is red. The cause is visible only by reading the table's
**dictionary**, which is what layer 4 is and what `schema_lookup` exists to do.

## Why it is built this way

**This slot was originally K26 taxonomy T1 (ACL-trigger misalignment) and that
construction was refuted by measurement.** Two builds, both installed and run:

| attempt | construction | execution | result |
|---|---|---|---|
| 1 | `securityAcl: 'Specific role'` only | `f47403872ba2031017a6ffbeee91bf33` | `completed`, `state_reason` empty |
| 2 | `dataAccess.roleList` added, emitting `sys_agent_access_role_configuration` `1bdce07b54ff4181bb893435d31d3eb6`, `action=limit_to_roles` | `4f05430b2bea0310f243fed2ce91bfd8` | `completed` again |

**Root cause of the non-reproduction:** K26 Lab 1 is *trigger-scoped*. Its
mechanism is that a **trigger** invokes the agent under the **initiating
user's** context and that user's roles fail the check. The benchmark captures
seed executions by direct REST invocation **as admin**, and admin passes —
`access_verification` is its own execution-task type and returned
`isAccessAllowed: true` in 371ms. Reproducing T1 needs an active trigger *and* a
second, non-privileged identity, and LLD §7 lists trigger `run_as` as
unresolved; a trigger that would not fire on empty `run_as` is a **second**
wiring defect layered on the seeded one — the condition seed 05's spec names as
disqualifying. **T1 is deferred, not abandoned.**

**Provenance, stated plainly because it is weaker than seeds 07 and 08's.**
Those two are out-of-sample because their taxonomy entries were chosen
2026-08-01, before the §AG/§AH clauses existed. This seed was chosen *after*
those clauses, so that argument is not available to it. What it has instead is
an external, pre-existing selection criterion: **layer 4 is covered by no seed
in the set.** DESIGN.md R-21 recorded the coverage gap on 2026-08-01 and
`scorecard-template.md` §E2 maps layer 4 to `schema_lookup`, a tool with no seed
pointing at it. The slot was picked from the coverage table, not by reading the
clauses — but a reader is entitled to discount it relative to 07 and 08, and
the pass pre-registration says so on its face.

**How this differs from seed 01, which is also about a column.** Seed 01's
column *exists* and the defect is that the tool passes a word into an Integer —
a **type-contract** defect in the tool, layer 3. Here the tool's typing is fine
and the column is **absent** — a **schema** defect, layer 4. Both present as
"the value is not what you expected"; only a dictionary read separates them.
The two seeds together are what make that distinction measurable.

## Decoys

**The table is not empty — and that is the decoy, free of construction cost.**
`x_snc_tsbench_ticket` holds 15+ rows, so "the table has no data" (layer 5,
which is *seed 03's* actual defect) is the tempting wrong diagnosis, refutable
by a single unfiltered query.

- A diagnosis filing the primary root cause at **layer 5** scores **0** on
  `root_cause_layer_correct`.
- A fix target of **"seed the table"** scores **0** on `fix_target_correct`:
  seeding would not help, because the filter would still match nothing.

## Setup

Install the fixture app: `cd benchmark/seed-app && now-sdk install --alias gpinst01`.
No post-install step. No row insertion is required — the table is already
populated, and its population is load-bearing for the decoy above.

## Trigger

Open a fresh conversation with **Seed 06 Hardware Reporter** and ask how many
bench tickets are in the hardware category. Capture the resulting
`sn_aia_execution_plan` sys_id.

## Expected diagnosis

Root cause in `data_schema`: the `category` column is not declared on
`x_snc_tsbench_ticket`, so the tool's filter matches nothing. Fix target: the
table schema. A diagnosis naming the data (layer 5), the tool script (layer 3)
or the instructions (layer 2) is a **miss**.

## Qualification bar

A real execution must **complete without error** and report zero/no hardware
tickets while the table demonstrably holds rows. **If the run errors, the seed
has become a layer-3 defect and has not reproduced** — record the rows void
rather than scoring through them. Met 2026-08-11; see
`../raw-evidence-seed-qualification-06-08.md`.

## Safety

Read-only tool on a table owned by the fixture app. No mutation, no trigger, no
global-table write.

## Blind-rule tokens

Strings that would give this seed's answer away if they reached a model-facing
string. Guarded by `../../test/blindRule.test.js` — see that file's header for
how a token is chosen.

```blind-rule-tokens
Seed 06 Hardware Reporter
count_by_category
```
