/**
 * Golden Example: Record — Generic record creation (fallback API)
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/record
 * Import:   import { Record } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - Use when no dedicated API exists for the record type
 *   - table + $id + data (required)
 *   - data: field-value pairs matching target table schema
 *   - $meta.installMethod: 'first install' | 'demo' for deployment context
 */

import '@servicenow/sdk/global'
import { Record } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Create a sys_choice record (no dedicated API)
// ---------------------------------------------------------------------------
export const customChoice = Record({
  table: 'sys_choice',
  $id: Now.ID['custom-choice-triage'],
  data: {
    name: 'x_snc_myapp_agent_config',
    element: 'agent_type',
    label: 'Advanced Triage',
    value: 'advanced_triage',
    sequence: 50,
    language: 'en',
  },
})

// ---------------------------------------------------------------------------
// Example 2: Demo data — only installed during demo setup
// ---------------------------------------------------------------------------
export const demoAgentConfig = Record({
  table: 'x_snc_myapp_agent_config',
  $id: Now.ID['demo-agent-config'],
  $meta: { installMethod: 'demo' },
  data: {
    name: 'Demo Triage Agent',
    description: 'Sample agent configuration for demonstration',
    agent_type: 'triage',
    active: true,
    config_json: JSON.stringify({
      maxRetries: 3,
      timeout: 30,
      enableLogging: true,
    }),
  },
})

// ---------------------------------------------------------------------------
// Example 3: System property record
// ---------------------------------------------------------------------------
export const appProperty = Record({
  table: 'sys_properties',
  $id: Now.ID['app-debug-property'],
  data: {
    name: 'x_snc_myapp.debug.enabled',
    value: 'false',
    description: 'Enable debug logging for the agent app',
    type: 'boolean',
  },
})
