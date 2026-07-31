# Changelog

Version format is `YYYY.MM.DDXX` per `CLAUDE.md` — year, zero-padded month, then day plus a
two-digit daily counter. Incremented on every merge to `main`.

> **Note on the version string.** It is not valid semver (`2026.07.3001` has a leading zero in
> the month), which npm and `now-sdk build` both accept. It is also **baked into the generated
> module require paths** in `dist/` — e.g.
> `x_snc_troubleshoot/x-snc-troubleshoot/2026.07.3001/src/server/script.ts` — so every version
> bump rewrites those paths in the installed app. Verified 2026-07-30 on SDK 4.9.2.

---

## 2026.07.3001 — 2026-07-30

Reconciled the implementation plan with the SDK structure and finalized the scoped table names.
Docs and project metadata only; no Fluent artifacts changed.

### Fixed
- **Scoped table names were unbuildable.** `LOW_LEVEL_DESIGN.md` §3 deferred the scope prefix
  ("finalize at SDK setup") and SDK setup then happened without it. `x_pa_run` / `x_snc_pa_run`
  cannot be created from scope `x_snc_troubleshoot` — a scoped table name must begin with its
  application's exact scope value (verified on gpinst01: 40 of 40 sampled `x_snc_*` tables).
  Finalized to `x_snc_troubleshoot_run` and `x_snc_troubleshoot_audit`; LLD §3 is now the
  authority for table names.
- **`IMPLEMENTATION_PLAN.md` Task 10 contradicted the SDK/MCP boundary** — it specified creating
  Agent Doctor on-instance via MCP automation, where `CLAUDE.md` requires SDK-owned creation.
  Now a Fluent `AiAgent` in `src/fluent/agent-doctor.now.ts`.
- Plan file paths repointed from the never-created `src/instance/**` tree to the real
  `src/fluent/` + `src/server/` layout.
- `package.json` version aligned with the documented convention (was `0.0.1` from the SDK
  scaffold, against a README badge reading `2026.07.1801`).

### Added
- `CHANGELOG.md` — referenced by `CLAUDE.md` but previously absent.
- `IMPLEMENTATION_PLAN.md` gains a "Structural contract" section, and two Phase 0 rulings that
  tool authors kept rediscovering are promoted into its standing Design Rules table: **R-9**
  (every declared input may be absent at runtime) and **R-1** (never touch the exception object
  in a cross-scope `catch`).
- `DESIGN.md` ruling **R-13** recording the above.

---

## 2026.07.1801 — 2026-07-30

Phase 0 pre-flight and SDK scaffold. Verdict: **GO**, zero items carried forward.

### Added
- ServiceNow SDK app scaffolded — scope `x_snc_troubleshoot`, SDK 4.9.2, building and installing
  to gpinst01.
- `src/fluent/scope-readability.now.ts` — the LLD §6 `/status`-equivalent cross-scope readability
  check, run from inside the scoped app. **14 of 15 tables readable, 1 denied (`syslog`).**
  This discharged the last carried-forward Phase 0 item (R-1) and upgraded the verdict to GO.
- `docs/BUILD_BRIEF_PaToolAgentTrace.md` — self-contained build brief for the first tool core.
- `docs/PREFLIGHT_FINDINGS.md`, `DESIGN.md` §4 rulings R-1..R-12, `AGENT_DOCTOR_ARCHITECTURE.md`.

### Fixed
- **R-11 retracted** — the "no Now Assist product plugin" finding was an instrument error. The
  probe queried `v_plugin`, whose visibility is restricted for this caller, and read a *partial*
  result as *absence*. `sys_scope` shows the Now Assist product plugins installed and active.
  keynexus01 used the same instrument and remains unverified.
- `sys_log` → `syslog` (the former table does not exist) and `sn_aia_admin` → `sn_aia.admin`
  across the design docs (R-6).

### Changed
- **R-3 amended.** The same probe ran 19 tool calls on keynexus01 and 5 on gpinst01, neither
  capped — so the difference is instruction adherence, not harness capacity. Consequence:
  premature completion reports as `completed`, indistinguishable from a genuine finish, so the
  benchmark needs a completeness measure and not only a correctness score.

---

## 2.0 — 2026-07-30

Re-aim: *ServiceNow Platform Assistant* becomes **Foundry Troubleshooter**, the in-instance
diagnostic half of the Foundry build→diagnose loop.

### Changed
- Harness strategy set to **tools-first, benchmark-gated** (`ARCHITECTURE_DECISIONS.md`
  Decision 0.5, confirmed by the design spar in `DESIGN.md` §1). The load-bearing component is
  the benchmark, not Agent Doctor: native-first is not "native is right", it is
  "native is cheap to falsify".
- Evidence Bundle collector promoted to Phase 1a as a harness-agnostic core — it doubles as the
  doctor-down detector and the benchmark de-risker (`DESIGN.md` §2.1).
