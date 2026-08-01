import '@servicenow/sdk/global'
import { AiAgent, Table, StringColumn } from '@servicenow/sdk/core'

/**
 * SEED 3 - missing data. Expected layer: data. Expected fix target: data seeding.
 *
 * THE DEFECT, ON PURPOSE: the routing table exists, the tool reads it correctly,
 * the instructions are clear - and the table is EMPTY. Every lookup returns
 * nothing. This is the seed that distinguishes a diagnosis of "the data is
 * absent" from one of "the read failed", which look identical from the trace
 * unless the tool reports empty reads explicitly.
 *
 * Table renamed from LLD 7's x_snc_troubleshoot_bench_routing: a scoped table
 * name must begin with its OWN app's scope value (R-13, 40 of 40 sampled tables,
 * no exceptions), and this app is x_snc_tsbench.
 *
 * The table is created with NO seed records. That absence is the defect - do
 * not add rows.
 */
export const x_snc_tsbench_routing = Table({
    name: 'x_snc_tsbench_routing',
    label: 'Bench Routing Rule',
    display: 'category',

    // Build Rule #42, and here it is load-bearing for the MEASUREMENT, not just
    // for convenience. A layer-5 sweep using GlideRecordSecure against a table
    // with no read ACL returns zero rows whether the table is empty or merely
    // unreadable - which would make this seed's "the table is empty" defect
    // indistinguishable from an access denial by the very tool meant to find it.
    // The ACLs in seed-tables-acl.now.ts are the other half; both are required.
    allowWebServiceAccess: true,

    schema: {
        category: StringColumn({ label: 'Category', maxLength: 80 }),
        assignment_group: StringColumn({ label: 'Assignment group', maxLength: 80 }),
    },
})

export const seed03Agent = AiAgent({
    $id: Now.ID['seed-03-agent'],
    name: 'Seed 03 Category Router',
    description: `Routes a request by looking its category up in the bench routing table. Benchmark seed - deliberately broken.`,
    agentRole: `You are a routing assistant. You resolve a category to an assignment group using the routing table, and you never guess.`,
    securityAcl: {
        $id: Now.ID['seed-03-acl'],
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
            instructions: `Route the request to an assignment group.

1. Determine the category of the request.
2. Call lookup_routing_rule with that category to get the assignment group.
3. Report the assignment group you found.

The routing table is the only authority on which group handles which category. Never guess a group name and never invent one.`,
        },
    ],
    tools: [
        {
            name: 'lookup_routing_rule',
            type: 'script',
            description: `Looks up the assignment group for a category in the bench routing table. Give it a category name. Returns the matching assignment group, or reports explicitly that no rule matched.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            // rules_in_table is COUNTED, not asserted. It was previously the
            // literal 0, which handed the diagnostic agent the answer as a
            // constant and would have reported "0 rules" even from a populated
            // table - a tool that lies confidently is the opposite of the
            // honest-empty-read behaviour this seed exists to reward. The count
            // is an unfiltered read of the whole table, so it distinguishes
            // "no rule for THIS category" from "no rules at all".
            script: `(function (inputs) {
    var total = new GlideAggregate('x_snc_tsbench_routing');
    total.addAggregate('COUNT');
    total.query();
    var rulesInTable = total.next() ? parseInt(total.getAggregate('COUNT'), 10) : 0;

    var gr = new GlideRecord('x_snc_tsbench_routing');
    gr.addQuery('category', inputs.category);
    gr.query();
    if (!gr.next()) {
        return JSON.stringify({ ok: true, matched: false, category: inputs.category, rules_in_table: rulesInTable });
    }
    return JSON.stringify({ ok: true, matched: true, category: inputs.category, assignment_group: gr.getValue('assignment_group'), rules_in_table: rulesInTable });
})(inputs);`,
            inputs: [
                {
                    name: 'category',
                    description: `The category to look up in the routing table.`,
                    mandatory: false,
                },
            ],
        },
    ],
})
