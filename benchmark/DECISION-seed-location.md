# Decision: where the seeded-failure agents live

**Status:** RESOLVED (2026-07-31) — discharges the gate `IMPLEMENTATION_PLAN.md` and DESIGN.md R-13
carried since 2026-07-30: *"How the five deliberately-broken seed agents get created is genuinely
unsettled … decide before Task 11, not during it."*

## The decision

A separate scoped fixture app: **`benchmark/seed-app/`**, scope **`x_snc_tsbench`**, with the five
seeds authored as Fluent DSL (`src/fluent/seed-0{1..5}.now.ts`) and built/installed independently of
the product app. Scaffolded, built, and **not** installed to any instance by this task — install is
Task 12's step.

## The two rejected options

Both obvious answers fail on a requirement the other one satisfies:

| Option | Satisfies | Fails |
|---|---|---|
| **Fluent in `src/fluent/`** (the product app) | Reproducibility — Phase 1b re-runs this same benchmark against the custom harness, and the comparison is only valid on identical seeds | Ships five deliberately broken agents inside `x_snc_troubleshoot`, the scope every customer installs |
| **MCP / Foundry record automation** | Keeps the broken agents out of the product app | Violates CLAUDE.md's rule that any MCP prototype must be ported to Fluent before the session ends, and hand-built records are not reliably reproducible months later — which is exactly when Phase 1b needs them |

A separate scoped fixture app takes reproducibility from the first option and app-separation from
the second.

## What this costs

Stated rather than elided: **a second scope and a second install target.** `benchmark/seed-app/` is
its own SDK project with its own `now.config.json`, its own `package.json`, and its own build —
maintained and rebuilt alongside the product app, not folded into it.

## The measured fact that made "scaffold without installing" viable

`now-sdk init` contacts the instance during scaffolding but creates no record there. Verified: a
`sys_scope` query filtered to `scope=x_snc_tsbench` returned **zero rows**, while the same filter
against other scopes on the instance returned **9 rows**. The absence is genuine — the scope has not
been provisioned — and is not R-6's silent-blank failure mode (a query that returns rows with a
non-existent field silently omitted). This is what let Task 11 scaffold and build the fixture app
without triggering an install.

## The consequence for seed 3

LLD §7 specifies the lookup table as `x_snc_troubleshoot_bench_routing`. In the fixture app it is
**`x_snc_tsbench_routing`** instead, because a scoped table name must begin with its own
application's exact scope value — R-13 verified 40 of 40 sampled `x_snc_*` tables on gpinst01 with no
exceptions, and established that this is a name the platform *rejects at build*, not shorthand
awaiting expansion. `x_snc_troubleshoot_bench_routing` is not buildable from a `x_snc_tsbench` app;
`x_snc_tsbench_routing` is. See `seeds/seed-03-missing-data.md` for the seed spec built against the
corrected name.

## References

- `IMPLEMENTATION_PLAN.md` — the "OPEN — decide before Task 11" gate this record discharges
- DESIGN.md R-13 — scope-prefix finalization and the 40-of-40 table-naming evidence
- `docs/BUILD_BRIEF_Phase1a_VerticalSlice.md`, "Two decisions to make, not assume" — item 2
- `benchmark/seed-app/README.md` — the fixture app's own "never install alongside the product" rule
