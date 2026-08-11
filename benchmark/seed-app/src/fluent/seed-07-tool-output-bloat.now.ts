import '@servicenow/sdk/global'
import { AiAgent } from '@servicenow/sdk/core'

/**
 * SEED 7 - unbounded tool return. Expected layer: tool definitions (layer 3).
 * Expected fix target: the TOOL'S RETURN CONTRACT - bound and summarise what
 * read_ticket_context returns (drop the raw feed, or cap it and return named
 * fields). NOT the instruction, and NOT the table.
 *
 * Taxonomy provenance: K26 CCL6230 taxonomy T4 (high latency), the "tool output
 * bloat" cause, specified as candidate seed 7 in docs/LOW_LEVEL_DESIGN.md
 * section 7 on 2026-08-01 - before the DECISION.md section AG/AH clauses
 * existed, which is what makes this seed out-of-sample for them.
 *
 * ============ WHAT THIS SEED WAS FIRST, AND WHY IT MOVED ==================
 * LLD section 7 names BOTH halves of the K26 Lab 2 pair for this slot -
 * instruction bloat and tool output bloat. It was first built as the
 * INSTRUCTION-bloat half, at layer 2, and that half is NOT REACHABLE on this
 * instance. Measured on gpinst01, 2026-08-11, three builds:
 *
 *   instruction 9,762 chars    -> LLM P95 4,770ms
 *   instruction 167,530 chars  -> LLM P95 11,757ms, slowest gen_ai step 12,082ms
 *   instruction 305,589 chars  -> LLM P95 11,997ms, slowest gen_ai step 12,269ms
 *
 * Nearly DOUBLING the instruction from 167k to 305k moved the slowest gen_ai
 * step by 187ms - 1.5%. The curve is saturated, almost certainly by a prompt
 * truncation cap, and PaToolAgentTrace flags instruction_bloat only when a
 * gen_ai step exceeds LLM_SLOW_MS = 15000ms. So no practical instruction size
 * produces the flag.
 *
 * The obvious alternative - lower LLM_SLOW_MS - is FORBIDDEN here, and the
 * reason is worth stating because it will come up again: DECISION.md section AN
 * holds the harness and the clauses fixed and changes only the seed
 * distribution. Retuning a detection threshold in the same pass that changes
 * the distribution confounds the two and spends the out-of-sample check. The
 * threshold question is real and is filed as its own work.
 *
 * So this slot keeps its taxonomy entry and its K26 Lab 2 provenance, and moves
 * to the half that IS reachable: tool output bloat, which trips on
 * RESPONSE_BLOAT_CHARS = 20000 and is a property of the tool rather than of the
 * model's prompt-processing speed. The layer moves from 2 to 3 with it, because
 * the defect is now the tool's contract rather than the agent's instructions.
 *
 * ===================== THE DEFECT, ON PURPOSE =============================
 * read_ticket_context returns the ticket correctly AND appends
 * `raw_context_feed`, 57,650 characters of unfiltered operational
 * event lines with no bearing on the task. Nothing errors, the classification
 * is CORRECT, and the run completes - the cost is that every later ReAct turn
 * re-reads the whole blob from the scratchpad, which is precisely the
 * compounding K26 Lab 2 describes and precisely what PaToolAgentTrace's own
 * remediation string says ("Oversized tool output accumulates in the
 * scratchpad and is re-read on every later turn, so the cost compounds").
 *
 * WHY THE INSTRUCTION IS SHORT AND CLEAN, deliberately. The earlier
 * instruction-bloat build left a 305,589-character instruction in this file. It
 * is REMOVED rather than kept as a decoy, because leaving it would put a second
 * genuine defect beside the seeded one and the seed would stop isolating a
 * single cause - the condition seed 5's spec names as disqualifying. The
 * instruction below states the task and nothing else.
 *
 * HOW THIS DIFFERS FROM SEED 8, which is also layer 3. Seed 8's tool cannot
 * express COMPLETION, so the loop never converges; this seed's tool completes
 * on the first call and returns too MUCH. Same layer, opposite failure, and
 * both fixes are edits to a return contract - which is exactly what makes the
 * pair worth having: scorecard-template.md section A2.2 scores the declared
 * layer, and two seeds agreeing on the layer while disagreeing on the mechanism
 * is a test of whether that clause resolves or merely matches.
 *
 * THE DECOY, and it costs nothing to build. The ticket's `priority` is EMPTY on
 * every pre-existing bench ticket, because seed 1's defect is that priority is
 * never stored. A diagnosis that seizes on the empty priority is reaching for a
 * layer-5 data finding that is (a) another seed's defect and (b) not why this
 * run is slow. The seed spec records it so a scorer meets the ruling rather
 * than inventing one.
 *
 * QUALIFICATION BAR, empirical: a real execution must COMPLETE and its
 * read_ticket_context call must record a response_length above 20000 on
 * sn_aia_tools_execution. NOTE that sn_aia_tools_execution is not readable
 * through the foundry MCP broker as admin ("Access denied: Insufficient
 * rights", verified 2026-08-11 with and without a fields filter), so the
 * response length is confirmed by OBSERVING the harness surface the
 * tool_output_bloat flag - the same route by which seed 4's efficacy was closed
 * at LLD section 8 item 8, observed rather than inferred. Recorded in
 * benchmark/raw-evidence-seed-qualification-06-08.md.
 *
 * Rules: #32 no $id on tools[]. #34 description mandatory. #19 trailing
 * (inputs) required. #43 the padding is built with String.fromCharCode(10)
 * rather than a newline escape, because escapes inside a Fluent script template
 * are consumed by TypeScript and would unterminate the string constant.
 */
export const seed07Agent = AiAgent({
    $id: Now.ID['seed-07-agent'],
    name: 'Seed 07 Ticket Classifier',
    description: `Classifies a bench ticket into a support category. Benchmark seed - deliberately broken.`,
    agentRole: `You are a support ticket classification assistant.`,
    securityAcl: {
        $id: Now.ID['seed-07-acl'],
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
            // SHORT AND CLEAN ON PURPOSE - see the header. The defect is the
            // tool's return, not this text. Do NOT re-bloat this instruction.
            instructions: `Classify the bench ticket you are given. Call read_ticket_context with the ticket sys_id to retrieve it, then assign one category from this list: ACCESS, HARDWARE, APPLICATION, NETWORK, MESSAGING, or GENERAL. Report the category and the ticket short description back to the user in one sentence.`,
        },
    ],
    tools: [
        {
            name: 'read_ticket_context',
            type: 'script',
            description: `Reads one bench ticket by sys_id and returns it together with the raw operational context feed. Give it the ticket sys_id.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            // THE SEEDED DEFECT is raw_context_feed. Everything above it in the
            // return is correct, bounded and useful; the feed is 57,650 chars
            // of material the classification never consults. Do NOT "fix" this
            // by trimming the feed - it is the fixture.
            script: `(function (inputs) {
    var id = typeof inputs.ticket === 'string' ? inputs.ticket : '';
    var out = { ok: false, error: 'ticket sys_id missing or not found' };
    if (!id) {
        return JSON.stringify(out);
    }
    var gr = new GlideRecord('x_snc_tsbench_ticket');
    if (!gr.get(id)) {
        return JSON.stringify(out);
    }
    out.ok = true;
    out.error = '';
    out.short_description = String(gr.getValue('short_description') || '');
    out.priority = String(gr.getValue('priority') || '');

    var NL = String.fromCharCode(10);
    var lines = [];
    for (var i = 0; i < 260; i++) {
        lines.push(
            'ctx.event seq=' + i +
            ' source=operational_feed severity=info' +
            ' node=app-node-' + (i % 17) +
            ' region=eu-west-' + (i % 3) +
            ' latency_ms=' + (40 + (i * 7) % 900) +
            ' queue_depth=' + (i % 64) +
            ' detail=no-classification-relevant-content-in-this-record-it-is-here-to-be-unfiltered-raw-feed-material'
        );
    }
    out.raw_context_feed = lines.join(NL);
    return JSON.stringify(out);
})(inputs);`,
            inputs: [
                {
                    name: 'ticket',
                    description: `The sys_id of the bench ticket to read.`,
                    mandatory: false,
                },
            ],
        },
    ],
})
