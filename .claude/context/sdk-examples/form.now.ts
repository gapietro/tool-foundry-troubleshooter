/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * The 4.5.0 Form API was restructured in 4.6.0:
 *   1. Sections now have a `content` array of layout blocks; the `layout`
 *      property moved from the section onto the block.
 *      Old:  { caption, layout: 'two-column', leftElements, rightElements }
 *      New:  { caption, content: [ { layout: 'two-column', leftElements, rightElements } ] }
 *   2. Annotation elements require an `annotationId` (Now.ID reference) and
 *      use predefined `annotationType` keys ('Info_Box_Blue', 'Info_Box_Red',
 *      etc.) rather than free-form strings like 'info'.
 *   3. The view name should use the exported `default_view` identifier rather
 *      than the hardcoded string 'Default view' (TS11 enforced).
 *
 * Golden Example: Form — Form layout definitions
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/form
 * Import:   import { Form, default_view } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - table + view + sections[] (required)
 *   - Each section has a `content[]` array of layout blocks
 *   - Layout blocks: { layout: 'one-column', elements: [...] }
 *                or { layout: 'two-column', leftElements: [...], rightElements: [...] }
 *   - Element types (discriminated by `type`): table_field, annotation, formatter, list
 *   - Annotation requires annotationId (Now.ID) + annotationType key
 *     (e.g. 'Info_Box_Blue', 'Info_Box_Red', 'Section_Separator')
 *   - Related list types: '12M' | 'M2M' | 'custom'
 *   - roles[] for form access control
 */

import '@servicenow/sdk/global'
import { Form, default_view } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Two-column form on x_snc_myapp_agent_config
// (Replace `x_snc_myapp_` with your project's scope before building.)
// ---------------------------------------------------------------------------
export const agentConfigForm = Form({
  table: 'x_snc_myapp_agent_config',
  view: default_view,

  sections: [
    {
      caption: 'Agent Details',
      content: [
        {
          layout: 'two-column',
          leftElements: [
            { field: 'name', type: 'table_field' },
            { field: 'agent_type', type: 'table_field' },
            { field: 'active', type: 'table_field' },
          ],
          rightElements: [
            { field: 'owner', type: 'table_field' },
            { field: 'assignment_group', type: 'table_field' },
            { field: 'max_iterations', type: 'table_field' },
          ],
        },
      ],
    },
    {
      caption: 'Configuration',
      content: [
        {
          layout: 'one-column',
          elements: [
            { field: 'description', type: 'table_field' },
            { field: 'config_json', type: 'table_field' },
          ],
        },
      ],
    },
    {
      caption: 'Notes',
      content: [
        {
          layout: 'one-column',
          elements: [
            {
              type: 'annotation',
              annotationId: Now.ID['form-notes-annotation'],
              annotationType: 'Info_Box_Blue',
              text: 'Configuration JSON must be valid JSON. Use the validator before saving.',
            },
          ],
        },
      ],
    },
  ],
})
