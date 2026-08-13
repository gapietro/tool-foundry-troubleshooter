/**
 * The UTF-16 clip contract, asserted across every truncation site at once.
 *
 * #106 fixed ONE site — `PaRunManager._requestFields` — and #137 found the same
 * arithmetic sitting unfixed in seven more, in five different Script Includes.
 * That is the shape the codebase has already learned to distrust (see
 * `coreTruncationContract.test.js`): fixing instances does not converge,
 * because the next truncation site is written by someone who never read #106.
 *
 * So the invariant is stated once, here, over every site that clips a string at
 * a code-unit index: NO clip may emit an unpaired surrogate, at either end.
 *
 * WHY A LONE SURROGATE MATTERS
 * JavaScript strings are UTF-16 code units, so an astral-plane character — an
 * emoji, most plausibly inside a pasted `logs` value — occupies two of them. A
 * `substring` at an arbitrary index can land between the halves. The result is
 * not valid UTF-16: it survives the column, then breaks JSON encoding of the
 * `GET /runs/{run_id}` response and XML export of the record.
 *
 * WHY THE COPIES ARE COMPARED RATHER THAN SHARED
 * The helper is duplicated verbatim into each Script Include rather than
 * extracted, following the ruling already applied to
 * `PaToolAgentTrace._splitParamPrefix` (#122, migration tracked as #41): these
 * are Rhino Script Includes with no module system, and a shared one would put a
 * cross-Script-Include instantiation in the hot digest path. Duplication is
 * only safe if it cannot drift, so the first block below asserts the copies are
 * byte-identical — a divergence fails here rather than in whichever caller
 * happened to get the stale one.
 */

const fs = require('fs')
const path = require('path')
const { loadScriptInclude } = require('./_loadScriptInclude')

/**
 * The text of one `name: function (...) {...}` member, read from the FILE.
 *
 * WHY THE FILE AND NOT `fn.toString()` (issue #217)
 * The drift check below used to compare the loaded functions' `toString()`.
 * That reads the engine's re-print of whatever was actually executed — and
 * once `_loadScriptInclude` instruments sources for coverage, what executes
 * carries per-file istanbul counters (`cov_29allc198g().s[182]++`), so five
 * verbatim-identical copies print five different strings and the check fails
 * for a reason that has nothing to do with drift.
 *
 * Reading the source is also the truer test of what this file claims. The
 * assertion is that the DUPLICATED SOURCE has not diverged; comparing bytes on
 * disk states that directly, instead of inferring it from a runtime artifact.
 *
 * @param {String} relPath path under `src/server/`
 * @param {String} propName e.g. `clipUtf16` or `_clipUtf16`
 * @returns {String} from `function` through the body's closing brace
 */
function memberSource(relPath, propName) {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'server', relPath), 'utf8')
    const needle = propName + ': function ('

    let at = src.indexOf(needle)
    // `clipUtf16` also occurs INSIDE `_clipUtf16` — keep looking until the
    // match is the whole property name, not a suffix of a longer one.
    while (at > 0 && /[A-Za-z0-9_$]/.test(src.charAt(at - 1))) {
        at = src.indexOf(needle, at + 1)
    }
    if (at === -1) throw new Error('member not found: ' + propName + ' in ' + relPath)

    const open = src.indexOf('{', at)
    let depth = 0
    for (let i = open; i < src.length; i++) {
        const ch = src.charAt(i)
        if (ch === '{') depth++
        else if (ch === '}') {
            depth--
            if (depth === 0) {
                return src.slice(at + propName.length + 2, i + 1)
            }
        }
    }
    throw new Error('unbalanced body for ' + propName + ' in ' + relPath)
}

// ---------------------------------------------------------------------------
// Surrogate helpers
// ---------------------------------------------------------------------------

/**
 * @returns {Number} index of the first UNPAIRED surrogate code unit, or -1.
 *
 * Scans the whole string rather than just the boundaries: a clip is only
 * correct if it introduced no orphan anywhere, and an index makes the failure
 * message say WHERE rather than just "somewhere".
 */
function loneSurrogateAt(s) {
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i)
        if (c >= 0xd800 && c <= 0xdbff) {
            const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0
            if (!(next >= 0xdc00 && next <= 0xdfff)) return i
            i++
        } else if (c >= 0xdc00 && c <= 0xdfff) {
            return i
        }
    }
    return -1
}

/** Two code units. Every straddle case below is built out of this one. */
const EMOJI = '😀'

function filler(n) {
    return n > 0 ? new Array(n + 1).join('x') : ''
}

// ---------------------------------------------------------------------------
// The five carriers
// ---------------------------------------------------------------------------

/** `new loadScriptInclude(f).X()` binds `new` to the LOADER — go via a local. */
function carrier(relPath, name) {
    const ctx = loadScriptInclude(relPath)
    return new ctx[name]()
}

function readKit() {
    return carrier('PaToolReadKit.js', 'PaToolReadKit')
}

function runManager() {
    return carrier('PaRunManager.js', 'PaRunManager')
}

function agentTrace() {
    return carrier('tools/PaToolAgentTrace.js', 'PaToolAgentTrace')
}

function artifactStore() {
    return carrier('PaArtifactStore.js', 'PaArtifactStore')
}

function auditLogger() {
    return carrier('PaAuditLogger.js', 'PaAuditLogger')
}

/** name -> [head-clip helper, tail-clip helper] on each carrier. */
function copies() {
    return {
        PaToolReadKit: [readKit().clipUtf16, readKit().clipTailUtf16],
        PaRunManager: [runManager()._clipUtf16, runManager()._clipTailUtf16],
        PaToolAgentTrace: [agentTrace()._clipUtf16, agentTrace()._clipTailUtf16],
        PaArtifactStore: [artifactStore()._clipUtf16, artifactStore()._clipTailUtf16],
        PaAuditLogger: [auditLogger()._clipUtf16, auditLogger()._clipTailUtf16],
    }
}

// ---------------------------------------------------------------------------
// The copies may not drift
// ---------------------------------------------------------------------------

describe('the duplicated helper is identical in every carrier', () => {
    test('every Script Include that clips carries both halves of the helper', () => {
        const all = copies()
        Object.keys(all).forEach((name) => {
            expect(typeof all[name][0]).toBe('function')
            expect(typeof all[name][1]).toBe('function')
        })
    })

    test('every copy is byte-identical to the canonical one on PaToolReadKit', () => {
        // Compared as SOURCE, read from the files — see `memberSource` for why
        // the loaded functions' `toString()` cannot answer this once coverage
        // instrumentation is in the loader. The property name differs by an
        // underscore between the kit and the rest, so the slice starts at
        // `function` and covers signature and body only — exactly the part
        // that must not drift.
        const SOURCES = [
            ['PaToolReadKit.js', 'clipUtf16', 'clipTailUtf16'],
            ['PaRunManager.js', '_clipUtf16', '_clipTailUtf16'],
            ['tools/PaToolAgentTrace.js', '_clipUtf16', '_clipTailUtf16'],
            ['PaArtifactStore.js', '_clipUtf16', '_clipTailUtf16'],
            ['PaAuditLogger.js', '_clipUtf16', '_clipTailUtf16'],
        ]

        const canonicalHead = memberSource(SOURCES[0][0], SOURCES[0][1])
        const canonicalTail = memberSource(SOURCES[0][0], SOURCES[0][2])

        // A broken extractor comparing two empty strings would pass every
        // assertion below while checking nothing.
        expect(canonicalHead.length).toBeGreaterThan(100)
        expect(canonicalTail.length).toBeGreaterThan(100)

        SOURCES.forEach(([relPath, headName, tailName]) => {
            expect(memberSource(relPath, headName)).toBe(canonicalHead)
            expect(memberSource(relPath, tailName)).toBe(canonicalTail)
        })
    })
})

// ---------------------------------------------------------------------------
// What the helper itself promises
// ---------------------------------------------------------------------------

describe('clipUtf16 — the head half', () => {
    const clip = () => readKit().clipUtf16

    test('a clip landing mid-pair drops the orphaned high surrogate', () => {
        const out = clip()(filler(9) + EMOJI, 10)

        expect(loneSurrogateAt(out)).toBe(-1)
        expect(out).toBe(filler(9))
    })

    test('a clip landing just past a pair keeps both halves', () => {
        const out = clip()(filler(8) + EMOJI + 'zzz', 10)

        expect(out).toBe(filler(8) + EMOJI)
        expect(loneSurrogateAt(out)).toBe(-1)
    })

    test('a limit at or beyond the length returns the text unchanged', () => {
        const text = filler(4) + EMOJI
        expect(clip()(text, text.length)).toBe(text)
        expect(clip()(text, 9999)).toBe(text)
    })

    test('an empty text and a zero limit both yield empty, not a crash', () => {
        expect(clip()('', 10)).toBe('')
        expect(clip()(filler(5) + EMOJI, 0)).toBe('')
    })
})

describe('clipTailUtf16 — the low-surrogate half #106 never covered', () => {
    const clip = () => readKit().clipTailUtf16

    test('a tail beginning mid-pair drops the orphaned LOW surrogate', () => {
        // The tail starts on the second code unit of the emoji.
        const out = clip()(filler(5) + EMOJI + filler(9), 10)

        expect(loneSurrogateAt(out)).toBe(-1)
        expect(out).toBe(filler(9))
    })

    test('a tail beginning exactly on a pair keeps both halves', () => {
        const out = clip()(filler(5) + EMOJI + filler(8), 10)

        expect(out).toBe(EMOJI + filler(8))
        expect(loneSurrogateAt(out)).toBe(-1)
    })

    test('a count at or beyond the length returns the text unchanged', () => {
        const text = EMOJI + filler(4)
        expect(clip()(text, text.length)).toBe(text)
        expect(clip()(text, 9999)).toBe(text)
    })

    test('an empty text and a zero count both yield empty, not a crash', () => {
        expect(clip()('', 10)).toBe('')
        expect(clip()(EMOJI + filler(5), 0)).toBe('')
    })
})

// ---------------------------------------------------------------------------
// Every site that clips, exercised through its real entry point
// ---------------------------------------------------------------------------

/**
 * One case per truncation site named in #137. `build(limits)` returns the input
 * that makes THAT site's cut land between the halves of an emoji; `run` calls
 * the site the way its production caller does.
 *
 * Held as data so a new truncation site is one row, and so the assertion —
 * "the output carries no unpaired surrogate" — is stated once for all of them.
 */
const SITES = [
    {
        name: 'PaToolReadKit.digest — tool result → transcript / artifact',
        run: () => {
            const kit = readKit()
            return kit.digest(filler(kit.DIGEST_CHARS - 1) + EMOJI)
        },
    },
    {
        name: 'PaRunManager._digest — transcript JSON',
        run: () => {
            const mgr = runManager()
            return mgr._digest(filler(mgr.DIGEST_CHARS - 1) + EMOJI)
        },
    },
    {
        name: 'PaRunManager._promptDigest — transcript JSON',
        run: () => {
            const mgr = runManager()
            return mgr._promptDigest(filler(mgr.PROMPT_DIGEST_CHARS - 1) + EMOJI)
        },
    },
    {
        name: 'PaToolAgentTrace._digest — tool result → transcript / artifact',
        run: () => {
            const trace = agentTrace()
            return trace._digest(filler(trace.DIGEST_CHARS - 1) + EMOJI)
        },
    },
    {
        name: 'PaArtifactStore._truncate — HEAD of the artifact excerpt',
        run: () => {
            const store = artifactStore()
            // cap 2000 → head 1500, tail 500. The pair straddles 1500.
            return store._truncate(filler(1499) + EMOJI + filler(3000), 2000)
        },
    },
    {
        name: 'PaArtifactStore._truncate — TAIL of the artifact excerpt',
        run: () => {
            const store = artifactStore()
            // Total 4501; the tail slice starts at 4001, mid-pair.
            return store._truncate(filler(4000) + EMOJI + filler(499), 2000)
        },
    },
    {
        name: 'PaAuditLogger._digest — HEAD of the audit row',
        run: () => {
            const logger = auditLogger()
            // MAX_PAYLOAD_CHARS 4000 → head 3000, tail 1000.
            return logger._digest(filler(2999) + EMOJI + filler(6000))
        },
    },
    {
        name: 'PaAuditLogger._digest — TAIL of the audit row',
        run: () => {
            const logger = auditLogger()
            // Total 9001; the tail slice starts at 8001, mid-pair.
            return logger._digest(filler(8000) + EMOJI + filler(999))
        },
    },
    {
        name: 'PaAuditLogger._trim — audit column cap',
        run: () => {
            const logger = auditLogger()
            return logger._trim(filler(39) + EMOJI, 40)
        },
    },
]

describe('no truncation site emits an unpaired surrogate', () => {
    SITES.forEach((site) => {
        test(site.name, () => {
            const out = site.run()
            const at = loneSurrogateAt(String(out))

            expect({ site: site.name, loneSurrogateAt: at }).toEqual({
                site: site.name,
                loneSurrogateAt: -1,
            })
        })
    })
})

describe('the marker still says how much was cut', () => {
    // The guard trims one code unit off an already-truncated prefix. That must
    // not turn a loud truncation into a silent one — R-24's whole point.
    test('a digest that dropped an orphan still carries its "+N more chars"', () => {
        const kit = readKit()
        const out = kit.digest(filler(kit.DIGEST_CHARS - 1) + EMOJI + filler(50))

        expect(out).toMatch(/\.\.\.\[\+\d+ more chars\]$/)
    })

    test('an excerpt that dropped an orphan still carries its elision marker', () => {
        const store = artifactStore()
        const out = store._truncate(filler(1499) + EMOJI + filler(3000), 2000)

        expect(out).toMatch(/\[elided \d+ chars\]/)
    })
})
