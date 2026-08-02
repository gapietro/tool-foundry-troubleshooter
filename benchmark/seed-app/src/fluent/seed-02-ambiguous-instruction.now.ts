import '@servicenow/sdk/global'
import { AiAgent } from '@servicenow/sdk/core'

/**
 * SEED 2 v2 - ambiguous instruction. Expected layer: instruction.
 * Expected fix target: the instruction text.
 *
 * THE DEFECT, ON PURPOSE: "assign it to the right group" with no definition of
 * right, no group list, and no tool that could resolve one. The agent must
 * either invent a group name or stall - and either behavior is driven by the
 * instruction, not by anything mechanical.
 *
 * WHY THERE IS NOW A TOOL (v2, DECISION.md section D2, issue #45). The v1
 * construction bound NO tools, on the theory that absence was the purest form
 * of the defect. Measured at Task 12: the ReAct engine CANCELS a tool-less
 * agent before the LLM is ever invoked (execution 11bd8d882baa4314f243fed2ce91bfb3,
 * 737ms, output digest {}), so the ambiguity was never reached and both scored
 * runs could only diagnose the zero-tool binding - layer 3, not layer 2. One
 * weak tool is the minimum that makes the engine enter its loop.
 *
 * measure_request is chosen to keep the defect purely instructional: it
 * consumes the request text (so the model will plausibly call it and the loop
 * genuinely runs), it is side-effect-free, and it is structurally incapable of
 * resolving a group. DO NOT give this tool - or any future addition - group,
 * routing or assignment vocabulary or capability: the sanctioned fix for this
 * seed is "name the groups, or supply a lookup tool", and a tool that even
 * hints at lookup either moves the defect to layer 3 or makes the fix appear
 * already applied. test/seed02Construction.test.js (main repo) guards this.
 *
 * The instructions are UNCHANGED from v1, byte for byte - the defect under
 * test must not move between the v1 benchmark and the Phase 1b comparison
 * re-run.
 *
 * Prediction, not yet measured: with one tool bound the engine enters its
 * loop, the model measures the request, and the instruction then forces it to
 * invent a group or stall. The comparison re-run is what measures this - the
 * seed spec records it as a prediction banner.
 *
 * Rules: #43 no backtick or backslash escapes inside these templates (word
 * count uses split(' '), not a regex, for exactly that reason). #32 no $id on
 * tools[]. #34 description is mandatory. #19 the trailing (inputs) is
 * required. R-5 inputs is an ARRAY. R-9 the input may be absent.
 */
export const seed02Agent = AiAgent({
    $id: Now.ID['seed-02-agent'],
    name: 'Seed 02 Request Router',
    description: `Routes an incoming request to the correct assignment group. Benchmark seed - deliberately broken.`,
    agentRole: `You are a request routing assistant.`,
    securityAcl: {
        $id: Now.ID['seed-02-acl'],
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
            instructions: `Read the incoming request and assign it to the right group. Be accurate - assigning to the wrong group delays the requester. Confirm the assignment back to the user when you are done.`,
        },
    ],
    tools: [
        {
            name: 'measure_request',
            type: 'script',
            description: `Measures an incoming request: returns its character count and an approximate word count. Give it the request text.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    var text = typeof inputs.text === 'string' ? inputs.text : '';
    var words = 0;
    var parts = text.split(' ');
    for (var i = 0; i < parts.length; i++) {
        if (parts[i]) words++;
    }
    return JSON.stringify({ received: true, characters: text.length, words: words });
})(inputs);`,
            inputs: [
                {
                    name: 'text',
                    description: `The request text to measure.`,
                    mandatory: false,
                },
            ],
        },
    ],
})
