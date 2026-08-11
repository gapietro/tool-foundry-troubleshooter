import '@servicenow/sdk/global'
import { AiAgent } from '@servicenow/sdk/core'

/**
 * SEED 8 - non-terminating tool contract. Expected layer: tool_schema
 * (layer 3).
 * Expected fix target: the TOOL'S OUTPUT CONTRACT - make check_processing_status
 * capable of returning a terminal status, or bound the poll inside the script.
 * NOT the instruction: see "WHY THE INSTRUCTION IS CLEAN" below.
 *
 * Taxonomy provenance: K26 CCL6230 taxonomy T6 (infinite loops), specified as
 * candidate seed 8 in docs/LOW_LEVEL_DESIGN.md section 7 on 2026-08-01 - before
 * the DECISION.md section AG/AH clauses existed. See the provenance note in
 * seed-06-schema-field-missing.now.ts.
 *
 * ===================== DELIBERATE DEVIATION FROM LLD SECTION 7 ==============
 * LLD section 7 specifies seed 8 as EITHER "no completion criteria and
 * directives conflicting with its workflow" OR "a trigger whose condition
 * matches records the agent itself updates (recursive firing)". This file
 * builds NEITHER of those and the substitution is recorded rather than made
 * quietly.
 *
 * The recursive-trigger construction is rejected on SAFETY. gpinst01 is a
 * shared instance. A trigger that fires on records its own agent writes is
 * bounded only by platform recursion guards, and the LLD's own note that it is
 * "guarded by sn_aia.continuous_tool_execution_limit and the 5-runs-per-15-min
 * recursion limit" is an argument about blast radius, not about zero. A seed
 * whose worst case is "degrade the instance every other project shares" is not
 * worth the row it buys, and the benchmark has a standing preference for
 * constructions that cannot escape their fixture - seed 4 was re-targeted in
 * 2026-08-01 for the same class of reason (R-22: build a NEW capability rather
 * than unmap a real one).
 *
 * The conflicting-directives construction is rejected because it puts the
 * defect in the INSTRUCTION, and layer 2 is held by ANCHOR seed 2 in this pass.
 * A new seed duplicating an anchor's layer would spend an out-of-sample slot on
 * the layer the AG/AH clauses were MOST fit to, which is the opposite of what
 * the distribution change is for.
 *
 * (An earlier draft of this paragraph said "seed 7 already owns layer 2". That
 * was true when written and is not now - seed 7 moved to layer 3 when its
 * instruction-bloat half proved unreachable. Corrected rather than deleted,
 * because the rejection still stands and only its stated reason had gone
 * stale.)
 *
 * WHAT IS BUILT INSTEAD, and why it is the same taxonomy entry: the agent
 * polls a status tool that has no terminal state to report, so the ReAct loop
 * re-calls the same tool and the run never converges. That is T6's observable,
 * reached through a bounded, deterministic, fixture-local mechanism that writes
 * no records and fires no triggers.
 *
 * THE CEILING DOES NOT BIND, MEASURED - do not rely on it. This paragraph first
 * claimed the loop is stopped by sn_aia.continuous_tool_execution_limit (read
 * live 2026-08-11: 25). The qualification run made 27 calls and then ended by
 * MODEL GIVE-UP, not by any ceiling. LLD section 7's claim that this
 * construction is "guarded by" that property is therefore not reliable as a
 * bound - which is a second, independent reason the recursive-trigger variant
 * was not built on a shared instance: its stated guard does not hold either.
 *
 * ===================== WHY THE INSTRUCTION IS CLEAN =========================
 * The instruction below is CORRECT and states a real stop condition: poll until
 * the tool reports a terminal status, and report that status. An agent given a
 * tool that could return `complete` would terminate on the first or second
 * call. It loops because the TOOL cannot express completion - its contract
 * returns `in_progress` unconditionally - so the defect is the tool's output
 * contract and the expected layer is 3.
 *
 * This split is load-bearing and it is exactly the trap the seed sets. A
 * diagnosis that reads "the agent has no completion criteria" and files the
 * root cause at layer 2 is the INTUITIVE answer and the wrong one, and
 * scorecard-template.md section A2.2 scores the declared layer, so it scores 0.
 * The instruction is deliberately written so that quoting it back proves the
 * stop condition is present. A correct diagnosis has to notice that the loop
 * is not the agent failing to stop, it is the tool never saying when.
 *
 * The tool DESCRIPTION is likewise written to be honest about its own contract
 * ("returns in_progress while work continues and complete when it finishes") -
 * so the description PROMISES a terminal value the script never returns. That
 * mismatch between the declared contract and the implemented one is the seed,
 * stated in one sentence, and it is the same shape as seed 1's word-typed
 * contract: what the tool says it does and what it does are different, and
 * nothing in the schema is inspectably wrong.
 *
 * QUALIFICATION BAR, empirical and REVISED AFTER MEASUREMENT: a real execution
 * must show the same tool called repeatedly with no change in its result - as a
 * threshold, AT LEAST 10 CALLS TO ONE TOOL in a single run. The stopping
 * mechanism is NOT part of the bar. If a run instead terminates after one or two
 * calls, the seed has not reproduced and its rows are void.
 *
 * The revision is stated rather than absorbed, because relaxing a bar after
 * seeing the result is exactly the move this project's record is vigilant about.
 * As first written the bar required termination ON THE TOOL CEILING and made a
 * COMPLETED run void. The measured run completed, at 27 calls over 7m18s. T6's
 * observable is NON-CONVERGENCE, and 27 identical calls is that observable
 * whichever mechanism finally stopped it, so the bar now tests the phenomenon
 * rather than the stopping mechanism. Nothing about the fixture changed - only
 * the sentence describing what counts as reproducing it. An operator reading the
 * OLD bar would have voided four scored rows on a condition that is not the bar.
 * Measured in benchmark/raw-evidence-seed-qualification-06-08.md.
 *
 * COST NOTE, stated because it is unusual for this app: this seed burns one LLM
 * assist per ReAct turn and runs until the model gives up - 27 calls over 7m18s
 * when measured - so it is the most expensive seed in the set per execution, and
 * it has no platform ceiling bounding it. That is inherent to the
 * taxonomy entry, not an accident of the construction.
 *
 * Rules: #32 no $id on tools[]. #34 description mandatory. #19 trailing
 * (inputs) required. #43 no backtick and no backslash escape inside these
 * templates.
 */
export const seed08Agent = AiAgent({
    $id: Now.ID['seed-08-agent'],
    name: 'Seed 08 Batch Watcher',
    description: `Watches a bench batch job to completion and reports its final status. Benchmark seed - deliberately broken.`,
    agentRole: `You are a batch job monitoring assistant.`,
    securityAcl: {
        $id: Now.ID['seed-08-acl'],
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
            // CLEAN ON PURPOSE. The stop condition is explicit and correct. If
            // check_processing_status could return a terminal value this agent
            // would end on the first call. Do NOT soften this text - a vague
            // instruction moves the defect to layer 2 and destroys the seed.
            instructions: `Watch the batch job you are given until it finishes. Call check_processing_status with the batch reference. It returns a status. The terminal statuses are complete and failed. If the status is terminal, stop polling immediately and report that final status to the user together with the batch reference. If the status is not terminal, call check_processing_status again. Report only the final status once you have it.`,
        },
    ],
    tools: [
        {
            name: 'check_processing_status',
            type: 'script',
            // THE SEEDED DEFECT is the gap between this sentence and the
            // script below it. The description promises a terminal value; the
            // implementation cannot produce one.
            description: `Checks the current status of a bench batch job. Returns in_progress while work continues and complete when it finishes. Give it the batch reference.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    var ref = typeof inputs.batch === 'string' ? inputs.batch : 'BATCH-DEFAULT';
    // No terminal branch exists. There is no clock, no counter and no record
    // consulted - this function is a constant. Whatever the agent does, and
    // however many times it asks, the answer is the same one.
    return JSON.stringify({
        ok: true,
        batch: ref,
        status: 'in_progress',
        percent_complete: 50,
        note: 'work continues'
    });
})(inputs);`,
            inputs: [
                {
                    name: 'batch',
                    description: `The batch reference to check.`,
                    mandatory: false,
                },
            ],
        },
    ],
})
