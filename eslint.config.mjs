/**
 * ESLint flat config — issue #215, from `/senior-grade` sitting 1 finding F-09.
 *
 * WHY ES5 IS ENFORCED, AND WHY IT CAN BLOCK FROM DAY ONE
 * `src/server/**` is loaded by ServiceNow's Rhino engine as Script Include
 * bodies. `const`, `let`, arrow functions, template literals, `Set` and `Map`
 * are the recurring runtime landmines there — and, per CLAUDE.md, that class of
 * defect "builds clean, installs clean, fails at runtime", which is the most
 * expensive shape this codebase has. Setting `ecmaVersion: 5` turns every one of
 * them into a PARSE ERROR at lint time, which is the earliest and cheapest place
 * to catch them.
 *
 * This was made blocking immediately rather than warn-first because the
 * discipline was measured before the rule was written: across `src/server/`
 * there are zero `const`/`let`, zero `Set`/`Map`, zero `for..of`, and every `=>`
 * and backtick sits inside JSDoc prose or a single-quoted string. The rule
 * therefore ratchets existing behaviour rather than declaring a backlog — a
 * lint rule that lands with hundreds of violations teaches people to ignore
 * lint, which is worse than no lint.
 *
 * WHAT IS DELIBERATELY NOT ENFORCED
 * No stylistic rules (quotes, semicolons, spacing, line length). This repo has
 * no formatter and adding opinions now would bury the correctness signal in
 * noise. Everything configured below is a bug class, not a preference.
 */

const SERVICENOW_GLOBALS = {
    // Rhino / platform globals available to a Script Include body.
    gs: 'readonly',
    GlideRecord: 'readonly',
    GlideRecordSecure: 'readonly',
    GlideAggregate: 'readonly',
    GlideDateTime: 'readonly',
    GlideDate: 'readonly',
    GlideDuration: 'readonly',
    GlideSysAttachment: 'readonly',
    GlideEncrypter: 'readonly',
    GlideProperties: 'readonly',
    GlideStringUtil: 'readonly',
    GlideScriptedExtensionPoint: 'readonly',
    Class: 'readonly',
    JSON: 'readonly',
    global: 'readonly',
    sn_ws: 'readonly',
    sn_fd: 'readonly',
    GlidePluginManager: 'readonly',
    // Namespaces the first lint run proved are referenced but were undeclared.
    // `sn_one_extend` is the GenAI/OneExtend entry point (PaLlmProxy), `sn_ws_err`
    // the scripted-REST error namespace, and `_agentic_context_` the AIA runtime
    // global PaRunAnchor reads for the conversation key.
    sn_one_extend: 'readonly',
    sn_ws_err: 'readonly',
    _agentic_context_: 'readonly',
    // Script Includes reference each other by bare name at runtime, so the app's
    // own classes are globals from any single file's point of view — and each is
    // also DEFINED by one of those files. `writable` plus `builtinGlobals: false`
    // on no-redeclare is what lets both facts coexist.
    PaAgentLoop: 'writable',
    PaArtifactStore: 'writable',
    PaAuditLogger: 'writable',
    PaFixReport: 'writable',
    PaLlmProxy: 'writable',
    PaRestHandlers: 'writable',
    PaRunAnchor: 'writable',
    PaRunManager: 'writable',
    PaScriptToolAdapter: 'writable',
    PaToolAgentConfig: 'writable',
    PaToolAgentTrace: 'writable',
    PaToolGenAiLog: 'writable',
    PaToolLogAnalysis: 'writable',
    PaToolQueryTable: 'writable',
    PaToolReadArtifact: 'writable',
    PaToolReadKit: 'writable',
    PaToolRegistry: 'writable',
    PaToolSchemaLookup: 'writable',
}

const NODE_GLOBALS = {
    require: 'readonly',
    module: 'writable',
    exports: 'writable',
    process: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    console: 'readonly',
    Buffer: 'readonly',
    URL: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
}

const JEST_GLOBALS = {
    describe: 'readonly',
    it: 'readonly',
    test: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly',
    jest: 'readonly',
}

/**
 * Bug classes only — no style. Shared by every block below.
 *
 * Three settings here are concessions to patterns this codebase adopted
 * deliberately, and each is a decision rather than a default:
 *
 *   caughtErrors: 'none' — DESIGN.md R-1 forbids reading the exception object
 *       in a scoped app: touching a ScopeAccessNotGrantedException throws
 *       again and kills the request, so `catch (e) { /* e untouched *\/ }` is
 *       the required shape, not laziness. 94 of the first run's 98
 *       unused-variable reports were this pattern. Flagging it would have
 *       pressured a correct idiom into an incorrect one.
 *   no-redeclare builtinGlobals:false — every Script Include defines the class
 *       that other Script Includes reference as a global (see the globals map).
 *   no-cond-assign default (except-parens) — `while ((m = re.exec(s)))` is the
 *       idiomatic regex walk and already carries the disambiguating parens.
 */
const CORRECTNESS_RULES = {
    'no-undef': 'error',
    'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
    'no-redeclare': ['error', { builtinGlobals: false }],
    'no-dupe-keys': 'error',
    'no-dupe-args': 'error',
    'no-duplicate-case': 'error',
    'no-unreachable': 'error',
    'no-fallthrough': 'error',
    'no-cond-assign': 'error',
    'no-self-assign': 'error',
    'no-self-compare': 'error',
    'no-constant-condition': ['error', { checkLoops: false }],
    'no-sparse-arrays': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
    // Enabled because the codebase already assumed it: packetGeneratorParity
    // carries an `eslint-disable-next-line no-new-func` written before any
    // linter existed. Turning the rule on makes that directive mean what its
    // author intended and guards the next, less deliberate, use.
    'no-new-func': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
}

export default [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            '@types/**',
            'src/fluent/generated/**',
            // Golden examples are reference material pinned to SDK behaviour,
            // not code this project builds or ships.
            '.claude/context/sdk-examples/**',
            // Seed apps are deliberately broken fixtures for the benchmark.
            'benchmark/seed-app/**',
            // This file: ESM, and linting a lint config adds no signal.
            'eslint.config.mjs',
        ],
    },

    // --- Platform code: Rhino, ES5 only. The parse error IS the guard. -------
    {
        files: ['src/server/**/*.js'],
        languageOptions: {
            ecmaVersion: 5,
            sourceType: 'script',
            globals: SERVICENOW_GLOBALS,
        },
        rules: CORRECTNESS_RULES,
    },

    // --- Tooling that runs on Node, not on the platform ---------------------
    {
        files: ['benchmark/scripts/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: NODE_GLOBALS,
        },
        rules: CORRECTNESS_RULES,
    },

    // --- Tests: Node + Jest. `_loadScriptInclude` uses fs/path/vm. ----------
    {
        files: ['test/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...NODE_GLOBALS, ...JEST_GLOBALS },
        },
        rules: CORRECTNESS_RULES,
    },
]
