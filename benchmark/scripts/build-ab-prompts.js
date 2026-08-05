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

// The hold-block variable under test (#116). NEW_ITEM1 is what `_holdBlock`
// emits after Task 2; OLD_ITEM1 is what it emitted through v6 and v7, and is
// substituted back in to build the control arm. Composing the control by
// substitution rather than by hand is what makes the arms provably identical
// everywhere else.
const NEW_ITEM1 =
    '  1. What did the last tool result actually establish? Quote the specific value you\n' +
    '     are relying on, and the table and field it came from.'

const OLD_ITEM1 =
    '  1. What did the last tool result actually establish? Quote the specific field\n' +
    '     or value you are relying on.'

// The gap set and target handed to `_holdBlock`. Layer 4 at fan-out 1 is the
// shape that directs a run at schema_lookup, which is the tool whose contract
// permits a bare scalar and therefore the one where the degradation shows.
const HOLD_GAPS = [
    { layer: 4, name: 'Data schemas', reason: 'no schema read was needed', tools: ['schema_lookup'] },
]
const HOLD_TARGET = { layer: 4, source: 'ranked', tools: ['schema_lookup'], fanOut: 1 }

// Six paired scenarios. The model is deterministic at production temperature
// (v7 §2), so N is the number of SCENARIOS — repeats of one prompt carry the
// information of one. `tableInEvidence: false` means the trace names the field
// but never its table, which is the C4/C5 shape where the table was dropped.
const SCENARIOS = [
    { id: 's1', table: 'sn_aia_tool', field: 'u_routing_key', tableInEvidence: true },   // = v7 C6
    { id: 's2', table: 'incident', field: 'priority', tableInEvidence: false },          // = v7 C4
    { id: 's3', table: 'task', field: 'assignment_group', tableInEvidence: false },      // = v7 C5
    { id: 's4', table: 'cmdb_ci_server', field: 'u_owner_group', tableInEvidence: true },
    { id: 's5', table: 'sc_req_item', field: 'u_fulfilment_stage', tableInEvidence: true },
    { id: 's6', table: 'change_request', field: 'u_risk_band', tableInEvidence: false },
]

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

function traceResult(scenario) {
    const where = scenario.tableInEvidence ? ' off table ' + scenario.table : ''
    return [
        'status: completed. 1 tool call, no error raised.',
        '',
        'tool_calls:',
        '  #1 lookup_routing_rule (' + scenario.table + ') status=success',
        '     the script read field ' + scenario.field + where + ', got back an empty',
        '     string, branched on it and returned no rows.',
    ].join('\n')
}

function buildPrompt(contract, scenario, holdBlock) {
    const tool = schemaLookupDescription(contract)
    const lines = [
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
        traceResult(scenario),
        '',
        '## Response format',
        '',
        'Respond with exactly one JSON object and nothing else - no prose, no markdown fence. It must be one of:',
        '',
        '  {"action":"tool_call","tool":"<tool name>","args":{...}}',
        '  {"action":"answer","text":"<final answer, once no further tool call is needed>"}',
        '  {"action":"fix_report","report":{...}}',
    ]
    if (holdBlock) {
        lines.push('')
        lines.push(holdBlock)
    }
    return lines.join('\n')
}

// The treatment arm's hold is the DEPLOYED text, read out of PaAgentLoop
// rather than retyped — the v7 hold arms were composed ad hoc and are not
// reproducible from the repo, which is what this closes.
function holdArms() {
    const ctx = loadScriptInclude('PaAgentLoop.js', { JSON: JSON })
    const treatment = new ctx.PaAgentLoop({})._holdBlock(HOLD_GAPS, 'gaps', HOLD_TARGET)
    if (treatment.indexOf(NEW_ITEM1) === -1) {
        throw new Error('_holdBlock does not carry NEW_ITEM1 — Task 2 not applied, or the wording drifted')
    }
    return { treatment: treatment, control: treatment.split(NEW_ITEM1).join(OLD_ITEM1) }
}

const outDir = process.argv[2]
const holdMode = process.argv.indexOf('--hold') !== -1

function write(name, text) {
    fs.writeFileSync(path.join(outDir, name + '.prompt.txt'), text)
    console.log(name, text.length, 'chars')
}

if (!holdMode) {
    // #111's contract A/B, unchanged.
    const arms = { control: OLD_CONTRACT, treatment: NEW_CONTRACT }
    const written = {}
    for (const [arm, contract] of Object.entries(arms)) {
        written[arm] = buildPrompt(contract, SCENARIOS[0], null)
        write(arm, written[arm])
    }
    const same = written.control.split(OLD_CONTRACT).join('@@') === written.treatment.split(NEW_CONTRACT).join('@@')
    console.log('arms differ ONLY in the contract sentence:', same)
    if (!same) process.exit(1)
} else {
    // #116's hold-item-1 A/B. BOTH arms carry the DEPLOYED contract, so the
    // only free variable is item 1.
    const hold = holdArms()
    let allSame = true
    for (const scenario of SCENARIOS) {
        const control = buildPrompt(NEW_CONTRACT, scenario, hold.control)
        const treatment = buildPrompt(NEW_CONTRACT, scenario, hold.treatment)
        write(scenario.id + '.control', control)
        write(scenario.id + '.treatment', treatment)
        const same = control.split(OLD_ITEM1).join('@@') === treatment.split(NEW_ITEM1).join('@@')
        console.log(scenario.id, 'differs ONLY in item 1:', same)
        if (!same) allSame = false
    }
    if (!allSame) process.exit(1)
}
