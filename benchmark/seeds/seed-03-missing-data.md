# Seed 03 — missing data

| | |
|---|---|
| **Expected root-cause layer** | `data` (layer 5) |
| **Expected fix target** | data seeding |
| **Fluent source** | `../seed-app/src/fluent/seed-03-missing-data.now.ts` |
| **Agent name** | Seed 03 Category Router |
| **Also stresses** | — |

## The defect

> **PREDICTED, NOT OBSERVED.** No seed has been installed or executed. What
> follows is derived from the Fluent source and the records emitted into
> `seed-app/dist/` — build-time evidence, not runtime evidence. **Confirm at
> Task 12** before scoring, and correct this section if the run disagrees.

The table exists, the tool queries it correctly, and the instructions are
unambiguous. The table is empty. Every lookup returns `matched: false`. This
is the seed that separates "the data is absent" from "the read failed" —
indistinguishable from a trace unless the tool reports empty reads
explicitly, which is exactly the R-6 / R-11 failure mode this project keeps
legislating against.

## Why it is built this way

Everything upstream of the data is correct: the query, the tool's contract,
the instructions telling the agent never to guess. The only thing wrong is
that `x_snc_tsbench_routing` was installed with zero rows. A diagnosis that
blames the tool or the query is chasing a layer that has no defect in it —
the tool reports the empty result honestly (`matched: false`, plus a
`rules_in_table` count), so the evidence needed to reach the correct layer is in
the trace if it is read.

**`rules_in_table` is now measured, corrected 2026-08-01.** ~~The tool reports
`rules_in_table: 0`.~~ It previously returned the literal `0` unconditionally,
with no count — which handed the diagnostic agent the seed's answer as a
constant rather than as a measured empty read, and would have reported "0 rules"
even from a populated table. It is now a real `GlideAggregate` count returned on
both the matched and unmatched paths, so the distinction the seed is built to
reward — *no rule for this category* versus *no rules at all* — is something the
tool actually establishes.

**The read ACL is part of the instrument, not housekeeping.** A layer-5 sweep
using `GlideRecordSecure` against a table with no read ACL returns zero rows
whether the table is empty or merely unreadable — which would make this seed's
defect indistinguishable from an access denial *by the very tool meant to find
it*. `seed-app/src/fluent/seed-tables-acl.now.ts` grants the read ACL for
exactly this reason (Build Rule #42). Granting `create` there does **not** seed
the table; it stays empty, and nothing in the app inserts into it.

## Setup

Install the fixture app (Task 12): `cd benchmark/seed-app && now-sdk install --alias gpinst01`.
Add no rows to `x_snc_tsbench_routing` — the emptiness is the defect.

## Trigger

Open a fresh conversation with **Seed 03 Category Router** and ask it to route
a request in any category. Capture the resulting `sn_aia_execution_plan`
sys_id.

## Expected diagnosis

Root cause in `data`: the routing table holds zero rows. Fix target: data
seeding, not the tool or the instructions. A diagnosis naming the tool or the
query is a **miss**, and the scorecard should record it as one.

## Safety

Table owned by the fixture app; created empty by design.
