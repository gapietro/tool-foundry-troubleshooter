/**
 * VALIDATED — Built successfully against SDK 4.8.1 and 4.9.0 on 2026-07-17.
 *
 * Golden Example: Flow (advanced) — stages, tryCatch, doInParallel,
 *                 appendToFlowVariables, errorEvaluation
 *
 * SDK Docs: node_modules/@servicenow/sdk/docs/api/flow/flow-stages-api.md,
 *           api/flow/wfa-flow-logic-api.md, guides/wfa-flow-logic-guide.md
 * Import:   import { Flow, FlowStage, wfa, trigger, action, Action, actionStep,
 *                    FlowArray, FlowObject } from '@servicenow/sdk/automation'
 * Requires: SDK >= 4.7.0
 *
 * Key concepts:
 *   - stages: {} on Flow/Subflow config; map key MUST equal the stage's `value`.
 *     Activate with wfa.stage(params.stages.<key>). Build errors: undeclared key,
 *     stage inside forEach/doInParallel, stage as the trailing statement, plain
 *     object where Duration() is required. Declaration order = tracker order.
 *   - tryCatch: both try AND catch bodies required; catch gets NO error object.
 *   - doInParallel: variadic blocks (not an array), no nesting; one block
 *     failing doesn't stop the others.
 *   - DATAPILL SCOPE RULE: action outputs captured inside tryCatch/doInParallel
 *     are NOT visible outside the block — persist through a flow variable via
 *     wfa.flowLogic.setFlowVariables inside the block.
 *   - appendToFlowVariables: only FlowArray-of-FlowObject variables (primitive
 *     arrays unsupported); FlowArray requires elementType + label + childName.
 *   - wfa.errorEvaluation: custom Action() bodies ONLY — after all actionSteps,
 *     before assignActionOutputs. First matching condition wins.
 *   - TemplateValue is a global (do not import); see flow.now.ts for the base
 *     Flow/Subflow patterns and custom-action.now.ts for actionStep gotchas.
 */
import '@servicenow/sdk/global'
import { Flow, FlowStage, wfa, trigger, action, Action, actionStep, FlowArray, FlowObject } from '@servicenow/sdk/automation'
import { StringColumn, IntegerColumn } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Stages — declare on config, activate in order in the body
// ---------------------------------------------------------------------------
export const stagedIncidentFlow = Flow(
    {
        $id: Now.ID['fadv-staged-flow'],
        name: 'Staged Incident Handler',
        stages: {
            triage: FlowStage({ label: 'Triage', value: 'triage' }),
            resolution: FlowStage({
                label: 'Resolution',
                value: 'resolution',
                alwaysShow: true, // renders as 'skipped' if never activated
                states: { inProgress: 'Working the fix', complete: 'Fixed' },
            }),
        },
    },
    wfa.trigger(trigger.record.created, { $id: Now.ID['fadv-staged-trigger'] }, {
        table: 'incident',
        condition: '',
        run_on_extended: 'false',
        run_flow_in: 'background',
        run_when_user_list: [],
        run_when_setting: 'both',
        run_when_user_setting: 'any',
    }),
    (params) => {
        wfa.stage(params.stages.triage)
        wfa.action(action.core.log, { $id: Now.ID['fadv-staged-log-triage'] }, {
            log_level: 'info',
            log_message: 'Triaging incident',
        })
        wfa.stage(params.stages.resolution)
        wfa.action(action.core.log, { $id: Now.ID['fadv-staged-log-resolve'] }, {
            log_level: 'info',
            log_message: 'Resolving incident',
        })
    }
)

// ---------------------------------------------------------------------------
// Example 2: tryCatch + doInParallel + appendToFlowVariables
// ---------------------------------------------------------------------------
export const resilientEnrichmentFlow = Flow(
    {
        $id: Now.ID['fadv-resilient-flow'],
        name: 'Resilient Incident Enrichment',
        flowVariables: {
            assignedUser: StringColumn({ label: 'Assigned User' }),
            collectedItems: FlowArray({
                label: 'Collected Items',
                mandatory: false,
                childName: 'item', // required on FlowArray
                elementType: FlowObject({
                    label: 'Item',
                    mandatory: false,
                    fields: {
                        name: StringColumn({ label: 'Name' }),
                        id: IntegerColumn({ label: 'ID' }),
                    },
                }),
            }),
        },
    },
    wfa.trigger(trigger.record.created, { $id: Now.ID['fadv-resilient-trigger'] }, {
        table: 'incident',
        condition: '',
        run_on_extended: 'false',
        run_flow_in: 'background',
        run_when_user_list: [],
        run_when_setting: 'both',
        run_when_user_setting: 'any',
    }),
    (params) => {
        // -- tryCatch: outputs captured in the try block are persisted through
        //    flow variables; the catch body logs and sets a fallback.
        wfa.flowLogic.tryCatch(
            { $id: Now.ID['fadv-trycatch-lookup'], annotation: 'Handle lookup failure gracefully' },
            {
                try: () => {
                    // NOTE: lookUpRecord takes `table` (not `table_name` as some
                    // bundled-doc examples show) + sort/multiple-record inputs.
                    // Single-record Look Up Record FAILS the step when no record
                    // matches (unlike lookUpRecords, which returns empty) — an
                    // empty assigned_to yields a no-match query, the step
                    // errors, and the catch body below takes over. That failure
                    // mode is exactly why this block is wrapped in tryCatch.
                    const lookup = wfa.action(action.core.lookUpRecord, { $id: Now.ID['fadv-lookup-user'] }, {
                        table: 'sys_user',
                        conditions: `sys_id=${wfa.dataPill(params.trigger.current.assigned_to, 'string')}`,
                        sort_type: 'sort_asc',
                        if_multiple_records_are_found_action: 'use_first_record',
                    })
                    wfa.flowLogic.setFlowVariables(
                        { $id: Now.ID['fadv-set-assigned'] },
                        params.flowVariables,
                        { assignedUser: wfa.dataPill(lookup.Record.name, 'string') }
                    )
                },
                catch: () => {
                    wfa.action(action.core.log, { $id: Now.ID['fadv-lookup-failed-log'] }, {
                        log_level: 'error',
                        log_message: 'User lookup failed - using system user as fallback',
                    })
                    wfa.flowLogic.setFlowVariables(
                        { $id: Now.ID['fadv-set-fallback'] },
                        params.flowVariables,
                        { assignedUser: 'system' }
                    )
                },
            }
        )

        // -- doInParallel: independent branches; no cross-branch data flow
        wfa.flowLogic.doInParallel(
            { $id: Now.ID['fadv-parallel-notify'], annotation: 'Fan out notifications' },
            () => {
                wfa.action(action.core.log, { $id: Now.ID['fadv-parallel-log-a'] }, {
                    log_level: 'info',
                    log_message: `Notifying assignee: ${wfa.dataPill(params.flowVariables.assignedUser, 'string')}`,
                })
            },
            () => {
                wfa.action(action.core.log, { $id: Now.ID['fadv-parallel-log-b'] }, {
                    log_level: 'info',
                    log_message: 'Recording enrichment metrics',
                })
            }
        )

        // -- appendToFlowVariables: single element, then bulk
        wfa.flowLogic.appendToFlowVariables(
            { $id: Now.ID['fadv-append-single'], annotation: 'Add one item' },
            params.flowVariables,
            { collectedItems: { name: 'Alice', id: 1 } }
        )
        wfa.flowLogic.appendToFlowVariables(
            { $id: Now.ID['fadv-append-bulk'], annotation: 'Add several items' },
            params.flowVariables,
            { collectedItems: [{ name: 'Bob', id: 2 }, { name: 'Charlie', id: 3 }] }
        )
    }
)

// ---------------------------------------------------------------------------
// Example 3: wfa.errorEvaluation — custom Action bodies only.
// Maps step status to an action-level status code; first match wins.
// ---------------------------------------------------------------------------
export const createIncidentAction = Action(
    {
        $id: Now.ID['fadv-create-incident-action'],
        name: 'Create Incident With Status',
        description: 'Creates an incident and maps step failures to action status codes',
        inputs: {
            short_description: StringColumn({ label: 'Short description', mandatory: true }),
        },
        outputs: {
            success: StringColumn({ label: 'Success' }),
        },
    },
    (params) => {
        const step = wfa.actionStep(
            actionStep.createRecord,
            { $id: Now.ID['fadv-create-step'], label: 'Create Incident' },
            {
                create_record_table_name: 'incident',
                create_record_field_values: TemplateValue({
                    short_description: wfa.dataPill(params.inputs.short_description, 'string'),
                }),
                errorHandlingType: 'stop_the_action',
            }
        )

        wfa.errorEvaluation([
            {
                label: 'Success Check',
                condition: `${wfa.dataPill(step.__step_status__.code, 'integer')}!=500`,
                status: { code: 200, message: 'OK' },
                dontTreatAsError: true,
            },
            {
                label: 'Failure Check',
                condition: `${wfa.dataPill(step.__step_status__.code, 'integer')}=500`,
                status: { code: 500, message: 'Create step failed' },
            },
        ])

        // Reached only on the success path: errorHandlingType 'stop_the_action'
        // aborts the action on step failure BEFORE outputs are assigned — the
        // 500 status mapped by errorEvaluation above is what callers see in
        // that case. (With 'dont_stop_the_action' this unconditional '1' would
        // be wrong: outputs would need to be derived from the step status.)
        wfa.assignActionOutputs(params.outputs, { success: '1' })
    }
)
