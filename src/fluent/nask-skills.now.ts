import '@servicenow/sdk/global'
import { NowAssistSkillConfig } from '@servicenow/sdk/core'

/**
 * PaLlmProxy's NASK touchpoint — Phase 1b Task 1, docs/superpowers/plans/2026-08-02-phase1b-harness.md.
 *
 * Two passthrough skills. `pa_llm_reason` (temp 0.2, max 2000 tokens) and
 * `pa_llm_summarize` (temp 0.1, max 1000 tokens), each with ONE `prompt`
 * string input and a template that is exactly `{{prompt}}`. The entire
 * prompt is composed server-side by PaAgentLoop/PaLlmProxy (Task 2) — these
 * skill configs add nothing beyond model/temperature/token-budget selection
 * and the security gate. Golden example:
 * .claude/context/sdk-examples/now-assist-skill.now.ts (Examples 3–4 —
 * minimal shape, plain-string prompt with {{name}} substitution, exactly
 * what the live CC03/cc04/CC05 skill configs on gpinst01 use verbatim —
 * confirmed by reading their stored `sn_nowassist_skill_config` prompt text
 * via MCP during the Step 1 probe below).
 *
 * ===========================================================================
 * STEP 1 PROBE — VERIFIED INVOCATION PATH (2026-08-01/02, gpinst01, admin,
 * via MCP servicenow_skill_execute / servicenow_query — no shell, no guess)
 * ===========================================================================
 *
 * WHAT WAS CALLED: `servicenow_skill_execute({skill, input})`, the MCP
 * wrapper's first strategy is "OneExtend REST API" — the same
 * `sn_one_extend.OneExtendUtil` surface the golden example's RUNTIME
 * INVOCATION COMPANION documents server-side
 * (`OneExtendUtil.executeSecure({executionRequests:[{capabilityId, payload,
 * meta:{skillConfigId}}]})`). A background-script fallback does NOT exist in
 * this MCP server (removed for security, #372) and is not in the Foundry
 * toolset at all (LLD §8 item 4's Phase 0 finding, unchanged) — this MCP
 * tool is the only sanctioned probe surface, and it is the platform's public
 * OneExtend entry point, not a different one.
 *
 * PAYLOAD KEYING: confirmed against three live custom skill configs (CC03
 * "Incident Priority Analyzer" sys_id f37add922bef7210f243fed2ce91bff8, cc04,
 * CC05) via `servicenow_skill_get` — their STORED prompt text on the
 * instrument itself reads `{{shortdescription}}` / `{{fulldescription}}`,
 * i.e. the platform's own native prompt-template format IS the `{{name}}`
 * substitution syntax the brief specifies for `pa_llm_reason` /
 * `pa_llm_summarize`, not the Fluent `(p) => ...${p.input[...]}...` sugar —
 * that sugar compiles down to the same substitution. Payload keys must be
 * the input's INTERNAL (underscore-normalized) name — Rule #38, unaffected
 * here because `prompt` has no space to normalize.
 *
 * RESPONSE ENVELOPE: `resp.capabilities[capabilityId].response` is the model
 * text (golden example's documented shape) — corroborated, not contradicted,
 * by two live calls below that both reached real backend execution and
 * logged a `sys_gen_ai_log_metadata` row with a `status` + `error`/`error_code`
 * pair that lines up with what the MCP tool reported:
 *
 *   1. CC03 (provider "Now LLM Service") — `servicenow_skill_execute` returned
 *      "OneExtend returned status='none'". Root-caused via `sys_one_extend_
 *      capability_definition` (dot-walk `api.active`, the SKILL.md Step Zero
 *      check): the defaulted definition's backing subflow "Now LLM
 *      Integration" is `active=false`. Confirmed instance-wide, not a CC03
 *      quirk — EVERY "Now LLM"/"Chat Completions" `sys_hub_flow` sampled
 *      (Now LLM Integration, Now LLM LTS Integration, Amazon Bedrock Chat
 *      Completions, Azure OpenAI Chat Completions, Google Cloud Chat
 *      Completions - Vertex AI — 23 flows total across both queries) reads
 *      `active=false` right now. This reproduces, on a later date, the exact
 *      finding already on record in the golden example's own header ("Now
 *      LLM Integration" / "Execute Now LLM" / Amazon Bedrock all inactive on
 *      gpinst01) — a known, previously-documented, apparently-toggling
 *      instance condition, not a new defect in the call shape.
 *   2. "Build Agent" (OOB skill, provider routed to Google Cloud Vertex AI)
 *      — `servicenow_skill_execute` returned "OneExtend returned
 *      status='error'". This is a DIFFERENT, more informative failure: the
 *      matching `sys_gen_ai_log_metadata` row (created immediately after,
 *      `definition: "Build Agent (Google Cloud Vertex AI - Chat
 *      Completions)"`) shows `status: error`, `error_code: 400001`, `error:
 *      "Cannot read property '0' from undefined"` — a real backend
 *      execution that ran the provider and failed on my deliberately
 *      malformed test payload (Build Agent's inputs are structured, not a
 *      bare string). The important fact isn't the failure — it's that the
 *      call reached a live provider and produced a real, logged,
 *      structured error. That is the invocation path working end-to-end,
 *      against a payload I knew was wrong.
 *   3. Independent corroboration that GenAI execution is healthy RIGHT NOW
 *      on this instance: `sys_gen_ai_log_metadata` shows a steady stream of
 *      `status: success` rows (every ~4 min, `model_name: claude_large`,
 *      `definition: "LTM Identify memories_Amazon Bedrock"` /
 *      "AIA Identify Episodic Memories (Amazon Bedrock Chat Completions)")
 *      — AIA's own long-term-memory subsystem, invoked internally, calling
 *      Bedrock successfully as of 2026-08-01 23:05 — even though the
 *      `sys_hub_flow` record for "Amazon Bedrock Chat Completions" ALSO
 *      reads `active=false`. Conclusion: a Flow Designer subflow's
 *      `active` checkbox does not reliably gate whether it can still run as
 *      a called subflow — it is a necessary-but-unproven signal (matches the
 *      SKILL.md Step Zero caveat that this is the documented heuristic, not
 *      a guarantee) — and "Now LLM Service" specifically is the one
 *      confirmed-broken path right now, while Bedrock is confirmed-working.
 *
 * DISPOSITION: this is NOT the brief's Step 1 STOP condition. The STOP
 * condition is for a guessed or unverified CALL SHAPE; the call shape here
 * is the one already runtime-validated end-to-end on this exact instance in
 * issue #202 (golden example header), and finding #2 above independently
 * re-confirms it reaches a real provider and returns a structured
 * status/error/response envelope. What's failing is PROVIDER AVAILABILITY on
 * one specific provider string ("Now LLM Service"), which the golden
 * example's own header already flags as a known, recurring, apparently-
 * toggling condition on gpinst01 (healthy again by 2026-07-17 per issue
 * #202, inactive again by 2026-08-01/02 per this probe). Provider selection
 * is exactly the kind of instance-dependent fact `now-sdk explain` and this
 * header call out as unverifiable at Fluent build time (Rule N/A — see the
 * golden example's "PROVIDER AVAILABILITY IS INSTANCE-DEPENDENT" banner).
 *
 * DECISION: build both skills with `provider: 'Now LLM Service'` per the
 * brief's "provider left to instance default" (i.e. the single conventional
 * default, matching golden-example style — not a second, exotic choice).
 *
 * ===========================================================================
 * STEP 4 RESULT (2026-08-01/02, post-install, post-activation)
 * ===========================================================================
 * `api.active` preflight (SKILL.md Step Zero) on the installed `pa llm
 * reason` capability's definition still read `api.active=false` /
 * `api.name="Now LLM Integration"` — the same instance-wide condition from
 * the Step 1 probe. Executed anyway rather than assuming it would fail (the
 * flag is corroborated-unreliable per finding #3 above): BOTH skills
 * returned a real, non-empty completion on the first try —
 *   `servicenow_skill_execute('pa llm reason', {prompt: 'Reply with
 *   exactly one word: OK'})` → `"{\"model_output\": \"OK\"}"` (4836ms)
 *   `servicenow_skill_execute('pa llm summarize', {prompt: 'Reply with
 *   exactly one word: OK'})` → `"{\"model_output\": \"OK\"}"` (3802ms)
 * No `provider: 'Amazon Bedrock'` fallback was needed. Cross-checked against
 * `sys_gen_ai_log_metadata` (`definition: "pa llm reason (Now LLM
 * Service)"`, `model_name: "apriel-nowllm"`, `status: success`) →
 * `sys_generative_ai_log` via `gen_ai_log_id`:
 *   prompt:   `[{"role":"user","content":"Reply with exactly one word: OK"}]`
 *   response: `{"model_output": "OK"}`
 * Two facts this pins down for PaLlmProxy (Task 2), neither guessable from
 * the golden example alone:
 *   1. `{{prompt}}` is substituted verbatim as the sole `content` of a
 *      single `{role:"user"}` chat-completions message — confirms the
 *      skill really does add nothing beyond that wrapping.
 *   2. The skill's `response` OUTPUT ATTRIBUTE is NOT the bare model text —
 *      it is a JSON-STRING-WRAPPED `{"model_output": "<text>"}` object.
 *      `resp.capabilities[capabilityId].response` (golden example's
 *      documented envelope path) is therefore that wrapped string, one
 *      level short of the harness plan's "strict-JSON parse" target:
 *      PaLlmProxy must `JSON.parse(result.response).model_output` (not
 *      `result.response` directly) to reach the model's actual output text,
 *      which is itself where PaLlmProxy's own strict-JSON contract begins.
 *
 * ===========================================================================
 * SKILL NAME: NO UNDERSCORES (build-verified, not assumed)
 * ===========================================================================
 * The brief names these skills `pa_llm_reason` / `pa_llm_summarize`. Fluent
 * `NowAssistSkillConfig.name` rejects that verbatim — `now-sdk build` fails
 * with `TS210: Skill name 'pa_llm_reason' contains invalid character(s): _.
 * Skill names must contain only letters, numbers, and spaces` — the same
 * constraint Rule #12 documents for NowAssist ATTRIBUTE names, here enforced
 * on the SKILL name too. Built as `name: 'pa llm reason'` / `'pa llm
 * summarize'` (spaces); Task 2 must resolve the skill by its `$id`-derived
 * sys_id (`pa-llm-reason-skill` / `pa-llm-summarize-skill` in
 * `src/fluent/generated/keys.ts`) or by this spaced display name, not by the
 * underscored identifier from the brief — there is nowhere on
 * `sn_nowassist_skill_config` that stores an underscored version the way
 * input attributes get an internal name (Rule #38 is about INPUT names
 * specifically; it does not extend to the skill's own `name` field, which
 * has exactly one build-legal spelling here).
 *
 * ===========================================================================
 * ROLE CHOICE
 * ===========================================================================
 * Both skills gate on `x_snc_troubleshoot.admin` (this app's own role,
 * `src/fluent/acls.now.ts` — "operates the Foundry Troubleshooter"), not the
 * golden example's demo `itil` role. These skills are never exposed on the
 * Now Assist panel (no `deploymentSettings` — server-side callers only), so
 * there is no end-user audience to size the role for; the caller is
 * PaLlmProxy running inside this app. `userAccess: {type: 'authenticated'}`
 * + `roleMap: ['x_snc_troubleshoot.admin']` follows Example 3's pattern
 * (`now-assist-skill.now.ts`) rather than `type: 'roles'` with a direct
 * role-sys_id — that variant needs a role sys_id known at Fluent build time,
 * and `x_snc_troubleshoot.admin` is a role this SAME app creates, so no
 * stable sys_id exists to hardcode (unlike the golden example's `itil`,
 * whose OOB sys_id is identical on every instance). `roleMap` takes role
 * NAMES (never `Now.ref` — Rule #21) and this instance is Zurich Patch 10,
 * which meets the ZP10/AP3+ floor `roleMap` requires (SDK 4.7.0+).
 *
 * ⚠ OPEN QUESTION FOR TASK 2: PaLlmProxy's actual execution identity
 * (Script Include called from an async Script Action per a platform event —
 * see the harness plan) is not yet built, so whether that context's session
 * user genuinely holds `x_snc_troubleshoot.admin` is unverified. If
 * `OneExtendUtil.executeSecure()` (ACL-enforced) rejects the real caller,
 * either grant the harness's run-as user the role or switch to
 * `execute()` (not ACL-enforced — SKILL.md notes both are supported,
 * ~20/~15 split in platform code). Record whichever is chosen in
 * PaLlmProxy.js's own header.
 *
 * ===========================================================================
 * FIX ROUND (post-review): one input LITERAL per skill, not a shared object
 * ===========================================================================
 * The first version of this file declared a single `promptOnlyInput` array
 * once, with one `$id: Now.ID['pa-llm-input-prompt']`, and passed the SAME
 * object reference to both `paLlmReason.inputs` and `paLlmSummarize.inputs`.
 * `keys.ts` showed exactly one `pa-llm-input-prompt` entry — a single
 * `sys_one_extend_definition_attribute` record — which the reported Step 4
 * round-trip could not distinguish from "each skill correctly got its own
 * attribute record" (both calls used a `prompt` key regardless of whether
 * the underlying attribute row was shared or duplicated). No golden-example
 * precedent uses a shared input object across two skill configs — every
 * `now-assist-skill.now.ts` example declares its own inline `inputs[]`
 * literal per skill — and `roleMap`, in this very file, already showed the
 * correct contrasting pattern: a separate literal per config, confirmed by
 * `keys.ts` showing two distinct `sys_agent_access_role_mapping` rows.
 *
 * Fixed by giving each skill its own input literal with a distinct `$id`
 * (`pa-llm-reason-input-prompt` / `pa-llm-summarize-input-prompt`) rather
 * than resolving the ambiguity by querying the shared record's associations
 * — the unambiguous route the reviewer preferred. Rebuilt, reinstalled,
 * re-verified `keys.ts` now carries two separate `sys_one_extend_
 * definition_attribute` entries, and re-ran the micro-invocation on BOTH
 * skills post-reinstall (task-1-report.md "Fix round" section has the full
 * command/output pair for both).
 */

export const paLlmReason = NowAssistSkillConfig(
    {
        $id: Now.ID['pa-llm-reason-skill'],
        name: 'pa llm reason',
        shortDescription: 'PaLlmProxy reasoning passthrough',
        description: 'Server-side passthrough LLM call for PaLlmProxy.reason(). The caller composes the entire prompt; this skill adds nothing beyond model/temperature/token-budget selection.',
        state: 'published',
        securityControls: {
            userAccess: { $id: Now.ID['pa-llm-reason-acl'], type: 'authenticated' },
            roleMap: ['x_snc_troubleshoot.admin'],
        },
        inputs: [
            {
                $id: Now.ID['pa-llm-reason-input-prompt'],
                name: 'prompt',
                description: 'The complete prompt text, composed server-side by PaAgentLoop/PaLlmProxy. This skill performs no assembly of its own.',
                mandatory: true,
                dataType: 'string' as const,
            },
        ],
    },
    {
        providers: [
            {
                provider: 'Now LLM Service',
                prompts: [
                    {
                        name: 'Reason Passthrough Prompt',
                        versions: [
                            {
                                $id: Now.ID['pa-llm-reason-prompt-v1'],
                                version: 1,
                                model: 'llm_generic_small',
                                temperature: 0.2,
                                maxTokens: 2000,
                                promptState: 'published',
                                prompt: '{{prompt}}',
                            },
                        ],
                    },
                ],
            },
        ],
    }
)

export const paLlmSummarize = NowAssistSkillConfig(
    {
        $id: Now.ID['pa-llm-summarize-skill'],
        name: 'pa llm summarize',
        shortDescription: 'PaLlmProxy summarization passthrough',
        description: 'Server-side passthrough LLM call for PaLlmProxy.summarize(). The caller composes the entire prompt; this skill adds nothing beyond model/temperature/token-budget selection.',
        state: 'published',
        securityControls: {
            userAccess: { $id: Now.ID['pa-llm-summarize-acl'], type: 'authenticated' },
            roleMap: ['x_snc_troubleshoot.admin'],
        },
        inputs: [
            {
                $id: Now.ID['pa-llm-summarize-input-prompt'],
                name: 'prompt',
                description: 'The complete prompt text, composed server-side by PaAgentLoop/PaLlmProxy. This skill performs no assembly of its own.',
                mandatory: true,
                dataType: 'string' as const,
            },
        ],
    },
    {
        providers: [
            {
                provider: 'Now LLM Service',
                prompts: [
                    {
                        name: 'Summarize Passthrough Prompt',
                        versions: [
                            {
                                $id: Now.ID['pa-llm-summarize-prompt-v1'],
                                version: 1,
                                model: 'llm_generic_small',
                                temperature: 0.1,
                                maxTokens: 1000,
                                promptState: 'published',
                                prompt: '{{prompt}}',
                            },
                        ],
                    },
                ],
            },
        ],
    }
)
