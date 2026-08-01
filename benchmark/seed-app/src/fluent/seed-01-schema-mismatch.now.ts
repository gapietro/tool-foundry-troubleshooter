import '@servicenow/sdk/global'
import { AiAgent, Table, StringColumn, IntegerColumn } from '@servicenow/sdk/core'

/**
 * SEED 1 - tool schema mismatch. Expected layer: tool_schema.
 * Expected fix target: the tool input schema.
 *
 * THE DEFECT, ON PURPOSE: the instructions tell the agent to express priority
 * as a WORD, and the tool passes that word straight through to a column that is
 * an INTEGER choice 1-5. 'critical' is not an integer, so the write does not
 * store it - and gr.update() still reports success, so the agent tells the user
 * the ticket was prioritised.
 *
 * WHY THE COLUMN IS IntegerColumn AND NOT ChoiceColumn (corrected 2026-08-01).
 * This column was originally declared with ChoiceColumn, which emits
 * internal_type=choice, max_length=40 - a STRING-backed column. Verified in
 * dist/: setValue('critical') on a string-backed choice column STORES the
 * literal 'critical'; it does not coerce to empty, and the seed's stated
 * mechanism was therefore false. IntegerColumn + choices emits
 * internal_type=integer (the shape task.priority itself uses on gpinst01:
 * internal_type=integer, choice=1), which is what makes the word/integer
 * mismatch real rather than asserted. Do not "simplify" this back to
 * ChoiceColumn - the column type IS the defect.
 *
 * This seed is also the artifact-paging stressor - the instructions are verbose
 * and multi-step so the trace is LARGE. Paging is the native harness's weakest
 * documented area and the benchmark has to exercise it.
 *
 * Deviation from LLD 7: the target is this app's own table, not incident.
 * R-19 measured that a scoped app cannot always reach a global table, and a
 * seed that fails at the scope boundary tests the wrong layer. Note that the
 * deviation is also what silently changed the column type - LLD 7 targeted
 * incident.priority, a genuine integer field, and the fixture table did not
 * reproduce that until the correction above.
 *
 * Rules: #43 no backtick or backslash-n inside these templates. #32 no $id on
 * tools[]. #34 description is mandatory. #19 the trailing (inputs) is required.
 * R-5 inputs is an ARRAY. #42 the ACLs and ws_access this table needs live in
 * seed-tables-acl.now.ts - without them nobody can insert the bench ticket the
 * seed's own setup step calls for.
 */
export const x_snc_tsbench_ticket = Table({
    name: 'x_snc_tsbench_ticket',
    label: 'Bench Ticket',
    display: 'short_description',

    // Build Rule #42: ws_access gates the REST surface, the ACLs gate the data,
    // and neither implies the other. The seed specs tell an operator to insert a
    // bench ticket and record its sys_id; without this the Table API refuses.
    allowWebServiceAccess: true,

    schema: {
        short_description: StringColumn({ label: 'Short description', maxLength: 160 }),

        // INTEGER-backed choice, 1-5. See the header note - this is the defect.
        priority: IntegerColumn({
            label: 'Priority',
            choices: { '1': 'Critical', '2': 'High', '3': 'Moderate', '4': 'Low', '5': 'Planning' },
            dropdown: 'none',
        }),
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
            // priority_stored is read from a FRESH GlideRecord, not from gr.
            // Reading gr.getValue('priority') straight after gr.update() returns
            // what was SET on the in-memory record, not what the database kept -
            // so the original form would have reported 'critical' as stored even
            // when nothing was stored, hiding the very defect this seed exists to
            // expose. The re-query is what makes the trace evidence truthful.
            script: `(function (inputs) {
    var gr = new GlideRecord('x_snc_tsbench_ticket');
    if (!gr.get(inputs.ticket)) {
        return JSON.stringify({ ok: false, error: 'ticket not found' });
    }
    gr.setValue('priority', inputs.priority);
    gr.update();
    var check = new GlideRecord('x_snc_tsbench_ticket');
    if (!check.get(inputs.ticket)) {
        return JSON.stringify({ ok: false, error: 'ticket vanished after update' });
    }
    return JSON.stringify({ ok: true, ticket: inputs.ticket, priority_requested: inputs.priority, priority_stored: check.getValue('priority') });
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
