import '@servicenow/sdk/global'
import { AiAgent, Record } from '@servicenow/sdk/core'

/**
 * SEED 4 - GenAI capability not mapped to a provider.
 * Expected layer: genai_stack. Expected fix target: capability mapping.
 *
 * THE DEFECT, ON PURPOSE: a capability definition whose connection - the bound
 * provider credential alias - is EMPTY. R-18 established that connection is
 * exactly that binding, so an empty one IS the "capability not mapped to a
 * provider" finding this seed needs to produce.
 *
 * SHARED-INSTANCE SAFETY, which is why this seed is shaped this way.
 * LLD 7 carries an explicit warning: do NOT unmap real capabilities. gpinst01
 * is shared. This seed therefore creates its OWN capability definition rather
 * than breaking an existing one. Nothing real is unmapped and no other tenant
 * of the instance is affected. This closes LLD section 8 item 8.
 *
 * INSTALL RISK, not reached by Task 11: sys_one_extend_capability_definition
 * is a GLOBAL table, and a scoped app writing into one may be refused at
 * install. Task 11 verifies only that this BUILDS. If install fails at Task 12,
 * the fallback is the bogus-capability-reference construction described in the
 * seed spec.
 */
export const seed04Capability = Record({
    table: 'sys_one_extend_capability_definition',
    $id: Now.ID['seed-04-capability'],
    data: {
        name: 'x_snc_tsbench_unmapped_capability',
        capability: 'x_snc_tsbench_unmapped_capability',
        api_type: 'generic',
        connection: '',
    },
})

export const seed04Agent = AiAgent({
    $id: Now.ID['seed-04-agent'],
    name: 'Seed 04 Summarizer',
    description: `Summarises a bench ticket through a capability that has no provider bound to it. Benchmark seed - deliberately broken.`,
    agentRole: `You are a summarisation assistant.`,
    securityAcl: {
        $id: Now.ID['seed-04-acl'],
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
            instructions: `Summarise the bench ticket the user names. Use the summarise_ticket tool for the summarisation itself - do not summarise it yourself, because the operator needs the capability path exercised. Report the summary the tool returns.`,
        },
    ],
    tools: [
        {
            name: 'summarise_ticket',
            type: 'script',
            description: `Summarises a bench ticket by invoking the x_snc_tsbench_unmapped_capability GenAI capability. Give it a ticket sys_id. Returns the generated summary.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    var payload = { capability: 'x_snc_tsbench_unmapped_capability', ticket: inputs.ticket };
    var result = sn_one_extend.OneExtendUtil.execute(payload);
    return JSON.stringify({ ok: true, capability: payload.capability, result: result });
})(inputs);`,
            inputs: [
                {
                    name: 'ticket',
                    description: `The sys_id of the bench ticket to summarise.`,
                    mandatory: false,
                },
            ],
        },
    ],
})
