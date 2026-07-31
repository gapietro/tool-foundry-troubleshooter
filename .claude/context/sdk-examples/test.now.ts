/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * ATF API renames from SDK 4.5.0 → 4.6.0 (9 changes):
 *   - Each step now requires `$id: Now.ID[...]` — mandatory unique step identifier
 *   - recordInsert: `setValues` renamed to `fieldValues`
 *   - recordInsert output: `.sys_id` renamed to `.record_id`
 *   - recordQuery: `query` (string) renamed to `fieldValues` (encoded query string);
 *     `expectedCount` removed (use `assert` instead if needed)
 *   - recordUpdate: `sysId` renamed to `recordId`; `setValues` renamed to `fieldValues`
 *   - recordDelete: `sysId` renamed to `recordId`
 *   - `atf.server.fieldValueValidation` removed — use `atf.server.recordValidation` instead;
 *     params changed: `{ field, expectedValue }` → `{ fieldValues: '<encoded-query>' }`
 *   - sendRestRequest: `url` renamed to `path`; HTTP method must be lowercase (`'get'`, `'post'`, …)
 *   - sendRestRequest: query string in URL → move to `queryParameters: { key: 'value' }`
 *   - assertStatusCode: `response` (step ref) removed; `expectedStatusCode` → `statusCode`;
 *     `operation: 'equals'` now required
 *
 * Golden Example: Test — ATF (Automated Test Framework) tests
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/test
 * Import:   import { Test } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - Test(setup, configFn) — two-argument pattern
 *   - configFn receives atf object with builder categories:
 *     server, form, catalog, rest, email, reporting, etc.
 *   - server: log, recordInsert, recordQuery, recordUpdate, recordDelete, runServerSideScript, impersonate
 *   - form: setFieldValue, fieldValueValidation, openNewForm, openExistingRecord, clickUIAction
 *   - rest: sendRestRequest, assertStatusCode, assertJsonResponsePayloadElement
 *   - Tests deploy to instance and run via ATF — no local execution
 */

import '@servicenow/sdk/global'
import { Test } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Server-side CRUD test
// ---------------------------------------------------------------------------
export const agentConfigCrudTest = Test(
  {
    $id: Now.ID['agent-config-crud-test'],
    name: 'Agent Config CRUD Operations',
    description: 'Validates create, read, update, delete for agent configurations',
    active: true,
    failOnServerError: true,
  },
  (atf) => {
    // Create a record
    const created = atf.server.recordInsert({
      $id: Now.ID['crud-insert-step'],
      table: 'x_snc_myapp_agent_config',
      fieldValues: {
        name: 'ATF Test Agent',
        agent_type: 'triage',
        active: true,
        config_json: '{"test": true}',
      },
    })

    // Query it back
    atf.server.recordQuery({
      $id: Now.ID['crud-query-step'],
      table: 'x_snc_myapp_agent_config',
      fieldValues: 'name=ATF Test Agent',
    })

    // Update it
    atf.server.recordUpdate({
      $id: Now.ID['crud-update-step'],
      table: 'x_snc_myapp_agent_config',
      recordId: created.record_id,
      fieldValues: {
        description: 'Updated by ATF',
      },
    })

    // Validate the update
    atf.server.recordValidation({
      $id: Now.ID['crud-validate-step'],
      table: 'x_snc_myapp_agent_config',
      recordId: created.record_id,
      fieldValues: 'description=Updated by ATF',
    })

    // Clean up
    atf.server.recordDelete({
      $id: Now.ID['crud-delete-step'],
      table: 'x_snc_myapp_agent_config',
      recordId: created.record_id,
    })
  }
)

// ---------------------------------------------------------------------------
// Example 2: REST API test
// ---------------------------------------------------------------------------
export const restApiTest = Test(
  {
    $id: Now.ID['rest-api-test'],
    name: 'Agent Config REST API Test',
    description: 'Validates the scripted REST API endpoints',
    active: true,
  },
  (atf) => {
    // Test GET endpoint
    atf.rest.sendRestRequest({
      $id: Now.ID['rest-get-request'],
      method: 'get',
      path: '/api/x_snc_myapp/agent_config/configs',
      queryParameters: { limit: '5' },
      body: '',
      auth: 'basic',
    })

    // Validates the previous sendRestRequest step
    atf.rest.assertStatusCode({
      $id: Now.ID['rest-get-status'],
      operation: 'equals',
      statusCode: 200,
    })

    // Test POST endpoint
    atf.rest.sendRestRequest({
      $id: Now.ID['rest-post-request'],
      method: 'post',
      path: '/api/x_snc_myapp/agent_config/configs',
      body: JSON.stringify({
        name: 'ATF REST Test',
        agent_type: 'resolution',
      }),
      auth: 'basic',
    })

    // Validates the previous sendRestRequest step
    atf.rest.assertStatusCode({
      $id: Now.ID['rest-post-status'],
      operation: 'equals',
      statusCode: 201,
    })
  }
)
