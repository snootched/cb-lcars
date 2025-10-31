#!/usr/bin/env node

/**
 * Find mergePacks calls to update them
 */

import { execSync } from 'child_process';

console.log('🔍 Finding mergePacks calls...\n');

try {
  const result = execSync(`grep -rn "mergePacks" /home/jweyermars/code/cb-lcars/src/msd/ --include="*.js"`, { encoding: 'utf8' });
  console.log('📁 Found mergePacks calls:');
  console.log(result);
} catch (error) {
  console.log('❌ Search failed:', error.message);
}

console.log('\n✅ Search complete');