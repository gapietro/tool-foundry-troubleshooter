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

    it('names every tool and the layer it sweeps', () => {
        // Replaces the old 'LAYER 1 ONLY' assertion, which was true of the
        // two-tool build and is now false. The guard it provided still matters:
        // an agent asked for a root cause will produce one, so the instructions
        // must tie each claim to a tool that can actually check it.
        ;['agent_trace', 'agent_config', 'schema_lookup', 'query_table', 'genai_log', 'log_analysis', 'read_artifact'].forEach(
            (tool) => {
                expect(text).toContain(tool)
            }
        )
    })

    it('keeps the layer-coverage discipline now that every layer has a tool', () => {
        // The defence against DESIGN.md R-3's finding — premature completion
        // surfaces as `completed` and is indistinguishable from a genuine
        // finish. With seven tools the risk INVERTS: a skipped layer now looks
        // like a choice rather than a gap, so the report has to state which
        // were skipped and why.
        expect(text).toContain('NOT SWEPT')
        expect(text).toContain('UNAVAILABLE')
        expect(text).toMatch(/CHOSE not to sweep/)
    })

    it('carries the two limits the tools cannot check past', () => {
        // Both are measured facts that an agent will otherwise paper over:
        // syslog is blocked by a caller restriction this app cannot lift
        // (R-19), and User Access vs Data Access has no structural field to
        // read (R-18a / R-23).
        expect(text).toMatch(/log layer was NOT swept|platform log layer was NOT swept/)
        expect(text).toMatch(/instance administrator/)
        expect(text).toMatch(/Never report that both lists check out/)
    })

    it('carries the derive-the-table rule (DECISION.md §D4)', () => {
        // Measured at Task 12: three runs guessed table names instead of
        // deriving them; one produced a false secondary finding ("table does
        // not exist" for a name the instance holds under its real prefix) plus
        // a fix proposing to create a table that exists. The tools behaved
        // correctly — the diagnosis layer misused them.
        expect(text).toMatch(/Derive table names/i)
        expect(text).toMatch(/finding about the guess/)
    })

    it('carries the definition-row rule (DECISION.md §D3)', () => {
        // Measured at Task 12: S4's doubled runs split on exactly this — run 2
        // read only the parent capability record, declared the empty
        // connection the primary cause, and proposed a well-formed no-op fix.
        // The definition row is where the mandatory bindings live, and the
        // capability argument (issue #46) is what makes it reachable.
        expect(text).toContain('sys_one_extend_capability_definition')
        expect(text).toMatch(/never a root cause on its own/)
        expect(text).toMatch(/capability name or sys_id/)
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

    it('ends every wrapper IIFE with the required (inputs) invocation', () => {
        // Build Rule #19: without the trailing (inputs) the runtime receives a
        // function object instead of a JSON string. Builds clean, installs
        // clean, fails only when the tool is called.
        const fluent = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        const invocations = fluent.match(/\}\)\(inputs\);/g) || []
        expect(invocations.length).toBe(7)
    })

    it('registers exactly the seven tools the agent declares, under the same names', () => {
        // DESIGN.md R-20 makes completeness DERIVED: how many layers a run
        // swept is the distinct tool_name set over its audit rows, and the
        // registry key is what lands in that column. A name that drifts from
        // the Fluent entry makes a full sweep look partial, and the benchmark
        // then scores the drift instead of the diagnosis.
        const fluent = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        const adapter = fs.readFileSync(
            path.join(__dirname, '..', 'src', 'server', 'PaScriptToolAdapter.js'),
            'utf8'
        )

        const declared = (fluent.match(/invoke\('(\w+)'/g) || []).map((m) => m.replace(/invoke\('|'/g, ''))
        const registered = (adapter.match(/^\s{12}(\w+): function \(\) \{/gm) || []).map((m) =>
            m.trim().replace(/: function \(\) \{/, '')
        )

        expect(declared.sort()).toEqual(registered.sort())
        expect(declared).toHaveLength(7)
    })
})

describe('our own tools meet the bar agent_config scores customer tools against', () => {
    // The K26 Lab 3 checklist is not advice we only give out: agent_config
    // scores every customer tool against it, and shipping tools that fail our
    // own check would be a poor advertisement. This runs the real checker over
    // the real descriptions.
    const fs2 = require('fs')
    const path2 = require('path')
    const { loadScriptInclude } = require('./_loadScriptInclude')

    function ourTools() {
        const fluent = fs2.readFileSync(
            path2.join(__dirname, '..', 'src', 'fluent', 'agent-doctor.now.ts'),
            'utf8'
        )
        const entries = []
        const re = /name: '(\w+)',\s*\n\s*type: 'script',\s*\n\s*description: `([\s\S]*?)`,\s*\n\s*executionMode/g
        let m
        while ((m = re.exec(fluent)) !== null) {
            entries.push({ name: m[1], description: m[2] })
        }
        return entries
    }

    function smellsFor(tool) {
        // The real kit, not a stub: _smellsFor does no reads, but it leans on
        // the kit's helpers throughout.
        const kitCtx = loadScriptInclude('PaToolReadKit.js')
        const ctx = loadScriptInclude('tools/PaToolAgentConfig.js', { PaToolReadKit: kitCtx.PaToolReadKit })
        const core = new ctx.PaToolAgentConfig()
        const list = []
        core._smellsFor(
            list,
            { sys_id: 'm', name: tool.name, active: 'true' },
            {
                sys_id: 't',
                name: tool.name,
                active: 'true',
                type: 'script',
                description: tool.description,
                input_schema: '[{"name":"request","description":"x","mandatory":false}]',
                script: "(function (inputs) {\n    return new x_snc_troubleshoot.PaScriptToolAdapter().invoke('x', inputs.request, {})\n})(inputs);",
            }
        )
        return list
    }

    it('finds all seven tools to score', () => {
        expect(ourTools().map((t) => t.name)).toHaveLength(7)
    })

    it('raises no high-severity smell on any of our tool descriptions', () => {
        const offenders = []
        ourTools().forEach((tool) => {
            smellsFor(tool)
                .filter((s) => s.severity === 'high')
                .forEach((s) => offenders.push(tool.name + ': ' + s.smell))
        })
        expect(offenders).toEqual([])
    })

    it('raises no description smell at all - the three sections are all present', () => {
        const offenders = []
        ourTools().forEach((tool) => {
            smellsFor(tool)
                .filter((s) => s.smell.indexOf('description_') === 0)
                .forEach((s) => offenders.push(tool.name + ': ' + s.smell))
        })
        expect(offenders).toEqual([])
    })

    it('documents the one heuristic that DOES fire on our wrappers, rather than tuning it away', () => {
        // script_no_input_validation fires on every wrapper, because the
        // wrapper is a one-line delegation and the validation happens a layer
        // down in PaScriptToolAdapter.tolerantParse. That is a real precision
        // limit of a text-scan heuristic, and the honest response is to record
        // it here rather than special-case our own shape in the checker - the
        // checker would then be biased in exactly the direction that flatters
        // whoever wrote it.
        const smells = smellsFor(ourTools()[0])
        const validation = smells.find((s) => s.smell === 'script_no_input_validation')

        expect(validation).toBeDefined()
        expect(validation.severity).toBe('medium')
        expect(validation.confidence).toBe('heuristic')
    })
})
