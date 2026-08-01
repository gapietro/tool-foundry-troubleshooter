# TS Bench Seeds — benchmark fixture app

**Scope:** `x_snc_tsbench` · **Never install this alongside the product app.**

Five deliberately broken AI Agents. They exist to be diagnosed by Agent Doctor
during the Phase 1a benchmark (IMPLEMENTATION_PLAN.md Tasks 11-12) and have no
other purpose. Every one of them is wrong on purpose.

## Why this is a separate scope

The seeds have to be Fluent, because Phase 1b re-runs the same benchmark against
the custom harness and *the comparison is only valid on identical seeds*. They
must not be in `x_snc_troubleshoot`, because that is the app a customer installs.
A second scope is what satisfies both. See `../DECISION-seed-location.md`.

## Build and install

    npm install
    now-sdk build
    now-sdk install --alias gpinst01

Install is **Task 12's** step, not Task 11's. Task 11 stops at a passing build.

## Do not

- Do not install this into a customer instance, ever.
- Do not reference these seeds from `docs/agent/playbook.md`. An agent that has
  read the answer key is not being measured on anything.
- Do not repair a seed because it looks broken. That is the feature.
