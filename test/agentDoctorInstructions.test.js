/**
 * The instructions markdown is pasted VERBATIM into a Fluent backtick template
 * in src/fluent/agent-doctor.now.ts. That makes three characters unusable, and
 * the build diagnostics for each of them point somewhere other than the cause.
 *
 * Build Rule #43 documents this for `script` templates. The mechanism is plain
 * TypeScript template-literal semantics, so it applies to `instructions`
 * identically — the rule text just does not say so.
 */

const fs = require('fs')
const path = require('path')

const INSTRUCTIONS_PATH = path.join(__dirname, '..', 'docs', 'agent', 'agent-doctor-instructions.md')

describe('agent-doctor-instructions.md is safe to embed in a Fluent template', () => {
    let text

    beforeAll(() => {
        text = fs.readFileSync(INSTRUCTIONS_PATH, 'utf8')
    })

    it('contains no backtick', () => {
        // A markdown code span is the natural way to write a playbook full of
        // table names, and every one of them closes the template. The build
        // reports TS2796 "missing a comma to separate these two template
        // expressions" at a line nowhere near the backtick.
        const index = text.indexOf('`')
        const context = index === -1 ? '' : text.slice(Math.max(0, index - 60), index + 60)
        expect({ index: index, context: context }).toEqual({ index: -1, context: '' })
    })

    it('contains no template interpolation', () => {
        // ${...} interpolates at BUILD time and never reaches the platform, so
        // the deployed instructions silently lose whatever it referenced.
        expect(text).not.toContain('${')
    })

    it('contains no two-character backslash-n escape', () => {
        // Real newlines are fine — a template literal preserves them. It is the
        // literal backslash-n that TypeScript consumes, emitting a real newline
        // mid-string and leaving the constant unterminated. That one builds and
        // installs cleanly and fails only when the artifact is invoked.
        expect(text).not.toMatch(/\\n/)
    })

    it('states the layer-coverage rule, which is the load-bearing sentence', () => {
        // Not style policing. This sentence is the entire defence against
        // DESIGN.md 97: an agent holding one tool, asked for a root cause, will
        // produce one. If an edit drops it, the agent starts inventing layers
        // 2-7 and the benchmark measures a scoring artifact.
        expect(text).toContain('NOT SWEPT')
        expect(text).toContain('LAYER 1 ONLY')
    })

    it('is short enough not to be instruction bloat', () => {
        // K26 Lab 2: high latency on ReAct-engine steps means instruction
        // bloat, because the prompt is reprocessed every loop iteration. The
        // lab's worked example of "too long" is ~11,000 words. We are
        // diagnosing that failure mode in other people's agents; shipping it
        // here would be a poor advertisement.
        const words = text.split(/\s+/).filter(Boolean).length
        expect(words).toBeLessThan(1200)
    })
})
