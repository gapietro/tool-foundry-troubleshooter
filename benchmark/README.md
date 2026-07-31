# benchmark/

Home for the Phase 1a benchmark (IMPLEMENTATION_PLAN.md Tasks 11–12): the seeded-failure
catalog and the scorecards produced by running Agent Doctor against it.

Empty for now — the directory is created here because Task 2's file list asks for it, and
because one question has to be settled *before* anything lands in it, not while it is landing:

> **Where the seeded failure agents live is explicitly undecided.**
> Fluent gives reproducibility but ships five deliberately broken agents inside the product
> app. MCP record automation keeps them out of the app but is not reproducible. A separate
> scoped app is the likely answer. Decide before Task 11 — see
> `docs/BUILD_BRIEF_Phase1a_VerticalSlice.md`, "Two decisions to make, not assume".

One rule that already applies: the seeded-failure catalog must **not** be referenced from
`docs/agent/playbook.md`. The playbook teaches the diagnostic method; an agent that has read
the answer key is not being measured on anything.
