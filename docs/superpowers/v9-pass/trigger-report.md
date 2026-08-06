# v9 scored pass — trigger phase report

**Operator:** benchmark trigger agent (trigger phase only — no diagnosis performed)
**Date:** 2026-08-06
**Instance:** gpinst01 (https://gpinst01.service-now.com), Zurich Patch 10 Hotfix 3, user `admin`
**Access path:** foundry MCP tools throughout. No shell credential reads. No repo files modified.

## Scope

Produce 6 seeded failing AI Agent executions — 2 reps each for seeds 01, 03 and 04 — and
record their `sn_aia_execution_plan` sys_ids. No diagnosis, no Fix Reports, no changes
under `src/` or `benchmark/`.

## Pre-flight verification

| Check | Method | Result |
|---|---|---|
| Session active on gpinst01 | `servicenow_status` | Active, admin, ZP10 HF3 |
| Seed agents installed | `servicenow_aia_list` nameFilter=`Seed` | All 5 seed agents present (01–05) |
| Seed 03 setup: routing table empty | `servicenow_query x_snc_tsbench_routing` | 0 rows — **emptiness is the defect, correct state** |
| Seed 04 setup: capability record exists | `servicenow_query sys_one_extend_capability` name=`x_snc_tsbench_unmapped_capability` | 1 row, sys_id `92ff62af516741769c437feb88c80ef3` |
| Seed 04 setup: installed script sys_id **matches** capability | `servicenow_query sn_aia_tool` name=`summarise_ticket`, field `script` | Script contains `var capabilityId = '92ff62af516741769c437feb88c80ef3';` — **matches**. Seed 04 is **NOT void**. Placeholder not reintroduced; nothing modified. |
| Bench ticket table shape | `servicenow_schema x_snc_tsbench_ticket` | Scope `x_snc_tsbench`; `short_description` (string), `priority` (**integer**) |

Per the pass brief, the fixture app `x_snc_tsbench` v0.0.1 install and the seed-04 sys_id
match were already verified upstream; the seed-04 match was re-confirmed cheaply above (the
spec makes it mandatory) and is not contradicted.

## Setup — bench tickets

A **fresh** ticket was inserted for every rep that needs one (seeds 01 and 04), so no ticket
is shared between reps and rep 1's agent writes cannot contaminate rep 2. Inserted via
`POST /api/now/table/x_snc_tsbench_ticket`. Seed 01 tickets were confirmed to have `priority`
empty at insert, as its Setup requires.

| Ticket sys_id | For | short_description | priority at insert |
|---|---|---|---|
| `464bb9152baa475817a6ffbeee91bfa9` | seed 01 rep 1 | Payment gateway is down for all customers, no workaround available | empty |
| `a64b795d2b66cf54f243fed2ce91bf11` | seed 01 rep 2 | Checkout service is failing for every customer, orders cannot be placed | empty |
| `5b4b3d152baa475817a6ffbeee91bf2b` | seed 04 rep 1 | VPN client disconnects every few minutes for remote staff in the Dublin office | n/a |
| `fb4b7d5d2b66cf54f243fed2ce91bfda` | seed 04 rep 2 | Shared network printer on floor three rejects all print jobs with a driver error | n/a |

Seed 03 needs no ticket — its trigger is a category routing request and its Setup explicitly
says to add no rows.

## Triggers fired

Each run was an independent invocation via `servicenow_aia_execute` against the named seed
agent, fired sequentially so each execution is unambiguously attributable. Every invocation
returned a distinct Session ID and Execution ID; no execution is reused across reps.

| Seed | Rep | Agent | Ticket sys_id | Session ID | Execution plan sys_id | Wall time |
|---|---|---|---|---|---|---|
| 01 | 1 | Seed 01 Ticket Prioritizer | `464bb9152baa475817a6ffbeee91bfa9` | `555b7d5d2b66cf54f243fed2ce91bfe2` | `4a5bb19d2b66cf54f243fed2ce91bf57` | 78s |
| 01 | 2 | Seed 01 Ticket Prioritizer | `a64b795d2b66cf54f243fed2ce91bf11` | `f8bbbd112ba6cf54f243fed2ce91bfe5` | `45bbfd112ba6cf54f243fed2ce91bfcb` | 66s |
| 03 | 1 | Seed 03 Category Router | n/a | `eafbb1192baa475817a6ffbeee91bf9f` | `3afbf1192baa475817a6ffbeee91bf10` | 22s |
| 03 | 2 | Seed 03 Category Router | n/a | `f11cfdd12ba6cf54f243fed2ce91bf0c` | `1a1c71152ba6cf54f243fed2ce91bf31` | 23s |
| 04 | 1 | Seed 04 Summarizer | `5b4b3d152baa475817a6ffbeee91bf2b` | `793c79dd2ba2cf54f243fed2ce91bf63` | `4e3c35552ba6cf54f243fed2ce91bf47` | 24s |
| 04 | 2 | Seed 04 Summarizer | `fb4b7d5d2b66cf54f243fed2ce91bfda` | `fc5cf5992baa475817a6ffbeee91bfd4` | `b85c79992baa475817a6ffbeee91bf2c` | 20s |

Trigger prompts followed each spec:

- **Seed 01** — ticket sys_id plus an urgent-sounding description, per the spec's worked
  example ("the payment gateway is down for all customers, no workaround"). Rep 2 used a
  different but equivalently urgent scenario against its own ticket.
- **Seed 03** — "route a request in the *Hardware* / *Software* category". The spec allows
  any category; two different categories were used so the reps are not literally identical
  inputs.
- **Seed 04** — "summarise the bench ticket with sys_id `<id>`", per the spec.

## Terminal state confirmation

All six plans were re-read from `sn_aia_execution_plan` in a single query after the last
trigger. All six are present, distinct, and terminal.

| # | Execution plan sys_id | state | state_reason | created |
|---|---|---|---|---|
| 1 | `4a5bb19d2b66cf54f243fed2ce91bf57` | completed | *(empty)* | 2026-08-06 02:00:34 |
| 2 | `45bbfd112ba6cf54f243fed2ce91bfcb` | completed | *(empty)* | 2026-08-06 02:02:08 |
| 3 | `3afbf1192baa475817a6ffbeee91bf10` | completed | *(empty)* | 2026-08-06 02:03:21 |
| 4 | `1a1c71152ba6cf54f243fed2ce91bf31` | completed | *(empty)* | 2026-08-06 02:03:51 |
| 5 | `4e3c35552ba6cf54f243fed2ce91bf47` | completed | *(empty)* | 2026-08-06 02:04:23 |
| 6 | `b85c79992baa475817a6ffbeee91bf2c` | completed | *(empty)* | 2026-08-06 02:04:52 |

## Void status

**No run is void.** Every seed's Setup was satisfied as its spec states:

- **Seed 01** — fixture installed; a fresh ticket with `short_description` set and `priority`
  empty was inserted per rep, sys_ids recorded.
- **Seed 03** — fixture installed; `x_snc_tsbench_routing` confirmed at 0 rows and left
  untouched, which *is* the setup.
- **Seed 04** — fixture installed; the capability sys_id in the installed `summarise_ticket`
  tool script was verified equal to the instance's `sys_one_extend_capability` record
  (`92ff62af516741769c437feb88c80ef3`). Per the spec, a correctly-matching hardcoded value
  is a **valid** install, not a skipped step. Bench tickets inserted per rep.

## Operator notes / surprises

- **All six plans report `state: completed` with an empty `state_reason`.** Not one plan
  header shows an error, including seed 04, whose spec predicts an `OneExtendUtil.execute`
  failure and `ok: false` from the tool. The failures are inside the traces, not on the plan
  header — the same "invisible from the plan header" property the README's smoke-test gate is
  built around. Anyone consuming this list should not read `completed` as "the run did not
  fail"; state is recorded here verbatim as measured, not interpreted.
- `servicenow_aia_execute`'s returned **Execution ID is the `sn_aia_execution_plan` sys_id** —
  verified directly for run 1 by querying the table for that sys_id before relying on the
  mapping for the remaining five.
- Seed 01's two reps took markedly longer than the others (78s and 66s vs 20–24s), consistent
  with it being the deliberate large-trace / paging stressor.
- No diagnosis was performed and no trace, tool result, or log content beyond plan state was
  inspected or recorded. Downstream diagnosis remains blind.

## Changes made to the instance

Four rows inserted into `x_snc_tsbench_ticket` (owned by the fixture app), plus the six agent
executions and their platform-generated records. Nothing else was created, modified or
deleted. No capability, connection, provider mapping, tool script, agent, or ACL was touched.
No repo files under `src/` or `benchmark/` were modified.
