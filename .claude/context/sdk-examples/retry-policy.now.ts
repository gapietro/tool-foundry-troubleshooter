/**
 * VALIDATED — Built successfully against SDK 4.8.1 and 4.9.0 on 2026-07-17.
 *
 * Golden Example: RetryPolicy — sys_retry_policy for outbound integrations
 *
 * SDK Docs: node_modules/@servicenow/sdk/docs/api/retrypolicy-api.md
 * Import:   import { RetryPolicy } from '@servicenow/sdk/core'
 * Requires: SDK >= 4.8.0
 *
 * Key concepts:
 *   - Discriminated union — the retryStrategy/connectionType combination decides
 *     which other properties are legal (wrong combos are compile errors):
 *       'fixed_time_interval' | 'exponential_backoff' → count + interval
 *       'retry_after' → maxElapsedTime (required, <= 86400s), HTTP only,
 *                       count/interval are compile errors
 *       connectionType 'jdbc_retry_conditions' | 'basic_retry_conditions' (SFTP)
 *                       → condition/maxElapsedTime are compile errors
 *   - condition is an encoded query over restrictTo fields
 *     ('http_method', 'status_code', 'error', 'response_body', 'response_headers')
 *   - Attach to a connection alias via Alias({ retryPolicy: <policy var> }) —
 *     see alias.now.ts. Omitted on an Alias → platform default policy; '' → no retry.
 */
import '@servicenow/sdk/global'
import { RetryPolicy } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Exponential backoff on transient HTTP failures (most common)
// ---------------------------------------------------------------------------
export const httpRetryPolicy = RetryPolicy({
    $id: Now.ID['rp-http-exponential'],
    name: 'REST API Exponential Backoff',
    connectionType: 'http_retry_conditions',
    retryStrategy: 'exponential_backoff', // interval doubles each attempt
    count: 5,
    interval: 5, // seconds; attempts at 5, 10, 20, 40, 80s
    condition: 'status_codeIN429,500,502,503,504',
    restrictTo: ['status_code', 'error'],
})

// ---------------------------------------------------------------------------
// Example 2: Honour the server's Retry-After header (rate-limited APIs)
// ---------------------------------------------------------------------------
export const retryAfterPolicy = RetryPolicy({
    $id: Now.ID['rp-retry-after'],
    name: 'Honour Retry-After Header',
    connectionType: 'http_retry_conditions',
    retryStrategy: 'retry_after',
    maxElapsedTime: 120, // give up after 2 minutes total (hard cap 86400)
    condition: 'status_codeIN429,503',
    restrictTo: ['status_code'],
})

// ---------------------------------------------------------------------------
// Example 3: Fixed-interval JDBC retry (no condition allowed on non-HTTP)
// ---------------------------------------------------------------------------
export const jdbcRetryPolicy = RetryPolicy({
    $id: Now.ID['rp-jdbc-fixed'],
    name: 'JDBC Database Retry',
    connectionType: 'jdbc_retry_conditions',
    retryStrategy: 'fixed_time_interval',
    count: 3,
    interval: 10,
})
