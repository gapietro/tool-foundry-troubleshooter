// Stub: PUT /configs/{id} endpoint script for the rest-api golden example.
// Replace with the actual update logic when adapting to a real project — this
// file just satisfies the Now.include() reference at build time so the
// example compiles. Replace `x_snc_myapp_agent_config` with your scoped table.
//
// Payload + path conventions (kept consistent with the create route in
// rest-api.now.ts so consumers don't get tripped by mixed shapes):
//   - Record sys_id comes from the URL path:  request.pathParams.id
//   - Field value comes from the body:        request.body.data.config_json
(function process(request, response) {
  var id = request.pathParams && request.pathParams.id;
  var body = request.body && request.body.data;
  if (!id || !body || !body.config_json) {
    response.setStatus(400);
    return { error: 'pathParams.id and body.config_json are required' };
  }
  var gr = new GlideRecord('x_snc_myapp_agent_config');
  if (!gr.get(id)) {
    response.setStatus(404);
    return { error: 'config not found' };
  }
  gr.setValue('config_json', body.config_json);
  gr.update();
  return { id: gr.getUniqueValue(), updated: true };
})(request, response);
