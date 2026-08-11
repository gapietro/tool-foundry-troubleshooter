# Fix Report — Seed 06 Hardware Reporter
**Execution plan:** `281d57c72bea031017a6ffbeee91bfc8`

---

## FAILURE SUMMARY

The user asked *"How many bench tickets do we currently have in the hardware category?"* The agent completed and answered **0** — which is wrong. The `count_by_category` tool queries `x_snc_tsbench_ticket` with `addQuery('category', category)`, but the column `category` does not exist on that table. GlideRecord silently ignores a filter on a non-existent column and returns all-zero results. The table contains 20+ records; several carry `type = 'hardware'`. The correct filter column is `type`.

---

## LAYERS SWEPT

| # | Layer | Status |
|---|-------|--------|
| 1 | Execution trace | SWEPT |
| 2 | Agent instructions | SWEPT |
| 3 | Tool definitions | SWEPT |
| 4 | Data schemas | SWEPT |
| 5 | Data existence | SWEPT |
| 6 | GenAI stack | SWEPT |
| 7 | Trigger and wiring | SWEPT — no trigger wiring found (expected for conversational invocation) |

**Layer unavailable:** Platform logs (syslog) — `syslog` has caller-restriction; `DENIED` was returned. An instance administrator must relax `caller_access` on `syslog` or export logs directly. This layer was NOT reported as clean.

---

## ROOT CAUSES

### RC-1 — Wrong column name in tool script

| | |
|---|---|
| **Layer** | 3 — Tool definitions / 4 — Data schema |
| **Component** | `sn_aia_tool` · sys_id `d7728c6477db44a29c2ad0fed0df7419` · field `script` |
| **Finding** | Script calls `addQuery('category', category)`. Column `category` does not exist on `x_snc_tsbench_ticket`. GlideRecord returns 0 rows silently. |
| **Evidence — tool script** | `sn_aia_tool` · `d7728c6477db44a29c2ad0fed0df7419` · script body: `gr.addQuery('category', category)` |
| **Evidence — schema** | `schema_lookup` on `x_snc_tsbench_ticket` → 8 fields returned; `category` absent; `type` (String, max 40) present |
| **Evidence — query** | `query_table` on `x_snc_tsbench_ticket` with field `category` → `field_warnings: ["category"]` (field does not exist); same query with `type` → values `hardware`, `software` confirmed |
| **Evidence — trace** | Tool call `d61d5fc72bea031017a6ffbeee91bff3` → response `{ok:true, category:'hardware', count:0, tickets:[]}` |
| **Confidence** | **CONFIRMED** |

### RC-2 — `active_tool_count = 0` on agent (secondary / cosmetic)

| | |
|---|---|
| **Layer** | 3 — Tool definitions |
| **Component** | `sn_aia_agent` · sys_id `3e8b1e1f2b1c45c8b437c09ecb6c185a` · overview |
| **Finding** | `agent_config` reports `active_tool_count: 0` while `tool_count: 2`. Both bindings show `active: 1` individually. This is likely a stale summary counter, not a live gate — the tool executed successfully in the run. |
| **Confidence** | **UNCONFIRMED** — would confirm by checking `sn_aia_agent_tool_m2m` active flag directly. Not a blocking issue given the tool ran. |

---

## FIXES

### Fix 1 — Correct the column name in `count_by_category` script

| | |
|---|---|
| **Target type** | Tool script |
| **Target** | `sn_aia_tool` · sys_id `d7728c6477db44a29c2ad0fed0df7419` · field `script` |
| **Current** | `gr.addQuery('category', category);` |
| **Proposed** | `gr.addQuery('type', category);` |
| **Rationale** | `x_snc_tsbench_ticket` has no `category` column. The `type` column carries values `hardware`, `software`, etc. — exactly what the user query targets. Changing the filter column makes the query return the correct non-zero count. |

### Fix 2 — Update tool description to document the `type` field values

| | |
|---|---|
| **Target type** | Tool schema |
| **Target** | `sn_aia_tool` · sys_id `d7728c6477db44a29c2ad0fed0df7419` · field `description` |
| **Current** | `"Counts bench tickets in one category. Give it the category name, for example hardware or network."` |
| **Proposed** | `"Counts bench tickets by type. Pass the type value exactly as stored — known values include 'hardware' and 'software'. Returns {ok, category, count, tickets[]}. Returns count 0 with an empty tickets array when no records match."` |
| **Rationale** | Documents the actual field semantics, input format, and output shape; reduces future schema drift and helps the model interpret an empty result correctly. |

---

## VERIFICATION

1. Open `sn_aia_tool` record `d7728c6477db44a29c2ad0fed0df7419` and save the updated script.
2. Re-run the agent with the same question: *"How many bench tickets do we currently have in the hardware category?"*
3. Expect the tool response to return `count > 0` and `tickets` populated with hardware-type records.
4. Confirm the agent's final message states the correct non-zero count.

Optionally, verify directly: `query_table` on `x_snc_tsbench_ticket` with `query=type=hardware` — the row count returned is the expected answer.

---

## DATA MARKERS

The following record values were quoted as evidence and should be redacted before this report leaves the instance:
- `sys_cs_message` / conversation messages — contain user utterance text
- `sn_aia_message` content digests — contain user profile email (`admin@example.com`) and user sys_id
- `query_table` row data — `short_description` values from `x_snc_tsbench_ticket`
References: null
