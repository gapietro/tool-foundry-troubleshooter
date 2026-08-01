/**
 * The R-24 contract, asserted across every core at once.
 *
 * Twelve review findings on PaToolAgentConfig across four rounds; eleven were
 * the same defect — a partial, excluded or bounded read presented as a
 * definitive answer — and four of them were introduced or left behind by
 * earlier fixes in that same cycle. Fixing instances was not converging.
 *
 * So the invariant is structural: PaToolReadKit records every truncation
 * centrally, and every core surfaces it in evidence_basis whether or not the
 * section that hit the bound thought to mention it. This file is what makes a
 * new core inherit that obligation rather than rediscover it — a core added
 * later without the block fails here, not in review round five.
 */

const fs = require('fs')
const path = require('path')
const { loadScriptInclude } = require('./_loadScriptInclude')
const { makeQueryingGlideRecordSecure } = require('./_glideStub')

/** Cores that read through PaToolReadKit and therefore owe the contract. */
const KIT_CORES = [
    'PaToolAgentConfig',
    'PaToolGenAiLog',
    'PaToolSchemaLookup',
    'PaToolQueryTable',
    'PaToolLogAnalysis',
]

function sourceOf(name) {
    return fs.readFileSync(path.join(__dirname, '..', 'src', 'server', 'tools', name + '.js'), 'utf8')
}

describe('every kit-based core surfaces the bounds it hit (R-24)', () => {
    KIT_CORES.forEach((core) => {
        it(core + ' reports truncations in evidence_basis', () => {
            const src = sourceOf(core)

            // Anchored to the evidence block specifically: reporting a bound
            // somewhere in the payload is not the contract. R-19b's rule
            // applies — the status a reader scans is part of the claim.
            const evidence = src.slice(src.indexOf('_evidenceBasis'))
            expect(evidence).toContain('truncations: truncations')
            expect(evidence).toContain('truncation_note')
            expect(evidence).toContain('LOWER BOUND')
        })
    })

    it('names the cores that are exempt, and why', () => {
        // PaToolAgentTrace carries its own inline read layer and was
        // deliberately not migrated onto the kit (it is the only core verified
        // against real sn_aia_* rows). PaToolReadArtifact performs no bounded
        // record reads at all — it pages an attachment through the store.
        // Both are exemptions with reasons, recorded here so the list cannot
        // grow silently.
        expect(sourceOf('PaToolAgentTrace')).toContain('_readRows')
        expect(sourceOf('PaToolReadArtifact')).toContain('PAGED_OUTPUT')

        const toolsDir = path.join(__dirname, '..', 'src', 'server', 'tools')
        const present = fs
            .readdirSync(toolsDir)
            .filter((f) => f.endsWith('.js'))
            .map((f) => f.replace(/\.js$/, ''))

        // A new core must be classified deliberately: either it uses the kit
        // and owes the contract above, or it is listed as an exemption here.
        expect(present.sort()).toEqual(
            KIT_CORES.concat(['PaToolAgentTrace', 'PaToolReadArtifact']).sort()
        )
    })
})

describe('the kit makes truncation a measurement, not a guess', () => {
    function kit() {
        const G = makeQueryingGlideRecordSecure({
            t: [{ sys_id: '1' }, { sys_id: '2' }, { sys_id: '3' }],
            exact: [{ sys_id: '1' }, { sys_id: '2' }],
        })
        return new (loadScriptInclude('PaToolReadKit.js', { GlideRecordSecure: G }).PaToolReadKit)()
    }

    it('distinguishes a truncated result from an exactly-full one', () => {
        // The ambiguity behind three of the four silent caps: rows.length ===
        // limit was read optimistically every time it came up.
        const k = kit()

        const truncated = k.readRows('t', null, ['sys_id'], [], 2, null, k.newData())
        const exact = k.readRows('exact', null, ['sys_id'], [], 2, null, k.newData())

        expect(truncated.rows).toHaveLength(2)
        expect(truncated.truncated_at).toBe(2)
        expect(exact.rows).toHaveLength(2)
        expect(exact.truncated_at).toBeUndefined()
    })

    it('never returns more rows than the caller asked for', () => {
        const k = kit()
        const read = k.readRows('t', null, ['sys_id'], [], 2, null, k.newData())

        // limit+1 is read to detect the overflow; it must not leak out.
        expect(read.rows).toHaveLength(2)
    })
})
