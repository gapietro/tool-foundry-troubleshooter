/**
 * Cross-scope read privileges for the Agent Doctor tool cores.
 *
 * WHY THIS EXISTS — DESIGN.md R-12 and the R-1 discharge.
 *
 * The `/scope_probe/reads` endpoint measures what this scope can actually read.
 * Result, re-confirmed 2026-07-31: **14 of 15 tables readable with no grant at
 * all — and exactly one denied: `syslog`.** That is the single table Phase 0
 * flagged as carrying `caller_access = Caller Restriction`, an explicit
 * departure from the empty/unrestricted dictionary default. Every `sn_aia_*`
 * and `sys_gen_ai_*` table this app reads is unrestricted and needs nothing
 * here.
 *
 * `syslog` is the data source for `PaToolLogAnalysis` — 1 of the 7 Phase 1a
 * tools. R-12 requires the access path be resolved **at build time, before that
 * tool is written**, rather than discovered when it returns nothing.
 *
 * WHAT IS UNCERTAIN, STATED PLAINLY
 * P4a found **47 standing `sys_scope_privilege` Read grants among 79 privilege
 * rows** — proving the mechanism works in production — but every one is from a
 * first-party scope, with **no custom `x_*` precedent**. So this is the first
 * of its kind here; do not assume it is routine. The open question is whether a
 * self-declared `status: 'allowed'` is honoured for a table that carries a
 * caller restriction, or whether the restriction wins.
 *
 * A NEGATIVE RESULT IS ALSO AN ANSWER — and it is the one we got. See below.
 *
 * RESULT — MEASURED 2026-07-31 (DESIGN.md R-19): **the grant installs correctly
 * and does NOT lift the denial.** Verified in `sys_scope_privilege`:
 * source_scope=x_snc_troubleshoot, target_name=syslog, target_scope=global,
 * operation=read, status=allowed. `syslog` still reads DENIED on two probe runs
 * after install (ruling out scope-access caching).
 *
 * The blocker is `sys_db_object.caller_access = Caller Restriction`. **A
 * self-declared privilege does not satisfy it — an application cannot grant
 * itself access to a caller-restricted table.** `PaToolLogAnalysis` needs an
 * instance-admin action or a different evidence path; that is a customer-side
 * prerequisite for HANDOFF.md, not a code defect.
 *
 * THIS FILE IS KEPT DELIBERATELY. The declaration is the half we own, it is
 * correctly formed, and it must already exist if an admin lifts the
 * restriction. Deleting it would lose that and make the next session re-derive
 * the whole finding.
 *
 * HOW TO VERIFY (do not infer it from a clean install):
 *   GET /api/x_snc_troubleshoot/scope_probe/reads
 * and check whether `reads.syslog` has moved off `DENIED`. The endpoint uses
 * GlideRecordSecure from inside this scope, so it measures the thing that
 * matters. Per R-8, an MCP/REST probe of `syslog` would NOT answer this.
 */

import '@servicenow/sdk/global'
import { CrossScopePrivilege } from '@servicenow/sdk/core'

/**
 * Read access to `syslog` (global scope) from `x_snc_troubleshoot`.
 *
 * Note the target is `syslog`, NOT `sys_log` — that table does not exist on the
 * instance (DESIGN.md R-6; a tool written to the documented name fails
 * outright). CRUD operations require `targetType: 'sys_db_object'`.
 */
export const syslogReadPrivilege = CrossScopePrivilege({
    $id: Now.ID['xsp-syslog-read'],
    operation: 'read',
    status: 'allowed',
    targetName: 'syslog',
    targetScope: 'global',
    targetType: 'sys_db_object',
})
