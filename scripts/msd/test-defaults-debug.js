#!/usr/bin/env node

/**
 * Test script for MSD Defaults Manager debug functionality
 */

import { MsdDefaultsManager } from '../../src/msd/pipeline/MsdDefaultsManager.js';

console.log('🧪 Testing MSD Defaults Manager Debug Functionality\n');

try {
  // Create a new instance
  console.log('1️⃣ Creating MsdDefaultsManager instance...');
  const defaults = new MsdDefaultsManager();

  // Test basic functionality
  console.log('2️⃣ Testing basic resolution...');
  const fontSize = defaults.resolve('text.font_size');
  console.log(`   Font size: ${fontSize}`);

  const statusColor = defaults.resolve('text.status_indicator.color');
  console.log(`   Status color: ${statusColor}`);

  // Test debug method
  console.log('\n3️⃣ Testing debug method...');
  defaults.debug();

  // Test simple debug method
  console.log('\n4️⃣ Testing simple debug method...');
  defaults.testDebug();

  // Test global instance creation
  console.log('\n5️⃣ Testing global instance creation...');

  // Simulate browser environment
  global.window = {
    cblcars: {}
  };

  const globalInstance = MsdDefaultsManager.createGlobalInstance();
  console.log('✅ Global instance created successfully');

  // Test global shortcuts
  console.log('\n6️⃣ Testing global shortcuts...');
  if (global.window.cblcarsTestDebug) {
    console.log('✅ cblcarsTestDebug function exists');
    global.window.cblcarsTestDebug();
  } else {
    console.log('❌ cblcarsTestDebug function not found');
  }

  if (global.window.cblcarsDebugDefaults) {
    console.log('✅ cblcarsDebugDefaults function exists');
    console.log('🎯 Calling cblcarsDebugDefaults...');
    global.window.cblcarsDebugDefaults();
  } else {
    console.log('❌ cblcarsDebugDefaults function not found');
  }

  console.log('\n✅ All tests completed successfully!');

} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}