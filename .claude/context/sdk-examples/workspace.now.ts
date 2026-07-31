/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * Required moving the import path from `@servicenow/sdk/workspace` (4.5.0) to
 * `@servicenow/sdk/core` (4.6.0) — the dedicated `/workspace` subpath was
 * consolidated into `/core`.
 *
 * Golden Example: Workspace — Configurable workspace
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/workspace
 * Import:   import { Workspace } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - path: URL route for the workspace
 *   - title: display name
 *   - tables[]: associated data tables
 *   - landingPath: initial page within workspace
 *   - listConfig: UxListMenuConfig reference for menu
 */

import '@servicenow/sdk/global'
import { Workspace } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example: Agent Management Workspace
// ---------------------------------------------------------------------------
export const agentWorkspace = Workspace({
  $id: Now.ID['agent-workspace'],
  title: 'Agent Management',
  path: 'agent_management',
  landingPath: 'agent_home',
  active: true,
  tables: ['x_snc_myapp_agent_config', 'incident', 'sys_user'],
  order: 100,
})
