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

describe('the Fluent agent carries the instructions verbatim', () => {
    // Task 10's verification step says "verify the deployed instructions match
    // the markdown". Half of that is checkable offline and permanently: the
    // Fluent file must contain the markdown byte-for-byte. The other half - that
    // what INSTALLED matches what was built - is the live check in Task 4.
    //
    // Two copies of a 700-word document drift silently. This is the guard.
    it('src/fluent/agent-doctor.now.ts contains the markdown byte-for-byte', () => {
        const md = fs.readFileSync(INSTRUCTIONS_PATH, 'utf8').trim()
        const fluent = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        expect(fluent).toContain(md)
    })

    it('declares no triggerConfig', () => {
        // Build Rule #31: triggerConfig on a bare AiAgent yields a trigger whose
        // usecase is null. It never fires, and nothing reports that it did not.
        //
        // A bare substring check cannot tell "the property is declared" from
        // "the property is discussed" - and this file's job includes
        // discussing it (the rule-citation comments above name the hazards
        // they warn about, on purpose). So strip comments first, then assert
        // against the stripped source, anchored to what actually matters: a
        // declared property key, not the word appearing anywhere at all.
        const fluent = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        const code = fluent
            .replace(/\/\*\*[\s\S]*?\*\//g, '') // strip block comments
            .replace(/\/\/.*$/gm, '') // strip line comments
        expect(code).not.toMatch(/^\s*triggerConfig\s*:/m)
    })

    it('uses no Now.ref anywhere', () => {
        // Build Rules #21 and #33: Now.ref in the AI family emits a random
        // build-time GUID with no lookup key retained, so it installs verbatim
        // pointing at nothing. Silent at build, install, and in the logs.
        //
        // Same reasoning as the triggerConfig guard above: a bare substring
        // check cannot tell "Now.ref is called" from "Now.ref is discussed in
        // a comment warning against it" - so strip comments first, then
        // assert against the stripped source, anchored to an actual call.
        const fluent = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        const code = fluent
            .replace(/\/\*\*[\s\S]*?\*\//g, '') // strip block comments
            .replace(/\/\/.*$/gm, '') // strip line comments
        expect(code).not.toMatch(/Now\.ref\s*\(/)
    })

    it('ends both wrapper IIFEs with the required (inputs) invocation', () => {
        // Build Rule #19: without the trailing (inputs) the runtime receives a
        // function object instead of a JSON string. Builds clean, installs
        // clean, fails only when the tool is called.
        const fluent = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        const invocations = fluent.match(/\}\)\(inputs\);/g) || []
        expect(invocations.length).toBe(2)
    })
})
