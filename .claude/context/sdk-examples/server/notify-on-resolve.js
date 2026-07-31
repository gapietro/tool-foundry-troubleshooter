// Stub: Notify-on-resolve business rule script for the business-rule golden example.
// Replace with the actual notification logic when adapting to a real project —
// this file just satisfies the Now.include() reference at build time so the
// example compiles.
(function executeRule(current, previous) {
  if (current.state.changesTo('6') /* Resolved */) {
    gs.eventQueue('incident.resolved', current, current.assigned_to.toString(), '');
  }
})(current, previous);
