/**
 * #111 A/B — compose the two prompts that differ ONLY in schema_lookup's
 * input contract sentence.
 *
 * REDUCED INSTRUMENT. The faithful version of this experiment sends the real
 * 16.7K-char prompt (full playbook, all seven tool descriptions, the real
 * _buildPrompt composition). That needs a server-side loop, which needs an
 * execution surface the app does not have. This build keeps the elements with
 * a plausible causal role in the measured malformation and drops the rest:
 *
 *   KEPT  schema_lookup's full description        the variable under test
 *   KEPT  the `execution: <sys_id>` request block  _renderRequest emits literal
 *                                                  `key: value`, the format the
 *                                                  model reproduced as
 *                                                  `table:incident`
 *   KEPT  a transcript entry whose args are JSON   the competing anchor the
 *                                                  model saw in v6 and
 *                                                  malformed anyway
 *   KEPT  the verbatim response contract           defines `args` as an object
 *   KEPT  the playbook's "field read back blank
 *         -> schema_lookup" routing line           makes the lookup the right move
 *   DROPPED  the other six tool descriptions, the rest of the playbook
 *
 * The cost is stated in the pre-registration: if the CONTROL arm does not
 * reproduce the malformation, this instrument is too reduced to test anything
 * and the run is uninformative — it does NOT license a claim about the fix.
 *
 * Run: node benchmark/scripts/build-ab-prompts.js <out-dir>
 */
const fs = require('fs')
const path = require('path')
const { loadScriptInclude } = require('../../test/_loadScriptInclude')

const NEW_CONTRACT =
    'UNDERSTANDING TOOL INPUTS: pass the table name by itself, a JSON object with table and field, ' +
    'or the dotted shorthand with the real names substituted - incident.priority, where incident is ' +
    'the table and priority is the column. The words table and field are parameter names, never part ' +
    'of a value: send incident, not table:incident. The field is optional; without it you get the ' +
    'whole column list.'

const OLD_CONTRACT =
    'UNDERSTANDING TOOL INPUTS: pass a table name, a JSON object with table and field, or the ' +
    'shorthand table.field. The field is optional; without it you get the whole column list.'

const EXECUTION = 'b07dc9082baa4314f243fed2ce91bf4b'

// The table and field are both named in the trace result, so WHICH table to ask
// about is not under test — only how the model spells the argument.
const TRACE_RESULT = [
    'status: completed. 1 tool call, no error raised.',
    '',
    'tool_calls:',
    '  #1 lookup_routing_rule (sn_aia_tool) status=success',
    '     the script read field u_routing_key off table sn_aia_tool, got back an empty',
    '     string, branched on it and returned no rows.',
].join('\n')

function schemaLookupDescription(contract) {
    const ctx = loadScriptInclude('PaToolRegistry.js', {})
    const registry = new ctx.PaToolRegistry()
    const entry = registry.list().filter((e) => e.name === 'schema_lookup')[0]
    if (!entry) throw new Error('schema_lookup not found in the registry')

    for (const known of [NEW_CONTRACT, OLD_CONTRACT]) {
        if (entry.description.indexOf(known) !== -1) {
            return { layer: entry.layer, description: entry.description.split(known).join(contract) }
        }
    }
    throw new Error('schema_lookup description carried neither known contract sentence')
}

function buildPrompt(contract) {
    const tool = schemaLookupDescription(contract)
    return [
        'You are Agent Doctor. You diagnose failing ServiceNow AI Agent executions.',
        '',
        'A field that read back blank is a layer-4 question: confirm the column exists before',
        'concluding anything about the blank.',
        '',
        '## Available tools',
        '',
        'schema_lookup (' + tool.layer + '): ' + tool.description,
        '',
        '## Diagnostic request',
        '',
        'execution: ' + EXECUTION,
        '',
        '## Transcript so far',
        '',
        '#1 [tool:agent_trace] args={"execution":"' + EXECUTION + '"}',
        'result:',
        TRACE_RESULT,
        '',
        '## Response format',
        '',
        'Respond with exactly one JSON object and nothing else - no prose, no markdown fence. It must be one of:',
        '',
        '  {"action":"tool_call","tool":"<tool name>","args":{...}}',
        '  {"action":"answer","text":"<final answer, once no further tool call is needed>"}',
        '  {"action":"fix_report","report":{...}}',
    ].join('\n')
}

const outDir = process.argv[2]
const arms = { control: OLD_CONTRACT, treatment: NEW_CONTRACT }
const written = {}
for (const [arm, contract] of Object.entries(arms)) {
    written[arm] = buildPrompt(contract)
    fs.writeFileSync(path.join(outDir, arm + '.prompt.txt'), written[arm])
    console.log(arm, written[arm].length, 'chars')
}

const same = written.control.split(OLD_CONTRACT).join('@@') === written.treatment.split(NEW_CONTRACT).join('@@')
console.log('arms differ ONLY in the contract sentence:', same)
if (!same) process.exit(1)
