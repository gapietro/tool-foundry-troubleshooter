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
 *
 * ============ ONE MISSING BINDING, NOT THREE (corrected 2026-08-01) ==========
 * The seed's entire value is that `connection` is the ONLY thing missing. As
 * originally written it was not: dist/ showed api_type=generic, NO api value at
 * all, and `capability` carrying a NAME string where the column is a reference
 * to sys_one_extend_capability. Three missing bindings, so an installed run
 * could fail for any of them and a diagnosis blaming the wrong one would be
 * unfairly scored.
 *
 * The well-formed shape was read off gpinst01 (read-only) rather than guessed.
 * Every one of the 12 sys_one_extend_capability_definition rows on the instance
 * uses api_type=sys_hub_flow with `api` pointing at the provider integration
 * subflow, and `capability` pointing at a sys_one_extend_capability row. This
 * seed now matches that shape exactly, and leaves `connection` empty. Note the
 * instance itself carries a live example of precisely this state - "Generic
 * metadata summarizer (Now LLM Service - Now LLM Generic)" has `api` set and
 * `connection` empty - which is corroboration that an empty connection is a
 * real, reachable condition and not an artifact of how this seed is built.
 *
 * THE PARENT CAPABILITY RECORD IS NOT OPTIONAL. OneExtend is invoked by
 * capability SYS_ID (see the tool script below), so without a
 * sys_one_extend_capability row there is no sys_id to invoke and the seed would
 * be unfixable rather than merely broken.
 */

// The capability itself. This is the record whose sys_id goes into the
// OneExtend envelope's capabilityId after install.
export const seed04CapabilityParent = Record({
    table: 'sys_one_extend_capability',
    $id: Now.ID['seed-04-capability-parent'],
    data: {
        name: 'x_snc_tsbench_unmapped_capability',
        active: true,
    },
})

// The provider binding for that capability - complete except for the one thing
// the seed removes. `api` is the OOB "Now LLM Integration" sys_hub_flow
// (936e514a53b3b110f028ddeeff7b128c), verified present on gpinst01 and the
// value used by every Now LLM Generic definition row on the instance.
//
// NOTE THE REFERENCE FORM, measured in dist/: `capability` takes the exported
// Record OBJECT directly. Writing Now.ID['seed-04-capability-parent'] here
// BUILDS CLEANLY and emits the literal string "seed-04-capability-parent" into
// the capability column - the key name, not a sys_id - which would install a
// dangling reference with no error at build, install or runtime. Same silent
// -phantom-reference family as Build Rules #21 and #33. The object form emits
// the real sys_id (92ff62af516741769c437feb88c80ef3, matching the record
// above). Verify this field in dist/ after any change to it.
export const seed04Capability = Record({
    table: 'sys_one_extend_capability_definition',
    $id: Now.ID['seed-04-capability'],
    data: {
        name: 'x_snc_tsbench_unmapped_capability (Now LLM Service - unmapped)',
        capability: seed04CapabilityParent,
        api_type: 'sys_hub_flow',
        api: '936e514a53b3b110f028ddeeff7b128c',
        // THE DEFECT, AND NOW THE ONLY ONE. Empty = no provider credential
        // alias bound = "capability not mapped to a provider".
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

            // THE ENVELOPE MUST BE THE REAL ONE (corrected 2026-08-01).
            // This previously called OneExtendUtil.execute({capability: '<name>',
            // ticket: ...}) - a flat object keyed by capability NAME. That is not
            // the API. Per .claude/context/sdk-examples/now-assist-skill.now.ts
            // (search executionRequests), the envelope is an ARRAY under
            // executionRequests, and the capability is identified by SYS_ID.
            // The old form could not reach the capability record at all, so it
            // could never have failed on the empty `connection`: it would have
            // died as a malformed-request script error - layer 3, not layer 6 -
            // and an agent correctly reporting the malformed envelope would have
            // been scored a MISS on a seed whose expected answer is genai_stack.
            //
            // REPLACE_WITH_SEED_04_CAPABILITY_SYS_ID is the house placeholder
            // pattern (Build Rule #33): the sys_id only exists after install, and
            // an unreplaced placeholder fails loudly and obviously rather than
            // silently pointing somewhere wrong. Substitute it during seed-04
            // setup - see benchmark/seeds/seed-04-genai-unmapped.md.
            script: `(function (inputs) {
    var capabilityId = 'REPLACE_WITH_SEED_04_CAPABILITY_SYS_ID';
    var resp = sn_one_extend.OneExtendUtil.execute({
        executionRequests: [{
            capabilityId: capabilityId,
            payload: { ticket: inputs.ticket }
        }]
    });
    var cap = resp && resp.capabilities && resp.capabilities[capabilityId];
    var result = (cap && cap.length) ? cap[0] : cap;
    return JSON.stringify({ ok: true, capability_id: capabilityId, result: result });
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
