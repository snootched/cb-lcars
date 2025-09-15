/**
 * Simple test runner for entity migration tests
 */

import { runMigrationTests } from './test-entity-migration.js';

console.log('🚀 Entity Runtime Migration Test Runner');
console.log('=====================================\n');

runMigrationTests().then(result => {
  console.log('\n📊 Test Runner Results:');
  if (result.passed) {
    console.log('✅ All migration tests PASSED');
    process.exit(0);
  } else {
    console.log('❌ Some migration tests FAILED');
    console.log('🔍 Check error details above');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n💥 Test Runner Error:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
