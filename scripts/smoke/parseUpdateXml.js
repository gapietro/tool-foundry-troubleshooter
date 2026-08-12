/**
 * Parse one `dist/app/update/*.xml` record into a comparable shape (issue #220).
 *
 * These files are the declarative payload `now-sdk install` sends: one record
 * per file, named `<table>_<sys_id>.xml`, carrying every field the build chose
 * to express. That makes them the right source of truth for a deploy probe —
 * they are what we ASKED FOR, and the instance is what HAPPENED.
 *
 * This is a scanner, not a general XML parser, and deliberately so: the shape
 * is fixed and flat (a `record_update` wrapper, one record element, then
 * non-nested field elements), and pulling a dependency in for it would put a
 * parser between the probe and the bytes it exists to compare.
 *
 * The one subtlety worth knowing: script bodies arrive in CDATA and must be
 * taken VERBATIM. Entity-decoding a CDATA section would rewrite `&amp;` inside
 * real source and make all 18 script includes report a false mismatch — a probe
 * that cries wolf gets ignored, then deleted, which is worse than not having it.
 */

/** Fields are flat inside the record element, so a scan is enough. */
function scanFields(inner) {
    const fields = {}
    let i = 0

    while (i < inner.length) {
        const lt = inner.indexOf('<', i)
        if (lt === -1) break

        if (inner.startsWith('<!--', lt)) {
            const end = inner.indexOf('-->', lt)
            if (end === -1) break
            i = end + 3
            continue
        }

        const gt = inner.indexOf('>', lt)
        if (gt === -1) break

        const raw = inner.slice(lt + 1, gt)

        // A stray close tag (the record element's own) — skip it.
        if (raw.charAt(0) === '/') {
            i = gt + 1
            continue
        }

        const selfClosing = raw.charAt(raw.length - 1) === '/'
        const name = raw.replace(/\/$/, '').split(/\s/)[0]

        // `<caller_access/>` is a DECLARED empty value, not an absent one. The
        // distinction matters downstream: only declared fields get compared.
        if (selfClosing) {
            fields[name] = ''
            i = gt + 1
            continue
        }

        // If the content opens with CDATA, close the CDATA before looking for
        // the element's end tag — otherwise a script body containing the
        // literal `</script>` would truncate itself.
        let searchFrom = gt + 1
        const afterOpen = inner.slice(gt + 1)
        if (afterOpen.startsWith('<![CDATA[')) {
            const cdataEnd = inner.indexOf(']]>', gt + 1)
            if (cdataEnd !== -1) searchFrom = cdataEnd + 3
        }

        const closeTag = '</' + name + '>'
        const close = inner.indexOf(closeTag, searchFrom)
        if (close === -1) {
            i = gt + 1
            continue
        }

        fields[name] = decodeContent(inner.slice(gt + 1, close))
        i = close + closeTag.length
    }

    return fields
}

function decodeContent(content) {
    const trimmed = content.trim()
    if (trimmed.startsWith('<![CDATA[') && trimmed.endsWith(']]>')) {
        return trimmed.slice('<![CDATA['.length, trimmed.length - ']]>'.length)
    }
    return decodeEntities(content)
}

function decodeEntities(text) {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, function (_m, code) {
            return String.fromCharCode(parseInt(code, 10))
        })
        // `&amp;` LAST, so `&amp;lt;` decodes to the literal `&lt;` and not `<`.
        .replace(/&amp;/g, '&')
}

/**
 * @param {string} xml raw contents of one dist update file
 * @returns {{table: string|null, sysId: string|null, fields: Object}}
 */
function parseUpdateXml(xml) {
    // The SDK emits BOTH wrapper shapes into the same dist/: some carry
    // `table="..."`, and 39 of 160 do not — the table is then only the record
    // element's own name. Requiring the attribute made the probe silently blind
    // to a quarter of the payload while reporting success on the rest.
    const tableMatch = /<record_update\b[^>]*\btable="([^"]+)"/.exec(xml)
    const attrTable = tableMatch ? tableMatch[1] : null

    const wrapperOpen = xml.indexOf('<record_update')
    const wrapperEnd = xml.lastIndexOf('</record_update>')
    if (wrapperOpen === -1 || wrapperEnd === -1) {
        return { table: attrTable, sysId: null, fields: {} }
    }

    const body = xml.slice(xml.indexOf('>', wrapperOpen) + 1, wrapperEnd)

    // The record element is the first element inside the wrapper, and its name
    // is the table when the wrapper did not say.
    const recordOpen = /<([A-Za-z0-9_]+)\b[^>]*>/.exec(body)
    if (!recordOpen) return { table: attrTable, sysId: null, fields: {} }

    const recordName = recordOpen[1]
    const table = attrTable || recordName
    const innerStart = recordOpen.index + recordOpen[0].length
    const innerEnd = body.lastIndexOf('</' + recordName + '>')
    const inner = body.slice(innerStart, innerEnd === -1 ? body.length : innerEnd)

    const fields = scanFields(inner)

    return {
        table: table,
        sysId: fields.sys_id || null,
        fields: fields,
    }
}

module.exports = { parseUpdateXml: parseUpdateXml }
