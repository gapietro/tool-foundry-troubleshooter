# Benchmark Raw Evidence v4 — 2026-08-03

Instance: `gpinst01.service-now.com` (Zurich Patch 10 Hotfix 3)
App version under test: **`2026.08.0301`** (`sys_app.version`, verified post-install)
Endpoint: `POST /api/x_snc_troubleshoot/v1/troubleshooter/analyze`
Polling: `GET /api/x_snc_troubleshoot/v1/troubleshooter/runs/{run_id}`
Audit derivation: `x_snc_troubleshoot_audit` where `run=<run_id>`, all `action_type` values, ordered ascending.

This file is a MEASUREMENT record. Scoring lives in the v4 scorecard(s) (TBD by later tasks in this pass).

---

## Deploy verification (Task 1, done before any run)

The pass opened by finding the instance was **not** running the version under test:

- `sys_app.version` read **`2026.08.0226`** before the install (queried via
  `servicenow_query` on `sys_app`, `sys_id=13043037d3da4293904504ef30589334`,
  fields `name,version`).
- Per branch discipline, the deploy itself was run from `main`, not from this
  task branch: `git checkout main && git pull` (main already up to date at
  `8c909cd`, `package.json` version `2026.08.0301`) + `now-sdk build` (clean)
  + `now-sdk install --alias gpinst01`.
- Immediately after install, returned to
  `chore/benchmark-v4-scored-pass` — no commit was made on `main`.
- Post-install `sys_app.version` reads **`2026.08.0301`** (re-queried, same
  fields).

### Content byte-comparison — Script Includes

`sys_updated_on` is **not** bumped by an SDK install and is a misleading
indicator, so content was compared directly rather than trusting the
timestamp. For each of the four Script Includes the custom harness depends
on, the instance's `sys_script_include.script` was pulled via the Table API
(`GET /api/now/table/sys_script_include`, `sysparm_query=name=<name>`,
`sysparm_fields=name,script`) and diffed byte-for-byte against the matching
file in `src/server/`:

| Script Include | Instance vs. `src/server/*.js` | Result |
|---|---|---|
| `PaFixReport` | `diff` exit 0 | **Byte-identical** |
| `PaArtifactStore` | `diff` exit 0 | **Byte-identical** |
| `PaToolRegistry` | `diff` exit 0 | **Byte-identical** |
| `PaScriptToolAdapter` | `diff` exit 0 | **Byte-identical** |

All four matched exactly — no divergence, not even a trailing-newline
difference.

### Content byte-comparison — shared agent instructions

`sn_aia_agent` (`sys_id=e1392946828940e5a708fc51b0a5e954`, fields
`name,instructions`) was pulled via the Table API and diffed against
`docs/agent/agent-doctor-instructions.md`:

- **Content byte-identical** across all 120 lines.
- The only difference: the repo file ends with a trailing newline; the
  instance's `instructions` field value does not (`instance` 7297 bytes vs.
  `repo` 7298 bytes, diff flags `\ No newline at end of file` on the last
  line only). This is the expected artifact of how the field was populated
  and is **not** treated as a divergence — noted per the task brief's
  guidance that trailing-newline differences are common and not
  stop-worthy.

**Conclusion: the deployed code on gpinst01 (`2026.08.0301`) is confirmed
identical to the code committed on `main` at `8c909cd` for all four Script
Includes and the shared Agent Doctor instructions.** The rest of this v4
pass measures the committed code, not something else.
