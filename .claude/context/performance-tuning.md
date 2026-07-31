# ServiceNow Performance Tuning

This guide covers performance optimization techniques for ServiceNow development, including query optimization, caching strategies, and best practices.

---

## Query Optimization

### Use Indexes

Always query on indexed fields for best performance.

```javascript
// Check if a field is indexed
var gr = new GlideRecord('sys_index');
gr.addQuery('table', 'incident');
gr.query();
while (gr.next()) {
    gs.info('Index: ' + gr.name + ' on ' + gr.column);
}
```

### Common Indexed Fields

Most tables have indexes on:
- `sys_id` (primary key)
- `number` (display field)
- `sys_created_on`, `sys_updated_on`
- Foreign key references

### Limit Result Sets

```javascript
// Always use limits for large tables
var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.setLimit(100);  // Critical for performance
gr.query();
```

### Avoid SELECT *

```javascript
// BAD - retrieves all fields
var gr = new GlideRecord('incident');
gr.query();
var data = gr.serialize();  // All fields

// GOOD - specify needed fields
var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.query();
while (gr.next()) {
    var num = gr.getValue('number');  // Only access needed fields
}
```

---

## Avoiding N+1 Queries

The N+1 problem occurs when you query related data one record at a time.

### Problem Pattern

```javascript
// BAD - N+1 queries
var incidents = new GlideRecord('incident');
incidents.query();
while (incidents.next()) {
    // One query per incident!
    var user = new GlideRecord('sys_user');
    user.get(incidents.assigned_to);
    gs.info(user.name);
}
```

### Solution: Batch Queries

```javascript
// GOOD - Collect IDs first, then batch query
var incidents = new GlideRecord('incident');
incidents.setLimit(100);
incidents.query();

// Collect unique user IDs
var userIds = [];
while (incidents.next()) {
    var userId = incidents.getValue('assigned_to');
    if (userId && userIds.indexOf(userId) === -1) {
        userIds.push(userId);
    }
}

// Single query for all users
var users = {};
if (userIds.length > 0) {
    var userGr = new GlideRecord('sys_user');
    userGr.addQuery('sys_id', 'IN', userIds.join(','));
    userGr.query();
    while (userGr.next()) {
        users[userGr.getUniqueValue()] = userGr.getValue('name');
    }
}
```

---

## GlideAggregate for Counts

Use GlideAggregate instead of GlideRecord for counting and grouping.

```javascript
// BAD - retrieves all records just to count
var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.query();
var count = gr.getRowCount();  // Loads all records!

// GOOD - uses aggregate query
var ga = new GlideAggregate('incident');
ga.addQuery('active', true);
ga.addAggregate('COUNT');
ga.query();
if (ga.next()) {
    var count = ga.getAggregate('COUNT');
}
```

### Grouping with Aggregates

```javascript
// Count incidents by priority
var ga = new GlideAggregate('incident');
ga.addQuery('active', true);
ga.addAggregate('COUNT');
ga.groupBy('priority');
ga.query();

while (ga.next()) {
    gs.info('Priority ' + ga.priority + ': ' + ga.getAggregate('COUNT'));
}
```

---

## Caching Strategies

### GlideSystem Cache

```javascript
// Cache expensive lookups
var cacheKey = 'my_cache_key';
var cached = gs.getProperty(cacheKey);

if (!cached) {
    // Compute expensive value
    var result = expensiveOperation();

    // Cache for future use
    gs.setProperty(cacheKey, result);
    cached = result;
}
```

### Script Include Caching

```javascript
var CachedLookup = Class.create();
CachedLookup.prototype = {
    initialize: function() {
        this.cache = {};
    },

    getUser: function(userId) {
        if (this.cache[userId]) {
            return this.cache[userId];
        }

        var gr = new GlideRecord('sys_user');
        if (gr.get(userId)) {
            this.cache[userId] = {
                name: gr.getValue('name'),
                email: gr.getValue('email')
            };
            return this.cache[userId];
        }
        return null;
    },

    type: 'CachedLookup'
};
```

---

## Business Rule Optimization

### Minimize Rule Triggers

```javascript
// Use conditions to limit when rules run
// In Business Rule condition:
current.state.changes() && current.state == 'resolved'

// Instead of checking in script:
if (current.state.changes() && current.state == 'resolved') {
    // logic
}
```

### Avoid Synchronous External Calls

```javascript
// BAD - blocks transaction
var response = new sn_ws.RESTMessageV2('External API', 'get');
response.execute();  // Synchronous wait

// GOOD - use async patterns
// Queue the work for async processing
var gr = new GlideRecord('x_myapp_queue');
gr.initialize();
gr.request_data = JSON.stringify(data);
gr.insert();
// Process via scheduled job or event
```

---

## Client-Side Performance

### Minimize Server Calls

```javascript
// BAD - multiple AJAX calls
g_form.getReference('assigned_to', function(user) { ... });
g_form.getReference('assignment_group', function(group) { ... });

// GOOD - batch with GlideAjax
var ga = new GlideAjax('MyAjaxHelper');
ga.addParam('sysparm_name', 'getRelatedData');
ga.addParam('incident_id', g_form.getUniqueValue());
ga.getXMLAnswer(function(response) {
    var data = JSON.parse(response);
    // All data in one call
});
```

### Use Display Business Rules

```javascript
// For read-only display logic, use Display Business Rules
// They run client-side and don't add server load
```

---

## Database Optimization

### Table Rotation

For high-volume tables, consider table rotation:
- Archive old records to history table
- Keep active table lean
- Use data retention policies

### Indexing Strategy

When to add indexes:
- Fields used in WHERE clauses
- Fields used in ORDER BY
- Foreign key relationships
- Fields with high cardinality

When NOT to add indexes:
- Low cardinality fields (like boolean)
- Rarely queried fields
- Tables with high insert volume

---

## Monitoring Performance

### Transaction Logs

```javascript
// Check slow transactions
var gr = new GlideRecord('syslog_transaction');
gr.addQuery('response_time', '>', 5000);  // > 5 seconds
gr.addQuery('sys_created_on', '>=', gs.daysAgo(1));
gr.orderByDesc('response_time');
gr.setLimit(20);
gr.query();

while (gr.next()) {
    gs.info(gr.url + ': ' + gr.response_time + 'ms');
}
```

### Query Profiling

```javascript
// Time your queries
function profileQuery(table, query) {
    var start = new Date().getTime();

    var gr = new GlideRecord(table);
    if (query) {
        gr.addEncodedQuery(query);
    }
    gr.query();
    var count = gr.getRowCount();

    var elapsed = new Date().getTime() - start;

    return {
        table: table,
        count: count,
        time: elapsed,
        perRecord: count > 0 ? elapsed / count : 0
    };
}
```

---

## Performance Checklist

### Before Deployment

- [ ] All queries use appropriate limits
- [ ] No N+1 query patterns
- [ ] Indexed fields used in WHERE clauses
- [ ] No synchronous external calls in business rules
- [ ] Client scripts minimized and batched
- [ ] Large data sets paginated

### Code Review

- [ ] GlideAggregate used for counts
- [ ] Caching implemented for repeated lookups
- [ ] Business rule conditions filter appropriately
- [ ] No unnecessary field access

---

## Related Resources

- [Troubleshooting Guide](./troubleshooting-guide.md) - Performance debugging
- [Security Patterns](./security-patterns.md) - Secure and performant code
- ServiceNow Performance Best Practices

---

*Part of the Foundry golden repository*
