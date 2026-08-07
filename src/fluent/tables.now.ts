/**
 * Scoped custom tables — LOW_LEVEL_DESIGN.md §3.1 and §3.2.
 *
 * Two tables, one purpose: give every diagnostic run a durable anchor.
 *
 *   x_snc_troubleshoot_run   — one record per diagnostic conversation. Artifacts
 *                              (LLD §4.5) are ATTACHMENTS on this record, so it
 *                              must exist before PaArtifactStore can store
 *                              anything (Task 4) and before PaRunAnchor can
 *                              anchor anything (Task 5).
 *   x_snc_troubleshoot_audit — one record per tool intent / result / error,
 *                              written by PaAuditLogger around every tool call.
 *
 * WHY ONE RUN TABLE SERVES BOTH HARNESSES
 * The `harness` column (`native` | `custom`) is the whole reason there is one
 * run table rather than two. Artifacts, audit trail and benchmark scoring then
 * work identically whichever harness drove the run (IMPLEMENTATION_PLAN.md §
 * "Structural contract"), which is what makes the two harnesses comparable at
 * Task 11 instead of merely coexisting.
 *
 * NAMING IS NOT COSMETIC (DESIGN.md R-13)
 * A scoped table name must begin with its application's EXACT scope value.
 * `x_pa_run` — the name every earlier design doc used — is not shorthand that
 * expands, it is a value the platform rejects. Verified on gpinst01: of 40
 * `x_snc_*` tables sampled from `sys_db_object`, 40 of 40 are named
 * `<sys_scope.scope>_<name>`. LLD §3 is the authority; these are those names.
 *
 * TWO TYPE CHOICES THE LLD LEFT OPEN (confirmed with the developer, issue #14)
 *
 * 1. `transcript`, `fix_report`, `input`, `output` are specified only as
 *    "string (JSON, large)". They are MultiLineTextColumn at 65536, written and
 *    read as JSON.stringify / JSON.parse. Not JsonColumn: a json-typed column
 *    validates on write, and a rejected write from a rhino.global script tool
 *    would surface as a BLANK, not an error — precisely the failure mode R-6
 *    exists to warn about. Anything genuinely large is offloaded to an
 *    attachment by PaArtifactStore at ~4KB (LLD §4.5) long before 65536; the
 *    headroom is there so an incremental transcript write cannot be silently
 *    truncated at the column boundary before the store ever sees it.
 *
 * 2. `run.agent` is a real cross-scope ReferenceColumn into `sn_aia_agent`, as
 *    §3.1 specifies, rather than a bare sys_id string. The scope probe already
 *    confirms `sn_aia_agent` is readable from this scope (14 of 15 tables read,
 *    the one denial being `syslog`), so if the platform were to object to the
 *    reference we learn it here at Task 2, not at Task 10 with an agent
 *    half-built on top of it. Note the backtick form on `referenceTable` — the
 *    SDK requires it for tables with no local definition in this project.
 *    `execution_ref` stays a plain sys_id string because §3.1 says so: it points
 *    at an `sn_aia_execution_plan` row that may well be gone by the time anyone
 *    reads the run record, and a dangling reference field reads as empty.
 *
 * NO DEFAULTS ON `status` OR `harness` — deliberately. LLD §4.6 has PaRunAnchor
 * create the record with `harness=native`, `status=running` explicitly, and §3.1
 * notes "native runs go straight to `running`". A default of `queued` would let
 * a caller that forgot to set status produce a record that looks queued and
 * never moves, which is a blank masquerading as a state (R-6 again). `mode` does
 * default to `diagnose` because that IS the ordinary case and `collect` is the
 * opt-in Evidence Bundle path.
 *
 * Build rules in play: #9 (export name must equal the table name — hence the
 * snake_case exports below, which look wrong and are correct) and #8
 * (ChoiceColumn choices are `{ value_key: 'Label' }`, never `[{value,label}]`).
 */

import '@servicenow/sdk/global'
import {
    Table,
    StringColumn,
    BooleanColumn,
    ReferenceColumn,
    ChoiceColumn,
    MultiLineTextColumn,
} from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// LLD §3.1 — x_snc_troubleshoot_run (diagnostic run)
// ---------------------------------------------------------------------------
export const x_snc_troubleshoot_run = Table({
    name: 'x_snc_troubleshoot_run',
    label: 'Diagnostic Run',
    extensible: false,
    display: 'number',
    audit: false,

    // Table API access, so runs can be read and verified from MCP — this
    // project's stated boundary is "SDK owns creation, MCP owns runtime", and
    // without this a run's contents can only be inferred from the code that
    // wrote them. Note that ws_access is NOT security: the ACLs in
    // `acls.now.ts` are what gate this table, and both are required.
    allowWebServiceAccess: true,

    // §3.1: "number | auto-number | display value, prefix TR". The table does
    // not extend `task`, so it does not inherit a `number` column — the column
    // below is declared explicitly for autoNumber to populate.
    autoNumber: {
        prefix: 'TR',
        numberOfDigits: 7,
        number: 1000000,
    },

    schema: {
        // MEASURED, NOT ASSUMED (gpinst01, 2026-07-31): the `autoNumber` block
        // above creates the `sys_number` counter row (TR / 7 digits / 1000000)
        // and stops there — it does NOT wire the column default. A record
        // inserted without this line gets `number = ''`, and since `number` is
        // also the display field, every run renders with a blank display value.
        // Installs clean, fails quietly at runtime, which is the exact shape of
        // failure this project keeps designing against. The default below is
        // what Studio's "Auto number" checkbox writes; it is one string literal,
        // as Build Rule #29 requires.
        //
        // The `global.` prefix is load-bearing and was ALSO measured: the bare
        // `javascript:getNextObjNumberPadded();` installs fine and still yields
        // an empty number, because the function lives in global scope and a
        // scoped app cannot resolve it unqualified — the failed evaluation
        // produces '' rather than an error. Confirmed against this instance's
        // own convention: of 10 scoped `x_*` tables with an auto-numbered
        // `number` column, 8 use the `global.`-qualified form.
        number: StringColumn({
            label: 'Number',
            maxLength: 40,
            readOnly: true,
            default: 'javascript:global.getNextObjNumberPadded();',
        }),

        user: ReferenceColumn({
            label: 'User',
            referenceTable: 'sys_user',
        }),

        // The field that lets one run table serve both worlds.
        harness: ChoiceColumn({
            label: 'Harness',
            choices: {
                native: 'Native (AI Agent Studio)',
                custom: 'Custom Harness',
            },
        }),

        // Cross-scope reference into sn_aia. Nullable per §3.1: a run can be
        // opened against an execution whose agent field is empty, or carries
        // the literal string "undefined" (LLD §4.1) — in which case the usecase,
        // not the agent, is the reliable anchor and this stays blank.
        agent: ReferenceColumn({
            label: 'Agent Under Diagnosis',
            referenceTable: `sn_aia_agent`,
        }),

        // sys_id of the sn_aia_execution_plan under diagnosis, as a string —
        // see the header note on why this is not a reference field.
        execution_ref: StringColumn({
            label: 'Execution Plan',
            maxLength: 32,
        }),

        // THE RUN'S SUBJECT (issue #99).
        //
        // The inbound POST /analyze body, verbatim, written by
        // PaRunManager.createRun. Before this existed, a run recorded only
        // what the model DERIVED from the request (tool arguments in the
        // audit table) and never the request itself — so a later benchmark
        // pass could not prove it had asked the same question as an earlier
        // one, and no run was reproducible from its own record.
        //
        // Empty on every native run by construction: PaRunAnchor keys on
        // `_agentic_context_` and there is no inbound body on that path.
        // Empty is the honest value there, not a gap to fill later.
        request: MultiLineTextColumn({
            label: 'Request',
            maxLength: 65536,
        }),

        // Set when the body exceeded PaRunManager.REQUEST_CHARS and the
        // stored text is a PREFIX. A separate flag rather than a JSON
        // envelope: a clipped body is not parseable JSON, so an envelope
        // would have to hold it as an escaped string, and escaping a log
        // paste can nearly double its length against a fixed ceiling.
        //
        // Three states, all distinguishable from the row alone:
        //   request non-empty + false -> whole body, JSON.parse is valid
        //   request non-empty + true  -> a prefix; documentation, not data
        //   request empty     + false -> absent (native run, or a body that
        //                                would not serialize)
        // Absent and truncated must never collapse into one state.
        request_truncated: BooleanColumn({
            label: 'Request Truncated',
            default: false,
        }),

        // THE ANCHOR KEY (added at Task 5, issue #20).
        //
        // LLD §4.6 has PaRunAnchor key on `_agentic_context_.conversation_id`,
        // but §3.1's column list had nowhere to put it — so `getOrCreate` could
        // only ever CREATE, never get, and every tool call in one conversation
        // would have opened its own run. `execution_ref` cannot double as the
        // key: §3.1 spends it on the execution plan under diagnosis, which is
        // the record being *looked at*, not the conversation doing the looking.
        //
        // Plain string, not a reference: the conversation may be a
        // `sys_cs_conversation` row, or may not exist as a row this scope can
        // see at all, and a dangling reference field reads as empty — the same
        // reasoning as `execution_ref` above.
        //
        // R-2 is why this is the conversation and not something coarser: the
        // deleted "one anchor per user per 30 minutes" fallback would merge two
        // benchmark runs onto one record, letting run 2 read run 1's artifacts
        // and quietly destroying the blind-run independence the doubled-run
        // protocol exists to measure (DESIGN.md §2.4).
        conversation_ref: StringColumn({
            label: 'Conversation',
            maxLength: 32,
        }),

        mode: ChoiceColumn({
            label: 'Mode',
            choices: {
                diagnose: 'Diagnose',
                collect: 'Collect (Evidence Bundle)',
            },
            default: 'diagnose',
        }),

        status: ChoiceColumn({
            label: 'Status',
            choices: {
                queued: 'Queued',
                running: 'Running',
                awaiting_confirmation: 'Awaiting Confirmation',
                complete: 'Complete',
                failed: 'Failed',
            },
        }),

        // JSON array of {seq, actor, tool, args_digest, result_digest,
        // artifact_id?, ts}. See the header note on the type choice.
        // A stored entry may additionally carry prompt_digest (issue #72) —
        // DERIVED from result_digest, written only on tool entries, and
        // pruned to the newest PROMPT_WINDOW entries that carry it (see
        // PaRunManager.js's appendTranscript/_prunePromptWindow). Not part
        // of the write contract callers populate; never present on llm or
        // system entries.
        transcript: MultiLineTextColumn({
            label: 'Transcript',
            maxLength: 65536,
        }),

        // Summarized older transcript, for when the run outgrows the context
        // window — the native harness's 128K ceiling is what this is for.
        context_summary: MultiLineTextColumn({
            label: 'Context Summary',
            maxLength: 4000,
        }),

        // The validated Fix Report — the terminal output of a diagnosis.
        fix_report: MultiLineTextColumn({
            label: 'Fix Report',
            maxLength: 65536,
        }),

        // Terminal error if status=failed. A run that fails must say why here
        // rather than simply stopping.
        error: MultiLineTextColumn({
            label: 'Error',
            maxLength: 4000,
        }),
    },
})

// ---------------------------------------------------------------------------
// LLD §3.2 — x_snc_troubleshoot_audit
//
// Written by PaAuditLogger (Task 5) from inside PaScriptToolAdapter (Task 9),
// around every tool execution: logIntent before, logResult or logError after.
// Three rows per successful call is the intended shape, not overhead — the
// intent row records what the agent MEANT to do, which is the only evidence
// available when a tool never returns.
// ---------------------------------------------------------------------------
export const x_snc_troubleshoot_audit = Table({
    name: 'x_snc_troubleshoot_audit',
    label: 'Diagnostic Audit',
    extensible: false,
    display: 'tool_name',
    audit: false,
    allowWebServiceAccess: true,

    schema: {
        run: ReferenceColumn({
            label: 'Run',
            referenceTable: 'x_snc_troubleshoot_run',
            cascadeRule: 'delete',
        }),

        user: ReferenceColumn({
            label: 'User',
            referenceTable: 'sys_user',
        }),

        action_type: ChoiceColumn({
            label: 'Action Type',
            choices: {
                intent: 'Intent',
                result: 'Result',
                error: 'Error',
            },
        }),

        tool_name: StringColumn({
            label: 'Tool Name',
            maxLength: 100,
        }),

        // JSON. See the header note on the type choice.
        input: MultiLineTextColumn({
            label: 'Input',
            maxLength: 65536,
        }),

        output: MultiLineTextColumn({
            label: 'Output',
            maxLength: 65536,
        }),

        // What the tool touched — table name and record sys_id, recorded as
        // strings because the target is any table on the instance, not one.
        target_table: StringColumn({
            label: 'Target Table',
            maxLength: 80,
        }),

        target_record: StringColumn({
            label: 'Target Record',
            maxLength: 32,
        }),

        // #121 — did this call RETRIEVE anything, or did it merely run?
        //
        // Computed by PaToolReadKit.retrievalVerdict on the tool core's
        // PRE-THRESHOLD result, at PaToolRegistry.dispatch and
        // PaScriptToolAdapter.invoke. It cannot be re-derived from `output`
        // after the fact: applyThreshold replaces an oversized result with an
        // excerpt envelope carrying no `reads` map, and PaAuditLogger then
        // digests head+tail past 4,000 chars — so the LARGEST, most likely
        // productive results are precisely the ones whose evidence is gone.
        //
        // NO DEFAULT, deliberately. Blank means "row written before #121", and
        // the eight seed-01 runs already on the instance (DECISION.md §U9.1)
        // must not read back as a mechanical `none`. That 1-of-4 was derived
        // by hand and stays labelled as one.
        //
        // Written on `result` rows only. Build Rule #8: `{ value_key: 'Label' }`.
        retrieval: ChoiceColumn({
            label: 'Retrieval',
            choices: {
                ok: 'Retrieved rows',
                none: 'Retrieved nothing',
                unknown: 'Not determinable',
            },
        }),

        // Phase 1a is read-only, so this is always false today. It exists now
        // because the confirmation gate is a Phase 2 write-path requirement and
        // an audit trail that gains the column later cannot answer the question
        // retroactively for runs already recorded.
        confirmed_by_user: BooleanColumn({
            label: 'Confirmed By User',
            default: false,
        }),
    },
})
