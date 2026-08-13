/**
 * `now-sdk install --alias` must not appear in any INSTRUCTION file (#241).
 *
 * ---------------------------------------------------------------------------
 * WHY A TEST AND NOT CARE
 * ---------------------------------------------------------------------------
 * `now-sdk install` has no `--alias`. Both `install` and `query` document
 * `-a, --auth`; `--alias` is valid only on `auth --add`. This is not a naming
 * nit, because now-sdk **ignores unknown flags silently** (#236) and falls
 * through to the DEFAULT credential — so the misspelling deploys to whatever
 * the default happens to be while the reader believes they named an instance.
 *
 * It has now recurred three times: #236 (CLAUDE.md), #239 (`scripts/smoke.js`,
 * where install and probe targeted different instances), and #241 (ten sites
 * across three skill files and the LLD). Three occurrences of one mistake is
 * the definition of something a human reviewer is the wrong guard for.
 *
 * The `.claude/skills/` half is the sharpest of the three: those instructions
 * are executed by a coding agent, so there is no human reading the
 * "Attempting to log into instance ..." line that CLAUDE.md tells operators to
 * check before believing a deploy.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS ROSTER IS, AND WHAT IT DELIBERATELY OMITS
 * ---------------------------------------------------------------------------
 * Same shape as `blindRule.test.js`: an explicit roster that "tracks the
 * principle and must grow with it, rather than defining it."
 *
 * OMITTED — RECORDS, permanently. The `benchmark/raw-evidence-*.md` files, the
 * `benchmark/scoring-v*` directories, `benchmark/DECISION.md`, `CHANGELOG.md`,
 * `benchmark/README.md`'s past-tense reinstall note (line ~488), and every
 * dated file under `docs/superpowers/plans|specs/` record commands that were
 * ACTUALLY RUN, wrong flag and all. Rewriting a record to match present-day
 * correctness destroys the evidence that the command was once wrong — the same
 * reason `benchmark/README.md` preserves its blind rule verbatim.
 *
 * OMITTED — PENDING, on purpose, tracked in #241. `benchmark/scripts/
 * build-packets.js` emits this command INTO SCORER PACKETS and
 * `test/packetGeneratorParity.test.js` pins the exact string; the eight
 * `benchmark/seeds/seed-0*.md` specs are packet inputs. Editing them is a
 * benchmark-instrument change while #212's claim-veracity pass is in flight,
 * which is what §AO3 already cost us once (the operator changed the scorer
 * instruction and voided the v13 → v14 determinacy comparison). They join this
 * roster when #212 reaches a verdict, or under an explicit §AW amendment
 * recorded at the moment it is made (§AT3).
 */

const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')

/** Instruction files that must never carry the flag. */
const ROSTER = [
    'CLAUDE.md',
    'README.md',
    'benchmark/seed-app/README.md',
    'docs/LOW_LEVEL_DESIGN.md',
    '.claude/skills/bootstrap-nowsdk/SKILL.md',
    '.claude/skills/agent-doctor/SKILL.md',
    '.claude/skills/sdk-dist-to-update-set/SKILL.md',
]

/**
 * The agent-followed subset, asserted separately so a future edit cannot
 * quietly shrink the roster past the highest-risk members.
 */
const AGENT_FOLLOWED = ROSTER.filter((f) => f.indexOf('.claude/skills/') === 0)

/**
 * Lines that QUOTE the wrong command in order to explain why it is wrong.
 *
 * A file may legitimately cite the defect — CLAUDE.md's instance-split block
 * records the actual incident ("deployed the app to keynexus01 while reporting
 * success"), which is evidence and must not be rewritten into correctness.
 *
 * Keyed on a distinctive phrase from the line rather than a line NUMBER, which
 * drifts on every edit above it. Each entry is asserted below to still match
 * exactly one line, so an exemption cannot go stale, and cannot widen to cover
 * a real offender that happens to land nearby.
 */
const CITATIONS = [
    {
        file: 'CLAUDE.md',
        phrase: 'the command this file used to document',
        why: 'records the #236 incident: this exact command deployed to keynexus01 reporting success',
    },
]

function citationFor(relative, line) {
    for (let i = 0; i < CITATIONS.length; i++) {
        if (CITATIONS[i].file === relative && line.indexOf(CITATIONS[i].phrase) !== -1) return CITATIONS[i]
    }
    return null
}

describe('no instruction file tells anyone to run `now-sdk install --alias` (#241)', () => {
    test.each(ROSTER)('%s', (relative) => {
        const full = path.join(REPO, relative)
        expect(fs.existsSync(full)).toBe(true)

        const lines = fs.readFileSync(full, 'utf8').split('\n')
        const offenders = []
        for (let i = 0; i < lines.length; i++) {
            // Matches `install --alias` and `install  --alias`, and tolerates
            // the `now-sdk build && now-sdk install --alias ...` compound form.
            if (/\binstall\s+--alias\b/.test(lines[i]) && !citationFor(relative, lines[i])) {
                offenders.push(relative + ':' + (i + 1) + ' — ' + lines[i].trim())
            }
        }
        expect(offenders).toEqual([])
    })

    test.each(CITATIONS)('citation exemption in $file is still live ($why)', (citation) => {
        // A stale exemption is worse than none: it reads as "reviewed and
        // allowed" while covering nothing, and the next real offender on that
        // line inherits the pass.
        const lines = fs.readFileSync(path.join(REPO, citation.file), 'utf8').split('\n')
        const matching = lines.filter((l) => l.indexOf(citation.phrase) !== -1)
        expect(matching).toHaveLength(1)
        expect(/\binstall\s+--alias\b/.test(matching[0])).toBe(true)
    })

    test('the roster still covers all three agent-followed skill files', () => {
        // These are the members whose loss would be least visible: an agent
        // executes them unattended, so a wrong instance is not noticed by a
        // human reading the install log.
        expect(AGENT_FOLLOWED).toHaveLength(3)
        expect(AGENT_FOLLOWED).toContain('.claude/skills/agent-doctor/SKILL.md')
    })

    test('the correct flag is what the installed SDK actually documents', () => {
        // Pins the replacement rather than only banning the mistake — the
        // reason #236's first two fixes were each wrong in a new way. Verified
        // against `now-sdk install --help` on SDK 4.9.2: `-a, --auth <alias>`.
        const claudeMd = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8')
        expect(claudeMd).toContain('now-sdk install --auth gpinst01')
    })
})
