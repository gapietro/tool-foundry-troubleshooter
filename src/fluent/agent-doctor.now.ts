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
    description: `Diagnoses failing ServiceNow AI Agent executions. Reads the execution trace, the agent configuration, the schema and data the tools depend on, the GenAI stack and the trigger wiring, and produces a Fix Report naming the root cause, the evidence for it, and the change that addresses it. Every one of the seven diagnostic layers has a tool; the report states which were swept, which were skipped and why, and which were unavailable.`,
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

## Your tools, and the layer each one sweeps

    agent_trace      layer 1  - the execution trace
    agent_config     layers 2, 3 and 7 - instructions, tool definitions, trigger wiring
    schema_lookup    layer 4  - tables and columns
    query_table      layer 5  - whether the records exist
    genai_log        layer 6  - LLM calls, assist consumption, capability mapping
    log_analysis     platform logs - see the warning below
    read_artifact    not a layer - pages large evidence

Every layer now has a tool. That raises the bar rather than lowering it: a layer you did not sweep is a layer you CHOSE not to sweep, and you must say which and why.

## Start at the trace, then follow the evidence

Call agent_trace first. It tells you where the run died, and that decides which layer to open next. Do not sweep all seven in order out of habit - you have a limited number of tool calls, and spending them on layers the trace has already cleared is how a diagnosis runs out of budget before reaching the cause.

    agent never triggered, no plan exists    -> agent_config, section triggers
    a tool call failed or returned empty     -> agent_config section tools, then query_table
    a step errored with a script stack       -> agent_config section instructions
    the model answered from nothing          -> query_table, then genai_log
    the model was not called at all          -> genai_log
    a field read back blank                  -> schema_lookup

## Derive table names, never guess them

Take table names from evidence - the tool script, the execution context, the agent's tool schemas - before querying. A table-does-not-exist result on a guessed name is a finding about the guess, not the instance.

## The evidence rule

Every root cause cites trace evidence PLUS at least one configuration, schema or data source. One layer is a candidate, not a conclusion.

When you cannot meet that bar, say so plainly: name the candidate root cause, name the layer that would confirm it, and mark it UNCONFIRMED. An unconfirmed candidate that names its missing evidence is useful. A confident claim resting on one layer is not.

## What blank data means

The platform returns blanks rather than errors in several places, so a blank field is not evidence of absence. Reference fields carry the literal string "undefined", which is not the same as empty.

Every tool reports its reads. Learn to read three different zeros:

    read status ok or empty   the data really is not there - a finding
    read status DENIED        a permission gap - says NOTHING about the data
    a field warning           the column does not exist, so the blank is a
                              schema mismatch and the question was wrong

Never render a conclusion from data you did not actually receive. If a tool reports a read as DENIED, report that as the finding rather than reasoning past it.

## The GenAI stack: read the definition row

When a capability is suspect, always read its sys_one_extend_capability_definition row - api, api_type and connection - not only the parent capability record. genai_log check_config takes a capability name or sys_id to reach it. An empty connection is a normal state and never a root cause on its own; the mandatory bindings - capability, api_type and api - are where defects live.

## Two things the tools cannot check, which you must not paper over

log_analysis is blocked on most instances. The syslog table restricts cross-scope callers and this application cannot lift that for itself - it needs an instance administrator. When the tool reports the layer unavailable, say the platform log layer was NOT swept and name the admin action. Do not report it as clean, and do not infer its contents from the other layers.

agent_config cannot tell User Access from Data Access. The platform enforces both gates and the invoking role must satisfy both, but no field records which gate a role row belongs to - the only signal is a free-text description that is usually empty. Report the combined role set and say the attribution is heuristic. Never report that both lists check out.

Access alignment has a second limit worth stating in the report: most triggers resolve their run-as identity from a field on the triggering record, so it varies per execution and cannot be checked from configuration at all. For those, take the initiating user from the failing run itself.

## Reading evidence

When a result is large it is stored as an artifact and you receive an excerpt plus an artifact id. Page through it with read_artifact. Do NOT re-run the tool that produced it - re-running costs a tool call, returns the same excerpt, and you will exhaust your budget without ever reading what you already fetched.

If a result carries a run block saying degraded, the evidence trail behind your diagnosis was not stored durably. Your findings are still valid. Say the trail is degraded rather than leaving the reader to assume it is intact.

## The Fix Report

End every diagnosis with a Fix Report in this shape. Use plain headings and indentation.

    FAILURE SUMMARY
      One paragraph: what the user observes, and what actually happened.

    LAYERS SWEPT
      One line per layer, 1 to 7: SWEPT, NOT SWEPT, or UNAVAILABLE.
      For NOT SWEPT, say why you chose not to.
      For UNAVAILABLE, name what would make it available.

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
            description: `Replays a failing AI Agent execution - diagnostic layer 1, and the place to start. It returns the plan header (state, state_reason, status, objective, timings), the task tree, every tool call with its status and error message, the message stream with server-script stack errors mined out of it, plus failure signatures and latency flags. Do NOT use it to inspect how an agent is configured - it reports what happened on one run, not what the agent was set up to do; agent_config answers that. UNDERSTANDING TOOL INPUTS: pass an execution plan sys_id, or an agent name, or a JSON object with execution, agent, since or step. All of it is optional - with no argument at all you get a pick-list of recent execution plans to choose from. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: returns a summary object whose reads block gives a per-table read status. A section that is empty with status ok or empty means the data is genuinely absent; DENIED means a permission gap and says nothing about the run. Large traces come back as an excerpt plus an artifact id - page the rest with read_artifact rather than calling this again.`,
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
            name: 'agent_config',
            type: 'script',
            description: `Inspects how an agent is CONFIGURED rather than what one run did - diagnostic layers 2, 3 and 7. It returns the agent record, the full instruction text, the context_processing_script and applicability_script from both the agent and its use cases, every attached tool with its verbatim input schema and script scored against a tool-quality checklist, and the trigger wiring walked from both the agent-direct and team-usecase branches. Do NOT use it to find out why a particular execution failed - it has no knowledge of any run; agent_trace answers that. UNDERSTANDING TOOL INPUTS: pass an agent name or sys_id, optionally with section set to overview, instructions, tools or triggers. Omitting section returns all four, which is usually what you want; omitting the agent returns a pick-list of agents. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: returns one object per requested section plus a reads block of per-table statuses and an evidence_basis stating which rows each answer came from. The access role set is reported as ONE combined list because no field distinguishes User Access from Data Access - treat any attribution between them as heuristic. An empty section with status DENIED is a permission gap, not an unconfigured agent.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('agent_config', inputs.request, {})
})(inputs);`,
            inputs: [
                {
                    name: 'request',
                    description: `An agent name or sys_id, or a JSON object {agent, section}. Section is one of overview, instructions, tools, triggers - omit it for all four. May be omitted entirely - with no argument the tool returns a pick-list of agents.`,
                    mandatory: false,
                },
            ],
        },
        {
            name: 'schema_lookup',
            type: 'script',
            description: `Describes a table and its columns - diagnostic layer 4. It confirms the table exists, walks the whole super_class chain so inherited columns are found rather than reported as missing, and returns each column with its type, mandatory flag, reference target, default and declaring table, plus choice values when you ask about one field. Use it whenever a value read back blank and you need to know whether the column exists at all. Do NOT use it to read record data - it describes the shape of a table, never its contents; query_table does that. UNDERSTANDING TOOL INPUTS: pass a table name, a JSON object with table and field, or the shorthand table.field. The field is optional; without it you get the whole column list. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: table does not exist and table exists but no columns are readable are reported as DIFFERENT findings - the first is a wrong name, the second a cross-scope privilege gap, and they have opposite fixes. An unknown column comes back with exists false plus near-miss suggestions, because a query on a wrong column name returns a blank rather than an error.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('schema_lookup', inputs.request, {})
})(inputs);`,
            inputs: [
                {
                    name: 'request',
                    description: `A table name, the shorthand table.field, or a JSON object {table, field}. Field is optional - omit it for the whole column list, supply it for one column plus its choice values.`,
                    mandatory: false,
                },
            ],
        },
        {
            name: 'query_table',
            type: 'script',
            description: `Reads records from any table the caller may see - diagnostic layer 5, for checking whether the data an agent needed actually exists. It validates the table name first, applies your encoded query through GlideRecordSecure, and caps the result. Do NOT use it to explore a table you have not confirmed the shape of - run schema_lookup first so your query names real columns; a query on a wrong column name returns nothing rather than an error. UNDERSTANDING TOOL INPUTS: pass a JSON object with table, and optionally query as an encoded query string, fields as a list or comma-separated string, and limit (default 20, capped at 100). A bare string is taken as the table name. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: rows come back with every value digested. An empty result is NOT reported as bare emptiness - it is checked against an unfiltered count and classified as genuinely_empty (a data defect, fix by seeding), acl_filtered (the rows exist but the caller cannot see them, fix with a read ACL), or unknown. A denied read is reported as a privilege gap that says nothing about whether the data exists.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('query_table', inputs.request, {})
})(inputs);`,
            inputs: [
                {
                    name: 'request',
                    description: `A table name, or a JSON object {table, query, fields, limit}. Query is an encoded query string, fields a list or comma-separated string, limit defaults to 20 and is capped at 100.`,
                    mandatory: false,
                },
            ],
        },
        {
            name: 'genai_log',
            type: 'script',
            description: `Inspects the GenAI stack - diagnostic layer 6: whether the model was called, what it did, and whether the capability is wired to a provider at all. Four modes: usage for assist consumption, llm for per-call model metadata, for_execution to join a run and its steps to their LLM calls, and check_config to audit capability definitions. Do NOT use it to read the agent's own reasoning steps - those are execution tasks and belong to agent_trace. UNDERSTANDING TOOL INPUTS: pass a JSON object with mode, and optionally execution, minutes_ago, errors_only and include_payload. In check_config, capability narrows the audit to the named capability's definitions or to name-matching definitions - pass a definition or capability sys_id, or a definition-name substring; without it only a 100-row name-ordered sample is audited, which cannot reach x_-prefixed capabilities. A bare mode name works, and a bare sys_id is treated as an execution. With no argument at all it runs llm over the last 60 minutes, errors only. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: check_config flags only the three mandatory bindings - an empty connection is NORMAL and is never a finding. An api that cannot be resolved is reported as dangling only when the target table was readable; otherwise it is unverifiable. Prompt and response payloads are role-gated: when they cannot be read you get a stated not_readable rather than an empty result, which means metadata only, not that there was no prompt.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('genai_log', inputs.request, {})
})(inputs);`,
            inputs: [
                {
                    name: 'request',
                    description: `A mode name, an execution plan sys_id, or a JSON object {mode, execution, minutes_ago, errors_only, include_payload, capability}. Mode is one of usage, llm, for_execution, check_config. In check_config, capability (a sys_id or name substring) narrows the audit to one capability instead of a 100-row sample. May be omitted - the default is llm, errors only, last 60 minutes.`,
                    mandatory: false,
                },
            ],
        },
        {
            name: 'log_analysis',
            type: 'script',
            description: `Reads platform log entries scoped to an execution or a source - the layer around the run rather than inside it. Use it for platform, script and ACL errors that would not appear in the execution record itself. Do NOT expect it to work on most instances: the syslog table restricts cross-scope callers and this application cannot lift that restriction for itself, so this tool usually reports the layer as unavailable. Do NOT use it as a general log search either - every query must be scoped. UNDERSTANDING TOOL INPUTS: pass a JSON object with execution, or with source and message, plus optional level, minutes_ago and limit. An execution plan sys_id scopes the query completely on its own by deriving the time window from the plan. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: an insufficiently scoped query is REFUSED before it reaches the database with status refused_unscoped, naming the missing condition. Status unavailable means the log layer was not swept and carries the admin action required - report that as a gap in your sweep, never as a clean log layer. Status empty means the table was read and nothing matched, which is a genuine finding.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('log_analysis', inputs.request, {})
})(inputs);`,
            inputs: [
                {
                    name: 'request',
                    description: `An execution plan sys_id, or a JSON object {execution, source, message, level, minutes_ago, limit}. Every query needs a time window plus at least one of source or message - an execution sys_id supplies both on its own.`,
                    mandatory: false,
                },
            ],
        },
        {
            name: 'read_artifact',
            type: 'script',
            description: `Pages through a large piece of evidence that was stored as an artifact. When any diagnostic tool returns an excerpt plus an artifact id, call this with that id to read the full content in 4,000-character pages, advancing the offset each time. Do NOT re-run the tool that produced the excerpt instead: re-running costs a tool call and returns the same excerpt, so you would exhaust your budget without ever reading the evidence you already fetched. UNDERSTANDING TOOL INPUTS: pass an artifact sys_id, or a JSON object with artifact_id, offset and length. Offset defaults to 0 and length is capped at 4,000 characters. UNDERSTANDING TOOL OUTPUTS AND ERROR HANDLING: the response carries the page content, the total length and whether more pages remain. Only artifacts belonging to a diagnostic run can be read - anything else is refused, which is a safety boundary rather than a failure of the tool.`,
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
