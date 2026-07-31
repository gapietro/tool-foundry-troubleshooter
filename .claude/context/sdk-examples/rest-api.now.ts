/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * Required three changes from the 4.5.0 shape:
 *   1. `version` is now a number (was a string like 'v1'); use `version: 1`.
 *   2. Each entry in versions[] requires its own `$id`.
 *   3. Each entry in routes[] requires a `version: <n>` linking it to an
 *      ApiVersion entry — the 4.6.0 type system pins routes to versions.
 * Plus the example uses `Now.include('./server/api/update-config.js')`; the
 * companion stub is committed under context/sdk-examples/server/api/.
 *
 * Golden Example: RestApi — Scripted REST API with versioned routes
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/rest-api
 * Import:   import { RestApi } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - serviceId: URL path identifier (e.g., /api/<scope>/<serviceId>/...)
 *   - versions[]: API version management with deprecated flag — each entry
 *     needs $id; version is a number
 *   - routes[]: Individual endpoints with HTTP method, path, script — each
 *     route needs $id and version: <n> linking to a versions[] entry
 *   - headers[] and parameters[]: documented query params / headers
 *   - script receives (request, response) objects
 *   - enforceAcl for security
 */

import '@servicenow/sdk/global'
import { RestApi } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Full CRUD REST API with versioning
// ---------------------------------------------------------------------------
export const agentApi = RestApi({
  $id: Now.ID['agent-rest-api'],
  name: 'Agent Configuration API',
  active: true,
  serviceId: 'agent_config',
  shortDescription: 'CRUD operations for agent configurations',
  consumes: 'application/json',
  produces: 'application/json',

  versions: [
    {
      $id: Now.ID['agent-config-api-v1'],
      version: 1, // 4.5.0 used 'v1' (string); 4.6.0 expects a number
      active: true,
      isDefault: true,
      shortDescription: 'Initial version',
    },
  ],

  routes: [
    // GET /api/<scope>/agent_config/configs
    {
      $id: Now.ID['route-list-configs'],
      version: 1, // 4.6.0+ requires linking each route to a versions[] entry
      name: 'List Configurations',
      path: '/configs',
      method: 'GET',
      active: true,
      authentication: true,
      authorization: true,
      shortDescription: 'Returns all active agent configurations',
      parameters: [
        {
          $id: Now.ID['param-limit'],
          name: 'limit',
          exampleValue: '20',
          required: false,
          shortDescription: 'Maximum records to return',
        },
        {
          $id: Now.ID['param-type'],
          name: 'type',
          exampleValue: 'triage',
          required: false,
          shortDescription: 'Filter by agent type',
        },
      ],
      script: `(function process(request, response) {
        var limit = parseInt(request.queryParams.limit) || 20;
        var type = request.queryParams.type;

        var gr = new GlideRecord('x_snc_myapp_agent_config');
        gr.addQuery('active', true);
        if (type) gr.addQuery('agent_type', type);
        gr.setLimit(limit);
        gr.query();

        var results = [];
        while (gr.next()) {
          results.push({
            sys_id: gr.getUniqueValue(),
            name: gr.getValue('name'),
            agent_type: gr.getValue('agent_type'),
            active: gr.getValue('active') === '1'
          });
        }

        response.setStatus(200);
        response.setBody({ result: results, count: results.length });
      })(request, response);`,
    },

    // GET /api/<scope>/agent_config/configs/{id}
    {
      $id: Now.ID['route-get-config'],
      version: 1,
      name: 'Get Configuration',
      path: '/configs/{id}',
      method: 'GET',
      active: true,
      authentication: true,
      shortDescription: 'Returns a single agent configuration by sys_id',
      script: `(function process(request, response) {
        var id = request.pathParams.id;
        var gr = new GlideRecord('x_snc_myapp_agent_config');
        if (gr.get(id)) {
          response.setStatus(200);
          response.setBody({
            result: {
              sys_id: gr.getUniqueValue(),
              name: gr.getValue('name'),
              description: gr.getValue('description'),
              agent_type: gr.getValue('agent_type'),
              config_json: gr.getValue('config_json'),
              active: gr.getValue('active') === '1'
            }
          });
        } else {
          response.setStatus(404);
          response.setBody({ error: { message: 'Configuration not found' } });
        }
      })(request, response);`,
    },

    // POST /api/<scope>/agent_config/configs
    {
      $id: Now.ID['route-create-config'],
      version: 1,
      name: 'Create Configuration',
      path: '/configs',
      method: 'POST',
      active: true,
      authentication: true,
      shortDescription: 'Creates a new agent configuration',
      requestExample: '{"name": "My Agent", "agent_type": "triage", "config_json": "{}"}',
      script: `(function process(request, response) {
        var body = request.body.data;
        var gr = new GlideRecord('x_snc_myapp_agent_config');
        gr.initialize();
        gr.setValue('name', body.name);
        gr.setValue('agent_type', body.agent_type);
        gr.setValue('config_json', body.config_json || '{}');
        gr.setValue('active', true);
        var sysId = gr.insert();

        response.setStatus(201);
        response.setBody({ result: { sys_id: sysId } });
      })(request, response);`,
    },

    // PUT /api/<scope>/agent_config/configs/{id}
    {
      $id: Now.ID['route-update-config'],
      version: 1,
      name: 'Update Configuration',
      path: '/configs/{id}',
      method: 'PUT',
      active: true,
      authentication: true,
      script: Now.include('./server/api/update-config.js'),
    },

    // DELETE /api/<scope>/agent_config/configs/{id}
    {
      $id: Now.ID['route-delete-config'],
      version: 1,
      name: 'Delete Configuration',
      path: '/configs/{id}',
      method: 'DELETE',
      active: true,
      authentication: true,
      script: `(function process(request, response) {
        var id = request.pathParams.id;
        var gr = new GlideRecord('x_snc_myapp_agent_config');
        if (gr.get(id)) {
          gr.deleteRecord();
          response.setStatus(204);
        } else {
          response.setStatus(404);
          response.setBody({ error: { message: 'Not found' } });
        }
      })(request, response);`,
    },
  ],
})
