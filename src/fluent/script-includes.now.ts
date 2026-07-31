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
 * PaArtifactStore — LLD §4.5, large tool output handling.
 *
 * Not a tool core: the store is infrastructure the cores and the Task 9 adapter
 * lean on. It is declared first because it is what makes the cores usable at
 * all — a real PaToolAgentTrace summary is ~35KB against a 4,000-char excerpt
 * budget, so without artifact paging the trace tool cannot be handed to an
 * agent.
 *
 * accessibleFrom 'public' for the same reason as PaToolAgentTrace below: an AI
 * Agent script tool runs in `rhino.global`, not in x_snc_troubleshoot, so the
 * adapter calls in from outside the app scope (DESIGN.md R-5). package_private
 * would build and install cleanly, then fail at runtime.
 *
 * Note this one WRITES (an attachment on x_snc_troubleshoot_run) where the
 * cores are read-only. It writes nowhere else, and `read()` refuses any
 * attachment that is not on the run table — see the header of the .js.
 */
export const paArtifactStore = ScriptInclude({
    $id: Now.ID['pa-artifact-store'],
    name: 'PaArtifactStore',
    // Build Rule #29: ONE literal, no `+` concatenation.
    description: `Agent Doctor infrastructure: stores over-threshold tool output as an attachment on the diagnostic run record and serves it back in 4KB pages. store(runId, toolName, content) returns an excerpt plus an artifact_id; read(artifactId, offset, length) pages through it; applyThreshold(runId, result, toolName) is the wrapper the script-tool adapter applies to every tool result. Degrades to an excerpt with a stated reason if the attachment cannot be written - never returns the full oversized payload.`,
    active: true,
    accessibleFrom: 'public',
    script: Now.include('../server/PaArtifactStore.js'),
})

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
