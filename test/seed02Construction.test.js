/**
 * Seed 2 v2 construction guard — DECISION.md §D2, issue #45.
 *
 * Measured at Task 12: a ReAct agent with ZERO bound tools is cancelled by the
 * engine before the LLM is ever invoked (execution 11bd8d882baa4314f243fed2ce91bfb3,
 * 737ms, output digest {}), so the v1 tool-less construction can never exercise
 * the layer-2 instruction defect it exists to test. v2 binds exactly one weak
 * tool so the engine enters its loop — and this file guards the two properties
 * that make the corrected seed measure the right thing:
 *
 *   1. There IS a tool (the engine runs), and only one (nothing else to blame).
 *   2. The tool cannot resolve a group, and the ambiguous instruction is
 *      unchanged — so the defect stays purely instructional. A tool that could
 *      look up a group, or an instruction that names one, silently turns this
 *      back into a layer-3 seed and the Phase 1b comparison re-run would score
 *      a different defect than v1's runs did.
 *
 * The seed lives in the fixture app (benchmark/seed-app, scope x_snc_tsbench),
 * which has no Jest of its own — tests live in test/ at the repo root, so the
 * guard reads the Fluent source as text, the same approach
 * agentDoctorInstructions.test.js takes with agent-doctor.now.ts.
 */

const fs = require('fs')
const path = require('path')

const SEED_PATH = path.join(
    __dirname,
    '..',
    'benchmark',
    'seed-app',
    'src',
    'fluent',
    'seed-02-ambiguous-instruction.now.ts'
)

describe('seed 2 v2 binds exactly one weak tool (DECISION.md §D2)', () => {
    let source
    let code

    beforeAll(() => {
        source = fs.readFileSync(SEED_PATH, 'utf8')
        code = source
            .replace(/\/\*\*[\s\S]*?\*\//g, '') // strip block comments
            .replace(/\/\/.*$/gm, '') // strip line comments
    })

    it('declares a tools array with exactly one tool', () => {
        // The v1 construction had no tools property at all — that absence is
        // the refuted mechanism. Exactly one tool is the whole point of v2:
        // zero re-refutes the seed, two gives the diagnosis something else to
        // blame. Counting type: entries in the tools slice counts EVERY tool
        // shape (script, crud, ...) — a name/type-adjacency regex would count
        // only script tools and let a second crud tool pass unseen.
        expect(code).toMatch(/tools\s*:\s*\[/)
        const tools = code.slice(code.indexOf('tools:'))
        const toolTypes = tools.match(/type:\s*'\w+'/g) || []
        expect(toolTypes).toHaveLength(1)
        expect(toolTypes[0]).toContain("'script'")
    })

    it('ends the tool IIFE with the required (inputs) invocation (Rule #19)', () => {
        // Counted in the comment-stripped code so a future doc comment quoting
        // the literal cannot inflate the count.
        expect(code.match(/\}\)\(inputs\);/g) || []).toHaveLength(1)
    })

    it('gives the tool no group-resolving vocabulary', () => {
        // The defect must stay in the instruction. A tool whose name,
        // description or script mentions groups, routing or assignment is a
        // lookup tool in embryo — it would move the seed to layer 3 (or worse,
        // make the sanctioned fix appear already applied).
        //
        // The slice assumes tools: is the LAST property, below the agent
        // description and instructions (which legitimately say "group" and
        // "assign" — they are the v1 text under test). Moving tools: above
        // them would pull that text into the slice and fail this test — the
        // safe direction, but know that is why.
        const tools = code.slice(code.indexOf('tools:'))
        ;['group', 'assign', 'route', 'routing'].forEach((word) => {
            expect(tools.toLowerCase()).not.toContain(word)
        })
    })

    it('keeps the v1 ambiguous instruction verbatim, still naming no group', () => {
        // v1/v2 comparability: the instruction under test must not move.
        expect(source).toContain(
            'Read the incoming request and assign it to the right group. Be accurate - assigning to the wrong group delays the requester. Confirm the assignment back to the user when you are done.'
        )
    })

    it('carries no forbidden template sequences in the added tool (Rule #43)', () => {
        // A \s in a regex, a \n in a string, a ${} — all consumed by
        // TypeScript before the platform sees the script. The v2 tool counts
        // words with split(' ') precisely to avoid regex escapes. The file
        // needs no backslash of ANY kind, so the guard is total rather than a
        // lowercase-escape pattern that would miss quote escapes.
        expect(source).not.toContain('\\')
        expect(source).not.toContain('${')
    })

    it('keeps the seed marker on the agent description (blind-rule advisory, Task 12 §C4)', () => {
        // Known, recorded leak: the description says the agent is a seed, not
        // which defect it carries. Removing it now would silently change what
        // the re-run's blind rule measures against v1.
        expect(source).toContain('Benchmark seed - deliberately broken')
    })
})
