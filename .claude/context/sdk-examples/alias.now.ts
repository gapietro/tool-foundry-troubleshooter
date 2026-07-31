/**
 * VALIDATED — Built successfully against SDK 4.8.1 and 4.9.0 on 2026-07-17.
 *
 * Golden Example: Alias + AliasTemplate — Connection & Credential aliases
 *
 * SDK Docs: node_modules/@servicenow/sdk/docs/api/alias-api.md, aliastemplate-api.md,
 *           docs/guides/alias-guide.md, alias-template-guide.md
 * Import:   import { Alias, AliasTemplate, RetryPolicy } from '@servicenow/sdk/core'
 * Requires: SDK >= 4.8.0
 *
 * Key concepts:
 *   - Fluent defines only the sys_alias / sys_alias_templates records. Connection
 *     URLs, credentials and MID selection are runtime data an admin configures on
 *     the instance after `now-sdk install` — secrets NEVER go in source.
 *   - Cross-references take the Fluent object directly (preferred), a Record<...>
 *     variable, or a plain sys_id string. Never Now.ref() (Build Rule #21).
 *   - AliasTemplate field names use the dot-prefixed convention:
 *     'connection.<field>' / 'credential.<field>' / 'additional.<field>'.
 *     Passwords are always type: 'password' with no defaultValue.
 *   - Alias parent is immutable after creation, and the parent→child inheritance
 *     business rule does NOT fire on XML import: a child alias must repeat the
 *     parent's shared fields (type, connectionType, configurationTemplate,
 *     retryPolicy, multipleConnections) or they install empty.
 */
import '@servicenow/sdk/global'
import { Alias, AliasTemplate, RetryPolicy } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Minimal HTTP connection alias (all defaults)
// ---------------------------------------------------------------------------
export const basicHttpAlias = Alias({
    $id: Now.ID['alias-basic-http'],
    name: 'My HTTP Connection',
    description: 'HTTP connection for external API',
})

// ---------------------------------------------------------------------------
// Example 2: Full integration — RetryPolicy + AliasTemplate wired into an Alias
// by direct object reference
// ---------------------------------------------------------------------------
const apiRetry = RetryPolicy({
    $id: Now.ID['alias-api-retry'],
    name: 'External API Retry',
    connectionType: 'http_retry_conditions',
    retryStrategy: 'exponential_backoff',
    count: 3,
    interval: 5,
    condition: 'status_codeIN429,500,502,503,504',
    restrictTo: ['status_code'],
})

const apiTemplate = AliasTemplate({
    $id: Now.ID['alias-api-template'],
    name: 'External API Template',
    // Wizard schema shown to the admin configuring the connection
    dynamicDataSchema: {
        connectionFields: [
            {
                name: 'connection.connection_url',
                label: 'API Base URL',
                type: 'text',
                mandatory: true,
                hint: 'Enter the base URL for the API endpoint',
            },
            { name: 'connection.timeout', label: 'Timeout (seconds)', type: 'number', defaultValue: 30 },
        ],
        credentialFields: [
            // LEAVE EMPTY at design time — filled by the admin on the instance
            { name: 'credential.api_key', label: 'API Key', type: 'password', mandatory: true },
        ],
    },
    // Records pre-created when the admin accepts the wizard defaults
    defaultDataTemplate: {
        connection: {
            table: 'http_connection',
            name: 'External API Connection',
            connectionUrl: 'https://api.example.com',
        },
        credential: { table: 'api_key_credentials', name: 'External API Key' },
    },
})

export const externalApi = Alias({
    $id: Now.ID['alias-external-api'],
    name: 'External API',
    type: 'connection',
    connectionType: 'httpConnection',
    configurationTemplate: apiTemplate, // direct object reference
    retryPolicy: apiRetry, // direct object reference
    description: 'Primary external API integration with wizard UI and retry logic',
})
