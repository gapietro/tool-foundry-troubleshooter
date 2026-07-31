// Stub: Context enrichment script for the enrichedWorkflow. Receives the
// workflow context and adds extra fields before agents see it — both at
// build time (so the Now.include() reference resolves and the example
// compiles) and at runtime (the platform invokes this script before agent
// dispatch). Replace with your actual enrichment logic when adapting.
(function enrichContext(context) {
  if (context && context.record) {
    context.priorityLabel = context.record.priority === '1' ? 'CRITICAL' : 'STANDARD';
    context.enrichedAt = new GlideDateTime().getDisplayValue();
  }
  return context;
})(context);
