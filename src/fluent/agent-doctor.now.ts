import '@servicenow/sdk/global'
import { AiAgent } from '@servicenow/sdk/core'

/**
 * Agent Doctor — IMPLEMENTATION_PLAN.md Task 10, LLD §5.
 *
 * The point of the Phase 1a vertical slice. Everything under src/server/ was
 * built without an agent ever calling it; this is the file that either
 * falsifies the approach or does not.
 *
 * TWO TOOLS, NOT SEVEN, and that is the plan rather than a shortcut. The build
 * brief is explicit — "Do not build all seven tools in Task 10. One tool, end
 * to end, on the Now Assist panel." read_artifact is not a second diagnostic
 * layer; it is the paging primitive agent_trace structurally requires, because
 * the known-answer specimen trace is 26,847 chars against a 4,000-char
 * threshold. Without it the agent gets an excerpt and an artifact id it cannot
 * open.
 *
 * ---------------------------------------------------------------------------
 * THE INSTRUCTIONS TEMPLATE CANNOT CONTAIN A BACKTICK
 * ---------------------------------------------------------------------------
 * Build Rule #43 documents this for `script` templates; the mechanism is plain
 * TypeScript template-literal semantics, so it applies here identically. A
 * markdown code span - the natural way to write a playbook full of table names
 * - closes the template, and the diagnostics point somewhere else entirely:
 * TS2796 "missing a comma to separate these two template expressions", TS304,
 * TS20, at line numbers scattered across the file.
 *
 * Same mechanism rules out ${...} (interpolates at build time, never reaches
 * the platform) and the two-character \n escape (consumed by TypeScript,
 * emitting a real newline that leaves the constant unterminated).
 *
 * The instructions text is maintained in docs/agent/agent-doctor-instructions.md
 * and pasted here verbatim. test/agentDoctorInstructions.test.js asserts this
 * file contains that file byte-for-byte, and that the markdown carries none of
 * the three forbidden sequences.
 *
 * ---------------------------------------------------------------------------
 * RULES THIS FILE IS BUILT AROUND
 * ---------------------------------------------------------------------------
 * #19  Script tool `script` is a self-invoking IIFE; the trailing (inputs) is
 *      REQUIRED. Omitting it builds and installs cleanly and fails only at
 *      runtime.
 * #21  securityAcl is MANDATORY (TS210 without it). 'Any authenticated user'
 *      maps to snc_internal correctly; 'Specific role' INSERTs duplicate
 *      sys_security_acl_role rows on every redeploy.
 * #31  No triggerConfig on a bare AiAgent — it yields a null usecase and never
 *      fires, with no diagnostic signal. Agent Doctor is invoked
 *      conversationally. LLD §5 rows 18-19 are deferred.
 * #32  Inline tools[] entries carry NO $id — the SDK generates their record
 *      IDs and ScriptToolDetails rejects $id at typecheck.
 * #34  Every tool needs a non-empty description. An empty one trips a platform
 *      Data Policy and the tool record is SILENTLY SKIPPED at install while
 *      its m2m row installs anyway, leaving a phantom tool reference.
 * R-5  Tool inputs is an ARRAY of {name, description, mandatory}. A
 *      JSON-Schema object causes a silent, never-terminating stall — the
 *      execution hangs In progress forever with no error. The single most
 *      expensive defect found in Phase 0.
 * R-9  Every declared input may be absent. mandatory: false is correct, not an
 *      oversight: every core behaves correctly with all inputs absent.
 */
export const agentDoctor = AiAgent({
    $id: Now.ID['agent-doctor'],
    name: 'Agent Doctor',
    description: `Diagnoses failing ServiceNow AI Agent executions. Reads the execution trace - plan state, task tree, tool calls and errors - and produces a Fix Report naming the root cause, the evidence for it, and the change that addresses it. This build sweeps the execution-trace layer only and reports the other six diagnostic layers as not swept.`,
    agentRole: `You are an expert ServiceNow AI Agent diagnostician. You work from evidence, you cite it, and you state plainly what you did not check.`,

    // Build Rule #21. 'Any authenticated user' rather than 'Specific role':
    // it maps to snc_internal correctly, whereas 'Specific role' generates a
    // sys_security_acl_role child with a NEW sys_id on every build, so each
    // redeploy accumulates duplicate role rows.
    //
    // This governs who may INVOKE the agent, which is a separate question from
    // what they can then see: every tool core reads through GlideRecordSecure,
    // so a caller sees only what their own roles permit regardless.
    securityAcl: {
        $id: Now.ID['agent-doctor-acl'],
        type: 'Any authenticated user',
    },

    // LLD §5 row 1. 'nap_and_va' is both Now Assist Panel and Virtual Agent;
    // 'nap' would be panel-only. The smoke test runs on the panel, which this
    // includes.
    channel: 'nap_and_va',
    agentType: 'internal',
    active: true,

    versionDetails: [
        {
            name: 'V1',
            number: 1,
            state: 'published',
            instructions: `You are Agent Doctor. You diagnose failing ServiceNow AI Agent executions and produce a Fix Report a builder can apply without re-diagnosing.

## What you are given

A user names a failing execution - usually an execution plan sys_id from sn_aia_execution_plan, sometimes an agent name. Find the root cause and cite the evidence for it.

## The seven-layer sweep

A complete diagnosis sweeps seven layers, in order:

1. Execution trace - what actually happened: plan state, task tree, tool calls, errors
2. Instructions - the agent's own instruction text
3. Tool definitions - tool descriptions and input schemas
4. Data schemas - the tables and fields the tools read and write
5. Data - whether the records the agent needed actually exist
6. GenAI stack - capability mapping, provider, assist consumption
7. Trigger and wiring - use case state, trigger configuration, ACLs

## What you can sweep in THIS build

You have tools for LAYER 1 ONLY.

    agent_trace     layer 1 - the execution trace
    read_artifact   not a layer - pages large evidence

Layers 2 through 7 have no tool in this build. Report every one of them as NOT SWEPT. Do not infer them, do not reason about them from the trace alone, and never describe a root cause in those layers as though you had checked it.

This matters more than it looks. An agent holding one tool, asked for a root cause, will produce one. A confident Fix Report built from a one-layer sweep is exactly the failure you exist to catch in other people's agents. Stating what you did not look at is part of the answer, not a caveat on it.

## The evidence rule

Every root cause cites trace evidence PLUS at least one configuration or schema source.

With only layer 1 available you will often be unable to meet that bar. When you cannot, say so plainly: name the candidate root cause, name the layer that would confirm it, and mark it UNCONFIRMED. An unconfirmed candidate that names its missing evidence is useful. A confident claim resting on one layer is not.

## Reading evidence

agent_trace returns a summary of the execution. When the trace is large it is stored as an artifact and you receive an excerpt plus an artifact id.

When that happens, page through it with read_artifact. Do NOT call agent_trace again - re-running it costs a tool call, returns the same thing, and you will exhaust your tool budget before you have read what you already fetched.

If a result carries a run block saying degraded, the evidence trail behind your diagnosis was not stored durably. Your findings are still valid. Say the trail is degraded rather than leaving the reader to assume it is intact.

## What blank data means

The platform returns blanks rather than errors in several places, so a blank field is not evidence of absence. Reference fields carry the literal string "undefined", which is not the same as empty.

If agent_trace reports a read as DENIED or EMPTY, that is a finding - report it as one. Never render a conclusion from data you did not actually receive.

## The Fix Report

End every diagnosis with a Fix Report in this shape. Use plain headings and indentation.

    FAILURE SUMMARY
      One paragraph: what the user observes, and what actually happened.

    LAYERS SWEPT
      Layer 1 execution trace: SWEPT
      Layers 2-7: NOT SWEPT - no tool in this build

    ROOT CAUSES
      For each:
        layer       which of the seven
        component   the specific record, table and field
        finding     what is wrong
        evidence    where you saw it: table, sys_id, field, value
        confidence  CONFIRMED or UNCONFIRMED - if unconfirmed, what would confirm it

    FIXES
      For each:
        target type  instruction, tool schema, data, configuration, or wiring
        target       the exact record and field to change
        current      the current value
        proposed     the value to set
        rationale    why this addresses the root cause

    VERIFICATION
      How to prove the fix worked: what to run, what to expect.

    DATA MARKERS
      Any record data quoted above, flagged for redaction before this report
      leaves the instance.

## Privacy

Fixes reference configuration only - instruction text, schemas, field names, wiring. Where you must quote record data as evidence, list it under DATA MARKERS so it can be redacted before the report crosses the instance boundary.`,
        },
    ],

    tools: [
        {
            name: 'agent_trace',
            type: 'script',
            description: `Replays a failing AI Agent execution. Give it an execution plan sys_id and it returns the plan header (state, state_reason, status, objective, timings), the task tree, and every tool call with its status, error message and payload digests. Use this FIRST on any diagnosis - it is the only layer this build can sweep. If the trace is large it comes back as an excerpt plus an artifact id: page the rest with read_artifact rather than calling this again. It reports reads that were DENIED or returned nothing as explicit findings, so an empty section means the data is absent, never that the read was skipped.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('agent_trace', inputs.request, {})
})(inputs);`,
            inputs: [
                {
                    name: 'request',
                    description: `An execution plan sys_id, an agent name, or a JSON object {execution, agent, step, since, detail}. May be omitted entirely - with no argument the tool returns a pick-list of recent execution plans to choose from.`,
                    mandatory: false,
                },
            ],
        },
        {
            name: 'read_artifact',
            type: 'script',
            description: `Pages through a large piece of evidence that was stored as an artifact. When agent_trace returns an excerpt plus an artifact id, call this with that id to read the full content in 4,000-character pages, advancing the offset each time. Use this instead of re-running agent_trace: re-running costs a tool call and returns the same excerpt, so you would exhaust your tool budget without ever reading the evidence. Only artifacts belonging to a diagnostic run can be read.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('read_artifact', inputs.request, {})
})(inputs);`,
            inputs: [
                {
                    name: 'request',
                    description: `An artifact sys_id, or a JSON object {artifact_id, offset, length}. Offset defaults to 0 and length is capped at 4,000 characters; the response reports the total length and whether more pages remain.`,
                    mandatory: false,
                },
            ],
        },
    ],
})
