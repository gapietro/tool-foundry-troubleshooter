/**
 * VALIDATED — Built successfully against SDK 4.8.1 and 4.9.0 on 2026-07-17.
 *
 * Golden Example: PlaybookDefinition — Process Automation Designer playbooks
 *
 * SDK Docs: node_modules/@servicenow/sdk/docs/api/playbook-api.md,
 *           docs/guides/playbook-guide.md (+ lanes/activities/triggers/datapills/
 *           patterns/anti-patterns guides)
 * Import:   import { PlaybookDefinition, PlaybookTriggerTypes, ActivityDefinitions,
 *                    wfa } from '@servicenow/sdk/automation'
 * Requires: SDK >= 4.8.0
 *
 * Key concepts:
 *   - THREE-argument pattern: PlaybookDefinition(config, { triggers: [...] }, body).
 *     Arg 2 is ALWAYS { triggers: [...] } — even when empty ({ triggers: [] }).
 *     (Some bundled-doc examples pass {}; the .d.ts requires the triggers key.)
 *   - Lanes/activities live in callbacks and MUST be returned with explicit keys
 *     (`return { review: review }` — shorthand `{ review }` fails the build with
 *     TS304). Anything not returned is silently dropped: it compiles, never runs.
 *   - Every lane AND activity config requires: $id, label, order, startRule,
 *     restartRule. `order` is Designer layout only; execution order comes from
 *     startRule: wfa.playbook.run.Immediately() / .After(...deps) (varargs, never
 *     an array). At least one lane must start Immediately().
 *   - Cross-lane ordering: only lane-level After(otherLane). Cross-lane data:
 *     via the lane variable (lane.activity.outputs.x). Datapills are dot-walk
 *     only, wrapped as wfa.playbook.dataPill(...); in conditions always inside
 *     template literals with encoded-query operators (ISEMPTY, =, ^OR, ...).
 *   - Decision: stage-level activity; non-else branches need `condition`; the
 *     else branch is EXACTLY { id: 'else', label: 'Else' }, last, no condition;
 *     keep `as const` on the branches array so decision.branches.<id> type-checks.
 *   - `name` is stable identity for playbook/lane/activity — renaming after
 *     deploy creates a new record (identity churn, cf. issue #196).
 *   - DEPLOYS AS DRAFT: activate manually in Workflow Studio after install;
 *     edits to a running playbook also need re-activation there.
 *   - TemplateValue and Now are globals — do not import them.
 */
import '@servicenow/sdk/global'
import { PlaybookDefinition, PlaybookTriggerTypes, ActivityDefinitions, wfa } from '@servicenow/sdk/automation'

// ---------------------------------------------------------------------------
// Example 1: Record-triggered playbook — parentTable + trigger + one lane.
// Trigger table equals parentTable and no inputs are declared, so the trigger
// mapper (4th arg of wfa.playbook.trigger) is omitted entirely.
// ---------------------------------------------------------------------------
PlaybookDefinition(
    {
        $id: Now.ID['pb-p1-notes'],
        label: 'P1 Incident Notes',
        name: 'pb_p1_incident_notes',
        parentTable: 'incident', // auto-generates the parent_record input
    },
    {
        triggers: [
            wfa.playbook.trigger(
                PlaybookTriggerTypes.RecordCreate,
                { $id: Now.ID['pb-p1-trigger'], label: 'On P1 Incident' },
                { table: 'incident', condition: 'priority=1' }
            ),
        ],
    },
    {
        lanes: (params) => ({
            stamp_note: wfa.playbook.lane({
                config: {
                    $id: Now.ID['pb-p1-lane-stamp'],
                    label: 'Stamp Note',
                    order: 1,
                    startRule: wfa.playbook.run.Immediately(),
                    restartRule: 'RUN_ONLY_ONCE',
                },
                activities: () => {
                    const stamp = wfa.playbook.activity(
                        ActivityDefinitions.Core.UpdateRecord,
                        {
                            $id: Now.ID['pb-p1-act-stamp'],
                            label: 'Stamp Note',
                            order: 1,
                            startRule: wfa.playbook.run.Immediately(),
                            restartRule: 'RUN_ONLY_ONCE',
                        },
                        {
                            table_name: 'incident', // UpdateRecord/CreateNewRecord use table_name; RecordForm-family uses table
                            record: wfa.playbook.dataPill(params.parentRecord),
                            values: TemplateValue({ work_notes: 'Priority 1 received' }),
                        }
                    )
                    return { stamp: stamp } // explicit key — shorthand fails build
                },
            }),
        }),
    }
)

// ---------------------------------------------------------------------------
// Example 2: Stage-level Decision routing between lanes + cross-lane datapills
// ---------------------------------------------------------------------------
PlaybookDefinition(
    {
        $id: Now.ID['pb-routing'],
        label: 'Incident Triage and Routing',
        name: 'pb_incident_routing',
        // Playbooks are record-driven: RecordForm binds the playbook's parent
        // record implicitly (it has no table/record input — contrast
        // AutocompletingRecordForm). Declare parentTable so runs have an
        // incident to review and the Decision datapills below have coherent
        // fields to walk.
        parentTable: 'incident',
    },
    { triggers: [] }, // no triggers — started manually / by another process
    {
        lanes: () => {
            const triage = wfa.playbook.lane({
                config: {
                    $id: Now.ID['pb-routing-lane-triage'],
                    label: 'Triage',
                    order: 1,
                    startRule: wfa.playbook.run.Immediately(),
                    restartRule: 'RUN_ONLY_ONCE',
                },
                activities: () => {
                    const review = wfa.playbook.activity(
                        ActivityDefinitions.Core.RecordForm,
                        {
                            $id: Now.ID['pb-routing-act-review'],
                            label: 'Review Incident',
                            order: 1,
                            startRule: wfa.playbook.run.Immediately(),
                            restartRule: 'RUN_ONLY_ONCE',
                        },
                        { assigned_to: '' }
                    )
                    return { review: review }
                },
            })

            // Stage-level Decision (lives directly in the lanes body)
            const routeDecision = wfa.playbook.activity(
                ActivityDefinitions.Core.Decision,
                {
                    $id: Now.ID['pb-routing-decision'],
                    label: 'Route by Assignment',
                    order: 2,
                    startRule: wfa.playbook.run.After(triage),
                    restartRule: 'RUN_ONLY_ONCE',
                },
                {
                    type: 'match_first',
                    branches: [
                        {
                            id: 'unassigned',
                            label: 'Unassigned',
                            condition: `${wfa.playbook.dataPill(triage.review.outputs.record.assigned_to)}ISEMPTY`,
                        },
                        {
                            id: 'has_group',
                            label: 'Has Group',
                            condition: `${wfa.playbook.dataPill(triage.review.outputs.record.assignment_group)}ISNOTEMPTY`,
                        },
                        { id: 'else', label: 'Else' }, // exactly this, last, no condition
                    ] as const,
                }
            )

            const escalation = wfa.playbook.lane({
                config: {
                    $id: Now.ID['pb-routing-lane-escalation'],
                    label: 'Escalation',
                    order: 3,
                    startRule: wfa.playbook.run.After(routeDecision.branches.unassigned),
                    restartRule: 'RUN_ONLY_ONCE',
                },
                activities: () => {
                    const page = wfa.playbook.activity(
                        ActivityDefinitions.Core.Instruction,
                        {
                            $id: Now.ID['pb-routing-act-page'],
                            label: 'Page On-Call',
                            order: 1,
                            startRule: wfa.playbook.run.Immediately(),
                            restartRule: 'RUN_ONLY_ONCE',
                        },
                        { message: 'Unassigned — paging on-call engineer.' }
                    )
                    return { page: page }
                },
            })

            const groupRoute = wfa.playbook.lane({
                config: {
                    $id: Now.ID['pb-routing-lane-group'],
                    label: 'Group Routing',
                    order: 4,
                    startRule: wfa.playbook.run.After(routeDecision.branches.has_group),
                    restartRule: 'RUN_ONLY_ONCE',
                },
                activities: () => {
                    const notify = wfa.playbook.activity(
                        ActivityDefinitions.Core.Instruction,
                        {
                            $id: Now.ID['pb-routing-act-notify'],
                            label: 'Notify Group',
                            order: 1,
                            startRule: wfa.playbook.run.Immediately(),
                            restartRule: 'RUN_ONLY_ONCE',
                        },
                        { message: 'Notifying assignment group.' }
                    )
                    return { notify: notify }
                },
            })

            const standard = wfa.playbook.lane({
                config: {
                    $id: Now.ID['pb-routing-lane-standard'],
                    label: 'Standard Processing',
                    order: 5,
                    startRule: wfa.playbook.run.After(routeDecision.branches.else),
                    restartRule: 'RUN_ONLY_ONCE',
                },
                activities: () => {
                    const queue = wfa.playbook.activity(
                        ActivityDefinitions.Core.Instruction,
                        {
                            $id: Now.ID['pb-routing-act-queue'],
                            label: 'Queue for Processing',
                            order: 1,
                            startRule: wfa.playbook.run.Immediately(),
                            restartRule: 'RUN_ONLY_ONCE',
                        },
                        { message: 'Added to standard processing queue.' }
                    )
                    return { queue: queue }
                },
            })

            return {
                triage: triage,
                routeDecision: routeDecision,
                escalation: escalation,
                groupRoute: groupRoute,
                standard: standard,
            }
        },
    }
)
