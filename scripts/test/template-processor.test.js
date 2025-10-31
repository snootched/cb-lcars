/**
 * Test suite for TemplateProcessor
 *
 * Run in browser console after loading cb-lcars card:
 *
 * Method 1 (Copy/paste this entire file):
 * [paste entire file contents]
 *
 * Method 2 (Load as module - if your setup supports it):
 * await import('/local/cb-lcars/test/template-processor.test.js')
 *
 * The tests will access TemplateProcessor from window.__templateProcessor
 */

// Get TemplateProcessor from global window object
const TemplateProcessor = window.__templateProcessor;

if (!TemplateProcessor) {
  console.error('❌ TemplateProcessor not found on window.__templateProcessor');
  console.error('Make sure cb-lcars card is loaded first!');
  throw new Error('TemplateProcessor not available');
}

console.log('✅ Found TemplateProcessor on window.__templateProcessor');

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.error(`❌ ${name}:`, error.message);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message || 'Values not equal'}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

console.log('🧪 Running TemplateProcessor Tests\n');

// Test 1: Template Detection - MSD
test('hasTemplates() detects MSD templates', () => {
  assert(TemplateProcessor.hasTemplates('{sensor.temp}'));
  assert(TemplateProcessor.hasTemplates('Text with {value} template'));
  assert(!TemplateProcessor.hasTemplates('Plain text'));
});

// Test 2: Template Detection - HA
test('hasTemplates() detects HA templates', () => {
  assert(TemplateProcessor.hasTemplates('{{states("sensor.temp")}}'));
  assert(TemplateProcessor.hasTemplates('Mixed {{ha}} and {msd}'));
});

// Test 3: MSD-specific detection
test('hasMSDTemplates() correctly identifies MSD syntax', () => {
  assert(TemplateProcessor.hasMSDTemplates('{sensor.temp}'));
  assert(!TemplateProcessor.hasMSDTemplates('{{states("sensor.temp")}}'));
  assert(TemplateProcessor.hasMSDTemplates('Text {value} here'));
});

// Test 4: HA-specific detection
test('hasHATemplates() correctly identifies HA syntax', () => {
  assert(TemplateProcessor.hasHATemplates('{{states("sensor.temp")}}'));
  assert(!TemplateProcessor.hasHATemplates('{sensor.temp}'));
  assert(TemplateProcessor.hasHATemplates('{{ha}} and {msd}'));
});

// Test 5: Extract simple MSD reference
test('extractReferences() parses simple MSD template', () => {
  const refs = TemplateProcessor.extractReferences('{cpu_temp}');
  assertEquals(refs.length, 1);
  assertEquals(refs[0].type, 'msd');
  assertEquals(refs[0].dataSource, 'cpu_temp');
  assertEquals(refs[0].path, null);
});

// Test 6: Extract MSD reference with path
test('extractReferences() parses MSD template with path', () => {
  const refs = TemplateProcessor.extractReferences('{cpu_temp.v}');
  assertEquals(refs.length, 1);
  assertEquals(refs[0].dataSource, 'cpu_temp');
  assertEquals(refs[0].path, 'v');
  assertEquals(refs[0].pathType, 'value');
});

// Test 7: Extract MSD reference with transformation
test('extractReferences() detects transformation path', () => {
  const refs = TemplateProcessor.extractReferences('{memory.transformations.percentage}');
  assertEquals(refs.length, 1);
  assertEquals(refs[0].dataSource, 'memory');
  assertEquals(refs[0].pathType, 'transformation');
});

// Test 8: Extract MSD reference with aggregation
test('extractReferences() detects aggregation path', () => {
  const refs = TemplateProcessor.extractReferences('{cpu.aggregations.avg}');
  assertEquals(refs.length, 1);
  assertEquals(refs[0].dataSource, 'cpu');
  assertEquals(refs[0].pathType, 'aggregation');
});

// Test 9: Extract MSD reference with format
test('extractReferences() parses format specification', () => {
  const refs = TemplateProcessor.extractReferences('{cpu_temp.v:.1f}');
  assertEquals(refs.length, 1);
  assertEquals(refs[0].dataSource, 'cpu_temp');
  assertEquals(refs[0].path, 'v');
  assertEquals(refs[0].format, '.1f');
});

// Test 10: Extract multiple references
test('extractReferences() handles multiple templates', () => {
  const refs = TemplateProcessor.extractReferences('CPU: {cpu.v:.0f}°C, Memory: {memory.v:.2f}GB');
  assertEquals(refs.length, 2);
  assertEquals(refs[0].dataSource, 'cpu');
  assertEquals(refs[1].dataSource, 'memory');
});

// Test 11: Extract HA reference
test('extractReferences() detects HA templates', () => {
  const refs = TemplateProcessor.extractReferences('{{states("sensor.temp")}}');
  assertEquals(refs.length, 1);
  assertEquals(refs[0].type, 'ha');
});

// Test 12: Extract mixed references
test('extractReferences() handles mixed MSD and HA', () => {
  const refs = TemplateProcessor.extractReferences('HA: {{states("sensor.temp")}} MSD: {cpu_temp}');
  assertEquals(refs.length, 2);
  assert(refs.some(r => r.type === 'ha'));
  assert(refs.some(r => r.type === 'msd'));
});

// Test 13: Extract entity dependencies - MSD
test('extractEntityDependencies() finds MSD DataSources', () => {
  const deps = TemplateProcessor.extractEntityDependencies('{cpu_temp} and {memory}');
  assertEquals(deps.length, 2);
  assert(deps.includes('cpu_temp'));
  assert(deps.includes('memory'));
});

// Test 14: Extract entity dependencies - HA states()
test('extractEntityDependencies() finds HA entities', () => {
  const deps = TemplateProcessor.extractEntityDependencies('{{states("sensor.temperature")}}');
  assertEquals(deps.length, 1);
  assert(deps.includes('sensor.temperature'));
});

// Test 15: Extract entity dependencies - HA state_attr()
test('extractEntityDependencies() finds HA state_attr entities', () => {
  const deps = TemplateProcessor.extractEntityDependencies('{{state_attr("sensor.temp", "unit")}}');
  assertEquals(deps.length, 1);
  assert(deps.includes('sensor.temp'));
});

// Test 16: Validate correct syntax
test('validate() accepts correct syntax', () => {
  const result = TemplateProcessor.validate('{cpu_temp} is {{states("sensor.temp")}}');
  assert(result.valid);
  assertEquals(result.errors.length, 0);
});

// Test 17: Validate unmatched MSD braces
test('validate() catches unmatched MSD braces', () => {
  const result = TemplateProcessor.validate('{cpu_temp is broken');
  assert(!result.valid);
  assert(result.errors.length > 0);
});

// Test 18: Validate unmatched HA braces
test('validate() catches unmatched HA braces', () => {
  const result = TemplateProcessor.validate('{{states("sensor.temp") is broken');
  assert(!result.valid);
  assert(result.errors.length > 0);
});

// Test 19: Edge case - empty content
test('hasTemplates() handles empty content', () => {
  assert(!TemplateProcessor.hasTemplates(''));
  assert(!TemplateProcessor.hasTemplates(null));
  assert(!TemplateProcessor.hasTemplates(undefined));
});

// Test 20: Edge case - empty references
test('extractReferences() handles empty content', () => {
  const refs = TemplateProcessor.extractReferences('');
  assertEquals(refs.length, 0);
});

// Test 21: Cache stats
test('getCacheStats() returns statistics', () => {
  const stats = TemplateProcessor.getCacheStats();
  assert(typeof stats.cacheHits === 'number');
  assert(typeof stats.cacheMisses === 'number');
  assert(typeof stats.cacheSize === 'number');
});

// Print results
console.log('\n' + '='.repeat(50));
console.log('📊 Test Results:');
console.log('='.repeat(50));
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

if (results.failed > 0) {
  console.log('\n❌ Failed Tests:');
  results.tests
    .filter(t => t.status === 'FAIL')
    .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
}

console.log('='.repeat(50));

// Provide helpful info about TemplateProcessor access
console.log('\n💡 TemplateProcessor Usage:');
console.log('='.repeat(50));
console.log('Access via: window.__templateProcessor');
console.log('\nQuick Examples:');
console.log('  TemplateProcessor.hasTemplates("{cpu}")');
console.log('  TemplateProcessor.extractReferences("{cpu.v:.2f}")');
console.log('  TemplateProcessor.extractEntityDependencies("{cpu} and {{states(\\"sensor.temp\\")}}") ');
console.log('  TemplateProcessor.validate("{cpu_temp}")');
console.log('  TemplateProcessor.getCacheStats()');
console.log('='.repeat(50));

// Make TemplateProcessor easily accessible in this scope for manual testing
if (typeof window !== 'undefined') {
  window.TP = TemplateProcessor; // Shortcut
  console.log('\n✨ Shortcut created: window.TP === TemplateProcessor');
}

// Export for use in other tests
export { results };
