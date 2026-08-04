# Row 11 result — native, seed 03, run 2

Packet: `benchmark/scoring-v4/packets-redacted/row-11-native-seed-03-run-2.md`

## Scoring

### `root_cause_layer_correct` = 2

Expected layer (seed spec): `data` (layer 5). RC-1 in the report states `Layer | 5 · Data`,
finding "the table exists and has the correct schema ... but contains zero records," with
confidence CONFIRMED via two independent checks. The audit trail confirms Layer 5 was
genuinely swept (`layers_swept: 4/7 (L1, L3, L4, L5)`), so this is a real, evidenced claim,
not an assertion the trail contradicts. Full credit.

### `fix_target_correct` = 2

Expected fix target (seed spec): data seeding. Fix 1 — "Seed the routing table" — has
`Target type: Data`, `Target: Table x_snc_tsbench_routing`, proposing to insert rows. This
matches the seed's expected fix target exactly. (Fixes 2–3 are explicitly labeled
"recommended, secondary" tool-schema improvements; they don't displace the primary,
correctly-targeted Fix 1.)

### `evidence_cites_trace_and_config` = 1

RC-1's Evidence cell cites the execution trace directly (`sn_aia_tools_execution` sys_id
and the tool's own response JSON from the original run). RC-1's Finding cell states the
table "has the correct schema (`category`, `assignment_group`)" — a schema/config claim
that can only come from the schema_lookup check the report's own LAYERS SWEPT table
credits to Layer 4 ("Data schemas | SWEPT | ... confirmed to exist with correct columns"),
which the audit trail also confirms was genuinely swept (L4 in the 4/7 list). Read together,
RC-1's presentation draws on both an execution-trace source and a config/schema source.
Credited.

### `fix_usable_unedited` = 0

Fix 1's proposed values are not concrete enough to apply as written: `assignment_group =
<target group name>` is an unfilled placeholder, and "Add rows for every other category in
scope" never enumerates which categories those are. A builder AI acting on this text alone
cannot produce the actual INSERT statements without first researching or deciding values the
report itself never supplies — that is manual editing/research before the fix is applicable,
not application "as written." (This is independent of the target-correctness constraint:
`fix_target_correct` = 2 here, so the constraint linking the two columns is not in play; this
is a standalone usability defect in Fix 1's content.)

**Borderline note:** this is a judgment call. The *target* and *mechanism* of Fix 1 (seed the
empty table) are unambiguously correct — the deduction is purely about the fix text leaving
a literal placeholder and an unenumerated category list rather than concrete, insertable
rows, which a builder AI cannot resolve without further work.

## Total

`root_cause_layer_correct` (2) + `fix_target_correct` (2) + `evidence_cites_trace_and_config`
(1) + `fix_usable_unedited` (0) = **5/6**

## `passes_gate`

```
passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1
```

`root_cause_layer_correct` = 2 (true), `fix_usable_unedited` = 0 (false) → **`passes_gate` = 0**.
