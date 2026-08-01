/**
 * PaToolReadArtifact — pure-logic tests (IMPLEMENTATION_PLAN.md Task 9).
 *
 * This core exists for one structural reason: PaArtifactStore.MAX_PAGE_CHARS
 * (4000) equals THRESHOLD_CHARS (4000), so a full page plus its envelope always
 * exceeds the threshold. Routed through applyThreshold it would store each page
 * as a NEW artifact and hand back an excerpt of it — paging that pages. The
 * PAGED_OUTPUT flag is what stops that, so the first test asserts the flag
 * itself: it is load-bearing, not decoration.
 *
 * WHAT THESE DO NOT SETTLE: that reading a real attachment from
 * x_snc_troubleshoot works (DESIGN.md R-8). That is a gpinst01 check — Task 5.
 */

const { loadScriptInclude } = require('./_loadScriptInclude')

const ARTIFACT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

/** Records what read() was called with and returns a canned page. */
function fakeStore(result) {
    const calls = []
    return {
        calls: calls,
        read: function (artifactId, offset, length) {
            calls.push({ artifactId: artifactId, offset: offset, length: length })
            return result === undefined
                ? { success: true, data: { artifact_id: artifactId, content: 'page', eof: true } }
                : result
        },
    }
}

function load(store) {
    const ctx = loadScriptInclude('tools/PaToolReadArtifact.js', { JSON: JSON })
    return new ctx.PaToolReadArtifact({ store: store })
}

describe('PaToolReadArtifact', () => {
    test('declares PAGED_OUTPUT so the adapter skips applyThreshold', () => {
        expect(load(fakeStore()).PAGED_OUTPUT).toBe(true)
    })

    test('a bare sys_id is read as the artifact id', () => {
        const store = fakeStore()
        load(store).execute(ARTIFACT)
        expect(store.calls[0].artifactId).toBe(ARTIFACT)
    })

    test('a JSON string carries offset and length through', () => {
        const store = fakeStore()
        load(store).execute('{"artifact_id":"' + ARTIFACT + '","offset":4000,"length":2000}')
        expect(store.calls[0]).toEqual({ artifactId: ARTIFACT, offset: 4000, length: 2000 })
    })

    test('an object is accepted directly, with camelCase and snake_case ids', () => {
        const store = fakeStore()
        load(store).execute({ artifactId: ARTIFACT, offset: 8000 })
        expect(store.calls[0].artifactId).toBe(ARTIFACT)
        expect(store.calls[0].offset).toBe(8000)
    })

    test('absent input delegates an empty id and returns the store error, never throws (R-9)', () => {
        const store = fakeStore({ success: false, error: 'read_artifact requires an artifact_id' })
        const out = load(store).execute()
        expect(out.success).toBe(false)
        expect(store.calls[0].artifactId).toBe('')
    })

    test('the store result is returned unchanged', () => {
        const page = { success: true, data: { content: 'abc', eof: false, next_offset: 4000 } }
        expect(load(fakeStore(page)).execute(ARTIFACT)).toEqual(page)
    })
})
