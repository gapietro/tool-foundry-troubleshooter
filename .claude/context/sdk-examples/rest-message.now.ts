/**
 * VALIDATED — Built successfully against SDK 4.8.1 and 4.9.0 on 2026-07-17.
 *
 * Golden Example: RestMessage — outbound sys_rest_message + functions
 *
 * SDK Docs: node_modules/@servicenow/sdk/docs/api/restmessage-api.md,
 *           docs/guides/rest-message-guide.md
 * Import:   import { RestMessage } from '@servicenow/sdk/core'
 * Requires: SDK >= 4.8.0
 *
 * Key concepts:
 *   - Message name (max 40 chars, case-sensitive) + function name are the runtime
 *     coordinates: new sn_ws.RESTMessageV2('<message name>', '<function name>')
 *   - Functions have NO $id (coalesced on message+name); headers, variables and
 *     queryParams each DO need their own $id.
 *   - Every ${var} used in endpoint/content/headers/queryParams must be declared
 *     in variables[] or it is sent literally.
 *   - JSON APIs: keep escapeType 'noEscaping' (default) and use
 *     setStringParameterNoEscape() at runtime — setStringParameter() XML-escapes
 *     and corrupts JSON bodies. XML APIs: escapeType 'escapeXml' + setStringParameter().
 *   - Auth profile / MID references are plain sys_id strings (instance-specific;
 *     query them live). Secrets never in source: API-key pattern is a header
 *     ${apiKey} variable set at runtime from a password2 system property.
 */
import '@servicenow/sdk/global'
import { RestMessage } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Public API, no auth — variable substitution + query params
//   Runtime:
//     var rm = new sn_ws.RESTMessageV2('Geocoding API', 'searchCity')
//     rm.setStringParameterNoEscape('city', 'Zurich')
//     rm.setHttpTimeout(30000)
//     var resp = rm.execute()
// ---------------------------------------------------------------------------
export const geocodingApi = RestMessage({
    $id: Now.ID['rm-geocoding'],
    name: 'Geocoding API',
    endpoint: 'https://geocoding-api.open-meteo.com/v1/search',
    description: 'Search for a city by name using Open-Meteo geocoding',
    functions: [
        {
            name: 'searchCity',
            httpMethod: 'GET',
            variables: [{ $id: Now.ID['rm-geocoding-var-city'], name: 'city' }],
            queryParams: [
                { $id: Now.ID['rm-geocoding-param-name'], name: 'name', value: '${city}', order: 1 },
                { $id: Now.ID['rm-geocoding-param-count'], name: 'count', value: '5', order: 2 },
            ],
        },
    ],
})

// ---------------------------------------------------------------------------
// Example 2: Internal service — basic auth profile, MID server, POST body
// ---------------------------------------------------------------------------
export const erpService = RestMessage({
    $id: Now.ID['rm-erp-service'],
    name: 'On-Premise ERP Service',
    endpoint: 'https://internal.corp.example.com/erp/api',
    description: 'On-prem ERP reached through a MID server with basic auth',
    authenticationType: 'basic',
    // sys_id of a sys_auth_profile_basic record — instance-specific, replace:
    //   now-sdk query sys_auth_profile_basic --query 'name=ERP Basic Auth'
    basicAuthProfile: '00000000000000000000000000000001', // placeholder — replace
    access: 'packagePrivate',
    headers: [
        { $id: Now.ID['rm-erp-header-ct'], name: 'Content-Type', value: 'application/json' },
    ],
    functions: [
        {
            name: 'getEmployee',
            httpMethod: 'GET',
            endpoint: 'https://internal.corp.example.com/erp/api/employees/${employeeId}',
            // sys_id of an ecc_agent record — instance-specific, replace.
            // (Fluent takes the MID sys_id; runtime setMIDServer() takes the NAME.)
            midServer: 'd1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6', // placeholder — replace
            variables: [{ $id: Now.ID['rm-erp-var-employee-id'], name: 'employeeId' }],
        },
        {
            name: 'createEmployee',
            httpMethod: 'POST',
            content: '{"name": "${name}", "department": "${department}"}',
            lock: true, // serialize concurrent calls to this function
            variables: [
                { $id: Now.ID['rm-erp-var-name'], name: 'name' },
                { $id: Now.ID['rm-erp-var-department'], name: 'department' },
            ],
        },
    ],
})
