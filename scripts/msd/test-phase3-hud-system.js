/**
 * Phase 3: HUD System Port - Test Suite
 * Tests essential development HUD functionality ported from cb-lcars-dev-hud-monolithic.js
 *
 * Priority: 🟡 High - Development workflow essential
 */

import { setupDomPolyfill, createMockContainer } from './test-utils/dom-polyfill.js';

setupDomPolyfill();

class Phase3HudSystemTests {
  constructor() {
    this.results = [];
  }

  async runAllTests() {
    console.log('🧪 Phase 3: HUD System Port - Essential Development Features');
    console.log('━'.repeat(60));

    await this.testHudManagerCore();
    await this.testPerformanceMonitoring();
    await this.testValidationDisplay();
    await this.testRoutingInspection();
    await this.testHudIntegration();

    return this.generateSummary();
  }

  async testHudManagerCore() {
    const test = { name: 'MsdHudManager Core Functionality', passed: false };

    try {
      const { MsdHudManager } = await import('../../src/msd/hud/MsdHudManager.js');

      const hudManager = new MsdHudManager();

      // Test HUD visibility control
      if (hudManager.state.visible !== false) {
        throw new Error('HUD should start hidden');
      }

      hudManager.show();
      if (!hudManager.state.visible) {
        throw new Error('HUD should be visible after show()');
      }

      hudManager.hide();
      if (hudManager.state.visible) {
        throw new Error('HUD should be hidden after hide()');
      }

      hudManager.toggle();
      if (!hudManager.state.visible) {
        throw new Error('HUD should be visible after toggle()');
      }

      // Test HUD mount creation
      hudManager.show();
      const mount = hudManager.getMount();
      if (!mount || mount.id !== 'msd-hud-root') {
        throw new Error('HUD mount not created properly');
      }

      // Test snapshot building
      const snapshot = hudManager.buildSnapshot();
      if (!snapshot || !snapshot.timestamp) {
        throw new Error('HUD snapshot building failed');
      }

      if (!snapshot.performance || !snapshot.pipeline) {
        throw new Error('HUD snapshot missing required sections');
      }

      test.passed = true;
      test.metrics = {
        hudMountCreated: !!mount,
        snapshotValid: !!snapshot,
        visibilityControls: 'working'
      };

    } catch (error) {
      test.error = error.message;
      test.expected = 'HUD manager with visibility controls, mount creation, and snapshot building';
    }

    this.results.push(test);
  }

  async testPerformanceMonitoring() {
    const test = { name: 'Performance Monitoring System', passed: false };

    try {
      const { PerformancePanel } = await import('../../src/msd/hud/panels/PerformancePanel.js');

      // Mock performance data
      const mockPerformance = {
        timers: {
          'pipeline.total': { count: 5, total: 250, avg: 50, last: 45, max: 75 },
          'rules.evaluate': { count: 10, total: 120, avg: 12, last: 15, max: 20 }
        },
        counters: {
          'overlays.rendered': 25,
          'rules.executed': 8,
          'cache.hits': 42
        }
      };

      const panel = new PerformancePanel();

      // Test HTML generation
      const html = panel.renderHtml(mockPerformance);
      if (!html || !html.includes('Performance')) {
        throw new Error('Performance panel HTML generation failed');
      }

      if (!html.includes('pipeline.total') || !html.includes('50.00ms')) {
        throw new Error('Timer data not rendered correctly');
      }

      if (!html.includes('overlays.rendered') || !html.includes('25')) {
        throw new Error('Counter data not rendered correctly');
      }

      // Test data capture
      global.window = global.window || {};
      global.window.__msdDebug = {
        getPerf: () => ({
          timers: mockPerformance.timers,
          counters: mockPerformance.counters
        })
      };

      const captured = panel.captureData();
      if (!captured || !captured.timers || !captured.counters) {
        throw new Error('Performance data capture failed');
      }

      test.passed = true;
      test.metrics = {
        htmlGeneration: 'working',
        dataCapture: 'working',
        timerDisplay: 'formatted',
        counterDisplay: 'formatted'
      };

    } catch (error) {
      test.error = error.message;
      test.expected = 'Performance monitoring with timer/counter display and data capture';
    }

    this.results.push(test);
  }

  async testValidationDisplay() {
    const test = { name: 'Validation Display System', passed: false };

    try {
      const { ValidationPanel } = await import('../../src/msd/hud/panels/ValidationPanel.js');

      // Mock validation data
      const mockValidation = {
        issues: [
          { severity: 'error', message: 'Missing anchor: cpu_temp', code: 'ANCHOR_MISSING' },
          { severity: 'warning', message: 'Unused anchor: old_sensor', code: 'ANCHOR_UNUSED' },
          { severity: 'error', message: 'Invalid overlay position', code: 'POSITION_INVALID' }
        ],
        count: 3
      };

      const panel = new ValidationPanel();

      // Test HTML generation
      const html = panel.renderHtml(mockValidation);
      if (!html || !html.includes('Validation')) {
        throw new Error('Validation panel HTML generation failed');
      }

      if (!html.includes('Missing anchor: cpu_temp')) {
        throw new Error('Error messages not rendered correctly');
      }

      if (!html.includes('3 issues')) {
        throw new Error('Issue count not displayed');
      }

      // Test severity styling
      if (!html.includes('error') || !html.includes('warning')) {
        throw new Error('Severity levels not handled properly');
      }

      // Test empty state
      const emptyHtml = panel.renderHtml({ issues: [], count: 0 });
      if (!emptyHtml.includes('No validation issues')) {
        throw new Error('Empty state not handled properly');
      }

      test.passed = true;
      test.metrics = {
        htmlGeneration: 'working',
        errorDisplay: 'formatted',
        severityHandling: 'working',
        emptyState: 'working'
      };

    } catch (error) {
      test.error = error.message;
      test.expected = 'Validation display with error/warning formatting and empty states';
    }

    this.results.push(test);
  }

  async testRoutingInspection() {
    const test = { name: 'Routing Inspection System', passed: false };

    try {
      const { RoutingPanel } = await import('../../src/msd/hud/panels/RoutingPanel.js');

      // Mock routing data
      const mockRouting = {
        routes: [
          { id: 'line_cpu', strategy: 'manhattan', cost: 42.5, success: true },
          { id: 'line_memory', strategy: 'direct', cost: 15.2, success: true },
          { id: 'line_failed', strategy: 'manhattan', cost: 999, success: false }
        ],
        count: 3
      };

      const panel = new RoutingPanel();

      // Test HTML generation
      const html = panel.renderHtml(mockRouting);
      if (!html || !html.includes('Routing')) {
        throw new Error('Routing panel HTML generation failed');
      }

      if (!html.includes('line_cpu') || !html.includes('manhattan')) {
        throw new Error('Route data not rendered correctly');
      }

      if (!html.includes('42.5') || !html.includes('15.2')) {
        throw new Error('Route costs not displayed');
      }

      // Test success/failure indicators
      if (!html.includes('success') || !html.includes('failed')) {
        throw new Error('Route success status not indicated');
      }

      // Test route limit (should handle large numbers gracefully)
      const manyRoutes = {
        routes: Array(20).fill().map((_, i) => ({
          id: `line_${i}`, strategy: 'manhattan', cost: i * 10, success: true
        })),
        count: 20
      };

      const limitedHtml = panel.renderHtml(manyRoutes);
      // Should limit display to prevent UI bloat
      const routeCount = (limitedHtml.match(/line_\d+/g) || []).length;
      if (routeCount > 10) {
        throw new Error('Route display not limited properly');
      }

      test.passed = true;
      test.metrics = {
        htmlGeneration: 'working',
        routeDisplay: 'formatted',
        costDisplay: 'working',
        successIndicators: 'working',
        routeLimiting: 'working'
      };

    } catch (error) {
      test.error = error.message;
      test.expected = 'Routing inspection with cost display, success indicators, and route limiting';
    }

    this.results.push(test);
  }

  async testHudIntegration() {
    const test = { name: 'Complete HUD Integration', passed: false };

    try {
      const { MsdHudManager } = await import('../../src/msd/hud/MsdHudManager.js');

      // Mock complete MSD debug environment
      global.window = global.window || {};
      global.window.__msdDebug = {
        pipelineInstance: {
          getResolvedModel: () => ({
            overlays: [
              { id: 'test1', type: 'text' },
              { id: 'test2', type: 'sparkline' }
            ],
            anchors: { cpu: [100, 100], mem: [200, 200] },
            rules: [{ id: 'rule1' }]
          })
        },
        getPerf: () => ({
          timers: { 'test.timer': { count: 1, total: 50, avg: 50 } },
          counters: { 'test.counter': 10 }
        }),
        validation: {
          issues: () => [
            { severity: 'warning', message: 'Test warning' }
          ]
        },
        routing: {
          inspect: (id) => ({
            meta: { strategy: 'manhattan', cost: 25, success: true }
          })
        }
      };

      const hudManager = new MsdHudManager();

      // Test complete snapshot building
      hudManager.show();
      const snapshot = hudManager.buildSnapshot();

      if (!snapshot.performance || !snapshot.validation || !snapshot.routing) {
        throw new Error('Complete snapshot not built properly');
      }

      if (snapshot.pipeline.overlayCount !== 2) {
        throw new Error('Pipeline data not captured correctly');
      }

      if (snapshot.validation.issues.length !== 1) {
        throw new Error('Validation data not captured correctly');
      }

      // Test refresh cycle
      let refreshCalled = false;
      const originalRefresh = hudManager.refresh;
      hudManager.refresh = function() {
        refreshCalled = true;
        return originalRefresh.call(this);
      };

      hudManager.startRefreshLoop();

      // Wait for at least one refresh cycle - FIXED: Longer timeout and immediate check
      await new Promise(resolve => {
        hudManager.state.interval = 50; // Faster for testing

        // Check immediately (startRefreshLoop now calls refresh immediately)
        if (refreshCalled) {
          hudManager.stopRefreshLoop();
          resolve();
          return;
        }

        // Fallback: wait for timer-based refresh
        setTimeout(() => {
          hudManager.stopRefreshLoop();
          resolve();
        }, 100); // Longer timeout to ensure execution
      });

      if (!refreshCalled) {
        throw new Error('Refresh loop not working');
      }

      test.passed = true;
      test.metrics = {
        snapshotComplete: 'all sections captured',
        refreshLoop: 'working',
        dataIntegration: 'complete',
        performanceData: !!snapshot.performance.timers,
        validationData: snapshot.validation.issues.length,
        routingData: snapshot.routing.count
      };

    } catch (error) {
      test.error = error.message;
      test.expected = 'Complete HUD integration with all data sources and refresh cycle';
    }

    this.results.push(test);
  }

  generateSummary() {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const failed = this.results.filter(r => !r.passed);

    console.log('\n🏆 Phase 3: HUD System Port Test Results');
    console.log('━'.repeat(60));
    console.log(`Status: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log('✅ ALL HUD TESTS PASSED');
      console.log('🎯 Phase 3 HUD System is COMPLETE and ready for production');
      console.log('\n📋 HUD System Features Verified:');
      console.log('  • MsdHudManager: Core visibility, mounting, snapshot building');
      console.log('  • PerformancePanel: Timer/counter display with data capture');
      console.log('  • ValidationPanel: Error/warning display with severity handling');
      console.log('  • RoutingPanel: Route inspection with cost and success indicators');
      console.log('  • Complete Integration: All panels working with refresh cycle');
    } else {
      console.log('\n❌ FAILING TESTS:');
      failed.forEach(test => {
        console.log(`\n🔴 ${test.name}`);
        console.log(`   Error: ${test.error}`);
        if (test.expected) {
          console.log(`   Expected: ${test.expected}`);
        }
      });
    }

    console.log('\n📊 Next Steps:');
    if (passed === total) {
      console.log('✅ Ready to proceed to Phase 4: Controls Integration & API Finalization');
      console.log('1. Create MsdControlsRenderer for Home Assistant card embedding');
      console.log('2. Implement unified MsdApi with namespace takeover');
      console.log('3. Complete feature parity validation and cutover preparation');
    } else {
      console.log('🔧 Fix failing HUD tests before proceeding to Phase 4');
    }

    return {
      passed: passed === total,
      results: this.results,
      summary: { total, passed, failed: total - passed }
    };
  }
}

// Run tests
const suite = new Phase3HudSystemTests();
suite.runAllTests().then(results => {
  process.exit(results.passed ? 0 : 1);
});

