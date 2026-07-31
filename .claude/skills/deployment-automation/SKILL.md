---
name: deployment-automation
description: This skill teaches Claude how to automate ServiceNow deployments, including update sets, CI/CD pipelines, and application publishing.
scope: project
recommended: true
version: 1.0.0
---
# Deployment Automation Skill

This skill teaches Claude how to automate ServiceNow deployments, including update sets, CI/CD pipelines, and application publishing.

---

## Purpose

Use this skill when you need to:
- Manage update sets for configuration changes
- Set up CI/CD pipelines for ServiceNow
- Automate application publishing
- Handle instance-to-instance promotions
- Create deployment scripts and workflows

---

## Update Set Management

### Update Set Basics

Update sets capture configuration changes for migration between instances.

| Type | Use Case |
|------|----------|
| **Local Update Set** | Active work in current instance |
| **Retrieved Update Set** | Imported from another instance |
| **Merged Update Set** | Combined from multiple sets |

### Creating Update Sets Programmatically

```javascript
/**
 * Update Set Manager for automated deployments
 */
var UpdateSetManager = Class.create();
UpdateSetManager.prototype = {
    initialize: function() {
        this.currentUser = gs.getUserID();
    },

    /**
     * Create a new update set
     */
    createUpdateSet: function(name, description, parentApp) {
        var gr = new GlideRecord('sys_update_set');
        gr.initialize();
        gr.setValue('name', name);
        gr.setValue('description', description || '');
        gr.setValue('state', 'in progress');

        if (parentApp) {
            gr.setValue('application', parentApp);
        }

        var sys_id = gr.insert();

        if (sys_id) {
            gs.info('Created update set: ' + name + ' (' + sys_id + ')');
        }

        return sys_id;
    },

    /**
     * Set the current update set
     */
    setCurrentUpdateSet: function(updateSetId) {
        var current = GlideUpdateSet.get();
        if (current) {
            current.set(updateSetId);
            gs.info('Switched to update set: ' + updateSetId);
            return true;
        }
        return false;
    },

    /**
     * Complete an update set
     */
    completeUpdateSet: function(updateSetId) {
        var gr = new GlideRecord('sys_update_set');
        if (gr.get(updateSetId)) {
            gr.setValue('state', 'complete');
            gr.update();
            gs.info('Completed update set: ' + gr.getValue('name'));
            return true;
        }
        return false;
    },

    /**
     * Get update set contents
     */
    getUpdateSetContents: function(updateSetId) {
        var contents = [];
        var gr = new GlideRecord('sys_update_xml');
        gr.addQuery('update_set', updateSetId);
        gr.query();

        while (gr.next()) {
            contents.push({
                name: gr.getValue('name'),
                type: gr.getValue('type'),
                target_name: gr.getValue('target_name'),
                action: gr.getValue('action')
            });
        }

        return contents;
    },

    /**
     * Export update set to XML
     */
    exportUpdateSet: function(updateSetId) {
        var exporter = new UpdateSetExport();
        return exporter.exportUpdateSet(updateSetId);
    },

    type: 'UpdateSetManager'
};
```

### Batch Update Set Operations

```javascript
/**
 * Batch operations for multiple update sets
 */
var UpdateSetBatch = Class.create();
UpdateSetBatch.prototype = {
    initialize: function() {
        this.manager = new UpdateSetManager();
    },

    /**
     * Complete all update sets for an application
     */
    completeAllForApp: function(appScope) {
        var completed = [];
        var gr = new GlideRecord('sys_update_set');
        gr.addQuery('application.scope', appScope);
        gr.addQuery('state', 'in progress');
        gr.query();

        while (gr.next()) {
            this.manager.completeUpdateSet(gr.getUniqueValue());
            completed.push(gr.getValue('name'));
        }

        return completed;
    },

    /**
     * Merge multiple update sets
     */
    mergeUpdateSets: function(sourceIds, targetName, targetDescription) {
        // Create target update set
        var targetId = this.manager.createUpdateSet(targetName, targetDescription);

        if (!targetId) {
            return { success: false, error: 'Failed to create target update set' };
        }

        // Move all update_xml records to target
        var moved = 0;
        sourceIds.forEach(function(sourceId) {
            var gr = new GlideRecord('sys_update_xml');
            gr.addQuery('update_set', sourceId);
            gr.query();

            while (gr.next()) {
                gr.setValue('update_set', targetId);
                gr.update();
                moved++;
            }
        });

        return {
            success: true,
            targetId: targetId,
            recordsMoved: moved
        };
    },

    type: 'UpdateSetBatch'
};
```

---

## CI/CD Pipeline Integration

### ServiceNow CI/CD API

```javascript
/**
 * CI/CD Pipeline Client for automated deployments
 */
var CICDPipelineClient = Class.create();
CICDPipelineClient.prototype = {
    initialize: function(config) {
        this.sourceInstance = config.sourceInstance;
        this.targetInstance = config.targetInstance;
        this.credentials = config.credentials;
    },

    /**
     * Trigger deployment pipeline
     */
    triggerDeployment: function(options) {
        var payload = {
            name: options.updateSetName,
            notes: options.notes || 'Automated deployment',
            packages: options.packages || []
        };

        var result = this._callAPI('/api/sn_cicd/sc/apply_changes', 'POST', payload);

        if (result.success) {
            gs.info('Deployment triggered: ' + result.data.result.sys_id);
            return {
                success: true,
                progressId: result.data.result.sys_id
            };
        }

        return { success: false, error: result.error };
    },

    /**
     * Check deployment progress
     */
    checkProgress: function(progressId) {
        var result = this._callAPI('/api/sn_cicd/progress/' + progressId, 'GET');

        if (result.success) {
            return {
                success: true,
                status: result.data.result.status,
                percentComplete: result.data.result.percent_complete,
                statusMessage: result.data.result.status_message
            };
        }

        return { success: false, error: result.error };
    },

    /**
     * Wait for deployment completion
     */
    waitForCompletion: function(progressId, timeoutMs, pollIntervalMs) {
        timeoutMs = timeoutMs || 600000; // 10 minutes default
        pollIntervalMs = pollIntervalMs || 10000; // 10 seconds

        var startTime = new Date().getTime();

        while (new Date().getTime() - startTime < timeoutMs) {
            var progress = this.checkProgress(progressId);

            if (!progress.success) {
                return { success: false, error: progress.error };
            }

            if (progress.status === 'succeeded') {
                return { success: true, status: 'completed' };
            }

            if (progress.status === 'failed') {
                return {
                    success: false,
                    status: 'failed',
                    error: progress.statusMessage
                };
            }

            // Wait before next poll
            this._sleep(pollIntervalMs);
        }

        return { success: false, error: 'Deployment timed out' };
    },

    /**
     * Rollback deployment
     */
    rollback: function(updateSetId) {
        var payload = {
            update_set: updateSetId,
            action: 'rollback'
        };

        return this._callAPI('/api/sn_cicd/sc/rollback', 'POST', payload);
    },

    _callAPI: function(endpoint, method, payload) {
        try {
            var rest = new sn_ws.RESTMessageV2();
            rest.setEndpoint(this.targetInstance + endpoint);
            rest.setHttpMethod(method);
            rest.setBasicAuth(this.credentials.username, this.credentials.password);
            rest.setRequestHeader('Content-Type', 'application/json');
            rest.setRequestHeader('Accept', 'application/json');

            if (payload) {
                rest.setRequestBody(JSON.stringify(payload));
            }

            var response = rest.execute();
            var statusCode = response.getStatusCode();

            if (statusCode >= 200 && statusCode < 300) {
                return {
                    success: true,
                    data: JSON.parse(response.getBody())
                };
            }

            return {
                success: false,
                error: 'API returned ' + statusCode
            };

        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    _sleep: function(ms) {
        var start = new Date().getTime();
        while (new Date().getTime() < start + ms) {}
    },

    type: 'CICDPipelineClient'
};
```

### Pipeline Configuration

```javascript
/**
 * Pipeline configuration for different environments
 */
var PipelineConfig = {
    environments: {
        dev: {
            name: 'Development',
            instance: 'https://dev.service-now.com',
            autoApprove: true
        },
        test: {
            name: 'Test',
            instance: 'https://test.service-now.com',
            autoApprove: true
        },
        stage: {
            name: 'Staging',
            instance: 'https://stage.service-now.com',
            autoApprove: false,
            requiredApprovers: ['change_manager']
        },
        prod: {
            name: 'Production',
            instance: 'https://prod.service-now.com',
            autoApprove: false,
            requiredApprovers: ['change_manager', 'release_manager'],
            changeRequired: true
        }
    },

    /**
     * Get promotion path for environment
     */
    getPromotionPath: function(fromEnv) {
        var paths = {
            dev: 'test',
            test: 'stage',
            stage: 'prod'
        };
        return paths[fromEnv];
    },

    /**
     * Validate deployment is allowed
     */
    canDeploy: function(targetEnv, user) {
        var env = this.environments[targetEnv];

        if (env.autoApprove) {
            return { allowed: true };
        }

        // Check if user has required role
        var hasApproval = env.requiredApprovers.some(function(role) {
            return gs.hasRole(role);
        });

        if (!hasApproval) {
            return {
                allowed: false,
                reason: 'Requires approval from: ' + env.requiredApprovers.join(', ')
            };
        }

        return { allowed: true };
    }
};
```

---

## Application Publishing

### Scoped Application Export

```javascript
/**
 * Application Publisher for scoped apps
 */
var ApplicationPublisher = Class.create();
ApplicationPublisher.prototype = {
    initialize: function(appScope) {
        this.appScope = appScope;
    },

    /**
     * Validate application before publishing
     */
    validate: function() {
        var issues = [];

        // Check for incomplete records
        var incomplete = this._checkIncompleteRecords();
        if (incomplete.length > 0) {
            issues.push({
                type: 'incomplete_records',
                count: incomplete.length,
                details: incomplete
            });
        }

        // Check for test data
        var testData = this._checkTestData();
        if (testData.length > 0) {
            issues.push({
                type: 'test_data',
                count: testData.length,
                details: testData
            });
        }

        // Check version
        var versionIssue = this._checkVersion();
        if (versionIssue) {
            issues.push(versionIssue);
        }

        return {
            valid: issues.length === 0,
            issues: issues
        };
    },

    /**
     * Increment application version
     */
    incrementVersion: function(type) {
        var gr = new GlideRecord('sys_app');
        gr.addQuery('scope', this.appScope);
        gr.query();

        if (!gr.next()) {
            return { success: false, error: 'Application not found' };
        }

        var currentVersion = gr.getValue('version') || '1.0.0';
        var parts = currentVersion.split('.');
        var major = parseInt(parts[0]) || 1;
        var minor = parseInt(parts[1]) || 0;
        var patch = parseInt(parts[2]) || 0;

        switch (type) {
            case 'major':
                major++;
                minor = 0;
                patch = 0;
                break;
            case 'minor':
                minor++;
                patch = 0;
                break;
            case 'patch':
            default:
                patch++;
        }

        var newVersion = major + '.' + minor + '.' + patch;
        gr.setValue('version', newVersion);
        gr.update();

        return {
            success: true,
            oldVersion: currentVersion,
            newVersion: newVersion
        };
    },

    /**
     * Publish to app repo
     */
    publish: function(options) {
        options = options || {};

        // Validate first
        var validation = this.validate();
        if (!validation.valid && !options.force) {
            return {
                success: false,
                error: 'Validation failed',
                issues: validation.issues
            };
        }

        // Increment version if requested
        if (options.incrementVersion) {
            this.incrementVersion(options.incrementVersion);
        }

        // Trigger publish
        var publisher = new sn_appauthor.AppRepoPublisher();
        var result = publisher.publishApp(this.appScope);

        return {
            success: result.success,
            version: result.version,
            error: result.error
        };
    },

    _checkIncompleteRecords: function() {
        // Implementation to find incomplete records
        return [];
    },

    _checkTestData: function() {
        // Implementation to find test data
        return [];
    },

    _checkVersion: function() {
        // Implementation to validate version format
        return null;
    },

    type: 'ApplicationPublisher'
};
```

---

## Deployment Scripts

### Pre-Deployment Script

```javascript
/**
 * Pre-deployment checks and preparation
 */
var PreDeploymentScript = Class.create();
PreDeploymentScript.prototype = {
    initialize: function(deploymentId) {
        this.deploymentId = deploymentId;
        this.checks = [];
    },

    /**
     * Run all pre-deployment checks
     */
    run: function() {
        var results = {
            passed: [],
            failed: [],
            warnings: []
        };

        // Check 1: Instance health
        var healthCheck = this.checkInstanceHealth();
        this._categorize(results, healthCheck);

        // Check 2: Required roles
        var roleCheck = this.checkRequiredRoles();
        this._categorize(results, roleCheck);

        // Check 3: Conflicting updates
        var conflictCheck = this.checkForConflicts();
        this._categorize(results, conflictCheck);

        // Check 4: Backup status
        var backupCheck = this.checkBackupStatus();
        this._categorize(results, backupCheck);

        return {
            canProceed: results.failed.length === 0,
            results: results
        };
    },

    checkInstanceHealth: function() {
        // Check semaphores, jobs, etc.
        var semaphores = new GlideRecord('sys_semaphore');
        semaphores.addQuery('claimed', true);
        semaphores.query();

        if (semaphores.getRowCount() > 10) {
            return {
                name: 'Instance Health',
                status: 'warning',
                message: 'High semaphore count: ' + semaphores.getRowCount()
            };
        }

        return {
            name: 'Instance Health',
            status: 'passed',
            message: 'Instance is healthy'
        };
    },

    checkRequiredRoles: function() {
        var requiredRoles = ['admin', 'update_set_admin'];
        var missingRoles = [];

        requiredRoles.forEach(function(role) {
            if (!gs.hasRole(role)) {
                missingRoles.push(role);
            }
        });

        if (missingRoles.length > 0) {
            return {
                name: 'Required Roles',
                status: 'failed',
                message: 'Missing roles: ' + missingRoles.join(', ')
            };
        }

        return {
            name: 'Required Roles',
            status: 'passed',
            message: 'All required roles present'
        };
    },

    checkForConflicts: function() {
        // Check for update conflicts in retrieved sets
        var gr = new GlideRecord('sys_update_set');
        gr.addQuery('state', 'loaded');
        gr.addQuery('collision_record', '!=', '');
        gr.query();

        if (gr.getRowCount() > 0) {
            return {
                name: 'Update Conflicts',
                status: 'failed',
                message: 'Found ' + gr.getRowCount() + ' update sets with conflicts'
            };
        }

        return {
            name: 'Update Conflicts',
            status: 'passed',
            message: 'No conflicts detected'
        };
    },

    checkBackupStatus: function() {
        // Check if recent backup exists
        var gr = new GlideRecord('sys_backup_history');
        gr.addQuery('sys_created_on', '>', gs.daysAgo(1));
        gr.addQuery('state', 'complete');
        gr.query();

        if (!gr.next()) {
            return {
                name: 'Backup Status',
                status: 'warning',
                message: 'No backup in last 24 hours'
            };
        }

        return {
            name: 'Backup Status',
            status: 'passed',
            message: 'Recent backup found'
        };
    },

    _categorize: function(results, check) {
        results[check.status === 'passed' ? 'passed' :
               check.status === 'failed' ? 'failed' : 'warnings'].push(check);
    },

    type: 'PreDeploymentScript'
};
```

### Post-Deployment Script

```javascript
/**
 * Post-deployment validation and cleanup
 */
var PostDeploymentScript = Class.create();
PostDeploymentScript.prototype = {
    initialize: function(deploymentId) {
        this.deploymentId = deploymentId;
    },

    /**
     * Run all post-deployment tasks
     */
    run: function() {
        var tasks = [];

        // Task 1: Clear caches
        tasks.push(this.clearCaches());

        // Task 2: Validate changes
        tasks.push(this.validateChanges());

        // Task 3: Run smoke tests
        tasks.push(this.runSmokeTests());

        // Task 4: Notify stakeholders
        tasks.push(this.notifyStakeholders());

        // Task 5: Update deployment record
        tasks.push(this.updateDeploymentRecord());

        return {
            success: tasks.every(function(t) { return t.success; }),
            tasks: tasks
        };
    },

    clearCaches: function() {
        try {
            // Clear relevant caches
            gs.invalidateCache();
            gs.info('Caches cleared');

            return {
                name: 'Clear Caches',
                success: true,
                message: 'Caches cleared successfully'
            };
        } catch (e) {
            return {
                name: 'Clear Caches',
                success: false,
                error: e.message
            };
        }
    },

    validateChanges: function() {
        // Verify critical components are working
        var validations = [
            this._validateBusinessRules(),
            this._validateScriptIncludes(),
            this._validateACLs()
        ];

        var failed = validations.filter(function(v) { return !v.success; });

        return {
            name: 'Validate Changes',
            success: failed.length === 0,
            details: validations
        };
    },

    runSmokeTests: function() {
        // Run quick smoke tests
        var testSuite = 'Deployment Smoke Tests';

        // Trigger ATF suite if exists
        var gr = new GlideRecord('sys_atf_test_suite');
        gr.addQuery('name', testSuite);
        gr.query();

        if (gr.next()) {
            var runner = new sn_atf.ATFTestRunner();
            var result = runner.runTestSuite(gr.getUniqueValue());

            return {
                name: 'Smoke Tests',
                success: result.passed,
                details: result
            };
        }

        return {
            name: 'Smoke Tests',
            success: true,
            message: 'No smoke test suite configured'
        };
    },

    notifyStakeholders: function() {
        // Send notification
        var recipients = this._getStakeholders();

        recipients.forEach(function(recipient) {
            gs.eventQueue('deployment.complete', null,
                this.deploymentId, recipient);
        }, this);

        return {
            name: 'Notify Stakeholders',
            success: true,
            notified: recipients.length
        };
    },

    updateDeploymentRecord: function() {
        // Update deployment tracking record
        return {
            name: 'Update Record',
            success: true
        };
    },

    _validateBusinessRules: function() {
        return { name: 'Business Rules', success: true };
    },

    _validateScriptIncludes: function() {
        return { name: 'Script Includes', success: true };
    },

    _validateACLs: function() {
        return { name: 'ACLs', success: true };
    },

    _getStakeholders: function() {
        return ['admin@example.com'];
    },

    type: 'PostDeploymentScript'
};
```

---

## Best Practices

### Update Set Management

1. **One change per update set** - Keep updates focused
2. **Clear naming** - Include ticket number and description
3. **Complete before promoting** - Never promote in-progress sets
4. **Document changes** - Add clear descriptions

### CI/CD Pipelines

1. **Automate validation** - Pre-commit checks
2. **Stage deployments** - Dev → Test → Stage → Prod
3. **Rollback plans** - Always have a rollback strategy
4. **Monitor deployments** - Track success/failure rates

### Application Publishing

1. **Version semantically** - Major.Minor.Patch
2. **Test thoroughly** - Before publishing to repo
3. **Remove test data** - Clean up before publish
4. **Document dependencies** - List required plugins

---

## Related Resources

- [Testing Patterns](../testing-patterns/SKILL.md) - Test before deploy
- [Tool Script Writer](../tool-script-writer/SKILL.md) - CI/CD API usage
- [Security Patterns](../../context/security-patterns.md) - Secure deployments

---

*Part of the Foundry golden repository*
