/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on
 * 2026-04-30. No code changes required from the original signature-grounded
 * draft. Example 2 uses Now.include() against companion asset files —
 * stubs are committed alongside this file under ./portal-footer/
 * (template.html, server.js, client.js, styles.css). When copying this
 * example into another project, copy the portal-footer/ directory too.
 *
 * Golden Example: SPHeaderFooter — Service Portal header and footer widgets
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/service-portal/sp-header-footer
 * Import:   import { SPHeaderFooter } from '@servicenow/sdk/core'
 * Requires: SDK >= 4.6.0
 *
 * Key concepts:
 *   - SPHeaderFooter is a special widget kind for portal headers/footers.
 *   - `static: true` renders on every page; `static: false` lets the portal
 *     selectively place it on specific pages.
 *   - htmlTemplate, serverScript, clientScript, customCss can be inline or
 *     externalized via Now.include() — externalize for anything non-trivial.
 *   - `id` (optional) is the widget's slug (alphanumeric, -, or _) — used in URLs
 *     and references; keep it stable across deploys.
 *   - Bind to a specific portal by referencing the SPHeaderFooter from
 *     ServicePortal({ header: ..., footer: ... }).
 */

import '@servicenow/sdk/global'
import { SPHeaderFooter } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Static header — appears on every portal page
// ---------------------------------------------------------------------------
// Uses inline HTML/CSS/JS for a minimal demo. For production, prefer
// Now.include('./header/template.html') etc. so each part lives in its own file.
export const portalHeader = SPHeaderFooter({
  $id: Now.ID['portal-header'],
  name: 'Foundry Portal Header',
  id: 'foundry-portal-header',
  description: 'Top navigation bar shown on every portal page',
  static: true,
  htmlTemplate: `
    <nav class="navbar navbar-default navbar-fixed-top foundry-header">
      <div class="container-fluid">
        <div class="navbar-header">
          <a class="navbar-brand" href="?id=index">{{::data.portalName}}</a>
        </div>
        <ul class="nav navbar-nav navbar-right">
          <li ng-if="data.userName"><a>{{::data.userName}}</a></li>
        </ul>
      </div>
    </nav>
  `,
  serverScript: `(function() {
    data.portalName = gs.getProperty('glide.product.name', 'Service Portal');
    data.userName = gs.getUserDisplayName();
  })();`,
  customCss: `.foundry-header { background: #032D42; color: #fff; }
    .foundry-header .navbar-brand { color: #fff; font-weight: 500; }
    .foundry-header .nav > li > a { color: #fff; }`,
})

// ---------------------------------------------------------------------------
// Example 2: Dynamic footer — placed selectively, externalized assets
// ---------------------------------------------------------------------------
// `static: false` lets the portal admin attach this footer to specific pages
// rather than all of them. Most assets are externalized via Now.include();
// clientScript must be inline for SPHeaderFooter — the SDK validator (TS213)
// requires a function literal in-source, unlike SPWidget which resolves
// Now.include() content before the TS213 check. The companion
// portal-footer/client.js uses the api.controller form for direct SP use.
export const portalFooter = SPHeaderFooter({
  $id: Now.ID['portal-footer'],
  name: 'Foundry Portal Footer',
  id: 'foundry-portal-footer',
  description: 'Optional footer with copyright and helpful links',
  static: false,
  hasPreview: true,
  htmlTemplate: Now.include('./portal-footer/template.html'),
  serverScript: Now.include('./portal-footer/server.js'),
  clientScript: `api.controller = function($scope) {};`,
  customCss: Now.include('./portal-footer/styles.css'),
})
