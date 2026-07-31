/**
 * VALIDATED — Built clean (zero diagnostics) against SDK 4.6.0 via the build.yml
 * CI flow on 2026-05-29. The companion implementation `./server/MermaidStructuralComparator.js`
 * also passes its functional suite (16/16) running under Node. Copy the server/ directory
 * alongside this file when adapting the example to a real project.
 *
 * Golden Example: ScriptInclude — MermaidStructuralComparator
 *
 * Detects structurally duplicate Mermaid flowchart diagrams using weighted Jaccard
 * similarity (60% nodes / 40% edges). Useful for any agent workflow that generates
 * Mermaid diagrams (runbooks, process docs, architecture flows) and needs to avoid
 * storing structurally equivalent duplicates.
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/script-include
 * Import:   import { ScriptInclude } from '@servicenow/sdk/core'
 *
 * Companion implementation: ./server/MermaidStructuralComparator.js (ES5/Rhino-safe,
 * zero external dependencies). Copy that file alongside this one when adapting.
 *
 * Pattern reference: context/similarity-mermaid-structural-pattern.md
 * Source port:       Now-AI-Foundry/tool-foundry-whiteboard
 *                    server/src/services/dedup/mermaid-comparator.ts
 *
 * Key concepts:
 *   - name MUST match the class name in the script (`MermaidStructuralComparator`)
 *   - accessibleFrom: 'public' allows AI Agent Script Tools / cross-scope callers to use it
 *   - Use Now.include() for the external .js file (recommended for non-trivial scripts)
 *   - Server-side utility only — not client-callable (no GlideAjax surface)
 *
 * Usage from an AI Agent Script Tool (input {text1, text2} → output {score, isDuplicate}):
 *   var c = new MermaidStructuralComparator();
 *   var score = c.compareDiagrams(inputs.text1, inputs.text2);
 *   return JSON.stringify({ score: score, isDuplicate: score >= 0.6 });
 */

import '@servicenow/sdk/global'
import { ScriptInclude } from '@servicenow/sdk/core'

export const mermaidStructuralComparator = ScriptInclude({
  $id: Now.ID['mermaid-structural-comparator'],
  name: 'MermaidStructuralComparator',
  description: 'Detects structurally duplicate Mermaid flowchart diagrams via weighted Jaccard similarity (60% nodes / 40% edges). Zero external dependencies.',
  active: true,
  accessibleFrom: 'public',
  script: Now.include('./server/MermaidStructuralComparator.js'),
})
