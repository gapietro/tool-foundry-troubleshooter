/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * No code changes from the 4.5.0 shape; the only adapt-to-project step is the
 * scope rename of placeholders (see below).
 *
 * IMPORTANT — scope rename required when copying:
 * Two placeholder formats appear in this file and BOTH need renaming to your
 * project's scope:
 *   - Tables: `x_snc_myapp_agent_config` (underscore separator)
 *   - Roles:  `x_snc_myapp.admin`        (dot separator)
 * Replace the `x_snc_myapp` prefix with your project's scope name. Otherwise
 * the build fails with TS11 "Role name must begin with '<your-scope>.'".
 *
 * Golden Example: Acl — Access Control Lists
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/acl
 * Import:   import { Acl, Role } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - type: 'record' | 'rest_endpoint' | 'processor' | 'ui_page' | 'graphql' | 'ux_page' | 'ux_route'
 *   - operation: 'read' | 'write' | 'create' | 'delete' | 'execute' | 'query_range' | etc.
 *   - For record type: table (required), field (optional)
 *   - For named resources: name (required)
 *   - roles[] for role-based access
 *   - script for custom logic
 *   - condition for encoded query filter
 */

import '@servicenow/sdk/global'
import { Acl, Role } from '@servicenow/sdk/core'

// First define roles.
// NOTE (SDK 4.9.0): `$id` on Role is deprecated and ignored — role identity is
// now derived from `name`. Omit it on new roles; renaming a role creates a NEW
// role record.
export const appAdmin = Role({
  name: 'x_snc_myapp.admin',
  description: 'Application administrator',
})

export const appUser = Role({
  name: 'x_snc_myapp.user',
  description: 'Application user',
})

// ---------------------------------------------------------------------------
// Record ACLs
// ---------------------------------------------------------------------------
export const configTableRead = Acl({
  $id: Now.ID['config-table-read'],
  type: 'record',
  table: 'x_snc_myapp_agent_config',
  operation: 'read',
  roles: [appUser, appAdmin],
  adminOverrides: true,
})

export const configTableWrite = Acl({
  $id: Now.ID['config-table-write'],
  type: 'record',
  table: 'x_snc_myapp_agent_config',
  operation: 'write',
  roles: [appAdmin],
  condition: 'active=true',
})

export const configTableCreate = Acl({
  $id: Now.ID['config-table-create'],
  type: 'record',
  table: 'x_snc_myapp_agent_config',
  operation: 'create',
  roles: [appAdmin],
})

export const configTableDelete = Acl({
  $id: Now.ID['config-table-delete'],
  type: 'record',
  table: 'x_snc_myapp_agent_config',
  operation: 'delete',
  roles: [appAdmin],
  script: `(function() {
    // Only allow delete if record is inactive
    return !current.active;
  })()`,
})

// ---------------------------------------------------------------------------
// REST API ACL
// ---------------------------------------------------------------------------
export const restApiAcl = Acl({
  $id: Now.ID['rest-api-acl'],
  type: 'rest_endpoint',
  name: 'agent_config',
  operation: 'execute',
  roles: [appUser],
  securityAttribute: 'user_is_authenticated',
})
