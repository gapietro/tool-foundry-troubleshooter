import '@servicenow/sdk/global'
import { AiAgent, Table, StringColumn, IntegerColumn, ChoiceColumn } from '@servicenow/sdk/core'

/**
 * SEED 1 - tool schema mismatch. Expected layer: tool_schema.
 * Expected fix target: the tool input schema.
 *
 * THE DEFECT, ON PURPOSE: the tool declares priority as a free string and the
 * instructions tell the agent to phrase it in words, but the column is an
 * integer choice 1-5. The write coerces to empty and the agent reports success.
 *
 * This seed is also the artifact-paging stressor - the instructions are verbose
 * and multi-step so the trace is LARGE. Paging is the native harness's weakest
 * documented area and the benchmark has to exercise it.
 *
 * Deviation from LLD 7: the target is this app's own table, not incident.
 * R-19 measured that a scoped app cannot always reach a global table, and a
 * seed that fails at the scope boundary tests the wrong layer.
 *
 * Rules: #43 no backtick or backslash-n inside these templates. #32 no $id on
 * tools[]. #34 description is mandatory. #19 the trailing (inputs) is required.
 * R-5 inputs is an ARRAY.
 */
export const x_snc_tsbench_ticket = Table({
    name: 'x_snc_tsbench_ticket',
    label: 'Bench Ticket',
    display: 'short_description',
    schema: {
        short_description: StringColumn({ label: 'Short description', maxLength: 160 }),
        priority: ChoiceColumn({
            label: 'Priority',
            choices: { '1': 'Critical', '2': 'High', '3': 'Moderate', '4': 'Low', '5': 'Planning' },
            dropdown: 'none',
        }),
        escalation_count: IntegerColumn({ label: 'Escalation count' }),
    },
})

export const seed01Agent = AiAgent({
    $id: Now.ID['seed-01-agent'],
    name: 'Seed 01 Ticket Prioritizer',
    description: `Sets the priority on a bench ticket from a description of how urgent it is. Benchmark seed - deliberately broken.`,
    agentRole: `You are a ticket triage assistant. You read a request and set the ticket priority to match its urgency.`,
    securityAcl: {
        $id: Now.ID['seed-01-acl'],
        type: 'Any authenticated user',
    },
    channel: 'nap_and_va',
    agentType: 'internal',
    active: true,
    versionDetails: [
        {
            name: 'V1',
            number: 1,
            state: 'published',
            instructions: `You triage bench tickets. Work through EVERY step below in order and report what you did at each one. Do not skip steps and do not summarise - the operator needs the full working.

Step 1. Restate the request in your own words, then list the factors that bear on urgency: who is affected, how many people, whether there is a workaround, and whether revenue or safety is involved.

Step 2. For each factor in step 1, say whether it raises or lowers the priority, and by how much. Show your reasoning for each one separately.

Step 3. Decide the priority. Express it in WORDS - critical, high, moderate, low, or planning. Never use a number.

Step 4. Call set_ticket_priority with the ticket sys_id and the priority word you chose in step 3.

Step 5. Report the result of the call, then restate the full chain of reasoning from steps 1 to 4 so the operator can audit it.

Step 6. List anything you were unsure about and what evidence would have settled it.`,
        },
    ],
    tools: [
        {
            name: 'set_ticket_priority',
            type: 'script',
            description: `Sets the priority on a bench ticket. Give it the ticket sys_id and the priority as a word - critical, high, moderate, low or planning. Returns the ticket number and the priority that was stored.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    var gr = new GlideRecord('x_snc_tsbench_ticket');
    if (!gr.get(inputs.ticket)) {
        return JSON.stringify({ ok: false, error: 'ticket not found' });
    }
    gr.setValue('priority', inputs.priority);
    gr.update();
    return JSON.stringify({ ok: true, ticket: inputs.ticket, priority_stored: gr.getValue('priority') });
})(inputs);`,
            inputs: [
                {
                    name: 'ticket',
                    description: `The sys_id of the bench ticket to update.`,
                    mandatory: false,
                },
                {
                    name: 'priority',
                    description: `The priority as a word: critical, high, moderate, low or planning.`,
                    mandatory: false,
                },
            ],
        },
    ],
})
