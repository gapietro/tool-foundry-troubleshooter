import '@servicenow/sdk/global'
import { AiAgent, Record } from '@servicenow/sdk/core'

/**
 * SEED 4 - GenAI capability not mapped to a provider.
 * Expected layer: genai_stack. Expected fix target: capability mapping.
 *
 * THE DEFECT, ON PURPOSE: a capability definition whose `api` - the MANDATORY
 * pointer at the provider integration subflow that actually runs the call -
 * holds an all-zeros sys_id that resolves to no sys_hub_flow record at all.
 * The capability is real and reachable; the provider behind it is not.
 *
 * SHARED-INSTANCE SAFETY, which is why this seed is shaped this way.
 * LLD 7 carries an explicit warning: do NOT unmap real capabilities. gpinst01
 * is shared. This seed therefore creates its OWN capability definition rather
 * than breaking an existing one. Nothing real is unmapped and no other tenant
 * of the instance is affected.
 *
 * INSTALL RISK, not reached by Task 11: sys_one_extend_capability_definition
 * is a GLOBAL table, and a scoped app writing into one may be refused at
 * install. Task 11 verifies only that this BUILDS. If install fails at Task 12,
 * the fallback is the bogus-capability-reference construction described in the
 * seed spec.
 *
 * ====== THE PREMISE WAS REFUTED, AND THE SEED RE-TARGETED (2026-08-01) ======
 * This seed's defect USED to be an empty `connection`, on the R-18 theory that
 * an empty connection IS "capability not mapped to a provider". R-18 drew that
 * from a TEN-ROW sample. Measured against the whole table on gpinst01,
 * read-only, denominators stated:
 *
 *   - sys_one_extend_capability_definition holds 2026 rows (not 10, not 12).
 *   - 318 of 2026 (15.7%) have `connection` EMPTY, shipped OOB Now Assist
 *     definitions among them.
 *   - sys_dictionary: `connection` is mandatory=FALSE (a reference to
 *     sys_alias). `capability`, `api_type` and `api` are all mandatory=TRUE.
 *
 * So an empty connection is a normal, common, supported state, and after the
 * previous fix wave this record had become a structural clone of working OOB
 * definitions differing only in an optional field. The seed would most likely
 * not have failed at all - a benchmark specimen that measures nothing.
 *
 * WHY `api` IS THE REPLACEMENT, with its counts. Same table, same denominator:
 *   - 1 of 2026 rows has `api` empty (0.05%) - the "Decision" row.
 *   - api_type=sys_hub_flow accounts for 1840 of 2026 rows, spread over 55
 *     distinct `api` values. 54 of those 55 resolve to a live sys_hub_flow;
 *     exactly ONE does not, and it belongs to a single OOB row ("Default
 *     OneExtend Profanity Filter"). So a dangling `api` is 1 row in 2026
 *     (0.05%) - roughly 300x rarer than an empty connection, and genuinely
 *     anomalous rather than routine.
 *   - `api` is internal_type=document_id, so it carries NO referential
 *     integrity: an arbitrary sys_id installs verbatim and resolves to
 *     nothing. That is what makes the failure guaranteed rather than hoped for.
 *
 * The rejected alternative was a dangling `capability` reference. It is also
 * mandatory, but (a) it is a true `reference` column, so the platform may
 * validate or repair it, and (b) breaking it would change the seed's failure
 * signature to "capability not found" and would leave the tool with no sys_id
 * to invoke at all - the fallback construction, not this one.
 *
 * `connection` STAYS EMPTY, and is NO LONGER THE DEFECT. It is left empty
 * because there is no credential alias to bind and because 318 OOB rows do
 * exactly the same; it is deliberately not load-bearing. A diagnosis that
 * names the empty connection as the root cause is naming a normal state and
 * should NOT be scored as a hit - see benchmark/seeds/seed-04-genai-unmapped.md.
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

// The provider binding for that capability - well-formed in every respect
// except the one the seed breaks. The healthy value of `api` for a Now LLM
// Generic definition is the OOB "Now LLM Integration" sys_hub_flow
// 936e514a53b3b110f028ddeeff7b128c (verified present on gpinst01; 422 of the
// 2026 definition rows use it). THAT is what a correct fix restores.
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
        // THE DEFECT. api_type says "the provider is a Flow" and `api` names a
        // sys_hub_flow that does not exist. All zeros on purpose: a maintainer
        // must be able to see at a glance that this is deliberate, which a
        // plausible-looking random GUID would hide. `api` is document_id, so
        // there is no referential integrity to catch it - it installs verbatim
        // and resolves to nothing. Verify this value in dist/ after any change.
        api: '00000000000000000000000000000000',
        // IDENTITY NOTE, measured in generated/keys.ts: this record's identity
        // key is the COMPOSITE {capability, api}. Changing `api` therefore
        // mints a NEW sys_id and marks the old entry deleted:true - it is not
        // an in-place update. That matters because repointing `api` is exactly
        // what fixing this seed means, so a Fluent-side fix re-IDs the record
        // and the runtime capability sys_id (the parent's) is what stays
        // stable. Same identity-churn family as Build Rule #33.
        // NOT the defect, and not scored as one. Empty is the normal state for
        // 318 of the 2026 definition rows on gpinst01 and the column is
        // mandatory=false. Left empty because there is no alias to bind.
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
