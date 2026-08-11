import '@servicenow/sdk/global'
import { AiAgent } from '@servicenow/sdk/core'

/**
 * SEED 6 - the queried column does not exist. Expected layer: data schema
 * (layer 4).
 * Expected fix target: the TABLE SCHEMA - add the `category` column to
 * x_snc_tsbench_ticket (or, equivalently and stated as acceptable in the seed
 * spec, repoint the tool at a column the dictionary actually declares). NOT
 * "seed the table": see the decoy note below.
 *
 * ============ WHY THIS SEED EXISTS, AND WHAT IT REPLACED =================
 * This slot was originally specified as K26 CCL6230 taxonomy T1, ACL-trigger
 * misalignment (LLD section 7, candidate seed 6). That construction was BUILT,
 * INSTALLED AND MEASURED on gpinst01 on 2026-08-11, and it does not reproduce:
 *
 *   - attempt 1, securityAcl 'Specific role' only - execution
 *     f47403872ba2031017a6ffbeee91bf33, state=completed, state_reason empty.
 *     sys_agent_access_role_configuration held ZERO rows for the agent, because
 *     securityAcl writes sys_security_acl (the INVOCATION acl) and not the
 *     access-role configuration.
 *   - attempt 2, dataAccess.roleList added, emitting
 *     sys_agent_access_role_configuration 1bdce07b54ff4181bb893435d31d3eb6 with
 *     action=limit_to_roles and the real role sys_id - execution
 *     4f05430b2bea0310f243fed2ce91bfd8, state=completed again.
 *
 * ROOT CAUSE of the non-reproduction, and it is a fact worth keeping: K26 Lab 1
 * is TRIGGER-SCOPED by construction. The lab's mechanism is that a TRIGGER
 * invokes the agent under the INITIATING USER's context and that user's roles
 * fail the check. The benchmark captures seed executions by direct REST
 * invocation as admin, and admin passes the check - `access_verification`
 * appears as its own execution task type and returned in 371ms. Reproducing T1
 * therefore needs an active trigger AND a second, non-privileged identity, and
 * LLD section 7 lists trigger `run_as` as an unresolved question; a trigger
 * that would not fire on empty run_as is a SECOND wiring defect layered on the
 * seeded one, which is the exact condition seed 5's spec says stops a seed
 * isolating a single cause.
 *
 * The T1 seed is therefore deferred rather than abandoned, and this slot is
 * filled by a defect the benchmark's capture shape can actually hold.
 *
 * PROVENANCE, stated honestly because it is weaker than seeds 7 and 8's. Seeds
 * 7 and 8 are out-of-sample because their taxonomy entries were chosen on
 * 2026-08-01, before the DECISION.md section AG/AH clauses existed. This seed
 * was chosen AFTER those clauses, so that argument is not available to it.
 * What it has instead is an external, pre-existing selection criterion: layer 4
 * is covered by NO seed in the set. DESIGN.md R-21 recorded the layer-coverage
 * gap on 2026-08-01 and scorecard-template.md section E2 maps layer 4 to
 * `schema_lookup`, a tool with no seed pointing at it. The slot was picked by
 * the coverage table, not by reading the clauses - but a reader is entitled to
 * discount it relative to seeds 7 and 8, and DECISION.md section AN says so on
 * the face of the pre-registration rather than leaving it to be noticed.
 *
 * ===================== THE DEFECT, ON PURPOSE =============================
 * The agent is asked to report hardware tickets. `count_by_category` filters
 * x_snc_tsbench_ticket on a `category` column. That column DOES NOT EXIST -
 * the table declares exactly two non-system columns, short_description and
 * priority (read live from sys_dictionary on gpinst01, 2026-08-11). The
 * addQuery condition therefore matches nothing, the tool returns zero, and the
 * agent truthfully reports that there are no hardware tickets.
 *
 * NOTHING ERRORS. The tool succeeds, the run completes, the answer is fluent
 * and wrong. That is the seed: a silent wrong answer whose cause is invisible
 * from the trace alone and requires reading the table's DICTIONARY - which is
 * what layer 4 is and what `schema_lookup` is for.
 *
 * THE DECOY IS FREE AND IT IS THE WHOLE POINT. The table is NOT empty - it
 * holds 15+ bench tickets. So "the table has no data" (layer 5, which is seed
 * 3's actual defect) is the tempting wrong diagnosis, and it is refutable by a
 * single unfiltered query. A diagnosis filing the primary root cause at layer 5
 * scores 0 on root_cause_layer_correct, and a fix target of "seed the table"
 * scores 0 on fix_target_correct: seeding it would not help, because the filter
 * would still match nothing. No extra construction was needed to build this
 * decoy - it is a consequence of the fixture already being populated, which is
 * why this seed is cheap in a way the T1 construction was not.
 *
 * HOW THIS DIFFERS FROM SEED 1, which is also about a column. Seed 1's column
 * EXISTS and the defect is that the tool passes a word into an Integer - a
 * TYPE-CONTRACT defect in the tool, layer 3. Here the tool's typing is fine and
 * the column is ABSENT - a SCHEMA defect, layer 4. Both present as "the value
 * is not what you expected"; only a dictionary read separates them, and the two
 * seeds together are what make that distinction measurable.
 *
 * QUALIFICATION BAR: a real execution must COMPLETE (not error) and must report
 * zero or no hardware tickets while the table demonstrably holds rows. If the
 * run errors, the seed has become a layer-3 defect and has not reproduced.
 * Measured in benchmark/raw-evidence-seed-qualification-06-08.md.
 *
 * Rules: #32 no $id on tools[]. #34 description mandatory. #19 trailing
 * (inputs) required. #43 no backtick and no backslash escape in these
 * templates.
 */
export const seed06Agent = AiAgent({
    $id: Now.ID['seed-06-agent'],
    name: 'Seed 06 Hardware Reporter',
    description: `Reports how many bench tickets fall in a given category. Benchmark seed - the column it filters on does not exist.`,
    agentRole: `You are a reporting assistant for the bench ticket queue.`,
    securityAcl: {
        $id: Now.ID['seed-06-acl'],
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
            // Clean and unambiguous - seed 2 owns the instruction defect. The
            // instruction does not tell the agent how the category is stored,
            // because a correct agent should not need to know and because
            // naming the column here would hand the diagnosis over for free.
            instructions: `Report how many bench tickets are in the category the user names. Call count_by_category with that category. State the number back to the user in one sentence, and name the category you counted.`,
        },
    ],
    tools: [
        {
            name: 'count_by_category',
            type: 'script',
            description: `Counts bench tickets in one category. Give it the category name, for example hardware or network.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            // THE SEEDED DEFECT is addQuery('category', ...) on a table with no
            // `category` column. GlideRecord does not throw on an unknown field
            // in a query condition - it matches nothing - so this returns a
            // successful zero rather than an error. The tool is otherwise
            // correct: it is side-effect-free, it bounds nothing it should
            // bound, and its typing is sound. Do NOT "fix" this script; it is
            // the fixture.
            script: `(function (inputs) {
    var category = typeof inputs.category === 'string' ? inputs.category : '';
    if (!category) {
        return JSON.stringify({ ok: false, error: 'no category supplied' });
    }
    var gr = new GlideRecord('x_snc_tsbench_ticket');
    gr.addQuery('category', category);
    gr.query();
    var matched = [];
    while (gr.next()) {
        matched.push(String(gr.getValue('short_description') || ''));
    }
    return JSON.stringify({
        ok: true,
        category: category,
        count: matched.length,
        tickets: matched
    });
})(inputs);`,
            inputs: [
                {
                    name: 'category',
                    description: `The category to count, for example hardware.`,
                    mandatory: false,
                },
            ],
        },
    ],
})
