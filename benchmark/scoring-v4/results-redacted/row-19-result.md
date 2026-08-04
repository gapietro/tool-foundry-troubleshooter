# Scoring result — Row 19 (native, seed 05, run 2)

| Column | Score | Justification |
|---|---|---|
| `root_cause_layer_correct` | 2 | RC-1: "Layer 7 — Trigger and wiring," Finding: "The trigger record has `active = 0`; the platform will never fire it regardless of matching records." Matches the seed's expected root-cause layer (`wiring`, layer 7) exactly. |
| `fix_target_correct` | 2 | Fix 1: "Target: `sn_aia_trigger_configuration` › sys_id `bfb77d6c64884500a80203ee029436ee`," "Current: `active = false`," "Proposed: `active = true`." This names the specific gate (`sn_aia_trigger_configuration.active`), matching the seed's exact expected fix target rather than a generic "the use case is inactive" observation — full marks, not the partial band. |
| `evidence_cites_trace_and_config` | 1 | RC-1's own Evidence cell cites only the config source explicitly (`sn_aia_trigger_configuration` field `active`, "agent_config artifact, triggers section"). The execution-trace evidence for the same finding sits just outside that cell, in LAYERS SWEPT ("Execution trace — SWEPT — zero execution plans found; absence confirmed as genuine") and the FAILURE SUMMARY ("produced zero execution plans... No execution ever started"), which is the trace-derived fact the whole diagnosis is built on. Reading the root-cause narrative as a whole (not just the isolated Evidence cell), both trace and config are cited. |
| `fix_usable_unedited` | 1 | Fix 1 is fully concrete and immediately actionable: a direct sys_id, field, current value, and proposed value. A builder AI could apply this record update exactly as written, and it directly addresses the seed's defect. |

**Total: 6/6**

**`passes_gate`:** `root_cause_layer_correct == 2` (yes) AND `fix_usable_unedited == 1` (yes) → **`passes_gate = 1`**

**Note on borderline call:** `evidence_cites_trace_and_config` is closer here than in row-17 (same seed, run 1), where RC-1's Evidence cell explicitly names both the config source and `sn_aia_execution_plan returning genuinely empty in layer 1` in the same sentence. Row-19's RC-1 Evidence cell cites only the config source directly; the trace confirmation ("zero execution plans found") appears in the surrounding LAYERS SWEPT table and FAILURE SUMMARY rather than inside RC-1's own Evidence line. Scored 1 on the basis that the root cause's full written justification — not solely the labeled Evidence cell — draws on both sources, but this is a genuinely closer call than row-17's.
