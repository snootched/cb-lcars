/**
 * Style Merge Pipeline Test Suite - FIXED
 * Tests the complete style resolution and merge pipeline from config to final rendering
 *
 * This test suite specifically addresses the overlay style merging issue where
 * config styles (font_size: 78, color: var(--lcars-blue)) are being overridden
 * by renderer fallbacks (font_size: 16/14, color: var(--lcars-orange))
 *
 * Priority: 🔴 CRITICAL - Addresses style merge regression
 */

import { ProfileResolver } from '../../src/msd/profile/ProfileResolver.js';
import { TextOverlayRenderer } from '../../src/msd/renderer/TextOverlayRenderer.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';

// Mock performance utilities if not available
const perfTime = (name, fn) => fn();
const perfCount = (name, count) => {};

// Mock global performance namespace
if (typeof global !== 'undefined' && !global.__msdDebug) {
  global.__msdDebug = {
    getPerf: () => ({ timers: {}, counters: {} })
  };
}

class StyleMergePipelineTests {
  constructor() {
    this.results = [];
    this.testStartTime = null;
  }

  /**
   * Run all style merge pipeline tests
   */
  async runAllTests() {
    console.log('🧪 Style Merge Pipeline Tests - Config to Renderer');
    console.log('━'.repeat(60));

    // Test 1: Profile resolver precedence issue (CRITICAL)
    await this.testProfileResolverPrecedenceIssue();

    // Test 2: Style precedence order verification
    await this.testStylePrecedenceOrder();

    // Test 3: mergePacks structure compatibility
    await this.testMergePacksCompatibility();

    // Test 4: Complete pipeline integration
    await this.testCompletePipelineIntegration();

    // Test 5: Renderer fallback behavior
    await this.testRendererFallbackBehavior();

    // Test 6: Real-world config reproduction
    await this.testRealWorldConfigReproduction();

    return this.generateSummary();
  }

  /**
   * Test 1: CRITICAL - Profile resolver precedence is inverted!
   */
  async testProfileResolverPrecedenceIssue() {
    const test = { name: 'ProfileResolver Precedence Issue (CRITICAL)', passed: false };
    this.testStartTime = performance.now();

    try {
      const resolver = new ProfileResolver();

      // Load a profile with conflicting defaults
      const profiles = [
        {
          id: 'normal',
          defaults: {
            text: {
              color: 'var(--lcars-orange)',
              font_size: 14  // This should NOT override overlay config
            }
          }
        }
      ];

      resolver.loadProfiles(profiles);
      resolver.setActiveProfiles(['normal']);

      // Test overlay with specific config that should WIN
      const overlay = {
        id: 'title_overlay',
        type: 'text',
        style: {
          value: 'MSD v1 COMPREHENSIVE TEST',
          color: 'var(--lcars-blue)',    // Should win over profile orange
          font_size: 78                  // Should win over profile 14
        }
      };

      const resolvedStyle = resolver.resolveOverlayStyle(overlay);

      console.log('🔍 Debug - Profile Precedence Test:');
      console.log('  Input overlay style:', overlay.style);
      console.log('  Profile defaults:', profiles[0].defaults.text);
      console.log('  Resolved style:', resolvedStyle);

      if (resolvedStyle.__styleProvenance) {
        console.log('  Style provenance:', Object.entries(resolvedStyle.__styleProvenance).map(([prop, prov]) =>
          `${prop}: ${prov.source}(${prov.precedence})`).join(', '));
      }

      // CRITICAL CHECK: Overlay config should override profile defaults
      if (resolvedStyle.color !== 'var(--lcars-blue)') {
        throw new Error(`PRECEDENCE BUG: Overlay color should override profile default. Expected: 'var(--lcars-blue)', Got: '${resolvedStyle.color}'`);
      }

      if (resolvedStyle.font_size !== 78) {
        throw new Error(`PRECEDENCE BUG: Overlay font_size should override profile default. Expected: 78, Got: ${resolvedStyle.font_size}`);
      }

      // Check the layers to understand precedence
      const layers = resolver.buildStyleLayers(overlay);
      console.log('  Style layers:', layers.map(l => `${l.source}(${l.precedence})`));

      // CRITICAL: Overlay should have HIGHER precedence than profiles
      const overlayLayer = layers.find(l => l.source === 'overlay');
      const profileLayer = layers.find(l => l.source === 'profile');

      if (overlayLayer && profileLayer && overlayLayer.precedence < profileLayer.precedence) {
        throw new Error(`PRECEDENCE BUG: Overlay precedence (${overlayLayer.precedence}) should be HIGHER than profile precedence (${profileLayer.precedence})`);
      }

      test.passed = true;
      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        layerCount: layers.length,
        overlayPrecedence: overlayLayer?.precedence,
        profilePrecedence: profileLayer?.precedence,
        precedenceCorrect: true
      };

    } catch (error) {
      test.error = error.message;
      test.expected = 'Overlay styles should have HIGHER precedence than profile defaults';
    }

    this.results.push(test);
  }

  /**
   * Test 2: Style precedence order verification
   */
  async testStylePrecedenceOrder() {
    const test = { name: 'Style Precedence Order Verification', passed: false };
    this.testStartTime = performance.now();

    try {
      const resolver = new ProfileResolver();

      // Create overlapping styles at different levels
      const profiles = [
        {
          id: 'profile1',
          defaults: { text: { color: 'red', font_size: 12 } }
        },
        {
          id: 'profile2',
          defaults: { text: { color: 'green', font_size: 14 } }
        }
      ];

      resolver.loadProfiles(profiles);
      resolver.setActiveProfiles(['profile1', 'profile2']); // profile2 later, wins among profiles

      const overlay = {
        id: 'test_text',
        type: 'text',
        style: {
          color: 'blue',        // overlay should win over all profiles
          font_size: 20         // overlay should win over all profiles
        }
      };

      const resolved = resolver.resolveOverlayStyle(overlay);

      console.log('🔍 Debug - Precedence Order Test:');
      console.log('  Expected: overlay(blue,20) > profile2(green,14) > profile1(red,12)');
      console.log('  Resolved:', { color: resolved.color, font_size: resolved.font_size });

      // Overlay should win everything
      if (resolved.color !== 'blue') {
        throw new Error(`Precedence failed: overlay should win. Expected: 'blue', Got: '${resolved.color}'`);
      }

      if (resolved.font_size !== 20) {
        throw new Error(`Precedence failed: overlay should win. Expected: 20, Got: ${resolved.font_size}`);
      }

      test.passed = true;
      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        finalColor: resolved.color,
        finalFontSize: resolved.font_size,
        precedenceWorking: true
      };

    } catch (error) {
      test.error = error.message;
      test.expected = 'Overlay styles should win over all profile styles';
    }

    this.results.push(test);
  }

  /**
   * Test 3: mergePacks structure compatibility
   */
  async testMergePacksCompatibility() {
    const test = { name: 'mergePacks Structure Compatibility', passed: false };
    this.testStartTime = performance.now();

    try {
      // Create proper user config structure for mergePacks
      const userConfig = {
        version: 1,
        use_packs: {
          builtin: [] // No builtin packs to avoid dependencies
        },
        overlays: [
          {
            id: 'title_overlay',
            type: 'text',
            position: [50, 50],
            style: {
              value: 'MSD v1 COMPREHENSIVE TEST',
              color: 'var(--lcars-blue)',
              font_size: 78,
              font_weight: 'bold'
            }
          }
        ],
        profiles: [
          {
            id: 'normal',
            defaults: {
              text: {
                color: 'var(--lcars-orange)',
                font_size: 14
              }
            }
          }
        ],
        active_profiles: ['normal']
      };

      console.log('🔍 Debug - Testing mergePacks with user config...');

      const merged = await mergePacks(userConfig);

      console.log('  Merged result structure:', Object.keys(merged));
      console.log('  Overlays count:', merged.overlays?.length);
      console.log('  Profiles count:', merged.profiles?.length);

      if (!merged.overlays || merged.overlays.length === 0) {
        throw new Error('mergePacks did not preserve overlays');
      }

      const overlay = merged.overlays.find(o => o.id === 'title_overlay');
      if (!overlay) {
        throw new Error('title_overlay not found after pack merge');
      }

      // Critical: mergePacks should preserve overlay style exactly
      if (!overlay.style) {
        throw new Error('Overlay style missing after pack merge');
      }

      if (overlay.style.font_size !== 78) {
        throw new Error(`Pack merge corrupted font_size: expected 78, got ${overlay.style.font_size}`);
      }

      if (overlay.style.color !== 'var(--lcars-blue)') {
        throw new Error(`Pack merge corrupted color: expected 'var(--lcars-blue)', got '${overlay.style.color}'`);
      }

      test.passed = true;
      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        overlaysPreserved: merged.overlays.length,
        profilesPreserved: merged.profiles.length,
        styleIntegrity: true
      };

    } catch (error) {
      test.error = error.message;
      test.expected = 'mergePacks should preserve overlay styles exactly as configured';
    }

    this.results.push(test);
  }

  /**
   * Test 4: Complete pipeline integration
   */
  async testCompletePipelineIntegration() {
    const test = { name: 'Complete Pipeline Integration', passed: false };
    this.testStartTime = performance.now();

    try {
      // Start with user config
      const userConfig = {
        version: 1,
        use_packs: { builtin: [] },
        overlays: [
          {
            id: 'title_overlay',
            type: 'text',
            position: [50, 50],
            style: {
              value: 'MSD v1 COMPREHENSIVE TEST',
              color: 'var(--lcars-blue)',
              font_size: 78,
              font_weight: 'bold'
            }
          }
        ],
        profiles: [
          {
            id: 'normal',
            defaults: { text: { color: 'var(--lcars-orange)', font_size: 14 } }
          }
        ],
        active_profiles: ['normal']
      };

      console.log('🔍 Debug - Complete Pipeline Test:');

      // Step 1: Pack merge
      const merged = await mergePacks(userConfig);
      const overlay = merged.overlays.find(o => o.id === 'title_overlay');
      console.log('  1. After mergePacks:', {
        font_size: overlay.style.font_size,
        color: overlay.style.color
      });

      // Step 2: Profile resolution
      const resolver = new ProfileResolver();
      resolver.loadProfiles(merged.profiles);
      resolver.setActiveProfiles(merged.active_profiles);

      const resolvedStyle = resolver.resolveOverlayStyle(overlay);
      console.log('  2. After ProfileResolver:', {
        font_size: resolvedStyle.font_size,
        color: resolvedStyle.color
      });

      // Critical checks after profile resolution
      if (resolvedStyle.color !== 'var(--lcars-blue)') {
        throw new Error(`Pipeline corrupted color: expected 'var(--lcars-blue)', got '${resolvedStyle.color}'`);
      }

      if (resolvedStyle.font_size !== 78) {
        throw new Error(`Pipeline corrupted font_size: expected 78, got ${resolvedStyle.font_size}`);
      }

      // Step 3: Create resolved overlay for renderer
      const resolvedOverlay = {
        ...overlay,
        style: resolvedStyle,
        finalStyle: { ...resolvedStyle }
      };

      // Step 4: Renderer
      const mockAnchors = new Map([['50', [50, 50]]]);
      const rendered = TextOverlayRenderer.render(resolvedOverlay, mockAnchors, [0, 0, 800, 600]);

      console.log('  3. Rendered SVG contains:', {
        fontSize78: rendered.includes('font-size="78"'),
        colorBlue: rendered.includes('fill="var(--lcars-blue)"'),
        fontWeightBold: rendered.includes('font-weight="bold"')
      });

      // Final verification
      if (!rendered.includes('font-size="78"')) {
        throw new Error('Complete pipeline failed: Renderer lost font_size=78');
      }

      if (!rendered.includes('fill="var(--lcars-blue)"')) {
        throw new Error('Complete pipeline failed: Renderer lost color=var(--lcars-blue)');
      }

      test.passed = true;
      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        pipelineStages: 4,
        finalAttributes: {
          fontSize: '78',
          color: 'var(--lcars-blue)',
          fontWeight: 'bold'
        }
      };

    } catch (error) {
      test.error = error.message;
      test.expected = 'Complete pipeline should preserve config styles through all stages';
    }

    this.results.push(test);
  }

  /**
   * Test 5: Renderer fallback behavior analysis
   */
  async testRendererFallbackBehavior() {
    const test = { name: 'Renderer Fallback Behavior Analysis', passed: false };
    this.testStartTime = performance.now();

    try {
      const mockAnchors = new Map([['50', [50, 50]]]);

      console.log('🔍 Debug - Renderer Fallback Analysis:');

      // Test 1: Complete style (should NOT use fallbacks)
      const overlayComplete = {
        id: 'complete',
        type: 'text',
        position: [50, 50],
        finalStyle: {
          value: 'Test Text',
          color: 'var(--lcars-blue)',
          font_size: 78
        }
      };

      let rendered = TextOverlayRenderer.render(overlayComplete, mockAnchors, [0, 0, 800, 600]);
      console.log('  Complete style result:', {
        fontSize78: rendered.includes('font-size="78"'),
        colorBlue: rendered.includes('fill="var(--lcars-blue)"')
      });

      // Test 2: Missing style (should use fallbacks)
      const overlayMissing = {
        id: 'missing',
        type: 'text',
        position: [50, 50],
        style: { value: 'Test Text' }
        // Missing finalStyle, color, font_size
      };

      rendered = TextOverlayRenderer.render(overlayMissing, mockAnchors, [0, 0, 800, 600]);
      console.log('  Missing style result:', {
        fontSize16: rendered.includes('font-size="16"'),
        colorOrange: rendered.includes('fill="var(--lcars-orange)"')
      });

      // Test 3: Null values (problematic case that might trigger fallbacks incorrectly)
      const overlayNulls = {
        id: 'nulls',
        type: 'text',
        position: [50, 50],
        style: {
          value: 'Test Text',
          color: null,
          font_size: undefined
        }
      };

      rendered = TextOverlayRenderer.render(overlayNulls, mockAnchors, [0, 0, 800, 600]);
      console.log('  Null values result:', {
        fontSize16: rendered.includes('font-size="16"'),
        colorOrange: rendered.includes('fill="var(--lcars-orange)"')
      });

      // This test always passes - it's diagnostic
      test.passed = true;
      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        fallbackBehaviorAnalyzed: true
      };

    } catch (error) {
      test.error = error.message;
      test.expected = 'Analyze renderer fallback behavior for debugging';
    }

    this.results.push(test);
  }

  /**
   * Test 6: Real-world config reproduction
   */
  async testRealWorldConfigReproduction() {
    const test = { name: 'Real-world Config Reproduction', passed: false };
    this.testStartTime = performance.now();

    try {
      console.log('🔍 Debug - Real-world Config Test:');

      // Exact reproduction of reported issue
      const userConfig = {
        version: 1,
        use_packs: { builtin: [] },
        overlays: [
          {
            id: 'title_overlay',
            type: 'text',
            position: [50, 50],
            style: {
              value: 'MSD v1 COMPREHENSIVE TEST',
              color: 'var(--lcars-blue)',
              font_size: 78,
              font_weight: 'bold'
            }
          }
        ],
        profiles: [
          {
            id: 'normal',
            defaults: {
              text: {
                color: 'var(--lcars-orange)',
                font_size: 14
              }
            }
          }
        ],
        active_profiles: ['normal']
      };

      console.log('  Input config overlay style:', userConfig.overlays[0].style);
      console.log('  Profile defaults:', userConfig.profiles[0].defaults.text);

      // Full pipeline
      const merged = await mergePacks(userConfig);
      const overlay = merged.overlays.find(o => o.id === 'title_overlay');

      const resolver = new ProfileResolver();
      resolver.loadProfiles(merged.profiles);
      resolver.setActiveProfiles(merged.active_profiles);

      const resolvedStyle = resolver.resolveOverlayStyle(overlay);
      console.log('  Resolved style:', resolvedStyle);

      const resolvedOverlay = {
        ...overlay,
        style: resolvedStyle,
        finalStyle: { ...resolvedStyle }
      };

      const mockAnchors = new Map([['50', [50, 50]]]);
      const rendered = TextOverlayRenderer.render(resolvedOverlay, mockAnchors, [0, 0, 800, 600]);

      console.log('  Final rendered attributes:', {
        fontSize: rendered.match(/font-size="(\d+)"/)?.[1],
        color: rendered.match(/fill="([^"]+)"/)?.[1],
        fontWeight: rendered.match(/font-weight="([^"]+)"/)?.[1]
      });

      // The critical assertion
      if (!rendered.includes('font-size="78"')) {
        throw new Error(`CRITICAL BUG: Expected font-size="78", but rendered: ${rendered.match(/font-size="(\d+)"/)?.[1] || 'NOT FOUND'}`);
      }

      if (!rendered.includes('fill="var(--lcars-blue)"')) {
        throw new Error(`CRITICAL BUG: Expected fill="var(--lcars-blue)", but rendered: ${rendered.match(/fill="([^"]+)"/)?.[1] || 'NOT FOUND'}`);
      }

      test.passed = true;
      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        configCorrect: true,
        pipelineCorrect: true,
        renderingCorrect: true
      };

    } catch (error) {
      test.error = error.message;
      test.expected = 'Real-world config should render exactly as specified';
    }

    this.results.push(test);
  }

  /**
   * Generate test summary
   */
  generateSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;

    console.log('\n📊 Style Merge Pipeline Test Results');
    console.log('━'.repeat(60));

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const time = result.metrics?.processingTime ? ` (${result.metrics.processingTime.toFixed(2)}ms)` : '';
      console.log(`${status} ${result.name}${time}`);

      if (!result.passed) {
        console.log(`   Error: ${result.error}`);
        console.log(`   Expected: ${result.expected}`);
      }
    });

    console.log('━'.repeat(60));
    console.log(`Results: ${passed}/${total} passed, ${failed} failed`);

    if (passed === total) {
      console.log('🎉 All style merge pipeline tests PASSED');
    } else {
      console.error('❌ Style merge pipeline test FAILED');

      // Identify the root cause
      const precedenceTest = this.results.find(r => r.name.includes('Precedence Issue'));
      if (precedenceTest && !precedenceTest.passed) {
        console.error('\n🚨 ROOT CAUSE IDENTIFIED:');
        console.error('   ProfileResolver has INVERTED precedence - profiles override overlay configs!');
        console.error('   FIX: Change ProfileResolver to give overlays higher precedence than profiles');
      }
    }

    return { passed: passed === total, error: failed > 0 ? `${failed}/${total} tests failed` : null };
  }
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const suite = new StyleMergePipelineTests();
  suite.runAllTests().then(results => {
    process.exit(results.passed ? 0 : 1);
  });
}

export { StyleMergePipelineTests };