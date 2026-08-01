/**
 * Access control for the two fixture tables — `x_snc_tsbench_ticket`
 * (seed-01-schema-mismatch.now.ts) and `x_snc_tsbench_routing`
 * (seed-03-missing-data.now.ts).
 *
 * WHY THIS FILE EXISTS — a Fluent `Table()` installs with NO ACLs at all
 * (Build Rule #42, live-verified by this project on gpinst01 during Task 2).
 * MEASURED HERE TOO, in `dist/` before this file was added: six
 * `sys_security_acl` records, every one of them `operation=execute` — those are
 * the agent-invocation ACLs auto-generated from each seed's `securityAcl`, and
 * not one of them is a record ACL. Zero record ACLs on either fixture table, and
 * both tables emitted `ws_access=false`. When no ACL matches, the platform
 * denies — being admin does not exempt you, for REST or for the UI.
 *
 * THAT IS NOT A COSMETIC GAP HERE; IT MAKES THREE SEEDS UNRUNNABLE. The seed
 * specs instruct an operator to do things that were impossible as shipped:
 *   seed-01 — "Insert one bench ticket with short_description set ... Record its
 *             sys_id"
 *   seed-04 — same insert, same recorded sys_id
 *   seed-05 — "Insert a row into x_snc_tsbench_ticket"
 * Each is a setup step nobody could perform. The benchmark would have failed at
 * step 2 of three of its five seeds.
 *
 * AND ON SEED 3 IT CORRUPTS THE MEASUREMENT ITSELF. A later layer-5 sweep using
 * `GlideRecordSecure` against `x_snc_tsbench_routing` returns zero rows whether
 * the table is genuinely empty or merely unreadable. Seed 3's whole defect is
 * "the table is empty"; without a read ACL that defect is indistinguishable from
 * an access denial *by the very tool built to find it*. The ACL is part of the
 * instrument, not part of the fixture's convenience.
 *
 * THIS WEAKENS NO SEEDED DEFECT — the point worth being explicit about, in an
 * app where every file is deliberately broken. Every seed tool writes and reads
 * through a plain server-side scoped `GlideRecord`, which bypasses ACLs
 * entirely. Granting these ACLs changes nothing any seed agent does or sees; it
 * only lets a human and the Table API reach the fixture rows. The defects stay
 * exactly where they were put: the integer/word mismatch in seed 1, the empty
 * table in seed 3, the unmapped capability in seed 4, the inactive gate in
 * seed 5.
 *
 * WHY ALL FOUR OPERATIONS, unlike `src/fluent/acls.now.ts` in the product app.
 * There the omission of `write`/`delete` on the audit table is a deliberate
 * control — an append-only evidence trail. Here the opposite is wanted: fixture
 * tables are scratch data that an operator sets up, corrects and tears down
 * between runs, so read/create/write/delete are all granted. Nothing in this app
 * is evidence; the evidence lives in `x_snc_troubleshoot_*` in the product app.
 *
 * `adminOverrides: true` throughout — an instance admin can always reach the
 * fixture tables. The operator running the benchmark is an admin, and without
 * this they would be locked out of tables their own app created.
 *
 * Build rule: role names take the scope prefix with a DOT separator
 * (`x_snc_tsbench.bench`), unlike table names which use an underscore. Role
 * `$id` is deprecated in SDK 4.9.x — identity comes from `name`.
 */

import '@servicenow/sdk/global'
import { Acl, Role } from '@servicenow/sdk/core'

// One role, not two. The product app splits admin from user because a customer
// reads Fix Reports without operating the tool; this app has exactly one kind of
// user — whoever is setting up a benchmark run.
export const benchOperator = Role({
    name: 'x_snc_tsbench.bench',
    description: 'Sets up and tears down the benchmark fixture data. Fixture app only — never ship this role to a customer.',
})

// ---------------------------------------------------------------------------
// x_snc_tsbench_ticket — seeds 01, 04 and 05 all insert into this table
// ---------------------------------------------------------------------------
export const ticketRead = Acl({
    $id: Now.ID['acl-ticket-read'],
    type: 'record',
    table: 'x_snc_tsbench_ticket',
    operation: 'read',
    roles: [benchOperator],
    adminOverrides: true,
})

export const ticketCreate = Acl({
    $id: Now.ID['acl-ticket-create'],
    type: 'record',
    table: 'x_snc_tsbench_ticket',
    operation: 'create',
    roles: [benchOperator],
    adminOverrides: true,
})

export const ticketWrite = Acl({
    $id: Now.ID['acl-ticket-write'],
    type: 'record',
    table: 'x_snc_tsbench_ticket',
    operation: 'write',
    roles: [benchOperator],
    adminOverrides: true,
})

export const ticketDelete = Acl({
    $id: Now.ID['acl-ticket-delete'],
    type: 'record',
    table: 'x_snc_tsbench_ticket',
    operation: 'delete',
    roles: [benchOperator],
    adminOverrides: true,
})

// ---------------------------------------------------------------------------
// x_snc_tsbench_routing — seed 03. Read is the one that matters most here: see
// the header on why a missing read ACL would forge seed 3's own defect.
// The table stays EMPTY. Granting create does not seed it, and nothing in this
// app inserts into it — the emptiness is the seed.
// ---------------------------------------------------------------------------
export const routingRead = Acl({
    $id: Now.ID['acl-routing-read'],
    type: 'record',
    table: 'x_snc_tsbench_routing',
    operation: 'read',
    roles: [benchOperator],
    adminOverrides: true,
})

export const routingCreate = Acl({
    $id: Now.ID['acl-routing-create'],
    type: 'record',
    table: 'x_snc_tsbench_routing',
    operation: 'create',
    roles: [benchOperator],
    adminOverrides: true,
})

export const routingWrite = Acl({
    $id: Now.ID['acl-routing-write'],
    type: 'record',
    table: 'x_snc_tsbench_routing',
    operation: 'write',
    roles: [benchOperator],
    adminOverrides: true,
})

export const routingDelete = Acl({
    $id: Now.ID['acl-routing-delete'],
    type: 'record',
    table: 'x_snc_tsbench_routing',
    operation: 'delete',
    roles: [benchOperator],
    adminOverrides: true,
})
