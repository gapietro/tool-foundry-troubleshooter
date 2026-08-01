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
 * PaRunAnchor — LLD §4.6, the run record every diagnostic hangs off.
 *
 * Infrastructure like PaArtifactStore, not a tool core. It resolves or creates
 * the `x_snc_troubleshoot_run` for the current conversation, which is what
 * gives artifacts something to attach to and audit rows something to reference.
 *
 * `accessibleFrom: 'public'` for the standing reason (DESIGN.md R-5): a script
 * tool runs in `rhino.global`, so the Task 9 adapter calls in from outside this
 * scope. package_private builds and installs cleanly, then fails at runtime.
 *
 * This one WRITES to x_snc_troubleshoot_run, and to nothing else.
 */
export const paRunAnchor = ScriptInclude({
    $id: Now.ID['pa-run-anchor'],
    name: 'PaRunAnchor',
    // Build Rule #29: ONE literal, no `+` concatenation.
    description: `Agent Doctor infrastructure: resolves or creates the diagnostic run record that anchors artifacts and audit for the current conversation. getOrCreate(context) keys on the native harness _agentic_context_.conversation_id, falling back to the execution plan id, and creates an isolated single-call run when neither is available - anchors are never shared on a time window, because merging two runs lets the second read the first evidence. readNativeContext() parses the _agentic_context_ JSON string defensively.`,
    active: true,
    accessibleFrom: 'public',
    script: Now.include('../server/PaRunAnchor.js'),
})

/**
 * PaAuditLogger — LLD §4.6 / §3.2, the tool-execution audit trail.
 *
 * Called by the Task 9 adapter immediately before and after every tool
 * execution. The intent row is written BEFORE the tool runs, which is what
 * makes it the only surviving evidence when a tool never returns at all — the
 * silent never-terminating stall of R-5 leaves no result and no error row.
 *
 * `accessibleFrom: 'public'` for the same rhino.global reason as the others.
 * Writes to x_snc_troubleshoot_audit and nowhere else, and cannot throw: it
 * sits in the hot path of every tool call, so a failure here degrades the audit
 * trail rather than the diagnosis.
 */
export const paAuditLogger = ScriptInclude({
    $id: Now.ID['pa-audit-logger'],
    name: 'PaAuditLogger',
    // Build Rule #29: ONE literal.
    description: `Agent Doctor infrastructure: writes the tool-execution audit trail to x_snc_troubleshoot_audit. logIntent before a tool runs - the only evidence that survives a tool which never returns - then logResult or logError after. Payloads are digested head and tail past 4KB so the audit table does not become a second copy of what the artifact store just offloaded. Never throws: a logging failure degrades the trail, not the diagnosis.`,
    active: true,
    accessibleFrom: 'public',
    script: Now.include('../server/PaAuditLogger.js'),
})

/**
 * PaToolReadKit — the GlideRecordSecure read layer the tool cores share.
 *
 * Infrastructure, not a tool core: nothing an agent can call. It exists because
 * Tasks 7 and 8 add five cores that each need identical read semantics — the
 * R-6 field-presence assertion, the R-1 no-touch catch, database-side ordering,
 * sticky DENIED — and five private copies of safety-critical plumbing is five
 * chances for one to lose a rule quietly.
 *
 * PaToolAgentTrace below is deliberately NOT migrated onto it: it is the only
 * core verified against real sn_aia_* rows, and rewriting its read path to
 * prove a refactor is risk spent for no diagnostic gain.
 *
 * accessibleFrom 'public' for the standing reason (DESIGN.md R-5): a script
 * tool runs in rhino.global, so the cores are reached from outside this scope.
 */
export const paToolReadKit = ScriptInclude({
    $id: Now.ID['pa-tool-read-kit'],
    name: 'PaToolReadKit',
    // Build Rule #29: ONE literal, no `+` concatenation.
    description: `Agent Doctor infrastructure: the GlideRecordSecure read layer shared by the diagnostic tool cores. readRows and readOne assert every requested field against isValidField so a name the table does not declare is reported rather than read as a blank, apply ordering at the database before setLimit, and record a denial without ever touching the exception object - reading one throws a second time and kills the request. A table denied once stays denied in the read log. Also carries the digest, reference-normalisation and ES5 helpers the cores share.`,
    active: true,
    accessibleFrom: 'public',
    script: Now.include('../server/PaToolReadKit.js'),
})

/**
 * PaToolAgentConfig — LLD §4.2, the agent-definition tool core.
 *
 * Sweeps diagnostic layers 2 (instructions), 3 (tool definitions) and 7
 * (trigger and wiring). Read-only, so 'public' carries no modification risk.
 *
 * The part to read before editing is the trigger traversal in the .js —
 * DESIGN.md R-18a. It runs agent -> m2m keyed on related_resource_record and
 * walks BOTH branches, and the first version of that correction had it
 * backwards. Walking only the agent-direct branch reports a wired agent as
 * unwired, and the wrong key returns blanks rather than an error, so nothing
 * anywhere says the traversal missed.
 */
export const paToolAgentConfig = ScriptInclude({
    $id: Now.ID['pa-tool-agent-config'],
    name: 'PaToolAgentConfig',
    // Build Rule #29: ONE literal, no `+` concatenation.
    description: `Agent Doctor tool core: inspects an AI Agent definition rather than a run. execute(args) takes an agent name or sys_id and an optional section - overview, instructions, tools or triggers, defaulting to all four - and returns the agent record, the full instruction text, the context_processing_script and applicability_script from BOTH the agent and its use cases, every attached tool with its verbatim input schema and script, and the trigger wiring walked from both the agent-direct and team-usecase branches. Scores each tool against the K26 tool-quality checklist as tool_smells, and emits the combined access role set alongside the trigger run-as identity - one set, because no field distinguishes User Access from Data Access. Read-only, GlideRecordSecure throughout.`,
    active: true,
    accessibleFrom: 'public',
    script: Now.include('../server/tools/PaToolAgentConfig.js'),
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

/**
 * PaToolReadArtifact — LLD §4.5, the `read_artifact` tool core.
 *
 * A tool core, unlike PaArtifactStore above: it is reachable from an agent.
 * It carries PAGED_OUTPUT so the adapter skips applyThreshold — MAX_PAGE_CHARS
 * and THRESHOLD_CHARS are both 4000, so a full page plus its envelope always
 * exceeds the threshold and would otherwise be stored as a new artifact.
 *
 * accessibleFrom 'public' for the standing reason (DESIGN.md R-5).
 */
export const paToolReadArtifact = ScriptInclude({
    $id: Now.ID['pa-tool-read-artifact'],
    name: 'PaToolReadArtifact',
    // Build Rule #29: ONE literal, no `+` concatenation.
    description: `Agent Doctor tool core: reads back a stored diagnostic artifact one 4KB page at a time. execute(args) accepts an artifact sys_id, a JSON object {artifact_id, offset, length}, or nothing, and delegates to PaArtifactStore.read - which refuses any attachment that is not on the diagnostic run table. Declares PAGED_OUTPUT so the script-tool adapter does not re-truncate its own pages.`,
    active: true,
    accessibleFrom: 'public',
    script: Now.include('../server/tools/PaToolReadArtifact.js'),
})

/**
 * PaScriptToolAdapter — LLD §4.7, the native harness bridge.
 *
 * Every AI Agent script tool is a one-line IIFE calling invoke(). This is the
 * one Script Include that must never throw: an exception reaching the native
 * orchestrator is a documented pain point, so invoke() returns a String on
 * every path.
 *
 * accessibleFrom 'public' is not optional here — this is the FIRST thing called
 * from rhino.global, so package_private would fail every tool call at runtime
 * while building and installing perfectly (DESIGN.md R-5).
 */
export const paScriptToolAdapter = ScriptInclude({
    $id: Now.ID['pa-script-tool-adapter'],
    name: 'PaScriptToolAdapter',
    // Build Rule #29: ONE literal, no `+` concatenation.
    description: `Agent Doctor infrastructure: the bridge between an AI Agent script tool and a diagnostic tool core. invoke(toolName, request, context) resolves the tool by name against a closed registry, parses the request tolerantly - a bare string is passed through unchanged - anchors the diagnostic run, audit-logs intent and result around the call, applies the artifact threshold to oversized output, and returns a JSON string. It never throws into the orchestrator; failures come back as a structured error naming the stage that failed.`,
    active: true,
    accessibleFrom: 'public',
    script: Now.include('../server/PaScriptToolAdapter.js'),
})
