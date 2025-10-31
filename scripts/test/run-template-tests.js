/**
 * Quick Template Processor Test Runner
 *
 * USAGE:
 * 1. Load your Home Assistant dashboard with cb-lcars card
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire file into the console
 * 4. Press Enter
 *
 * The tests will run and show results
 */

(function() {
  console.log('\n' + '🧪 TemplateProcessor Quick Test Runner'.padEnd(50, '='));
  console.log('='.repeat(50) + '\n');

  // Check if TemplateProcessor is available
  const TP = window.__templateProcessor;

  if (!TP) {
    console.error('❌ TemplateProcessor not found!');
    console.error('Make sure cb-lcars card is loaded first.');
    return;
  }

  console.log('✅ TemplateProcessor found\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      passed++;
      console.log(`✅ ${name}`);
    } catch (error) {
      failed++;
      console.error(`❌ ${name}: ${error.message}`);
    }
  }

  function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
  }

  // Quick smoke tests
  test('Detection: MSD templates', () => {
    assert(TP.hasTemplates('{cpu}'));
    assert(TP.hasMSDTemplates('{cpu}'));
  });

  test('Detection: HA templates', () => {
    assert(TP.hasTemplates('{{states("sensor.temp")}}'));
    assert(TP.hasHATemplates('{{states("sensor.temp")}}'));
  });

  test('Detection: Mixed templates', () => {
    assert(TP.hasTemplates('{cpu} and {{ha}}'));
  });

  test('Extraction: Simple MSD', () => {
    const refs = TP.extractReferences('{cpu_temp}');
    assert(refs.length === 1);
    assert(refs[0].dataSource === 'cpu_temp');
  });

  test('Extraction: MSD with path', () => {
    const refs = TP.extractReferences('{cpu.v}');
    assert(refs[0].path === 'v');
  });

  test('Extraction: MSD with format', () => {
    const refs = TP.extractReferences('{cpu:.2f}');
    assert(refs[0].format === '.2f');
  });

  test('Dependencies: MSD', () => {
    const deps = TP.extractEntityDependencies('{cpu} and {memory}');
    assert(deps.includes('cpu'));
    assert(deps.includes('memory'));
  });

  test('Dependencies: HA', () => {
    const deps = TP.extractEntityDependencies('{{states("sensor.temp")}}');
    assert(deps.includes('sensor.temp'));
  });

  test('Validation: Valid syntax', () => {
    const result = TP.validate('{cpu} is {{states("sensor.temp")}}');
    assert(result.valid === true);
  });

  test('Validation: Invalid syntax', () => {
    const result = TP.validate('{cpu is broken');
    assert(result.valid === false);
    assert(result.errors.length > 0);
  });

  // Print results
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));

  // Provide helpful commands
  if (passed === 10) {
    console.log('\n🎉 All tests passed!\n');
    console.log('💡 Try these commands:');
    console.log('  TP.hasTemplates("{your_template}")');
    console.log('  TP.extractReferences("{your_template}")');
    console.log('  TP.getCacheStats()');
    console.log('\nAccess via: window.__templateProcessor or window.TP\n');
  }

  // Create shortcut
  window.TP = TP;

})();
