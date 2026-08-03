# Row 11 — native seed-03 run-2 — Score

**Seed:** 03 (missing data) · **Harness:** native (Agent Doctor) · **Run:** 2

## Rubric columns

### `root_cause_layer_correct` = **2**

Expected root-cause layer per seed spec: `data` (layer 5). The report's
ROOT CAUSES section names exactly this: "RC-1 — Routing table is empty",
Layer `5 · Data`, Confidence `CONFIRMED`, with the finding "The table exists
and has the correct schema (`category`, `assignment_group`) but contains
zero records." This is an exact match to the seed's expected diagnosis
("Root cause in `data`: the routing table holds zero rows"). Full credit.

### `fix_target_correct` = **2**

Expected fix target per seed spec: data seeding. The report's primary
fix, **Fix 1 — "Seed the routing table"**, has `Target type: Data`,
`Target: Table x_snc_tsbench_routing`, and proposes inserting rows — this
is precisely "data seeding," not a tool or instruction change. (Fixes 2
and 3 are explicitly labeled "recommended, secondary" and target tool
schema/description — they do not displace Fix 1 as the primary,
correctly-targeted fix.) Full credit.

### `evidence_cites_trace_and_config` = **1**

RC-1's Finding cites schema/config information ("the table exists and has
the correct schema (`category`, `assignment_group")") — sourced from the
Layer 4 schema sweep the report and the audit trail agree was performed.
RC-1's Evidence field separately cites execution-trace data: the tool's
actual JSON response embedded via `sn_aia_tools_execution` sys_id
`0acd45842b6a4bd417a6ffbeee91bfa1` (`{"ok":true,"matched":false,...}`),
plus the `query_table` confirmation. Taken together, the RC-1 root-cause
entry cites both a config/schema source (table schema) and an
execution-trace source (the tool's actual call/response in the trace) as
the evidence rule requires. Award 1.

### `fix_usable_unedited` = **0**

Because `fix_target_correct` = 2 (not 0), the column is not force-zeroed
by the cross-column constraint — this is a genuine formedness call.
Fix 1, the fix that actually matters (the one aimed at the correct
target), is **not** turnkey as written: it says `assignment_group =
<target group name>` — a literal bracketed placeholder, not a concrete
value — and instructs "Add rows for every other category in scope"
without enumerating what those categories are. A builder AI handed this
report verbatim cannot execute the insert without first resolving what
value replaces `<target group name>` and which categories are "in
scope" — that is manual editing/research injected before the fix can be
applied, which the rubric's "as written, with no manual editing first"
bar excludes. (Fixes 2 and 3, by contrast, are fully concrete —
exact sys_ids, exact field, exact before/after values — but those are
the secondary tool-schema fixes, not the one that matters for
`fix_target_correct`.) Award 0.

## Total

| Column | Score |
|---|---|
| `root_cause_layer_correct` | 2 |
| `fix_target_correct` | 2 |
| `evidence_cites_trace_and_config` | 1 |
| `fix_usable_unedited` | 0 |
| **Total** | **5/6** |

## `passes_gate`

```
passes_gate = (root_cause_layer_correct == 2) AND (fix_usable_unedited == 1)
            = (2 == 2) AND (0 == 1)
            = TRUE AND FALSE
            = 0
```

**`passes_gate` = 0 (fail)**

## Notes for a later reader

- This is not a void run: the seed was in the correct state (table
  genuinely empty, ACL granting read access present per the seed spec),
  and the run measured the seeded defect directly (`rules_in_table: 0`
  as a real `GlideAggregate` count, not a hardcoded constant).
- The run's own LAYERS SWEPT table and the independent audit-trail
  measurement agree exactly (L1, L3, L4, L5 swept; L2, L6, L7 not
  swept) — there is no report-vs-measurement discrepancy to adjudicate
  here, unlike some other rows in this benchmark.
- The borderline call in this score is `fix_usable_unedited`. The root
  cause and fix *target* are both correct and well-evidenced — this run
  correctly diagnosed the seeded defect. It loses the point solely
  because the primary fix's proposed values are a placeholder
  (`<target group name>`) and an unenumerated set ("every other
  category in scope") rather than concrete, ready-to-apply data. A
  scorer who reads "as written, no manual editing" more loosely (e.g.,
  treating a placeholder for a genuinely unknowable business value as
  an acceptable artifact of any data-seeding fix) could reasonably award
  1 here, which would flip `passes_gate` to 1. This write-up scores the
  stricter, literal reading, since the rubric's placement of
  `fix_usable_unedited` in the gate expression is specifically meant to
  test turnkey-ness, and a bracketed placeholder is definitionally not
  turnkey.
