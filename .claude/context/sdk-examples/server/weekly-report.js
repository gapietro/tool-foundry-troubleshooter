// Stub: Weekly incident summary report job for the scheduled-script golden example.
// Replace with the actual reporting logic when adapting to a real project —
// this file just satisfies the Now.include() reference at build time so the
// example compiles.
(function() {
  var gr = new GlideAggregate('incident');
  gr.addAggregate('COUNT');
  gr.groupBy('priority');
  gr.addQuery('sys_created_on', '>=', gs.daysAgoStart(7));
  gr.query();
  while (gr.next()) {
    gs.info('Weekly report — priority ' + gr.priority + ': ' + gr.getAggregate('COUNT'));
  }
})();
