// Stub: server-side script for incident-list SP widget.
(function() {
  var maxRecords = parseInt(input.max_records || options.max_records || 10, 10);
  var showPriority = (input.show_priority || options.show_priority || 'true') === 'true';

  data.incidents = [];
  data.showPriority = showPriority;

  var gr = new GlideRecord('incident');
  gr.addQuery('active', true);
  gr.addQuery('assigned_to', gs.getUserID());
  gr.orderByDesc('sys_updated_on');
  gr.setLimit(maxRecords);
  gr.query();

  while (gr.next()) {
    data.incidents.push({
      sys_id: gr.getUniqueValue(),
      number: gr.getValue('number'),
      short_description: gr.getValue('short_description'),
      priority: gr.getDisplayValue('priority'),
      state: gr.getDisplayValue('state'),
    });
  }
})();
