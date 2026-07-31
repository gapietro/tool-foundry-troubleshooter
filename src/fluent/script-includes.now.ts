/**
 * Script Include declarations for the Agent Doctor tool cores.
 *
 * IMPLEMENTATION_PLAN.md Task 4 sets the convention: every Script Include in
 * Tasks 4-9 is declared here, in one file, so the `$id` set lives in one place.
 * A `.js` file under `src/server/` deploys NOTHING on its own — it needs a
 * Fluent `ScriptInclude` pointing at it via `Now.include()`.
 *
 * Pattern: `.claude/context/sdk-examples/script-include.now.ts`.
 */

import '@servicenow/sdk/global'
import { ScriptInclude } from '@servicenow/sdk/core'

/**
 * PaToolAgentTrace — LLD §4.1, the first Agent Doctor tool core.
 *
 * accessibleFrom is 'public' deliberately. DESIGN.md R-5 established that an AI
 * Agent script tool executes in scope `rhino.global`, NOT in the application's
 * own scope — so the Task 9 adapter will be calling in from outside
 * x_snc_troubleshoot. The default (package_private) would build and install
 * cleanly and then fail at runtime, which is the failure shape this project
 * keeps getting bitten by. Read-only tool, no writes, so public access carries
 * no data-modification risk.
 */
export const paToolAgentTrace = ScriptInclude({
    $id: Now.ID['pa-tool-agent-trace'],
    name: 'PaToolAgentTrace',
    // Build Rule #29: ONE literal. Concatenating with `+` fails the Fluent
    // parse (TS303 / TS213) - the compiler only accepts constants it can
    // resolve at build time.
    description: `Agent Doctor tool core: replays one sn_aia_execution_plan run into a diagnosable summary - plan header, task tree, tool calls, message stream, mined script errors, failure signatures and latency flags. execute(args) returns {success, data|error}. Read-only, GlideRecordSecure throughout. Summary mode only; detail mode lands with PaArtifactStore.`,
    active: true,
    accessibleFrom: 'public',
    script: Now.include('../server/tools/PaToolAgentTrace.js'),
})
