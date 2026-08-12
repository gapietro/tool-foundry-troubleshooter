// THROWAWAY — proves CI blocks a merge. This branch is never merged.
describe('CI gate proof', () => {
    it('fails on purpose so the required check goes red', () => {
        expect(1).toBe(2)
    })
})
