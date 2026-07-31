/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * Required two changes from the 4.5.0 shape:
 *   1. Each entry in scripts[] now needs its own `$id` field.
 *   2. The script's lifecycle field was renamed from `event` to `when`.
 *
 * Golden Example: ImportSet — Transform maps for data import
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/import-set
 * Import:   import { ImportSet } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - sourceTable + targetTable (required)
 *   - fields: { targetField: 'sourceField' } or { targetField: { sourceField, sourceScript, useSourceScript } }
 *   - scripts[]: lifecycle hooks — each entry needs $id and when ('onBefore' | 'onAfter' | etc.)
 *   - runBusinessRules: whether to fire BRs on target table
 */

import '@servicenow/sdk/global'
import { ImportSet } from '@servicenow/sdk/core'

export const agentConfigImport = ImportSet({
  $id: Now.ID['agent-config-import'],
  name: 'Agent Config Import',
  sourceTable: 'x_snc_myapp_import_staging',
  targetTable: 'x_snc_myapp_agent_config',
  active: true,
  runBusinessRules: true,
  enforceMandatoryFields: 'onlyMappedFields',

  fields: {
    name: 'u_agent_name',
    description: 'u_description',
    agent_type: 'u_type',
    config_json: {
      sourceField: 'u_config',
      sourceScript: `(function transform(source) {
        // Validate and normalize JSON
        try {
          return JSON.stringify(JSON.parse(source.u_config));
        } catch (e) {
          return '{}';
        }
      })(source)`,
      useSourceScript: true,
    },
    active: 'u_active',
  },

  scripts: [
    {
      $id: Now.ID['agent-config-import-onbefore'],
      when: 'onBefore', // 4.5.0 used `event`; renamed to `when` in 4.6.0
      script: `(function(source, map, log) {
        // Skip records with empty names
        if (!source.u_agent_name) {
          log.warn('Skipping record with empty name');
          ignore = true;
        }
      })(source, map, log)`,
    },
  ],
})
