'use strict';

/**
 * Unit tests for the metadata probe
 * (`benchmark/scripts/metadata-probe.js`) — the injected read the adjudicator
 * is registered to receive.
 *
 * ---------------------------------------------------------------------------
 * WHY A PROBE EXISTS AT ALL, AND WHY IT IS A PURE FUNCTION
 * ---------------------------------------------------------------------------
 * `claim-adjudication.js` takes its instance read as an injected function
 * (brief §7, "the instance client is injected, not constructed inline"). Nothing
 * in the tree supplied one. This module is that supplier, and it makes the call
 * to nowhere: the project routes every instance read through the MCP broker so
 * credentials never enter a process argv or an environment, which a Node script
 * cannot do. So the probe reads a COLLECTED SNAPSHOT — evidence gathered once,
 * committed, and thereafter replayable — and the adjudication stays reproducible
 * against a moving instance instead of merely repeatable while it holds still.
 *
 * ---------------------------------------------------------------------------
 * THE DEFECT THIS MODULE EXISTS TO PREVENT
 * ---------------------------------------------------------------------------
 * A table's `sys_dictionary` entry lists the columns it DECLARES, not the
 * columns it HAS. A child table inherits most of what a report would name about
 * it. A probe answering from the child's own declaration alone reports those
 * columns absent — and because every table re-declares `sys_id` locally, the
 * adjudicator's in-band control PASSES while it does so, converting a truthful
 * report into a control-approved `refuted`.
 *
 * That is §AW2's forbidden shape (an inability to observe recorded as an
 * observation) arriving through the guard clause written to stop it, and it is
 * the same species as the two §AX13.5 findings: the principle defeated by a
 * mechanical detail, in a pass that would have looked clean.
 *
 * Hence the union over the inheritance chain, and hence the control moving from
 * "the read returned `sys_id`" to "EVERY link in the chain returned its own".
 * A control only controls for the failure it can actually see.
 *
 * ---------------------------------------------------------------------------
 * THE FIXTURES ARE INVENTED
 * ---------------------------------------------------------------------------
 * Same rule as the extractor's and the adjudicator's tests, mechanically
 * enforced by test/extractorClearing.test.js over this file.
 */

const probeModule = require('../benchmark/scripts/metadata-probe');
const adjudication = require('../benchmark/scripts/claim-adjudication');

/**
 * A snapshot in the shape the collector writes.
 *
 * `zz_parent` declares the shared column a report would most likely name;
 * `zz_child` declares only its own and inherits the rest. That split is the
 * whole point of the fixture.
 */
function snapshot(over) {
    return Object.assign(
        {
            provenance: {
                instance: 'zz-instance.example',
                collected_at: '2026-01-01T00:00:00Z',
                control_table: 'zz_control_table',
            },
            control_table: 'zz_control_table',
            tables: {
                zz_control_table: { exists: true, super_class: null, own_fields: ['sys_id'] },
                zz_parent: { exists: true, super_class: null, own_fields: ['sys_id', 'zz_shared'] },
                zz_child: { exists: true, super_class: 'zz_parent', own_fields: ['sys_id', 'zz_local'] },
                zz_orphan: { exists: false },
            },
        },
        over || {}
    );
}

describe('metadata probe — the inheritance union, which is the reason this module exists', () => {
    test('a column declared by the parent is reported present on the child', () => {
        const probe = probeModule.makeProbe(snapshot());
        const read = probe('zz_child');

        expect(read.table_exists).toBe(true);
        expect(read.fields).toContain('zz_shared');
        expect(read.fields).toContain('zz_local');
    });

    test('the union is what keeps a truthful report from being scored refuted', () => {
        /**
         * The end-to-end statement of the defect, run through the real
         * adjudicator rather than asserted about the probe in isolation —
         * because the failure was never visible in the probe's own output. It
         * only appears once a verdict is drawn from it.
         */
        const claim = {
            id: 'zz-1',
            kind: 'existence',
            polarity: 'asserts',
            subject: { table: 'zz_child', field: 'zz_shared' },
        };

        const honest = adjudication.adjudicate(claim, probeModule.makeProbe(snapshot()));
        expect(honest.verdict).toBe('supported');

        // What a declaration-only probe would have returned for the same claim:
        // the column absent, and the local `sys_id` passing the control anyway.
        const declarationOnly = function () {
            return { table_exists: true, fields: ['sys_id', 'zz_local'], control: { name: 'zz_control_table', exists: true } };
        };
        expect(adjudication.adjudicate(claim, declarationOnly).verdict).toBe('refuted');
    });

    test('a column no table in the chain declares is reported absent', () => {
        const probe = probeModule.makeProbe(snapshot());
        expect(probe('zz_child').fields).not.toContain('zz_absent');
    });

    test('the field list is deduplicated and ordered, so two reads diff cleanly', () => {
        const snap = snapshot();
        snap.tables.zz_child.own_fields = ['zz_local', 'sys_id', 'zz_shared'];
        const fields = probeModule.makeProbe(snap)('zz_child').fields;

        expect(fields).toEqual([...new Set(fields)].sort());
    });

    test('a chain deeper than one link is walked to its root', () => {
        const snap = snapshot();
        snap.tables.zz_grandchild = { exists: true, super_class: 'zz_child', own_fields: ['sys_id', 'zz_leaf'] };

        const fields = probeModule.makeProbe(snap)('zz_grandchild').fields;
        expect(fields).toContain('zz_shared');
        expect(fields).toContain('zz_local');
        expect(fields).toContain('zz_leaf');
    });
});

describe('metadata probe — the per-ancestor control, and why the old one could not see this', () => {
    test('a link missing its own sys_id throws, because the union it fed is truncated', () => {
        const snap = snapshot();
        snap.tables.zz_parent.own_fields = ['zz_shared']; // read came back short

        expect(() => probeModule.makeProbe(snap)('zz_child')).toThrow(/control/i);
    });

    test('the truncated chain reaches the adjudicator as probe_failed, never as a verdict', () => {
        const snap = snapshot();
        snap.tables.zz_parent.own_fields = ['zz_shared'];

        const verdict = adjudication.adjudicate(
            { id: 'zz-2', kind: 'existence', polarity: 'asserts', subject: { table: 'zz_child', field: 'zz_shared' } },
            probeModule.makeProbe(snap)
        );

        expect(verdict.verdict).toBe('unresolvable');
        expect(verdict.reason).toBe('probe_failed');
    });

    test('an ancestor the snapshot never collected throws — uncollected is not absent', () => {
        /**
         * The §AW2 rule applied to the snapshot itself. A parent nobody read is
         * a hole in the evidence; treating it as an empty column list would let
         * a gap in collection masquerade as a fact about the instance.
         */
        const snap = snapshot();
        delete snap.tables.zz_parent;

        expect(() => probeModule.makeProbe(snap)('zz_child')).toThrow(/zz_parent/);
    });

    test('an ancestor recorded as absent throws — a child cannot extend nothing', () => {
        const snap = snapshot();
        snap.tables.zz_parent = { exists: false };

        expect(() => probeModule.makeProbe(snap)('zz_child')).toThrow();
    });

    test('a link with NO super_class key throws — a missing key is not a declared root', () => {
        /**
         * Review of PR #257, and the most serious finding in it: this module's
         * own defect, of the species it exists to prevent.
         *
         * `exists` and `own_fields` were both asserted explicitly while
         * `super_class` was type-checked only WHEN PRESENT — so a collector that
         * dropped or renamed the key for one row terminated the walk at the
         * leaf. Union truncated, per-link control passing (the leaf declares its
         * own `sys_id`), truthful report scored a control-approved `refuted`.
         *
         * A root declares `super_class: null`. Saying nothing is not saying
         * "root"; it is saying nothing, and nothing is not an observation.
         */
        const snap = snapshot();
        delete snap.tables.zz_child.super_class;

        expect(() => probeModule.makeProbe(snap)('zz_child')).toThrow(/super_class/);
    });

    test('and the truncation it would have caused never reaches a verdict', () => {
        const snap = snapshot();
        delete snap.tables.zz_child.super_class;

        const verdict = adjudication.adjudicate(
            { id: 'zz-6', kind: 'existence', polarity: 'asserts', subject: { table: 'zz_child', field: 'zz_shared' } },
            probeModule.makeProbe(snap)
        );

        expect(verdict.verdict).toBe('unresolvable');
        expect(verdict.reason).toBe('probe_failed');
    });

    test('an explicit null super_class is a declared root and walks cleanly', () => {
        expect(probeModule.makeProbe(snapshot())('zz_parent').fields).toContain('zz_shared');
    });

    test('a cycle in the chain throws instead of hanging', () => {
        const snap = snapshot();
        snap.tables.zz_parent.super_class = 'zz_child';

        expect(() => probeModule.makeProbe(snap)('zz_child')).toThrow(/cycle/i);
    });
});

describe('metadata probe — a table the snapshot says is not there', () => {
    test('reports table_exists false with the control that qualifies it', () => {
        const read = probeModule.makeProbe(snapshot())('zz_orphan');

        expect(read.table_exists).toBe(false);
        expect(read.control).toEqual({ name: 'zz_control_table', exists: true });
    });

    test('an absent table needs no field list, and the adjudicator can still refute', () => {
        /**
         * §AX13.5 finding 2 in the probe's own terms: this is the only route to
         * `refuted`, and the first adjudicator disabled it by demanding a field
         * list from a table that has none. The probe must not re-introduce that
         * from its side.
         */
        const verdict = adjudication.adjudicate(
            { id: 'zz-3', kind: 'existence', polarity: 'asserts', subject: { table: 'zz_orphan' } },
            probeModule.makeProbe(snapshot())
        );

        expect(verdict.verdict).toBe('refuted');
    });

    test('a control table looked for and NOT found makes an absence unresolvable, not refuted', () => {
        const snap = snapshot();
        snap.tables.zz_control_table = { exists: false };

        const verdict = adjudication.adjudicate(
            { id: 'zz-4', kind: 'existence', polarity: 'asserts', subject: { table: 'zz_orphan' } },
            probeModule.makeProbe(snap)
        );

        expect(verdict.verdict).toBe('unresolvable');
        expect(verdict.reason).toBe('control_failed');
    });

    test('a control table nobody collected is rejected at construction, not reported as absent', () => {
        /**
         * Review of PR #257. The control lookup bypassed `entryFor`, so an
         * UNCOLLECTED control table was reported `exists: false` and rendered
         * `control_failed` — an assertion that the instrument looked and the
         * control was not there. §AX14.3, registered in this same change, says
         * those two states are never collapsed; the code collapsed them.
         *
         * The verdict was unaffected (both routes end at `unresolvable`) but the
         * REASON was wrong, and the reasons are what the evidence table reports.
         *
         * It is caught at construction because it is a defect of the snapshot,
         * not of any claim — every verdict drawn from it would be equally
         * unqualified, so failing per-claim would report a snapshot-level hole
         * once per claim as though it were claim-level.
         */
        const snap = snapshot();
        delete snap.tables.zz_control_table;

        expect(() => probeModule.makeProbe(snap)).toThrow(/control_table/);
    });
});

describe('metadata probe — a table nobody collected is not a table nobody has', () => {
    test('an uncollected table throws rather than answering', () => {
        expect(() => probeModule.makeProbe(snapshot())('zz_never_collected')).toThrow(/zz_never_collected/);
    });

    test('and that reaches the adjudicator as probe_failed', () => {
        const verdict = adjudication.adjudicate(
            { id: 'zz-5', kind: 'existence', polarity: 'asserts', subject: { table: 'zz_never_collected' } },
            probeModule.makeProbe(snapshot())
        );

        expect(verdict.verdict).toBe('unresolvable');
        expect(verdict.reason).toBe('probe_failed');
    });
});

describe('metadata probe — the snapshot contract, enforced at construction', () => {
    test('a snapshot with no control table is rejected when it is built', () => {
        const snap = snapshot();
        delete snap.control_table;

        expect(() => probeModule.makeProbe(snap)).toThrow(/control_table/);
    });

    test('a snapshot with no tables map is rejected when it is built', () => {
        const snap = snapshot();
        delete snap.tables;

        expect(() => probeModule.makeProbe(snap)).toThrow(/tables/);
    });

    test('a snapshot with no provenance is rejected — evidence without a source is not evidence', () => {
        const snap = snapshot();
        delete snap.provenance;

        expect(() => probeModule.makeProbe(snap)).toThrow(/provenance/);
    });

    test('provenance must name the instance and when it was read', () => {
        const snap = snapshot();
        delete snap.provenance.collected_at;

        expect(() => probeModule.makeProbe(snap)).toThrow(/collected_at/);
    });
});

describe('metadata probe — inherited object keys are not instance metadata', () => {
    /**
     * Review of PR #257. Bare objects backed the cycle set and the field union,
     * so prototype keys leaked into both. Neither name is plausible on this
     * platform; the fix is free, and the second failure mode below is the
     * fabricating one rather than the fail-safe one.
     */
    test('a table named after a prototype member does not read as a cycle', () => {
        const snap = snapshot();
        snap.tables.constructor = { exists: true, super_class: null, own_fields: ['sys_id', 'zz_shared'] };

        expect(() => probeModule.makeProbe(snap)('constructor')).not.toThrow();
    });

    test('a column named after the prototype accessor survives into the union', () => {
        const snap = snapshot();
        snap.tables.zz_parent.own_fields = ['sys_id', '__proto__'];

        expect(probeModule.makeProbe(snap)('zz_child').fields).toContain('__proto__');
    });
});

describe('metadata probe — a key-formatting gap is not an evidence gap', () => {
    /**
     * Review of PR #257. The lookup was an exact key match on whatever string
     * the model emitted from report prose, so a case or whitespace variant threw
     * "uncollected is not absent" — reporting an EVIDENCE hole for what is really
     * a formatting difference. It failed safe on the verdict and deflated
     * determinacy while misdirecting the diagnosis.
     *
     * Normalising is safe in the specific sense that matters: platform table
     * names are lower-case, so no two distinct tables differ only by case or
     * surrounding space. Where that assumption would break — two snapshot keys
     * colliding once normalised — the probe refuses rather than picking one.
     */
    test('a case variant of a collected table resolves to it', () => {
        expect(probeModule.makeProbe(snapshot())('ZZ_Child').fields).toContain('zz_shared');
    });

    test('surrounding whitespace is trimmed', () => {
        expect(probeModule.makeProbe(snapshot())('  zz_child ').table_exists).toBe(true);
    });

    test('a genuinely uncollected table still throws — normalisation does not invent evidence', () => {
        expect(() => probeModule.makeProbe(snapshot())('ZZ_Never_Collected')).toThrow(/never_collected/i);
    });

    test('two snapshot keys colliding under normalisation are refused, not silently merged', () => {
        const snap = snapshot();
        snap.tables.ZZ_CHILD = { exists: true, super_class: null, own_fields: ['sys_id'] };

        expect(() => probeModule.makeProbe(snap)).toThrow(/collid|duplicate/i);
    });
});

describe('metadata probe — no network, by construction', () => {
    test('the module exports a factory over data and nothing that could reach an instance', () => {
        expect(Object.keys(probeModule).sort()).toEqual(['makeProbe', 'validateSnapshot']);
        expect(typeof probeModule.makeProbe).toBe('function');
    });
});
