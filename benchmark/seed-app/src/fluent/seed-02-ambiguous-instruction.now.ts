import '@servicenow/sdk/global'
import { AiAgent } from '@servicenow/sdk/core'

/**
 * SEED 2 - ambiguous instruction. Expected layer: instruction.
 * Expected fix target: the instruction text.
 *
 * THE DEFECT, ON PURPOSE: "assign it to the right group" with no definition of
 * right, no lookup table, and NO TOOL that could resolve a group. The agent has
 * nothing to reason from and will either invent a group name or stall.
 *
 * Note what is deliberately absent: this agent has NO tools at all. That is the
 * seed. An agent with a group-lookup tool would be testing something else.
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
})
