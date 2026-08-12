/**
 * Access control for the two scoped tables in `tables.now.ts`.
 *
 * WHY THIS FILE EXISTS — a Fluent `Table()` installs with NO ACLs at all.
 * Measured on gpinst01 immediately after the Task 2 install: zero
 * `sys_security_acl` rows for either table, and an admin REST insert into
 * `x_snc_troubleshoot_run` returned "Access denied: User Not Authorized". When
 * no ACL matches, the platform denies — being admin does not exempt you.
 *
 * That is easy to miss, because the part of the system that matters most keeps
 * working without it: PaRunAnchor and PaAuditLogger (Task 5) write with a plain
 * server-side `GlideRecord` from inside the app scope, which bypasses ACLs
 * entirely. So the tables would have looked fine right up until someone tried to
 * open a Fix Report, or the benchmark tried to score a run — a blank rather than
 * an error, which is the failure mode this project keeps having to design
 * against (DESIGN.md R-6).
 *
 * WHO NEEDS WHAT
 *   x_snc_troubleshoot.admin — operates the Troubleshooter: creates, edits and
 *                              deletes runs; needed for REST-driven verification
 *                              and for benchmark scorecard maintenance.
 *   x_snc_troubleshoot.user  — reads diagnostic output. A run record's whole
 *                              point is that a human reads the Fix Report on it,
 *                              so read is the one grant this role needs.
 *
 * `adminOverrides: true` throughout — an instance admin can always reach the
 * app's own diagnostic records. Without it, an admin without the app roles is
 * locked out of a table their own app created.
 *
 * NOTE THE DELIBERATE OMISSION: there is no `write` and no `delete` ACL on
 * `x_snc_troubleshoot_audit`. The audit trail is evidence — it is written by the
 * adapter around every tool call and should not be editable afterwards by anyone
 * going through the ACL layer. Because an unmatched ACL denies, the absence IS
 * the control; it is not an oversight, and adding those two ACLs later would
 * quietly make the audit trail mutable. (Server-side scoped GlideRecord still
 * bypasses this, as it must — that is how the rows get written in the first
 * place.)
 *
 * Build rule: role names take the scope prefix with a DOT separator
 * (`x_snc_troubleshoot.admin`), unlike table names which use an underscore.
 * Role `$id` is deprecated in SDK 4.9.x — identity comes from `name`, and
 * renaming a role creates a new role record rather than renaming this one.
 */

import '@servicenow/sdk/global'
import { Acl, Role } from '@servicenow/sdk/core'

export const troubleshootAdmin = Role({
    name: 'x_snc_troubleshoot.admin',
    description: 'Operates the Foundry Troubleshooter: full control over diagnostic runs and their audit trail.',
})

export const troubleshootUser = Role({
    name: 'x_snc_troubleshoot.user',
    description: 'Reads Foundry Troubleshooter diagnostic runs, evidence and Fix Reports.',
})

// ---------------------------------------------------------------------------
// x_snc_troubleshoot_run
// ---------------------------------------------------------------------------
export const runRead = Acl({
    $id: Now.ID['acl-run-read'],
    type: 'record',
    table: 'x_snc_troubleshoot_run',
    operation: 'read',
    roles: [troubleshootUser, troubleshootAdmin],
    adminOverrides: true,
})

export const runCreate = Acl({
    $id: Now.ID['acl-run-create'],
    type: 'record',
    table: 'x_snc_troubleshoot_run',
    operation: 'create',
    roles: [troubleshootAdmin],
    adminOverrides: true,
})

export const runWrite = Acl({
    $id: Now.ID['acl-run-write'],
    type: 'record',
    table: 'x_snc_troubleshoot_run',
    operation: 'write',
    roles: [troubleshootAdmin],
    adminOverrides: true,
})

export const runDelete = Acl({
    $id: Now.ID['acl-run-delete'],
    type: 'record',
    table: 'x_snc_troubleshoot_run',
    operation: 'delete',
    roles: [troubleshootAdmin],
    adminOverrides: true,
})

// ---------------------------------------------------------------------------
// x_snc_troubleshoot_audit — read and create only, by design. See header.
// ---------------------------------------------------------------------------
export const auditRead = Acl({
    $id: Now.ID['acl-audit-read'],
    type: 'record',
    table: 'x_snc_troubleshoot_audit',
    operation: 'read',
    roles: [troubleshootUser, troubleshootAdmin],
    adminOverrides: true,
})

export const auditCreate = Acl({
    $id: Now.ID['acl-audit-create'],
    type: 'record',
    table: 'x_snc_troubleshoot_audit',
    operation: 'create',
    roles: [troubleshootAdmin],
    adminOverrides: true,
})

// ---------------------------------------------------------------------------
// REST endpoint — issue #74
//
// All five `troubleshooterApi` routes shipped `authentication: true,
// authorization: true` with NO role restriction, so any authenticated user
// could create unlimited diagnostic runs via POST /analyze. Exposure was
// partially bounded underneath (every tool is read-only and destructive:false
// behind PaToolRegistry's fail-closed gate; reads go through
// GlideRecordSecure), so this was never a path to data the caller could not
// already reach — but an unbounded run-creation surface is a real cost and
// resource-exhaustion concern, and each run spends LLM calls.
//
// Decided rather than left open (the issue's own prescription was "don't
// leave it undecided"): the REST surface is for people who OPERATE the
// Troubleshooter, which is the role that already exists for exactly that.
//
// `x_snc_troubleshoot.user` is deliberately NOT granted execute. That role
// reads diagnostic output — a Fix Report on a run someone else commissioned —
// and giving it the ability to commission runs would collapse the distinction
// the two roles exist to draw.
//
// `securityAttribute: 'user_is_authenticated'` keeps the platform's own
// authenticated check in the chain rather than replacing it with the role
// test alone.
// ---------------------------------------------------------------------------
export const troubleshooterApiExecute = Acl({
    $id: Now.ID['acl-rest-troubleshooter-execute'],
    type: 'rest_endpoint',
    name: 'troubleshooter',
    operation: 'execute',
    roles: [troubleshootAdmin],
    securityAttribute: 'user_is_authenticated',
})
