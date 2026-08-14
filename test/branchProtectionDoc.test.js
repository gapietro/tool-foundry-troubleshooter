/**
 * `CLAUDE.md` must not claim this repo has no CI and no branch protection (#253).
 *
 * ---------------------------------------------------------------------------
 * WHY A TEST AND NOT CARE
 * ---------------------------------------------------------------------------
 * The claim was wrong in the direction that CHANGES BEHAVIOUR. It told the
 * reader nothing blocks a merge, so a reader hitting the real refusal
 * ("the base branch policy prohibits the merge") would reach for
 * `gh pr merge --admin` — which `enforce_admins: true` also refuses. Two
 * dead ends, from the file every session loads first. That cost a session
 * while merging PRs #248/#249/#250/#252, which is how #253 was filed.
 *
 * The claim was also true when written. CI landed in #215 / PR #222 and
 * `enforce_admins` in `2026.08.1206`; the paragraph simply did not move. That
 * is rot, not error, and rot is what a guard is for — a human reviewer reading
 * a 200-line instruction file is the wrong instrument for detecting a sentence
 * that was correct last month.
 *
 * ---------------------------------------------------------------------------
 * "no CI" IN THIS REPO USUALLY MEANS **CONFIGURATION ITEM**
 * ---------------------------------------------------------------------------
 * The obvious guard — forbid `no CI` — is unusable here. Five live lines under
 * `.claude/skills/` use it in the ServiceNow sense:
 *
 *     "No CI found: I couldn't find that configuration item."
 *     "Category = Hardware? NOT MET — no CI changes, multiple users ..."
 *
 * All five are correct prose that must keep passing. So the CI-abbreviation
 * pattern fires ONLY when the line also carries a source-control qualifier
 * (branch protection, merge, workflow, pipeline, GitHub Actions). No ServiceNow
 * incident-triage example talks about merges or workflows; the false-claim
 * paragraph did both in one sentence.
 *
 * The other patterns need no qualifier: "no branch protection", "nothing
 * blocks a merge" and "no .github/workflows" have no second meaning.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DELIBERATELY DOES NOT CHECK — AND WHY NOT LIVE `gh api`
 * ---------------------------------------------------------------------------
 * It does NOT observe branch protection itself. Reading
 * `repos/:owner/:repo/branches/main/protection` needs an admin-scoped token;
 * CI's `GITHUB_TOKEN` gets 403. Such a test would either red the pipeline
 * permanently or be skipped under CI — and `.github/workflows/ci.yml`'s own
 * header argues that "a CI step that passes vacuously is worse than no step —
 * it reads as a gate." A guard that cannot run inside the gate it guards is
 * the failure mode it exists to prevent.
 *
 * So the DRIFT THIS CANNOT SEE is stated rather than papered over: if someone
 * disables `enforce_admins`, drops the required context, or flips `strict` to
 * false via the API, these assertions still pass and CLAUDE.md silently
 * becomes wrong again in the opposite direction. What is checked instead is
 * the coupling that actually rots in a commit — the required check's NAME,
 * which is the workflow job's `name:` and is quoted verbatim in CLAUDE.md.
 * Rename the job and this goes red.
 *
 * RECORDS are out of scope, permanently, on the same reasoning as
 * `test/instructionFlagGuard.test.js`: `CHANGELOG.md`, `GRADE.md` and
 * `BACKLOG.md` all quote the false claim legitimately. `GRADE.md`'s sitting-1
 * cap analysis cites it as the evidence for the "No mandatory CI → B" cap, and
 * that file's own header states the sitting is deliberately NOT rewritten as
 * fixes land, because editing a measurement makes sittings incomparable.
 * Rewriting a record into present-day correctness destroys the evidence that
 * the claim was once true.
 */

const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const WORKFLOW = '.github/workflows/ci.yml'

/** Directories walked for instruction files. Mirrors `instructionFlagGuard`. */
const SCAN_DIRS = ['.claude/skills', 'docs']

/** Individually named instruction files outside those trees. */
const SCAN_FILES = [
    'CLAUDE.md',
    'README.md',
    'benchmark/README.md',
    'benchmark/seed-app/README.md',
]

/** Path prefixes holding records rather than instructions. */
const RECORD_PREFIXES = [
    'docs/superpowers/plans',
    'docs/superpowers/specs',
    'benchmark/seeds/history',
]

/**
 * Words that place a line in the source-control domain rather than the
 * ServiceNow one. Only the CI-abbreviation pattern consults this.
 */
const SCM_QUALIFIER = /branch protection|\bmerges?\b|\bmerging\b|workflows?|pipeline|github actions|pull request/i

/**
 * Each pattern is one way of asserting the gate is absent.
 *
 * `needsScmQualifier` marks the pattern that collides with ServiceNow's
 * "configuration item"; see the header. Everything else is unambiguous.
 */
const CLAIMS = [
    {
        name: 'no-ci-abbreviation',
        pattern: /\bno\s+(?:mandatory\s+)?CI\b/,
        needsScmQualifier: true,
        why: 'CI is mandatory: `.github/workflows/ci.yml` is a required status check on `main`',
    },
    {
        name: 'no-branch-protection',
        pattern: /\bno\s+branch\s+protection\b/i,
        needsScmQualifier: false,
        why: '`main` is protected — required check, `strict: true`, `enforce_admins: true`',
    },
    {
        name: 'nothing-blocks-merge',
        pattern: /\bnothing\s+blocks\s+a\s+merge\b/i,
        needsScmQualifier: false,
        why: 'a red or missing required check refuses the merge, for admins too',
    },
    {
        name: 'nothing-runs-checks',
        pattern: /\bnothing\s+runs\s+these\s+checks\b/i,
        needsScmQualifier: false,
        why: 'CI runs lint, build and test on every pull request',
    },
    {
        name: 'no-workflows-dir',
        pattern: /\bno\s+`?\.github\/workflows`?/i,
        needsScmQualifier: false,
        why: '`.github/workflows/ci.yml` exists',
    },
]

function isRecord(relative) {
    for (let i = 0; i < RECORD_PREFIXES.length; i++) {
        if (relative.indexOf(RECORD_PREFIXES[i]) === 0) return true
    }
    return false
}

/** Walks `SCAN_DIRS` for markdown, then appends `SCAN_FILES`. */
function discover() {
    const found = []

    function walk(absolute, relative) {
        const entries = fs.readdirSync(absolute, { withFileTypes: true })
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i]
            const childRelative = relative + '/' + entry.name
            if (entry.isDirectory()) {
                walk(path.join(absolute, entry.name), childRelative)
            } else if (entry.name.slice(-3) === '.md' && !isRecord(childRelative)) {
                found.push(childRelative)
            }
        }
    }

    for (let i = 0; i < SCAN_DIRS.length; i++) {
        const absolute = path.join(REPO, SCAN_DIRS[i])
        if (fs.existsSync(absolute)) walk(absolute, SCAN_DIRS[i])
    }
    for (let i = 0; i < SCAN_FILES.length; i++) {
        if (fs.existsSync(path.join(REPO, SCAN_FILES[i]))) found.push(SCAN_FILES[i])
    }
    return found
}

function offendingOccurrences(relative) {
    const lines = fs.readFileSync(path.join(REPO, relative), 'utf8').split('\n')
    const hits = []
    for (let i = 0; i < lines.length; i++) {
        for (let c = 0; c < CLAIMS.length; c++) {
            const claim = CLAIMS[c]
            if (!claim.pattern.test(lines[i])) continue
            if (claim.needsScmQualifier && !SCM_QUALIFIER.test(lines[i])) continue
            hits.push(relative + ':' + (i + 1) + ' [' + claim.name + '] ' + lines[i].trim() + '\n    ' + claim.why)
        }
    }
    return hits
}

/**
 * Job names declared in the workflow — the strings GitHub uses as required
 * status-check contexts. Excludes the top-level `name: CI` (column 0) and
 * step names (`- name: Install`), neither of which is a context.
 */
function jobNames(workflowText) {
    const lines = workflowText.split('\n')
    const names = []
    for (let i = 0; i < lines.length; i++) {
        const match = /^\s+name:\s*(\S.*?)\s*$/.exec(lines[i])
        if (match && lines[i].trim().indexOf('- ') !== 0) names.push(match[1])
    }
    return names
}

describe('CLAUDE.md branch-protection and CI claims (#253)', () => {
    test('no instruction file claims CI or branch protection is absent', () => {
        const files = discover()
        expect(files.length).toBeGreaterThan(10)

        let hits = []
        for (let i = 0; i < files.length; i++) {
            hits = hits.concat(offendingOccurrences(files[i]))
        }

        expect(hits.join('\n')).toBe('')
    })

    test('the ServiceNow "configuration item" sense of `no CI` still passes', () => {
        // Guards the guard: if the qualifier logic is ever loosened, these five
        // live lines under `.claude/skills/` start failing and someone would be
        // asked to reword correct prose. Both senses are asserted from the same
        // matcher used above, so this cannot drift from the real check.
        const configurationItem = 'Category = Hardware? NOT MET — no CI changes, multiple users same version'
        const buildPipeline = 'There is currently no CI and no branch protection on this repo'

        const claim = CLAIMS[0]
        expect(claim.pattern.test(configurationItem)).toBe(true)
        expect(SCM_QUALIFIER.test(configurationItem)).toBe(false)
        expect(claim.pattern.test(buildPipeline)).toBe(true)
        expect(SCM_QUALIFIER.test(buildPipeline)).toBe(true)
    })

    test('CLAUDE.md quotes the required check by the name the workflow gives it', () => {
        const workflow = fs.readFileSync(path.join(REPO, WORKFLOW), 'utf8')
        const names = jobNames(workflow)

        // Non-vacuity: an empty or multi-job parse must not silently pass.
        expect(names.length).toBe(1)
        expect(names[0].length).toBeGreaterThan(0)

        const claudeMd = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8')
        expect(claudeMd).toContain('`' + names[0] + '`')
    })

    test('the workflow still runs on pull requests, as CLAUDE.md says it does', () => {
        const workflow = fs.readFileSync(path.join(REPO, WORKFLOW), 'utf8')
        expect(/^on:$/m.test(workflow)).toBe(true)
        expect(/^\s+pull_request:\s*$/m.test(workflow)).toBe(true)
    })
})
