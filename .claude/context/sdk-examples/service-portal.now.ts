/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * Substantial restructure from the 4.5.0 shape:
 *   1. Module-subpath consolidation: `@servicenow/sdk/portal` → `/core`.
 *   2. Dropped unused `SPWidgetDependency` import.
 *   3. SPTheme asset paths changed from `../../assets/...` (project-root in
 *      typescript.react templates) to `./assets/...` (self-contained, with
 *      stub PNGs committed alongside under context/sdk-examples/assets/).
 *   4. SPWidget `optionSchema` removed — the 4.6.0 type signature tightened
 *      (`section` is required and uses a platform-defined enum,
 *      `defaultValue` replaces `default_value`). Documented in a comment;
 *      consumers should run `now-sdk explain spwidget-api` for current shape.
 *   5. Inline clientScript uses `function controller($scope) { ... }` per
 *      the SDK's own SPWidget example pattern.
 *   6. ServicePortal.homePage references an OOTB `sp_page` (id: 'index')
 *      via Now.ref — the original example's custom SPPage was dropped; the
 *      4.6.0 SPPage shape (instances[]/$id-on-rows-and-columns/JSON-string
 *      widgetParameters) is substantial and lives in dedicated examples
 *      (sp-header-footer.now.ts, sp-page-route-map.now.ts).
 *
 * Companion stubs committed alongside under context/sdk-examples/:
 *   - assets/logo.png  (minimal 1x1 PNG stub)
 *   - assets/favicon.ico  (same minimal stub bytes as logo.png — real ICO
 *     format would be larger; consumers should replace with a real favicon)
 *   - server/SPWidget/incident-list.server.js
 *   - client/SPWidget/incident-list.client.js, incident-list.html, incident-list.scss
 *
 * Note: the two SPWidget examples deliberately demonstrate BOTH client-controller
 * patterns — the inline `welcomeBanner` widget uses the named-function form
 * `function controller($scope)`, while the externalized `incidentListWidget`
 * uses the `api.controller = function($scope) { ... }` assignment form
 * (see client/SPWidget/incident-list.client.js). Both compile + install
 * cleanly in 4.6.0.
 *
 * Golden Example: ServicePortal + SPWidget + SPTheme
 *
 * SDK Docs:
 *   - https://servicenow.github.io/sdk/api/service-portal
 *   - https://servicenow.github.io/sdk/api/service-portal/sp-widget
 *   - https://servicenow.github.io/sdk/api/service-portal/sp-theme
 *
 * Import: import { ServicePortal, SPWidget, SPTheme } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - ServicePortal: top-level portal with theme, catalogs, KB
 *   - SPWidget: components with server/client scripts, HTML, CSS
 *   - SPTheme: SCSS variables, header/footer widgets, logo, favicon
 *   - Now.include() for external HTML/CSS/JS files
 *   - Now.attach() for images (logo, favicon)
 *
 * For full page composition (SPPage with container/row/column/instance
 * layouts), see the dedicated SP examples: sp-header-footer.now.ts and
 * sp-page-route-map.now.ts. The 4.6.0 SPPage shape changed substantially
 * from 4.5.0 (instances[] not widgets[], $id required on rows/columns/
 * instances, JSON-string widgetParameters) — covered in those files.
 */

import '@servicenow/sdk/global'
import { ServicePortal, SPWidget, SPTheme } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
export const myTheme = SPTheme({
  $id: Now.ID['my-portal-theme'],
  name: 'POC Portal Theme',
  customCss: `
    $brand-primary: #1a73e8;
    $brand-success: #34a853;
    $brand-warning: #fbbc04;
    $brand-danger: #ea4335;
    $navbar-default-bg: #ffffff;
    $navbar-default-color: #333333;
  `,
  // Asset paths are relative to the .now.ts file. In the golden repo the
  // stub PNGs live under context/sdk-examples/assets/. In a real project,
  // adjust to wherever you keep brand assets.
  logo: Now.attach('./assets/logo.png'),
  logoAltText: 'Company Logo',
  icon: Now.attach('./assets/favicon.ico'),
  fixedHeader: true,
  fixedFooter: false,
})

// ---------------------------------------------------------------------------
// Widget — custom component with server + client scripts
// ---------------------------------------------------------------------------
export const incidentListWidget = SPWidget({
  $id: Now.ID['incident-list-widget'],
  name: 'Active Incidents',
  description: 'Displays a list of active incidents for the current user',

  // External files (recommended pattern)
  serverScript: Now.include('./server/SPWidget/incident-list.server.js'),
  clientScript: Now.include('./client/SPWidget/incident-list.client.js'),
  htmlTemplate: Now.include('./client/SPWidget/incident-list.html'),
  customCss: Now.include('./client/SPWidget/incident-list.scss'),

  // optionSchema (portal-designer parameters) is supported but the 4.6.0
  // type signature has tightened — `section` is required and uses a
  // platform-defined enum; `defaultValue` replaces 4.5.0's `default_value`.
  // Omitted here to keep the example portable across SDK patches; for a
  // real widget, run `now-sdk explain spwidget-api` for the current
  // WidgetOption shape including valid section values.
})

// ---------------------------------------------------------------------------
// Widget — inline pattern (for simple widgets)
// ---------------------------------------------------------------------------
export const welcomeBanner = SPWidget({
  $id: Now.ID['welcome-banner-widget'],
  name: 'Welcome Banner',
  description: 'Displays a welcome message with user name',
  serverScript: `(function() {
    data.userName = gs.getUserDisplayName();
    data.greeting = new GlideDateTime().getLocalTime().getHourLocalTime() < 12
      ? 'Good morning' : 'Good afternoon';
  })()`,
  // 4.6.0+: inline client controllers can use EITHER the named-function form
  // shown here (`function controller($scope) { ... }`) OR the assignment form
  // `api.controller = function($scope) { ... }`. The SDK accepts both and
  // parses the controller out of the script content. The named-function form
  // is the SDK's own SPWidget-example default; see incident-list.client.js
  // alongside for the assignment-form companion file.
  clientScript: `function controller($scope) {
    var c = this;
  }`,
  htmlTemplate: `<div class="welcome-banner">
    <h1>{{c.data.greeting}}, {{c.data.userName}}</h1>
    <p>How can we help you today?</p>
  </div>`,
  customCss: `.welcome-banner {
    text-align: center;
    padding: 40px 20px;
    background: linear-gradient(135deg, #1a73e8, #34a853);
    color: white;
    border-radius: 8px;
    margin-bottom: 20px;
  }`,
})

// ---------------------------------------------------------------------------
// Portal — ties it all together
// ---------------------------------------------------------------------------
export const pocPortal = ServicePortal({
  $id: Now.ID['poc-portal'],
  title: 'POC Self-Service Portal',
  urlSuffix: 'poc',
  // Reference an OOTB home page; in a real portal you'd reference an SPPage
  // you've defined (see sp-page-route-map.now.ts and sp-header-footer.now.ts
  // for SPPage / SPHeaderFooter / SPPageRouteMap patterns).
  homePage: Now.ref('sp_page', { id: 'index' }),
  theme: myTheme,
  enableAiSearch: true,
  enableFavorites: true,

  catalogs: [
    { catalog: Now.ref('sc_catalog', { title: 'Service Catalog' }), active: true, order: 1 },
  ],

  knowledgeBases: [
    { knowledgeBase: Now.ref('kb_knowledge_base', { title: 'IT Knowledge Base' }), active: true, order: 1 },
  ],
})
