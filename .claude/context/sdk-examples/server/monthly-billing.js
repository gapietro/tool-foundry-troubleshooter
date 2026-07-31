// Stub: Monthly license audit job for the scheduled-script golden example.
// Replace with the actual audit logic when adapting to a real project — this
// file just satisfies the Now.include() reference at build time so the
// example compiles. Replace `x_snc_myapp_agent_config` with your scoped table.
(function() {
  var gr = new GlideRecord('x_snc_myapp_agent_config');
  gr.addQuery('active', true);
  gr.query();
  var count = 0;
  while (gr.next()) {
    count++;
  }
  gs.info('Monthly license audit — active configs: ' + count);
})();
