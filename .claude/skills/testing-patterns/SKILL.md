---
name: testing-patterns
description: This skill teaches Claude how to write effective tests for ServiceNow development, including unit testing, ATF (Automated Test Framework), and mocking patterns.
scope: project
recommended: true
version: 1.0.0
---
# Testing Patterns Skill

This skill teaches Claude how to write effective tests for ServiceNow development, including unit testing, ATF (Automated Test Framework), and mocking patterns.

---

## Purpose

Use this skill when you need to:
- Write unit tests for Script Includes
- Create ATF tests for workflows and UI
- Mock GlideRecord and other ServiceNow objects
- Design test strategies for Now Assist skills
- Validate business logic in isolation

---

## Testing Approaches in ServiceNow

### Testing Levels

| Level | Tool | Use Case |
|-------|------|----------|
| **Unit Tests** | Script-based | Test individual functions/methods in isolation |
| **Integration Tests** | ATF | Test workflows, business rules, UI actions |
| **API Tests** | ATF/REST | Test Scripted REST APIs and integrations |
| **UI Tests** | ATF | Test client scripts and form behavior |

---

## Unit Testing Script Includes

### The TestRunner Pattern

Create a reusable test runner for Script Include unit tests:

```javascript
/**
 * Simple test runner for Script Include unit testing
 * Run in a background script
 */
var TestRunner = Class.create();
TestRunner.prototype = {
    initialize: function(suiteName) {
        this.suiteName = suiteName;
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.errors = [];
    },

    /**
     * Add a test case
     * @param {string} name - Test description
     * @param {function} testFn - Test function
     */
    test: function(name, testFn) {
        this.tests.push({ name: name, fn: testFn });
        return this;
    },

    /**
     * Run all tests
     */
    run: function() {
        gs.info('');
        gs.info('=== ' + this.suiteName + ' ===');
        gs.info('');

        for (var i = 0; i < this.tests.length; i++) {
            var test = this.tests[i];
            try {
                test.fn.call(this);
                this.passed++;
                gs.info('✓ ' + test.name);
            } catch (e) {
                this.failed++;
                gs.error('✗ ' + test.name);
                gs.error('  Error: ' + e.message);
                this.errors.push({ test: test.name, error: e.message });
            }
        }

        gs.info('');
        gs.info('Results: ' + this.passed + ' passed, ' + this.failed + ' failed');
        gs.info('');

        return this.failed === 0;
    },

    /**
     * Assert that a value is truthy
     */
    assertTrue: function(value, message) {
        if (!value) {
            throw new Error(message || 'Expected truthy value, got: ' + value);
        }
    },

    /**
     * Assert that a value is falsy
     */
    assertFalse: function(value, message) {
        if (value) {
            throw new Error(message || 'Expected falsy value, got: ' + value);
        }
    },

    /**
     * Assert equality
     */
    assertEqual: function(expected, actual, message) {
        if (expected !== actual) {
            throw new Error(message || 'Expected ' + expected + ', got ' + actual);
        }
    },

    /**
     * Assert deep equality for objects/arrays
     */
    assertDeepEqual: function(expected, actual, message) {
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            throw new Error(message || 'Objects not equal.\nExpected: ' +
                JSON.stringify(expected) + '\nActual: ' + JSON.stringify(actual));
        }
    },

    /**
     * Assert that a function throws an error
     */
    assertThrows: function(fn, expectedMessage) {
        var threw = false;
        try {
            fn();
        } catch (e) {
            threw = true;
            if (expectedMessage && e.message.indexOf(expectedMessage) === -1) {
                throw new Error('Expected error containing "' + expectedMessage +
                    '", got: ' + e.message);
            }
        }
        if (!threw) {
            throw new Error('Expected function to throw an error');
        }
    },

    /**
     * Assert that value is not null/undefined
     */
    assertNotNull: function(value, message) {
        if (value === null || value === undefined) {
            throw new Error(message || 'Expected non-null value');
        }
    },

    type: 'TestRunner'
};
```

### Example: Testing a Utility Script Include

```javascript
// Script Include to test
var StringUtils = Class.create();
StringUtils.prototype = {
    initialize: function() {},

    capitalize: function(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },

    truncate: function(str, maxLength, suffix) {
        suffix = suffix || '...';
        if (!str || str.length <= maxLength) return str;
        return str.substring(0, maxLength - suffix.length) + suffix;
    },

    slugify: function(str) {
        if (!str) return '';
        return str.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    type: 'StringUtils'
};

// Unit Tests
var runner = new TestRunner('StringUtils Tests');

runner.test('capitalize - normal string', function() {
    var utils = new StringUtils();
    this.assertEqual('Hello', utils.capitalize('hello'));
});

runner.test('capitalize - all caps', function() {
    var utils = new StringUtils();
    this.assertEqual('Hello', utils.capitalize('HELLO'));
});

runner.test('capitalize - empty string', function() {
    var utils = new StringUtils();
    this.assertEqual('', utils.capitalize(''));
});

runner.test('capitalize - null input', function() {
    var utils = new StringUtils();
    this.assertEqual('', utils.capitalize(null));
});

runner.test('truncate - short string unchanged', function() {
    var utils = new StringUtils();
    this.assertEqual('Hello', utils.truncate('Hello', 10));
});

runner.test('truncate - long string truncated', function() {
    var utils = new StringUtils();
    this.assertEqual('Hello...', utils.truncate('Hello World!', 8));
});

runner.test('truncate - custom suffix', function() {
    var utils = new StringUtils();
    this.assertEqual('Hello--', utils.truncate('Hello World!', 7, '--'));
});

runner.test('slugify - spaces to dashes', function() {
    var utils = new StringUtils();
    this.assertEqual('hello-world', utils.slugify('Hello World'));
});

runner.test('slugify - special characters removed', function() {
    var utils = new StringUtils();
    this.assertEqual('hello-world', utils.slugify('Hello! World?'));
});

runner.run();
```

---

## Mocking GlideRecord

### Mock GlideRecord Implementation

```javascript
/**
 * Mock GlideRecord for unit testing
 */
var MockGlideRecord = Class.create();
MockGlideRecord.prototype = {
    initialize: function(tableName) {
        this.tableName = tableName;
        this._records = [];
        this._currentIndex = -1;
        this._queries = [];
        this._limit = null;
        this._orderBy = null;
        this._currentRecord = {};
    },

    /**
     * Set mock data
     */
    setMockData: function(records) {
        this._records = records || [];
        return this;
    },

    /**
     * Add a query condition
     */
    addQuery: function(field, operatorOrValue, value) {
        this._queries.push({
            field: field,
            operator: value !== undefined ? operatorOrValue : '=',
            value: value !== undefined ? value : operatorOrValue
        });
        return this;
    },

    /**
     * Add encoded query
     */
    addEncodedQuery: function(query) {
        this._encodedQuery = query;
        return this;
    },

    /**
     * Set limit
     */
    setLimit: function(limit) {
        this._limit = limit;
        return this;
    },

    /**
     * Order by
     */
    orderBy: function(field) {
        this._orderBy = { field: field, desc: false };
        return this;
    },

    orderByDesc: function(field) {
        this._orderBy = { field: field, desc: true };
        return this;
    },

    /**
     * Execute query (filters mock data)
     */
    query: function() {
        var self = this;
        this._filteredRecords = this._records.filter(function(record) {
            return self._matchesQueries(record);
        });

        // Apply ordering
        if (this._orderBy) {
            var field = this._orderBy.field;
            var desc = this._orderBy.desc;
            this._filteredRecords.sort(function(a, b) {
                if (a[field] < b[field]) return desc ? 1 : -1;
                if (a[field] > b[field]) return desc ? -1 : 1;
                return 0;
            });
        }

        // Apply limit
        if (this._limit) {
            this._filteredRecords = this._filteredRecords.slice(0, this._limit);
        }

        this._currentIndex = -1;
    },

    _matchesQueries: function(record) {
        for (var i = 0; i < this._queries.length; i++) {
            var q = this._queries[i];
            var value = record[q.field];

            switch (q.operator) {
                case '=':
                    if (value !== q.value) return false;
                    break;
                case '!=':
                    if (value === q.value) return false;
                    break;
                case '>':
                    if (value <= q.value) return false;
                    break;
                case '>=':
                    if (value < q.value) return false;
                    break;
                case '<':
                    if (value >= q.value) return false;
                    break;
                case '<=':
                    if (value > q.value) return false;
                    break;
                case 'IN':
                    if (q.value.split(',').indexOf(value) === -1) return false;
                    break;
            }
        }
        return true;
    },

    /**
     * Move to next record
     */
    next: function() {
        this._currentIndex++;
        if (this._currentIndex < this._filteredRecords.length) {
            this._currentRecord = this._filteredRecords[this._currentIndex];
            return true;
        }
        return false;
    },

    /**
     * Get record by sys_id
     */
    get: function(sysId) {
        for (var i = 0; i < this._records.length; i++) {
            if (this._records[i].sys_id === sysId) {
                this._currentRecord = this._records[i];
                return true;
            }
        }
        return false;
    },

    /**
     * Get field value
     */
    getValue: function(field) {
        return this._currentRecord[field] || '';
    },

    /**
     * Get display value
     */
    getDisplayValue: function(field) {
        if (field) {
            return this._currentRecord[field + '_display'] || this._currentRecord[field] || '';
        }
        return this._currentRecord.name || this._currentRecord.number || '';
    },

    /**
     * Get unique value (sys_id)
     */
    getUniqueValue: function() {
        return this._currentRecord.sys_id || '';
    },

    /**
     * Set field value
     */
    setValue: function(field, value) {
        this._currentRecord[field] = value;
    },

    /**
     * Initialize new record
     */
    initialize: function() {
        this._currentRecord = { sys_id: this._generateId() };
    },

    /**
     * Insert record
     */
    insert: function() {
        var id = this._currentRecord.sys_id || this._generateId();
        this._currentRecord.sys_id = id;
        this._records.push(this._currentRecord);
        return id;
    },

    /**
     * Update record
     */
    update: function() {
        return this._currentRecord.sys_id;
    },

    /**
     * Delete record
     */
    deleteRecord: function() {
        var id = this._currentRecord.sys_id;
        this._records = this._records.filter(function(r) {
            return r.sys_id !== id;
        });
        return true;
    },

    /**
     * Check if field is valid
     */
    isValidField: function(field) {
        return true; // Accept all fields in mock
    },

    /**
     * Get row count
     */
    getRowCount: function() {
        return this._filteredRecords ? this._filteredRecords.length : 0;
    },

    _generateId: function() {
        return 'mock_' + Math.random().toString(36).substr(2, 32);
    },

    type: 'MockGlideRecord'
};
```

### Using Mock GlideRecord in Tests

```javascript
// Service to test
var IncidentService = Class.create();
IncidentService.prototype = {
    initialize: function(glideRecordClass) {
        // Allow injection for testing
        this.GlideRecord = glideRecordClass || GlideRecord;
    },

    getHighPriorityIncidents: function(limit) {
        var incidents = [];
        var gr = new this.GlideRecord('incident');
        gr.addQuery('priority', '1');
        gr.addQuery('active', true);
        gr.setLimit(limit || 10);
        gr.orderByDesc('sys_created_on');
        gr.query();

        while (gr.next()) {
            incidents.push({
                sys_id: gr.getUniqueValue(),
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                assigned_to: gr.getDisplayValue('assigned_to')
            });
        }

        return incidents;
    },

    type: 'IncidentService'
};

// Test with mocked GlideRecord
var runner = new TestRunner('IncidentService Tests');

runner.test('getHighPriorityIncidents returns P1 incidents', function() {
    // Setup mock
    var MockGR = function(table) {
        MockGlideRecord.call(this, table);
        this.setMockData([
            { sys_id: '1', number: 'INC001', priority: '1', active: true, short_description: 'Server down', assigned_to: 'admin', assigned_to_display: 'Admin User', sys_created_on: '2024-01-01' },
            { sys_id: '2', number: 'INC002', priority: '2', active: true, short_description: 'Slow app', assigned_to: 'user1', sys_created_on: '2024-01-02' },
            { sys_id: '3', number: 'INC003', priority: '1', active: true, short_description: 'Network issue', assigned_to: 'admin', assigned_to_display: 'Admin User', sys_created_on: '2024-01-03' },
            { sys_id: '4', number: 'INC004', priority: '1', active: false, short_description: 'Resolved', assigned_to: 'user2', sys_created_on: '2024-01-04' }
        ]);
    };
    MockGR.prototype = Object.create(MockGlideRecord.prototype);

    var service = new IncidentService(MockGR);
    var results = service.getHighPriorityIncidents(10);

    this.assertEqual(2, results.length, 'Should return 2 active P1 incidents');
    this.assertEqual('INC001', results[0].number);
    this.assertEqual('INC003', results[1].number);
});

runner.test('getHighPriorityIncidents respects limit', function() {
    var MockGR = function(table) {
        MockGlideRecord.call(this, table);
        this.setMockData([
            { sys_id: '1', number: 'INC001', priority: '1', active: true },
            { sys_id: '2', number: 'INC002', priority: '1', active: true },
            { sys_id: '3', number: 'INC003', priority: '1', active: true }
        ]);
    };
    MockGR.prototype = Object.create(MockGlideRecord.prototype);

    var service = new IncidentService(MockGR);
    var results = service.getHighPriorityIncidents(2);

    this.assertEqual(2, results.length, 'Should respect limit of 2');
});

runner.run();
```

---

## Automated Test Framework (ATF)

### ATF Test Structure

ATF tests are created through the UI but can be scripted:

```javascript
// ATF Test Steps - Server-side script example

// Step 1: Setup test data
(function(outputs, steps, params, stepResult, assertEqual) {
    // Create test incident
    var gr = new GlideRecord('incident');
    gr.initialize();
    gr.setValue('short_description', 'ATF Test Incident');
    gr.setValue('description', 'Created by ATF');
    gr.setValue('priority', '3');
    var sys_id = gr.insert();

    // Pass to next step
    outputs.incident_sys_id = sys_id;
    outputs.incident_number = gr.getValue('number');

    stepResult.setOutputMessage('Created incident: ' + outputs.incident_number);
})(outputs, steps, params, stepResult, assertEqual);

// Step 2: Execute business logic
(function(outputs, steps, params, stepResult, assertEqual) {
    var incident_id = steps.step1.incident_sys_id;

    // Call the service/function being tested
    var service = new IncidentProcessor();
    service.processIncident(incident_id);

    // Query updated record
    var gr = new GlideRecord('incident');
    gr.get(incident_id);

    outputs.new_state = gr.getValue('state');
    outputs.assignment_group = gr.getValue('assignment_group');

})(outputs, steps, params, stepResult, assertEqual);

// Step 3: Assert expected results
(function(outputs, steps, params, stepResult, assertEqual) {
    var expected_state = '2'; // In Progress

    assertEqual({
        name: 'State should be In Progress',
        shouldbe: expected_state,
        value: steps.step2.new_state
    });

    assertEqual({
        name: 'Assignment group should be set',
        shouldbe: true,
        value: steps.step2.assignment_group !== ''
    });

})(outputs, steps, params, stepResult, assertEqual);

// Step 4: Cleanup
(function(outputs, steps, params, stepResult, assertEqual) {
    var gr = new GlideRecord('incident');
    if (gr.get(steps.step1.incident_sys_id)) {
        gr.deleteRecord();
        stepResult.setOutputMessage('Cleaned up test incident');
    }
})(outputs, steps, params, stepResult, assertEqual);
```

### ATF Best Practices

1. **Isolation** - Each test should create its own data
2. **Cleanup** - Always delete test data after test runs
3. **Naming** - Use descriptive test names
4. **Assertions** - Test one thing per assertion
5. **Dependencies** - Minimize dependencies between tests

---

## Testing Now Assist Skills

### Skill Testing Strategy

```javascript
/**
 * Now Assist Skill Test Harness
 */
var SkillTestHarness = Class.create();
SkillTestHarness.prototype = {
    initialize: function(skillName) {
        this.skillName = skillName;
        this.tests = [];
    },

    /**
     * Add a test case
     */
    addTestCase: function(name, input, expectedOutputContains, expectedTools) {
        this.tests.push({
            name: name,
            input: input,
            expectedOutputContains: expectedOutputContains,
            expectedTools: expectedTools || []
        });
        return this;
    },

    /**
     * Run all test cases
     */
    runTests: function() {
        var results = [];

        for (var i = 0; i < this.tests.length; i++) {
            var test = this.tests[i];
            var result = this._runSingleTest(test);
            results.push(result);

            if (result.passed) {
                gs.info('✓ ' + test.name);
            } else {
                gs.error('✗ ' + test.name + ': ' + result.error);
            }
        }

        return results;
    },

    _runSingleTest: function(test) {
        try {
            // Simulate skill invocation
            var skillResponse = this._invokeSkill(test.input);

            // Check output contains expected content
            if (test.expectedOutputContains) {
                for (var j = 0; j < test.expectedOutputContains.length; j++) {
                    var expected = test.expectedOutputContains[j];
                    if (skillResponse.output.indexOf(expected) === -1) {
                        return {
                            passed: false,
                            error: 'Output missing: ' + expected
                        };
                    }
                }
            }

            // Check expected tools were called
            if (test.expectedTools.length > 0) {
                for (var k = 0; k < test.expectedTools.length; k++) {
                    var expectedTool = test.expectedTools[k];
                    if (skillResponse.toolsCalled.indexOf(expectedTool) === -1) {
                        return {
                            passed: false,
                            error: 'Tool not called: ' + expectedTool
                        };
                    }
                }
            }

            return { passed: true };

        } catch (e) {
            return { passed: false, error: e.message };
        }
    },

    _invokeSkill: function(input) {
        // This would call the actual skill execution API
        // For now, return mock response structure
        return {
            output: '',
            toolsCalled: []
        };
    },

    type: 'SkillTestHarness'
};

// Example usage
var harness = new SkillTestHarness('incident-lookup');

harness.addTestCase(
    'Should find incident by number',
    'Find incident INC0012345',
    ['INC0012345', 'short_description'],
    ['incident_lookup']
);

harness.addTestCase(
    'Should handle not found',
    'Find incident INC9999999',
    ['not found', 'does not exist'],
    ['incident_lookup']
);

harness.runTests();
```

---

## Test Data Patterns

### Test Data Builder

```javascript
/**
 * Fluent test data builder pattern
 */
var TestDataBuilder = Class.create();
TestDataBuilder.prototype = {
    initialize: function(tableName) {
        this.tableName = tableName;
        this._data = {};
        this._created = [];
    },

    /**
     * Set field value
     */
    with: function(field, value) {
        this._data[field] = value;
        return this;
    },

    /**
     * Create the record
     */
    create: function() {
        var gr = new GlideRecord(this.tableName);
        gr.initialize();

        for (var field in this._data) {
            gr.setValue(field, this._data[field]);
        }

        var sys_id = gr.insert();
        this._created.push(sys_id);
        this._data = {}; // Reset for next use

        return sys_id;
    },

    /**
     * Clean up all created records
     */
    cleanup: function() {
        var gr = new GlideRecord(this.tableName);
        for (var i = 0; i < this._created.length; i++) {
            if (gr.get(this._created[i])) {
                gr.deleteRecord();
            }
        }
        this._created = [];
    },

    type: 'TestDataBuilder'
};

// Usage
var incidentBuilder = new TestDataBuilder('incident');

var id1 = incidentBuilder
    .with('short_description', 'Test incident 1')
    .with('priority', '1')
    .with('category', 'software')
    .create();

var id2 = incidentBuilder
    .with('short_description', 'Test incident 2')
    .with('priority', '3')
    .with('category', 'hardware')
    .create();

// Run tests...

// Cleanup
incidentBuilder.cleanup();
```

### Fixtures

```javascript
/**
 * Test fixtures for consistent test data
 */
var TestFixtures = {
    // Standard test user
    testUser: {
        user_name: 'atf.test.user',
        first_name: 'ATF',
        last_name: 'Test User',
        email: 'atf.test@example.com'
    },

    // Standard test incidents
    incidents: {
        highPriority: {
            short_description: 'High priority test incident',
            priority: '1',
            impact: '1',
            urgency: '1',
            category: 'software'
        },
        lowPriority: {
            short_description: 'Low priority test incident',
            priority: '4',
            impact: '3',
            urgency: '3',
            category: 'inquiry'
        }
    },

    /**
     * Create fixture record
     */
    create: function(tableName, fixtureData) {
        var gr = new GlideRecord(tableName);
        gr.initialize();
        for (var field in fixtureData) {
            gr.setValue(field, fixtureData[field]);
        }
        return gr.insert();
    }
};
```

---

## Best Practices

### Test Organization

1. **One test file per Script Include** - Keep tests focused
2. **Descriptive names** - Test names should describe behavior
3. **Arrange-Act-Assert** - Clear test structure
4. **Independent tests** - Each test should run in isolation

### What to Test

- **Business logic** - Core calculations and decisions
- **Edge cases** - Empty inputs, nulls, boundaries
- **Error handling** - Invalid inputs, exceptions
- **Integration points** - API calls, external systems

### What NOT to Test

- **Platform functionality** - Don't test GlideRecord itself
- **Simple getters/setters** - No business logic
- **UI layout** - Unless behavior depends on it

---

## Related Resources

- [Troubleshooting Guide](../../context/troubleshooting-guide.md) - Debug test failures
- [Tool Script Writer](../tool-script-writer/SKILL.md) - Testing API integrations
- [ServiceNow ATF Documentation](https://docs.servicenow.com/bundle/atf)

---

*Part of the Foundry golden repository*
