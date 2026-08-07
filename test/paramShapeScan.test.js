/**
 * The `<param>=<value>` drift guard (issue #126).
 *
 * The parameter-prefixed shape has been removed from tool-facing text TWICE —
 * #111 from schema_lookup's description and in-band strings, #122 from six
 * descriptions and then, after the whole-branch review caught the branch
 * repeating the scoping error it existed to fix, from 14 in-band guidance
 * strings and six per-input descriptions. Both times it was found by reading.
 * Nothing failed if someone wrote `Re-call with execution=<sys_id>` into a note.
 *
 * That matters more than ordinary drift because these strings sit on the
 * pick-list, no-args and refusal paths — the last thing a model reads before
 * it retries. PR #124's review rated them a more proximate cause of the
 * observed malformation than the description prose #122 blamed.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SCANNER IS TESTED SEPARATELY FROM THE TREE
 * ---------------------------------------------------------------------------
 * A source-scan guard has one characteristic failure: it matches nothing, for
 * a reason no one notices, and reports green forever. So the scanner is a unit
 * under test in its own right — fed synthetic sources with known answers —
 * before it is pointed at the real tree. A test that only ever asserts "the
 * tree is clean" cannot tell "clean" from "broken".
 */

const fs = require('fs')
const path = require('path')
const { stringLiterals, scanSource, toolParamNames, TOOL_DIR, FLUENT_FILE } = require('./_paramShapeScan')

const NAMES = ['execution', 'agent', 'table', 'field', 'section', 'limit', 'mode']

function scan(src) {
    return scanSource(src, NAMES)
}

// ---------------------------------------------------------------------------
// The literal extractor — 237 raw line matches across the tool tree collapse
// to 16 once only string literals count, because `table: a.table` is object
// syntax and never reaches a model.
// ---------------------------------------------------------------------------

describe('string literal extraction', () => {
    it('collects single, double and template literals', () => {
        const lits = stringLiterals("var a = 'one'\nvar b = \"two\"\nvar c = `three`\n").map((l) => l.body)

        expect(lits).toEqual(['one', 'two', 'three'])
    })

    it('reports the line the literal opened on', () => {
        const lits = stringLiterals("var a = 1\nvar b = 'here'\n")

        expect(lits[0].line).toBe(2)
    })

    it('keeps counting lines across a multi-line template literal', () => {
        const lits = stringLiterals('var a = `one\ntwo`\nvar b = \'after\'\n')

        expect(lits[1].body).toBe('after')
        expect(lits[1].line).toBe(3)
    })

    it('ignores a line comment', () => {
        expect(stringLiterals("// var a = 'hidden'\nvar b = 'real'\n").map((l) => l.body)).toEqual(['real'])
    })

    it('ignores a block comment, including its apostrophes', () => {
        // A stray apostrophe in prose ("the tool's own note") would otherwise
        // open a string and swallow the rest of the file.
        const src = "/* the tool's own note said table=<name> */\nvar b = 'real'\n"

        expect(stringLiterals(src).map((l) => l.body)).toEqual(['real'])
    })

    it('does not end a literal on an escaped quote', () => {
        expect(stringLiterals("var a = 'it\\'s here'\n")[0].body).toBe("it\\'s here")
    })
})

// ---------------------------------------------------------------------------
// The shape itself.
// ---------------------------------------------------------------------------

describe('flagging the parameter-prefixed shape', () => {
    it('flags the placeholder form that #122 removed', () => {
        const hits = scan("var n = 'Re-call with execution=<sys_id> to trace another.'")

        expect(hits).toHaveLength(1)
        expect(hits[0].param).toBe('execution')
    })

    it('flags the colon form that #111 measured live', () => {
        expect(scan("var n = 'Call it with table:incident.'")).toHaveLength(1)
    })

    it('flags a concrete value, not only an angle-bracket placeholder', () => {
        expect(scan("var n = 'Pass agent=MyAgent.'")).toHaveLength(1)
    })

    it('flags inside a template literal, which is how the Fluent arm is written', () => {
        expect(scan('var d = `Send execution=<sys_id> here.`')).toHaveLength(1)
    })

    it('reports the line so the failure names its own site', () => {
        expect(scan("var a = 1\nvar b = 2\nvar n = 'use limit=20'")[0].line).toBe(3)
    })

    it('flags every occurrence in one literal, not just the first', () => {
        expect(scan("var n = 'send execution=<sys_id> or agent=<name>'")).toHaveLength(2)
    })
})

// ---------------------------------------------------------------------------
// The three false-positive classes, all present in the tree today. Each one is
// a string that MUST survive the scan.
// ---------------------------------------------------------------------------

describe('legitimate strings the scan must not flag', () => {
    it('does not flag a negated counter-example', () => {
        // 14 of the 15 legitimate hits in the tree are this shape. The
        // negation is what makes showing the wrong form safe, so the negation
        // is the discriminator — not a file+line allowlist that has to be
        // maintained by hand and says nothing about why the line is exempt.
        expect(scan("var d = `never part of a value: send the sys_id alone, not execution:<sys_id>.`")).toHaveLength(0)
    })

    it('does not flag a negated counter-example in quotes', () => {
        // PaToolSchemaLookup's `table_name_malformed` next_step, the 15th:
        // `... on its own — "incident", not "table:incident" — or as a JSON object`.
        expect(scan('var n = \'the table name on its own, not "table:incident" or as an object\'')).toHaveLength(0)
    })

    it('does not flag a negation split across a string concatenation', () => {
        // The real shape of PaToolSchemaLookup's next_step, and the reason
        // this rule needed the tree to design it rather than a synthetic
        // example. These notes are built by concatenating wrapped fragments,
        // so `not ` routinely ends one literal and the counter-example opens
        // the next — where nothing precedes it to negate it.
        const src = "var n = 'the table name on its own — \"incident\", not ' +\n    '\"table:incident\" — or as a JSON object.'"

        expect(scan(src)).toHaveLength(0)
    })

    it('does not bridge to the previous literal for a mid-string occurrence', () => {
        // The bridge must be narrow. A literal that ends in `not ` cannot
        // excuse a taught shape further into the next one.
        const src = "var n = 'this is not ' +\n    'a reason. Re-call with execution=<sys_id> now.'"

        expect(scan(src)).toHaveLength(1)
    })

    it('flags a shape whose "not" lands AFTER it, where the negation cannot apply', () => {
        // The negation rule must attach to the occurrence, not merely co-occur
        // with the word. This string teaches the bad shape and then negates
        // something else.
        expect(scan("var n = 'Re-call with execution=<sys_id>, not the bare sys_id.'")).toHaveLength(1)
    })

    it('does not flag a parameter name ending an English clause', () => {
        // PaToolAgentTrace.js:901 — "Call agent_config for the triggers
        // section: compare the trigger run_as ...". Prose puts a space after
        // the colon; call syntax is written tight. That is the whole rule.
        expect(scan("var n = 'Call agent_config for the triggers section: compare the run_as field.'")).toHaveLength(0)
    })

    it('does not flag record-data descriptions, which name platform columns', () => {
        // `state_reason=security_violation`, `active=true`, `Warning=1` are
        // descriptions of data, not call syntax. They are excluded by keying
        // the scan to the tool's own PARAM_NAMES rather than a global list.
        expect(scan("var n = 'A plan with state_reason=security_violation and active=true.'")).toHaveLength(0)
    })

    it('does not flag object syntax outside a string', () => {
        expect(scan('var out = { table: a.table, limit: n }\nout.limit = limit')).toHaveLength(0)
    })

    it('does not flag the shape inside a comment', () => {
        // Comments do not reach the model, and the ones in this tree
        // deliberately quote the removed shape to explain why it was removed.
        expect(scan("// #122: was `execution=<sys_id>`, on the pick-list path\nvar n = 'clean'")).toHaveLength(0)
    })

    it('does not flag a longer name that merely starts with a parameter name', () => {
        expect(scan("var n = 'the table_prefix=x_snc convention'")).toHaveLength(0)
    })

    it('does not flag a parameter name that is a suffix of another word', () => {
        expect(scan("var n = 'the subtable:incident case'")).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// The guard itself.
// ---------------------------------------------------------------------------

describe('the tool tree teaches no parameter-prefixed shape (#126)', () => {
    const toolFiles = fs
        .readdirSync(TOOL_DIR)
        .filter((f) => f.endsWith('.js'))
        .map((f) => path.join(TOOL_DIR, f))

    it('finds the tool files it is supposed to be scanning', () => {
        // The scan's own failure mode: a moved directory turns this suite
        // green by scanning nothing at all.
        expect(toolFiles.length).toBeGreaterThanOrEqual(7)
    })

    it('reads a non-empty parameter list for every tool', () => {
        // Same failure mode one level down — an empty PARAM_NAMES would make
        // that tool unscannable while the suite still passed.
        for (const file of toolFiles) {
            expect(toolParamNames(file).length).toBeGreaterThan(0)
        }
    })

    it.each(toolFiles.map((f) => [path.basename(f), f]))('%s', (_name, file) => {
        const hits = scanSource(fs.readFileSync(file, 'utf8'), toolParamNames(file))

        expect(hits.map((h) => h.line + ': ' + h.excerpt)).toEqual([])
    })

    it('agent-doctor.now.ts — the native Fluent arm', () => {
        // The Fluent descriptions are a second copy of the same contract, and
        // #122 had to fix six per-input descriptions here after fixing the
        // server tools. Scanned against the union of every tool's names,
        // since the file carries all seven tools' text.
        const union = []
        for (const file of toolFiles) {
            for (const n of toolParamNames(file)) if (union.indexOf(n) === -1) union.push(n)
        }
        const hits = scanSource(fs.readFileSync(FLUENT_FILE, 'utf8'), union)

        expect(hits.map((h) => h.line + ': ' + h.excerpt)).toEqual([])
    })
})
