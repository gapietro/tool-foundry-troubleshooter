# Example: Complete CI/CD Pipeline Workflow

This example shows a complete deployment workflow from development to production.

---

## Scenario

A team needs to deploy a new Now Assist skill from development to production with proper validation at each stage.

---

## Pipeline Stages

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│     DEV     │────▶│    TEST     │────▶│   STAGE     │────▶│    PROD     │
│  (develop)  │     │  (validate) │     │  (approve)  │     │  (deploy)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
   Auto-deploy        ATF Tests          Manual Review      Change Ticket
   On commit          API Tests          Load Testing       Maintenance
                                         Security Scan       Window
```

---

## Stage 1: Development

### Automated Workflow Script

```javascript
/**
 * Development deployment automation
 * Triggered by commit to feature branch
 */
var DevDeployment = Class.create();
DevDeployment.prototype = {
    initialize: function(commitInfo) {
        this.commit = commitInfo;
        this.manager = new UpdateSetManager();
        this.validator = new PreDeploymentScript();
    },

    /**
     * Execute development deployment
     */
    execute: function() {
        var result = {
            stage: 'development',
            commitId: this.commit.id,
            steps: []
        };

        // Step 1: Create update set from commit
        var updateSet = this._createUpdateSetFromCommit();
        result.steps.push({
            name: 'Create Update Set',
            success: updateSet.success,
            updateSetId: updateSet.sys_id
        });

        if (!updateSet.success) {
            return this._failed(result, 'Failed to create update set');
        }

        // Step 2: Run unit tests
        var unitTests = this._runUnitTests();
        result.steps.push({
            name: 'Unit Tests',
            success: unitTests.success,
            passed: unitTests.passed,
            failed: unitTests.failed
        });

        if (!unitTests.success) {
            return this._failed(result, 'Unit tests failed');
        }

        // Step 3: Static analysis
        var analysis = this._runStaticAnalysis();
        result.steps.push({
            name: 'Static Analysis',
            success: analysis.success,
            issues: analysis.issues
        });

        if (!analysis.success) {
            return this._failed(result, 'Static analysis failed');
        }

        // Step 4: Complete update set
        this.manager.completeUpdateSet(updateSet.sys_id);
        result.steps.push({
            name: 'Complete Update Set',
            success: true
        });

        // Step 5: Trigger promotion to TEST
        var promotion = this._triggerPromotion(updateSet.sys_id, 'test');
        result.steps.push({
            name: 'Promote to TEST',
            success: promotion.success,
            promotionId: promotion.progressId
        });

        result.success = true;
        return result;
    },

    _createUpdateSetFromCommit: function() {
        var name = 'DEV-' + this.commit.ticket + ' - ' + this.commit.message;
        var sys_id = this.manager.createUpdateSet(name, this.commit.message);
        return { success: !!sys_id, sys_id: sys_id };
    },

    _runUnitTests: function() {
        // Run unit tests for modified script includes
        var runner = new TestRunner('Commit Tests');
        // Add tests based on modified files
        return { success: true, passed: 10, failed: 0 };
    },

    _runStaticAnalysis: function() {
        // Check for common issues
        return { success: true, issues: [] };
    },

    _triggerPromotion: function(updateSetId, targetEnv) {
        var client = new CICDPipelineClient({
            targetInstance: PipelineConfig.environments[targetEnv].instance
        });
        return client.triggerDeployment({
            updateSetName: updateSetId,
            notes: 'Auto-promoted from DEV'
        });
    },

    _failed: function(result, reason) {
        result.success = false;
        result.error = reason;
        return result;
    },

    type: 'DevDeployment'
};

// Usage
var deployment = new DevDeployment({
    id: 'abc123',
    ticket: 'STRY001234',
    message: 'Add incident triage skill',
    author: 'developer@example.com'
});

var result = deployment.execute();
gs.info('DEV Deployment: ' + JSON.stringify(result));
```

---

## Stage 2: Test Environment

### Test Deployment Workflow

```javascript
/**
 * Test environment deployment with ATF integration
 */
var TestDeployment = Class.create();
TestDeployment.prototype = {
    initialize: function(updateSetId) {
        this.updateSetId = updateSetId;
        this.client = new CICDPipelineClient({
            targetInstance: PipelineConfig.environments.test.instance
        });
    },

    execute: function() {
        var result = {
            stage: 'test',
            updateSetId: this.updateSetId,
            steps: []
        };

        // Step 1: Preview update set
        var preview = this._previewUpdateSet();
        result.steps.push({
            name: 'Preview Changes',
            success: preview.success,
            changes: preview.changes,
            conflicts: preview.conflicts
        });

        if (preview.conflicts.length > 0) {
            return this._requiresReview(result, 'Conflicts detected');
        }

        // Step 2: Apply update set
        var apply = this._applyUpdateSet();
        result.steps.push({
            name: 'Apply Update Set',
            success: apply.success
        });

        if (!apply.success) {
            return this._failed(result, 'Failed to apply update set');
        }

        // Step 3: Run ATF test suite
        var atfResults = this._runATFTests();
        result.steps.push({
            name: 'ATF Tests',
            success: atfResults.success,
            testResults: atfResults
        });

        if (!atfResults.success) {
            // Rollback and fail
            this._rollback();
            return this._failed(result, 'ATF tests failed - rolled back');
        }

        // Step 4: Run API tests
        var apiTests = this._runAPITests();
        result.steps.push({
            name: 'API Tests',
            success: apiTests.success,
            endpoints: apiTests.endpoints
        });

        // Step 5: Create stage promotion request
        var promotionRequest = this._createPromotionRequest();
        result.steps.push({
            name: 'Promotion Request',
            success: true,
            requestId: promotionRequest.sys_id
        });

        result.success = true;
        return result;
    },

    _previewUpdateSet: function() {
        // Preview what will change
        var contents = new UpdateSetManager().getUpdateSetContents(this.updateSetId);

        // Check for conflicts
        var conflicts = contents.filter(function(item) {
            return item.hasConflict;
        });

        return {
            success: true,
            changes: contents.length,
            conflicts: conflicts
        };
    },

    _applyUpdateSet: function() {
        var result = this.client.triggerDeployment({
            updateSetName: this.updateSetId
        });

        if (!result.success) {
            return result;
        }

        // Wait for completion
        return this.client.waitForCompletion(result.progressId, 300000);
    },

    _runATFTests: function() {
        var suiteId = this._getTestSuiteForUpdateSet();

        if (!suiteId) {
            return { success: true, message: 'No test suite configured' };
        }

        var runner = new sn_atf.ATFTestRunner();
        var result = runner.runTestSuite(suiteId);

        return {
            success: result.status === 'success',
            totalTests: result.total,
            passed: result.passed,
            failed: result.failed,
            duration: result.duration
        };
    },

    _runAPITests: function() {
        // Test any affected API endpoints
        return {
            success: true,
            endpoints: []
        };
    },

    _createPromotionRequest: function() {
        var gr = new GlideRecord('x_deployment_request');
        gr.initialize();
        gr.setValue('update_set', this.updateSetId);
        gr.setValue('source_environment', 'test');
        gr.setValue('target_environment', 'stage');
        gr.setValue('status', 'pending_approval');
        return { sys_id: gr.insert() };
    },

    _rollback: function() {
        this.client.rollback(this.updateSetId);
    },

    _failed: function(result, reason) {
        result.success = false;
        result.error = reason;
        return result;
    },

    _requiresReview: function(result, reason) {
        result.success = false;
        result.requiresReview = true;
        result.error = reason;
        return result;
    },

    _getTestSuiteForUpdateSet: function() {
        // Find associated test suite
        return null;
    },

    type: 'TestDeployment'
};
```

---

## Stage 3: Staging Environment

### Staging Deployment with Approval

```javascript
/**
 * Staging deployment with approval workflow
 */
var StageDeployment = Class.create();
StageDeployment.prototype = {
    initialize: function(promotionRequestId) {
        this.requestId = promotionRequestId;
        this.approvalRequired = true;
    },

    /**
     * Check if deployment can proceed
     */
    canProceed: function() {
        var gr = new GlideRecord('x_deployment_request');
        if (!gr.get(this.requestId)) {
            return { allowed: false, reason: 'Request not found' };
        }

        // Check approval status
        if (gr.getValue('status') !== 'approved') {
            return {
                allowed: false,
                reason: 'Approval required',
                approvers: this._getPendingApprovers()
            };
        }

        return { allowed: true };
    },

    execute: function() {
        var result = {
            stage: 'staging',
            requestId: this.requestId,
            steps: []
        };

        // Check approval
        var canProceed = this.canProceed();
        if (!canProceed.allowed) {
            return {
                success: false,
                waitingForApproval: true,
                approvers: canProceed.approvers
            };
        }

        // Step 1: Backup current state
        var backup = this._createBackupPoint();
        result.steps.push({
            name: 'Create Backup',
            success: backup.success,
            backupId: backup.backupId
        });

        // Step 2: Apply changes
        var apply = this._applyChanges();
        result.steps.push({
            name: 'Apply Changes',
            success: apply.success
        });

        // Step 3: Run load tests
        var loadTests = this._runLoadTests();
        result.steps.push({
            name: 'Load Tests',
            success: loadTests.success,
            metrics: loadTests.metrics
        });

        // Step 4: Security scan
        var security = this._runSecurityScan();
        result.steps.push({
            name: 'Security Scan',
            success: security.success,
            vulnerabilities: security.vulnerabilities
        });

        if (security.vulnerabilities.high > 0) {
            // Rollback and require fixes
            this._restoreBackup(backup.backupId);
            return this._failed(result, 'High severity vulnerabilities found');
        }

        // Step 5: Create production deployment request
        var prodRequest = this._createProductionRequest();
        result.steps.push({
            name: 'Production Request',
            success: true,
            requestId: prodRequest.sys_id,
            changeRequired: true
        });

        result.success = true;
        return result;
    },

    _getPendingApprovers: function() {
        return PipelineConfig.environments.stage.requiredApprovers;
    },

    _createBackupPoint: function() {
        // Create restoration point
        return { success: true, backupId: 'backup_' + Date.now() };
    },

    _applyChanges: function() {
        var client = new CICDPipelineClient({
            targetInstance: PipelineConfig.environments.stage.instance
        });
        return { success: true };
    },

    _runLoadTests: function() {
        // Simulate load testing
        return {
            success: true,
            metrics: {
                avgResponseTime: 150,
                p95ResponseTime: 350,
                throughput: 100,
                errorRate: 0.01
            }
        };
    },

    _runSecurityScan: function() {
        // Security scanning
        return {
            success: true,
            vulnerabilities: {
                high: 0,
                medium: 2,
                low: 5
            }
        };
    },

    _restoreBackup: function(backupId) {
        gs.info('Restoring backup: ' + backupId);
    },

    _createProductionRequest: function() {
        var gr = new GlideRecord('x_deployment_request');
        gr.initialize();
        gr.setValue('source_environment', 'stage');
        gr.setValue('target_environment', 'prod');
        gr.setValue('status', 'pending_change');
        return { sys_id: gr.insert() };
    },

    _failed: function(result, reason) {
        result.success = false;
        result.error = reason;
        return result;
    },

    type: 'StageDeployment'
};
```

---

## Stage 4: Production Deployment

### Production Deployment with Change Management

```javascript
/**
 * Production deployment with full change management
 */
var ProductionDeployment = Class.create();
ProductionDeployment.prototype = {
    initialize: function(deploymentRequestId) {
        this.requestId = deploymentRequestId;
        this.changeTicket = null;
    },

    /**
     * Pre-deployment checklist
     */
    runPreDeploymentChecks: function() {
        var checks = [];

        // Check 1: Change ticket exists and approved
        checks.push(this._checkChangeTicket());

        // Check 2: Maintenance window active
        checks.push(this._checkMaintenanceWindow());

        // Check 3: Required approvals
        checks.push(this._checkApprovals());

        // Check 4: Rollback plan documented
        checks.push(this._checkRollbackPlan());

        // Check 5: Communication sent
        checks.push(this._checkCommunication());

        var failed = checks.filter(function(c) { return !c.passed; });

        return {
            canProceed: failed.length === 0,
            checks: checks
        };
    },

    execute: function() {
        var result = {
            stage: 'production',
            requestId: this.requestId,
            steps: []
        };

        // Pre-deployment checks
        var preChecks = this.runPreDeploymentChecks();
        result.steps.push({
            name: 'Pre-Deployment Checks',
            success: preChecks.canProceed,
            checks: preChecks.checks
        });

        if (!preChecks.canProceed) {
            return this._blocked(result, 'Pre-deployment checks failed');
        }

        // Start change implementation
        this._updateChangeState('implement');

        // Step 1: Enable maintenance mode (optional)
        var maintenance = this._enableMaintenanceMode();
        result.steps.push({
            name: 'Maintenance Mode',
            success: maintenance.success,
            enabled: maintenance.enabled
        });

        // Step 2: Create rollback snapshot
        var snapshot = this._createSnapshot();
        result.steps.push({
            name: 'Create Snapshot',
            success: snapshot.success,
            snapshotId: snapshot.snapshotId
        });

        // Step 3: Apply changes
        var apply = this._applyChanges();
        result.steps.push({
            name: 'Apply Changes',
            success: apply.success,
            duration: apply.duration
        });

        if (!apply.success) {
            // Immediate rollback
            this._rollback(snapshot.snapshotId);
            this._updateChangeState('failed');
            return this._failed(result, 'Deployment failed - rolled back');
        }

        // Step 4: Smoke tests
        var smoke = this._runSmokeTests();
        result.steps.push({
            name: 'Smoke Tests',
            success: smoke.success,
            results: smoke.results
        });

        if (!smoke.success) {
            // Rollback on smoke test failure
            this._rollback(snapshot.snapshotId);
            this._updateChangeState('failed');
            return this._failed(result, 'Smoke tests failed - rolled back');
        }

        // Step 5: Disable maintenance mode
        this._disableMaintenanceMode();
        result.steps.push({
            name: 'Disable Maintenance',
            success: true
        });

        // Step 6: Monitor for issues (async)
        this._startMonitoring();
        result.steps.push({
            name: 'Start Monitoring',
            success: true,
            monitoringPeriod: '30 minutes'
        });

        // Update change to complete
        this._updateChangeState('complete');

        result.success = true;
        result.changeTicket = this.changeTicket;
        return result;
    },

    _checkChangeTicket: function() {
        var gr = new GlideRecord('change_request');
        gr.addQuery('correlation_id', this.requestId);
        gr.addQuery('state', '2'); // Scheduled
        gr.query();

        if (gr.next()) {
            this.changeTicket = gr.getValue('number');
            return {
                name: 'Change Ticket',
                passed: true,
                changeNumber: this.changeTicket
            };
        }

        return {
            name: 'Change Ticket',
            passed: false,
            reason: 'No approved change ticket found'
        };
    },

    _checkMaintenanceWindow: function() {
        // Check if current time is within maintenance window
        var now = new GlideDateTime();
        var dayOfWeek = now.getDayOfWeek();
        var hour = now.getLocalTime().getHour();

        // Example: Sunday 2-6 AM
        var inWindow = (dayOfWeek === 1 && hour >= 2 && hour < 6);

        return {
            name: 'Maintenance Window',
            passed: inWindow,
            reason: inWindow ? 'Within window' : 'Outside maintenance window'
        };
    },

    _checkApprovals: function() {
        var requiredApprovers = PipelineConfig.environments.prod.requiredApprovers;
        // Verify all approvals obtained
        return {
            name: 'Approvals',
            passed: true,
            approvers: requiredApprovers
        };
    },

    _checkRollbackPlan: function() {
        return {
            name: 'Rollback Plan',
            passed: true,
            documented: true
        };
    },

    _checkCommunication: function() {
        return {
            name: 'Communication',
            passed: true,
            notified: ['stakeholders', 'support-team']
        };
    },

    _updateChangeState: function(state) {
        if (!this.changeTicket) return;

        var gr = new GlideRecord('change_request');
        gr.addQuery('number', this.changeTicket);
        gr.query();
        if (gr.next()) {
            var stateMap = {
                'implement': '3',
                'complete': '7',
                'failed': '4'
            };
            gr.setValue('state', stateMap[state]);
            gr.update();
        }
    },

    _enableMaintenanceMode: function() {
        // Implementation depends on requirements
        return { success: true, enabled: false };
    },

    _disableMaintenanceMode: function() {
        return { success: true };
    },

    _createSnapshot: function() {
        return {
            success: true,
            snapshotId: 'snap_' + Date.now()
        };
    },

    _applyChanges: function() {
        var client = new CICDPipelineClient({
            targetInstance: PipelineConfig.environments.prod.instance
        });

        var start = Date.now();
        var result = { success: true };
        result.duration = Date.now() - start;

        return result;
    },

    _runSmokeTests: function() {
        return {
            success: true,
            results: {
                total: 5,
                passed: 5,
                failed: 0
            }
        };
    },

    _rollback: function(snapshotId) {
        gs.info('Rolling back to snapshot: ' + snapshotId);
    },

    _startMonitoring: function() {
        // Start monitoring job
        gs.eventQueue('deployment.monitor', null, this.requestId, '30');
    },

    _blocked: function(result, reason) {
        result.success = false;
        result.blocked = true;
        result.error = reason;
        return result;
    },

    _failed: function(result, reason) {
        result.success = false;
        result.error = reason;
        return result;
    },

    type: 'ProductionDeployment'
};
```

---

## Pipeline Orchestrator

```javascript
/**
 * Main pipeline orchestrator
 */
var PipelineOrchestrator = Class.create();
PipelineOrchestrator.prototype = {
    initialize: function() {},

    /**
     * Execute full pipeline from commit to production
     */
    executeFullPipeline: function(commitInfo) {
        var results = [];

        // Stage 1: Development
        gs.info('=== Stage 1: Development ===');
        var dev = new DevDeployment(commitInfo);
        var devResult = dev.execute();
        results.push(devResult);

        if (!devResult.success) {
            return this._pipelineFailed(results, 'development');
        }

        // Stage 2: Test (automatic)
        gs.info('=== Stage 2: Test ===');
        var test = new TestDeployment(devResult.updateSetId);
        var testResult = test.execute();
        results.push(testResult);

        if (!testResult.success) {
            return this._pipelineFailed(results, 'test');
        }

        // Stage 3: Staging (requires approval)
        gs.info('=== Stage 3: Staging ===');
        var stage = new StageDeployment(testResult.promotionRequestId);
        var stageResult = stage.execute();
        results.push(stageResult);

        if (stageResult.waitingForApproval) {
            return {
                success: true,
                status: 'waiting_approval',
                stage: 'staging',
                results: results
            };
        }

        if (!stageResult.success) {
            return this._pipelineFailed(results, 'staging');
        }

        // Stage 4: Production (requires change ticket)
        gs.info('=== Stage 4: Production ===');
        var prod = new ProductionDeployment(stageResult.productionRequestId);
        var prodResult = prod.execute();
        results.push(prodResult);

        if (prodResult.blocked) {
            return {
                success: true,
                status: 'blocked',
                stage: 'production',
                reason: prodResult.error,
                results: results
            };
        }

        if (!prodResult.success) {
            return this._pipelineFailed(results, 'production');
        }

        return {
            success: true,
            status: 'completed',
            changeTicket: prodResult.changeTicket,
            results: results
        };
    },

    _pipelineFailed: function(results, stage) {
        return {
            success: false,
            status: 'failed',
            failedStage: stage,
            results: results
        };
    },

    type: 'PipelineOrchestrator'
};
```

---

*Part of the deployment-automation skill*
