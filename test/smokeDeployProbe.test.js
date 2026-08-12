/**
 * Tests for the deploy-probe pure core (issue #220).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS TIER EXISTS, AND WHY ITS EXPECTATIONS COME FROM `dist/`
 * ---------------------------------------------------------------------------
 * #220: every platform-behaviour claim in this repo was established BY HAND.
 * 1,781 unit tests run over `vm`-loaded sources with a stubbed Glide, so no
 * green tick here is evidence about instance behaviour — `ci.yml`'s own header
 * says so.
 *
 * The probe closes the narrow half of that: did the payload we built actually
 * LAND. Its expectations are derived from `dist/app/update/*.xml` — the
 * declarative payload itself — rather than from a hand-written manifest, for
 * two reasons:
 *
 *   1. A hand-written expectation list goes stale the first time the app grows
 *      an artifact, and a stale check that still passes is worse than none.
 *   2. DESIGN.md R-27 — "a fixture that agrees with the code by construction is
 *      a second copy of the bug". Comparing dist to the INSTANCE is not that:
 *      dist is what we asked for, the instance is what happened, and the whole
 *      value is in the gap between them.
 *
 * Two documented failure modes are caught by the PRESENCE half alone, and
 * neither is reachable from a unit test:
 *
 *   - Build Rule #34: a platform Data Policy makes app install SKIP a record
 *     silently — no build error, no install error, nothing in the logs — while
 *     the m2m rows referencing it still install. The record is simply absent.
 *   - The deploy-probe lesson (§AQ): `sys_updated_on` does NOT move on
 *     `now-sdk install`, so a merged-but-undeployed commit reads as live if you
 *     probe by timestamp. Probe by CONTENT or you are measuring nothing.
 *
 * Only the pure core is tested here. The shell that runs `now-sdk build`,
 * `now-sdk install` and `now-sdk query` is not unit-tested — mocking the CLI
 * would be exactly the second-copy-of-the-bug R-27 warns about. It is exercised
 * by running it against a real instance, which is the point of the tier.
 */

const { parseUpdateXml } = require('../scripts/smoke/parseUpdateXml')
const { compareRecord, VOLATILE_FIELDS } = require('../scripts/smoke/compare')
const { naturalKeyFor, NATURAL_KEYS } = require('../scripts/smoke/naturalKey')

const XML = [
    '<?xml version="1.0"?>',
    '<record_update table="sys_script_include">',
    '  <sys_script_include action="INSERT_OR_UPDATE">',
    '    <sys_id>02e215b1cf424baeb7f13a3fd5145ae3</sys_id>',
    '    <sys_scope display_value="x_snc_troubleshoot">1304303</sys_scope>',
    '    <access>public</access>',
    '    <active>true</active>',
    '    <caller_access/>',
    '    <name>PaFixReport</name>',
    '    <description>quotes &quot;x&quot; &amp; &lt;angles&gt;</description>',
    '    <script><![CDATA[var a = 1\nif (a < 2 && true) { /* <b> */ }]]></script>',
    '  </sys_script_include>',
    '</record_update>',
].join('\n')

describe('parseUpdateXml', () => {
    test('extracts the table name from the record_update wrapper', () => {
        expect(parseUpdateXml(XML).table).toBe('sys_script_include')
    })

    test('extracts the sys_id', () => {
        expect(parseUpdateXml(XML).sysId).toBe('02e215b1cf424baeb7f13a3fd5145ae3')
    })

    test('extracts a simple text field', () => {
        expect(parseUpdateXml(XML).fields.name).toBe('PaFixReport')
    })

    test('reads the TEXT of an element that also carries attributes', () => {
        // `<sys_scope display_value="...">sys_id</sys_scope>` — the value that
        // matters is the sys_id, not the display_value.
        expect(parseUpdateXml(XML).fields.sys_scope).toBe('1304303')
    })

    test('a self-closing element is an empty string, not undefined', () => {
        // Distinguishing "declared empty" from "not declared" matters: only the
        // former should be compared against the instance.
        expect(parseUpdateXml(XML).fields.caller_access).toBe('')
    })

    test('decodes XML entities', () => {
        expect(parseUpdateXml(XML).fields.description).toBe('quotes "x" & <angles>')
    })

    test('takes CDATA verbatim, without entity-decoding its contents', () => {
        // A script body is the highest-value field in the whole probe. If the
        // parser mangles it, every script include reports a false mismatch.
        const script = parseUpdateXml(XML).fields.script
        expect(script).toContain('if (a < 2 && true)')
        expect(script).toContain('/* <b> */')
        expect(script).not.toContain('&amp;')
    })

    test('does not treat the action attribute as a field', () => {
        expect(parseUpdateXml(XML).fields.action).toBeUndefined()
    })

    test('falls back to the record element name when the wrapper has no table attribute', () => {
        // MEASURED, not hypothesised: the SDK emits BOTH shapes into the same
        // dist/ — sys_ws_operation carries `table="..."` on the wrapper, while
        // sys_security_acl and 38 other records do not. Requiring the attribute
        // made the probe blind to a third of the payload while reporting
        // success on the rest, which is the worst possible failure for a check.
        const noAttr = [
            '<?xml version="1.0"?>',
            '<record_update>',
            '  <sys_security_acl action="INSERT_OR_UPDATE">',
            '    <sys_id>4db071a71082415f9de11a602563bd52</sys_id>',
            '    <operation>execute</operation>',
            '  </sys_security_acl>',
            '</record_update>',
        ].join('\n')

        const parsed = parseUpdateXml(noAttr)
        expect(parsed.table).toBe('sys_security_acl')
        expect(parsed.sysId).toBe('4db071a71082415f9de11a602563bd52')
        expect(parsed.fields.operation).toBe('execute')
    })
})

describe('compareRecord', () => {
    const expected = {
        table: 'sys_script_include',
        sysId: 'abc',
        fields: { name: 'PaFixReport', access: 'public', active: 'true' },
    }

    test('an absent instance record is a single missing finding', () => {
        // This is Build Rule #34's signature: the record was skipped silently
        // at install. One finding, not one per field — the field-level noise
        // would bury the fact that the record is not there at all.
        const findings = compareRecord(expected, null)
        expect(findings).toHaveLength(1)
        expect(findings[0].kind).toBe('missing')
        expect(findings[0].table).toBe('sys_script_include')
        expect(findings[0].sysId).toBe('abc')
    })

    test('a fully matching record produces no findings', () => {
        expect(compareRecord(expected, { name: 'PaFixReport', access: 'public', active: 'true' })).toEqual([])
    })

    test('a differing field is a mismatch finding naming the field', () => {
        const findings = compareRecord(expected, { name: 'PaFixReport', access: 'package_private', active: 'true' })
        expect(findings).toHaveLength(1)
        expect(findings[0].kind).toBe('mismatch')
        expect(findings[0].field).toBe('access')
        expect(findings[0].expected).toBe('public')
        expect(findings[0].actual).toBe('package_private')
    })

    test('reports every differing field, not just the first', () => {
        const findings = compareRecord(expected, { name: 'Other', access: 'package_private', active: 'true' })
        expect(findings.map((f) => f.field).sort()).toEqual(['access', 'name'])
    })

    test('a field the instance does not return at all is a mismatch, not a silent pass', () => {
        // The dangerous direction: treating "absent" as "equal" would make the
        // probe green on a record whose fields never installed.
        const findings = compareRecord(expected, { name: 'PaFixReport', access: 'public' })
        expect(findings.map((f) => f.field)).toEqual(['active'])
    })

    test('volatile install-stamped fields are never compared', () => {
        // These differ by construction on every install and would make the
        // probe cry wolf, which is how a check gets ignored and then deleted.
        const withVolatile = {
            table: 'sys_script_include',
            sysId: 'abc',
            fields: { name: 'PaFixReport', sys_update_name: 'a', sys_mod_count: '0', sys_updated_on: 'x' },
        }
        expect(compareRecord(withVolatile, { name: 'PaFixReport', sys_update_name: 'b', sys_mod_count: '9' })).toEqual([])
    })

    test('VOLATILE_FIELDS is exported so the skip list is reviewable, not buried', () => {
        expect(VOLATILE_FIELDS.has('sys_update_name')).toBe(true)
        expect(VOLATILE_FIELDS.has('script')).toBe(false)
    })

    test('empty string and a missing-on-instance value compare equal', () => {
        // The Table API returns '' for unset fields; dist writes `<x/>`. Same
        // thing, and treating them as different would be pure noise.
        const e = { table: 't', sysId: 'a', fields: { caller_access: '' } }
        expect(compareRecord(e, { caller_access: '' })).toEqual([])
        expect(compareRecord(e, {})).toEqual([])
    })

    test('CRLF and LF line endings compare equal in a script body', () => {
        // The platform normalizes line endings on store. Without this, all 18
        // script includes report a mismatch and the probe is useless.
        const e = { table: 't', sysId: 'a', fields: { script: 'var a = 1\nvar b = 2\n' } }
        expect(compareRecord(e, { script: 'var a = 1\r\nvar b = 2\r\n' })).toEqual([])
    })

    test('trailing whitespace differences do not mask a real body change', () => {
        const e = { table: 't', sysId: 'a', fields: { script: 'var a = 1' } }
        expect(compareRecord(e, { script: 'var a = 2' })).toHaveLength(1)
    })

    test('a column the TABLE does not have is uncomparable, not a mismatch', () => {
        // MEASURED on gpinst01: dist writes `acl`, `active` and `external` onto
        // sn_aia_agent, and that table has none of those columns — the install
        // silently drops them. Reporting three mismatches per agent would be
        // permanent red on a healthy deploy, and permanent red is how a check
        // gets ignored and then deleted.
        //
        // But it is NOT nothing either: the probe cannot see those fields, and
        // saying so out loud is the difference between a known blind spot and a
        // silent one.
        const knownFields = new Set(['name', 'access'])
        const findings = compareRecord(expected, { name: 'PaFixReport', access: 'public' }, { knownFields })

        expect(findings).toHaveLength(1)
        expect(findings[0].kind).toBe('uncomparable')
        expect(findings[0].field).toBe('active')
    })

    test('a column the table DOES have, absent from this record, is still a mismatch', () => {
        // The dangerous direction, kept closed: `knownFields` must only excuse
        // fields the table genuinely lacks, never a field that failed to install
        // on one record while its siblings carry it.
        const knownFields = new Set(['name', 'access', 'active'])
        const findings = compareRecord(expected, { name: 'PaFixReport', access: 'public' }, { knownFields })

        expect(findings).toHaveLength(1)
        expect(findings[0].kind).toBe('mismatch')
        expect(findings[0].field).toBe('active')
    })

    test('with no knownFields the probe compares everything, staying conservative', () => {
        expect(compareRecord(expected, { name: 'PaFixReport', access: 'public' })).toHaveLength(1)
        expect(compareRecord(expected, { name: 'PaFixReport', access: 'public' })[0].kind).toBe('mismatch')
    })

    test('extra fields on the instance are ignored', () => {
        // dist declares what we asked for; the instance carries platform
        // defaults we never expressed an opinion about.
        expect(compareRecord(expected, {
            name: 'PaFixReport', access: 'public', active: 'true', sys_class_name: 'sys_script_include',
        })).toEqual([])
    })
})

describe('naturalKeyFor', () => {
    test('sys_db_object is keyed by name, because the platform reassigns its sys_id', () => {
        // MEASURED on gpinst01: dist declares sys_db_object
        // b69939bf9e8347aaba5568b133765d6d for x_snc_troubleshoot_audit; the
        // instance holds 76a9a56f2b5a87d0f243fed2ce91bf7e. The table exists and
        // is healthy — the build's sys_id simply is not honoured for table
        // metadata. Keyed by sys_id, the probe calls a working table MISSING
        // and points the reader at Build Rule #34, which is a false trail.
        const key = naturalKeyFor({
            table: 'sys_db_object',
            sysId: 'b69939bf9e8347aaba5568b133765d6d',
            fields: { name: 'x_snc_troubleshoot_audit' },
        })
        expect(key).toEqual({ query: 'name=x_snc_troubleshoot_audit', fields: ['name'] })
    })

    test('sys_dictionary needs name AND element — neither is unique alone', () => {
        const key = naturalKeyFor({
            table: 'sys_dictionary',
            sysId: 'x',
            fields: { name: 'x_snc_troubleshoot_run', element: 'status' },
        })
        expect(key.query).toBe('name=x_snc_troubleshoot_run^element=status')
    })

    test('a table with no natural key returns null, so it stays sys_id-keyed', () => {
        expect(naturalKeyFor({ table: 'sys_script_include', sysId: 'x', fields: { name: 'Pa' } })).toBeNull()
    })

    test('a natural-keyed table missing its key field returns null rather than a wrong query', () => {
        // Guessing here would silently match the wrong record, which is worse
        // than reporting the record as missing.
        expect(naturalKeyFor({ table: 'sys_dictionary', sysId: 'x', fields: { name: 'a' } })).toBeNull()
    })

    test('NATURAL_KEYS is exported so the exception list stays reviewable', () => {
        // Every entry is a table where the probe has given up on sys_id
        // identity. That is a real weakening — it can no longer detect a record
        // reinstalled under a new sys_id — so the list should be short and
        // each entry should be there because it was MEASURED, not assumed.
        expect(Object.keys(NATURAL_KEYS).sort()).toEqual(['sys_db_object', 'sys_dictionary'])
    })
})

describe('an empty value in dist is an absence of assertion', () => {
    // MEASURED on gpinst01: the SDK emits `<virtual/>`, `<dynamic_creation/>`
    // and `<reference_floats/>` for fields it holds no value for, and the
    // platform then stores its column default ("false"). Reading `''` as "must
    // be empty" produced 3 mismatches on every one of the 24 dictionary rows —
    // 72 findings, all of them noise, on a completely healthy deploy.
    //
    // So `''` is read as "dist expressed no opinion". The cost, stated plainly:
    // the probe cannot detect a field dist leaves unset whose instance value is
    // something other than the default. It is counted and disclosed rather than
    // dropped — see the `unasserted` finding kind.

    test('an unset field is not compared against the platform default', () => {
        const e = { table: 'sys_dictionary', sysId: 'a', fields: { virtual: '', name: 'x_run' } }
        const findings = compareRecord(e, { virtual: 'false', name: 'x_run' })
        expect(findings.filter((f) => f.kind === 'mismatch')).toEqual([])
    })

    test('but the blindness is disclosed, not silently dropped', () => {
        const e = { table: 'sys_dictionary', sysId: 'a', fields: { virtual: '', name: 'x_run' } }
        const findings = compareRecord(e, { virtual: 'false', name: 'x_run' })
        expect(findings).toHaveLength(1)
        expect(findings[0].kind).toBe('unasserted')
        expect(findings[0].field).toBe('virtual')
    })

    test('a field dist DID set is still compared, so the weakening is bounded', () => {
        const e = { table: 'sys_dictionary', sysId: 'a', fields: { virtual: 'true' } }
        expect(compareRecord(e, { virtual: 'false' })[0].kind).toBe('mismatch')
    })
})

describe('naturalKeyFor — the dictionary collection row', () => {
    test('an empty element is a legitimate key part, not a missing key', () => {
        // MEASURED: sys_dictionary_x_snc_troubleshoot_audit_null.xml is the
        // TABLE-level row (`internal_type=collection`, `<element/>`). Refusing
        // to key it left one record per table unprobed, reported as UNKEYED.
        const key = naturalKeyFor({
            table: 'sys_dictionary',
            sysId: 'x',
            fields: { name: 'x_snc_troubleshoot_audit', element: '' },
        })
        expect(key).not.toBeNull()
        expect(key.query).toBe('name=x_snc_troubleshoot_audit^element=')
    })

    test('an UNDECLARED element is still a refusal — declared-empty is not the same as absent', () => {
        expect(naturalKeyFor({ table: 'sys_dictionary', sysId: 'x', fields: { name: 'a' } })).toBeNull()
    })

    test('the lead field must be non-empty, or the key identifies nothing', () => {
        expect(naturalKeyFor({ table: 'sys_dictionary', sysId: 'x', fields: { name: '', element: 'status' } })).toBeNull()
    })
})

describe('firstDifference — so a long-field mismatch is readable', () => {
    const { firstDifference } = require('../scripts/smoke/compare')

    test('returns the index of the first differing character', () => {
        expect(firstDifference('abcdef', 'abcXef')).toBe(3)
    })

    test('returns the length of the shorter string when one is a prefix', () => {
        expect(firstDifference('abc', 'abcdef')).toBe(3)
    })

    test('returns -1 for identical strings', () => {
        expect(firstDifference('abc', 'abc')).toBe(-1)
    })

    test('a 133KB script whose only change is deep inside still reports that offset', () => {
        // Without this, the report printed the first 120 characters of both
        // sides — which for two script includes differing at byte 40,000 were
        // BYTE-IDENTICAL previews under a MISMATCH heading. A finding the
        // reader cannot act on is barely better than no finding.
        const a = 'x'.repeat(40000) + 'A' + 'y'.repeat(1000)
        const b = 'x'.repeat(40000) + 'B' + 'y'.repeat(1000)
        expect(firstDifference(a, b)).toBe(40000)
    })
})

describe('platform truncation is disclosed, not called a broken deploy', () => {
    test('an actual value that is a strict prefix of expected is a truncation note', () => {
        // MEASURED on gpinst01: sys_ws_operation.short_description is capped at
        // 80 characters, and six of this app's route descriptions are longer.
        // The platform stores the first 80 and drops the rest — silently, at
        // install. That is worth knowing and worth fixing IN SOURCE, but it is
        // not the deploy being broken, and failing on it forever would train
        // the reader to ignore the whole report.
        const e = { table: 'sys_ws_operation', sysId: 'a', fields: { short_description: 'a'.repeat(100) } }
        const findings = compareRecord(e, { short_description: 'a'.repeat(80) })
        expect(findings).toHaveLength(1)
        expect(findings[0].kind).toBe('truncated')
        expect(findings[0].keptChars).toBe(80)
    })

    test('a value that merely SHARES a prefix is still a mismatch', () => {
        // The distinction that keeps `truncated` from becoming a hiding place:
        // truncation means the instance value IS the head of ours, exactly.
        const e = { table: 't', sysId: 'a', fields: { x: 'hello world' } }
        expect(compareRecord(e, { x: 'hello there' })[0].kind).toBe('mismatch')
    })

    test('an instance value LONGER than expected is a mismatch, never a truncation', () => {
        const e = { table: 't', sysId: 'a', fields: { x: 'short' } }
        expect(compareRecord(e, { x: 'short and then some' })[0].kind).toBe('mismatch')
    })
})

describe('truncation is only excused where a cap was MEASURED (review #229, finding 2)', () => {
    const { CAPPED_COLUMNS } = require('../scripts/smoke/compare')

    test('an append-only stale deploy is a MISMATCH, not a platform truncation', () => {
        // The defect: the downgrade fired on any prefix relationship, and
        // `truncated` is a note that does not redden the exit code. A stale
        // deploy whose change was append-only — extra lines at the end of a
        // script include — leaves the instance holding a strict prefix of what
        // we built. The probe called it a tidy platform cap and exited 0 on
        // exactly the class it exists to catch.
        const e = { table: 'sys_script_include', sysId: 'a', fields: { script: 'var a = 1\nvar b = 2\n' } }
        const findings = compareRecord(e, { script: 'var a = 1\n' })
        expect(findings[0].kind).toBe('mismatch')
    })

    test('short_description at exactly 80 is the measured cap, and stays a note', () => {
        const e = { table: 'sys_ws_operation', sysId: 'a', fields: { short_description: 'a'.repeat(120) } }
        const findings = compareRecord(e, { short_description: 'a'.repeat(80) })
        expect(findings[0].kind).toBe('truncated')
    })

    test('a capped column stopping short of its cap is a mismatch — the cap is the whole signal', () => {
        // 79 characters is not the column giving up at its limit; it is a
        // different value that happens to share a prefix.
        const e = { table: 'sys_ws_operation', sysId: 'a', fields: { short_description: 'a'.repeat(120) } }
        expect(compareRecord(e, { short_description: 'a'.repeat(79) })[0].kind).toBe('mismatch')
    })

    test('CAPPED_COLUMNS is exported and carries the measured length, not a guess', () => {
        expect(CAPPED_COLUMNS.short_description).toBe(80)
    })
})

describe('parseUpdateXml robustness (review #229, findings 6 and 7)', () => {
    test('CDATA is recognized even with whitespace after the open tag', () => {
        // Without this, indexOf finds a literal `</script>` INSIDE the body and
        // truncates the field there — surfacing as a mismatch, or worse as a
        // truncation note, on a completely healthy deploy.
        const xml = [
            '<record_update table="t">',
            '  <t action="INSERT_OR_UPDATE">',
            '    <sys_id>a</sys_id>',
            '    <script>\n      <![CDATA[var s = "</script>"; var t = 1;]]>\n    </script>',
            '  </t>',
            '</record_update>',
        ].join('\n')
        expect(parseUpdateXml(xml).fields.script).toBe('var s = "</script>"; var t = 1;')
    })

    test('a field whose close tag is missing is reported, not silently dropped', () => {
        // A dropped field left the record looking parseable while the probe
        // compared a partial field set and reported success over it.
        const xml = [
            '<record_update table="t">',
            '  <t action="INSERT_OR_UPDATE">',
            '    <sys_id>a</sys_id>',
            '    <broken>no close tag here',
            '  </t>',
            '</record_update>',
        ].join('\n')
        expect(parseUpdateXml(xml).defects.length).toBeGreaterThan(0)
    })

    test('a clean record reports no defects', () => {
        expect(parseUpdateXml(XML).defects).toEqual([])
    })
})

describe('hasNaturalKey is a property of the TABLE (review #229, finding 3)', () => {
    const { hasNaturalKey } = require('../scripts/smoke/naturalKey')

    test('the decision does not depend on any one record', () => {
        // The defect: the whole table's keying strategy was decided from
        // tableRecords[0]. One record missing a key field sent every record of
        // that table back to sys_id keying — under which sys_db_object and
        // sys_dictionary are reported MISSING while citing Build Rule #34, the
        // confident-wrong-cause outcome naturalKey.js exists to eliminate.
        expect(hasNaturalKey('sys_dictionary')).toBe(true)
        expect(hasNaturalKey('sys_db_object')).toBe(true)
        expect(hasNaturalKey('sys_script_include')).toBe(false)
    })
})
