import '@servicenow/sdk/global'
import { AiAgent, AiAgenticWorkflow } from '@servicenow/sdk/core'

/**
 * SEED 5 - use case exists but is inactive. Expected layer: wiring.
 * Expected fix target: activation.
 *
 * THE DEFECT, ON PURPOSE: the trigger configuration is inactive. The agent is
 * fine, the instructions are fine, the workflow is published - nothing fires.
 *
 * WHY THIS IS A WORKFLOW AND NOT A BARE AGENT: Build Rule #31. triggerConfig on
 * a bare AiAgent yields a sn_aia_trigger_configuration whose usecase is null,
 * so there is no backing flow and no business rule - the trigger never fires
 * for a DIFFERENT reason than the one this seed is testing, and with no
 * diagnostic signal at all. Only AiAgenticWorkflow creates the sn_aia_usecase
 * record the trigger binds to.
 *
 * TWO GATES, AND THE SEED TESTS WHICH ONE. LLD section 8 item 2 (R-18)
 * established two INDEPENDENT activation gates:
 * sn_aia_trigger_configuration.active and
 * sn_aia_trigger_agent_usecase_m2m.active. A use case reads as inactive when
 * either is off. This seed turns OFF the trigger-configuration gate and leaves
 * the m2m gate ON, so a correct diagnosis has to name the specific gate rather
 * than observe that "something is inactive".
 *
 * MUST BE VERIFIED AT INSTALL, NOT ASSUMED: SDK 4.9.0 deploys triggers INACTIVE
 * by default. active: false below is therefore what we intend AND what the SDK
 * would do anyway - so at Task 12 the m2m gate must be confirmed ON on the
 * instance. If both gates land off, the seed tests nothing and the run is void.
 */
export const seed05Agent = AiAgent({
    $id: Now.ID['seed-05-agent'],
    name: 'Seed 05 Ticket Acknowledger',
    description: `Acknowledges a newly created bench ticket. Benchmark seed - the agent is fine, its trigger is not.`,
    agentRole: `You are an acknowledgement assistant.`,
    securityAcl: {
        $id: Now.ID['seed-05-acl'],
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
            instructions: `A bench ticket has just been created. Acknowledge it by restating its short description and the priority it was given.`,
        },
    ],
})

export const seed05Workflow = AiAgenticWorkflow({
    $id: Now.ID['seed-05-workflow'],
    name: 'Seed 05 Ticket Acknowledgement',
    description: `Fires on bench ticket creation and acknowledges the ticket. Benchmark seed - the trigger configuration is deliberately inactive.`,
    securityAcl: {
        $id: Now.ID['seed-05-workflow-acl'],
        type: 'Any authenticated user',
    },
    team: {
        $id: Now.ID['seed-05-team'],
        name: 'Seed 05 Acknowledgement Team',
        members: [seed05Agent as any],
    },
    versions: [
        {
            name: 'V1',
            number: 1,
            state: 'published',
            instructions: `Delegate to Seed 05 Ticket Acknowledger to acknowledge the newly created bench ticket.`,
        },
    ],
    executionMode: 'autopilot',
    triggerConfig: [
        {
            name: 'Seed 05 Bench Ticket Created',
            active: false,
            channel: 'Now Assist Panel',
            targetTable: 'x_snc_tsbench_ticket',
            triggerFlowDefinitionType: 'record_create',
            triggerCondition: 'active=true',
            objectiveTemplate: 'Acknowledge the newly created bench ticket',
        },
    ],
})
