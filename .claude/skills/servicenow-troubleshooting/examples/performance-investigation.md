# Example: Performance Investigation

This example shows how to investigate slow performance in ServiceNow.

---

## Scenario

Users report: "The incident list is loading very slowly. It used to be fast but now takes 30+ seconds."

---

## Investigation Steps

### 1. Check Instance Health

```
servicenow_instance includeHealth=true
```

**What to look for:**
- High CPU/memory usage
- Slow transactions
- Queue backlogs

### 2. Check Recent Error Logs

```
servicenow_syslogs level="warning" timeRange="1h" source="performance"
```

**What to look for:**
- Slow query warnings
- Timeout errors
- Memory warnings

### 3. Count Records in Affected Table

```
servicenow_script script="
var gr = new GlideRecord('incident');
gr.query();
gs.info('Total incidents: ' + gr.getRowCount());

// Check recent growth
gr = new GlideRecord('incident');
gr.addQuery('sys_created_on', '>=', gs.daysAgo(30));
gr.query();
gs.info('Created in last 30 days: ' + gr.getRowCount());
" mode="readonly"
```

### 4. Test Query Performance

```
servicenow_script script="
var start = new Date().getTime();

var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.setLimit(100);
gr.query();

var elapsed = new Date().getTime() - start;
gs.info('Query time: ' + elapsed + 'ms');
gs.info('Records: ' + gr.getRowCount());
" mode="readonly"
```

### 5. Check for Missing Indexes

```
servicenow_query table="sys_index" query="table=incident" fields="name,column,active" limit=20
```

---

## Common Findings

### Finding 1: Table Size Growth

**Symptom:** Record count increased significantly

**Indicators:**
- 100K+ records in table
- Large growth in recent period

**Solutions:**
- Archive old records
- Add data retention rules
- Optimize list views

### Finding 2: Missing Index

**Symptom:** Queries on specific fields are slow

**Solution:**
```javascript
// Check if field is indexed
var gr = new GlideRecord('sys_index');
gr.addQuery('table', 'incident');
gr.addQuery('column', 'CONTAINS', 'field_name');
gr.query();
gs.info('Index exists: ' + gr.hasNext());
```

### Finding 3: Complex List Filter

**Symptom:** Specific list view is slow, others are fine

**Investigation:**
```javascript
// Check list view configuration
var gr = new GlideRecord('sys_ui_list');
gr.addQuery('name', 'incident');
gr.addQuery('view', 'default');
gr.query();
while (gr.next()) {
    gs.info('List: ' + gr.name);
}
```

### Finding 4: Business Rule Impact

**Symptom:** Individual record loads slowly

**Investigation:**
```javascript
// Find active business rules
var gr = new GlideRecord('sys_script');
gr.addQuery('collection', 'incident');
gr.addQuery('active', true);
gr.query();
gs.info('Active business rules: ' + gr.getRowCount());
```

---

## Performance Optimization Tips

1. **Add indexes** on frequently queried fields
2. **Limit result sets** - Always use setLimit()
3. **Avoid N+1 queries** - Batch related lookups
4. **Use display values wisely** - getDisplayValue() is expensive
5. **Archive old data** - Keep active tables lean

---

## Reporting Template

```
## Performance Investigation Summary

**Issue:** [Description of performance problem]

**Metrics:**
- Table size: [X] records
- Query time: [X]ms
- Affected users: [scope]

**Root Cause:** [What's causing the slowdown]

**Recommendations:**
1. [Action 1]
2. [Action 2]

**Expected Improvement:** [Estimated impact]
```

---

*Part of the servicenow-troubleshooting skill*
