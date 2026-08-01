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
 * ================= THE M2M GATE CANNOT BE SET FROM FLUENT =================
 * MEASURED IN dist/, NOT ASSUMED (2026-08-01). Fluent exposes exactly ONE
 * `active` property here, and it feeds sn_aia_trigger_configuration. The m2m
 * record sn_aia_trigger_agent_usecase_m2m has NO Fluent property at all, and
 * the build plugin emits it with active=false, mirroring the trigger config.
 * So a plain install lands BOTH gates off, and the seed cannot express its own
 * specification: with both off, a diagnosis naming either gate is arguably
 * right, the seed isolates nothing, and 2 of the 10 scored rows are void by
 * construction.
 *
 * `active: false` below STAYS - that IS the seeded defect on the
 * trigger-configuration gate, and it is the one gate the seed intends to test.
 * The m2m gate must therefore be flipped ON **post-install**, as a MANDATORY
 * setup step, before any run of this seed is scored:
 *
 *   PATCH /api/now/table/sn_aia_trigger_agent_usecase_m2m/<sys_id>
 *   {"active": "true"}
 *
 * then re-read it and confirm it returns true. See
 * benchmark/seeds/seed-05-inactive-usecase.md ("Setup") and the protocol in
 * benchmark/README.md. IF THIS STEP IS SKIPPED THE SEED IS VOID - record the
 * runs as void rather than scoring them.
 *
 * Note this is NOT the same observation as "SDK 4.9.0 deploys triggers inactive
 * by default". That is true and is why active: false is also what the SDK would
 * have produced anyway; the point here is the stronger one that the OTHER gate
 * is unreachable from this file entirely.
 *
 * OPEN, FOR TASK 12 TO CONFIRM - DO NOT GUESS A VALUE FOR IT: SDK 4.9.0 guidance
 * (.claude/context/sdk-reference.md, "4.9.0 guide hardening") states that
 * trigger run-as configuration is now REQUIRED for all trigger types. This
 * workflow sets no runAs, and dist/ confirms the emitted trigger configuration
 * carries empty run_as, run_as_script and run_as_user. The trigger may therefore
 * still not fire even after the m2m gate is flipped on. If it does not, that is
 * a SECOND wiring defect on top of the seeded one and the seed is not isolating
 * a single cause - resolve it at Task 12 before scoring, and do not invent a
 * run-as sys_id here to pre-empt it.
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
            // The condition must reference a column that EXISTS on the target
            // table. This was previously 'active=true'; x_snc_tsbench_ticket
            // declares only short_description and priority and extends nothing,
            // so there is no `active` column and the condition could never have
            // matched - even with both gates on. A diagnosis naming that bogus
            // condition would have been correct and scored a miss, because the
            // seed's expected answer is the activation gate. short_description
            // is the display column and every setup step sets it, so this
            // condition matches exactly the rows the operator inserts.
            triggerCondition: 'short_descriptionISNOTEMPTY',
            objectiveTemplate: 'Acknowledge the newly created bench ticket',
        },
    ],
})
