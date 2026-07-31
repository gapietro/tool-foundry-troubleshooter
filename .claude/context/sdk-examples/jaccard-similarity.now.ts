/**
 * Golden Example: Jaccard Similarity subsystem
 *
 * A zero-dependency, NO-CORPUS lexical / structural-attribute deduplication utility for
 * ServiceNow: the cheapest tier of the similarity ladder. Jaccard scores two texts by the
 * fraction of their token SETS that overlap (|intersection| / |union|), so it runs even
 * when no corpus exists yet to train TF-IDF (#97) and no embedding backend is available
 * (#100). It is the in-loop duplicate check an AI Agent can call BEFORE a write.
 *
 * This single file defines the subsystem:
 *   1. ScriptInclude JaccardSimilarityUtil — the math (external .js, ES5/Rhino-safe)
 *   2. The AI Agent Script Tool wrapper — shown inline below as the canonical invocation
 *      (a tool-script body, not an SDK metadata type; create the sn_aia_tool record on the
 *      instance and paste this body — confirm the exact sn_aia_tool field/choice names on
 *      instance during build).
 *
 * Pattern reference: context/similarity-jaccard-pattern.md
 * Threshold policy:  context/similarity-dedup-policy-pattern.md (#98, forthcoming) — the
 *                    single canonical home for the suppress/auto-merge/suggest thresholds.
 * Source port:       Now-AI-Foundry/tool-foundry-whiteboard
 *                    server/src/services/dedup/similarity.ts (Jaccard backend)
 *
 * IMPORTANT — scope rename required when copying: replace `x_snc_myapp` with your project's
 * scope prefix in BOTH the AI Agent tool wrapper below AND anywhere you reference the class
 * cross-scope. (The Script Include itself references no table names, unlike the TF-IDF
 * sibling — Jaccard is corpus-free.) Same scope-prefix-rename note as the TF-IDF / Mermaid
 * siblings.
 *
 * PLATFORM CONSTRAINT: the Node original used ES2015 `Set` for token sets. On the
 * ServiceNow server runtime (Rhino, verified on Zurich Patch 8, 2026-05) BOTH `Set` and
 * `Map` are absent, so server/JaccardSimilarityUtil.js uses plain objects keyed by the
 * token string for every set. Do not reintroduce `Set`/`Map`.
 *
 * Key concepts:
 *   - ScriptInclude name MUST match the class name in the script (JaccardSimilarityUtil)
 *   - accessibleFrom: 'public' lets AI Agent Script Tools / cross-scope callers use it.
 *     A tool's own Caller Restriction / caller_access can still gate reach
 *     (confirm on instance during build).
 *   - No table, no Scheduled Job, no corpus — Jaccard compares the two texts directly.
 */

import '@servicenow/sdk/global'
import { ScriptInclude } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Script Include — Jaccard set-math similarity (ES5/Rhino-safe, zero deps, no corpus).
// ---------------------------------------------------------------------------
export const jaccardSimilarityUtil = ScriptInclude({
  $id: Now.ID['jaccard-similarity-util'],
  name: 'JaccardSimilarityUtil',
  description: 'Zero-dependency, no-corpus lexical/structural Jaccard similarity (plain-object token sets, no Set/Map). The lexical fallback tier. Shares the TfidfSimilarityUtil tokenizer.',
  active: true,
  accessibleFrom: 'public',
  script: Now.include('./server/JaccardSimilarityUtil.js'),
})

/**
 * AI Agent Script Tool wrapper — canonical invocation.
 *
 * Create an AI Agent Script Tool (sn_aia_tool, scope sn_aia, type=script) and paste this
 * body. The tool runs a server-side step over an inputs/outputs contract: pass `text1` /
 * `text2` in, set `outputs.result` to a JSON string out. This is what lets an agent call
 * the Script Include as a tool before generating/writing an artifact.
 *
 * NOTE: this wrapper does no GlideRecord access, so the tool-script GlideRecordSecure +
 * addUserEncodedQuery() rule (tool-script-rules.md Rule 2) does not bite here. A wrapper
 * that DOES query records to assemble candidate text must follow that rule — see the
 * policy keystone (#98) tool-wrapper example.
 *
 * (Exact sn_aia_tool field/choice names — e.g. `type` vs `tool_type` — confirm on
 * instance during build.)
 *
 * ```javascript
 * (function execute(inputs, outputs) {
 *   var util = new x_snc_myapp.JaccardSimilarityUtil();
 *   var score = util.calculateSimilarity(inputs.text1, inputs.text2);
 *   outputs.result = JSON.stringify({ score: score, isDuplicate: score >= 0.5, backend: 'lexical' });
 * })(inputs, outputs);
 * ```
 *
 * The `isDuplicate >= 0.5` boolean here is a convenience default for a standalone agent
 * check (a domain-tuned starting point to calibrate, NOT a platform constant). In the
 * full three-tier architecture the policy layer (#98) owns the suppress/merge/suggest
 * decision off the returned `{ score, backend }` — the tool only returns the score.
 */
