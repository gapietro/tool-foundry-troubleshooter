/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on 2026-04-30.
 * No API surface changes from the 4.5.0 shape; the build failures were all
 * Now.include() paths pointing at companion files that were never committed
 * to the golden repo. Companion stubs are now committed alongside under
 * context/sdk-examples/ at:
 *   - client/dist/index.html, client/dist/app.js  (Example 2 — React app)
 *   - html/config-editor.html, client/config-editor.js  (Example 3 — editor)
 *
 * Note on Example 2's path: in a `typescript.react` SDK project, React build
 * outputs live at the project root under `client/dist/` — the canonical
 * include path would be `../../client/dist/index.html`. The example uses a
 * self-contained `./client/dist/...` path so it builds standalone in the
 * golden repo; adjust to `../../client/dist/...` when copying into a
 * typescript.react project.
 *
 * IMPORTANT — scope rename when copying: the example uses `x_snc_myapp_*`
 * placeholders in endpoints, table refs, and API URLs. Replace with your
 * project's scope before building.
 *
 * Golden Example: UiPage — Standalone UI pages (hosts frontend apps)
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/ui-page
 * Import:   import { UiPage } from '@servicenow/sdk/core'
 *
 * Key concepts:
 *   - endpoint: format '${scope}_${name}.do' — determines URL
 *   - html: static XHTML, Jelly, or React app
 *   - clientScript: browser-side JavaScript
 *   - processingScript: server-side on form submit
 *   - React apps: use staticContent.paths in now.config.json + Now.include() for build artifacts
 *     (current key since SDK 4.8.x — the old top-level staticContentPaths is
 *     schema-deprecated with auto-migration to staticContent.paths)
 *   - category: 'general' | 'catalog' | 'homepages' | 'htmleditor' | 'kb' | 'cms'
 */

import '@servicenow/sdk/global'
import { UiPage } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// Example 1: Simple UI page with inline content
// ---------------------------------------------------------------------------
export const statusPage = UiPage({
  $id: Now.ID['status-page'],
  endpoint: 'x_snc_myapp_status.do',
  description: 'Agent configuration status dashboard',
  category: 'general',

  html: `<?xml version="1.0" encoding="utf-8"?>
<j:jelly trim="false" xmlns:j="jelly:core" xmlns:g="glide">
  <div id="status-app">
    <h2>Agent Status Dashboard</h2>
    <div id="agent-list"></div>
  </div>
  <script src="x_snc_myapp_status_client.jsdbx"></script>
</j:jelly>`,

  clientScript: `(function() {
    var container = document.getElementById('agent-list');
    if (!container) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/x_snc_myapp/agent_config/configs');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onload = function() {
      try {
        var data = JSON.parse(xhr.responseText);
        var rows = (data && data.result && data.result.result) || [];
        container.innerHTML = rows.map(function(agent) {
          return '<div class="agent-card">' + agent.name + ' - ' + agent.agent_type + '</div>';
        }).join('') || '<p>No agents found.</p>';
      } catch (e) {
        container.textContent = 'Failed to load agents: ' + e.message;
      }
    };
    xhr.onerror = function() { container.textContent = 'Network error loading agents.'; };
    xhr.send();
  })();`,
})

// ---------------------------------------------------------------------------
// Example 2: React-hosted UI page (external files)
//
// In a `typescript.react` SDK project, the React build outputs live at the
// project root under `client/dist/` — so the include path would normally
// be `../../client/dist/index.html` (relative to src/fluent/<this>.now.ts).
// This example uses a self-contained `./client/dist/...` path so the golden
// example builds standalone; adjust to `../../client/dist/...` when copying
// into a typescript.react project.
// ---------------------------------------------------------------------------
export const reactApp = UiPage({
  $id: Now.ID['react-app-page'],
  endpoint: 'x_snc_myapp_app.do',
  description: 'React-based agent management application',
  category: 'general',
  html: Now.include('./client/dist/index.html'),
  clientScript: Now.include('./client/dist/app.js'),
})

// ---------------------------------------------------------------------------
// Example 3: UI page with processing script (form handler)
// ---------------------------------------------------------------------------
export const configEditor = UiPage({
  $id: Now.ID['config-editor-page'],
  endpoint: 'x_snc_myapp_config_editor.do',
  description: 'Agent configuration editor with server-side processing',
  html: Now.include('./html/config-editor.html'),
  clientScript: Now.include('./client/config-editor.js'),
  processingScript: `(function process(g_request, g_response, g_processor) {
    var action = g_request.getParameter('sysparm_action');
    if (action === 'save') {
      var configId = g_request.getParameter('sysparm_config_id');
      var configJson = g_request.getParameter('sysparm_config_json');

      // Server-side validation: bail out cleanly if the JSON is malformed
      // rather than persisting bad data.
      try {
        JSON.parse(configJson);
      } catch (e) {
        gs.addErrorMessage('Config JSON is invalid: ' + e.message);
        g_response.sendRedirect('x_snc_myapp_config_editor.do?sysparm_config_id=' + configId);
        return;
      }

      var gr = new GlideRecord('x_snc_myapp_agent_config');
      if (gr.get(configId)) {
        gr.setValue('config_json', configJson);
        gr.update();
        gs.addInfoMessage('Configuration saved.');
      } else {
        gs.addErrorMessage('Configuration not found: ' + configId);
      }
    }
    g_response.sendRedirect('x_snc_myapp_status.do');
  })(g_request, g_response, g_processor);`,
})
