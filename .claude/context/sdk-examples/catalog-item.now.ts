/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * Required moving the import path from `@servicenow/sdk/catalog` (4.5.0) to
 * `@servicenow/sdk/core` (4.6.0) — the dedicated `/catalog` subpath was
 * consolidated into `/core`. (The original file header noted this needed
 * verification; now confirmed.)
 *
 * Updated 2026-04-30: Replaced plain-object variable shorthand (e.g., `{ type:
 * 'SingleLineText', ... }`) with typed constructor calls (e.g.,
 * `SingleLineTextVariable({...})`). The CatalogItemPlugin requires constructor
 * call expressions (CallExpressionShape) for each variable entry — plain objects
 * (ObjectShape) produce a non-fatal plugin warning and the variable is skipped.
 *
 * Golden Example: CatalogItem — Service Catalog requestable item
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/service-catalog/catalog-item
 * Import:   import { CatalogItem, SingleLineTextVariable, MultiLineTextVariable,
 *             SelectBoxVariable, DateVariable, YesNoVariable,
 *             ReferenceVariable, RequestedForVariable } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - variables: Record<string, AnyVariable> — form fields on the request
 *   - Variable types: CheckboxVariable, DateVariable, DateTimeVariable, EmailVariable,
 *     MultiLineTextVariable, SelectBoxVariable, SingleLineTextVariable, UrlVariable,
 *     YesNoVariable, ReferenceVariable, RequestedForVariable
 *   - fulfillment: flow | executionPlan | workflow (mutually exclusive)
 *   - Link to a Flow for automated fulfillment
 *   - categories[], catalogs[] for organization
 *   - availability: 'both' | 'desktopOnly' | 'mobileOnly'
 */

import '@servicenow/sdk/global'
import {
  CatalogItem,
  DateVariable,
  MultiLineTextVariable,
  ReferenceVariable,
  RequestedForVariable,
  SelectBoxVariable,
  SingleLineTextVariable,
  YesNoVariable,
} from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Software installation request with flow fulfillment
// ---------------------------------------------------------------------------
export const softwareInstallRequest = CatalogItem({
  $id: Now.ID['software-install-catalog-item'],
  name: 'Request Software Installation',
  shortDescription: 'Request installation of approved software on your workstation',
  description: 'Submit a request to have approved software installed. Requires manager approval for enterprise licenses.',

  active: true,
  availability: 'both',

  // Fulfillment via Flow Designer
  flow: Now.ref('sys_hub_flow', { name: 'Software Install Fulfillment' }),
  fulfillmentAutomationLevel: 'semiAutomated',
  deliveryTime: { days: 2 },

  // Variables — form fields
  variables: {
    software_name: SingleLineTextVariable({
      question: 'Software Name',
      order: 100,
      mandatory: true,
    }),
    software_version: SingleLineTextVariable({
      question: 'Version (if specific)',
      order: 200,
      mandatory: false,
    }),
    justification: MultiLineTextVariable({
      question: 'Business Justification',
      order: 300,
      mandatory: true,
    }),
    license_type: SelectBoxVariable({
      question: 'License Type',
      order: 400,
      mandatory: true,
      choices: {
        free: { label: 'Free / Open Source', sequence: 1, inactive: false },
        existing: { label: 'Existing Enterprise License', sequence: 2, inactive: false },
        new: { label: 'New License Purchase Required', sequence: 3, inactive: false },
      },
    }),
    install_date: DateVariable({
      question: 'Preferred Install Date',
      order: 500,
      mandatory: false,
    }),
    urgent: YesNoVariable({
      question: 'Is this urgent?',
      order: 600,
    }),
    requested_for: RequestedForVariable({
      question: 'Requested For',
      order: 50,
    }),
  },

  // Pricing
  cost: 0,
  ignorePrice: true,

  // UI behavior
  requestMethod: 'order',
  hideAttachment: false,
  mandatoryAttachment: false,
})

// ---------------------------------------------------------------------------
// Example 2: Simple catalog item — no variables, minimal config
// ---------------------------------------------------------------------------
export const passwordResetRequest = CatalogItem({
  $id: Now.ID['password-reset-item'],
  name: 'Password Reset',
  shortDescription: 'Reset your network password',
  active: true,
  fulfillmentAutomationLevel: 'fullyAutomated',
  flow: Now.ref('sys_hub_flow', { name: 'Password Reset Flow' }),
})

// ---------------------------------------------------------------------------
// Example 3: Catalog item with reference variable
// ---------------------------------------------------------------------------
export const accessRequest = CatalogItem({
  $id: Now.ID['access-request-item'],
  name: 'Request Application Access',
  shortDescription: 'Request access to a business application',
  active: true,

  variables: {
    application: ReferenceVariable({
      question: 'Which application?',
      order: 100,
      mandatory: true,
      referenceTable: 'cmdb_ci_appl',
    }),
    access_level: SelectBoxVariable({
      question: 'Access Level',
      order: 200,
      mandatory: true,
      choices: {
        read: { label: 'Read Only', sequence: 1, inactive: false },
        write: { label: 'Read/Write', sequence: 2, inactive: false },
        admin: { label: 'Administrator', sequence: 3, inactive: false },
      },
    }),
    justification: MultiLineTextVariable({
      question: 'Why do you need this access?',
      order: 300,
      mandatory: true,
    }),
  },
})
