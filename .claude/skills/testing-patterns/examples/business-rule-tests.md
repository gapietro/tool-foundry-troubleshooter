# Example: Testing Business Rules

This example demonstrates how to test business rules that trigger on incident state changes.

---

## Use Case

**Business Rule:** When an incident is resolved, automatically:
1. Set resolved_by to the current user
2. Set resolved_at to current time
3. Calculate resolution time
4. Send notification if SLA was breached

---

## Business Rule Implementation

```javascript
// Business Rule: Incident Resolution Handler
// Table: incident
// When: before
// Condition: current.state == 'resolved' && previous.state != 'resolved'

(function executeRule(current, previous) {

    var resolver = new IncidentResolver();
    resolver.handleResolution(current);

})(current, previous);

// Script Include: IncidentResolver
var IncidentResolver = Class.create();
IncidentResolver.prototype = {
    initialize: function(nowDatetime) {
        // Allow datetime injection for testing
        this.nowDatetime = nowDatetime || new GlideDateTime();
    },

    handleResolution: function(incident) {
        // Set resolved by
        incident.setValue('resolved_by', gs.getUserID());

        // Set resolved time
        incident.setValue('resolved_at', this.nowDatetime);

        // Calculate resolution time
        var resolutionTime = this.calculateResolutionTime(incident);
        incident.setValue('u_resolution_time', resolutionTime);

        // Check SLA
        var slaBreached = this.checkSLABreach(incident, resolutionTime);
        if (slaBreached) {
            this.notifySLABreach(incident);
        }
    },

    calculateResolutionTime: function(incident) {
        var openedAt = new GlideDateTime(incident.getValue('opened_at'));
        var duration = GlideDateTime.subtract(openedAt, this.nowDatetime);
        return duration.getNumericValue(); // milliseconds
    },

    checkSLABreach: function(incident, resolutionTime) {
        // Get SLA based on priority
        var slaTimes = {
            '1': 4 * 60 * 60 * 1000,   // 4 hours for P1
            '2': 8 * 60 * 60 * 1000,   // 8 hours for P2
            '3': 24 * 60 * 60 * 1000,  // 24 hours for P3
            '4': 72 * 60 * 60 * 1000   // 72 hours for P4
        };

        var priority = incident.getValue('priority');
        var slaTime = slaTimes[priority] || slaTimes['4'];

        return resolutionTime > slaTime;
    },

    notifySLABreach: function(incident) {
        // Create notification record or send email
        gs.eventQueue('incident.sla.breached', incident, incident.getValue('number'), '');
    },

    type: 'IncidentResolver'
};
```

---

## Unit Tests

```javascript
// Test Suite for IncidentResolver
var runner = new TestRunner('IncidentResolver Tests');

// Mock incident for testing
function createMockIncident(data) {
    var record = {
        _values: data,
        getValue: function(field) { return this._values[field] || ''; },
        setValue: function(field, value) { this._values[field] = value; }
    };
    return record;
}

runner.test('handleResolution sets resolved_by to current user', function() {
    var mockIncident = createMockIncident({
        opened_at: '2024-01-01 10:00:00',
        priority: '3'
    });

    // Mock the current user
    var originalGetUserID = gs.getUserID;
    gs.getUserID = function() { return 'test_user_id'; };

    var resolver = new IncidentResolver(new GlideDateTime('2024-01-01 14:00:00'));
    resolver.handleResolution(mockIncident);

    // Restore
    gs.getUserID = originalGetUserID;

    this.assertEqual('test_user_id', mockIncident.getValue('resolved_by'));
});

runner.test('handleResolution sets resolved_at', function() {
    var mockIncident = createMockIncident({
        opened_at: '2024-01-01 10:00:00',
        priority: '3'
    });

    var resolveTime = new GlideDateTime('2024-01-01 14:00:00');
    var resolver = new IncidentResolver(resolveTime);
    resolver.handleResolution(mockIncident);

    this.assertNotNull(mockIncident.getValue('resolved_at'));
});

runner.test('calculateResolutionTime returns correct duration', function() {
    var mockIncident = createMockIncident({
        opened_at: '2024-01-01 10:00:00'
    });

    // 4 hours later
    var resolveTime = new GlideDateTime('2024-01-01 14:00:00');
    var resolver = new IncidentResolver(resolveTime);

    var duration = resolver.calculateResolutionTime(mockIncident);
    var expectedMs = 4 * 60 * 60 * 1000; // 4 hours in ms

    this.assertEqual(expectedMs, duration);
});

runner.test('checkSLABreach returns true when P1 exceeds 4 hours', function() {
    var mockIncident = createMockIncident({ priority: '1' });

    var resolver = new IncidentResolver();
    var fiveHoursMs = 5 * 60 * 60 * 1000;

    var breached = resolver.checkSLABreach(mockIncident, fiveHoursMs);

    this.assertTrue(breached, 'P1 resolved in 5 hours should breach 4 hour SLA');
});

runner.test('checkSLABreach returns false when P1 within 4 hours', function() {
    var mockIncident = createMockIncident({ priority: '1' });

    var resolver = new IncidentResolver();
    var threeHoursMs = 3 * 60 * 60 * 1000;

    var breached = resolver.checkSLABreach(mockIncident, threeHoursMs);

    this.assertFalse(breached, 'P1 resolved in 3 hours should not breach 4 hour SLA');
});

runner.test('checkSLABreach uses P4 SLA as default for unknown priority', function() {
    var mockIncident = createMockIncident({ priority: '99' });

    var resolver = new IncidentResolver();

    // 48 hours - should not breach P4's 72 hour SLA
    var fortyEightHoursMs = 48 * 60 * 60 * 1000;
    var breached = resolver.checkSLABreach(mockIncident, fortyEightHoursMs);

    this.assertFalse(breached, 'Unknown priority should use P4 SLA (72 hours)');
});

// Run all tests
runner.run();
```

---

## ATF Integration Test

```javascript
// ATF Test: Incident Resolution Integration

// Step 1: Create test incident
(function(outputs, steps, params, stepResult, assertEqual) {
    var gr = new GlideRecord('incident');
    gr.initialize();
    gr.setValue('short_description', 'ATF Resolution Test');
    gr.setValue('priority', '2');
    gr.setValue('state', '1'); // New
    var sys_id = gr.insert();

    outputs.incident_sys_id = sys_id;
    outputs.incident_number = gr.getValue('number');
    outputs.opened_at = gr.getValue('opened_at');

    stepResult.setOutputMessage('Created ' + outputs.incident_number);
})(outputs, steps, params, stepResult, assertEqual);

// Step 2: Resolve the incident
(function(outputs, steps, params, stepResult, assertEqual) {
    var gr = new GlideRecord('incident');
    if (gr.get(steps.step1.incident_sys_id)) {
        gr.setValue('state', '6'); // Resolved
        gr.setValue('close_code', 'Solved');
        gr.setValue('close_notes', 'ATF Test resolution');
        gr.update();

        outputs.resolved_by = gr.getValue('resolved_by');
        outputs.resolved_at = gr.getValue('resolved_at');
        outputs.resolution_time = gr.getValue('u_resolution_time');
    }
})(outputs, steps, params, stepResult, assertEqual);

// Step 3: Verify resolution fields
(function(outputs, steps, params, stepResult, assertEqual) {
    assertEqual({
        name: 'resolved_by should be set',
        shouldbe: true,
        value: steps.step2.resolved_by !== ''
    });

    assertEqual({
        name: 'resolved_at should be set',
        shouldbe: true,
        value: steps.step2.resolved_at !== ''
    });

    assertEqual({
        name: 'resolution_time should be calculated',
        shouldbe: true,
        value: parseInt(steps.step2.resolution_time) > 0
    });
})(outputs, steps, params, stepResult, assertEqual);

// Step 4: Cleanup
(function(outputs, steps, params, stepResult, assertEqual) {
    var gr = new GlideRecord('incident');
    if (gr.get(steps.step1.incident_sys_id)) {
        gr.deleteRecord();
    }
    stepResult.setOutputMessage('Cleaned up test data');
})(outputs, steps, params, stepResult, assertEqual);
```

---

## Test Data Setup

```javascript
// Reusable test data for resolution testing
var ResolutionTestData = {
    /**
     * Create incident with specific timing for SLA tests
     */
    createTimedIncident: function(priority, hoursAgo) {
        var openedAt = new GlideDateTime();
        openedAt.addSeconds(-hoursAgo * 3600);

        var builder = new TestDataBuilder('incident');
        return builder
            .with('short_description', 'SLA Test - P' + priority + ' - ' + hoursAgo + 'h ago')
            .with('priority', priority)
            .with('opened_at', openedAt.getValue())
            .with('state', '1')
            .create();
    },

    /**
     * Create test scenarios for SLA boundary testing
     */
    createSLAScenarios: function() {
        return [
            // P1: 4 hour SLA
            { priority: '1', hoursAgo: 3, shouldBreach: false },  // Under
            { priority: '1', hoursAgo: 4, shouldBreach: false },  // At limit
            { priority: '1', hoursAgo: 5, shouldBreach: true },   // Over

            // P2: 8 hour SLA
            { priority: '2', hoursAgo: 7, shouldBreach: false },
            { priority: '2', hoursAgo: 9, shouldBreach: true },

            // P3: 24 hour SLA
            { priority: '3', hoursAgo: 20, shouldBreach: false },
            { priority: '3', hoursAgo: 25, shouldBreach: true }
        ];
    }
};
```

---

## Running the Tests

```javascript
// Complete test execution script

// 1. Run unit tests
gs.info('Running Unit Tests...');
var unitRunner = new TestRunner('IncidentResolver Unit Tests');
// ... add tests ...
var unitsPassed = unitRunner.run();

// 2. Run integration tests with real data
gs.info('Running Integration Tests...');
var scenarios = ResolutionTestData.createSLAScenarios();
var integrationPassed = true;

scenarios.forEach(function(scenario, index) {
    var incidentId = ResolutionTestData.createTimedIncident(
        scenario.priority,
        scenario.hoursAgo
    );

    // Resolve the incident
    var gr = new GlideRecord('incident');
    gr.get(incidentId);
    gr.setValue('state', '6');
    gr.update();

    // Check if SLA breach notification was triggered as expected
    // ... verification logic ...

    // Cleanup
    gr.deleteRecord();
});

// 3. Report results
gs.info('');
gs.info('=== Test Summary ===');
gs.info('Unit Tests: ' + (unitsPassed ? 'PASSED' : 'FAILED'));
gs.info('Integration Tests: ' + (integrationPassed ? 'PASSED' : 'FAILED'));
```

---

*Part of the testing-patterns skill*
